// Inert source candidate: normal fixed observer/conditional-END stage methods.
// No owned executable runner is provided. Actual use still requires a separately
// reviewed same-process retention/continuation/terminal-release composition.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual,types as utilTypes} from 'node:util';
import {assertCity4OriginBoundAnchorCapability} from './hd-wood-city4-origin-anchor.mjs';
import {verifyCity4DispatchedHistory,verifyCity4DispatchedResume,verifyCity4EndAdmission,OCTOBER_INPUT_PINS,CITY4_END_ARCHIVED_PINS,CITY4_END_LIBRARY_PIN} from './hd-wood-city4-end-input.mjs';
import {verifyCity4Ticket} from './hd-wood-city4-continuation.mjs';
import {V32_POLICY_OBSERVER_FUNCTION_SOURCE,V32_NO_TAKEOVER_HOOKS} from './hd-impact-v32-conditional-plunder-prefix.mjs';
import {city4TicketExpression,city4ProtectedReadExpression} from './hd-wood-city4-ticket-view.mjs';
import {city4FocusRegionExpression,isCity4OrdinaryMap} from './hd-wood-city4-ui-predicates.mjs';

const eq=(a,b,label)=>assert.ok(isDeepStrictEqual(a,b),label||'Complete typed transition equality'),copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex');
const observers=Object.freeze({functionSource:V32_POLICY_OBSERVER_FUNCTION_SOURCE}),owners=new WeakMap(),admissions=new WeakMap(),stages=new WeakMap();
const noCredit=()=>({sourceOnly:true,actualEndAccepted:false,actualMonthAccepted:false,actualSupplyIncomeAccepted:false,actualBattleAccepted:false,actualCastAccepted:false,hdAccepted:false,globalHdComplete:false,rngContinuityAccepted:false,ordinaryEndAccepted:false,cleanupAuthorized:false,sessionReleaseAllowed:false});
export const CITY4_END_TRANSITION_READINESS=Object.freeze({sourceOnly:true,ownedRunnerProvided:false,ownedRunnerExecutionEnabled:false,maximumOwnedRunnerEnd:0,observerTransitionProvided:true,precommitSystemEscapeProvided:true,sourceBoundPreparedCommitProvided:true,maximumPreparedEndCommitAttempts:1,sameProcessRetentionBound:false,postEndContinuationBound:false,terminalReleaseBound:false,automaticCleanupProvided:false});
export const CITY4_END_TRANSITION_LIMITS=Object.freeze({maximumArtifacts:8192,maximumArtifactBytes:32*1024*1024,maximumTotalArtifactBytes:1024*1024*1024,maximumStableAttempts:40,maximumReadOnlyWaitMs:20000,maximumObserverCallbacks:200});

// Retain the raw published async ABI, including its misleadingly named U16 view.
// bind-objects.c publishes that view with DEFADD_U8ARR, length5120, not U16 decoding.
export const CITY4_END_TRANSITION_ASYNC_EXPRESSION='(()=>{const d=baye.data,params=Array.from(d.g_asyncActionParams,Number),bytes=Array.from(d.g_asyncActionStringParamArray,Number),u16View=Array.from(d.g_asyncActionU16ParamArray,Number);if(params.length!==32||bytes.length!==10240||u16View.length!==5120)throw Error("Original async ABI size mismatch");return {id:Number(d.g_asyncActionID),params,text:String(d.g_asyncActionStringParam),bytes,u16View};})()';

// Fixed source only: callers cannot supply a read expression, callback or eval.
// Reuses the already installed snapshot/reference registry. It never reinstalls
// city4ObserverSource and cannot silently create a new token epoch after LOAD.
export const CITY4_END_TRANSITION_INSTALL_EXPRESSION='('+function(functionSource,hookNames,readSource,asyncSource){
 if(!window.baye||!baye.hooks||!baye.data)throw Error('Original current engine required');
 const hooks=baye.hooks;if(typeof hooks.willExecuteOrder!=='undefined'||window.__v21PolicyObserver||window.__city4EndTransitionObserverOwner)throw Error('Never replace an existing order observer or owner');
 for(const name of hookNames)if(typeof hooks[name]!=='undefined')throw Error('Unexpected gameplay hook '+name);
 if(typeof window.__impactReadSnapshot!=='function'||typeof window.__woodRecruitmentReadHookFence!=='function'||!window.__city4MarchProbe)throw Error('Original anchor ticket/reference registry required');
 const store={calls:[],samples:[],originalUndefined:true,installed:false};
 const order=context=>{const keys=['OrderId','Person','City','Object','Arms','Food','Money','Consume','TimeCount'],r={};for(const k of keys){const value=Number(context[k]);if(!Number.isInteger(value))throw Error('Incomplete original order '+k);r[k]=value;}return r;};
 const read=new Function('return ('+readSource+');'),asyncState=new Function('return ('+asyncSource+');');
 const fn=new Function('store','order','asyncState','read','return ('+functionSource+');')(store,order,asyncState,read);
 if(Function.prototype.toString.call(fn)!==functionSource)throw Error('Exact inherited readonly observer required');
 store.fn=fn;Object.defineProperty(window,'__city4EndTransitionObserverOwner',{value:Object.freeze({store,fn}),writable:false,configurable:false,enumerable:false});window.__v21PolicyObserver=store;hooks.willExecuteOrder=fn;store.installed=true;
 return{installed:true,originalUndefined:true,functionSource:Function.prototype.toString.call(fn),calls:store.calls.length,samples:store.samples.length,sameStoreIdentityBound:true};
}+')('+[V32_POLICY_OBSERVER_FUNCTION_SOURCE,V32_NO_TAKEOVER_HOOKS,city4TicketExpression,CITY4_END_TRANSITION_ASYNC_EXPRESSION].map(s=>JSON.stringify(s)).join(',')+')';

const observerIdentityGuard='const s=window.__v21PolicyObserver,o=window.__city4EndTransitionObserverOwner;if(!s||!o||s!==o.store||s.fn!==o.fn||s.installed!==true||o.fn!==baye.hooks.willExecuteOrder||s.originalUndefined!==true)throw Error("Exact original current order observer/store required");';
const observerExpression='(()=>{'+observerIdentityGuard+'return{installed:true,originalUndefined:true,functionSource:Function.prototype.toString.call(s.fn),calls:s.calls,samples:s.samples};})()';
const observedTicketExpression='(()=>{'+observerIdentityGuard+'return '+city4TicketExpression+';})()';
const atomicExpression='(()=>{const q=('+city4ProtectedReadExpression+'),observer=('+observerExpression+'),e=document.activeElement,owner={qty:baye.hd.qty(),menu:baye.hd.menuItems(),record:baye.hd.record(),march:baye.hd.march(),report:baye.hd.report()};return{...q,observer,owner,focus:{tag:e?.tagName,editable:!!e?.isContentEditable},system:BayeHdSystemUi.debugSnapshot(),nativeKeyCount:window.__city4MarchProbe.keys.length};})()';
const originalPins=Object.freeze({publication:OCTOBER_INPUT_PINS[0],world:OCTOBER_INPUT_PINS[1],sav0:OCTOBER_INPUT_PINS[2],sav1:OCTOBER_INPUT_PINS[3],ledger:CITY4_END_ARCHIVED_PINS.ledger,final:CITY4_END_ARCHIVED_PINS.final,publicSave:CITY4_END_ARCHIVED_PINS.publicSave,library:CITY4_END_LIBRARY_PIN});
const ta=Object.getPrototypeOf(Uint8Array.prototype),get=name=>Object.getOwnPropertyDescriptor(ta,name).get,viewBuffer=get('buffer'),viewOffset=get('byteOffset'),viewLength=get('length'),arrayLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
function rawCopy(value,pin){const buffer=viewBuffer.call(value),offset=viewOffset.call(value),length=viewLength.call(value);assert.ok(length===pin.bytes&&offset>=0&&offset+length<=arrayLength.call(buffer));const bytes=Buffer.from(new Uint8Array(buffer,offset,length));assert.equal(sha(bytes),pin.sha256,'Every original raw role stays byte-authenticated');return bytes;}
function own(value,key,label){assert.ok(value&&typeof value==='object'&&!utilTypes.isProxy(value),label+': non-proxy object');const d=Object.getOwnPropertyDescriptor(value,key);assert.ok(d&&Object.hasOwn(d,'value'),label+': own data '+key);return d.value;}
function fields(value,allowed,label){assert.ok(value&&Object.getPrototypeOf(value)===Object.prototype&&!utilTypes.isProxy(value),label+': plain options');const keys=Reflect.ownKeys(value);eq([...keys].sort(),[...allowed].sort(),label+': exact option fields');return Object.fromEntries(keys.map(k=>{assert.equal(typeof k,'string');return[k,own(value,k,label)];}));}
function diagnostic(error){try{if(typeof error==='string')return{type:'string',text:error.slice(0,2000)};if(error===null)return{type:'null'};if(typeof error!=='object'&&typeof error!=='function')return{type:typeof error};if(utilTypes.isProxy(error))return{type:'proxy-error',printable:false};const result={type:'object-error'};for(const key of ['message','stack']){const d=Object.getOwnPropertyDescriptor(error,key);if(d&&Object.hasOwn(d,'value')&&typeof d.value==='string')result[key]=d.value.slice(0,4000);}return result;}catch{return{type:'unprintable-error',printable:false};}}
function inside(parent,child){const rel=path.relative(parent,child);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);}
function sinkFor(root,directory){
 const base=path.join(root,'build','impact-skill-20261014'),attempted=new Set(),pins=[];let admitted=null,total=0;
 assert.ok(inside(base,directory),'Transition evidence is an explicit B child directory');
 return Object.freeze({async prepare(){assert.equal(admitted,null);const [r,b,d,st]=await Promise.all([fs.realpath(root),fs.realpath(base),fs.realpath(directory),fs.lstat(directory)]);assert.ok(inside(r,b)&&inside(b,d)&&st.isDirectory()&&!st.isSymbolicLink());admitted=d;},async write(name,value){
  assert.ok(admitted&&typeof name==='string'&&/^[a-z0-9][a-z0-9.-]{0,179}$/.test(name)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name));assert.equal(attempted.has(name),false,'No evidence overwrite or failed-write retry');attempted.add(name);
  const bytes=Buffer.isBuffer(value)?Buffer.from(value):Buffer.from(JSON.stringify(value)+'\n');assert.ok(bytes.length>0&&bytes.length<=CITY4_END_TRANSITION_LIMITS.maximumArtifactBytes&&attempted.size<=CITY4_END_TRANSITION_LIMITS.maximumArtifacts&&total+bytes.length<=CITY4_END_TRANSITION_LIMITS.maximumTotalArtifactBytes);total+=bytes.length;
  const [st,current]=await Promise.all([fs.lstat(directory),fs.realpath(directory)]);assert.ok(st.isDirectory()&&!st.isSymbolicLink()&&current===admitted);
  const handle=await fs.open(path.join(current,name),'wx+');let failure=null,result=null;try{await handle.writeFile(bytes);await handle.sync();assert.equal((await handle.stat()).size,bytes.length);const read=Buffer.alloc(bytes.length);let at=0;while(at<read.length){const row=await handle.read(read,at,read.length-at,at);assert.ok(row.bytesRead>0);at+=row.bytesRead;}assert.ok(read.equals(bytes));result={file:name,bytes:read.length,sha256:sha(read)};}catch(error){failure={error};}try{await handle.close();}catch(error){if(!failure)failure={error};}if(failure)throw failure.error;pins.push(Object.freeze(result));return result;
 },pins:()=>pins.map(p=>({...p}))});
}

/** The raw authority is the private origin capability, never its accepted flag.
 * No archive is decoded again and no new historical source can be supplied. */
function sourceFromAnchor(anchor,session,cdp){
 assertCity4OriginBoundAnchorCapability(anchor,{session,cdp});
 const raw=Object.fromEntries(Object.entries(originalPins).map(([role,pin])=>[role,rawCopy(anchor.originBytes[role],pin)]));
 const input={originBytes:raw,publication:JSON.parse(raw.publication),world:JSON.parse(raw.world),pair:JSON.parse(raw.ledger).ledger.march.publicPair,historyLedger:copy(anchor.ledger.resume.history),finalOwner:JSON.parse(raw.final),publicSavePacket:JSON.parse(raw.publicSave),libBytes:rawCopy(raw.library,CITY4_END_LIBRARY_PIN),inputPins:copy(anchor.inputPins),historyInputPins:copy(anchor.historyInputPins),nativeBudget:copy(anchor.ledger.nativeBudget)};
 const bound=verifyCity4DispatchedHistory(input);input.historyProof=bound.historyProof;
 verifyCity4DispatchedResume({input,ledger:anchor.ledger,saveTags:anchor.saveTags});return input;
}
function expectedObserverTicket(before){const expected=copy(before);expected.meta.v32HookFence.observer={name:'willExecuteOrder',present:true,sameFunction:true,originalUndefined:true,functionSource:V32_POLICY_OBSERVER_FUNCTION_SOURCE};return expected;}
function assertObserver(raw,{empty=false}={}){assert.ok(raw&&raw.installed===true&&raw.originalUndefined===true);assert.equal(raw.functionSource,V32_POLICY_OBSERVER_FUNCTION_SOURCE);assert.ok(Array.isArray(raw.calls)&&Array.isArray(raw.samples)&&raw.calls.length===raw.samples.length&&raw.samples.length<=CITY4_END_TRANSITION_LIMITS.maximumObserverCallbacks);if(empty)eq([raw.calls,raw.samples],[[],[]],'No policy callback before the one conditional END');}
function systemReady(ticket,system){const m=ticket.state.menu,i=system?.input;return !!(m.active===1&&m.context===2&&m.kind===1&&m.index===0&&m.count===3&&m.names.join('|')==='策略结束|存储进度|结束游戏'&&ticket.state.qty.active===0&&ticket.state.record.active===0&&ticket.state.march.pick===0&&ticket.state.march.battlePick===0&&system.open===true&&system.showHd===true&&system.pending===false&&system.screen==='insystem'&&system.idleIndex===0&&i&&i.type==='menu'&&i.screen==='insystem'&&i.seq===m.seq&&i.index===0&&i.count===3&&i.context===2&&i.kind===1);}
function nativeOwner(ticket){const s=ticket.state;return{qty:s.qty,menu:s.menu,record:s.record,march:s.march,report:s.snapshot.report};}

/** Import/factory performs no CDP or filesystem operation. The explicit prepare
 * method may later install only the exact observer and send one Escape40. */
export function createCity4EndObserverTransitionAdapter(options){
 const {root,artifactDirectory,anchor,session,cdp}=fields(options,['root','artifactDirectory','anchor','session','cdp'],'Observer transition');
 assert.ok(typeof root==='string'&&path.isAbsolute(root)&&typeof artifactDirectory==='string'&&path.isAbsolute(artifactDirectory));
 assertCity4OriginBoundAnchorCapability(anchor,{session,cdp});assert.equal(owners.has(anchor),false,'One transition adapter per original branded anchor');
 const identity=own(session,'identity','Same live session'),send=own(cdp,'send','Same live CDP'),sink=sinkFor(path.resolve(root),path.resolve(artifactDirectory));assert.equal(typeof send,'function');
 const input=sourceFromAnchor(anchor,session,cdp),ledger=copy(anchor.ledger),saveTags=Object.freeze(copy(anchor.saveTags)),libBytes=rawCopy(input.libBytes,CITY4_END_LIBRARY_PIN),nativeBudget=copy(input.nativeBudget),args={libBytes,nativeBudget,observerExpected:observers};
 let started=false,installed=false,commitStarted=false,baselineSeed=null,epoch=null,speGeneration=null,currentAdmission=null,lastTicket=null,ordinal=0,readLease=null;const content=new Map(),attempts=[];
 const report={schemaVersion:1,sourceOnly:true,phase:'not-started',nativeAttempts:attempts,dispatchObservations:[],observerInstalled:false,systemEscapeObserved:false,endCommitAttempted:false,endNativeAckObserved:false,maximumPreparedEndCommitAttempts:1,maximumOwnedRunnerEnd:0,originalError:null,secondaryEvidenceError:null,...noCredit()};
 function sameLive(){assert.ok(own(session,'identity','Same live session')===identity&&own(session,'cdp','Same live session')===cdp&&own(cdp,'send','Same live CDP')===send&&anchor.session===session&&anchor.cdp===cdp,'The original same-Node session/CDP/send references remain bound');}
 async function evaluate(expression){sameLive();const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});sameLive();assert.ok(!r.exceptionDetails,'Fixed source CDP expression threw');return r.result?.value;}
 async function retainTicket(label,ticket,measurement){const captured=copy(ticket),bytes=Buffer.from(JSON.stringify(captured)+'\n'),hash=sha(bytes);if(!content.has(hash)){const pin=await sink.write('transition-ticket-'+hash+'.json',bytes);content.set(hash,pin);}await sink.write('transition-read-'+String(ordinal++).padStart(4,'0')+'.json',{label,ticket:content.get(hash),...measurement,clock:'Node performance.now around one distinct actual CDP read; not native/render timing'});lastTicket=copy(captured);return copy(captured);}
 function observed(ticket){const q=verifyCity4Ticket({ticket,...args});if(epoch){eq(q.epoch,epoch,'The complete pre-END reference/config/LIB/hook epoch remains bound');eq(ticket.state.snapshot.spe.generation,speGeneration);}if(!report.endCommitAttempted)eq(ticket.world,input.world,'No world mutation before the one END commit');return ticket;}
 async function current(label){assert.ok(installed,'The observer-aware reader starts after exact observer installation');const startedAt=performance.now(),ticket=observed(await evaluate(observedTicketExpression)),observedAt=performance.now();return retainTicket(label,ticket,{startedAt,observedAt});}
 async function stable(label,predicate=()=>true){let anchor=null;const deadline=Date.now()+CITY4_END_TRANSITION_LIMITS.maximumReadOnlyWaitMs;for(let n=0;n<CITY4_END_TRANSITION_LIMITS.maximumStableAttempts&&Date.now()<deadline;n++){const a=await current(label+' A'),b=await current(label+' B');if(predicate(a)&&predicate(b)){const x=copy(a),y=copy(b);delete x.state.overworld;delete y.state.overworld;anchor??=x;eq(x,anchor,'Complete eligible owner remains exact while its presentation cache retires');eq(y,anchor,'Only the declared presentation-cache field may differ');if(isDeepStrictEqual(a,b))return b;}await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Bounded whole observer-aware owner wait: '+label);}
 function protectedCurrent(q,expected,{emptyObserver=true,focus=false,system=false}={}){observed(q.ticket);eq(q.ticket,expected,'The complete final source-bound owner is still current');eq(q.pair,anchor.anchorSave.publicPair,'Fresh anchor storage remains exact before END');assert.equal(q.journal,null);assert.ok(q.seed===baselineSeed,'Only SAVE-local seed continuity; numeric values withheld, no historical RNG claim');assert.equal(q.nativeKeyCount,expected.state.keys);eq(q.owner,nativeOwner(expected),'Independent raw native owner equals the whole ticket');assertObserver(q.observer,{empty:emptyObserver});if(focus)assert.ok(['BODY','HTML','CANVAS'].includes(q.focus.tag)&&q.focus.editable===false,'No form-focused native input');if(system)assert.ok(systemReady(expected,q.system),'Exact nonpending current native/public END row0 owner');return q;}
 async function protectedPair(expected,options={}){const first=protectedCurrent(await evaluate(atomicExpression),expected,options),second=protectedCurrent(await evaluate(atomicExpression),expected,options);eq(first,second,'Two independent whole ticket/native/public-UI/focus/storage/observer reads agree, including unknown fields');return second;}
 async function physical(code,reason,before){
  assert.ok(code===40||code===39);assert.equal(attempts.length,code===40?0:1,'Only one Escape followed by one possible END confirmation');if(code===39)eq(attempts.map(p=>p.code),[40]);sameLive();const row=Object.freeze({ordinal:attempts.length+1,code,reason,keysBefore:before.state.keys,reservedBeforeKeyDown:true,dispatchOutcome:'unknown'});attempts.push(row);if(code===39){assert.equal(report.endCommitAttempted,false);report.endCommitAttempted=true;report.phase='end-commit-attempted-live-retained';}
  const key=code===40?'Escape':'Enter',vk=code===40?27:13;try{for(const type of ['keyDown','keyUp']){sameLive();await cdp.send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,autoRepeat:false});sameLive();}report.dispatchObservations.push({ordinal:row.ordinal,keyDownAndKeyUpReturned:true});}catch(error){report.dispatchObservations.push({ordinal:row.ordinal,keyDownAndKeyUpReturned:false,error:diagnostic(error)});throw error;}
  const keys=await evaluate('__city4MarchProbe.keys.slice('+before.state.keys+')');eq(keys.map(k=>k.code),[code],'Exactly one physical native character, never a guessed retry');for(const k of keys){eq(k.generation,before.state.snapshot.spe.generation);eq([k.speActive,k.resultActive],[0,false]);eq(k.fight,before.state.snapshot.fight);}if(code===39)report.endNativeAckObserved=true;return keys;
 }
 async function failure(error){report.phase='failed-same-live-session-retained';report.originalError=diagnostic(error);try{await sink.write('transition-failure-report.json',{report,lastTicket,originalThrownIdentityRetainedInProcess:true});}catch(secondary){report.secondaryEvidenceError=diagnostic(secondary);}return undefined;}
 async function prepareAdmission(){
  assert.equal(started,false,'No second observer installation or repeated Escape prefix');started=true;
  try{
   assertCity4OriginBoundAnchorCapability(anchor,{session,cdp});assert.equal(anchor.report.nativeSaveCommitAttempts.length,1,'The genuine anchor commit is the sole spent SAVE before END');await sink.prepare();sameLive();
   const before=await anchor.readPreEndTicket('complete current anchor before readonly observer'),protectedBefore=await anchor.readPreEndProtected();eq(protectedBefore.ticket,before);eq(protectedBefore.pair,anchor.anchorSave.publicPair);assert.equal(protectedBefore.journal,null);assert.ok(isCity4OrdinaryMap(before));baselineSeed=protectedBefore.seed;
   await sink.write('transition-before-observer.json',{ticket:before,seedFingerprint:sha(Buffer.from('native-seed-u32:'+String(baselineSeed))),pair:protectedBefore.pair,maximumOwnedRunnerEnd:0});
   // One attempted install, even if its CDP result is unknown. Never reinstall,
   // replace a callback, restore an old observer, or reset the token registry.
   report.phase='observer-install-attempted';const result=await evaluate(CITY4_END_TRANSITION_INSTALL_EXPRESSION);eq(result,{installed:true,originalUndefined:true,functionSource:V32_POLICY_OBSERVER_FUNCTION_SOURCE,calls:0,samples:0,sameStoreIdentityBound:true});installed=true;report.observerInstalled=true;
   const expected=expectedObserverTicket(before),first=await current('first complete ticket after observer installation'),second=await current('second complete ticket after observer installation');eq(first,expected,'Observer installation changes only its exact hook identity');eq(second,first,'Two independent whole tickets after installation');epoch=verifyCity4Ticket({ticket:second,...args}).epoch;speGeneration=second.state.snapshot.spe.generation;
   await protectedPair(second);
   // Real named inert SPAN pointer only; no focus()/blur(), arbitrary element,
   // toolbar button fallback or programmatic native sendKey is available here.
   const initial=await evaluate(city4FocusRegionExpression());assert.equal(initial?.accepted,true);const point={x:initial.point.x,y:initial.point.y};eq(await evaluate(city4FocusRegionExpression(point)),initial);const pointerStart=await evaluate('__city4MarchProbe.pointers.length');
   for(const type of ['mousePressed','mouseReleased']){sameLive();await cdp.send('Input.dispatchMouseEvent',{type,x:point.x,y:point.y,button:'left',clickCount:1});sameLive();}
   eq(await evaluate(city4FocusRegionExpression(point)),initial);const events=await evaluate('__city4MarchProbe.pointers.slice('+pointerStart+')');eq(events.map(e=>[e.type,e.tag,e.id,e.trusted,e.keys]),['mousedown','mouseup','click'].map(type=>[type,'SPAN','baye-game-focus',true,second.state.keys]));
   const focused=await protectedPair(second,{focus:true});await sink.write('transition-visible-focus.json',{initial,point,events,focus:focused.focus,nativeInputs:0});
   await sink.write('transition-before-system-escape.json',{before:second,observerExpected:observers,nativeCode:40,maximumOwnedRunnerEnd:0});await protectedPair(second,{focus:true});const keys=await physical(40,'open exact conditional END FunctionMenu',second);report.systemEscapeObserved=true;
   const firstMenu=await stable('current native conditional END menu',t=>{const s=t.state;return s.menu.active===1&&s.menu.context===2&&s.menu.kind===1&&s.menu.index===0&&(t.meta.overworldMode==='classic'||s.overworld==='other');}),secondMenu=await current('second independent settled END owner'),final=await current('final independent settled END owner');eq(firstMenu,secondMenu);eq(secondMenu,final);
   const endReady={before:second,first:firstMenu,second:secondMenu,final,keys},admission=verifyCity4EndAdmission({input,ledger,saveTags,observerExpected:observers,hookFence:final.meta.v32HookFence,endReady});assert.equal(admission.nextNativeConfirm,39);
   const last=await protectedPair(final,{focus:true,system:true});await sink.write('transition-conditional-end-admission.json',{endReady,admission,observer:last.observer,observerExpected:observers,maximumOwnedRunnerEnd:0,sourceForecastIsIncome:false});
   const capability=Object.freeze({session,cdp,sameSession:identity,observerExpected:observers,observerEpochTicket:copy(second),endReady:copy(endReady),admission:copy(admission),maximumPreparedEndCommitAttempts:1,ownedRunnerExecutionEnabled:false,sourceOnly:true,...noCredit()});
   admissions.set(capability,{driver,anchor,session,cdp,identity,input,ledger,saveTags,endReady:copy(endReady),admission:copy(admission),observerEpochTicket:copy(second),epoch:copy(epoch),speGeneration});currentAdmission=capability;readLease=Object.freeze({driver,anchor,session,cdp,identity,send,admission:capability,admissionRecord:admissions.get(capability),epoch,admissionEpoch:admissions.get(capability).epoch,speGeneration});report.phase='conditional-end-qualified-prepared-stage';return capability;
  }catch(error){await failure(error);throw error;}
 }
 async function commitEndExactlyOnce(options){
  const {admission}=fields(options,['admission'],'Conditional END commit');assertCity4EndObserverAdmissionCapability(admission,{anchor,session,cdp});assert.equal(admission,currentAdmission);assert.equal(commitStarted,false,'No repeated or uncertain END retry');assert.equal(report.phase,'conditional-end-qualified-prepared-stage');commitStarted=true;
  // This is the normal one-use stage API, not an execution flag or test branch.
  // A real owned runner must statically compose retention, continuation, battle
  // close and terminal release before calling it. This candidate provides none.
  try{
   const stored=admissions.get(admission);assertCity4OriginBoundAnchorCapability(anchor,{session,cdp});assert.equal(anchor.report.nativeSaveCommitAttempts.length,1,'Only the genuine anchor SAVE may precede END');verifyCity4EndAdmission({input,ledger,saveTags,observerExpected:observers,hookFence:stored.endReady.final.meta.v32HookFence,endReady:stored.endReady});
   await sink.write('transition-end-commit-admission.json',{endReady:stored.endReady,admission:stored.admission,reservationWillPrecedeKeyDown:true,originalSaveAttempts:copy(anchor.report.nativeSaveCommitAttempts),cleanupAuthorized:false});
   // Last independent full owner/UI/storage/focus/observer check follows every
   // expensive source/formal/evidence operation; no file write lies between it
   // and the conservative in-memory reservation plus keyDown.
   await protectedPair(stored.endReady.final,{focus:true,system:true});assert.equal(anchor.report.nativeSaveCommitAttempts.length,1);const keys=await physical(39,'single current conditional END row0 confirmation',stored.endReady.final);await sink.write('transition-end-dispatch-observed.json',{keys,attempts:copy(attempts),dispatchObservations:copy(report.dispatchObservations),nextAction:'same-process bound native callback continuation',cleanupAuthorized:false});report.phase='end-dispatched-live-continuation-required';
   return{session,cdp,sameSession:identity,admissionCapability:admission,keys,observerExpected:observers,observerEpochTicket:copy(stored.observerEpochTicket),endCommitAttempted:true,cleanupAuthorized:false,sessionReleaseAllowed:false,...noCredit()};
  }catch(error){await failure(error);throw error;}
 }
 function readerAdmission(label){assertCity4OriginBoundAnchorCapability(anchor,{session,cdp});assert.ok(epoch&&speGeneration!==null,'The complete observer installation epoch must have qualified');assert.ok(typeof label==='string'&&label.length>0&&label.length<=160);sameLive();}
 function readOnlyAdmission(label){if(readLease===null){readerAdmission(label);return;}assert.ok(typeof label==='string'&&label.length>0&&label.length<=160);assertCity4ObserverStageReadBinding(driver,{originCapability:anchor,session,cdp});}
 function readCurrentAtomic(value){observed(value.ticket);eq(value.owner,nativeOwner(value.ticket),'Independent current raw native owner equals the full current ticket');eq(value.nativeKeyCount,value.ticket.state.keys);assert.ok(Number.isInteger(value.seed)&&value.seed>=0&&value.seed<=0xffffffff);assertObserver(value.observer);assert.ok(value.pair&&typeof value.pair.sav0==='string'&&typeof value.pair.sav1==='string');for(const hex of Object.values(value.pair))assert.match(hex,/^(?:[0-9a-fA-F]{2})+$/);assert.ok(value.journal===null||typeof value.journal==='string');return copy(value);}
 const readObserverTicket=async label=>{readerAdmission(label);return current(label);};
 async function readObserver(label){readOnlyAdmission(label);const startedAt=performance.now(),value=readCurrentAtomic(await evaluate(atomicExpression)),observedAt=performance.now(),observer=copy(value.observer);lastTicket=copy(value.ticket);await sink.write('transition-observer-'+String(ordinal++).padStart(4,'0')+'.json',{label,value:copy(observer),startedAt,observedAt,nodeBoundaryOnly:true});sameLive();return copy(observer);}
 async function readObserverProtected(label){readOnlyAdmission(label);const startedAt=performance.now(),value=readCurrentAtomic(await evaluate(atomicExpression)),observedAt=performance.now();lastTicket=copy(value.ticket);const {seed,...rest}=value;await sink.write('transition-protected-'+String(ordinal++).padStart(4,'0')+'.json',{label,value:{...rest,seedFingerprint:sha(Buffer.from('native-seed-u32:'+String(seed)))},startedAt,observedAt,nodeBoundaryOnly:true});sameLive();return copy(value);}
 const driver=Object.freeze({prepareAdmission,commitEndExactlyOnce,readObserverTicket,readCurrentObservedTicket:readObserverTicket,readObserverProtected,readObserver,readiness:CITY4_END_TRANSITION_READINESS,status:()=>({phase:report.phase,started,installed,commitStarted,endCommitAttempted:report.endCommitAttempted,endNativeAckObserved:report.endNativeAckObserved,attempts:copy(attempts),report:copy(report),exclusiveArtifactPins:sink.pins(),sameSession:identity,session,cdp,...noCredit()})});owners.set(anchor,driver);stages.set(driver,{strongRootMethods:captureStrongRootMethods(anchor),anchor,session,cdp,identity,sameLive,input,ledger,saveTags,libBytes,nativeBudget,admission:()=>currentAdmission,readLease:()=>readLease,readState:()=>({installed,epoch,speGeneration,admission:currentAdmission}),state:()=>({phase:report.phase,installed,endCommitAttempted:report.endCommitAttempted,endNativeAckObserved:report.endNativeAckObserved})});return driver;
}

/** Private same-module admission branding and complete graph revalidation.
 * This is not an owned-runner or cleanup permit. The one-use prepared commit
 * stage is authorized only by its original captured graph, never a receipt's
 * accepted:true scalar or a caller-provided execution flag. */
export function assertCity4EndObserverAdmissionCapability(capability,{anchor,session,cdp}={}){
 const b=admissions.get(capability);assert.ok(b,'Only this exact same-module admission capability is accepted');assert.ok(b.anchor===anchor&&b.session===session&&b.cdp===cdp&&capability.session===session&&capability.cdp===cdp&&capability.sameSession===b.identity,'The complete same-Node origin/admission identity remains bound');
 assertCity4OriginBoundAnchorCapability(anchor,{session,cdp});eq(capability.endReady,b.endReady,'All originally observed admission tickets and native Escape receipts remain unchanged');eq(capability.admission,b.admission,'The complete originally derived conditional proof remains unchanged');eq(capability.observerExpected,observers);eq(capability.observerEpochTicket,b.observerEpochTicket);
 const proof=verifyCity4EndAdmission({input:b.input,ledger:b.ledger,saveTags:b.saveTags,observerExpected:observers,hookFence:b.endReady.final.meta.v32HookFence,endReady:b.endReady});
 return{conditionalEndAdmissionQualified:proof.conditionalEndAdmissionQualified,sourceOnly:true,maximumPreparedEndCommitAttempts:1,ownedRunnerExecutionEnabled:false,cleanupAuthorized:false,sessionReleaseAllowed:false,sameSession:b.identity,observerExpected:observers};
}

/** Pure same-module stage attestation for statically imported collector/terminal
 * adapters. All source authority is rederived; it never supplies a cleanup bit. */
export function assertCity4ObserverStageCapability(stage,{originCapability,session,cdp}={}){
 const b=stages.get(stage);assert.ok(b,'Only the original stage from this exact module instance is accepted');assert.ok(b.anchor===originCapability&&b.session===session&&b.cdp===cdp&&stage===owners.get(originCapability),'Original stage/origin/session/CDP references required');b.sameLive();const admission=b.admission();assert.ok(admission,'The whole observer transition and conditional admission must have completed');assertCity4EndObserverAdmissionCapability(admission,{anchor:originCapability,session,cdp});const p=admissions.get(admission),state=b.state();assert.ok(state.installed);
 return{originCapability:b.anchor,observerExpected:copy(observers),observerEpochTicket:copy(p.observerEpochTicket),libBytes:rawCopy(b.libBytes,CITY4_END_LIBRARY_PIN),nativeBudget:copy(b.nativeBudget),saveTags:copy(b.saveTags),admissionCapability:admission,endCommitAttempted:state.endCommitAttempted,endNativeAckObserved:state.endNativeAckObserved,phase:state.phase,sameSession:b.identity,session,cdp,sourceOnly:true,cleanupAuthorized:false,sessionReleaseAllowed:false};
}

/** Complete private captured policy as a defensive graph, ready to spread into
 * verifyCity4BeforeOwn/verifyCity4AfterOwnCurrentGuards. No caller ledger is used. */
export function copyCity4ObserverStagePolicy(stage,identity){
 const view=assertCity4ObserverStageCapability(stage,identity),b=stages.get(stage),p=admissions.get(view.admissionCapability);
 return{...copy(b.ledger),observerExpected:copy(observers),hookFence:copy(p.endReady.final.meta.v32HookFence),endReady:copy(p.endReady)};
}

/** Readonly lifetime binding only; never a current origin, input or cleanup permit.
 * Mutable public disclosure graphs are not consumed as source authority here. */
export function assertCity4ObserverStageReadBinding(stage,options={}){
 const b=stages.get(stage);assert.ok(b,'Only this exact same-module stage has a readonly binding');
 assert.ok(options&&typeof options==='object'&&!utilTypes.isProxy(options),'Readonly stage identity: non-proxy own-data options');
 const {originCapability,session,cdp}=fields(options,['originCapability','session','cdp'],'Readonly stage identity');
 assert.ok(b.anchor===originCapability&&b.session===session&&b.cdp===cdp&&stage===owners.get(originCapability),'Original readonly stage/origin/session/CDP references required');b.sameLive();
 const lease=b.readLease(),live=b.readState();assert.ok(lease&&live.installed&&live.admission===lease.admission&&live.epoch===lease.epoch&&live.speGeneration===lease.speGeneration,'A complete private prepared admission and captured observer epoch are required');
 const p=admissions.get(lease.admission);assert.ok(p===lease.admissionRecord&&p.driver===stage&&p.anchor===b.anchor&&p.session===session&&p.cdp===cdp&&p.identity===b.identity&&p.input===b.input&&p.ledger===b.ledger&&p.saveTags===b.saveTags&&p.epoch===lease.admissionEpoch&&p.speGeneration===lease.speGeneration,'Original private admission graph and epoch identities remain bound');
 assert.ok(lease.driver===stage&&lease.anchor===originCapability&&lease.session===session&&lease.cdp===cdp&&lease.identity===b.identity&&own(cdp,'send','Readonly stage CDP')===lease.send,'Original readonly closure references remain bound');b.sameLive();const state=b.state();assert.ok(state.installed);
 return{originCapability:b.anchor,stageCapability:stage,session,cdp,sameSession:b.identity,admissionCapability:lease.admission,endCommitAttempted:state.endCommitAttempted,endNativeAckObserved:state.endNativeAckObserved,readOnlyBinding:true,sourceOnly:true,maximumNewNativeInputs:0,maximumNewEnd:0,cleanupAuthorized:false,sessionReleaseAllowed:false};
}

/** One synchronous full stage/admission/origin authentication plus the complete
 * original private policy. This is rederived per call, never a readonly permit
 * or a cached successful source proof. No caller callback or await is used. */
export function assertCity4ObserverStageStrongBundle(stage,options){
 const b=stages.get(stage);assert.ok(b,'Only this exact same-module stage has a strong bundle');
 assert.ok(options&&typeof options==='object'&&!utilTypes.isProxy(options),'Strong stage identity: non-proxy own-data options');
 const identity=fields(options,['originCapability','session','cdp'],'Strong stage identity');strongStageSourcePreflight(stage,b,identity);
 const view=assertCity4ObserverStageCapability(stage,identity),p=admissions.get(view.admissionCapability);
 return{stageView:view,policy:{...copy(b.ledger),observerExpected:copy(observers),hookFence:copy(p.endReady.final.meta.v32HookFence),endReady:copy(p.endReady)}};
}

// Independent Strong API preflight: current shape only, no proof cache, byte
// clone, previous-graph equality, callback, I/O or await. The sole old full
// Stage -> Admission -> Origin derivation follows this entire synchronous walk.
const STRONG_SHAPE_LIMITS=Object.freeze({nodes:6000000,depth:128,totalBytes:512*1024*1024,byteViewBytes:128*1024*1024,inspectableByteProperties:1024*1024});
const StrongU8=Uint8Array,strongTa=Object.getPrototypeOf(StrongU8.prototype),strongGet=n=>Object.getOwnPropertyDescriptor(strongTa,n).get;
const strongLength=strongGet('length'),strongByteLength=strongGet('byteLength'),strongOffset=strongGet('byteOffset'),strongBuffer=strongGet('buffer'),strongBrand=Object.getOwnPropertyDescriptor(strongTa,Symbol.toStringTag).get,strongBackingLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const strongRootMethodNames=Object.freeze(['readPreEndTicket','readPreEndProtected','exclusiveArtifactPins']);
function strongShapeFail(label){throw Error('Strong source shape: '+label);}
function strongShapeProxy(value,label){if(value!==null&&(typeof value==='object'||typeof value==='function')&&utilTypes.isProxy(value))strongShapeFail(label+' Proxy rejected');}
function strongShapeOwn(value,key,label){strongShapeProxy(value,label);if(!value||typeof value!=='object')strongShapeFail(label+' object required');const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))strongShapeFail(label+' own data required');return d.value;}
function strongShapeLabel(label,key,index){return label+'.'+(typeof key==='string'?key.slice(0,90):'<symbol#'+index+'>');}
function captureStrongRootMethods(origin){
 strongShapeProxy(origin,'Origin root');if(!origin||typeof origin!=='object'||Object.getPrototypeOf(origin)!==Object.prototype||!Object.isFrozen(origin))strongShapeFail('Original frozen Origin root required');
 const refs=Object.create(null);for(const key of strongRootMethodNames){const d=Object.getOwnPropertyDescriptor(origin,key);if(!d||!Object.hasOwn(d,'value')||d.writable||d.configurable)strongShapeFail('Original frozen root method descriptor');strongShapeProxy(d.value,'Original root method');if(typeof d.value!=='function')strongShapeFail('Original root method function required');refs[key]=d.value;}return Object.freeze(refs);
}
function strongShapeByteLength(value,label){
 strongShapeProxy(value,label);if(!utilTypes.isUint8Array(value))strongShapeFail(label+' original Uint8Array/Buffer ABI required');
 let length,byteLength,offset,buffer,backing,brand;try{length=strongLength.call(value);byteLength=strongByteLength.call(value);offset=strongOffset.call(value);buffer=strongBuffer.call(value);backing=strongBackingLength.call(buffer);brand=strongBrand.call(value);}catch{strongShapeFail(label+' intrinsic unshared byte view required');}
 if(brand!=='Uint8Array'||length!==byteLength||!Number.isSafeInteger(length)||length<0||length>STRONG_SHAPE_LIMITS.byteViewBytes||!Number.isSafeInteger(offset)||offset<0||offset+length>backing)strongShapeFail(label+' bounded unshared byte view required');return length;
}
function strongStageSourcePreflight(stage,b,identity){
 const {originCapability,session,cdp}=identity;if(originCapability!==b.anchor||session!==b.session||cdp!==b.cdp||stage!==owners.get(b.anchor))strongShapeFail('Original stage/origin/session/CDP references required');
 const origin=b.anchor,admission=b.admission(),p=admissions.get(admission);if(!p||p.driver!==stage||p.anchor!==origin||p.session!==session||p.cdp!==cdp||p.identity!==b.identity)strongShapeFail('Original private admission graph required');
 strongShapeProxy(origin,'Origin root');strongShapeProxy(admission,'Admission root');if(!origin||Object.getPrototypeOf(origin)!==Object.prototype||!Object.isFrozen(origin)||!admission||Object.getPrototypeOf(admission)!==Object.prototype||!Object.isFrozen(admission))strongShapeFail('Original frozen capability roots required');
 const rootRefs={session,cdp,sameSession:b.identity},sameNode=strongShapeOwn(origin,'sameNode','Origin sameNode');strongShapeProxy(sameNode,'Origin sameNode');
 for(const key of Object.keys(rootRefs)){if(strongShapeOwn(origin,key,'Origin identity')!==rootRefs[key]||strongShapeOwn(admission,key,'Admission identity')!==rootRefs[key])strongShapeFail('Original root identity reference');strongShapeProxy(rootRefs[key],'Original root identity');}
 // sameLive is the original private own-data session/CDP/send identity check.
 // Its remaining direct Origin fields were checked above on a frozen root.
 strongShapeProxy(strongShapeOwn(cdp,'send','Original CDP send'),'Original CDP send');b.sameLive();
 const rawRoles=new Set(['publication','world','sav0','sav1','ledger','final','publicSave','library']),seenData=new WeakSet(),seenRawMaps=new WeakSet(),seenOpaqueBytes=new WeakSet(),seenDataBytes=new WeakSet(),seenOriginRoots=new WeakSet(),seenAdmissionRoots=new WeakSet(),budget={nodes:0,bytes:0};
 function walk(v,label,depth,context='data'){
  strongShapeProxy(v,label);if(typeof v==='function')strongShapeFail(label+' nested function rejected');if(v===null||typeof v!=='object')return;if(++budget.nodes>STRONG_SHAPE_LIMITS.nodes||depth>STRONG_SHAPE_LIMITS.depth)strongShapeFail(label+' graph bound');
  if(utilTypes.isUint8Array(v)){
   const opaque=context==='opaque-byte',seen=opaque?seenOpaqueBytes:seenDataBytes;if(seen.has(v))return;const length=strongShapeByteLength(v,label);budget.bytes+=length;if(budget.bytes>STRONG_SHAPE_LIMITS.totalBytes)strongShapeFail(label+' total byte bound');seen.add(v);if(opaque)return;
   const prototype=Object.getPrototypeOf(v);if(prototype!==Buffer.prototype&&prototype!==StrongU8.prototype)strongShapeFail(label+' standard data byte prototype');if(length>STRONG_SHAPE_LIMITS.inspectableByteProperties)strongShapeFail(label+' nonopaque byte metadata bound');const keys=Reflect.ownKeys(v);if(keys.length<length)strongShapeFail(label+' data byte indices');
   // Native typed-array indices are intrinsic data slots. All additional own
   // keys, including nonenumerable and symbol method/accessor shadows, are data.
   for(let i=length;i<keys.length;i++){const key=keys[i],d=Object.getOwnPropertyDescriptor(v,key),path=strongShapeLabel(label,key,i);if(!d||!Object.hasOwn(d,'value'))strongShapeFail(path+' byte own data required');walk(d.value,path,depth+1);}return;
  }
  const seen=context==='raw-map'?seenRawMaps:context==='origin-root'?seenOriginRoots:context==='admission-root'?seenAdmissionRoots:seenData;if(seen.has(v))return;const prototype=Object.getPrototypeOf(v),array=Array.isArray(v);if(prototype!==(array?Array.prototype:Object.prototype)&&prototype!==null)strongShapeFail(label+' plain disclosure prototype');seen.add(v);
  const keys=Reflect.ownKeys(v);for(let i=0;i<keys.length;i++){const key=keys[i],path=strongShapeLabel(label,key,i),d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))strongShapeFail(path+' own data required');const value=d.value;strongShapeProxy(value,path);
   if((context==='origin-root'||context==='admission-root')&&Object.hasOwn(rootRefs,key)){if(value!==rootRefs[key])strongShapeFail(path+' original root reference');continue;}
   if(context==='origin-root'&&key==='sameNode'){if(value!==sameNode)strongShapeFail(path+' original sameNode reference');continue;}
   if(context==='origin-root'&&strongRootMethodNames.includes(key)){if(!b.strongRootMethods||d.writable||d.configurable||typeof value!=='function'||value!==b.strongRootMethods[key])strongShapeFail(path+' original frozen root method reference');continue;}
   walk(value,path,depth+1,context==='origin-root'&&key==='originBytes'?'raw-map':context==='raw-map'&&rawRoles.has(key)?'opaque-byte':'data');
  }
 }
 walk(origin,'Origin',0,'origin-root');walk(admission,'Admission',0,'admission-root');
}
