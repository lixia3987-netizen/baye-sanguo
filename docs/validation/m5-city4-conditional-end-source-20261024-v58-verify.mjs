/** V58 source-only publication verifier. No tests, browser, game or native input. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {decodeV45Archive,v45ReadBounded,v45Pin,v45Relative,V45_BOUNDS} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
import {OCTOBER_INPUT_PINS,CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN} from '../../scripts/hd-wood-city4-end-input.mjs';
import {verifyOriginalSavePair} from '../../scripts/hd-mobile-system-runtime-oracle.mjs';

export const V58_PREFIX='docs/validation/m5-city4-conditional-end-source-20261024-v58';
export const V58_BUILD='build/impact-skill-20261014/';
export const V58_CODEC='docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs';
export const V58_ATTRIBUTES_APPEND='\n# Conditional city4 END source contracts and inert controller design.\n'+
 ['json','mjs','md'].map(s=>'/'+V58_PREFIX+'*.'+s+' -text whitespace=cr-at-eol\n').join('')+
 ['gz','sav','png'].map(s=>'/'+V58_PREFIX+'*.'+s+' -text\n').join('');
export const V58_EXTERNAL_PINS=Object.freeze([...OCTOBER_INPUT_PINS,...CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN]);
export const V58_INTEGRATED_PATHS=Object.freeze(['scripts/hd-wood-city4-continuation.mjs','scripts/test-hd-wood-city4-continuation.mjs','scripts/hd-wood-city4-end-input.mjs','scripts/test-hd-wood-city4-end-input.mjs','package.json']);
const eq=(a,b,label='Complete typed evidence equality')=>assert.ok(isDeepStrictEqual(a,b),label),pin3=({path,bytes,sha256})=>({path,bytes,sha256});
const clean=s=>s.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''),json=b=>JSON.parse(b.toString('utf8'));
function check(p,b){v45Relative(p.path);assert.ok(Buffer.isBuffer(b),'Complete bytes for '+p.path);eq(v45Pin(p.path,b),pin3(p),'Exact bytes and SHA: '+p.path);return b;}
function bounded(read,p,max=V45_BOUNDS.maxFileBytes){const b=read(p,max);assert.ok(Buffer.isBuffer(b));assert.ok(b.length<=max);return b;}
function summary(b){const s=clean(b.toString('utf8')),out={};for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const m=[...s.matchAll(new RegExp('^(?:#|ℹ) '+k+' ([0-9.]+)\\r?$','gm'))];assert.equal(m.length,1,'One complete Node final summary: '+k);out[k]=Number(m[0][1]);assert.ok(Number.isFinite(out[k]));}return out;}
function sameStats(r,b){const s=summary(b);for(const [k,v]of Object.entries(s))eq(r[k],v,'Raw Node summary matches '+k);return s;}
function zeroes(r){for(const k of ['fail','cancelled','skipped','todo'])assert.equal(r[k],0);}
function sourceArray(a){assert.ok(Array.isArray(a)&&a.length);const seen=new Set();for(const p of a){v45Relative(p.path);assert.ok(!seen.has(p.path),'Unique source path');seen.add(p.path);assert.ok(Number.isInteger(p.bytes)&&p.bytes>=0);assert.match(p.sha256,/^[0-9a-f]{64}$/);}return a;}
function closed(t,exit){eq(t.closed,true);eq(t.exitCode,exit);assert.match(t.terminalChunk,/^[0-9a-f]{6}$/);}
function noInputFacts(){return{sourceOnly:true,newBrowserRuns:0,newGameInputs:0,newPublicLoads:0,newPublicSaves:0,newDistributions:0,newPlunders:0,newMarches:0,newEnd:0,newNaturalMonths:0,newBattleOrders:0,newCombatInputs:0,actualEndAccepted:false,ordinaryEndAccepted:false,actualIncomeObserved:false,actualIncomeAccepted:false,actualBattleAccepted:false,hdAccepted:false,globalHdComplete:false,publishedNewMainInput:false};}

/** Derive the exact current union; historical first-target sources never replace it. */
export function v58CurrentVector(files,C){
 const get=p=>json(check(p,files.get(p.path))),F=get(C.tests.full.receipt),T=get(C.tests.focusedInput.receipt),V=get(C.tests.controllerControls.receipt),m=new Map();
 for(const p of [...sourceArray(F.sources),...sourceArray(T.after),...sourceArray(V.after)]){const q=pin3(p),old=m.get(p.path);if(old)eq(old,q,'Every overlapping current source has identical bytes: '+p.path);else m.set(p.path,q);}
 return [...m.values()].sort((a,b)=>a.path.localeCompare(b.path));
}

export function verifyV58SourceEvidence({files,canonical:C,readCurrent}){
 assert.ok(files instanceof Map);const get=p=>check(p,files.get(p.path)),J=p=>json(get(p)),text=p=>get(p).toString('utf8');
 eq(C.schemaVersion,1);eq(C.prefix,V58_PREFIX);eq(C.kind,'conditional-END-source-only');eq(C.main,{kind:'retained-prior',prefix:'docs/validation/m5-wood-city4-recovery-20261024-v57',inputPins:V58_EXTERNAL_PINS.map(pin3)});
 eq(C.externalInputPins,V58_EXTERNAL_PINS.map(pin3));eq(C.publishedNewMainInput,false);eq(C.globalHdComplete,false);
 for(const p of V58_EXTERNAL_PINS)check(p,bounded(readCurrent,p.path,p.bytes));
 for(const p of files.keys())assert.ok(!V58_EXTERNAL_PINS.some(q=>q.path===p),'P57 nine exact inputs remain external; no old part is repacked');
 const W=json(bounded(readCurrent,OCTOBER_INPUT_PINS[1].path,OCTOBER_INPUT_PINS[1].bytes)),pair={sav0:bounded(readCurrent,OCTOBER_INPUT_PINS[2].path,OCTOBER_INPUT_PINS[2].bytes).toString('hex'),sav1:bounded(readCurrent,OCTOBER_INPUT_PINS[3].path,OCTOBER_INPUT_PINS[3].bytes).toString('hex')};
 assert.equal(verifyOriginalSavePair({...pair,world:W}).ok,true,'Retained P57 current whole world is backed by its real pair');
 const I1=J(C.integration.initial),I2=J(C.integration.current);eq(I1.acceptedForSourceIntegration,true);eq(I2.acceptedForSourceIntegration,true);eq(I2.sourceIntegrationBefore,C.integration.initial);eq(I2.registeredDefaultModules,144);eq(I2.expectedAddedDefaultTests,22);eq(I2.directEndTestsAdded,10);eq(I2.dispatchedInputTestsAdded,12);
 eq(I2.after.map(p=>p.path),V58_INTEGRATED_PATHS);for(const p of I2.after)get(p);eq(C.sourceChanges,I2.after);eq(C.addedFiles,V58_INTEGRATED_PATHS.slice(2,4));
 const oldInput=get(I2.failedInputModule).toString('utf8'),newInput=text(I2.after[2]);
 const expectedInput=oldInput.replace("import {createHash} from 'node:crypto';","import {createHash} from 'node:crypto';\nimport {isDeepStrictEqual} from 'node:util';").replace("const eq=assert.deepStrictEqual,copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex');","// Compare every typed field without constructing a diff of the full saved history.\nconst eq=(a,b,label='Complete typed value equality')=>assert.ok(isDeepStrictEqual(a,b),label),copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex');");
 eq(newInput,expectedInput,'Diagnostic correction preserves all other input and history comparisons');
 for(const p of I2.after)if(p.path!==V58_INTEGRATED_PATHS[2])eq(p,I1.after.find(q=>q.path===p.path),'Only the input diagnostic changes after the first integration');
 eq(I2.focusedProofRejection.tests,1);eq(I2.focusedProofRejection.pass,1);eq(I2.focusedProofRejection.exitCode,0);eq(I2.focusedProofRejection.terminalChunk,'f33350');eq(I2.focusedProofRejection.fileStdoutNotClaimed,true);eq(I2.focusedProofRejection.toolTranscriptIsOriginal,true);assert.ok(!I2.focusedProofRejection.command.includes('--max-old-space-size'));
 const first=J(C.tests.firstTarget.receipt),focus=J(C.tests.focusedInput.receipt),controls=J(C.tests.controllerControls.receipt),full=J(C.tests.full.receipt);
 closed(C.tests.firstTarget.terminal,1);closed(C.tests.focusedInput.terminal,0);closed(C.tests.controllerControls.terminal,0);closed(C.tests.full.terminal,0);
 eq(first.accepted,false);eq(first.sourceBytesStable,true);eq(first.before,first.after);eq([first.positive.processExitCode,first.positive.tests,first.positive.pass,first.positive.fail],[1,223,214,9]);eq(I2.failedFirstTarget,C.tests.firstTarget.receipt);sameStats(first.positive,get(first.positive.stdout));eq(get(first.positive.stderr).length,0);
 const failedRaw=clean(text(first.positive.stdout));assert.match(failedRaw,/not ok 89 - Only the entire dispatched history can supply the current input proof/);assert.match(failedRaw,/RangeError/);assert.match(failedRaw,/Array buffer allocation failed/);
 for(const t of [first,focus]){eq(t.negative.processExitCode,1);eq([t.negative.tests,t.negative.pass,t.negative.fail],[1,0,1]);sameStats(t.negative,get(t.negative.stdout));eq(get(t.negative.stderr).length,0);const raw=text(t.negative.stdout);assert.match(raw,/Conditional END rejects synchronized cursor pollution despite equal fresh pre-END copies/);assert.match(raw,/Missing expected exception/);}
 eq(focus.accepted,true);eq(focus.sourceBytesStable,true);eq(focus.before,focus.after);eq([focus.positive.processExitCode,focus.positive.tests,focus.positive.pass],[0,12,12]);zeroes(focus.positive);sameStats(focus.positive,get(focus.positive.stdout));eq(get(focus.positive.stderr).length,0);eq([focus.addedDefaultTests,focus.registeredDefaultModules],[22,144]);
 eq(controls.accepted,true);eq([controls.processExitCode,controls.tests,controls.pass,controls.maximumActualEnd,controls.executionEnabled],[0,10,10,0,false]);zeroes(controls);sameStats(controls,get(controls.stdout));eq(get(controls.stderr).length,0);eq(controls.sourceBytesStable,true);eq(controls.before,controls.after);
 const freeze=J(C.controllerFreeze);eq(freeze.executionEnabled,false);eq(freeze.maximumActualEnd,0);eq(freeze.controlledTestGroups,10);eq(freeze.defaultRegisteredTestsAdded,0);for(const p of [...freeze.candidates,freeze.test]){get(p);eq(controls.after.find(q=>q.path===p.path),p);}
 const refused=freeze.candidates.find(p=>p.path.endsWith('/run-october-city4-end-v1.mjs'));assert.ok(refused);const runner=text(refused);assert.match(runner,/parseCity4EndCandidateArgs\(args\);assertCity4EndExecutable\(\);throw Error/);assert.doesNotMatch(runner,/from\s*['"]node:(?:fs|child_process|net|http)/);
 eq(full.accepted,true);eq(full.processExitCode,0);eq(full.command,'npm.cmd test');eq(full.CC,'build/toolchain/emsdk/upstream/bin/clang.exe');eq([full.registeredFiles,full.tests,full.pass,full.addedDefaultTests],[144,7860,7860,22]);zeroes(full);sameStats(full,get(full.stdout));eq(get(full.stderr).length,0);eq(full.sourceBytesStable,true);eq(J(full.before).sources,full.sources);eq(full.controllerVmTestsCountedInDefault,false);eq(full.target,C.tests.focusedInput.receipt);eq(full.controls,C.tests.controllerControls.receipt);eq(full.sourceIntegration,C.integration.current);
 for(const k of ['newBrowserRuns','newGameInputs','newPublicLoads','newPublicSaves','newMarches','newEnd'])eq(full[k],0);eq(full.mainInputUnchanged,true);eq(full.globalHdComplete,false);
 const packageNow=J(I2.after[4]),registered=packageNow.scripts.test.split(/\s+/).filter(p=>p.startsWith('scripts/'));eq(registered.length,144);eq(new Set(registered).size,144);eq(registered.at(-1),'scripts/test-hd-wood-city4-end-input.mjs');
 const oldPackage=J(C.originalSources.find(p=>p.path.endsWith('/package.json'))),oldRegistered=oldPackage.scripts.test.split(/\s+/).filter(p=>p.startsWith('scripts/'));eq(registered.slice(0,-1),oldRegistered);eq(oldRegistered.length,143);
 eq((text(I2.after[3]).match(/\btest\('/g)||[]).length,12,'Twelve independent input test declarations');
 const fullRunner=full.sources.find(p=>p.path===V58_BUILD+'run-v58-end-full-v1.mjs');assert.ok(fullRunner);const fullSource=text(fullRunner);assert.match(fullSource,/CC=path\.resolve\('build\/toolchain\/emsdk\/upstream\/bin\/clang\.exe'\)/);assert.match(fullSource,/env:\{\.\.\.process\.env,CC,/);assert.match(fullSource,/\['\/d','\/s','\/c','npm\.cmd test'\]/);assert.doesNotMatch(fullSource,/max-old-space-size/);
 // Three initial originals are explicit immutable artifacts, not attributed to a new game run.
 eq(C.originalSources.map(p=>p.path),['hd-wood-city4-continuation.mjs','test-hd-wood-city4-continuation.mjs','package.json'].map(p=>V58_BUILD+'v58-end-before-v1/'+p));for(const p of C.originalSources)get(p);
 const A=C.attributesEvolution;eq(A.sourceRules,I2.attributesEvolution);eq(A.sourceRules.appendedText,'\n# Dispatched city4 END input and source contracts.\n/scripts/hd-wood-city4-end-input.mjs text eol=lf\n/scripts/test-hd-wood-city4-end-input.mjs text eol=lf\n');eq(A.publication.appendedText,V58_ATTRIBUTES_APPEND);eq(A.publication.before,A.sourceRules.after);eq(full.sources.find(p=>p.path==='.gitattributes'),A.publication.before);eq(focus.after.find(p=>p.path==='.gitattributes'),A.publication.before);eq(first.after.find(p=>p.path==='.gitattributes'),A.sourceRules.before);
 const attrs=check(A.publication.after,bounded(readCurrent,'.gitattributes'));const pubSuffix=Buffer.from(V58_ATTRIBUTES_APPEND);assert.ok(attrs.subarray(-pubSuffix.length).equals(pubSuffix));const atFull=attrs.subarray(0,-pubSuffix.length);check(A.publication.before,atFull);const sourceSuffix=Buffer.from(A.sourceRules.appendedText);assert.ok(atFull.subarray(-sourceSuffix.length).equals(sourceSuffix));check(A.sourceRules.before,atFull.subarray(0,-sourceSuffix.length));get(A.publication.after);
 const current=v58CurrentVector(files,C);eq(C.currentSources,current);const literal=current.filter(p=>p.path.startsWith(V58_BUILD)).map(p=>p.path).sort();eq(C.literalExactIgnored,literal);const missing=[];
 for(const p of current){const expected=p.path==='.gitattributes'?A.publication.after:p;let b=readCurrent(p.path,Math.max(expected.bytes,1));if(b===null){assert.ok(literal.includes(p.path),'Only exact literal B tools may resolve from this archive');b=get(p);missing.push(p.path);}else check(expected,b);if(literal.includes(p.path))get(p);}
 for(const p of C.planPins){check(p,bounded(readCurrent,p.path,p.bytes));get(p);}for(const p of C.supportPins)get(p);
 const facts={...noInputFacts(),currentMain:'P57 genuine saved dispatched world and original pair retained',retainedPriorMainInput:true,sourceAdmissionOnly:true,controllerExecutable:false,conditionalEndSourceReady:true,pureObjectInputContract:'Strict bounded P57 loader output; caller objects do not independently reauthenticate original history bytes',priorHistoryAuthenticationRequiredBeforeExecutableController:true,controllerVmControlsCountedInDefault:false,tests:{firstTarget:{accepted:false,tests:223,pass:214,fail:9,reason:'Full-proof assertion diagnostic allocation failure; original TAP retained'},diagnostic:{tests:1,pass:1,rawFileClaimed:false,terminalChunk:'f33350'},focusedInput:{tests:12,pass:12},full:{tests:7860,pass:7860,registeredModules:144,addedDefaultTests:22,directEndTestsAdded:10,dispatchedInputTestsAdded:12},controllerVm:{tests:10,pass:10,defaultTestsAdded:0}},sources:{current:current.length,literalExactIgnored:literal},retainedInputPins:V58_EXTERNAL_PINS.map(pin3),attributesEvolution:{sourceRulesBytes:sourceSuffix.length,publicationRulesBytes:pubSuffix.length},archiveContainsPriorActualRuns:false,archiveTraversesOldParts:false};
 return{facts,resolvedMissingIgnored:missing.sort(),currentSources:current};
}

export function verifyV58Publication(root=process.cwd(),options={}){
 const readCurrent=options.readCurrent||((p,max)=>{try{return v45ReadBounded(root,p,max);}catch(e){if(e.code==='ENOENT')return null;throw e;}}),readPublic=options.readPublic||((p,max)=>v45ReadBounded(root,p,max));
 const C=json(bounded(readPublic,V58_PREFIX+'.json')),readerBytes=bounded(readPublic,C.reader.path,C.reader.bytes);eq(C.reader.path,V58_PREFIX+'-verify.mjs');check(C.reader,readerBytes);eq(C.codec.path,V58_CODEC);check(C.codec,bounded(readCurrent,C.codec.path,C.codec.bytes));
 eq(C.archive.path,V58_PREFIX+'-archive-index.json');const index=json(check(C.archive,bounded(readPublic,C.archive.path,C.archive.bytes)));for(const p of index.parts)assert.ok(p.path.startsWith(V58_PREFIX+'-archive-part'));const decoded=decodeV45Archive({index,readPart:(p,max)=>bounded(readPublic,p,max)});
 const evidence=verifyV58SourceEvidence({files:decoded.files,canonical:C,readCurrent});eq(C.observations,evidence.facts,'Canonical facts equal independently derived source-only evidence');check(C.markdown,bounded(readPublic,C.markdown.path,C.markdown.bytes));eq(C.markdown.path,V58_PREFIX+'.md');
 return{accepted:true,sourceOnly:true,observations:evidence.facts,resolvedMissingIgnored:evidence.resolvedMissingIgnored,archive:{logicalFiles:decoded.logicalFiles,physicalBlobs:decoded.physicalBlobs,serializedPartBytes:decoded.serializedPartBytes,priorActualFilesRepacked:0},newTestsRunByReader:0,newBrowserRuns:0,newNativeInputs:0,publishedNewMainInput:false,globalHdComplete:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,2,'Read-only verifier accepts no game or execution flags');console.log(JSON.stringify(verifyV58Publication()));
}
