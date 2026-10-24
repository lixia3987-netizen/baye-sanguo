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

test('Eight exact public P57 files and original LIB bind the fully saved dispatched world and original false flags',()=>{
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


test('Dispatched history rejects a caller-added unknown field even if every semantic proof still matches',()=>{
 const i=input(),changed={...i,historyLedger:{...i.historyLedger,futureHistoryOrigin:{controlled:true,partOfOriginalArchive:false}}};assert.throws(()=>B.verifyCity4DispatchedHistory(changed));
});
test('Every dispatched admission recomputes eight exact raw origins and preserves original false flags',()=>{
 const i=input(),before=JSON.stringify(B.stripCity4EndRuntime(i.historyLedger)),p=B.verifyCity4DispatchedOrigin(i);assert.equal(p.originAuthenticated,true);assert.equal(p.sourceOnly,true);assert.equal(p.actualMonthAccepted,false);assert.equal(p.hdAccepted,false);assert.deepEqual(Object.keys(i.originBytes).sort(),['final','ledger','library','publicSave','publication','sav0','sav1','world']);assert.equal(JSON.stringify(B.stripCity4EndRuntime(i.historyLedger)),before);assert.equal(i.publication.observations.originalFlags.wrapperOk,false);
});
test('Origin authentication rejects a changed byte in each raw file instead of trusting copied pin metadata',()=>{
 const i=input();for(const name of Object.keys(i.originBytes)){const raw=Buffer.from(i.originBytes[name]);raw[raw.length-1]^=1;assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,originBytes:{...i.originBytes,[name]:raw}}));}
});
test('Raw origin capability requires all exact named byte views and never evaluates caller accessors',()=>{
 const i=input();for(const name of Object.keys(i.originBytes)){const originBytes={...i.originBytes};delete originBytes[name];assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,originBytes}));}
 assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,originBytes:{...i.originBytes,unclassified:Buffer.from('x')}}));assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,originBytes:{...i.originBytes,library:new Uint8Array(B.CITY4_END_LIBRARY_PIN.bytes+1)}}));let getters=0;const a={...i.originBytes};Object.defineProperty(a,'ledger',{enumerable:true,get(){getters++;return i.originBytes.ledger;}});assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,originBytes:a}));assert.equal(getters,0);
});
test('Full historical provenance rejects deep unknown fields and every runtime LIB substitution',()=>{
 const i=input(),historyLedger=copy(i.historyLedger),nodes=[];for(let a=historyLedger;a;a=a.resume?.history)nodes.push(a);assert.ok(nodes.length>=4);for(const node of nodes){node.futureOriginField={unpublished:true};assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,historyLedger}));delete node.futureOriginField;const original=node.libBytes,bad=Buffer.from(original);bad[bad.length-1]^=1;node.libBytes=bad;assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,historyLedger}));node.libBytes=original;}
});
test('Historical origin guards reject values JSON would erase and getters without executing them',()=>{
 const i=input();for(const value of [undefined,()=>1,NaN,Infinity,new Date(0),Object.create(null),Object.assign([1],{extra:2}),new Array(2)]){const historyLedger={...i.historyLedger,futureOriginValue:value};assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,historyLedger}));}
 let getters=0;const h={...i.historyLedger};Object.defineProperty(h,'futureAccessor',{enumerable:true,get(){getters++;return 1;}});assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,historyLedger:h}));assert.equal(getters,0);const hidden={...i.historyLedger};Object.defineProperty(hidden,'unpublishedNonEnumerable',{value:1});assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,historyLedger:hidden}));const symbolic={...i.historyLedger,[Symbol('unpublished')]:1};assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,historyLedger:symbolic}));const cyclic={...i.historyLedger};cyclic.unpublishedCycle=cyclic;assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,historyLedger:cyclic}));
});
test('Publication world pair final owner and saved packet each remain fully bound to their own original bytes',()=>{
 const i=input();for(const field of ['publication','world','pair','finalOwner','publicSavePacket'])assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,[field]:{...i[field],futureUnpublishedField:{kept:true}}}));
});
test('Structured clone byte views can reauthenticate original history without caller identity or cached proof',()=>{
 const i=input(),originBytes=copy(i.originBytes);assert.ok(originBytes.ledger instanceof Uint8Array);const p=B.verifyCity4DispatchedOrigin({...i,originBytes});assert.equal(p.originAuthenticated,true);assert.equal(p.hdAccepted,false);
});
test('A fresh resume preserves the authenticated budget and entire original runtime history data',()=>{
 const i=input(),ledger=resumed(),nativeBudget={...i.nativeBudget,dailyRatio:i.nativeBudget.dailyRatio+1};ledger.nativeBudget=nativeBudget;assert.throws(()=>B.verifyCity4DispatchedResume({input:{...i,nativeBudget},ledger}));
 for(const change of [h=>Object.defineProperty(h,'unpublishedHidden',{value:1}),h=>{const bad=Buffer.from(h.libBytes);bad[bad.length-1]^=1;h.libBytes=bad;}]){const a=resumed();change(a.resume.history);assert.throws(()=>B.verifyCity4DispatchedResume({input:i,ledger:a}));}
 let getters=0;const a=resumed();Object.defineProperty(a.resume.history,'unpublishedAccessor',{enumerable:true,get(){getters++;return 1;}});assert.throws(()=>B.verifyCity4DispatchedResume({input:i,ledger:a}));assert.equal(getters,0);const b=resumed();Object.defineProperty(b,'unclassifiedHidden',{value:1});assert.throws(()=>B.verifyCity4DispatchedResume({input:i,ledger:b}));
 let budgetCalls=0;const fresh=resumed(),budgetValue=fresh.nativeBudget.dailyRatio;Object.defineProperty(fresh.nativeBudget,'dailyRatio',{enumerable:true,get(){budgetCalls++;return budgetValue;}});assert.throws(()=>B.verifyCity4DispatchedResume({input:i,ledger:fresh}));assert.equal(budgetCalls,0);
 let proofCalls=0;const historyProof={...i.historyProof};Object.defineProperty(historyProof,'phase',{enumerable:true,get(){proofCalls++;return i.historyProof.phase;}});assert.throws(()=>B.verifyCity4DispatchedResume({input:{...i,historyProof},ledger:resumed()}));assert.equal(proofCalls,0);
 let libCalls=0;const runtimeLib=Buffer.from(i.libBytes);Object.defineProperty(runtimeLib,'valueOf',{get(){libCalls++;return function(){return this;};}});assert.throws(()=>B.verifyCity4DispatchedOrigin({...i,libBytes:runtimeLib}));assert.equal(libCalls,0);const freshLibrary=resumed();Object.defineProperty(freshLibrary.libBytes,'valueOf',{get(){libCalls++;return function(){return this;};}});assert.throws(()=>B.verifyCity4DispatchedResume({input:i,ledger:freshLibrary}));assert.equal(libCalls,0);
 let endCalls=0;const end=endArgs();Object.defineProperty(end.endReady.final.state.qty,'futureAccessor',{enumerable:true,get(){endCalls++;return 1;}});assert.throws(()=>B.verifyCity4EndAdmission(end));assert.equal(endCalls,0);

});
