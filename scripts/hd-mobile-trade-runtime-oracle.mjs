// Pure measured-world oracle; never calls native code, sends input or writes files.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileTradeOracleContract = Object.freeze({
  scope:'One ordinary original ExchangeMake buy/sell confirmation, before another command or strategy month; recorded system worldSource fields only',
  originalLib:Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
  counts:Object.freeze({people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30,goodsQueue:2000,tools:33}),
  orderId:11,
  initializedOrderFields:Object.freeze(['OrderId','Person','City','TimeCount']),
  uninitializedOrderFields:Object.freeze(['Object','Arms','Food','Money','Consume']),
  nativeSources:Object.freeze([
    'vendor/iBaye/src/citycmdc.c:55-180 (ExchangeMake)',
    'vendor/iBaye/src/citycmde.c:428-464 (IsManual/OrderConsumeThew)',
    'vendor/iBaye/src/citycmdd.c:987-1017,1033-1064 (canAddOrder/AddOrderHead)',
    'vendor/iBaye/src/cityedit.c:108-145,696-711,1343-1352 (DelPerson/GetCityPersons/GetFood)',
    'vendor/iBaye/src/gamEng.c:1285-1293 (add_16)',
    'vendor/iBaye/src/baye/order.h:70-81 (OrderType)'
  ])
});
const PERSON=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons','Tools','ToolQueue'];
const CITY8=new Set(['State','AvoidCalamity','PeopleDevotion']);
const ORDER=['OrderId','City','Person','Object','TimeCount','Food'];
const ORDER8=new Set(['OrderId','City','TimeCount','Consume']);
const CONFIG=['enable16bitConsumeMoney','checkRedundantOnAddPerson','armsPerMoney','armsPerDevotion','fixOverFlow16','enableCustomRatio',
  'ratioOfArmsToLevel','ratioOfArmsToAge','ratioOfArmsToIQ','ratioOfArmsToForce','disableExpGrowing','maxLevel','disableAllPersonReport'];
function integer(v,min,max,label) {
  assert.ok(Number.isInteger(v)&&v>=min&&v<=max,label+' integer '+min+'..'+max);return v;
}
function dense(a,n,label) {
  assert.ok(Array.isArray(a)&&a.length===n,label+' exact length '+n);
  for(let i=0;i<n;i++)assert.ok(Object.hasOwn(a,i),label+' missing index '+i);
}
// Reject invalid numbers even in unchanged extra measured fields. Array holes
// and undefined are evidence omissions, not native zeroes.
function json(v,label,parents=new Set()) {
  if(typeof v==='number'){assert.ok(Number.isFinite(v),label+' finite number');return;}
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  assert.ok(typeof v==='object',label+' JSON measurement');
  assert.ok(!parents.has(v),label+' acyclic measurement');parents.add(v);
  assert.equal(Object.getOwnPropertySymbols(v).length,0,label+' no symbol fields');
  if(Array.isArray(v)) {
    dense(v,v.length,label);assert.equal(Object.keys(v).length,v.length,label+' indexed array only');
  } else assert.equal(Object.prototype.toString.call(v),'[object Object]',label+' plain measurement object');
  for(const k of Object.keys(v)) {
    assert.ok(Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'),label+' no accessor measurement');
    json(v[k],label+'.'+k,parents);
  }
  parents.delete(v);
}
function vector(a,n,max,label) {
  dense(a,n,label);for(let i=0;i<n;i++)integer(a[i],0,max,label+'['+i+']');
}
function shapeWorld(w,label) {
  assert.ok(w&&typeof w==='object'&&!Array.isArray(w),label+' actual worldSource object');json(w,label);
  integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');
  integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
  dense(w.people,200,label+'.people');
  for(let i=0;i<200;i++)for(const k of PERSON)integer(w.people[i]?.[k],0,PERSON16.has(k)?65535:255,label+'.people['+i+'].'+k);
  dense(w.cities,38,label+'.cities');vector(w.queue,2000,65535,label+'.queue');vector(w.goodsQueue,2000,65535,label+'.goodsQueue');
  const slots=new Set(),residents=new Set(),goodsSlots=new Set();
  for(let i=0;i<38;i++) {
    const c=w.cities[i];for(const k of CITY)integer(c?.[k],0,CITY8.has(k)?255:65535,label+'.cities['+i+'].'+k);
    // Empty offsets can wrap as U16 in DelPerson; only live ranges dereference.
    if(c.Persons)assert.ok(c.PersonQueue+c.Persons<=200,label+' live resident range within first200');
    for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++) {
      assert.ok(!slots.has(j),label+' overlapping resident ranges');slots.add(j);
      const pid=integer(w.queue[j],0,199,label+' resident PID');assert.ok(!residents.has(pid),label+' duplicate resident PID');residents.add(pid);
    }
    if(c.Tools)assert.ok(c.ToolQueue+c.Tools<=2000,label+' live goods range within2000');
    for(let j=c.ToolQueue;j<c.ToolQueue+c.Tools;j++) {
      assert.ok(!goodsSlots.has(j),label+' overlapping goods ranges');goodsSlots.add(j);
      integer(w.goodsQueue[j]&0x7fff,0,32,label+' original active goods ID');
    }
  }
  vector(w.fighters,600,255,label+'.fighters');vector(w.fighterIndex,30,1,label+'.fighterIndex');
  dense(w.tools,33,label+'.tools');
  for(let i=0;i<33;i++)for(const k of ['useflag','changeAttackRange','at','iq','move','arm'])integer(w.tools[i]?.[k],0,255,label+'.tools['+i+'].'+k);
  assert.ok(w.config&&typeof w.config==='object'&&!Array.isArray(w.config),label+'.config object');
  for(const k of CONFIG)integer(w.config[k],0,0xffffffff,label+'.config.'+k);
  integer(w.config.fixOverFlow16,0,1,label+'.config.fixOverFlow16');
  dense(w.orders,200,label+'.orders');
  for(let i=0;i<200;i++) {
    const o=w.orders[i];for(const k of ORDER)integer(o?.[k],0,ORDER8.has(k)?255:65535,label+'.orders['+i+'].'+k);
    for(const k of ['Arms','Money','Consume'])if(Object.hasOwn(o,k))integer(o[k],0,ORDER8.has(k)?255:65535,label+'.orders['+i+'].'+k);
  }
}
function exact(a,b,label,path='$') {
  if(Object.is(a,b))return;
  assert.ok(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object',label+' differs at '+path);
  assert.equal(Array.isArray(a),Array.isArray(b),label+' kind at '+path);
  const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();assert.deepEqual(ak,bk,label+' fields at '+path);
  for(const k of bk)exact(a[k],b[k],label,path+'.'+k);
}
function library(input) {
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=mobileTradeOracleContract.originalLib;
  assert.equal(b.length,ref.bytes,'Original LIB bytes');assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB SHA256');
  const base=b.readUInt32LE(4),length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8),index=9;
  assert.equal(b.readUInt16LE(base+4),2,'Actual IFACE resource');assert.ok(count>index&&base+length<=b.length,'IFACE bounds');
  const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(base+14+index*8);
  const size=fixed||(count===1?length-14:b.readUInt32LE(base+18+index*8));
  assert.ok(offset>=14&&offset+size<=length,'ConsumeThew payload bounds');assert.equal(size,28,'Actual original ConsumeThew28 U8');
  const thewCost=b[base+offset+11];assert.equal(thewCost,12,'Actual original trade Thew12');return thewCost;
}
function eligibility(world,cityIndex,personId,side,libBytes) {
  shapeWorld(world,'world');integer(cityIndex,0,37,'cityIndex');integer(personId,0,199,'personId');
  assert.ok(side==='buy'||side==='sell','side buy or sell');assert.notEqual(personId,world.king,'Normal nonking trade actor required');
  const c=world.cities[cityIndex],p=world.people[personId],thewCost=library(libBytes);
  assert.equal(c.Belong,world.king+1,'Actual player-owned city');assert.equal(p.Belong,c.Belong,'Actual actor ownership');
  const queueIndex=world.queue.indexOf(personId,c.PersonQueue);
  assert.ok(queueIndex>=c.PersonQueue&&queueIndex<c.PersonQueue+c.Persons,'Actor selectable by actual GetCityPersons');
  assert.ok(p.Thew>=thewCost,'Actual IsManual guard');
  const maximum=side==='buy'?Math.floor(c.Money/5):c.Food;
  assert.ok(maximum>=1,'Unsupported zero-resource path: native may still consume Thew and enqueue an order');
  const orderIndex=world.orders.findIndex(o=>o.OrderId===255);
  assert.ok(orderIndex>=0,'Unsupported full-orders path: native resources/Thew may already change before AddOrderHead fails');
  return {c,p,queueIndex,orderIndex,thewCost,maximum};
}
/** Native GetFood(1,max) starts at max; 65535 is a cancel sentinel even when max=65535. */
export function calculateMobileTradeLimit({world,cityIndex,personId,side,libBytes}={}) {
  const {maximum,thewCost,orderIndex}=eligibility(world,cityIndex,personId,side,libBytes);
  return {side,minimum:1,maximum,initialValue:maximum,maximumConfirmable:Math.min(maximum,65534),cancelSentinel:65535,thewCost,orderIndex};
}
/** Caller proves the actual quantity owner/input and samples after native business completes, before any month. */
export function verifyMobileTrade({before,after,cityIndex,personId,side,quantity,libBytes}={}) {
  const {c,p,queueIndex,orderIndex,thewCost,maximum}=eligibility(before,cityIndex,personId,side,libBytes);
  shapeWorld(after,'after');integer(quantity,1,65534,'Confirmed nonsentinel quantity');assert.ok(quantity<=maximum,'Current native GetFood maximum');
  const expected=structuredClone(before),fix=before.config.fixOverFlow16===1;
  const exchangedMoney=side==='buy'?quantity*5:(quantity*2)&65535;
  const foodAfter=side==='buy'?(fix?Math.min(c.Food+quantity,65535):(c.Food+quantity)&65535):c.Food-quantity;
  const moneyIntermediate=side==='buy'?c.Money-exchangedMoney:(fix?Math.min(c.Money+exchangedMoney,65535):(c.Money+exchangedMoney)&65535);
  const moneyAfter=side==='sell'?Math.min(moneyIntermediate,30000):moneyIntermediate;
  expected.cities[cityIndex].Food=foodAfter;expected.cities[cityIndex].Money=moneyAfter;
  expected.people[personId].Thew=p.Thew-thewCost;
  const newOrder=after.orders[orderIndex];exact(Object.keys(newOrder).sort(),Object.keys(before.orders[orderIndex]).sort(),'New order sampled fields');
  expected.orders[orderIndex]={...expected.orders[orderIndex],OrderId:11,Person:personId,City:cityIndex,TimeCount:0};
  const masked=mobileTradeOracleContract.uninitializedOrderFields.filter(k=>Object.hasOwn(newOrder,k));
  for(const k of masked)expected.orders[orderIndex][k]=newOrder[k];
  for(let i=queueIndex;i<199;i++)expected.queue[i]=expected.queue[i+1];
  expected.cities[cityIndex].Persons--;
  for(let i=cityIndex+1;i<38;i++)expected.cities[i].PersonQueue=(expected.cities[i].PersonQueue-1)&65535;
  exact(after,expected,'Only actual ExchangeMake resource/Thew/order/DelPerson changes permitted');
  return {ok:true,accepted:true,tradeAccepted:true,scope:mobileTradeOracleContract.scope,side,cityIndex,personId,quantity,
    minimum:1,maximum,initialValue:maximum,maximumConfirmable:Math.min(maximum,65534),orderIndex,queueIndex,
    order:{OrderId:11,Person:personId,City:cityIndex,TimeCount:0},fixOverFlow16:fix,
    food:{before:c.Food,after:foodAfter,delta:foodAfter-c.Food},
    money:{before:c.Money,after:moneyAfter,delta:moneyAfter-c.Money,exchangedU16:exchangedMoney,intermediateU16:moneyIntermediate},
    thew:{before:p.Thew,after:p.Thew-thewCost,cost:thewCost},
    uninitializedOrderMask:{orderIndex,fields:masked,actual:Object.fromEntries(masked.map(k=>[k,newOrder[k]])),semanticAcceptance:false},
    checked:{...mobileTradeOracleContract.counts},publicInputAccepted:false,monthReturnAccepted:false,wholeNativeAbiAccepted:false,
    limits:['Only recorded world fields; no RNG or unobserved native ABI acceptance','Caller proves standard native execution, no hook/debug bypass, trusted input and completed business timing',
      'GetFood initial value is a source contract, not an observed input claim','New order stack fields are recorded without cargo or other business meaning','Zero-resource and full-order partial-mutation paths are unsupported']};
}
/** Mutation-only evidence for a caller-proven menu/quantity cancellation; not proof of its input or returned owner. */
export function verifyMobileTradeCancellation({before,after,libBytes}={}) {
  shapeWorld(before,'before');shapeWorld(after,'after');library(libBytes);exact(after,before,'Trade cancellation must not mutate recorded world');
  return {ok:true,accepted:true,cancellationWorldUnchanged:true,tradeAccepted:false,publicInputAccepted:false,monthReturnAccepted:false,wholeNativeAbiAccepted:false,
    checked:{...mobileTradeOracleContract.counts},limits:['Caller proves actual cancellation and fresh returned owner','Only recorded world fields; no RNG or whole native ABI claim']};
}
