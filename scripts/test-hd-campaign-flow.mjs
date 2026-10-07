#!/usr/bin/env node
/** Campaign inputs stay owned by C through results, succession and a new march. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const VK = { UP: 0x22, DOWN: 0x23, ENTER: 0x27, EXIT: 0x28 };
function element(tagName = 'DIV') {
    const attrs = new Map(), listeners = new Map(), classes = new Map();
    return { tagName, attrs, listeners, children: [], style: {},
        get textContent() { return this.text ?? ''; },
        set textContent(value) { this.text = value; this.children = []; },
        get innerHTML() { return this.html ?? ''; },
        set innerHTML(value) { this.html = value; this.children = []; },
        classList: { toggle(key, value) { classes.set(key, value); }, add(key) { classes.set(key, true); },
            remove(key) { classes.delete(key); }, contains(key) { return !!classes.get(key); } },
        setAttribute(key, value) { attrs.set(key, String(value)); }, getAttribute(key) { return attrs.get(key) ?? null; },
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
        querySelector(selector) {
            const attribute = /^\[([^\]]+)\]$/.exec(selector)?.[1];
            for (const child of this.children) {
                if (attribute && child.getAttribute(attribute) != null) return child;
                const found = child.querySelector(selector); if (found) return found;
            }
            return null;
        },
        querySelectorAll() { return []; }, appendChild(child) { child.parentNode = this; this.children.push(child); } };
}
function harness() {
    let clock = 0, nextTimer = 0, onSend = () => {};
    const timers = new Map(), intervals = [], keys = [], writes = [], listeners = [];
    const nodes = Object.fromEntries(['hd-dialog', 'hd-dialog-body', 'hd-dialog-title', 'hd-city-menu', 'hd-city-menu-deep', 'hd-battle']
        .map(id => [id, element()]));
    nodes['hd-city-menu'].appendChild(nodes['hd-city-menu-deep']);
    const document = { body: element('BODY'), documentElement: element('HTML'),
        getElementById: id => nodes[id] ?? null, querySelector: () => null, querySelectorAll: () => [], createElement: element,
        addEventListener(type, fn) { if (type === 'keydown') listeners.push(fn); } };
    const storage = { 'baye/overworldMode': 'hd-map', 'baye/battleMode': 'hd',
        getItem(key) { return this[key] ?? null; }, setItem(key, value) { this[key] = String(value); } };
    const report = { active: 0, inputSeq: 30, seq: 10, kind: 1, person: 65535, text: '我军大获全胜' };
    const march = { phase: 7, session: 5, origin: 1, selected: 2, inputSeq: 20, seq: 3,
        ok: 1, city: 1, obj: 2, mapCity: 2, mapInputSeq: 9, pick: 0, battlePick: 0 };
    const menu = { active: 0, context: 0, kind: 0, seq: 20, index: 0, names: [] };
    const fight = { active: 0, over: 1, inputKind: 0, inputSeq: 20, actorIndex: 255 };
    const qty = { protocol: false, active: 0, min: 1, max: 200, value: 100 };
    const rawData = { g_asyncActionID: 0, g_FgtOver: 1, g_hdFightActive: 0, g_hdFightOver: 1,
        g_hdFightWait: 0, g_hdMapPick: 0, g_hdBattlePick: 0, g_hdQtyActive: 0,
        g_hdQtyMin: 1, g_hdQtyMax: 200, g_hdQtyValue: 100, g_hdReportGbk: report.text,
        g_PlayerKing: 0, g_PIdx: 1, g_Cities: [{ Belong: 1 }, { Belong: 1 }, { Belong: 2 }],
        g_CityPos: { setx: 2, sety: 1 }, g_FoucsX: 0, g_FoucsY: 0,
        g_MapWid: 8, g_MapHgt: 8, g_FgtParam: { GenArray: [] }, g_GenPos: [] };
    const data = new Proxy(rawData, { set(target, key, value) { writes.push([key, value]); target[key] = value; return true; } });
    const context = vm.createContext({ document, localStorage: storage,
        console: { log() {}, warn() {}, error() {} }, innerWidth: 1000, innerHeight: 600,
        navigator: { userAgent: 'Node test' }, devicePixelRatio: 1,
        VK_UP: 0x22, VK_DOWN: 0x23, VK_LEFT: 0x24, VK_RIGHT: 0x25, VK_HELP: 0x26, VK_SEARCH: 0x33,
        Date: class extends Date { static now() { return clock; } },
        setTimeout(fn, delay = 0) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id; },
        clearTimeout(id) { timers.delete(id); }, setInterval(fn) { intervals.push(fn); return ++nextTimer; },
        clearInterval() {}, requestAnimationFrame() { return ++nextTimer; }, cancelAnimationFrame() {},
        addEventListener() {}, bayeInputIgnored: event => !!event.defaultPrevented,
        bayeConsumeKeyEvent(event) { event.defaultPrevented = true; },
        sendKey(key) { keys.push(key); onSend(key); },
        baye: { data, ensureData: () => data, hdEngineReady: () => true, hdCityLimit: () => 3,
            getCityName: id => ['西凉', '天水', '河内'][id], getPersonName: () => '', hooks: {},
            hd: { ready: () => true, report: () => report, reportText: () => report.text,
                march: () => march, menuItems: () => menu, fight: () => fight, qty: () => qty,
                movie: () => ({ active: 0 }), help: () => ({ active: 0, text: '' }) } } });
    context.window = context;
    // These campaign snapshots expose the legacy four-field quantity bridge.
    // Use the actual shared input helpers without loading LCD presentation.
    const lcdSource = readFileSync(new URL('../js/lcd.js', import.meta.url), 'utf8');
    vm.runInContext(lcdSource.slice(lcdSource.indexOf('function bayeQtyStepKeys('),
        lcdSource.indexOf('function onKeyDown(')), context, { filename: 'js/lcd.js quantity helpers' });
    function load(path, expose = '') {
        let source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
        if (expose) source = source.replace(/\}\)\(window\);\s*$/, expose + '\n})(window);');
        vm.runInContext(source, context, { filename: path });
    }
    load('js/hd-city-menu.js', `global.__cityState = state;
        global.__cityChooseDeep = chooseDeep;
        global.__cityFillDeep = fillDeepList; global.__cityBindUi = bindUi;
        global.__cityCleanup = { reports: clearLeftoverCityReports, disaster: clearStaleDisasterReport,
            overlay: dismissMarchOverlay, sweep: sweepStickyMarch };
        render = function () {}; applyDocAttr = function () {}; scheduleMarchWatch = function () {};`);
    load('js/hd-battle.js');
    load('js/hd-dialog.js');
    load('js/hd-overworld.js', `global.__world = { state: state, phase: inferPhase, hook: onHook };
        applyChrome = function () {}; sampleCities = function () {};`);
    Object.assign(context.__world.state, { mode: 'hd-map', phase: 'other',
        cities: [{ index: 0, name: '西凉', kind: 'owned', engX: 1, engY: 0 },
            { index: 1, name: '天水', kind: 'owned', engX: 2, engY: 1 },
            { index: 2, name: '河内', kind: 'enemy', engX: 3, engY: 1 }] });
    context.BayeHdBattle.start(); context.BayeHdDialog.start(); writes.length = 0;
    return { context, report, march, menu, fight, qty, data: rawData, nodes, keys, writes,
        city: context.__cityState, world: context.__world.state, dialog: context.BayeHdDialog,
        phase: () => context.__world.phase(),
        send(fn) { onSend = fn; }, poll() { context.BayeHdBattle.onEngineFight(); context.BayeHdDialog.poll(); },
        hook(name) { context.__world.hook(name, {}); },
        tick(ms = 10000) {
            const end = clock + ms; let runs = 0;
            while (timers.size) {
                const [id, item] = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                if (item.at > end) break;
                assert.ok(++runs < 2000, 'waiting work must not generate retry bursts');
                timers.delete(id); clock = item.at; item.fn();
            }
            clock = end;
        },
        captured() { return [...timers.values()].map(item => item.fn); },
        key(keyCode, repeat = false) { const event = { keyCode, repeat, defaultPrevented: false };
            context.BayeHdBattle.handleKey(event); listeners.forEach(fn => fn(event)); return event; },
        button(attribute, value = '') { const target = element('BUTTON'); target.setAttribute(attribute, value); target.parentNode = nodes['hd-dialog']; return target; },
        click(attribute, oldTarget) { const target = oldTarget ?? this.button(attribute);
            for (const fn of nodes['hd-dialog'].listeners.get('click') ?? []) fn({ target, preventDefault() {} }); },
        press(target) { for (const fn of nodes['hd-dialog'].listeners.get('pointerdown') ?? []) fn({ target }); },
        cityButtons() { return nodes['hd-city-menu-deep'].children.filter(node => node.getAttribute('data-hd-deep') != null); },
        cityRender() { context.__cityFillDeep(); context.__cityBindUi(); },
        cityPress(target) { for (const fn of nodes['hd-city-menu'].listeners.get('pointerdown') ?? []) fn({ target }); },
        cityClick(target) { for (const fn of nodes['hd-city-menu'].listeners.get('click') ?? [])
            fn({ target, preventDefault() {}, stopPropagation() {} }); },
        defenseButtons() { return nodes['hd-dialog-body'].children.at(-1)?.children
            .filter(node => node.getAttribute('data-hd-defender-index') != null) ?? []; },
        defenseFinish() { return nodes['hd-dialog-body'].querySelector('[data-hd-defenders-finish]'); },
        defenders(seq = 51, names = ['李儒', '张辽', '吕布']) {
            Object.assign(menu, { active: 1, context: 5, kind: 2, seq, index: 0,
                count: names.length, names: [...names] });
            rawData.g_FgtParam.CityIndex = 2; report.active = 0; this.poll();
        },
        successor(seq = 41) { Object.assign(menu, { active: 1, context: 5, kind: 1, seq, index: 0,
            names: ['韩遂', '庞德', '马超'] }); report.active = 0; this.poll(); }
    };
}
let count = 0;
function test(name, run) { run(); console.log(`ok ${++count} - ${name}`); }

function marchPersonList(h, names, seq = 32) {
    Object.assign(h.march, { phase: 1, selected: 0, ok: 0, session: 5, origin: 1 });
    Object.assign(h.menu, { active: 1, context: 1, kind: 3, seq, index: 0, count: names.length, names: [...names] });
    Object.assign(h.city, { open: true, layer: 'deep', cityIndex: 1, marchSession: 5,
        battleMake: true, deepKind: 'person-city', deepStep: 0, wizardStep: 'persons',
        marchOriginIndex: 1, deepItems: [], pickedPersons: 0, pickedPersonNames: [] });
    const ids = names.map((_, index) => index + 50);
    Object.assign(h.data.g_Cities[1], { Persons: names.length, PersonQueue: 0 });
    h.data.g_PersonsQueue = [...ids];
    h.data.g_Persons = Array.from({ length: 60 }, () => ({ Belong: 1 }));
    h.context.baye.getPersonName = id => names[ids.indexOf(id)] ?? '';
    h.cityRender();
    return ids;
}

test('battle history releases only for a real terminal result and native map input', () => {
    const h = harness(); h.world.sawFightHook = true;
    Object.assign(h.fight, { active: 1, over: 0 }); h.data.g_FgtOver = 0;
    assert.equal(h.phase(), 'other');
    h.data.g_FgtOver = 1; h.hook('exitBattle'); assert.equal(h.phase(), 'other');
    Object.assign(h.fight, { active: 0, over: 1 }); h.march.pick = 1; h.march.mapInputSeq++;
    assert.equal(h.phase(), 'map');
    h.march.pick = 0; h.data.g_FgtOver = 0; Object.assign(h.fight, { active: 1, over: 0 });
    assert.equal(h.phase(), 'other'); assert.deepEqual(h.keys, []);
});
test('post-fight presentation reset observes the existing cursor without choosing a home city', () => {
    const h = harness(); const before = structuredClone(h.data);
    h.march.pick = 1; h.context.BayeHdOverworld.afterFightMapReady('test');
    assert.equal(h.world.phase, 'map'); assert.equal(h.world.selectedIndex, 1);
    assert.deepEqual(h.data, before); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});
test('same-page new-game/load retires queued work without writing C input flags', () => {
    for (const hook of ['chooseGameEntry', 'didOpenNewGame', 'didLoadGame']) {
        const h = harness(); Object.assign(h.city, { open: true, battleMake: true, marchSession: 5,
            marchOriginIndex: 1, cityIndex: 1, layer: 'deep', deepKind: 'person-city' });
        const before = structuredClone(h.data); h.hook(hook); h.tick();
        assert.equal(h.city.marchSession, 0); assert.equal(h.city.battleMake, false);
        assert.deepEqual(h.data, before); assert.deepEqual(h.writes, []); assert.deepEqual(h.keys, []);
    }
});
test('real result and occupation report waits stay passive until explicit confirmation', () => {
    const h = harness(); h.report.active = 1; h.poll();
    assert.equal(h.dialog.debugSnapshot().reportOwner.inputSeq, 30); assert.deepEqual(h.keys, []);
    h.click('data-hd-dlg-ok'); h.click('data-hd-dlg-ok'); h.key(13, true);
    assert.deepEqual(h.keys, [VK.ENTER]); assert.deepEqual(h.writes, []);
});
test('live native reports retain input and pointer ownership despite old map or handoff markers', () => {
    for (const text of ['敌方城池', '农业开发度变为一百', '我军大获全胜']) {
        const h = harness(); h.city.handoff = true; h.report.active = 1; h.report.text = text; h.march.pick = 1;
        h.poll(); assert.equal(h.dialog.debugSnapshot().open, true);
        assert.equal(h.dialog.debugSnapshot().pass, false); assert.equal(h.phase(), 'other');
        h.click('data-hd-dlg-ok'); h.click('data-hd-dlg-ok'); assert.deepEqual(h.keys, [VK.ENTER]);
        assert.deepEqual(h.writes, []);
    }
});
test('report confirmation cannot replay into another report, map or successor wait', () => {
    for (const next of ['report', 'map', 'successor']) {
        const h = harness(); h.report.active = 1; h.poll();
        if (next === 'report') { h.report.seq++; h.report.inputSeq++; h.report.text = '河内已被占领'; }
        else { h.report.active = 0; h.report.inputSeq++; if (next === 'map') h.march.pick = 1;
            else Object.assign(h.menu, { active: 1, context: 5, kind: 1, names: ['庞德'] }); }
        h.click('data-hd-dlg-ok'); h.key(13); assert.deepEqual(h.keys, []);
    }
});
test('confirming a result preserves a synchronously opened occupation report', () => {
    const h = harness(); h.report.active = 1; h.poll();
    h.send(() => { h.report.inputSeq++; h.report.seq++; h.report.text = '河内已被占领'; h.dialog.onEngineReport(); });
    h.click('data-hd-dlg-ok');
    assert.equal(h.dialog.debugSnapshot().body, '河内已被占领');
    assert.equal(h.dialog.debugSnapshot().open, true); assert.deepEqual(h.keys, [VK.ENTER]);
});
test('old march cleanup leaves current occupation, succession and next departure reports intact', () => {
    for (const text of ['河内已被占领', '拥立新君', '部队已出发']) {
        const h = harness(); h.report.active = 1; h.report.text = text; h.poll();
        h.context.__cityCleanup.reports('old-city'); h.context.__cityCleanup.disaster();
        h.context.__cityCleanup.overlay('old-march'); h.context.BayeHdCityMenu.resetAfterFight();
        assert.equal(h.dialog.debugSnapshot().open, true); assert.equal(h.dialog.debugSnapshot().body, text);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});
test('an instant GamFight result closes the order even when no active polling frame occurred', () => {
    const h = harness(); Object.assign(h.city, { open: true, battleMake: true, handoff: true,
        marchReady: true, marchSession: 5, marchOriginIndex: 1, cityIndex: 1, layer: 'deep',
        deepKind: 'person-city', deepLabel: '出征', wizardStep: 'march-ok' });
    h.hook('enterBattle'); assert.equal(h.city.sawFightThisMarch, true);
    h.hook('exitBattle');
    assert.equal(h.city.handoff, false); assert.equal(h.city.battleMake, false);
    assert.equal(h.city.marchReady, false); assert.equal(h.city.marchSession, 0);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});
test('a consumed empty-city order releases its wizard without requiring a battle or report acknowledgement', () => {
    const h = harness(); Object.assign(h.city, { open: true, battleMake: true, marchReady: true,
        marchSession: 5, marchOriginIndex: 1, cityIndex: 1, marchBaselineSeq: 2,
        acceptMarchOk: true, marchSubmittedTarget: 2, pendingTarget: 2, wizardStep: 'march-ok' });
    Object.assign(h.menu, { active: 1, context: 2, kind: 1, index: 0,
        names: ['策略结束', '存储进度', '结束游戏'] });
    h.send(key => { if (key === VK.ENTER) { h.menu.active = 0; h.march.ok = 0;
        h.report.active = 1; h.report.inputSeq++; h.report.seq++; h.report.text = '我军大获全胜'; h.dialog.onEngineReport(); } });
    h.context.BayeHdCityMenu.goStrategyEnd(); h.tick();
    assert.deepEqual(h.keys, [VK.ENTER]); assert.equal(h.city.marchSession, 0);
    assert.equal(h.city.handoff, false); assert.equal(h.city.marchReady, false);
    assert.equal(h.dialog.debugSnapshot().open, true); assert.deepEqual(h.writes, []);
});
test('a long empty-city report may outlast handoff polling and still release the consumed order later', () => {
    const h = harness(); Object.assign(h.city, { open: true, battleMake: true, marchReady: true,
        marchSession: 5, marchOriginIndex: 1, cityIndex: 1, marchBaselineSeq: 2,
        acceptMarchOk: true, marchSubmittedTarget: 2, pendingTarget: 2, wizardStep: 'march-ok' });
    Object.assign(h.menu, { active: 1, context: 2, kind: 1, index: 0,
        names: ['策略结束', '存储进度', '结束游戏'] });
    h.send(() => { h.menu.active = 0; h.report.active = 1; h.dialog.onEngineReport(); });
    h.context.BayeHdCityMenu.goStrategyEnd(); h.tick(11000);
    assert.equal(h.city.handoff, false); assert.equal(h.city.marchStrategyOrder.seq, 3);
    h.report.active = 0; h.march.ok = 0; h.march.pick = 1;
    h.context.__cityCleanup.sweep('late-consumption'); h.poll();
    assert.equal(h.city.marchSession, 0); assert.equal(h.city.marchReady, false);
    assert.equal(h.city.marchStrategyOrder, null); assert.equal(h.dialog.debugSnapshot().open, false);
    assert.deepEqual(h.keys, [VK.ENTER]); assert.deepEqual(h.writes, []);
});
test('expired native report bytes cannot reopen a modal over a real map input', () => {
    const h = harness(); h.report.active = 1; h.poll(); h.report.active = 0; h.report.inputSeq++; h.march.pick = 1;
    h.poll(); assert.equal(h.dialog.debugSnapshot().open, false);
    h.report.seq++; h.dialog.onEngineReport(); h.poll();
    assert.equal(h.dialog.debugSnapshot().open, false); assert.deepEqual(h.keys, []);
});
test('successor candidates come only from the active campaign menu and observing chooses nobody', () => {
    const h = harness(); h.successor();
    assert.equal(h.phase(), 'other'); assert.equal(h.dialog.debugSnapshot().kind, 'successor');
    assert.deepEqual(Array.from(h.dialog.debugSnapshot().successorOwner.names), ['韩遂', '庞德', '马超']);
    assert.equal(h.context.BayeHdCityMenu.open({ cityIndex: 1 }), false);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});
test('successor polling preserves the same candidate buttons through a pointer gesture', () => {
    const h = harness(); h.successor();
    const choices = h.nodes['hd-dialog-body'].children.at(-1);
    h.dialog.poll(); h.dialog.poll();
    assert.equal(h.nodes['hd-dialog-body'].children.at(-1), choices);
    assert.deepEqual(h.keys, []);
});
test('one player successor choice waits for each real menu index before confirming once', () => {
    const h = harness(); h.successor(); h.dialog.chooseSuccessor(2); h.dialog.chooseSuccessor(1);
    h.tick(500); assert.deepEqual(h.keys, [VK.DOWN]);
    h.menu.index = 1; h.tick(100); assert.deepEqual(h.keys, [VK.DOWN, VK.DOWN]);
    h.menu.index = 2; h.tick(100); h.dialog.chooseSuccessor(2); h.key(13);
    assert.deepEqual(h.keys, [VK.DOWN, VK.DOWN, VK.ENTER]); assert.deepEqual(h.writes, []);
});
test('a stalled successor index never retries movement or invents a confirmation', () => {
    const h = harness(); h.successor(); h.dialog.chooseSuccessor(2); h.tick();
    assert.deepEqual(h.keys, [VK.DOWN]); assert.equal(h.dialog.debugSnapshot().successorRequest, null);
});
test('large successor paths may exceed five seconds while each real movement keeps acknowledging', () => {
    const h = harness(); h.successor(); h.dialog.chooseSuccessor(2); h.tick(4000);
    h.menu.index = 1; h.tick(100); h.tick(4000); h.menu.index = 2; h.tick(100);
    assert.deepEqual(h.keys, [VK.DOWN, VK.DOWN, VK.ENTER]);
});
test('successor transaction cannot resume across another menu, new game or a classic switch', () => {
    for (const change of ['menu', 'new-game', 'mode']) {
        const h = harness(); h.successor(); h.dialog.chooseSuccessor(2); const pending = h.captured();
        if (change === 'menu') { h.menu.seq++; h.menu.index = 1; }
        else if (change === 'new-game') h.hook('didOpenNewGame');
        else { h.context.BayeHdOverworld.getMode = () => 'classic'; h.context.BayeHdCityMenu.setMode('classic'); }
        pending.forEach(fn => fn()); h.tick(); assert.deepEqual(h.keys, [VK.DOWN]);
    }
});
test('a pointer pressed on a previous successor menu cannot commit the next candidate list', () => {
    const h = harness(); h.successor(); const target = h.button('data-hd-successor-index', '1');
    target.setAttribute('data-hd-successor-seq', '41'); h.press(target); h.successor(42);
    h.click('data-hd-successor-index', target); assert.deepEqual(h.keys, []);
});
test('successor acknowledgement preserves the new ruler report opened synchronously by C', () => {
    const h = harness(); h.successor();
    h.send(key => { if (key === VK.ENTER) { h.menu.active = 0; h.report.active = 1;
        h.report.inputSeq++; h.report.seq++; h.report.text = '庞德成为君主'; h.dialog.onEngineReport(); } });
    h.dialog.chooseSuccessor(0);
    assert.equal(h.dialog.debugSnapshot().kind, 'report'); assert.equal(h.dialog.debugSnapshot().body, '庞德成为君主');
    assert.deepEqual(h.keys, [VK.ENTER]);
});
test('explicit successor arrows move once and Escape neither chooses nor exits the required menu', () => {
    const h = harness(); h.successor(); h.send(key => { if (key === VK.DOWN) h.menu.index++; });
    h.key(40); h.key(40, true); h.tick(100); h.key(27); h.key(27, true);
    assert.deepEqual(h.keys, [VK.DOWN]); h.key(13); h.key(13);
    assert.deepEqual(h.keys, [VK.DOWN, VK.ENTER]);
});
test('an incoming attack owns defenders from the real menu and current native army, independently of the old march', () => {
    const h = harness(); h.march.phase = 7; h.march.session = 99; h.fight.over = 2;
    h.data.g_FgtParam.GenArray = [22, 23, 0, 0, 0, 0, 0, 0, 0, 0, 85];
    h.context.baye.getPersonName = id => ({ 21: '李儒', 22: '张辽' })[id] ?? '';
    h.defenders(); const snap = h.dialog.debugSnapshot();
    assert.equal(snap.kind, 'defenders'); assert.equal(snap.defenseOwner.cityIndex, 2);
    assert.deepEqual(Array.from(snap.defenseOwner.names), ['李儒', '张辽', '吕布']);
    assert.deepEqual(Array.from(snap.defenseOwner.selected), [22, 23]);
    assert.equal(snap.successorOwner, null); assert.equal(h.dialog.isBlockingKeyboard(), true);
    assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-native-defenders'), '1');
    assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-native-report'), '0');
    assert.equal(h.nodes['hd-dialog-body'].querySelector('[data-hd-defenders-selected]').textContent,
        '已选 2 人：李儒、张辽');
    h.dialog.poll(); h.tick(); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});
test('a defender choice sends each arrow once, accepts its exact ACK and commits this menu once', () => {
    const h = harness(); h.defenders(); const target = h.defenseButtons()[2];
    h.press(target); h.click('data-hd-defender-index', target); h.dialog.chooseDefender(1); h.tick(1000);
    assert.deepEqual(h.keys, [VK.DOWN]); assert.equal(h.dialog.finishDefenders(), false);
    h.menu.index = 1; h.tick(100); assert.deepEqual(h.keys, [VK.DOWN, VK.DOWN]);
    h.menu.index = 2; h.tick(100); h.click('data-hd-defender-index', target); h.key(13); h.key(27);
    assert.deepEqual(h.keys, [VK.DOWN, VK.DOWN, VK.ENTER]); assert.deepEqual(h.writes, []);
});
test('native removal and a new defender menu rebind the next choice without using the old index', () => {
    const h = harness(); h.defenders(); const oldLu = h.defenseButtons()[2]; const chosen = [];
    h.send(key => { if (key === VK.DOWN) h.menu.index++;
        if (key === VK.ENTER) { chosen.push(h.menu.names[h.menu.index]); h.menu.active = 0; } });
    h.click('data-hd-defender-index', h.defenseButtons()[1]); h.tick(100);
    assert.deepEqual(chosen, ['张辽']); h.data.g_FgtParam.GenArray = [23]; h.poll();
    assert.equal(h.dialog.debugSnapshot().open, false);
    h.defenders(52, ['李儒', '吕布']); h.click('data-hd-defender-index', oldLu); h.tick(100);
    assert.deepEqual(chosen, ['张辽']);
    assert.deepEqual(Array.from(h.dialog.debugSnapshot().defenseOwner.selected), [23]);
    const freshLu = h.defenseButtons()[1]; assert.equal(freshLu.getAttribute('data-hd-defender-name'), '吕布');
    h.click('data-hd-defender-index', freshLu); h.tick(100);
    assert.deepEqual(chosen, ['张辽', '吕布']); assert.deepEqual(h.keys, [VK.DOWN, VK.ENTER, VK.DOWN, VK.ENTER]);
});
test('defender polling preserves button nodes and a gesture on the same actual menu', () => {
    const h = harness(); h.defenders(); const button = h.defenseButtons()[1]; h.press(button);
    h.dialog.poll(); h.dialog.poll(); assert.equal(h.defenseButtons()[1], button);
    h.send(key => { if (key === VK.DOWN) h.menu.index++; });
    h.click('data-hd-defender-index', button); h.tick(100); assert.deepEqual(h.keys, [VK.DOWN, VK.ENTER]);
});
test('a defender gesture and old finish button cannot cross a new menu containing the same names', () => {
    for (const attribute of ['data-hd-defender-index', 'data-hd-defenders-finish']) {
        const h = harness(); h.defenders(51, ['张辽', '张辽']);
        const old = attribute.endsWith('index') ? h.defenseButtons()[1] : h.defenseFinish(); h.press(old);
        h.defenders(52, ['张辽', '张辽']); h.click(attribute, old); h.tick(100);
        assert.deepEqual(h.keys, []);
        if (attribute.endsWith('index')) {
            h.send(key => { if (key === VK.DOWN) h.menu.index++; });
            h.click(attribute, h.defenseButtons()[1]); h.tick(100); assert.deepEqual(h.keys, [VK.DOWN, VK.ENTER]);
        } else { h.click(attribute, h.defenseFinish()); assert.deepEqual(h.keys, [VK.EXIT]); }
    }
});
test('inactive, replaced or uncompleted defender menus reject stale pointer and keyboard commits before the next poll', () => {
    for (const change of ['active', 'context', 'kind', 'seq', 'names', 'count', 'city']) {
        const h = harness(); h.defenders(); const button = h.defenseButtons()[1], finish = h.defenseFinish();
        if (change === 'active') h.menu.active = 0;
        else if (change === 'names') h.menu.names = ['李儒', '吕布', '张辽'];
        else if (change === 'city') h.data.g_FgtParam.CityIndex++;
        else h.menu[change]++;
        h.click('data-hd-defender-index', button); h.click('data-hd-defenders-finish', finish);
        assert.equal(h.key(13).defaultPrevented, true); assert.equal(h.key(27).defaultPrevented, true);
        h.tick(100); assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
    }
});
test('a defender button must still represent its real name and complete owner token', () => {
    for (const attribute of ['data-hd-defender-name', 'data-hd-menu-context', 'data-hd-menu-kind', 'data-hd-defender-seq', 'data-hd-defenders-owner']) {
        const h = harness(); h.defenders(); const button = h.defenseButtons()[0];
        button.setAttribute(attribute, 'invalid'); h.click('data-hd-defender-index', button); h.tick(100);
        assert.deepEqual(h.keys, []);
    }
});
test('explicit finish may choose no defenders and sends one EXIT without inventing a battle or clearing native state', () => {
    const h = harness(); h.defenders(); const before = structuredClone(h.data);
    const finish = h.defenseFinish(); h.press(finish); h.click('data-hd-defenders-finish', finish);
    h.click('data-hd-defenders-finish', finish); h.key(27); h.key(27, true); h.key(13);
    assert.deepEqual(h.keys, [VK.EXIT]); assert.deepEqual(h.data, before); assert.deepEqual(h.writes, []);
    assert.deepEqual(Array.from(h.dialog.debugSnapshot().defenseOwner.selected), []);
});
test('a live defense owner may explicitly finish despite stale offensive hold markers', () => {
    const h = harness(); Object.assign(h.city, { open: true, battleMake: true, layer: 'deep',
        deepKind: 'person-city', deepStep: 0, marchSession: 99 }); h.defenders();
    h.context.BayeHdCityMenu.holdExit = () => true;
    assert.equal(h.context.BayeHdCityMenu.holdExit(), true);
    assert.equal(h.dialog.finishDefenders(), true); assert.deepEqual(h.keys, [VK.EXIT]);
});
test('real battle input retires defense ownership and cancels queued defender movement', () => {
    const h = harness(); h.defenders(); h.dialog.chooseDefender(2); const pending = h.captured();
    h.menu.active = 0; h.data.g_FgtOver = 0; h.data.g_hdFightActive = 1; h.data.g_hdFightOver = 0;
    Object.assign(h.fight, { active: 1, over: 0, inputKind: 1, inputSeq: 80 }); h.poll();
    assert.equal(h.dialog.debugSnapshot().open, false); assert.equal(h.dialog.debugSnapshot().defenseOwner, null);
    assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-native-defenders'), '0');
    assert.equal(h.context.BayeHdBattle.debugSnapshot().open, true);
    pending.forEach(fn => fn()); h.tick(); assert.deepEqual(h.keys, [VK.DOWN]);
});
test('defense requests stop across new games and classic mode, while retired callbacks leave fresh requests intact', () => {
    for (const change of ['new-game', 'mode', 'menu']) {
        const h = harness(); h.defenders(); h.dialog.chooseDefender(2); const pending = h.captured();
        if (change === 'new-game') h.hook('didOpenNewGame');
        else if (change === 'mode') { h.context.BayeHdOverworld.getMode = () => 'classic'; h.context.BayeHdCityMenu.setMode('classic'); }
        else { h.defenders(52); h.dialog.chooseDefender(1); }
        pending.forEach(fn => fn()); h.tick(100);
        assert.deepEqual(h.keys, change === 'menu' ? [VK.DOWN, VK.DOWN] : [VK.DOWN]);
        if (change === 'menu') { h.menu.index = 1; h.tick(100); assert.deepEqual(h.keys, [VK.DOWN, VK.DOWN, VK.ENTER]); }
    }
});
test('slow exact successor and defender ACKs extend each step without accepting unrelated cursor movement', () => {
    for (const defense of [false, true]) {
        const h = harness(); const names = Array.from({ length: 8 }, (_, i) => '武将' + i);
        if (defense) h.defenders(51, names); else { h.successor(); h.menu.names = names; h.poll(); }
        const choose = index => defense ? h.dialog.chooseDefender(index) : h.dialog.chooseSuccessor(index);
        choose(7);
        for (let index = 1; index <= 7; index++) { h.tick(4000); h.menu.index = index; h.tick(16); }
        assert.deepEqual(h.keys, [...Array(7).fill(VK.DOWN), VK.ENTER]);
        const stalled = harness(); if (defense) stalled.defenders(); else stalled.successor();
        if (defense) stalled.dialog.chooseDefender(2); else stalled.dialog.chooseSuccessor(2);
        stalled.menu.index = 2; stalled.tick(); assert.deepEqual(stalled.keys, [VK.DOWN]);
        const noAck = harness(); if (defense) noAck.defenders(); else noAck.successor();
        if (defense) noAck.dialog.chooseDefender(2); else noAck.dialog.chooseSuccessor(2);
        noAck.tick(); assert.deepEqual(noAck.keys, [VK.DOWN]);
    }
});
test('city person and goods selection uses native index zero despite stale parent idle index one', () => {
    for (const kind of [3, 4]) {
        const h = harness(); Object.assign(h.menu, { active: 1, context: 1, kind, seq: 70, index: 0,
            names: ['马腾', '庞德', '程银', '李堪', '梁兴', '侯选', '马玩', '杨秋'] });
        Object.assign(h.city, { open: true, layer: 'deep', cityIndex: 1, idleIndex: 1,
            deepKind: kind === 3 ? 'person' : 'goods', deepStep: 0,
            deepItems: h.menu.names.map((name, index) => ({ i: index, name })) });
        let chosen;
        h.send(key => { if (key === VK.DOWN) h.menu.index++;
            if (key === VK.ENTER) chosen = h.menu.names[h.menu.index]; });
        h.context.__cityChooseDeep(7); h.context.__cityChooseDeep(6); h.tick();
        assert.equal(chosen, '杨秋'); assert.deepEqual(h.keys, [...Array(7).fill(VK.DOWN), VK.ENTER]);
        assert.equal(h.menu.index, 7); assert.deepEqual(h.writes, []);
    }
});
test('city person selection waits for a real index ACK and duplicate clicks never confirm twice', () => {
    const h = harness(); Object.assign(h.menu, { active: 1, context: 1, kind: 3, seq: 70, index: 0,
        names: ['马玩', '杨秋'] });
    Object.assign(h.city, { open: true, layer: 'deep', deepKind: 'person',
        deepItems: h.menu.names.map(name => ({ name })) });
    h.context.__cityChooseDeep(1); h.context.__cityChooseDeep(1); h.tick(1000);
    assert.deepEqual(h.keys, [VK.DOWN]);
    h.menu.index = 1; h.tick(100); h.context.__cityChooseDeep(1); h.tick();
    assert.deepEqual(h.keys, [VK.DOWN, VK.ENTER]);
});
test('changed city menu kind, context, sequence or names retire a pending person request', () => {
    for (const change of ['kind', 'context', 'seq', 'names']) {
        const h = harness(); Object.assign(h.menu, { active: 1, context: 1, kind: 3, seq: 70, index: 0,
            names: ['马玩', '杨秋'] });
        Object.assign(h.city, { open: true, layer: 'deep', deepKind: 'person',
            deepItems: h.menu.names.map(name => ({ name })) });
        h.context.__cityChooseDeep(1);
        if (change === 'names') h.menu.names = ['新候选', '另一候选']; else h.menu[change]++;
        h.menu.index = 1; h.tick(); assert.deepEqual(h.keys, [VK.DOWN]);
    }
});
test('repeated march selections wait for native removal then select 庞德 from the new seven-person list', () => {
    const h = harness();
    const names = ['梁兴', '马玩', '杨秋', '马腾', '庞德', '程银', '李堪', '张横'];
    const ids = marchPersonList(h, names);
    const oldPang = h.cityButtons().find(button => button.getAttribute('data-hd-deep-name') === '庞德');
    assert.equal(oldPang.getAttribute('data-hd-menu-seq'), '32');
    assert.equal(oldPang.getAttribute('data-hd-menu-context'), '1');
    assert.equal(oldPang.getAttribute('data-hd-menu-kind'), '3');
    assert.equal(oldPang.getAttribute('data-hd-deep-pind'), String(ids[4]));
    const chosen = [];
    h.send(key => {
        if (key === VK.DOWN) h.menu.index++;
        if (key === VK.UP) h.menu.index--;
        if (key === VK.ENTER) { chosen.push(h.menu.names[h.menu.index]); h.menu.active = 0; }
    });
    h.cityClick(h.cityButtons().find(button => button.getAttribute('data-hd-deep-name') === '马腾'));
    h.tick(500); h.cityRender();
    assert.deepEqual(chosen, ['马腾']); assert.equal(h.cityButtons().length, 0);
    assert.equal(h.city.deepItems.length, 0); assert.equal(h.city.deepMenuOwner, null);
    h.march.selected = 1; h.cityRender();
    assert.equal(h.cityButtons().length, 0, 'selected ACK alone is not the next person menu');
    h.menu.names = names.filter(name => name !== '马腾');
    Object.assign(h.menu, { active: 1, seq: 33, count: 7, index: 3 });
    h.data.g_PersonsQueue.splice(3, 1); h.data.g_Cities[1].Persons--;
    h.cityRender();
    const newPang = h.cityButtons().find(button => button.getAttribute('data-hd-deep-name') === '庞德');
    assert.equal(newPang.getAttribute('data-hd-deep'), '3');
    assert.equal(newPang.getAttribute('data-hd-deep-pind'), String(ids[4]));
    assert.equal(newPang.getAttribute('data-hd-menu-seq'), '33');
    h.cityClick(oldPang); assert.deepEqual(chosen, ['马腾'], 'old index four must not choose 程银');
    h.cityClick(newPang); h.tick();
    assert.deepEqual(chosen, ['马腾', '庞德']);
    assert.deepEqual(Array.from(h.city.pickedPersonNames), ['马腾', '庞德']);
    assert.deepEqual(h.keys, [VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER, VK.ENTER]);
    assert.deepEqual(h.writes, []);
});
test('a new native person list waits for the selected count ACK before it becomes clickable', () => {
    const h = harness(); marchPersonList(h, ['马腾', '庞德']);
    h.send(key => { if (key === VK.ENTER) { h.menu.seq++; h.menu.names = ['庞德'];
        h.menu.count = 1; h.data.g_PersonsQueue.shift(); h.data.g_Cities[1].Persons--; } });
    h.cityClick(h.cityButtons()[0]); h.tick(500); h.cityRender();
    assert.equal(h.cityButtons().length, 0); assert.deepEqual(h.keys, [VK.ENTER]);
    h.march.selected = 1; h.cityRender();
    assert.equal(h.cityButtons()[0].getAttribute('data-hd-deep-name'), '庞德');
    assert.deepEqual(h.keys, [VK.ENTER]);
});
test('a person gesture cannot cross another menu even when the candidate names remain identical', () => {
    for (const change of ['seq', 'kind', 'context', 'new-game']) {
        const h = harness(); marchPersonList(h, ['马腾', '庞德']);
        const old = h.cityButtons()[1]; h.cityPress(old);
        if (change === 'new-game') h.hook('didOpenNewGame'); else h.menu[change]++;
        h.cityRender(); h.cityClick(old); h.tick(); assert.deepEqual(h.keys, []);
        if (change === 'seq') {
            const fresh = h.cityButtons()[1];
            h.send(key => { if (key === VK.DOWN) h.menu.index++; });
            h.cityClick(fresh); h.tick(); assert.deepEqual(h.keys, [VK.DOWN, VK.ENTER]);
        }
    }
});
test('person names and IDs on a button must agree with the current rendered candidate', () => {
    for (const attribute of ['data-hd-deep-name', 'data-hd-deep-pind']) {
        const h = harness(); marchPersonList(h, ['马腾', '庞德']);
        const button = h.cityButtons()[1]; button.setAttribute(attribute, attribute.endsWith('name') ? '程银' : '999');
        h.cityClick(button); h.tick(); assert.deepEqual(h.keys, []);
    }
});
test('polling a live person menu preserves button ownership through an unchanged gesture', () => {
    const h = harness(); marchPersonList(h, ['马腾', '庞德']);
    const button = h.cityButtons()[1]; h.cityPress(button); h.cityRender(); h.cityRender();
    assert.equal(h.cityButtons()[1], button);
    h.send(key => { if (key === VK.DOWN) h.menu.index++; });
    h.cityClick(button); h.tick(); assert.deepEqual(h.keys, [VK.DOWN, VK.ENTER]);
});
test('three recruit and two allocation quantities accept identical min-zero waits independently', () => {
    const h = harness(); h.march.phase = 0;
    Object.assign(h.city, { open: true, layer: 'deep', deepKind: 'person-qty', deepStep: 1,
        qtyInputClosed: true, qtyDismissed: true });
    h.send(key => { if (key === VK.ENTER) h.qty.active = 0; });
    for (let action = 0; action < 5; action++) {
        Object.assign(h.menu, { active: 0, context: 0, kind: 0, seq: 70 + action * 2 });
        Object.assign(h.qty, { active: 1, min: 0, max: 1000, value: 1000 });
        assert.equal(h.context.BayeHdCityMenu.isQtyLive(), true);
        h.context.BayeHdCityMenu.commitQty(); h.context.BayeHdCityMenu.commitQty();
        h.tick(500); assert.equal(h.qty.active, 0);
    }
    assert.deepEqual(h.keys, Array(5).fill(VK.ENTER)); assert.deepEqual(h.writes, []);
});
test('old quantity cleanup and queued digits cannot reach a new min-zero wait', () => {
    const h = harness(); h.march.phase = 0;
    Object.assign(h.city, { open: true, layer: 'deep', deepKind: 'person-qty', deepStep: 1 });
    Object.assign(h.menu, { active: 0, seq: 70 }); Object.assign(h.qty, { active: 1, min: 0 });
    h.context.BayeHdCityMenu.digitQty(6); const captured = h.captured();
    Object.assign(h.menu, { seq: 72 }); Object.assign(h.qty, { value: 75 });
    captured.forEach(fn => fn()); h.tick(); assert.deepEqual(h.keys, []);
    h.send(key => { if (key === VK.ENTER) h.qty.active = 0; });
    h.context.BayeHdCityMenu.commitQty();
    Object.assign(h.menu, { seq: 74 }); Object.assign(h.qty, { active: 1, value: 85 });
    h.dialog.openQty({ min: 0, max: 200, init: 85 }); h.tick();
    assert.equal(h.qty.active, 1); assert.equal(h.dialog.debugSnapshot().open, true);
    assert.deepEqual(h.keys, [VK.ENTER]); assert.deepEqual(h.writes, []);
});
test('a real actor-death report remains visible and explicitly confirms once while battle is BUSY', () => {
    const h = harness(); Object.assign(h.fight, { active: 1, over: 0, inputKind: 0, inputSeq: 60,
        actorIndex: 0, bout: 6 }); h.data.g_FgtOver = 0; h.data.g_hdFightActive = 1;
    h.data.g_FgtParam.GenArray = [59]; h.data.g_GenPos = [{ x: 2, y: 1, state: 8, active: 1 }];
    h.data.g_Persons = Array.from({ length: 59 }, () => ({ Arms: 0 }));
    Object.assign(h.report, { active: 1, inputSeq: 10, kind: 2, person: 58,
        text: '谋事在人，成事在天。我已尽力。时也？命也？' });
    h.poll();
    assert.equal(h.dialog.debugSnapshot().open, true); assert.equal(h.dialog.isBlockingKeyboard(), true);
    assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-native-report'), '1');
    assert.equal(h.dialog.debugSnapshot().body, h.report.text); assert.deepEqual(h.keys, []);
    h.key(13); h.click('data-hd-dlg-ok'); h.key(13, true);
    assert.deepEqual(h.keys, [VK.ENTER]); assert.deepEqual(h.writes, []);
    h.report.active = 0; h.report.inputSeq++; h.fight.inputKind = 1; h.fight.inputSeq++;
    h.poll();
    assert.equal(h.dialog.debugSnapshot().open, false); assert.equal(h.dialog.isBlockingKeyboard(), false);
    assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-native-report'), '0');
    assert.equal(h.context.BayeHdBattle.debugSnapshot().open, true);
    h.context.BayeHdBattle.openSystemMenu(); assert.deepEqual(h.keys, [VK.ENTER, VK.EXIT]);
});
test('native defeat caused by the commander dying does not claim surviving generals were wiped out', () => {
    const h = harness(); h.data.g_MainGenIdx = 0;
    h.data.g_FgtParam.GenArray = [21, 23];
    h.data.g_GenPos = [{ x: 15, y: 12, state: 8, active: 1 }, { x: 14, y: 14, state: 0, active: 1 }];
    h.data.g_Persons = Array.from({ length: 23 }, () => ({ Arms: 0 }));
    h.data.g_Persons[22].Arms = 1666;
    Object.assign(h.fight, { active: 0, over: 2, result: '我军全军覆没', bout: 13, boutMax: 30 });
    h.context.BayeHdBattle.onEngineFight();
    assert.equal(h.context.BayeHdBattle.debugSnapshot().resultCode, 2);
    assert.equal(h.context.BayeHdBattle.debugSnapshot().resultText, '我军战败');
    assert.equal(h.fight.result, '我军全军覆没', 'the native trace remains unchanged');
    assert.equal(h.data.g_Persons[22].Arms, 1666); assert.equal(h.data.g_GenPos[1].state, 0);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.writes, []);
});
test('battle reports own pointer and keyboard input without sending other battle hotkeys into C', () => {
    const h = harness(); Object.assign(h.fight, { active: 1, over: 0, inputKind: 0 });
    h.data.g_FgtOver = 0; h.report.active = 1; h.poll();
    for (const code of [32, 37, 38, 39, 40, 48, 53, 70, 72, 83]) {
        assert.equal(h.key(code).defaultPrevented, true);
    }
    assert.deepEqual(h.keys, []); h.key(27); h.key(27); assert.deepEqual(h.keys, [VK.EXIT]);
});
test('a death acknowledgement preserves a nested report for another actor in the same battle', () => {
    const h = harness(); Object.assign(h.fight, { active: 1, over: 0, inputKind: 0 });
    h.data.g_FgtOver = 0; Object.assign(h.report, { active: 1, kind: 2, person: 58 }); h.poll();
    h.send(() => { h.report.seq++; h.report.inputSeq++; h.report.person = 85;
        h.report.text = '谋事在人，成事在天。我已尽力。时也？命也？'; h.dialog.onEngineReport(); });
    h.key(13);
    assert.equal(h.dialog.debugSnapshot().open, true); assert.equal(h.dialog.debugSnapshot().reportOwner.inputSeq, 31);
    assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-native-report'), '1');
    assert.deepEqual(h.keys, [VK.ENTER]); assert.deepEqual(h.writes, []);
});
test('old actor report pointer and cleanup cannot confirm or hide the next report', () => {
    const h = harness(); Object.assign(h.fight, { active: 1, over: 0, inputKind: 0 });
    h.data.g_FgtOver = 0; Object.assign(h.report, { active: 1, kind: 2, person: 58 }); h.poll();
    const target = h.button('data-hd-dlg-ok'); h.press(target);
    h.report.seq++; h.report.inputSeq++; h.report.person = 85; h.dialog.poll();
    h.click('data-hd-dlg-ok', target); h.context.__cityCleanup.reports('old-city');
    assert.deepEqual(h.keys, []); assert.equal(h.dialog.debugSnapshot().open, true);
    h.click('data-hd-dlg-ok'); assert.deepEqual(h.keys, [VK.ENTER]);
});
test('expired actor reports and classic or new-game scene changes release their report ownership', () => {
    for (const next of ['expired', 'classic', 'new-game']) {
        const h = harness(); Object.assign(h.fight, { active: 1, over: 0, inputKind: 0 });
        h.data.g_FgtOver = 0; h.report.active = 1; h.poll();
        if (next === 'expired') { h.report.active = 0; h.report.inputSeq++; }
        else if (next === 'classic') h.context.BayeHdBattle.setMode('classic');
        else h.hook('didOpenNewGame');
        if (next !== 'new-game') h.dialog.poll();
        assert.equal(h.nodes['hd-dialog'].getAttribute('data-hd-native-report'), '0');
        assert.equal(h.dialog.isBlockingKeyboard(), false); h.click('data-hd-dlg-ok'); assert.deepEqual(h.keys, []);
    }
});

console.log(`${count} HD campaign flow regression cases passed.`);
