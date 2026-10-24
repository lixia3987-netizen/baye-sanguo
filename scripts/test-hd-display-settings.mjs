import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Use the real PC settings controller and classic keyboard handler. Native
// button activation remains the browser's job; this fixture checks ownership,
// focus boundaries and the settings that a subsequent click actually changes.
function harness({ noToolbar = false } = {}) {
    const listeners = new Map(), nodes = new Map(), sent = [], writes = [], focusCalls = [], blurCalls = [];
    let document;
    function node(id, tagName = 'DIV', parentNode = null) {
        const attrs = new Map(), handlers = new Map();
        const item = { id, tagName, parentNode, parentElement: parentNode, hidden: false, disabled: false,
            style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} },
            setAttribute: (key, value) => attrs.set(key, String(value)),
            getAttribute: key => attrs.get(key) ?? null, hasAttribute: key => attrs.has(key),
            addEventListener(type, fn) { handlers.set(type, fn); },
            focus() { focusCalls.push(item); document.activeElement = item; },
            blur() { blurCalls.push(item); if (document.activeElement === item) document.activeElement = document.body; },
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
    const gameFocus = node('baye-game-focus', 'SPAN', toolbar);
    const panel = node('baye-hd-settings-panel', 'DIV', toolbar); panel.hidden = true;
    const filter = node('smooth', 'BUTTON', panel); filter.setAttribute('data-hd-filter', 'smooth');
    const last = node('last', 'BUTTON', panel), outside = node('outside', 'BUTTON', body), options = [filter, last];
    document = { documentElement: root, body, activeElement: body,
        getElementById: id => nodes.get(id) ?? null, querySelectorAll() { return []; } };
    if (noToolbar) for (const id of ['baye-hd-toolbar', 'baye-game-focus', 'baye-hd-settings-panel']) nodes.delete(id);
    const storage = new Map([['baye/overworldMode', 'hd-map']]);
    const context = vm.createContext({ document, console, Storage: function () {}, _bayeSendKey: key => sent.push(key),
        localStorage: { getItem: key => storage.get(key) ?? null,
            setItem(key, value) { writes.push([key, value]); storage.set(key, value); } },
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); } });
    context.window = context;
    for (const file of ['js/lcd.js', 'js/hd-graphics.js']) {
        // Optional explicit contrast input only; the default suite uses tracked sources.
        const source = file === 'js/hd-graphics.js' && process.env.BAYE_DISPLAY_GRAPHICS_SOURCE ?
            process.env.BAYE_DISPLAY_GRAPHICS_SOURCE : new URL('../' + file, import.meta.url);
        vm.runInContext(readFileSync(source, 'utf8'), context, { filename: file });
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
    return { context, toggle, panel, filter, last, outside, body, toolbar, gameFocus, document, sent, writes,
        focusCalls, blurCalls, makeNode: node, click, dispatch, loadDialog, downstream: () => downstream };
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

test('game focus surface is a named nonfocusable PC sibling rather than a native input control', () => {
    const html = readFileSync(new URL('../pc.html', import.meta.url), 'utf8');
    assert.equal((html.match(/\bid=["']baye-game-focus["']/g) ?? []).length, 1);
    const spans = [...html.matchAll(/<span\b([^>]*)>([^<]*)<\/span>/g)].filter(m => /\bid=["']baye-game-focus["']/.test(m[1]));
    assert.equal(spans.length, 1, 'the real public page contains one plain-text SPAN');
    const [markup, raw, label] = spans[0], attrs = new Map([...raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(["'])(.*?)\2)?/g)].map(m => [m[1], m[3] ?? '']));
    assert.equal(label, '键盘操作'); assert.equal(attrs.get('role'), 'note');
    assert.equal(attrs.get('aria-label'), attrs.get('title')); assert.match(attrs.get('title'), /方向键.*回车.*空格/);
    for (const name of ['tabindex', 'contenteditable', 'hidden', 'onclick', 'onmousedown', 'onmouseup', 'onpointerdown', 'onpointerup', 'onkeydown', 'onkeyup']) assert.equal(attrs.has(name), false, name);
    assert.ok(attrs.get('class').split(/\s+/).includes('baye-game-focus'));
    const toolbar = html.indexOf('<div id="baye-hd-toolbar"'), panel = html.indexOf('<div id="baye-hd-settings-panel"', toolbar), at = html.indexOf(markup, toolbar);
    const disclosure = /<button\b[^>]*\bdata-hd-settings-toggle\b[^>]*>[\s\S]*?<\/button>/.exec(html.slice(toolbar, panel));
    assert.ok(toolbar >= 0 && panel > toolbar && at > toolbar && at < panel && disclosure);
    assert.match(html.slice(toolbar + disclosure.index + disclosure[0].length, at), /^\s*$/, 'the focus surface is directly beside the disclosure, outside its panel');
});

test('game focus surface exact-node clicks only retire display UI without native state access or scripted focus', () => {
    for (const open of [false, true]) {
        const h = harness(); if (open) h.click(h.toggle); h.filter.focus();
        const before = h.document.activeElement, calls = h.focusCalls.length; let nativeReads = 0, randomReads = 0;
        Object.defineProperty(h.context, 'baye', { get() { nativeReads++; throw Error('Display focus cannot read engine state'); } });
        vm.runInContext('Math', h.context).random = () => { randomReads++; throw Error('Display focus cannot advance RNG'); };
        h.dispatch('pointerdown', h.gameFocus); h.click(h.gameFocus);
        assert.equal(h.panel.hidden, true); assert.equal(h.toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(h.document.activeElement, before, 'this VM does not manufacture the browser pointer-default focus transition');
        assert.equal(h.focusCalls.length, calls); assert.equal(h.blurCalls.length, 0);
        assert.deepEqual([nativeReads, randomReads], [0, 0]); assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    }
    for (const make of [h => h.makeNode('focus-lookalike', 'SPAN', h.toolbar), h => h.makeNode('baye-game-focus', 'DIV', h.toolbar), h => { h.gameFocus.parentNode = h.panel; h.gameFocus.parentElement = h.panel; return h.gameFocus; }, h => h.makeNode('focus-child', 'SPAN', h.gameFocus)]) {
        const h = harness(); h.click(h.toggle); const target = make(h); h.click(target);
        assert.equal(h.panel.hidden, false, 'wrong ID, tag, parent or descendant cannot gain exact-SPAN authority');
        assert.equal(h.focusCalls.length, 0); assert.equal(h.blurCalls.length, 0); assert.deepEqual(h.sent, []); assert.deepEqual(h.writes, []);
    }
});

test('game focus surface keeps held settings key barriers and fresh BODY events retain classic keyboard ownership', () => {
    for (const activation of [{ key: 'Enter', keyCode: 13, code: 'Enter' }, { key: ' ', keyCode: 32, code: 'Space' }]) {
        const h = harness(); h.click(h.toggle); h.filter.focus();
        assert.equal(h.dispatch('keydown', h.filter, activation).stopped, true);
        h.click(h.gameFocus); assert.equal(h.panel.hidden, true);
        assert.equal(h.dispatch('keydown', h.body, { ...activation, repeat: true }).stopped, true);
        assert.equal(h.dispatch('keyup', h.body, activation).stopped, true);
        assert.deepEqual(h.sent, [], 'a held settings activation never escapes on the changed event target');
        // BODY is an explicit new event-target precondition, not a simulated
        // assertion that the preceding pointer click physically moved focus.
        const event = h.dispatch('keydown', h.body, activation);
        assert.equal(event.stopped, false); assert.deepEqual(h.sent, [activation.keyCode === 13 ? 0x27 : 0x28]);
    }
    const h = harness(); h.click(h.toggle); h.click(h.gameFocus);
    h.dispatch('keydown', h.body, { key: 'ArrowLeft', keyCode: 37 });
    assert.deepEqual(h.sent, [0x24]); assert.deepEqual(h.writes, []);
});

test('game focus surface source fits the supported 320px PC width budget and adds no mobile toolbar', () => {
    const css = readFileSync(new URL('../css/hd-graphics.css', import.meta.url), 'utf8'), mapCss = readFileSync(new URL('../css/hd-overworld.css', import.meta.url), 'utf8');
    const rule = /\.baye-game-focus\s*\{([^}]+)\}/.exec(css); assert.ok(rule, 'the public surface has its own scoped measurable style');
    const minimum = key => Number(new RegExp(key + ':\\s*(\\d+)px').exec(rule[1])?.[1]);
    assert.ok(minimum('min-width') >= 88 && minimum('min-height') >= 40); assert.match(rule[1], /display:\s*inline-flex/); assert.match(rule[1], /pointer-events:\s*auto/);
    const toggle = /\.baye-hd-toolbar \[data-hd-settings-toggle\]\s*\{([^}]+)\}/.exec(css), toolbar = /\.baye-hd-toolbar\s*\{([^}]+)\}/.exec(css);
    assert.ok(toggle && toolbar); const disclosureWidth = Number(/min-width:\s*(\d+)px/.exec(toggle[1])?.[1]), gap = Number(/gap:\s*(\d+)px/.exec(toolbar[1])?.[1]);
    const inset = Number(/max-width:\s*calc\(100vw\s*-\s*(\d+)px\)/.exec(mapCss)?.[1]);
    assert.ok(minimum('min-width') + disclosureWidth + gap <= 320 - inset, 'only the declared minimum-size budget is checked; real font/rect/layout needs a browser');
    const mobile = readFileSync(new URL('../m.html', import.meta.url), 'utf8'); assert.doesNotMatch(mobile, /baye-game-focus|baye-hd-toolbar|css\/hd-graphics\.css/);
    const h = harness({ noToolbar: true }); assert.doesNotThrow(() => h.context.BayeHd.applyPcPage());
    h.dispatch('keydown', h.body, { key: 'ArrowLeft', keyCode: 37 }); assert.deepEqual(h.sent, [0x24]); assert.deepEqual(h.writes, []);
});
