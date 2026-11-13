#!/usr/bin/env node
/** Campaign input evidence survives a simulated document replacement without duplication. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./test-hd-campaign-runtime.mjs', import.meta.url), 'utf8');
const start = source.indexOf('function engineInputRecorderExpression(');
const end = source.indexOf('async function smoke(', start);
assert.ok(start >= 0 && end > start, 'the campaign runner exposes its document input recorder helpers');
const helpers = source.slice(start, end);
assert.match(helpers, /\b(?:let|var|const)\s+nextEngineInputDocument\b/, 'the real runner declares its input document counter');
const plain = value => value === undefined ? undefined : structuredClone(value);
let groups = 0;

function harness() {
    const report = {}, documents = [];
    let current;
    const cdp = {
        async send(method, params) {
            assert.equal(method, 'Runtime.evaluate', 'telemetry uses only page evaluation');
            assert.equal(params.returnByValue, true);
            assert.equal(params.awaitPromise, true);
            try {
                return { result: { value: plain(await vm.runInContext(params.expression, current.context)) } };
            } catch (error) {
                return { exceptionDetails: { text: String(error), exception: { description: error.stack } } };
            }
        }
    };
    const runner = vm.createContext({ assert, report, console });
    runner.evaluate = async (client, expression) => {
        const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result?.value;
    };
    vm.runInContext(helpers + `\n globalThis.telemetry = {
        install: installEngineInputRecorder, archive: archiveEngineInputDocument,
        expression: engineInputDocumentExpression, recorderExpression: engineInputRecorderExpression
    };`, runner, { filename: 'campaign-runtime-telemetry-helpers.js' });

    function newDocument() {
        const calls = [], result = { nativeReturn: documents.length + 1 };
        const fight = { inputKind: 1, inputSeq: 7 };
        const march = { phase: 4, inputSeq: 11, session: 3 };
        const original = function (...args) {
            calls.push({ receiver: this, args });
            if (args[0] === 999) throw new Error('native input failure');
            return result;
        };
        const context = vm.createContext({ console, sendKey: original,
            baye: { hd: { fight: () => fight, march: () => march } } });
        context.window = context;
        current = { context, calls, result, fight, march, original };
        documents.push(current);
        return current;
    }
    newDocument();
    return { report, cdp, documents, newDocument,
        install: () => runner.telemetry.install(cdp),
        archive: label => runner.telemetry.archive(cdp, label),
        read: () => runner.evaluate(cdp, runner.telemetry.expression),
        current: () => current };
}

async function check(name, run) {
    await run();
    groups += 1;
    console.log('ok ' + groups + ' - ' + name);
}

await check('installation creates an empty recorder owned by the current document', async () => {
    const h = harness(), page = h.current();
    await h.install();
    const recorder = page.context.__runtimeEngineInputRecorder;
    assert.ok(recorder && recorder.documentId != null);
    assert.equal(recorder.wrapper, page.context.sendKey);
    assert.equal(recorder.inputs, page.context.__runtimeEngineInputs);
    assert.equal(recorder.inputs.length, 0);
    assert.notEqual(page.context.sendKey, page.original);
    assert.equal((await h.read()).documentId, recorder.documentId);
});

await check('the wrapper preserves the native receiver, every argument, return value and error', async () => {
    const h = harness(), page = h.current(), receiver = { nativeReceiver: true }, argument = { payload: true };
    await h.install();
    const returned = page.context.sendKey.call(receiver, 39, 'extra', argument);
    assert.equal(returned, page.result);
    assert.equal(page.calls[0].receiver, receiver);
    assert.deepEqual(page.calls[0].args, [39, 'extra', argument]);
    assert.equal(page.calls[0].args[2], argument);
    assert.throws(() => page.context.sendKey.call(receiver, 999), /native input failure/);
    assert.equal(page.calls.length, 2);
    const inputs = plain(page.context.__runtimeEngineInputs);
    assert.deepEqual(inputs.map(i => i.code), [39, 999]);
    assert.equal(inputs[0].fightKind, 1);
    assert.equal(inputs[0].fightSeq, 7);
    assert.equal(inputs[0].marchPhase, 4);
    assert.equal(inputs[0].marchSeq, 11);
    assert.equal(inputs[0].marchSession, 3);
});

await check('reinstallation in one document retains one wrapper and its existing evidence', async () => {
    const h = harness(), page = h.current();
    await h.install();
    page.context.sendKey(13);
    const wrapper = page.context.sendKey, recorder = page.context.__runtimeEngineInputRecorder;
    await h.install();
    assert.equal(page.context.sendKey, wrapper);
    assert.equal(page.context.__runtimeEngineInputRecorder, recorder);
    page.context.sendKey(35);
    assert.deepEqual(plain(recorder.inputs).map(i => i.code), [13, 35]);
    assert.equal(page.calls.length, 2, 'the original receives each input exactly once');
});

await check('a refresh archives both documents and records fresh native inputs in the new page', async () => {
    const h = harness(), first = h.current();
    await h.install();
    first.context.sendKey(13);
    first.context.sendKey(35);
    await h.archive('before-refresh');
    const firstId = first.context.__runtimeEngineInputRecorder.documentId;
    const second = h.newDocument();
    assert.equal(second.context.__runtimeEngineInputRecorder, undefined);
    await h.install();
    const secondId = second.context.__runtimeEngineInputRecorder.documentId;
    assert.notEqual(secondId, firstId, 'a new page owns a different input document');
    second.fight.inputKind = 0;
    second.fight.inputSeq = 0;
    second.context.sendKey(39);
    second.context.sendKey(40);
    await h.archive('after-refresh');
    const records = plain(h.report.engineInputDocuments);
    assert.deepEqual(records.map(d => d.documentId), [firstId, secondId]);
    assert.deepEqual(records.map(d => d.inputs.map(i => i.code)), [[13, 35], [39, 40]]);
    assert.deepEqual(records.map(d => d.checkpoints), [
        [{ label: 'before-refresh', count: 2 }], [{ label: 'after-refresh', count: 2 }]
    ]);
    assert.deepEqual(plain(h.report.engineInputs).map(i => i.code), [13, 35, 39, 40]);
    assert.equal(records[1].inputs[0].fightKind, 0, 'raw input on a fresh page is preserved');
    assert.equal(records[1].inputs[0].fightSeq, 0);
    assert.equal(first.calls.length, 2);
    assert.equal(second.calls.length, 2);
});

await check('repeated archives update one document and extend its unchanged prefix once', async () => {
    const h = harness(), page = h.current();
    await h.install();
    page.context.sendKey(13);
    await h.archive('first');
    const firstEvidence = plain(h.report.engineInputDocuments[0].inputs);
    await h.archive('same-inputs');
    page.context.sendKey(35);
    await h.archive('extended');
    assert.equal(h.report.engineInputDocuments.length, 1);
    const record = plain(h.report.engineInputDocuments[0]);
    assert.deepEqual(record.inputs.slice(0, 1), firstEvidence);
    assert.deepEqual(record.inputs.map(i => i.code), [13, 35]);
    assert.deepEqual(plain(h.report.engineInputs).map(i => i.code), [13, 35]);
    assert.deepEqual(record.checkpoints, [
        { label: 'first', count: 1 }, { label: 'same-inputs', count: 1 }, { label: 'extended', count: 2 }
    ]);
});

await check('a missing input array rejects archival instead of fabricating an empty log', async () => {
    for (const mutate of [
        page => vm.runInContext('window.__runtimeEngineInputs = undefined', page.context),
        page => vm.runInContext('window.__runtimeEngineInputRecorder.inputs = undefined', page.context)
    ]) {
        const h = harness(), page = h.current();
        await h.install();
        page.context.sendKey(13);
        await h.archive('valid');
        const evidence = plain(h.report);
        mutate(page);
        await assert.rejects(h.archive('missing-array'));
        assert.deepEqual(plain(h.report), evidence, 'failed archival does not erase recorded evidence');
    }
});

await check('a missing recorder or changed sendKey owner rejects collection without rewriting evidence', async () => {
    for (const expression of [
        'window.__runtimeEngineInputRecorder = undefined',
        'window.sendKey = function () {}'
    ]) {
        const h = harness(), page = h.current();
        await h.install();
        page.context.sendKey(13);
        await h.archive('valid');
        const evidence = plain(h.report);
        vm.runInContext(expression, page.context);
        await assert.rejects(h.archive('invalid-owner'));
        assert.deepEqual(plain(h.report), evidence);
    }
});

await check('modifying an already archived prefix is rejected and preserves the trusted archive', async () => {
    const h = harness(), page = h.current();
    await h.install();
    page.context.sendKey(13);
    page.context.sendKey(35);
    await h.archive('valid');
    const evidence = plain(h.report);
    page.context.__runtimeEngineInputs[0].code = 40;
    await assert.rejects(h.archive('mutated-prefix'));
    assert.deepEqual(plain(h.report), evidence);
});

await check('truncating an already archived input document is rejected', async () => {
    const h = harness(), page = h.current();
    await h.install();
    page.context.sendKey(13);
    page.context.sendKey(35);
    await h.archive('valid');
    const evidence = plain(h.report);
    page.context.__runtimeEngineInputs.pop();
    await assert.rejects(h.archive('truncated-prefix'));
    assert.deepEqual(plain(h.report), evidence);
});

console.log('Campaign document input telemetry passed: ' + groups + ' groups');
