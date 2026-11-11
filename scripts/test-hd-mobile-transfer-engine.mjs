#!/usr/bin/env node
// Compile the production transfer/business and publication functions. Only UI waits,
// drawing and resource delivery are fixtures; this is not browser acceptance.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const native = join(root, 'vendor/iBaye/src');
const read = name => readFileSync(join(native, name), 'utf8').replace(/\r\n/g, '\n');
const run = promisify(execFile);

function actualFunction(filename, name) {
    const source = read(filename);
    const match = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm').exec(source);
    assert.ok(match, `Production ${filename}::${name} exists`);
    const open = source.indexOf('{', match.index);
    let depth = 0, quote = null, comment = null;
    for (let end = open; end < source.length; end++) {
        const char = source[end], next = source[end + 1];
        if (comment === '//') { if (char === '\n') comment = null; continue; }
        if (comment === '/*') { if (char === '*' && next === '/') { comment = null; end++; } continue; }
        if (quote) { if (char === '\\') end++; else if (char === quote) quote = null; continue; }
        if (char === '/' && (next === '/' || next === '*')) { comment = char + next; end++; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === '{') depth++;
        if (char === '}' && --depth === 0) return source.slice(match.index, end + 1);
    }
    assert.fail(`Production ${filename}::${name} closes`);
}

const lib = readFileSync(join(root, 'libs/dat-mod.lib'));
assert.equal(lib.length, 207195);
assert.equal(createHash('sha256').update(lib).digest('hex'), '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
function resource(id, index) {
    const base = lib.readUInt32LE((id - 1) * 4), length = lib.readUInt32LE(base);
    assert.equal(lib.readUInt16LE(base + 4), id);
    const count = lib.readUInt16LE(base + 6), fixed = lib.readUInt32LE(base + 8);
    assert.ok(index < count && base + length <= lib.length);
    const offset = fixed ? 14 + index * fixed : count === 1 ? 14 : lib.readUInt32LE(base + 14 + index * 8);
    const size = fixed || (count === 1 ? length - 14 : lib.readUInt32LE(base + 18 + index * 8));
    assert.ok(offset >= 14 && offset + size <= length);
    return lib.subarray(base + offset, base + offset + size);
}

const costs = resource(2,9), links = resource(59,0);
assert.equal(costs[13],8); assert.equal(costs[14],0); assert.equal(links.length,38*16);
const bytes = value => [...value,0].join(',');
const defines=read('hd-bridge.h').split('\n').filter(s=>/^#define BAYE_HD_/.test(s)).join('\n');
const bridge=read('hd-bridge.c');
const globals=bridge.slice(bridge.indexOf('U8 g_hdMenuGbk['),bridge.indexOf('U8 g_hdFightActive ='))+
 bridge.slice(bridge.indexOf('U32 g_hdQtyValue ='),bridge.indexOf('U8 g_hdFightSkip ='))+
 bridge.slice(bridge.indexOf('U8 g_hdHelpProtocolVersion ='),bridge.indexOf('U8 g_hdMovieActive ='));
const orderType=/typedef struct OrderStruct[\s\S]*?\}OrderType;/.exec(read('baye/order.h'))[0];
const constants=['baye/sconst.h','baye/consdef.h','baye/order.h','baye/attribute.h'].flatMap(name=>
 read(name).split('\n').filter(s=>/^#define\s+(TRANSPORTATION|MOVE|ORDER_MAX|IFACE_CONID|STRING_CONST|CITY_LINKR|STR_NOPERSON|STR_OBJ|P_SAY_STR31|STR_RP9|STR_RP10|NOTE_STR[3459]|ADD16|ASC_WID|ASC_HGT|TACTIC_ICON|ATRR_STR6[012])\b/.test(s))).join('\n');
const nativeFunctions=['hd_next_input_seq', 'hd_battle_note_notify', 'baye_hd_battle_note_retire','baye_hd_person_properties_retire','hd_goods_clear','hd_menu_ids_clear',
 'hd_help_detail_clear','hd_city_info_notify','baye_hd_city_info_retire','baye_hd_view_retire','baye_hd_mini_map_retire','baye_hd_map_input_begin',
 'baye_hd_menu_scope','baye_hd_menu_scope_default','baye_hd_menu_begin','baye_hd_menu_end',
 'baye_hd_set_menu','baye_hd_set_menu_index','baye_hd_menu_ids',
 'baye_hd_set_qty','baye_hd_qty_begin','baye_hd_qty_publish','baye_hd_qty_busy','baye_hd_qty_end',
 'baye_hd_set_map_pick','hd_transfer_owner','baye_hd_transfer_phase','baye_hd_transfer_begin',
 'baye_hd_transfer_person','baye_hd_transfer_amount','baye_hd_transfer_target','baye_hd_transfer_commit',
 'baye_hd_transfer_end','baye_hd_transfer_retire'];
const fixture=String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;typedef uint16_t PersonID;typedef U8 SBUF[512];
#define FAR
#define PID(x) ((PersonID)(x))
#define PID0 0
#define CITY_MAX 38
#define PERSON_COUNT 200
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define gam_memcpy memcpy
#define EM_ASM(...) ((void)0)
`+defines+'\n'+constants+'\n'+read('data/pconst.h')+'\n'+orderType+String.raw`
 typedef struct {U16 Belong,PersonQueue,Persons,Money,Food,MothballArms;} CityType;
 typedef struct {U16 Belong,Arms;U8 Thew;} PersonType;
 typedef struct {U8 setx,sety,x,y;} CitySetType;
 static CityType g_Cities[CITY_MAX];static PersonType g_Persons[PERSON_COUNT];
 static PersonID g_PersonsQueue[2000],shareMemory[2000];static OrderType orders[ORDER_MAX];
 static CitySetType g_CityPos;static U8 g_CBnkPtr,g_engineDebug;static PersonID g_PlayerKing=10;
 static struct {U8 fixOverFlow16,fixThewOverFlow,checkRedundantOnAddPerson;} g_engineConfig;
 #define SHARE_MEM shareMemory
 #define ORDERQUEUE orders
 static U8 thewCosts[]={`+bytes(costs)+`};static U8 nativeLinks[]={`+bytes(links)+String.raw`};
 static U32 GamGetPersonCount(void){return PERSON_COUNT;}
 static U32 baye_hd_tool_count(void){return 33;}
 static void baye_hd_fight_input_begin(U8 kind){(void)kind;assert(0);}
 static void baye_hd_fight_input_end(void){assert(0);}
 static void hd_ai_retire(void){}static void hd_status_retire(void){}
 static int SysScrollingTimerOpen(int x){return x;}
 static void gam_clrlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
 static void gam_rect(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
 static void GamStrShowS(int a,int b,U8*s){(void)a;(void)b;assert(s);}
 static U8*ResLoadToCon(U16 id,U16 item,U8 bank){(void)bank;
  if(id==IFACE_CONID){assert(item==ConsumeThew);return thewCosts;}
  assert(id==CITY_LINKR&&item==1);return nativeLinks;}
 static void ResLoadToMem(U16 id,U16 item,U8*out){assert(id==STRING_CONST);out[0]=(U8)item;out[1]=0;}
`+globals+String.raw`
 static unsigned scenario,personCalls,qtyCalls,mapCalls,addCalls,fullMessages,rejects,reports,driverMode;
 static unsigned departureReports,phaseCount;static U8 phases[80];static U32 phaseSeqs[80],phaseSessions[80];
 static U16 peopleAnswers[12],quantityAnswers[20];static U8 targetAnswers[12];
 static unsigned peopleLength,qtyLength,targetLength;static U32 expectedCommitBefore;
 static U8 rngValue=99,hookAccepted=1;
 static int gam_rand(void){return rngValue;}
 static void ShowMapClear(void){}
 static void observePhase(U8 phase){assert(g_hdTransferActive&&g_hdTransferPhase==phase);
  assert(phaseCount<80&&g_hdTransferSession&&g_hdTransferInputSeq);
  if(phaseCount&&phaseSessions[phaseCount-1]==g_hdTransferSession)assert(phaseSeqs[phaseCount-1]!=g_hdTransferInputSeq);
  phases[phaseCount]=phase;phaseSeqs[phaseCount]=g_hdTransferInputSeq;phaseSessions[phaseCount++]=g_hdTransferSession;}
 static void ShowConstStrMsg(U8 id){observePhase(BAYE_HD_TRANSFER_REJECT);assert(id==STR_NOPERSON||id==NOTE_STR9||id==NOTE_STR3||id==NOTE_STR4||id==NOTE_STR5);++rejects;}
 static void GamMsgBox(U8*str,U8 delay){assert(str&&delay==1&&g_hdTransferPhase==8);++fullMessages;}
 static U8 canAddOrder(OrderType*order){assert(order->OrderId==13||order->OrderId==14);++addCalls;return hookAccepted;}
`+'\n'+nativeFunctions.map(n=>actualFunction('hd-bridge.c',n)).join('\n')+'\n'+
 actualFunction('gamEng.c','add_16')+'\n'+
 ['GetCityPersons','DelPerson','AddPerson','GetRoundSelfCity','SearchRoad'].map(n=>actualFunction('cityedit.c',n)).join('\n')+'\n'+
 ['IsManual','OrderConsumeThew'].map(n=>actualFunction('citycmde.c',n)).join('\n')+'\n'+actualFunction('citycmdd.c','AddOrderHead')+'\n'+actualFunction('citycmdd.c','DelOrder')+String.raw`
 static void ShowGReport(PersonID actor,U8*text){++reports;
  if(driverMode){assert(text[0]==STR_RP9||text[0]==STR_RP10);assert(actor==12&&g_Cities[0].Persons==2);return;}
  if(text[0]==STR_OBJ){observePhase(5);assert(actor==(g_hdTransferCommand==13?g_hdTransferPerson:g_PlayerKing));return;}
  assert(text[0]==P_SAY_STR31);observePhase(8);++departureReports;
  assert(actor==g_hdTransferPerson&&g_hdTransferTarget==8&&g_hdTransferDistance==5);
  assert(g_hdTransferCommitSeq==expectedCommitBefore);expectedCommitBefore++;
  assert(g_Cities[0].Persons==3-(departureReports-1));
  unsigned thew=g_engineConfig.fixThewOverFlow&&g_hdTransferCommand==14?100:92;
  if(scenario==16)thew=248;
  assert(g_Persons[actor].Thew==thew);
  if(g_hdTransferCommand==13){assert(g_Cities[0].Food==73&&g_Cities[0].Money==95&&g_Cities[0].MothballArms==57);}
  else assert(g_Cities[0].Food==80&&g_Cities[0].Money==100&&g_Cities[0].MothballArms==60);
  assert(orders[departureReports-1].OrderId==255||scenario==9||scenario==24);
 }
 FAR PersonID ShowPersonControlInner(PersonID*ids,U32 count,PersonID initial,U8 a,U8 b,U8 c,U8 d){
  (void)a;(void)b;(void)c;(void)d;observePhase(1);assert(personCalls<peopleLength&&count>0);
  const U8 names[8]={'A',0,0,0,'B',0,0,0};U16 index=initial>=count?(U16)(count-1):initial;
  baye_hd_set_menu(names,4,(U16)count,index);baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,ids,count);
  assert(g_hdMenuActive&&g_hdMenuContext==1&&g_hdMenuKind==3&&g_hdMenuIdsCount==count);
  U16 answer=peopleAnswers[personCalls++];assert(answer==65535||answer<count);
  return answer;
 }
 FAR U8 GetCitySetInner(CitySetType*pos){observePhase(6);assert(g_hdMapPick==1&&mapCalls<targetLength);
  U8 answer=targetAnswers[mapCalls++];if(answer!=255){pos->setx=4;pos->sety=3;}return answer;}
 static U32 NumOperate(U32 min,U32 max,U32 initial){U8 phase=g_hdTransferPhase;observePhase(phase);assert(phase>=2&&phase<=4);
  assert(min==0&&max==(phase==2?g_Cities[0].Food:phase==3?g_Cities[0].Money:g_Cities[0].MothballArms)&&initial==max);
  assert(qtyCalls<qtyLength);U16 answer=quantityAnswers[qtyCalls++];assert(answer==65535||answer<=max);
  U32 session=baye_hd_qty_begin();baye_hd_qty_publish(session,initial,min,max,0,1,BAYE_HD_QTY_NO_KEY);
  assert(g_hdQtyActive&&g_hdQtyReady&&g_hdQtyInputSeq==0);baye_hd_qty_busy(session);
  baye_hd_qty_end(session,answer==65535?initial:answer,min,max,answer==65535?40:39);return answer;}
`+actualFunction('showface.c','ShowPersonControl')+'\n'+actualFunction('cityedit.c','GetCitySet')+'\n'+
 ['GetFood','GetMoney','GetArmy'].map(n=>actualFunction('cityedit.c',n)).join('\n')+'\n'+
 ['TransportationMake','MoveMake'].map(n=>actualFunction('citycmdc.c',n)).join('\n')+'\n'+
 ['TransportationDrv','MoveDrv'].map(n=>actualFunction('citycmd.c',n)).join('\n')+String.raw`
 static void setup(void){memset(g_Cities,0,sizeof(g_Cities));memset(g_Persons,0,sizeof(g_Persons));
  for(unsigned i=0;i<2000;i++)g_PersonsQueue[i]=(PersonID)(i%200);
  memset(orders,0xa5,sizeof(orders));for(unsigned i=0;i<200;i++)orders[i].OrderId=255;
  for(unsigned i=0;i<38;i++){g_Cities[i].Belong=9;g_Cities[i].PersonQueue=3;}
  g_Cities[0]=(CityType){.Belong=7,.PersonQueue=0,.Persons=3,.Money=100,.Food=80,.MothballArms=60};
  g_Cities[3].Belong=g_Cities[8].Belong=7;
  g_PersonsQueue[0]=10;g_PersonsQueue[1]=11;g_PersonsQueue[2]=12;
  g_Persons[10]=(PersonType){.Belong=7,.Arms=900,.Thew=100};g_Persons[11].Belong=8;
  g_Persons[12]=(PersonType){.Belong=7,.Arms=700,.Thew=100};
  g_CityPos=(CitySetType){1,1,0,0};g_hdDetailGeneration=7;
  peopleAnswers[0]=1;peopleAnswers[1]=65535;peopleLength=2;
  quantityAnswers[0]=7;quantityAnswers[1]=5;quantityAnswers[2]=3;qtyLength=3;
  targetAnswers[0]=8;targetLength=1;g_engineConfig.fixOverFlow16=0;
 }
 static void unchanged(void){assert(g_Cities[0].Money==100&&g_Cities[0].Food==80&&g_Cities[0].MothballArms==60);
  assert(g_Cities[0].Persons==3&&g_Cities[1].PersonQueue==3&&g_PersonsQueue[2]==12);
  assert(g_Persons[12].Thew==100);assert(!addCalls&&!g_hdTransferCommitSeq&&!g_hdTransferCommitResult);}
 static void done(void){assert(!g_hdTransferActive&&g_hdTransferPhase==9&&!g_hdMenuActive&&!g_hdQtyActive&&!g_hdMapPick);}
 static void cargoSuccess(void){assert(g_hdTransferCommand==13&&g_hdTransferPerson==12&&g_hdTransferTarget==8&&g_hdTransferDistance==5);
  assert(g_hdTransferFood==7&&g_hdTransferMoney==5&&g_hdTransferArms==3&&g_hdTransferCommitSeq==1&&g_hdTransferCommitResult==1);
  assert(g_Cities[0].Persons==2&&g_Cities[1].PersonQueue==2&&g_PersonsQueue[1]==11&&g_PersonsQueue[2]==3&&g_PersonsQueue[199]==199&&g_PersonsQueue[200]==0);
  assert(orders[0].OrderId==13&&orders[0].Person==12&&orders[0].City==0&&orders[0].Object==8&&orders[0].TimeCount==5);
  assert(orders[0].Food==7&&orders[0].Money==5&&orders[0].Arms==3&&addCalls==1&&departureReports==1);
  assert(g_Persons[12].Arms==700&&g_Persons[10].Thew==100);done();}
 int main(int argc,char**argv){assert(argc==2);scenario=(unsigned)strtoul(argv[1],0,10);setup();
  if(scenario==1){TransportationMake(0);cargoSuccess();assert(qtyCalls==3&&mapCalls==1&&g_hdMenuSeq==2&&g_hdMapInputSeq==1);}
  else if(scenario>=2&&scenario<=4){qtyLength=scenario-1;quantityAnswers[scenario-2]=65535;
   if(scenario==3){quantityAnswers[2]=65535;qtyLength=3;} // MONEY cancel then FOOD cancel
   if(scenario==4){quantityAnswers[3]=65535;quantityAnswers[4]=65535;qtyLength=5;} // ARMS -> MONEY -> FOOD
   TransportationMake(0);unchanged();assert(personCalls==2&&!mapCalls);done();}
  else if(scenario==5){targetAnswers[0]=255;quantityAnswers[3]=65535;quantityAnswers[4]=65535;quantityAnswers[5]=65535;qtyLength=6;
   TransportationMake(0);unchanged();assert(mapCalls==1&&personCalls==2&&qtyCalls==6);done();}
  else if(scenario>=6&&scenario<=8){targetLength=2;targetAnswers[1]=255;
   targetAnswers[0]=scenario==6?1:8;if(scenario==7)g_Cities[8].Belong=0;if(scenario==8)g_Cities[3].Belong=9;
   quantityAnswers[3]=65535;quantityAnswers[4]=65535;quantityAnswers[5]=65535;qtyLength=6;
   TransportationMake(0);unchanged();assert(rejects==1&&mapCalls==2);done();}
  else if(scenario==9){for(unsigned i=0;i<200;i++)orders[i].OrderId=0;TransportationMake(0);
   assert(g_Cities[0].Food==73&&g_Cities[0].Money==95&&g_Persons[12].Thew==92&&g_Cities[0].Persons==3);
   assert(fullMessages==1&&addCalls==1&&g_hdTransferCommitSeq==1&&g_hdTransferCommitResult==2);done();}
  else if(scenario==10){targetAnswers[0]=255;MoveMake(0);unchanged();assert(!personCalls&&!qtyCalls);done();}
  else if(scenario==11||scenario==12){g_engineConfig.fixThewOverFlow=scenario==12;MoveMake(0);
   assert(g_Cities[0].Persons==2&&orders[0].OrderId==14&&orders[0].Person==12&&orders[0].Object==8&&orders[0].TimeCount==5);
   assert(g_Persons[12].Thew==(scenario==12?100:92)&&g_Persons[12].Arms==700&&g_hdTransferFood==0&&!qtyCalls);
   assert(g_hdTransferCommitResult==1&&g_hdTransferCommitSeq==1&&personCalls==2);done();}
  else if(scenario==13){peopleAnswers[1]=0;peopleLength=2;MoveMake(0);
   assert(addCalls==2&&g_hdTransferCommitSeq==2&&orders[0].Person==12&&orders[1].Person==10);
   assert(g_Cities[0].Persons==1&&g_Cities[1].PersonQueue==1&&g_PersonsQueue[0]==11);
   assert(phaseSessions[0]==phaseSessions[phaseCount-1]&&g_hdTransferSession==1);done();}
  else if(scenario==14){g_Persons[12].Thew=7;TransportationMake(0);assert(rejects==1&&!qtyCalls&&!addCalls&&g_Persons[12].Thew==7);done();}
  else if(scenario==15){g_Cities[0].Persons=0;assert(MoveMake(0)==0);assert(rejects==1&&!mapCalls&&!personCalls);done();}
  else if(scenario==16){g_Persons[12].Thew=0;MoveMake(0);assert(g_Persons[12].Thew==248&&orders[0].OrderId==14);done();}
  else if(scenario==17){U32 old=baye_hd_transfer_begin(13,0);baye_hd_transfer_phase(old,6);baye_hd_transfer_retire();
   U32 fresh=baye_hd_transfer_begin(14,3),seq=g_hdTransferInputSeq;baye_hd_transfer_phase(old,8);baye_hd_transfer_person(old,12);
   baye_hd_transfer_target(old,8,5);baye_hd_transfer_amount(old,2,99);baye_hd_transfer_commit(old,1);baye_hd_transfer_end(old);
   assert(g_hdTransferSession==fresh&&g_hdTransferActive&&g_hdTransferPhase==0&&g_hdTransferInputSeq==seq&&g_hdTransferPerson==65535&&g_hdTransferTarget==255&&!g_hdTransferCommitSeq);}
  else if(scenario==18){g_hdTransferSession=g_hdTransferInputSeq=g_hdTransferCommitSeq=UINT32_MAX;
   U32 s=baye_hd_transfer_begin(13,0);assert(s==1&&g_hdTransferInputSeq==1);
   baye_hd_transfer_commit(s,1);assert(g_hdTransferCommitSeq==1);baye_hd_transfer_end(s);assert(g_hdTransferPhase==9&&!g_hdTransferActive);
   baye_hd_transfer_begin(14,0);assert(g_hdTransferCommitSeq==1&&!g_hdTransferCommitResult&&!g_hdTransferFood);}
  else if(scenario==19){U32 s=baye_hd_transfer_begin(13,0),seq=g_hdTransferInputSeq;++g_hdDetailGeneration;
   baye_hd_transfer_person(s,12);baye_hd_transfer_phase(s,8);baye_hd_transfer_commit(s,1);assert(g_hdTransferInputSeq==seq&&g_hdTransferPerson==65535&&!g_hdTransferCommitSeq);}
  else if(scenario==20||scenario==21){TransportationMake(0);cargoSuccess();driverMode=1;rngValue=scenario==20?99:20;
   TransportationDrv(&orders[0]);assert(g_Cities[8].Food==(scenario==20?7:0)&&g_Cities[8].Money==(scenario==20?5:0)&&g_Cities[8].MothballArms==(scenario==20?3:0));
   assert(g_Cities[0].Persons==3&&g_PersonsQueue[0]==12&&g_Persons[12].Arms==700);DelOrder(&orders[0]);assert(orders[0].OrderId==255);}
  else if(scenario==22){MoveMake(0);g_Cities[8].Belong=9;MoveDrv(&orders[0]);assert(g_Cities[0].Persons==3&&g_Cities[8].Persons==0);}
  else if(scenario==23){MoveMake(0);g_Cities[8].Belong=0;MoveDrv(&orders[0]);assert(g_Cities[8].Belong==7&&g_Cities[8].Persons==1&&g_PersonsQueue[g_Cities[8].PersonQueue]==12);}
  else if(scenario==24){for(unsigned i=0;i<200;i++)orders[i].OrderId=0;MoveMake(0);
   assert(g_Cities[0].Persons==3&&g_Persons[12].Thew==92&&g_Cities[0].Money==100&&addCalls==1&&fullMessages==1&&personCalls==2);
   assert(g_hdTransferCommitSeq==1&&g_hdTransferCommitResult==2);done();}
  else if(scenario==25){g_Cities[8].Belong=0;targetAnswers[1]=255;targetLength=2;MoveMake(0);
   unchanged();assert(rejects==2&&!personCalls&&!qtyCalls&&mapCalls==2);done();}
  else assert(0);puts("production transfer business and protocol passed");return 0;}
`;
let temporary,executable;
before(async()=>{temporary=mkdtempSync(join(tmpdir(),'baye-hd-transfer-'));const file=join(temporary,'transfer.c');
 executable=join(temporary,process.platform==='win32'?'transfer.exe':'transfer');writeFileSync(file,fixture);
 try{await run(process.env.CC||'cc',['-std=c99','-Wall','-Wextra',file,'-o',executable],{timeout:20000});}
 catch(error){throw new Error('Production transfer compilation failed: '+(error.stderr?.split(/\r?\n/).filter(s=>/error:|fatal error:/.test(s)).join('\n')||error.message));}});
after(()=>{if(!temporary)return;assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-transfer-'));rmSync(temporary,{recursive:true,force:true});});
const scenarios=[
 'transport observes PERSON,three zero-min/native-max quantities,target and already-debited report before the single order',
 'food EXIT returns fresh PERSON with no business change',
 'money EXIT returns FOOD then PERSON with no business change',
 'arms EXIT returns MONEY then FOOD then PERSON with no business change',
 'target EXIT returns ARMS and unwinds only through original quantities',
 'enemy target rejection retains cargo and source resident',
 'unoccupied target rejection retains cargo and source resident',
 'disconnected allied target rejection uses actual CITY_LINKR and SearchRoad',
 'full order queue records actual failure after native debit without removing actor',
 'MOVE target EXIT closes whole command before choosing a person',
 'standard MOVE keeps original cost8 compatibility behavior and unchanged cargo',
 'fixThewOverFlow MOVE uses actual LIB MOVEcost0',
 'MOVE consecutive persons share one session and produce two actual commits',
 'transport actual Thew8 gate rejects exhausted actor before quantities',
 'MOVE empty resident list retires observations without a target input',
 'legacy MOVE Thew0 remains native U8 wrap248 rather than invented clamp',
 'retired session cannot republish into a newer native transfer',
 'session/input/commit U32 wrap skips zero and next command clears only receipts',
 'detail generation changes reject suspended publishers',
 'transport delivery credits destination and only then returns carrier to origin',
 'natural transport loss preserves source debit and still returns carrier',
 'MOVE destination taken by enemy falls back to original source',
 'MOVE destination newly empty is claimed by original person belong',
 'MOVE full order queue preserves actual debit and returns fresh PERSON with rejected commit',
 'MOVE unoccupied target preserves native two-message rejection before cancellation'
];
scenarios.forEach((name,i)=>test('real C '+name,async()=>{const r=await run(executable,[String(i+1)],{timeout:20000});assert.match(r.stdout,/production transfer business and protocol passed/);}));

// Execute the production public getter, including its production double-read helpers.
const publicBridge=readFileSync(join(root,'js/bridge.js'),'utf8').replace(/\r\n/g,'\n');
const getterStart=publicBridge.indexOf('        transfer: function () {');
assert.ok(getterStart>=0);
const getter=publicBridge.slice(getterStart,publicBridge.indexOf('        qty: function () {',getterStart)).trim().replace(/^transfer:\s*/,'').replace(/,$/,'');
const vm=await import('node:vm');
function publicFixture(){
 const values={ProtocolVersion:1,Active:1,Command:13,Session:1,InputSeq:2,Phase:1,Origin:0,Target:255,Person:65535,Food:0,Money:0,Arms:0,Distance:255,CommitSeq:0,CommitResult:0};
 const data={g_hdDetailGeneration:7};for(const[key,value]of Object.entries(values))data['g_hdTransfer'+key]=value;
 const baye={data,ensureData(){return this.data;}};
 const context=vm.createContext({baye,hdNote(){},hdCityLimit(){return 38;},hdPersonLimit(){return 200;}});
 vm.runInContext(['hdIntegerValue','hdDetailNum','hdObserverReader'].map(n=>actualFunction('../../../js/bridge.js',n)).join('\n')+'\nthis.readTransfer=('+getter+');',context);
 return {data,baye,read:()=>context.readTransfer()};
}
test('public transfer accepts genuine person0 and a complete inactive receipt without fabricating missing zero fields',()=>{
 const f=publicFixture();f.data.g_hdTransferPerson={value:0};assert.equal(f.read().person,0);
 Object.assign(f.data,{g_hdTransferActive:0,g_hdTransferPhase:9,g_hdTransferCommitSeq:1,g_hdTransferCommitResult:1});
 assert.equal(f.read().commitResult,1);
});
test('public transfer rejects old engines, missing fields, NaN, wrong protocol and invalid scalar ranges',()=>{
 for(const change of[d=>delete d.g_hdTransferProtocolVersion,d=>delete d.g_hdTransferPerson,d=>{d.g_hdTransferFood=NaN;},d=>{d.g_hdTransferProtocolVersion=2;},d=>{d.g_hdTransferActive=2;},d=>{d.g_hdTransferPerson=200;},d=>{d.g_hdTransferTarget=38;},d=>{d.g_hdTransferSession=0;},d=>{d.g_hdDetailGeneration=0;}]){
  const f=publicFixture();change(f.data);assert.equal(f.read(),null);
 }
});
test('public transfer rejects mixed command/phase and unobserved departure fields',()=>{
 for(const change of[d=>{d.g_hdTransferCommand=27;},d=>{d.g_hdTransferPhase=9;},d=>{d.g_hdTransferActive=0;},d=>{d.g_hdTransferPhase=8;},d=>{d.g_hdTransferCommitResult=1;},d=>{d.g_hdTransferCommand=14;d.g_hdTransferMoney=1;}]){
  const f=publicFixture();change(f.data);assert.equal(f.read(),null);
 }
});
test('public transfer rejects torn native counters, generation and data rebinds across its complete double read',()=>{
 for(const field of['g_hdTransferInputSeq','g_hdDetailGeneration']){const f=publicFixture();let calls=0;
  Object.defineProperty(f.data,field,{get(){return ++calls===1?7:8;}});assert.equal(f.read(),null);}
 const f=publicFixture();Object.defineProperty(f.data,'g_hdTransferCommitResult',{get(){f.baye.data=Object.create(f.data);return 0;}});
 assert.equal(f.read(),null);
});
test('reset and manifest provenance explicitly include the independent transfer observer without changing MARCH protocol',()=>{
 const reset=actualFunction('hd-bridge.c','baye_hd_set_ready');assert.match(reset,/baye_hd_transfer_retire\(\)/);
 const manifest=readFileSync(join(root,'scripts/write-wasm-manifest.mjs'),'utf8');
 for(const name of['ProtocolVersion','Active','Command','Session','InputSeq','Phase','Origin','Target','Person','Food','Money','Arms','Distance','CommitSeq','CommitResult']){
  assert.match(bridge,new RegExp('DEFADDF\\(g_hdTransfer'+name+', (?:U8|U16|U32)\\)'));
  assert.ok(manifest.includes("'g_hdTransfer"+name+"'"));
 }
 assert.match(manifest,/hdTransferProtocol:\s*\{/);assert.match(manifest,/transportation: 13, move: 14/);
 assert.doesNotMatch(actualFunction('citycmdc.c','TransportationMake'),/baye_hd_march|baye_hd_set_battle_pick/);
 assert.doesNotMatch(actualFunction('citycmdc.c','MoveMake'),/baye_hd_march|baye_hd_set_battle_pick/);
});
