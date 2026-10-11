#!/usr/bin/env node
// Decode the actual bridge without allowing native writes, keys, Mod hooks or
// speculative name/resource getters. Captures are already native observations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const writes = [], keys = [], calls = [];
    const raw = {g_hdDetailGeneration: 7};
    let onRead = null;
    const context = vm.createContext({TextDecoder, TextEncoder,
        Module: {HEAPU8: new Uint8Array(8192)}, console: {log(){}, warn(){}},
        addEventListener(){}, alert(){}, lcdBlur(){}});
    context.window = context;
    for (const name of new Set(source.match(/\b_baye\w+/g))) context[name] = () => 0;
    context._bayeHdReady = () => 1;
    context._bayeGetPersonCount = () => 786;
    context._bayeSendKey = key => keys.push(key);
    vm.runInContext(source, context);
    context.baye_bridge_init();
    function readonly(value, path = '') {
        if (!value || typeof value !== 'object') return value;
        return new Proxy(value, {
            get(object, key) {if (onRead) onRead(path, key); return readonly(object[key], path + '.' + String(key));},
            set(object, key) {writes.push(path + '.' + String(key)); throw Error('native write');}
        });
    }
    const baye = context.baye;
    baye.data = readonly(raw);
    baye.ensureData = () => baye.data;
    for (const name of ['getPersonName', 'getCityName', 'getToolName', 'getArmType', 'callHook']) {
        baye[name] = (...args) => {calls.push([name, ...args]); throw Error('uncaptured native getter/hook');};
    }
    function view() {
        Object.assign(raw, {g_hdViewProtocolVersion: 1, g_hdViewActive: 1, g_hdViewComplete: 1,
            g_hdViewCustom: 0, g_hdViewSeq: 12, g_hdViewGeneration: 7, g_hdViewInputSeq: 31,
            g_hdViewForce: 1, g_hdViewPageStart: 5, g_hdViewPageSize: 5, g_hdViewTotalCount: 9,
            g_hdViewRowCount: 2, g_hdViewPointCount: 2, g_hdViewMapWidth: 8, g_hdViewMapHeight: 6,
            g_hdViewPlayerMode: 0, g_hdViewFoodKnown: 1, g_hdViewDays: 11, g_hdViewFood: 321,
            g_hdViewLeader: 600, g_hdViewTitleGbk: 'actual title', g_hdViewDaysGbk: 'actual day',
            g_hdViewPositionsGbk: 'actual positions', g_hdViewFactionGbk: 'actual army', g_hdViewFoodGbk: 'actual food',
            g_hdViewRowPersons: [699, 600], g_hdViewRowArms: [65535, 0], g_hdViewRowSlots: [15, 16],
            g_hdViewRowNames: new Uint8Array(320), g_hdViewRowText: new Uint8Array(640),
            g_hdViewPointPersons: [699, 600], g_hdViewPointSlots: [0, 10],
            g_hdViewPointX: [0, 7], g_hdViewPointY: [0, 5], g_hdViewPointState: [0, 6]});
        raw.g_hdViewRowNames.set(new TextEncoder().encode('same'), 0);
        raw.g_hdViewRowNames.set(new TextEncoder().encode('same'), 32);
        raw.g_hdViewRowText.set(new TextEncoder().encode('same 65535'), 0);
        raw.g_hdViewRowText.set(new TextEncoder().encode('same 0'), 64);
    }
    function mini() {
        Object.assign(raw, {g_hdMiniMapProtocolVersion: 1, g_hdMiniMapActive: 1, g_hdMiniMapComplete: 1,
            g_hdMiniMapCustom: 0, g_hdMiniMapDefaultDraw: 1, g_hdMiniMapSeq: 18,
            g_hdMiniMapGeneration: 7, g_hdMiniMapInputSeq: 22, g_hdMiniMapResourceId: 75,
            g_hdMiniMapImageIndex: 0, g_hdMiniMapWidth: 84, g_hdMiniMapHeight: 64,
            g_hdMiniMapMask: 1, g_hdMiniMapCursorX: 17, g_hdMiniMapCursorY: 14,
            g_hdMiniMapViewX: 13, g_hdMiniMapViewY: 9, g_hdMiniMapViewWidth: 8,
            g_hdMiniMapViewHeight: 6, g_hdMiniMapCity1: 3});
    }
    function untouched() {assert.deepEqual(writes, []); assert.deepEqual(keys, []); assert.deepEqual(calls, []);}
    return {context, baye, raw, writes, keys, calls, view, mini, untouched,
        onRead: callback => {onRead = callback;}};
}

test('missing overview bindings stay unknown and do not invent a native person or page', () => {
    const h = fixture();
    const view = plain(h.baye.hd.view()), mini = plain(h.baye.hd.miniMap());
    for (const key of ['protocolVersion', 'active', 'generation', 'inputSeq', 'force', 'pageStart', 'rowCount', 'leaderPerson']) {
        assert.equal(view[key], null, key);
    }
    assert.equal(view.complete, 0); assert.deepEqual(view.rows, []); assert.deepEqual(view.points, []);
    for (const key of ['protocolVersion', 'active', 'generation', 'mapInputSeq', 'width', 'city1']) assert.equal(mini[key], null, key);
    assert.equal(mini.complete, 0); h.untouched();
});

test('actual VIEW captures preserve full U16 identities, duplicate names, native zero and independent point slots', () => {
    const h = fixture(); h.view(); const value = plain(h.baye.hd.view());
    assert.equal(value.protocolVersion, 1); assert.equal(value.active, 1); assert.equal(value.complete, 1);
    assert.equal(value.generation, value.detailGeneration); assert.equal(value.inputSeq, 31);
    assert.equal(value.seq, 12); assert.equal(value.force, 1); assert.equal(value.pageStart, 5);
    assert.equal(value.leaderPerson, 600); assert.equal(value.width, 8); assert.equal(value.height, 6);
    assert.deepEqual(value.rows, [
        {slot: 15, personIndex: 699, arms: 65535, name: 'same', text: 'same 65535'},
        {slot: 16, personIndex: 600, arms: 0, name: 'same', text: 'same 0'}
    ]);
    assert.deepEqual(value.points, [
        {slot: 0, personIndex: 699, x: 0, y: 0, state: 0},
        {slot: 10, personIndex: 600, x: 7, y: 5, state: 6}
    ]);
    assert.equal(value.title, 'actual title'); assert.equal(value.factionText, 'actual army');
    assert.equal(value.foodKnown, 1); assert.equal(value.food, 321); h.untouched();
});

test('VIEW numeric fields and array cells reject strings, booleans, holes, sentinels and out of bounds', () => {
    for (const [field, key, value] of [
        ['force', 'g_hdViewForce', '1'], ['pageStart', 'g_hdViewPageStart', true],
        ['days', 'g_hdViewDays', 65536], ['leaderPerson', 'g_hdViewLeader', 65535],
        ['foodKnown', 'g_hdViewFoodKnown', null], ['width', 'g_hdViewMapWidth', 256],
        ['playerMode', 'g_hdViewPlayerMode', -1]
    ]) {
        const h = fixture(); h.view(); h.raw[key] = value;
        assert.equal(h.baye.hd.view()[field], null, key); h.untouched();
    }
    const h = fixture(); h.view();
    h.raw.g_hdViewRowPersons[0] = '699'; h.raw.g_hdViewRowSlots[1] = 20;
    h.raw.g_hdViewRowArms[1] = false; delete h.raw.g_hdViewPointX[0]; h.raw.g_hdViewPointY[1] = 256;
    const value = h.baye.hd.view();
    assert.equal(value.rows[0].personIndex, null); assert.equal(value.rows[1].slot, null);
    assert.equal(value.rows[1].arms, null); assert.equal(value.points[0].x, null); assert.equal(value.points[1].y, null);
    h.untouched();
});

test('real bridge scalar boxes unwrap only their actual numeric value without coercing nested strings', () => {
    const h = fixture(); h.view(); h.mini();
    h.raw.g_hdViewForce = {value: 1}; h.raw.g_hdViewRowArms[1] = {value: 0};
    h.raw.g_hdMiniMapImageIndex = {value: 0}; h.raw.g_hdMiniMapWidth = {value: 84};
    assert.equal(h.baye.hd.view().force, 1); assert.equal(h.baye.hd.view().rows[1].arms, 0);
    assert.equal(h.baye.hd.miniMap().imageIndex, 0); assert.equal(h.baye.hd.miniMap().width, 84);
    h.raw.g_hdViewForce.value = '1'; h.raw.g_hdMiniMapWidth.value = true;
    assert.equal(h.baye.hd.view().force, null); assert.equal(h.baye.hd.miniMap().width, null); h.untouched();
});

test('bounded row and point counts cannot read past native capture buffers', () => {
    for (const [key, output, array] of [['g_hdViewRowCount', 'rowCount', 'rows'], ['g_hdViewPointCount', null, 'points']]) {
        for (const invalid of [-1, 256, '2', true]) {
            const h = fixture(); h.view(); h.raw[key] = invalid; const value = h.baye.hd.view();
            if (output) assert.equal(value[output], null); assert.deepEqual(plain(value[array]), []); h.untouched();
        }
    }
});

test('actual GBK buffers decode only the captured field and row lengths without a name lookup', () => {
    const h = fixture(); h.view();
    // GBK 中 / 文. Extra neighbouring bytes must never become a row's name.
    h.raw.g_hdViewTitleGbk = new Uint8Array(64); h.raw.g_hdViewTitleGbk.set([0xd6, 0xd0, 0xce, 0xc4, 0]);
    h.raw.g_hdViewRowNames.fill(0); h.raw.g_hdViewRowNames.set([0xd6, 0xd0, 0], 0);
    h.raw.g_hdViewRowNames.set([0xce, 0xc4, 0], 32);
    const value = h.baye.hd.view(); assert.equal(value.title, '中文');
    assert.equal(value.rows[0].name, '中'); assert.equal(value.rows[1].name, '文'); h.untouched();
});

test('a whole-string binding cannot claim the later native VIEW slots after the first NUL', () => {
    for (const key of ['g_hdViewRowNames', 'g_hdViewRowText']) {
        for (const string of ['same', 'same\0' + '\0'.repeat(26) + 'second native slot']) {
            const h = fixture(); h.view(); const bytes = h.raw[key];
            // A GBKBuffer binding returns a string truncated at its first NUL;
            // that string does not authenticate the separate 32/64-byte slots.
            h.raw[key] = string;
            const rejected = plain(h.baye.hd.view());
            assert.equal(rejected.complete, 0, key);
            assert.deepEqual(rejected.rows, []); assert.deepEqual(rejected.points, []);
            h.raw[key] = bytes;
            const restored = plain(h.baye.hd.view());
            assert.equal(restored.complete, 1);
            assert.equal(restored.rows.length, 2);
            assert.equal(restored.rows[1].personIndex, 600);
            assert.equal(restored.rows[1].name, 'same'); h.untouched();
        }
    }
});

test('each actual native page publication replaces the previous rows without a bridge cache or extra engine input', () => {
    const h = fixture(); h.view(); const first = plain(h.baye.hd.view());
    Object.assign(h.raw, {g_hdViewSeq: 13, g_hdViewInputSeq: 32, g_hdViewForce: 0,
        g_hdViewPageStart: 0, g_hdViewRowCount: 1, g_hdViewPointCount: 0,
        g_hdViewRowPersons: [700], g_hdViewRowSlots: [0], g_hdViewRowArms: [9]});
    h.raw.g_hdViewRowNames.fill(0); h.raw.g_hdViewRowNames.set(new TextEncoder().encode('new actual row'));
    const next = plain(h.baye.hd.view()); assert.notEqual(next.seq, first.seq); assert.notEqual(next.inputSeq, first.inputSeq);
    assert.equal(next.force, 0); assert.equal(next.pageStart, 0); assert.equal(next.rows.length, 1);
    assert.equal(next.rows[0].personIndex, 700); assert.equal(next.rows[0].name, 'new actual row');
    assert.deepEqual(next.points, []); h.untouched();
});

test('VIEW retires a reentrant change while reading either rows or the final native text field', () => {
    for (const readKey of ['g_hdViewRowNames', 'g_hdViewFoodGbk']) {
        for (const changed of ['g_hdViewSeq', 'g_hdViewInputSeq', 'g_hdViewGeneration', 'g_hdDetailGeneration']) {
            const h = fixture(); h.view(); let changedOnce = false;
            h.onRead((path, key) => {if (!path && key === readKey && !changedOnce) {changedOnce = true; h.raw[changed]++;}});
            const value = plain(h.baye.hd.view()); assert.equal(changedOnce, true);
            assert.equal(value.complete, 0, readKey + ' / ' + changed);
            assert.deepEqual(value.rows, []); assert.deepEqual(value.points, []); h.untouched();
        }
    }
});

test('VIEW rejects an already stale detail generation without consuming the captured labels', () => {
    const h = fixture(); h.view(); h.raw.g_hdDetailGeneration = 8;
    const value = plain(h.baye.hd.view()); assert.equal(value.complete, 0);
    assert.deepEqual(value.rows, []); assert.deepEqual(value.points, []); h.untouched();
});

test('native miniature snapshot identifies only its actual resource, image geometry and current map wait', () => {
    const h = fixture(); h.mini(); const value = plain(h.baye.hd.miniMap());
    assert.deepEqual(value, {protocolVersion: 1, active: 1, complete: 1, custom: 0, defaultDraw: 1,
        seq: 18, generation: 7, detailGeneration: 7, mapInputSeq: 22, resourceId: 75, imageIndex: 0,
        width: 84, height: 64, mask: 1, cursorX: 17, cursorY: 14, viewX: 13, viewY: 9,
        viewWidth: 8, viewHeight: 6, city1: 3}); h.untouched();
    Object.assign(h.raw, {g_hdMiniMapCustom: 1, g_hdMiniMapDefaultDraw: 0, g_hdMiniMapComplete: 0,
        g_hdMiniMapWidth: 0, g_hdMiniMapHeight: 0});
    const custom = h.baye.hd.miniMap(); assert.equal(custom.custom, 1); assert.equal(custom.defaultDraw, 0);
    assert.equal(custom.complete, 0); assert.equal(custom.width, 0); h.untouched();
});

test('miniature numeric fields reject coercion and retain native zero rather than guessing defaults', () => {
    for (const [key, output, bad] of [['g_hdMiniMapWidth', 'width', '84'], ['g_hdMiniMapMask', 'mask', true],
        ['g_hdMiniMapCity1', 'city1', 256], ['g_hdMiniMapCursorX', 'cursorX', -1],
        ['g_hdMiniMapDefaultDraw', 'defaultDraw', null], ['g_hdMiniMapImageIndex', 'imageIndex', 65536]]) {
        const h = fixture(); h.mini(); h.raw[key] = bad; assert.equal(h.baye.hd.miniMap()[output], null, key); h.untouched();
    }
    const h = fixture(); h.mini(); h.raw.g_hdMiniMapCity1 = 0; h.raw.g_hdMiniMapCursorX = 0;
    assert.equal(h.baye.hd.miniMap().city1, 0); assert.equal(h.baye.hd.miniMap().cursorX, 0); h.untouched();
});

test('miniature final field reentry or a stale generation cannot claim a complete current image', () => {
    for (const changed of ['g_hdMiniMapSeq', 'g_hdMiniMapInputSeq', 'g_hdMiniMapGeneration', 'g_hdDetailGeneration']) {
        const h = fixture(); h.mini(); let changedOnce = false;
        h.onRead((path, key) => {if (!path && key === 'g_hdMiniMapCity1' && !changedOnce) {changedOnce = true; h.raw[changed]++;}});
        assert.equal(h.baye.hd.miniMap().complete, 0, changed); assert.equal(changedOnce, true); h.untouched();
    }
    const h = fixture(); h.mini(); h.raw.g_hdDetailGeneration = 8;
    assert.equal(h.baye.hd.miniMap().complete, 0); h.untouched();
});
