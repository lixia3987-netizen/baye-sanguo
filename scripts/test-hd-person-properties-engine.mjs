#!/usr/bin/env node
// Compile the actual selected-person renderer, getters, menu and paint-ticket observer.
// ROM I/O, LCD primitives, Mod hooks and message delivery are boundary stubs;
// menu ownership, resource validation, field capture and retirement remain C.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test,{after} from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=join(root,'vendor/iBaye/src');
const read=file=>readFileSync(join(native,file),'utf8').replace(/\r\n/g,'\n');
function actual(file,name) {
    const source=read(file),match=new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b'+name+'\\([^;]*?\\)\\s*\\{','m').exec(source);
    assert.ok(match,`actual ${file}::${name} exists`);
    const end=source.indexOf('\n}',match.index);assert.ok(end>match.index);
    return source.slice(match.index,end+2);
}
function typedef(file,name) {
    const match=new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*'+name+';').exec(read(file));
    assert.ok(match,`native typedef ${name} exists`);return match[0];
}
const header=read('hd-bridge.h'),bridge=read('hd-bridge.c');
const constants=[header.split('\n').filter(l=>/^#define BAYE_HD_/.test(l)).join('\n'),
    read('baye/fight.h').split('\n').filter(l=>/^#define\s+(ARM_|TERRAIN_|TERN_|STATE_SW\b)/.test(l)).join('\n'),
    read('baye/consdef.h').split('\n').filter(l=>/^#define\s+(GOODS_RESID|GOODS_NAME|STRING_CONST|GEN_HEADPIC1|IFACE_STRID|TACTIC_ICON)\b/.test(l)).join('\n'),
    read('baye/sconst.h').split('\n').filter(l=>/^#define\s+(GOODS_|ATRR_STR\d+|STR_GAMEWON|STR_GAMELOST)\b/.test(l)||/^#define\s+GOODS_/.test(l)).join('\n')].join('\n');
const globals=bridge.slice(bridge.indexOf('U8 g_hdEngineReady ='),bridge.indexOf('U8 g_hdSkillActive ='));
const helpers=['copy_gbk','hd_next_input_seq','baye_hd_view_retire','baye_hd_mini_map_retire',
    'baye_hd_person_properties_retire','hd_person_properties_owner','hd_person_properties_ticket','hd_person_properties_text',
    'baye_hd_person_properties_begin','baye_hd_person_properties_capture','baye_hd_person_properties_name',
    'baye_hd_person_properties_custom','baye_hd_person_properties_publish',
    'hd_detail_copy','hd_goods_clear','hd_menu_ids_clear','hd_help_detail_clear',
    'hd_detail_read_at','hd_detail_restore','hd_tool_payload','baye_hd_tool_count','baye_hd_tool_data','baye_hd_tool_read',
    'baye_hd_person_arm','baye_hd_menu_ids','hd_goods_owner','baye_hd_goods_begin','baye_hd_goods_custom','baye_hd_goods_capture',
    'baye_hd_goods_name','baye_hd_goods_page','baye_hd_set_ready','baye_hd_world_commit',
    'baye_hd_set_report','baye_hd_report_begin','baye_hd_report_end','baye_hd_set_menu','baye_hd_set_menu_index',
    'baye_hd_menu_scope','baye_hd_menu_scope_default','baye_hd_menu_begin','baye_hd_menu_end',
    'baye_hd_fight_actor','baye_hd_fight_input_begin','baye_hd_fight_input_end','baye_hd_set_fight',
    'baye_hd_march_phase','baye_hd_march_end','baye_hd_record_end',
    'hd_help_notify','baye_hd_set_help','baye_hd_help_publish','baye_hd_help_clear',
    'hd_ai_publish','hd_ai_retire','baye_hd_attack_retire','baye_hd_skill_retire','baye_hd_set_qty','baye_hd_qty_begin','baye_hd_qty_end'].map(n=>actual('hd-bridge.c',n));
const renderers=['GetPersonProStrCaptured','GetPersonProStr','ShowPersonProCaptured','ShowPersonPro','ShowPersonProStrCaptured','ShowPersonProStr','GetGoodsName','GetGoodsProStrCaptured','GetGoodsProStr','ShowGoodsProCaptured','ShowGoodsProStrCaptured','ShowGoodsControlInner','ShowPersonControlInner'].map(n=>actual('showface.c',n));
const help=['FgtFormatStr','FgtLoadToMem2','FgtGetTerrain','FgtGetGenIdx','FgtShowHlp'].map(n=>actual('FightSub.c',n));
const toolField=actual('platform/js/exportjs.c','bayeHdGetToolField');
const prototypes=[...helpers,...renderers,...help,toolField].map(s=>s.slice(0,s.indexOf('{'))+';').join('\n');
const fixture=String.raw`
#define _CRT_SECURE_NO_WARNINGS
#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;typedef int16_t I16;
typedef U16 PersonID;typedef U16 ToolID;
#define FAR
#define EM_ASM(...) ((void)0)
#define PID(x) (x)
#define TID(x) (x)
#define PERSON_MAX 2000
#define GOODS_MAX 2000
#define FGTA_MAX 20
#define MAX_LEVEL 99
#define ASC_WID 1
#define ASC_HGT 8
#define HLP_SX 0
#define HLP_SY 0
#define HLP_EX 159
#define HLP_EY 95
`+constants+'\n'+read('data/pstring.h')+'\n'+
    ['GOODS','PersonType'].map(n=>typedef('baye/attribute.h',n)).join('\n')+'\n'+
    ['RCHEAD','RIDX'].map(n=>typedef('baye/datman.h',n)).join('\n')+'\n'+
    typedef('baye/fight.h','JLPOS')+'\n'+typedef('hd-bridge.h','HdHelpSnapshot')+'\n'+
    typedef('hd-bridge.h','HdResultScope')+'\n'+typedef('hd-bridge.h','HdPictureSource')+'\n'+typedef('hd-bridge.h','HdAiTargetSource')+'\n'+typedef('hd-bridge.h','HdSpeScope')+String.raw`
static U8 resource[4*1024*1024],*g_CBnkPtr=resource;
typedef struct {U32 length,position;} FakeFile;
static FakeFile file,*g_LibFp=&file;
static PersonType g_Persons[PERSON_MAX];static U32 personCount=700;
static JLPOS g_GenPos[FGTA_MAX];static U16 slotPeople[FGTA_MAX];
static U8 g_FoucsX=1,g_FoucsY=1,g_MapWid=8,g_MapHgt=8,g_PIdx=1,g_FightMapData[65536];
static struct {U16 at,df;} g_GenAtt[2];
static U16 c_Sx,c_Sy,c_Ex,c_Ey;
static struct {U8 toolPropertiesCount,toolPropertiesDisplayWitdh[256],personPropertiesCount,personPropertiesDisplayWitdh[256];} cfg;
static U32 GamGetPersonCount(void){return personCount;}
static U8 GetPersonCity(PersonID p){return (U8)(p%38);}
static void GetCityName(U8 city,U8*out){sprintf((char*)out,"city-%u",city);}
static U32 gam_ftell(FakeFile*f){return f->position;}
static int gam_fseek(FakeFile*f,U32 offset,int origin){assert(origin==SEEK_SET);if(offset>=f->length)return -1;f->position=offset;return 0;}
static U16 gam_fread(void*dst,U16 size,U16 count,FakeFile*f){U32 n=(U32)size*count;
    if(n>f->length-f->position)n=f->length-f->position;memcpy(dst,resource+f->position,n);f->position+=n;return n/size;}
static int hooksEnabled,infoOverride,terrainOverride,resetInfo,moveFocus,hookTitleCalls,hookValueCalls,hookProbeCalls,goodsNameCalls;
static int scenario,messageIndex,nameCalls,drawCalls,reportReentry,nameReentry,hookReentry;
static U16*mutateIds;
static const char*hookName;static U8*hookBuffer;static U16*hookTool;static U8*hookProperty;
static int beginHook(const char*name){hookName=name;hookBuffer=NULL;hookTool=NULL;hookProperty=NULL;
    hookProbeCalls++;
    return (hooksEnabled&&(!strcmp(name,"getPersonPropertyTitle")||!strcmp(name,"getPersonPropertyValue")))||
        (!strcmp(name,"getFighterInfo")&&(infoOverride||resetInfo))||(!strcmp(name,"getTerrainInfo")&&terrainOverride);}
static int has_hook(const char*name){hookProbeCalls++;return hooksEnabled&&(!strcmp(name,"getToolPropertyTitle")||!strcmp(name,"getToolPropertyValue"));}
static int callHook(void);
#define IF_HAS_HOOK(name) if(beginHook(name))
#define BIND_U16EX(name,pointer) (hookTool=(pointer))
#define BIND_U8EX(name,pointer) (hookProperty=(pointer))
#define BIND_U8(pointer) (hookProperty=(pointer))
#define BIND_GBKARR(pointer,size) (hookBuffer=(pointer))
#define CALL_HOOK() callHook()
#define HOOK_RETURN() return
#define HOOK_LEAVE() ((void)0)
static int call_hook_a(const char*name,void*arg){(void)arg;assert(!strcmp(name,"fightWillShowHelp"));if(moveFocus){g_FoucsX=4;g_FoucsY=2;}return 1;}
static U8*ResLoadToCon(U16 id,U16 idx,U8*bank){(void)idx;
    if(id==GOODS_RESID){U32 a;memcpy(&a,bank+(GOODS_RESID-1)*4,4);return bank+a+sizeof(RCHEAD);}return bank;}
static U8 ResLoadToMemN(U16 id,U16 idx,U8*out,U16 size){assert(id==GOODS_NAME&&size==32);goodsNameCalls++;snprintf((char*)out,size,"tool-%u",idx-1);return 1;}
static U8 ResLoadToMem(U16 id,U16 idx,U8*out){U32 a,n,o;memcpy(&a,resource+(id-1)*4,4);
    RCHEAD*h=(RCHEAD*)(resource+a);assert(h->ResId==id&&idx&&idx<=h->ItmCnt&&!h->ResKey);
    if(h->ItmLen){n=h->ItmLen;o=sizeof(*h)+(idx-1)*n;}else if(h->ItmCnt==1){o=sizeof(*h);n=h->ResLen-o;}
    else{RIDX*r=(RIDX*)(resource+a+sizeof(*h)+(idx-1)*sizeof(RIDX));o=r->offset;n=r->rlen;}
    assert(n<128&&a+o+n<=file.length);memcpy(out,resource+a+o,n);out[n]=0;return 0;}
static void retireDuringName(void);
static void GetPersonName(PersonID p,U8*out){nameCalls++;(void)p;strcpy((char*)out,"same-name");if(nameReentry&&nameCalls==4)retireDuringName();}
static void*gam_malloc(size_t n){return malloc(n);}static void gam_free(void*p){free(p);}
#define gam_strlen(s) strlen((const char*)(s))
#define gam_memcpy memcpy
#define gam_strcat(a,b) strcat((char*)(a),(const char*)(b))
static void gam_itoa(U32 n,U8*out,int base){assert(base==10);sprintf((char*)out,"%u",n);}
static void gam_clrlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_rect(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_revlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_drawpic(int a,int b,int c,int d,int e){(void)a;(void)b;(void)c;(void)d;(void)e;}
static void PlcMidShowStr(int a,int b,U8*text){(void)a;(void)b;assert(text);drawCalls++;}
typedef struct {U8 sx,sy,ex,ey;} RECT;
static void PlcStrShowS(RECT*a,RECT*b,U8*text){(void)a;(void)b;(void)text;}
static void GamStrShowS(int a,int b,U8*text){(void)a;(void)b;(void)text;}
static void BuiltAtkAttr(int a,int b){(void)a;(void)b;g_GenAtt[0].at=801;g_GenAtt[0].df=902;}
static PersonID TransIdxToGen1(U8 slot){return slotPeople[slot];}
typedef struct {int left,top,right,bottom;} Rect;
typedef struct {int x,y;} Point;
typedef struct {int currentX,currentY,completed,moved,touched;} Touch;
typedef struct {int sx,sy,ex,ey,x,y;} PosItemType;
typedef struct {U8 type;U16 param;} GMType;
#define VM_CHAR_FUN 1
#define VM_TOUCH 2
#define VT_TOUCH_DOWN 1
#define VT_TOUCH_UP 2
#define VT_TOUCH_MOVE 3
#define VK_UP 1
#define VK_DOWN 2
#define VK_LEFT 3
#define VK_RIGHT 4
#define VK_ENTER 5
#define VK_EXIT 6
#define VK_SEARCH 7
#define VK_PGUP 8
#define VK_HELP 9
#define VK_PGDN 10
#define GamMsgIsTimer0(message) 0
static int touchUpdate(Touch*t,GMType m){(void)t;(void)m;return 0;}
static int pointState(int a,int b,int c){(void)a;(void)b;(void)c;return 0;}
static void touchUpdateViewState(Touch*t,int a,int b){(void)t;(void)a;(void)b;}
static I16 touchListViewItemIndexAtPoint(int a,int b,Rect c,int d,int e,int f,int g,int h){(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;(void)g;(void)h;return -1;}
static Point touchListViewCalcTopLeftForMove(Touch*t,int a,int b,int c,int d,int e,int f){(void)t;(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;Point p={0,0};return p;}
static U32 limitValueInRange(U32 n,U32 a,U32 b){return n<a?a:n>b?b:n;}
static void InitItem(int x,int y,int ex,int ey,PosItemType*p){p->sx=p->x=x;p->sy=p->y=y;p->ex=ex;p->ey=ey;}
static int AddItem(int w,int h,PosItemType*p,U8*x,U8*y){if(p->x+w-1>p->ex)return 0;*x=p->x;*y=p->y;p->x+=w;(void)h;return 1;}
static int personSingleColumn,personColumnStart,personColumnCalls;
static U8 g_hdSkillActive;
static void baye_hd_spe_invalidate(void){}
static void baye_hd_qty_invalidate(void){}
static void GamGetMsg(GMType*message);static U8 GamDelay(U16 ticks,U8 flag);
`+globals+'\n'+prototypes+'\n'+helpers.join('\n')+'\n'+toolField+'\n'+actual('tactic.c','GetArmType')+String.raw`
static void retireDuringName(void){if(mutateIds){mutateIds[0]=1;return;}baye_hd_report_begin(1);baye_hd_report_end();}
static int callHook(void){assert(hookBuffer&&hookProperty);U8 column=*hookProperty;
    if(!strcmp(hookName,"getPersonPropertyTitle")){hookTitleCalls++;sprintf((char*)hookBuffer,"custom-title-%u",column);}
    else if(!strcmp(hookName,"getPersonPropertyValue")){assert(hookTool);U16 p=*hookTool;hookValueCalls++;
        sprintf((char*)hookBuffer,"custom-value-%u-%u",p,column);*hookTool=1;*hookProperty=11;}
    else assert(0);
    if(hookReentry&&hookTitleCalls==1){int which=hookReentry;hookReentry=0;
        if(which==1){baye_hd_report_begin(1);baye_hd_report_end();}
        if(which==2)baye_hd_set_help((U8*)"nested help");
        if(which==3){U32 s=baye_hd_qty_begin();baye_hd_qty_end(s,0,0,0,BAYE_HD_QTY_NO_KEY);}
        if(which==4)baye_hd_world_commit();
        if(which==5){baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);baye_hd_menu_begin();baye_hd_menu_end();}
    }return 0;}
`+'\n'+renderers.join('\n')+'\n'+help.join('\n')+String.raw`
static PersonType beforePeople[PERSON_MAX];static U32 originalSeq,previousPaint;
static void prepare(const char*path){FILE*f=fopen(path,"rb");assert(f);size_t n=fread(resource,1,sizeof(resource),f);assert(feof(f));fclose(f);file.length=file.position=(U32)n;
    memset(g_Persons,0,sizeof(g_Persons));for(int i=0;i<PERSON_MAX;i++)g_Persons[i]=(PersonType){.Belong=1,.Level=17,.Force=91,.IQ=83,.Devotion=77,.Experience=31,.Thew=92,.ArmsType=2,.Arms=1234,.Age=45};
    g_Persons[0].Belong=1;g_Persons[600].Thew=88;g_Persons[699].Thew=66;
    memcpy(beforePeople,g_Persons,sizeof(beforePeople));baye_hd_set_ready(1);g_hdQtyActive=g_hdHelpActive=0;
    nameCalls=drawCalls=hookTitleCalls=hookValueCalls=hookProbeCalls=messageIndex=0;hooksEnabled=hookReentry=nameReentry=0;mutateIds=NULL;
    cfg.personPropertiesCount=13;for(int i=0;i<256;i++)cfg.personPropertiesDisplayWitdh[i]=5;
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);baye_hd_menu_begin();originalSeq=g_hdMenuSeq;previousPaint=0;
}
static void checkCurrent(U16 person,U16 index){assert(g_hdPersonPropertiesActive&&g_hdPersonPropertiesPageComplete);
    assert(g_hdPersonPropertiesGeneration==g_hdDetailGeneration&&g_hdPersonPropertiesMenuSeq==originalSeq&&g_hdMenuSeq==originalSeq);
    assert(g_hdPersonPropertiesIndex==index&&g_hdMenuIndex==index&&g_hdPersonPropertiesPerson==person&&g_hdMenuIds[index]==person);
    assert(!strcmp((char*)g_hdPersonPropertiesNameGbk,"same-name"));assert(g_hdPersonPropertiesPaintSeq>previousPaint);
    previousPaint=g_hdPersonPropertiesPaintSeq;
    for(int p=g_hdPersonPropertiesPageStart;p<g_hdPersonPropertiesPageEnd;p++){
        assert(g_hdPersonPropertiesPropertyFlags[p]==3&&g_hdPersonPropertiesTitlePaintSeq[p]==previousPaint&&g_hdPersonPropertiesValuePaintSeq[p]==previousPaint);
        char expected[128];if(hooksEnabled){sprintf(expected,"custom-title-%d",p);assert(!strcmp(expected,(char*)g_hdPersonPropertiesPropertyTitles+p*128));
            sprintf(expected,"custom-value-%u-%d",person,p);assert(!strcmp(expected,(char*)g_hdPersonPropertiesPropertyValues+p*128));}
        else{ResLoadToMem(STRING_CONST,ATRR_STR18+p,(U8*)expected);assert(!strcmp(expected,(char*)g_hdPersonPropertiesPropertyTitles+p*128));}
    }
    assert(!memcmp(beforePeople,g_Persons,sizeof(beforePeople)));
}
static void GamGetMsg(GMType*m){m->type=VM_CHAR_FUN;m->param=VK_EXIT;
    if(scenario==1){checkCurrent(600,1);assert(g_hdPersonPropertiesComplete&&!g_hdPersonPropertiesCustom&&g_hdPersonPropertiesPropertyCount==13);
        const char* expected[]={NULL,"city-30","17","91","83","77","31","88",NULL,"1234","45","",""};
        for(int i=1;i<13;i++)if(expected[i])assert(!strcmp(expected[i],(char*)g_hdPersonPropertiesPropertyValues+i*128));
        assert(nameCalls==8&&drawCalls==56&&hookProbeCalls==52);}
    else if(scenario==2){checkCurrent(600,1);assert(g_hdPersonPropertiesComplete&&g_hdPersonPropertiesCustom&&g_hdPersonPropertiesPropertyCount==12);
        assert(hookTitleCalls==12&&hookValueCalls==36&&hookProbeCalls==48&&nameCalls==6&&drawCalls==52);}
    else if(scenario==3){checkCurrent(messageIndex?600:0,messageIndex?1:0);assert(g_hdPersonPropertiesComplete);m->param=messageIndex?VK_EXIT:VK_DOWN;}
    else if(scenario==4){int page=messageIndex<254?messageIndex:254;
        if(messageIndex<255)checkCurrent(600,1);else assert(g_hdPersonPropertiesPaintSeq==previousPaint);
        assert(g_hdPersonPropertiesPageIndex==page&&g_hdPersonPropertiesPageStart==page&&g_hdPersonPropertiesPageEnd==page+1);
        assert(g_hdPersonPropertiesComplete==(page==254));assert(hookTitleCalls==page+1&&hookValueCalls==(page+1)*3);
        if(page>0)assert(g_hdPersonPropertiesTitlePaintSeq[0]<previousPaint&&g_hdPersonPropertiesValuePaintSeq[0]<previousPaint);
        m->param=messageIndex==255?VK_ENTER:VK_RIGHT;}
    else if(scenario==5){assert(g_hdPersonPropertiesActive&&!g_hdPersonPropertiesPageComplete&&!g_hdPersonPropertiesComplete);
        assert(g_hdPersonPropertiesPageStart==0&&g_hdPersonPropertiesPageEnd==0&&hookTitleCalls==0&&hookValueCalls==0);
        if(messageIndex)assert(g_hdPersonPropertiesPaintSeq==previousPaint);else previousPaint=g_hdPersonPropertiesPaintSeq;
        assert(nameCalls==6&&drawCalls==4);m->param=messageIndex==12?VK_ENTER:VK_RIGHT;}
    else if(scenario>=6&&scenario<=10){assert(!g_hdPersonPropertiesActive&&!g_hdPersonPropertiesPaintSeq);}
    else if(scenario==11||scenario==15){assert(!g_hdPersonPropertiesActive&&!g_hdPersonPropertiesPaintSeq);}
    else if(scenario==12){if(!messageIndex){checkCurrent(600,1);m->param=VK_RIGHT;}else if(messageIndex==1){checkCurrent(600,1);assert(g_hdPersonPropertiesPageIndex==1);m->param=VK_LEFT;}else{checkCurrent(600,1);assert(g_hdPersonPropertiesPageIndex==0&&g_hdPersonPropertiesTitlePaintSeq[1]<previousPaint);}}
    else if(scenario==13){assert(g_hdPersonPropertiesActive&&!g_hdPersonPropertiesPageComplete&&!g_hdPersonPropertiesComplete&&g_hdPersonPropertiesPropertyCount==0);}
    else assert(0);messageIndex++;
}
static U8 GamDelay(U16 ticks,U8 flag){(void)ticks;(void)flag;return 0;}
static void directOwner(void){U16 list[]={0,600,699};U8 names[48]={0};
    U32 ticket=baye_hd_person_properties_begin(g_hdDetailGeneration,g_hdMenuSeq,1,list,3,2,0,0);assert(ticket);
    baye_hd_person_properties_capture(ticket,1,600,0,(U8*)"title0",1);
    baye_hd_person_properties_capture(ticket,0,0,0,(U8*)"other-row",0);
    baye_hd_person_properties_name(ticket,1,600,(U8*)"same-name");
    baye_hd_set_menu(names,16,3,1);baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,list,3);baye_hd_person_properties_publish(ticket,1);
    assert(g_hdPersonPropertiesActive&&!g_hdPersonPropertiesPageComplete&&g_hdPersonPropertiesPropertyFlags[0]==1);
    ticket=baye_hd_person_properties_begin(g_hdDetailGeneration,g_hdMenuSeq,1,list,3,2,0,0);U8 invalid[128];memset(invalid,'x',128);
    baye_hd_person_properties_capture(ticket,1,600,0,invalid,1);baye_hd_person_properties_capture(ticket,1,600,0,(U8*)"",0);
    baye_hd_person_properties_capture(ticket,1,600,1,(U8*)"\x81",1);baye_hd_person_properties_capture(ticket,1,600,1,(U8*)"valid",0);
    baye_hd_person_properties_name(ticket,1,600,(U8*)"same-name");baye_hd_set_menu(names,16,3,1);baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,list,3);baye_hd_person_properties_publish(ticket,2);
    assert(!g_hdPersonPropertiesPageComplete&&!g_hdPersonPropertiesComplete&&g_hdPersonPropertiesPropertyFlags[0]==2&&g_hdPersonPropertiesPropertyFlags[1]==2);
    assert(!g_hdPersonPropertiesTitlePaintSeq[0]&&!g_hdPersonPropertiesPropertyTitles[0]);
    baye_hd_set_menu_index(0);assert(!g_hdPersonPropertiesActive);baye_hd_person_properties_publish(ticket,2);assert(!g_hdPersonPropertiesActive);
    assert(!baye_hd_person_properties_begin(g_hdDetailGeneration-1,g_hdMenuSeq,0,list,3,2,0,0));
    assert(!baye_hd_person_properties_begin(g_hdDetailGeneration,g_hdMenuSeq,3,list,3,2,0,0));
    assert(!baye_hd_person_properties_begin(g_hdDetailGeneration,g_hdMenuSeq,0,list,3,256,0,0));
}
static void offscreenAndReentry(void){U16 list[]={0,600,699};U8 names[48]={0};
    U32 ticket=baye_hd_person_properties_begin(g_hdDetailGeneration,g_hdMenuSeq,2,list,3,1,0,0);
    ShowPersonProStrCaptured(0,0,0,80,ticket,2,699);ShowPersonProCaptured(0,0,0,8,80,ticket,0);ShowPersonProCaptured(600,0,0,16,80,ticket,1);
    baye_hd_set_menu(names,16,3,2);baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,list,3);baye_hd_person_properties_publish(ticket,1);
    assert(g_hdPersonPropertiesActive&&!g_hdPersonPropertiesPageComplete&&!g_hdPersonPropertiesNameGbk[0]&&g_hdPersonPropertiesPropertyFlags[0]==1);
    ticket=baye_hd_person_properties_begin(g_hdDetailGeneration,g_hdMenuSeq,2,list,3,1,0,0);baye_hd_set_menu_index(0);baye_hd_set_menu_index(2);
    baye_hd_set_menu(names,16,3,2);baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,list,3);baye_hd_person_properties_publish(ticket,1);assert(!g_hdPersonPropertiesActive);
    ticket=baye_hd_person_properties_begin(g_hdDetailGeneration,g_hdMenuSeq,2,list,3,1,0,0);U16 changed[]={0,1,699};
    baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,changed,3);baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,list,3);
    baye_hd_person_properties_publish(ticket,1);assert(!g_hdPersonPropertiesActive);
}
int main(int argc,char**argv){assert(argc==3);scenario=atoi(argv[1]);prepare(argv[2]);U16 list[]={0,600,699};
    if(scenario==14)directOwner();else if(scenario==16)offscreenAndReentry();else{if(scenario==2)cfg.personPropertiesCount=12;
        if(scenario>=2&&scenario!=13)hooksEnabled=1;
        if(scenario==4){cfg.personPropertiesCount=255;}
        if(scenario==5)for(int i=0;i<256;i++)cfg.personPropertiesDisplayWitdh[i]=255;
        if(scenario>=6&&scenario<=10)hookReentry=scenario-5;
        if(scenario==11)nameReentry=1;
        if(scenario==15){nameReentry=1;mutateIds=list;}
        if(scenario==13)cfg.personPropertiesCount=0;
        int width=scenario==4||scenario==12?17:159;
        PersonID result=ShowPersonControlInner(list,3,scenario==3?0:1,0,0,width,80);
        assert(result==(scenario==4||scenario==5?1:0xffff));
        if(scenario==4)assert(messageIndex==256&&hookTitleCalls==255&&hookValueCalls==765&&hookProbeCalls==1020&&g_hdPersonPropertiesComplete);
        if(scenario==5)assert(messageIndex==13);
    }
    assert(!memcmp(beforePeople,g_Persons,sizeof(beforePeople)));baye_hd_menu_end();assert(!g_hdPersonPropertiesActive&&!g_hdPersonPropertiesPaintSeq);
    puts("actual native selected person properties passed");return 0;}
`;
const run=promisify(execFile);let temporary,compiled;
async function executable(){if(!compiled)compiled=(async()=>{temporary=mkdtempSync(join(tmpdir(),'baye-hd-person-properties-'));
    const source=join(temporary,'person-properties.c'),binary=join(temporary,process.platform==='win32'?'person-properties.exe':'person-properties');writeFileSync(source,fixture);
    try{await run(process.env.CC||'cc',['-std=c99','-fpack-struct=1','-Wall','-Wextra',source,'-o',binary],{timeout:30000});}
    catch(e){throw Error('Actual person properties C compilation failed: '+(e.stderr||e.message));}return binary;})();return compiled;}
after(()=>{if(!temporary)return;assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-person-properties-'));rmSync(temporary,{recursive:true,force:true});});
for(const[id,name]of [
    [1,'actual standard13 properties use native values and actual LIB titles for selected high-ID row only'],
    [2,'actual custom12 properties capture final hook text despite local ID/column rewrites with exact original call counts'],
    [3,'initial and Arrow paints follow local selected row before published index updates, including person0 and same names'],
    [4,'actual255 single-column pages accumulate revisions and boundary Right does not fabricate a new paint'],
    [5,'native zero-progress columns preserve selection and block repeated Right without extra draw/getter calls'],
    [6,'nested real report with same menu sequence permanently retires the suspended paint ticket'],
    [7,'actual HELP takeover prevents a suspended page from publishing'],
    [8,'actual QTY begin/end cannot revive a previous person paint'],
    [9,'actual reset invalidates the old generation even if the native renderer resumes'],
    [10,'nested real menu begin/end invalidates the older paint sequence'],
    [11,'original packed-name pass reentry retires tentative selected properties before final publication'],
    [12,'backward paging refreshes the current native page and preserves explicitly older revisions'],
    [13,'native zero property count remains an incomplete page rather than fabricated data'],
    [14,'unknown rows, truncated GBK and missing terminators cannot become a complete page or revive retired ownership'],
    [15,'real packed-name hook identity mutation cannot relabel selected-row values as a different menu'],
    [16,'offscreen selected row remains incomplete and selection/full IDs changes cannot revive a ticket even after restoration']
])test(name,async()=>{const r=await run(await executable(),[String(id),join(root,'libs/dat-mod.lib')],{timeout:20000});assert.match(r.stdout,/actual native selected person properties passed/);});
