#!/usr/bin/env node
// Public production readers consume read-only native observations. This VM
// fixture validates the bridge contract; the adjacent compiled C suite supplies
// actual playback/pixel evidence. No game getter, hook or input is invoked.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const native=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.c',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
function payload(id){const at=lib.readUInt32LE((id-1)*4);assert.equal(lib.readUInt16LE(at+4),id);return lib.subarray(at+14,at+14+lib.readUInt32LE(at+8));}
function fingerprint(bytes){let n=2166136261;for(const byte of bytes)n=Math.imul(n^byte,16777619)>>>0;return n;}
const resource=payload(19),background=payload(16),number=payload(15);

function fixture(){
    const raw={},writes=[],keys=[],calls=[];let onRead=null;
    const context=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},
        console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});context.window=context;
    for(const name of new Set(source.match(/\b_baye\w+/g)))context[name]=()=>0;
    context._bayeHdReady=()=>1;context._bayeSendKey=key=>keys.push(key);
    vm.runInContext(source,context);context.baye_bridge_init();
    function readonly(value,path=''){
        if(!value||typeof value!=='object')return value;
        return new Proxy(value,{get(object,key){if(onRead)onRead(path,key);return readonly(object[key],path+'.'+String(key));},
            set(object,key){writes.push(path+'.'+String(key));throw Error('native write');}});
    }
    const baye=context.baye;baye.data=readonly(raw);baye.ensureData=()=>baye.data;
    for(const name of ['getPersonName','getCityName','getToolName','getArmType','callHook'])
        baye[name]=(...args)=>{calls.push([name,...args]);throw Error('uncaptured getter/hook');};
    // The native declarations, not a hand-created shortened array, establish
    // all required fields and the complete ten/32-element observation buffers.
    for(const match of native.slice(native.indexOf('U8 g_hdSpePendingKind ='),native.indexOf('U8 g_hdSkillActive =')).matchAll(/\b(?:U8|U16|U32|I16)\s+([^;]+);/g))
        for(const declaration of match[1].split(',')){
            const m=/\b(g_hd(?:Spe|Attack)\w+)\s*(?:\[([^\]]+)\])?/.exec(declaration);if(!m)continue;
            const length=m[2]==='BAYE_HD_SPE_FRAME_BYTES'?32:m[2]==='BAYE_HD_ATTACK_DIGITS'?10:Number(m[2]);
            raw[m[1]]=m[2]?Array(length).fill(0):0;
        }
    function picture(prefix,id,bytes,x=15,y=16){Object.assign(raw,{
        [prefix+'Valid']:1,[prefix+'Id']:id,[prefix+'ResourceIndex']:0,[prefix+'PictureIndex']:0,
        [prefix+'Width']:bytes.readUInt16LE(0),[prefix+'Height']:bytes.readUInt16LE(2),
        [prefix+'Count']:bytes.readUInt16LE(4),[prefix+'Mask']:bytes[6],
        [prefix+'OriginX']:x,[prefix+'OriginY']:y,[prefix+'ResourceFingerprint']:fingerprint(bytes),[prefix+'ResourceLength']:bytes.length});}
    function hold(phase=3){
        Object.assign(raw,{g_hdResultOwnerKind:1,g_hdResultOwnerValid:1,g_hdResultOwnerGeneration:7,g_hdResultOwnerSession:11,
            g_hdSpeProtocolVersion:2,g_hdSpeGeneration:7,g_hdSpeActive:0,
            g_hdAttackProtocolVersion:1,g_hdAttackActive:1,g_hdAttackPhase:phase,g_hdAttackCustom:0,
            g_hdAttackSourceValid:1,g_hdAttackGeneration:7,g_hdAttackSession:11,g_hdAttackActorIndex:3,
            g_hdAttackTargetIndex:10,g_hdAttackHurt:123,g_hdAttackPaintSeq:24,g_hdAttackEventId:31,
            g_hdAttackCommitSeq:11,g_hdAttackFrameIndex:10,g_hdAttackId:19,g_hdAttackResourceIndex:0,
            g_hdAttackCount:resource[2],g_hdAttackPicmax:resource[3],g_hdAttackStartFrm:0,g_hdAttackEndFrm:10,
            g_hdAttackOriginX:15,g_hdAttackOriginY:16,g_hdAttackResourceFingerprint:fingerprint(resource),
            g_hdAttackResourceLength:resource.length,g_hdAttackDigitCount:phase===1?0:3,
            g_hdAttackDisplayValid:1,g_hdAttackDisplayGeneration:7,g_hdAttackDisplaySession:11,
            g_hdAttackDisplayPaintSeq:24,g_hdAttackDisplayEventId:31,g_hdAttackDisplayCommitSeq:11,
            g_hdAttackDisplayFrameIndex:10,g_hdAttackDisplayDigitCount:phase===1?0:3});
        picture('g_hdAttackBg',16,background);picture('g_hdAttackDisplayBg',16,background);picture('g_hdAttackNumber',15,number,0,0);
        for(const prefix of ['g_hdAttack','g_hdAttackDisplay']){
            raw[prefix+'VisibleFrames']=Array(32).fill(0);raw[prefix+'VisibleFrames'][1]=4;
            raw[prefix+'ClearFrames']=Array(32).fill(0);raw[prefix+'ClearFrames'][0]=255;
            for(const field of ['DigitIndex','DigitX','DigitY','DigitFirstY','DigitDrawCount'])raw[prefix+field]=Array(10).fill(0);
            if(phase>=2)for(let i=0;i<3;i++){
                raw[prefix+'DigitIndex'][i]=i+1;raw[prefix+'DigitX'][i]=55+i*6;
                raw[prefix+'DigitY'][i]=49;raw[prefix+'DigitFirstY'][i]=56;raw[prefix+'DigitDrawCount'][i]=8;
            }
        }
    }
    function composition(){hold(1);Object.assign(raw,{g_hdSpeActive:1,g_hdSpeId:19,g_hdSpeKind:3,
        g_hdSpeEventId:31,g_hdSpeCount:resource[2],g_hdSpePicmax:resource[3],g_hdSpeStartFrm:0,g_hdSpeEndFrm:10,
        g_hdSpeFrameIndex:10,g_hdSpeFrameValid:1,g_hdSpeProtocolValid:1,g_hdSpeCommitSeq:11,
        g_hdSpeResourceLength:resource.length,g_hdSpeResourceFingerprint:fingerprint(resource),
        g_hdSpeOriginX:15,g_hdSpeOriginY:16,g_hdSpeCompositionVersion:1,g_hdSpeCompositionValid:1,
        g_hdSpeDisplayCompositionValid:1,g_hdSpeDisplayGeneration:7,g_hdSpeDisplayEventId:31,
        g_hdSpeDisplayCommitSeq:11,g_hdSpeDisplayFrameIndex:10,g_hdSpeDisplayFrameValid:1});
        picture('g_hdSpeBg',16,background);picture('g_hdSpeDisplayBg',16,background);
        for(const prefix of ['g_hdSpe','g_hdSpeDisplay']){
            raw[prefix+'VisibleFrames']=Array.from(raw.g_hdAttackVisibleFrames);
            raw[prefix+'ClearFrames']=Array.from(raw.g_hdAttackClearFrames);
        }
    }
    function untouched(){assert.deepEqual(writes,[]);assert.deepEqual(keys,[]);assert.deepEqual(calls,[]);}
    return{raw,baye,context,hold,composition,picture,untouched,onRead:fn=>{onRead=fn;}};
}
function neutral(v){assert.equal(v.active,false);assert.equal(v.sourceValid,false);assert.equal(v.phase,null);
    assert.equal(v.scene,null);assert.equal(v.display,null);assert.equal(v.skipEligible,false);assert.equal(v.returnEligible,false);
    assert.deepEqual(plain(v.digits),[]);for(const f of ['generation','session','actorIndex','targetIndex','hurt','paintSeq','resourceFingerprint'])assert.equal(v[f],null,f);}
function unauthenticated(v){assert.equal(v.sourceValid,false);assert.equal(v.scene?.frameValid??false,false);assert.equal(v.display?.valid??false,false);}

test('actual readonly attack source remains independent of a retired child SPE and never acquires input ownership',()=>{
    const h=fixture();h.hold();const v=plain(h.baye.hd.attack());
    assert.equal(v.active,true);assert.equal(v.phase,'hold');assert.equal(v.sourceValid,true);assert.equal(v.custom,false);
    assert.deepEqual([v.actorIndex,v.targetIndex,v.hurt,v.speId,v.startFrm,v.endFrm],[3,10,123,19,0,10]);
    assert.equal(v.resourceFingerprint,`fnv1a32:${fingerprint(resource).toString(16)}:${resource.length}`);
    assert.equal(v.scene.composition.background.resourceFingerprint,'fnv1a32:3bf544d6:1095');
    assert.equal(v.number.resourceFingerprint,'fnv1a32:b37d7407:327');assert.equal(v.display.valid,true);
    assert.deepEqual(v.display.digits,[1,2,3].map((digit,i)=>({digit,x:55+i*6,y:49,firstY:56,drawCount:8})));
    assert.equal(v.skipEligible,false);assert.equal(v.returnEligible,false);h.untouched();
});
test('movie, numbers and hold keep their native phase while custom or retired surfaces cannot authenticate',()=>{
    for(const phase of [1,2,3]){const h=fixture();h.hold(phase);assert.equal(h.baye.hd.attack().phase,{1:'movie',2:'numbers',3:'hold'}[phase]);
        h.raw.g_hdAttackCustom=1;const custom=h.baye.hd.attack();assert.equal(custom.active,true);assert.equal(custom.custom,true);unauthenticated(custom);
        h.raw.g_hdAttackCustom=0;h.raw.g_hdAttackSourceValid=0;unauthenticated(h.baye.hd.attack());h.untouched();}
});
test('every missing current/display/picture scalar is neutral rather than being coerced into actor zero or a valid frame',()=>{
    const seed=fixture();seed.hold();const fields=Object.keys(seed.raw).filter(k=>k.startsWith('g_hdAttack')&&typeof seed.raw[k]==='number');fields.push('g_hdSpeGeneration');
    assert.ok(fields.includes('g_hdAttackCustom')&&fields.includes('g_hdAttackFrameIndex'));
    for(const field of fields)for(const value of [undefined,null]){const h=fixture();h.hold();h.raw[field]=value;neutral(h.baye.hd.attack());h.untouched();}
});
test('strings, booleans, fractions, signed forged U32 values and out-of-range fields are never native typed observations',()=>{
    for(const [field,value] of [['ProtocolVersion','1'],['Active',true],['Phase',4],['Custom',-1],['Hurt',65536],
        ['Generation',-1],['Session',0x100000000],['PaintSeq',0.5],['ResourceFingerprint',-128],
        ['OriginX',65536],['DigitCount',11],['DisplayPaintSeq',Infinity],['FrameIndex',NaN]]){
        const h=fixture();h.hold();h.raw['g_hdAttack'+field]=value;neutral(h.baye.hd.attack());h.untouched();}
    for(const version of [0,2,undefined,null,true]){const h=fixture();h.hold();h.raw.g_hdAttackProtocolVersion=version;neutral(h.baye.hd.attack());h.untouched();}
});
test('invalid owner identity or native ranges retain no authenticated source, including empty and out-of-resource bounds',()=>{
    for(const [field,value] of [['Active',0],['Generation',8],['Session',0],['Phase',0],['ActorIndex',20],['TargetIndex',255],
        ['EventId',0],['CommitSeq',0],['ResourceLength',0],['Count',0],['Count',256],['Picmax',0],['Picmax',256],
        ['FrameIndex',65535],['FrameIndex',11],['StartFrm',11],['EndFrm',66]]){
        const h=fixture();h.hold();h.raw['g_hdAttack'+field]=value;unauthenticated(h.baye.hd.attack());h.untouched();}
});
test('all native byte and digit arrays must be complete and numeric even when a later unused slot is corrupt',()=>{
    const seed=fixture();seed.hold();const fields=Object.keys(seed.raw).filter(k=>k.startsWith('g_hdAttack')&&Array.isArray(seed.raw[k]));assert.equal(fields.length,14);
    for(const field of fields){const length=seed.raw[field].length;for(const value of [undefined,null,'0'.repeat(length),seed.raw[field].slice(0,-1),Array(length)]){
        const h=fixture();h.hold();h.raw[field]=value;neutral(h.baye.hd.attack());h.untouched();}
        for(const value of [null,'0',false,-1,65536,0.5,NaN]){const h=fixture();h.hold();h.raw[field][length-1]=value;neutral(h.baye.hd.attack());h.untouched();}}
});
test('visibility and cumulative clear bits outside the true called range cannot authenticate the native scene',()=>{
    for(const field of ['VisibleFrames','ClearFrames','DisplayVisibleFrames','DisplayClearFrames'])for(const bit of [11,66,255]){
        const h=fixture();h.hold();h.raw['g_hdAttack'+field][bit>>3]|=1<<(bit&7);const v=h.baye.hd.attack();
        if(field.startsWith('Display'))assert.equal(v.display.valid,false);else unauthenticated(v);h.untouched();}
    const h=fixture();h.hold();h.raw.g_hdAttackStartFrm=8;unauthenticated(h.baye.hd.attack());h.untouched();
});
test('display identity or surface mismatch cannot become shown merely because the current source is valid',()=>{
    for(const [field,value] of [['Valid',0],['Generation',8],['Session',12],['EventId',32],['CommitSeq',12],['FrameIndex',9],
        ['PaintSeq',25],['BgResourceFingerprint',1],['BgOriginX',16]]){
        const h=fixture();h.hold();h.raw['g_hdAttackDisplay'+field]=value;const v=h.baye.hd.attack();assert.equal(v.sourceValid,true);assert.equal(v.display.valid,false,field);h.untouched();}
    for(const field of ['VisibleFrames','ClearFrames']){const h=fixture();h.hold();h.raw['g_hdAttackDisplay'+field][0]^=1;assert.equal(h.baye.hd.attack().display.valid,false);h.untouched();}
});
test('actual passed damage controls the decimal prefix and upward pose history; a display cannot contain future or reordered digits',()=>{
    for(const [field,index,value] of [['DigitIndex',0,9],['DigitY',0,48],['DigitDrawCount',0,0],['DigitDrawCount',0,9]]){
        const h=fixture();h.hold();h.raw['g_hdAttack'+field][index]=value;unauthenticated(h.baye.hd.attack());h.untouched();}
    for(const [field,index,value] of [['DigitIndex',0,9],['DigitX',0,99],['DigitFirstY',0,55],['DigitDrawCount',0,9]]){
        const h=fixture();h.hold();h.raw['g_hdAttackDisplay'+field][index]=value;assert.equal(h.baye.hd.attack().display.valid,false);h.untouched();}
    const h=fixture();h.hold(2);h.raw.g_hdAttackDisplayDigitCount=1;h.raw.g_hdAttackDisplayPaintSeq=4;
    h.raw.g_hdAttackDisplayDigitDrawCount[0]=4;h.raw.g_hdAttackDisplayDigitY[0]=53;assert.equal(h.baye.hd.attack().display.valid,true,'a real earlier prefix is still displayed');h.untouched();
});
test('boxed native numbers decode negative origins without accepting negative fabricated digit coordinates',()=>{
    const h=fixture();h.hold();for(const key of Object.keys(h.raw))if(typeof h.raw[key]==='number')h.raw[key]={value:h.raw[key]};
    h.raw.g_hdAttackOriginX={value:65535};h.raw.g_hdAttackOriginY={value:32768};
    for(const prefix of ['g_hdAttack','g_hdAttackDisplay']){h.raw[prefix+'DigitX'][0]=65535;h.raw[prefix+'DigitFirstY'][0]=65535;h.raw[prefix+'DigitY'][0]=65528;}
    const v=h.baye.hd.attack();assert.equal(v.sourceValid,true);assert.equal(v.x,-1);assert.equal(v.y,-32768);assert.equal(v.display.digits[0].x,-1);assert.equal(v.display.digits[0].y,-8);h.untouched();
});
test('the actual U32 value binding restores signed WASM i32 results before authenticating native fingerprints and sessions',()=>{
    const h=fixture();h.hold();const module=new WebAssembly.Module(Uint8Array.from([0,97,115,109,1,0,0,0,1,6,1,96,1,127,1,127,3,2,1,0,5,3,1,0,1,7,17,2,6,109,101,109,111,114,121,2,0,4,114,101,97,100,0,0,10,9,1,7,0,32,0,40,2,0,11]));
    const actual=new WebAssembly.Instance(module).exports,memory=new DataView(actual.memory.buffer),c=h.context;
    c.Module.HEAPU8=new Uint8Array(actual.memory.buffer);c._ValueDef_get_type=()=>c.ValueTypeU32;c._baye_get_u32_value=actual.read;
    c._baye_set_u32_value=()=>{throw Error('native U32 write');};const bindings=[];
    for(const [i,unsigned] of [0x80000000,0xb37d7407,0xffffffff].entries()){const at=128+i*4;memory.setUint32(at,unsigned,true);assert.equal(actual.read(at),unsigned-0x100000000);
        bindings[i]=c.baye_bridge_valuedef(1,at);assert.equal(bindings[i].value,unsigned);}
    h.raw.g_hdAttackNumberResourceFingerprint=bindings[1];h.raw.g_hdAttackResourceFingerprint=bindings[2];
    for(const field of ['g_hdSpeGeneration','g_hdResultOwnerGeneration','g_hdResultOwnerSession','g_hdAttackGeneration','g_hdAttackDisplayGeneration','g_hdAttackSession','g_hdAttackDisplaySession'])h.raw[field]=bindings[0];
    const v=h.baye.hd.attack();assert.equal(v.active,true);assert.equal(v.sourceValid,true);assert.equal(v.display.valid,true);assert.equal(v.generation,0x80000000);
    assert.equal(v.number.resourceFingerprint,'fnv1a32:b37d7407:327');assert.equal(v.resourceFingerprint,'fnv1a32:ffffffff:6115');h.untouched();
});
test('a final digit read reentering any owner, resource or painted-buffer field retires the entire mixed snapshot',()=>{
    for(const [field,value] of [['Session',12],['Generation',8],['Active',0],['Phase',1],['Custom',1],['FrameIndex',9],
        ['BgResourceFingerprint',1],['NumberResourceLength',328],['DisplaySession',12],['DisplayPaintSeq',23]]){
        const h=fixture();h.hold();let changed=false;h.onRead((path,key)=>{if(!changed&&path==='.g_hdAttackDisplayDigitDrawCount'&&String(key)==='9'){changed=true;h.raw['g_hdAttack'+field]=value;}});
        neutral(h.baye.hd.attack());assert.equal(changed,true,field);h.untouched();}
    const h=fixture();h.hold();let changed=false;h.onRead((path,key)=>{if(!changed&&path==='.g_hdAttackDisplayDigitDrawCount'&&String(key)==='9'){changed=true;h.raw.g_hdAttackClearFrames[0]^=1;}});neutral(h.baye.hd.attack());h.untouched();
});
test('returned arrays are independent observations and a new native owner cannot mutate a retained older snapshot',()=>{
    const h=fixture();h.hold();const old=h.baye.hd.attack();old.scene.composition.clearFrames[0]=0;old.display.digits[0].x=999;
    assert.equal(h.raw.g_hdAttackClearFrames[0],255);assert.equal(h.raw.g_hdAttackDisplayDigitX[0],55);
    h.raw.g_hdAttackSession=h.raw.g_hdAttackDisplaySession=12;const fresh=h.baye.hd.attack();assert.equal(old.session,11);assert.equal(fresh.session,12);
    assert.equal(fresh.scene.composition.clearFrames[0],255);assert.equal(fresh.display.digits[0].x,55);h.untouched();
});
test('SPE v2 composition exposes actual background and cumulative clears while preserving the child displayed-frame contract',()=>{
    const h=fixture();h.composition();const v=h.baye.hd.spe();assert.equal(v.protocolVersion,2);assert.equal(v.composition.protocolVersion,1);
    assert.equal(v.composition.valid,true);assert.equal(v.display.composition.valid,true);assert.equal(v.display.frameIndex,10);
    assert.equal(v.composition.background.resourceFingerprint,'fnv1a32:3bf544d6:1095');assert.equal(v.composition.clearFrames[0],255);
    v.composition.clearFrames[0]=0;assert.equal(h.raw.g_hdSpeClearFrames[0],255);h.untouched();
});
test('SPE composition never authorizes missing metadata, malformed byte buffers or a changed LCD copy generation',()=>{
    for(const field of ['g_hdSpeCompositionVersion','g_hdSpeGeneration','g_hdSpeEventId','g_hdSpeStartFrm','g_hdSpeEndFrm','g_hdSpeBgMask','g_hdSpeDisplayBgResourceLength']){
        const h=fixture();h.composition();h.raw[field]=null;const v=h.baye.hd.spe();assert.equal(v.composition.valid,false,field);assert.equal(v.display.composition.valid,false);h.untouched();}
    for(const field of ['g_hdSpeClearFrames','g_hdSpeDisplayClearFrames'])for(const values of ['0'.repeat(32),Array(31).fill(0),Array(32)]){
        const h=fixture();h.composition();h.raw[field]=values;assert.equal(h.baye.hd.spe().display.composition.valid,false);h.untouched();}
    const h=fixture();h.composition();h.raw.g_hdSpeDisplayGeneration=8;const v=h.baye.hd.spe();assert.equal(v.composition.valid,true);assert.equal(v.display.composition.valid,false);h.untouched();
});
test('SPE composition rejects an owner change during the last clear byte read instead of joining old live units to new background',()=>{
    for(const field of ['g_hdSpeEventId','g_hdSpeDisplayEventId','g_hdSpeBgResourceFingerprint','g_hdSpeDisplayCommitSeq',
        'g_hdSpeId','g_hdSpeResourceFingerprint','g_hdSpeCommitSeq','g_hdSpeFrameIndex','g_hdSpeProtocolVersion']){
        const h=fixture();h.composition();let changed=false;h.onRead((path,key)=>{if(!changed&&path==='.g_hdSpeDisplayClearFrames'&&String(key)==='31'){changed=true;h.raw[field]+=1;}});
        const v=h.baye.hd.spe();assert.equal(v.composition.valid,false,field);assert.equal(v.display.composition.valid,false,field);assert.equal(changed,true);h.untouched();}
});
