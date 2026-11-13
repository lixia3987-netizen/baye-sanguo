// Inert retention candidate. Import/factory never opens a stream, timer, browser or game.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual,types as utilTypes} from 'node:util';
import {verifyCity4PublicSave,verifyCity4Ticket} from './hd-wood-city4-continuation.mjs';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';
import {V32_POLICY_OBSERVER_FUNCTION_SOURCE} from './hd-impact-v32-conditional-plunder-prefix.mjs';

export const CITY4_LIVE_RETENTION_READINESS=Object.freeze({sourceOnly:true,maximumActualEnd:0,executableRunnerProvided:false,reviewedContinuationBound:false,terminalAdapterBound:false,liveCaptureBound:false,cleanupPermitIssuanceBound:false,automaticCleanupProvided:false});
export const CITY4_LIVE_RETENTION_LIMITS=Object.freeze({maximumLineBytes:4096,maximumInputChunkBytes:65536,maximumStatusRows:64,maximumOriginalErrors:8,maximumPendingEvidenceWrites:8,keepAliveIntervalMs:1000,maximumEvidenceJsonNodes:3000000,maximumEvidenceJsonDepth:80,maximumSaveFileBytes:32*1024*1024});
const protocol='city4-live-retention-v1',eq=(a,b,label)=>assert.ok(isDeepStrictEqual(a,b),label||'Whole typed value equality'),sha=b=>createHash('sha256').update(b).digest('hex');
const owners=new WeakMap();
const ta=Object.getPrototypeOf(Uint8Array.prototype),get=name=>Object.getOwnPropertyDescriptor(ta,name).get;
const viewLength=get('length'),viewBytes=get('byteLength'),viewBuffer=get('buffer'),viewOffset=get('byteOffset'),viewBrand=Object.getOwnPropertyDescriptor(ta,Symbol.toStringTag).get,arrayBytes=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;

function data(value,label,array=false){
 assert.ok(value&&typeof value==='object'&&!utilTypes.isProxy(value),label+': plain non-proxy data required');
 eq(Object.getPrototypeOf(value),array?Array.prototype:Object.prototype,label+': standard data prototype');const out=new Map();
 for(const key of Reflect.ownKeys(value)){assert.equal(typeof key,'string',label+': symbol rejected');const d=Object.getOwnPropertyDescriptor(value,key);assert.ok(d&&Object.hasOwn(d,'value'),label+': accessor rejected without invocation');assert.ok(d.enumerable||(array&&key==='length'),label+': hidden property rejected');out.set(key,d.value);}return out;
}
function json(value,label){
 const active=new WeakSet(),stack=[{value,depth:0}];let nodes=0;
 while(stack.length){const row=stack.pop(),v=row.value;if(row.exit){active.delete(v);continue;}assert.ok(++nodes<=CITY4_LIVE_RETENTION_LIMITS.maximumEvidenceJsonNodes,label+': finite node bound');assert.ok(row.depth<=CITY4_LIVE_RETENTION_LIMITS.maximumEvidenceJsonDepth,label+': depth bound');
  if(v===null||typeof v==='string'||typeof v==='boolean')continue;if(typeof v==='number'){assert.ok(Number.isFinite(v),label+': finite number');continue;}assert.ok(v&&typeof v==='object',label+': JSON value required');const array=Array.isArray(v),fields=data(v,label,array);assert.ok(!active.has(v),label+': cycle rejected');active.add(v);stack.push({value:v,exit:true});
  if(array){const n=fields.get('length');assert.ok(Number.isSafeInteger(n)&&n>=0&&n<=CITY4_LIVE_RETENTION_LIMITS.maximumEvidenceJsonNodes-nodes);assert.equal(fields.size,n+1,label+': dense array without extra properties');for(let i=n-1;i>=0;i--){assert.ok(fields.has(String(i)),label+': array hole');stack.push({value:fields.get(String(i)),depth:row.depth+1});}}
  else for(const child of fields.values())stack.push({value:child,depth:row.depth+1});
 }return nodes;
}
function byteCopy(value,maximum,label){
 assert.ok(value&&typeof value==='object'&&!utilTypes.isProxy(value),label+': native byte view');let n,b,o,brand;
 try{n=viewLength.call(value);assert.equal(viewBytes.call(value),n);brand=viewBrand.call(value);b=viewBuffer.call(value);o=viewOffset.call(value);assert.ok(o>=0&&o+n<=arrayBytes.call(b));}catch{assert.fail(label+': bounded unshared Uint8Array/Buffer');}
 assert.ok(brand==='Uint8Array'&&Number.isSafeInteger(n)&&n>0&&n<=maximum,label+': bounded byte count');return Buffer.from(new Uint8Array(b,o,n));
}
function ordinary(ticket,a){
 verifyCity4Ticket({ticket,...a});const s=ticket.state,z=s.snapshot;
 eq([z.fight.active,z.spe.active,z.result.active,z.top.active,z.report.active,s.menu.active,s.qty.active,s.record.active,s.march.pick,s.march.battlePick,s.overworld],[0,0,false,false,0,0,0,0,1,0,'map'],'Only a complete ordinary MAP excludes every competing owner');
}
function sameEpoch(first,current,a){eq(verifyCity4Ticket({ticket:first,...a}).epoch,verifyCity4Ticket({ticket:current,...a}).epoch,'Whole same-session reference, LIB, config and observer epoch');eq(first.state.snapshot.spe.generation,current.state.snapshot.spe.generation);}
function nextMonth(w){return w.month===12?[w.year+1,1]:[w.year,w.month+1];}

/** Pure evidence predicate, NOT a lease release method or a genuine transport.
 * The two current tickets and protected pair must eventually be captured by a
 * statically reviewed same-CDP terminal adapter. Caller-supplied evidence alone
 * never gives this module a private cleanup capability. */
export function verifyCity4TerminalSaveEvidence(args){
 const f=data(args,'Terminal SAVE evidence'),required=['publicSave','publicPair','publicKeys','world','expectedSaveTag','libBytes','nativeBudget','observerExpected','epochAnchor','currentFirst','currentSecond','currentPair','files'];
 eq([...f.keys()].sort(),[...required].sort(),'Only the complete declared terminal evidence fields');
 const plain=Object.fromEntries(required.filter(k=>!['libBytes','files'].includes(k)).map(k=>[k,f.get(k)]));json(plain,'Complete terminal SAVE JSON');
 const rawLib=byteCopy(f.get('libBytes'),207195,'Original runtime LIB');assert.equal(rawLib.length,207195);assert.equal(sha(rawLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 const {publicSave,publicPair,publicKeys,world,expectedSaveTag,nativeBudget,observerExpected,epochAnchor,currentFirst,currentSecond,currentPair}=plain;
 eq(observerExpected,{functionSource:V32_POLICY_OBSERVER_FUNCTION_SOURCE},'Exact read-only V32 observer remains installed');const a={libBytes:rawLib,nativeBudget,observerExpected};
 ordinary(publicSave.before,a);ordinary(publicSave.after,a);ordinary(currentFirst,a);ordinary(currentSecond,a);sameEpoch(epochAnchor,publicSave.before,a);sameEpoch(epochAnchor,currentSecond,a);
 eq(currentFirst,currentSecond,'Two independent current full MAP reads must agree');eq(currentSecond,publicSave.after,'No owner, keys, world, snapshot or unknown field changed after genuine SAVE');eq(currentSecond.world,world,'Current complete world equals the saved world');eq(currentPair,publicPair,'Current protected storage pair is the exact verified SAVE pair');
 eq([world.year,world.month],nextMonth(epochAnchor.world),'The one END natural month must already have fully converged');eq([world.period,world.king],[epochAnchor.world.period,epochAnchor.world.king],'Unexpected succession requires a separate reviewed terminal policy');assert.ok(world.orders.every(o=>o.OrderId===255),'No remaining policy order can be abandoned at release');
 const saveProof=verifyCity4PublicSave({publicSave,publicPair,publicKeys,world,expectedSaveTag,...a}),packed=verifyOriginalSavePair({...publicPair,world});assert.equal(packed.ok,true);
 const files=f.get('files'),fields=data(files,'Both terminal SAV byte records',true);eq(fields.get('length'),2);eq(fields.size,3);const filePins=[];
 for(let i=0;i<2;i++){const row=data(fields.get(String(i)),'Terminal SAV byte record');eq([...row.keys()].sort(),['bytes','path']);const expected=publicSave.files[i],bytes=byteCopy(row.get('bytes'),CITY4_LIVE_RETENTION_LIMITS.maximumSaveFileBytes,'Terminal SAV'+i);eq(row.get('path'),expected.path);eq(bytes.length,expected.bytes);eq(sha(bytes),expected.sha256);assert.ok(bytes.equals(Buffer.from(publicPair['sav'+i],'hex')),'Raw actual SAV file equals the complete packed public SAVE pair');filePins.push({path:expected.path,bytes:bytes.length,sha256:sha(bytes)});}
 return{terminalEvidenceQualified:true,wholePackedAndPublicOwnerMeasured:saveProof.wholePackedAndPublicOwnerMeasured,tag:expectedSaveTag,files:filePins,worldSha256:sha(Buffer.from(JSON.stringify(world))),cleanupAuthorized:false,sessionReleaseAllowed:false,sameNodeLiveCaptureAuthenticated:false,requiresReviewedTerminalAdapter:true,sourceOnly:true,actualPublicSaveAccepted:false,actualMonthAccepted:false,hdAccepted:false};
}

// Never touch .stack/.message getters or coercion hooks while preserving failure.
function failureDescription(error){
 if(typeof error==='string')return{type:'string',text:error.slice(0,1000)};if(error===null)return{type:'null'};
 if(typeof error!=='object'&&typeof error!=='function')return{type:typeof error};if(utilTypes.isProxy(error))return{type:'proxy-error',printable:false};
 try{const d=Object.getOwnPropertyDescriptor(error,'message');return{type:'object-error',message:d&&Object.hasOwn(d,'value')&&typeof d.value==='string'?d.value.slice(0,1000):null};}catch{return{type:'unprintable-error',printable:false};}
}
function parseCommand(line){
 assert.equal(typeof line,'string');assert.ok(Buffer.byteLength(line)<=CITY4_LIVE_RETENTION_LIMITS.maximumLineBytes,'Bounded JSON command line');const c=JSON.parse(line),fields=data(c,'Retention command');eq([...fields.keys()].sort(),['command','id','protocol']);eq(fields.get('protocol'),protocol);assert.ok(typeof c.id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(c.id),'Bounded response id');assert.ok(['status','continue-reviewed','verify-terminal-save'].includes(c.command),'Unknown retention command refused');return c;
}

/** Same-process retention is real; END/continuation/terminal bindings are not.
 * Existing reviewed N8 connect() encloses its WebSocket in cdp.send/close.
 * Retaining the exact cdp object retains that closure. No new port, connection,
 * process or serialized capability can replace it. startRetention() is explicit.
 * This version deliberately has no callback-registration or release method. */
export function createCity4LiveRetentionDriver({session,cdp,input=process.stdin,output=process.stdout,persistExclusive=null}){
 assert.ok(session&&session.identity&&typeof session.identity==='object'&&session.cdp===cdp&&cdp&&typeof cdp.send==='function','Exact same-Node session/CDP capability required');assert.ok(!owners.has(session.identity),'Only one retention driver per live session');
 assert.ok(input&&typeof input.on==='function'&&typeof input.pause==='function');assert.ok(output&&typeof output.write==='function'&&typeof output.on==='function');assert.ok(persistExclusive===null||typeof persistExclusive==='function');
 const retained=Object.freeze({session,cdp,identity:session.identity});let started=false,timer=null,stdinEnded=false,inputDisabled=false,signalCount=0,ordinal=0,pendingWrites=0,buffer=Buffer.alloc(0),chain=Promise.resolve();const rows=[],originalErrors=[];
 const status=()=>({protocol,sourceOnly:true,started,retainedLiveCapability:true,sameNodeSession:true,cdpClosureRetained:true,rawSocketHealthIndependentlyBound:false,unsafe:true,cleanupAuthorized:false,sessionReleaseAllowed:false,stdinEnded,inputDisabled,signalCount,evidenceRows:rows.length,pendingEvidenceWrites:pendingWrites,originalErrorIdentitiesRetained:originalErrors.length,continuationBound:false,terminalAdapterBound:false,maximumActualEnd:0,readiness:CITY4_LIVE_RETENTION_READINESS});
 const write=value=>{try{output.write(JSON.stringify(value)+'\n');}catch(error){if(rows.length===CITY4_LIVE_RETENTION_LIMITS.maximumStatusRows)rows.shift();rows.push({kind:'output-failed',error:failureDescription(error),cleanupAuthorized:false});}};
 function note(kind,details={}){
  const row={ordinal:ordinal++,kind,...details,cleanupAuthorized:false,sessionReleaseAllowed:false};if(rows.length===CITY4_LIVE_RETENTION_LIMITS.maximumStatusRows)rows.shift();rows.push(row);
  if(persistExclusive&&pendingWrites<CITY4_LIVE_RETENTION_LIMITS.maximumPendingEvidenceWrites){pendingWrites++;Promise.resolve().then(()=>persistExclusive('live-retention-'+String(row.ordinal).padStart(6,'0')+'.json',row)).catch(error=>{if(rows.length===CITY4_LIVE_RETENTION_LIMITS.maximumStatusRows)rows.shift();rows.push({kind:'evidence-write-failed',error:failureDescription(error),originalRowOrdinal:row.ordinal,cleanupAuthorized:false});}).finally(()=>{pendingWrites--;});}return row;
 }
 async function admit(line){
  let c;try{c=parseCommand(line);}catch(error){note('command-rejected',{error:failureDescription(error)});write({protocol,id:null,accepted:false,code:'invalid-command',cleanupAuthorized:false});return;}
  if(c.command==='status'){write({protocol,id:c.id,accepted:true,status:status()});return;}
  // No arbitrary actualResume/terminalAdapter can be registered into this source.
  // Later source-bound glue must make fresh measurements, re-run the full SAVE
  // predicate and privately issue a one-use cleanup permit in this same closure.
  const code=c.command==='continue-reviewed'?'reviewed-continuation-unbound':'reviewed-terminal-live-capture-unbound';note('command-refused-unbound',{command:c.command,id:c.id,code});write({protocol,id:c.id,accepted:false,code,cleanupAuthorized:false,maximumActualEnd:0});
 }
 const enqueue=line=>{chain=chain.then(()=>admit(line)).catch(error=>{note('command-handler-failed',{error:failureDescription(error)});write({protocol,accepted:false,code:'handler-failed-live-retained',cleanupAuthorized:false});});};
 function onData(chunk){
  if(inputDisabled)return;try{const bytes=typeof chunk==='string'?Buffer.from(chunk):byteCopy(chunk,CITY4_LIVE_RETENTION_LIMITS.maximumInputChunkBytes,'Bounded stdin chunk');assert.ok(bytes.length<=CITY4_LIVE_RETENTION_LIMITS.maximumInputChunkBytes);buffer=Buffer.concat([buffer,bytes]);let at;
   while((at=buffer.indexOf(10))!==-1){const line=buffer.subarray(0,at),rest=buffer.subarray(at+1);assert.ok(line.length<=CITY4_LIVE_RETENTION_LIMITS.maximumLineBytes);enqueue(line.toString('utf8').replace(/\r$/,''));buffer=Buffer.from(rest);}assert.ok(buffer.length<=CITY4_LIVE_RETENTION_LIMITS.maximumLineBytes);
  }catch(error){inputDisabled=true;buffer=Buffer.alloc(0);try{input.pause();}catch{}note('stdin-disabled-live-retained',{error:failureDescription(error)});write({protocol,accepted:false,code:'stdin-bound-or-read-failure',cleanupAuthorized:false});}
 }
 function onEnd(){stdinEnded=true;inputDisabled=true;buffer=Buffer.alloc(0);note('stdin-eof-live-retained');write({protocol,event:'stdin-eof',status:status()});}
 function onInputError(error){inputDisabled=true;buffer=Buffer.alloc(0);note('stdin-error-live-retained',{error:failureDescription(error)});write({protocol,event:'stdin-error',status:status()});}
 function onOutputError(error){note('stdout-error-live-retained',{error:failureDescription(error)});}
 function onSigint(){signalCount++;note('SIGINT-live-retained',{signalCount});write({protocol,event:'SIGINT',status:status()});}
 const driver=Object.freeze({
  identity:retained.identity,session:retained.session,cdp:retained.cdp,readiness:CITY4_LIVE_RETENTION_READINESS,status,
  startRetention(){assert.equal(started,false,'Retention already started');started=true;timer=setInterval(()=>{void retained.cdp;},CITY4_LIVE_RETENTION_LIMITS.keepAliveIntervalMs);timer.ref();input.on('data',onData);input.on('end',onEnd);input.on('error',onInputError);output.on('error',onOutputError);process.on('SIGINT',onSigint);if(input.readableEnded)onEnd();note('live-retention-started');write({protocol,event:'retained',status:status()});return driver;},
  retainAfterFailure(error){assert.ok(started,'Start retention before END can become unsafe');if(originalErrors.length<CITY4_LIVE_RETENTION_LIMITS.maximumOriginalErrors)originalErrors.push(error);note('caught-failure-live-retained',{error:failureDescription(error)});return{kind:'retained-live-unresolved',sameSession:retained.identity,session:retained.session,cdp:retained.cdp,originalError:error,cleanupAuthorized:false,sessionReleaseAllowed:false,driver};},
  async waitForReviewedRelease(){assert.ok(started);return new Promise(()=>{});},
  // Controlled future tests can feed precisely the same bounded command parser;
  // this method has the same fixed whitelist and cannot carry functions/tickets.
  async handleCommandLine(line){assert.ok(started);return admit(line);}
 });owners.set(retained.identity,driver);return driver;
}
