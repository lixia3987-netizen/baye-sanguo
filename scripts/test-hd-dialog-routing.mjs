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
        querySelectorAll() { return []; },
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
            march: () => march, fight: () => fight, help: () => help, qty: () => qty,
            menuItems: () => menu, movie: () => ({ active: 0 }) } };
    load('js/hd-city-menu.js', `global.__cityState = state; render = function () {}; scheduleMarchWatch = function () {};`);
    Object.assign(context.__cityState, { battleMake: true, marchSession: 7, marchOriginIndex: 0,
        cityIndex: 0, deepKind: 'person-city', layer: 'deep', open: false });
    load('js/hd-battle.js'); load('js/hd-dialog.js');
    context.BayeHdBattle.start(); context.BayeHdDialog.start();
    document.onkeydown = context.onKeyDown;
    writes.length = 0;
    return { context, nodes, data: rawData, report, march, fight, help, qty, menu, sent, writes,
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
