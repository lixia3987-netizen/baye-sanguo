import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {impactArmyOracleContract,planRecruitment,verifyRecruitment,planDistribution,verifyDistribution} from './hd-impact-army-runtime-oracle.mjs';
import {verifyMobileRecruitment} from './hd-mobile-recruitment-runtime-oracle.mjs';
import {verifyMobileDistribution} from './hd-mobile-distribution-runtime-oracle.mjs';
const raw=readFileSync(new URL('./fixtures/hd-impact-v17-june-army-world.json',import.meta.url)),genuine=JSON.parse(raw),provenance=JSON.parse(readFileSync(new URL('./fixtures/hd-impact-v17-june-army-world-provenance.json',import.meta.url))),libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex'),clone=v=>structuredClone(v);
// Fixed controlled examples, not actual recruitment or distribution evidence.
function recruited(before=clone(genuine)){
 const after=clone(before);after.cities[13].Money=29895;after.cities[13].MothballArms=1054;after.cities[13].Persons=5;after.people[43].Thew=88;
 after.queue=[...before.queue.slice(0,58),...before.queue.slice(59,200),before.queue[199],...before.queue.slice(200)];
 for(let i=14;i<38;i++)after.cities[i].PersonQueue=before.cities[i].PersonQueue-1;
 after.orders[0]={...before.orders[0],OrderId:24,Person:43,City:13,TimeCount:0,Object:412,Arms:255,Food:600,Money:37,Consume:252};
 return after;
}
function recruitment(){const before=clone(genuine);return{before,after:recruited(before),libBytes,cityIndex:13,personId:43,quantity:1054};}
function distribution(){const before=recruited(),after=clone(before);after.people[129].Arms=1810;after.cities[13].MothballArms=0;return{before,after,libBytes,cityIndex:13,personId:129,targetArms:1810};}
const duplicates=[{personId:65,occurrences:[{cityIndex:1,queueIndex:8},{cityIndex:7,queueIndex:27}]},{personId:136,occurrences:[{cityIndex:12,queueIndex:48},{cityIndex:21,queueIndex:98}]},{personId:138,occurrences:[{cityIndex:22,queueIndex:99},{cityIndex:26,queueIndex:121}]}];

test('Fixture is byte-exact genuine June saved input; controlled after-worlds grant no actual input or HD credit',()=>{
 assert.equal(raw.length,77936);assert.equal(sha(raw),'f85eb617e3700e80a4df4650ca4465de5340f749710650b710bdc69ba6297e51');assert.equal(sha(raw),provenance.fixture.sha256);assert.deepEqual([genuine.year,genuine.month],[237,6]);assert.equal(genuine.cities[13].State,3);assert.deepEqual(genuine.queue.slice(56,62),[129,60,43,37,23,39]);assert.equal(provenance.controlledExamples.afterWorldsAreControlled,true);assert.equal(provenance.controlledExamples.afterWorldsAreActualGameEvidence,false);
 for(const f of provenance.oldModulesRemainUnchanged){const bytes=readFileSync(new URL('../'+f.path,import.meta.url));assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);}
 const verdict=verifyRecruitment(recruitment());for(const k of['inputAccepted','actualInputAccepted','actualPreparationAccepted','actualCastAccepted','hdAccepted','wholeNativeAbiAccepted','strategyMonthAccepted'])assert.equal(verdict[k],false,k);
});
test('Regression: historical global-PID gates reject the actual legal raw input; new raw plans preserve every duplicate',()=>{
 const r=recruitment(),d=distribution();assert.throws(()=>verifyMobileRecruitment(r),/duplicate/);assert.throws(()=>verifyMobileDistribution({...d,quantity:1810}),/duplicate/);
 const before=clone(r.before),p=planRecruitment({world:r.before,...r});assert.deepEqual(p.rawDuplicateResidents,duplicates);assert.deepEqual(r.before,before);assert.deepEqual(p.rawDuplicateResidents,provenance.rawDuplicateResidents);assert.equal(p.queueIndex,58);
});
test('June recruitment plan uses original GetArmy maximum1380, fixed ROM12 and floor1054/10=105',()=>{
 const p=planRecruitment({world:clone(genuine),libBytes,cityIndex:13,personId:43,quantity:1054});assert.deepEqual([p.min,p.max,p.initialValue,p.quantity],[0,1380,1380,1054]);assert.deepEqual([p.orderIndex,p.queueIndex,p.moneyAfter,p.thewAfter,p.stockAfter],[0,58,29895,88,1054]);assert.deepEqual(p.initializedOrder,{OrderId:24,Person:43,City:13,TimeCount:0});assert.equal(p.minimumMoney,1);assert.equal(p.sourceOnlyPlanning,true);assert.equal(p.actualInputAccepted,false);
});
test('Controlled recruitment matches full raw world, retains real disasterState3 and all inherited duplicates',()=>{
 const f=recruitment(),a=clone(f.before),b=clone(f.after),v=verifyRecruitment(f);assert.equal(v.accepted,true);assert.equal(v.wholeMeasuredWorldExact,true);assert.deepEqual(v.money,{before:30000,after:29895,cost:105,minimum:1,armsPerMoney:10});assert.deepEqual(v.thew,{before:100,after:88,cost:12});assert.equal(f.after.cities[13].State,3);assert.equal(f.after.people[129].Arms,756);assert.deepEqual(f.before,a);assert.deepEqual(f.after,b);
});
test('Only the five new-slot opaque U8/U16 fields are observed; no cargo semantics or existing-row mask',()=>{
 const f=recruitment(),v=verifyRecruitment(f);assert.deepEqual(v.uninitializedOrderMask,{orderIndex:0,fields:['Object','Arms','Food','Money','Consume'],actual:{Object:412,Arms:255,Food:600,Money:37,Consume:252},semanticAcceptance:false});f.after.orders[0].Object=65535;f.after.orders[0].Consume=0;assert.equal(verifyRecruitment(f).accepted,true);
});
test('DelPerson copies through198, repeats unchanged199, preserves every slot200..1999 and other raw queues',()=>{
 const before=clone(genuine);before.queue[198]=2101;before.queue[199]=2202;before.queue[200]=3303;before.queue[1999]=4404;const after=recruited(before);verifyRecruitment({before,after,libBytes,cityIndex:13,personId:43,quantity:1054});assert.equal(after.queue[197],2101);assert.equal(after.queue[198],2202);assert.equal(after.queue[199],2202);assert.equal(after.queue[200],3303);assert.equal(after.queue[1999],4404);assert.deepEqual(after.queue.slice(200),before.queue.slice(200));assert.deepEqual(after.goodsQueue,before.goodsQueue);
});
test('Positive quantity9 rounds cash debit down to0 but still requires native IsMoney1',()=>{
 const f=recruitment();f.quantity=9;f.after.cities[13].Money=30000;f.after.cities[13].MothballArms=9;assert.equal(verifyRecruitment(f).money.cost,0);f.before.cities[13].Money=0;assert.throws(()=>verifyRecruitment(f),/IsMoney/);
});
test('Original ADD16 saturates reserve independently from charged requested quantity',()=>{
 const f=recruitment();f.before.cities[13].MothballArms=65530;f.after.cities[13].MothballArms=65535;const v=verifyRecruitment(f);assert.deepEqual(v.stock,{before:65530,after:65535,applied:5,saturated:true});assert.equal(v.money.cost,105);
});
test('Selected actor exact Thew12 boundary and current ratio7 are derived independently',()=>{
 const f=recruitment();f.before.people[43].Thew=12;f.after.people[43].Thew=0;f.before.config.armsPerMoney=f.after.config.armsPerMoney=7;f.quantity=19;f.after.cities[13].Money=29998;f.after.cities[13].MothballArms=19;assert.equal(verifyRecruitment(f).thew.cost,12);assert.equal(verifyRecruitment(f).money.cost,2);
});
test('Unknown sampled nested fields survive unchanged at every level, including the new opaque row',()=>{
 const f=recruitment();for(const w of[f.before,f.after]){w.unknownRoot={ref:7,list:[1,2]};w.people[43].unknownPerson={a:9};w.cities[13].unknownCity='keep';w.orders[0].unknownOrder={ref:11};w.config.unknownConfig=13;}assert.equal(verifyRecruitment(f).accepted,true);f.after.orders[0].unknownOrder.ref=12;assert.throws(()=>verifyRecruitment(f),/unknownOrder/);
});
test('June distribution plans target TOTAL1810, reserve1054 plus current756, and actual capacity1810',()=>{
 const f=distribution(),p=planDistribution({world:f.before,libBytes,cityIndex:13,personId:129,targetArms:1810});assert.deepEqual([p.capacity,p.available,p.maximum,p.targetArms,p.delta,p.reserveAfter],[1810,1810,1810,1810,1054,0]);assert.deepEqual([p.min,p.initialValue,p.quantityMeaning],[0,1810,'target-total-arms']);assert.equal(p.actualInputAccepted,false);
});
test('Controlled distribution changes only129Arms756→1810 and reserve1054→0, with full pending recruitment row retained',()=>{
 const f=distribution(),a=clone(f.before),b=clone(f.after),v=verifyDistribution(f);assert.equal(v.accepted,true);assert.deepEqual(v.arms,{before:756,after:1810,delta:1054});assert.deepEqual(v.reserve,{before:1054,after:0,uncast:0,wrapped:false});assert.deepEqual(f.before,a);assert.deepEqual(f.after,b);assert.equal(f.after.orders[0].OrderId,24);assert.equal(f.after.people[43].Thew,88);assert.equal(f.after.cities[13].Money,29895);
});
test('Distribution accepts total0 and unchanged total756 without fabricating expense, orders or input',()=>{
 const f=distribution();f.targetArms=0;f.after.people[129].Arms=0;f.after.cities[13].MothballArms=1810;assert.equal(verifyDistribution(f).arms.delta,-756);f.targetArms=756;f.after=clone(f.before);assert.equal(verifyDistribution(f).changed,false);
});
test('Distribution uses native U16 reserve wrap, not recruitment ADD16 saturation',()=>{
 const f=distribution();f.before.cities[13].MothballArms=65535;f.before.people[129].Arms=65535;f.targetArms=0;f.after=clone(f.before);f.after.people[129].Arms=0;f.after.cities[13].MothballArms=65534;const v=verifyDistribution(f);assert.equal(v.reserve.uncast,131070);assert.equal(v.reserve.wrapped,true);
});
test('Custom capacity ratios and zero-capacity native message retain their own C behavior',()=>{
 const f=distribution();for(const w of[f.before,f.after]){w.config.enableCustomRatio=1;w.config.ratioOfArmsToLevel=10;w.config.ratioOfArmsToAge=0;w.config.ratioOfArmsToForce=0;w.config.ratioOfArmsToIQ=0;}f.targetArms=70;f.after.people[129].Arms=70;f.after.cities[13].MothballArms=1740;assert.equal(verifyDistribution(f).capacity,70);f.before.config.ratioOfArmsToLevel=0;assert.throws(()=>planDistribution({world:f.before,libBytes,cityIndex:13,personId:129,targetArms:0}),/maximum0/);
});
const recruitRejects=[
 ['zero outside positive recruitment proof',f=>{f.quantity=0;}],['cancel sentinel',f=>{f.quantity=65535;}],['fractional quantity',f=>{f.quantity=1.5;}],['above native devotion maximum',f=>{f.quantity=1381;}],['wrong105 cash debit',f=>{f.after.cities[13].Money=29894;}],['fixed minimum charged instead of quantity cost',f=>{f.after.cities[13].Money=29999;}],['wrong12 Thew debit',f=>{f.after.people[43].Thew=96;}],['selected actor belowThew12',f=>{f.before.people[43].Thew=11;}],['reserve incorrectly assigned to actor',f=>{f.after.people[43].Arms+=1054;}],['source reserve off by1',f=>{f.after.cities[13].MothballArms=1053;}],['unrequested governance clears State3',f=>{f.after.cities[13].State=0;}],['earlier raw duplicate repaired',f=>{f.after.queue[27]=64;}],['later duplicate repaired',f=>{f.after.queue[97]=135;}],['queue199 cleared',f=>{f.before.queue[199]=500;f.after=recruited(f.before);f.after.queue[199]=0;}],['tail200 shifted',f=>{f.after.queue[200]=999;}],['tail1999 changed',f=>{f.after.queue[1999]=999;}],['later empty city offset unchanged',f=>{f.after.cities[37].PersonQueue=f.before.cities[37].PersonQueue;}],['earlier city offset changed',f=>{f.after.cities[12].PersonQueue--;}],['wrong new OrderId',f=>{f.after.orders[0].OrderId=25;}],['wrong new actor',f=>{f.after.orders[0].Person=129;}],['wrong new city',f=>{f.after.orders[0].City=12;}],['wrong new TimeCount',f=>{f.after.orders[0].TimeCount=1;}],['not first free slot',f=>{f.after.orders[1]=f.after.orders[0];f.after.orders[0]=clone(f.before.orders[0]);}],['mask applied to old row',f=>{f.after.orders[1].Food++;}],['new-slot unknown added',f=>{f.after.orders[0].unobserved=1;}],['new-slot opaque U16 overflow',f=>{f.after.orders[0].Object=65536;}],['new-slot opaque U8 overflow',f=>{f.after.orders[0].Consume=256;}],['other person Thew changed',f=>{f.after.people[60].Thew--;}],['Food charged',f=>{f.after.cities[13].Food--;}],['phase advanced month',f=>{f.after.month=7;}],['all order slots full',f=>{for(const o of f.before.orders)o.OrderId=1;}],['wrong city ownership',f=>{f.before.cities[13].Belong=2;}],['foreign selected actor',f=>{f.before.people[43].Belong=2;}],['actor absent from selected city',f=>{f.personId=20;}],['selected actor twice in same city',f=>{f.before.queue[57]=43;}],['overlapping city slots',f=>{f.before.cities[14].PersonQueue=56;}],['residentPID out of native bounds',f=>{f.before.queue[57]=200;}],['active city queue exceeds200',f=>{f.before.cities[13].PersonQueue=199;}],['ratio zero',f=>{f.before.config.armsPerMoney=0;}],['wrong original library',f=>{f.libBytes=Buffer.from(libBytes);f.libBytes[100]^=1;}],['library truncated',f=>{f.libBytes=libBytes.subarray(1);} ],['wide money costs beyond28-byte original item',f=>{f.before.config.enable16bitConsumeMoney=1;}],['unknown root drift',f=>{f.before.newField={nested:1};f.after.newField={nested:2};}],['unknown person dropped',f=>{f.before.people[129].newField=9;}],['unknown array extra drift',f=>{f.before.queue.extra=1;f.after.queue.extra=2;}],['known native U8 overflow',f=>{f.after.people[129].Level=256;}],['native U32 city overflow',f=>{f.after.cities[13].Population=4294967296;}],['goods queue mutation',f=>{f.after.goodsQueue[400]++;}],['fighter mutation',f=>{f.after.fighters[0]++;}],['sparse queue',f=>{delete f.after.queue[700];}],['missing native opaque field',f=>{delete f.after.orders[0].Money;}]
];
for(const[name,mutate]of recruitRejects)test('Recruitment rejects '+name,()=>{const f=recruitment();mutate(f);assert.throws(()=>verifyRecruitment(f));});
const distributionRejects=[
 ['increment1054 mistaken for target1810',f=>{f.targetArms=1054;}],['target exceeds capacity',f=>{f.targetArms=1811;}],['cancel sentinel',f=>{f.targetArms=65535;}],['target fraction',f=>{f.targetArms=1.5;}],['debits cash',f=>{f.after.cities[13].Money--;}],['debits actor Thew',f=>{f.after.people[129].Thew--;}],['alters recruitment worker Thew',f=>{f.after.people[43].Thew--;}],['retires existing Order24 early',f=>{f.after.orders[0].OrderId=255;}],['new order invented',f=>{f.after.orders[1].OrderId=24;}],['queue deletion during distribution',f=>{f.after.queue[56]=60;}],['raw duplicate repaired',f=>{f.after.queue[27]=64;}],['stock off by1',f=>{f.after.cities[13].MothballArms=1;}],['other person Arms changes',f=>{f.after.people[60].Arms++;}],['native custom capacity absent',f=>{delete f.before.config.ratioOfArmsToLevel;}],['known native U16 overflow',f=>{f.after.people[129].Arms=65536;}],['current city raw actor duplicated',f=>{f.before.queue[57]=129;}],['unknown order field drift',f=>{f.before.orders[1].unknown={n:1};f.after.orders[1].unknown={n:2};}],['unknown config drift',f=>{f.before.config.unknown=1;f.after.config.unknown=2;}],['goods queue tail mutation',f=>{f.after.goodsQueue[1999]++;}],['world advances month',f=>{f.after.month=7;}]
];
for(const[name,mutate]of distributionRejects)test('Distribution rejects '+name,()=>{const f=distribution();mutate(f);assert.throws(()=>verifyDistribution(f));});
test('Contract masks only five new stack bytes and makes public-input evidence an independent obligation',()=>{assert.deepEqual(impactArmyOracleContract.initializedOrderFields,['OrderId','Person','City','TimeCount']);assert.deepEqual(impactArmyOracleContract.opaqueOrderFields,['Object','Arms','Food','Money','Consume']);assert.equal(verifyDistribution(distribution()).actualInputAccepted,false);assert.equal(verifyRecruitment(recruitment()).strategyMonthAccepted,false);});
