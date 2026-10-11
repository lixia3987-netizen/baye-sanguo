import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateMobileDistributionLimit,verifyMobileDistribution} from './hd-mobile-distribution-runtime-oracle.mjs';
const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const clone=value=>structuredClone(value);
function fixture() {
  const p={Belong:0,OldBelong:0,Level:2,Experience:0,IQ:60,Force:70,Age:30,Devotion:80,Character:0,Thew:0,Arms:100,ArmsType:1,Tool1:0,Tool2:0};
  const c={Belong:0,SatrapId:0,State:0,AvoidCalamity:20,PeopleDevotion:70,Commerce:100,Money:0,Food:900,MothballArms:1000,PersonQueue:3,Persons:0};
  const o={OrderId:255,City:0,Person:0,Object:0,TimeCount:0,Food:0};
  const before={period:1,king:5,year:189,month:1,people:Array.from({length:200},()=>({...p})),cities:Array.from({length:38},()=>({...c})),
    queue:Array.from({length:2000},(_,i)=>1000+i),orders:Array.from({length:200},()=>({...o})),fighters:Array(600).fill(0),fighterIndex:Array(30).fill(0),
    config:{enable16bitConsumeMoney:0,armsPerMoney:10,armsPerDevotion:20,fixOverFlow16:1,
      enableCustomRatio:0,ratioOfArmsToLevel:100,ratioOfArmsToAge:0,ratioOfArmsToIQ:10,ratioOfArmsToForce:10}};
  before.cities[0]={...c,Belong:6,PersonQueue:0,Persons:1};
  for(let i=1;i<8;i++)before.cities[i].PersonQueue=1;
  before.cities[8]={...c,Belong:6,SatrapId:64,PersonQueue:1,Persons:2};before.queue.splice(0,3,5,62,63);
  for(const id of [5,62,63])before.people[id].Belong=6;
  const after=clone(before);after.people[62].Arms=700;after.cities[8].MothballArms=400;
  return {before,after,cityIndex:8,personId:62,quantity:700,libBytes};
}
test('Target total700 replaces old100, uses600 reserve, and preserves full measured world',()=>{
  const f=fixture(),before=clone(f.before),after=clone(f.after),v=verifyMobileDistribution(f);
  assert.equal(v.accepted,true);assert.equal(v.capacity,1500);assert.equal(v.maximum,1100);
  assert.deepEqual(v.arms,{before:100,after:700,delta:600});assert.equal(v.reserve.after,400);
  assert.deepEqual(f.before,before);assert.deepEqual(f.after,after);assert.equal(v.inputAccepted,false);
});
test('Independent live limit exposes actual minimum0, initial maximum and eligibility',()=>{
  const f=fixture();assert.deepEqual(calculateMobileDistributionLimit({world:f.before,...f}),
    {cityIndex:8,personId:62,capacity:1500,available:1100,maximum:1100,max:1100,min:0,initialValue:1100,canOpen:true});
  f.before.people[62].Arms=0;f.before.cities[8].MothballArms=0;
  assert.equal(calculateMobileDistributionLimit({world:f.before,...f}).canOpen,false);
});
test('Actual zero total disbands all100 into reserve without money or Thew cost',()=>{
  const f=fixture();f.quantity=0;f.after.people[62].Arms=0;f.after.cities[8].MothballArms=1100;
  assert.equal(verifyMobileDistribution(f).arms.delta,-100);
});
test('Same total is a legal no-op confirmation, not proof of a trusted input',()=>{
  const f=fixture();f.quantity=100;f.after=clone(f.before);const v=verifyMobileDistribution(f);
  assert.equal(v.changed,false);assert.equal(v.inputAccepted,false);
});
test('Returning some troops increases reserve and keeps the selected resident',()=>{
  const f=fixture();f.quantity=40;f.after.people[62].Arms=40;f.after.cities[8].MothballArms=1060;
  assert.equal(verifyMobileDistribution(f).arms.delta,-60);
});
test('Current total available1100 may be assigned; reserve reaches0',()=>{
  const f=fixture();f.quantity=1100;f.after.people[62].Arms=1100;f.after.cities[8].MothballArms=0;
  assert.equal(verifyMobileDistribution(f).maximum,1100);
});
test('Current native custom ratios include Age and override the default1500 capacity',()=>{
  const f=fixture();for(const w of [f.before,f.after])Object.assign(w.config,{enableCustomRatio:1,ratioOfArmsToLevel:11,ratioOfArmsToAge:2,ratioOfArmsToForce:3,ratioOfArmsToIQ:4});
  f.quantity=532;f.after.people[62].Arms=532;f.after.cities[8].MothballArms=568;
  assert.equal(verifyMobileDistribution(f).capacity,532);
});
test('Custom capacity caps65534 and rejects the cancellation sentinel as a quantity',()=>{
  const f=fixture();for(const w of [f.before,f.after]){w.config.enableCustomRatio=1;w.config.ratioOfArmsToLevel=65535;w.cities[8].MothballArms=65535;}
  f.quantity=65534;f.after.people[62].Arms=65534;f.after.cities[8].MothballArms=101;
  assert.equal(verifyMobileDistribution(f).capacity,65534);
});
test('Native U16 remaining reserve wraps on return, even when fixOverFlow16 is enabled',()=>{
  const f=fixture();f.before.cities[8].MothballArms=65530;f.quantity=0;f.after.people[62].Arms=0;f.after.cities[8].MothballArms=94;
  const v=verifyMobileDistribution(f);assert.equal(v.reserve.uncast,65630);assert.equal(v.reserve.wrapped,true);
});
test('Full order queue has no effect: distribution creates no order and does not remove a person',()=>{
  const f=fixture();for(const w of [f.before,f.after])for(const o of w.orders)o.OrderId=3;
  verifyMobileDistribution(f);assert.deepEqual(f.after.queue,f.before.queue);assert.equal(f.after.cities[8].Persons,2);
});
const rejects=[
  ['unchanged world for a different confirmed total',f=>{f.after=clone(f.before);}],
  ['quantity is increment rather than final total',f=>{f.after.people[62].Arms=800;}],
  ['quantity above actual available troops',f=>{f.quantity=1101;}],
  ['quantity above actual person capacity',f=>{f.before.cities[8].MothballArms=f.after.cities[8].MothballArms=3000;f.quantity=1501;}],
  ['max0 could not have opened GetArmy',f=>{for(const w of [f.before,f.after]){w.people[62].Arms=0;w.cities[8].MothballArms=0;}f.quantity=0;}],
  ['65535 cancel sentinel',f=>{f.quantity=65535;}],
  ['negative quantity',f=>{f.quantity=-1;}],
  ['fractional quantity',f=>{f.quantity=1.5;}],
  ['wrong standard LIB',f=>{f.libBytes=Buffer.from(libBytes);f.libBytes[100]^=1;}],
  ['missing actual capacity configuration',f=>{delete f.before.config.enableCustomRatio;}],
  ['invalid U16 capacity ratio',f=>{f.before.config.ratioOfArmsToLevel=65536;}],
  ['config changes across confirmation',f=>{f.after.config.ratioOfArmsToIQ=11;}],
  ['foreign city',f=>{f.before.cities[8].Belong=12;}],
  ['foreign selected person',f=>{f.before.people[62].Belong=12;}],
  ['selected person not resident',f=>{f.personId=10;}],
  ['duplicated resident ID',f=>{f.before.queue[2]=62;}],
  ['wrong reserve arithmetic',f=>{f.after.cities[8].MothballArms=300;}],
  ['ADD16 saturation wrongly substituted for U16 wrap',f=>{f.before.cities[8].MothballArms=65530;f.quantity=0;f.after.people[62].Arms=0;f.after.cities[8].MothballArms=65535;}],
  ['money debited',f=>{f.before.cities[8].Money=1;}],
  ['Thew debited',f=>{f.before.people[62].Thew=12;}],
  ['other person Arms changed',f=>{f.after.people[63].Arms++;}],
  ['Food changed',f=>{f.after.cities[8].Food--;}],
  ['resident removed',f=>{f.after.cities[8].Persons--;}],
  ['queue reordered',f=>{[f.after.queue[1],f.after.queue[2]]=[f.after.queue[2],f.after.queue[1]];}],
  ['later city offset decremented',f=>{f.after.cities[9].PersonQueue--;}],
  ['new order added',f=>{f.after.orders[0].OrderId=25;}],
  ['uninitialized order field changed',f=>{f.after.orders[0].Object=65535;}],
  ['fighter byte changed',f=>{f.after.fighters[0]=1;}],
  ['fighter flag changed',f=>{f.after.fighterIndex[0]=1;}],
  ['strategy month advanced',f=>{f.after.month=2;}],
  ['other observed field changed',f=>{f.before.observed=1;f.after.observed=2;}],
  ['incomplete people table',f=>{f.after.people.pop();}],
  ['incomplete cities',f=>{f.after.cities.pop();}],
  ['incomplete queue',f=>{f.after.queue.pop();}],
  ['incomplete orders',f=>{f.after.orders.pop();}],
  ['incomplete fighters',f=>{f.after.fighters.pop();}],
  ['incomplete fighter flags',f=>{f.after.fighterIndex.pop();}]
];
for(const [name,mutate] of rejects)test('Reject '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileDistribution(f));});
