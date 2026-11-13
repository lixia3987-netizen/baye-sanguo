// Formal migration DRAFT; copy to scripts/ only after root's actual run is terminal.
// Input is a real failed-v2 July public SAVE. All Plunder dispatch/MAKE/driver
// snapshots below are CONTROLLED expectations, not an actual Order26 observation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {impactRawPlunderContract,rawPlunderPlan,verifyRawPlunderMakeReport,verifyRawPlunderDispatch,verifyRawPlunderMonthReport} from './hd-impact-plunder-runtime-oracle.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),clone=x=>structuredClone(x);
const inputBytes=readFileSync(new URL('./fixtures/hd-impact-induce-loaded-world.json',import.meta.url));
assert.equal(inputBytes.length,175199);assert.equal(hash(inputBytes),'b04a4052b5ad5a4e6007231eaab433f98c8a8efd0f8b9eb6c9499cd3c298ce6c');
const input=JSON.parse(inputBytes),saved=input.world;
assert.equal(input.schemaVersion,1);assert.equal(input.provenance.worldNormalizationPerformed,false);assert.deepEqual([saved.period,saved.king,saved.year,saved.month],[4,0,236,7]);
assert.equal(input.provenance.sourceResultOutcome.ok,false);assert.equal(input.provenance.controlledDispatch.actualDispatchAccepted,false);
assert.equal(input.provenance.publicSave.tag,'impact-induce-loaded');assert.equal(input.provenance.publicSave.beforeAfterWorldEqual,true);
assert.equal(hash(Buffer.from(JSON.stringify(saved))),'b913a71c95b07ab1685920d9f65810f6d66da2de19d5737d807b1b4d4e2ae74d');
const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url)),moduleBytes=readFileSync(new URL('./hd-impact-plunder-runtime-oracle.mjs',import.meta.url));
assert.equal(libBytes.length,207195);assert.equal(hash(libBytes),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
assert.equal(moduleBytes.length,10718);assert.equal(hash(moduleBytes),'2b21c4194435f5f602a102f976a27d47d2cfa5639cce16269d6a91675fe9a998','Exact-byte migration of build rawPlunder-v3');
// Independent original LIB item reader; no oracle helper generates the expectation.
function item(id,index){const a=libBytes.readUInt32LE((id-1)*4),len=libBytes.readUInt32LE(a),count=libBytes.readUInt16LE(a+6),fixed=libBytes.readUInt32LE(a+8);assert.equal(libBytes.readUInt16LE(a+4),id);assert.equal(libBytes[a+12],0);assert.ok(index<count&&a+len<=libBytes.length);const o=fixed?14+index*fixed:count===1?14:libBytes.readUInt32LE(a+14+index*8),n=fixed||(count===1?len-14:libBytes.readUInt32LE(a+18+index*8));assert.ok(o>=14&&o+n<=len);return libBytes.subarray(a+o,a+o+n);}
const nativeThew=item(2,9)[24];assert.equal(nativeThew,12);assert.equal(item(2,9)[23],10);assert.equal(item(2,9)[26],20);
const opaque={Object:54321,Arms:123,Food:456,Money:789,Consume:88},opaqueMax={Object:65535,Arms:65535,Food:65535,Money:65535,Consume:255};
function removeRaw(w,cityIndex,pid){const c=w.cities[cityIndex],local=w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons),at=c.PersonQueue+local.indexOf(pid);assert.equal(local.filter(id=>id===pid).length,1);w.queue=[...w.queue.slice(0,at),...w.queue.slice(at+1,200),w.queue[199],...w.queue.slice(200)];w.cities=w.cities.map((row,i)=>({...row,...(i===cityIndex?{Persons:row.Persons-1}:{}),...(i>cityIndex?{PersonQueue:(row.PersonQueue-1)&65535}:{})}));return at;}
function appendRaw(w,cityIndex,pid){const c=w.cities[cityIndex],at=c.PersonQueue+c.Persons;w.queue=[...w.queue.slice(0,at),pid,...w.queue.slice(at,199),...w.queue.slice(200)];w.cities=w.cities.map((row,i)=>({...row,...(i===cityIndex?{Persons:row.Persons+1}:{}),...(i>cityIndex?{PersonQueue:(row.PersonQueue+1)&65535}:{})}));}
function pendingGov(){const w=clone(saved);for(const [slot,city,pid]of [[0,7,28],[1,13,37],[2,16,20]]){removeRaw(w,city,pid);Object.assign(w.orders[slot],{OrderId:4,City:city,Person:pid,TimeCount:0});}return w;}
function fixture(world=saved,values=opaque){const before=clone(world),during=clone(before),after=clone(before),orderIndex=before.orders.findIndex(o=>o.OrderId===255);assert.ok(orderIndex>=0);during.people[44].Thew-=nativeThew;after.people[44].Thew-=nativeThew;const at=removeRaw(after,20,44);Object.assign(after.orders[orderIndex],{OrderId:26,Person:44,City:20,TimeCount:0,...values});return {before,during,after,at,orderIndex,libBytes};}
function driver(f){const during=clone(f.after),c=during.cities[20],p=during.people[44],n=p.IQ+p.Force;c.PeopleDevotion=Math.floor(c.PeopleDevotion/2);c.Farming=Math.floor(c.Farming/2);c.Commerce=Math.floor(c.Commerce/2);c.Money+=n*2;c.Food+=n*5;return during;}
function driverCall(f,during=driver(f)){return verifyRawPlunderMonthReport({queued:f.after,during,orderIndex:f.orderIndex,libBytes});}
function rawRepeats(w){const seen=new Map();w.cities.forEach((c,i)=>{for(let j=0;j<c.Persons;j++){const at=c.PersonQueue+j,pid=w.queue[at];if(!seen.has(pid))seen.set(pid,[]);seen.get(pid).push({city:i,slot:at});}});return [...seen].filter(([,xs])=>xs.length>1);}

test('original saved input stays failed; controlled tests never grant actual acceptance',()=>{assert.equal(input.provenance.sourceResultOutcome.actualPreparationAccepted,false);assert.equal(input.provenance.sourceResultOutcome.actualCastAccepted,false);assert.equal(impactRawPlunderContract.actualPreparationAccepted,false);assert.equal(impactRawPlunderContract.actualCastAccepted,false);});
test('real empty255 chooses first slot and native26 uses conscription24 Thew12, no money',()=>{const p=rawPlunderPlan({world:saved,libBytes});assert.deepEqual([p.orderIndex,p.thew,p.moneyCost],[0,12,0]);const f=fixture(),v=verifyRawPlunderDispatch(f);assert.equal(v.order.OrderId,26);assert.equal(f.after.people[44].Thew,24);assert.equal(f.after.cities[20].Money,f.before.cities[20].Money);});
test('existing controlled Gov slots preserved; first free is3, never forcibly0',()=>{const f=fixture(pendingGov()),v=verifyRawPlunderDispatch(f);assert.equal(v.plan.orderIndex,3);assert.deepEqual(f.after.orders.slice(0,3),f.before.orders.slice(0,3));});
test('complete arrays remain input-immutable',()=>{const f=fixture(),refs=[f.before,f.during,f.after],copy=refs.map(clone);verifyRawPlunderMakeReport(f);verifyRawPlunderDispatch(f);driverCall(f);assert.deepEqual(refs,copy);assert.equal(hash(Buffer.from(JSON.stringify(saved))),input.worldSemanticSha256);});
test('three real cross-city raw duplicate PIDs are accepted without global repair',()=>{assert.deepEqual(rawRepeats(saved).map(([pid])=>pid),[65,136,138]);const f=fixture();verifyRawPlunderDispatch(f);for(const pid of [65,136,138]){const before=rawRepeats(f.before).find(([id])=>id===pid)[1],after=rawRepeats(f.after).find(([id])=>id===pid)[1];assert.deepEqual(after,before.map(p=>({...p,slot:p.slot>f.at&&p.slot<200?p.slot-1:p.slot})));}});
test('native199 remains old tail and raw200..1999 unchanged',()=>{const w=clone(saved);w.queue[199]=17;w.queue[200]=65535;w.queue[1999]=65000;const f=fixture(w);verifyRawPlunderDispatch(f);assert.equal(f.after.queue[199],17);assert.deepEqual(f.after.queue.slice(200),w.queue.slice(200));});
test('all five new-slot opaque values may reach typed bounds, with no invented meaning',()=>{const f=fixture(saved,opaqueMax),v=verifyRawPlunderDispatch(f);assert.deepEqual(v.opaqueOrder.actual,opaqueMax);assert.equal(v.opaqueOrder.semanticAcceptance,false);assert.deepEqual(v.opaqueOrder.fields,['Object','Arms','Food','Money','Consume']);});
test('exactly12 Thew is selectable; charging reaches0 without underflow',()=>{const w=clone(saved);w.people[44].Thew=12;const f=fixture(w);verifyRawPlunderDispatch(f);assert.equal(f.after.people[44].Thew,0);});
test('Make report is charged only, before order/resident/economic change',()=>{const f=fixture(),v=verifyRawPlunderMakeReport(f);assert.equal(v.accepted,true);assert.equal(v.resourceIncomeAccepted,false);assert.deepEqual(f.during.orders,f.before.orders);assert.deepEqual(f.during.queue,f.before.queue);assert.deepEqual(f.during.cities,f.before.cities);});
test('unobserved Make is explicit rather than fabricated',()=>{const f=fixture(),v=verifyRawPlunderDispatch({before:f.before,after:f.after,libBytes});assert.equal(v.makeReportObserved,false);assert.equal(v.publicInputAccepted,false);assert.equal(v.monthIncomeAccepted,false);});
test('driver gross is258/645 after city-stat division, before actor return',()=>{const f=fixture(),v=driverCall(f);assert.deepEqual([v.money,v.food],[258,645]);assert.deepEqual(v.economics,{PeopleDevotion:17,Farming:451,Commerce:343,Food:saved.cities[20].Food+645,Money:saved.cities[20].Money+258});assert.equal(v.actorReturnAccepted,false);assert.equal(v.wholeMonthWorldAccepted,false);assert.equal(v.publicInputAccepted,false);});
test('earlier Gov returns may shift raw city offsets before exact plunder report',()=>{const f=fixture(pendingGov()),d=driver(f);for(const [slot,city,pid]of [[0,7,28],[1,13,37],[2,16,20]]){appendRaw(d,city,pid);d.orders[slot].OrderId=255;}assert.notEqual(d.cities[20].PersonQueue,f.after.cities[20].PersonQueue);assert.equal(driverCall(f,d).accepted,true);});

for(const value of [256,265])test('OrderId U8 rejects '+value+' even with other real free255 slots',()=>{const w=clone(saved);w.orders[1].OrderId=value;assert.throws(()=>rawPlunderPlan({world:w,libBytes}));});
for(const [name,mutate]of [
 ['wrong new Order25 distribution',f=>f.after.orders[f.orderIndex].OrderId=25],
 ['wrong new Order13 transport',f=>f.after.orders[f.orderIndex].OrderId=13],
 ['wrong old10 cost',f=>f.after.people[44].Thew+=2],
 ['own command26 cost20 incorrectly used',f=>f.after.people[44].Thew-=8],
 ['fabricated money debit',f=>f.after.cities[20].Money--],
 ['income precredited in dispatch',f=>f.after.cities[20].Food+=645],
 ['firstfree skipped',f=>{f.after.orders[f.orderIndex+1]=clone(f.after.orders[f.orderIndex]);f.after.orders[f.orderIndex]=clone(f.before.orders[f.orderIndex]);}],
 ['another order created',f=>f.after.orders[f.orderIndex+1].OrderId=4],
 ['source Persons not decreased',f=>f.after.cities[20].Persons++],
 ['later city offset not shifted',f=>f.after.cities[21].PersonQueue++],
 ['raw duplicate normalized',f=>f.after.queue[8]=0],
 ['native199 tail changed',f=>f.after.queue[199]=1],
 ['unserialized tail200 changed',f=>f.after.queue[200]=1],
 ['unserialized tail1999 changed',f=>f.after.queue[1999]=1],
 ['guard Arms changed',f=>f.after.people[30].Arms--],
 ['unrelated fighter byte changed',f=>f.after.fighters[0]=(f.after.fighters[0]+1)&255],
 ['existing raw Gov erased',f=>f.after.orders[0].OrderId=255]
])test('dispatch rejects '+name,()=>{const f=fixture(name==='existing raw Gov erased'?pendingGov():saved);mutate(f);assert.throws(()=>verifyRawPlunderDispatch(f));});
for(const field of ['Object','Arms','Food','Money','Consume'])test('opaque exemption cannot mutate another raw slot '+field,()=>{const f=fixture();f.after.orders[f.orderIndex+1][field]=(f.after.orders[f.orderIndex+1][field]+1)&(field==='Consume'?255:65535);assert.throws(()=>verifyRawPlunderDispatch(f));});
for(const [name,mutate]of [
 ['actor pending another order',w=>Object.assign(w.orders[0],{OrderId:11,Person:44})],
 ['actor already absent',w=>removeRaw(w,20,44)],
 ['actor Thew11',w=>w.people[44].Thew=11],
 ['actor belongs enemy',w=>w.people[44].Belong=3],
 ['actor is current satrap',w=>w.cities[20].SatrapId=45],
 ['second plunder queued',w=>w.orders[0].OrderId=26],
 ['full200 occupied',w=>w.orders.forEach(o=>Object.assign(o,{OrderId:4,Person:0}))],
 ['original period changed',w=>w.period=3],
 ['Mod people count',w=>w.people.push(clone(w.people[0]))]
])test('plan rejects '+name,()=>{const w=clone(saved);mutate(w);assert.throws(()=>rawPlunderPlan({world:w,libBytes}));});
test('unknown LIB is rejected without inference from names',()=>{const bad=Buffer.from(libBytes);bad[0]^=1;assert.throws(()=>rawPlunderPlan({world:saved,libBytes:bad}));});
for(const [name,mutate]of [['early order',f=>f.during.orders[f.orderIndex].OrderId=26],['early queue change',f=>f.during.queue[f.at]=0],['early food',f=>f.during.cities[20].Food++],['early money',f=>f.during.cities[20].Money++],['wrong Thew10',f=>f.during.people[44].Thew+=2]])test('Make report rejects '+name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyRawPlunderMakeReport(f));});
for(const field of ['PeopleDevotion','Farming','Commerce','Food','Money'])test('driver rejects wrong economics '+field,()=>{const f=fixture(),d=driver(f);d.cities[20][field]++;assert.throws(()=>driverCall(f,d));});
for(const [name,mutate]of [['month already advanced',d=>d.month++],['actor already returned',d=>d.queue[d.cities[20].PersonQueue]=44],['same order retired',(d,f)=>d.orders[f.orderIndex].OrderId=255],['same raw opaque order changed',(d,f)=>d.orders[f.orderIndex].Consume^=1],['actor changed before report',d=>d.people[44].Thew++],['resource wrap unsupported',(d,f)=>{f.after.cities[20].Money=65500;d.cities[20].Money=(65500+258)&65535;}]])test('driver rejects '+name,()=>{const f=fixture(),d=driver(f);mutate(d,f);assert.throws(()=>driverCall(f,d));});
