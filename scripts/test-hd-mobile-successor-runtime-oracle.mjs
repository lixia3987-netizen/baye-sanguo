import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {campaignPreloadSampleSource} from './hd-mobile-campaign-runtime-checks.mjs';
import {mobileSuccessorCandidateIds,verifyMobileSuccessorChoice,verifyMobileSuccessorReport,verifyMobileSuccessorSettlement,verifyMobileSuccessorBattleContext,verifyMobileSuccessorReturn} from './hd-mobile-successor-runtime-oracle.mjs';

function fixture() {
  const world={period:1,king:5,people:Array.from({length:200},()=>({Belong:0})),
    cities:Array.from({length:38},()=>({Belong:0,PersonQueue:0,Persons:0})),queue:Array(2000).fill(65535)};
  // City order and resident order, not person ID order, define the picker.
  world.cities[0]={Belong:6,PersonQueue:0,Persons:3};
  world.cities[3]={Belong:6,PersonQueue:3,Persons:2};
  world.cities[8]={Belong:6,PersonQueue:5,Persons:1};
  world.cities[9]={Belong:12,PersonQueue:6,Persons:1};
  world.queue.splice(0,7,62,56,11,57,63,65,85);
  for(const id of [62,56,57,63,65])world.people[id].Belong=6;
  world.people[11].Belong=12;world.people[85].Belong=12;world.people[5].Belong=65535;
  const names=['张横','韩遂','马超','梁兴','成宜'];
  const menu={active:1,context:5,kind:1,seq:86,generation:3,detailGeneration:3,itemLen:8,
    count:5,index:2,names:names.slice(),packedNames:names.slice(),ids:[62,56,57,63,65],idsValid:true};
  return {world,menu,names};
}
test('Direct native IDs agree with independent city/resident order without name-to-ID recovery',()=>{
  const f=fixture();assert.deepEqual(mobileSuccessorCandidateIds(f.world),[62,56,57,63,65]);
  const v=verifyMobileSuccessorChoice(f);assert.equal(v.accepted,true);assert.equal(v.chosenId,57);
  assert.equal(v.chosenIndex,2);assert.equal(v.successionOutcomeAccepted,false);
});
test('Foreign resident and foreign-city people are not successor candidates',()=>{
  const f=fixture();assert.ok(!mobileSuccessorCandidateIds(f.world).includes(11));
  assert.ok(!mobileSuccessorCandidateIds(f.world).includes(85));
});
test('The native selected index chooses another actual candidate without changing order',()=>{
  const f=fixture();f.menu.index=4;assert.equal(verifyMobileSuccessorChoice(f).chosenId,65);
});
const rejects=[
  ['zero sequence',f=>{f.menu.seq=0;}],
  ['noninteger sequence',f=>{f.menu.seq=1.5;}],
  ['zero generation',f=>{f.menu.generation=f.menu.detailGeneration=0;}],
  ['stale detail generation',f=>{f.menu.detailGeneration=2;}],
  ['inactive menu',f=>{f.menu.active=0;}],
  ['wrong campaign context',f=>{f.menu.context=1;}],
  ['defender/person menu instead of successor',f=>{f.menu.kind=2;}],
  ['wrong name-slot publication',f=>{f.menu.itemLen=4;}],
  ['missing published successor',f=>{f.menu.count=4;}],
  ['out-of-range selected index',f=>{f.menu.index=5;}],
  ['incomplete menu names',f=>{f.menu.names.pop();}],
  ['changed native full name',f=>{f.names[0]='另一人物';}],
  ['wrong published native name',f=>{f.menu.names[0]='另一人物';}],
  ['empty native name',f=>{f.names[0]='';}],
  ['truncated packed name',f=>{f.menu.packedNames[0]='张';}],
  ['only 199 people',f=>{f.world.people.pop();}],
  ['only 37 cities',f=>{f.world.cities.pop();}],
  ['incomplete native queue',f=>{f.world.queue.pop();}],
  ['invalid current king',f=>{f.world.king=200;}],
  ['invalid original period',f=>{f.world.period=5;}],
  ['out-of-bounds city queue',f=>{f.world.cities[0].PersonQueue=1999;}],
  ['overlapping active queue ranges',f=>{f.world.cities[3].PersonQueue=2;}],
  ['duplicate actual resident ID',f=>{f.world.queue[3]=62;}],
  ['out-of-range resident ID',f=>{f.world.queue[0]=200;}],
  ['fractional queue ID',f=>{f.world.queue[0]=62.5;}],
  ['same names with reordered native queue',f=>{[f.world.queue[0],f.world.queue[1]]=[f.world.queue[1],f.world.queue[0]];f.names=['韩遂','张横',...f.names.slice(2)];}],
  ['candidate no longer belongs to player',f=>{f.world.people[62].Belong=12;}],
  ['city no longer belongs to player',f=>{f.world.cities[3].Belong=12;}],
  ['invalid person faction',f=>{f.world.people[62].Belong=500;}],
  ['no native candidate remains',f=>{for(const p of f.world.people)p.Belong=0;}],
  ['published IDs disagree with native order',f=>{f.menu.ids=[56,62,57,63,65];}],
  ['legacy name-only publication',f=>{f.menu.idsValid=false;f.menu.ids=[];}],
  ['truncated direct ID publication',f=>{f.menu.ids.pop();}]
];
for(const [label,mutate] of rejects)test('Reject '+label,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileSuccessorChoice(f));});

function completeFixture() {
  const f=fixture(),w=f.world;
  w.year=198;w.month=1;
  w.people=w.people.map(p=>({OldBelong:0,Level:3,Experience:8,IQ:70,Force:65,Age:30,Devotion:88,Character:1,Thew:80,Arms:100,ArmsType:0,Tool1:0,Tool2:0,...p}));
  w.people[5].OldBelong=6;w.people[5].Arms=0;
  w.cities=w.cities.map(c=>({State:0,SatrapId:0,FarmingLimit:5000,Farming:2000,CommerceLimit:5000,Commerce:2100,
    PeopleDevotion:60,AvoidCalamity:30,PopulationLimit:1000000,Population:100000,Money:300,Food:1000,MothballArms:0,ToolQueue:0,Tools:0,...c}));
  w.cities[9].Persons=2;w.queue[7]=5;
  w.orders=Array.from({length:200},()=>({OrderId:255,Person:0,City:0,Object:0,Arms:0,Food:0,Money:0,Consume:0,TimeCount:0}));
  w.orders[170]={OrderId:27,Person:0,City:8,Object:9,Arms:321,Food:505,Money:123,Consume:17,TimeCount:1};
  w.fighters=Array(600).fill(0);w.fighterIndex=Array(30).fill(0);w.goodsQueue=Array(2000).fill(0);
  w.tools=[{useflag:0,changeAttackRange:0,at:1,iq:0,move:0,arm:0}];w.config={fixOverFlow16:1,checkRedundantOnAddPerson:1};
  const choice=verifyMobileSuccessorChoice(f),during=structuredClone(w);during.king=choice.chosenId;
  const after=structuredClone(during);after.people[choice.chosenId].Devotion=100;
  for(const c of after.cities)if(c.Belong===6)c.Belong=choice.chosenId+1;
  for(const id of choice.candidateIds)after.people[id].Belong=choice.chosenId+1;
  const receipt={generation:3,oldKing:5,newKing:57,playerKing:57},report={active:1,kind:1,seq:100,inputSeq:101,text:'马超被拥立为新的君主'};
  const battle={mode:1,over:2,cityIndex:9,playerFood:400,enemyFood:1200,genArray:[6,59,0,0,0,0,0,0,0,0,86,0,0,0,0,0,0,0,0,0]};
  const returned=structuredClone(after);returned.month=2;returned.cities[1].State=3;returned.cities[9].Food=1500;returned.orders[170].OrderId=255;
  return {...f,before:w,during,after,choice,receipt,report,battle,orderIndex:170,returned,armySlot:0,committed:after};
}
test('NewKingNote has updated PlayerKing but has not yet changed ownership or devotion',()=>assert.equal(verifyMobileSuccessorReport(completeFixture()).accepted,true));
test('Synchronous completion checks every measured field and the exact inherited subset',()=>{
  const v=verifyMobileSuccessorSettlement(completeFixture());assert.deepEqual(v.cityIds,[0,3,8]);assert.deepEqual(v.personIds,[62,56,57,63,65]);
  assert.equal(v.successionOutcomeAccepted,true);assert.equal(v.randomMonthAccepted,false);
});
test('Real retreat context binds captive, winning defenders, exact order and released army',()=>assert.equal(verifyMobileSuccessorBattleContext({...completeFixture(),world:completeFixture().before}).accepted,true));
test('Terminal MAP permits separately observed random month while requiring inheritance and exact order retirement',()=>assert.equal(verifyMobileSuccessorReturn(completeFixture()).accepted,true));
for(const [label,mutate,verify]of [
  ['premature new-king devotion',f=>{f.during.people[57].Devotion=100;},verifyMobileSuccessorReport],
  ['premature city ownership',f=>{f.during.cities[0].Belong=58;},verifyMobileSuccessorReport],
  ['wrong new king report name',f=>{f.report.text='韩遂继任';},verifyMobileSuccessorReport],
  ['retired report used as active stage',f=>{f.report.active=0;},verifyMobileSuccessorReport],
  ['city outside old faction changed',f=>{f.after.cities[9].Belong=58;},verifyMobileSuccessorSettlement],
  ['foreign resident reassigned',f=>{f.after.people[11].Belong=58;},verifyMobileSuccessorSettlement],
  ['one inherited person omitted',f=>{f.after.people[65].Belong=6;},verifyMobileSuccessorSettlement],
  ['selected devotion not set to 100',f=>{f.after.people[57].Devotion=99;},verifyMobileSuccessorSettlement],
  ['old captive reassigned',f=>{f.after.people[5].Belong=58;},verifyMobileSuccessorSettlement],
  ['extra queue write',f=>{f.after.queue[1900]=2;},verifyMobileSuccessorSettlement],
  ['extra fighter byte write',f=>{f.after.fighters[599]=1;},verifyMobileSuccessorSettlement],
  ['extra order cargo write',f=>{f.after.orders[170].Money++;},verifyMobileSuccessorSettlement],
  ['early order retirement',f=>{f.after.orders[170].OrderId=255;},verifyMobileSuccessorSettlement],
  ['battlefield Food assigned before native callback',f=>{f.after.cities[9].Food=1600;},verifyMobileSuccessorSettlement],
  ['random month used as exact succession boundary',f=>{f.after.month=2;},verifyMobileSuccessorSettlement],
  ['stale native receipt generation',f=>{f.receipt.generation=2;},verifyMobileSuccessorSettlement],
  ['wrong old king receipt',f=>{f.receipt.oldKing=6;},verifyMobileSuccessorSettlement],
  ['wrong new king receipt',f=>{f.receipt.newKing=63;},verifyMobileSuccessorSettlement],
  ['wrong current player receipt',f=>{f.receipt.playerKing=63;},verifyMobileSuccessorSettlement],
  ['incomplete city ABI measurement',f=>{delete f.before.cities[0].Population;},verifyMobileSuccessorSettlement],
  ['incomplete OrderType measurement',f=>{delete f.before.orders[0].Consume;},verifyMobileSuccessorSettlement],
  ['incomplete fighter byte table',f=>{f.before.fighters.pop();},verifyMobileSuccessorSettlement],
  ['wrong natural captive OldBelong',f=>{f.before.people[5].OldBelong=12;},f=>verifyMobileSuccessorBattleContext({...f,world:f.before})],
  ['old king not captured',f=>{f.before.people[5].Belong=6;},f=>verifyMobileSuccessorBattleContext({...f,world:f.before})],
  ['winning defender absent from actual city queue',f=>{f.battle.genArray[10]=85;},f=>verifyMobileSuccessorBattleContext({...f,world:f.before})],
  ['wrong processed battle target',f=>{f.before.orders[170].Object=8;},f=>verifyMobileSuccessorBattleContext({...f,world:f.before})],
  ['army allocation still in use',f=>{f.before.fighterIndex[0]=1;},f=>verifyMobileSuccessorBattleContext({...f,world:f.before})],
  ['terminal order remains active',f=>{f.returned.orders[170].OrderId=27;},verifyMobileSuccessorReturn],
  ['terminal retired order cargo overwritten',f=>{f.returned.orders[170].Arms=0;},verifyMobileSuccessorReturn],
  ['terminal candidate loses ownership',f=>{f.returned.people[65].Belong=6;},verifyMobileSuccessorReturn],
  ['terminal inherited city loses ownership',f=>{f.returned.cities[3].Belong=6;},verifyMobileSuccessorReturn]
])test('Reject full succession '+label,()=>{const f=completeFixture();mutate(f);assert.throws(()=>verify(f));});

// A reloaded title has no active 200-person world. This path must never probe it.
function preloadFixture(load=false) {
  const identity={status:'ready',sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',byteLength:207195,generation:2};
  const menu={active:load?0:1,context:load?0:4,kind:load?0:1,seq:2,index:0,count:load?0:4};
  const record={active:load?1:0,mode:load?2:0,count:load?4:0,index:0,seq:3};
  const input=load?{type:'record',mode:2,count:4,index:0,seq:3}:{type:'menu',context:4,kind:1,count:4,index:0,seq:2};
  const data={g_hdMapPick:0,g_hdBattlePick:0,g_hdDetailGeneration:2,g_FgtParam:{Mode:0,CityIndex:0,MProvender:0,EProvender:0,GenArray:Array(20).fill(0)},g_GenPos:Array.from({length:20},()=>({x:0,y:0,hp:0,mp:0,move:0,active:0,state:0}))};
  let worldReads=0;Object.defineProperty(data,'g_Persons',{get(){worldReads++;throw Error('Unloaded people must not be sampled');}});
  const env={baye:{data,getPersonCount:()=>0,hd:{ready:()=>true,menuItems:()=>menu,report:()=>({active:0,seq:1}),fight:()=>({active:0}),record:()=>record,march:()=>({pick:0,battlePick:0})}},
    BayeHdLibIdentity:{read:()=>identity},BayeHdDialog:{debugSnapshot:()=>({})},BayeHdMobileCity:{snapshot:()=>({})},
    BayeHdSystemUi:{debugSnapshot:()=>({screen:load?'saveload':'title',open:true,showHd:true,pending:false,input})},BayeHdMobileSystem:{snapshot:()=>({active:true})},__mobileMapKeys:[],__mobileMapNativeTouches:[]};
  env.window=env;
  return {env,data,menu,record,input,identity,worldReads:()=>worldReads,run:(read='({identity:BayeHdLibIdentity.read(),keyCount:0,touchCount:0})')=>vm.runInNewContext(campaignPreloadSampleSource(read),env)};
}
test('Reloaded TITLE with personCount zero samples native/state without touching people',()=>{const f=preloadFixture(),s=f.run();assert.equal(f.env.baye.getPersonCount(),0);assert.equal(s.sampleScope,'unloaded-title');assert.equal(s.worldSampled,false);assert.equal('world' in s,false);assert.equal(f.worldReads(),0);});
test('LOAD record mode2/count4 samples only its authenticated current selector',()=>{const f=preloadFixture(true),s=f.run();assert.equal(s.sampleScope,'unloaded-load-selector');assert.equal(s.native.record.mode,2);assert.equal(f.worldReads(),0);});
test('An active MAP cannot use the unloaded sampling exception',()=>{const f=preloadFixture();f.data.g_hdMapPick=1;assert.throws(()=>f.run(),/competing/);f.menu.active=0;assert.throws(()=>f.run(),/TITLE or LOAD/);});
for(const [field,value]of [['status','pending'],['sha256','wrong'],['byteLength',414390],['generation',0]])test('Preload rejects noncurrent original identity '+field,()=>{const f=preloadFixture();f.identity[field]=value;assert.throws(()=>f.run(),/original identity/);});
test('SAVE mode and wrong LOAD count cannot bypass active world sampling',()=>{const f=preloadFixture(true);f.record.mode=1;assert.throws(()=>f.run(),/TITLE or LOAD/);f.record.mode=2;f.record.count=3;assert.throws(()=>f.run(),/TITLE or LOAD/);});
test('Preload requires same current system input owner and ready shell',()=>{const f=preloadFixture();f.input.seq++;assert.throws(()=>f.run(),/TITLE or LOAD/);f.input.seq--;f.env.BayeHdMobileSystem.snapshot=()=>({active:false});assert.throws(()=>f.run(),/competing/);});
test('Preload rejects a data rebind during state sampling even with identical primitive owner',()=>{const f=preloadFixture();assert.throws(()=>f.run('(() => {baye.data={...baye.data};return {identity:BayeHdLibIdentity.read()};})()'),/owner changed/);});
test('Preload rejects menu publication race during state sampling',()=>{const f=preloadFixture();f.env.fixtureMenu=f.menu;f.env.fixtureInput=f.input;assert.throws(()=>f.run('(() => {fixtureMenu.seq++;fixtureInput.seq++;return {identity:BayeHdLibIdentity.read()};})()'),/owner changed/);});
test('Preload rejects library generation race and busy report',()=>{const f=preloadFixture();f.env.fixtureIdentity=f.identity;assert.throws(()=>f.run('(() => {fixtureIdentity.generation++;return {identity:BayeHdLibIdentity.read()};})()'),/owner changed/);const g=preloadFixture();g.env.baye.hd.report=()=>({active:1});assert.throws(()=>g.run(),/competing/);});
