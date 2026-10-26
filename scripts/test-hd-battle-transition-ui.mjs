#!/usr/bin/env node
// Actual public bridge + passive controller + minimal DOM; no game or input.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const source = readFileSync(new URL('../js/hd-battle-transition.js', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');
const oldSource = readFileSync(new URL('../js/hd-battle-note.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/hd-battle-transition.css', import.meta.url), 'utf8');
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const original = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
const blockers = ['g_hdMenuActive', 'g_hdReportActive', 'g_hdRecordActive', 'g_hdQtyActive',
    'g_hdHelpActive', 'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdMovieActive', 'g_hdSpeActive',
    'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdResultOwnerKind',
    'g_hdResultOwnerValid', 'g_hdMapPick', 'g_hdBattlePick'];
const field = name => 'g_hdBattleNote' + name[0].toUpperCase() + name.slice(1);
function fixture({mobile = true, mode = 'auto', map = 'hd-map', microtask = true} = {}) {
    const listeners = new Map(), windowListeners = new Map(), timers = new Map(), nodes = new Map();
    const state = {mode, map, ready: true, writes: [], keys: [], forbidden: [], countReads: 0,
        readHook: null, identityHook: null, callbacks: [], microtasks: []};
    let identity = {status: 'ready', generation: 3, sha256: SHA, byteLength: 207195};
    function element() { return {hidden: true, textContent: '', innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }}; }
    for (const id of ['hd-battle-transition', 'hd-battle-transition-graphic', 'hd-battle-transition-label', 'hd-battle-transition-value',
        'hd-battle-note', 'hd-battle-note-text']) nodes.set(id, element());
    const body = {...element(), classList: {contains: name => mobile && name === 'hd-mobile-page'}};
    const document = {body, hidden: false, getElementById: id => nodes.get(id),
        addEventListener(name, fn) { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list); }};
    const raw = Object.fromEntries(blockers.map(name => [name, 0]));
    Object.assign(raw, {g_hdEngineReady: 1, g_hdDetailGeneration: 3, g_hdMenuSeq: 17, g_hdReportSeq: 8,
        g_hdRecordSeq: 2, g_hdMapInputSeq: 4, g_hdFightInputSeq: 9, g_hdFightActive: 1,
        g_hdFightOver: 0, g_hdFightInputKind: 0, g_FgtOver: 0,
        g_hdBattleNoteProtocolVersion: 1, g_hdBattleNoteActive: 1, g_hdBattleNoteSeq: 11,
        g_hdBattleNoteGeneration: 3, g_hdBattleNoteOutcome: 6, g_hdBattleNoteWinner: 65535,
        g_hdBattleNoteText: '', g_hdBattleNoteValue: 1});
    const env = vm.createContext({document, TextDecoder, TextEncoder, innerWidth: 844, innerHeight: 390,
        Module: {HEAPU8: new Uint8Array(8192)}, console: {log() {}, warn() {}}, alert() {}, lcdBlur() {},
        dynLib: original.toString('hex'), localStorage: {setItem() { throw Error('No preference writes'); }},
        BayeHdBattle: {getMode: () => state.mode, shouldShowHd() { throw Error('No alternate presentation source'); }},
        BayeHdOverworld: {getMode: () => state.map},
        BayeHdLibIdentity: {read() { state.identityHook?.(); return identity; },
            isCurrent: value => value.generation === identity.generation && value.sha256 === identity.sha256 && value.status === identity.status,
            subscribe: fn => state.callbacks.push(fn)},
        addEventListener(name, fn) { const list = windowListeners.get(name) || []; list.push(fn); windowListeners.set(name, list); },
        setTimeout(fn, ms) { const id = Math.max(0, ...timers.keys()) + 1; timers.set(id, {fn, ms}); return id; },
        clearTimeout(id) { timers.delete(id); }});
    env.window = env;
    if (microtask) env.queueMicrotask = fn => state.microtasks.push(fn);
    for (const name of new Set(bridgeSource.match(/\b_baye\w+/g))) env[name] = () => 0;
    env._bayeHdReady = () => state.ready ? 1 : 0;
    env._bayeGetPersonCount = () => { state.countReads++; return 200; };
    env._bayeSendKey = key => state.keys.push(key);
    for (const name of ['_bayeGetPersonName', '_bayeGetCityName', '_bayeGetCityCount', '_bayeGetToolName'])
        env[name] = () => { state.forbidden.push(name); throw Error('Unexpected native lookup'); };
    vm.runInContext(bridgeSource, env, {filename: 'actual-bridge.js'});
    env.baye_bridge_init();
    const data = new Proxy(raw, {get(object, key) {
        state.readHook?.(key);
        if (['g_Persons', 'g_Cities', 'g_PIdx', 'g_PlayerKing', 'g_hdMapCity', 'g_EnemyKings'].includes(key)) {
            state.forbidden.push(String(key)); throw Error('Unpublished world source');
        }
        return object[key];
    }, set(object, key) { state.writes.push(String(key)); throw Error('Native writes forbidden'); }});
    env.baye.data = data; env.baye.ensureData = () => env.baye.data;
    vm.runInContext(source, env, {filename: 'hd-battle-transition.js'});
    const api = env.BayeHdBattleTransition.createController(env);
    function set(name, value) { raw[field(name)] = value; }
    function fire(name, target = windowListeners) { for (const fn of target.get(name) || []) fn({}); }
    function tick() { const item = timers.entries().next().value; assert.ok(item); timers.delete(item[0]); item[1].fn(); }
    function flush() {
        if (microtask) { while (state.microtasks.length) state.microtasks.shift()(); }
        else for (const [id, item] of [...timers]) if (item.ms === 0) { timers.delete(id); item.fn(); }
    }
    function off() { assert.equal(api.debugSnapshot().active, false); assert.equal(body.attrs['data-hd-battle-transition'], 'off');
        assert.equal(nodes.get('hd-battle-transition').hidden, true); assert.equal(nodes.get('hd-battle-transition-graphic').innerHTML, '');
        assert.equal(nodes.get('hd-battle-transition-value').textContent, ''); }
    function on() { assert.equal(api.debugSnapshot().active, true); assert.equal(body.attrs['data-hd-battle-transition'], 'hd');
        assert.equal(nodes.get('hd-battle-transition').hidden, false); }
    function untouched() { assert.deepEqual(state.writes, []); assert.deepEqual(state.keys, []); assert.deepEqual(state.forbidden, []); }
    return {env, api, state, raw, data, nodes, body, document, timers, listeners, windowListeners,
        set, fire, tick, flush, off, on, untouched, identity: () => identity, setIdentity: value => { identity = value; }};
}

test('Actual original library is authenticated, and the actual bridge legacy Promise is exercised', () => {
    assert.equal(original.length, 207195); assert.equal(createHash('sha256').update(original).digest('hex'), SHA);
    const f = fixture(); assert.equal(typeof f.env.Promise, 'function'); assert.equal(f.env.Promise.resolve, undefined);
    f.api.init(); f.on(); f.untouched();
});

test('All five captured weather IDs render distinct HD graphics, with hail rather than snow for 5', () => {
    const f = fixture(), graphics = new Set(); f.api.init();
    for (const [value, label] of [[1, '晴'], [2, '阴'], [3, '风'], [4, '雨'], [5, '冰雹']]) {
        f.set('value', value); f.set('seq', 11 + value); f.api.onEngineTransition(); f.on();
        assert.equal(f.nodes.get('hd-battle-transition-value').textContent, label);
        assert.equal(f.nodes.get('hd-battle-transition').attrs['data-weather'], String(value));
        const graphic = f.nodes.get('hd-battle-transition-graphic').innerHTML; assert.match(graphic, /^<svg /); graphics.add(graphic);
        assert.equal(f.api.debugSnapshot().value, value); assert.equal(f.state.countReads, 0);
    }
    assert.equal(graphics.size, 5); assert.match(f.nodes.get('hd-battle-transition-graphic').innerHTML, /<circle cx="31" cy="102"/);
    f.untouched();
});

test('Actual day values use the captured canonical original numeral, including U16 boundaries', () => {
    const f = fixture(); f.set('outcome', 7);
    for (const value of [0, 1, 9, 255, 256, 9999, 65535]) {
        f.set('value', value); f.set('text', String(value)); f.api.init(); f.api.onEngineTransition(); f.on();
        assert.equal(f.nodes.get('hd-battle-transition-value').textContent, '第 ' + value + ' 天');
        assert.equal(f.nodes.get('hd-battle-transition').attrs['data-kind'], 'day');
        assert.equal(f.nodes.get('hd-battle-transition-graphic').innerHTML, '');
    }
    assert.equal(f.state.countReads, 0); f.untouched();
});

test('The native wait exit synchronously clears every visual; queued reads cannot extend it', () => {
    const f = fixture(); f.api.init(); f.on(); f.fire('pointerup');
    Object.assign(f.raw, {g_hdBattleNoteActive: 0, g_hdBattleNoteOutcome: 0, g_hdBattleNoteText: ''});
    f.api.onEngineTransition(); f.off(); f.flush(); f.off(); f.tick(); f.off(); f.untouched();
});

test('Only actual current fight BUSY, live generation and positive input sequence permit the transition', () => {
    for (const [name, value] of [['g_hdFightActive', 0], ['g_hdFightOver', 1], ['g_FgtOver', 1], ['g_hdFightInputKind', 1],
        ['g_hdFightInputSeq', 0], ['g_hdEngineReady', 0], ['g_hdDetailGeneration', 4], ['g_hdBattleNoteGeneration', 0],
        ['g_hdBattleNoteSeq', 0], ['g_hdBattleNoteProtocolVersion', 0]]) {
        const f = fixture(); f.raw[name] = value; f.api.init(); f.off(); f.untouched();
    }
});

test('Every current higher owner suppresses the passive transition', () => {
    for (const name of [...blockers, 'g_hdCityInfoActive']) {
        const f = fixture(); f.api.init(); f.on(); f.raw[name] = 1; f.api.onEngineTransition(); f.off(); f.untouched();
    }
});

test('Malformed, future, text-injected or partial publications remain LCD', () => {
    for (const [name, value] of [['outcome', 8], ['outcome', 5], ['active', 2], ['winner', 0], ['value', 0], ['value', 6],
        ['value', '1'], ['value', NaN], ['text', '晴'], ['text', '<svg onload="attack">'], ['text', '\0'], ['seq', -1]]) {
        const f = fixture(); f.set(name, value); f.api.init(); f.off(); f.untouched();
    }
    for (const name of ['value', 'text', 'seq', 'generation']) {
        const f = fixture(); delete f.raw[field(name)]; f.api.init(); f.off(); f.untouched();
    }
    for (const [value, text] of [[1, '01'], [1, '1天'], [1, ' 1 '], [1, '<b>1</b>'], [65536, '65536'], [-1, '-1']]) {
        const f = fixture(); f.set('outcome', 7); f.set('value', value); f.set('text', text); f.api.init(); f.off(); f.untouched();
    }
});

test('Unknown, changed or incomplete library identity retires the original-only graphics', () => {
    for (const change of [f => { f.identity().sha256 = 'custom'; }, f => { f.identity().status = 'hashing'; },
        f => { f.identity().byteLength--; }, f => { f.identity().generation = 0; }, f => { f.env.dynLib = ''; },
        f => { f.env.BayeHdLibIdentity = null; }, f => { f.state.ready = false; }]) {
        const f = fixture(); f.api.init(); f.on(); change(f); f.api.refresh(); f.off(); f.untouched();
    }
});

for (const mobile of [false, true]) test((mobile ? 'Mobile' : 'PC') + ' respects public battle preferences and map auto mode', () => {
    const f = fixture({mobile}); f.api.init(); f.on(); f.state.map = 'classic'; f.api.refresh(); f.off();
    f.state.mode = 'hd'; f.api.refresh(); f.on(); f.state.mode = 'classic'; f.api.refresh(); f.off(); f.untouched();
});

test('Mobile portrait, hidden, blur and pagehide clear immediately; resume only rereads the current publication', () => {
    const f = fixture(); f.api.init(); f.on();
    f.env.innerWidth = 375; f.env.innerHeight = 667; f.fire('orientationchange'); f.off();
    f.env.innerWidth = 844; f.env.innerHeight = 390; f.fire('resize'); f.on();
    f.fire('blur'); f.off(); assert.equal(f.timers.size, 0); f.api.onEngineTransition(); f.off();
    f.fire('focus'); f.on(); f.document.hidden = true; f.fire('visibilitychange', f.listeners); f.off();
    assert.equal(f.timers.size, 0); f.document.hidden = false; f.fire('visibilitychange', f.listeners); f.on();
    f.fire('pagehide'); f.off(); f.set('active', 0); f.fire('pageshow'); f.off(); f.untouched();
    const pc = fixture({mobile: false}); pc.env.innerWidth = 375; pc.env.innerHeight = 667; pc.api.init(); pc.on();
});

test('Library callbacks and successive native stages clear stale graphics without reusing a frame', () => {
    const f = fixture(); f.api.init(); f.on(); f.identity().status = 'hashing'; f.state.callbacks[0](); f.off();
    f.identity().status = 'ready'; f.set('outcome', 7); f.set('value', 12); f.set('text', '12'); f.set('seq', 20);
    f.state.callbacks[0](); f.on(); assert.equal(f.api.debugSnapshot().seq, 20);
    assert.equal(f.nodes.get('hd-battle-transition-value').textContent, '第 12 天'); f.untouched();
});

for (const microtask of [true, false]) test('Actual legacy bridge supports deferred mode rereads with ' + (microtask ? 'microtasks' : 'timer fallback'), () => {
    const f = fixture({microtask}); f.api.init(); f.on(); f.fire('pointerup'); f.fire('click'); f.fire('keyup');
    assert.equal(microtask ? f.state.microtasks.length : [...f.timers.values()].filter(t => t.ms === 0).length, 1);
    f.state.mode = 'classic'; f.flush(); f.off(); f.state.mode = 'hd'; f.api.onEngineTransition(); f.on();
    f.fire('pointerup'); f.fire('pagehide'); f.flush(); f.off(); f.untouched();
});

test('Publication changes during actual bridge reads and outer reread races are rejected', () => {
    for (const name of ['g_hdBattleNoteSeq', 'g_hdBattleNoteGeneration', 'g_hdBattleNoteOutcome', 'g_hdBattleNoteValue',
        'g_hdDetailGeneration', 'g_hdFightInputSeq', 'g_hdReportSeq']) {
        const f = fixture(), read = f.env.baye.hd.battleNote; let count = 0;
        f.env.baye.hd.battleNote = function () { if (++count === 2) f.raw[name]++; return read.call(this); };
        f.api.init(); f.off(); f.untouched();
    }
    const f = fixture(); let once = false;
    f.state.readHook = key => { if (key === 'g_hdBattleNoteText' && !once) { once = true; f.api.onEngineTransition(); } };
    f.api.init(); f.off(); f.untouched();
});

test('Actual bridge or same-shaped data replacements during a read cannot paint an old source', () => {
    for (const change of [f => { f.env.baye.data = {...f.raw}; }, f => { f.env.baye.hd = {...f.env.baye.hd}; },
        f => { f.env.dynLib = '00'.repeat(original.length); }, f => { f.env.BayeHdBattle = {getMode: () => 'hd'}; }]) {
        const f = fixture(); let once = false;
        f.state.readHook = key => { if (key === 'g_hdBattleNoteText' && !once) { once = true; change(f); } };
        f.api.init(); f.off(); f.untouched();
    }
});

test('Late reference getters must not smuggle a changed publication, mode, owner or library identity', () => {
    for (const change of [f => f.set('value', 2), f => { f.state.mode = 'classic'; },
        f => { f.raw.g_hdReportActive = 1; }, f => { f.identity().sha256 = 'custom'; }]) {
        const f = fixture(), ready = f.env.baye.hd.ready; let count = 0;
        Object.defineProperty(f.env.baye.hd, 'ready', {get() { if (++count === 3) change(f); return ready; }});
        f.api.init(); f.off(); f.untouched();
    }
});

test('Final ready callbacks cannot replace the captured bridge, library, mode or document methods', () => {
    for (const change of [f => { f.env.baye.hd.battleNote = () => null; }, f => { f.env.baye.ensureData = () => f.data; },
        f => { f.env.BayeHdLibIdentity.read = () => f.identity(); }, f => { f.env.BayeHdLibIdentity.isCurrent = () => true; },
        f => { f.env.BayeHdBattle.getMode = () => 'hd'; }, f => { f.env.BayeHdOverworld.getMode = () => 'hd-map'; },
        f => { f.env.document = {...f.document}; }]) {
        const f = fixture(); let count = 0;
        f.env.baye.hd.ready = () => { if (++count === 3) change(f); return true; };
        f.api.init(); f.off(); f.untouched();
    }
});

test('Old note 1..5 and raw ABI work without Value, while transition 6/7 never activate the old note controller', () => {
    for (const outcome of [1, 2, 3, 4, 5]) {
        const f = fixture(); f.set('outcome', outcome); f.set('text', '原生旧公告'); f.set('winner', outcome === 1 ? 0 : 65535);
        delete f.raw.g_hdBattleNoteValue; f.raw.g_hdFightActive = 0;
        vm.runInContext(oldSource, f.env); const old = f.env.BayeHdBattleNote.createController(f.env);
        f.api.init(); old.init(); f.off(); assert.equal(old.debugSnapshot().active, true);
        assert.equal(Object.hasOwn(f.env.baye.hd.battleNote(), 'value'), false); f.untouched();
    }
    for (const outcome of [6, 7]) {
        const f = fixture(); f.set('outcome', outcome); if (outcome === 7) f.set('text', '1');
        vm.runInContext(oldSource, f.env); const old = f.env.BayeHdBattleNote.createController(f.env);
        f.api.init(); old.init(); f.on(); assert.equal(old.debugSnapshot().active, false); f.untouched();
    }
});

test('Missing DOM fails closed, init is idempotent and the poll is bounded and read-only', () => {
    const f = fixture(); f.api.init(); const count = f.windowListeners.get('blur').length;
    f.api.init(); assert.equal(f.windowListeners.get('blur').length, count); assert.equal(f.timers.size, 1);
    assert.equal([...f.timers.values()][0].ms, 80); f.tick(); f.on(); assert.equal(f.timers.size, 1);
    f.nodes.delete('hd-battle-transition-value'); f.api.refresh(); assert.equal(f.api.debugSnapshot().active, false); f.untouched();
});

test('Independent mobile/PC surface keeps hit testing and original duration with no new animation or input', () => {
    assert.match(css, /#hd-battle-transition\s*\{[^}]*z-index:\s*121;[^}]*pointer-events:\s*none;/s);
    assert.match(css, /\.hd-mobile-page #hd-battle-transition\s*\{\s*position:\s*absolute;/);
    assert.match(css, /body\[data-hd-battle-transition="hd"\] #lcd\s*\{\s*opacity:\s*0 !important;/);
    assert.doesNotMatch(css, /(?:animation|transition)\s*:/);
    assert.doesNotMatch(css, /#lcd\s*\{[^}]*(?:visibility|pointer-events|display)\s*:/s);
    assert.doesNotMatch(source, /(?:sendKey|Math\.random|\.click\(|preventDefault|stopPropagation|localStorage\.setItem)/);
});
