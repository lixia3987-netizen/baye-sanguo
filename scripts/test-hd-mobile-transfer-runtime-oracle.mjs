import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileTransferOracleContract,calculateMobileTransferLimit,verifyMobileTransferReport,verifyMobileTransfer,verifyMobileTransferCancellation} from './hd-mobile-transfer-runtime-oracle.mjs';

const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url)),clone=structuredClone;
// Synthetic measured worlds use actual original LIB costs/links/coordinates.
// Literal charged/queued expectations are independent of the oracle implementation.
function fixture(operation='transport') {
  const person={Belong:0,OldBelong:0,Level:1,Experience:0,IQ:60,Force:60,Age:30,Devotion:80,Character:0,Thew:70,Arms:100,ArmsType:1,Tool1:0,Tool2:0};
  const city={Belong:0,SatrapId:0,State:0,AvoidCalamity:20,PeopleDevotion:70,Commerce:100,Money:100,Food:900,MothballArms:400,PersonQueue:6,Persons:0};
  const order={OrderId:255,City:0,Person:0,Object:0,TimeCount:0,Arms:0,Food:0,Money:0,Consume:0};
  const before={period:1,king:0,year:189,month:1,people:Array.from({length:200},()=>({...person})),cities:Array.from({length:38},()=>({...city})),
    queue:Array.from({length:2000},(_,i)=>1000+i),orders:Array.from({length:200},()=>({...order})),fighters:Array(600).fill(0),fighterIndex:Array(30).fill(0),
    config:{enable16bitConsumeMoney:0,checkRedundantOnAddPerson:1,armsPerMoney:10,armsPerDevotion:20,fixOverFlow16:1,fixThewOverFlow:0,
      enableCustomRatio:0,ratioOfArmsToLevel:100,ratioOfArmsToAge:10,ratioOfArmsToIQ:10,ratioOfArmsToForce:10,disableExpGrowing:0,maxLevel:255,disableAllPersonReport:0}};
  before.queue.splice(0,6,0,19,23,24,26,25);for(const id of [0,19,23,24,26,25])before.people[id].Belong=1;
  before.cities[0]={...city,Belong:1,PersonQueue:0,Persons:2};for(let i=1;i<10;i++)before.cities[i].PersonQueue=2;
  before.cities[10]={...city,Belong:1,PersonQueue:2,Persons:3};for(let i=11;i<15;i++)before.cities[i].PersonQueue=5;
  before.cities[15]={...city,Belong:1,PersonQueue:5,Persons:1};
  before.orders[0]={...order,OrderId:3,City:0,Person:9};before.orders[1]={...order,OrderId:16,City:2,Person:20};
  const during=clone(before);during.people[23].Thew=62;
  if(operation==='transport'){during.cities[10].Food=883;during.cities[10].Money=91;during.cities[10].MothballArms=394;}
  const after=clone(during);after.cities[10].Persons=2;
  // C DelPerson shifts only indices2..198; index199 and 200..1999 stay intact.
  after.queue=[...before.queue.slice(0,2),...before.queue.slice(3,200),before.queue[199],...before.queue.slice(200)];
  for(let i=11;i<15;i++)after.cities[i].PersonQueue=4;after.cities[15].PersonQueue=4;for(let i=16;i<38;i++)after.cities[i].PersonQueue=5;
  after.orders[2]={...order,OrderId:operation==='transport'?13:14,City:10,Person:23,Object:15,TimeCount:3,Consume:252,
    Arms:operation==='transport'?6:5678,Food:operation==='transport'?17:4567,Money:operation==='transport'?9:3456};
  return {before,during,after,operation,cityIndex:10,targetCityIndex:15,personId:23,libBytes,
    sourceCursor:{x:5,y:2},targetCursor:{x:7,y:3},...(operation==='transport'?{cargo:{food:17,money:9,arms:6}}:{})};
}
for(const op of ['transport','move']) {
  test(op+' completion report and queued result independently match entire measured world',()=>{
    const f=fixture(op),original=clone({before:f.before,during:f.during,after:f.after});
    const r=verifyMobileTransferReport(f),a=verifyMobileTransfer(f);
    assert.equal(r.reportWorldAccepted,true);assert.equal(r.dispatchAccepted,false);assert.equal(a.dispatchAccepted,true);
    assert.equal(a.orderIndex,2);assert.equal(a.queueIndex,2);assert.equal(a.order.Object,15);assert.equal(a.order.TimeCount,3);
    assert.equal(a.route.measuredCursorAccepted,true);assert.equal(a.thew.cost,8);assert.equal(a.monthReturnAccepted,false);assert.equal(a.publicInputAccepted,false);assert.equal(a.fullHdAccepted,false);
    assert.deepEqual({before:f.before,during:f.during,after:f.after},original);
  });
  test(op+' cancellation is exact full-world equality, without input/dispatch acceptance',()=>{
    const f=fixture(op),v=verifyMobileTransferCancellation({before:f.before,after:clone(f.before),libBytes});
    assert.equal(v.cancellationWorldUnchanged,true);assert.equal(v.dispatchAccepted,false);assert.throws(()=>verifyMobileTransferCancellation(f));
  });
  test(op+' full orders preserve real costs without moving actor or overwriting a slot',()=>{
    const f=fixture(op);for(const o of f.before.orders)o.OrderId=3;
    const full=clone(f.before);full.people[23].Thew=62;
    if(op==='transport')Object.assign(full.cities[10],{Food:883,Money:91,MothballArms:394});
    f.during=clone(full);f.after=full;f.outcome='full-order';
    const v=verifyMobileTransfer(f);assert.equal(v.partialMutationAccepted,true);assert.equal(v.dispatchAccepted,false);assert.equal(v.orderIndex,null);
    assert.throws(()=>verifyMobileTransfer({...f,outcome:'queued'}));
  });
}
test('Limits expose native three Get*(0,max,max) quantities, not trade minimum1',()=>{
  const f=fixture(),v=calculateMobileTransferLimit({world:f.before,...f});
  assert.deepEqual(v.cargo,{food:{minimum:0,maximum:900,initialValue:900,maximumConfirmable:900,cancelSentinel:65535},money:{minimum:0,maximum:100,initialValue:100,maximumConfirmable:100,cancelSentinel:65535},arms:{minimum:0,maximum:400,initialValue:400,maximumConfirmable:400,cancelSentinel:65535}});
  assert.equal(v.orderId,13);assert.equal(v.guardThew,8);assert.equal(v.timeCount,3);
});
test('Zero cargo/zero resources still consume transport Thew and enqueue actual order13',()=>{
  const f=fixture();f.cargo={food:0,money:0,arms:0};
  for(const w of [f.before,f.during,f.after])Object.assign(w.cities[10],{Food:0,Money:0,MothballArms:0});
  Object.assign(f.after.orders[2],{Food:0,Money:0,Arms:0});assert.equal(verifyMobileTransfer(f).dispatchAccepted,true);
});
test('Zero-resource full-order path accepts only its measured Thew debit, never a dispatch',()=>{
  const f=fixture();f.cargo={food:0,money:0,arms:0};
  for(const o of f.before.orders)o.OrderId=3;Object.assign(f.before.cities[10],{Food:0,Money:0,MothballArms:0});
  f.during=clone(f.before);f.during.people[23].Thew=62;f.after=clone(f.during);f.outcome='full-order';
  const v=verifyMobileTransfer(f);assert.equal(v.partialMutationAccepted,true);assert.equal(v.dispatchAccepted,false);assert.equal(v.monthReturnAccepted,false);
});
test('65535 is the native quantity cancel sentinel, not a valid cargo confirmation',()=>{
  const f=fixture();f.before.cities[10].Food=65535;
  assert.equal(calculateMobileTransferLimit({world:f.before,...f}).cargo.food.maximumConfirmable,65534);
  f.cargo.food=65535;assert.throws(()=>verifyMobileTransfer(f),/nonsentinel/);
});
test('Transport with exactly8 Thew reaches0 and preserves all other person fields',()=>{
  const f=fixture();f.before.people[23].Thew=8;f.during.people[23].Thew=f.after.people[23].Thew=0;assert.equal(verifyMobileTransfer(f).thew.after,0);
});
test('Move fixed Thew branch checks0 and charges0, without a fabricated resource effect',()=>{
  const f=fixture('move');for(const w of [f.before,f.during,f.after])w.config.fixThewOverFlow=1;
  f.during.people[23].Thew=f.after.people[23].Thew=70;
  assert.equal(verifyMobileTransfer(f).thew.cost,0);assert.equal(calculateMobileTransferLimit({world:f.before,...f}).cargo,null);
});
for(const fix of [0,1])test('Move legacy cost8 with Thew3 '+(fix?'saturates0':'wrapsU8 to251'),()=>{
  const f=fixture('move');for(const w of [f.before,f.during,f.after])w.config.fixOverFlow16=fix;
  f.before.people[23].Thew=3;f.during.people[23].Thew=f.after.people[23].Thew=fix?0:251;
  const v=verifyMobileTransfer(f);assert.equal(v.thew.guardCost,0);assert.equal(v.thew.after,fix?0:251);
});
test('Native queue199 and tail200..1999 remain untouched; empty later offset wraps U16',()=>{
  const f=fixture();f.before.cities[37].PersonQueue=f.during.cities[37].PersonQueue=0;f.after.cities[37].PersonQueue=65535;
  assert.equal(verifyMobileTransfer(f).dispatchAccepted,true);assert.equal(f.after.queue[199],f.before.queue[199]);assert.deepEqual(f.after.queue.slice(200),f.before.queue.slice(200));
});
test('First free order0 is used, not a battle order-end slot',()=>{
  const f=fixture();f.before.orders[0].OrderId=f.during.orders[0].OrderId=255;f.after.orders[0]=f.after.orders[2];f.after.orders[2]=clone(f.before.orders[2]);
  assert.equal(verifyMobileTransfer(f).orderIndex,0);
});
test('Only Consume is nonsemantic for transport; all four cargo/Consume fields for move',()=>{
  assert.deepEqual(verifyMobileTransfer(fixture()).uninitializedOrderMask.fields,['Consume']);
  const v=verifyMobileTransfer(fixture('move'));assert.deepEqual(v.uninitializedOrderMask.fields,['Arms','Food','Money','Consume']);assert.equal(v.uninitializedOrderMask.semanticAcceptance,false);
});
test('Same-owner connected closure permits a real indirect route through another own city',()=>{
  const f=fixture();f.before.cities[16].Belong=1;f.targetCityIndex=16;delete f.sourceCursor;delete f.targetCursor;
  const v=calculateMobileTransferLimit({world:f.before,...f});assert.ok(v.connectedCities.includes(15));assert.ok(v.connectedCities.includes(16));assert.equal(v.measuredCursorAccepted,false);
});
test('Unobserved cursor provenance is explicit, not an actual input claim',()=>{
  const f=fixture();delete f.sourceCursor;delete f.targetCursor;assert.equal(verifyMobileTransfer(f).route.measuredCursorAccepted,false);
});
test('Additional goods/tool measurements are preserved rather than silently dropped',()=>{
  const f=fixture();for(const w of [f.before,f.during,f.after]){w.goodsQueue=Array(2000).fill(0);w.tools=Array.from({length:33},()=>({useflag:0,changeAttackRange:0,at:0,iq:0,move:0,arm:0}));}
  verifyMobileTransfer(f);f.after.goodsQueue[1999]=1;assert.throws(()=>verifyMobileTransfer(f));
});
const rejects=[
  ['wrong operation',f=>{f.operation='march';}],
  ['same target as origin',f=>{f.targetCityIndex=10;}],
  ['foreign target',f=>{f.before.cities[15].Belong=2;}],
  ['empty target',f=>{f.before.cities[15].Belong=0;}],
  ['same-owned but disconnected target',f=>{f.targetCityIndex=0;delete f.sourceCursor;delete f.targetCursor;}],
  ['nonplayer origin',f=>{f.before.king=1;}],
  ['actor ownership differs',f=>{f.before.people[23].Belong=2;}],
  ['actor not current resident',f=>{f.personId=19;}],
  ['insufficient transport Thew',f=>{f.before.people[23].Thew=7;}],
  ['wrong measured source cursor',f=>{f.sourceCursor.x++;}],
  ['wrong measured target cursor',f=>{f.targetCursor.y--;}],
  ['only one cursor sampled',f=>{delete f.targetCursor;}],
  ['wrong original LIB',f=>{f.libBytes=Buffer.from(libBytes);f.libBytes[100]^=1;}],
  ['truncated LIB',f=>{f.libBytes=libBytes.subarray(1);} ],
  ['negative cargo',f=>{f.cargo.food=-1;}],
  ['fractional cargo',f=>{f.cargo.arms=1.5;}],
  ['excess food',f=>{f.cargo.food=901;}],
  ['excess money',f=>{f.cargo.money=101;}],
  ['excess reserve',f=>{f.cargo.arms=401;}],
  ['unmeasured cargo field',f=>{delete f.cargo.arms;}],
  ['unknown cargo field',f=>{f.cargo.extra=0;}],
  ['wrong food debit',f=>{f.after.cities[10].Food++;}],
  ['wrong money debit',f=>{f.after.cities[10].Money++;}],
  ['wrong reserve debit',f=>{f.after.cities[10].MothballArms++;}],
  ['destination resources credited before month',f=>{f.after.cities[15].Food+=17;}],
  ['wrong Thew cost4',f=>{f.after.people[23].Thew=66;}],
  ['actor arms incorrectly used as cargo',f=>{f.after.people[23].Arms-=6;}],
  ['other person changed',f=>{f.after.people[24].Thew--;}],
  ['non-source city changed',f=>{f.after.cities[0].Money--;}],
  ['old source Persons retained',f=>{f.after.cities[10].Persons=3;}],
  ['uncompacted queue',f=>{f.after.queue=clone(f.before.queue);} ],
  ['queue199 cleared',f=>{f.after.queue[199]=0;}],
  ['queue200 shifted',f=>{f.after.queue[200]=f.before.queue[201];}],
  ['later city offset retained',f=>{f.after.cities[37].PersonQueue=6;}],
  ['earlier city offset changed',f=>{f.after.cities[9].PersonQueue=1;}],
  ['wrong order target plus1',f=>{f.after.orders[2].Object=16;}],
  ['wrong order TimeCount edge-count1',f=>{f.after.orders[2].TimeCount=1;}],
  ['wrong order actor',f=>{f.after.orders[2].Person=24;}],
  ['wrong order origin',f=>{f.after.orders[2].City=15;}],
  ['wrong orderId',f=>{f.after.orders[2].OrderId=14;}],
  ['wrong initialized cargoArms',f=>{f.after.orders[2].Arms++;}],
  ['wrong initialized cargoMoney',f=>{f.after.orders[2].Money++;}],
  ['wrong initialized cargoFood',f=>{f.after.orders[2].Food++;}],
  ['order not first free',f=>{f.after.orders[3]=f.after.orders[2];f.after.orders[2]=clone(f.before.orders[2]);}],
  ['second new order',f=>{f.after.orders[3].OrderId=13;}],
  ['mask leaks to old order',f=>{f.after.orders[1].Consume=252;}],
  ['unknown new order field changed',f=>{for(const w of [f.before,f.during])w.orders[2].extra=1;f.after.orders[2].extra=2;}],
  ['new order added key',f=>{f.after.orders[2].extra=0;}],
  ['missing measured order Money',f=>{delete f.before.orders[2].Money;}],
  ['new Consume aboveU8',f=>{f.after.orders[2].Consume=256;}],
  ['fighter changed',f=>{f.after.fighters[0]=1;}],
  ['fighter allocation changed',f=>{f.after.fighterIndex[0]=1;}],
  ['month advanced',f=>{f.after.month=2;}],
  ['king changed',f=>{f.after.king=19;}],
  ['config changed',f=>{f.after.config.fixThewOverFlow=1;}],
  ['missing fixThewOverFlow',f=>{delete f.before.config.fixThewOverFlow;}],
  ['dirty fixThewOverFlow',f=>{f.before.config.fixThewOverFlow=2;}],
  ['dirty fixOverFlow16',f=>{f.before.config.fixOverFlow16=2;}],
  ['dirty boolean other config',f=>{f.before.config.disableAllPersonReport=2;}],
  ['missing person field',f=>{delete f.before.people[0].Age;}],
  ['nonfinite additional measurement',f=>{f.after.unobserved=NaN;}],
  ['queue hole',f=>{delete f.after.queue[900];}],
  ['duplicate live resident',f=>{f.before.queue[3]=23;}],
  ['overlapping city range',f=>{f.before.cities[15].PersonQueue=2;}],
  ['full outcome claimed with free slots',f=>{f.outcome='full-order';}],
  ['unknown outcome',f=>{f.outcome='rejected';}]
];
for(const [name,mutate] of rejects)test('Reject '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileTransfer(f));});
for(const [name,mutate] of [
  ['order written early',f=>{f.during.orders[2]=clone(f.after.orders[2]);}],
  ['resident removed early',f=>{f.during.queue=clone(f.after.queue);} ],
  ['source count changed early',f=>{f.during.cities[10].Persons--;}],
  ['report sampled before resource debit',f=>{f.during.cities[10].Food=900;}],
  ['report sampled before Thew debit',f=>{f.during.people[23].Thew=70;}]
])test('Reject report '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyMobileTransferReport(f));});
test('Move rejects supplied cargo instead of treating it as semantic stack bytes',()=>{const f=fixture('move');f.cargo={food:0,money:0,arms:0};assert.throws(()=>verifyMobileTransfer(f));});
test('Cancellation rejects a changed configuration even when resources match',()=>{const f=fixture();f.after=clone(f.before);f.after.config.fixThewOverFlow=1;assert.throws(()=>verifyMobileTransferCancellation(f));});
test('Full-order partial outcome rejects removal or slot overwriting',()=>{
  const f=fixture();for(const o of f.before.orders)o.OrderId=3;f.during=clone(f.before);f.during.people[23].Thew=62;Object.assign(f.during.cities[10],{Food:883,Money:91,MothballArms:394});f.after=clone(f.during);f.outcome='full-order';
  f.after.cities[10].Persons--;assert.throws(()=>verifyMobileTransfer(f));f.after=clone(f.during);f.after.orders[2].Object=15;assert.throws(()=>verifyMobileTransfer(f));
});
test('Contract never claims month return, public input or full native ABI',()=>{
  assert.equal(mobileTransferOracleContract.monthReturnAccepted,false);assert.equal(mobileTransferOracleContract.publicInputAccepted,false);assert.equal(mobileTransferOracleContract.wholeNativeAbiAccepted,false);
});
