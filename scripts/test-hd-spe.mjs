import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {aidRawScenarios, readAidPublic} from './hd-aid-native-test-fixture.mjs';
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
    let spe = nativeSpe(options.spe), maker = options.maker || null, attack = options.attack || null,
        skillResult = options.skillResult || null, resultOwner = options.resultOwner || null, hidden = false, report = { active: 0 };
    let openingHd = options.storage?.['baye/systemUiMode'] !== 'classic', battleHd = true;
    const events = [], images = [], keys = [], nativeWrites = [], listeners = new Map(), polls = [], nodes = new Map();
    const nativeReads = [], timers = new Map(), preferences = new Map(Object.entries(options.storage || {}));
    let nativeReadable = !options.preMain, timerId = 0, now = 1_000, nativeReadHook = null, drawHook = null;
    function readNative(name, value) { nativeReads.push(name); if (!nativeReadable) throw new Error('premature native access: ' + name); if (nativeReadHook) nativeReadHook(name); return value; }
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
            return (...args) => { events.push({ node: id, operation: key, args, smoothing: target.imageSmoothingEnabled,
                fillStyle: target.fillStyle }); if (drawHook) drawHook(id, key, args); };
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
        maker: () => readNative('hd.maker', maker), attack: () => readNative('hd.attack', attack),
        skillResult: () => readNative('hd.skillResult', skillResult), resultOwner: () => readNative('hd.resultOwner', resultOwner),
        fight: () => readNative('hd.fight', { active: options.fightActive === true }), report: () => readNative('hd.report', report) } };
    class ImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } }
    const context = vm.createContext({ console, document, Image, ImageData, Uint8Array, Uint8ClampedArray,
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
        setNativeReadHook(value) { nativeReadHook = value; }, setDrawHook(value) { drawHook = value; },
        setStorage(key, value) { preferences.set(key, value); },
        spe: () => spe, setSpe: value => { spe = nativeSpe(value); },
        setMaker: value => { maker = value; },
        setAttack: value => { attack = value; },
        setSkillResult: value => { skillResult = value; },
        setResultOwner: value => { resultOwner = value; },
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
function aiTargetFixture() {
    const fixture = actualMainFixture(27), entry = fixture.entry;
    entry.kind = 4; entry.startFrm = 12; entry.endFrm = 17;
    entry.aiTargetVersion = 2; entry.maskSemantics = 'native-and-or-v1';
    const address = fixture.lib.readUInt32LE(26 * 4), raw = fixture.lib.subarray(address + 14, address + 14 + entry.resourceLength);
    let at = 6 + entry.count * 5;
    for (const picture of entry.pictures) {
        const width = picture.nativeWidth, height = picture.nativeHeight, stride = Math.ceil(width / 8), plane = stride * height;
        if (picture.picIndex === 7 || picture.picIndex === 8) {
            const white = Array(32).fill(0);
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                const byte = y * stride + (x >> 3), mask = 128 >> (x & 7), pixel = y * width + x;
                if (!(raw[at + 7 + byte] & mask) && !(raw[at + 7 + plane + byte] & mask)) white[pixel >> 3] |= 1 << (pixel & 7);
            }
            picture.nativeWhitePixels = white;
        } else picture.src = picture.width = picture.height = null;
        at += 7 + plane * (picture.mask + 1);
    }
    const ai = { protocolVersion: 2, valid: true, commandType: 0, commandParam: 0,
        actorIndex: 11, targetIndex: 0, actorPerson: 699, targetPerson: 600, actorX: 6, actorY: 8, targetX: 6, targetY: 7,
        mapSX: 3, mapSY: 5, mapWidth: 20, mapHeight: 20, screenWidth: 160, screenHeight: 96,
        regionX: 48, regionY: 32, regionWidth: 16, regionHeight: 16, paletteZero: 0x00ffffff, paletteInk: 0xff000000,
        basePixels: Array.from({ length: 256 }, (_, i) => i % 2 ? 255 : 0),
        baseRgba: Array.from({ length: 256 }, (_, i) => i % 2 ? [0, 0, 0, 255] : [255, 255, 255, 0]).flat(), clearFrames: bitset() };
    fixture.s = { ...fixture.s, kind: 4, generation: 9, eventId: 7, x: 48, y: 32, startFrm: 12, endFrm: 17,
        frameIndex: 12, keyflag: 0, skipEligible: false, aiTarget: structuredClone(ai),
        display: { generation: 9, eventId: 7, commitSeq: 1, frameIndex: 12, frameValid: true, visibleFrames: bitset(12), aiTarget: structuredClone(ai) } };
    return fixture;
}
async function aiLoaded(changes) {
    const fixture = aiTargetFixture(); if (changes) changes(fixture);
    const h = harness({ spe: fixture.s, data: { g_scale: 1 } }); h.context.dynLib = fixture.lib.toString('hex');
    h.api.setManifest(fixture.m); h.api.start();
    const deadline = performance.now() + 2000;
    while (h.images.length < 2 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1));
    assert.equal(h.images.length, 2, 'only native target slots7/8 are requested: ' + JSON.stringify(h.api.debugSnapshot()));
    h.resolveImage(0); h.resolveImage(1); h.flush();
    return { h, fixture };
}
function aiBasePaint(h) {
    return h.events.filter(e => e.node.startsWith('scratch-') && e.operation === 'putImageData' && e.args[0].width === 16).at(-1);
}
function aiGrayBase(fixture) {
    for (const ai of [fixture.s.aiTarget, fixture.s.display.aiTarget]) {
        for (const p of [0, 2]) { ai.basePixels[p] = 207; ai.baseRgba.splice(p * 4, 4, 207, 207, 207, 255); }
        ai.basePixels[4] = 73; ai.baseRgba.splice(16, 4, 18, 80, 130, 255);
    }
}
test('AI protocol2 preserves certified gray and color RGBA instead of treating every nonzero index as ink', async () => {
    const { h } = await aiLoaded(aiGrayBase), pixels = aiBasePaint(h).args[0].data;
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual(Array.from(pixels.slice(0, 12)), [207, 207, 207, 255, 0, 0, 0, 255, 207, 207, 207, 255]);
    assert.deepEqual(Array.from(pixels.slice(12, 24)), [0, 0, 0, 255, 18, 80, 130, 255, 0, 0, 0, 255]);
    assert.deepEqual(Array.from(pixels.slice(24, 28)), [255, 255, 255, 0], 'raw native zero stays transparent white until Canvas readback');
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [528, 352, 176, 176]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('AI displayed gray base survives future current clears and actual copied clear uses paletteZero', async () => {
    const { h, fixture } = await aiLoaded(aiGrayBase);
    h.setSpe({ ...fixture.s, frameIndex: 17, aiTarget: { ...fixture.s.aiTarget, clearFrames: bitset(12) } }); h.flush();
    assert.deepEqual(Array.from(aiBasePaint(h).args[0].data.slice(0, 4)), [207, 207, 207, 255]);
    h.setSpe({ ...fixture.s, frameIndex: 17, commitSeq: 2, aiTarget: { ...fixture.s.aiTarget, clearFrames: bitset(12) },
        display: { ...fixture.s.display, frameIndex: 17, commitSeq: 2, visibleFrames: bitset(16, 17),
            aiTarget: { ...fixture.s.display.aiTarget, clearFrames: bitset(12) } } });
    h.events.length = 0; h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual(Array.from(aiBasePaint(h).args[0].data), Array(256).fill([255, 255, 255, 0]).flat());
    assert.deepEqual(h.hdDraws().map(e => e.args[0].url), [fixture.entry.pictures[7].src, fixture.entry.pictures[8].src]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('AI protocol2 rejects missing, untyped, inconsistent or endpoint-mismatched RGBA and legacy base observations', async () => {
    const changes = [f => { f.s.aiTarget.protocolVersion = 1; }, f => { f.s.display.aiTarget.protocolVersion = 1; },
        f => { delete f.s.aiTarget.baseRgba; }, f => { delete f.s.display.aiTarget.baseRgba; },
        f => { f.s.display.aiTarget.baseRgba.pop(); }, f => { f.s.display.aiTarget.baseRgba[0] = '255'; },
        f => { f.s.display.aiTarget.baseRgba[0] = NaN; }, f => { f.s.display.aiTarget.baseRgba[0] = 256; },
        f => { f.s.display.aiTarget.basePixels[0] = -1; }, f => { f.s.display.aiTarget.basePixels[0] = 256; },
        f => { f.s.display.aiTarget.baseRgba[0] = 254; },
        f => { for (const ai of [f.s.aiTarget, f.s.display.aiTarget]) ai.baseRgba[0] = 0; },
        f => { for (const ai of [f.s.aiTarget, f.s.display.aiTarget]) ai.baseRgba[7] = 254; },
        f => { aiGrayBase(f); for (const ai of [f.s.aiTarget, f.s.display.aiTarget]) ai.baseRgba[8] = 206; }];
    for (const change of changes) {
        const { h } = await aiLoaded(change);
        assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []);
        assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
        assert.deepEqual(JSON.parse(JSON.stringify(h.api.debugSnapshot().sourceRect)), { x: 0, y: 0, width: 160, height: 96 });
    }
});
test('AI protocol2 final observation rejects reentrant RGBA drift before any HD layer and accepts a fresh certified event', async () => {
    const { h, fixture } = await aiLoaded(aiGrayBase); h.events.length = 0;
    let changed = false;
    h.setNativeReadHook(name => {
        if (name === 'hd.report' && !changed && new Error().stack.includes('paintAiTarget')) {
            changed = true;
            const next = structuredClone(fixture.s);
            for (const ai of [next.aiTarget, next.display.aiTarget]) for (const p of [0, 2]) ai.baseRgba.splice(p * 4, 4, 208, 208, 208, 255);
            h.setSpe(next);
        }
    });
    h.flush(); assert.equal(changed, true); assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []);
    h.setNativeReadHook(null); h.setSpe({ ...fixture.s, eventId: 8, display: { ...fixture.s.display, eventId: 8 } }); h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual(Array.from(aiBasePaint(h).args[0].data.slice(0, 4)), [207, 207, 207, 255]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('AI target hint keeps actual full LCD outside its real16px cell and uses native base palette and explicit white bits', async () => {
    const { h, fixture } = await aiLoaded(), debug = h.api.debugSnapshot();
    assert.equal(debug.source, 'hd-assets'); assert.equal(debug.presentation, 'ai-target'); assert.equal(debug.outsideSource, 'lcd');
    assert.deepEqual(JSON.parse(JSON.stringify(debug.sourceRect)), { x: 0, y: 0, width: 160, height: 96 });
    assert.deepEqual(JSON.parse(JSON.stringify(debug.hdRegion)), { x: 48, y: 32, width: 16, height: 16 });
    const native = h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage' && e.args[0].id?.startsWith('scratch-'));
    assert.ok(native.some(e => JSON.stringify(e.args.slice(1)) === JSON.stringify([0, 0, 640, 384, 0, 0, 1760, 1056])), 'complete actual flush source, no arena crop');
    assert.deepEqual(Array.from(aiBasePaint(h).args[0].data.slice(0, 8)), [255, 255, 255, 0, 0, 0, 0, 255], 'putImageData receives original RGBA, not inferred black/white');
    const whiteIndices = fixture.entry.pictures[7].nativeWhitePixels.flatMap((byte, i) => Array.from({ length: 8 }, (_, bit) => byte & (1 << bit) ? i * 8 + bit : -1).filter(v => v >= 0));
    assert.deepEqual(whiteIndices, [68, 85, 102, 119, 136, 153, 170], 'fresh packedAND/OR white cuts');
    assert.ok(h.events.some(e => e.node === 'hd-spe-canvas' && e.operation === 'clearRect' && JSON.stringify(e.args) === JSON.stringify([572, 396, 11, 11])), 'pixel68 clears the real native cell position');
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [528, 352, 176, 176]);
    assert.equal(h.nodes.get('hd-spe-title').textContent, 'AI目标提示');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('AI current future clears never replace a displayed base; copied cumulative clear empties the cell before live16/17 overlap', async () => {
    const { h, fixture } = await aiLoaded();
    h.setSpe({ ...fixture.s, frameIndex: 17, aiTarget: { ...fixture.s.aiTarget, clearFrames: bitset(12, 13, 14) } });
    h.flush(); assert.equal(aiBasePaint(h).args[0].data[7], 255, 'future current clear is not this LCD display');
    const next = { ...fixture.s, frameIndex: 17, commitSeq: 2, aiTarget: { ...fixture.s.aiTarget, clearFrames: bitset(12, 13, 14) },
        display: { ...fixture.s.display, commitSeq: 2, frameIndex: 17, visibleFrames: bitset(16, 17),
            aiTarget: { ...fixture.s.display.aiTarget, clearFrames: bitset(12, 13, 14) } } };
    h.setSpe(next); h.events.length = 0; h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual(Array.from(aiBasePaint(h).args[0].data), Array(256).fill([255, 255, 255, 0]).flat(), 'actual full clear uses transparent native zero, not old ink');
    assert.deepEqual(h.hdDraws().map(e => e.args[0].url), [fixture.entry.pictures[7].src, fixture.entry.pictures[8].src]);
    assert.deepEqual(Array.from(h.api.debugSnapshot().displayedFrames), [16, 17]);
    assert.equal(h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'fillRect').length, 0, 'no invented charcoal scenery');
});
test('AI target metadata omissions and mismatched actor, palette, region or clear bytes preserve actual LCD', async () => {
    const changes = [s => { s.aiTarget.valid = false; }, s => { s.display.aiTarget = null; },
        s => { s.display.aiTarget.basePixels[1] = 1; }, s => { s.display.aiTarget.actorPerson = 65535; },
        s => { s.display.aiTarget.actorIndex = 20; }, s => { s.display.aiTarget.regionWidth = 17; },
        s => { s.display.aiTarget.regionX = 145; }, s => { s.display.aiTarget.paletteZero = 0xffffffff; },
        s => { s.display.aiTarget.clearFrames = bitset(11); }, s => { s.display.visibleFrames = bitset(17); },
        s => { s.display.aiTarget.clearFrames = bitset(14); }, s => { s.keyflag = 1; }, s => { s.skipEligible = true; }];
    for (const change of changes) {
        const { h } = await aiLoaded(f => change(f.s));
        assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []); assert.deepEqual(h.keys, []);
        assert.deepEqual(JSON.parse(JSON.stringify(h.api.debugSnapshot().sourceRect)), { x: 0, y: 0, width: 160, height: 96 });
    }
});
test('AI animation never owns skip, Enter or Escape and has no surviving NUM or hold presentation', async () => {
    const { h, fixture } = await aiLoaded();
    assert.equal(h.api.skip(), false); assert.equal(h.key().prevented, false); assert.equal(h.key({ key: 'Escape', keyCode: 27 }).prevented, false);
    assert.equal(h.nodes.get('hd-spe-skip').hidden, true); assert.equal(h.nodes.get('hd-spe-return').hidden, true);
    h.setSpe({ ...fixture.s, active: 0 }); h.api.onEngineSpe();
    assert.equal(h.api.isOpen(), false); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('AI late pictures cannot revive an ended event, hidden page, report or classic mode', async () => {
    for (const retire of [h => { h.setSpe({ ...h.spe(), active: 0 }); h.api.onEngineSpe(); },
        h => h.setHidden(true), h => h.setReport(1), h => h.setMode(false)]) {
        const fixture = aiTargetFixture(), h = harness({ spe: fixture.s, data: { g_scale: 1 } }); h.context.dynLib = fixture.lib.toString('hex');
        h.api.setManifest(fixture.m); h.api.start();
        for (let i = 0; i < 30 && h.images.length < 2; i++) await settle();
        h.flush(); retire(h); h.events.length = 0; h.resolveImage(0); h.resolveImage(1);
        assert.deepEqual(h.hdDraws(), []); assert.equal(h.api.isOpen(), false); assert.deepEqual(h.keys, []);
    }
});
test('AI image completion waits for real callback bytes, never relabels a newer event display, and failed dimensions use LCD', async () => {
    const fixture = aiTargetFixture(), h = harness({ spe: fixture.s, data: { g_scale: 1 } }); h.context.dynLib = fixture.lib.toString('hex');
    h.api.setManifest(fixture.m); h.api.start(); for (let i = 0; i < 30 && h.images.length < 2; i++) await settle();
    h.resolveImage(0); h.resolveImage(1); assert.equal(h.api.debugSnapshot().source, 'lcd', 'poll-only DOM copy is not native callback proof');
    h.flush(); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    h.setSpe({ ...fixture.s, eventId: 8 }); h.api.onEngineSpe(); assert.equal(h.api.isOpen(), false, 'display event7 is not event8');
    h.setSpe({ ...fixture.s, eventId: 8, display: { ...fixture.s.display, eventId: 8 } }); h.api.onEngineSpe();
    assert.equal(h.api.debugSnapshot().source, 'lcd'); h.flush(); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    const failed = harness({ spe: fixture.s, data: { g_scale: 1 } }); failed.context.dynLib = fixture.lib.toString('hex');
    failed.api.setManifest(fixture.m); failed.api.start(); for (let i = 0; i < 30 && failed.images.length < 2; i++) await settle();
    failed.resolveImage(0, false); failed.resolveImage(1); failed.flush(); assert.equal(failed.api.debugSnapshot().source, 'lcd');
});
test('AI draw failure restores the complete real LCD and balances the clipped Canvas state', async () => {
    const { h } = await aiLoaded(); h.events.length = 0;
    h.setDrawHook((id, operation, args) => { if (id === 'hd-spe-canvas' && operation === 'drawImage' && args[0].url) throw new Error('decode changed'); });
    h.flush();
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.api.debugSnapshot().fallbackReason, 'ai-target-draw-failed');
    const events = h.events.filter(e => e.node === 'hd-spe-canvas');
    assert.equal(events.filter(e => e.operation === 'save').length, events.filter(e => e.operation === 'restore').length);
    assert.deepEqual(events.filter(e => e.operation === 'drawImage').at(-1).args.slice(1), [0, 0, 640, 384, 0, 0, 1760, 1056]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('AI final overlay read retirement rejects the old snapshot while a fresh native owner can still render', async () => {
    const { h, fixture } = await aiLoaded(); h.events.length = 0;
    let retired = false;
    h.setNativeReadHook(name => {
        if (name === 'hd.report' && !retired && new Error().stack.includes('paintAiTarget')) {
            retired = true; h.setSpe({ ...fixture.s, aiTarget: { ...fixture.s.aiTarget, valid: false } });
        }
    });
    h.flush(); assert.equal(retired, true); assert.deepEqual(h.hdDraws(), []);
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    h.setNativeReadHook(null); h.setSpe({ ...fixture.s, eventId: 8, display: { ...fixture.s.display, eventId: 8 } });
    h.flush(); assert.equal(h.api.debugSnapshot().source, 'hd-assets', 'fresh actual event, not a resurrected old source');
});
test('AI hidden recovery requires fresh native callback bytes and actual LIB changes revoke cached art', async () => {
    const { h } = await aiLoaded(); h.setHidden(true); h.events.length = 0; h.api.onEngineSpe();
    assert.deepEqual(h.events, [], 'hidden target does no Canvas work');
    h.setHidden(false); assert.equal(h.api.debugSnapshot().source, 'lcd');
    h.flush(); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    h.context.dynLib = '01020304'; h.api.onEngineSpe();
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.keys, []);
});
test('AI entry rejects unproven mask semantics, missing white cuts, wrong native units and invented numeric composition', async () => {
    for (const change of [e => { e.maskSemantics = 'alpha'; }, e => { delete e.pictures[7].nativeWhitePixels; },
        e => { e.units[12].x = 1; }, e => { e.units[13].picIndex = 7; }, e => { e.pictures[7].mask = 0; },
        e => { e.skillResultVersion = 1; e.skillNumber = {}; }]) {
        const fixture = aiTargetFixture(); change(fixture.entry);
        const h = harness({ spe: fixture.s, data: { g_scale: 1 } }); h.context.dynLib = fixture.lib.toString('hex');
        h.api.setManifest(fixture.m); h.api.start(); for (let i = 0; i < 30; i++) await settle(); h.flush();
        assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.images.length, 0); assert.deepEqual(h.keys, []);
    }
});
test('AI idle battle prewarm fetches only the two certified slots, without advancing frames, drawing or entering a numeric owner', async () => {
    const fixture = aiTargetFixture(), h = harness({ spe: { active: 0 }, data: { g_scale: 1 }, fightActive: true });
    h.context.dynLib = fixture.lib.toString('hex'); h.api.setManifest(fixture.m); h.api.start();
    for (let i = 0; i < 30 && h.images.length < 2; i++) await settle();
    assert.equal(h.images.length, 2); h.events.length = 0; h.resolveImage(0); h.resolveImage(1);
    assert.deepEqual(h.hdDraws(), []); assert.equal(h.api.isOpen(), false); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    h.setSpe(fixture.s); h.flush(); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.equal(h.images.length, 2, 'actual event reuses authorized prewarm, not another playback');
});
function statusFixture(reason = 1) {
    const fixture = actualMainFixture(27), entry = fixture.entry, start = reason === 1 ? 0 : 6, end = start + 5;
    Object.assign(entry, { kind: 4, startFrm: start, endFrm: end, statusVersion: 1, statusReason: reason, maskSemantics: 'native-and-or-v1' });
    const address = fixture.lib.readUInt32LE(26 * 4), raw = fixture.lib.subarray(address + 14, address + 14 + entry.resourceLength);
    const used = new Set(entry.units.slice(start, end + 1).map(u => u.picIndex));
    let at = 6 + entry.count * 5;
    for (const picture of entry.pictures) {
        const width = picture.nativeWidth, height = picture.nativeHeight, stride = Math.ceil(width / 8), plane = stride * height;
        if (used.has(picture.picIndex)) {
            picture.src = `assets/hd-spe/status-27/picture-${picture.picIndex}.png`;
            const white = Array(32).fill(0);
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                const byte = y * stride + (x >> 3), mask = 128 >> (x & 7), pixel = y * width + x;
                if (!(raw[at + 7 + byte] & mask) && !(raw[at + 7 + plane + byte] & mask)) white[pixel >> 3] |= 1 << (pixel & 7);
            }
            picture.nativeWhitePixels = white;
        } else picture.src = picture.width = picture.height = null;
        at += 7 + plane * (picture.mask + 1);
    }
    const status = { protocolVersion: 1, valid: true, reason, phase: 1,
        subjectIndex: 3, subjectPerson: 600, subjectX: 6, subjectY: 7,
        beforeLevel: 2, afterLevel: reason === 1 ? 3 : 2, beforeExperience: reason === 1 ? 114 : 14, afterExperience: 14,
        beforeState: 0, afterState: reason === 1 ? 0 : 8, beforeHp: reason === 1 ? 60 : 0, afterHp: reason === 1 ? 60 : 0,
        beforeArms: 900, afterArms: 900, levelMax: 99,
        mapSX: 3, mapSY: 5, mapWidth: 20, mapHeight: 20, screenWidth: 160, screenHeight: 96,
        regionX: 48, regionY: 32, regionWidth: 16, regionHeight: 16, paletteZero: 0x00ffffff, paletteInk: 0xff000000,
        basePixels: Array.from({ length: 256 }, (_, i) => i % 2 ? 255 : 0),
        baseRgba: Array.from({ length: 256 }, (_, i) => i % 2 ? [0, 0, 0, 255] : [255, 255, 255, 0]).flat(), clearFrames: bitset() };
    for (const p of [0, 2]) { status.basePixels[p] = 207; status.baseRgba.splice(p * 4, 4, 207, 207, 207, 255); }
    fixture.s = { ...fixture.s, kind: 4, generation: 9, eventId: 7, x: 48, y: 32, startFrm: start, endFrm: end,
        frameIndex: start, keyflag: 0, skipEligible: false, statusEffect: structuredClone(status),
        display: { generation: 9, eventId: 7, commitSeq: 1, frameIndex: start, frameValid: true,
            visibleFrames: bitset(start), statusEffect: structuredClone(status) } };
    return fixture;
}
async function statusLoaded(reason = 1, change, options = {}, imageCount = 5) {
    const fixture = statusFixture(reason); if (change) change(fixture);
    const h = harness({ spe: fixture.s, data: { g_scale: 1 }, ...options }); h.context.dynLib = fixture.lib.toString('hex');
    h.api.setManifest(fixture.m); h.api.start();
    for (let i = 0; i < 30 && (imageCount === 0 || h.images.length < imageCount); i++) await settle();
    assert.equal(h.images.length, imageCount, 'status slot request count: ' + (change ? change.toString() : 'certified default range'));
    h.images.forEach((_, i) => h.resolveImage(i)); h.flush(); return { h, fixture };
}
test('status ranges use five fresh packed slots each, preserve full LCD and show their actual gray-base single cell', async () => {
    for (const reason of [1, 2]) {
        const { h, fixture } = await statusLoaded(reason), debug = h.api.debugSnapshot();
        assert.equal(debug.source, 'hd-assets'); assert.equal(debug.presentation, 'status-effect'); assert.equal(debug.statusEffect.reason, reason);
        assert.deepEqual(JSON.parse(JSON.stringify(debug.sourceRect)), { x: 0, y: 0, width: 160, height: 96 });
        assert.deepEqual(JSON.parse(JSON.stringify(debug.hdRegion)), { x: 48, y: 32, width: 16, height: 16 });
        assert.deepEqual(Array.from(aiBasePaint(h).args[0].data.slice(0, 12)), [207, 207, 207, 255, 0, 0, 0, 255, 207, 207, 207, 255]);
        assert.deepEqual(fixture.entry.units.slice(fixture.entry.startFrm, fixture.entry.endFrm + 1).map(u => u.picIndex), reason === 1 ? [2, 3, 4, 1, 0, 1] : [2, 3, 4, 6, 5, 6]);
        assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [528, 352, 176, 176]);
        assert.equal(h.hdDraws().at(-1).args[0].url, fixture.entry.pictures[2].src);
        assert.equal(h.nodes.get('hd-spe-title').textContent, reason === 1 ? '升级提示' : '战场退场提示');
        assert.equal(h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'clearRect' && e.args[2] === 11).length, 99, 'pic2 has99 actual forced-white bits, not the AI sword7');
        assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    }
});
test('status level cap, U8 wrap, pending death and native initialization phase do not inherit living AI actor restrictions', async () => {
    for (const values of [
        { beforeLevel: 99, afterLevel: 99, beforeHp: 0, afterHp: 0, beforeArms: 0, afterArms: 0 },
        { beforeLevel: 255, afterLevel: 0, levelMax: 255, subjectIndex: 19, subjectPerson: 1999 },
        { beforeHp: 65535, afterHp: 65535, beforeArms: 65535, afterArms: 65535 },
        { phase: 2, subjectIndex: 0, subjectPerson: 0 }
    ]) {
        const { h } = await statusLoaded(1, f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) Object.assign(s, values); },
            { fightActive: values.phase !== 2 });
        assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.deepEqual(h.keys, []);
    }
    const { h } = await statusLoaded(2, f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect])
        Object.assign(s, { subjectIndex: 0, subjectPerson: 0, beforeHp: 60, afterHp: 60, beforeArms: 0, afterArms: 0 }); });
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.equal(h.api.debugSnapshot().statusEffect.afterState, 8);
});
test('status current future clear never clears an older LCD commit; final copied range uses native zero and correct last picture', async () => {
    for (const reason of [1, 2]) {
        const { h, fixture } = await statusLoaded(reason), start = fixture.s.startFrm, end = fixture.s.endFrm;
        const clears = bitset(...Array.from({ length: 5 }, (_, i) => start + i));
        h.setSpe({ ...fixture.s, frameIndex: end, statusEffect: { ...fixture.s.statusEffect, clearFrames: clears } }); h.flush();
        assert.deepEqual(Array.from(aiBasePaint(h).args[0].data.slice(0, 4)), [207, 207, 207, 255]);
        h.setSpe({ ...fixture.s, frameIndex: end, commitSeq: 2, statusEffect: { ...fixture.s.statusEffect, clearFrames: clears },
            display: { ...fixture.s.display, frameIndex: end, commitSeq: 2, visibleFrames: bitset(end),
                statusEffect: { ...fixture.s.display.statusEffect, clearFrames: clears } } });
        h.events.length = 0; h.flush();
        assert.deepEqual(Array.from(aiBasePaint(h).args[0].data), Array(256).fill([255, 255, 255, 0]).flat());
        assert.deepEqual(h.hdDraws().map(e => e.args[0].url), [fixture.entry.pictures[reason === 1 ? 1 : 6].src]);
        assert.deepEqual(Array.from(h.api.debugSnapshot().displayedFrames), [end]); assert.deepEqual(h.keys, []);
    }
});
test('status metadata and independent reason/subject/base/clear tickets fail closed to the full actual LCD', async () => {
    const changes = [f => { f.s.statusEffect = null; }, f => { f.s.display.statusEffect.valid = false; },
        f => { f.s.display.statusEffect.protocolVersion = 2; }, f => { f.s.display.statusEffect.reason = 2; },
        f => { f.s.display.statusEffect.phase = 3; }, f => { f.s.display.statusEffect.subjectIndex = 20; },
        f => { f.s.display.statusEffect.subjectPerson = 2000; }, f => { f.s.display.statusEffect.subjectX++; },
        f => { f.s.display.statusEffect.afterLevel = 10; }, f => { f.s.display.statusEffect.afterExperience = 15; },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.afterExperience = 15; },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.afterLevel = 10; },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.beforeState = s.afterState = 8; },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.afterState = 1; },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.afterHp = 61; },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.afterArms = 901; },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.beforeHp = s.afterHp = 65536; },
        f => { f.s.display.statusEffect.baseRgba[0] = 206; }, f => { f.s.display.statusEffect.baseRgba.pop(); },
        f => { for (const s of [f.s.statusEffect, f.s.display.statusEffect]) s.baseRgba[8] = 206; },
        f => { f.s.display.statusEffect.clearFrames = bitset(6); },
        f => { f.s.display.statusEffect.clearFrames = bitset(0); }];
    const cases = changes.map(change => ({ change, imageCount: 5 })).concat([
        { change: f => { f.s.display.visibleFrames = bitset(6); }, imageCount: 0 },
        { change: f => { f.s.keyflag = 1; }, imageCount: 5 },
        { change: f => { f.s.skipEligible = true; }, imageCount: 5 }
    ]);
    for (const { change, imageCount } of cases) {
        const { h } = await statusLoaded(1, change, {}, imageCount); assert.equal(h.api.debugSnapshot().source, 'lcd');
        assert.deepEqual(h.hdDraws(), []); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
        assert.deepEqual(JSON.parse(JSON.stringify(h.api.debugSnapshot().sourceRect)), { x: 0, y: 0, width: 160, height: 96 });
    }
    for (const change of [s => { s.afterState = 0; }, s => { s.afterHp = 1; s.afterArms = 1; },
        s => { s.beforeState = 8; }, s => { s.afterLevel++; }, s => { s.afterExperience++; },
        s => { s.beforeHp = 1; }, s => { s.afterArms = 0; }]) {
        const { h } = await statusLoaded(2, f => [f.s.statusEffect, f.s.display.statusEffect].forEach(change));
        assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []);
    }
});
test('status selected image failure and classic mode retain a full160x96 LCD instead of a cropped arena or invented numeric scene', async () => {
    const fixture = statusFixture(), failed = harness({ spe: fixture.s, data: { g_scale: 1 } }); failed.context.dynLib = fixture.lib.toString('hex');
    failed.api.setManifest(fixture.m); failed.api.start(); for (let i = 0; i < 30 && failed.images.length < 5; i++) await settle();
    failed.images.forEach((_, i) => failed.resolveImage(i, i !== 2)); failed.flush();
    assert.equal(failed.api.debugSnapshot().source, 'lcd'); assert.deepEqual(failed.hdDraws(), []);
    assert.deepEqual(failed.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage').at(-1).args.slice(1), [0, 0, 640, 384, 0, 0, 1760, 1056]);
    const classic = await statusLoaded(); classic.h.setMode(false); classic.h.events.length = 0; classic.h.flush();
    assert.equal(classic.h.api.isOpen(), false); assert.deepEqual(classic.h.hdDraws(), []);
    assert.deepEqual(failed.keys, []); assert.deepEqual(classic.h.keys, []);
});
test('status late images cannot cover a report, ended event, hidden page or classic mode', async () => {
    for (const retire of [h => h.setReport(1), h => { h.setSpe({ ...h.spe(), active: 0 }); h.api.onEngineSpe(); },
        h => h.setHidden(true), h => h.setMode(false)]) {
        const fixture = statusFixture(2), h = harness({ spe: fixture.s, data: { g_scale: 1 } }); h.context.dynLib = fixture.lib.toString('hex');
        h.api.setManifest(fixture.m); h.api.start(); for (let i = 0; i < 30 && h.images.length < 5; i++) await settle();
        h.flush(); retire(h); h.events.length = 0; h.images.forEach((_, i) => h.resolveImage(i));
        assert.deepEqual(h.hdDraws(), []); assert.equal(h.api.isOpen(), false); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    }
});
test('status final read rejects a reentrant subject/event or gray-base change and a new certified callback can still render', async () => {
    for (const change of [s => { s.eventId++; s.display.eventId++; }, s => { s.statusEffect.subjectPerson++; s.display.statusEffect.subjectPerson++; },
        s => { for (const a of [s.statusEffect, s.display.statusEffect]) for (const p of [0, 2]) a.baseRgba.splice(p * 4, 4, 208, 208, 208, 255); }]) {
        const { h, fixture } = await statusLoaded(); h.events.length = 0; let changed = false;
        h.setNativeReadHook(name => { if (name === 'hd.report' && !changed && new Error().stack.includes('paintStatusEffect')) {
            changed = true; const next = structuredClone(fixture.s); change(next); h.setSpe(next);
        } });
        h.flush(); assert.equal(changed, true); assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []);
        h.setNativeReadHook(null); h.setSpe({ ...fixture.s, eventId: 9, display: { ...fixture.s.display, eventId: 9 } }); h.flush();
        assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    }
});
test('status death following level-up never borrows the previous event callback or a late old image', async () => {
    const first = statusFixture(), second = statusFixture(2), h = harness({ spe: first.s, data: { g_scale: 1 } }); h.context.dynLib = first.lib.toString('hex');
    h.api.setManifest({ ...first.m, entries: [first.entry, second.entry] }); h.api.start();
    for (let i = 0; i < 30 && h.images.length < 5; i++) await settle(); const oldCount = h.images.length; h.flush();
    h.setSpe({ ...second.s, eventId: 8, display: { ...second.s.display, eventId: 8 } }); h.api.onEngineSpe();
    for (let i = 0; i < oldCount; i++) h.resolveImage(i);
    for (let i = 0; i < 30 && h.images.length < 7; i++) await settle();
    for (let i = oldCount; i < h.images.length; i++) h.resolveImage(i);
    assert.equal(h.api.debugSnapshot().source, 'lcd', 'new event is waiting for its actual LCD callback');
    h.events.length = 0; h.flush(); assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.equal(h.api.debugSnapshot().statusEffect.reason, 2); assert.deepEqual(Array.from(h.api.debugSnapshot().displayedFrames), [6]);
    assert.equal(h.images.length, 7, 'actual shared slots2/3/4 reuse their authorized original images'); assert.deepEqual(h.keys, []);
});
test('status does not consume input or read a surviving attack/skill/Maker owner, and ended scope has no NUM or hold', async () => {
    const { h, fixture } = await statusLoaded(2);
    assert.equal(h.nativeReads.some(n => ['hd.attack', 'hd.skillResult', 'hd.maker', 'hd.resultOwner'].includes(n)), false);
    assert.equal(h.api.skip(), false); assert.equal(h.api.returnToTitle(), false);
    assert.equal(h.key().prevented, false); assert.equal(h.key({ key: 'Escape', keyCode: 27 }).prevented, false);
    assert.equal(h.nodes.get('hd-spe-skip').hidden, true); assert.equal(h.nodes.get('hd-spe-return').hidden, true);
    h.setSpe({ ...fixture.s, active: 0 }); h.api.onEngineSpe(); assert.equal(h.api.isOpen(), false);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('status draw failure restores full actual LCD and balances the shared cell Canvas state', async () => {
    const { h } = await statusLoaded(); h.events.length = 0;
    h.setDrawHook((id, op, args) => { if (id === 'hd-spe-canvas' && op === 'drawImage' && args[0].url) throw new Error('art retired'); }); h.flush();
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.api.debugSnapshot().fallbackReason, 'status-effect-draw-failed');
    const events = h.events.filter(e => e.node === 'hd-spe-canvas');
    assert.equal(events.filter(e => e.operation === 'save').length, events.filter(e => e.operation === 'restore').length);
    assert.deepEqual(events.filter(e => e.operation === 'drawImage').at(-1).args.slice(1), [0, 0, 640, 384, 0, 0, 1760, 1056]); assert.deepEqual(h.keys, []);
});
test('status rejects altered slot semantics, range/reason, missing white cuts or borrowed AI/numeric schema', async () => {
    for (const change of [e => { e.statusReason = 2; }, e => { e.statusVersion = 2; }, e => { e.maskSemantics = 'alpha'; },
        e => { delete e.pictures[2].nativeWhitePixels; }, e => { e.units[0].x = 1; }, e => { e.units[1].picIndex = 2; },
        e => { e.pictures[2].mask = 0; }, e => { e.pictures[4].src = e.pictures[4].width = e.pictures[4].height = null; },
        e => { e.aiTargetVersion = 2; }, e => { e.compositionVersion = 1; }, e => { e.skillResultVersion = 1; }]) {
        const fixture = statusFixture(); change(fixture.entry);
        const h = harness({ spe: fixture.s, data: { g_scale: 1 } }); h.context.dynLib = fixture.lib.toString('hex');
        h.api.setManifest(fixture.m); h.api.start(); for (let i = 0; i < 30; i++) await settle(); h.flush();
        assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.deepEqual(h.hdDraws(), []); assert.equal(h.images.length, 0); assert.deepEqual(h.keys, []);
    }
});
test('status idle prewarm resolves both exact ranges into seven shared slots without any native input or frame work', async () => {
    const first = statusFixture(), second = statusFixture(2), h = harness({ spe: { active: 0 }, data: { g_scale: 1 }, fightActive: true });
    h.context.dynLib = first.lib.toString('hex'); h.api.setManifest({ ...first.m, entries: [first.entry, second.entry] }); h.api.start();
    for (let i = 0; i < 30 && h.images.length < 7; i++) await settle(); assert.equal(h.images.length, 7);
    h.events.length = 0; h.images.forEach((_, i) => h.resolveImage(i)); assert.deepEqual(h.hdDraws(), []); assert.equal(h.api.isOpen(), false);
    h.setSpe(second.s); h.flush(); assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.equal(h.images.length, 7);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
function attackFixture() {
    const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    const address = lib.readUInt32LE(20 * 4), length = lib.readUInt32LE(address + 8), resource = lib.subarray(address + 14, address + 14 + length);
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
        return { picIndex, src: `assets/hd-spe/attack-fixture-${picIndex}.png`, width: 64, height: 64,
            nativeWidth, nativeHeight, logicalWidth: nativeWidth, logicalHeight: nativeHeight, mask };
    });
    const background = { valid: true, id: 16, resourceIndex: 0, pictureIndex: 0, nativeWidth: 130, nativeHeight: 64,
        count: 1, mask: 0, x: 15, y: 16, resourceLength: 1095, resourceFingerprint: 'fnv1a32:3bf544d6:1095' };
    const number = { valid: true, id: 15, resourceIndex: 0, pictureIndex: 0, nativeWidth: 12, nativeHeight: 16,
        count: 10, mask: 0, x: 0, y: 0, resourceLength: 327, resourceFingerprint: 'fnv1a32:b37d7407:327' };
    const entry = { speId: 21, resourceIndex: 0, kind: 3, startFrm: 9, endFrm: 17, count: units.length, picmax: pictures.length,
        resourceLength: length, resourceFingerprint: `fnv1a32:${fnv.toString(16).padStart(8, '0')}:${length}`, units, pictures,
        compositionVersion: 1, background: { ...background, src: 'assets/hd-spe/attack-fixture-background.png', width: 64, height: 64,
            logicalWidth: 130, logicalHeight: 64 }, number };
    const composition = { protocolVersion: 1, valid: true, background, clearFrames: bitset(9) };
    const display = { generation: 9, eventId: 5, commitSeq: 3, frameIndex: 12, frameValid: true, visibleFrames: bitset(12), composition };
    const s = { id: 21, kind: 3, generation: 9, eventId: 5, count: entry.count, picmax: entry.picmax, startFrm: 9, endFrm: 17,
        x: 15, y: 16, keyflag: 0, skipEligible: false, resourceLength: length, resourceFingerprint: entry.resourceFingerprint, composition, display };
    const m = { schemaVersion: 1, axScale: 1, libSha256: createHash('sha256').update(lib).digest('hex'), entries: [entry] };
    const first = { digit: 1, x: 55, y: 49, firstY: 56, drawCount: 8 }, second = { digit: 4, x: 61, y: 54, firstY: 56, drawCount: 3 };
    const a = { protocolVersion: 1, active: true, phase: 'numbers', custom: false, sourceValid: true, generation: 9, session: 2,
        actorIndex: 3, targetIndex: 11, hurt: 14, paintSeq: 11, speId: 21, resourceIndex: 0, count: entry.count, picmax: entry.picmax,
        startFrm: 9, endFrm: 17, x: 15, y: 16, resourceLength: length, resourceFingerprint: entry.resourceFingerprint,
        number, digits: [first, second], scene: display,
        display: { ...display, valid: true, session: 2, paintSeq: 11, digits: [first, second] }, skipEligible: false, returnEligible: false };
    return { lib, units, pictures, entry, s, m, a };
}
async function attackLoaded(postlude = false, options = {}) {
    const fixture = attackFixture();
    const h = harness({ data: { g_scale: 1 }, spe: { ...fixture.s, ...(postlude ? { active: 0, id: 0, display: { frameValid: false } } : {}) },
        ...(postlude ? { attack: fixture.a } : {}), ...options });
    h.context.dynLib = fixture.lib.toString('hex'); h.api.setManifest(fixture.m); h.api.start();
    const deadline = Date.now() + 2_000;
    while (!h.images.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    const slots = new Set(fixture.units.slice(fixture.entry.startFrm, fixture.entry.endFrm + 1).map(u => u.picIndex));
    assert.equal(h.images.length, slots.size + 1);
    if (!options.pendingImage) for (let i = 0; i < h.images.length; i++) h.resolveImage(i);
    return { ...h, fixture };
}

// The snapshots below exercise the renderer boundary; they are not gameplay
// or C acceptance. Their complete slot metadata comes from the actual LIB and
// the current declared entries, whose PNG bytes are decoded independently below.
function woodFixture(skillId = 6, current = 0, shown = current) {
    const actual = actualMainFixture(37);
    const production = JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json', import.meta.url), 'utf8'));
    const entry = structuredClone(production.entries.find(e => e.opaqueCoverageVersion === 1 && e.skillId === skillId));
    assert.ok(entry); assert.deepEqual(entry.units, actual.units);
    const composition = frame => ({ protocolVersion: 1, valid: true, mode: skillId === 6 ? 3 : 2,
        x: 48, y: 16, width: frame ? 66 : 64, height: 64, background: null,
        clearFrames: bitset(...Array.from({ length: frame }, (_, i) => i)) });
    const display = { generation: 9, eventId: 5, commitSeq: shown + 1, frameIndex: shown, frameValid: true,
        visibleFrames: bitset(shown), composition: composition(shown) };
    const s = { ...actual.s, kind: 2, generation: 9, eventId: 5, x: 48, y: 16, keyflag: 0, skipEligible: false,
        contextKnown: true, skillId, actorIndex: 2, targetIndex: 10, startFrm: 0, endFrm: skillId === 6 ? 7 : 0,
        frameIndex: current, commitSeq: current + 1, visibleFrames: bitset(current), composition: composition(current), display };
    return { ...actual, entry, s, m: { ...actual.m, entries: [entry] } };
}
function woodNumericFixture(skillId = 6) {
    const f = woodFixture(skillId, skillId === 6 ? 7 : 0);
    const label = { claimed: true, valid: true, x: 55, y: 18, length: 8, text: '兵力减少',
        bytes: [...Buffer.from('b1f8c1a6bcf5c9d9', 'hex'), ...Array(56).fill(0)] };
    const digits = [2, 4, 0].map((digit, i) => ({ digit, x: 55 + i * 6, y: 49, firstY: 56, drawCount: 8 }));
    const scene = { ...structuredClone(f.s.display), session: 2, paintSeq: 10 };
    const result = { protocolVersion: 1, active: true, phase: 'hold', custom: false, sourceValid: true,
        generation: 9, session: 2, skillId, resultKind: 1, actorIndex: 2, targetIndex: 10, value: 240, paintSeq: 10,
        speId: 37, resourceIndex: 0, count: 8, picmax: 2, startFrm: 0, endFrm: skillId === 6 ? 7 : 0,
        x: 48, y: 16, resourceLength: f.entry.resourceLength, resourceFingerprint: f.entry.resourceFingerprint,
        number: { ...f.entry.skillNumber, valid: true }, label, digits, scene,
        display: { ...structuredClone(scene), valid: true, label, digits } };
    return { ...f, result, top: { active: true, valid: true, kind: 2, generation: 9, session: 2 } };
}
async function woodLoaded(options = {}) {
    const f = options.postlude ? woodNumericFixture(options.skillId || 6) : woodFixture(options.skillId || 6, options.current || 0, options.shown ?? options.current ?? 0);
    const h = harness({ data: { g_scale: 1 }, spe: options.postlude ? { active: 0, generation: 9 } : f.s,
        ...(options.postlude ? { skillResult: f.result, resultOwner: f.top } : {}), ...options.harness });
    h.context.dynLib = f.lib.toString('hex'); h.api.setManifest(f.m); h.api.start();
    const deadline = Date.now() + 2_000;
    while (!h.images.length && Date.now() < deadline) await settle();
    assert.equal(h.images.length, options.skillId === 7 ? 1 : 2);
    function resolve(index) {
        const image = h.images[index], picture = f.entry.pictures.find(p => p.src === image.url);
        image.naturalWidth = picture.width; image.naturalHeight = picture.height; image.onload();
    }
    if (!options.pendingImage) h.images.forEach((_, i) => resolve(i));
    return { ...h, fixture: f, resolve };
}
test('wood first actual64 preserves full LCD outside, including the uninitialized right2 columns', async () => {
    const h = await woodLoaded(), s = h.api.debugSnapshot(), scale = 11;
    assert.equal(s.source, 'hd-assets'); assert.equal(s.outsideSource, 'lcd');
    assert.deepEqual({ ...s.sourceRect }, { x: 0, y: 0, width: 160, height: 96 });
    assert.deepEqual({ ...s.hdRegion }, { x: 48, y: 16, width: 64, height: 64 });
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [48 * scale, 16 * scale, 64 * scale, 64 * scale]);
    const paints = h.events.filter(e => e.node === 'hd-spe-canvas');
    assert.ok(paints.some(e => e.operation === 'rect' && JSON.stringify(e.args) === JSON.stringify([48 * scale, 16 * scale, 64 * scale, 64 * scale])));
    assert.ok(paints.some(e => e.operation === 'drawImage' && !(e.args[0] instanceof h.context.Image) && e.args[3] === 640 && e.args[4] === 384));
    assert.equal(paints.filter(e => e.operation === 'fillRect').length, 0, 'no invented background beyond or inside the opaque art');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('wood copied width grows to66, never shrinks on a later64 frame, and keeps native white clear transparent', async () => {
    const h = await woodLoaded();
    for (const frame of [1, 2, 7]) {
        const f = woodFixture(6, frame); h.setSpe(f.s); h.events.length = 0; h.flush();
        assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.equal(h.api.debugSnapshot().hdRegion.width, 66);
        assert.equal(h.hdDraws().at(-1).args[3], (frame % 2 ? 66 : 64) * 11);
        assert.ok(h.events.some(e => e.node === 'hd-spe-canvas' && e.operation === 'clearRect' && e.args[2] === 66 * 11 && e.args[3] === 64 * 11));
        assert.equal(h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'fillRect').length, 0);
        assert.deepEqual([...h.api.debugSnapshot().displayedFrames], [frame]);
    }
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('displayed first64 never borrows the future current66 copy or clear history', async () => {
    const h = await woodLoaded({ current: 1, shown: 0 });
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.equal(h.api.debugSnapshot().hdRegion.width, 64);
    assert.deepEqual([...h.api.debugSnapshot().displayedFrames], [0]);
    assert.equal(h.hdDraws().at(-1).args[3], 64 * 11);
    const bad = structuredClone(h.fixture.s); bad.display.composition.width = 66; h.setSpe(bad); h.api.blit();
    assert.equal(h.api.debugSnapshot().source, 'lcd', 'a changed same-stamp geometry revokes the cached paint');
    assert.deepEqual(h.keys, []);
});
test('falling-stone exact skill7 uses only the actual64 picture while retaining native66 metadata for the unused slot', async () => {
    const h = await woodLoaded({ skillId: 7 });
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.equal(h.images.length, 1);
    assert.equal(h.api.debugSnapshot().hdRegion.width, 64); assert.equal(h.fixture.entry.pictures[1].nativeWidth, 66);
    assert.equal(h.fixture.entry.pictures[1].src, null); assert.equal(h.hdDraws().at(-1).args[3], 64 * 11);
    const bad = structuredClone(h.fixture.s); bad.skillId = 6; h.setSpe(bad); h.flush(); assert.equal(h.api.debugSnapshot().source, 'lcd');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('new opaque marker rejects missing, guessed, custom, cross-mode and malformed geometry or copy owners', async () => {
    const h = await woodLoaded(), original = h.fixture.s;
    for (const mutate of [s => { s.contextKnown = false; }, s => { s.skillId = 7; }, s => { s.actorIndex = 20; },
        s => { s.keyflag = 1; }, s => { s.display.composition.valid = false; }, s => { s.display.composition.mode = 2; },
        s => { s.display.composition.width = 66; }, s => { s.display.composition.height = 62; },
        s => { s.display.composition.clearFrames = bitset(1); }, s => { s.composition = null; },
        s => { s.display.commitSeq = 2; }, s => { s.display.eventId = 6; }, s => { s.display.composition.x = 49; }]) {
        const bad = structuredClone(original); mutate(bad); h.setSpe(bad); h.flush(); assert.equal(h.api.debugSnapshot().source, 'lcd');
    }
    h.setSpe(original);
    for (const mutate of [e => { delete e.opaqueCoverageVersion; }, e => { e.opaqueCoverageVersion = 2; },
        e => { e.units[1].x = 1; }, e => { e.pictures[1].logicalWidth = 64; }, e => { e.skillId = 7; },
        e => { e.compositionVersion = 1; }]) {
        const m = structuredClone(h.fixture.m); mutate(m.entries[0]); h.api.setManifest(m); h.flush(); assert.equal(h.api.debugSnapshot().source, 'lcd');
    }
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('wood numeric hold replays the saved final66 scene then actual GBK label and12wide opaque history at6pixel advances', async () => {
    const h = await woodLoaded({ postlude: true }), s = h.api.debugSnapshot(), scale = 11;
    assert.equal(s.presentation, 'skill-postlude'); assert.equal(s.source, 'hd-assets'); assert.equal(s.spe.active, 0);
    assert.equal(s.hdRegion.width, 66); assert.deepEqual({ ...s.sourceRect }, { x: 0, y: 0, width: 160, height: 96 });
    assert.equal(h.hdDraws().at(-1).args[3], 66 * scale);
    const texts = h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'fillText').slice(-25);
    assert.deepEqual(texts[0].args, ['兵力减少', 55 * scale, 18 * scale, 48 * scale]);
    assert.deepEqual(texts.slice(1).map(e => e.args), [2, 4, 0].flatMap((digit, i) =>
        Array.from({ length: 8 }, (_, j) => [String(digit), (55 + i * 6) * scale, (56 - j) * scale, 6 * scale])));
    assert.ok(h.events.some(e => e.node === 'hd-spe-canvas' && e.operation === 'fillRect' && e.args[2] === 12 * scale && e.args[3] === 16 * scale));
    assert.equal(h.nodes.get('hd-spe-skip').hidden, true); assert.equal(h.nodes.get('hd-spe-return').hidden, true);
    h.key(); h.api.skip(); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('falling-stone numeric hold retains its single64 copied scene and actual digit history without loading the wide slot', async () => {
    const h = await woodLoaded({ postlude: true, skillId: 7 });
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.equal(h.api.debugSnapshot().hdRegion.width, 64);
    assert.equal(h.images.length, 1); assert.deepEqual([...h.api.debugSnapshot().displayedFrames], [0]);
    assert.equal(h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'fillText').slice(-25).length, 25);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('missing wide wood art uses the complete actual LCD in the movie and final66 numeric hold', async () => {
    for (const postlude of [false, true]) {
        const h = await woodLoaded({ pendingImage: true, postlude }); h.resolve(0); h.images[1].onerror(); h.flush();
        assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.api.debugSnapshot().fallbackReason, 'asset-load-failed');
        assert.deepEqual({ ...h.api.debugSnapshot().sourceRect }, { x: 0, y: 0, width: 160, height: 96 });
        assert.deepEqual(h.hdDraws(), []); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    }
});
test('overlapping live wood slots retain the real ascending native order after clear rectangles', async () => {
    const h = await woodLoaded({ current: 1 }), s = structuredClone(h.fixture.s);
    s.visibleFrames = s.display.visibleFrames = bitset(0, 1); h.setSpe(s); h.events.length = 0; h.flush();
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.deepEqual(h.hdDraws().map(e => e.args[0].url), h.fixture.entry.pictures.map(p => p.src));
    assert.deepEqual(h.hdDraws().map(e => e.args[3]), [64 * 11, 66 * 11]);
    const firstImage = h.events.indexOf(h.hdDraws()[0]);
    assert.ok(h.events.slice(0, firstImage).some(e => e.node === 'hd-spe-canvas' && e.operation === 'clearRect' && e.args[2] === 64 * 11));
    assert.deepEqual(h.keys, []);
});
test('wood postlude cannot manufacture final66 from first64, an incomplete last copy, overwritten owner or invalid label/NUM', async () => {
    const h = await woodLoaded({ postlude: true });
    for (const mutate of [r => { r.scene.frameIndex = 0; }, r => { r.display.frameIndex = 0; },
        r => { r.display.composition.width = 64; }, r => { r.display.visibleFrames = bitset(6); },
        r => { r.skillId = 7; }, r => { r.custom = true; }, r => { r.sourceValid = false; },
        r => { r.display.label.x = 100; }, r => { r.number.resourceFingerprint = 'fnv1a32:00000000:327'; },
        r => { r.display.digits[1].x = 61.5; }, r => { r.display.digits[2].drawCount = 9; }]) {
        const bad = structuredClone(h.fixture.result); mutate(bad); h.setSkillResult(bad); h.flush(); assert.equal(h.api.debugSnapshot().source, 'lcd');
    }
    h.setSkillResult(h.fixture.result); h.setResultOwner({ ...h.fixture.top, session: 3 }); h.flush();
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.api.debugSnapshot().presentation, 'result-lcd');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('late wood images follow the fresh displayed64 copy and cannot revive a retired event or classic owner', async () => {
    const h = await woodLoaded({ pendingImage: true, current: 1, shown: 0 });
    assert.equal(h.api.debugSnapshot().source, 'lcd'); h.resolve(0); h.resolve(1);
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); assert.equal(h.api.debugSnapshot().hdRegion.width, 64);
    const pending = await woodLoaded({ pendingImage: true }); pending.setSpe({ active: 0 }); pending.api.onEngineSpe();
    pending.events.length = 0; pending.resolve(0); pending.resolve(1); assert.equal(pending.api.isOpen(), false); assert.deepEqual(pending.hdDraws(), []);
    h.setMode(false); h.events.length = 0; h.flush(); assert.deepEqual(h.hdDraws(), []); assert.equal(h.api.isOpen(), false);
    assert.deepEqual(h.keys, []); assert.deepEqual(pending.keys, []);
});
test('a changed resource or scene during an opaque draw restores the complete real LCD rather than half a new picture', async () => {
    const h = await woodLoaded(), original = structuredClone(h.fixture.s);
    for (const mutation of [() => { h.spe().display.composition.width = 66; }, () => { h.context.dynLib = '00'; }]) {
        h.context.dynLib = h.fixture.lib.toString('hex'); h.setSpe(structuredClone(original)); h.api.onEngineSpe();
        let changed = false; h.setDrawHook((node, op, args) => { if (!changed && node === 'hd-spe-canvas' && op === 'drawImage' && args[0] instanceof h.context.Image) { changed = true; mutation(); } });
        h.events.length = 0; h.flush(); h.setDrawHook(null);
        assert.equal(changed, true); assert.equal(h.api.debugSnapshot().source, 'lcd');
        const last = h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage').at(-1);
        assert.equal(last.args[0] instanceof h.context.Image, false); assert.deepEqual(last.args.slice(1), [0, 0, 640, 384, 0, 0, 1760, 1056]);
    }
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});
test('in-place art metadata changes during a wood draw revoke the decoded resource signature', async () => {
    const h = await woodLoaded(); let changed = false;
    h.setDrawHook((node, op, args) => { if (!changed && node === 'hd-spe-canvas' && op === 'drawImage' && args[0] instanceof h.context.Image) {
        changed = true; h.fixture.entry.pictures[0].src = 'assets/hd-spe/different-slot.png';
    } });
    h.flush(); h.setDrawHook(null); assert.equal(changed, true); assert.equal(h.api.debugSnapshot().source, 'lcd');
    const last = h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage').at(-1);
    assert.equal(last.args[0] instanceof h.context.Image, false); assert.deepEqual(h.keys, []);
});

function skillFixture() {
    const fixture=actualMainFixture(35), entry=fixture.entry;
    entry.kind=2;entry.skillResultVersion=1;entry.skillNumber=attackFixture().entry.number;
    const label={claimed:true,valid:true,x:55,y:18,length:8,text:'兵力减少',bytes:[...Buffer.from('b1f8c1a6bcf5c9d9','hex'),...Array(56).fill(0)]};
    const digit={digit:2,x:55,y:49,firstY:56,drawCount:8};
    const composition={protocolVersion:1,valid:true,mode:2,x:48,y:16,width:65,height:64,background:null,clearFrames:bitset(0,1,2,3,4,5,6)};
    const display={generation:9,session:2,eventId:5,commitSeq:8,frameIndex:7,frameValid:true,valid:true,paintSeq:10,visibleFrames:bitset(7),composition,label,digits:[digit]};
    const result={protocolVersion:1,active:true,phase:'numbers',custom:false,sourceValid:true,generation:9,session:2,skillId:1,resultKind:1,value:240,paintSeq:10,
        speId:35,resourceIndex:0,count:entry.count,picmax:entry.picmax,startFrm:entry.startFrm,endFrm:entry.endFrm,x:48,y:16,
        resourceLength:entry.resourceLength,resourceFingerprint:entry.resourceFingerprint,number:{...entry.skillNumber,valid:true},label,digits:[digit],scene:display,display};
    const top={active:true,valid:true,kind:2,generation:9,session:2};
    return{...fixture,result,top};
}
async function skillLoaded(options={}) {
    const f=skillFixture(),h=harness({data:{g_scale:1},spe:{active:0,generation:9},skillResult:f.result,resultOwner:f.top,...options});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    const deadline=Date.now()+2000;while(!h.images.length&&Date.now()<deadline)await settle();
    assert.equal(h.images.length,2);if(!options.pendingImage)h.images.forEach((_,i)=>h.resolveImage(i));
    return{...h,fixture:f};
}
test('skill postlude draws its authenticated opaque window, actual label then displayed digit history, retaining LCD outside',async()=>{
    const h=await skillLoaded(),s=h.api.debugSnapshot(),scale=14;
    assert.equal(s.presentation,'skill-postlude');assert.equal(s.source,'hd-assets');assert.equal(s.spe.active,0);assert.equal(s.outsideSource,'lcd');assert.equal(s.hdRegion.width,65);
    const drawing=h.events.filter(e=>e.node==='hd-spe-canvas');
    const clip=drawing.findLast(e=>e.operation==='rect'&&e.args[2]===65*scale&&e.args[3]===64*scale);
    assert.deepEqual(clip.args,[33*scale,0,65*scale,64*scale]);
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1),[33*scale,0,65*scale,64*scale]);
    const texts=drawing.filter(e=>e.operation==='fillText').slice(-9);
    assert.deepEqual(texts[0].args,['兵力减少',40*scale,2*scale,48*scale]);
    assert.deepEqual(texts.slice(1).map(e=>e.args),Array.from({length:8},(_,i)=>['2',40*scale,(40-i)*scale,6*scale]));
    assert.equal(h.nodes.get('hd-spe-skip').hidden,true);assert.equal(h.nodes.get('hd-spe-return').hidden,true);h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    const before=h.events.length;h.advance(50000);h.polls.forEach(p=>p());assert.equal(h.events.length,before);
});
test('skill result rejects any unproven movie unit, bounded window, numeric resource or label pose',async()=>{
    const h=await skillLoaded(),f=h.fixture;
    for(const change of [r=>{r.display.composition.width=64;},r=>{r.display.label.x=100;},r=>{r.number.resourceFingerprint='fnv1a32:00000000:327';},r=>{r.display.digits[0].x=110;}]){
        const r=structuredClone(f.result);change(r);h.setSkillResult(r);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');
    }
    h.setSkillResult(f.result);const m=structuredClone(f.m);m.entries[0].units[0].x=1;h.api.setManifest(m);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');assert.deepEqual(h.keys,[]);
});
test('same-kind overwritten parent and different-kind retired parent preserve actual LCD until real native stack ends',async()=>{
    const h=await skillLoaded(),f=h.fixture;
    h.setSkillResult({...f.result,active:false});h.setResultOwner({...f.top,valid:false,session:1});h.flush();
    assert.equal(h.api.debugSnapshot().presentation,'result-lcd');assert.equal(h.api.isOpen(),true);assert.equal(h.api.debugSnapshot().source,'lcd');
    assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:160,height:96});
    h.setSkillResult({...f.result,sourceValid:false});h.setResultOwner(f.top);h.flush();assert.equal(h.api.debugSnapshot().presentation,'skill-postlude');assert.equal(h.api.debugSnapshot().source,'lcd');
    h.setResultOwner({active:false,valid:false,kind:0,generation:0,session:0});h.api.onEngineSpe();assert.equal(h.api.isOpen(),false);assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('skill failed images and retired owners cannot be revived by late decode, hidden pages or resize',async()=>{
    const h=await skillLoaded({pendingImage:true}),f=h.fixture;assert.equal(h.api.debugSnapshot().source,'lcd');
    h.images[0].onerror();h.resolveImage(1);assert.equal(h.api.debugSnapshot().source,'lcd');
    h.setHidden(true);h.events.length=0;h.flush();assert.deepEqual(h.events,[]);h.setHidden(false);assert.equal(h.api.debugSnapshot().source,'lcd');
    h.setScreen(320,192);h.flush();assert.equal(h.api.debugSnapshot().fallbackReason,'screen-size-unsupported');
    h.setResultOwner({...f.top,active:false,kind:0});h.setSkillResult({...f.result,active:false});h.api.blit();assert.equal(h.api.isOpen(),false);assert.deepEqual(h.keys,[]);
});
test('no-movie map result, custom skill and retired sources retain complete real LCD including target-edge numbers',async()=>{
    const h=await skillLoaded(),f=h.fixture;
    for(const change of [r=>{r.sourceValid=false;r.display.composition.mode=0;},r=>{r.sourceValid=false;r.custom=true;},r=>{r.display.valid=false;}]){
        const r=structuredClone(f.result);change(r);h.setSkillResult(r);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:160,height:96});
        const crop=h.events.findLast(e=>e.node==='hd-spe-canvas'&&e.operation==='drawImage'&&!(e.args[0] instanceof h.context.Image));
        assert.deepEqual(crop.args.slice(1,5),[0,0,640,384],'native target coordinates at the LCD edges cannot be cropped out');
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('ordinary attacks compose the actually observed background, cumulative erased boxes, then ascending live units', async () => {
    const h = await attackLoaded(), { entry } = h.fixture;
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual([...h.api.debugSnapshot().displayedFrames], [12]);
    const draws = h.hdDraws(), background = draws.at(-2), foreground = draws.at(-1), scale = 14;
    assert.equal(background.args[0].url, entry.background.src);
    assert.deepEqual(background.args.slice(1), [0, 0, 130 * scale, 64 * scale]);
    const unit = entry.units[9], pic = entry.pictures[unit.picIndex];
    const between = h.events.slice(h.events.indexOf(background) + 1, h.events.indexOf(foreground));
    assert.ok(between.some(e => e.operation === 'fillRect' && JSON.stringify(e.args) === JSON.stringify([unit.x * scale, unit.y * scale, pic.logicalWidth * scale, pic.logicalHeight * scale])), 'native full erase footprint precedes the current live foreground');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('composition requires the displayed background identity and complete in-range clear bytes', async () => {
    const h = await attackLoaded(), original = h.fixture.s;
    for (const bad of [null, { ...original.display.composition, valid: false },
        { ...original.display.composition, clearFrames: bitset(8) },
        { ...original.display.composition, clearFrames: Array(31).fill(0) },
        { ...original.display.composition, clearFrames: [...Array(31).fill(0), '0'] },
        { ...original.display.composition, background: { ...original.display.composition.background, resourceFingerprint: 'fnv1a32:00000000:1095' } }]) {
        h.setSpe({ ...original, display: { ...original.display, composition: bad } }); h.flush();
        assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.api.debugSnapshot().fallbackReason, 'composition-not-matched');
    }
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('direct native damage flushes retain a separate postlude with opaque overlapping pose history and no skip input', async () => {
    const h = await attackLoaded(true), scale = 14;
    assert.equal(h.api.debugSnapshot().presentation, 'attack-postlude'); assert.equal(h.api.debugSnapshot().spe.active, 0);
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.equal(h.nodes.get('hd-spe-skip').hidden, true); assert.equal(h.nodes.get('hd-spe-return').hidden, true);
    const texts = h.events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'fillText').slice(-11);
    assert.deepEqual(texts.map(e => e.args), [...Array.from({ length: 8 }, (_, j) => ['1', 40 * scale, (40 - j) * scale, 6 * scale]),
        ...Array.from({ length: 3 }, (_, j) => ['4', 46 * scale, (40 - j) * scale, 6 * scale])]);
    const paints = h.events.filter(e => e.node === 'hd-spe-canvas').slice(-83);
    assert.ok(paints.some(e => e.operation === 'fillRect' && e.args[0] === 46 * scale && e.args[2] === 12 * scale && e.args[3] === 16 * scale));
    h.api.skip(); h.api.returnToTitle(h.api.debugSnapshot().ownerToken); assert.equal(h.key().prevented, false);
    h.click('[nothing]'); assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
    const draws = h.events.length; h.advance(50_000); h.polls.forEach(poll => poll()); assert.equal(h.events.length, draws, 'clock changes cannot move actual displayed numeric poses');
    h.setAttack({ ...h.fixture.a, active: false, phase: null }); h.api.onEngineSpe(); assert.equal(h.api.isOpen(), false);
});

test('pending, failed, custom or retired postlude sources keep actual LCD while late images cannot revive old owners', async () => {
    const h = await attackLoaded(true, { pendingImage: true });
    assert.equal(h.api.debugSnapshot().source, 'lcd'); assert.equal(h.api.isOpen(), true);
    h.resolveImage(0, false); assert.equal(h.api.debugSnapshot().source, 'lcd');
    h.setAttack({ ...h.fixture.a, sourceValid: false, custom: true }); h.flush();
    assert.equal(h.api.isOpen(), true); assert.equal(h.api.debugSnapshot().source, 'lcd');
    h.setAttack({ ...h.fixture.a, active: false }); h.api.onEngineSpe(); h.events.length = 0;
    for (let i = 1; i < h.images.length; i++) h.resolveImage(i);
    assert.equal(h.api.isOpen(), false); assert.deepEqual(h.hdDraws(), []); assert.deepEqual(h.keys, []);
});

test('six range entries share authenticated bitmap decodes without conflating their displayed native range', async () => {
    const h = await attackLoaded(), originalImages = h.images.length, { entry, s } = h.fixture;
    const second = { ...entry, startFrm: 18, endFrm: 26 };
    h.api.setManifest({ ...h.fixture.m, entries: [entry, second] });
    const countAfterReplacement = h.images.length;
    assert.equal(countAfterReplacement, originalImages * 2, 'manifest generation revokes previous decoded authorization');
    for (let i = originalImages; i < h.images.length; i++) h.resolveImage(i);
    h.setSpe({ ...s, startFrm: 18, endFrm: 26, eventId: 6, display: { ...s.display, eventId: 6,
        visibleFrames: bitset(18), composition: { ...s.display.composition, clearFrames: bitset(18) } } });
    h.flush();
    const oldPictures = new Set(entry.units.slice(entry.startFrm, entry.endFrm + 1).map(u => u.picIndex));
    const newPictures = new Set(second.units.slice(second.startFrm, second.endFrm + 1).map(u => u.picIndex));
    const additional = [...newPictures].filter(index => !oldPictures.has(index)).length;
    assert.equal(h.images.length, countAfterReplacement + additional, 'shared native slots reuse complete matching pixel metadata; only new range slots decode');
    for (let i = countAfterReplacement; i < h.images.length; i++) h.resolveImage(i);
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.deepEqual([...h.api.debugSnapshot().displayedFrames], [18]);
});

test('a completed exact attack range needs all its real native slots but never borrows unfinished out-of-range art', async () => {
    const h = await attackLoaded(), { entry, s } = h.fixture;
    const reachable = new Set(entry.units.slice(entry.startFrm, entry.endFrm + 1).map(unit => unit.picIndex));
    const partial = { ...entry, pictures: entry.pictures.map(pic => reachable.has(pic.picIndex) ? pic : { ...pic, src: null, width: null, height: null }) };
    h.api.setManifest({ ...h.fixture.m, entries: [partial] });
    const begin = h.images.length - reachable.size - 1;
    for (let i = begin; i < h.images.length; i++) h.resolveImage(i);
    assert.equal(h.api.debugSnapshot().source, 'hd-assets');
    assert.equal(h.api.debugSnapshot().cachedImages, reachable.size + 1);
    const missing = { ...partial, pictures: partial.pictures.map(pic => pic.picIndex === entry.units[12].picIndex ? { ...pic, src: null, width: null, height: null } : pic) };
    h.api.setManifest({ ...h.fixture.m, entries: [missing] }); h.flush(); assert.equal(h.api.debugSnapshot().source, 'lcd');
    h.api.setManifest({ ...h.fixture.m, entries: [partial] });
    h.setSpe({ ...s, startFrm: 18, endFrm: 26, display: { ...s.display, visibleFrames: bitset(18) } }); h.flush();
    assert.equal(h.api.debugSnapshot().source, 'lcd', 'the completed 9..17 range never claims its unmanifested neighboring defender range');
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('future native numeric writes do not move the shown value until their own real display stamp is published', async () => {
    const h = await attackLoaded(true), a = h.fixture.a;
    const initialPaints = h.events.filter(e => e.operation === 'fillText').length;
    const nextDigit = { ...a.digits[1], y: 53, drawCount: 4 };
    h.setAttack({ ...a, paintSeq: 12, digits: [a.digits[0], nextDigit] }); h.api.onEngineSpe();
    assert.equal(h.events.filter(e => e.operation === 'fillText').length, initialPaints);
    h.setAttack({ ...a, paintSeq: 12, digits: [a.digits[0], nextDigit], display: { ...a.display, paintSeq: 12, digits: [a.digits[0], nextDigit] } });
    h.flush();
    const poses = h.events.filter(e => e.operation === 'fillText').slice(-12);
    assert.equal(poses.length, 12); assert.deepEqual(poses.at(-1).args, ['4', 46 * 14, 37 * 14, 6 * 14]);
    assert.equal(h.api.debugSnapshot().spe.active, 0); assert.deepEqual(h.keys, []);
});
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

// State-only LIUYAN consumer fixtures. These are offline VM boundaries, not
// successful native casts or captured browser evidence.
function liuyanFixture(current=0,shown=current) {
    const f=actualMainFixture(40),m=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8')),
        entry=m.entries.find(e=>e.speId===40);
    assert.ok(entry);assert.deepEqual(entry.units,f.units);assert.equal(entry.resourceFingerprint,'fnv1a32:bd0140e0:1084');
    const comp=frame=>({protocolVersion:1,valid:true,mode:2,x:48,y:16,width:64,height:64,background:null,
        clearFrames:bitset(...Array.from({length:frame},(_,i)=>i))});
    const display={generation:9,eventId:5,commitSeq:shown+1,frameIndex:shown,frameValid:true,visibleFrames:bitset(shown),composition:comp(shown)};
    const s={...f.s,kind:2,generation:9,eventId:5,x:48,y:16,keyflag:0,skipEligible:false,contextKnown:true,
        skillId:16,actorIndex:2,targetIndex:10,frameIndex:current,frameValid:true,commitSeq:current+1,
        visibleFrames:bitset(current),composition:comp(current),display};
    return {...f,entry,s,m:{...m,entries:[entry]}};
}
async function liuyanLoaded(options={}) {
    const f=liuyanFixture(options.current??0,options.shown??options.current??0),h=harness({data:{g_scale:1},spe:f.s,...options.harness});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
    function resolve(i){const image=h.images[i],p=f.entry.pictures.find(p=>p.src===image.url);image.naturalWidth=p.width;image.naturalHeight=p.height;image.onload();}
    if(!options.pending)h.images.forEach((_,i)=>resolve(i));return {...h,fixture:f,resolve};
}
function liuyanFullLcd(h){assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:160,height:96});}
test('LIUYAN40 all8 actual native slots paint only64square over fullLCD without numeric or input ownership',async()=>{
    const h=await liuyanLoaded();
    for(let frame=0;frame<8;frame++){
        h.setSpe(liuyanFixture(frame).s);h.events.length=0;h.flush();const d=h.api.debugSnapshot();
        assert.equal(d.source,'hd-assets');liuyanFullLcd(h);assert.deepEqual({...d.hdRegion},{x:48,y:16,width:64,height:64});
        assert.deepEqual([...d.displayedFrames],[frame]);const draw=h.hdDraws().at(-1);
        assert.equal(draw.args[0].url,'assets/hd-spe/liuyan-40/picture-'+frame%2+'.png');assert.deepEqual(draw.args.slice(1),[528,176,704,704]);
        assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&['fillRect','fillText'].includes(e.operation)).length,0);
    }
    assert.equal(h.nodes.get('hd-spe-skip').hidden,true);assert.equal(h.nodes.get('hd-spe-return').hidden,true);
    h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('LIUYAN40 lagging displayed copy cannot borrow future frame or clears',async()=>{
    const h=await liuyanLoaded({current:3,shown:0});assert.equal(h.api.debugSnapshot().source,'hd-assets');
    assert.equal(h.hdDraws().at(-1).args[0].url,'assets/hd-spe/liuyan-40/picture-0.png');
    for(const change of[s=>s.display.composition.clearFrames=bitset(1),s=>s.display.visibleFrames=bitset(1),
        s=>s.display.commitSeq=5,s=>s.composition.clearFrames=bitset(4)]){
        const s=structuredClone(h.fixture.s);change(s);h.setSpe(s);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');liuyanFullLcd(h);
    }
});
test('LIUYAN40 rejects wrong identity, context, geometry, copy and unknown coverage',async()=>{
    const h=await liuyanLoaded(),original=h.fixture.s;
    for(const change of[s=>s.contextKnown=false,s=>s.skillId=17,s=>s.actorIndex=-1,s=>s.actorIndex=20,s=>s.targetIndex=20,
        s=>s.keyflag=1,s=>s.skipEligible=true,s=>s.protocolValid=false,s=>s.composition.valid=false,s=>s.display.composition.valid=false,
        s=>s.composition.mode=3,s=>s.display.composition.mode=3,s=>s.display.composition.x=49,s=>s.composition.width=66,
        s=>s.display.composition.background={valid:true},s=>s.display.eventId=6,s=>s.display.generation=10,
        s=>s.display.commitSeq=0,s=>s.display.frameIndex=1,s=>s.display.visibleFrames=bitset(1),
        s=>{s.visibleFrames=bitset();s.composition.clearFrames=bitset();},s=>{s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset();}]){
        const s=structuredClone(original);change(s);h.setSpe(s);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');liuyanFullLcd(h);
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('LIUYAN40 missing or malformed marker and unknownLIB use fullLCD rather than generic arena',async()=>{
    const h=await liuyanLoaded();
    for(const change of[e=>delete e.liuyanVersion,e=>e.liuyanVersion=2,e=>delete e.opaqueCoverageVersion,e=>e.skillId=17,
        e=>e.skillIds=[16],e=>e.aidVersion=1,e=>e.skillResultVersion=1,e=>e.skillNumber={},e=>e.background={},
        e=>e.pictures[1].mask=1,e=>e.units[3].x=1,e=>e.units[5].picIndex=0,e=>e.resourceFingerprint='fnv1a32:00000000:1084']){
        const m=structuredClone(h.fixture.m);change(m.entries[0]);h.api.setManifest(m);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');liuyanFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
    h.context.dynLib='00';h.api.setManifest(h.fixture.m);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');liuyanFullLcd(h);
});
test('LIUYAN40 fabricated numeric postlude cannot acquire its state-only artwork',async()=>{
    const f=liuyanFixture(7),fake=skillFixture(),result={...fake.result,skillId:16,speId:40,resourceLength:1084,
        resourceFingerprint:f.entry.resourceFingerprint,count:8,picmax:2,startFrm:0,endFrm:7};
    const h=harness({data:{g_scale:1},spe:{active:0,generation:9},skillResult:result,resultOwner:fake.top});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();h.flush();
    assert.equal(h.api.debugSnapshot().source,'lcd');liuyanFullLcd(h);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);
});
test('LIUYAN40 failed image and late image after native end cannot replace actualLCD',async()=>{
    const missing=await liuyanLoaded({pending:true});missing.resolve(1);missing.images[0].onerror();missing.events.length=0;missing.flush();
    assert.equal(missing.api.debugSnapshot().source,'lcd');liuyanFullLcd(missing);assert.deepEqual(missing.hdDraws(),[]);
    const retired=await liuyanLoaded({pending:true});retired.setSpe({active:0});retired.api.onEngineSpe();retired.events.length=0;
    retired.resolve(0);retired.resolve(1);assert.equal(retired.api.isOpen(),false);assert.deepEqual(retired.hdDraws(),[]);
});
test('LIUYAN40 classic, hidden and report revoke the movie; unsupported screen has no HD crop',async()=>{
    for(const retire of[h=>h.setMode(false),h=>h.setHidden(true),h=>h.setReport(1)]){
        const h=await liuyanLoaded();h.events.length=0;retire(h);h.flush();assert.equal(h.api.isOpen(),false);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);
    }
    const h=await liuyanLoaded();h.events.length=0;h.setScreen(200,96);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');
    assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:200,height:96});assert.deepEqual(h.hdDraws(),[]);
});
test('LIUYAN40 mid-draw owner or resource change restores completeLCD',async()=>{
    for(const retire of[h=>h.spe().display.eventId++,h=>h.context.dynLib='00']){
        const h=await liuyanLoaded();let changed=false;
        h.setDrawHook((node,op,args)=>{if(!changed&&node==='hd-spe-canvas'&&op==='drawImage'&&args[0]instanceof h.context.Image){changed=true;retire(h);}});
        h.events.length=0;h.flush();h.setDrawHook(null);assert.equal(changed,true);assert.equal(h.api.debugSnapshot().source,'lcd');
        const last=h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='drawImage').at(-1);
        assert.equal(last.args[0]instanceof h.context.Image,false);assert.deepEqual(last.args.slice(1),[0,0,640,384,0,0,1760,1056]);assert.deepEqual(h.keys,[]);
    }
});
test('LIUYAN40 authentic battle prewarm loads both state-only slots before a native movie begins',async()=>{
    const f=liuyanFixture(),h=harness({data:{g_scale:1},spe:{active:0},fightActive:true});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);assert.equal(h.api.isOpen(),false);
    h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});
    h.setSpe(f.s);h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');assert.equal(h.images.length,2);
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    const bad=structuredClone(f.m);delete bad.entries[0].liuyanVersion;
    const rejected=harness({data:{g_scale:1},spe:{active:0},fightActive:true});rejected.context.dynLib=f.lib.toString('hex');rejected.api.setManifest(bad);rejected.api.start();
    for(let i=0;i<60;i++)await settle();assert.equal(rejected.images.length,0);assert.equal(rejected.api.isOpen(),false);
});
test('LIUYAN40 copied clear-only state removes the bounded window without replaying old art',async()=>{
    const h=await liuyanLoaded({current:3}),s=structuredClone(h.fixture.s);
    s.visibleFrames=bitset();s.composition.clearFrames=bitset(0,1,2,3);
    s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset(0,1,2,3);
    h.setSpe(s);h.events.length=0;h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');liuyanFullLcd(h);
    assert.deepEqual([...h.api.debugSnapshot().displayedFrames],[]);assert.deepEqual(h.hdDraws(),[]);
    assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='fillRect').length,0);assert.deepEqual(h.keys,[]);
});
test('LIUYAN40 controlled rawABI feeds the unchanged public getter into the real consumer',async()=>{
    const seed=aidRawScenarios().find(s=>!s.numeric).rawGlobals;
    for(const [current,shown]of[...Array.from({length:8},(_,f)=>[f,f]),[3,0]]){
        const f=liuyanFixture(current,shown),raw=structuredClone(seed);
        Object.assign(raw,{g_hdSpeId:40,g_hdSpeSkillId:16,g_hdSpeResourceFingerprint:0xbd0140e0,g_hdSpeResourceLength:1084,
            g_hdSpeFrameIndex:current,g_hdSpeCommitSeq:current+1,g_hdSpeDisplayFrameIndex:shown,g_hdSpeDisplayCommitSeq:shown+1});
        for(const [p,frame]of[['g_hdSpe',current],['g_hdSpeDisplay',shown]])Object.assign(raw,{[p+'SceneMode']:2,[p+'SceneWidth']:64,
            [p+'VisibleFrames']:bitset(frame),[p+'ClearFrames']:bitset(...Array.from({length:frame},(_,i)=>i))});
        const actual=readAidPublic(raw);assert.equal(actual.publicSpe.display.composition.valid,true);
        const h=harness({data:{g_scale:1},spe:actual.publicSpe,skillResult:actual.publicSkillResult,resultOwner:actual.publicResultOwner});
        h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
        for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
        h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});h.flush();
        assert.equal(h.api.debugSnapshot().source,'hd-assets');liuyanFullLcd(h);assert.deepEqual([...h.api.debugSnapshot().displayedFrames],[shown]);
        assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    }
});
test('LIUYAN40 selected originals and no-NUM source spec match actual LIB slots',()=>{
    const f=liuyanFixture(),spec=JSON.parse(readFileSync(new URL('../scripts/specs/hd-spe-liuyan.json',import.meta.url),'utf8'));
    assert.deepEqual([f.entry.speId,f.entry.skillId,f.entry.liuyanVersion,f.entry.opaqueCoverageVersion],[40,16,1,1]);
    for(const field of['skillResultVersion','skillNumber','number','background'])assert.equal(f.entry[field],undefined);
    f.entry.pictures.forEach((p,i)=>{const b=readFileSync(new URL('../'+p.src,import.meta.url)),d=decodePng(b);checkPictureAlpha(d,0);
        assert.deepEqual([d.width,d.height],[p.width,p.height]);assert.equal(createHash('sha256').update(b).digest('hex'),spec.pictureSha256[i]);});
    assert.deepEqual(spec.pictureSources,f.entry.pictures.map(p=>p.src));
});

// State-only ZHOUFENG consumer fixtures. These are offline VM boundaries, not
// successful native casts or captured browser evidence.
function zhoufengFixture(current=0,shown=current) {
    const f=actualMainFixture(39),m=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8')),
        entry=m.entries.find(e=>e.zhoufengVersion===1),legacy=m.entries.find(e=>e.speId===39&&e.zhoufengVersion==null&&e.dingshenVersion==null);
    assert.ok(entry);assert.deepEqual(entry.units,f.units);assert.equal(entry.resourceFingerprint,'fnv1a32:6b0ebc5a:1084');
    const comp=frame=>({protocolVersion:1,valid:true,mode:2,x:48,y:16,width:64,height:64,background:null,
        clearFrames:bitset(...Array.from({length:frame},(_,i)=>i))});
    const display={generation:9,eventId:5,commitSeq:shown+1,frameIndex:shown,frameValid:true,visibleFrames:bitset(shown),composition:comp(shown)};
    const s={...f.s,kind:2,generation:9,eventId:5,x:48,y:16,keyflag:0,skipEligible:false,contextKnown:true,
        skillId:14,actorIndex:2,targetIndex:10,frameIndex:current,frameValid:true,commitSeq:current+1,
        visibleFrames:bitset(current),composition:comp(current),display};
    return {...f,entry,legacy,s,m:{...m,entries:[legacy,entry]}};
}
async function zhoufengLoaded(options={}) {
    const f=zhoufengFixture(options.current??0,options.shown??options.current??0),h=harness({data:{g_scale:1},spe:f.s,...options.harness});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
    function resolve(i){const image=h.images[i],p=f.entry.pictures.find(p=>p.src===image.url);image.naturalWidth=p.width;image.naturalHeight=p.height;image.onload();}
    if(!options.pending)h.images.forEach((_,i)=>resolve(i));return {...h,fixture:f,resolve};
}
function zhoufengFullLcd(h){assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:160,height:96});}
test('ZHOUFENG14/39 all8 actual native slots paint only64square over fullLCD without numeric or input ownership',async()=>{
    const h=await zhoufengLoaded();
    for(let frame=0;frame<8;frame++){
        h.setSpe(zhoufengFixture(frame).s);h.events.length=0;h.flush();const d=h.api.debugSnapshot();
        assert.equal(d.source,'hd-assets');zhoufengFullLcd(h);assert.deepEqual({...d.hdRegion},{x:48,y:16,width:64,height:64});
        assert.deepEqual([...d.displayedFrames],[frame]);const draw=h.hdDraws().at(-1);
        assert.equal(draw.args[0].url,'assets/hd-spe/qimen-39/picture-'+frame%2+'.png');assert.deepEqual(draw.args.slice(1),[528,176,704,704]);
        assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&['fillRect','fillText'].includes(e.operation)).length,0);
    }
    assert.equal(h.nodes.get('hd-spe-skip').hidden,true);assert.equal(h.nodes.get('hd-spe-return').hidden,true);
    h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('ZHOUFENG14/39 lagging displayed copy cannot borrow future frame or clears',async()=>{
    const h=await zhoufengLoaded({current:3,shown:0});assert.equal(h.api.debugSnapshot().source,'hd-assets');
    assert.equal(h.hdDraws().at(-1).args[0].url,'assets/hd-spe/qimen-39/picture-0.png');
    for(const change of[s=>s.display.composition.clearFrames=bitset(1),s=>s.display.visibleFrames=bitset(1),
        s=>s.display.commitSeq=5,s=>s.composition.clearFrames=bitset(4)]){
        const s=structuredClone(h.fixture.s);change(s);h.setSpe(s);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);
    }
});
test('ZHOUFENG14/39 rejects wrong identity, context, geometry, copy and unknown coverage',async()=>{
    const h=await zhoufengLoaded(),original=h.fixture.s;
    for(const change of[s=>s.contextKnown=false,s=>s.skillId=17,s=>s.actorIndex=-1,s=>s.actorIndex=20,s=>s.targetIndex=20,
        s=>s.keyflag=1,s=>s.skipEligible=true,s=>s.protocolValid=false,s=>s.composition.valid=false,s=>s.display.composition.valid=false,
        s=>s.composition.mode=3,s=>s.display.composition.mode=3,s=>s.display.composition.x=49,s=>s.composition.width=66,
        s=>s.display.composition.background={valid:true},s=>s.display.eventId=6,s=>s.display.generation=10,
        s=>s.display.commitSeq=0,s=>s.display.frameIndex=1,s=>s.display.visibleFrames=bitset(1),
        s=>{s.visibleFrames=bitset();s.composition.clearFrames=bitset();},s=>{s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset();}]){
        const s=structuredClone(original);change(s);h.setSpe(s);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('ZHOUFENG14/39 missing or malformed marker and unknownLIB use fullLCD rather than generic arena',async()=>{
    const h=await zhoufengLoaded();
    for(const change of[e=>delete e.zhoufengVersion,e=>e.zhoufengVersion=2,e=>delete e.opaqueCoverageVersion,e=>e.skillId=17,
        e=>e.skillIds=[16],e=>e.aidVersion=1,e=>e.skillResultVersion=1,e=>e.skillNumber={},e=>e.background={},
        e=>e.pictures[1].mask=1,e=>e.units[3].x=1,e=>e.units[5].picIndex=0,e=>e.resourceFingerprint='fnv1a32:00000000:1084']){
        const m=structuredClone(h.fixture.m);change(m.entries[1]);h.api.setManifest(m);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
    h.context.dynLib='00';h.api.setManifest(h.fixture.m);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);
});
test('ZHOUFENG14/39 fabricated numeric postlude cannot acquire its state-only artwork',async()=>{
    const f=zhoufengFixture(7),fake=skillFixture(),result={...fake.result,skillId:14,speId:39,resourceLength:1084,
        resourceFingerprint:f.entry.resourceFingerprint,count:8,picmax:2,startFrm:0,endFrm:7};
    const h=harness({data:{g_scale:1},spe:{active:0,generation:9},skillResult:result,resultOwner:fake.top});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();h.flush();
    assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);
});
test('ZHOUFENG14/39 failed image and late image after native end cannot replace actualLCD',async()=>{
    const missing=await zhoufengLoaded({pending:true});missing.resolve(1);missing.images[0].onerror();missing.events.length=0;missing.flush();
    assert.equal(missing.api.debugSnapshot().source,'lcd');zhoufengFullLcd(missing);assert.deepEqual(missing.hdDraws(),[]);
    const retired=await zhoufengLoaded({pending:true});retired.setSpe({active:0});retired.api.onEngineSpe();retired.events.length=0;
    retired.resolve(0);retired.resolve(1);assert.equal(retired.api.isOpen(),false);assert.deepEqual(retired.hdDraws(),[]);
});
test('ZHOUFENG14/39 classic, hidden and report revoke the movie; unsupported screen has no HD crop',async()=>{
    for(const retire of[h=>h.setMode(false),h=>h.setHidden(true),h=>h.setReport(1)]){
        const h=await zhoufengLoaded();h.events.length=0;retire(h);h.flush();assert.equal(h.api.isOpen(),false);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);
    }
    const h=await zhoufengLoaded();h.events.length=0;h.setScreen(200,96);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');
    assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:200,height:96});assert.deepEqual(h.hdDraws(),[]);
});
test('ZHOUFENG14/39 mid-draw owner or resource change restores completeLCD',async()=>{
    for(const retire of[h=>h.spe().display.eventId++,h=>h.context.dynLib='00']){
        const h=await zhoufengLoaded();let changed=false;
        h.setDrawHook((node,op,args)=>{if(!changed&&node==='hd-spe-canvas'&&op==='drawImage'&&args[0]instanceof h.context.Image){changed=true;retire(h);}});
        h.events.length=0;h.flush();h.setDrawHook(null);assert.equal(changed,true);assert.equal(h.api.debugSnapshot().source,'lcd');
        const last=h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='drawImage').at(-1);
        assert.equal(last.args[0]instanceof h.context.Image,false);assert.deepEqual(last.args.slice(1),[0,0,640,384,0,0,1760,1056]);assert.deepEqual(h.keys,[]);
    }
});
test('ZHOUFENG14/39 authentic battle prewarm loads both state-only slots before a native movie begins',async()=>{
    const f=zhoufengFixture(),h=harness({data:{g_scale:1},spe:{active:0},fightActive:true});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);assert.equal(h.api.isOpen(),false);
    h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});
    h.setSpe(f.s);h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');assert.equal(h.images.length,2);
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    const bad=structuredClone(f.m);delete bad.entries[1].zhoufengVersion;bad.entries=[bad.entries[1]]; // Isolate invalid14; old20 still legitimately prewarms shared art.
    const rejected=harness({data:{g_scale:1},spe:{active:0},fightActive:true});rejected.context.dynLib=f.lib.toString('hex');rejected.api.setManifest(bad);rejected.api.start();
    for(let i=0;i<60;i++)await settle();assert.equal(rejected.images.length,0);assert.equal(rejected.api.isOpen(),false);
});
test('ZHOUFENG14/39 copied clear-only state removes the bounded window without replaying old art',async()=>{
    const h=await zhoufengLoaded({current:3}),s=structuredClone(h.fixture.s);
    s.visibleFrames=bitset();s.composition.clearFrames=bitset(0,1,2,3);
    s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset(0,1,2,3);
    h.setSpe(s);h.events.length=0;h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(h);
    assert.deepEqual([...h.api.debugSnapshot().displayedFrames],[]);assert.deepEqual(h.hdDraws(),[]);
    assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='fillRect').length,0);assert.deepEqual(h.keys,[]);
});
test('ZHOUFENG14/39 controlled rawABI feeds the unchanged public getter into the real consumer',async()=>{
    const seed=aidRawScenarios().find(s=>!s.numeric).rawGlobals;
    for(const [current,shown]of[...Array.from({length:8},(_,f)=>[f,f]),[3,0]]){
        const f=zhoufengFixture(current,shown),raw=structuredClone(seed);
        Object.assign(raw,{g_hdSpeId:39,g_hdSpeSkillId:14,g_hdSpeResourceFingerprint:0x6b0ebc5a,g_hdSpeResourceLength:1084,
            g_hdSpeFrameIndex:current,g_hdSpeCommitSeq:current+1,g_hdSpeDisplayFrameIndex:shown,g_hdSpeDisplayCommitSeq:shown+1});
        for(const [p,frame]of[['g_hdSpe',current],['g_hdSpeDisplay',shown]])Object.assign(raw,{[p+'SceneMode']:2,[p+'SceneWidth']:64,
            [p+'VisibleFrames']:bitset(frame),[p+'ClearFrames']:bitset(...Array.from({length:frame},(_,i)=>i))});
        const actual=readAidPublic(raw);assert.equal(actual.publicSpe.display.composition.valid,true);
        const h=harness({data:{g_scale:1},spe:actual.publicSpe,skillResult:actual.publicSkillResult,resultOwner:actual.publicResultOwner});
        h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
        for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
        h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});h.flush();
        assert.equal(h.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(h);assert.deepEqual([...h.api.debugSnapshot().displayedFrames],[shown]);
        assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    }
});
test('ZHOUFENG14/39 selected originals and no-NUM source spec match actual LIB slots',()=>{
    const f=zhoufengFixture(),spec=JSON.parse(readFileSync(new URL('../scripts/specs/hd-spe-zhoufeng.json',import.meta.url),'utf8'));
    assert.deepEqual([f.entry.speId,f.entry.skillId,f.entry.zhoufengVersion,f.entry.opaqueCoverageVersion],[39,14,1,1]);
    for(const field of['skillResultVersion','skillNumber','number','background'])assert.equal(f.entry[field],undefined);
    f.entry.pictures.forEach((p,i)=>{const b=readFileSync(new URL('../'+p.src,import.meta.url)),d=decodePng(b);checkPictureAlpha(d,0);
        assert.deepEqual([d.width,d.height],[p.width,p.height]);assert.equal(createHash('sha256').update(b).digest('hex'),spec.pictureSha256[i]);});
    assert.deepEqual(spec.pictureSources,f.entry.pictures.map(p=>p.src));
});

test('ZHOUFENG14 explicit context wins over shared39 first-match and20 independently preserves fullLCD',async()=>{
    const h=await zhoufengLoaded();assert.equal(h.fixture.m.entries[0].zhoufengVersion,undefined);
    h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(h);
    const reverse=structuredClone(h.fixture.m);reverse.entries.reverse();h.api.setManifest(reverse);
    for(let i=0;i<60;i++)await settle();
    h.images.forEach(image=>{if(image.naturalWidth!==1254){image.naturalWidth=1254;image.naturalHeight=1254;image.onload();}});
    h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(h);
    const s=structuredClone(h.fixture.s);s.skillId=20;s.targetIndex=3;h.setSpe(s);h.flush();
    assert.equal(h.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(h);
    for(const change of[s=>s.skillId=15,s=>s.contextKnown=false,s=>s.skillId=undefined]){
        const unknown=structuredClone(h.fixture.s);change(unknown);h.setSpe(unknown);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});

test('QIMEN20 fabricated numeric postlude cannot reuse the old arena',async()=>{
    const f=zhoufengFixture(7),n=woodNumericFixture(6),label=n.result.label,digits=n.result.digits;
    const scene={...structuredClone(f.s.display),session:n.result.session,paintSeq:n.result.paintSeq};
    const result={...n.result,skillId:20,speId:39,resourceFingerprint:f.entry.resourceFingerprint,resourceLength:f.entry.resourceLength,
        x:48,y:16,number:{...f.legacy.skillNumber,valid:true},scene,display:{...structuredClone(scene),valid:true,label,digits}};
    const h=harness({data:{g_scale:1},spe:{active:0,generation:9},skillResult:result,resultOwner:n.top});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    for(let i=0;i<60;i++)await settle();
    h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});h.flush();
    assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});

// Independent DINGSHEN15 consumer cases: controlled ABI/DOM inputs only, not
// evidence of a successful native cast or an actual browser movie.
function dingshenFixture(current=0,shown=current) {
    const f=zhoufengFixture(current,shown),m=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8')),
        entry=m.entries.find(e=>e.dingshenVersion===1),curse=m.entries.find(e=>e.zhoufengVersion===1);
    assert.ok(entry);assert.ok(curse);assert.deepEqual(entry.units,f.units);
    assert.equal(entry.resourceFingerprint,'fnv1a32:6b0ebc5a:1084');
    return {...f,entry,curse,s:{...f.s,skillId:15},m:{...m,entries:[f.legacy,curse,entry]}};
}
async function dingshenLoaded(options={}) {
    const f=dingshenFixture(options.current??0,options.shown??options.current??0),h=harness({data:{g_scale:1},spe:f.s,...options.harness});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
    function resolve(i){const image=h.images[i],p=f.entry.pictures.find(p=>p.src===image.url);image.naturalWidth=p.width;image.naturalHeight=p.height;image.onload();}
    if(!options.pending)h.images.forEach((_,i)=>resolve(i));return {...h,fixture:f,resolve};
}
test('DINGSHEN15/39 eight native slots use the fullLCD bounded square without NUM, HOLD or input',async()=>{
    const h=await dingshenLoaded();
    for(let frame=0;frame<8;frame++){
        h.setSpe(dingshenFixture(frame).s);h.events.length=0;h.flush();const d=h.api.debugSnapshot();
        assert.equal(d.source,'hd-assets');zhoufengFullLcd(h);assert.deepEqual({...d.hdRegion},{x:48,y:16,width:64,height:64});
        assert.deepEqual([...d.displayedFrames],[frame]);const draw=h.hdDraws().at(-1);
        assert.equal(draw.args[0].url,'assets/hd-spe/qimen-39/picture-'+frame%2+'.png');assert.deepEqual(draw.args.slice(1),[528,176,704,704]);
        assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&['fillRect','fillText'].includes(e.operation)).length,0);
    }
    assert.equal(h.nodes.get('hd-spe-skip').hidden,true);assert.equal(h.nodes.get('hd-spe-return').hidden,true);
    h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('DINGSHEN15/39 copied ticket cannot borrow a future frontier or unrelated owner',async()=>{
    const h=await dingshenLoaded({current:3,shown:0});assert.equal(h.api.debugSnapshot().source,'hd-assets');
    assert.equal(h.hdDraws().at(-1).args[0].url,'assets/hd-spe/qimen-39/picture-0.png');
    for(const change of[s=>s.display.composition.clearFrames=bitset(1),s=>s.display.visibleFrames=bitset(1),
        s=>s.display.commitSeq=5,s=>s.display.frameIndex=4,s=>s.composition.clearFrames=bitset(4),
        s=>s.display.eventId++,s=>s.display.generation++,s=>s.display.composition.valid=false,
        s=>{s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset();}]){
        const s=structuredClone(h.fixture.s);change(s);h.setSpe(s);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('DINGSHEN15/39 rejects unknown context, wrong geometry, frames and payload identity',async()=>{
    const h=await dingshenLoaded();
    for(const change of[s=>s.contextKnown=false,s=>s.skillId=16,s=>s.actorIndex=20,s=>s.targetIndex=-1,
        s=>s.keyflag=1,s=>s.skipEligible=true,s=>s.protocolValid=false,s=>s.composition.valid=false,
        s=>s.composition.mode=3,s=>s.display.composition.mode=3,s=>s.display.composition.x=49,s=>s.composition.width=66,
        s=>s.resourceFingerprint='fnv1a32:00000000:1084',s=>s.resourceLength=1085,s=>s.resourceIndex=1,
        s=>s.startFrm=1,s=>s.endFrm=6,s=>s.count=7,s=>s.picmax=3,
        s=>{s.visibleFrames=bitset();s.composition.clearFrames=bitset();}]){
        const s=structuredClone(h.fixture.s);change(s);h.setSpe(s);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
});
test('DINGSHEN15/39 absent or corrupt marker cannot fall through to14 or old20 arena',async()=>{
    const h=await dingshenLoaded();
    for(const change of[e=>delete e.dingshenVersion,e=>e.dingshenVersion=2,e=>delete e.opaqueCoverageVersion,
        e=>e.opaqueCoverageVersion=2,e=>e.skillId=14,e=>e.skillId=20,e=>e.skillIds=[14,15,20],
        e=>e.zhoufengVersion=1,e=>e.liuyanVersion=1,e=>e.aidVersion=1,e=>e.skillResultVersion=1,
        e=>e.skillNumber={},e=>e.number={},e=>e.background={},e=>e.pictures[1].mask=1,
        e=>e.units[3].x=1,e=>e.units[5].picIndex=0,e=>e.resourceFingerprint='fnv1a32:00000000:1084']){
        const m=structuredClone(h.fixture.m);change(m.entries[2]);h.api.setManifest(m);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
    const m=structuredClone(h.fixture.m);m.entries=m.entries.slice(0,2);h.api.setManifest(m);h.events.length=0;h.flush();
    assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    h.context.dynLib='00';h.api.setManifest(h.fixture.m);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);
});
test('DINGSHEN15/39 precise dispatch is order-independent and preserves14 and20 rendering boundaries',async()=>{
    const h=await dingshenLoaded(),base=h.fixture.m.entries;
    for(const order of[[0,1,2],[2,0,1],[1,2,0]]){
        h.api.setManifest({...h.fixture.m,entries:order.map(i=>structuredClone(base[i]))});
        for(let i=0;i<60;i++)await settle();
        h.images.forEach(image=>{if(image.naturalWidth!==1254){image.naturalWidth=1254;image.naturalHeight=1254;image.onload();}});
        for(const skillId of[15,14,20]){
            h.setSpe({...structuredClone(h.fixture.s),skillId,targetIndex:skillId===20?3:10});h.events.length=0;h.flush();
            assert.equal(h.api.debugSnapshot().source,'hd-assets');
            assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:160,height:96});
        }
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('DINGSHEN15/39 fabricated NUM or HOLD cannot acquire state-only artwork',async()=>{
    for(const phase of['numbers','hold']){
        const f=dingshenFixture(7),fake=skillFixture(),result={...fake.result,phase,skillId:15,speId:39,resourceLength:1084,
            resourceFingerprint:f.entry.resourceFingerprint,count:8,picmax:2,startFrm:0,endFrm:7};
        const h=harness({data:{g_scale:1},spe:{active:0,generation:9},skillResult:result,resultOwner:fake.top});
        h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);
    }
});
test('DINGSHEN15/39 classic, missing and retired images leave native pixels without new keys',async()=>{
    const missing=await dingshenLoaded({pending:true});missing.resolve(1);missing.images[0].onerror();missing.events.length=0;missing.flush();
    assert.equal(missing.api.debugSnapshot().source,'lcd');zhoufengFullLcd(missing);assert.deepEqual(missing.hdDraws(),[]);
    const retired=await dingshenLoaded({pending:true});retired.setSpe({active:0});retired.api.onEngineSpe();retired.events.length=0;
    retired.resolve(0);retired.resolve(1);assert.equal(retired.api.isOpen(),false);assert.deepEqual(retired.hdDraws(),[]);
    for(const retire of[h=>h.setMode(false),h=>h.setHidden(true),h=>h.setReport(1)]){
        const h=await dingshenLoaded();h.events.length=0;retire(h);h.flush();
        assert.equal(h.api.isOpen(),false);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    }
});
test('DINGSHEN15/39 final paint fence restores LCD after a same-resource switch to14 or report',async()=>{
    for(const retire of[h=>h.spe().skillId=14,h=>h.spe().display.eventId++,h=>h.setReport(1),h=>h.context.dynLib='00']){
        const h=await dingshenLoaded();let changed=false;
        h.setDrawHook((node,op,args)=>{if(!changed&&node==='hd-spe-canvas'&&op==='drawImage'&&args[0]instanceof h.context.Image){changed=true;retire(h);}});
        h.events.length=0;h.flush();h.setDrawHook(null);assert.equal(changed,true);assert.equal(h.api.debugSnapshot().source,'lcd');
        const last=h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='drawImage').at(-1);
        assert.equal(last.args[0]instanceof h.context.Image,false);assert.deepEqual(last.args.slice(1),[0,0,640,384,0,0,1760,1056]);assert.deepEqual(h.keys,[]);
    }
});
test('DINGSHEN15/39 prewarm authenticates its marker before native movie and clear-only copy replays no art',async()=>{
    const f=dingshenFixture(),h=harness({data:{g_scale:1},spe:{active:0},fightActive:true});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest({...f.m,entries:[f.entry]});h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);assert.equal(h.api.isOpen(),false);
    h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});
    h.setSpe(f.s);h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');
    const bad=structuredClone(f.entry);delete bad.dingshenVersion;
    const rejected=harness({data:{g_scale:1},spe:{active:0},fightActive:true});rejected.context.dynLib=f.lib.toString('hex');rejected.api.setManifest({...f.m,entries:[bad]});rejected.api.start();
    for(let i=0;i<60;i++)await settle();assert.equal(rejected.images.length,0);assert.equal(rejected.api.isOpen(),false);
    const c=await dingshenLoaded({current:3}),s=structuredClone(c.fixture.s);
    s.visibleFrames=bitset();s.composition.clearFrames=bitset(0,1,2,3);s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset(0,1,2,3);
    c.setSpe(s);c.events.length=0;c.flush();assert.equal(c.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(c);
    assert.deepEqual([...c.api.debugSnapshot().displayedFrames],[]);assert.deepEqual(c.hdDraws(),[]);assert.deepEqual(c.keys,[]);
});
test('DINGSHEN15/39 actual rawABI public getter drives all8 slots and lagging copy in the production consumer',async()=>{
    const seed=aidRawScenarios().find(s=>!s.numeric).rawGlobals;
    for(const [current,shown]of[...Array.from({length:8},(_,f)=>[f,f]),[3,0]]){
        const f=dingshenFixture(current,shown),raw=structuredClone(seed);
        Object.assign(raw,{g_hdSpeId:39,g_hdSpeSkillId:15,g_hdSpeResourceFingerprint:0x6b0ebc5a,g_hdSpeResourceLength:1084,
            g_hdSpeFrameIndex:current,g_hdSpeCommitSeq:current+1,g_hdSpeDisplayFrameIndex:shown,g_hdSpeDisplayCommitSeq:shown+1});
        for(const [p,frame]of[['g_hdSpe',current],['g_hdSpeDisplay',shown]])Object.assign(raw,{[p+'SceneMode']:2,[p+'SceneWidth']:64,
            [p+'VisibleFrames']:bitset(frame),[p+'ClearFrames']:bitset(...Array.from({length:frame},(_,i)=>i))});
        // The real no-NUM movie still has the transient SKILL result owner.
        Object.assign(raw,{g_hdResultOwnerKind:2,g_hdResultOwnerValid:1,g_hdResultOwnerGeneration:7,g_hdResultOwnerSession:11,
            g_hdSkillResultProtocolVersion:1,g_hdSkillResultActive:1,g_hdSkillResultPhase:1,g_hdSkillResultCustom:0,
            g_hdSkillResultSourceValid:1,g_hdSkillResultGeneration:7,g_hdSkillResultSession:11,g_hdSkillResultSkillId:15,
            g_hdSkillResultResultKind:1,g_hdSkillResultActorIndex:2,g_hdSkillResultTargetIndex:10,g_hdSkillResultValue:0,
            g_hdSkillResultEventId:31,g_hdSkillResultCommitSeq:shown+1,g_hdSkillResultFrameIndex:shown,
            g_hdSkillResultId:39,g_hdSkillResultResourceIndex:0,g_hdSkillResultCount:8,g_hdSkillResultPicmax:2,
            g_hdSkillResultStartFrm:0,g_hdSkillResultEndFrm:7,g_hdSkillResultOriginX:48,g_hdSkillResultOriginY:16,
            g_hdSkillResultResourceFingerprint:0x6b0ebc5a,g_hdSkillResultResourceLength:1084,
            g_hdSkillResultSceneMode:2,g_hdSkillResultSceneX:48,g_hdSkillResultSceneY:16,g_hdSkillResultSceneWidth:64,g_hdSkillResultSceneHeight:64,
            g_hdSkillResultVisibleFrames:bitset(shown),g_hdSkillResultClearFrames:bitset(...Array.from({length:shown},(_,i)=>i))});
        const actual=readAidPublic(raw);assert.equal(actual.publicSpe.skillId,15);assert.equal(actual.publicSpe.display.composition.valid,true);
        assert.equal(actual.publicSkillResult.active,true);assert.equal(actual.publicSkillResult.phase,'movie');
        assert.equal(actual.publicSkillResult.value,0);assert.equal(actual.publicResultOwner.kind,2);assert.equal(actual.publicResultOwner.valid,true);
        assert.deepEqual([actual.publicSkillResult.scene.generation,actual.publicSkillResult.scene.eventId,actual.publicSkillResult.scene.commitSeq,actual.publicSkillResult.scene.frameIndex],
            [actual.publicSpe.display.generation,actual.publicSpe.display.eventId,actual.publicSpe.display.commitSeq,actual.publicSpe.display.frameIndex]);
        const h=harness({data:{g_scale:1},spe:actual.publicSpe,skillResult:actual.publicSkillResult,resultOwner:actual.publicResultOwner});
        h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
        for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
        h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});h.flush();
        assert.equal(h.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(h);assert.deepEqual([...h.api.debugSnapshot().displayedFrames],[shown]);
        assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    }
});
test('DINGSHEN15/39 independent source spec reuses exact original art without numeric metadata',()=>{
    const f=dingshenFixture(),spec=JSON.parse(readFileSync(new URL('../scripts/specs/hd-spe-dingshen.json',import.meta.url),'utf8')),
        curse=JSON.parse(readFileSync(new URL('../scripts/specs/hd-spe-zhoufeng.json',import.meta.url),'utf8'));
    assert.deepEqual([f.entry.speId,f.entry.skillId,f.entry.dingshenVersion,f.entry.opaqueCoverageVersion],[39,15,1,1]);
    assert.deepEqual([spec.speId,spec.skillId,spec.dingshenVersion,spec.opaqueCoverageVersion],[39,15,1,1]);
    for(const field of['zhoufengVersion','liuyanVersion','aidVersion','skillIds','skillResultVersion','skillNumber','number','background'])assert.equal(f.entry[field],undefined);
    assert.deepEqual(spec.pictureSources,f.entry.pictures.map(p=>p.src));assert.deepEqual(spec.pictureSources,curse.pictureSources);
    assert.deepEqual(spec.pictureSha256,curse.pictureSha256);
    f.entry.pictures.forEach((p,i)=>assert.equal(createHash('sha256').update(readFileSync(new URL('../'+p.src,import.meta.url))).digest('hex'),spec.pictureSha256[i]));
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
        const used = new Set(entry.units.slice(entry.startFrm, entry.endFrm + 1).map(u => u.picIndex));
        for (let i = 0; i < entry.picmax; i++) {
            const picture = entry.pictures.find(p => p.picIndex === i);
            assert.ok(picture, 'every native picture index has complete slot metadata');
            const width = resource.readUInt16LE(offset), height = resource.readUInt16LE(offset + 2), mask = resource[offset + 6];
            assert.equal(picture.nativeWidth, width); assert.equal(picture.nativeHeight, height); assert.equal(picture.mask, mask);
            assert.equal(picture.logicalWidth, width / m.axScale); assert.equal(picture.logicalHeight, height / m.axScale);
            if ((entry.aiTargetVersion === 2 || entry.statusVersion === 1) && used.has(i)) {
                assert.equal(entry.kind, 4); assert.equal(entry.speId, 27); assert.equal(entry.resourceIndex, 0);
                if (entry.aiTargetVersion === 2) {
                    assert.deepEqual([entry.startFrm, entry.endFrm, entry.count, entry.picmax], [12, 17, 18, 9]);
                } else {
                    assert.equal(entry.statusVersion, 1);
                    assert.deepEqual([entry.startFrm, entry.endFrm, entry.count, entry.picmax],
                        entry.statusReason === 1 ? [0, 5, 18, 9] : [6, 11, 18, 9]);
                    assert.ok(entry.statusReason === 1 || entry.statusReason === 2);
                    assert.deepEqual(entry.units.slice(entry.startFrm, entry.endFrm + 1).map(unit => unit.picIndex),
                        entry.statusReason === 1 ? [2, 3, 4, 1, 0, 1] : [2, 3, 4, 6, 5, 6]);
                }
                assert.equal(entry.maskSemantics, 'native-and-or-v1');
                assert.deepEqual([width, height, mask], [16, 16, 1]);
                const white = Array(32).fill(0), plane = Math.ceil(width / 8) * height;
                for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                    const byte = y * Math.ceil(width / 8) + (x >> 3), bit = 128 >> (x & 7), pixel = y * width + x;
                    if (!(resource[offset + 7 + byte] & bit) && !(resource[offset + 7 + plane + byte] & bit)) white[pixel >> 3] |= 1 << (pixel & 7);
                }
                assert.deepEqual(picture.nativeWhitePixels, white, 'native AND0/OR0 differs from transparent AND1/OR0');
                const whiteCount = white.reduce((count, byte) => count + [...byte.toString(2)].filter(v => v === '1').length, 0);
                if (entry.aiTargetVersion === 2) {
                    assert.equal(whiteCount, 7); assert.ok(i === 7 || i === 8);
                } else {
                    assert.equal(whiteCount, [71, 78, 99, 99, 97, 22, 14][i]);
                    assert.ok(i >= 0 && i <= 6);
                }
            }
            offset += 7 + Math.ceil(width / 8) * height * (mask + 1);
            assert.ok(offset <= resource.length, 'native packed-seven-byte picture slot remains in payload');
            if (picture.src === null) {
                assert.ok(entry.compositionVersion === 1 || entry.aiTargetVersion === 2 || entry.statusVersion === 1 ||
                    entry.opaqueCoverageVersion === 1 && entry.skillId === 7 && entry.speId === 37 && entry.kind === 2 &&
                    entry.startFrm === 0 && entry.endFrm === 0 && i === 1,
                    'only a declared exact native range may leave unreachable artwork pending');
                assert.equal(used.has(i), false, 'every native unit in the actual called range has complete HD artwork');
                assert.equal(picture.width, null); assert.equal(picture.height, null);
                continue;
            }
            if (!decodedImages.has(picture.src)) {
                const decoded = decodePng(readFileSync(new URL('../' + picture.src, import.meta.url)));
                const { pixels, ...summary } = decoded; decodedImages.set(picture.src, summary);
            }
            const decoded = decodedImages.get(picture.src);
            assert.equal(decoded.width, picture.width); assert.equal(decoded.height, picture.height);
            checkPictureAlpha(decoded, mask);
        }
        if (entry.compositionVersion === 1) {
            for (const [source, id] of [[entry.background, 16], [entry.number, 15]]) {
                assert.ok(source); assert.equal(source.id, id); assert.equal(source.resourceIndex, 0); assert.equal(source.pictureIndex, 0);
                const at = lib.readUInt32LE((id - 1) * 4), length = lib.readUInt32LE(at + 8), payload = lib.subarray(at + 14, at + 14 + length);
                let hash = 2166136261; for (const byte of payload) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
                assert.equal(source.resourceLength, length); assert.equal(source.resourceFingerprint, `fnv1a32:${hash.toString(16).padStart(8, '0')}:${length}`);
                assert.equal(source.nativeWidth, payload.readUInt16LE(0)); assert.equal(source.nativeHeight, payload.readUInt16LE(2));
                assert.equal(source.count, payload.readUInt16LE(4)); assert.equal(source.mask, payload[6]);
                assert.deepEqual([source.x, source.y], id === 16 ? [15, 16] : [0, 0]);
                if (id === 16) {
                    if (!decodedImages.has(source.src)) {
                        const { pixels, ...summary } = decodePng(readFileSync(new URL('../' + source.src, import.meta.url))); decodedImages.set(source.src, summary);
                    }
                    const decoded = decodedImages.get(source.src);
                    assert.equal(decoded.width, source.width); assert.equal(decoded.height, source.height); checkPictureAlpha(decoded, 0);
                    assert.equal(source.logicalWidth, source.nativeWidth / m.axScale); assert.equal(source.logicalHeight, source.nativeHeight / m.axScale);
                }
            }
        }
    }
});

// Independent QIMEN20 candidate consumer cases; static only, not gameplay acceptance.
function qimenFixture(current=0,shown=current) {
    const f=zhoufengFixture(current,shown),m=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8')),
        entry=m.entries.find(e=>e.qimenVersion===1),curse=m.entries.find(e=>e.zhoufengVersion===1),immobilization=m.entries.find(e=>e.dingshenVersion===1);
    assert.ok(entry);assert.ok(curse);assert.ok(immobilization);assert.deepEqual(entry.units,f.units);
    assert.equal(entry.resourceFingerprint,'fnv1a32:6b0ebc5a:1084');
    return {...f,entry,curse,s:{...f.s,skillId:20,targetIndex:3},m:{...m,entries:[curse,immobilization,entry]}};
}
async function qimenLoaded(options={}) {
    const f=qimenFixture(options.current??0,options.shown??options.current??0),h=harness({data:{g_scale:1},spe:f.s,...options.harness});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
    function resolve(i){const image=h.images[i],p=f.entry.pictures.find(p=>p.src===image.url);image.naturalWidth=p.width;image.naturalHeight=p.height;image.onload();}
    if(!options.pending)h.images.forEach((_,i)=>resolve(i));return {...h,fixture:f,resolve};
}
test('QIMEN20/39 eight native slots use the fullLCD bounded square without NUM, HOLD or input',async()=>{
    const h=await qimenLoaded();
    for(let frame=0;frame<8;frame++){
        h.setSpe(qimenFixture(frame).s);h.events.length=0;h.flush();const d=h.api.debugSnapshot();
        assert.equal(d.source,'hd-assets');zhoufengFullLcd(h);assert.deepEqual({...d.hdRegion},{x:48,y:16,width:64,height:64});
        assert.deepEqual([...d.displayedFrames],[frame]);const draw=h.hdDraws().at(-1);
        assert.equal(draw.args[0].url,'assets/hd-spe/qimen-39/picture-'+frame%2+'.png');assert.deepEqual(draw.args.slice(1),[528,176,704,704]);
        assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&['fillRect','fillText'].includes(e.operation)).length,0);
    }
    assert.equal(h.nodes.get('hd-spe-skip').hidden,true);assert.equal(h.nodes.get('hd-spe-return').hidden,true);
    h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('QIMEN20/39 copied ticket cannot borrow a future frontier or unrelated owner',async()=>{
    const h=await qimenLoaded({current:3,shown:0});assert.equal(h.api.debugSnapshot().source,'hd-assets');
    assert.equal(h.hdDraws().at(-1).args[0].url,'assets/hd-spe/qimen-39/picture-0.png');
    for(const change of[s=>s.display.composition.clearFrames=bitset(1),s=>s.display.visibleFrames=bitset(1),
        s=>s.display.commitSeq=5,s=>s.display.frameIndex=4,s=>s.composition.clearFrames=bitset(4),
        s=>s.display.eventId++,s=>s.display.generation++,s=>s.display.composition.valid=false,
        s=>{s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset();}]){
        const s=structuredClone(h.fixture.s);change(s);h.setSpe(s);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('QIMEN20/39 rejects unknown context, wrong geometry, frames and payload identity',async()=>{
    const h=await qimenLoaded();
    for(const change of[s=>s.contextKnown=false,s=>s.skillId=16,s=>s.actorIndex=20,s=>s.targetIndex=-1,
        s=>s.keyflag=1,s=>s.skipEligible=true,s=>s.protocolValid=false,s=>s.composition.valid=false,
        s=>s.composition.mode=3,s=>s.display.composition.mode=3,s=>s.display.composition.x=49,s=>s.composition.width=66,
        s=>s.resourceFingerprint='fnv1a32:00000000:1084',s=>s.resourceLength=1085,s=>s.resourceIndex=1,
        s=>s.startFrm=1,s=>s.endFrm=6,s=>s.count=7,s=>s.picmax=3,
        s=>{s.visibleFrames=bitset();s.composition.clearFrames=bitset();}]){
        const s=structuredClone(h.fixture.s);change(s);h.setSpe(s);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
});
test('QIMEN20/39 absent or corrupt marker cannot fall through to14 or old20 arena',async()=>{
    const h=await qimenLoaded();
    for(const change of[e=>delete e.qimenVersion,e=>e.qimenVersion=2,e=>delete e.opaqueCoverageVersion,
        e=>e.opaqueCoverageVersion=2,e=>e.skillId=14,e=>e.skillId=15,e=>e.skillIds=[14,15,20],
        e=>e.zhoufengVersion=1,e=>e.dingshenVersion=1,e=>e.liuyanVersion=1,e=>e.aidVersion=1,e=>e.skillResultVersion=1,
        e=>e.skillNumber={},e=>e.number={},e=>e.background={},e=>e.pictures[1].mask=1,
        e=>e.units[3].x=1,e=>e.units[5].picIndex=0,e=>e.resourceFingerprint='fnv1a32:00000000:1084']){
        const m=structuredClone(h.fixture.m);change(m.entries[2]);h.api.setManifest(m);h.events.length=0;h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    }
    const m=structuredClone(h.fixture.m);m.entries=m.entries.slice(0,2);h.api.setManifest(m);h.events.length=0;h.flush();
    assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);
    h.context.dynLib='00';h.api.setManifest(h.fixture.m);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);
});
test('QIMEN20/39 precise dispatch is order-independent and preserves14 and20 rendering boundaries',async()=>{
    const h=await qimenLoaded(),base=h.fixture.m.entries;
    for(const order of[[0,1,2],[2,0,1],[1,2,0]]){
        h.api.setManifest({...h.fixture.m,entries:order.map(i=>structuredClone(base[i]))});
        for(let i=0;i<60;i++)await settle();
        h.images.forEach(image=>{if(image.naturalWidth!==1254){image.naturalWidth=1254;image.naturalHeight=1254;image.onload();}});
        for(const skillId of[15,14,20]){
            h.setSpe({...structuredClone(h.fixture.s),skillId});h.events.length=0;h.flush();
            assert.equal(h.api.debugSnapshot().source,'hd-assets');
            assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:160,height:96});
        }
    }
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('QIMEN20/39 fabricated NUM or HOLD cannot acquire state-only artwork',async()=>{
    for(const phase of['numbers','hold']){
        const f=qimenFixture(7),fake=skillFixture(),result={...fake.result,phase,skillId:20,speId:39,resourceLength:1084,
            resourceFingerprint:f.entry.resourceFingerprint,count:8,picmax:2,startFrm:0,endFrm:7};
        const h=harness({data:{g_scale:1},spe:{active:0,generation:9},skillResult:result,resultOwner:fake.top});
        h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();h.flush();
        assert.equal(h.api.debugSnapshot().source,'lcd');zhoufengFullLcd(h);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);
    }
});
test('QIMEN20/39 classic, missing and retired images leave native pixels without new keys',async()=>{
    const missing=await qimenLoaded({pending:true});missing.resolve(1);missing.images[0].onerror();missing.events.length=0;missing.flush();
    assert.equal(missing.api.debugSnapshot().source,'lcd');zhoufengFullLcd(missing);assert.deepEqual(missing.hdDraws(),[]);
    const retired=await qimenLoaded({pending:true});retired.setSpe({active:0});retired.api.onEngineSpe();retired.events.length=0;
    retired.resolve(0);retired.resolve(1);assert.equal(retired.api.isOpen(),false);assert.deepEqual(retired.hdDraws(),[]);
    for(const retire of[h=>h.setMode(false),h=>h.setHidden(true),h=>h.setReport(1)]){
        const h=await qimenLoaded();h.events.length=0;retire(h);h.flush();
        assert.equal(h.api.isOpen(),false);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    }
});
test('QIMEN20/39 final paint fence restores LCD after a same-resource switch to14 or report',async()=>{
    for(const retire of[h=>h.spe().skillId=14,h=>h.spe().display.eventId++,h=>h.setReport(1),h=>h.context.dynLib='00']){
        const h=await qimenLoaded();let changed=false;
        h.setDrawHook((node,op,args)=>{if(!changed&&node==='hd-spe-canvas'&&op==='drawImage'&&args[0]instanceof h.context.Image){changed=true;retire(h);}});
        h.events.length=0;h.flush();h.setDrawHook(null);assert.equal(changed,true);assert.equal(h.api.debugSnapshot().source,'lcd');
        const last=h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='drawImage').at(-1);
        assert.equal(last.args[0]instanceof h.context.Image,false);assert.deepEqual(last.args.slice(1),[0,0,640,384,0,0,1760,1056]);assert.deepEqual(h.keys,[]);
    }
});
test('QIMEN20/39 prewarm authenticates its marker before native movie and clear-only copy replays no art',async()=>{
    const f=qimenFixture(),h=harness({data:{g_scale:1},spe:{active:0},fightActive:true});
    h.context.dynLib=f.lib.toString('hex');h.api.setManifest({...f.m,entries:[f.entry]});h.api.start();
    for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);assert.equal(h.api.isOpen(),false);
    h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});
    h.setSpe(f.s);h.flush();assert.equal(h.api.debugSnapshot().source,'hd-assets');
    const bad=structuredClone(f.entry);delete bad.qimenVersion;
    const rejected=harness({data:{g_scale:1},spe:{active:0},fightActive:true});rejected.context.dynLib=f.lib.toString('hex');rejected.api.setManifest({...f.m,entries:[bad]});rejected.api.start();
    for(let i=0;i<60;i++)await settle();assert.equal(rejected.images.length,0);assert.equal(rejected.api.isOpen(),false);
    const c=await qimenLoaded({current:3}),s=structuredClone(c.fixture.s);
    s.visibleFrames=bitset();s.composition.clearFrames=bitset(0,1,2,3);s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset(0,1,2,3);
    c.setSpe(s);c.events.length=0;c.flush();assert.equal(c.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(c);
    assert.deepEqual([...c.api.debugSnapshot().displayedFrames],[]);assert.deepEqual(c.hdDraws(),[]);assert.deepEqual(c.keys,[]);
});
test('QIMEN20/39 actual rawABI public getter drives all8 slots and lagging copy in the production consumer',async()=>{
    const seed=aidRawScenarios().find(s=>!s.numeric).rawGlobals;
    for(const [current,shown]of[...Array.from({length:8},(_,f)=>[f,f]),[3,0]]){
        const f=qimenFixture(current,shown),raw=structuredClone(seed);
        Object.assign(raw,{g_hdSpeId:39,g_hdSpeSkillId:20,g_hdSpeTargetIndex:3,g_hdSpeResourceFingerprint:0x6b0ebc5a,g_hdSpeResourceLength:1084,
            g_hdSpeFrameIndex:current,g_hdSpeCommitSeq:current+1,g_hdSpeDisplayFrameIndex:shown,g_hdSpeDisplayCommitSeq:shown+1});
        for(const [p,frame]of[['g_hdSpe',current],['g_hdSpeDisplay',shown]])Object.assign(raw,{[p+'SceneMode']:2,[p+'SceneWidth']:64,
            [p+'VisibleFrames']:bitset(frame),[p+'ClearFrames']:bitset(...Array.from({length:frame},(_,i)=>i))});
        // The real no-NUM movie still has the transient SKILL result owner.
        Object.assign(raw,{g_hdResultOwnerKind:2,g_hdResultOwnerValid:1,g_hdResultOwnerGeneration:7,g_hdResultOwnerSession:11,
            g_hdSkillResultProtocolVersion:1,g_hdSkillResultActive:1,g_hdSkillResultPhase:1,g_hdSkillResultCustom:0,
            g_hdSkillResultSourceValid:1,g_hdSkillResultGeneration:7,g_hdSkillResultSession:11,g_hdSkillResultSkillId:20,
            g_hdSkillResultResultKind:2,g_hdSkillResultActorIndex:2,g_hdSkillResultTargetIndex:3,g_hdSkillResultValue:0,
            g_hdSkillResultEventId:31,g_hdSkillResultCommitSeq:shown+1,g_hdSkillResultFrameIndex:shown,
            g_hdSkillResultId:39,g_hdSkillResultResourceIndex:0,g_hdSkillResultCount:8,g_hdSkillResultPicmax:2,
            g_hdSkillResultStartFrm:0,g_hdSkillResultEndFrm:7,g_hdSkillResultOriginX:48,g_hdSkillResultOriginY:16,
            g_hdSkillResultResourceFingerprint:0x6b0ebc5a,g_hdSkillResultResourceLength:1084,
            g_hdSkillResultSceneMode:2,g_hdSkillResultSceneX:48,g_hdSkillResultSceneY:16,g_hdSkillResultSceneWidth:64,g_hdSkillResultSceneHeight:64,
            g_hdSkillResultVisibleFrames:bitset(shown),g_hdSkillResultClearFrames:bitset(...Array.from({length:shown},(_,i)=>i))});
        const actual=readAidPublic(raw);assert.equal(actual.publicSpe.skillId,20);assert.equal(actual.publicSpe.display.composition.valid,true);
        assert.equal(actual.publicSkillResult.active,true);assert.equal(actual.publicSkillResult.phase,'movie');
        assert.equal(actual.publicSkillResult.value,0);assert.equal(actual.publicResultOwner.kind,2);assert.equal(actual.publicResultOwner.valid,true);
        assert.deepEqual([actual.publicSkillResult.scene.generation,actual.publicSkillResult.scene.eventId,actual.publicSkillResult.scene.commitSeq,actual.publicSkillResult.scene.frameIndex],
            [actual.publicSpe.display.generation,actual.publicSpe.display.eventId,actual.publicSpe.display.commitSeq,actual.publicSpe.display.frameIndex]);
        const h=harness({data:{g_scale:1},spe:actual.publicSpe,skillResult:actual.publicSkillResult,resultOwner:actual.publicResultOwner});
        h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
        for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
        h.images.forEach(image=>{image.naturalWidth=1254;image.naturalHeight=1254;image.onload();});h.flush();
        assert.equal(h.api.debugSnapshot().source,'hd-assets');zhoufengFullLcd(h);assert.deepEqual([...h.api.debugSnapshot().displayedFrames],[shown]);
        assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
    }
});
test('QIMEN20/39 independent source spec reuses exact original art without numeric metadata',()=>{
    const f=qimenFixture(),spec=JSON.parse(readFileSync(new URL('../scripts/specs/hd-spe-qimen20.json',import.meta.url),'utf8')),
        curse=JSON.parse(readFileSync(new URL('../scripts/specs/hd-spe-zhoufeng.json',import.meta.url),'utf8'));
    assert.deepEqual([f.entry.speId,f.entry.skillId,f.entry.qimenVersion,f.entry.opaqueCoverageVersion],[39,20,1,1]);
    assert.deepEqual([spec.speId,spec.skillId,spec.qimenVersion,spec.opaqueCoverageVersion],[39,20,1,1]);
    for(const field of['zhoufengVersion','dingshenVersion','liuyanVersion','aidVersion','skillIds','skillResultVersion','skillNumber','number','background'])assert.equal(f.entry[field],undefined);
    assert.deepEqual(spec.pictureSources,f.entry.pictures.map(p=>p.src));assert.deepEqual(spec.pictureSources,curse.pictureSources);
    assert.deepEqual(spec.pictureSha256,curse.pictureSha256);
    f.entry.pictures.forEach((p,i)=>assert.equal(createHash('sha256').update(readFileSync(new URL('../'+p.src,import.meta.url))).digest('hex'),spec.pictureSha256[i]));
});
