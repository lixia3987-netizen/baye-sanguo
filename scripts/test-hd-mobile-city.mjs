// Pure ABI/DOM fixtures. No browser, native input, storage or world mutation.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../js/hd-mobile-city.js', import.meta.url), 'utf8');
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';

function fixture() {
    const listeners = new Map(), windowListeners = new Map(), timers = new Map(), subscribers = [];
    const counts = {clicks: [], keys: [], modes: [], retire: [], configured: [], serializedData: 0};
    const nodes = new Map();
    let topOverride = null;
    function element(id, tagName, parent, rect) {
        const attrs = {}, classes = new Set();
        const value = {id, tagName, nodeType: 1, parentElement: parent, parentNode: parent,
            isConnected: true, hidden: false, disabled: false, textContent: '',
            rect: {...rect}, style: {display: 'block', visibility: 'visible', opacity: '1'}, attrs,
            classList: {toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name)},
            setAttribute(name, item) { attrs[name] = item; }, getBoundingClientRect() { return {...this.rect}; },
            contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; },
            click() { return fire('click', this, {isTrusted: false, detail: 0}); }};
        nodes.set(id, value); return value;
    }
    const html = element('html', 'HTML', null, {left: 0, top: 0, width: 844, height: 390});
    const body = element('body', 'BODY', html, html.rect);
    const cityRoot = element('hd-city-menu', 'DIV', body, html.rect);
    const dialogRoot = element('hd-dialog', 'DIV', body, html.rect);
    const cityButton = element('city-button', 'BUTTON', cityRoot, {left: 100, top: 100, width: 100, height: 44});
    const dialogButton = element('dialog-button', 'BUTTON', dialogRoot, {left: 240, top: 100, width: 100, height: 44});
    const modeButton = element('hd-mobile-menu-mode', 'BUTTON', body, {left: 650, top: 8, width: 160, height: 44});
    const exit = element('hd-mobile-exit', 'BUTTON', body, {left: 8, top: 8, width: 80, height: 44});
    const outside = element('outside', 'DIV', body, {left: 400, top: 300, width: 100, height: 60});
    const lcd = element('lcd', 'CANVAS', body, {left: 0, top: 60, width: 640, height: 300});
    const data = {};
    const fields = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdMapInputSeq', 'g_hdMapPick', 'g_hdMapCity',
        'g_hdBattlePick', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex',
        'g_hdMarchPhase', 'g_hdMarchSession', 'g_hdMarchInputSeq', 'g_hdReportActive', 'g_hdReportSeq',
        'g_hdReportInputSeq', 'g_hdReportKind', 'g_hdReportPerson', 'g_hdQtyActive', 'g_hdQtySession',
        'g_hdQtyInputSeq', 'g_hdQtyValue', 'g_hdQtyMin', 'g_hdQtyMax', 'g_hdQtyReady', 'g_hdHelpActive', 'g_hdHelpSeq', 'g_hdHelpInputSeq',
        'g_hdFightActive', 'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive', 'g_hdAttackActive',
        'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdMiniMapActive', 'g_hdViewActive', 'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];
    for (const field of fields) data[field] = 0;
    Object.assign(data, {g_hdEngineReady: 1, g_hdDetailGeneration: 4, g_hdMapInputSeq: 8, g_hdMapCity: 17,
        g_hdMenuActive: 1, g_hdMenuContext: 1, g_hdMenuKind: 3, g_hdMenuSeq: 12, g_hdMenuCount: 2,
        g_hdMarchSession: 5, g_hdMarchInputSeq: 11, g_hdReportSeq: 3, g_hdReportInputSeq: 6,
        g_hdQtySession: 4, g_hdQtyInputSeq: 2, g_hdQtyValue: 10, g_hdQtyMax: 100, g_hdQtyReady: 1,
        g_hdHelpSeq: 2, g_hdHelpInputSeq: 3});
    // Both enumerable (dialog) and non-enumerable (city) data references must stay opaque.
    Object.defineProperty(data, 'toJSON', {value() { counts.serializedData++; throw Error('native data serialized'); }});
    data.circular = data;
    let identity = {status: 'ready', sha256: SHA, byteLength: 207195, generation: 2};
    const state = {ready: true, cityActive: true, dialogActive: false, mode: 'hd', cityLcd: 'off', dialogLcd: 'off',
        names: ['曹丕', '辛毗'], ids: [0, 40], idsValid: true, text: '将军有何吩咐？',
        cityTicket: true, dialogTicket: true, ticketHook: null, menuHook: null};
    function raw() { return Object.fromEntries(fields.map(name => [name, window.baye.data[name]])); }
    function menu() {
        if (state.menuHook) state.menuHook();
        const d = window.baye.data;
        return {active: d.g_hdMenuActive, context: d.g_hdMenuContext, kind: d.g_hdMenuKind, seq: d.g_hdMenuSeq,
            detailGeneration: d.g_hdDetailGeneration, count: d.g_hdMenuCount, index: d.g_hdMenuIndex,
            names: [...state.names], ids: [...state.ids], idsValid: state.idsValid};
    }
    function qty() {
        const d = window.baye.data;
        return {active: d.g_hdQtyActive, protocol: true, session: d.g_hdQtySession, inputSeq: d.g_hdQtyInputSeq,
            value: d.g_hdQtyValue, min: d.g_hdQtyMin, max: d.g_hdQtyMax, ready: d.g_hdQtyReady};
    }
    function report() {
        const d = window.baye.data;
        return {active: d.g_hdReportActive, seq: d.g_hdReportSeq, inputSeq: d.g_hdReportInputSeq,
            kind: d.g_hdReportKind, person: d.g_hdReportPerson, text: state.text};
    }
    function help() {
        const d = window.baye.data;
        return {active: d.g_hdHelpActive, seq: d.g_hdHelpSeq, inputSeq: d.g_hdHelpInputSeq,
            detailGeneration: d.g_hdDetailGeneration, text: '人物资料'};
    }
    function ticket(kind) {
        if (!state[kind + 'Ticket']) return null;
        const d = window.baye.data;
        const result = {key: JSON.stringify([identity.generation, raw(), menu(), qty(), report(), help()]),
            libraryGeneration: identity.generation, ownerType: kind === 'city' ? 'city' : state.dialogOwner || 'report'};
        if (kind === 'city') Object.assign(result, {cityIndex: d.g_hdMapCity - 1, menuContext: d.g_hdMenuContext,
            menuKind: d.g_hdMenuKind, menuSeq: d.g_hdMenuSeq, detailGeneration: d.g_hdDetailGeneration,
            session: d.g_hdQtySession, inputSeq: d.g_hdQtyInputSeq});
        Object.defineProperty(result, 'data', {value: d, enumerable: kind === 'dialog'});
        return state.ticketHook ? state.ticketHook(result, kind) : result;
    }
    const document = {body, hidden: false, getElementById: id => nodes.get(id) || null,
        addEventListener(name, fn) { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list); },
        elementFromPoint(x, y) {
            if (topOverride) return topOverride;
            for (const n of [modeButton, exit, cityButton, dialogButton, outside, lcd]) {
                const r = n.rect;
                if (x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height) return n;
            }
            return body;
        }};
    function shared(kind) {
        return {applyMobilePage(options) { counts.configured.push(kind); this.options = options; },
            configureMobileHost(options) { counts.configured.push(kind); this.options = options; },
            start() { counts.configured.push(kind + '-start'); },
            getMode: () => state.mode,
            setMode(value) { state.mode = value; counts.modes.push(value); },
            retireInteraction(reason) { counts.retire.push([kind, reason]); },
            isActive: () => state[kind + 'Active'], getLcdPresentation: () => state[kind + 'Lcd'],
            getInputTicket: () => ticket(kind)};
    }
    const window = {document, innerWidth: 844, innerHeight: 390,
        matchMedia: () => ({matches: window.innerWidth > window.innerHeight}),
        getComputedStyle(n) {
            if (n === cityRoot && !body.classList.contains('hd-mobile-city-on') ||
                n === dialogRoot && !body.classList.contains('hd-mobile-dialog-on')) return {...n.style, display: 'none'};
            return n.style;
        },
        BayeHdCityMenu: shared('city'), BayeHdDialog: shared('dialog'),
        BayeHdLibIdentity: {read: () => identity, isCurrent: value => value.status === identity.status &&
            value.sha256 === identity.sha256 && value.generation === identity.generation,
            subscribe(fn) { subscribers.push(fn); }},
        baye: {data, ensureData: () => window.baye.data, hd: {ready: () => state.ready, menuItems: menu, qty, report, help}},
        setInterval(fn, ms) { const id = Symbol(); timers.set(id, {fn, ms}); return id; },
        clearInterval(id) { timers.delete(id); },
        addEventListener(name, fn) { const list = windowListeners.get(name) || []; list.push(fn); windowListeners.set(name, list); }};
    function fire(type, target = cityButton, values = {}) {
        const r = target.rect;
        const event = {type, target, pointerId: 1, isPrimary: true, isTrusted: true, button: 0, detail: 1,
            clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, repeat: false,
            prevented: false, stopped: false, preventDefault() { this.prevented = true; },
            stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...values};
        for (const fn of listeners.get(type) || []) { fn(event); if (event.stopped) break; }
        if (!event.stopped && type === 'click') counts.clicks.push(target.id);
        if (!event.stopped && type === 'keydown') counts.keys.push(event.keyCode);
        return event;
    }
    function globalEvent(type) { for (const fn of windowListeners.get(type) || []) fn({type}); }
    vm.runInNewContext(source, {window, console, Date, Math, JSON, Object, Number, isFinite}, {filename: 'hd-mobile-city.js'});
    const host = window.BayeHdMobileCity;
    host.init();
    return {host, window, document, data, state, counts, nodes, timers, listeners, subscribers, cityButton, dialogButton,
        modeButton, outside, lcd, body, fire, globalEvent,
        identity(value) { identity = {...identity, ...value}; },
        cover(value) { topOverride = value; },
        tap(target = cityButton, values = {}) { fire('pointerdown', target, values); fire('pointerup', target, values); return fire('click', target, values); },
        dialog(owner = 'report') {
            state.cityActive = false; state.dialogActive = true; state.dialogOwner = owner;
            data.g_hdMenuActive = 0;
            data.g_hdReportActive = owner === 'report' ? 1 : 0;
            data.g_hdQtyActive = owner === 'qty' ? 1 : 0;
            data.g_hdHelpActive = owner === 'help' ? 1 : 0;
            host.refresh();
        }};
}

test('initialization is idempotent and configures city before dialog', () => {
    const f = fixture(); f.host.init(); f.host.init();
    assert.deepEqual(f.counts.configured, ['city', 'dialog', 'dialog-start']);
    assert.equal(f.timers.size, 1); assert.equal(f.listeners.get('click').length, 1);
    assert.equal(f.host.snapshot().cityVisible, true); assert.equal(f.body.attrs['data-hd-mobile-lcd'], 'off');
    assert.equal(f.nodes.get('hd-mobile-exit').disabled, true);
});
test('one trusted DOWN-UP authorizes exactly one compatibility click', () => {
    const f = fixture(); f.tap(); f.fire('click'); assert.deepEqual(f.counts.clicks, ['city-button']);
    assert.equal(f.counts.serializedData, 0);
});
test('bare click and untrusted pointer sequence cannot authorize shared handlers', () => {
    const f = fixture(); assert.equal(f.fire('click').prevented, true); f.tap(f.cityButton, {isTrusted: false});
    assert.deepEqual(f.counts.clicks, []);
});
test('another target cannot consume a release grant', () => {
    const f = fixture(); f.fire('pointerdown'); f.fire('pointerup'); f.fire('click', f.dialogButton);
    f.fire('click'); assert.deepEqual(f.counts.clicks, []);
});
test('wrong pointer ID and nonprimary pointer cannot complete a tap', () => {
    const f = fixture(); f.fire('pointerdown'); f.fire('pointerup', f.cityButton, {pointerId: 2}); f.fire('click');
    f.fire('pointercancel'); f.tap(f.cityButton, {isPrimary: false}); assert.deepEqual(f.counts.clicks, []);
});
test('second finger outside the shell blocks all fingers until every one lifts', () => {
    const f = fixture(); f.fire('pointerdown'); f.fire('pointerdown', f.outside, {pointerId: 2, isPrimary: false});
    f.fire('pointerup'); f.fire('click'); f.fire('pointerdown'); f.fire('pointerup'); f.fire('click');
    assert.deepEqual(f.counts.clicks, []); f.fire('pointerup', f.outside, {pointerId: 2, isPrimary: false});
    f.tap(); assert.deepEqual(f.counts.clicks, ['city-button']);
});
for (const event of ['pointercancel', 'lostpointercapture', 'scroll']) {
    test(`${event} retires the gesture and rejects the later compatibility click`, () => {
        const f = fixture(); f.fire('pointerdown'); f.fire(event); f.fire('pointerup'); f.fire('click');
        assert.deepEqual(f.counts.clicks, []); assert.ok(f.counts.retire.length >= 2);
    });
}
test('drag distance is checked both during movement and at release', () => {
    const f = fixture(); f.fire('pointerdown'); f.fire('pointermove', f.cityButton, {clientX: 170}); f.fire('pointerup'); f.fire('click');
    f.fire('pointerdown'); f.fire('pointerup', f.cityButton, {clientX: 170}); f.fire('click'); assert.deepEqual(f.counts.clicks, []);
});
test('geometry change after DOWN retires input while subpixel jitter remains bounded', () => {
    const f = fixture(); f.fire('pointerdown'); f.cityButton.rect.left += 1; f.fire('pointerup'); f.fire('click');
    assert.deepEqual(f.counts.clicks, []); f.fire('pointerdown'); f.cityButton.rect.left += 0.1; f.fire('pointerup'); f.fire('click');
    assert.deepEqual(f.counts.clicks, ['city-button']);
});
for (const field of ['g_hdMenuSeq', 'g_hdMenuIndex', 'g_hdDetailGeneration', 'g_hdMapCity', 'g_hdMarchInputSeq']) {
    test(`${field} change invalidates the full native-owner ticket`, () => {
        const f = fixture(); f.fire('pointerdown'); f.data[field]++; f.fire('pointerup'); f.fire('click'); assert.deepEqual(f.counts.clicks, []);
    });
}
test('name and full U16 person ID changes invalidate an otherwise identical menu', () => {
    for (const change of [f => { f.state.names[1] = '王平'; }, f => { f.state.ids[1] = 1040; }]) {
        const f = fixture(); f.fire('pointerdown'); change(f); f.fire('pointerup'); f.fire('click'); assert.deepEqual(f.counts.clicks, []);
    }
});
test('library generation or native data reference rebinding rejects old input', () => {
    for (const change of [f => f.identity({generation: 3}), f => { f.window.baye.data = {...f.data}; }]) {
        const f = fixture(); f.fire('pointerdown'); change(f); f.fire('pointerup'); f.fire('click'); assert.deepEqual(f.counts.clicks, []);
    }
});
test('ticket data is required by identity and never JSON serialized', () => {
    const f = fixture(); f.state.ticketHook = ticket => ({...ticket, data: {}}); f.tap(); assert.deepEqual(f.counts.clicks, []);
    assert.equal(f.counts.serializedData, 0);
});
test('missing fields, invalid standard identity and torn publication fail closed', () => {
    for (const change of [f => { delete f.data.g_hdHelpInputSeq; }, f => f.identity({sha256: 'bad'}),
        f => { f.state.menuHook = () => { f.data.g_hdMenuSeq++; }; }]) {
        const f = fixture(); change(f); f.host.refresh(); f.tap();
        assert.equal(f.host.snapshot().cityVisible, false); assert.deepEqual(f.counts.clicks, []);
    }
});
for (const event of ['resize', 'orientationchange', 'blur', 'pagehide']) {
    test(`${event} cancels input; recovery cannot revive the old press`, () => {
        const f = fixture(); f.fire('pointerdown'); f.globalEvent(event);
        if (event === 'blur') f.globalEvent('focus');
        if (event === 'pagehide') f.globalEvent('pageshow');
        f.fire('pointerup'); f.fire('click'); assert.deepEqual(f.counts.clicks, []);
        f.tap(); assert.deepEqual(f.counts.clicks, ['city-button']);
    });
}
test('hidden and portrait boundaries hide HD without reviving old gestures', () => {
    const f = fixture(); f.fire('pointerdown'); f.document.hidden = true; f.fire('visibilitychange');
    assert.equal(f.host.isActive(), false); assert.equal(f.timers.size, 0);
    f.document.hidden = false; f.fire('visibilitychange'); f.fire('pointerup'); f.fire('click');
    assert.deepEqual(f.counts.clicks, []);
    f.window.innerWidth = 390; f.window.innerHeight = 844; f.globalEvent('orientationchange');
    assert.equal(f.host.snapshot().cityVisible, false); assert.equal(f.window.BayeHdCityMenu.options.isAvailable(), false);
});
test('ancestor opacity, obstruction and disabled actions reject taps', () => {
    for (const change of [f => { f.nodes.get('hd-city-menu').style.opacity = '0'; }, f => f.cover(f.outside),
        f => { f.cityButton.disabled = true; }]) {
        const f = fixture(); change(f); f.tap(); assert.deepEqual(f.counts.clicks, []);
    }
});
test('LCD on and passthrough remove opaque city shell and preserve native keyboard', () => {
    for (const presentation of ['on', 'passthrough']) {
        const f = fixture(); f.state.cityLcd = presentation; f.host.refresh();
        assert.equal(f.host.isActive(), true); assert.equal(f.body.classList.contains('hd-mobile-city-on'), false);
        assert.equal(f.body.attrs['data-hd-mobile-lcd'], presentation);
        assert.equal(f.fire('keydown', f.lcd, {key: 'Escape', keyCode: 27}).prevented, false);
        f.tap(); assert.deepEqual(f.counts.clicks, []);
    }
});
for (const owner of ['report', 'qty', 'help']) {
    test(`dialog ${owner} uses its independent current owner ticket`, () => {
        const f = fixture(); f.dialog(owner); f.tap(f.dialogButton);
        assert.deepEqual(f.counts.clicks, ['dialog-button']); assert.equal(f.host.snapshot().cityVisible, false);
        assert.equal(f.host.snapshot().dialogVisible, true); assert.equal(f.counts.serializedData, 0);
    });
}
test('report seq, quantity value/session and help input retirement reject old dialog presses', () => {
    for (const [owner, field] of [['report', 'g_hdReportInputSeq'], ['qty', 'g_hdQtyValue'], ['qty', 'g_hdQtySession'], ['help', 'g_hdHelpInputSeq']]) {
        const f = fixture(); f.dialog(owner); f.fire('pointerdown', f.dialogButton); f.data[field]++;
        f.fire('pointerup', f.dialogButton); f.fire('click', f.dialogButton); assert.deepEqual(f.counts.clicks, []);
    }
});
test('empty report publication stays in native passthrough', () => {
    const f = fixture(); f.dialog(); f.state.text = ''; f.host.refresh(); f.tap(f.dialogButton);
    assert.equal(f.host.snapshot().dialogVisible, false); assert.equal(f.body.attrs['data-hd-mobile-lcd'], 'passthrough');
    assert.deepEqual(f.counts.clicks, []);
});
test('trusted keyboard DOWN-UP authorizes one button click and swallows native Enter', () => {
    const f = fixture(); const down = f.fire('keydown', f.cityButton, {key: 'Enter', keyCode: 13});
    f.fire('keydown', f.cityButton, {key: 'Enter', keyCode: 13, repeat: true});
    f.fire('keyup', f.cityButton, {key: 'Enter', keyCode: 13}); f.fire('click');
    assert.equal(down.prevented, true); assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.clicks, ['city-button']);
});
test('stale keyboard owner, missing DOWN and untrusted activation cannot click', () => {
    const f = fixture(); f.fire('keyup', f.cityButton, {key: 'Enter', keyCode: 13});
    f.fire('keydown', f.cityButton, {key: 'Enter', keyCode: 13}); f.data.g_hdMenuSeq++;
    f.fire('keyup', f.cityButton, {key: 'Enter', keyCode: 13});
    f.fire('keydown', f.cityButton, {key: 'Enter', keyCode: 13, isTrusted: false});
    f.fire('keyup', f.cityButton, {key: 'Enter', keyCode: 13, isTrusted: false}); assert.deepEqual(f.counts.clicks, []);
});
test('presentation toggle is zero-input and available even with incomplete native menu', () => {
    const f = fixture(); f.state.names = []; f.host.refresh();
    assert.equal(f.modeButton.disabled, false); assert.equal(f.host.snapshot().cityVisible, false);
    f.tap(f.modeButton); assert.deepEqual(f.counts.modes, ['classic']); assert.deepEqual(f.counts.keys, []);
    f.tap(f.modeButton); assert.deepEqual(f.counts.modes, ['classic', 'hd']);
    assert.equal(f.host.snapshot().cityVisible, false);
});
test('presentation toggle tolerates native menu change but never crosses a LIB generation', () => {
    const f = fixture(); f.fire('pointerdown', f.modeButton); f.data.g_hdMenuSeq++; f.host.refresh();
    f.fire('pointerup', f.modeButton); f.fire('click', f.modeButton); assert.deepEqual(f.counts.modes, ['classic']);
    f.fire('pointerdown', f.modeButton); f.identity({generation: 3});
    f.fire('pointerup', f.modeButton); f.fire('click', f.modeButton); assert.deepEqual(f.counts.modes, ['classic']);
});
