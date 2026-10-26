#!/usr/bin/env node
// Saved header summaries only: in-memory storage, no native game or real slots.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/save-storage.js', import.meta.url), 'utf8');
const name = index => 'baye//data//sango' + index + '.sav';
function pair({version = 0x95, month = 1, year = 190, period = 1, king = 0} = {}) {
    const count = 3;
    const fixed = 16 + count * 21 + (version >= 0x95 ? 4000 : 2000) + (version >= 0x94 ? 1 : 0);
    const first = Buffer.alloc(fixed + (version >= 0x95 ? 4 : 0));
    first[0] = version; first[1] = period; first.writeUInt16LE(count, 2);
    first.writeUInt16LE(king, 4); first.writeUInt16LE(year, 6); first[11] = month;
    const second = Buffer.alloc(30 + (version >= 0x95 ? 600 : 300) + 200 * 14 + 2 * 37 + 4);
    return [first.toString('hex'), second.toString('hex')];
}
function fixture() {
    const values = new Map([['baye/libpath', '/original.lib']]), writes = [], forbidden = [];
    const storage = {getItem:key=>values.get(key) ?? null,
        setItem(key) {writes.push(key); throw Error('summary wrote storage');},
        removeItem(key) {writes.push(key); throw Error('summary removed storage');}};
    const data = {g_engineConfig:{citiesCount:2}};
    for (const key of ['g_MonthDate','g_YearDate','g_PlayerKing','g_PIdx','g_Persons','g_Cities']) {
        Object.defineProperty(data,key,{get(){forbidden.push(key); throw Error('live world read');}});
    }
    const context = vm.createContext({localStorage:storage,baye:{data},console:{log(){},warn(){}}});
    context.window = context;
    vm.runInContext(source, context);
    function slot(index, files) {values.set(name(index*2),files[0]);values.set(name(index*2+1),files[1]);}
    function unchanged(callback) {
        const before = Array.from(values);
        callback();
        assert.deepEqual(Array.from(values),before);
        assert.deepEqual(writes,[]); assert.deepEqual(forbidden,[]);
        for (const key of ['Module','document','dynLib']) assert.equal(context[key],undefined);
    }
    return {values,storage:context.BayeSaveStorage,slot,unchanged};
}

test('all accepted packed save versions expose the actual stored month 1..12 and unchanged header identities', () => {
    const h = fixture();
    for (let version = 0x90; version <= 0x95; version++) {
        for (let month = 1; month <= 12; month++) {
            const files = pair({version,month,year:237,period:4,king:2}); h.slot(0,files);
            h.unchanged(() => {
                assert.equal(h.storage.validatePair(...files),true);
                const row = h.storage.inspectSlot(0);
                assert.equal(row.status,'ready'); assert.equal(row.canLoad,true);
                assert.equal(row.month,month); assert.equal(row.year,237);
                assert.equal(row.period,4); assert.equal(row.king,2);
                assert.equal(row.bytes,(files[0].length+files[1].length)/2);
            });
        }
    }
});

test('out-of-range saved months retain the previous invalid-pair behavior without an invented month', () => {
    const h = fixture();
    for (let version = 0x90; version <= 0x95; version++) {
        for (const month of [0,13,255]) {
            const files = pair({version,month}); h.slot(0,files);
            h.unchanged(() => {
                assert.equal(h.storage.validatePair(...files),false);
                const row = h.storage.inspectSlot(0);
                assert.equal(row.status,'invalid'); assert.equal(row.canLoad,false);
                assert.equal(Object.hasOwn(row,'month'),false);
            });
        }
    }
});

test('empty, missing, malformed, mismatched and invalid slots do not disclose summary header fields', () => {
    const files = pair({month:12});
    for (const [setup,status] of [
        [()=>{},'empty'],
        [h=>h.values.set(name(0),files[0]),'incomplete'],
        [h=>h.values.set(name(1),files[1]),'incomplete'],
        [h=>h.slot(0,['00GG',files[1]]),'invalid'],
        [h=>h.slot(0,[files[0].slice(0,-2),files[1]]),'invalid'],
        [h=>h.slot(0,[files[0],files[1].slice(0,-2)]),'invalid'],
        [h=>{h.slot(0,files);h.values.set(name(0)+'.lib','/other.lib');},'wrong-lib']
    ]) {
        const h=fixture(); setup(h);
        h.unchanged(() => {
            const row=h.storage.inspectSlot(0); assert.equal(row.status,status); assert.equal(row.canLoad,false);
            for(const key of ['month','year','period','king'])assert.equal(Object.hasOwn(row,key),false,key);
        });
    }
    const h=fixture();h.slot(0,files);
    h.unchanged(() => {for(const index of [-1,4,1.5,NaN]){const row=h.storage.inspectSlot(index);assert.equal(row.status,'invalid');assert.equal(Object.hasOwn(row,'month'),false);}});
});

test('sparse slots and the fourth load slot retain their own month instead of borrowing the live world or another slot', () => {
    const h=fixture();h.slot(0,pair({month:12,year:190}));h.slot(2,pair({month:1,year:237}));h.slot(3,pair({month:7,year:199}));
    h.unchanged(() => {
        const rows=h.storage.slots();
        assert.deepEqual(Array.from(rows,r=>r.slot),[0,1,2,3]);
        assert.deepEqual(Array.from(rows,r=>r.status),['ready','empty','ready','ready']);
        assert.deepEqual(Array.from(rows,r=>r.month),[12,undefined,1,7]);
        assert.deepEqual(Array.from(rows,r=>r.year),[190,undefined,237,199]);
    });
    h.slot(0,pair({month:2,year:191}));
    h.unchanged(() => {assert.equal(h.storage.inspectSlot(0).month,2);assert.equal(h.storage.inspectSlot(2).month,1);});
});

test('the existing durable journal keeps the old saved month visible until both committed files become visible', () => {
    const h=fixture(),previous=pair({month:1,year:236}),replacement=pair({month:12,year:237});h.slot(2,replacement);
    const values={};
    for(let half=0;half<2;half++)for(const suffix of ['', '.lib', '.name', '.lib-id'])values[name(4+half)+suffix]=suffix?null:previous[half];
    h.values.set('baye/save-transaction/2',JSON.stringify({version:1,slot:2,values}));
    h.unchanged(() => {const row=h.storage.inspectSlot(2);assert.equal(row.status,'ready');assert.equal(row.month,1);assert.equal(row.year,236);});
    h.values.delete('baye/save-transaction/2');
    h.unchanged(() => {const row=h.storage.inspectSlot(2);assert.equal(row.status,'ready');assert.equal(row.month,12);assert.equal(row.year,237);});
});
