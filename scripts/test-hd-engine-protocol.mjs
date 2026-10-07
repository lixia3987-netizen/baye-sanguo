#!/usr/bin/env node
// Compile the actual C protocol helpers and input wrappers. Rendering and
// resources are fixtures; these tests do not replace a real WASM battle run.
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
const directory = join(root, 'vendor/iBaye/src');
const read = (filename) => readFileSync(join(directory, filename), 'utf8').replace(/\r\n/g, '\n');
const bridge = read('hd-bridge.c');
const header = read('hd-bridge.h');
const constants = header.split('\n').filter((line) => /^#define (?:BAYE_HD_|VK_DIGIT0)/.test(line)).join('\n');
const run = promisify(execFile);

function actualFunction(filename, name) {
    const source = filename === 'hd-bridge.c' ? bridge : read(filename);
    const pattern = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm');
    const match = pattern.exec(source);
    assert.ok(match, `actual ${filename}::${name} exists`);
    const end = source.indexOf('\n}', match.index);
    assert.ok(end > match.index, `actual ${filename}::${name} closes`);
    return source.slice(match.index, end + 2);
}

const speTypes = header.match(/typedef struct HdSpeScope \{[\s\S]*?\} HdSpeScope;/)[0];
const speHelpers = bridge.slice(bridge.indexOf('static void hd_spe_notify'), bridge.indexOf('void baye_hd_set_qty'));
const globals = bridge.slice(0, bridge.indexOf('static void copy_gbk')).replace(/^#include[^\n]*\n/gm, '');
const helpers = [
    'hd_next_input_seq', 'baye_hd_begin_spe', 'baye_hd_fight_actor', 'baye_hd_fight_input_begin', 'baye_hd_fight_input_end',
    'baye_hd_take_fight_action', 'baye_hd_map_input_begin', 'baye_hd_menu_scope', 'baye_hd_menu_scope_default', 'baye_hd_menu_begin',
    'baye_hd_menu_end', 'baye_hd_march_phase', 'baye_hd_march_begin', 'baye_hd_march_selected',
    'baye_hd_march_end', 'copy_gbk', 'baye_hd_set_report', 'baye_hd_report_begin', 'baye_hd_report_end',
    'baye_hd_record_begin', 'baye_hd_record_index', 'baye_hd_record_end', 'baye_hd_set_menu', 'baye_hd_set_menu_index',
    'baye_hd_set_fight', 'baye_hd_set_qty', 'baye_hd_qty_begin', 'baye_hd_qty_publish',
    'baye_hd_qty_busy', 'baye_hd_qty_end', 'baye_hd_qty_invalidate', 'baye_hd_set_ready', 'baye_hd_world_commit',
    'baye_hd_set_fight_phase', 'baye_hd_set_fight_wait', 'baye_hd_set_help', 'baye_hd_set_map_pick',
    'baye_hd_set_battle_pick', 'baye_hd_set_march', 'baye_hd_clear_march_ok'
].map((name) => actualFunction('hd-bridge.c', name)).join('\n');
const common = String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;
typedef uint16_t U16;
typedef int16_t I16;
typedef uint32_t U32;
typedef uint16_t PersonID;
typedef uint16_t ToolID;
typedef uint16_t SkillID;
typedef struct { int sx, ex, sy, ey; } RECT;
typedef struct { U8 x,y,setx,sety; } CitySetType;
U8 g_FlipDrawing = 0, g_paintColor = 0xff;
#define FAR
#define FGTA_MAX 20
#define MAIN_SPE 3
#define MAKER_SPE 6
#define STACHG_SPE 27
#define EM_ASM(...) ((void)0)
#define gam_strlen(text) strlen((const char*)(text))
#define STRING_CONST 0
#define STR_GAMEWON 1
#define STR_GAMELOST 2
#define MNU_EXIT 0xff
static void ResLoadToMem(int resource, int id, U8* output) {
    (void)resource; output[0] = (U8)id; output[1] = 0;
}
` + constants + '\n' + speTypes + '\n' + globals + '\nvoid baye_hd_spe_invalidate(void);\n' + helpers + '\n' + speHelpers + String.raw`
static int scrolling;
static int SysScrollingTimerOpen(int value) { int old = scrolling; scrolling = value; return old; }
`;

async function compile(source) {
    const temporary = mkdtempSync(join(tmpdir(), 'baye-hd-protocol-'));
    try {
        const filename = join(temporary, 'protocol.c');
        const executable = join(temporary, process.platform === 'win32' ? 'protocol.exe' : 'protocol');
        writeFileSync(filename, source);
        await run(process.env.CC || 'cc', ['-std=c99', '-Wall', '-Wextra', filename, '-o', executable], { timeout: 20000 });
        const result = await run(executable, [], { timeout: 20000 });
        assert.match(result.stdout, /passed/);
    } finally { assert.equal(dirname(resolve(temporary)), resolve(tmpdir()), 'Cleanup stays in the explicit temporary directory');
        assert.ok(basename(temporary).startsWith('baye-hd-protocol-'), 'Cleanup targets only this fixture');
        rmSync(temporary, { recursive: true, force: true }); }
}

const quantityFixture = common + String.raw`
typedef int16_t I16;
typedef int32_t I32;
typedef struct { U8 type; U16 param; I16 x,y; } GMType;
typedef struct { I16 left,top,right,bottom; } Rect;
typedef struct { I16 currentX,currentY,startX,startY; U8 completed,moved; } Touch;
#define VM_CHAR_FUN 0x05
#define VM_TOUCH 0x10
#define VT_TOUCH_DOWN 1
#define VT_TOUCH_UP 2
#define VT_TOUCH_MOVE 3
#define VK_UP 0x22
#define VK_DOWN 0x23
#define VK_LEFT 0x24
#define VK_RIGHT 0x25
#define VK_HELP 0x26
#define VK_ENTER 0x27
#define VK_EXIT 0x28
#define WK_SX 0
#define WK_EX 160
#define WK_SY 0
#define WK_EY 160
#define ASC_WID 6
#define ASC_HGT 8
#define SCR_WID 240
#define ATRR_STR63 63
#define ATRR_STR64 64
static U8 g_engineDebug;
static Rect MakeRect(I16 x,I16 y,I16 width,I16 height) {
    Rect result={x,y,(I16)(x+width),(I16)(y+height)};return result;
}
static void touchDrawButton(Rect rectangle,const char* text) { (void)rectangle;(void)text; }
static void touchUpdate(Touch* touch,GMType message) {
    touch->currentX=message.x;touch->currentY=message.y;
    if(message.param==VT_TOUCH_DOWN) {touch->startX=message.x;touch->startY=message.y;touch->moved=0;}
    touch->completed=message.param==VT_TOUCH_UP;
}
static int touchIsPointInRect(I16 x,I16 y,Rect rectangle) {
    return x>=rectangle.left && x<rectangle.right && y>=rectangle.top && y<rectangle.bottom;
}
static I32 limitValueInRange(I32 value,I32 minimum,I32 maximum) {
    return value<minimum?minimum:(value>maximum?maximum:value);
}
static void gam_ltoa(U32 value,U8* output,int base) { assert(base==10);sprintf((char*)output,"%u",value); }
static void GamStrShowS(int x,int y,U8* text) { (void)x;(void)y;(void)text; }
static void gam_savscr(void) {}
static void gam_restorescr(void) { assert(!g_hdQtyReady); }
static void gam_clrlcd(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d;assert(!g_hdQtyReady); }
static void gam_rect(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d;assert(!g_hdQtyReady); }
static void gam_revlcd(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d;assert(!g_hdQtyReady); }
static void GamAsciiS(int x,int y,int character) { (void)x;(void)y;(void)character;assert(!g_hdQtyReady); }
typedef struct {
    U8 type;U16 key;I16 x,y;U32 value;U8 cursor;U32 step,seq;U16 last;
} QtyMessage;
static const QtyMessage* script;
static unsigned scriptCount,scriptIndex;
static U32 expectedSession;
static void GamGetMsg(GMType* message) {
    assert(scriptIndex<scriptCount);
    const QtyMessage* next=&script[scriptIndex++];
    if(!expectedSession)expectedSession=g_hdQtySession;
    assert(g_hdQtyActive && g_hdQtyReady && g_hdQtySession==expectedSession);
    assert(g_hdQtyValue==next->value && g_hdQtyCursor==next->cursor && g_hdQtyStep==next->step);
    assert(g_hdQtyInputSeq==next->seq && g_hdQtyLastKey==next->last);
    message->type=next->type;message->param=next->key;message->x=next->x;message->y=next->y;
}
static void useScript(const QtyMessage* messages,unsigned count) {
    script=messages;scriptCount=count;scriptIndex=0;expectedSession=0;
}
FAR U32 NumOperateInner(U32 minimum,U32 maximum,U32 current);
` + actualFunction('tactic.c', 'NumOperate') + '\n' + actualFunction('tactic.c', 'NumOperateInner');

test('real native quantity publishes exact character receipts after processing and preserves no-op, cursor and digit behavior', async () => {
    await compile(quantityFixture + String.raw`
int main(void) {
    const QtyMessage messages[]={
        {VM_CHAR_FUN,VK_RIGHT,0,0,20,2,1,0,BAYE_HD_QTY_NO_KEY},
        {VM_CHAR_FUN,VK_LEFT,0,0,20,2,1,1,VK_RIGHT},
        {VM_CHAR_FUN,VK_UP,0,0,20,1,10,2,VK_LEFT},
        {VM_CHAR_FUN,VK_LEFT,0,0,30,1,10,3,VK_UP},
        {VM_CHAR_FUN,VK_LEFT,0,0,30,0,100,4,VK_LEFT},
        {VM_CHAR_FUN,VK_DOWN,0,0,30,0,100,5,VK_LEFT},
        {VM_CHAR_FUN,VK_UP,0,0,30,0,100,6,VK_DOWN},
        {VM_CHAR_FUN,VK_DIGIT0,0,0,130,0,100,7,VK_UP},
        {VM_CHAR_FUN,VK_DIGIT0+9,0,0,130,0,100,8,VK_DIGIT0},
        {0,0,0,0,139,0,100,9,VK_DIGIT0+9},
        {VM_TOUCH,VT_TOUCH_DOWN,66,96,139,0,100,9,VK_DIGIT0+9},
        {VM_TOUCH,VT_TOUCH_UP,66,96,139,0,100,9,VK_DIGIT0+9},
        {VM_CHAR_FUN,VK_DIGIT0+9,0,0,999,0,100,9,VK_DIGIT0+9},
        {VM_CHAR_FUN,VK_UP,0,0,999,0,100,10,VK_DIGIT0+9},
        {VM_TOUCH,VT_TOUCH_UP,66,96,999,0,100,11,VK_UP},
        {VM_CHAR_FUN,VK_DIGIT0,0,0,1,0,100,11,VK_UP},
        {VM_CHAR_FUN,VK_ENTER,0,0,1,0,100,12,VK_DIGIT0}
    };
    useScript(messages,sizeof(messages)/sizeof(messages[0]));scrolling=7;
    assert(NumOperate(1,999,20)==1 && scrolling==7 && scriptIndex==scriptCount);
    assert(!g_hdQtyActive && !g_hdQtyReady && g_hdQtyValue==1);
    assert(g_hdQtyInputSeq==13 && g_hdQtyLastKey==VK_ENTER);
    puts("actual quantity character/no-op ACK, native digit/cursor semantics, touch/timer isolation and ready publication passed");
}
`);
});

test('real native quantity closes all key and touch exits with fresh owners while retaining original cancel return values', async () => {
    await compile(quantityFixture + String.raw`
int main(void) {
    const QtyMessage keys[]={
        {VM_CHAR_FUN,VK_LEFT,0,0,55,1,1,0,BAYE_HD_QTY_NO_KEY},
        {VM_CHAR_FUN,VK_RIGHT,0,0,55,0,10,1,VK_LEFT},
        {VM_CHAR_FUN,VK_EXIT,0,0,55,1,1,2,VK_RIGHT}
    };
    useScript(keys,sizeof(keys)/sizeof(keys[0]));scrolling=7;
    assert(NumOperate(1,99,55)==UINT32_MAX && scrolling==7);
    assert(!g_hdQtyActive && !g_hdQtyReady && g_hdQtyInputSeq==3 && g_hdQtyLastKey==VK_EXIT);
    U32 oldSession=g_hdQtySession;
    const QtyMessage confirm[]={{VM_TOUCH,VT_TOUCH_UP,35,96,55,1,1,0,BAYE_HD_QTY_NO_KEY}};
    useScript(confirm,1);
    assert(NumOperate(1,99,55)==55 && scriptIndex==1);
    assert(g_hdQtySession!=oldSession && !g_hdQtyActive && !g_hdQtyReady && g_hdQtyInputSeq==0);
    oldSession=g_hdQtySession;
    const QtyMessage cancel[]={{VM_TOUCH,VT_TOUCH_UP,99,96,55,1,1,0,BAYE_HD_QTY_NO_KEY}};
    useScript(cancel,1);
    assert(NumOperate(1,99,55)==0xffff && scriptIndex==1);
    assert(g_hdQtySession!=oldSession && !g_hdQtyActive && !g_hdQtyReady && g_hdQtyInputSeq==0);
    puts("actual quantity key/touch exit cleanup, original cancellation values and fresh session ownership passed");
}
`);
});

test('real C quantity tokens reject old callbacks across world commit, end and sequence wraparound', async () => {
    await compile(common + String.raw`
int main(void) {
    U32 old=baye_hd_qty_begin();
    baye_hd_qty_publish(old,10,1,999,2,1,BAYE_HD_QTY_NO_KEY);
    assert(g_hdQtyActive && g_hdQtyReady && !g_hdQtyInputSeq);
    baye_hd_qty_busy(old);assert(!g_hdQtyReady);
    baye_hd_qty_publish(old,10,1,999,2,1,0x25);
    assert(g_hdQtyInputSeq==1 && g_hdQtyLastKey==0x25 && g_hdQtyReady);
    baye_hd_world_commit();
    U32 invalidated=g_hdQtySession;
    assert(invalidated!=old && !g_hdQtyActive && !g_hdQtyReady);
    baye_hd_qty_publish(old,700,2,888,0,100,0x22);
    baye_hd_qty_end(old,700,2,888,0x27);
    assert(g_hdQtySession==invalidated && !g_hdQtyActive && !g_hdQtyReady && g_hdQtyValue==10);
    U32 fresh=baye_hd_qty_begin();baye_hd_qty_publish(fresh,30,1,999,2,1,BAYE_HD_QTY_NO_KEY);
    assert(fresh!=old && fresh!=invalidated && !g_hdQtyInputSeq && g_hdQtyLastKey==BAYE_HD_QTY_NO_KEY);
    baye_hd_qty_busy(old);baye_hd_qty_end(old,700,2,888,0x27);
    assert(g_hdQtyReady && g_hdQtyActive && g_hdQtyValue==30);
    g_hdQtyInputSeq=UINT32_MAX;baye_hd_qty_busy(fresh);
    baye_hd_qty_publish(fresh,30,1,999,2,1,0x25);
    assert(g_hdQtyInputSeq==1 && g_hdQtyReady);
    baye_hd_qty_end(fresh,30,1,999,0x27);
    baye_hd_qty_publish(fresh,900,1,999,0,100,0x22);
    assert(!g_hdQtyActive && !g_hdQtyReady && g_hdQtyValue==30 && g_hdQtyInputSeq==2);
    g_hdQtySession=UINT32_MAX;assert(baye_hd_qty_begin()==1);
    baye_hd_qty_invalidate();assert(g_hdQtySession==2 && !g_hdQtyActive && !g_hdQtyReady);
    puts("quantity stale-session rejection, committed world invalidation, closed-owner isolation and nonzero wraparound passed");
}
`);
});

test('public quantity bridge reads native receipts without writes and explicitly detects legacy or incomplete protocols', () => {
    const source = readFileSync(join(root, 'js/bridge.js'), 'utf8');
    const numberStart = source.indexOf('    function hdReadNum(obj, name) {');
    const numberEnd = source.indexOf('\n    }', numberStart);
    const qtyStart = source.indexOf('        qty: function () {');
    const qtyEnd = source.indexOf('        toolName:', qtyStart);
    assert.ok(numberStart >= 0 && numberEnd > numberStart && qtyStart >= 0 && qtyEnd > qtyStart);
    const numberFunction = source.slice(numberStart, numberEnd + '\n    }'.length);
    const quantityFunction = source.slice(qtyStart + '        qty: '.length, qtyEnd).trim().replace(/,$/, '');
    let data = null;
    const context = vm.createContext({ baye: { ensureData: () => data }, hdNote() {} });
    const qty = vm.runInContext(numberFunction + '\n(' + quantityFunction + ')', context);
    assert.equal(qty().protocol, false);
    assert.equal(qty().active, 0);
    data = { g_hdQtyActive: 1, g_hdQtyValue: 30, g_hdQtyMin: 1, g_hdQtyMax: 999 };
    assert.equal(qty().protocol, false);
    assert.deepEqual(JSON.parse(JSON.stringify(qty())), {
        active: 1, value: 30, min: 1, max: 999, protocol: false,
        session: 0, inputSeq: 0, lastKey: 0, cursor: 0, step: 0, ready: 0
    });
    const native = {
        ...data, g_hdQtySession: 4294967295, g_hdQtyInputSeq: 0, g_hdQtyLastKey: 65535,
        g_hdQtyCursor: 2, g_hdQtyStep: { value: 1 }, g_hdQtyReady: 1
    };
    data = new Proxy(native, { set() { throw new Error('quantity read must never write native fields'); } });
    assert.deepEqual(JSON.parse(JSON.stringify(qty())), {
        active: 1, value: 30, min: 1, max: 999, protocol: true,
        session: 4294967295, inputSeq: 0, lastKey: 65535, cursor: 2, step: 1, ready: 1
    });
    for (const field of ['Session', 'InputSeq', 'LastKey', 'Cursor', 'Step', 'Ready']) {
        data = { ...native };
        delete data['g_hdQty' + field];
        assert.equal(qty().protocol, false, `missing ${field} selects the legacy path`);
        data['g_hdQty' + field] = null;
        assert.equal(qty().protocol, false, `null ${field} selects the legacy path`);
    }
    data = { ...native, g_hdQtyActive: 0, g_hdQtyReady: 0 };
    assert.equal(qty().protocol, true, 'protocol capability survives an inactive owner');
    assert.equal(qty().ready, 0);
});

test('real C bridge distinguishes current input from stale bytes and cross-menu action commits', async () => {
    await compile(common + String.raw`
int main(void) {
    U32 seq;
    U16 choice = 42;
    assert(g_hdMenuActive == 0 && g_hdFightInputKind == 0 && g_hdFightActor == 255);
    assert(g_hdMarchPhase == 0 && g_hdMarchOrigin == 255 && g_hdMarchSelected == 0);
    baye_hd_set_fight(1, 0);
    baye_hd_fight_actor(0);
    baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_MOVE);
    seq = g_hdFightInputSeq;
    assert(g_hdFightActor == 0 && g_hdFightInputKind == BAYE_HD_FIGHT_INPUT_MOVE);
    baye_hd_fight_input_end();
    assert(g_hdFightInputSeq != seq && g_hdFightInputKind == 0 && g_hdFightActor == 255);
    baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_AIM);
    assert(g_hdFightActor == 0); /* actor survives a suspended input internally */
    baye_hd_fight_input_end();

    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_FIGHT, BAYE_HD_FIGHT_INPUT_ACTION);
    baye_hd_menu_begin();
    seq = g_hdMenuSeq;
    baye_hd_set_menu((const U8*)"attackskillrestlook", 4, 4, 0);
    baye_hd_set_menu((const U8*)"attackskillrestlook", 4, 4, 1);
    assert(g_hdMenuSeq == seq && g_hdMenuActive == 1 && g_hdMenuIndex == 1);
    g_hdFightActCommit = 0;
    assert(baye_hd_take_fight_action(&choice) == 1 && choice == 0 && g_hdFightActCommit == 255);
    assert(baye_hd_take_fight_action(&choice) == 0); /* exact one consumption */
    baye_hd_menu_end();
    assert(!g_hdMenuActive && g_hdMenuContext == 0 && g_hdMenuKind == 0 && g_hdMenuCount == 4);
    assert(g_hdMenuGbk[0] == 'a'); /* bytes intentionally remain; Active is authoritative */

    const U8 kinds[] = {BAYE_HD_FIGHT_INPUT_SYSTEM, BAYE_HD_FIGHT_INPUT_RETREAT,
        BAYE_HD_FIGHT_INPUT_SETTINGS, BAYE_HD_FIGHT_INPUT_SKILL};
    for (unsigned i = 0; i < sizeof(kinds); ++i) {
        baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_FIGHT, kinds[i]);
        baye_hd_menu_begin();
        g_hdFightActCommit = 3;
        choice = 42;
        assert(!baye_hd_take_fight_action(&choice) && choice == 42);
        baye_hd_menu_end();
        assert(g_hdFightActCommit == 255); /* a pending action cannot escape into the next menu */
    }
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_FUNCTION, BAYE_HD_MENU_ROOT);
    baye_hd_menu_begin();
    g_hdFightActCommit = 0;
    assert(!baye_hd_take_fight_action(&choice));
    baye_hd_menu_end();
    baye_hd_menu_begin();
    assert(g_hdMenuContext == 0); /* scopes are consumed, never inherited */
    baye_hd_menu_end();

    g_hdFightInputSeq = UINT32_MAX;
    baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_PICK);
    assert(g_hdFightInputSeq == 1 && g_hdFightActor == 255);
    g_hdMarchSession = UINT16_MAX;
    baye_hd_march_begin(0);
    assert(g_hdMarchSession == 1 && g_hdMarchOrigin == 0);
    baye_hd_march_phase(BAYE_HD_MARCH_PERSONS);
    seq = g_hdMarchInputSeq;
    baye_hd_march_phase(BAYE_HD_MARCH_PERSONS);
    assert(g_hdMarchInputSeq != seq); /* same-phase re-entry is a new user input */
    baye_hd_march_selected(2);
    baye_hd_march_end(1);
    assert(g_hdMarchPhase == 7 && g_hdMarchSelected == 2 && g_hdMarchOrigin == 0);
    baye_hd_march_begin(3);
    baye_hd_march_end(0);
    assert(g_hdMarchPhase == 0 && g_hdMarchSelected == 0 && g_hdMarchOrigin == 255);
    seq = g_hdFightInputSeq;
    baye_hd_set_ready(1);
    assert(g_hdFightInputSeq != seq && g_hdFightInputKind == 0 && !g_hdMenuActive);
    puts("bridge protocol: current input, stale bytes, mailbox isolation and wraparound passed");
}
`);
});

test('real C menu bridge preserves packed GBK names after embedded NUL and clears old menu slots', async () => {
    await compile(common + String.raw`
int main(void) {
    /* A city armament menu leaves meaningful bytes at the next person's slot. */
    const U8 previous[] = "scoutenlallocationmarch";
    const U8 persons[16] = {
        0xc2, 0xed, 0xcd, 0xe6, 0, 0, 0, 0, /* 马玩, GBK */
        0xd1, 0xee, 0xc7, 0xef, 0, 0, 0, 0  /* 杨秋, GBK */
    };
    baye_hd_set_menu(previous, 4, (U16)(gam_strlen(previous) / 4), 0);
    assert(g_hdMenuGbk[8] == 'a');
    baye_hd_set_menu(persons, 8, 2, 1);
    assert(g_hdMenuItemLen == 8 && g_hdMenuCount == 2 && g_hdMenuIndex == 1);
    assert(memcmp(g_hdMenuGbk, persons, sizeof(persons)) == 0);
    for (U32 i = sizeof(persons); i < BAYE_HD_MENU_MAX; ++i) assert(g_hdMenuGbk[i] == 0);

    /* PlcSplMenu derives count by floor(strlen/len): copying complete slots
     * stays within its original string, even with a partial trailing item. */
    const U8 native[] = "abcdefghijklmnopqr";
    baye_hd_set_menu(native, 4, (U16)(gam_strlen(native) / 4), 2);
    assert(g_hdMenuCount == 4 && memcmp(g_hdMenuGbk, native, 16) == 0);
    assert(g_hdMenuGbk[16] == 0);
    baye_hd_set_menu((const U8*)"abcd", 4, 1, 0);
    assert(g_hdMenuCount == 1 && g_hdMenuGbk[4] == 0 && g_hdMenuGbk[8] == 0);

    /* Oversized metadata can expose only complete slots and a final NUL. */
    U8 large[BAYE_HD_MENU_MAX];
    memset(large, 0x7f, sizeof(large));
    baye_hd_set_menu(large, 7, UINT16_MAX, 0);
    U32 capacity = (BAYE_HD_MENU_MAX - 1) / 7;
    assert(g_hdMenuCount == capacity && g_hdMenuGbk[capacity * 7 - 1] == 0x7f);
    for (U32 i = capacity * 7; i < BAYE_HD_MENU_MAX; ++i) assert(g_hdMenuGbk[i] == 0);
    baye_hd_set_menu(large, UINT16_MAX, 2, 0);
    assert(g_hdMenuCount == 0 && g_hdMenuGbk[0] == 0);
    baye_hd_set_menu(NULL, 8, 2, 0);
    assert(g_hdMenuCount == 0 && g_hdMenuGbk[0] == 0);
    baye_hd_set_menu(persons, 0, 2, 0);
    assert(g_hdMenuCount == 0 && g_hdMenuGbk[0] == 0);
    puts("actual menu bytes: two GBK names, cleared stale slots and bounded fixed-width copy passed");
}
`);
});

test('real C picture menus publish title/period indexes without stale names or new input on redraw', async () => {
    await compile(common + String.raw`
int main(void) {
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_SYSTEM,BAYE_HD_MENU_TITLE);
    baye_hd_menu_begin();
    U32 seq=g_hdMenuSeq;
    baye_hd_set_menu((const U8*)"previous names",7,2,1);
    baye_hd_set_menu(NULL,0,3,0);
    assert(g_hdMenuActive && g_hdMenuContext==BAYE_HD_MENU_CONTEXT_SYSTEM && g_hdMenuKind==BAYE_HD_MENU_TITLE);
    assert(g_hdMenuCount==3 && g_hdMenuIndex==0 && g_hdMenuItemLen==0 && g_hdMenuSeq==seq);
    for(unsigned i=0;i<BAYE_HD_MENU_MAX;++i)assert(g_hdMenuGbk[i]==0);
    baye_hd_set_menu(NULL,0,3,2);
    assert(g_hdMenuCount==3 && g_hdMenuIndex==2 && g_hdMenuSeq==seq);
    baye_hd_menu_end();
    assert(!g_hdMenuActive && g_hdMenuCount==3 && g_hdMenuIndex==2);
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_SYSTEM,BAYE_HD_MENU_PERIOD);
    baye_hd_menu_begin();
    seq=g_hdMenuSeq;
    baye_hd_set_menu(NULL,0,4,3);
    assert(g_hdMenuCount==4 && g_hdMenuIndex==3 && g_hdMenuKind==BAYE_HD_MENU_PERIOD && g_hdMenuSeq==seq);
    baye_hd_set_menu(NULL,8,4,3);
    assert(g_hdMenuCount==0); /* absent text slots cannot claim names */
    baye_hd_menu_end();
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CAMPAIGN,BAYE_HD_MENU_SUCCESSOR);
    baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
    baye_hd_menu_begin();
    assert(g_hdMenuContext==BAYE_HD_MENU_CONTEXT_CAMPAIGN && g_hdMenuKind==BAYE_HD_MENU_SUCCESSOR);
    baye_hd_menu_end();
    puts("pure-index title/period menu and explicit successor scope preservation passed");
}
`);
});

test('real C defender menus override city defaults, ACK redraws and release their scope after the actual wait', async () => {
    await compile(common + String.raw`
int main(void) {
    const U8 names[24]={0xc0,0xee,0xc8,0xe5,0,0,0,0,0xd5,0xc5,0xc1,0xc9,0,0,0,0,0xc2,0xc0,0xb2,0xbc,0,0,0,0};
    baye_hd_set_fight(0,1); /* a previous winning battle has fully settled */
    U32 fightSeq=g_hdFightInputSeq;
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CAMPAIGN,BAYE_HD_CAMPAIGN_DEFENDERS);
    baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
    baye_hd_menu_begin();
    U32 seq=g_hdMenuSeq;
    baye_hd_set_menu(names,BAYE_HD_NAME_SLOT,3,0);
    assert(g_hdMenuActive && g_hdMenuContext==5 && g_hdMenuKind==2);
    assert(g_hdMenuCount==3 && g_hdMenuIndex==0 && memcmp(g_hdMenuGbk,names,sizeof(names))==0);
    assert(!g_hdFightActive && g_hdFightOver==1 && g_hdFightInputSeq==fightSeq);
    baye_hd_set_menu_index(2);
    assert(g_hdMenuIndex==2 && g_hdMenuSeq==seq); /* arrows ACK the current wait */
    baye_hd_set_menu(names,BAYE_HD_NAME_SLOT,3,2);
    assert(g_hdMenuIndex==2 && g_hdMenuSeq==seq); /* redraw cannot reopen it */
    baye_hd_menu_end();baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_NONE,0);
    assert(!g_hdMenuActive && g_hdMenuContext==0 && g_hdMenuKind==0 && g_hdMenuSeq!=seq);
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CAMPAIGN,BAYE_HD_CAMPAIGN_DEFENDERS);
    baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
    baye_hd_menu_begin();baye_hd_set_menu(names,BAYE_HD_NAME_SLOT,2,0);
    assert(g_hdMenuActive && g_hdMenuKind==2 && g_hdMenuCount==2 && g_hdMenuSeq!=seq);
    baye_hd_menu_end();baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_NONE,0);
    baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
    baye_hd_menu_begin();assert(g_hdMenuContext==1 && g_hdMenuKind==3);baye_hd_menu_end();
    /* Cancelling a pending scope must also restore the next ordinary picker. */
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CAMPAIGN,BAYE_HD_CAMPAIGN_DEFENDERS);
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_NONE,0);
    baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
    baye_hd_menu_begin();assert(g_hdMenuContext==1 && g_hdMenuKind==3);baye_hd_menu_end();
    assert(!g_hdFightActive && g_hdFightOver==1 && g_hdFightInputSeq==fightSeq);
    puts("explicit defender ownership, native index ACK, scene isolation and scope reset passed");
}
`);
});

test('real C record lifecycle separates 3 save slots from 4 load slots and ACKs index without reopening input', async () => {
    await compile(common + String.raw`
int main(void) {
    assert(!g_hdRecordActive && g_hdRecordMode==0);
    baye_hd_record_begin(1,0,3);
    U32 seq=g_hdRecordSeq;
    assert(g_hdRecordActive && g_hdRecordMode==1 && g_hdRecordIndex==0 && g_hdRecordCount==3 && seq);
    baye_hd_record_index(2);
    assert(g_hdRecordActive && g_hdRecordIndex==2 && g_hdRecordSeq==seq);
    baye_hd_record_end();
    assert(!g_hdRecordActive && g_hdRecordMode==0 && g_hdRecordCount==0 && g_hdRecordSeq!=seq);
    seq=g_hdRecordSeq;
    baye_hd_record_begin(2,1,4);
    assert(g_hdRecordActive && g_hdRecordMode==2 && g_hdRecordCount==4 && g_hdRecordIndex==1 && g_hdRecordSeq!=seq);
    seq=g_hdRecordSeq;
    baye_hd_record_index(3);
    assert(g_hdRecordIndex==3 && g_hdRecordSeq==seq);
    baye_hd_record_end();
    assert(!g_hdRecordActive && g_hdRecordIndex==3); /* retained bytes have no ownership */
    baye_hd_record_begin(2,3,4);
    assert(g_hdRecordSeq!=seq); /* a rejected load may reopen, giving a fresh token */
    g_hdRecordSeq=UINT32_MAX;
    baye_hd_record_end();assert(g_hdRecordSeq==1);
    baye_hd_record_begin(1,0,3);assert(g_hdRecordSeq==2);
    baye_hd_record_end();
    puts("record save/load ownership, stable index ACK, re-entry and token wrap passed");
}
`);
});

test('real C nested reports restore outer text/person/kind with a fresh input sequence and respect the 16-frame boundary', async () => {
    await compile(common + String.raw`
int main(void) {
    baye_hd_set_report((const U8*)"outer",256,BAYE_HD_REPORT_GREPORT);
    assert(!g_hdReportActive && !g_hdReportInputSeq);
    baye_hd_report_begin(BAYE_HD_REPORT_GREPORT);
    U32 outerInput=g_hdReportInputSeq;
    U16 outerText=g_hdReportSeq;
    assert(g_hdReportActive && hdReportDepth==1 && strcmp((char*)g_hdReportGbk,"outer")==0);
    baye_hd_set_report((const U8*)"inner",599,BAYE_HD_REPORT_MSGBOX);
    assert(g_hdReportInputSeq==outerInput); /* text changes alone never open input */
    baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);
    U32 innerInput=g_hdReportInputSeq;
    assert(innerInput!=outerInput && g_hdReportPerson==599 && g_hdReportKind==BAYE_HD_REPORT_MSGBOX);
    baye_hd_report_end();
    assert(g_hdReportActive && hdReportDepth==1 && g_hdReportInputSeq!=outerInput && g_hdReportInputSeq!=innerInput);
    assert(strcmp((char*)g_hdReportGbk,"outer")==0 && g_hdReportPerson==256 && g_hdReportKind==BAYE_HD_REPORT_GREPORT);
    assert(g_hdReportSeq!=outerText);
    U32 restoredInput=g_hdReportInputSeq;
    baye_hd_report_end();
    assert(!g_hdReportActive && hdReportDepth==0 && g_hdReportInputSeq!=restoredInput);
    U8 text[32];
    for(unsigned i=0;i<16;++i) {
        snprintf((char*)text,sizeof(text),"report%u",i);
        baye_hd_set_report(text,(U16)i,(i%2)?BAYE_HD_REPORT_GREPORT:BAYE_HD_REPORT_MSGBOX);
        baye_hd_report_begin((i%2)?BAYE_HD_REPORT_GREPORT:BAYE_HD_REPORT_MSGBOX);
    }
    assert(hdReportDepth==16 && g_hdReportActive);
    for(unsigned depth=15;depth>0;--depth) {
        U32 previous=g_hdReportInputSeq;baye_hd_report_end();
        snprintf((char*)text,sizeof(text),"report%u",depth-1);
        assert(hdReportDepth==depth && g_hdReportActive && g_hdReportInputSeq!=previous);
        assert(strcmp((char*)g_hdReportGbk,(char*)text)==0 && g_hdReportPerson==depth-1);
        assert(g_hdReportKind==(((depth-1)%2)?BAYE_HD_REPORT_GREPORT:BAYE_HD_REPORT_MSGBOX));
    }
    baye_hd_report_end();assert(!g_hdReportActive && hdReportDepth==0);
    g_hdReportInputSeq=UINT32_MAX;
    baye_hd_set_report((const U8*)"wrap",0,BAYE_HD_REPORT_MSGBOX);
    baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);assert(g_hdReportInputSeq==1);
    baye_hd_report_end();assert(g_hdReportInputSeq==2 && !g_hdReportActive);
    puts("nested report restore, fresh ownership, bounded stack and wrap passed");
}
`);
});

test('real C new LIB/game invalidates nested reports, record ownership, fight/menu input and old march acknowledgement', async () => {
    await compile(common + String.raw`
int main(void) {
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_ROOT);baye_hd_menu_begin();
    baye_hd_fight_actor(2);baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_AIM);
    baye_hd_march_begin(8);baye_hd_march_selected(3);baye_hd_set_march(8,9,1,1);baye_hd_march_end(1);
    baye_hd_record_begin(2,3,4);
    baye_hd_set_report((const U8*)"outer",256,BAYE_HD_REPORT_GREPORT);baye_hd_report_begin(BAYE_HD_REPORT_GREPORT);
    baye_hd_set_report((const U8*)"inner",599,BAYE_HD_REPORT_MSGBOX);baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);
    U32 menu=g_hdMenuSeq,fight=g_hdFightInputSeq,record=g_hdRecordSeq,report=g_hdReportInputSeq,march=g_hdMarchInputSeq;
    assert(g_hdMarchOk && g_hdMarchPhase==BAYE_HD_MARCH_DEPARTED && hdReportDepth==2);
    baye_hd_set_ready(1);
    assert(g_hdEngineReady==1 && !g_hdMenuActive && g_hdMenuSeq!=menu);
    assert(g_hdFightInputKind==BAYE_HD_FIGHT_INPUT_BUSY && g_hdFightActor==255 && g_hdFightInputSeq!=fight);
    assert(!g_hdRecordActive && g_hdRecordMode==0 && g_hdRecordCount==0 && g_hdRecordSeq!=record);
    assert(!g_hdReportActive && hdReportDepth==0 && g_hdReportInputSeq!=report);
    assert(!g_hdMarchOk && g_hdMarchPhase==BAYE_HD_MARCH_IDLE && g_hdMarchOrigin==255 && !g_hdMarchSelected && g_hdMarchInputSeq!=march);
    baye_hd_report_end();baye_hd_report_end(); /* suspended old C callers may still unwind */
    assert(!g_hdReportActive && hdReportDepth==0);
    baye_hd_set_report((const U8*)"new game",2,BAYE_HD_REPORT_MSGBOX);baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);
    assert(g_hdReportActive && hdReportDepth==1 && strcmp((char*)g_hdReportGbk,"new game")==0);
    baye_hd_report_end();
    puts("new LIB/game clears every old input owner and march ACK passed");
}
`);
});

test('real C king choice owns SYSTEM/KING despite a previous winner, publishes matching names and ACKs its native index', async () => {
    const inner = actualFunction('gamEng.c', 'GamGetKingInner');
    const begin = inner.indexOf('#define UPDATE_UI()');
    const end = inner.indexOf('\n\n    UPDATE_UI();', begin);
    assert.ok(begin >= 0 && end > begin, 'actual king UPDATE_UI macro exists');
    const update = inner.slice(begin, end);
    await compile(common + String.raw`
#define PID(value) ((PersonID)(value))
#define KING_SY 12
#define KING_SX 0
#define KING_EX 30
#define IF_HAS_HOOK(name) if(0)
#define BIND_U8EX(...) ((void)0)
#define CALL_HOOK() ((void)0)
static PersonID choice;
static unsigned waits;
static void GetPersonName(PersonID id,U8* name) { snprintf((char*)name,16,"p%04u",id); }
` + actualFunction('hd-bridge.c', 'baye_hd_set_kings') + '\n' + actualFunction('hd-bridge.c', 'baye_hd_set_king_highlight') + String.raw`
static void GamShowKing(U8* names,U8 top) { (void)names;(void)top; }
static void gam_revlcd(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d; }
static U32 GetKingCitys(PersonID king,U8* cities) { (void)king;(void)cities;return 0; }
static PersonID GamGetKingInner(PersonID* kings,U32 num) {
    assert(num==3 && g_hdKingCount==3 && g_hdMenuCount==3 && g_hdMenuItemLen==8);
    assert(g_hdMenuActive && g_hdMenuContext==BAYE_HD_MENU_CONTEXT_SYSTEM && g_hdMenuKind==BAYE_HD_MENU_KING);
    assert(g_hdMenuIndex==0 && g_hdKingIndex==0 && g_hdKingId==kings[0]);
    assert(strcmp((char*)&g_hdMenuGbk[0],"p0005")==0 && strcmp((char*)&g_hdMenuGbk[16],"p0599")==0);
    assert(g_hdFightOver==1 && g_hdMarchPhase==BAYE_HD_MARCH_DEPARTED); /* choice itself does not commit a new world */
    ++waits;
    U32 seq=g_hdMenuSeq;
    if(choice==65535)return 65535;
    U8 kingNames[32]={0},tbuf[32];
    int pTop=0,pIdx=choice,itemHeight=12,itemsPerPage=6,ry,cycnt;
` + update + String.raw`
    UPDATE_UI();
    (void)cycnt;
    assert(g_hdMenuIndex==choice && g_hdKingIndex==choice && g_hdKingId==kings[choice] && g_hdMenuSeq==seq);
    return kings[choice];
}
` + actualFunction('gamEng.c', 'GamGetKing') + String.raw`
int main(void) {
    PersonID kings[3]={5,256,599};
    scrolling=7;g_hdFightOver=1;g_hdMarchPhase=BAYE_HD_MARCH_DEPARTED;
    choice=2;
    assert(GamGetKing(kings,3)==599 && waits==1 && scrolling==7);
    assert(!g_hdMenuActive && g_hdMenuContext==0 && g_hdFightOver==1 && g_hdMarchPhase==BAYE_HD_MARCH_DEPARTED);
    choice=65535;
    assert(GamGetKing(kings,3)==65535 && waits==2 && !g_hdMenuActive && scrolling==7);
    assert(GamGetKing(kings,0)==65535 && waits==2 && !g_hdMenuActive && scrolling==7);
    puts("actual king waiting owner, matching roster, index ACK and cancel lifecycle passed");
}
`);
});

test('real C world commit clears old battle and march mirrors while preserving every persistent game field', async () => {
    await compile(common + String.raw`
static U8 world[2048];
static PersonID g_PlayerKing;
static U16 g_YearDate,g_MonthDate;
static U8 g_FgtOver;
int main(void) {
    for(unsigned i=0;i<sizeof(world);++i)world[i]=(U8)(i*31+7);
    U8 before[sizeof(world)];memcpy(before,world,sizeof(world));
    g_PlayerKing=599;g_YearDate=190;g_MonthDate=1;g_FgtOver=1;
    g_hdEngineReady=1;baye_hd_set_fight(0,1);g_hdFightSkip=BAYE_HD_FIGHT_SKIP_EMPTY;
    baye_hd_march_begin(8);baye_hd_set_march(8,9,1,1);baye_hd_march_end(1);
    g_hdMapPick=g_hdBattlePick=g_hdQtyActive=g_hdHelpActive=g_hdSkillActive=1;g_hdMapCity=10;
    baye_hd_record_begin(2,3,4);
    baye_hd_set_report((const U8*)"old result",256,BAYE_HD_REPORT_GREPORT);baye_hd_report_begin(BAYE_HD_REPORT_GREPORT);
    U32 fight=g_hdFightInputSeq,march=g_hdMarchInputSeq,report=g_hdReportInputSeq,record=g_hdRecordSeq;
    baye_hd_world_commit();
    assert(g_hdEngineReady && !g_hdFightActive && !g_hdFightOver && !g_hdFightResultGbk[0] && !g_hdFightTipGbk[0]);
    assert(g_hdFightInputKind==BAYE_HD_FIGHT_INPUT_BUSY && g_hdFightActor==255 && g_hdFightInputSeq!=fight);
    assert(!g_hdMarchOk && g_hdMarchPhase==BAYE_HD_MARCH_IDLE && g_hdMarchOrigin==255 && g_hdMarchInputSeq!=march);
    assert(!g_hdMarchCity && !g_hdMarchObj && !g_hdMarchTime && g_hdFightSkip==BAYE_HD_FIGHT_SKIP_NONE);
    assert(!g_hdMapPick && !g_hdBattlePick && !g_hdMapCity && !g_hdQtyActive && !g_hdHelpActive && !g_hdSkillActive);
    assert(!g_hdReportActive && !g_hdReportGbk[0] && g_hdReportKind==BAYE_HD_REPORT_NONE && g_hdReportPerson==65535 && g_hdReportInputSeq!=report);
    assert(!g_hdRecordActive && g_hdRecordSeq!=record);
    assert(g_PlayerKing==599 && g_YearDate==190 && g_MonthDate==1 && g_FgtOver==1 && memcmp(world,before,sizeof(world))==0);
    puts("committed new/loaded world clears HD mirrors without changing native world or battle result passed");
}
`);
});

test('real PlcSplMenu input guards ignore early/late action mailboxes in system, retreat, settings and skill menus', async () => {
    const inner = actualFunction('PublicFun.c', 'PlcSplMenuInner');
    const start = inner.indexOf('nextMsg:\n');
    const end = inner.indexOf('\n        if (VM_TOUCH == pMsg.type)', start);
    assert.ok(start >= 0 && end > start, 'the actual native input guard block exists');
    const guards = inner.slice(start + 'nextMsg:\n'.length, end);
    await compile(common + String.raw`
typedef struct { U8 type, param; } GMType;
static int messages, injectLate;
static void GamGetMsg(GMType* message) {
    ++messages; message->type = 0; message->param = 0x27;
    if (injectLate) g_hdFightActCommit = 0;
}
static U16 actualNativeMenuInput(U16 pIdx) {
    GMType pMsg;
` + guards + String.raw`
    return pIdx;
RET:
    return pIdx;
}
int main(void) {
    baye_hd_set_fight(1, 0);
    const U8 kinds[] = {6,7,8,4};
    for (unsigned i = 0; i < sizeof(kinds); ++i) {
        for (int late = 0; late < 2; ++late) {
            baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_FIGHT, kinds[i]);
            baye_hd_menu_begin();
            messages = 0; injectLate = late;
            g_hdFightActCommit = late ? 255 : 0;
            assert(actualNativeMenuInput(2) == 2 && messages == 1);
            baye_hd_menu_end();
            assert(g_hdFightActCommit == 255);
        }
    }
    for (int context = 0; context < 3; ++context) {
        baye_hd_menu_scope(context, BAYE_HD_MENU_ROOT);
        baye_hd_menu_begin();
        messages = 0; injectLate = 0; g_hdFightActCommit = 0;
        assert(actualNativeMenuInput(2) == 2 && messages == 1);
        baye_hd_menu_end();
    }
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_FIGHT, BAYE_HD_FIGHT_INPUT_ACTION);
    baye_hd_menu_begin();
    messages = 0; injectLate = 0; g_hdFightActCommit = 3;
    assert(actualNativeMenuInput(2) == 3 && messages == 0);
    messages = 0; injectLate = 1;
    assert(actualNativeMenuInput(2) == 0 && messages == 1);
    baye_hd_menu_end();
    puts("actual native menu guards: early/late action mailbox isolation passed");
}
`);
});

test('real C native menu/focus/map/view wrappers open and close input once; native HD sentinel keeps retreat confirmation', async () => {
    const focus = actualFunction('Fight.c', 'FgtGetFoucs');
    const plcMenu = actualFunction('PublicFun.c', 'PlcSplMenu');
    const mapPick = actualFunction('cityedit.c', 'GetCitySet');
    const system = actualFunction('FightSub.c', 'FgtMainMenu');
    const view = actualFunction('FgtPkAi.c', 'FgtShowView');
    const viewInner = actualFunction('FgtPkAi.c', 'FgtShowViewInner');
    const ackStart = viewInner.indexOf('        if (msg.type == VM_CHAR_FUN && (msg.param == VK_UP');
    const viewAck = viewInner.slice(ackStart, viewInner.indexOf('\n        }', ackStart) + '\n        }'.length);
    assert.ok(ackStart >= 0, 'actual view page acknowledgement exists');
    const help = actualFunction('FightSub.c', 'FgtShowHlp');
    const helpWait = help.slice(help.indexOf('tagOut:\n') + 'tagOut:\n'.length, help.lastIndexOf('\n}'));
    const source = read('Fight.c');
    const helpCase = source.slice(source.indexOf('                    case VK_HELP:', source.indexOf('U8 FgtGetFoucsInner')), source.indexOf('                    default:', source.indexOf('U8 FgtGetFoucsInner')));
    await compile(common + String.raw`
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define HZ_WID 6
#define HZ_HGT 12
#define FGT_LOSE 2
#define dFgtSysMnu 1
#define dFgtLookMnu 2
#define dFgtMoveSpe 3
#define VK_HELP 0x26
#define VK_SEARCH 0x33
#define VK_UP 0x22
#define VK_DOWN 0x23
#define VK_LEFT 0x24
#define VK_RIGHT 0x25
#define VM_CHAR_FUN 1
#define IF_HAS_HOOK(name) if (hasHook)
#define CALL_HOOK_A() callHook()
#define gam_free(buffer) ((void)(buffer))
static U8 g_FgtOver, g_LookMovie, g_MoveSpeed, g_LookEnemy;
static U8 *g_VisScr;
static bool g_AutoUpdateMapXY;
static int hasHook, menuCount, menuCalls;
static U8 choices[16], kinds[16], context;
static int callHook(void) {
    assert(g_hdFightInputKind == BAYE_HD_FIGHT_INPUT_SYSTEM);
    assert(!g_hdMenuActive);
    return -2;
}
static U16 PlcSplMenuInner(RECT *rect, U16 index, U8 *text) {
    (void)rect; (void)index; (void)text;
    assert(menuCalls < menuCount && g_hdMenuActive && g_hdMenuContext == context);
    assert(g_hdMenuKind == kinds[menuCalls]);
    if (context == BAYE_HD_MENU_CONTEXT_FIGHT) assert(g_hdFightInputKind == kinds[menuCalls]);
    U32 seq = g_hdMenuSeq;
    baye_hd_set_menu((U8*)"first second", 6, 2, 0);
    baye_hd_set_menu((U8*)"first second", 6, 2, 1);
    assert(seq == g_hdMenuSeq);
    return choices[menuCalls++];
}
` + plcMenu + String.raw`
static void FgtLoadToMem2(U8 id, U8 *text) { (void)id; text[0] = 0; }
static void GamShowFrame(U8 *screen) { (void)screen; }
static void baye_hd_note_retreat_blocked(void) { assert(0); }
` + system + String.raw`
static U8 expectedInput, expectedActor;
static int showInformation;
static U8 GamDelay(int ticks, int mode) {
    assert(ticks == 0 && mode == 2 && g_hdFightInputKind == BAYE_HD_FIGHT_INPUT_HELP);
    return 0x27;
}
static void FgtShowHlp(void) {
    U8 buffer[16] = "help", *pbuf = buffer;
` + helpWait + String.raw`
}
static void FgtShowViewInner(void) { assert(g_hdFightInputKind == BAYE_HD_FIGHT_INPUT_VIEW); }
` + view + String.raw`
static void actualViewPageAcknowledgement(U8 type, U8 key) {
    struct { U8 type,param; } msg = {type,key};
` + viewAck + String.raw`
}
static void FgtAllRight(bool *flag) { (void)flag; }
static void FgtMoveBack(bool *flag) { (void)flag; }
static void FgtCmdBack(bool *flag) { (void)flag; }
static U8 FgtGetFoucsInner(void (*condition)(bool*)) {
    (void)condition;
    assert(g_hdFightWait && g_hdFightInputKind == expectedInput && g_hdFightActor == expectedActor);
    if (showInformation) {
        U32 seq = g_hdFightInputSeq;
        switch (showInformation == 1 ? VK_HELP : VK_SEARCH) {
` + helpCase + String.raw`
        }
        assert(g_hdFightInputKind == expectedInput && g_hdFightActor == expectedActor);
        assert(g_hdFightInputSeq != seq);
    }
    return 0;
}
` + focus + String.raw`
static U32 lastMapSeq;
static U8 GetCitySetInner(CitySetType *pos) {
    (void)pos;
    assert(g_hdMapPick == 1 && g_hdMapInputSeq != lastMapSeq);
    lastMapSeq = g_hdMapInputSeq;
    baye_hd_set_map_pick(1);
    assert(g_hdMapInputSeq == lastMapSeq); /* redraw/update cannot create input */
    return 2;
}
` + mapPick + String.raw`
int main(void) {
    RECT rect = {0};
    U32 seq;
    baye_hd_set_fight(1, 0);
    context = BAYE_HD_MENU_CONTEXT_CITY; menuCount = 1;
    choices[0] = 2; kinds[0] = BAYE_HD_MENU_ROOT;
    baye_hd_menu_scope(context, BAYE_HD_MENU_ROOT);
    assert(PlcSplMenu(&rect, 0, (U8*)"city") == 2);
    assert(!g_hdMenuActive && g_hdMenuContext == 0 && menuCalls == 1);

    for (int hd = 0; hd < 2; ++hd) {
        context = BAYE_HD_MENU_CONTEXT_FIGHT; hasHook = hd; menuCalls = 0; menuCount = 5;
        const U8 script[] = {1, MNU_EXIT, 2, 1, 0};
        const U8 expectedKinds[] = {6,7,6,8,6};
        memcpy(choices, script, sizeof(script)); memcpy(kinds, expectedKinds, sizeof(expectedKinds));
        g_FgtOver = 0;
        assert(FgtMainMenu() == MNU_EXIT);
        assert(g_FgtOver == 0 && g_LookMovie == 1 && menuCalls == 5);
        assert(!g_hdMenuActive && g_hdFightInputKind == 0 && g_hdFightActor == 255);
    }
    context = BAYE_HD_MENU_CONTEXT_FIGHT; hasHook = 1; menuCalls = 0; menuCount = 2;
    choices[0] = 1; choices[1] = 0; kinds[0] = 6; kinds[1] = 7;
    assert(FgtMainMenu() == MNU_EXIT && g_FgtOver == FGT_LOSE && menuCalls == 2);

    expectedInput = BAYE_HD_FIGHT_INPUT_PICK; expectedActor = 255;
    assert(FgtGetFoucs(FgtAllRight) == 0 && g_hdFightInputKind == 0 && !g_hdFightWait);
    baye_hd_fight_actor(0);
    expectedInput = BAYE_HD_FIGHT_INPUT_MOVE; expectedActor = 0;
    showInformation = 1; seq = g_hdFightInputSeq;
    assert(FgtGetFoucs(FgtMoveBack) == 0 && g_hdFightInputSeq != seq && g_hdFightInputKind == 0);
    expectedInput = BAYE_HD_FIGHT_INPUT_AIM; showInformation = 2;
    assert(FgtGetFoucs(FgtCmdBack) == 0 && g_hdFightInputKind == 0 && !g_hdFightWait);
    baye_hd_fight_input_begin(BAYE_HD_FIGHT_INPUT_VIEW);
    seq = g_hdFightInputSeq;
    actualViewPageAcknowledgement(0, VK_DOWN); /* a timer/redraw has no ACK */
    assert(g_hdFightInputSeq == seq);
    actualViewPageAcknowledgement(VM_CHAR_FUN, VK_DOWN); /* a real page input, including a bound */
    assert(g_hdFightInputSeq != seq && g_hdFightInputKind == BAYE_HD_FIGHT_INPUT_VIEW);
    baye_hd_fight_input_end();
    CitySetType pos = {0};
    assert(GetCitySet(&pos) == 2 && !g_hdMapPick);
    assert(GetCitySet(&pos) == 2 && !g_hdMapPick);
    assert(scrolling == 0);
    puts("native menu/focus/map/view lifecycle and sentinel retreat confirmation passed");
}
`);
});

test('real C BattleMake reports selected-person ACK, cancellation/rejection, exhausted lists and successful order ACK', async () => {
    const battleMake = actualFunction('citycmdd.c', 'BattleMake');
    const persons = actualFunction('showface.c', 'ShowPersonControl');
    const mapPick = actualFunction('cityedit.c', 'GetCitySet');
    await compile(common + String.raw`
#define PID(value) ((PersonID)(value))
#define BATTLE 9
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define NOTE_STR8 8
#define NOTE_STR7 7
#define NOTE_STR4 4
#define STR_NOFIGHTER 5
#define STR_OBJ 6
#define STR_ARMOUT 10
#define ADD16(target, value) ((target) += (value))
#define gam_memset memset
typedef struct { U16 Food; U8 OrderId, City; PersonID Person, Object; U32 TimeCount; } OrderType;
static OrderType hdMarchOrder;
static U8 hdMarchOrderPending;
static struct { U16 Food; U8 Belong; } g_Cities[4];
static struct { U8 fixFoodOverFlow, fixOverFlow16; } g_engineConfig;
static CitySetType g_CityPos;
static PersonID shared[512];
#define SHARE_MEM shared
static U8 people[2], selectedCalls, restored, foodCalls, targetCalls, orders, rejectionCount;
static U8 money, cancelPerson, cancelFood, cancelTarget, ownedTarget, badRoad, orderSucceeds;
static U16 lastSession;
static U32 inputSeqAtPerson;
static U8 IsMoney(U8 city, int operation) { (void)city; assert(operation == BATTLE); return money; }
static void ShowConstStrMsg(int id) {
    if (id == STR_ARMOUT) {
        assert(g_hdMarchPhase == BAYE_HD_MARCH_ARMOUT_REPORT && !g_hdMarchOk && orders == 0);
    } else { assert(g_hdMarchPhase == BAYE_HD_MARCH_REJECT_REPORT); ++rejectionCount; }
}
static void GamMsgBox(const U8 *text, int seconds) {
    (void)text; (void)seconds; assert(g_hdMarchPhase == BAYE_HD_MARCH_REJECT_REPORT);
}
static U32 GetCityPersons(U8 city, PersonID *queue) {
    assert(city == 0);
    U32 count = 0;
    for (U8 i = 0; i < 2; ++i) if (people[i]) queue[count++] = i;
    return count;
}
static void ShowMapClear(void) {}
static PersonID ShowPersonControlInner(PersonID *queue, U32 count, PersonID selected, U8 x0,U8 y0,U8 x1,U8 y1) {
    (void)queue; (void)selected; (void)x0; (void)y0; (void)x1; (void)y1;
    assert(count > 0 && g_hdMarchPhase == BAYE_HD_MARCH_PERSONS);
    assert(g_hdMenuActive && g_hdMenuContext == BAYE_HD_MENU_CONTEXT_CITY && g_hdMenuKind == BAYE_HD_MENU_PERSON);
    assert(g_hdMarchSession != lastSession && g_hdMarchOrigin == 0 && g_hdMarchSelected == selectedCalls);
    assert(inputSeqAtPerson != g_hdMarchInputSeq); inputSeqAtPerson = g_hdMarchInputSeq;
    return cancelPerson ? 0xffff : 0;
}
` + persons + String.raw`
static U8 DelPerson(U8 city, PersonID id) {
    assert(city == 0 && id < 2 && people[id]); people[id] = 0; ++selectedCalls; return 1;
}
static void AddPerson(U8 city, PersonID id) {
    assert(city == 0 && id < 2 && !people[id]); people[id] = 1; ++restored;
}
static U16 GetFood(U16 minimum, U16 maximum) {
    assert(g_hdMarchPhase == BAYE_HD_MARCH_FOOD && g_hdMarchSelected == 2 && !g_hdMenuActive);
    assert(minimum == 1 && maximum == 200); ++foodCalls;
    return cancelFood ? 0xffff : 10;
}
static void baye_hd_set_city_links(U8 city) { assert(city == 0); }
static void baye_hd_set_map_city(U8 city) { g_hdMapCity = city; }
static void ShowGReport(PersonID person, U8 *text) {
    (void)text; assert(person == 0 && g_hdMarchPhase == BAYE_HD_MARCH_TARGET_TIP);
}
static U8 GetCitySetInner(CitySetType *pos) {
    assert(pos == &g_CityPos && g_hdMarchPhase == BAYE_HD_MARCH_TARGET_PICK);
    assert(g_hdMapPick && g_hdBattlePick && g_hdMarchSelected == 2); ++targetCalls;
    if (cancelTarget) return 0xff;
    if (ownedTarget && targetCalls == 1) return 1;
    return 2;
}
` + mapPick + String.raw`
static U32 AttackCityRoad(U8 from,U32 x,U32 y,U32 target,U32 tx,U32 ty) {
    (void)x; (void)y; (void)tx; (void)ty; assert(from == 0 && target == 2);
    return badRoad && targetCalls == 1 ? 0xff : 1;
}
static void OrderConsumeMoney(U8 city, int operation) { assert(city == 0 && operation == BATTLE); }
static U8 AddFightOrder(OrderType *order, PersonID *fighters) {
    assert(g_hdMarchPhase == BAYE_HD_MARCH_ARMOUT_REPORT && !g_hdMarchOk);
    assert(order->City == 0 && order->Object == 2 && order->Food == 10);
    assert(fighters[0] == 1 && fighters[1] == 2); ++orders;
    if(orderSucceeds) order->Person=3;
    return orderSucceeds;
}
` + actualFunction('citycmdd.c', 'rememberHdMarchOrder') + '\n' + actualFunction('citycmdd.c', 'consumeHdMarchOrder') + '\n' + battleMake + String.raw`
static void reset(void) {
    lastSession = g_hdMarchSession;
    people[0] = people[1] = 1;
    selectedCalls = restored = foodCalls = targetCalls = orders = rejectionCount = 0;
    money = orderSucceeds = 1;
    cancelPerson = cancelFood = cancelTarget = ownedTarget = badRoad = 0;
    g_Cities[0].Food = 200; g_Cities[0].Belong = g_Cities[1].Belong = 1; g_Cities[2].Belong = 2;
    g_engineConfig.fixFoodOverFlow = g_engineConfig.fixOverFlow16 = 1;
}
static void canceled(void) {
    assert(g_hdMarchPhase == 0 && g_hdMarchSelected == 0 && g_hdMarchOrigin == 255);
    assert(people[0] && people[1] && !g_hdMarchOk && !g_hdBattlePick && !g_hdMapPick);
    assert(scrolling == 0);
}
int main(void) {
    reset(); money = 0; assert(BattleMake(0) == 1); canceled(); assert(rejectionCount == 1 && !selectedCalls);
    reset(); cancelPerson = 1; assert(BattleMake(0) == 1); canceled(); assert(!foodCalls && !orders);
    reset(); cancelFood = 1; assert(BattleMake(0) == 1); canceled(); assert(selectedCalls == 2 && restored == 2 && foodCalls == 1);
    reset(); cancelTarget = 1; assert(BattleMake(0) == 1); canceled(); assert(restored == 2 && targetCalls == 1);
    reset(); orderSucceeds = 0; assert(BattleMake(0) == 1); canceled(); assert(orders == 1 && restored == 2);
    for (int route = 0; route < 3; ++route) {
        reset(); ownedTarget = route == 1; badRoad = route == 2;
        U16 orderSeq = g_hdMarchSeq;
        assert(BattleMake(0) == 1);
        assert(g_hdMarchPhase == BAYE_HD_MARCH_DEPARTED && g_hdMarchSelected == 2 && g_hdMarchOrigin == 0);
        assert(g_hdMarchOk && g_hdMarchSeq != orderSeq && orders == 1 && !restored);
        assert(hdMarchOrderPending && hdMarchOrder.City==0 && hdMarchOrder.Object==2 && hdMarchOrder.Person==3);
        assert(!people[0] && !people[1] && g_Cities[0].Food == 190);
        assert(selectedCalls == 2 && foodCalls == 1 && targetCalls == (route ? 2 : 1));
        assert(rejectionCount == (route ? 1 : 0) && !g_hdBattlePick && !g_hdMapPick);
        assert(scrolling == 0);
    }
    puts("BattleMake: abort, selection ACK, empty-list completion, food/target cancel, rejection and order ACK passed");
}
`);
});
