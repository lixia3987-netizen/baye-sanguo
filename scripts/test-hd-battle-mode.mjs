/**
 * Run with: node scripts/test-hd-battle-mode.mjs
 * Executes the complete browser battle module and the real C menu function.
 * Browser drawing and scheduling are mocked; this does not replace a full game test.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(root, 'js/hd-battle.js');
const battleSource = readFileSync(scriptPath, 'utf8');
const battleStorageKey = 'baye/battleMode';
const runFile = promisify(execFile);

function engine(hooks = {}) {
    const fight = { active: 0, over: 0, wait: 0, phase: 0 };
    return {
        hooks,
        data: {
            g_PlayerKing: 1,
            g_YearDate: 190,
            g_FgtOver: 0,
            g_hdFightActive: 0,
            g_hdFightMenuControl: 0,
            g_hdFightAllowRetreat: 0
        },
        hd: { ready: () => true, fight: () => fight },
        hdEngineReady: () => true,
        fight
    };
}

function browser({ baye = engine(), storage = {}, overworld } = {}) {
    const saved = new Map(Object.entries(storage));
    const intervals = new Map();
    const timeouts = new Map();
    let nextTimer = 1;
    const document = {
        currentScript: { src: '/js/hd-battle.js' },
        getElementsByTagName: () => [],
        getElementById: () => null,
        documentElement: { setAttribute() {} },
        body: { classList: { toggle() {}, remove() {} } }
    };
    const sandbox = {
        document,
        console: { log() {}, warn() {}, error() {} },
        localStorage: {
            getItem: key => saved.get(key) ?? null,
            setItem: (key, value) => saved.set(key, String(value))
        },
        setInterval: callback => {
            const id = nextTimer++;
            intervals.set(id, callback);
            return id;
        },
        clearInterval: id => intervals.delete(id),
        setTimeout: (callback, ms) => {
            const id = nextTimer++;
            timeouts.set(id, { callback, ms });
            return id;
        },
        clearTimeout: id => timeouts.delete(id),
        requestAnimationFrame: () => nextTimer++,
        cancelAnimationFrame() {},
        addEventListener() {},
        removeEventListener() {},
        devicePixelRatio: 1
    };
    if (baye) sandbox.baye = baye;
    if (overworld) sandbox.BayeHdOverworld = overworld;
    sandbox.window = sandbox;
    vm.runInNewContext(battleSource, sandbox, { filename: scriptPath, timeout: 5000 });
    return {
        window: sandbox,
        api: sandbox.BayeHdBattle,
        saved,
        intervalCount: () => intervals.size,
        capturedTimeouts: ms => [...timeouts.values()]
            .filter(timer => ms === undefined || timer.ms === ms)
            .map(timer => timer.callback),
        poll() {
            // Run only interval callbacks; drawing/command timers stay queued.
            for (const callback of [...intervals.values()]) callback();
        }
    };
}

test('default classic startup preserves native menu and retreat flags', () => {
    const baye = engine();
    const app = browser({ baye });
    assert.equal(app.api.shouldShowHd(), false);
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
    app.api.start();
    app.api.start();
    assert.equal(app.intervalCount(), 1);
    app.api.syncMode();
    app.poll();
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
    assert.equal(baye.data.g_hdFightAllowRetreat, 0);
});

test('classic startup leaves an existing mod hook intact', () => {
    function modMenu() { return 4; }
    const baye = engine({ fightOpenMainMenu: modMenu });
    const app = browser({ baye, storage: { [battleStorageKey]: 'classic' } });
    app.api.start();
    app.api.syncMode();
    assert.equal(baye.hooks.fightOpenMainMenu, modMenu);
    assert.equal(baye.hooks.fightOpenMainMenu(), 4);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
});

test('HD installs once, delegates to the previous mod hook, and restores it', () => {
    const receiver = { caller: 'engine' };
    const args = [7, 'menu-context'];
    const calls = [];
    function modMenu(...received) {
        calls.push({ receiver: this, args: received });
        return 3;
    }
    const baye = engine({ fightOpenMainMenu: modMenu });
    const app = browser({ baye });
    app.api.start();
    app.api.setMode('hd');
    const installed = baye.hooks.fightOpenMainMenu;
    assert.equal(typeof installed, 'function');
    assert.notEqual(installed, modMenu);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
    for (let i = 0; i < 5; i += 1) app.api.syncMode();
    assert.equal(baye.hooks.fightOpenMainMenu, installed);
    assert.equal(installed.apply(receiver, args), 3);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].receiver, receiver);
    assert.deepEqual(calls[0].args, args);

    baye.data.g_hdFightAllowRetreat = 1;
    app.api.setMode('classic');
    assert.equal(baye.hooks.fightOpenMainMenu, modMenu);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
    assert.equal(baye.data.g_hdFightAllowRetreat, 0);

    // A module may have retained the old wrapper. Classic mode must still delegate.
    baye.fight.active = 1;
    assert.equal(installed.apply(receiver, args), 3);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].receiver, receiver);
    assert.deepEqual(calls[1].args, args);
    assert.equal(baye.data.g_FgtOver, 0);
});

test('late HD wrapper calls in classic return the native-menu sentinel', () => {
    const baye = engine();
    const app = browser({ baye });
    app.api.setMode('hd');
    const installed = baye.hooks.fightOpenMainMenu;
    app.api.setMode('classic');
    baye.fight.active = 1;
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
    assert.equal(installed(), -2);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
    assert.equal(baye.data.g_FgtOver, 0);
    app.api.setMode('hd');
    assert.equal(typeof baye.hooks.fightOpenMainMenu, 'function');
    app.api.setMode('classic');
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
});

test('auto follows current overworld mode and explicit classic overrides it', () => {
    let worldMode = 'classic';
    const baye = engine();
    const app = browser({ baye, overworld: { getMode: () => worldMode } });
    app.api.start();
    assert.equal(app.api.getMode(), 'auto');
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
    worldMode = 'hd-map';
    app.api.syncMode();
    assert.equal(app.api.shouldShowHd(), true);
    const installed = baye.hooks.fightOpenMainMenu;
    assert.equal(typeof installed, 'function');
    assert.equal(baye.data.g_hdFightMenuControl, 0);
    app.api.syncMode();
    assert.equal(baye.hooks.fightOpenMainMenu, installed);
    worldMode = 'classic';
    app.api.syncMode();
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
    app.api.setMode('classic');
    worldMode = 'hd-map';
    app.api.syncMode();
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
    app.api.setMode('auto');
    assert.equal(typeof baye.hooks.fightOpenMainMenu, 'function');
});

test('auto uses the stored overworld preference before the overworld module loads', () => {
    const baye = engine();
    const app = browser({ baye, storage: { 'baye/overworldMode': 'hd-map' } });
    app.api.start();
    assert.equal(typeof baye.hooks.fightOpenMainMenu, 'function');
    app.saved.set('baye/overworldMode', 'classic');
    app.api.syncMode();
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
});

test('HD removal does not overwrite a newer hook from another module', () => {
    function original() { return 2; }
    function replacement() { return 4; }
    const baye = engine({ fightOpenMainMenu: original });
    const app = browser({ baye });
    app.api.setMode('hd');
    baye.hooks.fightOpenMainMenu = replacement;
    app.api.setMode('classic');
    app.api.syncMode();
    assert.equal(baye.hooks.fightOpenMainMenu, replacement);
    assert.equal(baye.hooks.fightOpenMainMenu(), 4);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
});

test('missing engine can start and late engine is picked up by startup polling', () => {
    const app = browser({ baye: null, storage: { [battleStorageKey]: 'hd' } });
    app.api.start();
    app.api.syncMode();
    const baye = engine();
    app.window.baye = baye;
    app.poll();
    assert.equal(typeof baye.hooks.fightOpenMainMenu, 'function');
    assert.equal(baye.data.g_hdFightMenuControl, 0);
    app.api.setMode('classic');
    assert.equal(baye.hooks.fightOpenMainMenu, undefined);
    assert.equal(baye.data.g_hdFightMenuControl, 0);
});

test('HD system hook waits for a real native choice instead of ending a turn', () => {
    const baye = engine();
    const sent = [];
    baye.sendKey = key => sent.push(key);
    const app = browser({ baye });
    app.api.setMode('hd');
    baye.fight.active = 1;
    const before = { ...baye.data };
    assert.equal(baye.hooks.fightOpenMainMenu(), -2);
    assert.equal(baye.hooks.fightOpenMainMenu(), -2);
    assert.deepEqual(baye.data, before);
    assert.deepEqual(sent, []);
});

test('classic engine callbacks preserve active menu and battle state', () => {
    const baye = engine();
    baye.fight.active = 1;
    baye.fight.over = 2;
    baye.data.g_FgtOver = 2;
    baye.data.g_hdFightOver = 2;
    baye.data.g_hdMenuCount = 3;
    baye.data.g_hdFightWait = 1;
    baye.data.g_hdFightPhase = 2;
    const sent = [];
    baye.sendKey = key => sent.push(key);
    const app = browser({ baye });
    const before = { ...baye.data };
    app.api.start();
    app.api.onEngineFight();
    for (const hook of ['fightOpenMainMenu', 'enterBattle', 'exitBattle', 'onMenuIdle']) {
        app.api.onEngineHook(hook);
    }
    app.poll();
    assert.deepEqual(baye.data, before);
    assert.deepEqual(sent, []);
    assert.equal(app.api.isOpen(), false);
});

test('switching an active HD scene to classic preserves the native menu and battle', () => {
    const baye = engine();
    baye.fight.active = 1;
    baye.data.g_hdMenuCount = 3;
    baye.data.g_hdFightWait = 1;
    baye.data.g_hdFightPhase = 2;
    const app = browser({ baye });
    app.api.setMode('hd');
    app.api.enter({ hook: 'enterBattle' });
    assert.equal(app.api.isOpen(), true);
    const before = {
        menuCount: baye.data.g_hdMenuCount,
        wait: baye.data.g_hdFightWait,
        phase: baye.data.g_hdFightPhase,
        over: baye.data.g_FgtOver
    };
    app.api.setMode('classic');
    assert.equal(app.api.isOpen(), false);
    assert.deepEqual({
        menuCount: baye.data.g_hdMenuCount,
        wait: baye.data.g_hdFightWait,
        phase: baye.data.g_hdFightPhase,
        over: baye.data.g_FgtOver
    }, before);
    assert.equal(baye.fight.active, 1);
});

test('finished battle notifications never drain reports or alter native results', () => {
    const baye = engine();
    baye.fight.over = 2;
    baye.data.g_FgtOver = 2;
    baye.data.g_hdMenuCount = 3;
    const sent = [];
    baye.sendKey = key => sent.push(key);
    const app = browser({ baye });
    app.api.setMode('hd');
    const before = { ...baye.data };
    app.api.start();
    for (let i = 0; i < 5; i++) {
        app.api.onEngineFight();
        app.poll();
        for (const callback of app.capturedTimeouts()) callback();
    }
    assert.deepEqual(sent, [], 'results and prisoners require real player input');
    assert.deepEqual(baye.data, before);
    assert.equal(app.api.isOpen(), false, 'real result reports remain accessible');
    assert.equal(app.api.forceWin, undefined, 'there is no API to change the outcome');
});

test('preparing the next HD scene leaves native battle and menu state untouched', () => {
    const baye = engine();
    baye.fight.active = 1;
    Object.assign(baye.data, { g_FgtOver: 0, g_hdFightActive: 1, g_hdFightWait: 1,
        g_hdFightPhase: 2, g_hdMenuCount: 4, g_hdFightActCommit: 255 });
    const app = browser({ baye });
    app.api.setMode('hd');
    const before = { ...baye.data };
    app.api.prepareNewFight();
    assert.deepEqual(baye.data, before);
    assert.equal(baye.fight.active, 1);
});

test('idle HD polling never selects actions from leftover menu bytes', () => {
    const baye = engine();
    baye.fight.active = 1;
    baye.fight.wait = 1;
    baye.fight.phase = 1;
    baye.data.g_hdMenuCount = 5;
    const sent = [];
    baye.sendKey = key => sent.push(key);
    const app = browser({ baye });
    app.api.setMode('hd');
    app.api.start();
    const before = { ...baye.data };
    for (let i = 0; i < 20; i++) {
        app.poll();
        for (const callback of app.capturedTimeouts()) callback();
    }
    assert.deepEqual(sent, []);
    assert.deepEqual(baye.data, before);
});

test('real C FgtMainMenu preserves classic options and gates only HD hook retreat', async () => {
    const source = readFileSync(join(root, 'vendor/iBaye/src/FightSub.c'), 'utf8');
    const start = source.indexOf('FAR U8 FgtMainMenu(void)');
    assert.notEqual(start, -1, 'real menu function must exist');
    const end = source.indexOf('\n}', start);
    assert.notEqual(end, -1, 'real menu function must end');
    const realMenuFunction = source.slice(start, end + 2);
    const bridge = readFileSync(join(root, 'vendor/iBaye/src/hd-bridge.c'), 'utf8');
    const declaration = bridge.match(/^U8\s+g_hdFightMenuControl\s*=\s*[^;]+;/m);
    assert.ok(declaration, 'HD ownership flag must be defined by the bridge');
    const header = readFileSync(join(root, 'vendor/iBaye/src/hd-bridge.h'), 'utf8');
    const sentinel = header.match(/^#define\s+BAYE_HD_MENU_NATIVE\s+[^\n]+/m);
    assert.ok(sentinel, 'native-menu fallback must be declared by the bridge');
    const inputDefinitions = header.split('\n').filter(line =>
        /^#define\s+BAYE_HD_(MENU_CONTEXT_|FIGHT_INPUT_)/.test(line)).join('\n');
    const harness = String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;
typedef struct { int sx, ex, sy, ey; } RECT;
#define FAR
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define HZ_WID 6
#define HZ_HGT 12
#define MNU_EXIT 0xff
#define FGT_LOSE 2
#define dFgtSysMnu 1
#define dFgtLookMnu 2
#define dFgtMoveSpe 3
#define IF_HAS_HOOK(name) if (hasHook)
#define CALL_HOOK_A() callHook()
` + declaration[0] + '\n' + sentinel[0] + '\n' + inputDefinitions + String.raw`
static U8 g_hdFightAllowRetreat, g_FgtOver, g_LookMovie, g_MoveSpeed, g_LookEnemy;
static U8 *g_VisScr;
static int hasHook, hookCalls, menuCalls, frameCalls, blockedCalls, hookOwnsControl;
static int hookValues[16], hookCount, menuValues[16], menuCount;
static int callHook(void) {
    assert(hookCalls < hookCount);
    if (hookOwnsControl) g_hdFightMenuControl = 1;
    return hookValues[hookCalls++];
}
static int PlcSplMenu(RECT *rect, U8 index, U8 *text) {
    (void)rect; (void)index; (void)text;
    assert(menuCalls < menuCount);
    return menuValues[menuCalls++];
}
static void FgtLoadToMem2(U8 resource, U8 *buf) {
    (void)resource; buf[0] = 0;
}
static void GamShowFrame(U8 *screen) { (void)screen; ++frameCalls; }
static void baye_hd_note_retreat_blocked(void) { ++blockedCalls; }
/* Input lifecycle is exercised by test-hd-engine-protocol.mjs. This harness
 * keeps its focus on the real native/Mod menu choices and confirmation. */
static void baye_hd_menu_scope(U8 context, U8 kind) { (void)context; (void)kind; }
static void baye_hd_fight_input_begin(U8 kind) { (void)kind; }
static void baye_hd_fight_input_end(void) {}
` + realMenuFunction + String.raw`

static void reset(void) {
    g_hdFightMenuControl = g_hdFightAllowRetreat = g_FgtOver = 0;
    g_LookMovie = g_MoveSpeed = g_LookEnemy = 0;
    hasHook = hookCalls = menuCalls = frameCalls = blockedCalls = 0;
    hookOwnsControl = 0;
    hookCount = menuCount = 0;
    memset(hookValues, 0, sizeof(hookValues));
    memset(menuValues, 0, sizeof(menuValues));
}
static void menus(const int *values, int count) {
    memcpy(menuValues, values, sizeof(int) * count); menuCount = count;
}
static void hooks(const int *values, int count) {
    memcpy(hookValues, values, sizeof(int) * count); hookCount = count; hasHook = 1;
}
int main(void) {
    /* Compile the actual bridge initializer as well as the actual menu function. */
    assert(g_hdFightMenuControl == 0);

    reset();
    { int choices[] = {1, 0}; menus(choices, 2); }
    assert(FgtMainMenu() == 0xff);
    assert(g_FgtOver == FGT_LOSE && menuCalls == 2 && blockedCalls == 0);

    reset();
    { int choices[] = {1, MNU_EXIT, MNU_EXIT}; menus(choices, 3); }
    assert(FgtMainMenu() == 1);
    assert(g_FgtOver == 0 && menuCalls == 3 && blockedCalls == 0);

    reset();
    { int choices[] = {1}; hooks(choices, 1); }
    assert(FgtMainMenu() == 0xff);
    assert(g_FgtOver == FGT_LOSE && menuCalls == 0 && blockedCalls == 0);

    /* Stale ownership from a replaced HD hook must not restrict the new mod. */
    reset(); g_hdFightMenuControl = 1;
    { int choices[] = {1}; hooks(choices, 1); }
    assert(FgtMainMenu() == 0xff);
    assert(g_FgtOver == FGT_LOSE && g_hdFightMenuControl == 0 && blockedCalls == 0);

    reset(); g_hdFightMenuControl = 1;
    { int choices[] = {1, 0}; menus(choices, 2); }
    assert(FgtMainMenu() == 0xff);
    assert(g_FgtOver == FGT_LOSE && menuCalls == 2 && blockedCalls == 0);

    reset(); hookOwnsControl = 1;
    { int choices[] = {1}; hooks(choices, 1); }
    assert(FgtMainMenu() == 0xff);
    assert(g_FgtOver == 0 && blockedCalls == 1 && menuCalls == 0);

    reset(); hookOwnsControl = g_hdFightAllowRetreat = 1;
    { int choices[] = {1}; hooks(choices, 1); }
    assert(FgtMainMenu() == 0xff);
    assert(g_FgtOver == FGT_LOSE && g_hdFightAllowRetreat == 0 && blockedCalls == 0);

    /* A stale wrapper asks C to open the native menu, including its confirmation. */
    reset(); hookOwnsControl = 1;
    { int hookChoices[] = {-2}; int choices[] = {1, 0};
      hooks(hookChoices, 1); menus(choices, 2); }
    assert(FgtMainMenu() == 0xff);
    assert(g_FgtOver == FGT_LOSE && menuCalls == 2 && blockedCalls == 0);

    reset(); hookOwnsControl = 1;
    { int hookChoices[] = {-2, -2}; int choices[] = {1, MNU_EXIT, MNU_EXIT};
      hooks(hookChoices, 2); menus(choices, 3); }
    assert(FgtMainMenu() == 1);
    assert(g_FgtOver == 0 && menuCalls == 3 && hookCalls == 2 && blockedCalls == 0);

    reset();
    { int choices[] = {0}; menus(choices, 1); }
    assert(FgtMainMenu() == 0xff && g_FgtOver == 0);

    reset();
    { int choices[] = {2, 1, 3, 2, 4, 1, MNU_EXIT}; menus(choices, 7); }
    assert(FgtMainMenu() == 1);
    assert(g_LookMovie == 1 && g_MoveSpeed == 2 && g_LookEnemy == 1);
    assert(g_FgtOver == 0 && blockedCalls == 0 && menuCalls == 7);

    reset();
    { int choices[] = {2, MNU_EXIT, MNU_EXIT}; menus(choices, 3); }
    assert(FgtMainMenu() == 1 && g_LookMovie == 0);

    reset(); hookOwnsControl = 1;
    { int choices[] = {2, 3, 4, MNU_EXIT}; int settings[] = {1, 2, 1};
      hooks(choices, 4); menus(settings, 3); }
    assert(FgtMainMenu() == 1);
    assert(g_LookMovie == 1 && g_MoveSpeed == 2 && g_LookEnemy == 1);
    assert(g_FgtOver == 0 && blockedCalls == 0);
    puts("C battle menu: 13 behavioral cases passed");
    return 0;
}
`;
    const temporary = mkdtempSync(join(tmpdir(), 'baye-battle-menu-'));
    try {
        const filename = join(temporary, 'menu.c');
        const executable = join(temporary, 'menu');
        writeFileSync(filename, harness);
        await runFile(process.env.CC || 'cc', ['-std=c99', '-Wall', '-Wextra', filename, '-o', executable], {
            encoding: 'utf8', timeout: 10000
        });
        const result = await runFile(executable, [], { encoding: 'utf8', timeout: 10000 });
        assert.match(result.stdout, /13 behavioral cases passed/);
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});
