#ifndef BAYE_HD_BRIDGE_H
#define BAYE_HD_BRIDGE_H

#include "inc/dictsys.h"
#include "baye/data-bind.h"

#define BAYE_HD_KING_MAX 128
#define BAYE_HD_REPORT_MAX 1024
#define BAYE_HD_MENU_MAX 16384
#define BAYE_HD_NAME_SLOT 8
#define BAYE_HD_FIGHT_RESULT_MAX 64
#define BAYE_HD_FIGHT_TIP_MAX 16
#define BAYE_HD_FIGHT_PHASE_NONE 0
#define BAYE_HD_FIGHT_PHASE_PICK 1
#define BAYE_HD_FIGHT_PHASE_MOVE 2
#define BAYE_HD_FIGHT_PHASE_AIM  3
#define BAYE_HD_MENU_NATIVE 0xfe
#define BAYE_HD_MENU_CONTEXT_NONE 0
#define BAYE_HD_MENU_CONTEXT_CITY 1
#define BAYE_HD_MENU_CONTEXT_FUNCTION 2
#define BAYE_HD_MENU_CONTEXT_FIGHT 3
#define BAYE_HD_MENU_CONTEXT_SYSTEM 4
#define BAYE_HD_MENU_CONTEXT_CAMPAIGN 5
#define BAYE_HD_MENU_TITLE 1
#define BAYE_HD_MENU_PERIOD 2
#define BAYE_HD_MENU_KING 3
#define BAYE_HD_MENU_SUCCESSOR 1
#define BAYE_HD_CAMPAIGN_DEFENDERS 2
#define BAYE_HD_MENU_ROOT 1
#define BAYE_HD_MENU_SUB 2
#define BAYE_HD_MENU_PERSON 3
#define BAYE_HD_MENU_GOODS 4
#define BAYE_HD_FIGHT_INPUT_BUSY 0
#define BAYE_HD_FIGHT_INPUT_PICK 1
#define BAYE_HD_FIGHT_INPUT_MOVE 2
#define BAYE_HD_FIGHT_INPUT_ACTION 3
#define BAYE_HD_FIGHT_INPUT_SKILL 4
#define BAYE_HD_FIGHT_INPUT_AIM 5
#define BAYE_HD_FIGHT_INPUT_SYSTEM 6
#define BAYE_HD_FIGHT_INPUT_RETREAT 7
#define BAYE_HD_FIGHT_INPUT_SETTINGS 8
#define BAYE_HD_FIGHT_INPUT_HELP 9
#define BAYE_HD_FIGHT_INPUT_VIEW 10
#define BAYE_HD_MARCH_IDLE 0
#define BAYE_HD_MARCH_PERSONS 1
#define BAYE_HD_MARCH_FOOD 2
#define BAYE_HD_MARCH_TARGET_TIP 3
#define BAYE_HD_MARCH_TARGET_PICK 4
#define BAYE_HD_MARCH_REJECT_REPORT 5
#define BAYE_HD_MARCH_ARMOUT_REPORT 6
#define BAYE_HD_MARCH_DEPARTED 7
#define BAYE_HD_HELP_MAX 1024
#define BAYE_HD_SKILL_MAX 10
#define BAYE_HD_SKILL_NAME 8

#define BAYE_HD_REPORT_NONE 0
#define BAYE_HD_REPORT_MSGBOX 1
#define BAYE_HD_REPORT_GREPORT 2

#define BAYE_HD_SPE_KIND_OTHER 0
#define BAYE_HD_SPE_KIND_OPENING 1
#define BAYE_HD_SPE_KIND_SKILL 2
#define BAYE_HD_SPE_KIND_ATTACK 3
#define BAYE_HD_SPE_KIND_STATUS 4
#define BAYE_HD_SPE_VERSION 2
#define BAYE_HD_SPE_FRAME_BYTES 32
#define BAYE_HD_SPE_NO_FRAME 0xffff
#define BAYE_HD_SPE_END_COMPLETE 1
#define BAYE_HD_SPE_END_KEY 2
#define BAYE_HD_SPE_END_MISSING 3
#define BAYE_HD_SPE_END_INVALID 4
#define BAYE_HD_SPE_END_RESET 5
#define BAYE_HD_SPE_MAX_DEPTH 16

/* One scope belongs to one real PlcMovie call. Native stack lifetime makes
 * nested Mod calls restore their actual parent without a fixed stack overflow. */
typedef struct HdSpeScope {
    struct HdSpeScope* previous;
    U32 generation, eventId, parentEventId, commitSeq, resourceFingerprint, resourceLength;
    U16 depth, id, resourceIndex, count, picmax, frameIndex, skillId;
    I16 x, y;
    U8 kind, startFrm, endFrm, keyflag, frameValid, protocolValid, ready;
    U8 contextKnown, actorIndex, targetIndex;
    U8 visibleFrames[BAYE_HD_SPE_FRAME_BYTES];
} HdSpeScope;

#define VK_DIGIT0 0x40
#define BAYE_HD_QTY_NO_KEY 0xffff

#define BAYE_HD_FIGHT_SKIP_NONE 0
#define BAYE_HD_FIGHT_SKIP_EMPTY 1
#define BAYE_HD_FIGHT_SKIP_OWNED 2
#define BAYE_HD_FIGHT_SKIP_NO_ARMY 3
#define BAYE_HD_FIGHT_SKIP_INSTANT 4

extern U8 g_hdFightActive;
extern U16 g_hdKingCount;
extern U8 g_hdKingNames[BAYE_HD_KING_MAX * BAYE_HD_NAME_SLOT];
extern U8 g_hdFightActCommit;
extern U8 g_hdFightAllowRetreat;
extern U8 g_hdFightMenuControl;
extern U8 g_hdFightInputKind;
extern U32 g_hdFightInputSeq;
extern U8 g_hdFightActor;
extern U8 g_hdMenuActive;
extern U8 g_hdMenuContext;
extern U8 g_hdMenuKind;
extern U32 g_hdMenuSeq;
extern U8 g_hdRecordActive;
extern U8 g_hdRecordMode;
extern U8 g_hdRecordIndex;
extern U8 g_hdRecordCount;
extern U32 g_hdRecordSeq;
extern U8 g_hdReportActive;
extern U32 g_hdReportInputSeq;
extern U8 g_hdMapCity;
extern U8 g_hdSpePendingKind;
extern U8 g_hdSpeActive;
extern U16 g_hdSpeId;
extern U8 g_hdSpeKind;
extern U8 g_hdSpeX;
extern U8 g_hdSpeY;
extern U8 g_hdSpeStartFrm;
extern U8 g_hdSpeEndFrm;
extern U16 g_hdSpeSeq;

void baye_hd_bind(ObjectDef* def);
void baye_hd_set_ready(U8 ready);
void baye_hd_world_commit(void);
void baye_hd_set_report(const U8* gbk, U16 person, U8 kind);
void baye_hd_report_begin(U8 kind);
void baye_hd_report_end(void);
void baye_hd_record_begin(U8 mode, U8 index, U8 count);
void baye_hd_record_index(U8 index);
void baye_hd_record_end(void);
void baye_hd_set_kings(const PersonID* kings, U32 count);
void baye_hd_set_king_highlight(U32 index, PersonID id);
void baye_hd_set_menu(const U8* buf, U16 itemLen, U16 itemCount, U16 index);
void baye_hd_set_menu_index(U16 index);
void baye_hd_menu_scope(U8 context, U8 kind);
void baye_hd_menu_scope_default(U8 context, U8 kind);
void baye_hd_menu_begin(void);
void baye_hd_menu_end(void);
void baye_hd_fight_actor(U8 actor);
void baye_hd_fight_input_begin(U8 kind);
void baye_hd_fight_input_end(void);
U8 baye_hd_take_fight_action(U16* choice);
void baye_hd_map_input_begin(void);
void baye_hd_march_begin(U8 city);
void baye_hd_march_phase(U8 phase);
void baye_hd_march_selected(U8 count);
void baye_hd_march_end(U8 departed);
void baye_hd_set_fight(U8 active, U8 over);
void baye_hd_set_fight_wait(U8 wait);
void baye_hd_set_fight_phase(U8 phase);
void baye_hd_set_fight_aim(U8 type);
void baye_hd_set_fight_tip(const U8* gbk);
void baye_hd_clear_fight_tip(void);
void baye_hd_set_help(const U8* gbk);
void baye_hd_set_movie(U16 speId, U8 active);
void baye_hd_begin_spe(U8 kind);
void baye_hd_set_spe(U16 speId, U8 kind, U8 x, U8 y, U8 startfrm, U8 endfrm, U8 active);
void baye_hd_spe_tick(void);
void baye_hd_spe_context(U8 kind, U16 skillId, U8 actorIndex, U8 targetIndex);
void baye_hd_spe_enter(HdSpeScope* scope, U16 id, U16 resourceIndex, I16 x, I16 y, U8 startFrm, U8 endFrm, U8 keyflag);
void baye_hd_spe_ready(HdSpeScope* scope, U16 count, U16 picmax, U32 fingerprint, U32 resourceLength, U8 endFrm, U8 simplePictures);
void baye_hd_spe_frame(HdSpeScope* scope, U16 frameIndex, const U8* remaining, U16 introduced);
void baye_hd_spe_end(HdSpeScope* scope, U8 reason, U8 key);
void baye_hd_spe_invalidate(void);
void baye_hd_spe_lcd_copy(void);
void baye_hd_spe_lcd_dirty(void);
void baye_hd_spe_lcd_flush(void);
void baye_hd_set_skills(const U16* ids, const U8* names, U8 count, U8 nameLen, U8 active);
void baye_hd_set_qty(U32 value, U32 minV, U32 maxV, U8 active);
U32 baye_hd_qty_begin(void);
void baye_hd_qty_publish(U32 session, U32 value, U32 minV, U32 maxV, U8 cursor, U32 step, U16 key);
void baye_hd_qty_busy(U32 session);
void baye_hd_qty_end(U32 session, U32 value, U32 minV, U32 maxV, U16 key);
void baye_hd_qty_invalidate(void);
void baye_hd_set_map_pick(U8 active);
void baye_hd_set_battle_pick(U8 active);
void baye_hd_set_map_city(U8 city1);
void baye_hd_set_city_links(U8 city);
void baye_hd_set_march(U8 fromCity, U8 objCity, U8 timeCount, U8 ok);
void baye_hd_clear_march_ok(void);
void baye_hd_set_fight_skip(U8 reason);
void baye_hd_note_retreat_blocked(void);

#endif
