#!/usr/bin/env node
// Actual-C AID skill17/29: CountSklHurt, LIB41, NUM15 and the real font.
// CountOverAdd is actual C; capacity/attributes/RNG/message delivery are fixture
// boundaries. No player AIM, natural success, troop recruitment or browser claim.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test,{after} from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),run=promisify(execFile),temporary=[];
const read=file=>readFileSync(join(root,'vendor/iBaye/src',file),'utf8').replace(/\r\n/g,'\n');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const nativeSourceFiles=['FgtCount.c','baye/attribute.h','FightSub.c','PublicFun.c','hd-bridge.c','hd-bridge.h','platform/common/sys.c','comOut.c','comIn.c','datman.c','gamEng.c','baye/consdef.h','baye/fight.h','baye/graph.h','baye/datman.h','baye/paccount.h','baye/comm.h','inc/dictsys.h','data/pstring.h','platform/js/font.bin.c','platform/js/fsys.c'];
const nativeSourceTuple=Object.fromEntries(nativeSourceFiles.map(file=>[file,sha(readFileSync(join(root,'vendor/iBaye/src',file)))]));
function signature(name){return new RegExp('^(?:(?:static|inline|FAR|const)\\s+)*(?:[A-Za-z_]\\w*)[\\t *]+'+name+'\\([^;]*?\\)\\s*\\{','m');}
function actual(file,name){const source=read(file),m=signature(name).exec(source);assert.ok(m,`actual ${file}::${name}`);const end=source.indexOf('\n}',m.index);assert.ok(end>m.index);return source.slice(m.index,end+2);}
function type(file,name){const m=new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*'+name+';').exec(read(file));assert.ok(m,`actual ${name}`);return m[0];}
function nativeFunctions(file,seeds){const source=read(file),found=new Map();function add(name){if(found.has(name)||['if','for','while','switch','sizeof','EM_ASM','EM_ASM_INT'].includes(name))return;let body;try{body=actual(file,name);}catch{return;}found.set(name,body);for(const call of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))if(signature(call[1]).test(source))add(call[1]);}seeds.forEach(name=>{assert.ok(signature(name).test(source),`production ${file}::${name}`);add(name);});return{prototypes:[...found.values()].map(b=>b.slice(0,b.indexOf('{')).trim()+';').join('\n'),functions:[...found.values()].join('\n')};}
async function compile(source,label){const dir=mkdtempSync(join(tmpdir(),'baye-hd-skill-'));temporary.push(dir);const filename=join(dir,label+'.c'),binary=join(dir,label+(process.platform==='win32'?'.exe':''));writeFileSync(filename,source);try{await run(process.env.CC||'cc',['-std=c99','-fpack-struct=1','-Wall','-Wextra',filename,'-o',binary],{timeout:30000});}catch(e){throw Error('Actual skill C compilation failed: '+(e.stderr?.split(/\r?\n/).filter(l=>/error:|fatal error:/.test(l)).join('\n')||e.message));}return{dir,binary};}
after(()=>{for(const dir of temporary){assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('baye-hd-skill-'));rmSync(dir,{recursive:true,force:true});}for(const[file,hash]of Object.entries(nativeSourceTuple))assert.equal(sha(readFileSync(join(root,'vendor/iBaye/src',file))),hash,'Actual C source changed during compiled acceptance: '+file);});

const lib=readFileSync(join(root,'libs/dat-mod.lib'));
assert.equal(sha(lib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
const fontSource=read('platform/js/font.bin.c');
const font=Buffer.from([...fontSource.matchAll(/0x([\da-f]{2})/gi)].map(m=>parseInt(m[1],16)));
assert.equal(font.length,163840);assert.equal(sha(font),'31197c48c77e82bc244b17f44e405a3a055df8162af06fadd7271cc1990cc6b8');
assert.deepEqual(font,readFileSync(join(root,'vendor/iBaye/src/font.bin')));
assert.match(read('platform/js/fsys.c'),/static const U8 font\[\]\s*=\s*#include "font\.bin\.c"/);

const base=String.raw`
#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8; typedef uint16_t U16; typedef uint32_t U32;
typedef int8_t BOOL; typedef int16_t I16; typedef int32_t I32; typedef int16_t PT;
#define MAX_LEVEL 30
#define FGT_EXPMAX 100
#define FAR
#define AX_SCALE 1
#define SCR_WID 160
#define SCR_HGT 96
#define SCR_W g_screenWidth
#define SCR_H g_screenHeight
#define BYTES_PERLINE SCR_W
#define MAX_SCR_BUF_LEN (160*96)
#define CLR 0
#define DOT 1
#define min(a,b) ((a)<(b)?(a):(b))
#define gam_memset memset
#define gam_selectscr SysSelectScreen
#define gam_clrvscr GamClearScreenV
#define gam_strlen(p) strlen((const char*)(p))
static int g_screenWidth=160,g_screenHeight=96;
static U8 g_FlipDrawing=0,g_paintColor=255,g_VisScr[160*96];
static U32 g_paintPalette[256];
static char *static_buffer,*backup_buffer,*buffer,*scr_buffer;
static size_t buffer_size;
static int isLcdDirty;
static void (*_lcd_fluch_cb)(char*);
static void *gam_malloc(size_t n){return malloc(n);}
static void gam_free(void*p){free(p);}
typedef struct {U8*bytes;U32 length,position;} NativeFile;
typedef NativeFile gam_FILE;
static U32 gam_ftell(NativeFile*f){return f->position;}
static int gam_fseek(NativeFile*f,U32 offset,int origin){U32 next=origin==SEEK_CUR?f->position+offset:offset;if(next>=f->length)return -1;f->position=next;return 0;}
static U16 gam_fread(void*out,U16 size,U16 count,NativeFile*f){U32 n=(U32)size*count;if(n>f->length-f->position)n=f->length-f->position;memcpy(out,f->bytes+f->position,n);f->position+=n;return (U16)(n/size);}
`;
const pixels=['screen_buffer_realloc','_insideScreen','convert_image','timed_flush_lcd','flushLcd','_dot','SysLcdPartClear','DecodePic','SysPictureEx','SysPicture','SysSelectScreen','SysCopyScreen','SysSaveScreen','SysRestoreScreen','SysAdjustLCDBuffer'].map(n=>actual('platform/common/sys.c',n)).join('\n');
const textFunctions=nativeFunctions('comOut.c',['GamStrShowS','GamSetFont','GamSetFontEn','CountHZMAddrOff','CountHZMAddrOffAscii0','CountHZMAddrOffAscii1']);
const textConstants=(read('baye/consdef.h')+'\n'+read('baye/comm.h')).split('\n').filter(l=>/^#define\s+(?:WK_SX|WK_SY|WK_EX|WK_EY|HZ_WID|HZ_HGT|ASC_WID|ASC_HGT|GAM_FONT_ASC_QU)\b/.test(l)).join('\n');
const textGlobals=String.raw`
static NativeFile fontFile; static NativeFile *g_FontFp12=&fontFile,*g_FontsFp24[4],*g_FontsFp24En[2];
static U8 c_Sx=0,c_Sy=0,c_Ex=159,c_Ey=95,c_ReFlag=0;
static struct{U8 useCustomFont,useCustomFontEn,cacheCustomFont;}g_engineConfig;
#define IF_HAS_HOOK(name) if(0)
#define BIND_U16(v) ((void)(v))
#define BIND_U8ARR(v,n) ((void)(v),(void)(n))
#define CALL_HOOK_S() ((void)0)
`+'\n'+type('comOut.c','font_t')+'\n'+String.raw`
static font_t font_en={0},font_cn={0};static U8**fontCache=NULL;
`;
// Independently unpack the ROM font's contiguous 12-bit rows; this does not
// call the native conversion helpers or consume observer label fields.
function glyphOracle(out,code,x,y,ascii=false){const index=ascii?94*(0xa4-0xa1)+(code-0x21):94*((code>>8)-0xa1)+((code&255)-0xa1),offset=index*18;
    assert.ok(offset>=0&&offset+18<=font.length);for(let py=0;py<12;py++)for(let px=0;px<(ascii?6:12);px++){const bit=py*12+px;out[(y+py)*160+x+px]=font[offset+(bit>>3)]&(128>>(bit&7))?255:0;}}

function resource(id,item=0){const start=lib.readUInt32LE((id-1)*4),count=lib.readUInt16LE(start+6),fixed=lib.readUInt32LE(start+8);assert.ok(item<count);const offset=fixed?14+item*fixed:lib.readUInt32LE(start+14+item*8),length=fixed||lib.readUInt32LE(start+18+item*8);assert.ok(length&&start+offset+length<=lib.length);return lib.subarray(start+offset,start+offset+length);}
function decodeMovie(id){const bytes=resource(id),count=bytes[2],picmax=bytes[3];const units=Array.from({length:count},(_,frame)=>{const at=6+frame*5;return{frame,x:bytes[at],y:bytes[at+1],cdelay:bytes[at+2],ndelay:bytes[at+3],picIndex:bytes[at+4]};});let at=6+count*5;const pictures=Array.from({length:picmax},()=>{const width=bytes.readUInt16LE(at),height=bytes.readUInt16LE(at+2),mask=bytes[at+6],offset=at;at+=7+Math.ceil(width/8)*height*(mask+1);assert.ok(width&&height&&mask<=1&&at<=bytes.length);return{width,height,mask,offset};});assert.equal(at,bytes.length);assert.ok(units.every(u=>u.picIndex<picmax));return{id,bytes,count,picmax,units,pictures};}
function drawPacked(out,bytes,p,x0,y0){const stride=Math.ceil(p.width/8),plane=stride*p.height;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const dx=x0+x,dy=y0+y;if(dx<0||dy<0||dx>=160||dy>=96)continue;const at=p.offset+7+y*stride+(x>>3),bit=128>>(x&7),keep=p.mask&&(bytes[at]&bit),ink=bytes[at+(p.mask?plane:0)]&bit;if(!keep)out[dy*160+dx]=0;if(ink)out[dy*160+dx]=255;}}
function movieOracle(id,start,end,x0,y0,background=false,prior=Buffer.alloc(160*96,127)){const a=decodeMovie(id),units=a.units.slice(start,end+1),next=units.map(u=>u.ndelay),remaining=units.map(u=>u.cdelay),pixels=Buffer.from(prior);if(background)drawPacked(pixels,resource(16),{width:130,height:64,mask:0,offset:0},15,16);let frontier=0,previous=0,dirty=true,introduced=true,iterations=0;const cleared=Buffer.alloc(32),frames=[];
    while(true){assert.ok(++iterations<10000);for(let i=0;i<=frontier;i++){if(remaining[i]===1){const u=units[i],p=a.pictures[u.picIndex];for(let y=y0+u.y;y<y0+u.y+p.height;y++)pixels.fill(0,y*160+x0+u.x,y*160+x0+u.x+p.width);cleared[(start+i)>>3]|=1<<((start+i)&7);dirty=true;}if(remaining[i])remaining[i]--;}
        if(dirty)for(let i=0;i<=previous;i++)if(remaining[i]){const u=units[i];drawPacked(pixels,a.bytes,a.pictures[u.picIndex],x0+u.x,y0+u.y);}if(introduced){for(let i=previous+1;i<=frontier;i++)if(remaining[i]){const u=units[i];drawPacked(pixels,a.bytes,a.pictures[u.picIndex],x0+u.x,y0+u.y);}previous=frontier;}
        if(dirty||introduced){const visible=Buffer.alloc(32);for(let i=0;i<=frontier;i++)if(remaining[i])visible[(start+i)>>3]|=1<<((start+i)&7);frames.push({frame:start+frontier,visible,cleared:Buffer.from(cleared),pixels:Buffer.from(pixels)});dirty=introduced=false;}if(next[frontier]>=1)next[frontier]--;while(next[frontier]<=1&&start+frontier<end){frontier++;introduced=true;}if(start+frontier>=end&&remaining.slice(0,frontier+1).every(v=>v<=1))break;}return frames;}
function traceSchema(globals){const result=[];for(const m of globals.matchAll(/\b(U8|U16|U32|I16)\s+([^;]+);/g))for(const d of m[2].split(',')){const v=/\b(g_hd(?:Spe|SkillResult|ResultOwner)\w+)\s*(?:\[([^\]]+)\])?/.exec(d);if(!v)continue;let n=1;if(v[2])n=v[2]==='BAYE_HD_SPE_FRAME_BYTES'?32:v[2]==='BAYE_HD_SKILL_DIGITS'?10:v[2]==='BAYE_HD_SKILL_LABEL_BYTES'?64:Number(v[2]);if((v[2]==='BAYE_HD_AI_TARGET_PIXELS'||v[2]==='BAYE_HD_STATUS_EFFECT_PIXELS'))n=256;if((v[2]==='BAYE_HD_AI_TARGET_RGBA_BYTES'||v[2]==='BAYE_HD_STATUS_EFFECT_RGBA_BYTES'))n=1024;assert.ok(Number.isInteger(n)&&n>0&&n<=1024);result.push({name:v[1],type:m[1],count:n});}return result;}
let skillExecutable,skillSchema;
async function skillFixture(){if(!skillExecutable)skillExecutable=(async()=>{
    const header=read('hd-bridge.h'),bridge=read('hd-bridge.c'),globals=bridge.slice(bridge.indexOf('U8 g_hdEngineReady ='),bridge.indexOf('static void copy_gbk('));
    const constants=header.split('\n').filter(l=>/^#define BAYE_HD_/.test(l)).join('\n');
    const definitions=(read('baye/consdef.h')+'\n'+read('baye/fight.h')+'\n'+read('baye/graph.h')+'\n'+read('inc/dictsys.h')+'\n'+read('baye/attribute.h')).split('\n').filter(l=>/^#define\s+(?:MAIN_SPE|MAKER_SPE|STACHG_SPE|SPE_BACKPIC|NUM_PICID|QIBING_SPE|SHUISHANG_SPE|FIRE_SPE|WOOD_SPE|BUBING_SPE|JIANBING_SPE|WATER_SPE|BUMP_SPE|FENG_SPE|LIUYAN_SPE|YUAN_SPE|ZHEN_SPE|XJING_SPE|FGT_SPESX|FGT_SPESY|SHOW_DLYBASE|PICHEAD_LEN|TACTIC_ICON|TERRAIN_RIVER|PERSON_MAX|FGTA_MAX|FGT_PLAMAX|JN_MAX|NO_MOV|SKL_RESID|SKL_NAMID|IFACE_STRID|STATE_\w+|SID|PID)\b/.test(l)).join('\n');
    const helpers=nativeFunctions('hd-bridge.c',['baye_hd_result_scope_begin','baye_hd_result_scope_end','baye_hd_skill_begin','baye_hd_skill_numbers','baye_hd_skill_hold','baye_hd_skill_end','baye_hd_skill_retire','baye_hd_skill_movie_context','baye_hd_skill_movie_shape','baye_hd_skill_label_begin','baye_hd_skill_label_end','baye_hd_skill_number_resource','baye_hd_skill_digit_begin','baye_hd_skill_digit_end','baye_hd_attack_begin','baye_hd_attack_numbers','baye_hd_attack_hold','baye_hd_attack_end','baye_hd_attack_retire','baye_hd_attack_number_resource','baye_hd_attack_digit_begin','baye_hd_attack_digit_end','baye_hd_background_begin','baye_hd_background_end','baye_hd_status_shape','baye_hd_ai_target_shape','baye_hd_spe_context','baye_hd_spe_enter','baye_hd_spe_ready','baye_hd_spe_frame','baye_hd_spe_end','baye_hd_spe_tick','baye_hd_spe_draw_begin','baye_hd_spe_draw_end','baye_hd_spe_clear','baye_hd_spe_picture_drawn','baye_hd_spe_lcd_dirty','baye_hd_spe_lcd_copy','baye_hd_spe_lcd_flush','baye_hd_spe_invalidate','baye_hd_surface_write','baye_hd_picture_resource','baye_hd_report_begin','baye_hd_report_end']);
    const publicFunctions=nativeFunctions('PublicFun.c',['PlcMovie','PlcRPicShow','PlcRPicShowEx','baye_hd_picture_info']);
    skillSchema=traceSchema(globals);assert.ok(skillSchema.some(f=>f.name==='g_hdSkillResultDisplayLabelGbk'));
    const traceWrites=skillSchema.map(f=>f.count===1?`word((U32)${f.name});`:`for(int k=0;k<${f.count};k++)word((U32)${f.name}[k]);`).join('\n');
    const source=base+'\n'+constants+'\n'+definitions+'\n'+textConstants+'\n'+['HdStatusCheckScope','HdStatusTransition','HdStatusEffectSource','HdAiTargetSource','HdPictureSource','HdSpeScope','HdResultScope'].map(t=>type('hd-bridge.h',t)).join('\n')+'\n'+['RCHEAD','RIDX'].map(t=>type('baye/datman.h',t)).join('\n')+'\n'+['SPERES','SPEUNIT'].map(t=>type('baye/paccount.h',t)).join('\n')+'\n'+type('baye/graph.h','PictureHeadType')+String.raw`
typedef U16 PersonID;typedef U16 SkillID;typedef U16 ToolID;
`+'\n'+type('baye/attribute.h','PersonType')+['JLPOS','FGTJK'].map(t=>type('baye/fight.h',t)).join('\n')+String.raw`
static JLPOS g_GenPos[FGTA_MAX];static FGTJK g_FgtParam;
static PersonType g_Persons[PERSON_MAX];
static U8 g_MapSX,g_MapSY,g_MapWid,g_MapHgt,g_FgtOver;
static void fixtureNotify(void);
#define EM_ASM(...) fixtureNotify()
`+'\n'+globals+'\n'+helpers.prototypes+String.raw`
static NativeFile romFile,*g_LibFp=&romFile;static U8*g_CBnkPtr;
static U8*gam_fload(U8*bank,U32 offset,NativeFile*f){assert(offset<f->length);return bank+offset;}
static void gamTraceP(U16 id){(void)id;}
`+'\n'+helpers.functions+'\n'+nativeFunctions('datman.c',['GetResStartAddr','GetResItem','ResGetItemLen','ResLoadToCon','ResLoadToMem']).prototypes+'\n'+nativeFunctions('datman.c',['GetResStartAddr','GetResItem','ResGetItemLen','ResLoadToCon','ResLoadToMem']).functions+'\n'+publicFunctions.prototypes+String.raw`
static FILE*trace;static U8 displayedPixels[160*96];
static U32 notificationCount;
static void word(U32 v){U8 b[4]={(U8)v,(U8)(v>>8),(U8)(v>>16),(U8)(v>>24)};assert(fwrite(b,1,4,trace)==4);}
static void record(U32 kind){word(kind);
`+traceWrites+String.raw`
    assert(fwrite(kind==4?(const void*)displayedPixels:(const void*)scr_buffer,1,160*96,trace)==160*96);
}
static void fixtureNotify(void){notificationCount++;}
static void SysCopyScreen(U8*screen);
static void copied(U8*screen){SysCopyScreen(screen);record(1);}
static void callback(char*rgba){(void)rgba;memcpy(displayedPixels,scr_buffer,sizeof(displayedPixels));record(2);}
#define gam_copyscr copied
`+'\n'+pixels+'\n'+['GamPicShow','GamPicShowV','GamPicShowS','GamMPicShow','GamMPicShowV','GamMPicShowS','GamClearScreenV','GamShowFrame'].map(n=>actual('comOut.c',n)).join('\n')+String.raw`
typedef struct{U8 type;U16 param;}GMType;
#define VM_TIMER 1
#define VM_CHAR_FUN 2
#define VM_TOUCH 3
#define VT_TOUCH_UP 1
#define TIMER_DLY 1
#define GamMsgIsTimer0(m) ((m).type==VM_TIMER&&(m).param==0)
static int timer=1,scrolling=1,messages,hookCount,finalHookCount;
static int holds,queuedKey,keyReads;static U32 heldSession;
static U16 initialArms,capacity;
static U8 _CommonJNAction(SkillID param,U8 aim,U8 sIdx,U8 aIdx,U8 originIdx,U8 skillCustom);
static int SysScrollingTimerOpen(int v){int old=scrolling;scrolling=v;return old;}
static U8 SysGetTimer1Number(void){return(U8)timer;}
static void SysTimer1Close(void){timer=0;}static void SysTimer1Open(U16 v){timer=v;}
static void GamGetMsg(GMType*m){assert(++messages<20000);
    if(g_hdSkillResultPhase==BAYE_HD_SKILL_HOLD){holds++;if(heldSession!=g_hdSkillResultSession){heldSession=g_hdSkillResultSession;record(4);}}
    if(isLcdDirty)timed_flush_lcd();
    if(queuedKey){m->type=VM_CHAR_FUN;m->param=(U16)queuedKey;queuedKey=0;keyReads++;}else{m->type=VM_TIMER;m->param=1;}
}
`+'\n'+actual('comIn.c','GamDelay')+'\n'+publicFunctions.functions+'\n'+textGlobals+'\n'+textFunctions.prototypes+'\n'+textFunctions.functions+'\n'+['SKILLEF','JLATT','FGTCMD'].map(t=>type('baye/fight.h',t)).join('\n')+String.raw`
static JLATT g_GenAtt[2];
static U8 levels[FGTA_MAX],g_LookMovie=1,g_engineDebug=0;static U16 troops[FGTA_MAX],g_EneTmpProv;
static U8 shared[1024];
#define SHARE_MEM shared
#undef IF_HAS_HOOK
#undef CALL_HOOK_S
#define IF_HAS_HOOK(name) if(0)
#define BIND_U8(v) ((void)(v))
#define BIND_IDX(n,v) ((void)(n),(void)(v))
#define BIND_U16EX(n,v) ((void)(n),(void)(v))
#define BIND_U8EX(n,v) ((void)(n),(void)(v))
#define CALL_HOOK() (0)
#define CALL_HOOK_A() (-1)
#define HOOK_LEAVE() ((void)0)
#define HOOK_RETURN() return
#define gam_itoa(v,p,r) snprintf((char*)(p),10,"%u",(unsigned)(v))
#define gam_drawpic(id,ind,x,y,flag) PlcRPicShowEx(id,0,(ind)+1,x,y,flag)
static int gam_rand(void){return 0;}
static void BuiltAtkAttr(U8 side,U8 index){assert(side<2&&index<FGTA_MAX);g_GenAtt[side]=(JLATT){.level=&levels[index],.arms=&troops[index],.generalIndex=index,.canny=80};}
static U8 g_FgtWeather=1;
static FAR SKILLEF *FgtGetJNPtr(SkillID param);
${actual('FgtCount.c','CountSklHurt')}
static U16 PlcArmsMax(PersonID id){assert(id<FGTA_MAX);return capacity;}
static U32 FgtGetExp(U16 value){return value/10;}
static void FgtShowSNum2(U8 sign,U8 index,U16 value){(void)sign;(void)index;(void)value;assert(0);}
static U8 FgtGetGenTer(U8 index){assert(index<FGTA_MAX);return 0;}
static bool FgtChkAkRng(U8 x,U8 y){return x<10&&y<10;}
static U8 FgtJNChkAim(SkillID skill,U8 same,U8 aim,U8 actor){assert(skill&&actor<FGTA_MAX);return!same&&aim!=12;}
static void FgtSetFocus(U8 index){assert(index==3);}
static U32 FgtDrvWeiG(U8 index){(void)index;assert(0);return 0;}
static void FgtChgWeather(void){assert(0);}
static U8 GetPersonName(PersonID index,U8*buf){assert(index<FGTA_MAX);strcpy((char*)buf,"unit");return 0;}
static void GamMsgBox(const U8*text,U8 delay){(void)text;(void)delay;baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);record(6);baye_hd_report_end();}
static void PlcGraMsgBox(const U8*text,U8 delay,U8 portrait){(void)portrait;GamMsgBox(text,delay);}
static void ShowGReport(PersonID index,const U8*text){(void)index;GamMsgBox(text,1);}
static I32 call_hook_a_observed(const char*name,void*context,U8*present){(void)context;assert(!strcmp(name,"willShowPKAnimation"));hookCount++;if(present)*present=0;return -1;}
static I32 call_hook_a(const char*name,void*context){(void)context;assert(!strcmp(name,"didShowPKAnimation"));finalHookCount++;return 0;}
`+'\n'+read('data/pstring.h')+'\n'+['CountPlusSub','CountOverAdd'].map(n=>actual('FgtCount.c',n)).join('\n')+'\n'+actual('gamEng.c','add_16')+'\n'+read('FightSub.c').slice(read('FightSub.c').indexOf('static U8 dJNSpeId['),read('FightSub.c').indexOf('void FgtInitArmsJNNum('))+'\n'+read('FightSub.c').split('\n').find(l=>l.startsWith('const U8 FgtSpeFrm[]'))+'\n'+['FgtGetJNPtr','FgtLoadToMem2','TransIdxToGen1','FgtAtvShowNum','_CommonJNAction','FgtJNAction'].map(n=>actual('FightSub.c',n)).join('\n')+String.raw`
int main(int argc,char**argv){assert(argc==7);U16 selectedSkill=(U16)atoi(argv[1]);initialArms=(U16)atoi(argv[2]);capacity=(U16)atoi(argv[3]);
    FILE*f=fopen(argv[5],"rb");assert(f);fseek(f,0,SEEK_END);romFile.length=(U32)ftell(f);rewind(f);g_CBnkPtr=malloc(romFile.length);assert(fread(g_CBnkPtr,1,romFile.length,f)==romFile.length);fclose(f);romFile.bytes=g_CBnkPtr;romFile.position=romFile.length;
    f=fopen(argv[6],"rb");assert(f);fontFile.length=163840;fontFile.bytes=malloc(fontFile.length);assert(fread(fontFile.bytes,1,fontFile.length,f)==fontFile.length);fclose(f);
    assert(sizeof(RCHEAD)==14&&sizeof(RIDX)==8&&sizeof(SPERES)==6&&sizeof(SPEUNIT)==5&&sizeof(PictureHeadType)==7);
    trace=fopen(argv[4],"wb");assert(trace);screen_buffer_realloc(MAX_SCR_BUF_LEN);memset(scr_buffer,127,160*96);memset(g_VisScr,127,sizeof(g_VisScr));
    for(int i=0;i<256;i++)g_paintPalette[i]=((U32)i<<24)|((U32)(255-i)*0x010101u);_lcd_fluch_cb=callback;
    assert(!GamSetFont(0));GamSetFontEn(0);g_hdFightActive=1;for(int i=0;i<FGTA_MAX;i++){levels[i]=5;troops[i]=200;g_GenPos[i]=(JLPOS){.x=1,.y=1,.mp=99};}g_FgtParam.GenArray[3]=4;g_FgtParam.GenArray[4]=5;g_FgtParam.EProvender=50;g_FgtParam.MProvender=60;
    assert(selectedSkill==17||selectedSkill==29);U16 requested=(U16)(selectedSkill==17?800:1800);
    troops[4]=initialArms;assert(troops[4]<=capacity);
    U16 originalArms=troops[4],expectedApplied=(U16)min(requested,capacity-originalArms);
    BuiltAtkAttr(0,3);BuiltAtkAttr(1,4);SKILLEF*skl=FgtGetJNPtr(selectedSkill);
    assert(skl->aim==1&&skl->state==0&&skl->power==requested&&skl->destroy==0);
    assert(skl->useMp==(selectedSkill==17?15:30));
    FGTCMD cmd={.param=selectedSkill,.sIdx=3,.aIdx=4};FgtJNAction(&cmd);
    if(isLcdDirty)timed_flush_lcd();record(3);
    assert(!g_hdSkillResultActive&&!g_hdSkillResultDisplayValid);
    assert(!g_hdSpeActive&&hookCount==1&&finalHookCount==1&&notificationCount>0);
    assert(g_GenPos[3].mp==99-skl->useMp);assert(g_FgtParam.EProvender==50&&g_FgtParam.MProvender==60);
    assert(troops[4]==originalArms+expectedApplied);assert(holds==50);assert(keyReads==0&&!queuedKey);assert(g_hdSpeEndReason==BAYE_HD_SPE_END_COMPLETE);
    fclose(trace);puts("actual native skill engine passed");return 0;
}`;
    const executable=await compile(source,'skill'),fontPath=join(executable.dir,'actual-web-font.bin');writeFileSync(fontPath,font);return{...executable,fontPath};
})();return skillExecutable;}
function decodeTrace(bytes){const fields=skillSchema.reduce((n,f)=>n+f.count,0),rowSize=4+fields*4+160*96;assert.equal(bytes.length%rowSize,0);const rows=[];for(let at=0;at<bytes.length;at+=rowSize){let p=at;const kind=bytes.readUInt32LE(p);p+=4;const values={};for(const f of skillSchema){const v=[];for(let i=0;i<f.count;i++,p+=4)v.push(f.type==='I16'?bytes.readInt32LE(p):bytes.readUInt32LE(p));values[f.name]=f.count===1?v[0]:v;}rows.push({kind,values,pixels:bytes.subarray(p,p+160*96)});}return rows;}
async function runSkill(skill,arms,capacity){const f=await skillFixture(),output=join(f.dir,`${skill}-${arms}-${capacity}.bin`);const r=await run(f.binary,[String(skill),String(arms),String(capacity),output,join(root,'libs/dat-mod.lib'),f.fontPath],{timeout:20000});assert.match(r.stdout,/actual native skill engine passed/);return decodeTrace(readFileSync(output));}


const stringEnum=new Map();let enumIndex=0;
for(const item of read('data/pstring.h').replace(/\/\*[\s\S]*?\*\//g,'').match(/enum\s*\{([\s\S]*?)\}/)[1].split(',')){const m=/\b(\w+)\s*(?:=\s*(\d+))?/.exec(item);if(!m)continue;enumIndex=m[2]?Number(m[2]):enumIndex+1;stringEnum.set(m[1],enumIndex);}
function nativeLabel(name){const bytes=resource(1,stringEnum.get(name)-1),end=bytes.indexOf(0);return end<0?bytes:bytes.subarray(0,end);}
function drawLabel(out,text,x=55,y=18){for(let i=0;i<text.length;){const first=text[i++];if(first<128){if(first<=32){for(let py=0;py<12;py++)out.fill(0,(y+py)*160+x,(y+py)*160+x+6);}else glyphOracle(out,first,x,y,true);x+=6;}else{assert.ok(i<text.length);glyphOracle(out,(first<<8)|text[i++],x,y);x+=12;}}}
function verifyResultPixels(rows,value,{labelName='dFgtArmsH',resultKind=1,skillId=17,speId=41,start=0,end=7,x=48,y=16,background=false}={}){
    const movie=movieOracle(speId,start,end,x,y,background),scene=movie.at(-1),label=nativeLabel(labelName),digits=resource(15),decimal=String(value);let final=false;
    const shown=rows.filter(r=>(r.kind===2||r.kind===4)&&r.values.g_hdSkillResultDisplayValid===1&&r.values.g_hdSkillResultPhase>=2);assert.ok(shown.length,'actual post-movie numeric/hold flush is owned separately');
    for(const row of shown){const v=row.values,displayedScene=movie[v.g_hdSkillResultDisplayCommitSeq-1];assert.ok(displayedScene,'display stamp maps to an actual independently decoded logical copy');const pixels=Buffer.from(displayedScene.pixels);assert.equal(v.g_hdSkillResultActive,1);assert.equal(v.g_hdSpeActive,0,'original child SPE is inactive after its real end');assert.equal(v.g_hdSkillResultSourceValid,1);assert.equal(v.g_hdSkillResultResultKind,resultKind);assert.equal(v.g_hdSkillResultValue,value,'exact applied C argument, without recomputing damage from troop snapshots');assert.equal(v.g_hdSkillResultActorIndex,3);assert.equal(v.g_hdSkillResultTargetIndex,4);assert.equal(v.g_hdSkillResultSkillId,skillId);
        assert.equal(v.g_hdSkillResultDisplaySession,v.g_hdSkillResultSession);assert.equal(v.g_hdSkillResultDisplayGeneration,v.g_hdSkillResultGeneration);assert.equal(v.g_hdSkillResultDisplaySceneMode,background?1:2);assert.deepEqual([v.g_hdSkillResultDisplaySceneX,v.g_hdSkillResultDisplaySceneY,v.g_hdSkillResultDisplaySceneWidth,v.g_hdSkillResultDisplaySceneHeight],background?[15,16,130,64]:[48,16,64,64]);assert.deepEqual(Buffer.from(v.g_hdSkillResultDisplayVisibleFrames),displayedScene.visible);assert.deepEqual(Buffer.from(v.g_hdSkillResultDisplayClearFrames),displayedScene.cleared);assert.deepEqual(Buffer.from(v.g_hdSkillResultVisibleFrames),scene.visible,'current saved source is the latest copy even when the LCD still shows an earlier one');
        assert.equal(v.g_hdResultOwnerKind,2);assert.equal(v.g_hdResultOwnerValid,1);assert.equal(v.g_hdResultOwnerSession,v.g_hdSkillResultSession);
        if(v.g_hdSkillResultDisplayLabelValid){assert.equal(v.g_hdSkillResultDisplayLabelLength,label.length);assert.deepEqual(Buffer.from(v.g_hdSkillResultDisplayLabelGbk).subarray(0,label.length),label);assert.equal(v.g_hdSkillResultDisplayLabelGbk[label.length],0);assert.deepEqual([v.g_hdSkillResultDisplayLabelX,v.g_hdSkillResultDisplayLabelY],[55,18]);drawLabel(pixels,label);}else assert.equal(v.g_hdSkillResultDisplayDigitCount,0,'an earlier movie display cannot claim unflushed labels or digits');
        assert.equal(v.g_hdSkillResultNumberValid,1);assert.equal(v.g_hdSkillResultNumberId,15);assert.deepEqual([v.g_hdSkillResultNumberWidth,v.g_hdSkillResultNumberHeight,v.g_hdSkillResultNumberCount,v.g_hdSkillResultNumberMask],[12,16,10,0]);assert.equal(v.g_hdSkillResultNumberResourceFingerprint,0xb37d7407);assert.equal(v.g_hdSkillResultNumberResourceLength,327);assert.ok(v.g_hdSkillResultDisplayDigitCount<=decimal.length);
        for(let i=0;i<v.g_hdSkillResultDisplayDigitCount;i++){const digit=Number(decimal[i]),count=v.g_hdSkillResultDisplayDigitDrawCount[i];assert.equal(v.g_hdSkillResultDisplayDigitIndex[i],digit);assert.equal(v.g_hdSkillResultDisplayDigitX[i],55+i*6);assert.equal(v.g_hdSkillResultDisplayDigitFirstY[i],56);assert.ok(count>0&&count<=8);assert.equal(v.g_hdSkillResultDisplayDigitY[i],57-count);for(let draw=0;draw<count;draw++)drawPacked(pixels,digits,{width:12,height:16,mask:0,offset:digit*32},55+i*6,56-draw);}
        assert.deepEqual(row.pixels,pixels,'whole160x96 screen includes actual font label, all overlapping NUM15 historical footprints and unchanged surrounding pixels');
        if(v.g_hdSkillResultPhase===3&&v.g_hdSkillResultDisplayLabelValid&&v.g_hdSkillResultDisplayDigitCount===decimal.length&&v.g_hdSkillResultDisplayDigitDrawCount.slice(0,decimal.length).every(n=>n===8))final=true;
    }assert.ok(final,'original native wait owns final label and digits until actual return');
    return shown;
}

// Independent actual-ROM inputs: no mutation of the SKILLEF table or its power.
for(const [skill,power,useMp]of[[17,800,15],[29,1800,30]]){
 const table=resource(10),record=table.subarray((skill-1)*34,skill*34);
 assert.equal(record.length,34);assert.equal(record[0],1);assert.equal(record[1],0);
 assert.equal(record.readUInt16LE(2),power);assert.equal(record.readUInt16LE(4),0);assert.equal(record[6],useMp);
 assert.equal(record[7],100);assert.equal(record[12],100);assert.equal(record[20],100);assert.equal(record[28],100);
 const a=decodeMovie(41);assert.equal(a.count,8);assert.equal(a.picmax,2);
 assert.deepEqual(a.pictures.map(p=>[p.width,p.height,p.mask]),[[64,64,0],[64,64,0]]);
 assert.deepEqual(a.units.map(u=>[u.x,u.y,u.picIndex]),Array.from({length:8},(_,i)=>[0,0,i%2]));
 for(const [name,before,capacity,applied]of[['full',100,100+power,power],['partial',power-10,power,10],['at-capacity',power,power,0]]){
  test('actual AID'+skill+' requested'+power+' '+name+' publishes applied'+applied+' with native41/NUM15/font and50timer hold',async()=>{
   const rows=await runSkill(skill,before,capacity);
   const copies=rows.filter(r=>r.kind===1&&r.values.g_hdSpeId===41),movie=movieOracle(41,0,7,48,16);
   assert.equal(copies.length,8);assert.equal(movie.length,8);
   for(let i=0;i<copies.length;i++){
    const row=copies[i],v=row.values,expected=movie[i];
    assert.equal(v.g_hdSpeKind,2);assert.equal(v.g_hdSpeSkillId,skill);assert.equal(v.g_hdSpeActorIndex,3);assert.equal(v.g_hdSpeTargetIndex,4);
    assert.equal(v.g_hdSpeProtocolValid,1);assert.equal(v.g_hdSpeCompositionValid,1);assert.equal(v.g_hdSpeFrameIndex,i);assert.equal(v.g_hdSpeCommitSeq,i+1);
    for(const prefix of ['g_hdSpe','g_hdSkillResult'])assert.deepEqual([v[prefix+'SceneMode'],v[prefix+'SceneX'],v[prefix+'SceneY'],v[prefix+'SceneWidth'],v[prefix+'SceneHeight']],[2,48,16,64,64]);
    assert.equal(v.g_hdSkillResultFrameIndex,i);assert.equal(v.g_hdSkillResultCommitSeq,i+1);
    assert.deepEqual(Buffer.from(v.g_hdSpeVisibleFrames),expected.visible);assert.deepEqual(Buffer.from(v.g_hdSpeClearFrames),expected.cleared);assert.deepEqual(row.pixels,expected.pixels);
   }
   const displayed=rows.filter(r=>r.kind===2&&r.values.g_hdSpeActive&&r.values.g_hdSpeDisplayFrameValid);
   assert.ok(displayed.length);for(const row of displayed){const v=row.values;assert.deepEqual([v.g_hdSpeDisplaySceneMode,v.g_hdSpeDisplaySceneX,v.g_hdSpeDisplaySceneY,v.g_hdSpeDisplaySceneWidth,v.g_hdSpeDisplaySceneHeight],[2,48,16,64,64]);const e=movie[v.g_hdSpeDisplayCommitSeq-1];assert.ok(e);assert.equal(v.g_hdSpeDisplayFrameIndex,e.frame);assert.deepEqual(Buffer.from(v.g_hdSpeDisplayClearFrames),e.cleared);assert.deepEqual(Buffer.from(v.g_hdSpeDisplayVisibleFrames),e.visible);assert.deepEqual(row.pixels,e.pixels);}
   verifyResultPixels(rows,applied,{labelName:'dFgtArmsA',resultKind:2,skillId:skill,speId:41});
   const held=rows.filter(r=>r.kind===4);assert.equal(held.length,1);assert.equal(held[0].values.g_hdSkillResultValue,applied);assert.equal(held[0].values.g_hdSkillResultDisplayFrameIndex,7);
   const end=rows.at(-1).values;assert.equal(end.g_hdSpeActive,0);assert.equal(end.g_hdSkillResultActive,0);assert.equal(end.g_hdSkillResultDisplayValid,0);assert.equal(end.g_hdResultOwnerKind,0);
  });
 }
}
