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

function harness({ overlay = true, dialog = true, value = 1050, min = 0, max = 1070,
    deferQtyClose = false, protocol = false, ackDelay = 12, dropAck = false } = {}) {
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
    const receipts = [];
    const qty = { active: 1, value, min, max };
    // This is the C engine's documented cursor/step contract, not the JS
    // implementation: LEFT multiplies num, RIGHT divides, UP/DOWN apply num.
    const maxbit = String(max).length - 1;
    let bit = maxbit, num = 1;
    if (protocol) Object.assign(qty, { protocol: true, session: 1, inputSeq: 0,
        lastKey: 0xffff, cursor: bit, step: num, ready: 1 });
    function consumeKey(key) {
        if (!qty.active) return;
        if (protocol) qty.ready = 0;
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
        if (protocol) {
            qty.cursor = bit;
            qty.step = num;
            qty.inputSeq = qty.inputSeq === 0xffffffff ? 1 : qty.inputSeq + 1;
            qty.lastKey = key;
            qty.ready = qty.active ? 1 : 0;
            receipts.push({ key, at: clock, seq: qty.inputSeq, value: qty.value });
        }
    }
    function engineSendKey(key) {
        sent.push(key);
        if (!protocol) { consumeKey(key); return; }
        const session = qty.session;
        // GuiPushMsg queues the key without changing C's published readiness;
        // only GamGetMsg consumption changes ready and publishes the receipt.
        if (!dropAck) {
            const id = ++nextTimer;
            timers.set(id, { at: clock + ackDelay, fn() {
                if (qty.session === session) consumeKey(key);
            } });
        }
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
        Date: class extends Date { static now() { return clock; } },
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
    })) Object.defineProperty(data, key, { configurable: true,
        get: () => qty[name], set: val => { qty[name] = val; } });
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
    load('js/hd-dialog.js', `global.__dialog = { state: state, bind: bindUi, step: qtyStep,
        commit: commitQtyDialog, cancel: cancelQtyDialog };`);
    context.__city.state.open = overlay;
    context.__dialog.state.open = overlay && dialog;
    context.__dialog.state.kind = 'qty';
    context.__city.bind();
    context.__dialog.bind();
    document.onkeydown = context.onKeyDown;
    return {
        context, document, nodes, qty, sent, receipts,
        allowReceipts() { dropAck = false; },
        capturedTimeouts() { return [...timers.values()].map(timer => timer.fn); },
        setCursor(nextBit) {
            bit = nextBit; num = 10 ** (maxbit - bit);
            if (protocol) { qty.cursor = bit; qty.step = num; }
        },
        advance(ms) { this.runTimers(clock + ms); },
        runTimers(until = Infinity) {
            let runs = 0;
            while (timers.size) {
                assert.ok(++runs < 3000, 'quantity work must finish, not start a retry loop');
                const [id, timer] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                if (timer.at > until) break;
                timers.delete(id);
                clock = timer.at;
                timer.fn();
            }
            if (until !== Infinity) clock = until;
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

test('native quantity cursor avoids no-op navigation and keeps exact steps from every place', () => {
    for (const standalone of [false, true]) {
        for (const delta of [-10, -1, 1, 10]) {
            for (const bit of [0, 1, 2, 3]) {
                const h = harness({ protocol: true });
                if (standalone) h.context.BayeHdCityMenu = null;
                h.setCursor(bit);
                h.context.__dialog.step(delta);
                h.runTimers();
                assert.equal(h.qty.value, 1050 + delta);
                assert.equal(h.qty.cursor, 3, 'step buttons restore native units');
                assert.equal(h.receipts.length, h.sent.length);
                if (bit === 3) assert.equal(h.sent.length, Math.abs(delta) === 1 ? 1 : 3);
            }
        }
    }
});

test('native ACK delays each following key and confirmation until the real receipt', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, ackDelay: 97 });
        if (standalone) h.context.BayeHdCityMenu = null;
        h.context.__dialog.step(10);
        h.context.__dialog.commit();
        h.context.__dialog.commit();
        h.advance(90);
        assert.deepEqual(h.sent, [0x24]);
        assert.equal(h.qty.value, 1050);
        h.advance(90);
        assert.deepEqual(h.sent, [0x24, 0x22]);
        assert.equal(h.sent.includes(0x27), false);
        h.runTimers();
        assert.deepEqual(h.sent, [0x24, 0x22, 0x25, 0x27]);
        assert.equal(h.qty.value, 1060);
        assert.equal(h.qty.active, 0);
        assert.equal(h.receipts.at(-1).key, 0x27);
    }
});

test('native FIFO re-reads bounds after opposite steps and digits before confirming', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, value: 0, max: 100 });
        if (standalone) h.context.BayeHdCityMenu = null;
        for (const delta of [10, -10, 1]) h.context.__dialog.step(delta);
        h.context.__dialog.commit();
        h.runTimers();
        assert.equal(h.qty.value, 1);
        assert.deepEqual(h.sent, [0x24, 0x22, 0x25, 0x24, 0x23, 0x25, 0x22, 0x27]);

        const digits = harness({ protocol: true });
        if (standalone) digits.context.BayeHdCityMenu = null;
        digits.setCursor(1);
        digits.click('hd-dialog', 'data-hd-digit', 6);
        digits.context.__dialog.step(-10);
        digits.context.__dialog.commit();
        digits.runTimers();
        assert.equal(digits.qty.value, 1050);
        assert.equal(digits.sent.at(-1), 0x27);
    }
});

test('native no-op cursor, rejected digit, bounds and search keys all receive ACKs', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, value: 1070, min: 1000, max: 1070 });
        if (standalone) h.context.BayeHdCityMenu = null;
        for (const key of [39, 38, 48, 70, 83]) assert.equal(h.key(key).defaultPrevented, true);
        h.context.__dialog.commit();
        h.runTimers();
        assert.deepEqual(h.sent, [0x25, 0x22, 0x40, 0x33, 0x33, 0x27]);
        assert.equal(h.qty.value, 1070);
        assert.equal(h.receipts.length, 6);
    }
});

test('native physical keys join pending button input rather than racing the receipt', () => {
    for (const dialog of [false, true]) {
        const h = harness({ protocol: true, dialog });
        h.context.__city.step(10);
        assert.equal(h.key(40).defaultPrevented, true);
        h.context.__city.commit();
        h.runTimers();
        assert.equal(h.qty.value, 1059);
        assert.deepEqual(h.sent, [0x24, 0x22, 0x25, 0x23, 0x27]);
    }
});

test('native ACK timeout drops queued confirmation, never retries, and still permits cancellation', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, dropAck: true });
        if (standalone) h.context.BayeHdCityMenu = null;
        h.context.__dialog.step(10);
        h.context.__dialog.commit();
        h.runTimers();
        const state = standalone ? h.context.__dialog.state : h.context.__city.state;
        assert.equal(state.qtyAckFailed, true);
        assert.equal(state.qtyAckError, 'timeout');
        assert.deepEqual(h.sent, [0x24]);
        h.context.__dialog.commit();
        h.context.__dialog.step(1);
        h.runTimers();
        assert.deepEqual(h.sent, [0x24]);
        h.context.__dialog.cancel();
        h.runTimers();
        assert.deepEqual(h.sent, [0x24, 0x28]);
    }
});

test('native mismatched or skipped receipts cannot release remaining keys or Enter', () => {
    for (const receipt of [{ inputSeq: 1, lastKey: 0x23 }, { inputSeq: 2, lastKey: 0x24 }]) {
        const h = harness({ protocol: true, dropAck: true });
        h.context.__city.step(10);
        h.context.__city.commit();
        h.advance(0);
        Object.assign(h.qty, receipt, { ready: 1 });
        h.runTimers();
        assert.deepEqual(h.sent, [0x24]);
        assert.equal(h.context.__city.state.qtyAckError, 'receipt');
    }
});

test('native session replacement invalidates an active ACK and adopts the new owner independently of march', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, ackDelay: 50 });
        if (standalone) h.context.BayeHdCityMenu = null;
        h.context.__dialog.step(10);
        h.context.__dialog.commit();
        h.advance(0);
        const captured = h.capturedTimeouts();
        Object.assign(h.qty, { session: 2, inputSeq: 0, lastKey: 0xffff, ready: 1, value: 1020 });
        h.context.__dialog.step(1);
        for (const callback of captured) callback();
        h.runTimers();
        assert.deepEqual(h.sent, [0x24, 0x22]);
        assert.equal(h.qty.value, 1021);
        assert.equal(h.sent.includes(0x27), false);
    }
});

test('native cancellation stops an already dispatched step even while its old receipt arrives', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, ackDelay: 50 });
        if (standalone) h.context.BayeHdCityMenu = null;
        h.context.__dialog.step(10);
        h.context.__dialog.commit();
        h.advance(0);
        h.context.__dialog.cancel();
        h.runTimers();
        assert.deepEqual(h.sent, [0x24, 0x28]);
        assert.equal(h.qty.value, 1050);
        assert.equal(h.qty.active, 0);
    }
});

test('native receipt wrap, initial readiness and inactive snapshots remain safe', () => {
    const h = harness({ protocol: true });
    h.qty.inputSeq = 0xffffffff;
    h.context.__city.step(1);
    h.runTimers();
    assert.equal(h.qty.inputSeq, 1);
    assert.equal(h.qty.value, 1051);

    const waiting = harness({ protocol: true });
    waiting.qty.ready = 0;
    waiting.context.__city.step(1);
    waiting.advance(40);
    assert.deepEqual(waiting.sent, []);
    waiting.qty.ready = 1;
    waiting.runTimers();
    assert.deepEqual(waiting.sent, [0x22]);

    const inactive = harness({ protocol: true });
    inactive.context.__city.step(10);
    inactive.context.__city.commit();
    inactive.qty.active = 0;
    inactive.runTimers();
    assert.deepEqual(inactive.sent, [0x24], 'an already dispatched key is never followed after native close');
});

test('native ACK callbacks cannot survive classic mode or a new-game reset', () => {
    for (const reset of [h => h.context.BayeHdCityMenu.setMode('classic'),
        h => h.context.BayeHdCityMenu.resetForNewGame('native-ack-regression')]) {
        const h = harness({ protocol: true, ackDelay: 50 });
        h.context.__city.step(10);
        h.context.__city.commit();
        h.advance(0);
        const captured = h.capturedTimeouts();
        reset(h);
        for (const callback of captured) callback();
        h.runTimers();
        assert.deepEqual(h.sent, [0x24]);
        assert.equal(h.sent.includes(0x27), false);
    }
});

test('native quantity cleanup never writes quantity mirrors even without a march bridge', () => {
    const h = harness({ protocol: true });
    const writes = [];
    for (const key of ['g_hdQtyActive', 'g_hdQtyValue', 'g_hdQtyMin', 'g_hdQtyMax']) {
        Object.defineProperty(h.context.baye.data, key, {
            configurable: true, get: () => 1, set: value => writes.push([key, value])
        });
    }
    h.context.__city.cancel();
    h.runTimers();
    assert.deepEqual(writes, []);
});

test('standalone cancellation and confirmation cannot reopen the same delayed native owner', () => {
    for (const commit of [false, true]) {
        const h = harness({ protocol: true, deferQtyClose: true });
        h.context.BayeHdCityMenu = null;
        h.context.BayeHdDialog.openQty({ min: 0, max: 1070, init: 1050 });
        if (commit) h.context.__dialog.commit(); else h.context.__dialog.cancel();
        h.runTimers();
        assert.equal(h.qty.active, 1, 'native close is deliberately delayed');
        assert.equal(h.context.__dialog.state.open, false);
        assert.equal(h.context.BayeHdDialog.openQty({ min: 0, max: 1070, init: 1050 }), false);
        h.context.BayeHdDialog.poll();
        for (const key of [13, 27, 32, 37, 38, 39, 40, 48, 72, 70, 83]) {
            assert.equal(h.key(key).defaultPrevented, true, 'closed owner retains native key ownership');
        }
        assert.equal(h.key(13, { target: node('INPUT') }).defaultPrevented, false);
        assert.equal(h.key(13, { isComposing: true }).defaultPrevented, false);
        h.context.__dialog.commit();
        h.context.__dialog.step(1);
        h.runTimers();
        assert.deepEqual(h.sent, [commit ? 0x27 : 0x28]);

        Object.assign(h.qty, { session: 2, inputSeq: 0, lastKey: 0xffff, ready: 1 });
        assert.equal(h.context.BayeHdDialog.openQty({ min: 0, max: 1070, init: 1050 }), true);
        h.context.__dialog.step(1);
        h.runTimers();
        assert.deepEqual(h.sent, [commit ? 0x27 : 0x28, 0x22]);
        assert.equal(h.qty.value, 1051);
    }
});

test('a pending native receipt survives view close/reopen before planning a fresh step', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, ackDelay: 12, max: 9999 });
        if (standalone) h.context.BayeHdCityMenu = null;
        h.context.__dialog.step(10);
        h.advance(4);
        assert.deepEqual(h.sent, [0x24]);
        assert.equal(h.qty.ready, 1, 'GuiPushMsg does not change the C readiness mirror');
        if (standalone) {
            h.context.BayeHdDialog.close({ silent: true });
            h.context.BayeHdDialog.openQty({ min: 0, max: 9999, init: 1050 });
        } else {
            h.context.BayeHdCityMenu.setMode('classic');
            h.context.BayeHdCityMenu.setMode('hd');
        }
        h.context.__dialog.step(10);
        h.runTimers();
        assert.deepEqual(h.sent, [0x24, 0x22, 0x25]);
        assert.equal(h.qty.value, 1060);
        assert.equal(h.qty.cursor, 3);
    }
});

test('a fresh confirmation after view reopen waits for the abandoned key receipt', () => {
    const h = harness({ protocol: true, ackDelay: 37 });
    h.context.BayeHdCityMenu = null;
    h.context.__dialog.step(10);
    h.advance(4);
    h.context.BayeHdDialog.close({ silent: true });
    h.context.BayeHdDialog.openQty({ min: 0, max: 1070, init: 1050 });
    h.context.__dialog.commit();
    h.advance(20);
    assert.deepEqual(h.sent, [0x24]);
    h.runTimers();
    assert.deepEqual(h.sent, [0x24, 0x27]);
    assert.equal(h.qty.value, 1050);
});

test('failed native receipt remains sticky in the same owner and releases on a fresh native session', () => {
    for (const standalone of [false, true]) {
        const h = harness({ protocol: true, dropAck: true });
        if (standalone) h.context.BayeHdCityMenu = null;
        h.context.__dialog.step(10);
        h.runTimers();
        assert.deepEqual(h.sent, [0x24]);
        if (standalone) {
            h.context.BayeHdDialog.close({ silent: true });
            h.context.BayeHdDialog.openQty({ min: 0, max: 1070, init: 1050 });
        } else {
            h.context.BayeHdCityMenu.setMode('classic');
            h.context.BayeHdCityMenu.setMode('hd');
        }
        // Even a late matching receipt cannot revive a timed-out owner.
        Object.assign(h.qty, { inputSeq: 1, lastKey: 0x24, ready: 1 });
        h.context.__dialog.step(1);
        h.context.__dialog.commit();
        h.runTimers();
        assert.deepEqual(h.sent, [0x24]);

        Object.assign(h.qty, { session: 2, inputSeq: 0, lastKey: 0xffff, ready: 1 });
        if (standalone) h.context.BayeHdDialog.openQty({ min: 0, max: 1070, init: 1050 });
        h.allowReceipts();
        h.context.__dialog.step(1);
        h.runTimers();
        assert.deepEqual(h.sent, [0x24, 0x22], 'new session is not poisoned by the old failure');
        assert.equal(h.qty.value, 1051);
    }
});

test('city food mode changes cannot reopen or confirm a closed native quantity owner', () => {
    for (const commit of [false, true]) {
        const h = harness({ protocol: true, deferQtyClose: true, min: 1, ackDelay: 50 });
        h.context.baye.hd.march = () => ({ session: 1, inputSeq: 1, phase: 2, origin: 0, selected: 1 });
        Object.assign(h.context.__city.state, { marchSession: 1, marchOriginIndex: 0,
            battleMake: true, personExitSent: true });
        if (commit) h.context.__city.commit(); else h.context.__city.cancel();
        assert.deepEqual(h.sent, [commit ? 0x27 : 0x28]);
        assert.equal(h.qty.ready, 1, 'the closing key is queued but not yet consumed');
        h.context.BayeHdCityMenu.setMode('classic');
        h.context.BayeHdDialog.poll();
        h.context.BayeHdCityMenu.setMode('hd');
        h.context.BayeHdDialog.poll();
        assert.equal(h.key(13).defaultPrevented, true);
        assert.equal(h.key(38).defaultPrevented, true);
        h.context.__city.step(1);
        h.context.__city.commit();
        h.context.__city.cancel();
        h.runTimers();
        assert.deepEqual(h.sent, [commit ? 0x27 : 0x28]);

        Object.assign(h.qty, { session: 2, inputSeq: 0, lastKey: 0xffff, ready: 1 });
        h.context.__city.step(1);
        h.runTimers();
        assert.deepEqual(h.sent, [commit ? 0x27 : 0x28, 0x22]);
        assert.equal(h.qty.value, 1051);
    }
});

console.log(`${count} HD input regression cases passed.`);
