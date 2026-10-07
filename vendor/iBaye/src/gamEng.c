/***********************************************************************
 *Copyright (c)2005 , 东莞步步高教育电子分公司
 *All rights reserved.
 **
 文件名称：	gamEng.c
 *文件标识：	步步高电子词典的游戏引擎模块
 *摘要：		游戏引擎主程序
 **
 *移植性声明:
 *	1、符合标准：《游戏设计标准V1.0》
 *	2、兼容模式：平移兼容|缩放兼容
 *修改历史：
 *	版本    日期     作者     改动内容和原因
 *   ----------------------------------------------------
 *	1.0    2005.5.16  高国军     基本的功能完成
 ***********************************************************************/
#include "baye/stdsys.h"
#include "baye/comm.h"
#undef	GamEng
#define	GamEng
#include "baye/enghead.h"
#include "touch.h"
#include "baye/bind-objects.h"
#include "baye/script.h"
#include "miniz.h"
#include "hd-bridge.h"

#define		IN_FILE	1	/* 当前文件位置 */

static const U8*dataDir;

static gam_FILE* sav_fopen(U8*filename, U8 mode)
{
    U8 pathBuf[2048];
    pathBuf[0] = 0;
    gam_strcat(pathBuf, dataDir);
    gam_strcat(pathBuf, "/");
    gam_strcat(pathBuf, filename);
    return gam_fopen(pathBuf, mode);
}

/*本体函数声明*/
/*------------------------------------------*/
U8 GamVarInit(void);
void GamVarRst(void);
U8 GamMovie(U16 speID);
bool GamMainChose(void);
void GamMakerInf(void);
void GamShowErrInf(U8 *s);
PersonID GamGetKing(PersonID*kings, U32 num);
void GamShowKing(U8*names, U8 pTop);
void GamRevCity(U8 cycnt,U8 *tbuf,U8 *pos);
U8 GamPicMenu(U16 picID,U16 speID, const Rect *buttonsRect, U8 buttonsCount, U8 exitOnOther);
void GamRcdIFace(U8 count);
bool GamSaveRcd(U8 idx);
bool GamLoadRcd(U8 idx);
static U8* customData = NULL;

#define	DBG_MEM_AFTER	0
#define	DBG_MEM_BEFURE	1

int compress_data(U8**pOut, U32*pOutLen, const U8* data, U8 level) {
    U32 len = (U32)strlen((const char*)data);
    mz_ulong outlen = mz_compressBound(len);
    U8* output = (U8*)gam_malloc(outlen);
    (void)level;
    if (!output) return -1;
    if (mz_compress2(output, &outlen, data, len, 5) == MZ_OK) {
        *pOut = output;
        *pOutLen = outlen;
        return 0;
    }
    gam_free(output);
    return -1;
}

U8* decompress_data(U8* data, U32 datalen) {
    int i;
    U32 initlen = 1024*1024;
    U8* output;
    mz_ulong outlen;

    for (i = 1; i <= 8; i *= 2) {
        outlen = initlen * i;
        output = (U8*)gam_malloc(outlen);
        if (!output) return NULL;
        outlen -= 1;
        if (mz_uncompress(output, &outlen, data, datalen) == MZ_OK) {
            output[outlen] = 0;
            {
                U8* tmp = gam_strdup(output);
                gam_free(output);
                return tmp;
            }
        }
        gam_free(output);
    }
    return NULL;
}

/***********************************************************************
 * 说明:     游戏引擎主程序
 * 输入参数: 无
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR void GamBaYeEng(void)
{
    /* 初始化游戏环境 */
    if(GamConInit())
    {
        GamShowErrInf((U8*)"load lib failed");
        return;
    }

    /* 初始化游戏变量 */
    if(GamVarInit())
    {
        GamShowErrInf((U8*)"init env failed");
        GamVarRst();
        GamConRst();
        return;
    }
    if (g_engineConfig.showStartMovie)
        /* 显示游戏开始动画 */
        GamMovie(MAIN_SPE);
    
    do
    {
        /* 获取游戏选项 */
        if(!GamMainChose())
            break;
        GameDevDrv();	 	/* 游戏引擎入口程序 */
    } while (1);


    GamVarRst();
    GamConRst();
}
/***********************************************************************
 * 说明:     初始化游戏引擎变量
 * 输入参数: 无
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
U8 GamVarInit(void)
{
    g_RunErr = NONE_ERR;

    gam_memset(FIGHTERS_IDX, 0, FIGHT_ORDER_MAX);
    gam_memset((U8 *)ORDERQUEUE, 0xff, (U16)ORDER_MAX * sizeof(OrderType));

    g_FightMap = gam_malloc(FIGHT_MAP_BUFFER_LEN);		/* 50 */
    if (NULL == g_FightMap)
        return 1;
    g_FightMapData = gam_malloc(FIGHT_MAP_DATA_LEN);
    g_FightPath = gam_malloc(FGT_MRG*FGT_MRG + 25);		/* 250 */
    if (NULL == g_FightPath)
        return 1;
    g_FgtAtkRng = gam_malloc(MAX_ATT_RANGE + 5);		/* 86 */
    if (NULL == g_FgtAtkRng)
        return 1;
    
    g_OrderHead = (OrderQueueType *) NULL;
    g_OrderEnd = (OrderQueueType *) NULL;

    g_PlayerKing = PID0;
    g_CityPos.x = 0;
    g_CityPos.y = 0;
    g_CityPos.setx = 0;
    g_CityPos.sety = 0;
    g_YearDate = 0;
    g_MonthDate = 1;
    g_LookEnemy = true;
    g_LookMovie = true;
    g_MoveSpeed = true;

    if (ResLoadStringWithId(ENGINE_SCRIPT)) {
        g_engineConfig.enableScript = 1;
    }

    /* HD 壳需要 baye.data，即使当前 lib 没有 ENGINE_SCRIPT。 */
    script_init();
    baye_hd_set_ready(1);
    return 0;
}
/***********************************************************************
 * 说明:     恢复游戏引擎变量——释放系统资源
 * 输入参数: 无
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
void GamVarRst(void)
{
    gam_free((U8 *)g_FightMap);
    gam_free((U8 *)g_FightMapData);
    gam_free((U8 *)g_FightPath);
    gam_free((U8 *)g_FgtAtkRng);
}
/***********************************************************************
 * 说明:     驱动玩家在主菜单中的选择
 * 输入参数: 无
 * 返回值  : true-进入游戏	false-退出游戏
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
bool GamMainChose(void)
{
    U8	*posptr;
    U8	idx;
    U8	i,c;
    PersonID king;
    PersonID kings[1024];

    Rect mainMenuButtonRects[4];
    Rect periodMenuButtonRects[4];
    memcpy(&mainMenuButtonRects, g_engineConfig.mainMenuButtonRects, sizeof(mainMenuButtonRects));
    memcpy(&periodMenuButtonRects, g_engineConfig.periodMenuButtonRects, sizeof(periodMenuButtonRects));

    while(1)
    {
        GamClearLastMsg();
        U8 choice;
        IF_HAS_HOOK("chooseGameEntry") {
            choice = CALL_HOOK_A();
        }
        else {
            choice = GamPicMenu(MAIN_PIC,MAIN_ICON1, mainMenuButtonRects, 4, false);
        }
        switch(choice)
        {
            case 0:		/* 新君登基 */
                IF_HAS_HOOK("loadPeriod") {
                    switch (CALL_HOOK_A()) {
                        case 1:
                            break;
                        default:
                            goto loop_end;
                    }
                } else {
                    idx = GamPicMenu(YEAR_PIC,YEAR_ICON1, periodMenuButtonRects, 4, true);
                    if(idx == MNU_EXIT)
                        break;
                    LoadPeriod(idx + 1);
                }
                idx = GetAllKings(kings); 	/* 设置历史时期，并获取君主队列 */
                baye_hd_set_kings(kings, idx);
                {
                    U16 kingCount = (U16)idx;
                    IF_HAS_HOOK("willChooseActor") {
                        BIND_U16EX("count", &kingCount);
                        CALL_HOOK();
                    }
                }
                IF_HAS_HOOK("chooseActor") {
                    king = CALL_HOOK_A();
                } else {
                    king = GamGetKing(kings, idx);
                }
                if(king == 0xffff)
                    break;
                g_PlayerKing = king;				/* 设置玩家扮演的君主ID */

                for (idx = 0;idx < CITY_MAX;idx ++)
                {
                    if (g_Cities[idx].Belong == (g_PlayerKing + 1))
                    {
                        posptr = ResLoadToCon(IFACE_CONID,dCityPos,g_CBnkPtr);
                        g_CityPos.setx = posptr[idx << 1];
                        g_CityPos.sety = posptr[(idx << 1) + 1];
                        if ((g_CityPos.setx + SHOWMAP_WS / 2) >= CITYMAP_W)
                            g_CityPos.x = CITYMAP_W > SHOWMAP_WS ? CITYMAP_W - SHOWMAP_WS : 0;
                        else if (g_CityPos.setx < SHOWMAP_WS / 2)
                            g_CityPos.x = 0;
                        else
                            g_CityPos.x = g_CityPos.setx - SHOWMAP_WS / 2;

                        if ((g_CityPos.sety + SHOWMAP_HS / 2) >= CITYMAP_H)
                            g_CityPos.y = CITYMAP_H > SHOWMAP_HS ? CITYMAP_H - SHOWMAP_HS : 0;
                        else if (g_CityPos.sety < SHOWMAP_HS / 2)
                            g_CityPos.y = 0;
                        else
                            g_CityPos.y = g_CityPos.sety - SHOWMAP_HS / 2;
                        break;
                    }
                }
                for (idx = 0;idx < CITY_MAX;idx ++)
                {
                    if (g_Cities[idx].Belong != (g_PlayerKing + 1))
                    {
                        PersonID* pqptr = (PersonID*)SHARE_MEM;
                        c = GetCityPersons(idx,pqptr);
                        for (i = 0;i < c;i ++)
                        {
                            g_Persons[pqptr[i]].Arms = 800;
                        }
                        ADD16(g_Cities[idx].Food, 1000);
                    }
                }
                g_FromSave = 0;
                baye_hd_world_commit();
                call_hook("didOpenNewGame", NULL);
                return true;
            case 1:		/* 重返沙场 */
                idx = GamRecordMan(true);
                if(idx == MNU_EXIT)
                    break;
                g_FromSave = 1;
                return true;
            case 2:		/* 制作群组 */
                GamMakerInf();
                break;
            case 3:		/* 卸甲归田 */
            case MNU_EXIT:
                return false;
        }
        loop_end:;
    }
}

/***********************************************************************
 * 说明:     驱动游戏主菜单，并获取相应的选择
 * 输入参数: 无
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
U8 GamPicMenuInner(U16 picID,U16 speID, const Rect *buttonsRect, U8 buttonsCount, U8 exitOnOther);
U8 GamPicMenu(U16 picID,U16 speID, const Rect *buttonsRect, U8 buttonsCount, U8 exitOnOther) {
    int prev = SysScrollingTimerOpen(0);
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_SYSTEM,
        picID == MAIN_PIC ? BAYE_HD_MENU_TITLE : BAYE_HD_MENU_PERIOD);
    baye_hd_menu_begin();
    baye_hd_set_menu(NULL, 0, buttonsCount, 0);
    U8 rv = GamPicMenuInner(picID, speID, buttonsRect, buttonsCount, exitOnOther);
    baye_hd_menu_end();
    SysScrollingTimerOpen(prev);
    return rv;
}
U8 GamPicMenuInner(U16 picID,U16 speID, const Rect *buttonsRect, U8 buttonsCount, U8 exitOnOther)
{
    U8	mIdx;
    GMType	pMsg;
    Touch touch = {0};

    mIdx = 0;
    PlcRPicShow(picID,1,WK_SX,WK_SY,false);
    while(1)
    {
        U8 key = GamMovie(speID + mIdx);
        if (key == 0 || key == 0xff) {
            GamGetMsg(&pMsg);
        }
        else {
            GamGetLastMsg(&pMsg);
        }
        if(VM_CHAR_FUN == pMsg.type)
        {
            switch(pMsg.param)
            {
                case VK_UP:
                case VK_LEFT:
                    mIdx -= 1;
                    break;
                case VK_DOWN:
                case VK_RIGHT:
                    mIdx += 1;
                    break;
                case VK_ENTER:
                    return mIdx;
                case VK_EXIT:
                    return MNU_EXIT;
            }
            mIdx = mIdx % 4;
            baye_hd_set_menu(NULL, 0, buttonsCount, mIdx);
            PlcRPicShow(picID,1,WK_SX,WK_SY,false);
        }
        else if (VM_TOUCH == pMsg.type) {
            touchUpdate(&touch, pMsg);

            if (pMsg.param == VT_TOUCH_UP) {

                if (!touch.completed || touch.moved) continue;

                for (U8 i = 0; i < buttonsCount; i++) {
                    if (touchIsPointInRect(touch.currentX, touch.currentY, buttonsRect[i])) {
                        return i;
                    }
                }
                if (exitOnOther) return MNU_EXIT;
            }
        }
    }
}
/***********************************************************************
 * 说明:     开发群组——游戏开发人员登场了！
 * 输入参数: 无
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
void GamMakerInf(void)
{
    gam_memset(g_VisScr,0,MAX_SCR_BUF_LEN);
    if (call_hook_a("showAbout", NULL) == -1) {
        GamMovie(MAKER_SPE);
        GamDelay(5000, 2);
    }
}
/***********************************************************************
 * 说明:     获取玩家要扮演的君主ID
 * 输入参数: num-君主队列人数
 * 返回值  : 玩家选中的君主ID	MNU_EXIT-跳出
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
PersonID GamGetKingInner(PersonID*kings, U32 num);
PersonID GamGetKing(PersonID*kings, U32 num) {
    if (!num) return PID(0xffff);
    int prev = SysScrollingTimerOpen(5);
    baye_hd_set_kings(kings, num);
    baye_hd_set_king_highlight(0, kings[0]);
    baye_hd_menu_scope(BAYE_HD_MENU_CONTEXT_SYSTEM, BAYE_HD_MENU_KING);
    baye_hd_menu_begin();
    baye_hd_set_menu(g_hdKingNames, BAYE_HD_NAME_SLOT, g_hdKingCount, 0);
    PersonID id = GamGetKingInner(kings, num);
    baye_hd_menu_end();
    SysScrollingTimerOpen(prev);
    return id;
}
PersonID GamGetKingInner(PersonID*kings, U32 num)
{
    U8	*pos,tbuf[CITY_MAX];
    I32	pTop,pIdx,pSLen;
    I32	cycnt,ry;
    bool	rflag;
    GMType	pMsg;

    static U8 kingNames[PERSON_MAX*3];

    Touch touch = {0};

    I16 touchStartTop = 0;
    U8 itemHeight = HZ_HGT;

    gam_clslcd();
    /* 获取君主的名字到g_FightPath中（只取前6个字节） */
    for(pIdx = 0;pIdx < num;pIdx += 1)
    {
        pTop = pIdx * 6;
        GetPersonName(kings[pIdx],kingNames + pTop);
        pSLen = (U32)gam_strlen(kingNames);
        if(pSLen < pTop + 6)
            gam_memset(kingNames + pSLen,' ',pTop + 6 - pSLen);
    }
    kingNames[pIdx*6] = 0;

    /* 获取城市坐标指针 */
    gam_rect(WK_SX,WK_SY,WK_EX,WK_EY);
    ResLoadToMem(IFACE_STRID,dChoseKing,tbuf);
    GamStrShowS(KING_TX,KING_TY,tbuf);
    PlcRPicShow(CITY_PIC,1,CITY_SX,CITY_SY,true);

    U16 itemsPerPage = (WK_EY - 6 - (KING_SY)) / itemHeight;

    Rect listRect = {
        KING_SX - 3, KING_SY, KING_EX + 2, KING_SY + itemHeight * itemsPerPage
    };
    gam_rect(listRect.left, listRect.top - 3, listRect.right, listRect.bottom + 2);

    Rect exitRect = MakeRect(SCR_WID-28, 0, 27, HZ_HGT + 3);
    touchDrawButton(exitRect, "\xb7\xb5\xbb\xd8"); //返回

    /* 选择要扮演的君主 */
    pos = ResLoadToCon(IFACE_CONID,dCityPos,g_CBnkPtr);
    pTop = 0;
    pIdx = 0;
    rflag = false;
    GamShowKing(kingNames, pTop);
    ry = (pIdx - pTop) * itemHeight + KING_SY;
    gam_revlcd(KING_SX,ry,KING_EX,ry + itemHeight);
    cycnt = GetKingCitys(kings[pIdx],tbuf); 		/* 获取治下城市队列 */
#define UPDATE_UI() \
            GamShowKing(kingNames, pTop);\
            ry = (pIdx - pTop) * itemHeight + KING_SY;\
            if (ry >= KING_SY && ry + itemHeight <= KING_SY + itemHeight*itemsPerPage) {\
                gam_revlcd(KING_SX,ry,KING_EX,ry + itemHeight);\
            }\
            cycnt = GetKingCitys(kings[pIdx],tbuf); \
            baye_hd_set_king_highlight((U32)pIdx, kings[pIdx]); \
            baye_hd_set_menu_index((U16)pIdx); \
            IF_HAS_HOOK("choosingActorUpdate") { \
                BIND_U8EX("index", &pIdx); \
                BIND_U8EX("generalIndex", &kings[pIdx]); \
                CALL_HOOK(); \
            }

    UPDATE_UI();

    while(1)
    {
        GamGetMsg(&pMsg);
        if(VM_CHAR_FUN == pMsg.type)
        {
#define CLEAR_SEL() \
            if (ry >= KING_SY && ry + itemHeight <= KING_SY + itemHeight*itemsPerPage) {\
                gam_revlcd(KING_SX,ry,KING_EX,ry + itemHeight);\
            }\
            \
            if(rflag)\
            {\
                GamRevCity(cycnt,tbuf,pos);\
                rflag = false;\
            }

            CLEAR_SEL();

            switch(pMsg.param)
            {
                case VK_UP:
                    if(pIdx)
                    {
                        if(pIdx == pTop)
                            pTop -= 1;
                        pIdx -= 1;
                    }
                    break;
                case VK_DOWN:
                    if(pIdx < num - 1)
                    {
                        pIdx += 1;
                        if(pIdx - pTop > itemsPerPage - 1)
                            pTop += 1;
                    }
                    break;
                case VK_EXIT:
                    return PID(0xffff);
                case VK_ENTER:
                    return kings[pIdx];
            }
            UPDATE_UI();
        }
        else if (VM_TOUCH == pMsg.type) {
            touchUpdate(&touch, pMsg);
            switch (pMsg.param) {
                case VT_TOUCH_UP:
                {
                    if (!touch.completed || touch.moved) break;

                    I16 index = touchListViewItemIndexAtPoint(touch.currentX, touch.currentY, listRect, 2, 2, pTop, num, itemHeight);
                    if (index >= 0) {
                        if (index == pIdx) {
                            return kings[pIdx];
                        }
                        CLEAR_SEL();
                        pIdx = index;
                        UPDATE_UI();
                    } else if (touchIsPointInRect(touch.currentX, touch.currentY, exitRect)) {
                        return PID(0xffff);
                    }
                    break;
                }
                case VT_TOUCH_DOWN:
                    touchStartTop = pTop;
                    break;
                case VT_TOUCH_MOVE:
                {
                    I16 distanceY, top;
                    I8 deltaItems;
                    if (!touch.touched) break;
moveView:
                    distanceY = touch.currentY - touch.startY;
                    deltaItems = distanceY / itemHeight;
                    top = touchStartTop - deltaItems;
                    top = limitValueInRange(top, 0, num-itemsPerPage);
                    touchUpdateViewState(
                        &touch,
                        3,
                        pointState(top, 0, num-itemsPerPage)
                    );
                    if (top != pTop) {
                        pTop = top;
                        UPDATE_UI();
                    }
                    break;
                }
                default:
                    break;
            }
        }
        else if (GamMsgIsTimer0(pMsg))
        {
            if (touchUpdate(&touch, pMsg)) {
                goto moveView;
            }
        }
        else if (pMsg.type == VM_CHAR_FUN)
        {
            touchUpdate(&touch, pMsg);
        }
        else
        {
            rflag = !rflag;
            GamRevCity(cycnt,tbuf,pos);
        }
    }
}
/***********************************************************************
 * 说明:     闪烁显示当前君主的城池
 * 输入参数: cycnt-城池个数	tbuf-城池队列	pos-城池坐标队列
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
void GamRevCity(U8 cycnt,U8 *tbuf,U8 *pos)
{
    U8	i,sx,sy;

    for(i = 0;i < cycnt;i += 1)
    {
        sx = tbuf[i] << 1;
        sy = pos[sx + 1] * 7 + CITY_SY + 3;
        sx = pos[sx] * 7 + CITY_SX + 3;
        gam_revlcd(sx,sy,sx + 1,sy + 1);
    }
}
/***********************************************************************
 * 说明:     显示游戏开头的动画
 * 输入参数: 无
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
void GamShowKing(U8*names, U8 pTop)
{
    c_Sx = KING_SX;
    c_Ex = KING_EX;
    c_Sy = KING_SY;
    c_Ey = (WK_EY - 6 - (KING_SY)) / HZ_HGT * HZ_HGT + KING_SY;
    GamStrShowS(KING_SX,KING_SY,names + (pTop * 6));
}
/***********************************************************************
 * 说明:     显示游戏开头的动画
 * 输入参数: 无
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
U8 GamMovie(U16 speID)
{
    U8 rv;
    if (speID == MAIN_SPE) {
        baye_hd_set_movie(speID, 1);
    }
    rv = PlcMovie(speID,0,0,-1,true,WK_SX,WK_SY);
    if (speID == MAIN_SPE) {
        baye_hd_set_movie(0, 0);
    }
    return rv;
}
/***********************************************************************
 * 说明:     显示出错信息
 * 输入参数: idx-信息序号
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
void GamShowErrInf(U8 *s)
{
    U8 buf[64] = "Error: ";
    gam_strcat(buf, s);
    GamMsgBox(buf,2);
}
/***********************************************************************
 * 说明:     档案管理（提供存档和读取档案的函数）
 * 输入参数: flag：true-读档管理	false-存档管理
 * 返回值  : !0xFF-所操作的档案序号	0xFF-取消
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR U8 GamRecordMan(U8 flag)
{
    U8	idx,ry;
    bool	pflag;
    GMType	pMsg;
    U8 count = flag ? 4 : 3;
    Touch touch = {0};
    U8 itemHeight = 14;

    Point anchor = g_engineConfig.saveFaceListAnchor;

    GamRcdIFace(count);
    idx = 0;
    ry = anchor.y;
    U8 right = anchor.x + 95;
    gam_revlcd(anchor.x, ry, right, ry + HZ_HGT);
    baye_hd_record_begin(flag ? 2 : 1, idx, count);

    Rect menuRect = {
        .left = anchor.x,
        .top = ry,
        .right = right,
        .bottom = ry + itemHeight*count,
    };

    while(1)
    {
        GamGetMsg(&pMsg);
        if(VM_CHAR_FUN == pMsg.type)
        {
            gam_revlcd(anchor.x, ry, right, ry + HZ_HGT);
            switch(pMsg.param)
            {
                case VK_UP:
                    idx = idx ? idx - 1 : count - 1;
                    break;
                case VK_DOWN:
                    idx += 1;
                    break;
                case VK_ENTER:
                    baye_hd_record_end();
                    if(flag)
                        pflag = GamLoadRcd(idx);
                    else
                        pflag = GamSaveRcd(idx);
                    if(pflag)
                        return idx;
                    GamRcdIFace(count);
                    baye_hd_record_begin(flag ? 2 : 1, idx, count);
                    break;
                case VK_EXIT:
                    baye_hd_record_end();
                    return MNU_EXIT;
            }
            idx = idx % count;
            baye_hd_record_index(idx);
            ry = anchor.y + itemHeight*idx;
            gam_revlcd(anchor.x, ry, right, ry + HZ_HGT);
        } else if (VM_TOUCH == pMsg.type) {
            touchUpdate(&touch, pMsg);
            if (VT_TOUCH_UP == pMsg.param) {
                if (touch.completed && !touch.moved) {
                    if (touchIsPointInRect(touch.startX, touch.startY, menuRect)) {
                        I16 index = touchListViewItemIndexAtPoint(touch.startX, touch.startY, menuRect, 0, 0, 0, count, itemHeight);
                        if (index >= 0) {
                            if (index == idx) {
                                baye_hd_record_end();
                                if(flag)
                                    pflag = GamLoadRcd(idx);
                                else
                                    pflag = GamSaveRcd(idx);
                                if(pflag)
                                    return idx;
                                GamRcdIFace(count);
                                baye_hd_record_begin(flag ? 2 : 1, idx, count);
                            } else {
                                gam_revlcd(anchor.x, ry, right, ry + HZ_HGT);
                                idx = index;
                            }
                            idx = idx % count;
                            baye_hd_record_index(idx);
                            ry = anchor.y + itemHeight*idx;
                            gam_revlcd(anchor.x, ry, right, ry + HZ_HGT);
                        }
                    } else {
                        baye_hd_record_end();
                        return MNU_EXIT;
                    }
                }
            }
        }
    }
}
/***********************************************************************
 * 说明:     初始化游戏引擎所在的机型环境
 * 输入参数: 无
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
void GamRcdIFace(U8 count)
{
    U8	idx,fnam[20];
    U8	tbuf[32];
    U16	year;
    gam_FILE	*fp;
    PersonID king;
    U8 n;

    Point anchor = g_engineConfig.saveFaceListAnchor;

    PlcRPicShow(SAVE_PIC,1,WK_SX,WK_SY,true);
    for(idx = 0;idx < count;idx += 1)
    {
        ResLoadToMem(IFACE_STRID,dSaveFNam,fnam);
        fnam[5] = (idx << 1) + 0x30;		/* fnam = "sango?.sav" */
        fp = sav_fopen(fnam,'r');
        if(NULL == fp)
            ResLoadToMem(IFACE_STRID,dNullFNam,fnam);	/* fnam = "空" */
        else
        {
            U8 ver, period;
            U16 pql;
            bool valid = gam_fread(&ver,1,1,fp) == 1 &&
                gam_fread(&period,1,1,fp) == 1 &&
                gam_fread((U8 *)&pql,1,2,fp) == 2 &&
                gam_fread((U8 *)&king,1,2,fp) == 2 &&
                gam_fread((U8 *)&year,1,2,fp) == 2 &&
                ver >= 0x90 && ver <= 0x95 && period >= 1 && period <= 4 &&
                pql > 0 && pql <= PERSON_MAX && king < pql;
            gam_fclose(fp);
            if (!valid) {
                ResLoadToMem(IFACE_STRID,dNullFNam,fnam);
                GamStrShowS(anchor.x, anchor.y + idx * 14, fnam);
                continue;
            }
            ResLoadToMem(IFACE_STRID,dRecordInf,fnam);
            if (period == g_PIdx) {
                GetPersonName(king,tbuf);
            } else {
                U8 nameResources[] = {GENERAL_NAME, GENERAL_NAME2, GENERAL_NAME3, GENERAL_NAME4};
                ResLoadToMemN(nameResources[period - 1], (U16)(king + 1), tbuf, sizeof(tbuf));
            }
            tbuf[sizeof(tbuf) - 1] = 0;
            n = gam_strlen(tbuf);
            if (n > 8) n = 8;
            gam_memcpy(fnam,tbuf,n);		/* fnam = "君主       年" */
            gam_itoa(year,tbuf,10);
            n = gam_strlen(tbuf) + 1;
            gam_memcpy(fnam + 10,tbuf,n);	/* fnam = "君主    ???年" */
        }
        GamStrShowS(anchor.x, anchor.y + idx * 14, fnam);
    }
}
/***********************************************************************
 * 说明:     载入指定序号的档案
 * 输入参数: idx-指定序号
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
/* Stage both files before changing any live world state. 0x95 stores the full
 * goods/fighter blocks and declares the custom-data tail length. */
typedef struct {
    U8 version, period, lookEnemy, lookMovie, moveSpeed, month, compressed;
    U16 personCount, year;
    PersonID king;
    CitySetType cityPos;
    PersonType persons[PERSON_MAX];
    PersonID personQueue[PERSON_MAX];
    ToolID goods[GOODS_MAX];
    U8 fighterIndex[FIGHT_ORDER_MAX];
    PersonID fighters[FIGHT_ORDER_MAX * 10];
    OrderType orders[ORDER_MAX];
    CityType cities[256];
    int seed;
    U8* custom;
} GamSaveSnapshot;

static U8* save_read_custom(gam_FILE* fp, U32* length)
{
    const U32 limit = 8 * 1024 * 1024;
    U32 capacity = 1024, used = 0;
    U8* data = gam_malloc(capacity + 1);
    if (!data) return NULL;
    while (1) {
        U8 block[1024];
        U32 count = gam_fread(block, 1, sizeof(block), fp);
        if (!count) break;
        if (count > limit - used) { gam_free(data); return NULL; }
        if (used + count > capacity) {
            U32 next = capacity * 2;
            U8* grown;
            if (next < used + count) next = used + count;
            grown = gam_realloc(data, next + 1);
            if (!grown) { gam_free(data); return NULL; }
            data = grown;
            capacity = next;
        }
        gam_memcpy(data + used, block, count);
        used += count;
    }
    data[used] = 0;
    *length = used;
    return data;
}

static bool save_snapshot_valid(const GamSaveSnapshot* snapshot)
{
    U32 city, i;
    if (snapshot->version < 0x90 || snapshot->version > 0x95 ||
        !snapshot->personCount || snapshot->personCount > PERSON_MAX ||
        snapshot->period < 1 || snapshot->period > 4 ||
        snapshot->king >= snapshot->personCount ||
        !snapshot->month || snapshot->month > 12 ||
        !CITY_MAX || snapshot->compressed > 9) return false;
    if (snapshot->cityPos.setx >= CITYMAP_W || snapshot->cityPos.sety >= CITYMAP_H ||
        snapshot->cityPos.x >= CITYMAP_W || snapshot->cityPos.y >= CITYMAP_H) return false;
    for (i = 0; i < snapshot->personCount; ++i) {
        const PersonType* person = &snapshot->persons[i];
        if (snapshot->personQueue[i] >= snapshot->personCount ||
            (person->Belong != 0xffff && person->Belong > snapshot->personCount) ||
            (person->OldBelong != 0xffff && person->OldBelong > snapshot->personCount) ||
            person->Equip[0] > GOODS_MAX || person->Equip[1] > GOODS_MAX) return false;
    }
    for (city = 0; city < CITY_MAX; ++city) {
        const CityType* item = &snapshot->cities[city];
        if (item->Belong > snapshot->personCount || item->SatrapId > snapshot->personCount ||
            (U32)item->PersonQueue + item->Persons > snapshot->personCount ||
            (U32)item->ToolQueue + item->Tools > GOODS_MAX) return false;
        for (i = item->PersonQueue; i < (U32)item->PersonQueue + item->Persons; ++i) {
            if (snapshot->personQueue[i] >= snapshot->personCount) return false;
        }
        for (i = item->ToolQueue; i < (U32)item->ToolQueue + item->Tools; ++i) {
            if ((snapshot->goods[i] & 0x7fff) >= GOODS_MAX) return false;
        }
    }
    for (i = 0; i < FIGHT_ORDER_MAX; ++i) {
        U32 person;
        if (snapshot->fighterIndex[i] > 1) return false;
        for (person = 0; person < 10; ++person) {
            if (snapshot->fighters[i * 10 + person] > snapshot->personCount) return false;
        }
    }
    for (i = 0; i < ORDER_MAX; ++i) {
        const OrderType* order = &snapshot->orders[i];
        if (order->OrderId == 0xff) continue;
        if (order->OrderId > BATTLE ||
            (order->OrderId > INDUCE && order->OrderId < RECONNOITRE) ||
            order->City >= CITY_MAX) return false;
        if (order->OrderId == BATTLE) {
            if (order->Person >= FIGHT_ORDER_MAX || order->Object >= CITY_MAX ||
                !snapshot->fighterIndex[order->Person] ||
                !snapshot->fighters[order->Person * 10]) return false;
        } else {
            if (order->Person >= snapshot->personCount) return false;
            switch (order->OrderId) {
                case TRANSPORTATION:
                case MOVE:
                case RECONNOITRE:
                    if (order->Object >= CITY_MAX) return false;
                    break;
                case SURRENDER:
                case ALIENATE:
                case CANVASS:
                case COUNTERESPIONAGE:
                case INDUCE:
                    if (order->Object >= snapshot->personCount) return false;
                    break;
                default:
                    break; /* Native drivers do not read Object for these orders. */
            }
        }
    }
    return true;
}

bool GamLoadRcd(U8 idx)
{
    U8 tbuf[20], extra;
    U32 customLength = 0, declaredCustomLength = 0;
    gam_FILE* fp = NULL;
    GamSaveSnapshot* snapshot = NULL;
    if (idx >= 4) return false;
    ResLoadToMem(IFACE_STRID,dReading,tbuf);
    GamMsgBox(tbuf,0);
    ResLoadToMem(IFACE_STRID,dSaveFNam,tbuf);
    snapshot = gam_malloc(sizeof(*snapshot));
    if (!snapshot) goto failed;
    gam_memset((U8*)snapshot, 0, sizeof(*snapshot));
    tbuf[5] = (idx << 1) + 0x30;
    fp = sav_fopen(tbuf,'r');
    if (!fp) goto failed;
#define SAVE_READ(buf, size, count) do { \
    if (gam_fread((U8*)(buf), (size), (count), fp) != (count)) goto failed; \
} while (0)
    SAVE_READ(&snapshot->version,1,1);
    SAVE_READ(&snapshot->period,1,1);
    SAVE_READ(&snapshot->personCount,1,2);
    if (snapshot->version < 0x90 || snapshot->version > 0x95 ||
        !snapshot->personCount || snapshot->personCount > PERSON_MAX) goto failed;
    SAVE_READ(&snapshot->king,1,2);
    SAVE_READ(&snapshot->year,2,1);
    SAVE_READ(&snapshot->lookEnemy,1,1);
    SAVE_READ(&snapshot->lookMovie,1,1);
    SAVE_READ(&snapshot->moveSpeed,1,1);
    SAVE_READ(&snapshot->month,1,1);
    SAVE_READ(&snapshot->cityPos,sizeof(CitySetType),1);
    SAVE_READ(snapshot->persons,sizeof(PersonType),snapshot->personCount);
    SAVE_READ(snapshot->personQueue,sizeof(PersonID),snapshot->personCount);
    SAVE_READ(snapshot->goods,1,snapshot->version >= 0x95 ? sizeof(snapshot->goods) : GOODS_MAX);
    if (snapshot->version >= 0x94) SAVE_READ(&snapshot->compressed,1,1);
    if (snapshot->version >= 0x95) {
        SAVE_READ(&declaredCustomLength,sizeof(declaredCustomLength),1);
        if (declaredCustomLength > 8 * 1024 * 1024) goto failed;
    }
    snapshot->custom = save_read_custom(fp, &customLength);
    if (!snapshot->custom) goto failed;
    if (snapshot->version >= 0x95 && customLength != declaredCustomLength) goto failed;
    if (!snapshot->compressed && strlen((const char*)snapshot->custom) != customLength) goto failed;
    if (gam_fclose(fp)) { fp = NULL; goto failed; }
    fp = NULL;
    if (snapshot->compressed && customLength) {
        U8* expanded = decompress_data(snapshot->custom, customLength);
        if (!expanded) goto failed;
        gam_free(snapshot->custom);
        snapshot->custom = expanded;
    }
    tbuf[5] = (idx << 1) + 0x31;
    fp = sav_fopen(tbuf,'r');
    if (!fp) goto failed;
    SAVE_READ(snapshot->fighterIndex,1,FIGHT_ORDER_MAX);
    SAVE_READ(snapshot->fighters,1,
        snapshot->version >= 0x95 ? sizeof(snapshot->fighters) : 10 * FIGHT_ORDER_MAX);
    SAVE_READ(snapshot->orders,sizeof(OrderType),ORDER_MAX);
    SAVE_READ(snapshot->cities,sizeof(CityType),CITY_MAX);
    SAVE_READ(&snapshot->seed,sizeof(snapshot->seed),1);
    if (gam_fread(&extra,1,1,fp)) goto failed;
    if (gam_fclose(fp)) { fp = NULL; goto failed; }
    fp = NULL;
    if (snapshot->version < 0x95) {
        U8 legacyFighters[10 * FIGHT_ORDER_MAX];
        U32 fighter;
        gam_memcpy(legacyFighters, (U8*)snapshot->fighters, sizeof(legacyFighters));
        gam_memset((U8*)snapshot->fighters, 0, sizeof(snapshot->fighters));
        for (fighter = 0; fighter < FIGHT_ORDER_MAX; ++fighter) {
            U32 legacyOffset = fighter * 10 * sizeof(PersonID) * sizeof(PersonID);
            if (!snapshot->fighterIndex[fighter]) continue;
            if (legacyOffset + 10 * sizeof(PersonID) > sizeof(legacyFighters)) goto failed;
            gam_memcpy((U8*)&snapshot->fighters[fighter * 10], legacyFighters + legacyOffset,
                10 * sizeof(PersonID));
        }
    }
    if (!save_snapshot_valid(snapshot)) goto failed;
#undef SAVE_READ
    g_PIdx = snapshot->period;
    GamSetPersonCount(snapshot->personCount);
    g_PlayerKing = snapshot->king;
    g_YearDate = snapshot->year;
    g_LookEnemy = snapshot->lookEnemy;
    g_LookMovie = snapshot->lookMovie;
    g_MoveSpeed = snapshot->moveSpeed;
    g_MonthDate = snapshot->month;
    g_CityPos = snapshot->cityPos;
    gam_memcpy((U8*)g_Persons, (U8*)snapshot->persons, sizeof(PersonType) * snapshot->personCount);
    gam_memcpy((U8*)g_PersonsQueue, (U8*)snapshot->personQueue, sizeof(PersonID) * snapshot->personCount);
    gam_memcpy((U8*)g_GoodsQueue, (U8*)snapshot->goods, sizeof(snapshot->goods));
    gam_memcpy(FIGHTERS_IDX, snapshot->fighterIndex, FIGHT_ORDER_MAX);
    gam_memcpy(FIGHTERS, (U8*)snapshot->fighters, sizeof(snapshot->fighters));
    gam_memcpy(ORDERQUEUE, (U8*)snapshot->orders, sizeof(snapshot->orders));
    gam_memcpy((U8*)g_Cities, (U8*)snapshot->cities, sizeof(CityType) * CITY_MAX);
    gam_free(customData);
    customData = snapshot->custom;
    snapshot->custom = NULL;
    if (g_engineConfig.disableSL) gam_srand(snapshot->seed);
    gam_free(snapshot);
    baye_hd_world_commit();
    call_hook("didLoadGame", NULL);
    return true;
failed:
    if (fp) gam_fclose(fp);
    if (snapshot) { gam_free(snapshot->custom); gam_free(snapshot); }
    ResLoadToMem(IFACE_STRID,dErrInf1,tbuf);
    GamMsgBox(tbuf,2);
    return false;
}
/***********************************************************************
 * 说明:     存储指定序号的档案
 * 输入参数: idx-指定序号
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/

/* The web filesystem stages file closes in memory. The only persistent
 * publication occurs after both complete files have passed every write. */
static bool save_batch_begin(U8 slot)
{
#ifdef __EMSCRIPTEN__
    return EM_ASM_INT({
        try { return window.bayeSaveBatchBegin ? (window.bayeSaveBatchBegin($0) ? 1 : 0) : 0; }
        catch (error) { return 0; }
    }, slot);
#else
    (void)slot;
    return true;
#endif
}

static bool save_batch_commit(void)
{
#ifdef __EMSCRIPTEN__
    return EM_ASM_INT({
        try { return window.bayeSaveBatchCommit ? (window.bayeSaveBatchCommit() ? 1 : 0) : 0; }
        catch (error) { return 0; }
    });
#else
    return true;
#endif
}

static void save_batch_abort(void)
{
#ifdef __EMSCRIPTEN__
    EM_ASM({ if (window.bayeSaveBatchAbort) window.bayeSaveBatchAbort(); });
#endif
}

bool GamSaveRcd(U8 idx)
{
    U8 tbuf[20], ver = 0x95;
    U16 pcount;
    U8* encoded = NULL;
    U32 encodedLength = 0;
    U32 customLength;
    gam_FILE* fp = NULL;
    bool batch = false;
    if (idx >= 3) return false;
    ResLoadToMem(IFACE_STRID,dWriting,tbuf);
    GamMsgBox(tbuf,0);
    GamDelay(1, 0);
    call_hook("willSaveGame", NULL);
    pcount = GamGetPersonCount();
    if (!pcount || pcount > PERSON_MAX) goto failed;
    if (customData && customData[0] && g_engineConfig.compressCustomData) {
        if (compress_data(&encoded, &encodedLength, customData,
            g_engineConfig.compressCustomData) != 0) goto failed;
    }
    customLength = encoded ? encodedLength : (customData ? strlen((const char*)customData) : 0);
    if (customLength > 8 * 1024 * 1024) goto failed;
    if (!save_batch_begin(idx)) goto failed;
    batch = true;
    ResLoadToMem(IFACE_STRID,dSaveFNam,tbuf);
    tbuf[5] = (idx << 1) + 0x30;
    fp = sav_fopen(tbuf,'w');
    if (!fp) goto failed;
#define SAVE_WRITE(buf, size, count) do { \
    if (gam_fwrite((U8*)(buf), (size), (count), fp) != (count)) goto failed; \
} while (0)
    SAVE_WRITE(&ver,1,1);
    SAVE_WRITE(&g_PIdx,1,1);
    SAVE_WRITE(&pcount,1,2);
    SAVE_WRITE(&g_PlayerKing,1,2);
    SAVE_WRITE(&g_YearDate,2,1);
    SAVE_WRITE(&g_LookEnemy,1,1);
    SAVE_WRITE(&g_LookMovie,1,1);
    SAVE_WRITE(&g_MoveSpeed,1,1);
    SAVE_WRITE(&g_MonthDate,1,1);
    SAVE_WRITE(&g_CityPos,sizeof(CitySetType),1);
    SAVE_WRITE(g_Persons,sizeof(PersonType),pcount);
    SAVE_WRITE(g_PersonsQueue,sizeof(PersonID),pcount);
    SAVE_WRITE(g_GoodsQueue,1,sizeof(g_GoodsQueue));
    SAVE_WRITE(&g_engineConfig.compressCustomData,1,1);
    SAVE_WRITE(&customLength,sizeof(customLength),1);
    if (encoded) SAVE_WRITE(encoded,encodedLength,1);
    else if (customData && customData[0]) SAVE_WRITE(customData,strlen((const char*)customData),1);
    if (gam_fclose(fp)) { fp = NULL; goto failed; }
    fp = NULL;
    gam_free(encoded);
    encoded = NULL;
    tbuf[5] = (idx << 1) + 0x31;
    fp = sav_fopen(tbuf,'w');
    if (!fp) goto failed;
    SAVE_WRITE(FIGHTERS_IDX,1,FIGHT_ORDER_MAX);
    SAVE_WRITE(FIGHTERS,sizeof(PersonID) * 10,FIGHT_ORDER_MAX);
    SAVE_WRITE(ORDERQUEUE,sizeof(OrderType),ORDER_MAX);
    SAVE_WRITE(g_Cities,sizeof(CityType),CITY_MAX);
    {
        int seed = gam_seed();
        SAVE_WRITE(&seed,sizeof(seed),1);
    }
    if (gam_fclose(fp)) { fp = NULL; goto failed; }
    fp = NULL;
#undef SAVE_WRITE
    if (!save_batch_commit()) goto failed;
    return true;
failed:
    if (fp) gam_fclose(fp);
    gam_free(encoded);
    if (batch) save_batch_abort();
    ResLoadToMem(IFACE_STRID,dErrInf,tbuf);
    GamMsgBox(tbuf,2);
    return false;
}

void GamSetDataDir(const U8*dataDir_)
{
    dataDir = (U8*)gam_strdup((const char*)dataDir_);
}


EngineConfig g_engineConfig = {
    .armsPerMoney = 10,
    .armsPerDevotion = 20,
    .maxLevel = 20,
    .mainMenuButtonRects = {
        {6, 45, 73, 63}, //新君登基
        {83, 45, 151, 63}, //重返沙场
        {6, 70, 73, 88}, //制作群组
        {83, 71, 151, 88}, //解甲归田
    },
    .periodMenuButtonRects = {
        {0, 24, 78, 56}, //董卓弄权
        {0, 62, 78, 93}, //曹操崛起
        {81, 24, 158, 56}, //赤壁之战
        {81, 62, 158, 93}, //三国鼎立
    },
    .saveFaceListAnchor = { 31, 33 },
    .citiesCount = 38,
    .cityMapWidth = 12,
    .cityMapHeight = 9,
    .promptCityDisaster = 1, // 提示城池灾害
    .showStartMovie = 1, // 显示开场动画
    .compressCustomData = 0,
    .cacheCustomFont = 1,
    .theme = {
        .landMapColor = 0xcf,
        .ownedCityColor = 0xff,
        .emptyCityColor = 0xff,
        .otherCityColor = 0xff,
        .landCursorColor = 0xff,
        .battleNoteColor = 0xff,
        .kingHeadColor = 0xff,
        .personHeadColor = 0xff,
        .fightMoveRangeColor = 0xff,
        .fightMapColor = 0xcf,
    }
};

U8 g_engineDebug = 0;

void GamSetDebug(U8 enabled)
{
    g_engineDebug = enabled;
}

void GamLoadEngineConfig(void) {
    U8 buf[4];

    ResItemGetN(IFACE_CONID, dEngineConfig, (U8*)&g_engineConfig, sizeof(g_engineConfig));
    ResItemGetN(IFACE_CONID, DirectP, buf, sizeof(buf));
    if (buf[0] >= 0x08) {
        memcpy(&g_engineConfig.citiesCount, buf+1, 3);
    }
    FgtLoadConsts();   /* 初始化战斗参数 */
}

U16 add_16(U16 dst, int n)
{
    unsigned int rv = dst + n;
    U16 max = (U16)-1;
    if (rv > max) {
        return n > 0 ? max : 0;
    } else {
        return rv;
    }
}

U8* gam_getcustomdata() {
    return customData;
}

void gam_setcustomdata(U8*data) {
    if (customData) gam_free(customData);
    customData = (U8*)gam_strdup((char*)data);
}
