#!/usr/bin/env node
// Compile production campaign functions; drawing, resources and input are fixtures.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'vendor/iBaye/src');
const read = (filename) => readFileSync(join(directory, filename), 'utf8').replace(/\r\n/g, '\n');
const run = promisify(execFile);
const constants = read('hd-bridge.h').split('\n').filter((line) => /^#define BAYE_HD_/.test(line)).join('\n') + '\n' +
    read('baye/consdef.h').split('\n').filter(line => /^#define\s+TACTIC_ICON\b/.test(line)).join('\n');

function actualFunction(filename, name) {
    const source = read(filename);
    const match = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm').exec(source);
    assert.ok(match, `actual ${filename}::${name} exists`);
    const open = source.indexOf('{', match.index);
    let depth = 0, quote = null, comment = null;
    for (let end = open; end < source.length; end++) {
        const char = source[end], next = source[end + 1];
        if (comment === '//') { if (char === '\n') comment = null; continue; }
        if (comment === '/*') { if (char === '*' && next === '/') { comment = null; end++; } continue; }
        if (quote) { if (char === '\\') end++; else if (char === quote) quote = null; continue; }
        if (char === '/' && (next === '/' || next === '*')) { comment = char + next; end++; continue; }
        if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
        if (char === '{') depth++;
        if (char === '}' && --depth === 0) return source.slice(match.index, end + 1);
    }
    assert.fail(`actual ${filename}::${name} closes`);
}

const bridge = read('hd-bridge.c');
const detailGlobals = bridge.slice(bridge.indexOf('U32 g_hdDetailGeneration ='), bridge.indexOf('static U8 hdMenuNextContext')) +
    bridge.slice(bridge.indexOf('U8 g_hdHelpProtocolVersion ='), bridge.indexOf('U8 g_hdMovieActive ='));
const detailClears = ['hd_next_input_seq','baye_hd_person_properties_retire','hd_goods_clear','hd_menu_ids_clear','hd_help_detail_clear',
    'baye_hd_view_retire','baye_hd_mini_map_retire']
    .map(name => actualFunction('hd-bridge.c', name)).join('\n');

async function compile(source) {
    const temporary = mkdtempSync(join(tmpdir(), 'baye-hd-campaign-'));
    try {
        const filename = join(temporary, 'campaign.c');
        const executable = join(temporary, process.platform === 'win32' ? 'campaign.exe' : 'campaign');
        writeFileSync(filename, source);
        try { await run(process.env.CC || 'cc', ['-std=c99', '-Wall', '-Wextra', filename, '-o', executable], { timeout: 20000 }); }
        catch (error) { throw new Error('Actual campaign fixture compilation failed: ' +
            (error.stderr?.split(/\r?\n/).filter(line => /error:|fatal error:/.test(line)).join('\n') || error.message)); }
        const result = await run(executable, [], { timeout: 20000 });
        assert.match(result.stdout, /passed/);
    } finally { assert.equal(dirname(resolve(temporary)), resolve(tmpdir()), 'Cleanup stays in the explicit temporary directory');
        assert.ok(basename(temporary).startsWith('baye-hd-campaign-'), 'Cleanup targets only this fixture');
        rmSync(temporary, { recursive: true, force: true }); }
}

const common = String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;
typedef uint16_t U16;
typedef uint32_t U32;
typedef uint16_t PersonID;
#define FAR
#define PID(id) ((PersonID)(id))
#define PID0 PID(0)
#define ORDER_MAX 200
#define FIGHT_ORDER_MAX 30
#define CITY_MAX 64
#define BATTLE 12
#define IFACE_CONID 1
#define dCityMapId 2
#define FIGHT_MAP 10
#define FGT_DF 0
#define FGT_AT 1
#define FGT_AUTO 2
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define IF_HAS_HOOK(name) if (0)
#define BIND_U8EX(...) ((void)0)
#define CALL_HOOK_A() 0
#define gam_memcpy memcpy
#define gam_memset memset
typedef struct { U8 OrderId, City, TimeCount; PersonID Person, Object; U16 Food; } OrderType;
typedef struct { PersonID Belong; U16 Food,PersonQueue,Persons; } City;
typedef City CityType;
typedef struct { PersonID Belong; U16 Arms; U8 IQ, Devotion; } Person;
typedef struct { PersonID GenArray[20]; U16 MapId, MProvender, EProvender; U8 Way, CityIndex, Mode; } FightParam;
static City g_Cities[CITY_MAX];
static Person g_Persons[600];
static FightParam g_FgtParam;
static PersonID g_PlayerKing;
static U8 g_FgtOver;
static U8 shareMemory[4096];
#define SHARE_MEM shareMemory
static OrderType queue[ORDER_MAX];
#define ORDERQUEUE queue
static U8 fighterIndexes[FIGHT_ORDER_MAX];
#define FIGHTERS_IDX fighterIndexes
static struct { U32 before; PersonID people[FIGHT_ORDER_MAX * 10]; U32 after; } guarded;
#define FIGHTERS ((U8*)guarded.people)
static unsigned messageCount, addCalls, allowOrder = 1;
static void GamMsgBox(const U8* text, U8 delay) { (void)text; assert(delay == 1); ++messageCount; }
static int canAddOrder(OrderType* order) { (void)order; ++addCalls; return allowOrder; }
static void reset(void) {
    memset(queue, 255, sizeof(queue)); memset(fighterIndexes, 0, sizeof(fighterIndexes));
    memset(guarded.people, 0, sizeof(guarded.people)); memset(g_Cities, 0, sizeof(g_Cities));
    memset(g_Persons, 0, sizeof(g_Persons)); memset(&g_FgtParam, 0, sizeof(g_FgtParam));
    guarded.before = 0x12345678; guarded.after = 0x87654321;
    messageCount = addCalls = 0; allowOrder = 1; g_PlayerKing = 0;
}
` + constants + '\n' + detailGlobals + '\n' + detailClears + '\n' +
    actualFunction('citycmdd.c', 'AddOrderEnd') + '\n' + actualFunction('citycmdd.c', 'AddFightOrder');

test('real C fight queue stores all 30 ten-person armies within its 600-byte allocation and reuses sparse slots', async () => {
    await compile(common + String.raw`
int main(void) {
    reset();
    PersonID fighters[10];
    OrderType order = {.OrderId=BATTLE, .City=0, .Object=1, .Person=99, .Food=500};
    for (unsigned slot = 0; slot < FIGHT_ORDER_MAX; ++slot) {
        for (unsigned j = 0; j < 10; ++j) fighters[j] = (PersonID)(slot * 10 + j + 1);
        assert(AddFightOrder(&order, fighters) == 1 && order.Person == slot);
        assert(fighterIndexes[slot] == 1);
        assert(memcmp(&guarded.people[10 * slot], fighters, sizeof(fighters)) == 0);
        assert(queue[ORDER_MAX-FIGHT_ORDER_MAX+slot].Person == slot);
        assert(guarded.before == 0x12345678 && guarded.after == 0x87654321);
    }
    const PersonID last = order.Person;
    OrderType before = order;
    assert(AddFightOrder(&order, fighters) == 0);
    assert(memcmp(&order, &before, sizeof(order)) == 0 && order.Person == last && messageCount == 1);
    fighterIndexes[17] = 0;
    queue[ORDER_MAX-FIGHT_ORDER_MAX+17].OrderId = 255;
    for (unsigned j = 0; j < 10; ++j) fighters[j] = (PersonID)(500+j);
    assert(AddFightOrder(&order, fighters) == 1 && order.Person == 17);
    assert(memcmp(&guarded.people[170], fighters, sizeof(fighters)) == 0);
    assert(guarded.people[169] == 170 && guarded.people[180] == 181);
    assert(guarded.after == 0x87654321);
    puts("all fighter slots and sparse reuse passed");
}
`);
});

test('real C rejected fight orders leave caller, fighter storage and occupied queue unchanged and report once', async () => {
    await compile(common + String.raw`
int main(void) {
    reset();
    PersonID fighters[10] = {256, 512, 599};
    OrderType order = {.OrderId=BATTLE, .City=0, .Object=1, .Person=77, .Food=600};
    OrderType before = order;
    memset(queue, 0, sizeof(queue)); /* command queue full, fighter slots still free */
    assert(AddFightOrder(&order, fighters) == 0);
    assert(addCalls == 1 && messageCount == 1);
    assert(memcmp(&order, &before, sizeof(order)) == 0);
    for (unsigned j=0; j<FIGHT_ORDER_MAX; ++j) assert(fighterIndexes[j] == 0);
    for (unsigned j=0; j<300; ++j) assert(guarded.people[j] == 0);
    reset(); allowOrder = 0; before = order;
    assert(AddFightOrder(&order, fighters) == 0 && addCalls == 1 && messageCount == 0);
    assert(memcmp(&order, &before, sizeof(order)) == 0);
    for (unsigned j=0; j<ORDER_MAX; ++j) assert(queue[j].OrderId == 255);
    assert(guarded.before == 0x12345678 && guarded.after == 0x87654321);
    puts("full queue and Mod rejection transaction passed");
}
`);
});

const marchAcknowledgement = String.raw`
static void baye_hd_clear_march_ok(void);
static OrderType hdMarchOrder;
static U8 hdMarchOrderPending;
` + actualFunction('citycmdd.c', 'rememberHdMarchOrder') + '\n' + actualFunction('citycmdd.c', 'consumeHdMarchOrder');

const campaign = common + marchAcknowledgement + String.raw`
static unsigned skipReason, clearMarch, addPersonCount, fightCalls, resultCalls;
static PersonID addedPersons[32];
static U8 addedCity;
static void baye_hd_set_fight_skip(U8 value) { skipReason=value; }
static void baye_hd_clear_march_ok(void) { ++clearMarch; }
static void ResItemGet(int resource, int id, U8* out) { (void)resource; (void)id; memset(out,0,CITY_MAX); }
static U8 GetDirect(U32 a, U8 b) { (void)a; (void)b; return 0; }
static void ShowAttackNote(PersonID king, U32 city) { (void)king; (void)city; }
static void AddPerson(U32 city, PersonID person) { addedCity=city; addedPersons[addPersonCount++]=person; }
static void ShowFightWinNote(PersonID king) { (void)king; }
static U32 GetCityPersons(U32 city, PersonID* output) { (void)city; (void)output; return 0; }
static U32 GetKingPersons(PersonID king, PersonID* output) { (void)king; (void)output; return 2; }
static void ShowMapClear(void) {}
static void baye_hd_menu_scope(U8 context,U8 kind) { (void)context;(void)kind; }
static PersonID ShowPersonControl(PersonID* p,U32 count,PersonID initial,U8 a,U8 b,U8 c,U8 d) {
    (void)p;(void)count;(void)initial;(void)a;(void)b;(void)c;(void)d;return 65535;
}
static void DelPerson(U32 city,PersonID person) { (void)city; (void)person; }
static void GamFight(void) { ++fightCalls; }
static void FightResultDeal(U32 city,U8 over) { (void)city; (void)over; ++resultCalls; }
static void ShowFightNote(PersonID attacker,PersonID defender) { (void)attacker;(void)defender; }
` + actualFunction('citycmdd.c', 'BattleDrv') + '\n' + actualFunction('infdeal.c', 'GetPersonsCount');

test('real C high-slot dispatch occupies an empty city, frees its own slot and counts 16-bit fighter IDs', async () => {
    await compile(campaign + String.raw`
int main(void) {
    reset();
    PersonID fighters[10] = {256,512,599};
    OrderType order = {.OrderId=BATTLE,.City=0,.Object=1,.Food=400};
    memset(fighterIndexes,1,29); /* force the final real slot */
    assert(AddFightOrder(&order,fighters) == 1 && order.Person == 29);
    rememberHdMarchOrder(&order);
    g_Cities[0].Belong=1;
    assert(GetPersonsCount(0) == 5); /* three dispatched plus two resident generals */
    g_Persons[255].Belong=1;
    assert(BattleDrv(&order)==1);
    assert(fighterIndexes[29]==0 && fighterIndexes[28]==1);
    assert(g_Cities[1].Belong==1 && addedCity==1 && addPersonCount==3);
    assert(addedPersons[0]==255 && addedPersons[1]==511 && addedPersons[2]==598);
    assert(fightCalls==0 && resultCalls==0 && skipReason==BAYE_HD_FIGHT_SKIP_EMPTY && clearMarch==1);
    assert(guarded.before==0x12345678 && guarded.after==0x87654321);
    addPersonCount=clearMarch=0; order.Person=FIGHT_ORDER_MAX;
    assert(BattleDrv(&order)==1 && addPersonCount==0 && clearMarch==0);
    assert(skipReason==BAYE_HD_FIGHT_SKIP_NO_ARMY && guarded.after==0x87654321);
    order.Person=17; guarded.people[170]=0; fighterIndexes[17]=1;
    rememberHdMarchOrder(&order);
    clearMarch=0;
    assert(BattleDrv(&order)==1 && fighterIndexes[17]==0 && clearMarch==1 && fightCalls==0);
    puts("high-slot occupation, 16-bit count and invalid-slot boundary passed");
}
`);
});

test('real C older or AI dispatch cannot consume the latest player order acknowledgement', async () => {
    await compile(campaign + String.raw`
int main(void) {
    reset();
    PersonID fighters[10]={1};g_Persons[0].Belong=1;
    OrderType older={.OrderId=BATTLE,.City=0,.Object=1,.Food=100};
    OrderType latest=older;
    assert(AddFightOrder(&older,fighters)==1 && older.Person==0);
    assert(AddFightOrder(&latest,fighters)==1 && latest.Person==1);
    rememberHdMarchOrder(&latest);
    OrderType mismatch=latest;
    mismatch.City=2;consumeHdMarchOrder(&mismatch);assert(clearMarch==0 && hdMarchOrderPending);
    mismatch=latest;mismatch.Object=2;consumeHdMarchOrder(&mismatch);assert(clearMarch==0 && hdMarchOrderPending);
    mismatch=latest;mismatch.OrderId=1;consumeHdMarchOrder(&mismatch);assert(clearMarch==0 && hdMarchOrderPending);
    /* Same origin and destination; only the true queue slot distinguishes them. */
    assert(BattleDrv(&older)==1 && clearMarch==0 && hdMarchOrderPending);
    assert(g_Cities[1].Belong==1 && skipReason==BAYE_HD_FIGHT_SKIP_EMPTY);
    assert(BattleDrv(&latest)==1 && clearMarch==1 && !hdMarchOrderPending);
    assert(skipReason==BAYE_HD_FIGHT_SKIP_OWNED);
    consumeHdMarchOrder(&latest);assert(clearMarch==1); /* consumed only once */
    puts("older/AI order isolation and exact one-time player order consumption passed");
}
`);
});

test('real C incoming attacks own defender menus, ACK native indexes and preserve removal, ten-general and EXIT rules', async () => {
    const menuHelpers = ['baye_hd_menu_scope', 'baye_hd_menu_scope_default',
        'baye_hd_menu_begin', 'baye_hd_menu_end', 'baye_hd_set_menu', 'baye_hd_menu_ids',
        'hd_person_properties_owner', 'hd_person_properties_ticket', 'baye_hd_person_properties_begin',
        'baye_hd_person_properties_publish'].map((name) => actualFunction('hd-bridge.c', name)).join('\n');
    await compile(common + marchAcknowledgement + String.raw`
#define PERSON_COUNT 600
#define PERSON_MAX 2000
#define gam_strlen(text) strlen((const char*)(text))
#define ASC_WID 6
#define ASC_HGT 12
#define VM_CHAR_FUN 1
#define VM_TOUCH 2
#define VK_SEARCH 3
#define VK_PGUP 4
#define VK_UP 5
#define VK_HELP 6
#define VK_PGDN 7
#define VK_DOWN 8
#define VK_LEFT 9
#define VK_RIGHT 10
#define VK_ENTER 11
#define VK_EXIT 12
#define VT_TOUCH_DOWN 1
#define VT_TOUCH_UP 2
#define VT_TOUCH_MOVE 3
typedef int16_t I16;
typedef struct { U8 type,param; } GMType;
typedef struct { int left,top,right,bottom; } Rect;
typedef struct { int x,y; } Point;
typedef struct { int currentX,currentY,completed,moved,touched; } Touch;
static struct { U8 personPropertiesCount; } cfg={10};
static PersonID g_PersonsQueue[PERSON_COUNT];
static U8 hdMenuNextContext,hdMenuNextKind,g_hdMenuActive,g_hdMenuContext,g_hdMenuKind;
static U8 g_hdReportActive,g_hdQtyActive,g_hdHelpActive;
static U32 g_hdMenuSeq;
static U8 g_hdMenuGbk[BAYE_HD_MENU_MAX];
static U16 g_hdMenuItemLen,g_hdMenuCount,g_hdMenuIndex;
/* This campaign resource fixture has 600 persons and no tool resource. */
static U32 GamGetPersonCount(void) { return sizeof(g_Persons)/sizeof(g_Persons[0]); }
static U16 baye_hd_tool_count(void) { return 0; }
static void baye_hd_fight_input_begin(U8 kind) { (void)kind;assert(0); }
static void baye_hd_fight_input_end(void) { assert(0); }
` + menuHelpers + String.raw`
static unsigned scrolling=7,menus,selected,enters,exits,arrows,fights,results,clearMarch;
static unsigned stopAfter,totalCandidates;
static U32 previousSeq;
static int pendingIndex=-1;
static PersonID selectedIds[10];
static const U8 liRu[]={0xc0,0xee,0xc8,0xe5,0};
static const U8 zhangLiao[]={0xd5,0xc5,0xc1,0xc9,0};
static const U8 luBu[]={0xc2,0xc0,0xb2,0xbc,0};
static const U8* realName(PersonID id) { return id==19 ? liRu : id==22 ? zhangLiao : id==20 ? luBu : NULL; }
static void GetPersonName(PersonID id,U8* name) {
    const U8* text=realName(id);
    if(text)strcpy((char*)name,(const char*)text);else snprintf((char*)name,16,"p%04u",id);
}
static int SysScrollingTimerOpen(int value) { int old=scrolling;scrolling=value;return old; }
static U32 limitValueInRange(U32 value,U32 minimum,U32 maximum) { return value<minimum ? minimum : value>maximum ? maximum : value; }
static void gam_rect(U8 a,U8 b,U8 c,U8 d) { (void)a;(void)b;(void)c;(void)d; }
#define gam_clrlcd gam_rect
#define gam_revlcd gam_rect
static U8 ShowPersonProStr(U8 property,U8 x,U8 y,U8 width) { (void)x;(void)y;(void)width;return property+1; }
static void ShowPersonPro(PersonID id,U8 property,U8 x,U8 y,U8 width) { (void)id;(void)property;(void)x;(void)y;(void)width; }
/* The existing campaign fixture intentionally does not render LCD property
 * strings. Observe its unchanged drawing boundary, while the real begin and
 * publish helpers above still enforce the campaign/PERSON distinction. */
static U8 ShowPersonProStrCaptured(U8 property,U8 x,U8 y,U8 width,U32 ticket,U16 row,PersonID person) {
    (void)ticket;(void)row;(void)person;return ShowPersonProStr(property,x,y,width);
}
static void ShowPersonProCaptured(PersonID id,U8 property,U8 x,U8 y,U8 width,U32 ticket,U16 row) {
    (void)ticket;(void)row;ShowPersonPro(id,property,x,y,width);
}
static U8 touchUpdate(Touch* touch,GMType msg) { (void)touch;(void)msg;return 0; }
static I16 touchListViewItemIndexAtPoint(int x,int y,Rect rect,int a,int b,U32 top,U32 count,int height) {
    (void)x;(void)y;(void)rect;(void)a;(void)b;(void)top;(void)count;(void)height;return -1;
}
static Point touchListViewCalcTopLeftForMove(Touch* t,U8 left,U8 xmax,int width,U8 top,U32 maximum,int height) {
    (void)t;(void)xmax;(void)width;(void)maximum;(void)height;Point p={left,top};return p;
}
static int pointState(int value,int minimum,int maximum) { (void)value;(void)minimum;(void)maximum;return 0; }
static void touchUpdateViewState(Touch* t,int a,int b) { (void)t;(void)a;(void)b; }
static U8 GamMsgIsTimer0(GMType msg) { (void)msg;return 0; }
static void GamGetMsg(GMType* msg) {
    assert(g_hdMenuActive && g_hdMenuContext==BAYE_HD_MENU_CONTEXT_CAMPAIGN && g_hdMenuKind==BAYE_HD_CAMPAIGN_DEFENDERS);
    assert(scrolling==5 && g_hdMenuItemLen==BAYE_HD_NAME_SLOT && g_hdMenuCount>0);
    assert(g_FgtOver==1 && g_FgtParam.Mode==FGT_DF && g_FgtParam.CityIndex==1);
    assert(g_hdMenuCount==totalCandidates-selected);
    for(unsigned i=0;i<selected;++i)assert(g_FgtParam.GenArray[i]==selectedIds[i]+1);
    for(unsigned i=selected;i<10;++i)assert(g_FgtParam.GenArray[i]==0);
    assert(g_FgtParam.GenArray[10]==38 && g_FgtParam.GenArray[11]==33);
    PersonID candidates[16];U32 count=0;
    for(U32 i=0;i<g_Cities[1].Persons;++i) {
        PersonID id=g_PersonsQueue[g_Cities[1].PersonQueue+i];
        if(g_Persons[id].Belong==1)candidates[count++]=id;
    }
    assert(count==g_hdMenuCount);
    for(U32 i=0;i<count;++i) {
        U8 name[16]={0};GetPersonName(candidates[i],name);
        assert(strcmp((char*)&g_hdMenuGbk[i*BAYE_HD_NAME_SLOT],(char*)name)==0);
    }
    if(previousSeq!=g_hdMenuSeq) {
        assert(pendingIndex<0 && g_hdMenuIndex==0);previousSeq=g_hdMenuSeq;++menus;
    }
    if(pendingIndex>=0) { assert(g_hdMenuIndex==pendingIndex);pendingIndex=-1; }
    msg->type=VM_CHAR_FUN;
    if(selected==stopAfter) { msg->param=VK_EXIT;++exits;return; }
    U32 target=selected==0 ? count-1 : 0;
    if(g_hdMenuIndex<target) { pendingIndex=g_hdMenuIndex+1;msg->param=VK_DOWN;++arrows;return; }
    assert(g_hdMenuIndex==target && selected<10);
    selectedIds[selected]=candidates[target];msg->param=VK_ENTER;++enters;
}
` + actualFunction('showface.c', 'ShowPersonControlInner') + '\n' + actualFunction('showface.c', 'ShowPersonControl') + '\n' +
        actualFunction('cityedit.c', 'GetCityPersons') + '\n' + actualFunction('cityedit.c', 'DelPerson') + String.raw`
static void baye_hd_clear_march_ok(void) { ++clearMarch; }
static void baye_hd_set_fight_skip(U8 reason) { (void)reason;assert(0); }
static void ResItemGet(int resource,int id,U8* out) { (void)resource;(void)id;memset(out,0,CITY_MAX); }
static U8 GetDirect(U32 city,U8 origin) { assert(city==1 && origin==2);return 0; }
static void ShowAttackNote(PersonID king,U32 city) { assert(king==1 && city==1); }
static void ShowMapClear(void) {
    /* The previous native choice has now been removed from the city queue. */
    selected=enters;
}
static void AddPerson(U32 city,PersonID id) { (void)city;(void)id;assert(0); }
static void ShowFightWinNote(PersonID king) { (void)king;assert(0); }
static void ShowFightNote(PersonID attacker,PersonID defender) { (void)attacker;(void)defender;assert(0); }
static void GamFight(void) {
    selected=enters;
    assert(!g_hdMenuActive && hdMenuNextContext==BAYE_HD_MENU_CONTEXT_NONE && hdMenuNextKind==0);
    assert(g_FgtOver==1 && g_FgtParam.Mode==FGT_DF && g_FgtParam.CityIndex==1 && scrolling==7);
    assert(g_FgtParam.MProvender==200 && g_FgtParam.EProvender==400);
    for(unsigned i=0;i<selected;++i)assert(g_FgtParam.GenArray[i]==selectedIds[i]+1);
    for(unsigned i=selected;i<10;++i)assert(g_FgtParam.GenArray[i]==0);
    assert(g_FgtParam.GenArray[10]==38 && g_FgtParam.GenArray[11]==33);
    ++fights;
}
static void FightResultDeal(U32 city,U8 over) { assert(city==1 && over==1);++results; }
` + actualFunction('citycmdd.c', 'BattleDrv') + String.raw`
static OrderType setup(unsigned count,unsigned finishAfter) {
    reset();memset(g_PersonsQueue,0,sizeof(g_PersonsQueue));
    menus=selected=enters=exits=arrows=fights=results=clearMarch=0;previousSeq=0;pendingIndex=-1;
    totalCandidates=count;stopAfter=finishAfter;g_FgtOver=1;
    /* An old winning formation must be cleared before the next defender wait. */
    for(unsigned i=0;i<20;++i)g_FgtParam.GenArray[i]=599;
    g_Cities[1].Belong=1;g_Cities[1].Food=200;g_Cities[1].Persons=count+2;
    g_Cities[2].PersonQueue=count+2;
    g_Persons[8].Belong=65535;g_PersonsQueue[0]=8;
    for(unsigned i=0;i<count;++i) {
        PersonID id=count==3 ? (PersonID[]){19,22,20}[i] : 256+i;
        g_Persons[id].Belong=1;g_Persons[id].Arms=100+i;g_PersonsQueue[i+1]=id;
    }
    g_PersonsQueue[count+1]=15;g_Persons[15].Belong=0;
    g_Persons[37].Belong=g_Persons[32].Belong=2;
    guarded.people[290]=38;guarded.people[291]=33;fighterIndexes[29]=1;
    OrderType order={.OrderId=BATTLE,.City=2,.Object=1,.Person=29,.Food=400};return order;
}
static void checkEnd(unsigned expected,unsigned expectedMenus,unsigned expectedExits) {
    assert(enters==expected && selected==expected && menus==expectedMenus && exits==expectedExits);
    assert(fights==1 && results==1 && !clearMarch && !fighterIndexes[29]);
    assert(g_Cities[1].Persons==totalCandidates+2-expected && g_Cities[2].PersonQueue==totalCandidates+2-expected);
    assert(g_Persons[8].Belong==65535 && g_Persons[15].Belong==0 && g_FgtOver==1);
    assert(!g_hdMenuActive && g_hdMenuContext==0 && g_hdMenuKind==0 && scrolling==7);
    baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
    baye_hd_menu_begin();assert(g_hdMenuContext==1 && g_hdMenuKind==3);baye_hd_menu_end();
    assert(guarded.before==0x12345678 && guarded.after==0x87654321);
}
int main(void) {
    OrderType order=setup(3,99);assert(BattleDrv(&order)==1);checkEnd(3,3,0);
    assert(selectedIds[0]==20 && selectedIds[1]==19 && selectedIds[2]==22 && arrows==2);
    order=setup(3,1);assert(BattleDrv(&order)==1);checkEnd(1,2,1);
    assert(selectedIds[0]==20 && g_PersonsQueue[1]==19 && g_PersonsQueue[2]==22);
    order=setup(3,0);assert(BattleDrv(&order)==1);checkEnd(0,1,1);
    order=setup(0,99);assert(BattleDrv(&order)==1);checkEnd(0,0,0);
    order=setup(12,99);assert(BattleDrv(&order)==1);checkEnd(10,10,0);
    assert(selectedIds[0]==267 && selectedIds[9]==264 && g_PersonsQueue[1]==265 && g_PersonsQueue[2]==266);
    puts("native defender scope, real GBK names/index ACK, shrinking roster, exhausted/ten-person/EXIT boundaries passed");
}
`);
});

const march = common + marchAcknowledgement + String.raw`
#define STRING_CONST 1
#define STR_OBJ 2
#define NOTE_STR8 3
#define STR_NOFIGHTER 4
#define NOTE_STR7 5
#define STR_ARMOUT 6
#define NOTE_STR4 7
#define ADD16(value, delta) ((value) += (delta))
static struct { U8 fixFoodOverFlow, fixOverFlow16; } g_engineConfig;
static struct { U8 setx,sety; } g_CityPos;
static unsigned residentCount, consumeCount, marchDeparted, marchOk;
static void baye_hd_clear_march_ok(void) { marchOk=0; }
static PersonID residents[10];
static U16 requestedFood;
static void baye_hd_march_begin(U8 city) { (void)city; }
static void baye_hd_march_phase(U8 phase) { (void)phase; }
static void baye_hd_march_end(U8 departed) { marchDeparted=departed; }
static void baye_hd_march_selected(U8 count) { (void)count; }
static void baye_hd_set_march(U8 a,U8 b,U8 c,U8 ok) { (void)a;(void)b;(void)c;marchOk=ok; }
static void baye_hd_set_city_links(U8 city) { (void)city; }
static void baye_hd_set_map_city(U8 city) { (void)city; }
static void baye_hd_set_battle_pick(U8 active) { (void)active; }
static int IsMoney(U8 city,U8 order) { (void)city;(void)order;return 1; }
static void ShowConstStrMsg(U8 text) { (void)text; }
static U32 GetCityPersons(U8 city,PersonID* output) { (void)city;memcpy(output,residents,residentCount*sizeof(PersonID));return residentCount; }
static void ShowMapClear(void) {}
static PersonID ShowPersonControl(PersonID* persons,U32 count,PersonID initial,U8 a,U8 b,U8 c,U8 d) {
    (void)persons;(void)initial;(void)a;(void)b;(void)c;(void)d;assert(count>0);return 0;
}
static int DelPerson(U8 city,PersonID person) {
    (void)city;
    for (unsigned i=0;i<residentCount;++i) if(residents[i]==person) {
        memmove(&residents[i],&residents[i+1],(residentCount-i-1)*sizeof(PersonID));--residentCount;return 1;
    }
    return 0;
}
static void AddPerson(U8 city,PersonID person) { (void)city;residents[residentCount++]=person; }
static U16 GetFood(U8 mode,U16 max) { (void)mode;assert(max==1234);return requestedFood; }
static void ResLoadToMem(U8 resource,U8 id,U8* text) { (void)resource;(void)id;strcpy((char*)text,"target"); }
static void ShowGReport(PersonID person,U8* text) { (void)person;(void)text; }
static U8 GetCitySet(void* position) { (void)position;return 1; }
static U8 AttackCityRoad(U8 city,U32 xs,U32 ys,U32 target,U8 tx,U8 ty) {
    (void)city;(void)xs;(void)ys;(void)target;(void)tx;(void)ty;return 1;
}
static void OrderConsumeMoney(U8 city,U8 order) { (void)city;(void)order;++consumeCount; }
static void setupMarch(void) {
    reset();residentCount=2;residents[0]=255;residents[1]=511;
    consumeCount=marchDeparted=marchOk=0;requestedFood=100;
    g_Cities[0].Food=1234;g_Cities[0].Belong=1;g_Cities[1].Belong=2;
}
` + actualFunction('citycmdd.c', 'BattleMake');

test('real C rejected or cancelled march restores its generals without consuming food or money', async () => {
    await compile(march + String.raw`
int main(void) {
    setupMarch(); memset(queue,0,sizeof(queue));
    assert(BattleMake(0)==1 && residentCount==2 && g_Cities[0].Food==1234 && consumeCount==0);
    assert(residents[0]==511 && residents[1]==255 && marchDeparted==0 && marchOk==0);
    assert(addCalls==1 && messageCount==1);
    setupMarch();allowOrder=0;
    assert(BattleMake(0)==1 && residentCount==2 && g_Cities[0].Food==1234 && consumeCount==0);
    assert(marchDeparted==0 && marchOk==0 && addCalls==1 && messageCount==0);
    setupMarch();requestedFood=65535;
    assert(BattleMake(0)==1 && residentCount==2 && g_Cities[0].Food==1234 && consumeCount==0);
    assert(addCalls==0 && marchDeparted==0);
    setupMarch();
    assert(BattleMake(0)==1 && residentCount==0 && g_Cities[0].Food==1134 && consumeCount==1);
    assert(marchDeparted==1 && marchOk==1 && fighterIndexes[0]==1);
    assert(hdMarchOrderPending && hdMarchOrder.City==0 && hdMarchOrder.Object==1 && hdMarchOrder.Person==0);
    assert(guarded.people[0]==256 && guarded.people[1]==512 && guarded.people[2]==0);
    assert(queue[ORDER_MAX-FIGHT_ORDER_MAX].Food==100);
    puts("march rollback and successful single resource consumption passed");
}
`);
});

test('real C player succession preserves campaign ownership, retries cancellation and appoints only the chosen candidate', async () => {
    const scopes = ['baye_hd_menu_scope', 'baye_hd_menu_scope_default',
        'baye_hd_menu_begin', 'baye_hd_menu_end'].map((name) => actualFunction('hd-bridge.c', name)).join('\n');
    await compile(common + String.raw`
#define STR_MAKENEWKING 10
static U8 hdMenuNextContext,hdMenuNextKind,g_hdMenuActive,g_hdMenuContext,g_hdMenuKind;
static U32 g_hdMenuSeq;
static void baye_hd_fight_input_begin(U8 kind) { (void)kind; }
static void baye_hd_fight_input_end(void) {}
` + scopes + String.raw`
static unsigned scrolling=7, chooseCalls, deathNotes, newNotes, extinctNotes;
static unsigned kingdomCityCount=2, kingdomPersonCount=3;
static PersonID candidates[3]={2,256,599};
static U8 selectedContext,selectedKind;
static PersonID appointed;
static int SysScrollingTimerOpen(int next) { int previous=scrolling;scrolling=next;return previous; }
static PersonID ShowPersonControlInner(PersonID* persons,U32 count,PersonID initial,U8 a,U8 b,U8 c,U8 d) {
    (void)initial;(void)a;(void)b;(void)c;(void)d;
    assert(count==3 && memcmp(persons,candidates,sizeof(candidates))==0);
    assert(g_hdMenuActive && g_hdMenuContext==BAYE_HD_MENU_CONTEXT_CAMPAIGN && g_hdMenuKind==BAYE_HD_MENU_SUCCESSOR);
    selectedContext=g_hdMenuContext;selectedKind=g_hdMenuKind;
    assert(g_PlayerKing==7); /* no auto-appointment on opening or cancelling */
    return chooseCalls++==0 ? 65535 : 2;
}
` + actualFunction('showface.c', 'ShowPersonControl') + String.raw`
static void KingDeadNote(PersonID king) { assert(king==7);++deathNotes; }
static U32 GetKingCitys(PersonID king,U8* cities) { assert(king==7);cities[0]=0;cities[1]=1;return kingdomCityCount; }
static U32 GetKingPersons(PersonID king,PersonID* people) { assert(king==7);memcpy(people,candidates,sizeof(candidates));return kingdomPersonCount; }
static void ShowConstStrMsg(U8 text) { assert(text==STR_MAKENEWKING); }
static void NewKingNote(PersonID king) { appointed=king;++newNotes; }
static void WeightOverNote(PersonID king) { assert(king==7);++extinctNotes; }
` + actualFunction('citycmdd.c', 'KingOverDeal') + String.raw`
int main(void) {
    reset();g_PlayerKing=7;
    g_Cities[0].Belong=g_Cities[1].Belong=8;
    g_Persons[2].Belong=g_Persons[256].Belong=g_Persons[599].Belong=8;
    KingOverDeal(7);
    assert(chooseCalls==2 && g_PlayerKing==599 && appointed==599 && deathNotes==1 && newNotes==1);
    assert(selectedContext==BAYE_HD_MENU_CONTEXT_CAMPAIGN && selectedKind==BAYE_HD_MENU_SUCCESSOR);
    assert(!g_hdMenuActive && g_hdMenuContext==0 && scrolling==7);
    assert(g_Cities[0].Belong==600 && g_Cities[1].Belong==600);
    assert(g_Persons[2].Belong==600 && g_Persons[256].Belong==600 && g_Persons[599].Belong==600);
    assert(g_Persons[599].Devotion==100 && g_Persons[2].Devotion==0);
    g_PlayerKing=99;chooseCalls=0;g_Persons[2].IQ=30;g_Persons[256].IQ=99;g_Persons[599].IQ=60;
    KingOverDeal(7);
    assert(chooseCalls==0 && g_PlayerKing==99 && appointed==256); /* classic AI rule unchanged */
    kingdomPersonCount=0;
    KingOverDeal(7);
    assert(extinctNotes==1 && g_Cities[0].Belong==0 && g_Cities[1].Belong==0);
    kingdomCityCount=0;
    KingOverDeal(7);
    assert(extinctNotes==2);
    /* An ordinary city picker still receives its own default scope. */
    baye_hd_menu_scope_default(BAYE_HD_MENU_CONTEXT_CITY,BAYE_HD_MENU_PERSON);
    baye_hd_menu_begin();assert(g_hdMenuContext==BAYE_HD_MENU_CONTEXT_CITY && g_hdMenuKind==BAYE_HD_MENU_PERSON);
    baye_hd_menu_end();
    puts("player-selected succession, cancellation and preserved classic AI rules passed");
}
`);
});

test('real C person menu publishes every successor candidate beyond the old 80-name limit', async () => {
    const inner = actualFunction('showface.c', 'ShowPersonControlInner');
    const begin = inner.indexOf('                U8 packed[BAYE_HD_MENU_MAX];');
    const last = inner.indexOf('                baye_hd_set_menu(packed, BAYE_HD_NAME_SLOT, (U16)n, (U16)set);', begin);
    assert.ok(begin >= 0 && last > begin, 'actual person menu packing block exists');
    const block = inner.slice(begin, inner.indexOf('\n', last));
    await compile(String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;
typedef uint16_t U16;
typedef uint32_t U32;
typedef uint16_t PersonID;
#define gam_strlen(text) strlen((const char*)(text))
` + constants + '\n' + detailGlobals + String.raw`
static U8 g_hdMenuGbk[BAYE_HD_MENU_MAX];
static U16 g_hdMenuItemLen,g_hdMenuCount,g_hdMenuIndex;
static void GetPersonName(PersonID person,U8* name) { snprintf((char*)name,16,"p%04u",person); }
` + actualFunction('hd-bridge.c', 'hd_next_input_seq') + '\n' +
    actualFunction('hd-bridge.c', 'baye_hd_person_properties_retire') + '\n' +
    actualFunction('hd-bridge.c', 'baye_hd_set_menu') + String.raw`
static void publish(PersonID* person,U32 pcount,U32 set) {
` + block + String.raw`
}
int main(void) {
    PersonID people[2000];for(unsigned i=0;i<2000;++i)people[i]=(PersonID)i;
    publish(people,81,80);
    assert(g_hdMenuCount==81 && g_hdMenuIndex==80 && strcmp((char*)&g_hdMenuGbk[80*8],"p0080")==0);
    publish(people,2000,1999);
    assert(g_hdMenuCount==2000 && g_hdMenuIndex==1999 && strcmp((char*)&g_hdMenuGbk[1999*8],"p1999")==0);
    assert(g_hdMenuGbk[2000*8]==0);
    puts("all real successor candidates, including the final PersonID slot, passed");
}
`);
});

test('real C report ownership covers only the actual timed input wait and leaves passive or disabled reports inactive', async () => {
    await compile(String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;
typedef uint16_t U16;
typedef uint16_t PersonID;
typedef struct { int sx,sy,ex,ey; } RECT;
#define FAR
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY 95
#define ASC_WID 6
#define ASC_HGT 12
#define gam_strlen(text) strlen((const char*)(text))
static int c_Sx,c_Ex,c_Sy,c_Ey;
static struct { U8 disableAllPersonReport; } g_engineConfig;
static unsigned reportActive,reportKind,reportBegins,reportEnds,reportTextKind,waitDuration;
static void baye_hd_set_report(const U8* text,U16 person,U8 kind) { (void)text;(void)person;reportTextKind=kind; }
static void baye_hd_report_begin(U8 kind) { assert(!reportActive);reportActive=1;reportKind=kind;++reportBegins; }
static void baye_hd_report_end(void) { assert(reportActive);reportActive=0;reportKind=0;++reportEnds; }
static void gam_clrlcd(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d; }
static void gam_rect(int a,int b,int c,int d) { (void)a;(void)b;(void)c;(void)d; }
static void GamStrShowS(int a,int b,const U8* text) { (void)a;(void)b;(void)text;assert(!reportActive); }
static void ShowPersonHead(int a,int b,PersonID person) { (void)a;(void)b;(void)person;assert(!reportActive); }
static void PlcStrShowS(RECT* a,RECT* b,U8* text) { (void)a;(void)b;(void)text;assert(!reportActive); }
static void GamDelay(int duration,int mode) {
    assert(reportActive && reportKind==reportTextKind && mode==2);waitDuration=duration;
}
` + constants + '\n' + actualFunction('comOut.c', 'GamMsgBox') + '\n' + actualFunction('infdeal.c', 'ShowGReport') + String.raw`
int main(void) {
    U8 text[]="native report";
    GamMsgBox(text,0);
    assert(reportBegins==0 && reportEnds==0 && !reportActive);
    GamMsgBox(text,2);
    assert(reportBegins==1 && reportEnds==1 && !reportActive && waitDuration==200);
    ShowGReport(256,text);
    assert(reportBegins==2 && reportEnds==2 && !reportActive && waitDuration==300);
    g_engineConfig.disableAllPersonReport=1;
    ShowGReport(256,text);
    assert(reportBegins==2 && reportEnds==2 && !reportActive && reportTextKind==BAYE_HD_REPORT_GREPORT);
    puts("real report wait lifecycle and passive report isolation passed");
}
`);
});

test('real C battle settlement transfers ownership, preserves winning troops and keeps defeated generals as captives', async () => {
    await compile(String.raw`
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;
typedef uint16_t U16;
typedef uint32_t U32;
typedef uint16_t PersonID;
typedef uint16_t ToolID;
typedef U8 SBUF[512];
#define FAR
#define PID(id) ((PersonID)(id))
#define PID0 PID(0)
#define TID(id) ((ToolID)(id))
#define PERSON_COUNT 600
#define CITY_MAX 64
#define FGT_WON 1
#define FGT_LOSE 2
#define FGT_AT 2
#define FGT_DF 1
#define FGT_AUTO 3
#define STRING_CONST 1
#define STR_PERSONOVER 2
#define STR_CAV_NOTE1 3
#define gam_strcat(a,b) strcat((char*)(a),(const char*)(b))
typedef struct { PersonID Belong,OldBelong; U16 Arms; U8 IQ,Devotion; ToolID Equip[2]; } PersonType;
typedef struct { PersonID Belong,SatrapId; U16 PersonQueue,Persons,Farming,Commerce,Money,PeopleDevotion,Food; } CityType;
static PersonType g_Persons[PERSON_COUNT];
static PersonID g_PersonsQueue[PERSON_COUNT];
static CityType g_Cities[CITY_MAX];
static struct { U8 checkRedundantOnAddPerson,fixOverFlow16,disableFightToDeath; } g_engineConfig;
static struct { PersonID GenArray[20]; U16 MProvender,EProvender; U8 Mode; } g_FgtParam;
static U8 memory[4096];
#define SHARE_MEM memory
static PersonID cavpdb;
static unsigned cavps,kingOverCalls,winNotes,lossNotes;
static PersonID fallenKing;
static U8 expectedOldBelong;
static U8 DelPerson(U8 city,PersonID person);
` + actualFunction('cityedit.c', 'AddPerson') + '\n' + actualFunction('cityedit.c', 'DelPerson') + '\n' + actualFunction('cityedit.c', 'GetCityPersons') + String.raw`
static U8 gam_rand(void) { return 99; }
static U8 LostEscape(PersonID person,U8 city) { (void)person;(void)city;return 0; }
static ToolID AddGoods(U8 city,ToolID tool) { (void)city;(void)tool;return 1; }
static void SetGoodsByIndex(ToolID tool) { (void)tool; }
static void GetPersonName(PersonID person,U8* text) { (void)person;strcpy((char*)text,"person"); }
static void ResLoadToMem(U8 resource,U8 id,U8* text) { (void)resource;(void)id;strcpy((char*)text,"report"); }
static void GamMsgBox(U8* text,U8 delay) { (void)text;(void)delay; }
static void ShowFightWinNote(PersonID king) { (void)king;assert(g_Cities[1].Belong==expectedOldBelong);++winNotes; }
static void ShowFightLossNote(void) { ++lossNotes; }
static void KingOverDeal(PersonID king) { fallenKing=king;++kingOverCalls; }
static U16 add_16(U16 a,U16 b) { return a+b; }
` + actualFunction('citycmdd.c', 'HoldCaptive') + '\n' + actualFunction('citycmdd.c', 'TheLoserDeal') + '\n' + actualFunction('citycmdd.c', 'BeOccupied') + '\n' + actualFunction('citycmdd.c', 'FightResultDeal') + String.raw`
static void setup(void) {
    memset(g_Persons,0,sizeof(g_Persons));memset(g_Cities,0,sizeof(g_Cities));
    memset(g_PersonsQueue,0,sizeof(g_PersonsQueue));memset(&g_FgtParam,0,sizeof(g_FgtParam));
    cavps=kingOverCalls=winNotes=lossNotes=0;
    expectedOldBelong=7;g_Cities[1].Belong=7;
    g_Cities[1].Farming=1000;g_Cities[1].Commerce=2000;g_Cities[1].Money=3000;g_Cities[1].PeopleDevotion=100;
    g_FgtParam.MProvender=400;g_FgtParam.EProvender=600;g_FgtParam.Mode=FGT_AT;
}
int main(void) {
    setup();
    /* Victors were removed from their origin before battle. The target still
     * has one old-faction civilian; the defending ruler is in the fight list. */
    g_Persons[255].Belong=1;g_Persons[255].Arms=400;
    g_Persons[511].Belong=1;g_Persons[511].Arms=600;
    g_Persons[12].Belong=7;g_Persons[12].Arms=300;AddPerson(1,12);
    g_Persons[6].Belong=7;g_Persons[6].Arms=900;
    g_FgtParam.GenArray[0]=256;g_FgtParam.GenArray[1]=512;g_FgtParam.GenArray[10]=7;
    assert(FightResultDeal(1,FGT_WON)==0);
    assert(winNotes==1 && lossNotes==0 && kingOverCalls==1 && fallenKing==6);
    assert(g_Cities[1].Belong==1 && g_Cities[1].SatrapId==256 && g_Cities[1].Persons==4);
    assert(g_Persons[255].Belong==1 && g_Persons[255].Arms==400);
    assert(g_Persons[511].Belong==1 && g_Persons[511].Arms==600);
    assert(g_Persons[12].Belong==0 && g_Persons[12].Arms==0);
    assert(g_Persons[6].Belong==65535 && g_Persons[6].OldBelong==7 && g_Persons[6].Arms==0 && cavps==1);
    assert(g_Cities[1].Farming==950 && g_Cities[1].Commerce==1900 && g_Cities[1].Money==2850);
    assert(g_Cities[1].PeopleDevotion==90 && g_Cities[1].Food==1000);
    setup();g_Persons[0].Belong=1;g_Persons[0].Arms=500;
    g_Persons[6].Belong=7;g_Persons[6].Arms=800;
    g_FgtParam.GenArray[0]=1;g_FgtParam.GenArray[10]=7;
    assert(FightResultDeal(1,FGT_LOSE)==0);
    assert(g_Cities[1].Belong==7 && g_Persons[6].Belong==7 && g_Persons[6].Arms==800);
    assert(g_Persons[0].Belong==65535 && g_Persons[0].OldBelong==1 && g_Persons[0].Arms==0);
    assert(kingOverCalls==1 && fallenKing==0 && lossNotes==1 && winNotes==0);
    assert(g_Cities[1].Food==1000 && g_Cities[1].Persons==2);
    puts("real victory/loss occupation, captive and resource settlement passed");
}
`);
});
