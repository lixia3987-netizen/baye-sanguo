import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const VK = { UP: 0x22, DOWN: 0x23, ENTER: 0x27, EXIT: 0x28 };
const source = readFileSync(process.env.BAYE_SYSTEM_UI_SOURCE || new URL('../js/hd-system-ui.js', import.meta.url), 'utf8');
const storageSource = readFileSync(new URL('../js/save-storage.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');

// Execute the real module with its actual click, pointer and keyboard handlers.
// Native selector fields change only when the simulated engine acknowledges a
// key; the module cannot advance them or modify the campaign data.
function harness({ mode = 2, status = {}, native = 'record', acknowledge = true, kingCount = 4, preview = false, configure } = {}) {
    let scrollCalls = 0;
    class Node {
        constructor(tag = 'div') {
            this.tagName = tag.toUpperCase(); this.className = ''; this.attributes = {};
            this.children = []; this.listeners = new Map(); this.textContent = ''; this.disabled = false;
            this.scrollTop = 0;
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
        set innerHTML(value) {
            this.children.forEach(child => { child.parentNode = null; child.parentElement = null; });
            this.children = []; this.html = value; this.scrollTop = 0;
        }
        get innerHTML() { return this.html || ''; }
        setAttribute(key, value) { this.attributes[key] = String(value); }
        getAttribute(key) { return this.attributes[key] ?? null; }
        removeAttribute(key) { delete this.attributes[key]; }
        appendChild(child) { child.parentNode = this; child.parentElement = this; this.children.push(child); }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        querySelectorAll(selector) {
            const match = n => selector.startsWith('.') ? selector.slice(1).split('.').every(c => n.classList.contains(c))
                : /^\[([^\]=]+)\]$/.test(selector) ? n.getAttribute(selector.slice(1, -1)) !== null : false;
            const found = []; const walk = n => { for (const child of n.children) { if (match(child)) found.push(child); walk(child); } }; walk(this); return found;
        }
        addEventListener(type, listener) { this.listeners.set(type, listener); }
        scrollIntoView() { scrollCalls++; }
    }
    const ids = new Map(['hd-system-ui', 'hd-system-ui-list', 'hd-system-ui-title',
        'hd-system-ui-sub', 'hd-system-ui-probe'].map(id => [id, new Node()]));
    const root = ids.get('hd-system-ui'); let list = ids.get('hd-system-ui-list'); root.appendChild(list);
    const body = new Node('body'), html = new Node('html'), documentListeners = new Map();
    const document = { body, documentElement: html, getElementById: id => ids.get(id) || null,
        createElement: tag => new Node(tag), createElementNS: (ns, tag) => new Node(tag), addEventListener: (type, fn) => documentListeners.set(type, fn) };
    let previewDom = null;
    if (preview) {
        const panel = new Node('section'); panel.hidden = true; panel.setAttribute('data-ready', 'false'); ids.set('hd-system-king-preview', panel); root.appendChild(panel);
        const part = (tag, attr) => { const n = new Node(tag); n.setAttribute(attr, ''); panel.appendChild(n); return n; };
        const summary = part('h2', 'data-hd-king-summary'), cities = part('ul', 'data-hd-king-cities'),
            map = part('svg', 'data-hd-king-map'), note = part('p', 'data-hd-king-note');
        map.setAttribute('hidden', '');
        const start = new Node('button'); start.setAttribute('data-hd-sys-start', ''); start.hidden = true; root.appendChild(start);
        const lcd = new Node('button'); lcd.setAttribute('data-hd-sys-lcd', ''); root.appendChild(lcd);
        previewDom = {panel, summary, cities, map, note, start, lcd};
    }
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
        g_Cities: [{ Belong: native === 'title' ? 0 : 13 }], g_Persons: [], g_hdFightActive: 0, g_hdFightOver: 0,
        g_hdDetailGeneration: 1, g_hdSpeGeneration: 1 };
    const identity = {status: 'ready', sha256: '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e', byteLength: 207195, generation: 3};
    const cityNames = Array.from({length: 38}, (_, i) => '完整城池名称' + i);
    if (preview) {
        data.g_PIdx = 1;
        data.g_Cities = Array.from({length: 38}, (_, i) => ({Belong: [1, 2, 6, 0, 0][i % 5]}));
        data.g_CityPositions = Array.from({length: 38}, (_, i) => ({x: 4 + i % 10 * 11, y: 5 + Math.floor(i / 10) * 17}));
        data.g_CityPositions[37] = {...data.g_CityPositions[0]}; // Genuine coordinates may coincide.
        menu.generation = menu.detailGeneration = 1;
    }
    const worldBefore = JSON.stringify(data);
    let liveData = data;
    const fight = { active: 0, over: 0 };
    const march = { pick: 0, battlePick: 0, phase: 0 };
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
        baye: { data, ensureData: () => liveData, getPersonNameByID: id => id === 13 ? '曹操' : '',
            hd: { ready: () => true, record: () => record, menuItems: () => menu,
                fight: () => fight, kings: () => kings, march: () => march, reportText: () => '' } }
    });
    if (preview) {
        context.BayeHdLibIdentity = {read: () => ({...identity}), isCurrent: value => value.generation === identity.generation && identity.status === 'ready'};
        context.baye.hdCityLimit = () => 38;
        context.baye.getCityName = i => cityNames[i];
    }
    context.window = context;
    if (configure) configure(context);
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
    return { api, record, menu, kings, slots, data, storage, context, root, get list() { return list; }, ids, sent, timers, fight, march,
        preview: previewDom, identity, cityNames,
        get scrollCalls() { return scrollCalls; }, node(tag) { return new Node(tag); },
        rebindData(next) { liveData = next; context.baye.data = next; },
        replaceList() {
            const previous = list, replacement = new Node();
            root.children[root.children.indexOf(previous)] = replacement;
            previous.parentNode = null; previous.parentElement = null;
            replacement.parentNode = root; replacement.parentElement = root;
            list = replacement; ids.set('hd-system-ui-list', replacement); return previous;
        },
        click, button, refresh, tick, setAfterKey(fn) { afterKey = fn; }, elapseWithoutTimers(ms) { clock += ms; },
        poll() { intervals.forEach(fn => fn()); },
        pointer(slot) { root.listeners.get('pointerdown')(event(button(slot))); },
        pointerNode(target) { root.listeners.get('pointerdown')(event(target)); },
        clickNode(target) { root.listeners.get('click')(event(target)); },
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
    assert.match(h.button(2).textContent, /存档 3.*已有进度.*189/);
    assert.doesNotMatch(h.button(2).textContent, /曹操/);
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

function savedSummaryHarness(status, provider) {
    const liveReads = [];
    const h = harness({status,configure(context) {
        Object.defineProperty(context.baye.data,'g_PIdx',{get(){liveReads.push('g_PIdx');throw Error('saved summary consulted live period');}});
        for (const name of ['getPersonNameByID','getPersonName']) context.baye[name] = () => {
            liveReads.push(name); throw Error('saved summary consulted live name');
        };
        if (provider !== undefined) context.BayeHdSavedRuler = provider;
    }});
    return Object.assign(h,{assertNoLiveSummaryReads(){assert.deepEqual(liveReads,[]);}});
}

test('saved ruler summaries use the saved period and zero-based king, including zero and both month endpoints', () => {
    const calls = [], names = {'1:0':'第一时期零号君主','2:0':'第二时期零号君主','4:199':'第四时期末号君主'};
    const h = savedSummaryHarness({
        0:{status:'ready',canLoad:true,period:1,king:0,year:190,month:1},
        1:{status:'ready',canLoad:true,period:2,king:0,year:199,month:12},
        2:{status:'ready',canLoad:true,period:4,king:199,year:237,month:7}
    },{read(period,king){calls.push([period,king]);return names[period+':'+king];}});
    assert.equal(h.button(0).textContent,'存档 1 · 第一时期零号君主 · 董卓弄权 · 190 年 1 月');
    assert.equal(h.button(1).textContent,'存档 2 · 第二时期零号君主 · 曹操崛起 · 199 年 12 月');
    assert.equal(h.button(2).textContent,'存档 3 · 第四时期末号君主 · 三国鼎立 · 237 年 7 月');
    assert.ok(calls.length);assert.ok(calls.every(([p,k])=>Object.hasOwn(names,p+':'+k)));
    assert.equal(h.button(3).textContent,'存档 4 · 空');h.poll();h.refresh();
    assert.deepEqual(h.sent,[]);h.assertNoLiveSummaryReads();h.assertWorldUnchanged();
});

test('missing, null or failing saved-ruler providers retain known saved period and date without borrowing a live name', () => {
    const slot={0:{status:'ready',canLoad:true,period:3,king:0,year:208,month:12}};
    for(const provider of [undefined,null,{}, {read:()=>null},{read(){throw Error('name resource unavailable');}}]) {
        const h=savedSummaryHarness(slot,provider);
        assert.equal(h.button(0).textContent,'存档 1 · 赤壁之战 · 208 年 12 月');
        assert.deepEqual(h.sent,[]);h.assertNoLiveSummaryReads();h.assertWorldUnchanged();
    }
    for(const month of [undefined,null,0,13,1.5,NaN,'12']) {
        const h=savedSummaryHarness({0:{status:'ready',canLoad:true,period:1,king:0,year:190,month}}, {read:()=> '保存君主'});
        assert.equal(h.button(0).textContent,'存档 1 · 保存君主 · 董卓弄权 · 190 年');
        h.assertNoLiveSummaryReads();assert.deepEqual(h.sent,[]);h.assertWorldUnchanged();
    }
});

test('unreadable slots and invalid saved identities never call the saved-ruler provider', () => {
    const statuses=['empty','wrong-lib','incomplete','invalid'];
    for(const [index,status] of statuses.entries()) {
        let calls=0;const h=savedSummaryHarness({0:{status,canLoad:false,period:1,king:0,year:190,month:12}}, {read(){calls++;return 'unexpected';}});
        assert.equal(h.button(0).textContent,'存档 1 · '+['空','属于其他版本','文件不完整','无法读取'][index]);
        assert.equal(h.button(0).disabled,true);assert.equal(calls,0);h.assertNoLiveSummaryReads();assert.deepEqual(h.sent,[]);
    }
    for(const values of [
        {period:0,king:0},{period:5,king:0},{period:'1',king:0},{period:1,king:-1},
        {period:1,king:200},{period:1,king:'0'},{period:1,king:1.5},{period:1,king:NaN},
        {status:'invalid',period:1,king:0}
    ]) {
        let calls=0;const h=savedSummaryHarness({0:{status:'ready',canLoad:true,year:190,month:1,...values}}, {read(){calls++;return 'unexpected';}});
        assert.equal(calls,0);assert.doesNotMatch(h.button(0).textContent,/unexpected|NaN|undefined/);
        h.assertNoLiveSummaryReads();assert.deepEqual(h.sent,[]);
    }
});

test('saved summary label refresh retains the native selected slot and sends no implicit selection or load', () => {
    const h=savedSummaryHarness({0:{status:'ready',canLoad:true,period:1,king:0,year:190,month:1},
        2:{status:'ready',canLoad:true,period:3,king:0,year:208,month:7}}, {read:period=>'时期'+period+'君主'});
    h.record.index=2;h.refresh();const before=h.button(0),seq=h.record.seq;
    assert.equal(h.button(2).classList.contains('is-idle'),true);
    Object.assign(h.slots[0],{period:2,year:199,month:12});h.refresh();h.poll();
    assert.notEqual(h.button(0),before);assert.equal(h.button(0).textContent,'存档 1 · 时期2君主 · 曹操崛起 · 199 年 12 月');
    assert.equal(h.record.index,2);assert.equal(h.record.seq,seq);assert.equal(h.button(2).classList.contains('is-idle'),true);
    assert.deepEqual(h.sent,[]);h.assertNoLiveSummaryReads();h.assertWorldUnchanged();
});

test('saved provider replacement and metadata mutation during a read retire the mixed summary', () => {
    for(const change of ['provider','metadata']) {
        const h=savedSummaryHarness({0:{status:'ready',canLoad:true,period:1,king:0,year:190,month:1}});
        h.context.BayeSaveStorage.slots=()=>h.slots;
        h.context.BayeHdSavedRuler={read(){
            if(change==='provider')h.context.BayeHdSavedRuler={read:()=>null};
            else h.slots[0].month=12;
            return 'stale captured ruler';
        }};
        h.refresh();assert.equal(h.button(0).textContent,'存档 1 · 资料更新中');
        assert.deepEqual(h.sent,[]);h.assertNoLiveSummaryReads();h.assertWorldUnchanged();
    }
});

test('saved slot changes and live name hooks retire or withhold saved names without executing a hook or sending input', () => {
    const status={0:{status:'ready',canLoad:true,period:1,king:0,year:190,month:12}};
    const moved=savedSummaryHarness(status);moved.context.BayeSaveStorage.slots=()=>moved.slots;
    moved.context.BayeHdSavedRuler={read(){moved.slots[0].slot=3;return 'wrong slot ruler';}};
    moved.refresh();assert.equal(moved.button(0).textContent,'存档 1 · 资料更新中');
    assert.deepEqual(moved.sent,[]);moved.assertNoLiveSummaryReads();moved.assertWorldUnchanged();
    const guarded=savedSummaryHarness(status);let providers=0,hooks=0;
    guarded.context.baye.hooks={getPersonName(){hooks++;throw Error('custom live name hook');}};
    guarded.context.BayeHdSavedRuler={read(){providers++;return 'saved source ruler';}};
    guarded.refresh();assert.equal(guarded.button(0).textContent,'存档 1 · 董卓弄权 · 190 年 12 月');
    assert.equal(providers,0);assert.equal(hooks,0);guarded.context.baye.hooks={};guarded.refresh();
    assert.equal(guarded.button(0).textContent,'存档 1 · saved source ruler · 董卓弄权 · 190 年 12 月');
    assert.ok(providers>0);assert.equal(hooks,0);guarded.assertNoLiveSummaryReads();assert.deepEqual(guarded.sent,[]);guarded.assertWorldUnchanged();
    const late=savedSummaryHarness(status);
    late.context.BayeHdSavedRuler={read(){late.context.baye.hooks={getPersonName(){hooks++;}};return 'stale pre-hook name';}};
    late.refresh();assert.equal(late.button(0).textContent,'存档 1 · 资料更新中');
    assert.equal(hooks,0);late.assertNoLiveSummaryReads();assert.deepEqual(late.sent,[]);late.assertWorldUnchanged();
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
    h.click(3); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.DOWN]);
    h.click(3); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER]);
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
    h.tick(); assert.deepEqual(h.sent, Array(8).fill(VK.DOWN));
    h.key(13); assert.deepEqual(h.sent, [...Array(8).fill(VK.DOWN), VK.ENTER]);
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

test('loaded ruler zero stays retired from map into a current native city menu', () => {
    const h = harness({ native: 'none' });
    h.data.g_PlayerKing = 0; h.data.g_Cities[0].Belong = 1;
    const world = JSON.stringify(h.data);
    h.march.pick = 1; h.refresh(); h.poll(); assert.equal(h.api.isOpen(), false);
    Object.assign(h.menu, { active: 1, context: 1, kind: 1, seq: 5,
        index: 0, count: 4, names: ['内政', '外交', '军备', '状况'] });
    h.march.pick = 0; h.refresh(); h.poll(); h.tick();
    assert.equal(h.api.isOpen(), false, 'CITY input owns the screen even though player zero is also the preselection sentinel');
    assert.equal(h.root.getAttribute('aria-hidden'), 'true');
    assert.equal(h.api.debugSnapshot().input, null); assert.deepEqual(h.sent, []);
    assert.equal(JSON.stringify(h.data), world);
});

test('a stale legacy king button and queue cannot send keys into a native city menu', () => {
    const h = harness({ native: 'none' }); h.data.g_PlayerKing = 0; h.refresh();
    assert.equal(h.api.isOpen(), true); assert.equal(h.api.getScreen(), 'king');
    const stale = h.button(1), world = JSON.stringify(h.data);
    Object.assign(h.menu, { active: 1, context: 1, kind: 1, seq: 5, index: 0, count: 4 });
    h.click(1, stale); h.back(); h.key(13); h.key(27); h.tick(); h.poll();
    assert.deepEqual(h.sent, []); assert.equal(h.api.isOpen(), false);
    assert.equal(JSON.stringify(h.data), world);
    const queued = harness({ native: 'none' }); queued.data.g_PlayerKing = 0; queued.refresh();
    queued.click(2); assert.deepEqual(queued.sent, [VK.DOWN]);
    Object.assign(queued.menu, { active: 1, context: 5, kind: 1, seq: 6, index: 0, count: 2 });
    queued.tick(); assert.deepEqual(queued.sent, [VK.DOWN], 'DEFENDER acquisition cancels the remaining old king queue');
});

test('real native king and record owners still win with a loaded ruler zero', () => {
    const h = harness({ native: 'king' }); h.data.g_PlayerKing = 0; h.data.g_Cities[0].Belong = 1;
    h.refresh(); const world = JSON.stringify(h.data);
    assert.equal(h.api.getScreen(), 'king'); assert.equal(h.api.isOpen(), true);
    h.click(2); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN]);
    h.key(13); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
    assert.equal(JSON.stringify(h.data), world);
    const r = harness({ mode: 1 }); r.data.g_PlayerKing = 0;
    Object.assign(r.menu, { active: 1, context: 1, kind: 1, seq: 5 });
    r.refresh(); assert.equal(r.api.getScreen(), 'saveload'); r.click(0); r.tick();
    assert.deepEqual(r.sent, [VK.ENTER], 'An actual record selector retains its original priority');
});

test('loaded ruler zero quantity input does not revive a legacy king selector after native map entry', () => {
    const h = harness({ native: 'none' }); h.data.g_PlayerKing = 0;
    const qty = { active: 1, protocol: true, ready: 1, session: 5, inputSeq: 15,
        value: 920, min: 0, max: 1040, lastKey: 34, cursor: 2, step: 10 };
    h.context.baye.hd.qty = () => qty;
    Object.assign(h.menu, { active: 0, context: 0, kind: 0, seq: 14 });
    Object.assign(h.march, { pick: 0, battlePick: 0, mapInputSeq: 1, mapCity: 21 });
    const world = JSON.stringify(h.data), inputs = JSON.stringify({ qty, march: h.march, menu: h.menu });
    h.refresh(); h.poll(); h.tick();
    assert.equal(h.api.isOpen(), false, 'Native map history retires ruler-zero fallback during a menu-inactive quantity wait');
    assert.equal(h.root.getAttribute('aria-hidden'), 'true'); assert.deepEqual(h.sent, []);
    assert.equal(JSON.stringify(h.data), world);
    assert.equal(JSON.stringify({ qty, march: h.march, menu: h.menu }), inputs);
});

test('native map history blocks stale king DOM, keyboard and queued keys without consuming the quantity input', () => {
    for (const action of ['click', 'back', 'key']) {
        const h = harness({ native: 'none' }); h.data.g_PlayerKing = 0; h.refresh();
        const stale = h.button(1), world = JSON.stringify(h.data);
        h.march.mapInputSeq = 1;
        if (action === 'click') h.click(1, stale);
        if (action === 'back') h.back();
        if (action === 'key') {
            const e = h.key(13);
            assert.equal(e.defaultPrevented, false, 'The real quantity handler retains the physical Enter');
            assert.equal(e.stopped, undefined);
        }
        h.tick(); h.poll(); assert.deepEqual(h.sent, []); assert.equal(h.api.isOpen(), false);
        assert.equal(JSON.stringify(h.data), world);
    }
    const h = harness({ native: 'none' }); h.data.g_PlayerKing = 0; h.refresh();
    h.click(2); assert.deepEqual(h.sent, [VK.DOWN]);
    h.march.mapInputSeq = 1; h.tick();
    assert.deepEqual(h.sent, [VK.DOWN], 'The final send fence retires the old king queue after actual map entry');
});

test('real new-game selectors and record owners still win after positive native map history', () => {
    const h = harness({ native: 'title' }); h.data.g_Cities[0].Belong = 1; h.march.mapInputSeq = 19;
    for (const [kind, screen] of [[1, 'title'], [2, 'period'], [3, 'king']]) {
        Object.assign(h.menu, { active: 1, context: 4, kind, index: 0, count: 4, seq: h.menu.seq + 1 });
        h.refresh(); assert.equal(h.api.getScreen(), screen); assert.equal(h.api.isOpen(), true);
        h.click(0); h.tick();
    }
    assert.deepEqual(h.sent, [VK.ENTER, VK.ENTER, VK.ENTER]);
    const r = harness({ mode: 1 }); r.data.g_PlayerKing = 0; r.march.mapInputSeq = 0xffffffff;
    r.refresh(); assert.equal(r.api.getScreen(), 'saveload'); r.click(0); r.tick();
    assert.deepEqual(r.sent, [VK.ENTER]);
    for (const mapInputSeq of [undefined, 0, -1, 1.5, '1', true, NaN, 0x100000000]) {
        const old = harness({ native: 'none' }); old.data.g_PlayerKing = 0; old.march.mapInputSeq = mapInputSeq;
        old.refresh(); assert.equal(old.api.getScreen(), 'king'); assert.equal(old.api.isOpen(), true);
    }
});

test('the native Maker hold closes title chrome and rejects stale title buttons without sending input', () => {
    const h = harness({ native: 'title' }), oldButton = h.button(2);
    h.context.baye.hd.maker = () => ({ protocolVersion: 1, active: true, phase: 'hold' });
    h.click(2, oldButton); h.back(); h.key(13); h.key(27);
    assert.deepEqual(h.sent, [], 'even before polling the old title cannot acknowledge the hold');
    h.api.onEngineMaker(); h.poll(); h.tick();
    assert.equal(h.api.isOpen(), false); assert.equal(h.api.debugSnapshot().input, null);
    assert.equal(h.root.getAttribute('aria-hidden'), 'true');
    assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
    h.context.baye.hd.maker = () => ({ active: false }); h.menu.seq++; h.api.onEngineMaker();
    assert.equal(h.api.isOpen(), true); assert.equal(h.api.getScreen(), 'title'); assert.deepEqual(h.sent, []);
});

test('system mode changes immediately retire the SPE pointer presentation without native input', () => {
    const h = harness({ native: 'title' }), modes = [];
    h.context.BayeHdSpe = { blit() { modes.push(h.storage['baye/systemUiMode']); } };
    h.api.setMode('classic'); h.api.setMode('hd');
    assert.deepEqual(modes, ['classic', 'hd']); assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
});

test('PC stable lists retain actual row identities and user scroll across hooks and polls', () => {
    for (const options of [{ native: 'king', kingCount: 18 }, { mode: 1 }]) {
        const h = harness(options), rows = [...h.list.children], calls = h.scrollCalls;
        h.list.scrollTop = 231;
        h.poll(); h.refresh(); h.poll();
        rows.forEach((row, index) => assert.equal(h.list.children[index], row, 'stable rows are not recreated'));
        assert.equal(h.list.scrollTop, 231); assert.equal(h.scrollCalls, calls, 'stable polls do not re-scroll the native cursor');
        assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
    }
});

test('PC list ownership, cursor, count, native names and screen changes invalidate stable rows', () => {
    const mutations = [h => { h.menu.index = 1; }, h => { h.menu.seq++; },
        h => { h.menu.count = 3; }, h => { h.menu.names = ['new native names']; },
        h => { h.menu.kind = 2; }];
    for (const mutate of mutations) {
        const h = harness({ native: 'title' }), previous = h.button(0);
        mutate(h); h.refresh(); assert.notEqual(h.button(0), previous);
        assert.equal(h.button(h.menu.index).classList.contains('is-idle'), true);
        const current = h.button(0); h.poll(); assert.equal(h.button(0), current);
        assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
    }
    const h = harness({ native: 'king' }), old = h.button(0);
    h.kings.kings[0].name = '新的君主名称'; h.refresh();
    assert.notEqual(h.button(0), old); assert.equal(h.button(0).textContent, '新的君主名称');
    assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
});

test('PC cached rows still follow pending, confirmed, retired and stale-pointer input fences', () => {
    const h = harness({ mode: 1, acknowledge: false }), original = h.button(0);
    h.click(2); assert.deepEqual(h.sent, [VK.DOWN]); assert.notEqual(h.button(0), original);
    assert.ok(h.list.children.every(row => row.disabled));
    const pending = h.button(0); h.list.scrollTop = 39; h.poll();
    assert.equal(h.button(0), pending); assert.equal(h.list.scrollTop, 39);
    h.record.index = 1; h.tick(40); h.record.index = 2; h.tick(40);
    assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]); assert.notEqual(h.button(0), pending);
    assert.ok(h.list.children.every(row => row.disabled));
    const confirmed = h.button(0); h.poll(); h.click(2); assert.equal(h.button(0), confirmed);
    assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]); h.assertWorldUnchanged();
    const stalled = harness({ mode: 1, acknowledge: false }); stalled.click(2); stalled.tick(5080);
    assert.equal(stalled.api.debugSnapshot().pending, false); assert.ok(stalled.list.children.every(row => row.disabled));
    const retired = stalled.button(0); stalled.poll(); assert.equal(stalled.button(0), retired);
    stalled.record.seq++; stalled.refresh(); assert.notEqual(stalled.button(0), retired);
    assert.ok(stalled.list.children.every(row => !row.disabled)); assert.deepEqual(stalled.sent, [VK.DOWN]);
    const stale = harness({ mode: 1 }); stale.pointer(0); const oldButton = stale.button(0);
    stale.record.seq++; stale.refresh(); stale.click(0, oldButton); stale.tick(); assert.deepEqual(stale.sent, []);
    stale.click(0); assert.deepEqual(stale.sent, [VK.ENTER]); stale.assertWorldUnchanged(); stalled.assertWorldUnchanged();
});

test('PC cached save rows refresh availability, error titles and labels and still recheck storage on click', () => {
    const h = harness(), empty = h.button(0);
    h.slots[0].error = '原生存档不可读取'; h.refresh();
    assert.notEqual(h.button(0), empty); assert.equal(h.button(0).title, '原生存档不可读取');
    Object.assign(h.slots[0], { status: 'ready', canLoad: true, error: '', king: 12, year: 189 }); h.refresh();
    const available = h.button(0); assert.equal(available.disabled, false); assert.match(available.textContent, /已有进度.*189/);
    h.slots[0].year = 190; h.refresh(); assert.notEqual(h.button(0), available); assert.match(h.button(0).textContent, /190/);
    const current = h.button(0); h.poll(); assert.equal(h.button(0), current);
    h.slots[0].canLoad = false; h.slots[0].error = '存档已被移除'; h.click(0, current); h.tick();
    assert.equal(h.button(0).disabled, true); assert.equal(h.button(0).title, '存档已被移除');
    assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
});

test('PC cache rejects same-value data rebinding, replaced containers, damaged rows and interrupted creation', () => {
    const h = harness({ native: 'king', kingCount: 18 }), first = h.button(0);
    const replacementData = JSON.parse(JSON.stringify(h.data)), replacementWorld = JSON.stringify(replacementData);
    h.rebindData(replacementData); h.refresh(); assert.notEqual(h.button(0), first);
    const rebound = h.button(0); h.poll(); assert.equal(h.button(0), rebound);
    h.replaceList(); h.refresh(); assert.notEqual(h.button(0), rebound); const newContainerRow = h.button(0);
    h.poll(); assert.equal(h.button(0), newContainerRow);
    const previous = h.button(0), impostor = h.node('button');
    Object.assign(impostor, { type: 'button', className: previous.className, textContent: previous.textContent,
        disabled: previous.disabled, title: previous.title, parentNode: h.list, parentElement: h.list });
    for (const key of ['data-hd-sys', 'data-hd-sys-owner']) impostor.setAttribute(key, previous.getAttribute(key));
    h.list.children[0] = impostor; previous.parentNode = null; h.refresh();
    assert.notEqual(h.button(0), impostor, 'same-count foreign node is never a cache hit');
    for (const damage of [row => { row.textContent = '损坏'; }, row => { row.disabled = true; },
        row => { row.title = '意外标题'; }, row => { row.setAttribute('data-hd-sys-owner', 'stale'); },
        row => { row.className = ''; }, row => { row.parentNode = null; }]) {
        const row = h.button(0); damage(row); h.refresh(); assert.notEqual(h.button(0), row);
    }
    h.list.children.pop(); h.refresh(); assert.equal(h.list.children.length, 18);
    const create = h.context.document.createElement; let creations = 0;
    h.context.document.createElement = tag => { if (++creations === 2) throw new Error('controlled DOM creation failure'); return create(tag); };
    h.menu.index = 1; assert.throws(() => h.refresh(), /controlled DOM creation failure/);
    h.context.document.createElement = create; h.menu.index = 0; h.refresh();
    assert.equal(h.list.children.length, 18); const restored = h.button(0); h.poll(); assert.equal(h.button(0), restored);
    assert.equal(JSON.stringify(replacementData), replacementWorld); assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
});

test('PC closing, mode changes and retirement invalidate cache while ownerless and empty lists stay uncached', () => {
    const h = harness({ mode: 1 });
    for (const retire of [() => h.api.close({ silent: true }), () => h.api.retireInteraction('controlled-test'),
        () => { h.api.setMode('classic'); h.api.setMode('hd'); }]) {
        const previous = h.button(0); retire(); h.refresh(); assert.notEqual(h.button(0), previous);
        const fresh = h.button(0); h.poll(); assert.equal(h.button(0), fresh);
    }
    h.back(); assert.deepEqual(h.sent, [VK.EXIT]); assert.ok(h.list.children.every(row => row.disabled));
    const exited = h.button(0); h.poll(); h.back(); assert.equal(h.button(0), exited); assert.deepEqual(h.sent, [VK.EXIT]);
    const missingData = harness({ native: 'title' }); missingData.context.baye.ensureData = () => null;
    missingData.refresh(); const noDataRow = missingData.button(0); missingData.poll(); assert.notEqual(missingData.button(0), noDataRow);
    const legacy = harness({ native: 'none' }); legacy.data.g_PlayerKing = 0; legacy.refresh();
    assert.equal(legacy.api.debugSnapshot().input, null); const legacyRow = legacy.button(0);
    legacy.poll(); assert.notEqual(legacy.button(0), legacyRow); assert.deepEqual(legacy.sent, []);
    const empty = harness({ native: 'function' }); Object.assign(empty.menu, { kind: 2, count: 2, names: [] }); empty.refresh();
    assert.equal(empty.api.getScreen(), 'insystem-confirm'); assert.equal(empty.list.children[0].className, 'hd-system-ui-empty');
    const emptyRow = empty.list.children[0]; empty.poll(); assert.notEqual(empty.list.children[0], emptyRow);
    assert.deepEqual(empty.sent, []); h.assertWorldUnchanged(); missingData.assertWorldUnchanged(); empty.assertWorldUnchanged();
});

test('PC acknowledged cursor accepts a fresh Enter before its old forty-ms callback', () => {
    for (const options of [{ native: 'period' }, { native: 'function' }, { mode: 1 }]) {
        const h = harness(options); h.key(40);
        assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(h.api.debugSnapshot().pending, true);
        assert.equal((h.record.active ? h.record : h.menu).index, 1);
        h.key(13); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER], 'a real returned cursor ACK must not swallow fresh Enter');
        h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]); h.assertWorldUnchanged();
    }
});

test('PC acknowledged cursor accepts fresh Down Right Up Left and preserves original wrap navigation', () => {
    for (const key of [40, 39, 38, 37]) {
        const h = harness({ native: 'period' }); h.key(40); h.key(key);
        const second = key === 40 || key === 39 ? VK.DOWN : VK.UP;
        assert.deepEqual(h.sent, [VK.DOWN, second]);
        h.key(13); assert.deepEqual(h.sent, [VK.DOWN, second, VK.ENTER]);
        h.tick(); assert.deepEqual(h.sent, [VK.DOWN, second, VK.ENTER]); h.assertWorldUnchanged();
    }
    for (const [index, key, movement] of [[3, 40, VK.UP], [0, 38, VK.DOWN]]) {
        const h = harness({ native: 'period' }); h.menu.index = index; h.refresh(); h.key(key);
        h.tick(40); h.tick(40);
        assert.deepEqual(h.sent, [movement, movement, movement], 'wrap still follows the original selector controller');
        h.key(13); assert.deepEqual(h.sent, [movement, movement, movement, VK.ENTER]);
        h.tick(); assert.equal(h.sent.length, 4); h.assertWorldUnchanged();
    }
});

test('PC missing ACK and repeated events cannot release or queue another cursor request', () => {
    const h = harness({ native: 'period', acknowledge: false }); h.key(40);
    for (const key of [13, 40, 39, 38, 37]) { h.key(key); h.key(key, { repeat: true }); }
    h.tick(40); assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(h.api.debugSnapshot().pending, true);
    h.menu.index = 1; h.key(13, { repeat: true }); assert.deepEqual(h.sent, [VK.DOWN]);
    h.key(13); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]); h.tick();
    assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]); h.assertWorldUnchanged();
});

test('PC confirm-true click navigation remains timer-owned even when its final cursor ACK is ready', () => {
    const h = harness({ mode: 1, acknowledge: false }); h.click(2);
    h.record.index = 1; h.tick(40); h.record.index = 2;
    for (const key of [13, 40, 38, 39, 37]) h.key(key);
    assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN]); assert.equal(h.api.debugSnapshot().pending, true);
    h.tick(40); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
    h.key(13); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]); h.assertWorldUnchanged();
});

test('PC cursor request and old timer retire across data generation owner count names and screen changes', () => {
    const changes = [h => h.rebindData(JSON.parse(JSON.stringify(h.data))), h => { h.data.g_hdDetailGeneration++; },
        h => { h.data.g_hdSpeGeneration++; }, h => { h.menu.seq++; }, h => { h.menu.count = 3; },
        h => { h.menu.names = ['different current native contents']; }, h => { h.menu.kind = 1; }];
    for (const change of changes) {
        const h = harness({ native: 'period' }); h.key(40); const oldTimers = [...h.timers.values()].map(t => t.fn);
        change(h); h.key(13); h.key(40); assert.deepEqual(h.sent, [VK.DOWN]);
        oldTimers.forEach(fn => fn()); assert.deepEqual(h.sent, [VK.DOWN], 'stale data or owner cannot be entered later by the old timer');
        assert.equal(h.api.debugSnapshot().pending, false);
    }
    const h = harness({ native: 'period' }); h.key(40); const ensure = h.context.baye.ensureData;
    h.context.baye.ensureData = () => { throw new Error('controlled observer read'); };
    assert.doesNotThrow(() => h.key(13)); assert.deepEqual(h.sent, [VK.DOWN]);
    h.context.baye.ensureData = ensure; h.api.close({ silent: true }); h.tick(); assert.deepEqual(h.sent, [VK.DOWN]);
});

test('PC cursor shortcut preserves missing-ACK five-second and total sixty-second request limits', () => {
    const waiting = harness({ native: 'period', acknowledge: false }); waiting.key(40);
    const stalled = [...waiting.timers.values()].map(t => t.fn); waiting.elapseWithoutTimers(5040);
    waiting.key(13); waiting.key(40); assert.deepEqual(waiting.sent, [VK.DOWN]);
    stalled.forEach(fn => fn()); assert.equal(waiting.api.debugSnapshot().pending, false); assert.match(waiting.api.debugSnapshot().hint, /尚未确认/);
    const total = harness({ native: 'period' }); total.key(40); const expired = [...total.timers.values()].map(t => t.fn);
    total.elapseWithoutTimers(60001); total.key(13); assert.deepEqual(total.sent, [VK.DOWN]);
    expired.forEach(fn => fn()); assert.equal(total.api.debugSnapshot().pending, false); assert.match(total.api.debugSnapshot().hint, /等待过久/);
});

test('PC cursor dispatch blocks synchronous reentry and preserves native throw and unavailable-send outcomes', () => {
    const h = harness({ native: 'period' }); h.setAfterKey(key => { if (key === VK.DOWN) { h.key(13); h.key(40); } });
    h.key(40); assert.deepEqual(h.sent, [VK.DOWN], 'dispatch has not returned while the native delegate reenters');
    h.key(13); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]);
    const failed = harness({ native: 'period' }), failure = new Error('original native delegate throw');
    failed.setAfterKey(key => { if (key === VK.DOWN) throw failure; });
    assert.throws(() => failed.key(40), error => error === failure); failed.key(13); assert.deepEqual(failed.sent, [VK.DOWN]);
    failed.setAfterKey(null); failed.api.close({ silent: true }); failed.refresh(); failed.key(40);
    assert.deepEqual(failed.sent, [VK.DOWN, VK.DOWN], 'finally releases only the dispatch lock, never grants the throwing call an ACK');
    const unavailable = harness({ native: 'period' }); unavailable.context.sendKey = undefined; unavailable.context.baye.sendKey = undefined;
    unavailable.key(40); unavailable.key(13); assert.deepEqual(unavailable.sent, []); assert.equal(unavailable.api.debugSnapshot().pending, false);
    const cancel = harness({ native: 'period', acknowledge: false }); cancel.key(40); cancel.key(27); cancel.tick();
    assert.deepEqual(cancel.sent, [VK.DOWN, VK.EXIT], 'EXIT retains its original immediate back path');
});

test('PC old timers cannot clear a newer cursor request and mobile keyboard remains separately delegated', () => {
    const h = harness({ native: 'period' }); h.key(40); const old = [...h.timers.values()].map(t => t.fn);
    h.setAfterKey(key => { if (key === VK.ENTER) { h.menu.seq++; h.menu.index = 0; } });
    h.key(13); h.key(40); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER, VK.DOWN]);
    old.forEach(fn => fn()); assert.equal(h.api.debugSnapshot().pending, true); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER, VK.DOWN]);
    h.key(13); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER, VK.DOWN, VK.ENTER]); h.tick(); assert.equal(h.sent.length, 4);
    const reentry = harness({ native: 'period' }); reentry.key(40);
    const previous = [...reentry.timers.values()].map(t => t.fn), ensure = reentry.context.baye.ensureData; let armed = true;
    reentry.context.baye.ensureData = () => {
        if (armed) { armed = false; reentry.api.retireInteraction('observer-reentry'); reentry.menu.seq++; reentry.refresh(); reentry.key(40); }
        return ensure();
    };
    reentry.key(13); assert.deepEqual(reentry.sent, [VK.DOWN, VK.DOWN]);
    previous.forEach(fn => fn()); assert.equal(reentry.api.debugSnapshot().pending, true);
    reentry.key(13); assert.deepEqual(reentry.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
    const late = harness({ native: 'period', acknowledge: false }); late.key(40);
    const lateStep = [...late.timers.values()][0].fn, originalMenu = late.context.baye.hd.menuItems; let menuReads = 0, lateReentry = false;
    late.context.baye.hd.menuItems = () => {
        if (++menuReads === 3) {
            lateReentry = true; late.api.retireInteraction('last-owner-read-reentry'); late.menu.seq++; late.menu.index = 0;
            late.refresh(); late.key(40);
        }
        return originalMenu();
    };
    lateStep(); late.context.baye.hd.menuItems = originalMenu;
    assert.equal(late.api.debugSnapshot().pending, true, 'an old cursor callback must not clear a new unacknowledged request');
    late.key(13); assert.deepEqual(late.sent, lateReentry ? [VK.DOWN, VK.DOWN] : [VK.DOWN], 'an unacknowledged owner never receives Enter');
    assert.equal(lateReentry, false, 'PC cursor step reuses the owner from its complete fence instead of an unsafe third getter');
    const rebound = harness({ native: 'period', acknowledge: false }); rebound.key(40);
    const reboundStep = [...rebound.timers.values()][0].fn, readMenu = rebound.context.baye.hd.menuItems;
    const sameValue = JSON.parse(JSON.stringify(rebound.data)); let generationReads = 0;
    rebound.context.baye.hd.menuItems = () => { if (++generationReads === 2) rebound.rebindData(sameValue); return readMenu(); };
    reboundStep(); rebound.context.baye.hd.menuItems = readMenu;
    assert.equal(rebound.api.debugSnapshot().pending, false, 'same-token data replacement inside the last complete snapshot retires the old request');
    assert.deepEqual(rebound.sent, [VK.DOWN]);
    const m = harness({ mode: 1 }); m.context.document.body.classList.add('hd-mobile-page');
    for (const key of [13, 40, 39, 38, 37]) { const event = m.key(key); assert.equal(event.defaultPrevented, false); }
    assert.deepEqual(m.sent, []); m.assertWorldUnchanged();
});

test('PC king rows navigate without confirmation and show only the actually acknowledged ruler', () => {
    const h = harness({native: 'king', acknowledge: false, preview: true}), p = h.preview;
    assert.equal(p.panel.getAttribute('data-ready'), 'true'); assert.equal(p.panel.getAttribute('data-king-id'), '0');
    h.click(1); h.poll(); assert.deepEqual(h.sent, [VK.DOWN]);
    assert.equal(p.panel.getAttribute('data-king-id'), '0', 'pending target is not an optimistic preview');
    h.menu.index = h.kings.index = 1; h.kings.currentId = h.kings.kings[1].id; h.tick(40);
    assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(p.panel.getAttribute('data-king-id'), '1');
    assert.equal(p.panel.getAttribute('data-king-index'), '1'); assert.match(p.summary.textContent, /^曹操 · 领城 /);
    h.click(1); h.tick(); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]); h.assertWorldUnchanged();
});

test('PC king Start confirms the displayed native ruler once and rejects stale data generation and highlight presses', () => {
    const h = harness({native: 'king', preview: true}); h.clickNode(h.preview.start); h.clickNode(h.preview.start); h.tick();
    assert.deepEqual(h.sent, [VK.ENTER]); h.assertWorldUnchanged();
    for (const change of [
        x => { x.menu.index = x.kings.index = 1; x.kings.currentId = 1; },
        x => { x.menu.seq++; }, x => { x.data.g_hdDetailGeneration++; }, x => { x.data.g_hdSpeGeneration++; },
        x => { x.rebindData(JSON.parse(JSON.stringify(x.data))); }, x => { x.api.retireInteraction('start-gesture-epoch'); }
    ]) {
        const x = harness({native: 'king', preview: true}), start = x.preview.start;
        x.pointerNode(start); change(x); x.refresh(); x.clickNode(start); x.tick();
        assert.deepEqual(x.sent, [], 'a held Start cannot authorize another highlighted ruler or engine epoch');
    }
    const pending = harness({native: 'king', acknowledge: false, preview: true}); pending.click(1); pending.clickNode(pending.preview.start);
    assert.deepEqual(pending.sent, [VK.DOWN]);
});

test('PC king row presses cannot turn a changed highlight or data epoch into an unintended confirmation', () => {
    const h = harness({native: 'king', preview: true}), row = h.button(1); h.pointerNode(row);
    h.key(40); h.tick(40); h.clickNode(row); assert.deepEqual(h.sent, [VK.DOWN], 'pressing a different row before keyboard ACK must not become Enter');
    h.click(1); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER], 'a new current-row click remains an explicit confirmation');
    for (const change of [
        x => x.rebindData(JSON.parse(JSON.stringify(x.data))), x => { x.data.g_hdDetailGeneration++; },
        x => { x.data.g_hdSpeGeneration++; }, x => { x.api.retireInteraction('row-gesture-epoch'); }
    ]) {
        const x = harness({native: 'king', preview: true}), old = x.button(0); x.pointerNode(old); change(x); x.refresh(); x.clickNode(old); x.tick();
        assert.deepEqual(x.sent, [], 'same owner token alone cannot revive a stale king-row press');
        x.click(0); assert.deepEqual(x.sent, [VK.ENTER], 'a fresh rebuilt row remains usable after same-sequence data or epoch changes');
    }
});

test('PC king territory preview binds all native cities and complete names to king zero without inventing a capital', () => {
    const h = harness({native: 'king', preview: true}), p = h.preview;
    const owned = h.data.g_Cities.map((c, id) => ({...c, id})).filter(c => c.Belong === h.kings.currentId + 1);
    assert.equal(h.data.g_PlayerKing, 12); assert.equal(p.panel.getAttribute('data-king-id'), '0');
    assert.equal(p.summary.getAttribute('data-count'), String(owned.length));
    assert.deepEqual(p.cities.children.map(n => n.textContent), owned.map(c => h.cityNames[c.id]));
    assert.deepEqual(p.cities.children.map(n => n.getAttribute('data-city-id')), owned.map(c => String(c.id)));
    assert.equal(p.map.children.length, 38);
    assert.equal(p.map.getAttribute('hidden'), null, 'valid SVG preview must remove its actual hidden attribute');
    const xs = h.data.g_CityPositions.map(v => v.x), ys = h.data.g_CityPositions.map(v => v.y),
        minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys),
        scale = Math.min(296 / (maxX - minX || 1), 156 / (maxY - minY || 1));
    for (const [i, point] of p.map.children.entries()) {
        const pos = h.data.g_CityPositions[i]; assert.equal(point.getAttribute('data-city-id'), String(i));
        assert.equal(point.getAttribute('data-native-x'), String(pos.x)); assert.equal(point.getAttribute('data-native-y'), String(pos.y));
        assert.equal(point.getAttribute('data-owned'), String(h.data.g_Cities[i].Belong === 1));
        assert.ok(Math.abs(Number(point.getAttribute('cx')) - (160 + (pos.x - (minX + maxX) / 2) * scale)) <= .00051);
        assert.ok(Math.abs(Number(point.getAttribute('cy')) - (90 + (pos.y - (minY + maxY) / 2) * scale)) <= .00051);
        assert.equal(point.children[0].textContent, h.cityNames[i]);
    }
    assert.equal(p.map.children[37].getAttribute('cx'), p.map.children[0].getAttribute('cx'), 'authentic coordinate collisions are retained');
    assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
});

test('PC king preview clears stale territories for invalid library or native shape and late second-pass getter changes', () => {
    for (const change of [
        x => { x.identity.status = 'pending'; }, x => { x.identity.sha256 = '0'.repeat(64); }, x => { x.identity.byteLength--; },
        x => { x.identity.generation = 0; }, x => { x.context.BayeHdLibIdentity.isCurrent = () => false; },
        x => { x.menu.count--; }, x => { x.kings.currentId = 7; }, x => { x.data.g_CityPositions[0].x = 256; },
        x => { x.data.g_CityPositions[0].y = .5; }, x => { x.context.baye.hdCityLimit = () => 37; }
    ]) {
        const x = harness({native: 'king', preview: true}); change(x); x.refresh();
        assert.equal(x.preview.panel.getAttribute('data-ready'), 'false'); assert.equal(x.preview.panel.getAttribute('data-king-id'), '');
        assert.equal(x.preview.cities.children.length, 0); assert.equal(x.preview.map.children.length, 0); assert.deepEqual(x.sent, []);
        assert.equal(x.preview.map.getAttribute('hidden'), '', 'invalid SVG preview retains its actual hidden attribute');
    }
    for (const change of [x => { x.menu.seq++; }, x => { x.kings.currentId = 1; },
        x => { x.data.g_hdDetailGeneration++; }, x => { x.data.g_hdSpeGeneration++; },
        x => { x.rebindData(JSON.parse(JSON.stringify(x.data))); }]) {
        const x = harness({native: 'king', preview: true}), original = x.context.baye.getCityName; let reads = 0;
        x.context.baye.getCityName = i => { if (++reads === 76) change(x); return original(i); };
        x.refresh(); assert.equal(reads, 76, 'mutation is reached at the final city name of the second full sample');
        assert.equal(x.preview.panel.getAttribute('data-ready'), 'false', 'late source change must not publish a mixed territory panel');
        assert.equal(x.preview.cities.children.length, 0); assert.equal(x.preview.map.children.length, 0); assert.deepEqual(x.sent, []);
    }
});

test('PC king LCD toggle survives polls and scheduled native refreshes and resets its label on a fresh selector', () => {
    const h = harness({native: 'king', preview: true}), p = h.preview;
    h.api.onEngineHook('chooseActor'); h.clickNode(p.lcd);
    assert.equal(h.context.document.body.classList.contains('baye-hd-system-ui-lcd'), true);
    assert.equal(h.context.document.body.classList.contains('baye-hd-system-ui-king-lcd'), true);
    assert.equal(p.lcd.textContent, '隐藏经典 LCD'); h.poll(); h.tick(3300);
    assert.equal(h.context.document.body.classList.contains('baye-hd-system-ui-lcd'), true);
    assert.equal(p.lcd.textContent, '隐藏经典 LCD'); assert.equal(p.panel.getAttribute('data-ready'), 'true');
    h.clickNode(p.lcd); assert.equal(h.context.document.body.classList.contains('baye-hd-system-ui-lcd'), false);
    assert.equal(p.lcd.textContent, '经典 LCD');
    h.clickNode(p.lcd); h.api.onEngineHook('chooseActor');
    assert.equal(h.context.document.body.classList.contains('baye-hd-system-ui-lcd'), false); assert.equal(p.lcd.textContent, '经典 LCD');
    assert.deepEqual(h.sent, []); h.assertWorldUnchanged();
});

console.log(`${count} HD save/load UI regressions passed`);
