// Inert source candidate. No runner, LOAD, SAVE, END, process or cleanup entry.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual,types as utilTypes} from 'node:util';
import {verifyCity4Ticket,verifyCity4BeforeOwn,verifyCity4AfterOwnCurrentGuards} from './hd-wood-city4-continuation.mjs';
import {sourceOriginalWoodRoute} from './hd-wood-native-route.mjs';
import {city4TicketExpression} from './hd-wood-city4-ticket-view.mjs';
import {assertCity4FirstOwnCapability} from './hd-wood-city4-first-own.mjs';
import {assertCity4ObserverStageCapability} from './hd-wood-city4-observer-transition.mjs';

export const CITY4_BATTLE_CLOSE_READINESS=Object.freeze({sourceOnly:true,requiresPrivateFirstOwn:true,readonlyObservationPreparationProvided:true,alreadyObservedNaturalMapProvided:true,executionEnabled:false,maximumActualEnd:0,executableRunnerProvided:false,realFinalSaveBound:false,automaticCleanupProvided:false,incidentalDefenderInputBound:false});
export const CITY4_BATTLE_CLOSE_LIMITS=Object.freeze({maximumCloseKeys:24,maximumCancels:6,maximumStablePairAttempts:12,maximumNaturalWaitMs:240000,maximumDistinctTicketArtifacts:192,maximumArtifactBytes:32*1024*1024});
const eq=(a,b,label)=>assert.ok(isDeepStrictEqual(a,b),label||'Complete typed value equality'),copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex');
const keyNames=Object.freeze({34:'ArrowUp',35:'ArrowDown',39:'Enter',40:'Escape'}),virtualKeys=Object.freeze({34:38,35:40,39:13,40:27});
const uint=(n,max,label)=>assert.ok(Number.isInteger(n)&&n>=0&&n<=max,label);
const noCredit=()=>({sourceOnly:true,actualEndAccepted:false,actualMonthAccepted:false,actualBattleAccepted:false,actualCastAccepted:false,actualPublicSaveAccepted:false,actualIncomeAccepted:false,ordinaryEndAccepted:false,publishedNewMainInput:false,hdAccepted:false,globalHdComplete:false});

// Failure diagnostics must not invoke a thrown value's stack/message getter or
// coercion hook. The original value is returned separately, never serialized.
function failureDiagnostic(error){
 try{
  if(typeof error==='string')return{type:'string',text:error.slice(0,2000)};
  if(error===null)return{type:'null'};
  if(typeof error!=='object'&&typeof error!=='function')return{type:typeof error};
  if(utilTypes.isProxy(error))return{type:'proxy-error',printable:false};
  const result={type:'object-error'};
  for(const key of['message','stack']){const d=Object.getOwnPropertyDescriptor(error,key);if(d&&Object.hasOwn(d,'value')&&typeof d.value==='string')result[key]=d.value.slice(0,4000);}
  return result;
 }catch{return{type:'unprintable-error',printable:false};}
}

function quiet(t){const s=t.state,z=s.snapshot;return z.spe.active===0&&z.result.active===false&&z.top.active===false&&z.report.active===0&&!s.qty.active&&!s.record.active;}
function ordinaryMap(t){const s=t.state,z=s.snapshot;return quiet(t)&&z.fight.active===0&&s.menu.active===0&&s.march.pick===1&&s.march.battlePick===0&&s.overworld==='map';}
function nextMonth(w){return w.month===12?[w.year+1,1]:[w.year,w.month+1];}

/** No world prediction: classify only the current complete measured owner. */
export function classifyCity4BattleCloseTicket(t){
 assert.ok(t&&t.state&&t.world&&t.meta);const s=t.state,f=s.snapshot.fight;
 if(s.qty.active||s.record.active)return{kind:'unsupported-quantity-or-record'};
 if(s.menu.active&&s.menu.context===5)return{kind:'unsupported-incidental-defender'};
 if(ordinaryMap(t))return{kind:'ordinary-map'};
 if(!quiet(t))return{kind:'natural-effect-or-report-wait'};
 if(f.active===1&&f.over===0){
  // Original FgtGetFoucs has already returned: native blocking SYSTEM and
  // RETREAT PlcSplMenu keep wait/phase zero. They are not PICK/MOVE/AIM waits.
  if([6,7].includes(f.inputKind)){
   if(f.wait!==0||f.phase!==0)return{kind:'unsupported-native-blocking-state',inputKind:f.inputKind};
   const m=s.menu;if(m.active!==1||m.context!==3||m.kind!==f.inputKind)return{kind:'unsupported-native-blocking-menu',inputKind:f.inputKind};
   return{kind:'own-battle-input',inputKind:f.inputKind};
  }
  if(f.wait!==1)return{kind:'natural-engine-wait'};
  if([1,2,3,4,5,6,7].includes(f.inputKind))return{kind:'own-battle-input',inputKind:f.inputKind};
  return{kind:'unsupported-battle-input',inputKind:f.inputKind};
 }
 if(f.active===0||f.over!==0)return{kind:'natural-settlement-wait'};
 return{kind:'unsupported-native-owner'};
}

function args(libBytes,nativeBudget,observerExpected){return{libBytes,nativeBudget,observerExpected};}
function epoch(t,a){return verifyCity4Ticket({ticket:t,...a}).epoch;}
function sameEpoch(first,current,a){
 const x=epoch(first,a),y=epoch(current,a);
 eq(y,x,'Same owned session: all config, LIB, references, hooks and unknown metadata remain bound');
 eq(current.state.snapshot.spe.generation,first.state.snapshot.spe.generation,'SPE generation cannot change inside a battle-close session');
}
function assertRoute(t,route){
 const f=t.state.snapshot.fight,n=t.state.snapshot.nativeBattle;
 eq([n.mode,n.way,n.mapId,n.cityIndex],[1,route.nativeWay,route.mapId,route.destination],'Only current original city4-to10 map111 offensive battle');
 eq(f.cityIndex,route.destination);eq([t.world.period,t.world.king],[4,0]);
}
function assertQuietOwn(t,route){assertRoute(t,route);assert.ok(quiet(t),'No input while SPE/result/HOLD/report/quantity/record owns the engine');const f=t.state.snapshot.fight;if([6,7].includes(f.inputKind))eq([f.active,f.over,f.wait,f.phase],[1,0,0,0],'Original native SYSTEM/RETREAT blocking owner requires wait0/phase0');else eq([f.active,f.over,f.wait],[1,0,1]);}
function systemOwner(t,kind,route){
 assertQuietOwn(t,route);const m=t.state.menu,f=t.state.snapshot.fight;
 eq([m.active,m.context,m.kind,f.inputKind],[1,3,kind,kind],'Current actual native SYSTEM/RETREAT owner');
 uint(m.seq,0xffffffff,'Native menu sequence');assert.ok(m.seq>0);uint(m.index,m.count-1,'Current native menu index');
 assert.ok(Array.isArray(m.names)&&m.count>0&&m.count<=32&&m.names.length===m.count&&Object.keys(m.names).length===m.count);
 assert.ok(m.names.every(n=>typeof n==='string'));eq(m.packedNames,m.names,'Complete native retreat menu text');
 eq([m.generation,m.detailGeneration],[t.state.snapshot.spe.generation,t.state.snapshot.spe.generation]);
 eq([m.idsValid,m.ids],[false,[]]);
 const target=kind===6?1:0;eq(m.names[target],'全军撤退','Original C SYSTEM case1 and RETREAT row0, never a guessed label');
 eq(m.names.filter(n=>n==='全军撤退').length,1);if(kind===7)eq(m.count,1,'Original one-item native retreat confirmation');
 return{target,menu:copy(m),fight:copy(f)};
}
function noCampaignMutation(before,after,a){
 sameEpoch(before,after,a);eq(after.world,before.world,'Original cancel/menu navigation cannot rewrite any measured campaign world field');
 eq(after.meta.cityPos,before.meta.cityPos,'Native battle close navigation preserves strategic cursor');
}

/** Installed at an already qualified PICK, before retreat or natural battle end.
 * The native C event fires after FightResultDeal writes, before order removal.
 * This listener observes only; it never replaces a gameplay hook or emits a key. */
export const CITY4_BATTLE_CLOSE_OBSERVER_SOURCE=`(()=>{
 if(window.__city4EndBattleClose)throw Error('Duplicate battle-close observer');
 const read=()=>(${city4TicketExpression}),copy=x=>JSON.parse(JSON.stringify(x));
 const store={schemaVersion:1,rows:[],errors:[],nativeInputs:0};
 const listener=event=>{try{if(store.rows.length>=8)throw Error('Bounded battle settlement observation limit');const a=read(),b=read();store.rows.push({ordinal:store.rows.length,event:'baye-hd-battle-settled',detail:copy(event.detail),a,b,at:performance.now()});}catch(e){store.errors.push(String(e&&e.stack||e));}};
 Object.defineProperty(store,'listener',{value:listener});window.addEventListener('baye-hd-battle-settled',listener);
 window.__city4EndBattleClose=store;return{installed:true,readOnly:true,keys:window.__city4MarchProbe.keys.length};
})()`;

/** A complete observed MAP may be handed to a separately reviewed SAVE layer.
 * This function grants neither SAVE success nor safe session release. */
export function verifyCity4OrdinaryMapForSave({firstPick,map,settlement,observer,a}){
 const old=firstPick.ticket;verifyCity4BeforeOwn({...firstPick,...a});sameEpoch(old,map,a);
 assert.ok(ordinaryMap(map),'Only ordinary native MAP with all competing owners retired may be handed to SAVE');
 eq([map.world.period,map.world.king],[old.world.period,old.world.king],'Unexpected succession or campaign end needs its own reviewed continuation');
 eq([map.world.year,map.world.month],nextMonth(old.world),'Exactly one original natural month must have fully converged');
 assert.ok(map.world.orders.every(o=>o.OrderId===255),'PolicyExec must drain every actual active order before a MAP handoff');
 assert.ok(settlement&&settlement.event==='baye-hd-battle-settled');eq(settlement.a,settlement.b,'Synchronous C settlement event has two whole identical reads');
 const t=settlement.b,d=settlement.detail;verifyCity4Ticket({ticket:t,...a});sameEpoch(old,t,a);
 eq([d.generation,d.detailGeneration,d.city,d.mode,d.playerKing],[old.state.snapshot.spe.generation,old.state.snapshot.spe.generation,10,1,old.world.king]);
 assert.ok([1,2].includes(d.over),'Original C win/loss outcome only');eq([t.state.snapshot.fight.active,t.state.snapshot.fight.over],[0,d.over]);
 eq([t.world.year,t.world.month],[old.world.year,old.world.month],'C battle settlement precedes ConditionUpdate');
 eq(t.world.orders[0],{...firstPick.callback.b.world.orders[0],OrderId:255},'Previously observed Plunder order stays retired with opaque fields intact');
 eq(t.world.orders[170],firstPick.callback.order,'Settlement notification occurs before native March order is removed');
 for(const slot of[0,170])eq(map.world.orders[slot],{...firstPick.callback.b.world.orders[slot],OrderId:255},'Only original order retirement; opaque native bytes retained');
 eq(map.state.keys,t.state.keys,'No further native key is permitted during natural post-battle policy and monthly settlement');
 assert.ok(observer&&observer.samples.length);const last=observer.samples.at(-1);
 // Validate every current callback, async/context and current strict-food guard
 // in its original pre-ConditionUpdate epoch. Final-month economics are retained,
 // not compared to a synthetic monthly outcome or used to authorize another END.
 verifyCity4AfterOwnCurrentGuards({...firstPick,...a,observer,ticket:last.b});
 return{kind:'ordinary-map-ready-for-reviewed-save',saveObserved:false,sessionReleaseAllowed:false,wholeMap:copy(map),nativeSettlement:copy(settlement),allObservedOrdersDrained:true,oneNaturalMonthObservedInSuppliedTickets:true,finalWorldIsMeasuredNotPredicted:true,futureEndAuthorized:false,...noCredit()};
}

// The original C listener and MAP verifier above remain literal originals. This
// separate fixed owner records the exact installation; no prior store is adopted.
function originalCloseListener(){const marker=' const listener=',start=CITY4_BATTLE_CLOSE_OBSERVER_SOURCE.indexOf(marker),end=CITY4_BATTLE_CLOSE_OBSERVER_SOURCE.indexOf(';\n Object.defineProperty(store,',start);assert.ok(start>=0&&end>start);return CITY4_BATTLE_CLOSE_OBSERVER_SOURCE.slice(start+marker.length,end);}
const CLOSE_OBSERVATION_SHAPE=`const s=window.__city4EndBattleClose;if(!s)throw Error('No original close observer');const d=Object.getOwnPropertyDescriptors(s);for(const k of['rows','errors','nativeInputs','listener'])if(!d[k]||!Object.prototype.hasOwnProperty.call(d[k],'value'))throw Error('Original close own-data store required');if(!Array.isArray(d.rows.value)||!Array.isArray(d.errors.value)||d.nativeInputs.value!==0||typeof d.listener.value!=='function'||Function.prototype.toString.call(d.listener.value)!==${JSON.stringify(originalCloseListener())})throw Error('Original readonly close listener required');`;
const CLOSE_OBSERVATION_OWNER=`${CLOSE_OBSERVATION_SHAPE}const od=Object.getOwnPropertyDescriptor(window,'__city4EndBattleCloseObservationOwner');if(!od||!Object.prototype.hasOwnProperty.call(od,'value')||od.writable||od.configurable)throw Error('Original immutable close observation owner required');const o=od.value;if(!o||!Object.isFrozen(o)||o.store!==s||o.listener!==d.listener.value||o.rows!==d.rows.value||o.errors!==d.errors.value)throw Error('Original close store/listener/arrays changed');`;
export const CITY4_BATTLE_CLOSE_BIND_OBSERVATION_SOURCE=`(()=>{if(Object.prototype.hasOwnProperty.call(window,'__city4EndBattleCloseObservationOwner'))throw Error('Close observation owner already exists');${CLOSE_OBSERVATION_SHAPE}if(s.rows.length||s.errors.length)throw Error('Observation binding must precede any settlement');Object.defineProperty(window,'__city4EndBattleCloseObservationOwner',{value:Object.freeze({store:s,listener:s.listener,rows:s.rows,errors:s.errors})});return{bound:true,readOnly:true};})()`;
export const CITY4_BATTLE_CLOSE_OBSERVATION_IDENTITY_SOURCE=`(()=>{${CLOSE_OBSERVATION_OWNER}return{bound:true,readOnly:true};})()`;
export const CITY4_BATTLE_CLOSE_OBSERVATION_READ_SOURCE=`(()=>{${CLOSE_OBSERVATION_OWNER}return{rows:s.rows,errors:s.errors,nativeInputs:s.nativeInputs};})()`;

/** Instantiate only in the same Node process and CDP lease that performed END.
 * Factory/import is inert. run() needs complete first-PICK evidence and reads the
 * existing exact policy observer. It provides no LOAD, SAVE, END or cleanup code. */
export function createCity4EndBattleCloseCandidate({session,cdp,libBytes,nativeBudget,observerExpected,persistExclusive,firstOwnCapability,originCapability,stageCapability}){
 function nodeRef(object,key){assert.ok(object&&typeof object==='object'&&!utilTypes.isProxy(object),'Original non-Proxy close Node references');const d=Object.getOwnPropertyDescriptor(object,key);assert.ok(d&&Object.hasOwn(d,'value'),'Original close Node own-data identity field');return d.value;}
 const nodeIdentity=nodeRef(session,'identity'),nodeCdp=nodeRef(session,'cdp'),nodeSend=nodeRef(cdp,'send');
 assert.ok(nodeIdentity&&!utilTypes.isProxy(nodeIdentity)&&nodeCdp===cdp&&typeof nodeSend==='function'&&!utilTypes.isProxy(nodeSend),'Same in-memory owned CDP lease required');
 assert.equal(typeof persistExclusive,'function');assert.ok(Buffer.isBuffer(libBytes));
 const a=args(Buffer.from(libBytes),copy(nativeBudget),copy(observerExpected)),route=sourceOriginalWoodRoute({libBytes:a.libBytes,origin:4,destination:10});
 function boundFirstPick(context){
  sameLive();
  const identity={originCapability,stageCapability,session,cdp},own=assertCity4FirstOwnCapability(firstOwnCapability,identity),stage=assertCity4ObserverStageCapability(stageCapability,{originCapability,session,cdp});
  assert.ok(own.originCapability===originCapability&&own.stageCapability===stageCapability&&own.session===session&&own.cdp===cdp&&own.sameSession===nodeIdentity&&stage.originCapability===originCapability&&stage.session===session&&stage.cdp===cdp&&stage.sameSession===own.sameSession,'Original private same-Node first-PICK/stage/session/CDP references');
  assert.ok(stage.endCommitAttempted===true&&stage.endNativeAckObserved===true,'Only the original privately attempted and acknowledged END may be closed');
  eq(context.firstOwnEvidence,own.firstOwnEvidence,'Complete caller first-PICK graph equals the original private defensive evidence');eq(a.nativeBudget,own.nativeBudget);eq(a.observerExpected,own.observerExpected);eq(stage.nativeBudget,own.nativeBudget);eq(stage.observerExpected,own.observerExpected);eq(stage.observerEpochTicket,own.observerEpochTicket);assert.ok(a.libBytes.equals(own.libBytes),'Original private runtime LIB remains exact');return copy(own.firstOwnEvidence);
 }
 eq([route.mapId,route.nativeWay,route.timeCount],[111,0,1]);
 const report={schemaVersion:1,sourceOnly:true,sameSessionRequired:true,readiness:CITY4_BATTLE_CLOSE_READINESS,limits:CITY4_BATTLE_CLOSE_LIMITS,actions:[],reads:[],artifacts:[],settlementRows:[],outcome:null,newEnd:0,newMarches:0,newPlunders:0,newSaves:0,cleanupRequested:false,...noCredit()};
 let running=false,started=false,installed=false,firstPick=null,lastTicket=null,closeStartKeys=null,distinctBytes=0,measurementOrdinal=0,actionOrdinal=0,failureOrdinal=0,cancels=0;const content=new Map();
 let preparing=false,prepareStarted=false,prepareQualified=false;
 function sameLive(){for(const[object,key,value]of[[session,'identity',nodeIdentity],[session,'cdp',cdp],[cdp,'send',nodeSend]]){assert.ok(!utilTypes.isProxy(object));const d=Object.getOwnPropertyDescriptor(object,key);assert.ok(d&&Object.hasOwn(d,'value')&&d.value===value,'Original close session/CDP/send own-data references');}}
 report.observationPreparation={attempted:false,qualified:false,outcome:'not-started',nativeInputs:0};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function evaluate(expression){sameLive();const r=await nodeSend.call(cdp,'Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});sameLive();assert.ok(!r.exceptionDetails,'Actual CDP read/action exception: '+JSON.stringify(r.exceptionDetails));return r.result?.value;}
 async function retain(name,value){await persistExclusive(name,value);return name;}
 async function readWhole(label){
  const startedAt=performance.now(),t=await evaluate(city4TicketExpression),observedAt=performance.now();verifyCity4Ticket({ticket:t,...a});
  if(firstPick)sameEpoch(firstPick.ticket,t,a);
  const bytes=Buffer.from(JSON.stringify(t)+'\n'),hash=sha(bytes);let file=content.get(hash);
  if(!file){assert.ok(content.size<CITY4_BATTLE_CLOSE_LIMITS.maximumDistinctTicketArtifacts&&distinctBytes+bytes.length<=CITY4_BATTLE_CLOSE_LIMITS.maximumArtifactBytes,'Measurement budget reached: retain live session rather than discard or close');file='battle-close-ticket-'+hash+'.json';await retain(file,bytes);content.set(hash,file);distinctBytes+=bytes.length;report.artifacts.push({path:file,bytes:bytes.length,sha256:hash});}
  const row={ordinal:measurementOrdinal++,label,startedAt,observedAt,file,sha256:hash};report.reads.push(row);lastTicket=t;return t;
 }
 async function stable(label){for(let i=0;i<CITY4_BATTLE_CLOSE_LIMITS.maximumStablePairAttempts;i++){const x=await readWhole(label+' A'),y=await readWhole(label+' B');if(isDeepStrictEqual(x,y))return y;await wait(25);}throw Error('No stable whole native owner: '+label);}
 async function observer(){
  return evaluate("(()=>{const s=window.__v21PolicyObserver;if(!s||s.fn!==baye.hooks.willExecuteOrder||s.originalUndefined!==true)throw Error('The same exact readonly observer must remain installed');return{installed:true,calls:s.calls,samples:s.samples};})()");
 }
 async function guard(t,label){assert.ok(firstPick);if(installed)await observationIdentity();eq([t.world.year,t.world.month],[firstPick.ticket.world.year,firstPick.ticket.world.month]);const raw=await observer();const proof=verifyCity4AfterOwnCurrentGuards({...firstPick,...a,observer:raw,ticket:t});await retain('battle-close-current-guard-'+String(report.actions.length).padStart(3,'0')+'-'+label+'.json',{ticket:t,observer:raw,proof});return proof;}
 const uiExpression="(()=>{const b=BayeHdBattle.debugSnapshot(),mode=BayeHdBattle.getMode(),root=document.getElementById('hd-battle'),n=document.getElementById(mode==='classic'?'lcd':'hd-battle-canvas'),r=n&&n.getBoundingClientRect(),active=document.activeElement;let visible=!!r&&r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5;for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)visible=false;}const topmost=visible&&[[.2,.2],[.5,.5],[.8,.8]].every(q=>{const hit=document.elementFromPoint(r.x+r.width*q[0],r.y+r.height*q[1]);return mode==='classic'?hit===n:!!hit&&(hit===root||root.contains(hit));});return{battleMode:mode,transaction:b.transaction,mobile:b.mobileHost,focus:{tag:active&&active.tagName,editable:!!(active&&active.isContentEditable)},surface:!!topmost,open:b.open,preview:b.preview,showHd:b.showHd,inputReady:b.inputReady,inputKind:b.inputKind,inputSeq:b.inputSeq,menuLive:b.menuLive,menuNames:b.menuNames,menuIndex:b.menuIndex};})()";
 async function uiAndFocus(before,{focusRequired=true}={}){
  let u=null;const end=Date.now()+5000;
  // Wait for the product's real ACK transaction to retire. A fixed delay and
  // a native index alone never authorize another fresh Enter.
  while(Date.now()<end){u=await evaluate(uiExpression);eq(u.battleMode,before.meta.battleMode);assert.equal(u.mobile,false);if(!u.transaction)break;eq(await stable('native owner while awaiting public battle ACK'),before);await wait(20);}
  assert.ok(u&&!u.transaction,'Public battle request must be nonpending');assert.ok(u.surface,'The actual original/HD battle surface must be visible and topmost');
  if(u.battleMode==='hd'){assert.ok(u.open&&!u.preview&&u.showHd&&u.inputReady);eq([u.inputKind,u.inputSeq],[before.state.snapshot.fight.inputKind,before.state.snapshot.fight.inputSeq]);if([6,7].includes(u.inputKind)){assert.equal(u.menuLive,true);eq([u.menuNames,u.menuIndex],[before.state.menu.names,before.state.menu.index]);}}
  if(focusRequired)assert.ok(['BODY','HTML','CANVAS'].includes(u.focus.tag)&&!u.focus.editable,'Require real uneditable keyboard focus; never call focus/blur');return u;
 }
 async function pointerPoint(selector){
  const expression='(()=>{const n=document.querySelector('+JSON.stringify(selector)+');if(!n)return null;const r=n.getBoundingClientRect(),s=getComputedStyle(n),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{selector:'+JSON.stringify(selector)+',tag:n.tagName,id:n.id,disabled:!!n.disabled,inline:!!(n.onclick||n.onmousedown||n.onmouseup),sys:n.hasAttribute("data-hd-battle-sys"),visible:r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5&&s.display!=="none"&&s.visibility==="visible"&&Number(s.opacity)>0,hit:hit===n,x,y};})()';
  const point=await evaluate(expression);assert.ok(point&&point.visible&&point.hit&&!point.disabled&&!point.inline,'Exact actual public pointer surface must be inert or its known delegated system button');return point;
 }
 async function pointer(point,afterPress){
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  // Mouse release can itself cause the delegated native action. If the fresh
  // owner fails after press, do not release over a changed button: retain the
  // live session and the unresolved physical gesture instead of guessing.
  if(afterPress)await afterPress();
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
 }
 async function ensureMenuBodyFocus(before){
  const ui=await uiAndFocus(before,{focusRequired:false});if(['BODY','HTML','CANVAS'].includes(ui.focus.tag)&&!ui.focus.editable)return;
  eq(before.meta.battleMode,'hd');assert.ok([6,7].includes(before.state.snapshot.fight.inputKind));systemOwner(before,before.state.snapshot.fight.inputKind,route);
  // pc.html's exact nonfocusable DIV has no action attribute. The delegated
  // battle click handler has no matching branch for this heading. Real default
  // pointer behavior must release the previous button to BODY; no focus() call.
  const selector='#hd-battle-menu-title',point=await pointerPoint(selector);eq([point.tag,point.id,point.sys],['DIV','hd-battle-menu-title',false]);eq(await pointerPoint(selector),point);eq(await stable('whole native owner before inert menu-heading click'),before);
  const start=await evaluate('window.__city4MarchProbe.pointers.length');await pointer(point,async()=>{eq(await stable('whole native owner after inert heading press'),before);eq(await pointerPoint(selector),point);});eq(await stable('whole native owner after inert menu-heading click'),before);const events=await evaluate('window.__city4MarchProbe.pointers.slice('+start+')');eq(events.map(e=>[e.type,e.tag,e.id,e.trusted,e.keys]),['mousedown','mouseup','click'].map(type=>[type,'DIV','hd-battle-menu-title',true,before.state.keys]));const after=await uiAndFocus(before);eq(after.focus,{tag:'BODY',editable:false});await retain('battle-close-focus-'+String(actionOrdinal).padStart(3,'0')+'.json',{before,point,events,after,nativeInputs:0});
 }
 async function acknowledgedKeys(before,code){
  const end=Date.now()+5000;let rows=[];while(Date.now()<end){rows=await evaluate('window.__city4MarchProbe.keys.slice('+before.state.keys+')');if(rows.length)break;await wait(20);}eq(rows.length,1,'Exactly one native ACK, never queued or repeated keys');const k=rows[0];eq(k.code,code);eq(k.generation,before.state.snapshot.spe.generation);eq(k.fight,before.state.snapshot.fight,'Native dispatch belongs to the entire fresh fight owner');eq([k.speActive,k.resultActive],[0,false]);assert.ok(!k.originalThrew);return rows;
 }
 async function openHdSystem(before){
  eq(before.meta.battleMode,'hd');assertQuietOwn(before,route);eq(before.state.snapshot.fight.inputKind,1);eq(before.state.menu.active,0);await guard(before,'system-pointer');const ui=await uiAndFocus(before,{focusRequired:false});const selector='#hd-battle [data-hd-battle-sys]',point=await pointerPoint(selector);eq([point.tag,point.sys],['BUTTON',true]);eq(await pointerPoint(selector),point);eq(await stable('final whole PICK owner before genuine HD system button'),before);
  eq(before.state.keys,closeStartKeys+report.actions.length,'No undeclared native key before the HD system-button action');assert.ok(report.actions.length<CITY4_BATTLE_CLOSE_LIMITS.maximumCloseKeys);const row={ordinal:actionOrdinal++,role:'actual-HD-system-button',code:40,before,ui,point,reservedBeforePointer:true,outcome:'unknown'},start=await evaluate('window.__city4MarchProbe.pointers.length');report.actions.push(row);await retain('battle-close-key-'+String(row.ordinal).padStart(3,'0')+'-before.json',row);
  try{await pointer(point,async()=>{row.mousePressedReturned=true;eq(await stable('whole PICK after system-button press before release'),before);eq(await pointerPoint(selector),point);await uiAndFocus(before,{focusRequired:false});});row.mouseReleasedReturned=true;row.nativeKeys=await acknowledgedKeys(before,40);row.events=await evaluate('window.__city4MarchProbe.pointers.slice('+start+')');eq(row.events.map(e=>[e.type,e.tag,e.trusted]),['mousedown','mouseup','click'].map(type=>[type,'BUTTON',true]));for(const e of row.events)assert.ok(Math.abs(e.x-point.x)<=1&&Math.abs(e.y-point.y)<=1);row.outcome='one-native-key-acknowledged';}
  finally{await retain('battle-close-key-'+String(row.ordinal).padStart(3,'0')+'-after.json',row);}
 }
 async function key(code,before,role){
  assert.ok(Object.hasOwn(keyNames,code));assert.ok(report.actions.length<CITY4_BATTLE_CLOSE_LIMITS.maximumCloseKeys,'Bounded close-only keys');
  assertQuietOwn(before,route);await guard(before,'key-'+actionOrdinal);eq(await stable('fresh whole owner before '+role),before);if([6,7].includes(before.state.snapshot.fight.inputKind))await ensureMenuBodyFocus(before);const ui=await uiAndFocus(before);eq(await stable('final whole owner before '+role),before);
  eq(before.state.keys,closeStartKeys+report.actions.length,'No undeclared native key before the next close action');
  // Each attempt is spent before keyDown. Unknown/throw results are retained;
  // this module never retries an uncertain native confirm.
  const row={ordinal:actionOrdinal++,role,code,before,ui,reservedBeforeKeyDown:true,outcome:'unknown'};report.actions.push(row);await retain('battle-close-key-'+String(row.ordinal).padStart(3,'0')+'-before.json',row);
  let failure=null;
  try{await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:keyNames[code],code:keyNames[code],windowsVirtualKeyCode:virtualKeys[code],nativeVirtualKeyCode:virtualKeys[code],autoRepeat:false});row.keyDownReturned=true;}
  catch(error){failure=error;row.keyDownError=failureDiagnostic(error);}
  // Releasing this same physical key is not another native confirm; no second
  // keyDown is ever sent, including when the first dispatch result is unknown.
  try{await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:keyNames[code],code:keyNames[code],windowsVirtualKeyCode:virtualKeys[code],nativeVirtualKeyCode:virtualKeys[code],autoRepeat:false});row.keyUpReturned=true;}
  catch(error){failure??=error;row.keyUpError=failureDiagnostic(error);}
  try{row.nativeKeys=failure?await evaluate('window.__city4MarchProbe.keys.slice('+before.state.keys+')'):await acknowledgedKeys(before,code);if(failure)throw failure;row.outcome='one-native-key-acknowledged';return row;}
  finally{await retain('battle-close-key-'+String(row.ordinal).padStart(3,'0')+'-after.json',row);}
 }
 async function waitOwner(label,predicate,{sameWorld=null}={}){
  const end=Date.now()+CITY4_BATTLE_CLOSE_LIMITS.maximumNaturalWaitMs;while(Date.now()<end){const t=await readWhole(label),kind=classifyCity4BattleCloseTicket(t);if(kind.kind.startsWith('unsupported'))throw Error('Unsupported owner must retain the live session: '+kind.kind);if(predicate(t)){const fresh=await stable(label+' stable');if(predicate(fresh)){if(sameWorld)noCampaignMutation(sameWorld,fresh,a);return fresh;}}await wait(100);}throw Error('Natural native wait expired; no guessed input or cleanup: '+label);
 }
 async function stopMenu(before,kind){
  const owner=systemOwner(before,kind,route);let current=before;
  while(current.state.menu.index!==owner.target){
   const direction=owner.target>current.state.menu.index?1:-1,code=direction>0?35:34,target=current.state.menu.index+direction;
   await key(code,current,'native-'+kind+'-cursor');const after=await waitOwner('native stop-menu cursor ACK',t=>t.state.menu.active===1&&t.state.menu.seq===owner.menu.seq&&t.state.menu.index===target,{sameWorld:current});systemOwner(after,kind,route);
   const expected=copy(current);expected.state.keys++;expected.state.menu.index=target;eq(after,expected,'Native retreat menu arrow changes only the original cursor and key count');current=after;
  }
  const fresh=await stable('native stop-menu final Enter owner');eq(fresh,current);await key(39,fresh,'native-'+kind+'-confirm');return fresh;
 }
 async function cancelToPick(){
  let t=await stable('battle close initial owner');
  while(t.state.snapshot.fight.active===1&&t.state.snapshot.fight.over===0){
   const owner=classifyCity4BattleCloseTicket(t);if(owner.kind==='natural-effect-or-report-wait'||owner.kind==='natural-engine-wait'){t=await waitOwner('natural effect retirement',x=>quiet(x)&&x.state.snapshot.fight.wait===1||ordinaryMap(x));continue;}
   if(owner.kind!=='own-battle-input')throw Error('Unsupported native owner before close: '+owner.kind);
   if([1,6,7].includes(owner.inputKind))return t;
   assert.ok([2,3,4,5].includes(owner.inputKind)&&cancels<CITY4_BATTLE_CLOSE_LIMITS.maximumCancels,'Only bounded genuine MOVE/ACTION/SKILL/AIM cancels');const old=t,inputSeq=t.state.snapshot.fight.inputSeq;
   await key(40,t,'cancel-current-native-'+owner.inputKind);cancels++;
   t=await waitOwner('actual cancellation ACK',x=>x.state.snapshot.fight.over!==0||x.state.snapshot.fight.active===0||x.state.snapshot.fight.inputSeq!==inputSeq||x.state.snapshot.fight.inputKind!==owner.inputKind,{sameWorld:old});
  }
  return t;
 }
 async function install(before){
  assert.equal(installed,false);eq(await stable('fresh whole PICK before readonly close observer'),before);const result=await evaluate(CITY4_BATTLE_CLOSE_OBSERVER_SOURCE);eq(result,{installed:true,readOnly:true,keys:before.state.keys});eq(await stable('whole PICK after readonly close observer'),before);installed=true;
  eq(await evaluate(CITY4_BATTLE_CLOSE_BIND_OBSERVATION_SOURCE),{bound:true,readOnly:true});await observationIdentity();
 }
 async function observationIdentity(){sameLive();eq(await evaluate(CITY4_BATTLE_CLOSE_OBSERVATION_IDENTITY_SOURCE),{bound:true,readOnly:true});}
 async function observedStore(){await observationIdentity();const first=await evaluate(CITY4_BATTLE_CLOSE_OBSERVATION_READ_SOURCE),second=await evaluate(CITY4_BATTLE_CLOSE_OBSERVATION_READ_SOURCE);eq(first,second,'Two whole current original settlement store reads');assert.ok(second);eq(second.errors,[]);eq(second.nativeInputs,0);return second;}
 async function prepareObservation(context){
  assert.equal(context?.session,session);assert.equal(prepareStarted,false,'One readonly observation preparation; an unknown installation is never repeated');assert.equal(preparing,false);assert.equal(running,false);assert.equal(started,false,'Observation preparation must precede the one close attempt');prepareStarted=true;preparing=true;report.observationPreparation.attempted=true;report.observationPreparation.outcome='reserved-before-install';
  try{
   const original=boundFirstPick(context);if(firstPick)eq(firstPick,original);firstPick=original;verifyCity4BeforeOwn({...firstPick,...a});sameEpoch(firstPick.ticket,firstPick.firstPick.final,a);assertRoute(firstPick.ticket,route);
   const before=await stable('exact original first PICK before early readonly settlement observation');eq(before,firstPick.ticket,'Early observation is installed before any HDA action');assertQuietOwn(before,route);eq([before.state.snapshot.fight.inputKind,before.state.menu.active],[1,0]);await guard(before,'prepare-observation');await install(before);eq(await stable('same original first PICK after early readonly settlement observation'),before);
   prepareQualified=true;report.observationPreparation.qualified=true;report.observationPreparation.outcome='qualified-before-HDA';return{kind:'readonly-battle-close-observation-prepared',session,sameSession:nodeIdentity,observationPrepared:true,newNativeInputs:0,saveObserved:false,cleanupAuthorized:false,mayReplay:false,...noCredit()};
  }catch(error){report.observationPreparation.outcome='retained-unknown-no-reinstall';return await retained(error,context);}finally{preparing=false;}
 }
 async function preparedEntry(initial){
  const end=Date.now()+CITY4_BATTLE_CLOSE_LIMITS.maximumNaturalWaitMs;let current=initial;
  while(Date.now()<end){await observationIdentity();const owner=classifyCity4BattleCloseTicket(current);
   if(owner.kind==='ordinary-map')return current;
   if(owner.kind==='own-battle-input'){assert.ok([1,2,3,4,5,6,7].includes(owner.inputKind),'Only known current PICK/MOVE/ACT/SKILL/AIM/SYSTEM/RETREAT may start close after HDA');if([6,7].includes(owner.inputKind))systemOwner(current,owner.inputKind,route);else assertQuietOwn(current,route);return current;}
   assert.ok(['natural-effect-or-report-wait','natural-engine-wait','natural-settlement-wait'].includes(owner.kind),'Unknown owner after HDA must retain without input: '+owner.kind);
   await wait(100);current=await stable('readonly prepared natural settlement or known battle owner');
  }
  throw Error('Prepared natural result did not converge; no guessed input or cleanup');
 }
 async function retained(error,context,evidenceFailures=[]){
  let failureRead=null,failureReadError=null;
  try{failureRead=await evaluate('({ticket:'+city4TicketExpression+',nativeKeys:window.__city4MarchProbe.keys,physicalKeys:window.__city4MarchProbe.trusted,pointers:window.__city4MarchProbe.pointers,closeObserver:window.__city4EndBattleClose&&{rows:window.__city4EndBattleClose.rows,errors:window.__city4EndBattleClose.errors}})');}catch(readError){failureReadError=failureDiagnostic(readError);}
  const observation={status:'retained-live-unresolved',sameSession:nodeIdentity,error:failureDiagnostic(error),lastMeasuredTicket:lastTicket,failureRead,failureReadError,evidenceFailures:[...evidenceFailures],originalFailurePreserved:true,cleanupAuthorized:false,saveObserved:false,mayReplay:false,newEnd:0,...noCredit()};report.outcome='retained-live-unresolved';
  try{await retain('battle-close-retained-live-observation-'+String(failureOrdinal++).padStart(3,'0')+'.json',{...observation,sameSession:'in-memory-only',report});}catch(persistError){observation.failureArtifactPersistError=failureDiagnostic(persistError);observation.evidenceFailures.push({stage:'retained-observation',error:observation.failureArtifactPersistError});}
  // Even an unavailable CDP or failed artifact sink must return the same live
  // capability. It is an unresolved failure, never permission to clean up.
  return{...observation,session,context,originalError:error};
 }
 async function run(context){
  assert.equal(context?.session,session);assert.equal(preparing,false,'Readonly observation preparation must have returned');assert.equal(running,false,'Exclusive continuation; no concurrent cleanup or input caller');assert.equal(started,false,'One battle-close attempt; a failed or uncertain native action cannot be replayed');started=true;running=true;
  try{
   assert.ok(!prepareStarted||prepareQualified,'A failed or unknown early observation cannot be reinstalled by late run');
   assert.ok(context.firstOwnEvidence,'Unbound: complete actual first-PICK callback/triple-ticket evidence must be supplied before any close action');
   firstPick=boundFirstPick(context);verifyCity4BeforeOwn({...firstPick,...a});sameEpoch(firstPick.ticket,firstPick.firstPick.final,a);assertRoute(firstPick.ticket,route);assert.ok(['classic','hd'].includes(firstPick.ticket.meta.battleMode),'Keep the already bound battle mode throughout this same session');
   let t=await stable('same-session current owner for battle close');sameEpoch(firstPick.ticket,t,a);
   // An earlier qualified first-PICK is allowed when legal current MOVE/AIM
   // actions already occurred in this same session. No fixed troop/MP restoration.
   assert.ok(t.state.keys>=firstPick.ticket.state.keys);if(prepareQualified)t=await preparedEntry(t);
   closeStartKeys=t.state.keys;report.closeStartKeys=closeStartKeys;
   if(ordinaryMap(t)){assert.ok(prepareQualified&&installed,'An already MAP result requires this same successful early observation');await observationIdentity();report.entry='already-observed-native-map-zero-close-input';}
   else{assertQuietOwn(t,route);await guard(t,'entry');if(!installed)await install(t);await observationIdentity();
   t=await cancelToPick();
   if(t.state.snapshot.fight.active===1&&t.state.snapshot.fight.over===0){
    let kind=t.state.snapshot.fight.inputKind;
    if(kind===1){eq(t.state.menu.active,0);if(t.meta.battleMode==='hd')await openHdSystem(t);else await key(40,t,'open-current-native-battle-system');const old=t;t=await waitOwner('native SYSTEM after one current public open',x=>x.state.snapshot.fight.inputKind===6&&x.state.menu.active===1,{sameWorld:old});systemOwner(t,6,route);kind=6;}
    if(kind===6){const menu=copy(t.state.menu);await stopMenu(t,6);t=await waitOwner('distinct native RETREAT confirmation owner',x=>x.state.snapshot.fight.inputKind===7&&x.state.menu.active===1,{sameWorld:t});systemOwner(t,7,route);assert.ok(t.state.menu.seq!==menu.seq,'SYSTEM and RETREAT are distinct native blocking calls');kind=7;}
    eq(kind,7);systemOwner(t,7,route);await stopMenu(t,7);
   }
   }
   const final=await waitOwner('complete original battle result, remaining orders, month and ordinary MAP',ordinaryMap);
   const store=await observedStore();
   const own=store.rows.filter(row=>row.detail?.mode===1&&row.detail?.city===10);eq(own.length,1,'Exactly one complete current own FightResultDeal event');eq(store.rows.length,1,'Additional battle needs a separately reviewed handler');
   const evidence=await observer(),handoff=verifyCity4OrdinaryMapForSave({firstPick,map:final,settlement:own[0],observer:evidence,a});
   eq(final.state.keys,closeStartKeys+report.actions.length,'No native input beyond the bounded close action ledger, including a natural end with zero close keys');
   report.settlementRows=store.rows;report.outcome=handoff.kind;await retain('battle-close-ordinary-map-for-save.json',{...handoff,report});
   // Deliberately do not call acceptTerminalSave(), requireSafeRelease(), close,
   // or a caller boolean receipt. A later real SAVE verifier must earn release.
   return{...handoff,session,sameSession:nodeIdentity,report,readiness:CITY4_BATTLE_CLOSE_READINESS};
  }catch(error){return await retained(error,context);}finally{running=false;}
 }
 async function handleFailure(error,context){
  assert.equal(context?.session,session);
  try{await retain('battle-close-original-upstream-failure-'+String(failureOrdinal++).padStart(3,'0')+'.json',{error:failureDiagnostic(error),originalFailurePreserved:true,cleanupAuthorized:false});}
  catch(persistError){return retained(error,context,[{stage:'original-upstream-failure',error:failureDiagnostic(persistError)}]);}
  if(running||started||installed)return retained(error,context);return run(context);
 }
 return Object.freeze({prepareObservation,run,handleFailure,readiness:CITY4_BATTLE_CLOSE_READINESS,status:()=>({preparing,prepareStarted,prepareQualified,installed,started,running,sourceOnly:true,maximumNewEnd:0,cleanupAuthorized:false}),get report(){return copy(report);}});
}
