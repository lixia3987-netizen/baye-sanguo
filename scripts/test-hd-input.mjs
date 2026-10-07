import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the real overlay listeners with a small DOM/event loop, including
// overlapping quantity shells and the classic document.onkeydown handler.
function node(tagName = 'DIV') {
    const attrs = new Map();
    const listeners = new Map();
    return {
        tagName, attrs, listeners, style: {}, parentElement: null,
        classList: { toggle() {}, add() {}, remove() {} },
        setAttribute(k, v) { attrs.set(k, String(v)); },
        getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(fn);
        },
        querySelectorAll() { return []; }
    };
}

function harness({ overlay = true, dialog = true, value = 1050, min = 0, max = 1070, deferQtyClose = false } = {}) {
    const nodes = { 'hd-city-menu': node(), 'hd-dialog': node() };
    const listeners = [];
    const document = {
        body: node('BODY'), documentElement: node('HTML'),
        getElementById(id) { return nodes[id] || null; },
        addEventListener(type, fn, capture = false) {
            if (type === 'keydown') listeners.push({ fn, capture });
        },
        createElement: node
    };
    let clock = 0, nextTimer = 0;
    const timers = new Map();
    const sent = [];
    const qty = { active: 1, value, min, max };
    // This is the C engine's documented cursor/step contract, not the JS
    // implementation: LEFT multiplies num, RIGHT divides, UP/DOWN apply num.
    const maxbit = String(max).length - 1;
    let bit = maxbit, num = 1;
    function engineSendKey(key) {
        sent.push(key);
        if (!qty.active) return;
        if (key === 0x24 && bit) { bit--; num *= 10; }
        if (key === 0x25 && bit < maxbit) { bit++; num /= 10; }
        if (key === 0x22 && qty.value + num <= qty.max) qty.value += num;
        if (key === 0x23 && qty.value - num >= qty.min) qty.value -= num;
        if (key >= 0x40 && key <= 0x49) {
            const pow10 = 10 ** bit;
            const next = qty.value - Math.floor(qty.value / pow10) % 10 * pow10 + (key - 0x40) * pow10;
            if (next >= min && next <= max) qty.value = next;
        }
        if (!deferQtyClose && (key === 0x27 || key === 0x28)) qty.active = 0;
    }
    const storage = {
        'baye/overworldMode': 'hd-map',
        getItem(key) { return this[key] ?? null; },
        setItem(key, val) { this[key] = String(val); },
        removeItem(key) { delete this[key]; }
    };
    const context = vm.createContext({
        document, localStorage: storage, Storage: function () {},
        innerWidth: 1000, innerHeight: 600,
        console: { log() {}, warn() {}, error() {} },
        navigator: { userAgent: 'Node test' },
        setTimeout(fn, delay = 0) {
            const id = ++nextTimer;
            timers.set(id, { fn, at: clock + delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); }, setInterval() {},
        _bayeSendKey: engineSendKey,
        $() { return { css() {}, hide() {}, show() {}, removeAttr() {} }; }
    });
    context.window = context;
    function load(path, expose = '') {
        let source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
        if (expose) source = source.replace(/\}\)\(window\);\s*$/, `${expose}\n})(window);`);
        vm.runInContext(source, context, { filename: path });
    }
    load('js/lcd.js');
    context.Module.asm = {};
    const data = { g_FgtOver: 0, g_hdFightActive: 0, g_hdFightOver: 0 };
    for (const [key, name] of Object.entries({
        g_hdQtyActive: 'active', g_hdQtyValue: 'value', g_hdQtyMin: 'min', g_hdQtyMax: 'max'
    })) Object.defineProperty(data, key, { get: () => qty[name], set: val => { qty[name] = val; } });
    context.baye = {
        data, hdEngineReady: () => true, ensureData: () => data,
        hd: { ready: () => true, qty: () => qty, fight: () => null, march: () => null }
    };
    load('js/hd-city-menu.js', `
        global.__city = { state: state, bind: bindUi, step: stepQty,
            commit: commitQty, cancel: cancelQty,
            forceFood: function () { liveGetFood = function () { return true; }; },
            isolateKeys: function () {
                commitQty = function () { _bayeSendKey(VK.ENTER); };
                cancelQty = function () { _bayeSendKey(VK.EXIT); };
                back = function () { _bayeSendKey(VK.EXIT); };
                BayeHdCityMenu.commitQty = commitQty;
                BayeHdCityMenu.cancelQty = cancelQty;
            }
        };
        // Quantity queue tests exclude unrelated marching/rendering work.
        render = function () {};
        driveFoodToCitySet = function () {};
        scheduleMarchWatch = function () {};
    `);
    load('js/hd-dialog.js', 'global.__dialog = { state: state, bind: bindUi, step: qtyStep };');
    context.__city.state.open = overlay;
    context.__dialog.state.open = overlay && dialog;
    context.__dialog.state.kind = 'qty';
    context.__city.bind();
    context.__dialog.bind();
    document.onkeydown = context.onKeyDown;
    return {
        context, document, nodes, qty, sent,
        capturedTimeouts() { return [...timers.values()].map(timer => timer.fn); },
        setCursor(nextBit) { bit = nextBit; num = 10 ** (maxbit - bit); },
        runTimers() {
            let runs = 0;
            while (timers.size) {
                assert.ok(++runs < 500, 'quantity work must finish, not start a retry loop');
                const [id, timer] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                timers.delete(id);
                clock = timer.at;
                timer.fn();
            }
        },
        key(keyCode, options = {}) {
            const event = {
                keyCode, target: document.body, defaultPrevented: false, returnValue: true,
                preventDefault() { this.defaultPrevented = true; this.returnValue = false; },
                stopPropagation() { this.stopped = true; },
                stopImmediatePropagation() { this.immediate = true; this.stopped = true; },
                ...options
            };
            for (const capture of [true, false]) {
                for (const listener of listeners) {
                    if (event.stopped) break;
                    if (!!listener.capture === capture) listener.fn(event);
                }
            }
            if (!event.immediate) document.onkeydown(event);
            return event;
        },
        click(rootId, attribute, value) {
            const target = node('BUTTON');
            target.setAttribute(attribute, value);
            target.parentNode = nodes[rootId];
            const ev = { target, preventDefault() {}, stopPropagation() {} };
            for (const fn of nodes[rootId].listeners.get('click') || []) fn(ev);
        }
    };
}

let count = 0;
function test(name, fn) { fn(); count++; console.log(`ok ${count} - ${name}`); }

test('overlapping dialog/city/classic listeners dispatch Enter and Esc once', () => {
    for (const [key, expected] of [[13, 0x27], [27, 0x28]]) {
        const h = harness();
        h.context.__city.isolateKeys();
        assert.equal(h.key(key).defaultPrevented, true);
        assert.deepEqual(h.sent, [expected]);
        // A base handler invoked separately must also honor consumed events.
        h.context.onKeyDown({ keyCode: key, defaultPrevented: true });
        assert.deepEqual(h.sent, [expected]);
    }
});

test('city-only quantity UI owns Enter/Esc and repeated keys do not resubmit', () => {
    for (const [key, expected] of [[13, 0x27], [27, 0x28], [32, 0x28]]) {
        const h = harness({ dialog: false });
        h.context.__city.isolateKeys();
        h.key(key);
        h.key(key, { repeat: true });
        assert.deepEqual(h.sent, [expected]);
    }
});

test('classic keys keep one engine dispatch when HD overlays are closed', () => {
    const h = harness({ overlay: false });
    for (const key of [13, 27, 32, 37, 38, 39, 40, 72, 83, 53]) h.key(key);
    assert.deepEqual(h.sent, [0x27, 0x28, 0x28, 0x24, 0x22, 0x25, 0x23, 0x26, 0x33, 0x45]);
});

test('native input, content editing, IME and focused button activation stay native', () => {
    const h = harness();
    h.context.__city.isolateKeys();
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
        for (const key of [13, 27, 32, 38, 53]) {
            assert.equal(h.key(key, { target: node(tag) }).defaultPrevented, false);
        }
    }
    const editable = node(); editable.isContentEditable = true;
    h.key(13, { target: editable });
    h.key(13, { isComposing: true });
    h.key(229);
    h.key(13, { target: node('BUTTON') });
    h.key(32, { target: node('BUTTON') });
    h.key(13, { target: node('A') });
    assert.deepEqual(h.sent, []);
});

test('previously consumed keys and SPE ownership are not reclaimed by quantity shells', () => {
    const h = harness();
    h.context.__city.isolateKeys();
    h.key(13, { defaultPrevented: true });
    h.key(27, { returnValue: false });
    assert.deepEqual(h.sent, []);
    h.context.BayeHdSpe = { isOpen: () => true };
    // SPE capture handlers own skip keys; quantity listeners must pass through.
    assert.equal(h.key(13).defaultPrevented, false);
    assert.deepEqual(h.sent, [0x27]);
});

test('both quantity buttons apply exact +/-1 and +/-10 from every cursor position', () => {
    for (const root of ['hd-city-menu', 'hd-dialog']) {
        for (const delta of [-10, -1, 1, 10]) {
            for (const bit of [0, 1, 2, 3]) {
                const h = harness();
                h.setCursor(bit);
                h.click(root, 'data-hd-qty', delta);
                h.runTimers();
                assert.equal(h.qty.value, 1050 + delta, `${root}, delta=${delta}, bit=${bit}`);
                assert.ok(h.sent.every(key => key !== 0x27 && key !== 0x28));
            }
        }
    }
});

test('quantity steps clamp at min/max, including one-digit and zero maxima', () => {
    for (const [value, min, max, delta, expected] of [
        [1068, 0, 1070, 10, 1070], [2, 1, 100, -10, 1],
        [5, 0, 7, 10, 7], [5, 0, 7, -10, 0],
        [0, 0, 0, 10, 0], [7, 0, 7, 1, 7], [0, 0, 7, -1, 0]
    ]) {
        for (const root of ['hd-city-menu', 'hd-dialog']) {
            const h = harness({ value, min, max });
            h.click(root, 'data-hd-qty', delta);
            h.runTimers();
            assert.equal(h.qty.value, expected, `${root}, value=${value}, delta=${delta}`);
        }
    }
});

test('confirm waits for queued changes, sends one Enter, and never retries into the next UI', () => {
    const h = harness();
    h.context.__city.step(10);
    h.context.__city.commit();
    h.context.__city.commit();
    h.runTimers();
    assert.equal(h.qty.value, 1060);
    assert.equal(h.qty.active, 0);
    assert.equal(h.sent.filter(key => key === 0x27).length, 1);
    assert.equal(h.sent.at(-1), 0x27);
    assert.equal(h.context.__city.state.queue.length, 0);
});

test('rapid opposite steps use the updated quantity before clamping', () => {
    for (const root of ['hd-city-menu', 'hd-dialog']) {
        const h = harness({ value: 0, min: 0, max: 100 });
        h.click(root, 'data-hd-qty', 10);
        h.click(root, 'data-hd-qty', -10);
        h.click(root, 'data-hd-qty', 1);
        h.runTimers();
        assert.equal(h.qty.value, 1);
    }
});

test('both digit pads finish their digit before confirming and cancel pending digits', () => {
    for (const root of ['hd-city-menu', 'hd-dialog']) {
        const h = harness();
        h.setCursor(1);
        h.click(root, 'data-hd-digit', 6);
        h.context.__city.commit();
        h.runTimers();
        assert.equal(h.qty.value, 1060);
        assert.deepEqual(h.sent, [0x46, 0x27]);
        const cancelled = harness();
        cancelled.click(root, 'data-hd-digit', 6);
        cancelled.context.__city.cancel();
        cancelled.runTimers();
        assert.deepEqual(cancelled.sent, [0x28]);
    }
});

test('standalone dialog uses the same step contract and stops sending when closed', () => {
    const h = harness();
    h.context.BayeHdCityMenu = null;
    h.setCursor(0);
    h.context.__dialog.step(10);
    h.runTimers();
    assert.equal(h.qty.value, 1060);
    h.context.__dialog.step(-10);
    h.context.__dialog.state.open = false;
    h.runTimers();
    assert.equal(h.qty.value, 1060);
});

test('cancel discards pending steps/confirmation and cannot send them into the next UI', () => {
    const h = harness();
    h.context.__city.step(10);
    h.context.__city.commit();
    h.context.__city.cancel();
    h.context.__city.cancel();
    h.runTimers();
    assert.deepEqual(h.sent, [0x28]);
    assert.equal(h.qty.value, 1050);
    assert.equal(h.context.__city.state.queue.length, 0);
});

test('async food cancellation invalidates already captured digit callbacks before engine ack', () => {
    const h = harness({ min: 1, deferQtyClose: true });
    h.context.__city.forceFood();
    h.click('hd-dialog', 'data-hd-digit', 6);
    const captured = h.capturedTimeouts();
    h.context.__city.cancel();
    h.context.__city.cancel();
    assert.equal(h.qty.active, 1, 'EXIT acknowledgement is intentionally delayed');
    // Simulate a newly opened quantity before the old key callback runs. Merely
    // checking active/qtyDismissed cannot distinguish these two input sessions.
    h.context.BayeHdCityMenu.resetForNewGame('quantity-epoch-regression');
    Object.assign(h.qty, { active: 1, value: 1060, min: 1, max: 1070 });
    for (const callback of captured) callback();
    h.runTimers();
    assert.deepEqual(h.sent, [0x28]);
    assert.equal(h.qty.active, 1);
    assert.equal(h.qty.value, 1060);
});

test('classic then HD cannot replay a captured quantity command', () => {
    const h = harness({ deferQtyClose: true });
    h.click('hd-city-menu', 'data-hd-digit', 6);
    const captured = h.capturedTimeouts();
    h.context.BayeHdCityMenu.setMode('classic');
    h.context.BayeHdCityMenu.setMode('hd');
    for (const callback of captured) callback();
    h.runTimers();
    assert.deepEqual(h.sent, []);
    assert.equal(h.qty.value, 1050);
});

test('standalone dialog close/reopen does not revive its old step callbacks', () => {
    const h = harness({ deferQtyClose: true });
    h.context.BayeHdCityMenu = null;
    h.context.__dialog.step(10);
    const captured = h.capturedTimeouts();
    h.context.BayeHdDialog.close({ silent: true });
    h.context.BayeHdDialog.openQty({ min: 0, max: 1070, init: 1050 });
    for (const callback of captured) callback();
    h.runTimers();
    assert.deepEqual(h.sent, []);
    assert.equal(h.qty.value, 1050);
});

test('malformed, inactive and unsupported quantity requests do not emit engine keys', () => {
    const h = harness();
    for (const [delta, qty] of [
        [10, null], [10, { active: 0, value: 1, min: 0, max: 2 }],
        [20, h.qty], [NaN, h.qty],
        [1, { active: 1, value: -1, min: 0, max: 10 }],
        [1, { active: 1, value: 1, min: 2, max: 10 }]
    ]) assert.deepEqual(Array.from(h.context.bayeQtyStepKeys(delta, qty)), []);
});

console.log(`${count} HD input regression cases passed.`);
