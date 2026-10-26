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
