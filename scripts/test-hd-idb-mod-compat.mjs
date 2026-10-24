import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sdk = readFileSync(new URL('../js/idbkvstore.min.js', import.meta.url), 'utf8');
const nativeDefinitions = readFileSync(new URL('../vendor/iBaye/src/baye/consdef.h', import.meta.url), 'utf8');
const nativeLoader = readFileSync(new URL('../vendor/iBaye/src/datman.c', import.meta.url), 'utf8');
const modLibrary = readFileSync(new URL('../libs/sc-mod.lib', import.meta.url));
// Use the actual Mod ENGINE_SCRIPT resource. Do not execute the rest of the
// game script or alter its enumerable Array prototype definitions.
const scriptId = Number(nativeDefinitions.match(/#define\s+ENGINE_SCRIPT\s+(\d+)/)[1]);
const scriptOffset = modLibrary.readUInt32LE((scriptId - 1) * 4);
const resourceLength = modLibrary.readUInt32LE(scriptOffset);
assert.ok(scriptOffset > 0 && scriptOffset + resourceLength <= modLibrary.length);
assert.equal(modLibrary.readUInt16LE(scriptOffset + 4), scriptId);
const scriptEnd = modLibrary.indexOf(0, scriptOffset + 14);
assert.ok(scriptEnd >= scriptOffset + 14 && scriptEnd < scriptOffset + resourceLength);
const modScript = modLibrary.subarray(scriptOffset + 14, scriptEnd).toString('utf8');
const prototypeStart = modScript.indexOf('Array.prototype.has = Array.prototype.includes;');
const prototypeEnd = modScript.indexOf('ChooseMid = function', prototypeStart);
assert.ok(prototypeStart >= 0 && prototypeEnd > prototypeStart);
const actualPrototypeStatements = modScript.slice(prototypeStart, prototypeEnd);
const modMethods = ['has', 'max', 'min', 'sum', 'avg', 'RMValue'];

function fakeIndexedDB(seed = []) {
  const records = new Map(seed);
  const opens = [];
  const databases = [];
  const transactions = [];
  const jobs = [];
  const calls = [];
  const event = (target) => ({ target, prevented: 0, stopped: 0,
    preventDefault() { this.prevented++; }, stopPropagation() { this.stopped++; } });
  function database(name) {
    const db = { name, closeCount: 0, stores: [],
      createObjectStore(store, options) { this.stores.push({ store, options }); },
      close() { this.closeCount++; },
      transaction(store, mode) {
        assert.equal(store, 'kv');
        assert.ok(mode === 'readonly' || mode === 'readwrite');
        const tx = { mode, completed: false,
          objectStore(storeName) { assert.equal(storeName, 'kv'); return objectStore; },
          abort() { jobs.push(() => failTransaction(tx, new Error('IDB transaction aborted'), 'onabort')); }
        };
        function request(method, key, value, operation) {
          const req = {};
          calls.push({ method, key, value, mode });
          jobs.push(() => {
            if (tx.completed) return;
            req.result = operation();
            if (req.onsuccess) req.onsuccess(event(req));
          });
          return req;
        }
        const objectStore = { transaction: tx,
          put(value, key) { return request('put', key, value, () => { records.set(key, value); return key; }); },
          add(value, key) { return request('add', key, value, () => { records.set(key, value); return key; }); },
          get(key) { return request('get', key, undefined, () => records.get(key)); },
          delete(key) { return request('delete', key, undefined, () => records.delete(key)); },
          clear() { return request('clear', undefined, undefined, () => records.clear()); },
          count(key) { return request('count', key, undefined, () => key == null ? records.size : Number(records.has(key))); }
        };
        transactions.push(tx);
        return tx;
      }
    };
    databases.push(db);
    return db;
  }
  function openSuccess(index = 0) {
    const req = opens[index];
    req.result = database(req.name);
    if (req.onupgradeneeded) req.onupgradeneeded(event(req));
    req.onsuccess(event(req));
    return req.result;
  }
  function openFailure(error, index = 0) {
    const req = opens[index];
    req.error = error;
    const e = event(req);
    req.onerror(e);
    return e;
  }
  function failTransaction(tx, error, handler = 'onerror') {
    tx.error = error;
    tx.completed = true;
    const e = event(tx);
    if (tx[handler]) tx[handler](e);
    return e;
  }
  function settle() {
    while (jobs.length) jobs.shift()();
    for (const tx of transactions) {
      if (!tx.completed) {
        tx.completed = true;
        if (tx.oncomplete) tx.oncomplete(event(tx));
      }
    }
  }
  return { indexedDB: { open(name) { const req = { name }; opens.push(req); return req; } },
    opens, databases, transactions, records, calls, openSuccess, openFailure, failTransaction, settle };
}

function harness({ mod = true, seed = [] } = {}) {
  const idb = fakeIndexedDB(seed);
  const window = { indexedDB: idb.indexedDB };
  const context = vm.createContext({ window, console });
  vm.runInContext(sdk, context, { filename: 'js/idbkvstore.min.js' });
  function installMod() {
    vm.runInContext(actualPrototypeStatements, context, { filename: 'libs/sc-mod.lib:ENGINE_SCRIPT:array-helpers' });
    vm.runInContext('globalThis.originalModMethods = Object.fromEntries(' + JSON.stringify(modMethods) +
      '.map(name => [name, Array.prototype[name]]));', context);
  }
  function assertModPreserved() {
    const descriptors = vm.runInContext('Object.keys(originalModMethods).map(name => ({ name, same: Array.prototype[name] === originalModMethods[name], enumerable: Object.getOwnPropertyDescriptor(Array.prototype, name).enumerable }))', context);
    assert.equal(descriptors.length, modMethods.length);
    for (const d of descriptors) { assert.equal(d.same, true, d.name); assert.equal(d.enumerable, true, d.name); }
    assert.equal(vm.runInContext('[3, 1, 5].has(1)', context), true);
    assert.equal(vm.runInContext('[3, 1, 5].max()', context), 5);
    assert.equal(vm.runInContext('[3, 1, 5].min()', context), 1);
    assert.equal(vm.runInContext('[3, 1, 5].sum()', context), 9);
    assert.equal(vm.runInContext('[3, 1, 5].avg()', context), 3);
  }
  if (mod) installMod();
  return { ...idb, context, Store: window.IdbKvStore, installMod, assertModPreserved };
}

test('fixture executes the actual sc-mod ENGINE_SCRIPT enumerable Array helpers', () => {
  assert.equal(scriptId, 77);
  assert.match(nativeLoader, /return g_CBnkPtr \+ addr \+ sizeof\(RCHEAD\)/);
  assert.match(createHash('sha256').update(modLibrary).digest('hex'), /^58de/);
  for (const name of modMethods) assert.ok(actualPrototypeStatements.includes('Array.prototype.' + name));
  const h = harness();
  h.assertModPreserved();
  const inherited = vm.runInContext('(() => { const names = []; for (const name in []) names.push(name); return names; })()', h.context);
  assert.deepEqual(Array.from(inherited), modMethods);
});

test('pending open initializes real SDK transaction and operation queues when Mod helpers arrive later', () => {
  const h = harness({ mod: false, seed: [['old', 'stored']] });
  const events = [];
  const store = new h.Store('game', error => events.push(['opened', error]));
  store.on('open', () => events.push(['open-event']));
  const first = store.transaction('readwrite', error => events.push(['first-finished', error]));
  first.set('new', 'value', error => events.push(['set', error]));
  first.get('old', (error, value) => events.push(['get', error, value]));
  const second = store.transaction('readonly', error => events.push(['second-finished', error]));
  second.count((error, value) => events.push(['count', error, value]));
  assert.equal(store._waiters.length, 2);
  assert.equal(first._waiters.length, 2);
  assert.equal(h.transactions.length, 0);
  h.installMod();
  assert.doesNotThrow(() => h.openSuccess());
  h.settle();
  assert.deepEqual(h.calls.map(call => call.method), ['put', 'get', 'count']);
  assert.deepEqual(events, [['opened', null], ['open-event'], ['set', null], ['get', null, 'stored'],
    ['count', null, 2], ['first-finished', null], ['second-finished', null]]);
  assert.equal(store._waiters, null);
  assert.equal(first._waiters, null);
  assert.equal(first.finished, true);
  h.assertModPreserved();
});

test('open failure delivers each queued API callback once and preserves the original IDB error', () => {
  const h = harness();
  const events = [];
  const problem = new Error('IDB open denied');
  const store = new h.Store('game', error => events.push(['open-callback', error]));
  store.on('error', error => events.push(['error', error]));
  store.on('close', () => events.push(['close']));
  const tx = store.transaction('readwrite', error => events.push(['finished', error]));
  tx.get('old', error => events.push(['get', error]));
  tx.set('new', 'value', error => events.push(['set', error]));
  const failure = h.openFailure(problem);
  assert.deepEqual(events, [['error', problem], ['close'], ['get', problem], ['set', problem],
    ['finished', problem], ['open-callback', problem]]);
  assert.equal(failure.prevented, 1);
  assert.equal(failure.stopped, 1);
  assert.equal(h.transactions.length, 0);
  assert.equal(store._waiters, null);
  assert.throws(() => store.get('old'), /Database is closed/);
  store.close();
  assert.equal(events.length, 6);
  h.assertModPreserved();
});

test('close before open fails pending operations once and closes a late IDB result', () => {
  const h = harness();
  const events = [];
  const store = new h.Store('game', () => events.push('open-callback'));
  store.on('open', () => events.push('open-event'));
  store.on('close', () => events.push('close'));
  const tx = store.transaction('readonly', error => events.push(error.message));
  tx.get('old', error => events.push(error.message));
  tx.count(error => events.push(error.message));
  assert.doesNotThrow(() => store.close());
  store.close();
  const db = h.openSuccess();
  h.settle();
  assert.deepEqual(events, ['close', 'Database is closed', 'Database is closed', 'Database is closed']);
  assert.equal(db.closeCount, 1);
  assert.equal(h.transactions.length, 0);
  assert.equal(h.calls.length, 0);
  h.assertModPreserved();
});

test('aborting a queued transaction drains its callbacks and does not revive it at open', () => {
  const h = harness({ seed: [['old', 'stored']] });
  const events = [];
  const store = new h.Store('game');
  const stopped = store.transaction('readwrite', error => events.push(['stopped', error.message]));
  stopped.set('new', 'value', error => events.push(['set', error.message]));
  stopped.get('old', error => events.push(['get', error.message]));
  stopped.abort();
  assert.equal(stopped.finished, true);
  assert.throws(() => stopped.get('old'), /Transaction is finished/);
  const kept = store.transaction('readonly', error => events.push(['kept', error]));
  kept.get('old', (error, value) => events.push(['read', error, value]));
  h.openSuccess();
  h.settle();
  assert.deepEqual(events, [['set', 'Transaction aborted'], ['get', 'Transaction aborted'],
    ['stopped', 'Transaction aborted'], ['read', null, 'stored'], ['kept', null]]);
  assert.deepEqual(h.calls.map(call => call.method), ['get']);
  assert.equal(h.records.has('new'), false);
  h.assertModPreserved();
});

test('initialized transaction errors retain normal event handling and finish only once', () => {
  const h = harness();
  const store = new h.Store('game');
  h.openSuccess();
  const events = [];
  const tx = store.transaction('readwrite', error => events.push(error));
  tx.set('new', 'value', error => events.push(error));
  const native = h.transactions[0];
  const problem = new Error('IDB transaction failed');
  const failure = h.failTransaction(native, problem);
  h.failTransaction(native, problem, 'onabort');
  h.settle();
  assert.deepEqual(events, [problem]);
  assert.equal(tx.finished, true);
  assert.equal(failure.prevented, 1);
  assert.equal(failure.stopped, 1);
  assert.equal(h.records.has('new'), false);
  assert.doesNotThrow(() => store.close());
  h.assertModPreserved();
});

test('empty and already-open SDK queues can close without enumerating inherited helpers', () => {
  const h = harness();
  const store = new h.Store('game');
  assert.doesNotThrow(() => h.openSuccess());
  assert.equal(h.transactions.length, 0);
  assert.equal(store._waiters, null);
  const tx = store.transaction('readonly', () => {});
  assert.equal(tx._waiters, null);
  h.settle();
  assert.equal(tx.finished, true);
  assert.doesNotThrow(() => store.close());
  assert.equal(h.databases[0].closeCount, 1);
  h.assertModPreserved();
});

test('SDK public promise APIs still read, write, remove and clear before and after open', async () => {
  const h = harness({ seed: [['old', 'stored']] });
  const store = new h.Store('game');
  const write = store.set('new', 'value');
  const read = store.get('old');
  h.openSuccess();
  h.settle();
  assert.equal(await write, undefined);
  assert.equal(await read, 'stored');
  const remove = store.remove('old');
  h.settle();
  await remove;
  assert.equal(h.records.has('old'), false);
  const clear = store.clear();
  h.settle();
  await clear;
  assert.equal(h.records.size, 0);
  assert.deepEqual(h.calls.map(call => call.method), ['put', 'get', 'delete', 'clear']);
  store.close();
  h.assertModPreserved();
});
