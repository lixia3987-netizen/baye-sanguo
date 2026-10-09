// Independent AID cases; this helper registers no WOOD or other tests.
import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture,rejected,plain,bits,aidMovie,aidHold} from './hd-aid-native-test-fixture.mjs';
test('AID17 and29 public movie getter certifies first actual64 and independent lagged copies',()=>{
 for(const skill of [17,29])for(const [current,shown]of[[0,0],[3,0],[7,5],[7,7]]){
  const f=fixture();aidMovie(f,skill,current,shown);const s=f.baye.hd.spe();
  assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,true);
  assert.equal(s.composition.mode,2);assert.equal(s.composition.background.valid,false);
  assert.equal(s.composition.width,64);assert.equal(s.display.frameIndex,shown);
  assert.deepEqual(plain(s.display.composition.clearFrames),bits(...Array.from({length:shown},(_,i)=>i)));f.untouched();
 }
});
for(const [name,change]of[
 ['wrong skill',r=>r.g_hdSpeSkillId=6],['wrong id',r=>r.g_hdSpeId=40],['wrong item',r=>r.g_hdSpeResourceIndex=1],
 ['wrong count',r=>r.g_hdSpeCount=7],['wrong picmax',r=>r.g_hdSpePicmax=3],['wrong start',r=>r.g_hdSpeStartFrm=1],
 ['wrong end',r=>r.g_hdSpeEndFrm=6],['changed FNV',r=>r.g_hdSpeResourceFingerprint^=1],['changed length',r=>r.g_hdSpeResourceLength++],
 ['mode3 borrowed',r=>r.g_hdSpeSceneMode=3],['wrong origin',r=>r.g_hdSpeOriginX=49],['wrong scene origin',r=>r.g_hdSpeSceneX=49],
 ['unsupported wide shape',r=>r.g_hdSpeSceneWidth=66],['clipped height',r=>r.g_hdSpeSceneHeight=63],
 ['wrong keyflag',r=>r.g_hdSpeKeyflag=1],['context unknown',r=>r.g_hdSpeContextKnown=0],
 ['actor sentinel',r=>r.g_hdSpeActorIndex=255],['target sentinel',r=>r.g_hdSpeTargetIndex=255],
 ['not active',r=>r.g_hdSpeActive=0],['unready frame',r=>r.g_hdSpeFrameValid=0],['native invalid',r=>r.g_hdSpeCompositionValid=0],
 ['no actual writes',r=>{r.g_hdSpeVisibleFrames.fill(0);r.g_hdSpeClearFrames.fill(0)}],
 ['future visible',r=>r.g_hdSpeVisibleFrames=bits(1)],['future clear',r=>r.g_hdSpeClearFrames=bits(1)],
 ['string geometry',r=>r.g_hdSpeSceneWidth='64'],['missing display scalar',r=>delete r.g_hdSpeDisplaySceneHeight],
 ['extended screen',r=>r.g_screenWidth=176],['scale unsupported',r=>r.g_scale=2],
 ['report takeover',r=>r.g_hdReportActive=1],['help takeover',r=>r.g_hdHelpActive=1],['quantity takeover',r=>r.g_hdQtyActive=1]
])test('AID independent source rejects '+name,()=>{const f=fixture();aidMovie(f);change(f.raw);rejected(f)});
test('AID display rejects future/stale copy and bit histories independently from valid current',()=>{
 for(const change of[
  r=>r.g_hdSpeDisplayCommitSeq=5,r=>r.g_hdSpeDisplayGeneration=8,r=>r.g_hdSpeDisplayEventId=32,
  r=>r.g_hdSpeDisplayFrameIndex=4,r=>r.g_hdSpeDisplayClearFrames=bits(1),
  r=>r.g_hdSpeDisplaySceneMode=3,r=>r.g_hdSpeDisplaySceneWidth=66,
  r=>{r.g_hdSpeDisplayVisibleFrames.fill(0);r.g_hdSpeDisplayClearFrames.fill(0)}
 ]){
  const f=fixture();aidMovie(f,17,3,0);change(f.raw);const s=f.baye.hd.spe();
  assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,false);f.untouched();
 }
});
test('AID same commit requires exact frame/live/clear and lag requires cumulative clear subset',()=>{
 for(const change of[
  r=>r.g_hdSpeDisplayFrameIndex=1,r=>r.g_hdSpeDisplayVisibleFrames=bits(1),
  r=>r.g_hdSpeDisplayClearFrames=bits(0),
  r=>{r.g_hdSpeDisplayCommitSeq=1;r.g_hdSpeDisplayFrameIndex=0;r.g_hdSpeDisplayVisibleFrames=bits(0);r.g_hdSpeDisplayClearFrames=bits(0);r.g_hdSpeClearFrames=bits(1)}
 ]){
  const f=fixture();aidMovie(f,17,3);change(f.raw);const s=f.baye.hd.spe();
  assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,false);f.untouched();
 }
});
test('AID late getter mutation and data rebind cannot retain previously sampled owner',()=>{
 for(const change of[
  f=>f.raw.g_hdSpeSceneWidth=66,f=>f.raw.g_hdSpeSkillId=29,f=>f.raw.g_hdSpeDisplayClearFrames=bits(1),f=>f.replaceData()
 ]){
  const f=fixture();aidMovie(f);let once=false;
  f.onRead((p,k)=>{if(!once&&p===''&&k==='g_hdSpeStatusProtocolVersion'){once=true;change(f)}});
  rejected(f);
 }
});
test('AID generic saved mode2 numbers and hold preserve actual ARMS_GAIN zero/800/1800 with nativeNUM source',()=>{
 for(const [skill,value]of[[17,0],[17,800],[29,1800]]){
  const f=fixture();aidHold(f,skill,value);const s=f.baye.hd.skillResult();
  assert.equal(s.sourceValid,true);assert.equal(s.display.valid,true);assert.equal(s.resultKind,2);assert.equal(s.value,value);
  assert.equal(s.display.composition.mode,2);assert.equal(s.display.composition.width,64);
  assert.equal(s.display.label.text,'兵力增加');assert.deepEqual(plain(s.display.digits).map(d=>d.digit),String(value).split('').map(Number));f.untouched();
 }
});
test('AID numeric owner still rejects custom, other top, stale display and malformed NUM source',()=>{
 for(const change of[r=>r.g_hdSkillResultCustom=1,r=>r.g_hdResultOwnerSession=12,
  r=>r.g_hdSkillResultDisplayEventId=32,r=>r.g_hdSkillResultDisplaySceneWidth=66,
  r=>r.g_hdSkillResultNumberCount=9,r=>r.g_hdSkillResultDisplayDigitIndex[0]=1]){
  const f=fixture();aidHold(f);change(f.raw);assert.equal(f.baye.hd.skillResult().display.valid,false);f.untouched();
 }
});
test('AID five public scenario shapes can be generated without filesystem output',()=>{
 const cases=[['first17',f=>aidMovie(f,17,0)],['last29',f=>aidMovie(f,29,7)],['lag17',f=>aidMovie(f,17,3,0)],['zero17',f=>aidHold(f,17,0)],['gain29',f=>aidHold(f,29,1800)]];
 for(const [name,setup]of cases){const f=fixture();setup(f);const s=f.baye.hd.spe(),r=f.baye.hd.skillResult(),o=f.baye.hd.resultOwner();
 if(name==='zero17'||name==='gain29'){assert.equal(r.sourceValid,true);assert.equal(r.display.valid,true);assert.equal(r.resultKind,2);assert.equal(o.valid,true);}
 else{assert.equal(s.composition.valid,true);assert.equal(s.display.composition.valid,true);assert.equal(s.display.composition.width,64);}f.untouched();}
});
