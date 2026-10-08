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
