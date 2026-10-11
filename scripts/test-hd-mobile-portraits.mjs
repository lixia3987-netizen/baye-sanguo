// Pure VM ownership and async image fixtures. No browser, native input or storage writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';

const moduleSource = readFileSync(new URL('../js/hd-mobile-portraits.js', import.meta.url), 'utf8');
const identitySource = readFileSync(new URL('../js/hd-lib-identity.js', import.meta.url), 'utf8');
const library = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../assets/hd-portraits/manifest.json', import.meta.url), 'utf8'));
const references = JSON.parse(readFileSync(new URL('../assets/hd-portraits/refs/index.json', import.meta.url), 'utf8'));
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const RAW = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdMapInputSeq', 'g_hdMapPick', 'g_hdMapCity',
    'g_hdBattlePick', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex',
    'g_hdMarchPhase', 'g_hdMarchSession', 'g_hdMarchInputSeq', 'g_hdReportActive', 'g_hdReportSeq',
    'g_hdReportInputSeq', 'g_hdReportKind', 'g_hdReportPerson', 'g_hdQtyActive', 'g_hdQtySession',
    'g_hdQtyInputSeq', 'g_hdQtyValue', 'g_hdQtyMin', 'g_hdQtyMax', 'g_hdQtyReady', 'g_hdHelpActive', 'g_hdHelpSeq', 'g_hdHelpInputSeq'];
const BLOCKERS = ['g_hdFightActive', 'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive',
    'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdMiniMapActive', 'g_hdViewActive',
    'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const person = (id, period) => references.periods.find(p => p.period === period)?.people.find(p => p.id === id);
const sourceFor = (id, period, forceMode) => {
    const entry = manifest.entries.find(p => p.personId === id && p.period === period);
    if (forceMode === 'lcd') return {mode: 'lcd', url: ''};
    if (entry?.hd && forceMode !== 'ref') return {mode: 'hd', url: 'assets/hd-portraits/' + entry.hd, entry, preview: false};
    const reference = entry || {personId: id, period, name: person(id, period).name, ref: 'refs/' + person(id, period).file};
    return {mode: 'ref', url: 'assets/hd-portraits/' + reference.ref, entry: reference, preview: false};
};

async function fixture(options = {}) {
    const listeners = new Map(), globalListeners = new Map(), timers = new Map(), subscribers = [];
    const counts = {keys: [], writes: [], storage: [], serializedData: 0, manifest: 0, sources: [], images: [], requests: [], clears: []};
    const nodes = new Map(), manifestWait = deferred(), sources = [];
    const state = {ready: true, mode: 'hd', hostAvailable: true, context: 'city', ids: [5, 0, 186],
        names: [person(5, 1).name, person(0, 1).name, person(186, 1).name], idsValid: true,
        period: 1, count: 200, identityOverride: null, periodReads: 0, ticketReads: 0,
        ticketHook: null, countHook: null, nameHook: null, identityHook: null, periodHook: null,
        sourceMode: options.sourceMode, sourceDeferred: !!options.sourceDeferred};
    function element(id, tagName, parent) {
        const attributes = new Map(), classes = new Set();
        const node = {id, tagName, nodeType: 1, hidden: false, disabled: false, isConnected: true,
            parentNode: null, parentElement: null, children: [], textContent: '', dataset: {},
            style: {display: 'block', visibility: 'visible', opacity: '1'},
            classList: {contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key),
                toggle(key, on) { if (on) classes.add(key); else classes.delete(key); }},
            appendChild(child) {
                if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(n => n !== child);
                child.parentNode = child.parentElement = this; this.children.push(child); return child;
            },
            contains(child) { for (let n = child; n; n = n.parentElement) if (n === this) return true; return false; },
            setAttribute(key, value) { attributes.set(key, String(value)); },
            getAttribute: key => attributes.get(key) ?? null,
            removeAttribute(key) { attributes.delete(key); },
            getBoundingClientRect: () => ({left: 30, top: 60, width: 100, height: 160, right: 130, bottom: 220}),
            get src() { const src = attributes.get('src'); return src && id === 'hd-mobile-portrait-img' ? new URL(src, 'http://portrait.fixture/m.html').href : src || ''; }, set src(value) {
                attributes.set('src', String(value));
                if (id === 'hd-mobile-portrait-img') {
                    node.currentSrc = new URL(String(value), 'http://portrait.fixture/m.html').href;
                    const request = {url: String(value), onload: node.onload, onerror: node.onerror};
                    counts.images.push(request);
                    if (!options.deferImages) queueMicrotask(() => request.onload?.());
                }
            }};
        nodes.set(id, node); if (parent) parent.appendChild(node); return node;
    }
    const html = element('html', 'HTML'), body = element('body', 'BODY', html);
    body.classList.add('hd-mobile-page'); body.setAttribute('data-hd-portrait-manual', '1');
    const city = element('hd-city-menu', 'DIV', body), details = element('hd-city-menu-person-details', 'DIV', city);
    const citySlot = element('hd-city-menu-person-portrait', 'DIV', details);
    const dialog = element('hd-dialog', 'DIV', body), reportSlot = element('hd-dialog-portrait', 'DIV', dialog);
    const figure = element('hd-mobile-portrait', 'FIGURE', body), image = element('hd-mobile-portrait-img', 'IMG', figure);
    const cap = element('hd-mobile-portrait-cap', 'FIGCAPTION', figure);
    image.naturalWidth = 128; image.naturalHeight = 192;
    figure.hidden = true; citySlot.hidden = true; reportSlot.hidden = true;
    const rawData = Object.fromEntries(RAW.concat(BLOCKERS).map(field => [field, 0]));
    Object.assign(rawData, {g_hdEngineReady: 1, g_hdDetailGeneration: 4, g_hdMapInputSeq: 8,
        g_hdMapCity: 11, g_hdMenuActive: 1, g_hdMenuContext: 1, g_hdMenuKind: 3, g_hdMenuSeq: 12,
        g_hdMenuCount: 3, g_hdMenuIndex: 0, g_hdMarchSession: 5, g_hdMarchInputSeq: 11,
        g_hdReportSeq: 3, g_hdReportInputSeq: 6, g_hdQtySession: 4, g_hdQtyInputSeq: 2,
        g_hdQtyValue: 10, g_hdQtyMax: 100, g_hdQtyReady: 1, g_hdHelpSeq: 2, g_hdHelpInputSeq: 3});
    Object.defineProperty(rawData, 'g_PIdx', {get() {
        state.periodReads++; if (state.periodHook) state.periodHook(state.periodReads); return state.period;
    }});
    Object.defineProperty(rawData, 'toJSON', {value() { counts.serializedData++; throw Error('opaque native data serialized'); }});
    rawData.circular = rawData;
    const data = new Proxy(rawData, {set(_target, key) { counts.writes.push(key); throw Error('native mutation'); }});
    const document = {body, hidden: false, readyState: 'complete', visibilityState: 'visible', baseURI: 'http://portrait.fixture/m.html',
        getElementById: id => nodes.get(id) || null,
        addEventListener(type, callback) { const list = listeners.get(type) || []; list.push(callback); listeners.set(type, list); }};
    const environment = {document, URL, innerWidth: 844, innerHeight: 390, dynLib: library.toString('hex'), crypto: webcrypto,
        matchMedia: () => ({matches: environment.innerWidth > environment.innerHeight}),
        getComputedStyle: node => node.style,
        addEventListener(type, callback) { const list = globalListeners.get(type) || []; list.push(callback); globalListeners.set(type, list); },
        setInterval(callback, ms) { const id = Symbol(); timers.set(id, {callback, ms}); return id; },
        clearInterval(id) { timers.delete(id); },
        sendKey(key) { counts.keys.push(key); throw Error('portrait sent native key'); },
        _bayeSendTouchEvent() { counts.keys.push('native-touch'); throw Error('portrait sent native touch'); },
        localStorage: {getItem: key => key === 'baye/libpath' ? 'libs/dat-mod.lib' : null,
            setItem(key) { counts.storage.push(key); throw Error('portrait wrote storage'); }}};
    vm.runInNewContext(identitySource, {window: environment, console, Uint8Array, ArrayBuffer, Promise, Object, Number, isFinite});
    const realIdentity = environment.BayeHdLibIdentity;
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('actual standard LIB identity did not settle')), 2000);
        let unsubscribe = () => {};
        const done = value => { if (value.status === 'pending') return; clearTimeout(timeout); unsubscribe();
            value.status === 'ready' ? resolve() : reject(Error('actual standard LIB verification failed')); };
        unsubscribe = realIdentity.subscribe(done); done(realIdentity.read());
    });
    const verifiedIdentity = realIdentity.read();
    assert.equal(verifiedIdentity.sha256, SHA); assert.equal(verifiedIdentity.byteLength, library.length);
    function identity() {
        if (state.identityHook) state.identityHook();
        return {...verifiedIdentity, ...state.identityOverride};
    }
    environment.BayeHdLibIdentity = {read: identity, subscribe(callback) { subscribers.push(callback); return () => {}; },
        isCurrent(value) { const current = identity(); return value && value.status === current.status &&
            value.sha256 === current.sha256 && value.generation === current.generation; }};
    environment.baye = {data, ensureData: () => environment.baye.data, hd: {ready: () => state.ready},
        getPersonCount() { if (state.countHook) state.countHook(); return state.count; },
        getPersonName(id) { if (state.nameHook) state.nameHook(id); return person(id, state.period)?.name || ''; }};
    let currentFallback = null, nextHandle = 0;
    function ticket(kind) {
        state.ticketReads++;
        if (!state.hostAvailable || state.mode === 'classic' || kind !== (state.context === 'report' ? 'dialog' : 'city')) return null;
        const d = environment.baye.data, raw = Object.fromEntries(RAW.concat(BLOCKERS).map(field => [field, d[field]]));
        const native = {raw, menu: {active: d.g_hdMenuActive, context: d.g_hdMenuContext, kind: d.g_hdMenuKind,
            seq: d.g_hdMenuSeq, generation: d.g_hdDetailGeneration, detailGeneration: d.g_hdDetailGeneration, count: d.g_hdMenuCount, index: d.g_hdMenuIndex,
            ids: [...state.ids], names: [...state.names], idsValid: state.idsValid},
            report: {active: d.g_hdReportActive, seq: d.g_hdReportSeq, inputSeq: d.g_hdReportInputSeq,
                kind: d.g_hdReportKind, person: d.g_hdReportPerson, text: '主公恩情，永铭于心……'},
            qty: {active: d.g_hdQtyActive}, help: {active: d.g_hdHelpActive}};
        const key = JSON.stringify([kind, identity().generation, native]);
        const metadata = {key: 'shared:' + key, ownerType: kind === 'city' ? 'city' : 'report',
            libraryGeneration: identity().generation};
        if (kind === 'city') Object.assign(metadata, {cityIndex: d.g_hdMapCity - 1,
            menuContext: d.g_hdMenuContext, menuKind: d.g_hdMenuKind, menuSeq: d.g_hdMenuSeq,
            detailGeneration: d.g_hdDetailGeneration, session: d.g_hdMarchSession, inputSeq: d.g_hdMarchInputSeq});
        const result = {kind, data: d, key, native, ticket: metadata};
        return state.ticketHook ? state.ticketHook(result, kind, state.ticketReads) : result;
    }
    environment.BayeHdMobileCity = {readInputTicket: ticket,
        requestLcdFallback(owner, reason) {
            counts.requests.push({owner, reason});
            const current = ticket(owner.kind);
            if (!current || current.key !== owner.key || owner.data !== current.data) return null;
            currentFallback = Object.freeze({handle: ++nextHandle}); return currentFallback;
        },
        clearLcdFallback(handle) {
            const cleared = handle === currentFallback;
            counts.clears.push({handle, cleared});
            if (cleared) currentFallback = null; return cleared;
        }};
    environment.BayeHdCityMenu = {getMode: () => state.mode};
    environment.BayeHdDialog = {getMode: () => state.mode};
    environment.BayeHdPortraits = {
        loadManifest() { counts.manifest++; return options.manifestPending ? manifestWait.promise : Promise.resolve(manifest); },
        chooseSource(id, period) {
            counts.sources.push({id, period});
            if (state.sourceDeferred) { const wait = deferred(); sources.push(wait); return wait.promise; }
            return Promise.resolve(sourceFor(id, period, state.sourceMode));
        }};
    environment.Image = class { constructor() { throw Error('the adapter must validate the visible DOM image'); } };
    function report(id = 0) {
        state.context = 'report';
        Object.assign(rawData, {g_hdMenuActive: 0, g_hdMenuContext: 0, g_hdMenuKind: 0, g_hdMenuCount: 0,
            g_hdMenuIndex: 0, g_hdReportActive: 1, g_hdReportKind: 2, g_hdReportPerson: id});
        state.ids = []; state.names = [];
    }
    if (options.report) report(options.personId ?? 0);
    if (options.setup) options.setup({state, rawData, environment, data, report, nodes});
    vm.runInNewContext(moduleSource, {window: environment, console, Promise, Object, Number, Math, JSON, isFinite});
    const controller = environment.BayeHdMobilePortraits.createController(environment);
    const api = {controller, environment, document, state, data, rawData, counts, nodes, figure, image, cap, citySlot, reportSlot,
        timers, listeners, globalListeners, subscribers, manifestWait, sources, report,
        fallback: () => currentFallback,
        emit(type) { for (const fn of [...(listeners.get(type) || []), ...(globalListeners.get(type) || [])]) fn({type}); },
        async settle() { await flush(); await flush(); },
        resolveImage(index, ok = true) { const image = counts.images[index]; assert.ok(image, 'actual DOM image request exists'); (ok ? image.onload : image.onerror)?.(); },
        assertReadonly() { assert.deepEqual(counts.keys, []); assert.deepEqual(counts.writes, []);
            assert.deepEqual(counts.storage, []); assert.equal(counts.serializedData, 0); }};
    if (options.init !== false) { controller.init(); await api.settle(); }
    return api;
}
function retired(h) { assert.equal(h.figure.hidden, true); assert.equal(h.citySlot.hidden, true); assert.equal(h.reportSlot.hidden, true); h.assertReadonly(); }
function painted(h, context, id, mode) {
    assert.equal(h.figure.hidden, false); const view = h.controller.debugSnapshot();
    assert.equal(view.context, context); assert.equal(view.personId, id); assert.equal(view.sourceMode, mode);
    assert.equal(h.image.getAttribute('src'), sourceFor(id, view.period, mode).url);
    assert.equal(h.figure.parentNode, context === 'dialog' ? h.reportSlot : h.citySlot);
    h.assertReadonly();
}

test('fixture verifies the complete real standard LIB and original zero-ID person', () => {
    assert.equal(library.length, 207195); assert.equal(createHash('sha256').update(library).digest('hex'), SHA);
    assert.equal(manifest.libSha256, SHA); assert.equal(references.libSha256, SHA);
    assert.equal(person(0, 1).name, '董卓'); assert.equal(person(5, 1).name, '马腾');
});
test('explicit init is idempotent and never sends input or serializes native data', async () => {
    const h = await fixture({init: false}); assert.equal(h.counts.manifest, 0);
    h.controller.init(); h.controller.init(); await h.settle();
    assert.equal(h.counts.manifest, 1); assert.equal(h.timers.size, 1); h.assertReadonly();
});
test('current city person renders its actual HD entry only after image load', async () => {
    const h = await fixture({deferImages: true}); retired(h); assert.equal(h.counts.images.length, 1);
    h.resolveImage(0); await h.settle(); painted(h, 'city', 5, 'hd');
});
test('zero person ID is legal and a true reference attaches to the city slot', async () => {
    const h = await fixture({sourceMode: 'ref', setup: ({rawData}) => { rawData.g_hdMenuIndex = 1; }}); painted(h, 'city', 0, 'ref');
});
test('last named original person retains its real index rather than a masked or off-by-one ID', async () => {
    assert.equal(person(199, 1).name, '');
    const h = await fixture({setup: ({rawData}) => { rawData.g_hdMenuIndex = 2; }}); painted(h, 'city', 186, 'ref');
});
test('selected native order chooses the indexed ID rather than the first ID or name', async () => {
    const h = await fixture();
    h.state.ids = [0, 5, 186]; h.state.names = h.state.ids.map(id => person(id, 1).name); h.rawData.g_hdMenuSeq++;
    h.controller.refresh(); await h.settle(); painted(h, 'city', 0, 'hd');
});
test('kind-2 current report with zero person ID renders in the report slot', async () => {
    const h = await fixture({report: true, sourceMode: 'ref'}); painted(h, 'dialog', 0, 'ref');
    assert.deepEqual(Object.keys(h.environment.BayeHdMobileCity.readInputTicket('dialog').ticket).sort(),
        ['key', 'libraryGeneration', 'ownerType'], 'Real shared report metadata does not invent city or seq fields');
});
test('an actual later-period entry follows independently read g_PIdx rather than cached period one', async () => {
    const h = await fixture({setup: ({state, rawData}) => {
        state.period = 2; state.ids = [11, 0, 1]; state.names = state.ids.map(id => person(id, 2).name);
        rawData.g_hdMenuIndex = 0;
    }});
    painted(h, 'city', 11, 'hd'); assert.equal(h.controller.debugSnapshot().period, 2);
});
test('manifest still pending is not an asset miss or a native LCD request', async () => {
    const h = await fixture({manifestPending: true}); retired(h);
    assert.equal(h.counts.sources.length, 0); assert.equal(h.counts.requests.length, 0);
    h.controller.refresh(); assert.equal(h.counts.sources.length, 0);
    h.manifestWait.resolve(manifest); await h.settle(); painted(h, 'city', 5, 'hd');
});
test('an authoritative LCD source requests the real host fallback with an opaque current owner', async () => {
    const h = await fixture({sourceMode: 'lcd'}); retired(h);
    assert.equal(h.counts.requests.length, 1); assert.ok(h.fallback());
    const owner = h.counts.requests[0].owner;
    assert.equal(owner.data, h.data); assert.equal(owner.personId, 5); assert.equal(owner.period, 1); h.assertReadonly();
});

const denied = [
    ['engine not ready', h => { h.state.ready = false; }],
    ['identity pending', h => { h.state.identityOverride = {status: 'pending'}; }],
    ['identity error', h => { h.state.identityOverride = {status: 'error'}; }],
    ['wrong standard SHA', h => { h.state.identityOverride = {sha256: '0'.repeat(64)}; }],
    ['wrong standard byte length', h => { h.state.identityOverride = {byteLength: 207194}; }],
    ['missing original identity generation', h => { h.state.identityOverride = {generation: 0}; }],
    ['missing current host ticket', h => { h.state.hostAvailable = false; }],
    ['city owner is not person picker', h => { h.rawData.g_hdMenuKind = 2; }],
    ['title owner cannot authorize a city portrait', h => { h.rawData.g_hdMenuContext = 4; }],
    ['inactive native city owner', h => { h.rawData.g_hdMenuActive = 0; }],
    ['IDs not published', h => { h.state.idsValid = false; }],
    ['person resource count is unavailable', h => { h.state.count = 0; }],
    ['count disagrees with complete IDs', h => { h.rawData.g_hdMenuCount = 2; }],
    ['negative current index', h => { h.rawData.g_hdMenuIndex = -1; }],
    ['current index is outside native list', h => { h.rawData.g_hdMenuIndex = 3; }],
    ['full U16 256 is not silently truncated to person zero', h => { h.state.ids[0] = 256; }],
    ['U16 sentinel cannot authorize a portrait', h => { h.state.ids[0] = 65535; }],
    ['negative person ID', h => { h.state.ids[0] = -1; }],
    ['fractional person ID', h => { h.state.ids[0] = 5.5; }],
    ['unnamed original slot cannot impersonate a named person', h => { h.state.ids[0] = 199; h.state.names[0] = ''; }],
    ['period zero', h => { h.state.period = 0; }],
    ['period five', h => { h.state.period = 5; }],
    ['missing native data', h => { h.environment.baye.data = null; }],
    ['wrong shared owner metadata', h => { h.state.ticketHook = t => ({...t, ticket: {...t.ticket, ownerType: 'help'}}); }],
    ['raw and public menu sequence disagree', h => { h.state.ticketHook = t => { t.native.raw.g_hdMenuSeq++; return t; }; }]
];
for (const [name, mutate] of denied) test(name + ' fails closed without image or LCD authority', async () => {
    const h = await fixture({setup: mutate}); retired(h);
    assert.equal(h.counts.sources.length, 0); assert.equal(h.counts.requests.length, 0);
});
for (const [field, change] of [
    ['key', () => ''],
    ['libraryGeneration', value => value + 1],
    ['cityIndex', value => value + 1],
    ['menuContext', value => value + 1],
    ['menuKind', value => value + 1],
    ['menuSeq', value => value + 1],
    ['detailGeneration', value => value + 1],
    ['session', value => value + 1],
    ['inputSeq', value => value + 1]
]) test('city shared metadata ' + field + ' must match current native publication', async () => {
    const h = await fixture({setup: ({state}) => {
        state.ticketHook = t => ({...t, ticket: {...t.ticket, [field]: change(t.ticket[field])}});
    }});
    retired(h); assert.equal(h.counts.sources.length, 0); assert.equal(h.counts.requests.length, 0);
});
test('a changed opaque shared key between two reads invalidates an otherwise unchanged native owner', async () => {
    const h = await fixture({setup: ({state}) => {
        state.ticketHook = (t, _kind, reads) => ({...t, ticket: {...t.ticket, key: 'shared-changing:' + reads}});
    }});
    retired(h); assert.equal(h.counts.sources.length, 0); assert.equal(h.counts.requests.length, 0);
});
const deniedReports = [
    ['inactive report', h => { h.rawData.g_hdReportActive = 0; }],
    ['non-person report kind', h => { h.rawData.g_hdReportKind = 1; }],
    ['missing report sequence', h => { h.rawData.g_hdReportSeq = 0; }],
    ['missing report input sequence', h => { h.rawData.g_hdReportInputSeq = 0; }],
    ['invalid report person', h => { h.rawData.g_hdReportPerson = 65535; }],
    ['torn report sequence', h => { h.state.ticketHook = t => { t.native.raw.g_hdReportSeq++; return t; }; }],
    ['torn report input sequence', h => { h.state.ticketHook = t => { t.native.raw.g_hdReportInputSeq++; return t; }; }],
    ['torn report person', h => { h.state.ticketHook = t => { t.native.raw.g_hdReportPerson = 5; return t; }; }]
];
for (const [name, mutate] of deniedReports) test(name + ' never invents a report portrait', async () => {
    const h = await fixture({report: true, setup: mutate}); retired(h);
    assert.equal(h.counts.sources.length, 0); assert.equal(h.counts.requests.length, 0);
});
for (const field of BLOCKERS.concat(['g_hdQtyActive', 'g_hdHelpActive', 'g_hdBattlePick']))
    test(field + ' takeover retires an already painted person without native input', async () => {
        const h = await fixture(); painted(h, 'city', 5, 'hd');
        h.rawData[field] = 1; h.controller.refresh(); await h.settle(); retired(h);
        assert.equal(h.counts.requests.length, 0);
    });
test('period changes during independent reads reject rather than publishing a different period', async () => {
    const h = await fixture({setup: ({state}) => { state.periodHook = reads => { if (reads > 1) state.period = 2; }; }});
    retired(h); assert.equal(h.counts.sources.length, 0); assert.ok(h.state.periodReads >= 2);
});
for (const [name, install] of [
    ['person-count getter changes current native owner', h => { h.state.countHook = () => { h.rawData.g_hdMenuSeq++; }; }],
    ['person-name getter changes current native owner', h => { h.state.nameHook = () => { h.rawData.g_hdMenuSeq++; }; }],
    ['person-name getter rebinds native data', h => { h.state.nameHook = () => { h.environment.baye.data = {...h.rawData}; }; }],
        ['person-name getter changes verified LIB generation', h => { h.state.nameHook = () => { h.state.identityOverride = {generation: (h.state.identityOverride?.generation || 1) + 1}; }; }]
]) test(name + ' is caught by the final fence', async () => {
    const h = await fixture({setup: install}); retired(h); assert.equal(h.counts.sources.length, 0);
});
test('a failed DOM HD image tries the actual manifest reference before requesting LCD', async () => {
    const h = await fixture({deferImages: true}); h.resolveImage(0, false); await h.settle();
    retired(h); assert.equal(h.counts.images.length, 2); assert.equal(h.counts.requests.length, 0);
    assert.equal(h.counts.images[1].url, sourceFor(5, 1, 'ref').url);
    h.resolveImage(1); await h.settle(); painted(h, 'city', 5, 'ref');
});
test('only failure of both actual DOM HD and manifest reference requests current-owner LCD', async () => {
    const h = await fixture({deferImages: true}); h.resolveImage(0, false); await h.settle();
    h.resolveImage(1, false); await h.settle(); retired(h);
    assert.ok(h.fallback()); assert.equal(h.counts.requests.length, 1);
});
test('an external portrait URL cannot become a loaded mobile portrait', async () => {
    const h = await fixture({sourceDeferred: true});
    h.sources[0].resolve({mode: 'hd', url: 'https://example.invalid/portrait.png'}); await h.settle();
    retired(h); assert.equal(h.counts.images.length, 0);
});
for (const [name, mutate] of [
    ['wrong source person', s => { s.entry = {...s.entry, personId: 0}; }],
    ['wrong source period', s => { s.entry = {...s.entry, period: 2}; }],
    ['preview image is not runtime authority', s => { s.preview = true; }],
    ['parent traversal cannot escape portrait assets', s => { s.url = 'assets/hd-portraits/../private.png'; }]
]) test(name + ' cannot paint or bypass the true LCD handoff', async () => {
    const h = await fixture({sourceDeferred: true}); const src = {...sourceFor(5, 1)}; mutate(src);
    h.sources[0].resolve(src); await h.settle(); retired(h); assert.equal(h.counts.images.length, 0);
    assert.equal(h.counts.requests.length, 1); assert.ok(h.fallback());
});
test('an empty currentSrc remains compatible while a positive mismatching currentSrc is rejected', async () => {
    const h = await fixture({deferImages: true}); h.image.currentSrc = '';
    h.resolveImage(0); await h.settle(); painted(h, 'city', 5, 'hd');
    h.rawData.g_hdMenuSeq++; h.controller.refresh(); await h.settle();
    h.image.currentSrc = 'http://portrait.fixture/assets/hd-portraits/other.png';
    h.resolveImage(1); await h.settle(); retired(h);
    assert.equal(h.counts.images[2].url, sourceFor(5, 1, 'ref').url);
});
test('invalid loaded dimensions cannot make an opaque empty portrait visible', async () => {
    const h = await fixture({deferImages: true}); h.image.naturalWidth = 0;
    h.resolveImage(0); await h.settle(); retired(h); assert.equal(h.counts.images.length, 2);
    h.resolveImage(1); await h.settle(); retired(h); assert.ok(h.fallback());
});
test('a delayed old source cannot overwrite a new indexed owner', async () => {
    const h = await fixture({sourceDeferred: true});
    h.rawData.g_hdMenuIndex = 1; h.rawData.g_hdMenuSeq++; h.controller.refresh(); await h.settle();
    assert.equal(h.sources.length, 2); h.sources[1].resolve(sourceFor(0, 1)); await h.settle(); painted(h, 'city', 0, 'hd');
    h.sources[0].resolve(sourceFor(5, 1)); await h.settle(); painted(h, 'city', 0, 'hd');
});
test('a delayed old image cannot replace a new report owner', async () => {
    const h = await fixture({deferImages: true}); h.report(0); h.controller.refresh(); await h.settle();
    assert.equal(h.counts.images.length, 2); h.resolveImage(1); await h.settle(); painted(h, 'dialog', 0, 'hd');
    h.resolveImage(0); await h.settle(); painted(h, 'dialog', 0, 'hd');
});
test('an old image error cannot request LCD or clear the newer fallback handle', async () => {
    const h = await fixture({deferImages: true}); h.state.sourceMode = 'lcd'; h.report(0); h.controller.refresh(); await h.settle();
    const handle = h.fallback(); assert.ok(handle); assert.equal(h.counts.requests.length, 1);
    h.resolveImage(0, false); await h.settle();
    assert.equal(h.fallback(), handle); assert.equal(h.counts.requests.length, 1);
    assert.ok(h.counts.clears.every(call => call.handle !== handle)); h.assertReadonly();
});
test('retiring a current fallback passes its exact opaque handle and never a new owner handle', async () => {
    const h = await fixture({sourceMode: 'lcd'}), old = h.fallback(); assert.ok(old);
    h.state.sourceMode = undefined; h.rawData.g_hdMenuIndex = 1; h.rawData.g_hdMenuSeq++; h.controller.refresh(); await h.settle();
    painted(h, 'city', 0, 'hd'); assert.equal(h.fallback(), null);
    assert.ok(h.counts.clears.some(call => call.handle === old)); h.assertReadonly();
});
test('adapter retirement passes only its old handle and cannot clear a newer host grant', async () => {
    const h = await fixture({sourceMode: 'lcd'}), old = h.fallback(); assert.ok(old);
    h.rawData.g_hdMenuIndex = 1; h.rawData.g_hdMenuSeq++;
    const ticket = h.environment.BayeHdMobileCity.readInputTicket('city');
    const current = h.environment.BayeHdMobileCity.requestLcdFallback({kind: ticket.kind, data: ticket.data,
        key: ticket.key, period: 1, personId: 0}, 'new-owner-grant');
    assert.ok(current); assert.notEqual(current, old);
    h.state.sourceDeferred = true; h.controller.refresh(); await h.settle();
    assert.ok(h.counts.clears.some(call => call.handle === old && call.cleared === false));
    assert.equal(h.fallback(), current); retired(h);
});
for (const [name, boundary] of [
    ['hidden', h => { h.document.hidden = true; h.document.visibilityState = 'hidden'; h.emit('visibilitychange'); }],
    ['portrait', h => { h.environment.innerWidth = 390; h.environment.innerHeight = 844; h.emit('resize'); }],
    ['blur', h => { h.emit('blur'); }],
    ['pagehide', h => { h.emit('pagehide'); }],
    ['classic', h => { h.state.mode = 'classic'; h.controller.refresh(); }]
]) test(name + ' retires an in-flight image without keys or stale resurrection', async () => {
    const h = await fixture({deferImages: true}); boundary(h); retired(h);
    h.resolveImage(0); await h.settle(); retired(h); assert.equal(h.counts.requests.length, 0);
});
