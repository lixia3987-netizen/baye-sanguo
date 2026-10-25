import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {mobileMarchRuntimeContract,verifyMobileMarchSelection,verifyMobileMarchCancellation,verifyMobileHdMarch} from './hd-mobile-march-runtime-oracle.mjs';

// Genuine recorded world/ROM fixture. The stage and trusted-input traces below are
// controlled test fixtures, never presented as an actual HD march execution.
const recorded=JSON.parse(gunzipSync(fs.readFileSync(new URL('../docs/validation/m5-mobile-battle-20261011/raw/battle-result.json.gz',import.meta.url))));
const libBytes=fs.readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const origin=8;
function initial(){
  const w=structuredClone(recorded.battleBootstrap.before);
  w.config.checkRedundantOnAddPerson=0;return w;
}
function ids(w){
  const c=w.cities[origin];return w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>w.people[id].Belong===c.Belong);
}
// Independent array-splice expectation, including C's retained slot199.
function remove(w,pid,city=origin){
  const n=structuredClone(w),c=n.cities[city],at=n.queue.indexOf(pid,c.PersonQueue);
  assert.ok(at>=c.PersonQueue&&at<c.PersonQueue+c.Persons);
  const active=n.queue.slice(0,200);active.splice(at,1);active.push(active.at(-1));n.queue.splice(0,200,...active);
  c.Persons--;for(const v of n.cities.slice(city+1))v.PersonQueue--;return n;
}
function rolledBack(before,selected){
  const n=structuredClone(before),c=n.cities[origin],active=n.queue.slice(0,200);
  for(const pid of selected)active.splice(active.indexOf(pid,c.PersonQueue),1);
  n.queue.splice(0,200,...active.slice(0,c.PersonQueue),...selected,...active.slice(c.PersonQueue));
  return n;
}
function cancellation(stage='food'){
  const before=initial(),selectedPersonIds=ids(before).slice(2,4),after=rolledBack(before,selectedPersonIds);
  return {before,after,origin,selectedPersonIds,cancelStage:stage};
}
function fixture(count=recorded.battleBootstrap.selectedPersonIds.length,explicitFinish=false){
  const before=initial(),selectedPersonIds=recorded.battleBootstrap.selectedPersonIds.slice(0,count);
  let after=structuredClone(recorded.battleBootstrap.after);after.config.checkRedundantOnAddPerson=0;
  if(count!==recorded.battleBootstrap.selectedPersonIds.length){
    after=structuredClone(before);for(const pid of selectedPersonIds)after=remove(after,pid);
    after.orders=structuredClone(recorded.battleBootstrap.after.orders);after.fighterIndex=structuredClone(recorded.battleBootstrap.after.fighterIndex);
    const slot=before.fighterIndex.indexOf(0);for(let i=0;i<20;i++)after.fighters[slot*20+i]=0;
    selectedPersonIds.forEach((pid,i)=>{after.fighters[slot*20+i*2]=(pid+1)&255;after.fighters[slot*20+i*2+1]=(pid+1)>>>8;});
    after.cities[origin].Food=recorded.battleBootstrap.after.cities[origin].Food;after.cities[origin].Money=recorded.battleBootstrap.after.cities[origin].Money;
  }
  const qty=structuredClone(recorded.battleBootstrap.food),phaseTrace=[],trustedActions=[],nativeKeys=[],nativeTouches=[],trustedEvents=[],selections=[];
  const identity={status:'ready',byteLength:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',generation:3};
  let time=10,current=before,chosen=0,phase=1;
  const state=()=>({
    at:time,identity:structuredClone(identity),keyCount:nativeKeys.length,touchCount:nativeTouches.length,eventCount:trustedEvents.length,
    march:{pick:phase===4?1:0,battlePick:phase===4||phase===6?1:0,mapCity:9,mapInputSeq:30,ok:phase===7?1:0,
      city:phase===7?8:0,obj:phase===7?9:0,time:phase===7?1:0,seq:phase===7?10:9,phase,session:17,origin:8,selected:chosen,inputSeq:10+chosen+phase},
    menu:{active:phase===1?1:0,context:1,kind:3,seq:10+chosen,count:ids(current).length,ids:ids(current),idsValid:true},
    qty:phase===2?structuredClone(qty):{active:0},
    report:phase===3?{active:1,kind:2,person:selectedPersonIds[0]}:phase===6?{active:1,kind:1,person:65535}:{active:0},
    cityUi:{pendingTarget:phase===4?9:null}
  });
  const trace=stage=>{phaseTrace.push({stage,state:state(),world:structuredClone(current)});};
  const action=(kind,codes,change,extra={})=>{
    const a={kind,target:'fixture-control',before:state(),...extra};time++;
    trustedEvents.push({type:'pointerdown',trusted:true,target:a.target,pointerId:2,at:time});
    time++;trustedEvents.push({type:'pointerup',trusted:true,target:a.target,pointerId:2,at:time});
    for(const code of codes){time++;nativeKeys.push({code,at:time});}
    change?.();time++;a.after=state();trustedActions.push(a);return a;
  };
  trace('persons');
  for(const pid of selectedPersonIds){
    const previous=structuredClone(current);
    action('select-person',[39],()=>{current=remove(current,pid);chosen++;if(chosen===selectedPersonIds.length&&!explicitFinish)phase=2;},{personId:pid});
    selections.push({personId:pid,before:previous,after:structuredClone(current)});
    if(phase===1)trace('persons');
  }
  if(explicitFinish)action('finish-persons',[40],()=>{phase=2;});
  trace('food');action('food-confirm',[39],()=>{phase=3;});trace('target-tip');
  action('continue-target',[39],()=>{phase=4;});trace('target');
  action('target-select',[],null);trace('target-selected');
  action('target-confirm',[37,39],()=>{phase=6;});trace('armout');
  action('armout-ack',[39],()=>{phase=7;current=structuredClone(after);});trace('departed');
  return {before,after,qty,libBytes,selectedPersonIds,selections,phaseTrace,trustedActions,nativeKeys,nativeTouches,trustedEvents};
}
test('one native selection removes exactly one current resident, with first200 shift semantics',()=>{
  const before=initial(),personId=ids(before)[2],after=remove(before,personId);
  assert.equal(verifyMobileMarchSelection({before,after,origin,personId}).selectionAccepted,true);
  assert.equal(after.queue[199],before.queue[199]);assert.deepEqual(after.queue.slice(200),before.queue.slice(200));
  assert.equal(after.cities[origin].Persons,before.cities[origin].Persons-1);
});
test('one selection rejects stale/nonresident/opponent/duplicate ID and missing configuration',()=>{
  const before=initial(),personId=ids(before)[2],after=remove(before,personId);
  for(const mutate of [
    a=>a.personId=199,a=>a.before.people[a.personId].Belong=65535,
    a=>a.selectedPersonIdsBefore=[personId],a=>delete a.before.config.checkRedundantOnAddPerson,
    a=>a.personId=65535,a=>a.origin=37
  ]){const a={before:structuredClone(before),after:structuredClone(after),origin,personId};mutate(a);assert.throws(()=>verifyMobileMarchSelection(a));}
});
test('selection rejects unrelated money, food, person, queue tail, order and fighter changes',()=>{
  for(const change of [w=>w.cities[0].Money++,w=>w.cities[8].Food--,w=>w.people[199].Thew^=1,
    w=>w.queue[1999]^=1,w=>w.orders[0].Food^=1,w=>w.fighterIndex[29]^=1,w=>w.fighters[599]^=1,w=>w.month=12]){
    const before=initial(),personId=ids(before)[2],after=remove(before,personId);change(after);
    assert.throws(()=>verifyMobileMarchSelection({before,after,origin,personId}));
  }
});
for(const stage of ['food','target'])test(stage+' cancellation restores reverse AddPerson order without money/grain/order side effects',()=>{
  const a=cancellation(stage),v=verifyMobileMarchCancellation(a);
  assert.equal(v.cancellationAccepted,true);assert.equal(v.cancelStage,stage);
  assert.deepEqual(v.restoredResidentQueue.slice(0,2),a.selectedPersonIds);
  assert.notDeepEqual(a.after.queue,a.before.queue,'Selecting middle residents legitimately reorders city queue');
});
test('cancellation rejects naive exact-original queue restoration for selected middle residents',()=>{
  const a=cancellation();a.after=structuredClone(a.before);assert.throws(()=>verifyMobileMarchCancellation(a));
});
test('cancellation rejects wrong insertion order, one missing restore, grain debit and new battle slot',()=>{
  for(const mutate of [
    a=>{const q=a.after.cities[origin].PersonQueue;[a.after.queue[q],a.after.queue[q+1]]=[a.after.queue[q+1],a.after.queue[q]];},
    a=>a.after.cities[origin].Persons--,a=>a.after.cities[origin].Food--,
    a=>a.after.orders[170].OrderId=27,a=>a.after.fighterIndex[0]=1,
    a=>a.selectedPersonIds.reverse(),a=>a.cancelStage='report'
  ]){const a=cancellation();mutate(a);assert.throws(()=>verifyMobileMarchCancellation(a));}
});
test('AddPerson redundancy mode removes a duplicate resident elsewhere before restoring the selected person',()=>{
  const before=initial(),selectedPersonIds=[ids(before)[2]],pid=selectedPersonIds[0];
  before.config.checkRedundantOnAddPerson=1;
  const other=before.cities.findIndex((c,i)=>i>origin&&c.Persons>0),otherAt=before.cities[other].PersonQueue;
  before.queue[otherAt]=pid;
  // Native duplicate cleanup deletes it from the later city; restoration inserts it at origin head.
  let after=remove(before,pid);after=remove(after,pid,other);
  const c=after.cities[origin],active=after.queue.slice(0,200);active.splice(c.PersonQueue,0,pid);active.pop();
  after.queue.splice(0,200,...active);c.Persons++;for(const v of after.cities.slice(origin+1))v.PersonQueue++;
  const a={before,after,origin,selectedPersonIds,cancelStage:'food'};
  assert.equal(verifyMobileMarchCancellation(a).checkRedundantOnAddPerson,1);
  a.after.config.checkRedundantOnAddPerson=0;assert.throws(()=>verifyMobileMarchCancellation(a));
});
test('all pure helpers leave caller world and ordered IDs unchanged',()=>{
  const a=cancellation(),saved=JSON.stringify(a);verifyMobileMarchCancellation(a);assert.equal(JSON.stringify(a),saved);
  const f=fixture(),savedFinal=JSON.stringify(f);verifyMobileHdMarch(f);assert.equal(JSON.stringify(f),savedFinal);
});
test('synthetic native/input trace binds the genuine recorded final-dispatch world but cannot claim whole HD or actual provenance',()=>{
  const v=verifyMobileHdMarch(fixture());
  assert.equal(v.ok,true);assert.equal(v.measuredWorldAccepted,true);assert.equal(v.hdMarchTraceAccepted,true);
  assert.equal(v.wholeHdAccepted,false);assert.equal(v.fullNativeAbiAccepted,false);
  assert.equal(v.actualInputProvenance,'caller-retained-original-trusted-trace');
  assert.equal(v.input.nativeLcdTouches,0);assert.equal(v.input.ackArmout,1);
  assert.deepEqual(v.tokens,[6,59,61,62,63,64,66,67,0,0]);
});
test('target can be reselected presentation-only after a retired gesture without duplicating confirmation',()=>{
  const f=fixture(),at=f.trustedActions.findIndex(a=>a.kind==='target-select'),original=f.trustedActions[at];
  // A zero-key second touch uses its own adjacent event window, never the same evidence twice.
  const repeat=structuredClone(original),firstUp=original.after.at,dt=.1;
  const insert=[{type:'pointerdown',trusted:true,target:repeat.target,pointerId:3,at:firstUp+dt},
    {type:'pointerup',trusted:true,target:repeat.target,pointerId:3,at:firstUp+dt*2}];
  const eventAt=original.after.eventCount;
  for(const e of f.trustedEvents.slice(eventAt))e.at+=1;
  for(const k of f.nativeKeys.slice(original.after.keyCount))k.at+=1;
  f.trustedEvents.splice(eventAt,0,...insert);
  repeat.before=structuredClone(original.after);repeat.before.at=firstUp+dt/2;
  repeat.after=structuredClone(repeat.before);repeat.after.at=firstUp+dt*3;repeat.after.eventCount+=2;
  for(const a of f.trustedActions.slice(at+1)){a.before.eventCount+=2;a.after.eventCount+=2;a.before.at+=1;a.after.at+=1;}
  for(const r of f.phaseTrace)if(['target-selected','armout','departed'].includes(r.stage)){r.state.eventCount+=2;r.state.at+=1;}
  f.trustedActions.splice(at+1,0,repeat);assert.equal(verifyMobileHdMarch(f).hdMarchTraceAccepted,true);
});
test('trace rejects missing native stage, wrong original identity, session drift and stale departed sequence',()=>{
  for(const mutate of [
    f=>f.phaseTrace=f.phaseTrace.filter(r=>r.stage!=='armout'),
    f=>f.phaseTrace[1].state.identity.generation++,
    f=>f.phaseTrace[1].state.identity.sha256='0'.repeat(64),
    f=>f.phaseTrace[1].state.march.session++,
    f=>f.phaseTrace.at(-1).state.march.seq=f.phaseTrace[0].state.march.seq,
    f=>f.phaseTrace.at(-1).state.march.ok=0
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyMobileHdMarch(f));}
});
test('trace rejects early food debit or order occupation during ARMOUT report',()=>{
  for(const mutate of [r=>r.world.cities[8].Food--,r=>r.world.orders[170].OrderId=27,
    r=>r.state.report.kind=2,r=>r.state.report.active=0]){
    const f=fixture();mutate(f.phaseTrace.find(r=>r.stage==='armout'));assert.throws(()=>verifyMobileHdMarch(f));
  }
});
test('target-only selection rejects cursor movement, native key, LCD touch, wrong target and world change',()=>{
  for(const mutate of [
    r=>r.state.march.mapCity++,r=>r.state.keyCount++,r=>r.state.touchCount++,
    r=>r.state.cityUi.pendingTarget=14,r=>r.world.people[0].Thew--
  ]){const f=fixture();mutate(f.phaseTrace.find(r=>r.stage==='target-selected'));assert.throws(()=>verifyMobileHdMarch(f));}
});
test('native target-tip report uses first actual selected PID; confirmed quantity must bind active native sample',()=>{
  for(const mutate of [
    f=>f.phaseTrace.find(r=>r.stage==='target-tip').state.report.person++,
    f=>f.phaseTrace.find(r=>r.stage==='food').state.qty.protocol=false,
    f=>f.phaseTrace.find(r=>r.stage==='food').state.qty.value--,
    f=>f.qty.value--
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyMobileHdMarch(f));}
});
test('trusted action rejects synthetic click, mismatched pointer, cancel/multiple pointers and untrusted DOWN',()=>{
  for(const mutate of [
    e=>e[0].trusted=false,e=>e[1].pointerId++,e=>e[1].type='pointercancel',
    e=>e[0].type='click',e=>e[1].target='other-control'
  ]){const f=fixture();mutate(f.trustedEvents);assert.throws(()=>verifyMobileHdMarch(f));}
});
test('input proof rejects extra Enter, invalid key, native LCD touch and evidence-window reuse',()=>{
  for(const mutate of [
    f=>f.nativeKeys[0].code=40,
    f=>f.nativeKeys[f.trustedActions.find(a=>a.kind==='target-confirm').before.keyCount].code=39,
    f=>{f.nativeTouches.push({args:[1,80,48],at:20});f.trustedActions[0].after.touchCount=1;},
    f=>{f.trustedActions[1].before.eventCount=f.trustedActions[0].before.eventCount;},
    f=>f.trustedActions[0].personId=199
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyMobileHdMarch(f));}
});
test('every key inside full march interval must belong to an actual trusted action',()=>{
  const f=fixture(),index=f.trustedActions.findIndex(a=>a.kind==='target-confirm');
  f.trustedActions.splice(index,1);assert.throws(()=>verifyMobileHdMarch(f));
});
test('immediate selection proof cannot be replaced by a final successful order alone',()=>{
  for(const mutate of [
    f=>f.selections.pop(),f=>f.selections[1].before.queue[1999]^=1,
    f=>f.selections[0].after.people[199].IQ^=1,f=>f.selections.reverse()
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyMobileHdMarch(f));}
});
test('final dispatch keeps the old strict ROM, fighter token, grain and complete sampled world checks',()=>{
  for(const mutate of [
    f=>{f.libBytes=Buffer.from(f.libBytes);f.libBytes[0]^=1;},
    f=>f.after.fighters[0]^=1,f=>f.after.people[199].Arms++,
    f=>f.after.cities[8].Food++,f=>f.after.orders[199].Food++
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyMobileHdMarch(f));}
});

test('two selected people may remain in PERSONS until one explicit trusted EXIT opens FOOD',()=>{
  const f=fixture(2,true);assert.deepEqual(f.phaseTrace.filter(r=>r.stage==='persons').map(r=>r.state.march.selected),[0,1,2]);
  assert.equal(verifyMobileHdMarch(f).hdMarchTraceAccepted,true);
  const finish=f.trustedActions.find(a=>a.kind==='finish-persons');f.nativeKeys[finish.before.keyCount].code=39;
  assert.throws(()=>verifyMobileHdMarch(f));
});
