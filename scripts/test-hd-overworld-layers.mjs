import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../js/hd-overworld-layers.js', import.meta.url), 'utf8');
const context = vm.createContext({});
context.window = context;
for (const name of ['document', 'baye', 'sendKey', 'Image', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame']) {
    Object.defineProperty(context, name, { get() { throw new Error('Forbidden renderer dependency: ' + name); } });
}
vm.runInContext(source, context, { filename: 'js/hd-overworld-layers.js' });
const draw = context.BayeHdOverworldLayers.draw;
const plain = value => JSON.parse(JSON.stringify(value));
const view = { x: 0, y: 0, w: 100, h: 100 };
const destination = { x: 0, y: 0, w: 100, h: 100 };
const image = (w = 100, h = 100) => ({ naturalWidth: w, naturalHeight: h, complete: true });
const raster = overrides => ({ id: 'land', path: 'land.png', kind: 'raster', draw: true,
    pixelSize: [100, 100], worldRect: [0, 0, 100, 100], opacity: 0.6, ...overrides });
const stamps = overrides => raster({ kind: 'stamps', instances: [], ...overrides });

function recorder({ fail = [] } = {}) {
    const calls = [], stack = [];
    let state = { globalAlpha: 0.37, globalCompositeOperation: 'destination-over' }, attempts = 0;
    const before = { ...state };
    const ctx = {
        get globalAlpha() { return state.globalAlpha; }, set globalAlpha(value) { state.globalAlpha = value; },
        get globalCompositeOperation() { return state.globalCompositeOperation; },
        set globalCompositeOperation(value) { state.globalCompositeOperation = value; },
        save() { stack.push({ ...state }); },
        restore() { assert.ok(stack.length); state = stack.pop(); },
        drawImage(...args) {
            attempts += 1; calls.push({ args, state: { ...state } });
            if (fail.includes(attempts)) throw new Error('Actual image draw failed');
        },
        getImageData() { throw new Error('No pixel reads'); },
        clearRect() { throw new Error('No clearing outside the layer'); }
    };
    return { ctx, calls, restored() { assert.deepEqual(state, before); assert.equal(stack.length, 0); } };
}
function expected(result, sourceRect, targetRect, index) {
    assert.equal(result.drawn, 1); assert.equal(result.skipped, 0); assert.equal(result.operations.length, 1);
    const operation = result.operations[0];
    for (const [actual, fixed] of [[operation.source, sourceRect], [operation.destination, targetRect]]) {
        actual.forEach((value, i) => assert.ok(Math.abs(value - fixed[i]) < 1e-9, `${value} must equal fixed ${fixed[i]}`));
    }
    if (index === undefined) assert.equal(Object.hasOwn(operation, 'instanceIndex'), false);
    else assert.equal(operation.instanceIndex, index);
}
function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value); Object.values(value).forEach(freeze);
    }
    return value;
}

test('real river PNG covers the 3309-high source frame, not the 4000-high sea pad', () => {
    const bytes = readFileSync(new URL('../assets/hd-overworld/terrain/overlay_rivers.png', import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1920, 1655]);
    const geo = JSON.parse(readFileSync(new URL('../assets/hd-overworld/china-lcc-cities.json', import.meta.url)));
    assert.deepEqual(geo.fit.rasterSize, [3840, 3309]); assert.deepEqual(geo.mapSize, [3840, 4000]);
    const r = recorder();
    const result = draw(r.ctx, [raster({ id: 'river', path: 'river.png', pixelSize: [1920, 1655],
        worldRect: [0, 0, 3840, 3309] })], { 'river.png': image(1920, 1655) },
        { x: 0, y: 3000, w: 3840, h: 1000 }, { x: 0, y: 0, w: 1920, h: 1080 });
    expected(result, [0, 1500.4533091568449, 1920, 154.54669084315503], [0, 0, 1920, 333.72]);
    r.restored();
});

test('river draws nothing when the entire camera is in the 691-pixel sea pad', () => {
    const r = recorder();
    const result = draw(r.ctx, [raster({ pixelSize: [1920, 1655], worldRect: [0, 0, 3840, 3309] })],
        { 'land.png': image(1920, 1655) }, { x: 0, y: 3309, w: 3840, h: 691 }, destination);
    assert.deepEqual(plain(result), { drawn: 0, skipped: 1, operations: [] }); assert.equal(r.calls.length, 0); r.restored();
});

test('a partial real river camera samples fixed source pixels with a nonzero destination', () => {
    const r = recorder();
    const result = draw(r.ctx, [raster({ pixelSize: [1920, 1655], worldRect: [0, 0, 3840, 3309] })],
        { 'land.png': image(1920, 1655) }, { x: 1800, y: 1600, w: 1000, h: 600 }, { x: 40, y: 20, w: 500, h: 300 });
    expected(result, [900, 800.2417648836506, 500, 300.090661831369], [40, 20, 500, 300]); r.restored();
});

test('nonzero layer origin clips both edges without filling the whole destination', () => {
    const r = recorder();
    const result = draw(r.ctx, [raster({ pixelSize: [400, 200], worldRect: [20, 30, 200, 100] })],
        { 'land.png': image(400, 200) }, { x: 0, y: 0, w: 100, h: 80 }, { x: 40, y: 50, w: 200, h: 160 });
    expected(result, [0, 0, 160, 100], [80, 110, 160, 100]); r.restored();
});

test('small viewports scale to independent destination dimensions', () => {
    const r = recorder();
    const result = draw(r.ctx, [raster({ pixelSize: [800, 400], worldRect: [0, 0, 400, 200] })],
        { 'land.png': image(800, 400) }, { x: 50, y: 25, w: 100, h: 50 }, { x: 7, y: 11, w: 40, h: 20 });
    expected(result, [100, 50, 200, 100], [7, 11, 40, 20]); r.restored();
});

test('stamps cropped by the world keep source offsets from the original instance', () => {
    const r = recorder();
    const result = draw(r.ctx, [stamps({ pixelSize: [100, 80], instances: [{ rect: [-20, 10, 80, 80] }] })],
        { 'land.png': image(100, 80) }, view, { x: 5, y: 7, w: 200, h: 200 });
    expected(result, [25, 0, 75, 80], [5, 27, 120, 160], 0); r.restored();
});

test('stamp world and camera clipping preserve the same original sprite coordinates', () => {
    const r = recorder();
    const result = draw(r.ctx, [stamps({ pixelSize: [200, 160], worldRect: [0, 0, 500, 300],
        instances: [{ rect: [40, 20, 100, 80] }] })], { 'land.png': image(200, 160) },
        { x: 90, y: 50, w: 100, h: 100 }, { x: 10, y: 20, w: 200, h: 200 });
    expected(result, [100, 60, 100, 100], [10, 20, 100, 100], 0); r.restored();
});

test('a stamp at the river frame edge cannot stretch into the ocean pad', () => {
    const r = recorder();
    const result = draw(r.ctx, [stamps({ pixelSize: [100, 80], worldRect: [0, 0, 3840, 3309],
        instances: [{ rect: [3600, 3200, 400, 400] }] })], { 'land.png': image(100, 80) },
        { x: 3500, y: 3000, w: 500, h: 1000 }, { x: 10, y: 20, w: 250, h: 500 });
    expected(result, [0, 0, 60, 21.8], [60, 120, 120, 54.5], 0); r.restored();
});

test('bad and offscreen stamp candidates do not prevent the next actual instance', () => {
    const r = recorder();
    const result = draw(r.ctx, [stamps({ worldRect: [0, 0, 500, 500], instances: [
        { rect: [200, 200, 40, 40] }, { rect: [0, 0, 0, 30] }, { rect: [20, 30, 40, 50] }
    ] })], { 'land.png': image() }, view, destination);
    assert.equal(result.drawn, 1); assert.equal(result.skipped, 2); assert.equal(result.operations[0].instanceIndex, 2);
    assert.deepEqual(plain(result.operations[0].source), [0, 0, 100, 100]);
    assert.deepEqual(plain(result.operations[0].destination), [20, 30, 40, 50]); r.restored();
});

test('disabled, unavailable, incomplete and wrong-size optional layers skip independently', () => {
    const r = recorder();
    const layers = [raster({ draw: false }), raster({ path: 'missing.png' }), raster({ path: 'loading.png' }),
        raster({ path: 'wrong.png' }), raster({ path: 'good.png' })];
    const good = image();
    const result = draw(r.ctx, layers, { 'land.png': image(), 'loading.png': { ...image(), complete: false },
        'wrong.png': image(99, 100), 'good.png': good }, view, destination);
    assert.equal(result.drawn, 1); assert.equal(result.skipped, 4); assert.equal(r.calls[0].args[0], good); r.restored();
});

test('intrinsic image size takes precedence over CSS width and supports bitmap width sources', () => {
    const r = recorder();
    const result = draw(r.ctx, [raster(), raster({ path: 'bitmap.png' })],
        { 'land.png': { ...image(), width: 17, height: 23 }, 'bitmap.png': { width: 100, height: 100 } }, view, destination);
    assert.equal(result.drawn, 2); assert.equal(result.skipped, 0); r.restored();
});

test('strict malformed layer values never become coerced drawing coordinates', () => {
    const bad = [null, {}, raster({ draw: 1 }), raster({ opacity: 0 }), raster({ opacity: 1.01 }),
        raster({ opacity: NaN }), raster({ opacity: '0.6' }), raster({ pixelSize: ['100', 100] }),
        raster({ worldRect: [NaN, 0, 100, 100] }), raster({ worldRect: [0, Infinity, 100, 100] }),
        raster({ worldRect: [0, 0, -100, 100] }), raster({ worldRect: [0, 0, 100, 100, 1] }),
        raster({ kind: 'unknown' }), raster({ id: 0 }), stamps()];
    const r = recorder(); const result = draw(r.ctx, bad, { 'land.png': image() }, view, destination);
    assert.equal(result.drawn, 0); assert.equal(result.skipped, bad.length); assert.equal(r.calls.length, 0); r.restored();
});

test('invalid camera or destination rejects layers without touching the canvas', () => {
    for (const bad of [null, { ...view, x: '0' }, { ...view, w: 0 }, { ...view, h: -1 },
        { ...view, x: NaN }, { ...view, y: Infinity }, { ...view, x: Number.MAX_VALUE, w: Number.MAX_VALUE }]) {
        const r = recorder();
        for (const [viewport, target] of [[bad, destination], [view, bad]]) {
            assert.deepEqual(plain(draw(r.ctx, [raster()], { 'land.png': image() }, viewport, target)),
                { drawn: 0, skipped: 1, operations: [] });
        }
        assert.equal(r.calls.length, 0); r.restored();
    }
});

test('drawImage failure restores opacity and composite mode before the next layer', () => {
    const r = recorder({ fail: [1] });
    const result = draw(r.ctx, [raster(), raster({ id: 'next', opacity: 0.8 })], { 'land.png': image() }, view, destination);
    assert.equal(result.drawn, 1); assert.equal(result.skipped, 1); assert.equal(result.operations[0].id, 'next');
    assert.deepEqual(r.calls.map(call => call.state), [
        { globalAlpha: 0.6, globalCompositeOperation: 'source-over' },
        { globalAlpha: 0.8, globalCompositeOperation: 'source-over' }
    ]); r.restored();
});

test('frozen metadata and images are unchanged and no DOM, timer, engine or pixel reads are needed', () => {
    const layers = freeze([raster(), stamps({ instances: [{ rect: [10, 20, 30, 40] }] })]);
    const images = freeze({ 'land.png': image() }); const viewport = freeze({ ...view }), target = freeze({ ...destination });
    const before = plain({ layers, images, viewport, target }); const r = recorder();
    const result = draw(r.ctx, layers, images, viewport, target);
    assert.equal(result.drawn, 2); assert.equal(result.skipped, 0);
    assert.deepEqual(plain({ layers, images, viewport, target }), before); r.restored();
});

test('new renderer and its regression file use LF bytes', () => {
    assert.equal(source.includes('\r'), false);
    assert.equal(readFileSync(new URL(import.meta.url), 'utf8').includes('\r'), false);
});
