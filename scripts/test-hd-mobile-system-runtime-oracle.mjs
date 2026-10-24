import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { decodeOriginalSavePair, verifyOriginalSavePair } from './hd-mobile-system-runtime-oracle.mjs';

// Independent packed-byte fixture; no production writer/decoder is reused to
// construct expected measurements, and no browser/storage/game is created.
function fixture() {
  const a = Buffer.alloc(8221), b = Buffer.alloc(4840);
  a[0] = 0x95; a[1] = 1; a.writeUInt16LE(200, 2); a.writeUInt16LE(0, 4);
  a.writeUInt16LE(190, 6); a[8] = 1; a[9] = 1; a[10] = 2; a[11] = 3;
  a.set([1, 2, 3, 4], 12);
  const people = Array.from({ length: 200 }, (_, i) => {
    const p = { OldBelong: 0, Belong: 1, Level: 1, Force: 60, IQ: 70, Devotion: 80,
      Character: 2, Experience: 7, Thew: 100, ArmsType: 1, Arms: i === 199 ? 43981 : 100,
      Tool1: i === 0 ? 2 : 0, Tool2: 0, Age: 30 };
    const at = 16 + i * 19;
    a.writeUInt16LE(p.OldBelong, at); a.writeUInt16LE(p.Belong, at + 2);
    a.set([p.Level, p.Force, p.IQ, p.Devotion, p.Character, p.Experience, p.Thew, p.ArmsType], at + 4);
    a.writeUInt16LE(p.Arms, at + 12); a.writeUInt16LE(p.Tool1, at + 14);
    a.writeUInt16LE(p.Tool2, at + 16); a[at + 18] = p.Age;
    a.writeUInt16LE(i, 3816 + i * 2);
    return p;
  });
  const queue = Array.from({ length: 2000 }, (_, i) => i < 200 ? i : 65534);
  const goodsQueue = Array(2000).fill(0);
  goodsQueue[0] = 0x8000; goodsQueue[1999] = 0xfedc;
  goodsQueue.forEach((v, i) => a.writeUInt16LE(v, 4216 + i * 2));
  const fighterIndex = Array(30).fill(0); fighterIndex[0] = 1; b.set(fighterIndex);
  const fighters = Array(600).fill(0); fighters[0] = 200; fighters[2] = 45; b.set(fighters, 30);
  const orders = Array.from({ length: 200 }, (_, i) => {
    const o = { OrderId: i === 0 ? 27 : 255, Person: i === 0 ? 0 : 65535,
      City: i === 0 ? 0 : 255, Object: i === 0 ? 1 : 65535, Food: 1234, TimeCount: 9 };
    const at = 630 + i * 14;
    b[at] = o.OrderId; b.writeUInt16LE(o.Person, at + 1); b[at + 3] = o.City;
    b.writeUInt16LE(o.Object, at + 4); b.writeUInt16LE(54321, at + 6);
    b.writeUInt16LE(o.Food, at + 8); b.writeUInt16LE(321, at + 10);
    b[at + 12] = 7; b[at + 13] = o.TimeCount;
    return o;
  });
  const cities = Array.from({ length: 38 }, (_, i) => {
    const c = { State: 0, Belong: i === 0 ? 1 : 0, SatrapId: i === 0 ? 1 : 0,
      Commerce: 200 + i, PeopleDevotion: 70, AvoidCalamity: 99, Money: 500 + i,
      Food: 1000 + i, MothballArms: 10, PersonQueue: i === 0 ? 0 : 200,
      Persons: i === 0 ? 200 : 0, ToolQueue: i === 0 ? 0 : 1, Tools: i === 0 ? 1 : 0 };
    const at = 3430 + i * 37;
    b[at] = c.State; b.writeUInt16LE(c.Belong, at + 1); b.writeUInt16LE(c.SatrapId, at + 3);
    b.writeUInt16LE(900, at + 5); b.writeUInt16LE(400, at + 7); b.writeUInt16LE(800, at + 9);
    b.writeUInt16LE(c.Commerce, at + 11); b[at + 13] = c.PeopleDevotion; b[at + 14] = c.AvoidCalamity;
    b.writeUInt32LE(0xfedcba98, at + 15); b.writeUInt32LE(123456789, at + 19);
    for (const [offset, value] of [[23, c.Money], [25, c.Food], [27, c.MothballArms],
      [29, c.PersonQueue], [31, c.Persons], [33, c.ToolQueue], [35, c.Tools]]) b.writeUInt16LE(value, at + offset);
    return c;
  });
  b.writeInt32LE(-12345678, 4836);
  return { a, b, world: { period: 1, king: 0, year: 190, month: 3, people, cities, queue,
    goodsQueue, fighterIndex, fighters, orders, config: { disableSL: 0 }, tools: [{ unmeasured: true }] } };
}
const verify = f => verifyOriginalSavePair({ sav0: f.a.toString('hex'), sav1: f.b.toString('hex'), world: f.world });

test('original 0x95 packed pair matches every measured persisted field and returns raw hashes', () => {
  const f = fixture(), r = verify(f);
  assert.equal(r.accepted, true); assert.equal(r.decoded.people[199].Arms, 43981);
  assert.equal(r.decoded.goodsQueue[0], 0x8000); assert.equal(r.decoded.goodsQueue[1999], 0xfedc);
  assert.equal(r.decoded.fighterPersonTokens[0], 200); assert.equal(r.decoded.fighterPersonTokens[1], 45);
  assert.equal(r.decoded.cities[37].PopulationLimit, 0xfedcba98);
  assert.equal(r.decoded.orders[199].Arms, 54321); assert.equal(r.decoded.orders[199].Money, 321);
  assert.equal(r.decoded.seed, -12345678);
  assert.deepEqual(r.decoded.header.cityPos, { x: 1, y: 2, setx: 3, sety: 4 });
  assert.deepEqual(r.files.sav0, { bytes: 8221, sha256: createHash('sha256').update(f.a).digest('hex') });
  assert.deepEqual(r.files.sav1, { bytes: 4840, sha256: createHash('sha256').update(f.b).digest('hex') });
  assert.equal(r.checked.residentQueuePrefix, 200); assert.equal(r.checked.rawFighterBytes, 600);
  for (const key of ['loadAccepted', 'refreshPersistenceAccepted', 'storageTransactionAccepted', 'randomSequenceRestoredAccepted', 'wholeNativeAbiAccepted']) assert.equal(r[key], false);
  assert.doesNotThrow(() => JSON.stringify(r));
});

test('hex case does not change raw-byte identity', () => {
  const f = fixture();
  assert.deepEqual(verifyOriginalSavePair({ sav0: f.a.toString('hex').toUpperCase(), sav1: f.b.toString('hex').toUpperCase(), world: f.world }).files, verify(f).files);
});

test('unserialized resident tail, config and tool table are explicitly outside restored-world acceptance', () => {
  const f = fixture(); f.world.queue[1999] = 500; f.world.config.disableSL = 1; f.world.tools = [];
  const r = verify(f);
  assert.equal(r.decoded.queue.length, 200);
  assert.equal(r.randomSequenceRestoredAccepted, false);
  assert.match(r.limits.join(' '), /200\.\.1999/);
});

test('optional sampled city and order packed fields are checked when supplied', () => {
  const f = fixture(); f.world.cities[0].Farming = 400; f.world.cities[0].PopulationLimit = 0xfedcba98;
  Object.assign(f.world.orders[199], { Arms: 54321, Money: 321, Consume: 7 });
  assert.equal(verify(f).accepted, true);
  f.world.orders[199].Arms--;
  assert.throws(() => verify(f), /orders\[199\]\.Arms/);
});

test('a bounded nonempty uncompressed custom string is decoded without claiming its meaning', () => {
  const f = fixture(), custom = Buffer.from('{"native":"opaque"}', 'utf8');
  f.a = Buffer.concat([f.a, custom]); f.a.writeUInt32LE(custom.length, 8217);
  const r = verify(f); assert.equal(r.decoded.customDataHex, custom.toString('hex'));
  assert.match(r.limits.join(' '), /custom payload meaning/);
});

const rejections = [
  ['wrong save version', f => { f.a[0] = 0x94; }],
  ['wrong original person count', f => { f.a.writeUInt16LE(199, 2); }],
  ['wrong period', f => { f.a[1] = 0; }],
  ['invalid ruler', f => { f.a.writeUInt16LE(200, 4); }],
  ['invalid month', f => { f.a[11] = 13; }],
  ['out-of-map cursor', f => { f.a[14] = 12; }],
  ['truncated first half', f => { f.a = f.a.subarray(0, 8220); }],
  ['extra undeclared first-half byte', f => { f.a = Buffer.concat([f.a, Buffer.from([1])]); }],
  ['truncated second half', f => { f.b = f.b.subarray(0, 4839); }],
  ['extra second-half byte', f => { f.b = Buffer.concat([f.b, Buffer.from([0])]); }],
  ['compressed custom tail unsupported', f => { f.a[8216] = 1; }],
  ['declared custom length exceeds real bytes', f => { f.a.writeUInt32LE(1, 8217); }],
  ['embedded NUL custom data rejected by native strlen gate', f => { f.a = Buffer.concat([f.a, Buffer.from([65, 0])]); f.a.writeUInt32LE(2, 8217); }],
  ['wrong saved header world', f => { f.world.year++; }],
  ['wrong last person stats', f => { f.world.people[199].Arms--; }],
  ['wrong equipment token', f => { f.world.people[0].Tool1 = 0; }],
  ['missing required person field', f => { delete f.world.people[1].Thew; }],
  ['wrong last saved resident entry', f => { f.world.queue[199] = 198; }],
  ['invalid saved resident ID', f => { f.a.writeUInt16LE(200, 3816); }],
  ['wrong discovered goods bit', f => { f.world.goodsQueue[0] &= 0x7fff; }],
  ['wrong last goods-tail word', f => { f.world.goodsQueue[1999]--; }],
  ['wrong raw fighter byte', f => { f.world.fighters[599] = 1; }],
  ['invalid raw U8 fighter measurement', f => { f.world.fighters[0] = 256; }],
  ['wrong final fighter flag', f => { f.world.fighterIndex[29] = 1; }],
  ['invalid native fighter allocation', f => { f.b[29] = 2; }],
  ['invalid native U16 fighter token', f => { f.b.writeUInt16LE(201, 30); }],
  ['unallocated battle order slot', f => { f.b[0] = 0; }],
  ['wrong inactive order measured field still rejected', f => { f.world.orders[199].Object = 0; }],
  ['invalid active city-target order', f => { f.b[630] = 13; f.b.writeUInt16LE(38, 634); }],
  ['wrong last city resources', f => { f.world.cities[37].Money--; }],
  ['missing city inventory offsets', f => { delete f.world.cities[0].ToolQueue; }],
  ['city resident segment outside saved prefix', f => { f.b.writeUInt16LE(201, 3430 + 31); }],
  ['city inventory segment outside saved goods', f => { f.b.writeUInt16LE(2001, 3430 + 35); }],
  ['wrong world people count', f => { f.world.people.pop(); }],
  ['sparse measured person table', f => { delete f.world.people[199]; }],
  ['wrong world cities count', f => { f.world.cities.pop(); }],
  ['sparse measured city table', f => { delete f.world.cities[37]; }],
  ['wrong world resident capacity', f => { f.world.queue.pop(); }],
  ['wrong world fighter byte count', f => { f.world.fighters.pop(); }],
  ['wrong world order count', f => { f.world.orders.pop(); }],
  ['sparse measured order table', f => { delete f.world.orders[199]; }],
];
for (const [name, mutate] of rejections) test('rejects ' + name, () => {
  const f = fixture(); mutate(f); assert.throws(() => verify(f), { code: 'ERR_ASSERTION' });
});

test('rejects odd, empty or malformed hex rather than Buffer partial decoding', () => {
  const f = fixture();
  for (const sav0 of ['', '0', 'gg', f.a.toString('hex') + '\n']) {
    assert.throws(() => verifyOriginalSavePair({ sav0, sav1: f.b.toString('hex'), world: f.world }), { code: 'ERR_ASSERTION' });
  }
  assert.throws(() => decodeOriginalSavePair({ sav0: f.a.toString('hex'), sav1: '' }), { code: 'ERR_ASSERTION' });
});
