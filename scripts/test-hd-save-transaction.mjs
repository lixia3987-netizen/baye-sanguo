#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'vendor/iBaye/src/gamEng.c'), 'utf8').replace(/\r\n/g, '\n');
const fsSource = readFileSync(join(root, 'vendor/iBaye/src/platform/js/fsys.c'), 'utf8').replace(/\r\n/g, '\n');
const run = promisify(execFile);
function actualFunction(source, name) {
    const pattern = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm');
    const match = pattern.exec(source);
    assert.ok(match, `${name} exists`);
    const end = source.indexOf('\n}\n', match.index);
    assert.ok(end > match.index);
    return source.slice(match.index, end + 2);
}
async function compile(source, extraArgs = []) {
    const directory = mkdtempSync(join(tmpdir(), 'baye-save-'));
    try {
        const filename = join(directory, 'save.c'), executable = join(directory, process.platform === 'win32' ? 'save.exe' : 'save');
        writeFileSync(filename, source);
        await run(process.env.CC || 'cc', ['-std=c99', '-Wall', '-Wextra', ...(process.platform === 'win32' ? ['-fpack-struct=1'] : []), '-D_POSIX_C_SOURCE=200809L', '-I', join(root, 'vendor/iBaye/src'), ...extraArgs, filename, '-o', executable], { timeout: 30000 });
        const result = await run(executable, [], { timeout: 30000 });
        assert.match(result.stdout, /passed/);
    } finally { assert.equal(dirname(resolve(directory)), resolve(tmpdir()), 'Cleanup stays in the explicit temporary directory');
        assert.ok(basename(directory).startsWith('baye-save-'), 'Cleanup targets only this fixture');
        rmSync(directory, { recursive: true, force: true }); }
}

function harness(initial = {}) {
    const values = new Map(Object.entries({ 'baye/libpath': '/mods/current.lib', 'baye/libname': 'Current', ...initial }));
    let writes = 0, fail = null;
    const storage = {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { writes++; if (fail && fail({ key, value: String(value), writes, op: 'set' })) throw Object.assign(new Error('Storage full'), { name: 'QuotaExceededError' }); values.set(key, String(value)); },
        removeItem(key) { writes++; if (fail && fail({ key, writes, op: 'remove' })) throw new Error('Storage blocked'); values.delete(key); }
    };
    const context = vm.createContext({
        localStorage: storage, document: { documentElement: { style: {} }, addEventListener() {}, getElementById() { return null; } },
        console: { log() {}, warn() {}, error() {} }, navigator: { userAgent: 'save transaction test' },
        setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
        Storage: function () {}, $() { return { hide() {}, show() {}, css() {}, on() {} }; },
        baye: { data: { g_engineConfig: { citiesCount: 2 } } }
    });
    context.window = context;
    vm.runInContext(readFileSync(join(root, 'js/save-storage.js'), 'utf8'), context, { filename: 'js/save-storage.js' });
    vm.runInContext(readFileSync(join(root, 'js/lcd.js'), 'utf8'), context, { filename: 'js/lcd.js' });
    context.dynLib = 'AABBCCDDEEFF';
    return { context, values, storage, fail(fn) { writes = 0; fail = fn; }, clearFailure() { writes = 0; fail = null; } };
}
const name = index => `baye//data//sango${index}.sav`;
function pair({ version = 0x95, count = 3, custom = '' } = {}) {
    const fixed = 16 + count * 21 + (version >= 0x95 ? 4000 : 2000) + (version >= 0x94 ? 1 : 0);
    const a = Buffer.alloc(fixed + (version >= 0x95 ? 4 : 0) + custom.length);
    a[0] = version; a[1] = 1; a.writeUInt16LE(count, 2); a.writeUInt16LE(0, 4); a.writeUInt16LE(190, 6); a[11] = 1;
    for (let i = 0; i < count; i++) a.writeUInt16LE(i, 16 + count * 19 + i * 2);
    if (version >= 0x95) a.writeUInt32LE(custom.length, fixed);
    a.write(custom, fixed + (version >= 0x95 ? 4 : 0));
    const b = Buffer.alloc(30 + (version >= 0x95 ? 600 : 300) + 200 * 14 + 2 * 37 + 4);
    b.fill(0xff, 30 + (version >= 0x95 ? 600 : 300), 30 + (version >= 0x95 ? 600 : 300) + 200 * 14);
    return [a.toString('hex'), b.toString('hex')];
}
function save(h, slot, files) {
    assert.equal(h.context.bayeSaveBatchBegin(slot), true);
    assert.equal(h.context.bayeSaveFileContent(name(slot * 2), files[0]), true);
    assert.equal(h.context.bayeSaveFileContent(name(slot * 2 + 1), files[1]), true);
    return h.context.bayeSaveBatchCommit();
}

test('real JS slots preserve sparse indices, fourth load slot and packed legacy/new headers', () => {
    const h = harness();
    assert.deepEqual(Array.from(h.context.BayeSaveStorage.slots(), row => row.slot), [0, 1, 2, 3]);
    assert.deepEqual(Array.from(h.context.BayeSaveStorage.slots(), row => row.status), ['empty', 'empty', 'empty', 'empty']);
    assert.equal(save(h, 2, pair()), true);
    h.values.set(name(6), pair({ version: 0x94 })[0]); h.values.set(name(7), pair({ version: 0x94 })[1]);
    const rows = h.context.BayeSaveStorage.slots();
    assert.deepEqual(Array.from(rows, row => row.status), ['empty', 'empty', 'ready', 'ready']);
    assert.equal(rows[2].king, 0); assert.equal(rows[2].year, 190); assert.equal(rows[2].period, 1); assert.equal(rows[2].canLoad, true);
    assert.equal(h.context.bayeSaveBatchBegin(3), false);
});

test('real JS rejects missing halves, non-hex, unsupported versions and custom truncation', () => {
    for (const mutate of [
        h => h.values.delete(name(1)),
        h => h.values.set(name(0), '00G1'),
        h => h.values.set(name(0), '96' + h.values.get(name(0)).slice(2)),
        h => h.values.set(name(1), h.values.get(name(1)).slice(0, -2)),
        h => h.values.set(name(0), h.values.get(name(0)).slice(0, -2))
    ]) {
        const h = harness(); assert.equal(save(h, 0, pair({ custom: '{"test":1}' })), true); mutate(h);
        assert.equal(h.context.BayeSaveStorage.inspectSlot(0).canLoad, false);
    }
});

test('real JS LIB mismatch returns no pseudo-file and identifies changed custom content at the same path', () => {
    const h = harness(); assert.equal(save(h, 0, pair()), true);
    h.values.set('baye/libpath', '/mods/other.lib');
    assert.equal(h.context.BayeSaveStorage.inspectSlot(0).status, 'wrong-lib');
    assert.equal(h.context.bayeLoadFileContent(name(0)), null);
    h.values.set('baye/libpath', '/mods/current.lib'); h.context.dynLib = '00BBCCDDEEFF';
    assert.equal(h.context.BayeSaveStorage.inspectSlot(0).status, 'wrong-lib');
    assert.equal(h.context.bayeLoadFileContent(name(1)), null);
    assert.equal(h.context.bayeLoadFileContent('baye//data/dat.lib'), h.context.dynLib);
});

test('real JS every transaction write failure retains both old files and all metadata', () => {
    for (let failAt = 1; failAt <= 10; failAt++) {
        const h = harness(); const original = pair({ custom: 'old' }); assert.equal(save(h, 0, original), true);
        const before = new Map(h.values);
        h.fail(({ writes }) => writes === failAt);
        assert.equal(save(h, 0, pair({ custom: 'replacement' })), false, `write ${failAt}`);
        assert.equal(h.context.bayeLoadFileContent(name(0)), original[0]);
        assert.equal(h.context.bayeLoadFileContent(name(1)), original[1]);
        for (const [key, value] of before) assert.equal(h.values.get(key), value, key);
        assert.equal(h.context.BayeSaveStorage.lastError().code, 'storage');
    }
});

test('real JS durable journal keeps old pair visible when rollback is also denied and after reload', () => {
    const h = harness(), original = pair({ custom: 'old' }); assert.equal(save(h, 0, original), true);
    h.fail(({ writes }) => writes >= 4);
    assert.equal(save(h, 0, pair({ custom: 'new' })), false);
    assert.ok(h.values.has('baye/save-transaction/0'));
    assert.equal(h.context.bayeLoadFileContent(name(0)), original[0]);
    assert.equal(h.context.bayeLoadFileContent(name(1)), original[1]);
    const reloaded = harness(Object.fromEntries(h.values));
    assert.equal(reloaded.context.bayeLoadFileContent(name(0)), original[0]);
    assert.equal(reloaded.context.BayeSaveStorage.inspectSlot(0).canLoad, true);
    assert.equal(save(reloaded, 0, pair({ custom: 'retry' })), true);
    assert.equal(reloaded.values.has('baye/save-transaction/0'), false);
});

test('real JS partial staging and abort never publish a half save', () => {
    const h = harness(), original = pair(); assert.equal(save(h, 0, original), true);
    assert.equal(h.context.bayeSaveBatchBegin(0), true);
    h.context.bayeSaveFileContent(name(0), pair({ custom: 'uncommitted' })[0]);
    assert.equal(h.context.bayeSaveBatchCommit(), false);
    assert.equal(h.context.bayeLoadFileContent(name(0)), original[0]);
    assert.equal(h.context.bayeSaveBatchBegin(0), true);
    h.context.bayeSaveFileContent(name(0), pair({ custom: 'cancelled' })[0]);
    h.context.bayeSaveBatchAbort();
    assert.equal(h.context.bayeLoadFileContent(name(0)), original[0]);
});

test('real JS atomic import accepts the fourth slot and preserves source metadata without a loaded LIB', () => {
    const h = harness(), files = pair({ custom: 'incoming' });
    h.context.dynLib = null;
    const imported = { sav0: files[0], sav1: files[1], lib: '/mods/incoming.lib', name: 'Imported', identity: 'source-fingerprint' };
    assert.equal(h.context.BayeSaveStorage.importSlot(3, imported), true);
    assert.equal(h.context.BayeSaveStorage.readMetadata(name(6)), files[0]);
    assert.equal(h.context.BayeSaveStorage.readMetadata(name(7)), files[1]);
    for (const key of [name(6), name(7)]) {
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib'), imported.lib);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.name'), imported.name);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib-id'), imported.identity);
    }
    assert.equal(h.context.BayeSaveStorage.inspectSlot(3).status, 'wrong-lib');
    h.values.set('baye/libpath', imported.lib);
    assert.equal(h.context.BayeSaveStorage.inspectSlot(3).canLoad, true);
    assert.equal(h.context.bayeSaveBatchBegin(3), false);
    assert.equal(h.context.BayeSaveStorage.importSlot(3, { sav0: files[0], sav1: files[1] }), true);
    for (const key of [name(6), name(7)]) {
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib'), null);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.lib-id'), null);
        assert.equal(h.context.BayeSaveStorage.readMetadata(key + '.name'), null);
    }
});

test('shared storage module imports and exports pairs without LCD, DOM, Module or loaded LIB', () => {
    const values = new Map();
    const context = vm.createContext({ localStorage: {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    } });
    context.window = context;
    vm.runInContext(readFileSync(join(root, 'js/save-storage.js'), 'utf8'), context);
    const files = pair();
    assert.equal(context.BayeSaveStorage.validatePair(files[0], files[1]), true);
    assert.equal(context.BayeSaveStorage.validatePair(files[0], files[1].slice(0, -2)), false);
    assert.equal(context.BayeSaveStorage.importSlot(3, { sav0: files[0], sav1: files[1] }), true);
    assert.equal(context.BayeSaveStorage.readMetadata(name(6)), files[0]);
    assert.equal(context.BayeSaveStorage.inspectSlot(3).status, 'ready');
    for (const dependency of ['document', 'Module', 'baye', 'dynLib']) assert.equal(context[dependency], undefined);
});

test('real JS atomic import validates both files before touching existing slot data or metadata', () => {
    const h = harness(), original = pair();
    assert.equal(h.context.BayeSaveStorage.importSlot(3, { sav0: original[0], sav1: original[1], lib: '/mods/current.lib' }), true);
    const before = new Map(h.values);
    for (const incoming of [
        { sav0: '00GG', sav1: original[1] },
        { sav0: original[0], sav1: original[1].slice(0, -2) },
        { sav0: original[0].slice(0, -2), sav1: original[1] },
        { sav0: original[0], sav1: original[1], identity: { invalid: true } },
        { sav0: original[0] }
    ]) {
        assert.equal(h.context.BayeSaveStorage.importSlot(3, incoming), false);
        assert.deepEqual(h.values, before);
    }
    for (const invalidSlot of [-1, 4, 1.5]) assert.equal(h.context.BayeSaveStorage.importSlot(invalidSlot, { sav0: original[0], sav1: original[1] }), false);
    assert.deepEqual(h.values, before);
});

test('real JS every fourth-slot import failure and denied rollback keeps the complete old source pair', () => {
    const original = pair({ custom: 'original' }), incoming = pair({ custom: 'incoming' });
    for (let failAt = 1; failAt <= 10; failAt++) {
        const h = harness();
        assert.equal(h.context.BayeSaveStorage.importSlot(3, { sav0: original[0], sav1: original[1], lib: '/mods/current.lib', name: 'Old source' }), true);
        const before = new Map(h.values);
        h.fail(({ writes }) => writes === failAt);
        assert.equal(h.context.BayeSaveStorage.importSlot(3, { sav0: incoming[0], sav1: incoming[1], lib: '/mods/new.lib', name: 'New source', identity: 'incoming-id' }), false);
        assert.equal(h.context.BayeSaveStorage.readMetadata(name(6)), original[0]);
        assert.equal(h.context.BayeSaveStorage.readMetadata(name(7)), original[1]);
        for (const [key, value] of before) assert.equal(h.values.get(key), value, key);
    }
    const h = harness();
    assert.equal(h.context.BayeSaveStorage.importSlot(3, { sav0: original[0], sav1: original[1], lib: '/mods/current.lib', name: 'Old source' }), true);
    h.fail(({ writes }) => writes >= 4);
    assert.equal(h.context.BayeSaveStorage.importSlot(3, { sav0: incoming[0], sav1: incoming[1], lib: '/mods/new.lib' }), false);
    const reloaded = harness(Object.fromEntries(h.values));
    assert.equal(reloaded.context.BayeSaveStorage.readMetadata(name(6)), original[0]);
    assert.equal(reloaded.context.BayeSaveStorage.readMetadata(name(6) + '.lib'), '/mods/current.lib');
    assert.equal(reloaded.context.BayeSaveStorage.readMetadata(name(7)), original[1]);
});

const snapshotStart = source.indexOf('typedef struct {\n    U8 version, period');
const snapshotEnd = source.indexOf('} GamSaveSnapshot;', snapshotStart) + '} GamSaveSnapshot;'.length;
const engine = source.slice(snapshotStart, snapshotEnd) + '\n' + ['compress_data', 'decompress_data', 'save_read_custom', 'save_snapshot_valid', 'GamLoadRcd', 'GamSaveRcd'].map(name => actualFunction(source, name)).join('\n');
const cHarness = String.raw`
#include <assert.h>
#include <stdio.h>
#include "baye/stdsys.h"
#include "baye/comm.h"
#include "baye/enghead.h"
#include "miniz.h"
static U8* customData;
U8 g_PIdx,g_MonthDate,g_LookEnemy,g_LookMovie,g_MoveSpeed;
U16 g_YearDate;
PersonID g_PlayerKing;
CitySetType g_CityPos;
PersonType g_Persons[PERSON_MAX];
PersonID g_PersonsQueue[PERSON_MAX];
ToolID g_GoodsQueue[GOODS_MAX];
CityType g_Cities[256];
EngineConfig g_engineConfig;
static U8 fighterIndices[30], fighterData[600], orderData[ORDER_MAX*sizeof(OrderType)];
U8 *_FIGHTERS_IDX=fighterIndices,*_FIGHTERS=fighterData,*_ORDERQUEUE=orderData;
static U32 personCount;
static int seedValue=123, didLoad, willSave, worldCommits, handles, opens, writes, closes, failOpen, failWrite, failClose, failCommit;
static int batch;
void GamSetPersonCount(U32 count) { personCount=count; }
U32 GamGetPersonCount(void) { return personCount; }
int gam_seed(void) { return seedValue; }
void gam_srand(unsigned int seed) { seedValue=seed; }
U8 ResLoadToMem(U16 resource,U16 id,U8* buf) { (void)resource;(void)id;memcpy(buf,"sango0.sav",11);return 0; }
void GamMsgBox(const U8* text,U8 delay) { (void)text;(void)delay; }
U8 GamDelay(U16 delay,BOOL keys) { (void)delay;(void)keys;return 0; }
static int call_hook(const char* name,void* ignored) { (void)ignored;if(!strcmp(name,"didLoadGame"))didLoad++;else willSave++;return 0; }
static void baye_hd_world_commit(void) { worldCommits++; }
typedef struct { U8* data;U32 length; } File;
static File files[8], staged[8];
struct gam_FILE { File data; U32 cursor; int index, write; };
static gam_FILE* sav_fopen(U8* name,U8 mode) {
    opens++; if(failOpen && opens==failOpen) return NULL;
    int index=name[5]-'0';
    if(index<0||index>=8||mode=='r'&&!files[index].data)return NULL;
    gam_FILE* fp=calloc(1,sizeof(*fp));fp->index=index;fp->write=mode=='w';
    if(!fp->write)fp->data=files[index];handles++;return fp;
}
U32 gam_fread(U8* buf,U8 size,U16 count,gam_FILE* fp) {
    U32 bytes=size*count,remain=fp->data.length-fp->cursor;
    if(bytes>remain) bytes=remain;
    memcpy(buf,fp->data.data+fp->cursor,bytes);fp->cursor+=bytes;return size?bytes/size:0;
}
U32 gam_fwrite(U8* buf,U32 size,U16 count,gam_FILE* fp) {
    writes++;if(failWrite&&writes==failWrite)return 0;
    U32 bytes=size*count;U8* grown=realloc(fp->data.data,fp->cursor+bytes);
    assert(grown);fp->data.data=grown;memcpy(grown+fp->cursor,buf,bytes);
    fp->cursor+=bytes;fp->data.length=fp->cursor;return count;
}
U8 gam_fclose(gam_FILE* fp) {
    closes++;int failed=failClose&&closes==failClose;
    if(fp->write) { free(staged[fp->index].data);staged[fp->index]=fp->data; }
    free(fp);handles--;return failed;
}
static bool save_batch_begin(U8 slot) {
    (void)slot;assert(!batch);batch=1;opens=writes=closes=0;
    for(int i=0;i<8;i++){free(staged[i].data);staged[i]=(File){0};}return true;
}
static bool save_batch_commit(void) {
    if(failCommit)return false;
    for(int i=0;i<8;i++)if(staged[i].data){free(files[i].data);files[i]=staged[i];staged[i]=(File){0};}
    batch=0;return true;
}
static void save_batch_abort(void) {
    for(int i=0;i<8;i++){free(staged[i].data);staged[i]=(File){0};}batch=0;
}
`;

const cCases = String.raw`
static void setup(void) {
    memset(g_Persons,0,sizeof(g_Persons));memset(g_Cities,0,sizeof(g_Cities));
    memset(g_PersonsQueue,0,sizeof(g_PersonsQueue));memset(g_GoodsQueue,0,sizeof(g_GoodsQueue));
    memset(fighterIndices,0,sizeof(fighterIndices));memset(fighterData,0,sizeof(fighterData));memset(orderData,0xff,sizeof(orderData));
    g_engineConfig.citiesCount=2;g_engineConfig.cityMapWidth=12;g_engineConfig.cityMapHeight=9;
    g_engineConfig.compressCustomData=0;
    g_PIdx=1;personCount=20;g_PlayerKing=0;g_YearDate=190;g_MonthDate=1;
    g_CityPos=(CitySetType){0};
    for(int i=0;i<20;i++){g_Persons[i].Arms=100+i;g_PersonsQueue[i]=i;}
    g_Cities[0].Persons=2;g_Cities[0].Food=1234;g_Cities[1].PersonQueue=2;g_Cities[1].Persons=1;
    g_GoodsQueue[1999]=321;
    free(customData);customData=(U8*)strdup("{\"battle\":1}");
}
static unsigned long long worldHash(void) {
    unsigned long long result=1469598103934665603ULL;
#define HASH_DATA(ptr,len) do { const U8* bytes=(const U8*)(ptr);for(size_t i=0;i<(len);i++)result=(result^bytes[i])*1099511628211ULL; } while(0)
    HASH_DATA(&g_PIdx,sizeof(g_PIdx));HASH_DATA(&personCount,sizeof(personCount));HASH_DATA(&g_PlayerKing,sizeof(g_PlayerKing));
    HASH_DATA(&g_YearDate,sizeof(g_YearDate));HASH_DATA(&g_MonthDate,sizeof(g_MonthDate));HASH_DATA(&g_CityPos,sizeof(g_CityPos));
    HASH_DATA(&g_LookEnemy,sizeof(g_LookEnemy));HASH_DATA(&g_LookMovie,sizeof(g_LookMovie));HASH_DATA(&g_MoveSpeed,sizeof(g_MoveSpeed));
    HASH_DATA(g_Persons,sizeof(g_Persons));HASH_DATA(g_PersonsQueue,sizeof(g_PersonsQueue));HASH_DATA(g_GoodsQueue,sizeof(g_GoodsQueue));
    HASH_DATA(g_Cities,sizeof(g_Cities));HASH_DATA(fighterData,sizeof(fighterData));HASH_DATA(fighterIndices,sizeof(fighterIndices));HASH_DATA(orderData,sizeof(orderData));
    HASH_DATA(customData,strlen((char*)customData)+1);HASH_DATA(&seedValue,sizeof(seedValue));
#undef HASH_DATA
    return result;
}
static void failedLoadPreservesWorld(void) {
    unsigned long long before=worldHash();int beforeDidLoad=didLoad,beforeCommits=worldCommits;opens=closes=0;
    assert(!GamLoadRcd(0));assert(worldHash()==before&&didLoad==beforeDidLoad&&worldCommits==beforeCommits&&handles==0);
}
static void roundTrip(void) {
    setup();
    OrderType* order=(OrderType*)orderData;order[0]=(OrderType){.OrderId=BATTLE,.City=0,.Person=29,.Object=1};
    fighterIndices[29]=1;((PersonID*)fighterData)[290]=3;
    assert(GamSaveRcd(0));assert(files[0].data[0]==0x95);
    assert(files[1].length==30+600+ORDER_MAX*sizeof(OrderType)+2*sizeof(CityType)+sizeof(int));
    g_YearDate=500;g_Cities[0].Food=1;g_Persons[0].Arms=1;g_GoodsQueue[1999]=0;memset(fighterData,0,600);
    int beforeCommits=worldCommits;
    assert(GamLoadRcd(0));assert(worldCommits==beforeCommits+1);
    assert(g_YearDate==190&&g_Cities[0].Food==1234&&g_Persons[0].Arms==100);
    assert(g_GoodsQueue[1999]==321&&((PersonID*)fighterData)[290]==3&&handles==0);
}
static void loadFaults(void) {
    U32 aLength=files[0].length,bLength=files[1].length;
    g_YearDate=777;g_Cities[0].Food=888;
    for(U32 length=0;length<aLength;length++){files[0].length=length;failedLoadPreservesWorld();}files[0].length=aLength;
    for(U32 length=0;length<bLength;length++){files[1].length=length;failedLoadPreservesWorld();}files[1].length=bLength;
    File second=files[1];files[1]=(File){0};failedLoadPreservesWorld();files[1]=second;
    U8 old=files[0].data[0];files[0].data[0]=0x96;failedLoadPreservesWorld();files[0].data[0]=old;
    U16 previous;memcpy(&previous,files[0].data+2,2);U16 tooMany=PERSON_MAX+1;memcpy(files[0].data+2,&tooMany,2);failedLoadPreservesWorld();memcpy(files[0].data+2,&previous,2);
    U16 badQueue=PERSON_MAX;U32 queueOffset=16+personCount*sizeof(PersonType);U16 savedQueue;memcpy(&savedQueue,files[0].data+queueOffset,2);memcpy(files[0].data+queueOffset,&badQueue,2);failedLoadPreservesWorld();memcpy(files[0].data+queueOffset,&savedQueue,2);
    U32 citiesOffset=30+600+ORDER_MAX*sizeof(OrderType);CityType* city=(CityType*)(files[1].data+citiesOffset);U16 savedPersons=city->Persons;city->Persons=PERSON_MAX;failedLoadPreservesWorld();city->Persons=savedPersons;
    OrderType* order=(OrderType*)(files[1].data+30+600);PersonID savedFighter=order[0].Person;order[0].Person=30;failedLoadPreservesWorld();order[0].Person=savedFighter;
    OrderType savedOrder=order[0];
    const U8 objectOrders[]={TRANSPORTATION,MOVE,RECONNOITRE,SURRENDER,ALIENATE,CANVASS,COUNTERESPIONAGE,INDUCE};
    for(U32 i=0;i<sizeof(objectOrders);i++) { order[0].OrderId=objectOrders[i];order[0].Person=0;order[0].Object=0xffff;failedLoadPreservesWorld(); }
    const U8 invalidOrders[]={20,21,22,28,254};
    for(U32 i=0;i<sizeof(invalidOrders);i++) { order[0].OrderId=invalidOrders[i];order[0].Person=0;order[0].Object=0;failedLoadPreservesWorld(); }
    order[0]=savedOrder;
    U32 compressedOffset=16+personCount*(sizeof(PersonType)+sizeof(PersonID))+sizeof(g_GoodsQueue);files[0].data[compressedOffset]=1;failedLoadPreservesWorld();files[0].data[compressedOffset]=0;
}
static void writeFaults(void) {
    U8* first=malloc(files[0].length),*second=malloc(files[1].length);U32 firstLen=files[0].length,secondLen=files[1].length;
    memcpy(first,files[0].data,firstLen);memcpy(second,files[1].data,secondLen);
    g_YearDate=200;
    for(int failure=1;failure<=21;failure++){failWrite=failure;assert(!GamSaveRcd(0));assert(handles==0&&!batch);assert(files[0].length==firstLen&&files[1].length==secondLen);assert(!memcmp(first,files[0].data,firstLen)&&!memcmp(second,files[1].data,secondLen));}failWrite=0;
    for(int failure=1;failure<=2;failure++){failOpen=failure;assert(!GamSaveRcd(0));assert(!memcmp(first,files[0].data,firstLen)&&!memcmp(second,files[1].data,secondLen));assert(handles==0&&!batch);}failOpen=0;
    for(int failure=1;failure<=2;failure++){failClose=failure;assert(!GamSaveRcd(0));assert(!memcmp(first,files[0].data,firstLen)&&!memcmp(second,files[1].data,secondLen));assert(handles==0&&!batch);}failClose=0;
    failCommit=1;assert(!GamSaveRcd(0));assert(!memcmp(first,files[0].data,firstLen)&&!memcmp(second,files[1].data,secondLen));failCommit=0;
    assert(!GamSaveRcd(3));free(first);free(second);
}
static void legacyMigration(void) {
    setup();assert(GamSaveRcd(0));
    U32 firstFixed=16+personCount*(sizeof(PersonType)+sizeof(PersonID));
    U32 legacyFirst=firstFixed+GOODS_MAX+1+strlen((char*)customData);
    U8* first=calloc(1,legacyFirst);memcpy(first,files[0].data,firstFixed+GOODS_MAX);first[0]=0x94;first[firstFixed+GOODS_MAX]=0;
    memcpy(first+firstFixed+GOODS_MAX+1,customData,strlen((char*)customData));free(files[0].data);files[0]=(File){first,legacyFirst};
    U32 legacySecond=30+300+ORDER_MAX*sizeof(OrderType)+2*sizeof(CityType)+sizeof(int);
    U8* second=calloc(1,legacySecond);memcpy(second+30+300,files[1].data+30+600,files[1].length-30-600);
    second[7]=1;PersonID person=3;memcpy(second+30+7*40,&person,2);
    OrderType* orders=(OrderType*)(second+30+300);orders[0]=(OrderType){.OrderId=BATTLE,.Person=7,.City=0,.Object=1};
    free(files[1].data);files[1]=(File){second,legacySecond};
    assert(GamLoadRcd(0));assert(((PersonID*)fighterData)[70]==3&&g_GoodsQueue[1999]==0);
    second[7]=0;second[8]=1;orders[0].Person=8;failedLoadPreservesWorld();
    second[8]=0;orders[0].OrderId=0xff;assert(GamLoadRcd(0));
}
static void compressedRoundTrip(void) {
    setup();g_engineConfig.compressCustomData=5;
    free(customData);customData=(U8*)strdup("x");
    assert(GamSaveRcd(0));free(customData);customData=(U8*)strdup("different");
    assert(GamLoadRcd(0));assert(!strcmp((char*)customData,"x"));
    U32 compressedOffset=16+personCount*(sizeof(PersonType)+sizeof(PersonID))+sizeof(g_GoodsQueue)+1+4;
    files[0].data[compressedOffset]=0;failedLoadPreservesWorld();
}
int main(void) {
    assert(sizeof(PersonType)==19&&sizeof(CityType)==37&&sizeof(OrderType)==14);
    roundTrip();loadFaults();writeFaults();legacyMigration();compressedRoundTrip();
    for(int i=0;i<8;i++)free(files[i].data);free(customData);
    puts("actual C save/load: full queues, every truncation, field bounds, write faults and legacy migration passed");
}
`;

test('actual C loading is transactional and saving checks every write/close before publishing both files', async () => {
    await compile(cHarness + '\n' + engine + '\n' + cCases, [join(root, 'vendor/iBaye/src/miniz.c')]);
});

const fsFunctions = ['hex_encode', 'hex_decode', 'sav_fclose_w', 'sav_fwrite', 'sav_finit_w'].map(name => actualFunction(fsSource, name)).join('\n');
test('actual C web filesystem strictly decodes hex and propagates failed allocation/write/close', async () => {
    await compile(String.raw`
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <stdint.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;
#define FAR
static int failAlloc, saved, setSucceeds=1;
static void* allocate(size_t size) { if(failAlloc){failAlloc=0;return NULL;}return calloc(1,size); }
static void* reallocate(void* data,size_t size) { if(failAlloc){failAlloc=0;return NULL;}return realloc(data,size); }
#define gam_malloc allocate
#define gam_realloc reallocate
#define gam_free free
#define gam_strdup strdup
struct gam_FILE;
typedef struct gam_FILE gam_FILE;
struct gam_FILE { U8(*fclose)(gam_FILE*);U32(*fwrite)(U8*,U32,U16,gam_FILE*); };
typedef struct { gam_FILE base;U32 cur,length;U8* data; } rom_FILE;
typedef struct { rom_FILE base;U8* fname;U32 alloced;U8 failed; } sav_write_FILE;
static void rom_finit(rom_FILE* fp) { memset(fp,0,sizeof(*fp)); }
static U8 setValue(const U8* key,const U8* value) { assert(key&&value);saved++;return setSucceeds; }
` + fsFunctions + String.raw`
int main(void) {
    U32 length;U8* data=hex_decode((U8*)"aA01Ff",&length);assert(length==3&&data[0]==0xaa&&data[1]==1&&data[2]==255);free(data);
    assert(!hex_decode((U8*)"0G",&length));assert(!hex_decode((U8*)"G0",&length));assert(!hex_decode((U8*)"0",&length));
    failAlloc=1;assert(!hex_decode((U8*)"00",&length));failAlloc=1;assert(!hex_encode((U8*)"x",1));
    sav_write_FILE* fp=calloc(1,sizeof(*fp));sav_finit_w(fp,(U8*)"sango0.sav");
    U8 block[2048]={0};failAlloc=1;assert(sav_fwrite(block,1,sizeof(block),(gam_FILE*)fp)==0);assert(fp->failed);assert(sav_fclose_w((gam_FILE*)fp)!=0&&saved==0);
    fp=calloc(1,sizeof(*fp));sav_finit_w(fp,(U8*)"sango0.sav");assert(sav_fwrite(block,1,2,(gam_FILE*)fp)==2);setSucceeds=0;assert(sav_fclose_w((gam_FILE*)fp)!=0&&saved==1);
    fp=calloc(1,sizeof(*fp));sav_finit_w(fp,(U8*)"sango0.sav");assert(sav_fwrite(block,1,2,(gam_FILE*)fp)==2);setSucceeds=1;assert(sav_fclose_w((gam_FILE*)fp)==0&&saved==2);
    puts("actual C web filesystem: strict hex, allocation failure, and close status passed");
}
`);
});

test('actual C record selector exposes the real slot, suspends during writes and reopens after failure', async () => {
    await compile(String.raw`
#include <assert.h>
#include <stdio.h>
#include "baye/stdsys.h"
#include "baye/comm.h"
#include "baye/enghead.h"
EngineConfig g_engineConfig;
static U8 active,mode,indexValue,countValue;
static U32 sequence;
static int operationCount,failFirst,drawCount,cursor;
static U8 keys[12];
void GamRcdIFace(U8 count) { assert(count==3||count==4);drawCount++; }
static void baye_hd_record_begin(U8 m,U8 i,U8 c) { active=1;mode=m;indexValue=i;countValue=c;sequence++; }
static void baye_hd_record_end(void) { active=0;sequence++; }
static void baye_hd_record_index(U8 i) { indexValue=i; }
static bool GamSaveRcd(U8 i) { assert(!active&&mode==1&&i==indexValue&&i<3);operationCount++;return !(failFirst&&operationCount==1); }
static bool GamLoadRcd(U8 i) { assert(!active&&mode==2&&i==indexValue&&i<4);operationCount++;return true; }
void GamGetMsg(GMType* msg) { assert(cursor<12);msg->type=VM_CHAR_FUN;msg->param=keys[cursor++]; }
void gam_revlcd(PT left,PT top,PT right,PT bottom) { (void)left;(void)top;(void)right;(void)bottom; }
I8 touchUpdate(Touch* touch,MsgType msg) { (void)touch;(void)msg;return 0; }
U8 touchIsPointInRect(I16 x,I16 y,Rect rect) { (void)x;(void)y;(void)rect;return 0; }
I16 touchListViewItemIndexAtPoint(I16 x,I16 y,Rect rect,I16 top,I16 bottom,U16 start,U16 count,U16 height) { (void)x;(void)y;(void)rect;(void)top;(void)bottom;(void)start;(void)count;(void)height;return -1; }
` + actualFunction(source, 'GamRecordMan') + String.raw`
int main(void) {
    keys[0]=VK_UP;keys[1]=VK_ENTER;cursor=operationCount=0;assert(GamRecordMan(false)==2&&operationCount==1&&!active&&countValue==3);
    keys[0]=VK_DOWN;keys[1]=VK_ENTER;keys[2]=VK_ENTER;cursor=operationCount=0;failFirst=1;U32 before=sequence;
    assert(GamRecordMan(false)==1&&operationCount==2&&!active&&sequence>=before+4);
    keys[0]=VK_UP;keys[1]=VK_ENTER;cursor=operationCount=0;assert(GamRecordMan(true)==3&&countValue==4&&!active);
    keys[0]=VK_EXIT;cursor=operationCount=0;assert(GamRecordMan(true)==MNU_EXIT&&!active&&operationCount==0);
    puts("actual C record selector: sparse slot indices, wrap, failure retry and cancellation passed");
}
`);
});

test('actual C slot labels use local saved period and refuse incomplete headers without changing the world', async () => {
    await compile(String.raw`
#include <assert.h>
#include <stdio.h>
#include "baye/stdsys.h"
#include "baye/comm.h"
#include "baye/enghead.h"
EngineConfig g_engineConfig;
U8 g_PIdx=3;
struct gam_FILE { U8 data[8];U32 cursor,length; };
static gam_FILE* sav_fopen(U8* name,U8 mode) {
    (void)mode;gam_FILE* file=calloc(1,sizeof(*file));
    file->data[0]=0x95;file->data[1]=1;file->data[2]=20;file->data[4]=1;file->data[6]=190;
    file->length=name[5]=='0'?8:3;return file;
}
U32 gam_fread(U8* buf,U8 size,U16 count,gam_FILE* file) {
    U32 bytes=size*count,remain=file->length-file->cursor;if(bytes>remain)bytes=remain;
    memcpy(buf,file->data+file->cursor,bytes);file->cursor+=bytes;return bytes/size;
}
U8 gam_fclose(gam_FILE* file) { free(file);return 0; }
U8 ResLoadToMem(U16 resource,U16 id,U8* buf) { (void)resource;if(id==dSaveFNam)memcpy(buf,"sango0.sav",11);else memcpy(buf,"label     year",15);return 0; }
U8 ResLoadToMemN(U16 resource,U16 id,U8* buf,U32 size) { assert(resource==GENERAL_NAME&&id==2&&g_PIdx==3&&size==32);memcpy(buf,"King",5);return 0; }
void GetPersonName(PersonID person,U8* str) { (void)person;(void)str;assert(!"saved period must not temporarily mutate current period"); }
void PlcRPicShow(U16 pic,U16 index,PT x,PT y,U8 flag) { (void)pic;(void)index;(void)x;(void)y;(void)flag; }
U32 GamStrShowS(PT x,PT y,const U8* str) { (void)x;(void)y;assert(str&&g_PIdx==3);return 0; }
` + actualFunction(source, 'GamRcdIFace') + String.raw`
int main(void) {
    GamRcdIFace(3);assert(g_PIdx==3);
    puts("actual C slot labels: complete headers and local period preserve live world passed");
}
`, [join(root, 'vendor/iBaye/src/itoa.c')]);
});
