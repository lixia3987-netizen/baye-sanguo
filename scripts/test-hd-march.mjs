import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The state contract here is supplied by C BattleMake, not inferred from
// report strings: phase/session/inputSeq/selected are engine acknowledgements.
const VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
function harness({ phase = 1, session = 12, selected = 0, move = true } = {}) {
    const listeners = new Map();
    const node = () => ({ style: {}, classList: { toggle() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; }, querySelectorAll() { return []; },
        addEventListener(type, fn) { listeners.set(type, fn); } });
    const root = node();
    const document = { body: node(), documentElement: node(),
        getElementById(id) { return id === 'hd-city-menu' ? root : null; },
        querySelector() { return null; }, createElement: node,
        addEventListener(type, fn) { listeners.set(type, fn); } };
    let clock = 0, nextTimer = 0, afterKey;
    const timers = new Map(), sent = [];
    const march = { phase, session, origin: 1, selected, inputSeq: 80,
        seq: 15, ok: 0, city: 0, obj: 0, pick: phase === 4 ? 1 : 0,
        battlePick: phase === 4 ? 1 : 0, mapCity: 2, mapInputSeq: 40 };
    const qty = { active: phase === 2 ? 1 : 0, min: 1, max: 500, value: 250 };
    const menu = { active: 0, context: 1, kind: 3, seq: 22, index: 0, names: [] };
    const data = { g_PlayerKing: 0, g_FgtOver: 0, g_hdFightActive: 0, g_hdFightOver: 0,
        g_asyncActionID: 1, g_CityPos: { setx: 1, sety: 1 },
        g_Cities: [{ Belong: 1 }, { Belong: 1 }, { Belong: 2 }, { Belong: 2 }],
        g_PersonsQueue: [], g_hdReportGbk: '' };
    const storage = { 'baye/overworldMode': 'hd-map', getItem(key) { return this[key] ?? null; },
        setItem(key, value) { this[key] = String(value); } };
    const context = vm.createContext({ document, localStorage: storage,
        console: { log() {}, warn() {} }, innerWidth: 1000, innerHeight: 600,
        Date: class extends Date { static now() { return clock; } },
        setTimeout(fn, delay = 0) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id; },
        clearTimeout(id) { timers.delete(id); }, setInterval() {},
        bayeInputIgnored(e) { return !!e.defaultPrevented; },
        bayeConsumeKeyEvent(e) { e.defaultPrevented = true; e.stopped = true; },
        bayeQtyStepKeys() { return []; },
        sendKey(key) {
            sent.push(key);
            if (move && march.phase === 4) {
                if (key === VK.UP) data.g_CityPos.sety--;
                if (key === VK.DOWN) data.g_CityPos.sety++;
                if (key === VK.LEFT) data.g_CityPos.setx--;
                if (key === VK.RIGHT) data.g_CityPos.setx++;
                march.mapCity = data.g_CityPos.setx === 3 && data.g_CityPos.sety === 2 ? 3
                    : data.g_CityPos.setx === 4 && data.g_CityPos.sety === 3 ? 4 : 2;
            }
            afterKey?.(key);
        },
        BayeHdDialog: { close() {}, closeQty() {}, clearLeftoverMarch() {} },
        BayeHdOverworld: { getMode() { return storage['baye/overworldMode']; },
            getCities() { return [{ index: 2, engX: 3, engY: 2 }, { index: 3, engX: 4, engY: 3 }]; } },
        baye: { data, hdEngineReady: () => true, ensureData: () => data,
            hdCityLimit: () => 4, getCityName: id => ['襄平', '濮阳', '河内', '陈留'][id],
            hd: { ready: () => true, march: () => march, qty: () => qty,
                menuItems: () => menu, reportText: () => data.g_hdReportGbk,
                fight: () => ({ active: 0, over: 0 }), cityLinks: () => [{ index: 2 }, { index: 3 }] } }
    });
    context.window = context;
    let source = readFileSync(new URL('../js/hd-city-menu.js', import.meta.url), 'utf8');
    source = source.replace(/\}\)\(window\);\s*$/, `
        global.__march = { state: state, sync: syncMarchPhase, invalidate: invalidateMarchWork,
            chooseRoot: chooseRoot, chooseSub: chooseSub, chooseDeep: chooseDeep, enqueue: enqueueKeys,
            deepItems: probeDeepItems,
            selectMenu: selectLiveMenu, bind: bindUi, resetAfterFight: resetAfterFight };
        // Omit layout work only. Production state/input/timer code is intact.
        render = function () {};
        applyDocAttr = function () {};
        applyHighlight = function () {};
        scheduleMarchWatch = function () {};
    })(window);`);
    vm.runInContext(source, context, { filename: 'js/hd-city-menu.js' });
    const state = context.__march.state;
    Object.assign(state, { open: true, layer: 'deep', subKind: 'junbei', cityIndex: 1,
        deepKind: 'person-city', deepLabel: '出征', battleMake: true,
        marchOriginIndex: 1, marchSession: session, marchBaselineSeq: 15,
        wizardStep: 'persons', pickedPersons: selected, idleIndex: 0,
        modeSignature: 'auto:hd' });
    return { context, state, march, qty, menu, data, sent, storage,
        api: context.BayeHdCityMenu, internals: context.__march,
        setAfterKey(fn) { afterKey = fn; },
        tick(ms = 10000) {
            const end = clock + ms; let runs = 0;
            while (timers.size) {
                const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                if (timer.at > end) break;
                assert.ok(++runs < 2000, 'input work must finish without retry bursts');
                timers.delete(id); clock = timer.at; timer.fn();
            }
            clock = end;
        },
        captured() { return [...timers.values()].map(item => item.fn); },
        key(keyCode, repeat = false) {
            const e = { keyCode, repeat, defaultPrevented: false };
            listeners.get('keydown')?.(e);
            return e;
        }
    };
}

let count = 0;
function test(name, run) { run(); console.log(`ok ${++count} - ${name}`); }

test('retained report text and numeric fields never advance a march', () => {
    for (const phase of [1, 2, 3, 5, 6]) {
        const h = harness({ phase });
        h.data.g_hdReportGbk = '选择目标 部队已出发 无法到达';
        h.internals.sync(); h.api.driveFoodToCitySet(); h.tick();
        assert.deepEqual(h.sent, []);
    }
});
test('each real report accepts one player acknowledgement per input sequence', () => {
    for (const phase of [3, 5, 6]) {
        const h = harness({ phase });
        assert.equal(h.api.continueMarch(), true);
        assert.equal(h.api.continueMarch(), false);
        h.tick(); assert.deepEqual(h.sent, [VK.ENTER]);
        h.march.inputSeq++; assert.equal(h.api.continueMarch(), true);
        assert.deepEqual(h.sent, [VK.ENTER, VK.ENTER]);
    }
});
test('stale async reports cannot acknowledge current person/food/map input', () => {
    for (const phase of [1, 2, 4, 7]) {
        const h = harness({ phase }); assert.equal(h.api.continueMarch(), false);
        assert.deepEqual(h.sent, []);
    }
});
test('native reports with no legacy async action confirm through their real input token', () => {
    for (const phase of [3, 5, 6]) {
        const h = harness({ phase }); h.data.g_asyncActionID = 0;
        const owner = { session: h.march.session, inputSeq: h.march.inputSeq };
        assert.equal(h.api.continueMarch(owner), true);
        assert.equal(h.api.continueMarch(owner), false);
        assert.deepEqual(h.sent, [VK.ENTER]);
    }
});
test('an old displayed report token cannot acknowledge a newer report', () => {
    const h = harness({ phase: 3 });
    const old = { session: h.march.session, inputSeq: h.march.inputSeq };
    h.march.phase = 6; h.march.inputSeq++;
    assert.equal(h.api.continueMarch(old), false);
    assert.deepEqual(h.sent, []);
    assert.equal(h.api.continueMarch({ session: h.march.session, inputSeq: h.march.inputSeq }), true);
    assert.deepEqual(h.sent, [VK.ENTER]);
});
test('food confirmation waits for an engine phase acknowledgement', () => {
    const h = harness({ phase: 2 }); h.state.personExitSent = true;
    h.api.commitQty(); h.api.commitQty();
    assert.deepEqual(h.sent, [VK.ENTER]);
    assert.equal(h.state.foodConfirmedThisMarch, false);
    h.march.phase = 3; h.qty.active = 0; h.internals.sync();
    assert.equal(h.state.foodConfirmedThisMarch, true);
    h.tick(); assert.deepEqual(h.sent, [VK.ENTER]);
});
test('finish persons waits for C selected count then sends one Exit', () => {
    const h = harness(); h.state.pickedPersons = 2;
    h.api.finishPersons(); h.tick(1000); assert.deepEqual(h.sent, []);
    h.march.selected = 2; h.tick(100);
    assert.deepEqual(h.sent, [VK.EXIT]);
    h.api.finishPersons(); h.tick(); assert.deepEqual(h.sent, [VK.EXIT]);
});
test('missing selection acknowledgements time out without replaying generals', () => {
    const h = harness(); h.state.pickedPersons = 1;
    h.api.finishPersons(); h.tick(11000);
    assert.deepEqual(h.sent, []); assert.equal(h.state.finishPersonsBusy, false);
});
test('map/list selection retains the player target without sending engine keys', () => {
    const h = harness({ phase: 4 });
    h.api.selectMarchTarget(3); assert.equal(h.state.pendingTarget, 3);
    h.api.selectMarchTarget(2); assert.equal(h.state.pendingTarget, 2);
    assert.deepEqual(h.sent, []);
});
test('invalid or own cities preserve the previously selected enemy target', () => {
    const h = harness({ phase: 4 }); h.api.selectMarchTarget(3);
    for (const id of [1, 0, -1, 9, NaN]) h.api.selectMarchTarget(id);
    assert.equal(h.state.pendingTarget, 3); assert.deepEqual(h.sent, []);
});
test('target confirmation requires both real cursor and shown city then submits once', () => {
    const h = harness({ phase: 4 }); h.api.selectMarchTarget(3);
    h.api.confirmMarchTarget(3); h.api.confirmMarchTarget(3); h.tick();
    assert.equal(h.sent.filter(key => key === VK.ENTER).length, 1);
    assert.equal(h.march.mapCity, 4); assert.deepEqual(h.data.g_CityPos, { setx: 4, sety: 3 });
});
test('a stalled cursor never receives a blind confirm or repeated movement key', () => {
    const h = harness({ phase: 4, move: false }); h.api.selectMarchTarget(2);
    h.api.confirmMarchTarget(2); h.tick();
    assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(h.state.confirmingTarget, false);
});
test('changing session/phase/input sequence invalidates a target move callback', () => {
    for (const key of ['session', 'phase', 'inputSeq']) {
        const h = harness({ phase: 4 }); h.api.selectMarchTarget(2); h.api.confirmMarchTarget(2);
        const before = h.sent.length; h.march[key]++; h.tick();
        assert.equal(h.sent.length, before);
    }
});
test('classic then HD cannot revive captured cursor work', () => {
    const h = harness({ phase: 4 }); h.api.selectMarchTarget(2); h.api.confirmMarchTarget(2);
    const pending = h.captured(), before = h.sent.length;
    h.storage['baye/overworldMode'] = 'classic'; h.api.syncMode();
    h.storage['baye/overworldMode'] = 'hd-map'; h.api.syncMode();
    for (const fn of pending) fn(); h.tick();
    assert.equal(h.sent.length, before);
});
function acknowledge(h, { seq = 16, obj = 3, origin = 1, session = 12 } = {}) {
    Object.assign(h.state, { acceptMarchOk: true, marchSubmittedTarget: 3, pendingTarget: 3 });
    Object.assign(h.march, { phase: 7, seq, ok: 1, city: origin, origin, obj, session,
        pick: 0, battlePick: 0 });
}
test('departure requires a fresh order for the same session/origin/player target', () => {
    const h = harness(); acknowledge(h); assert.equal(h.api.freshMarchOk(), true);
    for (const patch of [{ seq: 15 }, { obj: 2 }, { origin: 2 }, { session: 11 }, { phase: 6 }]) {
        const h = harness(); acknowledge(h); Object.assign(h.march, patch);
        assert.equal(h.api.freshMarchOk(), false);
    }
});
test('U16 order sequence wrap acknowledges a fresh matching order', () => {
    const h = harness(); h.state.marchBaselineSeq = 65535; acknowledge(h, { seq: 1 });
    assert.equal(h.api.freshMarchOk(), true);
});
test('armout text and success report do not end strategy automatically', () => {
    const h = harness({ phase: 6 }); h.data.g_hdReportGbk = '部队已出发';
    h.internals.sync(); h.tick(); assert.equal(h.state.marchReady, false); assert.deepEqual(h.sent, []);
    acknowledge(h); h.internals.sync(); h.tick();
    assert.equal(h.state.marchReady, true); assert.deepEqual(h.sent, []);
});
test('strategy handoff exits each actual city menu and map input once then confirms once', () => {
    const h = harness(); acknowledge(h);
    Object.assign(h.menu, { active: 1, context: 1, seq: 100, names: ['侦察', '出征'] });
    h.api.goStrategyEnd(); h.tick(500); assert.deepEqual(h.sent, [VK.EXIT]);
    h.menu.seq = 101; h.tick(100); assert.deepEqual(h.sent, [VK.EXIT, VK.EXIT]);
    h.menu.active = 0; h.march.pick = 1; h.march.mapInputSeq = 200;
    h.tick(500); assert.deepEqual(h.sent, [VK.EXIT, VK.EXIT, VK.EXIT]);
    h.march.pick = 0;
    Object.assign(h.menu, { active: 1, context: 2, seq: 102, index: 0,
        names: ['策略结束', '存储进度', '结束游戏'] });
    h.tick(1000); assert.deepEqual(h.sent, [VK.EXIT, VK.EXIT, VK.EXIT, VK.ENTER]);
});
test('retained FunctionMenu bytes without active context never confirm strategy', () => {
    const h = harness(); acknowledge(h);
    Object.assign(h.menu, { active: 0, context: 2, names: ['策略结束', '存储进度', '结束游戏'] });
    h.api.goStrategyEnd(); h.tick(); assert.deepEqual(h.sent, []);
});
test('a real map returned after departure accepts strategy handoff without a city menu', () => {
    const h = harness(); acknowledge(h);
    h.march.pick = 1; h.march.mapInputSeq = 200;
    h.menu.active = 0;
    h.api.goStrategyEnd(); h.tick(500);
    assert.deepEqual(h.sent, [VK.EXIT]);
    h.march.pick = 0;
    Object.assign(h.menu, { active: 1, context: 2, seq: 100, index: 0,
        names: ['策略结束', '存储进度', '结束游戏'] });
    h.tick(500); assert.deepEqual(h.sent, [VK.EXIT, VK.ENTER]);
});
test('menu navigation uses live index and waits for engine movement acknowledgement', () => {
    const h = harness(); Object.assign(h.menu, { active: 1, context: 1, kind: 2, index: 3,
        names: ['侦察', '征兵', '分配', '掠夺', '出征'] });
    h.state.idleIndex = 0;
    h.internals.selectMenu(4, true, 'march-start', h.menu);
    h.tick(500); assert.deepEqual(h.sent, [VK.DOWN]);
    h.menu.index = 4; h.tick(100); assert.deepEqual(h.sent, [VK.DOWN, VK.ENTER]);
});
test('new menu sequence and classic mode cancel menu navigation permanently', () => {
    for (const change of ['seq', 'mode']) {
        const h = harness(); Object.assign(h.menu, { active: 1, context: 1, kind: 2, index: 2,
            names: ['侦察', '征兵', '分配', '掠夺', '出征'] });
        h.internals.selectMenu(4, true, 'march-start', h.menu);
        if (change === 'seq') h.menu.seq++;
        else { h.api.setMode('classic'); h.api.setMode('auto'); }
        h.menu.index = 3; h.tick(); assert.deepEqual(h.sent, [VK.DOWN]);
    }
});
test('already-shifted queue items cannot cross new game or mode boundaries', () => {
    for (const reason of ['pick-person', 'march-start', 'strategy-end', '']) {
        const h = harness(); h.internals.enqueue([VK.ENTER], 55, reason);
        const pending = h.captured(); h.internals.invalidate();
        for (const fn of pending) fn(); h.tick(); assert.deepEqual(h.sent, []);
    }
});
test('target cancel invalidates pending movement and waits for C idle acknowledgement', () => {
    const h = harness({ phase: 4 }); h.api.selectMarchTarget(2); h.api.confirmMarchTarget(2);
    const before = h.sent.length; assert.equal(h.api.cancelMarch(), true); h.tick();
    assert.equal(h.api.cancelMarch(), false);
    assert.equal(h.sent.length, before + 1); assert.equal(h.sent.at(-1), VK.EXIT);
    h.march.phase = 0; h.march.origin = 255; h.internals.sync();
    assert.equal(h.state.layer, 'sub'); assert.equal(h.state.marchSession, 0);
});
test('keyboard Enter belongs to one explicit march step and repeats are consumed', () => {
    const h = harness({ phase: 3 }); h.internals.bind();
    const first = h.key(13), repeated = h.key(13, true), second = h.key(13);
    assert.ok(first.defaultPrevented && repeated.defaultPrevented && second.defaultPrevented);
    assert.deepEqual(h.sent, [VK.ENTER]);
});
test('battle shell reset never advances live outcome or succession reports', () => {
    for (const text of ['拥立新君', '成为君主', '大获全胜', '我军占领河内']) {
        const h = harness(); h.data.g_hdReportGbk = text;
        const before = structuredClone(h.data); h.internals.resetAfterFight(); h.tick();
        assert.deepEqual(h.sent, []); assert.deepEqual(h.data, before);
    }
});
test('a city shell cannot open a requested city that differs from the native city', () => {
    const h = harness();
    Object.assign(h.menu, { active: 1, context: 1, kind: 1 });
    h.state.open = false;
    assert.equal(h.api.open({ cityIndex: 3 }), false);
    assert.equal(h.state.open, false);
    assert.equal(h.api.open({ cityIndex: 1 }), true);
    assert.equal(h.state.cityIndex, 1);
    assert.deepEqual(h.sent, []);
});
test('root commands expose their submenu only after the real menu acknowledges it', () => {
    const h = harness({ phase: 0 });
    Object.assign(h.state, { layer: 'root', marchSession: 0, battleMake: false });
    Object.assign(h.menu, { active: 1, context: 1, kind: 1, seq: 100, index: 0,
        names: ['内政', '外交', '军备', '状况'] });
    h.internals.chooseRoot(2); h.tick(1000);
    assert.equal(h.state.layer, 'root'); assert.deepEqual(h.sent, [VK.DOWN]);
    h.internals.chooseSub(4); assert.deepEqual(h.sent, [VK.DOWN]);
    h.menu.index = 1;
    h.setAfterKey(key => {
        if (key === VK.DOWN) h.menu.index++;
        if (key === VK.ENTER) Object.assign(h.menu, { kind: 2, seq: 101, index: 0,
            names: ['侦察', '征兵', '分配', '掠夺', '出征'] });
    });
    h.tick(1000);
    assert.equal(h.state.layer, 'sub'); assert.equal(h.state.subKind, 'junbei');
    assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.ENTER]);
});
test('departure and report phases never display retained native person menu bytes', () => {
    for (const phase of [2, 3, 5, 6, 7]) {
        const h = harness({ phase });
        h.state.personExitSent = false;
        h.menu.names = ['马玩', '分配掠夺'];
        assert.deepEqual(Array.from(h.internals.deepItems()), []);
    }
});
test('march generals expose queue IDs only when the actual active menu agrees', () => {
    const h = harness({ phase: 1 });
    Object.assign(h.data.g_Cities[1], { Persons: 3, PersonQueue: 0 });
    h.data.g_PersonsQueue = [5, 7, 6];
    h.data.g_Persons = Array.from({ length: 8 }, () => ({ Belong: 0 }));
    h.data.g_Persons[5].Belong = 1; h.data.g_Persons[6].Belong = 1;
    h.context.baye.getPersonName = id => ({ 5: '马玩', 6: '杨秋', 7: '在野武将' })[id];
    h.menu.names = ['马玩', '分配掠夺'];
    assert.deepEqual(Array.from(h.internals.deepItems()), []);
    Object.assign(h.menu, { active: 1, context: 1, kind: 3, names: ['马玩', '杨秋'] });
    assert.deepEqual(Array.from(h.internals.deepItems(), p => ({ i: p.i, pind: p.pind, name: p.name })),
        [{ i: 0, pind: 5, name: '马玩' }, { i: 1, pind: 6, name: '杨秋' }]);
    h.data.g_Cities[1].Persons = 0;
    assert.deepEqual(Array.from(h.internals.deepItems(), p => ({ i: p.i, name: p.name })),
        [{ i: 0, name: '马玩' }, { i: 1, name: '杨秋' }]);
    assert.equal(h.internals.deepItems()[0].pind, undefined);
});
test('a live native person menu preserves Mod filtering and index order', () => {
    const h = harness({ phase: 1 });
    Object.assign(h.menu, { active: 1, context: 1, kind: 3, names: ['杨秋', '马玩'] });
    assert.deepEqual(Array.from(h.internals.deepItems(), p => ({ i: p.i, name: p.name })),
        [{ i: 0, name: '杨秋' }, { i: 1, name: '马玩' }]);
});

console.log(`${count} HD march regression cases passed.`);
