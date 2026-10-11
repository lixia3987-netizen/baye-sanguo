/** R34 fail-closed WOOD evidence contracts. Pure readers; no UI/native writes. */
import assert from 'node:assert/strict';

const integer = (v, min, max, label) => assert.ok(Number.isInteger(v) && v >= min && v <= max, label);
const same = (a, b, label) => assert.deepEqual(a, b, label);
const unit = (units, i, id) => {
    assert.ok(Array.isArray(units));
    const matches = units.filter(u => u.i === i);
    assert.equal(matches.length, 1, 'One actual unit at the bound slot');
    assert.equal(matches[0].id, id, 'Actual GenArray token cannot drift');
    return matches[0];
};
const metadata = c => ({ spe: c.spe, result: c.result, top: c.top, fight: c.fight, units: c.units });

export function woodAttemptFacts(attempt, skill) {
    assert.ok([6, 7].includes(skill));
    assert.ok(attempt && attempt.succeeded === true && attempt.proof && attempt.before && attempt.after);
    const p = attempt.proof, actor = attempt.actor, target = attempt.target;
    integer(p.generation, 1, 0xffffffff, 'Actual AIM generation');
    integer(actor.i, 0, 9, 'Player actor slot'); integer(target.i, 10, 19, 'Enemy target slot');
    same([p.casterId, p.targetId, p.x, p.y], [actor.id, target.id, target.x, target.y]);
    const a0 = unit(attempt.before.units, actor.i, actor.id), a1 = unit(attempt.after.units, actor.i, actor.id);
    const t0 = unit(attempt.before.units, target.i, target.id), t1 = unit(attempt.after.units, target.i, target.id);
    const mp = skill === 6 ? 20 : 25;
    for (const u of [a0, a1, t0, t1]) {
        for (const k of ['x', 'y', 'state', 'hp', 'mp', 'move', 'arms']) integer(u[k], 0, k === 'hp' || k === 'arms' ? 65535 : 255, 'Actual unit ' + k);
    }
    assert.equal(p.casterMp, a0.mp); assert.equal(a1.mp, a0.mp - mp, 'Actual native MP cost');
    assert.ok(a0.arms > 0 && t0.arms > 0 && a0.mp >= mp);
    same([a1.x, a1.y, a1.hp, a1.move, a1.arms], [a0.x, a0.y, a0.hp, a0.move, a0.arms], 'Spell does not move or damage its caster');
    same([t1.x, t1.y, t1.hp, t1.mp, t1.move], [t0.x, t0.y, t0.hp, t0.mp, t0.move], 'WOOD preserves target position/HP/MP/move');
    assert.ok(t1.state === 0 || t1.state === 8 && (t1.arms === 0 || t1.hp === 0), 'After FgtChkAtkEnd: normal or true native STATE_SW with zero Arms OR zero HP');
    // Fight.c:1464-1469 checks !pos->hp || !per->Arms; HP may remain nonzero when Arms reaches0.
    // The movie/NUM snapshots below still require state0, before that later retirement pass.
    const damage = t0.arms - t1.arms; integer(damage, 1, 65535, 'This acceptance requires actual positive applied arms loss');
    assert.ok(Array.isArray(attempt.movieEvents) && attempt.movieEvents.length === 1, 'One successful native movie event per confirmed skill');
    integer(attempt.movieEvents[0], 1, 0xffffffff, 'Actual event ID');
    return { generation: p.generation, eventId: attempt.movieEvents[0], actor, target, a0, a1, t0, t1, mp, damage };
}

/** The four real synchronous snapshots must own the exact captured metadata and units. */
export function validateWoodCaptureBinding(c, attempt, skill) {
    const f = woodAttemptFacts(attempt, skill), post = c.spe?.active !== 1;
    assert.ok(Number.isFinite(c.at) && c.at >= 0, 'Actual performance timestamp');
    for (const name of ['before', 'after', 'callbackBefore', 'callbackAfter']) {
        assert.ok(c[name], 'Missing real ' + name + ' snapshot');
        same(c[name], metadata(c), 'Captured fields and ' + name + ' are one actual ticket/roster');
    }
    assert.ok(Array.isArray(c.units) && c.units.length === 20, 'Full actual 20-slot roster');
    c.units.forEach((u, i) => { assert.equal(u.i, i); integer(u.id, 0, 65534, 'Actual battle token'); });
    const r = c.result, top = c.top;
    same([r.active, r.protocolVersion, r.custom, r.phase, r.generation, r.skillId, r.actorIndex, r.targetIndex, r.resultKind],
        [true, 1, false, post ? r.phase : 'movie', f.generation, skill, f.actor.i, f.target.i, 1], 'Real transient SKILL owner (ARMS_LOSS), including movie');
    assert.ok(['movie', 'numbers', 'hold'].includes(r.phase)); integer(r.session, 1, 0xffffffff, 'Actual result session');
    same([top.active, top.valid, top.kind, top.generation, top.session], [true, true, 2, f.generation, r.session]);
    assert.equal(c.fight.active, 1); assert.equal(c.fight.over, 0);
    if (post) {
        assert.ok(['numbers', 'hold'].includes(r.phase));
        assert.equal(r.sourceValid, true); assert.equal(r.scene.eventId, f.eventId);
        same([r.scene.generation, r.scene.session], [f.generation, r.session]);
        assert.equal(r.value, f.damage, 'Native result value independently agrees with actual applied damage');
    } else {
        same([c.spe.generation, c.spe.eventId, c.spe.skillId, c.spe.actorIndex, c.spe.targetIndex],
            [f.generation, f.eventId, skill, f.actor.i, f.target.i]);
        assert.equal(r.value, 0, 'Movie precedes actual arms subtraction/number publication');
        // mode3 may lack a valid saved numeric scene until final wide copy. Never invent one.
        if (r.scene?.frameValid) {
            const s = c.spe.display;
            same([r.scene.generation, r.scene.session, r.scene.eventId, r.scene.commitSeq, r.scene.frameIndex],
                [f.generation, r.session, f.eventId, s.commitSeq, s.frameIndex]);
        }
    }
    const actor = unit(c.units, f.actor.i, f.actor.id), target = unit(c.units, f.target.i, f.target.id);
    same([actor.x, actor.y, actor.hp, actor.move, actor.arms, actor.mp],
        [f.a0.x, f.a0.y, f.a0.hp, f.a0.move, f.a0.arms, f.a0.mp - f.mp], 'Movie/post callback observes paid MP and actual caster');
    same([target.x, target.y, target.hp, target.mp, target.move, target.state, target.arms],
        [f.t0.x, f.t0.y, f.t0.hp, f.t0.mp, f.t0.move, 0, post ? f.t1.arms : f.t0.arms],
        'Movie target is still before damage; NUM/hold target has actual applied loss');
    return f;
}

/** Require every genuine native copy; repeated callbacks cannot substitute for a missing copy. */
export function verifyWoodCopyCompleteness(captures, attempt, skill, timeline) {
    const f = woodAttemptFacts(attempt, skill), expected = skill === 6 ? 8 : 1;
    assert.ok(Array.isArray(timeline) && timeline.length === expected, 'Independent actual LIB timer yields exact selected copies');
    const movie = captures.filter(c => c.stage === 'lcd-flush' && c.spe?.active === 1);
    const commits = new Map(); let previous = 0;
    for (const c of movie) {
        validateWoodCaptureBinding(c, attempt, skill);
        const d = c.spe.display;
        assert.ok(d && d.frameValid && c.rawSource === 'lcd-callback-image-data');
        same([d.generation, d.eventId], [f.generation, f.eventId]);
        integer(d.commitSeq, 1, expected, 'No unknown/future native copied commit');
        assert.ok(d.commitSeq >= previous, 'Actual callback order cannot run copied time backwards'); previous = d.commitSeq;
        const wanted = timeline[d.commitSeq - 1];
        same([d.frameIndex, d.composition.width], [wanted.frame, wanted.width]);
        same(d.visibleFrames, Array.from(wanted.visible)); same(d.composition.clearFrames, Array.from(wanted.clears));
        if (commits.has(d.commitSeq)) same(c.nativeRgba, commits.get(d.commitSeq).nativeRgba, 'Duplicate copy ticket cannot change source bytes');
        commits.set(d.commitSeq, c);
    }
    same([...commits.keys()], Array.from({ length: expected }, (_, i) => i + 1), 'All native copies, not only final movie, are mandatory');
    same([...commits.values()].map(c => c.spe.display.frameIndex), Array.from({ length: expected }, (_, i) => i));
    return { skillId: skill, generation: f.generation, eventId: f.eventId, distinctCopies: commits.size,
        commits: [...commits.keys()], frames: [...commits.values()].map(c => c.spe.display.frameIndex),
        widths: [...commits.values()].map(c => c.spe.display.composition.width), callbackCount: movie.length };
}

export function verifyWoodVisibleHd(c) {
    const d = c.dom;
    assert.equal(c.hidden, false); assert.ok(d && d.visible && d.inViewport && d.stackOwned);
    assert.ok(Array.isArray(d.chain) && d.chain.length >= 2 && d.chain[0].id === 'hd-spe-canvas');
    assert.ok(d.chain.some(v => v.id === 'hd-spe'));
    assert.ok(d.chain.every(v => v.display !== 'none' && !['hidden', 'collapse'].includes(v.visibility) && Number(v.opacity) === 1), 'All HD ancestors are fully visible');
    assert.ok([d.x, d.y, d.width, d.height, d.viewport?.width, d.viewport?.height].every(Number.isFinite));
    assert.ok(d.x >= 0 && d.y >= 0 && d.width > 0 && d.height > 0 && d.x + d.width <= d.viewport.width + .5 && d.y + d.height <= d.viewport.height + .5);
    assert.ok(Array.isArray(d.points) && d.points.length === 3 && d.points.every(p => p.stackOwned === true && p.canvasOrStageAtFront === true && p.top && (['hd-spe-canvas', 'hd-spe'].includes(p.top.id) || String(p.top.className || '').split(/\s+/).includes('hd-spe-stage')) && p.x >= d.x && p.x <= d.x + d.width && p.y >= d.y && p.y <= d.y + d.height), 'Three actual HD canvas points own the stack');
}

/** All four outside strips, or the full fallback canvas, use actual nearest LCD RGBA. */
export function verifyWoodPhysicalLcd(image, native, scale, region = null) {
    integer(scale, 1, 16, 'Actual integer SPE canvas scale');
    same([image.width, image.height, native.length], [160 * scale, 96 * scale, 160 * 96 * 4]);
    if (region) same([region.x, region.y, region.height], [48, 16, 64]);
    if (region) assert.ok([64, 66].includes(region.width));
    const strips = { top: 0, bottom: 0, left: 0, right: 0, full: 0 };
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const lx = Math.floor(x / scale), ly = Math.floor(y / scale);
        if (region && lx >= region.x && lx < region.x + region.width && ly >= region.y && ly < region.y + region.height) continue;
        const p = (y * image.width + x) * 4, q = (ly * 160 + lx) * 4;
        for (let ch = 0; ch < 4; ch++) assert.equal(image.rgba[p + ch], native[q + ch], 'Every physical external/fallback pixel is actual LCD');
        if (!region) strips.full++;
        else if (ly < region.y) strips.top++;
        else if (ly >= region.y + region.height) strips.bottom++;
        else if (lx < region.x) strips.left++;
        else strips.right++;
    }
    if (region) assert.ok(['top', 'bottom', 'left', 'right'].every(k => strips[k] > 0));
    return strips;
}
