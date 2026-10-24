import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const nativeHeader = readFileSync(new URL('../vendor/iBaye/src/baye/fight.h', import.meta.url), 'utf8');
const nativeFight = readFileSync(new URL('../vendor/iBaye/src/Fight.c', import.meta.url), 'utf8');
const constants = Object.fromEntries([...nativeHeader.matchAll(/^#define\s+(FGT_MRG|MOV_RSTD|MAX_ATT_RANGEUNIT|TOOL_ATT_RANGEUNIT)\s+(0x[\da-f]+|\d+)\b/gmi)]
    .map(([, key, value]) => [key, Number(value)]));
constants.MAX_ATT_RANGEUNIT ??= constants.TOOL_ATT_RANGEUNIT;
const moveBody = nativeFight.match(/U8 FgtGenMove\(U8 idx\)\s*\{([\s\S]*?)\n\}/)?.[1];
const aimBody = nativeFight.match(/bool FgtChkRng\(void\)\s*\{([\s\S]*?)\n\}/)?.[1];
assert.ok(moveBody && aimBody, 'native movement and target range oracles exist');
assert.match(moveBody, /U8\s+x,y\s*;/, 'movement coordinates wrap through native U8 locals');
assert.match(aimBody, /U8\s+x,y,rng\s*;/, 'target coordinates wrap through native U8 locals');
const moveX = moveBody.match(/\bx\s*=\s*(g_FoucsX[^;]+);/)?.[1];
const moveY = moveBody.match(/\by\s*=\s*(g_FoucsY[^;]+);/)?.[1];
const moveReject = moveBody.match(/if\s*\(g_engineConfig\.fixFightMoveOutRange\)\s*\{\s*cannotMoveTo\s*=\s*([^;]+);/)?.[1];
const aimX = aimBody.match(/\bx\s*=\s*([^;]+);/)?.[1];
const aimY = aimBody.match(/\by\s*=\s*([^;]+);/)?.[1];
const aimReject = aimBody.match(/if\s*\(([^\n]+)\)\s*return false;/)?.[1];
const aimAccept = aimBody.match(/return\s*\(([^\n]+)\);/)?.[1]?.replace(/\(U16\)/g, '');
assert.ok(moveX && moveY && moveReject && aimX && aimY && aimReject && aimAccept,
    'production native decision expressions are present');
// Execute production C expressions with its U8 assignments and header constants.
// This compares feedback with the native confirmation rule, which includes 0 and
// 128, rather than reproducing the older LCD highlight or a geometric radius.
const nativeMove = new Function('g_FoucsX', 'g_FoucsY', 'g_PathSX', 'g_PathSY', 'g_PUseSX', 'g_PUseSY', 'g_FightPath',
    `const FGT_MRG=${constants.FGT_MRG}, MOV_RSTD=${constants.MOV_RSTD};
     const x=(${moveX})&255, y=(${moveY})&255; return !(${moveReject});`);
const nativeAim = new Function('g_FoucsX', 'g_FoucsY', 'g_FgtAtkRng',
    `const rng=g_FgtAtkRng[0], x=(${aimX})&255, y=(${aimY})&255;
     if (${aimReject}) return false; return (${aimAccept});`);
const bounds = { width: 31, height: 29 };
const moveMask = overrides => ({ originX: 0, originY: 0, useX: 0, useY: 0,
    values: Array(constants.FGT_MRG ** 2).fill(255), ...overrides });
const aimMask = overrides => ({ size: 5, originX: 0, originY: 0,
    values: Array(25).fill(0), ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));

function snapshot(overrides = {}) {
    const actor = { i: 0, x: 1, y: 1, state: 0, active: 0, side: 'player' };
    return { visible: true, ready: true, active: true, wait: true, over: false,
        hidden: false, menuActive: false, reportActive: false, inputKind: 2, inputSeq: 7,
        aimType: 0, actorIndex: 0, actor, bounds: { ...bounds },
        view: { x: 0, y: 0, width: 8, height: 6 }, focus: { x: 2, y: 2 },
        move: moveMask({ values: Array(225).fill(0) }), aim: aimMask({ values: Array(25).fill(1) }),
        units: [actor, { i: 1, x: 2, y: 2, state: 0, active: 0, side: 'player' },
            { i: 10, x: 3, y: 2, state: 0, active: 0, side: 'enemy' }], ...overrides };
}
const cellAt = (model, x, y) => model.cells.find(cell => cell.x === x && cell.y === y);
function freezeSnapshot(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value); for (const item of Object.values(value)) freezeSnapshot(item);
    }
    return value;
}

function drawingContext() {
    const events = [], stack = [];
    let state = { globalAlpha: 0.61, lineWidth: 17, fillStyle: 'previous fill', strokeStyle: 'previous stroke',
        font: 'previous font', textAlign: 'right', dash: [5, 7] };
    const before = plain(state);
    const ctx = new Proxy({}, {
        get(target, key) {
            if (key in state) return state[key];
            if (key === 'save') return () => { stack.push(plain(state)); events.push({ operation: 'save' }); };
            if (key === 'restore') return () => { state = stack.pop(); assert.ok(state, 'balanced Canvas restore'); events.push({ operation: 'restore' }); };
            if (key === 'getLineDash') return () => [...state.dash];
            if (key === 'setLineDash') return value => { state.dash = Array.from(value); };
            return (...args) => events.push({ operation: key, args, ...plain(state) });
        },
        set(target, key, value) { state[key] = value; return true; }
    });
    return { ctx, events, before, current: () => plain(state), stack };
}

function harness() {
    const writes = [], inputs = [], calls = [];
    const document = { hidden: false };
    const context = vm.createContext({ console, document,
        baye: new Proxy({}, { set(target, key, value) { writes.push([key, value]); return true; } }),
        sendKey(key) { inputs.push(key); throw new Error('feedback must never send native input'); } });
    context.window = context;
    const source = readFileSync(new URL('../js/hd-battle-feedback.js', import.meta.url), 'utf8');
    vm.runInContext(source, context, { filename: 'js/hd-battle-feedback.js', timeout: 5000 });
    const api = context.BayeHdBattleFeedback;
    assert.ok(api?.lookupMove && api.lookupAim, 'read-only feedback lookup API is available');
    return { api, context, document, writes, inputs, calls };
}

test('movement feedback agrees with actual native confirmation for every byte, including origin and resistance boundary', () => {
    const { api } = harness(), mask = moveMask();
    for (let raw = 0; raw <= 255; raw++) {
        mask.values[2 * constants.FGT_MRG + 3] = raw;
        const expected = nativeMove(3, 2, 0, 0, 0, 0, mask.values);
        assert.equal(api.lookupMove(mask, 3, 2, bounds).status, expected ? 'in' : 'out', 'native raw ' + raw);
    }
    assert.equal(api.lookupMove(moveMask({ values: Array(225).fill(0) }), 0, 0, bounds).status, 'in');
    assert.equal(api.lookupMove(moveMask({ values: Array(225).fill(128) }), 14, 14, bounds).status, 'in');
    assert.equal(api.lookupMove(moveMask({ values: Array(225).fill(128) }), 15, 14, bounds).status, 'out');
});

test('movement uses full native 15 by 15 stride, offsets and U8 wrap at either map edge', () => {
    const { api } = harness();
    const values = Array.from({ length: 225 }, (_, index) => (index * 47 + 13) & 255);
    for (const [originX, originY, useX, useY] of [[0, 0, 0, 0], [3, 7, 4, 2], [255, 255, 0, 0],
        [254, 253, 1, 2], [25, 24, 8, 7]]) {
        const mask = moveMask({ originX, originY, useX, useY, values });
        for (let y = 0; y < bounds.height; y++) for (let x = 0; x < bounds.width; x++) {
            const expected = nativeMove(x, y, originX, originY, useX, useY, values);
            assert.equal(api.lookupMove(mask, x, y, bounds).status, expected ? 'in' : 'out',
                `native move origin ${originX},${originY} use ${useX},${useY} cell ${x},${y}`);
        }
    }
});

test('attack and skill masks use native U8 origins, row stride and exactly byte one', () => {
    const { api } = harness();
    for (let raw = 0; raw <= 255; raw++) {
        const mask = aimMask(); mask.values[2 * mask.size + 3] = raw;
        const native = [mask.size, mask.originX, mask.originY, ...mask.values];
        assert.equal(api.lookupAim(mask, 3, 2, bounds).status, nativeAim(3, 2, native) ? 'in' : 'out', 'native raw ' + raw);
    }
    for (const size of [1, 5, 9, constants.MAX_ATT_RANGEUNIT]) {
        for (const [originX, originY] of [[0, 0], [255, 255], [254, 253], [8, 13]]) {
            const values = Array.from({ length: size * size }, (_, index) => [0, 1, 2, 255][(index * 7 + 3) % 4]);
            const mask = aimMask({ size, originX, originY, values }), native = [size, originX, originY, ...values];
            for (let y = 0; y < bounds.height; y++) for (let x = 0; x < bounds.width; x++) {
                assert.equal(api.lookupAim(mask, x, y, bounds).status, nativeAim(x, y, native) ? 'in' : 'out',
                    `native aim size ${size} origin ${originX},${originY} cell ${x},${y}`);
            }
        }
    }
});

test('lookup rejects coordinates outside actual native bounds before U8 wrap can alias a legal cell', () => {
    const { api } = harness(), move = moveMask({ values: Array(225).fill(0) }), aim = aimMask({ values: Array(25).fill(1) });
    for (const [x, y] of [[-1, 0], [31, 0], [0, 29], [255, 0], [256, 0], [0, -256]]) {
        assert.equal(api.lookupMove(move, x, y, bounds).status, 'out', x + ',' + y);
        assert.equal(api.lookupAim(aim, x, y, bounds).status, 'out', x + ',' + y);
    }
    for (const [x, y] of [[1.5, 0], [0, NaN], [Infinity, 0], ['1', 0], [null, 0]]) {
        assert.notEqual(api.lookupMove(move, x, y, bounds).status, 'in', String(x) + ',' + String(y));
        assert.notEqual(api.lookupAim(aim, x, y, bounds).status, 'in', String(x) + ',' + String(y));
    }
    const largestNativeMap = { width: 255, height: 255 };
    const edgeMove = moveMask({ originX: 250, originY: 250, values: Array(225).fill(128) });
    const edgeAim = aimMask({ originX: 250, originY: 250, values: Array(25).fill(1) });
    assert.equal(api.lookupMove(edgeMove, 254, 254, largestNativeMap).status,
        nativeMove(254, 254, 250, 250, 0, 0, edgeMove.values) ? 'in' : 'out');
    assert.equal(api.lookupAim(edgeAim, 254, 254, largestNativeMap).status,
        nativeAim(254, 254, [5, 250, 250, ...edgeAim.values]) ? 'in' : 'out');
    assert.equal(api.lookupMove(edgeMove, 255, 254, largestNativeMap).status, 'out');
    assert.equal(api.lookupAim(edgeAim, 254, 255, largestNativeMap).status, 'out');
});

test('missing, short or malformed native masks and bounds cannot invent reachability', () => {
    const { api } = harness();
    for (const mask of [null, undefined, {}, moveMask({ values: null }), moveMask({ values: [] }),
        moveMask({ values: Array(224).fill(0) }), moveMask({ originX: -1 }), moveMask({ originY: 256 }),
        moveMask({ useX: 1.5 }), moveMask({ useY: '1' })]) {
        assert.equal(api.lookupMove(mask, 0, 0, bounds).status, 'unknown', 'malformed move mask');
    }
    for (const mask of [null, undefined, {}, aimMask({ values: null }), aimMask({ values: Array(24).fill(1) }),
        aimMask({ size: 0 }), aimMask({ size: 16 }), aimMask({ size: 2.5 }), aimMask({ size: '5' }),
        aimMask({ originX: -1 }), aimMask({ originY: 256 })]) {
        assert.equal(api.lookupAim(mask, 0, 0, bounds).status, 'unknown', 'malformed aim mask');
    }
    for (const raw of [undefined, null, NaN, Infinity, -1, 256, 0.5, '1', false]) {
        const move = moveMask(), aim = aimMask(); move.values[0] = raw; aim.values[0] = raw;
        assert.equal(api.lookupMove(move, 0, 0, bounds).status, 'unknown', 'invalid move raw ' + String(raw));
        assert.equal(api.lookupAim(aim, 0, 0, bounds).status, 'unknown', 'invalid aim raw ' + String(raw));
    }
    for (const nativeBounds of [null, {}, { width: 0, height: 29 }, { width: 256, height: 29 },
        { width: 31, height: 1.5 }, { width: '31', height: 29 }]) {
        assert.equal(api.lookupMove(moveMask(), 0, 0, nativeBounds).status, 'unknown');
        assert.equal(api.lookupAim(aimMask(), 0, 0, nativeBounds).status, 'unknown');
    }
});

test('range lookups observe current native bytes without mutating masks or sending an input', () => {
    const h = harness(), move = moveMask(), aim = aimMask();
    Object.freeze(move); Object.freeze(aim); Object.freeze(bounds);
    const before = JSON.stringify({ move, aim, bounds });
    h.api.lookupMove(move, 0, 0, bounds); h.api.lookupAim(aim, 0, 0, bounds);
    assert.equal(JSON.stringify({ move, aim, bounds }), before);
    move.values[0] = 128; aim.values[0] = 1;
    assert.equal(h.api.lookupMove(move, 0, 0, bounds).status, 'in');
    assert.equal(h.api.lookupAim(aim, 0, 0, bounds).status, 'in');
    move.values[0] = 129; aim.values[0] = 2;
    assert.equal(h.api.lookupMove(move, 0, 0, bounds).status, 'out');
    assert.equal(h.api.lookupAim(aim, 0, 0, bounds).status, 'out');
    assert.deepEqual(h.writes, []); assert.deepEqual(h.inputs, []);
});

test('feedback belongs only to the current native movement or aim wait and retires for a report, menu or terminal state', () => {
    const { api } = harness();
    assert.equal(api.build(snapshot()).active, true);
    for (const changed of [{ visible: false }, { visible: undefined }, { ready: false }, { ready: undefined },
        { wait: false }, { wait: undefined }, { active: false }, { over: true }, { hidden: true },
        { menuActive: true }, { reportActive: true }, { classic: true }, { mode: 'classic' },
        { inputKind: 0 }, { inputKind: 1 }, { inputKind: 3 }, { inputKind: 10 }, { inputKind: undefined },
        { inputSeq: 0 }, { inputSeq: -1 }, { inputSeq: 2.5 }, { inputSeq: undefined }]) {
        const model = api.build(snapshot(changed));
        assert.equal(model.active, false, JSON.stringify(changed));
        assert.equal(model.cells.length, 0, 'retired feedback leaves no stale range cells');
        assert.equal(model.rangedUnits.length, 0, 'retired feedback leaves no stale target marks');
    }
    for (const aimType of [undefined, null, 255, -1, 0.5, '1']) {
        assert.equal(api.build(snapshot({ inputKind: 5, aimType })).active, false, 'unknown native aim owner');
    }
});

test('range actor identity, alive state, action availability and native bounds must agree', () => {
    const { api } = harness(), original = snapshot().actor;
    for (const actor of [null, {}, { ...original, i: 1 }, { ...original, side: 'enemy' },
        { ...original, x: -1 }, { ...original, y: bounds.height }, { ...original, x: 1.5 },
        { ...original, state: 8 }, { ...original, state: 1 }, { ...original, state: 6 },
        { ...original, active: 1 }, { ...original, active: undefined }, { ...original, state: undefined }]) {
        assert.equal(api.build(snapshot({ actor })).active, false, 'invalid native actor ' + JSON.stringify(actor));
    }
    for (const actorIndex of [-1, 20, 255, 0.5, undefined]) {
        assert.equal(api.build(snapshot({ actorIndex })).active, false, 'invalid actor slot ' + actorIndex);
    }
    for (const state of [0, 2, 3, 4, 5, 7]) {
        assert.equal(api.build(snapshot({ inputKind: 5, actor: { ...original, state } })).active, true,
            'the native wait, rather than an invented status restriction, owns aim state ' + state);
    }
});

test('visible range cells preserve native offsets and clip expanded presentation geometry at native map bounds', () => {
    const { api } = harness();
    const s = snapshot({ bounds: { width: 9, height: 7 }, view: { x: 7, y: 5, width: 5, height: 4 },
        move: moveMask({ originX: 255, originY: 253, useX: 0, useY: 0,
            values: Array.from({ length: 225 }, (_, index) => (index * 37 + 11) & 255) }) });
    const model = api.build(s);
    assert.equal(model.active, true); assert.equal(model.cells.length, 4);
    assert.deepEqual(plain(model.cells.map(cell => [cell.x, cell.y]).sort()), [[7, 5], [7, 6], [8, 5], [8, 6]].sort());
    for (const cell of model.cells) {
        const expected = nativeMove(cell.x, cell.y, 255, 253, 0, 0, s.move.values);
        assert.equal(cell.status, expected ? 'in' : 'out');
    }
    assert.ok(model.cells.every(cell => cell.x < s.bounds.width && cell.y < s.bounds.height));
    for (const view of [{ x: -1, y: 0, width: 3, height: 2 }, { x: 0, y: -1, width: 3, height: 2 },
        { x: 0, y: 0, width: 0, height: 2 },
        { x: 0, y: 0, width: 2.5, height: 2 }]) {
        assert.equal(api.build(snapshot({ view })).active, false, 'malformed viewport');
    }
});

test('range outlines join only known adjacent in-range cells without inventing a route through blocked or unknown cells', () => {
    const { api } = harness(), s = snapshot({ view: { x: 0, y: 0, width: 5, height: 4 }, move: moveMask() });
    s.move.values[1 * 15 + 1] = 0; s.move.values[1 * 15 + 2] = 128;
    s.move.values[1 * 15 + 3] = null;
    const model = api.build(s), left = cellAt(model, 1, 1), right = cellAt(model, 2, 1), unknown = cellAt(model, 3, 1);
    assert.equal(left.status, 'in'); assert.equal(right.status, 'in'); assert.equal(unknown.status, 'unknown');
    assert.equal(left.edges.east, false); assert.equal(right.edges.west, false, 'connected cells share no internal outline');
    assert.equal(left.edges.north, true); assert.equal(left.edges.south, true); assert.equal(left.edges.west, true);
    assert.equal(right.edges.east, true, 'unknown neighbor cannot extend the range');
    assert.equal(model.focus.status, 'out', 'blocked focus remains distinct from an allowed destination');
    s.focus = { x: 2, y: 1 };
    assert.equal(api.build(s).focus.label, '可移动', 'native byte 128 remains a confirmed legal move');
    s.focus = { x: 3, y: 1 };
    assert.equal(api.build(s).focus.status, 'unknown');
    for (const focus of [null, {}, { x: -1, y: 1 }, { x: bounds.width, y: 1 }, { x: 1.5, y: 1 }]) {
        const next = api.build({ ...s, focus });
        assert.equal(next.active, true, 'bad focus cannot erase a valid native range');
        assert.ok(!next.focus || next.focus.status !== 'in', 'bad focus cannot become a legal destination');
    }
});

test('attack highlights only living enemies while a skill describes range without claiming target legality or damage', () => {
    const { api } = harness(), s = snapshot({ inputKind: 5 });
    let model = api.build(s);
    assert.equal(model.kind, 'attack');
    assert.equal(model.focus.targetIndex, null, 'friendly focus is not an attack target');
    assert.deepEqual(plain(model.rangedUnits.map(unit => unit.i)), [10]);
    s.focus = { x: 3, y: 2 }; model = api.build(s);
    assert.equal(model.focus.targetIndex, 10); assert.equal(model.focus.label, '射程内敌将');
    s.focus = { x: 4, y: 2 }; model = api.build(s);
    assert.equal(model.focus.targetIndex, null, 'empty range cell does not imply a valid target');
    s.units[2].state = 8; s.focus = { x: 3, y: 2 }; model = api.build(s);
    assert.equal(model.focus.targetIndex, null); assert.equal(model.rangedUnits.length, 0);
    s.units[2].state = 0;
    for (const i of [-1, 20, 255, undefined, 10.5]) {
        const invalid = api.build({ ...s, units: [...s.units.slice(0, 2), { ...s.units[2], i }] });
        assert.equal(invalid.focus.targetIndex, null, 'invalid native roster slot ' + String(i));
        assert.equal(invalid.rangedUnits.length, 0);
    }
    s.units[2].state = 0; s.aimType = 1; s.focus = { x: 2, y: 2 }; model = api.build(s);
    assert.equal(model.kind, 'skill'); assert.equal(model.focus.targetIndex, 1);
    assert.equal(model.focus.label, '射程内目标');
    assert.deepEqual(plain(model.rangedUnits.map(unit => unit.i).sort((a, b) => a - b)), [0, 1, 10]);
    // Native FgtJNChkAim additionally checks target arm type, terrain, side and
    // canUseSkill scripts. A passive range table cannot predict those decisions.
    assert.doesNotMatch(JSON.stringify(model), /可攻击|可施展|有效目标|伤害|命中率|\"legal\"|\"damage\"|\"chance\"/);
    s.focus = { x: 4, y: 2 }; model = api.build(s);
    assert.equal(model.focus.targetIndex, null); assert.equal(model.focus.label, '计谋射程内 · 空地');
    s.aim.values[2 * 5 + 2] = 2; s.focus = { x: 2, y: 2 }; model = api.build(s);
    assert.equal(model.focus.status, 'out'); assert.equal(model.focus.targetIndex, null);
});

test('painting distinguishes range meanings, clips to the native board intersection and restores Canvas state', () => {
    const h = harness(), palette = new Set();
    const board = { ox: 80, oy: 90, cw: 60, ch: 55, cols: 5, rows: 4, viewOx: 7, viewOy: 5, dpr: 1 };
    for (const [inputKind, aimType, expectedKind] of [[2, 0, 'move'], [5, 0, 'attack'], [5, 1, 'skill']]) {
        const s = freezeSnapshot(snapshot({ inputKind, aimType, bounds: { width: 9, height: 7 },
            view: { x: 7, y: 5, width: 5, height: 4 }, focus: { x: 8, y: 6 },
            aim: aimMask({ originX: 6, originY: 4, values: Array(25).fill(1) }) }));
        const nativeBefore = JSON.stringify(s), model = freezeSnapshot(h.api.build(s)), drawing = drawingContext();
        assert.equal(h.api.paint(drawing.ctx, board, model), true);
        assert.equal(JSON.stringify(s), nativeBefore, 'paint and build never modify native snapshots');
        assert.equal(model.kind, expectedKind);
        const washes = drawing.events.filter(event => event.operation === 'fillRect' &&
            event.args[2] === board.cw - 2 && event.args[3] === board.ch - 2);
        assert.equal(washes.length, 4, 'only four native cells intersect the expanded viewport');
        palette.add(washes[0].fillStyle);
        for (const event of washes) {
            assert.ok(event.args[0] >= board.ox && event.args[1] >= board.oy);
            assert.ok(event.args[0] < board.ox + 2 * board.cw && event.args[1] < board.oy + 2 * board.ch,
                'presentation-only cells outside native dimensions receive no range');
        }
        assert.ok(drawing.events.filter(event => event.operation === 'stroke').every(event => event.dash.length === 0),
            'range and target outlines stay solid even if a previous layer used dashes');
        assert.deepEqual(drawing.current(), drawing.before); assert.equal(drawing.stack.length, 0);
        if (expectedKind === 'skill') {
            const labels = drawing.events.filter(event => event.operation === 'fillText').map(event => event.args[0]);
            assert.ok(labels.some(label => label.includes('计谋射程')));
            assert.doesNotMatch(labels.join('\n'), /可施展|有效目标|伤害|命中率/);
        }
    }
    assert.equal(palette.size, 3, 'movement, attack and skill ranges remain visually distinct');
    assert.deepEqual(h.writes, []); assert.deepEqual(h.inputs, []);
});

test('hidden, inactive and unavailable-mask feedback performs no paint, hook or native input', () => {
    const h = harness(), board = { ox: 80, oy: 90, cw: 60, ch: 55, cols: 8, rows: 6, viewOx: 0, viewOy: 0 };
    for (const changed of [{ reportActive: true }, { wait: false }, { move: moveMask({ values: Array(224).fill(0) }) },
        { inputKind: 5, aim: aimMask({ values: Array(24).fill(1) }) }, { actorIndex: 255 }]) {
        const s = freezeSnapshot(snapshot(changed)), before = JSON.stringify(s), model = h.api.build(s), drawing = drawingContext();
        assert.equal(model.active, false); assert.equal(h.api.paint(drawing.ctx, board, model), false);
        assert.deepEqual(drawing.events, []); assert.equal(JSON.stringify(s), before);
    }
    const model = freezeSnapshot(h.api.build(freezeSnapshot(snapshot()))), drawing = drawingContext();
    h.document.hidden = true;
    assert.equal(h.api.paint(drawing.ctx, board, model), false); assert.deepEqual(drawing.events, []);
    assert.deepEqual(h.writes, []); assert.deepEqual(h.inputs, []);
});
