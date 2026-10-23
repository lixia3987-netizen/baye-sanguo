import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Use the real PC settings controller and classic keyboard handler. Native
// button activation remains the browser's job; this fixture checks ownership,
// focus boundaries and the settings that a subsequent click actually changes.
function harness() {
    const listeners = new Map(), nodes = new Map(), sent = [], writes = [];
    let document;
    function node(id, tagName = 'DIV', parentNode = null) {
        const attrs = new Map(), handlers = new Map();
        const item = { id, tagName, parentNode, parentElement: parentNode, hidden: false, disabled: false,
            style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} },
            setAttribute: (key, value) => attrs.set(key, String(value)),
            getAttribute: key => attrs.get(key) ?? null, hasAttribute: key => attrs.has(key),
            addEventListener(type, fn) { handlers.set(type, fn); },
            focus() { document.activeElement = item; },
            blur() { if (document.activeElement === item) document.activeElement = document.body; },
            querySelector(selector) { return item.querySelectorAll(selector)[0] ?? null; },
            querySelectorAll(selector) {
                if (selector === '[data-hd-settings-toggle]') return id === 'baye-hd-toolbar' ? [toggle] : [];
                if (selector === 'button') return id === 'baye-hd-settings-panel' ? options : [];
                return [];
            }, handlers };
        nodes.set(id, item); return item;
    }
    const root = node('html'), body = node('body', 'BODY', root), toolbar = node('baye-hd-toolbar', 'DIV', body);
    const toggle = node('settings-toggle', 'BUTTON', toolbar); toggle.setAttribute('data-hd-settings-toggle', '');
    toggle.setAttribute('aria-expanded', 'false');
    const panel = node('baye-hd-settings-panel', 'DIV', toolbar); panel.hidden = true;
    const filter = node('smooth', 'BUTTON', panel); filter.setAttribute('data-hd-filter', 'smooth');
    const last = node('last', 'BUTTON', panel), outside = node('outside', 'BUTTON', body), options = [filter, last];
    document = { documentElement: root, body, activeElement: body,
        getElementById: id => nodes.get(id) ?? null, querySelectorAll() { return []; } };
    const storage = new Map([['baye/overworldMode', 'hd-map']]);
    const context = vm.createContext({ document, console, Storage: function () {}, _bayeSendKey: key => sent.push(key),
        localStorage: { getItem: key => storage.get(key) ?? null,
            setItem(key, value) { writes.push([key, value]); storage.set(key, value); } },
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); } });
    context.window = context;
    for (const file of ['js/lcd.js', 'js/hd-graphics.js']) {
        vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context, { filename: file });
    }
    context.Module.asm = {};
    context.BayeHd.applyPcPage();
    let downstream = 0;
    context.addEventListener('keydown', () => { downstream++; });
    function dispatch(type, target, extra = {}) {
        const event = { type, target, defaultPrevented: false, stopped: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
        for (const fn of listeners.get(type) ?? []) { fn(event); if (event.stopped) break; }
        if (type === 'keydown' && !event.stopped) context.onKeyDown(event);
        return event;
    }
    function click(target) { toolbar.handlers.get('click')({ target }); }
    function loadDialog() {
        const dialog = node('hd-dialog', 'DIV', body), stage = node('hd-dialog-stage', 'DIV', dialog);
        for (const id of ['hd-dialog-title', 'hd-dialog-body', 'hd-dialog-caption']) node(id, 'DIV', stage);
        const help = { active: 0, text: '' };
        context.baye = { data: {}, ensureData: () => ({}), hdEngineReady: () => true,
            hd: { ready: () => true, help: () => help, fight: () => ({ active: 0 }) } };
        vm.runInContext(readFileSync(new URL('../js/hd-dialog.js', import.meta.url), 'utf8'), context,
            { filename: 'js/hd-dialog.js' });
        last.setAttribute('data-hd-settings-help', 'help');
        return { stage, publish() {
            Object.assign(help, { active: 1, text: '原生帮助|将领与城池资料' });
            context.BayeHdDialog.onEngineHelp();
        } };
    }
    return { context, toggle, panel, filter, last, outside, body, document, sent, writes,
        click, dispatch, loadDialog, downstream: () => downstream };
}

test('display disclosure changes no game input or saved settings; an option keeps its original setting action', () => {
    const h = harness();
    h.click(h.toggle);
    assert.equal(h.panel.hidden, false); assert.equal(h.toggle.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(h.writes, []); assert.deepEqual(h.sent, []);
    h.click(h.filter);
    assert.equal(h.context.BayeHd.getSettings().filter, 'smooth');
    assert.deepEqual(h.writes, [['baye/lcdFilter', 'smooth']]);
    assert.equal(h.panel.hidden, true); assert.equal(h.toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(h.document.activeElement, h.toggle); assert.deepEqual(h.sent, []);
});

test('settings keyboard ownership precedes native input while Enter and Space retain native button defaults', () => {
    const h = harness(); h.click(h.toggle); h.filter.focus();
    for (const [key, keyCode] of [['Enter', 13], [' ', 32], ['ArrowLeft', 37], ['h', 72]]) {
        const event = h.dispatch('keydown', h.filter, { key, keyCode });
        assert.equal(event.defaultPrevented, false, 'the focused settings button keeps browser defaults');
        h.dispatch('keyup', h.filter, { key, keyCode });
    }
    const escape = h.dispatch('keydown', h.filter, { key: 'Escape', keyCode: 27 });
    assert.equal(escape.defaultPrevented, true); assert.equal(h.panel.hidden, true);
    assert.equal(h.document.activeElement, h.toggle);
    assert.equal(h.downstream(), 0); assert.deepEqual(h.sent, []);
    h.dispatch('keydown', h.body, { key: 'ArrowLeft', keyCode: 37 });
    assert.deepEqual(h.sent, [0x24], 'normal game keyboard ownership returns after leaving settings');
});

test('expanded settings keep Tab inside their controls and outside clicks or lost focus retire the panel', () => {
    const h = harness(); h.click(h.toggle); h.toggle.focus();
    h.dispatch('keydown', h.toggle, { key: 'Tab', keyCode: 9, shiftKey: true });
    assert.equal(h.document.activeElement, h.last);
    h.dispatch('keydown', h.last, { key: 'Tab', keyCode: 9 });
    assert.equal(h.document.activeElement, h.toggle);
    h.filter.focus(); h.dispatch('pointerdown', h.outside);
    assert.equal(h.panel.hidden, true); assert.equal(h.document.activeElement, h.toggle);
    h.click(h.toggle); h.dispatch('blur', h.body);
    assert.equal(h.panel.hidden, true); assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
});

test('closing display settings returns ordinary game arrows even while the disclosure keeps focus', () => {
    const h = harness(); h.click(h.toggle); h.click(h.filter);
    assert.equal(h.document.activeElement, h.toggle);
    h.dispatch('keydown', h.toggle, { key: 'ArrowLeft', keyCode: 37 });
    assert.deepEqual(h.sent, [0x24]);
    h.dispatch('keydown', h.toggle, { key: 'Enter', keyCode: 13 });
    h.dispatch('keydown', h.toggle, { key: ' ', keyCode: 32 });
    assert.deepEqual(h.sent, [0x24], 'native disclosure activation never doubles as a game confirm or exit');
});

test('native help/search takes focus after its real asynchronous publication without a leaked activation key', () => {
    for (const [method, code] of [['openHelp', 0x26], ['openSearch', 0x33]]) for (const space of [false, true]) {
        const h = harness(), dialog = h.loadDialog(); h.click(h.toggle); h.last.focus();
        const activation = space ? { key: ' ', keyCode: 32, code: 'Space' } : { key: 'Enter', keyCode: 13, code: 'Enter' };
        h.dispatch('keydown', h.last, activation);
        if (space) {
            const release = h.dispatch('keyup', h.last, activation);
            assert.equal(release.stopped, true); assert.equal(release.defaultPrevented, false);
        }
        // A native button's default click executes its inline action before
        // bubbling to settings, on Enter keydown or after Space keyup.
        assert.equal(h.context.BayeHdDialog[method]({ focus: true }), true); h.click(h.last);
        assert.equal(h.panel.hidden, true); assert.equal(h.document.activeElement, h.body);
        assert.equal(h.context.BayeHdDialog.isOpen(), false, 'no speculative help UI opens');
        dialog.publish(); assert.equal(h.document.activeElement, dialog.stage);
        if (!space) {
            const repeat = h.dispatch('keydown', dialog.stage, { ...activation, repeat: true });
            assert.equal(repeat.defaultPrevented, true);
            const release = h.dispatch('keyup', dialog.stage, activation);
            assert.equal(release.stopped, true);
        }
        assert.deepEqual(h.sent, [code], 'either native button activation requests help exactly once');
        h.dispatch('keydown', dialog.stage, { key: 'Escape', keyCode: 27, code: 'Escape' });
        assert.deepEqual(h.sent, [code, 0x28], 'the new native help owner receives its explicit Exit');
        assert.deepEqual(h.writes, []);
    }
});

test('a delayed native help publication does not steal focus after the player selected another control', () => {
    const h = harness(), dialog = h.loadDialog(); h.click(h.toggle); h.last.focus();
    h.context.BayeHdDialog.openHelp({ focus: true }); h.click(h.last); h.outside.focus();
    dialog.publish(); assert.equal(h.document.activeElement, h.outside); assert.deepEqual(h.sent, [0x26]);
});
