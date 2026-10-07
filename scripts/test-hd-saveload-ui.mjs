import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const VK = { UP: 0x22, DOWN: 0x23, ENTER: 0x27, EXIT: 0x28 };
const source = readFileSync(new URL('../js/hd-system-ui.js', import.meta.url), 'utf8');
const storageSource = readFileSync(new URL('../js/save-storage.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');

// Execute the real module with its actual click, pointer and keyboard handlers.
// Native selector fields change only when the simulated engine acknowledges a
// key; the module cannot advance them or modify the campaign data.
function harness({ mode = 2, status = {}, native = 'record', acknowledge = true, kingCount = 4 } = {}) {
    class Node {
        constructor(tag = 'div') {
            this.tagName = tag.toUpperCase(); this.className = ''; this.attributes = {};
            this.children = []; this.listeners = new Map(); this.textContent = ''; this.disabled = false;
            this.classList = {
                contains: value => this.className.split(/\s+/).includes(value),
                add: value => { if (!this.classList.contains(value)) this.className += ' ' + value; },
                toggle: (value, force) => {
                    const on = force ?? !this.classList.contains(value);
                    this.className = this.className.split(/\s+/).filter(x => x && x !== value).join(' ');
                    if (on) this.classList.add(value);
                }
            };
        }
        set innerHTML(value) { this.children = []; this.html = value; }
        get innerHTML() { return this.html || ''; }
        setAttribute(key, value) { this.attributes[key] = String(value); }
        getAttribute(key) { return this.attributes[key] ?? null; }
        appendChild(child) { child.parentNode = this; child.parentElement = this; this.children.push(child); }
        querySelector(selector) { return this.children.find(n => selector.split('.').slice(1).every(c => n.classList.contains(c))) || null; }
        querySelectorAll() { return []; }
        addEventListener(type, listener) { this.listeners.set(type, listener); }
        scrollIntoView() {}
    }
    const ids = new Map(['hd-system-ui', 'hd-system-ui-list', 'hd-system-ui-title',
        'hd-system-ui-sub', 'hd-system-ui-probe'].map(id => [id, new Node()]));
    const root = ids.get('hd-system-ui'), list = ids.get('hd-system-ui-list'); root.appendChild(list);
    const body = new Node('body'), html = new Node('html'), documentListeners = new Map();
    const document = { body, documentElement: html, getElementById: id => ids.get(id) || null,
        createElement: tag => new Node(tag), addEventListener: (type, fn) => documentListeners.set(type, fn) };
    let clock = 0, timerId = 0, afterKey;
    const timers = new Map(), intervals = [], sent = [];
    const storage = { 'baye/systemUiMode': 'hd', 'baye/overworldMode': 'hd-map',
        getItem(key) { return this[key] ?? null; }, setItem(key, value) { this[key] = String(value); } };
    const record = { active: native === 'record' ? 1 : 0, mode, index: 0, count: mode === 1 ? 3 : 4, seq: 12 };
    const kingEntries = [{ id: 0, name: '董卓' }, { id: 1, name: '曹操' },
        { id: 2, name: '袁绍' }, { id: 5, name: '马腾' }];
    while (kingEntries.length < kingCount) kingEntries.push({ id: kingEntries.length + 10, name: '势力' + kingEntries.length });
    const kings = { count: kingEntries.length, index: 0, currentId: 0, kings: kingEntries };
    const menu = { active: ['title', 'period', 'king', 'function'].includes(native) ? 1 : 0,
        context: native === 'function' ? 2 : 4, kind: native === 'king' ? 3 : native === 'period' ? 2 : 1,
        seq: 90, index: 0, count: native === 'function' ? 3 : native === 'king' ? kingEntries.length : 4,
        names: native === 'function' ? ['策略结束', '存储进度', '结束游戏']
            : native === 'king' ? kingEntries.map(king => king.name) : [] };
    const slots = Array.from({ length: 4 }, (_, slot) => ({ slot, status: 'empty', canLoad: false, bytes: 0, ...status[slot] }));
    const data = { g_PlayerKing: native === 'title' ? 0 : 12,
        g_Cities: [{ Belong: native === 'title' ? 0 : 13 }], g_Persons: [], g_hdFightActive: 0, g_hdFightOver: 0 };
    const worldBefore = JSON.stringify(data);
    const fight = { active: 0, over: 0 };
    const context = vm.createContext({ document, localStorage: storage, console: { log() {}, warn() {} },
        Date: class extends Date { static now() { return clock; } },
        setTimeout(fn, delay = 0) { const id = ++timerId; timers.set(id, { fn, at: clock + delay }); return id; },
        clearTimeout(id) { timers.delete(id); }, setInterval(fn) { intervals.push(fn); return intervals.length; },
        BayeSaveStorage: { slots: () => slots.map(s => ({ ...s })), inspectSlot: slot => ({ ...slots[slot] }) },
        BayeHdOverworld: { getMode: () => storage['baye/overworldMode'] },
        bayeInputIgnored: e => !!e.defaultPrevented || !!e.isComposing,
        bayeConsumeKeyEvent(e) { e.preventDefault(); e.stopPropagation(); },
        sendKey(key) {
            sent.push(key);
            const owner = record.active ? record : menu.active ? menu : null;
            if (acknowledge && owner) {
                if (key === VK.UP) owner.index = (owner.index - 1 + owner.count) % owner.count;
                if (key === VK.DOWN) owner.index = (owner.index + 1) % owner.count;
                if (owner === menu && menu.context === 4 && menu.kind === 3) {
                    kings.index = menu.index; kings.currentId = kingEntries[menu.index].id;
                }
            }
            afterKey?.(key);
        },
        baye: { data, ensureData: () => data, getPersonNameByID: id => id === 13 ? '曹操' : '',
            hd: { ready: () => true, record: () => record, menuItems: () => menu,
                fight: () => fight, kings: () => kings, march: () => ({ pick: 0 }), reportText: () => '' } }
    });
    context.window = context;
    vm.runInContext(source, context, { filename: 'js/hd-system-ui.js' });
    const api = context.BayeHdSystemUi;
    function tick(ms = 10000) {
        const end = clock + ms; let loops = 0;
        while (timers.size) {
            const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (timer.at > end) break;
            assert.ok(++loops < 1000, 'selector input work must terminate');
            timers.delete(id); clock = timer.at; timer.fn();
        }
        clock = end;
    }
    function event(target) { return { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } }; }
    function button(slot) { return list.children.find(node => node.getAttribute('data-hd-sys') === String(slot)); }
    function click(slot, target = button(slot)) { assert.ok(target, 'rendered slot exists'); root.listeners.get('click')(event(target)); }
    function refresh() { api.onEngineHook('onMenuIdle', { index: record.active ? record.index : menu.index }); }
    api.start(); tick(350);
    return { api, record, menu, kings, slots, data, storage, context, root, list, ids, sent, timers, fight,
        click, button, refresh, tick, setAfterKey(fn) { afterKey = fn; },
        poll() { intervals.forEach(fn => fn()); },
        pointer(slot) { root.listeners.get('pointerdown')(event(button(slot))); },
        back() { const node = new Node('button'); node.setAttribute('data-hd-sys-back', ''); root.appendChild(node); root.listeners.get('click')(event(node)); },
        key(keyCode, extra = {}) { const e = { ...event(body), keyCode, ...extra }; documentListeners.get('keydown')?.(e); return e; },
        assertWorldUnchanged() { assert.equal(JSON.stringify(data), worldBefore); }
    };
}

let count = 0;
function test(name, run) { run(); console.log(`ok ${++count} - ${name}`); }

test('empty native saving exposes exactly three usable real slots', () => {
    const h = harness({ mode: 1 });
    assert.equal(h.api.getScreen(), 'saveload'); assert.equal(h.list.children.length, 3);
    assert.ok(h.list.children.every(button => !button.disabled));
    h.click(0); h.click(0); h.tick(); assert.deepEqual(h.sent, [VK.ENTER]); h.assertWorldUnchanged();
});
test('loading preserves four real slots and disables empty entries', () => {
    const h = harness(); assert.equal(h.list.children.length, 4);
    assert.ok(h.list.children.every(button => button.disabled));
    h.click(0); h.key(13); h.refresh(); h.tick(); assert.deepEqual(h.sent, []);
});
test('sparse slot two sends two acknowledged moves and one Enter', () => {
    const h = harness({ status: { 2: { status: 'ready', canLoad: true, year: 189, king: 12 } } });
    assert.match(h.button(2).textContent, /存档 3.*曹操.*189/);
    h.click(2); assert.deepEqual(h.sent, [VK.DOWN]);
    h.tick(40); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN]);
    h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
    assert.equal(h.record.index, 2); h.assertWorldUnchanged();
});
test('fourth legacy load slot retains native index three', () => {
    const h = harness({ status: { 3: { status: 'ready', canLoad: true } } });
    h.click(3); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER]);
});
test('a save from another period shows its own period instead of current person names', () => {
    const h = harness({ status: { 0: { status: 'ready', canLoad: true, period: 1, king: 12, year: 189 } } });
    h.data.g_PIdx = 2; h.refresh();
    assert.match(h.button(0).textContent, /董卓弄权.*189/); assert.doesNotMatch(h.button(0).textContent, /曹操/);
    assert.equal(h.data.g_PIdx, 2); assert.deepEqual(h.sent, []);
});
test('wrong LIB, incomplete and invalid saves cannot send a confirmation', () => {
    for (const status of ['wrong-lib', 'incomplete', 'invalid']) {
        const h = harness({ status: { 0: { status, canLoad: false, error: '存档无法读取' } } });
        h.click(0); const e = h.key(13); assert.equal(e.defaultPrevented, true);
        h.tick(); assert.deepEqual(h.sent, []); assert.equal(h.button(0).disabled, true);
    }
});
test('changing storage or polling never loads a newly available slot', () => {
    const h = harness(); h.slots[1] = { slot: 1, status: 'ready', canLoad: true };
    h.refresh(); h.refresh(); h.tick(); assert.equal(h.button(1).disabled, false); assert.deepEqual(h.sent, []);
});
test('storage is rechecked when a previously rendered load button is clicked', () => {
    const h = harness({ status: { 0: { status: 'ready', canLoad: true } } });
    h.slots[0] = { slot: 0, status: 'wrong-lib', canLoad: false };
    h.click(0); h.tick(); assert.deepEqual(h.sent, []); assert.equal(h.button(0).disabled, true);
});
test('removing a save during cursor navigation prevents the final Enter', () => {
    const h = harness({ status: { 2: { status: 'ready', canLoad: true } } });
    h.click(2); h.slots[2] = { slot: 2, status: 'empty', canLoad: false };
    h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN]); assert.equal(h.button(2).disabled, true);
});
test('a missing index ACK times out without retrying or confirming', () => {
    const h = harness({ mode: 1, acknowledge: false }); h.click(2); h.tick(10000);
    assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(h.api.debugSnapshot().pending, false);
    assert.match(h.api.debugSnapshot().hint, /尚未确认/); h.click(2); h.tick(); assert.deepEqual(h.sent, [VK.DOWN]);
});
test('native owner changes invalidate an unfinished selection', () => {
    const h = harness({ mode: 1, acknowledge: false }); h.click(2);
    h.record.seq++; h.record.index = 2; h.refresh(); h.tick(); assert.deepEqual(h.sent, [VK.DOWN]);
});
test('new input sequence after failed load permits only a new player confirmation', () => {
    const h = harness({ status: { 0: { status: 'ready', canLoad: true } } });
    h.click(0); h.record.active = 0; h.refresh(); h.record.active = 1; h.record.seq++; h.refresh(); h.tick();
    assert.deepEqual(h.sent, [VK.ENTER]); h.click(0); h.tick(); assert.deepEqual(h.sent, [VK.ENTER, VK.ENTER]);
});
test('failed native saving retains the storage error without retrying automatically', () => {
    const h = harness({ mode: 1 }); h.click(0); h.record.seq++;
    h.context.BayeSaveStorage.lastError = () => ({ code: 'storage', message: '存储空间不足或不可写，原存档已保留。' });
    h.refresh(); h.tick(); assert.match(h.ids.get('hd-system-ui-sub').textContent, /原存档已保留/);
    assert.deepEqual(h.sent, [VK.ENTER]);
});
test('input sequence wrapping remains a fresh native owner', () => {
    const h = harness({ mode: 1 }); h.record.seq = 0xffffffff; h.refresh(); h.click(0);
    h.record.seq = 1; h.refresh(); h.click(0); assert.deepEqual(h.sent, [VK.ENTER, VK.ENTER]);
});
test('mode switch cancels already scheduled selection without leaking Enter', () => {
    const h = harness({ mode: 1 }); h.click(2); const callbacks = [...h.timers.values()].map(timer => timer.fn);
    h.api.setMode('classic'); callbacks.forEach(fn => fn()); h.tick();
    assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(h.api.isOpen(), false);
    assert.equal(h.ids.get('hd-system-ui').getAttribute('aria-hidden'), 'true');
    h.api.setMode('hd'); h.tick(); assert.deepEqual(h.sent, [VK.DOWN]);
});
test('auto preference obeys an overworld switch before queued input executes', () => {
    const h = harness({ mode: 1 }); h.api.setMode('auto'); h.click(2);
    h.storage['baye/overworldMode'] = 'classic'; h.tick(); assert.deepEqual(h.sent, [VK.DOWN]);
});
test('return exits the record input once and follows native load return to title', () => {
    const h = harness(); h.data.g_PlayerKing = 0; h.data.g_Cities[0].Belong = 0;
    h.setAfterKey(key => { if (key === VK.EXIT) { h.record.active = 0; h.menu.active = 1; h.menu.context = 4; h.menu.count = 4; } });
    h.back(); assert.equal(h.api.getScreen(), 'title'); assert.deepEqual(h.sent, [VK.EXIT]);
});
test('cancelled native saving returns to map and restores classic visibility', () => {
    const h = harness({ mode: 1 });
    h.setAfterKey(key => { if (key === VK.EXIT) h.record.active = 0; });
    h.back(); h.back(); h.tick(); assert.deepEqual(h.sent, [VK.EXIT]); assert.equal(h.api.isOpen(), false);
    assert.equal(h.context.document.documentElement.getAttribute('data-baye-system-ui'), 'off');
});
test('saving completion follows native map return without sending another key', () => {
    const h = harness({ mode: 1 }); h.click(0); h.record.active = 0; h.refresh(); h.tick();
    assert.equal(h.api.isOpen(), false); assert.deepEqual(h.sent, [VK.ENTER]);
});
test('held or repeated keyboard input cannot duplicate a native confirmation', () => {
    const h = harness({ mode: 1 }); h.key(13); h.key(13); h.key(13, { repeat: true }); h.tick();
    assert.deepEqual(h.sent, [VK.ENTER]);
});
test('a stale pointerdown cannot confirm a refreshed native selector', () => {
    const h = harness({ mode: 1 }); h.pointer(0); h.record.seq++; h.refresh(); h.click(0); h.tick();
    assert.deepEqual(h.sent, []); h.click(0); assert.deepEqual(h.sent, [VK.ENTER]);
});
test('title loading entry waits for native index ACK and actual record opening', () => {
    const h = harness({ native: 'title', acknowledge: false }); h.click(1);
    assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(h.api.getScreen(), 'title');
    h.menu.index = 1; h.tick(40); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]);
    assert.equal(h.api.getScreen(), 'title'); h.menu.active = 0; h.record.active = 1; h.refresh();
    assert.equal(h.api.getScreen(), 'saveload'); assert.equal(h.api.debugSnapshot().recordMode, 2);
});
test('function saving entry waits for native owner then opens only save slots', () => {
    const h = harness({ native: 'function', mode: 1 }); h.click(1); h.tick();
    assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]); assert.equal(h.api.getScreen(), 'insystem');
    h.menu.active = 0; h.record.active = 1; h.refresh(); assert.equal(h.list.children.length, 3);
    assert.equal(h.api.debugSnapshot().recordSource, 'insystem');
});
test('stale native menu bytes cannot masquerade as an active system selector', () => {
    const h = harness({ native: 'none' }); assert.equal(h.api.isOpen(), false);
    assert.equal(h.api.openInsystem(), false); assert.equal(h.api.confirmStrategyEnd(), false); assert.deepEqual(h.sent, []);
});
test('battle ownership blocks record input and strategy entry', () => {
    const h = harness({ mode: 1 }); h.fight.active = 1; h.refresh(); h.click(0); h.tick();
    assert.equal(h.api.isOpen(), false); assert.deepEqual(h.sent, []);
});
test('real storage inspector drives paired legacy sparse and wrong LIB rows', () => {
    const h = harness();
    const first = Buffer.alloc(16 + 21 + 4000 + 1 + 4), second = Buffer.alloc(30 + 600 + 200 * 14 + 4 + 37);
    first[0] = 0x95; first[1] = 1; first.writeUInt16LE(1, 2); first.writeUInt16LE(189, 6); first[11] = 1;
    h.storage['baye/libpath'] = '/same.lib'; h.context.dynLib = 'aabbcc';
    h.storage['baye//data//sango4.sav'] = first.toString('hex');
    h.storage['baye//data//sango5.sav'] = second.toString('hex');
    h.storage['baye//data//sango4.sav.lib'] = '/same.lib';
    h.storage['baye//data//sango5.sav.lib'] = '/same.lib';
    h.data.g_engineConfig = { citiesCount: 1 };
    vm.runInContext(storageSource, h.context, { filename: 'js/save-storage.js' }); h.refresh();
    assert.equal(h.button(0).disabled, true); assert.equal(h.button(2).disabled, false);
    h.click(2); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
    h.record.seq++; h.storage['baye/libpath'] = '/other.lib'; h.refresh();
    assert.equal(h.button(2).disabled, true); assert.match(h.button(2).textContent, /其他版本/);
    h.click(2); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
});
test('actual bridge wrapped record fields and textless picture menu drive the UI', () => {
    const h = harness({ status: { 2: { status: 'ready', canLoad: true } } });
    const numberReader = bridge.slice(bridge.indexOf('    function hdReadNum('), bridge.indexOf('    function hdDecodePtr('));
    const recordMethod = bridge.slice(bridge.indexOf('        record: function () {'), bridge.indexOf('        kings: function () {'));
    const menuMethod = bridge.slice(bridge.indexOf('        menuItems: function () {'), bridge.lastIndexOf('\n    };'));
    h.context.hdNote = () => {};
    vm.runInContext(numberReader + '\nObject.assign(baye.hd, {' + recordMethod + menuMethod + '});', h.context,
        { filename: 'actual js/bridge.js record and menu methods' });
    for (const [key, value] of Object.entries({ g_hdRecordActive: 1, g_hdRecordMode: 2,
        g_hdRecordIndex: 0, g_hdRecordCount: 4, g_hdRecordSeq: 101,
        g_hdMenuActive: 0, g_hdMenuContext: 4, g_hdMenuKind: 1, g_hdMenuSeq: 202,
        g_hdMenuItemLen: 0, g_hdMenuCount: 4, g_hdMenuIndex: 0 })) h.data[key] = { value };
    h.data.g_hdMenuGbk = '';
    h.setAfterKey(key => {
        const index = h.data.g_hdRecordActive.value ? h.data.g_hdRecordIndex : h.data.g_hdMenuIndex;
        if (key === VK.UP) index.value--;
        if (key === VK.DOWN) index.value++;
    });
    h.refresh(); h.click(2); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
    assert.equal(h.api.debugSnapshot().recordMode, 2); assert.equal(h.api.debugSnapshot().input.count, 4);
    h.data.g_hdRecordActive.value = 0; h.data.g_hdMenuActive.value = 1; h.refresh();
    assert.equal(h.api.getScreen(), 'title'); assert.equal(h.api.debugSnapshot().input.count, 4);
    h.click(1); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER, VK.DOWN, VK.ENTER]);
});
test('native king input wins over an old campaign ruler and city ownership', () => {
    const h = harness({ native: 'king' });
    assert.equal(h.data.g_PlayerKing, 12); assert.equal(h.data.g_Cities[0].Belong, 13);
    assert.equal(h.api.isOpen(), true); assert.equal(h.api.getScreen(), 'king');
    assert.equal(h.list.children.length, h.menu.count); assert.match(h.button(3).textContent, /马腾/);
    h.click(3); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER]);
    h.assertWorldUnchanged();
});
test('polling reopens the second native king selector after a closed period screen', () => {
    const h = harness({ native: 'period' }); h.click(0);
    h.menu.active = 0; h.menu.seq++; h.poll(); assert.equal(h.api.isOpen(), false);
    h.menu.active = 1; h.menu.kind = 3; h.menu.seq++; h.menu.names = h.kings.kings.map(king => king.name);
    h.poll(); assert.equal(h.api.isOpen(), true); assert.equal(h.api.getScreen(), 'king');
    assert.deepEqual(h.sent, [VK.ENTER]);
});
test('the king controller waits for index ACK and confirms once through keys and clicks', () => {
    const h = harness({ native: 'king', acknowledge: false }); h.click(2);
    assert.deepEqual(h.sent, [VK.DOWN]); h.tick(1000); assert.deepEqual(h.sent, [VK.DOWN]);
    h.menu.index = 1; h.tick(40); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN]);
    h.menu.index = 2; h.tick(40); h.click(2); h.key(13); h.key(13, { repeat: true });
    assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
});
test('a real eighteen-lord selector can progress longer than five seconds and confirm once', () => {
    const h = harness({ native: 'king', acknowledge: false, kingCount: 18 }); h.click(8);
    for (let index = 1; index <= 8; index++) {
        h.tick(960); assert.deepEqual(h.sent, Array(index).fill(VK.DOWN), 'no next key before this item ACK');
        h.menu.index = index; h.tick(40);
    }
    h.tick(); assert.deepEqual(h.sent, [...Array(8).fill(VK.DOWN), VK.ENTER]);
    assert.equal(h.api.debugSnapshot().pending, false); assert.equal(h.api.debugSnapshot().hint, ''); h.assertWorldUnchanged();
});
test('one received menu ACK renews the five-second budget but a later stall times out', () => {
    const h = harness({ native: 'king', acknowledge: false, kingCount: 18 }); h.click(8);
    h.tick(3960); h.menu.index = 1; h.tick(40); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN]);
    h.tick(4000); assert.equal(h.api.debugSnapshot().pending, true, 'the full operation is past five seconds but this step is not');
    h.tick(1040); assert.equal(h.api.debugSnapshot().pending, false); assert.match(h.api.debugSnapshot().hint, /尚未确认/);
    h.click(8); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN]);
});
test('continuously acknowledged moves still stop at the sixty-second total limit', () => {
    const h = harness({ native: 'king', acknowledge: false, kingCount: 18 }); h.click(17);
    for (let index = 1; index <= 17; index++) {
        h.tick(3960); h.menu.index = index; h.tick(40);
    }
    assert.equal(h.api.debugSnapshot().pending, false); assert.match(h.api.debugSnapshot().hint, /等待过久/);
    assert.deepEqual(h.sent, Array(16).fill(VK.DOWN)); h.click(17); h.tick();
    assert.deepEqual(h.sent, Array(16).fill(VK.DOWN), 'a timed-out request never confirms or retries itself');
});
test('cancelling a slowly progressing king request retires already scheduled callbacks', () => {
    const h = harness({ native: 'king', acknowledge: false, kingCount: 18 }); h.click(8);
    for (let index = 1; index <= 6; index++) { h.tick(960); h.menu.index = index; h.tick(40); }
    const pendingCallbacks = [...h.timers.values()].map(timer => timer.fn);
    h.setAfterKey(key => { if (key === VK.EXIT) { h.menu.active = 0; h.menu.seq++; } });
    h.back(); pendingCallbacks.forEach(fn => fn()); h.tick();
    assert.deepEqual(h.sent, [...Array(7).fill(VK.DOWN), VK.EXIT]); assert.equal(h.api.isOpen(), false);
});
test('a slowly progressing request and stale pointer cannot enter a new king input token', () => {
    const h = harness({ native: 'king', acknowledge: false, kingCount: 18 }); h.click(8);
    for (let index = 1; index <= 6; index++) { h.tick(960); h.menu.index = index; h.tick(40); }
    h.pointer(8); h.menu.seq++; h.menu.index = 8; h.poll(); h.click(8); h.tick();
    assert.deepEqual(h.sent, Array(7).fill(VK.DOWN)); h.click(8);
    assert.deepEqual(h.sent, [...Array(7).fill(VK.DOWN), VK.ENTER], 'only a new explicit click owns the new selector');
});
test('stale king pointer and outstanding navigation never enter a newer selector', () => {
    const h = harness({ native: 'king', acknowledge: false }); h.pointer(2); h.menu.seq++; h.poll();
    h.click(2); assert.deepEqual(h.sent, []);
    h.click(2); assert.deepEqual(h.sent, [VK.DOWN]); h.menu.seq++; h.poll(); h.menu.index = 2; h.tick();
    assert.deepEqual(h.sent, [VK.DOWN]);
});
test('inactive historic king names cannot reopen a completed native ruler selection', () => {
    const h = harness({ native: 'king' }); h.click(0);
    h.data.g_PlayerKing = 0; h.menu.active = 0; h.menu.seq++; h.api.onEngineHook('didOpenNewGame');
    h.poll(); h.poll(); assert.equal(h.api.isOpen(), false); assert.deepEqual(h.sent, [VK.ENTER]);
});
test('an old native king button cannot fall back to raw keys after input ends before polling', () => {
    const h = harness({ native: 'king' }); const oldButton = h.button(1);
    h.menu.active = 0; h.menu.seq++;
    assert.equal(h.api.isOpen(), true); assert.equal(h.api.getScreen(), 'king');
    h.click(1, oldButton); h.back(); h.tick(); assert.deepEqual(h.sent, []);
});
test('old king keyboard events remain consumed after native input ends before polling', () => {
    const h = harness({ native: 'king' }); h.menu.active = 0; h.menu.seq++;
    for (const keyCode of [13, 27, 32, 38, 40]) {
        const event = h.key(keyCode); assert.equal(event.defaultPrevented, true); assert.equal(event.stopped, true);
    }
    h.tick(); assert.deepEqual(h.sent, []);
});
test('cancelling the native king picker returns to the actual title once', () => {
    const h = harness({ native: 'king' });
    h.setAfterKey(key => { if (key === VK.EXIT) { h.menu.kind = 1; h.menu.seq += 2; } });
    h.back(); assert.equal(h.api.getScreen(), 'title'); assert.deepEqual(h.sent, [VK.EXIT]);
});
test('old runtimes retain their classic king selector without fabricated native ownership', () => {
    const h = harness({ native: 'none' }); h.data.g_PlayerKing = 0; h.refresh();
    assert.equal(h.api.getScreen(), 'king'); assert.equal(h.api.debugSnapshot().input, null);
    h.click(1); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]);
});

console.log(`${count} HD save/load UI regressions passed`);
