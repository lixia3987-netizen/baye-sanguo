#!/usr/bin/env node
// Production FgtChgWeather/FgtDealBout/GamDelay and note helpers. LCD, ROM,
// random delivery and message delivery are fixture boundaries; no saved game.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test,{after} from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=join(root,'vendor/iBaye/src');
const overrides={'Fight.c':process.env.BAYE_BATTLE_TRANSITION_FIGHT_SOURCE,'FightSub.c':process.env.BAYE_BATTLE_TRANSITION_WEATHER_SOURCE};
const read=file=>readFileSync(overrides[file]||join(native,file),'utf8').replace(/\r\n/g,'\n');
function actual(file,name){const source=read(file),m=new RegExp('^(?:static\\s+)?(?:inline\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b'+name+'\\([^;]*?\\)\\s*\\{','m').exec(source);assert.ok(m,`actual ${file}::${name}`);const end=source.indexOf('\n}',m.index);assert.ok(end>m.index);return source.slice(m.index,end+2);}
const bridge=read('hd-bridge.c'),globals=bridge.slice(bridge.indexOf('U8 g_hdBattleNoteProtocolVersion ='),bridge.indexOf('U16 g_hdMenuIds['));
const constants=[read('hd-bridge.h'),read('baye/comm.h'),read('baye/consdef.h'),read('baye/fight.h')].join('\n').split('\n').filter(line=>/^#define\s+(?:BAYE_HD_BATTLE_NOTE_VERSION|BAYE_HD_BATTLE_NOTE_TEXT_MAX|VM_CHAR_ASC|VM_CHAR_FUN|VM_TIMER|VM_TOUCH|VT_TOUCH_DOWN|VT_TOUCH_UP|VT_TOUCH_MOVE|VK_ENTER|VK_EXIT|TIMER_DLY|SHOW_DLYBASE|WEATHER_PIC[1-5]?|DAYS_PIC|FGT_PLAMAX|FGTA_MAX|FGT_AT|FGT_DF|FGT_AUTO|FGT_LOSE|FGT_WON|FGT_SPESX|FGT_SPESY|STA_SX|STA_SY|STA_TQX|STA_TQY|STA_WAIT)\b/.test(line)).join('\n');
const functions=[actual('baye/comm.h','GamMsgIsTimer0'),...['copy_gbk','hd_next_input_seq','hd_battle_note_notify','baye_hd_battle_note_retire','baye_hd_battle_note_begin','baye_hd_battle_stage_begin','baye_hd_battle_note_end'].map(name=>actual('hd-bridge.c',name)),actual('comIn.c','GamDelay'),actual('FightSub.c','FgtChgWeather'),actual('Fight.c','FgtDealBout')];
const owners=['hd_detail_copy','hd_help_detail_clear','hd_help_notify','baye_hd_set_report','baye_hd_report_begin','baye_hd_menu_begin','baye_hd_set_help','baye_hd_help_publish','baye_hd_set_qty','baye_hd_qty_begin'].map(name=>actual('hd-bridge.c',name));
const ownerConstants=read('hd-bridge.h').split('\n').filter(line=>/^#define\s+BAYE_HD_(?:REPORT_MAX|HELP_MAX|QTY_NO_KEY|MENU_CONTEXT_NONE|MENU_CONTEXT_FIGHT|FIGHT_INPUT_HELP|HELP_PERSON|HELP_TERRAIN)\b/.test(line)).join('\n');
const helpType=read('hd-bridge.h').match(/typedef struct \{\s*U32 generation;\s*U16 person, fields\[10\];[\s\S]*?\} HdHelpSnapshot;/)[0];
const reportGlobals=bridge.slice(bridge.indexOf('U8 g_hdReportGbk['),bridge.indexOf('U8 g_hdRecordActive ='));
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
#define SCR_WID 160
#define SCR_HGT 96
#define WK_SX 0
#define WK_EY 95
#define ASC_WID 4
#define dFgtNoProv0 11
#define dFgtNoProv1 12
#define gam_strlen(text) strlen((const char*)(text))
`+constants+'\n'+ownerConstants+'\n'+helpType+'\n'+globals+'\n'+reportGlobals+String.raw`
static U32 g_hdDetailGeneration=7;
static U8 g_hdHelpActive,g_hdMenuActive,g_hdQtyActive;
static U32 g_hdMenuSeq,g_hdFightInputSeq,g_hdQtySession,g_hdQtyInputSeq,g_hdQtyValue,g_hdQtyMin,g_hdQtyMax,g_hdQtyStep;
static U8 g_hdMenuContext,g_hdMenuKind,hdMenuNextContext,hdMenuNextKind,g_hdFightInputKind,g_hdQtyCursor,g_hdQtyReady;
static U16 g_hdQtyLastKey,g_hdHelpSeq,g_hdHelpPerson,g_hdHelpFields[10];
static U32 g_hdHelpGeneration,g_hdHelpInputSeq;
static U8 g_hdHelpGbk[BAYE_HD_HELP_MAX],g_hdHelpNameGbk[32],g_hdHelpArmGbk[16],g_hdHelpStateGbk[32];
static U8 g_hdHelpKind,g_hdHelpSlot,g_hdHelpX,g_hdHelpY,g_hdHelpTerrain,g_hdHelpLevelMax,g_hdHelpComplete,g_MapWid=16,g_MapHgt=16;
#define TERRAIN_MAX 8
static void baye_hd_city_info_retire(void){}
static void baye_hd_attack_retire(void){}
static void baye_hd_skill_retire(void){}
static void baye_hd_view_retire(void){}
static void baye_hd_mini_map_retire(void){}
static void baye_hd_person_properties_retire(void){}
static void hd_ai_retire(void){}
static void hd_status_retire(void){}
static void hd_menu_ids_clear(void){}
static void baye_hd_fight_input_begin(U8 kind){g_hdFightInputKind=kind;g_hdFightInputSeq++;}
static U8 g_FgtWeather,g_FgtOver;
static U16 g_FgtBoutCnt,g_FgtBoutMax,g_EneTmpProv;
static struct {U8 batlleDisableWeatherChange;} g_engineConfig;
static struct {U8 Mode;U16 MProvender,EProvender;} g_FgtParam;
static struct {U8 active;U16 untouched;} g_GenPos[FGTA_MAX];
static U8 canary[128],beforeCanary[128],dayDrawn[16];
static int direct,rngCalls,rngValue,countCalls,drawCount,strCount,notifications,begins,ends,stageKinds[8],stageValues[8],stageTicks[8];
static int totalTicks,scroll=9,timer=7,scrollCalls,timerOpens,timerCloses,loadCalls,msgCalls,stateCalls,loadIndex;
static int mutateDraw,mutateKind,mutationDone,replaceInWait,replaceInNotify,replacementDone,requireActive,dayMode;
static U32 replacementSeq;
static GMType messages[2048];static int messageCount,messageIndex;
static struct {U16 resource,index,x,y;BOOL screen;} draws[8];
U32 baye_hd_battle_note_begin(U8 outcome,U16 winner,const U8*text);
U32 baye_hd_battle_stage_begin(U32 generation,U8 kind,U16 value,const U8*text);
void baye_hd_battle_note_retire(void);
static void replacement(int newWorld){
    replacementDone=1;requireActive=0;
    if(newWorld){g_hdDetailGeneration++;baye_hd_battle_note_retire();}
    replacementSeq=baye_hd_battle_note_begin(4,65535,(U8*)"REPLACEMENT");assert(replacementSeq);
}
static void notify(void){
    notifications++;assert(!memcmp(canary,beforeCanary,sizeof(canary)));
    if(g_hdBattleNoteActive){
        assert(g_hdBattleNoteSeq&&g_hdBattleNoteGeneration==g_hdDetailGeneration);
        if(g_hdBattleNoteOutcome==6||g_hdBattleNoteOutcome==7){
            assert(g_hdBattleNoteWinner==65535);
            if(!direct){
                if(g_hdBattleNoteOutcome==6){assert(drawCount==3&&strCount==0);assert(!g_hdBattleNoteText[0]&&g_hdBattleNoteValue==g_FgtWeather);}
                else{assert(drawCount==4&&strCount==1);assert(!strcmp((char*)g_hdBattleNoteText,(char*)dayDrawn)&&g_hdBattleNoteValue==g_FgtBoutCnt);}
            }
            assert(begins<8);stageKinds[begins]=g_hdBattleNoteOutcome;stageValues[begins]=g_hdBattleNoteValue;stageTicks[begins++]=totalTicks;
            if(replaceInNotify&&!replacementDone)replacement(replaceInNotify==2);
        }else assert(g_hdBattleNoteValue==0);
    }else{ends++;assert(!g_hdBattleNoteOutcome&&g_hdBattleNoteWinner==65535&&!g_hdBattleNoteValue&&!g_hdBattleNoteText[0]);}
}
#define EM_ASM(...) notify()
static U32 GamGetPersonCount(void){countCalls++;return PERSON_MAX;}
`+[...functions,...owners].map(body=>body.slice(0,body.indexOf('{')).trim()+';').join('\n')+String.raw`
static void mutate(int point){
    if(point!=mutateDraw||mutationDone)return;mutationDone=1;requireActive=0;
    if(mutateKind==1)g_FgtWeather=g_FgtWeather%5+1;
    else if(mutateKind==2)replacement(1);
    else if(mutateKind==3)g_FgtBoutCnt++;
    else if(mutateKind==4)replacement(0);
}
static int gam_rand(void){rngCalls++;return rngValue;}
static void PlcRPicShow(U16 resource,U16 index,U16 x,U16 y,BOOL screen){
    assert(drawCount<8);draws[drawCount].resource=resource;draws[drawCount].index=index;draws[drawCount].x=x;draws[drawCount].y=y;draws[drawCount++].screen=screen;
    if(drawCount==4)assert(resource==DAYS_PIC&&totalTicks==50);
    mutate(drawCount);
}
static void gam_itoa(U16 value,U8*output,int radix){assert(radix==10);sprintf((char*)output,"%u",(unsigned)value);}
static void GamStrShowS(U16 x,U16 y,U8*text){
    assert(drawCount==4&&totalTicks==50&&strCount==0);strCount++;
    assert(x==FGT_SPESX+64-(strlen((char*)text)-1)*ASC_WID/2&&y==FGT_SPESY+22);
    strcpy((char*)dayDrawn,(char*)text);mutate(5);
}
static int SysScrollingTimerOpen(int value){scrollCalls++;int old=scroll;scroll=value;return old;}
static U8 SysGetTimer1Number(void){return(U8)timer;}
static void SysTimer1Close(void){timerCloses++;timer=0;}
static void SysTimer1Open(U8 value){timerOpens++;timer=value;}
static void GamGetMsg(GMType*message){
    if(requireActive){assert(g_hdBattleNoteActive);assert(g_hdBattleNoteOutcome==(dayMode&&totalTicks>=50?7:6));}
    if(replaceInWait&&!replacementDone)replacement(replaceInWait==2);
    assert(messageIndex<messageCount);*message=messages[messageIndex++];
    if(message->type==VM_TIMER&&message->param==1)totalTicks++;
}
static void FgtLoadToMem(U8 index,U8*text){assert(totalTicks==100&&!g_hdBattleNoteActive);loadCalls++;loadIndex=index;strcpy((char*)text,"NO FOOD");}
static void GamMsgBox(U8*text,U8 delay){assert(loadCalls==1&&delay==1&&!strcmp((char*)text,"NO FOOD")&&!g_hdBattleNoteActive);msgCalls++;}
static void FgtDrvState(void){assert(totalTicks==100);if(loadCalls)assert(msgCalls==1);stateCalls++;}
`+[...functions,...owners].join('\n')+String.raw`
static void add(U8 type,U16 value){assert(messageCount<2048);messages[messageCount++]=(GMType){type,value};}
static void ticks(int count){for(int i=0;i<count;i++)add(VM_TIMER,1);}
static void reset(void){
    g_hdDetailGeneration=7;g_hdBattleNoteActive=0;g_hdBattleNoteOutcome=0;g_hdBattleNoteWinner=65535;g_hdBattleNoteValue=0;g_hdBattleNoteSeq=1;g_hdBattleNoteGeneration=7;g_hdBattleNoteText[0]=0;g_hdReportActive=g_hdHelpActive=g_hdMenuActive=g_hdQtyActive=0;hdReportDepth=0;
    g_hdMenuContext=g_hdMenuKind=hdMenuNextContext=hdMenuNextKind=g_hdFightInputKind=0;g_hdReportGbk[0]=0;
    g_FgtWeather=4;g_FgtBoutCnt=0;g_FgtBoutMax=30;g_EneTmpProv=77;g_FgtOver=0;g_FgtParam.Mode=FGT_AT;g_FgtParam.EProvender=100;g_FgtParam.MProvender=200;g_engineConfig.batlleDisableWeatherChange=0;
    for(int i=0;i<FGTA_MAX;i++){g_GenPos[i].active=3;g_GenPos[i].untouched=(U16)(700+i);}
    direct=rngCalls=rngValue=countCalls=drawCount=strCount=notifications=begins=ends=totalTicks=scrollCalls=timerOpens=timerCloses=loadCalls=msgCalls=stateCalls=loadIndex=0;
    mutateDraw=mutateKind=mutationDone=replaceInWait=replaceInNotify=replacementDone=dayMode=0;replacementSeq=0;requireActive=1;
    scroll=9;timer=7;messageCount=messageIndex=0;dayDrawn[0]=0;memset(draws,0,sizeof(draws));
    memset(canary,0x63,sizeof(canary));memcpy(beforeCanary,canary,sizeof(canary));
}
static void unchanged(void){assert(!memcmp(canary,beforeCanary,sizeof(canary)));for(int i=0;i<FGTA_MAX;i++)assert(g_GenPos[i].untouched==700+i);}
static void weatherDraws(U8 weather){
    assert(draws[0].resource==WEATHER_PIC1-1+weather&&draws[0].index==1&&draws[0].x==FGT_SPESX&&draws[0].y==FGT_SPESY&&draws[0].screen==true);
    for(int i=1;i<3;i++)assert(draws[i].resource==WEATHER_PIC&&draws[i].index==weather&&draws[i].x==STA_TQX&&draws[i].y==STA_TQY&&draws[i].screen==(i==1));
}
static void waits(int count){assert(totalTicks==50*count&&scroll==9&&timer==7&&scrollCalls==count*2&&timerOpens==count*2&&timerCloses==count*2);unchanged();}
int main(int argc,char**argv){
    assert(argc==3);int scenario=atoi(argv[1]),safeOnly=atoi(argv[2]);
    if(scenario==0){
        for(U8 weather=1;weather<=5;weather++){reset();rngValue=weather-1;ticks(50);add(VM_CHAR_FUN,VK_EXIT);FgtChgWeather();weatherDraws(weather);waits(1);
            assert(rngCalls==1&&!countCalls&&drawCount==3&&!strCount&&begins==1&&ends==1&&stageKinds[0]==6&&stageValues[0]==weather&&stageTicks[0]==0&&!g_hdBattleNoteActive&&messageIndex==50);assert(messages[messageIndex].param==VK_EXIT);}
    }else if(scenario==1){
        for(U8 weather=0;weather<=6;weather++){reset();g_engineConfig.batlleDisableWeatherChange=1;g_FgtWeather=weather;if(!weather||weather>5)requireActive=0;ticks(50);FgtChgWeather();weatherDraws(weather);waits(1);assert(!rngCalls&&!countCalls&&g_FgtWeather==weather&&begins==(weather>=1&&weather<=5)&&!g_hdBattleNoteActive);}
    }else if(scenario==2){
        const U16 days[]={1,30,9999,10000,65535,0};
        for(unsigned j=0;j<sizeof(days)/sizeof(days[0]);j++){U16 day=days[j];if(safeOnly&&day>9999)continue;reset();dayMode=1;g_FgtBoutCnt=(U16)(day-1);g_FgtBoutMax=65535;rngValue=4;ticks(100);FgtDealBout();weatherDraws(5);waits(2);
            assert(g_FgtBoutCnt==day&&!g_EneTmpProv&&!g_FgtOver&&g_FgtParam.EProvender==100&&g_FgtParam.MProvender==200&&rngCalls==1&&!countCalls);
            assert(drawCount==4&&draws[3].resource==DAYS_PIC&&draws[3].index==1&&draws[3].x==FGT_SPESX+46&&draws[3].y==FGT_SPESY+18&&draws[3].screen);
            char text[6];sprintf(text,"%u",(unsigned)day);assert(!strcmp(text,(char*)dayDrawn));assert(begins==2&&ends==2&&stageKinds[0]==6&&stageValues[0]==5&&stageTicks[0]==0&&stageKinds[1]==7&&stageValues[1]==day&&stageTicks[1]==50);
            assert(stateCalls==1&&!loadCalls&&!msgCalls&&!g_hdBattleNoteActive);for(int i=0;i<FGTA_MAX;i++)assert(g_GenPos[i].active==STA_WAIT);}
    }else if(scenario==3){
        for(U8 mode=0;mode<=2;mode++){reset();g_FgtParam.Mode=mode;g_FgtBoutCnt=30;FgtDealBout();assert(g_FgtBoutCnt==31&&!g_EneTmpProv&&g_FgtOver==(mode==FGT_AT?FGT_LOSE:FGT_WON));
            assert(!rngCalls&&!drawCount&&!strCount&&!notifications&&!totalTicks&&!stateCalls&&!loadCalls&&!msgCalls&&!messageIndex);for(int i=0;i<FGTA_MAX;i++)assert(g_GenPos[i].active==3);unchanged();}
    }else if(scenario==4){
        for(int food=0;food<3;food++){reset();dayMode=1;if(food!=1)g_FgtParam.EProvender=0;if(food!=0)g_FgtParam.MProvender=0;ticks(100);FgtDealBout();waits(2);
            assert(g_FgtOver==(food==0?FGT_WON:FGT_LOSE)&&loadCalls==1&&msgCalls==1&&stateCalls==1&&loadIndex==(food==0?dFgtNoProv1:dFgtNoProv0));assert(begins==2&&ends==2&&!g_hdBattleNoteActive);}
    }else if(scenario==5){
        reset();dayMode=1;for(int part=0;part<2;part++){add(VM_TIMER,0);add(VM_CHAR_FUN,VK_ENTER);add(VM_CHAR_ASC,'x');add(VM_TOUCH,VT_TOUCH_DOWN);add(VM_TOUCH,VT_TOUCH_UP);add(VM_TOUCH,VT_TOUCH_MOVE);ticks(50);}add(VM_CHAR_FUN,VK_EXIT);
        FgtDealBout();waits(2);assert(begins==2&&ends==2&&messageIndex==112&&messages[messageIndex].param==VK_EXIT);
    }else if(scenario==6){
        for(int point=1;point<=3;point++){reset();mutateDraw=point;mutateKind=1;ticks(50);FgtChgWeather();waits(1);assert(mutationDone&&drawCount==3&&!begins&&!notifications&&rngCalls==1&&!g_hdBattleNoteActive);}
    }else if(scenario==7){
        for(int mode=0;mode<2;mode++)for(int point=1;point<=5;point++){reset();dayMode=1;mutateDraw=point;mutateKind=mode?2:4;ticks(100);FgtDealBout();waits(2);assert(mutationDone&&g_hdDetailGeneration==7+mode&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&g_hdBattleNoteOutcome==4);assert(begins==(point>3?1:0));}
        reset();dayMode=1;mutateDraw=5;mutateKind=3;ticks(100);FgtDealBout();waits(2);assert(begins==1&&ends==1&&g_FgtBoutCnt==2&&!g_hdBattleNoteActive&&!strcmp((char*)dayDrawn,"1"));
    }else if(scenario==8){
        for(int mode=1;mode<=2;mode++){reset();replaceInWait=mode;ticks(50);FgtChgWeather();waits(1);assert(begins==1&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&g_hdBattleNoteOutcome==4);baye_hd_battle_note_end(g_hdDetailGeneration,replacementSeq);assert(!g_hdBattleNoteActive);}
        for(int mode=1;mode<=2;mode++){reset();dayMode=1;replaceInWait=mode;ticks(100);FgtDealBout();waits(2);assert(begins==1&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&g_hdBattleNoteOutcome==4);}
    }else if(scenario==9){
        for(int mode=1;mode<=2;mode++){reset();replaceInNotify=mode;ticks(50);FgtChgWeather();waits(1);assert(begins==1&&replacementDone&&g_hdBattleNoteActive&&g_hdBattleNoteSeq==replacementSeq&&g_hdBattleNoteOutcome==4);}
        reset();direct=1;replaceInNotify=1;U32 own=baye_hd_battle_stage_begin(7,6,1,NULL);assert(own&&own!=replacementSeq&&g_hdBattleNoteSeq==replacementSeq);baye_hd_battle_note_end(7,own);assert(g_hdBattleNoteActive);
    }else if(scenario==10){
        reset();direct=1;requireActive=0;g_hdBattleNoteSeq=0xffffffff;U32 token=baye_hd_battle_stage_begin(7,6,5,NULL);assert(token==1&&g_hdBattleNoteValue==5&&!g_hdBattleNoteText[0]&&!countCalls);
        baye_hd_battle_note_end(6,token);baye_hd_battle_note_end(7,token+1);assert(g_hdBattleNoteActive);baye_hd_battle_note_end(7,token);assert(!g_hdBattleNoteActive&&!g_hdBattleNoteValue);
        const U8 incomplete[]={'6','5','5','3','5','9'};
        assert(!baye_hd_battle_stage_begin(0,6,1,NULL)&&!baye_hd_battle_stage_begin(6,6,1,NULL)&&!baye_hd_battle_stage_begin(7,5,1,NULL));
        assert(!baye_hd_battle_stage_begin(7,6,0,NULL)&&!baye_hd_battle_stage_begin(7,6,6,NULL)&&!baye_hd_battle_stage_begin(7,6,1,(U8*)"x"));
        assert(!baye_hd_battle_stage_begin(7,7,0,NULL)&&!baye_hd_battle_stage_begin(7,7,0,(U8*)"")&&!baye_hd_battle_stage_begin(7,7,1,(U8*)"01")&&!baye_hd_battle_stage_begin(7,7,1,(U8*)"1x"));
        assert(!baye_hd_battle_stage_begin(7,7,0,(U8*)"65536")&&!baye_hd_battle_stage_begin(7,7,1,incomplete));
        const U16 values[]={0,9999,10000,65535};for(int i=0;i<4;i++){U8 text[6];sprintf((char*)text,"%u",(unsigned)values[i]);token=baye_hd_battle_stage_begin(7,7,values[i],text);assert(token&&g_hdBattleNoteValue==values[i]&&!strcmp((char*)g_hdBattleNoteText,(char*)text));text[0]='X';assert(g_hdBattleNoteText[0]!='X');baye_hd_battle_note_end(7,token);}
        assert(!countCalls);unchanged();
    }else if(scenario==11){
        for(U8 kind=1;kind<=5;kind++){reset();direct=1;requireActive=0;assert(baye_hd_battle_stage_begin(7,6,5,NULL));int before=countCalls;U32 token=baye_hd_battle_note_begin(kind,kind==1?511:65535,(U8*)"LEGACY");assert(token&&g_hdBattleNoteOutcome==kind&&!g_hdBattleNoteValue&&countCalls-before==(kind<=2?1:0));baye_hd_battle_note_end(7,token);assert(!g_hdBattleNoteActive&&!g_hdBattleNoteValue);unchanged();}
        reset();direct=1;assert(!baye_hd_battle_note_begin(6,65535,(U8*)"unsupported")&&!baye_hd_battle_note_begin(7,65535,(U8*)"unsupported"));
    }else if(scenario==12){
        for(int owner=0;owner<7;owner++)for(U8 kind=1;kind<=7;kind++){
            reset();direct=1;requireActive=0;U32 old;
            if(kind<6)old=baye_hd_battle_note_begin(kind,kind==1?511:65535,(U8*)"LEGACY");else old=baye_hd_battle_stage_begin(7,kind,kind==6?3:20,kind==6?NULL:(U8*)"20");assert(old);
            HdHelpSnapshot snapshot={0};snapshot.generation=7;snapshot.kind=BAYE_HD_HELP_TERRAIN;snapshot.complete=1;
            if(owner==0)baye_hd_set_report((U8*)"REPORT",65535,1);
            else if(owner==1)baye_hd_report_begin(1);
            else if(owner==2)baye_hd_menu_begin();
            else if(owner==3)baye_hd_set_help((U8*)"HELP");
            else if(owner==4){g_hdFightInputKind=BAYE_HD_FIGHT_INPUT_HELP;baye_hd_help_publish(&snapshot,(U8*)"HELP");}
            else if(owner==5)baye_hd_set_qty(1,0,9,1);
            else baye_hd_qty_begin();
            assert(g_hdBattleNoteActive==(kind<6));assert(kind<6?g_hdBattleNoteSeq==old:g_hdBattleNoteSeq!=old);if(kind>=6)assert(!g_hdBattleNoteValue&&!g_hdBattleNoteText[0]);
            U32 after=g_hdBattleNoteSeq;baye_hd_battle_note_end(7,old);assert(g_hdBattleNoteSeq==after||(kind<6&&!g_hdBattleNoteActive));unchanged();
        }
        for(int owner=0;owner<4;owner++){reset();direct=1;if(owner==0)g_hdReportActive=1;else if(owner==1)g_hdHelpActive=1;else if(owner==2)g_hdMenuActive=1;else g_hdQtyActive=1;
            U32 old=g_hdBattleNoteSeq;assert(!baye_hd_battle_stage_begin(7,6,1,NULL)&&!baye_hd_battle_stage_begin(7,7,10,(U8*)"10"));assert(g_hdBattleNoteSeq==old&&!g_hdBattleNoteActive&&!notifications);
        }
        reset();direct=1;U32 old=baye_hd_battle_stage_begin(7,6,1,NULL);assert(!baye_hd_battle_stage_begin(7,7,10,(U8*)"10")&&g_hdBattleNoteSeq==old);
        HdHelpSnapshot stale={0};stale.generation=6;g_hdFightInputKind=BAYE_HD_FIGHT_INPUT_HELP;baye_hd_help_publish(&stale,(U8*)"stale");assert(g_hdBattleNoteActive&&g_hdBattleNoteSeq==old);
        baye_hd_set_qty(0,0,0,0);assert(g_hdBattleNoteActive&&g_hdBattleNoteSeq==old);
    }else assert(!"unknown scenario");
    puts("actual weather/day fixture passed");return 0;
}
`;
const run=promisify(execFile);let temporary,executable;
const compiled=(async()=>{temporary=mkdtempSync(join(tmpdir(),'baye-hd-battle-transition-'));const file=join(temporary,'transition.c');executable=join(temporary,process.platform==='win32'?'transition.exe':'transition');writeFileSync(file,fixture);try{await run(process.env.CC||'cc',['-std=c99','-Wall','-Wextra',file,'-o',executable],{timeout:20000,windowsHide:true});}catch(error){throw Error('Actual weather/day fixture compilation failed: '+(error.stderr||error.message));}})();
after(async()=>{await compiled.catch(()=>{});if(temporary){assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-battle-transition-'));rmSync(temporary,{recursive:true,force:true});}});
const cases=[
    'all five actual weather outcomes publish after three original LCD draws with one RNG call and a complete passive wait',
    'disabled weather retains the actual value, consumes no RNG and invalid native values remain unpublished',
    'actual daily progress retains weather then day ordering, exact centering, all active resets and complete U16 decimal values',
    'the original thirty-day timeout retains attack/defense outcomes and returns before weather, active reset and state processing',
    'enemy food, own food and both-empty precedence preserve original notices and state processing after both stages retire',
    'timer0, function keys, ASCII and touch cannot shorten either original fifty-tick passive wait or consume the following key',
    'weather source changes during any original draw suppress publication without changing native draw or RNG counts',
    'world replacement during every LCD boundary suppresses stale stages and day source changes suppress mismatched decimal text',
    'same-world and new-world replacements during native waits survive late stage ends and old-world daily continuation',
    'synchronous notification reentry keeps the replacement and stage begin returns its own local sequence',
    'typed stages validate current generation, five weather enums and canonical bounded U16 day text, copy payloads and wrap sequences',
    'legacy outcome one through five resets Value on begin/end and retains winner and getter behavior',
    'actual report, menu, help and quantity entries synchronously retire stages while preserving legacy notices and blocking active owners'
];
for(const[index,name]of cases.entries())test(name,async()=>{await compiled;const result=await run(executable,[String(index),process.env.BAYE_BATTLE_TRANSITION_SAFE_DAYS_ONLY==='1'?'1':'0'],{timeout:20000,windowsHide:true});assert.match(result.stdout,/actual weather\/day fixture passed/);});
test('the original skill 22 branch reuses actual weather and LCD resources have no additional custom draw hook',()=>{
    const action=actual('FightSub.c','FgtJNAction').replace(/\/\*[\s\S]*?\*\//g,'');assert.match(action,/if\s*\(param\s*==\s*22\)\s*\{\s*FgtChgWeather\(\);\s*return\s+8;\s*\}/);
    const weather=actual('FightSub.c','FgtChgWeather');assert.equal((weather.match(/gam_rand\(/g)||[]).length,1);assert.equal((weather.match(/PlcRPicShow\(/g)||[]).length,3);assert.equal((weather.match(/GamDelay\(/g)||[]).length,1);
    assert.doesNotMatch(weather,/GetPersonName|ResLoadToMem|CALL_HOOK|g_(?:Year|Month)Date|ComputerTactic|sendKey/);
    const draw=actual('PublicFun.c','PlcRPicShowEx');assert.doesNotMatch(draw,/CALL_HOOK|IF_HAS_HOOK|WEATHER_PIC|DAYS_PIC/);
    assert.match(read('baye/extern.h'),/extern U16\s+g_FgtBoutCnt\b/);assert.match(read('baye/extern.h'),/extern U16\s+g_FgtBoutMax\b/);
});
test('both native observers are independently notified and Value is bound as U16',()=>{
    const notify=actual('hd-bridge.c','hd_battle_note_notify');assert.match(notify,/BayeHdBattleNote\.onEngineNote\(\)/);assert.match(notify,/BayeHdBattleTransition\.onEngineTransition\(\)/);assert.equal((notify.match(/catch\s*\(e\)/g)||[]).length,2);
    assert.match(bridge,/DEFADDF\(g_hdBattleNoteValue, U16\)/);
});
