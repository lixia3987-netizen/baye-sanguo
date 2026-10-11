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

        march(changes = {}, presentation = {}) {
            Object.assign(data, {g_hdMapPick: 1, g_hdBattlePick: 1, g_hdMenuActive: 0, g_hdMarchPhase: 4,
                g_hdMarchOrigin: 16, g_hdMarchSelected: 3}, changes);
            state.phase = 'map';
            const targetState = {targets: [17, 18], pendingTarget: null, confirmingTarget: false, status: 'select-target', ...presentation};
            counts.selects = []; counts.confirms = []; counts.marchCancels = [];
            const city = {
                getMarchTargetTicket() {
                    const value = {key: JSON.stringify([data.g_hdMarchPhase, data.g_hdMarchOrigin, data.g_hdMarchSession,
                        data.g_hdMarchInputSeq, data.g_hdMapInputSeq, data.g_hdMapCity, data.g_hdMarchSelected, targetState.targets]),
                        libraryGeneration: identity.generation, ownerType: 'march-target', cityIndex: data.g_hdMarchOrigin,
                        session: data.g_hdMarchSession, inputSeq: data.g_hdMarchInputSeq, mapInputSeq: data.g_hdMapInputSeq,
                        phase: data.g_hdMarchPhase, selected: data.g_hdMarchSelected, targets: targetState.targets.slice()};
                    Object.defineProperty(value, 'data', {value: window.baye.data});
                    return Object.freeze(value);
                },
                getMarchPresentation() { return {phase: data.g_hdMarchPhase, session: data.g_hdMarchSession,
                    inputSeq: data.g_hdMarchInputSeq, origin: data.g_hdMarchOrigin, ...targetState}; },
                selectMarchTarget(index) { counts.selects.push(index); targetState.pendingTarget = index; return {selected: index}; },
                confirmMarchTarget(index) { counts.confirms.push(index); return {confirming: index}; },
                cancelMarch() { counts.marchCancels.push(data.g_hdMarchSession); return true; }
            };
            window.BayeHdCityMenu = city; return {city, targetState};
        },
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


test('battle and settlement report retire before DEPARTED can restore the current strategy map', () => {
    const f = fixture(); f.api.init();
    Object.assign(f.data, {g_hdMarchPhase: 7, g_hdMarchSession: 1, g_hdMarchInputSeq: 16,
        g_hdMapPick: 0, g_hdBattlePick: 1, g_hdFightActive: 1});
    off(f); f.data.g_hdBattlePick = 0; f.data.g_hdFightActive = 0; f.data.g_hdReportActive = 1; off(f);
    f.data.g_hdReportActive = 0; off(f); f.data.g_hdMapPick = 1;
    const before = JSON.stringify(f.data);
    assert.equal(f.api.refresh().active, true); assert.equal(f.api.snapshot().cityIndex, 16);
    assert.equal(f.nodes.get('hd-mobile-hud').hidden, false);
    assert.equal(JSON.stringify(f.data), before); assert.deepEqual(f.counts.keys, []);
    const cancels = f.counts.sharedCancel; f.state.aligning = true; f.data.g_hdMapCity = 0;
    assert.equal(f.api.refresh().active, true); assert.equal(f.api.snapshot().cityIndex, null);
    assert.equal(f.nodes.get('hd-mobile-hud').hidden, true);
    assert.equal(f.nodes.get('hd-mobile-map-focus').disabled, true);
    assert.equal(f.counts.sharedCancel, cancels); assert.deepEqual(f.counts.keys, []);
});
test('DEPARTED never overrides a competing native owner on city or blank-ground MAP', () => {
    for (const city of [0, 17]) for (const key of ['g_hdBattlePick', 'g_hdMenuActive', 'g_hdReportActive',
        'g_hdQtyActive', 'g_hdFightActive', 'g_hdHelpActive', 'g_hdRecordActive', 'g_hdMovieActive',
        'g_hdSpeActive', 'g_hdSkillActive', 'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive',
        'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdGoodsActive', 'g_hdPersonPropertiesActive',
        'g_hdResultOwnerKind', 'g_hdResultOwnerValid']) {
        const f = fixture(); Object.assign(f.data, {g_hdMarchPhase: 7, g_hdMapCity: city, [key]: 1});
        off(f); assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.centers, []);
    }
});
test('all six active and unknown march phases block both MAP and header city EXIT', () => {
    for (const phase of [1, 2, 3, 4, 5, 6, -1, 8, 255, 7.5, '7', undefined, NaN]) {
        const f = fixture(); f.data.g_hdMarchPhase = phase; off(f);
        f.menu(); assert.equal(f.api.snapshot().exitEnabled, false); f.releaseExit();
        assert.deepEqual(f.counts.keys, []);
    }
});
test('a retained terminal phase preserves only the separately verified current city-menu EXIT', () => {
    const f = fixture(); f.data.g_hdMarchPhase = 7; f.api.init(); f.menu(); off(f);
    assert.equal(f.api.snapshot().exitEnabled, true);
    f.releaseExit(); f.releaseExit(); assert.deepEqual(f.counts.keys, [0x28]);
    assert.equal(f.data.g_hdMarchPhase, 7);
});
test('terminal-to-idle handoff in shared or HUD getters rejects the otherwise valid old MAP reading', () => {
    for (const getter of ['debugSnapshot', 'getCities', 'hud']) {
        const f = fixture(); f.data.g_hdMarchPhase = 7; f.state.selectedIndex = 17;
        if (getter === 'hud') {
            const original = f.window.BayeHdMobile.refresh;
            f.window.BayeHdMobile = {...f.window.BayeHdMobile, refresh: () => {
                const value = original(); f.data.g_hdMarchPhase = 0; return value;
            }};
        } else {
            const original = f.shared[getter]; f.shared[getter] = () => {
                const value = original(); f.data.g_hdMarchPhase = 0; return value;
            };
        }
        off(f); assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.centers, []);
    }
});
test('DEPARTED MAP still retires on hidden, rotation, classic preference and unverified identity', () => {
    for (const change of [f => f.visibility(true), f => f.resize(450, 800),
        f => f.shared.setMode('classic'), f => f.identityChanged({sha256: 'f'.repeat(64)})]) {
        const f = fixture(); f.data.g_hdMarchPhase = 7; f.api.init(); change(f); off(f);
        assert.deepEqual(f.counts.keys, []); assert.equal(f.data.g_hdMarchPhase, 7);
    }
});


test('TARGET_PICK owns a separate HD map and origin center without borrowing a normal city HUD', () => {
    const f = fixture(); f.march(); const before = JSON.stringify(f.data), value = f.api.init();
    assert.equal(value.active, true); assert.equal(value.ownerType, 'march-target');
    assert.equal(value.cityIndex, 16); assert.equal(value.marchSession, 5); assert.equal(value.marchSelected, 3);
    assert.deepEqual(Array.from(value.targets), [17, 18]); assert.equal(Object.isFrozen(value.targets), true);
    assert.equal(f.document.body.classList.contains('hd-mobile-march-target-on'), true);
    assert.equal(f.nodes.get('hd-mobile-hud').hidden, true); assert.equal(value.exitEnabled, false);
    assert.equal(f.nodes.get('hd-mobile-exit').disabled, true);
    assert.equal(f.nodes.get('hd-mobile-map-tip').textContent, '点相邻敌城选择目标 · 在侧栏确认出征');
    f.api.refresh(); assert.deepEqual(f.counts.centers, [16]);
    assert.equal(JSON.stringify(f.data), before);
    assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.selects, []); assert.deepEqual(f.counts.confirms, []);
    assert.deepEqual(f.counts.marchCancels, []);
});
test('target state displays only a matching session diagnostic and never confirms selection', () => {
    const f = fixture(), {targetState} = f.march({}, {pendingTarget: 17, status: 'selected'});
    f.api.init(); assert.equal(f.api.snapshot().pendingTarget, 17); assert.equal(f.api.snapshot().status, 'selected');
    targetState.confirmingTarget = true; f.api.refresh(); assert.equal(f.api.snapshot().confirmingTarget, true);
    assert.deepEqual(f.counts.selects, []); assert.deepEqual(f.counts.confirms, []); assert.deepEqual(f.counts.keys, []);
    f.window.BayeHdCityMenu.getMarchPresentation = () => ({phase: 4, session: 999, inputSeq: 11, origin: 16, pendingTarget: 17, status: 'stale'});
    f.api.refresh(); assert.equal(f.api.snapshot().active, true); assert.equal(f.api.snapshot().pendingTarget, null);
    assert.equal(f.api.snapshot().status, '');
});
test('target picker does not depend on the unavailable ordinary HUD or share its city ticket', () => {
    const f = fixture(); f.march(); delete f.window.BayeHdMobile;
    assert.equal(f.api.init().active, true); assert.equal(f.api.snapshot().ownerType, 'march-target');
    assert.deepEqual(f.counts.keys, []);
});
test('an actual phase4 requires the complete city target ticket and explicit select/confirm/cancel APIs', () => {
    for (const field of ['getMarchTargetTicket', 'selectMarchTarget', 'confirmMarchTarget', 'cancelMarch']) {
        const f = fixture(), {city} = f.march(); delete city[field]; off(f);
        assert.equal(f.document.body.classList.contains('hd-mobile-march-target-on'), false);
        assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.centers, []);
    }
});
test('phase4 rejects every competing native modal instead of borrowing an agreeing target ticket', () => {
    for (const field of ['g_hdReportActive', 'g_hdQtyActive', 'g_hdFightActive', 'g_hdHelpActive', 'g_hdRecordActive',
        'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive', 'g_hdAttackActive', 'g_hdSkillResultActive',
        'g_hdMakerActive', 'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdGoodsActive', 'g_hdPersonPropertiesActive',
        'g_hdResultOwnerKind', 'g_hdResultOwnerValid']) {
        const f = fixture(); f.march({[field]: 1}); off(f);
        assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.centers, []);
    }
});
test('phase4 requires actual MAP/battle picker, no menu and positive exact origin/session/input generations', () => {
    for (const change of [{g_hdMapPick: 0}, {g_hdBattlePick: 0}, {g_hdMenuActive: 1}, {g_hdMarchPhase: 3},
        {g_hdMarchPhase: 7}, {g_hdMarchOrigin: -1}, {g_hdMarchOrigin: 38}, {g_hdMarchSession: 0},
        {g_hdMarchInputSeq: 0}, {g_hdMapInputSeq: 0}, {g_hdDetailGeneration: 0}, {g_hdSpeGeneration: 0},
        {g_hdMarchSelected: 0}, {g_hdMarchSelected: 11}, {g_hdMarchInputSeq: '11'}]) {
        const f = fixture(); f.march(change); off(f); assert.deepEqual(f.counts.keys, []);
    }
});
test('target links cannot be absent, duplicate, unbounded or include the origin; no all-cities fallback', () => {
    for (const targets of [[], [17, 17], [16], [38], [-1], ['17'], [NaN], Array.from({length: 9}, (_, i) => i)]) {
        const f = fixture(); f.march({}, {targets}); off(f); assert.deepEqual(f.counts.centers, []);
    }
});
test('target ticket raw fields, opaque data, generation and key must match the actual owner', () => {
    for (const change of [{ownerType: 'map'}, {phase: 0}, {cityIndex: 17}, {session: 6}, {inputSeq: 12},
        {mapInputSeq: 9}, {selected: 4}, {libraryGeneration: 3}, {key: ''}, {data: {}}]) {
        const f = fixture(), {city} = f.march(), original = city.getMarchTargetTicket;
        city.getMarchTargetTicket = () => { const ticket = original(); return {...ticket, data: ticket.data, ...change}; };
        off(f); assert.deepEqual(f.counts.keys, []);
    }
});
test('a torn target ticket or getter-side native/library/data change cannot expose the target map', () => {
    for (const mutate of [f => f.data.g_hdMarchSession++, f => f.data.g_hdMarchInputSeq++, f => f.data.g_hdMarchOrigin++,
        f => f.data.g_hdMapInputSeq++, f => f.data.g_hdReportActive = 1, f => f.setIdentity({generation: 3}),
        f => { f.window.baye.data = {...f.data}; }]) {
        const f = fixture(), {city} = f.march(), original = city.getMarchTargetTicket;
        city.getMarchTargetTicket = () => { const ticket = original(); mutate(f); return ticket; };
        off(f); assert.deepEqual(f.counts.centers, []);
    }
    const f = fixture(), {city} = f.march(), original = city.getMarchTargetTicket; let reads = 0;
    city.getMarchTargetTicket = () => { const ticket = original(); return {...ticket, data: ticket.data, key: ticket.key + (++reads)}; };
    off(f);
});
test('shared render, target presentation and center getters must leave the target ticket current', () => {
    for (const getter of ['debugSnapshot', 'presentation', 'centerOnCity']) {
        const f = fixture(), {city} = f.march();
        const target = getter === 'presentation' ? city : f.shared, method = getter === 'presentation' ? 'getMarchPresentation' : getter;
        const original = target[method]; target[method] = (...args) => { const value = original(...args); f.data.g_hdMarchInputSeq++; return value; };
        off(f); assert.deepEqual(f.counts.keys, []);
    }
});
test('switching ordinary MAP to TARGET_PICK retires a gesture even though the HD surface remains active', () => {
    const f = fixture(); f.api.init(); const cancels = f.counts.sharedCancel;
    f.march(); assert.equal(f.api.refresh().active, true);
    assert.equal(f.counts.sharedCancel, cancels + 1);
    assert.equal(f.api.snapshot().ownerType, 'march-target');
    Object.assign(f.data, {g_hdMarchPhase: 7, g_hdBattlePick: 0}); f.api.refresh();
    assert.equal(f.api.snapshot().ownerType, 'map');
    assert.equal(f.document.body.classList.contains('hd-mobile-march-target-on'), false);
    assert.deepEqual(f.counts.keys, []);
});
test('an armed city header return never crosses into a target picker or replays its click', () => {
    const f = fixture(); f.api.init(); f.menu(); const exit = f.nodes.get('hd-mobile-exit');
    exit.fire('pointerdown'); f.march(); f.api.refresh(); exit.fire('pointerup'); exit.fire('click');
    f.releaseExit(); assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.marchCancels, []);
    assert.equal(f.api.snapshot().exitEnabled, false);
});
test('target picker retires on portrait, hidden, blur, identity or classic mode without cancelling native march', () => {
    for (const change of [f => f.resize(450, 800), f => f.visibility(true), f => f.identityChanged({generation: 3}),
        f => f.shared.setMode('classic')]) {
        const f = fixture(); f.march(); f.api.init(); change(f);
        if (f.api.snapshot().active && f.api.snapshot().libraryGeneration === 3) {
            // A fresh same-LIB owner can be shown again after identity refresh; no old gesture survives.
            assert.ok(f.counts.sharedCancel >= 2);
        } else off(f);
        assert.deepEqual(f.counts.keys, []); assert.deepEqual(f.counts.marchCancels, []);
    }
    const f = fixture(); f.march(); f.api.init(); const before = f.counts.sharedCancel;
    for (const fn of f.globalListeners.get('blur') || []) fn();
    assert.ok(f.counts.sharedCancel > before); assert.deepEqual(f.counts.keys, []);
});
test('target cursor crossing blank ground does not recenter or retire an otherwise current march', () => {
    const f = fixture(); f.march(); f.api.init(); const before = f.counts.sharedCancel;
    f.data.g_hdMapCity = 0; f.api.refresh();
    assert.equal(f.api.snapshot().active, true); assert.equal(f.api.snapshot().ownerType, 'march-target');
    assert.equal(f.counts.sharedCancel, before); assert.deepEqual(f.counts.centers, [16]); assert.deepEqual(f.counts.keys, []);
});
