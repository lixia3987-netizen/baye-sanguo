// Pure recorded-world checks. No input, native calls, file access or month execution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileTransferOracleContract = Object.freeze({
  scope:'One original TransportationMake or MoveMake dispatch, before another command or strategy month; measured world fields only',
  originalLib:Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
  counts:Object.freeze({people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30}),
  transport:Object.freeze({orderId:13,guardThew:8,costThew:8,initialized:Object.freeze(['OrderId','Person','City','Object','TimeCount','Food','Money','Arms']),uninitialized:Object.freeze(['Consume'])}),
  move:Object.freeze({orderId:14,guardThew:0,initialized:Object.freeze(['OrderId','Person','City','Object','TimeCount']),uninitialized:Object.freeze(['Arms','Food','Money','Consume'])}),
  nativeSources:Object.freeze(['vendor/iBaye/src/citycmdc.c:271-511','vendor/iBaye/src/cityedit.c:108-145,296-456,552-578,696-711,1343-1399',
    'vendor/iBaye/src/citycmde.c:428-464','vendor/iBaye/src/citycmdd.c:1033-1064','vendor/iBaye/src/inc/dictsys.h:62-68',
    'vendor/iBaye/src/baye/order.h:70-81','vendor/iBaye/src/gamEng.c:1285-1293']),
  monthReturnAccepted:false,publicInputAccepted:false,wholeNativeAbiAccepted:false
});
const PERSON=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'];
const CITY8=new Set(['State','AvoidCalamity','PeopleDevotion']);
const ORDER=['OrderId','City','Person','Object','TimeCount','Arms','Food','Money','Consume'];
const ORDER8=new Set(['OrderId','City','TimeCount','Consume']);
const CONFIG=['enable16bitConsumeMoney','checkRedundantOnAddPerson','armsPerMoney','armsPerDevotion','fixOverFlow16','fixThewOverFlow','enableCustomRatio',
  'ratioOfArmsToLevel','ratioOfArmsToAge','ratioOfArmsToIQ','ratioOfArmsToForce','disableExpGrowing','maxLevel','disableAllPersonReport'];
const FLAGS=['enable16bitConsumeMoney','checkRedundantOnAddPerson','fixOverFlow16','fixThewOverFlow','enableCustomRatio','disableExpGrowing','disableAllPersonReport'];
function integer(v,min,max,label) {assert.ok(Number.isInteger(v)&&v>=min&&v<=max,label+' integer '+min+'..'+max);return v;}
function dense(a,n,label) {
  assert.ok(Array.isArray(a)&&a.length===n,label+' exact length '+n);
  assert.equal(Object.keys(a).length,n,label+' indexed array only');
  for(let i=0;i<n;i++)assert.ok(Object.hasOwn(a,i),label+' missing index '+i);
}
function measurement(v,label,parents=new Set()) {
  if(typeof v==='number'){assert.ok(Number.isFinite(v),label+' finite number');return;}
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  assert.ok(typeof v==='object',label+' JSON measurement');assert.ok(!parents.has(v),label+' acyclic measurement');
  assert.equal(Object.getOwnPropertySymbols(v).length,0,label+' no symbol fields');
  assert.equal(Object.getPrototypeOf(v),Array.isArray(v)?Array.prototype:Object.prototype,label+' plain measurement');
  parents.add(v);if(Array.isArray(v))dense(v,v.length,label);
  for(const k of Object.keys(v)) {
    const d=Object.getOwnPropertyDescriptor(v,k);assert.ok(Object.hasOwn(d,'value'),label+' no accessor');measurement(d.value,label+'.'+k,parents);
  }
  parents.delete(v);
}
function vector(a,n,max,label) {dense(a,n,label);for(let i=0;i<n;i++)integer(a[i],0,max,label+'['+i+']');}
function shape(w,label) {
  assert.ok(w&&typeof w==='object'&&!Array.isArray(w),label+' world object');measurement(w,label);
  integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
  dense(w.people,200,label+'.people');
  for(let i=0;i<200;i++)for(const k of PERSON)integer(w.people[i][k],0,PERSON16.has(k)?65535:255,label+'.people['+i+'].'+k);
  dense(w.cities,38,label+'.cities');vector(w.queue,2000,65535,label+'.queue');
  const slots=new Set(),residents=new Set();
  for(let i=0;i<38;i++) {
    const c=w.cities[i];for(const k of CITY)integer(c[k],0,CITY8.has(k)?255:65535,label+'.cities['+i+'].'+k);
    if(c.Persons)assert.ok(c.PersonQueue+c.Persons<=200,label+' live resident range within first200');
    for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++) {
      assert.ok(!slots.has(j),label+' overlapping resident ranges');slots.add(j);
      const id=integer(w.queue[j],0,199,label+' resident PID');assert.ok(!residents.has(id),label+' duplicate resident PID');residents.add(id);
    }
    for(const k of ['Tools','ToolQueue'])if(Object.hasOwn(c,k))integer(c[k],0,65535,label+'.cities['+i+'].'+k);
  }
  vector(w.fighters,600,255,label+'.fighters');vector(w.fighterIndex,30,1,label+'.fighterIndex');
  if(Object.hasOwn(w,'goodsQueue'))vector(w.goodsQueue,2000,65535,label+'.goodsQueue');
  if(Object.hasOwn(w,'tools')) {
    dense(w.tools,33,label+'.tools');for(let i=0;i<33;i++)for(const k of ['useflag','changeAttackRange','at','iq','move','arm'])integer(w.tools[i][k],0,255,label+'.tools['+i+'].'+k);
  }
  assert.ok(w.config&&typeof w.config==='object'&&!Array.isArray(w.config),label+'.config');
  for(const k of CONFIG)integer(w.config[k],0,0xffffffff,label+'.config.'+k);
  for(const k of FLAGS)integer(w.config[k],0,1,label+'.config.'+k);
  dense(w.orders,200,label+'.orders');
  for(let i=0;i<200;i++)for(const k of ORDER)integer(w.orders[i][k],0,ORDER8.has(k)?255:65535,label+'.orders['+i+'].'+k);
}
function exact(a,b,label,path='$') {
  if(Object.is(a,b))return;
  assert.ok(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object',label+' differs at '+path);
  assert.equal(Array.isArray(a),Array.isArray(b),label+' kind at '+path);
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label+' fields at '+path);
  for(const k of Object.keys(b))exact(a[k],b[k],label,path+'.'+k);
}
function library(input) {
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=mobileTransferOracleContract.originalLib;
  assert.equal(b.length,ref.bytes,'Original LIB bytes');assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB SHA256');
  function item(id,index) {
    const base=b.readUInt32LE((id-1)*4);assert.ok(base+14<=b.length,'LIB resource header bounds');
    const length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);
    assert.equal(b.readUInt16LE(base+4),id,'Actual LIB resource identity');assert.ok(index<count&&base+length<=b.length,'LIB resource bounds');
    if(!fixed&&count!==1)assert.ok(14+count*8<=length,'LIB variable index bounds');
    const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(base+14+index*8);
    const size=fixed||(count===1?length-14:b.readUInt32LE(base+18+index*8));
    assert.ok(offset>=14&&offset+size<=length,'LIB payload bounds');return b.subarray(base+offset,base+offset+size);
  }
  const thew=item(2,9),positions=item(2,5),links=item(59,0);
  assert.equal(thew.length,28,'Actual ConsumeThew28');assert.equal(thew[13],8,'Original transport cost8');assert.equal(thew[14],0,'Original move guard/cost0');
  assert.equal(positions.length,76,'Actual city positions38');assert.equal(links.length,608,'Actual CITY_LINKR38x16');
  return {thew,positions,links};
}
function route(w,cityIndex,targetCityIndex,rom,sourceCursor,targetCursor) {
  integer(cityIndex,0,37,'cityIndex');integer(targetCityIndex,0,37,'targetCityIndex');assert.notEqual(cityIndex,targetCityIndex,'Different destination');
  const belong=w.cities[cityIndex].Belong;assert.equal(belong,w.king+1,'Player-owned origin');assert.equal(w.cities[targetCityIndex].Belong,belong,'Same-owned destination');
  const seen=new Set([cityIndex]),pending=[cityIndex];
  while(pending.length) {
    const c=pending.shift();for(const token of rom.links.subarray(c*16,c*16+8)) {
      if(!token)continue;const next=integer(token-1,0,37,'Actual CITY_LINKR target');
      if(w.cities[next].Belong===belong&&!seen.has(next)){seen.add(next);pending.push(next);}
    }
  }
  assert.ok(seen.has(targetCityIndex),'Actual same-owner CITY_LINKR closure reaches target');
  const origin={x:rom.positions[cityIndex*2],y:rom.positions[cityIndex*2+1]},target={x:rom.positions[targetCityIndex*2],y:rom.positions[targetCityIndex*2+1]};
  assert.equal(sourceCursor==null,targetCursor==null,'Both measured cursors or neither');
  if(sourceCursor!=null) {exact(sourceCursor,origin,'Measured saved source cursor matches original city');exact(targetCursor,target,'Measured confirmed destination cursor matches original city');}
  const distance=Math.abs(target.x-origin.x)+Math.abs(target.y-origin.y);integer(distance,1,254,'Native Manhattan TimeCount');
  return {cityIndex,targetCityIndex,sourceCursor:origin,targetCursor:target,timeCount:distance,connectedCities:[...seen].sort((a,b)=>a-b),measuredCursorAccepted:sourceCursor!=null};
}
function prepare(args) {
  const {world,cityIndex,targetCityIndex,personId,operation,libBytes,sourceCursor,targetCursor}=args;
  shape(world,'before');assert.ok(operation==='transport'||operation==='move','operation transport or move');integer(personId,0,199,'personId');
  const rom=library(libBytes),r=route(world,cityIndex,targetCityIndex,rom,sourceCursor,targetCursor),c=world.cities[cityIndex],p=world.people[personId];
  assert.equal(p.Belong,c.Belong,'Actual actor ownership');
  let queueIndex=-1;for(let i=c.PersonQueue;i<c.PersonQueue+c.Persons;i++)if(world.queue[i]===personId){queueIndex=i;break;}
  assert.ok(queueIndex>=0,'Actor selectable by actual GetCityPersons');
  const guardCost=rom.thew[operation==='transport'?13:14];assert.ok(p.Thew>=guardCost,'Actual IsManual guard');
  const thewCost=rom.thew[operation==='transport'||world.config.fixThewOverFlow===0?13:14];
  const thewAfter=world.config.fixOverFlow16?Math.max(0,p.Thew-thewCost):(p.Thew-thewCost)&255;
  return {r,c,p,queueIndex,guardCost,thewCost,thewAfter,orderIndex:world.orders.findIndex(o=>o.OrderId===255)};
}
/** Limits do not prove a quantity UI, trusted input, or an actual cursor publication. */
export function calculateMobileTransferLimit(args={}) {
  const p=prepare(args),{world,operation}=args;
  return {...p.r,operation,personId:args.personId,orderId:operation==='transport'?13:14,guardThew:p.guardCost,thewCost:p.thewCost,thewAfter:p.thewAfter,
    orderIndex:p.orderIndex,queueIndex:p.queueIndex,fullOrders:p.orderIndex<0,fixThewOverFlow:world.config.fixThewOverFlow,fixOverFlow16:world.config.fixOverFlow16,
    cargo:operation==='transport'?Object.fromEntries([['food',p.c.Food],['money',p.c.Money],['arms',p.c.MothballArms]].map(([k,max])=>[k,{minimum:0,maximum:max,initialValue:max,maximumConfirmable:Math.min(max,65534),cancelSentinel:65535}])):null};
}
function charged(args,p) {
  const {world,operation,cargo}=args,expected=structuredClone(world);expected.people[args.personId].Thew=p.thewAfter;
  if(operation==='transport') {
    assert.ok(cargo&&typeof cargo==='object'&&!Array.isArray(cargo),'Measured transport cargo');measurement(cargo,'cargo');
    assert.deepEqual(Object.keys(cargo).sort(),['arms','food','money'],'Only three transport quantities');
    for(const [k,f] of [['food','Food'],['money','Money'],['arms','MothballArms']]) {
      integer(cargo[k],0,65534,'Confirmed nonsentinel '+k);assert.ok(cargo[k]<=p.c[f],'Current native '+k+' maximum');expected.cities[args.cityIndex][f]-=cargo[k];
    }
  } else assert.equal(cargo,undefined,'Move has no measured cargo');
  return expected;
}
function verdict(args,p,phase) {
  return {ok:true,accepted:true,phase,operation:args.operation,cityIndex:args.cityIndex,targetCityIndex:args.targetCityIndex,personId:args.personId,
    route:p.r,thew:{before:p.p.Thew,after:p.thewAfter,guardCost:p.guardCost,cost:p.thewCost},fixThewOverFlow:args.world.config.fixThewOverFlow,
    fixOverFlow16:args.world.config.fixOverFlow16,checked:{...mobileTransferOracleContract.counts},publicInputAccepted:false,
    monthReturnAccepted:false,wholeNativeAbiAccepted:false,fullHdAccepted:false,
    limits:['Only recorded fields; no RNG, month arrival or whole native ABI acceptance','Caller proves original engine/no hooks, current owner, trusted input and report retirement',
      'TimeCount is Manhattan metadata; current PolicyExec does not decrement it before execution','Unknown new-order stack bytes are recorded only within the declared field mask']};
}
/** The completion report begins after costs, before AddOrderHead/DelPerson. Not the earlier target prompt report. */
export function verifyMobileTransferReport({before,during,...rest}={}) {
  const args={...rest,world:before},p=prepare(args),expected=charged(args,p);shape(during,'during');exact(during,expected,'Completion report: only charged Thew/cargo, no order/queue mutation yet');
  return {...verdict(args,p,'completion-report'),dispatchAccepted:false,reportWorldAccepted:true};
}
/** Sample after the completion report and native business have returned. A Move commit returns a fresh PERSON list. */
export function verifyMobileTransfer({before,after,during,outcome='queued',...rest}={}) {
  const args={...rest,world:before},p=prepare(args),expected=charged(args,p);shape(after,'after');
  assert.ok(outcome==='queued'||outcome==='full-order','Explicit native queued or full-order outcome');
  if(during!==undefined)verifyMobileTransferReport({before,during,...rest});
  const orderId=rest.operation==='transport'?13:14,mask=mobileTransferOracleContract[rest.operation].uninitialized;
  if(outcome==='full-order') {
    assert.equal(p.orderIndex,-1,'Full-order outcome requires all200 actual slots occupied');exact(after,expected,'Full AddOrderHead: charged costs remain, no order or DelPerson');
    return {...verdict(args,p,'full-order'),dispatchAccepted:false,partialMutationAccepted:true,orderIndex:null,uninitializedOrderMask:null};
  }
  assert.ok(p.orderIndex>=0,'Queued outcome requires first free255 order slot');
  const newOrder=after.orders[p.orderIndex];assert.deepEqual(Object.keys(newOrder).sort(),Object.keys(before.orders[p.orderIndex]).sort(),'New order measured field set unchanged');
  Object.assign(expected.orders[p.orderIndex],{OrderId:orderId,Person:rest.personId,City:rest.cityIndex,Object:rest.targetCityIndex,TimeCount:p.r.timeCount});
  if(rest.operation==='transport')Object.assign(expected.orders[p.orderIndex],{Food:rest.cargo.food,Money:rest.cargo.money,Arms:rest.cargo.arms});
  for(const k of mask)expected.orders[p.orderIndex][k]=newOrder[k];
  for(let i=p.queueIndex;i<199;i++)expected.queue[i]=expected.queue[i+1];
  expected.cities[rest.cityIndex].Persons--;
  for(let i=rest.cityIndex+1;i<38;i++)expected.cities[i].PersonQueue=(expected.cities[i].PersonQueue-1)&65535;
  exact(after,expected,'Completed dispatch: only charged costs, first free order, exact DelPerson allowed');
  return {...verdict(args,p,'queued'),dispatchAccepted:true,partialMutationAccepted:false,orderIndex:p.orderIndex,queueIndex:p.queueIndex,
    order:Object.fromEntries(mobileTransferOracleContract[rest.operation].initialized.map(k=>[k,newOrder[k]])),
    uninitializedOrderMask:{orderIndex:p.orderIndex,fields:[...mask],actual:Object.fromEntries(mask.map(k=>[k,newOrder[k]])),semanticAcceptance:false}};
}
/** Cancellation before a new commit leaves the entire measured world unchanged. Caller proves the actual stage/returned owner. */
export function verifyMobileTransferCancellation({before,after,libBytes}={}) {
  shape(before,'before');shape(after,'after');library(libBytes);exact(after,before,'Transfer cancellation must not mutate any measured world field');
  return {ok:true,accepted:true,cancellationWorldUnchanged:true,dispatchAccepted:false,publicInputAccepted:false,monthReturnAccepted:false,wholeNativeAbiAccepted:false,fullHdAccepted:false,
    checked:{...mobileTransferOracleContract.counts},limits:['Cancellation before a new commit only; not rollback of an earlier Move dispatch','Caller proves actual stage, cancel key and fresh returned owner']};
}
