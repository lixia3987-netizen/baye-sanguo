// Pure controller precondition only. No game, storage, CLI, process or import-time I/O.
export const V24_PREPARATION_MONTH_LIMIT = 3;
function check(condition, message) {
  if (!condition) throw new TypeError('V24 month window: ' + message);
}
function date(world, label) {
  check(world !== null && typeof world === 'object' && !Array.isArray(world), label + ' world');
  check(Number.isSafeInteger(world.year) && world.year >= 1 && world.year <= 65535, label + ' year');
  check(Number.isSafeInteger(world.month) && world.month >= 1 && world.month <= 12, label + ' month');
  return {year: world.year, month: world.month, serial: world.year * 12 + world.month - 1};
}
export function verifyV24MonthWindow({currentWorld, preparedWorld, executePreparation, normalMonthsExecuted} = {}) {
  check(typeof executePreparation === 'boolean', 'executePreparation must be boolean');
  check(Number.isSafeInteger(normalMonthsExecuted) && normalMonthsExecuted >= 0 && normalMonthsExecuted <= V24_PREPARATION_MONTH_LIMIT,
    'normalMonthsExecuted must be an integer from 0 through 3');
  const current = date(currentWorld, 'current'), prepared = date(preparedWorld, 'prepared');
  const delta = current.serial - prepared.serial;
  const allowedDeltas = executePreparation
    ? [normalMonthsExecuted, normalMonthsExecuted + 1].filter(n => n <= V24_PREPARATION_MONTH_LIMIT)
    : [0, 1];
  check(allowedDeltas.includes(delta), executePreparation
    ? 'preparation delta must equal normalMonthsExecuted or its next natural month, within 0 through 3'
    : 'battle delta must remain input month or one natural month');
  return Object.freeze({
    accepted: true,
    monthWindowAccepted: true,
    mode: executePreparation ? 'preparation' : 'battle',
    prepared: Object.freeze({year: prepared.year, month: prepared.month}),
    current: Object.freeze({year: current.year, month: current.month}),
    delta,
    normalMonthsExecuted,
    allowedDeltas: Object.freeze(allowedDeltas),
    actualMonthsExecutedByThisCheck: 0,
    inputAuthorizedByThisCheck: false,
    actualContinuationAccepted: false,
    actualAcquisitionAccepted: false,
    actualCastAccepted: false,
    hdAccepted: false,
    scope: 'Calendar precondition only; native one-month transition, fresh owner, full world, SAVE, food and guard checks remain separate requirements.'
  });
}
