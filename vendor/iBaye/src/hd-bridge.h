#ifndef BAYE_HD_BRIDGE_H
#define BAYE_HD_BRIDGE_H

#include "inc/dictsys.h"
#include "baye/data-bind.h"

#define BAYE_HD_KING_MAX 128
#define BAYE_HD_REPORT_MAX 1024
#define BAYE_HD_MENU_MAX 2048
#define BAYE_HD_NAME_SLOT 8
#define BAYE_HD_FIGHT_RESULT_MAX 64
#define BAYE_HD_HELP_MAX 1024

#define BAYE_HD_REPORT_NONE 0
#define BAYE_HD_REPORT_MSGBOX 1
#define BAYE_HD_REPORT_GREPORT 2

#define VK_DIGIT0 0x40

void baye_hd_bind(ObjectDef* def);
void baye_hd_set_ready(U8 ready);
void baye_hd_set_report(const U8* gbk, U16 person, U8 kind);
void baye_hd_set_kings(const PersonID* kings, U32 count);
void baye_hd_set_king_highlight(U32 index, PersonID id);
void baye_hd_set_menu(const U8* buf, U16 itemLen, U16 itemCount, U16 index);
void baye_hd_set_fight(U8 active, U8 over);
void baye_hd_set_fight_wait(U8 wait);
void baye_hd_set_help(const U8* gbk);
void baye_hd_set_movie(U16 speId, U8 active);
void baye_hd_set_qty(U32 value, U32 minV, U32 maxV, U8 active);
void baye_hd_set_map_pick(U8 active);
void baye_hd_set_city_links(U8 city);
void baye_hd_set_march(U8 fromCity, U8 objCity, U8 timeCount, U8 ok);

#endif
