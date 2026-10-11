import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileRecruitmentOracleContract,verifyMobileRecruitment} from './hd-mobile-recruitment-runtime-oracle.mjs';

const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const clone=value=>structuredClone(value);
function fixture() {
  const person={Belong:0,OldBelong:0,Level:1,Experience:0,IQ:60,Force:60,Age:30,Devotion:80,Character:0,Thew:70,Arms:0,ArmsType:1,Tool1:0,Tool2:0};
  const city={Belong:0,SatrapId:0,State:0,AvoidCalamity:20,PeopleDevotion:70,Commerce:100,Money:100,Food:900,MothballArms:400,PersonQueue:6,Persons:0};
  const order={OrderId:255,City:0,Person:0,Object:0,TimeCount:0,Food:0,Arms:0,Money:0,Consume:0};
  const before={period:1,king:5,year:189,month:1,people:Array.from({length:200},()=>({...person})),
    cities:Array.from({length:38},()=>({...city})),queue:Array.from({length:2000},(_,i)=>1000+i),
    orders:Array.from({length:200},()=>({...order})),fighters:Array(600).fill(0),fighterIndex:Array(30).fill(0),
    config:{enable16bitConsumeMoney:0,checkRedundantOnAddPerson:1,disableExpGrowing:0,maxLevel:255,disableAllPersonReport:0,armsPerMoney:10,armsPerDevotion:20,fixOverFlow16:1}};
  before.queue.splice(0,6,5,10,62,11,63,85);
  before.cities[0]={...city,Belong:6,PersonQueue:0,Persons:2};
  for(let i=1;i<8;i++)before.cities[i].PersonQueue=2;
  before.cities[8]={...city,Belong:6,SatrapId:64,PersonQueue:2,Persons:3};
  before.cities[9]={...city,Belong:12,PersonQueue:5,Persons:1};
  for(const id of [5,10,62,63])before.people[id].Belong=6;
  for(const id of [11,85])before.people[id].Belong=12;
  before.orders[0]={...order,OrderId:3,City:0,Person:10,TimeCount:1};
  before.orders[1]={...order,OrderId:16,City:1,Person:20,TimeCount:2};
  // Independent fixed expected example: 137 recruits cost13 and Thew12.
  const after=clone(before);
  after.people[62].Thew=58;after.cities[8].Money=87;after.cities[8].MothballArms=537;after.cities[8].Persons=2;
  after.queue=[...before.queue.slice(0,2),...before.queue.slice(3,200),before.queue[199],...before.queue.slice(200)];
  after.cities[9].PersonQueue=4;
  for(let i=10;i<38;i++)after.cities[i].PersonQueue=5;
  after.orders[2]={...order,OrderId:24,City:8,Person:62,TimeCount:0,Object:412,Food:600,Arms:255,Money:37,Consume:252};
  return {before,after,cityIndex:8,personId:62,quantity:137,libBytes};
}
test('Original positive recruitment matches every recorded world field without mutating samples',()=>{
  const f=fixture(),savedBefore=clone(f.before),savedAfter=clone(f.after),v=verifyMobileRecruitment(f);
  assert.equal(v.accepted,true);assert.equal(v.orderIndex,2);assert.equal(v.maximum,1000);
  assert.deepEqual(v.money,{before:100,after:87,cost:13,minimum:1,armsPerMoney:10});
  assert.deepEqual(v.thew,{before:70,after:58,cost:12});assert.equal(v.stock.applied,137);
  assert.deepEqual(v.checked,{people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30});
  assert.deepEqual(f.before,savedBefore);assert.deepEqual(f.after,savedAfter);assert.equal(v.wholeNativeAbiAccepted,false);
});
test('Only the new slot stack fields receive a finite explicit nonsemantic mask',()=>{
  const v=verifyMobileRecruitment(fixture());
  assert.deepEqual(v.uninitializedOrderMask,{orderIndex:2,fields:['Object','Arms','Food','Money','Consume'],
    actual:{Object:412,Arms:255,Food:600,Money:37,Consume:252},semanticAcceptance:false});
});
test('Existing six-field order capture is accepted without claiming unobserved fields',()=>{
  const f=fixture();for(const w of [f.before,f.after])for(const o of w.orders)for(const k of ['Arms','Money','Consume'])delete o[k];
  assert.deepEqual(verifyMobileRecruitment(f).uninitializedOrderMask.fields,['Object','Food']);
});
test('Sub-ratio positive recruitment costs zero cash, not the minimum IsMoney gate',()=>{
  const f=fixture();f.quantity=9;f.after.cities[8].MothballArms=409;f.after.cities[8].Money=100;
  assert.equal(verifyMobileRecruitment(f).money.cost,0);
});
test('Exact ratio boundary costs one cash',()=>{
  const f=fixture();f.quantity=10;f.after.cities[8].MothballArms=410;f.after.cities[8].Money=99;
  assert.equal(verifyMobileRecruitment(f).money.cost,1);
});
test('Current devotion maximum, not an old/default capacity, limits the quantity',()=>{
  const f=fixture();f.before.cities[8].PeopleDevotion=f.after.cities[8].PeopleDevotion=1;
  f.quantity=20;f.after.cities[8].MothballArms=420;f.after.cities[8].Money=98;
  assert.equal(verifyMobileRecruitment(f).maximum,20);
});
test('Maximum current money permits its full native GetArmy quantity',()=>{
  const f=fixture();f.quantity=1000;f.after.cities[8].Money=0;f.after.cities[8].MothballArms=1400;
  assert.equal(verifyMobileRecruitment(f).money.cost,100);
});
test('Fresh recorded ratios are used instead of hardcoded20/10',()=>{
  const f=fixture();for(const w of [f.before,f.after]){w.config.armsPerMoney=7;w.config.armsPerDevotion=3;}
  f.quantity=19;f.after.cities[8].Money=98;f.after.cities[8].MothballArms=419;
  const v=verifyMobileRecruitment(f);assert.equal(v.maximum,210);assert.equal(v.money.cost,2);
});
test('ADD16 reserve saturation is exact and does not charge only the applied increment',()=>{
  const f=fixture();f.before.cities[8].MothballArms=65530;f.after.cities[8].MothballArms=65535;
  const v=verifyMobileRecruitment(f);assert.equal(v.stock.applied,5);assert.equal(v.stock.saturated,true);assert.equal(v.money.cost,13);
});
test('IsManual exact12 boundary and fixOverFlow16=0 still consume the actual ROM cost',()=>{
  const f=fixture();f.before.people[62].Thew=12;f.after.people[62].Thew=0;
  f.before.config.fixOverFlow16=f.after.config.fixOverFlow16=0;
  assert.equal(verifyMobileRecruitment(f).thew.after,0);
});
test('DelPerson preserves slot199 and all queue slots200..1999',()=>{
  const f=fixture();verifyMobileRecruitment(f);
  assert.equal(f.after.queue[198],f.before.queue[199]);assert.equal(f.after.queue[199],f.before.queue[199]);
  assert.deepEqual(f.after.queue.slice(200),f.before.queue.slice(200));
});
test('First free order slot may be0 and all other slots retain their bytes',()=>{
  const f=fixture();f.before.orders[0].OrderId=255;f.after.orders[0]=f.after.orders[2];f.after.orders[2]=clone(f.before.orders[2]);
  assert.equal(verifyMobileRecruitment(f).orderIndex,0);
});
test('Native last active queue slot199 is removed without shifting the 2000-slot tail',()=>{
  const f=fixture();for(let i=0;i<37;i++){f.before.cities[i].PersonQueue=f.after.cities[i].PersonQueue=0;f.before.cities[i].Persons=f.after.cities[i].Persons=0;}
  f.before.cities[0].Persons=f.after.cities[0].Persons=199;
  for(let i=0;i<37;i++)f.after.cities[i]=clone(f.before.cities[i]);
  f.before.cities[37]={...f.before.cities[8],Belong:6,PersonQueue:199,Persons:1,Money:100,MothballArms:400};
  f.after.cities[37]={...f.before.cities[37],Persons:0,Money:87,MothballArms:537};
  f.before.queue=Array.from({length:2000},(_,i)=>i<200?i:1000+i);f.after.queue=f.before.queue.slice();
  f.before.people[199].Belong=f.after.people[199].Belong=6;f.before.people[62].Thew=f.after.people[62].Thew=70;
  f.after.people[199].Thew=58;f.personId=199;f.cityIndex=37;f.after.orders[2].City=37;f.after.orders[2].Person=199;
  assert.equal(verifyMobileRecruitment(f).queueIndex,199);
});
test('Observed extra world fields must remain exact; no extra native ABI is inferred',()=>{
  const f=fixture();f.before.extraObserved={token:7};f.after.extraObserved={token:7};verifyMobileRecruitment(f);
  f.after.extraObserved.token=8;assert.throws(()=>verifyMobileRecruitment(f));
});

const rejects=[
  ['unchanged world',f=>{f.after=clone(f.before);}],
  ['zero recruitment is outside positive-submission evidence',f=>{f.quantity=0;}],
  ['fractional quantity',f=>{f.quantity=1.5;}],
  ['quantity larger than current money maximum',f=>{f.quantity=1001;}],
  ['quantity larger than current devotion maximum',f=>{f.before.cities[8].PeopleDevotion=f.after.cities[8].PeopleDevotion=1;}],
  ['cancel sentinel65535',f=>{f.quantity=65535;}],
  ['wrong original LIB byte',f=>{f.libBytes=Buffer.from(libBytes);f.libBytes[100]^=1;}],
  ['wrong original LIB length',f=>{f.libBytes=libBytes.subarray(1);} ],
  ['missing current ratios',f=>{delete f.before.config.armsPerMoney;}],
  ['zero divisor',f=>{f.before.config.armsPerMoney=0;}],
  ['zero devotion ratio',f=>{f.before.config.armsPerDevotion=0;}],
  ['invalid overflow config',f=>{f.before.config.fixOverFlow16=2;}],
  ['wide money-cost mode reading past original28B item',f=>{f.before.config.enable16bitConsumeMoney=f.after.config.enable16bitConsumeMoney=1;}],
  ['config changes during submission',f=>{f.after.config.armsPerMoney=11;}],
  ['IsMoney minimum1 absent despite zero-rounded cost',f=>{f.before.cities[8].Money=0;}],
  ['Thew below actual ROM12',f=>{f.before.people[62].Thew=11;}],
  ['wrong cash cost rounded upward',f=>{f.after.cities[8].Money=86;}],
  ['wrong fixed minimum cost1',f=>{f.after.cities[8].Money=99;}],
  ['wrong reserve increment',f=>{f.after.cities[8].MothballArms=536;}],
  ['reserve wraps instead of ADD16 saturating',f=>{f.before.cities[8].MothballArms=65530;f.after.cities[8].MothballArms=131;}],
  ['deprecated header Thew4 instead of ROM12',f=>{f.after.people[62].Thew=66;}],
  ['actor army incorrectly gains recruits',f=>{f.after.people[62].Arms=137;}],
  ['other person changes',f=>{f.after.people[63].Thew--;}],
  ['source Food changes',f=>{f.after.cities[8].Food--;}],
  ['other city Money changes',f=>{f.after.cities[0].Money--;}],
  ['source Satrap changes',f=>{f.after.cities[8].SatrapId=63;}],
  ['source Persons unchanged',f=>{f.after.cities[8].Persons=3;}],
  ['resident queue not shifted',f=>{f.after.queue=clone(f.before.queue);} ],
  ['queue shift reordered other residents',f=>{[f.after.queue[2],f.after.queue[3]]=[f.after.queue[3],f.after.queue[2]];}],
  ['slot199 cleared',f=>{f.after.queue[199]=0;}],
  ['queue tail200 shifted',f=>{f.after.queue[200]=f.before.queue[201];}],
  ['empty later city offset unchanged',f=>{f.after.cities[37].PersonQueue=6;}],
  ['earlier city offset changed',f=>{f.after.cities[1].PersonQueue=1;}],
  ['foreign selected resident',f=>{f.personId=11;}],
  ['selected person outside source queue',f=>{f.personId=10;}],
  ['city no longer player-owned',f=>{f.before.cities[8].Belong=12;}],
  ['overlapping native city queue ranges',f=>{f.before.cities[9].PersonQueue=4;}],
  ['duplicate native resident',f=>{f.before.queue[3]=62;}],
  ['resident ID outside original200',f=>{f.before.queue[3]=200;}],
  ['city queue outside first200',f=>{f.before.cities[8].PersonQueue=199;}],
  ['full native order queue',f=>{for(const o of f.before.orders)if(o.OrderId===255)o.OrderId=0;}],
  ['new order not first free slot',f=>{f.after.orders[3]=f.after.orders[2];f.after.orders[2]=clone(f.before.orders[2]);}],
  ['no new order despite resource debit',f=>{f.after.orders[2]=clone(f.before.orders[2]);}],
  ['wrong OrderId',f=>{f.after.orders[2].OrderId=25;}],
  ['wrong order Person',f=>{f.after.orders[2].Person=63;}],
  ['wrong order City',f=>{f.after.orders[2].City=9;}],
  ['wrong order TimeCount',f=>{f.after.orders[2].TimeCount=1;}],
  ['another order changes',f=>{f.after.orders[1].Object=5;}],
  ['second new order',f=>{f.after.orders[3].OrderId=24;}],
  ['uninitialized field mask applied to another slot',f=>{f.after.orders[3].Food=600;}],
  ['newslot unsupported field changes',f=>{f.before.orders[2].extraObserved=1;f.after.orders[2].extraObserved=2;}],
  ['newslot silently added field',f=>{f.after.orders[2].extraObserved=2;}],
  ['uninitialized U16 out of range',f=>{f.after.orders[2].Object=65536;}],
  ['uninitialized U8 out of range',f=>{f.after.orders[2].Consume=256;}],
  ['fighter bytes change',f=>{f.after.fighters[0]=1;}],
  ['fighter flag changes',f=>{f.after.fighterIndex[0]=1;}],
  ['strategy month advances',f=>{f.after.month=2;}],
  ['current king changes',f=>{f.after.king=6;}],
  ['incomplete people table',f=>{f.after.people.pop();}],
  ['incomplete city table',f=>{f.after.cities.pop();}],
  ['incomplete queue table',f=>{f.after.queue.pop();}],
  ['incomplete order table',f=>{f.after.orders.pop();}],
  ['incomplete fighter table',f=>{f.after.fighters.pop();}],
  ['incomplete flag table',f=>{f.after.fighterIndex.pop();}],
  ['sparse queue element',f=>{delete f.after.queue[1000];}]
];
for(const [name,mutate] of rejects)test('Reject '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileRecruitment(f));});
test('Contract names both observed and unobserved stack fields without granting input acceptance',()=>{
  assert.deepEqual(mobileRecruitmentOracleContract.initializedOrderFields,['OrderId','Person','City','TimeCount']);
  assert.equal(mobileRecruitmentOracleContract.uninitializedOrderFields.length,5);
  assert.equal(verifyMobileRecruitment(fixture()).strategyMonthAccepted,false);
});
