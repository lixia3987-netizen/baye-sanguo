// Source candidate only. Import and factory are inert; no runner or END is provided.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual,types as utilTypes} from 'node:util';
import {
 readCity4DispatchedInput,verifyCity4DispatchedOrigin,
 verifyCity4DispatchedHistory,verifyCity4DispatchedResume,stripCity4EndRuntime,assertCity4EndSaveTags,
 OCTOBER_INPUT_PINS,CITY4_HISTORY_INPUT_PINS,CITY4_END_ARCHIVED_PINS,CITY4_END_LIBRARY_PIN
} from './hd-wood-city4-end-input.mjs';
import {verifyCity4Ticket} from './hd-wood-city4-continuation.mjs';
import {createCity4EndNativeAnchorAdapter} from './hd-wood-city4-anchor-runtime.mjs';

const eq=(a,b,label)=>assert.ok(isDeepStrictEqual(a,b),label),copy=structuredClone;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAIN_SOURCE='P57_genuine_saved_dispatch';
const ORIGIN_ROLES=Object.freeze(['publication','world','sav0','sav1','ledger','final','publicSave','library']);
const SAME_NODE=Object.freeze({kind:'private-same-Node-origin-anchor-capability'});
const boundAnchors=new WeakMap();
const noCredit=()=>({sourceOnly:true,actualEndAccepted:false,actualMonthAccepted:false,
 actualSupplyIncomeAccepted:false,actualBattleAccepted:false,actualCastAccepted:false,
 hdAccepted:false,globalHdComplete:false,rngContinuityAccepted:false,
 ordinaryEndAccepted:false,cleanupAuthorized:false,sessionReleaseAllowed:false});
export const CITY4_ORIGIN_ANCHOR_READINESS=Object.freeze({
 sourceOnly:true,runnerProvided:false,factoryNativeInputs:0,maximumActualEnd:0,
 maximumActualMarch:0,maximumNewPublicSaveCommits:2,oldSemanticBinderIsNotOriginAuthority:true,
 policyObserverInstalledByThisAdapter:false,postEndTicketReaderProvided:false,
 loadAndFreshAnchorRequiresExplicitCall:true,automaticCleanupProvided:false
});

function descriptors(value,label){
 assert.ok(value&&typeof value==='object'&&!utilTypes.isProxy(value),label+': ordinary object required');
 assert.ok(Object.getPrototypeOf(value)===Object.prototype,label+': ordinary prototype required');
 const out=new Map();
 for(const key of Reflect.ownKeys(value)){
  assert.equal(typeof key,'string',label+': symbol field rejected');
  const d=Object.getOwnPropertyDescriptor(value,key);
  assert.ok(d&&Object.hasOwn(d,'value')&&d.enumerable===true,label+': hidden/accessor field rejected without invocation');
  out.set(key,d.value);
 }
 return out;
}
function ownedValue(object,key,label){
 assert.ok(object&&typeof object==='object'&&!utilTypes.isProxy(object),label+': live object required');
 const d=Object.getOwnPropertyDescriptor(object,key);
 assert.ok(d&&Object.hasOwn(d,'value'),label+': own data '+key+' required');
 return d.value;
}
function tagSnapshot(value){
 const d=descriptors(value,'Fresh END SAVE tags');
 eq([...d.keys()].sort(),['failed','resume','settled'],'All three explicit fresh SAVE roles are required');
 const out={};
 for(const key of ['resume','failed','settled']){
  const t=d.get(key);assert.ok(typeof t==='string'&&/^wood67-131-[a-z0-9-]+$/.test(t),'Neutral explicit SAVE tag');out[key]=t;
 }
 return Object.freeze(out);
}
function inside(parent,child){const rel=path.relative(parent,child);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);}

// This sink writes and reads back the same exclusive descriptor. A caller cannot
// substitute a callback that merely returns the expected pin. It never makes a directory.
function exclusiveSink(root,artifactDirectory){
 const base=path.join(root,'build','impact-skill-20261014');
 assert.ok(inside(base,artifactDirectory),'Evidence directory must be a separate child of the workspace B directory');
 let prepared=null;const attempted=new Set(),written=[];
 async function prepare(){
  assert.equal(prepared,null,'One evidence-directory admission');
  const [workspaceReal,baseReal,directoryReal,st]=await Promise.all([fs.realpath(root),fs.realpath(base),fs.realpath(artifactDirectory),fs.lstat(artifactDirectory)]);
  assert.ok(st.isDirectory()&&!st.isSymbolicLink(),'Caller must supply an existing non-link evidence directory');
  assert.ok(inside(workspaceReal,baseReal)&&inside(baseReal,directoryReal),'Resolved evidence directory stays within this workspace B');
  prepared={workspaceReal,baseReal,directoryReal};
 }
 async function write(name,provided){
  assert.ok(prepared,'Evidence directory admitted before any native input');
  assert.ok(typeof name==='string'&&name.length>0&&name.length<=180&&/^[a-z0-9][a-z0-9.-]*$/.test(name),'Only lowercase artifact basenames');
  assert.ok(!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name),'No reserved Windows basename');
  assert.equal(attempted.has(name),false,'No artifact overwrite or failed-write retry');attempted.add(name);
  assert.ok(Buffer.isBuffer(provided)&&provided.length>0&&provided.length<=32*1024*1024,'One complete bounded artifact Buffer');
  const bytes=Buffer.from(provided),st=await fs.lstat(artifactDirectory),currentReal=await fs.realpath(artifactDirectory);
  assert.ok(st.isDirectory()&&!st.isSymbolicLink()&&currentReal===prepared.directoryReal,'The same actual evidence directory is retained');
  const handle=await fs.open(path.join(currentReal,name),'wx+');let original=null,pin=null;
  try{
   await handle.writeFile(bytes);await handle.sync();const stat=await handle.stat();assert.equal(stat.size,bytes.length,'Exclusive file has the complete requested length');
   const readBack=Buffer.alloc(bytes.length);let position=0;
   while(position<readBack.length){const n=await handle.read(readBack,position,readBack.length-position,position);assert.ok(n.bytesRead>0,'Complete exclusive descriptor readback');position+=n.bytesRead;}
   assert.ok(readBack.equals(bytes),'Actual exclusive descriptor contains the exact original artifact bytes');
   pin={file:name,bytes:readBack.length,sha256:sha(readBack)};
  }catch(error){original={error};}
  try{await handle.close();}catch(error){if(!original)original={error};}
  if(original)throw original.error;written.push(Object.freeze({...pin}));return pin;
 }
 return Object.freeze({prepare,write,pins:()=>written.map(p=>({...p}))});
}

function authenticate(input){
 // Every call hashes/parses the retained raw originals again. No cached true is accepted.
 const bound=verifyCity4DispatchedHistory(input);
 assert.equal(bound.originProof.originAuthenticated,true,'Tracked raw-origin verifier is mandatory');
 eq(bound.originProof.rawSourcePins.map(p=>p.role),ORIGIN_ROLES,'All eight original byte roles remain authenticated');
 return bound;
}
function oldAnchorInput(input){
 // The old anchor receives a detached semantic snapshot, never our private raw authority.
 return{
  currentMainSource:MAIN_SOURCE,inputPins:copy(input.inputPins),historyInputPins:copy(input.historyInputPins),
  historyLedger:copy(input.historyLedger),world:copy(input.world),pair:copy(input.pair),
  nativeBudget:copy(input.nativeBudget),referenceWorld:copy(input.historyLedger.referenceWorld),
  inputArtifacts:{candidate:copy(CITY4_END_ARCHIVED_PINS.ledger),lastSave:copy(CITY4_END_ARCHIVED_PINS.publicSave),
   originalPair:copy(input.publication.main.pair.map(p=>p.original)),currentPublishedMain:true},
  oldRawFlagsRewritten:false,oldNewRngContinuityAccepted:false
 };
}
function rawCopies(input){return Object.freeze(Object.fromEntries(ORIGIN_ROLES.map(role=>[role,Buffer.from(input.originBytes[role])])));}
function budget(ticket){return{dailyRatio:ticket.meta.dailyRatio,monthlyRatio:ticket.meta.monthlyRatio,boutMax:ticket.meta.boutMax};}
function preObserver(ticket,input){
 const q=verifyCity4Ticket({ticket,libBytes:input.libBytes,nativeBudget:input.nativeBudget,observerExpected:false});
 eq(budget(ticket),input.nativeBudget,'The complete raw-authenticated native budget is retained');
 eq(ticket.meta.v32HookFence.observer,{name:'willExecuteOrder',present:false},'This reader is only for the exact pre-install readonly observer identity');
 return q;
}
function preIdentity(anchor,input){
 const s=anchor.anchorSave.publicSave,loaded=anchor.loadedTicket;
 for(const ticket of [loaded,s.before,s.beforeChoice,s.beforeRecord,s.after])preObserver(ticket,input);
 eq(loaded,s.before,'The complete actual LOAD anchor immediately precedes the real anchor SAVE');
 return{
  phase:'pre-END-before-policy-observer-installation',observerExpected:false,
  observer:copy(s.after.meta.v32HookFence.observer),hookFence:copy(s.after.meta.v32HookFence),
  sourceEpoch:copy(preObserver(s.after,input).epoch),speGeneration:s.after.state.snapshot.spe.generation,
  loadNativeKeys:loaded.state.keys,anchorNativeKeys:s.after.state.keys,
  policyObserverInstalled:false,postEndReader:false,maximumActualEnd:0
 };
}
function assertCommitPrefix(anchor){
 const r=anchor.report;assert.equal(r.anchorQualified,true,'An actual anchor must have completed all old native/formal gates');
 eq(r.saveAdmission,{maximumNewPublicSaves:2,maximumActualEnd:0},'Two commits shared with a separately reviewed terminal adapter; END still disabled');
 assert.ok(Array.isArray(r.nativeSaveCommitAttempts)&&r.nativeSaveCommitAttempts.length===1,'Exactly one anchor SAVE reservation already spent');
 const c=r.nativeSaveCommitAttempts[0];
 eq([c.ordinal,c.code,c.reason,c.reservedBeforeKeyDown,c.dispatchOutcome],[1,39,'record native SAVE slot0',true,'keyDown-and-keyUp-returned'],'A genuine anchor commit has its original conservative reservation and observed dispatch outcome');
 assert.ok(Number.isSafeInteger(c.keysBefore)&&c.keysBefore>=0,'Typed actual precommit key count');
 eq([r.newEnds,r.newMarches,r.newDistributions,r.newPlunders],[0,0,0,0],'Anchor introduces no campaign action');
}

/** Constructs no CDP calls or file reads. Explicit method invocation later reads
 * the nine pinned inputs exactly once through the tracked strong loader. */
export function createCity4OriginBoundAnchorAdapter(options){
 const f=descriptors(options,'Origin-bound anchor options');
 for(const key of f.keys())assert.ok(['root','artifactDirectory','session','cdp','saveTags','readFile'].includes(key),'No alternate input, origin bypass or executable END option');
 const root=f.get('root'),artifactDirectory=f.get('artifactDirectory'),session=f.get('session'),cdp=f.get('cdp'),tags=tagSnapshot(f.get('saveTags')),readFile=f.get('readFile');
 assert.ok(typeof root==='string'&&path.isAbsolute(root)&&typeof artifactDirectory==='string'&&path.isAbsolute(artifactDirectory),'Explicit absolute workspace and evidence paths');
 assert.ok(readFile===undefined||typeof readFile==='function','Optional read override still passes every tracked exact pin');
 const identity=ownedValue(session,'identity','Trusted same-Node session'),sessionCdp=ownedValue(session,'cdp','Trusted same-Node session');
 assert.ok(identity&&typeof identity==='object'&&sessionCdp===cdp&&cdp&&typeof cdp.send==='function','Trusted same-session CDP object, not serialized PID/port metadata');
 const send=cdp.send,sink=exclusiveSink(path.resolve(root),path.resolve(artifactDirectory));
 let started=false,completed=null,retainedInput=null,oldAdapter=null;const state={phase:'not-started',originalError:null,secondaryEvidenceError:null};
 function sameLive(){assert.ok(ownedValue(session,'identity','Same live session')===identity&&ownedValue(session,'cdp','Same live session')===cdp&&cdp.send===send,'Exact original Node session/CDP/send references remain bound');}
 async function loadAndFreshAnchor(){
  assert.equal(started,false,'No retry, second LOAD or alternate source after any attempted anchor');started=true;sameLive();state.phase='authenticating-original-input';
  let privateInput=null,old=null;
  try{
   privateInput=readCity4DispatchedInput(root,readFile===undefined?{}:{readFile});retainedInput=privateInput;
   const bound=authenticate(privateInput);assertCity4EndSaveTags(tags,privateInput.historyLedger);
   eq(privateInput.inputPins,OCTOBER_INPUT_PINS,'Tracked exact current main input pins');eq(privateInput.historyInputPins,CITY4_HISTORY_INPUT_PINS,'Tracked exact archived history input pins');
   await sink.prepare();sameLive();
   await sink.write('origin-bound-anchor-admission.json',Buffer.from(JSON.stringify({kind:'P57 raw-origin authenticated fresh anchor admission',currentMainSource:MAIN_SOURCE,
    rawSourcePins:bound.originProof.rawSourcePins,historicalLayers:bound.originProof.historicalLayers,
    declaredSaveTags:tags,liveCapabilityBinding:'Private same-Node session/CDP object references; not a serialized ownership proof',
    policyObserverInstalled:false,maximumActualEnd:0,oldFlagsRewritten:false,oldNewRngContinuityAccepted:false,...noCredit()})+'\n'));
   // Clone only after the complete source authentication, then authenticate again
   // before any native call. Old semantic validation is an additional gate only.
   const detached=oldAnchorInput(privateInput);authenticate(privateInput);sameLive();
   old=createCity4EndNativeAnchorAdapter({cdp,input:detached,libBytes:Buffer.from(privateInput.libBytes),persistExclusive:sink.write,saveTags:{resume:tags.resume,failed:tags.failed}});oldAdapter=old;
   state.phase='same-session-public-load-and-anchor-save';const actual=await old.loadAndFreshAnchor();sameLive();
   assert.ok(actual.cdp===cdp,'The actual anchor returns the same original CDP object');
   const proof=verifyCity4DispatchedResume({input:privateInput,ledger:actual.ledger,saveTags:tags});
   eq(actual.loadedTicket,actual.ledger.resume.loadedTicket,'The returned whole LOAD is the genuine resumed ledger LOAD');
   eq(actual.anchorSave,{publicSave:actual.ledger.resume.publicSave,publicPair:actual.ledger.resume.publicPair,publicKeys:actual.ledger.resume.publicKeys},'The entire external SAVE packet is the exact complete formal resume packet');
   eq(actual.anchorSave.publicSave.tag,tags.resume,'The fresh public SAVE uses the new declared anchor role');
   assertCommitPrefix(actual);const preEndObserverIdentity=preIdentity(actual,privateInput),raw=rawCopies(privateInput);
   const currentSource={kind:'raw-authenticated-original-P57-saved-dispatch',publication:copy(OCTOBER_INPUT_PINS[0]),world:copy(OCTOBER_INPUT_PINS[1]),
    originalOwner:copy(CITY4_END_ARCHIVED_PINS.final),originalPublicSave:copy(CITY4_END_ARCHIVED_PINS.publicSave),pair:copy(OCTOBER_INPUT_PINS.slice(2)),library:copy(CITY4_END_LIBRARY_PIN)};
   let capability;
   const freshPreObserver=t=>{assert.equal(actual.report.nativeSaveCommitAttempts.length,1,'Pre-install reader retires before a terminal commit');eq(preObserver(t,privateInput).epoch,preEndObserverIdentity.sourceEpoch,'The exact freshly saved pre-observer epoch is still current');eq(t,actual.anchorSave.publicSave.after,'No undeclared native input or owner change before observer installation');};
   const readPreEndTicket=async label=>{assertCity4OriginBoundAnchorCapability(capability,{session,cdp});sameLive();const t=await actual.readTicket(label);sameLive();freshPreObserver(t);return t;};
   const readPreEndProtected=async()=>{assertCity4OriginBoundAnchorCapability(capability,{session,cdp});sameLive();const p=await actual.readProtected();sameLive();freshPreObserver(p.ticket);eq(p.pair,actual.anchorSave.publicPair,'Protected actual storage still equals the fresh genuine anchor pair');assert.equal(p.journal,null);return p;};
   capability=Object.freeze({session,cdp,sameSession:identity,sameNode:SAME_NODE,currentMainSource:MAIN_SOURCE,currentSource,
    originBytes:raw,originProof:bound.originProof,inputPins:copy(privateInput.inputPins),historyInputPins:copy(privateInput.historyInputPins),
    loadedTicket:actual.loadedTicket,ledger:actual.ledger,anchorSave:actual.anchorSave,proof,report:actual.report,
    preEndObserverIdentity,saveTags:tags,maximumActualEnd:0,readPreEndTicket,readPreEndProtected,
    exclusiveArtifactPins:()=>sink.pins(),...noCredit()});
   boundAnchors.set(capability,{privateInput,session,cdp,identity,sameLive,tags,actual,raw,preEndObserverIdentity:copy(preEndObserverIdentity),currentSource:copy(currentSource),attempts:actual.report.nativeSaveCommitAttempts,capturedLedger:copy(stripCity4EndRuntime(actual.ledger)),anchorCommit:copy(actual.report.nativeSaveCommitAttempts[0]),anchorCommitIdentity:actual.report.nativeSaveCommitAttempts[0]});
   assertCity4OriginBoundAnchorCapability(capability,{session,cdp});
   await sink.write('origin-bound-anchor-qualified.json',Buffer.from(JSON.stringify({currentMainSource:MAIN_SOURCE,currentSource,
    rawSourcePins:bound.originProof.rawSourcePins,preEndObserverIdentity,anchorSaveTag:tags.resume,
    genuineAnchorWholeWorldAndPairQualified:true,maximumActualEnd:0,originalFlagsRewritten:false,...noCredit()})+'\n'));
   sameLive();completed=capability;state.phase='fresh-anchor-qualified-pre-observer';return capability;
  }catch(error){
   state.phase='failed-same-live-session-retained';state.originalError=error;
   // Do not replace primitive throws, retry, perform another SAVE, restore an
   // observer, or close the CDP/process. The original native attempt history stays.
   if(old){try{sameLive();}catch(secondary){state.secondaryEvidenceError=secondary;}}
   throw error;
  }
 }
 return Object.freeze({loadAndFreshAnchor,readiness:CITY4_ORIGIN_ANCHOR_READINESS,
  copyRetainedOriginBytes(){assert.ok(retainedInput,'No raw input exists before the explicit loader call');authenticate(retainedInput);return rawCopies(retainedInput);},
  status:()=>({phase:state.phase,started,completed:completed!==null,retainedOriginalRawBytes:retainedInput!==null,sameSession:identity,session,cdp,sameNode:SAME_NODE,maximumActualEnd:0,originalAnchorReport:oldAdapter?.report??null,originalError:state.originalError,secondaryEvidenceError:state.secondaryEvidenceError,...noCredit()})});
}

/** Pure revalidation of a private same-Node capability. This performs no CDP/file
 * read, and never substitutes cached originAuthenticated/accepted booleans. */
export function assertCity4OriginBoundAnchorCapability(capability,{session,cdp}={}){
 const b=boundAnchors.get(capability);assert.ok(b,'Only the original live capability from this exact Node module instance is accepted');
 assert.ok(session===b.session&&cdp===b.cdp&&capability.session===session&&capability.cdp===cdp&&capability.sameSession===b.identity&&capability.sameNode===SAME_NODE,'No serialization, alternate session or CDP substitution');b.sameLive();
 const bound=authenticate(b.privateInput);
 // Disclosure copies remain intact too; mutating one cannot become new authority.
 verifyCity4DispatchedOrigin({...b.privateInput,originBytes:b.raw});
 const proof=verifyCity4DispatchedResume({input:b.privateInput,ledger:capability.ledger,saveTags:b.tags});
 eq(stripCity4EndRuntime(capability.ledger),b.capturedLedger,'Entire captured fresh ledger remains unchanged, including every unknown field and all independent SAVE tickets');
 eq(capability.anchorSave,{publicSave:capability.ledger.resume.publicSave,publicPair:capability.ledger.resume.publicPair,publicKeys:capability.ledger.resume.publicKeys},'External genuine SAVE remains bound to the complete freshly authenticated ledger');
 eq(capability.currentMainSource,MAIN_SOURCE,'No old P51 or unsaved V53 source substitution');eq(capability.currentSource,b.currentSource,'Exact raw original main source provenance');
 eq(capability.preEndObserverIdentity,b.preEndObserverIdentity,'Exact pre-END observer identity is unchanged');eq(preIdentity(b.actual,b.privateInput),b.preEndObserverIdentity,'Complete pre-install ticket epoch remains bound');
 assert.ok(capability.report.nativeSaveCommitAttempts===b.attempts,'The append-only SAVE attempt array is shared with terminal SAVE, never replaced');
 assert.ok(b.attempts.length>=1&&b.attempts.length<=2,'Anchor and terminal share at most two conservative reservations');
 assert.ok(b.attempts[0]===b.anchorCommitIdentity,'The original anchor reservation object cannot be replaced');eq(b.attempts[0],b.anchorCommit,'The complete spent anchor reservation cannot be edited or refunded');
 return{currentMainSource:MAIN_SOURCE,sameSession:b.identity,sameNode:SAME_NODE,originAuthenticated:true,
  rawSourcePins:copy(bound.originProof.rawSourcePins),resumeEpochEstablished:proof.resumeEpochEstablished,
  preEndObserverIdentity:copy(b.preEndObserverIdentity),maximumActualEnd:0,...noCredit()};
}
