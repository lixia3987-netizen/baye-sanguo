/** Source-only evidence reader. Import and source inspection perform no verification or game action. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {decodeV45Archive,v45ReadBounded,v45Pin,v45Relative,V45_BOUNDS} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
import {OCTOBER_INPUT_PINS,CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN} from '../../scripts/hd-wood-city4-end-input.mjs';
import {verifyOriginalSavePair} from '../../scripts/hd-mobile-system-runtime-oracle.mjs';

export const V59_PREFIX='docs/validation/m5-city4-history-origin-20261024-v59';
export const V59_BUILD='build/impact-skill-20261014/';
export const V59_TOOLS=V59_BUILD+'v59-source-publication/';
export const V59_CODEC='docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs';
export const V59_ATTRIBUTES_APPEND='\n# Complete original city4 history byte authentication.\n'+
 ['json','mjs','md'].map(s=>'/'+V59_PREFIX+'*.'+s+' -text whitespace=cr-at-eol\n').join('')+
 ['gz','sav','png'].map(s=>'/'+V59_PREFIX+'*.'+s+' -text\n').join('');
export const V59_EXTERNAL_PINS=Object.freeze([...OCTOBER_INPUT_PINS,...CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN]);
export const V59_INTEGRATED_PATHS=Object.freeze(['scripts/hd-wood-city4-end-input.mjs','scripts/test-hd-wood-city4-end-input.mjs']);
const eq=(a,b,label='Complete typed evidence equality')=>assert.ok(isDeepStrictEqual(a,b),label),pin3=({path,bytes,sha256})=>({path,bytes,sha256});
const clean=s=>s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''),json=b=>JSON.parse(b.toString('utf8'));
function check(p,b){v45Relative(p.path);assert.ok(Buffer.isBuffer(b),'Complete bytes: '+p.path);eq(v45Pin(p.path,b),pin3(p),'Exact original bytes: '+p.path);return b;}
function bounded(read,p,max=V45_BOUNDS.maxFileBytes){const b=read(p,max);assert.ok(Buffer.isBuffer(b));assert.ok(b.length<=max);return b;}
function summary(b){const s=clean(b.toString('utf8')),out={};for(const k of['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const rows=[...s.matchAll(new RegExp('^(?:#|ℹ) '+k+' ([0-9.]+)\\r?$','gm'))];eq(rows.length,1,'One complete raw Node summary: '+k);out[k]=Number(rows[0][1]);assert.ok(Number.isFinite(out[k]));}return out;}
function sameStats(receipt,bytes){const s=summary(bytes);for(const[k,v]of Object.entries(s))eq(receipt[k],v,'Raw summary matches '+k);return s;}
function zeroes(r){for(const k of['fail','cancelled','skipped','todo'])eq(r[k],0);}
function sourceArray(a){assert.ok(Array.isArray(a)&&a.length);const seen=new Set();for(const p of a){v45Relative(p.path);assert.ok(!seen.has(p.path),'Unique source vector path');seen.add(p.path);assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0);assert.match(p.sha256,/^[0-9a-f]{64}$/);}return a;}
function closed(t,exit){eq(t.closed,true);eq(t.exitCode,exit);assert.ok(Number.isSafeInteger(t.sessionId)&&t.sessionId>0);for(const k of['initialChunk','terminalChunk'])assert.match(t[k],/^[0-9a-f]{6}$/);}
function noInputFacts(){return{sourceOnly:true,newBrowserRuns:0,newNativeInputs:0,newPublicLoads:0,newPublicSaves:0,newMarches:0,newPlunders:0,newDistributions:0,newEnd:0,newNaturalMonths:0,newBattleOrders:0,actualMonthAccepted:false,actualIncomeObserved:false,actualIncomeAccepted:false,actualBattleAccepted:false,hdAccepted:false,globalHdComplete:false,publishedNewMainInput:false,controllerExecutable:false};}

/** All final ignored sources are archived here; diagnostics do not affect canonical facts. */
export function v59CurrentVector(files,C){
 const get=p=>json(check(p,files.get(p.path))),F=get(C.tests.full.receipt),T=get(C.tests.target.receipt),m=new Map();
 for(const p of[...sourceArray(F.sources),...sourceArray(T.after)]){const q=pin3(p),old=m.get(p.path);if(old)eq(old,q,'Overlapping current source: '+p.path);else m.set(p.path,q);}
 return[...m.values()].sort((a,b)=>a.path.localeCompare(b.path));
}

export function verifyV59SourceEvidence({files,canonical:C,readCurrent}){
 assert.ok(files instanceof Map);const get=p=>check(p,files.get(p.path)),J=p=>json(get(p)),text=p=>get(p).toString('utf8');
 eq(C.schemaVersion,1);eq(C.prefix,V59_PREFIX);eq(C.kind,'city4-history-origin-source-only');eq(C.sourceOnly,true);eq(C.publishedNewMainInput,false);eq(C.globalHdComplete,false);
 eq(C.main,{kind:'retained-prior',prefix:'docs/validation/m5-wood-city4-recovery-20261024-v57',inputPins:V59_EXTERNAL_PINS.map(pin3)});eq(C.externalInputPins,V59_EXTERNAL_PINS.map(pin3));
 for(const p of V59_EXTERNAL_PINS)check(p,bounded(readCurrent,p.path,p.bytes));
 for(const p of files.keys())assert.ok(!V59_EXTERNAL_PINS.some(q=>q.path===p),'P57 nine exact references remain external; no old part or large actual is repacked');
 const W=json(bounded(readCurrent,OCTOBER_INPUT_PINS[1].path,OCTOBER_INPUT_PINS[1].bytes)),pair={sav0:bounded(readCurrent,OCTOBER_INPUT_PINS[2].path,OCTOBER_INPUT_PINS[2].bytes).toString('hex'),sav1:bounded(readCurrent,OCTOBER_INPUT_PINS[3].path,OCTOBER_INPUT_PINS[3].bytes).toString('hex')};
 eq(verifyOriginalSavePair({...pair,world:W}).ok,true,'P57 retained whole world and original dual SAV remain valid');

 eq(C.beforeBehavior.path,V59_BUILD+'v59-history-origin-before-v1.json');eq(C.integration.path,V59_BUILD+'v59-origin-source-integration-v2.json');const old=J(C.beforeBehavior),I=J(C.integration);
 eq([old.schemaVersion,old.sourceOnly,old.expectedOldBehaviorObserved,old.semanticVerificationReturned,old.phase,old.originalHistoryBytesIndependentlyAuthenticated],[1,true,true,true,'dispatched',false]);
 eq([old.controlledCharacterizationTests,old.newDefaultTests,old.newBrowserRuns,old.newNativeInputs,old.newPublicSaves,old.newEnd],[1,0,0,0,0,0]);eq(old.sourceBytesUnchanged,true);eq(old.actualMonthAccepted,false);eq(old.hdAccepted,false);
 eq(I.acceptedForSourceIntegration,true);eq(I.sourceOnly,true);eq(I.after.map(p=>p.path),V59_INTEGRATED_PATHS);eq(I.before.map(p=>p.path),V59_INTEGRATED_PATHS);eq([I.registeredDefaultModules,I.expectedAddedDefaultTests,I.priorInputTests,I.expectedInputTests,I.rawOriginInputs],[144,9,12,21,8]);
 for(const p of I.after)get(p);eq(C.sourceChanges,I.after);eq(I.candidates.length,2);for(const p of I.candidates)get(p);get(I.integrator);
 eq(C.originalSources.map(p=>p.path),['hd-wood-city4-end-input.mjs','test-hd-wood-city4-end-input.mjs'].map(p=>V59_BUILD+'v59-origin-before-v1/'+p));
 for(let i=0;i<2;i++)get(C.originalSources[i]);eq(old.source,{path:V59_INTEGRATED_PATHS[0],bytes:C.originalSources[0].bytes,sha256:C.originalSources[0].sha256});
 const relocations=[],candidate=text(I.candidates[0]),integrated=candidate.replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,q,p)=>{const absolute=path.posix.normalize(path.posix.join(path.posix.dirname(I.candidates[0].path),p));let target=path.posix.relative('scripts',absolute);if(!target.startsWith('.'))target='./'+target;relocations.push({before:p,after:target});return'from '+q+target+q;});
 eq(relocations,I.relocations);eq(text(I.after[0]),integrated,'Current module is the whole reviewed candidate with only recorded relative-import relocation');eq(get(I.after[1]),get(I.candidates[1]),'Current tests exactly equal the reviewed test candidate');
 assert.match(integrated,/export function verifyCity4DispatchedOrigin/);assert.match(integrated,/originAuthenticated:true/);assert.match(integrated,/originBytes/);eq((text(I.after[1]).match(/\btest\('/g)||[]).length,21);
 for(const k of['newTestsExecuted','newNativeInputs','newBrowserRuns','newPublicSaves','newEnd'])eq(I[k],0);eq(I.publishedNewMainInput,false);eq(I.globalHdComplete,false);

 eq(C.tests.target.receipt.path,V59_BUILD+'v59-origin-target-v2.json');eq(C.tests.full.receipt.path,V59_BUILD+'v59-origin-full-v2.json');closed(C.tests.target.terminal,0);closed(C.tests.full.terminal,0);
 const T=J(C.tests.target.receipt),F=J(C.tests.full.receipt);eq(T.accepted,true);eq(T.sourceOnly,true);eq(T.sourceBytesStable,true);eq(T.before,T.after);sourceArray(T.after);
 eq([T.positive.processExitCode,T.positive.tests,T.positive.pass],[0,21,21]);zeroes(T.positive);sameStats(T.positive,get(T.positive.stdout));eq(get(T.positive.stderr).length,0);
 eq([T.negative.processExitCode,T.negative.tests,T.negative.pass,T.negative.fail],[1,1,0,1]);for(const k of['cancelled','skipped','todo'])eq(T.negative[k],0);sameStats(T.negative,get(T.negative.stdout));eq(get(T.negative.stderr).length,0);
 const negative=clean(text(T.negative.stdout));assert.match(negative,/not ok 1 - Dispatched history rejects a caller-added unknown field/);assert.match(negative,/Missing expected exception/);assert.match(negative,/ERR_ASSERTION/);
 eq(C.failedTarget.path,V59_BUILD+'v59-origin-target-v1.json');const failed=J(C.failedTarget);eq(failed.accepted,false);eq(failed.sourceOnly,true);eq(failed.sourceBytesStable,true);eq(failed.before,failed.after);
 eq([failed.positive.processExitCode,failed.positive.tests,failed.positive.pass,failed.positive.fail],[1,21,1,20]);for(const k of['cancelled','skipped','todo'])eq(failed.positive[k],0);sameStats(failed.positive,get(failed.positive.stdout));eq(get(failed.positive.stderr).length,0);assert.ok(/Complete original historical JSON data: bounded object fields/.test(clean(text(failed.positive.stdout))),'Preserved first-target raw failure reports the original finite object-field bound');
 eq([failed.negative.processExitCode,failed.negative.tests,failed.negative.pass,failed.negative.fail],[1,1,0,1]);sameStats(failed.negative,get(failed.negative.stdout));eq(get(failed.negative.stderr).length,0);assert.match(text(failed.negative.stdout),/Missing expected exception/);
 for(const p of sourceArray(failed.after))if(p.path.startsWith(V59_BUILD))get(p);
 eq(C.sourceBoundMeasurement.path,V59_BUILD+'v59-origin-json-bounds-v1.json');const measured=J(C.sourceBoundMeasurement);eq(measured.sourceOnly,true);eq(measured.oldBoundTooSmall,true);eq(measured.oldMaximumJsonNodes,2000000);eq(measured.totalNodes,2184388);eq(measured.maxDepth,21);eq(measured.rows.find(r=>r.role==='history').nodes,2099969);eq(measured.sourceBytesUnchanged,true);
 eq(measured.rows.reduce((n,r)=>n+r.nodes,0),measured.totalNodes);for(const p of measured.inputs){const external=V59_EXTERNAL_PINS.find(q=>q.path===p.path);assert.ok(external);eq(p,pin3(external));}for(const k of['newNativeInputs','newTestsExecuted','newBrowserRuns'])eq(measured[k],0);
 const limit=[...integrated.matchAll(/maximumJsonNodes\s*:\s*([0-9]+)/g)];eq(limit.length,1);eq(Number(limit[0][1]),3000000);assert.ok(measured.totalNodes>measured.oldMaximumJsonNodes&&measured.totalNodes<=3000000,'The complete genuine originals fit the new finite bound without field omission');
 eq([T.previousInputTests,T.currentInputTests,T.addedDefaultTests,T.registeredDefaultModules,T.rawOriginInputs],[12,21,9,144,8]);
 for(const p of I.after)eq(T.after.find(q=>q.path===p.path),p);
 eq(F.accepted,true);eq(F.sourceOnly,true);eq([F.processExitCode,F.tests,F.pass,F.registeredFiles,F.addedDefaultTests],[0,7869,7869,144,9]);zeroes(F);sameStats(F,get(F.stdout));eq(get(F.stderr).length,0);eq(F.sourceBytesStable,true);eq(J(F.before).sources,F.sources);
 eq(F.command,'npm.cmd test');eq(F.CC,'build/toolchain/emsdk/upstream/bin/clang.exe');eq(F.target,C.tests.target.receipt);eq(F.sourceIntegration,C.integration);eq([F.originalSourceOnlyInputTests,F.rawOriginSourceTests,F.rootCharacterizationTestNotCountedInDefault],[12,9,true]);
 const prior=J(F.priorFull);eq([prior.accepted,prior.tests,prior.pass,prior.registeredFiles],[true,7860,7860,144]);zeroes(prior);sameStats(prior,get(prior.stdout));eq(get(prior.stderr).length,0);eq(prior.sourceBytesStable,true);
 for(const r of[T,F]){for(const k of['newBrowserRuns','newNativeInputs','newPublicSaves','newMarches','newEnd'])eq(r[k],0);eq(r.publishedNewMainInput,false);eq(r.globalHdComplete,false);}eq(F.newPublicLoads,0);eq(F.mainInputUnchanged,true);
 const pkg=J(I.packageUnchanged),registered=pkg.scripts.test.split(/\s+/).filter(p=>p.startsWith('scripts/'));eq(registered.length,144);eq(new Set(registered).size,144);eq(registered.at(-1),'scripts/test-hd-wood-city4-end-input.mjs');eq(F.sources.find(p=>p.path==='package.json'),I.packageUnchanged);
 const fullRunner=F.sources.find(p=>p.path===V59_BUILD+'run-v59-origin-full-v2.mjs');assert.ok(fullRunner);const fullSource=text(fullRunner);assert.match(fullSource,/CC=path\.resolve\('build\/toolchain\/emsdk\/upstream\/bin\/clang\.exe'\)/);assert.match(fullSource,/env:\{\.\.\.process\.env,CC,/);assert.match(fullSource,/\['\/d','\/s','\/c','npm\.cmd test'\]/);assert.doesNotMatch(fullSource,/max-old-space-size/);

 const A=C.attributesEvolution;eq(A.appendedText,V59_ATTRIBUTES_APPEND);eq(A.before,I.attributesUnchanged);eq(F.sources.find(p=>p.path==='.gitattributes'),A.before);eq(T.after.find(p=>p.path==='.gitattributes'),A.before);
 const attrs=check(A.after,bounded(readCurrent,'.gitattributes')),suffix=Buffer.from(V59_ATTRIBUTES_APPEND);assert.ok(attrs.subarray(-suffix.length).equals(suffix));check(A.before,attrs.subarray(0,-suffix.length));get(A.after);
 const current=v59CurrentVector(files,C);eq(C.currentSources,current);const literal=current.filter(p=>p.path.startsWith(V59_BUILD)).map(p=>p.path).sort();eq(C.literalExactIgnored,literal);const missing=[];
 for(const p of current){const expected=p.path==='.gitattributes'?A.after:p;let b=readCurrent(p.path,Math.max(expected.bytes,1));if(b===null){assert.ok(literal.includes(p.path),'Only this exact literal B source may fall back to this archive');b=get(p);missing.push(p.path);}else check(expected,b);if(literal.includes(p.path))get(p);}
 eq(C.planPins.map(p=>p.path).sort(),['docs/hd-development-plan.md','docs/hd-remaining-work.md']);for(const p of C.planPins){check(p,bounded(readCurrent,p.path,p.bytes));get(p);}for(const p of C.supportPins)get(p);
 const facts={...noInputFacts(),retainedCurrentMain:'P57 genuine saved dispatched world and original dual SAV',retainedPriorMainInput:true,rawOriginRequiredByDefault:true,rawOriginInputFiles:8,rawProofRetention:'In-memory exact original buffers; old actual files and archive parts are not copied into this publication',unknownFieldsPreservedAndBound:true,tests:{oldBehavior:{controlledCharacterizations:1,oldUnknownFieldAccepted:true,countedInDefault:false},failedTarget:{tests:21,pass:1,fail:20,accepted:false,reason:'Original 2,000,000 JSON-node bound rejected the complete genuine history'},target:{tests:21,pass:21,oldSourceNegative:{tests:1,pass:0,fail:1}},full:{tests:7869,pass:7869,registeredModules:144,addedDefaultTests:9,previousInputTests:12,currentInputTests:21}},sourceBounds:{originalAggregateNodes:2184388,originalHistoryNodes:2099969,originalMaxDepth:21,oldLimit:2000000,currentLimit:3000000},sources:{current:current.length,literalExactIgnored:literal},retainedInputPins:V59_EXTERNAL_PINS.map(pin3),attributesAppendBytes:suffix.length,priorActualFilesRepacked:0,archiveTraversesOldParts:false};
 return{facts,resolvedMissingIgnored:missing.sort(),currentSources:current};
}

export function verifyV59Publication(root=process.cwd(),options={}){
 const readCurrent=options.readCurrent||((p,max)=>{try{return v45ReadBounded(root,p,max);}catch(e){if(e.code==='ENOENT')return null;throw e;}}),readPublic=options.readPublic||((p,max)=>v45ReadBounded(root,p,max));
 const C=json(bounded(readPublic,V59_PREFIX+'.json'));eq(C.reader.path,V59_PREFIX+'-verify.mjs');check(C.reader,bounded(readPublic,C.reader.path,C.reader.bytes));eq(C.codec.path,V59_CODEC);check(C.codec,bounded(readCurrent,C.codec.path,C.codec.bytes));
 eq(C.archive.path,V59_PREFIX+'-archive-index.json');const index=json(check(C.archive,bounded(readPublic,C.archive.path,C.archive.bytes)));for(const p of index.parts)assert.ok(p.path.startsWith(V59_PREFIX+'-archive-part'));
 const decoded=decodeV45Archive({index,readPart:(p,max)=>bounded(readPublic,p,max)}),evidence=verifyV59SourceEvidence({files:decoded.files,canonical:C,readCurrent});eq(C.observations,evidence.facts,'Canonical source facts are stable across present/missing ignored tools');
 eq(C.markdown.path,V59_PREFIX+'.md');check(C.markdown,bounded(readPublic,C.markdown.path,C.markdown.bytes));return{accepted:true,sourceOnly:true,observations:evidence.facts,resolvedMissingIgnored:evidence.resolvedMissingIgnored,archive:{logicalFiles:decoded.logicalFiles,physicalBlobs:decoded.physicalBlobs,serializedPartBytes:decoded.serializedPartBytes,priorActualFilesRepacked:0},newTestsRunByReader:0,newNativeInputs:0,newBrowserRuns:0,publishedNewMainInput:false,globalHdComplete:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){assert.equal(process.argv.length,2,'Read-only source verifier takes no game flags');console.log(JSON.stringify(verifyV59Publication()));}
