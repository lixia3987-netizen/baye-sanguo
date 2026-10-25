import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const file = name => readFileSync(new URL('../' + name, import.meta.url));
const asset = name => JSON.parse(file('assets/hd-overworld/' + name));
const standardLib = file('libs/dat-mod.lib').toString('hex');
const modLib = file('libs/sc-mod.lib').toString('hex');
const standardHash = createHash('sha256').update(Buffer.from(standardLib, 'hex')).digest('hex');
const productionManifest = asset('manifest.json');
const productionGeo = asset('china-lcc-cities.json');
const plain = value => JSON.parse(JSON.stringify(value));
const descriptors = productionManifest.layers.environment.layers.filter(layer => layer.draw === true);
assert.ok(descriptors.length >= 2, 'the production manifest declares actual mountain and forest art');
const source = file('js/hd-overworld.js').toString('utf8').replace(/\}\)\(window\);\s*$/,
    'global.__environment = {state, draw};\n})(window);');

function dimensions(name) {
    const bytes = file(name);
    if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
        assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
        return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    }
    assert.equal(bytes.readUInt16BE(0), 0xffd8, 'image fixture is a real PNG or JPEG');
    for (let offset = 2; offset + 7 < bytes.length;) {
        assert.equal(bytes[offset], 0xff);
        while (bytes[offset] === 0xff) offset++;
        const marker = bytes[offset++], length = bytes.readUInt16BE(offset);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
            return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
        }
        assert.ok(length >= 2); offset += length;
    }
    throw new Error('Actual JPEG dimensions were not found: ' + name);
}

function harness({ hex = standardLib } = {}) {
    const requests = [], images = [], keys = [], writes = [], paints = [], frames = new Map(), timers = new Map(), nodes = new Map();
    const listeners = new Map(), preferences = new Map([['baye/overworldMode', 'hd-map'], ['baye/libpath', 'libs/dat-mod.lib']]);
    let nextId = 0, now = 10000;
    class Clock extends Date { static now() { return now; } }
    function canvasContext(id) {
        const stack = []; let alpha = 1, composite = 'source-over';
        return new Proxy({
            get globalAlpha() { return alpha; }, set globalAlpha(value) { alpha = value; },
            get globalCompositeOperation() { return composite; }, set globalCompositeOperation(value) { composite = value; },
            save() { stack.push([alpha, composite]); }, restore() { if (stack.length) [alpha, composite] = stack.pop(); },
            drawImage(...args) { paints.push({ id, method: 'drawImage', args, alpha, composite }); },
            measureText: text => ({ width: String(text).length * 12 }),
            createLinearGradient: () => ({ addColorStop() {} }),
            getImageData: () => ({ data: [0, 0, 0, 0] })
        }, { get(target, key) { return key in target ? target[key] : (...args) => paints.push({ id, method: key, args }); } });
    }
    function element(id) {
        const attrs = new Map(), classes = new Set(), handlers = new Map(), ctx = canvasContext(id);
        const children = [];
        return { id, width: 1920, height: 1080, style: { setProperty() {} }, textContent: '', attrs, classes, handlers, children,
            appendChild: child => children.push(child),
            classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); },
                add: name => classes.add(name), remove: name => classes.delete(name) },
            setAttribute: (key, value) => attrs.set(key, String(value)), getAttribute: key => attrs.get(key),
            addEventListener(name, callback) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(callback); },
            querySelectorAll: () => [], getContext: () => ctx,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }) };
    }
    for (const id of ['hd-overworld', 'hd-overworld-canvas', 'hd-overworld-hud-left', 'hd-overworld-hud-right',
        'hd-overworld-legend-owned', 'hd-overworld-legend-neutral', 'hd-overworld-legend-empty']) nodes.set(id, element(id));
    const document = { hidden: false, body: element('body'), documentElement: element('html'),
        getElementById: id => nodes.get(id) || null, querySelectorAll: () => [], createElement: () => element('scratch'),
        addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(handler); } };
    const raw = { g_PlayerKing: 0, g_PIdx: 1, g_YearDate: 190, g_MonthDate: 1,
        g_Cities: productionGeo.cities.map(() => ({ Belong: 1 })),
        g_CityPositions: productionGeo.cities.map(city => ({ x: city.engX, y: city.engY })),
        g_CityPos: new Proxy({ setx: 1, sety: 0, x: 0, y: 0 }, {
            set(target, key, value) { writes.push([key, value]); target[key] = value; return true; }
        }) };
    const beforeRaw = JSON.stringify(raw);
    class XMLHttpRequest { open(method, url) { this.url = url; } send() { requests.push(this); } }
    class Image { set src(url) { this.url = url; this.complete = false; images.push(this); } }
    const context = vm.createContext({ document, console: { log() {}, warn() {} }, Image, XMLHttpRequest,
        crypto: webcrypto, Uint8Array, Date: Clock, dynLib: hex,
        Promise: class { constructor() { throw new Error('the engine Promise shim cannot replace native crypto promises'); } },
        localStorage: { getItem: key => preferences.get(key) || null, setItem: (key, value) => preferences.set(key, String(value)) },
        baye: { data: raw, ensureData: () => raw, hdCityLimit: () => raw.g_Cities.length,
            getCityName: i => productionGeo.cities[i].name, hooks: {},
            callHook(name, value) { return this.hooks[name]?.(value); },
            hd: { ready: () => true, menuItems: () => ({ active: 0 }), march: () => ({ pick: 1, battlePick: 0, mapInputSeq: 1, mapCity: 1 }),
                fight: () => ({ active: 0, over: 0 }), report: () => ({ active: 0 }), miniMap: () => ({ active: 0 }) } },
        sendKey: key => keys.push(key), addEventListener() {}, devicePixelRatio: 1,
        requestAnimationFrame: fn => { const id = ++nextId; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setTimeout: fn => { const id = ++nextId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
    context.window = context;
    for (const name of ['hd-lib-identity.js', 'hd-overworld-layers.js']) vm.runInContext(file('js/' + name).toString('utf8'), context, { filename: name });
    vm.runInContext(source, context, { filename: 'js/hd-overworld.js' });
    const api = context.BayeHdOverworld; api.start();
    function response(request, value) {
        request.readyState = 4; request.status = 200; request.responseText = JSON.stringify(value); request.responded = true; request.onreadystatechange();
    }
    function imageResponse(image, { missingPath, wrongPath } = {}) {
        const name = decodeURIComponent(image.url.split('?')[0]);
        image.resolved = true;
        if (missingPath && name.endsWith(missingPath)) { image.onerror(); return; }
        const [w, h] = dimensions(name);
        image.width = image.naturalWidth = w + (wrongPath && name.endsWith(wrongPath) ? 1 : 0);
        image.height = image.naturalHeight = h; image.complete = true; image.onload();
    }
    function complete({ manifest = asset('manifest.json'), geo = asset('china-lcc-cities.json'), missingPath, wrongPath } = {}) {
        const request = requests.find(item => !item.responded && item.url.split('?')[0].endsWith('manifest.json'));
        assert.ok(request, 'the actual verified standard LIB requested assets'); response(request, manifest);
        for (const request of requests.filter(item => !item.responded)) {
            response(request, request.url.split('?')[0].endsWith('china-lcc-cities.json') ? geo :
                request.url.split('?')[0].endsWith('roads/adjacency.json') ? asset('roads/adjacency.json') : asset('palette/factions.json'));
        }
        for (const image of images.filter(item => !item.resolved)) imageResponse(image, { missingPath, wrongPath });
    }
    return { api, context, raw, state: context.__environment.state, document, nodes, requests, images, frames, paints, keys, writes,
        complete, response, imageResponse, makeContext: canvasContext, draw: () => context.__environment.draw(),
        setHidden(hidden) { document.hidden = hidden; for (const handler of listeners.get('visibilitychange') || []) handler(); },
        async ready() {
            for (let i = 0; i < 100 && context.BayeHdLibIdentity.read().status === 'pending'; i++) await new Promise(resolve => setTimeout(resolve, 2));
            return context.BayeHdLibIdentity.read();
        },
        noInput() { assert.deepEqual(keys, []); assert.deepEqual(writes, []); assert.equal(JSON.stringify(raw), beforeRaw); } };
}
async function loaded(options = {}) {
    const h = harness(); assert.equal((await h.ready()).sha256, standardHash); h.complete(options);
    assert.equal(h.api.debugSnapshot().presentationReady, true); assert.equal(h.api.getCities().length, 38); return h;
}
function overviewPaint(h) {
    const data = h.api.overviewData(); assert.ok(data); assert.equal(typeof data.paintEnvironment, 'function');
    const start = h.paints.length, result = data.paintEnvironment(h.makeContext('overview'), { x: 11, y: 17, w: 384, h: 400 });
    assert.equal(h.paints.slice(start).filter(paint => paint.method === 'drawImage').length, result.drawn); return result;
}
function rejected(h, callback) {
    const start = h.paints.length;
    assert.deepEqual(plain(callback(h.makeContext('retired'), { x: 0, y: 0, w: 384, h: 400 })),
        { drawn: 0, skipped: 0, operations: [] }); assert.equal(h.paints.length, start); h.noInput();
}

test('production environment art uses actual image dimensions and the existing source frame', async () => {
    const env = productionManifest.layers.environment;
    assert.equal(productionManifest.libSha256, standardHash); assert.equal(env.source, productionGeo.source);
    assert.deepEqual(env.mapSize, [3840, 4000]); assert.deepEqual(env.rasterSize, [3840, 3309]);
    assert.equal(env.coordinateSystem, 'china-lcc-raster-padded-v1');
    for (const layer of env.layers) assert.deepEqual(dimensions('assets/hd-overworld/' + layer.path), layer.pixelSize);
    const h = await loaded(); const result = overviewPaint(h);
    assert.ok(result.drawn > 0); assert.ok(result.operations.every(operation => descriptors.some(layer => layer.id === operation.id)));
    for (const operation of result.operations) assert.ok(operation.destination[1] + operation.destination[3] <= 347.900000001,
        'the source-frame decoration stops before the 691-pixel sea pad');
    h.noInput();
});

test('the main camera and overview invoke the actual same renderer, without moving a city anchor', async () => {
    const h = await loaded(); const first = descriptors.find(layer => layer.kind === 'stamps').instances[0].rect;
    Object.assign(h.state.camera, { inited: true, lockedFull: true, scale: 1,
        x: first[0] + first[2] / 2 - 960, y: first[1] + first[3] / 2 - 540 });
    const before = plain(h.api.getCities().map(city => [city.index, city.hdX, city.hdY, city.engX, city.engY]));
    h.draw(); const result = h.api.debugSnapshot().environmentLayers;
    assert.ok(result.drawn > 0); assert.ok(result.operations.some(operation => operation.id === descriptors.find(layer => layer.kind === 'stamps').id));
    assert.deepEqual(plain(h.api.getCities().map(city => [city.index, city.hdX, city.hdY, city.engX, city.engY])), before);
    assert.ok(overviewPaint(h).drawn > 0); h.noInput();
});

test('the actual mini-map canvas paints environment within its letterbox and keeps Mod fallback', async () => {
    const h = await loaded();
    for (const id of ['hd-mini-map', 'hd-mini-map-canvas', 'hd-mini-map-cities', 'hd-mini-map-summary',
        'hd-mini-map-content', 'hd-mini-map-fallback', 'hd-mini-map-classic', 'hd-mini-map-return']) {
        const node = h.document.createElement('div'); node.id = id; h.nodes.set(id, node);
    }
    h.nodes.get('hd-mini-map-canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 250 });
    h.nodes.get('hd-mini-map-canvas').getContext = () => h.makeContext('mini-map-canvas');
    h.context.baye.hd.qty = () => ({ active: 0 });
    h.context.baye.hd.miniMap = () => ({ protocolVersion: 1, active: 1, complete: 1, custom: 0,
        generation: 1, detailGeneration: 1, seq: 31, mapInputSeq: 1, defaultDraw: 1,
        resourceId: 75, imageIndex: 0, width: 84, height: 64, mask: 0, city1: 1 });
    vm.runInContext(file('js/hd-minimap.js').toString('utf8'), h.context, { filename: 'js/hd-minimap.js' });
    const start = h.paints.length; h.context.BayeHdMiniMap.poll();
    const paints = h.paints.slice(start).filter(paint => paint.id === 'mini-map-canvas'),
        base = paints.find(paint => paint.method === 'drawImage' && paint.args[0].url.includes('base_plains'));
    assert.ok(base); assert.deepEqual(base.args.slice(1), [130, 0, 240, 250]);
    const environment = paints.filter(paint => paint.method === 'drawImage' &&
        descriptors.some(layer => paint.args[0].url.includes(layer.path)));
    assert.ok(environment.length > 0);
    for (const paint of environment) {
        assert.ok(paint.args[5] >= 130 && paint.args[5] + paint.args[7] <= 370.000000001);
        assert.ok(paint.args[6] >= 0 && paint.args[6] + paint.args[8] <= 206.812500001,
            'mini-map decoration uses the same 3309-high source frame inside the 4000-high base');
    }
    assert.equal(paints.filter(paint => paint.method === 'arc').length, 38);
    assert.equal(h.context.BayeHdMiniMap.debugSnapshot().complete, true);
    assert.equal(h.context.BayeHdMiniMap.debugSnapshot().showLcd, false); h.noInput();
    h.context.dynLib = modLib; h.context.BayeHdLibIdentity.read();
    const retired = h.paints.length; h.context.BayeHdMiniMap.poll();
    assert.equal(h.paints.length, retired); assert.equal(h.context.BayeHdMiniMap.debugSnapshot().complete, false);
    assert.equal(h.context.BayeHdMiniMap.debugSnapshot().showLcd, true); h.noInput();
});

test('optional image dimension mismatch or missing asset keeps the verified city map playable', async () => {
    for (const fault of ['wrongPath', 'missingPath']) {
        const h = await loaded({ [fault]: descriptors[0].path }); const result = overviewPaint(h);
        assert.equal(result.operations.some(operation => operation.path === descriptors[0].path), false);
        assert.ok(result.skipped > 0); assert.ok(result.drawn > 0); assert.equal(h.api.getCities().length, 38);
        assert.equal(h.api.debugSnapshot().presentationReady, true); assert.equal(h.api.debugSnapshot().hitsEnabled, true); h.noInput();
    }
});

test('an optional environment module failure preserves the actual base and every city', async () => {
    const h = await loaded();
    h.context.BayeHdOverworldLayers.draw = () => { throw new Error('optional module unavailable'); };
    const start = h.paints.length; assert.doesNotThrow(h.draw);
    const paints = h.paints.slice(start).filter(paint => paint.id === 'hd-overworld-canvas');
    assert.ok(paints.some(paint => paint.method === 'drawImage' && paint.args[0].url.includes('base_plains')));
    assert.equal(paints.some(paint => paint.method === 'ellipse'), false,
        'the optional failure must not replace the geographic base with the generic fallback');
    assert.equal(paints.some(paint => paint.method === 'drawImage' &&
        descriptors.some(layer => paint.args[0].url.includes(layer.path))), false);
    assert.equal(h.api.getCities().length, 38); assert.equal(h.api.debugSnapshot().presentationReady, true);
    assert.equal(h.api.debugSnapshot().hitsEnabled, true); assert.equal(h.api.debugSnapshot().environmentLayers.drawn, 0);
    assert.deepEqual(plain(overviewPaint(h)), { drawn: 0, skipped: 0, operations: [] }); h.noInput();
});

test('wrong-size or missing fortified city art keeps all city rings and original input anchors', async () => {
    const path = productionManifest.layers.cities.owned;
    assert.equal(path, 'cities/fortified-city-v1.png');
    assert.deepEqual(dimensions('assets/hd-overworld/' + path), productionManifest.layers.cityArt.pixelSize);
    for (const fault of ['wrongPath', 'missingPath']) {
        const h = await loaded({ [fault]: path });
        const anchors = plain(h.api.getCities().map(city => [city.index, city.hdX, city.hdY, city.engX, city.engY]));
        const start = h.paints.length; h.draw();
        const paints = h.paints.slice(start).filter(paint => paint.id === 'hd-overworld-canvas');
        assert.equal(paints.some(paint => paint.method === 'drawImage' && paint.args[0].url.includes(path)), false);
        assert.equal(paints.filter(paint => paint.method === 'arc' && [11, 14].includes(paint.args[2])).length, 38,
            'every city receives the actual fallback geometry when generated art is unavailable');
        assert.deepEqual(plain(h.api.getCities().map(city => [city.index, city.hdX, city.hdY, city.engX, city.engY])), anchors);
        assert.equal(h.api.debugSnapshot().presentationReady, true); assert.equal(h.api.debugSnapshot().hitsEnabled, true); h.noInput();
    }
});

test('wrong optional coordinate metadata or missing geo source bounds affects only decoration', async () => {
    for (const fault of ['coordinate', 'source', 'map-size', 'raster-size', 'geo-raster', 'world-ocean']) {
        const manifest = asset('manifest.json'), geo = asset('china-lcc-cities.json'), env = manifest.layers.environment;
        if (fault === 'coordinate') env.coordinateSystem = 'screen-space';
        if (fault === 'source') env.source = 'another-map';
        if (fault === 'map-size') env.mapSize = [3840, 3999];
        if (fault === 'raster-size') env.rasterSize = [3840, 4000];
        if (fault === 'geo-raster') delete geo.fit.rasterSize;
        if (fault === 'world-ocean') env.layers.forEach(layer => { layer.worldRect = [0, 0, 3840, 4000]; });
        const h = await loaded({ manifest, geo }); assert.equal(overviewPaint(h).drawn, 0);
        assert.equal(h.api.debugSnapshot().presentationReady, true); assert.equal(h.api.getCities().length, 38);
        const start = h.paints.length; h.draw();
        assert.ok(h.paints.slice(start).some(paint => paint.method === 'drawImage' && paint.args[0].url.includes('base_plains')),
            'the original geographic base is still drawn'); h.noInput();
    }
});

test('a captured overview cannot paint while hidden, and visibility recovery reads current data', async () => {
    const h = await loaded(), old = h.api.overviewData().paintEnvironment;
    h.setHidden(true); assert.equal(h.frames.size, 0); assert.equal(h.api.overviewData(), null); rejected(h, old);
    const start = h.paints.length; h.draw(); assert.equal(h.paints.length, start);
    h.setHidden(false); assert.ok(overviewPaint(h).drawn > 0); h.noInput();
});

test('a classic-view retirement prevents the old callback from painting after the same LIB reopens', async () => {
    const h = await loaded(), old = h.api.overviewData().paintEnvironment;
    h.api.setMode('classic'); rejected(h, old); assert.equal(h.api.overviewData(), null);
    h.api.setMode('hd-map'); h.complete(); assert.equal(h.api.debugSnapshot().presentationReady, true);
    rejected(h, old); assert.ok(overviewPaint(h).drawn > 0); h.noInput();
});

test('actual LIB replacement and standard recovery retire old overview callbacks and image ownership', async () => {
    const h = await loaded(), old = h.api.overviewData().paintEnvironment, oldGeneration = h.state.assetGeneration;
    h.context.dynLib = modLib; h.context.BayeHdLibIdentity.read(); rejected(h, old);
    assert.notEqual((await h.ready()).sha256, standardHash); assert.equal(h.api.overviewData(), null);
    assert.equal(h.state.assetsReady, false); assert.equal(h.api.getCities().length, 0);
    h.context.dynLib = standardLib; h.context.BayeHdLibIdentity.read(); assert.equal((await h.ready()).sha256, standardHash);
    h.complete(); assert.ok(h.state.assetGeneration > oldGeneration); rejected(h, old);
    assert.ok(overviewPaint(h).drawn > 0); h.noInput();
});

test('late geo and actual PNG callbacks cannot publish an environment for a retired LIB', async () => {
    const h = harness(); await h.ready(); h.response(h.requests[0], productionManifest);
    const oldGeo = h.requests.find(request => request.url.split('?')[0].endsWith('china-lcc-cities.json'));
    const late = [...h.images]; assert.ok(late.some(image => image.url.includes(descriptors[0].path)));
    h.context.dynLib = modLib; h.context.BayeHdLibIdentity.read(); h.response(oldGeo, productionGeo);
    for (const image of late) h.imageResponse(image);
    assert.equal(h.state.geoMeta, null); assert.equal(Object.keys(h.state.images).length, 0);
    assert.equal(h.state.assetsReady, false); assert.equal(h.api.overviewData(), null); h.noInput();
});

test('real unknown Mod and pending identity never request or paint the standard environment', async () => {
    const h = harness({ hex: modLib }); assert.equal(h.context.BayeHdLibIdentity.read().status, 'pending');
    assert.equal(h.api.overviewData(), null); assert.equal(h.requests.length, 0); assert.equal(h.frames.size, 0);
    await h.ready(); assert.equal(h.api.debugSnapshot().presentationReady, false); assert.equal(h.requests.length, 0);
    const start = h.paints.length; h.draw(); assert.equal(h.paints.length, start); h.noInput();
});
