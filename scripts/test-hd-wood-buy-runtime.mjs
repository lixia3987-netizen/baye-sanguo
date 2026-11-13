import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './hd-wood-buy-runtime.mjs';
import {verifyBuyEndAdmission} from './hd-wood-buy-continuation.mjs';
import {sourceOriginalWoodRoute} from './hd-wood-native-route.mjs';
import {createBuyFixture,ticket,raw,add,del} from './fixtures/hd-wood-buy-continuation.mjs';

const copy=structuredClone;
let prepared;
function base(){return copy(prepared??=createBuyFixture());}
function sample(t,ordinal,slot){const order=copy(t.world.orders[slot]),async={id:255,params:Array.from({length:32},(_,i)=>i===31?0xffffffff:i),text:'all original async fields',unknownAsync:{keep:[null,7]}};return{ordinal,order,a:copy(t),b:copy(t),contextAfter:copy(order),asyncBefore:async,asyncAfter:copy(async),returnValue:-1,contextUnchanged:true,asyncActionUnchanged:true,slotCandidates:[slot]};}
function effective(p,b){const at=b.readUInt32LE(65*4);let arm=p.ArmsType;for(const id of[p.Tool1,p.Tool2])if(id){const v=b[at+14+(id-1)*66+65];if(v)arm=v===1?3:v===2?5:v===3?4:v-4;}return arm;}
function battleTicket(w,k,a){const t=ticket(w,k,{installed:true}),r=sourceOriginalWoodRoute({libBytes:a.libBytes,...a.route}),s=t.state.snapshot;s.fight={active:1,over:0,wait:1,inputKind:1,cityIndex:r.destination,actorIndex:255,futureFight:{keep:9}};const ids=raw(w,r.destination).filter(id=>w.people[id].Belong===w.cities[r.destination].Belong&&w.people[id].Arms>0).sort((x,y)=>w.people[y].Arms-w.people[x].Arms).slice(0,10);for(const[i,id]of[[0,131],...ids.map((id,j)=>[10+j,id])]){const p=w.people[id],pos=i===0?r.sourceInitialPlayerPosition:r.sourceInitialDefenderPositions[i-10];s.units[i]={i,id:id+1,position:{x:pos.x,y:pos.y,hp:100,mp:i===0?60:50,move:5,active:0,state:0,futurePosition:{keep:3}},person:{personIndex:id,name:i?'fresh foreign':'张休',arms:p.Arms,belong:p.Belong,level:p.Level,armType:effective(p,Buffer.from(a.libBytes)),tool1:p.Tool1,tool2:p.Tool2,futurePerson:{keep:6}}};}s.nativeBattle={mode:1,way:r.nativeWay,mapId:r.mapId,cityIndex:r.destination,playerFood:w.orders[170].Food,enemyFood:500,genArray:s.units.map(u=>u.id),futureNative:{keep:4}};return t;}
function fixture({ai=true}={}){const a=base(),w=copy(a.queuedWorld),k=a.dispatchSave.after.state.keys+5;w.cities.forEach(c=>c.State=0);if(ai)Object.assign(w.orders[1],{OrderId:3,Person:3,City:1,Object:0,TimeCount:0});const samples=[sample(ticket(w,k,{installed:true}),0,0)];add(w,20,50);w.orders[0].OrderId=255;samples.push(sample(ticket(w,k,{installed:true}),1,ai?1:170));if(ai){w.orders[1].OrderId=255;w.people[71].Arms+=80;samples.push(sample(ticket(w,k,{installed:true}),2,170));}const callback=copy(samples.at(-1)),pick=copy(w);pick.fighterIndex[0]=0;const t=battleTicket(pick,k,a);return{...a,observer:{installed:true,calls:samples.map(s=>copy(s.order)),samples},ticket:t,callback,kind:'first-own-pick',firstPick:{first:copy(t),second:copy(t),final:copy(t)}};}
function both(a,i,fn){for(const side of['a','b'])fn(a.observer.samples[i][side]);}
function allObserved(a,fn){for(let i=0;i<a.observer.samples.length;i++)both(a,i,fn);}
function picks(a,fn){fn(a.ticket);for(const name of['first','second','final'])fn(a.firstPick[name]);}
function noCredit(r){for(const k of['actualInputAccepted','publicInputAccepted','publicSaveAccepted','nativeExecutionAccepted','actualCostAccepted','actualBuyAccepted','actualNativeReturnAccepted','actualMarchAccepted','actualPreparationAccepted','actualMonthAccepted','actualBattleMpObserved','actualCastAccepted','actualClassicAccepted','classicNativePixelAccepted','fallbackAccepted','hdAccepted','globalHdComplete','rngContinuityAccepted'])assert.equal(r[k],false,k);}

test('fixture replays complete Buy40 and original packed March/SAVEs through the current formal core',()=>{const a=base(),r=verifyBuyEndAdmission(a);assert.equal(r.accepted,true);assert.equal(r.budget.carryFood,481);assert.deepEqual(r.expectedOrders.map(x=>[x.slot,x.order.OrderId]),[[0,11],[170,27]]);assert.deepEqual(r.expectedNativeBattle,{mode:1,way:4,mapId:112,cityIndex:12,cargo:481,nativeSlots:20});assert.deepEqual(a.route,{origin:16,destination:12});});
test('Buy0 returns through its immediate AI1 successor, with full AddPerson/DelOrder and no repeated income',()=>{const a=fixture(),before=JSON.stringify(a),r=R.verifyBuyPrefixObserved(a);assert.equal(r.completeAdjacentBuyReturn,true);assert.equal(r.nextNativeSlot,1);assert.equal(r.additionalFoodAtReturn,0);assert.equal(r.additionalMoneyAtReturn,0);assert.equal(r.afterGuard.food.rows.find(x=>x.city===20).food,267);assert.equal(JSON.stringify(a),before);noCredit(r);});
test('without an intervening active AI order the immediate Buy successor is own170',()=>{const r=R.verifyBuyPrefixObserved(fixture({ai:false}));assert.equal(r.nextNativeSlot,170);noCredit(r);});
test('distinct170 callback and three current PICK tickets bind map112/Way4/cargo481/MP60/full20',()=>{const r=R.verifyBuyBeforeOwn(fixture());assert.deepEqual(r.pick.nativeRoute,{mode:1,way:4,mapId:112,cityIndex:12,cargo:481});assert.equal(r.pick.actualNativeMpInSuppliedTicket,60);assert.equal(r.pick.enemyIdsPredicted,false);noCredit(r);});
test('native170 and pre-defender gates independently replay the paid source chain and observed Buy return',()=>{for(const kind of['native-order27-callback','before-defender-input']){const a=fixture();a.kind=kind;a.ticket=copy(a.callback.b);assert.equal(R.verifyBuyBeforeOwn(a).accepted,true);}});
test('actual MP45 qualifies; initial forest terrain grants no cast acceptance',()=>{const a=fixture();picks(a,t=>t.state.snapshot.units[0].position.mp=45);const r=R.verifyBuyBeforeOwn(a);assert.equal(r.pick.actualNativeMpInSuppliedTicket,45);noCredit(r);});
test('only actual city presentation and position diagnostics may vary during the complete callback epoch',()=>{const a=fixture();both(a,1,t=>{t.meta.city={sending:false,queueLen:0,walkBusy:false,futureCityDiagnostic:9};t.meta.cityPos={x:1,y:2,setx:3,sety:4};});assert.equal(R.verifyBuyPrefixObserved(a).accepted,true);});
test('one original PolicyExec cannot repeat an otherwise complete same-slot AI callback',()=>{const a=fixture(),s=copy(a.observer.samples[1]);a.observer.samples.splice(2,0,s);a.observer.samples.forEach((row,i)=>row.ordinal=i);a.observer.calls=a.observer.samples.map(row=>copy(row.order));assert.throws(()=>R.verifyBuyPrefixObserved(a),/strictly increasing native slots/);});
test('one original PolicyExec cannot use a later complete AI2 row to authorize a backwards AI1 row',()=>{const a=fixture(),activeOrder=(w,slot)=>{Object.assign(w.orders[slot],{OrderId:3,Person:3,City:1,Object:0,TimeCount:0});};for(let i=0;i<2;i++)both(a,i,t=>{t.world.orders[1]=copy(a.queuedWorld.orders[1]);activeOrder(t.world,2);});a.observer.samples[1]=sample(a.observer.samples[1].b,1,2);const t=copy(a.observer.samples[1].b);t.world.orders[2].OrderId=255;activeOrder(t.world,1);a.observer.samples.splice(2,0,sample(t,2,1));a.observer.samples.forEach((s,i)=>s.ordinal=i);a.observer.calls=a.observer.samples.map(s=>copy(s.order));assert.throws(()=>R.verifyBuyPrefixObserved(a),/strictly increasing native slots/);});

for(const[name,change,match]of[
 ['return value takeover',a=>a.observer.samples[0].returnValue=0,/No hook takeover/],
 ['one readonly world field',a=>a.observer.samples[0].a.world.orders[0].futureOrder.keep++,/readonly callback/],
 ['full context unknown field',a=>a.observer.samples[0].contextAfter.futureOrder.keep++,/context unchanged/],
 ['complete async unknown field',a=>a.observer.samples[0].asyncAfter.unknownAsync.keep[1]++,/async fields/],
 ['original action is not U8',a=>{for(const k of['asyncBefore','asyncAfter'])a.observer.samples[0][k].id=256;},/BIND_U8/],
 ['original U32 high parameter overflow',a=>{for(const k of['asyncBefore','asyncAfter'])a.observer.samples[0][k].params[31]=0x100000000;},/U32 parameter/],
 ['missing32 parameter',a=>{for(const k of['asyncBefore','asyncAfter'])a.observer.samples[0][k].params.pop();},/All32/],
 ['context order underflow',a=>{a.observer.calls[0].Consume=-1;a.observer.samples[0].order.Consume=-1;},/Typed original/],
 ['noncontiguous callback ordinal',a=>a.observer.samples[1].ordinal=2,/Contiguous/],
 ['one extra native input during Buy return',a=>{for(let i=1;i<a.observer.samples.length;i++)both(a,i,t=>t.state.keys++);},/Zero inputs/],
 ['borrowed SPE generation',a=>both(a,1,t=>t.state.snapshot.spe.generation++),/SPE generation/],
 ['sequence field overflow',a=>both(a,1,t=>t.state.march.session=0x100000000),/U32 owner/],
 ['future native successor skips activeAI1',a=>{a.observer.samples.splice(1,1);a.observer.calls.splice(1,1);a.observer.samples[1].ordinal=1;},/smallest active/],
 ['second income at return',a=>both(a,1,t=>t.world.cities[20].Food+=40),/Complete original Buy/],
 ['complete source reference switched consistently',a=>allObserved(a,t=>t.state.snapshot.references.engine++),/source SAVE reference/],
 ['complete unknown metadata switched consistently',a=>allObserved(a,t=>t.meta.unknownMeta.keep[0]++),/source SAVE reference/],
 ['trusted stock hook same source new function reference',a=>allObserved(a,t=>t.meta.recruitmentHookFence.hooks[0].functionRef++),/source SAVE reference/],
 ['captured129 fields persistently poisoned',a=>allObserved(a,t=>t.world.people[129].Arms++),/captured129/],
 ['foreign roster joins player throughout all callbacks',a=>allObserved(a,t=>t.world.people[65].Belong=1),/player roster/],
 ['unused queue tail persistently poisoned',a=>allObserved(a,t=>t.world.queue[1999]--),/queue tail/],
 ['no full saved Buy evidence',a=>{delete a.buy;a.buyPassed=true;},undefined],
 ['packed SAVE checksum cannot be replaced by passed receipt',a=>{a.referenceSave.files[0].sha256='0'.repeat(64);a.preparationPassed=true;},undefined],
 ['no mandatory actual target walk',a=>delete a.marchEvidence.targetWalk,/target|Target/],
])test('reject '+name,()=>{const a=fixture();change(a);assert.throws(()=>R.verifyBuyPrefixObserved(a),match);});

for(const[name,change,match]of[
 ['routeMode',a=>picks(a,t=>t.state.snapshot.nativeBattle.mode=0),/native route/],
 ['old routeWay3',a=>picks(a,t=>t.state.snapshot.nativeBattle.way=3),/native route/],
 ['old map110',a=>picks(a,t=>t.state.snapshot.nativeBattle.mapId=110),/native route/],
 ['other destination',a=>picks(a,t=>t.state.snapshot.nativeBattle.cityIndex=15),/native route/],
 ['wrong actual cargo',a=>picks(a,t=>t.state.snapshot.nativeBattle.playerFood++),undefined],
 ['short GenArray',a=>picks(a,t=>t.state.snapshot.nativeBattle.genArray.pop()),/Complete20/],
 ['current enemy metadata does not match native person',a=>picks(a,t=>t.state.snapshot.units[10].person.level++),/token\/person/],
 ['actor source MP formula instead of sufficient actual MP',a=>picks(a,t=>t.state.snapshot.units[0].position.mp=44),/Actual current MP/],
 ['first spawn of old route',a=>picks(a,t=>t.state.snapshot.units[0].position.y=16),/route-derived spawn/],
 ['live native result',a=>picks(a,t=>t.state.snapshot.result.active=true),undefined],
 ['final ticket key moved after second read',a=>a.firstPick.final.state.keys++,/Final whole PICK/],
 ['final ticket unknown fight drift',a=>a.firstPick.final.state.snapshot.fight.futureFight.keep++,/Final whole PICK/],
 ['borrowed170 context',a=>a.callback.order.Food++,undefined],
 ['future callback beyond own170',a=>{const t=copy(a.callback.b);Object.assign(t.world.orders[171],{OrderId:3,City:1,Person:3});a.observer.samples.push(sample(t,3,171));a.observer.calls.push(copy(t.world.orders[171]));},/future callback/],
])test('first PICK rejects '+name,()=>{const a=fixture();change(a);assert.throws(()=>R.verifyBuyBeforeOwn(a),match);});

function post(a,{city=16,arms=2200,captured=false,live=false}={}){const w=copy(a.ticket.world);w.people[131].Arms=arms;w.people[131].Experience+=4;w.orders[170].OrderId=255;if(captured)w.people[131].Belong=65535;else if(!live)add(w,city,131);const t=live?battleTicket(w,a.ticket.state.keys+4,a):ticket(w,a.ticket.state.keys+4,{installed:true});a.ticket=t;return a;}
test('post-own actual losses/EXP and return to another owned city are preserved without source army reinsertion',()=>{const a=post(fixture(),{city:7}),r=R.verifyBuyAfterOwnCurrentGuards(a);assert.deepEqual(r.actualResidentCities,[7]);assert.equal(r.food.rows.find(x=>x.city===16).totalArms,4377);assert.equal(r.referenceArmyReinserted,false);noCredit(r);});
test('post-own captured caster with zero arms remains a measured cost rather than current controllable army',()=>{const a=post(fixture(),{captured:true,arms:0}),r=R.verifyBuyAfterOwnCurrentGuards(a);assert.equal(r.campaignCasterControllable,false);assert.deepEqual(r.actualResidentCities,[]);noCredit(r);});
test('post-own current zero-arm resident is retained without another March qualification',()=>{const r=R.verifyBuyAfterOwnCurrentGuards(post(fixture(),{arms:0}));assert.equal(r.campaignCasterControllable,false);});
test('a genuinely current full native battle may account for an absent owned caster after170 retires',()=>{const r=R.verifyBuyAfterOwnCurrentGuards(post(fixture(),{live:true}));assert.deepEqual(r.operatingArmy,{origin:16,personId:131});assert.equal(r.food.rows.find(x=>x.city===16).totalArms,6577);noCredit(r);});
test('retired132 and flag0 alone cannot invent a current operating army',()=>{const a=post(fixture(),{live:true});a.ticket.state.snapshot.fight.active=0;assert.throws(()=>R.verifyBuyAfterOwnCurrentGuards(a),/Retired132/);});
test('later nativeAI callback keeps complete readonly epoch while preserving legitimate caster loss',()=>{const a=post(fixture(),{city:7}),t=copy(a.ticket);Object.assign(t.world.orders[171],{OrderId:3,Person:3,City:1});a.observer.samples.push(sample(t,3,171));a.observer.calls.push(copy(t.world.orders[171]));assert.equal(R.verifyBuyAfterOwnCurrentGuards(a).accepted,true);});
test('post-own refuses a later-month SAVE as authorization for a current policy input',()=>{const a=post(fixture());a.ticket.world.month++;assert.throws(()=>R.verifyBuyAfterOwnCurrentGuards(a),/Only current policy/);});
test('post-own actual food must remain strictly safe rather than borrow a forecast Buy',()=>{const a=post(fixture());a.ticket.world.cities[20].Food=266;assert.throws(()=>R.verifyBuyAfterOwnCurrentGuards(a),/strict food/);});
