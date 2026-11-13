// Pure V33 continuation policy. No I/O, native calls, RNG, payments or world mutation.
// Original MAKE/return and full-world deltas remain the separate V29 Treat and
// V32 Canvass contracts. Re-read the complete native world after every action.
import assert from 'node:assert/strict';
import {
  V32_TARGETS, v32AdvancedOwned, v32Residents, v32FoodBudget,
  v32TargetConversionInfo, v29SourceResidueCounts,
} from './hd-impact-v32-acquisition-policy.mjs';

export const V33_CITY6_CONTRACT = Object.freeze({
  version: 1, period: 4, king: 0, startDate: Object.freeze([239, 3]),
  settledDate: Object.freeze([239, 4]), cityIndex: 6,
  actors: Object.freeze([5, 36, 51]), maximumTreats: 3,
  maximumCanvasses: 3, maximumPerTarget: 2, maximumNaturalMonths: 1,
  minimumCash: 500, treatMoney: 100, treatThew: 50,
  canvassMoney: 50, canvassThew: 20, lowerIqPlanningSubset: true,
  scope: 'Current-world source readiness and bounded city6 acquisition planning only. Residue products are source gate weights, not measured RNG distributions or success predictions. Replan after every actual action; an issued plan never authorizes stale execution.',
});
const C = V33_CITY6_CONTRACT;
const FALSE_CREDIT = Object.freeze({
  sourceOnly: true, actualTreatExecutionAccepted: false,
  actualCanvassDispatchAccepted: false, actualAcquisitionAccepted: false,
  actualGiveExecutionAccepted: false, actualPreparationAccepted: false,
  actualCastAccepted: false, hdAccepted: false, globalHdComplete: false,
  randomValuesObserved: false, successForecastAccepted: false,
});
function integer(value, min, max, name) {
  assert.ok(Number.isInteger(value) && value >= min && value <= max, name);
}
function rawLocations(world, personId) {
  return world.cities.flatMap((city, cityIndex) =>
    world.queue.slice(city.PersonQueue, city.PersonQueue + city.Persons)
      .flatMap((id, index) => id === personId ? [{ cityIndex, queueIndex: city.PersonQueue + index }] : []));
}
function pendingFor(world, personId) {
  return world.orders.some(order => order.OrderId !== 255 && order.Person === personId);
}
// MAKE's selected envoy must have exactly one raw location. This deliberately
// differs from a recipient: an enemy city's stale raw PID is not a second
// current owned resident, as in the existing V32 Give candidate contract.
function ownedIdleLocation(world, personId) {
  const locations = rawLocations(world, personId);
  if (world.people[personId].Belong !== 1 || locations.length !== 1 || pendingFor(world, personId)) return null;
  const location = locations[0];
  return world.cities[location.cityIndex].Belong === 1 &&
    v32Residents(world, location.cityIndex).includes(personId) ? location : null;
}
function recipientLocations(world, personId) {
  const locations = rawLocations(world, personId);
  const ownedLocations = locations.filter(location => world.cities[location.cityIndex].Belong === 1);
  if (world.people[personId].Belong !== 1 || ownedLocations.length !== 1 || pendingFor(world, personId)) return null;
  const location = ownedLocations[0];
  return v32Residents(world, location.cityIndex).includes(personId) ?
    { ...location, rawLocations: locations, ownedLocations } : null;
}

export function v33City6Readiness(world) {
  // V32 validates the complete existing original-world shape without changing it.
  const advanced = v32AdvancedOwned(world), sourceReadyNavy = [], city6GiveCandidates = [], isolatedAdvancedOwned = [];
  const allOrdersSettled = world.orders.every(order => order.OrderId === 255);
  for (const candidate of advanced) {
    const location = recipientLocations(world, candidate.personId);
    if (!location) continue;
    const info = v32TargetConversionInfo(world, candidate.personId), person = world.people[candidate.personId];
    const row = { ...candidate, ...location, sourceMp: info.mpAfterNavyConversion,
      actualBattleMpObserved: false, ...FALSE_CREDIT };
    if (info.nativeNavy) sourceReadyNavy.push({ ...row, battleReady: person.Arms > 0 });
    else if (location.cityIndex === 6 && info.bothSlotsEmpty && info.discoveredShipAvailable &&
      candidate.personId !== world.king && person.Devotion <= 100 &&
      world.config.disableAllPersonReport === 0 && allOrdersSettled) city6GiveCandidates.push(row);
    else isolatedAdvancedOwned.push(row);
  }
  return {
    sourceReadyNavy, city6GiveCandidates, isolatedAdvancedOwned,
    allOrdersSettled,
    acquisitionShouldStop: sourceReadyNavy.length > 0 || city6GiveCandidates.length > 0,
    battleReady: sourceReadyNavy.some(person => person.battleReady),
    ...FALSE_CREDIT,
  };
}

function checkedProgress(world, supplied) {
  const progress = { treats: [], canvasses: [], naturalMonths: 0, ...supplied };
  for (const [key, maximum] of [['treats', C.maximumTreats], ['canvasses', C.maximumCanvasses]]) {
    assert.ok(Array.isArray(progress[key]) && progress[key].length <= maximum, key + ' bounded action log');
    const seen = new Set();
    for (const action of progress[key]) {
      assert.ok(action && action.cityIndex === 6 && C.actors.includes(action.personId), key + ' explicit city6 actor');
      assert.ok(!seen.has(action.personId), key + ' actor used at most once');
      seen.add(action.personId);
      if (key === 'canvasses') {
        integer(action.targetId, 0, 199, 'Recorded actual target PID');
        assert.ok(V32_TARGETS.includes(action.targetId), 'Recorded target remains in the reviewed native planning subset');
      }
    }
  }
  integer(progress.naturalMonths, 0, C.maximumNaturalMonths, 'At most one natural month');
  assert.deepEqual([world.year, world.month], progress.naturalMonths ? C.settledDate : C.startDate,
    'Current native date must match bounded continuation stage');
  const counts = new Map();
  for (const action of progress.canvasses) counts.set(action.targetId, (counts.get(action.targetId) || 0) + 1);
  for (const count of counts.values()) assert.ok(count <= C.maximumPerTarget, 'Recorded per-target monthly cap');
  const pending = world.orders.flatMap((order, orderIndex) => order.OrderId !== 255 &&
    order.Person < 200 && world.people[order.Person].Belong === 1 ? [{ order, orderIndex }] : []);
  if (progress.naturalMonths) assert.equal(pending.length, 0, 'Settled continuation has no owned pending order');
  else {
    assert.equal(pending.length, progress.canvasses.length, 'Every paid/pending owned order must be accounted for');
    for (const action of progress.canvasses) {
      const matches = pending.filter(({ order }) => order.OrderId === 16 && order.City === 6 &&
        order.Person === action.personId && order.Object === action.targetId && order.TimeCount === 10);
      assert.equal(matches.length, 1, 'Recorded Canvass has exactly one actual pending native order');
    }
  }
  return { progress, counts, pending };
}

function currentTargets(world) {
  // Native GetEnemyPersons enumerates real city slices and retains repeated PIDs.
  // The existing reviewed V32 allowlist is the bounded target planning subset.
  const enemy = [];
  world.cities.forEach(city => {
    if (!city.Belong || city.Belong === 1) return;
    for (const id of world.queue.slice(city.PersonQueue, city.PersonQueue + city.Persons))
      if (world.people[id].Belong === city.Belong && id + 1 !== city.Belong) enemy.push(id);
  });
  return [...new Set(enemy)].filter(id => {
    if (!V32_TARGETS.includes(id)) return false;
    const person = world.people[id], first = rawLocations(world, id)[0];
    return ![0, 1, 65535].includes(person.Belong) && person.IQ <= 100 && person.Devotion <= 100 && person.Character <= 4 &&
      first && world.cities[first.cityIndex].Belong === person.Belong &&
      v32TargetConversionInfo(world, id).approvedGoalCandidate;
  });
}

// Three actors permit complete enumeration. It avoids greedy target-cap errors
// and optimizes source-residue sum, then stable actor/target order. No random
// draw, independence assumption or forecast enters the assignment.
function allocation(actorRows, targets, world, initialCounts, cash, maximumOrders) {
  let best = [], bestScore = -1;
  const counts = new Map(initialCounts);
  function visit(index, selected, score, spent) {
    if (index === actorRows.length) {
      if (score > bestScore) { best = [...selected]; bestScore = score; }
      return;
    }
    const actor = actorRows[index];
    for (const targetId of targets) {
      const target = world.people[targetId];
      if (selected.length >= maximumOrders || actor.IQ >= target.IQ || (counts.get(targetId) || 0) >= C.maximumPerTarget ||
        spent + actor.totalMoney > cash - C.minimumCash) continue;
      const sourceAllowedValueCounts = v29SourceResidueCounts({ actorIQ: actor.IQ,
        targetIQ: target.IQ, devotion: target.Devotion, character: target.Character });
      const sourceScore = sourceAllowedValueCounts.reduce((product, value) => product * value, 1);
      if (!sourceScore) continue;
      counts.set(targetId, (counts.get(targetId) || 0) + 1);
      selected.push({ cityIndex: 6, personId: actor.personId, targetId,
        targetCity: rawLocations(world, targetId)[0].cityIndex,
        sourceAllowedValueCounts, sourceScore, requiresTreat: actor.requiresTreat,
        thewBefore: actor.Thew, plannedThewBeforeCanvass: actor.plannedThewBeforeCanvass,
        plannedThewAfterCanvass: actor.plannedThewBeforeCanvass - C.canvassThew,
        targetMonthlyOrderCountAfterPlan: counts.get(targetId), ...FALSE_CREDIT });
      visit(index + 1, selected, score + sourceScore, spent + actor.totalMoney);
      selected.pop(); counts.set(targetId, counts.get(targetId) - 1);
    }
    visit(index + 1, selected, score, spent);
  }
  visit(0, [], 0, 0);
  return best;
}

export function planV33City6Readiness({ world, progress: suppliedProgress = {} } = {}) {
  const readiness = v33City6Readiness(world), { progress, counts, pending } = checkedProgress(world, suppliedProgress);
  const food = v32FoodBudget(world), blockedReasons = [];
  const result = { readiness, limits: C, progress: structuredClone(progress), food,
    needTreats: [], canvasses: [], nextAction: null, endAllowed: false,
    blockedReasons, reReadWorldAfterEachAction: true, ...FALSE_CREDIT };
  if (!food.accepted) blockedReasons.push('Current owned-city food/cash gate is unsafe; no future income is credited');
  if (world.cities[6].Money < C.minimumCash) blockedReasons.push('City6 current cash is below the retained reserve');
  if (blockedReasons.length || readiness.acquisitionShouldStop) return result;
  if (progress.naturalMonths >= C.maximumNaturalMonths) {
    blockedReasons.push('The one-month acquisition budget is exhausted'); return result;
  }
  const actors = C.actors.flatMap(personId => {
    if (progress.canvasses.some(action => action.personId === personId)) return [];
    const person = world.people[personId], location = ownedIdleLocation(world, personId);
    if (!location || location.cityIndex !== 6 || personId + 1 === world.cities[6].SatrapId || person.IQ > 100) return [];
    integer(person.Thew, 0, 100, 'Scoped original actor Thew');
    const requiresTreat = person.Thew < C.canvassThew;
    if (requiresTreat && (person.Devotion > 100 || world.config.disableAllPersonReport !== 0)) return [];
    if (requiresTreat && (progress.treats.some(action => action.personId === personId) ||
      progress.treats.length >= C.maximumTreats)) return [];
    return [{ personId, IQ: person.IQ, Thew: person.Thew, requiresTreat,
      plannedThewBeforeCanvass: requiresTreat ? Math.min(100, person.Thew + C.treatThew) : person.Thew,
      totalMoney: C.canvassMoney + (requiresTreat ? C.treatMoney : 0) }];
  });
  const availableOrderSlots = world.orders.slice(0, 170).filter(order => order.OrderId === 255).length;
  const canvasses = allocation(actors, currentTargets(world), world, counts, world.cities[6].Money,
    Math.min(C.maximumCanvasses - progress.canvasses.length, availableOrderSlots));
  const needTreats = canvasses.filter(action => action.requiresTreat).map(action => ({
    kind: 'treat', command: 12, cityIndex: 6, personId: action.personId,
    moneyCost: C.treatMoney, thewBefore: action.thewBefore,
    plannedThewAfter: action.plannedThewBeforeCanvass, ...FALSE_CREDIT,
  }));
  assert.ok(progress.treats.length + needTreats.length <= C.maximumTreats);
  assert.ok(progress.canvasses.length + canvasses.length <= C.maximumCanvasses);
  const plannedFood = v32FoodBudget(world, { plans: canvasses });
  if (!plannedFood.accepted) {
    blockedReasons.push('Current food cannot cover the conservative pending/planned acquisition army budget');
    result.plannedFood = plannedFood; return result;
  }
  let cash = world.cities[6].Money;
  for (const action of needTreats) { cash -= C.treatMoney; action.plannedCashAfter = cash; }
  for (const action of canvasses) { cash -= C.canvassMoney; action.plannedCashAfter = cash;
    action.kind = 'canvass'; action.command = 16; action.moneyCost = C.canvassMoney; action.thewCost = C.canvassThew; }
  result.needTreats = needTreats; result.canvasses = canvasses; result.plannedFood = plannedFood;
  result.endAllowed = pending.length > 0 && canvasses.length === 0 && needTreats.length === 0;
  result.nextAction = needTreats[0] || canvasses[0] ||
    (result.endAllowed ? { kind: 'end', maximumNaturalMonths: 1, ...FALSE_CREDIT } : null);
  if (!result.nextAction) blockedReasons.push('No current legal reviewed city6 action within the remaining budget');
  return result;
}
