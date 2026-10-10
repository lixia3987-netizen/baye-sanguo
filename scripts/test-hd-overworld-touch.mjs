import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Execute the maintained input functions. Rendering and native entry are
// isolated so assertions count requested actions, never fabricate engine ACKs.
const source = readFileSync(new URL('../js/hd-overworld.js', import.meta.url), 'utf8');
const instrumented = source.replace(/\}\)\(window\);\s*$/, `
    global.__touch = {state: state, bind: bindInput, hit: hitCity, point: eventToDesign,
        reset: resetPan, dimensions: function (w, h) { DESIGN_W = w; DESIGN_H = h; },
        configure: function () {
            mapAuthorized = function () { return global.fixture.allowed; };
            mapInputAuthorized = function () {
                if (global.fixture.onAuthorize) { global.fixture.onAuthorize(); }
                return global.fixture.allowed;
            };
            engineData = function () { return global.fixture.raw; };
            readIdentity = function () { return global.fixture.identity; };
            libraryAllowed = function () { return global.fixture.libraryAllowed; };
            battleCoversMapCanvas = function () { return global.fixture.battle; };
            fightLive = function () { return !!global.fixture.raw.g_hdFightActive; };
            cityMenuMarching = battleMakePending = engineGetCitySetPending = function () {
                return global.fixture.raw.g_hdMarchPhase === 4;
            };
            cityMenuHoldMenu = cityMenuHoldExit = function () { return false; };
            inGameOverworld = function () { return true; };
            openClassicCity = function (i) { global.recordAction('open', i); };
            marchTapCity = function (i) { global.recordAction('target', i); };
            leaveClassicMenu = function () { global.recordAction('leave'); };
            clampCamera = function () {};
            state.mode = 'hd-map'; state.phase = 'map'; state.canvas = global.canvas;
            state.cities = global.fixture.cities; state.assetGeneration = 1;
            state.mobile = global.fixture.mobile;
            DESIGN_W = global.fixture.designW; DESIGN_H = global.fixture.designH;
        }};
})(window);`);
assert.notEqual(instrumented, source, 'test export must attach to the real module');

function harness({ mobile = true, width = 384, height = 216 } = {}) {
    const docHandlers = new Map(), winHandlers = new Map(), handlers = new Map(), captured = new Set();
    const actions = [], classes = new Set(), rect = { left: 0, top: 0, width, height };
    const raw = { g_hdDetailGeneration: 9, g_hdMapInputSeq: 12, g_hdMapPick: 1, g_hdBattlePick: 0,
        g_hdMapCity: 1, g_hdMarchPhase: 0, g_hdMarchSession: 0, g_hdMarchInputSeq: 0,
        g_hdMenuActive: 0, g_hdMenuContext: 0, g_hdMenuKind: 0, g_hdMenuSeq: 20,
        g_hdReportActive: 0, g_hdHelpActive: 0, g_hdQtyActive: 0, g_hdFightActive: 0 };
    const fixture = { raw, mobile, allowed: true, libraryAllowed: true, battle: false,
        identity: { generation: 3, sha256: 'verified-standard-library' },
        designW: mobile ? width : 1920, designH: mobile ? height : 1080,
        cities: [{ index: 0, hdX: 100, hdY: 100, labelX: 100, labelY: 150 }] };
    function listen(store, name, fn) {
        if (!store.has(name)) store.set(name, []);
        store.get(name).push(fn);
    }
    const canvas = { nodeType: 1, getBoundingClientRect: () => rect,
        classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
        addEventListener: (name, fn) => listen(handlers, name, fn),
        setPointerCapture: id => captured.add(id), releasePointerCapture: id => captured.delete(id) };
    const document = { hidden: false, documentElement: { setAttribute() {} },
        addEventListener: (name, fn) => listen(docHandlers, name, fn),
        elementFromPoint: () => fixture.top || canvas };
    const context = vm.createContext({ document, canvas, fixture, actions,
        recordAction: (...args) => actions.push(args),
        getComputedStyle: node => node.testStyle || { display: 'block', visibility: 'visible', opacity: '1' },
        console: { warn() {}, log() {} }, localStorage: { getItem: () => 'classic' },
        addEventListener: (name, fn) => listen(winHandlers, name, fn), clearTimeout() {},
        sendKey() { throw new Error('input fixture must never write native keys'); },
        _bayeSendTouchEvent() { throw new Error('map gestures must not synthesize native touch events'); } });
    context.window = context;
    vm.runInContext(instrumented, context, { filename: 'js/hd-overworld.js' });
    const api = context.__touch;
    api.configure(); api.bind();
    function fire(type, options = {}) {
        const event = { type, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
            clientX: 100, clientY: 100, target: canvas, prevented: false,
            preventDefault() { this.prevented = true; }, ...options };
        for (const callback of docHandlers.get(type) || []) callback(event);
        if (event.target === canvas || captured.has(event.pointerId)) {
            for (const callback of handlers.get(type) || []) callback(event);
        }
        return event;
    }
    function lifecycle(name) {
        for (const callback of winHandlers.get(name) || []) callback();
    }
    function hidden(value) {
        document.hidden = value;
        for (const callback of docHandlers.get('visibilitychange') || []) callback();
    }
    function tap(options = {}) { fire('pointerdown', options); fire('pointerup', options); fire('click', options); }
    return { api, state: api.state, fixture, raw, canvas, document, rect, actions, fire, tap, lifecycle, hidden, captured };
}

test('a current native MAP DOWN/UP opens once; no action at DOWN or compatibility click', () => {
    const h = harness(); h.fire('pointerdown'); assert.deepEqual(h.actions, []);
    h.fire('pointerup'); h.fire('click'); h.fire('click'); assert.deepEqual(h.actions, [['open', 0]]);
});

test('bare clicks, right mouse buttons and non-primary pointers cannot enter a city', () => {
    for (const kind of ['click', 'right', 'secondary']) {
        const h = harness();
        if (kind === 'click') h.fire('click');
        else h.tap(kind === 'right' ? { pointerType: 'mouse', button: 2 } : { isPrimary: false });
        assert.deepEqual(h.actions, [], kind);
    }
});

test('drag, including returning to the start, consumes UP and compatibility click', () => {
    const h = harness(); h.fire('pointerdown'); h.fire('pointermove', { clientX: 111 });
    h.fire('pointermove'); h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, []);
    h.tap(); assert.deepEqual(h.actions, [['open', 0]], 'next fresh tap remains usable');
});

test('small tap jitter stays a tap in client pixels', () => {
    const h = harness(); h.fire('pointerdown'); h.fire('pointermove', { clientX: 106 });
    h.fire('pointerup', { clientX: 106 }); assert.deepEqual(h.actions, [['open', 0]]);
});

test('UP beyond the drag threshold is rejected even if no pointermove was delivered', () => {
    const h = harness(); h.fire('pointerdown'); h.fire('pointerup', { clientX: 120 }); h.fire('click');
    assert.deepEqual(h.actions, []);
});

test('pointercancel and lost capture cannot become a click, and a new gesture works', () => {
    for (const type of ['pointercancel', 'lostpointercapture']) {
        const h = harness(); h.fire('pointerdown'); h.fire(type); h.fire('pointerup'); h.fire('click');
        assert.deepEqual(h.actions, [], type); assert.equal(h.captured.size, 0);
        h.tap(); assert.deepEqual(h.actions, [['open', 0]]);
    }
});

test('an unrelated pointer UP cannot end the active gesture', () => {
    const h = harness(); h.fire('pointerdown'); h.fire('pointerup', { pointerId: 7 });
    assert.deepEqual(h.actions, []); h.fire('pointerup'); assert.deepEqual(h.actions, [['open', 0]]);
});

for (const outside of [false, true]) {
    test(`a second finger ${outside ? 'outside' : 'inside'} the canvas cancels until all lift`, () => {
        const h = harness(); const target = outside ? {} : h.canvas;
        h.fire('pointerdown'); h.fire('pointerdown', { pointerId: 2, isPrimary: false, target });
        h.fire('pointerup'); h.fire('click');
        h.fire('pointerdown', { pointerId: 3 }); h.fire('pointerup', { pointerId: 3 });
        assert.deepEqual(h.actions, []);
        h.fire('pointerup', { pointerId: 2, isPrimary: false, target });
        h.tap(); assert.deepEqual(h.actions, [['open', 0]]);
    });
}

for (const name of ['blur', 'resize', 'orientationchange', 'pagehide', 'hidden']) {
    test(`${name} retires the gesture and pending alignment without native input`, () => {
        const h = harness(); h.fire('pointerdown'); h.state.aligning = true;
        if (name === 'hidden') h.hidden(true); else h.lifecycle(name);
        assert.equal(h.state.aligning, false); h.fire('pointerup'); h.fire('click');
        assert.deepEqual(h.actions, []); if (name === 'hidden') h.hidden(false);
        h.tap(); assert.deepEqual(h.actions, [['open', 0]]);
    });
}

test('geometry is anchored at DOWN; repeated subpixel drift cannot accumulate', () => {
    const h = harness(); h.fire('pointerdown'); h.rect.left = 0.3; h.fire('pointermove');
    h.rect.left = 0.6; h.fire('pointermove'); h.fire('pointerup'); h.fire('click');
    assert.deepEqual(h.actions, []);
});

test('changing CSS dimensions or design dimensions after DOWN cannot confirm', () => {
    for (const change of ['rect', 'design']) {
        const h = harness(); h.fire('pointerdown');
        if (change === 'rect') h.rect.width += 30; else h.api.dimensions(500, 300);
        h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, [], change);
    }
});

test('leaving the rectangle or covering the canvas before UP cancels the tap', () => {
    for (const change of ['outside', 'covered']) {
        const h = harness(); h.fire('pointerdown');
        if (change === 'covered') h.fixture.top = {};
        h.fire('pointerup', change === 'outside' ? { clientX: -1 } : {});
        h.fire('click'); assert.deepEqual(h.actions, [], change);
    }
});

test('MAP sequence, generation, asset identity or library identity changes retire the old DOWN', () => {
    for (const change of ['map-seq', 'generation', 'asset', 'library', 'mode', 'phase']) {
        const h = harness(); h.fire('pointerdown');
        if (change === 'map-seq') h.raw.g_hdMapInputSeq++;
        if (change === 'generation') h.raw.g_hdDetailGeneration++;
        if (change === 'asset') h.state.assetGeneration++;
        if (change === 'library') h.fixture.identity.generation++;
        if (change === 'mode') h.state.mode = 'classic';
        if (change === 'phase') h.state.phase = 'other';
        h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, [], change);
    }
});

test('report, help, quantity, fight and foreign native menus cannot reuse a MAP gesture', () => {
    for (const field of ['g_hdReportActive', 'g_hdHelpActive', 'g_hdQtyActive', 'g_hdFightActive',
        'g_hdMenuActive', 'g_hdBattlePick']) {
        const h = harness(); h.fire('pointerdown'); h.raw[field] = 1;
        h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, [], field);
    }
});

test('missing, fractional and malformed native owner values fail closed at DOWN', () => {
    for (const value of [undefined, NaN, Infinity, -1, 0, 1.5, '12']) {
        const h = harness(); h.raw.g_hdMapInputSeq = value; h.tap(); assert.deepEqual(h.actions, [], String(value));
    }
    const h = harness(); delete h.raw.g_hdQtyActive; h.tap(); assert.deepEqual(h.actions, []);
    const zero = harness(); zero.raw.g_hdDetailGeneration = 0; zero.tap(); assert.deepEqual(zero.actions, []);
});

test('a native owner torn during authorization cannot issue any action', () => {
    const h = harness(); let reads = 0;
    h.fixture.onAuthorize = () => { if (++reads === 2) h.raw.g_hdMapInputSeq++; };
    h.tap(); assert.deepEqual(h.actions, []);
});

test('rebinding the data object during owner authorization rejects the stale object', () => {
    const h = harness(); let reads = 0;
    h.fixture.onAuthorize = () => { if (++reads === 2) h.fixture.raw = { ...h.raw }; };
    h.tap(); assert.deepEqual(h.actions, []);
});

test('CSS-hidden canvas or ancestor cannot accept UP even if it remains the top hit', () => {
    for (const parent of [false, true]) {
        const h = harness(); h.fire('pointerdown');
        const node = parent ? (h.canvas.parentElement = { nodeType: 1 }) : h.canvas;
        node.testStyle = { display: 'block', visibility: 'visible', opacity: '0' };
        h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, []);
    }
});

test('march target selection waits for the same native phase4 ticket and valid UP', () => {
    const h = harness(); h.raw.g_hdMarchPhase = 4; h.raw.g_hdBattlePick = 1;
    h.fire('pointerdown'); assert.deepEqual(h.actions, []);
    h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, [['target', 0]]);
});

test('march drag and HUD pointerdown cannot take the old document-capture shortcut', () => {
    const h = harness(); h.raw.g_hdMarchPhase = 4; h.raw.g_hdBattlePick = 1;
    h.fire('pointerdown', { target: {} }); h.fire('pointerup', { target: {} }); assert.deepEqual(h.actions, []);
    h.fire('pointerdown'); h.fire('pointermove', { clientX: 120 }); h.fire('pointerup'); h.fire('click');
    assert.deepEqual(h.actions, []);
});

test('desktop actual city root menu retains tap-city and blank-map exit behavior', () => {
    for (const blank of [false, true]) {
        const h = harness({ mobile: false, width: 1920, height: 1080 });
        h.state.phase = 'classic-menu'; h.raw.g_hdMapPick = 0;
        h.raw.g_hdMenuActive = 1; h.raw.g_hdMenuContext = 1; h.raw.g_hdMenuKind = 1;
        h.tap(blank ? { clientX: 1000, clientY: 700, pointerType: 'mouse' } : { pointerType: 'mouse' });
        assert.deepEqual(h.actions, blank ? [['leave']] : [['open', 0]]);
    }
});

test('mobile does not reuse a classic city menu ticket as native MAP input', () => {
    const h = harness(); h.state.phase = 'classic-menu'; h.raw.g_hdMapPick = 0;
    h.raw.g_hdMenuActive = 1; h.raw.g_hdMenuContext = 1; h.raw.g_hdMenuKind = 1;
    h.tap(); assert.deepEqual(h.actions, []);
});

test('mobile city and label hits include the full 44 CSS pixel diameter at different backing scales', () => {
    for (const scale of [1, 2, 5]) {
        const h = harness(); h.api.dimensions(h.rect.width * scale, h.rect.height * scale);
        h.fixture.cities[0].hdX = 100 * scale; h.fixture.cities[0].hdY = 100 * scale;
        h.fixture.cities[0].labelX = 250 * scale; h.fixture.cities[0].labelY = 150 * scale;
        for (const [x, y] of [[78, 100], [122, 100], [100, 78], [100, 122], [228, 150], [272, 150]]) {
            assert.equal(h.api.hit(h.api.point({ clientX: x, clientY: y })), 0, `${scale}: ${x},${y}`);
        }
        assert.equal(h.api.hit(h.api.point({ clientX: 122.01, clientY: 100 })), -1);
    }
});

test('overlapping touch targets choose the nearest actual city deterministically', () => {
    const h = harness(); h.fixture.cities[0].labelX = 1000;
    h.fixture.cities.push({ index: 1, hdX: 130, hdY: 100, labelX: 1000, labelY: 1000 });
    assert.equal(h.api.hit({ x: 110, y: 100 }), 0); assert.equal(h.api.hit({ x: 120, y: 100 }), 1);
});

test('desktop retains the old 52-design-unit city radius rather than a mobile CSS radius', () => {
    const h = harness({ mobile: false }); h.fixture.cities[0].labelX = 1000;
    assert.equal(h.api.hit({ x: 151, y: 100 }), 0); assert.equal(h.api.hit({ x: 153, y: 100 }), -1);
});

test('non-finite and zero rectangles, invalid coordinates and points outside the canvas are rejected', () => {
    for (const bad of [0, NaN, Infinity]) {
        const h = harness(); h.rect.width = bad; assert.equal(h.api.point({ clientX: 100, clientY: 100 }), null);
    }
    const h = harness();
    for (const point of [{ clientX: NaN, clientY: 100 }, { clientX: 100, clientY: Infinity },
        { clientX: -1, clientY: 100 }, { clientX: h.rect.width, clientY: 100 }]) assert.equal(h.api.point(point), null);
    assert.equal(h.api.hit({ x: NaN, y: 100 }), -1);
});

// Native baye_hd_march_end(1) retains phase7 after successful departure.
// It grants no authority by itself: the actual MAP/menu owner remains required.
test('terminal march7 with a current native MAP opens once only at fresh UP', () => {
    for (const mobile of [true, false]) {
        const h = harness({mobile,width:mobile?384:1920,height:mobile?216:1080}); h.raw.g_hdMarchPhase = 7;
        h.fire('pointerdown'); assert.deepEqual(h.actions, []);
        h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, [['open', 0]]);
    }
});

test('MAP cannot borrow active march phases1..6 or unknown phase values', () => {
    for (const phase of [1, 2, 3, 4, 5, 6, 8, 255, 4294967295, undefined, NaN, -1, 7.5, '7']) {
        const h = harness(); h.raw.g_hdMarchPhase = phase; h.tap(); assert.deepEqual(h.actions, [], String(phase));
    }
});

test('terminal march7 never grants input when pick, modal, library or lifecycle owner is unavailable', () => {
    for (const field of ['g_hdMapPick', 'g_hdBattlePick', 'g_hdMenuActive', 'g_hdReportActive', 'g_hdHelpActive', 'g_hdQtyActive', 'g_hdFightActive']) {
        const h = harness(); h.raw.g_hdMarchPhase = 7; h.raw[field] = field === 'g_hdMapPick' ? 0 : 1;
        h.tap(); assert.deepEqual(h.actions, [], field);
    }
    for (const boundary of ['identity', 'mode', 'hidden', 'battle']) {
        const h = harness(); h.raw.g_hdMarchPhase = 7;
        if (boundary === 'identity') h.fixture.libraryAllowed = false;
        if (boundary === 'mode') h.state.mode = 'classic';
        if (boundary === 'hidden') h.hidden(true);
        if (boundary === 'battle') h.fixture.battle = true;
        h.tap(); assert.deepEqual(h.actions, [], boundary);
    }
});

test('terminal7-to-idle0 and idle0-to-terminal7 changes reject the old pointer ticket', () => {
    for (const [before, after] of [[7, 0], [0, 7]]) {
        const h = harness(); h.raw.g_hdMarchPhase = before; h.fire('pointerdown'); h.raw.g_hdMarchPhase = after;
        h.fire('pointerup'); h.fire('click'); assert.deepEqual(h.actions, []);
        h.tap(); assert.deepEqual(h.actions, [['open', 0]], 'a new current ticket works');
    }
});

test('march phase torn during either owner double read is rejected even when both phases are idle', () => {
    for (const flipAt of [2, 4]) {
        const h = harness(); h.raw.g_hdMarchPhase = 7; let reads = 0;
        h.fixture.onAuthorize = () => { if (++reads === flipAt) h.raw.g_hdMarchPhase = 0; };
        h.tap(); assert.deepEqual(h.actions, [], 'read ' + flipAt);
    }
});

test('retained phase7 allows only the real desktop classic city root; mobile cannot borrow it', () => {
    for (const mobile of [false, true]) for (const blank of [false, true]) {
        const h = harness({mobile,width:1920,height:1080}); h.raw.g_hdMarchPhase = 7;
        h.state.phase = 'classic-menu'; h.raw.g_hdMapPick = 0;
        h.raw.g_hdMenuActive = 1; h.raw.g_hdMenuContext = 1; h.raw.g_hdMenuKind = 1;
        h.tap(blank ? {clientX:1000,clientY:700,pointerType:'mouse'} : {pointerType:'mouse'});
        assert.deepEqual(h.actions, mobile ? [] : blank ? [['leave']] : [['open', 0]]);
    }
    for (const [field,value] of [['g_hdMenuContext',2],['g_hdMenuKind',2],['g_hdMarchPhase',1],['g_hdBattlePick',1]]) {
        const h = harness({mobile:false,width:1920,height:1080}); h.state.phase='classic-menu'; h.raw.g_hdMapPick=0;
        Object.assign(h.raw,{g_hdMarchPhase:7,g_hdMenuActive:1,g_hdMenuContext:1,g_hdMenuKind:1});h.raw[field]=value;
        h.tap();assert.deepEqual(h.actions,[],field);
    }
});
