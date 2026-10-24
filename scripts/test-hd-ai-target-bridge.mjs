#!/usr/bin/env node
// Public bridge boundary tests use synthetic read-only observations. Actual
// before-draw/copy/flush pixels and command timing belong to the native suite.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const native=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.c',import.meta.url),'utf8');
const header=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.h',import.meta.url),'utf8');
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const offset=lib.readUInt32LE(26*4);
assert.equal(lib.readUInt16LE(offset+4),27);
const resource=lib.subarray(offset+14,offset+14+lib.readUInt32LE(offset+8));
function fnv(bytes){let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0;return hash;}
const plain=value=>JSON.parse(JSON.stringify(value));
function bits(...positions){const bytes=Array(32).fill(0);for(const bit of positions)bytes[bit>>3]|=1<<(bit&7);return bytes;}

function fixture(){
    const raw={},writes=[],keys=[],calls=[];let onRead=null;
    const context=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},
        console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});
    context.window=context;
    for(const name of new Set(source.match(/\b_baye\w+/g)))context[name]=()=>0;
    context._bayeHdReady=()=>1;context._bayeSendKey=key=>keys.push(key);
    vm.runInContext(source,context);context.baye_bridge_init();
    function readonly(value,path=''){
        if(!value||typeof value!=='object')return value;
        return new Proxy(value,{get(object,key){if(onRead)onRead(path,key);return readonly(object[key],path+'.'+String(key));},
            set(){writes.push(path);throw Error('native write');}});
    }
    const baye=context.baye;baye.data=readonly(raw);baye.ensureData=()=>baye.data;
    for(const name of ['getPersonName','getCityName','getToolName','getArmType','callHook'])
        baye[name]=(...args)=>{calls.push([name,...args]);throw Error('uncaptured getter/hook');};
    const constants=Object.fromEntries([...header.matchAll(/^#define\s+(\w+)\s+(\d+)\b/gm)].map(m=>[m[1],Number(m[2])]));
    for(const match of native.matchAll(/\b(?:U8|U16|U32|I16)\s+(g_hdSpe(?:Display)?Ai\w+)\s*(?:\[([^\]]+)\])?\s*(?:=[^;]*)?;/g)){
        const length=match[2]?constants[match[2]]??Number(match[2]):0;
        assert.ok(Number.isInteger(length)&&length>=0,'Actual array constant '+match[2]);
        raw[match[1]]=match[2]?Array(length).fill(0):0;
    }
    function hint(){
        Object.assign(raw,{g_hdSpeProtocolVersion:2,g_hdSpeActive:1,g_hdSpeId:27,g_hdSpeKind:4,g_hdSpeSeq:8,
            g_hdSpeGeneration:7,g_hdSpeEventId:31,g_hdSpeParentEventId:0,g_hdSpeDepth:1,
            g_hdSpeResourceIndex:0,g_hdSpeCount:resource[2],g_hdSpePicmax:resource[3],
            g_hdSpeStartFrm:12,g_hdSpeEndFrm:17,g_hdSpeOriginX:64,g_hdSpeOriginY:64,
            g_hdSpeResourceFingerprint:fnv(resource),g_hdSpeResourceLength:resource.length,
            g_hdSpeProtocolValid:1,g_hdSpeFrameValid:1,g_hdSpeCommitSeq:5,g_hdSpeFrameIndex:16,
            g_hdSpeKeyflag:0,g_hdSpeSkipEligible:0,g_hdSpeContextKnown:1,g_hdSpeSkillId:0,
            g_hdSpeActorIndex:12,g_hdSpeTargetIndex:3,g_hdSpeVisibleFrames:bits(16),
            g_hdSpeDisplayGeneration:7,g_hdSpeDisplayEventId:31,g_hdSpeDisplayCommitSeq:3,
            g_hdSpeDisplayFrameIndex:14,g_hdSpeDisplayFrameValid:1,g_hdSpeDisplayVisibleFrames:bits(14),
            g_hdSpeCompositionVersion:0,g_hdSpeAiProtocolVersion:2,
            g_hdFightActive:1,g_FgtOver:0,g_hdReportActive:0,g_hdHelpActive:0,g_hdQtyActive:0});
        for(const prefix of ['g_hdSpeAi','g_hdSpeDisplayAi']){
            const values={Valid:1,CommandType:0,CommandParam:0,ActorIndex:12,TargetIndex:3,ActorPerson:600,TargetPerson:699,
                ActorX:4,ActorY:8,TargetX:7,TargetY:6,MapSX:3,MapSY:2,MapWidth:32,MapHeight:32,
                ScreenWidth:160,ScreenHeight:96,RegionX:64,RegionY:64,RegionWidth:16,RegionHeight:16,
                PaletteZero:0x00ffffff,PaletteInk:0xff000000};
            for(const [name,value] of Object.entries(values))raw[prefix+name]=value;
            raw[prefix+'BasePixels']=Array.from({length:256},(_,i)=>i%3===0?255:0);
            raw[prefix+'BaseRgba']=raw[prefix+'BasePixels'].flatMap(pixel=>pixel===255?[0,0,0,255]:[255,255,255,0]);
            raw[prefix+'ClearFrames']=prefix==='g_hdSpeAi'?bits(12,13,14,15):bits(12,13);
        }
    }
    function untouched(){assert.deepEqual(writes,[]);assert.deepEqual(keys,[]);assert.deepEqual(calls,[]);}
    return{raw,baye,context,hint,untouched,onRead:fn=>{onRead=fn;}};
}
function neutral(value){assert.equal(value.valid,false);assert.deepEqual(plain(value.basePixels),[]);assert.deepEqual(plain(value.baseRgba),[]);assert.deepEqual(plain(value.clearFrames),[]);
    for(const field of ['commandType','actorIndex','targetIndex','actorPerson','targetPerson','regionX','paletteInk'])assert.equal(value[field],undefined,field);}
function rejected(h){const value=h.baye.hd.spe();neutral(value.aiTarget);neutral(value.display.aiTarget);h.untouched();return value;}

test('the actual status item has six zero-offset 16x16 mask1 units in slots 7/8 and a full payload fingerprint',()=>{
    assert.deepEqual([...resource.subarray(0,6)],[0,9,18,9,12,17]);assert.equal(resource.length,735);assert.equal(fnv(resource),0xba494eea);
    assert.match(header,/#define\s+BAYE_HD_AI_TARGET_PIXELS\s+256/);
    for(let i=12;i<=17;i++){const unit=resource.subarray(6+i*5,11+i*5);assert.equal(unit[0],0);assert.equal(unit[1],0);assert.equal(unit[4],i%2?8:7);}
    let at=6+resource[2]*5;
    for(let i=0;i<resource[3];i++){assert.deepEqual([resource.readUInt16LE(at),resource.readUInt16LE(at+2),resource.readUInt16LE(at+4),resource[at+6]],[16,16,1,1]);at+=7+64;}
    assert.equal(at,resource.length);
});
test('a real earlier LCD ticket exposes its own base/clear while the current logical frame is ahead',()=>{
    const h=fixture();h.hint();const value=plain(h.baye.hd.spe());
    assert.equal(value.aiTarget.valid,true);assert.equal(value.display.aiTarget.valid,true);
    assert.deepEqual([value.id,value.kind,value.startFrm,value.endFrm,value.keyflag,value.skipEligible],[27,4,12,17,0,false]);
    assert.equal(value.resourceFingerprint,'fnv1a32:ba494eea:735');
    assert.deepEqual([value.commitSeq,value.frameIndex,value.display.commitSeq,value.display.frameIndex],[5,16,3,14]);
    assert.deepEqual(value.aiTarget.clearFrames,bits(12,13,14,15));assert.deepEqual(value.display.aiTarget.clearFrames,bits(12,13));
    assert.equal(value.aiTarget.actorPerson,600);assert.equal(value.aiTarget.targetPerson,699);
    assert.deepEqual([value.display.aiTarget.regionX,value.display.aiTarget.regionY,value.display.aiTarget.regionWidth,value.display.aiTarget.regionHeight],[64,64,16,16]);
    assert.equal(value.display.aiTarget.paletteInk,0xff000000);assert.equal(value.aiTarget.basePixels.length,256);assert.equal(value.aiTarget.baseRgba.length,1024);
    assert.equal(value.composition.valid,false,'status cannot authorize the old background composition');h.untouched();
});
test('missing, unsupported or ill-typed AI protocol cannot change old SPE fields or authenticate a cell',()=>{
    for(const version of [undefined,null,0,1,3,'2',true,0.5,NaN,Infinity]){
        const h=fixture();h.hint();h.raw.g_hdSpeAiProtocolVersion=version;const v=rejected(h);
        assert.equal(v.id,27);assert.equal(v.keyflag,0);assert.equal(v.skipEligible,false);assert.equal(v.display.frameIndex,14);
    }
});
test('neutral noncandidate paths never read the large RGBA arrays while a real candidate still validates every byte',()=>{
    for(const [field,value] of [['g_hdSpeActive',0],['g_hdSpeId',3],['g_hdSpeKind',2],['g_hdSpeStartFrm',0],['g_hdSpeEndFrm',16],['g_hdSpeResourceIndex',1],['g_hdSpeAiValid',0]]){
        const h=fixture();h.hint();h.raw[field]=value;let largeReads=0;h.onRead((path,key)=>{
            if(path===''&&['g_hdSpeAiBaseRgba','g_hdSpeDisplayAiBaseRgba'].includes(key)){largeReads++;throw Error('noncandidate must not load RGBA');}
        });rejected(h);assert.equal(largeReads,0,field);
    }
    const h=fixture();h.hint();let currentLast=0,displayLast=0;h.onRead((path,key)=>{
        if(String(key)==='1023'&&path==='.g_hdSpeAiBaseRgba')currentLast++;
        if(String(key)==='1023'&&path==='.g_hdSpeDisplayAiBaseRgba')displayLast++;
    });assert.equal(h.baye.hd.spe().display.aiTarget.valid,true);assert.ok(currentLast>=3&&displayLast>=3);h.untouched();
    h.onRead((path,key)=>{if(path==='.g_hdSpeAiBaseRgba'&&String(key)==='1023')throw Error('active candidate malformed final RGBA');});rejected(h);
});
test('every current/display scalar must be present and typed, including fields that would otherwise coerce to zero',()=>{
    const seed=fixture();seed.hint();const fields=Object.keys(seed.raw).filter(name=>name.startsWith('g_hdSpe')&&typeof seed.raw[name]==='number'&&!name.includes('Composition'));
    fields.push('g_hdFightActive','g_FgtOver','g_hdReportActive','g_hdHelpActive','g_hdQtyActive');
    assert.ok(fields.includes('g_hdSpeDisplayAiPaletteZero')&&fields.includes('g_hdSpeAiCommandType'));
    for(const field of fields)for(const missing of [undefined,null]){const h=fixture();h.hint();h.raw[field]=missing;rejected(h);}
});
test('full buffers reject strings, truncation, oversized arrays, holes and malformed unused final elements',()=>{
    for(const field of ['g_hdSpeVisibleFrames','g_hdSpeDisplayVisibleFrames','g_hdSpeAiBasePixels','g_hdSpeAiBaseRgba','g_hdSpeAiClearFrames','g_hdSpeDisplayAiBasePixels','g_hdSpeDisplayAiBaseRgba','g_hdSpeDisplayAiClearFrames']){
        const seed=fixture();seed.hint();const length=seed.raw[field].length;
        for(const value of [undefined,null,'0'.repeat(length),Array(length-1).fill(0),Array(length+1).fill(0),Array(length)]){
            const h=fixture();h.hint();h.raw[field]=value;rejected(h);
        }
        for(const value of [undefined,null,'0',true,-1,256,0.5,NaN,Infinity]){const h=fixture();h.hint();h.raw[field][length-1]=value;rejected(h);}
    }
});
test('main resource, origin, context, depth and unskippable range must be the exact actual status call',()=>{
    for(const [field,value] of [['ProtocolVersion',1],['Active',0],['Id',35],['Kind',2],['Seq',0],['Generation',0],['EventId',0],
        ['ParentEventId',9],['Depth',2],['ResourceIndex',1],['Count',17],['Count',256],['Picmax',0],['Picmax',256],
        ['StartFrm',0],['EndFrm',16],['OriginX',63],['OriginY',65],['ResourceLength',0],['FrameValid',0],['ProtocolValid',0],
        ['FrameIndex',11],['FrameIndex',18],['FrameIndex',65535],['CommitSeq',0],['Keyflag',1],['Keyflag',2],['SkipEligible',1],
        ['ContextKnown',0],['SkillId',1],['ActorIndex',11],['TargetIndex',4]]){
        const h=fixture();h.hint();h.raw['g_hdSpe'+field]=value;rejected(h);
    }
});
test('actual command and identity bounds never infer enemy/friendly legality or a skill success',()=>{
    for(const [field,value] of [['CommandType',2],['CommandParam',1],['ActorIndex',9],['ActorIndex',20],['TargetIndex',20],
        ['ActorPerson',2000],['TargetPerson',65535],['ActorX',32],['ActorY',32],['TargetX',32],['TargetY',32],
        ['MapSX',32],['MapSY',32],['MapWidth',0],['MapHeight',0]]){
        const h=fixture();h.hint();h.raw['g_hdSpeAi'+field]=value;rejected(h);
    }
    const h=fixture();h.hint();
    for(const prefix of ['g_hdSpeAi','g_hdSpeDisplayAi']){h.raw[prefix+'CommandType']=1;h.raw[prefix+'CommandParam']=65535;
        h.raw[prefix+'TargetIndex']=12;h.raw[prefix+'TargetPerson']=600;h.raw[prefix+'ActorX']=7;h.raw[prefix+'ActorY']=6;}
    h.raw.g_hdSpeTargetIndex=12;h.raw.g_hdSpeSkillId=65535;
    assert.equal(h.baye.hd.spe().display.aiTarget.valid,true,'same actor/target may be an observed friendly command; it is not a legality assertion');
    h.raw.g_hdSpeAiCommandParam=0;h.raw.g_hdSpeSkillId=0;rejected(h);
});
test('screen/region/palette/base pixels only describe a complete supported native target cell',()=>{
    for(const [field,value] of [['ScreenWidth',208],['ScreenHeight',128],['RegionX',65535],['RegionY',32768],['RegionX',145],
        ['RegionY',81],['RegionWidth',15],['RegionHeight',17],['PaletteZero',0],['PaletteInk',0x00ffffff],['PaletteInk',-16777216]]){
        const h=fixture();h.hint();h.raw['g_hdSpeAi'+field]=value;rejected(h);
    }
    const h=fixture();h.hint();
    for(const prefix of ['g_hdSpeAi','g_hdSpeDisplayAi']){h.raw[prefix+'TargetX']=12;h.raw[prefix+'TargetY']=7;h.raw[prefix+'RegionX']=144;h.raw[prefix+'RegionY']=80;}
    h.raw.g_hdSpeOriginX=144;h.raw.g_hdSpeOriginY=80;assert.equal(h.baye.hd.spe().display.aiTarget.valid,true,'last complete cell exactly fits LCD bounds');h.untouched();
});
function gray(h,positions=[1,2],rgba=[48,48,48,207]){
    for(const prefix of ['g_hdSpeAi','g_hdSpeDisplayAi'])for(const at of positions){
        h.raw[prefix+'BasePixels'][at]=207;h.raw[prefix+'BaseRgba'].splice(at*4,4,...rgba);
    }
}
test('protocol2 retains actual gray207 LE RGBA instead of coercing every nonzero index to black',()=>{
    const h=fixture();h.hint();gray(h);const v=plain(h.baye.hd.spe());
    assert.equal(v.aiTarget.protocolVersion,2);assert.equal(v.aiTarget.valid,true);assert.equal(v.display.aiTarget.valid,true);
    assert.deepEqual(v.aiTarget.basePixels.slice(0,3),[255,207,207]);assert.deepEqual(v.aiTarget.baseRgba.slice(4,12),[48,48,48,207,48,48,48,207]);
    assert.deepEqual(v.display.aiTarget.baseRgba,v.aiTarget.baseRgba);h.untouched();
    assert.match(header,/#define\s+BAYE_HD_AI_TARGET_VERSION\s+2\b/);assert.match(header,/#define\s+BAYE_HD_AI_TARGET_RGBA_BYTES\s+1024\b/);
});
test('every repeated native index must have one identical actual color and endpoints stay exact even when transparent',()=>{
    for(const component of [0,1,2,3]){const h=fixture();h.hint();gray(h);h.raw.g_hdSpeAiBaseRgba[8+component]^=1;rejected(h);}
    for(const [at,rgba] of [[0,[255,255,255,255]],[1,[0,0,0,0]],[1,[255,255,255,255]]]){
        const h=fixture();h.hint();for(const prefix of ['g_hdSpeAi','g_hdSpeDisplayAi'])h.raw[prefix+'BaseRgba'].splice(at*4,4,...rgba);rejected(h);
    }
    const h=fixture();h.hint();for(const prefix of ['g_hdSpeAi','g_hdSpeDisplayAi']){
        h.raw[prefix+'BasePixels'][1]=254;h.raw[prefix+'BaseRgba'].splice(4,4,49,49,49,254);
    }assert.equal(h.baye.hd.spe().display.aiTarget.valid,true,'other real U8 indices are not guessed or rejected as binary');h.untouched();
});
test('display cannot replace an otherwise self-consistent gray palette or resurrect a version1 source',()=>{
    const h=fixture();h.hint();gray(h);for(const at of [1,2])h.raw.g_hdSpeDisplayAiBaseRgba.splice(at*4,4,49,49,49,207);
    const v=h.baye.hd.spe();assert.equal(v.aiTarget.valid,true);neutral(v.display.aiTarget);h.untouched();
    h.raw.g_hdSpeAiProtocolVersion=1;rejected(h);
});
test('RGBA final bytes and late rereads are tracked atomically with the original command and base index array',()=>{
    for(const field of ['g_hdSpeEventId','g_hdSpeDisplayEventId','g_hdSpeAiValid']){
        const h=fixture();h.hint();gray(h);let changed=false;h.onRead((path,key)=>{
            if(!changed&&path==='.g_hdSpeDisplayAiBaseRgba'&&String(key)==='1023'){changed=true;h.raw[field]=field.endsWith('Valid')?0:32;}
        });rejected(h);assert.equal(changed,true);
    }
    const h=fixture();h.hint();gray(h);let visits=0;h.onRead((path,key)=>{
        if(path==='.g_hdSpeDisplayAiBaseRgba'&&String(key)==='1023'&&++visits===2)h.raw.g_hdSpeAiBaseRgba[4]=49;
    });rejected(h);assert.ok(visits>=2);h.untouched();
});
test('visible and accumulated clear histories cannot contain outside-range or future units',()=>{
    for(const field of ['g_hdSpeVisibleFrames','g_hdSpeAiClearFrames'])for(const bit of [0,11,17,18,255]){
        const h=fixture();h.hint();h.raw[field][bit>>3]|=1<<(bit&7);rejected(h);
    }
    for(const field of ['g_hdSpeDisplayVisibleFrames','g_hdSpeDisplayAiClearFrames'])for(const bit of [11,15,18,255]){
        const h=fixture();h.hint();h.raw[field][bit>>3]|=1<<(bit&7);const v=h.baye.hd.spe();assert.equal(v.aiTarget.valid,true);neutral(v.display.aiTarget);h.untouched();
    }
});
test('a displayed source requires its own actual copy stamp and cannot swap command, base or cumulative history',()=>{
    for(const [field,value] of [['Generation',8],['EventId',32],['CommitSeq',0],['CommitSeq',6],['FrameIndex',17],['FrameIndex',65535],['FrameValid',0]]){
        const h=fixture();h.hint();h.raw['g_hdSpeDisplay'+field]=value;const v=h.baye.hd.spe();assert.equal(v.aiTarget.valid,true,field);neutral(v.display.aiTarget);h.untouched();
    }
    for(const [field,value] of [['Valid',0],['CommandType',1],['CommandParam',12],['ActorPerson',601],['TargetIndex',4],['TargetX',8],
        ['MapSX',4],['RegionX',80],['PaletteInk',0],['ScreenWidth',208]]){
        const h=fixture();h.hint();h.raw['g_hdSpeDisplayAi'+field]=value;const v=h.baye.hd.spe();assert.equal(v.aiTarget.valid,true,field);neutral(v.display.aiTarget);h.untouched();
    }
    for(const field of ['BasePixels','BaseRgba','ClearFrames']){const h=fixture();h.hint();h.raw['g_hdSpeDisplayAi'+field][field==='BasePixels'?255:field==='BaseRgba'?1023:1]^=1;
        const v=h.baye.hd.spe();assert.equal(v.aiTarget.valid,true);neutral(v.display.aiTarget);h.untouched();}
});
test('current retirement, fight end or overlay takeover immediately discards even a matching old displayed base',()=>{
    for(const [field,value] of [['g_hdSpeAiValid',0],['g_hdFightActive',0],['g_FgtOver',1],['g_hdReportActive',1],['g_hdHelpActive',1],['g_hdQtyActive',1]]){
        const h=fixture();h.hint();h.raw[field]=value;rejected(h);
    }
});
test('strings, booleans and fractions are not native scalar observations; boxed numbers retain the narrow type',()=>{
    for(const field of ['g_hdSpeAiActorIndex','g_hdSpeAiTargetPerson','g_hdSpeAiRegionX','g_hdSpeDisplayAiPaletteInk','g_hdSpeGeneration'])
        for(const value of ['12',true,0.5,-1,0x100000000,NaN,Infinity]){const h=fixture();h.hint();h.raw[field]=value;rejected(h);}
    const h=fixture();h.hint();for(const field of Object.keys(h.raw))if(typeof h.raw[field]==='number')h.raw[field]={value:h.raw[field]};
    assert.equal(h.baye.hd.spe().display.aiTarget.valid,true);h.untouched();
});
test('a last-byte or later stability read cannot join old source pixels to new command/event or display identity',()=>{
    for(const [field,value] of [['g_hdSpeEventId',32],['g_hdSpeId',35],['g_hdSpeCommitSeq',6],['g_hdSpeResourceFingerprint',1],
        ['g_hdSpeDisplayEventId',32],['g_hdSpeAiActorPerson',601],['g_hdSpeAiValid',0],['g_hdReportActive',1]]){
        const h=fixture();h.hint();let changed=false;
        h.onRead((path,key)=>{if(!changed&&path==='.g_hdSpeDisplayAiClearFrames'&&String(key)==='31'){changed=true;h.raw[field]=value;}});
        rejected(h);assert.equal(changed,true,field);
    }
    const h=fixture();h.hint();let visits=0;
    h.onRead((path,key)=>{if(path==='.g_hdSpeDisplayAiClearFrames'&&String(key)==='31'&&++visits===2)h.raw.g_hdSpeAiBasePixels[0]=0;});
    rejected(h);assert.ok(visits>=2);
});
test('native read exceptions stay neutral and do not invoke an alternate getter or input',()=>{
    for(const target of ['g_hdSpeAiProtocolVersion','g_hdSpeAiBasePixels','g_hdSpeAiBaseRgba']){const h=fixture();h.hint();
        h.onRead((path,key)=>{if(path===''&&key===target)throw Error('unavailable binding');});rejected(h);}
});
test('an owner retired during the final stability buffer read cannot escape the post-array scalar fence',()=>{
    const h=fixture();h.hint();let visits=0;
    h.onRead((path,key)=>{if(path==='.g_hdSpeDisplayAiClearFrames'&&String(key)==='31'&&++visits===3)h.raw.g_hdSpeEventId=32;});
    rejected(h);assert.equal(visits,3);
});
test('returned source arrays are detached observations, not mutable native views or revived event caches',()=>{
    const h=fixture();h.hint();const old=h.baye.hd.spe();old.aiTarget.basePixels[0]=0;old.aiTarget.baseRgba[3]=0;old.display.aiTarget.clearFrames[1]=0;
    assert.equal(h.raw.g_hdSpeAiBasePixels[0],255);assert.equal(h.raw.g_hdSpeAiBaseRgba[3],255);assert.deepEqual(h.raw.g_hdSpeDisplayAiClearFrames,bits(12,13));
    h.raw.g_hdSpeAiValid=0;rejected(h);assert.equal(old.aiTarget.valid,true,'historical result does not mutate or authorize a new request');h.untouched();
});
test('real baye_bridge_valuedef unsigned WASM i32 ABI preserves palette and resource fingerprints',()=>{
    const h=fixture();h.hint();const module=new WebAssembly.Module(Uint8Array.from([0,97,115,109,1,0,0,0,1,6,1,96,1,127,1,127,3,2,1,0,5,3,1,0,1,7,17,2,6,109,101,109,111,114,121,2,0,4,114,101,97,100,0,0,10,9,1,7,0,32,0,40,2,0,11]));
    const actual=new WebAssembly.Instance(module).exports,memory=new DataView(actual.memory.buffer),c=h.context;
    c.Module.HEAPU8=new Uint8Array(actual.memory.buffer);c._ValueDef_get_type=()=>c.ValueTypeU32;c._baye_get_u32_value=actual.read;
    c._baye_set_u32_value=()=>{throw Error('native U32 write');};const bindings=[];
    for(const [i,unsigned] of [0xff000000,0xba494eea,0x80000000].entries()){const at=128+i*4;memory.setUint32(at,unsigned,true);
        assert.equal(actual.read(at),unsigned-0x100000000);bindings[i]=c.baye_bridge_valuedef(1,at);assert.equal(bindings[i].value,unsigned);}
    h.raw.g_hdSpeAiPaletteInk=h.raw.g_hdSpeDisplayAiPaletteInk=bindings[0];h.raw.g_hdSpeResourceFingerprint=bindings[1];
    h.raw.g_hdSpeGeneration=h.raw.g_hdSpeDisplayGeneration=bindings[2];
    const v=h.baye.hd.spe();assert.equal(v.aiTarget.valid,true);assert.equal(v.display.aiTarget.valid,true);
    assert.equal(v.aiTarget.paletteInk,0xff000000);assert.equal(v.resourceFingerprint,'fnv1a32:ba494eea:735');assert.equal(v.generation,0x80000000);h.untouched();
});
