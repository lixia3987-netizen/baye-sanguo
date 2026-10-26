#!/usr/bin/env node
// Compile actual announcement renderers, note helpers and GamDelay. Resource,
// LCD and message-delivery boundaries are controlled; no game or saved world.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test,{after} from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=join(root,'vendor/iBaye/src');
const read=file=>readFileSync(file==='citycmde.c'&&process.env.BAYE_BATTLE_ANNOUNCEMENTS_SOURCE||join(native,file),'utf8').replace(/\r\n/g,'\n');
function actual(file,name){const source=read(file),match=new RegExp('^(?:static\\s+)?(?:inline\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b'+name+'\\([^;]*?\\)\\s*\\{','m').exec(source);assert.ok(match,`actual ${file}::${name}`);const end=source.indexOf('\n}',match.index);assert.ok(end>match.index);return source.slice(match.index,end+2);}
const bridge=read('hd-bridge.c'),globals=bridge.slice(bridge.indexOf('U8 g_hdBattleNoteProtocolVersion ='),bridge.indexOf('U16 g_hdMenuIds['));
const constants=[read('hd-bridge.h'),read('baye/comm.h'),read('baye/consdef.h')].join('\n').split('\n').filter(line=>/^#define\s+(?:BAYE_HD_BATTLE_NOTE_VERSION|BAYE_HD_BATTLE_NOTE_TEXT_MAX|VM_CHAR_ASC|VM_CHAR_FUN|VM_TIMER|VM_TOUCH|VT_TOUCH_DOWN|VT_TOUCH_UP|VT_TOUCH_MOVE|VK_ENTER|VK_EXIT|TIMER_DLY)\b/.test(line)).join('\n');
const helpers=['copy_gbk','hd_next_input_seq','hd_battle_note_notify','baye_hd_battle_note_retire','baye_hd_battle_note_begin','baye_hd_battle_note_end'].map(name=>actual('hd-bridge.c',name));
const functions=[actual('baye/comm.h','GamMsgIsTimer0'),...helpers,actual('comIn.c','GamDelay'),...['ShowAttackNote','ShowFightNote','ShowFightWinNote','ShowFightLossNote'].map(name=>actual('citycmde.c',name))];
const fixture=String.raw`
#define _CRT_SECURE_NO_WARNINGS
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;typedef U16 PersonID;typedef U8 SBUF[512];typedef int BOOL;
typedef struct {U8 type;U16 param;} GMType;
#define FAR
#define PERSON_MAX 600
#define WK_SX 12
#define WK_EX 171
#define WK_SY 4
#define WK_EY 99
#define STRING_CONST 1
#define STR_OURS 1
#define STR_ATTACKC 2
#define STR_FIGHT_NOTE1 3
#define STR_FIGHT_NOTE2 4
#define STR_WON 5
#define STR_LOST 6
#define gam_strlen(text) strlen((const char*)(text))
#define gam_strcat(dst,src) strcat((char*)(dst),(const char*)(src))
`+constants+'\n'+globals+String.raw`
static U32 g_hdDetailGeneration=7;
static PersonID g_PlayerKing=5;
static struct {U8 responseNoteOfBettle;} g_engineConfig;
static U8 drawn[512],expectedText[512],world[128],beforeWorld[128];
static U8 expectedKind,expectedFace;
static U16 expectedWinner;
static int faces,personCalls,cityCalls,resourceCalls,draws,countCalls,notifications,activeNotifications;
static int xPosition,yPosition,trace[32],traceCount;
static int scroll=9,timer=7,scrollCalls,timerOpens,timerCloses;
static GMType messages[640];static int messageCount,messageIndex;
static int mutateAt,mutationTriggered,allowInactive,replaceDuringWait,replacementTriggered;
static int replaceDuringNotify,notifyReplacementTriggered;
static U32 replacementSeq;
U32 baye_hd_battle_note_begin(U8 outcome,U16 winner,const U8*text);
void baye_hd_battle_note_retire(void);
static void notify(void){
    notifications++;
    if(g_hdBattleNoteActive){
        activeNotifications++;
        assert(g_hdBattleNoteGeneration==g_hdDetailGeneration&&g_hdBattleNoteSeq);
        if(!strcmp((char*)g_hdBattleNoteText,"REPLACEMENT"))assert(mutationTriggered||replacementTriggered);
        else {assert(draws==1);assert(g_hdBattleNoteOutcome==expectedKind&&g_hdBattleNoteWinner==expectedWinner);assert(!strcmp((char*)g_hdBattleNoteText,(char*)drawn));}
    }else assert(g_hdBattleNoteOutcome==0&&g_hdBattleNoteWinner==65535&&!g_hdBattleNoteText[0]);
    assert(!memcmp(world,beforeWorld,sizeof(world)));
    if(g_hdBattleNoteActive&&replaceDuringNotify&&!notifyReplacementTriggered){
        notifyReplacementTriggered=1;replacementTriggered=1;allowInactive=1;
        if(replaceDuringNotify==2){g_hdDetailGeneration++;baye_hd_battle_note_retire();}
        replacementSeq=baye_hd_battle_note_begin(4,65535,(U8*)"REPLACEMENT");assert(replacementSeq);
    }
}
#define EM_ASM(...) notify()
static U32 GamGetPersonCount(void){countCalls++;return PERSON_MAX;}
`+functions.map(body=>body.slice(0,body.indexOf('{')).trim()+';').join('\n')+String.raw`
static void mutate(int step){
    if(step!=mutateAt||mutationTriggered)return;
    mutationTriggered=1;g_hdDetailGeneration++;baye_hd_battle_note_retire();
    replacementSeq=baye_hd_battle_note_begin(4,65535,(U8*)"REPLACEMENT");assert(replacementSeq);
}
static void ShowFightNoteFace(U8 face){assert(face==expectedFace);faces++;trace[traceCount++]=10+face;mutate(1);}
static void GetPersonName(PersonID id,U8*out){personCalls++;trace[traceCount++]=20+(int)id;sprintf((char*)out,"P%u",id);mutate(2);}
static void GetCityName(U8 id,U8*out){cityCalls++;trace[traceCount++]=40+(int)id;sprintf((char*)out,"C%u",id);mutate(3);}
static void ResLoadToMem(U8 resource,U8 id,U8*out){
    assert(resource==STRING_CONST);resourceCalls++;trace[traceCount++]=100+id;
    const char*text=id==STR_OURS?"ours":id==STR_ATTACKC?" attacks ":id==STR_FIGHT_NOTE1?" confronts ":id==STR_FIGHT_NOTE2?" !":id==STR_WON?" won":" lost";
    strcpy((char*)out,text);
}
static void PlcMidShowStr(U16 x,U16 y,U8*text){
    assert(faces==1);draws++;trace[traceCount++]=200;xPosition=x;yPosition=y;strcpy((char*)drawn,(char*)text);mutate(4);
}
static int SysScrollingTimerOpen(int value){scrollCalls++;int previous=scroll;scroll=value;return previous;}
static U8 SysGetTimer1Number(void){return(U8)timer;}
static void SysTimer1Close(void){timerCloses++;timer=0;}
static void SysTimer1Open(U8 value){timerOpens++;timer=value;}
static void GamGetMsg(GMType*message){
    if(!allowInactive){assert(g_hdBattleNoteActive);assert(g_hdBattleNoteOutcome==expectedKind&&g_hdBattleNoteWinner==expectedWinner);assert(!strcmp((char*)g_hdBattleNoteText,(char*)expectedText));}
    if(replaceDuringWait&&!replacementTriggered){
        replacementTriggered=1;if(replaceDuringWait==2){g_hdDetailGeneration++;baye_hd_battle_note_retire();}
        replacementSeq=baye_hd_battle_note_begin(4,65535,(U8*)"REPLACEMENT");assert(replacementSeq);
        allowInactive=1;
    }
    assert(messageIndex<messageCount);*message=messages[messageIndex++];
}
`+functions.join('\n')+String.raw`
static void add(U8 type,U16 value){assert(messageCount<640);messages[messageCount++]=(GMType){type,value};}
static void ticks(int count){for(int i=0;i<count;i++)add(VM_TIMER,1);}
static void reset(U8 kind,U8 face,const char*text){
    g_hdDetailGeneration=7;g_hdBattleNoteActive=0;g_hdBattleNoteOutcome=0;g_hdBattleNoteWinner=65535;g_hdBattleNoteSeq=1;g_hdBattleNoteGeneration=7;g_hdBattleNoteText[0]=0;
    g_PlayerKing=5;g_engineConfig.responseNoteOfBettle=0;expectedKind=kind;expectedFace=face;expectedWinner=65535;
    strcpy((char*)expectedText,text);drawn[0]=0;faces=personCalls=cityCalls=resourceCalls=draws=countCalls=notifications=activeNotifications=0;
    traceCount=messageCount=messageIndex=scrollCalls=timerOpens=timerCloses=0;scroll=9;timer=7;
    mutateAt=mutationTriggered=allowInactive=replaceDuringWait=replacementTriggered=replaceDuringNotify=notifyReplacementTriggered=0;replacementSeq=0;
    memset(world,0x63,sizeof(world));memcpy(beforeWorld,world,sizeof(world));
}
static void finished(int consumed){
    assert(messageIndex==consumed&&faces==1&&draws==1);
    assert(xPosition==91&&yPosition==77);assert(!strcmp((char*)drawn,(char*)expectedText));
    assert(!g_hdBattleNoteActive&&g_hdBattleNoteOutcome==0&&g_hdBattleNoteWinner==65535&&!g_hdBattleNoteText[0]);
    assert(notifications==2&&activeNotifications==1&&g_hdBattleNoteSeq==3&&g_hdBattleNoteGeneration==7);
    assert(scroll==9&&timer==7&&scrollCalls==2&&timerOpens==2&&timerCloses==2);
    assert(!memcmp(world,beforeWorld,sizeof(world)));
}
int main(int argc,char**argv){
    assert(argc==2);int scenario=atoi(argv[1]);
    if(scenario==0){
        reset(3,0,"ours attacks C0");add(VM_CHAR_FUN,VK_ENTER);add(VM_TOUCH,VT_TOUCH_UP);add(VM_TIMER,0);add(VM_CHAR_ASC,'x');add(VM_TOUCH,VT_TOUCH_DOWN);ticks(100);add(VM_CHAR_FUN,VK_EXIT);
        ShowAttackNote(5,0);finished(105);assert(!personCalls&&cityCalls==1&&resourceCalls==2&&!countCalls);
        const int order[]={10,101,102,40,200};assert(traceCount==5&&!memcmp(trace,order,sizeof(order)));assert(messages[messageIndex].param==VK_EXIT);
    }else if(scenario==1){
        const U16 attackers[]={0,511};const U8 cities[]={37,0};
        for(int i=0;i<2;i++){char text[80];sprintf(text,"P%u attacks C%u",attackers[i],cities[i]);reset(3,0,text);ticks(100);ShowAttackNote(attackers[i],cities[i]);finished(100);
            assert(personCalls==1&&cityCalls==1&&resourceCalls==1&&!countCalls&&trace[1]==20+attackers[i]);}
    }else if(scenario==2){
        reset(4,1,"P0 confronts P511 !");add(VM_CHAR_FUN,VK_ENTER);add(VM_TOUCH,VT_TOUCH_UP);add(VM_TIMER,0);ticks(300);add(VM_CHAR_FUN,VK_EXIT);
        ShowFightNote(0,511);finished(303);assert(personCalls==2&&!cityCalls&&resourceCalls==2&&!countCalls);
        const int order[]={11,20,103,531,104,200};assert(traceCount==6&&!memcmp(trace,order,sizeof(order)));assert(messages[messageIndex].param==VK_EXIT);
    }else if(scenario==3){
        for(int touch=0;touch<2;touch++){reset(4,1,"P0 confronts P511 !");g_engineConfig.responseNoteOfBettle=1;add(VM_TIMER,0);add(touch?VM_TOUCH:VM_CHAR_ASC,touch?VT_TOUCH_DOWN:'x');add(VM_CHAR_FUN,VK_ENTER);
            ShowFightNote(0,511);finished(2);assert(messageIndex<messageCount&&!countCalls);}
    }else if(scenario==4){
        for(int touch=0;touch<2;touch++){reset(4,1,"P0 confronts P511 !");g_engineConfig.responseNoteOfBettle=2;add(VM_TIMER,0);add(VM_CHAR_ASC,'x');add(VM_TOUCH,VT_TOUCH_DOWN);add(VM_TOUCH,VT_TOUCH_MOVE);add(touch?VM_TOUCH:VM_CHAR_FUN,touch?VT_TOUCH_UP:VK_EXIT);add(VM_CHAR_FUN,VK_ENTER);
            ShowFightNote(0,511);finished(5);assert(messages[messageIndex].param==VK_ENTER&&!countCalls);}
    }else if(scenario==5){
        for(int kind=3;kind<=4;kind++)for(int step=1;step<=4;step++){
            if(kind==4&&step==3)continue;reset(kind,kind==3?0:1,kind==3?"P0 attacks C0":"P0 confronts P511 !");mutateAt=step;allowInactive=1;ticks(kind==3?100:300);
            if(kind==3)ShowAttackNote(0,0);else ShowFightNote(0,511);
            assert(mutationTriggered&&g_hdDetailGeneration==8&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&g_hdBattleNoteOutcome==4&&g_hdBattleNoteWinner==65535);
            assert(!strcmp((char*)g_hdBattleNoteText,"REPLACEMENT")&&activeNotifications==1&&!countCalls);
            baye_hd_battle_note_end(8,replacementSeq);assert(!g_hdBattleNoteActive&&!memcmp(world,beforeWorld,sizeof(world)));
        }
    }else if(scenario==6){
        for(int replacement=1;replacement<=2;replacement++){reset(3,0,"ours attacks C0");replaceDuringWait=replacement;ticks(100);ShowAttackNote(5,0);
            assert(g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&g_hdBattleNoteOutcome==4&&!strcmp((char*)g_hdBattleNoteText,"REPLACEMENT"));
            assert(activeNotifications==2&&!countCalls&&messageIndex==100);baye_hd_battle_note_end(g_hdDetailGeneration,replacementSeq);assert(!g_hdBattleNoteActive&&!memcmp(world,beforeWorld,sizeof(world)));}
    }else if(scenario==7){
        reset(1,2,"ours won");expectedWinner=5;ticks(300);ShowFightWinNote(5);finished(300);assert(countCalls==1&&!personCalls&&resourceCalls==2);
        reset(1,2,"P511 won");expectedWinner=511;g_engineConfig.responseNoteOfBettle=1;add(VM_CHAR_ASC,'x');ShowFightWinNote(511);finished(1);assert(countCalls==1&&personCalls==1&&resourceCalls==1);
        reset(2,3,"ours lost");g_engineConfig.responseNoteOfBettle=2;add(VM_TOUCH,VT_TOUCH_UP);ShowFightLossNote();finished(1);assert(countCalls==1&&!personCalls&&resourceCalls==2);
    }else if(scenario==8){
        reset(3,0,"unused");U8 text[]="original";U32 seq=g_hdBattleNoteSeq;
        assert(!baye_hd_battle_note_begin(0,65535,text));assert(!baye_hd_battle_note_begin(6,65535,text));assert(!baye_hd_battle_note_begin(255,65535,text));
        assert(!baye_hd_battle_note_begin(1,600,text));assert(!baye_hd_battle_note_begin(2,0,text));assert(!baye_hd_battle_note_begin(3,0,text));assert(!baye_hd_battle_note_begin(4,199,text));
        assert(!baye_hd_battle_note_begin(3,65535,NULL));assert(!baye_hd_battle_note_begin(4,65535,(U8*)""));g_hdDetailGeneration=0;assert(!baye_hd_battle_note_begin(3,65535,text));
        assert(!notifications&&g_hdBattleNoteSeq==seq&&!g_hdBattleNoteActive);g_hdDetailGeneration=7;mutationTriggered=1;
        for(U8 kind=3;kind<=4;kind++){int calls=countCalls;U32 token=baye_hd_battle_note_begin(kind,65535,(U8*)"REPLACEMENT");assert(token&&countCalls==calls);baye_hd_battle_note_end(7,token);}
    }else if(scenario==9){
        reset(3,0,"unused");U8 text[]={0xd6,0xd0,0xce,0xc4,0};draws=1;memcpy(drawn,text,sizeof(text));expectedWinner=65535;
        g_hdBattleNoteSeq=0xffffffff;U32 token=baye_hd_battle_note_begin(3,65535,text);assert(token==1&&!countCalls);text[0]=0;
        const U8 original[]={0xd6,0xd0,0xce,0xc4,0};assert(!memcmp(g_hdBattleNoteText,original,sizeof(original)));
        baye_hd_battle_note_end(6,token);baye_hd_battle_note_end(7,token+1);baye_hd_battle_note_end(7,0);assert(g_hdBattleNoteActive);
        baye_hd_battle_note_end(7,token);assert(!g_hdBattleNoteActive&&g_hdBattleNoteSeq==2&&!memcmp(world,beforeWorld,sizeof(world)));
    }else if(scenario==10){
        for(int kind=3;kind<=4;kind++)for(int mode=1;mode<=2;mode++){
            reset(kind,kind==3?0:1,kind==3?"ours attacks C0":"P0 confronts P511 !");replaceDuringNotify=mode;ticks(kind==3?100:300);
            if(kind==3)ShowAttackNote(5,0);else ShowFightNote(0,511);
            assert(notifyReplacementTriggered&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&replacementSeq==3+(mode==2));
            assert(g_hdBattleNoteGeneration==(U32)(7+(mode==2))&&g_hdBattleNoteOutcome==4&&!strcmp((char*)g_hdBattleNoteText,"REPLACEMENT"));
            assert(activeNotifications==2&&notifications==2+(mode==2));
            baye_hd_battle_note_end(g_hdDetailGeneration,replacementSeq);assert(!g_hdBattleNoteActive&&!memcmp(world,beforeWorld,sizeof(world)));
        }
        reset(3,0,"already drawn");draws=1;strcpy((char*)drawn,"already drawn");replaceDuringNotify=1;
        U32 own=baye_hd_battle_note_begin(3,65535,drawn);assert(own==2&&replacementSeq==3&&own!=replacementSeq);
        baye_hd_battle_note_end(7,own);assert(g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq);
        baye_hd_battle_note_end(7,replacementSeq);assert(!g_hdBattleNoteActive);
    }else assert(!"unknown scenario");
    puts("actual battle-announcement fixture passed");return 0;
}
`;
const run=promisify(execFile);let temporary,executable;
const compiled=(async()=>{temporary=mkdtempSync(join(tmpdir(),'baye-hd-battle-announcements-'));const file=join(temporary,'announcements.c');executable=join(temporary,process.platform==='win32'?'announcements.exe':'announcements');writeFileSync(file,fixture);try{await run(process.env.CC||'cc',['-std=c99','-Wall','-Wextra',file,'-o',executable],{timeout:20000,windowsHide:true});}catch(error){throw Error('Actual battle-announcement fixture compilation failed: '+(error.stderr||error.message));}})();
after(async()=>{await compiled.catch(()=>{});if(temporary){assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-battle-announcements-'));rmSync(temporary,{recursive:true,force:true});}});
const cases=[
    'actual player attack publishes its already drawn text and remains purely timed despite keys or touch',
    'actual foreign attacks preserve zero and high person IDs, city IDs and exact original getter counts',
    'actual confrontation retains its two native names, resource order and pure 300-tick wait',
    'confrontation flag one preserves its original ASCII and touch-down early return',
    'confrontation flag two preserves only function-character or completed touch-up early return',
    'draw, name and city callbacks changing the world cannot publish an old announcement or retire a replacement',
    'old announcement ends cannot retire a replacement with a different sequence or world generation',
    'existing native win and loss text, identities, getters and wait behavior are unchanged',
    'new announcement types require the unknown-winner sentinel and reject invalid type or missing text',
    'native publication copies GBK, skips zero on wrap and retires only its own generation and sequence',
    'synchronous native notification reentry returns the original publication token and cannot retire its replacement'
];
for(const [index,name]of cases.entries())test(name,async()=>{await compiled;const r=await run(executable,[String(index)],{timeout:20000,windowsHide:true});assert.match(r.stdout,/actual battle-announcement fixture passed/);});
