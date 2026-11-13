import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const native=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.c',import.meta.url),'utf8');
const header=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.h',import.meta.url),'utf8');
const constants=Object.fromEntries([...header.matchAll(/^#define\s+([A-Z_][A-Z_0-9]*)\s+(\d+)\b/gm)].map(m=>[m[1],+m[2]]));
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const plain=v=>JSON.parse(JSON.stringify(v));
const bits=(...list)=>{const b=Array(32).fill(0);for(const n of list)b[n>>3]|=1<<(n&7);return b;};
function payload(id){const o=lib.readUInt32LE((id-1)*4);return lib.subarray(o+14,o+14+lib.readUInt32LE(o+8));}
function fnv(b){let n=2166136261;for(const v of b)n=Math.imul(n^v,16777619)>>>0;return n;}
const wood=payload(37),number=payload(15),background=payload(16);
function fixture(){
 const raw={},keys=[],writes=[],calls=[];let onRead=null;
 const c=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});c.window=c;
 for(const n of new Set(source.match(/\b_baye\w+/g)))c[n]=()=>0;
 c._bayeHdReady=()=>1;c._bayeSendKey=k=>keys.push(k);vm.runInContext(source,c);c.baye_bridge_init();
 function readonly(v,p=''){return v&&typeof v==='object'?new Proxy(v,{get(o,k){onRead?.(p,k);return readonly(o[k],p+'.'+String(k));},set(o,k){writes.push(p+'.'+String(k));throw Error('world write');}}):v;}
 const baye=c.baye;baye.data=readonly(raw);baye.ensureData=()=>baye.data;
 for(const n of ['getPersonName','getCityName','getArmType','callHook'])baye[n]=(...a)=>{calls.push([n,...a]);throw Error('uncaptured getter/hook');};
 for(const match of native.slice(native.indexOf('U8 g_hdSpePendingKind ='),native.indexOf('U8 g_hdSkillActive =')).matchAll(/\b(?:U8|U16|U32|I16)\s+([^;]+);/g))for(const decl of match[1].split(',')){
  const m=/\b(g_hd(?:Spe|SkillResult|ResultOwner)\w+)\s*(?:\[([^\]]+)\])?/.exec(decl);if(!m)continue;
  const len=constants[m[2]]??Number(m[2]);raw[m[1]]=m[2]?Array(len).fill(0):0;
 }
 function movie(skill=6,current=0,display=current){
  Object.assign(raw,{g_scale:1,g_screenWidth:160,g_screenHeight:96,g_hdReportActive:0,g_hdHelpActive:0,g_hdQtyActive:0,
   g_hdSpeProtocolVersion:2,g_hdSpeActive:1,g_hdSpeId:37,g_hdSpeKind:2,g_hdSpeSeq:12,g_hdSpeGeneration:7,g_hdSpeEventId:31,
   g_hdSpeParentEventId:0,g_hdSpeDepth:1,g_hdSpeResourceIndex:0,g_hdSpeCount:8,g_hdSpePicmax:2,g_hdSpeStartFrm:0,g_hdSpeEndFrm:skill===6?7:0,
   g_hdSpeOriginX:48,g_hdSpeOriginY:16,g_hdSpeResourceFingerprint:fnv(wood),g_hdSpeResourceLength:wood.length,g_hdSpeProtocolValid:1,
   g_hdSpeFrameValid:1,g_hdSpeCommitSeq:current+1,g_hdSpeFrameIndex:current,g_hdSpeKeyflag:0,g_hdSpeSkipEligible:0,
   g_hdSpeContextKnown:1,g_hdSpeSkillId:skill,g_hdSpeActorIndex:2,g_hdSpeTargetIndex:10,g_hdSpeCompositionVersion:1,g_hdSpeCompositionValid:1,
   g_hdSpeDisplayCompositionValid:1,g_hdSpeDisplayGeneration:7,g_hdSpeDisplayEventId:31,g_hdSpeDisplayCommitSeq:display+1,
   g_hdSpeDisplayFrameIndex:display,g_hdSpeDisplayFrameValid:1});
  for(const [p,f] of [['g_hdSpe',current],['g_hdSpeDisplay',display]])Object.assign(raw,{[p+'SceneMode']:skill===6?3:2,[p+'SceneX']:48,[p+'SceneY']:16,[p+'SceneWidth']:f?66:64,[p+'SceneHeight']:64,[p+'VisibleFrames']:bits(f),[p+'ClearFrames']:bits(...Array.from({length:f},(_,i)=>i))});
 }
 function picture(p,id,b){Object.assign(raw,{[p+'Valid']:1,[p+'Id']:id,[p+'ResourceIndex']:0,[p+'PictureIndex']:0,[p+'Width']:b.readUInt16LE(0),[p+'Height']:b.readUInt16LE(2),[p+'Count']:b.readUInt16LE(4),[p+'Mask']:b[6],[p+'OriginX']:0,[p+'OriginY']:0,[p+'ResourceFingerprint']:fnv(b),[p+'ResourceLength']:b.length});}
 function hold(){
  movie(6,7);Object.assign(raw,{g_hdSpeActive:0,g_hdResultOwnerKind:2,g_hdResultOwnerValid:1,g_hdResultOwnerGeneration:7,g_hdResultOwnerSession:11,
   g_hdSkillResultProtocolVersion:1,g_hdSkillResultActive:1,g_hdSkillResultPhase:3,g_hdSkillResultCustom:0,g_hdSkillResultSourceValid:1,
   g_hdSkillResultGeneration:7,g_hdSkillResultSession:11,g_hdSkillResultSkillId:6,g_hdSkillResultResultKind:1,g_hdSkillResultActorIndex:2,g_hdSkillResultTargetIndex:10,
   g_hdSkillResultValue:240,g_hdSkillResultPaintSeq:27,g_hdSkillResultEventId:31,g_hdSkillResultCommitSeq:8,g_hdSkillResultFrameIndex:7,
   g_hdSkillResultId:37,g_hdSkillResultResourceIndex:0,g_hdSkillResultCount:8,g_hdSkillResultPicmax:2,g_hdSkillResultStartFrm:0,g_hdSkillResultEndFrm:7,
   g_hdSkillResultOriginX:48,g_hdSkillResultOriginY:16,g_hdSkillResultResourceFingerprint:fnv(wood),g_hdSkillResultResourceLength:wood.length,
   g_hdSkillResultDisplayValid:1,g_hdSkillResultDisplayGeneration:7,g_hdSkillResultDisplaySession:11,g_hdSkillResultDisplayPaintSeq:27,
   g_hdSkillResultDisplayEventId:31,g_hdSkillResultDisplayCommitSeq:8,g_hdSkillResultDisplayFrameIndex:7});
  picture('g_hdSkillResultNumber',15,number);
  for(const p of ['g_hdSkillResult','g_hdSkillResultDisplay']){
   Object.assign(raw,{[p+'SceneMode']:3,[p+'SceneX']:48,[p+'SceneY']:16,[p+'SceneWidth']:66,[p+'SceneHeight']:64,[p+'VisibleFrames']:bits(7),[p+'ClearFrames']:bits(0,1,2,3,4,5,6),[p+'LabelValid']:1,[p+'LabelX']:55,[p+'LabelY']:18,[p+'LabelLength']:8,[p+'DigitCount']:3});
   raw[p+'LabelGbk']=Array(64).fill(0);raw[p+'LabelGbk'].splice(0,8,...Buffer.from('b1f8c1a6bcf5c9d9','hex'));
   for(const n of ['Index','X','Y','FirstY','DrawCount'])raw[p+'Digit'+n]=Array(10).fill(0);
   for(let i=0;i<3;i++){raw[p+'DigitIndex'][i]=[2,4,0][i];raw[p+'DigitX'][i]=55+i*6;raw[p+'DigitY'][i]=49;raw[p+'DigitFirstY'][i]=56;raw[p+'DigitDrawCount'][i]=8;}
  }
 }
 return{raw,baye,movie,hold,picture,onRead:f=>onRead=f,replaceData(){baye.data=readonly(structuredClone(raw));},untouched(){assert.deepEqual(keys,[]);assert.deepEqual(writes,[]);assert.deepEqual(calls,[]);}};
}
function rejected(f){const s=f.baye.hd.spe();assert.equal(s.composition.valid,false);assert.equal(s.display.composition.valid,false);f.untouched();}
test('wood mode3 publishes actual first64, later66, and a displayed64 copy lag independently',()=>{
 const f=fixture();f.movie(6,0);let s=f.baye.hd.spe();assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,true);assert.equal(s.display.composition.width,64);
 f.movie(6,1,0);s=f.baye.hd.spe();assert.equal(s.composition.width,66);assert.equal(s.display.composition.width,64);assert.equal(s.display.composition.valid,true);
 f.movie(6,7);s=f.baye.hd.spe();assert.equal(s.display.composition.width,66);assert.deepEqual(plain(s.display.composition.clearFrames),bits(0,1,2,3,4,5,6));f.untouched();
});
test('falling-stone one real frame keeps its old equal opaque mode2 with exact skill7',()=>{const f=fixture();f.movie(7);const s=f.baye.hd.spe();assert.equal(s.composition.valid,true);assert.equal(s.composition.mode,2);assert.equal(s.display.composition.width,64);f.untouched();});
for(const [name,change] of [
 ['first64 falsely66',r=>r.g_hdSpeSceneWidth=66],['future clear',r=>r.g_hdSpeClearFrames[0]=2],['no actual writes',r=>r.g_hdSpeVisibleFrames.fill(0)],
 ['wrong skill',r=>r.g_hdSpeSkillId=5],['wrong range',r=>r.g_hdSpeEndFrm=6],['wrong origin',r=>r.g_hdSpeSceneX=47],['clipped height',r=>r.g_hdSpeSceneHeight=63],
 ['noninteger width',r=>r.g_hdSpeSceneWidth='64'],['negative signed origin',r=>r.g_hdSpeSceneX=0xffff],['custom/unobserved context',r=>r.g_hdSpeContextKnown=0],
 ['unrelated report',r=>r.g_hdReportActive=1],['wrong drawing scale',r=>r.g_scale=2],['missing new scalar',r=>delete r.g_hdSpeDisplaySceneHeight]
])test('direct opaque geometry rejects '+name,()=>{const f=fixture();f.movie();change(f.raw);rejected(f);});
test('displayed geometry cannot advance to current future width/clear or borrow another copy owner',()=>{
 for(const change of [r=>r.g_hdSpeDisplaySceneWidth=66,r=>r.g_hdSpeDisplayClearFrames[0]=2,r=>r.g_hdSpeDisplayCommitSeq=3,r=>r.g_hdSpeDisplayEventId=32]){
  const f=fixture();f.movie(6,1,0);change(f.raw);const s=f.baye.hd.spe();assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,false);f.untouched();
 }
});
test('reentrant late observer reads cannot retain an already sampled old geometry',()=>{
 const f=fixture();f.movie();let once=false;f.onRead((p,k)=>{if(!once&&p===''&&k==='g_hdSpeStatusProtocolVersion'){once=true;f.raw.g_hdSpeSceneWidth=66;}});rejected(f);
});
test('rebinding the actual data object during a late observer read invalidates the old direct copy',()=>{
 const f=fixture();f.movie();let once=false;f.onRead((p,k)=>{if(!once&&p===''&&k==='g_hdSpeStatusProtocolVersion'){once=true;f.replaceData();}});rejected(f);
});
test('legacy ABI with no scene fields still permits only its real background path',()=>{
 const f=fixture();f.movie();for(const p of ['g_hdSpe','g_hdSpeDisplay'])for(const n of ['Mode','X','Y','Width','Height'])delete f.raw[p+'Scene'+n];rejected(f);
 f.picture('g_hdSpeBg',16,background);f.picture('g_hdSpeDisplayBg',16,background);const s=f.baye.hd.spe();assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,true);assert.equal(s.composition.mode,undefined);f.untouched();
});
test('wood numeric hold belongs to real saved final66 copy, label and native12wide/6advance digit history',()=>{
 const f=fixture();f.hold();const s=f.baye.hd.skillResult();assert.equal(s.sourceValid,true);assert.equal(s.display.valid,true);assert.equal(s.display.composition.mode,3);assert.equal(s.display.composition.width,66);assert.equal(s.speId,37);assert.equal(s.skillId,6);assert.deepEqual(plain(s.display.digits).map(d=>d.x),[55,61,67]);f.untouched();
});
test('mode3 saved copy rejects an owner origin outside its actual zero-offset scene',()=>{
 for(const change of [r=>r.g_hdSkillResultOriginX=49,r=>r.g_hdSkillResultOriginY=17]){
  const f=fixture();f.hold();change(f.raw);const s=f.baye.hd.skillResult();assert.equal(s.sourceValid,false);assert.equal(s.display.valid,false);f.untouched();
 }
});
test('numeric owner cannot invent66 from an early copy, wrong skill, changed scene or overwritten top',()=>{
 for(const change of [r=>r.g_hdSkillResultFrameIndex=0,r=>r.g_hdSkillResultSceneWidth=64,r=>r.g_hdSkillResultSkillId=7,r=>r.g_hdSkillResultCustom=1,r=>r.g_hdResultOwnerSession=12,r=>r.g_hdSkillResultDisplaySceneWidth=64]){
  const f=fixture();f.hold();change(f.raw);assert.equal(f.baye.hd.skillResult().display.valid,false);f.untouched();
 }
});
