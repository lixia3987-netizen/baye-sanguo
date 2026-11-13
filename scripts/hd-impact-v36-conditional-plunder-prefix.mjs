// Pure May V36 candidate. No filesystem, native input, payments, RNG or month.
// A source-qualified conditional END is deliberately distinct from actual food.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';
import {rawPlunderPlan,verifyRawPlunderDispatch} from './hd-impact-plunder-runtime-oracle.mjs';
import {v31VerifyPlunderReturn} from './hd-impact-v31-acquisition-policy.mjs';
import {verifyV32NoTakeoverHookFence,V32_NO_TAKEOVER_HOOKS,V32_POLICY_OBSERVER_FUNCTION_SOURCE} from './hd-impact-v32-conditional-plunder-prefix.mjs';
export {V32_NO_TAKEOVER_HOOKS,V32_POLICY_OBSERVER_FUNCTION_SOURCE};
const copy=structuredClone,eq=(a,b,label)=>assert.deepEqual(a,b,label),sha=b=>createHash('sha256').update(b).digest('hex');
export const V36_MAY_INPUT_PINS=Object.freeze([
 {path:'docs/validation/m5-impact13-classic-north-20261023-v35.json',bytes:277160,sha256:'b665bbcc23ac74fb4b3bf44e520e23f093092734912c6a1b235aebcf4a161b3f'},
 {path:'docs/validation/m5-impact13-classic-north-20261023-v35-latest-world.json',bytes:147927,sha256:'042d5f1e713fc38a9838a1e596bd417c8613a1624b81b7fc6e1ea1f8aeb3c50a'},
 {path:'docs/validation/m5-impact13-classic-north-20261023-v35-sango0.sav',bytes:8221,sha256:'d3d30df00f1733d0917714eed4b87a0b4a022a9d2868632140d433dc42e19fbe'},
 {path:'docs/validation/m5-impact13-classic-north-20261023-v35-sango1.sav',bytes:4840,sha256:'c47540f42c36db6aa7d20566ab127fb5988f4f2089808e4d8aa722c217b77877'},
].map(Object.freeze));
export const V36_PREFIX_SCOPE=Object.freeze({period:4,king:0,date:Object.freeze([239,5]),plunderCity:20,plunderPerson:44,orderIndex:0,command:26,thewCost:12,moneyCost:0,minimumCash:500,monthlyRatio:50,maximumPlunders:1,maximumMarches:1,maximumNaturalMonths:1,maximumNewBuys:0,maximumTreats:0,maximumCanvasses:0,maximumSearches:0,maximumTransportations:0,maximumMoves:0,march:Object.freeze({origin:7,destination:1,personId:131,nativeId:132,orderIndex:170,armyIndex:0,arms:2920,food:541,timeCount:2,maximumPlayerBouts:30})});
const C=V36_PREFIX_SCOPE,OWNED=Object.freeze([4,5,6,7,13,16,20]);
const FALSE=Object.freeze({publicInputAccepted:false,publicSaveAccepted:false,nativeExecutionAccepted:false,actualSupplyIncomeAccepted:false,actualPreparationAccepted:false,actualMonthAccepted:false,actualCastAccepted:false,classicNativePixelAccepted:false,hdAccepted:false,globalHdComplete:false,rngContinuityAccepted:false,futureIncomeAccepted:false});
const P={OldBelong:65535,Belong:65535,Level:255,Force:255,IQ:255,Devotion:255,Character:255,Experience:255,Thew:255,ArmsType:255,Arms:65535,Tool1:65535,Tool2:65535,Age:255};
const CITY={State:4,Belong:65535,SatrapId:65535,FarmingLimit:65535,Farming:65535,CommerceLimit:65535,Commerce:65535,PeopleDevotion:255,AvoidCalamity:255,PopulationLimit:0xffffffff,Population:0xffffffff,Money:65535,Food:65535,MothballArms:65535,PersonQueue:65535,Persons:65535,ToolQueue:65535,Tools:65535};
const ORDER={OrderId:255,Person:65535,City:255,Object:65535,Arms:65535,Food:65535,Money:65535,Consume:255,TimeCount:255};
const integer=(v,max,label)=>assert.ok(Number.isInteger(v)&&v>=0&&v<=max,label);
function dense(a,n,label){assert.ok(Array.isArray(a)&&a.length===n&&Object.keys(a).length===n,label);for(let i=0;i<n;i++)assert.ok(Object.hasOwn(a,i),label+' dense');}
function measurement(v,label,parents=new Set()){
 if(v===null||typeof v==='string'||typeof v==='boolean')return;if(typeof v==='number'){assert.ok(Number.isFinite(v),label);return;}
 assert.ok(v&&typeof v==='object'&&!parents.has(v),label+' acyclic JSON');assert.equal(Object.getPrototypeOf(v),Array.isArray(v)?Array.prototype:Object.prototype);assert.equal(Object.getOwnPropertySymbols(v).length,0);
 parents.add(v);if(Array.isArray(v))dense(v,v.length,label);for(const k of Object.keys(v)){const d=Object.getOwnPropertyDescriptor(v,k);assert.ok(Object.hasOwn(d,'value'),label+' no getter');measurement(d.value,label+'.'+k,parents);}parents.delete(v);
}
function shape(w,label='world'){
 measurement(w,label);eq([w.period,w.king,w.year,w.month],[4,0,...C.date],label+' exact May prefix');
 for(const[k,n]of Object.entries({people:200,cities:38,orders:200,queue:2000,goodsQueue:2000,fighters:600,fighterIndex:30}))dense(w[k],n,label+'.'+k);
 const typed=(x,t)=>{assert.ok(x&&!Array.isArray(x));for(const[k,max]of Object.entries(t))integer(x[k],max,label+'.'+k);};
 w.people.forEach(x=>typed(x,P));w.orders.forEach(x=>typed(x,ORDER));const physical=new Set();
 w.cities.forEach(c=>{typed(c,CITY);assert.ok(c.PersonQueue+c.Persons<=200&&c.ToolQueue+c.Tools<=2000);for(let i=c.PersonQueue;i<c.PersonQueue+c.Persons;i++){assert.ok(!physical.has(i),'No physical slice overlap');physical.add(i);integer(w.queue[i],199,'Native live PID');}});
 for(const[k,max]of Object.entries({queue:65535,goodsQueue:65535,fighters:255,fighterIndex:1}))for(const v of w[k])integer(v,max,k);
 eq(w.cities.flatMap((c,i)=>c.Belong===1?[i]:[]),OWNED,'Original owned city set');
 for(const[k,v]of Object.entries({enable16bitConsumeMoney:0,checkRedundantOnAddPerson:0,fixOverFlow16:0,enableCustomRatio:0,maxLevel:20,ratioOfFoodToArmsPerMouth:0,ratioOfFoodToArmsPerDay:0,aiLevelUpSpeed:0}))assert.equal(w.config[k],v,'Original current config '+k);
 assert.equal(w.lookMovie,1);assert.ok(w.engineDebug===null||w.engineDebug===0);return w;
}
const raw=(w,c)=>w.queue.slice(w.cities[c].PersonQueue,w.cities[c].PersonQueue+w.cities[c].Persons);
const residents=(w,c)=>raw(w,c).filter(id=>w.people[id].Belong===1);
const locations=(w,id)=>w.cities.flatMap((c,i)=>raw(w,i).flatMap(pid=>pid===id?[i]:[]));
const ownedLocations=(w,id)=>OWNED.flatMap(c=>residents(w,c).flatMap(pid=>pid===id?[c]:[]));
function library(libBytes){assert.ok(Buffer.isBuffer(libBytes)||libBytes instanceof Uint8Array);const b=Buffer.from(libBytes);eq([b.length,sha(b)],[207195,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e']);return b;}
function caster(w,{departed=false}={}){eq([w.people[131].Belong,w.people[131].Level,w.people[131].Force,w.people[131].IQ,w.people[131].ArmsType,w.people[131].Arms,w.people[131].Thew,w.people[131].Tool1,w.people[131].Tool2],[1,17,42,80,1,2920,100,0,0]);eq(ownedLocations(w,131),departed?[]:[7],'Only current owned131 location; foreign stale raw PID is retained');}
function economics(w){const c=w.cities[20],p=w.people[44];eq([p.IQ,p.Force,p.Arms,p.Belong],[46,83,0,1]);const n=p.IQ+p.Force;assert.ok(c.Food+n*5<=65535&&c.Money+n*2<=65535);return{PeopleDevotion:Math.floor(c.PeopleDevotion/2),Farming:Math.floor(c.Farming/2),Commerce:Math.floor(c.Commerce/2),Food:c.Food+n*5,Money:c.Money+n*2};}
function del(w,c,id){const at=w.cities[c].PersonQueue+raw(w,c).indexOf(id);assert.ok(raw(w,c).includes(id));for(let j=at;j<199;j++)w.queue[j]=w.queue[j+1];w.cities[c].Persons--;for(let i=c+1;i<38;i++)w.cities[i].PersonQueue--;}
function add(w,c,id){const at=w.cities[c].PersonQueue;for(let j=199;j>at;j--)w.queue[j]=w.queue[j-1];w.queue[at]=id;w.cities[c].Persons++;for(let i=c+1;i<38;i++)w.cities[i].PersonQueue++;}
function saved(publicSave,w){measurement(publicSave,'save');assert.ok(publicSave&&typeof publicSave.tag==='string'&&/v36-[a-z0-9-]+$/.test(publicSave.tag));eq(publicSave.before.world,w,'Full supplied SAVE before');eq(publicSave.after.world,w,'Full supplied SAVE after');return{tag:publicSave.tag,worldSha256:sha(Buffer.from(JSON.stringify(w))),publicSaveAccepted:false,packedProofAndPublicOwnerStillRequired:true};}
export function verifyV36MayInput({publicationBytes,worldBytes,sav0Bytes,sav1Bytes}={}){
 const all=[publicationBytes,worldBytes,sav0Bytes,sav1Bytes].map((v,i)=>{assert.ok(Buffer.isBuffer(v)||v instanceof Uint8Array);const b=Buffer.from(v);eq([b.length,sha(b)],[V36_MAY_INPUT_PINS[i].bytes,V36_MAY_INPUT_PINS[i].sha256],'Exact published May input '+i);return b;});
 const pub=JSON.parse(all[0]),world=JSON.parse(all[1]),c=pub.latestSavedCheckpoint;shape(world);eq([c.tag,c.date,c.slot,c.pendingOrders],['impact13-129-v35-north-route-settled',[239,5],0,[]]);assert.equal(pub.independentFlags.actualCastAccepted,true);assert.equal(pub.independentFlags.campaignContinuationReady,false);
 eq(c.world.published,V36_MAY_INPUT_PINS[1]);eq(c.pair.map(x=>x.published),V36_MAY_INPUT_PINS.slice(2));
 const proof=verifyOriginalSavePair({sav0:all[2].toString('hex'),sav1:all[3].toString('hex'),world});assert.equal(proof.ok,true);
 return{accepted:true,inputPins:copy(V36_MAY_INPUT_PINS),world,pair:{sav0:all[2].toString('hex'),sav1:all[3].toString('hex'),lib:'libs/dat-mod.lib',identity:'v1:414390:1d36da77:1e9c0477'},fullPackedInputProof:proof,sourceOnly:true,...FALSE};
}
/** Returning army counts its complete current2920, never only retained600. */
export function assessV36OwnedFood({world:w,includeReturningArmy=true,activeBattle=false}={}){
 shape(w);assert.equal(typeof includeReturningArmy,'boolean');assert.equal(typeof activeBattle,'boolean');const rows=[];
 for(const city of OWNED){const c=w.cities[city],ids=residents(w,city),counted=new Set(ids);assert.equal(counted.size,ids.length,'Unique owned current residents');let total=c.MothballArms+ids.reduce((n,id)=>n+w.people[id].Arms,0);const returningArmy=[],pendingIds=[];
  for(const o of w.orders)if(o.OrderId!==255&&o.City===city){
   if(o.OrderId===27){assert.equal(city,7);eq([o.Person,o.Object,o.Food,o.TimeCount],[0,1,541,2]);if(!includeReturningArmy)continue;assert.equal(w.fighterIndex[0],activeBattle?0:1,'Actual pending or observed active-battle army');eq(w.fighters.slice(0,20),[132,...Array(19).fill(0)]);assert.ok(!counted.has(131));assert.equal(w.people[131].Belong,1);counted.add(131);returningArmy.push(131);total+=w.people[131].Arms;
   }else if(o.Person<200&&w.people[o.Person].Belong===1){eq([o.OrderId,o.City,o.Person],[26,20,44],'Only local Plunder worker may be pending');assert.ok(!counted.has(44));counted.add(44);pendingIds.push(44);total+=w.people[44].Arms;}
  }
  assert.ok(total<=65535);const requiredFood=Math.floor(total/50)+1;rows.push({city,residentIds:ids,pendingIds,returningArmy,totalArms:total,food:c.Food,money:c.Money,requiredFood,actualSafe:c.Food>=requiredFood&&c.Money>=500});
 }
 return{accepted:rows.every(x=>x.actualSafe),rows,includeReturningArmy,activeBattle,futureIncomeCredited:false,...FALSE};
}
export function planV36ConditionalPlunderPrefix({world:w,libBytes}={}){
 shape(w);library(libBytes);assert.ok(w.orders.every(o=>o.OrderId===255)&&w.fighterIndex.every(v=>v===0),'New settled May only; no replay');caster(w);
 eq([w.cities[20].Food,w.cities[20].Money,w.cities[20].MothballArms,w.people[44].Thew],[1,570,0,28]);eq(ownedLocations(w,44),[20]);eq([w.people[129].Belong,w.people[129].Arms],[65535,0]);eq(locations(w,129),[12],'Captured129 remains an enemy raw captive');
 const native=rawPlunderPlan({world:w,libBytes});eq([native.orderIndex,native.cityIndex,native.personId,native.thew,native.moneyCost],[0,20,44,12,0]);
 const currentSafety=assessV36OwnedFood({world:w});eq(currentSafety.rows.filter(r=>!r.actualSafe).map(r=>r.city),[20]);eq(currentSafety.rows.find(r=>r.city===20).requiredFood,267);
 const forecast=economics(w),model=copy(w);Object.assign(model.cities[20],forecast);const forecastSafety=assessV36OwnedFood({world:model});assert.equal(forecastSafety.accepted,true);
 return{accepted:true,sourceOnly:true,sourcePrefixQualified:true,currentSafety,native,forecast,forecastSafety,foodGain:645,moneyGain:258,actualCurrentFoodSafe:false,forecastIsActualIncome:false,actualIncomeObservedInSuppliedEvidence:false,requiredBeforeBattle:'Exact readonly slot0→next callback complete Plunder/AddPerson/DelOrder plus full actual owned food and current returning131',...FALSE};
}
export function verifyV36PlunderDispatch({before,after,during,libBytes,publicSave}={}){
 const plan=planV36ConditionalPlunderPrefix({world:before,libBytes}),native=verifyRawPlunderDispatch({before,after,during,libBytes});shape(after);eq(after.orders.flatMap((o,i)=>o.OrderId===255?[]:[i]),[0]);eq([after.cities[20].Food,after.cities[20].Money],[1,570]);
 return{accepted:true,plan,native,saved:saved(publicSave,after),actualCurrentFoodSafe:false,actualIncomeObservedInSuppliedEvidence:false,...FALSE};
}
function queued(w,ref,dispatch){
 shape(w);shape(ref);caster(ref);const expected=copy(dispatch),pending=w.orders.flatMap((o,i)=>o.OrderId===255?[]:[i]);
 assert.ok(JSON.stringify(pending)==='[0]'||JSON.stringify(pending)==='[0,170]','Only Plunder0 plus optional single131 March170');
 if(pending.length===2){caster(w,{departed:true});del(expected,7,131);expected.cities[7].Food-=541;expected.fighterIndex[0]=1;for(let j=0;j<20;j++)expected.fighters[j]=j===0?132:0;
  Object.assign(expected.orders[170],{OrderId:27,Person:0,City:7,Object:1,Food:541,TimeCount:2});for(const k of ['Arms','Money','Consume'])expected.orders[170][k]=w.orders[170][k];
 }else caster(w);
 eq(w,expected,'Complete bound original local prefix and optional March541; raw tails and unknown fields retained');return{accepted:true,march:pending.length===2,completeQueuedPlayerPrefixPreserved:true};
}
function dispatchFrom(ref,queuedWorld){const d=copy(ref);d.people[44].Thew-=12;Object.assign(d.orders[0],{OrderId:26,Person:44,City:20,TimeCount:0});for(const k of ['Object','Arms','Food','Money','Consume'])d.orders[0][k]=queuedWorld.orders[0][k];del(d,20,44);return d;}
function guard(w,ref,q,{returned,activeBattle=false}={}){
 shape(w);shape(ref);const march=q.orders[170].OrderId===27;caster(w,{departed:march});
 for(const city of OWNED){let ids=raw(q,city);if(returned&&city===20)ids=[44,...ids];eq(raw(w,city),ids,'Every raw owned slice incl foreign stale PID is retained '+city);
  const expected={...q.cities[city],State:0,PersonQueue:w.cities[city].PersonQueue};if(returned&&city===20){Object.assign(expected,economics(q));expected.Persons++;}eq(w.cities[city],expected,'Complete owned economics/military city fields '+city);
  for(const id of residents(ref,city)){const p=copy(ref.people[id]);if(id===44)p.Thew-=12;eq(w.people[id],p,'Complete original owned person '+id);}
 }
 eq(w.orders[0],returned?{...q.orders[0],OrderId:255}:q.orders[0]);if(march)eq(w.orders[170],q.orders[170]);
 for(let i=0;i<200;i++){const o=w.orders[i];if(o.OrderId!==255&&i!==0&&i!==170)assert.ok(!OWNED.includes(o.City),'No unaccounted owned order');}
 // ComputerTactic may legitimately allocate enemy army slots after the SAVE.
 // Only our bound army0 is predicted across that gap. The adjacent native
 // Plunder transition below still compares all600/30 bytes, including enemies.
 if(march){eq(w.fighters.slice(0,20),q.fighters.slice(0,20),'Complete player army0');assert.equal(w.fighterIndex[0],activeBattle?0:1,'Only actual own PICK releases player army0');}
 return{accepted:true,returned,activeBattle,completeOriginalOwnedPeoplePreserved:true,rawForeignDuplicatesPreserved:true,...FALSE};
}
export function verifyV36ConditionalEndAdmission({world:w,referenceWorld:ref,dispatchWorld:dispatch,libBytes,publicSave,hookFence,observerExpected}={}){
 planV36ConditionalPlunderPrefix({world:ref,libBytes});verifyRawPlunderDispatch({before:ref,after:dispatch,libBytes});const prefix=queued(w,ref,dispatch),s=saved(publicSave,w);
 const hooks=verifyV32NoTakeoverHookFence({snapshot:hookFence,observerExpected});assert.ok(observerExpected&&observerExpected!==false,'Frozen readonly observer required at conditional END');
 const currentSafety=assessV36OwnedFood({world:w});eq(currentSafety.rows.filter(r=>!r.actualSafe).map(r=>r.city),[20]);const model=copy(w),forecast=economics(w);Object.assign(model.cities[20],forecast);const conditionalSourceSafety=assessV36OwnedFood({world:model});assert.equal(conditionalSourceSafety.accepted,true);
 return{accepted:true,conditionalEndAdmissionQualified:true,actualCurrentFoodSafe:false,forecastIsActualIncome:false,actualIncomeObservedInSuppliedEvidence:false,currentSafety,forecast,conditionalSourceSafety,prefix,guardProof:prefix,saved:s,hooks,...FALSE};
}
function epoch(t){
 measurement(t,'actual ticket');assert.ok(t&&t.state?.snapshot&&t.meta?.currentIdentity===true);const i=t.meta.identity;assert.ok(i&&i.status==='ready');eq([i.sha256,i.byteLength],['3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',207195]);integer(i.generation,0xffffffff,'LIB generation');assert.ok(i.generation>0);eq(t.state.snapshot.library,i,'Whole raw/library ticket');
 const refs=t.state.snapshot.references;for(const k of ['data','engine','hd']){integer(refs?.[k],0xffffffff,'reference '+k);assert.ok(refs[k]>0);}integer(t.state.snapshot.spe?.generation,0xffffffff,'SPE generation');integer(t.state.keys,0xffffffff,'actual key count');
 const meta=copy(t.meta);delete meta.city;delete meta.cityPos;eq([meta.monthlyRatio,meta.dailyRatio,meta.aiLevelUpSpeed,meta.orderCapacity,meta.boutMax],[0,0,0,200,30]);return{references:copy(refs),generation:t.state.snapshot.spe.generation,identity:copy(i),meta,config:copy(t.world.config)};
}
function readonly(s,i,calls,observerExpected){
 measurement(s,'callback');assert.ok(s&&!s.error);eq(s.ordinal,i);eq(s.order,calls[i]);eq(s.a,s.b,'Complete callback A=B');eq(s.contextAfter,s.order);eq(s.asyncBefore,s.asyncAfter,'All async metadata unchanged');dense(s.asyncBefore?.params,32,'All32 async parameters');eq([s.returnValue,s.contextUnchanged,s.asyncActionUnchanged],[-1,true,true]);shape(s.b.world);epoch(s.b);verifyV32NoTakeoverHookFence({snapshot:s.b.meta.v32HookFence,observerExpected});assert.ok(s.b.meta.gameplayHooks?.length);for(const h of s.b.meta.gameplayHooks)assert.equal(h.present,false);eq(s.slotCandidates,s.b.world.orders.flatMap((o,j)=>JSON.stringify(o)===JSON.stringify(s.order)?[j]:[]),'Complete native order candidate slots');
}
export function verifyV36PlunderPrefixObserved({queuedWorld:q,observer,referenceWorld:ref,libBytes,observerExpected}={}){
 planV36ConditionalPlunderPrefix({world:ref,libBytes});const dispatch=dispatchFrom(ref,q);verifyRawPlunderDispatch({before:ref,after:dispatch,libBytes});queued(q,ref,dispatch);
 assert.ok(observer?.installed===true);dense(observer.samples,observer.samples.length,'samples');dense(observer.calls,observer.samples.length,'calls');assert.ok(observer.samples.length>=2,'Immediate next native callback is required');
 for(let i=0;i<observer.samples.length;i++){readonly(observer.samples[i],i,observer.calls,observerExpected);if(i){eq(epoch(observer.samples[i].b),epoch(observer.samples[0].b),'Same whole native epoch');assert.ok(observer.samples[i].b.state.keys>=observer.samples[i-1].b.state.keys);}}
 const first=observer.samples[0],next=observer.samples[1];eq(first.slotCandidates,[0],'Plunder is first actual native callback');eq(first.order,q.orders[0]);eq(first.b.state.keys,next.b.state.keys,'Native timed Plunder return sends zero further keys');assert.equal(next.slotCandidates.length,1);assert.ok(next.slotCandidates[0]>0);
 const before=first.b.world,after=next.b.world;guard(before,ref,q,{returned:false});const transition=v31VerifyPlunderReturn({before,after,orderIndex:0});guard(after,ref,q,{returned:true});eq([after.cities[20].Food,after.cities[20].Money],[646,828]);const food=assessV36OwnedFood({world:after});assert.equal(food.accepted,true,'Only observed actual income may close food safety');
 return{accepted:true,completeAdjacentNativePrefixAccepted:true,callbackOrdinal:0,nextCallbackOrdinal:1,callbackCount:observer.samples.length,transition,food,actualIncomeObservedInSuppliedEvidence:true,actualCurrentFoodSafe:true,wholeMonthWorldAccepted:false,modeledIntermediateWasObserved:false,...FALSE};
}
export function verifyV36AfterPrefixActualFoodAndGuards({queuedWorld:q,observer,ticket,referenceWorld:ref,libBytes,kind,ordinal=null,observerExpected}={}){
 assert.ok(['native-callback','native-order27-callback','before-defender-input','first-own-pick'].includes(kind));let prefix=observer;
 if(kind.startsWith('native-')){integer(ordinal,observer.samples.length-1,'actual callback ordinal');assert.ok(ordinal>=1);prefix={...observer,samples:observer.samples.slice(0,ordinal+1),calls:observer.calls.slice(0,ordinal+1)};eq(prefix.samples.at(-1).b,ticket,'Exact current callback ticket');if(kind==='native-order27-callback')assert.equal(prefix.samples.at(-1).order.OrderId,27);}
 const proof=verifyV36PlunderPrefixObserved({queuedWorld:q,observer:prefix,referenceWorld:ref,libBytes,observerExpected});for(const s of prefix.samples)assert.ok(s.b.state.keys<=ticket.state.keys,'No future callback may authorize earlier input');eq(epoch(ticket),epoch(prefix.samples[0].b),'Actual current ticket retains whole native epoch');verifyV32NoTakeoverHookFence({snapshot:ticket.meta.v32HookFence,observerExpected});
 const activeBattle=kind==='first-own-pick';if(activeBattle){const f=ticket.state.snapshot.fight,units=ticket.state.snapshot.units;eq([f.active,f.over,f.inputKind,f.cityIndex],[1,0,1,1]);dense(units,20,'Actual20-slot first PICK');units.forEach((u,i)=>assert.equal(u.i,i));eq(units.slice(0,10).map(u=>u.id),[132,...Array(9).fill(0)]);assert.equal(units[0].person.arms,ticket.world.people[131].Arms);}
 const guardProof=guard(ticket.world,ref,q,{returned:true,activeBattle}),actualCurrentFoodModel=assessV36OwnedFood({world:ticket.world,activeBattle});assert.equal(actualCurrentFoodModel.accepted,true,'Full strict actual food before later native callback/battle/defender');
 return{accepted:true,kind,ordinal,prefix:proof,guardProof,actualCurrentFoodSafe:true,actualCurrentFoodModel,actualIncomeObservedInSuppliedEvidence:true,...FALSE};
}
