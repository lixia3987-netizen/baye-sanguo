#!/usr/bin/env node
// Actual native attack/SPE/picture functions with real standard LIB payloads.
// Native message and ROM delivery are fixture boundaries; no browser or game
// state is manufactured to claim actual playable battle coverage.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import test, {after} from 'node:test';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(join(root,'vendor/iBaye/src',file),'utf8').replace(/\r\n/g,'\n');
const run=promisify(execFile),temporary=[];
function signature(name){return new RegExp('^(?:(?:static|inline|FAR|const)\\s+)*(?:[A-Za-z_]\\w*)[\\t *]+'+name+'\\([^;]*?\\)\\s*\\{','m');}
function actual(file,name){const source=read(file),m=signature(name).exec(source);
    assert.ok(m,`actual ${file}::${name}`);const end=source.indexOf('\n}',m.index);assert.ok(end>m.index);return source.slice(m.index,end+2);}
function type(file,name){const m=new RegExp('typedef\\s+struct[^;{]*\\{[^}]*\\}\\s*'+name+';').exec(read(file));assert.ok(m,`actual ${name}`);return m[0];}
const lib=readFileSync(join(root,'libs/dat-mod.lib'));
assert.equal(createHash('sha256').update(lib).digest('hex'),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
function resource(id){const a=lib.readUInt32LE((id-1)*4);assert.equal(lib.readUInt16LE(a+4),id);assert.equal(lib.readUInt16LE(a+6),1);const n=lib.readUInt32LE(a+8);assert.ok(n>0&&a+14+n<=lib.length);return lib.subarray(a+14,a+14+n);}
function decode(id){const b=resource(id),count=b[2],picmax=b[3],units=Array.from({length:count},(_,frame)=>{const at=6+frame*5;return{frame,x:b[at],y:b[at+1],cdelay:b[at+2],ndelay:b[at+3],picIndex:b[at+4]};});let at=6+count*5;const pictures=[];
    for(let i=0;i<picmax;i++){assert.ok(at+7<=b.length);const width=b.readUInt16LE(at),height=b.readUInt16LE(at+2),mask=b[at+6],size=Math.ceil(width/8)*height*(mask+1);assert.ok(width&&height&&mask<=1&&at+7+size<=b.length);pictures.push({width,height,mask,offset:at});at+=7+size;}
    assert.equal(at,b.length);assert.ok(units.every(u=>u.picIndex<picmax));return{id,bytes:b,count,picmax,units,pictures,start:b[4],end:b[5]};}
const attacks=[19,20,21,22,23,24,25].map(decode);
const widths=[11,10,9,10,9,10];
const ranges=attacks.flatMap(a=>a.id===25?[{id:25,arm:6,target:0,start:0,end:4}]:Array.from({length:6},(_,target)=>({id:a.id,arm:a.id-19,target,start:widths[a.id-19]*target,end:widths[a.id-19]*(target+1)-1})));
assert.equal(ranges.length,37);

async function compile(source,label){const dir=mkdtempSync(join(tmpdir(),'baye-hd-attack-'));temporary.push(dir);const filename=join(dir,label+'.c'),binary=join(dir,label+(process.platform==='win32'?'.exe':''));writeFileSync(filename,source);
    try{await run(process.env.CC||'cc',['-std=c99','-fpack-struct=1','-Wall','-Wextra',filename,'-o',binary],{timeout:30000});}
    catch(e){throw Error('Actual attack C compilation failed: '+(e.stderr?.split(/\r?\n/).filter(l=>/error:|fatal error:/.test(l)).join('\n')||e.message));}return binary;}
after(()=>{for(const dir of temporary){assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('baye-hd-attack-'));rmSync(dir,{recursive:true,force:true});}});

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
#define gam_itoa(v,p,r) snprintf((char*)(p),10,"%u",(unsigned)(v))
#define gam_strlen(p) strlen((const char*)(p))
#define gam_drawpic(id,ind,x,y,flag) PlcRPicShowEx(id,0,(ind)+1,x,y,flag)
static int g_screenWidth=160,g_screenHeight=96;
static U8 g_FlipDrawing=0,g_paintColor=255,g_VisScr[160*96];
static U32 g_paintPalette[256];
static char *static_buffer,*backup_buffer,*buffer,*scr_buffer;
static size_t buffer_size;
static int isLcdDirty;
static void (*_lcd_fluch_cb)(char*);
static void *gam_malloc(size_t n){return malloc(n);}
static void gam_free(void*p){free(p);}
`;
const pixelFunctions=['screen_buffer_realloc','_insideScreen','convert_image','timed_flush_lcd','flushLcd','_dot','SysLcdPartClear','DecodePic','SysPictureEx','SysPicture','SysSelectScreen','SysCopyScreen','SysSaveScreen','SysRestoreScreen','SysAdjustLCDBuffer'].map(n=>actual('platform/common/sys.c',n)).join('\n')+'\n'+
    ['GamPicShow','GamPicShowV','GamPicShowS','GamMPicShow','GamMPicShowV','GamMPicShowS','GamClearScreenV','GamShowFrame'].map(n=>actual('comOut.c',n)).join('\n');
const barePixelFixture=base+String.raw`
static void baye_hd_spe_lcd_dirty(void){}
static void baye_hd_spe_lcd_copy(void){}
static void baye_hd_spe_lcd_flush(void){}
static void baye_hd_surface_write(U8 virtualScreen){(void)virtualScreen;}
#define gam_copyscr SysCopyScreen
`+pixelFunctions+String.raw`
static void drawOracle(U8*out,const U8*data,int width,int height,int mask,int x0,int y0,int flip,U8 paint){
    int stride=(width+7)/8,plane=stride*height;
    for(int y=0;y<height;y++)for(int x=0;x<width;x++){
        int dx=x0+x,dy=y0+y;if(dx<0||dy<0||dx>=160||dy>=96)continue;
        int sx=(flip&1)?width-x-1:x,sy=(flip&2)?height-y-1:y;
        int bit=0x80>>(sx%8),at=sy*stride+sx/8;
        int keep=mask&&(data[at]&bit),ink=data[at+(mask?plane:0)]&bit;
        U8 prior=out[dy*160+dx];out[dy*160+dx]=(keep&&paint)?prior:0;
        if(ink&&paint)out[dy*160+dx]=paint;
    }
}
int main(int argc,char**argv){assert(argc==2);screen_buffer_realloc(MAX_SCR_BUF_LEN);SysSelectScreen(g_VisScr);
    int scenario=atoi(argv[1]);U8 expected[160*96];
    if(scenario==1){U8 data[]={0x30,0x50};memset(g_VisScr,127,sizeof(g_VisScr));
        GamMPicShowV(5,6,4,1,data,g_VisScr);assert(g_VisScr[6*160+5]==0);
        assert(g_VisScr[6*160+6]==255);assert(g_VisScr[6*160+7]==127);assert(g_VisScr[6*160+8]==255);
        /* The fourth pixel keeps+inks: it is opaque ink, not transparent. */
    }else if(scenario==2){U8 data[]={0xa8,0x50,0xd8,0x58,0xb0,0x28};
        for(int flip=0;flip<4;flip++)for(int x=-2;x<=158;x+=160){
            for(int i=0;i<160*96;i++)g_VisScr[i]=expected[i]=(U8)(i%251+1);
            g_FlipDrawing=(U8)flip;drawOracle(expected,data,5,3,1,x,94,flip,255);
            GamMPicShowV((PT)x,94,5,3,data,g_VisScr);assert(!memcmp(expected,g_VisScr,sizeof(expected)));
        }
    }else if(scenario==3){U8 data[]={0xa8,0x50,0xd8};
        for(int flip=0;flip<4;flip++){
            memset(g_VisScr,127,sizeof(g_VisScr));memset(expected,127,sizeof(expected));g_FlipDrawing=(U8)flip;
            drawOracle(expected,data,5,3,0,15,16,flip,255);GamPicShowV(15,16,5,3,data,g_VisScr);
            assert(!memcmp(expected,g_VisScr,sizeof(expected)));
            GamClearScreenV(15,16,19,18,g_VisScr);for(int y=16;y<=18;y++)for(int x=15;x<=19;x++)assert(!g_VisScr[y*160+x]);
            assert(g_VisScr[16*160+14]==127&&g_VisScr[16*160+20]==127);
        }
    }else if(scenario==4){U8 data[]={0xf0,0xf0};memset(g_VisScr,127,sizeof(g_VisScr));g_paintColor=0;
        GamMPicShowV(5,6,4,1,data,g_VisScr);for(int x=5;x<9;x++)assert(g_VisScr[6*160+x]==0);
    }else assert(0);
    puts("actual native attack pixels passed");return 0;
}`;
let pixelBinary;
for(const [id,name] of [[1,'actual native AND/OR uses all four mask/ink outcomes on nonzero prior pixels'],[2,'actual masked-picture X/Y flips stay in each odd-width footprint and clip at native screen edges'],[3,'actual opaque picture flips and expiry clears overwrite white pixels without moving the rectangle'],[4,'actual zero paint color alters AND/OR semantics rather than inheriting default opaque ink']])
    test(name,async()=>{pixelBinary??=compile(barePixelFixture,'pixels');const r=await run(await pixelBinary,[String(id)],{timeout:20000});assert.match(r.stdout,/actual native attack pixels passed/);});

test('actual standard attack resources expose all 37 caller ranges, all masks and native arena footprints',()=>{
    const source=read('FightSub.c');const table=/const U8 FgtSpeFrm\[\]\s*=\s*\{([^}]+)\}/.exec(source);assert.ok(table);assert.deepEqual(table[1].split(',').map(Number),widths);
    assert.match(actual('FightSub.c','FgtAtkAction'),/FgtSpeFrm\[sType\]\s*\*\s*g_GenAtt\[1\]\.armsType/);
    assert.match(actual('FightSub.c','FgtAtkAction'),/speId\s*=\s*SHUISHANG_SPE;\s*sFrm\s*=\s*0;\s*eFrm\s*=\s*4;/);
    assert.equal(attacks.reduce((n,a)=>n+a.picmax,0),113);assert.equal(attacks.flatMap(a=>a.pictures).filter(p=>p.mask===1).length,108);
    for(const r of ranges){const a=attacks.find(a=>a.id===r.id);assert.ok(r.start>=a.start&&r.end<=a.end&&r.end<a.count);
        for(const u of a.units.slice(r.start,r.end+1)){const p=a.pictures[u.picIndex];assert.ok(u.x+p.width<=130&&u.y+p.height<=64,`${r.id}/${u.frame} arena footprint`);}}
    const background=resource(16),digits=resource(15);assert.deepEqual([background.readUInt16LE(0),background.readUInt16LE(2),background.readUInt16LE(4),background[6]],[130,64,1,0]);
    assert.deepEqual([digits.readUInt16LE(0),digits.readUInt16LE(2),digits.readUInt16LE(4),digits[6]],[12,16,10,0]);
});

// This independent oracle consumes the ROM's raw native counters and planes,
// never a production observer visibility/clear array. Every actual copy is
// compared byte-for-byte, including opaque white and previously cleared areas.
function drawPacked(out,data,p,x0,y0,flip=0){const stride=Math.ceil(p.width/8),plane=stride*p.height;
    for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const dx=x0+x,dy=y0+y;if(dx<0||dy<0||dx>=160||dy>=96)continue;
        const sx=flip&1?p.width-x-1:x,sy=flip&2?p.height-y-1:y,at=p.offset+7+sy*stride+(sx>>3),bit=128>>(sx&7);
        const keep=p.mask&&(data[at]&bit),ink=data[at+(p.mask?plane:0)]&bit;if(!keep)out[dy*160+dx]=0;if(ink)out[dy*160+dx]=255;}}
function oracle(range){const a=attacks.find(a=>a.id===range.id),units=a.units.slice(range.start,range.end+1),next=units.map(u=>u.ndelay),remaining=units.map(u=>u.cdelay),pixels=Buffer.alloc(160*96),background=resource(16);
    drawPacked(pixels,background,{width:130,height:64,mask:0,offset:0},15,16);
    let frontier=0,previous=0,dirty=true,introduced=true,iterations=0;const cleared=Buffer.alloc(32),frames=[];
    while(true){assert.ok(++iterations<10000);for(let i=0;i<=frontier;i++){if(remaining[i]===1){const u=units[i],p=a.pictures[u.picIndex];for(let y=16+u.y;y<16+u.y+p.height;y++)pixels.fill(0,y*160+15+u.x,y*160+15+u.x+p.width);cleared[(range.start+i)>>3]|=1<<((range.start+i)&7);dirty=true;}if(remaining[i])remaining[i]--;}
        if(dirty)for(let i=0;i<=previous;i++)if(remaining[i]){const u=units[i];drawPacked(pixels,a.bytes,a.pictures[u.picIndex],15+u.x,16+u.y);}
        if(introduced){for(let i=previous+1;i<=frontier;i++)if(remaining[i]){const u=units[i];drawPacked(pixels,a.bytes,a.pictures[u.picIndex],15+u.x,16+u.y);}previous=frontier;}
        if(dirty||introduced){const visible=Buffer.alloc(32);for(let i=0;i<=frontier;i++)if(remaining[i])visible[(range.start+i)>>3]|=1<<((range.start+i)&7);frames.push({frame:range.start+frontier,visible,cleared:Buffer.from(cleared),pixels:Buffer.from(pixels)});dirty=introduced=false;}
        if(next[frontier]>=1)next[frontier]--;while(next[frontier]<=1&&range.start+frontier<range.end){frontier++;introduced=true;}
        if(range.start+frontier>=range.end&&remaining.slice(0,frontier+1).every(v=>v<=1))break;
    }return frames;
}
function nativeFunctions(file,seeds){const source=read(file),found=new Map();function add(name){if(found.has(name)||['if','for','while','switch','sizeof','EM_ASM','EM_ASM_INT'].includes(name))return;let body;try{body=actual(file,name);}catch{return;}found.set(name,body);
        for(const call of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))if(signature(call[1]).test(source))add(call[1]);}
    seeds.forEach(name=>{assert.ok(new RegExp('\\b'+name+'\\s*\\(').test(source),`production ${file}::${name}`);add(name);});
    return {prototypes:[...found.values()].map(b=>b.slice(0,b.indexOf('{')).trim()+';').join('\n'),functions:[...found.values()].join('\n')};}
function traceSchema(globals){const result=[];for(const m of globals.matchAll(/\b(U8|U16|U32|I16)\s+([^;]+);/g))for(const d of m[2].split(',')){const v=/\b(g_hd(?:Spe|Attack)\w+)\s*(?:\[([^\]]+)\])?/.exec(d);if(!v)continue;let n=1;if(v[2])n=v[2]==='BAYE_HD_SPE_FRAME_BYTES'?32:v[2]==='BAYE_HD_ATTACK_DIGITS'?10:Number(v[2]);if((v[2]==='BAYE_HD_AI_TARGET_PIXELS'||v[2]==='BAYE_HD_STATUS_EFFECT_PIXELS'))n=256;if((v[2]==='BAYE_HD_AI_TARGET_RGBA_BYTES'||v[2]==='BAYE_HD_STATUS_EFFECT_RGBA_BYTES'))n=1024;assert.ok(Number.isInteger(n)&&n>0&&n<=1024);result.push({name:v[1],type:m[1],count:n});}return result;}
let attackBinary,attackSchema;
async function attackExecutable(){if(attackBinary)return attackBinary;
    attackBinary=(async()=>{
        const header=read('hd-bridge.h'),bridge=read('hd-bridge.c'),globals=bridge.slice(bridge.indexOf('U8 g_hdSpePendingKind ='),bridge.indexOf('U8 g_hdSkillActive ='));
        const constants=header.split('\n').filter(l=>/^#define BAYE_HD_(?:SPE|MAKER|ATTACK|COMPOSITION|SKILL|RESULT|AI_TARGET|STATUS_EFFECT)_/.test(l)).join('\n');
        const nativeDefines=(read('baye/consdef.h')+'\n'+read('baye/fight.h')+'\n'+read('baye/graph.h')).split('\n').filter(l=>/^#define\s+(?:MAIN_SPE|MAKER_SPE|STACHG_SPE|SPE_BACKPIC|NUM_PICID|QIBING_SPE|SHUISHANG_SPE|TERRAIN_RIVER|FGT_SPESX|FGT_SPESY|SHOW_DLYBASE|PICHEAD_LEN)\b/.test(l)).join('\n');
        const aiDefinitions=(read('baye/attribute.h')+'\n'+read('baye/fight.h')+'\n'+read('baye/consdef.h')).split('\n').filter(l=>/^#define\s+(?:PERSON_MAX|FGTA_MAX|FGT_PLAMAX|CMD_ATK|CMD_STGM|STATE_SW|TIL_WID|WK_SX|WK_SY)\b/.test(l)).join('\n');
        const types=type('hd-bridge.h','HdResultScope')+'\n'+type('hd-bridge.h','HdPictureSource')+'\n'+type('hd-bridge.h','HdStatusCheckScope')+'\n'+type('hd-bridge.h','HdStatusTransition')+'\n'+type('hd-bridge.h','HdStatusEffectSource')+'\n'+type('hd-bridge.h','HdAiTargetSource')+'\n'+type('hd-bridge.h','HdSpeScope');
        const helpers=nativeFunctions('hd-bridge.c',['hd_next_input_seq','hd_spe_notify','baye_hd_begin_spe','baye_hd_spe_tick','baye_hd_status_shape','baye_hd_ai_target_shape','baye_hd_spe_context','baye_hd_spe_enter','baye_hd_spe_ready','baye_hd_spe_frame','baye_hd_spe_end','baye_hd_spe_lcd_dirty','baye_hd_spe_lcd_copy','baye_hd_spe_lcd_flush','baye_hd_spe_invalidate','baye_hd_maker_begin','baye_hd_maker_hold','baye_hd_maker_end','baye_hd_attack_begin','baye_hd_attack_numbers','baye_hd_attack_hold','baye_hd_attack_end','baye_hd_attack_retire','baye_hd_attack_number_resource','baye_hd_attack_digit_begin','baye_hd_attack_digit_end','baye_hd_background_begin','baye_hd_background_end','baye_hd_spe_draw_begin','baye_hd_spe_draw_end','baye_hd_spe_clear','baye_hd_spe_picture_drawn','baye_hd_surface_write','baye_hd_picture_resource','baye_hd_skill_movie_shape','baye_hd_skill_number_resource','baye_hd_skill_digit_begin','baye_hd_skill_digit_end','baye_hd_result_scope_begin','baye_hd_result_scope_end']);
        const publicFns=nativeFunctions('PublicFun.c',['PlcMovie','PlcRPicShow','PlcRPicShowEx','baye_hd_picture_info']);
        attackSchema=traceSchema(globals);assert.ok(attackSchema.some(f=>f.name==='g_hdAttackDisplayValid'));
        const traceWrites=attackSchema.map(f=>f.count===1?`word((U32)${f.name});`:`for(int k=0;k<${f.count};k++)word((U32)${f.name}[k]);`).join('\n');
        const fixture=base+'\n'+constants+'\n'+nativeDefines+'\n'+types+'\n'+aiDefinitions+'\ntypedef U16 PersonID;typedef U16 ToolID;\n'+type('baye/attribute.h','PersonType')+'\n'+type('baye/fight.h','JLPOS')+'\n'+type('baye/fight.h','FGTJK')+'\n'+type('baye/datman.h','RCHEAD')+'\n'+type('baye/datman.h','RIDX')+'\n'+type('baye/paccount.h','SPERES')+'\n'+type('baye/paccount.h','SPEUNIT')+'\n'+type('baye/graph.h','PictureHeadType')+String.raw`
static void fixtureNotify(void);
#define EM_ASM(...) fixtureNotify()
#define FGTA_MAX 20
static U8 g_hdFightActive=1,g_hdMovieActive=0,g_hdReportActive=0,g_hdHelpActive,g_hdQtyActive,g_FgtOver;
static U8 g_MapSX,g_MapSY,g_MapWid,g_MapHgt;
static JLPOS g_GenPos[FGTA_MAX];static FGTJK g_FgtParam;
static PersonType g_Persons[PERSON_MAX];
static U16 g_hdMovieId=0;
`+globals+'\n'+helpers.prototypes+String.raw`
typedef struct {U8*bytes;U32 length,position;} NativeFile;
static NativeFile romFile,*g_LibFp=&romFile;
static U8 *g_CBnkPtr;
static U32 gam_ftell(NativeFile*f){return f->position;}
static int gam_fseek(NativeFile*f,U32 offset,int origin){U32 next=origin==SEEK_CUR?f->position+offset:offset;if(next>=f->length)return -1;f->position=next;return 0;}
static U16 gam_fread(void*out,U16 size,U16 count,NativeFile*f){U32 n=(U32)size*count;if(n>f->length-f->position)n=f->length-f->position;memcpy(out,f->bytes+f->position,n);f->position+=n;return (U16)(n/size);}
static U8*gam_fload(U8*bank,U32 offset,NativeFile*f){assert(offset<f->length);return bank+offset;}
static void gamTraceP(U16 id){(void)id;}
`+helpers.functions+String.raw`
static int reenterNotify;
static U32 reenteredOwner;
static void fixtureNotify(void){if(reenterNotify){reenterNotify=0;reenteredOwner=baye_hd_attack_begin(4,11,2,0);}}
`+'\n'+['GetResStartAddr','GetResItem','ResGetItemLen','ResLoadToCon'].map(n=>actual('datman.c',n)).join('\n')+'\n'+publicFns.prototypes+String.raw`
static FILE*trace;
static U8 displayedPixels[160*96];
static void SysCopyScreen(U8*screen);
static void word(U32 v){U8 b[4]={(U8)v,(U8)(v>>8),(U8)(v>>16),(U8)(v>>24)};assert(fwrite(b,1,4,trace)==4);}
static void record(U32 kind){word(kind);
`+traceWrites+String.raw`
    assert(fwrite(kind==4?(const void*)displayedPixels:(const void*)scr_buffer,1,160*96,trace)==160*96);
}
static void copied(U8*screen){SysCopyScreen(screen);record(1);}
static void callback(char*rgba){(void)rgba;memcpy(displayedPixels,scr_buffer,sizeof(displayedPixels));record(2);}
#define gam_copyscr copied
`+pixelFunctions+String.raw`
typedef struct {U8 type;U16 param;} GMType;
#define VM_TIMER 1
#define VM_CHAR_FUN 2
#define VM_TOUCH 3
#define VT_TOUCH_UP 1
#define TIMER_DLY 1
#define GamMsgIsTimer0(m) ((m).type==VM_TIMER&&(m).param==0)
static int timer=1,scrolling=1,messages,coalesce,custom,hookReturn=-1,hookCount,finalHookCount,unrelated,resetAt,holdRecorded;
static int changePalette,changeNumber,queuedKey,keyReads,holdMessages,nestedAt,virtualWrite;
static int SysScrollingTimerOpen(int v){int old=scrolling;scrolling=v;return old;}
static U8 SysGetTimer1Number(void){return (U8)timer;}
static void SysTimer1Close(void){timer=0;}
static void SysTimer1Open(U16 v){timer=v;}
static void GamGetMsg(GMType*m){assert(++messages<10000);
    if(g_hdAttackPhase==BAYE_HD_ATTACK_HOLD)holdMessages++;
    if(resetAt&&messages==resetAt)baye_hd_spe_invalidate();
    if(nestedAt&&g_hdSpeActive){nestedAt=0;PlcMovie(MAIN_SPE,0,0,8,0,0,0);}
    if(unrelated&&g_hdAttackPhase==BAYE_HD_ATTACK_NUMBERS){unrelated=0;SysSelectScreen(NULL);U8 p=128;GamPicShow(0,0,1,1,&p);}
    if(virtualWrite&&g_hdAttackPhase==BAYE_HD_ATTACK_NUMBERS){virtualWrite=0;U8 p=128;GamPicShowV(0,0,1,1,&p,g_VisScr);}
    if(changeNumber&&g_hdAttackDigitCount==1&&g_hdAttackDigitDrawCount[0]==8){
        U32 at=GetResStartAddr(NUM_PICID);U8*payload=g_CBnkPtr+at+sizeof(RCHEAD);
        if(changeNumber==1)payload[sizeof(PictureHeadType)]^=1;
        else ((RCHEAD*)(g_CBnkPtr+at))->ItmLen++;
        changeNumber=0;
    }
    /* Change only at the display boundary, after a supported copy was baked. */
    if(changePalette&&isLcdDirty){g_paintPalette[changePalette==1?0:255]^=1;changePalette=0;}
    if(isLcdDirty&&(!coalesce||messages%11==0))timed_flush_lcd();
    if(g_hdAttackPhase==BAYE_HD_ATTACK_HOLD&&!holdRecorded){holdRecorded=1;record(4);}
    if(queuedKey){m->type=VM_CHAR_FUN;m->param=(U16)queuedKey;queuedKey=0;keyReads++;}
    else {m->type=VM_TIMER;m->param=1;}
}
`+actual('comIn.c','GamDelay')+'\n'+publicFns.functions+String.raw`
typedef struct {U8 generalIndex,armsType,ter;U8*level;U16*arms;} AttackAttrs;
static AttackAttrs g_GenAtt[2];
static U8 g_LookMovie=1,levels[2]={5,5};static U16 troops[2]={20000,20000},hurt=123;
static U16 CountAtkHurt(void){return hurt;}
static U8 FgtGetExp(U16 value){assert(value<=hurt);return 0;}
static void FgtShowSNum2(U8 sym,U8 index,U16 value){assert(sym=='-'&&index==10&&value<=hurt);}
static I32 call_hook_a_observed(const char*name,void*context,U8*present){(void)context;assert(!strcmp(name,"willShowPKAnimation"));hookCount++;if(present)*present=(U8)custom;return hookReturn;}
static I32 call_hook_a(const char*name,void*context){(void)context;if(!strcmp(name,"willShowPKAnimation")){hookCount++;return hookReturn;}assert(!strcmp(name,"didShowPKAnimation"));finalHookCount++;return 0;}
`+actual('FgtCount.c','CountPlusSub')+'\n'+read('FightSub.c').split('\n').find(l=>l.startsWith('const U8 FgtSpeFrm[]'))+'\n'+actual('FightSub.c','FgtAtvShowNum')+'\n'+actual('FightSub.c','FgtAtkAction')+String.raw`
int main(int argc,char**argv){assert(argc==7);int arm=atoi(argv[1]),target=atoi(argv[2]),mode=atoi(argv[3]);
    FILE*libFile=fopen(argv[5],"rb");assert(libFile);fseek(libFile,0,SEEK_END);romFile.length=(U32)ftell(libFile);rewind(libFile);g_CBnkPtr=malloc(romFile.length);assert(g_CBnkPtr);assert(fread(g_CBnkPtr,1,romFile.length,libFile)==romFile.length);fclose(libFile);romFile.bytes=g_CBnkPtr;romFile.position=romFile.length;
    assert(sizeof(RCHEAD)==14&&sizeof(RIDX)==8&&sizeof(SPERES)==6&&sizeof(SPEUNIT)==5&&sizeof(PictureHeadType)==7);
    trace=fopen(argv[4],"wb");assert(trace);screen_buffer_realloc(MAX_SCR_BUF_LEN);memset(scr_buffer,0,MAX_SCR_BUF_LEN);memset(g_VisScr,0,sizeof(g_VisScr));
    for(int i=0;i<256;i++)g_paintPalette[i]=((U32)i<<24)|((U32)(255-i)*0x010101u);_lcd_fluch_cb=callback;
    g_GenAtt[0]=(AttackAttrs){3,(U8)(arm==6?0:arm),0,&levels[0],&troops[0]};g_GenAtt[1]=(AttackAttrs){10,(U8)target,(U8)(arm==6?TERRAIN_RIVER:0),&levels[1],&troops[1]};
    if(mode==1)coalesce=1;if(mode==2){custom=1;hookReturn=-1;}if(mode==3){custom=1;hookReturn=0;}if(mode==4)g_LookMovie=0;if(mode==5)unrelated=1;if(mode==6)resetAt=4;
    if(mode==7||mode==8)changePalette=mode-6;
    if(mode==9||mode==10)changeNumber=mode-8;
    if(mode==11){U32 at=GetResStartAddr(SPE_BACKPIC);((PictureHeadType*)(g_CBnkPtr+at+sizeof(RCHEAD)))->count=0;}
    if(mode==12){U32 at=GetResStartAddr(SPE_BACKPIC);((PictureHeadType*)(g_CBnkPtr+at+sizeof(RCHEAD)))->count=2;}
    if(mode==13)queuedKey=39;
    if(mode==14){
        U32 old=baye_hd_attack_begin(3,10,1,0),fresh=baye_hd_attack_begin(4,11,2,0);
        assert(fresh!=old);baye_hd_attack_numbers(old);baye_hd_attack_hold(old);baye_hd_attack_end(old);
        assert(g_hdAttackActive&&g_hdAttackSession==fresh&&g_hdAttackPhase==BAYE_HD_ATTACK_MOVIE);
        baye_hd_spe_invalidate();baye_hd_attack_end(fresh);assert(!g_hdAttackActive);
    }
    if(mode==15||mode==16){
        U32 owner=baye_hd_attack_begin(3,10,1,0);SysSelectScreen(g_VisScr);
        PlcRPicShow(SPE_BACKPIC,(U16)(mode==15?0:2),15,16,0);
        assert(!g_hdAttackSourceValid&&!hdBackgroundPending.valid);GamDelay(7,0);
        assert(messages==7&&g_hdAttackActive);baye_hd_attack_end(owner);
    }
    if(mode==17){
        reenterNotify=1;U32 old=baye_hd_attack_begin(3,10,1,0);
        assert(old!=reenteredOwner&&g_hdAttackSession==reenteredOwner&&g_hdAttackActive);
        baye_hd_attack_end(old);assert(g_hdAttackActive&&g_hdAttackSession==reenteredOwner);
        baye_hd_spe_invalidate();
    }
    if(mode==18)nestedAt=1;if(mode==19)virtualWrite=1;
    hurt=(U16)atoi(argv[6]);troops[1]=65535;FgtAtkAction(10);if(isLcdDirty)timed_flush_lcd();record(3);
    assert(hookCount==1&&finalHookCount==1);assert(!g_hdAttackActive&&!g_hdSpeActive&&!g_hdAttackDisplayValid);
    if(mode==13)assert(keyReads==1&&!queuedKey&&holdMessages==SHOW_DLYBASE*5&&g_hdSpeEndReason==BAYE_HD_SPE_END_COMPLETE);
    fclose(trace);free(g_CBnkPtr);puts("actual native attack engine passed");return 0;
}`;
        return compile(fixture,'attack');
    })();return attackBinary;
}
function decodeTrace(bytes){const fields=attackSchema.reduce((n,f)=>n+f.count,0),rowSize=4+fields*4+160*96;assert.equal(bytes.length%rowSize,0);const rows=[];
    for(let at=0;at<bytes.length;at+=rowSize){let p=at;const kind=bytes.readUInt32LE(p);p+=4;const values={};for(const f of attackSchema){const v=[];for(let i=0;i<f.count;i++,p+=4)v.push(f.type==='I16'?bytes.readInt32LE(p):bytes.readUInt32LE(p));values[f.name]=f.count===1?v[0]:v;}rows.push({kind,values,pixels:bytes.subarray(p,p+160*96)});}return rows;
}
async function runAttack(range,mode=0,hurt=123){const binary=await attackExecutable(),dir=dirname(binary),trace=join(dir,`${range.id}-${range.target}-${mode}-${hurt}.bin`);const result=await run(binary,[String(range.arm),String(range.target),String(mode),trace,join(root,'libs/dat-mod.lib'),String(hurt)],{timeout:20000});assert.match(result.stdout,/actual native attack engine passed/);return decodeTrace(readFileSync(trace));}
for(const range of ranges)test(`actual ordinary attack ${range.id} native range ${range.start}..${range.end} composes observed background, clears and all pixel planes`,async()=>{
    const rows=await runAttack(range),copies=rows.filter(r=>r.kind===1),expected=oracle(range);assert.equal(copies.length,expected.length,'all native logical commits, including unchanged frontier clears');
    for(let i=0;i<copies.length;i++){const v=copies[i].values,e=expected[i];assert.equal(v.g_hdSpeId,range.id);assert.equal(v.g_hdSpeStartFrm,range.start);assert.equal(v.g_hdSpeEndFrm,range.end);assert.equal(v.g_hdSpeFrameIndex,e.frame);assert.equal(v.g_hdSpeCommitSeq,i+1);assert.equal(v.g_hdSpeProtocolValid,1);assert.equal(v.g_hdSpeCompositionValid,1);assert.equal(v.g_hdSpeSkipEligible,0);assert.equal(v.g_hdSpeKeyflag,0);
        assert.equal(v.g_hdSpeBgValid,1);assert.equal(v.g_hdSpeBgId,16);assert.equal(v.g_hdSpeBgResourceIndex,0);assert.equal(v.g_hdSpeBgPictureIndex,0);assert.equal(v.g_hdSpeBgWidth,130);assert.equal(v.g_hdSpeBgHeight,64);assert.equal(v.g_hdSpeBgOriginX,15);assert.equal(v.g_hdSpeBgOriginY,16);assert.equal(v.g_hdSpeBgResourceFingerprint,0x3bf544d6);assert.equal(v.g_hdSpeBgResourceLength,1095);
        assert.deepEqual(Buffer.from(v.g_hdSpeVisibleFrames),e.visible);assert.deepEqual(Buffer.from(v.g_hdSpeClearFrames),e.cleared);assert.deepEqual(copies[i].pixels,e.pixels,`native ${range.id} commit${i+1} packed-pixel oracle`);}
    const displays=rows.filter(r=>r.kind===2&&r.values.g_hdSpeDisplayFrameValid===1);assert.ok(displays.length);
    for(const r of displays){const e=expected[r.values.g_hdSpeDisplayCommitSeq-1];assert.ok(e);assert.equal(r.values.g_hdSpeDisplayCompositionValid,1);assert.deepEqual(Buffer.from(r.values.g_hdSpeDisplayClearFrames),e.cleared);assert.deepEqual(Buffer.from(r.values.g_hdSpeDisplayVisibleFrames),e.visible);assert.deepEqual(r.pixels,e.pixels);}
});

function verifyNumbers(rows,range,hurt){const expectedScene=oracle(range).at(-1),number=resource(15),decimal=String(hurt),shown=rows.filter(r=>(r.kind===2||r.kind===4)&&r.values.g_hdAttackDisplayValid===1&&r.values.g_hdAttackPhase>=2);
    assert.ok(shown.length,'actual digit/hold timer callbacks');let final=false;
    for(const row of shown){const v=row.values,pixels=Buffer.from(expectedScene.pixels);assert.equal(v.g_hdAttackActive,1);assert.equal(v.g_hdSpeActive,0,'number phase must not keep child SPE active');assert.equal(v.g_hdAttackSourceValid,1);assert.equal(v.g_hdAttackHurt,hurt);assert.equal(v.g_hdAttackActorIndex,3);assert.equal(v.g_hdAttackTargetIndex,10);
        assert.equal(v.g_hdAttackNumberValid,1);assert.equal(v.g_hdAttackNumberId,15);assert.equal(v.g_hdAttackNumberWidth,12);assert.equal(v.g_hdAttackNumberHeight,16);assert.equal(v.g_hdAttackNumberCount,10);assert.equal(v.g_hdAttackNumberMask,0);assert.equal(v.g_hdAttackNumberResourceFingerprint,0xb37d7407);assert.equal(v.g_hdAttackNumberResourceLength,327);
        assert.ok(v.g_hdAttackDisplayDigitCount<=decimal.length);assert.equal(v.g_hdAttackDisplaySession,v.g_hdAttackSession);assert.equal(v.g_hdAttackDisplayEventId,v.g_hdAttackEventId);assert.deepEqual(Buffer.from(v.g_hdAttackDisplayClearFrames),expectedScene.cleared);assert.deepEqual(Buffer.from(v.g_hdAttackDisplayVisibleFrames),expectedScene.visible);
        for(let i=0;i<v.g_hdAttackDisplayDigitCount;i++){const digit=Number(decimal[i]),count=v.g_hdAttackDisplayDigitDrawCount[i];assert.equal(v.g_hdAttackDisplayDigitIndex[i],digit);assert.equal(v.g_hdAttackDisplayDigitX[i],55+i*6,'original half-width spacing, including overlapping opaque boxes');assert.equal(v.g_hdAttackDisplayDigitFirstY[i],56);assert.ok(count>0&&count<=8);assert.equal(v.g_hdAttackDisplayDigitY[i],56-count+1);
            for(let draw=0;draw<count;draw++)drawPacked(pixels,number,{width:12,height:16,mask:0,offset:digit*32},55+i*6,56-draw);}
        assert.deepEqual(row.pixels,pixels,'complete actual scene plus all decimal draw footprints');
        if(v.g_hdAttackPhase===3&&v.g_hdAttackDisplayDigitCount===decimal.length&&v.g_hdAttackDisplayDigitDrawCount.slice(0,decimal.length).every(n=>n===8))final=true;
    }assert.ok(final,'actual original hold owns final native numeric display');
}
for(const hurt of [0,1,123,65535])test(`actual postlude ${hurt} uses the passed damage and all original NUM15 upward/overlapping poses`,async()=>verifyNumbers(await runAttack(ranges[0],0,hurt),ranges[0],hurt));
test('actual coalesced copy and digit timer flushes preserve saved scene and earlier opaque numeric footprints',async()=>{
    const rows=await runAttack(ranges[0],1,123),copies=rows.filter(r=>r.kind===1),movie=rows.filter(r=>r.kind===2&&r.values.g_hdSpeDisplayFrameValid===1);assert.ok(movie.length<copies.length,'native timer coalesces logical movie copies');
    const expected=oracle(ranges[0]);for(const row of movie){const e=expected[row.values.g_hdSpeDisplayCommitSeq-1];assert.ok(e);assert.deepEqual(row.pixels,e.pixels);assert.deepEqual(Buffer.from(row.values.g_hdSpeDisplayClearFrames),e.cleared);}
    verifyNumbers(rows,ranges[0],123);assert.ok(rows.some(r=>r.kind===2&&r.values.g_hdAttackDisplayValid===1&&r.values.g_hdAttackDisplayDigitDrawCount.some(n=>n>1)),'one flush contains multiple actual numeric draws');
});
for(const [mode,label] of [[2,'custom hook returning -1'],[3,'custom hook handling animation'],[4,'native movie switch disabled'],[5,'uncontrolled real LCD write'],[6,'native reset during movie']])test(`${label} cannot authorize new attack composition or a saved numeric surface`,async()=>{
    const rows=await runAttack(ranges[0],mode,123);assert.ok(rows.length);for(const row of rows){if(mode===5&&row.values.g_hdAttackPhase===1)continue;if(mode===6&&row.values.g_hdSpeGeneration===1)continue;
        assert.equal(row.values.g_hdAttackDisplayValid,0,'fallback or retired display');assert.equal(row.values.g_hdAttackSourceValid,0,'no old numeric source resurrection');assert.equal(row.values.g_hdSpeCompositionValid,0);}
    if(mode===3||mode===4)assert.equal(rows.filter(r=>r.kind===1).length,0,'original handled/no-movie branch never manufactures a child event');
});

for(const [mode,label] of [[7,'transparent palette endpoint'],[8,'ink palette endpoint']])test(`changing the ${label} only before the actual LCD flush permanently retires supported copied composition`,async()=>{
    const rows=await runAttack(ranges[0],mode),first=rows.find(r=>r.kind===1);assert.equal(first.values.g_hdSpeCompositionValid,1);
    const displayed=rows.filter(r=>r.kind===2);assert.ok(displayed.length);
    for(const row of displayed){assert.equal(row.values.g_hdAttackSourceValid,0);assert.equal(row.values.g_hdAttackDisplayValid,0);assert.equal(row.values.g_hdSpeDisplayCompositionValid,0);}
});
for(const [mode,label] of [[9,'payload ink byte'],[10,'declared resource length']])test(`actual NUM15 ${label} changing after the first digit retires numeric authentication before the second digit`,async()=>{
    const rows=await runAttack(ranges[0],mode);assert.ok(rows.some(r=>r.values.g_hdAttackDisplayValid&&r.values.g_hdAttackDisplayDigitDrawCount[0]===8));
    const retired=rows.findIndex(r=>r.values.g_hdAttackPhase>=2&&!r.values.g_hdAttackSourceValid);assert.ok(retired>=0);
    for(const row of rows.slice(retired)){assert.equal(row.values.g_hdAttackSourceValid,0);assert.equal(row.values.g_hdAttackDisplayValid,0);}
    assert.ok(rows.some(r=>r.kind===4&&r.values.g_hdAttackPhase===3),'original hold still runs');
});
for(const [mode,label] of [[11,'zero count'],[12,'truncated claimed count']])test(`actual background ${label} cannot authenticate attack pixels while its original postlude wait still runs`,async()=>{
    const rows=await runAttack(ranges[0],mode);assert.ok(rows.some(r=>r.kind===1));assert.ok(rows.some(r=>r.kind===4&&r.values.g_hdAttackPhase===3));
    for(const row of rows){assert.equal(row.values.g_hdSpeCompositionValid,0);assert.equal(row.values.g_hdAttackSourceValid,0);assert.equal(row.values.g_hdAttackDisplayValid,0);}
});
test('an actual queued Enter is consumed without skipping ordinary attack frames or the original hold',async()=>{
    const rows=await runAttack(ranges[0],13),copies=rows.filter(r=>r.kind===1),expected=oracle(ranges[0]);assert.equal(copies.length,expected.length);
    for(let i=0;i<copies.length;i++)assert.deepEqual(copies[i].pixels,expected[i].pixels);verifyNumbers(rows,ranges[0],123);
});
test('a stale attack session cannot move or close a newer owner and reset cannot revive either surface',async()=>{
    const rows=await runAttack(ranges[0],14);verifyNumbers(rows,ranges[0],123);
});
for(const [mode,label] of [[15,'zero'],[16,'beyond actual count']])test(`actual background picture index ${label} returns without authorization and preserves its following native delay`,async()=>{
    const rows=await runAttack(ranges[0],mode);verifyNumbers(rows,ranges[0],123);
});
test('a frontend notification reentering actual attack begin cannot return its newer session to the older native caller',async()=>{
    const rows=await runAttack(ranges[0],17);verifyNumbers(rows,ranges[0],123);
});
test('an actual nested unrelated MAIN playback retires the ordinary attack composition instead of restoring its former surface',async()=>{
    const rows=await runAttack(ranges[0],18),nested=rows.findIndex(r=>r.kind===1&&r.values.g_hdSpeId===3);assert.ok(nested>=0);
    assert.ok(rows.slice(nested).some(r=>r.values.g_hdSpeId===19),'original parent still unwinds and continues');
    for(const row of rows.slice(nested)){assert.equal(row.values.g_hdAttackSourceValid,0);assert.equal(row.values.g_hdAttackDisplayValid,0);assert.equal(row.values.g_hdSpeCompositionValid,0);}
});
test('an uncontrolled virtual surface write during the numeric phase also permanently retires attack composition',async()=>{
    const rows=await runAttack(ranges[0],19),retired=rows.findIndex(r=>r.values.g_hdAttackPhase>=2&&!r.values.g_hdAttackSourceValid);assert.ok(retired>=0);
    for(const row of rows.slice(retired)){assert.equal(row.values.g_hdAttackSourceValid,0);assert.equal(row.values.g_hdAttackDisplayValid,0);}
});
