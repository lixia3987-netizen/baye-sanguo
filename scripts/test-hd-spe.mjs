import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { deflateSync, inflateSync } from 'node:zlib';

const source = readFileSync(new URL('../js/hd-spe.js', import.meta.url), 'utf8');
const identitySource = readFileSync(new URL('../js/hd-lib-identity.js', import.meta.url), 'utf8');
const bytes = Buffer.from('01020304', 'hex');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const settle = () => new Promise(resolve => setImmediate(resolve));

// Browser Image decodes pixels in production. This independent PNG reader lets
// the asset test check actual alpha after PNG filtering, rather than IHDR alone.
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function decodePng(png) {
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let header, ended = false;
    const chunks = [];
    for (let at = 8; at < png.length;) {
        assert.ok(at + 12 <= png.length, 'complete PNG chunk header');
        const length = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8), end = at + 12 + length;
        assert.ok(end <= png.length, 'complete PNG chunk payload');
        assert.equal(crc32(png.subarray(at + 4, end - 4)), png.readUInt32BE(end - 4), 'PNG chunk CRC: ' + type);
        const data = png.subarray(at + 8, end - 4);
        if (type === 'IHDR') {
            assert.equal(at, 8); assert.equal(length, 13); assert.equal(header, undefined);
            header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), colorType: data[9] };
            assert.equal(data[8], 8, '8-bit production art');
            assert.ok(header.colorType === 2 || header.colorType === 6, 'RGB or RGBA production art');
            assert.deepEqual([...data.subarray(10)], [0, 0, 0], 'standard compression/filter, noninterlaced art');
            assert.ok(header.width > 0 && header.height > 0 && header.width * header.height <= 32_000_000);
        } else if (type === 'IDAT') {
            assert.ok(header); chunks.push(data);
        } else if (type === 'IEND') {
            assert.equal(length, 0); assert.equal(end, png.length, 'no trailing or truncated PNG data'); ended = true;
        } else if (type === 'tRNS') {
            assert.fail('SPE transparency must be explicit RGBA pixels, not a color-key chunk');
        }
        at = end;
    }
    assert.ok(header && ended && chunks.length, 'complete PNG image');
    const channels = header.colorType === 6 ? 4 : 3, stride = header.width * channels;
    const filtered = inflateSync(Buffer.concat(chunks)), pixels = Buffer.alloc(stride * header.height);
    assert.equal(filtered.length, (stride + 1) * header.height, 'complete decompressed PNG rows');
    function paeth(a, b, c) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    for (let y = 0; y < header.height; y++) {
        const filter = filtered[y * (stride + 1)]; assert.ok(filter <= 4, 'legal PNG row filter');
        for (let x = 0; x < stride; x++) {
            const at = y * stride + x, left = x >= channels ? pixels[at - channels] : 0;
            const up = y ? pixels[at - stride] : 0, upperLeft = y && x >= channels ? pixels[at - stride - channels] : 0;
            const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)][filter];
            pixels[at] = (filtered[y * (stride + 1) + x + 1] + predictor) & 255;
        }
    }
    let transparent = 0, nonTransparent = 0, opaque = 0;
    for (let at = 0; at < pixels.length; at += channels) {
        const alpha = channels === 4 ? pixels[at + 3] : 255;
        if (alpha === 0) transparent++; else nonTransparent++;
        if (alpha === 255) opaque++;
    }
    return { ...header, pixels, channels, transparent, nonTransparent, opaque };
}
function checkPictureAlpha(decoded, mask) {
    assert.ok(mask === 0 || mask === 1, 'only native simple picture masks are supported');
    if (mask === 0) {
        assert.equal(decoded.opaque, decoded.width * decoded.height, 'mask0 art is completely opaque');
    } else {
        assert.equal(decoded.colorType, 6, 'mask1 art carries explicit alpha');
        assert.ok(decoded.transparent > 0, 'mask1 has actual transparent background pixels');
        assert.ok(decoded.nonTransparent > 0, 'mask1 has visible artwork rather than an empty image');
    }
}
function pngFixture(width, height, colorType, filtered) {
    function chunk(type, data) {
        const bytes = Buffer.concat([Buffer.from(type), data]), result = Buffer.alloc(data.length + 12);
        result.writeUInt32BE(data.length); bytes.copy(result, 4); result.writeUInt32BE(crc32(bytes), result.length - 4);
        return result;
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = colorType;
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(filtered)), chunk('IEND', Buffer.alloc(0))]);
}
function bitset(...frames) {
    const bits = Array(32).fill(0);
    for (const frame of frames) bits[frame >> 3] |= 1 << (frame & 7);
    return bits;
}
function nativeSpe(overrides = {}) {
    return { active: 1, protocolVersion: 2, generation: 1, eventId: 1, kind: 1, id: 3,
        x: 0, y: 0, resourceIndex: 0, count: 3, picmax: 2, startFrm: 0, endFrm: 2,
        frameIndex: 0, frameValid: true, commitSeq: 1, keyflag: 1, skipEligible: true,
        protocolValid: true, resourceFingerprint: 'fnv1a32:12345678:40', resourceLength: 40,
        display: { generation: 1, eventId: 1, commitSeq: 1, frameIndex: 0, frameValid: true, visibleFrames: bitset(0) }, ...overrides };
}
function manifest(overrides = {}) {
    return { schemaVersion: 1, libSha256: sha256, axScale: 2, entries: [{ speId: 3, resourceIndex: 0, kind: 1,
        startFrm: 0, endFrm: 2, count: 3, picmax: 2, resourceFingerprint: 'fnv1a32:12345678:40', resourceLength: 40,
        units: [{ frame: 0, x: 1, y: 2, picIndex: 0 }, { frame: 1, x: 3, y: 4, picIndex: 1 }, { frame: 2, x: 5, y: 6, picIndex: 0 }],
        pictures: [0, 1].map(picIndex => ({ picIndex, src: `assets/hd-spe/picture-${picIndex}.png`, width: 64, height: 64,
            nativeWidth: 8, nativeHeight: 8, logicalWidth: 4, logicalHeight: 4, mask: picIndex })) }], ...overrides };
}
function actualMainFixture(speId = 3) {
    const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    const address = lib.readUInt32LE((speId - 1) * 4), length = lib.readUInt32LE(address + 8);
    const resource = lib.subarray(address + 14, address + 14 + length);
    let fnv = 2166136261;
    for (const byte of resource) fnv = Math.imul(fnv ^ byte, 16777619) >>> 0;
    const units = Array.from({ length: resource[2] }, (_, frame) => {
        const at = 6 + frame * 5;
        return { frame, x: resource[at], y: resource[at + 1], picIndex: resource[at + 4] };
    });
    let at = 6 + units.length * 5;
    const pictures = Array.from({ length: resource[3] }, (_, picIndex) => {
        const nativeWidth = resource.readUInt16LE(at), nativeHeight = resource.readUInt16LE(at + 2), mask = resource[at + 6];
        at += 7 + Math.ceil(nativeWidth / 8) * nativeHeight * (mask + 1);
        return { picIndex, src: `assets/hd-spe/main-fixture-picture-${picIndex}.png`, width: 64, height: 64,
            nativeWidth, nativeHeight, logicalWidth: nativeWidth, logicalHeight: nativeHeight, mask };
    });
    const entry = { speId, resourceIndex: 0, kind: 1, startFrm: resource[4], endFrm: resource[5], count: units.length, picmax: pictures.length,
        resourceLength: length, resourceFingerprint: `fnv1a32:${fnv.toString(16).padStart(8, '0')}:${length}`, units, pictures };
    const s = { id: speId, kind: 1, count: entry.count, picmax: entry.picmax, startFrm: entry.startFrm, endFrm: entry.endFrm,
        resourceLength: entry.resourceLength, resourceFingerprint: entry.resourceFingerprint };
    const m = { schemaVersion: 1, axScale: 1, libSha256: createHash('sha256').update(lib).digest('hex'), entries: [entry] };
    return { lib, entry, s, m, units, pictures };
}
function harness(options = {}) {
    let spe = nativeSpe(options.spe), maker = options.maker || null, hidden = false, report = { active: 0 };
    let openingHd = options.storage?.['baye/systemUiMode'] !== 'classic', battleHd = true;
    const events = [], images = [], keys = [], nativeWrites = [], listeners = new Map(), polls = [], nodes = new Map();
    const nativeReads = [], timers = new Map(), preferences = new Map(Object.entries(options.storage || {}));
    let nativeReadable = !options.preMain, timerId = 0, now = 1_000;
    function readNative(name, value) { nativeReads.push(name); if (!nativeReadable) throw new Error('premature native access: ' + name); return value; }
    class Clock extends Date { static now() { return now; } }
    function advance(ms) {
        const end = now + ms; let count = 0;
        while (true) {
            const ready = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!ready) break;
            assert.ok(++count < 1_000, 'bounded callback timer work');
            timers.delete(ready[0]); now = ready[1].at; ready[1].fn();
        }
        now = end;
    }
    function node(id, canvas = false) {
        const attrs = {}, classes = new Set(), handlers = {};
        const ctx = new Proxy({}, { get(target, key) {
            if (key in target) return target[key];
            return (...args) => events.push({ node: id, operation: key, args, smoothing: target.imageSmoothingEnabled,
                fillStyle: target.fillStyle });
        }, set(target, key, value) { target[key] = value; return true; } });
        const n = { id, width: canvas ? 640 : 0, height: canvas ? 384 : 0, style: {}, hidden: false, disabled: false,
            classList: { toggle(name, active) { active ? classes.add(name) : classes.delete(name); } },
            setAttribute(key, value) { attrs[key] = value; }, getAttribute: key => attrs[key],
            addEventListener(name, fn) { (handlers[name] ||= []).push(fn); }, handlers,
            getContext: () => ctx, getBoundingClientRect: () => ({ width: 128, height: 48 }) };
        nodes.set(id, n); return n;
    }
    ['hd-spe', 'hd-spe-skip', 'hd-spe-return', 'hd-spe-title', 'hd-spe-probe'].forEach(id => node(id));
    node('lcd', true); node('hd-spe-canvas', true);
    const document = { get hidden() { return hidden; }, documentElement: node('html'), getElementById: id => nodes.get(id),
        createElement: () => node('scratch-' + nodes.size, true),
        addEventListener(name, fn) { (listeners.get(name) || listeners.set(name, []).get(name)).push(fn); } };
    class Image {
        set src(value) { this.url = value; images.push(this); }
    }
    const nativeData = { g_scale: 2, g_screenWidth: 160, g_screenHeight: 96, ...options.data };
    const data = new Proxy(nativeData, { get(target, key) { return readNative('data.' + String(key), target[key]); },
        set(target, key, value) { nativeWrites.push([key, value]); return true; } });
    const baye = { get data() { return readNative('data', data); }, hd: {
        ready: () => readNative('hd.ready', true), spe: () => readNative('hd.spe', spe),
        maker: () => readNative('hd.maker', maker), report: () => readNative('hd.report', report) } };
    const context = vm.createContext({ console, document, Image, Uint8Array,
        crypto: options.crypto === undefined ? webcrypto : options.crypto,
        Promise: class { constructor() { throw new Error('do not wrap native promises in legacy window.Promise'); } },
        dynLib: bytes.toString('hex'), baye, Date: Clock,
        localStorage: { getItem: key => preferences.get(key) ?? null, setItem() { throw new Error('mode API should own preference'); } },
        BayeHdSystemUi: { shouldShowHd: () => openingHd, setMode: mode => { openingHd = mode !== 'classic'; } },
        BayeHdBattle: { shouldShowHd: () => battleHd, setMode: mode => { battleHd = mode !== 'classic'; } },
        sendKey: key => keys.push(key), setInterval: fn => { polls.push(fn); return polls.length; },
        setTimeout: (fn, delay = 0) => { const id = ++timerId; timers.set(id, { fn, at: now + Math.max(0, delay) }); return id; },
        clearTimeout: id => timers.delete(id),
        ...(options.fetch ? { fetch: options.fetch } : {}) });
    context.window = context;
    vm.runInContext(identitySource, context, { filename: 'js/hd-lib-identity.js' });
    vm.runInContext(source, context, { filename: 'js/hd-spe.js' });
    const api = context.BayeHdSpe;
    function event(extra = {}) { return { key: 'Enter', keyCode: 13, target: {}, prevented: false,
        preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...extra }; }
    return { api, context, events, images, keys, nativeWrites, nativeReads, listeners, polls, nodes, timers, advance,
        allowNative() { nativeReadable = true; },
        setStorage(key, value) { preferences.set(key, value); },
        spe: () => spe, setSpe: value => { spe = nativeSpe(value); },
        setMaker: value => { maker = value; },
        setHidden(value) { hidden = value; for (const fn of listeners.get('visibilitychange') || []) fn(); },
        setReport(value) { report.active = value; api.onEngineSpe(); },
        setMode(value) { openingHd = battleHd = value; api.onEngineSpe(); },
        key(extra) { const e = event(extra); for (const fn of listeners.get('keydown') || []) fn(e); return e; },
        click(selector, detail = 0) { const e = event({ detail, target: { closest: value => value === selector ?
            selector === '[data-hd-spe-return]' ? nodes.get('hd-spe-return') : {} : null } });
            for (const fn of nodes.get('hd-spe').handlers.click || []) fn(e); return e; },
        pointerDownReturn() { const e = event({ target: { closest: value => value === '[data-hd-spe-return]' ? nodes.get('hd-spe-return') : null } });
            for (const fn of nodes.get('hd-spe').handlers.pointerdown || []) fn(e); },
        setScreen(width, height) { nativeData.g_screenWidth = width; nativeData.g_screenHeight = height;
            nodes.get('lcd').width = width * 4; nodes.get('lcd').height = height * 4; api.onEngineSpe(); },
        flush() { api.onLcdFlush({ fixture: 'native LCD' }, nodes.get('lcd').width, nodes.get('lcd').height); },
        resolveImage(index, valid = true) { const image = images[index]; image.naturalWidth = valid ? 64 : 63; image.naturalHeight = 64; image.onload(); },
        nativeSnapshot: () => JSON.stringify({ spe, scale: data.g_scale, report }),
        hdDraws: () => events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage' && e.args[0] instanceof Image) };
}
async function loaded() {
    const h = harness(); h.api.setManifest(manifest()); h.api.start();
    for (let i = 0; i < 30 && h.images.length < 2; i++) await settle();
    assert.equal(h.images.length, 2, 'authentic LIB admits exactly the two native picture slots');
    h.resolveImage(0); h.resolveImage(1); assert.equal(h.api.debugSnapshot().source, 'hd-assets'); return h;
}
async function makerHold(frame = 95, options = {}) {
    const fixture = actualMainFixture(6);
    const display = { generation: 9, eventId: 6, commitSeq: frame + 1, frameIndex: frame,
        frameValid: true, visibleFrames: bitset(frame) };
    const maker = { protocolVersion: 1, active: true, phase: 'hold', generation: 9, session: 1, inputSeq: 2,
        returnEligible: true, sourceValid: true, custom: false, speId: 6, x: 0, y: 0,
        resourceIndex: 0, count: 96, picmax: 1, startFrm: 0, endFrm: 95,
        resourceLength: fixture.entry.resourceLength, resourceFingerprint: fixture.entry.resourceFingerprint, display };
    const h = harness({ data: { g_scale: 1 }, spe: { active: 0, id: 0, generation: 9, display }, maker, ...options });
    h.context.dynLib = fixture.lib.toString('hex');
    h.api.setManifest(fixture.m); h.api.start();
    const deadline = Date.now() + 2_000;
    while (!h.images.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(h.images.length, 1);
    if (!options.pendingImage) h.resolveImage(0);
    return { ...h, fixture, maker, display };
}

test('native Maker hold presents the last copied sheet while the public SPE stays inactive, with no native writes', async () => {
    const h = await makerHold();
    assert.equal(h.spe().active, 0);
    assert.equal(h.api.debugSnapshot().presentation, 'maker-hold');
    assert.equal(h.api.debugSnapshot().spe.active, 0);
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual([...h.api.debugSnapshot().displayedFrames], [95]);
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [0, 0, 159 * 11, 96 * 11]);
    assert.equal(h.nodes.get('hd-spe-title').textContent, '制作群组');
    assert.equal(h.nodes.get('hd-spe-skip').hidden, true);
    assert.equal(h.nodes.get('hd-spe-return').hidden, false);
    assert.deepEqual(h.nativeWrites, []); assert.deepEqual(h.keys, []);
});

test('skipping real Maker unit eight retains y87 during hold and never snaps to the final sheet', async () => {
    const h = await makerHold(8), before = h.nativeSnapshot();
    assert.deepEqual([...h.api.debugSnapshot().displayedFrames], [8]);
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [0, 87 * 11, 159 * 11, 96 * 11]);
    const draws = h.hdDraws().length;
    h.advance(50_000); for (const poll of h.polls) poll();
    assert.equal(h.hdDraws().length, draws); assert.equal(h.nativeSnapshot(), before);
    h.api.skip(); assert.deepEqual(h.keys, [], 'scroll skip cannot acknowledge the distinct hold owner');
});

test('Maker hold waits for the actual public LCD flush and checks every byte of its saved bitset', async () => {
    const old = { generation: 9, eventId: 6, commitSeq: 95, frameIndex: 94, frameValid: true, visibleFrames: bitset(94) };
    const h = await makerHold(95, { spe: { active: 0, id: 0, generation: 9, display: old } });
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.hdDraws().length, 0);
    h.setSpe({ active: 0, id: 0, generation: 9, display: h.display }); h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    h.setSpe({ active: 0, id: 0, generation: 9, display: { ...h.display, visibleFrames: bitset(94, 95) } }); h.flush();
    assert.equal(h.api.debugSnapshot().source, 'lcd');
    assert.deepEqual(h.keys, []);
});

test('Maker return requires the displayed native session and presentation epoch and sends one Enter', async () => {
    const h = await makerHold(), old = h.api.debugSnapshot().ownerToken;
    h.pointerDownReturn(); h.setMode(false); h.setMode(true);
    h.click('[data-hd-spe-return]', 1);
    assert.deepEqual(h.keys, [], 'mode retirement clears a held pointer press');
    assert.equal(h.api.returnToTitle(old), false);
    h.pointerDownReturn(); h.setHidden(true); h.setHidden(false); h.click('[data-hd-spe-return]', 1);
    assert.deepEqual(h.keys, [], 'visibility retirement clears a held pointer press');
    const current = h.api.debugSnapshot().ownerToken;
    assert.equal(h.api.returnToTitle(current), true);
    assert.equal(h.api.returnToTitle(current), false); h.key(); h.click('[data-hd-spe-return]');
    assert.deepEqual(h.keys, [39]);
    h.setMaker({ ...h.maker, active: false }); h.api.blit();
    assert.equal(h.api.returnToTitle(current), false); assert.equal(h.api.isOpen(), false);
    h.setMaker({ ...h.maker, session: 2 }); h.api.blit();
    assert.equal(h.api.returnToTitle(current), false);
    h.key({ isComposing: true }); h.key({ target: { tagName: 'INPUT' } }); h.key({ repeat: true });
    assert.deepEqual(h.keys, [39]); h.key(); assert.deepEqual(h.keys, [39, 39]);
});

test('Maker hold resource retirement, reports, reset and late images cannot revive old HD or leak return input', async () => {
    const ready = await makerHold();
    ready.setMaker({ ...ready.maker, sourceValid: false }); ready.api.blit();
    assert.equal(ready.api.debugSnapshot().source, 'lcd', 'native dirty retirement repaints even before the next LCD flush');
    const h = await makerHold(8, { pendingImage: true }), old = h.api.debugSnapshot().ownerToken;
    h.setMaker({ ...h.maker, sourceValid: false, display: { ...h.display, frameValid: false } }); h.api.blit();
    h.resolveImage(0); assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.hdDraws().length, 0);
    h.setReport(1); assert.equal(h.api.returnToTitle(old), false); assert.deepEqual(h.keys, []);
    h.setReport(0); h.setSpe({ active: 0, id: 0, generation: 10, display: { ...h.display, generation: 10 } }); h.api.blit();
    assert.equal(h.api.isOpen(), false); assert.equal(h.api.returnToTitle(old), false);
    const ended = await makerHold(95, { pendingImage: true });
    ended.setMaker({ ...ended.maker, active: false }); ended.api.blit(); ended.resolveImage(0);
    assert.equal(ended.api.isOpen(), false); assert.equal(ended.hdDraws().length, 0); assert.deepEqual(ended.keys, []);
});

test('custom about hooks and failed Maker sheets preserve native LCD and its hold return', async () => {
    for (const custom of [false, true]) {
        const h = await makerHold(95, { pendingImage: true });
        if (custom) h.setMaker({ ...h.maker, custom: true, sourceValid: false });
        else h.images[0].onerror();
        h.api.blit(); assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.hdDraws().length, 0);
        h.click('[data-hd-spe-return]'); assert.deepEqual(h.keys, [39]); assert.deepEqual(h.nativeWrites, []);
    }
});
function preparation(options = {}) {
    const fixture = actualMainFixture(), callbacks = [], preparationResults = [];
    const fetch = options.fetch || (() => Promise.resolve({ ok: true, json: () => Promise.resolve(fixture.m) }));
    const h = harness({ preMain: true, data: { g_scale: 1 }, spe: { active: 0 }, fetch,
        storage: { 'baye/systemUiMode': 'hd', 'baye/resolution': '0', ...options.storage },
        ...(Object.hasOwn(options, 'crypto') ? { crypto: options.crypto } : {}) });
    h.context.dynLib = options.hex ?? fixture.lib.toString('hex');
    h.context.lcdWidth = options.width ?? 160; h.context.lcdHeight = options.height ?? 96;
    h.context.location = { pathname: options.pathname ?? '/pc.html' };
    assert.equal(typeof h.api.prepareStart, 'function', 'production owns the callback pre-main preparation API');
    h.api.prepareStart(result => { callbacks.push(h.nativeReads.slice()); preparationResults.push(result); h.allowNative(); },
        Object.hasOwn(options, 'timeoutMs') ? { timeoutMs: options.timeoutMs } : {});
    return { ...h, fixture, callbacks, preparationResults };
}
async function preparedImages(h) {
    for (let i = 0; i < 100 && h.images.length < 7 && !h.callbacks.length; i++) { await settle(); h.advance(10); }
    assert.equal(h.images.length, 7, 'the complete actual MAIN picture set is requested while no C bindings exist');
    assert.deepEqual(h.callbacks, [], 'native entry waits until the complete picture set is usable');
    assert.deepEqual(h.nativeReads, [], 'hash/manifest/image preparation never probes native readiness or data');
}

test('only displayed native commits select frames; overlapping units and later clears use the bitset, not a JS clock', async () => {
    const h = await loaded(); h.events.length = 0;
    h.setSpe({ frameIndex: 2, commitSeq: 20, display: { generation: 1, eventId: 1, commitSeq: 2, frameIndex: 1, frameValid: true, visibleFrames: bitset(0, 1) } });
    const before = h.nativeSnapshot(); h.flush();
    assert.deepEqual(Array.from(h.api.debugSnapshot().displayedFrames), [0, 1]);
    assert.deepEqual(h.hdDraws().map(e => e.args[0].url), ['assets/hd-spe/picture-0.png', 'assets/hd-spe/picture-1.png']);
    h.events.length = 0; for (const poll of h.polls) poll();
    assert.equal(h.hdDraws().length, 0, 'no frame advance or repaint without native display progress');
    h.setSpe({ frameIndex: 1, display: { generation: 1, eventId: 1, commitSeq: 3, frameIndex: 1, frameValid: true, visibleFrames: bitset(1) } });
    h.flush(); assert.deepEqual(Array.from(h.api.debugSnapshot().displayedFrames), [1], 'expired unit disappears while same highest frame remains');
    assert.equal(h.hdDraws().at(-1).args[0].url, 'assets/hd-spe/picture-1.png');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    assert.notEqual(h.nativeSnapshot(), before, 'fixture explicitly changed only its native displayed state');
});

test('picture dimensions divide by native AX_SCALE while unit positions remain logical coordinates', async () => {
    const h = await loaded(), draw = h.hdDraws().at(-1), scale = h.api.debugSnapshot().scale;
    assert.deepEqual(draw.args.slice(1), [1 * scale, 2 * scale, 4 * scale, 4 * scale]);
    assert.equal(draw.smoothing, true);
});

test('opening skip sends once per event, rejects repeat/composition/form input and survives hidden/report ownership', () => {
    const h = harness(); h.api.start();
    for (const extra of [{ repeat: true }, { isComposing: true }, { target: { tagName: 'INPUT' } },
        { target: { tagName: 'TEXTAREA' } }, { target: { isContentEditable: true } }, { defaultPrevented: true }]) h.key(extra);
    assert.deepEqual(h.keys, []); h.key(); h.key(); h.api.skip(); assert.deepEqual(h.keys, [0x27]);
    h.setHidden(true); h.setHidden(false); h.setReport(1); h.setReport(0); h.api.skip();
    assert.deepEqual(h.keys, [0x27], 'mode and visibility cannot release the current event skip lock');
    h.setSpe({ eventId: 2, display: { ...h.spe().display, eventId: 2 } }); h.api.onEngineSpe(); h.api.skip();
    assert.deepEqual(h.keys, [0x27, 0x27]);
});

test('only actual skipEligible opening waits own skip; battle, report and classic actions remain passive', () => {
    const h = harness(); h.api.start();
    for (const changes of [{ skipEligible: false }, { keyflag: 3, skipEligible: false }, { keyflag: 3, skipEligible: true },
        { kind: 2, skipEligible: true }, { kind: 3, skipEligible: true }, { active: 0 }]) {
        h.setSpe(changes); h.api.onEngineSpe(); assert.equal(h.api.skip(), false);
    }
    h.setSpe({}); h.api.onEngineSpe(); h.setReport(1); h.key(); assert.equal(h.api.skip(), false);
    h.setReport(0); h.setMode(false); h.key(); assert.equal(h.api.isHandling(), false); assert.deepEqual(h.keys, []);
});

test('classic LCD control changes the owning mode without sending a key or mutating native state', () => {
    const h = harness(); h.api.start(); const before = h.nativeSnapshot();
    h.click('[data-hd-spe-lcd]'); assert.equal(h.api.isOpen(), false); assert.equal(h.api.isHandling(), false);
    assert.equal(h.nativeSnapshot(), before); assert.deepEqual(h.keys, []);
});

test('hidden pages stop all SPE Canvas work and resume from the current native display rather than old scratch', async () => {
    const h = await loaded(); h.events.length = 0; h.setHidden(true);
    h.setSpe({ eventId: 2, display: { ...h.spe().display, eventId: 2, commitSeq: 9 } });
    h.flush(); for (const poll of h.polls) poll(); assert.deepEqual(h.events, []);
    h.setHidden(false); assert.equal(h.api.debugSnapshot().event, '1:2');
    assert.equal(h.api.debugSnapshot().flushKey, '1:2:9'); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual(Array.from(h.api.debugSnapshot().displayedFrames), [0], 'warm images resume only the new displayed bitmap');
    assert.deepEqual(h.keys, []);
});

test('new, ended and mismatched displayed events cannot display a previous animation or revive from stale image requests', async () => {
    const h = harness(); h.api.setManifest(manifest()); h.api.start();
    for (let i = 0; i < 30 && !h.images.length; i++) await settle();
    const oldImages = h.images.length;
    h.setSpe({ eventId: 2 }); h.api.onEngineSpe(); assert.equal(h.api.isOpen(), false, 'new commit has not reached LCD');
    for (let i = 0; i < oldImages; i++) h.resolveImage(i); assert.notEqual(h.api.debugSnapshot().source, 'hd-assets');
    h.setSpe({ active: 0 }); h.api.onEngineSpe(); assert.equal(h.api.isOpen(), false);
    h.setSpe({ eventId: 3, display: { ...h.spe().display, eventId: 3, commitSeq: 5 } }); h.flush();
    assert.equal(h.api.debugSnapshot().flushKey, '1:3:5'); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual(Array.from(h.api.debugSnapshot().displayedFrames), [0], 'ready pictures follow the current event rather than replaying the retired event');
});

test('missing manifests, failed pictures, size mismatch, unsupported protocols and preserved-background flags use actual LCD fallback', async () => {
    const missing = harness(); missing.api.start(); missing.flush(); assert.equal(missing.api.debugSnapshot().source, 'lcd');
    const h = harness(); h.api.setManifest(manifest()); h.api.start();
    for (let i = 0; i < 30 && !h.images.length; i++) await settle();
    h.resolveImage(0, false); h.resolveImage(1); assert.equal(h.api.debugSnapshot().source, 'lcd');
    assert.equal(h.api.debugSnapshot().fallbackReason, 'asset-load-failed');
    for (const changes of [{ protocolVersion: 1 }, { protocolValid: false }, { frameValid: false }, { keyflag: 2 },
        { display: { ...h.spe().display, frameValid: false } }, { display: { ...h.spe().display, visibleFrames: bitset(250) } }]) {
        h.setSpe(changes); h.flush(); assert.equal(h.api.debugSnapshot().source, 'lcd');
    }
});

test('actual LIB hash, scale and resource identity authorize slots; preferred path or an altered dictionary cannot inherit trust', async () => {
    const h = await loaded(); h.context.dynLib = '01020305'; h.api.onEngineSpe();
    assert.equal(h.api.debugSnapshot().source, 'lcd'); await settle();
    assert.equal(h.api.debugSnapshot().source, 'lcd');
    const wrong = harness(); wrong.api.setManifest(manifest({ axScale: 4 })); wrong.api.start();
    for (let i = 0; i < 15; i++) await settle(); assert.equal(wrong.images.length, 0);
    const identity = harness({ spe: { resourceFingerprint: 'fnv1a32:ffffffff:40' } });
    identity.api.setManifest(manifest()); identity.api.start(); for (let i = 0; i < 15; i++) await settle();
    assert.equal(identity.images.length, 0); assert.equal(identity.api.debugSnapshot().source, 'lcd');
});

test('a stale digest or manifest response cannot restore old identity, and startup retains one listener and poll', async () => {
    const digests = [], manifests = [];
    const h = harness({ crypto: { subtle: { digest() { return { then(ok, fail) { digests.push({ ok, fail }); } }; } } },
        fetch() { return { then() { return { then(ok) { manifests.push(ok); } }; } }; } });
    h.api.start(); h.api.start(); assert.equal(h.polls.length, 1); assert.equal(h.listeners.get('keydown').length, 1);
    h.context.dynLib = '01020305'; h.api.onEngineSpe();
    const goodHash = Uint8Array.from(Buffer.from(sha256, 'hex')).buffer;
    digests[0].ok(goodHash); assert.equal(h.api.debugSnapshot().libSha256, null);
    h.api.setManifest(manifest({ libSha256: 'f'.repeat(64) })); manifests[0](manifest());
    digests[1].ok(goodHash); assert.equal(h.images.length, 0, 'stale manifest cannot overwrite explicit current manifest');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('expanded screens retain the complete real LCD and same-event resize retires the old crop and repaints', async () => {
    const h = await loaded(); h.events.length = 0;
    h.setScreen(208, 128);
    const state = h.api.debugSnapshot();
    assert.equal(state.source, 'lcd'); assert.equal(state.fallbackReason, 'screen-size-unsupported');
    assert.equal(state.flushW, 832); assert.equal(state.flushH, 512);
    assert.equal(state.canvasW / state.canvasH, 208 / 128);
    assert.equal(h.hdDraws().length, 0);
    const lcdDraw = h.events.find(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage');
    assert.deepEqual(lcdDraw.args.slice(1, 5), [0, 0, 832, 512], 'use the entire resized native LCD rather than a baseline denominator');
    h.setScreen(160, 96); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('negative and edge origins are clipped using native logical positions, without moving or enlarging picture slots', async () => {
    const h = await loaded(); h.events.length = 0;
    h.setSpe({ x: -4, y: -3 }); h.flush();
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [-3 * 11, -1 * 11, 4 * 11, 4 * 11]);
    h.setSpe({ x: 159, y: 95 }); h.flush();
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [160 * 11, 97 * 11, 4 * 11, 4 * 11]);
    assert.ok(h.events.some(e => e.operation === 'clip'), 'overflow is clipped to the stage, not re-positioned');
    assert.deepEqual(h.nativeWrites, []);
});

test('actual FIRE origin stays 33 logical pixels inside the fixed native battle arena and LCD crop starts at 15,16', async () => {
    const m = JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json', import.meta.url), 'utf8'));
    const entry = m.entries.find(e => e.speId === 35 && e.kind === 2);
    assert.ok(entry);
    const h = harness({ data: { g_scale: m.axScale }, spe: { id: entry.speId, kind: entry.kind,
        x: 48, y: 16, resourceIndex: entry.resourceIndex, count: entry.count, picmax: entry.picmax,
        startFrm: entry.startFrm, endFrm: entry.endFrm, resourceFingerprint: entry.resourceFingerprint,
        resourceLength: entry.resourceLength, keyflag: 0, skipEligible: false } });
    h.context.dynLib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url)).toString('hex');
    h.api.setManifest(m); h.api.start();
    const isFire = image => entry.pictures.some(picture => picture.src === image.url), deadline = Date.now() + 2_000;
    while (h.images.filter(isFire).length < entry.picmax && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    const fireImages = h.images.filter(isFire);
    assert.equal(fireImages.length, entry.picmax, 'the attack loads its two native slots independently of the warm credit sheet');
    for (let i = 0; i < entry.picmax; i++) {
        fireImages[i].naturalWidth = entry.pictures[i].width; fireImages[i].naturalHeight = entry.pictures[i].height;
        fireImages[i].onload();
    }
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); h.events.length = 0; h.flush();
    const lcd = h.events.find(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage' && e.args.length === 9);
    assert.deepEqual(lcd.args.slice(1, 5), [60, 64, 520, 256], '640×384 real LCD crop represents native centered 15,16,130,64');
    const scale = h.api.debugSnapshot().scale;
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [33 * scale, 0, 65 * scale, 64 * scale]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('PNG pixel validation reconstructs all five filters and distinguishes opaque, transparent and empty art', () => {
    // Two pixels per row, independently specified RGB/alpha values. These rows
    // exercise None/Sub/Up/Average/Paeth, including filtered alpha bytes.
    const rows = Buffer.from([
        0, 10, 20, 30, 0, 40, 50, 60, 255,
        1, 10, 20, 30, 255, 30, 30, 30, 1,
        2, 0, 0, 0, 1, 0, 0, 0, 255,
        3, 5, 10, 15, 255, 15, 15, 15, 0,
        4, 0, 0, 0, 1, 0, 0, 0, 255
    ]);
    const decoded = decodePng(pngFixture(2, 5, 6, rows));
    assert.deepEqual([...decoded.pixels], [
        10, 20, 30, 0, 40, 50, 60, 255,
        10, 20, 30, 255, 40, 50, 60, 0,
        10, 20, 30, 0, 40, 50, 60, 255,
        10, 20, 30, 255, 40, 50, 60, 255,
        10, 20, 30, 0, 40, 50, 60, 255
    ]);
    assert.equal(decoded.transparent, 4); assert.equal(decoded.nonTransparent, 6);
    checkPictureAlpha(decoded, 1);
    assert.throws(() => checkPictureAlpha(decoded, 0), /completely opaque/);
    const rgb = decodePng(pngFixture(1, 1, 2, Buffer.from([0, 2, 3, 4])));
    const rgba = decodePng(pngFixture(1, 1, 6, Buffer.from([0, 2, 3, 4, 255])));
    checkPictureAlpha(rgb, 0); checkPictureAlpha(rgba, 0);
    assert.throws(() => checkPictureAlpha(rgb, 1), /explicit alpha/);
    assert.throws(() => checkPictureAlpha(rgba, 1), /transparent background/);
    const empty = decodePng(pngFixture(1, 1, 6, Buffer.from([0, 2, 3, 4, 0])));
    assert.throws(() => checkPictureAlpha(empty, 1), /visible artwork/);
    const corrupt = pngFixture(1, 1, 6, Buffer.from([0, 2, 3, 4, 255])); corrupt[29] ^= 1;
    assert.throws(() => decodePng(corrupt), /CRC/);
});

test('actual MAIN layout redraws the full stage before masked titles, honors same-frontier clears and retires late images', async () => {
    const { lib, s, m, units, pictures } = actualMainFixture();
    assert.equal(units.length, 9); assert.equal(pictures.length, 7);
    assert.deepEqual(pictures.map(p => p.mask), [0, 0, 0, 0, 0, 1, 1]);
    const h = harness({ data: { g_scale: 1 }, spe: s }); h.context.dynLib = lib.toString('hex');
    h.api.setManifest(m); h.api.start();
    for (let i = 0; i < 100 && h.images.length < 7; i++) await settle();
    assert.equal(h.images.length, 7); for (let i = 0; i < 7; i++) h.resolveImage(i);
    h.setSpe({ ...s, frameIndex: 7, commitSeq: 20,
        display: { generation: 1, eventId: 1, commitSeq: 7, frameIndex: 7, frameValid: true, visibleFrames: bitset(5, 6, 7) } });
    h.events.length = 0; const nativeBefore = h.nativeSnapshot(); h.flush();
    const scale = h.api.debugSnapshot().scale;
    assert.deepEqual(h.hdDraws().map(e => e.args[0].url), [pictures[0].src, pictures[5].src, pictures[6].src]);
    assert.deepEqual(h.hdDraws().map(e => e.args.slice(1)), [
        [0, 0, 160 * scale, 96 * scale], [20 * scale, 15 * scale, 52 * scale, 64 * scale],
        [90 * scale, 25 * scale, 59 * scale, 49 * scale]
    ], 'the actual absolute SPEUNIT positions and footprint stay unchanged');
    const ops = h.events.filter(e => e.node === 'hd-spe-canvas'), fill = ops.findIndex(e => e.operation === 'fillRect');
    assert.ok(fill > ops.findIndex(e => e.operation === 'drawImage'), 'the native scratch is covered before masked HD composition');
    assert.equal(ops[fill].fillStyle, '#171a16');
    assert.deepEqual(ops[fill].args, [0, 0, 160 * scale, 96 * scale]);
    assert.ok(ops.findIndex(e => e.operation === 'clip') > fill);
    assert.ok(ops.findIndex(e => e.args[0] === h.images[5]) > fill, 'transparent title never overlays old LCD dots');
    assert.equal(h.nativeSnapshot(), nativeBefore);
    h.setSpe({ ...s, frameIndex: 7, display: { ...h.spe().display, commitSeq: 8, visibleFrames: bitset(7) } });
    h.events.length = 0; h.flush();
    assert.deepEqual(h.hdDraws().map(e => e.args[0].url), [pictures[6].src], 'same frontier can retire the background and first title');
    h.setSpe({ ...s, frameIndex: 7, display: { ...h.spe().display, commitSeq: 9, visibleFrames: bitset() } });
    h.events.length = 0; h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.deepEqual(h.hdDraws(), []);
    assert.ok(h.events.some(e => e.operation === 'fillRect'), 'a fully cleared display does not retain the previous title');
    h.setHidden(true); h.events.length = 0; h.resolveImage(5);
    assert.deepEqual(h.events, [], 'a late masked asset cannot repaint the hidden retired presentation');
    h.setHidden(false); h.setReport(1); h.events.length = 0;
    for (let i = 0; i < h.images.length; i++) h.resolveImage(i);
    assert.deepEqual(h.events, [], 'a report owner cannot be covered by a late title');
    assert.equal(h.api.isOpen(), false); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('warm resource pictures survive event retirement while a new event still requires its own real displayed stamp', async () => {
    const h = await loaded(), firstImages = h.images.slice();
    h.setSpe({ active: 0 }); h.api.onEngineSpe(); assert.equal(h.api.isOpen(), false);
    h.events.length = 0;
    h.setSpe({ eventId: 2 }); h.api.onEngineSpe();
    assert.equal(h.api.isOpen(), false, 'cached pixels do not authorize a mismatched old display');
    assert.deepEqual(h.hdDraws(), []);
    h.setSpe({ eventId: 2, frameIndex: 1, display: { generation: 1, eventId: 2, commitSeq: 1, frameIndex: 1,
        frameValid: true, visibleFrames: bitset(1) } });
    h.events.length = 0; h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets', 'the first new event display can use ready resource pictures');
    assert.deepEqual(h.images, firstImages, 'event changes do not issue another resource image load');
    assert.deepEqual(h.hdDraws().map(e => e.args[0]), [firstImages[1]]);
    assert.equal(h.api.debugSnapshot().flushKey, '1:2:1');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('late cached pictures follow the current display, and LIB or manifest changes revoke ready resource authorization', async () => {
    const h = harness(); h.api.setManifest(manifest()); h.api.start();
    for (let i = 0; i < 30 && h.images.length < 2; i++) await settle();
    assert.equal(h.images.length, 2);
    h.setSpe({ eventId: 2, frameIndex: 1, display: { generation: 1, eventId: 2, commitSeq: 9, frameIndex: 1,
        frameValid: true, visibleFrames: bitset(1) } }); h.flush(); h.events.length = 0;
    h.resolveImage(0); h.resolveImage(1);
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.equal(h.api.debugSnapshot().flushKey, '1:2:9');
    assert.deepEqual(h.hdDraws().map(e => e.args[0].url), ['assets/hd-spe/picture-1.png'], 'late load reads the new visible bitmap');
    const oldImages = h.images.slice();
    h.context.dynLib = '01020305'; h.api.onEngineSpe(); h.events.length = 0;
    for (const image of oldImages) image.onload();
    await settle(); assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []);
    h.context.dynLib = bytes.toString('hex'); h.api.onEngineSpe();
    for (let i = 0; i < 30 && h.images.length < 4; i++) await settle();
    assert.equal(h.images.length, 4, 'returning actual bytes requires pictures belonging to the new LIB generation');
    const revoked = h.images.slice(2); h.api.setManifest(manifest({ libSha256: 'f'.repeat(64) })); h.events.length = 0;
    for (const image of revoked) { image.naturalWidth = image.naturalHeight = 64; image.onload(); }
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('prepareStart authenticates and warms all MAIN slots before native entry, then the first display uses that resource cache', async () => {
    const h = preparation(); await preparedImages(h);
    for (let i = 0; i < 6; i++) h.resolveImage(i);
    assert.deepEqual(h.callbacks, []); assert.deepEqual(h.nativeReads, []); assert.deepEqual(h.events, []);
    h.resolveImage(6); h.advance(100);
    assert.deepEqual(h.callbacks, [[]], 'exactly one continuation occurs before any native accessor is touched');
    assert.equal(h.preparationResults[0].ready, true); assert.equal(h.preparationResults[0].reason, 'assets-ready');
    assert.equal(h.preparationResults[0].libSha256, h.fixture.m.libSha256); assert.equal(h.preparationResults[0].slots, 7);
    h.advance(10_000); assert.equal(h.callbacks.length, 1);
    assert.deepEqual(h.hdDraws(), [], 'preloading alone cannot authorize an animation display');
    h.setSpe(h.fixture.s); h.api.start(); h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets', 'first native displayed frame needs no post-entry image load');
    assert.equal(h.images.length, 7); assert.equal(h.hdDraws().at(-1).args[0], h.images[0]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('prepareStart times out once and late pictures cannot use a retired startup owner to draw', async () => {
    const h = preparation(); await preparedImages(h);
    h.advance(10_000); assert.deepEqual(h.callbacks, [[]], 'bounded image wait continues the original engine entry');
    assert.equal(h.preparationResults[0].ready, false); assert.equal(h.preparationResults[0].reason, 'timeout');
    h.setSpe({ active: 0 }); h.events.length = 0;
    for (let i = 0; i < h.images.length; i++) h.resolveImage(i);
    h.advance(10_000); assert.equal(h.callbacks.length, 1); assert.deepEqual(h.hdDraws(), []);
    assert.equal(h.api.isOpen(), false); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('prepareStart releases immediately on failed pictures or a switch to classic, without waiting for its deadline', async () => {
    for (const scenario of ['image-error', 'classic']) {
        const h = preparation(); await preparedImages(h);
        if (scenario === 'image-error') h.images[3].onerror();
        else { h.setStorage('baye/systemUiMode', 'classic'); h.setMode(false); }
        h.advance(100); assert.deepEqual(h.callbacks, [[]], scenario + ' releases before a timeout');
        assert.equal(h.preparationResults[0].ready, false);
        assert.equal(h.preparationResults[0].reason, scenario === 'classic' ? 'classic' : 'asset-load-failed');
        h.setSpe({ active: 0 }); h.events.length = 0;
        for (let i = 0; i < h.images.length; i++) h.resolveImage(i);
        h.advance(10_000); assert.equal(h.callbacks.length, 1); assert.deepEqual(h.hdDraws(), []);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    }
});

test('LIB or manifest replacement during startup revokes late pictures before the continuation can claim ready', async () => {
    for (const scenario of ['LIB', 'manifest']) {
        const h = preparation(); await preparedImages(h);
        const oldImages = h.images.slice();
        if (scenario === 'LIB') {
            h.context.dynLib = '01020305'; h.context.BayeHdLibIdentity.read();
        } else {
            const replacement = structuredClone(h.fixture.m); replacement.entries[0].kind = 3;
            h.api.setManifest(replacement);
        }
        for (const image of oldImages) { image.naturalWidth = image.naturalHeight = 64; image.onload(); }
        for (let i = 0; i < 100 && !h.callbacks.length; i++) { await settle(); h.advance(10); }
        assert.deepEqual(h.callbacks, [[]], scenario + ' replacement continues without early native reads');
        assert.equal(h.preparationResults[0].ready, false, scenario + ' replacement cannot inherit ready from old pixels');
        assert.equal(h.preparationResults[0].reason, scenario === 'LIB' ? 'unknown-lib' : 'opening-not-matched');
        h.setSpe({ active: 0 }); h.events.length = 0;
        for (const image of oldImages) image.onload();
        h.advance(10_000); assert.equal(h.callbacks.length, 1); assert.deepEqual(h.hdDraws(), []);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    }
});

test('a later startup identity-read exception falls back once, while exceptions from the native continuation still propagate', () => {
    const digestRequests = [];
    const crypto = { subtle: { digest(algorithm, data) {
        return new Promise(resolve => digestRequests.push({ algorithm, data: Buffer.from(data), resolve }));
    } } };
    const h = preparation({ crypto });
    assert.equal(h.context.BayeHdLibIdentity.read().status, 'pending', 'the real identity module is hashing actual LIB bytes');
    assert.equal(digestRequests.length, 1); assert.deepEqual(digestRequests[0].data, h.fixture.lib);
    const identity = h.context.BayeHdLibIdentity;
    h.context.BayeHdLibIdentity = new Proxy(identity, { get(target, name) {
        if (name === 'read') return () => { throw new Error('fixture later identity read failed'); };
        return Reflect.get(target, name);
    } });
    h.advance(20);
    assert.deepEqual(h.callbacks, [[]]); assert.equal(h.preparationResults[0].ready, false);
    assert.equal(h.preparationResults[0].reason, 'preparation-failed');
    h.advance(10_000); assert.equal(h.callbacks.length, 1);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []); assert.deepEqual(h.hdDraws(), []);
    // The original callback is _main. Its error is not an asset-preparation
    // failure, whether entry was immediate or came from the timer wait.
    for (const immediate of [true, false]) {
        const next = harness({ preMain: true, storage: { 'baye/systemUiMode': immediate ? 'classic' : 'hd' }, crypto });
        const entryError = new Error('fixture native _main exception'); let calls = 0;
        function enterNative() { calls++; assert.deepEqual(next.nativeReads, []); throw entryError; }
        if (immediate) assert.throws(() => next.api.prepareStart(enterNative), error => error === entryError);
        else {
            next.api.prepareStart(enterNative, { timeoutMs: 20 }); assert.equal(calls, 0);
            assert.throws(() => next.advance(20), error => error === entryError);
        }
        next.advance(10_000); assert.equal(calls, 1, 'a failed engine continuation is never retried');
        assert.deepEqual(next.nativeReads, []); assert.deepEqual(next.keys, []); assert.deepEqual(next.nativeWrites, []);
    }
});

test('prepareStart missing, unknown, invalid, digest-error, classic and expanded paths continue once without native reads', async () => {
    const scenarios = [
        { name: 'manifest-404', fetch: () => Promise.resolve({ ok: false }) },
        { name: 'unknown-LIB', hex: '01020304' },
        { name: 'invalid-LIB', hex: 'not-hex' },
        { name: 'digest-unavailable', crypto: null },
        { name: 'digest-error', crypto: { subtle: { digest: () => Promise.reject(new Error('fixture digest failure')) } } },
        { name: 'classic', storage: { 'baye/systemUiMode': 'classic' } },
        { name: 'expanded', width: 208, height: 128, storage: { 'baye/resolution': '1' } },
        { name: 'missing-LIB', hex: undefined },
        { name: 'zero-deadline', timeoutMs: 0 }
    ];
    for (const options of scenarios) {
        const h = preparation(options.name === 'missing-LIB' ? { ...options, hex: '' } : options);
        for (let i = 0; i < 100 && !h.callbacks.length; i++) { await settle(); h.advance(10); }
        if (!h.callbacks.length) h.advance(5_000);
        assert.deepEqual(h.callbacks, [[]], options.name + ' continues without native accessor probes');
        assert.equal(h.preparationResults[0].ready, false, options.name + ' is a fallback rather than asset acceptance');
        h.advance(10_000); assert.equal(h.callbacks.length, 1, options.name + ' continuation is exactly once');
        assert.equal(h.images.length, 0, options.name + ' cannot request authenticated MAIN art');
        assert.deepEqual(h.hdDraws(), []); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    }
});

test('production SPE manifest authenticates actual LIB payload, complete native slots and decoded mask-specific PNG pixels', () => {
    const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    const m = JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json', import.meta.url), 'utf8'));
    assert.equal(m.schemaVersion, 1); assert.equal(m.axScale, 1);
    assert.equal(m.libSha256, createHash('sha256').update(lib).digest('hex'));
    assert.ok(m.entries.length > 0);
    const decodedImages = new Map();
    for (const entry of m.entries) {
        const address = lib.readUInt32LE((entry.speId - 1) * 4);
        assert.ok(address > 0 && address + 14 <= lib.length);
        assert.equal(lib.readUInt16LE(address + 4), entry.speId);
        assert.equal(lib[address + 12], 0, 'encrypted native resources cannot admit this slot mapping');
        assert.ok(entry.resourceIndex < lib.readUInt16LE(address + 6));
        const itemLength = lib.readUInt32LE(address + 8);
        assert.ok(itemLength > 0, 'current production assets bind a native fixed-length item');
        const begin = address + 14 + entry.resourceIndex * itemLength;
        assert.ok(begin + itemLength <= lib.length);
        const resource = lib.subarray(begin, begin + itemLength);
        let hash = 2166136261;
        for (const byte of resource) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
        assert.equal(entry.resourceLength, itemLength);
        assert.equal(entry.resourceFingerprint, `fnv1a32:${hash.toString(16).padStart(8, '0')}:${itemLength}`);
        assert.equal(entry.count, resource[2]); assert.equal(entry.picmax, resource[3]);
        assert.ok(entry.startFrm >= 0 && entry.startFrm <= entry.endFrm && entry.endFrm <= resource[5]);
        assert.equal(entry.units.length, entry.count); assert.equal(entry.pictures.length, entry.picmax);
        for (let i = 0; i < entry.count; i++) {
            const offset = 6 + i * 5;
            assert.deepEqual(entry.units[i], { frame: i, x: resource[offset], y: resource[offset + 1], picIndex: resource[offset + 4] });
        }
        let offset = 6 + entry.count * 5;
        for (let i = 0; i < entry.picmax; i++) {
            const picture = entry.pictures.find(p => p.picIndex === i);
            assert.ok(picture, 'every native picture index has exactly one production asset');
            const width = resource.readUInt16LE(offset), height = resource.readUInt16LE(offset + 2), mask = resource[offset + 6];
            assert.equal(picture.nativeWidth, width); assert.equal(picture.nativeHeight, height); assert.equal(picture.mask, mask);
            assert.equal(picture.logicalWidth, width / m.axScale); assert.equal(picture.logicalHeight, height / m.axScale);
            offset += 7 + Math.ceil(width / 8) * height * (mask + 1);
            assert.ok(offset <= resource.length, 'native packed-seven-byte picture slot remains in payload');
            if (!decodedImages.has(picture.src)) {
                const decoded = decodePng(readFileSync(new URL('../' + picture.src, import.meta.url)));
                const { pixels, ...summary } = decoded; decodedImages.set(picture.src, summary);
            }
            const decoded = decodedImages.get(picture.src);
            assert.equal(decoded.width, picture.width); assert.equal(decoded.height, picture.height);
            checkPictureAlpha(decoded, mask);
        }
    }
});
