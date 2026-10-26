#!/usr/bin/env node
// Actual PlcGraMsgBox, GamDelay and report lifecycle; LCD, resource and message
// delivery boundaries are controlled fixtures. No browser, game or user save.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test,{after} from 'node:test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=join(root,'vendor/iBaye/src');
const read=file=>readFileSync(file==='PublicFun.c'&&process.env.BAYE_GRAPHIC_MESSAGE_SOURCE||join(native,file),'utf8').replace(/\r\n/g,'\n');
function actual(file,name){const source=read(file),match=new RegExp('^(?:static\\s+)?(?:inline\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b'+name+'\\([^;]*?\\)\\s*\\{','m').exec(source);assert.ok(match,`actual ${file}::${name}`);const end=source.indexOf('\n}',match.index);assert.ok(end>match.index);return source.slice(match.index,end+2);}
const header=read('hd-bridge.h'),bridge=read('hd-bridge.c');
const constants=[header,read('baye/comm.h'),read('baye/consdef.h')].join('\n').split('\n').filter(line=>/^#define\s+(?:BAYE_HD_BATTLE_NOTE_VERSION|BAYE_HD_BATTLE_NOTE_TEXT_MAX|BAYE_HD_REPORT_MAX|BAYE_HD_REPORT_NONE|BAYE_HD_REPORT_MSGBOX|BAYE_HD_REPORT_GREPORT|VM_CHAR_ASC|VM_CHAR_FUN|VM_TIMER|VM_TOUCH|VT_TOUCH_DOWN|VT_TOUCH_UP|VT_TOUCH_MOVE|VT_TOUCH_CANCEL|VK_ENTER|VK_EXIT|MSGBOX_PIC|TIMER_DLY)\b/.test(line)).join('\n');
const picture=read('baye/graph.h').match(/typedef struct PictureHead\s*\{[^}]*\}\s*PictureHeadType;/)[0];
const reportGlobals=bridge.slice(bridge.indexOf('U8 g_hdReportGbk['),bridge.indexOf('U8 g_hdRecordActive ='));
const noteGlobals=bridge.slice(bridge.indexOf('U8 g_hdBattleNoteProtocolVersion ='),bridge.indexOf('U16 g_hdMenuIds['));
const helpers=['copy_gbk','hd_next_input_seq','hd_battle_note_notify','baye_hd_battle_note_retire','baye_hd_set_report','baye_hd_report_begin','baye_hd_report_end'].map(name=>actual('hd-bridge.c',name));
const funcs=[actual('baye/comm.h','GamMsgIsTimer0'),...helpers,actual('comIn.c','GamDelay'),actual('PublicFun.c','PlcGraMsgBox'),actual('Fight.c','FgtShowGetExp')];
const fixture=String.raw`
#define _CRT_SECURE_NO_WARNINGS
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;typedef int BOOL;
typedef struct {U8 type;U16 param;} GMType;
#define FAR
#define WK_SX 12
#define WK_EX 171
#define WK_SY 4
#define WK_EY 99
#define HZ_HGT 16
#define AX_SCALE 2
#define gam_strlen(text) strlen((const char*)(text))
#define gam_strcat(dst,src) strcat((char*)(dst),(const char*)(src))
#define dFgtGetExp 4
`+constants+'\n#pragma pack(push,1)\n'+picture+'\n#pragma pack(pop)\n'+reportGlobals+'\n'+noteGlobals+String.raw`
static U32 g_hdDetailGeneration=7;
static struct {U16 mp,xp;U32 rng;} world={99,77,0xabcdef01},worldBefore;
static U8 resourceBuffer[256],*g_CBnkPtr=resourceBuffer;
static PictureHeadType head={120,64,1,0};
static GMType messages[26020];static int messageCount,messageIndex,scenario;
static int scroll=9,timer=7,scrollCount,scrollValues[8],openCount,openValues[8],closeCount,getTimerCount;
static int loads,draws,texts,textX,textY,drawX,drawY,resourceCalls;
static U8 displayed[2048],expected[2048],caller[2048];
static int notifications,notifyActive[16],notifyInput[16],nativeOrder[16],orderCount,retireCalls;
static int nestedLevel,nestedTriggered,mutateCaller;
static void notify(void){assert(texts);if((scenario==5||scenario==6)&&notifications==4){assert(hdReportDepth==1);assert(!strcmp((char*)g_hdReportGbk,scenario==5?"OUTER":"EXTERNAL"));}else assert(!strcmp((char*)displayed,(char*)g_hdReportGbk));assert(g_hdReportKind==BAYE_HD_REPORT_MSGBOX||g_hdReportKind==BAYE_HD_REPORT_GREPORT);notifyActive[notifications]=g_hdReportActive;notifyInput[notifications]=(int)g_hdReportInputSeq;notifications++;assert(notifications<16);}
#define EM_ASM(...) notify()
static void baye_hd_city_info_retire(void){retireCalls++;}
static void baye_hd_attack_retire(void){retireCalls++;}
static void baye_hd_skill_retire(void){retireCalls++;}
static void baye_hd_view_retire(void){retireCalls++;}
static void baye_hd_mini_map_retire(void){retireCalls++;}
static void hd_menu_ids_clear(void){retireCalls++;}
static void hd_help_detail_clear(void){retireCalls++;}
static void hd_ai_retire(void){retireCalls++;}
static void hd_status_retire(void){retireCalls++;}
static U8* ResLoadToCon(U16 resource,U16 index,U8*buffer){assert(resource==MSGBOX_PIC&&index==1&&buffer==g_CBnkPtr);loads++;nativeOrder[orderCount++]=1;return(U8*)&head;}
static void gam_drawpic(U16 resource,U16 index,int x,int y,U8 flag){assert(resource==MSGBOX_PIC&&index==0&&flag==1);draws++;drawX=x;drawY=y;nativeOrder[orderCount++]=2;}
static void GamStrShowS(int x,int y,U8*text){texts++;textX=x;textY=y;strcpy((char*)displayed,(char*)text);nativeOrder[orderCount++]=3;}
static int SysScrollingTimerOpen(int value){assert(scrollCount<8);scrollValues[scrollCount++]=value;int old=scroll;scroll=value;return old;}
static U8 SysGetTimer1Number(void){getTimerCount++;return(U8)timer;}
static void SysTimer1Close(void){closeCount++;timer=0;}
static void SysTimer1Open(U8 value){assert(openCount<8);openValues[openCount++]=value;timer=value;}
static void GamGetMsg(GMType*message);
static void FgtLoadToMem(U16 resource,U8*out){assert(resource==dFgtGetExp);resourceCalls++;strcpy((char*)out,"EXP+");}
static void gam_itoa(U32 value,U8*out,int base){assert(base==10);sprintf((char*)out,"%u",value);}
`+funcs.map(body=>body.slice(0,body.indexOf('{')).trim()+';').join('\n')+'\n'+funcs.join('\n')+String.raw`
static void add(U8 type,U16 param){assert(messageCount<(int)(sizeof(messages)/sizeof(messages[0])));messages[messageCount++]=(GMType){type,param};}
static void ticks(int count){for(int i=0;i<count;i++)add(VM_TIMER,1);}
static void GamGetMsg(GMType*message){
    assert(g_hdReportActive==1&&g_hdReportKind==BAYE_HD_REPORT_MSGBOX);
    assert(g_hdReportInputSeq&&g_hdReportSeq&&g_hdReportPerson==0xffff);
    assert(!strcmp((char*)g_hdReportGbk,nestedLevel?"INNER":(char*)expected));
    if(scenario==5&&!nestedTriggered){
        U32 before=g_hdReportInputSeq;nestedTriggered=1;nestedLevel=1;
        U8 inner[]="INNER";PlcGraMsgBox(inner,1,0);nestedLevel=0;
        assert(g_hdReportActive==1&&hdReportDepth==1&&g_hdReportInputSeq!=before);
        assert(!strcmp((char*)g_hdReportGbk,(char*)expected));
        assert(!strcmp((char*)displayed,"INNER")); /* report restore adds no native redraw */
    }
    if(mutateCaller){caller[0]='!';assert(!strcmp((char*)g_hdReportGbk,(char*)expected));}
    assert(messageIndex<messageCount);*message=messages[messageIndex++];
}
static void reset(const char*text){
    loads=draws=texts=textX=textY=drawX=drawY=resourceCalls=0;
    notifications=messageCount=messageIndex=orderCount=retireCalls=0;
    scrollCount=openCount=closeCount=getTimerCount=0;scroll=9;timer=7;
    nestedLevel=nestedTriggered=mutateCaller=0;hdReportDepth=0;
    g_hdReportSeq=0;g_hdReportInputSeq=0;g_hdReportActive=0;g_hdReportKind=0;
    g_hdReportPerson=0xffff;memset(g_hdReportGbk,0,sizeof(g_hdReportGbk));
    strcpy((char*)caller,text);strcpy((char*)expected,text);displayed[0]=0;worldBefore=world;
}
static void finished(int consumed,int line,int initialTimer){
    assert(messageIndex==consumed&&loads==1&&draws==1&&texts==1);
    assert(orderCount==3&&nativeOrder[0]==1&&nativeOrder[1]==2&&nativeOrder[2]==3);
    assert(drawX==(WK_EX-WK_SX-120/AX_SCALE)/2+WK_SX);
    int expectedY=line==255?((WK_EY-WK_SY-64/AX_SCALE)>>1)+WK_SY:WK_SY+line*HZ_HGT;
    assert(drawY==expectedY&&textX==drawX+10&&textY==drawY+6);
    assert(!strcmp((char*)displayed,(char*)expected));
    assert(g_hdReportActive==0&&hdReportDepth==0&&g_hdReportInputSeq);
    assert(scroll==9&&scrollCount==2&&scrollValues[0]==0&&scrollValues[1]==9);
    assert(getTimerCount==1);if(initialTimer){assert(timer==initialTimer&&openValues[openCount-1]==initialTimer);}
    assert(!memcmp(&world,&worldBefore,sizeof(world)));
}
int main(int argc,char**argv){assert(argc==2);scenario=atoi(argv[1]);
    if(scenario==0){
        const int lines[]={0,2,255};for(int i=0;i<3;i++){
            reset("GRAPHIC MESSAGE");ticks(100);add(VM_CHAR_FUN,VK_ENTER);PlcGraMsgBox(caller,1,(U8)lines[i]);finished(100,lines[i],7);
            assert(notifications==2&&notifyActive[0]==0&&notifyActive[1]==1&&notifyInput[1]==1);
            assert(openCount==2&&openValues[0]==TIMER_DLY&&closeCount==2&&g_hdReportInputSeq==2);
        }
    }else if(scenario==1){
        reset("FUNCTION KEY");add(VM_TIMER,0);add(VM_CHAR_ASC,65);add(VM_TOUCH,VT_TOUCH_DOWN);add(VM_TOUCH,VT_TOUCH_MOVE);add(VM_TOUCH,VT_TOUCH_CANCEL);add(VM_CHAR_FUN,VK_ENTER);add(VM_CHAR_FUN,VK_EXIT);
        PlcGraMsgBox(caller,1,255);finished(6,255,7);assert(notifications==2);
    }else if(scenario==2){
        reset("TOUCH UP");add(VM_TIMER,0);ticks(3);add(VM_TOUCH,VT_TOUCH_DOWN);add(VM_TOUCH,VT_TOUCH_UP);add(VM_CHAR_FUN,VK_ENTER);
        PlcGraMsgBox(caller,1,0);finished(6,0,7);assert(notifications==2);
    }else if(scenario==3){
        const U8 types[]={VM_CHAR_FUN,VM_CHAR_ASC,VM_TOUCH};const U16 values[]={VK_EXIT,65,VT_TOUCH_DOWN};
        for(int i=0;i<3;i++){reset("ZERO WAIT");add(VM_TIMER,0);ticks(3);add(types[i],values[i]);add(VM_CHAR_FUN,VK_ENTER);
            PlcGraMsgBox(caller,0,255);finished(5,255,7);assert(notifications==2&&openCount==1&&openValues[0]==7&&closeCount==2);
        }
    }else if(scenario==4){
        reset("MAXIMUM DELAY");add(VM_TIMER,0);ticks(25500);add(VM_CHAR_FUN,VK_ENTER);
        PlcGraMsgBox(caller,255,255);finished(25501,255,7);assert(notifications==2);
    }else if(scenario==5){
        reset("OUTER");add(VM_TIMER,0);add(VM_TOUCH,VT_TOUCH_DOWN);add(VM_CHAR_FUN,VK_ENTER);add(VM_CHAR_FUN,VK_EXIT);
        PlcGraMsgBox(caller,0,255);assert(messageIndex==4&&loads==2&&draws==2&&texts==2);
        assert(g_hdReportActive==0&&hdReportDepth==0&&g_hdReportInputSeq==4&&g_hdReportSeq==3);
        assert(notifications==5&&notifyActive[0]==0&&notifyActive[1]==1&&notifyActive[2]==1&&notifyActive[3]==1&&notifyActive[4]==1);
        assert(scroll==9&&timer==7&&!memcmp(&world,&worldBefore,sizeof(world)));
    }else if(scenario==6){
        reset("INNER");strcpy((char*)displayed,"EXTERNAL");texts=1;
        baye_hd_set_report((U8*)"EXTERNAL",7,BAYE_HD_REPORT_GREPORT);baye_hd_report_begin(BAYE_HD_REPORT_GREPORT);
        U32 token=g_hdReportInputSeq;add(VM_CHAR_FUN,VK_ENTER);PlcGraMsgBox(caller,0,0);
        assert(messageIndex==1&&g_hdReportActive==1&&hdReportDepth==1&&g_hdReportKind==BAYE_HD_REPORT_GREPORT&&g_hdReportPerson==7);
        assert(!strcmp((char*)g_hdReportGbk,"EXTERNAL")&&g_hdReportInputSeq!=token);baye_hd_report_end();
        assert(!g_hdReportActive&&!hdReportDepth&&!memcmp(&world,&worldBefore,sizeof(world)));
    }else if(scenario==7){
        reset("NO TIMER BEFORE");timer=0;ticks(100);PlcGraMsgBox(caller,1,255);finished(100,255,0);
        assert(timer==TIMER_DLY&&openCount==1&&closeCount==1);
        reset("NO TIMER ZERO WAIT");timer=0;add(VM_TOUCH,VT_TOUCH_MOVE);PlcGraMsgBox(caller,0,255);finished(1,255,0);
        assert(timer==0&&!openCount&&closeCount==1);
    }else if(scenario==8){
        const U8 exps[]={17,255};for(int i=0;i<2;i++){
            char text[20];sprintf(text,"EXP+%u",exps[i]);reset(text);ticks(100);FgtShowGetExp(exps[i]);finished(100,255,7);
            assert(resourceCalls==1&&notifications==2&&g_hdReportSeq==1);
        }
    }else if(scenario==9){
        const char bytes[]={(char)0xbe,(char)0xad,(char)0xd1,(char)0xe9,'+', '1','7',0};
        reset(bytes);mutateCaller=1;g_hdReportSeq=0xffff;g_hdReportInputSeq=0xffffffffu;add(VM_CHAR_FUN,VK_ENTER);
        PlcGraMsgBox(caller,0,255);finished(1,255,7);assert(caller[0]=='!'&&g_hdReportSeq==1&&g_hdReportInputSeq==2&&notifications==2);
        assert(!memcmp(g_hdReportGbk,bytes,sizeof(bytes)));
    }else assert(!"unknown fixture");
    puts("actual graphic-message fixture passed");return 0;
}
`;
const run=promisify(execFile);let temporary,executable;
const compiled=(async()=>{
    temporary=mkdtempSync(join(tmpdir(),'baye-hd-graphic-message-'));
    const file=join(temporary,'graphic.c');executable=join(temporary,process.platform==='win32'?'graphic.exe':'graphic');writeFileSync(file,fixture);
    try{await run(process.env.CC||'cc',['-std=c99','-Wall','-Wextra',file,'-o',executable],{timeout:20000,windowsHide:true});}
    catch(error){throw Error('Actual graphic-message fixture compilation failed: '+(error.stderr||error.message));}
})();
after(async()=>{await compiled.catch(()=>{});if(temporary){assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-graphic-message-'));rmSync(temporary,{recursive:true,force:true});}});
const cases=[
    'actual graphical message publishes after its original draw and preserves top, fixed-line and centered geometry',
    'finite graphic waits ignore timer0, ASCII and incomplete touch events until the real function key',
    'actual TOUCH_UP can end the timed original wait without requiring another confirmation',
    'delay zero stays an indefinite wait and keeps its original any-nontimer termination semantics',
    'delay 255 retains all 25500 timer1 ticks and never consumes the next scene key',
    'nested actual graphical messages restore the outer report with a new input token',
    'a graphical message nested in a different actual report restores its text, person and kind',
    'original timer and scrolling restoration quirks are retained with or without a prior timer',
    'actual experience caller reaches real PlcGraMsgBox with the original earned-value text',
    'published GBK is copied, wrap skips zero, and rendering does not mutate MP, experience or RNG'
];
for(const [index,name]of cases.entries())test(name,async()=>{await compiled;const result=await run(executable,[String(index)],{timeout:20000,windowsHide:true});assert.match(result.stdout,/actual graphic-message fixture passed/);});
