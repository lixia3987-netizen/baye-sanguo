import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMobileDefenderFinalSelection,verifyMobileDefenderSelection,verifyMobileDefenderBattle} from './hd-mobile-defender-runtime-oracle.mjs';

// Controlled native-shaped samples only: no files/browser/game/actual credit.
// Source lifecycle: BattleDrv citycmdd.c:316-339; ShowPersonControl
// showface.c:852-859,872-873; hd-bridge.c:1541-1569,1752-1757;
// GamFight Fight.c:79-86. Empty next picker contributes begin+end even at0.
const clone=v=>structuredClone(v),next=v=>v===0xffffffff?1:v+1;
function fixture({selected=[33],candidates=[29],seq=86,focus=0}={}){
  const people=Array.from({length:200},()=>({Belong:0,OldBelong:0,Level:3,Experience:8,IQ:70,Force:65,Age:30,Devotion:88,Character:1,Thew:80,Arms:100,ArmsType:0,Tool1:0,Tool2:0}));
  for(const id of [...selected,...candidates])people[id].Belong=1;people[63].Belong=2;
  const city={State:0,Belong:0,SatrapId:0,FarmingLimit:5000,Farming:2000,CommerceLimit:5000,Commerce:2100,PeopleDevotion:60,AvoidCalamity:30,PopulationLimit:1000000,Population:100000,Money:300,Food:1200,MothballArms:500,PersonQueue:0,Persons:0,ToolQueue:0,Tools:0};
  const raw=[...candidates,175],cities=Array.from({length:38},(_,i)=>({...city,PersonQueue:i>4?raw.length:0}));cities[4]={...city,Belong:1,PersonQueue:0,Persons:raw.length};
  const queue=Array.from({length:2000},(_,i)=>500+i);queue.splice(0,raw.length,...raw);queue[199]=65123;
  const orders=Array.from({length:200},()=>({OrderId:255,Person:0,City:0,Object:0,Arms:0,Food:0,Money:0,Consume:0,TimeCount:0}));orders[171]={OrderId:27,Person:3,City:10,Object:4,Arms:321,Food:700,Money:123,Consume:17,TimeCount:0};
  const fighters=Array(600).fill(0);fighters[60]=64;
  const world={period:4,year:237,month:3,king:0,people,cities,queue,orders,fighters,fighterIndex:Array(30).fill(0),goodsQueue:Array(2000).fill(0),tools:[{useflag:0,changeAttackRange:0,at:1,iq:0,move:0,arm:0}],config:{fixOverFlow16:1,checkRedundantOnAddPerson:1}};
  const names=candidates.map(id=>id===33?'张郃':id===29?'崔琰':'人物'+id),native={detailGeneration:3,keys:100,touches:0,menu:{active:1,context:5,kind:2,seq,generation:3,detailGeneration:3,itemLen:8,count:candidates.length,index:focus,names,packedNames:names.slice(),ids:candidates.slice(),idsValid:true},report:{active:0,seq:20,inputSeq:22},fight:{active:0,over:2,skip:3},march:{phase:7,session:5,inputSeq:7},battle:{mode:0,over:2,cityIndex:4,playerFood:1200,enemyFood:700,mainGenIndex:0,genArray:[...selected.map(id=>id+1),...Array(10-selected.length).fill(0),64,...Array(9).fill(0)],positions:Array.from({length:20},()=>({x:7,y:8,hp:300,mp:420,move:4,active:1,state:2}))}};
  return {world,native};
}
function finalFixture(options={},chosenIndex=0){
  const before=fixture(options),after=clone(before),id=before.native.menu.ids[chosenIndex],c=after.world.cities[4],at=c.PersonQueue+before.world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).indexOf(id);
  for(let i=at;i<199;i++)after.world.queue[i]=before.world.queue[i+1];c.Persons--;for(let i=5;i<38;i++)after.world.cities[i].PersonQueue--;
  const selected=before.native.battle.genArray.slice(0,10).filter(Boolean).length;after.native.battle.genArray[selected]=id+1;after.native.keys+=Math.abs(chosenIndex-before.native.menu.index)+1;
  let seq=before.native.menu.seq;for(let i=0;i<(selected+1===10?3:5);i++)seq=next(seq);
  after.native.menu={...after.native.menu,active:0,context:0,kind:0,seq,ids:[],idsValid:false};
  after.native.fight={active:1,over:0,wait:1,phase:1,inputKind:1,inputSeq:120,actorIndex:255,skip:3,cityIndex:4,mapW:32,mapH:32,bout:1};
  after.native.battle.over=0;after.native.battle.mainGenIndex=10;
  after.native.battle.positions=after.native.battle.genArray.map((token,slot)=>{const p=token?before.world.people[token-1]:null,hp=p?Math.floor((Math.floor(p.Force*80/100)+Math.floor(p.IQ*30/100)+p.Level)*p.Thew/100):300;return{x:slot%10,y:Math.floor(slot/10),hp,mp:70,move:4,active:0,state:token?0:8};});
  return {before,after,chosenIndex};
}
const ten=()=>({selected:[1,2,3,4,5,6,7,8,9],candidates:[29,33]});

test('Last of two real defenders naturally enters first PICK and retains the foreign raw resident',()=>{
  const f=finalFixture(),v=verifyMobileDefenderFinalSelection(f);assert.deepEqual(v.selectedIds,[33,29]);assert.deepEqual(v.remainingIds,[]);assert.equal(v.termination,'resident-exhausted');assert.equal(v.menuSequenceIncrements,5);assert.deepEqual(f.after.world.queue.slice(0,1),[175]);assert.equal(f.after.world.cities[4].Persons,1);assert.equal(v.measuredWorldOnlyLastDelPerson,true);assert.equal(v.actualInputAccepted,false);assert.equal(v.battleOutcomeAccepted,false);
});
test('One actual in-service defender may naturally exhaust without any previous selection',()=>{const v=verifyMobileDefenderFinalSelection(finalFixture({selected:[],candidates:[33]}));assert.deepEqual(v.selectedIds,[33]);assert.equal(v.menuSequenceIncrements,5);});
test('The tenth selection naturally enters first PICK while an unselected resident remains',()=>{const f=finalFixture(ten(),1),v=verifyMobileDefenderFinalSelection(f);assert.equal(v.selectedIds.length,10);assert.equal(v.selectedIds[9],33);assert.deepEqual(v.remainingIds,[29]);assert.equal(v.termination,'ten-selected');assert.equal(v.menuSequenceIncrements,3);assert.equal(f.after.native.keys-f.before.native.keys,2);});
test('Ten-selected wins the lifecycle branch even if no in-service resident remains',()=>{const f=finalFixture({...ten(),candidates:[29]}),v=verifyMobileDefenderFinalSelection(f);assert.equal(v.menuSequenceIncrements,3);assert.deepEqual(v.remainingIds,[]);});
test('Natural exhausted path skips U32 zero across all five menu transitions',()=>{const f=finalFixture({seq:0xffffffff});assert.equal(f.after.native.menu.seq,5);assert.equal(verifyMobileDefenderFinalSelection(f).accepted,true);});
test('Ten-selected path skips U32 zero across exactly three transitions',()=>{const f=finalFixture({...ten(),seq:0xfffffffe},1);assert.equal(f.after.native.menu.seq,2);assert.equal(verifyMobileDefenderFinalSelection(f).accepted,true);});
test('Final row arrows start at the real current focus rather than assuming zero',()=>{const f=finalFixture({...ten(),focus:1},1);assert.equal(f.after.native.keys-f.before.native.keys,1);assert.equal(verifyMobileDefenderFinalSelection(f).accepted,true);});
test('Ordinary first PICK retains diagnostic skip and does not impose an unproven MP/move formula',()=>{const f=finalFixture();f.after.native.fight.skip=4;f.after.native.battle.positions[0].mp=65535;f.after.native.battle.positions[0].move=255;assert.equal(verifyMobileDefenderFinalSelection(f).retainedFightSkip,4);});
test('The old one-row selection API still rejects native initialization after final row',()=>{assert.throws(()=>verifyMobileDefenderSelection(finalFixture()));});
test('The old explicit EXIT API does not accept a final selection world mutation',()=>{assert.throws(()=>verifyMobileDefenderBattle(finalFixture()));});
test('An unfinished list with fewer than ten selected cannot skip to GamFight',()=>{assert.throws(()=>verifyMobileDefenderFinalSelection(finalFixture({candidates:[29,34]})));});

const rejects=[
 ['exhausted path with only three sequence changes',f=>{f.after.native.menu.seq=f.before.native.menu.seq+3;}],
 ['extra menu transition',f=>{f.after.native.menu.seq++;}],
 ['stale detail generation',f=>{f.after.native.detailGeneration++;}],
 ['extra key after final Enter',f=>{f.after.native.keys++;}],
 ['missing final Enter',f=>{f.after.native.keys--;}],
 ['native LCD touch',f=>{f.after.native.touches++;}],
 ['chosen row outside current list',f=>{f.chosenIndex=1;}],
 ['unchanged resident count',f=>{f.after.world.cities[4].Persons++;}],
 ['incorrect queue199 clearing',f=>{f.after.world.queue[199]=0;}],
 ['queue200 tail mutation',f=>{f.after.world.queue[200]++;}],
 ['later city offset not shifted',f=>{f.after.world.cities[37].PersonQueue++;}],
 ['earlier city offset shifted',f=>{f.after.world.cities[0].PersonQueue++;}],
 ['foreign raw resident removed instead',f=>{f.after.world.queue[0]=29;}],
 ['unrelated full person field changed',f=>{f.after.world.people[199].Devotion++;}],
 ['unrelated order opaque cargo changed',f=>{f.after.world.orders[199].Consume++;}],
 ['new calendar mutation',f=>{f.after.world.month++;}],
 ['configuration mutation',f=>{f.after.world.config.fixOverFlow16=0;}],
 ['goods tail mutation',f=>{f.after.world.goodsQueue[1999]++;}],
 ['incoming fighter memory mutation',f=>{f.after.world.fighters[599]++;}],
 ['missing one-based chosen token',f=>{f.after.native.battle.genArray[1]=29;}],
 ['selected prefix reordered',f=>{[f.after.native.battle.genArray[0],f.after.native.battle.genArray[1]]=[30,34];}],
 ['extra incoming general',f=>{f.after.native.battle.genArray[19]=12;}],
 ['wrong original incoming token',f=>{f.after.native.battle.genArray[10]=63;}],
 ['wrong defensive mode',f=>{f.after.native.battle.mode=1;}],
 ['wrong main general side',f=>{f.after.native.battle.mainGenIndex=0;}],
 ['player food consumed',f=>{f.after.native.battle.playerFood--;}],
 ['incoming food consumed',f=>{f.after.native.battle.enemyFood--;}],
 ['retired defender IDs retained',f=>{f.after.native.menu.ids=[29];}],
 ['picker remains live',f=>{f.after.native.menu.active=1;}],
 ['retired picker context remains',f=>{f.after.native.menu.context=5;}],
 ['competing initialization report',f=>{f.after.native.report.active=1;}],
 ['inactive fight',f=>{f.after.native.fight.active=0;}],
 ['already over',f=>{f.after.native.fight.over=2;}],
 ['not waiting at PICK',f=>{f.after.native.fight.wait=0;}],
 ['wrong phase',f=>{f.after.native.fight.phase=2;}],
 ['MOVE input instead of PICK',f=>{f.after.native.fight.inputKind=2;}],
 ['owned actor instead of PICK sentinel',f=>{f.after.native.fight.actorIndex=0;}],
 ['zero PICK owner',f=>{f.after.native.fight.inputSeq=0;}],
 ['later player bout',f=>{f.after.native.fight.bout=2;}],
 ['wrong defended city',f=>{f.after.native.fight.cityIndex=5;}],
 ['empty map width',f=>{f.after.native.fight.mapW=0;}],
 ['bad original initial HP',f=>{f.after.native.battle.positions[0].hp++;}],
 ['occupied status not normal',f=>{f.after.native.battle.positions[0].state=2;}],
 ['empty slot not STATE_SW',f=>{f.after.native.battle.positions[2].state=0;}],
 ['slot already active',f=>{f.after.native.battle.positions[0].active=1;}],
 ['off-map position',f=>{f.after.native.battle.positions[0].x=32;}],
 ['initialization level-up outside scope',f=>{f.before.world.people[29].Experience=f.after.world.people[29].Experience=100;}],
 ['zero-arm initialization death outside scope',f=>{f.before.world.people[29].Arms=f.after.world.people[29].Arms=0;}],
 ['zero-HP initialization death outside scope',f=>{f.before.world.people[29].Thew=f.after.world.people[29].Thew=0;}]
];
for(const[label,change]of rejects)test('Final selection rejects '+label,()=>{const f=finalFixture();change(f);assert.throws(()=>verifyMobileDefenderFinalSelection(f));});
test('The tenth selection rejects the exhausted-resident +5 sequence convention',()=>{const f=finalFixture(ten(),1);f.after.native.menu.seq=f.before.native.menu.seq+5;assert.throws(()=>verifyMobileDefenderFinalSelection(f));});
