#!/usr/bin/env node
// Actual native AI movie caller, ROM, screen draws, copies and timer commits.
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
const files=['hd-bridge.c','hd-bridge.h','PublicFun.c','FgtPkAi.c','platform/common/sys.c','comOut.c','comIn.c','datman.c'];
const sourceTuple=Object.fromEntries(files.map(f=>[f,sha(readFileSync(join(root,'vendor/iBaye/src',f)))]));
function signature(name){return new RegExp('^(?:(?:static|inline|FAR|const)\\s+)*(?:[A-Za-z_]\\w*)[\\t *]+'+name+'\\([^;]*?\\)\\s*\\{','m');}
function actual(file,name){const source=read(file),m=signature(name).exec(source);assert.ok(m,`actual ${file}::${name}`);const end=source.indexOf('\n}',m.index);assert.ok(end>m.index);return source.slice(m.index,end+2);}
function type(file,name){const m=new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*'+name+';').exec(read(file));assert.ok(m,`actual ${name}`);return m[0];}
function closure(file,seeds){const source=read(file),found=new Map();function add(name){if(found.has(name))return;let body;try{body=actual(file,name);}catch{return;}found.set(name,body);for(const call of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))if(signature(call[1]).test(source))add(call[1]);}for(const seed of seeds){assert.ok(signature(seed).test(source));add(seed);}return{prototypes:[...found.values()].map(b=>b.slice(0,b.indexOf('{')).trim()+';').join('\n'),functions:[...found.values()].join('\n')};}
async function compile(source){const dir=mkdtempSync(join(tmpdir(),'baye-hd-ai-target-'));temporary.push(dir);const file=join(dir,'actual-ai.c'),binary=join(dir,'actual-ai'+(process.platform==='win32'?'.exe':''));writeFileSync(file,source);try{await run(process.env.CC||'cc',['-std=c99','-fpack-struct=1','-Wall','-Wextra',file,'-o',binary],{timeout:30000});}catch(e){throw Error('Actual AI C compile: '+(e.stderr?.split(/\r?\n/).filter(l=>/error:|fatal error:/.test(l)).join('\n')||e.message));}return binary;}
after(()=>{for(const dir of temporary){assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('baye-hd-ai-target-'));rmSync(dir,{recursive:true,force:true});}for(const[f,h]of Object.entries(sourceTuple))assert.equal(sha(readFileSync(join(root,'vendor/iBaye/src',f))),h,'Native source changed during actual C acceptance: '+f);});
const lib=readFileSync(join(root,'libs/dat-mod.lib'));assert.equal(sha(lib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
const resAt=lib.readUInt32LE(26*4),length=lib.readUInt32LE(resAt+8),bytes=lib.subarray(resAt+14,resAt+14+length);
assert.equal(lib.readUInt16LE(resAt+4),27);assert.equal(bytes.length,735);
let fnv=0x811c9dc5;for(const b of bytes)fnv=Math.imul((fnv^b)>>>0,0x01000193)>>>0;assert.equal(fnv,0xba494eea);
const units=Array.from({length:bytes[2]},(_,frame)=>{const at=6+frame*5;return{frame,x:bytes[at],y:bytes[at+1],cdelay:bytes[at+2],ndelay:bytes[at+3],pic:bytes[at+4]};});
let offset=6+units.length*5;const pictures=[];for(let i=0;i<bytes[3];i++){const width=bytes.readUInt16LE(offset),height=bytes.readUInt16LE(offset+2),count=bytes.readUInt16LE(offset+4),mask=bytes[offset+6],plane=Math.ceil(width/8)*height;pictures.push({offset,width,height,count,mask,plane});offset+=7+plane*(mask+1);}assert.equal(offset,bytes.length);
function initialPixels(){return Buffer.from(Array.from({length:160*96},(_,i)=>((i%160+Math.floor(i/160)*3)%5===0?255:0)));}
function draw(out,u,x0=80,y0=32){const p=pictures[u.pic],stride=Math.ceil(p.width/8);for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const at=p.offset+7+y*stride+(x>>3),bit=128>>(x&7),dest=(y0+u.y+y)*160+x0+u.x+x;if(!(bytes[at]&bit))out[dest]=0;if(bytes[at+p.plane]&bit)out[dest]=255;}}
function oracle(startPixels=initialPixels()){const list=units.slice(12,18),next=list.map(u=>u.ndelay),remaining=list.map(u=>u.cdelay),pixels=Buffer.from(startPixels),cleared=Buffer.alloc(32),frames=[];let frontier=0,previous=0,dirty=true,introduced=true,loops=0;while(true){assert.ok(++loops<10000);for(let i=0;i<=frontier;i++){if(remaining[i]===1){const u=list[i],p=pictures[u.pic];for(let y=32+u.y;y<32+u.y+p.height;y++)pixels.fill(0,y*160+80+u.x,y*160+80+u.x+p.width);cleared[(12+i)>>3]|=1<<((12+i)&7);dirty=true;}if(remaining[i])remaining[i]--;}
    if(dirty)for(let i=0;i<=previous;i++)if(remaining[i])draw(pixels,list[i]);if(introduced){for(let i=previous+1;i<=frontier;i++)if(remaining[i])draw(pixels,list[i]);previous=frontier;}if(dirty||introduced){const visible=Buffer.alloc(32);for(let i=0;i<=frontier;i++)if(remaining[i])visible[(12+i)>>3]|=1<<((12+i)&7);frames.push({frame:12+frontier,visible,cleared:Buffer.from(cleared),pixels:Buffer.from(pixels)});dirty=introduced=false;}if(next[frontier]>=1)next[frontier]--;while(next[frontier]<=1&&frontier<5){frontier++;introduced=true;}if(frontier===5&&remaining.every(v=>v<=1))break;}return frames;}
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
#define MAX_LEVEL 30
#define FGT_EXPMAX 100
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
    const defines=(read('baye/consdef.h')+'\n'+read('baye/fight.h')+'\n'+read('baye/graph.h')+'\n'+read('inc/dictsys.h')+'\n'+read('baye/attribute.h')).split('\n').filter(l=>/^#define\s+(?:MAIN_SPE|MAKER_SPE|STACHG_SPE|SPE_BACKPIC|NUM_PICID|FIRE_SPE|QIBING_SPE|SHUISHANG_SPE|FGT_SPESX|FGT_SPESY|SHOW_DLYBASE|PICHEAD_LEN|TACTIC_ICON|FGTA_MAX|FGT_PLAMAX|PERSON_MAX|STATE_\w+|CMD_\w+|TIL_WID|WK_SX|WK_SY|FgtGetScrX|FgtGetScrY)\b/.test(l)).join('\n');
    const types=['HdStatusCheckScope','HdStatusTransition','HdStatusEffectSource','HdAiTargetSource','HdPictureSource','HdSpeScope','HdResultScope'].map(t=>type('hd-bridge.h',t)).join('\n')+'\n'+['RCHEAD','RIDX'].map(t=>type('baye/datman.h',t)).join('\n')+'\n'+['SPERES','SPEUNIT'].map(t=>type('baye/paccount.h',t)).join('\n')+'\n'+type('baye/attribute.h','PersonType')+type('baye/graph.h','PictureHeadType')+'\n'+['JLPOS','FGTJK','FGTCMD'].map(t=>type('baye/fight.h',t)).join('\n');
    const helpers=closure('hd-bridge.c',['baye_hd_ai_target_context','baye_hd_status_shape','baye_hd_ai_target_shape','baye_hd_skill_movie_shape','baye_hd_spe_enter','baye_hd_spe_ready','baye_hd_spe_frame','baye_hd_spe_end','baye_hd_spe_tick','baye_hd_spe_draw_begin','baye_hd_spe_draw_end','baye_hd_spe_clear','baye_hd_spe_lcd_dirty','baye_hd_spe_lcd_copy','baye_hd_spe_lcd_flush','baye_hd_spe_invalidate','baye_hd_surface_write','baye_hd_report_begin','baye_hd_report_end','baye_hd_set_help','baye_hd_set_qty']);
    const movies=closure('PublicFun.c',['PlcMovie']),resources=closure('datman.c',['GetResStartAddr','GetResItem','ResGetItemLen','ResLoadToCon']);
    const pixels=['screen_buffer_realloc','_insideScreen','convert_image','timed_flush_lcd','flushLcd','_dot','SysLcdPartClear','DecodePic','SysPictureEx','SysPicture','SysSelectScreen','SysCopyScreen','SysSaveScreen','SysRestoreScreen','SysAdjustLCDBuffer'].map(n=>actual('platform/common/sys.c',n)).join('\n');
    const comOut=['GamPicShow','GamPicShowV','GamPicShowS','GamMPicShow','GamMPicShowV','GamMPicShowS','GamClearScreenV','GamShowFrame'].map(n=>actual('comOut.c',n)).join('\n');
    const source=cBase+'\n'+constants+'\n'+defines+'\n'+types+String.raw`
static JLPOS g_GenPos[FGTA_MAX];static FGTJK g_FgtParam;
static PersonType g_Persons[PERSON_MAX];
static U8 g_MapSX=3,g_MapSY=4,g_MapWid=32,g_MapHgt=32,g_FgtOver;
static int countCalls;static U32 fixtureCount=700;
static U32 GamGetPersonCount(void){countCalls++;return fixtureCount;}
static int notifyReset;static void fixtureNotify(void);
#define EM_ASM(...) fixtureNotify()
`+'\n'+globals+'\n'+helpers.prototypes+'\n'+helpers.functions+'\n'+resources.prototypes+'\n'+resources.functions+'\n'+movies.prototypes+String.raw`
static FILE*trace;static int mode,messages,changed,keyReads,nested;static char*callbackRgba;
static void convert_image(U32*dst,char*src);
static void word(U32 v){U8 b[4]={(U8)v,(U8)(v>>8),(U8)(v>>16),(U8)(v>>24)};assert(fwrite(b,1,4,trace)==4);}
static void record(U32 kind){word(kind);word(g_hdSpeGeneration);word(g_hdSpeEventId);word(g_hdSpeCommitSeq);word(g_hdSpeFrameIndex);word(g_hdSpeActive);word(g_hdSpeAiValid);word(g_hdSpeDisplayEventId);word(g_hdSpeDisplayCommitSeq);word(g_hdSpeDisplayFrameIndex);word(g_hdSpeDisplayFrameValid);word(g_hdSpeDisplayAiValid);word(g_hdSpeAiActorPerson);word(g_hdSpeAiTargetPerson);word(g_hdSpeAiCommandType);word(g_hdSpeAiCommandParam);word(messages);
assert(fwrite(g_hdSpeVisibleFrames,1,32,trace)==32);assert(fwrite(g_hdSpeAiClearFrames,1,32,trace)==32);assert(fwrite(g_hdSpeAiBasePixels,1,256,trace)==256);assert(fwrite(g_hdSpeDisplayVisibleFrames,1,32,trace)==32);assert(fwrite(g_hdSpeDisplayAiClearFrames,1,32,trace)==32);assert(fwrite(g_hdSpeDisplayAiBasePixels,1,256,trace)==256);assert(fwrite(scr_buffer,1,160*96,trace)==160*96);assert(fwrite(g_hdSpeAiBaseRgba,1,1024,trace)==1024);assert(fwrite(g_hdSpeDisplayAiBaseRgba,1,1024,trace)==1024);if(callbackRgba){assert(fwrite(callbackRgba,1,160*96*4,trace)==160*96*4);}else{U32 rgba[176*96];convert_image(rgba,scr_buffer);assert(fwrite(rgba,1,160*96*4,trace)==160*96*4);}}
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
 if(mode==12){U32 at=GetResStartAddr(STACHG_SPE);g_CBnkPtr[at+sizeof(RCHEAD)+sizeof(SPERES)+12*sizeof(SPEUNIT)+4]^=1;}
 if(mode==13){nested=1;PlcMovie(MAIN_SPE,0,0,8,0,0,0);}
 if(mode==14){g_GenPos[3].x++;}
 if(mode==30||mode==34){g_paintPalette[207]^=1;}
 if(mode==31){g_paintPalette[206]^=1;}
}
if(isLcdDirty&&((mode!=3&&mode!=32&&mode!=34)||messages%61==0))timed_flush_lcd();
if(mode==2&&!keyReads){m->type=VM_CHAR_FUN;m->param=39;keyReads++;}else{m->type=VM_TIMER;m->param=1;}
}
`+'\n'+actual('comIn.c','GamDelay')+'\n'+movies.functions+String.raw`
static FGTCMD chosen;static int chooseCalls,focusCalls;static U8 chosenReturn=10;
static U8 FgtGetMCmdNear(FGTCMD*cmd){chooseCalls++;memcpy(cmd,&chosen,sizeof(*cmd));return chosenReturn;}
static void FgtSetFocus(U8 idx){assert(idx==chosen.aIdx);focusCalls++;}
`+'\n'+actual('FgtPkAi.c','FgtGetMCmd')+String.raw`
int main(int argc,char**argv){assert(argc==4);mode=atoi(argv[1]);FILE*f=fopen(argv[2],"rb");assert(f);fseek(f,0,SEEK_END);romFile.length=(U32)ftell(f);rewind(f);g_CBnkPtr=malloc(romFile.length);assert(g_CBnkPtr&&fread(g_CBnkPtr,1,romFile.length,f)==romFile.length);fclose(f);romFile.bytes=g_CBnkPtr;trace=fopen(argv[3],"wb");assert(trace);
screen_buffer_realloc(MAX_SCR_BUF_LEN);for(int i=0;i<160*96;i++)g_VisScr[i]=(i%160+(i/160)*3)%5==0?255:0;memcpy(scr_buffer,g_VisScr,MAX_SCR_BUF_LEN);for(int i=0;i<256;i++)g_paintPalette[i]=((U32)i<<24)|((U32)(255-i)*0x010101u);_lcd_fluch_cb=callback;g_hdFightActive=1;
g_FgtParam.GenArray[10]=601;g_FgtParam.GenArray[3]=87;g_GenPos[10].x=7;g_GenPos[10].y=5;g_GenPos[3].x=8;g_GenPos[3].y=6;chosen=(FGTCMD){.type=CMD_ATK,.param=0xffff,.sIdx=10,.aIdx=3};
if(mode==1){chosen.type=CMD_STGM;chosen.param=65535;}if(mode==15){g_FgtParam.GenArray[10]=2001;fixtureCount=2200;}if(mode==16)g_GenPos[3].x=13;if(mode==17)g_GenPos[3].state=STATE_SW;if(mode==18)chosen.sIdx=9;
if(mode==19){chosen.aIdx=10;g_GenPos[10].x=8;g_GenPos[10].y=6;}if(mode==20){chosen.type=CMD_REST;}if(mode==21){chosenReturn=255;}if(mode==22){chosen.type=CMD_STGM;chosen.param=0;}if(mode==23){g_VisScr[32*160+80]=127;}if(mode==24){U32 at=GetResStartAddr(STACHG_SPE);g_CBnkPtr[at+sizeof(RCHEAD)+sizeof(SPERES)+12*sizeof(SPEUNIT)]=1;}
if(mode==25){U32 at=GetResStartAddr(STACHG_SPE);g_CBnkPtr[at+sizeof(RCHEAD)+sizeof(SPERES)+18*sizeof(SPEUNIT)+7*71+6]=0;}
if(mode==26){notifyReset=1;}if(mode==27){g_screenWidth=176;}if(mode==28)g_MapSX=9;
if(mode>=29&&mode<=34){for(int y=0;y<16;y++)for(int x=0;x<16;x++)g_VisScr[(32+y)*160+80+x]=mode==33?(U8)(y*16+x):207;}
assert(g_hdSpeAiProtocolVersion==2);
FGTCMD cmd;memset(&cmd,0,sizeof(cmd));bool got=FgtGetMCmd(&cmd);assert(got==(chosenReturn!=255));assert(!memcmp(&cmd,&chosen,sizeof(cmd)));assert(chooseCalls==1);if(mode==20||mode==21){assert(!focusCalls&&!countCalls&&!g_hdSpeLastEndedId);}else assert(focusCalls==1);if(isLcdDirty)timed_flush_lcd();record(3);
assert(!g_hdSpeActive&&!g_hdSpeAiValid&&!g_hdSpeDisplayAiValid);if(mode==2)assert(keyReads==1&&g_hdSpeEndReason==BAYE_HD_SPE_END_COMPLETE);if(mode==13)assert(nested);fclose(trace);free(g_CBnkPtr);puts("actual AI native fixture passed");return 0;
}`;
    return compile(source);
})();return binary;}
function traceDecode(b){const row=17*4+640+160*96+2048+160*96*4;assert.equal(b.length%row,0);const out=[];for(let at=0;at<b.length;at+=row){const v=Array.from({length:17},(_,i)=>b.readUInt32LE(at+i*4));let p=at+68;const chunk=n=>{const r=b.subarray(p,p+n);p+=n;return r;};out.push({kind:v[0],generation:v[1],event:v[2],commit:v[3],frame:v[4],active:v[5],valid:v[6],displayEvent:v[7],displayCommit:v[8],displayFrame:v[9],displayFrameValid:v[10],displayValid:v[11],actor:v[12],target:v[13],command:v[14],param:v[15],messages:v[16],visible:chunk(32),cleared:chunk(32),base:chunk(256),displayVisible:chunk(32),displayCleared:chunk(32),displayBase:chunk(256),pixels:chunk(160*96),baseRgba:chunk(1024),displayBaseRgba:chunk(1024),nativeRgba:chunk(160*96*4)});}return out;}
async function scenario(mode){const bin=await executable(),file=join(dirname(bin),`mode-${mode}.bin`);const result=await run(bin,[String(mode),join(root,'libs/dat-mod.lib'),file],{timeout:20000});assert.match(result.stdout,/actual AI native fixture passed/);return traceDecode(readFileSync(file));}
function paletteRgba(pixels,changedIndex=-1){const out=Buffer.alloc(pixels.length*4);for(let i=0;i<pixels.length;i++){const v=pixels[i];out.writeUInt32LE(((((v<<24)>>>0)|((255-v)*0x010101))^(v===changedIndex?1:0))>>>0,i*4);}return out;}
function regionPixels(full){return Buffer.concat(Array.from({length:16},(_,y)=>full.subarray((32+y)*160+80,(32+y)*160+96)));}
function fixturePixels(mode){const initial=initialPixels();if(mode===23)initial[32*160+80]=127;for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(mode>=29&&mode<=34)initial[(32+y)*160+80+x]=mode===33?y*16+x:207;return initial;}
function verifyPixels(rows,initial=initialPixels()){const expectedRows=oracle(initial),base=regionPixels(initial),rgba=paletteRgba(base),copies=rows.filter(r=>r.kind===1);assert.equal(copies.length,expectedRows.length);for(let i=0;i<copies.length;i++){const r=copies[i],e=expectedRows[i];assert.equal(r.valid,1);assert.equal(r.frame,e.frame);assert.equal(r.commit,i+1);assert.deepEqual(r.base,base);assert.deepEqual(r.baseRgba,rgba);assert.deepEqual(r.visible,e.visible);assert.deepEqual(r.cleared,e.cleared);assert.deepEqual(r.pixels,e.pixels,`actual full native screen commit${r.commit}`);assert.deepEqual(r.nativeRgba,paletteRgba(e.pixels),'Actual convert_image output includes real pre-draw grayscale colors');}const displays=rows.filter(r=>r.kind===2&&r.displayValid);assert.ok(displays.length);for(const r of displays){const e=expectedRows[r.displayCommit-1];assert.equal(r.displayEvent,r.event);assert.ok(r.displayCommit<=r.commit);assert.equal(r.displayFrame,e.frame);assert.deepEqual(r.displayBase,base);assert.deepEqual(r.displayBaseRgba,rgba);assert.deepEqual(r.displayVisible,e.visible);assert.deepEqual(r.displayCleared,e.cleared);assert.deepEqual(r.pixels,e.pixels);assert.deepEqual(r.nativeRgba,paletteRgba(e.pixels),'Real timed-flush callback pixels equal independent palette/AND-OR oracle');}return{copies,displays};}
test('actual standard status resource has six AI frames, two native AND/OR swords and explicit white-clearing pixels',()=>{assert.deepEqual(units.slice(12).map(u=>u.pic),[7,8,7,8,7,8]);for(const i of[7,8]){const p=pictures[i];assert.deepEqual([p.width,p.height,p.count,p.mask],[16,16,1,1]);let white=0,keep=0,ink=0;for(let y=0;y<16;y++)for(let x=0;x<16;x++){const at=p.offset+7+y*2+(x>>3),bit=128>>(x&7),a=bytes[at]&bit,b=bytes[at+32]&bit;if(b)ink++;else if(a)keep++;else white++;}assert.deepEqual([keep,ink,white],[223,26,7]);}assert.ok(expected.at(-1).visible[2]&2);});
test('actual FgtGetMCmd attack hint uses native high-U16 PID and fixed pre-draw base plus each real clear/live copy',async()=>{const rows=await scenario(0);verifyPixels(rows);for(const r of rows.filter(r=>r.valid)){assert.equal(r.actor,600);assert.equal(r.target,86);assert.equal(r.command,0);assert.equal(r.param,0);}});
test('actual selected STGM preserves the full native U16 command parameter without calling a second planning hook',async()=>{const rows=await scenario(1);verifyPixels(rows);for(const r of rows.filter(r=>r.valid)){assert.equal(r.command,1);assert.equal(r.param,65535);}});
test('actual keyflag0 consumes Enter without skipping AI frames or altering command',async()=>verifyPixels(await scenario(2)));
test('actual native timer coalescing carries copied AI base/clear/frame, without pretending current commit is displayed',async()=>{const rows=await scenario(3),{copies,displays}=verifyPixels(rows);assert.ok(displays.length<copies.length);});
for(const[mode,label]of[[4,'uncontrolled virtual draw'],[5,'actual LCD draw'],[6,'generation reset'],[7,'report wait'],[8,'HELP wait'],[9,'quantity wait'],[10,'flip change'],[11,'palette change'],[12,'borrowed native movie mutation'],[13,'nested movie'],[14,'actual target movement']])test(`${label} permanently retires AI proof while the original movie unwinds`,async()=>{const rows=await scenario(mode),first=rows.find(r=>r.kind===1);assert.equal(first.valid,1);const cut=rows.findIndex((r,i)=>i>0&&!r.valid&&(mode===6?r.generation>first.generation:r.active));assert.ok(cut>=0,`retirement mode${mode}`);for(const r of rows.slice(cut)){assert.equal(r.valid,0);assert.equal(r.displayValid,0);assert.ok(r.base.every(v=>v===0)&&r.displayBase.every(v=>v===0));assert.ok(r.baseRgba.every(v=>v===0)&&r.displayBaseRgba.every(v=>v===0));}});
for(const[mode,label]of[[15,'PID beyond PERSON_MAX'],[16,'partial/offscreen target'],[17,'dead target'],[18,'player actor slot'],[22,'zero STGM parameter'],[24,'unit outside target rectangle'],[25,'opaque selected slot'],[26,'notification reset before first paint'],[27,'expanded screen'],[28,'wrapped viewport origin']])test(`${label} keeps native playback but never authorizes HD AI pixels`,async()=>{const rows=await scenario(mode);assert.ok(rows.length);for(const r of rows){assert.equal(r.valid,0);assert.equal(r.displayValid,0);assert.ok(r.base.every(v=>v===0)&&r.displayBase.every(v=>v===0));assert.ok(r.baseRgba.every(v=>v===0)&&r.displayBaseRgba.every(v=>v===0));}});
test('actual same actor/target command is recorded without invented enemy/ally legality',async()=>{const rows=await scenario(19);verifyPixels(rows);for(const r of rows.filter(r=>r.valid))assert.equal(r.target,r.actor);});
for(const[mode,label]of[[20,'REST'],[21,'no AI command']])test(`actual ${label} never calls movie or publishes an AI source`,async()=>{const rows=await scenario(mode);assert.equal(rows.length,1);assert.equal(rows[0].valid,0);assert.equal(rows[0].displayValid,0);});
test('actual arbitrary pre-draw index127 captures its real RGBA instead of inventing binary ink',async()=>verifyPixels(await scenario(23),fixturePixels(23)));
test('actual map gray207 preserves all AND-transparent pixels, clears explicit white and writes black with full native LCD equality',async()=>{const rows=await scenario(29);verifyPixels(rows,fixturePixels(29));const first=regionPixels(rows.find(r=>r.kind===1).pixels);assert.equal(first.filter(v=>v===207).length,223);assert.equal(first.filter(v=>v===255).length,26);assert.equal(first.filter(v=>v===0).length,7);assert.deepEqual(rows.find(r=>r.valid).baseRgba.subarray(0,4),Buffer.from([48,48,48,207]));});
test('actual unused palette206 change keeps fixed gray207 proof and every native copy/flush pixel unchanged',async()=>verifyPixels(await scenario(31),fixturePixels(31)));
test('actual gray timer coalescing carries one fixed RGBA base on older displayed stamps',async()=>{const rows=await scenario(32),v=verifyPixels(rows,fixturePixels(32));assert.ok(v.displays.length<v.copies.length);});
test('actual all256 native indices serialize their exact unsigned palette colors before native sprite composition',async()=>{const rows=await scenario(33);verifyPixels(rows,fixturePixels(33));assert.deepEqual(rows.find(r=>r.valid).base,Buffer.from(Array.from({length:256},(_,i)=>i)));});
for(const mode of[30,34])test(`actual used gray207 palette mutation permanently retires source and copied display while native pixels continue (coalesced=${mode===34})`,async()=>{const rows=await scenario(mode),expectedRows=oracle(fixturePixels(mode));assert.equal(rows.find(r=>r.kind===1).valid,1);const cut=rows.findIndex(r=>r.active&&!r.valid&&r.messages>=4);assert.ok(cut>=0);for(const r of rows.slice(cut)){assert.equal(r.valid,0);assert.equal(r.displayValid,0);assert.ok(r.base.every(v=>v===0)&&r.displayBase.every(v=>v===0)&&r.baseRgba.every(v=>v===0)&&r.displayBaseRgba.every(v=>v===0));}for(const r of rows.filter(r=>r.kind===1||r.kind===2)){const e=expectedRows[r.kind===1?r.commit-1:r.displayCommit-1];assert.ok(e);assert.deepEqual(r.pixels,e.pixels);assert.deepEqual(r.nativeRgba,paletteRgba(e.pixels,r.messages>=4?207:-1));}});
