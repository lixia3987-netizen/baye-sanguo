// Pure saved-evidence oracle. No filesystem, process, browser, input or native writes.
// Scope: original P1 Ma Teng city8 -> enemy city9; recorded worldSource fields only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileBattleOracleContract = Object.freeze({
  scope: 'Measured public-march and single-rest effects; no HD MARCH, battle-win or full-native-ABI acceptance',
  originalLib: Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
  worldCounts: {people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30},
  requiredMarchSamples: ['worldSource before/after','qty active/min/max/value','fighterIndex[30]','config.enable16bitConsumeMoney','actual standard LIB bytes','actual ordered selectedPersonIds'],
  unobservedOrderFields: ['Arms','Money','Consume'],
  nativeSources: [
    'vendor/iBaye/src/citycmdd.c:110-141,175-211,1079-1093,1133-1151',
    'vendor/iBaye/src/cityedit.c:108-145,506-536,696-711',
    'vendor/iBaye/src/citycmde.c:357-365,404-412',
    'vendor/iBaye/src/FightSub.c:53-85,980-991',
    'vendor/iBaye/src/PublicFun.c:687-716',
    'vendor/iBaye/src/bind-objects.c:158,415,580-581'
  ]
});
const PERSON_FIELDS = ['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON_U16 = new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY_FIELDS = ['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'];
const ORDER_FIELDS = ['OrderId','City','Person','Object','TimeCount','Food'];
const integer = (value,min,max,label) => {assert.ok(Number.isInteger(value)&&value>=min&&value<=max,label+' must be an integer in '+min+'..'+max);return value;};
function array(value,length,max,label) {
  assert.ok(Array.isArray(value)&&value.length===length,label+' exact length '+length);
  value.forEach((v,i)=>integer(v,0,max,label+'['+i+']'));return value;
}
function shapeWorld(w,label) {
  assert.ok(w&&typeof w==='object',label+' actual saved world');
  integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');
  integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
  assert.ok(Array.isArray(w.people)&&w.people.length===200,label+' 200 people');
  for(const [i,p] of w.people.entries())for(const k of PERSON_FIELDS)integer(p?.[k],0,PERSON_U16.has(k)?65535:255,label+'.people['+i+'].'+k);
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,label+' 38 cities');
  for(const [i,c] of w.cities.entries()){
    for(const k of CITY_FIELDS)integer(c?.[k],0,['State','PeopleDevotion','AvoidCalamity'].includes(k)?255:65535,label+'.cities['+i+'].'+k);
    assert.ok(c.PersonQueue+c.Persons<=200,label+' city queue lies in native active first200');
  }
  array(w.queue,2000,65535,label+'.queue');
  array(w.fighters,600,255,label+'.fighters');array(w.fighterIndex,30,1,label+'.fighterIndex');
  assert.ok(w.config&&typeof w.config==='object',label+' actual configuration sample required');
  integer(w.config.enable16bitConsumeMoney,0,1,label+'.config.enable16bitConsumeMoney');
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,label+' all 200 order slots');
  for(const [i,o] of w.orders.entries())for(const k of ORDER_FIELDS)integer(o?.[k],0,['OrderId','City','TimeCount'].includes(k)?255:65535,label+'.orders['+i+'].'+k);
}
// Avoid enormous assertion diffs; report only the first measured path mismatch.
function exact(actual,expected,label,path='$') {
  if(Object.is(actual,expected))return;
  assert.ok(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object',label+' differs at '+path);
  assert.equal(Array.isArray(actual),Array.isArray(expected),label+' kind differs at '+path);
  const a=Object.keys(actual).sort(),e=Object.keys(expected).sort();
  assert.deepEqual(a,e,label+' field set differs at '+path);
  for(const k of e)exact(actual[k],expected[k],label,path+'.'+k);
}
function libraryBytes(input) {
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Supply the actual frozen original LIB bytes');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=mobileBattleOracleContract.originalLib;
  assert.equal(b.length,ref.bytes,'Original LIB byte length');
  assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB identity');return b;
}
function item(b,id,index=0) {
  const table=(id-1)*4;assert.ok(table>=0&&table+4<=b.length,'Resource table range');
  const base=b.readUInt32LE(table);assert.ok(base+14<=b.length,'Resource header range');
  const length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);
  assert.equal(b.readUInt16LE(base+4),id,'Resource exact ID');
  assert.ok(index>=0&&index<count&&base+length<=b.length,'Resource item range');
  const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(base+14+index*8);
  const size=fixed|| (count===1?length-14:b.readUInt32LE(base+18+index*8));
  assert.ok(offset>=14&&size>0&&offset+size<=length,'Resource payload bounds');return b.subarray(base+offset,base+offset+size);
}
function residents(w,city) {
  const c=w.cities[city];return w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>{
    integer(id,0,199,'Current resident PID');return w.people[id].Belong===c.Belong;
  });
}
function delPerson(w,city,pid) {
  const c=w.cities[city],end=c.PersonQueue+c.Persons;
  let i=c.PersonQueue;while(i<end&&w.queue[i]!==pid)i++;
  assert.ok(i<end,'Selected person is a current source resident');
  // DelPerson stops at PERSON_COUNT-1, not PERSON_MAX-1; slot199 is not zeroed.
  for(;i<199;i++)w.queue[i]=w.queue[i+1];
  c.Persons--;for(let j=city+1;j<38;j++)w.cities[j].PersonQueue--;
}
function fighterTokens(bytes,slot) {
  return Array.from({length:10},(_,i)=>bytes[slot*20+i*2]+bytes[slot*20+i*2+1]*256);
}
/**
 * before/after: exact worldSource objects including new fighterIndex/config fields.
 * qty: actual still-active GetFood publication. selectedPersonIds: ordered actual
 * zero-based chosen PIDs recorded from actual picker selection acknowledgements.
 */
export function verifyMobileBattleMarch({before,after,qty,libBytes,selectedPersonIds}={}) {
  shapeWorld(before,'before');shapeWorld(after,'after');const b=libraryBytes(libBytes);
  assert.equal(before.period,1,'This oracle is scoped to original P1');assert.equal(before.king,5,'Original Ma Teng PID5');
  const origin=8,target=9,c=before.cities[origin];
  assert.equal(c.Belong,before.king+1,'Actual source ownership');
  assert.ok(before.cities[target].Belong>0&&before.cities[target].Belong!==c.Belong,'Actual enemy destination');
  assert.ok(qty&&qty.active===1,'Actual active GetFood publication');
  integer(qty.min,0,65535,'qty.min');integer(qty.max,0,65535,'qty.max');integer(qty.value,0,65535,'qty.value');
  assert.equal(qty.min,1,'Original GetFood minimum');assert.equal(qty.max,c.Food,'Original current source grain maximum');
  assert.ok(qty.value>=qty.min&&qty.value<=qty.max,'Actual confirmed quantity within native bounds');
  const moneyItem=item(b,2,10),wide=before.config.enable16bitConsumeMoney;
  const moneyOffset=27*(wide?2:1);assert.ok(moneyOffset+(wide?2:1)<=moneyItem.length,'Actual money mode requires complete ROM cost; never read past item');
  const moneyCost=wide?moneyItem.readUInt16LE(moneyOffset):moneyItem[moneyOffset];
  assert.ok(c.Money>=moneyCost,'Actual native money budget');
  const positions=item(b,2,5),links=item(b,59,0);
  assert.ok(positions.length>=76&&links.length>=(origin+1)*16,'Actual native city geometry/link table');
  assert.ok(Array.from(links.subarray(origin*16,origin*16+8)).includes(target+1),'Native AttackCityRoad actual direct link');
  const distance=Math.abs(positions[origin*2]-positions[target*2])+Math.abs(positions[origin*2+1]-positions[target*2+1]);
  integer(distance,0,254,'Native Manhattan route time');
  const expected=structuredClone(before),selected=[];
  assert.ok(Array.isArray(selectedPersonIds)&&selectedPersonIds.length>=1&&selectedPersonIds.length<=10,'Actual ordered selection IDs, 1..10');
  for(const pid of selectedPersonIds){integer(pid,0,199,'Selected native PID');assert.ok(!selected.includes(pid),'Unique selected person');
    assert.ok(residents(expected,origin).includes(pid),'Actual same-owner resident selection');selected.push(pid);delPerson(expected,origin,pid);}
  const slot=before.fighterIndex.indexOf(0);assert.ok(slot>=0,'Native first free fighter slot');
  const orderIndex=before.orders.findIndex((o,i)=>i>=170&&o.OrderId===255);assert.ok(orderIndex>=170,'Native AddOrderEnd first free fight-order row');
  const changed=before.orders.flatMap((o,i)=>after.orders[i].OrderId!==o.OrderId?[i]:[]);
  exact(changed,[orderIndex],'Exactly one new occupied order row');
  for(const o of before.orders)if(o.OrderId===27)assert.notEqual(o.Person,slot,'Free fighter slot cannot already have a BATTLE order');
  const order=after.orders[orderIndex];
  assert.equal(order.OrderId,27);assert.equal(order.City,origin);assert.equal(order.Object,target);
  assert.equal(order.Person,slot);assert.equal(order.TimeCount,distance);assert.equal(order.Food,qty.value);
  expected.orders[orderIndex]={...expected.orders[orderIndex],OrderId:27,City:origin,Object:target,Person:slot,TimeCount:distance,Food:qty.value};
  expected.fighterIndex[slot]=1;
  const tokens=Array.from({length:10},(_,i)=>i<selected.length?selected[i]+1:0);
  tokens.forEach((v,i)=>{expected.fighters[slot*20+i*2]=v&255;expected.fighters[slot*20+i*2+1]=v>>>8;});
  exact(fighterTokens(after.fighters,slot),tokens,'Exact ten LE U16 selected IDs+1 and zero tail');
  expected.cities[origin].Food-=qty.value;expected.cities[origin].Money-=moneyCost;
  exact(after,expected,'Only native march world changes');
  return {ok:true,measuredWorldAccepted:true,scope:mobileBattleOracleContract.scope,origin,target,orderIndex,slot,distance,
    selectionEvidence:'actual-ordered-person-IDs',selectedPersonIds:selected,tokens,
    food:{confirmed:qty.value,before:c.Food,after:after.cities[origin].Food},money:{cost:moneyCost,before:c.Money,after:after.cities[origin].Money},
    checked:{people:200,cities:38,queue:2000,orderRows:200,fighterBytes:600,fighterFlags:30},
    limits:['Only worldSource recorded fields; unobserved OrderType Arms/Money/Consume are not claimed byte-exact','No strategy month, battle result or HD MARCH acceptance']};
}
/** Exact C integer order and U8 maxmp cast, including a Thew below100. */
export function nativeRestMpLimit(person) {
  for(const k of ['IQ','Force','Level','Thew'])integer(person?.[k],0,255,'Native rest person.'+k);
  const iqTerm=Math.floor(person.IQ*80/100),forceTerm=Math.floor(Math.sqrt(person.Force))>>>1;
  return Math.floor((iqTerm+forceTerm+person.Level)*person.Thew/100)&255;
}
/** before/after are battleObservation frames immediately around CMD_REST.
 * world is the same current sampled world supplying actual person attributes.
 * Only units/food/bout/native-over/settings/weather/pref and zero LCD touches are
 * invariant; the native input owner legitimately changes ACTION->PICK.
 */
export function verifyMobileBattleRest({before,after,world,worldAfter,actorIndex}={}) {
  assert.ok(before&&after&&world&&Array.isArray(world.people)&&world.people.length===200,'Actual rest frames and 200-person world required');
  shapeWorld(world,'rest world');shapeWorld(worldAfter,'rest worldAfter');exact(worldAfter,world,'Rest cannot modify any recorded world field');
  integer(actorIndex,0,9,'Actual player actor index');
  assert.ok(Array.isArray(before.units)&&Array.isArray(after.units),'Actual unit lists required');
  const slots=new Set();for(const u of before.units){integer(u.i,0,19,'Unit slot');assert.ok(!slots.has(u.i),'Unique native unit slots');slots.add(u.i);integer(u.id,1,200,'One-based actual unit person token');}
  const actor=before.units.find(u=>u.i===actorIndex);assert.ok(actor&&actor.side==='player','Current actual player actor');
  integer(actor.mp,0,255,'Actual before MP');assert.equal(actor.active,0,'Current actor not already rested');assert.notEqual(actor.state,8,'Current actor is not dead');
  const maxmp=nativeRestMpLimit(world.people[actor.id-1]),expected=structuredClone(before.units),e=expected.find(u=>u.i===actorIndex);
  e.active=1;if(e.mp<maxmp)e.mp++;
  exact(after.units,expected,'Rest changes only actor active/conditional MP');
  assert.equal(before.fight?.actorIndex,actorIndex,'Real ACTION actor matches requested rest');
  assert.equal(before.fight?.active,1);assert.equal(after.fight?.active,1);assert.equal(before.fight.inputKind,3,'Real ACTION before rest');assert.equal(after.fight.inputKind,1,'Real PICK after rest');
  assert.equal(before.fight.over,0);assert.equal(after.fight.over,0);assert.equal(after.fight.bout,before.fight.bout,'Rest does not end army turn');
  exact(after.food,before.food,'Rest cannot debit food');
  for(const k of ['weather','nativeOver','settings','pcBattle']){
    assert.ok(Object.hasOwn(before,k)&&Object.hasOwn(after,k),'Actual rest sample includes '+k);exact(after[k],before[k],'Rest invariant '+k);
  }
  assert.equal(before.nativeOver,0);assert.equal(after.nativeOver,0);
  integer(before.touches,0,Number.MAX_SAFE_INTEGER,'Before LCD touch count');integer(after.touches,0,Number.MAX_SAFE_INTEGER,'After LCD touch count');
  assert.equal(after.touches,before.touches,'HD REST does not leak LCD touch');
  return {ok:true,restAccepted:true,actorIndex,personId:actor.id-1,maxmp,mp:{before:actor.mp,after:e.mp},active:{before:0,after:1},bout:after.fight.bout,
    scope:'Single actual CMD_REST measured unit/food invariants; no AI turn or skill-effect acceptance'};
}
