// Unexecuted source controls for the complete formal SAVE contract. The P57
// packet is copied/retagged as fixture data; no original source or game is changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as M from './hd-wood-city4-continuation.mjs';
import {readCity4DispatchedInput} from './hd-wood-city4-end-input.mjs';
import {sourceOriginalPlunderReport} from './hd-wood-city4-plunder-report.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex'),tag='wood67-131-v62-controlled-plunder-report-save';
const makeText=new TextDecoder('gbk',{fatal:true}).decode(Buffer.from('ced2cbe4b2bbd4b8c8e7b4cba3acb5abd2b2cac7b2bbb5c3d2d1a1a3','hex'));
let genuine;const input=()=>genuine??=readCity4DispatchedInput(root);
function recipe(world=input().world){return sourceOriginalPlunderReport({libBytes:input().libBytes,iq:world.people[44].IQ,force:world.people[44].Force});}
function fixture({person=44,kind=2,active=0,text=recipe().text,seq=65535,inputSeq=0xffffffff}={}){
 const i=input(),publicSave=copy(i.publicSavePacket.publicSave),publicPair=copy(i.pair),publicKeys=copy(i.publicSavePacket.publicKeys),world=copy(i.world);
 publicSave.tag=tag;for(let n=0;n<2;n++)publicSave.files[n].path='native-'+tag+'-sango'+n+'.sav';
 for(const key of ['before','beforeChoice','beforeRecord'])publicSave[key].state.snapshot.report={...publicSave[key].state.snapshot.report,person,kind,active,text,seq,inputSeq,controlledOpaqueReport:{retain:[null,44,'source-only']}};
 publicSave.after.state.snapshot.report={...publicSave.before.state.snapshot.report,text:'存储中...',seq:((seq+1)&65535)||1,kind:1,person:65535,active:0};
 return{publicSave,publicPair,publicKeys,world,expectedSaveTag:tag,libBytes:Buffer.from(i.libBytes),nativeBudget:copy(i.nativeBudget)};
}
function qualify(f){return M.verifyCity4PublicSave(f);}
function falseCredit(result){assert.equal(result.sourceOnly,true);assert.equal(result.publicSaveAccepted,false);assert.equal(result.actualSupplyIncomeAccepted,false);assert.equal(result.actualMonthAccepted,false);assert.equal(result.hdAccepted,false);}

test('Whole formal SAVE preserves old sentinel and exact MAKE44 while admitting only the native LIB result report',()=>{
 for(const f of [fixture({person:65535,kind:1,text:'controlled retired sentinel'}),fixture({text:makeText}),fixture()]){const r=qualify(f);assert.equal(r.wholePackedAndPublicOwnerMeasured,true);falseCredit(r);assert.equal(f.publicSave.after.state.snapshot.report.seq,1);assert.equal(f.publicSave.after.state.snapshot.report.inputSeq,0xffffffff);assert.deepEqual(f.publicSave.after.state.snapshot.report.controlledOpaqueReport,{retain:[null,44,'source-only']});}
});

test('Native result before SAVE rejects wrong amounts spacing punctuation PID kind and active owner',()=>{
 const p=recipe(),texts=[p.text.replace(String(p.sourceMoneyAmount),String(p.sourceMoneyAmount+1)),p.text.replace(String(p.sourceFoodAmount),String(p.sourceFoodAmount+1)),p.text+' ', ' '+p.text,p.text.replaceAll(' ',''),p.text.replace('；',';'),p.text.replace('。','.'),p.text.replace(String(p.sourceMoneyAmount),'0'+p.sourceMoneyAmount),'获得粮食'+p.sourceFoodAmount+'，金钱'+p.sourceMoneyAmount];
 assert.ok(texts.every(s=>s!==p.text));for(const text of texts)assert.throws(()=>qualify(fixture({text})));
 for(const patch of [{person:131},{person:43},{kind:1},{kind:0},{active:1}])assert.throws(()=>qualify(fixture(patch)));
});

test('New report branch still binds every opaque field full snapshot raw pair and exact sequence transition',()=>{
 const good=fixture();assert.equal(qualify(good).wholePackedAndPublicOwnerMeasured,true);
 const mutations=[
  f=>{f.publicSave.beforeChoice.state.snapshot.report.controlledOpaqueReport.retain.push('changed');},
  f=>{f.publicSave.after.state.snapshot.report.controlledOpaqueReport.retain[1]=45;},
  f=>{f.publicSave.after.state.snapshot.controlledForeignSnapshot={value:1};},
  f=>{f.publicSave.after.state.snapshot.units[19].position.hp++;},
  f=>{f.publicSave.after.state.snapshot.report.seq=2;},
  f=>{f.publicSave.after.state.snapshot.report.inputSeq=0;},
  f=>{f.publicSave.after.state.snapshot.report.person=44;},
  f=>{f.publicSave.after.world.cities[4].Money++;},
  f=>{f.publicPair.sav0=f.publicPair.sav0.slice(0,-2)+(parseInt(f.publicPair.sav0.slice(-2),16)^1).toString(16).padStart(2,'0');}
 ];for(const change of mutations){const f=fixture();change(f);assert.throws(()=>qualify(f));}
});

test('Result formatting derives from current world44 U8 stats and original bytes rather than fixed258/645',()=>{
 const f=fixture(),old=recipe(f.world),iq=f.world.people[44].IQ,nextIq=iq===255?254:iq+1;f.world.people[44].IQ=nextIq;
 for(const key of ['before','beforeChoice','beforeRecord','after'])f.publicSave[key].world=copy(f.world);
 const bytes=Buffer.from(f.publicPair.sav0,'hex');bytes[16+44*19+6]=nextIq;f.publicPair.sav0=bytes.toString('hex');f.publicSave.files[0].bytes=bytes.length;f.publicSave.files[0].sha256=sha(bytes);
 assert.throws(()=>qualify(f),'An old result sentence cannot describe different current IQ/Force');
 const current=recipe(f.world);assert.notEqual(current.text,old.text);for(const key of ['before','beforeChoice','beforeRecord'])f.publicSave[key].state.snapshot.report.text=current.text;
 const r=qualify(f);assert.equal(r.wholePackedAndPublicOwnerMeasured,true);falseCredit(r);
});
