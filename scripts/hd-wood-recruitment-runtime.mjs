// Pure supplied-evidence gates for six original Order24 returns and one WOOD
// battle. No native input, SAVE, RNG, September forecast or acceptance credit.
import assert from 'node:assert/strict';
import {verifyRecruitmentEndAdmission,verifyRecruitmentReturnWorld,verifyRecruitmentTicket,assessRecruitmentOwnedFood} from './hd-wood-recruitment-preparation.mjs';
import {verifyAfterOwnCurrentGuards} from './hd-wood-supplied-continuation.mjs';

const copy=structuredClone,eq=(a,b,m)=>assert.deepEqual(a,b,m);
const ACTORS=[48,68,28,6,27,25],SLOTS=[0,1,2,3,4,5],OWNED=[4,5,6,7,13,16,20];
const PERSON=['OldBelong','Belong','Level','Force','IQ','Devotion','Character','Experience','Thew','ArmsType','Arms','Tool1','Tool2','Age'];
const CITY=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce','PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms','PersonQueue','Persons','ToolQueue','Tools'];
const ORDER=['OrderId','Person','City','Object','Arms','Food','Money','Consume','TimeCount'];
const noCredit=()=>({sourceOnly:true,actualInputAccepted:false,publicInputAccepted:false,publicSaveAccepted:false,nativeExecutionAccepted:false,actualCostAccepted:false,actualRecruitmentAccepted:false,actualDistributionAccepted:false,actualNativeReturnAccepted:false,actualMarchAccepted:false,actualPreparationAccepted:false,actualMonthAccepted:false,actualBattleMpObserved:false,actualCastAccepted:false,actualClassicAccepted:false,classicNativePixelAccepted:false,fallbackAccepted:false,hdAccepted:false,globalHdComplete:false,rngContinuityAccepted:false});
const uint=(n,max,m)=>assert.ok(Number.isInteger(n)&&n>=0&&n<=max,m);
function dense(a,n,m){assert.ok(Array.isArray(a)&&a.length===n&&Object.keys(a).length===n,m);for(let i=0;i<n;i++)assert.ok(Object.hasOwn(a,i),m+' dense');}
function measurement(v,m='measurement',parents=new Set()){
 if(v===null||['string','boolean'].includes(typeof v))return;
 if(typeof v==='number'){assert.ok(Number.isFinite(v),m+' finite');return;}
 assert.ok(v&&typeof v==='object'&&!parents.has(v),m+' acyclic JSON');eq(Object.getPrototypeOf(v),Array.isArray(v)?Array.prototype:Object.prototype,m+' plain');
 parents.add(v);if(Array.isArray(v))dense(v,v.length,m);
 for(const k of Reflect.ownKeys(v)){if(Array.isArray(v)&&k==='length')continue;assert.equal(typeof k,'string',m+' no symbols');const d=Object.getOwnPropertyDescriptor(v,k);assert.ok(Object.hasOwn(d,'value')&&d.enumerable,m+' enumerable data only');measurement(d.value,m+'.'+k,parents);}parents.delete(v);
}
const raw=(w,c)=>w.queue.slice(w.cities[c].PersonQueue,w.cities[c].PersonQueue+w.cities[c].Persons);
const goods=(w,c)=>w.goodsQueue.slice(w.cities[c].ToolQueue,w.cities[c].ToolQueue+w.cities[c].Tools);
const ownCities=w=>w.cities.flatMap((c,i)=>c.Belong===1?[i]:[]);
const unknown=(o,known)=>Object.fromEntries(Object.entries(o).filter(([k])=>!known.includes(k)));
function epoch(t,args){
 measurement(t,'Complete actual ticket');verifyRecruitmentTicket({ticket:t,libBytes:args.libBytes,nativeBudget:args.nativeBudget,observerExpected:args.observerExpected});
 const meta=copy(t.meta);delete meta.city;delete meta.cityPos;
 return{references:copy(t.state.snapshot.references),identity:copy(t.meta.identity),config:copy(t.world.config),nativeBudget:copy(args.nativeBudget),meta};
}
function callback(s,i,calls,args){
 measurement(s,'Native callback');assert.ok(s&&!s.error);eq(s.ordinal,i,'Contiguous actual ordinal');eq(s.order,calls[i],'Actual call and sample contexts');eq(s.a,s.b,'Entire readonly native callback A=B');eq(s.contextAfter,s.order,'Whole original order context unchanged');eq(s.asyncBefore,s.asyncAfter,'Original async id/all32params/text/unknowns unchanged');
 dense(s.asyncBefore?.params,32,'Complete32 original async parameters');uint(s.asyncBefore.id,255,'Actual BIND_U8 action');for(const n of s.asyncBefore.params)uint(n,0xffffffff,'Actual U32 async parameter');eq(typeof s.asyncBefore.text,'string');eq([s.returnValue,s.contextUnchanged,s.asyncActionUnchanged],[-1,true,true],'Observer cannot take over native execution');
 epoch(s.b,args);eq(s.slotCandidates,s.b.world.orders.flatMap((o,j)=>{try{eq(o,s.order);return[j];}catch{return[];}}),'All complete native order identities');eq(s.slotCandidates.length,1,'Unambiguous actual original slot');
}
function end(args){assert.ok(args&&args.queuedWorld,'Complete actual queued world required');return verifyRecruitmentEndAdmission({...args,world:args.queuedWorld});}
function expectedRaw(q,c,returned){const ids=raw(q,c);return c===7?[...ACTORS.slice(0,returned).reverse(),...ids]:ids;}
function protectedWorld(w,q,{returned,pick=false}={}){
 measurement(w,'Actual protected world');eq(ownCities(w),OWNED,'Same current protected cities');eq([w.year,w.month],[q.year,q.month],'No later month may authorize a preparation input');eq(w.config,q.config);
 eq(w.people.flatMap((p,i)=>p.Belong===1?[i]:[]),q.people.flatMap((p,i)=>p.Belong===1?[i]:[]),'No unreviewed foreign/neutral person may join the protected player roster');
 const seen=new Set();for(const c of OWNED){for(const id of raw(w,c).filter(id=>w.people[id].Belong===1)){assert.ok(!seen.has(id),'Globally unique owned resident '+id);seen.add(id);}eq(raw(w,c),expectedRaw(q,c,returned),'Whole owned raw slice including foreign stale entries '+c);eq(goods(w,c),goods(q,c),'Whole owned goods slice '+c);const expected={...q.cities[c],State:0,PersonQueue:w.cities[c].PersonQueue,ToolQueue:w.cities[c].ToolQueue,Persons:q.cities[c].Persons+(c===7?returned:0)};eq(w.cities[c],expected,'Complete protected city: only original State0 and shifted physical pointers '+c);}
 for(let id=0;id<200;id++)if(q.people[id].Belong===1){eq(w.people[id],q.people[id],'Complete prepared owned person '+id);const shouldBeResident=id!==131&&(!ACTORS.includes(id)||ACTORS.slice(0,returned).includes(id));eq(seen.has(id),shouldBeResident,'Every original owned person has the exact current role '+id);}
 eq(w.people[129],q.people[129],'Captured129 is retained as a complete original person, never silently rescued or reused');eq(raw(w,12).filter(id=>id===129).length,1,'Original captured129 raw reference remains once in current foreign city12');
 eq(w.queue.slice(200),q.queue.slice(200),'All unused physical person-queue tail values');
 for(const slot of SLOTS)eq(w.orders[slot],{...q.orders[slot],OrderId:slot<returned?255:24},'Exact known recruitment slot, including all opaque fields '+slot);
 eq(w.orders[170],q.orders[170],'Exact original dispatched battle order170');
 for(let i=0;i<200;i++)if(w.orders[i].OrderId!==255&&!SLOTS.includes(i)&&i!==170)assert.ok(!OWNED.includes(w.orders[i].City),'Only foreign native AI may create other active orders');
 eq(w.fighters.slice(0,20),q.fighters.slice(0,20),'Whole player U16 army bytes');eq(w.fighterIndex[0],pick?0:1,'Native battle releases the player flag only at first PICK');
 const mutable=['people','cities','orders','queue','goodsQueue','fighters','fighterIndex'];eq(unknown(w,mutable),unknown(q,mutable),'Every fixed and unknown top-level field');
 for(let i=0;i<200;i++){eq(unknown(w.people[i],PERSON),unknown(q.people[i],PERSON),'Unknown person metadata '+i);eq(unknown(w.orders[i],ORDER),unknown(q.orders[i],ORDER),'Unknown order metadata '+i);}for(let i=0;i<38;i++)eq(unknown(w.cities[i],CITY),unknown(q.cities[i],CITY),'Unknown city metadata '+i);
 const food=assessRecruitmentOwnedFood({world:w});eq(food.accepted,true,'Current strict food and cash for every owned resident and pending army');return{accepted:true,returned,allOwnedPeopleAndRawSlicesPreserved:true,foreignAiKnownFieldsNotFrozen:true,food};
}

/** Every invocation replays the complete preparation/SAVE/March contract. */
export function verifyRecruitmentPrefixObserved(args={}){
 const q=args.queuedWorld,o=args.observer;measurement(o,'Actual observer');eq(o.installed,true);dense(o.samples,o.samples.length,'Actual samples');dense(o.calls,o.samples.length,'Actual calls');assert.ok(o.samples.length>=7,'Six returns require six immediately adjacent successor callbacks');
 const anchor=epoch(o.samples[0].b,args);for(let i=0;i<o.samples.length;i++){callback(o.samples[i],i,o.calls,args);eq(epoch(o.samples[i].b,args),anchor,'Full native references/LIB/config/metadata epoch; only city/cityPos may vary');if(i)assert.ok(o.samples[i].b.state.keys>=o.samples[i-1].b.state.keys,'No backwards native key count');}
 const transitions=[];for(let slot=0;slot<6;slot++){
  const a=o.samples[slot],b=o.samples[slot+1];eq(a.slotCandidates,[slot],'Actual six native24 callbacks must start at slot0 and remain consecutive');eq(a.order,q.orders[slot]);eq([a.order.OrderId,a.order.City,a.order.Person],[24,7,ACTORS[slot]]);
  eq(a.b.state.keys,b.b.state.keys,'No engine input during original24 return and its immediate successor');eq(a.b.state.snapshot.spe.generation,b.b.state.snapshot.spe.generation,'No replacement native SPE generation during an adjacent return');
  const next=a.b.world.orders.findIndex((v,i)=>i>slot&&v.OrderId!==255);assert.ok(next>slot);eq(b.slotCandidates,[next],'Exact next active slot; future callbacks cannot skip an actual successor');
  protectedWorld(a.b.world,q,{returned:slot});transitions.push(verifyRecruitmentReturnWorld({before:a.b.world,after:b.b.world,slot,expectedOrder:q.orders[slot]}));protectedWorld(b.b.world,q,{returned:slot+1});
 }
 for(const s of o.samples.slice(7))protectedWorld(s.b.world,q,{returned:6});
 const admission=end(args);
 return{accepted:true,completeAdjacentSixReturns:true,callbackCount:o.samples.length,returnedSlots:[...SLOTS],successorOfFinalReturn:o.samples[6].slotCandidates[0],transitions,admission,budget:admission.budget,evidenceContainsAllSixNativeReturns:true,wholeAiOrMonthTransitionAccepted:false,...noCredit()};
}
function effectiveArm(p,libBytes){
 const b=Buffer.from(libBytes),base=b.readUInt32LE(65*4);eq([b.readUInt16LE(base+4),b.readUInt16LE(base+6),b.readUInt32LE(base+8),b.readUInt32LE(base)],[66,1,33*66,14+33*66],'Actual original GOODS66 table');let arm=p.ArmsType;
 for(const id of[p.Tool1,p.Tool2]){uint(id,33,'Actual original equipment token');if(id){const v=b[base+14+(id-1)*66+65];if(v)arm=v===1?3:v===2?5:v===3?4:v-4;}}
 uint(arm,5,'Actual original effective arm type');return arm;
}
function firstPick(t,own,args,budget){
 const q=args.queuedWorld,s=t.state.snapshot,f=s.fight,n=s.nativeBattle,u=s.units;
 eq([s.spe.active,s.result.active,s.top.active,s.report.active],[0,false,false,0],'Actual first PICK has no competing movie/result/report input owner');assert.ok(!t.state.record?.active&&!t.state.qty?.active,'Actual PICK cannot borrow a SAVE or numeric-input owner');
 eq([f?.active,f.over,f.wait,f.inputKind,f.cityIndex],[1,0,1,1,1],'Actual current own PICK');eq([n?.mode,n.way,n.mapId,n.cityIndex,n.playerFood],[1,3,110,1,budget.carryFood],'Actual Mode/Way/map/destination/current-budget cargo');uint(n.enemyFood,65535,'Actual enemy cargo');dense(n.genArray,20,'Whole native GenArray');dense(u,20,'Whole native20 unit slots');eq(n.genArray,u.map(x=>x.id),'Native GenArray and every current unit belong to one ticket');
 const used=new Set();for(let i=0;i<20;i++){const x=u[i];eq(x.i,i);uint(x.id,200,'U16 native token within actual200 persons');for(const k of['x','y'])uint(x.position?.[k],31,'Current coordinate '+k);for(const k of['hp','mp'])uint(x.position?.[k],65535,'Current U16 '+k);for(const k of['move','active'])uint(x.position?.[k],255,'Current U8 '+k);uint(x.position?.state,8,'Native JLPOS state');if(x.id){assert.ok(!used.has(x.id),'No repeated nonempty native unit');used.add(x.id);const p=t.world.people[x.id-1];eq([x.person?.personIndex,x.person?.arms,x.person?.belong,x.person?.level,x.person?.armType,x.person?.tool1,x.person?.tool2],[x.id-1,p.Arms,p.Belong,p.Level,effectiveArm(p,args.libBytes),p.Tool1,p.Tool2],'All current person metadata aligned with native token '+i);if(i>=10)assert.ok(p.Belong>1&&p.Belong<65535,'Current foreign defenders, never a fixed enemy ID');}else eq(x.person,null,'Empty native token has no invented person');if(i<10)eq(x.id,i===0?132:0,'Only current lawful131 in player army');}
 const a=u[0];eq([a.position.x,a.position.y,a.person.armType,a.person.tool1,a.person.tool2],[29,29,1,0,0]);assert.ok(a.position.hp>0&&a.position.state!==8&&a.position.mp>=45,'Fresh native HP/MP, never source formula84');
 eq(t.world.fighterIndex.slice(1),own.b.world.fighterIndex.slice(1),'Own battle entry releases only player flag0');eq(t.world.fighters,own.b.world.fighters,'No new physical army after the actual callback');eq(t.world.orders[170],own.order);eq(own.b.world.fighterIndex[0],1);eq(t.world.fighterIndex[0],0);eq(t.state.keys,own.b.state.keys,'No input between actual170 and first PICK');eq(epoch(t,args),epoch(own.b,args));protectedWorld(t.world,q,{returned:6,pick:true});
 return{accepted:true,actualNativeMpInSuppliedTicket:a.position.mp,nativeRoute:{mode:n.mode,way:n.way,mapId:n.mapId,cityIndex:n.cityIndex,cargo:n.playerFood},full20SlotsCompared:true,enemyIdsPredicted:false};
}
export function verifyRecruitmentBeforeOwn(args={}){
 const {kind,ticket:t,callback:row=null}=args;assert.ok(['native-callback','native-order27-callback','before-defender-input','first-own-pick'].includes(kind),'Explicit pre-own phase');epoch(t,args);let o=args.observer;
 if(kind.startsWith('native-')){assert.ok(row,'Whole exact current callback required');uint(row.ordinal,o.samples.length-1,'Actual callback ordinal');eq(o.samples[row.ordinal],row);eq(row.b,t);o={...o,samples:o.samples.slice(0,row.ordinal+1),calls:o.calls.slice(0,row.ordinal+1)};if(kind==='native-order27-callback'){eq(row.slotCandidates,[170]);eq(row.order,args.queuedWorld.orders[170]);}}
 let pick=null;if(kind==='first-own-pick'){
  const own=o.samples.filter(s=>s.slotCandidates.length===1&&s.slotCandidates[0]===170);eq(own.length,1,'One actual own170 callback before first PICK');eq(o.samples.at(-1),own[0],'No future callback may stand in for the still-active own battle');assert.ok(row,'Explicit source own170 callback required');eq(row,own[0]);assert.ok(args.firstPick,'Mandatory actual A/B and final native PICK tickets');eq(args.firstPick.first,args.firstPick.second,'Whole native PICK double read A=B');eq(args.firstPick.final,args.firstPick.second,'Final ticket before any action remains the exact actual PICK');eq(t,args.firstPick.final,'Current input ticket is the final read, not an earlier proof');pick=firstPick(t,own[0],args,{carryFood:args.queuedWorld.orders[170].Food});
 }
 const prefix=verifyRecruitmentPrefixObserved({...args,observer:o});for(const sample of o.samples)assert.ok(sample.b.state.keys<=t.state.keys,'No future callback may authorize earlier input');eq(epoch(t,args),epoch(o.samples[0].b,args));
 if(pick)eq(pick.nativeRoute.cargo,prefix.budget.carryFood,'Current cargo must equal the independently recomputed complete preparation budget');else protectedWorld(t.world,args.queuedWorld,{returned:6});
 return{accepted:true,kind,prefix,pick,currentFoodSafe:true,noFutureInputUsed:true,postOwnMustUseActualCurrentGuard:true,...noCredit()};
}
/** Uses actual current casualties/capture/global residency, never restores2920. */
export function verifyRecruitmentAfterOwnCurrentGuards(args={}){
 const o=args.observer;measurement(o,'Complete observed callbacks');const own=o.samples.flatMap((s,i)=>s.slotCandidates.length===1&&s.slotCandidates[0]===170?[i]:[]);eq(own.length,1,'Exactly one actually observed own170 entry');const cut=own[0],pre={...o,samples:o.samples.slice(0,cut+1),calls:o.calls.slice(0,cut+1)},prefix=verifyRecruitmentPrefixObserved({...args,observer:pre}),t=args.ticket;epoch(t,args);eq(epoch(t,args),epoch(pre.samples[0].b,args));
 dense(o.calls,o.samples.length,'All post-own call contexts');for(let i=0;i<o.samples.length;i++){callback(o.samples[i],i,o.calls,args);eq(epoch(o.samples[i].b,args),epoch(t,args));assert.ok(o.samples[i].b.state.keys<=t.state.keys,'No future evidence for current post-own input');if(i)assert.ok(o.samples[i].b.state.keys>=o.samples[i-1].b.state.keys,'No backwards post-own keys');}
 const proof=verifyAfterOwnCurrentGuards({ticket:t,libBytes:args.libBytes,nativeBudget:args.nativeBudget,observerExpected:args.observerExpected});return{accepted:true,prefix,currentFoodSafe:true,food:proof.food,actualResidentCities:proof.actualResidentCities,operatingArmy:proof.operatingArmy,campaignCasterControllable:proof.campaignCasterControllable,referenceArmyReinserted:false,postCombatCasualtiesPreserved:true,wholeAiOrMonthTransitionAccepted:false,...noCredit()};
}
