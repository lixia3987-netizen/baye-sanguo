import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
function harness({ move = true, open = true, cachedCity = 0 } = {}) {
    let clock = 0, timerId = 0, engineWrite = false, afterKey;
    const timers = new Map(), sent = [], opened = [], forbiddenWrites = [];
    const menu = { active: 0, context: 0, kind: 0, seq: 1, index: 0,
        names: ['内政', '外交', '军备', '状况'] };
    const march = { pick: 1, battlePick: 0, mapInputSeq: 1, mapCity: cachedCity + 1 };
    const pos = new Proxy({ setx: 1, sety: 0, x: 0, y: 0 }, {
        set(target, key, value) {
            if (!engineWrite) forbiddenWrites.push(`cityPos.${key}`);
            target[key] = value; return true;
        }
    });
    const data = { g_PlayerKing: 0, g_CityPos: pos, g_Cities: Array.from({ length: 9 }, () => ({ Belong: 1 })) };
    Object.defineProperty(data, 'g_hdMapCity', { get: () => march.mapCity,
        set(value) { if (!engineWrite) forbiddenWrites.push('mapCity'); march.mapCity = value; } });
    Object.defineProperty(data, 'g_hdMapPick', { get: () => march.pick,
        set(value) { if (!engineWrite) forbiddenWrites.push('mapPick'); march.pick = value; } });
    const context = vm.createContext({ console: { log() {}, warn() {} },
        addEventListener() {},
        document: { documentElement: { setAttribute() {} }, body: { classList: { toggle() {} } } },
        localStorage: { getItem() { return 'hd-map'; }, setItem() {} },
        Date: class extends Date { static now() { return clock; } },
        setTimeout(fn, delay = 0) { const id = ++timerId; timers.set(id, { fn, at: clock + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        baye: { data, ensureData: () => data, hdCityLimit: () => 9,
            hd: { ready: () => true, menuItems: () => menu, march: () => march,
                fight: () => ({ active: 0, over: 0 }), reportText: () => '' } },
        BayeHdCityMenu: { shouldShowHd: () => true, isOpen: () => opened.length > 0,
            isMarching: () => false, holdMenu: () => false, holdExit: () => false,
            engineInGetCitySet: () => false, close() {}, onEngineHook() {},
            open(meta) { opened.push({ ...meta }); return true; } },
        sendKey(key) {
            sent.push(key); engineWrite = true;
            if (move && march.pick) {
                if (key === VK.UP) pos.sety--;
                if (key === VK.DOWN) pos.sety++;
                if (key === VK.LEFT) pos.setx--;
                if (key === VK.RIGHT) pos.setx++;
                if ([VK.UP, VK.DOWN, VK.LEFT, VK.RIGHT].includes(key)) {
                    march.mapCity = pos.setx === 3 && pos.sety === 2 ? 9 : 1;
                }
            }
            if (open && key === VK.ENTER) {
                march.pick = 0;
                Object.assign(menu, { active: 1, context: 1, kind: 1, seq: menu.seq + 1 });
            }
            afterKey?.(key); engineWrite = false;
        }
    });
    context.window = context;
    let source = readFileSync(new URL('../js/hd-overworld.js', import.meta.url), 'utf8');
    source = source.replace(/\}\)\(window\);\s*$/, `
        global.__entry = { state: state, hook: onHook, confirm: confirmClassicMenu };
        applyChrome = function () {};
    })(window);`);
    vm.runInContext(source, context, { filename: 'js/hd-overworld.js' });
    Object.assign(context.__entry.state, { mode: 'hd-map', phase: 'map',
        cities: Array.from({ length: 9 }, (_, index) => ({ index, name: index === 8 ? '天水' : '西凉',
            kind: 'owned', engX: index === 8 ? 3 : 1, engY: index === 8 ? 2 : 0 })) });
    return { context, state: context.__entry.state, api: context.BayeHdOverworld,
        march, menu, pos, sent, opened, forbiddenWrites,
        afterKey(fn) { afterKey = fn; },
        hook(name) { context.__entry.hook(name, {}); },
        tick(ms = 15000) {
            const end = clock + ms; let runs = 0;
            while (timers.size) {
                const [id, item] = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                if (item.at > end) break;
                assert.ok(++runs < 1000); timers.delete(id); clock = item.at; item.fn();
            }
            clock = end;
        }
    };
}
let count = 0;
function test(name, run) { run(); console.log(`ok ${++count} - ${name}`); }

test('owned city entry walks the real cursor and cached native city before confirming', () => {
    const h = harness(); h.api.walkToCity(8);
    assert.equal(h.opened.length, 0);
    h.tick();
    assert.deepEqual(h.sent, [VK.DOWN, VK.DOWN, VK.RIGHT, VK.RIGHT, VK.ENTER]);
    assert.equal(h.opened.length, 1); assert.equal(h.opened[0].cityIndex, 8);
    assert.equal(h.march.mapCity, 9); assert.equal(h.state.alignLog.method, 'native-city-entry');
    assert.deepEqual(h.forbiddenWrites, []);
});
test('stalled native movement does not retry a key, snap flags, Enter or open a fake city shell', () => {
    const h = harness({ move: false }); h.api.walkToCity(8); h.tick();
    assert.deepEqual(h.sent, [VK.DOWN]); assert.equal(h.opened.length, 0);
    assert.equal(h.state.alignLog.ok, false); assert.deepEqual(h.forbiddenWrites, []);
});
test('retained root menu text cannot acknowledge entry before active native city context', () => {
    const h = harness({ open: false }); h.api.walkToCity(8);
    h.hook('onMenuIdle'); assert.equal(h.opened.length, 0);
    h.tick(600); h.hook('onMenuIdle'); assert.equal(h.opened.length, 0);
    assert.equal(h.sent.filter(key => key === VK.ENTER).length, 1);
    Object.assign(h.menu, { active: 1, context: 3, kind: 1 });
    h.hook('onMenuIdle'); assert.equal(h.opened.length, 0);
    h.tick(); assert.equal(h.opened.length, 0);
});
test('an opened wrong city is rejected rather than labelled with the requested target', () => {
    const h = harness(); h.afterKey(key => { if (key === VK.ENTER) h.march.mapCity = 1; });
    h.api.walkToCity(8); h.tick();
    assert.equal(h.opened.length, 0); assert.equal(h.state.alignLog.ok, false);
    assert.equal(h.sent.filter(key => key === VK.ENTER).length, 1);
});
test('changed map input sequence cancels pending entry without another direction or Enter', () => {
    const h = harness(); h.api.walkToCity(8); h.tick(170);
    const before = h.sent.length; h.march.mapInputSeq++; h.tick();
    assert.equal(h.sent.length, before); assert.equal(h.opened.length, 0);
});
test('a real root menu uses the actual native city rather than an old selected target', () => {
    const h = harness(); h.state.selectedIndex = 8;
    Object.assign(h.menu, { active: 1, context: 1, kind: 1 }); h.march.pick = 0;
    h.hook('onMenuIdle'); assert.equal(h.opened[0].cityIndex, 0);
    assert.equal(h.state.selectedIndex, 0);
});
test('leaving old menus exits each native menu sequence once before real map navigation', () => {
    const h = harness(); h.march.pick = 0;
    Object.assign(h.menu, { active: 1, context: 1, kind: 2, seq: 10 });
    h.api.walkToCity(8); h.tick(500); assert.deepEqual(h.sent, [VK.EXIT]);
    Object.assign(h.menu, { kind: 1, seq: 11 }); h.tick(200);
    assert.deepEqual(h.sent, [VK.EXIT, VK.EXIT]);
    h.menu.active = 0; h.march.pick = 1; h.march.mapInputSeq = 2;
    h.tick(); assert.equal(h.opened[0].cityIndex, 8); assert.deepEqual(h.forbiddenWrites, []);
});
test('cancelled entry callbacks cannot revive after a later map request', () => {
    const h = harness(); h.api.walkToCity(8); h.tick(170); h.api.cancelAlign();
    const before = h.sent.length; h.tick();
    assert.equal(h.sent.length, before); assert.equal(h.opened.length, 0);
});

console.log(`${count} HD city entry regression cases passed.`);
