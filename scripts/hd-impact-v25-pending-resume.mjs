// Pure pending-only qualification. Models already-paid history; never sends or authorizes MAKE.
import assert from 'node:assert/strict';
import {getRawCanvassCandidates} from './hd-impact-v23-canvass16-make-oracle.mjs';
import {V23_OWNED,V23_ENVOYS,V23_COMBAT_GUARDS,v23Residents,v23FoodBudget,v23GuardsBeforeBattle,v23BaseCasters} from './hd-impact-v23-acquisition-plan.mjs';
export const V25_PENDING_SCOPE=Object.freeze({period:4,king:0,year:238,month:1,orderId:16,targetId:129,count:10,originalMonthThenEndCount:1,ownCities:V23_OWNED,actors:V23_ENVOYS});
const eq=(a,b,m)=>assert.deepEqual(a,b,m);
function measured(v,name,parents=new Set()){
 if(v===null||['string','boolean'].includes(typeof v))return;
 if(typeof v==='number'){assert.ok(Number.isFinite(v),name+' finite');return;}
 assert.ok(v&&typeof v==='object',name+' JSON only');assert.ok(!parents.has(v),name+' no cycle');assert.equal(Object.getOwnPropertySymbols(v).length,0,name+' no symbols');eq(Object.getPrototypeOf(v),Array.isArray(v)?Array.prototype:Object.prototype,name+' plain JSON');parents.add(v);
 if(Array.isArray(v)){assert.equal(Object.keys(v).length,v.length,name+' dense array');for(let i=0;i<v.length;i++)assert.ok(Object.hasOwn(v,i),name+' dense slot');}
 for(const k of Object.keys(v)){const d=Object.getOwnPropertyDescriptor(v,k);assert.ok(Object.hasOwn(d,'value'),name+' no accessor');measured(d.value,name+'.'+k,parents);}parents.delete(v);
}
function worldShape(w,name){measured(w,name);eq([w.period,w.king],[4,0],name+' original campaign');for(const[k,n]of Object.entries({people:200,cities:38,orders:200,queue:2000,goodsQueue:2000,fighters:600,fighterIndex:30}))assert.equal(w[k]?.length,n,name+'.'+k);eq(w.cities.flatMap((c,i)=>c.Belong===1?[i]:[]),V23_OWNED,name+' all seven owned cities');}
function originalReference(w){worldShape(w,'originalMonthWorld');eq([w.year,w.month],[238,1],'Exact genuine January resident reference');assert.ok(w.orders.every(o=>o.OrderId===255),'Original reference is before all ten paid orders');for(const[city,id]of V23_ENVOYS)assert.equal(v23Residents(w,city).filter(p=>p===id).length,1,'Reference retains original envoy '+id);for(const id of V23_COMBAT_GUARDS)assert.equal(v23Residents(w,20).filter(p=>p===id).length,1,'Reference retains exact original combat guard '+id);}
function frozen(v){if(v&&typeof v==='object'){for(const x of Object.values(v))frozen(x);Object.freeze(v);}return v;}
const noCredit=()=>({newPaymentsAuthorized:false,newMAKEAuthorized:false,priorPaymentsProvenByThisFunction:false,nativeEndStrategyExecuted:false,actualContinuationAccepted:false,actualAcquisitionAccepted:false,actualPreparationAccepted:false,actualCastAccepted:false,hdAccepted:false});
export function verifyV25PendingResumeInput({world,originalMonthWorld,expectedPendingOrders,libBytes}={}){
 originalReference(originalMonthWorld);worldShape(world,'world');eq([originalMonthWorld.year,originalMonthWorld.month],[238,1],'Exact genuine January resident reference');eq([world.year,world.month],[238,1],'Exact latest paid January world');assert.ok(originalMonthWorld.orders.every(o=>o.OrderId===255),'Resident reference precedes the new ten paid orders');
 eq([world.people[129].OldBelong,world.people[129].Belong,world.people[129].Level,world.people[129].ArmsType,world.people[129].Arms,world.people[129].Experience],[1,2,7,3,0,6],'Only latest enemy-owned base navy129');eq(v23BaseCasters(world),[],'No current controllable base caster before pending-only resume');
 measured(expectedPendingOrders,'expectedPendingOrders');assert.ok(Array.isArray(expectedPendingOrders));assert.equal(expectedPendingOrders.length,10);const active=world.orders.flatMap((order,orderIndex)=>order.OrderId===255?[]:[{orderIndex,order}]);eq(active,expectedPendingOrders,'Every active full order including opaque and unknown fields must match the bound paid prefix');
 const modeled=structuredClone(originalMonthWorld),history=[];
 for(let i=0;i<10;i++){
  const [cityIndex,personId]=V23_ENVOYS[i],expected=expectedPendingOrders[i];eq(Object.keys(expected).sort(),['order','orderIndex']);assert.equal(expected.orderIndex,i,'Original paid slots zero through nine');const o=expected.order;eq([o.OrderId,o.City,o.Person,o.Object,o.TimeCount],[16,cityIndex,personId,129,10],'Exact paid Canvass route/order');for(const [k,max]of Object.entries({Arms:65535,Food:65535,Money:65535,Consume:255}))assert.ok(Number.isInteger(o[k])&&o[k]>=0&&o[k]<=max,'Native opaque order bounds '+k);
  const candidates=getRawCanvassCandidates({world:modeled,cityIndex,personId,targetId:129,libBytes});assert.equal(modeled.orders.findIndex(row=>row.OrderId===255),i,'First-free historical order slot');
  const before=modeled.queue.slice(),queueIndex=candidates.actorQueueIndex;modeled.cities[cityIndex].Money-=50;modeled.people[personId].Thew-=20;modeled.orders[i]={...modeled.orders[i],OrderId:16,City:cityIndex,Person:personId,Object:129,TimeCount:10};for(const k of ['Arms','Food','Money','Consume'])modeled.orders[i][k]=o[k];
  for(let j=queueIndex;j<199;j++)modeled.queue[j]=before[j+1];modeled.cities[cityIndex].Persons--;for(let c=cityIndex+1;c<38;c++)modeled.cities[c].PersonQueue=(modeled.cities[c].PersonQueue-1)&65535;
  history.push({orderIndex:i,cityIndex,personId,targetId:129,queueIndex,alreadyPaidMoney:50,alreadyPaidThew:20});
 }
 eq(world,modeled,'Full current paid world must equal only the original ten historical costs, opaque order copies and exact native DelPerson; no new payment, tail repair or unknown-field drift');
 const food=v23FoodBudget(world);assert.equal(food.accepted,true,'Current pending workers and conservative target-return reserve must fit strict food/cash500 without future income');
 return frozen({accepted:true,pendingResumeInputQualified:true,alreadyQueuedCount:10,pendingOrders:structuredClone(expectedPendingOrders),historicalPrefixModel:history,originalResidentCities:V23_OWNED.map(city=>({city,personIds:v23Residents(originalMonthWorld,city),arms:v23Residents(originalMonthWorld,city).map(id=>({personId:id,arms:originalMonthWorld.people[id].Arms}))})),food,maximumNewStrategyEnds:1,scope:'Qualification of bound January already-paid ten-order input only. Full root receipt/SAVE/source provenance and fresh native owner are independent requirements.',...noCredit()});
}
export function verifyV25PendingDefenseGuards({world,originalMonthWorld}={}){
 originalReference(originalMonthWorld);worldShape(world,'world');eq([originalMonthWorld.year,originalMonthWorld.month],[238,1]);assert.ok(originalMonthWorld.orders.every(o=>o.OrderId===255),'Never use paid world with absent envoys as guard reference');const guards=v23GuardsBeforeBattle({world,referenceWorld:originalMonthWorld}),food=v23FoodBudget(world);assert.equal(food.accepted,true,'All seven cities strict current food/cash500 before any defense input');
 return frozen({accepted:true,guards,food,wholeMonthPreservationAccepted:false,scope:'Original January residents all returned, same Arms and owner, all seven food/cash gates immediately before this actual defense input only.',...noCredit()});
}
