// Controlled raw native ABI VM fixtures with actual original LIB bytes; no native C or browser execution.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {aidRawScenarios, readAidPublic, fixture, plain, bits} from './hd-aid-native-test-fixture.mjs';

const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
function payload(id) {
    const offset = lib.readUInt32LE((id - 1) * 4), fixed = lib.readUInt32LE(offset + 8);
    const start = fixed ? 14 : lib.readUInt32LE(offset + 14), length = fixed || lib.readUInt32LE(offset + 18);
    return lib.subarray(offset + start, offset + start + length);
}
function fnv(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
const movie = payload(39), seed = aidRawScenarios().find(s => !s.numeric).rawGlobals;
assert.equal(movie.length, 1084);
assert.equal(fnv(movie), 0x6b0ebc5a);
function rawFor(current = 0, shown = current) {
    const raw = structuredClone(seed);
    Object.assign(raw, {g_hdSpeId: 39, g_hdSpeSkillId: 20, g_hdSpeTargetIndex: 3,
        g_hdSpeResourceFingerprint: fnv(movie), g_hdSpeResourceLength: movie.length,
        g_hdSpeCommitSeq: current + 1, g_hdSpeFrameIndex: current,
        g_hdSpeDisplayCommitSeq: shown + 1, g_hdSpeDisplayFrameIndex: shown});
    for (const [prefix, frame] of [['g_hdSpe', current], ['g_hdSpeDisplay', shown]]) Object.assign(raw, {
        [prefix + 'SceneMode']: 2, [prefix + 'SceneX']: 48, [prefix + 'SceneY']: 16,
        [prefix + 'SceneWidth']: 64, [prefix + 'SceneHeight']: 64,
        [prefix + 'VisibleFrames']: bits(frame),
        [prefix + 'ClearFrames']: bits(...Array.from({length: frame}, (_, i) => i))});
    return raw;
}
function liveFixture(current = 0, shown = current) {
    const f = fixture(); Object.assign(f.raw, rawFor(current, shown)); return f;
}
function assertRejected(raw) {
    const result = readAidPublic(raw);
    assert.equal(result.publicSpe.composition.valid, false);
    assert.equal(result.publicSpe.display.composition.valid, false);
    return result;
}
function assertCopyRejected(raw) {
    const result = readAidPublic(raw);
    assert.equal(result.publicSpe.composition.valid, true);
    assert.equal(result.publicSpe.display.composition.valid, false);
}

test('QIMEN20 actual original LIB has friendly aim1/state4/power0/destroy0/MP20 and two opaque alternating pictures', () => {
    const skill = payload(10).subarray(19 * 34, 20 * 34);
    assert.equal(skill.length, 34); assert.deepEqual([...skill.subarray(0, 7)], [1, 4, 0, 0, 0, 0, 20]);
    assert.deepEqual([...movie.subarray(0, 6)], [0, 18, 8, 2, 0, 7]);
    for (let frame = 0; frame < 8; frame++) assert.deepEqual([...movie.subarray(6 + frame * 5, 11 + frame * 5)], [0, 0, 25, 25, frame % 2]);
    for (const offset of [46, 565]) {
        assert.equal(movie.readUInt16LE(offset), 64); assert.equal(movie.readUInt16LE(offset + 2), 64);
        assert.equal(movie.readUInt16LE(offset + 4), 1); assert.equal(movie[offset + 6], 0);
    }
});

test('QIMEN20 all eight copied public movie frames certify only the actual64 square without NUM or hold', () => {
    for (let frame = 0; frame < 8; frame++) {
        const {publicSpe: s, publicSkillResult: result, publicResultOwner: owner} = readAidPublic(rawFor(frame));
        assert.equal(s.id, 39); assert.equal(s.skillId, 20); assert.equal(s.contextKnown, true);
        assert.equal(s.composition.valid, true); assert.equal(s.display.composition.valid, true);
        assert.equal(s.composition.mode, 2); assert.equal(s.composition.background.valid, false);
        assert.equal(s.display.frameIndex, frame); assert.deepEqual(s.display.visibleFrames, bits(frame));
        assert.deepEqual(s.display.composition.clearFrames, bits(...Array.from({length: frame}, (_, i) => i)));
        assert.deepEqual([s.composition.x, s.composition.y, s.composition.width, s.composition.height], [48, 16, 64, 64]);
        assert.equal(result.active, false); assert.equal(result.display, null); assert.equal(owner.valid, false);
    }
});

test('QIMEN20 actual current may lead independent copied display and does not promote its future clear history', () => {
    for (const [current, shown] of [[3, 0], [7, 3], [7, 6]]) {
        const {publicSpe: s} = readAidPublic(rawFor(current, shown));
        assert.equal(s.composition.valid, true); assert.equal(s.display.composition.valid, true);
        assert.equal(s.frameIndex, current); assert.equal(s.display.frameIndex, shown);
        assert.deepEqual(s.display.visibleFrames, bits(shown));
        assert.deepEqual(s.display.composition.clearFrames, bits(...Array.from({length: shown}, (_, i) => i)));
    }
});

test('QIMEN20 established copied clear-only pixels retain source authorization without inventing a visible frame', () => {
    const raw = rawFor(3); raw.g_hdSpeVisibleFrames = raw.g_hdSpeDisplayVisibleFrames = bits();
    raw.g_hdSpeClearFrames = raw.g_hdSpeDisplayClearFrames = bits(0, 1, 2, 3);
    const {publicSpe: s} = readAidPublic(raw);
    assert.equal(s.composition.valid, true); assert.equal(s.display.composition.valid, true);
    assert.deepEqual(s.display.visibleFrames, bits()); assert.deepEqual(s.display.composition.clearFrames, bits(0, 1, 2, 3));
});

for (const [name, change] of [
    ['other resource', r => r.g_hdSpeId = 41], ['other item', r => r.g_hdSpeResourceIndex = 1],
    ['other kind', r => r.g_hdSpeKind = 3], ['other skill', r => r.g_hdSpeSkillId = 17],
    ['unknown context', r => r.g_hdSpeContextKnown = 0], ['actor sentinel', r => r.g_hdSpeActorIndex = 255],
    ['target sentinel', r => r.g_hdSpeTargetIndex = 255], ['changed payload fingerprint', r => r.g_hdSpeResourceFingerprint ^= 1],
    ['changed payload length', r => r.g_hdSpeResourceLength++], ['wrong frame count', r => r.g_hdSpeCount = 7],
    ['wrong picture count', r => r.g_hdSpePicmax = 3], ['wrong range start', r => r.g_hdSpeStartFrm = 1],
    ['wrong range end', r => r.g_hdSpeEndFrm = 6], ['wrong origin', r => r.g_hdSpeOriginX = 49],
    ['wrong scene', r => r.g_hdSpeSceneY = 17], ['borrowed WOOD mode3', r => r.g_hdSpeSceneMode = 3],
    ['unsupported width', r => r.g_hdSpeSceneWidth = 66], ['unsupported height', r => r.g_hdSpeSceneHeight = 63],
    ['wrong keyflag', r => r.g_hdSpeKeyflag = 1], ['old protocol', r => r.g_hdSpeProtocolVersion = 1],
    ['unready native frame', r => r.g_hdSpeFrameValid = 0], ['native protocol invalid', r => r.g_hdSpeProtocolValid = 0],
    ['ended event', r => r.g_hdSpeActive = 0], ['native composition retired', r => r.g_hdSpeCompositionValid = 0],
    ['custom native source invalid', r => { r.g_hdSkillResultCustom = 1; r.g_hdSpeCompositionValid = 0; }],
    ['extended screen', r => r.g_screenWidth = 176], ['unsupported scale', r => r.g_scale = 2],
    ['report takeover', r => r.g_hdReportActive = 1], ['help takeover', r => r.g_hdHelpActive = 1],
    ['quantity takeover', r => r.g_hdQtyActive = 1],
    ['no established pixels', r => { r.g_hdSpeVisibleFrames = bits(); r.g_hdSpeClearFrames = bits(); }],
    ['future current visible bit', r => r.g_hdSpeVisibleFrames = bits(1)],
    ['future current clear bit', r => r.g_hdSpeClearFrames = bits(1)],
    ['outside selected range bit', r => r.g_hdSpeVisibleFrames = bits(8)],
    ['invalid bit byte', r => r.g_hdSpeClearFrames[0] = 256],
    ['truncated clear history', r => r.g_hdSpeClearFrames.pop()],
    ['string geometry', r => r.g_hdSpeSceneWidth = '64']
]) test('QIMEN20 independent public source rejects ' + name, () => { const raw = rawFor(); change(raw); assertRejected(raw); });

test('QIMEN20 copied validity is independent from current native validity', () => {
    const raw = rawFor(3, 0); raw.g_hdSpeDisplayCompositionValid = 0; assertCopyRejected(raw);
});

test('QIMEN20 public display rejects future/stale copied owners and unestablished copied geometry', () => {
    for (const change of [
        r => r.g_hdSpeDisplayGeneration++, r => r.g_hdSpeDisplayEventId++,
        r => r.g_hdSpeDisplayCommitSeq = 0, r => r.g_hdSpeDisplayCommitSeq = 5,
        r => r.g_hdSpeDisplayFrameIndex = 4, r => r.g_hdSpeDisplayFrameValid = 0,
        r => r.g_hdSpeDisplayVisibleFrames = bits(1), r => r.g_hdSpeDisplayClearFrames = bits(3),
        r => r.g_hdSpeDisplaySceneMode = 3, r => r.g_hdSpeDisplaySceneWidth = 66,
        r => { r.g_hdSpeDisplayVisibleFrames = bits(); r.g_hdSpeDisplayClearFrames = bits(); }
    ]) { const raw = rawFor(3, 0); change(raw); assertCopyRejected(raw); }
});

test('QIMEN20 same copied commit requires exact frontier/live/clear and lagged clear is a subset', () => {
    for (const change of [
        r => r.g_hdSpeDisplayFrameIndex = 2, r => r.g_hdSpeDisplayVisibleFrames = bits(2),
        r => r.g_hdSpeDisplayClearFrames = bits(0, 1),
        r => { r.g_hdSpeDisplayCommitSeq = 2; r.g_hdSpeDisplayFrameIndex = 1; r.g_hdSpeDisplayVisibleFrames = bits(1);
            r.g_hdSpeDisplayClearFrames = bits(0); r.g_hdSpeClearFrames = bits(1, 2); }
    ]) { const raw = rawFor(3); change(raw); assertCopyRejected(raw); }
});

test('QIMEN20 final getter fence retires state mutated after composition was sampled', () => {
    for (const change of [
        f => f.raw.g_hdSpeEventId++, f => f.raw.g_hdSpeGeneration++,
        f => f.raw.g_hdSpeSkillId = 17, f => f.raw.g_hdSpeActorIndex = 3,
        f => f.raw.g_hdSpeSceneWidth = 66, f => f.raw.g_hdSpeDisplayClearFrames = bits(1),
        f => f.raw.g_hdReportActive = 1, f => f.raw.g_hdHelpActive = 1,
        f => f.replaceData()
    ]) {
        const f = liveFixture(); let changed = false;
        f.onRead((path, key) => { if (!changed && path === '' && key === 'g_hdSpeStatusProtocolVersion') { changed = true; change(f); } });
        const s = f.baye.hd.spe(); assert.equal(changed, true);
        assert.equal(s.composition.valid, false); assert.equal(s.display.composition.valid, false); f.untouched();
    }
});

test('QIMEN20 actual transient movie result scope does not require a numeric result owner', () => {
    const f = liveFixture(7);
    Object.assign(f.raw, {g_hdResultOwnerKind: 2, g_hdResultOwnerValid: 1, g_hdResultOwnerGeneration: 7,
        g_hdResultOwnerSession: 11, g_hdSkillResultProtocolVersion: 1, g_hdSkillResultActive: 1,
        g_hdSkillResultPhase: 1, g_hdSkillResultCustom: 0, g_hdSkillResultSourceValid: 1,
        g_hdSkillResultGeneration: 7, g_hdSkillResultSession: 11, g_hdSkillResultSkillId: 20,
        g_hdSkillResultResultKind: 2, g_hdSkillResultActorIndex: 2, g_hdSkillResultTargetIndex: 3,
        g_hdSkillResultValue: 0});
    const s = f.baye.hd.spe(), result = f.baye.hd.skillResult();
    assert.equal(s.composition.valid, true); assert.equal(s.display.composition.valid, true);
    assert.equal(result.phase, 'movie'); assert.equal(result.display.valid, false); f.untouched();
});

test('QIMEN20 end/reset cannot reuse a previous copied movie frame', () => {
    const f = liveFixture(7); const before = f.baye.hd.spe(); assert.equal(before.display.composition.valid, true);
    Object.assign(f.raw, {g_hdSpeActive: 0, g_hdSpeCompositionValid: 0, g_hdSpeLastEndedId: 31,
        g_hdSpeEndReason: 1, g_hdSpeEndKey: 255, g_hdSkillResultActive: 0, g_hdResultOwnerValid: 0});
    const after = f.baye.hd.spe(); assert.equal(after.active, 0);
    assert.equal(after.composition.valid, false); assert.equal(after.display.composition.valid, false);
    assert.deepEqual(plain(after.lastEnd), {eventId: 31, reason: 'complete', key: 255}); f.untouched();
});

test('QIMEN20 source stays distinct from legitimate14/15 while refusing unsupported shared39 context', () => {
    for(const skillId of [20,14,15]) { const r=rawFor();r.g_hdSpeSkillId=skillId;const a=readAidPublic(r);assert.equal(a.publicSpe.skillId,skillId);assert.equal(a.publicSpe.composition.valid,true); }
    const r=rawFor();r.g_hdSpeSkillId=13;assertRejected(r);
});

test('QIMEN20 final fence refuses a switch to otherwise valid14 during the getter', () => {
    const f = liveFixture(); let changed = false;
    f.onRead((path, key) => { if (!changed && path === '' && key === 'g_hdSpeStatusProtocolVersion') { changed = true; f.raw.g_hdSpeSkillId = 14; } });
    const s = f.baye.hd.spe(); assert.equal(changed, true); assert.equal(s.composition.valid, false);
    assert.equal(s.display.composition.valid, false); f.untouched();
});
