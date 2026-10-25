#!/usr/bin/env node
/** Production ownership labels against the native U16 contracts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('js/bridge.js');
function harness(count = 786) {
    const calls = [], writes = [], keys = [];
    const context = vm.createContext({ TextDecoder, TextEncoder,
        console: { log() {}, warn() {}, error() {} }, alert() {}, lcdBlur() {},
        Module: { HEAPU8: new Uint8Array(8192) }, addEventListener() {} });
    context.window = context;
    for (const name of new Set(source.match(/\b_baye\w+/g))) context[name] = () => 0;
    context._bayeHdReady = () => 1;
    context._bayeGetPersonCount = () => count;
    context._bayeGetCityCount = () => 3;
    context._bayeSendKey = key => keys.push(key);
    vm.runInContext(source, context, { filename: 'js/bridge.js' });
    context.baye_bridge_init();
    const baye = context.baye;
    baye.getPersonName = index => { calls.push(index); return index >= 0 && index < count ? '人物' + index : ''; };
    baye.getCityName = index => '城池' + index;
    const raw = { g_PlayerKing: 254, g_PIdx: 1, g_Cities: [{ Belong: 255 }, { Belong: 0 }, {}] };
    baye.data = new Proxy(raw, { set(target, key, value) { writes.push([key, value]); return Reflect.set(target, key, value); } });
    baye.ensureData = () => baye.data;
    return { baye, calls, writes, keys, setCount(value) { count = value; } };
}

test('native contract is U16 and only Person.Belong uses 0xffff for captive', () => {
    assert.match(read('vendor/iBaye/src/inc/dictsys.h'), /typedef\s+U16\s+PersonID/);
    const face = read('vendor/iBaye/src/showface.c');
    assert.match(face, /if \(0xffff == b\)[\s\S]*?else if \(b == person \+ 1\)/);
    assert.match(read('vendor/iBaye/src/citycmdd.c'), /Belong\s*=\s*PID\(0xffff\)/);
    const engine = read('vendor/iBaye/src/gamEng.c');
    assert.match(engine, /person->Belong\s*!=\s*0xffff\s*&&\s*person->Belong\s*>\s*snapshot->personCount/);
    assert.match(engine, /item->Belong\s*>\s*snapshot->personCount/);
});

test('person zero is free; person 65535 is captive; city zero alone is unowned', () => {
    const h = harness();
    assert.equal(h.baye.personOwnership(0, 4).label, '在野');
    assert.equal(h.baye.personOwnership(65535, 4).label, '俘虏');
    assert.equal(h.baye.cityOwnership(0).label, '无主城');
    assert.equal(h.baye.cityOwnership(65535).kind, 'unknown');
    assert.equal(h.baye.cityOwnership(65535).label, '归属未知');
    assert.deepEqual(h.calls, []);
});

for (const id of [255, 256, 600, 786, 2000]) {
    test('real U16 lord ID ' + id + ' resolves zero-based index without wrapping', () => {
        const h = harness(Math.max(786, id));
        assert.equal(h.baye.getPersonNameByID(id), '人物' + (id - 1));
        assert.equal(h.baye.personOwnership(id, 4).label, '人物' + (id - 1));
        assert.equal(h.baye.cityOwnership(id).label, '人物' + (id - 1));
        assert.deepEqual(h.calls, [id - 1, id - 1, id - 1]);
        assert.deepEqual(h.writes, []);
        assert.deepEqual(h.keys, []);
    });
}

test('self plus one means lord only for a person, including high person index', () => {
    const h = harness();
    assert.equal(h.baye.personOwnership(600, 599).kind, 'lord');
    assert.equal(h.baye.personOwnership(600, 599).label, '君主 · 人物599');
    assert.equal(h.baye.personOwnership(600, 598).kind, 'owned');
    assert.equal(h.baye.cityOwnership(600).kind, 'owned');
});

test('missing or invalid ownership stays unknown and never calls a name getter', () => {
    const h = harness();
    for (const value of [undefined, null, '', ' ', false, true, NaN, Infinity, -1, 1.5, 65536, {}]) {
        assert.equal(h.baye.personOwnership(value, 0).kind, 'unknown', String(value));
        assert.equal(h.baye.cityOwnership(value).kind, 'unknown', String(value));
        assert.equal(h.baye.getPersonNameByID(value), '-');
    }
    for (const value of [787, 65534, 65535]) {
        assert.equal(h.baye.cityOwnership(value).kind, 'unknown');
        assert.equal(h.baye.getPersonNameByID(value), '-');
    }
    assert.deepEqual(h.calls, []);
});

test('unavailable actual person list and missing names do not guess a lord', () => {
    const h = harness();
    h.setCount(0);
    assert.equal(h.baye.cityOwnership(255).kind, 'unknown');
    assert.equal(h.baye.personOwnership(255, 254).kind, 'unknown');
    assert.equal(h.baye.getPersonNameByID(255), '-');
    assert.deepEqual(h.calls, []);
    h.setCount(786);
    h.baye.getPersonName = () => '';
    assert.equal(h.baye.cityOwnership(255).kind, 'unknown');
    assert.equal(h.baye.personOwnership(255, 254).kind, 'unknown');
});

test('bridge value wrappers preserve exact U16 ownership', () => {
    const h = harness();
    assert.equal(h.baye.cityOwnership({ value: 255 }).personIndex, 254);
    assert.equal(h.baye.personOwnership({ value: 65535 }, 254).kind, 'captive');
    assert.equal(h.baye.cityOwnership({ value: null }).kind, 'unknown');
});

test('realm separates valid owner 255, no owner, and missing ownership without writes', () => {
    const h = harness();
    const realm = h.baye.hd.realm();
    assert.equal(realm.playerKing, 254);
    assert.equal(realm.playerBelong, 255);
    assert.equal(realm.ownedCount, 1);
    assert.equal(realm.cities[0].owner, '人物254');
    assert.equal(realm.cities[0].ownership.kind, 'owned');
    assert.equal(realm.cities[1].ownership.kind, 'unowned');
    assert.equal(realm.cities[2].belong, null);
    assert.equal(realm.cities[2].ownership.kind, 'unknown');
    assert.equal(realm.cities[2].owner, '');
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.keys, []);
});
