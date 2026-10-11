// Pure original-LIB equipment evidence validation; no input or native writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileEquipmentOracleContract=Object.freeze({
  scope:'One original useflag0 ConfiscateMake or LargessMake transfer; all recorded worldSource fields, not the whole native ABI',
  originalLib:Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
  counts:Object.freeze({people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30,goodsQueue:2000,tools:33}),
  nativeSources:Object.freeze([
    'vendor/iBaye/src/citycmde.c:40-137 (ConfiscateMake)',
    'vendor/iBaye/src/citycmdb.c:1093-1203 (LargessMake)',
    'vendor/iBaye/src/infdeal.c:462-551,644-669,714-750 (equipment, report, discovered inventory)',
    'vendor/iBaye/src/cityedit.c:161-248,696-711 (AddGoods/DelGoods/GetCityPersons)',
    'vendor/iBaye/src/baye/attribute.h:110-159 (U8 stats, U16 equipment and inventory)'
  ])
});
const PERSON_FIELDS=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON_U16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY_FIELDS=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons','Tools','ToolQueue'];
const CITY_U8=new Set(['State','AvoidCalamity','PeopleDevotion']);
const TOOL_FIELDS=['useflag','changeAttackRange','at','iq','move','arm'];
const ORDER_FIELDS=['OrderId','City','Person','Object','TimeCount','Food'];
function integer(value,min,max,label) {
  assert.ok(Number.isInteger(value)&&value>=min&&value<=max,label+' must be an integer in '+min+'..'+max);return value;
}
function numericArray(a,length,max,label) {
  assert.ok(Array.isArray(a)&&a.length===length,label+' exact length '+length);
  for(let i=0;i<length;i++)integer(a[i],0,max,label+'['+i+']');
}
function exact(actual,expected,label,path='$') {
  if(Object.is(actual,expected))return;
  assert.ok(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object',label+' differs at '+path);
  assert.equal(Array.isArray(actual),Array.isArray(expected),label+' kind differs at '+path);
  const a=Object.keys(actual).sort(),e=Object.keys(expected).sort();assert.deepEqual(a,e,label+' fields differ at '+path);
  for(const k of e)exact(actual[k],expected[k],label,path+'.'+k);
}
function shapeWorld(w,label) {
  assert.ok(w&&typeof w==='object'&&!Array.isArray(w),label+' worldSource object');
  integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');
  integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
  assert.ok(Array.isArray(w.people)&&w.people.length===200,label+' all 200 people');
  for(const [i,p] of w.people.entries()) {
    for(const k of PERSON_FIELDS)integer(p?.[k],0,PERSON_U16.has(k)?65535:255,label+'.people['+i+'].'+k);
    integer(p.Tool1,0,33,label+' Tool1 actual original ID+1');integer(p.Tool2,0,33,label+' Tool2 actual original ID+1');
  }
  numericArray(w.queue,2000,65535,label+'.queue');
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,label+' all 38 cities');
  const slots=new Set(),residents=new Set();let goodsEnd=0;
  for(const [i,c] of w.cities.entries()) {
    for(const k of CITY_FIELDS)integer(c?.[k],0,CITY_U8.has(k)?255:65535,label+'.cities['+i+'].'+k);
    assert.ok(c.PersonQueue+c.Persons<=200,label+' resident queue lies within native first200');
    for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++) {
      assert.ok(!slots.has(j),label+' resident queue segments do not overlap');slots.add(j);
      const pid=integer(w.queue[j],0,199,label+' resident PID');
      assert.ok(!residents.has(pid),label+' resident PIDs do not repeat');residents.add(pid);
    }
    assert.equal(c.ToolQueue,goodsEnd,label+' packed city inventory offset '+i);
    goodsEnd+=c.Tools;assert.ok(goodsEnd<=2000,label+' active goods fit native full queue');
  }
  numericArray(w.goodsQueue,2000,65535,label+'.goodsQueue');
  for(let i=0;i<goodsEnd;i++)integer(w.goodsQueue[i]&0x7fff,0,32,label+' active goods ID');
  assert.ok(Array.isArray(w.tools)&&w.tools.length===33,label+' all 33 original raw tools');
  for(const [i,t] of w.tools.entries())for(const k of TOOL_FIELDS)integer(t?.[k],0,255,label+'.tools['+i+'].'+k);
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,label+' all 200 orders');
  for(const [i,o] of w.orders.entries()) {
    for(const k of ORDER_FIELDS)integer(o?.[k],0,['OrderId','City','TimeCount'].includes(k)?255:65535,label+'.orders['+i+'].'+k);
    for(const k of ['Arms','Money','Consume'])if(Object.hasOwn(o,k))integer(o[k],0,k==='Consume'?255:65535,label+'.orders['+i+'].'+k);
  }
  numericArray(w.fighters,600,255,label+'.fighters');numericArray(w.fighterIndex,30,1,label+'.fighterIndex');
  assert.ok(w.config&&typeof w.config==='object'&&!Array.isArray(w.config),label+' sampled configuration');
  integer(w.config.disableAllPersonReport,0,1,label+'.config.disableAllPersonReport');
  return goodsEnd;
}
function originalTools(input) {
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes required');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=mobileEquipmentOracleContract.originalLib;
  assert.equal(b.length,ref.bytes,'Original LIB byte length');
  assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB SHA256');
  const base=b.readUInt32LE((66-1)*4);
  assert.ok(base+14<=b.length,'GOODS resource header bounds');assert.equal(b.readUInt16LE(base+4),66,'Actual GOODS resource66');
  assert.equal(b.readUInt16LE(base+6),1,'One GOODS table');assert.equal(b.readUInt32LE(base+8),33*66,'Actual packed GOODS item size');
  assert.equal(b.readUInt32LE(base),14+33*66,'Actual GOODS resource size');
  assert.ok(base+14+33*66<=b.length,'GOODS resource payload bounds');
  return Array.from({length:33},(_,i)=>{
    const p=base+14+i*66;
    return {useflag:b[p+1],changeAttackRange:b[p+32],at:b[p+62],iq:b[p+63],move:b[p+64],arm:b[p+65]};
  });
}
function selectable(w,cityIndex,personId) {
  integer(cityIndex,0,37,'cityIndex');integer(personId,0,199,'personId');
  const c=w.cities[cityIndex],p=w.people[personId];
  assert.equal(c.Belong,w.king+1,'Actual player-owned city');assert.equal(p.Belong,c.Belong,'Actual own resident');
  assert.ok(w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).includes(personId),'Selected person is in native GetCityPersons scope');
  return {c,p};
}
function validateTools(w,tools,label) {
  for(let i=0;i<33;i++)for(const k of TOOL_FIELDS)assert.equal(w.tools[i][k],tools[i][k],label+' actual original tool '+i+'.'+k);
}
/** before is the complete final GOODS/PERSON picker immediately before its
 * trusted confirmation; after is after the actual report has returned. A
 * nonking requires reportWorld sampled during its real GREPORT pause. Caller
 * separately proves the owner, selected native index, inputs and retirement.
 */
export function verifyMobileEquipment({operation,before,after,cityIndex,personId,toolId,libBytes,reportWorld}={}) {
  assert.ok(operation==='confiscate'||operation==='reward','Explicit equipment operation required');
  const total=shapeWorld(before,'before');shapeWorld(after,'after');
  const tools=originalTools(libBytes);validateTools(before,tools,'before');validateTools(after,tools,'after');
  integer(toolId,0,32,'zero-based actual toolId');const tool=tools[toolId],{c,p}=selectable(before,cityIndex,personId);
  assert.equal(tool.useflag,0,'This transfer oracle accepts equippable useflag0 tools, not consumable/army conversion items');
  const expected=structuredClone(before);let slot,queueIndex;
  if(operation==='confiscate') {
    // ConfiscateMake compacts a second-only equipment before opening GOODS.
    // A final GOODS before-snapshot must already reflect that native action.
    assert.ok(p.Tool1>0,'Final confiscation GOODS snapshot follows native equipment compaction');
    const matches=['Tool1','Tool2'].filter(k=>p[k]===toolId+1);
    assert.equal(matches.length,1,'Selected equipped tool must identify one actual slot');slot=matches[0];
    assert.ok(total<2000,'A successful insertion needs space in the native packed goods queue');
    expected.people[personId].Force=(p.Force-tool.at)&255;expected.people[personId].IQ=(p.IQ-tool.iq)&255;
    expected.people[personId][slot]=0;
    queueIndex=c.ToolQueue+c.Tools;
    for(let i=1999;i>queueIndex;i--)expected.goodsQueue[i]=before.goodsQueue[i-1];
    expected.goodsQueue[queueIndex]=toolId|0x8000;
    expected.cities[cityIndex].Tools=c.Tools+1;
    for(let i=cityIndex+1;i<38;i++)expected.cities[i].ToolQueue=before.cities[i].ToolQueue+1;
  } else {
    assert.ok(p.Tool1===0||p.Tool2===0,'Native FULLGOODS rejects a full equipment pair');
    slot=p.Tool1===0?'Tool1':'Tool2';
    const inventory=before.goodsQueue.slice(c.ToolQueue,c.ToolQueue+c.Tools);
    assert.ok(inventory.some(value=>(value&0x8000)!==0&&(value&0x7fff)===toolId),'Reward selection comes from current discovered GetCityPGoods');
    // DelGoods searches the first matching masked ID, even if an earlier
    // duplicate is undiscovered. It shifts through1998 and keeps tail1999.
    queueIndex=before.goodsQueue.findIndex((value,i)=>i>=c.ToolQueue&&i<c.ToolQueue+c.Tools&&(value&0x7fff)===toolId);
    assert.ok(queueIndex>=0,'Actual selected tool exists in this city');
    expected.people[personId].Force=(p.Force+tool.at)&255;expected.people[personId].IQ=(p.IQ+tool.iq)&255;
    expected.people[personId][slot]=toolId+1;
    for(let i=queueIndex;i<1999;i++)expected.goodsQueue[i]=before.goodsQueue[i+1];
    expected.cities[cityIndex].Tools=c.Tools-1;
    for(let i=cityIndex+1;i<38;i++)expected.cities[i].ToolQueue=before.cities[i].ToolQueue-1;
  }
  const nonking=personId!==before.king,reportExpected=nonking;
  if(nonking) {
    assert.equal(before.config.disableAllPersonReport,0,'This nonking transfer requires actual GREPORT evidence');
    assert.ok(reportWorld,'Nonking transfer requires the actual paused reportWorld');shapeWorld(reportWorld,'reportWorld');validateTools(reportWorld,tools,'reportWorld');
    exact(reportWorld,operation==='confiscate'?before:expected,'Native GREPORT business timing');
    expected.people[personId].Devotion=operation==='confiscate'?Math.max(0,p.Devotion-20):Math.min(100,(p.Devotion+8)&255);
  } else assert.ok(reportWorld==null,'King transfer has no native GREPORT pause');
  exact(after,expected,'Only the native selected equipment/stats/devotion and packed inventory changes are allowed');
  return {ok:true,accepted:true,equipmentAccepted:true,operation,scope:mobileEquipmentOracleContract.scope,
    cityIndex,personId,toolId,equipmentSlot:slot,goodsQueueIndex:queueIndex,
    stats:{forceBefore:p.Force,forceAfter:expected.people[personId].Force,iqBefore:p.IQ,iqAfter:expected.people[personId].IQ,
      devotionBefore:p.Devotion,devotionAfter:expected.people[personId].Devotion},
    inventory:{before:c.Tools,after:expected.cities[cityIndex].Tools,discoveredOnInsert:operation==='confiscate',tailCleared:false},
    reportExpected,reportWorldAccepted:nonking,reportBusinessStage:nonking?(operation==='confiscate'?'before-all-transfer-business':'after-equipment-and-inventory-before-devotion'):'no-report-for-king',
    checked:{...mobileEquipmentOracleContract.counts},inputAccepted:false,reportOwnerAccepted:false,retirementAccepted:false,
    cancellationAccepted:false,wholeNativeAbiAccepted:false,consumableAccepted:false,
    limits:['All recorded worldSource fields are compared; native input/publication/owner/retirement is caller evidence',
      'Final confiscation GOODS is sampled after native second-only equipment compaction',
      'No consumed item, army conversion, scripted hook or unsampled derived battle/movement effect acceptance']};
}
export function verifyMobileConfiscation(options={}) {return verifyMobileEquipment({...options,operation:'confiscate'});}
export function verifyMobileReward(options={}) {return verifyMobileEquipment({...options,operation:'reward'});}
