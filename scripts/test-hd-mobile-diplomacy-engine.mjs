#!/usr/bin/env node
// Compile the production diplomacy/business and publication functions. Only UI waits,
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


const thewCosts = resource(2,9), moneyCosts = resource(2,10);
assert.deepEqual([15,16,17,19].map(i=>thewCosts[i]),[20,20,20,10]);
assert.deepEqual([15,16,17,19].map(i=>moneyCosts[i]),[50,50,50,50]);
const bytes = value => [...value,0].join(',');
const defines=read('hd-bridge.h').split('\n').filter(s=>/^#define BAYE_HD_/.test(s)).join('\n');
const bridge=read('hd-bridge.c');
const globals=bridge.slice(bridge.indexOf('U8 g_hdMenuGbk['),bridge.indexOf('U8 g_hdFightActive ='))+
 bridge.slice(bridge.indexOf('U32 g_hdQtyValue ='),bridge.indexOf('U8 g_hdFightSkip ='))+
 bridge.slice(bridge.indexOf('U8 g_hdHelpProtocolVersion ='),bridge.indexOf('U8 g_hdMovieActive ='));
const orderType=/typedef struct OrderStruct[\s\S]*?\}OrderType;/.exec(read('baye/order.h'))[0];
const constants=['baye/sconst.h','baye/consdef.h','baye/order.h','baye/attribute.h'].flatMap(name=>
 read(name).split('\n').filter(s=>/^#define\s+(ALIENATE|CANVASS|COUNTERESPIONAGE|INDUCE|ORDER_MAX|IFACE_CONID|STRING_CONST|STR_NOPERSON|NOTE_STR[89]|ADD16|ASC_WID|ASC_HGT|TACTIC_ICON|ATRR_STR6[012])\b/.test(s))).join('\n');
const nativeFunctions=['hd_next_input_seq', 'hd_battle_note_notify', 'baye_hd_battle_note_retire','baye_hd_person_properties_retire','hd_goods_clear','hd_menu_ids_clear',
 'hd_help_detail_clear','hd_city_info_notify','baye_hd_city_info_retire','baye_hd_view_retire','baye_hd_mini_map_retire',
 'baye_hd_menu_scope','baye_hd_menu_scope_default','baye_hd_menu_begin','baye_hd_menu_end',
 'baye_hd_set_menu','baye_hd_set_menu_index','baye_hd_menu_ids',
 'hd_diplomacy_owner','baye_hd_diplomacy_phase','baye_hd_diplomacy_begin','baye_hd_diplomacy_actor',
 'baye_hd_diplomacy_target','baye_hd_diplomacy_commit','baye_hd_diplomacy_end','baye_hd_diplomacy_retire'];
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
typedef struct {U16 Belong,PersonQueue,Persons,Money,SatrapId;} CityType;
typedef struct {U16 Belong;U8 Thew;} PersonType;
static CityType g_Cities[CITY_MAX];static PersonType g_Persons[PERSON_COUNT];
static PersonID g_PersonsQueue[2000],shareMemory[2000];static OrderType orders[ORDER_MAX];
static U8 g_CBnkPtr,g_engineDebug;static PersonID g_PlayerKing=0;
static struct {U8 fixOverFlow16,enable16bitConsumeMoney,fixAlienateComsumeThew;} g_engineConfig;
#define SHARE_MEM shareMemory
#define ORDERQUEUE orders
static U8 actualThew[]={`+bytes(thewCosts)+`};static U8 actualMoney[]={`+bytes(moneyCosts)+String.raw`};
static U32 GamGetPersonCount(void){return PERSON_COUNT;}
static U32 baye_hd_tool_count(void){return 33;}
static void baye_hd_fight_input_begin(U8 kind){(void)kind;assert(0);}
static void baye_hd_fight_input_end(void){assert(0);}
static int SysScrollingTimerOpen(int x){return x;}
static void gam_clrlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_rect(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void GamStrShowS(int a,int b,U8*s){(void)a;(void)b;assert(s);}
static U8*ResLoadToCon(U16 id,U16 item,U8 bank){(void)bank;assert(id==IFACE_CONID);
 if(item==ConsumeThew)return actualThew;assert(item==ConsumeMoney);return actualMoney;}
`+globals+String.raw`
static U8 g_hdFightSkip,g_hdSkillActive,g_hdHelpActive,g_hdReportKind,g_hdEngineReady,hdReportDepth;
static U8 g_hdHelpGbk[BAYE_HD_HELP_MAX],g_hdReportGbk[BAYE_HD_REPORT_MAX];static U16 g_hdReportPerson;
static U8 command,scenario,hookAccepted=1;static unsigned calls,answersLength,reports,addCalls,emptyTargets;
static U16 answers[8];static U32 menuSeqs[8],inputSeqs[8],sessions[8];static U8 phases[8];
static U16 expectedTarget(void){return command==19?9:30;}
static void checkDebit(void){assert(g_Cities[0].Money==50);
 U16 target=expectedTarget();U8 cost=actualThew[command];
 assert(g_Persons[2].Thew==(command==15&&!g_engineConfig.fixAlienateComsumeThew?100:100-cost));
 assert(g_Persons[target].Thew==(command==15&&!g_engineConfig.fixAlienateComsumeThew?(U8)((scenario==11?0:100)-cost):(scenario==11?0:100)));}
static void ShowMapClear(void){}
static void ShowConstStrMsg(U8 id){assert(g_hdDiplomacyActive&&g_hdDiplomacyPhase==4);
 assert(id==NOTE_STR8||id==NOTE_STR9||id==STR_NOPERSON);assert(!g_hdDiplomacyCommitResult);++reports;}
static void GamMsgBox(U8*text,U8 delay){assert(text&&delay==1&&g_hdDiplomacyPhase==3);checkDebit();
 assert(g_Cities[0].Persons==3&&!g_hdDiplomacyCommitResult);++reports;}
static U8 canAddOrder(OrderType*order){++addCalls;assert(g_hdDiplomacyPhase==3);
 assert(order->OrderId==command&&order->Person==2&&order->City==0&&order->Object==expectedTarget()&&order->TimeCount==10);
 assert(g_hdDiplomacyActor==2&&g_hdDiplomacyTarget==expectedTarget());checkDebit();return hookAccepted;}
`+'\n'+nativeFunctions.map(n=>actualFunction('hd-bridge.c',n)).join('\n')+'\n'+
 actualFunction('gamEng.c','add_16')+'\n'+
 ['GetCityPersons','GetEnemyPersons','GetEnemySatraps','GetEnemyKing','DelPerson'].map(n=>actualFunction('cityedit.c',n)).join('\n')+'\n'+
 ['needMoney','IsMoney','OrderConsumeMoney','IsManual','OrderConsumeThew'].map(n=>actualFunction('citycmde.c',n)).join('\n')+'\n'+
 actualFunction('citycmdd.c','AddOrderHead')+String.raw`
static void baye_hd_spe_invalidate(void){}static void baye_hd_set_fight(U8 active,U8 over){(void)active;(void)over;}
static void baye_hd_march_end(U8 departed){(void)departed;}static void baye_hd_transfer_retire(void){}
static void baye_hd_qty_invalidate(void){}static void baye_hd_report_end(void){}static void baye_hd_record_end(void){}
`+actualFunction('hd-bridge.c','baye_hd_set_ready')+'\n'+actualFunction('hd-bridge.c','baye_hd_world_commit')+String.raw`
FAR PersonID ShowPersonControlInner(PersonID*ids,U32 count,PersonID initial,U8 a,U8 b,U8 c,U8 d){
 (void)a;(void)b;(void)c;(void)d;assert(initial==0&&calls<answersLength);
 assert(g_hdDiplomacyActive&&g_hdDiplomacyGeneration==7&&g_hdDiplomacyCommand==command&&g_hdDiplomacyOrigin==0);
 assert(g_hdDiplomacyPhase==1||g_hdDiplomacyPhase==2);
 if(g_hdDiplomacyPhase==1){assert(g_hdDiplomacyActor==65535&&g_hdDiplomacyTarget==65535);assert(count==2&&ids[0]==0&&ids[1]==2);}
 else{assert(g_hdDiplomacyActor==2&&g_hdDiplomacyTarget==65535);
  if(!count){++emptyTargets;assert(scenario==7&&command!=17);}
  else if(command==15||command==16){assert(count==3&&ids[0]==30&&ids[1]==32&&ids[2]==40);}
  else if(command==17){assert(count==2&&ids[0]==30&&ids[1]==32);}
  else assert(command==19&&count==2&&ids[0]==9&&ids[1]==19);
 }
 U8 names[24]={'A',0,0,0,'B',0,0,0,'C',0,0,0};
 if(count){baye_hd_set_menu(names,4,(U16)count,initial);baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,ids,count);
  assert(g_hdMenuActive&&g_hdMenuContext==1&&g_hdMenuKind==3&&g_hdMenuIdsCount==count);}
 phases[calls]=g_hdDiplomacyPhase;menuSeqs[calls]=g_hdMenuSeq;inputSeqs[calls]=g_hdDiplomacyInputSeq;sessions[calls]=g_hdDiplomacySession;
 if(calls){assert(menuSeqs[calls]==menuSeqs[calls-1]+2&&inputSeqs[calls]!=inputSeqs[calls-1]&&sessions[calls]==sessions[calls-1]);}
 U16 answer=answers[calls++];assert(answer==65535||answer<count);
 if(scenario==12)baye_hd_world_commit();return answer;
}
`+actualFunction('showface.c','ShowPersonControl')+'\n'+
 ['AlienateMake','CanvassMake','CounterespiongeMake','InduceMake','RealienateMake'].map(n=>actualFunction('citycmdc.c',n)).join('\n')+String.raw`
static void setup(void){
 for(unsigned i=0;i<38;i++)g_Cities[i].PersonQueue=9;
 for(unsigned i=0;i<2000;i++)g_PersonsQueue[i]=(PersonID)(i%200);
 memset(orders,0xa5,sizeof(orders));for(unsigned i=0;i<200;i++)orders[i].OrderId=255;
 g_Cities[0]=(CityType){.Belong=1,.PersonQueue=0,.Persons=3,.Money=100,.SatrapId=3};
 g_Cities[1]=(CityType){.Belong=10,.PersonQueue=3,.Persons=3,.SatrapId=31};
 g_Cities[2]=(CityType){.Belong=10,.PersonQueue=6,.Persons=1,.SatrapId=33};
 g_Cities[3]=(CityType){.Belong=20,.PersonQueue=7,.Persons=2,.SatrapId=20};
 U16 ids[]={0,2,4,9,30,31,32,19,40};memcpy(g_PersonsQueue,ids,sizeof(ids));
 g_Persons[0].Belong=g_Persons[2].Belong=1;g_Persons[4].Belong=65535;
 g_Persons[9].Belong=g_Persons[30].Belong=g_Persons[32].Belong=10;g_Persons[31].Belong=0;
 g_Persons[19].Belong=g_Persons[40].Belong=20;
 for(unsigned i=0;i<200;i++)g_Persons[i].Thew=100;
 g_hdDetailGeneration=7;answers[0]=1;answers[1]=0;answersLength=2;
}
static void execute(void){if(command==15)AlienateMake(0);else if(command==16)CanvassMake(0);
 else if(command==17)CounterespiongeMake(0);else{assert(command==19);InduceMake(0);}}
static void done(void){assert(!g_hdDiplomacyActive&&g_hdDiplomacyPhase==5&&g_hdDiplomacyGeneration==7);
 assert(!g_hdMenuActive&&g_hdDiplomacySession&&g_hdDiplomacyInputSeq);}
static void unchanged(void){assert(g_Cities[0].Money==(scenario==5?49:100)&&g_Cities[0].Persons==(scenario==6?0:3));
 assert(!addCalls&&!g_hdDiplomacyCommitSeq&&!g_hdDiplomacyCommitResult&&g_PersonsQueue[1]==2);}
int main(int argc,char**argv){assert(argc==3);command=(U8)strtoul(argv[1],0,10);scenario=(U8)strtoul(argv[2],0,10);setup();
 if(scenario==2){answers[0]=65535;answersLength=1;}
 if(scenario==3){answers[1]=answers[2]=65535;answersLength=3;}
 if(scenario==4){g_Persons[2].Thew=actualThew[command]-1;answers[1]=65535;}
 if(scenario==5)g_Cities[0].Money=49;
 if(scenario==6)g_Cities[0].Persons=0;
 if(scenario==7){for(unsigned i=1;i<38;i++)g_Cities[i].Belong=0;answers[1]=answers[2]=65535;answersLength=3;}
 if(scenario==8)for(unsigned i=0;i<200;i++)orders[i].OrderId=0;
 if(scenario==9)hookAccepted=0;
 if(scenario==10)g_engineConfig.fixAlienateComsumeThew=1;
 if(scenario==11)g_Persons[expectedTarget()].Thew=0;
 if(scenario==12){answers[0]=65535;answersLength=1;}
 if(scenario<=12){execute();
  if(scenario==12){assert(!g_hdDiplomacyActive&&!g_hdDiplomacyGeneration&&g_hdDiplomacyPhase==0&&g_hdDetailGeneration==8);unchanged();}
  else{done();
   if(scenario==1||scenario==10||scenario==11){checkDebit();assert(addCalls==1&&calls==2&&!reports);
    assert(g_hdDiplomacyActor==2&&g_hdDiplomacyTarget==expectedTarget()&&g_hdDiplomacyCommitResult==1&&g_hdDiplomacyCommitSeq==1);
    assert(orders[0].OrderId==command&&orders[0].Person==2&&orders[0].Object==expectedTarget());
    assert(g_Cities[0].Persons==2&&g_Cities[1].PersonQueue==2&&g_PersonsQueue[1]==4&&g_PersonsQueue[2]==9&&g_PersonsQueue[199]==199&&g_PersonsQueue[200]==0);
   }else if(scenario==8||scenario==9){checkDebit();assert(g_Cities[0].Persons==3&&g_PersonsQueue[1]==2&&addCalls==1);
    assert(g_hdDiplomacyCommitResult==2&&g_hdDiplomacyCommitSeq==1&&reports==(scenario==8));}
   else{unchanged();assert(reports==(scenario==4||scenario==5||scenario==6));
    if(scenario==3)assert(calls==3&&phases[0]==1&&phases[1]==2&&phases[2]==1&&g_hdDiplomacyActor==65535);
    if(scenario==7)assert(calls==(command==17?1:3)&&emptyTargets==(command==17?0:1));}
  }
 }else if(scenario==13){U32 old=baye_hd_diplomacy_begin(command,0);baye_hd_diplomacy_phase(old,1);baye_hd_diplomacy_actor(old,2);
  baye_hd_diplomacy_retire();U32 fresh=baye_hd_diplomacy_begin(19,3),seq=g_hdDiplomacyInputSeq;
  baye_hd_diplomacy_phase(old,2);baye_hd_diplomacy_actor(old,2);baye_hd_diplomacy_target(old,9);
  baye_hd_diplomacy_commit(old,1);baye_hd_diplomacy_end(old);
  assert(g_hdDiplomacySession==fresh&&g_hdDiplomacyActive&&g_hdDiplomacyPhase==0&&g_hdDiplomacyInputSeq==seq&&g_hdDiplomacyActor==65535&&!g_hdDiplomacyCommitSeq);
 }else if(scenario==14){U32 s=baye_hd_diplomacy_begin(command,0),seq=g_hdDiplomacyInputSeq;++g_hdDetailGeneration;
  baye_hd_diplomacy_phase(s,1);baye_hd_diplomacy_actor(s,2);baye_hd_diplomacy_target(s,9);baye_hd_diplomacy_commit(s,1);baye_hd_diplomacy_end(s);
  assert(g_hdDiplomacyActive&&g_hdDiplomacyInputSeq==seq&&g_hdDiplomacyActor==65535&&!g_hdDiplomacyCommitSeq);
 }else if(scenario==15){g_hdDiplomacySession=g_hdDiplomacyInputSeq=g_hdDiplomacyCommitSeq=UINT32_MAX;
  U32 s=baye_hd_diplomacy_begin(command,0);assert(s==1&&g_hdDiplomacyInputSeq==1);baye_hd_diplomacy_phase(s,1);baye_hd_diplomacy_actor(s,2);
  baye_hd_diplomacy_phase(s,2);baye_hd_diplomacy_target(s,9);baye_hd_diplomacy_phase(s,3);baye_hd_diplomacy_commit(s,1);
  assert(g_hdDiplomacyCommitSeq==1);baye_hd_diplomacy_end(s);baye_hd_diplomacy_begin(command,0);
  assert(g_hdDiplomacyCommitSeq==1&&!g_hdDiplomacyCommitResult&&g_hdDiplomacyActor==65535);
 }else if(scenario==16){assert(!baye_hd_diplomacy_begin(18,0)&&!baye_hd_diplomacy_begin(15,38));
  assert(RealienateMake(0)==1&&!g_hdDiplomacyActive&&!g_hdDiplomacySession&&!calls&&!addCalls);
 }else assert(0);puts("production diplomacy business and protocol passed");return 0;}
`;
let temporary,executable;
before(async()=>{temporary=mkdtempSync(join(tmpdir(),'baye-hd-diplomacy-'));const file=join(temporary,'diplomacy.c');
 executable=join(temporary,process.platform==='win32'?'diplomacy.exe':'diplomacy');writeFileSync(file,fixture);
 try{await run(process.env.CC||'cc',['-std=c99','-Wall','-Wextra',file,'-o',executable],{timeout:20000});}
 catch(error){throw new Error('Production diplomacy compilation failed: '+(error.stderr?.split(/\r?\n/).filter(s=>/error:|fatal error:/.test(s)).join('\n')||error.message));}});
after(()=>{if(!temporary)return;assert.equal(dirname(resolve(temporary)),resolve(tmpdir()));assert.ok(basename(temporary).startsWith('baye-hd-diplomacy-'));rmSync(temporary,{recursive:true,force:true});});
const scenarios=['single exact order and native costs/DelPerson only after AddOrderHead',
 'actor EXIT without world mutation','target EXIT returns fresh ACTOR, cleared roles and next full publication',
 'fatigued actor gets original rejection then fresh ACTOR','initial insufficient money gets original rejection before PERSON',
 'empty own resident list gets original no-person report','empty command-specific target list preserves native cancellation/no-report behavior',
 'full queue preserves already-debited money/Thew and resident actor with failed receipt',
 'existing canAddOrder hook rejection remains one call and failed receipt without invented report',
 'fixAlienateComsumeThew retains native actor-cost compatibility','target zero Thew retains original U8 underflow only for legacy Alienate',
 'real world_commit invalidates suspended stack publication'];
for(const command of [15,16,17,19])scenarios.forEach((name,i)=>test('real C '+command+' '+name,async()=>{
 const r=await run(executable,[String(command),String(i+1)],{timeout:20000});assert.match(r.stdout,/production diplomacy business and protocol passed/);
}));
for(const [scenario,name]of [[13,'retired session cannot publish into fresh diplomacy'],[14,'generation mismatch rejects suspended publishers'],
 [15,'U32 session/input/commit wrap skips zero and next begin resets receipt'],[16,'invalid command/origin and untouched real counter-alienate no-op']])
 test('real C '+name,async()=>{const r=await run(executable,['15',String(scenario)],{timeout:20000});assert.match(r.stdout,/production diplomacy business and protocol passed/);});

// Exercise the actual production getter and its actual stable-read helpers.
const publicBridge=readFileSync(join(root,'js/bridge.js'),'utf8').replace(/\r\n/g,'\n');
const getterStart=publicBridge.indexOf('        diplomacy: function () {');assert.ok(getterStart>=0);
const getter=publicBridge.slice(getterStart,publicBridge.indexOf('        transfer: function () {',getterStart)).trim().replace(/^diplomacy:\s*/,'').replace(/,$/,'');
const vm=await import('node:vm');
function publicFixture(persons=200){const values={ProtocolVersion:1,Active:1,Command:16,Phase:1,Session:1,InputSeq:2,
 Generation:7,Origin:0,Actor:65535,Target:65535,CommitSeq:0,CommitResult:0};
 const data={g_hdDetailGeneration:7};for(const[k,v]of Object.entries(values))data['g_hdDiplomacy'+k]=v;
 const baye={data,ensureData(){return this.data;}};
 const context=vm.createContext({baye,hdNote(){},hdCityLimit(){return 38;},hdPersonLimit(){return persons;}});
 vm.runInContext(['hdIntegerValue','hdDetailNum','hdObserverReader'].map(n=>actualFunction('../../../js/bridge.js',n)).join('\n')+'\nthis.readDiplomacy=('+getter+');',context);
 return {data,baye,read:()=>context.readDiplomacy()};}
test('public diplomacy accepts actor/target person0, complete failed receipt and explicit retired engine',()=>{
 const f=publicFixture();assert.equal(f.read().phase,1);Object.assign(f.data,{g_hdDiplomacyPhase:2,g_hdDiplomacyActor:{value:0}});
 assert.equal(f.read().actor,0);Object.assign(f.data,{g_hdDiplomacyActive:0,g_hdDiplomacyPhase:5,g_hdDiplomacyTarget:0,g_hdDiplomacyCommitSeq:1,g_hdDiplomacyCommitResult:2});
 assert.equal(f.read().commitResult,2);f.data.g_hdDetailGeneration=8;assert.equal(f.read().generation,7); // Receipt, never a live owner.
 Object.assign(f.data,{g_hdDiplomacyCommand:0,g_hdDiplomacyPhase:0,g_hdDiplomacyGeneration:0,g_hdDiplomacyOrigin:255,g_hdDiplomacyActor:65535,g_hdDiplomacyTarget:65535,g_hdDiplomacyCommitResult:0});
 assert.equal(f.read().active,0);
});
test('public diplomacy rejects each missing field rather than manufacturing person0 or inactive',()=>{
 for(const field of ['ProtocolVersion','Active','Command','Phase','Session','InputSeq','Generation','Origin','Actor','Target','CommitSeq','CommitResult']){
  const f=publicFixture();delete f.data['g_hdDiplomacy'+field];assert.equal(f.read(),null,field);}
});
test('public diplomacy rejects malformed ranges, unsupported18, stale generation and role contamination',()=>{
 const invalid={ProtocolVersion:2,Active:2,Command:18,Phase:6,Session:0,InputSeq:0,Generation:6,Origin:38,
 Actor:200,Target:200,CommitSeq:NaN,CommitResult:3};
 for(const[field,value]of Object.entries(invalid)){const f=publicFixture();f.data['g_hdDiplomacy'+field]=value;assert.equal(f.read(),null,field);}
 for(const change of [{Phase:1,Actor:0},{Phase:1,Target:0},{Phase:2},{Phase:2,Actor:0,Target:0},
  {Phase:3,Actor:0},{Phase:3,Target:0},{CommitSeq:0,CommitResult:1},{Active:0,Phase:1},{Active:1,Phase:5}]){
  const f=publicFixture();for(const[k,v]of Object.entries(change))f.data['g_hdDiplomacy'+k]=v;assert.equal(f.read(),null);}
});
test('public diplomacy rejects torn raw fields and data object rebinding during scalar getters',()=>{
 for(const rebind of [false,true]){const f=publicFixture();Object.defineProperty(f.data,'g_hdDiplomacyActor',{get(){
  if(rebind)f.baye.data={...f.data,g_hdDiplomacyActor:65535};else f.data.g_hdDiplomacyInputSeq++;return 65535;}});
  assert.equal(f.read(),null);}
});

test('public diplomacy preserves actual U16 IDs above255 when the current native person capacity allows them',()=>{
 const f=publicFixture(2000);Object.assign(f.data,{g_hdDiplomacyPhase:2,g_hdDiplomacyActor:1300});
 assert.equal(f.read().actor,1300);Object.assign(f.data,{g_hdDiplomacyPhase:3,g_hdDiplomacyTarget:1500});
 assert.equal(f.read().target,1500);f.data.g_hdDiplomacyTarget=2000;assert.equal(f.read(),null);
});
