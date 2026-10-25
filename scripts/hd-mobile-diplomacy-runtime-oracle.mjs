// Pure original diplomacy dispatch checks; never input, mutate native state or execute a month.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileDiplomacyOracleContract=Object.freeze({
 originalLib:Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
 counts:Object.freeze({people:200,cities:38,queue:2000,orders:200,fighters:600,fighterIndex:30}),
 commands:Object.freeze([15,16,17,19]),initializedOrder:Object.freeze(['OrderId','Person','City','Object','TimeCount']),
 uninitializedOrder:Object.freeze(['Arms','Food','Money','Consume']),
 nativeSources:Object.freeze(['vendor/iBaye/src/citycmdc.c:573-887','vendor/iBaye/src/citycmde.c:357-464','vendor/iBaye/src/cityedit.c:108-145,552-578,696-711,790-890']),
 scope:'One measured dispatch before a month or another command; ordinary successful dispatch has no report',
 publicInputAccepted:false,monthEffectsAccepted:false,wholeNativeAbiAccepted:false,fullHdAccepted:false
});
const PERSON=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'];
const CITY8=new Set(['State','AvoidCalamity','PeopleDevotion']);
const ORDER=['OrderId','City','Person','Object','TimeCount','Arms','Food','Money','Consume'];
const ORDER8=new Set(['OrderId','City','TimeCount','Consume']);
const CONFIG=['enable16bitConsumeMoney','checkRedundantOnAddPerson','armsPerMoney','armsPerDevotion','fixOverFlow16','enableCustomRatio',
  'ratioOfArmsToLevel','ratioOfArmsToAge','ratioOfArmsToIQ','ratioOfArmsToForce','disableExpGrowing','maxLevel','disableAllPersonReport','fixAlienateComsumeThew'];
const FLAGS=['enable16bitConsumeMoney','checkRedundantOnAddPerson','fixOverFlow16','enableCustomRatio','disableExpGrowing','disableAllPersonReport','fixAlienateComsumeThew'];
function integer(v,min,max,label) {assert.ok(Number.isInteger(v)&&v>=min&&v<=max,label+' integer '+min+'..'+max);return v;}
function dense(a,n,label) {
  assert.ok(Array.isArray(a)&&a.length===n,label+' exact length '+n);
  assert.equal(Object.keys(a).length,n,label+' indexed array only');
  for(let i=0;i<n;i++)assert.ok(Object.hasOwn(a,i),label+' missing index '+i);
}
function measurement(v,label,parents=new Set()) {
  if(typeof v==='number'){assert.ok(Number.isFinite(v),label+' finite number');return;}
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  assert.ok(typeof v==='object',label+' JSON measurement');assert.ok(!parents.has(v),label+' acyclic measurement');
  assert.equal(Object.getOwnPropertySymbols(v).length,0,label+' no symbol fields');
  assert.equal(Object.getPrototypeOf(v),Array.isArray(v)?Array.prototype:Object.prototype,label+' plain measurement');
  parents.add(v);if(Array.isArray(v))dense(v,v.length,label);
  for(const k of Object.keys(v)) {
    const d=Object.getOwnPropertyDescriptor(v,k);assert.ok(Object.hasOwn(d,'value'),label+' no accessor');measurement(d.value,label+'.'+k,parents);
  }
  parents.delete(v);
}
function vector(a,n,max,label) {dense(a,n,label);for(let i=0;i<n;i++)integer(a[i],0,max,label+'['+i+']');}
function shape(w,label) {
  assert.ok(w&&typeof w==='object'&&!Array.isArray(w),label+' world object');measurement(w,label);
  integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
  dense(w.people,200,label+'.people');
  for(let i=0;i<200;i++)for(const k of PERSON)integer(w.people[i][k],0,PERSON16.has(k)?65535:255,label+'.people['+i+'].'+k);
  dense(w.cities,38,label+'.cities');vector(w.queue,2000,65535,label+'.queue');
  const slots=new Set(),residents=new Set();
  for(let i=0;i<38;i++) {
    const c=w.cities[i];for(const k of CITY)integer(c[k],0,CITY8.has(k)?255:65535,label+'.cities['+i+'].'+k);
    if(c.Persons)assert.ok(c.PersonQueue+c.Persons<=200,label+' live resident range within first200');
    for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++) {
      assert.ok(!slots.has(j),label+' overlapping resident ranges');slots.add(j);
      const id=integer(w.queue[j],0,199,label+' resident PID');assert.ok(!residents.has(id),label+' duplicate resident PID');residents.add(id);
    }
    for(const k of ['Tools','ToolQueue'])if(Object.hasOwn(c,k))integer(c[k],0,65535,label+'.cities['+i+'].'+k);
  }
  vector(w.fighters,600,255,label+'.fighters');vector(w.fighterIndex,30,1,label+'.fighterIndex');
  if(Object.hasOwn(w,'goodsQueue'))vector(w.goodsQueue,2000,65535,label+'.goodsQueue');
  if(Object.hasOwn(w,'tools')) {
    dense(w.tools,33,label+'.tools');for(let i=0;i<33;i++)for(const k of ['useflag','changeAttackRange','at','iq','move','arm'])integer(w.tools[i][k],0,255,label+'.tools['+i+'].'+k);
  }
  assert.ok(w.config&&typeof w.config==='object'&&!Array.isArray(w.config),label+'.config');
  for(const k of CONFIG)integer(w.config[k],0,0xffffffff,label+'.config.'+k);
  for(const k of FLAGS)integer(w.config[k],0,1,label+'.config.'+k);
  dense(w.orders,200,label+'.orders');
  for(let i=0;i<200;i++)for(const k of ORDER)integer(w.orders[i][k],0,ORDER8.has(k)?255:65535,label+'.orders['+i+'].'+k);
}
function exact(a,b,label,path='$') {
  if(Object.is(a,b))return;
  assert.ok(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object',label+' differs at '+path);
  assert.equal(Array.isArray(a),Array.isArray(b),label+' kind at '+path);
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label+' fields at '+path);
  for(const k of Object.keys(b))exact(a[k],b[k],label,path+'.'+k);
}
function library(input) {
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=mobileDiplomacyOracleContract.originalLib;
  assert.equal(b.length,ref.bytes,'Original LIB bytes');assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB SHA256');
  function item(id,index) {
    const base=b.readUInt32LE((id-1)*4);assert.ok(base+14<=b.length,'LIB resource header bounds');
    const length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);
    assert.equal(b.readUInt16LE(base+4),id,'Actual LIB resource identity');assert.ok(index<count&&base+length<=b.length,'LIB resource bounds');
    if(!fixed&&count!==1)assert.ok(14+count*8<=length,'LIB variable index bounds');
    const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(base+14+index*8);
    const size=fixed||(count===1?length-14:b.readUInt32LE(base+18+index*8));
    assert.ok(offset>=14&&offset+size<=length,'LIB payload bounds');return b.subarray(base+offset,base+offset+size);
  }
  const thew=item(2,9),money=item(2,10);
  assert.equal(thew.length,28,'Actual ConsumeThew28');assert.equal(money.length,28,'Actual ConsumeMoney28');
  for(const command of [15,16,17,19]){assert.equal(thew[command],command===19?10:20,'Original diplomacy Thew');assert.equal(money[command],50,'Original diplomacy Money50');}
  return {thew,money};
}
function commandValue(command){integer(command,0,255,'command');assert.ok([15,16,17,19].includes(command),'Only native diplomacy15/16/17/19');return command;}
function candidates(world,cityIndex,command){
 integer(cityIndex,0,37,'cityIndex');commandValue(command);const own=world.king+1,c=world.cities[cityIndex];assert.equal(c.Belong,own,'Player-owned origin');
 const actors=world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>world.people[id].Belong===c.Belong),targets=[];
 for(let i=0;i<38;i++){
  const city=world.cities[i],b=city.Belong;if(!b||b===own)continue;
  if(command===17){if(city.SatrapId&&city.SatrapId!==b)targets.push(integer(city.SatrapId-1,0,199,'Native enemy Satrap ID'));}
  else if(command===19){const id=integer(b-1,0,199,'Native enemy king');if(!targets.includes(id))targets.push(id);}
  else for(let j=city.PersonQueue;j<city.PersonQueue+city.Persons;j++){const id=world.queue[j];if(world.people[id].Belong===b&&id+1!==b)targets.push(id);}
 }
 return {actors,targets};
}
/** Native ordered lists, not guessed names or broad allegiance membership. No input acceptance. */
export function getMobileDiplomacyCandidates({world,cityIndex,command,libBytes}={}){
 shape(world,'world');library(libBytes);return {...candidates(world,cityIndex,command),command,cityIndex,publicInputAccepted:false};
}
function prepare({world,cityIndex,command,personId,targetId,libBytes}){
 shape(world,'before');const rom=library(libBytes),lists=candidates(world,cityIndex,command);
 assert.equal(world.config.enable16bitConsumeMoney,0,'Original28-byte money table only supports measured U8 consumption');
 integer(personId,0,199,'personId');assert.ok(lists.actors.includes(personId),'Actor in current native GetCityPersons');
 const actor=world.people[personId],city=world.cities[cityIndex],thewCost=rom.thew[command],moneyCost=rom.money[command];
 assert.ok(actor.Thew>=thewCost,'Actual actor IsManual guard');assert.ok(city.Money>=moneyCost,'Actual IsMoney guard');
 if(targetId!==undefined){integer(targetId,0,199,'targetId');assert.ok(lists.targets.includes(targetId),'Target in exact original command list');}
 const chargedId=command===15&&world.config.fixAlienateComsumeThew===0?targetId:personId;
 const chargedBefore=chargedId===undefined?null:world.people[chargedId].Thew;
 const chargedAfter=chargedBefore===null?null:world.config.fixOverFlow16?Math.max(0,chargedBefore-thewCost):(chargedBefore-thewCost)&255;
 const queueIndex=world.queue.indexOf(personId,city.PersonQueue);assert.ok(queueIndex>=city.PersonQueue&&queueIndex<city.PersonQueue+city.Persons,'Exact resident queue slot');
 return {...lists,actor,city,thewCost,moneyCost,chargedId,chargedBefore,chargedAfter,queueIndex,orderIndex:world.orders.findIndex(o=>o.OrderId===255)};
}
export function calculateMobileDiplomacyLimit(args={}){
 const p=prepare(args);return {command:args.command,cityIndex:args.cityIndex,personId:args.personId,targetId:args.targetId??null,
 actors:p.actors,targets:p.targets,moneyCost:p.moneyCost,guardThew:p.thewCost,thewCost:p.thewCost,chargedPersonId:p.chargedId??null,thewBefore:p.chargedBefore,thewAfter:p.chargedAfter,
 orderIndex:p.orderIndex,fullOrders:p.orderIndex<0,timeCount:10,timeCountIsMonthAcceptance:false,publicInputAccepted:false};
}
function charged(before,p){const expected=structuredClone(before);expected.cities[p.cityIndex].Money-=p.moneyCost;expected.people[p.chargedId].Thew=p.chargedAfter;return expected;}
function verdict(args,p,phase){return {ok:true,accepted:true,phase,command:args.command,cityIndex:args.cityIndex,personId:args.personId,targetId:args.targetId,
 money:{before:p.city.Money,after:p.city.Money-p.moneyCost,cost:p.moneyCost},thew:{chargedPersonId:p.chargedId,before:p.chargedBefore,after:p.chargedAfter,cost:p.thewCost,actorGuard:p.thewCost},
 fixAlienateComsumeThew:args.before.config.fixAlienateComsumeThew,fixOverFlow16:args.before.config.fixOverFlow16,checked:{...mobileDiplomacyOracleContract.counts},
 publicInputAccepted:false,monthEffectsAccepted:false,wholeNativeAbiAccepted:false,fullHdAccepted:false,successReportExpected:false,
 limits:['Measured world fields only; caller proves native original identity/no hooks/current menu and trusted inputs','No successful GReport in these four Make functions','TimeCount10 is recorded order metadata, not proof of ten months or a random outcome','New stack order cargo/Consume are nonsemantic only in the explicit new-slot mask']};}
/** Optional COMMIT-phase sample: costs charged, AddOrderHead and DelPerson have not run yet. */
export function verifyMobileDiplomacyCommit({before,during,...rest}={}){
 assert.notEqual(rest.targetId,undefined,'Measured target required');const p={...prepare({...rest,world:before}),cityIndex:rest.cityIndex};shape(during,'during');exact(during,charged(before,p),'COMMIT sample: only native costs');
 return {...verdict({before,...rest},p,'commit-before-order'),dispatchAccepted:false,commitWorldAccepted:true};
}
/** Sample after command completion, not at TARGET or an intermediate full-order report. */
export function verifyMobileDiplomacy({before,after,during,outcome='queued',...rest}={}){
 assert.notEqual(rest.targetId,undefined,'Measured target required');const p={...prepare({...rest,world:before}),cityIndex:rest.cityIndex},expected=charged(before,p);shape(after,'after');
 assert.ok(outcome==='queued'||outcome==='full-order','Explicit queued or full-order outcome');if(during!==undefined)verifyMobileDiplomacyCommit({before,during,...rest});
 if(outcome==='full-order'){assert.equal(p.orderIndex,-1,'All200 actual orders occupied');exact(after,expected,'Full AddOrderHead preserves charged costs, actor and queue');return {...verdict({before,...rest},p,'full-order'),dispatchAccepted:false,partialMutationAccepted:true,orderIndex:null};}
 assert.ok(p.orderIndex>=0,'Native first free255 slot');const order=after.orders[p.orderIndex];assert.deepEqual(Object.keys(order).sort(),Object.keys(before.orders[p.orderIndex]).sort(),'Only same measured new-order fields');
 Object.assign(expected.orders[p.orderIndex],{OrderId:rest.command,Person:rest.personId,City:rest.cityIndex,Object:rest.targetId,TimeCount:10});
 for(const k of mobileDiplomacyOracleContract.uninitializedOrder)expected.orders[p.orderIndex][k]=order[k];
 for(let i=p.queueIndex;i<199;i++)expected.queue[i]=expected.queue[i+1];expected.cities[rest.cityIndex].Persons--;
 for(let i=rest.cityIndex+1;i<38;i++)expected.cities[i].PersonQueue=(expected.cities[i].PersonQueue-1)&65535;
 exact(after,expected,'Completed diplomacy: native costs, first free order and exact DelPerson only');
 return {...verdict({before,...rest},p,'queued'),dispatchAccepted:true,partialMutationAccepted:false,orderIndex:p.orderIndex,queueIndex:p.queueIndex,
 order:Object.fromEntries(mobileDiplomacyOracleContract.initializedOrder.map(k=>[k,order[k]])),uninitializedOrderMask:{orderIndex:p.orderIndex,fields:[...mobileDiplomacyOracleContract.uninitializedOrder],actual:Object.fromEntries(mobileDiplomacyOracleContract.uninitializedOrder.map(k=>[k,order[k]])),semanticAcceptance:false}};
}
export function verifyMobileDiplomacyCancellation({before,after,libBytes}={}){
 shape(before,'before');shape(after,'after');library(libBytes);exact(after,before,'Actor/target cancellation changes no measured world field');
 return {ok:true,accepted:true,cancellationWorldUnchanged:true,dispatchAccepted:false,checked:{...mobileDiplomacyOracleContract.counts},publicInputAccepted:false,monthEffectsAccepted:false,wholeNativeAbiAccepted:false,fullHdAccepted:false};
}
