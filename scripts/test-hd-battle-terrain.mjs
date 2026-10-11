import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../js/hd-battle-terrain.js', import.meta.url), 'utf8');
const identitySource = readFileSync(new URL('../js/hd-lib-identity.js', import.meta.url), 'utf8');
const nativeHeader = readFileSync(new URL('../vendor/iBaye/src/baye/fight.h', import.meta.url), 'utf8');
const nativeSource = readFileSync(new URL('../vendor/iBaye/src/FightSub.c', import.meta.url), 'utf8');
const constants = Object.fromEntries([...nativeHeader.matchAll(/^#define\s+(TER(?:N|RAIN)_[A-Z]+)\s+(\d+)/gm)]
    .map(([, name, value]) => [name, Number(value)]));
const nativeBody = nativeSource.match(/FAR U8 FgtGetTerrain\(U8 x,U8 y\)\s*\{([\s\S]*?)\n\}/)?.[1];
assert.ok(nativeBody, 'production terrain classifier exists');
assert.match(nativeBody, /offset\s*=\s*g_MapWid\s*\*\s*y\s*\+\s*x/, 'native tiles use full-map row stride');
// Execute the actual native decision tree with its production constants. The
// oracle deliberately does not import or duplicate the renderer's category table.
const decisions = nativeBody.slice(nativeBody.indexOf('if(idx'))
    .replace(/\b(?:TERN|TERRAIN)_[A-Z]+\b/g, name => {
        assert.ok(name in constants, 'native constant is present: ' + name);
        return String(constants[name]);
    });
const nativeTerrain = new Function('idx', decisions);
const labels = ['草地', '平原', '山地', '森林', '村庄', '城池', '营寨', '河流'];
const dictionaryBytes = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
const dictionaryHex = dictionaryBytes.toString('hex');
const dictionarySha256 = createHash('sha256').update(dictionaryBytes).digest('hex');
const hashBuffer = bytes => Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer;
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness({ offscreen = true } = {}) {
    const nativeWrites = [], offscreenCalls = [], composites = [], canvasObjects = [];
    const document = { hidden: false };
    const context = vm.createContext({ document, console,
        baye: new Proxy({}, { set(target, key, value) { nativeWrites.push([key, value]); return true; } }),
        sendKey() { throw new Error('terrain rendering cannot send an engine input'); } });
    context.window = context;
    vm.runInContext(identitySource, context, { filename: 'js/hd-lib-identity.js', timeout: 5000 });
    vm.runInContext(source, context, { filename: 'js/hd-battle-terrain.js', timeout: 5000 });
    const api = context.BayeHdBattleTerrain;
    assert.ok(api?.classifyTile && api.inspect && api.createPainter, 'terrain API is available');
    function drawingContext(log) {
        const properties = { globalAlpha: 1, lineWidth: 1 };
        return new Proxy(properties, {
            get(target, key) {
                if (key in target) return target[key];
                if (key === 'createLinearGradient' || key === 'createRadialGradient') {
                    return () => ({ addColorStop() {} });
                }
                if (key === 'measureText') return text => ({ width: String(text).length * 10 });
                return (...args) => log.push({ operation: key, args, fillStyle: target.fillStyle,
                    strokeStyle: target.strokeStyle, alpha: target.globalAlpha });
            }
        });
    }
    const ctx = drawingContext(composites);
    const painter = api.createPainter({ createCanvas() {
        if (!offscreen) return null;
        const cachedContext = drawingContext(offscreenCalls);
        const canvas = { width: 0, height: 0, getContext: () => cachedContext };
        canvasObjects.push(canvas); return canvas;
    } });
    return { context, document, api, painter, ctx, nativeWrites, offscreenCalls, composites, canvasObjects };
}

function snapshot(overrides = {}) {
    return { source: 'full', width: 9, height: 7, stride: 9,
        tiles: Array.from({ length: 63 }, (_, index) => index % 46),
        libPath: 'libs/dat-mod.lib', session: 1, mode: 'hd', verified: true, ...overrides };
}
const board = { ox: 80, oy: 72, cw: 120, ch: 100, cols: 3, rows: 2, viewOx: 2, viewOy: 3, dpr: 1 };
const plain = value => JSON.parse(JSON.stringify(value));

test('all native byte tiles agree with the actual C classifier and eight terrain meanings', () => {
    const { api } = harness(), seen = new Set();
    for (let raw = 0; raw <= 255; raw++) {
        const expected = nativeTerrain(raw), actual = api.classifyTile(raw);
        assert.equal(actual.index, expected === -1 ? null : expected, 'native tile ' + raw);
        if (expected !== -1) {
            assert.equal(actual.label, labels[expected], 'native semantic label for tile ' + raw);
            assert.notEqual(actual.kind, 'unknown'); seen.add(expected);
        } else {
            assert.equal(actual.kind, 'unknown'); assert.equal(actual.label, '未知地形');
        }
    }
    assert.equal(seen.size, 8, 'every native terrain category is covered');
});

test('absent, fractional, nonnumeric and outside-byte tiles cannot invent a terrain meaning', () => {
    const { api } = harness();
    for (const raw of [null, undefined, NaN, Infinity, -1, 256, 1.5, '2', {}, false]) {
        assert.equal(api.classifyTile(raw).kind, 'unknown', String(raw));
        assert.equal(api.classifyTile(raw).index, null, String(raw));
    }
});

test('inspection uses native full-map stride even when the visible board is cropped', () => {
    const { api } = harness(), s = snapshot({ tiles: Array(63).fill(0) });
    s.tiles[3 * s.stride + 2] = 41;
    s.tiles[2 * 3 + 1] = 1;
    assert.equal(api.inspect(s, 2, 3).index, constants.TERRAIN_TENT);
    assert.equal(api.inspect(s, 2, 3).raw, 41);
    assert.equal(api.inspect(s, 2, 3).x, 2);
    assert.equal(api.inspect(s, 2, 3).y, 3);
    for (const [x, y] of [[-1, 0], [9, 0], [0, 7], [2.5, 3], [2, NaN]]) {
        assert.equal(api.inspect(s, x, y).kind, 'unknown', x + ',' + y);
    }
});

test('missing cells and invalid native dimensions are neutral instead of using a screen cache', () => {
    const { api } = harness();
    for (const s of [snapshot({ tiles: null }), snapshot({ tiles: [] }), snapshot({ tiles: [1] }),
        snapshot({ source: 'unknown' }), snapshot({ stride: 3 }), snapshot({ width: 0 }),
        snapshot({ height: 7.5 }), snapshot({ width: 256 }), snapshot({ verified: false })]) {
        assert.equal(api.inspect(s, 2, 3).kind, 'unknown');
    }
    const short = snapshot({ tiles: [41] });
    assert.equal(api.inspect(short, 0, 0).index, constants.TERRAIN_TENT);
    assert.equal(api.inspect(short, 1, 0).kind, 'unknown');
    assert.equal(api.inspect(snapshot({ tiles: Array(63).fill(null) }), 0, 0).kind, 'unknown');
});

test('unverified LIBs and rejected category crosschecks keep unknown labels and no effect claims', () => {
    const { api } = harness();
    for (const libPath of ['', 'libs/custom-mod.lib', 'libs/other/dat-mod.lib', 'libs/dat.lib']) {
        assert.equal(api.inspect(snapshot({ libPath, tiles: Array(63).fill(41) }), 2, 3).kind, 'unknown');
    }
    const rejected = api.inspect(snapshot({ verified: false }), 2, 3);
    assert.equal(rejected.label, '未知地形');
    for (let raw = 0; raw < 256; raw++) {
        const actual = plain(api.inspect(snapshot({ tiles: Array(63).fill(raw) }), 2, 3));
        assert.deepEqual(Object.keys(actual).filter(key => /damage|bonus|cost|defen|attack|movement|effect/i.test(key)), []);
        assert.doesNotMatch(actual.label, /[+\-]\d|%|加成|伤害|移动力|防御|攻击/);
    }
});

test('terrain semantics require explicit verification rather than an absent or truthy status', () => {
    const { api } = harness();
    for (const verified of [undefined, null, false, 0, 1, 'true']) {
        assert.equal(api.inspect(snapshot({ verified, tiles: Array(63).fill(41) }), 2, 3).kind,
            'unknown', 'verification status ' + String(verified));
    }
    assert.equal(api.inspect(snapshot({ tiles: Array(63).fill(41) }), 2, 3).index, constants.TERRAIN_TENT);
});

test('actual loaded dictionary bytes authenticate once; a changed cached LIB cannot inherit trust', async () => {
    const { api } = harness(); let calls = 0, work;
    const verifier = api.createVerifier({ digest(bytes) {
        calls++; work = webcrypto.subtle.digest('SHA-256', bytes); return work;
    } });
    assert.equal(verifier.check(dictionaryHex, {}).verified, false, 'pending digest is neutral');
    assert.equal(calls, 1);
    await work; await settle();
    const verified = verifier.check(dictionaryHex, {});
    assert.equal(verified.verified, true, 'actual shipped bytes authenticate');
    assert.equal(verified.sha256, dictionarySha256);
    assert.equal(verified.libPath, 'libs/dat-mod.lib');
    verifier.check(dictionaryHex, {}); assert.equal(calls, 1, 'same loaded bytes reuse fingerprint');
    const changed = Buffer.from(dictionaryBytes); changed[changed.length - 1] ^= 1;
    const changedHex = changed.toString('hex');
    assert.equal(verifier.check(changedHex, {}).verified, false, 'same path with stale or modified bytes loses trust immediately');
    assert.equal(calls, 2); await work; await settle();
    assert.equal(verifier.check(changedHex, {}).verified, false, 'modified bytes cannot match the supported dictionary');
});

test('missing, malformed or unhashable loaded data cannot authenticate from a stored path', () => {
    const { api } = harness(); let calls = 0;
    const verifier = api.createVerifier({ digest() { calls++; throw new Error('unavailable digest'); } });
    for (const value of [null, undefined, '', '0', 'gg', '00gg', [], dictionaryBytes]) {
        assert.equal(verifier.check(value, {}).verified, false, 'loaded data ' + String(value).slice(0, 20));
    }
    assert.equal(calls, 0, 'invalid data never reaches a digest');
    assert.equal(verifier.check(dictionaryHex, {}).verified, false, 'digest failure stays neutral');
    assert.equal(api.createVerifier().check(dictionaryHex, {}).verified, false, 'no browser crypto remains neutral');
});

test('a late valid fingerprint cannot overwrite a newer modified or missing identity', async () => {
    const { api } = harness(), pending = [];
    const verifier = api.createVerifier({ digest(bytes) {
        return new Promise((resolve, reject) => pending.push({ bytes: Buffer.from(bytes), resolve, reject }));
    } });
    const changed = Buffer.from(dictionaryBytes); changed[0] ^= 1;
    const changedHex = changed.toString('hex');
    verifier.check(dictionaryHex, {}); verifier.check(changedHex, {});
    assert.equal(pending.length, 2);
    pending[0].resolve(hashBuffer(pending[0].bytes)); await settle();
    assert.equal(verifier.check(changedHex, {}).verified, false, 'old supported bytes cannot verify current changed bytes');
    pending[1].resolve(hashBuffer(pending[1].bytes)); await settle();
    assert.equal(verifier.check(changedHex, {}).verified, false);
    verifier.check(dictionaryHex, {}); assert.equal(pending.length, 3);
    verifier.check(null, {});
    pending[2].resolve(hashBuffer(pending[2].bytes)); await settle();
    assert.equal(verifier.check(null, {}).verified, false, 'cleared LIB cannot be revived by old success');
});

test('a stale rejected digest cannot revoke the current authenticated identity', async () => {
    const { api } = harness(), pending = [];
    const verifier = api.createVerifier({ digest(bytes) {
        return new Promise((resolve, reject) => pending.push({ bytes: Buffer.from(bytes), resolve, reject }));
    } });
    const changed = Buffer.from(dictionaryBytes); changed[0] ^= 1;
    verifier.check(changed.toString('hex'), {}); verifier.check(dictionaryHex, {});
    pending[1].resolve(hashBuffer(pending[1].bytes)); await settle();
    assert.equal(verifier.check(dictionaryHex, {}).verified, true);
    pending[0].reject(new Error('old digest failed')); await settle();
    assert.equal(verifier.check(dictionaryHex, {}).verified, true, 'old failure cannot mutate a newer successful verification');
});

test('custom terrain hooks veto authenticated labels while ordinary hooks preserve byte identity', async () => {
    const { api } = harness(); let work, calls = 0;
    const verifier = api.createVerifier({ digest(bytes) {
        calls++; work = webcrypto.subtle.digest('SHA-256', bytes); return work;
    } });
    verifier.check(dictionaryHex, {}); await work; await settle();
    assert.equal(verifier.check(dictionaryHex, { fightChooseAction() {} }).verified, true);
    for (const name of ['drawMapUnit', 'getTerrainInfo', 'loadFightMap']) {
        const blocked = verifier.check(dictionaryHex, { [name]() {} });
        assert.equal(blocked.verified, false, 'custom ' + name + ' stays neutral');
        assert.equal(api.inspect(snapshot({ verified: blocked.verified, tiles: Array(63).fill(41) }), 2, 3).kind, 'unknown');
    }
    assert.equal(verifier.check(dictionaryHex, {}).verified, true, 'removing a hook restores authenticated semantics');
    assert.equal(calls, 1, 'hook ownership changes do not rehash immutable bytes');
});

test('production terrain verifier shares the current byte digest and rejects mismatched supplied data', async () => {
    const h = harness(); let calls = 0, work;
    h.context.crypto = { subtle: { digest(...args) { calls++; work = webcrypto.subtle.digest(...args); return work; } } };
    h.context.Promise = class { constructor() { throw new Error('engine callback Promise'); } };
    h.context.dynLib = dictionaryHex;
    assert.equal(h.api.verifyLib(dictionaryHex, {}).verified, false);
    h.context.BayeHdLibIdentity.read();
    await work; await settle();
    assert.equal(h.api.verifyLib(dictionaryHex, { didLoadGame() {} }).verified, true);
    assert.equal(calls, 1, 'terrain and another consumer read the same verified digest');
    assert.equal(h.api.verifyLib('abcd', {}).verified, false, 'call arguments cannot stand in for actual global loaded bytes');
    assert.equal(h.api.verifyLib(dictionaryHex, { getTerrainInfo() {} }).reason, 'custom-terrain-hook');
    h.context.dynLib = 'abcd';
    assert.equal(h.api.verifyLib(dictionaryHex, {}).verified, false, 'actual byte replacement immediately revokes old terrain trust');
    assert.equal(h.context.BayeHdLibIdentity.read().generation, 2);
    await work; await settle();
    assert.equal(h.api.verifyLib('abcd', {}).reason, 'unrecognized-lib');
});

test('terrain paint composites the cropped layer at the board anchor without native writes', () => {
    const h = harness(), s = snapshot(), before = JSON.stringify(s), beforeBoard = JSON.stringify(board);
    h.painter.paint(h.ctx, board, s);
    assert.ok(h.offscreenCalls.length > 0, 'static terrain layer is drawn');
    const images = h.composites.filter(call => call.operation === 'drawImage');
    assert.equal(images.length, 1, 'one static layer is composited');
    assert.equal(images[0].args[1], board.ox); assert.equal(images[0].args[2], board.oy);
    assert.equal(JSON.stringify(s), before); assert.equal(JSON.stringify(board), beforeBoard);
    assert.deepEqual(h.nativeWrites, []);
});

test('cropped native map preserves category fills and local cell geometry', () => {
    const full = snapshot({ tiles: Array.from({ length: 63 }, (_, index) => index % 45 + 1) }),
        cropped = snapshot({ width: board.cols, height: board.rows,
        stride: board.cols, tiles: [] });
    for (let y = 0; y < board.rows; y++) {
        for (let x = 0; x < board.cols; x++) {
            cropped.tiles.push(full.tiles[(y + board.viewOy) * full.stride + x + board.viewOx]);
        }
    }
    const a = harness(), b = harness();
    a.painter.paint(a.ctx, board, full);
    b.painter.paint(b.ctx, { ...board, viewOx: 0, viewOy: 0 }, cropped);
    // Motif variants deliberately use native coordinates. Compare complete
    // cell fills so the assertion checks categories and stride, not art vectors.
    const cellFills = h => h.offscreenCalls.filter(call => call.operation === 'fillRect' &&
        call.args[2] >= board.cw && call.args[3] >= board.ch)
        .map(call => ({ args: call.args, fillStyle: call.fillStyle }));
    assert.equal(cellFills(a).length, board.cols * board.rows);
    assert.deepEqual(cellFills(a), cellFills(b),
        'visible categories and local cell anchors agree across full-map cropping');
});

test('unchanged snapshots reuse static terrain; exact content and scene identity invalidate the cache', () => {
    const h = harness(), s = snapshot();
    const bake = () => h.offscreenCalls.length;
    h.painter.paint(h.ctx, board, s); let previous = bake();
    h.painter.paint(h.ctx, { ...board }, { ...s, tiles: [...s.tiles] });
    assert.equal(bake(), previous, 'new wrappers containing identical content reuse the layer');
    for (const change of [
        () => { s.tiles[board.viewOy * s.stride + board.viewOx] = 6; },
        () => { s.tiles[board.viewOy * s.stride + board.viewOx] = 15; },
        () => { s.session++; },
        () => { s.source = 'unknown'; },
        () => { s.source = 'full'; s.verified = false; },
        () => { s.verified = true; s.libPath = 'libs/unknown.lib'; },
        () => { s.libPath = 'libs/dat-mod.lib'; s.width = s.stride = 8; s.height = 8; }
    ]) {
        change(); h.painter.paint(h.ctx, board, s);
        assert.ok(bake() > previous, 'changed native content or terrain trust must replace the layer');
        previous = bake();
    }
    for (const changedBoard of [{ ...board, viewOx: 1 }, { ...board, dpr: 2 },
        { ...board, cw: 99 }, { ...board, cols: 2 }]) {
        h.painter.paint(h.ctx, changedBoard, s);
        assert.ok(bake() > previous, 'viewport, DPR and geometry changes invalidate the layer'); previous = bake();
    }
    h.painter.clear(); h.painter.paint(h.ctx, board, s);
    assert.ok(bake() > previous, 'explicit scene clearing discards stale terrain');
    assert.deepEqual(h.nativeWrites, []);
});

test('classic mode clears static cache and hidden pages cannot build or paint terrain', () => {
    const h = harness(), s = snapshot(); h.painter.paint(h.ctx, board, s);
    let baked = h.offscreenCalls.length, shown = h.composites.length;
    h.painter.paint(h.ctx, board, { ...s, mode: 'classic' });
    assert.equal(h.offscreenCalls.length, baked); assert.equal(h.composites.length, shown);
    h.painter.paint(h.ctx, board, s);
    assert.ok(h.offscreenCalls.length > baked, 'return to HD rebuilds terrain for the current scene');
    baked = h.offscreenCalls.length; shown = h.composites.length;
    h.document.hidden = true; s.session++; s.tiles[29] = 41;
    h.painter.paint(h.ctx, board, s);
    assert.equal(h.offscreenCalls.length, baked); assert.equal(h.composites.length, shown);
    h.document.hidden = false; h.painter.paint(h.ctx, board, s);
    assert.ok(h.offscreenCalls.length > baked); assert.ok(h.composites.length > shown);
});

test('missing offscreen canvas still draws neutral fallback without touching native state', () => {
    const h = harness({ offscreen: false }), s = snapshot({ source: 'unknown', verified: false });
    const before = JSON.stringify(s); h.painter.paint(h.ctx, board, s);
    assert.ok(h.composites.length > 0, 'direct vector fallback remains visible');
    assert.equal(JSON.stringify(s), before); assert.deepEqual(h.nativeWrites, []);
});
