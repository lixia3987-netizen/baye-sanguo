#!/usr/bin/env node
// Compile the production detail helpers, native picker renderer and FgtShowHlp.
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
    read('baye/sconst.h').split('\n').filter(l=>/^#define\s+(GOODS_|ATRR_STR11|ATRR_STR70|STR_GAMEWON|STR_GAMELOST)\b/.test(l)||/^#define\s+GOODS_/.test(l)).join('\n')].join('\n');
const globals=bridge.slice(bridge.indexOf('U8 g_hdEngineReady ='),bridge.indexOf('U8 g_hdSkillActive ='));
const helpers=['copy_gbk','hd_next_input_seq','baye_hd_view_retire','baye_hd_mini_map_retire',
    'hd_detail_copy','hd_goods_clear','hd_menu_ids_clear','hd_help_detail_clear',
    'hd_detail_read_at','hd_detail_restore','hd_tool_payload','baye_hd_tool_count','baye_hd_tool_data','baye_hd_tool_read',
    'baye_hd_person_arm','baye_hd_menu_ids','hd_goods_owner','baye_hd_goods_begin','baye_hd_goods_custom','baye_hd_goods_capture',
    'baye_hd_goods_name','baye_hd_goods_page','baye_hd_set_ready','baye_hd_world_commit',
    'baye_hd_set_report','baye_hd_report_begin','baye_hd_report_end','baye_hd_set_menu','baye_hd_set_menu_index',
    'baye_hd_menu_scope','baye_hd_menu_scope_default','baye_hd_menu_begin','baye_hd_menu_end',
    'baye_hd_fight_actor','baye_hd_fight_input_begin','baye_hd_fight_input_end','baye_hd_set_fight',
    'baye_hd_march_phase','baye_hd_march_end','baye_hd_record_end',
    'hd_help_notify','baye_hd_set_help','baye_hd_help_publish','baye_hd_help_clear',
    'baye_hd_attack_retire','baye_hd_skill_retire'].map(n=>actual('hd-bridge.c',n));
const renderers=['GetGoodsName','GetGoodsProStrCaptured','GetGoodsProStr','ShowGoodsProCaptured','ShowGoodsProStrCaptured','ShowGoodsControlInner','ShowPersonControlInner'].map(n=>actual('showface.c',n));
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
    typedef('hd-bridge.h','HdResultScope')+'\n'+typedef('hd-bridge.h','HdPictureSource')+'\n'+typedef('hd-bridge.h','HdSpeScope')+String.raw`
static U8 resource[4*1024*1024],*g_CBnkPtr=resource;
typedef struct {U32 length,position;} FakeFile;
static FakeFile file,*g_LibFp=&file;
static PersonType g_Persons[PERSON_MAX];static U32 personCount=700;
static JLPOS g_GenPos[FGTA_MAX];static U16 slotPeople[FGTA_MAX];
static U8 g_FoucsX=1,g_FoucsY=1,g_MapWid=8,g_MapHgt=8,g_PIdx=1,g_FightMapData[65536];
static struct {U16 at,df;} g_GenAtt[2];
static U16 c_Sx,c_Sy,c_Ex,c_Ey;
static struct {U8 toolPropertiesCount,toolPropertiesDisplayWitdh[256],personPropertiesCount;} cfg;
static U32 GamGetPersonCount(void){return personCount;}
static U32 gam_ftell(FakeFile*f){return f->position;}
static int gam_fseek(FakeFile*f,U32 offset,int origin){assert(origin==SEEK_SET);if(offset>=f->length)return -1;f->position=offset;return 0;}
static U16 gam_fread(void*dst,U16 size,U16 count,FakeFile*f){U32 n=(U32)size*count;
    if(n>f->length-f->position)n=f->length-f->position;memcpy(dst,resource+f->position,n);f->position+=n;return n/size;}
static int hooksEnabled,infoOverride,terrainOverride,resetInfo,moveFocus,hookTitleCalls,hookValueCalls,hookProbeCalls,goodsNameCalls;
static const char*hookName;static U8*hookBuffer;static U16*hookTool;static U8*hookProperty;
static int beginHook(const char*name){hookName=name;hookBuffer=NULL;hookTool=NULL;hookProperty=NULL;
    return (hooksEnabled&&(!strcmp(name,"getToolPropertyTitle")||!strcmp(name,"getToolPropertyValue")))||
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
static U8 ResLoadToMem(U16 id,U16 idx,U8*out){
    if(id==IFACE_STRID){
        if(idx==dFgtGenTyp)strcpy((char*)out,"CAV0INF1BOW2NAV3ELT4MAG5");
        else if(idx==dFgtHlpGen)strcpy((char*)out,"level:%     |arms:    |force:%     |iq:%     |exp:%     |hp:%     |mp:%     |atk:%     |def:%     |troops:%     |state:");
        else if(idx>=dFgtState0&&idx<=dFgtState0+8)strcpy((char*)out,"normal-state");
        else snprintf((char*)out,80,"native-terrain-%u",idx-dTerrInf0);
    }else snprintf((char*)out,80,"native-string-%u",idx);return 1;}
static void GetPersonName(PersonID p,U8*out){snprintf((char*)out,32,"person-%u",p);}
static void*gam_malloc(size_t n){return malloc(n);}static void gam_free(void*p){free(p);}
#define gam_strlen(s) strlen((const char*)(s))
#define gam_memcpy memcpy
#define gam_strcat(a,b) strcat((char*)(a),(const char*)(b))
static void gam_itoa(U32 n,U8*out,int base){assert(base==10);sprintf((char*)out,"%u",n);}
static void gam_clrlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_rect(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_revlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_drawpic(int a,int b,int c,int d,int e){(void)a;(void)b;(void)c;(void)d;(void)e;}
static void PlcMidShowStr(int a,int b,U8*text){(void)a;(void)b;(void)text;}
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
static U8 ShowPersonProStr(U8 a,U8 b,U8 c,U8 d){(void)b;(void)c;(void)d;personColumnStart=a;personColumnCalls++;return personSingleColumn?(U8)(a+1):5;}
static void ShowPersonPro(PersonID p,U8 a,U8 b,U8 c,U8 d){(void)p;(void)a;(void)b;(void)c;(void)d;}
static U8 g_hdSkillActive;
static void baye_hd_spe_invalidate(void){}
static void baye_hd_qty_invalidate(void){}
static void GamGetMsg(GMType*message);static U8 GamDelay(U16 ticks,U8 flag);
`+globals+'\n'+prototypes+'\n'+helpers.join('\n')+'\n'+toolField+'\n'+actual('tactic.c','GetArmType')+String.raw`
static int callHook(void){assert(hookBuffer);
    if(!strcmp(hookName,"getToolPropertyValue")){assert(hookTool&&hookProperty);hookValueCalls++;sprintf((char*)hookBuffer,"custom-value-%u-%u",*hookTool,*hookProperty);return 0;}
    if(!strcmp(hookName,"getToolPropertyTitle")){assert(hookProperty);hookTitleCalls++;sprintf((char*)hookBuffer,"custom-title-%u",*hookProperty);return 0;}
    if(resetInfo)baye_hd_world_commit();strcpy((char*)hookBuffer,"native-custom-help");return 0;}
`+renderers.join('\n')+'\n'+help.join('\n')+String.raw`
static void setU32(U32 at,U32 value){memcpy(resource+at,&value,4);}
static RCHEAD*goodsHeader(void){return (RCHEAD*)(resource+512);}
static RCHEAD*namesHeader(void){return (RCHEAD*)(resource+1024);}
static void prepare(void){memset(resource,0,sizeof(resource));file.length=2048;file.position=file.length;g_LibFp=&file;g_CBnkPtr=resource;
    setU32((GOODS_RESID-1)*4,512);RCHEAD*g=goodsHeader();g->ResId=GOODS_RESID;g->ItmCnt=1;g->ItmLen=3*sizeof(GOODS);g->ResLen=sizeof(RCHEAD)+g->ItmLen;
    setU32((GOODS_NAME-1)*4,1024);RCHEAD*n=namesHeader();n->ResId=GOODS_NAME;n->ItmCnt=3;n->ItmLen=8;n->ResLen=sizeof(RCHEAD)+24;
    GOODS*tools=(GOODS*)(resource+512+sizeof(RCHEAD));for(int i=0;i<3;i++){tools[i].at=10+i;tools[i].iq=20+i;tools[i].move=30+i;tools[i].arm=i+1;}
    memset(g_Persons,0,sizeof(g_Persons));memset(g_GenPos,0,sizeof(g_GenPos));for(int i=0;i<FGTA_MAX;i++)g_GenPos[i].state=STATE_SW;
    memset(g_FightMapData,1,sizeof(g_FightMapData));g_FoucsX=g_FoucsY=1;g_MapWid=g_MapHgt=8;
    g_GenPos[0]=(JLPOS){.x=1,.y=1,.hp=401,.mp=502,.state=0};slotPeople[0]=600;
    g_GenPos[11]=(JLPOS){.x=4,.y=2,.hp=1201,.mp=1302,.state=0};slotPeople[11]=699;
    g_Persons[600]=(PersonType){.Level=20,.Force=98,.IQ=92,.Experience=40,.Thew=17,.Arms=65535,.ArmsType=2};
    g_Persons[699]=(PersonType){.Level=99,.Force=68,.IQ=82,.Experience=50,.Thew=19,.Arms=12000,.ArmsType=0};
    cfg.toolPropertiesCount=cfg.personPropertiesCount=5;for(int i=0;i<256;i++)cfg.toolPropertiesDisplayWitdh[i]=5;
    hooksEnabled=infoOverride=terrainOverride=resetInfo=moveFocus=hookTitleCalls=hookValueCalls=hookProbeCalls=goodsNameCalls=0;
    personSingleColumn=personColumnStart=personColumnCalls=0;
    personCount=700;baye_hd_set_ready(1);assert(sizeof(GOODS)==66&&sizeof(RCHEAD)==14&&sizeof(RIDX)==8);}
static int messageIndex,scenario,delayMode,delayCalls;static U32 expectedMenuSeq;
static ToolID goodsList[3]={2,0,1};
static void checkRow(int index,int complete){assert(g_hdGoodsActive&&g_hdGoodsIndex==index&&g_hdGoodsTool==goodsList[index]);
    assert(g_hdGoodsComplete==complete&&g_hdMenuIdsCount==3&&g_hdMenuIds[0]==2&&g_hdMenuIds[1]==0&&g_hdMenuIds[2]==1);
    assert(g_hdGoodsGeneration==g_hdDetailGeneration&&g_hdGoodsMenuSeq==g_hdMenuSeq);}
static void GamGetMsg(GMType*m){assert(messageIndex<300);m->type=VM_CHAR_FUN;
    if(scenario==1){
        checkRow(0,messageIndex>0);if(!messageIndex){assert(g_hdGoodsPageStart==0&&g_hdGoodsPageEnd==3);m->param=VK_RIGHT;}
        else {assert(g_hdGoodsPageStart==3&&g_hdGoodsPageEnd==5);m->param=VK_EXIT;}}
    else if(scenario==2){checkRow(messageIndex?1:0,1);assert(!strcmp((char*)g_hdGoodsPropertyValues+128,messageIndex?"10":"12"));m->param=messageIndex?VK_EXIT:VK_DOWN;}
    else if(scenario==3){if(!messageIndex){checkRow(0,0);
            HdSpeScope previousSurface={0};previousSurface.compositionValid=1;previousSurface.eventId=17;hdSpeCurrent=&previousSurface;
            g_hdAttackActive=1;g_hdAttackEventId=hdSpeCopied.eventId=17;
            g_hdAttackSourceValid=g_hdAttackDisplayValid=hdAttackPaint.valid=hdSpeCopied.compositionValid=1;
            hdBackgroundPending.valid=1;hdBackgroundSession=hdBackgroundDrawing=11;hdBackgroundOwner=hdBackgroundDrawingOwner=1;
            baye_hd_set_report((U8*)"nested-report",600,1);baye_hd_report_begin(1);
            assert(!g_hdAttackSourceValid&&!g_hdAttackDisplayValid&&!hdAttackPaint.valid&&!previousSurface.compositionValid);
            assert(!hdSpeCopied.compositionValid&&!hdBackgroundPending.valid&&!hdBackgroundSession&&!hdBackgroundDrawing);
            hdSpeCurrent=NULL;g_hdAttackActive=0;
            assert(!g_hdGoodsActive&&!g_hdMenuIdsCount);baye_hd_report_end();assert(!g_hdGoodsActive);m->param=VK_RIGHT;}
        else if(messageIndex==1){checkRow(0,0);assert(!g_hdGoodsPropertyFlags[0]&&g_hdGoodsPropertyFlags[3]==3);m->param=VK_LEFT;}
        else {checkRow(0,1);assert(g_hdGoodsPropertyFlags[0]==3&&g_hdGoodsPropertyFlags[4]==3);m->param=VK_EXIT;}}
    else if(scenario==4){assert(g_hdMenuIdsCount==2&&g_hdMenuIds[0]==699&&g_hdMenuIds[1]==600&&g_hdMenuIndex==(messageIndex?1:0));m->param=messageIndex?VK_EXIT:VK_DOWN;}
    else if(scenario==5){int page=messageIndex<254?messageIndex:254;checkRow(0,page==254);
        assert(g_hdMenuSeq==expectedMenuSeq&&g_hdMenuIndex==0&&g_hdGoodsPageStart==page&&g_hdGoodsPageEnd==page+1);
        assert(hookTitleCalls==page+1&&hookValueCalls==(page+1)*3);m->param=messageIndex==255?VK_EXIT:VK_RIGHT;}
    else if(scenario==6){checkRow(0,0);assert(g_hdMenuSeq==expectedMenuSeq&&g_hdMenuIndex==0);
        assert(g_hdGoodsPageStart==0&&g_hdGoodsPageEnd==0&&hookTitleCalls==0&&hookValueCalls==0&&goodsNameCalls==6);
        m->param=messageIndex==12?VK_ENTER:VK_RIGHT;}
    else if(scenario==7){int page=messageIndex<19?messageIndex:19;
        assert(g_hdMenuIdsCount==2&&g_hdMenuIds[0]==699&&g_hdMenuIds[1]==600&&g_hdMenuIndex==0&&g_hdMenuSeq==expectedMenuSeq);
        assert(personColumnStart==page&&personColumnCalls==page+1);m->param=messageIndex==20?VK_EXIT:VK_RIGHT;}
    else assert(0);messageIndex++;}
static U8 GamDelay(U16 ticks,U8 flag){assert(ticks==0&&flag==2);delayCalls++;
    if(delayMode==1){assert(g_hdHelpActive&&g_hdHelpKind==BAYE_HD_HELP_PERSON&&g_hdHelpComplete);
        assert(g_hdHelpPerson==600&&g_hdHelpSlot==0&&g_hdHelpX==1&&g_hdHelpY==1);
        assert(!strcmp((char*)g_hdHelpNameGbk,"person-600"));assert(!strcmp((char*)g_hdHelpArmGbk,"BOW2"));
        const U16 expected[]={20,98,92,40,401,502,801,902,65535,2};assert(!memcmp(expected,g_hdHelpFields,sizeof(expected)));}
    else if(delayMode==2){assert(g_hdHelpActive&&g_hdHelpKind==BAYE_HD_HELP_PERSON&&!g_hdHelpComplete);assert(!strcmp((char*)g_hdHelpGbk,"native-custom-help"));}
    else if(delayMode==3){assert(g_hdHelpActive&&g_hdHelpKind==BAYE_HD_HELP_TERRAIN&&g_hdHelpComplete);assert(g_hdHelpTerrain==TERRAIN_TENT);}
    else if(delayMode==4){assert(!g_hdHelpActive&&!g_hdHelpComplete);}
    else if(delayMode==5){assert(g_hdHelpActive&&g_hdHelpKind==BAYE_HD_HELP_PERSON&&g_hdHelpPerson==699&&g_hdHelpX==4&&g_hdHelpY==2&&g_hdHelpLevelMax);}
    else if(delayMode==6){assert(g_hdHelpActive);HdHelpSnapshot fresh={0};fresh.generation=g_hdDetailGeneration;fresh.kind=BAYE_HD_HELP_PERSON;fresh.person=699;
        fresh.slot=11;fresh.complete=1;strcpy((char*)fresh.name,"fresh");strcpy((char*)fresh.arm,"CAV0");strcpy((char*)fresh.state,"normal");
        baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_HELP);baye_hd_help_publish(&fresh,(U8*)"fresh-context");}
    else if(delayMode==7){assert(g_hdHelpActive&&g_hdHelpKind==BAYE_HD_HELP_TERRAIN&&!g_hdHelpComplete);}
    else assert(0);return 0;}
static void resources(void){prepare();GOODS tool;assert(baye_hd_tool_count()==3&&file.position==file.length);
    assert(baye_hd_tool_read(2,&tool)&&tool.arm==3&&!baye_hd_tool_read(3,&tool));assert(file.position==file.length);
    U32 saved=file.position;goodsHeader()->ItmLen--;assert(!baye_hd_tool_count()&&file.position==saved);
    prepare();goodsHeader()->ResLen--;assert(!baye_hd_tool_count()&&file.position==file.length);
    prepare();goodsHeader()->ItmLen=GOODS_MAX*sizeof(GOODS)+sizeof(GOODS);goodsHeader()->ResLen=14+goodsHeader()->ItmLen;assert(!baye_hd_tool_count());
    prepare();goodsHeader()->ResKey=1;assert(!baye_hd_tool_count());
    prepare();goodsHeader()->ResId=GOODS_NAME;assert(!baye_hd_tool_count());
    prepare();namesHeader()->ResId=GOODS_RESID;assert(!baye_hd_tool_count());
    prepare();setU32((GOODS_RESID-1)*4,0xfffffff8u);assert(!baye_hd_tool_count());
    prepare();file.length=512+sizeof(RCHEAD)-1;file.position=file.length;assert(!baye_hd_tool_count()&&file.position==file.length);
    prepare();file.length=512+14+3*66-1;file.position=file.length;assert(!baye_hd_tool_count());
    prepare();namesHeader()->ItmCnt=2;assert(baye_hd_tool_count()==2&&!baye_hd_tool_read(2,&tool));
    prepare();namesHeader()->ResLen=sizeof(RCHEAD)+15;assert(!baye_hd_tool_count());
    prepare();namesHeader()->ItmLen=0;namesHeader()->ResLen=14+23;assert(!baye_hd_tool_count());
    prepare();file.length=file.position=1024+sizeof(RCHEAD)+24;assert(baye_hd_tool_count()==3&&file.position==file.length);
    file.position=7;assert(baye_hd_tool_count()==3&&file.position==7);
    prepare();file.length=file.position=1024+sizeof(RCHEAD)+23;assert(!baye_hd_tool_count()&&file.position==file.length);
    prepare();goodsHeader()->ItmLen=0;assert(baye_hd_tool_count()==3);
    prepare();goodsHeader()->ItmLen=0;goodsHeader()->ItmCnt=2;goodsHeader()->ResLen=14+16+3*66;
    RIDX*r=(RIDX*)(resource+512+14);r->offset=30;r->rlen=3*66;memset(resource+512+30,0,3*66);
    assert(baye_hd_tool_count()==3);r->offset=29;assert(!baye_hd_tool_count());r->offset=30;r->rlen=3*66-1;assert(!baye_hd_tool_count());
    r->rlen=3*66;r->offset=0xfffffff0u;assert(!baye_hd_tool_count());}
static void arms(void){prepare();g_Persons[600].Equip[0]=1;g_Persons[600].Equip[1]=2;
    PersonType before=g_Persons[600];for(U8 a=0;a<10;a++)for(U8 b=0;b<10;b++){
        GOODS*t=(GOODS*)(resource+512+14);t[0].arm=a;t[1].arm=b;
        assert(baye_hd_person_arm(600)==GetArmType(&g_Persons[600]));}
    assert(!memcmp(&before,&g_Persons[600],sizeof(before)));assert(baye_hd_person_arm(700)==0xffff&&baye_hd_person_arm(0xffff)==0xffff);
    g_Persons[600].Equip[1]=4;assert(baye_hd_person_arm(600)==0xffff);g_Persons[600].Equip[1]=0xffff;assert(baye_hd_person_arm(600)==0xffff);
    g_Persons[600].Equip[0]=g_Persons[600].Equip[1]=0;assert(baye_hd_person_arm(600)==2);}
static void picker(int which,int custom){prepare();scenario=which;messageIndex=0;hooksEnabled=custom;
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_GOODS);baye_hd_menu_begin();
    ToolID result=ShowGoodsControlInner(goodsList,3,0,0,0,which==2?80:29,80);
    assert(result==0xffff);assert(hookProbeCalls==0); /* observations cannot add has_hook reads */
    if(custom){assert(hookTitleCalls==5&&hookValueCalls==15&&g_hdGoodsCustom);
        for(int p=0;p<5;p++){char expected[128];sprintf(expected,"custom-value-2-%d",p);assert(!strcmp(expected,(char*)g_hdGoodsPropertyValues+p*128));
            sprintf(expected,"custom-title-%d",p);assert(!strcmp(expected,(char*)g_hdGoodsPropertyTitles+p*128));}}
    else if(which==1){const char*expected[]={"native-string-71","12","22","32","native-string-75"};
        for(int p=0;p<5;p++)assert(!strcmp(expected[p],(char*)g_hdGoodsPropertyValues+p*128));}
    baye_hd_menu_end();assert(!g_hdGoodsActive&&!g_hdMenuIdsCount);}
static void lifecycle(void){prepare();U8 packed[48]={0};U16 people[]={600,699},tools[]={2,0};
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);baye_hd_menu_begin();baye_hd_set_menu(packed,16,2,0);
    U32 generation=g_hdDetailGeneration,seq=g_hdMenuSeq;baye_hd_menu_ids(generation,seq,BAYE_HD_MENU_PERSON,people,2);
    assert(g_hdMenuIdsCount==2&&g_hdMenuIds[0]==600);baye_hd_menu_ids(generation,seq-1,BAYE_HD_MENU_PERSON,tools,2);assert(g_hdMenuIds[0]==600);
    baye_hd_set_menu(packed,16,2,1);assert(!g_hdMenuIdsCount);baye_hd_menu_end();
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_GOODS);baye_hd_menu_begin();baye_hd_set_menu(packed,16,2,0);
    generation=g_hdDetailGeneration;seq=g_hdMenuSeq;baye_hd_menu_ids(generation,seq,BAYE_HD_MENU_GOODS,tools,2);
    baye_hd_goods_begin(generation,seq,0,2,5,0,0);baye_hd_goods_capture(generation,seq,0,0,(U8*)"wrong-row",0);assert(!g_hdGoodsPropertyFlags[0]);
    baye_hd_goods_capture(generation,seq,2,0,(U8*)"right-row",0);assert(g_hdGoodsPropertyFlags[0]==2);
    baye_hd_set_menu_index(1);assert(!g_hdGoodsActive);baye_hd_goods_begin(generation,seq,1,0,5,0,0);
    baye_hd_report_begin(1);assert(!g_hdMenuIdsCount&&!g_hdGoodsActive);baye_hd_goods_begin(generation,seq,1,0,5,0,0);assert(!g_hdGoodsActive);
    baye_hd_report_end();baye_hd_goods_begin(generation,seq,1,0,5,0,0);assert(g_hdGoodsActive);
    baye_hd_world_commit();assert(g_hdDetailGeneration!=generation&&!g_hdGoodsActive&&!g_hdMenuIdsCount);
    baye_hd_goods_begin(generation,seq,1,0,5,0,0);assert(!g_hdGoodsActive);}
static void helpPerson(void){prepare();delayMode=1;delayCalls=0;FgtShowHlp();assert(delayCalls==1&&!g_hdHelpActive);
    assert(g_hdFightInputKind==BAYE_HD_FIGHT_INPUT_BUSY);prepare();moveFocus=1;delayMode=5;FgtShowHlp();assert(!g_hdHelpActive);}
static void helpOverride(void){prepare();infoOverride=1;delayMode=2;FgtShowHlp();assert(!g_hdHelpActive);
    prepare();resetInfo=1;delayMode=4;FgtShowHlp();assert(!g_hdHelpActive&&!g_hdHelpComplete);}
static void helpTerrain(void){prepare();g_FoucsX=3;g_FoucsY=3;g_FightMapData[3+3*8]=41;delayMode=3;FgtShowHlp();
    prepare();g_FoucsX=3;g_FoucsY=3;terrainOverride=1;delayMode=7;FgtShowHlp();
    prepare();g_FoucsX=8;g_FoucsY=3;delayMode=7;FgtShowHlp();}
static void helpOwner(void){prepare();delayMode=6;FgtShowHlp();assert(g_hdHelpActive&&!strcmp((char*)g_hdHelpGbk,"fresh-context"));
    assert(g_hdFightInputKind==BAYE_HD_FIGHT_INPUT_HELP);baye_hd_help_clear(g_hdHelpGeneration,g_hdHelpInputSeq);assert(!g_hdHelpActive);}
static void personPicker(void){prepare();scenario=4;messageIndex=0;PersonID list[]={699,600};
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);baye_hd_menu_begin();
    assert(ShowPersonControlInner(list,2,0,0,0,80,80)==0xffff);baye_hd_menu_end();assert(!g_hdMenuIdsCount);}
static void malformedCapture(void){prepare();U8 packed[16]={0};U16 list[]={2};
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_GOODS);baye_hd_menu_begin();baye_hd_set_menu(packed,16,1,0);
    U32 generation=g_hdDetailGeneration,seq=g_hdMenuSeq;baye_hd_menu_ids(generation,seq,BAYE_HD_MENU_GOODS,list,1);
    baye_hd_goods_begin(generation,seq,0,2,1,0,0);baye_hd_goods_capture(generation,seq,2,0,(U8*)"title",1);
    baye_hd_goods_capture(generation,seq,2,0,(U8*)"value",0);baye_hd_goods_page(generation,seq,1);assert(g_hdGoodsComplete);
    U8 invalid[128];memset(invalid,'x',sizeof(invalid));baye_hd_goods_capture(generation,seq,2,0,invalid,0);
    assert(!g_hdGoodsComplete&&g_hdGoodsPropertyFlags[0]==1&&!g_hdGoodsPropertyValues[0]);
    baye_hd_goods_capture(generation-1,seq,2,0,(U8*)"old generation",0);
    baye_hd_goods_capture(generation,seq-1,2,0,(U8*)"old menu",0);assert(g_hdGoodsPropertyFlags[0]==1);
    baye_hd_goods_capture(generation,seq,2,0,(U8*)"fresh",0);baye_hd_goods_page(generation,seq,1);assert(g_hdGoodsComplete);
    baye_hd_help_publish(&(HdHelpSnapshot){.generation=generation},(U8*)"not actual help");assert(g_hdGoodsActive);
    baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_HELP);baye_hd_help_publish(&(HdHelpSnapshot){.generation=generation},(U8*)"actual help");
    assert(!g_hdGoodsActive&&!g_hdMenuIdsCount&&g_hdHelpActive);baye_hd_report_begin(1);
    assert(!g_hdHelpGeneration&&!g_hdHelpComplete);}
static void manyGoodsPages(void){prepare();scenario=5;messageIndex=0;hooksEnabled=1;cfg.toolPropertiesCount=255;
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_GOODS);baye_hd_menu_begin();expectedMenuSeq=g_hdMenuSeq;
    assert(ShowGoodsControlInner(goodsList,3,0,0,0,17,80)==0xffff);assert(messageIndex==256&&hookTitleCalls==255&&hookValueCalls==765&&hookProbeCalls==0);
    for(int i=0;i<255;i++){char expected[128];assert(g_hdGoodsPropertyFlags[i]==3);sprintf(expected,"custom-value-2-%d",i);
        assert(!strcmp(expected,(char*)g_hdGoodsPropertyValues+i*128));sprintf(expected,"custom-title-%d",i);assert(!strcmp(expected,(char*)g_hdGoodsPropertyTitles+i*128));}
    baye_hd_menu_end();assert(!g_hdGoodsActive);}
static void noProgressGoodsPage(void){prepare();scenario=6;messageIndex=0;hooksEnabled=1;
    for(int i=0;i<256;i++)cfg.toolPropertiesDisplayWitdh[i]=255;
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_GOODS);baye_hd_menu_begin();expectedMenuSeq=g_hdMenuSeq;
    assert(ShowGoodsControlInner(goodsList,3,0,0,0,80,80)==0);assert(messageIndex==13&&hookProbeCalls==0&&g_hdMenuIndex==0);
    for(int i=0;i<5;i++)assert(!g_hdGoodsPropertyFlags[i]);baye_hd_menu_end();}
static void manyPersonPages(void){prepare();scenario=7;messageIndex=0;personSingleColumn=1;cfg.personPropertiesCount=20;
    PersonID list[]={699,600};baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);baye_hd_menu_begin();expectedMenuSeq=g_hdMenuSeq;
    assert(ShowPersonControlInner(list,2,0,0,0,80,80)==0xffff);assert(messageIndex==21&&personColumnCalls==20&&g_hdMenuIndex==0&&g_hdMenuSeq==expectedMenuSeq);
    baye_hd_menu_end();assert(!g_hdMenuIdsCount);}
static void realLibrary(const char*path,U16 count){prepare();FILE*f=fopen(path,"rb");assert(f);size_t n=fread(resource,1,sizeof(resource),f);assert(feof(f));fclose(f);
    file.length=file.position=(U32)n;assert(baye_hd_tool_count()==count&&file.position==file.length);GOODS tool;
    assert(baye_hd_tool_read(count-1,&tool)&&!baye_hd_tool_read(count,&tool));assert(file.position==file.length);}
static void toolFields(void){prepare();U8 before[2048];memcpy(before,resource,sizeof(before));
    assert(bayeHdGetToolField(2,0)==0&&bayeHdGetToolField(2,1)==12&&bayeHdGetToolField(2,2)==22);
    assert(bayeHdGetToolField(2,3)==32&&bayeHdGetToolField(2,4)==3&&bayeHdGetToolField(2,5)==0);
    assert(bayeHdGetToolField(3,1)==0xffff&&bayeHdGetToolField(2,6)==0xffff);
    assert(!memcmp(before,resource,sizeof(before))&&file.position==file.length&&hookProbeCalls==0);
    GOODS*tools=(GOODS*)(resource+512+sizeof(RCHEAD));tools[2].at=77;
    assert(bayeHdGetToolField(2,1)==77);goodsHeader()->ResKey=1;assert(bayeHdGetToolField(2,1)==0xffff);}
int main(int argc,char**argv){assert(argc>=2);switch(atoi(argv[1])){
    case 1:resources();break;case 2:arms();break;case 3:picker(1,0);break;case 4:picker(1,1);break;
    case 5:picker(2,0);break;case 6:picker(3,0);break;case 7:lifecycle();break;
    case 8:helpPerson();break;case 9:helpOverride();break;case 10:helpTerrain();break;case 11:helpOwner();break;
    case 12:assert(argc==4);realLibrary(argv[2],(U16)atoi(argv[3]));break;
    case 13:personPicker();break;case 14:malformedCapture();break;
    case 15:manyGoodsPages();break;case 16:noProgressGoodsPage();break;case 17:manyPersonPages();break;
    case 18:toolFields();break;default:assert(0);}
    puts("actual native details fixture passed");return 0;}
`;

const run=promisify(execFile);let temporary,compiled;
async function executable(){if(!compiled)compiled=(async()=>{
    temporary=mkdtempSync(join(tmpdir(),'baye-hd-details-'));const source=join(temporary,'details.c');
    const binary=join(temporary,process.platform==='win32'?'details.exe':'details');writeFileSync(source,fixture);
    try {await run(process.env.CC||'cc',['-std=c99','-fpack-struct=1','-Wall','-Wextra',source,'-o',binary],{timeout:30000});}
    catch(error){throw new Error('Native detail fixture compilation failed: '+(error.stderr?.split(/\r?\n/).filter(l=>/error:|fatal error:/.test(l)).join('\n')||error.message));}
    return binary;
})();return compiled;}
after(()=>{if(!temporary)return;assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-details-'));rmSync(temporary,{recursive:true,force:true});});
for(const [id,name] of [
    [1,'actual tool payload rejects malformed tables, ranges, record sizes and names while restoring strict EOF'],
    [2,'actual full U16 person arm matches native equipment precedence without changing a person'],
    [3,'actual goods picker accumulates selected native title/value pages across horizontal scrolling'],
    [4,'actual goods renderer captures each Mod hook result without extra calls or another row leaking'],
    [5,'actual native goods row change retires the previous selection and captures the newly selected tool'],
    [6,'a genuine nested report retires goods observations until a native page is actually rendered again'],
    [7,'actual menu IDs, reports, resets and old generation calls preserve native ownership boundaries'],
    [8,'actual FgtShowHlp publishes exact U16 numbers and observes focus after the real pre-help hook'],
    [9,'actual fighter override and reentrant reset keep incomplete or retired HD help neutral'],
    [10,'actual terrain help preserves native class/text and downgrades override or invalid focus'],
    [11,'old help unwind cannot clear or end a newer native input context'],
    [13,'actual person picker publishes full U16 reordered identities while retaining its native row index'],
    [14,'malformed or stale captures stay incomplete and real help/report ownership clears their observations'],
    [15,'actual native goods picker traverses all 255 single-column pages and ignores an extra Right on the last page'],
    [16,'actual native zero-column goods page stops repeated Right without redrawing or changing Enter selection'],
    [17,'actual person picker survives 20 property pages and preserves U16 identities, row and input sequence'],
    [18,'actual tool field export reads current validated bytes without hooks or resource writes']
])test(name,async()=>{const result=await run(await executable(),[String(id)],{timeout:20000});assert.match(result.stdout,/actual native details fixture passed/);});
for(const [file,count] of [['dat-mod.lib',33],['sc-mod.lib',101]])test(`actual ${file} tool count/last record uses the compiled 66-byte native ABI`,async()=>{
    const result=await run(await executable(),['12',join(root,'libs',file),String(count)],{timeout:20000});assert.match(result.stdout,/actual native details fixture passed/);
});
