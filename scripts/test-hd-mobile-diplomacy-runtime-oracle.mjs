import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileDiplomacyOracleContract,getMobileDiplomacyCandidates,calculateMobileDiplomacyLimit,verifyMobileDiplomacyCommit,verifyMobileDiplomacy,verifyMobileDiplomacyCancellation} from './hd-mobile-diplomacy-runtime-oracle.mjs';
const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url)),clone=structuredClone;
// Literal recorded-world fixtures; C order fields/costs and queue layout are independently specified.
function fixture(command=16){
 const person={Belong:0,OldBelong:0,Level:1,Experience:0,IQ:60,Force:60,Age:30,Devotion:80,Character:0,Thew:70,Arms:100,ArmsType:1,Tool1:0,Tool2:0};
 const city={Belong:0,SatrapId:0,State:0,AvoidCalamity:20,PeopleDevotion:70,Commerce:100,Money:576,Food:1097,MothballArms:0,PersonQueue:8,Persons:0};
 const order={OrderId:255,City:0,Person:0,Object:0,TimeCount:0,Arms:0,Food:0,Money:0,Consume:0};
 const before={period:1,king:0,year:189,month:1,people:Array.from({length:200},()=>({...person})),cities:Array.from({length:38},()=>({...city})),
 queue:Array.from({length:2000},(_,i)=>1000+i),orders:Array.from({length:200},()=>({...order})),fighters:Array(600).fill(0),fighterIndex:Array(30).fill(0),
 config:{enable16bitConsumeMoney:0,checkRedundantOnAddPerson:1,armsPerMoney:10,armsPerDevotion:20,fixOverFlow16:1,enableCustomRatio:0,ratioOfArmsToLevel:100,ratioOfArmsToAge:10,ratioOfArmsToIQ:10,ratioOfArmsToForce:10,disableExpGrowing:0,maxLevel:255,disableAllPersonReport:0,fixAlienateComsumeThew:0}};
 before.queue.splice(0,8,0,19,23,24,25,26,1,2);for(const id of [0,19,23,24,25,26])before.people[id].Belong=1;before.people[1].Belong=2;before.people[2].Belong=2;
 before.cities[0]={...city,Belong:1,PersonQueue:0,Persons:2};for(let i=1;i<10;i++)before.cities[i].PersonQueue=2;
 before.cities[10]={...city,Belong:1,PersonQueue:2,Persons:4};for(let i=11;i<15;i++)before.cities[i].PersonQueue=6;
 before.cities[15]={...city,Belong:2,SatrapId:3,PersonQueue:6,Persons:2};
 before.orders[0]={...order,OrderId:3,City:0,Person:9};before.orders[1]={...order,OrderId:16,City:2,Person:20};
 const targetId=command===19?1:2,during=clone(before);during.cities[10].Money=526;during.people[command===15?2:23].Thew=command===19?60:50;
 const after=clone(during);after.cities[10].Persons=3;after.queue=[...before.queue.slice(0,2),...before.queue.slice(3,200),before.queue[199],...before.queue.slice(200)];
 for(let i=11;i<15;i++)after.cities[i].PersonQueue=5;after.cities[15].PersonQueue=5;for(let i=16;i<38;i++)after.cities[i].PersonQueue=7;
 after.orders[2]={...order,OrderId:command,City:10,Person:23,Object:targetId,TimeCount:10,Arms:5678,Food:4567,Money:3456,Consume:252};
 return {before,during,after,cityIndex:10,command,personId:23,targetId,libBytes};
}
for(const command of [15,16,17,19]){
 test(command+' dispatch matches full measured world and exact initialized order',()=>{const f=fixture(command),old=clone({before:f.before,during:f.during,after:f.after});const r=verifyMobileDiplomacy(f);assert.equal(r.dispatchAccepted,true);assert.equal(r.orderIndex,2);assert.equal(r.order.Object,f.targetId);assert.equal(r.order.TimeCount,10);assert.equal(r.successReportExpected,false);assert.equal(r.monthEffectsAccepted,false);assert.equal(r.fullHdAccepted,false);assert.equal(r.thew.chargedPersonId,command===15?2:23);assert.equal(r.money.cost,50);assert.deepEqual({before:f.before,during:f.during,after:f.after},old);});
 test(command+' commit phase charged costs is not yet dispatch',()=>{const r=verifyMobileDiplomacyCommit(fixture(command));assert.equal(r.commitWorldAccepted,true);assert.equal(r.dispatchAccepted,false);});
 test(command+' actor and target cancellation preserve complete measured world',()=>{const f=fixture(command);assert.equal(verifyMobileDiplomacyCancellation({before:f.before,after:clone(f.before),libBytes}).cancellationWorldUnchanged,true);assert.throws(()=>verifyMobileDiplomacyCancellation(f));});
 test(command+' full orders debit costs without removing actor',()=>{const f=fixture(command);for(const o of f.before.orders)o.OrderId=3;f.during=clone(f.before);f.during.cities[10].Money=526;f.during.people[command===15?2:23].Thew=command===19?60:50;f.after=clone(f.during);const r=verifyMobileDiplomacy({...f,outcome:'full-order'});assert.equal(r.dispatchAccepted,false);assert.equal(r.partialMutationAccepted,true);assert.throws(()=>verifyMobileDiplomacy({...f,outcome:'queued'}));});
}
test('Native target domains exclude kings from15/16, require SatrapId for17, deduplicate city kings19',()=>{const f=fixture();f.before.cities[16].Belong=2;f.before.cities[16].SatrapId=2;assert.deepEqual(getMobileDiplomacyCandidates({world:f.before,cityIndex:10,command:16,libBytes}).targets,[2]);assert.deepEqual(getMobileDiplomacyCandidates({world:f.before,cityIndex:10,command:17,libBytes}).targets,[2]);assert.deepEqual(getMobileDiplomacyCandidates({world:f.before,cityIndex:10,command:19,libBytes}).targets,[1]);});
test('Satrap source uses SatrapId-1 even if person allegiance differs, preserving native list rule',()=>{const f=fixture(17);f.before.people[2].Belong=f.during.people[2].Belong=f.after.people[2].Belong=3;assert.equal(verifyMobileDiplomacy(f).dispatchAccepted,true);});
test('Enemy person list excludes residents whose allegiance differs from city',()=>{const f=fixture();f.before.people[2].Belong=3;assert.deepEqual(getMobileDiplomacyCandidates({world:f.before,cityIndex:10,command:16,libBytes}).targets,[]);assert.throws(()=>verifyMobileDiplomacy(f));});
test('Native list order follows city then queue; no arbitrary PID sorting',()=>{const f=fixture();f.before.people[3].Belong=2;f.before.queue[8]=3;f.before.cities[16]={...f.before.cities[16],Belong:2,Persons:1,PersonQueue:8};assert.deepEqual(getMobileDiplomacyCandidates({world:f.before,cityIndex:10,command:16,libBytes}).targets,[2,3]);});
test('Legacy Alienate consumes target20 rather than actor; fix flag explicitly changes actor',()=>{const f=fixture(15);for(const w of [f.before,f.during,f.after])w.config.fixAlienateComsumeThew=1;for(const w of [f.during,f.after]){w.people[2].Thew=70;w.people[23].Thew=50;}assert.equal(verifyMobileDiplomacy(f).thew.chargedPersonId,23);});
for(const fix of [0,1])test('Low target Thew in legacy Alienate '+(fix?'saturates':'wraps')+' without adding target guard',()=>{const f=fixture(15);for(const w of [f.before,f.during,f.after])w.config.fixOverFlow16=fix;f.before.people[2].Thew=3;f.during.people[2].Thew=f.after.people[2].Thew=fix?0:239;assert.equal(verifyMobileDiplomacy(f).dispatchAccepted,true);});
test('Exactly50money and20actorThew are legal native guard boundary',()=>{const f=fixture();f.before.cities[10].Money=50;f.during.cities[10].Money=f.after.cities[10].Money=0;f.before.people[23].Thew=20;f.during.people[23].Thew=f.after.people[23].Thew=0;assert.equal(verifyMobileDiplomacy(f).dispatchAccepted,true);});
test('Queue199 and tail preserved, empty later offset wrapsU16',()=>{const f=fixture();f.before.cities[37].PersonQueue=f.during.cities[37].PersonQueue=0;f.after.cities[37].PersonQueue=65535;verifyMobileDiplomacy(f);});
test('Additional goods/tools/current fields remain exact',()=>{const f=fixture();for(const w of [f.before,f.during,f.after]){w.goodsQueue=Array(2000).fill(0);w.tools=Array.from({length:33},()=>({useflag:0,changeAttackRange:0,at:0,iq:0,move:0,arm:0}));}verifyMobileDiplomacy(f);f.after.goodsQueue[1999]=1;assert.throws(()=>verifyMobileDiplomacy(f));});
const rejects=[
 ['unsupported18',f=>f.command=18],['zero command',f=>f.command=0],['wrongLIB',f=>{f.libBytes=Buffer.from(libBytes);f.libBytes[100]^=1;}],['missing target',f=>delete f.targetId],
 ['nonplayercity',f=>f.before.cities[10].Belong=2],['actor absent',f=>f.personId=19],['actorforeign',f=>f.before.people[23].Belong=2],['actorThew19',f=>f.before.people[23].Thew=19],['money49',f=>f.before.cities[10].Money=49],
 ['friendly target',f=>f.targetId=24],['enemyking invalid16',f=>f.targetId=1],['not actual satrap',f=>{f.command=17;f.targetId=1;}],['general invalid19',f=>{f.command=19;f.targetId=2;}],
 ['wrong cost',f=>f.after.cities[10].Money++],['other city effect',f=>f.after.cities[0].Food--],['wrong actorThew',f=>f.after.people[23].Thew--],['target effect before month',f=>f.after.people[2].Devotion--],
 ['target joins before month',f=>f.after.people[2].Belong=1],['wrongOrder',f=>f.after.orders[2].OrderId=15],['target plus1',f=>f.after.orders[2].Object=3],['time interpreted as distance',f=>f.after.orders[2].TimeCount=3],
 ['wrong order actor',f=>f.after.orders[2].Person=24],['wrong order city',f=>f.after.orders[2].City=15],['notfirstfree',f=>{f.after.orders[3]=f.after.orders[2];f.after.orders[2]=clone(f.before.orders[2]);}],
 ['second new order',f=>f.after.orders[3].OrderId=16],['mask leaks old order',f=>f.after.orders[1].Consume=200],['unknown new slot field',f=>{for(const w of [f.before,f.during])w.orders[2].x=1;f.after.orders[2].x=2;}],
 ['newslotfieldadded',f=>f.after.orders[2].x=0],['uninitialized field invalidU16',f=>f.after.orders[2].Arms=65536],['notremovedactor',f=>f.after.cities[10].Persons=4],['queueunshifted',f=>f.after.queue=clone(f.before.queue)],
 ['queue199cleared',f=>f.after.queue[199]=0],['tail shifted',f=>f.after.queue[200]=f.before.queue[201]],['lateroffsetunshifted',f=>f.after.cities[37].PersonQueue=8],['earlieroffsetchanged',f=>f.after.cities[9].PersonQueue--],
 ['fighter changed',f=>f.after.fighters[0]=1],['monthadvanced',f=>f.after.month=2],['king changed',f=>f.after.king=1],['config changed',f=>f.after.config.fixAlienateComsumeThew=1],
 ['dirty flag',f=>f.before.config.fixAlienateComsumeThew=2],['missingflag',f=>delete f.before.config.fixAlienateComsumeThew],['dirty overflow',f=>f.before.config.fixOverFlow16=2],['16bitmoneyunsafeROM',f=>f.before.config.enable16bitConsumeMoney=1],
 ['sparseworld',f=>delete f.before.queue[1999]],['missingorderfield',f=>delete f.before.orders[2].Consume],['nonfinite',f=>f.before.people[0].Thew=NaN],['commit alreadyqueued',f=>f.during=clone(f.after)]
];
for(const [name,mutate] of rejects)test('Reject '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileDiplomacy(f));});
test('Limits expose actual ordered candidates and charged person without granting input/month effects',()=>{const f=fixture(15),r=calculateMobileDiplomacyLimit({world:f.before,...f});assert.equal(r.chargedPersonId,2);assert.deepEqual(r.actors,[23,24,25,26]);assert.deepEqual(r.targets,[2]);assert.equal(r.timeCountIsMonthAcceptance,false);assert.equal(mobileDiplomacyOracleContract.wholeNativeAbiAccepted,false);});
