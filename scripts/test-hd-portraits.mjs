#!/usr/bin/env node
// Exercises the shipped browser module and real asset indexes without Chrome or npm packages.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleText = readFileSync(path.join(root, 'js/hd-portraits.js'), 'utf8');
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
    const deferred = [];
    const intervals = new Map();
    const missing = options.missing ?? new Set();
    function element() {
        const attrs = new Map();
        const classes = new Set();
        return {
            hidden: true,
            textContent: '',
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
            addEventListener() {},
            getElementById: (id) => elements[id] ?? null
        },
        localStorage: { getItem: (key) => settings.get(key) ?? null },
        Image,
        fetch: async (url) => {
            fetches.push(url);
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
    vm.runInContext(moduleText, context, { filename: 'js/hd-portraits.js' });
    return {
        api: context.BayeHdPortraits, context, elements, body, settings,
        requests, fetches, missing, deferred, intervals,
        resolveImages() { deferred.splice(0).forEach((item) => item.resolve()); }
    };
}

test('all 800 shipped references resolve through their exported filenames', async () => {
    const f = fixture();
    await f.api.loadManifest();
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

test('unlisted 袁绍 ID 2 has a named reference fallback without guessed requests', async () => {
    const f = fixture();
    await f.api.loadManifest();
    const results = await Promise.all(Array.from({ length: 12 }, () => f.api.chooseSource(2, 1)));
    assert.ok(results.every((src) => src.mode === 'ref' && src.url === asset('refs/period-1/2-袁绍.png')));
    assert.deepEqual(f.requests, [asset('refs/period-1/2-袁绍.png')]);
});

test('missing HD falls back to the real reference and repeated calls do not repeat 404s', async () => {
    const f = fixture({ missing: new Set([asset(pilot.hd)]) });
    await f.api.loadManifest();
    const results = await Promise.all(Array.from({ length: 12 }, () => f.api.chooseSource(5, 1)));
    assert.ok(results.every((src) => src.mode === 'ref' && src.url === asset(pilot.ref)));
    assert.deepEqual(f.requests, [asset(pilot.hd), asset(pilot.ref)]);
    await f.api.chooseSource(5, 1);
    assert.equal(f.requests.length, 2);
});

test('person ID 0 remains valid in map, report, person menu and battle help', async () => {
    const f = fixture();
    await f.api.loadManifest();
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
    f.body.classList.add('baye-hd-overworld-map');
    f.context.baye = {
        data: { g_PIdx: 1, g_PlayerKing: 0, g_hdFightActive: 0, g_hdFightOver: 0,
            g_FoucsX: 3, g_FoucsY: 4, g_FgtParam: { GenArray: [1] }, g_GenPos: [{ x: 3, y: 4 }] },
        getPersonName: () => '董卓',
        hd: { report: () => ({ kind: 2, person: 0 }) }
    };
    assert.equal(f.api.detectView().personId, 0);
    f.context.BayeHdCityMenu = {
        isOpen: () => true,
        debugSnapshot: () => ({ layer: 'deep', deepKind: 'person', idleIndex: 0, deepItems: [{ pind: 0, name: '董卓' }] })
    };
    assert.equal(f.api.detectView().personId, 0);
    f.context.BayeHdCityMenu.isOpen = () => false;
    f.context.BayeHdDialog = { debugSnapshot: () => ({ open: true, kind: 'report' }) };
    assert.equal(f.api.detectView().personId, 0);
    f.context.BayeHdDialog.debugSnapshot = () => ({ open: true, kind: 'help' });
    f.context.baye.data.g_hdFightActive = 1;
    assert.equal(f.api.detectView().personId, 0);
});

test('period-specific IDs do not reuse the first period portrait', async () => {
    const f = fixture();
    await f.api.loadManifest();
    for (const [period, personId, filename] of [
        [2, 1, '1-曹操.png'], [3, 4, '4-曹操.png'], [4, 0, '0-曹丕.png']
    ]) {
        const src = await f.api.chooseSource(personId, period);
        assert.equal(src.mode, 'ref');
        assert.equal(src.url, asset(`refs/period-${period}/${filename}`));
    }
});

test('unsupported or custom LIB, including missing selection, always uses engine LCD', async () => {
    const f = fixture();
    await f.api.loadManifest();
    await f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '董卓' });
    assert.equal(f.elements['hd-portrait'].hidden, false);
    const requests = f.requests.length;
    for (const lib of ['libs/SGBY-Reset.lib', 'libs/sc-mod.lib', 'undefined', '']) {
        f.settings.set('baye/libpath', lib);
        assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
        await f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '另一武将' });
        assert.equal(f.elements['hd-portrait'].hidden, true);
        assert.equal(f.api.detectView(), null);
    }
    assert.equal(f.requests.length, requests, 'unsupported LIB never probes default-LIB images');
    f.settings.set('baye/libpath', manifest.lib);
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
});

test('standalone preview without selection works; an explicit unsupported LIB still cannot reuse assets', async () => {
    const f = fixture({ lib: null, manual: true });
    await f.api.loadManifest();
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
    f.settings.set('baye/libpath', 'libs/sc-mod.lib');
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'lcd');
});

test('missing both pictures hides the slot and caches misses; invalid IDs and periods make no requests', async () => {
    const f = fixture({ missing: new Set([asset(pilot.hd), asset(pilot.ref)]) });
    await f.api.loadManifest();
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
    await noManifest.api.loadManifest();
    assert.equal((await noManifest.api.chooseSource(0, 1)).mode, 'lcd');
    assert.equal(noManifest.requests.length, 0);
    const noRefs = fixture({ missing: new Set([referencesUrl]) });
    await noRefs.api.loadManifest();
    assert.equal((await noRefs.api.chooseSource(2, 1)).mode, 'lcd');
    assert.equal((await noRefs.api.chooseSource(11, 2)).mode, 'ref', 'pilot manifest fallback still works');
    const mismatched = fixture({ references: { ...references, lib: 'libs/sc-mod.lib' } });
    await mismatched.api.loadManifest();
    assert.equal((await mismatched.api.chooseSource(2, 1)).mode, 'lcd');
    assert.equal(mismatched.requests.length, 0);
});

test('parallel index loading shares requests; an explicit reload retries previously missing art', async () => {
    const f = fixture({ missing: new Set([asset(pilot.hd)]) });
    const first = f.api.loadManifest();
    assert.equal(first, f.api.loadManifest());
    await first;
    assert.deepEqual(f.fetches, [manifestUrl, referencesUrl]);
    assert.equal((await f.api.chooseSource(5, 1)).mode, 'ref');
    f.missing.delete(asset(pilot.hd));
    await f.api.loadManifest();
    assert.equal((await f.api.chooseSource(5, 1)).mode, 'hd');
    assert.equal(f.requests.filter((url) => url === asset(pilot.hd)).length, 2);
});

test('engine Promise replacement before or after module loading cannot break native async work', async () => {
    for (const beforeLoad of [false, true]) {
        const f = fixture({ enginePromiseOverride: beforeLoad });
        if (!beforeLoad) {
            vm.runInContext('window.Promise = function EnginePromise() { throw new Error("engine callback shim cannot load portraits"); };', f.context);
        }
        await f.api.loadManifest();
        assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
        assert.equal((await f.api.chooseSource(11, 2)).mode, 'ref');
        assert.equal((await f.api.chooseSource(99999, 1)).mode, 'lcd');
        await f.api.loadManifest();
        assert.equal((await f.api.chooseSource(2, 1)).mode, 'ref');
    }
});

test('a LIB switch while an image is pending cannot paint old art or poison its source cache', async () => {
    const f = fixture({ deferImages: true });
    await f.api.loadManifest();
    const pending = f.api.applyView({ context: 'map-king', personId: 0, period: 1, name: '董卓' });
    await flush();
    f.settings.set('baye/libpath', 'libs/sc-mod.lib');
    f.resolveImages();
    assert.equal((await pending).mode, 'lcd');
    assert.equal(f.elements['hd-portrait'].hidden, true);
    f.settings.set('baye/libpath', manifest.lib);
    assert.equal((await f.api.chooseSource(0, 1)).mode, 'hd');
});

test('automatic polling does not paint a stale person and can change views while a request is pending', async () => {
    const f = fixture({ deferImages: true });
    f.body.classList.add('baye-hd-overworld-map');
    f.context.baye = { data: { g_PIdx: 1, g_PlayerKing: 0 }, getPersonName: (id) => id === 0 ? '董卓' : '曹操' };
    await f.api.start();
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
    await f.api.start();
    await flush();
    assert.equal(f.deferred.length, 1);
    await f.api.loadManifest();
    [...f.intervals.values()][0]();
    await flush();
    assert.equal(f.deferred.length, 2, 'fresh generation starts independently of obsolete Image request');
    f.resolveImages();
    await flush();
    assert.equal(f.elements['hd-portrait'].hidden, false);
    assert.equal(f.elements['hd-portrait'].getAttribute('data-person-id'), '0');
    f.api.stop();
});
