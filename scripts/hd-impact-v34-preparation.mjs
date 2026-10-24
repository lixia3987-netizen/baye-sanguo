// Pure, scoped April preparation checks. No I/O, native input, RNG or actual credit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planRawBuy, verifyRawBuyDispatch} from './hd-impact-v26-raw-buy11-oracle.mjs';

export const V34_PREPARATION_CONTRACT = Object.freeze({
  period:4, king:0, date:Object.freeze([239,4]), origin:6, destination:12,
  caster:129, casterArms:1910, casterLevel:8, supplyCity:20, buyer:50,
  buyQuantity:153, buyCost:765, carryFood:421, minimumCash:500,
  ownedCities:Object.freeze([4,5,6,7,13,16,20]), guardIds:Object.freeze([51,36,5,21]),
  libraryBytes:207195, librarySha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',
  sourceOnly:true, scope:'Latest original239-4 only: one Buy153, one single129 north6→12 March421. Fresh public input, source, native budget and SAVE provenance remain caller obligations.',
});
const C=V34_PREPARATION_CONTRACT;
const falseCredit=()=>({sourceOnly:true,actualBuyAccepted:false,actualMarchAccepted:false,
  actualPreparationAccepted:false,actualBattleMpObserved:false,actualCastAccepted:false,
  classicAccepted:false,hdAccepted:false,globalHdComplete:false,rngContinuityAccepted:false});
const P={OldBelong:65535,Belong:65535,Level:255,Force:255,IQ:255,Devotion:255,
  Character:255,Experience:255,Thew:255,ArmsType:255,Arms:65535,Tool1:65535,Tool2:65535,Age:255};
const CITY={State:4,Belong:65535,SatrapId:65535,FarmingLimit:65535,Farming:65535,
  CommerceLimit:65535,Commerce:65535,PeopleDevotion:255,AvoidCalamity:255,
  PopulationLimit:0xffffffff,Population:0xffffffff,Money:65535,Food:65535,
  MothballArms:65535,PersonQueue:65535,Persons:65535,ToolQueue:65535,Tools:65535};
const O={OrderId:255,Person:65535,City:255,Object:65535,Arms:65535,Food:65535,
  Money:65535,Consume:255,TimeCount:255};
const integer=(v,max,label)=>assert.ok(Number.isInteger(v)&&v>=0&&v<=max,label);
function jsonData(v,parents=new Set()) {
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'){assert.ok(Number.isFinite(v));return;}
  assert.ok(v&&typeof v==='object'&&!parents.has(v),'Acyclic measured JSON data');
  assert.equal(Object.getPrototypeOf(v),Array.isArray(v)?Array.prototype:Object.prototype);
  assert.equal(Object.getOwnPropertySymbols(v).length,0);
  parents.add(v);
  for(const k of Object.keys(v)){const d=Object.getOwnPropertyDescriptor(v,k);assert.ok(Object.hasOwn(d,'value'),'No getter execution');jsonData(d.value,parents);}
  parents.delete(v);
}
function dense(v,n,max,label){
  assert.ok(Array.isArray(v)&&v.length===n&&Object.keys(v).length===n,label);
  for(let i=0;i<n;i++){assert.ok(Object.hasOwn(v,i));if(max!==null)integer(v[i],max,label);}
}
function shape(w){
  jsonData(w);assert.deepEqual([w.period,w.king,w.year,w.month],[4,0,239,4],'Only current April');
  for(const [k,n,max] of [['people',200,null],['cities',38,null],['orders',200,null],
    ['queue',2000,65535],['goodsQueue',2000,65535],['fighters',600,255],['fighterIndex',30,1]])dense(w[k],n,max,k);
  const typed=(obj,fields)=>{assert.ok(obj&&!Array.isArray(obj));for(const [k,max] of Object.entries(fields))integer(obj[k],max,k);};
  w.people.forEach(p=>typed(p,P));w.orders.forEach(o=>typed(o,O));
  const used=new Set();
  w.cities.forEach(c=>{typed(c,CITY);assert.ok(c.PersonQueue+c.Persons<=200);assert.ok(c.ToolQueue+c.Tools<=2000);
    for(let i=c.PersonQueue;i<c.PersonQueue+c.Persons;i++){assert.ok(!used.has(i),'Disjoint physical city slices');used.add(i);integer(w.queue[i],199,'Live raw PID');}});
  assert.deepEqual(w.cities.flatMap((c,i)=>c.Belong===1?[i]:[]),C.ownedCities);
  for(const [k,v] of Object.entries({enable16bitConsumeMoney:0,checkRedundantOnAddPerson:0,
    enableCustomRatio:0,maxLevel:20,ratioOfFoodToArmsPerMouth:0,ratioOfFoodToArmsPerDay:0}))assert.equal(w.config[k],v,'Current original config '+k);
  assert.ok(w.engineDebug===0||w.engineDebug===null);
  return w;
}
function library(bytes){
  assert.ok(Buffer.isBuffer(bytes)||ArrayBuffer.isView(bytes));const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(b.length,C.libraryBytes);assert.equal(createHash('sha256').update(b).digest('hex'),C.librarySha256);
  return b;
}
function item(b,id,index=0){
  const base=b.readUInt32LE((id-1)*4),length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);
  assert.equal(b.readUInt16LE(base+4),id);assert.ok(index<count&&base+length<=b.length);
  const offset=fixed?14+fixed*index:count===1?14:b.readUInt32LE(base+14+index*8);
  const size=fixed||(count===1?length-14:b.readUInt32LE(base+18+index*8));
  assert.ok(offset>=14&&size>0&&offset+size<=length);return b.subarray(base+offset,base+offset+size);
}
function rawLocations(w,id){return w.cities.flatMap((c,cityIndex)=>w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).flatMap((pid,j)=>pid===id?[{cityIndex,index:c.PersonQueue+j}]:[]));}
const residents=(w,city)=>{const c=w.cities[city];return w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>w.people[id].Belong===c.Belong);};
const pending=w=>w.orders.flatMap((order,orderIndex)=>order.OrderId===255?[]:[{order,orderIndex}]);
function uniqueResident(w,id,city){assert.deepEqual(rawLocations(w,id).map(x=>x.cityIndex),[city],'Selected current actor has one raw location');assert.equal(w.people[id].Belong,1);}
function checkCaster(w,{removed=false}={}){
  const p=w.people[C.caster];assert.deepEqual([p.Belong,p.Level,p.ArmsType,p.Arms,p.Tool1,p.Tool2,p.Thew],[1,8,3,1910,0,0,100],'Current source-qualified original navy');
  if(removed)assert.deepEqual(rawLocations(w,C.caster),[],'Selected caster only in pending army');else uniqueResident(w,C.caster,6);
  assert.equal(w.cities[6].SatrapId,130,'Native Satrap is retained during pending departure');
  assert.deepEqual(residents(w,6).filter(id=>id!==129),C.guardIds,'Four actual original guards retained in order');
  for(const id of C.guardIds)assert.equal(w.people[id].Arms,100);
}
function nativeBudget(w,b){
  assert.ok(b&&typeof b==='object');assert.deepEqual([b.dailyRatio,b.monthlyRatio,b.boutMax],[w.config.ratioOfFoodToArmsPerDay,w.config.ratioOfFoodToArmsPerMouth,30]);
  // CountProvUse uses PlcExtract=floor(sqrt(arms)), then integer division.
  const squareRoot=Math.floor(Math.sqrt(w.people[129].Arms)),daily=Math.floor(squareRoot/(b.dailyRatio||3));
  assert.equal(daily*b.boutMax+1,421);
  return {dailyRatioRaw:b.dailyRatio,monthlyRatioRaw:b.monthlyRatio,boutMax:b.boutMax,squareRoot,daily,carryFood:421,sourceOnly:true,actualBattleMpObserved:false};
}
function checkBuyPrefix(w){
  const active=pending(w);assert.equal(active.length,1,'Exactly this one paid Buy precedes March');
  const {order:o,orderIndex}=active[0];assert.equal(orderIndex,0);
  assert.deepEqual([o.OrderId,o.Person,o.City,o.TimeCount],[11,50,20,0]);
  assert.deepEqual([w.cities[20].Food,w.cities[20].Money,w.people[50].Thew],[267,570,88]);
  assert.deepEqual(rawLocations(w,50),[],'Buy actor is genuinely removed, not paid twice');assert.equal(w.people[50].Belong,1);
}
export function assessV34OwnedFood({world:w,includeReturningArmy=true,requireSafe=false}={}){
  shape(w);assert.equal(typeof includeReturningArmy,'boolean');const rows=[];
  for(const cityIndex of C.ownedCities){
    const c=w.cities[cityIndex],ids=residents(w,cityIndex),counted=new Set(ids);
    assert.equal(counted.size,ids.length,'No duplicate in a current owned slice');
    let total=c.MothballArms+ids.reduce((n,id)=>n+w.people[id].Arms,0);const pendingIds=[],returningArmy=[];
    for(const {order:o} of pending(w))if(o.City===cityIndex){
      if(o.OrderId===27){
        if(!includeReturningArmy)continue;integer(o.Person,29,'Army index');assert.equal(w.fighterIndex[o.Person],1);
        for(let j=0;j<10;j++){const at=20*o.Person+2*j,token=w.fighters[at]+256*w.fighters[at+1];if(!token)continue;integer(token,200,'Original one-based fighter token');const id=token-1;assert.equal(w.people[id].Belong,1);assert.ok(!counted.has(id),'Returning army cannot also be a resident or duplicate');counted.add(id);returningArmy.push(id);total+=w.people[id].Arms;}
      }else if(o.Person<200&&w.people[o.Person].Belong===1){assert.equal(o.OrderId,11,'Only the bounded Buy may be pending');assert.ok(!counted.has(o.Person));counted.add(o.Person);pendingIds.push(o.Person);total+=w.people[o.Person].Arms;}
    }
    assert.ok(total<=65535,'Conservative U16 army budget');const required=Math.floor(total/50)+1;
    rows.push({cityIndex,residentIds:ids,pendingIds,returningArmy,totalArms:total,requiredFood:required,food:c.Food,money:c.Money,actualSafe:c.Food>=required&&c.Money>=500});
  }
  const accepted=rows.every(r=>r.actualSafe);if(requireSafe)assert.equal(accepted,true,'Actual current food and500cash, never future income');
  return {accepted,rows,includeReturningArmy,futureIncomeAccepted:false,...falseCredit()};
}
export function planV34Preparation({world:w,libBytes,nativeBudget:budget}={}){
  shape(w);library(libBytes);assert.equal(pending(w).length,0,'Latest unspent April input only');assert.ok(w.fighterIndex.every(x=>x===0));checkCaster(w);uniqueResident(w,50,20);
  assert.deepEqual([w.cities[20].Food,w.cities[20].Money,w.people[50].Thew],[114,1335,100]);
  const food=assessV34OwnedFood({world:w});assert.deepEqual(food.rows.filter(r=>!r.actualSafe).map(r=>r.cityIndex),[20]);
  const buy=planRawBuy({world:w,cityIndex:20,personId:50,quantity:153,libBytes});
  assert.deepEqual([buy.money.after,buy.food.after,buy.thew.after],[570,267,88]);
  return {accepted:true,buy,budget:nativeBudget(w,budget),initialFood:food,nextAction:'original-Buy153-and-public-SAVE',...falseCredit()};
}
export function verifyV34BuyDispatch({before,after,libBytes,nativeBudget:budget}={}){
  const plan=planV34Preparation({world:before,libBytes,nativeBudget:budget});
  const delta=verifyRawBuyDispatch({before,after,cityIndex:20,personId:50,quantity:153,libBytes});
  shape(after);checkBuyPrefix(after);checkCaster(after);
  const food=assessV34OwnedFood({world:after,requireSafe:true});
  return {accepted:true,plan,delta,food,wholeMeasuredWorldExact:true,...falseCredit()};
}
export function planV34March({world:w,libBytes,nativeBudget:budget}={}){
  shape(w);const lib=library(libBytes);checkBuyPrefix(w);checkCaster(w);assert.ok(w.fighterIndex.every(x=>x===0));
  const cost=item(lib,2,10)[27];assert.equal(cost,0,'Original BATTLE money');
  const links=item(lib,59),positions=item(lib,2,5);assert.equal(positions.length,76);
  assert.ok([...links.subarray(6*16,6*16+8)].includes(13),'Original city6 links to city12');
  const timeCount=Math.abs(positions[12]-positions[24])+Math.abs(positions[13]-positions[25]);assert.equal(timeCount,1);
  assert.ok(w.cities[12].Belong!==0&&w.cities[12].Belong!==1,'Actual enemy destination');
  const food=assessV34OwnedFood({world:w,requireSafe:true}),beforeFood=w.cities[6].Food;
  assert.ok(beforeFood-421>=Math.floor(2310/50)+1,'Full1910 return plus400 guards conservatively funded');
  const b=nativeBudget(w,budget),orderIndex=w.orders.findIndex((o,i)=>i>=170&&o.OrderId===255),fight=w.fighterIndex.findIndex(x=>x===0);
  assert.equal(orderIndex,170);assert.equal(fight,0);
  return {accepted:true,origin:6,destination:12,personId:129,timeCount,orderIndex,fight,
    carryFood:421,foodAfter:beforeFood-421,moneyCost:0,thewCost:0,guardIds:[...C.guardIds],
    satrapId:130,food,budget:b,...falseCredit()};
}
function removed(w){
  const e=structuredClone(w),c=w.cities[6],at=rawLocations(w,129)[0].index;
  for(let i=at;i<199;i++)e.queue[i]=w.queue[i+1];e.cities[6].Persons--;
  for(let i=7;i<38;i++)e.cities[i].PersonQueue=(w.cities[i].PersonQueue-1)&65535;
  return e;
}
export function verifyV34MarchPartial({before,after,libBytes,nativeBudget:budget}={}){
  const plan=planV34March({world:before,libBytes,nativeBudget:budget});shape(after);
  assert.deepEqual(after,removed(before),'Only original first-match DelPerson, all raw tails/unknown fields retained');checkCaster(after,{removed:true});
  return {accepted:true,plan,wholeMeasuredWorldExact:true,satrap130PendingRetained:true,...falseCredit()};
}
export function verifyV34MarchDispatch({before,after,libBytes,nativeBudget:budget}={}){
  const plan=planV34March({world:before,libBytes,nativeBudget:budget});shape(after);const e=removed(before);
  e.cities[6].Food-=421;e.fighterIndex[plan.fight]=1;
  for(let j=0;j<20;j++)e.fighters[plan.fight*20+j]=j===0?130:0;
  Object.assign(e.orders[plan.orderIndex],{OrderId:27,Person:plan.fight,City:6,Object:12,Food:421,TimeCount:1});
  for(const [k,max] of [['Arms',65535],['Money',65535],['Consume',255]]){integer(after.orders[plan.orderIndex][k],max,'Native opaque stack '+k);e.orders[plan.orderIndex][k]=after.orders[plan.orderIndex][k];}
  assert.deepEqual(after,e,'Exact full native March; only original three stack fields are opaque');
  checkCaster(after,{removed:true});const food=assessV34OwnedFood({world:after,requireSafe:true});
  return {accepted:true,plan,food,order:structuredClone(after.orders[plan.orderIndex]),
    opaqueStackFields:['Arms','Money','Consume'],opaqueCargoSemanticsAccepted:false,
    satrap130PendingRetained:true,wholeMeasuredWorldExact:true,...falseCredit()};
}

// referenceWorld is the actual fully verified and saved Buy prefix, before
// March selection. This is an April pre-Battle safety check, not an AI/month
// transition oracle. Enemy MAKE may have changed unrelated raw city offsets.
export function verifyV34ProtectedPrefix({world:w,referenceWorld:ref,requireBuyReturned=true}={}){
  shape(w);shape(ref);checkBuyPrefix(ref);checkCaster(ref);
  assert.equal(typeof requireBuyReturned,'boolean');
  for(const city of C.ownedCities){
    assert.equal(w.cities[city].State,0,'ComputerTactic has actually reset old disasters before PolicyExec');
    assert.equal(w.cities[city].Money,ref.cities[city].Money,'No new payments/income before own Battle');
    assert.equal(w.cities[city].Food,ref.cities[city].Food-(city===6?421:0),'Only March food, never duplicate Exchange credit');
    const ids=[...new Set([...residents(ref,city),...(city===20?[50]:[])])];
    for(const id of ids){
      assert.deepEqual(w.people[id],ref.people[id],'Every complete protected person remains exact before combat '+id);
      if(id===129)continue;
      const returned=residents(w,city).filter(pid=>pid===id).length;
      if(id===50&&!requireBuyReturned){
        assert.ok(returned===0||returned===1);
        assert.equal(pending(w).filter(({order:o})=>o.OrderId===11&&o.City===20&&o.Person===50).length,returned===0?1:0);
      }else assert.equal(returned,1,'Every noncaster original person has returned to the original city '+id);
    }
  }
  checkCaster(w,{removed:true});
  const o=w.orders[170];assert.deepEqual([o.OrderId,o.Person,o.City,o.Object,o.Food,o.TimeCount],[27,0,6,12,421,1]);
  assert.equal(w.fighterIndex[0],1);assert.deepEqual(w.fighters.slice(0,20),[130,...Array(19).fill(0)]);
  if(requireBuyReturned){assert.equal(w.orders[0].OrderId,255);assert.equal(pending(w).filter(({order:o})=>o.OrderId===11&&o.Person===50).length,0);}
  const food=assessV34OwnedFood({world:w,requireSafe:true});
  return {accepted:true,requireBuyReturned,food,satrap130PendingRetained:true,
    completeOriginalOwnedPeoplePreserved:true,wholeAiOrMonthTransitionAccepted:false,...falseCredit()};
}
