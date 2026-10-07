#include "baye/stdsys.h"
#include "baye/comm.h"
#include "baye/enghead.h"
#include "hd-bridge.h"
#include "baye/bind-objects.h"
#include <string.h>
#include <emscripten.h>

U8 g_hdEngineReady = 0;
U16 g_hdKingCount = 0;
U16 g_hdKingIndex = 0;
U16 g_hdKingId = 0xffff;
U16 g_hdKingIds[BAYE_HD_KING_MAX];
U8 g_hdKingNames[BAYE_HD_KING_MAX * BAYE_HD_NAME_SLOT];

U8 g_hdReportGbk[BAYE_HD_REPORT_MAX];
U16 g_hdReportPerson = 0xffff;
U16 g_hdReportKind = 0;
U16 g_hdReportSeq = 0;
U8 g_hdReportActive = 0;
U32 g_hdReportInputSeq = 0;
typedef struct {
    U8 text[BAYE_HD_REPORT_MAX];
    U16 person;
    U16 kind;
} HdReportWait;
/* Reports can nest through Mod callbacks. Restore the outer report with a new
 * input token so an inner button can never confirm the outer wait. */
static HdReportWait hdReportWaits[16];
static U32 hdReportDepth = 0;
static U32 hd_next_input_seq(U32 seq);

U8 g_hdRecordActive = 0;
U8 g_hdRecordMode = 0;
U8 g_hdRecordIndex = 0;
U8 g_hdRecordCount = 0;
U32 g_hdRecordSeq = 0;

U8 g_hdMenuGbk[BAYE_HD_MENU_MAX];
U16 g_hdMenuItemLen = 0;
U16 g_hdMenuCount = 0;
U16 g_hdMenuIndex = 0;
U8 g_hdMenuActive = 0;
U8 g_hdMenuContext = BAYE_HD_MENU_CONTEXT_NONE;
U8 g_hdMenuKind = 0;
U32 g_hdMenuSeq = 0;
static U8 hdMenuNextContext = BAYE_HD_MENU_CONTEXT_NONE;
static U8 hdMenuNextKind = 0;

U8 g_hdFightActive = 0;
U8 g_hdFightOver = 0;
U8 g_hdFightWait = 0;
U8 g_hdFightPhase = 0;
U8 g_hdFightAimType = 0xff;
U8 g_hdFightActCommit = 0xFF;
U8 g_hdFightAllowRetreat = 0;
/* Set only by the HD system-menu hook; native and Mod menus leave this zero. */
U8 g_hdFightMenuControl = 0;
U8 g_hdFightInputKind = BAYE_HD_FIGHT_INPUT_BUSY;
U32 g_hdFightInputSeq = 0;
U8 g_hdFightActor = 0xff;
static U8 hdFightSelectedActor = 0xff;
U8 g_hdFightResultGbk[BAYE_HD_FIGHT_RESULT_MAX];
U8 g_hdFightTipGbk[BAYE_HD_FIGHT_TIP_MAX];

U32 g_hdQtyValue = 0;
U32 g_hdQtyMin = 0;
U32 g_hdQtyMax = 0;
U8 g_hdQtyActive = 0;
U32 g_hdQtySession = 0;
U32 g_hdQtyInputSeq = 0;
U16 g_hdQtyLastKey = BAYE_HD_QTY_NO_KEY;
U8 g_hdQtyCursor = 0;
U32 g_hdQtyStep = 1;
U8 g_hdQtyReady = 0;

U8 g_hdMapPick = 0;
U32 g_hdMapInputSeq = 0;
U8 g_hdBattlePick = 0;
U8 g_hdMapCity = 0;
U8 g_hdCityLinks[8];
U8 g_hdMarchOk = 0;
U8 g_hdMarchCity = 0;
U8 g_hdMarchObj = 0;
U8 g_hdMarchTime = 0;
U16 g_hdMarchSeq = 0;
U16 g_hdMarchSession = 0;
U8 g_hdMarchPhase = BAYE_HD_MARCH_IDLE;
U8 g_hdMarchOrigin = 0xff;
U8 g_hdMarchSelected = 0;
U32 g_hdMarchInputSeq = 0;
U8 g_hdFightSkip = 0;

U8 g_hdHelpGbk[BAYE_HD_HELP_MAX];
U16 g_hdHelpSeq = 0;
U8 g_hdHelpActive = 0;
U8 g_hdMovieActive = 0;
U16 g_hdMovieId = 0;

U8 g_hdSpePendingKind = 0;
U8 g_hdSpeActive = 0;
U16 g_hdSpeId = 0;
U8 g_hdSpeKind = 0;
U8 g_hdSpeX = 0;
U8 g_hdSpeY = 0;
U8 g_hdSpeStartFrm = 0;
U8 g_hdSpeEndFrm = 0;
U16 g_hdSpeSeq = 0;
U8 g_hdSpeProtocolVersion = BAYE_HD_SPE_VERSION;
U32 g_hdSpeGeneration = 1;
U32 g_hdSpeEventId = 0;
U32 g_hdSpeParentEventId = 0;
U32 g_hdSpeCommitSeq = 0;
U32 g_hdSpeResourceFingerprint = 0;
U32 g_hdSpeResourceLength = 0;
U16 g_hdSpeDepth = 0;
U16 g_hdSpeResourceIndex = 0;
U16 g_hdSpeCount = 0;
U16 g_hdSpePicmax = 0;
U16 g_hdSpeFrameIndex = BAYE_HD_SPE_NO_FRAME;
I16 g_hdSpeOriginX = 0, g_hdSpeOriginY = 0;
U8 g_hdSpeFrameValid = 0, g_hdSpeProtocolValid = 0;
U8 g_hdSpeKeyflag = 0, g_hdSpeSkipEligible = 0;
U8 g_hdSpeContextKnown = 0;
U16 g_hdSpeSkillId = 0;
U8 g_hdSpeActorIndex = 0xff, g_hdSpeTargetIndex = 0xff;
U8 g_hdSpeVisibleFrames[BAYE_HD_SPE_FRAME_BYTES];
U32 g_hdSpeLastEndedId = 0;
U8 g_hdSpeEndReason = 0, g_hdSpeEndKey = 0xff;
U32 g_hdSpeDisplayGeneration = 0, g_hdSpeDisplayEventId = 0, g_hdSpeDisplayCommitSeq = 0;
U16 g_hdSpeDisplayFrameIndex = BAYE_HD_SPE_NO_FRAME;
U8 g_hdSpeDisplayFrameValid = 0;
U8 g_hdSpeDisplayVisibleFrames[BAYE_HD_SPE_FRAME_BYTES];

typedef struct {
    U32 generation, eventId, commitSeq;
    U16 frameIndex;
    U8 frameValid, visibleFrames[BAYE_HD_SPE_FRAME_BYTES];
} HdSpeDisplay;
static HdSpeScope* hdSpeCurrent = NULL;
static HdSpeScope* hdSpeCopyPending = NULL;
static U32 hdSpeNextEventId = 0;
static U16 hdSpePendingSkillId = 0;
static U8 hdSpePendingContext = 0, hdSpePendingActor = 0xff, hdSpePendingTarget = 0xff;
static HdSpeDisplay hdSpeCopied;

U8 g_hdSkillActive = 0;
U8 g_hdSkillCount = 0;
U8 g_hdSkillNameLen = 0;
U16 g_hdSkillIds[BAYE_HD_SKILL_MAX];
U8 g_hdSkillNames[BAYE_HD_SKILL_MAX * BAYE_HD_SKILL_NAME];

static void copy_gbk(U8* dst, U32 dstMax, const U8* src)
{
    U32 n = 0;
    if (!src) {
        dst[0] = 0;
        return;
    }
    n = (U32)gam_strlen((const U8*)src);
    if (n >= dstMax) {
        n = dstMax - 1;
    }
    if (n) {
        memcpy(dst, src, n);
    }
    dst[n] = 0;
}

void baye_hd_set_ready(U8 ready)
{
    /* A new LIB/game may share this browser. Invalidate old input tokens. */
    baye_hd_spe_invalidate();
    baye_hd_set_fight(0, 0);
    baye_hd_march_end(0);
    g_hdMarchOk = 0;
    g_hdMarchCity = g_hdMarchObj = g_hdMarchTime = 0;
    g_hdFightSkip = BAYE_HD_FIGHT_SKIP_NONE;
    g_hdMapPick = g_hdBattlePick = g_hdMapCity = 0;
    baye_hd_qty_invalidate();
    g_hdSkillActive = g_hdHelpActive = 0;
    g_hdHelpGbk[0] = 0;
    g_hdReportGbk[0] = 0;
    g_hdReportKind = BAYE_HD_REPORT_NONE;
    g_hdReportPerson = 0xffff;
    hdReportDepth = 0;
    baye_hd_report_end();
    baye_hd_record_end();
    g_hdEngineReady = ready;
}

void baye_hd_world_commit(void)
{
    /* Called only after a new game or loaded snapshot really commits. This
     * invalidates HD observations/input owners without changing game data. */
    baye_hd_set_ready(g_hdEngineReady);
}

void baye_hd_set_report(const U8* gbk, U16 person, U8 kind)
{
    copy_gbk(g_hdReportGbk, BAYE_HD_REPORT_MAX, gbk);
    g_hdReportPerson = person;
    g_hdReportKind = kind;
    g_hdReportSeq = (U16)(g_hdReportSeq + 1);
    if (g_hdReportSeq == 0) {
        g_hdReportSeq = 1;
    }
    /* 在 GamDelay 堵住主线程之前把正文推给 HD 壳。 */
    EM_ASM({
        try {
            if (window.BayeHdDialog && typeof BayeHdDialog.onEngineReport === 'function') {
                BayeHdDialog.onEngineReport();
            }
        } catch (e) {}
    });
}

void baye_hd_set_kings(const PersonID* kings, U32 count)
{
    U32 i;
    U8 name[16];
    if (count > BAYE_HD_KING_MAX) {
        count = BAYE_HD_KING_MAX;
    }
    g_hdKingCount = (U16)count;
    memset(g_hdKingIds, 0, sizeof(g_hdKingIds));
    memset(g_hdKingNames, 0, sizeof(g_hdKingNames));
    for (i = 0; i < count; i++) {
        U32 slot = i * BAYE_HD_NAME_SLOT;
        U32 n;
        g_hdKingIds[i] = kings[i];
        memset(name, 0, sizeof(name));
        GetPersonName(kings[i], name);
        n = (U32)gam_strlen(name);
        if (n > BAYE_HD_NAME_SLOT - 1) {
            n = BAYE_HD_NAME_SLOT - 1;
        }
        memcpy(g_hdKingNames + slot, name, n);
    }
}

void baye_hd_set_king_highlight(U32 index, PersonID id)
{
    g_hdKingIndex = (U16)index;
    g_hdKingId = id;
}

void baye_hd_set_menu(const U8* buf, U16 itemLen, U16 itemCount, U16 index)
{
    U32 count = itemCount;
    /* Person/goods names are fixed-width slots containing NUL padding. A
     * string copy stops after the first name and exposes older menu bytes. */
    memset(g_hdMenuGbk, 0, sizeof(g_hdMenuGbk));
    if (!itemLen) {
        /* Picture menus have real counts/indexes but no text slots. */
        count = buf ? 0 : itemCount;
    } else if (!buf) {
        count = 0;
    } else {
        U32 maxCount = (BAYE_HD_MENU_MAX - 1) / itemLen;
        if (count > maxCount) {
            count = maxCount;
        }
        if (count) {
            memcpy(g_hdMenuGbk, buf, count * itemLen);
        }
    }
    g_hdMenuItemLen = itemLen;
    g_hdMenuCount = (U16)count;
    g_hdMenuIndex = index;
}

void baye_hd_set_menu_index(U16 index)
{
    g_hdMenuIndex = index;
}

/* These tokens describe actual blocking input calls. Redraws only update the
 * existing bytes/index and never open another input or advance its sequence. */
static U32 hd_next_input_seq(U32 seq)
{
    seq += 1;
    return seq ? seq : 1;
}

void baye_hd_report_begin(U8 kind)
{
    if (hdReportDepth < sizeof(hdReportWaits) / sizeof(hdReportWaits[0])) {
        HdReportWait* wait = &hdReportWaits[hdReportDepth];
        memcpy(wait->text, g_hdReportGbk, sizeof(wait->text));
        wait->person = g_hdReportPerson;
        wait->kind = kind;
    }
    ++hdReportDepth;
    g_hdReportKind = kind;
    g_hdReportActive = 1;
    g_hdReportInputSeq = hd_next_input_seq(g_hdReportInputSeq);
    EM_ASM({
        try { if (window.BayeHdDialog) BayeHdDialog.onEngineReport(); } catch (e) {}
    });
}

void baye_hd_report_end(void)
{
    if (hdReportDepth) --hdReportDepth;
    g_hdReportActive = hdReportDepth ? 1 : 0;
    g_hdReportInputSeq = hd_next_input_seq(g_hdReportInputSeq);
    if (hdReportDepth && hdReportDepth <= sizeof(hdReportWaits) / sizeof(hdReportWaits[0])) {
        HdReportWait* wait = &hdReportWaits[hdReportDepth - 1];
        baye_hd_set_report(wait->text, wait->person, (U8)wait->kind);
    }
}

void baye_hd_record_begin(U8 mode, U8 index, U8 count)
{
    g_hdRecordActive = 1;
    g_hdRecordMode = mode;
    g_hdRecordIndex = index;
    g_hdRecordCount = count;
    g_hdRecordSeq = hd_next_input_seq(g_hdRecordSeq);
}

void baye_hd_record_index(U8 index)
{
    g_hdRecordIndex = index;
}

void baye_hd_record_end(void)
{
    g_hdRecordActive = 0;
    g_hdRecordMode = 0;
    g_hdRecordCount = 0;
    g_hdRecordSeq = hd_next_input_seq(g_hdRecordSeq);
}

void baye_hd_fight_actor(U8 actor)
{
    hdFightSelectedActor = actor;
}

void baye_hd_fight_input_begin(U8 kind)
{
    if (kind == BAYE_HD_FIGHT_INPUT_PICK) {
        hdFightSelectedActor = 0xff;
    }
    g_hdFightInputKind = kind;
    g_hdFightActor = kind == BAYE_HD_FIGHT_INPUT_BUSY || kind == BAYE_HD_FIGHT_INPUT_PICK
        ? 0xff : hdFightSelectedActor;
    g_hdFightInputSeq = hd_next_input_seq(g_hdFightInputSeq);
}

void baye_hd_fight_input_end(void)
{
    /* The legacy action mailbox has no scene token. Close it together with the
     * real input so a late action cannot become a system-menu selection. */
    g_hdFightActCommit = 0xff;
    g_hdFightInputKind = BAYE_HD_FIGHT_INPUT_BUSY;
    g_hdFightActor = 0xff;
    g_hdFightInputSeq = hd_next_input_seq(g_hdFightInputSeq);
}

U8 baye_hd_take_fight_action(U16* choice)
{
    if (!g_hdFightActive || !g_hdMenuActive ||
        g_hdMenuContext != BAYE_HD_MENU_CONTEXT_FIGHT ||
        g_hdMenuKind != BAYE_HD_FIGHT_INPUT_ACTION || g_hdFightActCommit == 0xff) {
        return 0;
    }
    *choice = g_hdFightActCommit;
    g_hdFightActCommit = 0xff;
    return 1;
}

void baye_hd_map_input_begin(void)
{
    g_hdMapInputSeq = hd_next_input_seq(g_hdMapInputSeq);
}

void baye_hd_menu_scope(U8 context, U8 kind)
{
    hdMenuNextContext = context;
    hdMenuNextKind = kind;
}

void baye_hd_menu_scope_default(U8 context, U8 kind)
{
    if (hdMenuNextContext == BAYE_HD_MENU_CONTEXT_NONE) {
        baye_hd_menu_scope(context, kind);
    }
}

void baye_hd_menu_begin(void)
{
    g_hdMenuActive = 1;
    g_hdMenuContext = hdMenuNextContext;
    g_hdMenuKind = hdMenuNextKind;
    hdMenuNextContext = BAYE_HD_MENU_CONTEXT_NONE;
    hdMenuNextKind = 0;
    g_hdMenuSeq = hd_next_input_seq(g_hdMenuSeq);
    if (g_hdMenuContext == BAYE_HD_MENU_CONTEXT_FIGHT) {
        baye_hd_fight_input_begin(g_hdMenuKind);
    }
}

void baye_hd_menu_end(void)
{
    if (g_hdMenuContext == BAYE_HD_MENU_CONTEXT_FIGHT) {
        baye_hd_fight_input_end();
    }
    g_hdMenuActive = 0;
    g_hdMenuContext = BAYE_HD_MENU_CONTEXT_NONE;
    g_hdMenuKind = 0;
    hdMenuNextContext = BAYE_HD_MENU_CONTEXT_NONE;
    hdMenuNextKind = 0;
    g_hdMenuSeq = hd_next_input_seq(g_hdMenuSeq);
}

void baye_hd_march_phase(U8 phase)
{
    g_hdMarchPhase = phase;
    g_hdMarchInputSeq = hd_next_input_seq(g_hdMarchInputSeq);
}

void baye_hd_march_begin(U8 city)
{
    g_hdMarchSession = (U16)(g_hdMarchSession + 1);
    if (!g_hdMarchSession) g_hdMarchSession = 1;
    g_hdMarchOrigin = city;
    g_hdMarchSelected = 0;
    g_hdMarchOk = 0;
    baye_hd_march_phase(BAYE_HD_MARCH_IDLE);
}

void baye_hd_march_selected(U8 count)
{
    g_hdMarchSelected = count;
}

void baye_hd_march_end(U8 departed)
{
    if (!departed) {
        g_hdMarchOrigin = 0xff;
        g_hdMarchSelected = 0;
    }
    baye_hd_march_phase(departed ? BAYE_HD_MARCH_DEPARTED : BAYE_HD_MARCH_IDLE);
}

void baye_hd_set_fight(U8 active, U8 over)
{
    U8 str[40];
    baye_hd_menu_end();
    baye_hd_fight_actor(0xff);
    baye_hd_fight_input_end();
    if (active) {
        /* New GamFight: never keep leftover 全军覆没 / 大获全胜 / wait. */
        over = 0;
        g_hdFightWait = 0;
        g_hdFightPhase = 0;
        g_hdFightAimType = 0xff;
        g_hdFightResultGbk[0] = 0;
        g_hdFightTipGbk[0] = 0;
        g_hdFightActCommit = 0xFF;
        g_hdFightAllowRetreat = 0;
        g_hdFightMenuControl = 0;
    } else if (over == 0) {
        /* Explicit reset at GamFight entry / 策略结束 prepare. */
        g_hdFightWait = 0;
        g_hdFightPhase = 0;
        g_hdFightAimType = 0xff;
        g_hdFightResultGbk[0] = 0;
        g_hdFightTipGbk[0] = 0;
        g_hdFightActCommit = 0xFF;
        g_hdFightAllowRetreat = 0;
        g_hdFightMenuControl = 0;
    }
    g_hdFightActive = active;
    g_hdFightOver = over;
    str[0] = 0;
    if (!active && over == 1) {
        ResLoadToMem(STRING_CONST, STR_GAMEWON, str);
    } else if (!active && over == 2) {
        ResLoadToMem(STRING_CONST, STR_GAMELOST, str);
    }
    if (!active && over) {
        copy_gbk(g_hdFightResultGbk, BAYE_HD_FIGHT_RESULT_MAX, str);
    }
    EM_ASM({
        try {
            if (window.BayeHdBattle && typeof BayeHdBattle.onEngineFight === 'function') {
                BayeHdBattle.onEngineFight();
            }
        } catch (e) {}
    });
}

void baye_hd_set_fight_wait(U8 wait)
{
    g_hdFightWait = wait;
    if (!wait) {
        g_hdFightPhase = 0;
    }
}

void baye_hd_set_fight_phase(U8 phase)
{
    g_hdFightPhase = phase;
    if (phase != BAYE_HD_FIGHT_PHASE_AIM) {
        g_hdFightAimType = 0xff;
    }
    if (phase) {
        g_hdFightTipGbk[0] = 0;
    }
}

void baye_hd_set_fight_aim(U8 type)
{
    g_hdFightAimType = type;
}

void baye_hd_set_fight_tip(const U8* gbk)
{
    copy_gbk(g_hdFightTipGbk, BAYE_HD_FIGHT_TIP_MAX, gbk);
}

void baye_hd_clear_fight_tip(void)
{
    g_hdFightTipGbk[0] = 0;
}

void baye_hd_set_help(const U8* gbk)
{
    copy_gbk(g_hdHelpGbk, BAYE_HD_HELP_MAX, gbk);
    g_hdHelpActive = (U8)(g_hdHelpGbk[0] ? 1 : 0);
    g_hdHelpSeq = (U16)(g_hdHelpSeq + 1);
    if (g_hdHelpSeq == 0) {
        g_hdHelpSeq = 1;
    }
    EM_ASM({
        try {
            if (window.BayeHdDialog && typeof BayeHdDialog.onEngineHelp === 'function') {
                BayeHdDialog.onEngineHelp();
            }
        } catch (e) {}
    });
}

void baye_hd_set_skills(const U16* ids, const U8* names, U8 count, U8 nameLen, U8 active)
{
    U8 i;
    memset(g_hdSkillIds, 0, sizeof(g_hdSkillIds));
    memset(g_hdSkillNames, 0, sizeof(g_hdSkillNames));
    g_hdSkillActive = active;
    g_hdSkillCount = 0;
    g_hdSkillNameLen = nameLen;
    if (!active || !ids || !count) {
        return;
    }
    if (count > BAYE_HD_SKILL_MAX) {
        count = BAYE_HD_SKILL_MAX;
    }
    if (!nameLen) {
        nameLen = 4;
    }
    g_hdSkillCount = count;
    g_hdSkillNameLen = nameLen;
    for (i = 0; i < count; i++) {
        U8 tmp[16];
        g_hdSkillIds[i] = ids[i];
        memset(tmp, 0, sizeof(tmp));
        if (ids[i]) {
            ResLoadToMem(SKL_NAMID, ids[i], tmp);
        }
        if (!tmp[0] && names && nameLen) {
            U8 n = nameLen;
            if (n >= sizeof(tmp)) {
                n = sizeof(tmp) - 1;
            }
            memcpy(tmp, names + (U32)i * nameLen, n);
        }
        memcpy(g_hdSkillNames + i * BAYE_HD_SKILL_NAME, tmp, BAYE_HD_SKILL_NAME);
    }
}

void baye_hd_set_movie(U16 speId, U8 active)
{
    g_hdMovieActive = active;
    g_hdMovieId = active ? speId : 0;
    EM_ASM({
        try {
            if (window.BayeHdSpe && typeof BayeHdSpe.onEngineSpe === 'function') {
                BayeHdSpe.onEngineSpe();
            }
            if (window.BayeHdDialog && typeof BayeHdDialog.onEngineMovie === 'function') {
                BayeHdDialog.onEngineMovie();
            }
        } catch (e) {}
    });
}

void baye_hd_begin_spe(U8 kind)
{
    g_hdSpePendingKind = kind;
    hdSpePendingContext = 0;
    hdSpePendingSkillId = 0;
    hdSpePendingActor = hdSpePendingTarget = 0xff;
}

void baye_hd_set_spe(U16 speId, U8 kind, U8 x, U8 y, U8 startfrm, U8 endfrm, U8 active)
{
    g_hdSpeActive = active;
    g_hdSpeId = active ? speId : 0;
    g_hdSpeKind = active ? kind : 0;
    g_hdSpeX = active ? x : 0;
    g_hdSpeY = active ? y : 0;
    g_hdSpeStartFrm = active ? startfrm : 0;
    g_hdSpeEndFrm = active ? endfrm : 0;
    if (active) {
        g_hdSpeSeq = (U16)(g_hdSpeSeq + 1);
        if (g_hdSpeSeq == 0) {
            g_hdSpeSeq = 1;
        }
    }
    EM_ASM({
        try {
            if (window.BayeHdSpe && typeof BayeHdSpe.onEngineSpe === 'function') {
                BayeHdSpe.onEngineSpe();
            }
        } catch (e) {}
    });
}

void baye_hd_spe_tick(void)
{
    if (!g_hdSpeActive) {
        return;
    }
    g_hdSpeSeq = (U16)(g_hdSpeSeq + 1);
    if (g_hdSpeSeq == 0) {
        g_hdSpeSeq = 1;
    }
}

static void hd_spe_notify(void)
{
    EM_ASM({
        try {
            if (window.BayeHdSpe && typeof BayeHdSpe.onEngineSpe === 'function') {
                BayeHdSpe.onEngineSpe();
            }
        } catch (e) {}
    });
}

static void hd_spe_publish(const HdSpeScope* scope)
{
    g_hdSpeActive = scope ? 1 : 0;
    g_hdSpeId = scope ? scope->id : 0;
    g_hdSpeKind = scope ? scope->kind : 0;
    g_hdSpeX = scope ? (U8)scope->x : 0;
    g_hdSpeY = scope ? (U8)scope->y : 0;
    g_hdSpeOriginX = scope ? scope->x : 0;
    g_hdSpeOriginY = scope ? scope->y : 0;
    g_hdSpeStartFrm = scope ? scope->startFrm : 0;
    g_hdSpeEndFrm = scope ? scope->endFrm : 0;
    g_hdSpeEventId = scope ? scope->eventId : 0;
    g_hdSpeParentEventId = scope ? scope->parentEventId : 0;
    g_hdSpeDepth = scope ? scope->depth : 0;
    g_hdSpeResourceIndex = scope ? scope->resourceIndex : 0;
    g_hdSpeCount = scope ? scope->count : 0;
    g_hdSpePicmax = scope ? scope->picmax : 0;
    g_hdSpeResourceFingerprint = scope ? scope->resourceFingerprint : 0;
    g_hdSpeResourceLength = scope ? scope->resourceLength : 0;
    g_hdSpeCommitSeq = scope ? scope->commitSeq : 0;
    g_hdSpeFrameIndex = scope ? scope->frameIndex : BAYE_HD_SPE_NO_FRAME;
    g_hdSpeFrameValid = scope ? scope->frameValid : 0;
    g_hdSpeProtocolValid = scope ? scope->protocolValid : 0;
    g_hdSpeKeyflag = scope ? scope->keyflag : 0;
    /* GamDelay receives BOOL/I8 and only == true returns a keyboard key.
     * Bit 0 alone is insufficient for flags 3/5: preserve native behavior. */
    g_hdSpeSkipEligible = scope && scope->keyflag == 1;
    g_hdSpeContextKnown = scope ? scope->contextKnown : 0;
    g_hdSpeSkillId = scope ? scope->skillId : 0;
    g_hdSpeActorIndex = scope ? scope->actorIndex : 0xff;
    g_hdSpeTargetIndex = scope ? scope->targetIndex : 0xff;
    if (scope) memcpy(g_hdSpeVisibleFrames, scope->visibleFrames, sizeof(g_hdSpeVisibleFrames));
    else memset(g_hdSpeVisibleFrames, 0, sizeof(g_hdSpeVisibleFrames));
}

void baye_hd_spe_context(U8 kind, U16 skillId, U8 actorIndex, U8 targetIndex)
{
    baye_hd_begin_spe(kind);
    hdSpePendingContext = 1;
    hdSpePendingSkillId = skillId;
    hdSpePendingActor = actorIndex < FGTA_MAX ? actorIndex : 0xff;
    hdSpePendingTarget = targetIndex < FGTA_MAX ? targetIndex : 0xff;
}

void baye_hd_spe_enter(HdSpeScope* scope, U16 id, U16 resourceIndex, I16 x, I16 y, U8 startFrm, U8 endFrm, U8 keyflag)
{
    U8 kind = g_hdSpePendingKind;
    memset(scope, 0, sizeof(*scope));
    scope->contextKnown = hdSpePendingContext;
    scope->skillId = hdSpePendingSkillId;
    scope->actorIndex = hdSpePendingActor;
    scope->targetIndex = hdSpePendingTarget;
    /* Consume before resource lookup, including the missing-resource path. */
    baye_hd_begin_spe(0);
    if (!kind) {
        if (id == MAIN_SPE || id == MAKER_SPE) kind = BAYE_HD_SPE_KIND_OPENING;
        else if (id == STACHG_SPE) kind = BAYE_HD_SPE_KIND_STATUS;
        else if (g_hdFightActive) kind = BAYE_HD_SPE_KIND_ATTACK;
    }
    hdSpeNextEventId = hd_next_input_seq(hdSpeNextEventId);
    scope->generation = g_hdSpeGeneration;
    scope->eventId = hdSpeNextEventId;
    scope->previous = hdSpeCurrent;
    scope->parentEventId = hdSpeCurrent ? hdSpeCurrent->eventId : 0;
    scope->depth = hdSpeCurrent ? hdSpeCurrent->depth + 1 : 1;
    scope->id = id;
    scope->kind = kind;
    scope->resourceIndex = resourceIndex;
    scope->x = x; scope->y = y;
    scope->startFrm = startFrm; scope->endFrm = endFrm;
    scope->keyflag = keyflag;
    scope->frameIndex = BAYE_HD_SPE_NO_FRAME;
    hdSpeCurrent = scope;
    hdSpeCopyPending = NULL;
    hd_spe_publish(scope);
    g_hdSpeSeq = (U16)(g_hdSpeSeq + 1);
    if (!g_hdSpeSeq) g_hdSpeSeq = 1;
    hd_spe_notify();
}

void baye_hd_spe_ready(HdSpeScope* scope, U16 count, U16 picmax, U32 fingerprint, U32 resourceLength, U8 endFrm, U8 simplePictures)
{
    if (scope != hdSpeCurrent || scope->generation != g_hdSpeGeneration) return;
    scope->count = count; scope->picmax = picmax;
    scope->resourceFingerprint = fingerprint; scope->resourceLength = resourceLength;
    scope->endFrm = endFrm;
    scope->ready = 1;
    scope->protocolValid = scope->depth <= BAYE_HD_SPE_MAX_DEPTH &&
        !(scope->keyflag & 2) && simplePictures && !g_FlipDrawing && g_paintColor == 0xff;
    hd_spe_publish(scope);
}

void baye_hd_spe_frame(HdSpeScope* scope, U16 frameIndex, const U8* remaining, U16 introduced)
{
    U16 i;
    if (scope != hdSpeCurrent || scope->generation != g_hdSpeGeneration || !scope->ready ||
        !remaining || frameIndex < scope->startFrm || frameIndex > scope->endFrm ||
        introduced != frameIndex - scope->startFrm + 1) return;
    scope->frameIndex = frameIndex;
    if (g_FlipDrawing || g_paintColor != 0xff) scope->protocolValid = 0;
    scope->frameValid = 1;
    scope->commitSeq = hd_next_input_seq(scope->commitSeq);
    memset(scope->visibleFrames, 0, sizeof(scope->visibleFrames));
    for (i = 0; i < introduced; i++) {
        U16 absolute = scope->startFrm + i;
        if (remaining[i]) scope->visibleFrames[absolute >> 3] |= (U8)(1u << (absolute & 7));
    }
    hd_spe_publish(scope);
    hdSpeCopyPending = scope;
}

void baye_hd_spe_end(HdSpeScope* scope, U8 reason, U8 key)
{
    if (scope != hdSpeCurrent || scope->generation != g_hdSpeGeneration) return;
    g_hdSpeLastEndedId = scope->eventId;
    g_hdSpeEndReason = reason; g_hdSpeEndKey = key;
    hdSpeCurrent = scope->previous;
    hdSpeCopyPending = NULL;
    if (hdSpeCurrent) {
        /* An inner call may have replaced g_VisScr. Do not replay an old
         * parent picture; the next native copy must establish a fresh frame. */
        hdSpeCurrent->frameValid = 0;
        hdSpeCurrent->frameIndex = BAYE_HD_SPE_NO_FRAME;
        memset(hdSpeCurrent->visibleFrames, 0, sizeof(hdSpeCurrent->visibleFrames));
    }
    hd_spe_publish(hdSpeCurrent);
    hd_spe_notify();
}

void baye_hd_spe_lcd_dirty(void)
{
    memset(&hdSpeCopied, 0, sizeof(hdSpeCopied));
    hdSpeCopied.frameIndex = BAYE_HD_SPE_NO_FRAME;
}

void baye_hd_spe_lcd_copy(void)
{
    baye_hd_spe_lcd_dirty();
    if (hdSpeCopyPending && hdSpeCopyPending == hdSpeCurrent &&
        hdSpeCurrent->generation == g_hdSpeGeneration && hdSpeCurrent->frameValid) {
        hdSpeCopied.generation = hdSpeCurrent->generation;
        hdSpeCopied.eventId = hdSpeCurrent->eventId;
        hdSpeCopied.commitSeq = hdSpeCurrent->commitSeq;
        hdSpeCopied.frameIndex = hdSpeCurrent->frameIndex;
        hdSpeCopied.frameValid = 1;
        memcpy(hdSpeCopied.visibleFrames, hdSpeCurrent->visibleFrames, sizeof(hdSpeCopied.visibleFrames));
    }
    hdSpeCopyPending = NULL;
}

void baye_hd_spe_lcd_flush(void)
{
    g_hdSpeDisplayGeneration = hdSpeCopied.generation;
    g_hdSpeDisplayEventId = hdSpeCopied.eventId;
    g_hdSpeDisplayCommitSeq = hdSpeCopied.commitSeq;
    g_hdSpeDisplayFrameIndex = hdSpeCopied.frameIndex;
    g_hdSpeDisplayFrameValid = hdSpeCopied.frameValid;
    memcpy(g_hdSpeDisplayVisibleFrames, hdSpeCopied.visibleFrames, sizeof(g_hdSpeDisplayVisibleFrames));
}

void baye_hd_spe_invalidate(void)
{
    if (hdSpeCurrent) {
        g_hdSpeLastEndedId = hdSpeCurrent->eventId;
        g_hdSpeEndReason = BAYE_HD_SPE_END_RESET; g_hdSpeEndKey = 0xff;
    }
    hdSpeCurrent = hdSpeCopyPending = NULL;
    g_hdSpeGeneration = hd_next_input_seq(g_hdSpeGeneration);
    baye_hd_begin_spe(0);
    baye_hd_spe_lcd_dirty();
    baye_hd_spe_lcd_flush();
    g_hdMovieActive = 0; g_hdMovieId = 0;
    hd_spe_publish(NULL);
    hd_spe_notify();
}

void baye_hd_set_qty(U32 value, U32 minV, U32 maxV, U8 active)
{
    g_hdQtyValue = value;
    g_hdQtyMin = minV;
    g_hdQtyMax = maxV;
    g_hdQtyActive = active;
}

U32 baye_hd_qty_begin(void)
{
    g_hdQtySession = hd_next_input_seq(g_hdQtySession);
    g_hdQtyInputSeq = 0;
    g_hdQtyLastKey = BAYE_HD_QTY_NO_KEY;
    g_hdQtyCursor = 0;
    g_hdQtyStep = 1;
    g_hdQtyReady = 0;
    g_hdQtyActive = 1;
    return g_hdQtySession;
}

void baye_hd_qty_publish(U32 session, U32 value, U32 minV, U32 maxV, U8 cursor, U32 step, U16 key)
{
    /* Publish only after native processing/redrawing reaches its next wait.
     * A cursor/no-op key is a receipt too; touch/timers never acknowledge it. */
    if (!g_hdQtyActive || session != g_hdQtySession) return;
    baye_hd_set_qty(value, minV, maxV, 1);
    g_hdQtyCursor = cursor;
    g_hdQtyStep = step;
    if (key != BAYE_HD_QTY_NO_KEY) {
        g_hdQtyInputSeq = hd_next_input_seq(g_hdQtyInputSeq);
        g_hdQtyLastKey = key;
    }
    g_hdQtyReady = 1;
}

void baye_hd_qty_busy(U32 session)
{
    if (session == g_hdQtySession) g_hdQtyReady = 0;
}

void baye_hd_qty_end(U32 session, U32 value, U32 minV, U32 maxV, U16 key)
{
    if (!g_hdQtyActive || session != g_hdQtySession) return;
    baye_hd_set_qty(value, minV, maxV, 0);
    if (key != BAYE_HD_QTY_NO_KEY) {
        g_hdQtyInputSeq = hd_next_input_seq(g_hdQtyInputSeq);
        g_hdQtyLastKey = key;
    }
    g_hdQtyReady = 0;
}

void baye_hd_qty_invalidate(void)
{
    g_hdQtySession = hd_next_input_seq(g_hdQtySession);
    g_hdQtyActive = g_hdQtyReady = 0;
    g_hdQtyLastKey = BAYE_HD_QTY_NO_KEY;
}

void baye_hd_set_map_pick(U8 active)
{
    g_hdMapPick = active;
    EM_ASM({
        try {
            if (window.BayeHdCityMenu && typeof BayeHdCityMenu.onMapPick === 'function') {
                BayeHdCityMenu.onMapPick();
            }
        } catch (e) {}
    });
}

void baye_hd_set_battle_pick(U8 active)
{
    /* 1 only while BattleMake is inside GetCitySet. PlayerTactic leftover pick=1 is not this. */
    g_hdBattlePick = active ? 1 : 0;
    EM_ASM({
        try {
            if (window.BayeHdCityMenu && typeof BayeHdCityMenu.onMapPick === 'function') {
                BayeHdCityMenu.onMapPick();
            }
        } catch (e) {}
    });
}

void baye_hd_set_map_city(U8 city1)
{
    g_hdMapCity = city1;
}

void baye_hd_set_city_links(U8 city)
{
    U8 *clnk;
    U16 off;
    U8 i;
    memset(g_hdCityLinks, 0, sizeof(g_hdCityLinks));
    if (city >= 64 || city >= CITY_MAX) {
        return;
    }
    clnk = ResLoadToCon(CITY_LINKR, 1, g_CBnkPtr);
    if (!clnk) {
        return;
    }
    off = (U16)city * 16;
    memcpy(g_hdCityLinks, clnk + off, 8);
    for (i = 0; i < 8; i++) {
        U8 id = g_hdCityLinks[i];
        if (id == 0 || id == 0xff || (U16)(id - 1) >= CITY_MAX) {
            g_hdCityLinks[i] = 0;
        }
    }
}

void baye_hd_set_march(U8 fromCity, U8 objCity, U8 timeCount, U8 ok)
{
    g_hdMarchOk = ok;
    g_hdMarchCity = fromCity;
    g_hdMarchObj = objCity;
    g_hdMarchTime = timeCount;
    if (ok) {
        /* Fresh AddFightOrder: leftover 部队已出发 / ok from the last battle must not count. */
        g_hdMarchSeq = (U16)(g_hdMarchSeq + 1);
        if (g_hdMarchSeq == 0) {
            g_hdMarchSeq = 1;
        }
        g_hdFightSkip = BAYE_HD_FIGHT_SKIP_NONE;
    }
}

void baye_hd_clear_march_ok(void)
{
    g_hdMarchOk = 0;
}

void baye_hd_set_fight_skip(U8 reason)
{
    g_hdFightSkip = reason;
}

void baye_hd_note_retreat_blocked(void)
{
    EM_ASM({
        try {
            if (window.BayeHdBattle && typeof BayeHdBattle.onRetreatBlocked === 'function') {
                BayeHdBattle.onRetreatBlocked();
            }
        } catch (e) {}
        try { console.log('[hd-battle] retreat-blocked'); } catch (e2) {}
    });
}

EMSCRIPTEN_KEEPALIVE
void bayeHdLoadCityLinks(U8 city)
{
    baye_hd_set_city_links(city);
}

EMSCRIPTEN_KEEPALIVE
U8 bayeHdReady(void)
{
    return g_hdEngineReady;
}

EMSCRIPTEN_KEEPALIVE
U8* bayeHdGetReport(void)
{
    return g_hdReportGbk;
}

EMSCRIPTEN_KEEPALIVE
U16 bayeHdGetReportSeq(void)
{
    return g_hdReportSeq;
}

EMSCRIPTEN_KEEPALIVE
U16 bayeHdGetKingCount(void)
{
    return g_hdKingCount;
}

void baye_hd_bind(ObjectDef* def)
{
    DEFADDF(g_hdEngineReady, U8);
    DEFADDF(g_hdKingCount, U16);
    DEFADDF(g_hdKingIndex, U16);
    DEFADDF(g_hdKingId, U16);
    DEFADD_U16ARR(g_hdKingIds, BAYE_HD_KING_MAX);
    DEFADD_GBKARR(g_hdKingNames, sizeof(g_hdKingNames));
    DEFADD_GBKARR(g_hdReportGbk, sizeof(g_hdReportGbk));
    DEFADDF(g_hdReportPerson, U16);
    DEFADDF(g_hdReportKind, U16);
    DEFADDF(g_hdReportSeq, U16);
    DEFADDF(g_hdReportActive, U8);
    DEFADDF(g_hdReportInputSeq, U32);
    DEFADDF(g_hdRecordActive, U8);
    DEFADDF(g_hdRecordMode, U8);
    DEFADDF(g_hdRecordIndex, U8);
    DEFADDF(g_hdRecordCount, U8);
    DEFADDF(g_hdRecordSeq, U32);
    DEFADD_GBKARR(g_hdMenuGbk, sizeof(g_hdMenuGbk));
    {
        U8* g_hdMenuBytes = g_hdMenuGbk;
        DEFADD_U8ARR(g_hdMenuBytes, BAYE_HD_MENU_MAX);
    }
    DEFADDF(g_hdMenuItemLen, U16);
    DEFADDF(g_hdMenuCount, U16);
    DEFADDF(g_hdMenuIndex, U16);
    DEFADDF(g_hdMenuActive, U8);
    DEFADDF(g_hdMenuContext, U8);
    DEFADDF(g_hdMenuKind, U8);
    DEFADDF(g_hdMenuSeq, U32);
    DEFADDF(g_hdFightActive, U8);
    DEFADDF(g_hdFightOver, U8);
    DEFADDF(g_hdFightWait, U8);
    DEFADDF(g_hdFightPhase, U8);
    DEFADDF(g_hdFightAimType, U8);
    DEFADDF(g_hdFightActCommit, U8);
    DEFADDF(g_hdFightAllowRetreat, U8);
    DEFADDF(g_hdFightMenuControl, U8);
    DEFADDF(g_hdFightInputKind, U8);
    DEFADDF(g_hdFightInputSeq, U32);
    DEFADDF(g_hdFightActor, U8);
    DEFADD_GBKARR(g_hdFightResultGbk, sizeof(g_hdFightResultGbk));
    DEFADD_GBKARR(g_hdFightTipGbk, sizeof(g_hdFightTipGbk));
    DEFADDF(g_hdQtyValue, U32);
    DEFADDF(g_hdQtyMin, U32);
    DEFADDF(g_hdQtyMax, U32);
    DEFADDF(g_hdQtyActive, U8);
    DEFADDF(g_hdQtySession, U32);
    DEFADDF(g_hdQtyInputSeq, U32);
    DEFADDF(g_hdQtyLastKey, U16);
    DEFADDF(g_hdQtyCursor, U8);
    DEFADDF(g_hdQtyStep, U32);
    DEFADDF(g_hdQtyReady, U8);
    DEFADDF(g_hdMapPick, U8);
    DEFADDF(g_hdMapInputSeq, U32);
    DEFADDF(g_hdBattlePick, U8);
    DEFADDF(g_hdMapCity, U8);
    DEFADD_U8ARR(g_hdCityLinks, 8);
    DEFADDF(g_hdMarchOk, U8);
    DEFADDF(g_hdMarchCity, U8);
    DEFADDF(g_hdMarchObj, U8);
    DEFADDF(g_hdMarchTime, U8);
    DEFADDF(g_hdMarchSeq, U16);
    DEFADDF(g_hdMarchSession, U16);
    DEFADDF(g_hdMarchPhase, U8);
    DEFADDF(g_hdMarchOrigin, U8);
    DEFADDF(g_hdMarchSelected, U8);
    DEFADDF(g_hdMarchInputSeq, U32);
    DEFADDF(g_hdFightSkip, U8);
    DEFADD_GBKARR(g_hdHelpGbk, sizeof(g_hdHelpGbk));
    DEFADDF(g_hdHelpSeq, U16);
    DEFADDF(g_hdHelpActive, U8);
    DEFADDF(g_hdMovieActive, U8);
    DEFADDF(g_hdMovieId, U16);
    DEFADDF(g_hdSpeActive, U8);
    DEFADDF(g_hdSpeId, U16);
    DEFADDF(g_hdSpeKind, U8);
    DEFADDF(g_hdSpeX, U8);
    DEFADDF(g_hdSpeY, U8);
    DEFADDF(g_hdSpeStartFrm, U8);
    DEFADDF(g_hdSpeEndFrm, U8);
    DEFADDF(g_hdSpeSeq, U16);
    DEFADDF(g_hdSpeProtocolVersion, U8);
    DEFADDF(g_hdSpeGeneration, U32);
    DEFADDF(g_hdSpeEventId, U32);
    DEFADDF(g_hdSpeParentEventId, U32);
    DEFADDF(g_hdSpeDepth, U16);
    DEFADDF(g_hdSpeResourceIndex, U16);
    DEFADDF(g_hdSpeCount, U16);
    DEFADDF(g_hdSpePicmax, U16);
    DEFADDF(g_hdSpeResourceFingerprint, U32);
    DEFADDF(g_hdSpeResourceLength, U32);
    DEFADDF(g_hdSpeCommitSeq, U32);
    DEFADDF(g_hdSpeFrameIndex, U16);
    DEFADDF(g_hdSpeFrameValid, U8);
    DEFADDF(g_hdSpeProtocolValid, U8);
    /* The generic bridge has unsigned scalar types only. JS decodes these
     * two I16 bit patterns without truncating native off-screen coordinates. */
    DEFADDF(g_hdSpeOriginX, U16);
    DEFADDF(g_hdSpeOriginY, U16);
    DEFADDF(g_hdSpeKeyflag, U8);
    DEFADDF(g_hdSpeSkipEligible, U8);
    DEFADDF(g_hdSpeContextKnown, U8);
    DEFADDF(g_hdSpeSkillId, U16);
    DEFADDF(g_hdSpeActorIndex, U8);
    DEFADDF(g_hdSpeTargetIndex, U8);
    DEFADD_U8ARR(g_hdSpeVisibleFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADDF(g_hdSpeLastEndedId, U32);
    DEFADDF(g_hdSpeEndReason, U8);
    DEFADDF(g_hdSpeEndKey, U8);
    DEFADDF(g_hdSpeDisplayGeneration, U32);
    DEFADDF(g_hdSpeDisplayEventId, U32);
    DEFADDF(g_hdSpeDisplayCommitSeq, U32);
    DEFADDF(g_hdSpeDisplayFrameIndex, U16);
    DEFADDF(g_hdSpeDisplayFrameValid, U8);
    DEFADD_U8ARR(g_hdSpeDisplayVisibleFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADDF(g_hdSkillActive, U8);
    DEFADDF(g_hdSkillCount, U8);
    DEFADDF(g_hdSkillNameLen, U8);
    DEFADD_U16ARR(g_hdSkillIds, BAYE_HD_SKILL_MAX);
    DEFADD_GBKARR(g_hdSkillNames, sizeof(g_hdSkillNames));
    {
        U8* g_hdSkillNameBytes = g_hdSkillNames;
        DEFADD_U8ARR(g_hdSkillNameBytes, sizeof(g_hdSkillNames));
    }
}
