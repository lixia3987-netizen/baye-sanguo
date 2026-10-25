// Same-session first-PICK capture source. Import/factory sends no native input.
// Source authority is the private current P57 origin/stage brand, never caller evidence.
import assert from 'node:assert/strict';
import {isDeepStrictEqual,types as utilTypes} from 'node:util';
import {assertCity4ObserverStageCapability,copyCity4ObserverStagePolicy} from './hd-wood-city4-observer-transition.mjs';
import {assertCity4ObserverStageReadBinding} from './hd-wood-city4-observer-transition.mjs';
import {verifyCity4BeforeOwn} from './hd-wood-city4-continuation.mjs';

export const CITY4_FIRST_OWN_READINESS=Object.freeze({sourceOnly:true,runnerProvided:false,maximumNewNativeInputs:0,maximumNewEnd:0,maximumActualEnd:0,saveProvided:false,cleanupProvided:false,privateOriginAndStageRequired:true});
export const CITY4_FIRST_OWN_LIMITS=Object.freeze({maximumCaptureAttempts:8,maximumCaptureWaitMs:180000,pollIntervalMs:50,readsPerAttempt:3});
const captures=new WeakMap(),attempts=new WeakMap(),copy=structuredClone;
const eq=(a,b,label)=>assert.ok(isDeepStrictEqual(a,b),label||'Complete typed first-PICK capture equality');
const noCredit=()=>({sourceOnly:true,collectorNativeInputs:0,newEnd:0,newPublicSaves:0,cleanupAuthorized:false,sessionReleaseAllowed:false,mayReplay:false,actualEndAccepted:false,actualMonthAccepted:false,actualIncomeAccepted:false,actualBattleAccepted:false,actualCastAccepted:false,actualPublicSaveAccepted:false,hdAccepted:false,globalHdComplete:false});
function dataFields(value,keys,label){
 assert.ok(value&&typeof value==='object'&&!utilTypes.isProxy(value)&&Object.getPrototypeOf(value)===Object.prototype,label+': plain non-proxy data');
 const found=Reflect.ownKeys(value);eq([...found].sort(),[...keys].sort(),label+': exact fields');
 return Object.fromEntries(found.map(key=>{assert.equal(typeof key,'string');const d=Object.getOwnPropertyDescriptor(value,key);assert.ok(d&&Object.hasOwn(d,'value'),label+': own data fields without getter');return[key,d.value];}));
}
function diagnostic(error){
 try{if(typeof error==='string')return{type:'string',text:error.slice(0,2000)};if(error===null)return{type:'null'};if(typeof error!=='object'&&typeof error!=='function')return{type:typeof error};if(utilTypes.isProxy(error))return{type:'proxy-error',printable:false};const out={type:'object-error'};for(const k of['message','stack']){const d=Object.getOwnPropertyDescriptor(error,k);if(d&&Object.hasOwn(d,'value')&&typeof d.value==='string')out[k]=d.value.slice(0,4000);}return out;}catch{return{type:'unprintable-error',printable:false};}
}
function classify(ticket,policy){
 const s=ticket.state,z=s.snapshot,f=z.fight;
 if(s.menu.active===1&&s.menu.context===5)return'before-defender-input';
 if(s.qty.active||s.record.active)return'unsupported-quantity-or-record';
 if(s.menu.active)return'unsupported-current-menu';
 if(z.spe.active||z.result.active||z.top.active||z.report.active)return'natural-effect-or-report';
 if(f.active===1&&f.over===0){if(f.wait===1&&f.inputKind===1)return'first-own-pick';if(f.wait===0||f.inputKind===0)return'natural-engine-progress';return'unsupported-already-advanced-battle-input';}
 if(ticket.world.year!==policy.endReady.before.world.year||ticket.world.month!==policy.endReady.before.world.month)return'ordinary-or-later-month-before-qualified-first-pick';
 return'natural-policy-progress';
}
function binding(stageCapability,originCapability,session,cdp){
 const view=assertCity4ObserverStageCapability(stageCapability,{originCapability,session,cdp});
 assert.ok(view.originCapability===originCapability&&view.session===session&&view.cdp===cdp&&view.sameSession===session.identity,'Original same-Node origin/stage/session/CDP binding');
 assert.equal(view.endCommitAttempted,true,'A collector cannot invent the stage one-END attempt');assert.equal(view.endNativeAckObserved,true,'The actual sole39 ACK must already be independently observed by the stage');
 return view;
}
function retained(identity,error,extra={},sameSession=null){return Object.freeze({kind:'retained-live-unresolved',session:identity.session,cdp:identity.cdp,sameSession,stageCapability:identity.stageCapability,originCapability:identity.originCapability,originalError:error,error:diagnostic(error),readiness:CITY4_FIRST_OWN_READINESS,...extra,...noCredit()});}

/** Three fixed source-bound stage reads; no caller expression, key or callback.
 * Unknown/pre-defender owners retain the same live world without any action. */
export async function captureCity4FirstOwn(options){
 const identity=dataFields(options,['stageCapability','originCapability','session','cdp'],'First-PICK collector'),{stageCapability,originCapability,session,cdp}=identity;
 // Even reentry is a read-only same-capability lookup. A failed/unknown capture
 // never replays END or silently adopts a new historical world.
 const previous=attempts.get(stageCapability);
 if(previous){assert.ok(previous.originCapability===originCapability&&previous.session===session&&previous.cdp===cdp,'No capture ownership substitution');if(previous.capability){assertCity4FirstOwnCapability(previous.capability,identity);return previous.capability;}if(previous.result)return previous.result;throw Error('Exclusive first-PICK capture already in progress');}
 const record={originCapability,session,cdp,capability:null,result:null};attempts.set(stageCapability,record);
 let lastTicket=null,lastKind='not-read',readCount=0,sameSession=null;
 try{
  let stage=binding(stageCapability,originCapability,session,cdp);sameSession=stage.sameSession;
  const policy=copyCity4ObserverStagePolicy(stageCapability,{originCapability,session,cdp}),started=Date.now();
  const libBytes=Buffer.from(stage.libBytes),nativeBudget=copy(stage.nativeBudget),observerExpected=copy(stage.observerExpected);
  for(let attempt=0;attempt<CITY4_FIRST_OWN_LIMITS.maximumCaptureAttempts&&Date.now()-started<CITY4_FIRST_OWN_LIMITS.maximumCaptureWaitMs;attempt++){
   const reads=[];
   for(let index=0;index<CITY4_FIRST_OWN_LIMITS.readsPerAttempt;index++){
    const startedAt=performance.now(),value=await stageCapability.readObserverProtected('first-own-capture-'+attempt+'-'+index),observedAt=performance.now();readCount++;
    assert.equal(value.journal,null,'No SAVE transaction may be invented or left pending before first PICK');eq(value.pair,originCapability.anchorSave.publicPair,'Only the same actual fresh anchor pair exists before battle SAVE');eq(value.nativeKeyCount,value.ticket.state.keys);
    reads.push({ordinal:readCount-1,startedAt,observedAt,value});lastTicket=value.ticket;
   }
   assert.ok(reads[0].value!==reads[1].value&&reads[1].value!==reads[2].value,'Three independent fixed CDP responses, not one aliased caller snapshot');
   const kinds=reads.map(r=>classify(r.value.ticket,policy)),unsupported=kinds.find(k=>k==='before-defender-input'||k.startsWith('unsupported')||k==='ordinary-or-later-month-before-qualified-first-pick');lastKind=unsupported??kinds.at(-1);
   if(unsupported){
    record.result=retained(identity,Error('Unbound owner before first PICK: '+lastKind),{lastObservedKind:lastKind,readCount,lastTicket:copy(lastTicket)},sameSession);return record.result;
   }
   if(lastKind==='first-own-pick'){
    const [a,b,c]=reads.map(r=>r.value);if(!isDeepStrictEqual(a.ticket,b.ticket)||!isDeepStrictEqual(b.ticket,c.ticket)||!isDeepStrictEqual(a.observer,b.observer)||!isDeepStrictEqual(b.observer,c.observer)){await new Promise(resolve=>setTimeout(resolve,CITY4_FIRST_OWN_LIMITS.pollIntervalMs));continue;}
    const observer=copy(c.observer),owns=observer.samples.filter(row=>row.slotCandidates?.length===1&&row.slotCandidates[0]===170);eq(owns.length,1,'Exactly one complete original March170 callback');eq(observer.samples.at(-1),owns[0],'A later callback cannot authorize an earlier PICK');
    const evidence={...copy(policy),libBytes:Buffer.from(libBytes),nativeBudget:copy(nativeBudget),observerExpected:copy(observerExpected),observer,ticket:copy(c.ticket),callback:copy(owns[0]),kind:'first-own-pick',firstPick:{first:copy(a.ticket),second:copy(b.ticket),final:copy(c.ticket)}};
    const proof=verifyCity4BeforeOwn(evidence);assert.equal(proof.accepted,true);
    stage=binding(stageCapability,originCapability,session,cdp);const currentPolicy=copyCity4ObserverStagePolicy(stageCapability,{originCapability,session,cdp});eq(currentPolicy,policy,'The full privately captured current P57 policy/endReady cannot be replaced during capture');
    const capability=Object.freeze({kind:'private-city4-first-own-capture',session,cdp,sameSession:stage.sameSession,readOnlyCapture:true,maximumNewEnd:0,...noCredit()});
    captures.set(capability,{originCapability,stageCapability,session,cdp,identity:stage.sameSession,admissionCapability:stage.admissionCapability,policy:copy(policy),evidence:copy(evidence),proof:copy(proof),observerExpected:copy(observerExpected),observerEpochTicket:copy(stage.observerEpochTicket),nativeBudget:copy(nativeBudget),libBytes:Buffer.from(libBytes),saveTags:copy(stage.saveTags),protectedReads:copy(reads)});
    assertCity4FirstOwnCapability(capability,identity);record.capability=capability;return capability;
   }
   await new Promise(resolve=>setTimeout(resolve,CITY4_FIRST_OWN_LIMITS.pollIntervalMs));
  }
  throw Error('Bounded readonly first-PICK capture did not qualify a complete current owner');
 }catch(error){record.result=retained(identity,error,{lastObservedKind:lastKind,readCount,lastTicket:lastTicket?copy(lastTicket):null},sameSession);return record.result;}
}

/** Historical first PICK remains valid after legal battle progress. This does
 * not require a later current MAP to equal the old PICK. Current owner capture
 * belongs to fixed stage readers and the separately bound terminal driver. */
export function assertCity4FirstOwnCapability(capability,options){
 const identity=dataFields(options,['stageCapability','originCapability','session','cdp'],'First-PICK capability identity'),b=captures.get(capability);assert.ok(b,'Only this exact same-module first-PICK capability is accepted');
 assert.ok(identity.originCapability===b.originCapability&&identity.stageCapability===b.stageCapability&&identity.session===b.session&&identity.cdp===b.cdp&&capability.session===b.session&&capability.cdp===b.cdp&&capability.sameSession===b.identity,'No serialization, fake sameSession or alternate capture source');
 const stage=binding(b.stageCapability,b.originCapability,b.session,b.cdp);assert.ok(stage.admissionCapability===b.admissionCapability,'The original private conditional-END admission remains bound');
 eq(copyCity4ObserverStagePolicy(b.stageCapability,{originCapability:b.originCapability,session:b.session,cdp:b.cdp}),b.policy,'Full original current-source policy/endReady and unknown fields remain unchanged');eq(stage.observerExpected,b.observerExpected);eq(stage.observerEpochTicket,b.observerEpochTicket);eq(stage.nativeBudget,b.nativeBudget);eq(stage.saveTags,b.saveTags);assert.ok(Buffer.from(stage.libBytes).equals(b.libBytes),'Exact original runtime LIB stays bound');
 const proof=verifyCity4BeforeOwn(b.evidence);eq(copy(proof),b.proof,'Complete privately captured first-PICK proof is rederived, never accepted from a boolean');
 return{originCapability:b.originCapability,stageCapability:b.stageCapability,firstOwnCapability:capability,firstOwnEvidence:copy(b.evidence),observerExpected:copy(b.observerExpected),observerEpochTicket:copy(b.observerEpochTicket),libBytes:Buffer.from(b.libBytes),nativeBudget:copy(b.nativeBudget),saveTags:copy(b.saveTags),sameSession:b.identity,session:b.session,cdp:b.cdp,readOnlyCapture:true,maximumNewEnd:0,...noCredit()};
}

/** Private first-PICK identity only. No history, evidence or input permit is cached. */
export function assertCity4FirstOwnReadBinding(capability,options){
 const b=captures.get(capability);assert.ok(b,'Only the original same-module first-PICK capture has a readonly binding');
 assert.ok(options&&typeof options==='object'&&!utilTypes.isProxy(options),'Readonly first-PICK identity: non-proxy own-data options');
 const identity=dataFields(options,['stageCapability','originCapability','session','cdp'],'Readonly first-PICK identity');
 assert.ok(identity.originCapability===b.originCapability&&identity.stageCapability===b.stageCapability&&identity.session===b.session&&identity.cdp===b.cdp&&capability.session===b.session&&capability.cdp===b.cdp&&capability.sameSession===b.identity,'Original readonly first-PICK/stage/origin/session/CDP references required');
 const stage=assertCity4ObserverStageReadBinding(b.stageCapability,{originCapability:b.originCapability,session:b.session,cdp:b.cdp});assert.ok(stage.admissionCapability===b.admissionCapability&&stage.sameSession===b.identity&&stage.endCommitAttempted===true&&stage.endNativeAckObserved===true,'The original privately captured one-END admission and ACK remain bound');
 return{originCapability:b.originCapability,stageCapability:b.stageCapability,firstOwnCapability:capability,session:b.session,cdp:b.cdp,sameSession:b.identity,readOnlyBinding:true,sourceOnly:true,maximumNewNativeInputs:0,maximumNewEnd:0,cleanupAuthorized:false,sessionReleaseAllowed:false};
}
