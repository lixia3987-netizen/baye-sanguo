/** Manual HD inputs run against the complete browser module with controlled
 * engine acknowledgements. The separate C protocol/runtime suites validate
 * that these snapshots are produced by the real engine. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'js/hd-battle.js'), 'utf8');
const feedbackSource = readFileSync(join(root, 'js/hd-battle-feedback.js'), 'utf8');
const lcdSource = readFileSync(join(root, 'js/lcd.js'), 'utf8');
const lcdKeyboard = lcdSource.slice(lcdSource.indexOf('function onKeyDown('), lcdSource.indexOf('function bin2hex'));
const K = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, HELP: 0x26, ENTER: 0x27, EXIT: 0x28, SEARCH: 0x33 };
const I = { BUSY: 0, PICK: 1, MOVE: 2, ACT: 3, SKILL: 4, AIM: 5, SYS: 6, RETREAT: 7, SETTINGS: 8, HELP: 9, VIEW: 10 };

function game() {
    let now = 10000, nextId = 1;
    const timers = new Map(), intervals = new Map(), sent = [];
    const storage = new Map([['baye/battleMode', 'hd']]);
    const fight = { active: 1, over: 0, wait: 1, phase: 1, inputKind: I.PICK, inputSeq: 1, actorIndex: 255, aimType: 255, tip: '' };
    const menu = { active: false, context: 3, kind: 0, seq: 1, index: 0, count: 0, names: [] };
    const positions = Array.from({ length: 20 }, () => ({ x: 0, y: 0, state: 8, active: 0, hp: 0 }));
    positions[0] = { x: 1, y: 1, state: 0, active: 0, hp: 100 };
    positions[1] = { x: 4, y: 2, state: 0, active: 0, hp: 100 };
    positions[10] = { x: 5, y: 3, state: 0, active: 0, hp: 100 };
    const generals = Array(20).fill(0); generals[0] = 1; generals[1] = 2; generals[10] = 3;
    const data = {
        g_PlayerKing: 1, g_YearDate: 190, g_FgtOver: 0, g_hdFightMenuControl: 0,
        g_hdFightAllowRetreat: 0, g_hdFightActCommit: 255,
        g_FoucsX: 1, g_FoucsY: 1, g_MapWid: 8, g_MapHgt: 8,
        g_FgtParam: { GenArray: generals }, g_GenPos: positions,
        g_FightMap: Array(64).fill(1), g_FightPath: Array(225).fill(255),
        g_PathSX: 0, g_PathSY: 0, g_PUseSX: 0, g_PUseSY: 0,
        g_FgtAtkRng: [8, 0, 0, ...Array(64).fill(0)],
        g_Persons: [{ Arms: 100 }, { Arms: 100 }, { Arms: 100 }],
        g_engineConfig: { responseNoteOfBettle: 0 }, g_hdMenuCount: 4
    };
    const document = {
        getElementById: () => null, getElementsByTagName: () => [],
        documentElement: { setAttribute() {} }, body: { classList: { toggle() {} } }
    };
    const baye = {
        data, hooks: {}, hdEngineReady: () => true,
        hd: { ready: () => true, fight: () => ({ ...fight }), menuItems: () => ({ ...menu, names: [...menu.names] }) },
        getPersonName: id => ['主将', '副将', '敌将'][id], sendKey: key => sent.push(key)
    };
    class Clock extends Date { static now() { return now; } }
    const sandbox = {
        document, baye, Date: Clock, console: { log() {}, warn() {}, error(e) { throw e; } },
        localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
        setTimeout(callback, delay) { const id = nextId++; timers.set(id, { callback, due: now + delay }); return id; },
        clearTimeout: id => timers.delete(id),
        setInterval(callback) { const id = nextId++; intervals.set(id, callback); return id; },
        clearInterval: id => intervals.delete(id), requestAnimationFrame: () => nextId++,
        cancelAnimationFrame() {}, addEventListener() {}, devicePixelRatio: 1,
        bayeInputIgnored: event => !!(event.defaultPrevented || event.isComposing || event.target?.native)
    };
    sandbox.window = sandbox;
    vm.runInNewContext(feedbackSource, sandbox, { filename: 'hd-battle-feedback.js', timeout: 5000 });
    vm.runInNewContext(source, sandbox, { filename: 'hd-battle.js', timeout: 5000 });
    Object.assign(sandbox, {
        sendKey: baye.sendKey, VK_ENTER: K.ENTER, VK_EXIT: K.EXIT, VK_HELP: K.HELP,
        VK_SEARCH: K.SEARCH, VK_UP: K.UP, VK_DOWN: K.DOWN, VK_LEFT: K.LEFT, VK_RIGHT: K.RIGHT
    });
    vm.runInNewContext(lcdKeyboard, sandbox, { filename: 'lcd-keyboard.js', timeout: 5000 });
    const api = sandbox.BayeHdBattle;
    api.start(); api.enter({ hook: 'enterBattle' });
    function tick(ms = 16) {
        now += ms;
        const due = [...timers.entries()].filter(([, timer]) => timer.due <= now);
        for (const [id, timer] of due) {
            if (!timers.delete(id)) continue;
            timer.callback();
        }
    }
    function input(kind, actor = 255) {
        fight.inputKind = kind; fight.inputSeq += 1; fight.actorIndex = actor;
        fight.phase = { 1: 1, 2: 2, 5: 3 }[kind] || 0;
        fight.wait = Number([I.PICK, I.MOVE, I.AIM].includes(kind));
        menu.active = false;
    }
    function openMenu(kind, names, index = 0, actor = 0) {
        input(kind, actor); Object.assign(menu, { active: true, context: 3, kind, names, index, count: names.length, seq: menu.seq + 1 });
        api.onEngineHook('onMenuIdle');
    }
    function keyEvent(key, extra = {}) {
        const event = { key, repeat: false, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...extra };
        api.handleKey(event);
        // LCD's real handler must also see consumed events as already owned.
        sandbox.onKeyDown(event);
        return event;
    }
    return { api, baye, fight, menu, data, sent, timers, tick, input, openMenu, keyEvent, sandbox,
        poll: () => { for (const callback of intervals.values()) callback(); },
        focus(x, y) { data.g_FoucsX = x; data.g_FoucsY = y; },
        captured: () => [...timers.values()].map(timer => timer.callback),
        moveAllowed(x, y) { data.g_FightPath[y * 15 + x] = 0; },
        aimAllowed(x, y) { data.g_FgtAtkRng[3 + y * 8 + x] = 1; }
    };
}

test('render, engine hooks and polling never invent selections, attacks or turns', () => {
    const g = game();
    for (const kind of [I.PICK, I.MOVE, I.AIM, I.BUSY]) {
        g.input(kind, kind === I.PICK ? 255 : 0);
        g.aimAllowed(5, 3);
        for (let i = 0; i < 20; i++) { g.poll(); g.api.recoverMenu(); g.api.onEngineHook('drawMapUnit'); g.tick(100); }
    }
    assert.deepEqual(g.sent, []);
    assert.equal(g.data.g_hdFightActCommit, 255);
    assert.equal(g.data.g_FgtOver, 0);
});

test('unsupported legacy snapshots and busy engine reject manual commands', () => {
    const g = game();
    delete g.fight.inputKind; delete g.fight.inputSeq;
    assert.equal(g.api.clickTile(1, 1).ok, false);
    assert.equal(g.api.openSystemMenu().ok, false);
    g.input(I.BUSY);
    assert.equal(g.api.clickTile(1, 1).ok, false);
    g.keyEvent('Enter'); g.keyEvent('ArrowRight'); g.keyEvent('Escape');
    assert.deepEqual(g.sent, []);
});

test('a real native battle report blocks commands and owns keyboard confirmation', () => {
    const g = game(), report = { active: 1, inputSeq: 10 };
    g.baye.hd.report = () => report;
    g.sandbox.BayeHdDialog = { isBlockingKeyboard: () => !!report.active };
    assert.equal(g.api.clickTile(1, 1).ok, false);
    assert.equal(g.api.openSystemMenu().ok, false);
    const event = { key: 'Enter', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    assert.equal(g.api.handleKey(event), false);
    assert.equal(event.defaultPrevented, false, 'the dialog receives the original confirmation event');
    g.poll(); g.tick(4000);
    assert.deepEqual(g.sent, []);
    report.active = 0; g.input(I.PICK);
    assert.equal(g.api.clickTile(1, 1).ok, true);
    assert.deepEqual(g.sent, [K.ENTER]);
});

test('a report opened during cursor movement retires the remaining battle request', () => {
    const g = game(), report = { active: 0, inputSeq: 10 };
    g.baye.hd.report = () => report;
    assert.equal(g.api.clickTile(4, 2).ok, true);
    assert.deepEqual(g.sent, [K.RIGHT]);
    const captured = g.captured();
    report.active = 1; report.inputSeq++;
    g.focus(2, 1); captured.forEach(fn => fn()); g.tick(4000);
    assert.deepEqual(g.sent, [K.RIGHT], 'no movement or Enter enters the report wait');
    assert.equal(g.api.debugSnapshot().transaction, null);
});

test('selection rejects enemies, spent units, confused, stone and dead states', () => {
    const g = game();
    assert.equal(g.api.clickTile(5, 3).reason, 'illegal-target');
    g.data.g_GenPos[0].active = 1;
    assert.equal(g.api.clickTile(1, 1).ok, false);
    g.data.g_GenPos[0].active = 0;
    for (const state of [1, 6, 8]) {
        g.data.g_GenPos[0].state = state;
        assert.equal(g.api.clickTile(1, 1).ok, false);
    }
    g.data.g_GenPos[0].state = 3; // immobilized remains controllable in C
    assert.equal(g.api.clickTile(1, 1).ok, true);
    assert.deepEqual(g.sent, [K.ENTER]);
});

test('clicking a unit advances each direction only after the real cursor moves', () => {
    const g = game();
    assert.equal(g.api.clickTile(4, 2).ok, true);
    assert.deepEqual(g.sent, [K.RIGHT]);
    for (let i = 0; i < 10; i++) g.tick(50);
    assert.deepEqual(g.sent, [K.RIGHT], 'unacknowledged movement cannot be repeated');
    g.focus(2, 1); g.tick(); assert.deepEqual(g.sent, [K.RIGHT, K.RIGHT]);
    g.focus(3, 1); g.tick(); assert.deepEqual(g.sent, [K.RIGHT, K.RIGHT, K.RIGHT]);
    g.focus(4, 1); g.tick(); assert.equal(g.sent.at(-1), K.DOWN);
    g.focus(4, 2); g.tick(); assert.equal(g.sent.at(-1), K.ENTER);
    const count = g.sent.length;
    g.api.clickTile(4, 2); g.tick(4000);
    assert.equal(g.sent.length, count, 'Enter is delivered once');
    g.input(I.MOVE, 1); g.tick();
    assert.equal(g.api.debugSnapshot().transaction, null);
    assert.equal(g.sent.length, count, 'a selection never submits the move automatically');
});

test('single keyboard arrow sends once, waits for focus ack, then releases ownership', () => {
    const g = game();
    g.keyEvent('ArrowRight');
    for (let i = 0; i < 30; i++) g.tick(16);
    assert.deepEqual(g.sent, [K.RIGHT]);
    g.focus(2, 1); g.tick();
    assert.equal(g.api.debugSnapshot().transaction, null);
    g.keyEvent('ArrowDown'); assert.deepEqual(g.sent, [K.RIGHT, K.DOWN]);
});

test('keyboard menu arrow acknowledges actual index and handles wraparound', () => {
    const g = game();
    g.openMenu(I.ACT, ['攻击', '计谋', '查看', '待机'], 0);
    g.keyEvent('ArrowUp');
    g.tick(500); assert.deepEqual(g.sent, [K.UP]);
    g.menu.index = 3; g.tick();
    assert.equal(g.api.debugSnapshot().transaction, null);
    g.keyEvent('ArrowDown'); assert.deepEqual(g.sent, [K.UP, K.DOWN]);
});

test('keyboard repeat, composition and native form focus do not duplicate input', () => {
    const g = game();
    g.keyEvent('Enter', { repeat: true });
    g.keyEvent('Enter', { isComposing: true });
    g.keyEvent('Enter', { target: { native: true } });
    assert.deepEqual(g.sent, []);
    const event = g.keyEvent('Enter');
    assert.equal(event.defaultPrevented, true);
    g.keyEvent('Enter'); g.keyEvent('Escape');
    assert.deepEqual(g.sent, [K.ENTER]);
});

test('all LCD gaming shortcuts are consumed while busy or waiting for a command', () => {
    const g = game();
    g.input(I.BUSY);
    for (const [key, keyCode] of [['h', 72], ['f', 70], ['s', 83], [' ', 32], ['0', 48], ['9', 57]]) {
        assert.equal(g.keyEvent(key, { keyCode }).defaultPrevented, true);
        g.keyEvent(undefined, { keyCode });
    }
    g.keyEvent('!', { keyCode: 49, shiftKey: true });
    g.keyEvent('р', { keyCode: 72 });
    g.keyEvent('ы', { keyCode: 83 });
    assert.deepEqual(g.sent, []);
    g.input(I.PICK); g.api.clickTile(1, 1);
    for (const [key, keyCode] of [['h', 72], ['f', 70], ['s', 83], [' ', 32], ['0', 48]]) g.keyEvent(key, { keyCode });
    assert.deepEqual(g.sent, [K.ENTER]);
});

test('help and situation shortcuts deliver once through the owned input wait', () => {
    for (const [key, keyCode, code, kind] of [['h', 72, K.HELP, I.HELP], ['f', 70, K.SEARCH, I.VIEW], ['s', 83, K.SEARCH, I.VIEW]]) {
        const g = game();
        g.keyEvent(key, { keyCode });
        for (let i = 0; i < 10; i++) g.tick(30);
        g.keyEvent(key, { keyCode });
        assert.deepEqual(g.sent, [code]);
        g.input(kind); g.tick(); g.keyEvent('Escape', { keyCode: 27 });
        assert.deepEqual(g.sent, [code, K.EXIT]);
    }
});

test('space uses cancellation ownership and never bypasses a committed move', () => {
    const g = game();
    g.input(I.MOVE, 0); g.moveAllowed(1, 1); g.api.clickTile(1, 1);
    g.keyEvent(' ', { keyCode: 32 });
    assert.deepEqual(g.sent, [K.ENTER]);
    g.input(I.MOVE, 0); g.tick(); g.keyEvent(undefined, { keyCode: 32 });
    assert.deepEqual(g.sent, [K.ENTER, K.EXIT]);
});

test('move requests require real path cells and never choose a substitute destination', () => {
    const g = game();
    g.input(I.MOVE, 0);
    assert.equal(g.api.clickTile(2, 1).reason, 'illegal-target');
    assert.deepEqual(g.sent, []);
    g.moveAllowed(2, 1); g.api.clickTile(2, 1);
    assert.deepEqual(g.sent, [K.RIGHT]);
    g.focus(2, 1); g.tick(); assert.deepEqual(g.sent, [K.RIGHT, K.ENTER]);
    g.openMenu(I.ACT, ['攻击', '计谋', '查看', '待机']); g.tick(1000);
    assert.deepEqual(g.sent, [K.RIGHT, K.ENTER], 'arrival does not attack or rest');
});

test('a destination becoming invalid before confirmation cancels without Enter', () => {
    const g = game();
    g.input(I.MOVE, 0); g.moveAllowed(2, 1); g.api.clickTile(2, 1);
    g.data.g_FightPath[17] = 255; g.focus(2, 1); g.tick();
    assert.deepEqual(g.sent, [K.RIGHT]);
    assert.equal(g.api.debugSnapshot().lastRequest.reason, 'target-changed');
});

test('attack confirmation targets only the clicked enemy within the C range table', () => {
    const g = game();
    g.input(I.AIM, 0); g.fight.aimType = 0;
    assert.equal(g.api.clickTile(5, 3).ok, false);
    g.aimAllowed(1, 1); assert.equal(g.api.clickTile(1, 1).ok, false);
    g.aimAllowed(5, 3); g.focus(5, 3);
    assert.equal(g.api.clickTile(5, 3).ok, true);
    g.tick(1000); g.poll();
    assert.deepEqual(g.sent, [K.ENTER]);
    g.input(I.PICK); g.poll(); g.tick(1000);
    assert.deepEqual(g.sent, [K.ENTER], 'a hit does not select or attack a second unit');
});

test('attack range origins crossing the map edge use the native U8 coordinate difference', () => {
    for (const [sx, sy, x, y] of [[255, 0, 1, 2], [0, 255, 1, 2], [255, 255, 1, 2], [254, 253, 1, 0]]) {
        const g = game(), size = 5;
        Object.assign(g.data.g_GenPos[10], { x, y });
        g.data.g_FgtAtkRng = [size, sx, sy, ...Array(size * size).fill(0)];
        g.data.g_FgtAtkRng[3 + ((x - sx) & 255) + ((y - sy) & 255) * size] = 1;
        g.input(I.AIM, 0); g.fight.aimType = 0; g.focus(x, y);
        assert.equal(g.api.clickTile(x, y).ok, true);
        g.tick(1000); g.poll(); assert.deepEqual(g.sent, [K.ENTER]);
    }
});

test('wrapped attack ranges still reject blocked cells, friendly or empty targets and out-of-map input', () => {
    const g = game(), size = 8, enemyCell = 3 + 2 + 3 * size;
    Object.assign(g.data.g_GenPos[10], { x: 1, y: 2 });
    g.data.g_FgtAtkRng = [size, 255, 255, ...Array(size * size).fill(0)];
    g.input(I.AIM, 0); g.fight.aimType = 0;
    for (const value of [0, 2, 255, '1', true, -1, 256, 1.5]) {
        g.data.g_FgtAtkRng[enemyCell] = value;
        assert.equal(g.api.clickTile(1, 2).reason, 'illegal-target');
    }
    g.data.g_FgtAtkRng[3 + 2 + 2 * size] = 1;
    assert.equal(g.api.clickTile(1, 1).reason, 'illegal-target', 'an attack cannot choose the friendly commander');
    g.data.g_FgtAtkRng[3 + 1 + size] = 1;
    assert.equal(g.api.clickTile(0, 0).reason, 'illegal-target', 'an allowed cell without a living target is not an attack');
    g.data.g_FgtAtkRng[enemyCell] = 1; g.data.g_GenPos[10].state = 8;
    assert.equal(g.api.clickTile(1, 2).reason, 'illegal-target');
    for (const [x, y] of [[-1, 2], [8, 2], [1, 8], [1.5, 2], [NaN, 2]]) {
        assert.equal(g.api.clickTile(x, y).reason, 'outside-map');
    }
    g.tick(1000); g.poll(); assert.deepEqual(g.sent, []);
});

test('attack ranges with ordinary positive origins preserve the same native mask lookup', () => {
    const g = game(), size = 5;
    g.data.g_FgtAtkRng = [size, 2, 1, ...Array(size * size).fill(0)];
    g.input(I.AIM, 0); g.fight.aimType = 0;
    assert.equal(g.api.clickTile(5, 3).reason, 'illegal-target');
    g.data.g_FgtAtkRng[3 + (5 - 2) + (3 - 1) * size] = 1; g.focus(5, 3);
    assert.equal(g.api.clickTile(5, 3).ok, true);
    g.tick(1000); g.poll(); assert.deepEqual(g.sent, [K.ENTER]);
});

test('skill menus use actual items and friendly target validation remains in the engine', () => {
    const g = game();
    g.openMenu(I.SKILL, ['火攻', '治疗']);
    assert.equal(g.api.pickMenuName('计谋').ok, false);
    assert.equal(g.api.pickMenuName('治疗').ok, true);
    assert.deepEqual(g.sent, [K.DOWN]);
    g.menu.index = 1; g.tick(); assert.equal(g.sent.at(-1), K.ENTER);
    g.input(I.AIM, 0); g.fight.aimType = 1; g.aimAllowed(1, 1); g.tick();
    g.api.clickTile(1, 1); assert.deepEqual(g.sent, [K.DOWN, K.ENTER, K.ENTER]);
    g.fight.tip = '命令无效'; g.input(I.AIM, 0); g.poll(); g.tick(1000);
    assert.equal(g.sent.length, 3, 'illegal C targets are not retried or substituted');
});

test('rest navigates the current native menu index and commits exactly once', () => {
    const g = game();
    g.openMenu(I.ACT, ['攻击', '计谋', '查看', '待机'], 1);
    g.api.pickMenuName('待机'); assert.deepEqual(g.sent, [K.DOWN]);
    g.tick(300); assert.deepEqual(g.sent, [K.DOWN]);
    g.menu.index = 2; g.tick(); assert.deepEqual(g.sent, [K.DOWN, K.DOWN]);
    g.menu.index = 3; g.tick(); assert.deepEqual(g.sent, [K.DOWN, K.DOWN, K.ENTER]);
    g.api.pickMenuName('待机'); g.tick(1000);
    assert.deepEqual(g.sent, [K.DOWN, K.DOWN, K.ENTER]);
    assert.equal(g.data.g_hdFightActCommit, 255);
});

test('leftover bytes, wrong menu owner or stale menu kind cannot be commanded', () => {
    const g = game();
    g.openMenu(I.ACT, ['攻击', '计谋', '查看', '待机']);
    g.menu.active = false; assert.equal(g.api.pickMenuName('攻击').ok, false);
    g.menu.active = true; g.menu.context = 1; assert.equal(g.api.pickMenuName('攻击').ok, false);
    g.menu.context = 3; g.menu.kind = I.SYS; assert.equal(g.api.pickMenuName('攻击').ok, false);
    g.keyEvent('Enter'); assert.deepEqual(g.sent, []);
});

test('keyboard menu navigation retires when the real menu sequence changes', () => {
    const g = game();
    g.openMenu(I.ACT, ['攻击', '计谋', '查看', '待机']);
    g.keyEvent('ArrowDown');
    g.menu.index = 1; g.menu.seq += 1; g.tick();
    assert.deepEqual(g.sent, [K.DOWN]);
    assert.equal(g.api.debugSnapshot().transaction, null);
});

test('help return is explicitly owned and cannot dismiss busy animations', () => {
    const g = game();
    assert.equal(g.api.returnFromHelp().ok, false);
    g.input(I.BUSY); assert.equal(g.api.returnFromHelp().ok, false);
    g.input(I.HELP, 0); g.keyEvent('ArrowDown'); assert.deepEqual(g.sent, []);
    assert.equal(g.api.returnFromHelp().ok, true);
    g.api.returnFromHelp(); g.keyEvent('Enter'); g.tick(1000);
    assert.deepEqual(g.sent, [K.EXIT]);
    g.input(I.ACT, 0); g.tick();
    assert.equal(g.api.debugSnapshot().transaction, null);
    assert.equal(g.api.returnFromHelp().ok, false);
});

test('situation page arrows send once and await a new engine page sequence', () => {
    const g = game();
    g.input(I.VIEW);
    g.keyEvent('ArrowRight');
    for (let i = 0; i < 30; i++) g.tick(16);
    g.keyEvent('ArrowRight');
    assert.deepEqual(g.sent, [K.RIGHT]);
    g.fight.inputSeq += 1; g.tick();
    g.keyEvent('Enter'); g.tick(1000);
    assert.deepEqual(g.sent, [K.RIGHT, K.ENTER]);
});

test('opening native system menu does not end a turn; choices require genuine menus', () => {
    const g = game();
    assert.equal(g.api.pickMenuName('回合结束').ok, false);
    assert.equal(g.api.openSystemMenu().ok, true);
    assert.deepEqual(g.sent, [K.EXIT]);
    assert.equal(g.baye.hooks.fightOpenMainMenu(), -2);
    assert.equal(g.data.g_FgtOver, 0);
    g.openMenu(I.SYS, ['回合结束', '全军撤退', '战斗动画', '移动速度', '查看敌人'], 0, 255);
    g.tick(); g.api.pickMenuName('回合结束'); g.tick(1000);
    assert.deepEqual(g.sent, [K.EXIT, K.ENTER]);
});

test('retreat selection preserves a separate native confirmation step', () => {
    const g = game();
    g.openMenu(I.SYS, ['回合结束', '全军撤退', '战斗动画', '移动速度', '查看敌人'], 1, 255);
    g.api.pickMenuName('全军撤退'); assert.deepEqual(g.sent, [K.ENTER]);
    g.openMenu(I.RETREAT, ['全军撤退'], 0, 255); g.tick();
    assert.equal(g.data.g_FgtOver, 0);
    assert.deepEqual(g.sent, [K.ENTER], 'selection cannot also confirm retreat');
    g.api.cancel(); assert.deepEqual(g.sent, [K.ENTER, K.EXIT]);
    assert.equal(g.data.g_hdFightAllowRetreat, 0);
});

test('settings are selected through the live native submenu without turn commands', () => {
    const g = game();
    g.openMenu(I.SETTINGS, ['快速', '中速', '慢速'], 2, 255);
    g.api.pickMenuName('快速'); assert.deepEqual(g.sent, [K.UP]);
    g.menu.index = 1; g.tick(); assert.deepEqual(g.sent, [K.UP, K.UP]);
    g.menu.index = 0; g.tick(); assert.deepEqual(g.sent, [K.UP, K.UP, K.ENTER]);
    assert.equal(g.data.g_FgtOver, 0);
});

test('cancel retires queued movement; committed commands cannot receive a second key', () => {
    const g = game();
    g.input(I.MOVE, 0); g.moveAllowed(4, 2); g.api.clickTile(4, 2);
    const old = g.captured(); g.api.cancel();
    assert.deepEqual(g.sent, [K.RIGHT, K.EXIT]);
    g.input(I.PICK); g.tick(); for (const callback of old) callback();
    assert.deepEqual(g.sent, [K.RIGHT, K.EXIT]);
    g.focus(1, 1); g.api.clickTile(1, 1); g.api.cancel(); g.api.clickTile(1, 1);
    assert.deepEqual(g.sent, [K.RIGHT, K.EXIT, K.ENTER]);
});

test('new actor, menu or input sequence retires a pending request instead of guessing', () => {
    for (const change of ['actor', 'seq', 'menu']) {
        const g = game();
        g.openMenu(I.ACT, ['攻击', '计谋', '查看', '待机']); g.api.pickMenuName('待机');
        if (change === 'actor') g.fight.actorIndex = 1;
        if (change === 'seq') g.fight.inputSeq += 1;
        if (change === 'menu') g.menu.seq += 1;
        g.menu.index = 1; g.tick();
        assert.deepEqual(g.sent, [K.DOWN]); assert.equal(g.api.debugSnapshot().transaction, null);
    }
});

test('unacknowledged inputs time out without replay and same-input commits stay locked', () => {
    const g = game();
    g.api.clickTile(1, 1); g.tick(5100);
    assert.equal(g.api.debugSnapshot().transaction, null);
    assert.equal(g.api.debugSnapshot().lastRequest.reason, 'no-acknowledgement');
    assert.equal(g.api.clickTile(1, 1).ok, false);
    assert.deepEqual(g.sent, [K.ENTER]);
});

test('classic mode and a new battle invalidate even already captured callbacks', () => {
    for (const transition of ['classic', 'new-battle']) {
        const g = game();
        g.api.clickTile(4, 2); const old = g.captured();
        if (transition === 'classic') { g.api.setMode('classic'); g.api.setMode('hd'); }
        else { g.api.prepareNewFight(); g.api.enter({ hook: 'enterBattle' }); }
        g.focus(2, 1); for (const callback of old) callback(); g.tick(1000);
        assert.deepEqual(g.sent, [K.RIGHT]);
        assert.equal(g.data.g_hdMenuCount, 4);
        assert.equal(g.data.g_FgtOver, 0);
    }
});

test('results and succession dialogs are observed without dismissing or changing them', () => {
    const g = game();
    assert.equal(g.api.forceWin, undefined);
    g.fight.active = 0; g.fight.over = 2; g.data.g_FgtOver = 2;
    g.api.onEngineFight();
    for (let i = 0; i < 20; i++) { g.poll(); g.tick(1000); }
    assert.equal(g.api.isOpen(), false);
    assert.equal(g.api.debugSnapshot().resultCode, 2);
    assert.deepEqual(g.sent, []);
    assert.equal(g.data.g_FgtOver, 2);
    assert.equal(g.data.g_engineConfig.responseNoteOfBettle, 0);
    assert.equal(g.data.g_hdMenuCount, 4);
});

test('movement origins crossing map edges use native U8 arithmetic including raw zero and128', () => {
    for (const [sx,sy,ux,uy,x,y,raw] of [[255,0,0,0,1,2,0],[0,255,0,0,1,2,128],[249,249,2,3,1,0,127]]) {
        const g=game();
        Object.assign(g.data,{g_PathSX:sx,g_PathSY:sy,g_PUseSX:ux,g_PUseSY:uy});
        const px=(x-sx+ux)&255,py=(y-sy+uy)&255;
        g.data.g_FightPath[py*15+px]=raw;
        g.input(I.MOVE,0);g.focus(x,y);
        assert.equal(g.api.clickTile(x,y).ok,true,'wrapped native legal move '+[sx,sy,ux,uy]);
        g.tick(1000);g.poll();
        assert.deepEqual(g.sent,[K.ENTER],'only one explicit confirmation');
    }
});

test('invalid move metadata and incomplete masks cannot alias a valid destination', () => {
    for (const broken of [{g_PathSX:-1},{g_PathSY:256},{g_PUseSX:1.5},{g_PUseSY:NaN},
        {g_FightPath:[0]}, {g_FightPath:Array(224).fill(0)}]) {
        const g=game();g.data.g_FightPath.fill(0);Object.assign(g.data,broken);
        g.input(I.MOVE,0);g.focus(0,0);
        assert.equal(g.api.clickTile(0,0).ok,false);
        g.tick(1000);g.poll();assert.deepEqual(g.sent,[]);
    }
});

test('native map bounds prevent MOVE or AIM confirmations into presentation-only expansion cells', () => {
    for (const kind of [I.MOVE,I.AIM]) {
        const g=game();g.data.g_MapWid=3;g.data.g_MapHgt=2;
        g.data.g_FightPath.fill(0);g.aimAllowed(5,3);
        g.input(kind,0);g.fight.aimType=0;g.focus(5,3);
        assert.equal(g.api.clickTile(5,3).ok,false);
        g.tick(1000);g.poll();assert.deepEqual(g.sent,[]);
    }
});

test('oversized or truncated AIM masks reject confirmation even if an early enemy cell is one', () => {
    for (const [size,length] of [[16,3+16*16],[8,3+63]]) {
        const g=game();Object.assign(g.data.g_GenPos[10],{x:0,y:0});
        g.data.g_FgtAtkRng=Array(length).fill(0);
        g.data.g_FgtAtkRng[0]=size;g.data.g_FgtAtkRng[1]=g.data.g_FgtAtkRng[2]=0;g.data.g_FgtAtkRng[3]=1;
        g.input(I.AIM,0);g.fight.aimType=0;g.focus(0,0);
        assert.equal(g.api.clickTile(0,0).ok,false);
        g.tick(1000);g.poll();assert.deepEqual(g.sent,[]);
    }
});

test('unknown aim kinds and coerced metadata cannot confirm an otherwise marked enemy', () => {
    for (const broken of [{aimType:null},{aimType:undefined},{aimType:255},{aimType:'0'},
        {size:'8'},{originX:'0'},{originY:false}]) {
        const g=game();g.aimAllowed(5,3);g.input(I.AIM,0);g.fight.aimType=0;g.focus(5,3);
        if('aimType' in broken)g.fight.aimType=broken.aimType;
        if('size' in broken)g.data.g_FgtAtkRng[0]=broken.size;
        if('originX' in broken)g.data.g_FgtAtkRng[1]=broken.originX;
        if('originY' in broken)g.data.g_FgtAtkRng[2]=broken.originY;
        assert.equal(g.api.clickTile(5,3).ok,false,JSON.stringify(broken));
        g.tick(1000);g.poll();assert.deepEqual(g.sent,[]);
    }
});

// The context bar is observed through the complete battle renderer. The old
// command fixture stays unchanged; only this fixture mounts its three spans.
function statusFixture() {
    const g = game(), document = g.sandbox.document, cache = new WeakMap(), writes = [];
    function node(tagName = 'div') {
        const attrs = new Map(); let text = '';
        const value = {tagName: tagName.toUpperCase(), hidden: false, children: [],
            setAttribute(name, next) {attrs.set(name, String(next));}, getAttribute: name => attrs.get(name) ?? null,
            removeAttribute(name) {attrs.delete(name);},
            appendChild(child) {this.children.push(child); child.parentElement = this; return child;},
            querySelectorAll(selector) {
                const match = /^\[data-hd-battle-stat(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);
                return match ? this.children.filter(child => child.getAttribute('data-hd-battle-stat') !== null &&
                    (match[1] === undefined || child.getAttribute('data-hd-battle-stat') === match[1])) : [];
            }, querySelector(selector) {return this.querySelectorAll(selector)[0] ?? null;}};
        Object.defineProperty(value, 'textContent', {get() {return text + value.children.map(child => child.textContent).join('');},
            set(next) {text = String(next); value.children = [];}});
        return value;
    }
    const context = node(); context.id = 'hd-battle-context'; context.hidden = true;
    for (const field of ['day', 'weather', 'food']) {const span = node('span'); span.setAttribute('data-hd-battle-stat', field); context.appendChild(span);}
    const previousNode = document.getElementById;
    document.hidden = false; document.createElement = node;
    document.getElementById = id => id === context.id ? context : previousNode(id);
    const raw = g.data;
    Object.assign(raw, {g_hdEngineReady: 1, g_hdDetailGeneration: 7, g_PIdx: 1, g_FgtOver: 0,
        g_FgtWeather: 1, g_FgtBoutCnt: 3, g_FgtBoutMax: 20,
        g_hdReportActive: 0, g_hdHelpActive: 0, g_hdViewActive: 0});
    Object.assign(raw.g_FgtParam, {Mode: 1, CityIndex: 16, MProvender: 0});
    Object.assign(g.fight, {active: 1, over: 0, inputKind: I.PICK, inputSeq: 21, actorIndex: 255,
        cityIndex: 16, bout: 3, boutMax: 20});
    function mirror() {
        for (const [field, target] of Object.entries({active: 'Active', over: 'Over', inputKind: 'InputKind',
            inputSeq: 'InputSeq', actorIndex: 'Actor'})) raw['g_hdFight' + target] = g.fight[field];
    }
    mirror();
    function readonly(value, at = '') {
        if (!value || typeof value !== 'object') return value;
        if (cache.has(value)) return cache.get(value);
        const proxy = new Proxy(value, {get(target, field) {return readonly(target[field], at + '.' + String(field));},
            set(target, field) {writes.push(at + '.' + String(field)); throw Error('status observer wrote native data');}});
        cache.set(value, proxy); return proxy;
    }
    g.baye.data = readonly(raw); g.baye.ensureData = () => g.baye.data;
    const identity = {status: 'ready', generation: 1, byteLength: 207195,
        sha256: '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'};
    let current = true, identityHook = null, fightHook = null, currentCalls = 0;
    g.sandbox.BayeHdLibIdentity = {read: () => identity, isCurrent(value) {
        const valid = current && value === identity;
        currentCalls++; if (identityHook) identityHook(currentCalls); return valid;
    }};
    g.baye.hd.fight = () => {const value = {...g.fight}; if (fightHook) fightHook(); return value;};
    g.baye.hd.report = () => ({active: raw.g_hdReportActive});
    vm.runInNewContext(readFileSync(join(root, 'js/hd-battle-status.js'), 'utf8'), g.sandbox,
        {filename: 'hd-battle-status.js', timeout: 5000});
    return Object.assign(g, {raw, context, writes, identity, mirror,
        observe() {g.api.recoverMenu();}, readStatus() {return g.sandbox.BayeHdBattleStatus.read();},
        values() {return Object.fromEntries(context.querySelectorAll('[data-hd-battle-stat]')
            .map(span => [span.getAttribute('data-hd-battle-stat'), span.textContent]));},
        current(value) {current = value;}, identityHook(value) {identityHook = value; currentCalls = 0;},
        identityCalls() {return currentCalls;}, fightHook(value) {fightHook = value;}});
}
function statusDto(g) {const value = g.readStatus(); return value === null ? null : JSON.parse(JSON.stringify(value));}
function assertStatusHidden(g, reason) {
    assert.equal(g.context.hidden, true, reason); assert.equal(g.context.textContent, '', reason);
    assert.deepEqual(g.sent, [], reason); assert.deepEqual(g.writes, [], reason);
}

test('native battle context shows all five weather names, exact U16 food and unclamped days for player attack or defence', () => {
    const g = statusFixture();
    for (const [weather, label] of [[1, '晴'], [2, '阴'], [3, '风'], [4, '雨'], [5, '冰雹']]) {
        g.raw.g_FgtWeather = weather;
        for (const mode of [0, 1]) {
            g.raw.g_FgtParam.Mode = mode; g.observe();
            assert.equal(g.context.hidden, false);
            assert.deepEqual(g.values(), {day: '第3天 / 上限20天', weather: '天气 ' + label, food: '我方粮草 0'});
            assert.deepEqual(statusDto(g), {weather, food: 0, day: 3, limit: 20});
        }
    }
    g.raw.g_FgtParam.MProvender = 65535; g.raw.g_FgtBoutCnt = 65535; g.raw.g_FgtBoutMax = 0; g.observe();
    assert.deepEqual(g.values(), {day: '第65535天 / 上限0天', weather: '天气 冰雹', food: '我方粮草 65535'});
    g.raw.g_FgtBoutCnt = 0; g.raw.g_FgtBoutMax = 65535; g.observe();
    assert.equal(g.values().day, '第0天 / 上限65535天');
    assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
});

test('battle context invalid or absent values become unread independently without hiding a valid owner', () => {
    const fields = [['weather', 'g_FgtWeather', 5], ['food', 'MProvender', 65535],
        ['day', 'g_FgtBoutCnt', 65535], ['limit', 'g_FgtBoutMax', 65535]];
    for (const [field, sourceField, max] of fields) {
        for (const value of [undefined, null, false, '', '3', -1, max + 1, 1.5, NaN, ...(field === 'weather' ? [0] : [])]) {
            const g = statusFixture(), target = field === 'food' ? g.raw.g_FgtParam : g.raw;
            target[sourceField] = value; g.observe();
            assert.equal(g.context.hidden, false, field + ':' + String(value));
            assert.deepEqual(statusDto(g), {weather: field === 'weather' ? null : 1,
                food: field === 'food' ? null : 0, day: field === 'day' ? null : 3, limit: field === 'limit' ? null : 20});
            assert.match(g.values()[field === 'limit' ? 'day' : field], /未读取/);
            if (field !== 'food') assert.equal(g.values().food, '我方粮草 0');
            if (field !== 'weather') assert.equal(g.values().weather, '天气 晴');
            assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
        }
    }
});

test('battle context withdraws on native higher owners, ended or automatic battles, incomplete owners and unknown sources', () => {
    const changes = [g => g.raw.g_hdReportActive = 1, g => g.raw.g_hdHelpActive = 1,
        g => g.raw.g_hdViewActive = 1, g => {g.fight.over = 1; g.mirror();}, g => g.raw.g_FgtOver = 1,
        g => {g.fight.active = 0; g.mirror();}, g => g.raw.g_FgtParam.Mode = 2,
        g => delete g.raw.g_FgtParam.Mode, g => g.raw.g_FgtParam.Mode = false, g => g.raw.g_FgtParam.CityIndex = 38,
        g => g.fight.cityIndex = 15, g => {g.fight.inputKind = 11; g.mirror();},
        g => {g.fight.inputSeq = 0; g.mirror();}, g => {g.fight.actorIndex = 20; g.mirror();},
        g => g.raw.g_hdFightInputSeq++, g => g.raw.g_hdFightActor = 0,
        g => g.raw.g_hdEngineReady = 0, g => g.raw.g_hdDetailGeneration = 0,
        g => g.raw.g_PIdx = 0, g => g.identity.sha256 = 'unknown-library',
        g => g.identity.generation = 0, g => g.current(false),
        g => g.baye.hooks.didShowFightStateBar = () => {throw Error('custom native state bar must not be invoked');}];
    for (const change of changes) {
        const g = statusFixture(); g.observe(); assert.equal(g.context.hidden, false);
        change(g); g.observe(); assertStatusHidden(g, 'withdraw stale native battle context');
        assert.equal(g.readStatus(), null);
    }
});

test('battle context follows live counters in busy and menu phases without reading enemy supplies or delivering inputs', () => {
    const g = statusFixture(); let enemyReads = 0;
    Object.defineProperty(g.raw.g_FgtParam, 'EProvender', {get() {enemyReads++; throw Error('enemy supplies are not a public state-bar value');}});
    const before = JSON.stringify(g.raw, (key, value) => key === 'g_FgtParam' ? {Mode: value.Mode,
        CityIndex: value.CityIndex, MProvender: value.MProvender, GenArray: value.GenArray} : value);
    for (let kind = 0; kind <= 10; kind++) {
        Object.assign(g.fight, {inputKind: kind, inputSeq: 30 + kind, actorIndex: kind >= 2 && kind <= 5 ? 0 : 255,
            phase: 0, wait: 0}); g.mirror();
        g.raw.g_FgtBoutCnt = kind; g.raw.g_FgtBoutMax = 20; g.raw.g_FgtWeather = kind % 5 + 1;
        g.raw.g_FgtParam.MProvender = 1000 - kind;
        g.observe();
        if (kind === I.HELP || kind === I.VIEW) {
            assertStatusHidden(g, 'native HELP/VIEW owns the higher detail surface');
        } else {
            assert.equal(g.context.hidden, false);
            assert.equal(g.values().food, '我方粮草 ' + (1000 - kind));
            assert.equal(g.values().day, '第' + kind + '天 / 上限20天');
        }
        assert.deepEqual(statusDto(g), {weather: kind % 5 + 1, food: 1000 - kind, day: kind, limit: 20});
    }
    const observed = JSON.stringify(g.raw, (key, value) => key === 'g_FgtParam' ? {Mode: value.Mode,
        CityIndex: value.CityIndex, MProvender: value.MProvender, GenArray: value.GenArray} : value);
    for (let i = 0; i < 12; i++) g.observe();
    assert.equal(JSON.stringify(g.raw, (key, value) => key === 'g_FgtParam' ? {Mode: value.Mode,
        CityIndex: value.CityIndex, MProvender: value.MProvender, GenArray: value.GenArray} : value), observed);
    assert.notEqual(before, observed, 'only the controlled native publications above change the fixture');
    assert.equal(enemyReads, 0); assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
});

test('battle context refuses final callback source drift and synchronous reentry, then accepts a fresh clean observation', () => {
    const seed = statusFixture(); seed.identityHook(null); assert.ok(seed.readStatus());
    const last = seed.identityCalls(); assert.ok(last >= 3, 'identity is checked across three complete source samples');
    const changes = [g => g.raw.g_FgtWeather = 2, g => g.raw.g_FgtParam.MProvender = 1,
        g => g.raw.g_FgtBoutCnt++, g => g.raw.g_FgtBoutMax++, g => g.raw.g_FgtParam.Mode = 2,
        g => g.raw.g_hdReportActive = 1, g => g.raw.g_FgtOver = 1,
        g => g.raw.g_hdDetailGeneration++, g => g.raw.g_hdFightInputSeq++,
        g => g.identity.generation++, g => g.identity.sha256 = 'late-library',
        g => g.baye.data = {...g.raw}, g => g.raw.g_FgtParam = {...g.raw.g_FgtParam}];
    for (const change of changes) {
        const g = statusFixture(); let fired = false;
        g.identityHook(count => {if (count === last) {fired = true; change(g);}});
        assert.equal(g.readStatus(), null); assert.equal(fired, true);
        assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
    }
    const g = statusFixture(); g.observe(); assert.equal(g.context.hidden, false); let inside = false, reentered = false;
    g.fightHook(() => {if (!inside) {inside = true; reentered = true; try {g.readStatus();} finally {inside = false;}}});
    assert.equal(g.readStatus(), null); g.observe(); assert.equal(reentered, true); assertStatusHidden(g, 'reentrant current-owner callback');
    g.fightHook(null); g.observe(); assert.equal(g.context.hidden, false);
    assert.deepEqual(statusDto(g), {weather: 1, food: 0, day: 3, limit: 20});
    g.api.close({force: true, preserveEngine: true}); assertStatusHidden(g, 'closed HD battle shell');
});

// Mount only the existing menu surfaces; the production renderFightMenu writes
// the HTML observed below, and native confirmation still uses its real adapter.
function skillHintsFixture() {
    const g = statusFixture(), document = g.sandbox.document, previousNode = document.getElementById, mounted = new Map();
    for (const id of ['hd-battle-menu', 'hd-battle-menu-list', 'hd-battle-menu-title', 'hd-battle-skill-note']) {
        const value = document.createElement(id === 'hd-battle-skill-note' ? 'p' : 'div'); value.id = id;
        let html = '';
        Object.defineProperty(value, 'innerHTML', {get: () => html, set(next) {html = String(next);}});
        mounted.set(id, value);
    }
    document.getElementById = id => mounted.get(id) ?? previousNode(id);
    Object.assign(g.fight, {inputKind: I.SKILL, inputSeq: 31, actorIndex: 0, phase: 0, wait: 0}); g.mirror();
    Object.assign(g.menu, {active: 1, context: 3, kind: I.SKILL, seq: 8, generation: 7, detailGeneration: 7,
        index: 0, count: 2, itemLen: 4, names: ['SAME', 'SAME']});
    Object.assign(g.raw, {g_hdMenuActive: 1, g_hdMenuContext: 3, g_hdMenuKind: I.SKILL, g_hdMenuSeq: 8,
        g_hdMenuIndex: 0, g_hdMenuCount: 2, g_hdMenuItemLen: 4,
        g_hdMenuBytes: [83, 65, 77, 69, 83, 65, 77, 69],
        g_hdSkillActive: 1, g_hdSkillCount: 2, g_hdSkillNameLen: 4,
        g_hdSkillIds: [1, 30, 0, 0, 0, 0, 0, 0, 0, 0], g_hdSkillNameBytes: Array(80).fill(0),
        g_FightMapData: Array(64).fill(1), g_Skills: Array(2000)});
    for (const offset of [0, 8]) g.raw.g_hdSkillNameBytes.splice(offset, 4, 83, 65, 77, 69);
    g.raw.g_Skills[0] = {useMp: 0, oland: Array(8).fill(1), weather: Array(5).fill(1)};
    g.raw.g_Skills[29] = {useMp: 30, oland: Array(8).fill(1), weather: Array(5).fill(1)};
    Object.assign(g.raw.g_GenPos[0], {mp: 30, x: 1, y: 1, state: 0});
    const skills = {active: 1, count: 2, ids: [1, 30], names: ['SAME', 'SAME']};
    let terrain = 1, terrainHook = null, skillsHook = null;
    g.baye.getTerrainByGeneralIndex = actor => {assert.equal(actor, 0); if (terrainHook) terrainHook(); return terrain;};
    g.baye.hd.skills = () => {
        const value = {...skills, ids: skills.ids.slice(), names: skills.names.slice()};
        if (skillsHook) skillsHook(); return value;
    };
    vm.runInNewContext(readFileSync(join(root, 'js/hd-skill-hints.js'), 'utf8'), g.sandbox,
        {filename: 'hd-skill-hints.js', timeout: 5000});
    return Object.assign(g, {skills, skillMenu: mounted.get('hd-battle-menu'), skillList: mounted.get('hd-battle-menu-list'),
        skillTitle: mounted.get('hd-battle-menu-title'), skillNote: mounted.get('hd-battle-skill-note'),
        readHints() {const value = g.sandbox.BayeHdSkillHints.read(); return value === null ? null : JSON.parse(JSON.stringify(value));},
        terrain(value) {terrain = value;}, terrainHook(value) {terrainHook = value;}, skillsHook(value) {skillsHook = value;}});
}
function renderedSkillButtons(g) {
    return [...g.skillList.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, body]) => {
        const index = /\bdata-hd-battle-menu="([0-9]+)"/.exec(attrs);
        const hint = /<small\b([^>]*)>([\s\S]*?)<\/small>/.exec(body);
        return {index: index ? Number(index[1]) : null, disabled: /\sdisabled(?:\s|$|=)/.test(attrs),
            text: body.replace(/<[^>]*>/g, ''), hint: hint ? {id: Number(/data-hd-skill-cost="([0-9]+)"/.exec(hint[1])?.[1]),
                reason: /data-hd-skill-condition="([a-z]+)"/.exec(hint[1])?.[1], text: hint[2].replace(/<[^>]*>/g, '')} : null};
    });
}
function assertSkillButtonsUnchanged(g) {
    assert.equal(g.skillMenu.hidden, false); assert.equal(g.skillTitle.textContent, '计谋');
    const buttons = renderedSkillButtons(g); assert.deepEqual(buttons.map(button => [button.index, button.disabled]), [[0, false], [1, false]]);
    assert.ok(buttons.every(button => button.text.startsWith('SAME')));
    assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []); return buttons;
}

test('skill MP hints bind duplicate native names to exact one-based IDs including zero cost and equality', () => {
    const g = skillHintsFixture(); g.observe();
    assert.deepEqual(g.readHints(), {actor: 0, mp: 30, menuSeq: 8, inputSeq: 31, index: 0,
        names: ['SAME', 'SAME'], rows: [{id: 1, cost: 0, reason: 'ready'}, {id: 30, cost: 30, reason: 'ready'}]});
    const buttons = assertSkillButtonsUnchanged(g);
    assert.deepEqual(buttons.map(button => button.hint), [{id: 1, reason: 'ready', text: '规则消耗 0 MP'},
        {id: 30, reason: 'ready', text: '规则消耗 30 MP'}]);
    assert.equal(g.skillNote.hidden, false);
    assert.equal(g.skillNote.textContent, '当前 MP 30 · 目标与实际效果以原版判定为准。');
    g.raw.g_GenPos[0].mp = 0; g.observe();
    assert.equal(g.readHints().rows[0].reason, 'ready'); assert.equal(g.readHints().rows[1].reason, 'mp');
    assertSkillButtonsUnchanged(g);
    g.raw.g_Skills[29].useMp = 255; g.raw.g_GenPos[0].mp = 65535; g.observe();
    assert.deepEqual(g.readHints().rows[1], {id: 30, cost: 255, reason: 'ready'});
    assert.match(g.skillNote.textContent, /^当前 MP 65535 /); assertSkillButtonsUnchanged(g);
});

test('skill MP, own terrain and weather hints preserve native rejection priority without disabling the choice', () => {
    const g = skillHintsFixture(), rule = g.raw.g_Skills[29]; rule.oland[1] = 0; rule.weather[0] = 0;
    for (const [mp, land, weather, reason, suffix] of [[29, 0, 0, 'mp', 'MP不足'],
        [30, 0, 0, 'terrain', '地形不符'], [30, 1, 0, 'weather', '天候不符'], [30, 1, 1, 'ready', '']]) {
        g.raw.g_GenPos[0].mp = mp; rule.oland[1] = land; rule.weather[0] = weather; g.observe();
        assert.equal(g.readHints().rows[1].reason, reason);
        const buttons = assertSkillButtonsUnchanged(g);
        assert.equal(buttons[1].hint.reason, reason);
        assert.equal(buttons[1].hint.text, '规则消耗 30 MP' + (suffix ? ' · ' + suffix : ''));
        assert.doesNotMatch(buttons[1].text, /命中|概率|可施放|施放成功/);
    }
});

test('uncertain skill terrain, weather or cost stays advisory and target-specific coefficients are never evaluated', () => {
    const changes = [g => delete g.baye.getTerrainByGeneralIndex, g => g.terrain(255), g => g.terrain(0),
        g => delete g.raw.g_FightMapData, g => g.raw.g_FgtWeather = 0, g => g.raw.g_FgtWeather = 6];
    for (const change of changes) {
        const g = skillHintsFixture(); let targetReads = 0;
        for (const id of [0, 29]) for (const field of ['earm', 'eland', 'aim', 'power', 'destroy', 'state']) {
            Object.defineProperty(g.raw.g_Skills[id], field, {get() {targetReads++; throw Error('target rules are not menu hints');}});
        }
        change(g); g.observe();
        assert.deepEqual(g.readHints().rows, [{id: 1, cost: 0, reason: 'unknown'}, {id: 30, cost: 30, reason: 'unknown'}]);
        assert.ok(assertSkillButtonsUnchanged(g).every(button => button.hint.reason === 'unknown' && /条件未读取/.test(button.hint.text)));
        assert.equal(targetReads, 0);
    }
    const g = skillHintsFixture(); g.raw.g_Skills[29].useMp = '30'; g.observe();
    assert.deepEqual(g.readHints().rows, [{id: 1, cost: 0, reason: 'ready'}, {id: 30, cost: null, reason: 'unknown'}]);
    assertSkillButtonsUnchanged(g);
    for (const field of ['useMp', 'oland', 'weather']) {
        const h = skillHintsFixture(), rule = h.raw.g_Skills[29]; let reads = 0;
        const target = field === 'useMp' ? rule : rule[field], key = field === 'useMp' ? field : field === 'oland' ? 1 : 0;
        Object.defineProperty(target, key, {get() {return ++reads % 2 ? field === 'useMp' ? 30 : 1 : -1;}});
        h.observe(); const value = h.readHints(); assert.ok(reads > 0, field);
        if (value !== null) {
            assert.equal(value.rows[1].reason, 'unknown', field + ' cannot validate one value and publish another');
            assert.ok(value.rows[1].cost === null || Number.isInteger(value.rows[1].cost) &&
                value.rows[1].cost >= 0 && value.rows[1].cost <= 255, field);
        }
        const hint = assertSkillButtonsUnchanged(h)[1].hint;
        if (hint !== null) {
            assert.equal(hint.reason, 'unknown', field);
            assert.doesNotMatch(hint.text, /规则消耗 -/, field);
        }
    }
});

test('skill source and menu drift withdraw only the enhancement while preserving native names, indices and one-shot confirmation', () => {
    const changes = [g => g.identity.sha256 = 'unknown-library', g => g.raw.g_hdSkillActive = 0,
        g => g.skills.active = 0, g => g.raw.g_hdSkillIds[0] = 0, g => g.raw.g_hdSkillIds[1] = 31,
        g => g.skills.names[1] = 'DIFF', g => g.raw.g_hdSkillNameBytes[8] = 68,
        g => g.raw.g_hdMenuBytes[0] = 68, g => g.menu.seq++, g => g.raw.g_hdMenuIndex = 1,
        g => g.raw.g_FgtParam.Mode = 2, g => g.raw.g_FgtParam.GenArray[0] = 0,
        g => g.raw.g_GenPos[0].state = 8];
    for (const change of changes) {
        const g = skillHintsFixture(); g.observe(); assert.ok(g.readHints());
        change(g); g.observe(); assert.equal(g.readHints(), null);
        assert.ok(assertSkillButtonsUnchanged(g).every(button => button.hint === null));
        assert.equal(g.skillNote.hidden, true); assert.equal(g.skillNote.textContent, '');
    }
    const g = skillHintsFixture(); g.observe();
    assert.equal(g.api.pickMenu(0).ok, true); assert.deepEqual(g.sent, [K.ENTER]);
    g.api.pickMenu(0); g.tick(1000); assert.deepEqual(g.sent, [K.ENTER], 'one native confirmation remains consumed');
    Object.assign(g.fight, {inputKind: I.AIM, inputSeq: 32, wait: 1, phase: 3}); g.mirror(); g.menu.active = 0;
    g.raw.g_hdMenuActive = 0; g.raw.g_hdSkillActive = 0; g.skills.active = 0; g.observe();
    assert.equal(g.skillNote.hidden, true); assert.deepEqual(g.sent, [K.ENTER]); assert.deepEqual(g.writes, []);
});

test('skill hints reject final observer drift, throwing or reentrant terrain readers and recover on a fresh source', () => {
    const seed = skillHintsFixture(); seed.identityHook(null); assert.ok(seed.readHints()); const last = seed.identityCalls();
    assert.ok(last >= 2);
    const changes = [g => g.raw.g_GenPos[0].mp--, g => g.raw.g_Skills[29].useMp++,
        g => g.raw.g_Skills[29].oland[1] = 0, g => g.raw.g_FgtWeather = 2,
        g => g.raw.g_hdMenuSeq++, g => g.raw.g_hdFightInputSeq++,
        g => g.raw.g_hdSkillIds[0] = 2, g => g.identity.generation++,
        g => g.baye.data = {...g.raw}, g => g.raw.g_Skills = g.raw.g_Skills.slice()];
    for (const change of changes) {
        const g = skillHintsFixture(); let fired = false;
        g.identityHook(count => {if (count === last) {fired = true; change(g);}});
        assert.equal(g.readHints(), null); assert.equal(fired, true); assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
    }
    for (const fault of ['throw', 'reenter']) {
        const g = skillHintsFixture(); let fired = false;
        g.terrainHook(() => {fired = true; if (fault === 'throw') throw Error('native terrain unavailable'); g.readHints();});
        assert.equal(g.readHints(), null); assert.equal(fired, true); g.observe();
        assert.ok(assertSkillButtonsUnchanged(g).every(button => button.hint === null));
        assert.equal(g.skillNote.hidden, true); g.terrainHook(null); g.observe();
        assert.deepEqual(g.readHints().rows, [{id: 1, cost: 0, reason: 'ready'}, {id: 30, cost: 30, reason: 'ready'}]);
        assertSkillButtonsUnchanged(g);
    }
});

const systemSettingNames = ['回合结束', '全军撤退', '战斗动画', '移动速度', '敌军移动'];
const lookSettingNames = ['不看', '观看'], speedSettingNames = ['快速', '慢速'];
function settingsFixture(kind = I.SYS, names = systemSettingNames) {
    const g = skillHintsFixture(), document = g.sandbox.document, previousNode = document.getElementById;
    const note = document.createElement('p'); note.id = 'hd-battle-settings-note'; note.hidden = true;
    document.getElementById = id => id === note.id ? note : previousNode(id);
    Object.assign(g.fight, {inputKind: kind, inputSeq: 41, actorIndex: 255, wait: 0, phase: 0}); g.mirror();
    Object.assign(g.menu, {active: 1, context: 3, kind, seq: 12, generation: 7, detailGeneration: 7,
        index: 0, count: names.length, itemLen: kind === I.SYS ? 8 : 4, names: names.slice()});
    const bytes = {回合结束: 'bbd8bacfbde1caf8', 全军撤退: 'c8abbefcb3b7cdcb', 战斗动画: 'd5bdb6b7b6afbbad',
        移动速度: 'd2c6b6afcbd9b6c8', 敌军移动: 'b5d0befcd2c6b6af', 不看: 'b2bbbfb4', 观看: 'b9dbbfb4',
        快速: 'bfeccbd9', 慢速: 'c2fdcbd9'};
    Object.assign(g.raw, {g_hdMenuActive: 1, g_hdMenuContext: 3, g_hdMenuKind: kind,
        g_hdMenuSeq: 12, g_hdMenuIndex: 0, g_hdMenuCount: names.length,
        g_hdMenuItemLen: g.menu.itemLen, g_hdMenuBytes: names.flatMap(name => [...Buffer.from(bytes[name], 'hex')]),
        g_hdFightWait: 0, g_hdFightPhase: 0, g_hdSkillActive: 0,
        g_LookMovie: 1, g_MoveSpeed: 1, g_LookEnemy: 0});
    g.skills.active = 0;
    return Object.assign(g, {settingsNote: note,
        readSettings() {const value = g.sandbox.BayeHdBattleStatus.readSettings(); return value === null ? null : JSON.parse(JSON.stringify(value));},
        selectIndex(index) {g.menu.index = index; g.raw.g_hdMenuIndex = index;}});
}
function settingsText(movie, speed, enemy) {
    const choice = (value, names) => value === 0 || value === 1 ? names[value] : '未读取';
    return '当前设置：动画 ' + choice(movie, ['不看', '观看']) + ' · 移速 ' + choice(speed, ['快速', '慢速']) +
        ' · 敌军移动 ' + choice(enemy, ['不看', '观看']);
}
function assertSettingsButtons(g, disabled = false) {
    assert.equal(g.skillMenu.hidden, false);
    assert.equal(g.skillTitle.textContent, g.menu.kind === I.SYS ? '战场系统' : '战场设置');
    assert.deepEqual(renderedSkillButtons(g).map(button => [button.index, button.text, button.disabled, button.hint]),
        g.menu.names.map((name, index) => [index, name, disabled, null]));
    assert.equal(Number(/<button\b(?=[^>]*\bis-on\b)[^>]*data-hd-battle-menu="([0-9]+)"/.exec(g.skillList.innerHTML)?.[1]), g.menu.index);
    assert.equal(g.skillNote.hidden, true); assert.equal(g.skillNote.textContent, '');
    assert.deepEqual(g.writes, []);
}

test('native SYSTEM and both SETTINGS lists show all actual setting combinations independently of the highlighted choice', () => {
    for (const [kind, names] of [[I.SYS, systemSettingNames], [I.SETTINGS, lookSettingNames], [I.SETTINGS, speedSettingNames]]) {
        for (let bits = 0; bits < 8; bits++) {
            const g = settingsFixture(kind, names), movie = bits & 1, speed = bits >> 1 & 1, enemy = bits >> 2 & 1;
            Object.assign(g.raw, {g_LookMovie: movie, g_MoveSpeed: speed, g_LookEnemy: enemy});
            g.raw.g_FgtParam.Mode = bits & 1;
            const world = JSON.stringify(g.raw);
            for (let n = 0; n < 3; n++) g.observe();
            assert.deepEqual(g.readSettings(), {movie, moveSpeed: speed, enemy, actor: 255, kind, inputSeq: 41,
                menuSeq: 12, index: 0, names: names.slice()});
            assert.equal(g.settingsNote.hidden, false); assert.equal(g.settingsNote.textContent, settingsText(movie, speed, enemy));
            assertSettingsButtons(g); assert.equal(JSON.stringify(g.raw), world); assert.deepEqual(g.sent, []);
            assert.deepEqual(statusDto(g), {weather: 1, food: 0, day: 3, limit: 20}, 'legacy status DTO remains separate');
            g.selectIndex(names.length - 1); const highlightedWorld = JSON.stringify(g.raw); g.observe();
            assert.equal(g.readSettings().index, names.length - 1);
            assert.equal(g.settingsNote.textContent, settingsText(movie, speed, enemy), 'browsing does not commit a different setting');
            assertSettingsButtons(g); assert.equal(JSON.stringify(g.raw), highlightedWorld); assert.deepEqual(g.sent, []);
        }
    }
});

test('uncertain setting values stay individually unread while unrelated status, enemy-food and drawing hooks are untouched', () => {
    for (const [field, property] of [['g_LookMovie', 'movie'], ['g_MoveSpeed', 'moveSpeed'], ['g_LookEnemy', 'enemy']]) {
        for (const invalid of [null, undefined, -1, 2, 255, '1', NaN, Infinity]) {
            const g = settingsFixture(I.SETTINGS, lookSettingNames); g.raw[field] = invalid;
            const world = JSON.stringify(g.raw); g.observe();
            const value = g.readSettings(); assert.ok(value); assert.equal(value[property], null);
            assert.deepEqual([value.movie, value.moveSpeed, value.enemy],
                [property === 'movie' ? null : 1, property === 'moveSpeed' ? null : 1, property === 'enemy' ? null : 0]);
            assert.equal(g.settingsNote.hidden, false); assert.equal(g.settingsNote.textContent, settingsText(value.movie, value.moveSpeed, value.enemy));
            assertSettingsButtons(g); assert.equal(JSON.stringify(g.raw), world); assert.deepEqual(g.sent, []);
        }
    }
    const g = settingsFixture(); let unrelatedReads = 0, drawingCalls = 0;
    g.baye.hooks.didShowFightStateBar = () => {drawingCalls++; throw Error('settings cannot invoke the status drawing hook');};
    for (const [target, field] of [[g.raw, 'g_FgtWeather'], [g.raw, 'g_FgtBoutCnt'], [g.raw, 'g_FgtBoutMax'],
        [g.raw.g_FgtParam, 'MProvender'], [g.raw.g_FgtParam, 'EProvender'], [g.raw, 'g_EneTmpProv']]) {
        Object.defineProperty(target, field, {get() {unrelatedReads++; throw Error('unrelated battle status is private');}});
    }
    assert.ok(g.readSettings()); g.observe(); assert.equal(g.settingsNote.hidden, false);
    assert.equal(g.settingsNote.textContent, settingsText(1, 1, 0)); assertSettingsButtons(g);
    assert.equal(unrelatedReads, 0); assert.equal(drawingCalls, 0); assert.deepEqual(g.sent, []);
});

test('setting owner, menu and source drift withdraw the note while native buttons and one-shot confirmation keep their contract', () => {
    for (const [kind, names] of [[I.ACT, ['攻击', '计谋', '查看', '待机']], [I.RETREAT, ['全军撤退']]]) {
        const g = settingsFixture(); g.observe(); assert.equal(g.settingsNote.hidden, false);
        g.fight.inputKind = kind; g.mirror(); Object.assign(g.menu, {kind, names, count: names.length});
        Object.assign(g.raw, {g_hdMenuKind: kind, g_hdMenuCount: names.length}); g.observe();
        assert.equal(g.readSettings(), null); assert.equal(g.settingsNote.hidden, true); assert.equal(g.settingsNote.textContent, '');
        assert.deepEqual(renderedSkillButtons(g).map(button => [button.index, button.text, button.disabled]),
            names.map((name, index) => [index, name, false]));
        assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
    }
    const changes = [g => g.identity.sha256 = 'different-library', g => g.raw.g_hdFightInputSeq++,
        g => g.raw.g_hdFightWait = 1, g => g.raw.g_hdFightPhase = 1,
        g => g.fight.wait = 1, g => g.fight.phase = 1, g => g.raw.g_hdMenuSeq++,
        g => g.raw.g_hdMenuIndex = 1, g => g.raw.g_hdMenuActive = 0, g => g.raw.g_hdMenuKind = I.SKILL,
        g => g.raw.g_hdMenuCount = 4, g => g.menu.generation++, g => g.menu.detailGeneration++,
        g => g.menu.names[0] = '自定义', g => g.raw.g_FgtParam.Mode = 2,
        g => g.raw.g_hdHelpActive = 1];
    for (const change of changes) {
        const g = settingsFixture(); g.observe(); assert.ok(g.readSettings());
        change(g); g.observe(); assert.equal(g.readSettings(), null);
        assert.equal(g.settingsNote.hidden, true); assert.equal(g.settingsNote.textContent, '');
        assertSettingsButtons(g); assert.deepEqual(g.sent, []);
    }
    const seed = settingsFixture(); seed.identityHook(null); assert.ok(seed.readSettings()); const last = seed.identityCalls();
    assert.ok(last >= 2);
    for (const change of [g => g.raw.g_LookMovie = 0, g => g.raw.g_hdMenuIndex = 1,
        g => g.identity.generation++, g => g.baye.data = {...g.raw}, g => g.baye.hooks = {},
        g => {const previous = g.baye.hd.menuItems; g.baye.hd.menuItems = () => previous();}]) {
        const g = settingsFixture(); let fired = false;
        g.identityHook(count => {if (count === last) {fired = true; change(g);}});
        assert.equal(g.readSettings(), null); assert.equal(fired, true); assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
    }
    const reentrant = settingsFixture(); let inside = false, reentered = false;
    reentrant.fightHook(() => {if (!inside) {inside = true; reentered = true; try {reentrant.readSettings();} finally {inside = false;}}});
    assert.equal(reentrant.readSettings(), null); reentrant.observe(); assert.equal(reentered, true);
    assert.equal(reentrant.settingsNote.hidden, true); assert.equal(reentrant.settingsNote.textContent, '');
    assertSettingsButtons(reentrant); assert.deepEqual(reentrant.sent, []);
    reentrant.fightHook(null); reentrant.observe(); assert.equal(reentrant.settingsNote.hidden, false);
    assert.equal(reentrant.settingsNote.textContent, settingsText(1, 1, 0)); assertSettingsButtons(reentrant);
    const confirmed = settingsFixture(I.SETTINGS, speedSettingNames); confirmed.observe();
    assert.equal(confirmed.api.pickMenu(0).ok, true); assert.deepEqual(confirmed.sent, [K.ENTER]);
    confirmed.api.pickMenu(0); confirmed.tick(1000); confirmed.observe();
    assert.deepEqual(confirmed.sent, [K.ENTER], 'pending setting confirmation is never retried'); assertSettingsButtons(confirmed, true);
});

// Mount the new PC-only detail surface without changing the original command
// fixture. Native publications remain behind statusFixture's write traps.
function focusFixture({canvas = false} = {}) {
    const g = statusFixture(), mounted = new Map(), listeners = new Map(), paints = [];
    function make(tag = 'div') {
        const attrs = new Map(); let text = '';
        const n = {tagName: tag.toUpperCase(), children: [], hidden: false, className: '',
            setAttribute(k, v) {attrs.set(k, String(v)); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v);},
            getAttribute(k) {return k === 'class' ? this.className : attrs.get(k) ?? null;},
            removeAttribute(k) {attrs.delete(k);},
            appendChild(child) {this.children.push(child); child.parentNode = child.parentElement = this; return child;},
            addEventListener(type, fn) {listeners.set(type, [...listeners.get(type) || [], fn]);},
            querySelectorAll(selector) {
                const match = node => {
                    if (selector.startsWith('.')) return node.className.split(/\s+/).includes(selector.slice(1));
                    const attr = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector);
                    if (attr) return node.getAttribute(attr[1]) !== null && (attr[2] === undefined || node.getAttribute(attr[1]) === attr[2]);
                    return node.tagName.toLowerCase() === selector.toLowerCase();
                };
                const result = []; function walk(node) {for (const child of node.children) {if (match(child)) result.push(child); walk(child);}} walk(this); return result;
            }, querySelector(selector) {return this.querySelectorAll(selector)[0] ?? null;},
            getBoundingClientRect() {return {left: 720, top: 56, width: 260, height: 420, right: 980, bottom: 476};}};
        Object.defineProperty(n, 'textContent', {get() {return text + n.children.map(child => child.textContent).join('');},
            set(value) {text = String(value); n.children = [];}});
        n.classList = {toggle(name, on) {const set = new Set(n.className.split(/\s+/).filter(Boolean)); const active = on ?? !set.has(name); if (active) set.add(name); else set.delete(name); n.className = [...set].join(' '); return active;},
            add(name) {this.toggle(name, true);}, remove(name) {this.toggle(name, false);}, contains(name) {return n.className.split(/\s+/).includes(name);}};
        return n;
    }
    const mount = (id, tag) => {const n = make(tag); n.id = id; mounted.set(id, n); return n;};
    const rootNode = mount('hd-battle'), rail = mount('hd-battle-rail'), card = mount('hd-battle-focus', 'section');
    rootNode.appendChild(rail); rail.appendChild(card); card.hidden = true;
    if (canvas) {
        const board = mount('hd-battle-canvas', 'canvas'); rootNode.appendChild(board);
        board.getBoundingClientRect = () => ({left: 0, top: 0, width: 1000, height: 562.5, right: 1000, bottom: 562.5});
        const ctx = new Proxy({measureText: value => ({width: String(value).length * 7}),
            fillRect(...args) {paints.push(['fillRect', ...args]);}, strokeRect(...args) {paints.push(['strokeRect', ...args]);}},
            {get(target, key) {return key in target ? target[key] : () => {};}});
        board.getContext = () => ctx;
    }
    const previous = g.sandbox.document.getElementById;
    g.sandbox.document.getElementById = id => mounted.get(id) || previous(id);
    g.sandbox.document.createElement = make;
    g.baye.getArmType = id => id === 0 ? 2 : 3;
    Object.assign(g.raw.g_GenPos[0], {hp: 65535, mp: 0}); g.raw.g_Persons[0].Arms = 0;
    g.api.start();
    return Object.assign(g, {card, rail, rootNode, mounted, paints,
        fields() {return Object.fromEntries(card.querySelectorAll('[data-hd-focus-field]').map(row => [row.getAttribute('data-hd-focus-field'), row.querySelector('dd')?.textContent]));},
        click(target, coordinates = {}) {const event = {target, preventDefault() {}, ...coordinates}; for (const fn of listeners.get('click') || []) fn(event);},
        name() {return card.querySelector('.hd-battle-focus-name')?.textContent;},
        identityText() {return card.querySelector('.hd-battle-focus-identity')?.textContent;}});
}
function assertFocusHidden(g, message) {
    assert.equal(g.card.hidden, true, message); assert.equal(g.card.textContent, '', message);
    assert.deepEqual(g.sent, [], message); assert.deepEqual(g.writes, [], message);
}

test('PC focus card preserves exact name, allegiance, native U16 values, zero and current state in separate text rows', () => {
    const g = focusFixture(); const special = '朵思<大王>&"'; g.baye.getPersonName = id => id === 0 ? special : '敌方长姓名';
    const before = JSON.stringify(g.raw); g.observe(); assert.equal(g.card.hidden, false); assert.equal(g.name(), special);
    assert.match(g.identityText(), /我方|己方/); assert.match(g.identityText(), /弓兵/); assert.match(g.identityText(), /1\s*[,，]\s*1/);
    const fields = g.fields(); assert.deepEqual(Object.keys(fields).sort(), ['action', 'arms', 'hp', 'mp', 'state', 'terrain']);
    assert.equal(fields.arms, '0'); assert.equal(fields.hp, '65535'); assert.equal(fields.mp, '0');
    assert.match(fields.state, /正常/); assert.match(fields.action, /未行动/);
    assert.match(fields.terrain, /未知地形/);
    assert.equal(g.card.querySelectorAll('button').length, 0); assert.equal(g.card.querySelectorAll('input').length, 0);
    assert.equal(JSON.stringify(g.raw), before); assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
});

test('PC focus card follows the real focused enemy and keeps state separate from action and unavailable values', () => {
    const g = focusFixture(); g.observe(); const oldName = g.name();
    g.focus(5, 3); Object.assign(g.raw.g_GenPos[10], {hp: 0, mp: 65535, active: 0, state: 2}); g.observe();
    assert.notEqual(g.name(), oldName); assert.match(g.identityText(), /敌方/); assert.match(g.identityText(), /水军/);
    assert.equal(g.fields().hp, '0'); assert.equal(g.fields().mp, '65535'); assert.match(g.fields().state, /禁咒/);
    assert.doesNotMatch(g.fields().action, /已行动/);
    g.raw.g_GenPos[10].active = 1; g.observe(); assert.match(g.fields().action, /已行动/); assert.match(g.fields().state, /禁咒/);
    g.raw.g_GenPos[10].hp = null; g.raw.g_GenPos[10].mp = undefined; g.raw.g_Persons[2].Arms = null;
    g.raw.g_GenPos[10].active = 255; g.raw.g_GenPos[10].state = 255; g.observe();
    for (const key of ['hp', 'mp', 'arms', 'action', 'state']) assert.match(g.fields()[key], /未读取|未知/, key);
    assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
});

test('PC focus details retire for empty or dead focus, higher owners, hidden/classic/LCD presentation and battle closure', () => {
    const changes = [g => g.focus(3, 4), g => g.raw.g_GenPos[0].state = 8,
        g => g.raw.g_hdReportActive = 1, g => {g.input(I.HELP); g.mirror();}, g => {g.input(I.VIEW); g.mirror();},
        g => g.sandbox.document.hidden = true, g => g.api.setShowLcd(true),
        g => g.sandbox.localStorage.setItem('baye/battleMode', 'classic'), g => g.api.close({force: true}),
        g => g.baye.hd.ready = () => false, g => g.fight.active = 0, g => g.fight.over = 1];
    for (const change of changes) {
        const g = focusFixture(); g.observe(); assert.equal(g.card.hidden, false); change(g); g.observe();
        assertFocusHidden(g, 'old focused identity cannot remain after its owner or presentation ends');
    }
    const g = focusFixture(); g.observe(); g.focus(3, 4); g.observe(); assertFocusHidden(g);
    g.focus(1, 1); g.observe(); assert.equal(g.card.hidden, false); assert.equal(g.fields().mp, '0');
});

test('unchanged focus observations retain detail nodes and idle rendering never submits a native selection', () => {
    const g = focusFixture(); g.observe(); const nodes = g.card.children.slice(), rows = g.card.querySelectorAll('[data-hd-focus-field]');
    const before = JSON.stringify(g.raw);
    for (let i = 0; i < 8; i++) {g.observe(); g.poll();}
    assert.equal(g.card.hidden, false); assert.equal(g.card.children.length, nodes.length);
    nodes.forEach((node, i) => assert.equal(g.card.children[i], node));
    rows.forEach((node, i) => assert.equal(g.card.querySelectorAll('[data-hd-focus-field]')[i], node));
    assert.equal(JSON.stringify(g.raw), before); assert.deepEqual(g.sent, []); assert.deepEqual(g.writes, []);
});

test('PC sidebar reserves map pixels and canvas selection uses the same rendered tile geometry', () => {
    const g = focusFixture({canvas: true}); g.observe();
    const cell = g.paints.find(p => p[0] === 'fillRect' && p[1] === 80 && p[2] === 72 && p[3] < 500);
    assert.ok(cell, 'real production map paints its first cell');
    const [, ox, oy, paintWidth, paintHeight] = cell, cw = paintWidth - 0.5, ch = paintHeight - 0.5;
    assert.ok((ox + cw * 8) * 1000 / 1920 < 720, 'right sidebar never covers the painted board');
    const board = g.mounted.get('hd-battle-canvas'); const x = (ox + cw * 4.5) * 1000 / 1920, y = (oy + ch * 2.5) * 562.5 / 1080;
    assert.deepEqual(g.sent, []); g.click(g.card, {clientX: 800, clientY: 100}); assert.deepEqual(g.sent, [], 'detail surface is not a map click');
    g.click(board, {clientX: x, clientY: y});
    assert.deepEqual(g.sent, [K.RIGHT]); const request = g.api.debugSnapshot().transaction;
    assert.equal(request?.type, 'tile'); assert.deepEqual([request.x, request.y], [4, 2]);
    assert.deepEqual(g.writes, []); // The one user request only dispatched its first arrow; no confirmation yet.
});
