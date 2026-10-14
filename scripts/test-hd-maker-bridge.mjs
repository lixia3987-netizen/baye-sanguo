#!/usr/bin/env node
// Consume the real public bridge from read-only native observations. These
// tests never run a name/resource getter, a Mod hook, or a native input writer.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const raw = {}, writes = [], keys = [], calls = [];
    let onRead = null;
    const context = vm.createContext({TextDecoder, TextEncoder,
        Module: {HEAPU8: new Uint8Array(8192)}, console: {log(){}, warn(){}},
        addEventListener(){}, alert(){}, lcdBlur(){}});
    context.window = context;
    for (const name of new Set(source.match(/\b_baye\w+/g))) context[name] = () => 0;
    context._bayeHdReady = () => 1;
    context._bayeSendKey = key => keys.push(key);
    vm.runInContext(source, context);
    context.baye_bridge_init();
    function readonly(value, path = '') {
        if (!value || typeof value !== 'object') return value;
        return new Proxy(value, {
            get(object, key) {
                if (onRead) onRead(path, key);
                return readonly(object[key], path + '.' + String(key));
            },
            set(object, key) {
                writes.push(path + '.' + String(key));
                throw Error('native write');
            }
        });
    }
    const baye = context.baye;
    baye.data = readonly(raw);
    baye.ensureData = () => baye.data;
    for (const name of ['getPersonName', 'getCityName', 'getToolName', 'getArmType', 'callHook']) {
        baye[name] = (...args) => {calls.push([name, ...args]); throw Error('uncaptured native getter/hook');};
    }
    function hold() {
        Object.assign(raw, {
            g_hdMakerProtocolVersion: 1, g_hdMakerActive: 1, g_hdMakerPhase: 2,
            g_hdMakerCustom: 0, g_hdMakerReturnEligible: 1, g_hdMakerSourceValid: 1,
            g_hdMakerGeneration: 7, g_hdMakerSession: 11, g_hdMakerInputSeq: 2,
            g_hdMakerEventId: 31, g_hdMakerCommitSeq: 96,
            g_hdMakerResourceFingerprint: 0xb961053e, g_hdMakerResourceLength: 2413,
            g_hdMakerResourceIndex: 0, g_hdMakerCount: 96, g_hdMakerPicmax: 1,
            g_hdMakerFrameIndex: 95, g_hdMakerOriginX: 0, g_hdMakerOriginY: 0,
            g_hdMakerStartFrm: 0, g_hdMakerEndFrm: 95, g_hdMakerEndReason: 1,
            g_hdMakerEndKey: 255, g_hdMakerVisibleFrames: new Uint8Array(32)
        });
        raw.g_hdMakerVisibleFrames[11] = 0x80;
    }
    function untouched() {
        assert.deepEqual(writes, []); assert.deepEqual(keys, []); assert.deepEqual(calls, []);
    }
    return {raw, baye, context, hold, untouched, onRead: callback => {onRead = callback;}};
}

function neutral(value) {
    assert.equal(value.active, false);
    assert.equal(value.phase, null);
    assert.equal(value.returnEligible, false);
    assert.equal(value.sourceValid, false);
    assert.equal(value.display.frameValid, false);
    assert.deepEqual(plain(value.display.visibleFrames), []);
    for (const key of ['generation', 'session', 'inputSeq', 'resourceIndex', 'count', 'picmax',
        'x', 'y', 'startFrm', 'endFrm', 'resourceLength', 'resourceFingerprint']) {
        assert.equal(value[key], null, key);
    }
    assert.deepEqual(plain(value.scrollEnd), {reason: null, key: null});
}

test('missing or unsupported maker protocol cannot authorize a retained LCD source or return owner', () => {
    const h = fixture(); const absent = h.baye.hd.maker();
    assert.equal(absent.protocolVersion, null); neutral(absent);
    for (const version of [undefined, null, 0, 2, '1', true, 1.5, NaN, Infinity]) {
        h.hold(); h.raw.g_hdMakerProtocolVersion = version;
        neutral(h.baye.hd.maker());
    }
    h.untouched();
});

test('actual held source preserves independent wait owner and copied LCD identity without keeping SPE active', () => {
    const h = fixture(); h.hold();
    // Public SPE is retired; its logical state is deliberately unrelated to
    // the separate maker wait and must not supply any missing maker metadata.
    Object.assign(h.raw, {g_hdSpeActive: 0, g_hdSpeId: 0, g_hdSpeFrameIndex: 0xffff,
        g_hdSpeDisplayEventId: 999, g_hdSpeDisplayCommitSeq: 1000});
    const value = plain(h.baye.hd.maker());
    assert.equal(value.protocolVersion, 1); assert.equal(value.active, true);
    assert.equal(value.phase, 'hold'); assert.equal(value.returnEligible, true);
    assert.equal(value.generation, 7); assert.equal(value.session, 11); assert.equal(value.inputSeq, 2);
    assert.equal(value.sourceValid, true); assert.equal(value.custom, false);
    assert.equal(value.speId, 6); assert.equal(value.resourceIndex, 0);
    assert.equal(value.count, 96); assert.equal(value.picmax, 1);
    assert.equal(value.resourceLength, 2413);
    assert.equal(value.resourceFingerprint, 'fnv1a32:b961053e:2413');
    assert.deepEqual(value.scrollEnd, {reason: 'complete', key: 255});
    assert.deepEqual(value.display, {generation: 7, eventId: 31, commitSeq: 96,
        frameIndex: 95, frameValid: true,
        visibleFrames: Array.from({length: 32}, (_, index) => index === 11 ? 0x80 : 0)});
    h.untouched();
});

test('scroll and custom fallback retain real owner but cannot claim HD held frames', () => {
    const h = fixture(); h.hold();
    h.raw.g_hdMakerPhase = 1; h.raw.g_hdMakerInputSeq = 1; h.raw.g_hdMakerReturnEligible = 0;
    const scroll = h.baye.hd.maker();
    assert.equal(scroll.active, true); assert.equal(scroll.phase, 'scroll');
    assert.equal(scroll.inputSeq, 1); assert.equal(scroll.returnEligible, false);
    assert.equal(scroll.sourceValid, false); assert.equal(scroll.display.frameValid, false);
    h.hold(); h.raw.g_hdMakerCustom = 1;
    const custom = h.baye.hd.maker();
    assert.equal(custom.active, true); assert.equal(custom.phase, 'hold');
    assert.equal(custom.returnEligible, true); assert.equal(custom.custom, true);
    assert.equal(custom.sourceValid, false); assert.equal(custom.display.frameValid, false);
    h.untouched();
});

test('a skipped scroll keeps its actual partial copied frame rather than synthesizing final frame 95', () => {
    const h = fixture(); h.hold();
    h.raw.g_hdMakerEndReason = 2; h.raw.g_hdMakerEndKey = 39;
    h.raw.g_hdMakerCommitSeq = 9; h.raw.g_hdMakerFrameIndex = 8;
    h.raw.g_hdMakerVisibleFrames.fill(0); h.raw.g_hdMakerVisibleFrames[1] = 1;
    const value = plain(h.baye.hd.maker());
    assert.equal(value.sourceValid, true); assert.equal(value.display.commitSeq, 9);
    assert.equal(value.display.frameIndex, 8); assert.equal(value.display.visibleFrames[1], 1);
    assert.equal(value.display.visibleFrames[11], 0);
    assert.deepEqual(value.scrollEnd, {reason: 'key', key: 39});
    h.untouched();
});

test('boxed numeric bindings preserve signed origins and unsigned boundary values without coercion', () => {
    const h = fixture(); h.hold();
    for (const key of Object.keys(h.raw)) if (typeof h.raw[key] === 'number') h.raw[key] = {value: h.raw[key]};
    h.raw.g_hdMakerOriginX = {value: 0xffff}; h.raw.g_hdMakerOriginY = {value: 0x8000};
    h.raw.g_hdMakerResourceFingerprint = {value: 0xffffffff};
    h.raw.g_hdMakerVisibleFrames = Array.from(h.raw.g_hdMakerVisibleFrames, value => ({value}));
    let value = h.baye.hd.maker();
    assert.equal(value.sourceValid, true); assert.equal(value.x, -1); assert.equal(value.y, -32768);
    assert.equal(value.resourceFingerprint, 'fnv1a32:ffffffff:2413');
    h.raw.g_hdMakerResourceFingerprint.value = '4294967295';
    value = h.baye.hd.maker();
    assert.equal(value.resourceFingerprint, null); assert.equal(value.sourceValid, false);
    h.untouched();
});

test('the actual U32 binding preserves signed WASM i32 bits before maker fingerprint and owner validation', () => {
    const h = fixture(); h.hold();
    // WASM exposes C U32 results through its i32 ABI. A real i32.load in a
    // minimal memory fixture proves that boundary; the production value-def
    // binding, not a fabricated positive JS box, must restore unsigned bits.
    const binary = Uint8Array.from([
        0,97,115,109,1,0,0,0,
        1,6,1,96,1,127,1,127,
        3,2,1,0,
        5,3,1,0,1,
        7,17,2,6,109,101,109,111,114,121,2,0,4,114,101,97,100,0,0,
        10,9,1,7,0,32,0,40,2,0,11
    ]);
    const native = new WebAssembly.Instance(new WebAssembly.Module(binary)).exports;
    const memory = new DataView(native.memory.buffer), context = h.context;
    context.Module.HEAPU8 = new Uint8Array(native.memory.buffer);
    context._ValueDef_get_type = () => context.ValueTypeU32;
    context._baye_get_u32_value = native.read;
    context._baye_set_u32_value = () => {throw Error('native U32 write');};
    const binding = context.baye_bridge_valuedef(1, 128);
    for (const unsigned of [0x80000000, 0xb961053e, 0xffffffff]) {
        memory.setUint32(128, unsigned, true);
        assert.equal(native.read(128), unsigned - 0x100000000, 'actual signed WASM export');
        assert.equal(binding._type, context.ValueTypeU32);
        assert.equal(binding.value, unsigned, 'production public U32 binding');
    }
    memory.setUint32(128, 0xb961053e, true);
    h.raw.g_hdMakerResourceFingerprint = binding;
    const maker = h.baye.hd.maker();
    assert.equal(maker.resourceFingerprint, 'fnv1a32:b961053e:2413');
    assert.equal(maker.sourceValid, true); assert.equal(maker.display.frameValid, true);
    // High-bit sessions/generations are legitimate wrapping native counters.
    memory.setUint32(132, 0x80000000, true);
    const owner = context.baye_bridge_valuedef(1, 132);
    for (const field of ['Generation', 'Session', 'InputSeq', 'EventId', 'CommitSeq']) {
        h.raw['g_hdMaker' + field] = owner;
    }
    const highOwner = h.baye.hd.maker();
    assert.equal(highOwner.active, true); assert.equal(highOwner.sourceValid, true);
    assert.equal(highOwner.generation, 0x80000000); assert.equal(highOwner.session, 0x80000000);
    assert.equal(highOwner.display.eventId, 0x80000000); assert.equal(highOwner.display.commitSeq, 0x80000000);
    h.untouched();
});

test('malformed owner scalars never create an active return target', () => {
    for (const [field, value] of [
        ['Active', '1'], ['Active', true], ['Phase', -1], ['Phase', 3], ['Phase', '2'],
        ['Generation', 0], ['Generation', 0x100000000], ['Generation', Infinity],
        ['Session', null], ['Session', 0], ['Session', 1.5], ['InputSeq', false], ['InputSeq', 0],
        ['Custom', null], ['ReturnEligible', undefined]
    ]) {
        const h = fixture(); h.hold(); h.raw['g_hdMaker' + field] = value;
        const result = h.baye.hd.maker();
        assert.equal(result.active, false, field + '=' + String(value));
        assert.equal(result.returnEligible, false); assert.equal(result.sourceValid, false);
        assert.equal(result.display.frameValid, false); h.untouched();
    }
});

test('malformed resource or display scalars fail HD source authentication while preserving native wait', () => {
    for (const [field, value] of [
        ['SourceValid', '1'], ['SourceValid', true], ['EventId', 0], ['CommitSeq', 0],
        ['ResourceLength', 0], ['ResourceLength', 0x100000000], ['ResourceFingerprint', null],
        ['ResourceFingerprint', -1], ['ResourceIndex', 1], ['Count', 0], ['Count', 256],
        ['Picmax', 0], ['Picmax', 256], ['FrameIndex', 0xffff], ['FrameIndex', '95'],
        ['FrameIndex', 96], ['StartFrm', 96], ['EndFrm', 96], ['OriginX', 65536],
        ['OriginY', false], ['EndReason', 3], ['EndReason', 4], ['EndReason', 5]
    ]) {
        const h = fixture(); h.hold(); h.raw['g_hdMaker' + field] = value;
        const result = h.baye.hd.maker();
        assert.equal(result.active, true, field); assert.equal(result.returnEligible, true);
        assert.equal(result.sourceValid, false, field + '=' + String(value));
        assert.equal(result.display.frameValid, false); h.untouched();
    }
});

test('all 32 native visibility bytes must exist and describe frames inside actual resource range', () => {
    for (const replacement of [undefined, null, '0'.repeat(32), Array(31).fill(0), Array(32)]) {
        const h = fixture(); h.hold(); h.raw.g_hdMakerVisibleFrames = replacement;
        const result = h.baye.hd.maker();
        assert.equal(result.active, true); assert.equal(result.sourceValid, false);
        assert.equal(result.display.frameValid, false); h.untouched();
    }
    for (const invalid of [undefined, null, '128', true, -1, 256, 0.5, NaN]) {
        const h = fixture(); h.hold(); h.raw.g_hdMakerVisibleFrames = Array.from(h.raw.g_hdMakerVisibleFrames);
        h.raw.g_hdMakerVisibleFrames[11] = invalid;
        assert.equal(h.baye.hd.maker().sourceValid, false); h.untouched();
    }
    for (const frame of [96, 127, 255]) {
        const h = fixture(); h.hold();
        h.raw.g_hdMakerVisibleFrames[frame >> 3] |= 1 << (frame & 7);
        assert.equal(h.baye.hd.maker().sourceValid, false, 'out-of-resource frame ' + frame);
        h.untouched();
    }
    const h = fixture(); h.hold(); h.raw.g_hdMakerStartFrm = 8;
    h.raw.g_hdMakerVisibleFrames[0] = 1;
    assert.equal(h.baye.hd.maker().sourceValid, false, 'before requested start frame'); h.untouched();
});

test('late native owner changes during the final bit read retire the whole mixed snapshot', () => {
    for (const [field, value] of [
        ['Generation', 8], ['Session', 12], ['InputSeq', 3], ['Active', 0], ['Phase', 0],
        ['Custom', 1], ['ReturnEligible', 0], ['SourceValid', 0], ['EventId', 32],
        ['CommitSeq', 97], ['FrameIndex', 94], ['EndReason', 2], ['EndKey', 39]
    ]) {
        const h = fixture(); h.hold(); let changed = false;
        h.onRead((path, key) => {
            if (!changed && path === '.g_hdMakerVisibleFrames' && String(key) === '31') {
                changed = true; h.raw['g_hdMaker' + field] = value;
            }
        });
        const result = h.baye.hd.maker(); assert.equal(changed, true, field); neutral(result); h.untouched();
    }
});

test('a later metadata read changing session cannot recover an old source under a new owner', () => {
    const h = fixture(); h.hold(); let changed = false;
    h.onRead((path, key) => {
        if (!changed && path === '' && key === 'g_hdMakerEndKey') {
            changed = true; h.raw.g_hdMakerSession += 1; h.raw.g_hdMakerInputSeq += 1;
        }
    });
    neutral(h.baye.hd.maker()); assert.equal(changed, true); h.untouched();
});

test('LCD interference, native end and new sessions cannot retain an authenticated old held source', () => {
    const h = fixture(); h.hold(); const retained = plain(h.baye.hd.maker());
    h.raw.g_hdMakerSourceValid = 0;
    let current = h.baye.hd.maker();
    assert.equal(current.active, true); assert.equal(current.returnEligible, true);
    assert.equal(current.sourceValid, false); assert.equal(current.display.frameValid, false);
    h.raw.g_hdMakerActive = 0; h.raw.g_hdMakerPhase = 0; h.raw.g_hdMakerInputSeq = 0;
    h.raw.g_hdMakerReturnEligible = 0;
    current = h.baye.hd.maker();
    assert.equal(current.active, false); assert.equal(current.returnEligible, false);
    assert.equal(current.sourceValid, false);
    h.hold(); h.raw.g_hdMakerSession = 12; h.raw.g_hdMakerEventId = 32;
    const reopened = h.baye.hd.maker();
    assert.equal(reopened.active, true); assert.equal(reopened.session, 12);
    assert.equal(reopened.display.eventId, 32);
    assert.equal(retained.session, 11); assert.equal(retained.display.eventId, 31);
    assert.equal(retained.sourceValid, true); h.untouched();
});

test('returned visibility arrays are independent observations rather than live writable native arrays', () => {
    const h = fixture(); h.hold(); const first = h.baye.hd.maker();
    first.display.visibleFrames[11] = 0;
    first.display.visibleFrames[0] = 255;
    assert.equal(h.raw.g_hdMakerVisibleFrames[11], 128);
    assert.equal(h.raw.g_hdMakerVisibleFrames[0], 0);
    const second = h.baye.hd.maker();
    assert.equal(second.sourceValid, true); assert.equal(second.display.visibleFrames[11], 128);
    assert.equal(second.display.visibleFrames[0], 0);
    h.raw.g_hdMakerVisibleFrames[11] = 64; h.raw.g_hdMakerFrameIndex = 94;
    assert.equal(second.display.frameIndex, 95); assert.equal(second.display.visibleFrames[11], 128);
    assert.equal(h.baye.hd.maker().display.frameIndex, 94); h.untouched();
});
