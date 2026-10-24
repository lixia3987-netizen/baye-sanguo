// Pure evidence validation. No input, native calls, filesystem or state writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileDistributionOracleContract=Object.freeze({
  scope:'One original DistributeMake quantity confirmation; recorded worldSource fields only, no input or cancellation acceptance',
  originalLib:Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
  counts:Object.freeze({people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30}),
  requiredConfig:Object.freeze(['enableCustomRatio','ratioOfArmsToLevel','ratioOfArmsToAge','ratioOfArmsToIQ','ratioOfArmsToForce']),
  nativeSources:Object.freeze([
    'vendor/iBaye/src/citycmdc.c:1072-1139 (DistributeMake)',
    'vendor/iBaye/src/PublicFun.c:826-854 (PlcArmsMax/PlcArmsMaxP)',
    'vendor/iBaye/src/cityedit.c:696-711,1391-1399 (GetCityPersons/GetArmy)',
    'vendor/iBaye/src/tactic.c:1168-1188,1299-1313,1340-1350 (NumOperate)',
    'vendor/iBaye/src/hd-bridge.c:3382-3425 (quantity publication/retirement)',
    'vendor/iBaye/src/baye/attribute.h:195-201 (capacity configuration)',
    'vendor/iBaye/src/bind-objects.c:421-425 (sampled capacity configuration)'
  ])
});
const PERSON_FIELDS=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON_U16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY_FIELDS=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'];
const CITY_U8=new Set(['State','AvoidCalamity','PeopleDevotion']);
const ORDER_FIELDS=['OrderId','City','Person','Object','TimeCount','Food'];
const ORDER_U8=new Set(['OrderId','City','TimeCount','Consume']);
function integer(value,min,max,label) {
  assert.ok(Number.isInteger(value)&&value>=min&&value<=max,label+' must be an integer in '+min+'..'+max);return value;
}
function numericArray(a,length,max,label) {
  assert.ok(Array.isArray(a)&&a.length===length,label+' exact length '+length);
  for(let i=0;i<length;i++)integer(a[i],0,max,label+'['+i+']');
}
function shapeWorld(w,label) {
  assert.ok(w&&typeof w==='object'&&!Array.isArray(w),label+' worldSource object');
  integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');
  integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
  assert.ok(Array.isArray(w.people)&&w.people.length===200,label+' all 200 people');
  for(const [i,p] of w.people.entries())for(const k of PERSON_FIELDS)integer(p?.[k],0,PERSON_U16.has(k)?65535:255,label+'.people['+i+'].'+k);
  numericArray(w.queue,2000,65535,label+'.queue');
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,label+' all 38 cities');
  const slots=new Set(),residents=new Set();
  for(const [i,c] of w.cities.entries()) {
    for(const k of CITY_FIELDS)integer(c?.[k],0,CITY_U8.has(k)?255:65535,label+'.cities['+i+'].'+k);
    assert.ok(c.PersonQueue+c.Persons<=200,label+' city queue within native first200');
    for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++) {
      assert.ok(!slots.has(j),label+' city queues cannot overlap');slots.add(j);
      const pid=integer(w.queue[j],0,199,label+' actual resident PID');
      assert.ok(!residents.has(pid),label+' duplicate actual resident PID');residents.add(pid);
    }
  }
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,label+' all 200 orders');
  for(const [i,o] of w.orders.entries()) {
    for(const k of ORDER_FIELDS)integer(o?.[k],0,ORDER_U8.has(k)?255:65535,label+'.orders['+i+'].'+k);
    for(const k of ['Arms','Money','Consume'])if(Object.hasOwn(o,k))integer(o[k],0,ORDER_U8.has(k)?255:65535,label+'.orders['+i+'].'+k);
  }
  numericArray(w.fighters,600,255,label+'.fighters');numericArray(w.fighterIndex,30,1,label+'.fighterIndex');
  assert.ok(w.config&&typeof w.config==='object',label+' actual configuration');
  integer(w.config.enableCustomRatio,0,1,label+'.config.enableCustomRatio');
  integer(w.config.ratioOfArmsToLevel,0,65535,label+'.config.ratioOfArmsToLevel');
  for(const k of ['ratioOfArmsToAge','ratioOfArmsToIQ','ratioOfArmsToForce'])integer(w.config[k],0,255,label+'.config.'+k);
}
function exact(actual,expected,label,path='$') {
  if(Object.is(actual,expected))return;
  assert.ok(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object',label+' differs at '+path);
  assert.equal(Array.isArray(actual),Array.isArray(expected),label+' kind differs at '+path);
  const a=Object.keys(actual).sort(),e=Object.keys(expected).sort();assert.deepEqual(a,e,label+' fields differ at '+path);
  for(const k of e)exact(actual[k],expected[k],label,path+'.'+k);
}
function originalLibrary(input) {
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes required');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=mobileDistributionOracleContract.originalLib;
  assert.equal(b.length,ref.bytes,'Original LIB byte length');
  assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB SHA256');
}
/** Pure C capacity formula, including its custom U32 sum/cap and U16 return. */
function nativeCapacity(p,c) {
  if(c.enableCustomRatio) {
    const sum=(p.Level*c.ratioOfArmsToLevel+p.Age*c.ratioOfArmsToAge+p.Force*c.ratioOfArmsToForce+p.IQ*c.ratioOfArmsToIQ)>>>0;
    return Math.min(sum,65534);
  }
  return (p.Level*100+p.Force*10+p.IQ*10)&65535;
}
function distributionLimit(world,cityIndex,personId) {
  integer(cityIndex,0,37,'cityIndex');integer(personId,0,199,'personId');
  const c=world.cities[cityIndex],p=world.people[personId];
  assert.equal(c.Belong,world.king+1,'Actual player-owned city');assert.equal(p.Belong,c.Belong,'Actual allied selected person');
  const residents=world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons);
  assert.ok(residents.includes(personId),'Selected person is in native GetCityPersons scope');
  const capacity=nativeCapacity(p,world.config),available=c.MothballArms+p.Arms,maximum=Math.min(capacity,available);
  return {cityIndex,personId,capacity,available,maximum,max:maximum,min:0,initialValue:maximum,canOpen:maximum>0};
}
/** Qualify the current resident and independently calculate actual GetArmy max. */
export function calculateMobileDistributionLimit({world,cityIndex,personId,libBytes}={}) {
  shapeWorld(world,'world');originalLibrary(libBytes);return distributionLimit(world,cityIndex,personId);
}
/** before: active current GetArmy confirmation; after: fresh PERSON publication.
 * Caller proves current owner, one trusted confirm, quantity retirement and no
 * intervening action. A no-op total and total0 are both legal C confirmations.
 */
export function verifyMobileDistribution({before,after,cityIndex,personId,quantity,libBytes}={}) {
  shapeWorld(before,'before');shapeWorld(after,'after');originalLibrary(libBytes);
  integer(quantity,0,65534,'actual target total (not cancel sentinel)');
  const {capacity,available,maximum}=distributionLimit(before,cityIndex,personId);
  const c=before.cities[cityIndex],p=before.people[personId];
  assert.ok(maximum>0,'Native max0 shows a message instead of opening GetArmy');
  assert.ok(quantity<=maximum,'Confirmed total within current capacity and available troops');
  // DistributeMake uses a U16 assignment, not ADD16 or fixOverFlow16. Returning
  // soldiers to a nearly full reserve therefore wraps modulo65536 in native C.
  const uncastReserve=available-quantity,reserveAfter=uncastReserve&65535,expected=structuredClone(before);
  expected.people[personId].Arms=quantity;expected.cities[cityIndex].MothballArms=reserveAfter;
  exact(after,expected,'Only selected Arms and source MothballArms may change');
  return {ok:true,accepted:true,distributionAccepted:true,scope:mobileDistributionOracleContract.scope,cityIndex,personId,
    quantityMeaning:'target-total-arms',quantity,capacity,maximum,
    arms:{before:p.Arms,after:quantity,delta:quantity-p.Arms},
    reserve:{before:c.MothballArms,after:reserveAfter,uncast:uncastReserve,wrapped:uncastReserve>65535},
    changed:quantity!==p.Arms,checked:{...mobileDistributionOracleContract.counts},
    inputAccepted:false,cancellationAccepted:false,wholeNativeAbiAccepted:false,strategyMonthAccepted:false,
    limits:['Original standard LIB; scripted getMaxArms overrides are outside scope','Only recorded worldSource fields, not whole native memory','Trusted input/publication/retirement evidence is the caller responsibility']};
}
