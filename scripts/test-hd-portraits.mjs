#!/usr/bin/env node
// Exercises the shipped browser module and real asset indexes without Chrome or npm packages.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test, after } from 'node:test';
import { createHash, webcrypto } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleText = readFileSync(path.join(root, 'js/hd-portraits.js'), 'utf8');
const identityText = readFileSync(path.join(root, 'js/hd-lib-identity.js'), 'utf8');
const dumpText = readFileSync(path.join(root, 'scripts/dump-hd-portraits.mjs'), 'utf8');
const dictionaryBytes = readFileSync(path.join(root, 'libs/dat-mod.lib'));
const dictionaryHex = dictionaryBytes.toString('hex');
const dictionarySha256 = createHash('sha256').update(dictionaryBytes).digest('hex');
const modifiedBytes = Buffer.from(dictionaryBytes); modifiedBytes[modifiedBytes.length - 1] ^= 1;
const modifiedHex = modifiedBytes.toString('hex');
const manifestUrl = 'assets/hd-portraits/manifest.json';
const referencesUrl = 'assets/hd-portraits/refs/index.json';
const manifest = JSON.parse(readFileSync(path.join(root, manifestUrl), 'utf8'));
const references = JSON.parse(readFileSync(path.join(root, referencesUrl), 'utf8'));
const asset = (rel) => 'assets/hd-portraits/' + rel;
const pilot = manifest.entries.find((entry) => entry.period === 1 && entry.personId === 5);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(options = {}) {
    const settings = new Map();
    if (options.lib !== null) settings.set('baye/libpath', options.lib ?? manifest.lib);
    const requests = [];
    const fetches = [];
    const deferredFetches = [];
    const deferred = [];
    const intervals = new Map();
    const listeners = new Map();
    const missing = options.missing ?? new Set();
    function element() {
        const attrs = new Map();
        const classes = new Set();
        return {
            hidden: true,
            textContent: '',
            children: [],
            parentNode: null,
            appendChild(child) {
                if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(item => item !== child);
                child.parentNode = this;
                this.children.push(child);
            },
            getAttribute: (key) => attrs.get(key) ?? null,
            setAttribute: (key, value) => attrs.set(key, String(value)),
            removeAttribute: (key) => attrs.delete(key),
            get src() { return attrs.get('src'); },
            set src(value) { attrs.set('src', value); },
            classList: {
                contains: (key) => classes.has(key),
                add: (key) => classes.add(key),
                remove: (key) => classes.delete(key)
            }
        };
    }
    const elements = {
        'hd-portrait': element(),
        'hd-portrait-img': element(),
        'hd-portrait-cap': element()
    };
    const body = element();
    body.appendChild(elements['hd-portrait']);
    if (options.personSlot) {
        elements['hd-city-menu-person-portrait'] = element();
        elements['hd-city-menu-person-details'] = element();
        elements['hd-city-menu-person-details'].hidden = false;
    }
    if (options.manual) body.setAttribute('data-hd-portrait-manual', '1');
    class Image {
        set src(url) {
            requests.push(url);
            const resolve = () => {
                const ok = !missing.has(url) && existsSync(path.join(root, url));
                (ok ? this.onload : this.onerror)?.();
            };
            if (options.deferImages) deferred.push({ url, resolve });
            else queueMicrotask(resolve);
        }
    }
    const context = vm.createContext({
        document: {
            readyState: 'loading',
            body,
            hidden: false,
            addEventListener(name, fn) { (listeners.get(name) || listeners.set(name, []).get(name)).push(fn); },
            getElementById: (id) => elements[id] ?? null
        },
        localStorage: { getItem: (key) => settings.get(key) ?? null },
        dynLib: Object.hasOwn(options, 'hex') ? options.hex : options.manual ? null : dictionaryHex,
        crypto: Object.hasOwn(options, 'crypto') ? options.crypto : webcrypto,
        sendKey() { throw new Error('portrait presentation cannot send native input'); },
        Image,
        fetch: async (url) => {
            fetches.push(url);
            if (options.deferFetches) await new Promise(resolve => deferredFetches.push(resolve));
            const data = url === manifestUrl ? options.manifest ?? manifest :
                url === referencesUrl ? options.references ?? references : null;
            const ok = !!data && !missing.has(url);
            return { ok, status: ok ? 200 : 404, json: async () => data };
        },
        console: { warn() {} },
        setInterval(callback) {
            const id = intervals.size + 1;
            intervals.set(id, callback);
            return id;
        },
        clearInterval: (id) => intervals.delete(id)
    });
    context.window = context;
    if (options.enginePromiseOverride) {
        vm.runInContext('window.Promise = function EnginePromise() { throw new Error("engine callback shim cannot load portraits"); };', context);
    }
    if (options.identityModule !== false) vm.runInContext(identityText, context, { filename: 'js/hd-lib-identity.js' });
    vm.runInContext(moduleText, context, { filename: 'js/hd-portraits.js' });
    const api = context.BayeHdPortraits;
    async function settleIdentity() {
        for (let i = 0; i < 1000; i++) {
            if (context.BayeHdLibIdentity?.read().status !== 'pending') { await flush(); return; }
            await flush();
        }
        assert.fail('real native digest did not settle');
    }
    return {
        api, context, elements, body, settings,
        requests, fetches, missing, deferred, intervals,
        listeners, settleIdentity,
        async load() { const value = await api.loadManifest(); await settleIdentity(); return value; },
        async start() { await api.start(); await settleIdentity(); await flush(); },
        setHidden(value) { context.document.hidden = value; for (const fn of listeners.get('visibilitychange') || []) fn(); },
        resolveFetches() { deferredFetches.splice(0).forEach(resolve => resolve()); },
        resolveImages() { deferred.splice(0).forEach((item) => item.resolve()); }
    };
}

function personMenu(f, items = [{ pind: 0, name: '董卓' }, { pind: 1, name: '李儒' }]) {
    const menu = { active: 1, context: 1, kind: 3, seq: 7, index: 0,
        count: items.length, names: items.map(item => item.name) };
    const snap = { open: true, layer: 'deep', deepKind: 'person', idleIndex: 0,
        deepCount: items.length, deepItems: items.map((item, i) => ({ i, ...item })), personDetail: null };
    function own() { snap.deepMenuOwner = { context: 1, kind: 3, seq: menu.seq,
        key: JSON.stringify([1, 1, 3, menu.seq, menu.names]) }; }
    own();
    f.context.baye ||= { data: { g_PIdx: 1 } };
    f.context.baye.getPersonCount ||= () => 200;
    f.context.baye.hd ||= {};
    f.context.baye.hd.ready = () => true;
    f.context.baye.hd.menuItems = () => menu;
    f.context.BayeHdCityMenu = { isOpen: () => true, debugSnapshot: () => snap };
    return { menu, snap, own };
}

function personHelp(f, options = {}) {
    f.context.baye ||= { data: { g_PIdx: 1 } };
    f.context.baye.hd ||= {};
    const fight = { active: 1, over: 0, inputKind: 9, inputSeq: 40 };
    const help = { active: 1, protocolVersion: 1, complete: 1, kind: 1, seq: 8,
        generation: 3, detailGeneration: 3, inputSeq: 40, person: 0, slot: 0,
        name: '董卓', arm: '步兵', state: '正常', fields: [1, 80, 60, 0, 99, 40, 120, 90, 3000, 0],
        levelMax: 0, ...options };
    const snap = { open: true, kind: 'help', helpOwner: { kind: 9, inputSeq: fight.inputSeq } };
    function publish() {
        snap.helpOwner = { kind: 9, inputSeq: fight.inputSeq };
        snap.helpDetail = { kind: 1, seq: help.seq, generation: help.generation, inputSeq: help.inputSeq,
            person: help.person, slot: help.slot, name: help.name };
    }
    publish();
    f.context.baye.hd.ready = () => true;
    f.context.baye.hd.fight = () => fight;
    f.context.baye.hd.help = () => help;
    f.context.BayeHdDialog = { debugSnapshot: () => snap, shouldShowHd: () => true };
    return { help, fight, snap, publish };
}

function nativeIdsMenu(f, items = [{ pind: 0, name: '董卓' }, { pind: 1, name: '李儒' }]) {
    const model = personMenu(f, items);
    Object.assign(model.menu, { generation: 4, detailGeneration: 4, idsValid: true,
        ids: items.map(item => item.pind) });
    model.own = () => {
        model.snap.deepMenuOwner = { context: 1, kind: 3, seq: model.menu.seq,
            key: JSON.stringify([1, 1, 3, model.menu.seq, model.menu.names,
                model.menu.detailGeneration, model.menu.idsValid ? model.menu.ids : null]) };
    };
    model.own();
    return model;
}

test('all 800 shipped references resolve through their exported filenames', async () => {
    const f = fixture();
    await f.load();
    assert.equal(f.api.debugSnapshot().referenceCount, 800);
    for (const period of references.periods) {
        for (const person of period.people) {
            if (person.skipped) continue;
            assert.ok(existsSync(path.join(root, asset('refs/' + person.file))));
            const entry = manifest.entries.find((item) => item.period === period.period && item.personId === person.id);
            const hdExists = entry?.hd && existsSync(path.join(root, asset(entry.hd)));
            const src = await f.api.chooseSource(person.id, period.period);
            assert.equal(src.mode, hdExists ? 'hd' : 'ref', `period ${period.period}, ID ${person.id}`);
            assert.equal(src.url, hdExists ? asset(entry.hd) : asset('refs/' + person.file));
        }
    }
    assert.equal(f.requests.length, new Set(f.requests).size, 'each URL is requested at most once');
});

test('all 39 period/person slots obey each of the three native identity protocols independently', async () => {
    // This is the VM protocol matrix. Real native menus, queues and battle
    // actors are independently exercised by test-hd-portraits-runtime.mjs.
    const entries = manifest.entries.filter(e => !e.missing);
    assert.equal(entries.length, 39);
    for (const entry of entries) {
        const expect = existsSync(path.join(root, asset(entry.hd))) ? 'hd' : 'ref';
        for (const context of ['map-king', 'person-info', 'battle-note']) {
            const f = fixture();
            await f.load();
            if (context === 'map-king') {
                f.context.baye = { data: { g_PIdx: entry.period, g_PlayerKing: entry.personId }, getPersonName: () => entry.name };
                f.body.classList.add('baye-hd-overworld-map');
            } else if (context === 'person-info') {
                nativeIdsMenu(f, [{ pind: entry.personId, name: entry.name }]);
                f.context.baye.data.g_PIdx = entry.period;
            } else {
                personHelp(f, { person: entry.personId, name: entry.name });
                f.context.baye.data.g_PIdx = entry.period;
            }
            const detected = f.api.detectView();
            assert.ok(detected, `${context} ${entry.period}:${entry.personId}`);
            assert.equal(detected.context, context); assert.equal(detected.personId, entry.personId);
            assert.equal(detected.period, entry.period); assert.equal(detected.name, entry.name);
            const source = await f.api.applyView(detected, true);
            assert.equal(source.mode, expect);
            assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), String(entry.personId));
            assert.equal(f.elements['hd-portrait'].getAttribute('data-period'), String(entry.period));
            assert.equal(f.elements['hd-portrait-img'].getAttribute('src'), asset(expect === 'hd' ? entry.hd : entry.ref));
        }
    }
});

test('runtime person portrait docks in its detail pane and returns to the page for other views', async () => {
    const f = fixture({ personSlot: true });
    await f.load();
    await f.api.applyView({ context: 'person-info', personId: 0, period: 1, name: '董卓', menuOwnerKey: 'native-menu-7' });
    assert.equal(f.elements['hd-portrait'].parentNode, f.elements['hd-city-menu-person-portrait']);
    await f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '董卓' });
    assert.equal(f.elements['hd-portrait'].parentNode, f.body);
    await f.api.applyView({ context: 'person-info', personId: 0, period: 1, name: '董卓', menuOwnerKey: 'native-menu-7' });
    await f.api.applyView(null);
    assert.equal(f.elements['hd-portrait'].parentNode, f.body);
    assert.equal(f.elements['hd-portrait'].hidden, true);
});

test('person reports and hidden detail panes keep their portrait outside an old menu slot', async () => {
    const f = fixture({ personSlot: true });
    await f.load();
    await f.api.applyView({ context: 'person-info', personId: 0, period: 1, name: '董卓', menuOwnerKey: 'native-menu-7' });
    assert.equal(f.elements['hd-portrait'].parentNode, f.elements['hd-city-menu-person-portrait']);
    await f.api.applyView({ context: 'person-info', personId: 0, period: 1, name: '董卓' });
    assert.equal(f.elements['hd-portrait'].parentNode, f.body, 'report has no native person-menu owner');
    f.elements['hd-city-menu-person-details'].hidden = true;
    await f.api.applyView({ context: 'person-info', personId: 0, period: 1, name: '董卓', menuOwnerKey: 'native-menu-7' });
    assert.equal(f.elements['hd-portrait'].parentNode, f.body, 'hidden old pane cannot swallow another view');
});

test('manual art preview never mounts into a runtime person detail slot', async () => {
    const f = fixture({ manual: true, personSlot: true });
    await f.load();
    await f.api.applyView({ context: 'person-info', personId: 0, period: 1, name: '董卓' });
    assert.equal(f.elements['hd-portrait'].parentNode, f.body);
    assert.equal(f.elements['hd-portrait'].hidden, false);
});

test('unlisted 袁绍 ID 2 has a named reference fallback without guessed requests', async () => {
    const f = fixture();
    await f.load();
    const results = await Promise.all(Array.from({ length: 12 }, () => f.api.chooseSource(2, 1)));
    assert.ok(results.every((src) => src.mode === 'ref' && src.url === asset('refs/period-1/2-袁绍.png')));
    assert.deepEqual(f.requests, [asset('refs/period-1/2-袁绍.png')]);
});

test('missing HD falls back to the real reference and repeated calls do not repeat 404s', async () => {
    const f = fixture({ missing: new Set([asset(pilot.hd)]) });
    await f.load();
    const results = await Promise.all(Array.from({ length: 12 }, () => f.api.chooseSource(5, 1)));
    assert.ok(results.every((src) => src.mode === 'ref' && src.url === asset(pilot.ref)));
    assert.deepEqual(f.requests, [asset(pilot.hd), asset(pilot.ref)]);
    await f.api.chooseSource(5, 1);
    assert.equal(f.requests.length, 2);
});

test('person ID 0 remains valid in map, report, person menu and battle help', async () => {
    const f = fixture();
    await f.load();
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
    f.body.classList.add('baye-hd-overworld-map');
    f.context.baye = {
        data: { g_PIdx: 1, g_PlayerKing: 0, g_hdFightActive: 0, g_hdFightOver: 0,
            g_FoucsX: 3, g_FoucsY: 4, g_FgtParam: { GenArray: [1] }, g_GenPos: [{ x: 3, y: 4 }] },
        getPersonName: () => '董卓',
        hd: { report: () => ({ kind: 2, person: 0 }) }
    };
    assert.equal(f.api.detectView().personId, 0);
    personMenu(f, [{ pind: 0, name: '董卓' }]);
    assert.equal(f.api.detectView().personId, 0);
    f.context.BayeHdCityMenu.isOpen = () => false;
    f.context.BayeHdDialog = { debugSnapshot: () => ({ open: true, kind: 'report' }) };
    assert.equal(f.api.detectView().personId, 0);
    f.context.baye.data.g_hdFightActive = 1;
    personHelp(f);
    assert.equal(f.api.detectView().personId, 0);
});

test('battle help portrait uses the captured native person and name, never the current focus or a name lookup', async () => {
    const f = fixture();
    await f.load();
    f.context.baye = { data: { g_PIdx: 1, g_FoucsX: 3, g_FoucsY: 4,
        g_FgtParam: { GenArray: [2] }, g_GenPos: [{ x: 3, y: 4 }] },
        getPersonName() { throw new Error('native help already captured its actual name'); } };
    const model = personHelp(f, { person: 0, name: '原生董卓', slot: 4 });
    const before = JSON.stringify(f.context.baye.data);
    const view = f.api.detectView();
    assert.equal(view.personId, 0); assert.equal(view.name, '原生董卓');
    await f.api.applyView(view);
    assert.match(f.elements['hd-portrait-cap'].textContent, /^原生董卓/);
    model.help.kind = 2; model.help.complete = 0; model.publish();
    assert.equal(f.api.detectView(), null, 'terrain help cannot keep the former person');
    assert.equal(JSON.stringify(f.context.baye.data), before);
});

test('partial, stale and mismatched native help cannot recover a portrait from focus or retained dialogue identity', async () => {
    const invalid = [
        { complete: 0 }, { active: 0 }, { kind: 0 }, { protocolVersion: 0 },
        { person: 65535 }, { person: '0' }, { slot: 20 }, { generation: 2 },
        { detailGeneration: 4 }, { inputSeq: 41 }, { name: '' }, { seq: 9 }
    ];
    const f = fixture(); await f.load(); f.body.classList.add('baye-hd-overworld-map');
    f.context.baye = { data: { g_PIdx: 1, g_PlayerKing: 0, g_hdFightActive: 1,
        g_FoucsX: 0, g_FoucsY: 0, g_FgtParam: { GenArray: [1] }, g_GenPos: [{ x: 0, y: 0 }] } };
    for (const changes of invalid) {
        const model = personHelp(f); Object.assign(model.help, changes);
        assert.equal(f.api.detectView(), null, JSON.stringify(changes));
    }
    const model = personHelp(f);
    for (const kind of [0, 3, 10]) {
        model.fight.inputKind = kind;
        assert.equal(f.api.detectView(), null, `native wait kind ${kind} cannot borrow HELP9`);
    }
    model.fight.inputKind = 9; f.context.BayeHdDialog.shouldShowHd = () => false;
    assert.equal(f.api.detectView(), null, 'classic mode retires a still-buffered help before the dialog poll');
    assert.deepEqual(f.requests, []);
});

test('a new native help event retires an old pending portrait even when its person is unchanged', async () => {
    const f = fixture({ deferImages: true });
    const model = personHelp(f);
    await f.start(); assert.equal(f.deferred.length, 1);
    model.help.seq++; model.publish();
    f.resolveImages(); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, true, 'late old event cannot paint into the next event');
    const tick = [...f.intervals.values()][0]; tick(); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, false, 'the current event can use an already verified source');
    model.help.complete = 0; tick(); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, true);
    f.api.stop();
});

test('switching from a captured help person to a new native wait while images load keeps LCD', async () => {
    const f = fixture({ deferImages: true });
    const model = personHelp(f, { person: 1, name: '李儒' });
    await f.start(); assert.equal(f.deferred.length, 1);
    model.fight.inputKind = 3; model.fight.inputSeq++;
    f.resolveImages(); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, true);
    assert.equal(f.api.detectView(), null);
    f.api.stop();
});

test('period-specific IDs do not reuse the first period portrait', async () => {
    const targets = [[2, 1, '1-曹操.png'], [3, 4, '4-曹操.png'], [4, 0, '0-曹丕.png']];
    const missing = new Set(targets.map(([period, personId]) => manifest.entries.find(e => e.period === period && e.personId === personId)?.hd)
        .filter(Boolean).map(asset));
    const f = fixture({ missing });
    await f.load();
    for (const [period, personId, filename] of targets) {
        const src = await f.api.chooseSource(personId, period);
        assert.equal(src.mode, 'ref');
        assert.equal(src.url, asset(`refs/period-${period}/${filename}`));
    }
});

test('the actual loaded bytes authorize portraits at any path; unknown or missing bytes cannot inherit a familiar path', async () => {
    const f = fixture();
    await f.load();
    await f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '董卓' });
    assert.equal(f.elements['hd-portrait'].hidden, false);
    const requests = f.requests.length;
    for (const lib of ['libs/SGBY-Reset.lib', 'libs/sc-mod.lib', 'undefined', '']) {
        f.settings.set('baye/libpath', lib);
        assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd', 'known loaded bytes support aliases and a missing preferred path');
    }
    f.settings.set('baye/libpath', manifest.lib);
    for (const hex of [modifiedHex, '01020304', null, '', '0', 'not-hex']) {
        f.context.dynLib = hex;
        assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
        await f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '另一武将' });
        assert.equal(f.elements['hd-portrait'].hidden, true);
        assert.equal(f.api.detectView(), null);
        await f.settleIdentity();
        assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
    }
    assert.equal(f.requests.length, requests, 'unsupported LIB never probes default-LIB images');
    f.context.dynLib = dictionaryHex; await f.settleIdentity();
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
});

test('standalone preview is explicit and independent of preferences, and never supplies a runtime identity', async () => {
    const f = fixture({ lib: null, manual: true });
    await f.load();
    const preview = await f.api.chooseSource(0, 1);
    assert.equal(preview.mode, 'hd'); assert.equal(preview.preview, true);
    assert.equal(f.api.debugSnapshot().identity.status, 'unavailable');
    f.settings.set('baye/libpath', 'libs/sc-mod.lib');
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
    f.context.dynLib = modifiedHex;
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
    await f.settleIdentity(); assert.equal(f.api.debugSnapshot().preview, false);
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
});

test('missing both pictures hides the slot and caches misses; invalid IDs and periods make no requests', async () => {
    const f = fixture({ missing: new Set([asset(pilot.hd), asset(pilot.ref)]) });
    await f.load();
    await f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '董卓' });
    assert.equal(f.elements['hd-portrait'].hidden, false);
    const view = { context: 'person-info', personId: 5, period: 1, name: '马腾' };
    assert.equal((await f.api.applyView(view)).mode, 'lcd');
    assert.equal(f.elements['hd-portrait'].hidden, true);
    assert.equal(f.elements['hd-portrait-img'].getAttribute('src'), null);
    assert.equal(f.elements['hd-portrait-cap'].textContent, '');
    const requests = f.requests.length;
    for (let i = 0; i < 8; i++) assert.equal((await f.api.chooseSource(5, 1)).mode, 'lcd');
    for (const [id, period] of [[99999, 1], [-1, 1], [0.5, 1], [0, 0], [0, 5], [0, 1.5], [999, 1]]) {
        assert.equal((await f.api.chooseSource(id, period)).mode, 'lcd');
    }
    assert.equal(f.requests.length, requests);
});

test('missing or mismatched indexes do not guess identities', async () => {
    const noManifest = fixture({ missing: new Set([manifestUrl]) });
    await noManifest.load();
    assert.equal((await noManifest.api.chooseSource(0, 1)).mode, 'lcd');
    assert.equal(noManifest.requests.length, 0);
    const secondPeriod = manifest.entries.find(e => e.period === 2 && e.personId === 11);
    const noRefs = fixture({ missing: new Set([referencesUrl, asset(secondPeriod.hd)]) });
    await noRefs.load();
    assert.equal((await noRefs.api.chooseSource(2, 1)).mode, 'lcd');
    assert.equal((await noRefs.api.chooseSource(11, 2)).mode, 'ref', 'pilot manifest fallback still works');
    const mismatched = fixture({ references: { ...references, libSha256: '0'.repeat(64) } });
    await mismatched.load();
    assert.equal((await mismatched.api.chooseSource(2, 1)).mode, 'lcd');
    assert.equal(mismatched.requests.length, 0);
});

test('parallel index loading shares requests; an explicit reload retries previously missing art', async () => {
    const f = fixture({ missing: new Set([asset(pilot.hd)]) });
    const first = f.api.loadManifest();
    assert.equal(first, f.api.loadManifest());
    await first;
    await f.settleIdentity();
    assert.deepEqual(f.fetches, [manifestUrl, referencesUrl]);
    assert.equal((await f.api.chooseSource(5, 1)).mode, 'ref');
    f.missing.delete(asset(pilot.hd));
    await f.load();
    assert.equal((await f.api.chooseSource(5, 1)).mode, 'hd');
    assert.equal(f.requests.filter((url) => url === asset(pilot.hd)).length, 2);
});

test('engine Promise replacement before or after module loading cannot break native async work', async () => {
    for (const beforeLoad of [false, true]) {
        const f = fixture({ enginePromiseOverride: beforeLoad });
        if (!beforeLoad) {
            vm.runInContext('window.Promise = function EnginePromise() { throw new Error("engine callback shim cannot load portraits"); };', f.context);
        }
        await f.load();
        assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
        const secondPeriod = manifest.entries.find(e => e.period === 2 && e.personId === 11);
        assert.equal((await f.api.chooseSource(11, 2)).mode, existsSync(path.join(root, asset(secondPeriod.hd))) ? 'hd' : 'ref');
        assert.equal((await f.api.chooseSource(99999, 1)).mode, 'lcd');
        await f.load();
        assert.equal((await f.api.chooseSource(2, 1)).mode, 'ref');
    }
});

test('a LIB switch while an image is pending cannot paint old art or poison its source cache', async () => {
    const f = fixture({ deferImages: true });
    await f.load();
    const pending = f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '董卓' });
    await flush();
    f.context.dynLib = modifiedHex;
    f.resolveImages();
    assert.equal((await pending).mode, 'lcd');
    assert.equal(f.elements['hd-portrait'].hidden, true);
    f.context.dynLib = dictionaryHex; await f.settleIdentity();
    const fresh = f.api.chooseSource(0, 1); await flush(); f.resolveImages();
    assert.equal((await fresh).mode, 'hd');
});

test('automatic polling does not paint a stale person and can change views while a request is pending', async () => {
    const f = fixture({ deferImages: true });
    f.body.classList.add('baye-hd-overworld-map');
    f.context.baye = { data: { g_PIdx: 1, g_PlayerKing: 0 }, getPersonName: (id) => id === 0 ? '董卓' : '曹操' };
    await f.start();
    await flush();
    f.context.baye.data.g_PlayerKing = 1;
    // Resolving before the next polling tick must still reject the obsolete view.
    f.resolveImages();
    await flush();
    assert.equal(f.elements['hd-portrait'].hidden, true);
    const tick = [...f.intervals.values()][0];
    tick();
    await flush();
    f.context.baye.data.g_PlayerKing = 0;
    tick();
    await flush();
    assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), '0');
    f.resolveImages();
    await flush();
    assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), '0', 'late ID 1 result cannot overwrite ID 0');
    f.api.stop();
});

test('reloading indexes detaches obsolete pending work and restarts automatic lookup', async () => {
    const f = fixture({ deferImages: true });
    f.body.classList.add('baye-hd-overworld-map');
    f.context.baye = { data: { g_PIdx: 1, g_PlayerKing: 0 }, getPersonName: () => '董卓' };
    await f.start();
    await flush();
    assert.equal(f.deferred.length, 1);
    await f.load();
    [...f.intervals.values()][0]();
    await flush();
    assert.equal(f.deferred.length, 2, 'fresh generation starts independently of obsolete Image request');
    f.resolveImages();
    await flush();
    assert.equal(f.elements['hd-portrait'].hidden, false);
    assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), '0');
    f.api.stop();
});

function heldCrypto() {
    const digests = [];
    return { digests, crypto: { subtle: { digest(algorithm, bytes) {
        assert.equal(algorithm, 'SHA-256');
        const actual = webcrypto.subtle.digest(algorithm, bytes);
        let resolve, reject;
        const pending = new Promise((ok, fail) => { resolve = ok; reject = fail; });
        digests.push({ bytes: Buffer.from(bytes), async release() { resolve(await actual); },
            fail() { reject(new Error('fixture crypto unavailable')); } });
        return pending;
    } } } };
}

test('pending real-byte verification is LCD until the actual digest completes, with no optimistic image requests', async () => {
    const held = heldCrypto(), f = fixture({ crypto: held.crypto });
    await f.api.loadManifest();
    assert.equal(f.api.debugSnapshot().identity.status, 'pending');
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
    assert.equal((await f.api.applyView({ context: 'map-king', personId: 0, period: 1 })).mode, 'lcd');
    assert.equal(f.requests.length, 0);
    assert.deepEqual(held.digests[0].bytes, dictionaryBytes, 'the shared verifier receives the complete actual loaded dictionary');
    await held.digests[0].release(); await f.settleIdentity();
    assert.equal(f.api.debugSnapshot().identity.sha256, dictionarySha256);
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
    assert.equal(held.digests.length, 1);
});

test('late real digests cannot recover an obsolete dictionary after an unobserved byte change or unload', async () => {
    const held = heldCrypto(), f = fixture({ crypto: held.crypto });
    await f.api.loadManifest(); f.context.dynLib = modifiedHex;
    await held.digests[0].release(); await flush();
    assert.equal(held.digests.length, 2, 'digest completion detects a LIB switch even without a prior portrait poll');
    assert.equal(f.api.debugSnapshot().identity.status, 'pending');
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
    await held.digests[1].release(); await f.settleIdentity();
    assert.notEqual(f.api.debugSnapshot().identity.sha256, dictionarySha256);
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
    f.context.dynLib = dictionaryHex; f.api.detectView();
    assert.equal(held.digests.length, 3); f.context.dynLib = null;
    await held.digests[2].release(); await flush();
    assert.equal(f.api.debugSnapshot().identity.status, 'unavailable');
    assert.equal(f.api.debugSnapshot().identity.sha256, null); assert.deepEqual(f.requests, []);
});

test('missing identity/crypto, digest failures and missing or wrong manifest provenance remain neutral', async () => {
    for (const options of [{ identityModule: false }, { crypto: null },
        { manifest: { ...manifest, libSha256: undefined } }, { manifest: { ...manifest, libSha256: '0'.repeat(64) } }]) {
        const f = fixture(options); await f.load();
        assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd'); assert.deepEqual(f.requests, []);
    }
    const held = heldCrypto(), f = fixture({ crypto: held.crypto });
    await f.api.loadManifest(); held.digests[0].fail(); await f.settleIdentity();
    assert.equal(f.api.debugSnapshot().identity.status, 'error');
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd'); assert.deepEqual(f.requests, []);
});

test('preview image callbacks and cache entries cannot authorize or paint a later runtime on the same page', async () => {
    const f = fixture({ manual: true, deferImages: true }); await f.load();
    const view = { context: 'map-king', personId: 0, period: 1, name: '董卓' };
    const old = f.api.applyView(view); await flush(); assert.equal(f.deferred.length, 1);
    f.context.dynLib = dictionaryHex;
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd'); await f.settleIdentity();
    const fresh = f.api.applyView(view); await flush(); assert.equal(f.deferred.length, 2);
    f.deferred.shift().resolve(); assert.equal((await old).mode, 'lcd');
    assert.equal(f.elements['hd-portrait'].hidden, true);
    f.resolveImages(); const src = await fresh;
    assert.equal(src.mode, 'hd'); assert.equal(src.preview, false);
    assert.equal(f.elements['hd-portrait'].getAttribute('data-hd-portrait-source'), 'runtime');
    assert.ok(!f.elements['hd-portrait-cap'].textContent.includes('素材预览'));
});

test('manual preview name indexes retire when leaving and restoring their separate identity namespace', async () => {
    const f = fixture({ manual: true }); await f.load();
    const data = Object.freeze({ g_PIdx: 1 }); let names = ['甲', '乙'];
    f.context.baye = { data, getPersonCount: () => 2, getPersonName: i => names[i] };
    f.context.BayeHdCityMenu = { isOpen: () => true, debugSnapshot: () => ({ layer: 'deep',
        deepKind: 'person', idleIndex: 0, deepItems: [{ name: '甲' }] }) };
    assert.equal(f.api.detectView().personId, 0);
    const before = JSON.stringify(data);
    f.context.dynLib = modifiedHex; assert.equal(f.api.detectView(), null);
    names = ['乙', '甲']; f.context.dynLib = null; await f.settleIdentity();
    assert.equal(f.api.detectView().personId, 1);
    assert.equal(JSON.stringify(data), before, 'preview name lookup only reads artificial data');
});

test('runtime menus use the live native index and exact owner instead of a stale UI highlight', async () => {
    const f = fixture(); await f.load();
    const { menu, snap, own } = personMenu(f); snap.idleIndex = 1;
    const before = JSON.stringify({ menu, snap, data: f.context.baye.data });
    assert.equal(f.api.detectView().personId, 0);
    assert.equal(JSON.stringify({ menu, snap, data: f.context.baye.data }), before);
    menu.index = 1; snap.idleIndex = 0;
    assert.equal(f.api.detectView().personId, 1);
    for (const [field, invalid] of [['active', 0], ['context', 2], ['kind', 4], ['index', -1],
        ['index', menu.count], ['index', '0'], ['seq', 0], ['seq', '7']]) {
        const old = menu[field]; menu[field] = invalid;
        assert.equal(f.api.detectView(), null, 'invalid native ' + field); menu[field] = old;
    }
    menu.seq++; assert.equal(f.api.detectView(), null, 'stale city owner cannot claim the new menu');
    own(); assert.equal(f.api.detectView().personId, 1);
    snap.deepMenuOwner.key = JSON.stringify([1, 1, 3, menu.seq, ['李儒', '董卓']]);
    assert.equal(f.api.detectView(), null, 'the same sequence with another list is not the same owner');
    own(); snap.qtyActive = 1; assert.equal(f.api.detectView(), null);
    snap.qtyActive = 0; snap.engineHelpOpen = true; assert.equal(f.api.detectView(), null);
});

test('authenticated native menu IDs support identical names through the exact current index', async () => {
    const f = fixture(); await f.load();
    const model = nativeIdsMenu(f, [{ pind: 0, name: '同名武将' }, { pind: 1, name: '同名武将' }]);
    assert.equal(f.api.detectView().personId, 0);
    model.menu.index = 1;
    assert.equal(f.api.detectView().personId, 1, 'actual C index and ID own the second identical name');
    model.menu.idsValid = false; model.own();
    assert.equal(f.api.detectView(), null, 'missing native IDs cannot authorize ambiguous names');
    assert.deepEqual(f.requests, []);
});

test('native ID owner generation, full array, bounds and selected identity must all agree', async () => {
    const f = fixture(); await f.load();
    const changes = [
        model => { model.menu.generation++; }, model => { model.menu.detailGeneration++; },
        model => { model.menu.generation = 0; model.menu.detailGeneration = 0; model.own(); },
        model => { model.menu.ids = [0]; model.own(); },
        model => { model.menu.ids[1] = 200; model.own(); },
        model => { model.menu.ids[1] = '1'; model.own(); },
        model => { model.menu.ids = [1, 0]; },
        model => { model.snap.deepItems[0].pind = 1; },
        model => { model.snap.deepItems[0].i = 1; },
        model => { model.snap.deepMenuOwner.key = JSON.stringify([1, 1, 3, model.menu.seq, model.menu.names]); }
    ];
    for (const change of changes) {
        const model = nativeIdsMenu(f); change(model);
        assert.equal(f.api.detectView(), null);
    }
    assert.deepEqual(f.requests, []);
});

test('a seven-part owner without native ID metadata preserves only the old complete unique-list fallback', async () => {
    const f = fixture(); await f.load();
    const model = nativeIdsMenu(f);
    model.menu.idsValid = false; model.own();
    assert.equal(f.api.detectView().personId, 0);
    model.snap.deepItems[0] = { i: 0, name: '董卓' };
    assert.equal(f.api.detectView(), null, 'no person ID is ever inferred from the name');
    model.snap.deepItems[0].pind = 0;
    model.snap.deepMenuOwner.key = JSON.stringify([1, 1, 3, model.menu.seq, model.menu.names, 3, null]);
    assert.equal(f.api.detectView(), null, 'owner generation cannot drift silently');
});

test('a new native ID generation retires an old pending menu portrait before the next poll', async () => {
    const f = fixture({ deferImages: true }); const model = nativeIdsMenu(f);
    await f.start(); assert.equal(f.deferred.length, 1);
    model.menu.generation++; model.menu.detailGeneration++; model.own();
    f.resolveImages(); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, true);
    [...f.intervals.values()][0](); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, false);
    assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), '0');
    f.api.stop();
});

test('filtered, reordered, duplicate and nameless-ID native menus never infer a runtime person from a name', async () => {
    for (const items of [[{ name: '董卓' }], [{ name: '李儒' }, { name: '董卓' }],
        [{ name: '同名' }, { name: '同名' }], [{ pind: 0, name: '同名' }, { pind: 1, name: '同名' }]]) {
        const f = fixture(); await f.load(); let nameReads = 0;
        f.context.baye = { data: Object.freeze({ g_PIdx: 1 }), getPersonName() { nameReads++; return '董卓'; }, getPersonCount: () => 200 };
        personMenu(f, items); assert.equal(f.api.detectView(), null);
        assert.equal(nameReads, 0, 'missing exact IDs do not start a native name search');
        assert.equal(f.requests.length, 0);
    }
    const f = fixture(); await f.load(); const { menu, snap, own } = personMenu(f);
    menu.names.reverse(); own(); assert.equal(f.api.detectView(), null, 'old item IDs do not survive reordered native names');
    menu.names.reverse(); own(); snap.deepItems[0].i = 1;
    assert.equal(f.api.detectView(), null, 'an item from another native index cannot supply its ID');
    snap.deepItems[0].i = 0;
    for (const id of [null, '0', -1, 0xfffe, 200]) {
        snap.deepItems[0].pind = id; assert.equal(f.api.detectView(), null, 'invalid or outside native person ID ' + id);
    }
});

test('person detail identities require the same native owner, index, name and exact person ID', async () => {
    const f = fixture(); await f.load(); const { menu, snap } = personMenu(f);
    delete snap.deepItems[0].pind;
    const detail = { ownerKey: snap.deepMenuOwner.key, context: 1, kind: 3, seq: menu.seq,
        nativeIndex: 0, personIndex: 0, name: '董卓' };
    snap.personDetail = { ...detail }; assert.equal(f.api.detectView().personId, 0);
    for (const [field, value] of [['ownerKey', 'old'], ['context', 2], ['kind', 4], ['seq', menu.seq + 1],
        ['nativeIndex', 1], ['personIndex', '0'], ['personIndex', 200], ['name', '李儒']]) {
        snap.personDetail = { ...detail, [field]: value }; assert.equal(f.api.detectView(), null, 'stale detail ' + field);
    }
    snap.personDetail = { ...detail }; snap.deepItems[0].pind = 1;
    assert.equal(f.api.detectView(), null, 'disagreeing list and detail identities remain neutral');
    const large = fixture(); await large.load();
    const list = Array.from({ length: 21 }, (_, pind) => ({ pind, name: '将' + pind }));
    const state = personMenu(large, list); state.menu.index = 20; state.snap.deepItems.length = 20;
    state.snap.personDetail = { ownerKey: state.snap.deepMenuOwner.key, context: 1, kind: 3,
        seq: state.menu.seq, nativeIndex: 20, personIndex: 20, name: '将20' };
    assert.equal(large.api.detectView().personId, 20, 'exact detail identity also works beyond the twenty diagnostic list entries');
});

test('a native owner or index change retires pending menu portraits before the next poll', async () => {
    const f = fixture({ deferImages: true }); const { menu, snap, own } = personMenu(f);
    await f.start(); assert.equal(f.deferred.length, 1);
    menu.index = 1; snap.idleIndex = 0;
    f.resolveImages(); await flush(); assert.equal(f.elements['hd-portrait'].hidden, true);
    const tick = [...f.intervals.values()][0]; tick(); await flush(); assert.equal(f.deferred.length, 1);
    menu.seq++; own();
    f.resolveImages(); await flush(); assert.equal(f.elements['hd-portrait'].hidden, true, 'same person under a new native owner still retires old work');
    tick(); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, false);
    assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), '1');
    menu.active = 0; tick(); await flush(); assert.equal(f.elements['hd-portrait'].hidden, true);
    f.api.stop();
});

test('an explicit standalone preview can display an artificial name without granting runtime menu identity', async () => {
    const f = fixture({ manual: true }); await f.load();
    f.context.baye = { data: { g_PIdx: 1 }, getPersonCount: () => 1, getPersonName: () => '预览人物' };
    f.context.BayeHdCityMenu = { isOpen: () => true, debugSnapshot: () => ({ layer: 'deep',
        deepKind: 'person', idleIndex: 0, deepItems: [{ name: '预览人物' }] }) };
    const view = f.api.detectView(); assert.equal(view.personId, 0); assert.equal(view.name, '预览人物');
    await f.api.applyView(view); assert.equal(f.elements['hd-portrait'].getAttribute('data-hd-portrait-source'), 'preview');
    f.context.dynLib = dictionaryHex; await f.settleIdentity();
    assert.equal(f.api.detectView(), null, 'the same artificial list cannot become a runtime menu');
});

test('terrain-only and ordinary observer hooks do not revoke authenticated portraits or cause another digest', async () => {
    let calls = 0;
    const f = fixture({ crypto: { subtle: { digest(algorithm, bytes) { calls++; return webcrypto.subtle.digest(algorithm, bytes); } } } });
    await f.load();
    const hooks = Object.freeze({ drawMapUnit() {}, getTerrainInfo() {}, loadFightMap() {}, didLoadGame() {}, onMenuIdle() {} });
    f.context.baye = Object.freeze({ hooks, data: Object.freeze({ g_PIdx: 1 }) });
    const before = JSON.stringify(f.context.baye);
    for (let i = 0; i < 5; i++) assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
    assert.equal(calls, 1); assert.equal(JSON.stringify(f.context.baye), before);
});

test('hidden pages and stop detach pending portrait work; restart paints only the latest native person', async () => {
    const f = fixture({ deferImages: true }); f.body.classList.add('baye-hd-overworld-map');
    f.context.baye = { data: { g_PIdx: 1, g_PlayerKing: 0 }, getPersonName: id => id === 0 ? '董卓' : '李儒' };
    await f.start(); assert.equal(f.deferred.length, 1);
    f.setHidden(true); f.resolveImages(); await flush();
    assert.equal(f.elements['hd-portrait'].hidden, true);
    f.context.baye.data.g_PlayerKing = 1;
    for (const callback of f.intervals.values()) callback(); assert.equal(f.deferred.length, 0);
    f.setHidden(false); await flush(); assert.equal(f.deferred.length, 1);
    f.api.stop(); f.resolveImages(); await flush(); assert.equal(f.elements['hd-portrait'].hidden, true);
    assert.equal(f.intervals.size, 0);
    await f.start(); await flush(); assert.equal(f.intervals.size, 1);
    f.resolveImages(); await flush();
    assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), '1');
    assert.equal(f.elements['hd-portrait'].hidden, false);
    assert.equal(f.listeners.get('visibilitychange').length, 1); f.api.stop();
});

test('late manifest loading cannot restart a stopped portrait session or duplicate a newer start', async () => {
    function prepare() {
        const f = fixture({ deferFetches: true });
        f.body.classList.add('baye-hd-overworld-map');
        f.context.baye = { data: { g_PIdx: 1, g_PlayerKing: 0 }, getPersonName: () => '董卓' };
        return f;
    }
    const stopped = prepare();
    const abandonedStart = stopped.api.start();
    assert.equal(stopped.fetches.length, 2);
    stopped.api.stop();
    stopped.resolveFetches(); await abandonedStart; await stopped.settleIdentity();
    assert.equal(stopped.intervals.size, 0, 'late manifest must not recreate the stopped timer');
    assert.equal(stopped.requests.length, 0, 'late manifest must not resume portrait probing');
    assert.equal(stopped.elements['hd-portrait'].hidden, true);

    const restarted = prepare();
    const oldStart = restarted.api.start(); restarted.api.stop();
    restarted.context.baye.data.g_PlayerKing = 1;
    const newStart = restarted.api.start();
    assert.equal(restarted.fetches.length, 2, 'restart shares the still pending manifest request');
    restarted.resolveFetches(); await Promise.all([oldStart, newStart]); await restarted.settleIdentity();
    assert.equal(restarted.intervals.size, 1, 'only the current start may create a timer');
    assert.equal(restarted.requests.length, 1);
    assert.equal(restarted.elements['hd-portrait'].getAttribute('data-person-id'), '1');
    assert.equal(restarted.elements['hd-portrait'].hidden, false);
    restarted.api.stop(); assert.equal(restarted.intervals.size, 0);
});

test('shipped portrait provenance matches the actual immutable dictionary bytes', () => {
    assert.equal(manifest.libSha256, dictionarySha256); assert.equal(references.libSha256, dictionarySha256);
});

function actualDumpFunction(name) {
    const match = new RegExp('^function ' + name + '\\([^]*?\\)\\s*\\{', 'm').exec(dumpText);
    assert.ok(match, `actual dump helper ${name} exists`);
    const end = dumpText.indexOf('\n}', match.index);
    assert.ok(end > match.index); return dumpText.slice(match.index, end + 2);
}

function dumpSmokePolicy() {
    // Execute the actual policy with in-memory indexes; never run a native
    // export or change any of the shipped 800 references for this regression.
    const context = vm.createContext({ Map, Set, path, PILOT_NAMES: manifest.pilotNames });
    for (const name of ['safeRef', 'hasStandardSmokeExport']) vm.runInContext(actualDumpFunction(name), context, { timeout: 1000 });
    return context.hasStandardSmokeExport;
}

test('normal full standard export permits strict39 smoke only with all matching native identities', () => {
    const policy = dumpSmokePolicy();
    assert.equal(policy(manifest, references), true);
    assert.equal(policy({ ...manifest, lib: 'preferred/custom-alias.lib' }, { ...references, lib: 'cached/alias.lib' }), true,
        'actual SHA and captured reference identities decide, not the preferred path');
    assert.equal(policy({ ...manifest, entries: [...manifest.entries].reverse() }, references), true,
        'independent manifest ordering does not change period/person identity');
});

test('normal period/limit subsets and other actual libraries retain export success without standard39 smoke', async () => {
    const policy = dumpSmokePolicy();
    const subset = { ...references, periods: references.periods.filter(p => p.period === 1)
        .map(p => ({ ...p, people: p.people.filter(person => person.id < 8) })) };
    const partial = { ...manifest, entries: manifest.entries.filter(e => e.period === 1 && e.personId < 8) };
    assert.equal(policy(partial, subset), false);
    assert.equal(policy(manifest, subset), false, 'old complete HD metadata cannot authorize a partial captured reference index');
    const actualOtherSha = createHash('sha256').update(Buffer.from(modifiedHex, 'hex')).digest('hex');
    assert.equal(policy({ ...manifest, libSha256: actualOtherSha }, { ...references, libSha256: actualOtherSha }), false);
    const exported = await dumpFixture(modifiedHex);
    assert.equal((await exported.post({ kind: 'summary', summary: dumpSummary })).code, 200,
        'a genuine other-LIB dump succeeds independently of the standard asset acceptance');
    assert.equal(policy(exported.server.manifest, exported.server.summary), false);
    assert.equal(exported.writes.size, 2, 'other-LIB export still commits its own verified reference index and manifest');
});

test('standard smoke refuses mismatched references, duplicate identities and incomplete39 metadata', () => {
    const policy = dumpSmokePolicy(), clone = value => JSON.parse(JSON.stringify(value));
    assert.equal(policy(manifest, { ...references, libSha256: '0'.repeat(64) }), false);
    for (const mutate of [
        m => { m.entries[0].missing = true; },
        m => { delete m.entries[0].missing; },
        m => { m.entries[0].name = '另一位武将'; },
        m => { m.entries[0].ref = m.entries[1].ref; },
        m => { m.entries[0] = clone(m.entries[1]); },
        m => { m.missingPilots = ['马腾']; }
    ]) {
        const changed = clone(manifest); mutate(changed); assert.equal(policy(changed, references), false);
    }
    for (const mutate of [
        r => { r.periods[0].people.find(p => p.id === pilot.personId).name = '不同索引名称'; },
        r => { r.periods[0].people.find(p => p.id === pilot.personId).skipped = true; },
        r => { r.periods[0].people.find(p => p.id === pilot.personId).file = 'period-2/5-马腾.png'; },
        r => { r.periods[0].people.push(clone(r.periods[0].people[0])); },
        r => { r.periods.push(clone(r.periods[0])); }
    ]) {
        const changed = clone(references); mutate(changed); assert.equal(policy(manifest, changed), false);
    }
});

async function dumpFixture(hex) {
    let handler;
    const writes = new Map();
    const server = { listen(port, host, ready) { ready(); } };
    const context = vm.createContext({ root, path, Buffer, Map, URL, createHash, port: 8765, MIME: {},
        PILOT_NAMES: ['董卓'], http: { createServer(fn) { handler = fn; return server; } },
        fs: { existsSync: () => true, mkdirSync() {},
            readFileSync: () => JSON.stringify(manifest),
            writeFileSync(filename, bytes) { writes.set(filename, bytes); } } });
    for (const name of ['safeRef', 'existingHdPaths', 'buildManifest', 'startServer']) {
        vm.runInContext(actualDumpFunction(name), context);
    }
    await context.startServer();
    server.cdp = { async send(method, params) {
        assert.equal(method, 'Runtime.evaluate'); assert.match(params.expression, /window\.dynLib/);
        return { result: { value: hex } };
    } };
    async function post(payload) {
        const requestHandlers = {};
        const req = { method: 'POST', url: '/dump', on(name, fn) { requestHandlers[name] = fn; }, destroy() {} };
        let code;
        const response = new Promise(resolve => {
            handler(req, { writeHead(status) { code = status; }, end(text) { resolve({ code, text }); } });
        });
        requestHandlers.data(Buffer.from(JSON.stringify(payload))); await requestHandlers.end();
        return response;
    }
    return { writes, post, server };
}
const dumpSummary = { lib: 'libs/sc-mod.lib', periods: [{ period: 1,
    people: [{ id: 0, name: '董卓', file: 'period-1/0-董卓.png' }] }] };

test('actual dump backend stages PNGs and binds generated indexes to live loaded bytes rather than the summary path', async () => {
    const f = await dumpFixture(dictionaryHex);
    const png = Buffer.alloc(24); png[0] = 0x89; png[1] = 0x50;
    assert.equal((await f.post({ file: 'period-1/0-董卓.png', pngBase64: png.toString('base64') })).code, 200);
    assert.equal(f.writes.size, 0, 'unverified dump images do not overwrite old-provenance references');
    assert.equal((await f.post({ kind: 'summary', summary: dumpSummary })).code, 200);
    assert.equal(f.server.summary.libSha256, dictionarySha256);
    assert.equal(f.server.manifest.libSha256, dictionarySha256);
    assert.equal(f.server.manifest.entries[0].hd, manifest.entries.find(e => e.period === 1 && e.personId === 0).hd,
        'existing HD slots survive only when their actual dictionary identity matches');
    assert.equal(f.writes.size, 3);
    const changed = await dumpFixture(modifiedHex);
    assert.equal((await changed.post({ kind: 'summary', summary: dumpSummary })).code, 200);
    assert.notEqual(changed.server.manifest.libSha256, dictionarySha256);
    assert.match(changed.server.manifest.entries[0].hd, /^hd\/by-lib\/[0-9a-f]{64}\//,
        'new LIB identity cannot silently inherit prior custom HD filenames');
});

test('failed actual dump source verification leaves all native references and provenance files untouched', async () => {
    for (const hex of [null, '', '0', 'not-hex']) {
        const f = await dumpFixture(hex), png = Buffer.alloc(24); png[0] = 0x89; png[1] = 0x50;
        await f.post({ file: 'period-1/0-董卓.png', pngBase64: png.toString('base64') });
        assert.equal((await f.post({ kind: 'summary', summary: dumpSummary })).code, 503);
        assert.equal(f.writes.size, 0); assert.equal(f.server.pendingPngs.size, 0);
    }
});

after(() => {
    assert.equal(readFileSync(path.join(root, 'js/hd-portraits.js'), 'utf8'), moduleText, 'tests preserve production portrait source');
    assert.equal(readFileSync(path.join(root, 'scripts/dump-hd-portraits.mjs'), 'utf8'), dumpText, 'tests preserve production dump source');
    assert.deepEqual(readFileSync(path.join(root, 'libs/dat-mod.lib')), dictionaryBytes, 'tests preserve native LIB bytes');
});
