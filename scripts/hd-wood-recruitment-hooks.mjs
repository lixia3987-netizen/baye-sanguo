import assert from 'node:assert/strict';

export const RECRUITMENT_HOOK_NAMES = Object.freeze(['cityMakeCommand', 'willAddOrder', 'getMaxArms']);
export const RECRUITMENT_CITY_MAKE_SOURCE = 'function () { return -1; }';
export const RECRUITMENT_CALL_HOOK_SOURCE = [
    'function (name, context) {',
    '            try {',
    '                onHook(name, context);',
    '            } catch (e) {',
    "                console.warn('[hd-overworld] hook', name, e);",
    '            }',
    '            var rv = orig.apply(this, arguments);',
    "            if (name === 'cityMakeCommand' && (rv === undefined || rv === 0 || rv === null)) {",
    '                return -1;',
    '            }',
    '            return rv;',
    '        }'
].join('\n');

const namespace = 'wood-recruitment-hooks-v1';
const sourceFlags = () => ({sourceOnly: true, publicInputAccepted: false, actualCostAccepted: false,
    actualRecruitmentAccepted: false, actualNativeReturnAccepted: false, actualCastAccepted: false,
    actualClassicAccepted: false, hdAccepted: false, globalHdComplete: false});
const object = (v, label) => assert.ok(v && typeof v === 'object' && !Array.isArray(v), label);
const positiveRef = (v, label) => assert.ok(Number.isSafeInteger(v) && v > 0, label);

/** A source/read-only fence, not an authorization to execute a command. */
export function verifyRecruitmentHookFence({meta} = {}) {
    object(meta, 'Complete actual meta');
    const fence = meta.recruitmentHookFence, legacy = meta.v32HookFence;
    object(fence, 'Actual recruitment hook view');
    object(legacy, 'Existing complete hook view');
    assert.equal(fence.readOnly, true);
    assert.equal(fence.referenceNamespace, namespace);
    assert.ok(Array.isArray(fence.hooks));
    assert.deepEqual(fence.hooks.map(h => h?.name), RECRUITMENT_HOOK_NAMES, 'Exact three current hook rows');
    assert.equal(legacy.readOnly, true);
    assert.ok(Array.isArray(legacy.hooks));
    const call = fence.callHook;
    object(call, 'Actual stock callHook view');
    assert.equal(call.type, 'function');
    positiveRef(call.functionRef, 'Stock callHook reference');
    // Retain raw source in the view. Only the two literal LF/CRLF stock forms are valid.
    assert.ok(call.functionSource === RECRUITMENT_CALL_HOOK_SOURCE ||
        call.functionSource === RECRUITMENT_CALL_HOOK_SOURCE.replaceAll('\n', '\r\n'), 'Exact stock callHook source');
    for (const row of fence.hooks) {
        object(row, 'Hook row');
        assert.equal(typeof row.present, 'boolean');
        if (row.name === 'cityMakeCommand' && row.present) {
            assert.equal(row.type, 'function');
            assert.equal(row.functionSource, RECRUITMENT_CITY_MAKE_SOURCE, 'Only the stock return-minus-one hook');
            positiveRef(row.functionRef, 'Stock cityMakeCommand reference');
            assert.notEqual(row.functionRef, call.functionRef, 'Distinct stock functions have distinct references');
        } else {
            assert.equal(row.present, false, row.name + ' cannot take over native command');
            assert.equal(row.type, 'undefined');
            assert.equal(row.functionSource, null);
            assert.equal(row.functionRef, null);
        }
        if (row.name !== 'cityMakeCommand') {
            const matches = legacy.hooks.filter(h => h?.name === row.name);
            assert.equal(matches.length, 1, 'One corresponding existing hook row');
            assert.equal(matches[0].present, row.present, 'Same live hook in both views');
            assert.equal(matches[0].type, row.type);
        }
    }
    return {hookFenceMatches: true, stockCityHookPresent: fence.hooks[0].present, ...sourceFlags()};
}

export function verifyRecruitmentHookFenceStable({beforeMeta, afterMeta} = {}) {
    verifyRecruitmentHookFence({meta: beforeMeta});
    verifyRecruitmentHookFence({meta: afterMeta});
    assert.deepEqual(afterMeta.recruitmentHookFence, beforeMeta.recruitmentHookFence,
        'Complete hook source/reference/unknown diagnostics stay exact across the edge');
    return {hookFenceStable: true, ...sourceFlags()};
}

/** Installs one diagnostic getter. It neither invokes nor replaces any native/product hook. */
export const recruitmentHooksObserverSource = '(' + function () {
    if (Object.prototype.hasOwnProperty.call(window, '__woodRecruitmentReadHookFence')) {
        throw Error('Recruitment hook observer already installed');
    }
    const refs = new WeakMap();
    let serial = 0;
    const ref = fn => {
        if (!refs.has(fn)) refs.set(fn, ++serial);
        return refs.get(fn);
    };
    const describe = (fn, name) => ({name, present: typeof fn !== 'undefined', type: typeof fn,
        functionSource: typeof fn === 'function' ? Function.prototype.toString.call(fn) : null,
        functionRef: typeof fn === 'function' ? ref(fn) : null});
    Object.defineProperty(window, '__woodRecruitmentReadHookFence', {
        configurable: false, writable: false,
        value: () => {
            const engine = window.baye;
            if (!engine || !engine.hooks || typeof engine.hooks !== 'object') throw Error('Missing current engine hooks');
            const call = describe(engine.callHook, 'callHook');
            return {readOnly: true, referenceNamespace: 'wood-recruitment-hooks-v1',
                hooks: ['cityMakeCommand', 'willAddOrder', 'getMaxArms'].map(name => describe(engine.hooks[name], name)),
                callHook: {type: call.type, functionSource: call.functionSource, functionRef: call.functionRef}};
        }
    });
} + ')();';
