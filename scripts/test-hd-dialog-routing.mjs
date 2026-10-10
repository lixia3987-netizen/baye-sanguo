#!/usr/bin/env node
/** Real overlay/event handlers against a small DOM and explicit C wait snapshots. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function element(tagName = 'DIV') {
    const attrs = new Map(), listeners = new Map(), classes = new Set();
    let text = '';
    return { tagName, attrs, listeners, style: {}, parentElement: null, parentNode: null, children: [],
        classList: { contains(key) { return classes.has(key); },
            toggle(key, on) { if (on) classes.add(key); else classes.delete(key); },
            add(key) { classes.add(key); }, remove(key) { classes.delete(key); } },
        get textContent() { return text + this.children.map(child => child.textContent).join(''); },
        set textContent(value) { text = String(value); this.children.forEach(child => { child.parentNode = child.parentElement = null; }); this.children = []; },
        setAttribute(key, value) { attrs.set(key, String(value)); },
        getAttribute(key) { return attrs.get(key) ?? null; },
        removeAttribute(key) { attrs.delete(key); },
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
        querySelectorAll(selector) {
            const match = node => selector.startsWith('[') ? node.getAttribute(selector.slice(1, -1)) != null :
                selector.startsWith('.') && String(node.className || '').split(/\s+/).includes(selector.slice(1));
            const found = [];
            function visit(node) { for (const child of node.children) { if (match(child)) found.push(child); visit(child); } }
            visit(this); return found;
        },
        appendChild(child) { child.parentNode = child.parentElement = this; this.children.push(child); } };
}
function harness() {
    const nodes = { 'hd-dialog': element(), 'hd-city-menu': element(), 'hd-battle': element(),
        'hd-dialog-title': element(), 'hd-dialog-body': element(), 'hd-dialog-caption': element(),
        'hd-dialog-range': element() };
    const listeners = [], timers = new Map(), sent = [], writes = [];
    let timer = 0, onSend = () => {};
    const document = { body: element('BODY'), documentElement: element('HTML'),
        getElementById: id => nodes[id] ?? null, querySelector: () => null, createElement: element,
        addEventListener(type, fn, capture = false) { if (type === 'keydown') listeners.push({ fn, capture, window: false }); } };
    const storage = { 'baye/overworldMode': 'hd-map', 'baye/battleMode': 'hd',
        getItem(key) { return this[key] ?? null; }, setItem(key, value) { this[key] = String(value); } };
    const report = { seq: 1, kind: 1, person: 65535, text: '选择目标城' };
    const march = { session: 7, inputSeq: 11, phase: 3, origin: 0, selected: 1, pick: 0, battlePick: 0, seq: 1 };
    const fight = { active: 0, over: 0, inputKind: 0, inputSeq: 1, actorIndex: 255 };
    const help = { active: 0, text: '' }, qty = { active: 0, value: 10, min: 1, max: 100 };
    const view = { active: 0 };
    const menu = { active: 0, context: 0, kind: 0, seq: 1, index: 0, names: [] };
    const rawData = { g_asyncActionID: 1, g_hdReportGbk: report.text, g_FgtOver: 0,
        g_hdFightActive: 0, g_hdFightOver: 0, g_PlayerKing: 0, g_FoucsX: 0, g_FoucsY: 0,
        g_MapWid: 8, g_MapHgt: 8, g_FgtParam: { GenArray: [] }, g_GenPos: [] };
    const data = new Proxy(rawData, { set(target, key, value) { writes.push([key, value]); target[key] = value; return true; } });
    const context = vm.createContext({ document, localStorage: storage, Storage: function () {},
        console: { log() {}, warn() {}, error() {} }, navigator: { userAgent: 'Node test' },
        innerWidth: 1000, innerHeight: 600, devicePixelRatio: 1,
        setTimeout(fn) { const id = ++timer; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
        setInterval() { return ++timer; }, clearInterval() {}, requestAnimationFrame() { return ++timer; }, cancelAnimationFrame() {},
        addEventListener(type, fn, capture = false) { if (type === 'keydown') listeners.push({ fn, capture, window: true }); },
        _bayeSendKey(key) { sent.push(key); onSend(key); },
        $() { return { css() {}, hide() {}, show() {}, removeAttr() {} }; } });
    context.window = context;
    function load(path, expose = '') {
        let source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
        if (expose) source = source.replace(/\}\)\(window\);\s*$/, expose + '\n})(window);');
        vm.runInContext(source, context, { filename: path });
    }
    load('js/lcd.js'); context.Module.asm = {};
    context.baye = { data, ensureData: () => data, hdEngineReady: () => true,
        getPersonName: () => '', sendKey: context._bayeSendKey,
        hd: { ready: () => true, report: () => report, reportText: () => report.text,
            march: () => march, fight: () => fight, help: () => help, view: () => view, qty: () => qty,
            menuItems: () => menu, movie: () => ({ active: 0 }) } };
    load('js/hd-city-menu.js', `global.__cityState = state; render = function () {}; scheduleMarchWatch = function () {};`);
    Object.assign(context.__cityState, { battleMake: true, marchSession: 7, marchOriginIndex: 0,
        cityIndex: 0, deepKind: 'person-city', layer: 'deep', open: false });
    load('js/hd-battle.js'); load('js/hd-dialog.js');
    context.BayeHdBattle.start(); context.BayeHdDialog.start();
    document.onkeydown = context.onKeyDown;
    writes.length = 0;
    return { context, nodes, data: rawData, report, march, fight, help, view, qty, menu, sent, writes,
        onSend(fn) { onSend = fn; },
        snapshot() { return context.BayeHdDialog.debugSnapshot(); },
        observe() { context.BayeHdDialog.onEngineReport(); context.BayeHdDialog.poll(); },
        button(attribute) {
            const target = element('BUTTON'); target.setAttribute(attribute, ''); target.parentNode = nodes['hd-dialog'];
            return target;
        },
        pointerDown(target) {
            for (const fn of nodes['hd-dialog'].listeners.get('pointerdown') ?? []) fn({ target });
        },
        click(attribute, oldTarget) {
            const target = oldTarget ?? this.button(attribute);
            for (const fn of nodes['hd-dialog'].listeners.get('click') ?? []) fn({ target, preventDefault() {} });
        },
        key(keyCode, options = {}) {
            const event = { keyCode, key: ({ 13: 'Enter', 27: 'Escape', 38: 'ArrowUp' })[keyCode],
                target: document.body, defaultPrevented: false, returnValue: true,
                preventDefault() { this.defaultPrevented = true; this.returnValue = false; },
                stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; this.immediate = true; }, ...options };
            for (const capture of [true, false]) for (const window of [true, false]) {
                for (const item of listeners) if (!event.stopped && !!item.capture === capture && item.window === window) item.fn(event);
            }
            if (!event.immediate) document.onkeydown(event);
            return event;
        },
        timers() { for (let n = 0; timers.size && n < 20; n++) { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } }
    };
}
function native(h) { h.march.phase = 0; h.context.__cityState.battleMake = false; }
function battleHelp(h, seq = 20) {
    native(h); Object.assign(h.fight, { active: 1, inputKind: 9, inputSeq: seq });
    h.data.g_hdFightActive = 1; h.help.active = 1; h.help.text = '战场将领帮助|兵力与状态';
    h.context.BayeHdBattle.onEngineFight(); h.context.BayeHdDialog.onEngineHelp();
}
function detailedHelp(h, changes = {}) {
    battleHelp(h);
    Object.assign(h.help, { protocolVersion: 1, seq: 3, generation: 7, detailGeneration: 7,
        inputSeq: 20, kind: 1, complete: 1, person: 0, slot: 2, name: '原生姓名',
        arm: '骑兵', state: '正常', fields: [1, 99, 88, 0, 0, 0, 210, 155, 65535, 2],
        levelMax: 0, x: 0, y: 0, terrain: 255,
        text: '原生武将帮助|兵力与状态', ...changes });
    h.context.BayeHdDialog.onEngineHelp();
}
function detailedView(h, changes = {}) {
    native(h); Object.assign(h.fight, { active: 1, over: 0, inputKind: 10, inputSeq: 60 });
    h.data.g_hdFightActive = 1;
    Object.assign(h.view, { protocolVersion: 1, active: 1, complete: 1, custom: 0,
        seq: 3, generation: 7, detailGeneration: 7, inputSeq: 60,
        force: 0, pageStart: 0, pageSize: 2, totalCount: 3, rowCount: 2,
        width: 8, height: 6, days: 0, playerMode: 1, foodKnown: 1, food: 0, leaderPerson: 0,
        title: '战况总览', daysText: '第零天', positionsText: '军团位置', factionText: '原生军团', foodText: '粮草：0',
        rows: [{ slot: 0, personIndex: 0, name: '同名', text: '同名 0', arms: 0 },
            { slot: 1, personIndex: 600, name: '同名', text: '同名 65535', arms: 65535 }],
        points: [{ slot: 0, personIndex: 0, x: 0, y: 0, state: 0 },
            { slot: 1, personIndex: 600, x: 7, y: 5, state: 3 },
            { slot: 10, personIndex: 99, x: 3, y: 2, state: 0 }], ...changes });
    h.context.BayeHdBattle.onEngineFight(); h.context.BayeHdDialog.onEngineView();
}
function publishView(h, changes = {}) {
    h.fight.inputSeq++;
    Object.assign(h.view, { seq: h.view.seq + 1, inputSeq: h.fight.inputSeq }, changes);
    h.context.BayeHdBattle.onEngineFight(); h.context.BayeHdDialog.onEngineView();
    h.timers();
}
function viewButton(h, code) {
    const node = h.nodes['hd-dialog-body'].querySelectorAll('[data-hd-view-key]')
        .find(button => button.getAttribute('data-hd-view-key') === String(code));
    assert.ok(node, 'actual rendered VIEW action must exist'); return node;
}
function spyViewActions(h) {
    const calls = [], original = h.context.BayeHdBattle.viewKey;
    h.context.BayeHdBattle.viewKey = (code, owner) => {
        calls.push([code, JSON.parse(JSON.stringify(owner))]);
        return original(code, owner);
    };
    return calls;
}

test('report observers never send keys or change bridge text in any march phase', () => {
    const h = harness();
    for (const [phase, text] of [[1, '主公请下令'], [2, '饥荒灾异'], [3, '选择目标'], [5, '无法到达'], [6, '部队已出发'], [7, '拥立新君']]) {
        h.march.phase = phase; h.march.inputSeq++; h.report.seq++; h.report.text = text;
        h.observe(); h.context.BayeHdDialog.dismissLeftoverSpeech(); h.context.BayeHdDialog.poll();
    }
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});
test('explicit departure confirmation delegates once and never falls back to raw Enter', () => {
    const h = harness(); h.march.phase = 6; h.report.text = '部队已出发'; h.observe();
    h.click('data-hd-dlg-ok'); h.click('data-hd-dlg-ok'); h.key(13, { repeat: true });
    assert.deepEqual(h.sent, [0x27]);
});
test('old march sequence or old session cannot confirm a newer report', () => {
    for (const key of ['inputSeq', 'session']) {
        const h = harness(); h.observe(); h.march[key]++;
        h.click('data-hd-dlg-ok'); h.key(13);
        assert.deepEqual(h.sent, []);
    }
    const h = harness(); h.observe(); h.report.seq++;
    h.click('data-hd-dlg-ok'); assert.deepEqual(h.sent, []);
});
test('march confirmation keyboard and overlapping native handlers dispatch exactly once', () => {
    const h = harness(); h.observe();
    assert.equal(h.key(13).defaultPrevented, true); h.key(13); h.key(13, { repeat: true });
    assert.deepEqual(h.sent, [0x27]);
});
test('acknowledging one march report preserves the synchronously opened next report', () => {
    const h = harness(); h.observe();
    h.onSend(() => { h.march.phase = 6; h.march.inputSeq++; h.report.seq++; h.report.text = '部队已出发'; h.context.BayeHdDialog.onEngineReport(); });
    h.click('data-hd-dlg-ok');
    assert.equal(h.snapshot().open, true); assert.equal(h.snapshot().body, '部队已出发');
    assert.equal(h.snapshot().marchOwner.inputSeq, h.march.inputSeq); assert.deepEqual(h.sent, [0x27]);
});
test('hiding a march report with Back never cancels or confirms its engine wait', () => {
    const h = harness(); h.observe(); h.click('data-hd-dlg-back'); assert.deepEqual(h.sent, []);
});
test('actual native reports keep explicit Enter/Exit and observers stay passive', () => {
    for (const [attribute, key] of [['data-hd-dlg-ok', 0x27], ['data-hd-dlg-back', 0x28]]) {
        const h = harness(); native(h); h.report.text = '农业开发度变为一百'; h.observe();
        assert.deepEqual(h.sent, []); h.click(attribute); assert.deepEqual(h.sent, [key]); assert.deepEqual(h.writes, []);
    }
});
test('battle help buttons use the real 9 wait and cannot replay into its next menu', () => {
    for (const attribute of ['data-hd-dlg-ok', 'data-hd-dlg-back']) {
        const h = harness(); battleHelp(h);
        h.onSend(() => { h.fight.inputKind = 3; h.fight.inputSeq++; h.help.active = 0; h.context.BayeHdDialog.onEngineHelp(); });
        h.click(attribute); h.click(attribute); h.timers();
        assert.deepEqual(h.sent, [0x28]); assert.equal(h.snapshot().open, false);
    }
});
test('a stale help button cannot close a new help wait or send into BUSY', () => {
    for (const kind of [0, 3, 9, 10]) {
        const h = harness(); battleHelp(h); h.fight.inputKind = kind; h.fight.inputSeq++;
        h.click('data-hd-dlg-ok'); h.click('data-hd-dlg-back'); assert.deepEqual(h.sent, []);
    }
});
test('battle and dialog keyboard ownership emit one help return and ignore repeat', () => {
    const h = harness(); battleHelp(h);
    h.onSend(() => { h.fight.inputKind = 3; h.fight.inputSeq++; h.help.active = 0; h.context.BayeHdDialog.onEngineHelp(); });
    h.key(27); h.key(27, { repeat: true }); h.timers(); assert.deepEqual(h.sent, [0x28]);
});
test('help cleanup cannot close a synchronously opened quantity dialog', () => {
    const h = harness(); battleHelp(h);
    h.onSend(() => { h.fight.inputKind = 0; h.fight.inputSeq++; h.help.active = 0;
        h.context.BayeHdDialog.openQty({ min: 1, max: 100, init: 10 }); });
    h.click('data-hd-dlg-ok');
    assert.equal(h.snapshot().open, true); assert.equal(h.snapshot().kind, 'qty'); assert.deepEqual(h.sent, [0x28]);
});
test('native form focus, composition and classic/HD switches do not submit stale reports', () => {
    const h = harness(); h.observe();
    for (const options of [{ repeat: true }, { isComposing: true }, { target: element('INPUT') }, { target: element('BUTTON') }]) h.key(13, options);
    h.context.BayeHdCityMenu.setMode('classic'); h.click('data-hd-dlg-ok'); h.context.BayeHdDialog.poll();
    h.context.BayeHdCityMenu.setMode('hd'); h.click('data-hd-dlg-ok'); assert.deepEqual(h.sent, []);
});

test('native march reports with legacy async ID zero still route by their real wait token', () => {
    const h = harness(); h.data.g_asyncActionID = 0; h.report.text = '选择目标城'; h.observe();
    assert.equal(h.snapshot().marchOwner.inputSeq, h.march.inputSeq);
    h.click('data-hd-dlg-ok'); assert.deepEqual(h.sent, [0x27]);
});
test('a pointer pressed on the old report cannot acknowledge the newly displayed one', () => {
    const h = harness(); h.observe(); const button = h.button('data-hd-dlg-ok'); h.pointerDown(button);
    h.march.inputSeq++; h.report.seq++; h.report.text = '部队已出发'; h.context.BayeHdDialog.onEngineReport();
    h.click('data-hd-dlg-ok', button); assert.deepEqual(h.sent, []);
    h.click('data-hd-dlg-ok'); assert.deepEqual(h.sent, [0x27]);
});
test('march report presentation leaves the explicit city continue control accessible', () => {
    const h = harness(); h.context.__cityState.open = true; h.observe();
    assert.equal(h.context.document.documentElement.getAttribute('data-baye-dialog-pass'), '1');
    assert.equal(h.nodes['hd-dialog'].style.pointerEvents, 'none'); assert.deepEqual(h.sent, []);
});
test('a retained native report cannot submit into the newly active map or menu', () => {
    for (const target of ['map', 'menu']) {
        const h = harness(); native(h); h.data.g_asyncActionID = 0; h.report.text = '原生报告'; h.context.BayeHdDialog.onEngineReport();
        if (target === 'map') h.march.pick = 1; else h.menu.active = 1;
        h.click('data-hd-dlg-ok'); assert.deepEqual(h.sent, []);
    }
});
test('battle toolbar help/search use the guarded controller without creating fake dialogs', () => {
    for (const [method, key] of [['openHelp', 0x26], ['openSearch', 0x33]]) {
        const h = harness(); native(h); Object.assign(h.fight, { active: 1, inputKind: 1, inputSeq: 50 });
        h.data.g_hdFightActive = 1; h.context.BayeHdBattle.onEngineFight();
        h.context.BayeHdDialog[method](); h.context.BayeHdDialog[method]();
        assert.deepEqual(h.sent, [key]); assert.equal(h.snapshot().open, false);
        const busy = harness(); native(busy); busy.fight.active = 1; busy.data.g_hdFightActive = 1;
        busy.context.BayeHdBattle.onEngineFight(); busy.context.BayeHdDialog[method]();
        assert.deepEqual(busy.sent, []); assert.equal(busy.snapshot().open, false);
    }
});
test('native speech, departure, succession and stale policy observers stay passive', () => {
    const h = harness(); native(h); h.data.g_asyncActionID = 0;
    for (const text of ['主公请下令', '部队已出发', '无人占领', '拥立新君', '农业开发度变为一百']) {
        h.report.seq++; h.report.text = text;
        h.context.BayeHdDialog.onEngineReport(); h.context.BayeHdDialog.poll();
        h.context.BayeHdDialog.dismissLeftoverSpeech();
    }
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

test('classic battle preference returns HELP9 keyboard ownership despite HD city preference', () => {
    const h = harness(); battleHelp(h);
    h.context.BayeHdBattle.setMode('classic');
    assert.equal(h.context.BayeHdCityMenu.shouldShowHd(), true);
    assert.equal(h.context.BayeHdDialog.shouldShowHd(), false);
    h.context.BayeHdDialog.poll();
    assert.equal(h.snapshot().open, false);
    assert.equal(h.key(27).defaultPrevented, false);
    assert.deepEqual(h.sent, [0x28]);
});

test('HELP9 cannot consume Enter after C opens SYSTEM6, RETREAT7 or SETTINGS8', () => {
    for (const kind of [6, 7, 8]) for (const poll of [false, true]) {
        const h = harness(); battleHelp(h);
        Object.assign(h.fight, { inputKind: kind, inputSeq: 21 });
        Object.assign(h.menu, { active: 1, context: 3, kind, names: ['第一项', '第二项'], seq: 3, index: 0 });
        // The current C wait, rather than a retained help buffer, owns input.
        h.context.BayeHdBattle.onEngineFight();
        if (poll) { h.context.BayeHdDialog.poll(); assert.equal(h.snapshot().open, false); }
        assert.equal(h.key(13).defaultPrevented, true);
        h.key(13); h.click('data-hd-dlg-ok'); h.timers();
        assert.deepEqual(h.sent, [0x27]);
    }
});

test('VIEW10 uses its page acknowledgement and never inherits HELP9 dialog ownership', () => {
    const h = harness(); battleHelp(h);
    Object.assign(h.fight, { inputKind: 10, inputSeq: 21 });
    h.context.BayeHdBattle.onEngineFight(); h.context.BayeHdDialog.poll();
    assert.equal(h.snapshot().open, false);
    h.onSend(key => { if (key === 0x22) h.fight.inputSeq++; });
    assert.equal(h.key(38).defaultPrevented, true); h.timers();
    assert.equal(h.key(13).defaultPrevented, true); h.key(13, { repeat: true });
    assert.deepEqual(h.sent, [0x22, 0x27]);
});

test('an old HELP9 pointer press cannot dismiss the next displayed help wait', () => {
    const h = harness(); battleHelp(h);
    const button = h.button('data-hd-dlg-ok'); h.pointerDown(button);
    h.fight.inputSeq++; h.context.BayeHdDialog.onEngineHelp();
    h.click('data-hd-dlg-ok', button); assert.deepEqual(h.sent, []);
    h.click('data-hd-dlg-ok'); assert.deepEqual(h.sent, [0x28]);
});

test('complete native help renders the captured identity and all real numeric fields, including zero', () => {
    const h = harness();
    detailedHelp(h);
    const body = h.nodes['hd-dialog-body'];
    assert.equal(h.nodes['hd-dialog-title'].textContent, '武将详情');
    assert.equal(body.children[0].textContent, '原生姓名');
    assert.equal(body.children[1].textContent, '骑兵 · 正常');
    assert.deepEqual(body.children[2].children.map(field => field.children.map(node => node.textContent)),
        [['等级', '1'], ['武力', '99'], ['智力', '88'], ['经验', '0'], ['生命', '0'],
            ['技能点', '0'], ['攻击', '210'], ['防御', '155'], ['兵力', '65535']]);
    assert.equal(h.snapshot().helpDetail.person, 0);
    assert.equal(h.snapshot().helpDetail.slot, 2);
    assert.equal(h.snapshot().showLcd, false);
    const before = JSON.stringify(h.help);
    Object.freeze(h.help.fields); Object.freeze(h.help);
    for (let i = 0; i < 5; i++) h.context.BayeHdDialog.poll();
    assert.equal(JSON.stringify(h.help), before);
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

test('native maximum level and custom GBK labels stay literal and never become HTML', () => {
    const h = harness();
    detailedHelp(h, { levelMax: 1, name: '<img src=x onerror=attack()>', arm: '自定义兵种', state: '自定义状态' });
    const body = h.nodes['hd-dialog-body'];
    assert.equal(body.children[0].textContent, '<img src=x onerror=attack()>');
    assert.equal(body.children[0].children.length, 0);
    assert.equal(body.children[1].textContent, '自定义兵种 · 自定义状态');
    assert.equal(body.children[2].children[0].children[1].textContent, 'MX');
    assert.deepEqual(h.sent, []);
});

test('current battle HELP owns visible fields despite a retained departure phase and city shell', () => {
    const h = harness(); detailedHelp(h);
    Object.assign(h.march, { phase: 7, pick: 1, seq: 8 });
    Object.assign(h.context.__cityState, { battleMake: true, marchReady: true, open: true });
    for (let i = 0; i < 4; i++) h.context.BayeHdDialog.poll();
    const state = h.snapshot();
    assert.equal(state.open, true); assert.equal(state.kind, 'help');
    assert.equal(state.pass, false); assert.equal(state.leftoverHelp, false);
    assert.equal(h.context.document.body.classList.contains('baye-hd-dialog-pass'), false);
    assert.equal(h.context.document.documentElement.getAttribute('data-baye-dialog-pass'), '0');
    assert.equal(h.nodes['hd-dialog'].style.pointerEvents, 'auto');
    assert.equal(h.nodes['hd-dialog-body'].children[2].children.length, 9);
    assert.equal(state.showLcd, false); assert.equal(state.helpDetail.person, 0);
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    h.help.active = 0; h.fight.inputKind = 1; h.fight.inputSeq++;
    h.context.BayeHdDialog.poll();
    assert.equal(h.snapshot().open, false); assert.equal(h.snapshot().helpOwner, null);
    assert.equal(h.snapshot().helpDetail, null);
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

test('an incomplete current battle HELP keeps its LCD and return control above retained march state', () => {
    const h = harness(); detailedHelp(h, {complete: 0});
    Object.assign(h.march, {phase: 7, pick: 1});
    Object.assign(h.context.__cityState, {battleMake: true, open: true});
    h.context.BayeHdDialog.poll();
    assert.equal(h.snapshot().pass, false); assert.equal(h.snapshot().leftoverHelp, false);
    assert.equal(h.snapshot().helpDetail, null); assert.equal(h.snapshot().showLcd, true);
    assert.equal(h.nodes['hd-dialog'].style.pointerEvents, 'auto');
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    h.click('data-hd-dlg-back'); h.click('data-hd-dlg-back');
    assert.deepEqual(h.sent, [0x28]); assert.deepEqual(h.writes, []);
});

test('incomplete, stale and malformed native help keeps LCD and never invents structured fields', () => {
    const malformed = [
        { complete: 0 }, { generation: 6 }, { inputSeq: 19 }, { protocolVersion: 0 },
        { seq: 0 }, { person: 65535 }, { slot: 20 }, { name: '' }, { state: '' },
        { levelMax: '1' }, { fields: [1, 2] },
        { fields: [1, 2, 3, 4, null, 6, 7, 8, 9, 0] },
        { fields: [1, 2, 3, 4, '0', 6, 7, 8, 9, 0] },
        { fields: [1, 2, 3, 4, NaN, 6, 7, 8, 9, 0] }
    ];
    for (const changes of malformed) {
        const h = harness(); detailedHelp(h, changes);
        assert.equal(h.snapshot().helpDetail, null, JSON.stringify(changes));
        assert.equal(h.snapshot().showLcd, true);
        assert.equal(h.nodes['hd-dialog-body'].children.length, 0);
        assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-help-person'), '');
        if ('generation' in changes || 'inputSeq' in changes) assert.equal(h.snapshot().body, '', 'retained text belongs to its original native wait');
        assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    }
});

test('actual terrain help displays its complete native description while custom help retains LCD', () => {
    const h = harness();
    detailedHelp(h, { kind: 2, person: 65535, slot: 255, x: 3, y: 4, terrain: 0,
        text: '地形：平原|原生完整说明' });
    assert.equal(h.nodes['hd-dialog-title'].textContent, '地形帮助');
    assert.equal(h.nodes['hd-dialog-body'].textContent, '地形：平原\n原生完整说明');
    assert.equal(h.snapshot().helpDetail.terrain, 0);
    assert.equal(h.snapshot().showLcd, false);
    h.help.complete = 0; h.help.seq++; h.help.text = 'Custom terrain help, no inferred bonuses';
    h.context.BayeHdDialog.onEngineHelp();
    assert.equal(h.snapshot().helpDetail, null);
    assert.equal(h.snapshot().showLcd, true);
    assert.equal(h.nodes['hd-dialog-body'].textContent, h.help.text);
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    h.help.complete = 1; h.help.terrain = 255; h.help.seq++;
    h.context.BayeHdDialog.onEngineHelp();
    assert.equal(h.snapshot().helpDetail, null, 'unknown native terrain class cannot become complete HD terrain');
    assert.equal(h.snapshot().showLcd, true);
});

test('LCD choice survives polling but a new help publication retires its former fields', () => {
    const h = harness(); detailedHelp(h);
    h.click('data-hd-dlg-lcd'); assert.equal(h.snapshot().showLcd, true);
    h.context.BayeHdDialog.poll(); assert.equal(h.snapshot().showLcd, true);
    h.click('data-hd-dlg-lcd'); assert.equal(h.snapshot().showLcd, false);
    h.help.complete = 0; h.help.seq++; h.context.BayeHdDialog.onEngineHelp();
    assert.equal(h.snapshot().showLcd, true);
    assert.equal(h.snapshot().helpDetail, null);
    assert.equal(h.nodes['hd-dialog-body'].children.length, 0);
    assert.deepEqual(h.sent, []);
});

test('old help publication and pointer tickets cannot acknowledge a newer native detail event', () => {
    for (const field of ['seq', 'generation', 'detailGeneration']) {
        const h = harness(); detailedHelp(h); h.help[field]++;
        h.click('data-hd-dlg-back'); assert.deepEqual(h.sent, [], field);
    }
    const h = harness(); detailedHelp(h);
    const button = h.button('data-hd-dlg-back'); h.pointerDown(button);
    h.help.seq++; h.help.person = 1; h.help.name = '新人物'; h.context.BayeHdDialog.onEngineHelp();
    h.click('data-hd-dlg-back', button); assert.deepEqual(h.sent, []);
    h.click('data-hd-dlg-back'); h.click('data-hd-dlg-back');
    assert.deepEqual(h.sent, [0x28]);
});

test('hidden, unready, classic and ended help views retire fields without native writes or automatic input', () => {
    for (const reason of ['hidden', 'unready', 'classic', 'ended']) {
        const h = harness(); detailedHelp(h);
        if (reason === 'hidden') h.context.document.hidden = true;
        if (reason === 'unready') h.context.baye.hd.ready = () => false;
        if (reason === 'classic') h.context.BayeHdBattle.setMode('classic');
        if (reason === 'ended') { h.help.active = 0; h.fight.inputKind = 3; h.fight.inputSeq++; }
        h.context.BayeHdDialog.poll(); h.click('data-hd-dlg-back');
        assert.equal(h.snapshot().open, false, reason); assert.equal(h.snapshot().helpDetail, null, reason);
        assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    }
});

test('a real native report outranks a retained help detail and help observation cannot acknowledge either', () => {
    const h = harness(); detailedHelp(h);
    Object.assign(h.report, { active: 1, inputSeq: 60, seq: 9, text: '实际损伤报告' });
    h.context.BayeHdDialog.onEngineHelp();
    assert.equal(h.snapshot().kind, 'report'); assert.equal(h.snapshot().helpDetail, null);
    assert.equal(h.snapshot().body, '实际损伤报告');
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

test('menu help/search page the actual native list without creating a speculative result dialog', () => {
    for (const [method, code] of [['openHelp', 0x26], ['openSearch', 0x33]]) {
        const h = harness(); native(h);
        Object.assign(h.menu, { active: 1, context: 1, kind: 3, count: 2, names: ['甲', '乙'] });
        h.context.BayeHdDialog[method]();
        assert.deepEqual(h.sent, [code]); assert.equal(h.snapshot().open, false);
        assert.deepEqual(h.writes, []);
    }
});

test('hidden and unready help/search controls cannot queue keys before a native view exists', () => {
    for (const method of ['openHelp', 'openSearch']) for (const reason of ['hidden', 'unready']) {
        const h = harness(); native(h);
        if (reason === 'hidden') h.context.document.hidden = true;
        else h.context.baye.hd.ready = () => false;
        assert.equal(h.context.BayeHdDialog[method](), false);
        assert.equal(h.snapshot().open, false); assert.deepEqual(h.sent, []);
    }
});

test('malformed native wait metadata cannot own an otherwise complete help page', () => {
    for (const changes of [{ inputKind: '9' }, { inputSeq: '20' }, { inputSeq: 0 },
        { active: 2 }, { over: undefined }]) {
        const h = harness(); detailedHelp(h); Object.assign(h.fight, changes);
        h.context.BayeHdDialog.onEngineHelp(); h.click('data-hd-dlg-back');
        assert.equal(h.snapshot().open, false); assert.equal(h.snapshot().helpDetail, null);
        assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    }
});

test('native map help can return once, but its stale controls never acknowledge a newer list or report', () => {
    function mapHelp() {
        const h = harness(); native(h);
        Object.assign(h.help, { active: 1, protocolVersion: 1, seq: 4, kind: 0,
            complete: 0, generation: 0, detailGeneration: 7, inputSeq: 0, text: 'Ver native' });
        h.context.BayeHdDialog.onEngineHelp();
        return h;
    }
    const live = mapHelp(); live.click('data-hd-dlg-back'); live.click('data-hd-dlg-back');
    assert.deepEqual(live.sent, [0x28]);
    for (const changed of ['seq', 'inactive', 'menu', 'qty', 'report']) {
        const h = mapHelp();
        if (changed === 'seq') h.help.seq++;
        if (changed === 'inactive') h.help.active = 0;
        if (changed === 'menu') h.menu.active = 1;
        if (changed === 'qty') h.qty.active = 1;
        if (changed === 'report') Object.assign(h.report, { active: 1, inputSeq: 12 });
        h.click('data-hd-dlg-ok'); h.click('data-hd-dlg-back');
        assert.deepEqual(h.sent, [], changed);
    }
});

test('VIEW renders only the captured native page with slot zero, U16 identities and same names', () => {
    const h = harness();
    let nameReads = 0;
    h.context.baye.getPersonName = () => { nameReads++; return 'invented name'; };
    detailedView(h);
    assert.equal(h.snapshot().kind, 'view'); assert.equal(h.snapshot().showLcd, false);
    const body = h.nodes['hd-dialog-body'];
    const rows = body.querySelectorAll('.hd-situation-row');
    assert.deepEqual(rows.map(row => [row.getAttribute('data-hd-view-slot'), row.getAttribute('data-hd-view-person'), row.textContent]),
        [['0', '0', '同名兵 0'], ['1', '600', '同名兵 65535']]);
    assert.deepEqual(rows.map(row => row.getAttribute('aria-label')), ['同名 0', '同名 65535']);
    assert.equal(body.querySelectorAll('.hd-situation-page')[0].textContent, '将领 1–2 / 3');
    const map = body.querySelectorAll('.hd-situation-map')[0], points = map.children;
    assert.equal(map.style.aspectRatio, '8 / 6');
    assert.deepEqual(points.map(point => [point.style.left, point.style.top]),
        [['6.25%', '8.333333333333332%'], ['93.75%', '91.66666666666666%'], ['43.75%', '41.66666666666667%']]);
    assert.match(points[0].className, /is-player is-page/);
    assert.match(points[2].className, /is-enemy$/);
    assert.equal(points[2].title, '敌方位置 · 3,2', 'off-page points do not invent a name or leak another page');
    const observed = JSON.stringify(h.view);
    Object.freeze(h.view.rows[0]); Object.freeze(h.view.rows[1]); Object.freeze(h.view.rows);
    h.view.points.forEach(Object.freeze); Object.freeze(h.view.points); Object.freeze(h.view);
    h.context.BayeHdDialog.poll(); h.context.BayeHdDialog.onEngineView();
    assert.equal(JSON.stringify(h.view), observed); assert.equal(nameReads, 0);
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

test('VIEW sends one guarded arrow then waits for the native page ACK without local page prediction', () => {
    const h = harness(); detailedView(h); const calls = spyViewActions(h);
    const down = viewButton(h, 0x23);
    h.click('data-hd-view-key', down); h.click('data-hd-view-key', down); h.timers();
    assert.deepEqual(h.sent, [0x23]);
    assert.deepEqual(calls, [[0x23, { kind: 10, seq: 3, generation: 7, inputSeq: 60 }]]);
    assert.equal(h.snapshot().viewDetail.pageStart, 0);
    assert.equal(h.snapshot().viewDetail.force, 0);
    assert.equal(h.snapshot().viewPending, true);
    assert.equal(viewButton(h, 0x23).disabled, true);
    publishView(h, { pageStart: 2, rowCount: 1,
        rows: [{ slot: 2, personIndex: 700, name: '同名', text: '同名 12', arms: 12 }] });
    assert.equal(h.snapshot().viewDetail.pageStart, 2); assert.equal(h.snapshot().viewPending, false);
    assert.equal(viewButton(h, 0x23).disabled, false);
    assert.equal(h.nodes['hd-dialog-body'].querySelectorAll('.hd-situation-page')[0].textContent, '将领 3–3 / 3');
    h.click('data-hd-view-key', viewButton(h, 0x25));
    assert.deepEqual(h.sent, [0x23, 0x25]);
    assert.equal(h.snapshot().viewDetail.force, 0, 'an arrow cannot locally toggle the force');
    publishView(h, { force: 1, pageStart: 0, totalCount: 1, rowCount: 1, foodKnown: 0, food: 0,
        foodText: '粮草：未知', rows: [{ slot: 10, personIndex: 99, name: '敌将', text: '敌将 4', arms: 4 }] });
    assert.equal(h.snapshot().viewDetail.force, 1);
    assert.equal(h.snapshot().viewDetail.foodKnown, 0);
    assert.equal(h.nodes['hd-dialog-body'].querySelectorAll('.hd-situation-food')[0].textContent, '粮草：未知');
    assert.deepEqual(h.writes, []);
});

test('VIEW footer returns once through the complete current native owner', () => {
    const h = harness(); detailedView(h); const calls = spyViewActions(h);
    h.onSend(() => { h.view.active = 0; h.fight.inputKind = 1; h.fight.inputSeq++; });
    h.click('data-hd-dlg-ok'); h.click('data-hd-dlg-ok'); h.key(13, { repeat: true }); h.timers();
    assert.deepEqual(h.sent, [0x27]);
    assert.deepEqual(calls, [[0x27, { kind: 10, seq: 3, generation: 7, inputSeq: 60 }]]);
    assert.equal(h.snapshot().open, false); assert.equal(h.snapshot().viewDetail, null);
    assert.deepEqual(h.writes, []);
});

test('VIEW classic comparison changes no inputs and survives native page and force changes', () => {
    const h = harness(); detailedView(h);
    h.click('data-hd-dlg-lcd'); h.context.BayeHdDialog.poll();
    assert.equal(h.snapshot().showLcd, true);
    assert.equal(h.context.document.body.classList.contains('baye-hd-dialog-lcd'), true);
    publishView(h, { pageStart: 2, rowCount: 1,
        rows: [{ slot: 2, personIndex: 700, name: '新页', text: '新页 12', arms: 12 }] });
    assert.equal(h.snapshot().showLcd, true);
    publishView(h, { force: 1, pageStart: 0, totalCount: 1, rowCount: 1, foodKnown: 0,
        foodText: '原生未知粮草', rows: [{ slot: 10, personIndex: 99, name: '敌将', text: '敌将 4', arms: 4 }] });
    assert.equal(h.snapshot().showLcd, true);
    h.click('data-hd-dlg-lcd'); assert.equal(h.snapshot().showLcd, false);
    assert.equal(h.context.document.body.classList.contains('baye-hd-dialog-lcd'), false);
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

test('VIEW malformed, incomplete and custom snapshots retire HD presentation and preserve native fallback', () => {
    const cases = [
        { complete: 0 }, { custom: 1 }, { protocolVersion: 2 }, { active: 0 },
        { seq: 0 }, { seq: '3' }, { generation: 0 }, { detailGeneration: 8 }, { inputSeq: 59 },
        { width: 0 }, { height: true }, { force: 2 }, { pageStart: 4 }, { pageSize: 0 },
        { rowCount: 1 }, { totalCount: 11 }, { leaderPerson: 65535 }, { foodKnown: 2 },
        { force: 1, foodKnown: 0, food: 900 }, { food: '0' }, { title: '' },
        { rows: [{ slot: 0, personIndex: 0, name: '甲', text: '甲 0', arms: 0 }] },
        { rows: [{ slot: 1, personIndex: 0, name: '甲', text: '甲 0', arms: 0 },
            { slot: 0, personIndex: 600, name: '乙', text: '乙 0', arms: 0 }] },
        { points: [{ slot: 0, personIndex: 0, x: 8, y: 0, state: 0 }] },
        { points: [{ slot: 0, personIndex: 0, x: 0, y: 0, state: 8 }] },
        { points: [{ slot: 0, personIndex: 0, x: 0, y: 0, state: 0 },
            { slot: 0, personIndex: 1, x: 1, y: 1, state: 0 }] }
    ];
    for (const changes of cases) {
        const h = harness(); detailedView(h); const button = viewButton(h, 0x23);
        Object.assign(h.view, changes);
        h.context.BayeHdDialog.onEngineView(); h.context.BayeHdDialog.poll();
        h.click('data-hd-view-key', button); h.click('data-hd-dlg-ok');
        assert.equal(h.snapshot().viewDetail, null, JSON.stringify(changes));
        assert.equal(h.snapshot().viewOwner, null);
        assert.equal(h.snapshot().open, false);
        assert.equal(h.context.document.body.classList.contains('baye-hd-battle-lcd'), true,
            'VIEW native input owns its LCD fallback');
        assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    }
});

test('VIEW stops owning controls on hidden, classic, reset, ended, report and competing native waits', () => {
    for (const reason of ['hidden', 'unready', 'classic', 'reset', 'ended', 'report', 'menu', 'qty']) {
        const h = harness(); detailedView(h); const calls = spyViewActions(h), button = viewButton(h, 0x23);
        h.pointerDown(button);
        if (reason === 'hidden') h.context.document.hidden = true;
        if (reason === 'unready') h.context.baye.hd.ready = () => false;
        if (reason === 'classic') h.context.BayeHdBattle.setMode('classic');
        if (reason === 'reset') h.context.BayeHdDialog.onEngineHook('didLoadGame');
        if (reason === 'ended') { h.fight.active = 0; h.data.g_hdFightActive = 0; h.view.active = 0; }
        if (reason === 'report') Object.assign(h.report, { active: 1, inputSeq: 90, seq: 12, text: '实际报告' });
        if (reason === 'menu') h.menu.active = 1;
        if (reason === 'qty') h.qty.active = 1;
        if (reason !== 'reset') h.context.BayeHdDialog.poll();
        h.click('data-hd-view-key', button);
        assert.equal(h.snapshot().viewDetail, null, reason);
        assert.equal(h.snapshot().viewOwner, null, reason);
        assert.deepEqual(calls, [], reason); assert.deepEqual(h.sent, [], reason); assert.deepEqual(h.writes, [], reason);
    }
});

test('pressed VIEW page, LCD and footer controls cannot transfer into newer VIEW or HELP owners', () => {
    for (const attribute of ['data-hd-view-key', 'data-hd-dlg-lcd', 'data-hd-dlg-ok']) {
        for (const next of ['page', 'generation', 'help']) {
            const h = harness(); detailedView(h); const calls = spyViewActions(h);
            const button = attribute === 'data-hd-view-key' ? viewButton(h, 0x23) : h.button(attribute);
            h.pointerDown(button);
            if (next === 'help') detailedHelp(h);
            else publishView(h, next === 'generation' ? { generation: 8, detailGeneration: 8 } : {});
            const choice = h.snapshot().showLcd;
            h.click(attribute, button);
            assert.deepEqual(h.sent, [], attribute + ':' + next); assert.deepEqual(calls, []);
            assert.equal(h.snapshot().showLcd, choice);
            assert.equal(h.snapshot().open, true);
        }
    }
    const h = harness(); detailedView(h); const stale = viewButton(h, 0x23);
    publishView(h);
    h.click('data-hd-view-key', stale); assert.deepEqual(h.sent, []);
    h.click('data-hd-view-key', viewButton(h, 0x23)); assert.deepEqual(h.sent, [0x23]);
});

test('a press on old VIEW control A cannot arm rebuilt control B or another current control', () => {
    for (const pressedAttribute of ['data-hd-view-key', 'data-hd-dlg-ok', 'data-hd-dlg-back', 'data-hd-dlg-lcd']) {
        for (const clickedAttribute of ['data-hd-view-key', 'data-hd-dlg-ok', 'data-hd-dlg-back', 'data-hd-dlg-lcd']) {
            for (const newPage of [false, true]) {
                const h = harness(); detailedView(h); const calls = spyViewActions(h);
                const old = pressedAttribute === 'data-hd-view-key' ? viewButton(h, 0x23) : h.button(pressedAttribute);
                h.pointerDown(old);
                if (newPage) publishView(h);
                const current = clickedAttribute === 'data-hd-view-key' ? viewButton(h, 0x25) : h.button(clickedAttribute);
                assert.notEqual(old, current);
                const before = h.snapshot();
                h.click(clickedAttribute, current);
                assert.deepEqual(h.sent, [], pressedAttribute + ':' + clickedAttribute + ':' + newPage);
                assert.deepEqual(calls, []); assert.equal(h.snapshot().showLcd, before.showLcd);
                assert.equal(h.snapshot().open, true);
            }
        }
    }
    const h = harness(); detailedView(h); const old = viewButton(h, 0x23);
    h.pointerDown(old); publishView(h); const rebuilt = viewButton(h, 0x23);
    assert.notEqual(old, rebuilt);
    h.click('data-hd-view-key', rebuilt); assert.deepEqual(h.sent, []);
    h.pointerDown(rebuilt); h.click('data-hd-view-key', rebuilt);
    assert.deepEqual(h.sent, [0x23], 'a fresh physical press may explicitly arm the new native owner');
});

test('public VIEW action requires exact owner and rejects hot payload edits until a new native publication', () => {
    const h = harness(); detailedView(h); const calls = spyViewActions(h);
    const owner = JSON.parse(JSON.stringify(h.snapshot().viewOwner));
    for (const bad of [undefined, { ...owner, seq: 4 }, { ...owner, generation: 8 },
        { ...owner, inputSeq: 61 }, { ...owner, kind: 9 }]) {
        assert.equal(h.context.BayeHdDialog.viewKey(0x23, bad), false);
    }
    assert.equal(h.context.BayeHdDialog.viewKey(0x99, owner), false);
    h.view.rows[0].arms = 4;
    assert.equal(h.context.BayeHdDialog.viewKey(0x23, owner), false);
    assert.deepEqual(calls, []); assert.deepEqual(h.sent, []);
    h.context.BayeHdDialog.onEngineView();
    assert.equal(h.context.BayeHdDialog.viewKey(0x23, owner), true);
    assert.deepEqual(calls, [[0x23, owner]]); assert.deepEqual(h.sent, [0x23]);
});

test('the controller rechecks VIEW publication immediately before sending through an unchanged fight wait', () => {
    for (const field of ['seq', 'generation', 'active']) {
        const h = harness(); detailedView(h);
        const owner = JSON.parse(JSON.stringify(h.snapshot().viewOwner));
        let reads = 0;
        h.context.baye.hd.fight = () => {
            if (++reads === 2) {
                if (field === 'active') h.view.active = 0;
                else h.view[field]++;
                if (field === 'generation') h.view.detailGeneration++;
            }
            return h.fight;
        };
        h.context.BayeHdBattle.viewKey(0x23, owner); h.timers();
        assert.ok(reads >= 2, 'the actual production controller reads its wait again before emission');
        assert.equal(h.fight.inputKind, 10); assert.equal(h.fight.inputSeq, 60);
        assert.deepEqual(h.sent, [], field); assert.deepEqual(h.writes, [], field);
    }
});

test('VIEW observes native empty pages and known enemy food zero without deriving a secret supply', () => {
    const h = harness();
    h.data.g_FgtParam.EProvender = 65535;
    detailedView(h, { force: 1, totalCount: 0, rowCount: 0, rows: [], points: [],
        foodKnown: 1, food: 0, foodText: '原生已知粮草零' });
    assert.equal(h.snapshot().viewDetail.food, 0); assert.equal(h.snapshot().viewDetail.foodKnown, 1);
    assert.equal(h.nodes['hd-dialog-body'].querySelectorAll('.hd-situation-page')[0].textContent, '当前页没有将领');
    assert.equal(h.nodes['hd-dialog-body'].querySelectorAll('.hd-situation-row').length, 0);
    assert.equal(h.nodes['hd-dialog-body'].textContent.includes('65535'), false);
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

function mobileReportFixture() {
    const h = harness(); native(h);
    const identity = {status: 'ready', generation: 8, byteLength: 207195,
        sha256: '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'};
    h.context.BayeHdLibIdentity = {read: () => identity, isCurrent: value => value === identity};
    h.context.BayeHdCityMenu.shouldShowHd = () => true;
    const fields = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdSpeGeneration', 'g_hdMapCity',
        'g_hdMapPick', 'g_hdMapInputSeq', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind',
        'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex', 'g_hdReportActive', 'g_hdReportSeq',
        'g_hdReportInputSeq', 'g_hdQtyActive', 'g_hdQtySession', 'g_hdQtyInputSeq',
        'g_hdHelpActive', 'g_hdHelpSeq', 'g_hdHelpInputSeq', 'g_hdMarchSession', 'g_hdMarchInputSeq',
        'g_hdMarchPhase', 'g_hdFightActive', 'g_hdMovieActive', 'g_hdRecordActive'];
    Object.assign(h.data, Object.fromEntries(fields.map(key => [key, 0])), {
        g_hdEngineReady: 1, g_hdDetailGeneration: 4, g_hdSpeGeneration: 4,
        g_hdReportActive: 1, g_hdReportSeq: 9, g_hdReportInputSeq: 12});
    Object.assign(h.report, {active: 1, seq: 9, inputSeq: 12, text: '城中农业已经得到改善。'});
    h.available = true; h.identity = identity;
    h.context.BayeHdDialog.configureMobileHost({isAvailable: () => h.available});
    h.observe(); h.sent.length = 0; h.writes.length = 0;
    return h;
}
test('mobile report requires a complete current original owner and confirms exactly once', () => {
    const h = mobileReportFixture(), dialog = h.context.BayeHdDialog;
    assert.ok(dialog.getInputTicket()); assert.equal(dialog.isActive(), true);
    h.click('data-hd-dlg-ok'); h.click('data-hd-dlg-ok');
    assert.deepEqual(h.sent, [0x27]); assert.deepEqual(h.writes, []);
});
test('mobile report host lifecycle retires the pending view without acknowledging it', () => {
    for (const cause of ['portrait', 'hidden', 'identity', 'unready']) {
        const h = mobileReportFixture(), dialog = h.context.BayeHdDialog;
        if (cause === 'portrait') h.available = false;
        if (cause === 'hidden') h.context.document.hidden = true;
        if (cause === 'identity') h.identity.generation = 0;
        if (cause === 'unready') h.data.g_hdEngineReady = 0;
        assert.equal(dialog.getInputTicket(), null, cause);
        dialog.retireInteraction(); h.timers(); h.click('data-hd-dlg-ok');
        assert.deepEqual(h.sent, [], cause); assert.deepEqual(h.writes, [], cause);
    }
});
test('mobile report rejects owner rollover, incomplete raw fields, stale text and replaced data', () => {
    for (const mutate of [h => h.data.g_hdReportSeq++, h => h.data.g_hdReportInputSeq++,
        h => delete h.data.g_hdReportActive, h => h.report.inputSeq++,
        h => h.report.text = '新的报告不能沿用旧文字。', h => h.identity.sha256 = 'wrong',
        h => h.context.baye.data = {...h.data}]) {
        const h = mobileReportFixture(); mutate(h);
        assert.equal(h.context.BayeHdDialog.getInputTicket(), null);
        h.click('data-hd-dlg-ok'); h.timers();
        assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    }
});
test('retiring mobile report then observing its still live native owner needs a fresh action', () => {
    const h = mobileReportFixture(), dialog = h.context.BayeHdDialog;
    const old = dialog.getInputTicket().key; dialog.retireInteraction();
    assert.equal(dialog.isActive(), false); h.observe();
    assert.notEqual(dialog.getInputTicket().key, old);
    assert.deepEqual(h.sent, []); h.click('data-hd-dlg-back');
    assert.deepEqual(h.sent, [0x28]); assert.deepEqual(h.writes, []);
});

test('mobile final send rechecks getters and a rejected acknowledgement does not poison the restored report', () => {
    const h = mobileReportFixture(), dialog = h.context.BayeHdDialog;
    const fight = h.context.baye.hd.fight; let calls = 0;
    h.context.baye.hd.fight = () => { if (++calls === 3) h.available = false; return fight(); };
    h.click('data-hd-dlg-ok'); assert.deepEqual(h.sent, []);
    h.available = true; h.context.baye.hd.fight = fight; h.observe();
    assert.ok(dialog.getInputTicket()); h.click('data-hd-dlg-ok');
    assert.deepEqual(h.sent, [0x27]); assert.deepEqual(h.writes, []);
});
test('mobile initial native quantity input sequence zero is a current session', () => {
    const h = mobileReportFixture(), dialog = h.context.BayeHdDialog;
    h.report.active = 0; h.data.g_hdReportActive = 0;
    Object.assign(h.qty, {protocol: true, active: 1, ready: 1, session: 7, inputSeq: 0, min: 0, max: 100, value: 0});
    Object.assign(h.data, {g_hdQtyActive: 1, g_hdQtySession: 7, g_hdQtyInputSeq: 0});
    dialog.openQty({}); assert.ok(dialog.getInputTicket());
    assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});
