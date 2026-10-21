import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMobileDefenderSettlement as verify} from './hd-mobile-defender-settlement-runtime-oracle.mjs';

// Full independent fixture uses explicit raw order bytes and a distinguishable
// inactive queue tail. Expected insertion is expressed as bounded array slices.
const clone=v=>structuredClone(v);
function fixture(over=2){
  const person=()=>({Belong:0,OldBelong:0,Level:1,Experience:0,IQ:50,Force:60,Age:25,Devotion:80,Thew:90,Character:0,Arms:1000,ArmsType:0,Tool1:0,Tool2:0});
  const city=()=>({State:0,Belong:0,SatrapId:0,FarmingLimit:1000,Farming:101,CommerceLimit:1000,Commerce:99,PeopleDevotion:99,AvoidCalamity:0,PopulationLimit:500000,Population:100000,Money:1001,Food:5000,MothballArms:10,PersonQueue:3,Persons:0,ToolQueue:0,Tools:0});
  const w={period:1,king:0,year:190,month:6,people:Array.from({length:200},person),cities:Array.from({length:38},city),queue:Array.from({length:2000},(_,i)=>i),
    orders:Array.from({length:200},(_,i)=>({OrderId:255,Person:0,City:0,Object:0,Arms:100+i,Food:200+i,Money:300+i,Consume:i,TimeCount:0})),fighters:Array(600).fill(0),fighterIndex:Array(30).fill(0),goodsQueue:Array(2000).fill(0),
    tools:[{useflag:0,changeAttackRange:0,at:0,iq:0,move:0,arm:0}],config:{fixOverFlow16:1,checkRedundantOnAddPerson:0,disableFightToDeath:0}};
  for(const p of [0,27,29])w.people[p].Belong=1;for(const p of [10,11,12,50])w.people[p].Belong=51;
  Object.assign(w.cities[0],{Belong:1,SatrapId:28,PersonQueue:0,Persons:1});Object.assign(w.cities[1],{Belong:1,PersonQueue:1,Persons:1});Object.assign(w.cities[2],{Belong:51,PersonQueue:2,Persons:1});w.queue.splice(0,3,27,0,50);
  w.orders[170]={OrderId:27,Person:0,City:2,Object:0,Arms:34330,Food:1000,Money:34349,Consume:41,TimeCount:0};[11,12,13].forEach((v,i)=>w.fighters[i*2]=v);
  const tokens=[30,...Array(9).fill(0),11,12,13,...Array(7).fill(0)];
  const native={detailGeneration:3,keys:20,touches:0,menu:{active:0,context:0,kind:0,seq:20,index:0,count:0},report:{active:0,kind:0,seq:10,inputSeq:10},fight:{active:0,over},
    battle:{mode:0,over,cityIndex:0,mainGenIndex:10,playerFood:1000,enemyFood:900,genArray:tokens,positions:tokens.map((t,i)=>({x:i,y:0,hp:100,mp:300,move:4,active:1,state:t?0:8}))}};
  return {world:w,native};
}
function insert(w,city,pid){
  const q=w.queue,c=w.cities[city],at=c.PersonQueue;w.queue=[...q.slice(0,at),pid,...q.slice(at,199),...q.slice(200)];c.Persons++;
  w.cities.forEach((v,i)=>{if(i>city)v.PersonQueue++;});
}
function expected(before,outcomes=[]){
  const w=clone(before.world),b=before.native.battle,won=b.over===1,winners=(won?b.genArray.slice(0,10):b.genArray.slice(10)).filter(Boolean),losers=(won?b.genArray.slice(10):b.genArray.slice(0,10)).filter(Boolean);
  winners.forEach(t=>insert(w,0,t-1));
  if(!won){Object.assign(w.cities[0],{Belong:w.people[b.genArray[10]-1].Belong,SatrapId:b.genArray[10]});w.people[27].Belong=0;w.people[27].Arms=0;}
  losers.forEach((t,i)=>{const id=t-1;if(outcomes[i]==='escape')insert(w,won?2:1,id);else{const p=w.people[id];p.OldBelong=p.Belong;p.Belong=65535;p.Arms=0;insert(w,0,id);}});
  Object.assign(w.cities[0],{Farming:96,Commerce:95,Money:951,PeopleDevotion:90});
  const sum=b.playerFood+b.enemyFood;w.cities[0].Food=w.config.fixOverFlow16?Math.min(65535,sum):sum%65536;return w;
}
function args(over=2,outcomes=[]){const before=fixture(over),after={world:expected(before,outcomes),native:clone(before.native)},receipt={generation:3,detailGeneration:3,city:0,mode:0,over,playerKing:0};return {before,after,receipt};}
function withNpcSuccession(tie=false){
  const before=fixture(1),w=before.world;for(const p of [10,11,12,50,51])w.people[p].Belong=11;w.cities[2].Belong=11;w.cities[2].Persons=2;w.queue.splice(2,2,50,51);for(let i=3;i<38;i++)w.cities[i].PersonQueue=4;w.people[50].IQ=80;w.people[51].IQ=tie?80:90;
  const reportWorld=expected(before);reportWorld.cities[0].Food=before.world.cities[0].Food;const chosen=tie?50:51,committed=clone(reportWorld);committed.people[chosen].Devotion=100;committed.cities[2].Belong=chosen+1;committed.people[50].Belong=chosen+1;committed.people[51].Belong=chosen+1;
  const after={world:clone(committed),native:clone(before.native)};after.world.cities[0].Food=1900;
  const rn=clone(before.native);rn.report={active:1,kind:1,seq:100,inputSeq:20};const receipt={generation:3,detailGeneration:3,city:0,mode:0,over:1,playerKing:0};
  return {before,after,receipt,events:{reports:[{world:reportWorld,native:rn}],successions:[{world:committed,native:clone(before.native),receipt:{generation:3,oldKing:10,newKing:chosen,playerKing:0}}]}};
}
function withPlayerSuccession(){
  const before=fixture(2);before.world.king=29;for(const id of [0,27,29])before.world.people[id].Belong=30;before.world.cities[0].Belong=30;before.world.cities[1].Belong=30;
  const reportWorld=expected(before);reportWorld.cities[0].Food=5000;reportWorld.king=0;const committed=clone(reportWorld);committed.people[0].Devotion=100;committed.people[0].Belong=1;committed.cities[1].Belong=1;
  const after={world:clone(committed),native:clone(before.native)};after.world.cities[0].Food=1900;const rn=clone(before.native);rn.report={active:1,kind:1,seq:100,inputSeq:20};
  return {before,after,receipt:{generation:3,detailGeneration:3,city:0,mode:0,over:2,playerKing:0},events:{reports:[{world:reportWorld,native:rn}],successions:[{world:committed,native:clone(before.native),receipt:{generation:3,oldKing:29,newKing:0,playerKing:0}}]}};
}

test('Actual defensive loss reconstructs enemies, occupation, captive and complete queue',()=>{const x=args();const r=verify(x);assert.equal(r.accepted,true);assert.equal(r.orderIndex,170);assert.equal(r.armySlot,0);assert.deepEqual(r.winnerIds,[10,11,12]);assert.deepEqual(x.after.world.queue.slice(0,7),[29,12,11,10,27,0,50]);assert.equal(x.after.world.people[27].OldBelong,0);assert.equal(r.orderRetirementAccepted,false);});
test('Defeated nonking escapes only to actual retained own-faction city',()=>{const x=args(2,['escape']);assert.equal(verify(x).loserBranches[0].cityIndex,1);assert.deepEqual(x.after.world.people[29],x.before.world.people[29]);});
test('Victory returns player and captures every enemy token',()=>{const x=args(1);assert.equal(verify(x).over,1);assert.deepEqual(x.after.world.queue.slice(0,7),[12,11,10,29,27,0,50]);});
test('Victory accepts individually observed escape/captive branches in native order',()=>{const x=args(1,['escape','captive','escape']);assert.deepEqual(verify(x).loserBranches.map(x=>x.outcome),['escape','captive','escape']);});
test('Winning STATE_SW token is still returned by FightResultDeal',()=>{const x=args();x.before.native.battle.positions[10].state=8;x.after.native.battle.positions[10].state=8;assert.equal(verify(x).accepted,true);});
test('Saturating remaining-food merge',()=>{const x=args();x.before.native.battle.playerFood=65000;x.before.native.battle.enemyFood=1000;x.after.native.battle=clone(x.before.native.battle);x.after.world.cities[0].Food=65535;assert.equal(verify(x).food.merged,65535);});
test('Legacy U16 remaining-food wrap',()=>{const x=args();x.before.world.config.fixOverFlow16=0;x.after.world.config.fixOverFlow16=0;x.before.native.battle.playerFood=65000;x.before.native.battle.enemyFood=1000;x.after.native.battle=clone(x.before.native.battle);x.after.world.cities[0].Food=464;assert.equal(verify(x).food.merged,464);});
test('Redundant AddPerson config is sampled and valid when no duplicate residents',()=>{const x=args();x.before.world.config.checkRedundantOnAddPerson=1;x.after.world.config.checkRedundantOnAddPerson=1;assert.equal(verify(x).accepted,true);});
test('Raw initialized/uninitialized order fields retain all nine bytes/values',()=>{const x=args();assert.equal(verify(x).accepted,true);assert.deepEqual(x.after.world.orders[170],x.before.world.orders[170]);assert.equal(x.after.world.orders[170].Arms,34330);});
test('Inactive resident queue tail 200..1999 is retained',()=>{const x=args();verify(x);assert.deepEqual(x.after.world.queue.slice(200),x.before.world.queue.slice(200));});
test('NPC captured king chooses first highest IQ with exact report and commitment',()=>{const x=withNpcSuccession();assert.equal(verify(x).succession.newKing,51);assert.equal(x.after.world.king,0);});
test('NPC equal highest IQ preserves queue first candidate',()=>{assert.equal(verify(withNpcSuccession(true)).succession.newKing,50);});
test('Player captured king inherits only actual ordered candidates after report',()=>{const r=verify(withPlayerSuccession());assert.equal(r.succession.playerChoice,true);assert.deepEqual(r.succession.candidateIds,[0]);assert.equal(r.succession.newKing,0);});
test('Irrelevant different-generation NPC notification does not become this battle receipt',()=>{const x=args();x.events={successions:[{receipt:{generation:2},native:{detailGeneration:2}}]};assert.equal(verify(x).accepted,true);});

const bad=[
 ['unrelated person changes',x=>x.after.world.people[100].Arms++],
 ['Farming rounding wrong',x=>x.after.world.cities[0].Farming++],
 ['Commerce rounding wrong',x=>x.after.world.cities[0].Commerce++],
 ['Money rounding wrong',x=>x.after.world.cities[0].Money++],
 ['PeopleDevotion rounding wrong',x=>x.after.world.cities[0].PeopleDevotion++],
 ['merged food wrong',x=>x.after.world.cities[0].Food++],
 ['other city resource changes',x=>x.after.world.cities[7].Food++],
 ['captured OldBelong wrong',x=>x.after.world.people[29].OldBelong=2],
 ['captured Arms retained',x=>x.after.world.people[29].Arms=1],
 ['unselected occupation resident must lose arms',x=>x.after.world.people[27].Arms=1],
 ['occupation must set winning token Satrap',x=>x.after.world.cities[0].SatrapId=12],
 ['occupation must use actual attacking faction',x=>x.after.world.cities[0].Belong=52],
 ['wrong insertion order',x=>{const q=x.after.world.queue;[q[1],q[2]]=[q[2],q[1]];}],
 ['city after target offset wrong',x=>x.after.world.cities[5].PersonQueue++],
 ['inactive queue tail changed',x=>x.after.world.queue[200]++],
 ['queue slot199 incorrect',x=>x.after.world.queue[199]++],
 ['incoming order retired too early',x=>x.after.world.orders[170].OrderId=255],
 ['raw Order Arms changed',x=>x.after.world.orders[170].Arms++],
 ['raw Order Consume changed',x=>x.after.world.orders[170].Consume++],
 ['unrelated order changed',x=>x.after.world.orders[10].Money++],
 ['fighter raw bytes changed',x=>x.after.world.fighters[0]++],
 ['fighter allocation reactivated',x=>x.after.world.fighterIndex[0]=1],
 ['tool queue changed',x=>x.after.world.goodsQueue[0]=1],
 ['tool metadata changed',x=>x.after.world.tools[0].at=1],
 ['date changed inside settlement',x=>x.after.world.month++],
 ['config changed',x=>x.after.world.config.fixOverFlow16=0],
 ['missing actual death flag',x=>{delete x.before.world.config.disableFightToDeath;}],
 ['invalid actual config flag',x=>x.before.world.config.disableFightToDeath=2],
 ['receipt generation stale',x=>x.receipt.generation=2],
 ['receipt detail generation stale',x=>x.receipt.detailGeneration=2],
 ['receipt city wrong',x=>x.receipt.city=1],
 ['receipt mode attack',x=>x.receipt.mode=1],
 ['receipt over wrong',x=>x.receipt.over=1],
 ['receipt PlayerKing wrong',x=>x.receipt.playerKing=1],
 ['before still fighting',x=>x.before.native.fight.active=1],
 ['not a defensive result',x=>x.before.native.battle.mode=1],
 ['no actual result',x=>x.before.native.battle.over=0],
 ['premature active report at completion',x=>x.after.native.report.active=1],
 ['premature picker at completion',x=>x.after.native.menu.active=1],
 ['battle position mutated during settlement',x=>x.after.native.battle.positions[0].hp--],
 ['enemy token endian mismatch to incoming fighters',x=>{x.before.world.fighters[0]=0;x.before.world.fighters[1]=11;}],
 ['ambiguous incoming order',x=>x.before.world.orders[171]=clone(x.before.world.orders[170])],
 ['incoming flag not released',x=>x.before.world.fighterIndex[0]=1],
 ['before player defender wrong faction',x=>x.before.world.people[29].Belong=51],
 ['enemy formation mixed faction',x=>x.before.world.people[11].Belong=1],
 ['sparse people not silently skipped',x=>delete x.after.world.people[100]],
 ['sparse resident queue not silently skipped',x=>delete x.after.world.queue[500]],
 ['sparse native positions not silently skipped',x=>delete x.after.native.battle.positions[5]],
 ['impossible IQ99 captive while own escape city remains',x=>{x.before.world.people[29].IQ=99;x.after.world.people[29].IQ=99;}],
];
for(const [label,mutate]of bad)test('Reject '+label,()=>{const x=args();mutate(x);assert.throws(()=>verify(x));});
for(const [label,mutate]of [
 ['missing report world',x=>x.events.reports=[]],
 ['missing successor receipt',x=>x.events.successions=[]],
 ['premature inheritance inside NewKingNote',x=>x.events.reports[0].world.people[51].Devotion=100],
 ['wrong committed ownership',x=>x.events.successions[0].world.cities[2].Belong=53],
 ['NPC lower IQ choice',x=>x.events.successions[0].receipt.newKing=50],
 ['wrong playerKing receipt',x=>x.events.successions[0].receipt.playerKing=51],
 ['extra current KingOver event',x=>x.events.successions.push(clone(x.events.successions[0]))],
 ['report bound to another battle',x=>x.events.reports[0].native.battle.cityIndex=1],
])test('Reject successor '+label,()=>{const x=withNpcSuccession();mutate(x);assert.throws(()=>verify(x));});
test('Actual death without AddPerson is explicitly unsupported, not masked',()=>{const x=args();x.before.world.cities[1].Belong=0;x.before.world.people[0].Belong=0;x.after.world=expected(x.before,['escape']);const q=x.after.world.queue;const at=x.after.world.cities[1].PersonQueue;for(let i=at;i<199;i++)q[i]=q[i+1];x.after.world.cities[1].Persons--;for(let i=2;i<38;i++)x.after.world.cities[i].PersonQueue--;assert.throws(()=>verify(x));});
test('Captured king extinction without current successor trace is explicitly rejected',()=>{const before=fixture(2);before.world.king=29;for(const id of [0,27,29])before.world.people[id].Belong=30;before.world.cities[0].Belong=30;before.world.cities[1].Belong=0;before.world.people[0].Belong=0;const x={before,after:{world:expected(before),native:clone(before.native)},receipt:{generation:3,detailGeneration:3,city:0,mode:0,over:2,playerKing:29}};assert.throws(()=>verify(x),/extinction/);});

test('IQ99 may be captured when no old-faction city remains and nonzero fallback roll is possible',()=>{const x=args();x.before.world.cities[1].Belong=0;x.before.world.people[0].Belong=0;x.before.world.people[29].IQ=99;x.after.world=expected(x.before);assert.equal(verify(x).accepted,true);});
test('Death-disabled no-city fallback may capture even IQ255',()=>{const x=args();x.before.world.config.disableFightToDeath=1;x.before.world.cities[1].Belong=0;x.before.world.people[0].Belong=0;x.before.world.people[29].IQ=255;x.after.world=expected(x.before);assert.equal(verify(x).accepted,true);});
test('IQ99 always retains a possible escape roll when an old-faction city exists',()=>{const x=args(2,['escape']);x.before.world.people[29].IQ=99;x.after.world.people[29].IQ=99;assert.equal(verify(x).accepted,true);});

test('unrelated legacy cross-city resident IDs survive exact defense settlement',()=>{
 for(const over of [1,2]){const before=fixture(over),w=before.world;
  Object.assign(w.cities[3],{PersonQueue:3,Persons:1});Object.assign(w.cities[4],{PersonQueue:4,Persons:1});w.queue[3]=70;w.queue[4]=70;for(let i=5;i<38;i++)w.cities[i].PersonQueue=5;
  const x={before,after:{world:expected(before),native:clone(before.native)},receipt:{generation:3,detailGeneration:3,city:0,mode:0,over,playerKing:0}};
  assert.equal(verify(x).accepted,true);const q=x.after.world.queue;assert.equal(q[x.after.world.cities[3].PersonQueue],70);assert.equal(q[x.after.world.cities[4].PersonQueue],70);
  x.after.world.unrelatedUnexpected=1;assert.throws(()=>verify(x),/fields|differs/);
 }
});
