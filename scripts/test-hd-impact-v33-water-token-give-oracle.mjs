// Controlled native-world/callback contracts only. No browser, game or RNG execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {planV33WaterTokenGive,verifyV33WaterTokenGiveTwoStage,recomputeV33CanvassMonthReturns} from './hd-impact-v33-water-token-give-oracle.mjs';
import {verifyV23Canvass16NaturalReturn} from './hd-impact-v32-canvass16-natural-return.mjs';
const input=readFileSync(new URL('../docs/validation/m5-impact13-bounded-canvass-20261023-v32-prefix-acquisition-latest-world.json',import.meta.url));
const W=JSON.parse(input),libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url)),copy=structuredClone;
assert.deepEqual([W.year,W.month],[239,3]);
function cityOf(w,id){return w.cities.findIndex(c=>w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).includes(id));}
function drop(w,city,id){const e=copy(w),c=e.cities[city],i=e.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).indexOf(id);assert.ok(i>=0);
    for(let q=c.PersonQueue+i;q<199;q++)e.queue[q]=e.queue[q+1];c.Persons--;for(let j=city+1;j<38;j++)e.cities[j].PersonQueue--;return e;}
function put(w,city,id){const e=copy(w),c=e.cities[city],at=c.PersonQueue;for(let q=199;q>at;q--)e.queue[q]=e.queue[q-1];e.queue[at]=id;c.Persons++;for(let j=city+1;j<38;j++)e.cities[j].PersonQueue++;return e;}
function sample(w,slot,ordinal){const order=copy(w.orders[slot]),a={world:copy(w),meta:{identity:'controlled-only',currentIdentity:true,gameplayHooks:[{name:'countMove',present:false}],opaque:{kept:[null,31]}}},async={id:0,params:Array(32).fill(0),text:'原样'};
    return {ordinal,order,a,b:copy(a),contextAfter:copy(order),asyncBefore:async,asyncAfter:copy(async),
        slotCandidates:w.orders.flatMap((o,i)=>JSON.stringify(o)===JSON.stringify(order)?[i]:[]),contextUnchanged:true,asyncActionUnchanged:true,returnValue:-1};}
function month({actors=[5,36],origins=actors.map(()=>6),outcomes=actors.map(()=>true),alreadyOwned=false}={}){
    let queued=copy(W);
    if(alreadyOwned){queued=put(drop(queued,cityOf(queued,114),114),6,114);queued.people[114].Belong=1;queued.people[114].Devotion=55;}
    actors.forEach((actor,i)=>{const city=origins[i];queued.people[actor].Thew=44;queued.cities[city].Money-=150;queued=drop(queued,city,actor);
        queued.orders[i]={...queued.orders[i],OrderId:16,Person:actor,City:city,Object:114,TimeCount:10,Arms:31313,Food:50001,Money:23456,Consume:197,opaque:[null,1]};});
    queued.orders[199]={...queued.orders[199],OrderId:0,Person:116,City:33,TimeCount:0};
    let current=copy(queued);const samples=[];
    actors.forEach((actor,i)=>{const city=origins[i];samples.push(sample(current,i,i));
        if(outcomes[i]){current=put(drop(current,cityOf(current,114),114),city,114);current.people[114].Belong=1;current.people[114].Devotion=55+i;}
        current=put(current,city,actor);current.orders[i].OrderId=255;});
    samples.push(sample(current,199,actors.length));const observer={installed:true,samples,calls:samples.map(s=>copy(s.order)),controlledOnly:true};
    const returns=actors.map((_,orderIndex)=>verifyV23Canvass16NaturalReturn({queuedWorld:queued,observer,orderIndex}));
    const world=copy(current);world.month=4;for(const o of world.orders)o.OrderId=255;
    return {world,canvassMonth:{queuedWorld:queued,observer},returns};
}
function options(m=month()){return {world:m.world,personId:114,libBytes,canvassReturns:m.returns,canvassMonth:m.canvassMonth};}
function stages(m=month()){
    const before=m.world,reportWorld=copy(before),at=before.cities[6].ToolQueue;
    reportWorld.people[114].ArmsType=3;for(let q=at;q<1999;q++)reportWorld.goodsQueue[q]=before.goodsQueue[q+1];
    reportWorld.cities[6].Tools--;for(let j=7;j<38;j++)reportWorld.cities[j].ToolQueue--;
    const retiredWorld=copy(reportWorld);retiredWorld.people[114].Devotion=Math.min(100,(before.people[114].Devotion+8)&255);
    return {before,reportWorld,retiredWorld,emptyMessageWorld:copy(retiredWorld),personId:114,libBytes,canvassReturns:m.returns,canvassMonth:m.canvassMonth};
}
test('March city6 complete native acquisition permits one April source-model Give and preserves all actual-credit flags',()=>{
    const x=stages(month({actors:[5]})),p=verifyV33WaterTokenGiveTwoStage(x);
    assert.equal(p.accepted,true);assert.equal(p.equipmentSlotsUnchanged,true);
    for(const [k,v]of Object.entries(p))if(k.startsWith('actual')||k==='hdAccepted'||k==='globalHdComplete')assert.equal(v,false,k);
    assert.equal(x.retiredWorld.people[114].ArmsType,3);assert.notEqual(W.people[114].Belong,1);
});
test('two city6 returns retain first acquisition plus observed already-owned same-city return',()=>{
    const m=month(),p=planV33WaterTokenGive(options(m));
    assert.deepEqual(p.sourceReturns.map(r=>[r.cityIndex,r.targetAcquiredAtNativeReturn]),[[6,true],[6,false]]);
    assert.deepEqual(recomputeV33CanvassMonthReturns({canvassMonth:m.canvassMonth,canvassReturns:m.returns}),m.returns);
});
test('one failed then one successful native return remains a genuine acquisition',()=>{
    const p=planV33WaterTokenGive(options(month({outcomes:[false,true]})));assert.equal(p.sourceReturns.length,1);
});
test('an already-owned target is never acquired again merely by returning to city6',()=>{
    assert.throws(()=>planV33WaterTokenGive(options(month({actors:[5],alreadyOwned:true}))));
});
test('isolated ZhangXiu is not authorized by a different target native return',()=>{
    const o=options();o.personId=131;assert.throws(()=>planV33WaterTokenGive(o));
});
test('remote-city acquisition is not a city6 preparation batch',()=>{
    const o=options(month({actors:[6,36],origins:[7,6]}));assert.throws(()=>planV33WaterTokenGive(o),/originates/);
});
test('three orders for one target cannot authorize the optional gift',()=>{
    assert.throws(()=>planV33WaterTokenGive(options(month({actors:[5,36,51]}))),/two pending/);
});
test('four queued player orders are rejected before a shorter callback set can authorize Give',()=>{
    const o=options(),queued=o.canvassMonth.queuedWorld;
    queued.orders[2]={...queued.orders[0],Person:51,Object:129};
    queued.orders[3]={...queued.orders[0],City:7,Person:6,Object:125};
    assert.throws(()=>planV33WaterTokenGive(o),/bounded city6/);
});
for(const [name,change]of Object.entries({
    staleFebruary:o=>o.canvassMonth.queuedWorld.month=2,
    unsettledMarch:o=>o.world.month=3,
    laterMay:o=>o.world.month=5,
    callbackAlreadyApril:o=>{for(const s of o.canvassMonth.observer.samples)for(const t of[s.a,s.b])t.world.month=4;},
    missingRow:o=>o.canvassMonth.observer.samples.pop(),
    missingCausalReturn:o=>o.canvassReturns.pop(),
    fabricatedSummary:o=>o.canvassReturns=[{accepted:true,targetId:114,nativeOutcome:'success'}],
    observerMutation:o=>o.canvassMonth.observer.samples[0].a.world.cities[0].Money++,
    duplicateEnvoy:o=>o.canvassMonth.queuedWorld.orders[1].Person=5,
    unapprovedEnvoy:o=>o.canvassMonth.queuedWorld.orders[1].Person=21,
    pendingOrder:o=>o.world.orders[0].OrderId=16,
    notOwned:o=>o.world.people[114].Belong=3,
    occupiedEquipment:o=>o.world.people[114].Tool1=1,
    tokenNotDiscovered:o=>o.world.goodsQueue[o.world.cities[6].ToolQueue]=32,
    alreadyWaterArmy:o=>o.world.people[114].ArmsType=3,
    sourceMpTooLow:o=>o.world.people[114].Thew=1
}))test('V33 Give rejects '+name,()=>{const o=options();change(o);assert.throws(()=>planV33WaterTokenGive(o));});
for(const [name,change]of Object.entries({
    money:x=>x.reportWorld.cities[6].Money--,
    earlyDevotion:x=>x.reportWorld.people[114].Devotion++,
    extraArms:x=>x.reportWorld.people[114].Arms++,
    changedQueueTail:x=>x.reportWorld.queue[1999]++,
    changedGoodsTail:x=>x.reportWorld.goodsQueue[1999]++,
    lostOpaque:x=>x.reportWorld.orders[0].opaque.pop(),
    wrongRetiredDevotion:x=>x.retiredWorld.people[114].Devotion++,
    emptyMessageMutation:x=>x.emptyMessageWorld.month=5
}))test('two native Give phases reject unrelated delta '+name,()=>{const x=stages();change(x);assert.throws(()=>verifyV33WaterTokenGiveTwoStage(x));});
test('controlled fixture derivation never edits the published March input bytes',()=>{
    const before=createHash('sha256').update(input).digest('hex');stages();
    assert.equal(createHash('sha256').update(readFileSync(new URL('../docs/validation/m5-impact13-bounded-canvass-20261023-v32-prefix-acquisition-latest-world.json',import.meta.url))).digest('hex'),before);
});
