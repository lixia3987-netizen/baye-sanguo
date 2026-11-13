// Counterfactual source checks over the genuine V33 checkpoint. No game/input/payment.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {planV34Preparation,verifyV34BuyDispatch,planV34March,verifyV34MarchPartial,
  verifyV34MarchDispatch,assessV34OwnedFood,verifyV34ProtectedPrefix} from './hd-impact-v34-preparation.mjs';

const inputBytes=fs.readFileSync(new URL('../docs/validation/m5-impact13-city6-20261023-v33-latest-world.json',import.meta.url));
const input=JSON.parse(inputBytes),libBytes=fs.readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const inputSha=createHash('sha256').update(inputBytes).digest('hex');
const nativeBudget={dailyRatio:0,monthlyRatio:0,boutMax:30},copy=x=>structuredClone(x);
const args=world=>({world,libBytes,nativeBudget});
function initial(){const w=copy(input);w.unknown={text:'原字段',array:[0,null,{kept:true}]};w.queue[1999]=61111;w.orders[170].unknownStackField={kept:[5,8]};return w;}
function deleteFirst(w,city,id){const c=w.cities[city],at=c.PersonQueue+w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).indexOf(id);assert.ok(at>=c.PersonQueue);w.queue.copyWithin(at,at+1,200);c.Persons--;for(let i=city+1;i<38;i++)w.cities[i].PersonQueue--;}
function bought(before=initial()){
  const after=copy(before);after.cities[20].Food+=153;after.cities[20].Money-=765;after.people[50].Thew-=12;
  Object.assign(after.orders[0],{OrderId:11,Person:50,City:20,TimeCount:0,Object:4811,Arms:0x8123,Food:0x9234,Money:0xa345,Consume:123});
  deleteFirst(after,20,50);return{before,after,libBytes,nativeBudget};
}
function partial(before=bought().after){const after=copy(before);deleteFirst(after,6,129);return{before,after,libBytes,nativeBudget};}
function dispatched(before=bought().after){
  const after=partial(before).after;after.cities[6].Food-=421;after.fighterIndex[0]=1;after.fighters.fill(0,0,20);after.fighters[0]=130;
  Object.assign(after.orders[170],{OrderId:27,Person:0,City:6,Object:12,Food:421,TimeCount:1,Arms:0x8123,Money:0x9234,Consume:179});
  return{before,after,libBytes,nativeBudget};
}
function assertNoCredit(r){for(const k of ['actualBuyAccepted','actualMarchAccepted','actualPreparationAccepted','actualBattleMpObserved','actualCastAccepted','classicAccepted','hdAccepted','globalHdComplete','rngContinuityAccepted'])assert.equal(r[k],false,k);}

test('Actual April planning admits exactly one necessary Buy153 and no current END',()=>{
  const r=planV34Preparation(args(initial()));assert.equal(r.accepted,true);assert.deepEqual([r.buy.money.cost,r.buy.money.after,r.buy.food.after,r.buy.thew.after],[765,570,267,88]);
  assert.equal(r.initialFood.accepted,false);assert.deepEqual(r.initialFood.rows.filter(x=>!x.actualSafe).map(x=>x.cityIndex),[20]);assert.equal(r.nextAction,'original-Buy153-and-public-SAVE');assertNoCredit(r);
});
test('Thirty native bouts at14 food require421 without claiming battleMP68',()=>{const r=planV34Preparation(args(initial()));assert.deepEqual([r.budget.squareRoot,r.budget.daily,r.budget.boutMax,r.budget.carryFood],[43,14,30,421]);assert.equal(r.budget.actualBattleMpObserved,false);assert.ok(!Object.hasOwn(r.budget,'mp'));});
test('Actual raw foreign duplicates are preserved rather than globally deduplicated',()=>{const w=initial();const places=id=>w.cities.flatMap((c,i)=>w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).includes(id)?[i]:[]);assert.deepEqual(places(65),[1,7]);assert.deepEqual(places(136),[12,21]);assert.deepEqual(places(138),[22,33]);assert.equal(verifyV34BuyDispatch(bought(w)).accepted,true);});
test('Complete Buy removes actor50 only, keeps original opaque cargo, and funds current cities',()=>{const f=bought(),r=verifyV34BuyDispatch(f);assert.equal(r.accepted,true);assert.equal(r.food.accepted,true);assert.equal(f.after.cities[20].Persons,f.before.cities[20].Persons-1);assert.equal(f.after.queue[1999],61111);assert.deepEqual(f.after.unknown,f.before.unknown);assert.equal(r.delta.opaqueFields.semanticCargoAccepted,false);assertNoCredit(r);});
test('A paid Buy cannot be repeated by treating its plan as a fresh input',()=>assert.throws(()=>planV34Preparation(args(bought().after))));
test('March cannot dispatch before the necessary actual Buy prefix',()=>assert.throws(()=>planV34March(args(initial()))));
test('Single current Buy and original north road authorize only6→12/129/421',()=>{const r=planV34March(args(bought().after));assert.deepEqual([r.origin,r.destination,r.personId,r.timeCount,r.orderIndex,r.fight,r.carryFood,r.foodAfter],[6,12,129,1,170,0,421,9673]);assertNoCredit(r);});
test('Partial picker preserves native Satrap130 while129 is removed',()=>{const f=partial(),r=verifyV34MarchPartial(f);assert.equal(r.satrap130PendingRetained,true);assert.equal(f.after.cities[6].SatrapId,130);assert.deepEqual(f.after.queue.slice(f.after.cities[6].PersonQueue,f.after.cities[6].PersonQueue+4),[51,36,5,21]);assert.deepEqual(f.after.people[129],f.before.people[129]);assertNoCredit(r);});
test('Full March writes the tenU16 army in600U8 and preserves paid Buy',()=>{const f=dispatched(),r=verifyV34MarchDispatch(f);assert.deepEqual(f.after.fighters.slice(0,20),[130,...Array(19).fill(0)]);assert.deepEqual(f.after.orders[0],f.before.orders[0]);assert.equal(f.after.cities[6].Food,9673);assert.equal(r.food.rows.find(x=>x.cityIndex===6).totalArms,2310);assert.deepEqual(r.food.rows.find(x=>x.cityIndex===6).returningArmy,[129]);assert.equal(r.opaqueCargoSemanticsAccepted,false);assertNoCredit(r);});
test('Conservative returning army is distinct from current400 resident guards',()=>{const w=dispatched().after;assert.equal(assessV34OwnedFood({world:w}).rows.find(x=>x.cityIndex===6).requiredFood,47);assert.equal(assessV34OwnedFood({world:w,includeReturningArmy:false}).rows.find(x=>x.cityIndex===6).requiredFood,9);});
test('Full1910 return is funded at strict47 reserve after421 departure',()=>{const w=bought().after;w.cities[6].Food=468;const r=verifyV34MarchDispatch(dispatched(w));assert.equal(r.food.accepted,true);assert.equal(r.plan.foodAfter,47);});
test('Only three typed stack fields are opaque, including legitimate zeros',()=>{const f=dispatched();Object.assign(f.after.orders[170],{Arms:0,Money:0,Consume:0});assert.equal(verifyV34MarchDispatch(f).accepted,true);});

for(const [name,change] of [
  ['wrongMarchDate',w=>w.month=3],['laterMayDate',w=>w.month=5],['otherPlayer',w=>w.king=9],
  ['otherPeriod',w=>w.period=3],['unsafeOtherCity',w=>w.cities[16].Food=87],
  ['cashBelow500',w=>w.cities[7].Money=499],['differentBuyBalance',w=>w.cities[20].Money--],
  ['insufficientBuyerThew',w=>w.people[50].Thew=11],['casterNotOwned',w=>w.people[129].Belong=2],
  ['casterNoLonger1910',w=>w.people[129].Arms--],['casterEquipped',w=>w.people[129].Tool1=33],
  ['casterNotNavy',w=>w.people[129].ArmsType=1],['casterLevelChanged',w=>w.people[129].Level=7],
  ['lostOriginalGuard',w=>w.people[21].Arms=0],['customNativeRatio',w=>w.config.ratioOfFoodToArmsPerDay=3],
  ['existingArmyFlag',w=>w.fighterIndex[0]=1],['unaccountedOrder',w=>Object.assign(w.orders[8],{OrderId:3,Person:51,City:6})],
  ['missingQueueTail',w=>w.queue.pop()],['residentSliceOverlap',w=>w.cities[7].PersonQueue=w.cities[6].PersonQueue],
])test('April preparation rejects '+name,()=>{const w=initial();change(w);assert.throws(()=>planV34Preparation(args(w)));});

for(const [name,change] of [
  ['moneyNotPaid',f=>f.after.cities[20].Money++],['foodCreditedTwice',f=>f.after.cities[20].Food+=153],
  ['thewNotPaid',f=>f.after.people[50].Thew++],['queueTailChanged',f=>f.after.queue[1999]=0],
  ['unknownFieldDropped',f=>delete f.after.unknown],['unrelatedArmyChanged',f=>f.after.people[129].Arms--],
  ['wrongHeadSlot',f=>{f.after.orders[1]=f.after.orders[0];f.after.orders[0]=copy(f.before.orders[0]);}],
])test('Buy full delta rejects '+name,()=>{const f=bought();change(f);assert.throws(()=>verifyV34BuyDispatch(f));});

for(const [name,change] of [
  ['prematureSatrapRepair',f=>f.after.cities[6].SatrapId=52],['selectedThewChanged',f=>f.after.people[129].Thew--],
  ['guardMoved',f=>f.after.people[21].Belong=2],['last200QueueByteChanged',f=>f.after.queue[199]=(f.after.queue[199]+1)&65535],
  ['tail200Changed',f=>f.after.queue[200]=7],['paidBuyChanged',f=>f.after.orders[0].OrderId=255],
])test('Partial March rejects '+name,()=>{const f=partial();change(f);assert.throws(()=>verifyV34MarchPartial(f));});

for(const [name,change] of [
  ['foodNotPaid',f=>f.after.cities[6].Food++],['extraBattleThew',f=>f.after.people[129].Thew--],
  ['wrongDestination',f=>f.after.orders[170].Object=10],['wrongTime',f=>f.after.orders[170].TimeCount=2],
  ['wrongArmyToken',f=>f.after.fighters[0]=129],['wrongHighByte',f=>f.after.fighters[1]=1],
  ['extraFighter',f=>f.after.fighters[2]=52],['wrongArmyFlag',f=>f.after.fighterIndex[0]=0],
  ['unrelatedFighterTail',f=>f.after.fighters[599]=1],['opaqueOutOfRange',f=>f.after.orders[170].Consume=256],
  ['unknownOrderFieldLost',f=>delete f.after.orders[170].unknownStackField],['unknownWorldFieldLost',f=>delete f.after.unknown],
  ['guardSoldierLoss',f=>f.after.people[51].Arms--],['prematureSatrapFix',f=>f.after.cities[6].SatrapId=52],
])test('Complete March rejects '+name,()=>{const f=dispatched();change(f);assert.throws(()=>verifyV34MarchDispatch(f));});

test('Future Buy return cannot fund current unsafe266food',()=>{const w=bought().after;w.cities[20].Food=266;assert.equal(assessV34OwnedFood({world:w}).accepted,false);assert.throws(()=>planV34March(args(w)));});
test('Carrying421 cannot consume the conservative full-army monthly reserve',()=>{const w=bought().after;w.cities[6].Food=467;assert.throws(()=>planV34March(args(w)));});
test('Fresh native budget must agree with both recorded ratio fields and30 bouts',()=>{for(const b of [{...nativeBudget,dailyRatio:3},{...nativeBudget,monthlyRatio:50},{...nativeBudget,boutMax:29},null])assert.throws(()=>planV34Preparation({world:initial(),libBytes,nativeBudget:b}));});
test('A different LIB cannot authorize original cost or road semantics',()=>{const bad=Buffer.from(libBytes);bad[1024]^=1;assert.throws(()=>planV34Preparation({...args(initial()),libBytes:bad}));});
test('No source getter is invoked during measurement validation',()=>{const w=initial();let called=false;Object.defineProperty(w,'lazy',{enumerable:true,get(){called=true;return 1;}});assert.throws(()=>planV34Preparation(args(w)));assert.equal(called,false);});
test('All inputs, genuine published bytes and unknown values remain unchanged',()=>{const w=initial(),snapshot=copy(w);planV34Preparation(args(w));assert.deepEqual(w,snapshot);assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../docs/validation/m5-impact13-city6-20261023-v33-latest-world.json',import.meta.url))).digest('hex'),inputSha);});

function policyPrefix({returned=true}={}){
  const referenceWorld=bought().after,world=dispatched(referenceWorld).after;
  for(const c of world.cities)c.State=0;
  if(returned){const c=world.cities[20],at=c.PersonQueue;world.queue.copyWithin(at+1,at,199);world.queue[at]=50;c.Persons++;for(let i=21;i<38;i++)world.cities[i].PersonQueue++;world.orders[0].OrderId=255;}
  return{world,referenceWorld};
}
test('Real-style April prefix requires Buy50 returned before own Battle, while129 remains pending',()=>{const f=policyPrefix(),r=verifyV34ProtectedPrefix(f);assert.equal(r.accepted,true);assert.equal(r.completeOriginalOwnedPeoplePreserved,true);assert.equal(r.wholeAiOrMonthTransitionAccepted,false);assert.equal(f.world.people[50].Thew,88);assert.equal(f.world.cities[6].SatrapId,130);assertNoCredit(r);});
test('Earlier callback may retain Buy50 pending only with an explicit false readiness gate',()=>{const f=policyPrefix({returned:false});assert.throws(()=>verifyV34ProtectedPrefix(f));assert.equal(verifyV34ProtectedPrefix({...f,requireBuyReturned:false}).accepted,true);});
for(const [name,change] of [
  ['oldDisasterWasNotReset',f=>f.world.cities[20].State=3],['originalGuardArmsLost',f=>f.world.people[21].Arms--],
  ['completePersonUnknownChanged',f=>f.world.people[51].extraUnknown=true],['buyThewRestoredEarly',f=>f.world.people[50].Thew=100],
  ['buyFoodCreditedAgain',f=>f.world.cities[20].Food+=153],['casterSentElsewhere',f=>f.world.orders[170].Object=10],
])test('Pre-Battle protected prefix rejects '+name,()=>{const f=policyPrefix();change(f);assert.throws(()=>verifyV34ProtectedPrefix(f));});
test('May settlement is not misclassified by an April pre-Battle guard',()=>{const f=policyPrefix();f.world.month=5;assert.throws(()=>verifyV34ProtectedPrefix(f));});
