import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyMobileConfiscation,verifyMobileReward,verifyMobileEquipment} from './hd-mobile-equipment-runtime-oracle.mjs';

const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const clone=value=>structuredClone(value);
// Full synthetic measured-world shape, independent of build/actual artifacts.
// Selected initial persons/tools use the real standard LIB values; remote
// inventory and a nonzero inactive tail expose whole-queue shift mistakes.
function fixture() {
  const p={Belong:0,OldBelong:0,Level:1,Experience:0,IQ:60,Force:50,Age:30,Devotion:80,Character:0,Thew:100,Arms:100,ArmsType:1,Tool1:0,Tool2:0};
  const c={Belong:0,SatrapId:0,State:0,AvoidCalamity:20,PeopleDevotion:70,Commerce:100,Money:517,Food:1254,MothballArms:0,PersonQueue:3,Persons:0,Tools:0,ToolQueue:0};
  const o={OrderId:255,City:0,Person:0,Object:65535,TimeCount:0,Food:0};
  const base=libBytes.readUInt32LE((66-1)*4)+14;
  const tools=Array.from({length:33},(_,i)=>({useflag:libBytes[base+i*66+1],changeAttackRange:libBytes[base+i*66+32],
    at:libBytes[base+i*66+62],iq:libBytes[base+i*66+63],move:libBytes[base+i*66+64],arm:libBytes[base+i*66+65]}));
  const world={period:1,king:0,year:190,month:1,people:Array.from({length:200},()=>({...p})),cities:Array.from({length:38},()=>({...c})),
    queue:Array.from({length:2000},(_,i)=>1000+i),orders:Array.from({length:200},()=>({...o})),fighters:Array(600).fill(0),fighterIndex:Array(30).fill(0),
    config:{disableAllPersonReport:0,enable16bitConsumeMoney:0,checkRedundantOnAddPerson:1},
    goodsQueue:Array.from({length:2000},(_,i)=>40000+i),tools};
  for(let i=0;i<15;i++)world.cities[i].PersonQueue=0;
  world.cities[15]={...c,Belong:1,SatrapId:1,PersonQueue:0,Persons:3};world.queue.splice(0,3,0,19,20);
  for(const id of [0,19,20])world.people[id].Belong=1;
  Object.assign(world.people[0],{IQ:36,Force:86,Age:51,Devotion:100,ArmsType:0,Tool1:2});
  Object.assign(world.people[19],{IQ:92,Force:54,Age:40,Devotion:89,Character:2,ArmsType:2});
  Object.assign(world.people[20],{IQ:53,Force:110,Age:34,Devotion:95,ArmsType:4,Tool1:1,Tool2:23});
  world.cities[5].Tools=1;world.cities[15].Tools=1;world.cities[16].Tools=1;
  let offset=0;for(const city of world.cities){city.ToolQueue=offset;offset+=city.Tools;}
  world.goodsQueue.splice(0,3,5,0x8007,0x8016);
  return world;
}
function confiscation({personId=20,toolId=0,modify}={}) {
  const before=fixture();if(modify)modify(before);
  const after=clone(before),c=before.cities[15],p=before.people[personId];
  const slot=p.Tool1===toolId+1?'Tool1':'Tool2';
  after.people[personId][slot]=0;
  after.people[personId].Force=(p.Force-before.tools[toolId].at)&255;
  after.people[personId].IQ=(p.IQ-before.tools[toolId].iq)&255;
  if(personId!==before.king)after.people[personId].Devotion=Math.max(0,p.Devotion-20);
  after.goodsQueue.splice(c.ToolQueue+c.Tools,0,toolId|0x8000);after.goodsQueue.pop();
  after.cities[15].Tools++;
  for(let i=16;i<38;i++)after.cities[i].ToolQueue++;
  return {before,after,cityIndex:15,personId,toolId,libBytes,...(personId===before.king?{}:{reportWorld:clone(before)})};
}
function reward({personId=20,toolId=0,modify}={}) {
  const transfer=confiscation({personId:toolId===1?0:20,toolId});
  const before=clone(transfer.after);if(modify)modify(before);
  const after=clone(before),p=before.people[personId],c=before.cities[15];
  after.people[personId][p.Tool1===0?'Tool1':'Tool2']=toolId+1;
  after.people[personId].Force=(p.Force+before.tools[toolId].at)&255;
  after.people[personId].IQ=(p.IQ+before.tools[toolId].iq)&255;
  const index=before.goodsQueue.findIndex((token,i)=>i>=c.ToolQueue&&i<c.ToolQueue+c.Tools&&(token&0x7fff)===toolId);
  after.goodsQueue.splice(index,1);after.goodsQueue.push(before.goodsQueue.at(-1));after.cities[15].Tools--;
  for(let i=16;i<38;i++)after.cities[i].ToolQueue--;
  const reportWorld=clone(after);
  if(personId!==before.king)after.people[personId].Devotion=Math.min(100,(p.Devotion+8)&255);
  return {before,after,cityIndex:15,personId,toolId,libBytes,...(personId===before.king?{}:{reportWorld})};
}

test('Fang Tian tool0 confiscation changes only selected equipment/stats/devotion and the full discovered inventory insertion',()=>{
  const f=confiscation(),old=clone(f.before),next=clone(f.after),v=verifyMobileConfiscation(f);
  assert.equal(v.accepted,true);assert.equal(v.toolId,0);assert.equal(v.equipmentSlot,'Tool1');assert.equal(v.goodsQueueIndex,2);
  assert.deepEqual(v.stats,{forceBefore:110,forceAfter:100,iqBefore:53,iqAfter:53,devotionBefore:95,devotionAfter:75});
  assert.equal(f.after.people[20].Tool2,23);assert.equal(f.after.goodsQueue[2],0x8000);
  assert.equal(f.after.goodsQueue[3],0x8016);assert.equal(f.after.goodsQueue[1999],f.before.goodsQueue[1998]);
  assert.equal(f.after.cities[16].ToolQueue,3);assert.equal(v.reportBusinessStage,'before-all-transfer-business');
  assert.deepEqual(f.before,old);assert.deepEqual(f.after,next);assert.equal(v.inputAccepted,false);assert.equal(v.wholeNativeAbiAccepted,false);
});
test('Reward back to Lü Bu uses the first empty slot and reports after equipment/inventory but before Dev+8',()=>{
  const f=reward(),v=verifyMobileReward(f);
  assert.deepEqual(v.stats,{forceBefore:100,forceAfter:110,iqBefore:53,iqAfter:53,devotionBefore:75,devotionAfter:83});
  assert.equal(f.after.people[20].Tool1,1);assert.equal(f.after.people[20].Tool2,23);
  assert.equal(f.reportWorld.people[20].Force,110);assert.equal(f.reportWorld.people[20].Devotion,75);
  assert.equal(f.after.goodsQueue[1999],f.before.goodsQueue[1999]);assert.equal(f.after.goodsQueue[1998],f.before.goodsQueue[1999]);
  assert.equal(v.reportWorldAccepted,true);assert.equal(v.reportBusinessStage,'after-equipment-and-inventory-before-devotion');
});
test('King Dong Zhuo tool1 confiscation has no GREPORT and no devotion penalty',()=>{
  const f=confiscation({personId:0,toolId:1}),v=verifyMobileConfiscation(f);
  assert.equal(v.reportExpected,false);assert.equal(f.after.people[0].Devotion,100);
  assert.equal(f.after.people[0].Force,76);assert.equal(f.after.people[0].Tool1,0);assert.equal(f.after.goodsQueue[2],0x8001);
});
test('Qi Xing tool1 may be rewarded to actual empty-equipped Li Ru without changing resident or order queues',()=>{
  const f=reward({personId:19,toolId:1}),v=verifyMobileReward(f);
  assert.equal(v.personId,19);assert.equal(f.after.people[19].Tool1,2);assert.equal(f.after.people[19].Force,64);
  assert.equal(f.after.people[19].Devotion,97);assert.deepEqual(f.after.queue,f.before.queue);assert.deepEqual(f.after.orders,f.before.orders);
});
test('Reward chooses the second empty slot and caps normal devotion95 at100',()=>{
  const f=reward({personId:19,toolId:1,modify:w=>{w.people[19].Tool1=23;w.people[19].Devotion=95;}});
  verifyMobileReward(f);assert.equal(f.after.people[19].Tool1,23);assert.equal(f.after.people[19].Tool2,2);assert.equal(f.after.people[19].Devotion,100);
});
test('King reward applies equipment and inventory with no report or devotion gain',()=>{
  const f=reward({personId:0,toolId:1}),v=verifyMobileReward(f);
  assert.equal(v.reportExpected,false);assert.equal(f.after.people[0].Force,86);assert.equal(f.after.people[0].Devotion,100);
});
test('Actual U8 force subtraction wraps and devotion subtraction floors at0',()=>{
  const f=confiscation({modify:w=>{w.people[20].Force=5;w.people[20].Devotion=10;}});
  verifyMobileConfiscation(f);assert.equal(f.after.people[20].Force,251);assert.equal(f.after.people[20].Devotion,0);
});
test('Actual U8 force addition and devotion addition wrap before the loyalty cap',()=>{
  const f=reward({personId:19,toolId:1,modify:w=>{w.people[19].Force=250;w.people[19].Devotion=250;}});
  verifyMobileReward(f);assert.equal(f.after.people[19].Force,4);assert.equal(f.after.people[19].Devotion,2);
});
test('An ordinary IQ tool uses the actual LIB IQ delta, not the weapon Force delta',()=>{
  const f=confiscation({toolId:13,modify:w=>{w.people[20].Tool1=14;w.people[20].IQ=5;}});
  verifyMobileConfiscation(f);assert.equal(f.after.people[20].IQ,251);assert.equal(f.after.people[20].Force,110);
});
test('Removing second-slot Red Hare preserves first-slot weapon and does not invent an ArmsType change',()=>{
  const f=confiscation({toolId:22});verifyMobileConfiscation(f);
  assert.equal(f.after.people[20].Tool1,1);assert.equal(f.after.people[20].Tool2,0);assert.equal(f.after.people[20].Force,110);
  assert.equal(f.after.people[20].ArmsType,4);
});
test('DelGoods faithfully removes the first matching masked inventory ID while eligibility uses discovered IDs',()=>{
  const f=reward({personId:19,toolId:1,modify:w=>{w.goodsQueue[1]=1;}});
  const v=verifyMobileReward(f);assert.equal(v.goodsQueueIndex,1);assert.equal(f.after.goodsQueue[1],0x8001);
});
test('The final inventory item can be rewarded and no fake old GOODS list is required by a world oracle',()=>{
  const f=reward({personId:19,toolId:1,modify:w=>{
    w.cities[15].Tools=1;w.goodsQueue.splice(1,1);w.goodsQueue.push(0);for(let i=16;i<38;i++)w.cities[i].ToolQueue--;
  }});
  const v=verifyMobileReward(f);assert.equal(v.inventory.after,0);assert.equal(v.retirementAccepted,false);
});
test('A full order queue imposes no equipment order cost or actor departure',()=>{
  const f=confiscation();for(const w of [f.before,f.after,f.reportWorld])for(const o of w.orders)o.OrderId=24;
  verifyMobileConfiscation(f);assert.equal(f.after.cities[15].Persons,3);assert.equal(f.after.people[20].Thew,100);
});

const rejects=[
  ['no actual business change',f=>{f.after=clone(f.before);}],
  ['wrong selected zero-based tool',f=>{f.toolId=1;}],
  ['missing nonking report pause',f=>{delete f.reportWorld;}],
  ['confiscation report sampled after business',f=>{f.reportWorld=clone(f.after);}],
  ['wrong confiscation Force decrement',f=>{f.after.people[20].Force=101;}],
  ['wrong loyalty penalty',f=>{f.after.people[20].Devotion=83;}],
  ['other equipment slot cleared',f=>{f.after.people[20].Tool2=0;}],
  ['inventory item not marked discovered',f=>{f.after.goodsQueue[2]=0;}],
  ['inventory inserted at wrong position',f=>{[f.after.goodsQueue[1],f.after.goodsQueue[2]]=[f.after.goodsQueue[2],f.after.goodsQueue[1]];}],
  ['right shift did not reach inactive tail',f=>{f.after.goodsQueue[1999]=f.before.goodsQueue[1999];}],
  ['later city offset not increased',f=>{f.after.cities[16].ToolQueue--;}],
  ['source inventory count unchanged',f=>{f.after.cities[15].Tools--;}],
  ['Money cost invented',f=>{f.after.cities[15].Money--;}],
  ['Thew cost invented',f=>{f.after.people[20].Thew--;}],
  ['actor removed from residents',f=>{f.after.cities[15].Persons--;}],
  ['resident queue reordered',f=>{[f.after.queue[1],f.after.queue[2]]=[f.after.queue[2],f.after.queue[1]];}],
  ['order created',f=>{f.after.orders[0].OrderId=12;}],
  ['unrelated order data changed',f=>{f.after.orders[0].Object=0;}],
  ['unrelated person changed',f=>{f.after.people[19].Force++;}],
  ['unrelated city resource changed',f=>{f.after.cities[16].Food--;}],
  ['fighter byte changed',f=>{f.after.fighters[0]=1;}],
  ['fighter flag changed',f=>{f.after.fighterIndex[0]=1;}],
  ['date advanced',f=>{f.after.month=2;}],
  ['player changed',f=>{f.after.king=19;}],
  ['raw tool changed',f=>{f.after.tools[0].at=11;}],
  ['same forged tool table on both sides',f=>{for(const w of [f.before,f.after,f.reportWorld])w.tools[0].at=11;}],
  ['wrong standard LIB',f=>{f.libBytes=Buffer.from(libBytes);f.libBytes[100]^=1;}],
  ['wrong player-owned city',f=>{f.before.cities[15].Belong=2;}],
  ['foreign selected person',f=>{f.before.people[20].Belong=2;}],
  ['selected person is not resident',f=>{f.before.queue[2]=21;}],
  ['duplicate resident identity',f=>{f.before.queue[2]=19;}],
  ['unnormalized second-only equipment before GOODS',f=>{f.before.people[20].Tool1=0;}],
  ['ambiguous duplicated equipment ID',f=>{f.before.people[20].Tool2=1;}],
  ['missing raw tool',f=>{f.after.tools.pop();}],
  ['missing goods queue tail',f=>{f.after.goodsQueue.pop();}],
  ['missing person',f=>{f.after.people.pop();}],
  ['missing city',f=>{f.after.cities.pop();}],
  ['missing resident queue tail',f=>{f.after.queue.pop();}],
  ['missing order',f=>{f.after.orders.pop();}],
  ['missing fighter byte',f=>{f.after.fighters.pop();}],
  ['missing fighter flag',f=>{f.after.fighterIndex.pop();}],
  ['unrecorded config field removed',f=>{delete f.after.config.checkRedundantOnAddPerson;}],
  ['sampled extra field changed',f=>{f.before.extra=1;f.after.extra=2;}]
];
for(const [name,mutate] of rejects)test('Reject confiscation '+name,()=>{const f=confiscation();mutate(f);assert.throws(()=>verifyMobileConfiscation(f));});
for(const [name,mutate] of [
  ['reward report before equipment/inventory business',f=>{f.reportWorld=clone(f.before);}],
  ['reward report after devotion has already changed',f=>{f.reportWorld=clone(f.after);}],
  ['reward Force removed instead of added',f=>{f.after.people[20].Force=90;}],
  ['wrong loyalty gain',f=>{f.after.people[20].Devotion=95;}],
  ['wrong reward slot',f=>{f.after.people[20].Tool1=0;f.after.people[20].Tool2=1;}],
  ['undiscovered inventory not selectable',f=>{f.before.goodsQueue[2]=0;}],
  ['tool absent from current city',f=>{f.before.goodsQueue[2]=0x8002;}],
  ['native DelGoods tail improperly cleared',f=>{f.after.goodsQueue[1999]=0;}],
  ['full equipment pair must be FULLGOODS unchanged, not accepted transfer',f=>{f.before.people[20].Tool1=2;}],
  ['disabled report configuration cannot prove a report pause',f=>{f.before.config.disableAllPersonReport=1;}],
  ['consumable army conversion item is outside equipment-only acceptance',f=>{f.toolId=32;}]
])test('Reject '+name,()=>{const f=reward();mutate(f);assert.throws(()=>verifyMobileReward(f));});
test('A king cannot borrow a fabricated nonking report snapshot',()=>{const f=confiscation({personId:0,toolId:1});f.reportWorld=clone(f.before);assert.throws(()=>verifyMobileConfiscation(f));});
test('Operation must be explicit and cannot be another command',()=>{assert.throws(()=>verifyMobileEquipment({...confiscation(),operation:'search'}));});
