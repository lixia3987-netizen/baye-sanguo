#!/usr/bin/env node
// Read actual city-info publications without native keys, writes or getters.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');
const bindings = readFileSync(new URL('../vendor/iBaye/src/bind-objects.c', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const ascii = text => Array.from(new TextEncoder().encode(text));

function fixture() {
    const raw = {g_hdDetailGeneration: 7, g_engineConfig: {citiesCount: 38}};
    const writes = [], keys = [], calls = [];
    let onRead = null;
    const context = vm.createContext({TextDecoder, TextEncoder,
        Module: {HEAPU8: new Uint8Array(8192)}, console: {log(){}, warn(){}},
        addEventListener(){}, alert(){}, lcdBlur(){}});
    context.window = context;
    for (const name of new Set(source.match(/\b_baye\w+/g))) context[name] = () => 0;
    context._bayeHdReady = () => 1;
    context._bayeSendKey = key => keys.push(key);
    context._bayeGetCityCount = () => {calls.push('getCityCount'); throw Error('extra native getter');};
    vm.runInContext(source, context);
    context.baye_bridge_init();
    function readonly(value, path = '') {
        if (!value || typeof value !== 'object') return value;
        return new Proxy(value, {
            get(object, key) {
                if (onRead) onRead(path, key);
                if (key === 'g_Cities' || key === 'g_hdMapCity') {
                    calls.push(key); throw Error('uncaptured city source');
                }
                return readonly(object[key], path + '.' + String(key));
            },
            set(object, key) {writes.push(path + '.' + String(key)); throw Error('native write');}
        });
    }
    const baye = context.baye;
    baye.data = readonly(raw);
    baye.ensureData = () => baye.data;
    for (const name of ['getPersonName', 'getCityName', 'getToolName', 'getArmType', 'callHook']) {
        baye[name] = (...args) => {calls.push([name, ...args]); throw Error('extra getter or hook');};
    }
    function page({city = 0, count = 11, start = 0, size = 5, texts = null} = {}) {
        const n = Math.min(size, Math.max(0, count - start));
        Object.assign(raw, {g_hdCityInfoProtocolVersion: 1, g_hdCityInfoActive: 1,
            g_hdCityInfoComplete: 1, g_hdCityInfoCustom: 0, g_hdCityInfoWait: 1,
            g_hdCityInfoSeq: 12, g_hdCityInfoSession: 3, g_hdCityInfoGeneration: 7,
            g_hdCityInfoInputSeq: 31, g_hdCityInfoCity: city, g_hdCityInfoPropertyCount: count,
            g_hdCityInfoPageStart: start, g_hdCityInfoPageSize: size, g_hdCityInfoRowCount: n,
            g_hdCityInfoTitleGbk: new Uint8Array(64), g_hdCityInfoRowIndices: new Uint8Array(32),
            g_hdCityInfoRowText: new Uint8Array(32 * 128)});
        raw.g_hdCityInfoTitleGbk.set([0xcf, 0xe5, 0xd1, 0xf4]); // 襄阳
        for (let i = 0; i < n && i < 32; i++) {
            raw.g_hdCityInfoRowIndices[i] = start + i;
            raw.g_hdCityInfoRowText.set(texts?.[i] ?? ascii('actual property ' + (start + i)), i * 128);
        }
    }
    function untouched() {assert.deepEqual(writes, []); assert.deepEqual(keys, []); assert.deepEqual(calls, []);}
    return {raw, baye, page, untouched, onRead: callback => {onRead = callback;}};
}

test('new ABI is explicit, inactive stays zero and missing or coercible fields never become native zero', () => {
    const old = fixture(); assert.equal(old.baye.hd.cityInfo(), null); old.untouched();
    for (const name of ['ProtocolVersion', 'Active', 'Complete', 'Wait', 'Session', 'InputSeq', 'City', 'RowCount']) {
        const h = fixture(); h.page(); delete h.raw['g_hdCityInfo' + name];
        assert.equal(h.baye.hd.cityInfo(), null, name); h.untouched();
    }
    for (const [name, bad] of [['ProtocolVersion', 2], ['Active', '1'], ['Complete', true],
        ['Custom', -1], ['Wait', 2], ['Seq', 0x100000000], ['Session', 1.5], ['Generation', null],
        ['InputSeq', NaN], ['City', 256], ['PropertyCount', '11'], ['PageStart', false], ['PageSize', Infinity]]) {
        const h = fixture(); h.page(); h.raw['g_hdCityInfo' + name] = bad;
        assert.equal(h.baye.hd.cityInfo(), null, name); h.untouched();
    }
    const h = fixture(); h.page();
    Object.keys(h.raw).filter(key => key.startsWith('g_hdCityInfo') && !ArrayBuffer.isView(h.raw[key]))
        .forEach(key => {h.raw[key] = {value: h.raw[key]};});
    assert.equal(h.baye.hd.cityInfo().complete, 1);
    h.raw.g_hdCityInfoActive = 0; h.raw.g_hdCityInfoComplete = 0;
    h.raw.g_hdCityInfoGeneration = 0; h.raw.g_hdCityInfoCity = 255;
    const inactive = plain(h.baye.hd.cityInfo());
    assert.equal(inactive.active, 0); assert.equal(inactive.complete, 0);
    assert.equal(inactive.generation, 0); assert.equal(inactive.cityIndex, 255);
    assert.deepEqual(inactive.rows, []); h.untouched();
});

test('each actual native page replaces the previous page, with native page size and independent GBK NUL rows', () => {
    const h = fixture(); h.page({texts: [[0xd6, 0xd0, 0xce, 0xc4], ascii('line one\nline two  '), [], ascii('3'), ascii('4')]});
    const first = plain(h.baye.hd.cityInfo());
    assert.deepEqual(first, {protocolVersion: 1, active: 1, complete: 1, custom: 0, wait: 1,
        seq: 12, session: 3, generation: 7, inputSeq: 31, cityIndex: 0, propertyCount: 11,
        pageStart: 0, pageSize: 5, rowCount: 5, detailGeneration: 7, title: '襄阳',
        rows: [{index: 0, text: '中文'}, {index: 1, text: 'line one\nline two  '},
            {index: 2, text: ''}, {index: 3, text: '3'}, {index: 4, text: '4'}]});
    h.page({start: 5}); h.raw.g_hdCityInfoSeq = 13; h.raw.g_hdCityInfoInputSeq = 32;
    const second = plain(h.baye.hd.cityInfo());
    assert.equal(second.complete, 1); assert.equal(second.seq, 13); assert.equal(second.inputSeq, 32);
    assert.deepEqual(second.rows.map(row => row.index), [5, 6, 7, 8, 9]);
    h.page({start: 10}); h.raw.g_hdCityInfoSeq = 14; h.raw.g_hdCityInfoInputSeq = 33;
    const last = plain(h.baye.hd.cityInfo());
    assert.equal(last.complete, 1); assert.equal(last.pageSize, 5); assert.equal(last.rowCount, 1);
    assert.deepEqual(last.rows, [{index: 10, text: 'actual property 10'}]);
    h.untouched();
});

test('city zero, all 32 captured rows and high U8 property identities retain full bounded text', () => {
    const h = fixture(); h.page({count: 255, start: 223, size: 32});
    h.raw.g_hdCityInfoTitleGbk.fill(0x41, 0, 63);
    h.raw.g_hdCityInfoRowText.fill(0x42, 31 * 128, 31 * 128 + 127);
    h.raw.g_hdCityInfoRowText[31 * 128 + 127] = 0;
    const value = plain(h.baye.hd.cityInfo());
    assert.equal(value.complete, 1); assert.equal(value.cityIndex, 0); assert.equal(value.title.length, 63);
    assert.equal(value.rows.length, 32); assert.equal(value.rows[31].index, 254);
    assert.equal(value.rows[31].text, 'B'.repeat(127));
    h.raw.g_hdCityInfoCity = 37; assert.equal(h.baye.hd.cityInfo().complete, 1);
    h.raw.g_engineConfig.citiesCount = 37; assert.equal(h.baye.hd.cityInfo().complete, 0);
    h.untouched();
    for (const [name, size] of [['TitleGbk', '64'], ['RowIndices', '32'], ['RowText', '32 * 128']]) {
        assert.ok(bindings.includes('DEFADD_U8ARR(g_hdCityInfo' + name + ', ' + size + ');'), name);
        assert.ok(!bindings.includes('DEFADD_GBKARR(g_hdCityInfo' + name), name);
    }
});

test('bad page bounds, missing or malformed byte slots and uncounted properties cannot certify a complete page', () => {
    for (const mutate of [
        raw => {raw.g_hdCityInfoCity = 38;}, raw => {raw.g_engineConfig.citiesCount = '38';},
        raw => {delete raw.g_engineConfig;}, raw => {raw.g_hdCityInfoPropertyCount = 0;},
        raw => {raw.g_hdCityInfoPageSize = 0;}, raw => {raw.g_hdCityInfoPageSize = 33;},
        raw => {raw.g_hdCityInfoPageStart = 11;}, raw => {raw.g_hdCityInfoRowCount = 33;},
        raw => {raw.g_hdCityInfoRowCount = 4;}, raw => {raw.g_hdCityInfoRowIndices[1] = 3;},
        raw => {raw.g_hdCityInfoRowIndices = Array.from(raw.g_hdCityInfoRowIndices); raw.g_hdCityInfoRowIndices[0] = '0';},
        raw => {raw.g_hdCityInfoTitleGbk = 'title';},
        raw => {raw.g_hdCityInfoRowText = 'all rows';}, raw => {delete raw.g_hdCityInfoRowIndices;},
        raw => {raw.g_hdCityInfoRowText = new Uint8Array(128);},
        raw => {raw.g_hdCityInfoTitleGbk.fill(0x41);},
        raw => {raw.g_hdCityInfoRowText.fill(0x42, 0, 128);},
        raw => {raw.g_hdCityInfoRowText[0] = 0x81; raw.g_hdCityInfoRowText[1] = 0;},
        raw => {raw.g_hdCityInfoRowText = Array.from(raw.g_hdCityInfoRowText); delete raw.g_hdCityInfoRowText[0];}
    ]) {
        const h = fixture(); h.page(); mutate(h.raw);
        const value = plain(h.baye.hd.cityInfo());
        assert.equal(value.complete, 0, String(mutate)); assert.deepEqual(value.rows, []); h.untouched();
    }
    const zero = fixture(); zero.page({count: 0}); zero.raw.g_hdCityInfoComplete = 0;
    assert.equal(zero.baye.hd.cityInfo().complete, 0); zero.untouched();
});

test('generation, page, session, input ACK and byte reentry retire mixed snapshots without sending or mutating anything', () => {
    for (const field of ['Seq', 'Session', 'Generation', 'InputSeq', 'City', 'PropertyCount', 'PageStart', 'PageSize', 'RowCount']) {
        const h = fixture(); h.page(); let changed = false;
        h.onRead((path, key) => {
            if (!path && key === 'g_hdCityInfoRowText' && !changed) {
                changed = true; h.raw['g_hdCityInfo' + field]++;
            }
        });
        const value = plain(h.baye.hd.cityInfo());
        assert.equal(changed, true); assert.equal(value.complete, 0, field); assert.deepEqual(value.rows, []); h.untouched();
    }
    for (const field of ['g_hdCityInfoSeq', 'g_hdCityInfoSession', 'g_hdCityInfoInputSeq']) {
        const h = fixture(); h.page(); h.raw[field] = 0;
        assert.equal(h.baye.hd.cityInfo().complete, 0, field); h.untouched();
    }
    const stale = fixture(); stale.page(); stale.raw.g_hdDetailGeneration++;
    assert.equal(stale.baye.hd.cityInfo().complete, 0); stale.untouched();
    const byte = fixture(); byte.page(); let reads = 0;
    byte.onRead((path, key) => {
        if (path === '.g_hdCityInfoRowText' && key === '0' && ++reads === 2) byte.raw.g_hdCityInfoRowText[0] = 0x42;
    });
    assert.equal(byte.baye.hd.cityInfo().complete, 0); byte.untouched();
});
