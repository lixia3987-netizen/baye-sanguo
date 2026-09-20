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

U8 g_hdMenuGbk[BAYE_HD_MENU_MAX];
U16 g_hdMenuItemLen = 0;
U16 g_hdMenuCount = 0;
U16 g_hdMenuIndex = 0;

U8 g_hdFightActive = 0;
U8 g_hdFightOver = 0;
U8 g_hdFightWait = 0;
U8 g_hdFightResultGbk[BAYE_HD_FIGHT_RESULT_MAX];

U32 g_hdQtyValue = 0;
U32 g_hdQtyMin = 0;
U32 g_hdQtyMax = 0;
U8 g_hdQtyActive = 0;

U8 g_hdMapPick = 0;
U8 g_hdMapCity = 0;
U8 g_hdCityLinks[8];
U8 g_hdMarchOk = 0;
U8 g_hdMarchCity = 0;
U8 g_hdMarchObj = 0;
U8 g_hdMarchTime = 0;

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
    g_hdEngineReady = ready;
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
    copy_gbk(g_hdMenuGbk, BAYE_HD_MENU_MAX, buf);
    g_hdMenuItemLen = itemLen;
    g_hdMenuCount = itemCount;
    g_hdMenuIndex = index;
}

void baye_hd_set_fight(U8 active, U8 over)
{
    U8 str[40];
    if (active) {
        over = 0;
    }
    g_hdFightActive = active;
    g_hdFightOver = over;
    str[0] = 0;
    if (active) {
        g_hdFightResultGbk[0] = 0;
    } else if (over == 1) {
        ResLoadToMem(STRING_CONST, STR_GAMEWON, str);
    } else if (over == 2) {
        ResLoadToMem(STRING_CONST, STR_GAMELOST, str);
    }
    if (!active) {
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

void baye_hd_set_qty(U32 value, U32 minV, U32 maxV, U8 active)
{
    g_hdQtyValue = value;
    g_hdQtyMin = minV;
    g_hdQtyMax = maxV;
    g_hdQtyActive = active;
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

void baye_hd_set_map_city(U8 city1)
{
    g_hdMapCity = city1;
}

void baye_hd_set_city_links(U8 city)
{
    U8 *clnk;
    U16 off;
    memset(g_hdCityLinks, 0, sizeof(g_hdCityLinks));
    clnk = ResLoadToCon(CITY_LINKR, 1, g_CBnkPtr);
    if (!clnk) {
        return;
    }
    off = (U16)city * 16;
    memcpy(g_hdCityLinks, clnk + off, 8);
}

void baye_hd_set_march(U8 fromCity, U8 objCity, U8 timeCount, U8 ok)
{
    g_hdMarchOk = ok;
    g_hdMarchCity = fromCity;
    g_hdMarchObj = objCity;
    g_hdMarchTime = timeCount;
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
    DEFADD_GBKARR(g_hdMenuGbk, sizeof(g_hdMenuGbk));
    {
        U8* g_hdMenuBytes = g_hdMenuGbk;
        DEFADD_U8ARR(g_hdMenuBytes, BAYE_HD_MENU_MAX);
    }
    DEFADDF(g_hdMenuItemLen, U16);
    DEFADDF(g_hdMenuCount, U16);
    DEFADDF(g_hdMenuIndex, U16);
    DEFADDF(g_hdFightActive, U8);
    DEFADDF(g_hdFightOver, U8);
    DEFADDF(g_hdFightWait, U8);
    DEFADD_GBKARR(g_hdFightResultGbk, sizeof(g_hdFightResultGbk));
    DEFADDF(g_hdQtyValue, U32);
    DEFADDF(g_hdQtyMin, U32);
    DEFADDF(g_hdQtyMax, U32);
    DEFADDF(g_hdQtyActive, U8);
    DEFADDF(g_hdMapPick, U8);
    DEFADDF(g_hdMapCity, U8);
    DEFADD_U8ARR(g_hdCityLinks, 8);
    DEFADDF(g_hdMarchOk, U8);
    DEFADDF(g_hdMarchCity, U8);
    DEFADDF(g_hdMarchObj, U8);
    DEFADDF(g_hdMarchTime, U8);
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
