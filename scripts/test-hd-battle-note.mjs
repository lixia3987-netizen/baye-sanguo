import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const source = process.env.BAYE_HD_BATTLE_NOTE_SOURCE_BASE64 ?
    Buffer.from(process.env.BAYE_HD_BATTLE_NOTE_SOURCE_BASE64, 'base64').toString('utf8') :
    readFileSync(new URL('../js/hd-battle-note.js', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');
const legacyPromiseStart = bridgeSource.indexOf('    function Promise(fn) {');
const legacyPromiseEnd = bridgeSource.indexOf('    window.Promise = Promise;', legacyPromiseStart);
assert.ok(legacyPromiseStart > 0 && legacyPromiseEnd > legacyPromiseStart, 'Actual bridge Promise definition exists');
const legacyPromiseSource = '(function(){' + bridgeSource.slice(legacyPromiseStart,
    legacyPromiseEnd + '    window.Promise = Promise;'.length) + '})()';
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const originalHex = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url)).toString('hex');
const fields = ['protocolVersion', 'active', 'seq', 'generation', 'outcome', 'winner', 'text'];
const blockers = ['g_hdMenuActive', 'g_hdReportActive', 'g_hdRecordActive', 'g_hdQtyActive',
    'g_hdHelpActive', 'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdMovieActive', 'g_hdSpeActive',
    'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdResultOwnerKind',
    'g_hdResultOwnerValid', 'g_hdMapPick', 'g_hdBattlePick', 'g_hdFightActive'];
const field = name => 'g_hdBattleNote' + name[0].toUpperCase() + name.slice(1);

function fixture({mobile = true, mode = 'auto', map = 'hd-map', microtask = true, legacyPromise = false} = {}) {
    const listeners = new Map(), windowListeners = new Map(), timers = new Map(), nodes = new Map();
    const state = {mode, map, ready: true, reads: 0, readHook: null, identityHook: null, writes: 0, keys: 0, storageWrites: 0, callbacks: [], microtasks: []};
    let identity = {status: 'ready', generation: 3, sha256: SHA, byteLength: 207195};
    function element() { return {hidden: true, textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }}; }
    for (const id of ['hd-battle-note', 'hd-battle-note-text']) nodes.set(id, element());
    const body = {...element(), classList: {contains: name => mobile && name === 'hd-mobile-page'}};
    const document = {body, hidden: false, getElementById: id => nodes.get(id),
        addEventListener(name, fn) { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list); }};
    const raw = Object.fromEntries(blockers.map(name => [name, 0]));
    Object.assign(raw, {g_hdEngineReady: 1, g_hdDetailGeneration: 3, g_hdMenuSeq: 17, g_hdReportSeq: 8,
        g_hdRecordSeq: 2, g_hdMapInputSeq: 4, g_hdFightInputSeq: 9, g_FgtOver: 2});
    const note = {protocolVersion: 1, active: 1, seq: 11, generation: 3, outcome: 1, winner: 0, text: '我军大获全胜'};
    for (const name of fields) raw[field(name)] = note[name];
    const data = new Proxy(raw, {set() { state.writes++; throw Error('Native writes forbidden'); }});
    const baye = {data, ensureData() { return this.data; }, sendKey() { state.keys++; throw Error('No keys'); },
        hd: {ready: () => state.ready, battleNote() { state.reads++; state.readHook?.(state.reads); return {...note}; }}};
    raw.self = data; raw.toJSON = () => { throw Error('Opaque data serialization forbidden'); };
    const environment = {document, innerWidth: 844, innerHeight: 390, baye, Promise, dynLib: originalHex,
        localStorage: {setItem() { state.storageWrites++; throw Error('No preferences'); }},
        BayeHdBattle: {getMode: () => state.mode, shouldShowHd() { throw Error('Cannot depend on active-fight presentation'); }},
        BayeHdOverworld: {getMode: () => state.map},
        BayeHdLibIdentity: {read() { state.identityHook?.(); return identity; },
            isCurrent: value => value.generation === identity.generation && value.sha256 === identity.sha256 && value.status === identity.status,
            subscribe: fn => state.callbacks.push(fn)},
        addEventListener(name, fn) { const list = windowListeners.get(name) || []; list.push(fn); windowListeners.set(name, list); },
        setTimeout(fn, ms) { const id = Math.max(0, ...timers.keys()) + 1; timers.set(id, {fn, ms}); return id; },
        clearTimeout(id) { timers.delete(id); }};
    environment.window = environment;
    if (microtask) environment.queueMicrotask = fn => state.microtasks.push(fn);
    if (legacyPromise) vm.runInNewContext(legacyPromiseSource, environment, {filename: 'actual-bridge-Promise.js'});
    vm.runInNewContext(source, environment, {filename: 'hd-battle-note.js'});
    const api = environment.BayeHdBattleNote.createController(environment);
    function set(name, value) { note[name] = value; raw[field(name)] = value; }
    function fire(name, target = windowListeners) { for (const fn of target.get(name) || []) fn({}); }
    function tick() { const value = timers.entries().next().value; assert.ok(value, 'Controlled poll exists'); timers.delete(value[0]); value[1].fn(); }
    function flushAfterInput() {
        if (microtask) { while (state.microtasks.length) state.microtasks.shift()(); }
        else { for (const [id, item] of [...timers]) if (item.ms === 0) { timers.delete(id); item.fn(); } }
    }
    function off() { const snap = api.debugSnapshot(); assert.equal(snap.active, false); assert.equal(body.attrs['data-hd-battle-note'], 'off');
        assert.equal(nodes.get('hd-battle-note').hidden, true); if (nodes.has('hd-battle-note-text')) assert.equal(nodes.get('hd-battle-note-text').textContent, ''); }
    function on() { const snap = api.debugSnapshot(); assert.equal(snap.active, true); assert.equal(snap.presentation, 'hd');
        assert.equal(nodes.get('hd-battle-note').hidden, false); assert.equal(nodes.get('hd-battle-note-text').textContent, note.text); }
    function noSideEffects() { assert.equal(state.writes, 0); assert.equal(state.keys, 0); assert.equal(state.storageWrites, 0); }
    return {api, state, raw, data, note, set, environment, document, nodes, body, timers, listeners, windowListeners,
        fire, tick, off, on, noSideEffects, flushAfterInput, setIdentity: value => { identity = value; }, identity: () => identity};
}

test('Original LIB fixture is the actual authenticated 207195-byte source', () => {
    const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    assert.equal(lib.length, 207195); assert.equal(createHash('sha256').update(lib).digest('hex'), SHA);
});
test('Only the actual active native WinNote text appears; zero is a valid winner ID', () => {
    const f = fixture(); f.api.init(); f.on(); assert.equal(f.api.debugSnapshot().winner, 0);
    assert.equal(f.raw.g_FgtOver, 2, 'Outcome is not guessed from the retained fight result');
    assert.equal(Object.hasOwn(f.api.debugSnapshot(), 'data'), false); f.noSideEffects();
});
test('Actual LossNote uses the original text and unknown winner sentinel', () => {
    const f = fixture(); f.set('outcome', 2); f.set('winner', 65535); f.set('text', '我军战败');
    f.raw.g_FgtOver = 1; f.api.init(); f.on(); assert.equal(f.api.debugSnapshot().outcome, 2); f.noSideEffects();
});
test('The original delay boundary retires the panel, with no new confirmation', () => {
    const f = fixture(); f.api.init(); f.on(); f.set('active', 0); f.api.onEngineNote(); f.off(); f.noSideEffects();
});
test('Same real active note can be reobserved after a lifecycle boundary; no cached frame is used', () => {
    const f = fixture(); f.api.init(); f.document.hidden = true; f.fire('visibilitychange', f.listeners); f.off();
    f.set('active', 0); f.document.hidden = false; f.fire('visibilitychange', f.listeners); f.off();
    f.set('active', 1); f.set('seq', 12); f.set('text', '当前真实战果'); f.api.onEngineNote(); f.on();
    assert.equal(f.api.debugSnapshot().seq, 12); f.noSideEffects();
});
for (const mobile of [false, true]) {
    test((mobile ? 'Mobile' : 'PC') + ' follows the public battle preference and auto map mode', () => {
        const f = fixture({mobile}); f.api.init(); f.on(); f.state.map = 'classic'; f.api.refresh(); f.off();
        f.state.mode = 'hd'; f.api.refresh(); f.on(); f.state.mode = 'classic'; f.api.refresh(); f.off(); f.noSideEffects();
    });
}
test('PC does not inherit the mobile portrait restriction', () => {
    const f = fixture({mobile: false}); f.environment.innerWidth = 375; f.environment.innerHeight = 667; f.api.init(); f.on();
});
test('Portrait, blur and pagehide synchronously retire without native input', () => {
    const f = fixture(); f.api.init(); f.on();
    f.environment.innerWidth = 375; f.environment.innerHeight = 667; f.fire('orientationchange'); f.off();
    f.environment.innerWidth = 667; f.environment.innerHeight = 375; f.fire('resize'); f.on();
    f.fire('blur'); f.off(); assert.equal(f.timers.size, 0); f.api.onEngineNote(); f.off();
    f.fire('focus'); f.on(); f.fire('pagehide'); f.off(); f.fire('pageshow'); f.on(); f.noSideEffects();
});
test('Mode handlers are observed after their actual trusted UI dispatch, even with document propagation stopped', () => {
    const f = fixture(); f.api.init(); f.on(); f.fire('pointerup'); f.state.mode = 'classic';
    f.flushAfterInput(); f.off(); f.noSideEffects();
});
for (const microtask of [true, false]) {
    test('Actual legacy bridge Promise supports post-handler mode reads through ' + (microtask ? 'queueMicrotask' : 'timer fallback'), () => {
        const f = fixture({microtask, legacyPromise: true});
        assert.equal(typeof f.environment.Promise, 'function'); assert.equal(f.environment.Promise.resolve, undefined);
        f.api.init(); f.on();
        f.document.addEventListener('pointerup', event => { f.state.mode = 'classic'; event.stopImmediatePropagation(); });
        const event = {stopped: false, stopImmediatePropagation() { this.stopped = true; }};
        for (const fn of f.windowListeners.get('pointerup')) fn(event);
        for (const fn of f.listeners.get('pointerup')) { fn(event); if (event.stopped) break; }
        assert.equal(event.stopped, true); f.on(); f.flushAfterInput(); f.off(); f.noSideEffects();
    });
    test('Actual legacy bridge Promise cannot revive an ended or hidden owner from a queued ' + (microtask ? 'microtask' : 'timer'), () => {
        const f = fixture({microtask, legacyPromise: true}); f.api.init(); f.on();
        f.fire('pointerup'); f.fire('click'); f.fire('keyup');
        assert.equal(microtask ? f.state.microtasks.length : [...f.timers.values()].filter(t => t.ms === 0).length, 1, 'One bounded deferred read');
        f.set('active', 0); f.flushAfterInput(); f.off();
        f.set('active', 1); f.api.onEngineNote(); f.on(); f.fire('pointerup');
        f.document.hidden = true; f.fire('visibilitychange', f.listeners); f.flushAfterInput(); f.off(); f.noSideEffects();
    });
}
test('Hidden stops the bounded 80ms poll, and init is idempotent', () => {
    const f = fixture(); f.api.init(); const listeners = f.windowListeners.get('blur').length;
    f.api.init(); assert.equal(f.windowListeners.get('blur').length, listeners); assert.equal(f.timers.size, 1);
    assert.equal([...f.timers.values()][0].ms, 80); f.tick(); f.on(); assert.equal(f.timers.size, 1);
    f.document.hidden = true; f.fire('visibilitychange', f.listeners); f.off(); assert.equal(f.timers.size, 0); f.noSideEffects();
});
for (const blocker of blockers) {
    test('Current ' + blocker + ' keeps its own presentation; a note cannot cover it', () => {
        const f = fixture(); f.api.init(); f.raw[blocker] = 1; f.api.onEngineNote(); f.off(); f.noSideEffects();
    });
}
for (const [name, value] of [['protocolVersion', 0], ['active', 2], ['seq', 0], ['seq', 4294967296],
    ['generation', 0], ['generation', 4], ['outcome', 0], ['outcome', 5], ['winner', 200],
    ['winner', 65535], ['text', ''], ['text', '\u0000旧缓冲'], ['text', 'x'.repeat(513)], ['text', ['fake bytes']]]) {
    test('Invalid or unbound native note is LCD-only: ' + name + '=' + String(value).slice(0, 22), () => {
        const f = fixture(); f.set(name, value); f.api.init(); f.off(); f.noSideEffects();
    });
}
for (const name of fields) {
    test('Public/raw mirror mismatch rejects ' + name, () => {
        const f = fixture(); f.raw[field(name)] = name === 'text' ? '另一真实缓冲' : 123;
        f.api.init(); f.off(); f.noSideEffects();
    });
    test('A changed ' + name + ' between the two native reads cannot paint', () => {
        const f = fixture(); f.state.readHook = reads => { if (reads === 2) f.set(name, name === 'text' ? '半出版新文字' : f.note[name] + 1); };
        f.api.init(); f.off(); f.noSideEffects();
    });
}
test('All remaining raw owners are fenced through the complete second read', () => {
    const f = fixture(); f.state.readHook = reads => { if (reads === 2) f.raw.g_hdMenuSeq++; };
    f.api.init(); f.off(); f.noSideEffects();
});
test('A new opaque data object with identical primitives cannot complete an old read', () => {
    const f = fixture(); f.state.readHook = reads => { if (reads === 2) f.environment.baye.data = {...f.raw}; };
    f.api.init(); f.off(); f.noSideEffects();
});
for (const patch of [{status: 'pending'}, {sha256: 'mod'}, {byteLength: 0}, {generation: 0}]) {
    test('Uncertified actual LIB identity fails closed: ' + JSON.stringify(patch), () => {
        const f = fixture(); f.setIdentity({...f.identity(), ...patch}); f.api.init(); f.off(); f.noSideEffects();
    });
}
test('Library switch during getter and reset generation cannot re-use a note', () => {
    const f = fixture(); f.state.readHook = reads => { if (reads === 2) f.setIdentity({...f.identity(), generation: 4}); };
    f.api.init(); f.off(); f.state.readHook = null; f.api.refresh(); f.on();
    f.raw.g_hdDetailGeneration = 4; f.state.callbacks[0](); f.off();
    f.set('generation', 4); f.set('seq', 13); f.api.onEngineNote(); f.on(); f.noSideEffects();
});
test('Old ABI, unavailable engine, throwing getter and missing DOM preserve native LCD', () => {
    for (const change of [f => { f.environment.baye.hd.battleNote = undefined; }, f => { f.state.ready = false; },
        f => { f.state.readHook = () => { throw Error('native unavailable'); }; }, f => { f.nodes.delete('hd-battle-note-text'); }]) {
        const f = fixture(); change(f); f.api.init(); f.off(); f.noSideEffects();
    }
});
test('A winner cannot be invented for an actual LossNote', () => {
    const f = fixture(); f.set('outcome', 2); f.set('winner', 0); f.api.init(); f.off(); f.noSideEffects();
});

test('PC and mobile present actual attack and confrontation text without inventing a winner, city or names', () => {
    for (const mobile of [false, true]) for (const outcome of [3, 4]) {
        const f = fixture({mobile}); f.set('outcome', outcome); f.set('winner', 65535);
        f.set('text', outcome === 3 ? '我军进攻襄阳' : '曹操与刘备大军交战');
        f.environment.baye.getPersonName = f.environment.baye.getCityName = () => { throw Error('Uncaptured identity lookup'); };
        f.api.init(); f.on(); const value = f.api.debugSnapshot();
        assert.equal(value.outcome, outcome); assert.equal(value.winner, 65535);
        assert.equal(f.nodes.get('hd-battle-note').attrs['data-outcome'], String(outcome));
        assert.equal(Object.hasOwn(value, 'attacker'), false); assert.equal(Object.hasOwn(value, 'city'), false);
        f.set('active', 0); f.api.onEngineNote(); f.off(); f.noSideEffects();
    }
});

test('pre-battle announcement kinds retain the unknown-winner sentinel and reject unknown kinds', () => {
    for (const outcome of [3, 4]) for (const winner of [0, 199, 200, 65534]) {
        const f = fixture(); f.set('outcome', outcome); f.set('winner', winner);
        f.api.init(); f.off(); f.noSideEffects();
    }
    for (const outcome of [0, 5, 255, '3']) {
        const f = fixture(); f.set('outcome', outcome); f.set('winner', 65535);
        f.api.init(); f.off(); f.noSideEffects();
    }
});

test('attack and confrontation announcements defer to current owners, public mode and lifecycle without handling input', () => {
    for (const outcome of [3, 4]) {
        const f = fixture(); f.set('outcome', outcome); f.set('winner', 65535); f.api.init(); f.on();
        for (const blocker of blockers.concat('g_hdCityInfoActive')) {
            f.raw[blocker] = 1; f.api.onEngineNote(); f.off(); f.raw[blocker] = 0; f.api.onEngineNote(); f.on();
        }
        f.state.mode = 'classic'; f.api.refresh(); f.off(); f.state.mode = 'hd'; f.api.refresh(); f.on();
        f.fire('blur'); f.off(); f.set('active', 0); f.fire('focus'); f.off();
        assert.equal(f.listeners.has('keydown'), false); assert.equal(f.windowListeners.has('keydown'), false);
        f.noSideEffects();
    }
});

test('last mode callback cannot publish an old announcement after source, field, provider or API changes', () => {
    for (const change of [
        f => f.set('text', 'later native text'), f => { f.raw.g_hdReportActive = 1; },
        f => { f.environment.baye.data = {...f.raw}; }, f => { f.environment.baye = {...f.environment.baye}; },
        f => { f.environment.baye.hd = {...f.environment.baye.hd}; },
        f => { f.environment.baye.hd.battleNote = () => ({...f.note}); },
        f => { f.environment.baye.hd.ready = () => true; },
        f => { f.environment.baye.ensureData = () => f.data; },
        f => { f.environment.BayeHdLibIdentity = {...f.environment.BayeHdLibIdentity}; },
        f => { f.environment.BayeHdLibIdentity.read = () => f.identity(); },
        f => { f.environment.BayeHdLibIdentity.isCurrent = () => true; },
        f => { f.environment.dynLib = '0'.repeat(414390); },
        f => { f.identity().generation++; }, f => { f.environment.BayeHdBattle = {...f.environment.BayeHdBattle}; },
        f => { f.environment.BayeHdOverworld = {...f.environment.BayeHdOverworld}; }
    ]) {
        const f = fixture(); f.set('outcome', 3); f.set('winner', 65535); let calls = 0;
        f.environment.BayeHdBattle.getMode = () => { if (++calls === 2) change(f); return f.state.mode; };
        f.api.init(); f.off(); f.noSideEffects();
    }
});

test('identity callback reentry retires the outer announcement read and may later observe the still-current notice', () => {
    const f = fixture(); f.set('outcome', 4); f.set('winner', 65535); let once = false;
    f.state.identityHook = () => { if (!once) { once = true; f.api.onEngineNote(); } };
    f.api.init(); f.off(); f.state.identityHook = null; f.api.refresh(); f.on(); f.noSideEffects();
    for (const source of [undefined, null, '', '0'.repeat(414388), new Uint8Array(207195)]) {
        f.environment.dynLib = source; f.api.refresh(); f.off(); f.noSideEffects();
    }
});

test('last provider-reference getters cannot paint a stale announcement after changing the publication or source', () => {
    for (const [target, name, finalRead] of [
        ['hd', 'ready', 3], ['hd', 'battleNote', 3], ['baye', 'ensureData', 2],
        ['identity', 'read', 3], ['identity', 'isCurrent', 3], ['battle', 'getMode', 4], ['map', 'getMode', 2]
    ]) {
        const f = fixture({mode: 'hd'}); f.set('outcome', 3); f.set('winner', 65535); f.set('text', 'OLD ATTACK');
        const object = {hd: f.environment.baye.hd, baye: f.environment.baye, identity: f.environment.BayeHdLibIdentity,
            battle: f.environment.BayeHdBattle, map: f.environment.BayeHdOverworld}[target], original = object[name];
        let reads = 0;
        Object.defineProperty(object, name, {configurable: true, get() {
            if (++reads === finalRead) f.set('text', 'NEW NATIVE ATTACK');
            return original;
        }});
        f.api.init(); assert.ok(reads >= finalRead, target + '.' + name + ' reaches its final reference getter');
        assert.equal(f.note.text, 'NEW NATIVE ATTACK'); f.off(); f.noSideEffects();
        Object.defineProperty(object, name, {value: original, configurable: true, writable: true});
        f.api.refresh(); f.on(); f.noSideEffects();
    }
    for (const change of [f => { f.environment.baye.data = {...f.raw}; },
        f => { f.environment.dynLib = '0'.repeat(414390); }, f => { f.identity().generation++; },
        f => { f.state.mode = 'classic'; }, f => { f.state.map = 'classic'; },
        f => { f.document.hidden = true; }, f => { f.state.ready = false; }]) {
        const f = fixture(); f.set('outcome', 4); f.set('winner', 65535);
        const ready = f.environment.baye.hd.ready; let reads = 0;
        Object.defineProperty(f.environment.baye.hd, 'ready', {get() { if (++reads === 3) change(f); return ready; }});
        f.api.init(); assert.equal(reads, 3); f.off(); f.noSideEffects();
    }
});
test('The lightweight output contains no input handlers or generated winner/name text', () => {
    assert.doesNotMatch(source, /sendKey|dispatchEvent|localStorage|storage\.set|\.value\s*=/);
    assert.doesNotMatch(source, /getPersonName|g_FgtOver|fight\.over/);
});
test('The panel preserves native LCD hit testing and the original delay input contract', () => {
    const css = readFileSync(new URL('../css/hd-battle-note.css', import.meta.url), 'utf8');
    assert.match(css, /#hd-battle-note\s*\{[^}]*pointer-events:\s*none/s);
    const canvasRules = [...css.matchAll(/[^{}]*#lcd\s*\{([^}]*)\}/g)].map(match => match[1]);
    assert.ok(canvasRules.some(rule => /opacity:\s*0/.test(rule)), 'Only native pixels are hidden behind the HD panel');
    for (const rule of canvasRules) assert.doesNotMatch(rule, /visibility|display|pointer-events|width|height|position/);
});
