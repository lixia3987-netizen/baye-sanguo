import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Packed original 0x95 format: gamEng.c:1146-1213, attribute.h and order.h.
// This is a file/measurement oracle. It never writes a save or calls the game.
const PERSON_FIELDS = {
  OldBelong: [0, 2], Belong: [2, 2], Level: [4, 1], Force: [5, 1], IQ: [6, 1],
  Devotion: [7, 1], Character: [8, 1], Experience: [9, 1], Thew: [10, 1],
  ArmsType: [11, 1], Arms: [12, 2], Tool1: [14, 2], Tool2: [16, 2], Age: [18, 1],
};
const CITY_FIELDS = {
  State: [0, 1], Belong: [1, 2], SatrapId: [3, 2], FarmingLimit: [5, 2],
  Farming: [7, 2], CommerceLimit: [9, 2], Commerce: [11, 2], PeopleDevotion: [13, 1],
  AvoidCalamity: [14, 1], PopulationLimit: [15, 4], Population: [19, 4],
  Money: [23, 2], Food: [25, 2], MothballArms: [27, 2], PersonQueue: [29, 2],
  Persons: [31, 2], ToolQueue: [33, 2], Tools: [35, 2],
};
const ORDER_FIELDS = {
  OrderId: [0, 1], Person: [1, 2], City: [3, 1], Object: [4, 2],
  Arms: [6, 2], Food: [8, 2], Money: [10, 2], Consume: [12, 1], TimeCount: [13, 1],
};
const MEASURED_CITY = ['Belong', 'SatrapId', 'State', 'AvoidCalamity', 'PeopleDevotion',
  'Commerce', 'Money', 'Food', 'MothballArms', 'PersonQueue', 'Persons', 'Tools', 'ToolQueue'];
const MEASURED_ORDER = ['OrderId', 'City', 'Person', 'Object', 'TimeCount', 'Food'];
const integer = (value, max, name) => {
  assert.ok(Number.isInteger(value) && value >= 0 && value <= max, 'Integer range: ' + name);
  return value;
};
const array = (value, count, name) => {
  assert.ok(Array.isArray(value) && value.length === count, 'Exact array length: ' + name);
  for (let i = 0; i < count; i++) assert.ok(Object.hasOwn(value, i), 'Complete array entry: ' + name + '[' + i + ']');
  return value;
};
function hexBytes(value, name) {
  assert.ok(typeof value === 'string' && /^(?:[0-9a-fA-F]{2})+$/.test(value), 'Complete nonempty hex: ' + name);
  return Buffer.from(value, 'hex');
}
function fields(bytes, offset, layout) {
  return Object.fromEntries(Object.entries(layout).map(([key, [at, width]]) =>
    [key, width === 1 ? bytes[offset + at] : width === 2 ? bytes.readUInt16LE(offset + at) : bytes.readUInt32LE(offset + at)]));
}
function fileRef(bytes) { return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; }

export function decodeOriginalSavePair({ sav0, sav1 }) {
  const a = hexBytes(sav0, 'sav0'), b = hexBytes(sav1, 'sav1');
  assert.ok(a.length >= 8221, 'Complete original first save half');
  assert.equal(a[0], 0x95, 'Only the current native 0x95 format');
  assert.ok(a[1] >= 1 && a[1] <= 4, 'Original period');
  assert.equal(a.readUInt16LE(2), 200, 'Original 200-person layout');
  const header = { version: a[0], period: a[1], personCount: 200, king: a.readUInt16LE(4),
    year: a.readUInt16LE(6), lookEnemy: a[8], lookMovie: a[9], moveSpeed: a[10], month: a[11],
    cityPos: { x: a[12], y: a[13], setx: a[14], sety: a[15] } };
  assert.ok(header.king < 200 && header.month >= 1 && header.month <= 12, 'Valid original ruler/date');
  assert.ok(header.cityPos.x < 12 && header.cityPos.setx < 12 && header.cityPos.y < 9 && header.cityPos.sety < 9, 'Original map coordinates');
  const people = Array.from({ length: 200 }, (_, i) => fields(a, 16 + i * 19, PERSON_FIELDS));
  const queue = Array.from({ length: 200 }, (_, i) => a.readUInt16LE(3816 + i * 2));
  const goodsQueue = Array.from({ length: 2000 }, (_, i) => a.readUInt16LE(4216 + i * 2));
  const compression = a[8216], customLength = a.readUInt32LE(8217);
  // Original data has no compressed custom hook payload. Compressed formats
  // require native decompression and are deliberately outside this pure gate.
  assert.equal(compression, 0, 'Uncompressed original custom-data tail');
  assert.ok(customLength <= 8 * 1024 * 1024 && a.length === 8221 + customLength, 'Exact declared custom tail, no truncation or extra bytes');
  const custom = a.subarray(8221);
  assert.ok(!custom.includes(0), 'Native uncompressed strlen equals declared custom length');
  assert.equal(b.length, 4840, 'Exact 30 flags / 600 fighter bytes / 200 orders / 38 cities / seed');
  const fighterIndex = Array.from(b.subarray(0, 30));
  const fighters = Array.from(b.subarray(30, 630));
  const fighterPersonTokens = Array.from({ length: 300 }, (_, i) => b.readUInt16LE(30 + i * 2));
  const orders = Array.from({ length: 200 }, (_, i) => fields(b, 630 + i * 14, ORDER_FIELDS));
  const cities = Array.from({ length: 38 }, (_, i) => fields(b, 3430 + i * 37, CITY_FIELDS));
  const seed = b.readInt32LE(4836);
  for (let i = 0; i < 200; i++) {
    const p = people[i];
    assert.ok((p.Belong === 65535 || p.Belong <= 200) && (p.OldBelong === 65535 || p.OldBelong <= 200), 'Native person belonging ' + i);
    assert.ok(p.Tool1 <= 2000 && p.Tool2 <= 2000, 'Native equipment token bounds ' + i);
    assert.ok(queue[i] < 200, 'Native saved resident queue ID ' + i);
  }
  for (let i = 0; i < 38; i++) {
    const c = cities[i];
    assert.ok(c.Belong <= 200 && c.SatrapId <= 200 && c.PersonQueue + c.Persons <= 200 && c.ToolQueue + c.Tools <= 2000, 'Native city bounds ' + i);
    for (let j = c.ToolQueue; j < c.ToolQueue + c.Tools; j++) assert.ok((goodsQueue[j] & 0x7fff) < 2000, 'Native referenced goods bounds');
  }
  for (let i = 0; i < 30; i++) {
    assert.ok(fighterIndex[i] <= 1, 'Native fighter allocation flag');
    for (let j = 0; j < 10; j++) assert.ok(fighterPersonTokens[i * 10 + j] <= 200, 'Native U16 fighter token');
  }
  for (const o of orders) {
    if (o.OrderId === 255) continue;
    assert.ok(o.OrderId <= 27 && !(o.OrderId > 19 && o.OrderId < 23) && o.City < 38, 'Native active order kind/city');
    if (o.OrderId === 27) {
      assert.ok(o.Person < 30 && o.Object < 38 && fighterIndex[o.Person] === 1 && fighterPersonTokens[o.Person * 10] !== 0, 'Native active battle order');
    } else {
      assert.ok(o.Person < 200, 'Native active actor order');
      if ([13, 14, 23].includes(o.OrderId)) assert.ok(o.Object < 38, 'Native order city target');
      if ([6, 15, 16, 17, 19].includes(o.OrderId)) assert.ok(o.Object < 200, 'Native order person target');
    }
  }
  return { header, people, queue, goodsQueue, fighterIndex, fighters, fighterPersonTokens,
    orders, cities, seed, compression, customLength, customDataHex: custom.toString('hex'),
    files: { sav0: fileRef(a), sav1: fileRef(b) } };
}

function compareFields(actual, measured, required, layout, name) {
  assert.ok(measured && typeof measured === 'object' && !Array.isArray(measured), 'Measured object: ' + name);
  for (const key of required) assert.ok(Object.hasOwn(measured, key), 'Required measured field: ' + name + '.' + key);
  // Extra sampled persisted struct fields are also checked when supplied.
  for (const key of Object.keys(layout).filter(key => Object.hasOwn(measured, key))) {
    integer(measured[key], layout[key][1] === 1 ? 255 : layout[key][1] === 2 ? 65535 : 0xffffffff, name + '.' + key);
    assert.equal(actual[key], measured[key], 'Saved field equals actual measured world: ' + name + '.' + key);
  }
}

export function verifyOriginalSavePair({ sav0, sav1, world }) {
  assert.ok(world && typeof world === 'object', 'Actual measured world required');
  const decoded = decodeOriginalSavePair({ sav0, sav1 });
  for (const key of ['period', 'king', 'year', 'month']) {
    integer(world[key], key === 'year' ? 65535 : key === 'king' ? 199 : key === 'period' ? 4 : 12, key);
    assert.equal(decoded.header[key], world[key], 'Saved header ' + key);
  }
  array(world.people, 200, 'people'); array(world.cities, 38, 'cities');
  array(world.queue, 2000, 'resident queue capacity'); array(world.goodsQueue, 2000, 'goods queue');
  array(world.fighters, 600, 'raw U8 fighter bytes'); array(world.fighterIndex, 30, 'fighter flags');
  array(world.orders, 200, 'orders');
  world.people.forEach((p, i) => compareFields(decoded.people[i], p, Object.keys(PERSON_FIELDS), PERSON_FIELDS, 'people[' + i + ']'));
  world.cities.forEach((c, i) => compareFields(decoded.cities[i], c, MEASURED_CITY, CITY_FIELDS, 'cities[' + i + ']'));
  world.orders.forEach((o, i) => compareFields(decoded.orders[i], o, MEASURED_ORDER, ORDER_FIELDS, 'orders[' + i + ']'));
  for (const [name, count, max] of [['queue', 200, 65535], ['goodsQueue', 2000, 65535], ['fighters', 600, 255], ['fighterIndex', 30, 255]]) {
    for (let i = 0; i < world[name].length; i++) integer(world[name][i], max, name + '[' + i + ']');
    assert.deepEqual(decoded[name], world[name].slice(0, count), 'All persisted ' + name + ' entries equal measured world');
  }
  return {
    ok: true, accepted: true, savedMeasuredFieldsAccepted: true, version: 0x95, files: decoded.files,
    checked: { headerFields: ['period', 'king', 'year', 'month'], people: 200, peopleFields: Object.keys(PERSON_FIELDS), cities: 38, cityFields: MEASURED_CITY,
      residentQueuePrefix: 200, goodsQueue: 2000, rawFighterBytes: 600, fighterPersonTokens: 300,
      fighterIndex: 30, orders: 200, orderFields: MEASURED_ORDER },
    decoded,
    publicInputAccepted: false, storageTransactionAccepted: false, refreshPersistenceAccepted: false,
    loadAccepted: false, randomSequenceRestoredAccepted: false, wholeNativeAbiAccepted: false,
    limits: ['Caller must prove original LIB identity, native record owner and trusted save/load input.',
      'Caller must independently invoke the actual BayeSaveStorage.validatePair and verify both committed localStorage halves/metadata.',
      'Resident queue entries 200..1999, engine config and tools are not serialized; no restoration claim is made for them.',
      'City/order fields absent from world, header options/cursor, custom payload meaning and saved seed behavior are decoded only, not measured-world acceptance.',
      'The saved seed is applied on load only when native disableSL is enabled; this verifier never tests RNG or changes it.',
      'Only uncompressed original 0x95 saves are supported. No legacy/custom/Mod compatibility claim.'],
  };
}
