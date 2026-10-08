#include "baye/stdsys.h"
#include "baye/comm.h"
#include "baye/enghead.h"
#include "hd-bridge.h"
#include "baye/bind-objects.h"
#include <string.h>
#include <emscripten.h>
#ifdef __EMSCRIPTEN__
#include <emscripten/heap.h>
#endif

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
U32 g_hdDetailGeneration = 1;
U16 g_hdMenuIds[BAYE_HD_DETAIL_IDS_MAX];
U16 g_hdMenuIdsCount = 0;
U8 g_hdMenuIdsKind = 0;
U32 g_hdMenuIdsSeq = 0, g_hdMenuIdsGeneration = 0;
U8 g_hdGoodsActive = 0, g_hdGoodsComplete = 0, g_hdGoodsCustom = 0;
U32 g_hdGoodsGeneration = 0, g_hdGoodsMenuSeq = 0;
U16 g_hdGoodsIndex = 0xffff, g_hdGoodsTool = 0xffff, g_hdGoodsPropertyCount = 0;
U16 g_hdGoodsPageStart = 0, g_hdGoodsPageEnd = 0;
U8 g_hdGoodsNameGbk[32];
U8 g_hdGoodsPropertyTitles[BAYE_HD_GOODS_PROPS_MAX * BAYE_HD_GOODS_TEXT_MAX];
U8 g_hdGoodsPropertyValues[BAYE_HD_GOODS_PROPS_MAX * BAYE_HD_GOODS_TEXT_MAX];
U8 g_hdGoodsPropertyFlags[BAYE_HD_GOODS_PROPS_MAX];
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
U8 g_hdHelpProtocolVersion = BAYE_HD_DETAIL_VERSION;
U32 g_hdHelpGeneration = 0, g_hdHelpInputSeq = 0;
U8 g_hdHelpKind = 0, g_hdHelpComplete = 0, g_hdHelpSlot = 0xff;
U16 g_hdHelpPerson = 0xffff, g_hdHelpFields[10];
U8 g_hdHelpX = 0, g_hdHelpY = 0, g_hdHelpTerrain = 0xff, g_hdHelpLevelMax = 0;
U8 g_hdHelpNameGbk[32], g_hdHelpArmGbk[16], g_hdHelpStateGbk[32];
U8 g_hdViewProtocolVersion = BAYE_HD_OVERVIEW_VERSION;
U8 g_hdViewActive = 0, g_hdViewComplete = 0, g_hdViewCustom = 0;
U32 g_hdViewSeq = 0, g_hdViewGeneration = 0, g_hdViewInputSeq = 0;
static U32 hdViewRetirement = 1;
U8 g_hdViewForce = 0, g_hdViewPageStart = 0, g_hdViewPageSize = 0;
U8 g_hdViewTotalCount = 0, g_hdViewRowCount = 0, g_hdViewPointCount = 0;
U8 g_hdViewMapWidth = 0, g_hdViewMapHeight = 0, g_hdViewPlayerMode = 0, g_hdViewFoodKnown = 0;
U16 g_hdViewDays = 0, g_hdViewFood = 0, g_hdViewLeader = 0xffff;
U8 g_hdViewTitleGbk[64], g_hdViewDaysGbk[64], g_hdViewPositionsGbk[64];
U8 g_hdViewFactionGbk[64], g_hdViewFoodGbk[64];
U16 g_hdViewRowPersons[10], g_hdViewRowArms[10], g_hdViewPointPersons[20];
U8 g_hdViewRowSlots[10], g_hdViewRowNames[10 * 32], g_hdViewRowText[10 * 64];
U8 g_hdViewPointSlots[20], g_hdViewPointX[20], g_hdViewPointY[20], g_hdViewPointState[20];
U8 g_hdMiniMapProtocolVersion = BAYE_HD_OVERVIEW_VERSION;
U8 g_hdMiniMapActive = 0, g_hdMiniMapComplete = 0, g_hdMiniMapCustom = 0, g_hdMiniMapDefaultDraw = 0;
U32 g_hdMiniMapSeq = 0, g_hdMiniMapGeneration = 0, g_hdMiniMapInputSeq = 0;
U16 g_hdMiniMapResourceId = TACTIC_ICON, g_hdMiniMapImageIndex = 0;
U16 g_hdMiniMapWidth = 0, g_hdMiniMapHeight = 0;
U8 g_hdMiniMapMask = 0, g_hdMiniMapCursorX = 0, g_hdMiniMapCursorY = 0;
U8 g_hdMiniMapViewX = 0, g_hdMiniMapViewY = 0, g_hdMiniMapViewWidth = 0, g_hdMiniMapViewHeight = 0;
U8 g_hdMiniMapCity1 = 0;
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

/* Composition and attack observations are independent of SPE v2 lifecycle. */
U8 g_hdSpeCompositionVersion = BAYE_HD_COMPOSITION_VERSION;
U8 g_hdSpeCompositionValid = 0, g_hdSpeDisplayCompositionValid = 0;
U8 g_hdSpeClearFrames[BAYE_HD_SPE_FRAME_BYTES], g_hdSpeDisplayClearFrames[BAYE_HD_SPE_FRAME_BYTES];
U8 g_hdSpeBgValid = 0;
U16 g_hdSpeBgId = 0;
U16 g_hdSpeBgResourceIndex = 0;
U16 g_hdSpeBgPictureIndex = 0;
U16 g_hdSpeBgWidth = 0;
U16 g_hdSpeBgHeight = 0;
U16 g_hdSpeBgCount = 0;
U8 g_hdSpeBgMask = 0;
I16 g_hdSpeBgOriginX = 0;
I16 g_hdSpeBgOriginY = 0;
U32 g_hdSpeBgResourceFingerprint = 0;
U32 g_hdSpeBgResourceLength = 0;
U8 g_hdSpeDisplayBgValid = 0;
U16 g_hdSpeDisplayBgId = 0;
U16 g_hdSpeDisplayBgResourceIndex = 0;
U16 g_hdSpeDisplayBgPictureIndex = 0;
U16 g_hdSpeDisplayBgWidth = 0;
U16 g_hdSpeDisplayBgHeight = 0;
U16 g_hdSpeDisplayBgCount = 0;
U8 g_hdSpeDisplayBgMask = 0;
I16 g_hdSpeDisplayBgOriginX = 0;
I16 g_hdSpeDisplayBgOriginY = 0;
U32 g_hdSpeDisplayBgResourceFingerprint = 0;
U32 g_hdSpeDisplayBgResourceLength = 0;
U8 g_hdAttackBgValid = 0;
U16 g_hdAttackBgId = 0;
U16 g_hdAttackBgResourceIndex = 0;
U16 g_hdAttackBgPictureIndex = 0;
U16 g_hdAttackBgWidth = 0;
U16 g_hdAttackBgHeight = 0;
U16 g_hdAttackBgCount = 0;
U8 g_hdAttackBgMask = 0;
I16 g_hdAttackBgOriginX = 0;
I16 g_hdAttackBgOriginY = 0;
U32 g_hdAttackBgResourceFingerprint = 0;
U32 g_hdAttackBgResourceLength = 0;
U8 g_hdAttackDisplayBgValid = 0;
U16 g_hdAttackDisplayBgId = 0;
U16 g_hdAttackDisplayBgResourceIndex = 0;
U16 g_hdAttackDisplayBgPictureIndex = 0;
U16 g_hdAttackDisplayBgWidth = 0;
U16 g_hdAttackDisplayBgHeight = 0;
U16 g_hdAttackDisplayBgCount = 0;
U8 g_hdAttackDisplayBgMask = 0;
I16 g_hdAttackDisplayBgOriginX = 0;
I16 g_hdAttackDisplayBgOriginY = 0;
U32 g_hdAttackDisplayBgResourceFingerprint = 0;
U32 g_hdAttackDisplayBgResourceLength = 0;
U8 g_hdAttackNumberValid = 0;
U16 g_hdAttackNumberId = 0;
U16 g_hdAttackNumberResourceIndex = 0;
U16 g_hdAttackNumberPictureIndex = 0;
U16 g_hdAttackNumberWidth = 0;
U16 g_hdAttackNumberHeight = 0;
U16 g_hdAttackNumberCount = 0;
U8 g_hdAttackNumberMask = 0;
I16 g_hdAttackNumberOriginX = 0;
I16 g_hdAttackNumberOriginY = 0;
U32 g_hdAttackNumberResourceFingerprint = 0;
U32 g_hdAttackNumberResourceLength = 0;
U8 g_hdAttackProtocolVersion = BAYE_HD_ATTACK_VERSION;
U8 g_hdAttackActive = 0;
U8 g_hdAttackPhase = 0;
U8 g_hdAttackCustom = 0;
U8 g_hdAttackSourceValid = 0;
U32 g_hdAttackGeneration = 0;
U32 g_hdAttackSession = 0;
U8 g_hdAttackActorIndex = 0xff;
U8 g_hdAttackTargetIndex = 0xff;
U16 g_hdAttackHurt = 0;
U32 g_hdAttackPaintSeq = 0;
U32 g_hdAttackEventId = 0;
U32 g_hdAttackCommitSeq = 0;
U16 g_hdAttackFrameIndex = BAYE_HD_SPE_NO_FRAME;
U16 g_hdAttackId = 0;
U16 g_hdAttackResourceIndex = 0;
U16 g_hdAttackCount = 0;
U16 g_hdAttackPicmax = 0;
U8 g_hdAttackStartFrm = 0;
U8 g_hdAttackEndFrm = 0;
I16 g_hdAttackOriginX = 0;
I16 g_hdAttackOriginY = 0;
U32 g_hdAttackResourceFingerprint = 0;
U32 g_hdAttackResourceLength = 0;
U8 g_hdAttackDigitCount = 0;
U8 g_hdAttackDisplayValid = 0;
U32 g_hdAttackDisplayGeneration = 0;
U32 g_hdAttackDisplaySession = 0;
U32 g_hdAttackDisplayPaintSeq = 0;
U32 g_hdAttackDisplayEventId = 0;
U32 g_hdAttackDisplayCommitSeq = 0;
U16 g_hdAttackDisplayFrameIndex = BAYE_HD_SPE_NO_FRAME;
U8 g_hdAttackDisplayDigitCount = 0;
U8 g_hdAttackVisibleFrames[BAYE_HD_SPE_FRAME_BYTES];
U8 g_hdAttackClearFrames[BAYE_HD_SPE_FRAME_BYTES];
U8 g_hdAttackDigitIndex[BAYE_HD_ATTACK_DIGITS];
I16 g_hdAttackDigitX[BAYE_HD_ATTACK_DIGITS];
I16 g_hdAttackDigitY[BAYE_HD_ATTACK_DIGITS];
I16 g_hdAttackDigitFirstY[BAYE_HD_ATTACK_DIGITS];
U16 g_hdAttackDigitDrawCount[BAYE_HD_ATTACK_DIGITS];
U8 g_hdAttackDisplayVisibleFrames[BAYE_HD_SPE_FRAME_BYTES];
U8 g_hdAttackDisplayClearFrames[BAYE_HD_SPE_FRAME_BYTES];
U8 g_hdAttackDisplayDigitIndex[BAYE_HD_ATTACK_DIGITS];
I16 g_hdAttackDisplayDigitX[BAYE_HD_ATTACK_DIGITS];
I16 g_hdAttackDisplayDigitY[BAYE_HD_ATTACK_DIGITS];
I16 g_hdAttackDisplayDigitFirstY[BAYE_HD_ATTACK_DIGITS];
U16 g_hdAttackDisplayDigitDrawCount[BAYE_HD_ATTACK_DIGITS];


typedef struct {
    U32 generation, eventId, commitSeq;
    U16 frameIndex;
    U8 frameValid, visibleFrames[BAYE_HD_SPE_FRAME_BYTES];
    U8 compositionValid, clearFrames[BAYE_HD_SPE_FRAME_BYTES];
    HdPictureSource background;
} HdSpeDisplay;
static HdSpeScope* hdSpeCurrent = NULL;
static HdSpeScope* hdSpeCopyPending = NULL;
static U32 hdSpeNextEventId = 0;
static U16 hdSpePendingSkillId = 0;
static U8 hdSpePendingContext = 0, hdSpePendingActor = 0xff, hdSpePendingTarget = 0xff;
static HdSpeDisplay hdSpeCopied;
static HdPictureSource hdBackgroundPending;
static U32 hdBackgroundSession = 0, hdBackgroundDrawing = 0;
static HdSpeScope* hdSpeDrawing = NULL;
static U32 hdSpeDrawingGeneration = 0;
static HdSpeDisplay hdAttackScene;
typedef struct {
    U32 generation, session, paintSeq;
    U8 valid, count;
    U8 index[BAYE_HD_ATTACK_DIGITS];
    I16 x[BAYE_HD_ATTACK_DIGITS], y[BAYE_HD_ATTACK_DIGITS], firstY[BAYE_HD_ATTACK_DIGITS];
    U16 drawCount[BAYE_HD_ATTACK_DIGITS];
    HdSpeDisplay scene;
} HdAttackPaint;
static HdAttackPaint hdAttackPaint;
static U32 hdAttackDigitSession = 0;
static U8 hdAttackDigitSlot = 0, hdAttackDigitValue = 0, hdAttackDigitWritten = 0;
static I16 hdAttackDigitX = 0, hdAttackDigitY = 0;

U8 g_hdMakerProtocolVersion = BAYE_HD_MAKER_VERSION;
U8 g_hdMakerActive = 0, g_hdMakerPhase = 0, g_hdMakerCustom = 0;
U8 g_hdMakerReturnEligible = 0, g_hdMakerSourceValid = 0;
U32 g_hdMakerGeneration = 0, g_hdMakerSession = 0, g_hdMakerInputSeq = 0;
U32 g_hdMakerEventId = 0, g_hdMakerCommitSeq = 0;
U32 g_hdMakerResourceFingerprint = 0, g_hdMakerResourceLength = 0;
U16 g_hdMakerResourceIndex = 0, g_hdMakerCount = 0, g_hdMakerPicmax = 0;
U16 g_hdMakerFrameIndex = BAYE_HD_SPE_NO_FRAME;
I16 g_hdMakerOriginX = 0, g_hdMakerOriginY = 0;
U8 g_hdMakerStartFrm = 0, g_hdMakerEndFrm = 0;
U8 g_hdMakerEndReason = 0, g_hdMakerEndKey = 0xff;
U8 g_hdMakerVisibleFrames[BAYE_HD_SPE_FRAME_BYTES];

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

static U8 hd_detail_copy(U8* dst, U32 capacity, const U8* src, U32 sourceCapacity)
{
    U32 n;
    if (!src || !capacity) return 0;
    for (n = 0; n < sourceCapacity && src[n]; ++n) {}
    if (n == sourceCapacity || n >= capacity) { dst[0] = 0; return 0; }
    memcpy(dst, src, n + 1);
    return 1;
}

static void hd_goods_clear(void)
{
    g_hdGoodsActive = g_hdGoodsComplete = g_hdGoodsCustom = 0;
    g_hdGoodsGeneration = g_hdGoodsMenuSeq = 0;
    g_hdGoodsIndex = g_hdGoodsTool = 0xffff;
    g_hdGoodsPropertyCount = g_hdGoodsPageStart = g_hdGoodsPageEnd = 0;
    g_hdGoodsNameGbk[0] = 0;
    memset(g_hdGoodsPropertyFlags, 0, sizeof(g_hdGoodsPropertyFlags));
    memset(g_hdGoodsPropertyTitles, 0, sizeof(g_hdGoodsPropertyTitles));
    memset(g_hdGoodsPropertyValues, 0, sizeof(g_hdGoodsPropertyValues));
}

static void hd_menu_ids_clear(void)
{
    g_hdMenuIdsCount = g_hdMenuIdsKind = 0;
    g_hdMenuIdsSeq = g_hdMenuIdsGeneration = 0;
    memset(g_hdMenuIds, 0xff, sizeof(g_hdMenuIds));
    hd_goods_clear();
}

static void hd_help_detail_clear(void)
{
    g_hdHelpGeneration = g_hdHelpInputSeq = 0;
    g_hdHelpKind = g_hdHelpComplete = g_hdHelpLevelMax = 0;
    g_hdHelpPerson = 0xffff;
    g_hdHelpSlot = g_hdHelpTerrain = 0xff;
    g_hdHelpX = g_hdHelpY = 0;
    g_hdHelpNameGbk[0] = g_hdHelpArmGbk[0] = g_hdHelpStateGbk[0] = 0;
    memset(g_hdHelpFields, 0, sizeof(g_hdHelpFields));
}

/* Read only the real file and already loaded constant page. Never trust the
 * old 2000-record binding or do legacy unchecked resource pointer arithmetic.
 * The file cursor is restored, including ROM's otherwise unseekable EOF. */
static U8 hd_detail_read_at(U32 offset, void* output, U16 size)
{
    return gam_fseek(g_LibFp, offset, SEEK_SET) == 0 &&
        gam_fread((U8*)output, 1, size, g_LibFp) == size;
}

static void hd_detail_restore(U32 position)
{
    U8 byte;
    if (gam_fseek(g_LibFp, position, SEEK_SET) != 0 && position > 0 &&
        gam_fseek(g_LibFp, position - 1, SEEK_SET) == 0) gam_fread(&byte, 1, 1, g_LibFp);
}

/* Validate an already loaded resource without calling a resource hook or
 * changing the library stream's cursor. This does not harden native LIB parsing. */
static U8 hd_overview_resource(U16 resource, U16 index, U32* offsetOut, U32* lengthOut)
{
    U32 position, address, offset, length;
    RCHEAD header;
    RIDX item;
    U8 last, ok = 0;
    if (!resource || !index || !g_LibFp || !g_CBnkPtr) return 0;
    position = gam_ftell(g_LibFp);
    if (!hd_detail_read_at(((U32)resource - 1) * 4, &address, sizeof(address)) ||
        !address || address == (U32)-1 || !hd_detail_read_at(address, &header, sizeof(header)) ||
        header.ResId != resource || index > header.ItmCnt || header.ResKey ||
        header.ResLen < sizeof(header) || address > (U32)-1 - header.ResLen) goto done;
    if (header.ItmLen) {
        if ((U32)(index - 1) > ((U32)-1 - sizeof(header)) / header.ItmLen) goto done;
        offset = sizeof(header) + (U32)(index - 1) * header.ItmLen;
        length = header.ItmLen;
    } else if (header.ItmCnt == 1) {
        offset = sizeof(header); length = header.ResLen - sizeof(header);
    } else {
        if ((U32)header.ItmCnt * sizeof(item) > header.ResLen - sizeof(header) ||
            !hd_detail_read_at(address + sizeof(header) + (U32)(index - 1) * sizeof(item), &item, sizeof(item))) goto done;
        offset = item.offset; length = item.rlen;
        if (offset < sizeof(header) + (U32)header.ItmCnt * sizeof(item)) goto done;
    }
    if (!length || offset > header.ResLen || length > header.ResLen - offset ||
        !hd_detail_read_at(address + offset + length - 1, &last, 1)) goto done;
#ifdef __EMSCRIPTEN__
    if ((size_t)g_CBnkPtr > emscripten_get_heap_size() ||
        address + offset > emscripten_get_heap_size() - (size_t)g_CBnkPtr ||
        length > emscripten_get_heap_size() - (size_t)g_CBnkPtr - address - offset) goto done;
#endif
    *offsetOut = address + offset; *lengthOut = length; ok = 1;
done:
    hd_detail_restore(position);
    return ok;
}

const U8* baye_hd_picture_resource(U16 id, U16 item, U32* length)
{
    U32 offset;
    *length = 0;
    if (item == 0xffff || !hd_overview_resource(id, item + 1, &offset, length)) return NULL;
    return g_CBnkPtr + offset;
}

void baye_hd_view_retire(void)
{
    hdViewRetirement = hd_next_input_seq(hdViewRetirement);
    g_hdViewSeq = hd_next_input_seq(g_hdViewSeq);
    g_hdViewActive = g_hdViewComplete = g_hdViewCustom = 0;
    g_hdViewGeneration = g_hdViewInputSeq = 0;
    g_hdViewRowCount = g_hdViewPointCount = 0;
    g_hdViewForce = g_hdViewPageStart = g_hdViewPageSize = g_hdViewTotalCount = 0;
    g_hdViewMapWidth = g_hdViewMapHeight = g_hdViewPlayerMode = g_hdViewFoodKnown = 0;
    g_hdViewDays = g_hdViewFood = 0; g_hdViewLeader = 0xffff;
    g_hdViewTitleGbk[0] = g_hdViewDaysGbk[0] = g_hdViewPositionsGbk[0] = 0;
    g_hdViewFactionGbk[0] = g_hdViewFoodGbk[0] = 0;
}

void baye_hd_view_capture(HdViewSnapshot* snapshot)
{
    if (!snapshot) return;
    memset(snapshot, 0, sizeof(*snapshot));
    snapshot->generation = g_hdDetailGeneration;
    snapshot->inputSeq = g_hdFightInputSeq;
    snapshot->retirement = hdViewRetirement;
    snapshot->leader = 0xffff;
    snapshot->complete = 1;
}

void baye_hd_view_publish(const HdViewSnapshot* snapshot)
{
    U8 i, complete;
    if (!snapshot || snapshot->generation != g_hdDetailGeneration ||
        snapshot->retirement != hdViewRetirement || snapshot->inputSeq != g_hdFightInputSeq ||
        !g_hdFightActive || g_hdFightInputKind != BAYE_HD_FIGHT_INPUT_VIEW || g_hdReportActive) return;
    complete = snapshot->complete && !snapshot->custom && snapshot->force <= 1 &&
        snapshot->mapWidth == g_MapWid && snapshot->mapHeight == g_MapHgt &&
        snapshot->mapWidth && snapshot->mapHeight && snapshot->pageSize &&
        snapshot->totalCount <= BAYE_HD_VIEW_ROWS && snapshot->rowCount <= BAYE_HD_VIEW_ROWS &&
        snapshot->pointCount <= BAYE_HD_VIEW_POINTS &&
        snapshot->leader < GamGetPersonCount() && snapshot->leader < PERSON_MAX;
    for (i = 0; i < snapshot->rowCount && i < BAYE_HD_VIEW_ROWS; ++i) {
        if (snapshot->rowPersons[i] >= GamGetPersonCount() || snapshot->rowPersons[i] >= PERSON_MAX ||
            snapshot->rowSlots[i] >= FGTA_MAX || snapshot->rowSlots[i] != snapshot->force * FGT_PLAMAX + snapshot->pageStart + i ||
            g_FgtParam.GenArray[snapshot->rowSlots[i]] != (U32)snapshot->rowPersons[i] + 1) complete = 0;
    }
    for (i = 0; i < snapshot->pointCount && i < BAYE_HD_VIEW_POINTS; ++i) {
        if (snapshot->pointPersons[i] >= GamGetPersonCount() || snapshot->pointPersons[i] >= PERSON_MAX ||
            snapshot->pointSlots[i] >= FGTA_MAX || snapshot->pointX[i] >= g_MapWid || snapshot->pointY[i] >= g_MapHgt ||
            snapshot->pointState[i] == STATE_SW ||
            g_FgtParam.GenArray[snapshot->pointSlots[i]] != (U32)snapshot->pointPersons[i] + 1) complete = 0;
    }
    g_hdViewGeneration = snapshot->generation; g_hdViewInputSeq = snapshot->inputSeq;
    g_hdViewForce = snapshot->force; g_hdViewPageStart = snapshot->pageStart; g_hdViewPageSize = snapshot->pageSize;
    g_hdViewTotalCount = snapshot->totalCount; g_hdViewRowCount = snapshot->rowCount <= 10 ? snapshot->rowCount : 0;
    g_hdViewPointCount = snapshot->pointCount <= 20 ? snapshot->pointCount : 0;
    g_hdViewMapWidth = snapshot->mapWidth; g_hdViewMapHeight = snapshot->mapHeight;
    g_hdViewPlayerMode = snapshot->playerMode; g_hdViewDays = snapshot->days;
    g_hdViewFoodKnown = snapshot->foodKnown; g_hdViewFood = snapshot->foodKnown ? snapshot->food : 0;
    g_hdViewLeader = snapshot->leader;
#define HD_VIEW_COPY(dest, source) if (!hd_detail_copy(dest, sizeof(dest), source, sizeof(source))) complete = 0
    HD_VIEW_COPY(g_hdViewTitleGbk, snapshot->title);
    HD_VIEW_COPY(g_hdViewDaysGbk, snapshot->daysText);
    HD_VIEW_COPY(g_hdViewPositionsGbk, snapshot->positionsText);
    HD_VIEW_COPY(g_hdViewFactionGbk, snapshot->factionText);
    HD_VIEW_COPY(g_hdViewFoodGbk, snapshot->foodText);
#undef HD_VIEW_COPY
    memcpy(g_hdViewRowPersons, snapshot->rowPersons, sizeof(g_hdViewRowPersons));
    memcpy(g_hdViewRowArms, snapshot->rowArms, sizeof(g_hdViewRowArms));
    memcpy(g_hdViewRowSlots, snapshot->rowSlots, sizeof(g_hdViewRowSlots));
    memcpy(g_hdViewRowNames, snapshot->rowNames, sizeof(g_hdViewRowNames));
    memcpy(g_hdViewRowText, snapshot->rowText, sizeof(g_hdViewRowText));
    memcpy(g_hdViewPointPersons, snapshot->pointPersons, sizeof(g_hdViewPointPersons));
    memcpy(g_hdViewPointSlots, snapshot->pointSlots, sizeof(g_hdViewPointSlots));
    memcpy(g_hdViewPointX, snapshot->pointX, sizeof(g_hdViewPointX));
    memcpy(g_hdViewPointY, snapshot->pointY, sizeof(g_hdViewPointY));
    memcpy(g_hdViewPointState, snapshot->pointState, sizeof(g_hdViewPointState));
    g_hdViewCustom = snapshot->custom; g_hdViewComplete = complete; g_hdViewActive = 1;
    g_hdViewSeq = hd_next_input_seq(g_hdViewSeq);
}

void baye_hd_view_clear(U32 generation, U32 inputSeq)
{
    if (generation == g_hdDetailGeneration && generation == g_hdViewGeneration &&
        inputSeq == g_hdViewInputSeq) baye_hd_view_retire();
}

void baye_hd_mini_map_retire(void)
{
    g_hdMiniMapActive = g_hdMiniMapComplete = g_hdMiniMapCustom = g_hdMiniMapDefaultDraw = 0;
    g_hdMiniMapGeneration = g_hdMiniMapInputSeq = 0;
    g_hdMiniMapWidth = g_hdMiniMapHeight = 0;
    g_hdMiniMapMask = g_hdMiniMapCity1 = 0;
    g_hdMiniMapCursorX = g_hdMiniMapCursorY = g_hdMiniMapViewX = g_hdMiniMapViewY = 0;
    g_hdMiniMapViewWidth = g_hdMiniMapViewHeight = 0;
    g_hdMiniMapSeq = hd_next_input_seq(g_hdMiniMapSeq);
}

void baye_hd_mini_map_publish(U32 generation, U32 inputSeq, U8 cursorX, U8 cursorY,
    U8 viewX, U8 viewY, U8 viewWidth, U8 viewHeight, U8 city1, U8 defaultDraw, U8 custom)
{
    U32 offset, length, bytes;
    PictureHeadType picture;
    U8 complete = 0;
    if (generation != g_hdDetailGeneration || inputSeq != g_hdMapInputSeq ||
        !g_hdMapPick || g_hdReportActive || g_hdFightActive) return;
    g_hdMiniMapWidth = g_hdMiniMapHeight = g_hdMiniMapMask = 0;
    if (defaultDraw && hd_overview_resource(TACTIC_ICON, 1, &offset, &length) && length >= sizeof(picture)) {
        memcpy(&picture, g_CBnkPtr + offset, sizeof(picture));
        g_hdMiniMapWidth = picture.wid; g_hdMiniMapHeight = picture.hig; g_hdMiniMapMask = picture.mask;
        bytes = ((U32)picture.wid + 7) / 8 * picture.hig;
        if (picture.mask & 1) bytes *= 2;
        complete = !custom && picture.wid && picture.hig && picture.count &&
            !(picture.mask & 0xfe) && bytes <= length - sizeof(picture);
    }
    g_hdMiniMapGeneration = generation; g_hdMiniMapInputSeq = inputSeq;
    g_hdMiniMapDefaultDraw = defaultDraw; g_hdMiniMapCustom = custom;
    g_hdMiniMapCursorX = cursorX; g_hdMiniMapCursorY = cursorY;
    g_hdMiniMapViewX = viewX; g_hdMiniMapViewY = viewY;
    g_hdMiniMapViewWidth = viewWidth; g_hdMiniMapViewHeight = viewHeight; g_hdMiniMapCity1 = city1;
    if (cursorX >= CITYMAP_W || cursorY >= CITYMAP_H || viewX >= CITYMAP_W || viewY >= CITYMAP_H ||
        !viewWidth || !viewHeight || city1 > CITY_MAX) complete = 0;
    g_hdMiniMapComplete = complete; g_hdMiniMapActive = 1;
    g_hdMiniMapSeq = hd_next_input_seq(g_hdMiniMapSeq);
}

void baye_hd_mini_map_clear(U32 generation, U32 inputSeq)
{
    if (generation == g_hdDetailGeneration && generation == g_hdMiniMapGeneration &&
        inputSeq == g_hdMiniMapInputSeq) baye_hd_mini_map_retire();
}

static U8 hd_tool_payload(U32* offsetOut, U32* lengthOut)
{
    U32 position, address, offset, length, namesAddress;
    RCHEAD header, namesHeader;
    RIDX item;
    U8 last, ok = 0;
    if (!g_LibFp || !g_CBnkPtr) return 0;
    position = gam_ftell(g_LibFp);
    if (!hd_detail_read_at(((U32)GOODS_RESID - 1) * 4, &address, sizeof(address)) ||
        !address || address == (U32)-1 || !hd_detail_read_at(address, &header, sizeof(header)) ||
        header.ResId != GOODS_RESID || !header.ItmCnt || header.ResKey || address > (U32)-1 - sizeof(header)) goto done;
    if (header.ItmLen) { offset = sizeof(header); length = header.ItmLen; }
    else if (header.ItmCnt == 1) {
        if (header.ResLen < sizeof(header)) goto done;
        offset = sizeof(header); length = header.ResLen - sizeof(header);
    } else {
        if (!hd_detail_read_at(address + sizeof(header), &item, sizeof(item))) goto done;
        offset = item.offset; length = item.rlen;
        if (offset < sizeof(header) + (U32)header.ItmCnt * sizeof(item)) goto done;
    }
    if (!length || length % sizeof(GOODS) || length / sizeof(GOODS) > GOODS_MAX ||
        offset > header.ResLen || length > header.ResLen - offset ||
        address > (U32)-1 - offset || address + offset > (U32)-1 - length) goto done;
    offset += address;
    if (!hd_detail_read_at(offset + length - 1, &last, 1)) goto done;
    if (!hd_detail_read_at(((U32)GOODS_NAME - 1) * 4, &namesAddress, sizeof(namesAddress)) ||
        !namesAddress || namesAddress == (U32)-1 ||
        !hd_detail_read_at(namesAddress, &namesHeader, sizeof(namesHeader)) ||
        namesHeader.ResId != GOODS_NAME || !namesHeader.ItmCnt || namesHeader.ItmCnt > GOODS_MAX ||
        namesHeader.ResLen < sizeof(namesHeader) || namesAddress > (U32)-1 - namesHeader.ResLen ||
        !hd_detail_read_at(namesAddress + namesHeader.ResLen - 1, &last, 1)) goto done;
    if (namesHeader.ItmLen) {
        if ((U32)namesHeader.ItmCnt > (namesHeader.ResLen - sizeof(namesHeader)) / namesHeader.ItmLen) goto done;
    } else if ((U32)namesHeader.ItmCnt * sizeof(RIDX) > namesHeader.ResLen - sizeof(namesHeader)) goto done;
    if ((U32)namesHeader.ItmCnt < length / sizeof(GOODS)) length = (U32)namesHeader.ItmCnt * sizeof(GOODS);
#ifdef __EMSCRIPTEN__
    if ((size_t)g_CBnkPtr > emscripten_get_heap_size() ||
        offset > emscripten_get_heap_size() - (size_t)g_CBnkPtr ||
        length > emscripten_get_heap_size() - (size_t)g_CBnkPtr - offset) goto done;
#endif
    *offsetOut = offset; *lengthOut = length; ok = 1;
done:
    hd_detail_restore(position);
    return ok;
}

U16 baye_hd_tool_count(void)
{
    U32 offset, length;
    return hd_tool_payload(&offset, &length) ? (U16)(length / sizeof(GOODS)) : 0;
}

const U8* baye_hd_tool_data(void)
{
    U32 offset, length;
    return hd_tool_payload(&offset, &length) ? g_CBnkPtr + offset : NULL;
}

U8 baye_hd_tool_read(U16 index, void* output)
{
    U32 offset, length;
    if (!output || !hd_tool_payload(&offset, &length) || index >= length / sizeof(GOODS)) return 0;
    memcpy(output, g_CBnkPtr + offset + (U32)index * sizeof(GOODS), sizeof(GOODS));
    return 1;
}

U16 baye_hd_person_arm(U16 person)
{
    U16 arm, equip;
    U8 i;
    GOODS tool;
    U32 count = GamGetPersonCount();
    if (person >= count || person >= PERSON_MAX) return 0xffff;
    arm = g_Persons[person].ArmsType;
    for (i = 0; i < 2; ++i) {
        equip = g_Persons[person].Equip[i];
        if (!equip) continue;
        if (!baye_hd_tool_read(equip - 1, &tool)) return 0xffff;
        switch (tool.arm) {
            case 0: break;
            case 1: arm = ARM_SHUIJUN; break;
            case 2: arm = ARM_XUANBING; break;
            case 3: arm = ARM_JIBING; break;
            default: arm = (U8)(tool.arm - 4); break;
        }
    }
    return arm;
}

void baye_hd_menu_ids(U32 generation, U32 seq, U8 kind, const U16* ids, U32 count)
{
    U32 i, limit = kind == BAYE_HD_MENU_GOODS ? baye_hd_tool_count() : GamGetPersonCount();
    if (generation != g_hdDetailGeneration || seq != g_hdMenuSeq || !g_hdMenuActive ||
        kind != g_hdMenuKind || !ids || !count || count > BAYE_HD_DETAIL_IDS_MAX ||
        count != g_hdMenuCount || !limit || (kind != BAYE_HD_MENU_PERSON && kind != BAYE_HD_MENU_GOODS)) return;
    for (i = 0; i < count; ++i) if (ids[i] >= limit || ids[i] >= BAYE_HD_DETAIL_IDS_MAX) return;
    memcpy(g_hdMenuIds, ids, count * sizeof(*ids));
    g_hdMenuIdsCount = (U16)count; g_hdMenuIdsKind = kind;
    g_hdMenuIdsGeneration = generation; g_hdMenuIdsSeq = seq;
}

static U8 hd_goods_owner(U32 generation, U32 seq)
{
    return generation == g_hdDetailGeneration && seq == g_hdMenuSeq && g_hdMenuActive &&
        g_hdMenuKind == BAYE_HD_MENU_GOODS && !g_hdReportActive && !g_hdHelpActive;
}

void baye_hd_goods_begin(U32 generation, U32 seq, U16 index, U16 tool, U16 properties, U16 pageStart, U8 custom)
{
    if (!hd_goods_owner(generation, seq)) return;
    if (index != g_hdGoodsIndex || tool != g_hdGoodsTool || seq != g_hdGoodsMenuSeq ||
        generation != g_hdGoodsGeneration || properties != g_hdGoodsPropertyCount) hd_goods_clear();
    if (tool >= baye_hd_tool_count() || properties >= BAYE_HD_GOODS_PROPS_MAX) return;
    g_hdGoodsGeneration = generation; g_hdGoodsMenuSeq = seq;
    g_hdGoodsIndex = index; g_hdGoodsTool = tool;
    g_hdGoodsPropertyCount = properties; g_hdGoodsPageStart = pageStart;
    g_hdGoodsCustom |= custom; g_hdGoodsActive = 1;
}

void baye_hd_goods_capture(U32 generation, U32 seq, U16 tool, U16 property, const U8* text, U8 title)
{
    U8* destination;
    if (!hd_goods_owner(generation, seq) || !g_hdGoodsActive || generation != g_hdGoodsGeneration ||
        seq != g_hdGoodsMenuSeq || tool != g_hdGoodsTool || property >= g_hdGoodsPropertyCount) return;
    destination = (title ? g_hdGoodsPropertyTitles : g_hdGoodsPropertyValues) + property * BAYE_HD_GOODS_TEXT_MAX;
    if (hd_detail_copy(destination, BAYE_HD_GOODS_TEXT_MAX, text, BAYE_HD_GOODS_TEXT_MAX))
        g_hdGoodsPropertyFlags[property] |= title ? 1 : 2;
    else g_hdGoodsPropertyFlags[property] &= title ? (U8)~1 : (U8)~2;
    g_hdGoodsComplete = 0;
}

void baye_hd_goods_name(U32 generation, U32 seq, U16 tool, const U8* name)
{
    if (hd_goods_owner(generation, seq) && g_hdGoodsActive && tool == g_hdGoodsTool)
        hd_detail_copy(g_hdGoodsNameGbk, sizeof(g_hdGoodsNameGbk), name, 32);
}

void baye_hd_goods_page(U32 generation, U32 seq, U16 end)
{
    U16 i;
    if (!hd_goods_owner(generation, seq) || !g_hdGoodsActive) return;
    g_hdGoodsPageEnd = end;
    g_hdGoodsComplete = 1;
    for (i = 0; i < g_hdGoodsPropertyCount; ++i)
        if (g_hdGoodsPropertyFlags[i] != 3) g_hdGoodsComplete = 0;
}

void baye_hd_goods_custom(U32 generation, U32 seq, U16 tool)
{
    if (hd_goods_owner(generation, seq) && g_hdGoodsActive && tool == g_hdGoodsTool)
        g_hdGoodsCustom = 1;
}

void baye_hd_set_ready(U8 ready)
{
    baye_hd_view_retire();
    baye_hd_mini_map_retire();
    /* A new LIB/game may share this browser. Invalidate old input tokens. */
    baye_hd_spe_invalidate();
    g_hdDetailGeneration = hd_next_input_seq(g_hdDetailGeneration);
    hd_menu_ids_clear();
    hd_help_detail_clear();
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
    baye_hd_attack_retire();
    baye_hd_view_retire();
    baye_hd_mini_map_retire();
    hd_menu_ids_clear();
    hd_help_detail_clear();
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
    g_hdMenuIdsCount = g_hdMenuIdsKind = 0;
    g_hdMenuIdsSeq = g_hdMenuIdsGeneration = 0;
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
    if (index != g_hdGoodsIndex) hd_goods_clear();
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
    baye_hd_attack_retire();
    baye_hd_view_retire();
    baye_hd_mini_map_retire();
    hd_menu_ids_clear();
    hd_help_detail_clear();
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
    if (kind != BAYE_HD_FIGHT_INPUT_VIEW) baye_hd_view_retire();
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
    baye_hd_view_retire();
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
    baye_hd_mini_map_retire();
    g_hdMapInputSeq = hd_next_input_seq(g_hdMapInputSeq);
}

void baye_hd_menu_scope(U8 context, U8 kind)
{
    hd_menu_ids_clear();
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
    baye_hd_view_retire();
    baye_hd_mini_map_retire();
    hd_menu_ids_clear();
    hd_help_detail_clear();
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
    hd_menu_ids_clear();
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
    baye_hd_mini_map_retire();
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

static void hd_help_notify(const U8* gbk)
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

static void hd_picture_publish(const HdPictureSource* info, U8 target)
{
    HdPictureSource empty;
    if (!info) { memset(&empty, 0, sizeof(empty)); info = &empty; }
    switch (target) {
    case 0:
        g_hdSpeBgValid = info->valid;
        g_hdSpeBgId = info->id;
        g_hdSpeBgResourceIndex = info->resourceIndex;
        g_hdSpeBgPictureIndex = info->pictureIndex;
        g_hdSpeBgWidth = info->width;
        g_hdSpeBgHeight = info->height;
        g_hdSpeBgCount = info->count;
        g_hdSpeBgMask = info->mask;
        g_hdSpeBgOriginX = info->x;
        g_hdSpeBgOriginY = info->y;
        g_hdSpeBgResourceFingerprint = info->resourceFingerprint;
        g_hdSpeBgResourceLength = info->resourceLength;
        break;
    case 1:
        g_hdSpeDisplayBgValid = info->valid;
        g_hdSpeDisplayBgId = info->id;
        g_hdSpeDisplayBgResourceIndex = info->resourceIndex;
        g_hdSpeDisplayBgPictureIndex = info->pictureIndex;
        g_hdSpeDisplayBgWidth = info->width;
        g_hdSpeDisplayBgHeight = info->height;
        g_hdSpeDisplayBgCount = info->count;
        g_hdSpeDisplayBgMask = info->mask;
        g_hdSpeDisplayBgOriginX = info->x;
        g_hdSpeDisplayBgOriginY = info->y;
        g_hdSpeDisplayBgResourceFingerprint = info->resourceFingerprint;
        g_hdSpeDisplayBgResourceLength = info->resourceLength;
        break;
    case 2:
        g_hdAttackBgValid = info->valid;
        g_hdAttackBgId = info->id;
        g_hdAttackBgResourceIndex = info->resourceIndex;
        g_hdAttackBgPictureIndex = info->pictureIndex;
        g_hdAttackBgWidth = info->width;
        g_hdAttackBgHeight = info->height;
        g_hdAttackBgCount = info->count;
        g_hdAttackBgMask = info->mask;
        g_hdAttackBgOriginX = info->x;
        g_hdAttackBgOriginY = info->y;
        g_hdAttackBgResourceFingerprint = info->resourceFingerprint;
        g_hdAttackBgResourceLength = info->resourceLength;
        break;
    case 3:
        g_hdAttackDisplayBgValid = info->valid;
        g_hdAttackDisplayBgId = info->id;
        g_hdAttackDisplayBgResourceIndex = info->resourceIndex;
        g_hdAttackDisplayBgPictureIndex = info->pictureIndex;
        g_hdAttackDisplayBgWidth = info->width;
        g_hdAttackDisplayBgHeight = info->height;
        g_hdAttackDisplayBgCount = info->count;
        g_hdAttackDisplayBgMask = info->mask;
        g_hdAttackDisplayBgOriginX = info->x;
        g_hdAttackDisplayBgOriginY = info->y;
        g_hdAttackDisplayBgResourceFingerprint = info->resourceFingerprint;
        g_hdAttackDisplayBgResourceLength = info->resourceLength;
        break;
    case 4:
        g_hdAttackNumberValid = info->valid;
        g_hdAttackNumberId = info->id;
        g_hdAttackNumberResourceIndex = info->resourceIndex;
        g_hdAttackNumberPictureIndex = info->pictureIndex;
        g_hdAttackNumberWidth = info->width;
        g_hdAttackNumberHeight = info->height;
        g_hdAttackNumberCount = info->count;
        g_hdAttackNumberMask = info->mask;
        g_hdAttackNumberOriginX = info->x;
        g_hdAttackNumberOriginY = info->y;
        g_hdAttackNumberResourceFingerprint = info->resourceFingerprint;
        g_hdAttackNumberResourceLength = info->resourceLength;
        break;
    }
}

static void hd_spe_notify(void)
{
    EM_ASM({
        try {
            if (window.BayeHdSpe && typeof BayeHdSpe.onEngineSpe === 'function') {
                BayeHdSpe.onEngineSpe();
            }
            if (window.BayeHdSystemUi && typeof BayeHdSystemUi.onEngineMaker === 'function') {
                BayeHdSystemUi.onEngineMaker();
            }
        } catch (e) {}
    });
}

static U8 hd_attack_drawing_supported(void)
{
    /* Default native bitmaps use only palette indices 0 and 255. */
    return !g_FlipDrawing && g_paintColor == 0xff &&
        g_paintPalette[0] == 0x00ffffffu && g_paintPalette[255] == 0xff000000u;
}

void baye_hd_attack_retire(void)
{
    g_hdAttackSourceValid = g_hdAttackDisplayValid = 0;
    hdAttackPaint.valid = 0;
    hdBackgroundPending.valid = 0;
    hdBackgroundSession = hdBackgroundDrawing = hdAttackDigitSession = 0;
    if (hdSpeCurrent) hdSpeCurrent->compositionValid = 0;
    hdSpeCopied.compositionValid = 0;
    g_hdSpeCompositionValid = g_hdSpeDisplayCompositionValid = 0;
}

U32 baye_hd_attack_begin(U8 actor, U8 target, U16 hurt, U8 custom)
{
    U32 session;
    /* Reentrant attacks retire the older observer; its stale unwind cannot
     * close this newer native owner or restore the older surface. */
    baye_hd_attack_retire();
    g_hdAttackSession = hd_next_input_seq(g_hdAttackSession);
    session = g_hdAttackSession;
    g_hdAttackGeneration = g_hdSpeGeneration;
    g_hdAttackActive = 1; g_hdAttackPhase = BAYE_HD_ATTACK_MOVIE;
    g_hdAttackActorIndex = actor < FGTA_MAX ? actor : 0xff;
    g_hdAttackTargetIndex = target < FGTA_MAX ? target : 0xff;
    g_hdAttackHurt = hurt; g_hdAttackCustom = custom != 0;
    g_hdAttackSourceValid = !custom && actor < FGTA_MAX && target < FGTA_MAX &&
        !hdSpeCurrent && hd_attack_drawing_supported();
    g_hdAttackEventId = g_hdAttackCommitSeq = g_hdAttackPaintSeq = 0;
    g_hdAttackFrameIndex = BAYE_HD_SPE_NO_FRAME;
    g_hdAttackId = g_hdAttackResourceIndex = g_hdAttackCount = g_hdAttackPicmax = 0;
    g_hdAttackStartFrm = g_hdAttackEndFrm = g_hdAttackDigitCount = 0;
    g_hdAttackOriginX = g_hdAttackOriginY = 0;
    g_hdAttackResourceFingerprint = g_hdAttackResourceLength = 0;
    memset(g_hdAttackVisibleFrames, 0, sizeof(g_hdAttackVisibleFrames));
    memset(g_hdAttackClearFrames, 0, sizeof(g_hdAttackClearFrames));
    memset(g_hdAttackDigitIndex, 0, sizeof(g_hdAttackDigitIndex));
    memset(g_hdAttackDigitX, 0, sizeof(g_hdAttackDigitX));
    memset(g_hdAttackDigitY, 0, sizeof(g_hdAttackDigitY));
    memset(g_hdAttackDigitFirstY, 0, sizeof(g_hdAttackDigitFirstY));
    memset(g_hdAttackDigitDrawCount, 0, sizeof(g_hdAttackDigitDrawCount));
    memset(&hdAttackScene, 0, sizeof(hdAttackScene));
    memset(&hdAttackPaint, 0, sizeof(hdAttackPaint));
    hd_picture_publish(NULL, 2); hd_picture_publish(NULL, 3); hd_picture_publish(NULL, 4);
    hd_spe_notify();
    return session;
}

void baye_hd_attack_numbers(U32 session)
{
    if (!g_hdAttackActive || session != g_hdAttackSession || g_hdAttackGeneration != g_hdSpeGeneration) return;
    g_hdAttackPhase = BAYE_HD_ATTACK_NUMBERS;
    if (!g_hdAttackEventId || !hdAttackScene.frameValid || !hdAttackScene.compositionValid)
        baye_hd_attack_retire();
    hd_spe_notify();
}

void baye_hd_attack_hold(U32 session)
{
    if (!g_hdAttackActive || session != g_hdAttackSession || g_hdAttackGeneration != g_hdSpeGeneration) return;
    g_hdAttackPhase = BAYE_HD_ATTACK_HOLD;
    hd_spe_notify();
}

void baye_hd_attack_end(U32 session)
{
    if (session != g_hdAttackSession) return;
    baye_hd_attack_retire();
    g_hdAttackActive = g_hdAttackPhase = 0;
    hd_spe_notify();
}

void baye_hd_background_begin(void)
{
    memset(&hdBackgroundPending, 0, sizeof(hdBackgroundPending));
    hdBackgroundSession = 0;
    hdBackgroundDrawing = g_hdAttackActive && g_hdAttackSourceValid &&
        g_hdAttackPhase == BAYE_HD_ATTACK_MOVIE && !g_hdAttackEventId && !hdSpeCurrent ? g_hdAttackSession : 0;
}

void baye_hd_background_end(const HdPictureSource* info)
{
    if (hdBackgroundDrawing && hdBackgroundDrawing == g_hdAttackSession &&
        g_hdAttackActive && g_hdAttackSourceValid && g_hdAttackGeneration == g_hdSpeGeneration &&
        info && info->valid && info->id == SPE_BACKPIC && hd_attack_drawing_supported()) {
        hdBackgroundPending = *info;
        hdBackgroundSession = g_hdAttackSession;
    } else if (g_hdAttackActive) baye_hd_attack_retire();
    hdBackgroundDrawing = 0;
}

void baye_hd_spe_draw_begin(HdSpeScope* scope)
{
    hdSpeDrawing = scope == hdSpeCurrent ? scope : NULL;
    hdSpeDrawingGeneration = scope ? scope->generation : 0;
}

void baye_hd_spe_draw_end(HdSpeScope* scope)
{
    if (hdSpeDrawing == scope) hdSpeDrawing = NULL;
}

void baye_hd_spe_clear(HdSpeScope* scope, U16 absoluteUnit)
{
    if (scope == hdSpeCurrent && scope->generation == g_hdSpeGeneration &&
        scope->compositionValid && absoluteUnit >= scope->startFrm && absoluteUnit <= scope->endFrm &&
        absoluteUnit < 256) scope->clearFrames[absoluteUnit >> 3] |= (U8)(1u << (absoluteUnit & 7));
}

void baye_hd_attack_number_resource(const HdPictureSource* info)
{
    HdPictureSource resource;
    U8 changed = info && g_hdAttackDigitCount &&
        (info->resourceFingerprint != g_hdAttackNumberResourceFingerprint ||
         info->resourceLength != g_hdAttackNumberResourceLength);
    if (info) { resource = *info; resource.pictureIndex = 0; }
    hd_picture_publish(info ? &resource : NULL, 4);
    if (g_hdAttackActive && (!info || !info->valid || info->id != NUM_PICID ||
        info->pictureIndex >= 10 || info->count != 10 || info->mask != 0 ||
        changed)) baye_hd_attack_retire();
}

void baye_hd_attack_digit_begin(U8 slot, U8 digit, I16 x, I16 y)
{
    hdAttackDigitSession = 0; hdAttackDigitWritten = 0;
    if (!g_hdAttackActive || g_hdAttackPhase != BAYE_HD_ATTACK_NUMBERS || !g_hdAttackSourceValid) return;
    if (slot >= BAYE_HD_ATTACK_DIGITS || digit >= 10 || !g_hdAttackNumberValid ||
        !hd_attack_drawing_supported() || slot > g_hdAttackDigitCount ||
        (g_hdAttackDigitDrawCount[slot] && (g_hdAttackDigitIndex[slot] != digit ||
        g_hdAttackDigitX[slot] != x || y != g_hdAttackDigitFirstY[slot] - g_hdAttackDigitDrawCount[slot]))) {
        baye_hd_attack_retire(); return;
    }
    hdAttackDigitSession = g_hdAttackSession;
    hdAttackDigitSlot = slot; hdAttackDigitValue = digit;
    hdAttackDigitX = x; hdAttackDigitY = y;
}

static void hd_attack_paint_snapshot(void)
{
    hdAttackPaint.valid = g_hdAttackSourceValid && hdAttackScene.compositionValid;
    hdAttackPaint.generation = g_hdAttackGeneration; hdAttackPaint.session = g_hdAttackSession;
    hdAttackPaint.paintSeq = g_hdAttackPaintSeq; hdAttackPaint.count = g_hdAttackDigitCount;
    hdAttackPaint.scene = hdAttackScene;
    memcpy(hdAttackPaint.index, g_hdAttackDigitIndex, sizeof(hdAttackPaint.index));
    memcpy(hdAttackPaint.x, g_hdAttackDigitX, sizeof(hdAttackPaint.x));
    memcpy(hdAttackPaint.y, g_hdAttackDigitY, sizeof(hdAttackPaint.y));
    memcpy(hdAttackPaint.firstY, g_hdAttackDigitFirstY, sizeof(hdAttackPaint.firstY));
    memcpy(hdAttackPaint.drawCount, g_hdAttackDigitDrawCount, sizeof(hdAttackPaint.drawCount));
}

void baye_hd_attack_digit_end(void)
{
    U8 slot = hdAttackDigitSlot;
    if (hdAttackDigitSession && hdAttackDigitSession == g_hdAttackSession && g_hdAttackActive &&
        g_hdAttackSourceValid && hdAttackDigitWritten && hd_attack_drawing_supported()) {
        if (!g_hdAttackDigitDrawCount[slot]) g_hdAttackDigitFirstY[slot] = hdAttackDigitY;
        g_hdAttackDigitIndex[slot] = hdAttackDigitValue;
        g_hdAttackDigitX[slot] = hdAttackDigitX; g_hdAttackDigitY[slot] = hdAttackDigitY;
        ++g_hdAttackDigitDrawCount[slot];
        if (g_hdAttackDigitCount <= slot) g_hdAttackDigitCount = slot + 1;
        g_hdAttackPaintSeq = hd_next_input_seq(g_hdAttackPaintSeq);
        hd_attack_paint_snapshot();
    } else if (hdAttackDigitSession) baye_hd_attack_retire();
    hdAttackDigitSession = 0;
}

void baye_hd_surface_write(U8 virtualScreen)
{
    if (!hd_attack_drawing_supported()) {
        baye_hd_attack_retire();
    }
    if (virtualScreen) {
        if (hdSpeDrawing && hdSpeDrawing == hdSpeCurrent && hdSpeDrawingGeneration == g_hdSpeGeneration) return;
        if (hdBackgroundDrawing && hdBackgroundDrawing == g_hdAttackSession && g_hdAttackSourceValid) return;
        baye_hd_attack_retire();
    } else if (hdAttackDigitSession && hdAttackDigitSession == g_hdAttackSession &&
        g_hdAttackSourceValid && g_hdAttackGeneration == g_hdSpeGeneration) {
        hdAttackDigitWritten = 1;
        memset(&hdSpeCopied, 0, sizeof(hdSpeCopied));
        hdSpeCopied.frameIndex = BAYE_HD_SPE_NO_FRAME;
    } else baye_hd_spe_lcd_dirty();
}

U32 baye_hd_maker_begin(U8 custom)
{
    g_hdMakerSession = hd_next_input_seq(g_hdMakerSession);
    g_hdMakerGeneration = g_hdSpeGeneration;
    g_hdMakerInputSeq = 1;
    g_hdMakerActive = 1;
    g_hdMakerPhase = BAYE_HD_MAKER_SCROLL;
    g_hdMakerCustom = custom != 0;
    g_hdMakerReturnEligible = g_hdMakerSourceValid = 0;
    g_hdMakerEventId = g_hdMakerCommitSeq = 0;
    g_hdMakerResourceFingerprint = g_hdMakerResourceLength = 0;
    g_hdMakerResourceIndex = g_hdMakerCount = g_hdMakerPicmax = 0;
    g_hdMakerFrameIndex = BAYE_HD_SPE_NO_FRAME;
    g_hdMakerOriginX = g_hdMakerOriginY = 0;
    g_hdMakerStartFrm = g_hdMakerEndFrm = 0;
    g_hdMakerEndReason = 0; g_hdMakerEndKey = 0xff;
    memset(g_hdMakerVisibleFrames, 0, sizeof(g_hdMakerVisibleFrames));
    hd_spe_notify();
    return g_hdMakerSession;
}

void baye_hd_maker_hold(U32 session)
{
    if (!g_hdMakerActive || session != g_hdMakerSession ||
        g_hdMakerGeneration != g_hdSpeGeneration || g_hdMakerPhase != BAYE_HD_MAKER_SCROLL) return;
    g_hdMakerPhase = BAYE_HD_MAKER_HOLD;
    g_hdMakerInputSeq = hd_next_input_seq(g_hdMakerInputSeq);
    g_hdMakerReturnEligible = 1;
    hd_spe_notify();
}

void baye_hd_maker_end(U32 session)
{
    if (session != g_hdMakerSession) return;
    g_hdMakerActive = g_hdMakerPhase = g_hdMakerReturnEligible = g_hdMakerSourceValid = 0;
    g_hdMakerInputSeq = 0;
    hd_spe_notify();
}

static void hd_maker_spe_end(const HdSpeScope* scope, U8 reason, U8 key)
{
    if (!g_hdMakerActive || g_hdMakerPhase != BAYE_HD_MAKER_SCROLL ||
        g_hdMakerGeneration != scope->generation || g_hdMakerEventId != scope->eventId) return;
    g_hdMakerResourceIndex = scope->resourceIndex;
    g_hdMakerCount = scope->count; g_hdMakerPicmax = scope->picmax;
    g_hdMakerResourceFingerprint = scope->resourceFingerprint;
    g_hdMakerResourceLength = scope->resourceLength;
    g_hdMakerOriginX = scope->x; g_hdMakerOriginY = scope->y;
    g_hdMakerStartFrm = scope->startFrm; g_hdMakerEndFrm = scope->endFrm;
    g_hdMakerEndReason = reason; g_hdMakerEndKey = key;
    g_hdMakerSourceValid = !g_hdMakerCustom && scope->ready && scope->protocolValid &&
        (reason == BAYE_HD_SPE_END_COMPLETE || reason == BAYE_HD_SPE_END_KEY) &&
        hdSpeCopied.frameValid && hdSpeCopied.generation == scope->generation &&
        hdSpeCopied.eventId == scope->eventId && hdSpeCopied.commitSeq > 0 &&
        hdSpeCopied.commitSeq <= scope->commitSeq && hdSpeCopied.frameIndex >= scope->startFrm &&
        hdSpeCopied.frameIndex <= scope->endFrm;
    if (g_hdMakerSourceValid) {
        g_hdMakerCommitSeq = hdSpeCopied.commitSeq;
        g_hdMakerFrameIndex = hdSpeCopied.frameIndex;
        memcpy(g_hdMakerVisibleFrames, hdSpeCopied.visibleFrames, sizeof(g_hdMakerVisibleFrames));
    }
}

void baye_hd_set_help(const U8* gbk)
{
    baye_hd_view_retire();
    baye_hd_mini_map_retire();
    hd_menu_ids_clear();
    hd_help_detail_clear();
    hd_help_notify(gbk);
}

void baye_hd_help_publish(const HdHelpSnapshot* snapshot, const U8* text)
{
    if (!snapshot || snapshot->generation != g_hdDetailGeneration ||
        g_hdFightInputKind != BAYE_HD_FIGHT_INPUT_HELP) return;
    hd_menu_ids_clear();
    hd_help_detail_clear();
    g_hdHelpGeneration = snapshot->generation;
    g_hdHelpInputSeq = g_hdFightInputSeq;
    g_hdHelpKind = snapshot->kind;
    g_hdHelpPerson = snapshot->person; g_hdHelpSlot = snapshot->slot;
    g_hdHelpX = snapshot->x; g_hdHelpY = snapshot->y; g_hdHelpTerrain = snapshot->terrain;
    g_hdHelpLevelMax = snapshot->levelMax;
    memcpy(g_hdHelpFields, snapshot->fields, sizeof(g_hdHelpFields));
    g_hdHelpComplete = snapshot->complete &&
        hd_detail_copy(g_hdHelpNameGbk, sizeof(g_hdHelpNameGbk), snapshot->name, sizeof(snapshot->name)) &&
        hd_detail_copy(g_hdHelpArmGbk, sizeof(g_hdHelpArmGbk), snapshot->arm, sizeof(snapshot->arm)) &&
        hd_detail_copy(g_hdHelpStateGbk, sizeof(g_hdHelpStateGbk), snapshot->state, sizeof(snapshot->state));
    if (g_hdHelpKind == BAYE_HD_HELP_PERSON &&
        (g_hdHelpPerson >= GamGetPersonCount() || g_hdHelpPerson >= PERSON_MAX || g_hdHelpSlot >= FGTA_MAX))
        g_hdHelpComplete = 0;
    if (g_hdHelpX >= g_MapWid || g_hdHelpY >= g_MapHgt) g_hdHelpComplete = 0;
    if (g_hdHelpKind == BAYE_HD_HELP_TERRAIN &&
        (g_hdHelpX >= g_MapWid || g_hdHelpY >= g_MapHgt || g_hdHelpTerrain >= TERRAIN_MAX))
        g_hdHelpComplete = 0;
    if (!text || !text[0] || gam_strlen(text) >= BAYE_HD_HELP_MAX) g_hdHelpComplete = 0;
    hd_help_notify(text);
}

void baye_hd_help_clear(U32 generation, U32 inputSeq)
{
    if (generation == g_hdDetailGeneration && generation == g_hdHelpGeneration &&
        inputSeq == g_hdHelpInputSeq) baye_hd_set_help(NULL);
}

static void hd_spe_publish(const HdSpeScope* scope)
{
    g_hdSpeCompositionValid = scope ? scope->compositionValid : 0;
    hd_picture_publish(scope ? &scope->background : NULL, 0);
    if (scope) memcpy(g_hdSpeClearFrames, scope->clearFrames, sizeof(g_hdSpeClearFrames));
    else memset(g_hdSpeClearFrames, 0, sizeof(g_hdSpeClearFrames));
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
    if (g_hdAttackActive) {
        if (!g_hdAttackEventId && g_hdAttackPhase == BAYE_HD_ATTACK_MOVIE &&
            g_hdAttackSourceValid && g_hdAttackGeneration == scope->generation && scope->depth == 1 &&
            scope->kind == BAYE_HD_SPE_KIND_ATTACK && scope->contextKnown && scope->keyflag == 0 &&
            scope->actorIndex == g_hdAttackActorIndex && scope->targetIndex == g_hdAttackTargetIndex &&
            hdBackgroundPending.valid && hdBackgroundSession == g_hdAttackSession) {
            scope->background = hdBackgroundPending;
            scope->compositionValid = 1;
            g_hdAttackEventId = scope->eventId;
        } else baye_hd_attack_retire();
    }
    hdBackgroundPending.valid = 0; hdBackgroundSession = 0;
    if (hdSpeCurrent) {
        hdSpeCurrent->compositionValid = 0;
        hdSpeCopied.compositionValid = 0;
    }
    hdSpeCurrent = scope;
    hdSpeCopyPending = NULL;
    if (g_hdMakerActive && g_hdMakerPhase == BAYE_HD_MAKER_SCROLL && !g_hdMakerEventId &&
        g_hdMakerGeneration == scope->generation && id == MAKER_SPE && resourceIndex == 0 &&
        scope->depth == 1 && scope->kind == BAYE_HD_SPE_KIND_OPENING && keyflag == 1)
        g_hdMakerEventId = scope->eventId;
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
    if (!scope->protocolValid) {
        scope->compositionValid = 0;
        if (g_hdAttackActive) baye_hd_attack_retire();
    }
    if (scope->compositionValid && !hd_attack_drawing_supported()) baye_hd_attack_retire();
    if (g_hdAttackActive && g_hdAttackEventId == scope->eventId &&
        g_hdAttackGeneration == scope->generation) {
        g_hdAttackId = scope->id; g_hdAttackResourceIndex = scope->resourceIndex;
        g_hdAttackCount = scope->count; g_hdAttackPicmax = scope->picmax;
        g_hdAttackStartFrm = scope->startFrm; g_hdAttackEndFrm = scope->endFrm;
        g_hdAttackOriginX = scope->x; g_hdAttackOriginY = scope->y;
        g_hdAttackResourceFingerprint = scope->resourceFingerprint;
        g_hdAttackResourceLength = scope->resourceLength;
    }
    hd_spe_publish(scope);
}

void baye_hd_spe_frame(HdSpeScope* scope, U16 frameIndex, const U8* remaining, U16 introduced)
{
    U16 i;
    if (scope != hdSpeCurrent || scope->generation != g_hdSpeGeneration || !scope->ready ||
        !remaining || frameIndex < scope->startFrm || frameIndex > scope->endFrm ||
        introduced != frameIndex - scope->startFrm + 1) return;
    scope->frameIndex = frameIndex;
    if (g_FlipDrawing || g_paintColor != 0xff) {
        scope->protocolValid = scope->compositionValid = 0;
        baye_hd_attack_retire();
    }
    scope->frameValid = 1;
    if (scope->compositionValid && !hd_attack_drawing_supported()) baye_hd_attack_retire();
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
    hd_maker_spe_end(scope, reason, key);
    if (g_hdAttackActive && g_hdAttackEventId == scope->eventId &&
        (reason != BAYE_HD_SPE_END_COMPLETE || !scope->compositionValid || !hdAttackScene.compositionValid))
        baye_hd_attack_retire();
    hdSpeCurrent = scope->previous;
    hdSpeCopyPending = NULL;
    if (hdSpeCurrent) {
        /* An inner call may have replaced g_VisScr. Do not replay an old
         * parent picture; the next native copy must establish a fresh frame. */
        hdSpeCurrent->frameValid = 0;
        hdSpeCurrent->compositionValid = 0;
        hdSpeCurrent->frameIndex = BAYE_HD_SPE_NO_FRAME;
        memset(hdSpeCurrent->visibleFrames, 0, sizeof(hdSpeCurrent->visibleFrames));
    }
    hd_spe_publish(hdSpeCurrent);
    hd_spe_notify();
}

void baye_hd_spe_lcd_dirty(void)
{
    baye_hd_attack_retire();
    /* Late assets or a resize cannot restore a held LCD after another draw. */
    if (g_hdMakerPhase == BAYE_HD_MAKER_HOLD) g_hdMakerSourceValid = 0;
    memset(&hdSpeCopied, 0, sizeof(hdSpeCopied));
    hdSpeCopied.frameIndex = BAYE_HD_SPE_NO_FRAME;
}

void baye_hd_spe_lcd_copy(void)
{
    if (g_hdMakerPhase == BAYE_HD_MAKER_HOLD) g_hdMakerSourceValid = 0;
    /* A controlled copy replaces LCD bytes with the actual current scope.
     * It is not an arbitrary dirty write and must not retire its own source. */
    if (!(hdSpeCopyPending && hdSpeCopyPending == hdSpeCurrent &&
        hdSpeCurrent->generation == g_hdSpeGeneration && hdSpeCurrent->frameValid)) {
        baye_hd_spe_lcd_dirty();
    }
    memset(&hdSpeCopied, 0, sizeof(hdSpeCopied));
    hdSpeCopied.frameIndex = BAYE_HD_SPE_NO_FRAME;
    if (hdSpeCopyPending && hdSpeCopyPending == hdSpeCurrent &&
        hdSpeCurrent->generation == g_hdSpeGeneration && hdSpeCurrent->frameValid) {
        hdSpeCopied.generation = hdSpeCurrent->generation;
        hdSpeCopied.eventId = hdSpeCurrent->eventId;
        hdSpeCopied.commitSeq = hdSpeCurrent->commitSeq;
        hdSpeCopied.frameIndex = hdSpeCurrent->frameIndex;
        hdSpeCopied.frameValid = 1;
        memcpy(hdSpeCopied.visibleFrames, hdSpeCurrent->visibleFrames, sizeof(hdSpeCopied.visibleFrames));
        hdSpeCopied.compositionValid = hdSpeCurrent->compositionValid;
        hdSpeCopied.background = hdSpeCurrent->background;
        memcpy(hdSpeCopied.clearFrames, hdSpeCurrent->clearFrames, sizeof(hdSpeCopied.clearFrames));
        if (g_hdAttackActive && g_hdAttackSourceValid && g_hdAttackGeneration == hdSpeCopied.generation &&
            g_hdAttackEventId == hdSpeCopied.eventId && hdSpeCopied.compositionValid) {
            hdAttackScene = hdSpeCopied;
            g_hdAttackCommitSeq = hdSpeCopied.commitSeq; g_hdAttackFrameIndex = hdSpeCopied.frameIndex;
            memcpy(g_hdAttackVisibleFrames, hdSpeCopied.visibleFrames, sizeof(g_hdAttackVisibleFrames));
            memcpy(g_hdAttackClearFrames, hdSpeCopied.clearFrames, sizeof(g_hdAttackClearFrames));
            hd_picture_publish(&hdSpeCopied.background, 2);
            hd_attack_paint_snapshot();
        }
    }
    hdSpeCopyPending = NULL;
}

void baye_hd_spe_lcd_flush(void)
{
    if (!hd_attack_drawing_supported()) baye_hd_attack_retire();
    g_hdSpeDisplayCompositionValid = hdSpeCopied.compositionValid;
    hd_picture_publish(&hdSpeCopied.background, 1);
    memcpy(g_hdSpeDisplayClearFrames, hdSpeCopied.clearFrames, sizeof(g_hdSpeDisplayClearFrames));
    g_hdSpeDisplayGeneration = hdSpeCopied.generation;
    g_hdSpeDisplayEventId = hdSpeCopied.eventId;
    g_hdSpeDisplayCommitSeq = hdSpeCopied.commitSeq;
    g_hdSpeDisplayFrameIndex = hdSpeCopied.frameIndex;
    g_hdSpeDisplayFrameValid = hdSpeCopied.frameValid;
    memcpy(g_hdSpeDisplayVisibleFrames, hdSpeCopied.visibleFrames, sizeof(g_hdSpeDisplayVisibleFrames));
    g_hdAttackDisplayValid = g_hdAttackActive && g_hdAttackSourceValid && hdAttackPaint.valid &&
        hdAttackPaint.generation == g_hdAttackGeneration && hdAttackPaint.generation == g_hdSpeGeneration &&
        hdAttackPaint.session == g_hdAttackSession;
    g_hdAttackDisplayGeneration = hdAttackPaint.generation;
    g_hdAttackDisplaySession = hdAttackPaint.session; g_hdAttackDisplayPaintSeq = hdAttackPaint.paintSeq;
    g_hdAttackDisplayEventId = hdAttackPaint.scene.eventId;
    g_hdAttackDisplayCommitSeq = hdAttackPaint.scene.commitSeq;
    g_hdAttackDisplayFrameIndex = hdAttackPaint.scene.frameIndex;
    g_hdAttackDisplayDigitCount = hdAttackPaint.count;
    hd_picture_publish(&hdAttackPaint.scene.background, 3);
    memcpy(g_hdAttackDisplayVisibleFrames, hdAttackPaint.scene.visibleFrames, sizeof(g_hdAttackDisplayVisibleFrames));
    memcpy(g_hdAttackDisplayClearFrames, hdAttackPaint.scene.clearFrames, sizeof(g_hdAttackDisplayClearFrames));
    memcpy(g_hdAttackDisplayDigitIndex, hdAttackPaint.index, sizeof(g_hdAttackDisplayDigitIndex));
    memcpy(g_hdAttackDisplayDigitX, hdAttackPaint.x, sizeof(g_hdAttackDisplayDigitX));
    memcpy(g_hdAttackDisplayDigitY, hdAttackPaint.y, sizeof(g_hdAttackDisplayDigitY));
    memcpy(g_hdAttackDisplayDigitFirstY, hdAttackPaint.firstY, sizeof(g_hdAttackDisplayDigitFirstY));
    memcpy(g_hdAttackDisplayDigitDrawCount, hdAttackPaint.drawCount, sizeof(g_hdAttackDisplayDigitDrawCount));
}

void baye_hd_spe_invalidate(void)
{
    if (hdSpeCurrent) {
        g_hdSpeLastEndedId = hdSpeCurrent->eventId;
        g_hdSpeEndReason = BAYE_HD_SPE_END_RESET; g_hdSpeEndKey = 0xff;
    }
    hdSpeCurrent = hdSpeCopyPending = NULL;
    hdSpeDrawing = NULL;
    baye_hd_attack_end(g_hdAttackSession);
    baye_hd_maker_end(g_hdMakerSession);
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
    if (!active) baye_hd_mini_map_retire();
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
    DEFADDF(g_hdDetailGeneration, U32);
    DEFADD_U16ARR(g_hdMenuIds, BAYE_HD_DETAIL_IDS_MAX);
    DEFADDF(g_hdMenuIdsCount, U16);
    DEFADDF(g_hdMenuIdsKind, U8);
    DEFADDF(g_hdMenuIdsSeq, U32);
    DEFADDF(g_hdMenuIdsGeneration, U32);
    DEFADDF(g_hdGoodsActive, U8);
    DEFADDF(g_hdGoodsComplete, U8);
    DEFADDF(g_hdGoodsCustom, U8);
    DEFADDF(g_hdGoodsGeneration, U32);
    DEFADDF(g_hdGoodsMenuSeq, U32);
    DEFADDF(g_hdGoodsIndex, U16);
    DEFADDF(g_hdGoodsTool, U16);
    DEFADDF(g_hdGoodsPropertyCount, U16);
    DEFADDF(g_hdGoodsPageStart, U16);
    DEFADDF(g_hdGoodsPageEnd, U16);
    DEFADD_GBKARR(g_hdGoodsNameGbk, sizeof(g_hdGoodsNameGbk));
    DEFADD_U8ARR(g_hdGoodsPropertyTitles, sizeof(g_hdGoodsPropertyTitles));
    DEFADD_U8ARR(g_hdGoodsPropertyValues, sizeof(g_hdGoodsPropertyValues));
    DEFADD_U8ARR(g_hdGoodsPropertyFlags, sizeof(g_hdGoodsPropertyFlags));
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
    DEFADDF(g_hdHelpProtocolVersion, U8);
    DEFADDF(g_hdHelpGeneration, U32);
    DEFADDF(g_hdHelpInputSeq, U32);
    DEFADDF(g_hdHelpKind, U8);
    DEFADDF(g_hdHelpComplete, U8);
    DEFADDF(g_hdHelpPerson, U16);
    DEFADDF(g_hdHelpSlot, U8);
    DEFADDF(g_hdHelpX, U8);
    DEFADDF(g_hdHelpY, U8);
    DEFADDF(g_hdHelpTerrain, U8);
    DEFADDF(g_hdHelpLevelMax, U8);
    DEFADD_U16ARR(g_hdHelpFields, 10);
    DEFADD_GBKARR(g_hdHelpNameGbk, sizeof(g_hdHelpNameGbk));
    DEFADD_GBKARR(g_hdHelpArmGbk, sizeof(g_hdHelpArmGbk));
    DEFADD_GBKARR(g_hdHelpStateGbk, sizeof(g_hdHelpStateGbk));
    DEFADDF(g_hdViewProtocolVersion, U8);
    DEFADDF(g_hdViewActive, U8);
    DEFADDF(g_hdViewComplete, U8);
    DEFADDF(g_hdViewCustom, U8);
    DEFADDF(g_hdViewSeq, U32);
    DEFADDF(g_hdViewGeneration, U32);
    DEFADDF(g_hdViewInputSeq, U32);
    DEFADDF(g_hdViewForce, U8);
    DEFADDF(g_hdViewPageStart, U8);
    DEFADDF(g_hdViewPageSize, U8);
    DEFADDF(g_hdViewTotalCount, U8);
    DEFADDF(g_hdViewRowCount, U8);
    DEFADDF(g_hdViewPointCount, U8);
    DEFADDF(g_hdViewMapWidth, U8);
    DEFADDF(g_hdViewMapHeight, U8);
    DEFADDF(g_hdViewPlayerMode, U8);
    DEFADDF(g_hdViewFoodKnown, U8);
    DEFADDF(g_hdViewDays, U16);
    DEFADDF(g_hdViewFood, U16);
    DEFADDF(g_hdViewLeader, U16);
    DEFADD_GBKARR(g_hdViewTitleGbk, sizeof(g_hdViewTitleGbk));
    DEFADD_GBKARR(g_hdViewDaysGbk, sizeof(g_hdViewDaysGbk));
    DEFADD_GBKARR(g_hdViewPositionsGbk, sizeof(g_hdViewPositionsGbk));
    DEFADD_GBKARR(g_hdViewFactionGbk, sizeof(g_hdViewFactionGbk));
    DEFADD_GBKARR(g_hdViewFoodGbk, sizeof(g_hdViewFoodGbk));
    DEFADD_U16ARR(g_hdViewRowPersons, BAYE_HD_VIEW_ROWS);
    DEFADD_U16ARR(g_hdViewRowArms, BAYE_HD_VIEW_ROWS);
    DEFADD_U16ARR(g_hdViewPointPersons, BAYE_HD_VIEW_POINTS);
    DEFADD_U8ARR(g_hdViewRowNames, sizeof(g_hdViewRowNames));
    DEFADD_U8ARR(g_hdViewRowText, sizeof(g_hdViewRowText));
    DEFADD_U8ARR(g_hdViewRowSlots, BAYE_HD_VIEW_ROWS);
    DEFADD_U8ARR(g_hdViewPointSlots, BAYE_HD_VIEW_POINTS);
    DEFADD_U8ARR(g_hdViewPointX, BAYE_HD_VIEW_POINTS);
    DEFADD_U8ARR(g_hdViewPointY, BAYE_HD_VIEW_POINTS);
    DEFADD_U8ARR(g_hdViewPointState, BAYE_HD_VIEW_POINTS);
    DEFADDF(g_hdMiniMapProtocolVersion, U8);
    DEFADDF(g_hdMiniMapActive, U8);
    DEFADDF(g_hdMiniMapComplete, U8);
    DEFADDF(g_hdMiniMapCustom, U8);
    DEFADDF(g_hdMiniMapDefaultDraw, U8);
    DEFADDF(g_hdMiniMapSeq, U32);
    DEFADDF(g_hdMiniMapGeneration, U32);
    DEFADDF(g_hdMiniMapInputSeq, U32);
    DEFADDF(g_hdMiniMapResourceId, U16);
    DEFADDF(g_hdMiniMapImageIndex, U16);
    DEFADDF(g_hdMiniMapWidth, U16);
    DEFADDF(g_hdMiniMapHeight, U16);
    DEFADDF(g_hdMiniMapMask, U8);
    DEFADDF(g_hdMiniMapCursorX, U8);
    DEFADDF(g_hdMiniMapCursorY, U8);
    DEFADDF(g_hdMiniMapViewX, U8);
    DEFADDF(g_hdMiniMapViewY, U8);
    DEFADDF(g_hdMiniMapViewWidth, U8);
    DEFADDF(g_hdMiniMapViewHeight, U8);
    DEFADDF(g_hdMiniMapCity1, U8);
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
DEFADDF(g_hdSpeCompositionVersion, U8);
    DEFADDF(g_hdSpeCompositionValid, U8);
    DEFADDF(g_hdSpeDisplayCompositionValid, U8);
    DEFADD_U8ARR(g_hdSpeClearFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADD_U8ARR(g_hdSpeDisplayClearFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADDF(g_hdSpeBgValid, U8);
    DEFADDF(g_hdSpeBgId, U16);
    DEFADDF(g_hdSpeBgResourceIndex, U16);
    DEFADDF(g_hdSpeBgPictureIndex, U16);
    DEFADDF(g_hdSpeBgWidth, U16);
    DEFADDF(g_hdSpeBgHeight, U16);
    DEFADDF(g_hdSpeBgCount, U16);
    DEFADDF(g_hdSpeBgMask, U8);
    DEFADDF(g_hdSpeBgOriginX, U16);
    DEFADDF(g_hdSpeBgOriginY, U16);
    DEFADDF(g_hdSpeBgResourceFingerprint, U32);
    DEFADDF(g_hdSpeBgResourceLength, U32);
    DEFADDF(g_hdSpeDisplayBgValid, U8);
    DEFADDF(g_hdSpeDisplayBgId, U16);
    DEFADDF(g_hdSpeDisplayBgResourceIndex, U16);
    DEFADDF(g_hdSpeDisplayBgPictureIndex, U16);
    DEFADDF(g_hdSpeDisplayBgWidth, U16);
    DEFADDF(g_hdSpeDisplayBgHeight, U16);
    DEFADDF(g_hdSpeDisplayBgCount, U16);
    DEFADDF(g_hdSpeDisplayBgMask, U8);
    DEFADDF(g_hdSpeDisplayBgOriginX, U16);
    DEFADDF(g_hdSpeDisplayBgOriginY, U16);
    DEFADDF(g_hdSpeDisplayBgResourceFingerprint, U32);
    DEFADDF(g_hdSpeDisplayBgResourceLength, U32);
    DEFADDF(g_hdAttackBgValid, U8);
    DEFADDF(g_hdAttackBgId, U16);
    DEFADDF(g_hdAttackBgResourceIndex, U16);
    DEFADDF(g_hdAttackBgPictureIndex, U16);
    DEFADDF(g_hdAttackBgWidth, U16);
    DEFADDF(g_hdAttackBgHeight, U16);
    DEFADDF(g_hdAttackBgCount, U16);
    DEFADDF(g_hdAttackBgMask, U8);
    DEFADDF(g_hdAttackBgOriginX, U16);
    DEFADDF(g_hdAttackBgOriginY, U16);
    DEFADDF(g_hdAttackBgResourceFingerprint, U32);
    DEFADDF(g_hdAttackBgResourceLength, U32);
    DEFADDF(g_hdAttackDisplayBgValid, U8);
    DEFADDF(g_hdAttackDisplayBgId, U16);
    DEFADDF(g_hdAttackDisplayBgResourceIndex, U16);
    DEFADDF(g_hdAttackDisplayBgPictureIndex, U16);
    DEFADDF(g_hdAttackDisplayBgWidth, U16);
    DEFADDF(g_hdAttackDisplayBgHeight, U16);
    DEFADDF(g_hdAttackDisplayBgCount, U16);
    DEFADDF(g_hdAttackDisplayBgMask, U8);
    DEFADDF(g_hdAttackDisplayBgOriginX, U16);
    DEFADDF(g_hdAttackDisplayBgOriginY, U16);
    DEFADDF(g_hdAttackDisplayBgResourceFingerprint, U32);
    DEFADDF(g_hdAttackDisplayBgResourceLength, U32);
    DEFADDF(g_hdAttackNumberValid, U8);
    DEFADDF(g_hdAttackNumberId, U16);
    DEFADDF(g_hdAttackNumberResourceIndex, U16);
    DEFADDF(g_hdAttackNumberPictureIndex, U16);
    DEFADDF(g_hdAttackNumberWidth, U16);
    DEFADDF(g_hdAttackNumberHeight, U16);
    DEFADDF(g_hdAttackNumberCount, U16);
    DEFADDF(g_hdAttackNumberMask, U8);
    DEFADDF(g_hdAttackNumberOriginX, U16);
    DEFADDF(g_hdAttackNumberOriginY, U16);
    DEFADDF(g_hdAttackNumberResourceFingerprint, U32);
    DEFADDF(g_hdAttackNumberResourceLength, U32);
    DEFADDF(g_hdAttackProtocolVersion, U8);
    DEFADDF(g_hdAttackActive, U8);
    DEFADDF(g_hdAttackPhase, U8);
    DEFADDF(g_hdAttackCustom, U8);
    DEFADDF(g_hdAttackSourceValid, U8);
    DEFADDF(g_hdAttackGeneration, U32);
    DEFADDF(g_hdAttackSession, U32);
    DEFADDF(g_hdAttackActorIndex, U8);
    DEFADDF(g_hdAttackTargetIndex, U8);
    DEFADDF(g_hdAttackHurt, U16);
    DEFADDF(g_hdAttackPaintSeq, U32);
    DEFADDF(g_hdAttackEventId, U32);
    DEFADDF(g_hdAttackCommitSeq, U32);
    DEFADDF(g_hdAttackFrameIndex, U16);
    DEFADDF(g_hdAttackId, U16);
    DEFADDF(g_hdAttackResourceIndex, U16);
    DEFADDF(g_hdAttackCount, U16);
    DEFADDF(g_hdAttackPicmax, U16);
    DEFADDF(g_hdAttackStartFrm, U8);
    DEFADDF(g_hdAttackEndFrm, U8);
    DEFADDF(g_hdAttackOriginX, U16);
    DEFADDF(g_hdAttackOriginY, U16);
    DEFADDF(g_hdAttackResourceFingerprint, U32);
    DEFADDF(g_hdAttackResourceLength, U32);
    DEFADDF(g_hdAttackDigitCount, U8);
    DEFADDF(g_hdAttackDisplayValid, U8);
    DEFADDF(g_hdAttackDisplayGeneration, U32);
    DEFADDF(g_hdAttackDisplaySession, U32);
    DEFADDF(g_hdAttackDisplayPaintSeq, U32);
    DEFADDF(g_hdAttackDisplayEventId, U32);
    DEFADDF(g_hdAttackDisplayCommitSeq, U32);
    DEFADDF(g_hdAttackDisplayFrameIndex, U16);
    DEFADDF(g_hdAttackDisplayDigitCount, U8);
    DEFADD_U8ARR(g_hdAttackVisibleFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADD_U8ARR(g_hdAttackClearFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADD_U8ARR(g_hdAttackDigitIndex, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDigitX, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDigitY, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDigitFirstY, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDigitDrawCount, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U8ARR(g_hdAttackDisplayVisibleFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADD_U8ARR(g_hdAttackDisplayClearFrames, BAYE_HD_SPE_FRAME_BYTES);
    DEFADD_U8ARR(g_hdAttackDisplayDigitIndex, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDisplayDigitX, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDisplayDigitY, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDisplayDigitFirstY, BAYE_HD_ATTACK_DIGITS);
    DEFADD_U16ARR(g_hdAttackDisplayDigitDrawCount, BAYE_HD_ATTACK_DIGITS);
    DEFADDF(g_hdMakerProtocolVersion, U8);
    DEFADDF(g_hdMakerActive, U8);
    DEFADDF(g_hdMakerPhase, U8);
    DEFADDF(g_hdMakerCustom, U8);
    DEFADDF(g_hdMakerReturnEligible, U8);
    DEFADDF(g_hdMakerSourceValid, U8);
    DEFADDF(g_hdMakerGeneration, U32);
    DEFADDF(g_hdMakerSession, U32);
    DEFADDF(g_hdMakerInputSeq, U32);
    DEFADDF(g_hdMakerEventId, U32);
    DEFADDF(g_hdMakerCommitSeq, U32);
    DEFADDF(g_hdMakerResourceFingerprint, U32);
    DEFADDF(g_hdMakerResourceLength, U32);
    DEFADDF(g_hdMakerResourceIndex, U16);
    DEFADDF(g_hdMakerCount, U16);
    DEFADDF(g_hdMakerPicmax, U16);
    DEFADDF(g_hdMakerFrameIndex, U16);
    DEFADDF(g_hdMakerOriginX, U16);
    DEFADDF(g_hdMakerOriginY, U16);
    DEFADDF(g_hdMakerStartFrm, U8);
    DEFADDF(g_hdMakerEndFrm, U8);
    DEFADDF(g_hdMakerEndReason, U8);
    DEFADDF(g_hdMakerEndKey, U8);
    DEFADD_U8ARR(g_hdMakerVisibleFrames, BAYE_HD_SPE_FRAME_BYTES);
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
