/** Executes both complete HD renderers with controlled native snapshots and
 * browser visibility/RAF scheduling. Inputs and ACK timers remain real module
 * code; only canvas drawing and the browser/engine boundary are mocked. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const sources = {
    overworld: readFileSync(new URL('../js/hd-overworld.js', import.meta.url), 'utf8'),
    battle: readFileSync(new URL('../js/hd-battle.js', import.meta.url), 'utf8')
};
const K = { RIGHT: 0x25, ENTER: 0x27 };

function browser({ modules = ['overworld', 'battle'], hidden = false, classic = false } = {}) {
    let now = 10000, nextId = 1;
    const frames = new Map(), timers = new Map(), intervals = new Map();
    const listeners = new Map(), windowListeners = new Map(), sent = [];
    const saved = new Map([
        ['baye/overworldMode', classic ? 'classic' : 'hd-map'],
        ['baye/battleMode', classic ? 'classic' : 'hd']
    ]);
    const fight = { active: 1, over: 0, wait: 1, phase: 1, inputKind: 1, inputSeq: 1,
        actorIndex: 255, aimType: 255, tip: '' };
    const menu = { active: 0, context: 0, kind: 0, seq: 1, index: 0, names: [] };
    const march = { pick: 0, battlePick: 0, mapInputSeq: 1, mapCity: 1 };
    const report = { active: 0, inputSeq: 1 };
    const positions = Array.from({ length: 20 }, () => ({ x: 0, y: 0, state: 8, active: 0, hp: 0 }));
    positions[0] = { x: 1, y: 1, state: 0, active: 0, hp: 100 };
    positions[1] = { x: 4, y: 2, state: 0, active: 0, hp: 100 };
    positions[10] = { x: 5, y: 3, state: 0, active: 0, hp: 100 };
    const generals = Array(20).fill(0); generals[0] = 1; generals[1] = 2; generals[10] = 3;
    const data = {
        g_PlayerKing: 0, g_PIdx: 1, g_YearDate: 190, g_MonthDate: 1,
        g_FgtOver: 0, g_hdFightMenuControl: 0, g_hdFightAllowRetreat: 0,
        g_hdFightActCommit: 255, g_FoucsX: 1, g_FoucsY: 1, g_MapWid: 8, g_MapHgt: 8,
        g_FgtParam: { GenArray: generals }, g_GenPos: positions,
        g_FightMap: Array(64).fill(1), g_FightPath: Array(225).fill(255),
        g_Persons: [{ Arms: 100 }, { Arms: 100 }, { Arms: 100 }],
        g_Cities: [{ Belong: 1 }, { Belong: 3 }],
        g_CityPositions: [{ x: 1, y: 1 }, { x: 4, y: 2 }],
        g_CityPos: { setx: 1, sety: 1, x: 0, y: 0 },
        g_engineConfig: { responseNoteOfBettle: 0 }
    };
    const canvasStats = { overworld: { paints: 0, labels: [] }, battle: { paints: 0, labels: [] } };
    function element(id) {
        const attrs = new Map(), handlers = new Map();
        return {
            id, width: 0, height: 0, hidden: false,
            classList: { toggle() {}, add() {}, remove() {} },
            setAttribute: (key, value) => attrs.set(key, String(value)),
            getAttribute: key => attrs.get(key) ?? null,
            addEventListener(type, callback) {
                if (!handlers.has(type)) handlers.set(type, []);
                handlers.get(type).push(callback);
            },
            querySelectorAll: () => [],
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 })
        };
    }
    const nodes = new Map();
    for (const name of modules) {
        const root = element(`hd-${name}`), canvas = element(`hd-${name}-canvas`);
        const stats = canvasStats[name];
        const ctx = new Proxy({
            clearRect() { stats.paints++; stats.labels = []; },
            fillText(text) { stats.labels.push(String(text)); },
            measureText: text => ({ width: String(text).length * 10 }),
            createLinearGradient: () => ({ addColorStop() {} })
        }, { get(target, key) { return key in target ? target[key] : (() => {}); } });
        canvas.getContext = () => ctx;
        nodes.set(root.id, root); nodes.set(canvas.id, canvas);
    }
    for (const id of ['hd-overworld-hud-left', 'hd-overworld-hud-right', 'hd-battle-hud',
        'hd-battle-menu', 'hd-battle-menu-list', 'hd-battle-menu-title', 'hd-battle-tip', 'hd-battle-result']) {
        nodes.set(id, element(id));
    }
    const document = {
        hidden, documentElement: element('html'), body: element('body'),
        getElementById: id => nodes.get(id) ?? null,
        addEventListener(type, callback) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(callback);
        }
    };
    const originalMenu = function () { return 4; };
    const baye = {
        data, ensureData: () => data, hooks: { fightOpenMainMenu: originalMenu },
        callHook(name) { return this.hooks[name]?.(); }, hdCityLimit: () => data.g_Cities.length,
        getCityName: id => ['洛阳', '许昌'][id], getPersonName: id => ['主将', '副将', '敌将'][id],
        hd: { ready: () => true, fight: () => ({ ...fight }),
            menuItems: () => ({ ...menu, names: [...menu.names] }), march: () => ({ ...march }),
            report: () => ({ ...report }), reportText: () => '' },
        sendKey: key => sent.push(key)
    };
    class Clock extends Date { static now() { return now; } }
    class Image { set src(value) { this.onerror?.(); } }
    class XMLHttpRequest {
        open(method, url) { this.url = url; }
        send() {
            this.readyState = 4; this.status = 200;
            this.responseText = JSON.stringify(this.url.endsWith('manifest.json') ? { layers: {} } : {});
            this.onreadystatechange();
        }
    }
    const context = vm.createContext({
        document, baye, Date: Clock, Image, XMLHttpRequest,
        console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } },
        localStorage: { getItem: key => saved.get(key) ?? null,
            setItem: (key, value) => saved.set(key, String(value)) },
        setTimeout(callback, delay = 0) { const id = nextId++; timers.set(id, { callback, due: now + delay }); return id; },
        clearTimeout: id => timers.delete(id),
        setInterval(callback) { const id = nextId++; intervals.set(id, callback); return id; },
        clearInterval: id => intervals.delete(id),
        requestAnimationFrame(callback) { const id = nextId++; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        addEventListener(type, callback) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(callback);
        }, devicePixelRatio: 1
    });
    context.window = context;
    for (const name of modules) vm.runInContext(sources[name], context, { filename: `js/hd-${name}.js`, timeout: 5000 });
    const world = context.BayeHdOverworld, battle = context.BayeHdBattle;
    function start() { world?.start(); battle?.start(); battle?.onEngineFight(); }
    start();
    return {
        context, document, fight, menu, march, report, data, baye, sent, saved,
        world, battle, frames, timers, intervals, canvasStats, originalMenu, start,
        listenerCount: () => (listeners.get('visibilitychange') ?? []).length,
        setHidden(value) {
            document.hidden = value;
            for (const callback of listeners.get('visibilitychange') ?? []) callback();
        },
        resize() { for (const callback of windowListeners.get('resize') ?? []) callback(); },
        frame() {
            const pending = [...frames.entries()]; now += 17;
            for (const [id, callback] of pending) { if (frames.delete(id)) callback(); }
        },
        tick(ms = 16) {
            now += ms;
            for (const [id, timer] of [...timers.entries()]) {
                if (timer.due <= now && timers.delete(id)) timer.callback();
            }
        },
        poll() { for (const callback of intervals.values()) callback(); }
    };
}

test('both renderers stop painting and scheduling frames while hidden, including cancelled callbacks', () => {
    const h = browser(); h.frame();
    assert.equal(h.frames.size, 2);
    const cancelled = [...h.frames.values()];
    h.setHidden(true);
    const before = structuredClone(h.canvasStats);
    const canvas = h.document.getElementById('hd-overworld-canvas');
    const size = [canvas.width, canvas.height];
    assert.equal(h.frames.size, 0);
    for (const callback of cancelled) callback();
    h.context.devicePixelRatio = 2;
    h.frame(); h.poll(); h.resize(); h.world.panBy(10, 10); h.world.debugPaintFeedback({ selectedIndex: 1 });
    h.battle.recoverMenu(); h.battle.onEngineHook('drawMapUnit');
    assert.deepEqual(h.canvasStats, before);
    assert.deepEqual([canvas.width, canvas.height], size, 'hidden resize cannot clear the canvas by changing its backing size');
    assert.equal(h.frames.size, 0);
    assert.deepEqual(h.sent, []);
});

test('startup in a hidden tab does not paint or queue frames, then reads current native fight on resume', () => {
    const h = browser({ hidden: true });
    assert.equal(h.frames.size, 0);
    assert.equal(h.canvasStats.overworld.paints + h.canvasStats.battle.paints, 0);
    h.data.g_GenPos[0].x = 7; h.data.g_Persons[0].Arms = 59;
    h.setHidden(false);
    assert.equal(h.frames.size, 2);
    const unit = h.battle.debugSnapshot().unitList.find(unit => unit.id === 1);
    assert.equal(unit.x, 7); assert.equal(unit.arms, 59);
    assert.ok(h.canvasStats.battle.labels.includes('主将'));
    assert.deepEqual(h.sent, []);
});

test('resume samples latest whole-world ownership/date and native map owner immediately', () => {
    const h = browser({ modules: ['overworld'] });
    h.fight.active = 0; h.march.pick = 1; h.frame();
    h.setHidden(true);
    h.data.g_Cities[1].Belong = 1; h.data.g_MonthDate = 4;
    assert.equal(h.world.getCities()[1].belong, 3);
    h.setHidden(false);
    assert.equal(h.world.getCities()[1].belong, 1);
    assert.equal(h.world.getDateInfo().month, 4);
    assert.equal(h.world.getPhase(), 'map');
    assert.equal(h.frames.size, 1);
    assert.deepEqual(h.sent, []);
});

test('current report owner on resume keeps overworld input disabled', () => {
    const h = browser({ modules: ['overworld'] });
    h.fight.active = 0; h.march.pick = 1; h.frame();
    h.setHidden(true); h.report.active = 1;
    h.setHidden(false);
    assert.equal(h.world.getPhase(), 'other');
    assert.equal(h.world.debugSnapshot().hitsEnabled, false);
    assert.deepEqual(h.sent, []);
});

test('native victory with a pending report closes old battle before any resume paint', () => {
    const h = browser(); h.frame(); h.setHidden(true);
    const paints = h.canvasStats.battle.paints;
    h.fight.over = 1; h.data.g_FgtOver = 1; h.report.active = 1;
    const nativeBefore = JSON.stringify({ data: h.data, fight: h.fight, report: h.report });
    h.setHidden(false); h.frame();
    assert.equal(h.battle.isOpen(), false);
    assert.equal(h.battle.debugSnapshot().resultCode, 1);
    assert.equal(h.world.getPhase(), 'other');
    assert.equal(h.canvasStats.battle.paints, paints);
    assert.equal(h.frames.size, 1);
    assert.equal(JSON.stringify({ data: h.data, fight: h.fight, report: h.report }), nativeBefore);
    assert.deepEqual(h.sent, []);
});

test('hidden native-owner polling closes a terminal battle without painting or acknowledging its report', () => {
    const h = browser({ modules: ['battle'] }); h.setHidden(true);
    const before = h.canvasStats.battle.paints;
    h.fight.over = 2; h.report.active = 1; h.poll();
    assert.equal(h.battle.isOpen(), false);
    assert.equal(h.battle.debugSnapshot().resultCode, 2);
    assert.equal(h.canvasStats.battle.paints, before);
    assert.equal(h.report.active, 1);
    assert.equal(h.intervals.size, 1);
    assert.deepEqual(h.sent, []);
});

test('new-game reset while hidden cannot revive old units or cancelled battle frames', () => {
    const h = browser(); h.frame();
    const stale = [...h.frames.values()]; h.setHidden(true);
    h.fight.active = 0; h.fight.inputSeq++; h.data.g_FgtOver = 0;
    h.baye.callHook('chooseGameEntry'); h.baye.callHook('didOpenNewGame');
    h.data.g_Cities[1].Belong = 7; h.march.pick = 1;
    h.setHidden(false);
    for (const callback of stale) callback();
    assert.equal(h.battle.isOpen(), false);
    assert.equal(h.battle.debugSnapshot().units, 0);
    assert.equal(h.world.getCities()[1].belong, 7);
    assert.equal(h.frames.size, 1);
    assert.deepEqual(h.sent, []);
});

test('a fresh fight begun while hidden resumes its native roster, not the previous fight', () => {
    const h = browser({ modules: ['battle'] });
    const stale = [...h.frames.values()]; h.setHidden(true);
    h.battle.prepareNewFight();
    h.data.g_FgtParam.GenArray[0] = 2; h.data.g_FgtParam.GenArray[1] = 0;
    h.data.g_GenPos[0].x = 6; h.fight.inputSeq++;
    h.setHidden(false);
    const unit = h.battle.debugSnapshot().unitList.find(unit => unit.i === 0);
    assert.equal(unit.id, 2); assert.equal(unit.x, 6);
    for (const callback of stale) callback();
    assert.equal(h.frames.size, 1);
    assert.deepEqual(h.sent, []);
});

test('repeated startup and visibility events retain one listener and one loop per renderer', () => {
    const h = browser();
    for (let i = 0; i < 5; i++) { h.start(); h.setHidden(false); }
    assert.equal(h.listenerCount(), 2);
    assert.equal(h.intervals.size, 1);
    assert.equal(h.frames.size, 2);
    const stale = [...h.frames.values()]; h.setHidden(true); h.setHidden(false);
    const current = [...h.frames.keys()];
    for (const callback of stale) callback();
    assert.deepEqual([...h.frames.keys()], current, 'old callbacks cannot replace current loops');
    h.frame(); assert.equal(h.frames.size, 2);
    assert.deepEqual(h.sent, []);
});

test('classic startup and resume preserve existing mod menu ownership and do not schedule HD paint', () => {
    const h = browser({ classic: true });
    h.setHidden(true); h.poll(); h.setHidden(false); h.frame();
    assert.equal(h.baye.hooks.fightOpenMainMenu, h.originalMenu);
    assert.equal(h.baye.hooks.fightOpenMainMenu(), 4);
    assert.equal(h.frames.size, 0);
    assert.equal(h.canvasStats.overworld.paints + h.canvasStats.battle.paints, 0);
    assert.deepEqual(h.sent, []);
});

test('switching to classic while hidden prevents resume of old HD loop or menu hook', () => {
    const h = browser(); const stale = [...h.frames.values()]; h.setHidden(true);
    h.world.setMode('classic'); h.battle.setMode('classic');
    const before = structuredClone(h.canvasStats);
    h.setHidden(false); for (const callback of stale) callback(); h.frame();
    assert.equal(h.battle.isOpen(), false);
    assert.equal(h.baye.hooks.fightOpenMainMenu, h.originalMenu);
    assert.deepEqual(h.canvasStats, before);
    assert.equal(h.frames.size, 0);
    assert.deepEqual(h.sent, []);
});

test('hiding preserves pending input and its ACK timer; visibility alone never advances the request', () => {
    const h = browser({ modules: ['battle'] });
    assert.equal(h.battle.clickTile(4, 2).ok, true);
    assert.deepEqual(h.sent, [K.RIGHT]);
    const timerIds = [...h.timers.keys()];
    const request = JSON.stringify(h.battle.debugSnapshot().transaction);
    h.setHidden(true);
    assert.equal(JSON.stringify(h.battle.debugSnapshot().transaction), request);
    assert.deepEqual([...h.timers.keys()], timerIds);
    h.poll(); h.tick();
    assert.deepEqual(h.sent, [K.RIGHT], 'unacknowledged movement is not retried while hidden');
    h.data.g_FoucsX = 2;
    h.setHidden(false);
    assert.deepEqual(h.sent, [K.RIGHT], 'resume samples state but cannot send the next direction');
    h.tick();
    assert.deepEqual(h.sent, [K.RIGHT, K.RIGHT], 'the existing ACK timer continues the authorized user request');
    assert.equal(h.data.g_hdFightActCommit, 255);
    assert.equal(h.data.g_FgtOver, 0);
});

test('a committed user action keeps polling for its real native ACK while hidden without another Enter', () => {
    const h = browser({ modules: ['battle'] });
    assert.equal(h.battle.clickTile(1, 1).ok, true);
    assert.deepEqual(h.sent, [K.ENTER]);
    h.setHidden(true); h.tick();
    assert.equal(h.battle.debugSnapshot().transaction.committed, true);
    h.fight.inputKind = 2; h.fight.inputSeq++; h.fight.actorIndex = 0;
    h.tick();
    assert.equal(h.battle.debugSnapshot().transaction, null);
    h.setHidden(false); h.frame();
    assert.deepEqual(h.sent, [K.ENTER]);
});

test('overworld city-entry ACK work continues while painting is hidden and resume does not advance it', () => {
    const h = browser({ modules: ['overworld'] });
    h.fight.active = 0; h.march.pick = 1; h.data.g_Cities[1].Belong = 1; h.frame();
    h.world.walkToCity(1);
    const timerIds = [...h.timers.keys()];
    assert.ok(timerIds.length > 0);
    h.setHidden(true);
    assert.deepEqual([...h.timers.keys()], timerIds, 'visibility must preserve authorized entry timers');
    const paints = h.canvasStats.overworld.paints;
    h.tick(160);
    assert.deepEqual(h.sent, [0x23], 'the original entry timer can move toward the requested city');
    h.tick(40);
    assert.deepEqual(h.sent, [0x23], 'a missing native ACK cannot cause a repeated movement');
    h.data.g_CityPos.sety = 2;
    h.setHidden(false);
    assert.deepEqual(h.sent, [0x23], 'visibility samples current state without advancing city entry');
    assert.equal(h.canvasStats.overworld.paints, paints + 1);
    h.tick(40);
    assert.deepEqual(h.sent, [0x23, K.RIGHT], 'the original ACK timer observes movement and continues entry');
    assert.equal(h.world.debugSnapshot().aligning, true);
});
