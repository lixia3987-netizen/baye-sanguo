import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

const source = readFileSync(new URL('../js/hd-spe.js', import.meta.url), 'utf8');
const identitySource = readFileSync(new URL('../js/hd-lib-identity.js', import.meta.url), 'utf8');
const bytes = Buffer.from('01020304', 'hex');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const settle = () => new Promise(resolve => setImmediate(resolve));
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
function harness(options = {}) {
    let spe = nativeSpe(options.spe), hidden = false, report = { active: 0 }, openingHd = true, battleHd = true;
    const events = [], images = [], keys = [], nativeWrites = [], listeners = new Map(), polls = [], nodes = new Map();
    function node(id, canvas = false) {
        const attrs = {}, classes = new Set(), handlers = {};
        const ctx = new Proxy({}, { get(target, key) {
            if (key in target) return target[key];
            return (...args) => events.push({ node: id, operation: key, args, smoothing: target.imageSmoothingEnabled });
        }, set(target, key, value) { target[key] = value; return true; } });
        const n = { id, width: canvas ? 640 : 0, height: canvas ? 384 : 0, style: {}, hidden: false, disabled: false,
            classList: { toggle(name, active) { active ? classes.add(name) : classes.delete(name); } },
            setAttribute(key, value) { attrs[key] = value; }, getAttribute: key => attrs[key],
            addEventListener(name, fn) { (handlers[name] ||= []).push(fn); }, handlers,
            getContext: () => ctx, getBoundingClientRect: () => ({ width: 128, height: 48 }) };
        nodes.set(id, n); return n;
    }
    ['hd-spe', 'hd-spe-skip', 'hd-spe-title', 'hd-spe-probe'].forEach(id => node(id));
    node('lcd', true); node('hd-spe-canvas', true);
    const document = { get hidden() { return hidden; }, documentElement: node('html'), getElementById: id => nodes.get(id),
        createElement: () => node('scratch-' + nodes.size, true),
        addEventListener(name, fn) { (listeners.get(name) || listeners.set(name, []).get(name)).push(fn); } };
    class Image {
        set src(value) { this.url = value; images.push(this); }
    }
    const nativeData = { g_scale: 2, g_screenWidth: 160, g_screenHeight: 96, ...options.data };
    const data = new Proxy(nativeData, { set(target, key, value) { nativeWrites.push([key, value]); return true; } });
    const context = vm.createContext({ console, document, Image, Uint8Array,
        crypto: options.crypto === undefined ? webcrypto : options.crypto,
        Promise: class { constructor() { throw new Error('do not wrap native promises in legacy window.Promise'); } },
        dynLib: bytes.toString('hex'), baye: { data, hd: { ready: () => true, spe: () => spe, report: () => report } },
        localStorage: { getItem: () => null, setItem() { throw new Error('mode API should own preference'); } },
        BayeHdSystemUi: { shouldShowHd: () => openingHd, setMode: mode => { openingHd = mode !== 'classic'; } },
        BayeHdBattle: { shouldShowHd: () => battleHd, setMode: mode => { battleHd = mode !== 'classic'; } },
        sendKey: key => keys.push(key), setInterval: fn => { polls.push(fn); return polls.length; },
        ...(options.fetch ? { fetch: options.fetch } : {}) });
    context.window = context;
    vm.runInContext(identitySource, context, { filename: 'js/hd-lib-identity.js' });
    vm.runInContext(source, context, { filename: 'js/hd-spe.js' });
    const api = context.BayeHdSpe;
    function event(extra = {}) { return { key: 'Enter', keyCode: 13, target: {}, prevented: false,
        preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...extra }; }
    return { api, context, events, images, keys, nativeWrites, listeners, polls, nodes,
        spe: () => spe, setSpe: value => { spe = nativeSpe(value); },
        setHidden(value) { hidden = value; for (const fn of listeners.get('visibilitychange') || []) fn(); },
        setReport(value) { report.active = value; api.onEngineSpe(); },
        setMode(value) { openingHd = battleHd = value; api.onEngineSpe(); },
        key(extra) { const e = event(extra); for (const fn of listeners.get('keydown') || []) fn(e); return e; },
        click(selector) { const e = event({ target: { closest: value => value === selector ? {} : null } });
            for (const fn of nodes.get('hd-spe').handlers.click || []) fn(e); return e; },
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
    assert.equal(h.api.debugSnapshot().flushKey, '1:2:9'); assert.equal(h.api.debugSnapshot().source, 'lcd');
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
    assert.equal(h.api.debugSnapshot().flushKey, '1:3:5'); assert.equal(h.api.debugSnapshot().source, 'lcd');
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
    for (let i = 0; i < 100 && h.images.length < entry.picmax; i++) await settle();
    assert.equal(h.images.length, entry.picmax);
    for (let i = 0; i < entry.picmax; i++) {
        h.images[i].naturalWidth = entry.pictures[i].width; h.images[i].naturalHeight = entry.pictures[i].height;
        h.images[i].onload();
    }
    assert.equal(h.api.debugSnapshot().source, 'hd-assets'); h.events.length = 0; h.flush();
    const lcd = h.events.find(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage' && e.args.length === 9);
    assert.deepEqual(lcd.args.slice(1, 5), [60, 64, 520, 256], '640×384 real LCD crop represents native centered 15,16,130,64');
    const scale = h.api.debugSnapshot().scale;
    assert.deepEqual(h.hdDraws().at(-1).args.slice(1), [33 * scale, 0, 65 * scale, 64 * scale]);
    assert.deepEqual(h.keys, []); assert.deepEqual(h.nativeWrites, []);
});

test('production SPE manifest authenticates actual LIB payload, complete native unit/picture slots and opaque PNG resources', () => {
    const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    const m = JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json', import.meta.url), 'utf8'));
    assert.equal(m.schemaVersion, 1); assert.equal(m.axScale, 1);
    assert.equal(m.libSha256, createHash('sha256').update(lib).digest('hex'));
    assert.ok(m.entries.length > 0);
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
            const png = readFileSync(new URL('../' + picture.src, import.meta.url));
            assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
            assert.equal(png.readUInt32BE(16), picture.width); assert.equal(png.readUInt32BE(20), picture.height);
            assert.equal(png[24], 8); assert.equal(png[25], 2, 'full-stage replacements use opaque RGB art');
            assert.equal(png[28], 0, 'fixture checks the complete noninterlaced PNG image data');
            const chunks = [];
            for (let at = 8; at + 12 <= png.length;) {
                const length = png.readUInt32BE(at), kind = png.toString('ascii', at + 4, at + 8);
                assert.ok(at + length + 12 <= png.length);
                if (kind === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + length));
                at += length + 12;
            }
            const decoded = inflateSync(Buffer.concat(chunks));
            assert.equal(decoded.length, (picture.width * 3 + 1) * picture.height);
            for (let y = 0; y < picture.height; y++) assert.ok(decoded[y * (picture.width * 3 + 1)] <= 4);
        }
    }
});
