// Read-only boundary tests. Actual native functions and pixels are verified by
// test-hd-skill-engine.mjs; these snapshots are deliberately synthetic.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const native=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.c',import.meta.url),'utf8');
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const plain=v=>JSON.parse(JSON.stringify(v));
function resource(id){const at=lib.readUInt32LE((id-1)*4);return lib.subarray(at+14,at+14+lib.readUInt32LE(at+8));}
function fnv(bytes){let hash=2166136261;for(const b of bytes)hash=Math.imul(hash^b,16777619)>>>0;return hash;}
const fire=resource(35),num=resource(15);
function fixture(){
    const raw={},writes=[],keys=[],calls=[];let onRead=null;
    const context=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});context.window=context;
    for(const n of new Set(source.match(/\b_baye\w+/g)))context[n]=()=>0;
    context._bayeHdReady=()=>1;context._bayeSendKey=k=>keys.push(k);
    vm.runInContext(source,context);context.baye_bridge_init();
    function readonly(v,path=''){return v&&typeof v==='object'?new Proxy(v,{get(o,k){onRead?.(path,k);return readonly(o[k],path+'.'+String(k));},set(o,k){writes.push(path+'.'+String(k));throw Error('write');}}):v;}
    const baye=context.baye;baye.data=readonly(raw);baye.ensureData=()=>baye.data;
    for(const n of ['getPersonName','getSkillName','getArmType','callHook'])baye[n]=(...a)=>{calls.push([n,...a]);throw Error('uncaptured getter');};
    for(const match of native.slice(0,native.indexOf('U8 g_hdSkillActive =')).matchAll(/\b(?:U8|U16|U32|I16)\s+([^;]+);/g)){
        for(const decl of match[1].split(',')){
            const m=/\b(g_hdSkillResult\w+)\s*(?:\[([^\]]+)\])?/.exec(decl);if(!m)continue;
            const len=m[2]==='BAYE_HD_SPE_FRAME_BYTES'?32:m[2]==='BAYE_HD_SKILL_DIGITS'?10:m[2]==='BAYE_HD_SKILL_LABEL_BYTES'?64:Number(m[2]);
            raw[m[1]]=m[2]?Array(len).fill(0):0;
        }
    }
    function picture(prefix,id,bytes){Object.assign(raw,{[prefix+'Valid']:1,[prefix+'Id']:id,[prefix+'ResourceIndex']:0,[prefix+'PictureIndex']:0,[prefix+'Width']:bytes.readUInt16LE(0),[prefix+'Height']:bytes.readUInt16LE(2),[prefix+'Count']:bytes.readUInt16LE(4),[prefix+'Mask']:bytes[6],[prefix+'OriginX']:0,[prefix+'OriginY']:0,[prefix+'ResourceFingerprint']:fnv(bytes),[prefix+'ResourceLength']:bytes.length});}
    function hold(phase=3){
        Object.assign(raw,{g_hdResultOwnerKind:2,g_hdResultOwnerValid:1,g_hdResultOwnerGeneration:7,g_hdResultOwnerSession:11,
            g_hdSpeGeneration:7,g_hdSpeActive:0,
            g_hdSkillResultProtocolVersion:1,g_hdSkillResultActive:1,g_hdSkillResultPhase:phase,g_hdSkillResultCustom:0,g_hdSkillResultSourceValid:1,
            g_hdSkillResultGeneration:7,g_hdSkillResultSession:11,g_hdSkillResultSkillId:1,g_hdSkillResultResultKind:1,g_hdSkillResultActorIndex:2,g_hdSkillResultTargetIndex:10,g_hdSkillResultValue:240,
            g_hdSkillResultPaintSeq:27,g_hdSkillResultEventId:31,g_hdSkillResultCommitSeq:8,g_hdSkillResultFrameIndex:7,g_hdSkillResultId:35,g_hdSkillResultResourceIndex:0,
            g_hdSkillResultCount:fire[2],g_hdSkillResultPicmax:fire[3],g_hdSkillResultStartFrm:0,g_hdSkillResultEndFrm:7,g_hdSkillResultOriginX:48,g_hdSkillResultOriginY:16,
            g_hdSkillResultResourceFingerprint:fnv(fire),g_hdSkillResultResourceLength:fire.length,
            g_hdSkillResultDisplayValid:1,g_hdSkillResultDisplayGeneration:7,g_hdSkillResultDisplaySession:11,g_hdSkillResultDisplayPaintSeq:27,g_hdSkillResultDisplayEventId:31,g_hdSkillResultDisplayCommitSeq:8,g_hdSkillResultDisplayFrameIndex:7});
        picture('g_hdSkillResultNumber',15,num);
        for(const p of ['g_hdSkillResult','g_hdSkillResultDisplay']){
            Object.assign(raw,{[p+'SceneMode']:2,[p+'SceneX']:48,[p+'SceneY']:16,[p+'SceneWidth']:65,[p+'SceneHeight']:64,[p+'LabelValid']:1,[p+'LabelX']:55,[p+'LabelY']:18,[p+'LabelLength']:8,[p+'DigitCount']:3});
            raw[p+'LabelGbk']=Array(64).fill(0);raw[p+'LabelGbk'].splice(0,8,...Buffer.from('b1f8c1a6bcf5c9d9','hex'));
            raw[p+'VisibleFrames']=Array(32).fill(0);raw[p+'VisibleFrames'][0]=128;
            raw[p+'ClearFrames']=Array(32).fill(0);raw[p+'ClearFrames'][0]=127;
            for(const f of ['Index','X','Y','FirstY','DrawCount'])raw[p+'Digit'+f]=Array(10).fill(0);
            for(let i=0;i<3;i++){raw[p+'DigitIndex'][i]=[2,4,0][i];raw[p+'DigitX'][i]=55+i*6;raw[p+'DigitY'][i]=49;raw[p+'DigitFirstY'][i]=56;raw[p+'DigitDrawCount'][i]=8;}
        }
    }
    function untouched(){assert.deepEqual(writes,[]);assert.deepEqual(keys,[]);assert.deepEqual(calls,[]);}
    return{raw,baye,hold,untouched,onRead:f=>{onRead=f;}};
}
function neutral(s){assert.equal(s.active,false);assert.equal(s.phase,null);assert.equal(s.sourceValid,false);assert.equal(s.scene,null);assert.equal(s.display,null);assert.equal(s.value,null);assert.deepEqual(plain(s.digits),[]);}
function unsafe(s){assert.equal(s.sourceValid,false);assert.equal(s.display?.valid??false,false);assert.equal(s.scene?.frameValid??false,false);}
test('skill result keeps its actual read-only owner while public SPE remains inactive',()=>{
    const f=fixture();f.hold();const s=f.baye.hd.skillResult();assert.equal(s.active,true);assert.equal(s.phase,'hold');assert.equal(s.skillId,1);assert.equal(s.value,240);
    assert.equal(s.sourceValid,true);assert.equal(s.display.valid,true);assert.equal(s.display.label.text,'兵力减少');assert.equal(s.display.composition.mode,2);assert.equal(s.display.composition.background.valid,false);
    assert.deepEqual(plain(s.display.digits).map(d=>d.digit),[2,4,0]);assert.equal(s.skipEligible,false);assert.equal(s.returnEligible,false);assert.equal(f.raw.g_hdSpeActive,0);f.untouched();
});
test('pending label and pre-NUM resource do not move displayed pixels forward',()=>{
    const f=fixture();f.hold(2);for(const p of ['g_hdSkillResult','g_hdSkillResultDisplay']){f.raw[p+'DigitCount']=0;f.raw[p+'LabelValid']=0;for(const n of ['Index','X','Y','FirstY','DrawCount'])f.raw[p+'Digit'+n].fill(0);}
    f.raw.g_hdSkillResultNumberValid=0;const s=f.baye.hd.skillResult();assert.equal(s.sourceValid,true);assert.equal(s.display.valid,true);assert.equal(s.display.label.valid,false);assert.deepEqual(plain(s.display.digits),[]);f.untouched();
});
for(const [name,change] of [
    ['custom',r=>{r.g_hdSkillResultCustom=1;}],['retired source',r=>{r.g_hdSkillResultSourceValid=0;}],
    ['another top owner kind',r=>{r.g_hdResultOwnerKind=1;}],['another top session',r=>{r.g_hdResultOwnerSession++;}],
    ['invalid parent observer',r=>{r.g_hdResultOwnerValid=0;}],
    ['unknown scene',r=>{r.g_hdSkillResultSceneMode=0;}],['missing movie',r=>{r.g_hdSkillResultEventId=0;}],
    ['outside label',r=>{r.g_hdSkillResultLabelX=100;}],['incomplete GBK',r=>{r.g_hdSkillResultLabelLength=7;}],
    ['trailing byte',r=>{r.g_hdSkillResultLabelGbk[63]=1;}],['wrong decimal',r=>{r.g_hdSkillResultDigitIndex[1]=9;}],
    ['invalid upward draw',r=>{r.g_hdSkillResultDigitY[0]=48;}],['unused digit forgery',r=>{r.g_hdSkillResultDigitX[9]=55;}],
    ['provender has no prior scene',r=>{r.g_hdSkillResultResultKind=3;}],['outside digit',r=>{r.g_hdSkillResultDigitX[0]=110;}],
    ['out of range live bit',r=>{r.g_hdSkillResultVisibleFrames[31]=128;}],['out of range clear bit',r=>{r.g_hdSkillResultClearFrames[1]=1;}]
])test('skill HD rejects '+name+' without changing native inputs',()=>{const f=fixture();f.hold();change(f.raw);unsafe(f.baye.hd.skillResult());f.untouched();});
for(const [name,change] of [
    ['another session',r=>{r.g_hdSkillResultDisplaySession++;}],['future paint',r=>{r.g_hdSkillResultDisplayPaintSeq++;}],
    ['another window',r=>{r.g_hdSkillResultDisplaySceneX++;}],['other label',r=>{r.g_hdSkillResultDisplayLabelGbk[1]^=1;}],
    ['displayed bit drift',r=>{r.g_hdSkillResultDisplayVisibleFrames[0]=64;}],['displayed pose ahead',r=>{r.g_hdSkillResultDisplayDigitDrawCount[0]=9;}]
])test('skill display rejects '+name+' separately from its current source',()=>{const f=fixture();f.hold();change(f.raw);const s=f.baye.hd.skillResult();assert.equal(s.sourceValid,true);assert.equal(s.display.valid,false);f.untouched();});
for(const name of ['g_hdSkillResultSession','g_hdSkillResultLabelGbk','g_hdSkillResultDisplayClearFrames','g_hdSkillResultDigitDrawCount'])test('complete strict snapshot neutralizes missing '+name,()=>{const f=fixture();f.hold();delete f.raw[name];neutral(f.baye.hd.skillResult());f.untouched();});
test('reentrant field reads cannot join another session to a label or digit array',()=>{
    const f=fixture();f.hold();let once=false;f.onRead((p,k)=>{if(!once&&p==='.g_hdSkillResultDisplayLabelGbk'&&k==='63'){once=true;f.raw.g_hdSkillResultSession++;}});neutral(f.baye.hd.skillResult());f.untouched();
});
test('malformed numbers and missing native data do not coerce to person/value zero',()=>{
    const f=fixture();f.hold();f.raw.g_hdSkillResultValue='240';neutral(f.baye.hd.skillResult());f.baye.ensureData=()=>null;neutral(f.baye.hd.skillResult());f.untouched();
});
test('native result stack keeps an overwritten real parent active for LCD, without authorizing child metadata',()=>{
    const f=fixture();f.hold();f.raw.g_hdResultOwnerSession=10;f.raw.g_hdResultOwnerValid=0;const top=f.baye.hd.resultOwner();
    assert.equal(top.active,true);assert.equal(top.kind,2);assert.equal(top.valid,false);assert.equal(top.session,10);unsafe(f.baye.hd.skillResult());
    delete f.raw.g_hdResultOwnerGeneration;assert.equal(f.baye.hd.resultOwner().active,false);neutral(f.baye.hd.skillResult());f.untouched();
});

// FIRE5 is an exact opaque65x64 source. The retained generic35 entry belongs to
// other skills; these synthetic owner tests never claim an actual game cast.
const fireHeader=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.h',import.meta.url),'utf8');
const fireConstants=Object.fromEntries([...fireHeader.matchAll(/^#define\s+([A-Z_][A-Z_0-9]*)\s+(\d+)\b/gm)].map(m=>[m[1],+m[2]]));
const bits=(...list)=>{const b=Array(32).fill(0);for(const n of list)b[n>>3]|=1<<(n&7);return b;};
function fireMovieFixture(){
 const raw={},keys=[],writes=[],calls=[];let onRead=null;
 const c=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});c.window=c;
 for(const n of new Set(source.match(/\b_baye\w+/g)))c[n]=()=>0;
 c._bayeHdReady=()=>1;c._bayeSendKey=k=>keys.push(k);vm.runInContext(source,c);c.baye_bridge_init();
 function readonly(v,p=''){return v&&typeof v==='object'?new Proxy(v,{get(o,k){onRead?.(p,k);return readonly(o[k],p+'.'+String(k));},set(o,k){writes.push(p+'.'+String(k));throw Error('world write');}}):v;}
 const baye=c.baye;baye.data=readonly(raw);baye.ensureData=()=>baye.data;
 for(const n of ['getPersonName','getCityName','getArmType','callHook'])baye[n]=(...a)=>{calls.push([n,...a]);throw Error('uncaptured getter/hook');};
 for(const match of native.slice(native.indexOf('U8 g_hdSpePendingKind ='),native.indexOf('U8 g_hdSkillActive =')).matchAll(/\b(?:U8|U16|U32|I16)\s+([^;]+);/g))for(const decl of match[1].split(',')){
  const m=/\b(g_hd(?:Spe|SkillResult|ResultOwner)\w+)\s*(?:\[([^\]]+)\])?/.exec(decl);if(!m)continue;
  const len=fireConstants[m[2]]??Number(m[2]);raw[m[1]]=m[2]?Array(len).fill(0):0;
 }
 function movie(skill=5,current=0,display=current){
  Object.assign(raw,{g_scale:1,g_screenWidth:160,g_screenHeight:96,g_hdReportActive:0,g_hdHelpActive:0,g_hdQtyActive:0,
   g_hdSpeProtocolVersion:2,g_hdSpeActive:1,g_hdSpeId:35,g_hdSpeKind:2,g_hdSpeSeq:12,g_hdSpeGeneration:7,g_hdSpeEventId:31,
   g_hdSpeParentEventId:0,g_hdSpeDepth:1,g_hdSpeResourceIndex:0,g_hdSpeCount:8,g_hdSpePicmax:2,g_hdSpeStartFrm:0,g_hdSpeEndFrm:7,
   g_hdSpeOriginX:48,g_hdSpeOriginY:16,g_hdSpeResourceFingerprint:fnv(fire),g_hdSpeResourceLength:fire.length,g_hdSpeProtocolValid:1,
   g_hdSpeFrameValid:1,g_hdSpeCommitSeq:current+1,g_hdSpeFrameIndex:current,g_hdSpeKeyflag:0,g_hdSpeSkipEligible:0,
   g_hdSpeContextKnown:1,g_hdSpeSkillId:skill,g_hdSpeActorIndex:2,g_hdSpeTargetIndex:10,g_hdSpeCompositionVersion:1,g_hdSpeCompositionValid:1,
   g_hdSpeDisplayCompositionValid:1,g_hdSpeDisplayGeneration:7,g_hdSpeDisplayEventId:31,g_hdSpeDisplayCommitSeq:display+1,
   g_hdSpeDisplayFrameIndex:display,g_hdSpeDisplayFrameValid:1});
  for(const [p,f] of [['g_hdSpe',current],['g_hdSpeDisplay',display]])Object.assign(raw,{[p+'SceneMode']:2,[p+'SceneX']:48,[p+'SceneY']:16,[p+'SceneWidth']:65,[p+'SceneHeight']:64,[p+'VisibleFrames']:bits(f),[p+'ClearFrames']:bits(...Array.from({length:f},(_,i)=>i))});
 }
 function picture(p,id,b){Object.assign(raw,{[p+'Valid']:1,[p+'Id']:id,[p+'ResourceIndex']:0,[p+'PictureIndex']:0,[p+'Width']:b.readUInt16LE(0),[p+'Height']:b.readUInt16LE(2),[p+'Count']:b.readUInt16LE(4),[p+'Mask']:b[6],[p+'OriginX']:0,[p+'OriginY']:0,[p+'ResourceFingerprint']:fnv(b),[p+'ResourceLength']:b.length});}
 function hold(){
  movie(5,7);Object.assign(raw,{g_hdSpeActive:0,g_hdResultOwnerKind:2,g_hdResultOwnerValid:1,g_hdResultOwnerGeneration:7,g_hdResultOwnerSession:11,
   g_hdSkillResultProtocolVersion:1,g_hdSkillResultActive:1,g_hdSkillResultPhase:3,g_hdSkillResultCustom:0,g_hdSkillResultSourceValid:1,
   g_hdSkillResultGeneration:7,g_hdSkillResultSession:11,g_hdSkillResultSkillId:5,g_hdSkillResultResultKind:1,g_hdSkillResultActorIndex:2,g_hdSkillResultTargetIndex:10,
   g_hdSkillResultValue:240,g_hdSkillResultPaintSeq:27,g_hdSkillResultEventId:31,g_hdSkillResultCommitSeq:8,g_hdSkillResultFrameIndex:7,
   g_hdSkillResultId:35,g_hdSkillResultResourceIndex:0,g_hdSkillResultCount:8,g_hdSkillResultPicmax:2,g_hdSkillResultStartFrm:0,g_hdSkillResultEndFrm:7,
   g_hdSkillResultOriginX:48,g_hdSkillResultOriginY:16,g_hdSkillResultResourceFingerprint:fnv(fire),g_hdSkillResultResourceLength:fire.length,
   g_hdSkillResultDisplayValid:1,g_hdSkillResultDisplayGeneration:7,g_hdSkillResultDisplaySession:11,g_hdSkillResultDisplayPaintSeq:27,
   g_hdSkillResultDisplayEventId:31,g_hdSkillResultDisplayCommitSeq:8,g_hdSkillResultDisplayFrameIndex:7});
  picture('g_hdSkillResultNumber',15,num);
  for(const p of ['g_hdSkillResult','g_hdSkillResultDisplay']){
   Object.assign(raw,{[p+'SceneMode']:2,[p+'SceneX']:48,[p+'SceneY']:16,[p+'SceneWidth']:65,[p+'SceneHeight']:64,[p+'VisibleFrames']:bits(7),[p+'ClearFrames']:bits(0,1,2,3,4,5,6),[p+'LabelValid']:1,[p+'LabelX']:55,[p+'LabelY']:18,[p+'LabelLength']:8,[p+'DigitCount']:3});
   raw[p+'LabelGbk']=Array(64).fill(0);raw[p+'LabelGbk'].splice(0,8,...Buffer.from('b1f8c1a6bcf5c9d9','hex'));
   for(const n of ['Index','X','Y','FirstY','DrawCount'])raw[p+'Digit'+n]=Array(10).fill(0);
   for(let i=0;i<3;i++){raw[p+'DigitIndex'][i]=[2,4,0][i];raw[p+'DigitX'][i]=55+i*6;raw[p+'DigitY'][i]=49;raw[p+'DigitFirstY'][i]=56;raw[p+'DigitDrawCount'][i]=8;}
  }
 }
 return{raw,baye,movie,hold,picture,onRead:f=>onRead=f,replaceData(){baye.data=readonly(structuredClone(raw));},untouched(){assert.deepEqual(keys,[]);assert.deepEqual(writes,[]);assert.deepEqual(calls,[]);}};
}

function rejectFire(f){const s=f.baye.hd.spe();assert.equal(s.composition.valid,false);assert.equal(s.display.composition.valid,false);f.untouched();}
test('exact FIRE5 ROM source is1212bytes and authentic65wide opaque pictures',()=>{
 assert.equal(fire.length,1212);assert.equal(fnv(fire),0x0bf53f74);assert.deepEqual([...fire.subarray(2,6)],[8,2,0,7]);
 let off=6+8*5;for(let p=0;p<2;p++){assert.equal(fire.readUInt16LE(off),65);assert.equal(fire.readUInt16LE(off+2),64);assert.equal(fire[off+6],0);off+=7+Math.ceil(65/8)*64;}
 assert.equal(off,fire.length);
});
for(let frame=0;frame<8;frame++)test('FIRE5 source copy '+frame+' authenticates current and exact displayed65x64 owner',()=>{
 const f=fireMovieFixture();f.movie(5,frame);const s=f.baye.hd.spe();assert.equal(s.skillId,5);assert.equal(s.contextKnown,true);assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,true);
 assert.deepEqual([s.composition.mode,s.composition.x,s.composition.y,s.composition.width,s.composition.height],[2,48,16,65,64]);assert.deepEqual(plain(s.display.visibleFrames),bits(frame));assert.deepEqual(plain(s.display.composition.clearFrames),bits(...Array.from({length:frame},(_,i)=>i)));f.untouched();
});
test('FIRE displayed commit may truly lag current source without borrowing future clear bits',()=>{
 const f=fireMovieFixture();f.movie(5,7,2);const s=f.baye.hd.spe();assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,true);assert.equal(s.display.commitSeq,3);assert.equal(s.commitSeq,8);assert.deepEqual(plain(s.display.composition.clearFrames),bits(0,1));f.untouched();
});
for(const [label,change]of[
 ['shared35 skill11',r=>r.g_hdSpeSkillId=11],['shared35 skill18',r=>r.g_hdSpeSkillId=18],['other skill14',r=>r.g_hdSpeSkillId=14],['other skill15',r=>r.g_hdSpeSkillId=15],
 ['custom context',r=>r.g_hdSpeContextKnown=0],['wrong movie',r=>r.g_hdSpeId=36],['fingerprint',r=>r.g_hdSpeResourceFingerprint^=1],['resource length',r=>r.g_hdSpeResourceLength--],
 ['truncated64 source',r=>r.g_hdSpeSceneWidth=64],['invented66 source',r=>r.g_hdSpeSceneWidth=66],['noninteger geometry',r=>r.g_hdSpeSceneWidth='65'],['height',r=>r.g_hdSpeSceneHeight=63],
 ['origin',r=>r.g_hdSpeOriginX=47],['scene origin',r=>r.g_hdSpeSceneY=15],['keyflag',r=>r.g_hdSpeKeyflag=1],['drawing scale',r=>r.g_scale=2],['screen width',r=>r.g_screenWidth=161],
 ['unknown actor',r=>r.g_hdSpeActorIndex=20],['unknown target',r=>r.g_hdSpeTargetIndex=20],['wrong range',r=>r.g_hdSpeEndFrm=6],['wrong frame count',r=>r.g_hdSpeCount=7],['wrong picture count',r=>r.g_hdSpePicmax=3],
 ['movie boundary',r=>r.g_hdSpeSceneMode=1],['no real opaque frontier',r=>r.g_hdSpeVisibleFrames.fill(0)],['future clear',r=>r.g_hdSpeClearFrames[0]=2],['competing report',r=>r.g_hdReportActive=1],['missing geometry',r=>delete r.g_hdSpeSceneWidth]
])test('FIRE65 authentication rejects '+label+' and preserves all native inputs',()=>{const f=fireMovieFixture();f.movie();change(f.raw);rejectFire(f);});
for(const[label,change]of[
 ['truncated display64',r=>r.g_hdSpeDisplaySceneWidth=64],['future display commit',r=>r.g_hdSpeDisplayCommitSeq=9],['future visible copy',r=>r.g_hdSpeDisplayVisibleFrames[0]=8],['future clear copy',r=>r.g_hdSpeDisplayClearFrames[0]=8],['different event',r=>r.g_hdSpeDisplayEventId++],['different generation',r=>r.g_hdSpeDisplayGeneration++]
])test('FIRE65 display independently rejects '+label,()=>{const f=fireMovieFixture();f.movie(5,7,2);change(f.raw);const s=f.baye.hd.spe();assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,false);f.untouched();});
test('FIRE65 remains LCD on a late raw mutation or opaque data rebinding',()=>{
 for(const rebind of [false,true]){const f=fireMovieFixture();f.movie();let once=false;f.onRead((p,k)=>{if(!once&&p===''&&k==='g_hdSpeStatusProtocolVersion'){once=true;if(rebind)f.replaceData();else f.raw.g_hdSpeSceneWidth=64;}});rejectFire(f);}
});
for(const phase of [2,3])test('FIRE5 real saved final copy retains65window through NUM or HOLD phase '+phase,()=>{
 const f=fireMovieFixture();f.hold();f.raw.g_hdSkillResultPhase=phase;const s=f.baye.hd.skillResult();assert.equal(s.skillId,5);assert.equal(s.speId,35);assert.equal(s.sourceValid,true);assert.equal(s.display.valid,true);assert.deepEqual([s.display.composition.mode,s.display.composition.x,s.display.composition.y,s.display.composition.width,s.display.composition.height],[2,48,16,65,64]);assert.deepEqual(plain(s.display.digits).map(d=>d.digit),[2,4,0]);f.untouched();
});
