// Pure file fixtures retained under build/. No browser/process calls or directory deletion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {writeJsonAtomicSync, writeReportAtomicSync, readCampaignObservations} from './hd-runtime-json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fixtureRoot;
function fixture(name) {
  if (!fixtureRoot) {
    fs.mkdirSync(path.join(root, 'build'), {recursive: true});
    fixtureRoot = fs.mkdtempSync(path.join(root, 'build', 'r34-runtime-json-test-'));
  }
  return path.join(fixtureRoot, name);
}
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const drain = async (directory, ref) => {
  const rows = [];
  for await (const row of readCampaignObservations(directory, ref)) rows.push(row);
  return rows;
};

test('JSON output preserves actual Unicode/escape values across string and buffer boundaries', () => {
  const value = {name: '三国霸业', boundary: 'a'.repeat(8191) + '😀' + '界'.repeat(9000),
    escapes: '\\"\n\r\t\0\b', loneSurrogate: '\ud800', tail: '𠀀'};
  const file = fixture('unicode.json'), proof = writeJsonAtomicSync(file, value, {maxChunkBytes: 31});
  const expected = Buffer.from(JSON.stringify(value, null, 2) + '\n'), actual = fs.readFileSync(file);
  assert.deepEqual(actual, expected);
  assert.deepEqual(read(file), value);
  assert.equal(proof.bytes, actual.length);
  assert.equal(proof.sha256, digest(actual));
});

test('supported JSON omission/null/toJSON/boxed semantics remain byte-identical to native stringify', () => {
  const value = {skip: undefined, fn: () => 1, symbol: Symbol('x'), array: [undefined, () => 1, Symbol('x'), NaN, Infinity, -0],
    number: new Number(3), string: new String('原版'), boolean: new Boolean(false),
    date: new Date('2026-10-11T00:00:00Z'), bytes: Buffer.from([0, 255]),
    keyed: {toJSON(key) { return {key, actual: 5}; }}};
  const file = fixture('json-semantics.json');
  writeJsonAtomicSync(file, value);
  assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(value, null, 2) + '\n');
});

test('shared references serialize independently rather than being mistaken for a cycle', () => {
  const shared = {actual: [1, 2, 3]}, value = {left: shared, right: shared}, file = fixture('shared.json');
  writeJsonAtomicSync(file, value);
  assert.deepEqual(read(file), {left: {actual: [1, 2, 3]}, right: {actual: [1, 2, 3]}});
});

test('writes are aggregated into bounded blocks rather than one sync write per JSON token', () => {
  const file = fixture('bounded.json'), value = Array.from({length: 2000}, (_, i) => ({i, name: '人物' + i, raw: [i, true]}));
  const proof = writeJsonAtomicSync(file, value, {maxChunkBytes: 4096});
  assert.equal(proof.writes, Math.ceil(proof.bytes / 4096));
  assert.ok(proof.largestWriteBytes <= 4096);
  assert.ok(proof.writes < value.length);
  assert.equal(proof.sha256, digest(fs.readFileSync(file)));
  assert.deepEqual(read(file), value);
});

test('existing output is never overwritten and no new partial is opened', () => {
  const file = fixture('existing.json');fs.writeFileSync(file, 'original', {flag: 'wx'});
  const before = fs.readdirSync(fixtureRoot).sort();
  assert.throws(() => writeJsonAtomicSync(file, {replaced: true}), /Refusing to overwrite/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'original');
  assert.deepEqual(fs.readdirSync(fixtureRoot).sort(), before);
});

test('exclusive publication rejects a target created during serialization without overwriting it', () => {
  const file = fixture('publication-race.json');
  const value = {get actual() { fs.writeFileSync(file, 'other publisher', {flag: 'wx'});return 1; }};
  let failure;
  try { writeJsonAtomicSync(file, value); } catch (error) { failure = error; }
  assert.ok(failure);
  assert.equal(failure.code, 'EEXIST');
  assert.equal(fs.readFileSync(file, 'utf8'), 'other publisher');
  assert.deepEqual(read(failure.partialFile), {actual: 1});
});

test('circular data leaves retained incomplete evidence and never publishes a result', () => {
  const file = fixture('cycle.json'), value = {before: 'preserved'};value.self = value;
  let failure;
  try { writeJsonAtomicSync(file, value, {maxChunkBytes: 16}); } catch (error) { failure = error; }
  assert.match(failure.message, /circular/);
  assert.equal(fs.existsSync(file), false);
  assert.ok(fs.existsSync(failure.partialFile));
});

test('getter error and BigInt fail without publishing or discarding the partial file', () => {
  for (const [name, value, message] of [
    ['getter.json', {get actual() { throw Error('native read failed'); }}, /native read failed/],
    ['bigint.json', {actual: 1n}, /BigInt/],
  ]) {
    const file = fixture(name);let failure;
    try { writeJsonAtomicSync(file, value); } catch (error) { failure = error; }
    assert.match(failure.message, message);
    assert.equal(fs.existsSync(file), false);
    assert.ok(fs.existsSync(failure.partialFile));
  }
});

test('invalid chunk/sidecar thresholds reject before writing any output', () => {
  for (const maxChunkBytes of [15, 1048577, 16.5, NaN]) {
    const file = fixture('invalid-chunk-' + String(maxChunkBytes) + '.json');
    assert.throws(() => writeJsonAtomicSync(file, {}, {maxChunkBytes}), RangeError);
    assert.equal(fs.existsSync(file), false);
  }
  const file = fixture('invalid-threshold.json');
  assert.throws(() => writeReportAtomicSync(file, {}, {campaignThresholdItems: 0}), RangeError);
  assert.equal(fs.existsSync(file), false);
});

test('small campaigns remain inline with all approval and public-save structures unchanged', () => {
  const file = fixture('inline.json'), report = {campaignObservations: [{actual: 1}],
    publicSave: {slot: 0, files: [{bytes: 8221, sha256: 'original'}]}, publicCheckpoints: [{tag: 'month-003'}],
    actualAcquisition: {personIndex: 130}, sourceVerification: {ok: true}};
  const original = structuredClone(report), proof = writeReportAtomicSync(file, report);
  assert.equal(proof.campaignObservations, null);
  assert.deepEqual(read(file), original);
  assert.deepEqual(report, original);
});

test('threshold campaign writes every original row in order with an explicit exact sidecar reference', async () => {
  const file = fixture('sidecar.json'), report = {campaignObservations: Array.from({length: 128}, (_, i) => ({i, raw: '原始😀\n' + i})),
    publicSave: {files: [1, 2]}, publicCheckpoints: [{tag: 'complete'}], actualAcquisition: {personIndex: 130}};
  const original = structuredClone(report), proof = writeReportAtomicSync(file, report, {maxChunkBytes: 127});
  const main = read(file), ref = main.campaignObservations, sidecar = fs.readFileSync(path.join(fixtureRoot, ref.ref));
  assert.equal(Array.isArray(ref), false);
  assert.equal(ref.storage, 'ndjson');
  assert.equal(ref.count, 128);
  assert.equal(ref.bytes, sidecar.length);
  assert.equal(ref.sha256, digest(sidecar));
  assert.equal(sidecar.toString('utf8'), original.campaignObservations.map(x => JSON.stringify(x) + '\n').join(''));
  assert.deepEqual(await drain(fixtureRoot, ref), original.campaignObservations);
  for (const key of ['publicSave', 'publicCheckpoints', 'actualAcquisition']) assert.deepEqual(main[key], original[key]);
  assert.deepEqual(report, original);
  assert.equal(proof.campaignObservations.sha256, ref.sha256);
});

test('fully draining a sidecar rejects wrong count/bytes/SHA instead of accepting a readable prefix', async () => {
  const file = fixture('sidecar-negative.json');
  writeReportAtomicSync(file, {campaignObservations: [{i: 1}, {i: 2}]}, {campaignThresholdItems: 1});
  const ref = read(file).campaignObservations;
  for (const wrong of [{...ref, count: ref.count + 1}, {...ref, bytes: ref.bytes + 1}, {...ref, sha256: '0'.repeat(64)}]) {
    await assert.rejects(drain(fixtureRoot, wrong), /count\/bytes\/SHA mismatch/);
  }
});

test('altered valid JSON row is rejected by its original sidecar hash', async () => {
  const file = fixture('sidecar-tamper.json');
  writeReportAtomicSync(file, {campaignObservations: [{i: 1}]}, {campaignThresholdItems: 1});
  const ref = read(file).campaignObservations;
  fs.writeFileSync(path.join(fixtureRoot, ref.ref), '{"i":2}\n');
  await assert.rejects(drain(fixtureRoot, ref), /count\/bytes\/SHA mismatch/);
});

test('sidecar traversal and malformed/empty row are rejected', async () => {
  await assert.rejects(drain(fixtureRoot, {storage: 'ndjson', ref: '../outside.ndjson'}), /Invalid campaign sidecar/);
  await assert.rejects(drain(fixtureRoot, {storage: 'inline', ref: 'bad.ndjson'}), /Invalid campaign sidecar/);
  for (const [name, data] of [['empty.ndjson', '\n'], ['malformed.ndjson', '{bad}\n']]) {
    fs.writeFileSync(fixture(name), data, {flag: 'wx'});
    await assert.rejects(drain(fixtureRoot, {storage: 'ndjson', ref: name, bytes: Buffer.byteLength(data), count: 1, sha256: digest(data)}));
  }
});

test('failed main publication preserves its complete sidecar but cannot masquerade as a complete report', () => {
  const file = fixture('failed-main.json'), report = {campaignObservations: [{actual: 1}]};report.circular = report;
  let failure;
  try { writeReportAtomicSync(file, report, {campaignThresholdItems: 1}); } catch (error) { failure = error; }
  assert.match(failure.message, /circular/);
  assert.equal(fs.existsSync(file), false);
  assert.ok(fs.existsSync(failure.partialFile));
  assert.equal(fs.readFileSync(file + '.campaignObservations.ndjson', 'utf8'), '{"actual":1}\n');
});
