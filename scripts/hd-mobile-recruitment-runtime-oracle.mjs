// Pure original-LIB evidence oracle: no input, native, filesystem or process writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileRecruitmentOracleContract = Object.freeze({
  scope: 'One positive ConscriptionMake submission, before any subsequent command or strategy month; recorded worldSource fields only',
  originalLib: Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
  counts: Object.freeze({people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30}),
  orderId:24,
  initializedOrderFields:Object.freeze(['OrderId','Person','City','TimeCount']),
  uninitializedOrderFields:Object.freeze(['Object','Arms','Food','Money','Consume']),
  nativeSources:Object.freeze([
    'vendor/iBaye/src/citycmdc.c:974-1057 (ConscriptionMake)',
    'vendor/iBaye/src/citycmde.c:357-388,428-464 (IsMoney/IsManual/OrderConsumeThew)',
    'vendor/iBaye/src/citycmdd.c:987-1017,1033-1064 (canAddOrder/AddOrderHead)',
    'vendor/iBaye/src/cityedit.c:108-145,696-711,1391-1399 (DelPerson/GetCityPersons/GetArmy)',
    'vendor/iBaye/src/gamEng.c:1285-1293 (add_16)',
    'vendor/iBaye/src/baye/order.h:31,69-81 (CONSCRIPTION/OrderType)'
  ])
});
const PERSON_FIELDS=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON_U16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY_FIELDS=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'];
const CITY_U8=new Set(['State','AvoidCalamity','PeopleDevotion']);
const ORDER_FIELDS=['OrderId','City','Person','Object','TimeCount','Food'];
const ORDER_U8=new Set(['OrderId','City','TimeCount','Consume']);
const OPTIONAL_ORDER_FIELDS=['Arms','Money','Consume'];
function integer(value,min,max,label) {
  assert.ok(Number.isInteger(value)&&value>=min&&value<=max,label+' must be an integer in '+min+'..'+max);return value;
}
function array(value,length,max,label) {
  assert.ok(Array.isArray(value)&&value.length===length,label+' exact length '+length);
  for(let i=0;i<length;i++)integer(value[i],0,max,label+'['+i+']');
}
function shapeWorld(w,label) {
  assert.ok(w&&typeof w==='object'&&!Array.isArray(w),label+' actual worldSource object');
  integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');
  integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
  assert.ok(Array.isArray(w.people)&&w.people.length===200,label+' all 200 people');
  for(const [i,p] of w.people.entries())for(const k of PERSON_FIELDS)integer(p?.[k],0,PERSON_U16.has(k)?65535:255,label+'.people['+i+'].'+k);
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,label+' all 38 cities');
  array(w.queue,2000,65535,label+'.queue');
  const slots=new Set(),residents=new Set();
  for(const [i,c] of w.cities.entries()) {
    for(const k of CITY_FIELDS)integer(c?.[k],0,CITY_U8.has(k)?255:65535,label+'.cities['+i+'].'+k);
    assert.ok(c.PersonQueue+c.Persons<=200,label+' city queue lies within native first 200');
    for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++) {
      assert.ok(!slots.has(j),label+' overlapping city queue ranges');slots.add(j);
      const pid=integer(w.queue[j],0,199,label+' current resident PID');
      assert.ok(!residents.has(pid),label+' duplicate current resident PID');residents.add(pid);
    }
  }
  array(w.fighters,600,255,label+'.fighters');array(w.fighterIndex,30,1,label+'.fighterIndex');
  assert.ok(w.config&&typeof w.config==='object',label+' actual configuration');
  integer(w.config.armsPerMoney,1,255,label+'.config.armsPerMoney');
  integer(w.config.armsPerDevotion,1,255,label+'.config.armsPerDevotion');
  integer(w.config.fixOverFlow16,0,1,label+'.config.fixOverFlow16');
  integer(w.config.enable16bitConsumeMoney,0,1,label+'.config.enable16bitConsumeMoney');
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,label+' all 200 order slots');
  for(const [i,o] of w.orders.entries()) {
    for(const k of ORDER_FIELDS)integer(o?.[k],0,ORDER_U8.has(k)?255:65535,label+'.orders['+i+'].'+k);
    for(const k of OPTIONAL_ORDER_FIELDS)if(Object.hasOwn(o,k))integer(o[k],0,ORDER_U8.has(k)?255:65535,label+'.orders['+i+'].'+k);
  }
}
// Keep assertion output bounded: identify the first differing recorded path.
function exact(actual,expected,label,path='$') {
  if(Object.is(actual,expected))return;
  assert.ok(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object',label+' differs at '+path);
  assert.equal(Array.isArray(actual),Array.isArray(expected),label+' kind differs at '+path);
  const a=Object.keys(actual).sort(),e=Object.keys(expected).sort();
  assert.deepEqual(a,e,label+' fields differ at '+path);
  for(const k of e)exact(actual[k],expected[k],label,path+'.'+k);
}
function libraryBytes(input) {
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes required');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=mobileRecruitmentOracleContract.originalLib;
  assert.equal(b.length,ref.bytes,'Original LIB byte length');
  assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB SHA256');return b;
}
function item(b,id,index) {
  const table=(id-1)*4;assert.ok(table>=0&&table+4<=b.length,'Resource table bounds');
  const base=b.readUInt32LE(table);assert.ok(base+14<=b.length,'Resource header bounds');
  const length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);
  assert.equal(b.readUInt16LE(base+4),id,'Exact resource ID');
  assert.ok(index>=0&&index<count&&base+length<=b.length,'Resource item bounds');
  const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(base+14+index*8);
  const size=fixed||(count===1?length-14:b.readUInt32LE(base+18+index*8));
  assert.ok(offset>=14&&size>0&&offset+size<=length,'Resource payload bounds');return b.subarray(base+offset,base+offset+size);
}
/**
 * before: worldSource at the live GetArmy confirmation, after: next complete
 * PERSON publication, without another command/month between them. quantity is
 * the actual confirmed value; caller independently proves trusted owner/input.
 * No zero-quantity recruitment acceptance or whole native ABI claim is made.
 */
export function verifyMobileRecruitment({before,after,cityIndex,personId,quantity,libBytes}={}) {
  shapeWorld(before,'before');shapeWorld(after,'after');
  integer(cityIndex,0,37,'cityIndex');integer(personId,0,199,'personId');integer(quantity,1,65534,'positive actual quantity');
  const b=libraryBytes(libBytes),c=before.cities[cityIndex],p=before.people[personId],config=before.config;
  assert.equal(c.Belong,before.king+1,'Current city belongs to actual player');
  assert.equal(p.Belong,c.Belong,'Current resident belongs to actual city owner');
  const end=c.PersonQueue+c.Persons,queueIndex=before.queue.indexOf(personId,c.PersonQueue);
  assert.ok(queueIndex>=c.PersonQueue&&queueIndex<end,'Person is selectable by native GetCityPersons');
  const thewItem=item(b,2,9),moneyItem=item(b,2,10),orderId=mobileRecruitmentOracleContract.orderId;
  assert.equal(thewItem.length,28,'Original ConsumeThew item length');assert.equal(moneyItem.length,28,'Original ConsumeMoney item length');
  // Standard LIB contains 28 U8 costs, not 28 U16 costs; never read past it.
  assert.equal(config.enable16bitConsumeMoney,0,'Original U8 money-cost mode required');
  const thewCost=thewItem[orderId],minimumMoney=moneyItem[orderId];
  assert.equal(thewCost,12,'Actual original recruitment Thew');assert.equal(minimumMoney,1,'Actual original IsMoney gate');
  assert.ok(p.Thew>=thewCost,'Native IsManual guard');assert.ok(c.Money>=minimumMoney,'Native IsMoney guard');
  const maximum=Math.min((c.PeopleDevotion*config.armsPerDevotion)&65535,Math.min(c.Money*config.armsPerMoney,65534));
  assert.ok(quantity<=maximum,'Actual GetArmy maximum from current devotion and money');
  const orderIndex=before.orders.findIndex(o=>o.OrderId===255);
  assert.ok(orderIndex>=0,'Native AddOrderHead has an actual free slot');
  const expected=structuredClone(before),newOrder=after.orders[orderIndex];
  // C only assigns these four fields. Preserve sampled stack bytes explicitly
  // in this one row; they are neither cargo nor a semantic zero requirement.
  exact(Object.keys(newOrder).sort(),Object.keys(before.orders[orderIndex]).sort(),'New order sampled field set');
  const uninitializedFields=mobileRecruitmentOracleContract.uninitializedOrderFields.filter(k=>Object.hasOwn(newOrder,k));
  expected.orders[orderIndex]={...expected.orders[orderIndex],OrderId:orderId,Person:personId,City:cityIndex,TimeCount:0};
  for(const k of uninitializedFields)expected.orders[orderIndex][k]=newOrder[k];
  const moneyCost=Math.floor(quantity/config.armsPerMoney),stockAfter=Math.min(c.MothballArms+quantity,65535);
  expected.cities[cityIndex].MothballArms=stockAfter;
  expected.cities[cityIndex].Money=c.Money-moneyCost;
  expected.people[personId].Thew=p.Thew-thewCost;
  // Actual DelPerson shifts only through slot198, leaves slot199 unchanged,
  // and decrements every later city's U16 PersonQueue, including empty cities.
  for(let i=queueIndex;i<199;i++)expected.queue[i]=expected.queue[i+1];
  expected.cities[cityIndex].Persons--;
  for(let i=cityIndex+1;i<38;i++)expected.cities[i].PersonQueue=(expected.cities[i].PersonQueue-1)&65535;
  exact(after,expected,'Only native recruitment changes permitted');
  return {ok:true,accepted:true,recruitmentAccepted:true,scope:mobileRecruitmentOracleContract.scope,cityIndex,personId,
    quantity,maximum,orderIndex,queueIndex,order:{OrderId:orderId,Person:personId,City:cityIndex,TimeCount:0},
    stock:{before:c.MothballArms,after:stockAfter,applied:stockAfter-c.MothballArms,saturated:c.MothballArms+quantity>65535},
    money:{before:c.Money,after:after.cities[cityIndex].Money,cost:moneyCost,minimum:minimumMoney,armsPerMoney:config.armsPerMoney},
    thew:{before:p.Thew,after:after.people[personId].Thew,cost:thewCost},
    uninitializedOrderMask:{orderIndex,fields:uninitializedFields,actual:Object.fromEntries(uninitializedFields.map(k=>[k,newOrder[k]])),semanticAcceptance:false},
    checked:{...mobileRecruitmentOracleContract.counts},wholeNativeAbiAccepted:false,strategyMonthAccepted:false,
    limits:['Only recorded worldSource fields; unobserved native fields are outside this proof','Trusted quantity-owner confirmation and the next complete picker publication are caller evidence','New order uninitialized fields are preserved as observed bytes without business meaning']};
}
