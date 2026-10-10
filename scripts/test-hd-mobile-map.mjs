// Controlled read-only ABI/DOM VM fixtures; no native C, browser, touch injection or OS execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../js/hd-mobile-map.js', import.meta.url), 'utf8');
const hudSource = readFileSync(new URL('../js/hd-mobile.js', import.meta.url), 'utf8');
const sha = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
function fixture() {
    const listeners = new Map(), globalListeners = new Map(), timers = new Map(), subscribers = [];
    const counts = {mount: 0, start: 0, sharedCancel: 0, nativeCancel: 0, centers: [], keys: [], debug: 0};
    function element() {
        const events = new Map(), attrs = {}, classes = new Set();
        return {hidden: false, disabled: false, textContent: '', attrs, events,
            addEventListener(name, fn) { const list = events.get(name) || []; list.push(fn); events.set(name, list); },
            setAttribute(name, value) { attrs[name] = value; },
            classList: {toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name)},
            fire(name, values = {}) { const ev = {type: name, pointerId: 1, isPrimary: true, button: 0,
                preventDefault() {}, stopPropagation() {}, ...values}; for (const fn of events.get(name) || []) fn(ev); return ev; }};
    }
    const nodes = new Map();
    for (const id of ['hd-overworld', 'hd-mobile-map-mode', 'hd-mobile-map-focus', 'hd-mobile-exit', 'hd-mobile-map-tip',
        'hd-mobile-hud', 'hd-mobile-status', 'hd-mobile-city', 'hd-mobile-owner', 'hd-mobile-date',
        'hd-mobile-money', 'hd-mobile-food', 'hd-mobile-arms']) nodes.set(id, element());
    const document = {hidden: false, body: element(), getElementById: id => nodes.get(id) || null,
        addEventListener(name, fn) { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list); }};
    const data = {g_hdEngineReady: 1, g_hdMapPick: 1, g_hdMapCity: 17, g_hdMapInputSeq: 8,
        g_hdDetailGeneration: 4, g_hdSpeGeneration: 4, g_hdMenuActive: 0, g_hdMenuContext: 1,
        g_hdMenuKind: 1, g_hdMenuSeq: 12, g_hdMenuCount: 4, g_hdMenuIndex: 0,
        g_hdBattlePick: 0, g_hdMarchPhase: 0, g_hdReportActive: 0, g_hdQtyActive: 0,
        g_hdFightActive: 0, g_hdHelpActive: 0, g_hdRecordActive: 0, g_hdMovieActive: 0,
        g_hdSpeActive: 0, g_hdSkillActive: 0, g_hdAttackActive: 0, g_hdSkillResultActive: 0,
        g_hdMakerActive: 0, g_hdViewActive: 0, g_hdMiniMapActive: 0, g_hdGoodsActive: 0,
        g_hdPersonPropertiesActive: 0, g_hdResultOwnerKind: 0, g_hdResultOwnerValid: 0,
        g_hdReportSeq: 3, g_hdReportInputSeq: 6, g_hdQtySession: 4, g_hdQtyInputSeq: 2,
        g_hdFightInputSeq: 20, g_hdHelpInputSeq: 3, g_hdRecordSeq: 2, g_hdMarchSession: 5,
        g_hdMarchInputSeq: 11, g_PIdx: 4, g_YearDate: 236, g_MonthDate: 6,
        g_Cities: Array.from({length: 38}, () => ({Belong: 1, Money: 2000, Food: 1500, MothballArms: 500})),
        g_Persons: Array.from({length: 2000}, () => ({Arms: 100}))};
    let identity = {status: 'ready', generation: 2, sha256: sha, byteLength: 207195, reason: ''};
    let currentMode = 'hd-map', ready = true;
    const state = {presentationReady: true, mode: 'hd-map', phase: 'map', selectedIndex: -1};
    const cities = Array.from({length: 38}, (_, index) => ({index, name: '城' + index, kind: 'owned'}));
    const shared = {applyMobilePage() { counts.mount++; }, start() { counts.start++; },
        getMode: () => currentMode, setMode(value) { currentMode = value; state.mode = value; },
        debugSnapshot() { counts.debug++; return {...state}; },
        getCities: () => cities, centerOnCity(index) { counts.centers.push(index); }, cancelInteraction() { counts.sharedCancel++; }};
    const window = {document, innerWidth: 800, innerHeight: 450, BayeHdOverworld: shared,
        BayeHdLibIdentity: {read: () => identity, isCurrent: candidate => candidate.status === identity.status &&
            candidate.generation === identity.generation && candidate.sha256 === identity.sha256,
            subscribe(fn) { subscribers.push(fn); return () => {}; }},
        baye: {data, hd: {ready: () => ready}, ensureData: () => window.baye.data,
            getCityName: () => '许昌', getPersonName: () => '曹丕'},
        mobileTouch: {cancel() { counts.nativeCancel++; }}, VK_EXIT: 0x28,
        sendKey(code) { counts.keys.push(code); },
        setInterval(fn, ms) { const id = timers.size + 1; timers.set(id, {fn, ms}); return id; },
        clearInterval(id) { timers.delete(id); },
        addEventListener(name, fn) { const list = globalListeners.get(name) || []; list.push(fn); globalListeners.set(name, list); },
        localStorage: new Proxy({}, {get() { throw Error('adapter must not access preferences'); }, set() { throw Error('adapter must not write preferences'); }})};
    vm.runInNewContext(hudSource + '\n' + source, {window});
    const api = window.BayeHdMobileMap;
    function notify(name) { for (const fn of listeners.get(name) || []) fn(); }
    return {api, window, data, nodes, document, state, cities, shared, counts, timers, listeners, globalListeners,
        setIdentity(value) { identity = {...identity, ...value}; }, setReady(value) { ready = value; },
        identityChanged(value) { identity = {...identity, ...value}; for (const fn of subscribers.slice()) fn(identity); },
        visibility(value) { document.hidden = value; notify('visibilitychange'); },
        resize(w, h) { window.innerWidth = w; window.innerHeight = h; for (const fn of globalListeners.get('resize') || []) fn(); },
        menu(kind = 1) { data.g_hdMapPick = 0; data.g_hdMenuActive = 1; data.g_hdMenuContext = 1;
            data.g_hdMenuKind = kind; state.phase = 'classic-menu'; return api.refresh(); },
        releaseExit(values = {}) { nodes.get('hd-mobile-exit').fire('pointerdown', values); nodes.get('hd-mobile-exit').fire('pointerup', values); },
        documentPointer(id) { for (const fn of listeners.get('pointerdown') || []) fn({pointerId: id}); }};
}
function off(f) { assert.equal(f.api.refresh().active, false); assert.equal(f.nodes.get('hd-overworld').hidden, true);
    assert.equal(f.document.body.classList.contains('hd-mobile-map-on'), false); }

test('mounts shared implementation once and centers the current strict HUD city once per LIB generation', () => {
    const f = fixture(); assert.equal(f.api.init().active, true); f.api.init(); f.api.refresh();
    assert.equal(f.counts.mount, 1); assert.equal(f.counts.start, 1); assert.deepEqual(f.counts.centers, [16]);
    assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0].ms, 80);
    assert.equal(f.nodes.get('hd-overworld').hidden, false);
    assert.equal(f.document.body.classList.contains('hd-mobile-map-on'), true);
    f.data.g_hdMapCity = 18; f.api.refresh(); assert.deepEqual(f.counts.centers, [16]);
    f.identityChanged({generation: 3}); assert.deepEqual(f.counts.centers, [16, 17]);
    assert.deepEqual(f.counts.keys, []);
});
test('menu handoff hides the map immediately without changing native data or a PC preference', () => {
    const f = fixture(); f.api.init(); const before = JSON.stringify(f.data); f.api.refresh();
    assert.equal(JSON.stringify(f.data), before); f.menu(); off(f);
    assert.equal(f.nodes.get('hd-mobile-exit').disabled, false);
    assert.equal(f.counts.nativeCancel, 2); assert.equal(f.counts.sharedCancel, 2);
});

test('HD city local pages own Back and cannot leak a header EXIT into the native root', () => {
    const f = fixture(); f.api.init(); f.menu();
    f.window.BayeHdMobileCity = {isActive: () => true};
    f.api.refresh(); assert.equal(f.nodes.get('hd-mobile-exit').disabled, true);
    f.releaseExit(); assert.deepEqual(f.counts.keys, []);
    f.window.BayeHdMobileCity.isActive = () => false;
    f.api.refresh(); assert.equal(f.nodes.get('hd-mobile-exit').disabled, false);
    f.releaseExit(); assert.deepEqual(f.counts.keys, [0x28]);
});
for (const field of ['g_hdReportActive', 'g_hdQtyActive', 'g_hdFightActive', 'g_hdHelpActive', 'g_hdBattlePick', 'g_hdMakerActive', 'g_hdSpeActive']) {
    test('current native ' + field + ' cannot expose a map or a return control', () => {
        const f = fixture(); f.api.init(); f.data[field] = 1; off(f);
        assert.equal(f.nodes.get('hd-mobile-exit').disabled, true); assert.deepEqual(f.counts.keys, []);
    });
}
test('stale library/identity and ready false close a previously visible map', () => {
    for (const change of [{status: 'pending'}, {sha256: 'f'.repeat(64)}, {byteLength: 1}]) {
        const f = fixture(); f.api.init(); f.identityChanged(change); off(f);
    }
    const f = fixture(); f.api.init(); f.setReady(false); off(f);
});
test('shared presentation, mode and actual phase must all agree', () => {
    for (const change of [{presentationReady: false}, {phase: 'other'}, {mode: 'classic'}]) {
        const f = fixture(); f.api.init(); Object.assign(f.state, change); off(f);
    }
});
test('shared getter changing the native owner invalidates the second strict HUD reading', () => {
    const f = fixture(); f.shared.debugSnapshot = () => { f.data.g_hdMapInputSeq++; return {...f.state}; }; off(f);
    assert.deepEqual(f.counts.centers, []);
});
test('portrait/visibility retire both gestures and pending alignment; returning does not overwrite user pan', () => {
    const f = fixture(); f.api.init(); f.resize(450, 800); off(f);
    assert.equal(f.nodes.get('hd-mobile-exit').disabled, true);
    f.resize(800, 450); assert.equal(f.api.snapshot().active, true); assert.deepEqual(f.counts.centers, [16]);
    f.visibility(true); off(f); assert.equal(f.timers.size, 0);
    const reads = f.counts.debug; f.api.refresh(); assert.equal(f.counts.debug, reads);
    f.visibility(false); assert.equal(f.timers.size, 1); assert.equal(f.api.snapshot().active, true);
    assert.deepEqual(f.counts.centers, [16]); assert.deepEqual(f.counts.keys, []);
});
test('explicit focus is presentation only and uses fresh current HUD city', () => {
    const f = fixture(); f.api.init(); f.data.g_hdMapCity = 18;
    f.nodes.get('hd-mobile-map-focus').fire('click'); assert.deepEqual(f.counts.centers, [16, 17]);
    f.menu(); f.nodes.get('hd-mobile-map-focus').fire('click'); assert.deepEqual(f.counts.centers, [16, 17]);
    assert.deepEqual(f.counts.keys, []);
});
test('mode button delegates to shared mobile preference and retires interaction', () => {
    const f = fixture(); f.api.init(); f.nodes.get('hd-mobile-map-mode').fire('click');
    assert.equal(f.api.snapshot().mode, 'classic'); off(f);
    assert.equal(f.nodes.get('hd-mobile-map-mode').textContent, 'HD 地图');
    f.nodes.get('hd-mobile-map-mode').fire('click'); assert.equal(f.api.snapshot().active, true);
    assert.equal(f.nodes.get('hd-mobile-map-mode').textContent, '经典地图');
    assert.deepEqual(f.counts.keys, []);
});
for (const kind of [1, 2, 3, 4]) {
    test('one current city menu kind ' + kind + ' returns exactly once and waits for owner retirement', () => {
        const f = fixture(); f.api.init(); assert.equal(f.menu(kind).exitEnabled, true);
        f.releaseExit(); f.nodes.get('hd-mobile-exit').fire('click'); f.releaseExit();
        assert.deepEqual(f.counts.keys, [0x28]); assert.equal(f.api.snapshot().exitPending, true);
        assert.equal(f.nodes.get('hd-mobile-exit').disabled, true);
        f.data.g_hdMenuSeq++; f.api.refresh(); assert.equal(f.api.snapshot().exitEnabled, true);
    });
}
test('DOWN/UP cannot cross native menu sequence, context, index or generation', () => {
    for (const mutate of [f => f.data.g_hdMenuSeq++, f => f.data.g_hdMenuContext = 2,
        f => f.data.g_hdMenuIndex++, f => f.data.g_hdDetailGeneration++,
        f => f.data.g_hdReportActive = 1, f => f.setIdentity({generation: 3})]) {
        const f = fixture(); f.api.init(); f.menu(); f.nodes.get('hd-mobile-exit').fire('pointerdown');
        mutate(f); f.nodes.get('hd-mobile-exit').fire('pointerup'); assert.deepEqual(f.counts.keys, []);
    }
});
test('native touch cancel changing an owner before EXIT is checked again', () => {
    const f = fixture(); f.api.init(); f.menu();
    f.window.mobileTouch.cancel = () => { f.data.g_hdMenuSeq++; };
    f.releaseExit(); assert.deepEqual(f.counts.keys, []);
});
test('pointer cancel, wrong pointer and a second touch cannot return from a menu', () => {
    for (const action of [f => f.nodes.get('hd-mobile-exit').fire('pointercancel'),
        f => f.documentPointer(2), f => f.nodes.get('hd-mobile-exit').fire('lostpointercapture')]) {
        const f = fixture(); f.api.init(); f.menu(); f.nodes.get('hd-mobile-exit').fire('pointerdown');
        action(f); f.nodes.get('hd-mobile-exit').fire('pointerup'); assert.deepEqual(f.counts.keys, []);
    }
    const f = fixture(); f.api.init(); f.menu(); f.nodes.get('hd-mobile-exit').fire('pointerdown');
    f.nodes.get('hd-mobile-exit').fire('pointerup', {pointerId: 2}); assert.deepEqual(f.counts.keys, []);
});
test('secondary pointer and compatibility click never generate EXIT', () => {
    const f = fixture(); f.api.init(); f.menu(); f.releaseExit({isPrimary: false});
    f.nodes.get('hd-mobile-exit').fire('click'); assert.deepEqual(f.counts.keys, []);
});
test('keyboard DOWN/UP uses the same owner fence without replaying compatibility click', () => {
    const f = fixture(); f.api.init(); f.menu(); const exit = f.nodes.get('hd-mobile-exit');
    exit.fire('keydown', {key: 'Enter', repeat: false}); exit.fire('keydown', {key: 'Enter', repeat: true});
    exit.fire('keyup', {key: 'Enter'}); exit.fire('click', {detail: 0}); assert.deepEqual(f.counts.keys, [0x28]);
});
test('reports, quantity, fights and system/title menus are not broadened into an EXIT owner', () => {
    for (const change of [{g_hdReportActive: 1}, {g_hdQtyActive: 1}, {g_hdFightActive: 1},
        {g_hdMenuContext: 2}, {g_hdMenuContext: 4}, {g_hdMapPick: 1}, {g_hdMarchPhase: 1}, {g_hdMenuCount: 0}]) {
        const f = fixture(); f.api.init(); f.menu(); Object.assign(f.data, change); f.api.refresh();
        assert.equal(f.api.snapshot().exitEnabled, false); f.releaseExit(); assert.deepEqual(f.counts.keys, []);
    }
});
test('hidden or portrait transition between DOWN/UP cancels the captured return', () => {
    for (const hide of [f => f.visibility(true), f => f.resize(450, 800)]) {
        const f = fixture(); f.api.init(); f.menu(); f.nodes.get('hd-mobile-exit').fire('pointerdown');
        hide(f); f.nodes.get('hd-mobile-exit').fire('pointerup'); assert.deepEqual(f.counts.keys, []);
    }
});
test('blur and pagehide retire a DOWN ticket even when the menu owner remains the same', () => {
    for (const name of ['blur', 'pagehide']) {
        const f = fixture(); f.api.init(); f.menu(); f.nodes.get('hd-mobile-exit').fire('pointerdown');
        for (const fn of f.globalListeners.get(name) || []) fn();
        f.nodes.get('hd-mobile-exit').fire('pointerup'); assert.deepEqual(f.counts.keys, []);
        assert.ok(f.counts.sharedCancel >= 3); assert.ok(f.counts.nativeCancel >= 3);
    }
});

test('snapshot is immutable and does not read native data', () => {
    const f = fixture(); const current = f.api.init(), before = f.counts.debug;
    assert.equal(Object.isFrozen(current), true); assert.equal(f.api.snapshot(), current); assert.equal(f.counts.debug, before);
});
test('missing optional controls fail closed and mounting adds no DOM', () => {
    const f = fixture(); f.nodes.delete('hd-mobile-map-mode'); f.nodes.delete('hd-mobile-map-focus'); f.nodes.delete('hd-mobile-exit');
    assert.equal(f.api.init().active, true); assert.equal(f.nodes.size, 10);
});

test('player tip names a selected non-owned city without exposing shared internal hints', () => {
    const f = fixture(); f.state.selectedIndex = 17; f.state.hint = 'PlayerTactic internal alignment';
    f.cities[17] = {index: 17, name: '下邳', kind: 'enemy'}; f.api.init();
    assert.equal(f.nodes.get('hd-mobile-map-tip').textContent, '下邳不是己方城，请从己方城选择出征');
    f.cities[17].kind = 'owned'; f.api.refresh();
    assert.equal(f.nodes.get('hd-mobile-map-tip').textContent, '拖动地图 · 点己方城进入 · 道路仅作装饰');
    f.cities[17].kind = 'enemy'; f.menu();
    assert.equal(f.nodes.get('hd-mobile-map-tip').textContent, '拖动地图 · 点己方城进入 · 道路仅作装饰');
    assert.deepEqual(f.counts.keys, []);
});
test('optional city tip getter changing the owner invalidates the visible surface', () => {
    const f = fixture(); f.state.selectedIndex = 17;
    f.shared.getCities = () => { f.data.g_hdMapInputSeq++; return f.cities; };
    off(f); assert.deepEqual(f.counts.keys, []);
});

test('native MAP blank ground retains the HD surface while the HUD clears and alignment continues', () => {
    const f = fixture(); f.api.init(); const cancels = f.counts.sharedCancel;
    f.state.aligning = true; f.data.g_hdMapCity = 0;
    assert.equal(f.api.refresh().active, true);
    assert.equal(f.api.snapshot().cityIndex, null);
    assert.equal(f.nodes.get('hd-overworld').hidden, false);
    assert.equal(f.nodes.get('hd-mobile-hud').hidden, true);
    assert.equal(f.nodes.get('hd-mobile-city').textContent, '');
    assert.equal(f.nodes.get('hd-mobile-map-focus').disabled, true);
    assert.equal(f.counts.sharedCancel, cancels, 'blank ground is not an owner retirement');
    f.api.refresh(); assert.equal(f.counts.sharedCancel, cancels);
    assert.deepEqual(f.counts.centers, [16]); assert.deepEqual(f.counts.keys, []);
});
test('first native MAP blank ground never centers a stale city; the first actual city can center later', () => {
    const f = fixture(); f.data.g_hdMapCity = 0;
    assert.equal(f.api.init().active, true); assert.equal(f.api.snapshot().cityIndex, null);
    assert.deepEqual(f.counts.centers, []);
    f.nodes.get('hd-mobile-map-focus').fire('click'); assert.deepEqual(f.counts.centers, []);
    f.data.g_hdMapCity = 18; assert.equal(f.api.refresh().active, true);
    assert.deepEqual(f.counts.centers, [17]); assert.deepEqual(f.counts.keys, []);
});
test('blank ground is authorized only by current native MAP, never shared aligning', () => {
    for (const change of [{g_hdMapPick: 0}, {g_hdMenuActive: 1}, {g_hdBattlePick: 1}, {g_hdMarchPhase: 1},
        {g_hdReportActive: 1}, {g_hdQtyActive: 1}, {g_hdMovieActive: 1}, {g_hdResultOwnerValid: 1}]) {
        const f = fixture(); f.api.init(); f.state.aligning = true; f.data.g_hdMapCity = 0;
        Object.assign(f.data, change); off(f); assert.deepEqual(f.counts.keys, []);
    }
});
test('all native blockers close blank-ground MAP despite an agreeing shared presentation', () => {
    for (const field of ['g_hdFightActive', 'g_hdHelpActive', 'g_hdRecordActive', 'g_hdSpeActive', 'g_hdSkillActive',
        'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdViewActive', 'g_hdMiniMapActive',
        'g_hdGoodsActive', 'g_hdPersonPropertiesActive', 'g_hdResultOwnerKind']) {
        const f = fixture(); f.data.g_hdMapCity = 0; f.data[field] = 1; off(f);
        assert.deepEqual(f.counts.centers, []);
    }
});
test('blank-ground native tickets require actual positive map/detail/SPE generations and integer fence fields', () => {
    for (const change of [{g_hdMapInputSeq: 0}, {g_hdDetailGeneration: 0}, {g_hdSpeGeneration: 0},
        {g_hdMapInputSeq: '8'}, {g_hdReportSeq: NaN}, {g_hdHelpInputSeq: undefined},
        {g_hdMapCity: -1}, {g_hdMapCity: 39}, {g_hdMapCity: 0.5}]) {
        const f = fixture(); f.data.g_hdMapCity = 0; Object.assign(f.data, change); off(f);
        assert.deepEqual(f.counts.keys, []);
    }
});
test('stable but forged city HUD tickets cannot authorize a current native MAP', () => {
    for (const key of ['libraryGeneration', 'generation', 'speGeneration', 'mapInputSeq', 'mapCity']) {
        const f = fixture(); const original = f.window.BayeHdMobile.refresh;
        f.window.BayeHdMobile = {...f.window.BayeHdMobile,
            refresh: () => { const h = original(); return {...h, ticket: {...h.ticket, [key]: h.ticket[key] + 1}}; }};
        off(f); assert.deepEqual(f.counts.centers, []);
    }
});
test('blank ground rejects a stale visible city HUD instead of borrowing its city', () => {
    const f = fixture(), stale = f.window.BayeHdMobile.refresh(); f.data.g_hdMapCity = 0;
    f.window.BayeHdMobile = {...f.window.BayeHdMobile, refresh: () => stale}; off(f); assert.deepEqual(f.counts.centers, []);
});
test('HUD getter owner change and data-object replacement invalidate independent native MAP', () => {
    for (const mutate of [f => f.data.g_hdMapInputSeq++, f => { f.window.baye.data = {...f.data}; },
        f => f.setIdentity({generation: 3}), f => { f.data.g_hdReportActive = 1; }]) {
        const f = fixture(), original = f.window.BayeHdMobile.refresh;
        f.window.BayeHdMobile = {...f.window.BayeHdMobile, refresh: () => { const h = original(); mutate(f); return h; }};
        off(f); assert.deepEqual(f.counts.centers, []);
    }
});
test('blank-ground shared and city-list getters must retain the same native owner', () => {
    for (const field of ['debugSnapshot', 'getCities']) {
        const f = fixture(); f.data.g_hdMapCity = 0; f.state.selectedIndex = 17;
        const original = f.shared[field]; f.shared[field] = () => { const value = original(); f.data.g_hdMapInputSeq++; return value; };
        off(f); assert.deepEqual(f.counts.keys, []);
    }
});
test('blank ground still retires on library, ready, menu, rotation and hidden transitions', () => {
    for (const change of [f => f.identityChanged({sha256: 'f'.repeat(64)}), f => f.setReady(false),
        f => f.menu(), f => f.resize(450, 800), f => f.visibility(true)]) {
        const f = fixture(); f.data.g_hdMapCity = 0; f.api.init(); change(f); off(f);
        assert.deepEqual(f.counts.keys, []);
    }
});
