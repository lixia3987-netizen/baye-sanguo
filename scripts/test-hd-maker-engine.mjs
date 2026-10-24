#!/usr/bin/env node
// Compile the actual maker caller, SPE player, delay, observer and LCD buffer.
// Fixture boundaries are ROM I/O, pixel drawing, hook delivery and native messages.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test, { after } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root, 'vendor/iBaye/src', file), 'utf8').replace(/\r\n/g, '\n');
const run = promisify(execFile);
function actual(file, name) {
    const source = read(file);
    const match = new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b' + name + '\\([^;]*?\\)\\s*\\{', 'm').exec(source);
    assert.ok(match, `actual ${file}::${name} exists`);
    const end = source.indexOf('\n}', match.index);
    assert.ok(end > match.index, `actual ${file}::${name} closes`);
    return source.slice(match.index, end + 2);
}
function typedef(file, name) {
    const result = new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*' + name + ';').exec(read(file));
    assert.ok(result, `actual typedef ${name}`);
    return result[0];
}
const header = read('hd-bridge.h'), bridge = read('hd-bridge.c');
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
const helpers = ['hd_next_input_seq', 'hd_spe_notify', 'baye_hd_maker_begin', 'baye_hd_maker_hold',
    'baye_hd_maker_end', 'hd_maker_spe_end', 'hd_spe_publish', 'baye_hd_begin_spe',
    'baye_hd_spe_context', 'baye_hd_spe_enter', 'baye_hd_spe_ready', 'baye_hd_spe_frame',
    'baye_hd_spe_tick', 'baye_hd_spe_end', 'baye_hd_spe_lcd_dirty', 'baye_hd_spe_lcd_copy',
    'baye_hd_spe_lcd_flush', 'baye_hd_spe_invalidate', 'baye_hd_spe_draw_begin',
    'baye_hd_spe_draw_end', 'baye_hd_spe_clear','baye_hd_spe_picture_drawn', 'baye_hd_skill_movie_shape', 'baye_hd_status_shape','baye_hd_ai_target_shape'];
const observerSource = observerFunctions(helpers);

// Independent fixed RCHEAD decoding obtains the actual complete MAKER item.
const lib = readFileSync(join(root, 'libs/dat-mod.lib'));
assert.equal(createHash('sha256').update(lib).digest('hex'), '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
const address = lib.readUInt32LE((6 - 1) * 4);
assert.equal(lib.readUInt16LE(address + 4), 6);
assert.equal(lib.readUInt16LE(address + 6), 1);
const rom = lib.subarray(address + 14, address + 14 + lib.readUInt32LE(address + 8));
assert.equal(rom.length, 2413);
assert.deepEqual([...rom.subarray(0, 6)], [0, 0, 96, 1, 0, 95]);
assert.equal(createHash('sha256').update(rom).digest('hex'), '1bf7052e0272c3ebcc4385b7716dfc9bf67465ecd007a5f894025e0c35ffc277');
for (let i = 0; i < 96; i++) assert.deepEqual([...rom.subarray(6 + i * 5, 11 + i * 5)], [0, 95 - i, 10, 10, 0]);
const pictureOffset = 6 + 96 * 5;
assert.equal(rom.readUInt16LE(pictureOffset), 159);
assert.equal(rom.readUInt16LE(pictureOffset + 2), 96);
assert.equal(rom[pictureOffset + 6], 0);
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
#define AX_SCALE 1
#define WK_SX 0
#define WK_SY 0
#define min(a,b) ((a)<(b)?(a):(b))
` + constants + '\n' + typedef('hd-bridge.h', 'HdResultScope') + '\n' + typedef('hd-bridge.h', 'HdPictureSource') + '\n' + typedef('hd-bridge.h','HdStatusCheckScope')+'\n'+typedef('hd-bridge.h','HdStatusTransition')+'\n'+typedef('hd-bridge.h','HdStatusEffectSource')+'\n'+typedef('hd-bridge.h', 'HdAiTargetSource') + '\n' + typedef('hd-bridge.h', 'HdSpeScope') + '\n' +
    typedef('baye/paccount.h', 'SPEUNIT') + '\n' + typedef('baye/paccount.h', 'SPERES') + '\n' +
    typedef('baye/graph.h', 'PictureHeadType') + String.raw`
static U8 g_hdFightActive=0,g_hdMovieActive=0,g_FlipDrawing=0,g_paintColor=255;
static U16 g_hdMovieId=0;
typedef U16 PersonID;typedef U16 ToolID;
static U8 g_hdReportActive,g_hdHelpActive,g_hdQtyActive,g_FgtOver;
static U8 g_MapSX,g_MapSY,g_MapWid,g_MapHgt;
static U32 g_paintPalette[256];
static int g_screenWidth=160,g_screenHeight=96;
static U8 g_VisScr[160*96];
` + aiDefinitions + '\n' + typedef('baye/attribute.h','PersonType') + '\n' + typedef('baye/fight.h','JLPOS') + '\n' + typedef('baye/fight.h','FGTJK') + '\nstatic JLPOS g_GenPos[FGTA_MAX]; static FGTJK g_FgtParam;static PersonType g_Persons[PERSON_MAX];\n' + globals + '\n' + observerSource + String.raw`
static const U8 initial[]={ROM_BYTES};
static U8 resource[4096];
static U8 *g_CBnkPtr=resource;
typedef struct {U32 length,position;} FakeFile;
static FakeFile romFile,*g_LibFp=&romFile;
static U32 declaredLength;
static int missing;
static U8* ResLoadToCon(U16 id,U16 index,U8*bank){(void)bank;assert(index==1);assert(id==6||id==3);return missing?NULL:resource;}
static U32 ResGetItemLen(U16 id,U16 index){(void)id;assert(index==1);return declaredLength;}
static U32 gam_ftell(FakeFile*f){return f->position;}
static int gam_fseek(FakeFile*f,U32 offset,int origin){assert(origin==SEEK_SET);if(offset>=f->length)return -1;f->position=offset;return 0;}
static U16 gam_fread(void*dst,U16 size,U16 count,FakeFile*f){U32 amount=(U32)size*count;
    if(amount>f->length-f->position)amount=f->length-f->position;
    memcpy(dst,resource+f->position,amount);f->position+=amount;return (U16)(amount/size);}
static void gamTraceP(U16 id){(void)id;}
` + ['hd_spe_resource_available', 'hd_spe_resource_valid', 'hd_spe_resource_fingerprint', 'hd_skill_resource_shape']
    .map(name => actual('PublicFun.c', name)).join('\n') + String.raw`

#define SCR_W g_screenWidth
#define SCR_H g_screenHeight
#define BYTES_PERLINE (SCR_W*AX_SCALE)
#define MAX_SCR_BUF_LEN sizeof(g_VisScr)
#define gam_memset memset
static char *static_buffer,*backup_buffer,*buffer,*scr_buffer;
static size_t buffer_size;
static int isLcdDirty;
static void (*_lcd_fluch_cb)(char*);
static void*gam_malloc(size_t s){return malloc(s);}
static void gam_free(void*p){free(p);}
` + ['screen_buffer_realloc', 'convert_image', 'timed_flush_lcd', 'SysSaveScreen',
    'SysRestoreScreen', 'SysAdjustLCDBuffer', 'SysCopyScreen'].map(name => actual('platform/common/sys.c', name)).join('\n') + String.raw`
static int copies,flushes,lastFrame=-1,framesSeen[96],hookCalls,hookReturn=-1,hookPresent;
static U32 copiedEvent,copiedCommit;
static U8 copiedPixels[160*96],expected[160*96];
static int flushOnScroll=1,deferLastFlush,scenario,scrollKeys,holdKeys,holdMessages,holdTicks,holdStarted,ignored;
static U32 holdSession,holdInputSeq,holdSourceEvent,holdSourceCommit;
static U16 holdFrame;
static int timerOpened=50,scrolling=5;
static void oracle(U16 frame,U8*out){assert(frame<96);memset(out,0,160*96);
    const U8 *unit=initial+6+frame*5,*pic=initial+486+7;int y0=unit[1];
    for(int y=0;y<96;y++)for(int x=0;x<159;x++)if(y+y0<96)
        out[(y+y0)*160+x]=(pic[y*20+x/8]&(0x80>>(x%8)))?255:0;
}
static void GamPicShowV(PT x,PT y,PT w,PT h,U8*data,U8*screen){assert(x==0&&w==159&&h==96);
    for(int py=0;py<h;py++)for(int px=0;px<w;px++)if(y+py>=0&&y+py<96)
        screen[(y+py)*160+x+px]=(data[py*20+px/8]&(0x80>>(px%8)))?255:0;
}
static void GamMPicShowV(PT x,PT y,PT w,PT h,U8*data,U8*screen){(void)x;(void)y;(void)w;(void)h;(void)data;(void)screen;assert(0);}
static void gam_clrvscr(int x,int y,int ex,int ey,U8*screen){assert(x==0&&ex==158);
    for(int py=y;py<=ey;py++)if(py>=0&&py<96)memset(screen+py*160+x,0,(size_t)(ex-x+1));}
static void lcdCallback(char*data){(void)data;flushes++;assert(g_hdSpeDisplayFrameValid);
    assert(g_hdSpeDisplayEventId==copiedEvent&&g_hdSpeDisplayCommitSeq==copiedCommit);
    assert(!memcmp(scr_buffer,copiedPixels,sizeof(copiedPixels)));}
static void gam_copyscr(U8*screen){assert(g_hdSpeFrameValid&&g_hdSpeId==6);lastFrame=g_hdSpeFrameIndex;
    assert(lastFrame>=0&&lastFrame<96);framesSeen[lastFrame]++;oracle((U16)lastFrame,expected);
    assert(!memcmp(expected,screen,sizeof(expected)));for(int i=0;i<32;i++)
        assert(g_hdSpeVisibleFrames[i]==(i==lastFrame/8?(1u<<(lastFrame%8)):0));
    assert(g_hdSpeResourceFingerprint==EXPECTED_FINGERPRINT&&g_hdSpeResourceLength==sizeof(initial));
    SysCopyScreen(screen);memcpy(copiedPixels,screen,sizeof(copiedPixels));
    copiedEvent=g_hdSpeEventId;copiedCommit=g_hdSpeCommitSeq;copies++;}
` + actual('comOut.c', 'GamShowFrame') + String.raw`
typedef struct {U8 type;U16 param;} GMType;
#define VM_TIMER 1
#define VM_CHAR_FUN 2
#define VM_TOUCH 3
#define VM_CHAR_ASC 4
#define VT_TOUCH_UP 1
#define VT_TOUCH_DOWN 2
#define TIMER_DLY 1
#define GamMsgIsTimer0(message) ((message).type==VM_TIMER&&(message).param==0)
static int SysScrollingTimerOpen(int value){int old=scrolling;scrolling=value;return old;}
static U8 SysGetTimer1Number(void){return (U8)timerOpened;}
static void SysTimer1Close(void){timerOpened=0;}
static void SysTimer1Open(U16 interval){timerOpened=interval;}
static void snapshotHold(void){assert(!g_hdSpeActive&&!g_hdMovieActive);assert(g_hdMakerActive&&g_hdMakerPhase==BAYE_HD_MAKER_HOLD);
    assert(g_hdMakerReturnEligible&&g_hdMakerInputSeq==2);holdStarted=1;holdSession=g_hdMakerSession;holdInputSeq=g_hdMakerInputSeq;
    holdSourceEvent=g_hdMakerEventId;holdSourceCommit=g_hdMakerCommitSeq;holdFrame=g_hdMakerFrameIndex;
    if(!missing&&scenario!=7){assert(g_hdMakerCount==96&&g_hdMakerPicmax==1);assert(g_hdMakerStartFrm==0&&g_hdMakerEndFrm==95);
        assert(g_hdMakerResourceLength==sizeof(initial)&&g_hdMakerResourceFingerprint==EXPECTED_FINGERPRINT);
        assert(g_hdMakerSourceValid==!hookPresent);if(!hookPresent){assert(holdFrame==lastFrame&&holdSourceEvent==copiedEvent&&holdSourceCommit==copiedCommit);}}
    else assert(!g_hdMakerSourceValid);
    if(!missing&&scenario!=7&&deferLastFlush){assert(g_hdSpeDisplayCommitSeq<copiedCommit);assert(isLcdDirty);timed_flush_lcd();
        assert(g_hdSpeDisplayCommitSeq==g_hdMakerCommitSeq&&g_hdSpeDisplayEventId==g_hdMakerEventId);}
}
static void GamGetMsg(GMType*msg){msg->type=VM_TIMER;msg->param=1;
    if(g_hdMakerPhase==BAYE_HD_MAKER_HOLD){if(!holdStarted)snapshotHold();holdMessages++;
        if(scenario==3&&!holdKeys){msg->type=VM_CHAR_FUN;msg->param=39;holdKeys++;return;}
        if(scenario==4&&!holdKeys){msg->type=VM_TOUCH;msg->param=VT_TOUCH_UP;holdKeys++;return;}
        if(scenario==5){if(holdMessages==1){msg->type=VM_CHAR_ASC;msg->param='A';ignored++;return;}
            if(holdMessages==2){msg->type=VM_TOUCH;msg->param=VT_TOUCH_DOWN;ignored++;return;}
            if(holdMessages==3){msg->type=VM_TIMER;msg->param=0;ignored++;return;}
            msg->type=VM_CHAR_FUN;msg->param=40;holdKeys++;return;}
        holdTicks++;return;
    }
    if(flushOnScroll&&isLcdDirty&&!(deferLastFlush&&lastFrame==95))timed_flush_lcd();
    if(scenario==2&&!scrollKeys&&lastFrame>=8){msg->type=VM_CHAR_FUN;msg->param=39;scrollKeys++;}
}
static int call_hook_a_observed(const char*name,void*context,U8*present){assert(!strcmp(name,"showAbout")&&context==NULL);hookCalls++;*present=(U8)hookPresent;return hookReturn;}
static void baye_hd_set_movie(U16 id,U8 active){g_hdMovieId=id;g_hdMovieActive=active;}
` + actual('comIn.c', 'GamDelay') + '\n' + actual('PublicFun.c', 'PlcMovie') + '\n' +
    actual('gamEng.c', 'GamMovie') + '\n' + actual('gamEng.c', 'GamMakerInf') + String.raw`
static void prepare(void){assert(sizeof(SPERES)==6&&sizeof(SPEUNIT)==5&&sizeof(PictureHeadType)==7);
    baye_hd_spe_invalidate();memcpy(resource,initial,sizeof(initial));romFile.length=declaredLength=sizeof(initial);romFile.position=sizeof(initial);
    missing=0;scenario=0;hookCalls=0;hookReturn=-1;hookPresent=0;copies=flushes=scrollKeys=holdKeys=holdMessages=holdTicks=holdStarted=ignored=0;
    lastFrame=-1;memset(framesSeen,0,sizeof(framesSeen));memset(g_VisScr,0,sizeof(g_VisScr));memset(copiedPixels,0,sizeof(copiedPixels));
    flushOnScroll=1;deferLastFlush=0;g_FlipDrawing=0;g_paintColor=255;g_screenWidth=160;g_screenHeight=96;timerOpened=50;scrolling=5;
    screen_buffer_realloc(sizeof(g_VisScr));memset(scr_buffer,0,sizeof(g_VisScr));_lcd_fluch_cb=lcdCallback;isLcdDirty=0;
    g_paintPalette[0]=0x00ffffffu;g_paintPalette[255]=0xff000000u;}
static void retired(void){assert(!g_hdMakerActive&&!g_hdMakerPhase&&!g_hdMakerReturnEligible&&!g_hdMakerSourceValid&&!g_hdMakerInputSeq);
    assert(!g_hdSpeActive&&!g_hdMovieActive);assert(timerOpened==50&&scrolling==5);assert(hookCalls==1);}
static void full(void){prepare();GamMakerInf();retired();assert(copies==96&&lastFrame==95&&holdFrame==95);
    for(int i=0;i<96;i++)assert(framesSeen[i]==1);assert(holdTicks==5000&&holdKeys==0&&scrollKeys==0);
    assert(flushes==96&&holdMessages==5000);assert(g_hdMakerEndReason==BAYE_HD_SPE_END_COMPLETE&&g_hdMakerEndKey==255);}
static void pending(void){prepare();deferLastFlush=1;GamMakerInf();retired();assert(copies==96&&flushes==96&&holdTicks==5000&&holdFrame==95);}
static void scrollSkip(void){prepare();scenario=2;GamMakerInf();retired();assert(scrollKeys==1&&holdKeys==0&&holdTicks==5000);
    assert(holdFrame==8&&lastFrame==8&&copies==9);assert(g_hdMakerEndReason==BAYE_HD_SPE_END_KEY&&g_hdMakerEndKey==39);}
static void holdKey(int which){prepare();scenario=which;GamMakerInf();retired();assert(copies==96&&holdFrame==95&&holdKeys==1&&holdTicks==0);
    assert(holdMessages==(which==5?4:1)&&ignored==(which==5?3:0));assert(g_hdMakerEndReason==BAYE_HD_SPE_END_COMPLETE&&g_hdMakerEndKey==255);}
static void custom(void){prepare();hookPresent=1;hookReturn=0;GamMakerInf();retired();assert(copies==0&&holdMessages==0);
    prepare();hookPresent=1;GamMakerInf();retired();assert(copies==96&&holdTicks==5000&&holdSourceCommit==0);}
static void badResource(int invalid){prepare();if(invalid){scenario=7;resource[2]=0;}else missing=1;
    GamMakerInf();retired();assert(copies==0&&flushes==0&&holdTicks==5000&&g_hdMakerCommitSeq==0);
    assert(g_hdMakerEndReason==(invalid?BAYE_HD_SPE_END_INVALID:BAYE_HD_SPE_END_MISSING));}
static void manualFrame(HdSpeScope*s,U16 frame,int copy){U8 remaining[96]={0};remaining[frame]=9;
    baye_hd_spe_frame(s,frame,remaining,(U16)(frame+1));oracle(frame,g_VisScr);if(copy){SysCopyScreen(g_VisScr);memcpy(copiedPixels,g_VisScr,sizeof(copiedPixels));
        copiedEvent=s->eventId;copiedCommit=s->commitSeq;lastFrame=frame;}}
static void ready(HdSpeScope*s,U16 id,U16 index,U8 flag){baye_hd_spe_enter(s,id,index,0,0,0,95,flag);baye_hd_spe_ready(s,96,1,EXPECTED_FINGERPRINT,sizeof(initial),95,1);}
static void copiedNotLogical(void){prepare();U32 owner=baye_hd_maker_begin(0);HdSpeScope s;ready(&s,6,0,1);
    manualFrame(&s,0,1);manualFrame(&s,1,0);assert(s.commitSeq==2&&hdSpeCopied.commitSeq==1);
    baye_hd_spe_end(&s,1,255);assert(!g_hdSpeActive&&g_hdMakerSourceValid&&g_hdMakerFrameIndex==0&&g_hdMakerCommitSeq==1);
    baye_hd_maker_hold(owner);assert(!g_hdSpeDisplayFrameValid);timed_flush_lcd();
    assert(g_hdSpeDisplayFrameIndex==0&&g_hdSpeDisplayCommitSeq==g_hdMakerCommitSeq);baye_hd_maker_end(owner);}
static void interference(int which){prepare();U32 owner=baye_hd_maker_begin(0);HdSpeScope s;ready(&s,6,0,1);manualFrame(&s,95,1);
    baye_hd_spe_end(&s,1,255);baye_hd_maker_hold(owner);assert(g_hdMakerSourceValid);
    if(which==0)baye_hd_spe_lcd_dirty();else if(which==1){SysSaveScreen();SysRestoreScreen();}
    else if(which==2)SysAdjustLCDBuffer(160,96);else SysCopyScreen(g_VisScr);
    assert(!g_hdMakerSourceValid&&!hdSpeCopied.frameValid);baye_hd_maker_hold(owner);assert(!g_hdMakerSourceValid);baye_hd_maker_end(owner);}
static void stale(void){prepare();U32 old=baye_hd_maker_begin(0);HdSpeScope s;ready(&s,6,0,1);manualFrame(&s,8,1);
    baye_hd_spe_end(&s,2,39);baye_hd_maker_hold(old);U32 oldGeneration=g_hdMakerGeneration;
    baye_hd_spe_invalidate();assert(!g_hdMakerActive&&g_hdSpeGeneration!=oldGeneration);
    U32 fresh=baye_hd_maker_begin(0);assert(fresh!=old);baye_hd_maker_hold(old);baye_hd_maker_end(old);
    assert(g_hdMakerActive&&g_hdMakerSession==fresh&&g_hdMakerPhase==BAYE_HD_MAKER_SCROLL&&g_hdMakerInputSeq==1);
    ready(&s,6,0,1);manualFrame(&s,95,1);baye_hd_spe_end(&s,1,255);baye_hd_maker_hold(fresh);assert(g_hdMakerInputSeq==2);
    baye_hd_maker_end(old);assert(g_hdMakerActive&&g_hdMakerSourceValid);baye_hd_maker_end(fresh);}
static void unrelated(void){prepare();U32 owner=baye_hd_maker_begin(0);HdSpeScope s,parent;
    ready(&s,3,0,1);baye_hd_spe_end(&s,1,255);assert(!g_hdMakerEventId);
    ready(&s,6,1,1);baye_hd_spe_end(&s,1,255);assert(!g_hdMakerEventId);
    ready(&s,6,0,0);baye_hd_spe_end(&s,1,255);assert(!g_hdMakerEventId);
    ready(&parent,3,0,1);ready(&s,6,0,1);baye_hd_spe_end(&s,1,255);assert(!g_hdMakerEventId);baye_hd_spe_end(&parent,1,255);
    ready(&s,6,0,1);manualFrame(&s,95,1);baye_hd_spe_end(&s,1,255);assert(g_hdMakerSourceValid&&g_hdMakerEventId==s.eventId);
    baye_hd_maker_hold(owner);baye_hd_maker_end(owner);}
static void unsupported(void){prepare();U32 owner=baye_hd_maker_begin(0);HdSpeScope s;ready(&s,6,0,1);manualFrame(&s,95,1);
    g_FlipDrawing=1;manualFrame(&s,95,1);baye_hd_spe_end(&s,1,255);baye_hd_maker_hold(owner);assert(!g_hdMakerSourceValid);baye_hd_maker_end(owner);}
int main(int argc,char**argv){assert(argc==2);switch(atoi(argv[1])){
    case 1:full();break;case 2:pending();break;case 3:scrollSkip();break;
    case 4:holdKey(3);break;case 5:holdKey(4);break;case 6:holdKey(5);break;case 7:custom();break;
    case 8:badResource(0);break;case 9:badResource(1);break;case 10:copiedNotLogical();break;
    case 11:interference(0);break;case 12:interference(1);break;case 13:interference(2);break;case 14:interference(3);break;
    case 15:stale();break;case 16:unrelated();break;case 17:unsupported();break;default:assert(0);}
    puts("actual MAKER engine fixture passed");return 0;}
`;

let temporary, compiled;
async function executable() {
    if (!compiled) compiled = (async () => {
        temporary = mkdtempSync(join(tmpdir(), 'baye-hd-maker-'));
        const filename = join(temporary, 'maker.c'), binary = join(temporary, process.platform === 'win32' ? 'maker.exe' : 'maker');
        writeFileSync(filename, '#define EXPECTED_FINGERPRINT ' + fingerprint + 'u\n' + fixture.replace('ROM_BYTES', [...rom].join(',')));
        await run(process.env.CC || 'cc', ['-std=c99', '-fpack-struct=1', '-Wall', '-Wextra', filename, '-o', binary], { timeout: 30000 });
        return binary;
    })();
    return compiled;
}
after(() => {
    if (!temporary) return;
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith('baye-hd-maker-'));
    rmSync(temporary, { recursive: true, force: true });
});
for (const [index, name] of [
    [1, 'actual MAKER full96 units scroll into native5000 timer hold and retire without extra screen copies'],
    [2, 'final native LCD copy pending at SPE end becomes displayed during the real hold'],
    [3, 'one actual rolling skip preserves the partial frame throughout the separate native hold'],
    [4, 'native hold consumes one function key and returns with SPE inactive'],
    [5, 'native hold consumes one touch-up and restores original timers'],
    [6, 'native hold ignores character/touch-down/timer0 and consumes only the later function key'],
    [7, 'showAbout handled and present-but-default branches use one actual hook call and neutral custom pixels'],
    [8, 'missing actual resource preserves the original hold without authorizing a saved maker image'],
    [9, 'invalid actual resource preserves the original hold without a fabricated final commit'],
    [10, 'held source snapshots the actual copied commit rather than a later logical un-copied frame'],
    [11, 'foreign LCD dirty permanently retires the held source'],
    [12, 'actual LCD restore retires the held source'],
    [13, 'actual native buffer resize retires the held source'],
    [14, 'an unrelated LCD copy cannot reuse the held source owner'],
    [15, 'reset/reopen and late old session hold/end never retire a new native owner'],
    [16, 'unrelated resource, index, flag and nested SPE calls cannot become the maker child'],
    [17, 'unsupported native flip remains LCD throughout the hold']
]) test(name, async () => {
    const result = await run(await executable(), [String(index)], { timeout: 20000 });
    assert.match(result.stdout, /actual MAKER engine fixture passed/);
});
