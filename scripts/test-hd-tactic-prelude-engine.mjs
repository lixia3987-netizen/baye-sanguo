#!/usr/bin/env node
// Actual ShowTacticNote, GamDelay and note observers. ROM, LCD and message
// delivery are boundaries; no game, saved world, AI execution or browser.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test,{after} from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=join(root,'vendor/iBaye/src');
const read=file=>readFileSync(file==='tactic.c'&&process.env.BAYE_TACTIC_PRELUDE_SOURCE||join(native,file),'utf8').replace(/\r\n/g,'\n');
function actual(file,name){const text=read(file),m=new RegExp('^(?:static\\s+)?(?:inline\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b'+name+'\\([^;]*?\\)\\s*\\{','m').exec(text);assert.ok(m,`actual ${file}::${name}`);const end=text.indexOf('\n}',m.index);assert.ok(end>m.index);return text.slice(m.index,end+2);}
const bridge=read('hd-bridge.c'),globals=bridge.slice(bridge.indexOf('U8 g_hdBattleNoteProtocolVersion ='),bridge.indexOf('U16 g_hdMenuIds['));
const constants=[read('hd-bridge.h'),read('baye/comm.h'),read('baye/consdef.h'),read('baye/sconst.h')].join('\n').split('\n').filter(line=>/^#define\s+(?:BAYE_HD_BATTLE_NOTE_VERSION|BAYE_HD_BATTLE_NOTE_TEXT_MAX|VM_CHAR_ASC|VM_CHAR_FUN|VM_TIMER|VM_TOUCH|VT_TOUCH_DOWN|VT_TOUCH_UP|VT_TOUCH_MOVE|VK_ENTER|VK_EXIT|TIMER_DLY|STRING_CONST|TACTIC_STR)\b/.test(line)).join('\n');
const funcs=[actual('baye/comm.h','GamMsgIsTimer0'),...['copy_gbk','hd_next_input_seq','hd_battle_note_notify','baye_hd_battle_note_retire','baye_hd_battle_note_begin','baye_hd_battle_note_end'].map(name=>actual('hd-bridge.c',name)),actual('comIn.c','GamDelay'),actual('tactic.c','ShowTacticNote')];
const fixture=String.raw`
#define _CRT_SECURE_NO_WARNINGS
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;typedef U16 PersonID;typedef int BOOL;
typedef struct {U8 type;U16 param;} GMType;
#define FAR
#define PERSON_MAX 600
#define WK_SX 12
#define WK_EX 171
#define WK_SY 4
#define WK_EY 99
#define ASC_WID 4
#define ASC_HGT 6
#define gam_strlen(text) strlen((const char*)(text))
#define gam_strcat(dst,src) strcat((char*)(dst),(const char*)(src))
`+constants+'\n'+globals+String.raw`
static U32 g_hdDetailGeneration=7;
static PersonID g_PlayerKing=5,share[256],queue[256];
#define SHARE_MEM share
static U32 queueCount;
static U8 drawn[512],world[128],beforeWorld[128];
static int mapClears,enemyCalls,nameCalls,resCalls,clears,rects,draws,countCalls,notifications,preludes;
static int names[256],trace[4096],traceCount;
static int scroll=9,timer=7,scrollCalls,timerOpens,timerCloses,frameTicks,totalTicks;
static GMType messages[4096];static int messageCount,messageIndex;
static int mutateAt,mutationDone,allowInactive,replaceInWait,replaceInNotify,replacementDone,direct;
static U32 replacementSeq;
U32 baye_hd_battle_note_begin(U8 kind,U16 winner,const U8*text);
void baye_hd_battle_note_retire(void);
static void replacement(int newWorld){
    replacementDone=1;allowInactive=1;
    if(newWorld){g_hdDetailGeneration++;baye_hd_battle_note_retire();}
    replacementSeq=baye_hd_battle_note_begin(4,65535,(U8*)"REPLACEMENT");assert(replacementSeq);
}
static void notify(void){
    notifications++;
    assert(!memcmp(world,beforeWorld,sizeof(world)));
    if(g_hdBattleNoteActive){
        assert(g_hdBattleNoteGeneration==g_hdDetailGeneration&&g_hdBattleNoteSeq);
        if(g_hdBattleNoteOutcome==5){preludes++;if(!direct){assert(draws>0&&clears==draws&&rects==draws);assert(!strcmp((char*)g_hdBattleNoteText,(char*)drawn));}assert(g_hdBattleNoteWinner==65535);}
        else if(!direct)assert(replacementDone&&!strcmp((char*)g_hdBattleNoteText,"REPLACEMENT"));
        if(replaceInNotify&&!replacementDone)replacement(replaceInNotify==2);
    }else assert(g_hdBattleNoteOutcome==0&&g_hdBattleNoteWinner==65535&&!g_hdBattleNoteText[0]);
}
#define EM_ASM(...) notify()
static U32 GamGetPersonCount(void){countCalls++;return PERSON_MAX;}
`+funcs.map(body=>body.slice(0,body.indexOf('{')).trim()+';').join('\n')+String.raw`
static void mutate(int step){if(step==mutateAt&&!mutationDone){mutationDone=1;replacement(1);}}
static void ShowMapClear(void){
    mapClears++;trace[traceCount++]=mapClears==1?1:9;
    if(mapClears==1)mutate(1);else if(draws)assert(frameTicks==5);
}
static U32 GetEnemyKing(PersonID king,PersonID*out){
    assert(king==g_PlayerKing&&out==share&&mapClears==1);enemyCalls++;trace[traceCount++]=2;
    memcpy(out,queue,queueCount*sizeof(PersonID));mutate(2);return queueCount;
}
static void GetPersonName(PersonID id,U8*out){
    if(nameCalls)assert(frameTicks==5);frameTicks=0;
    names[nameCalls++]=id;trace[traceCount++]=10+id;sprintf((char*)out,"P%u",id);mutate(3);
}
static void ResLoadToMem(U8 resource,U8 id,U8*out){
    assert(resource==STRING_CONST&&id==TACTIC_STR);resCalls++;trace[traceCount++]=3;strcpy((char*)out," strategy prelude");mutate(4);
}
static void gam_clrlcd(U16 x1,U16 y1,U16 x2,U16 y2){assert(x1==51&&y1==89&&x2==131&&y2==97);clears++;trace[traceCount++]=4;mutate(5);}
static void gam_rect(U16 x1,U16 y1,U16 x2,U16 y2){assert(x1==51&&y1==89&&x2==131&&y2==97);rects++;trace[traceCount++]=5;mutate(6);}
static void GamStrShowS(U16 x,U16 y,U8*text){assert(x==53&&y==91);draws++;trace[traceCount++]=6;strcpy((char*)drawn,(char*)text);mutate(7);}
static int SysScrollingTimerOpen(int value){scrollCalls++;int previous=scroll;scroll=value;return previous;}
static U8 SysGetTimer1Number(void){return(U8)timer;}
static void SysTimer1Close(void){timerCloses++;timer=0;}
static void SysTimer1Open(U8 value){timerOpens++;timer=value;}
static void GamGetMsg(GMType*message){
    if(!allowInactive){assert(g_hdBattleNoteActive&&g_hdBattleNoteOutcome==5&&g_hdBattleNoteWinner==65535);assert(!strcmp((char*)g_hdBattleNoteText,(char*)drawn));}
    if(replaceInWait&&!replacementDone)replacement(replaceInWait==2);
    if(allowInactive&&replacementDone)assert(g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&g_hdBattleNoteOutcome==4);
    assert(messageIndex<messageCount);*message=messages[messageIndex++];
    if(message->type==VM_TIMER&&message->param==1){frameTicks++;totalTicks++;}
}
`+funcs.join('\n')+String.raw`
static void add(U8 type,U16 value){assert(messageCount<4096);messages[messageCount++]=(GMType){type,value};}
static void ticks(int count){for(int i=0;i<count;i++)add(VM_TIMER,1);}
static void reset(const PersonID*ids,U32 length){
    g_hdDetailGeneration=7;g_hdBattleNoteActive=0;g_hdBattleNoteOutcome=0;g_hdBattleNoteWinner=65535;g_hdBattleNoteSeq=1;g_hdBattleNoteGeneration=7;g_hdBattleNoteText[0]=0;
    queueCount=length;if(length)memcpy(queue,ids,length*sizeof(PersonID));memset(share,0,sizeof(share));
    mapClears=enemyCalls=nameCalls=resCalls=clears=rects=draws=countCalls=notifications=preludes=traceCount=0;
    scroll=9;timer=7;scrollCalls=timerOpens=timerCloses=frameTicks=totalTicks=messageCount=messageIndex=0;
    mutateAt=mutationDone=allowInactive=replaceInWait=replaceInNotify=replacementDone=direct=0;replacementSeq=0;
    memset(world,0x63,sizeof(world));memcpy(beforeWorld,world,sizeof(world));drawn[0]=0;
}
static void exactCalls(U32 count){
    assert(mapClears==2&&enemyCalls==1&&nameCalls==(int)count&&resCalls==(int)count&&clears==(int)count&&rects==(int)count&&draws==(int)count);
    for(U32 i=0;i<count;i++)assert(names[i]==queue[i]);
    assert(!countCalls&&totalTicks==(int)count*5&&scroll==9&&timer==7&&scrollCalls==(int)count*2&&timerOpens==(int)count*2&&timerCloses==(int)count*2);
    assert(!memcmp(world,beforeWorld,sizeof(world)));
}
int main(int argc,char**argv){
    assert(argc==2);int scenario=atoi(argv[1]);const PersonID one[]={0},many[]={0,511,0,199};
    if(scenario==0){
        reset(NULL,0);ShowTacticNote();exactCalls(0);assert(traceCount==3&&trace[0]==1&&trace[1]==2&&trace[2]==9&&!notifications&&!messageIndex&&!g_hdBattleNoteActive);
    }else if(scenario==1){
        reset(one,1);ticks(5);add(VM_CHAR_FUN,VK_EXIT);ShowTacticNote();exactCalls(1);
        const int expected[]={1,2,10,3,4,5,6,9};assert(traceCount==8&&!memcmp(trace,expected,sizeof(expected)));
        assert(messageIndex==5&&messages[messageIndex].param==VK_EXIT&&preludes==1&&notifications==2&&!g_hdBattleNoteActive);
    }else if(scenario==2){
        reset(many,4);ticks(20);ShowTacticNote();exactCalls(4);assert(preludes==4&&notifications==8&&messageIndex==20&&!g_hdBattleNoteActive);
        assert(traceCount==23);for(int i=0;i<4;i++){int at=2+i*5;assert(trace[at]==10+many[i]&&trace[at+1]==3&&trace[at+2]==4&&trace[at+3]==5&&trace[at+4]==6);}assert(trace[22]==9);
    }else if(scenario==3){
        reset(one,1);add(VM_TIMER,0);add(VM_CHAR_FUN,VK_ENTER);add(VM_CHAR_ASC,'x');add(VM_TOUCH,VT_TOUCH_DOWN);add(VM_TOUCH,VT_TOUCH_UP);add(VM_TOUCH,VT_TOUCH_MOVE);ticks(5);add(VM_CHAR_FUN,VK_EXIT);
        ShowTacticNote();exactCalls(1);assert(messageIndex==11&&messages[messageIndex].param==VK_EXIT&&preludes==1&&!g_hdBattleNoteActive);
    }else if(scenario==4){
        for(int step=1;step<=7;step++){reset(many,4);mutateAt=step;allowInactive=1;ticks(20);ShowTacticNote();exactCalls(4);
            assert(mutationDone&&g_hdDetailGeneration==8&&preludes==0&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq);
            assert(!strcmp((char*)g_hdBattleNoteText,"REPLACEMENT"));baye_hd_battle_note_end(8,replacementSeq);assert(!g_hdBattleNoteActive);}
    }else if(scenario==5){
        reset(many,4);replaceInWait=2;ticks(20);ShowTacticNote();exactCalls(4);
        assert(preludes==1&&g_hdDetailGeneration==8&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq);baye_hd_battle_note_end(8,replacementSeq);assert(!g_hdBattleNoteActive);
    }else if(scenario==6){
        for(int mode=1;mode<=2;mode++){reset(one,1);replaceInWait=mode;ticks(5);ShowTacticNote();exactCalls(1);
            assert(preludes==1&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq);baye_hd_battle_note_end(g_hdDetailGeneration,replacementSeq);assert(!g_hdBattleNoteActive);}
    }else if(scenario==7){
        for(int mode=1;mode<=2;mode++){reset(mode==1?one:many,mode==1?1:4);replaceInNotify=mode;ticks(mode==1?5:20);ShowTacticNote();exactCalls(mode==1?1:4);
            assert(preludes==1&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq);baye_hd_battle_note_end(g_hdDetailGeneration,replacementSeq);assert(!g_hdBattleNoteActive);}
    }else if(scenario==8){
        reset(NULL,0);direct=1;U8 text[]={0xd6,0xd0,0xce,0xc4,0};g_hdBattleNoteSeq=0xffffffff;U32 token=baye_hd_battle_note_begin(5,65535,text);assert(token==1&&!countCalls);text[0]=0;
        const U8 expected[]={0xd6,0xd0,0xce,0xc4,0};assert(!memcmp(g_hdBattleNoteText,expected,sizeof(expected)));
        baye_hd_battle_note_end(6,token);baye_hd_battle_note_end(7,token+1);assert(g_hdBattleNoteActive);baye_hd_battle_note_end(7,token);assert(!g_hdBattleNoteActive);
        assert(!baye_hd_battle_note_begin(5,0,(U8*)"bad winner"));assert(!baye_hd_battle_note_begin(5,65535,NULL));assert(!baye_hd_battle_note_begin(5,65535,(U8*)""));assert(!baye_hd_battle_note_begin(6,65535,(U8*)"unknown"));
        for(U8 kind=1;kind<=5;kind++){int before=countCalls;U32 q=baye_hd_battle_note_begin(kind,kind==1?511:65535,(U8*)"LEGACY");assert(q&&countCalls-before==(kind<=2?1:0));baye_hd_battle_note_end(7,q);}assert(!memcmp(world,beforeWorld,sizeof(world)));
    }else assert(!"unknown scenario");
    puts("actual tactic-prelude fixture passed");return 0;
}
`;
const run=promisify(execFile);let temporary,executable;
const compiled=(async()=>{temporary=mkdtempSync(join(tmpdir(),'baye-hd-tactic-prelude-'));const path=join(temporary,'prelude.c');executable=join(temporary,process.platform==='win32'?'prelude.exe':'prelude');writeFileSync(path,fixture);try{await run(process.env.CC||'cc',['-std=c99','-Wall','-Wextra',path,'-o',executable],{timeout:20000,windowsHide:true});}catch(error){throw Error('Actual tactic-prelude fixture compilation failed: '+(error.stderr||error.message));}})();
after(async()=>{await compiled.catch(()=>{});if(temporary){assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-tactic-prelude-'));rmSync(temporary,{recursive:true,force:true});}});
const cases=[
    'an empty actual enemy queue only clears the original map twice without opening a notice or delay',
    'the actual single zero-ID prelude publishes after native draw and preserves exact geometry and five timer ticks',
    'multiple native kings retain exact order, duplicate instances and complete U16 IDs without extra getters',
    'timer0, function keys, ASCII and touch cannot shorten the original five-tick passive prelude',
    'world changes in initial clear, queue, name, resource or draw callbacks retire all remaining old publications',
    'a world change during the first original delay prevents every later old queue item from publishing',
    'an old prelude end cannot retire a same-world or new-world replacement created during its wait',
    'synchronous native notification reentry retains the replacement and the publisher returns its own sequence',
    'type five requires unknown winner, copies GBK and wraps safely while legacy getter behavior stays unchanged'
];
for(const [index,name]of cases.entries())test(name,async()=>{await compiled;const r=await run(executable,[String(index)],{timeout:20000,windowsHide:true});assert.match(r.stdout,/actual tactic-prelude fixture passed/);});
test('the captured prelude is before actual AI calculation and adds no proxy calculation or month advance',()=>{
    const source=readFileSync(join(native,'tactic.c'),'utf8');assert.match(source,/ShowTacticNote\(\);\s*\/\*电脑策略\*\/\s*ComputerTactic\(\);/);
    const body=actual('tactic.c','ShowTacticNote');assert.doesNotMatch(body,/ComputerTactic|PolicyExec|ConditionUpdate|sendKey|g_(?:Year|Month)Date\s*=/);
});
