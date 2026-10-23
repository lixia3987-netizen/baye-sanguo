import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as M from './hd-wood-buy-continuation.mjs';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';
import {createBuyFixture,currentReferenceWorld,libBytes,nativeBudget,observerExpected,add,raw} from './fixtures/hd-wood-buy-continuation.mjs';

const copy=structuredClone,base=createBuyFixture(),stopped=createBuyFixture({paidUnscheduled:true}),sha=b=>createHash('sha256').update(b).digest('hex');
const readiness=(world=currentReferenceWorld,extra={})=>M.sourceBuyReadiness({world,libBytes,nativeBudget,route:{origin:16,destination:12},...extra});
function reject(name,fn,mutate,pattern){test(name,()=>{const a=copy(base);mutate(a);assert.throws(()=>fn(a),pattern);});}
function buyWorld(a,mutate){mutate(a.buy.afterTicket.world);a.buy.quantity.done.world=copy(a.buy.afterTicket.world);}
function worldChanged(mutator){const w=copy(currentReferenceWorld);mutator(w);return w;}
function returned(){const before=copy(base.queuedWorld),after=copy(before);add(after,20,50);after.orders[0].OrderId=255;return{before,after,slot:0,expectedOrder:copy(before.orders[0])};}
function noActual(result){for(const[k,v]of Object.entries(result))if(/^(actual|hdAccepted|globalHdComplete|publicInputAccepted|publicSaveAccepted|nativeExecutionAccepted|rngContinuityAccepted)/.test(k)&&typeof v==='boolean'&&!k.endsWith('StillRequired'))assert.equal(v,false,k);}

test('Current published September pair, complete world and controlled fixture preserve the authoritative source',()=>{const p='docs/validation/m5-wood67-missing-20261024-v40',a=fs.readFileSync(p+'-sango0.sav'),b=fs.readFileSync(p+'-sango1.sav');assert.deepEqual([a.length,sha(a),b.length,sha(b)],[8221,'40edc75d6da65b6d540ba3f2f50df629677cd1e234d701624dc713cdd48c77e0',4840,'6ad8f18531509ed68dcdacac2bc489b6c4498c86d90b418d0bc0ee25af3348ae']);assert.equal(verifyOriginalSavePair({sav0:a.toString('hex'),sav1:b.toString('hex'),world:currentReferenceWorld}).ok,true);assert.deepEqual([currentReferenceWorld.year,currentReferenceWorld.month,currentReferenceWorld.people[131].Arms,currentReferenceWorld.people[131].Experience],[239,9,2431,12]);});
test('Readiness derives Buy40, source targets, current guard and dynamic481 budget without spending or current AIM credit',()=>{const r=readiness();assert.equal(r.accepted,true);assert.deepEqual([r.plan.money.cost,r.plan.money.after,r.plan.food.after,r.plan.thew.cost],[200,886,267,12]);assert.deepEqual([r.budget.army,r.budget.squareRoot,r.budget.daily,r.budget.carryFood,r.budget.residentGuardArms,r.budget.fullReturningArms,r.budget.fullReturningStrictFood],[2431,49,16,481,1410,6808,137]);assert.deepEqual([r.route.mapId,r.route.nativeWay,r.route.timeCount],[112,4,1]);assert.deepEqual(r.opportunity.sourcePotentialTargets.map(x=>[x.personId,x.sourceSlot]),[[117,11],[134,12],[145,13],[16,14]]);assert.equal(r.opportunity.actualCurrentAimQualified,false);assert.equal(r.opportunity.futureEnemyMovementGuaranteed,false);noActual(r);});
test('Whole Buy, exact repeated picker Escape, packed SAVE, original March and END chain are accepted only as pure contracts',()=>{const p=M.verifyBuyPreparation(base),r=M.verifyBuyEndAdmission(base);assert.deepEqual([p.paidWorld.cities[20].Food,p.paidWorld.cities[20].Money,p.paidWorld.people[50].Thew],[267,886,88]);assert.deepEqual(r.expectedOrders.map(x=>[x.slot,x.order.OrderId]),[[0,11],[170,27]]);assert.deepEqual(r.expectedNativeBattle,{mode:1,way:4,mapId:112,cityIndex:12,cargo:481,nativeSlots:20});assert.equal(r.queuedWorld.cities[16].Food,290);assert.deepEqual(r.queuedWorld.queue.slice(200),base.referenceWorld.queue.slice(200));assert.deepEqual(r.queuedWorld.goodsQueue,base.referenceWorld.goodsQueue);assert.equal(r.queuedWorld.futureWorld.keep[1],13);assert.deepEqual(r.queuedWorld.people[129],base.referenceWorld.people[129]);assert.equal(M.assessBuyOwnedFood({world:r.queuedWorld}).accepted,true);noActual(p);noActual(r);});
test('Measured paid-but-not-enqueued Buy has a real failed SAVE and cannot authorize retry or March',()=>{const r=M.classifyStoppedBuy(stopped);assert.equal(r.classification,'paid-but-not-enqueued');assert.equal(r.mustPreserveMeasuredWorld,true);assert.equal(r.retryAuthorized,false);assert.equal(r.marchAuthorized,false);assert.equal(r.accepted,false);noActual(r);assert.throws(()=>M.verifyBuyPreparation(stopped));});
test('Actual current army2900 produces511 cargo instead of inheriting481 or old541',()=>{const a=createBuyFixture({referenceWorld:worldChanged(w=>w.people[131].Arms=2900)}),r=M.verifyBuyEndAdmission(a);assert.deepEqual([r.budget.army,r.budget.squareRoot,r.budget.daily,r.budget.carryFood],[2900,53,17,511]);assert.equal(r.queuedWorld.cities[16].Food,260);});
test('Actor50 exact12 Thew is sufficient and MAKE leaves0',()=>{const a=createBuyFixture({referenceWorld:worldChanged(w=>w.people[50].Thew=12)});assert.equal(M.verifyBuyPreparation(a).paidWorld.people[50].Thew,0);});
test('Foreign stale raw copies of131 and50 are retained without becoming owned residents twice',()=>{const ref=worldChanged(w=>{add(w,1,131);add(w,1,50);}),a=createBuyFixture({referenceWorld:ref}),r=M.verifyBuyEndAdmission(a);assert.ok(raw(r.queuedWorld,1).includes(131)&&raw(r.queuedWorld,1).includes(50));assert.equal(r.budget.fullReturningArms,6808);});
test('Original Buy callback AddPerson and DelOrder preserve all2000 queue, goods, opaque and unknown fields without paying again',()=>{const a=returned(),r=M.verifyBuyReturnWorld(a);assert.equal(r.accepted,true);assert.deepEqual([r.additionalFoodAtReturn,r.additionalMoneyAtReturn],[0,0]);assert.deepEqual(a.after.orders[0],{...a.before.orders[0],OrderId:255});assert.deepEqual(a.after.queue.slice(200),a.before.queue.slice(200));noActual(r);});
test('Buy picker excludes neutral stale171 and retains actual owned order including actor50 index1',()=>{const s=base.buy.actorSelection;assert.equal(s.beforeEnter.state.menu.index,1);assert.ok(!s.initial.state.menu.ids.includes(171));assert.deepEqual(s.keys.map(x=>x.code),[35,39]);assert.deepEqual(base.buy.buySelection.keys.map(x=>x.code),[39]);});
test('Original source defender swaps preserve C tie reversal rather than JavaScript stable sorting',()=>{const w=worldChanged(w=>{for(const[id,n]of[[145,1],[136,1],[16,2],[117,3],[134,4]])w.people[id].Arms=n;});assert.deepEqual(readiness(w).opportunity.sourceOriginalDefenderIds,[134,117,16,136,145]);});
test('Original source defender sorting trims zero tail during each inner iteration before assigning native slots',()=>{const w=worldChanged(w=>{for(const[id,n]of[[145,1],[136,1],[16,2],[117,0],[134,0]])w.people[id].Arms=n;});const r=readiness(w).opportunity;assert.deepEqual(r.sourceOriginalDefenderIds,[16,136,145]);assert.deepEqual(r.sourcePotentialTargets.map(x=>[x.personId,x.sourceSlot]),[[136,11],[145,12]]);});
test('Zero-arm source defenders cannot establish a paid WOOD opportunity',()=>{const w=worldChanged(w=>{for(const id of[145,136,16,117,134])w.people[id].Arms=0;});assert.throws(()=>readiness(w),/sole CITY keeper/);});
reject('March quantity completion cannot change phase before native target-map entry',M.verifyBuyMarchDispatch,a=>{a.marchEvidence.quantity.done.state.march.phase=0;a.marchEvidence.targetWalk.initial.state.march.phase=0;});

for(const[name,change,pattern]of[
 ['11Thew cannot pay real LIB12',w=>w.people[50].Thew=11,/IsManual12/],
 ['Guard includes only actual current residents, never reserve',w=>{w.people[40].Arms=0;w.people[0].Arms=0;w.cities[16].MothballArms=30000;},/Guard counts current residents only/],
 ['Buy39 equivalent shortage remains unsafe',w=>w.cities[20].Food=226,/Exactly current40/],
 ['Already repaired city cannot pay a duplicate Buy40',w=>w.cities[20].Food=267,/Exactly current40/],
 ['Buy must leave500 current cash',w=>w.cities[20].Money=699,undefined],
 ['Other city current shortage cannot use projected income',w=>w.cities[7].Food=0,/Every other current owned city safe/],
 ['Full native order array rejects paid dispatch planning',w=>w.orders.forEach(o=>o.OrderId=24),undefined],
 ['Resident131 duplicated in another owned city is rejected',w=>add(w,7,131),/Unique current owned resident/],
 ['Resident50 duplicated in current city is rejected',w=>add(w,20,50),/Unique current owned resident/],
 ['Captured129 cannot be silently recovered',w=>w.people[129].Belong=1,undefined],
 ['Daily raw256 cannot narrow to zero U8',w=>w.config.ratioOfFoodToArmsPerDay=256,/daily U8 cannot narrow to zero/],
 ['Full-return monthly U16 cannot overflow',w=>{w.people[131].Arms=65000;w.cities[16].Food=65535;},/U16 monthly-arm sum/],
 ['No zero army continuation is authorized',w=>w.people[131].Arms=0,undefined],
 ['Insufficient source food cannot spend cargo before full army return',w=>w.cities[16].Food=617,/cargo and complete actual army return/]
])test(name,()=>{const w=worldChanged(change),nb={...nativeBudget,dailyRatio:w.config.ratioOfFoodToArmsPerDay,monthlyRatio:w.config.ratioOfFoodToArmsPerMouth};assert.throws(()=>readiness(w,{nativeBudget:nb}),pattern);});

test('Geometric16→15 route with sole CITY5 keeper is rejected as this WOOD preparation opportunity',()=>assert.throws(()=>readiness(currentReferenceWorld,{route:{origin:16,destination:15}}),/sole CITY keeper/));
for(const field of['nativeWay','mapId','coordinates'])test('Caller cannot override original route '+field,()=>assert.throws(()=>readiness(currentReferenceWorld,{route:{origin:16,destination:12,[field]:1}})));
test('Public food assessor cannot receive a bare live operatingArmy claim',()=>assert.throws(()=>M.assessBuyOwnedFood({world:base.queuedWorld,operatingArmy:{personId:131,city:16}}),/complete current runtime ticket/));

for(const[name,change]of[
 ['population',w=>w.cities[20].Population--],['extra money',w=>w.cities[20].Money--],['tail queue1999',w=>w.queue[1999]--],['goods1999',w=>w.goodsQueue[1999]--],['unknown world',w=>w.futureWorld.keep[1]++],['unknown person',w=>w.people[51].futurePerson.keep++],['unknown order',w=>w.orders[0].futureOrder.keep++],['extra50Thew',w=>w.people[50].Thew--]
])reject('Whole native Buy rejects synchronized '+name,M.verifyBuyPreparation,a=>buyWorld(a,change),/Only full native Buy/);

for(const[field,value]of[['Object',65536],['Consume',256]])test('Direct ticket checks typed Buy order '+field+' beyond native width',()=>{const t=copy(base.buy.afterTicket);t.world.orders[0][field]=value;assert.throws(()=>M.verifyBuyTicket({ticket:t,libBytes,nativeBudget,observerExpected:false}),new RegExp(field));});
test('Native opaque Buy Object65535 and Consume255 remain legal and semantically uninterpreted',()=>{const r=M.verifyBuyPreparation(base);assert.deepEqual([r.expectedBuyOrder.Object,r.expectedBuyOrder.Consume],[65535,255]);noActual(r);});

reject('Person picker requires a genuinely repeated complete fresh ticket',M.verifyBuyPreparation,a=>a.buy.actorSelection.fresh.state.snapshot.references.unknownReference++,/Immediately re-read/);
reject('Person arrow cannot mutate another native state owner',M.verifyBuyPreparation,a=>{a.buy.actorSelection.beforeEnter.state.qty.extra=1;a.buy.actorSelection.fresh=copy(a.buy.actorSelection.beforeEnter);},/Entire person or Buy-choice cursor state/);
reject('Person picker cannot skip its actual ArrowDown',M.verifyBuyPreparation,a=>a.buy.actorSelection.keys.shift(),/Complete original key receipts/);
reject('Buy choice must be original Buy index0 rather than Sell',M.verifyBuyPreparation,a=>{a.buy.buySelection.beforeEnter.state.menu.index=1;a.buy.buySelection.fresh=copy(a.buy.buySelection.beforeEnter);});
reject('Unknown metadata cannot drift between initial and ready picker',M.verifyBuyPreparation,a=>{a.buy.actorSelection.beforeEnter.meta.unknownMeta.keep[0]++;a.buy.actorSelection.fresh=copy(a.buy.actorSelection.beforeEnter);},/Complete native metadata/);
reject('Exact cityMake wrapper function source is required',M.verifyBuyPreparation,a=>a.buy.beforeTicket.meta.recruitmentHookFence.hooks[0].functionSource='function () { return 0; }');
reject('Stable callHook function identity cannot change',M.verifyBuyPreparation,a=>{a.buy.actorSelection.beforeEnter.meta.recruitmentHookFence.callHook.functionRef++;a.buy.actorSelection.fresh=copy(a.buy.actorSelection.beforeEnter);});
reject('Quantity requires complete immediate beforeEnter fresh',M.verifyBuyPreparation,a=>a.buy.quantity.fresh.state.qty.value++);
reject('Quantity arrow must keep all native state except quantity ACK and keys',M.verifyBuyPreparation,a=>a.buy.quantity.steps[0].after.state.march.extra=1,/Entire quantity arrow state/);
reject('Quantity ACK input sequence cannot skip a native receipt',M.verifyBuyPreparation,a=>a.buy.quantity.steps[0].after.state.qty.inputSeq++,/Native NumOperate receipt/);
reject('Quantity key cannot belong to another original fight owner',M.verifyBuyPreparation,a=>a.buy.quantity.keys[0].fight.futureFight.keep++,/Original key belongs/);
reject('Measured Buy needs the explicit repeated picker exit',M.verifyBuyPreparation,a=>delete a.buy.exit);
reject('Repeated picker Exit needs its fresh full ticket',M.verifyBuyPreparation,a=>a.buy.exit.fresh.world.cities[20].Population--,/Fresh full picker/);
reject('Repeated picker Exit cannot clear unknown snapshot data',M.verifyBuyPreparation,a=>delete a.buy.exit.after.state.snapshot.fight.futureFight,/Entire original picker Escape/);
reject('Repeated picker Exit permits exactly one Escape',M.verifyBuyPreparation,a=>a.buy.exit.keys.push(copy(a.buy.exit.keys[0])),/Complete original key receipts/);
reject('Public SAVE cannot hide an extra native key after picker Exit',M.verifyBuyPreparation,a=>a.buy.publicSave.before.state.keys++,/Public SAVE begins at exact post-Escape/);
reject('Explicit Buy SAVE tag cannot be replaced after payment',M.verifyBuyPreparation,a=>a.buy.publicSave.tag='wood67-131-v41-other');
reject('Packed SAVE must represent measured paid world',M.verifyBuyPreparation,a=>{const b=Buffer.from(a.buy.publicPair.sav0,'hex');b[16+50*19+10]++;a.buy.publicPair.sav0=b.toString('hex');});
reject('Both actual SAVE file byte bindings are verified',M.verifyBuyPreparation,a=>a.buy.publicSave.files[1].bytes++);
reject('Public SAVE requires all four actual original key receipts',M.verifyBuyPreparation,a=>a.buy.publicSaveKeys.pop());
test('Paid-unqueued cannot accept quantity41 beyond measured40 or skip its actual failed SAVE exit',()=>{const a=copy(stopped);a.buy.afterTicket.world.cities[20].Food++;assert.throws(()=>M.classifyStoppedBuy(a),/Only actual paid unqueued/);const b=copy(stopped);delete b.buy.exit;assert.throws(()=>M.classifyStoppedBuy(b));});

reject('March partial cannot debit cargo before target confirmation',M.verifyBuyMarchPartial,a=>a.marchPartialTicket.world.cities[16].Food--);
reject('March quantity.done cannot replace partial world while later walks agree',M.verifyBuyMarchDispatch,a=>{const r=a.marchEvidence;r.quantity.done.world.cities[16].Food--;for(const t of[r.targetWalk.initial,...r.targetWalk.steps.flatMap(x=>[x.before,x.fresh,x.after]),r.targetConfirmation.before,r.targetConfirmation.fresh])t.world=copy(r.quantity.done.world);},/Quantity completion keeps exact/);
reject('Map walk cannot omit actual direction inputs',M.verifyBuyMarchDispatch,a=>delete a.marchEvidence.targetWalk,/Actual target-map walk/);
reject('Map walk must use exact ROM map bytes',M.verifyBuyMarchDispatch,a=>a.marchEvidence.targetWalk.mapHex='00'.repeat(108),/Actual target map equals original LIB/);
reject('Map geometry must be independently read twice',M.verifyBuyMarchDispatch,a=>a.marchEvidence.targetWalk.geometryAgain.screenWidth=159,/Actual target geometry double read/);
reject('Native default100 cursor bounds cannot be caller widened',M.verifyBuyMarchDispatch,a=>{a.marchEvidence.targetWalk.geometry.cursorRange.right=101;a.marchEvidence.targetWalk.geometryAgain.cursorRange.right=101;},/Original C cursor range/);
reject('Each map direction needs a fresh complete ticket',M.verifyBuyMarchDispatch,a=>a.marchEvidence.targetWalk.steps[0].fresh.state.snapshot.references.unknownReference++,/Fresh full map ticket/);
reject('Native map arrow cannot change unknown world fields',M.verifyBuyMarchDispatch,a=>a.marchEvidence.targetWalk.steps[0].after.world.futureWorld.keep[1]++,/Entire original map arrow/);
reject('Direction key must preserve measured mapCity',M.verifyBuyMarchDispatch,a=>a.marchEvidence.targetWalk.steps[0].after.state.march.mapCity++,/Entire original map arrow/);
reject('Direction must preserve geometry on the third read',M.verifyBuyMarchDispatch,a=>a.marchEvidence.targetWalk.steps[0].geometryAfter.screenHeight++,/geometry stays stable/);
reject('Target confirmation cannot come from a stale pre-arrow ticket',M.verifyBuyMarchDispatch,a=>a.marchEvidence.targetConfirmation.before=copy(a.marchEvidence.targetWalk.initial),/Target confirmation belongs/);
for(const[name,change]of[['foreign raw tail',w=>w.queue[1999]--],['goods',w=>w.goodsQueue[1999]--],['extra cargo',w=>w.orders[170].Food++],['old Way-related destination',w=>w.orders[170].Object=15],['wrong natural Time',w=>w.orders[170].TimeCount=2],['extra army flag',w=>w.fighterIndex[1]=1],['second army token',w=>w.fighters[2]=2],['unknown order',w=>w.orders[170].futureOrder.keep++]] )reject('Entire original March rejects '+name,M.verifyBuyMarchDispatch,a=>change(a.marchAfterTicket.world),/Entire native original March delta/);
reject('Dispatch SAVE tag is predeclared before this run',M.verifyBuyMarchDispatch,a=>a.expectedDispatchTag='wood67-131-v41-relabelled');
reject('Dispatch packed pair cannot be old pre-March checkpoint',M.verifyBuyMarchDispatch,a=>a.dispatchPair=copy(a.buy.publicPair));
reject('END must recompute the exact queued world rather than accept a passed boolean',M.verifyBuyEndAdmission,a=>a.world=copy(a.buy.afterTicket.world));
reject('END requires the real complete current no-takeover observer fence',M.verifyBuyEndAdmission,a=>delete a.hookFence);
reject('END requires declared original observer source',M.verifyBuyEndAdmission,a=>a.observerExpected.functionSource+=' ');

for(const[name,change]of[['second food credit',w=>w.cities[20].Food+=40],['second money debit',w=>w.cities[20].Money-=200],['unknown change',w=>w.futureWorld.keep[1]++],['tail2000',w=>w.queue[1999]--],['clear opaque stack',w=>w.orders[0].Object=0]])test('Native Buy return rejects '+name,()=>{const a=returned();change(a.after);assert.throws(()=>M.verifyBuyReturnWorld(a),/Complete original Buy AddPerson and DelOrder/);});
test('Native Buy return cannot use a later retired order or missing original AddPerson',()=>{const a=returned();a.slot=1;assert.throws(()=>M.verifyBuyReturnWorld(a));const b=returned();b.after=copy(b.before);b.after.orders[0].OrderId=255;assert.throws(()=>M.verifyBuyReturnWorld(b),/Complete original Buy AddPerson and DelOrder/);});
