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
#define BAYE_HD_DETAIL_VERSION 1
#define BAYE_HD_DETAIL_IDS_MAX 2000
#define BAYE_HD_GOODS_PROPS_MAX 256
#define BAYE_HD_GOODS_TEXT_MAX 128
#define BAYE_HD_PERSON_PROPERTIES_VERSION 1
#define BAYE_HD_PERSON_PROPS_MAX 256
#define BAYE_HD_PERSON_TEXT_MAX 128
#define BAYE_HD_HELP_PERSON 1
#define BAYE_HD_HELP_TERRAIN 2
#define BAYE_HD_OVERVIEW_VERSION 1
#define BAYE_HD_VIEW_ROWS 10
#define BAYE_HD_VIEW_POINTS 20
#define BAYE_HD_VIEW_TEXT 64

/* A page belongs to the native wait that actually drew it. Retirement changes
 * after a report/reset, so a suspended older draw cannot restore stale data. */
typedef struct {
    U32 generation, inputSeq, retirement;
    U16 days, food, leader;
    U8 complete, custom, force, pageStart, pageSize, totalCount, rowCount;
    U8 mapWidth, mapHeight, playerMode, foodKnown, pointCount;
    U8 title[64], daysText[64], positionsText[64], factionText[64], foodText[64];
    U16 rowPersons[10], rowArms[10], pointPersons[20];
    U8 rowSlots[10], rowNames[10 * 32], rowText[10 * 64];
    U8 pointSlots[20], pointX[20], pointY[20], pointState[20];
} HdViewSnapshot;

void baye_hd_view_capture(HdViewSnapshot* snapshot);
void baye_hd_view_publish(const HdViewSnapshot* snapshot);
void baye_hd_view_clear(U32 generation, U32 inputSeq);
void baye_hd_view_retire(void);
void baye_hd_mini_map_publish(U32 generation, U32 inputSeq, U8 cursorX, U8 cursorY,
    U8 viewX, U8 viewY, U8 viewWidth, U8 viewHeight, U8 city1, U8 defaultDraw, U8 custom);
void baye_hd_mini_map_clear(U32 generation, U32 inputSeq);
void baye_hd_mini_map_retire(void);

/* Observations contain only values produced by the real native draw call. */
typedef struct {
    U32 generation;
    U16 person, fields[10];
    U8 kind, complete, slot, x, y, terrain, levelMax;
    U8 name[32], arm[16], state[32];
} HdHelpSnapshot;

extern U32 g_hdDetailGeneration;
U16 baye_hd_tool_count(void);
const U8* baye_hd_tool_data(void);
U8 baye_hd_tool_read(U16 index, void* output);
U16 baye_hd_person_arm(U16 person);
void baye_hd_menu_ids(U32 generation, U32 seq, U8 kind, const U16* ids, U32 count);
void baye_hd_goods_begin(U32 generation, U32 seq, U16 index, U16 tool, U16 properties, U16 pageStart, U8 custom);
void baye_hd_goods_capture(U32 generation, U32 seq, U16 tool, U16 property, const U8* text, U8 title);
void baye_hd_goods_name(U32 generation, U32 seq, U16 tool, const U8* name);
void baye_hd_goods_custom(U32 generation, U32 seq, U16 tool);
void baye_hd_goods_page(U32 generation, U32 seq, U16 end);
/* A local paint ticket is published only after the original menu and full
 * identity array have reached their actual selected row. */
U32 baye_hd_person_properties_begin(U32 generation, U32 seq, U16 index,
    const U16* ids, U32 count, U16 properties, U16 pageIndex, U16 pageStart);
void baye_hd_person_properties_capture(U32 ticket, U16 row, U16 person,
    U16 property, const U8* text, U8 title);
void baye_hd_person_properties_name(U32 ticket, U16 row, U16 person, const U8* name);
void baye_hd_person_properties_custom(U32 ticket, U16 row, U16 person);
void baye_hd_person_properties_publish(U32 ticket, U16 pageEnd);
void baye_hd_person_properties_retire(void);
void baye_hd_help_publish(const HdHelpSnapshot* snapshot, const U8* text);
void baye_hd_help_clear(U32 generation, U32 inputSeq);

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
#define BAYE_HD_COMPOSITION_VERSION 1
#define BAYE_HD_ATTACK_VERSION 1
#define BAYE_HD_ATTACK_MOVIE 1
#define BAYE_HD_ATTACK_NUMBERS 2
#define BAYE_HD_ATTACK_HOLD 3
#define BAYE_HD_ATTACK_DIGITS 10
#define BAYE_HD_SKILL_VERSION 1
#define BAYE_HD_SKILL_MOVIE 1
#define BAYE_HD_SKILL_NUMBERS 2
#define BAYE_HD_SKILL_HOLD 3
#define BAYE_HD_SKILL_DIGITS 10
#define BAYE_HD_SKILL_LABEL_BYTES 64
#define BAYE_HD_SKILL_ARMS_LOSS 1
#define BAYE_HD_SKILL_ARMS_GAIN 2
#define BAYE_HD_SKILL_PROVENDER_LOSS 3
#define BAYE_HD_SKILL_SCENE_BACKGROUND 1
#define BAYE_HD_SKILL_SCENE_OPAQUE 2
#define BAYE_HD_SKILL_SCENE_NESTED_OPAQUE 3
#define BAYE_HD_RESULT_ATTACK 1
#define BAYE_HD_RESULT_SKILL 2
#define BAYE_HD_AI_TARGET_VERSION 2
#define BAYE_HD_AI_TARGET_WIDTH 16
#define BAYE_HD_AI_TARGET_PIXELS 256
#define BAYE_HD_AI_TARGET_RGBA_BYTES 1024
#define BAYE_HD_STATUS_EFFECT_VERSION 1
#define BAYE_HD_STATUS_EFFECT_WIDTH 16
#define BAYE_HD_STATUS_EFFECT_PIXELS 256
#define BAYE_HD_STATUS_EFFECT_RGBA_BYTES 1024
#define BAYE_HD_STATUS_EFFECT_UPGRADE 1
#define BAYE_HD_STATUS_EFFECT_DEATH 2
#define BAYE_HD_STATUS_EFFECT_COMMAND 1
#define BAYE_HD_STATUS_EFFECT_INITIALIZE 2

/* Only the two actual FgtChkAtkEnd callers establish a status-check phase. */
typedef struct HdStatusCheckScope {
    struct HdStatusCheckScope* previous;
    U32 generation, token;
    U8 phase;
} HdStatusCheckScope;

typedef struct {
    U32 generation, checkToken;
    U8 reason, subjectIndex, subjectX, subjectY, level, experience, state;
    U16 subjectPerson, hp, arms;
} HdStatusTransition;

typedef struct {
    U8 valid, eligible, shapeValid, baseCaptured;
    U32 generation, checkToken;
    U8 reason, phase, subjectIndex, subjectX, subjectY;
    U16 subjectPerson, levelMax;
    U8 beforeLevel, afterLevel, beforeExperience, afterExperience, beforeState, afterState;
    U16 beforeHp, afterHp, beforeArms, afterArms;
    U8 mapSX, mapSY, mapWidth, mapHeight;
    U16 screenWidth, screenHeight, width, height;
    I16 x, y;
    U32 paletteZero, paletteInk;
    const U8* resourceBytes;
    U32 resourceLength, resourceFingerprint;
    U8 basePixels[BAYE_HD_STATUS_EFFECT_PIXELS];
    U8 baseRgba[BAYE_HD_STATUS_EFFECT_RGBA_BYTES];
    U32 capturedPalette[256];
    U8 clearFrames[BAYE_HD_SPE_FRAME_BYTES];
} HdStatusEffectSource;

/* Real native call stack, independent of whether its pixels remain HD-safe. */
typedef struct HdResultScope {
    struct HdResultScope* previous;
    U32 generation, session;
    U8 kind;
} HdResultScope;

typedef struct {
    U32 resourceFingerprint, resourceLength;
    U16 id, resourceIndex, pictureIndex, width, height, count;
    I16 x, y;
    U8 mask, valid;
} HdPictureSource;

/* Certified map-cell source for the real AI target hint, not a result owner.
 * Pixels are fixed before the first native draw; copies carry their own clears. */
typedef struct {
    U8 valid, eligible, shapeValid, baseCaptured;
    U32 generation;
    U8 commandType, actorIndex, targetIndex;
    U8 actorState, targetState;
    U16 commandParam, actorPerson, targetPerson;
    U8 actorX, actorY, targetX, targetY, mapSX, mapSY, mapWidth, mapHeight;
    U16 screenWidth, screenHeight, width, height;
    I16 x, y;
    U32 paletteZero, paletteInk;
    const U8* resourceBytes;
    U32 resourceLength, resourceFingerprint;
    U8 basePixels[BAYE_HD_AI_TARGET_PIXELS];
    U8 baseRgba[BAYE_HD_AI_TARGET_RGBA_BYTES];
    U32 capturedPalette[256];
    U8 clearFrames[BAYE_HD_SPE_FRAME_BYTES];
} HdAiTargetSource;

/* One scope belongs to one real PlcMovie call. Native stack lifetime makes
 * nested Mod calls restore their actual parent without a fixed stack overflow. */
typedef struct HdSpeScope {
    struct HdSpeScope* previous;
    U32 generation, eventId, parentEventId, commitSeq, resourceFingerprint, resourceLength;
    U32 resultSession;
    U16 depth, id, resourceIndex, count, picmax, frameIndex, skillId;
    I16 x, y;
    U8 kind, startFrm, endFrm, keyflag, frameValid, protocolValid, ready;
    U8 contextKnown, actorIndex, targetIndex;
    U8 visibleFrames[BAYE_HD_SPE_FRAME_BYTES];
    U8 compositionValid, clearFrames[BAYE_HD_SPE_FRAME_BYTES];
    HdPictureSource background;
    U8 sceneMode;
    I16 sceneX, sceneY;
    U16 sceneWidth, sceneHeight;
    /* Private, controlled-write coverage for opaque rectangles sharing an
     * origin. Resource bounds alone do not establish pixels on the surface. */
    U8 nestedEligible;
    I16 nestedX, nestedY;
    U16 nestedMaxWidth, nestedMaxHeight, nestedWidth, nestedHeight;
    U16 nestedUnitWidth[256], nestedUnitHeight[256];
    U8 nestedDrawnFrames[BAYE_HD_SPE_FRAME_BYTES];
    const U8* nestedResource;
    HdAiTargetSource aiTarget;
    HdStatusEffectSource statusEffect;
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
extern U32 g_hdMapInputSeq;
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
void baye_hd_ai_target_context(U8 commandType, U16 commandParam, U8 actor, U8 target, I16 x, I16 y);
void baye_hd_ai_target_shape(HdSpeScope* scope, const U8* bytes, U32 length);
void baye_hd_status_check_begin(HdStatusCheckScope* scope, U8 phase);
void baye_hd_status_check_end(HdStatusCheckScope* scope);
void baye_hd_status_before(HdStatusTransition* transition, U8 reason, U8 subject, U16 person);
void baye_hd_status_context(const HdStatusTransition* transition);
void baye_hd_status_discard(void);
void baye_hd_status_shape(HdSpeScope* scope, const U8* bytes, U32 length);
void baye_hd_spe_enter(HdSpeScope* scope, U16 id, U16 resourceIndex, I16 x, I16 y, U8 startFrm, U8 endFrm, U8 keyflag);
void baye_hd_spe_ready(HdSpeScope* scope, U16 count, U16 picmax, U32 fingerprint, U32 resourceLength, U8 endFrm, U8 simplePictures);
void baye_hd_spe_frame(HdSpeScope* scope, U16 frameIndex, const U8* remaining, U16 introduced);
void baye_hd_spe_end(HdSpeScope* scope, U8 reason, U8 key);
void baye_hd_spe_invalidate(void);
void baye_hd_spe_lcd_copy(void);
void baye_hd_spe_lcd_dirty(void);
void baye_hd_spe_lcd_flush(void);
U8 baye_hd_picture_info(U16 id, U16 item, U16 slot, const U8* bytes, U32 length, HdPictureSource* out);
const U8* baye_hd_picture_resource(U16 id, U16 item, U32* length);
void baye_hd_background_begin(void);
void baye_hd_background_end(const HdPictureSource* info);
void baye_hd_spe_draw_begin(HdSpeScope* scope);
void baye_hd_spe_draw_end(HdSpeScope* scope);
void baye_hd_spe_clear(HdSpeScope* scope, U16 absoluteUnit);
void baye_hd_spe_picture_drawn(HdSpeScope* scope, U16 absoluteUnit, I16 x, I16 y, U16 width, U16 height, U8 mask);
void baye_hd_surface_write(U8 virtualScreen);
U32 baye_hd_attack_begin(U8 actor, U8 target, U16 hurt, U8 custom);
void baye_hd_attack_numbers(U32 session);
void baye_hd_attack_hold(U32 session);
void baye_hd_attack_end(U32 session);
void baye_hd_attack_retire(void);
void baye_hd_attack_number_resource(const HdPictureSource* info);
void baye_hd_attack_digit_begin(U8 slot, U8 digit, I16 x, I16 y);
void baye_hd_attack_digit_end(void);

void baye_hd_result_scope_begin(HdResultScope* scope, U8 kind);
void baye_hd_result_scope_end(HdResultScope* scope);

/* Native skill results outlive their actual movie, without keeping SPE active. */
U32 baye_hd_skill_begin(U16 skill, U8 actor, U8 target, U8 resultKind, U8 custom);
void baye_hd_skill_numbers(U32 session, U8 resultKind, U16 value);
void baye_hd_skill_hold(U32 session);
void baye_hd_skill_end(U32 session);
void baye_hd_skill_retire(void);
void baye_hd_skill_movie_context(U32 session, U16 skill, U8 actor, U8 target);
void baye_hd_skill_movie_shape(HdSpeScope* scope, I16 x, I16 y, U16 width, U16 height, U8 opaque);
void baye_hd_skill_label_begin(U32 session, const U8* text, U16 capacity, I16 x, I16 y);
void baye_hd_skill_label_end(U32 session, U32 consumed);
void baye_hd_skill_number_resource(const HdPictureSource* info);
void baye_hd_skill_digit_begin(U8 slot, U8 digit, I16 x, I16 y);
void baye_hd_skill_digit_end(void);
/* GamMakerInf owns its original scroll and GamDelay hold independently of
 * the child SPE scope. The hold observes the actual copied LCD. */
#define BAYE_HD_MAKER_VERSION 1
#define BAYE_HD_MAKER_SCROLL 1
#define BAYE_HD_MAKER_HOLD 2
U32 baye_hd_maker_begin(U8 custom);
void baye_hd_maker_hold(U32 session);
void baye_hd_maker_end(U32 session);
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
