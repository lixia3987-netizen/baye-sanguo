#!/usr/bin/env node
// Compile the production trade/business and publication functions. Only UI waits,
// drawing and resource delivery are fixtures; this is not browser acceptance.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const native = join(root, 'vendor/iBaye/src');
const read = name => readFileSync(join(native, name), 'utf8').replace(/\r\n/g, '\n');
const run = promisify(execFile);

function actualFunction(filename, name) {
    const source = read(filename);
    const match = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm').exec(source);
    assert.ok(match, `Production ${filename}::${name} exists`);
    const open = source.indexOf('{', match.index);
    let depth = 0, quote = null, comment = null;
    for (let end = open; end < source.length; end++) {
        const char = source[end], next = source[end + 1];
        if (comment === '//') { if (char === '\n') comment = null; continue; }
        if (comment === '/*') { if (char === '*' && next === '/') { comment = null; end++; } continue; }
        if (quote) { if (char === '\\') end++; else if (char === quote) quote = null; continue; }
        if (char === '/' && (next === '/' || next === '*')) { comment = char + next; end++; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === '{') depth++;
        if (char === '}' && --depth === 0) return source.slice(match.index, end + 1);
    }
    assert.fail(`Production ${filename}::${name} closes`);
}

const lib = readFileSync(join(root, 'libs/dat-mod.lib'));
assert.equal(lib.length, 207195);
assert.equal(createHash('sha256').update(lib).digest('hex'), '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
function resource(id, index) {
    const base = lib.readUInt32LE((id - 1) * 4), length = lib.readUInt32LE(base);
    assert.equal(lib.readUInt16LE(base + 4), id);
    const count = lib.readUInt16LE(base + 6), fixed = lib.readUInt32LE(base + 8);
    assert.ok(index < count && base + length <= lib.length);
    const offset = fixed ? 14 + index * fixed : count === 1 ? 14 : lib.readUInt32LE(base + 14 + index * 8);
    const size = fixed || (count === 1 ? length - 14 : lib.readUInt32LE(base + 18 + index * 8));
    assert.ok(offset >= 14 && offset + size <= length);
    return lib.subarray(base + offset, base + offset + size);
}
const costs = resource(2, 9), tradeNames = resource(64, 45), foodTitle = resource(64, 40);
assert.equal(costs.length, 28); assert.equal(costs[11], 12);
assert.equal(tradeNames.toString('hex'), 'c2f2c8ebc2f4b3f6');
const bytes = value => [...value, 0].join(',');
const defines = read('hd-bridge.h').split('\n').filter(s => /^#define BAYE_HD_/.test(s)).join('\n');
const source = read('hd-bridge.c');
const globals = source.slice(source.indexOf('U8 g_hdMenuGbk['), source.indexOf('U8 g_hdFightActive =')) +
    source.slice(source.indexOf('U32 g_hdQtyValue ='), source.indexOf('U8 g_hdMapPick =')) +
    source.slice(source.indexOf('U8 g_hdHelpProtocolVersion ='), source.indexOf('U8 g_hdMovieActive ='));
const orderType = /typedef struct OrderStruct[\s\S]*?\}OrderType;/.exec(read('baye/order.h'))?.[0];
assert.ok(orderType);
const headerConstants = ['baye/sconst.h', 'baye/consdef.h', 'baye/order.h', 'baye/attribute.h'].flatMap(name =>
    read(name).split('\n').filter(s => /^#define\s+(EXCHANGE|ORDER_MAX|IFACE_CONID|STRING_CONST|MENU_TSTR|ATRR_STR60|STR_NOPERSON|NOTE_STR9|ADD16|ASC_WID|ASC_HGT|TACTIC_ICON)\b/.test(s))).join('\n');

const fixture = String.raw`
#define EM_ASM(...) ((void)0)
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8;
typedef uint16_t U16;
typedef uint32_t U32;
typedef uint16_t PersonID;
#define FAR
#define PID(x) ((PersonID)(x))
#define CITY_MAX 38
#define PERSON_COUNT 200
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define gam_memcpy memcpy
` + defines + '\n' + headerConstants + '\n' + read('data/pconst.h') + '\n' + orderType + String.raw`
typedef struct { U8 sx,sy,ex,ey; } RECT;
typedef struct { PersonID Belong; U16 PersonQueue,Persons,Money,Food; } CityType;
typedef struct { PersonID Belong; U8 Thew; } PersonType;
static CityType g_Cities[CITY_MAX];
static PersonType g_Persons[PERSON_COUNT];
static PersonID g_PersonsQueue[2000], shareMemory[2000];
static OrderType orders[ORDER_MAX];
static U8 g_engineDebug, g_CBnkPtr;
static struct { U8 fixOverFlow16; } g_engineConfig;
#define SHARE_MEM shareMemory
#define ORDERQUEUE orders
static U8 thewCosts[] = {` + bytes(costs) + `};
static U8 actualTradeNames[] = {` + bytes(tradeNames) + `};
static U8 actualFoodTitle[] = {` + bytes(foodTitle) + String.raw`};
static U32 GamGetPersonCount(void) { return PERSON_COUNT; }
static U32 baye_hd_tool_count(void) { return 33; }
static void baye_hd_fight_input_begin(U8 kind) { (void)kind; assert(0); }
static void baye_hd_fight_input_end(void) { assert(0); }
static void hd_ai_retire(void) {}
static void hd_status_retire(void) {}
static int SysScrollingTimerOpen(int value) { return value; }
static void gam_clrlcd(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d; }
static void gam_rect(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d; }
static void GamStrShowS(int a,int b,U8* s) { (void)a;(void)b;assert(memcmp(s,actualFoodTitle,sizeof(actualFoodTitle)-1)==0); }
static U8* ResLoadToCon(U16 id,U16 item,U8 bank) {
    (void)bank; assert(id==IFACE_CONID && item==ConsumeThew); return thewCosts;
}
static void ResLoadToMem(U16 id,U16 item,U8* output) {
    assert(id==STRING_CONST);
    if(item==MENU_TSTR) memcpy(output,actualTradeNames,sizeof(actualTradeNames));
    else { assert(item==ATRR_STR60); memcpy(output,actualFoodTitle,sizeof(actualFoodTitle)); }
}
static unsigned messages, fullMessages, addCalls;
static void ShowConstStrMsg(U16 id) { assert(id==STR_NOPERSON || id==NOTE_STR9); ++messages; }
static void GamMsgBox(U8* text,U8 delay) { assert(text && delay==1); ++fullMessages; }
static U8 canAddOrder(OrderType* order) { assert(order->OrderId==EXCHANGE); ++addCalls; return 1; }
` + globals + '\n' + [
    'hd_next_input_seq', 'hd_battle_note_notify', 'baye_hd_battle_note_retire', 'baye_hd_person_properties_retire', 'hd_goods_clear', 'hd_menu_ids_clear',
    'hd_help_detail_clear', 'hd_city_info_notify','baye_hd_city_info_retire','baye_hd_view_retire', 'baye_hd_mini_map_retire',
    'baye_hd_menu_scope', 'baye_hd_menu_scope_default', 'baye_hd_menu_begin', 'baye_hd_menu_end',
    'baye_hd_set_menu', 'baye_hd_set_menu_index', 'baye_hd_menu_ids',
    'baye_hd_set_qty', 'baye_hd_qty_begin', 'baye_hd_qty_publish', 'baye_hd_qty_busy', 'baye_hd_qty_end'
].map(name => actualFunction('hd-bridge.c', name)).join('\n') + '\n' +
    actualFunction('gamEng.c', 'add_16') + '\n' +
    actualFunction('cityedit.c', 'GetCityPersons') + '\n' + actualFunction('cityedit.c', 'DelPerson') + '\n' +
    actualFunction('citycmde.c', 'IsManual') + '\n' + actualFunction('citycmde.c', 'OrderConsumeThew') + '\n' +
    actualFunction('citycmdd.c', 'AddOrderHead') + String.raw`
typedef struct { U32 seq; U8 context,kind; U16 count,index,idsCount; PersonID ids[2]; } MenuWait;
static MenuWait personWaits[4], tradeWait;
static unsigned personCalls, tradeCalls, qtyCalls;
static U16 actorChoice=1, tradeChoice, quantityChoice=7;
static U32 expectedMin=1, expectedMax=20, qtySessionAtWait, qtyInputAtWait;
static U32 qtyMinAtWait, qtyMaxAtWait, qtyInitialAtWait;
static void capture(MenuWait* out) {
    out->seq=g_hdMenuSeq; out->context=g_hdMenuContext; out->kind=g_hdMenuKind;
    out->count=g_hdMenuCount; out->index=g_hdMenuIndex; out->idsCount=g_hdMenuIdsCount;
    memcpy(out->ids,g_hdMenuIds,sizeof(out->ids));
}
/* These replacements terminate actual UI waits; they do not implement trade rules. */
FAR PersonID ShowPersonControlInner(PersonID* ids,U32 count,PersonID initial,U8 a,U8 b,U8 c,U8 d) {
    (void)a;(void)b;(void)c;(void)d;
    assert(g_hdMenuActive && g_hdMenuContext==BAYE_HD_MENU_CONTEXT_CITY && g_hdMenuKind==BAYE_HD_MENU_PERSON);
    assert(initial==0 && count==2 && ids[0]==10 && ids[1]==12 && personCalls<4);
    const U8 names[8]={'A',0,0,0,'B',0,0,0};
    baye_hd_set_menu(names,4,(U16)count,initial);
    baye_hd_menu_ids(g_hdDetailGeneration,g_hdMenuSeq,BAYE_HD_MENU_PERSON,ids,count);
    capture(&personWaits[personCalls]);
    return personCalls++ ? 0xffff : actorChoice;
}
FAR U16 PlcSplMenuInner(RECT* rect,U16 initial,U8* names) {
    assert(g_hdMenuActive && initial==0 && ++tradeCalls==1);
    U16 itemLen=(rect->ex-rect->sx)/ASC_WID;
    U16 count=(U16)strlen((char*)names)/itemLen;
    baye_hd_set_menu(names,itemLen,count,initial);
    capture(&tradeWait);
    assert(g_hdMenuContext==BAYE_HD_MENU_CONTEXT_CITY && g_hdMenuKind==BAYE_HD_MENU_EXCHANGE);
    assert(itemLen==4 && count==2 && g_hdMenuIdsCount==0 && g_hdMenuIdsSeq==0);
    assert(memcmp(g_hdMenuGbk,actualTradeNames,8)==0 && g_hdMenuGbk[8]==0);
    if(tradeChoice!=0xffff) baye_hd_set_menu_index(tradeChoice);
    return tradeChoice;
}
static U32 NumOperate(U32 min,U32 max,U32 initial) {
    assert(++qtyCalls==1 && !g_hdMenuActive && g_hdMenuContext==0 && g_hdMenuKind==0);
    assert(min==expectedMin && max==expectedMax && initial==max);
    U32 session=baye_hd_qty_begin();
    baye_hd_qty_publish(session,initial,min,max,0,1,BAYE_HD_QTY_NO_KEY);
    assert(g_hdQtyActive && g_hdQtyReady && g_hdQtyInputSeq==0);
    qtySessionAtWait=session; qtyInputAtWait=g_hdQtyInputSeq;
    qtyMinAtWait=g_hdQtyMin; qtyMaxAtWait=g_hdQtyMax; qtyInitialAtWait=g_hdQtyValue;
    baye_hd_qty_busy(session);
    U32 value=quantityChoice==0xffff?initial:quantityChoice;
    assert(quantityChoice==0xffff || (value>=min && value<=max));
    baye_hd_qty_end(session,value,min,max,quantityChoice==0xffff?40:39);
    return quantityChoice;
}
` + actualFunction('showface.c', 'ShowPersonControl') + '\n' + actualFunction('PublicFun.c', 'PlcSplMenu') + '\n' +
    actualFunction('cityedit.c', 'GetFood') + '\n' + actualFunction('citycmdc.c', 'ExchangeMake') + String.raw`
static void setup(void) {
    memset(g_Cities,0,sizeof(g_Cities)); memset(g_Persons,0,sizeof(g_Persons));
    for(unsigned i=0;i<2000;i++)g_PersonsQueue[i]=(PersonID)(i%PERSON_COUNT);
    memset(orders,0xa5,sizeof(orders)); for(unsigned i=0;i<ORDER_MAX;i++)orders[i].OrderId=255;
    g_Cities[2]=(CityType){.Belong=7,.PersonQueue=0,.Persons=3,.Money=100,.Food=20};
    g_Cities[3].PersonQueue=3; g_PersonsQueue[0]=10;g_PersonsQueue[1]=11;g_PersonsQueue[2]=12;
    g_Persons[10]=(PersonType){.Belong=7,.Thew=100};g_Persons[11].Belong=8;
    g_Persons[12]=(PersonType){.Belong=7,.Thew=100};
    g_engineConfig.fixOverFlow16=1; g_hdMenuSeq=100;g_hdDetailGeneration=7;
    g_hdQtySession=0;g_hdQtyActive=g_hdQtyReady=0;
}
static void assertRetired(void) {
    assert(!g_hdMenuActive && !g_hdMenuContext && !g_hdMenuKind && !g_hdMenuIdsCount);
    assert(!g_hdQtyActive && !g_hdQtyReady && !hdMenuNextContext && !hdMenuNextKind);
}
static void assertSuccess(U16 money,U16 food) {
    assert(g_Cities[2].Money==money && g_Cities[2].Food==food && g_Persons[12].Thew==88);
    assert(g_Cities[2].Persons==2 && g_Cities[3].PersonQueue==2);
    assert(g_PersonsQueue[0]==10 && g_PersonsQueue[1]==11 && g_PersonsQueue[2]==3);
    assert(g_PersonsQueue[199]==199 && g_PersonsQueue[200]==0 && g_PersonsQueue[1999]==199);
    assert(orders[0].OrderId==EXCHANGE && orders[0].Person==12 && orders[0].City==2 && orders[0].TimeCount==0);
    /* Object/Arms/Food/Money/Consume are uninitialized native stack fields, not business assertions. */
    for(unsigned i=1;i<ORDER_MAX;i++)assert(orders[i].OrderId==255);
    assert(g_Persons[10].Thew==100 && addCalls==1 && !messages && !fullMessages);
    assert(personCalls==1 && tradeCalls==1 && personWaits[0].seq==101 && tradeWait.seq==103 && g_hdMenuSeq==104);
    assert(personWaits[0].idsCount==2 && personWaits[0].ids[0]==10 && personWaits[0].ids[1]==12);
    assertRetired();
}
static void assertCancelled(void) {
    assert(g_Cities[2].Money==100 && g_Cities[2].Food==20 && g_Persons[12].Thew==100);
    assert(g_Cities[2].Persons==3 && g_Cities[3].PersonQueue==3 && g_PersonsQueue[2]==12);
    for(unsigned i=0;i<ORDER_MAX;i++)assert(orders[i].OrderId==255);
    assert(personCalls==2 && personWaits[0].seq==101 && tradeWait.seq==103 && personWaits[1].seq==105 && g_hdMenuSeq==106);
    assert(personWaits[1].index==0 && personWaits[1].kind==BAYE_HD_MENU_PERSON && personWaits[1].ids[1]==12);
    assert(!addCalls && !messages && !fullMessages); assertRetired();
}
int main(int argc,char** argv) {
    assert(argc==2); unsigned scenario=(unsigned)strtoul(argv[1],NULL,10);setup();
    if(scenario==1) {
        assert(ExchangeMake(2)==1); assertSuccess(65,27);
        assert(qtyCalls==1 && qtySessionAtWait==1 && qtyInputAtWait==0 && qtyMinAtWait==1 && qtyMaxAtWait==20 && qtyInitialAtWait==20);
        assert(g_hdQtyLastKey==39 && g_hdQtyInputSeq==1);
    } else if(scenario==2) {
        tradeChoice=1;quantityChoice=7;expectedMax=20;g_Cities[2].Money=29990;
        ExchangeMake(2);assertSuccess(30000,13);assert(qtyCalls==1 && g_hdQtyLastKey==39);
    } else if(scenario==3) {
        tradeChoice=0xffff;ExchangeMake(2);assertCancelled();assert(!qtyCalls && g_hdQtySession==0);
    } else if(scenario==4) {
        quantityChoice=0xffff;ExchangeMake(2);assertCancelled();assert(qtyCalls==1 && g_hdQtyLastKey==40 && g_hdQtyInputSeq==1);
    } else if(scenario==5) {
        g_Persons[12].Thew=11;ExchangeMake(2);
        assert(personCalls==2 && !tradeCalls && !qtyCalls && messages==1 && !addCalls);
        assert(personWaits[1].seq==103 && personWaits[1].kind==BAYE_HD_MENU_PERSON && g_hdMenuSeq==104);
        assert(g_Persons[12].Thew==11 && g_Cities[2].Money==100 && g_Cities[2].Persons==3);assertRetired();
    } else if(scenario==6 || scenario==7) {
        tradeChoice=scenario==7?1:0;
        if(scenario==6)g_Cities[2].Money=4;else g_Cities[2].Food=0;
        ExchangeMake(2);assertSuccess(scenario==6?4:100,scenario==6?20:0);assert(!qtyCalls);
    } else if(scenario==8) {
        for(unsigned i=0;i<ORDER_MAX;i++)orders[i].OrderId=0;
        ExchangeMake(2);
        assert(g_Cities[2].Money==65 && g_Cities[2].Food==27 && g_Persons[12].Thew==88);
        assert(g_Cities[2].Persons==3 && g_Cities[3].PersonQueue==3 && g_PersonsQueue[2]==12);
        assert(fullMessages==1 && addCalls==1);for(unsigned i=0;i<ORDER_MAX;i++)assert(orders[i].OrderId==0);
        assertRetired();
    } else if(scenario==9) {
        ExchangeMake(2);assertSuccess(65,27);
        RECT r={0,0,24,24};baye_hd_menu_begin();
        assert(g_hdMenuActive && !g_hdMenuContext && !g_hdMenuKind && g_hdMenuSeq==105);
        baye_hd_menu_end();
        baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_SUB);
        baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
        baye_hd_menu_begin();assert(g_hdMenuKind==BAYE_HD_MENU_SUB);baye_hd_menu_end();
        (void)r;assertRetired();
    } else if(scenario==10) {
        g_hdMenuSeq=UINT32_MAX-1;g_hdQtySession=UINT32_MAX;
        ExchangeMake(2);
        assert(personWaits[0].seq==UINT32_MAX && tradeWait.seq==2 && g_hdMenuSeq==3);
        assert(qtySessionAtWait==1 && g_hdQtySession==1 && g_hdQtyInputSeq==1);assertRetired();
        U32 retired=g_hdQtyInputSeq;baye_hd_qty_publish(1,999,1,999,0,1,37);
        assert(g_hdQtyInputSeq==retired && !g_hdQtyActive);
    } else if(scenario==11 || scenario==12) {
        g_Cities[2].Food=65534;g_engineConfig.fixOverFlow16=scenario==11;
        ExchangeMake(2);assertSuccess(65,scenario==11?65535:5);
    } else assert(0);
    puts("production ExchangeMake and menu/quantity protocol passed");return 0;
}
`;

let temporary, executable;
before(async () => {
    temporary = mkdtempSync(join(tmpdir(), 'baye-hd-trade-'));
    const filename = join(temporary, 'trade.c');
    executable = join(temporary, process.platform === 'win32' ? 'trade.exe' : 'trade');
    writeFileSync(filename, fixture);
    try { await run(process.env.CC || 'cc', ['-std=c99', '-Wall', '-Wextra', filename, '-o', executable], { timeout: 20000 }); }
    catch (error) { throw new Error('Production trade fixture compilation failed: ' +
        (error.stderr?.split(/\r?\n/).filter(s => /error:|fatal error:/.test(s)).join('\n') || error.message)); }
});
after(() => {
    if (!temporary) return;
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith('baye-hd-trade-'));
    rmSync(temporary, { recursive: true, force: true });
});

const scenarios = [
    'buy publishes CITY EXCHANGE kind5 with original two GBK names, quantity bounds and a retired owner',
    'sell retains native price2 and Money30000 cap',
    'buy/sell selector cancellation returns fresh PERSON with index0 and unchanged business state',
    'quantity cancellation returns fresh PERSON and keeps only its quantity EXIT receipt',
    'actual LIB Thew12 eligibility blocks exhausted actors before opening the selector',
    'legacy buy with Money4 keeps its no-quantity order and stamina behavior',
    'legacy sell with Food0 keeps its no-quantity order and stamina behavior',
    'full native order queue keeps earlier resource/stamina changes and does not remove the actor',
    'trade scope retires and cannot leak into a later generic or explicitly scoped menu',
    'menu and quantity U32 tokens skip zero and reject publication after retirement',
    'fixOverFlow16 buy saturates Food according to the real add_16 implementation',
    'legacy buy without fixOverFlow16 retains U16 Food wrap'
];
scenarios.forEach((name, index) => test('real C ' + name, async () => {
    const result = await run(executable, [String(index + 1)], { timeout: 20000 });
    assert.match(result.stdout, /production ExchangeMake and menu\/quantity protocol passed/);
}));
