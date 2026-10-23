// Controlled planning regressions over the already published genuine V32 world.
// No engine, gameplay, payment, RNG, month or SAVE is executed by these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { V32_TARGETS } from './hd-impact-v32-acquisition-policy.mjs';
import { V33_CITY6_CONTRACT as C, v33City6Readiness, planV33City6Readiness } from './hd-impact-v33-city6-readiness.mjs';

const bytes = readFileSync(new URL('../docs/validation/m5-impact13-bounded-canvass-20261023-v32-prefix-acquisition-latest-world.json', import.meta.url));
assert.equal(bytes.length, 77913);
assert.equal(createHash('sha256').update(bytes).digest('hex'), '71f5f84eeac95e9c372f84f45dbb5e541aba3093e52841b02527a2098751eba3');
const W = JSON.parse(bytes), copy = structuredClone;
const plan = (world = W, progress = {}) => planV33City6Readiness({ world, progress });
const record = personId => ({ cityIndex: 6, personId });
function readyActors(world) { for (const id of C.actors) world.people[id].Thew = 100; return world; }
function onlyTarget(world, targetId) { for (const id of V32_TARGETS) if (id !== targetId) world.people[id].Devotion = 100; return world; }
function removeAt(world, cityIndex, personId) {
  const city = world.cities[cityIndex], at = city.PersonQueue + world.queue.slice(city.PersonQueue, city.PersonQueue + city.Persons).indexOf(personId);
  assert.ok(at >= city.PersonQueue && at < city.PersonQueue + city.Persons);
  for (let i = at; i < 199; i++) world.queue[i] = world.queue[i + 1];
  city.Persons--; for (let i = cityIndex + 1; i < 38; i++) world.cities[i].PersonQueue--;
}
function insertAt(world, cityIndex, personId) {
  const city = world.cities[cityIndex];
  for (let i = 199; i > city.PersonQueue; i--) world.queue[i] = world.queue[i - 1];
  world.queue[city.PersonQueue] = personId; city.Persons++;
  for (let i = cityIndex + 1; i < 38; i++) world.cities[i].PersonQueue++;
}
function relocate(world, personId, from, to) { removeAt(world, from, personId); insertAt(world, to, personId); }
function dispatch(world, action) {
  const slot = world.orders.findIndex(order => order.OrderId === 255);
  world.cities[6].Money -= 50; world.people[action.personId].Thew -= 20;
  Object.assign(world.orders[slot], { OrderId: 16, Person: action.personId, City: 6, Object: action.targetId, TimeCount: 10 });
  removeAt(world, 6, action.personId);
}
function navy(world, id = 51) {
  Object.assign(world.people[id], { Level: 7, Thew: 100, ArmsType: 3, Arms: 100 }); return world;
}

test('Published March checkpoint keeps isolated Zhang Xiu as a candidate, not a reason to stop', () => {
  const r = v33City6Readiness(W);
  assert.deepEqual([W.year, W.month], [239, 3]);
  assert.equal(r.acquisitionShouldStop, false);
  assert.deepEqual(r.isolatedAdvancedOwned.map(row => [row.personId, row.cityIndex, row.sourceMp]), [[131, 7, 84]]);
  assert.deepEqual(r.sourceReadyNavy, []); assert.deepEqual(r.city6GiveCandidates, []);
});
test('Current three low-stamina envoys need exact separate original Treats', () => {
  const p = plan();
  assert.deepEqual(p.needTreats.map(row => [row.personId, row.thewBefore, row.plannedThewAfter, row.moneyCost]),
    [[5, 14, 64, 100], [36, 14, 64, 100], [51, 6, 56, 100]]);
  assert.deepEqual([p.nextAction.kind, p.nextAction.personId], ['treat', 5]);
});
test('Current best bounded assignment is two114 and one129 with source weights only', () => {
  const p = plan();
  assert.deepEqual(p.canvasses.map(row => [row.personId, row.targetId, row.sourceScore]), [[5, 114, 114800], [36, 114, 114800], [51, 129, 89900]]);
  assert.deepEqual(p.canvasses.map(row => row.sourceAllowedValueCounts), [[100, 28, 41], [100, 28, 41], [100, 29, 31]]);
  assert.deepEqual(p.canvasses.map(row => row.plannedThewAfterCanvass), [44, 44, 36]);
  assert.equal(p.canvasses.at(-1).plannedCashAfter, 29550);
  assert.equal(p.food.accepted, true); assert.equal(p.plannedFood.accepted, true);
});
test('All plans retain false native/acquisition/cast/HD/RNG acceptance', () => {
  const p = plan();
  for (const row of [p, p.readiness, ...p.needTreats, ...p.canvasses])
    for (const field of ['actualAcquisitionAccepted', 'actualCastAccepted', 'hdAccepted', 'globalHdComplete', 'successForecastAccepted', 'randomValuesObserved']) assert.equal(row[field], false);
});
test('Fresh world after one Treat removes that restoration and retains dynamic Canvass planning', () => {
  const w = copy(W); w.people[5].Thew += 50; w.cities[6].Money -= 100;
  const p = plan(w, { treats: [record(5)] });
  assert.deepEqual(p.needTreats.map(row => row.personId), [36, 51]);
  assert.equal(p.canvasses[0].requiresTreat, false); assert.equal(p.canvasses.at(-1).plannedCashAfter, 29550);
});
test('All three fresh completed Treats lead to Canvass instead of repeated payments', () => {
  const w = copy(W); for (const id of C.actors) { w.people[id].Thew += 50; w.cities[6].Money -= 100; }
  const p = plan(w, { treats: C.actors.map(record) });
  assert.deepEqual(p.needTreats, []); assert.deepEqual([p.nextAction.kind, p.nextAction.personId, p.nextAction.targetId], ['canvass', 5, 114]);
});
test('A paid native Canvass is accounted once and never dispatches the same actor again', () => {
  const w = readyActors(copy(W)), first = plan(w).canvasses[0]; dispatch(w, first);
  const p = plan(w, { canvasses: [first] });
  assert.deepEqual(p.canvasses.map(row => [row.personId, row.targetId]), [[36, 114], [51, 129]]);
  assert.ok(!p.needTreats.some(row => row.personId === 5));
});
test('Three paid orders lead only to one lawful END opportunity', () => {
  const w = readyActors(copy(W)), actions = plan(w).canvasses;
  for (const action of actions) dispatch(w, action);
  const p = plan(w, { canvasses: actions });
  assert.deepEqual(p.canvasses, []); assert.deepEqual(p.needTreats, []);
  assert.equal(p.endAllowed, true); assert.equal(p.nextAction.kind, 'end');
});
test('Unaccounted pending owned orders refuse a fresh planning run', () => {
  const w = readyActors(copy(W)); dispatch(w, plan(w).canvasses[0]);
  assert.throws(() => plan(w), /accounted/);
});
test('A fabricated action log cannot stand in for a paid native order', () => {
  assert.throws(() => plan(W, { canvasses: [{ ...record(5), targetId: 114 }] }), /accounted/);
});
test('The same actor cannot be logged or treated twice', () => {
  assert.throws(() => plan(W, { treats: [record(5), record(5)] }), /at most once/);
});
test('A paid-order log cannot introduce a target outside the reviewed MAKE subset', () => {
  assert.throws(() => plan(W, { canvasses: [{ ...record(5), targetId: 0 }] }), /reviewed native planning subset/);
});
test('The action budget refuses four Treats or four Canvasses', () => {
  assert.throws(() => plan(W, { treats: Array(4).fill(record(5)) }), /bounded action log/);
  assert.throws(() => plan(W, { canvasses: Array(4).fill({ ...record(5), targetId: 114 }) }), /bounded action log/);
});
test('Per-target monthly maximum is enforced for actual records', () => {
  assert.throws(() => plan(W, { canvasses: C.actors.map(personId => ({ ...record(personId), targetId: 114 })) }), /per-target monthly cap/);
});
test('An unsafe current city20 food budget admits neither restoration nor dispatch nor END', () => {
  const w = copy(W); w.cities[20].Food = 266; const p = plan(w);
  assert.equal(p.nextAction, null); assert.deepEqual(p.canvasses, []); assert.equal(p.endAllowed, false);
  assert.ok(p.blockedReasons.some(reason => reason.includes('food/cash')));
});
test('Strict original current food floor requires267, not266', () => {
  const w = copy(W); w.cities[20].Food = 267; assert.equal(plan(w).food.accepted, true);
});
test('Future recruitment armies cannot be funded with unsafe current city6 food', () => {
  const w = copy(W); w.cities[6].Food = 10; const p = plan(w);
  assert.equal(p.food.accepted, true); assert.equal(p.nextAction, null);
  assert.ok(p.blockedReasons.some(reason => reason.includes('conservative')));
});
test('Every owned city retains the existing current500 cash gate', () => {
  const w = copy(W); w.cities[13].Money = 499; assert.equal(plan(w).nextAction, null);
});
test('City6 cannot spend its last500 as Treat or Canvass money', () => {
  const w = copy(W); w.cities[6].Money = 500; const p = plan(w);
  assert.deepEqual(p.needTreats, []); assert.deepEqual(p.canvasses, []);
});
test('Exactly150 spare money funds one needed Treat and one best dispatch', () => {
  const w = copy(W); w.cities[6].Money = 650; const p = plan(w);
  assert.equal(p.needTreats.length, 1); assert.equal(p.canvasses.length, 1);
  assert.deepEqual([p.canvasses[0].personId, p.canvasses[0].targetId], [5, 114]);
  assert.equal(p.canvasses[0].plannedCashAfter, 500);
});
test('Sufficient Thew avoids Treat and uses exact50 reserve boundary', () => {
  const w = readyActors(copy(W)); w.cities[6].Money = 550; const p = plan(w);
  assert.equal(p.needTreats.length, 0); assert.equal(p.canvasses.length, 1);
  assert.equal(p.canvasses[0].plannedCashAfter, 500);
});
test('Thew20 is enough for Canvass and Thew19 needs one Treat', () => {
  const w = copy(W); w.people[5].Thew = 20; w.people[36].Thew = 19;
  assert.ok(!plan(w).needTreats.some(row => row.personId === 5));
  assert.ok(plan(w).needTreats.some(row => row.personId === 36));
});
test('A previously treated actor whose fresh Thew is insufficient cannot be paid again', () => {
  const p = plan(W, { treats: [record(5)] }); assert.ok(p.canvasses.every(row => row.personId !== 5));
});
test('A needed restoration respects the existing Treat report and normal-Devotion scope', () => {
  const w = copy(W); w.people[5].Devotion = 101;
  assert.ok(plan(w).needTreats.every(row => row.personId !== 5));
  w.config.disableAllPersonReport = 1;
  assert.deepEqual(plan(w).needTreats, []); assert.deepEqual(plan(w).canvasses, []);
});
test('A current target leaving its actual city is excluded on replan', () => {
  const w = copy(W); removeAt(w, 35, 114);
  assert.ok(plan(w).canvasses.every(row => row.targetId !== 114));
});
test('Devotion100 removes a zero-weight target and dynamically chooses alternatives', () => {
  const w = copy(W); w.people[114].Devotion = 100; const p = plan(w);
  assert.ok(p.canvasses.every(row => row.targetId !== 114));
  assert.deepEqual(p.canvasses.map(row => [row.personId, row.targetId]), [[5, 125], [36, 129], [51, 129]]);
});
test('A target with both gear slots occupied cannot consume the city6 ship token', () => {
  const w = copy(W); w.people[114].Tool1 = 1; w.people[114].Tool2 = 2;
  assert.ok(plan(w).canvasses.every(row => row.targetId !== 114));
});
test('An already owned target cannot be newly selected from an enemy list', () => {
  const w = copy(W); w.people[114].Belong = 1;
  assert.ok(plan(w).canvasses.every(row => row.targetId !== 114));
});
test('Current lower-IQ planning subset is re-evaluated without assuming U8 success', () => {
  const w = copy(W); w.people[36].IQ = 44;
  assert.ok(plan(w).canvasses.every(row => row.personId !== 36 || row.targetId !== 114));
});
test('Exactly two114 selections remain the maximum even if no other target is useful', () => {
  const w = onlyTarget(copy(W), 114); w.people[51].IQ = 1;
  assert.equal(plan(w).canvasses.length, 2);
});
test('Removing the discovered ship token retains native water candidates only', () => {
  const w = copy(W); w.goodsQueue[w.cities[6].ToolQueue] = 32;
  const p = plan(w); assert.ok(p.canvasses.every(row => w.people[row.targetId].ArmsType === 3));
});
test('A legal city6 co-located advanced empty-gear candidate stops acquisition', () => {
  const w = copy(W); relocate(w, 131, 7, 6);
  const p = plan(w); assert.equal(p.readiness.acquisitionShouldStop, true);
  assert.deepEqual(p.readiness.city6GiveCandidates.map(row => row.personId), [131]);
  assert.equal(p.nextAction, null); assert.equal(p.actualGiveExecutionAccepted, false);
});
test('Co-location without an actual discovered ship token does not stop acquisition', () => {
  const w = copy(W); relocate(w, 131, 7, 6); w.goodsQueue[w.cities[6].ToolQueue] = 32;
  assert.equal(v33City6Readiness(w).acquisitionShouldStop, false);
});
test('A city6 advanced person with one occupied slot is outside reviewed Give scope', () => {
  const w = copy(W); relocate(w, 131, 7, 6); w.people[131].Tool1 = 1;
  assert.equal(v33City6Readiness(w).acquisitionShouldStop, false);
});
test('An original advanced navy stops acquisition while retaining battle MP evidence boundary', () => {
  const p = plan(navy(copy(W)));
  assert.equal(p.readiness.acquisitionShouldStop, true); assert.equal(p.readiness.battleReady, true);
  assert.equal(p.readiness.sourceReadyNavy[0].actualBattleMpObserved, false);
  assert.equal(p.nextAction, null);
});
test('An advanced zero-army navy stops acquisition but requires a separate actual army preparation', () => {
  const w = navy(copy(W)); w.people[51].Arms = 0;
  const r = v33City6Readiness(w); assert.equal(r.acquisitionShouldStop, true); assert.equal(r.battleReady, false);
});
test('An advanced native navy in another owned city also avoids unnecessary new acquisition', () => {
  const w = navy(copy(W), 131); assert.equal(v33City6Readiness(w).acquisitionShouldStop, true);
});
test('Low current Thew/source MP does not falsely qualify a navy', () => {
  const w = navy(copy(W)); w.people[51].Thew = 6;
  assert.equal(v33City6Readiness(w).acquisitionShouldStop, false);
});
test('Level6 and all current city6 Level1 people cannot satisfy impact13 readiness', () => {
  const w = navy(copy(W)); w.people[51].Level = 6;
  assert.equal(v33City6Readiness(w).acquisitionShouldStop, false);
});
test('Only the selected actor must have one raw resident place', () => {
  const w = copy(W); insertAt(w, 7, 5);
  assert.ok(plan(w).canvasses.every(row => row.personId !== 5));
});
test('A repeated raw candidate cannot masquerade as a unique city6 recipient', () => {
  const w = copy(W); insertAt(w, 6, 131);
  assert.equal(v33City6Readiness(w).acquisitionShouldStop, false);
});
test('A city6 Give recipient retains a stale enemy raw PID without inventing a second owned residence', () => {
  const w = copy(W); relocate(w, 131, 7, 6); insertAt(w, 21, 131);
  const before = JSON.stringify(w), r = v33City6Readiness(w);
  assert.equal(r.acquisitionShouldStop, true);
  assert.deepEqual(r.city6GiveCandidates[0].rawLocations.map(location => location.cityIndex), [6, 21]);
  assert.deepEqual(r.city6GiveCandidates[0].ownedLocations.map(location => location.cityIndex), [6]);
  assert.equal(JSON.stringify(w), before);
});
test('An earlier enemy raw occurrence also follows the existing city6 Give resident semantics', () => {
  const w = copy(W); relocate(w, 131, 7, 6); insertAt(w, 1, 131);
  const r = v33City6Readiness(w);
  assert.equal(r.acquisitionShouldStop, true);
  assert.deepEqual(r.city6GiveCandidates[0].rawLocations.map(location => location.cityIndex), [1, 6]);
});
test('A stale enemy raw occurrence does not reject an otherwise ready native navy', () => {
  const w = navy(copy(W)); insertAt(w, 21, 51);
  const r = v33City6Readiness(w);
  assert.equal(r.acquisitionShouldStop, true);
  assert.deepEqual(r.sourceReadyNavy[0].rawLocations.map(location => location.cityIndex), [6, 21]);
});
test('Two owned city slices reject a recipient even when city6 has a valid token', () => {
  const w = copy(W); relocate(w, 131, 7, 6); insertAt(w, 4, 131);
  assert.equal(v33City6Readiness(w).acquisitionShouldStop, false);
});
test('Two raw occurrences within the same owned city slice reject the recipient', () => {
  const w = copy(W); relocate(w, 131, 7, 6); insertAt(w, 6, 131);
  assert.equal(v33City6Readiness(w).acquisitionShouldStop, false);
});
test('Existing unrelated cross-city raw PID repeats remain unchanged and accepted', () => {
  const w = copy(W), before = JSON.stringify(w);
  assert.equal(w.cities.filter(city => w.queue.slice(city.PersonQueue, city.PersonQueue + city.Persons).includes(136)).length, 2);
  assert.ok(plan(w).canvasses.length > 0); assert.equal(JSON.stringify(w), before);
});
test('A fresh actor that becomes Satrap is retained rather than dispatched', () => {
  const w = copy(W); w.cities[6].SatrapId = 6;
  assert.ok(plan(w).canvasses.every(row => row.personId !== 5));
});
test('An actor leaving city6 does not create a remote-city dispatch', () => {
  const w = copy(W); relocate(w, 5, 6, 5);
  assert.ok(plan(w).canvasses.every(row => row.personId !== 5));
});
test('A full original first170 order allocation window prevents all new payments', () => {
  const w = copy(W); for (let i = 0; i < 170; i++) Object.assign(w.orders[i], { OrderId: 16, Person: 114, City: 35, Object: 149, TimeCount: 10 });
  const p = plan(w); assert.deepEqual(p.needTreats, []); assert.deepEqual(p.canvasses, []);
});
test('One free original order slot plans at most one restoration and dispatch', () => {
  const w = copy(W); for (let i = 0; i < 169; i++) Object.assign(w.orders[i], { OrderId: 16, Person: 114, City: 35, Object: 149, TimeCount: 10 });
  assert.equal(plan(w).canvasses.length, 1); assert.equal(plan(w).needTreats.length, 1);
});
test('A settled April failure keeps the one-month run terminal without claiming readiness', () => {
  const w = copy(W); w.month = 4; const p = plan(w, { naturalMonths: 1 });
  assert.equal(p.nextAction, null); assert.equal(p.readiness.acquisitionShouldStop, false);
  assert.ok(p.blockedReasons.some(reason => reason.includes('one-month')));
});
test('The runtime cannot pass a stale date or a second natural month', () => {
  const w = copy(W); w.month = 4; assert.throws(() => plan(w), /date/);
  assert.throws(() => plan(W, { naturalMonths: 2 }), /At most one/);
});
test('A settled April source-qualified navy is ready with all actual flags still false', () => {
  const w = navy(copy(W)); w.month = 4; const p = plan(w, { naturalMonths: 1 });
  assert.equal(p.readiness.acquisitionShouldStop, true); assert.equal(p.nextAction, null);
  assert.equal(p.actualAcquisitionAccepted, false); assert.equal(p.actualCastAccepted, false);
});
test('Unknown fields and source arrays are never mutated by readiness or planning', () => {
  const w = copy(W); w.extra = { keep: [null, '原样', 19] }; w.people[5].opaque = { keep: true };
  const before = JSON.stringify(w); v33City6Readiness(w); plan(w); assert.equal(JSON.stringify(w), before);
});
