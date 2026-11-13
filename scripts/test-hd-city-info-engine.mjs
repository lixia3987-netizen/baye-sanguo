#!/usr/bin/env node
// Compile the real ShowCityPro input/draw loop and city-info observers. Only
// resources, LCD, script dispatch and message delivery are boundary stubs.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import vm from 'node:vm';
import test,{after} from 'node:test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),native=join(root,'vendor/iBaye/src');
const read=file=>readFileSync(join(native,file),'utf8').replace(/\r\n/g,'\n');
function actual(file,name){const source=read(file),m=new RegExp('^(?:static\\s+)?(?:FAR\\s+)?[A-Za-z0-9_ *]+\\b'+name+'\\([^;]*?\\)\\s*\\{','m').exec(source);assert.ok(m,name);const end=source.indexOf('\n}',m.index);assert.ok(end>m.index);return source.slice(m.index,end+2);}
const header=read('hd-bridge.h'),bridge=read('hd-bridge.c');
const constants=header.split('\n').filter(l=>/^#define BAYE_HD_CITY_INFO_/.test(l)).join('\n')+'\n'+
    ['baye/consdef.h','baye/sconst.h','baye/fight.h','baye/attribute.h'].map(read).join('\n').split('\n').filter(l=>/^#define\s+(CITY_NAME|STRING_CONST|ATRR_STR\d+|CITY_STATE_STR\d+|STATE_NORMAL|STATE_FAMINE|STATE_DROUGHT|STATE_FLOOD|STATE_REBELLION)\b/.test(l)).join('\n');
const type=header.match(/typedef\s+struct[^;{]*\{[^}]*\}\s*HdCityInfoSnapshot;/)[0];
const globals=bridge.slice(bridge.indexOf('U8 g_hdCityInfoProtocolVersion ='),bridge.indexOf('U8 g_hdMiniMapProtocolVersion ='));
const names=['hd_next_input_seq','hd_city_info_notify','baye_hd_city_info_retire','hd_city_info_owner','baye_hd_city_info_begin','baye_hd_city_info_page','hd_city_info_text','baye_hd_city_info_title','baye_hd_city_info_row','baye_hd_city_info_publish','baye_hd_city_info_wait','baye_hd_city_info_ack','baye_hd_city_info_end'];
const funcs=names.map(n=>actual('hd-bridge.c',n)).concat(['GetCityName','GetCityProStrCaptured','GetCityProStr','GetCityState','ShowCityPro','ShowCityProInner'].map(n=>actual('showface.c',n)));
const fixture=String.raw`
#define _CRT_SECURE_NO_WARNINGS
#include <assert.h>
#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
typedef uint8_t U8;typedef uint16_t U16;typedef uint32_t U32;typedef int16_t I16;
#define FAR
#define EM_ASM(...) ((void)0)
#define PID(x) (x)
#define CITY_MAX 64
#define WK_SX 0
#define WK_SY 0
#define WK_EX 159
#define WK_EY screenHeight
#define ASC_HGT 8
#define ASC_WID 8
#define VM_CHAR_FUN 1
#define VM_TOUCH 2
#define VM_TIMER 3
#define VK_UP 1
#define VK_DOWN 2
#define VK_LEFT 3
#define VK_RIGHT 4
#define VK_ENTER 5
#define VK_EXIT 6
#define VT_TOUCH_UP 3
`+constants+'\n'+type+'\n'+globals+String.raw`
static U32 g_hdDetailGeneration=1;
static int scenario,screenHeight=68,scrolling=7,drawCalls,nameCalls,personCalls,hookWill,hookRows,allocated,freed;
static int hookMode,reentry,depth,retiredInHook,hookDispatches;
static struct {U8 cityPropertiesCount;} cfg={11};
typedef struct {U16 Belong,SatrapId,Farming,FarmingLimit,Commerce,CommerceLimit,PeopleDevotion,AvoidCalamity,Money,Food,MothballArms;U32 Population;U8 State;} City;
static City g_Cities[256],worldBefore[256];
typedef struct {U8 type;U16 param;I16 x,y;} GMType;
typedef struct {U8 completed,moved;I16 startY,currentY;} Touch;
typedef struct ObjectDef {int dummy;} ObjectDef;
typedef struct {struct {ObjectDef*objDef;} subdef;} ValueDef;
typedef struct {ValueDef*def;U8*city,*property,*display;} Value;
static ObjectDef objectDef;
static ValueDef valueDef={{&objectDef}};
static Value* binding;
static Value* Value_ObjectValue_new(void){Value*v=calloc(1,sizeof(*v));v->def=&valueDef;binding=v;allocated++;return v;}
static void Value_ObjectValue_free(Value*v){freed++;free(v);}
static void bindU8(const char*name,U8*ptr){if(strstr(name,"property"))binding->property=ptr;else binding->city=ptr;}
#define BIND_U8EX(name,ptr) bindU8(name,ptr)
#define BIND_U8(ptr) bindU8(#ptr,ptr)
#define BIND_GBKARR(ptr,len) (binding->display=ptr)
static int has_hook(const char*name);
#define IF_HAS_HOOK(name) if(has_hook(name)) for(const char*_hook_name=name;_hook_name;_hook_name=0) for(Value*__v=Value_ObjectValue_new();__v;Value_ObjectValue_free(__v),__v=0) for(ObjectDef*def=__v->def->subdef.objDef;def;def=0)
#define HOOK_RETURN(...) {Value_ObjectValue_free(__v);return __VA_ARGS__;}
static int call_hook_a_observed(const char*,Value*,U8*);
static U16 ResGetItemLen(U16 id,U16 item){assert(id==CITY_NAME);return item<=64?8:0;}
static void ResLoadToMemN(U16 id,U16 item,U8*out,U16 n){assert(id==CITY_NAME&&n==32);nameCalls++;sprintf((char*)out,"CITY-%u",item-1);}
static void ResLoadToMem(U16 id,U16 item,U8*out){assert(id==STRING_CONST);sprintf((char*)out,"L%03u:",item);}
static void GetPersonName(U16 person,U8*out){personCalls++;sprintf((char*)out,"PERSON-%u",person);}
static void gam_itoa(U32 n,U8*out,int base){assert(base==10);sprintf((char*)out,"%u",n);}
#define gam_ltoa gam_itoa
#define gam_strlen(s) strlen((char*)(s))
#define gam_strcat(a,b) strcat((char*)(a),(char*)(b))
static void gam_clrlcd(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static void gam_rect(int a,int b,int c,int d){(void)a;(void)b;(void)c;(void)d;}
static U8 lcd[2048][128];
static void GamStrShowS(int x,int y,U8*text){(void)x;(void)y;memcpy(lcd[drawCalls++],text,128);}
static int SysScrollingTimerOpen(int value){int prev=scrolling;scrolling=value;return prev;}
static GMType messages[64];static int messageCount,messageIndex;
static void beforeMessage(int index);
static void GamGetMsg(GMType*msg){beforeMessage(messageIndex);assert(messageIndex<messageCount);*msg=messages[messageIndex++];}
static void touchUpdate(Touch*t,GMType m){if(m.param==1){t->startY=m.y;t->currentY=m.y;t->completed=t->moved=0;}else{t->currentY=m.y;t->moved=t->currentY!=t->startY;t->completed=m.param==VT_TOUCH_UP&&m.x!=99;}}
`+funcs.map(s=>s.slice(0,s.indexOf('{'))+';').join('\n')+'\n'+funcs.join('\n')+String.raw`
static U32 seenSeq[64],seenInput[64];static U8 seenStart[64],seenRows[64],seenComplete[64],seenCustom[64];
static void beforeMessage(int index){
    if(!g_hdCityInfoActive){assert(retiredInHook||reentry);return;}
    assert(g_hdCityInfoWait&&g_hdCityInfoSession&&g_hdCityInfoInputSeq);
    seenSeq[index]=g_hdCityInfoSeq;seenInput[index]=g_hdCityInfoInputSeq;
    seenStart[index]=g_hdCityInfoPageStart;seenRows[index]=g_hdCityInfoRowCount;
    seenComplete[index]=g_hdCityInfoComplete;seenCustom[index]=g_hdCityInfoCustom;
    assert(g_hdCityInfoCity==2||hookMode==4&&g_hdCityInfoCity==3);
    if(g_hdCityInfoComplete){U16 i;assert(!strcmp((char*)g_hdCityInfoTitleGbk,"CITY-2"));
        for(i=0;i<g_hdCityInfoRowCount;i++){assert(g_hdCityInfoRowIndices[i]==g_hdCityInfoPageStart+i);
            assert(!strcmp((char*)g_hdCityInfoRowText+i*128,(char*)lcd[drawCalls-6+i]));}}
}
static int has_hook(const char*name){
    if(!strcmp(name,"willShowCityInfo")){hookWill++;return hookMode==1||hookMode==4||hookMode==5||reentry;}
    assert(!strcmp(name,"getCityPropertyDisplay"));hookRows++;return hookMode==2||hookMode==3||hookMode==6||hookMode==7||retiredInHook;
}
static int call_hook_a_observed(const char*name,Value*v,U8*present){
    hookDispatches++;
    *present=0;
    if(!strcmp(name,"willShowCityInfo")){
        if(hookMode==1||hookMode==4||hookMode==5){*present=1;if(hookMode==4)*v->city=3;return hookMode==5?0:-1;}
        if(reentry&&!depth){*present=1;depth=1;ShowCityProInner(2);depth=0;}
        return -1;
    }
    assert(!strcmp(name,"getCityPropertyDisplay"));
    if(hookMode==2||hookMode==3||hookMode==6){*present=1;
        if(hookMode==2)return -1;
        if(hookMode==6)memset(v->display,'X',128);else strcpy((char*)v->display,"MOD-PROPERTY");return 0;}
    if(retiredInHook&&hookRows==1){*present=1;baye_hd_city_info_retire();g_hdDetailGeneration++;}
    return -1;
}
static void add(U8 type,U16 param,I16 y){messages[messageCount++]=(GMType){type,param,0,y};}
static void key(U16 value){add(VM_CHAR_FUN,value,0);}
static void setup(void){int i;for(i=0;i<256;i++){g_Cities[i].Belong=2;g_Cities[i].SatrapId=3;g_Cities[i].Population=70000;g_Cities[i].Money=33;g_Cities[i].Food=44;}memcpy(worldBefore,g_Cities,sizeof(g_Cities));}
static void finish(void){assert(!memcmp(worldBefore,g_Cities,sizeof(g_Cities)));assert(allocated==freed);assert(!g_hdCityInfoActive&&!g_hdCityInfoWait);assert(scrolling==7);}
int main(int argc,char**argv){assert(argc==2);scenario=atoi(argv[1]);setup();
    if(scenario==1){key(VK_DOWN);key(VK_DOWN);key(VK_UP);key(VK_ENTER);assert(ShowCityPro(2)==1);
        assert(seenStart[0]==0&&seenRows[0]==6&&seenStart[1]==6&&seenRows[1]==5);
        assert(seenSeq[0]==1&&seenSeq[1]==2&&seenSeq[2]==2&&seenSeq[3]==3);
        assert(seenInput[0]==1&&seenInput[1]==2&&seenInput[2]==3&&seenInput[3]==4);
        assert(drawCalls==21&&hookRows==18&&nameCalls==3&&hookWill==1&&!hookDispatches);assert(lcd[13][0]==0);}
    if(scenario==2){key(VK_UP);add(VM_TIMER,0,0);key(VK_LEFT);key(VK_EXIT);assert(ShowCityPro(2)==0);
        assert(seenInput[0]==1&&seenInput[1]==2&&seenInput[2]==2&&seenInput[3]==3);
        for(int i=0;i<4;i++)assert(seenSeq[i]==1);assert(hookRows==6&&drawCalls==7);}
    if(scenario==3){add(VM_TOUCH,1,70);add(VM_TOUCH,VT_TOUCH_UP,10);add(VM_TOUCH,1,10);add(VM_TOUCH,VT_TOUCH_UP,10);assert(ShowCityPro(2)==0);
        assert(seenStart[0]==0&&seenStart[1]==0&&seenStart[2]==6&&seenStart[3]==6);
        assert(seenInput[0]==1&&seenInput[1]==1&&seenInput[2]==2&&seenInput[3]==2);assert(hookRows==12);}
    if(scenario==4){add(VM_TOUCH,1,10);add(VM_TOUCH,VT_TOUCH_UP,30);messages[1].x=99;add(VM_TIMER,0,0);key(VK_EXIT);assert(ShowCityPro(2)==0);
        for(int i=0;i<4;i++)assert(seenInput[i]==1&&seenSeq[i]==1);}
    if(scenario==5){hookMode=1;key(VK_EXIT);ShowCityPro(2);assert(seenCustom[0]&&!seenComplete[0]&&hookWill==1&&hookRows==6);}
    if(scenario==6){hookMode=2;key(VK_EXIT);ShowCityPro(2);assert(seenCustom[0]&&!seenComplete[0]&&hookRows==6&&personCalls==2);}
    if(scenario==7){hookMode=3;key(VK_DOWN);key(VK_EXIT);ShowCityPro(2);assert(seenCustom[0]&&seenCustom[1]&&!seenComplete[0]&&!seenComplete[1]);assert(hookRows==12&&personCalls==0);}
    if(scenario==8){retiredInHook=1;key(VK_DOWN);key(VK_EXIT);ShowCityPro(2);assert(g_hdCityInfoSeq==0&&hookRows==12);}
    if(scenario==9){reentry=1;key(VK_EXIT);key(VK_DOWN);key(VK_EXIT);ShowCityPro(2);assert(hookWill==2&&g_hdCityInfoSeq==1&&hookRows==18);}
    if(scenario==10){HdCityInfoSnapshot a,b;baye_hd_city_info_begin(&a,2);baye_hd_city_info_page(&a,2,1,0,1);baye_hd_city_info_title(&a,(U8*)"TITLE",6);
        U8 text[128];memset(text,'x',sizeof(text));baye_hd_city_info_row(&a,0,text,sizeof(text));baye_hd_city_info_publish(&a);assert(!g_hdCityInfoComplete);
        baye_hd_city_info_begin(&b,2);baye_hd_city_info_publish(&a);baye_hd_city_info_ack(&a);baye_hd_city_info_end(&a);assert(g_hdCityInfoSession==b.session&&g_hdCityInfoInputSeq==1);
        baye_hd_city_info_page(&b,2,33,0,33);baye_hd_city_info_title(&b,(U8*)"TITLE",6);for(int i=0;i<33;i++)baye_hd_city_info_row(&b,i,(U8*)"ROW",4);baye_hd_city_info_publish(&b);assert(!g_hdCityInfoComplete&&g_hdCityInfoRowCount==32);
        baye_hd_city_info_page(&b,2,1,0,1);baye_hd_city_info_title(&b,(U8*)"TITLE",6);U8 badGbk[]={0x81,0};baye_hd_city_info_row(&b,0,badGbk,2);baye_hd_city_info_publish(&b);assert(!g_hdCityInfoComplete);
        baye_hd_city_info_page(&b,2,1,0,1);baye_hd_city_info_title(&b,(U8*)"TITLE",6);baye_hd_city_info_row(&b,0,(U8*)"ROW",4);baye_hd_city_info_row(&b,1,(U8*)"UNKNOWN",8);baye_hd_city_info_publish(&b);assert(!g_hdCityInfoComplete&&g_hdCityInfoRowCount==1);
        g_hdCityInfoInputSeq=UINT32_MAX;baye_hd_city_info_ack(&b);assert(g_hdCityInfoInputSeq==1);
        baye_hd_city_info_page(&b,2,0,0,6);g_hdCityInfoSeq=UINT32_MAX;baye_hd_city_info_publish(&b);assert(!g_hdCityInfoComplete&&g_hdCityInfoSeq==1);baye_hd_city_info_end(&b);}
    if(scenario==11){hookMode=4;key(VK_EXIT);ShowCityPro(2);assert(seenCustom[0]&&!seenComplete[0]);}
    if(scenario==12){hookMode=5;assert(ShowCityPro(2)==0);assert(!drawCalls&&!hookRows&&hookWill==1);}
    if(scenario==13){hookMode=7;key(VK_EXIT);ShowCityPro(2);assert(seenComplete[0]&&!seenCustom[0]&&hookRows==6&&hookDispatches==6);}
    finish();return 0;
}
`;
const dir=mkdtempSync(join(tmpdir(),'baye-city-info-')),source=join(dir,'city.c'),exe=join(dir,process.platform==='win32'?'city.exe':'city');
writeFileSync(source,fixture);after(()=>rmSync(dir,{recursive:true,force:true}));
const run=promisify(execFile),cc=process.env.CC||'clang';
let compiled;function compile(){return compiled??=run(cc,['-std=c11','-O0','-Werror=implicit-function-declaration',source,'-o',exe]);}
const cases=['actual native pages preserve last-page blank calls and exact hook counts','boundary arrows ACK while timer preserves page and input tokens','completed swipe ACKs once and tap retains native return zero','incomplete touch and timer do not ACK','present will-show hook returning minus one forces LCD','present property hook returning minus one forces LCD without duplicate dispatch','custom property strings preserve all native calls including extra rows','retired generation cannot publish or ACK a suspended native renderer','reentrant native city page rejects suspended older owner','bounded strings oversized pages and replaced tickets remain incomplete','hook-mutated actual city remains custom','hook-handled early return preserves original zero and skips drawing','hook removed between original guard and dispatch does not invent custom output'];
cases.forEach((name,index)=>test(name,async()=>{await compile();await run(exe,[String(index+1)]);}));
test('real script dispatcher retains original falsy guard and disappearing-hook lookup behavior',()=>{
    const body=name=>actual('platform/js/script.c',name).match(/return EM_ASM_INT\(\{([\s\S]*?)\}, name(?:, context, present)?\);/)[1];
    const guard=body('has_hook'),dispatch=body('call_hook_s_observed');
    for(const value of [undefined,null,false,0,'']){
        let calls=0,mailbox=17;const baye={hooks:{getCityPropertyDisplay:value},callHook(){calls++;mailbox=0;}};
        const context={window:{baye},baye,UTF8ToString:x=>x,$0:'getCityPropertyDisplay',$1:0,$2:1,HEAPU8:new Uint8Array(4)};
        const present=vm.runInNewContext('(function(){'+guard+'})()',context);
        if(present)vm.runInNewContext('(function(){'+dispatch+'})()',context);
        assert.equal(present,0);assert.equal(calls,0);assert.equal(mailbox,17);
    }
    let lookups=0,calls=0;const hooks={};Object.defineProperty(hooks,'willShowCityInfo',{get(){return ++lookups===1?()=>-1:undefined;}});
    const baye={hooks,callHook(){calls++;return -1;}},HEAPU8=new Uint8Array(4);
    const context={window:{baye},baye,UTF8ToString:x=>x,$0:'willShowCityInfo',$1:0,$2:1,HEAPU8};
    assert.equal(vm.runInNewContext('(function(){'+guard+'})()',context),1);
    assert.equal(vm.runInNewContext('(function(){'+dispatch+'})()',context),-1);
    assert.equal(lookups,2);assert.equal(calls,0);assert.equal(HEAPU8[1],0);
});
test('native observer retains original loop bounds and all competing input retirement paths',()=>{
    const show=actual('showface.c','ShowCityProInner');assert.match(show,/if \(i >= cfg\.cityPropertiesCount\) break;/);
    assert.match(show,/IF_HAS_HOOK\("willShowCityInfo"\)/);
    assert.match(actual('showface.c','GetCityProStrCaptured'),/IF_HAS_HOOK\("getCityPropertyDisplay"\)/);
    for(const fn of ['baye_hd_set_ready','baye_hd_set_report','baye_hd_report_begin','baye_hd_record_begin','baye_hd_fight_input_begin','baye_hd_fight_input_end','baye_hd_map_input_begin','baye_hd_menu_begin','baye_hd_set_help','baye_hd_qty_begin'])assert.match(actual('hd-bridge.c',fn),/baye_hd_city_info_retire\(\)/,fn);
    assert.match(actual('hd-bridge.c','hd_city_info_notify'),/dispatchEvent\(new CustomEvent\('baye-hd-city-info'\)\)/);
    assert.match(actual('citycmdc.c','ReconnoitreMake'),/ShowCityPro\(ocity\);\s*OrderConsumeThew\(p,RECONNOITRE\);\s*OrderConsumeMoney\(city,RECONNOITRE\);/,
        'either native return still lets reconnaissance consume stamina and money');
});
