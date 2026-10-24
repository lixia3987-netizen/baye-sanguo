import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileDefenderContract,verifyMobileDefenderPicker,verifyMobileDefenderSelection,verifyMobileDefenderBattle} from './hd-mobile-defender-runtime-oracle.mjs';

const clone=v=>structuredClone(v),next=v=>v===0xffffffff?1:v+1;
const allNames=Array.from({length:200},(_,i)=>'人物'+i);
allNames[27]='高顺';allNames[29]='牛辅';allNames[0]='刘备';
function fixture(){
  const people=Array.from({length:200},()=>({Belong:0,OldBelong:0,Level:3,Experience:8,IQ:70,Force:65,Age:30,Devotion:88,Character:1,Thew:80,Arms:100,ArmsType:0,Tool1:0,Tool2:0}));
  for(const id of [5,22,27,29])people[id].Belong=6;for(const id of [11,30,32,37])people[id].Belong=12;
  const city={State:0,Belong:0,SatrapId:0,FarmingLimit:5000,Farming:2000,CommerceLimit:5000,Commerce:2100,
    PeopleDevotion:60,AvoidCalamity:30,PopulationLimit:1000000,Population:100000,Money:300,Food:1200,MothballArms:500,PersonQueue:6,Persons:0,ToolQueue:0,Tools:0};
  const cities=Array.from({length:38},()=>({...city}));
  cities[0]={...city,Belong:6,PersonQueue:0,Persons:2};cities[1]={...city,Belong:6,PersonQueue:2,Persons:3};
  cities[2]={...city,Belong:12,PersonQueue:5,Persons:1};
  const queue=Array.from({length:2000},(_,i)=>500+i);queue.splice(0,6,5,22,27,11,29,30);queue[199]=65123;
  const orders=Array.from({length:200},()=>({OrderId:255,Person:0,City:0,Object:0,Arms:0,Food:0,Money:0,Consume:0,TimeCount:0}));
  orders[170]={OrderId:27,Person:3,City:9,Object:1,Arms:321,Food:700,Money:123,Consume:17,TimeCount:9};
  const fighters=Array(600).fill(0);fighters[60]=38;fighters[62]=33;
  const world={period:1,year:198,month:1,king:5,people,cities,queue,orders,fighters,fighterIndex:Array(30).fill(0),goodsQueue:Array(2000).fill(0),
    tools:[{useflag:0,changeAttackRange:0,at:1,iq:0,move:0,arm:0}],config:{fixOverFlow16:1,checkRedundantOnAddPerson:1}};
  const ids=[27,29],names=ids.map(id=>allNames[id]);
  const menu={active:1,context:5,kind:2,seq:86,generation:3,detailGeneration:3,itemLen:8,count:2,index:0,names:names.slice(),packedNames:names.slice(),ids,idsValid:true};
  const native={detailGeneration:3,keys:100,touches:0,menu,report:{active:0,seq:20,inputSeq:22},fight:{active:0,over:2,skip:3},march:{phase:7,session:5,inputSeq:7},
    battle:{mode:0,over:2,cityIndex:1,playerFood:1200,enemyFood:700,mainGenIndex:0,genArray:[0,0,0,0,0,0,0,0,0,0,38,33,0,0,0,0,0,0,0,0],
      positions:Array.from({length:20},()=>({x:7,y:8,hp:300,mp:420,move:4,active:1,state:2}))}};
  return {world,native,names};
}
function selectFixture(before=fixture(),chosenIndex=1){
  const after=clone(before),id=before.native.menu.ids[chosenIndex],c=after.world.cities[1],at=before.world.queue.indexOf(id,c.PersonQueue);
  after.world.queue=before.world.queue.slice(0,at).concat(before.world.queue.slice(at+1,200),[before.world.queue[199]],before.world.queue.slice(200));
  c.Persons--;for(let i=2;i<38;i++)after.world.cities[i].PersonQueue--;
  const slot=before.native.battle.genArray.slice(0,10).filter(Boolean).length;after.native.battle.genArray[slot]=id+1;
  const ids=after.world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(pid=>after.world.people[pid].Belong===c.Belong),names=ids.map(pid=>allNames[pid]);
  after.native.menu={...after.native.menu,seq:next(next(before.native.menu.seq)),index:0,count:ids.length,ids,names,packedNames:names.slice()};
  after.native.keys+=Math.abs(chosenIndex-before.native.menu.index)+1;after.names=names;
  return {before,after,chosenIndex};
}
function battleFixture(){
  const selected=selectFixture(),before=selected.after,after=clone(before),n=after.native;
  n.keys++;n.menu={...n.menu,active:0,context:0,kind:0,seq:next(next(next(n.menu.seq))),ids:[],idsValid:false};
  n.fight={active:1,over:0,wait:1,phase:1,inputKind:1,inputSeq:120,actorIndex:255,skip:3,cityIndex:1,mapW:20,mapH:20,bout:1};
  n.battle.over=0;n.battle.mainGenIndex=10;
  n.battle.positions=n.battle.genArray.map((token,slot)=>({x:slot%10,y:Math.floor(slot/10),hp:token?Math.floor((52+21+3)*80/100):300,mp:token?70:420,move:4,active:0,state:token?0:8}));
  return {before,after};
}

test('Contract is defender-specific and has no source-test/actual or outcome acceptance',()=>{
  assert.equal(mobileDefenderContract.kind,2);assert.equal(mobileDefenderContract.totalSlots,20);
  const v=verifyMobileDefenderPicker(fixture());assert.equal(v.actualInputAccepted,false);assert.equal(v.battleAccepted,false);
});
test('Direct IDs equal the target city resident order, excluding its foreign resident',()=>{
  const v=verifyMobileDefenderPicker(fixture());assert.deepEqual(v.candidateIds,[27,29]);assert.deepEqual(v.selectedIds,[]);
  assert.equal(v.orderIndex,170);assert.equal(v.armySlot,3);assert.equal(v.incomingOrder.TimeCount,9);
});
test('Actual incoming order is derived from all ten LE-U16 tokens, not legal TimeCount zero or a local variable',()=>{
  const f=fixture();f.world.orders[170].TimeCount=255;
  assert.equal(verifyMobileDefenderPicker(f).incomingOrder.TimeCount,255);
});
test('Person ID zero is a valid directly published defender',()=>{
  const f=fixture();f.world.queue[2]=0;f.world.people[0].Belong=6;f.native.menu.ids[0]=0;f.names[0]='刘备';f.native.menu.names[0]='刘备';f.native.menu.packedNames[0]='刘备';
  assert.deepEqual(verifyMobileDefenderPicker(f).candidateIds,[0,29]);
});
test('A zero-Arms resident remains a real candidate; the picker adds no invented military filter',()=>{
  const f=fixture();f.world.people[27].Arms=0;assert.deepEqual(verifyMobileDefenderPicker(f).candidateIds,[27,29]);
});
test('Single non-first selection appends ID+1 and performs exactly native DelPerson',()=>{
  const f=selectFixture(),v=verifyMobileDefenderSelection(f);assert.equal(v.chosenId,29);assert.equal(v.absoluteQueueIndex,4);assert.deepEqual(v.selectedIds,[29]);assert.deepEqual(v.remainingIds,[27]);
  assert.equal(f.after.world.queue[198],f.before.world.queue[199]);assert.equal(f.after.world.queue[199],65123);
  assert.deepEqual(f.after.world.queue.slice(200),f.before.world.queue.slice(200));assert.equal(v.battleAccepted,false);
});
test('Every later city index shifts even if its offset is not greater than the selected city offset',()=>{
  const f=selectFixture();f.before.world.cities[37].PersonQueue=1;f.after.world.cities[37].PersonQueue=0;
  assert.equal(verifyMobileDefenderSelection(f).accepted,true);
});
test('Fresh defender owner uses skip-zero U32 menu end plus begin',()=>{
  const before=fixture();before.native.menu.seq=0xffffffff;
  const f=selectFixture(before);assert.equal(f.after.native.menu.seq,2);assert.equal(verifyMobileDefenderSelection(f).accepted,true);
});
test('Arrows start at the actual current native focus index, not always row zero',()=>{
  const before=fixture();before.native.menu.index=1;
  const f=selectFixture(before);assert.equal(f.after.native.keys-before.native.keys,1);assert.equal(verifyMobileDefenderSelection(f).accepted,true);
});
test('Repeated selections use each fresh shrinking native list and preserve ordered formation tokens',()=>{
  const base=fixture();base.world.people[11].Belong=6;const ids=[27,11,29],names=ids.map(id=>allNames[id]);
  base.native.menu={...base.native.menu,ids,names,packedNames:names.slice(),count:3};base.names=names;
  const first=selectFixture(base,2);assert.equal(verifyMobileDefenderSelection(first).chosenId,29);
  const second=selectFixture(first.after,1),v=verifyMobileDefenderSelection(second);
  assert.deepEqual(v.selectedIds,[29,11]);assert.deepEqual(v.remainingIds,[27]);
  assert.deepEqual(second.after.native.battle.genArray.slice(0,3),[30,12,0]);
});
test('First defensive PICK after one EXIT preserves the complete selected world and enemy ten slots',()=>{
  const v=verifyMobileDefenderBattle(battleFixture());assert.equal(v.accepted,true);assert.deepEqual(v.selectedIds,[29]);assert.equal(v.mainGenIndex,10);assert.equal(v.measuredWorldUnchanged,true);assert.equal(v.battleOutcomeAccepted,false);
});
test('Old nonzero fight.skip is retained diagnostic, not a false rejection of a current genuine PICK',()=>{
  const f=battleFixture();f.after.native.fight.skip=4;assert.equal(verifyMobileDefenderBattle(f).retainedFightSkip,4);
});
test('EXIT battle menu retirement counts three real end calls and skips U32 zero',()=>{
  const f=battleFixture();f.before.native.menu.seq=0xfffffffe;f.after.native.menu.seq=2;assert.equal(verifyMobileDefenderBattle(f).accepted,true);
});
test('Native U16 HP/MP observations above 255 are accepted at a picker',()=>{
  const f=fixture();f.native.battle.positions[0].hp=900;f.native.battle.positions[0].mp=800;assert.equal(verifyMobileDefenderPicker(f).accepted,true);
});

const pickerRejects=[
 ['successor kind',f=>{f.native.menu.kind=1;}],['ordinary CITY context',f=>{f.native.menu.context=1;}],
 ['inactive menu',f=>{f.native.menu.active=0;}],['zero menu sequence',f=>{f.native.menu.seq=0;}],
 ['stale detail generation',f=>{f.native.menu.detailGeneration=2;}],['stale menu generation',f=>{f.native.menu.generation=2;}],
 ['incomplete IDs owner',f=>{f.native.menu.idsValid=false;}],['reordered published IDs',f=>{f.native.menu.ids.reverse();}],
 ['wrong ID domain',f=>{f.native.menu.ids[0]=200;}],['truncated list',f=>{f.native.menu.count=1;}],
 ['wrong selected index',f=>{f.native.menu.index=2;}],['packed name truncation',f=>{f.native.menu.packedNames[0]='高';}],
 ['full native name disagreement',f=>{f.names[0]='另一个人';}],['wrong item length',f=>{f.native.menu.itemLen=4;}],
 ['competing report',f=>{f.native.report.active=1;}],['fight already active',f=>{f.native.fight.active=1;}],
 ['attacking mode',f=>{f.native.battle.mode=1;}],['city no longer player owned',f=>{f.world.cities[1].Belong=12;}],
 ['incorrect city grain copy',f=>{f.native.battle.playerFood--;}],['incorrect army grain copy',f=>{f.native.battle.enemyFood--;}],
 ['no incoming commander',f=>{f.native.battle.genArray[10]=0;}],['same-faction incoming army',f=>{f.world.people[37].Belong=6;}],
 ['reused enemy token',f=>{f.native.battle.genArray[11]=38;}],['hole in selected prefix',f=>{f.native.battle.genArray[1]=28;}],
 ['selected defender still resident',f=>{f.native.battle.genArray[0]=28;}],
 ['no matching current Order27',f=>{f.world.orders[170].OrderId=255;}],['wrong target order',f=>{f.world.orders[170].Object=2;}],
 ['ambiguous current orders',f=>{f.world.orders[171]=clone(f.world.orders[170]);}],
 ['unreleased army flag',f=>{f.world.fighterIndex[3]=1;}],['wrong final enemy zero slot',f=>{f.world.fighters[78]=1;}],
 ['one-based fighter offset error',f=>{f.world.fighters[60]=37;}],['invalid army slot',f=>{f.world.orders[170].Person=30;}],
 ['truncated world queue',f=>{f.world.queue.pop();}],['sparse measured queue',f=>{delete f.world.queue[1900];}],
 ['sparse fighters',f=>{delete f.world.fighters[599];}],['out of range active resident',f=>{f.world.queue[5]=200;}],
 ['overlapping resident ranges',f=>{f.world.cities[2].PersonQueue=4;}],['missing full city field',f=>{delete f.world.cities[1].FarmingLimit;}],
 ['missing full order field',f=>{delete f.world.orders[199].Consume;}],['missing full person field',f=>{delete f.world.people[199].Thew;}],
 ['missing actual main commander',f=>{delete f.native.battle.mainGenIndex;}],['only nineteen position slots',f=>{f.native.battle.positions.pop();}],
 ['invalid HP U16',f=>{f.native.battle.positions[0].hp=65536;}],['fractional move',f=>{f.native.battle.positions[0].move=1.5;}]
];
for(const [label,change]of pickerRejects)test('Picker rejects '+label,()=>{const f=fixture();change(f);assert.throws(()=>verifyMobileDefenderPicker(f));});
const selectionRejects=[
 ['wrong chosen row',f=>{f.chosenIndex=2;}],['wrong one-based formation token',f=>{f.after.native.battle.genArray[0]=29;}],
 ['changed enemy ten slots',f=>{f.after.native.battle.genArray[19]=1;}],['altered money',f=>{f.after.world.cities[1].Money--;}],
 ['altered food',f=>{f.after.world.cities[1].Food--;}],['altered person Arms',f=>{f.after.world.people[29].Arms--;}],
 ['altered arbitrary order cargo',f=>{f.after.world.orders[199].Money++;}],['uninitialized order field wrongly cleared',f=>{f.after.world.orders[170].Consume=0;}],
 ['incorrectly cleared queue199',f=>{f.after.world.queue[199]=0;}],['changed queue tail200',f=>{f.after.world.queue[200]++;}],
 ['shifted city before target',f=>{f.after.world.cities[0].PersonQueue=1;}],['unshifted later empty city',f=>{f.after.world.cities[37].PersonQueue++;}],
 ['no resident count decrement',f=>{f.after.world.cities[1].Persons++;}],['selected still listed',f=>{f.after.native.menu.ids[0]=29;}],
 ['same retired menu sequence',f=>{f.after.native.menu.seq=f.before.native.menu.seq;}],['only one sequence increment',f=>{f.after.native.menu.seq=f.before.native.menu.seq+1;}],
 ['extra key',f=>{f.after.native.keys++;}],['missing focus arrow',f=>{f.after.native.keys--;}],
 ['native LCD touch',f=>{f.after.native.touches++;}],['changed detail generation',f=>{f.after.native.detailGeneration++;}],
 ['old position mutated before battle',f=>{f.after.native.battle.positions[0].hp++;}]
];
for(const [label,change]of selectionRejects)test('Selection rejects '+label,()=>{const f=selectFixture();change(f);assert.throws(()=>verifyMobileDefenderSelection(f));});
const battleRejects=[
 ['attacker mode',f=>{f.after.native.battle.mode=1;}],['wrong commander side',f=>{f.after.native.battle.mainGenIndex=0;}],
 ['missing one finish key',f=>{f.after.native.keys--;}],['extra action key',f=>{f.after.native.keys++;}],['native LCD input',f=>{f.after.native.touches++;}],
 ['old picker still open',f=>{f.after.native.menu.active=1;}],['old IDs retained',f=>{f.after.native.menu.ids=[27];}],
 ['only one menu retirement increment',f=>{f.after.native.menu.seq=f.before.native.menu.seq+1;}],
 ['fight inactive',f=>{f.after.native.fight.active=0;}],['not waiting',f=>{f.after.native.fight.wait=0;}],
 ['MOVE phase',f=>{f.after.native.fight.phase=2;}],['ACTION input kind',f=>{f.after.native.fight.inputKind=3;}],
 ['actual actor instead of PICK sentinel',f=>{f.after.native.fight.actorIndex=0;}],['zero PICK sequence',f=>{f.after.native.fight.inputSeq=0;}],
 ['later bout with possible AI effects',f=>{f.after.native.fight.bout=2;}],['competing report',f=>{f.after.native.report.active=1;}],
 ['already over',f=>{f.after.native.battle.over=2;}],['formation reordered',f=>{[f.after.native.battle.genArray[10],f.after.native.battle.genArray[11]]=[33,38];}],
 ['grain consumed',f=>{f.after.native.battle.playerFood--;}],['wrong initial HP',f=>{f.after.native.battle.positions[0].hp++;}],
 ['old state on empty slot',f=>{f.after.native.battle.positions[1].state=0;}],['old occupied state',f=>{f.after.native.battle.positions[0].state=1;}],
 ['old active state',f=>{f.after.native.battle.positions[0].active=1;}],['off-map initialization',f=>{f.after.native.battle.positions[0].x=20;}],
 ['init upgrade outside scope',f=>{f.before.world.people[29].Experience=f.after.world.people[29].Experience=100;}],
 ['init zero-arms death outside scope',f=>{f.before.world.people[29].Arms=f.after.world.people[29].Arms=0;}],
 ['init zero-HP death outside scope',f=>{f.before.world.people[29].Thew=f.after.world.people[29].Thew=0;}],
 ['changed city ownership',f=>{f.after.world.cities[1].Belong=12;}],['changed unrelated person',f=>{f.after.world.people[199].Devotion++;}],
 ['changed order retirement',f=>{f.after.world.orders[170].OrderId=255;}],['changed fighter bytes',f=>{f.after.world.fighters[599]=1;}],
 ['changed date',f=>{f.after.world.month=2;}],['changed config',f=>{f.after.world.config.fixOverFlow16=0;}],
 ['zero defenders finish cannot qualify a normal battle',f=>{f.before.native.battle.genArray[0]=f.after.native.battle.genArray[0]=0;}]
];
for(const [label,change]of battleRejects)test('Battle entry rejects '+label,()=>{const f=battleFixture();change(f);assert.throws(()=>verifyMobileDefenderBattle(f));});
