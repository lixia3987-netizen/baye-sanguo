/** Executes both complete HD renderers with controlled native snapshots and
 * browser visibility/RAF scheduling. Inputs and ACK timers remain real module
 * code; only canvas drawing and the browser/engine boundary are mocked. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

const sources = {
    identity:readFileSync(new URL('../js/hd-lib-identity.js',import.meta.url),'utf8'),
    overworld: readFileSync(new URL('../js/hd-overworld.js', import.meta.url), 'utf8'),
    terrain: readFileSync(new URL('../js/hd-battle-terrain.js', import.meta.url), 'utf8'),
    feedback: readFileSync(new URL('../js/hd-battle-feedback.js', import.meta.url), 'utf8'),
    battle: readFileSync(new URL('../js/hd-battle.js', import.meta.url), 'utf8')
};
// World rendering fixtures isolate visibility using a trusted static identity contract.
// Actual LIB digests and invalidation are covered by test-hd-overworld-identity.
const mapIdentity = Object.freeze({status:'ready',generation:1,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'});
const K = { RIGHT: 0x25, ENTER: 0x27 };
const standardLibHex = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url)).toString('hex');

function browser({ modules = ['overworld', 'battle'], hidden = false, classic = false, loadedLib = false,
    canvasRect = { left: 0, top: 0, width: 1920, height: 1080 }, footerRects = [], badgeRect = null } = {}) {
    let now = 10000, nextId = 1;
    const frames = new Map(), timers = new Map(), intervals = new Map();
    const listeners = new Map(), windowListeners = new Map(), sent = [];
    const saved = new Map([
        ['baye/overworldMode', classic ? 'classic' : 'hd-map'],
        ['baye/battleMode', classic ? 'classic' : 'hd'],
        ['baye/libpath', 'libs/dat-mod.lib']
    ]);
    const fight = { active: 1, over: 0, wait: 1, phase: 1, inputKind: 1, inputSeq: 1,
        actorIndex: 255, aimType: 255, tip: '' };
    const menu = { active: 0, context: 0, kind: 0, seq: 1, index: 0, names: [] };
    const march = { pick: 0, battlePick: 0, mapInputSeq: 1, mapCity: 1 };
    const report = { active: 0, inputSeq: 1 };
    const positions = Array.from({ length: 20 }, () => ({ x: 0, y: 0, state: 8, active: 0, hp: 0 }));
    positions[0] = { x: 1, y: 1, state: 0, active: 0, hp: 180, mp: 75 };
    positions[1] = { x: 4, y: 2, state: 0, active: 0, hp: 100, mp: 42 };
    positions[10] = { x: 5, y: 3, state: 0, active: 0, hp: 100, mp: 30 };
    const generals = Array(20).fill(0); generals[0] = 1; generals[1] = 2; generals[10] = 3;
    const data = {
        g_PlayerKing: 0, g_PIdx: 1, g_YearDate: 190, g_MonthDate: 1,
        g_FgtOver: 0, g_hdFightMenuControl: 0, g_hdFightAllowRetreat: 0,
        g_hdFightActCommit: 255, g_FoucsX: 1, g_FoucsY: 1, g_MapWid: 8, g_MapHgt: 8,
        g_FgtParam: { GenArray: generals }, g_GenPos: positions,
        g_FightMapData: Array(64).fill(1), g_FightMap: Array(64).fill(1), g_FightPath: Array(225).fill(255),
        g_PathSX: 0, g_PathSY: 0, g_PUseSX: 0, g_PUseSY: 0,
        g_FgtAtkRng: [8, 0, 0, ...Array(64).fill(0)],
        g_Persons: [{ Arms: 100 }, { Arms: 100 }, { Arms: 100 }],
        g_Cities: [{ Belong: 1 }, { Belong: 3 }],
        g_CityPositions: [{ x: 1, y: 1 }, { x: 4, y: 2 }],
        g_CityPos: { setx: 1, sety: 1, x: 0, y: 0 },
        g_engineConfig: { responseNoteOfBettle: 0 }
    };
    const armTypes = [0, 1, 2], armTypeCalls = [];
    const canvasStats = { overworld: { paints: 0, labels: [], text: [], strokes: [] },
        battle: { paints: 0, labels: [], text: [], strokes: [] } };
    const layout = { canvasRect, footerRects, badgeRect };
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
            getBoundingClientRect: () => layout.canvasRect
        };
    }
    const nodes = new Map();
    for (const name of modules) {
        const root = element(`hd-${name}`), canvas = element(`hd-${name}-canvas`);
        const stats = canvasStats[name];
        let points = [], dash = [], stack = [];
        const ctx = new Proxy({
            textBaseline: 'alphabetic', textAlign: 'start',
            clearRect() { stats.paints++; stats.labels = []; stats.text = []; stats.strokes = []; },
            fillText(text, x, y, maxWidth) { stats.labels.push(String(text));
                stats.text.push({text:String(text),x,y,maxWidth,font:this.font,baseline:this.textBaseline,align:this.textAlign}); },
            save() { stack.push({font:this.font,textAlign:this.textAlign,textBaseline:this.textBaseline,
                fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,globalAlpha:this.globalAlpha,dash:[...dash]}); },
            restore() { const previous=stack.pop(); if(previous) {dash=previous.dash;delete previous.dash;Object.assign(this,previous);} },
            beginPath() { points = []; },
            moveTo(x, y) { points.push([x, y]); },
            lineTo(x, y) { points.push([x, y]); },
            setLineDash(value) { dash = Array.from(value); },
            stroke() { stats.strokes.push({ points: points.map(point => [...point]), dash: [...dash],
                color: this.strokeStyle, alpha: this.globalAlpha, width: this.lineWidth }); },
            measureText: text => ({ width: String(text).length * 10 }),
            createLinearGradient: () => ({ addColorStop() {} })
        }, { get(target, key) { return key in target ? target[key] : (() => {}); } });
        canvas.getContext = () => ctx;
        if (name === 'battle') {
            const footerButtons = Array.from({length:4},(_,i)=>{
                const node=element(`footer-${i}`);
                node.getBoundingClientRect=()=>layout.footerRects[i]??{left:0,top:0,width:0,height:0};
                if(i===0)node.setAttribute('data-hd-battle-sys','');
                return node;
            });
            root.querySelectorAll=selector=>selector==='.hd-battle-footer button'?footerButtons:
                selector==='[data-hd-battle-sys]'?[footerButtons[0]]:[];
        }
        nodes.set(root.id, root); nodes.set(canvas.id, canvas);
    }
    for (const id of ['hd-overworld-hud-left', 'hd-overworld-hud-right', 'hd-battle-hud',
        'hd-battle-menu', 'hd-battle-menu-list', 'hd-battle-menu-title', 'hd-battle-tip', 'hd-battle-result']) {
        nodes.set(id, element(id));
    }
    const badge=element('baye-build-badge');
    badge.getBoundingClientRect=()=>layout.badgeRect??{left:0,top:0,width:0,height:0};
    nodes.set(badge.id,badge);
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
        getArmType: id => { armTypeCalls.push(id); return armTypes[id]; },
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
            this.responseText = JSON.stringify(this.url.split('?')[0].endsWith('manifest.json') ? { libSha256:mapIdentity.sha256,layers: {} } : this.url.split('?')[0].endsWith('china-lcc-cities.json') ? {libSha256:mapIdentity.sha256,cities:data.g_CityPositions.map((p,i)=>({i,name:['洛阳','许昌'][i],engX:p.x,engY:p.y,hdX:400+i*600,hdY:400+i*100}))} : {libSha256:mapIdentity.sha256});
            this.onreadystatechange();
        }
    }
    const context = vm.createContext({
        document, baye, Date: Clock, Image, XMLHttpRequest,
        BayeHdLibIdentity:modules.includes('overworld')?{read:()=>mapIdentity,isCurrent:s=>s===mapIdentity,subscribe(){}}:undefined,
        dynLib: loadedLib ? standardLibHex : null, crypto: webcrypto,
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
    if (!modules.includes('overworld')) vm.runInContext(sources.identity, context, { filename: 'js/hd-lib-identity.js', timeout: 5000 });
    if (modules.includes('battle')) vm.runInContext(sources.terrain, context, { filename: 'js/hd-battle-terrain.js', timeout: 5000 });
    if (modules.includes('battle')) vm.runInContext(sources.feedback, context, { filename: 'js/hd-battle-feedback.js', timeout: 5000 });
    for (const name of modules) vm.runInContext(sources[name], context, { filename: `js/hd-${name}.js`, timeout: 5000 });
    const world = context.BayeHdOverworld, battle = context.BayeHdBattle;
    function start() { world?.start(); battle?.start(); battle?.onEngineFight(); }
    start();
    return {
        context, document, fight, menu, march, report, data, baye, sent, saved, armTypes, armTypeCalls,
        world, battle, frames, timers, intervals, canvasStats, originalMenu, start, layout,
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

test('battle pennants render all six effective native arm types, including type zero', () => {
    const h = browser({ modules: ['battle'] });
    h.data.g_Persons[0].ArmsType = 5;
    for (const [type, glyph, name] of [[0, '骑', '骑兵'], [1, '步', '步兵'], [2, '弓', '弓兵'],
        [3, '水', '水军'], [4, '极', '极兵'], [5, '玄', '玄兵']]) {
        h.armTypes[0] = type;
        const nativeBefore = JSON.stringify({ data: h.data, fight: h.fight });
        h.frame();
        assert.ok(h.canvasStats.battle.labels.includes(glyph));
        assert.ok(h.canvasStats.battle.labels.some(label => label.includes('主将 · ' + name + ' · 兵 100')));
        assert.equal(h.battle.debugSnapshot().unitList[0].armType, type);
        assert.equal(h.canvasStats.battle.strokes.filter(stroke => stroke.points.length === 5).length, 3,
            'each living general has a pennant outline');
        assert.equal(JSON.stringify({ data: h.data, fight: h.fight }), nativeBefore);
    }
    assert.deepEqual(h.sent, []);
});

test('battle focus details refresh exact native troops, HP, MP and action states without max assumptions', () => {
    const h = browser({ modules: ['battle'] });
    Object.assign(h.data.g_GenPos[0], { hp: 180, mp: 175, active: 1 });
    h.data.g_Persons[0].Arms = 12345;
    h.frame();
    assert.ok(h.canvasStats.battle.labels.includes('兵 12345'));
    assert.ok(h.canvasStats.battle.labels.includes('已'));
    assert.ok(h.canvasStats.battle.labels.some(label => label.includes('兵 12345 · HP 180 · MP 175 · 已行动')));
    const pennant = h.canvasStats.battle.strokes.find(stroke => stroke.points.length === 5);
    assert.equal(pennant.alpha, 0.58, 'spent units are visibly subdued');
    Object.assign(h.data.g_GenPos[0], { hp: 69, mp: 4, active: 0 });
    h.data.g_Persons[0].Arms = 900;
    Object.assign(h.fight, { inputKind: 2, actorIndex: 0, inputSeq: h.fight.inputSeq + 1 });
    h.frame();
    assert.ok(h.canvasStats.battle.labels.includes('行'));
    assert.ok(h.canvasStats.battle.labels.some(label => label.includes('兵 900 · HP 69 · MP 4 · 待行动')));
    assert.equal(h.canvasStats.battle.strokes.find(stroke => stroke.points.length === 5).width, 3);
    assert.equal(h.battle.debugSnapshot().unitList[0].mp, 4);
    assert.deepEqual(h.sent, []);
});

test('missing or invalid arm types and MP retain a generic visible unit; dead generals disappear', () => {
    const h = browser({ modules: ['battle'] });
    delete h.data.g_GenPos[0].mp;
    for (const value of [null, undefined, -1, 6, 1.5, NaN]) {
        h.armTypes[0] = value; h.frame();
        assert.equal(h.battle.debugSnapshot().unitList[0].armType, null);
        assert.ok(h.canvasStats.battle.labels.includes('兵'));
        assert.ok(h.canvasStats.battle.labels.some(label => label.includes('主将 · 兵种未知 · 兵 100 · HP 180 · MP —')));
    }
    h.baye.getArmType = () => { throw new Error('missing native getter'); };
    h.frame();
    assert.ok(h.canvasStats.battle.labels.includes('主将'));
    h.data.g_GenPos[0].state = 8; h.frame();
    assert.ok(!h.canvasStats.battle.labels.some(label => label.includes('主将')));
    assert.equal(h.canvasStats.battle.strokes.filter(stroke => stroke.points.length === 5).length, 2);
    assert.deepEqual(h.sent, []);
});

test('large native roster IDs never truncate through the U8 effective arm type export', () => {
    const h = browser({ modules: ['battle'] });
    h.data.g_FgtParam.GenArray[0] = 256;
    h.data.g_Persons[255] = { Arms: 876, ArmsType: 0 };
    h.armTypes[255] = 5;
    h.armTypeCalls.length = 0; h.frame();
    assert.ok(h.armTypeCalls.includes(255));
    assert.equal(h.battle.debugSnapshot().unitList[0].armType, 5);
    h.data.g_FgtParam.GenArray[0] = 257;
    h.data.g_Persons[256] = { Arms: 1234, ArmsType: 4 };
    h.armTypeCalls.length = 0; h.frame();
    assert.ok(h.armTypeCalls.every(index => index <= 255));
    assert.equal(h.battle.debugSnapshot().unitList[0].armType, null);
    assert.ok(h.canvasStats.battle.labels.includes('兵'));
    assert.ok(h.canvasStats.battle.labels.includes('兵 1234'));
    assert.deepEqual(h.sent, []);
});

test('passive attack preview uses the native wrapped range mask and rejects empty, friendly or blocked cells', () => {
    const h = browser({ modules: ['battle'] }), size = 5;
    Object.assign(h.data.g_GenPos[10], { x: 1, y: 2 });
    Object.assign(h.data, { g_FoucsX: 1, g_FoucsY: 2 });
    Object.assign(h.fight, { inputKind: 5, actorIndex: 0, aimType: 0, inputSeq: h.fight.inputSeq + 1 });
    h.data.g_FgtAtkRng = [size, 255, 255, ...Array(size * size).fill(0)];
    const targetCell = 3 + 2 + 3 * size;
    h.data.g_FgtAtkRng[targetCell] = 1;
    const nativeBefore = JSON.stringify({ data: h.data, fight: h.fight });
    h.frame();
    const lines = () => h.canvasStats.battle.strokes.filter(stroke => stroke.dash.length);
    assert.equal(lines().length, 1);
    assert.deepEqual(lines()[0].points, [[410, 244.5], [410, 359.5]],
        'line endpoints match the unchanged board coordinates');
    assert.ok(h.canvasStats.battle.labels.some(label => label.startsWith('攻击目标：敌将')));
    assert.equal(JSON.stringify({ data: h.data, fight: h.fight }), nativeBefore);
    for (const value of [0, 2, 255]) {
        h.data.g_FgtAtkRng[targetCell] = value; h.frame();
        assert.equal(lines().length, 0);
        assert.ok(!h.canvasStats.battle.labels.some(label => label.startsWith('攻击目标：')));
    }
    h.data.g_FoucsY = 1;
    h.data.g_FgtAtkRng[3 + 2 + 2 * size] = 1; h.frame();
    assert.equal(lines().length, 0, 'a friendly unit is not a normal attack target');
    h.data.g_FoucsX = 0; h.data.g_FoucsY = 0;
    h.data.g_FgtAtkRng[3 + 1 + size] = 1; h.frame();
    assert.equal(lines().length, 0, 'an allowed but unoccupied cell is not a target');
    assert.deepEqual(h.sent, []);
});

test('skill preview describes a friendly unit only as in range and retires under native report ownership', () => {
    const h = browser({ modules: ['battle'] });
    Object.assign(h.fight, { inputKind: 5, actorIndex: 0, aimType: 1, inputSeq: h.fight.inputSeq + 1 });
    Object.assign(h.data, { g_FoucsX: 4, g_FoucsY: 2 });
    h.data.g_FgtAtkRng[3 + 4 + 2 * 8] = 1;
    h.frame();
    assert.equal(h.canvasStats.battle.strokes.filter(stroke => stroke.dash.length).length, 1);
    assert.ok(h.canvasStats.battle.labels.some(label => label.startsWith('射程内目标：副将')));
    h.report.active = 1;
    const nativeBefore = JSON.stringify({ data: h.data, fight: h.fight, report: h.report });
    h.frame();
    assert.equal(h.canvasStats.battle.strokes.filter(stroke => stroke.dash.length).length, 0);
    assert.ok(!h.canvasStats.battle.labels.some(label => label.startsWith('射程内目标：')));
    assert.equal(JSON.stringify({ data: h.data, fight: h.fight, report: h.report }), nativeBefore);
    assert.deepEqual(h.sent, []);
});

async function trustedBattle() {
    const h = browser({ modules: ['battle'], loadedLib: true });
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        h.frame();
        if (h.battle.debugSnapshot().terrain?.verified) return h;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('actual standard LIB identity was not verified');
}

test('battle terrain keeps native non-square full-map stride and displays empty focus without engine input', async () => {
    const h = await trustedBattle();
    h.data.g_MapWid = 9; h.data.g_MapHgt = 7;
    h.data.g_FightMapData = Array(65536).fill(1);
    h.data.g_FightMapData[6 * 9 + 8] = 41;
    h.data.g_FightMap = Array(256).fill(5);
    h.data.g_MapSX = 20; h.data.g_MapSY = 30;
    h.data.g_FoucsX = 8; h.data.g_FoucsY = 6;
    const nativeBefore = JSON.stringify({ data: h.data, fight: h.fight });
    h.frame();
    const s = h.battle.debugSnapshot();
    assert.equal(s.terrain.width, 9); assert.equal(s.terrain.height, 7); assert.equal(s.terrain.stride, 9);
    assert.equal(s.focusTerrain.label, '营寨'); assert.equal(s.focusTerrain.raw, 41);
    assert.ok(h.canvasStats.battle.labels.some(label => label.includes('地形：营寨') && label.includes('8,6')));
    assert.equal(JSON.stringify({ data: h.data, fight: h.fight }), nativeBefore);
    assert.deepEqual(h.sent, []);
});

test('battle never interprets an LCD cache or expanded visual bounds as native terrain', async () => {
    const h = await trustedBattle();
    delete h.data.g_FightMapData;
    h.data.g_FightMap = Array(256).fill(41);
    h.frame();
    assert.equal(h.battle.debugSnapshot().terrain.source, 'unknown');
    assert.equal(h.battle.debugSnapshot().focusTerrain.kind, 'unknown');
    h.data.g_FightMapData = Array(65536).fill(41);
    h.data.g_MapWid = 3; h.data.g_MapHgt = 2;
    h.data.g_FoucsX = 5; h.data.g_FoucsY = 3;
    h.frame();
    const s = h.battle.debugSnapshot();
    assert.ok(s.mapW > s.terrain.width);
    assert.equal(s.terrain.width, 3); assert.equal(s.terrain.stride, 3);
    assert.equal(s.focusTerrain.kind, 'unknown'); assert.equal(s.focusTerrain.raw, null);
    delete h.data.g_MapWid; h.frame();
    assert.equal(h.battle.debugSnapshot().terrain.width, 0, 'fixed allocation cannot infer missing native dimensions');
    assert.deepEqual(h.sent, []);
});

test('native occupied-cell mismatch makes the whole terrain presentation neutral until agreement returns', async () => {
    const h = await trustedBattle();
    h.data.g_FightMapData.fill(5);
    h.baye.getTerrainByGeneralIndex = () => 1;
    h.frame();
    assert.equal(h.battle.debugSnapshot().terrain.verified, false);
    assert.equal(h.battle.debugSnapshot().terrain.reason, 'native-mismatch');
    assert.equal(h.battle.debugSnapshot().focusTerrain.kind, 'unknown');
    h.baye.getTerrainByGeneralIndex = () => 3;
    h.frame();
    assert.equal(h.battle.debugSnapshot().focusTerrain.label, '森林');
    assert.deepEqual(h.sent, []);
});

test('stale preferred LIB metadata and custom terrain hooks cannot authorize terrain labels or invoke hooks', async () => {
    const h = await trustedBattle();
    h.context.dynLib = '00' + standardLibHex.slice(2);
    h.frame();
    assert.equal(h.battle.debugSnapshot().terrain.verified, false);
    assert.equal(h.battle.debugSnapshot().focusTerrain.kind, 'unknown');
    h.context.dynLib = standardLibHex;
    const deadline = Date.now() + 3000;
    while (!h.battle.debugSnapshot().terrain.verified && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10)); h.frame();
    }
    assert.equal(h.battle.debugSnapshot().terrain.verified, true);
    let calls = 0;
    h.baye.hooks.drawMapUnit = () => { calls++; };
    h.frame();
    assert.equal(h.battle.debugSnapshot().focusTerrain.kind, 'unknown');
    assert.equal(calls, 0, 'paint must not invoke a Mod hook');
    assert.deepEqual(h.sent, []);
});

test('movement feedback and focus use the native wrapped mask and retire under a report without input', () => {
    const h=browser({modules:['battle']});
    Object.assign(h.fight,{inputKind:2,actorIndex:0,inputSeq:9});
    Object.assign(h.data,{g_PathSX:255,g_PathSY:255,g_PUseSX:0,g_PUseSY:0,g_FoucsX:2,g_FoucsY:2});
    h.data.g_FightPath.fill(255);h.data.g_FightPath[3*15+3]=128;
    h.frame();
    const model=h.battle.debugSnapshot().feedback;
    assert.equal(model.active,true);assert.equal(model.kind,'move');
    assert.equal(model.focus.status,'in');assert.equal(model.focus.raw,128);
    assert.equal(model.cells.find(c=>c.x===2&&c.y===2).index,48);
    assert.ok(h.canvasStats.battle.labels.some(label=>label.includes('移动范围')));
    assert.ok(h.canvasStats.battle.labels.some(label=>label.includes('当前格：可移动')));
    h.report.active=1;
    const nativeBefore=JSON.stringify({data:h.data,fight:h.fight,report:h.report});
    h.frame();
    assert.equal(h.battle.debugSnapshot().feedback.active,false);
    assert.ok(!h.canvasStats.battle.labels.some(label=>label.includes('移动范围')));
    assert.equal(JSON.stringify({data:h.data,fight:h.fight,report:h.report}),nativeBefore);
    assert.deepEqual(h.sent,[]);
});

test('range feedback returns current input ownership and mask hot changes without stale target markers', () => {
    const h=browser({modules:['battle']});
    Object.assign(h.fight,{inputKind:5,actorIndex:0,aimType:0,inputSeq:9});
    Object.assign(h.data,{g_FoucsX:5,g_FoucsY:3});
    h.data.g_FgtAtkRng[3+5+3*8]=1;h.frame();
    assert.equal(h.battle.debugSnapshot().feedback.kind,'attack');
    assert.deepEqual(Array.from(h.battle.debugSnapshot().feedback.rangedUnits,u=>u.i),[10]);
    assert.equal(h.battle.debugSnapshot().feedback.focus.label,'射程内敌将');
    h.data.g_FgtAtkRng[3+5+3*8]=2;h.frame();
    assert.equal(h.battle.debugSnapshot().feedback.focus.status,'out');
    assert.equal(h.battle.debugSnapshot().feedback.rangedUnits.length,0);
    assert.equal(h.canvasStats.battle.strokes.filter(s=>s.dash.length).length,0);
    for(const change of [{inputSeq:0},{inputSeq:10,actorIndex:255},{actorIndex:0,inputKind:3},{inputKind:5,wait:0}]) {
        Object.assign(h.fight,change);h.frame();
        assert.equal(h.battle.debugSnapshot().feedback.active,false);
        assert.ok(!h.canvasStats.battle.labels.some(label=>label.includes('攻击射程')));
    }
    assert.deepEqual(h.sent,[]);
});

test('skill feedback has a distinct range label and friendly marker but makes no effectiveness claim', () => {
    const h=browser({modules:['battle']});
    Object.assign(h.fight,{inputKind:5,actorIndex:0,aimType:1,inputSeq:9});
    Object.assign(h.data,{g_FoucsX:4,g_FoucsY:2});
    h.data.g_FgtAtkRng[3+4+2*8]=1;h.frame();
    const model=h.battle.debugSnapshot().feedback;
    assert.equal(model.active,true);assert.equal(model.kind,'skill');
    assert.equal(model.focus.label,'射程内目标');
    assert.deepEqual(Array.from(model.rangedUnits,u=>u.i),[1]);
    assert.ok(h.canvasStats.battle.labels.some(label=>label.includes('计谋射程')));
    assert.doesNotMatch(JSON.stringify(model),/可施展|可攻击|有效目标|伤害|命中率/);
    const world=()=>JSON.stringify({positions:h.data.g_GenPos,roster:h.data.g_FgtParam,
        path:h.data.g_FightPath,range:h.data.g_FgtAtkRng,fight:h.fight});
    const nativeBefore=world();
    h.setHidden(true);
    assert.equal(h.battle.debugSnapshot().feedback.active,false);
    h.setHidden(false);h.frame();
    assert.equal(h.battle.debugSnapshot().feedback.kind,'skill');
    h.battle.setMode('classic');h.frame();
    assert.equal(h.battle.debugSnapshot().feedback.active,false);
    assert.equal(world(),nativeBefore);
    assert.deepEqual(h.sent,[]);
});

test('native bounds constrain range feedback even when roster and focus expand the display board', () => {
    const h=browser({modules:['battle']});
    Object.assign(h.fight,{inputKind:2,actorIndex:0,inputSeq:9});
    Object.assign(h.data,{g_MapWid:3,g_MapHgt:2,g_FoucsX:5,g_FoucsY:3});
    h.data.g_FightPath.fill(0);h.frame();
    const s=h.battle.debugSnapshot();
    assert.ok(s.mapW>3);assert.equal(s.feedback.bounds.width,3);
    assert.equal(s.feedback.active,true);
    assert.ok(s.feedback.cells.every(c=>c.x<3&&c.y<2));
    assert.equal(s.feedback.focus.status,'out');
    assert.equal(s.feedback.rangedUnits.length,0);
    assert.deepEqual(h.sent,[]);
});

test('malformed range masks retire actor badge as well as contours and target line', () => {
    for(const kind of [2,5]) {
        const h=browser({modules:['battle']});
        Object.assign(h.fight,{inputKind:kind,actorIndex:0,aimType:0,inputSeq:9});
        h.data.g_FightPath.fill(0);h.data.g_FgtAtkRng[3+5+3*8]=1;
        Object.assign(h.data,{g_FoucsX:5,g_FoucsY:3});h.frame();
        assert.equal(h.battle.debugSnapshot().feedback.active,true);
        assert.ok(h.canvasStats.battle.labels.includes('行'));
        if(kind===2)h.data.g_FightPath=Array(224).fill(0);
        else h.data.g_FgtAtkRng=[8,0,0,...Array(63).fill(1)];
        h.frame();assert.equal(h.battle.debugSnapshot().feedback.active,false);
        assert.ok(!h.canvasStats.battle.labels.includes('行'));
        assert.equal(h.canvasStats.battle.strokes.filter(s=>s.dash.length).length,0);
        assert.deepEqual(h.sent,[]);
    }
});

test('unknown aim type cannot be coerced into an attack presentation', () => {
    for(const aimType of [null,undefined,255,'0',false]) {
        const h=browser({modules:['battle']});
        Object.assign(h.fight,{inputKind:5,actorIndex:0,aimType,inputSeq:9});
        Object.assign(h.data,{g_FoucsX:5,g_FoucsY:3});
        h.data.g_FgtAtkRng[3+5+3*8]=1;h.frame();
        assert.equal(h.battle.debugSnapshot().feedback.active,false);
        assert.ok(!h.canvasStats.battle.labels.some(label=>label.includes('攻击射程')||label.startsWith('攻击目标：')));
        assert.ok(!h.canvasStats.battle.labels.includes('行'));
        assert.equal(h.canvasStats.battle.strokes.filter(s=>s.dash.length).length,0);
        assert.deepEqual(h.sent,[]);
    }
});

test('a genuine current action or skill menu keeps the selected actor badge without range feedback', () => {
    const h=browser({modules:['battle']});
    for(const kind of [3,4]) {
        Object.assign(h.fight,{inputKind:kind,actorIndex:0,wait:0,inputSeq:9+kind});
        Object.assign(h.menu,{active:1,context:3,kind,seq:9+kind,index:0,names:['测试选择']});
        h.battle.onEngineHook('onMenuIdle');h.frame();
        assert.equal(h.battle.debugSnapshot().feedback.active,false);
        assert.ok(h.canvasStats.battle.labels.includes('行'),'owned native menu still identifies its acting general');
    }
    assert.deepEqual(h.sent,[]);
});

const unitLegendEntries = ['蓝：己方','红：敌方','待：可行动','已：已行动','行：当前将领'];
function assertUnitLegendClear(h) {
    const lines=h.canvasStats.battle.text.filter(line=>unitLegendEntries.some(entry=>line.text.startsWith(entry)));
    const text=lines.map(line=>line.text).join(' · ');
    for(const entry of unitLegendEntries)assert.equal(text.split(entry).length-1,1,entry+' remains readable once');
    const canvas=h.layout.canvasRect;
    for(const line of lines) {
        assert.equal(line.baseline,'top');assert.match(line.font,/^15px /);
        assert.ok(line.y>=992,'legend stays below the original board');
        const ink={left:canvas.left+line.x/1920*canvas.width,top:canvas.top+line.y/1080*canvas.height,
            width:line.text.length*10/1920*canvas.width,height:18/1080*canvas.height};
        assert.ok(ink.top+ink.height<=canvas.top+canvas.height,'legend remains inside its canvas');
        for(const obstacle of [...h.layout.footerRects,h.layout.badgeRect].filter(Boolean)) {
            const overlaps=ink.left<obstacle.left+obstacle.width&&ink.left+ink.width>obstacle.left&&
                ink.top<obstacle.top+obstacle.height&&ink.top+ink.height>obstacle.top;
            assert.equal(overlaps,false,'legend does not cover a real footer button or build badge');
        }
    }
    return lines;
}

test('unit legend clears actual 720p and 1080p controls without changing the board or native state', () => {
    for(const layout of [
        {canvasRect:{left:0,top:0,width:1280,height:720},
            footerRects:Array.from({length:4},(_,i)=>({left:104+i*88,top:680,width:80,height:36})),
            badgeRect:{left:8,top:690,width:81,height:22}},
        {canvasRect:{left:0,top:0,width:1920,height:1080},
            footerRects:Array.from({length:4},(_,i)=>({left:104+i*100,top:1024,width:90,height:40})),
            badgeRect:{left:8,top:1050,width:81,height:22}}
    ]) {
        const h=browser({modules:['battle'],...layout});
        const native=JSON.stringify(h.data),fight=JSON.stringify(h.fight);h.frame();
        const lines=assertUnitLegendClear(h);assert.equal(lines.length,1);
        assert.equal(lines[0].x,80);assert.equal(lines[0].y,998);
        const details=h.canvasStats.battle.text.find(line=>line.text.startsWith('地形：'));
        assert.equal(details.baseline,'alphabetic','legend restores the focus HUD text baseline');
        const border=h.canvasStats.battle.strokes.find(s=>s.points.length===2&&s.points[0][0]===80&&
            s.points[0][1]===992&&s.points[1][0]===1840&&s.points[1][1]===992);
        assert.ok(border,'native tile rendering keeps the recorded board edge');
        assert.equal(JSON.stringify(h.data),native);assert.equal(JSON.stringify(h.fight),fight);
        assert.deepEqual(h.sent,[]);
    }
});

test('legend responds to real button bounds and letterbox offsets on resize, with no key sends', () => {
    const h=browser({modules:['battle']});h.frame();assertUnitLegendClear(h);
    h.layout.canvasRect={left:320,top:180,width:1280,height:720};
    h.layout.footerRects=Array.from({length:4},(_,i)=>({left:424+i*88,top:860,width:80,height:36}));
    h.layout.badgeRect={left:8,top:1050,width:81,height:22};
    h.resize();h.frame();assertUnitLegendClear(h);
    // A different live toolbar position crosses the preferred left slot.
    // Its measured bounds, rather than a guessed footer height, move the key.
    h.layout.footerRects=Array.from({length:4},(_,i)=>({left:340,top:835+i*12,width:102,height:20}));
    h.frame();const moved=assertUnitLegendClear(h);assert.ok(moved[0].x>80);
    h.setHidden(true);const paints=h.canvasStats.battle.paints;
    h.layout.canvasRect={left:0,top:0,width:1920,height:1080};h.resize();h.frame();
    assert.equal(h.canvasStats.battle.paints,paints,'hidden layout changes do not restart painting');
    assert.deepEqual(h.sent,[]);
});

test('unit legend retains a complete canvas fallback when footer DOM geometry is unavailable', () => {
    const h=browser({modules:['battle']});
    h.document.getElementById('hd-battle').querySelectorAll=()=>[];
    h.document.getElementById('hd-battle-canvas').getBoundingClientRect=()=>({left:0,top:0,width:0,height:0});
    h.frame();assert.equal(assertUnitLegendClear(h).length,1);assert.deepEqual(h.sent,[]);
});
