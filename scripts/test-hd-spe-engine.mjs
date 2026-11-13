#!/usr/bin/env node
// Compile actual PlcMovie, GamDelay, protocol and LCD buffer functions.
// Only ROM I/O, pixel drawing and timer/event delivery are fixture boundaries.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test, { after } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'vendor/iBaye/src');
const read = filename => readFileSync(join(directory, filename), 'utf8').replace(/\r\n/g, '\n');
const bridge = read('hd-bridge.c'), header = read('hd-bridge.h');
const run = promisify(execFile);
function actual(filename, name) {
    const source = read(filename);
    const match = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm').exec(source);
    assert.ok(match, `actual ${filename}::${name} exists`);
    const end = source.indexOf('\n}', match.index);
    assert.ok(end > match.index, `actual ${filename}::${name} closes`);
    return source.slice(match.index, end + 2);
}
function typedef(filename, name) {
    const source = read(filename);
    const match = new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*' + name + ';').exec(source);
    assert.ok(match, `actual typedef ${name} exists`);
    return match[0];
}
const constants = header.split('\n').filter(line => /^#define BAYE_HD_(?:SPE|MAKER|ATTACK|COMPOSITION|SKILL|RESULT|AI_TARGET|STATUS_EFFECT)_/.test(line)).join('\n');
const aiDefinitions = (read('baye/attribute.h') + '\n' + read('baye/fight.h') + '\n' + read('baye/consdef.h')).split('\n').filter(l => /^#define\s+(?:PERSON_MAX|FGT_PLAMAX|CMD_ATK|CMD_STGM|STATE_SW|TIL_WID|WK_SX|WK_SY)\b/.test(l)).join('\n');
const globals = bridge.slice(bridge.indexOf('U8 g_hdSpePendingKind ='), bridge.indexOf('U8 g_hdSkillActive ='));
function observerFunctions(names) {
    const found = new Map();
    function add(name) {
        if (found.has(name)) return;
        const body = actual('hd-bridge.c', name); found.set(name, body);
        for (const call of body.matchAll(/\b((?:hd_|baye_hd_)\w+)\s*\(/g))
            if (new RegExp('^(?:(?:static|inline|FAR|const)\\s+)*[A-Za-z_]\\w*[\\t *]+' + call[1] + '\\([^;]*?\\)\\s*\\{', 'm').test(bridge)) add(call[1]);
    }
    names.forEach(add);
    return [...found.values()].map(body => body.slice(0, body.indexOf('{')).trim() + ';').join('\n') + '\n' + [...found.values()].join('\n');
}
const protocol = ['hd_next_input_seq', 'hd_spe_notify', 'baye_hd_maker_begin', 'baye_hd_maker_hold',
    'baye_hd_maker_end', 'hd_maker_spe_end', 'hd_spe_publish', 'baye_hd_begin_spe',
    'baye_hd_spe_tick', 'baye_hd_spe_context', 'baye_hd_spe_enter', 'baye_hd_spe_ready',
    'baye_hd_spe_frame', 'baye_hd_spe_end', 'baye_hd_spe_lcd_dirty', 'baye_hd_spe_lcd_copy',
    'baye_hd_spe_lcd_flush', 'baye_hd_spe_invalidate', 'baye_hd_spe_draw_begin',
    'baye_hd_spe_draw_end', 'baye_hd_spe_clear','baye_hd_spe_picture_drawn', 'baye_hd_skill_movie_shape', 'baye_hd_status_shape','baye_hd_ai_target_shape'];
const protocolSource = observerFunctions(protocol);

// Native aligned-one headers are fixed 6/5/7-byte records. Build an independent ROM byte
// fixture, rather than taking the protocol's remaining-lifetime array as oracle.
const rom = Buffer.alloc(59);
rom.set([0, 0, 3, 2, 0, 2]);
rom.set([0, 0, 7, 2, 0, 12, 0, 5, 3, 1, 24, 0, 6, 2, 0], 6);
for (const [offset, mask] of [[21, 0], [36, 1]]) {
    rom.writeUInt16LE(8, offset); rom.writeUInt16LE(8, offset + 2);
    rom.writeUInt16LE(1, offset + 4); rom[offset + 6] = mask;
    rom.fill(0xff, offset + 7, offset + 7 + 8 * (mask + 1));
}
let fingerprint = 2166136261;
for (const byte of rom) fingerprint = Math.imul(fingerprint ^ byte, 16777619) >>> 0;

const fixture = String.raw`
#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8;
typedef uint16_t U16;
typedef uint32_t U32;
typedef int16_t I16;
typedef int32_t I32;
typedef int16_t PT;
typedef int8_t BOOL;
#define MAX_LEVEL 30
#define FGT_EXPMAX 100
#define FAR
#define EM_ASM(...) ((void)0)
#define FGTA_MAX 20
#define MAIN_SPE 3
#define MAKER_SPE 6
#define STACHG_SPE 27
#define AX_SCALE 2
#define min(a,b) ((a)<(b)?(a):(b))
` + constants + '\n' + typedef('hd-bridge.h', 'HdResultScope') + '\n' + typedef('hd-bridge.h', 'HdPictureSource') + '\n' + typedef('hd-bridge.h','HdStatusCheckScope')+'\n'+typedef('hd-bridge.h','HdStatusTransition')+'\n'+typedef('hd-bridge.h','HdStatusEffectSource')+'\n'+typedef('hd-bridge.h', 'HdAiTargetSource') + '\n' + typedef('hd-bridge.h', 'HdSpeScope') + '\n' +
    typedef('baye/paccount.h', 'SPEUNIT') + '\n' + typedef('baye/paccount.h', 'SPERES') + '\n' +
    typedef('baye/graph.h', 'PictureHeadType') + String.raw`
static U8 g_hdFightActive=1,g_hdMovieActive=0,g_FlipDrawing=0,g_paintColor=255;
static U16 g_hdMovieId=0;
typedef U16 PersonID;typedef U16 ToolID;
static U8 g_hdReportActive,g_hdHelpActive,g_hdQtyActive,g_FgtOver;
static U8 g_MapSX,g_MapSY,g_MapWid,g_MapHgt;
static U32 g_paintPalette[256];
static int g_screenWidth=16,g_screenHeight=16;
static U8 g_VisScr[65536];
` + aiDefinitions + '\n' + typedef('baye/attribute.h','PersonType') + '\n' + typedef('baye/fight.h','JLPOS') + '\n' + typedef('baye/fight.h','FGTJK') + '\nstatic JLPOS g_GenPos[FGTA_MAX]; static FGTJK g_FgtParam;static PersonType g_Persons[PERSON_MAX];\n' + globals + '\n' + protocolSource + String.raw`
static U8 resource[2048];
static U8 *g_CBnkPtr=resource;
typedef struct { U32 length,position; } FakeFile;
static FakeFile romFile;
static FakeFile *g_LibFp=&romFile;
static U32 declaredLength;
static int missing;
static U8 *ResLoadToCon(U16 id,U16 index,U8*bank){(void)id;(void)index;(void)bank;return missing?NULL:resource;}
static U32 ResGetItemLen(U16 id,U16 index){(void)id;(void)index;return declaredLength;}
static U32 gam_ftell(FakeFile*file){return file->position;}
static int gam_fseek(FakeFile*file,U32 offset,int origin){assert(origin==SEEK_SET);if(offset>=file->length)return -1;file->position=offset;return 0;}
static U16 gam_fread(void*dst,U16 size,U16 count,FakeFile*file){U32 amount=(U32)size*count;
    if(amount>file->length-file->position)amount=file->length-file->position;
    memcpy(dst,resource+file->position,amount);file->position+=amount;return (U16)(amount/size);}
static void gamTraceP(U16 id){(void)id;}
` + ['hd_spe_resource_available', 'hd_spe_resource_valid', 'hd_spe_resource_fingerprint', 'hd_skill_resource_shape']
    .map(name => actual('PublicFun.c', name)).join('\n') + String.raw`

#define SCR_W g_screenWidth
#define SCR_H g_screenHeight
#define BYTES_PERLINE (SCR_W*AX_SCALE)
static char *static_buffer,*backup_buffer,*buffer,*scr_buffer;
static size_t buffer_size;
static int isLcdDirty;
static void (*_lcd_fluch_cb)(char*);
static void *gam_malloc(size_t size){return malloc(size);}
static void gam_free(void*pointer){free(pointer);}
` + ['screen_buffer_realloc', 'convert_image', 'timed_flush_lcd', 'SysSaveScreen',
    'SysRestoreScreen', 'SysAdjustLCDBuffer', 'SysCopyScreen'].map(name => actual('platform/common/sys.c', name)).join('\n') + String.raw`
static int currentX,currentY,paintedMask,commitCount,overlapCount,sameFrontierChanged,delayCount;
static int drawCount,clearCount,flushCount,lastMask=-1,lastFrontier=-1,flushOnDelay;
static U32 lastCopiedCommit,lastCopiedEvent;
static int unitAt(int x,int y){for(int i=0;i<3;i++)if(x==currentX+i*12&&y==currentY)return i;assert(0);return -1;}
static void draw(int x,int y,int wid,int hig,U8*data,U8*screen){(void)data;(void)screen;assert(wid==8&&hig==8);
    paintedMask|=1<<unitAt(x,y);drawCount++;}
static void GamPicShowV(PT x,PT y,PT w,PT h,U8*data,U8*screen){draw(x,y,w,h,data,screen);}
static void GamMPicShowV(PT x,PT y,PT w,PT h,U8*data,U8*screen){draw(x,y,w,h,data,screen);}
static void gam_clrvscr(int x,int y,int ex,int ey,U8*screen){(void)screen;assert(ex-x+1==4&&ey-y+1==4);
    paintedMask&=~(1<<unitAt(x,y));clearCount++;}
static void lcdCallback(char*data){(void)data;flushCount++;
    assert(g_hdSpeDisplayCommitSeq==lastCopiedCommit&&g_hdSpeDisplayEventId==lastCopiedEvent);}
static void gam_copyscr(U8*screen){assert(g_hdSpeFrameValid);assert(g_hdSpeOriginX==currentX&&g_hdSpeOriginY==currentY);
    if(g_hdSpeProtocolValid)assert(g_hdSpeVisibleFrames[0]==paintedMask);
    for(int i=1;i<32;i++)assert(g_hdSpeVisibleFrames[i]==0);
    if((paintedMask&(paintedMask-1))!=0)overlapCount++;
    if(lastFrontier==g_hdSpeFrameIndex&&lastMask!=paintedMask)sameFrontierChanged++;
    lastFrontier=g_hdSpeFrameIndex;lastMask=paintedMask;commitCount++;
    assert(g_hdSpeResourceFingerprint==EXPECTED_FINGERPRINT);
    assert(g_hdSpeResourceLength==ROM_LENGTH);
    assert(romFile.position==romFile.length);
    SysCopyScreen(screen);lastCopiedCommit=g_hdSpeCommitSeq;lastCopiedEvent=g_hdSpeEventId;}
` + actual('comOut.c', 'GamShowFrame') + String.raw`
typedef struct { U8 type; U16 param; } GMType;
#define VM_TIMER 1
#define VM_CHAR_FUN 2
#define VM_TOUCH 3
#define VT_TOUCH_UP 1
#define TIMER_DLY 1
#define GamMsgIsTimer0(message) ((message).type==VM_TIMER&&(message).param==0)
static U8 queuedKey;
static int keyReads,timerOpened=1,scrolling=1;
static int SysScrollingTimerOpen(int value){int old=scrolling;scrolling=value;return old;}
static U8 SysGetTimer1Number(void){return timerOpened;}
static void SysTimer1Close(void){timerOpened=0;}
static void SysTimer1Open(U16 interval){timerOpened=interval;}
static void GamGetMsg(GMType*message){assert(++delayCount<1000);
    if(flushOnDelay&&isLcdDirty)timed_flush_lcd();
    if(queuedKey){message->type=VM_CHAR_FUN;message->param=queuedKey;queuedKey=0;keyReads++;}
    else {message->type=VM_TIMER;message->param=1;}}
` + actual('comIn.c', 'GamDelay') + '\n' + actual('PublicFun.c', 'PlcMovie') + String.raw`
static void prepare(void){
    static const U8 initial[]={ROM_BYTES};
    assert(sizeof(SPERES)==6&&sizeof(SPEUNIT)==5&&sizeof(PictureHeadType)==7);
    baye_hd_spe_invalidate();memcpy(resource,initial,sizeof(initial));
    romFile.length=declaredLength=sizeof(initial);romFile.position=romFile.length;
    g_FlipDrawing=0;g_paintColor=255;missing=0;queuedKey=0;
    paintedMask=commitCount=overlapCount=sameFrontierChanged=delayCount=drawCount=clearCount=flushCount=0;
    lastMask=lastFrontier=-1;lastCopiedCommit=lastCopiedEvent=0;flushOnDelay=0;keyReads=0;
    currentX=-3;currentY=-2;isLcdDirty=0;
    _lcd_fluch_cb=lcdCallback;screen_buffer_realloc(16*16*AX_SCALE*AX_SCALE);
}
static void readyScope(HdSpeScope*scope,U8 flag){baye_hd_spe_enter(scope,35,0,0,0,0,2,flag);
    baye_hd_spe_ready(scope,3,2,0,59,2,1);}
static void playback(void){prepare();flushOnDelay=1;
    assert(PlcMovie(3,0,0,2,1,currentX,currentY)==255);
    assert(commitCount>=4&&drawCount>=3&&clearCount>=1&&overlapCount>=1&&sameFrontierChanged>=1);
    assert(g_hdSpeActive==0&&g_hdSpeEndReason==BAYE_HD_SPE_END_COMPLETE);
    assert(flushCount>0&&keyReads==0&&queuedKey==0);
    assert(g_hdSpeLastEndedId==lastCopiedEvent);}
static void displayLifecycle(void){prepare();HdSpeScope scope;readyScope(&scope,1);U8 remaining[3]={2,2,0};
    baye_hd_spe_frame(&scope,0,remaining,1);SysCopyScreen(g_VisScr);
    assert(g_hdSpeDisplayFrameValid==0);
    baye_hd_spe_frame(&scope,1,remaining,2);SysCopyScreen(g_VisScr);
    lastCopiedCommit=2;lastCopiedEvent=scope.eventId;timed_flush_lcd();
    assert(flushCount==1&&g_hdSpeDisplayCommitSeq==2&&g_hdSpeDisplayVisibleFrames[0]==3);
    baye_hd_spe_frame(&scope,1,remaining,2);SysCopyScreen(g_VisScr);SysSaveScreen();SysRestoreScreen();
    lastCopiedCommit=lastCopiedEvent=0;timed_flush_lcd();assert(g_hdSpeDisplayFrameValid==0);
    baye_hd_spe_frame(&scope,1,remaining,2);SysCopyScreen(g_VisScr);SysAdjustLCDBuffer(8,8);
    timed_flush_lcd();assert(g_hdSpeDisplayFrameValid==0);
    baye_hd_spe_frame(&scope,1,remaining,2);SysCopyScreen(g_VisScr);SysAdjustLCDBuffer(32,32);
    timed_flush_lcd();assert(g_hdSpeDisplayFrameValid==0);
    baye_hd_spe_end(&scope,BAYE_HD_SPE_END_COMPLETE,255);assert(g_hdSpeActive==0);}
static void resources(void){prepare();baye_hd_spe_context(BAYE_HD_SPE_KIND_SKILL,12,3,4);missing=1;
    assert(PlcMovie(35,0,0,2,0,0,0)==255&&g_hdSpeEndReason==BAYE_HD_SPE_END_MISSING);
    assert(g_hdSpePendingKind==0&&hdSpePendingContext==0&&commitCount==0);
    prepare();declaredLength=romFile.length+1;
    assert(PlcMovie(35,0,0,2,0,0,0)==255&&g_hdSpeEndReason==BAYE_HD_SPE_END_INVALID&&commitCount==0);
    assert(romFile.position==romFile.length);
    prepare();assert(hd_spe_resource_available(resource,romFile.length));assert(romFile.position==romFile.length);
    assert(hd_spe_resource_available(resource+romFile.length-1,1));assert(romFile.position==romFile.length);
    assert(!hd_spe_resource_available(resource+romFile.length-1,2));assert(romFile.position==romFile.length);
    prepare();resource[2]=0;assert(PlcMovie(35,0,0,2,0,0,0)==255&&g_hdSpeEndReason==BAYE_HD_SPE_END_INVALID);
    prepare();resource[10]=2;assert(PlcMovie(35,0,0,2,0,0,0)==255&&commitCount==0);
    prepare();assert(PlcMovie(35,0,2,1,0,0,0)==255&&commitCount==0);
    prepare();romFile.length=declaredLength=35;assert(PlcMovie(35,0,0,2,0,0,0)==255&&commitCount==0);}
static void keyboard(void){prepare();queuedKey=0x27;
    assert(PlcMovie(3,0,0,2,1,currentX,currentY)==0x27&&g_hdSpeEndReason==BAYE_HD_SPE_END_KEY);
    assert(keyReads==1&&g_hdSpeEndKey==0x27);
    prepare();queuedKey=0x27;
    assert(PlcMovie(3,0,0,2,3,currentX,currentY)==255&&g_hdSpeEndReason==BAYE_HD_SPE_END_COMPLETE);
    assert(keyReads==1&&g_hdSpeEndKey==255);
    prepare();queuedKey=0x27;
    assert(PlcMovie(3,0,0,2,2,currentX,currentY)==255&&g_hdSpeEndReason==BAYE_HD_SPE_END_COMPLETE);
    assert(keyReads==1&&g_hdSpeEndKey==255);
    prepare();HdSpeScope scope;readyScope(&scope,3);assert(g_hdSpeSkipEligible==0&&g_hdSpeProtocolValid==0);
    baye_hd_spe_end(&scope,1,255);readyScope(&scope,1);assert(g_hdSpeSkipEligible==1);
    baye_hd_spe_end(&scope,1,255);readyScope(&scope,2);assert(g_hdSpeSkipEligible==0&&g_hdSpeProtocolValid==0);
    baye_hd_spe_end(&scope,1,255);}
static void nested(void){prepare();HdSpeScope scopes[17];U8 remaining[3]={3,0,0};
    baye_hd_spe_context(BAYE_HD_SPE_KIND_SKILL,7,3,99);readyScope(&scopes[0],0);
    assert(g_hdSpeContextKnown&&g_hdSpeSkillId==7&&g_hdSpeActorIndex==3&&g_hdSpeTargetIndex==255);
    baye_hd_spe_frame(&scopes[0],0,remaining,1);SysCopyScreen(g_VisScr);
    U32 parent=scopes[0].eventId;readyScope(&scopes[1],0);
    assert(g_hdSpeParentEventId==parent&&g_hdSpeDepth==2&&!g_hdSpeContextKnown);
    baye_hd_spe_end(&scopes[1],1,255);assert(g_hdSpeEventId==parent&&!g_hdSpeFrameValid);
    for(int i=1;i<17;i++)readyScope(&scopes[i],0);
    assert(g_hdSpeDepth==17&&!g_hdSpeProtocolValid&&g_hdSpeActive);
    for(int i=16;i>=0;i--)baye_hd_spe_end(&scopes[i],1,255);
    assert(!g_hdSpeActive);readyScope(&scopes[0],0);U32 oldGeneration=g_hdSpeGeneration;
    baye_hd_spe_invalidate();assert(g_hdSpeGeneration!=oldGeneration&&!g_hdSpeActive&&!g_hdSpeDisplayFrameValid);
    readyScope(&scopes[1],0);U32 fresh=g_hdSpeEventId;baye_hd_spe_end(&scopes[0],1,255);
    assert(g_hdSpeEventId==fresh&&g_hdSpeActive);baye_hd_spe_end(&scopes[1],1,255);
    g_hdSpeGeneration=0xffffffffu;baye_hd_spe_invalidate();assert(g_hdSpeGeneration==1);}
static void unsupported(void){prepare();HdSpeScope scope;U8 remaining[3]={3,0,0};readyScope(&scope,0);
    assert(g_hdSpeProtocolValid);g_FlipDrawing=1;baye_hd_spe_frame(&scope,0,remaining,1);assert(!g_hdSpeProtocolValid&&g_hdSpeFrameValid);
    g_FlipDrawing=0;baye_hd_spe_frame(&scope,0,remaining,1);assert(!g_hdSpeProtocolValid);
    baye_hd_spe_end(&scope,1,255);g_paintColor=0;readyScope(&scope,0);assert(!g_hdSpeProtocolValid);
    baye_hd_spe_end(&scope,1,255);g_paintColor=255;readyScope(&scope,0);g_paintColor=0;
    baye_hd_spe_frame(&scope,0,remaining,1);assert(!g_hdSpeProtocolValid&&g_hdSpeFrameValid);
    baye_hd_spe_end(&scope,1,255);prepare();resource[27]=2;U8 simple=1;
    romFile.length=declaredLength=75;memmove(resource+52,resource+36,23);memset(resource+36,255,16);
    assert(hd_spe_resource_valid(resource,75,0,2,&simple)&&!simple);
    baye_hd_spe_enter(&scope,35,0,0,0,0,2,0);baye_hd_spe_ready(&scope,3,2,0,75,2,simple);
    assert(!g_hdSpeProtocolValid);baye_hd_spe_end(&scope,1,255);}
static void classification(void){prepare();HdSpeScope scope;
    for(int id=3;id<=6;id+=3){baye_hd_spe_enter(&scope,(U16)id,0,0,0,0,2,1);
        assert(scope.kind==BAYE_HD_SPE_KIND_OPENING&&g_hdSpeKind==BAYE_HD_SPE_KIND_OPENING);
        baye_hd_spe_end(&scope,1,255);}
    baye_hd_spe_enter(&scope,27,0,0,0,0,2,0);
    assert(scope.kind==BAYE_HD_SPE_KIND_STATUS&&g_hdSpeKind==BAYE_HD_SPE_KIND_STATUS);baye_hd_spe_end(&scope,1,255);
    readyScope(&scope,0);assert(scope.kind==BAYE_HD_SPE_KIND_ATTACK&&g_hdSpeKind==BAYE_HD_SPE_KIND_ATTACK);
    baye_hd_spe_end(&scope,1,255);g_hdFightActive=0;
    readyScope(&scope,0);assert(scope.kind==BAYE_HD_SPE_KIND_OTHER&&g_hdSpeKind==BAYE_HD_SPE_KIND_OTHER);
    baye_hd_spe_end(&scope,1,255);
    for(int kind=BAYE_HD_SPE_KIND_SKILL;kind<=BAYE_HD_SPE_KIND_ATTACK;kind++){
        baye_hd_spe_context((U8)kind,14,3,4);readyScope(&scope,0);
        assert(scope.kind==kind&&g_hdSpeKind==kind&&g_hdSpeContextKnown&&g_hdSpeSkillId==14);
        assert(g_hdSpeActorIndex==3&&g_hdSpeTargetIndex==4);baye_hd_spe_end(&scope,1,255);}
}
int main(int argc,char**argv){assert(argc==2);switch(atoi(argv[1])){
    case 1:playback();break;case 2:displayLifecycle();break;case 3:resources();break;
    case 4:keyboard();break;case 5:nested();break;case 6:unsupported();break;case 7:classification();break;default:assert(0);}
    puts("actual SPE engine fixture passed");return 0;}
`;

let temporary, compiled;
async function executable() {
    if (!compiled) compiled = (async () => {
        temporary = mkdtempSync(join(tmpdir(), 'baye-hd-spe-'));
        const filename = join(temporary, 'spe.c');
        const binary = join(temporary, process.platform === 'win32' ? 'spe.exe' : 'spe');
        writeFileSync(filename, '#define EXPECTED_FINGERPRINT ' + fingerprint + 'u\n#define ROM_LENGTH ' + rom.length + 'u\n' +
            fixture.replace('ROM_BYTES', [...rom].join(',')));
        // Windows MSVC-target clang ignores the engine typedefs' aligned(1).
        // Pack the extracted fixture to reproduce the actual WASM ROM ABI.
        await run(process.env.CC || 'cc', ['-std=c99', '-fpack-struct=1', '-Wall', '-Wextra', filename, '-o', binary], { timeout: 30000 });
        return binary;
    })();
    return compiled;
}
after(() => {
    if (!temporary) return;
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()), 'Cleanup stays in the explicit temporary directory');
    assert.ok(basename(temporary).startsWith('baye-hd-spe-'), 'Cleanup targets only this fixture');
    rmSync(temporary, { recursive: true, force: true });
});
for (const [index, name] of [
    [1, 'actual PlcMovie commits match independent draw/clear lifetimes, negative origins and AX_SCALE'],
    [2, 'actual LCD copy/timer coalescing and restore/adjust/reallocation reject stale displayed stamps'],
    [3, 'actual resource guards reject missing/truncated/invalid payloads and preserve a strict ROM EOF cursor'],
    [4, 'actual GamDelay accepts keyflag 1 once while flags 3 and 2 retain their native semantics'],
    [5, 'native nested calls restore parents neutrally, exceed depth safely and ignore stale reset unwinds'],
    [6, 'unsupported mask, flip or paint state keeps native frame commits without claiming HD protocol support'],
    [7, 'actual opening, status, fight fallback and explicit skill/attack calls publish their native kind and context']
]) test(name, async () => {
    const result = await run(await executable(), [String(index)], { timeout: 20000 });
    assert.match(result.stdout, /actual SPE engine fixture passed/);
});
