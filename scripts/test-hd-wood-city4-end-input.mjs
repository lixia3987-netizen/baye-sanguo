// Registered source contracts; fresh LOAD/SAVE/SYS tickets below are controlled fixtures.
// The history is genuine P57; only the fresh LOAD/SAVE/SYS transport below is synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as M from './hd-wood-city4-continuation.mjs';
import {V32_POLICY_OBSERVER_FUNCTION_SOURCE} from './hd-impact-v32-conditional-plunder-prefix.mjs';
import * as B from './hd-wood-city4-end-input.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),copy=structuredClone,next=n=>((n+1)>>>0)||1,sha=x=>createHash('sha256').update(x).digest('hex');
let genuine;
const input=()=>genuine??=B.readCity4DispatchedInput(root);
const read=p=>fs.readFileSync(path.join(root,p));
function historicalStage(a,key){for(let i=0;a&&i<=8;i++,a=a.resume?.history)if(Object.hasOwn(a,key))return a;throw Error('Missing genuine historical stage: '+key);}
function key(t,code){return{code,generation:t.state.snapshot.spe.generation,speActive:0,resultActive:false,fight:copy(t.state.snapshot.fight)};}
function controlledSave(before,pair,tag){
 const b=copy(before),c=copy(b),r=copy(b),a=copy(b),generation=b.state.snapshot.spe.generation;
 c.state.keys++;c.state.overworld='other';c.state.march.pick=0;c.state.menu={...c.state.menu,active:1,context:2,kind:1,index:0,count:3,seq:next(b.state.menu.seq),generation,detailGeneration:generation,idsValid:false,ids:[],itemLen:8,names:['策略结束','存储进度','结束游戏'],packedNames:['策略结束','存储进度','结束游戏']};
 r.state.keys+=3;r.state.overworld='other';r.state.march.pick=0;r.state.menu={...c.state.menu,active:0,context:0,kind:0,index:1,seq:next(c.state.menu.seq)};r.state.record={...r.state.record,active:1,mode:1,index:0,count:3,seq:next(b.state.record.seq)};
 a.state.keys+=4;a.state.menu=copy(r.state.menu);a.state.record={...r.state.record,active:0,mode:0,count:0,seq:next(r.state.record.seq)};a.state.march.mapInputSeq=next(b.state.march.mapInputSeq);a.state.snapshot.report={...a.state.snapshot.report,text:'存储中...',seq:((b.state.snapshot.report.seq+1)&65535)||1,kind:1,person:65535,active:0};
 const publicKeys=[40,35,39,39].map(code=>key(b,code)),files=[0,1].map(i=>{const bytes=Buffer.from(pair['sav'+i],'hex');return{path:'native-'+tag+'-sango'+i+'.sav',bytes:bytes.length,sha256:sha(bytes),lib:'libs/dat-mod.lib',identity:'v1:414390:1d36da77:1e9c0477'};});
 return{publicSave:{tag,slot:0,before:b,beforeChoice:c,beforeRecord:r,after:a,system:copy(c.state.menu),record:copy(r.state.record),keys:[publicKeys[3]],files},publicPair:copy(pair),publicKeys};
}
function resumed(){
 const i=input(),loadedTicket=copy(i.historyProof.lastTicket);loadedTicket.state.keys=7;loadedTicket.meta.identity.generation+=40;loadedTicket.state.snapshot.library=copy(loadedTicket.meta.identity);for(const k of Object.keys(loadedTicket.state.snapshot.references))if(Number.isInteger(loadedTicket.state.snapshot.references[k]))loadedTicket.state.snapshot.references[k]+=10000;loadedTicket.state.snapshot.spe.generation+=40;loadedTicket.state.menu.generation=loadedTicket.state.snapshot.spe.generation;loadedTicket.state.menu.detailGeneration=loadedTicket.state.snapshot.spe.generation;for(const h of loadedTicket.meta.recruitmentHookFence.hooks)if(Number.isInteger(h.functionRef))h.functionRef+=1000;loadedTicket.meta.recruitmentHookFence.callHook.functionRef+=1000;loadedTicket.meta.controlledNewEpoch={sourceOnly:true};
 const saved=controlledSave(loadedTicket,i.pair,B.CITY4_END_SAVE_TAGS.resume);
 return{libBytes:Buffer.from(i.libBytes),nativeBudget:copy(i.nativeBudget),referenceWorld:copy(i.historyProof.referenceWorld),saveTags:copy(i.historyLedger.saveTags),resume:{history:B.withCity4EndRuntimeLibrary(copy(i.historyLedger),i.libBytes),inputPair:copy(i.pair),loadedTicket,expectedSaveTag:B.CITY4_END_SAVE_TAGS.resume,...saved},repairs:[]};
}
function endArgs(){
 const i=input(),ledger=resumed(),p=M.verifyCity4PreparationLedger(ledger),before=copy(p.currentEpochAnchor),observerExpected={functionSource:V32_POLICY_OBSERVER_FUNCTION_SOURCE};
 before.meta.v32HookFence.observer={name:'willExecuteOrder',present:true,sameFunction:true,originalUndefined:true,functionSource:observerExpected.functionSource};
 // This is only the exact first FunctionMenu ticket (one40); no SAVE or END is executed.
 const final=controlledSave(before,i.pair,B.CITY4_END_SAVE_TAGS.settled).publicSave.beforeChoice;
 return{input:i,ledger,observerExpected,hookFence:copy(before.meta.v32HookFence),endReady:{before,first:copy(final),second:copy(final),final,keys:[key(before,40)]}};
}

test('Only nine exact public P57 inputs bind the fully saved dispatched world and original false flags',()=>{
 const seen=[],i=B.readCity4DispatchedInput(root,{readFile:p=>{seen.push(p);return read(p);}});assert.deepEqual(seen,[...B.OCTOBER_INPUT_PINS,...B.CITY4_HISTORY_INPUT_PINS,B.CITY4_END_LIBRARY_PIN].map(p=>p.path));assert.equal(i.historyProof.phase,'dispatched');assert.equal(i.world.cities[4].Food,6334);assert.deepEqual(i.current.activeOrders,[0,170]);assert.equal(i.publication.observations.originalFlags.wrapperOk,false);assert.equal(i.maximumNewMarches,0);assert.equal(i.maximumNewEnd,1);assert.equal(i.ordinaryEndAccepted,false);assert.equal(seen.some(p=>p.includes('city4-march-actual-v53/')||p.includes('private-browser-profile')),false);
});
test('P57 input binder rejects one-byte old pair foreign LIB canonical or archive substitution',()=>{
 for(const target of[B.OCTOBER_INPUT_PINS[0],B.OCTOBER_INPUT_PINS[2],B.CITY4_HISTORY_INPUT_PINS[1],B.CITY4_END_LIBRARY_PIN])assert.throws(()=>B.readCity4DispatchedInput(root,{readFile:p=>{const bytes=Buffer.from(read(p));if(p===target.path)bytes[bytes.length-1]^=1;return bytes;}}),/Exact P57 bytes\/SHA/);
});
test('Fresh END tags reject every recursively used or merely declared role and each other',()=>{
 const h=input().historyLedger,all=B.collectCity4EndTags(h);assert.deepEqual(B.assertCity4EndSaveTags(B.CITY4_END_SAVE_TAGS,h),B.CITY4_END_SAVE_TAGS);for(const tag of new Set([...all.used,...all.declared]))assert.throws(()=>B.assertCity4EndSaveTags({...B.CITY4_END_SAVE_TAGS,resume:tag},h),/recursively declared or used/);assert.throws(()=>B.assertCity4EndSaveTags({...B.CITY4_END_SAVE_TAGS,failed:B.CITY4_END_SAVE_TAGS.resume},h),/Distinct/);
});
test('Only the entire dispatched history can supply the current input proof',()=>{
 const i={...input(),historyLedger:input().historyLedger.resume.history};assert.throws(()=>B.verifyCity4DispatchedResume({input:i,ledger:resumed()}));const j={...input(),historyProof:{accepted:true,phase:'dispatched'}};assert.throws(()=>B.verifyCity4DispatchedResume({input:j,ledger:resumed()}),/Complete supplied historical proof/);
});
test('A controlled fresh LOAD and genuine-shaped SAVE establish a new epoch without comparing historical references',()=>{
 const i=input(),ledger=resumed(),before=JSON.stringify(B.stripCity4EndRuntime(i.historyLedger)),r=B.verifyCity4DispatchedResume({input:i,ledger});assert.equal(r.accepted,true);assert.equal(r.resumeEpochEstablished,true);assert.equal(r.historicalReferencesComparedAcrossProcesses,false);assert.equal(r.historicalSeedCompared,false);assert.equal(r.rngContinuityAccepted,false);assert.equal(r.ordinaryEndAccepted,false);assert.deepEqual(r.lastWorld,i.world);assert.notEqual(r.currentEpochAnchor.state.snapshot.references.data,i.historyProof.lastTicket.state.snapshot.references.data);assert.equal(JSON.stringify(B.stripCity4EndRuntime(i.historyLedger)),before);
});
test('An old pre-March pair or LOAD ticket cannot resume the P57 queued world',()=>{
 const a=resumed();a.resume.inputPair=M.verifyCity4PreparationLedger(a.resume.history.resume.history).lastPublicPair;assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:a}));const b=resumed();b.resume.loadedTicket.world=copy(b.resume.history.resume.history.resume.loadedTicket.world);assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:b}));
});
test('Fresh resume rejects queued world Food army order captive or unknown-field substitutions',()=>{
 for(const change of[w=>w.cities[4].Food++,w=>w.fighters[0]=0,w=>w.orders[0].Consume=0,w=>w.orders[170].Food=450,w=>w.people[129].Arms++,w=>w.futureResumeField={hidden:true}]){const a=resumed();change(a.resume.loadedTicket.world);assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:a}));}
});
test('New END layer cannot replay March Plunder or either completed repair',()=>{
 for(const[field,value]of[['march',input().historyLedger.march],['plunder',historicalStage(input().historyLedger,'plunder').plunder],['repairs',[{}]]]){const a=resumed();a[field]=copy(value);assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:a}));}
});
test('New SAVE must be an exact fresh LOAD anchor and remain in one complete new epoch',()=>{
 const a=resumed();a.resume.publicSave.before.meta.cityPos.setx++;assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:a}));const b=resumed();b.resume.publicSave.beforeRecord.state.snapshot.references.data++;assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:b}));const c=resumed();c.resume.expectedSaveTag=B.CITY4_END_SAVE_TAGS.failed;assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:c}));
});
test('Exact fresh observer plus original complete SYS ticket admits only a conditional single END source plan',()=>{
 const a=endArgs(),r=B.verifyCity4EndAdmission(a);assert.equal(r.accepted,true);assert.equal(r.conditionalEndAdmissionQualified,true);assert.equal(r.maximumNewEnd,1);assert.equal(r.maximumNewMarches,0);assert.equal(r.nextNativeConfirm,39);assert.equal(r.sourceFoodGain,645);assert.equal(r.sourceMoneyGain,258);assert.equal(r.proof.forecastIsActualIncome,false);assert.equal(r.actualSupplyIncomeAccepted,false);assert.equal(r.ordinaryEndAccepted,false);assert.equal(r.actualBattleAccepted,false);assert.equal(r.hdAccepted,false);
});
test('END rejects same-world SYS pollution in complete snapshot qty record cursor native menu or march owner',()=>{
 for(const change of[t=>t.state.snapshot.units[19].position.hp++,t=>t.state.qty.futureEndQty=1,t=>t.state.record.seq++,t=>t.meta.cityPos.setx++,t=>t.state.futureEndOwner={hidden:true},t=>t.state.menu.count=2,t=>t.state.menu.packedNames[2]='退出',t=>t.state.menu.seq--,t=>t.state.march.pick=1]){const a=endArgs();change(a.endReady.final);a.endReady.first=copy(a.endReady.final);a.endReady.second=copy(a.endReady.final);assert.throws(()=>B.verifyCity4EndAdmission(a));}
});
test('END cannot use the old saved epoch missing hook wrong observer or a future declared tag as resume',()=>{
 const a=endArgs();a.hookFence.observer.present=false;assert.throws(()=>B.verifyCity4EndAdmission(a));const b=endArgs();b.observerExpected.functionSource+=' ';assert.throws(()=>B.verifyCity4EndAdmission(b));const c=endArgs();c.endReady.before=copy(input().historyProof.lastTicket);assert.throws(()=>B.verifyCity4EndAdmission(c));const d=resumed();d.resume.expectedSaveTag=input().historyProof.saveTags.failed;assert.throws(()=>B.verifyCity4DispatchedResume({input:input(),ledger:d}));
});
