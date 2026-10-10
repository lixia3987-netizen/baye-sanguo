import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileSuccessorCandidateIds,verifyMobileSuccessorChoice} from './hd-mobile-successor-runtime-oracle.mjs';

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
    count:5,index:2,names:names.slice(),packedNames:names.slice(),ids:[],idsValid:false};
  return {world,menu,names};
}
test('Exact original city/resident order supplies IDs without name-to-ID recovery',()=>{
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
  ['future published IDs disagree with native order',f=>{f.menu.idsValid=true;f.menu.ids=[56,62,57,63,65];}]
];
for(const [label,mutate] of rejects)test('Reject '+label,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileSuccessorChoice(f));});
