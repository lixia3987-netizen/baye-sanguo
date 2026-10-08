import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';

const source = readFileSync(new URL('../js/hd-lib-identity.js', import.meta.url), 'utf8');
const dictionary = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
const dictionaryHash = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
function load(overrides = {}) {
  const window = { crypto: webcrypto, ...overrides };
  vm.runInNewContext(source, { window, Uint8Array, Object, TypeError, parseInt });
  return { window, api: window.BayeHdLibIdentity };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
async function ready(identity) {
  for (let i = 0; i < 100; i++) {
    const snapshot = identity.read();
    if (snapshot.status !== 'pending') return snapshot;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error('LIB identity did not settle');
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const hashBuffer = bytes => webcrypto.subtle.digest('SHA-256', bytes);

test('actual dictionary bytes verify with the engine Promise replacement and an unrelated preferred path', async () => {
  const { api } = load({ dynLib: dictionary.toString('hex'),
    Promise: function EnginePromise() { throw new Error('engine Promise must not be constructed'); },
    localStorage: { getItem() { throw new Error('preferred paths are not content'); } } });
  assert.equal(api.read().status, 'pending');
  const actual = await ready(api);
  assert.equal(actual.status, 'ready');
  assert.equal(actual.sha256, dictionaryHash);
  assert.equal(actual.byteLength, dictionary.length);
  assert.equal(api.isCurrent(actual), true);
  assert.equal(Object.isFrozen(actual), true);
});

test('same preferred path and a one-byte changed LIB produce different identities', async () => {
  const { api, window } = load({ dynLib: dictionary.toString('hex') });
  const first = await ready(api);
  const changed = Buffer.from(dictionary); changed[changed.length - 1] ^= 1;
  window.dynLib = changed.toString('hex');
  assert.equal(api.isCurrent(first), false);
  const second = await ready(api);
  assert.equal(second.status, 'ready');
  assert.equal(second.generation, first.generation + 1);
  assert.equal(second.sha256, createHash('sha256').update(changed).digest('hex'));
  assert.notEqual(second.sha256, dictionaryHash);
});

test('repeated reads and subscriptions share one digest for each actual byte source', async () => {
  const { api } = load();
  let hex = '00ff', calls = 0;
  const notices = [];
  const identity = api.createIdentity({ getHex: () => hex, digest(bytes) { calls++; return hashBuffer(bytes); } });
  const unsubscribe = identity.subscribe(state => notices.push(state));
  assert.equal(notices.length, 0);
  const pending = identity.read();
  for (let i = 0; i < 20; i++) identity.read();
  const first = await ready(identity);
  assert.equal(identity.isCurrent(pending), false);
  assert.equal(calls, 1);
  assert.deepEqual(notices.map(state => state.status), ['pending', 'ready']);
  unsubscribe(); unsubscribe();
  hex = 'fe'; await ready(identity);
  assert.equal(calls, 2);
  assert.equal(notices.length, 2);
  assert.equal(identity.isCurrent(first), false);
});

test('stale success retires itself after an unobserved LIB switch', async () => {
  const { api } = load();
  let hex = '01'; const jobs = [];
  const identity = api.createIdentity({ getHex: () => hex, digest(bytes) {
    const job = deferred(); jobs.push({ ...job, bytes }); return job.promise;
  } });
  const old = identity.read();
  hex = '02';
  jobs[0].resolve(await hashBuffer(jobs[0].bytes));
  await settle();
  assert.equal(jobs.length, 2);
  assert.equal(identity.read().status, 'pending');
  assert.equal(identity.isCurrent(old), false);
  jobs[1].resolve(await hashBuffer(jobs[1].bytes)); await settle();
  const current = identity.read();
  assert.equal(current.sha256, createHash('sha256').update(Buffer.from([2])).digest('hex'));
  assert.equal(current.generation, old.generation + 1);
});

test('late rejection cannot overwrite the newer ready identity', async () => {
  const { api } = load();
  let hex = '01'; const jobs = [];
  const identity = api.createIdentity({ getHex: () => hex, digest() {
    const job = deferred(); jobs.push(job); return job.promise;
  } });
  identity.read(); hex = '02'; identity.read();
  jobs[1].resolve(await hashBuffer(new Uint8Array([2]))); await settle();
  const current = identity.read();
  jobs[0].reject(new Error('old request failed')); await settle();
  assert.equal(identity.read(), current);
  assert.equal(current.status, 'ready');
});

test('malformed, absent, oversized and failed reads stay untrusted and can recover', async () => {
  const { api } = load();
  let hex, throwing = false, calls = 0;
  const identity = api.createIdentity({ getHex() { if (throwing) throw new Error('unavailable'); return hex; },
    digest(bytes) { calls++; return hashBuffer(bytes); } });
  assert.equal(identity.read().status, 'unavailable');
  for (const value of [null, '', undefined]) { hex = value; assert.equal(identity.read().status, 'unavailable'); }
  for (const value of ['0', 'gg', {}, 0, new Uint8Array([1])]) {
    hex = value; assert.equal(identity.read().reason, 'invalid-lib-data');
  }
  hex = 'a'.repeat(64 * 1024 * 1024 + 2);
  assert.equal(identity.read().reason, 'lib-too-large');
  assert.equal(calls, 0);
  throwing = true;
  const failed = identity.read();
  assert.equal(failed.reason, 'lib-read-failed');
  assert.equal(identity.read(), failed);
  throwing = false; hex = 'AbCD';
  assert.equal((await ready(identity)).sha256, createHash('sha256').update(Buffer.from('abcd', 'hex')).digest('hex'));
  assert.equal(calls, 1);
});

test('missing crypto, digest rejection and malformed digests never publish ready', async () => {
  assert.equal(load({ dynLib: 'aa', crypto: null }).api.read().reason, 'lib-verification-unavailable');
  const { api } = load();
  for (const digest of [() => { throw new Error('failure'); }, () => Promise.reject(new Error('failure')),
    () => Promise.resolve(new ArrayBuffer(31)), () => Promise.resolve(new Uint8Array(32)),
    () => Promise.resolve('0'.repeat(64))]) {
    const identity = api.createIdentity({ getHex: () => 'aa', digest });
    const result = await ready(identity);
    assert.equal(result.status, 'error');
    assert.equal(result.sha256, null);
    assert.equal(result.reason, 'lib-verification-failed');
  }
});

test('one consumer cannot mutate identity or prevent other consumers from retiring work', async () => {
  const { api } = load();
  let hex = '01'; const noticed = [];
  const identity = api.createIdentity({ getHex: () => hex, digest: hashBuffer });
  identity.subscribe(state => { state.sha256 = 'forged'; });
  identity.subscribe(state => { noticed.push(state.status); });
  const first = await ready(identity);
  assert.deepEqual(noticed, ['pending', 'ready']);
  assert.notEqual(first.sha256, 'forged');
  hex = undefined;
  assert.equal(identity.isCurrent(first), false);
  assert.equal(identity.read().status, 'unavailable');
  assert.equal(noticed.at(-1), 'unavailable');
});

test('reentrant consumer switching the LIB leaves the newest generation authoritative', async () => {
  const { api } = load();
  let hex = '01';
  const identity = api.createIdentity({ getHex: () => hex, digest: hashBuffer });
  identity.subscribe(state => {
    if (state.status === 'pending' && hex === '01') { hex = '02'; identity.read(); }
  });
  const current = await ready(identity);
  assert.equal(current.generation, 2);
  assert.equal(current.sha256, createHash('sha256').update(Buffer.from([2])).digest('hex'));
});
