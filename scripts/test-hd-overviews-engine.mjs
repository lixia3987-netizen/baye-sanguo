#!/usr/bin/env node
// Run the production VIEW10 renderer and GetCitySet message loop. Only LCD,
// ROM labels, Mod hooks and delivered messages are replaced at the boundary.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test, {after} from 'node:test';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const native = join(root, 'vendor/iBaye/src');
const read = file => readFileSync(join(native, file), 'utf8').replace(/\r\n/g, '\n');
function actual(file, name) {
    const source = read(file);
    const match = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm').exec(source);
    assert.ok(match, `production ${file}::${name} exists`);
    const end = source.indexOf('\n}', match.index);
    assert.ok(end > match.index);
    return source.slice(match.index, end + 2);
}
function typedef(file, name) {
    const match = new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*' + name + ';').exec(read(file));
    assert.ok(match, `production typedef ${name} exists`);
    return match[0];
}
const run = promisify(execFile);
let temporary, compiled;
async function executable() {
    if (!compiled) compiled = (async () => {
        temporary = mkdtempSync(join(tmpdir(), 'baye-hd-overviews-'));
        const source = join(temporary, 'overviews.c');
        const binary = join(temporary, process.platform === 'win32' ? 'overviews.exe' : 'overviews');
        writeFileSync(source, fixture());
        try {
            await run(process.env.CC || 'cc', ['-std=c99', '-fpack-struct=1', '-Wall', '-Wextra', source, '-o', binary], {timeout: 30000});
        } catch (error) {
            throw new Error('Native overviews fixture compilation failed: ' +
                (error.stderr?.split(/\r?\n/).filter(line => /error:|fatal error:/.test(line)).join('\n') || error.message));
        }
        return binary;
    })();
    return compiled;
}
after(() => {
    if (!temporary) return;
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith('baye-hd-overviews-'));
    rmSync(temporary, {recursive: true, force: true});
});

const boundary = String.raw`
#define _CRT_SECURE_NO_WARNINGS
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
typedef uint8_t U8; typedef uint16_t U16; typedef uint32_t U32;
typedef int8_t I8; typedef int16_t I16; typedef int32_t I32;
typedef U16 PersonID; typedef U16 ToolID;
#define FAR
#define PID(x) (x)
#define EM_ASM(...) ((void)0)
#define FGTA_MAX 20
#define FGT_PLAMAX 10
#define PERSON_MAX 2000
#define CITY_MAX 38
#define VM_CHAR_FUN 0x05
#define VM_TIMER 0x06
#define VM_TOUCH 0x10
#define VT_TOUCH_DOWN 1
#define VT_TOUCH_UP 2
#define VT_TOUCH_MOVE 3
#define VK_UP 0x22
#define VK_DOWN 0x23
#define VK_LEFT 0x24
#define VK_RIGHT 0x25
#define VK_HELP 0x26
#define VK_ENTER 0x27
#define VK_EXIT 0x28
#define VK_SEARCH 0x33
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define SCR_WID 160
#define SCR_HGT 96
#define ASC_WID 6
#define HZ_WID 12
#define HZ_HGT 12
#define COLOR_BLACK 1
#define COLOR_WHITE 0
#define CITYMAP_W 30
#define CITYMAP_H 25
#define CITYMAP_TIL_W 16
#define CITYMAP_TIL_H 16
#define SHOWMAP_WS 8
#define SHOWMAP_HS 6
#define IFACE_STRID 1
#define TACTIC_ICON 75
#define gam_strlen(s) strlen((const char*)(s))
#define gam_memset memset
#define gam_memcpy memcpy
typedef struct {I16 left,top,right,bottom;} Rect;
typedef struct {I16 x,y;} Point;
typedef struct {U8 completed,touched,moved;I16 startX,startY,currentX,currentY;} Touch;
typedef struct {U8 type;U16 param;I16 x,y;} MsgType;
typedef MsgType GMType;
static Rect g_cityCursorRange={0,0,29,24};
static int scrolling, nameCalls, labelCalls, showMapCalls, pixelCalls, pictureCalls;
static int showHook, refreshHook, miniHook, hookCalls, resetInName, resetInHook;
static int returnFromShowHook, longName;
static const char*g_engineVersion="fixture";
static U8 g_MapWid=8,g_MapHgt=6;
static U16 g_FgtBoutCnt=11,g_EneTmpProv;
static struct {U8 Mode;U16 MProvender,EProvender;PersonID GenArray[20];} g_FgtParam;
static PersonType g_Persons[PERSON_MAX];
static JLPOS g_GenPos[20];
static struct {int x,y;char text[128];} lcdLines[128];
static int lineCount;
static int SysScrollingTimerOpen(int value){int previous=scrolling;scrolling=value;return previous;}
static void gam_clslcd(void){lineCount=0;}
static void gam_clrlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;lineCount=0;}
static void gam_rect(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_line(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_putpixel(int x,int y,int color){assert(x>=0&&y>=0);(void)color;pixelCalls++;}
static void gam_clrvscr(int a,int b,int c,int d,void*screen){(void)a;(void)b;(void)c;(void)d;(void)screen;}
static U8 g_VisScr[160*96];
static void gam_drawpic(int id,int index,int x,int y,int mask){
    assert(id==TACTIC_ICON&&index==0&&mask==1);assert(x==37&&y==15);pictureCalls++;
}
static void GamStrShowS(int x,int y,U8*text){assert(lineCount<128);
    lcdLines[lineCount].x=x;lcdLines[lineCount].y=y;
    snprintf(lcdLines[lineCount++].text,128,"%s",text);
}
static void gam_ltoa(U32 value,U8*out,int radix){assert(radix==10);sprintf((char*)out,"%u",value);}
static void GetPersonName(PersonID person,U8*out){assert(person<PERSON_MAX);nameCalls++;
    if(longName&&person>500)snprintf((char*)out,32,"ACTUAL-LONG-GENERAL-%u",person);
    else snprintf((char*)out,32,"P%u",person);
    if(resetInName){resetInName=0;baye_hd_world_commit();}}
static void ResLoadToMem(U16 resource,U16 item,U8*out){assert(resource==IFACE_STRID);labelCalls++;
    memset(out,0,20);
    switch(item){case dPowerCmp:strcpy((char*)out,"VIEW");break;
    case dDaysInf:strcpy((char*)out,"DAY");break;case dReserve0:strcpy((char*)out,"POSITIONS");break;
    case dArmyInf:strcpy((char*)out,"ARMY");break;case dProvInf:strcpy((char*)out,"FOOD:");break;
    case dNoView:strcpy((char*)out,"UNKNOWN");break;default:assert(0);}}
static int call_hook_a(const char*name,void*args){(void)args;hookCalls++;
    if(resetInHook&&!strcmp(name,"showMiniMap")){resetInHook=0;baye_hd_world_commit();}
    if(!strcmp(name,"showMiniMap"))return miniHook?0:-1;
    if(!strcmp(name,"didShowMainMap"))return -1;
    assert(!strcmp(name,"didShowFightSituation"));return returnFromShowHook?0:showHook?1:-1;}
static void call_hook(const char*name,void*args){(void)args;assert(!strcmp(name,"didRefreshFightSituation"));hookCalls++;}
static int call_hook_a_observed(const char*name,void*args,U8*present){
    if(present)*present=0;
    if(!strcmp(name,"didRefreshFightSituation")){if(present)*present=refreshHook!=0;call_hook(name,args);return refreshHook?0:-1;}
    if(present)*present=!strcmp(name,"showMiniMap")?miniHook!=0:showHook!=0;
    return call_hook_a(name,args);
}
static Rect MakeRect(I16 x,I16 y,I16 w,I16 h){Rect r={x,y,(I16)(x+w),(I16)(y+h)};return r;}
static int touchIsPointInRect(I16 x,I16 y,Rect r){return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
static void touchUpdate(Touch*t,GMType message){t->currentX=message.x;t->currentY=message.y;
    if(message.param==VT_TOUCH_DOWN){t->startX=message.x;t->startY=message.y;t->touched=1;t->moved=0;}
    if(message.param==VT_TOUCH_MOVE)t->moved=1;t->completed=message.param==VT_TOUCH_UP;}
static Point touchListViewCalcTopLeftForMove(Touch*t,int x,int maxX,int cw,int y,int maxY,int ch){
    (void)t;(void)maxX;(void)cw;(void)maxY;(void)ch;Point p={(I16)x,(I16)y};return p;}
static U8 ShowCityMap(CitySetType*pos){showMapCalls++;assert(pos->setx<CITYMAP_W&&pos->sety<CITYMAP_H);return 3;}
static GMType messages[32],lastMessage;
static int messageCount,messageIndex;
static void beforeMessage(int index);
static void GamGetMsg(GMType*out){assert(messageIndex<messageCount);beforeMessage(messageIndex);*out=messages[messageIndex++];lastMessage=*out;}
static void GamGetLastMsg(MsgType*out){*out=lastMessage;}
static U8 GamDelay(U16 ticks,U8 mode){assert(ticks==50&&mode==1);GamGetMsg(&lastMessage);return lastMessage.type==VM_TIMER?0:1;}
static void message(U8 type,U16 key,I16 x,I16 y){assert(messageCount<32);messages[messageCount++]=(GMType){type,key,x,y};}
static void key(U16 code){message(VM_CHAR_FUN,code,0,0);}
`;

// Protocol helpers and assertions are assembled below from the current native
// sources, so the fixture cannot pass on a replacement FgtShowViewInner stub.
function fixture() {
    const header = read('hd-bridge.h'), bridge = read('hd-bridge.c');
    const globals = bridge.slice(bridge.indexOf('U8 g_hdEngineReady ='), bridge.indexOf('U8 g_hdSkillActive ='));
    const helpers = ['copy_gbk', 'hd_next_input_seq', 'baye_hd_person_properties_retire', 'hd_detail_copy', 'hd_goods_clear', 'hd_menu_ids_clear',
        'hd_help_detail_clear', 'hd_detail_read_at', 'hd_detail_restore', 'hd_overview_resource',
        'baye_hd_view_capture', 'baye_hd_view_publish', 'baye_hd_view_clear', 'baye_hd_view_retire',
        'baye_hd_mini_map_publish', 'baye_hd_mini_map_clear', 'baye_hd_mini_map_retire',
        'baye_hd_fight_actor', 'baye_hd_fight_input_begin', 'baye_hd_fight_input_end',
        'baye_hd_map_input_begin', 'baye_hd_set_map_pick', 'baye_hd_menu_end', 'baye_hd_march_phase', 'baye_hd_march_end',
        'baye_hd_set_report', 'baye_hd_report_begin', 'baye_hd_report_end', 'baye_hd_record_end',
        'baye_hd_set_fight', 'baye_hd_set_ready', 'baye_hd_world_commit', 'hd_help_notify', 'baye_hd_set_help',
        'baye_hd_attack_retire','baye_hd_skill_retire']
        .map(name => actual('hd-bridge.c', name));
    const functions = ['FgtShowView', 'FgtShowViewInner', 'FgtViewForce', 'FgtViewForceCapture', 'FgtViewCaptureText',
        'FgtStatGen', 'FgtLoadToMem3', 'TransIdxToGen3'].map(name => actual('FgtPkAi.c', name));
    functions.push(actual('cityedit.c', 'GetCitySet'), actual('cityedit.c', 'GetCitySetInner'));
    const declarations = [...helpers, ...functions].map(body => body.slice(0, body.indexOf('{')) + ';').join('\n');
    const constants = header.split('\n').filter(line => /^#define BAYE_HD_/.test(line)).join('\n') +
        '\n#define STATE_SW 8\n#define STRING_CONST 0\n#define STR_GAMEWON 1\n#define STR_GAMELOST 2\n';
    const types = [typedef('baye/attribute.h', 'PersonType'), typedef('baye/fight.h', 'JLPOS'),
        typedef('baye/paccount.h', 'CitySetType'), typedef('baye/datman.h', 'RCHEAD'),
        typedef('baye/datman.h', 'RIDX'), typedef('baye/graph.h', 'PictureHeadType'),
        typedef('hd-bridge.h', 'HdViewSnapshot'), typedef('hd-bridge.h', 'HdPictureSource'),
        typedef('hd-bridge.h', 'HdSpeScope'), typedef('hd-bridge.h', 'HdResultScope')].join('\n');
    return boundary.replace('static Rect g_cityCursorRange', constants + read('data/pstring.h') + '\n' + types +
        '\n' + globals + '\n' + declarations + '\nstatic Rect g_cityCursorRange') + resourceBoundary +
        '\n' + helpers.join('\n') + '\n' + functions.join('\n') + cases;
}

const resourceBoundary = String.raw`
static U8 rom[4*1024*1024],*g_CBnkPtr=rom;
typedef struct {U32 length,position;} FakeFile;
static FakeFile file,*g_LibFp=&file;
static U32 GamGetPersonCount(void){return 700;}
static U32 gam_ftell(FakeFile*f){return f->position;}
static int gam_fseek(FakeFile*f,U32 offset,int origin){assert(origin==SEEK_SET);
    if(offset>=f->length)return -1;f->position=offset;return 0;}
static U16 gam_fread(void*out,U16 size,U16 count,FakeFile*f){U32 n=(U32)size*count;
    if(n>f->length-f->position)n=f->length-f->position;memcpy(out,rom+f->position,n);f->position+=n;return (U16)(n/size);}
static U8 g_hdSkillActive;
static void baye_hd_spe_invalidate(void){}
static void baye_hd_qty_invalidate(void){}
static void setupResource(void){U32 address=512;RCHEAD header;PictureHeadType picture;
    assert(sizeof(RCHEAD)==14&&sizeof(RIDX)==8&&sizeof(PictureHeadType)==7);
    memset(rom,0,sizeof(rom));memset(&header,0,sizeof(header));memset(&picture,0,sizeof(picture));
    memcpy(rom+(TACTIC_ICON-1)*4,&address,4);picture.wid=84;picture.hig=64;picture.count=1;picture.mask=1;
    header.ResId=TACTIC_ICON;header.ItmCnt=1;header.ItmLen=sizeof(picture)+11*64*2;
    header.ResLen=sizeof(header)+header.ItmLen;
    memcpy(rom+address,&header,sizeof(header));memcpy(rom+address+sizeof(header),&picture,sizeof(picture));
    file.length=address+header.ResLen;file.position=file.length;
}
`;

const cases = String.raw`
static int scenario;
static U32 lastInput,lastPage,miniFirstSeq;
static U16 expectedWidth=84,expectedHeight=64;static U8 expectedMask=1;
static CitySetType position,beforePosition;
static void setup(void){
    int i;memset(g_Persons,0,sizeof(g_Persons));memset(&g_FgtParam,0,sizeof(g_FgtParam));
    memset(g_GenPos,0,sizeof(g_GenPos));for(i=0;i<20;i++)g_GenPos[i].state=STATE_SW;
    for(i=0;i<8;i++){g_FgtParam.GenArray[i]=(U16)(600+i);g_Persons[599+i].Belong=2;g_Persons[599+i].Arms=(U16)(100+i);
        g_GenPos[i].state=0;g_GenPos[i].x=(U8)(i%8);g_GenPos[i].y=0;}
    for(i=0;i<9;i++){g_FgtParam.GenArray[10+i]=(U16)(680+i);g_Persons[679+i].Belong=3;g_Persons[679+i].Arms=(U16)(200+i);
        g_GenPos[10+i].state=0;g_GenPos[10+i].x=(U8)(i%8);g_GenPos[10+i].y=2;}
    g_GenPos[11].state=STATE_SW;g_FgtParam.MProvender=1234;g_FgtParam.EProvender=60000;g_FgtParam.Mode=1;
    g_EneTmpProv=0;scrolling=7;setupResource();baye_hd_set_ready(1);baye_hd_set_fight(1,0);
}
static void assertPage(U8 force,U8 start){
    int i,base=force*10,total=force?9:8,rows=total-start;if(rows>5)rows=5;
    assert(g_hdViewActive&&g_hdViewComplete&&!g_hdViewCustom);
    assert(g_hdViewForce==force&&g_hdViewPageStart==start&&g_hdViewPageSize==5);
    assert(g_hdViewTotalCount==total&&g_hdViewRowCount==rows);
    assert(g_hdViewGeneration==g_hdDetailGeneration&&g_hdViewInputSeq==g_hdFightInputSeq);
    assert(g_hdViewDays==11&&g_hdViewMapWidth==8&&g_hdViewMapHeight==6&&g_hdViewPlayerMode==1);
    assert(!strcmp((char*)g_hdViewTitleGbk,"VIEW")&&!strcmp((char*)g_hdViewDaysGbk,"DAY11 "));
    assert(!strcmp((char*)g_hdViewPositionsGbk,"POSITIONS"));
    if(force){assert(!g_hdViewFoodKnown&&!g_hdViewFood);assert(!strcmp((char*)g_hdViewFoodGbk,"FOOD:UNKNOWN"));}
    else {assert(g_hdViewFoodKnown&&g_hdViewFood==1234);assert(!strcmp((char*)g_hdViewFoodGbk,"FOOD:1234"));}
    for(i=0;i<rows;i++){int slot=base+start+i;char expected[32];
        assert(g_hdViewRowSlots[i]==slot&&g_hdViewRowPersons[i]==g_FgtParam.GenArray[slot]-1);
        assert(g_hdViewRowArms[i]==g_Persons[g_hdViewRowPersons[i]].Arms);
        sprintf(expected,"P%u",g_hdViewRowPersons[i]);assert(!strcmp((char*)g_hdViewRowNames+i*32,expected));
        assert(!strcmp((char*)g_hdViewRowText+i*64,lcdLines[2+i].text));
    }
    assert(g_hdViewPointCount==16);
    for(i=0;i<g_hdViewPointCount;i++)assert(g_hdViewPointSlots[i]!=11);
    if(force&&start==0)assert(g_hdViewRowSlots[1]==11); /* dead row remains native, pixel does not */
}
static void beforeMessage(int index){
    if(scenario==1){
        const U8 force[]={1,0,0,0,0,0,1,1},start[]={0,0,5,5,0,0,0,0};assertPage(force[index],start[index]);
        if(index==7){assert(g_hdFightInputSeq==lastInput&&g_hdViewSeq==lastPage);} /* timer blink */
        else if(index){assert(g_hdFightInputSeq!=lastInput&&g_hdViewSeq!=lastPage);}
        lastInput=g_hdFightInputSeq;lastPage=g_hdViewSeq;
    }else if(scenario==2){assert(g_hdViewActive&&g_hdViewComplete&&g_hdViewFoodKnown&&g_hdViewFood==777);
        assert(!strcmp((char*)g_hdViewFoodGbk,"FOOD:777"));}
    else if(scenario==3){assert(g_hdViewActive&&!g_hdViewComplete&&g_hdViewCustom);}
    else if(scenario==4){assert(!g_hdViewActive&&!g_hdViewComplete);}
    else if(scenario==8){if(index==0){assert(g_hdViewActive&&g_hdViewComplete);lastInput=g_hdFightInputSeq;refreshHook=1;}
        else {assert(!g_hdViewComplete);assert(g_hdFightInputSeq==lastInput);}}
    else if(scenario==9){assert(g_hdViewActive&&g_hdViewComplete);assert(g_hdViewRowCount==5);
        assert(!strcmp((char*)g_hdViewRowNames,"ACTUAL-LONG-GENERAL-679"));
        assert(!strcmp((char*)g_hdViewRowText,lcdLines[2].text));}
    else if(scenario>=10&&scenario<=14){
        if(index==1||index==2&&scenario==11){
            assert(g_hdMiniMapActive&&g_hdMiniMapGeneration==g_hdDetailGeneration);
            assert(g_hdMiniMapInputSeq==g_hdMapInputSeq);
            if(scenario==12){assert(!g_hdMiniMapComplete&&g_hdMiniMapCustom&&!g_hdMiniMapDefaultDraw);}
            else if(scenario==13){assert(!g_hdMiniMapComplete&&g_hdMiniMapDefaultDraw);}
            else {assert(g_hdMiniMapComplete&&!g_hdMiniMapCustom&&g_hdMiniMapDefaultDraw);
                assert(g_hdMiniMapWidth==expectedWidth&&g_hdMiniMapHeight==expectedHeight&&g_hdMiniMapMask==expectedMask);}
            assert(g_hdMiniMapCursorX==beforePosition.setx&&g_hdMiniMapCursorY==beforePosition.sety);
            assert(g_hdMiniMapViewX==beforePosition.x&&g_hdMiniMapViewY==beforePosition.y&&g_hdMiniMapCity1==3);
            assert(file.position==file.length); /* strict EOF is restored */
            miniFirstSeq=g_hdMiniMapSeq;
        }else if(index){assert(!g_hdMiniMapActive);assert(!memcmp(&position,&beforePosition,sizeof(position)));}
    }else if(scenario==15&&index==1){assert(!g_hdMiniMapActive);}
    else if(scenario==16){
        assert(!memcmp(&position,&beforePosition,sizeof(position)));
        if(index==1){assert(g_hdMiniMapActive&&g_hdMiniMapComplete);miniFirstSeq=g_hdMiniMapSeq;lastInput=g_hdMapInputSeq;}
        else if(index==3){assert(g_hdMiniMapActive&&g_hdMiniMapComplete);assert(g_hdMiniMapSeq!=miniFirstSeq&&g_hdMapInputSeq==lastInput);}
        else if(index){assert(!g_hdMiniMapActive&&g_hdMapInputSeq==lastInput);}
    }
}
static void pages(void){
    U8 paramsBefore[sizeof(g_FgtParam)],peopleBefore[sizeof(g_Persons)],posBefore[sizeof(g_GenPos)];setup();scenario=1;
    memcpy(paramsBefore,&g_FgtParam,sizeof(g_FgtParam));memcpy(peopleBefore,g_Persons,sizeof(g_Persons));memcpy(posBefore,g_GenPos,sizeof(g_GenPos));
    key(VK_RIGHT);key(VK_DOWN);key(VK_DOWN);key(VK_UP);key(VK_UP);key(VK_LEFT);message(VM_TIMER,0,0,0);key(VK_ENTER);
    FgtShowView();assert(!g_hdViewActive&&!g_hdViewComplete&&g_hdFightInputKind==0&&scrolling==7);
    assert(!memcmp(paramsBefore,&g_FgtParam,sizeof(g_FgtParam))&&!memcmp(peopleBefore,g_Persons,sizeof(g_Persons))&&!memcmp(posBefore,g_GenPos,sizeof(g_GenPos)));
    assert(nameCalls==38&&hookCalls==9); /* seven faction names plus native rows 5,5,3,3,5,5,5 */
}
static void enemyFood(void){setup();scenario=2;g_EneTmpProv=777;key(VK_EXIT);FgtShowView();assert(!g_hdViewActive);}
static void customView(int which){setup();scenario=3;if(which==0)showHook=1;else refreshHook=1;key(VK_EXIT);FgtShowView();assert(!g_hdViewActive&&hookCalls==2);}
static void viewReset(void){setup();scenario=4;U32 generation=g_hdDetailGeneration;resetInName=1;key(VK_EXIT);FgtShowView();
    assert(g_hdDetailGeneration!=generation&&!g_hdViewActive&&!g_hdViewComplete);}
static void viewAbort(void){setup();returnFromShowHook=1;FgtShowView();assert(messageIndex==0&&!g_hdViewActive&&scrolling==7);}
static void viewReport(void){HdViewSnapshot old,fresh;setup();baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_VIEW);
    baye_hd_view_capture(&old);FgtViewForceCapture(1,0,&old);baye_hd_view_publish(&old);assert(g_hdViewActive);
    HdSpeScope previousSurface={0};previousSurface.compositionValid=1;previousSurface.eventId=17;hdSpeCurrent=&previousSurface;
            g_hdAttackActive=1;g_hdAttackEventId=hdSpeCopied.eventId=17;
    g_hdAttackSourceValid=g_hdAttackDisplayValid=hdAttackPaint.valid=hdSpeCopied.compositionValid=1;
    hdBackgroundPending.valid=1;hdBackgroundSession=hdBackgroundDrawing=11;hdBackgroundOwner=hdBackgroundDrawingOwner=1;
    U32 input=g_hdFightInputSeq; baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);baye_hd_report_end();
    assert(!g_hdAttackSourceValid&&!g_hdAttackDisplayValid&&!hdAttackPaint.valid&&!previousSurface.compositionValid);
    assert(!hdSpeCopied.compositionValid&&!hdBackgroundPending.valid&&!hdBackgroundSession&&!hdBackgroundDrawing);
    hdSpeCurrent=NULL;g_hdAttackActive=0;
    assert(g_hdFightInputSeq==input&&!g_hdViewActive);baye_hd_view_publish(&old);assert(!g_hdViewActive);
    baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_VIEW);baye_hd_view_capture(&fresh);FgtViewForceCapture(0,0,&fresh);
    baye_hd_view_publish(&fresh);assert(g_hdViewActive&&g_hdViewInputSeq==fresh.inputSeq);
    baye_hd_view_clear(old.generation,old.inputSeq);assert(g_hdViewActive);baye_hd_view_clear(fresh.generation,fresh.inputSeq);assert(!g_hdViewActive);}
static void viewLateCustom(void){setup();scenario=8;message(VM_TIMER,0,0,0);key(VK_EXIT);FgtShowView();assert(!g_hdViewActive);}
static void viewLongName(void){setup();scenario=9;longName=1;key(VK_EXIT);FgtShowView();assert(!g_hdViewActive&&nameCalls==6&&hookCalls==2);}
static void miniClose(U16 closing){setup();baye_hd_set_fight(0,0);scenario=10;
    position=(CitySetType){3,4,7,8};beforePosition=position;key(VK_SEARCH);key(closing);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff);assert(!memcmp(&position,&beforePosition,sizeof(position)));
    assert(showMapCalls==2&&pictureCalls==1&&!g_hdMiniMapActive&&g_hdMiniMapSeq!=miniFirstSeq&&!g_hdMapPick&&scrolling==7);}
static void miniTouch(void){setup();baye_hd_set_fight(0,0);scenario=11;position=(CitySetType){3,4,7,8};beforePosition=position;
    key(VK_SEARCH);message(VM_TOUCH,VT_TOUCH_DOWN,20,20);message(VM_TOUCH,VT_TOUCH_UP,20,20);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff);assert(!memcmp(&position,&beforePosition,sizeof(position))&&showMapCalls==2&&pictureCalls==1);}
static void miniCustom(void){setup();baye_hd_set_fight(0,0);scenario=12;miniHook=1;
    position=(CitySetType){3,4,7,8};beforePosition=position;key(VK_SEARCH);key(VK_ENTER);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff&&pictureCalls==0&&!g_hdMiniMapActive);}
static void miniMissing(void){setup();baye_hd_set_fight(0,0);scenario=13;file.length--;file.position=file.length;
    position=(CitySetType){3,4,7,8};beforePosition=position;key(VK_SEARCH);key(VK_ENTER);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff&&pictureCalls==1&&!g_hdMiniMapActive);}
static void miniBadPicture(int kind){setup();baye_hd_set_fight(0,0);scenario=13;
    PictureHeadType*picture=(PictureHeadType*)(rom+512+sizeof(RCHEAD));
    if(kind==0)picture->mask=2;else if(kind==1)picture->wid=0;else picture->count=0;
    position=(CitySetType){3,4,7,8};beforePosition=position;key(VK_SEARCH);key(VK_ENTER);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff&&pictureCalls==1&&!g_hdMiniMapActive);}
static void miniReset(void){setup();baye_hd_set_fight(0,0);scenario=15;resetInHook=1;
    position=(CitySetType){3,4,7,8};beforePosition=position;key(VK_SEARCH);key(VK_EXIT);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff&&!g_hdMiniMapActive);}
static void miniReopen(void){setup();baye_hd_set_fight(0,0);scenario=16;
    position=(CitySetType){3,4,7,8};beforePosition=position;key(VK_SEARCH);key(VK_ENTER);key(VK_SEARCH);key(VK_ENTER);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff&&!g_hdMiniMapActive);assert(pictureCalls==2&&showMapCalls==3);}
static void realMini(const char*filename,U16 width,U16 height,U8 mask){setup();FILE*f=fopen(filename,"rb");assert(f);
    size_t count=fread(rom,1,sizeof(rom),f);assert(count&&feof(f));fclose(f);file.length=(U32)count;file.position=file.length;
    baye_hd_set_fight(0,0);scenario=14;expectedWidth=width;expectedHeight=height;expectedMask=mask;
    position=(CitySetType){3,4,7,8};beforePosition=position;key(VK_SEARCH);key(VK_ENTER);key(VK_EXIT);
    assert(GetCitySet(&position)==0xff&&pictureCalls==1&&!g_hdMiniMapActive);assert(file.position==file.length);}
int main(int argc,char**argv){assert(argc>=2);switch(atoi(argv[1])){
    case 1:pages();break;case 2:enemyFood();break;case 3:customView(0);break;case 4:customView(1);break;
    case 5:viewReset();break;case 6:viewAbort();break;case 7:viewReport();break;case 8:viewLateCustom();break;case 9:viewLongName();break;
    case 10:assert(argc==3);miniClose((U16)atoi(argv[2]));break;
    case 11:miniTouch();break;case 12:miniCustom();break;case 13:miniMissing();break;case 15:miniReset();break;case 16:miniReopen();break;
    case 20:assert(argc==6);realMini(argv[2],(U16)atoi(argv[3]),(U16)atoi(argv[4]),(U8)atoi(argv[5]));break;
    case 21:assert(argc==3);miniBadPicture(atoi(argv[2]));break;default:assert(0);}
    puts("actual native overviews fixture passed");return 0;}
`;

for (const [id, name] of [
    [1, 'actual VIEW10 preserves native rows, dead-point filtering, both forces, pages, boundary ACK and idle blinking'],
    [2, 'actual VIEW10 discloses enemy food only when the native temporary intelligence is known'],
    [3, 'actual show-situation Mod hook retains LCD fallback without duplicate hook calls'],
    [4, 'actual refresh-situation Mod hook retains LCD fallback'],
    [5, 'a reset during an actual native name read cannot revive a suspended old VIEW page'],
    [6, 'a Mod returning early from the actual situation display retires its owner'],
    [7, 'a real report retires a suspended VIEW capture even when its fight wait is unchanged, and old clears cannot close a new page'],
    [8, 'a newly installed refresh hook retires the displayed standard view during an idle blink without an input ACK'],
    [9, 'a long actual native name is captured before the LCD troop offset without overflow or a second name read'],
    [11, 'a real miniature touch-up is consumed without changing the native city cursor'],
    [12, 'a real custom miniature publication does not claim a default strategic image'],
    [13, 'a truncated real picture payload stays incomplete and restores the strict EOF stream cursor'],
    [15, 'a reset during the actual map hook cannot republish the suspended miniature'],
    [16, 'a second real miniature in one GetCitySet wait has a fresh publication token without changing its map cursor']
]) test(name, async () => {
    const result = await run(await executable(), [String(id)], {timeout: 20000});
    assert.match(result.stdout, /actual native overviews fixture passed/);
});
for (const key of [0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x33, 0x34]) {
    test(`native miniature consumes closing key ${key} without navigation or city entry`, async () => {
        const result = await run(await executable(), ['10', String(key)], {timeout: 20000});
        assert.match(result.stdout, /actual native overviews fixture passed/);
    });
}
for (const [kind, name] of [[0, 'unsupported mask flags'], [1, 'zero width'], [2, 'zero image count']]) {
    test(`a real miniature with ${name} keeps its native image path but cannot claim complete HD metadata`, async () => {
        const result = await run(await executable(), ['21', String(kind)], {timeout: 20000});
        assert.match(result.stdout, /actual native overviews fixture passed/);
    });
}
for (const filename of ['dat-mod.lib', 'sc-mod.lib']) {
    test(`actual ${filename} resource 75 uses the compiled native picture ABI and restores the real EOF cursor`, async () => {
        const lib = readFileSync(join(root, 'libs', filename));
        const address = lib.readUInt32LE((75 - 1) * 4), resourceLength = lib.readUInt32LE(address);
        assert.equal(lib.readUInt16LE(address + 4), 75); assert.equal(lib.readUInt16LE(address + 12), 0);
        const itemCount = lib.readUInt16LE(address + 6), fixed = lib.readUInt32LE(address + 8);
        const offset = fixed || itemCount === 1 ? address + 14 : address + lib.readUInt32LE(address + 14);
        const length = fixed || (itemCount === 1 ? resourceLength - 14 : lib.readUInt32LE(address + 18));
        assert.ok(offset + length <= address + resourceLength && address + resourceLength <= lib.length);
        const width = lib.readUInt16LE(offset), height = lib.readUInt16LE(offset + 2), mask = lib[offset + 6];
        assert.ok(width > 0 && height > 0);
        const result = await run(await executable(), ['20', join(root, 'libs', filename), String(width), String(height), String(mask)], {timeout: 20000});
        assert.match(result.stdout, /actual native overviews fixture passed/);
    });
}

test('the actual observed JS hook boundary detects presence during its single native lookup and preserves custom return minus one', () => {
    const nativeFunction = actual('platform/js/script.c', 'call_hook_s_observed');
    const body = nativeFunction.match(/EM_ASM_INT\(\{([\s\S]*?)\}, name, context, present\)/)?.[1];
    assert.ok(body, 'use the production embedded JS, not a recreated hook lookup');
    for (const available of [false, true]) for (const cContext of [0, 99]) {
        let lookups = 0, calls = 0, contextReads = 0;
        const heap = new Uint8Array(8); heap[3] = 77;
        const hooks = new Proxy({}, {get(object, name) {
            assert.equal(name, 'showMiniMap'); lookups++;
            return available ? () => -1 : undefined;
        }});
        const environment = {HEAPU8: heap, $0: 10, $1: cContext, $2: 3,
            UTF8ToString: pointer => {assert.equal(pointer, 10); return 'showMiniMap';},
            baye_bridge_value: pointer => {assert.equal(pointer, 99); contextReads++; return {native: 99};},
            baye: {hooks, callHook(name, value) {
                assert.equal(name, 'showMiniMap'); calls++;
                assert.deepEqual(value, cContext ? {native: 99} : undefined); return -1;
            }}};
        environment.window = environment;
        const result = vm.runInNewContext('(function(){' + body + '})()', environment);
        assert.equal(result, -1); assert.equal(lookups, 1);
        assert.equal(calls, available ? 1 : 0); assert.equal(contextReads, available && cContext ? 1 : 0);
        assert.equal(heap[3], available ? 1 : 0, 'custom minus one is still a custom publication');
    }
    assert.doesNotMatch(actual('FgtPkAi.c', 'FgtShowViewInner'), /has_hook\s*\(/);
    assert.doesNotMatch(actual('cityedit.c', 'GetCitySetInner'), /has_hook\s*\(/);
    assert.match(actual('platform/js/script.c', 'call_hook_s'), /call_hook_s_observed\(name, context, NULL\)/);
    assert.match(actual('platform/js/script.c', 'call_hook_a'), /call_hook_a_observed\(name, context, NULL\)/);
    const asyncBoundary = actual('platform/js/script.c', 'call_hook_a_observed');
    assert.match(asyncBoundary, /while\s*\(g_asyncActionID\)/);
    assert.ok(asyncBoundary.indexOf('g_asyncActionID = 0') < asyncBoundary.indexOf('switch (action)'));
    assert.equal((asyncBoundary.match(/js_callback\(&rv\)/g) || []).length, 13);
});

test('actual VIEW row bindings expose U8 arrays and retain GBK slots beyond embedded NULs', async () => {
    const bindHeader = read('baye/data-bind.h'), definitions = read('data-bind.c');
    const types = bindHeader.slice(bindHeader.indexOf('typedef struct ObjectDef ObjectDef;'),
        bindHeader.indexOf('#define ObjectDef_addFieldU8'));
    const primitiveDefinitions = ['_U8_def', '_U16_def', '_U32_def', '_str_def'].map(name => {
        const match = new RegExp('ValueDef ' + name + ' = \\{[\\s\\S]*?\\};').exec(definitions);
        assert.ok(match, 'use the actual native primitive definition');
        return match[0];
    }).join('\n');
    const helpers = ['ValueDef_free', 'ObjectDef_new', 'ObjectDef_free', 'ObjectDef_addField',
        'ObjectDef_addFieldF', 'ObjectDef_addFieldGBKArray', 'ObjectDef_addFieldArray']
        .map(name => actual('data-bind.c', name));
    const prototypes = helpers.map(source => source.slice(0, source.indexOf('{')) + ';').join('\n');
    const macros = read('baye/bind-objects.h').split('\n')
        .filter(line => /^#define DEFADD_(?:U8ARR|GBKARR)\b/.test(line)).join('\n');
    const rows = read('hd-bridge.c').match(/^U8 g_hdViewRowSlots[^;]+;/m)?.[0];
    const calls = actual('hd-bridge.c', 'baye_hd_bind').split('\n')
        .filter(line => /DEFADD_\w+\(g_hdViewRow(?:Names|Text),/.test(line)).join('\n');
    assert.ok(rows); assert.equal(calls.split('\n').length, 2);
    const source = String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8; typedef uint16_t U16; typedef uint32_t U32;
#define gam_malloc malloc
#define gam_realloc realloc
#define gam_free free
` + types + '\n' + primitiveDefinitions + '\n' + prototypes + '\n' + helpers.join('\n') + '\n' +
        macros + '\n' + rows + '\nstatic void bindActualViewSlots(ObjectDef* def) {\n' + calls + '\n}\n' + String.raw`
int main(void) {
    const U8 first[] = {0xb2,0xdc,0xb2,0xd9,0};
    const U8 second[] = {0xcd,0xf5,0xbf,0xef,0};
    memcpy(g_hdViewRowNames,first,sizeof(first));
    memcpy(g_hdViewRowNames+32,second,sizeof(second));
    memcpy(g_hdViewRowNames+9*32,second,sizeof(second));
    memcpy(g_hdViewRowText,first,sizeof(first));
    memcpy(g_hdViewRowText+64,second,sizeof(second));
    memcpy(g_hdViewRowText+9*64,second,sizeof(second));
    ObjectDef* def=ObjectDef_new();
    bindActualViewSlots(def);
    assert(def->count==2);
    for(U32 index=0;index<2;index++) {
        Field* field=&def->fields[index];
        U8* bytes=index?g_hdViewRowText:g_hdViewRowNames;
        U32 stride=index?64:32;
        assert(!strcmp(field->name,index?"g_hdViewRowText":"g_hdViewRowNames"));
        assert(field->value.def->type==ValueTypeArray);
        assert(field->value.def->subdef.arrDef==&_U8_def);
        assert(field->value.def->subdef.arrDef->size==1);
        assert(field->value.def->size==10*stride);
        assert(field->value.offset==(U32)(uintptr_t)bytes);
        assert(bytes[4]==0);
        assert(!memcmp(bytes+stride*field->value.def->subdef.arrDef->size,second,sizeof(second)));
        assert(!memcmp(bytes+9*stride*field->value.def->subdef.arrDef->size,second,sizeof(second)));
    }
    ObjectDef_free(def);
    puts("actual VIEW byte-array binding passed");
}
`;
    const bindingDirectory = mkdtempSync(join(tmpdir(), 'baye-hd-overview-bindings-'));
    try {
        const filename = join(bindingDirectory, 'binding.c');
        const binary = join(bindingDirectory, process.platform === 'win32' ? 'binding.exe' : 'binding');
        writeFileSync(filename, source);
        await run(process.env.CC || 'cc', ['-std=c99', '-fpack-struct=1', '-Wall', '-Wextra', filename, '-o', binary], {timeout: 30000});
        const result = await run(binary, [], {timeout: 20000});
        assert.match(result.stdout, /actual VIEW byte-array binding passed/);
    } finally {
        assert.equal(dirname(resolve(bindingDirectory)), resolve(tmpdir()));
        assert.ok(basename(bindingDirectory).startsWith('baye-hd-overview-bindings-'));
        rmSync(bindingDirectory, {recursive: true, force: true});
    }
});
