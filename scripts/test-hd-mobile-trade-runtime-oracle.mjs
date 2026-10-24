import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileTradeOracleContract,calculateMobileTradeLimit,verifyMobileTrade,verifyMobileTradeCancellation} from './hd-mobile-trade-runtime-oracle.mjs';

const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const clone=v=>structuredClone(v);
const toolBase=libBytes.readUInt32LE((66-1)*4)+14;
const tools=Array.from({length:33},(_,i)=>{const p=toolBase+i*66;return {
  useflag:libBytes[p+1],changeAttackRange:libBytes[p+32],at:libBytes[p+62],iq:libBytes[p+63],move:libBytes[p+64],arm:libBytes[p+65]};});
function fixture(side='buy') {
  const person={Belong:0,OldBelong:0,Level:1,Experience:0,IQ:60,Force:60,Age:30,Devotion:80,Character:0,Thew:70,Arms:0,ArmsType:1,Tool1:0,Tool2:0};
  const city={Belong:0,SatrapId:0,State:0,AvoidCalamity:20,PeopleDevotion:70,Commerce:100,Money:100,Food:900,MothballArms:400,PersonQueue:6,Persons:0,Tools:0,ToolQueue:2};
  const order={OrderId:255,City:0,Person:0,Object:0,TimeCount:0,Food:0,Arms:0,Money:0,Consume:0};
  const before={period:1,king:5,year:189,month:1,people:Array.from({length:200},()=>({...person})),
    cities:Array.from({length:38},()=>({...city})),queue:Array.from({length:2000},(_,i)=>1000+i),
    orders:Array.from({length:200},()=>({...order})),fighters:Array(600).fill(0),fighterIndex:Array(30).fill(0),
    goodsQueue:Array(2000).fill(0),tools:clone(tools),config:{enable16bitConsumeMoney:0,checkRedundantOnAddPerson:1,
      armsPerMoney:10,armsPerDevotion:20,fixOverFlow16:1,enableCustomRatio:0,ratioOfArmsToLevel:100,ratioOfArmsToAge:10,
      ratioOfArmsToIQ:10,ratioOfArmsToForce:10,disableExpGrowing:0,maxLevel:255,disableAllPersonReport:0}};
  before.queue.splice(0,6,5,10,62,11,63,85);
  before.cities[0]={...city,Belong:6,PersonQueue:0,Persons:2,Tools:1,ToolQueue:0};
  for(let i=1;i<8;i++){before.cities[i].PersonQueue=2;before.cities[i].ToolQueue=1;}
  before.cities[8]={...city,Belong:6,SatrapId:64,PersonQueue:2,Persons:3,Tools:1,ToolQueue:1};
  before.cities[9]={...city,Belong:12,PersonQueue:5,Persons:1};
  before.goodsQueue[0]=0x8000;before.goodsQueue[1]=0x800f;
  for(const id of [5,10,62,63])before.people[id].Belong=6;
  for(const id of [11,85])before.people[id].Belong=12;
  before.orders[0]={...order,OrderId:3,City:0,Person:10,TimeCount:1};
  before.orders[1]={...order,OrderId:16,City:1,Person:20,TimeCount:2};
  // Independent fixed expected examples: buy17 costs85; sell17 produces34.
  const after=clone(before);
  after.people[62].Thew=58;after.cities[8].Money=side==='buy'?15:134;after.cities[8].Food=side==='buy'?917:883;after.cities[8].Persons=2;
  after.queue=[...before.queue.slice(0,2),...before.queue.slice(3,200),before.queue[199],...before.queue.slice(200)];
  after.cities[9].PersonQueue=4;for(let i=10;i<38;i++)after.cities[i].PersonQueue=5;
  after.orders[2]={...order,OrderId:11,City:8,Person:62,TimeCount:0,Object:65535,Food:600,Arms:255,Money:37,Consume:252};
  return {before,after,cityIndex:8,personId:62,side,quantity:17,libBytes};
}
for(const side of ['buy','sell'])test('Normal '+side+' checks full captured system world and preserves samples',()=>{
  const f=fixture(side),b=clone(f.before),a=clone(f.after),v=verifyMobileTrade(f);
  assert.equal(v.tradeAccepted,true);assert.equal(v.orderIndex,2);assert.equal(v.queueIndex,2);
  assert.equal(v.thew.cost,12);assert.equal(v.maximum,side==='buy'?20:900);assert.equal(v.initialValue,v.maximum);
  assert.deepEqual(v.checked,mobileTradeOracleContract.counts);assert.equal(v.publicInputAccepted,false);
  assert.equal(v.monthReturnAccepted,false);assert.equal(v.wholeNativeAbiAccepted,false);
  assert.deepEqual(f.before,b);assert.deepEqual(f.after,a);
});
test('Limit exposes actual GetFood min/max/initial and actual LIB cost12',()=>{
  const f=fixture();assert.deepEqual(calculateMobileTradeLimit({world:f.before,...f}),
    {side:'buy',minimum:1,maximum:20,initialValue:20,maximumConfirmable:20,cancelSentinel:65535,thewCost:12,orderIndex:2});
});
test('Only the new order stack fields have a finite nonsemantic mask',()=>{
  const v=verifyMobileTrade(fixture());assert.deepEqual(v.uninitializedOrderMask,
    {orderIndex:2,fields:['Object','Arms','Food','Money','Consume'],actual:{Object:65535,Arms:255,Food:600,Money:37,Consume:252},semanticAcceptance:false});
});
test('Current six-field order measurements do not invent unobserved stack fields',()=>{
  const f=fixture();for(const w of [f.before,f.after])for(const o of w.orders)for(const k of ['Arms','Money','Consume'])delete o[k];
  assert.deepEqual(verifyMobileTrade(f).uninitializedOrderMask.fields,['Object','Food']);
});
test('Buy maximum is floor(Money/5), with no minimum-money command cost',()=>{
  const f=fixture();f.before.cities[8].Money=104;f.quantity=20;f.after.cities[8].Money=4;f.after.cities[8].Food=920;
  assert.equal(verifyMobileTrade(f).maximum,20);
});
test('Buy minimum1 works with exactly5 money and exactly12 Thew',()=>{
  const f=fixture();f.before.cities[8].Money=5;f.before.people[62].Thew=12;f.quantity=1;
  f.after.cities[8].Money=0;f.after.cities[8].Food=901;f.after.people[62].Thew=0;
  assert.equal(verifyMobileTrade(f).food.delta,1);
});
test('Buy ADD16 saturates Food while charging the whole confirmed amount',()=>{
  const f=fixture();f.before.cities[8].Food=65530;f.after.cities[8].Food=65535;
  const v=verifyMobileTrade(f);assert.equal(v.food.delta,5);assert.equal(v.money.delta,-85);
});
test('Buy without fixOverFlow16 wraps Food as U16',()=>{
  const f=fixture();f.before.config.fixOverFlow16=f.after.config.fixOverFlow16=0;
  f.before.cities[8].Food=65530;f.after.cities[8].Food=11;assert.equal(verifyMobileTrade(f).food.after,11);
});
test('Sell exc*=2 wraps U16 before ADD16 Money, even when overflow fix is on',()=>{
  const f=fixture('sell');f.quantity=40000;f.before.cities[8].Food=50000;f.before.cities[8].Money=1000;
  f.after.cities[8].Food=10000;f.after.cities[8].Money=15464;
  assert.equal(verifyMobileTrade(f).money.exchangedU16,14464);
});
test('Sell ADD16 money saturation precedes the30000 cap',()=>{
  const f=fixture('sell');f.before.cities[8].Money=65530;f.after.cities[8].Money=30000;
  assert.equal(verifyMobileTrade(f).money.intermediateU16,65535);
});
test('Sell without overflow fix wraps money before applying the30000 cap',()=>{
  const f=fixture('sell');f.before.config.fixOverFlow16=f.after.config.fixOverFlow16=0;
  f.before.cities[8].Money=65530;f.after.cities[8].Money=28;
  assert.equal(verifyMobileTrade(f).money.intermediateU16,28);
});
test('Sell lower bound1 permits the last unit of Food',()=>{
  const f=fixture('sell');f.before.cities[8].Food=1;f.quantity=1;f.after.cities[8].Food=0;f.after.cities[8].Money=102;
  assert.equal(verifyMobileTrade(f).maximum,1);
});
test('Sell maximum65535 is initial value but cannot be a confirmed nonsentinel quantity',()=>{
  const f=fixture('sell');f.before.cities[8].Food=65535;f.quantity=65534;f.after.cities[8].Food=1;f.after.cities[8].Money=30000;
  assert.equal(calculateMobileTradeLimit({world:f.before,...f}).initialValue,65535);
  assert.equal(verifyMobileTrade(f).maximumConfirmable,65534);
  f.quantity=65535;assert.throws(()=>verifyMobileTrade(f),/nonsentinel/);
});
test('DelPerson leaves slot199 and all slots200..1999 unchanged',()=>{
  const f=fixture();verifyMobileTrade(f);assert.equal(f.after.queue[198],f.before.queue[199]);
  assert.equal(f.after.queue[199],f.before.queue[199]);assert.deepEqual(f.after.queue.slice(200),f.before.queue.slice(200));
});
test('First free order0 is used without changing other slots',()=>{
  const f=fixture();f.before.orders[0].OrderId=255;f.after.orders[0]=f.after.orders[2];f.after.orders[2]=clone(f.before.orders[2]);
  assert.equal(verifyMobileTrade(f).orderIndex,0);
});
test('Empty later city offset follows native U16 decrement including wrap',()=>{
  const f=fixture();f.before.cities[37].PersonQueue=0;f.after.cities[37].PersonQueue=65535;
  assert.equal(verifyMobileTrade(f).accepted,true);
});
test('Source-backed cancellation is full-world equality with no trade/input acceptance',()=>{
  const f=fixture(),v=verifyMobileTradeCancellation({before:f.before,after:clone(f.before),libBytes});
  assert.equal(v.cancellationWorldUnchanged,true);assert.equal(v.tradeAccepted,false);assert.equal(v.publicInputAccepted,false);
  assert.throws(()=>verifyMobileTradeCancellation(f));
});
const rejects=[
  ['unchanged world',f=>{f.after=clone(f.before);} ],
  ['zero quantity',f=>{f.quantity=0;}],
  ['noninteger quantity',f=>{f.quantity=1.5;}],
  ['quantity above current max',f=>{f.quantity=21;}],
  ['wrong side',f=>{f.side=0;}],
  ['actor is king',f=>{f.personId=5;}],
  ['foreign resident',f=>{f.personId=11;}],
  ['own actor outside selected city',f=>{f.personId=10;}],
  ['foreign city',f=>{f.before.cities[8].Belong=12;}],
  ['insufficient actual Thew',f=>{f.before.people[62].Thew=11;}],
  ['wrong original LIB bytes',f=>{f.libBytes=Buffer.from(libBytes);f.libBytes[100]^=1;}],
  ['truncated LIB',f=>{f.libBytes=libBytes.subarray(1);}],
  ['wrong Money debit',f=>{f.after.cities[8].Money=16;}],
  ['wrong Food credit',f=>{f.after.cities[8].Food=916;}],
  ['deprecated header Thew4',f=>{f.after.people[62].Thew=66;}],
  ['other person changed',f=>{f.after.people[63].Thew--;}],
  ['other city changed',f=>{f.after.cities[0].Money--;}],
  ['source reserve changed',f=>{f.after.cities[8].MothballArms++;}],
  ['wrong source population count',f=>{f.after.cities[8].Persons=3;}],
  ['uncompacted resident queue',f=>{f.after.queue=clone(f.before.queue);} ],
  ['queue slot199 cleared',f=>{f.after.queue[199]=0;}],
  ['queue tail200 shifted',f=>{f.after.queue[200]=f.before.queue[201];}],
  ['later empty-city offset not decremented',f=>{f.after.cities[37].PersonQueue=6;}],
  ['earlier city offset changed',f=>{f.after.cities[1].PersonQueue=1;}],
  ['second order written',f=>{f.after.orders[3].OrderId=11;}],
  ['order not first free slot',f=>{f.after.orders[3]=f.after.orders[2];f.after.orders[2]=clone(f.before.orders[2]);}],
  ['wrong initialized order field',f=>{f.after.orders[2].TimeCount=1;}],
  ['non-new slot stack bytes changed',f=>{f.after.orders[1].Food=600;}],
  ['new slot added field',f=>{f.after.orders[2].extra=0;}],
  ['new slot unknown field masked',f=>{f.before.orders[2].extra=1;f.after.orders[2].extra=2;}],
  ['new slot U16 stack out of range',f=>{f.after.orders[2].Object=65536;}],
  ['new slot NaN stack field',f=>{f.after.orders[2].Food=NaN;}],
  ['goods discovery bit changed',f=>{f.after.goodsQueue[1]=15;}],
  ['raw tool changed',f=>{f.after.tools[0].at++;}],
  ['fighter byte changed',f=>{f.after.fighters[0]=1;}],
  ['allocation flag changed',f=>{f.after.fighterIndex[0]=1;}],
  ['configuration changed',f=>{f.after.config.fixOverFlow16=0;}],
  ['missing current config',f=>{delete f.before.config.fixOverFlow16;}],
  ['invalid fix flag',f=>{f.before.config.fixOverFlow16=2;}],
  ['missing person field',f=>{delete f.before.people[0].Age;}],
  ['missing city inventory field',f=>{delete f.before.cities[0].Tools;}],
  ['overlapping city resident range',f=>{f.before.cities[9].PersonQueue=4;}],
  ['duplicate resident ID',f=>{f.before.queue[3]=62;}],
  ['invalid live resident ID',f=>{f.before.queue[3]=200;}],
  ['live range beyond native first200',f=>{f.before.cities[8].PersonQueue=199;}],
  ['unchanged extra NaN is not evidence',f=>{f.before.extra=NaN;f.after.extra=NaN;}],
  ['unchanged extra undefined is not evidence',f=>{f.before.extra=undefined;f.after.extra=undefined;}]
];
for(const [name,mutate] of rejects)test('Reject '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileTrade(f));});
for(const field of ['people','cities','queue','orders','fighters','fighterIndex','goodsQueue','tools']) {
  test('Reject truncated '+field,()=>{const f=fixture();f.before[field].pop();assert.throws(()=>verifyMobileTrade(f));});
  test('Reject sparse '+field,()=>{const f=fixture();delete f.after[field][0];assert.throws(()=>verifyMobileTrade(f));});
}
test('Explicitly reject zero-resource buy rather than misclassify the native order-only path',()=>{
  const f=fixture();f.before.cities[8].Money=4;assert.throws(()=>verifyMobileTrade(f),/Unsupported zero-resource/);
});
test('Explicitly reject zero-resource sell',()=>{
  const f=fixture('sell');f.before.cities[8].Food=0;assert.throws(()=>verifyMobileTrade(f),/Unsupported zero-resource/);
});
test('Explicitly reject full orders rather than invent atomic native rollback',()=>{
  const f=fixture();for(const o of f.before.orders)o.OrderId=0;assert.throws(()=>verifyMobileTrade(f),/Unsupported full-orders/);
});
test('Reject sell unlimited2x arithmetic in place of actual U16 exc',()=>{
  const f=fixture('sell');f.quantity=40000;f.before.cities[8].Food=50000;f.before.cities[8].Money=1000;
  f.after.cities[8].Food=10000;f.after.cities[8].Money=30000;assert.throws(()=>verifyMobileTrade(f));
});
test('Reject buy wrap when ADD16 is enabled and saturation when disabled',()=>{
  const f=fixture();f.before.cities[8].Food=65530;f.after.cities[8].Food=11;assert.throws(()=>verifyMobileTrade(f));
  f.before.config.fixOverFlow16=f.after.config.fixOverFlow16=0;f.after.cities[8].Food=65535;assert.throws(()=>verifyMobileTrade(f));
});
