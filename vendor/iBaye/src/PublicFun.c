/***********************************************************************
 *Copyright (c)2005 , 东莞步步高教育电子分公司
 *All rights reserved.
 **
 文件名称：	PublicFun.c
 *文件标识：	步步高电子词典的游戏引擎模块
 *摘要：		游戏引擎公共模块
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
#undef	PublicFun
#define	PublicFun
#include "baye/enghead.h"
#include "touch.h"
#include "baye/script.h"
#include "hd-bridge.h"
#define		IN_FILE	1	/* 当前文件位置 */

/*本体函数声明*/
/*------------------------------------------*/
U8 *PlcItemShowS(U8 sx,U8 sy,U8 ex,U8 ey,U8 *buf);
U8 *strlchr(U8 *buf,U8 len,U8 ch);

static U8 hd_spe_resource_available(const U8* resource, U32 length)
{
    U8 chunk[512], ok = 1;
    U32 position, offset, remaining = length;
    size_t address = (size_t)resource, base = (size_t)g_CBnkPtr;
    if (!resource || !g_CBnkPtr || !g_LibFp || address < base || address - base > (U32)-1) return 0;
    offset = (U32)(address - base);
    if (length > (U32)-1 - offset) return 0;
    position = gam_ftell(g_LibFp);
    if (gam_fseek(g_LibFp, offset, SEEK_SET) != 0) return 0;
    /* ResGetItemLen reads a declaration. Verify that the complete declared
     * item actually exists before scanning its in-memory payload or tail. */
    while (remaining) {
        U16 wanted = remaining > sizeof(chunk) ? sizeof(chunk) : (U16)remaining;
        if (gam_fread(chunk, 1, wanted, g_LibFp) != wanted) { ok = 0; break; }
        remaining -= wanted;
    }
    /* JS ROM fseek rejects the exact EOF offset. Reading its last byte
     * restores a previously valid EOF tell without changing native data. */
    if (gam_fseek(g_LibFp, position, SEEK_SET) != 0 && position > 0 &&
        gam_fseek(g_LibFp, position - 1, SEEK_SET) == 0) {
        gam_fread(chunk, 1, 1, g_LibFp);
    }
    return ok;
}

/* Validate the actual resource item before legacy pointer arithmetic. The
 * fingerprint covers its complete native payload, including the SPE header. */
static U8 hd_spe_resource_valid(const U8* resource, U32 length, U8 startFrm, U8 endFrm, U8* simplePictures)
{
    U32 offset, i, rowBytes, rows, bytes;
    const SPERES* header;
    const SPEUNIT* units;
    if (!resource || length < sizeof(SPERES)) return 0;
    header = (const SPERES*)resource;
    if (!header->count || !header->picmax || startFrm > endFrm || endFrm >= header->count) return 0;
    offset = sizeof(SPERES) + (U32)header->count * sizeof(SPEUNIT);
    if (offset > length) return 0;
    units = (const SPEUNIT*)(resource + sizeof(SPERES));
    for (i = startFrm; i <= endFrm; i++) if (units[i].picIdx >= header->picmax) return 0;
    *simplePictures = 1;
    for (i = 0; i < header->picmax; i++) {
        const PictureHeadType* picture;
        if (length - offset < sizeof(PictureHeadType)) return 0;
        picture = (const PictureHeadType*)(resource + offset);
        if (!picture->wid || !picture->hig) return 0;
        rowBytes = ((U32)picture->wid + 7) / 8;
        rows = (U32)picture->hig * ((U32)picture->mask + 1);
        if (rowBytes > (length - offset - sizeof(PictureHeadType)) / rows) return 0;
        bytes = rowBytes * rows + sizeof(PictureHeadType);
        offset += bytes;
        if (picture->mask > 1) *simplePictures = 0;
    }
    return 1;
}

/* Derive only what the actual selected units can establish. A common opaque
 * rectangle needs no invented arena background; other shapes need real BACKPIC. */
static void hd_skill_resource_shape(HdSpeScope* scope, const U8* resource)
{
    const SPERES* header = (const SPERES*)resource;
    const SPEUNIT* units = (const SPEUNIT*)(resource + sizeof(SPERES));
    const PictureHeadType* pictures[256];
    U32 offset = sizeof(SPERES) + (U32)header->count * sizeof(SPEUNIT), i;
    I32 left = 32767, top = 32767, right = -32768, bottom = -32768;
    I32 firstX = 0, firstY = 0;
    U16 firstWidth = 0, firstHeight = 0;
    U8 opaque = 1;
    if (scope->kind != BAYE_HD_SPE_KIND_SKILL || !scope->contextKnown) return;
    /* PlcMovie's complete item validation precedes this bounded scan. */
    for (i = 0; i < header->picmax; ++i) {
        const PictureHeadType* p = (const PictureHeadType*)(resource + offset);
        pictures[i] = p;
        offset += sizeof(PictureHeadType) + (((U32)p->wid + 7) / 8) * p->hig * ((U32)p->mask + 1);
    }
    for (i = scope->startFrm; i <= scope->endFrm; ++i) {
        const PictureHeadType* p = pictures[units[i].picIdx];
        I32 x = (I32)scope->x + units[i].x, y = (I32)scope->y + units[i].y;
        if (i == scope->startFrm) { firstX = x; firstY = y; firstWidth = p->wid; firstHeight = p->hig; }
        if (p->mask || x != firstX || y != firstY || p->wid != firstWidth || p->hig != firstHeight) opaque = 0;
        if (x < left) left = x; if (y < top) top = y;
        if (x + p->wid > right) right = x + p->wid;
        if (y + p->hig > bottom) bottom = y + p->hig;
    }
    if (left < -32768 || top < -32768 || right > 32767 || bottom > 32767) {
        baye_hd_skill_movie_shape(scope, 0, 0, 0, 0, 0); return;
    }
    baye_hd_skill_movie_shape(scope, (I16)left, (I16)top, (U16)(right - left), (U16)(bottom - top), opaque);
}

static U32 hd_spe_resource_fingerprint(const U8* resource, U32 length)
{
    U32 hash = 2166136261u, i;
    for (i = 0; i < length; i++) hash = (hash ^ resource[i]) * 16777619u;
    return hash;
}

U8 baye_hd_picture_info(U16 id, U16 item, U16 slot, const U8* bytes, U32 length, HdPictureSource* out)
{
    const PictureHeadType* header;
    U32 plane, all;
    if (!out) return 0;
    memset(out, 0, sizeof(*out));
    if (!bytes || length < sizeof(PictureHeadType) || !hd_spe_resource_available(bytes, length)) return 0;
    header = (const PictureHeadType*)bytes;
    if (!header->wid || !header->hig || !header->count || slot >= header->count) return 0;
    plane = (((U32)header->wid + 7) / 8) * header->hig;
    /* Ordinary picture drawing uses mask bit 0. Keep the legacy unsupported
     * mask draw, while refusing its HD authority. Check every actual slot. */
    all = plane * ((header->mask & 1) + 1);
    if (all > (length - sizeof(PictureHeadType)) / header->count) return 0;
    out->id = id; out->resourceIndex = item; out->pictureIndex = slot;
    out->width = header->wid; out->height = header->hig; out->count = header->count;
    out->mask = header->mask; out->resourceLength = length;
    out->resourceFingerprint = hd_spe_resource_fingerprint(bytes, length);
    out->valid = header->mask <= 1;
    return 1;
}

/***********************************************************************
 * 说明:     播放指定的动画
 * 输入参数: speid 指定播放的对象,keyflag (00000010|00000001|00000100)背景处理|响应键盘|反转播放
 *           startfrm 起始帧,endfrm 结束帧, x,y 播放坐标
 * 返回值  : 0xff -- 非按键退出 ；其他值 -- 按键退出，按键的扫描码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             陈泽伟          2005-7-8 18:59       完成基本功能
 ***********************************************************************/
FAR U8 PlcMovie(U16 speid, U16 index, U8 startfrm,U8 endfrm,U8 keyflag,PT x,PT y)
{
    U8 *dat[512] = {0},*srsptr;
    PictureHeadType* phead;
    U32	 count;			/*桢数*/
    U32	 picmax;		/*最大图片序号*/
    U32 wid,high,picdatlen,maxdatlen,mode,lenspe;
    U32 i,clsflag,showflag;
    U32 mcount;
    I32 x1,y1;
    U8 ymount,spem[512] = {0},spec[512] = {0};
    SPEUNIT  *spe;
    HdSpeScope hdScope;
    U32 resourceLength;
    U8 simplePictures;

    lenspe = 0;
    clsflag = 1;
    showflag = 1;
    maxdatlen = 0;

    baye_hd_spe_enter(&hdScope, speid, index, x, y, startfrm, endfrm, keyflag);
    srsptr = ResLoadToCon(speid,index+1,g_CBnkPtr);
    if (NULL == srsptr)
    {
        printf("spe %d %d not found\n", speid, index);
        gamTraceP(speid);
        baye_hd_spe_end(&hdScope, BAYE_HD_SPE_END_MISSING, 0xff);
        return(0xff);
    }
    resourceLength = ResGetItemLen(speid, index + 1);
    if (resourceLength < sizeof(SPERES) || !hd_spe_resource_available(srsptr, resourceLength)) {
        baye_hd_spe_end(&hdScope, BAYE_HD_SPE_END_INVALID, 0xff);
        return 0xff;
    }
    endfrm = min(((SPERES*)srsptr)->endfrm, endfrm);
    if (!hd_spe_resource_valid(srsptr, resourceLength, startfrm, endfrm, &simplePictures)) {
        baye_hd_spe_end(&hdScope, BAYE_HD_SPE_END_INVALID, 0xff);
        return 0xff;
    }
    baye_hd_spe_ready(&hdScope, ((SPERES*)srsptr)->count, ((SPERES*)srsptr)->picmax,
        hd_spe_resource_fingerprint(srsptr, resourceLength), resourceLength, endfrm, simplePictures);
    baye_hd_ai_target_shape(&hdScope, srsptr, resourceLength);
    baye_hd_status_shape(&hdScope, srsptr, resourceLength);
    hd_skill_resource_shape(&hdScope, srsptr);

    count  = *(srsptr+2);
    picmax = *(srsptr+3);
    srsptr+=6;
    spe = (SPEUNIT *) srsptr;

    lenspe = count;
    srsptr += sizeof(SPEUNIT) * lenspe;
    for (i = 0;i <= endfrm - startfrm;i ++)
    {
        spem[i] = spe[i + startfrm].ndelay;
        spec[i] = spe[i + startfrm].cdelay;
    }
    for(i=0;i<picmax;i++)
    {
        phead = (PictureHeadType*)srsptr;
        wid = phead->wid;
        high = phead->hig;
        mode = phead->mask;

        picdatlen=wid/8;
        if(wid%8)
            picdatlen++;
        picdatlen*=high;
        picdatlen*=(mode+1);
        picdatlen+=sizeof(PictureHeadType);
        dat[i] = srsptr;
        srsptr += picdatlen;
    }
    mcount = 0;
    ymount = mcount;
    while (1)
    {
        baye_hd_spe_draw_begin(&hdScope);
        for (i = 0;i <= mcount;i ++)
        {
            if (spec[i] == 1)
            {
                if ((keyflag & 0x02) != 0x02)
                {
                    phead = (PictureHeadType*)dat[spe[i + startfrm].picIdx];
                    wid = phead->wid;
                    high = phead->hig;
                    x1 = x + spe[i + startfrm].x;
                    y1 = y + spe[i + startfrm].y;
                    gam_clrvscr(x1,y1,x1+(wid/AX_SCALE)-1,y1+(high/AX_SCALE)-1,g_VisScr);
                    baye_hd_spe_clear(&hdScope, (U16)(i + startfrm));
                }
                clsflag = 1;
            }
            if (spec[i] + 1 != 1)
                spec[i] --;
        }
        if (clsflag == 1)
        {
            for (i = 0;i <= ymount;i ++)
            {
                if (spec[i] + 1 != 1)
                {
                    phead = (PictureHeadType*)(dat[spe[i + startfrm].picIdx]);
                    wid = phead->wid;
                    high = phead->hig;
                    mode = phead->mask;
                    x1 = x + spe[i + startfrm].x;
                    y1 = y + spe[i + startfrm].y;
                    if(mode==1)
                        GamMPicShowV(x1,y1,wid,high,dat[spe[i + startfrm].picIdx] + sizeof(PictureHeadType),g_VisScr);
                    else
                        GamPicShowV(x1,y1,wid,high,dat[spe[i + startfrm].picIdx] + sizeof(PictureHeadType),g_VisScr);
                }
            }
        }
        if (showflag == 1)
        {
            for (i = ymount + 1;i <= mcount;i ++)
                if (spec[i] + 1 != 1)
                {
                    phead = (PictureHeadType*)(dat[spe[i + startfrm].picIdx]);
                    wid = phead->wid;
                    high = phead->hig;
                    mode = phead->mask;
                    x1 = x + spe[i + startfrm].x;
                    y1 = y + spe[i + startfrm].y;
                    if(mode==1)
                        GamMPicShowV(x1,y1,wid,high,dat[spe[i + startfrm].picIdx] + sizeof(PictureHeadType),g_VisScr);
                    else
                        GamPicShowV(x1,y1,wid,high,(dat[spe[i + startfrm].picIdx] + sizeof(PictureHeadType)),g_VisScr);
                }
            ymount = mcount;
        }
        baye_hd_spe_draw_end(&hdScope);
        if (showflag == 1 || clsflag == 1)
        {
            baye_hd_spe_frame(&hdScope, (U16)(mcount + startfrm), spec, (U16)(mcount + 1));
            GamShowFrame(g_VisScr);
            baye_hd_spe_tick();
            showflag = 0;
            clsflag = 0;
        }
        else
        {
            U8 key = GamDelay(1, keyflag);				/* 延时1%秒 */
            if (key && (keyflag & 0x01)) {
                baye_hd_spe_end(&hdScope, BAYE_HD_SPE_END_KEY, key);
                return key;
            }
        }
        if (spem[mcount] >= 1)
            spem[mcount] --;
        while ((spem[mcount] <= 1) && (mcount + startfrm < endfrm))
        {
            mcount ++;
            showflag = 1;
        }
        if (mcount + startfrm >= endfrm)
        {
            for (i = 0;i <= mcount;i ++)
            {
                if(spec[i] > 1)
                    break;
            }
            if (i > mcount)
                break;
        }
    }
    baye_hd_spe_end(&hdScope, BAYE_HD_SPE_END_COMPLETE, 0xff);
    return(0xff);
}
/***********************************************************************
 * 说明:     简单的菜单控件
 * 输入参数: pRect-菜单显示范围	pIdx-初始选中项	buf-菜单内容缓冲
 * 返回值  : 0xFF-跳出		其他-菜单选项
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR U16 PlcSplMenuInner(RECT *pRect,U16 pIdx,U8 *buf);
FAR U16 PlcSplMenu(RECT *pRect,U16 pIdx,U8 *buf) {
    int prev = SysScrollingTimerOpen(5);
    baye_hd_menu_begin();
    U16 rv = PlcSplMenuInner(pRect, pIdx, buf);
    baye_hd_menu_end();
    SysScrollingTimerOpen(prev);
    return rv;
}
FAR U16 PlcSplMenuInner(RECT *pRect,U16 pIdx,U8 *buf)
{
    U16	sy,ty,pageChanged,selChanged;
    U16	pLen;	/* 每个菜单项字符长度 */
    U16	pItm;	/* 菜单项总数 */
    U16	pSIdx;	/* 显示起始菜单项 */
    U16	pICnt;	/* 菜单显示区能显示的项数 */
    U16	poff;	/* 数据偏移 */
    float	tcot;
    GMType	pMsg;	/* 消息 */
    Touch touch = {0};
    U8 touchStartIndex = 0;
    U8 itemHeight = ASC_HGT;
    U8 lastInd = 0;

    /* 初始化显示范围 */
    c_ReFlag = false;
    c_Sx = pRect->sx;
    c_Ex = pRect->ex;
    c_Sy = pRect->sy;
    c_Ey = pRect->ey;

    IF_HAS_HOOK("willOpenMenu") {
        BIND_U16EX("index", &pIdx);
        CALL_HOOK();
    }
    IF_HAS_HOOK("willChangeMenuSelection") {
        BIND_U16EX("index", &pIdx);
        CALL_HOOK();
    }
    /* 计算参数 */
    pLen = (c_Ex - c_Sx) / ASC_WID;
    pICnt = (c_Ey - c_Sy) / itemHeight;
    pItm = gam_strlen(buf) / pLen;
    pSIdx = 0;
    if(pICnt < pItm)
        pSIdx = pIdx;

    if (pICnt > pItm)
        pICnt = pItm;

    Rect menuRect = {c_Sx - 3,c_Sy - 3,c_Ex + 2,c_Ey + 2};
    /* 初始化界面 */
    gam_clrlcd(c_Sx - 3,c_Sy - 3,c_Ex + 2,c_Ey + 2);
    gam_rect(menuRect.left, menuRect.top, menuRect.right, menuRect.bottom);
    if(pItm > pICnt)
    {
        gam_clrlcd(c_Ex + 2,c_Sy - 3,c_Ex + 6,c_Ey + 2);
        gam_rect(c_Ex + 2,c_Sy - 3,c_Ex + 6,c_Ey + 2);
        gam_rect(c_Ex + 2,c_Sy - 1,c_Ex + 6,c_Ey);
        if(pSIdx + pICnt > pItm)
            pSIdx = pItm - pICnt;
    }
    poff = pSIdx;
    poff *= pLen;
    GamStrShowS(c_Sx,c_Sy,buf + poff);
    /* 初始化光标 */
    sy = c_Sy + (pIdx - pSIdx) * itemHeight;
    gam_revlcd(c_Sx,sy,c_Ex,sy + itemHeight);
    ty = c_Sy;
    selChanged = true;
    while(1)
    {
        if(pItm > pICnt)
        {
            if(selChanged)
            {	/* 驱动滚动条 */
                gam_rectc(c_Ex + 3,ty,c_Ex + 5,ty + 2);
                gam_putpixel(c_Ex + 4,ty + 1,COLOR_WHITE);
                tcot = limitValueInRange(pIdx, pSIdx, pSIdx+pICnt);
                tcot /= pItm - 1;
                ty = tcot * (c_Ey - c_Sy - 3) + c_Sy;
                gam_rect(c_Ex + 3,ty,c_Ex + 5,ty + 2);
                selChanged = false;
            }
            gam_revlcd(c_Ex + 3,ty,c_Ex + 5,ty + 2);
        }

        baye_hd_set_menu(buf, pLen, pItm, pIdx);
        IF_HAS_HOOK("onMenuIdle") {
            BIND_U16EX("index", &pIdx);
            BIND_U16EX("itemLen", &pLen);
            BIND_U16EX("itemCount", &pItm);
            CALL_HOOK();
        }

        pageChanged = false;
nextMsg:
        if (baye_hd_take_fight_action(&pIdx)) {
            goto RET;
        }
        GamGetMsg(&pMsg);
        if (baye_hd_take_fight_action(&pIdx)) {
            goto RET;
        }

        if (VM_TOUCH == pMsg.type)
        {
            touchUpdate(&touch, pMsg);
            switch (pMsg.param) {
                case VT_TOUCH_DOWN:
                {
                    touchStartIndex = pSIdx;
                    break;
                }
                case VT_TOUCH_UP:
                {
                    if (touch.completed && !touch.moved) {
                        I16 index = touchListViewItemIndexAtPoint(touch.currentX, touch.currentY, menuRect, 3, 3, pSIdx, pItm, itemHeight);
                        if (index >= 0 && index != pIdx) {
                            pIdx = index;
                            pageChanged = 1;
                            selChanged = 1;
                        }
                        if (index < 0)
                        {
                            pIdx = 0xFFFF;
                        } else if (g_MenuTouchComfirm && index != lastInd) {
                            lastInd = index;
                            break;
                        }
                        goto RET;
                    }
                    break;
                }
                case VT_TOUCH_MOVE:
moveView:
                {
                    I16 dy = touch.currentY - touch.startY;
                    I16 dItems = dy / itemHeight;
                    I16 startIndex = touchStartIndex - dItems;
                    startIndex = limitValueInRange(startIndex, 0, pItm-pICnt);
                    touchUpdateViewState(
                        &touch,
                        3,
                        pointState(startIndex, 0, pItm-pICnt)
                    );
                    if (startIndex != pSIdx) {
                        pSIdx = startIndex;
                        poff = pSIdx*pLen;
                        pageChanged = 1;
                        selChanged = 1;
                    } else {
                        goto nextMsg;
                    }
                    break;
                }
                default:
                    break;
            }
            goto UPDATE_UI;
        } else if (GamMsgIsTimer0(pMsg)) {
            if (touchUpdate(&touch, pMsg)) {
                goto moveView;
            }
            goto nextMsg;
        }

        if(VM_CHAR_FUN != pMsg.type)
            continue;
        touchUpdate(&touch, pMsg);
        switch(pMsg.param)
        {
            case VK_SEARCH:
            case VK_PGUP:
            {
                if (pSIdx > pICnt) {
                    pSIdx -= pICnt;
                } else if (pSIdx) {
                    pSIdx = 0;
                } else {
                    break;
                }
                poff = pSIdx * pLen;
                pageChanged = true;
                selChanged = true;
                break;
            }
            case VK_HELP:
            case VK_PGDN:
            {
                if (pSIdx + pICnt < pItm) {
                    pSIdx += pICnt;
                } else {
                    break;
                }
                poff = pSIdx * pLen;
                pageChanged = true;
                selChanged = true;
                break;
            }
                break;
            case VK_UP:
                pIdx = limitValueInRange(pIdx, pSIdx, pSIdx + pICnt);
                if(!pIdx)
                {
                    pIdx = pItm - 1;
                    pSIdx = pItm - pICnt;
                    poff = pSIdx * pLen;
                    pageChanged = true;
                    selChanged = true;
                    break;
                }
                if(pIdx)
                {
                    pIdx -= 1;
                    selChanged = true;
                }
                if(pIdx < pSIdx)
                {
                    pSIdx -= 1;
                    poff -= pLen;
                    pageChanged = true;
                }
                break;
            case VK_DOWN:
                pIdx = limitValueInRange(pIdx, pSIdx ? pSIdx-1 : 0, pSIdx + pICnt-1);
                if(pIdx == pItm - 1)
                {
                    pIdx = 0;
                    pSIdx = 0;
                    poff = 0;
                    pageChanged = true;
                    selChanged = true;
                    break;
                }
                if(pIdx < pItm - 1)
                {
                    pIdx += 1;
                    selChanged = true;
                }
                if(pIdx - pSIdx >= pICnt)
                {
                    pSIdx += 1;
                    poff += pLen;
                    pageChanged = true;
                }
                break;
            case VK_EXIT:
                pIdx = 0xFFFF;
            case VK_ENTER:
                goto RET;
        }
UPDATE_UI:
#define UPDATE_UI() \
        if(pageChanged || selChanged) { \
            IF_HAS_HOOK("willChangeMenuSelection") { \
                BIND_U16EX("index", &pIdx); \
                CALL_HOOK(); \
            } \
            gam_clrlcd(c_Sx, c_Sy, c_Ex, c_Ey); \
            GamStrShowS(c_Sx,c_Sy,buf + poff); \
            if (pIdx >= pSIdx && pIdx < pSIdx + pICnt) { \
                sy = c_Sy + (pIdx - pSIdx) * ASC_HGT; \
                gam_revlcd(c_Sx,sy,c_Ex,sy + ASC_HGT); \
            } \
        }

        UPDATE_UI();
    }
RET:
    UPDATE_UI();
    c_ReFlag = true;
    c_Sx = WK_SX;
    c_Sy = WK_SY;
    c_Ex = WK_EX;
    c_Ey = WK_EY;
    IF_HAS_HOOK("willCloseMenu") {
        BIND_U16EX("index", &pIdx);
        CALL_HOOK();
    }
    return pIdx;
}
/***********************************************************************
 * 说明:     居中显示指定字符串
 * 输入参数: x,y-指定位置		buf-字符串
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR void PlcMidShowStr(PT x,PT y,U8 *buf)
{
    U8	pLen;

    pLen = gam_strlen(buf) * ASC_WID;
    pLen >>= 1;
    x -= pLen;
    GamStrShowS(x,y,buf);
}
/***********************************************************************
 * 说明:     显示图形边框的消息框(只能显示一行)
 * 输入参数: buf-显示的消息	delay-显示延时(秒)
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR void PlcGraMsgBox(U8 *buf,U8 delay,U8 line)
{
    U16	x,y,w,h;
    U8	*ptr;

    ptr = ResLoadToCon(MSGBOX_PIC,1,g_CBnkPtr);
    PictureHeadType *head = (PictureHeadType *)ptr;
    w = head->wid/AX_SCALE;
    h = head->hig/AX_SCALE;
    x = (WK_EX - WK_SX - w) / 2;
    x += WK_SX;
    if(line != 0xFF)
        y = WK_SY + line * HZ_HGT;
    else
    {
        y = (WK_EY - WK_SY - h) >> 1;
        y += WK_SY;
    }
    gam_drawpic(MSGBOX_PIC, 0, x, y, 1);
    GamStrShowS(x + 10,y + 6,buf);
    GamDelay(delay * 100, 2);
}

U16 sqrt32(U32 a)
{
    U32 rem = 0;
    U32 root = 0;
    U32 divisor = 0;
    for(U8 i=0; i<16; i++){
        root <<= 1;
        rem = ((rem << 2) + (a >> 30));
        a <<= 2;
        divisor = (root<<1) + 1;
        if(divisor <= rem){
            rem -= divisor;
            root++;
        }
    }
    return (U16)(root);
}

/***********************************************************************
 * 说明:     获取一个255以内的平方根(整数)
 * 输入参数: num-返回值的平方
 * 返回值  : 平方根
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR U8 PlcExtract(U16 num)
{
    return sqrt32(num);
}
/***********************************************************************
 * 说明:     显示数字到虚拟屏幕
 * 输入参数: x,y-显示坐标	num-显示数字	dig-显示位数
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
const U32 FgtDigMask[10]={1,10,100,1000,10000,100000,1000000,10000000,100000000,1000000000};
FAR void PlcNumShow(PT x,PT y,U32 num,U8 dig,U8 *vs)
{
    U8	slen,*ptr,buf[12],numb[12];
    U32	tnum;

    ptr = buf;
    gam_memset(buf,0x30,12);
    tnum = num % FgtDigMask[dig];
    gam_ltoa(tnum,numb,10);
    slen = gam_strlen(numb);
    if(slen <= dig && num >= FgtDigMask[dig])
        ptr += dig - slen;

    gam_memcpy(ptr,numb,slen + 1);
    if(vs == NULL)
        GamStrShowS(x,y,buf);
    else
        GamStrShowV(x,y,buf,vs);
}
/***********************************************************************
 * 说明:     显示指定的资源图片到虚拟屏幕
 * 输入参数: id,idx-指定要显示的对象	x,y-显示的坐标	flag-true屏幕 false内存
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR void PlcRPicShow(U16 id,U16 idx,PT x,PT y,U8 flag) {
    PlcRPicShowEx(id, 0, idx, x, y, flag);
}

FAR void PlcRPicShowEx(U16 id, U16 item, U16 idx,PT x,PT y,U8 flag)
{
    U8	*pic;
    U16	wid,high;
    U8 mode;
    U32	off;
    PictureHeadType* p;
    HdPictureSource info;
    U8 observed = id == SPE_BACKPIC || id == NUM_PICID;
    U32 observedLength = 0;

    pic = observed ? (U8*)baye_hd_picture_resource(id, item, &observedLength) : ResLoadToCon(id,item+1,g_CBnkPtr);
    memset(&info, 0, sizeof(info));
    if (observed && (!idx || !baye_hd_picture_info(id, item, idx - 1, pic, observedLength, &info))) {
        if (id == SPE_BACKPIC && !flag) { baye_hd_background_begin(); baye_hd_background_end(NULL); }
        if (id == NUM_PICID && flag) { baye_hd_attack_number_resource(NULL); baye_hd_skill_number_resource(NULL); }
        return;
    }
    if(NULL == pic)
        return;
    p = (PictureHeadType*)pic;
    if(idx > p->count)
        return;
    wid = p->wid;
    high = p->hig;
    mode = p->mask & 0x01;
    off = wid >> 3;
    if(wid & 0x07)
        off += 1;
    off *= high;
    off <<= mode;
    off *= idx - 1;
    pic += off;
    pic += PICHEAD_LEN;

    if(!flag)
    {
        if (id == SPE_BACKPIC) baye_hd_background_begin();
        if(mode)
            GamMPicShowV(x,y,wid,high,pic,g_VisScr);
        else
            GamPicShowV(x,y,wid,high,pic,g_VisScr);
        if (id == SPE_BACKPIC) {
            info.x = x; info.y = y;
            baye_hd_background_end(&info);
        }
    }
    else
    {
        if (id == NUM_PICID) { baye_hd_attack_number_resource(&info); baye_hd_skill_number_resource(&info); }
        if(mode)
            GamMPicShowS(x,y,wid,high,pic);
        else
            GamPicShowS(x,y,wid,high,pic);
    }
}

/***********************************************************************
 * 说明:     获取指定将领的兵力上限
 * 输入参数: 无
 * 返回值  : 0-操作成功		!0-错误代码
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR U16 PlcArmsMax(PersonID id) {
    IF_HAS_HOOK("getMaxArms") {
        U32 maxArms = 0;
        BIND_U16EX("personIndex", &id);
        BIND_U32(&maxArms);
        if (CALL_HOOK() == 0) {
            HOOK_RETURN(maxArms);
        }
    }
    return PlcArmsMaxP(&g_Persons[id]);
}

FAR U16 PlcArmsMaxP(PersonType* p)
{
    U32	armys = 0;
    if (g_engineConfig.enableCustomRatio) {
        armys += p->Level * g_engineConfig.ratioOfArmsToLevel;
        armys += p->Age * g_engineConfig.ratioOfArmsToAge;
        armys += p->Force * g_engineConfig.ratioOfArmsToForce;
        armys += p->IQ * g_engineConfig.ratioOfArmsToIQ;
        if (armys > 0xfffe)
            armys = 0xfffe;
    } else {
        armys += p->Level * 100;
        armys += p->Force * 10;
        armys += p->IQ * 10;
    }
    return (U16)armys;
}
/***********************************************************************
 * 说明:     显示指定字符串到big内small外的区域中
 * 输入参数: big,small-指定区域	buf-字符串
 * 返回值  : 无
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
FAR void PlcStrShowS(RECT *big,RECT *small,U8 *buf)
{
    U8	*ptr,i,tmp;
    U8	sx[4],sy[4],ex[4],ey[4];
    U32	sLen;
    
    tmp = big->sx;
    sx[0] = tmp;
    sx[1] = tmp;
    sx[3] = tmp;
    sx[2] = small->ex;
    sy[0] = big->sy;
    tmp = small->sy;
    sy[1] = tmp;
    sy[2] = tmp;
    sy[3] = small->ey;
    tmp = big->ex;
    ex[0] = tmp;
    ex[2] = tmp;
    ex[3] = tmp;
    ex[1] = small->sx;
    ey[0] = small->sy;
    tmp = small->ey;
    ey[1] = tmp;
    ey[2] = tmp;
    ey[3] = big->ey;
    
    ptr = buf;
    sLen = gam_strlen(buf);
    for(i = 0;i < 4;i += 1)
    {
        ptr = PlcItemShowS(sx[i],sy[i],ex[i],ey[i],ptr);
        if(ptr >= buf + sLen)
            return;
    }
}
/***********************************************************************
 * 说明:     根据当前范围按照项截取显示指定的字符串
 * 输入参数: sx,sy,ex,ey-指定范围		buf-要显示的项字符串(项的分割符是'|')
 * 返回值  : 下次要显示时的数据指针
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
U8 *PlcItemShowS(U8 sx,U8 sy,U8 ex,U8 ey,U8 *buf)
{
    c_Sx = sx;
    c_Sy = sy;
    c_Ex = ex;
    c_Ey = ey;
    return buf + GamStrShowS(sx,sy,buf);
}
/***********************************************************************
 * 说明:     从len处向左查找字符串buf中给定的字符ch，并返回指针。
 * 输入参数: sx,sy,ex,ey-指定范围		buf-要显示的项字符串(项的分割符是'|')
 * 返回值  : !NULL-查找成功	NULL-查找失败
 * 修改历史:
 *               姓名            日期             说明
 *             ------          ----------      -------------
 *             高国军          2005.5.16       完成基本功能
 ***********************************************************************/
U8 *strlchr(U8 *buf,U8 len,U8 ch)
{
    U8	i;
    
    for(i = len;i-0 > 0;i -= 1)
    {
        if(buf[i] == ch)
            return (buf + i);
    }
    return ((U8 *)NULL);
}

PersonID GamChoosePerson(PersonID* pqptr, U32 pcount, PersonID selected)
{
    return ShowPersonControl(pqptr, pcount, selected, WK_SX + 4, WK_SY + 2, WK_EX - 4, WK_EY - 2);
}

U16 GamChoose(U16 x, U16 y, U16 w, U16 h, U16 pIdx, U8* buf)
{
    RECT r = {
        .sx = x,
        .sy = y,
        .ex = x + w,
        .ey = y + h,
    };
    U8* s = gam_strdup(buf);
    U16 rv = PlcSplMenu(&r, pIdx, s);
    gam_free(s);
    return rv;
}
