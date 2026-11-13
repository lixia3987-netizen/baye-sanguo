// Unregistered controlled tests. Importing this file under node --test later
// will exercise real candidate exports, a fixed fake CDP, and real owned files.
// The author has not imported the candidate, run these tests, or used a browser.
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createCity4OriginBoundAnchorAdapter,assertCity4OriginBoundAnchorCapability,CITY4_ORIGIN_ANCHOR_READINESS} from './hd-wood-city4-origin-anchor.mjs';
import {readCity4DispatchedInput,verifyCity4DispatchedResume,OCTOBER_INPUT_PINS,CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN} from './hd-wood-city4-end-input.mjs';
import {createControlledAnchorCdp} from './fixtures/hd-wood-city4-anchor-cdp.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'build/impact-skill-20261014'),runs=path.join(base,'city4-origin-anchor-controlled-files-v2');
const tags=Object.freeze({resume:'wood67-131-v60-controlled-origin-resume',failed:'wood67-131-v60-controlled-origin-failed',settled:'wood67-131-v60-controlled-origin-settled'});
const copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex');
let genuine,happyPromise;
const input=()=>genuine??=readCity4DispatchedInput(root);
function directory(label){fs.mkdirSync(runs,{recursive:true});return fs.mkdtempSync(path.join(runs,label+'-'));}
function setup(label,transportOptions={},extra={}){
 const transport=createControlledAnchorCdp(input(),transportOptions),artifactDirectory=directory(label);
 const adapter=createCity4OriginBoundAnchorAdapter({root,artifactDirectory,session:transport.session,cdp:transport.cdp,saveTags:tags,...extra});
 return{adapter,transport,artifactDirectory};
}
async function happy(){
 return happyPromise??=(async()=>{const x=setup('happy');x.capability=await x.adapter.loadAndFreshAnchor();return x;})();
}
function revalidate(x,capability=x.capability,session=x.transport.session,cdp=x.transport.cdp){return assertCity4OriginBoundAnchorCapability(capability,{session,cdp});}
function assertNoCleanup(x){assert.equal(x.transport.stats().closeCalls,0);assert.equal(x.adapter.status().cleanupAuthorized,false);assert.equal(x.adapter.status().maximumActualEnd,0);}

test('Raw-origin anchor uses actual exports, retained same-Node capability and exclusive files under a controlled transport', {timeout:900000},async t=>{
 await t.test('factory is inert, disallows alternate source flags, and does not call option accessors',()=>{
  const cdp={send(){throw Error('Factory may not call CDP');}},session={identity:{},cdp};
  const options={root,artifactDirectory:path.join(base,'does-not-exist-controlled-inert-directory'),session,cdp,saveTags:tags};
  const a=createCity4OriginBoundAnchorAdapter(options);assert.equal(a.status().started,false);assert.equal(a.status().retainedOriginalRawBytes,false);assert.equal(a.readiness.maximumActualEnd,0);assert.deepEqual(a.readiness,CITY4_ORIGIN_ANCHOR_READINESS);
  assert.throws(()=>a.copyRetainedOriginBytes(),/No raw input/);
  for(const [key,value]of [['input',{}],['originAuthenticated',true],['executionEnabled',true],['maximumActualEnd',1]])assert.throws(()=>createCity4OriginBoundAnchorAdapter({...options,[key]:value}),/No alternate input/);
  let invoked=0;const dirty={...options};Object.defineProperty(dirty,'readFile',{enumerable:true,get(){invoked++;throw Error('Must not be invoked');}});assert.throws(()=>createCity4OriginBoundAnchorAdapter(dirty),/accessor/);assert.equal(invoked,0);
  assert.throws(()=>createCity4OriginBoundAnchorAdapter({...options,artifactDirectory:path.join(root,'docs')}),/separate child/);
 });

 await t.test('all nine external named inputs reject an independent one-byte substitution before any CDP call',async()=>{
  const external=[...OCTOBER_INPUT_PINS,...CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN];assert.equal(external.length,9);
  for(let index=0;index<external.length;index++){
   const target=external[index],seen=[],cdp={send(){throw Error('Corrupt original must reject before CDP');}},session={identity:{index},cdp};
   const adapter=createCity4OriginBoundAnchorAdapter({root,artifactDirectory:path.join(base,'uncreated-corrupt-input-'+index),session,cdp,saveTags:tags,readFile:p=>{seen.push(p);const b=fs.readFileSync(path.join(root,p));if(p===target.path)b[0]^=1;return b;}});
   await assert.rejects(adapter.loadAndFreshAnchor(),/Exact P57 bytes\/SHA/);assert.ok(seen.includes(target.path));assert.equal(adapter.status().started,true);assert.equal(adapter.status().phase,'failed-same-live-session-retained');const original=adapter.status().originalError;
   assert.ok(original instanceof Error);const count=seen.length;await assert.rejects(adapter.loadAndFreshAnchor(),/No retry/);assert.equal(seen.length,count);assert.equal(adapter.status().originalError,original);assert.equal(adapter.status().maximumActualEnd,0);
  }
 });

 await t.test('same session identity, CDP object and send function are bound before the loader starts',async()=>{
  for(const which of ['identity','cdp','send']){
   let reads=0;const cdp={send(){throw Error('Same-live guard must precede transport');}},session={identity:{},cdp};
   const adapter=createCity4OriginBoundAnchorAdapter({root,artifactDirectory:path.join(base,'uncreated-capability-'+which),session,cdp,saveTags:tags,readFile(){reads++;throw Error('Same-live guard must precede source reads');}});
   if(which==='identity')session.identity={};else if(which==='cdp')session.cdp={send:cdp.send};else cdp.send=()=>{};
   await assert.rejects(adapter.loadAndFreshAnchor(),/Exact original Node/);assert.equal(reads,0);assert.equal(adapter.status().started,true);await assert.rejects(adapter.loadAndFreshAnchor(),/No retry/);assert.equal(reads,0);
  }
 });

 await t.test('real wx collision preserves the preexisting bytes, thrown identity, zero inputs, and single-use failure',async()=>{
  const x=setup('wx-collision'),file=path.join(x.artifactDirectory,'origin-bound-anchor-admission.json'),original=Buffer.from('controlled collision sentinel\n');fs.writeFileSync(file,original,{flag:'wx'});
  let error;try{await x.adapter.loadAndFreshAnchor();}catch(e){error=e;}assert.equal(error?.code,'EEXIST');assert.equal(x.adapter.status().originalError,error);assert.deepEqual(fs.readFileSync(file),original);assert.equal(x.transport.calls.length,0);assert.equal(x.adapter.status().originalAnchorReport,null);
  await assert.rejects(x.adapter.loadAndFreshAnchor(),/No retry/);assert.deepEqual(fs.readFileSync(file),original);assertNoCleanup(x);
 });

 await t.test('the successful controlled seven-key path returns the genuine branded capability and real descriptor-readback pins',async()=>{
  const x=await happy(),c=x.capability,p=revalidate(x);assert.equal(p.originAuthenticated,true);assert.equal(p.resumeEpochEstablished,true);assert.equal(p.maximumActualEnd,0);assert.equal(p.cleanupAuthorized,false);
  assert.equal(c.session,x.transport.session);assert.equal(c.cdp,x.transport.cdp);assert.equal(c.sameSession,x.transport.session.identity);assert.equal(c.currentMainSource,'P57_genuine_saved_dispatch');assert.equal(x.adapter.status().phase,'fresh-anchor-qualified-pre-observer');
  assert.deepEqual(x.transport.keys.map(k=>k.code),[35,39,39,40,35,39,39]);assert.equal(x.transport.dispatches.length,14);assert.equal(c.report.nativeSaveCommitAttempts.length,1);assert.equal(c.report.nativeSaveCommitAttempts[0].dispatchOutcome,'keyDown-and-keyUp-returned');
  assert.deepEqual(c.anchorSave.publicSave.after.world,input().world);assert.deepEqual(c.anchorSave.publicPair,input().pair);assert.equal(c.preEndObserverIdentity.observerExpected,false);assert.equal(c.preEndObserverIdentity.postEndReader,false);
  const pins=c.exclusiveArtifactPins();assert.equal(new Set(pins.map(p=>p.file)).size,pins.length);for(const name of ['origin-bound-anchor-admission.json','origin-bound-anchor-qualified.json','end-anchor-report.json','city4-end-resume-ledger-candidate.json'])assert.ok(pins.some(p=>p.file===name));assert.ok(pins.some(p=>p.file.startsWith('stable-ticket-')));
  for(const p of pins){const bytes=fs.readFileSync(path.join(x.artifactDirectory,p.file));assert.equal(bytes.length,p.bytes);assert.equal(sha(bytes),p.sha256);}
  for(let i=0;i<2;i++){const file='native-'+tags.resume+'-sango'+i+'.sav';assert.deepEqual(fs.readFileSync(path.join(x.artifactDirectory,file)),Buffer.from(input().pair['sav'+i],'hex'));}
  assertNoCleanup(x);
 });

 await t.test('serialized, lookalike, foreign session and rebound CDP capabilities cannot borrow the private module brand',async()=>{
  const x=await happy(),c=x.capability;
  assert.throws(()=>revalidate(x,{...c}),/original live capability/);assert.throws(()=>revalidate(x,{currentMainSource:c.currentMainSource,originProof:{originAuthenticated:true}}),/original live capability/);
  assert.throws(()=>revalidate(x,c,{identity:c.sameSession,cdp:c.cdp}),/alternate session/);assert.throws(()=>revalidate(x,c,c.session,{send:c.cdp.send}),/alternate session/);
  const old=c.cdp.send;try{c.cdp.send=async()=>({});assert.throws(()=>revalidate(x),/Exact original Node/);}finally{c.cdp.send=old;}
  assert.equal(revalidate(x).originAuthenticated,true);assertNoCleanup(x);
 });

 await t.test('all eight disclosed raw roles are reauthenticated independently and defensive copies cannot become authority',async()=>{
  const x=await happy(),c=x.capability,roles=['publication','world','sav0','sav1','ledger','final','publicSave','library'];assert.deepEqual(Object.keys(c.originBytes),roles);
  const extra=x.adapter.copyRetainedOriginBytes();assert.notEqual(extra.publication,c.originBytes.publication);extra.publication[0]^=1;assert.equal(revalidate(x).originAuthenticated,true);
  for(const role of roles){const raw=c.originBytes[role],old=raw[0];try{raw[0]^=1;assert.throws(()=>revalidate(x),/Exact P57 bytes\/SHA/);}finally{raw[0]=old;}}
  assert.equal(revalidate(x).originAuthenticated,true);assertNoCleanup(x);
 });

 await t.test('a consistent unknown field still passes the whole semantic Resume but is rejected by the private captured fresh-ledger graph',async()=>{
  const x=await happy(),c=x.capability,r=c.ledger.resume;
  const tickets=new Set([c.loadedTicket,r.loadedTicket,...['before','beforeChoice','beforeRecord','after'].flatMap(k=>[c.anchorSave.publicSave[k],r.publicSave[k]])]);
  for(const ticket of tickets){assert.equal(Object.hasOwn(ticket.state,'controlledUnknownCapturedField'),false);ticket.state.controlledUnknownCapturedField={sourceOnly:true,unmeasured:true};}
  try{
   assert.equal(verifyCity4DispatchedResume({input:input(),ledger:c.ledger,saveTags:tags}).accepted,true,'The control specifically preserves the complete semantic contract');
   assert.throws(()=>revalidate(x),/Entire captured fresh ledger remains unchanged/);
  }finally{for(const ticket of tickets)delete ticket.state.controlledUnknownCapturedField;}
  assert.equal(revalidate(x).originAuthenticated,true);assertNoCleanup(x);
 });

 await t.test('original shared SAVE array and complete first reservation cannot be replaced, edited, removed or expanded past two',async()=>{
  const x=await happy(),c=x.capability,report=c.report,rows=report.nativeSaveCommitAttempts,row=rows[0];
  try{report.nativeSaveCommitAttempts=[copy(row)];assert.throws(()=>revalidate(x),/append-only SAVE attempt array/);}finally{report.nativeSaveCommitAttempts=rows;}
  try{rows[0]=copy(row);assert.throws(()=>revalidate(x),/reservation object cannot be replaced/);}finally{rows[0]=row;}
  const old=row.keysBefore;try{row.keysBefore++;assert.throws(()=>revalidate(x),/spent anchor reservation cannot be edited/);}finally{row.keysBefore=old;}
  try{rows.length=0;assert.throws(()=>revalidate(x),/at most two/);}finally{rows.push(row);}
  try{rows.push({ordinal:2,controlledReservationOnly:true});assert.equal(revalidate(x).originAuthenticated,true);rows.push({ordinal:3,controlledReservationOnly:true});assert.throws(()=>revalidate(x),/at most two/);}finally{rows.splice(1);}
  assert.equal(revalidate(x).originAuthenticated,true);assertNoCleanup(x);
 });

 await t.test('pre-observer readers retire after a terminal reservation and reject a current observer/owner change',async()=>{
  const x=await happy(),c=x.capability,rows=c.report.nativeSaveCommitAttempts;
  const beforeCalls=x.transport.calls.length;rows.push({ordinal:2,controlledReservationOnly:true});try{await assert.rejects(c.readPreEndTicket('controlled post-reservation refusal'),/Pre-install reader retires/);}finally{rows.pop();}
  assert.ok(x.transport.calls.length>beforeCalls,'The model supplied the actual current ticket before the reader rejected');
  const measured=x.transport.stages.after,oldObserver=copy(measured.meta.v32HookFence.observer);
  try{measured.meta.v32HookFence.observer={name:'willExecuteOrder',present:true,sameFunction:false,originalUndefined:true,functionSource:'controlled wrong observer'};await assert.rejects(c.readPreEndTicket('controlled wrong current observer'),error=>error instanceof Error);}finally{measured.meta.v32HookFence.observer=oldObserver;}
  const oldKeys=measured.state.keys;try{measured.state.keys++;await assert.rejects(c.readPreEndTicket('controlled undeclared current key'),/No undeclared native input/);}finally{measured.state.keys=oldKeys;}
  const current=await c.readPreEndProtected();assert.deepEqual(current.pair,c.anchorSave.publicPair);assert.deepEqual(current.ticket,c.anchorSave.publicSave.after);
  const afterCalls=x.transport.calls.length;await assert.rejects(x.adapter.loadAndFreshAnchor(),/No retry/);assert.equal(x.transport.calls.length,afterCalls);assertNoCleanup(x);
 });

 await t.test('an ambiguous last keyDown spends the anchor reservation before transport throws and cannot retry',async()=>{
  let adapter,observedReservation;const original=new Error('controlled last SAVE keyDown transport failure');
  const x=setup('unknown-commit',{failDispatchIndex:6,dispatchError:original,beforeDispatch({index}){if(index===6){const r=adapter.status().originalAnchorReport;observedReservation=copy(r.nativeSaveCommitAttempts);}}});adapter=x.adapter;
  let thrown;try{await adapter.loadAndFreshAnchor();}catch(e){thrown=e;}assert.equal(thrown,original);assert.equal(adapter.status().originalError,original);assert.equal(observedReservation.length,1);assert.equal(observedReservation[0].reservedBeforeKeyDown,true);assert.equal(observedReservation[0].dispatchOutcome,'unknown');
  const report=adapter.status().originalAnchorReport;assert.equal(report.nativeSaveCommitAttempts.length,1);assert.equal(report.nativeSaveCommitAttempts[0].dispatchOutcome,'unknown');assert.equal(report.anchorQualified,false);assert.equal(x.transport.keys.length,6);
  const dispatches=x.transport.dispatches.length;await assert.rejects(adapter.loadAndFreshAnchor(),/No retry/);assert.equal(x.transport.dispatches.length,dispatches);assert.equal(report.nativeSaveCommitAttempts.length,1);assertNoCleanup(x);
 });

 await t.test('new native-anchor diagnostics never invoke thrown getters or coercion and preserve the original throw when the failure sink also rejects',async()=>{
  let diagnosticGets=0,coercions=0,sinkGets=0,adapter;const original={},sinkError={};
  for(const key of ['stack','message']){
   Object.defineProperty(original,key,{enumerable:true,get(){diagnosticGets++;throw Error('Original getter must never run');}});
   Object.defineProperty(sinkError,key,{enumerable:true,get(){sinkGets++;throw Error('Sink getter must never run');}});
  }
  Object.defineProperty(original,Symbol.toPrimitive,{value(){coercions++;throw Error('Original coercion must never run');}});
  Object.defineProperty(sinkError,Symbol.toPrimitive,{value(){coercions++;throw Error('Sink coercion must never run');}});
  const x=setup('diagnostic-getters',{failDispatchIndex:6,dispatchError:original}),failureFile=path.join(x.artifactDirectory,'end-anchor-failure-report.json'),open=fsPromises.open;adapter=x.adapter;
  const spy=mock.method(fsPromises,'open',async function(file,...rest){if(path.resolve(String(file))===failureFile)throw sinkError;return open.call(this,file,...rest);});
  let thrown;try{await adapter.loadAndFreshAnchor();}catch(error){thrown=error;}finally{spy.mock.restore();}
  assert.equal(thrown,original);assert.equal(adapter.status().originalError,original);assert.equal(diagnosticGets,0);assert.equal(sinkGets,0);assert.equal(coercions,0);
  const report=adapter.status().originalAnchorReport;assert.equal(report.nativeSaveCommitAttempts.length,1);assert.equal(report.nativeSaveCommitAttempts[0].dispatchOutcome,'unknown');assert.ok(report.failureEvidenceError);assert.equal(x.transport.keys.length,6);
  const before=x.transport.calls.length;await assert.rejects(adapter.loadAndFreshAnchor(),/No retry/);assert.equal(x.transport.calls.length,before);assertNoCleanup(x);
 });

 await t.test('a Proxy thrown by the controlled first CDP read is preserved with zero diagnostic trap calls and no native key',async()=>{
  let traps=0,readAttempts=0;const original=new Proxy({},Object.fromEntries(['get','ownKeys','getPrototypeOf','getOwnPropertyDescriptor'].map(name=>[name,()=>{traps++;throw Error('Proxy diagnostic trap must never run');}])));
  const transport=createControlledAnchorCdp(input()),send=transport.cdp.send;transport.cdp.send=async(method,params)=>{if(method==='Runtime.evaluate'){readAttempts++;throw original;}return send(method,params);};
  const adapter=createCity4OriginBoundAnchorAdapter({root,artifactDirectory:directory('diagnostic-proxy'),session:transport.session,cdp:transport.cdp,saveTags:tags});
  let thrown;try{await adapter.loadAndFreshAnchor();}catch(error){thrown=error;}assert.equal(thrown,original);assert.equal(adapter.status().originalError,original);assert.equal(traps,0);assert.equal(readAttempts,1);assert.equal(transport.keys.length,0);assert.equal(adapter.status().originalAnchorReport.nativeSaveCommitAttempts.length,0);assert.equal(adapter.status().cleanupAuthorized,false);assert.equal(transport.stats().closeCalls,0);
 });

 await t.test('a real owned descriptor read failure after completed SAVE preserves files, original failure identity and the spent reservation',async()=>{
  const x=setup('descriptor-read-failure'),target=path.join(x.artifactDirectory,'origin-bound-anchor-qualified.json'),open=fsPromises.open;let injected=false,observedReadFailure=null;
  const spy=mock.method(fsPromises,'open',async function(file,flags,...rest){
   const handle=await open.call(this,file,flags,...rest);if(path.resolve(String(file))!==target)return handle;
   assert.equal(flags,'wx+');injected=true;
   // The candidate still performs the real exclusive write/sync/stat. Closing
   // only this owned fixture descriptor makes its actual subsequent read fail.
   return{writeFile:handle.writeFile.bind(handle),sync:handle.sync.bind(handle),stat:handle.stat.bind(handle),async read(...args){await handle.close();try{return await handle.read(...args);}catch(error){observedReadFailure=error;throw error;}},close:handle.close.bind(handle)};
  });
  let thrown;try{await x.adapter.loadAndFreshAnchor();}catch(error){thrown=error;}finally{spy.mock.restore();}
  assert.equal(injected,true);assert.ok(observedReadFailure instanceof Error);assert.equal(thrown,observedReadFailure);assert.equal(x.adapter.status().originalError,observedReadFailure);assert.equal(x.adapter.status().completed,false);
  const written=JSON.parse(fs.readFileSync(target,'utf8'));assert.equal(written.genuineAnchorWholeWorldAndPairQualified,true);assert.equal(written.maximumActualEnd,0);
  const report=x.adapter.status().originalAnchorReport;assert.equal(report.nativeSaveCommitAttempts.length,1);assert.equal(report.nativeSaveCommitAttempts[0].dispatchOutcome,'keyDown-and-keyUp-returned');assert.equal(x.transport.keys.length,7);
  for(let i=0;i<2;i++)assert.deepEqual(fs.readFileSync(path.join(x.artifactDirectory,'native-'+tags.resume+'-sango'+i+'.sav')),Buffer.from(input().pair['sav'+i],'hex'));
  const before=x.transport.calls.length;await assert.rejects(x.adapter.loadAndFreshAnchor(),/No retry/);assert.equal(x.transport.calls.length,before);assertNoCleanup(x);
 });
});
