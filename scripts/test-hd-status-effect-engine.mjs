#!/usr/bin/env node
// Actual native status transition callers, ROM, screen draws, copies and timer commits.
// Command selection/message delivery are fixture boundaries, not playable-game
// evidence. The independent ROM counter/pixel oracle does not consume HD flags.
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
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=['hd-bridge.c','hd-bridge.h','PublicFun.c','Fight.c','tactic.c','platform/common/sys.c','comOut.c','comIn.c','datman.c'];
const sourceTuple=Object.fromEntries(files.map(f=>[f,sha(readFileSync(join(root,'vendor/iBaye/src',f)))]));
function signature(name){return new RegExp('^(?:(?:static|inline|FAR|const)\\s+)*(?:[A-Za-z_]\\w*)[\\t *]+'+name+'\\([^;]*?\\)\\s*\\{','m');}
function actual(file,name){const source=read(file),m=signature(name).exec(source);assert.ok(m,`actual ${file}::${name}`);const end=source.indexOf('\n}',m.index);assert.ok(end>m.index);return source.slice(m.index,end+2);}
function type(file,name){const m=new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*'+name+';').exec(read(file));assert.ok(m,`actual ${name}`);return m[0];}
function closure(file,seeds){const source=read(file),found=new Map();function add(name){if(found.has(name))return;let body;try{body=actual(file,name);}catch{return;}found.set(name,body);for(const call of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))if(signature(call[1]).test(source))add(call[1]);}for(const seed of seeds){assert.ok(signature(seed).test(source));add(seed);}return{prototypes:[...found.values()].map(b=>b.slice(0,b.indexOf('{')).trim()+';').join('\n'),functions:[...found.values()].join('\n')};}
async function compile(source){const dir=mkdtempSync(join(tmpdir(),'baye-hd-status-effect-'));temporary.push(dir);const file=join(dir,'actual-status.c'),binary=join(dir,'actual-status'+(process.platform==='win32'?'.exe':''));writeFileSync(file,source);try{await run(process.env.CC||'cc',['-std=c99','-fpack-struct=1','-Wall','-Wextra',file,'-o',binary],{timeout:30000});}catch(e){throw Error('Actual status C compile: '+(e.stderr?.split(/\r?\n/).filter(l=>/error:|fatal error:/.test(l)).join('\n')||e.message));}return binary;}
after(()=>{for(const dir of temporary){assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('baye-hd-status-effect-'));rmSync(dir,{recursive:true,force:true});}for(const[f,h]of Object.entries(sourceTuple))assert.equal(sha(readFileSync(join(root,'vendor/iBaye/src',f))),h,'Native source changed during actual C acceptance: '+f);});
const lib=readFileSync(join(root,'libs/dat-mod.lib'));assert.equal(sha(lib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
const resAt=lib.readUInt32LE(26*4),length=lib.readUInt32LE(resAt+8),bytes=lib.subarray(resAt+14,resAt+14+length);
assert.equal(lib.readUInt16LE(resAt+4),27);assert.equal(bytes.length,735);
let fnv=0x811c9dc5;for(const b of bytes)fnv=Math.imul((fnv^b)>>>0,0x01000193)>>>0;assert.equal(fnv,0xba494eea);
const units=Array.from({length:bytes[2]},(_,frame)=>{const at=6+frame*5;return{frame,x:bytes[at],y:bytes[at+1],cdelay:bytes[at+2],ndelay:bytes[at+3],pic:bytes[at+4]};});
let offset=6+units.length*5;const pictures=[];for(let i=0;i<bytes[3];i++){const width=bytes.readUInt16LE(offset),height=bytes.readUInt16LE(offset+2),count=bytes.readUInt16LE(offset+4),mask=bytes[offset+6],plane=Math.ceil(width/8)*height;pictures.push({offset,width,height,count,mask,plane});offset+=7+plane*(mask+1);}assert.equal(offset,bytes.length);
function initialPixels(){return Buffer.from(Array.from({length:160*96},(_,i)=>((i%160+Math.floor(i/160)*3)%5===0?255:0)));}
function draw(out,u,x0=80,y0=32){const p=pictures[u.pic],stride=Math.ceil(p.width/8);for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const at=p.offset+7+y*stride+(x>>3),bit=128>>(x&7),dest=(y0+u.y+y)*160+x0+u.x+x;if(!(bytes[at]&bit))out[dest]=0;if(bytes[at+p.plane]&bit)out[dest]=255;}}
function oracle(startPixels=initialPixels(),start=0){const list=units.slice(start,start+6),next=list.map(u=>u.ndelay),remaining=list.map(u=>u.cdelay),pixels=Buffer.from(startPixels),cleared=Buffer.alloc(32),frames=[];let frontier=0,previous=0,dirty=true,introduced=true,loops=0;while(true){assert.ok(++loops<10000);for(let i=0;i<=frontier;i++){if(remaining[i]===1){const u=list[i],p=pictures[u.pic];for(let y=32+u.y;y<32+u.y+p.height;y++)pixels.fill(0,y*160+80+u.x,y*160+80+u.x+p.width);cleared[(start+i)>>3]|=1<<((start+i)&7);dirty=true;}if(remaining[i])remaining[i]--;}
    if(dirty)for(let i=0;i<=previous;i++)if(remaining[i])draw(pixels,list[i]);if(introduced){for(let i=previous+1;i<=frontier;i++)if(remaining[i])draw(pixels,list[i]);previous=frontier;}if(dirty||introduced){const visible=Buffer.alloc(32);for(let i=0;i<=frontier;i++)if(remaining[i])visible[(start+i)>>3]|=1<<((start+i)&7);frames.push({frame:start+frontier,visible,cleared:Buffer.from(cleared),pixels:Buffer.from(pixels)});dirty=introduced=false;}if(next[frontier]>=1)next[frontier]--;while(next[frontier]<=1&&frontier<5){frontier++;introduced=true;}if(frontier===5&&remaining.every(v=>v<=1))break;}return frames;}
const expected=oracle(),basePixels=Buffer.concat(Array.from({length:16},(_,y)=>initialPixels().subarray((32+y)*160+80,(32+y)*160+96)));
const cBase=String.raw`
#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;typedef int8_t BOOL;typedef int16_t I16;typedef int32_t I32;typedef int16_t PT;typedef U16 PersonID;typedef U16 SkillID;typedef U16 ToolID;
#define FAR
#define AX_SCALE 1
#define SCR_WID 160
#define SCR_HGT 96
#define SCR_W g_screenWidth
#define SCR_H g_screenHeight
#define BYTES_PERLINE SCR_W
#define MAX_SCR_BUF_LEN (176*96)
#define CLR 0
#define DOT 1
#define min(a,b) ((a)<(b)?(a):(b))
#define gam_memset memset
#define gam_selectscr SysSelectScreen
#define gam_clrvscr GamClearScreenV
#define gam_strlen(p) strlen((const char*)(p))
static int g_screenWidth=160,g_screenHeight=96;
static U8 g_FlipDrawing=0,g_paintColor=255,g_VisScr[176*96];static U32 g_paintPalette[256];
static char *static_buffer,*backup_buffer,*buffer,*scr_buffer;static size_t buffer_size;static int isLcdDirty;
static void (*_lcd_fluch_cb)(char*);
static void*gam_malloc(size_t n){return malloc(n);}static void gam_free(void*p){free(p);}
typedef struct{U8*bytes;U32 length,position;}NativeFile;typedef NativeFile gam_FILE;
static NativeFile romFile,*g_LibFp=&romFile;static U8*g_CBnkPtr;
static U32 gam_ftell(NativeFile*f){return f->position;}
static int gam_fseek(NativeFile*f,U32 at,int origin){U32 n=origin==SEEK_CUR?f->position+at:at;if(n>=f->length)return -1;f->position=n;return 0;}
static U16 gam_fread(void*out,U16 size,U16 count,NativeFile*f){U32 n=(U32)size*count;if(n>f->length-f->position)n=f->length-f->position;memcpy(out,f->bytes+f->position,n);f->position+=n;return(U16)(n/size);}
static U8*gam_fload(U8*bank,U32 at,NativeFile*f){assert(at<f->length);return bank+at;}
static void gamTraceP(U16 id){(void)id;}
`;
let binary;
async function executable(){if(!binary)binary=(async()=>{
    const header=read('hd-bridge.h'),bridge=read('hd-bridge.c'),globals=bridge.slice(bridge.indexOf('U8 g_hdEngineReady ='),bridge.indexOf('static void copy_gbk('));
    const constants=header.split('\n').filter(l=>/^#define BAYE_HD_/.test(l)).join('\n');
    const defines=(read('baye/consdef.h')+'\n'+read('baye/fight.h')+'\n'+read('baye/graph.h')+'\n'+read('inc/dictsys.h')+'\n'+read('baye/attribute.h')).split('\n').filter(l=>/^#define\s+(?:MAIN_SPE|MAKER_SPE|STACHG_SPE|SPE_BACKPIC|NUM_PICID|FIRE_SPE|QIBING_SPE|SHUISHANG_SPE|FGT_SPESX|FGT_SPESY|SHOW_DLYBASE|PICHEAD_LEN|TACTIC_ICON|FGTA_MAX|FGT_PLAMAX|PERSON_MAX|STATE_\w+|CMD_\w+|TIL_WID|WK_SX|WK_SY|FgtGetScrX|FgtGetScrY|FGT_EXPMAX|FGT_AUTO|FGT_COMON|SCR_MAPWID|SCR_MAPHGT|MAX_LEVEL)\b/.test(l)).join('\n');
    const types=['HdAiTargetSource','HdStatusCheckScope','HdStatusTransition','HdStatusEffectSource','HdPictureSource','HdSpeScope','HdResultScope'].map(t=>type('hd-bridge.h',t)).join('\n')+'\n'+['RCHEAD','RIDX'].map(t=>type('baye/datman.h',t)).join('\n')+'\n'+['SPERES','SPEUNIT'].map(t=>type('baye/paccount.h',t)).join('\n')+'\n'+type('baye/attribute.h','PersonType')+type('baye/graph.h','PictureHeadType')+'\n'+['JLPOS','FGTJK','FGTCMD','JLATT'].map(t=>type('baye/fight.h',t)).join('\n');
    const helpers=closure('hd-bridge.c',['baye_hd_status_check_begin','baye_hd_status_check_end','baye_hd_status_before','baye_hd_status_context','baye_hd_status_discard','baye_hd_status_shape','baye_hd_ai_target_shape','baye_hd_skill_movie_shape','baye_hd_spe_enter','baye_hd_spe_ready','baye_hd_spe_frame','baye_hd_spe_end','baye_hd_spe_tick','baye_hd_spe_draw_begin','baye_hd_spe_draw_end','baye_hd_spe_clear','baye_hd_spe_lcd_dirty','baye_hd_spe_lcd_copy','baye_hd_spe_lcd_flush','baye_hd_spe_invalidate','baye_hd_surface_write','baye_hd_report_begin','baye_hd_report_end','baye_hd_set_help','baye_hd_set_qty']);
    const movies=closure('PublicFun.c',['PlcMovie']),resources=closure('datman.c',['GetResStartAddr','GetResItem','ResGetItemLen','ResLoadToCon']);
    const pixels=['screen_buffer_realloc','_insideScreen','convert_image','timed_flush_lcd','flushLcd','_dot','SysLcdPartClear','DecodePic','SysPictureEx','SysPicture','SysSelectScreen','SysCopyScreen','SysSaveScreen','SysRestoreScreen','SysAdjustLCDBuffer'].map(n=>actual('platform/common/sys.c',n)).join('\n');
    const comOut=['GamPicShow','GamPicShowV','GamPicShowS','GamMPicShow','GamMPicShowV','GamMPicShowS','GamClearScreenV','GamShowFrame'].map(n=>actual('comOut.c',n)).join('\n');
    const source=cBase+'\n'+constants+'\n'+defines+'\n'+types+String.raw`
static JLPOS g_GenPos[FGTA_MAX];static FGTJK g_FgtParam;
static PersonType g_Persons[PERSON_MAX];static struct {U8 maxLevel,disableExpGrowing;} g_engineConfig;
static U8 g_MapSX=3,g_MapSY=4,g_MapWid=32,g_MapHgt=32,g_FgtOver;
static int countCalls;static U32 fixtureCount=700;
static U32 GamGetPersonCount(void){countCalls++;return fixtureCount;}
static int notifyReset;static void fixtureNotify(void);
#define EM_ASM(...) fixtureNotify()
`+'\n'+globals+'\n'+helpers.prototypes+'\n'+helpers.functions+'\n'+resources.prototypes+'\n'+resources.functions+'\n'+movies.prototypes+String.raw`
static FILE*trace;static int mode,messages,changed,keyReads,nested;static U8 subject=3;static char*callbackRgba;
static void convert_image(U32*dst,char*src);
static void word(U32 v){U8 b[4]={(U8)v,(U8)(v>>8),(U8)(v>>16),(U8)(v>>24)};assert(fwrite(b,1,4,trace)==4);}
static void record(U32 kind){if(mode==16&&g_hdSpeId==MAIN_SPE){assert(g_hdSpeKind==BAYE_HD_SPE_KIND_OPENING&&!g_hdSpeContextKnown);}word(kind);word(g_hdSpeGeneration);word(g_hdSpeEventId);word(g_hdSpeCommitSeq);word(g_hdSpeFrameIndex);word(g_hdSpeActive);word(g_hdSpeStatusValid);word(g_hdSpeDisplayEventId);word(g_hdSpeDisplayCommitSeq);word(g_hdSpeDisplayFrameIndex);word(g_hdSpeDisplayFrameValid);word(g_hdSpeDisplayStatusValid);word(g_hdSpeStatusSubjectPerson);word(g_hdSpeStatusSubjectIndex);word(g_hdSpeStatusReason);word(g_hdSpeStatusPhase);word(messages);word(g_hdSpeStatusBeforeLevel);word(g_hdSpeStatusAfterLevel);word(g_hdSpeStatusBeforeExperience);word(g_hdSpeStatusAfterExperience);word(g_hdSpeStatusBeforeState);word(g_hdSpeStatusAfterState);word(g_hdSpeStatusBeforeHp);word(g_hdSpeStatusAfterHp);word(g_hdSpeStatusBeforeArms);word(g_hdSpeStatusAfterArms);word(g_hdSpeStatusLevelMax);
assert(fwrite(g_hdSpeVisibleFrames,1,32,trace)==32);assert(fwrite(g_hdSpeStatusClearFrames,1,32,trace)==32);assert(fwrite(g_hdSpeStatusBasePixels,1,256,trace)==256);assert(fwrite(g_hdSpeDisplayVisibleFrames,1,32,trace)==32);assert(fwrite(g_hdSpeDisplayStatusClearFrames,1,32,trace)==32);assert(fwrite(g_hdSpeDisplayStatusBasePixels,1,256,trace)==256);assert(fwrite(scr_buffer,1,160*96,trace)==160*96);assert(fwrite(g_hdSpeStatusBaseRgba,1,1024,trace)==1024);assert(fwrite(g_hdSpeDisplayStatusBaseRgba,1,1024,trace)==1024);if(callbackRgba){assert(fwrite(callbackRgba,1,160*96*4,trace)==160*96*4);}else{U32 rgba[176*96];convert_image(rgba,scr_buffer);assert(fwrite(rgba,1,160*96*4,trace)==160*96*4);}}
static void fixtureNotify(void){if(notifyReset){notifyReset=0;baye_hd_spe_invalidate();}}
static void SysCopyScreen(U8*screen);
static void copied(U8*screen){SysCopyScreen(screen);record(1);}
static void callback(char*rgba){assert(rgba);callbackRgba=rgba;record(2);callbackRgba=NULL;}
#define gam_copyscr copied
`+'\n'+pixels+'\n'+comOut+String.raw`
typedef struct{U8 type;U16 param;}GMType;
#define VM_TIMER 1
#define VM_CHAR_FUN 2
#define VM_TOUCH 3
#define VT_TOUCH_UP 1
#define TIMER_DLY 1
#define GamMsgIsTimer0(m) ((m).type==VM_TIMER&&(m).param==0)
static int timer=1,scrolling=1;
static int SysScrollingTimerOpen(int n){int old=scrolling;scrolling=n;return old;}
static U8 SysGetTimer1Number(void){return(U8)timer;}
static void SysTimer1Close(void){timer=0;}static void SysTimer1Open(U16 n){timer=n;}
static void GamGetMsg(GMType*m){assert(++messages<10000);
if(!changed&&messages==4){changed=1;
 if(mode==4){U8 p=128;GamPicShowV(0,0,1,1,&p,g_VisScr);}
 if(mode==5){SysSelectScreen(NULL);U8 p=128;GamPicShow(0,0,1,1,&p);}
 if(mode==6)baye_hd_spe_invalidate();
 if(mode==7){baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);baye_hd_report_end();}
 if(mode==8){baye_hd_set_help((const U8*)"help");baye_hd_set_help(NULL);}
 if(mode==9){baye_hd_set_qty(1,0,2,1);baye_hd_set_qty(1,0,2,0);}
 if(mode==10){g_FlipDrawing=1;}
 if(mode==11){g_paintPalette[0]^=1;}
 if(mode==12){U32 at=GetResStartAddr(STACHG_SPE);g_CBnkPtr[at+sizeof(RCHEAD)+sizeof(SPERES)+0*sizeof(SPEUNIT)+4]^=1;}
 if(mode==13){nested=1;PlcMovie(MAIN_SPE,0,0,8,0,0,0);}
 if(mode==14){g_GenPos[subject].x++;}
 if(mode==30||mode==34){g_paintPalette[207]^=1;}
 if(mode==31){g_paintPalette[206]^=1;}
}
if(isLcdDirty&&((mode!=3&&mode!=32&&mode!=34)||messages%61==0))timed_flush_lcd();
if(mode==2&&!keyReads){m->type=VM_CHAR_FUN;m->param=39;keyReads++;}else{m->type=VM_TIMER;m->param=1;}
}
`+'\n'+actual('comIn.c','GamDelay')+'\n'+movies.functions+String.raw`
static int focusCalls,reportCalls,randCalls,terrainCalls,driverCalls,initCalls;
static U8 expValue=1;static U8*SHARE_MEM;static JLATT g_GenAtt[2];
static U16 gam_rand(void){randCalls++;return 2;}
static PersonID TransIdxToGen2(U8 idx){return g_FgtParam.GenArray[idx]-1;}
static void FgtLoadToMem(U8 idx,U8*buf){buf[0]=idx;buf[1]=0;}
#define dFgtLevUp0 1
#define dFgtDead0 4
static void FgtSetFocus(U8 idx){assert(idx==subject);focusCalls++;if(mode==35)baye_hd_spe_invalidate();}
static void ShowGReport(PersonID person,U8*text){assert(person==600);assert(text[0]==3||text[0]==6);reportCalls++;assert(!g_hdSpeStatusValid&&!g_hdSpeDisplayStatusValid);baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);baye_hd_report_end();}
static U8 FgtDrvCmd(FGTCMD*cmd){assert(cmd->sIdx==subject);driverCalls++;return expValue;}
static void FgtShowMap(U8 x,U8 y){assert(x==g_MapSX&&y==g_MapSY);}
static void FgtShowGen(U8 active){assert(!active);}
static void FgtShowGetExp(U8 exp){assert(exp==expValue);}
static U8 FgtGetTerrain(U8 x,U8 y){assert(x==g_GenPos[subject].x&&y==g_GenPos[subject].y);terrainCalls++;return 1;}
static void FgtIntVar(void){initCalls++;}static void FgtIntMap(void){initCalls++;}static void FgtIntScr(void){initCalls++;}
static void FgtCountWon(void){assert(0);}static void FgtChkEnd(U8 side){assert(side<=1);}
#define IF_HAS_HOOK(n) if(0)
#define CALL_HOOK_A() (-1)
#define HOOK_LEAVE() ((void)0)
static void FgtShowChgSpe(U8 a,U8 b,U8 x,U8 y);static void FgtChkAtkEnd(void);
`+String.fromCharCode(10)+actual('tactic.c','LevelUp')+String.fromCharCode(10)+['FgtShowChgSpe','FgtChkAtkEnd','FgtInit','FgtExeCmd'].map(n=>actual('Fight.c',n)).join(String.fromCharCode(10))+String.raw`
int main(int argc,char**argv){assert(argc==4);mode=atoi(argv[1]);FILE*f=fopen(argv[2],"rb");assert(f);fseek(f,0,SEEK_END);romFile.length=(U32)ftell(f);rewind(f);g_CBnkPtr=malloc(romFile.length);assert(g_CBnkPtr&&fread(g_CBnkPtr,1,romFile.length,f)==romFile.length);fclose(f);romFile.bytes=g_CBnkPtr;trace=fopen(argv[3],"wb");assert(trace);
U8 shared[32];SHARE_MEM=shared;screen_buffer_realloc(MAX_SCR_BUF_LEN);for(int i=0;i<160*96;i++)g_VisScr[i]=(i%160+(i/160)*3)%5==0?255:0;memcpy(scr_buffer,g_VisScr,MAX_SCR_BUF_LEN);for(int i=0;i<256;i++)g_paintPalette[i]=((U32)i<<24)|((U32)(255-i)*0x010101u);_lcd_fluch_cb=callback;g_hdFightActive=1;g_engineConfig.maxLevel=30;
for(int i=0;i<FGTA_MAX;i++)g_GenPos[i].state=STATE_SW;
if(mode==15)subject=13;g_FgtParam.GenArray[subject]=601;g_GenPos[subject]=(JLPOS){.x=8,.y=6,.hp=50,.state=0};g_Persons[600].Level=10;g_Persons[600].Experience=99;g_Persons[600].Arms=100;g_GenAtt[0].exp=&g_Persons[600].Experience;
if(mode==1){g_Persons[600].Experience=0;g_Persons[600].Arms=0;}
if(mode==16)g_GenPos[subject].x=13;
if(mode==17)g_Persons[600].Level=30;
if(mode==18){g_engineConfig.maxLevel=255;g_Persons[600].Level=255;}
if(mode==19||mode==22)g_GenPos[subject].hp=0;
if(mode==21){g_hdFightActive=0;g_Persons[600].Experience=100;}
if(mode==23||mode==29||mode==30||mode==31||mode==32||mode==33||mode==34)for(int y=0;y<16;y++)for(int x=0;x<16;x++)g_VisScr[(32+y)*160+80+x]=mode==33?(U8)(y*16+x):207;
if(mode==24){U32 at=GetResStartAddr(STACHG_SPE);g_CBnkPtr[at+sizeof(RCHEAD)+sizeof(SPERES)]=1;}
if(mode==25){U32 at=GetResStartAddr(STACHG_SPE);g_CBnkPtr[at+sizeof(RCHEAD)+sizeof(SPERES)+18*sizeof(SPEUNIT)+2*71+6]=0;}
if(mode==26)notifyReset=1;if(mode==27)g_screenWidth=176;if(mode==28)g_MapSX=9;
assert(g_hdSpeStatusProtocolVersion==1);FGTCMD cmd={.sIdx=subject};
if(mode==20){g_Persons[600].Experience=100;g_hdFightActive=0;FgtChkAtkEnd();}
else if(mode==21)FgtInit();else FgtExeCmd(&cmd);
if(mode==16){assert(!hdSpePendingContext&&!g_hdSpePendingKind);PlcMovie(MAIN_SPE,0,0,8,0,0,0);}
if(isLcdDirty)timed_flush_lcd();record(3);
assert(!g_hdSpeActive&&!g_hdSpeStatusValid&&!g_hdSpeDisplayStatusValid);
assert(driverCalls==(mode==20||mode==21?0:1));assert(terrainCalls==(mode==20||mode==21?0:1));assert(initCalls==(mode==21?3:0));
assert(randCalls==1);assert(focusCalls==(mode==19||mode==22?2:1));assert(reportCalls==focusCalls);
assert(g_Persons[600].Experience==(mode==1?1:0));assert(g_Persons[600].Level==(mode==1?10:mode==17?30:mode==18?0:11));
if(mode==1||mode==19||mode==22)assert(g_GenPos[subject].state==STATE_SW);
if(mode==2)assert(keyReads==1&&g_hdSpeEndReason==BAYE_HD_SPE_END_COMPLETE);if(mode==13)assert(nested);
fclose(trace);free(g_CBnkPtr);puts("actual status native fixture passed");return 0;
}`;
    return compile(source);
})();return binary;}
function traceDecode(b){const row=28*4+640+160*96+2048+160*96*4;assert.equal(b.length%row,0);const out=[];for(let at=0;at<b.length;at+=row){const v=Array.from({length:28},(_,i)=>b.readUInt32LE(at+i*4));let p=at+112;const chunk=n=>{const r=b.subarray(p,p+n);p+=n;return r;};out.push({kind:v[0],generation:v[1],event:v[2],commit:v[3],frame:v[4],active:v[5],valid:v[6],displayEvent:v[7],displayCommit:v[8],displayFrame:v[9],displayFrameValid:v[10],displayValid:v[11],actor:v[12],target:v[13],command:v[14],param:v[15],messages:v[16],beforeLevel:v[17],afterLevel:v[18],beforeExp:v[19],afterExp:v[20],beforeState:v[21],afterState:v[22],beforeHp:v[23],afterHp:v[24],beforeArms:v[25],afterArms:v[26],levelMax:v[27],visible:chunk(32),cleared:chunk(32),base:chunk(256),displayVisible:chunk(32),displayCleared:chunk(32),displayBase:chunk(256),pixels:chunk(160*96),baseRgba:chunk(1024),displayBaseRgba:chunk(1024),nativeRgba:chunk(160*96*4)});}return out;}
async function scenario(mode){const bin=await executable(),file=join(dirname(bin),`mode-${mode}.bin`);const result=await run(bin,[String(mode),join(root,'libs/dat-mod.lib'),file],{timeout:20000});assert.match(result.stdout,/actual status native fixture passed/);return traceDecode(readFileSync(file));}
function paletteRgba(pixels,changedIndex=-1){const out=Buffer.alloc(pixels.length*4);for(let i=0;i<pixels.length;i++){const v=pixels[i];out.writeUInt32LE(((((v<<24)>>>0)|((255-v)*0x010101))^(v===changedIndex?1:0))>>>0,i*4);}return out;}
function regionPixels(full){return Buffer.concat(Array.from({length:16},(_,y)=>full.subarray((32+y)*160+80,(32+y)*160+96)));}
function fixturePixels(mode){const initial=initialPixels();for(let y=0;y<16;y++)for(let x=0;x<16;x++)if((mode===23||mode>=29&&mode<=34))initial[(32+y)*160+80+x]=mode===33?y*16+x:207;return initial;}
function verifyPixels(rows,initial=initialPixels(),start=0){const expectedRows=oracle(initial,start),base=regionPixels(initial),rgba=paletteRgba(base),copies=rows.filter(r=>r.kind===1);assert.equal(copies.length,expectedRows.length);for(let i=0;i<copies.length;i++){const r=copies[i],e=expectedRows[i];assert.equal(r.valid,1);assert.equal(r.frame,e.frame);assert.equal(r.commit,i+1);assert.deepEqual(r.base,base);assert.deepEqual(r.baseRgba,rgba);assert.deepEqual(r.visible,e.visible);assert.deepEqual(r.cleared,e.cleared);assert.deepEqual(r.pixels,e.pixels,`actual full native screen commit${r.commit}`);assert.deepEqual(r.nativeRgba,paletteRgba(e.pixels),'Actual convert_image output includes real pre-draw grayscale colors');}const displays=rows.filter(r=>r.kind===2&&r.displayValid);assert.ok(displays.length);for(const r of displays){const e=expectedRows[r.displayCommit-1];assert.equal(r.displayEvent,r.event);assert.ok(r.displayCommit<=r.commit);assert.equal(r.displayFrame,e.frame);assert.deepEqual(r.displayBase,base);assert.deepEqual(r.displayBaseRgba,rgba);assert.deepEqual(r.displayVisible,e.visible);assert.deepEqual(r.displayCleared,e.cleared);assert.deepEqual(r.pixels,e.pixels);assert.deepEqual(r.nativeRgba,paletteRgba(e.pixels),'Real timed-flush callback pixels equal independent palette/AND-OR oracle');}return{copies,displays};}

test('actual standard27 has separate level/retreat ranges and seven mask1 slots with explicit native zero pixels',()=>{
    assert.deepEqual(units.slice(0,6).map(u=>u.pic),[2,3,4,1,0,1]);assert.deepEqual(units.slice(6,12).map(u=>u.pic),[2,3,4,6,5,6]);
    for(let i=0;i<7;i++){const p=pictures[i];assert.deepEqual([p.offset,p.width,p.height,p.count,p.mask],[96+71*i,16,16,1,1]);let clear=0;for(let j=0;j<32;j++)for(let k=0;k<8;k++){const bit=128>>k;if(!(bytes[p.offset+7+j]&bit)&&!(bytes[p.offset+39+j]&bit))clear++;}assert.ok(clear>0);}
});
test('actual FgtExeCmd level transition binds high PID/player slot and every true native clear/live copy and timer flush',async()=>{
    const rows=await scenario(0);verifyPixels(rows);for(const r of rows.filter(r=>r.valid)){assert.equal(r.actor,600);assert.equal(r.target,3);assert.equal(r.command,1);assert.equal(r.param,1);assert.deepEqual([r.beforeLevel,r.afterLevel,r.beforeExp,r.afterExp],[10,11,100,0]);}
});
test('actual zeroArms death is captured after STATE_SW8 with original report/command semantics',async()=>{
    const rows=await scenario(1);verifyPixels(rows,initialPixels(),6);for(const r of rows.filter(r=>r.valid)){assert.equal(r.command,2);assert.deepEqual([r.beforeState,r.afterState,r.beforeArms,r.afterArms],[0,8,0,0]);}
});
test('actual keyflag0 cannot skip a status movie on a true Enter message',async()=>verifyPixels(await scenario(2)));
test('actual timer coalescing certifies older displayed status independently from current logic',async()=>{const v=verifyPixels(await scenario(3));assert.ok(v.displays.length<v.copies.length);});
for(const[mode,label]of[[4,'virtual write'],[5,'LCD write'],[6,'reset'],[7,'report'],[8,'HELP'],[9,'quantity'],[10,'flip'],[11,'palette endpoint'],[12,'movie bytes'],[13,'nested movie'],[14,'subject movement']])test(`actual ${label} permanently retires status proof while original movie/transition/report continues`,async()=>{
    const rows=await scenario(mode);assert.equal(rows.find(r=>r.kind===1).valid,1);const cut=rows.findIndex((r,i)=>i>0&&!r.valid&&(mode===6?r.generation>rows[0].generation:r.active));assert.ok(cut>=0);for(const r of rows.slice(cut)){assert.equal(r.valid,0);assert.equal(r.displayValid,0);assert.ok(r.base.every(v=>!v)&&r.baseRgba.every(v=>!v)&&r.displayBase.every(v=>!v)&&r.displayBaseRgba.every(v=>!v));}
});
test('actual enemy subject slot13 uses status proof without AI actor restrictions',async()=>{const rows=await scenario(15);verifyPixels(rows);assert.equal(rows.find(r=>r.valid).target,13);});
for(const[mode,label]of[[16,'offscreen'],[20,'inactive check without actual init scope'],[24,'unit offset'],[25,'opaque slot'],[26,'notify reset'],[27,'expanded screen'],[28,'wrapped viewport'],[35,'focus reset between before/after']])test(`actual ${label} never certifies status pixels and consumes pending context`,async()=>{
    const rows=await scenario(mode);assert.ok(rows.length);for(const r of rows){assert.equal(r.valid,0);assert.equal(r.displayValid,0);assert.ok(r.base.every(v=>!v)&&r.baseRgba.every(v=>!v));}
});
test('actual max-level movie/report allows unchanged Level',async()=>{const rows=await scenario(17);verifyPixels(rows);const r=rows.find(r=>r.valid);assert.deepEqual([r.beforeLevel,r.afterLevel,r.levelMax],[30,30,30]);});
test('actual U8 LevelUp255 wraps0 before max-level clamp',async()=>{const rows=await scenario(18);verifyPixels(rows);const r=rows.find(r=>r.valid);assert.deepEqual([r.beforeLevel,r.afterLevel,r.levelMax],[255,0,255]);});
test('actual same subject can level at HP0 then retreat in a separate event',async()=>{
    const rows=await scenario(19),copies=rows.filter(r=>r.kind===1),events=[...new Set(copies.map(r=>r.event))];assert.equal(events.length,2);
    const first=rows.filter(r=>r.event===events[0]);const v=verifyPixels(first);const second=rows.filter(r=>r.event===events[1]);verifyPixels(second,v.copies.at(-1).pixels,6);assert.equal(copies[0].afterHp,0);assert.equal(copies[0].afterState,0);assert.equal(copies.at(-1).afterState,8);
});
test('actual FgtInit binds initialization phase while native fight active0',async()=>{const rows=await scenario(21);verifyPixels(rows);assert.equal(rows.find(r=>r.valid).param,2);});
for(const mode of[23,29,31,32,33])test(`actual gray/base palette status remains byteexact case${mode}`,async()=>verifyPixels(await scenario(mode),fixturePixels(mode)));
for(const mode of[30,34])test(`actual used gray palette change permanently retires status and copied source case${mode}`,async()=>{const rows=await scenario(mode);assert.equal(rows.find(r=>r.kind===1).valid,1);const cut=rows.findIndex(r=>r.active&&!r.valid&&r.messages>=4);assert.ok(cut>=0);for(const r of rows.slice(cut)){assert.equal(r.valid,0);assert.equal(r.displayValid,0);}});
