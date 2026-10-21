// Pure V27 bounded May acquisition planning. No I/O, native calls, RNG reads, writes or actual credit.
// CanvassMake: citycmdc.c666-741; CanvassDrv: citycmd.c673-753;
// GetEnemyPersons/GetPersonCity: cityedit.c665-680/790-812. Source scores are uniform residue counts only.
import assert from 'node:assert/strict';
export const V27_ENVOYS=Object.freeze([[13,37],[13,43],[13,60],[6,5],[6,36],[6,51],[7,28],[7,6],[7,48],[7,68],[4,33],[5,59],[5,7],[7,25],[7,27],[13,39],[16,40]].map(Object.freeze));
export const V27_ACTORS_BY_CITY=Object.freeze({4:Object.freeze([33]),5:Object.freeze([59,7]),6:Object.freeze([5,36,51]),7:Object.freeze([28,6,48,68,25,27]),13:Object.freeze([37,43,60,39]),16:Object.freeze([40])});
export const V27_TARGETS=Object.freeze([77,86,95,104,106,107,109,113,117,119,121,128,129,132,133,135]);
export const V27_OWNED=Object.freeze([4,5,6,7,13,16,20]);
export const V27_COMBAT_GUARDS=Object.freeze([30,45,8,17,69,70,11,10,38]);
export const V27_PLANNING_LIMITS=Object.freeze({maximumCanvassesPerMonth:10,maximumPerTargetPerMonth:2,minimumCashAfterAllPlannedPayments:500,moneyPerCanvass:50,thewPerCanvass:20,maximumMonths:3,maximumCanvassesInRun:30,maximumInitialBuys:2,maximumPlunders:1,lowerIqPlanningSubset:true});
const eq=(a,b,m)=>assert.deepEqual(a,b,m);
function integer(x,a,b,m){assert.ok(Number.isInteger(x)&&x>=a&&x<=b,m);}
function dense(a,n,m){assert.ok(Array.isArray(a));assert.equal(a.length,n,m);assert.equal(Object.keys(a).length,n,m+' dense');for(let i=0;i<n;i++)assert.ok(Object.hasOwn(a,i));}
function shape(w){eq([w.period,w.king],[4,0]);integer(w.year,0,65535,'year');integer(w.month,1,12,'month');for(const[k,n]of Object.entries({cities:38,people:200,orders:200,queue:2000,goodsQueue:2000,fighters:600,fighterIndex:30}))dense(w[k],n,k);eq(w.cities.flatMap((c,i)=>c.Belong===1?[i]:[]),V27_OWNED);assert.equal(w.config.enableCustomRatio,0);assert.equal(w.config.maxLevel,20);assert.equal(w.config.checkRedundantOnAddPerson,0);const used=new Set();for(const[cid,c]of w.cities.entries()){for(const k of ['PersonQueue','Persons','MothballArms','Money','Food','SatrapId','Belong'])integer(c[k],0,65535,'city '+cid+' '+k);integer(c.State,0,4,'native State0..4');assert.ok(c.PersonQueue+c.Persons<=200);for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++){assert.ok(!used.has(j),'Physical resident slices may not overlap');used.add(j);integer(w.queue[j],0,199,'raw PID');}}for(const p of w.people){for(const k of ['IQ','Devotion','Thew'])integer(p[k],0,255,k);integer(p.Character,0,255,'Character');integer(p.Level,0,255,'Level');integer(p.Arms,0,65535,'Arms');integer(p.ArmsType,0,255,'ArmsType');integer(p.Belong,0,65535,'Belong');}for(const o of w.orders){integer(o.OrderId,0,255,'OrderId');integer(o.Person,0,65535,'Person');integer(o.City,0,255,'City');integer(o.Object,0,65535,'Object');}}
export function v27Residents(w,c){const x=w.cities[c];return w.queue.slice(x.PersonQueue,x.PersonQueue+x.Persons).filter(id=>w.people[id].Belong===x.Belong);}
function rawPlaces(w,id){return w.cities.flatMap((c,cityIndex)=>w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).flatMap((p,localIndex)=>p===id?[{cityIndex,queueIndex:c.PersonQueue+localIndex}]:[]));}
export function v27BaseCasters(w){shape(w);return w.people.flatMap((p,id)=>{if(p.Belong!==1||p.ArmsType!==3||p.Level<7||p.Level>20)return[];const locations=V27_OWNED.flatMap(c=>v27Residents(w,c).filter(x=>x===id).map(()=>c));return locations.length===1?[{personId:id,cityIndex:locations[0],arms:p.Arms,battleReady:p.Arms>0}]:[];});}
export function v27PlanCanvasses(w){
 shape(w);if(v27BaseCasters(w).length)return[];
 const edges=[],cash=new Map(V27_OWNED.map(c=>[c,w.cities[c].Money])),targetCounts=new Map();
 // Already charged, still-pending original orders belong to the same current monthly target cap.
 for(const o of w.orders)if(o.OrderId===16&&o.Person<200&&o.City<38&&w.people[o.Person].Belong===1&&w.cities[o.City].Belong===1)targetCounts.set(o.Object,(targetCounts.get(o.Object)||0)+1);
 const slots=w.orders.slice(0,170).filter(o=>o.OrderId===255).length;
 for(const[actorRank,[cityIndex,personId]]of V27_ENVOYS.entries()){
  const p=w.people[personId],c=w.cities[cityIndex],places=rawPlaces(w,personId);
  if(p.IQ>100||p.Belong!==1||places.length!==1||places[0].cityIndex!==cityIndex||v27Residents(w,cityIndex).filter(id=>id===personId).length!==1||p.Thew<20||c.SatrapId===personId+1||!v27Residents(w,cityIndex).includes(c.SatrapId-1)||c.Money<550||w.orders.some(o=>o.OrderId!==255&&o.Person===personId))continue;
  for(const[targetRank,targetId]of V27_TARGETS.entries()){
   const t=w.people[targetId],places=rawPlaces(w,targetId),first=places[0];
   if(t.IQ>100||t.Devotion>100||t.Character>4||[0,1,65535].includes(t.Belong)||targetId+1===t.Belong||t.ArmsType!==3||t.Level<7||t.Level>20||p.IQ>=t.IQ||!first||w.cities[first.cityIndex].Belong!==t.Belong)continue;
   const targetCity=first.cityIndex,difference=(p.IQ-t.IQ)&255,counts=[Math.min(100,difference+1),Math.max(0,100-t.Devotion),[15,40,30,20,5][t.Character]+1],sourceScore=counts.reduce((a,b)=>a*b,1);
   if(sourceScore>0)edges.push({cityIndex,personId,targetId,targetCity,sourceAllowedValueCounts:counts,sourceScore,actorRank,targetRank});
  }
 }
 edges.sort((a,b)=>b.sourceScore-a.sourceScore||a.actorRank-b.actorRank||a.targetRank-b.targetRank);
 const plans=[],chosen=new Set();
 for(const e of edges){if(plans.length>=Math.min(10,slots))break;if(chosen.has(e.personId)||(targetCounts.get(e.targetId)||0)>=2||cash.get(e.cityIndex)-50<500)continue;chosen.add(e.personId);targetCounts.set(e.targetId,(targetCounts.get(e.targetId)||0)+1);cash.set(e.cityIndex,cash.get(e.cityIndex)-50);const{actorRank,targetRank,...plan}=e;plans.push({...plan,plannedCashAfter:cash.get(e.cityIndex),targetMonthlyOrderCountAfterPlan:targetCounts.get(e.targetId),targetAvailableAtPlanning:true,randomValuesObserved:false,successForecastAccepted:false});}
 return plans;
}

// Conservative food/guard/Plunder models are byte-preserving V23 bodies except names.
export function v27FoodBudget(w,{plans=[],allowConditionalPlunder=false}={}){
 shape(w);const rows=V27_OWNED.map(city=>{const c=w.cities[city],residentIds=v27Residents(w,city),pending=w.orders.filter(o=>o.OrderId!==255&&o.City===city&&o.OrderId!==14&&o.OrderId!==27&&o.Person<200&&w.people[o.Person].Belong===1&&!residentIds.includes(o.Person));const pendingIds=[...new Set(pending.map(o=>o.Person))];const targets=[...new Set([...plans.filter(p=>p.cityIndex===city).map(p=>p.targetId),...pending.filter(o=>o.OrderId===16).map(o=>o.Object)])].filter(id=>!residentIds.includes(id));const residentArms=residentIds.reduce((a,id)=>a+w.people[id].Arms,0),pendingArms=pendingIds.reduce((a,id)=>a+w.people[id].Arms,0),potentialTargetArms=targets.length*7100,total=c.MothballArms+residentArms+pendingArms+potentialTargetArms;assert.ok(total<=65535,'No U16 army overflow');const monthlyFloor=Math.floor(total/50),conditionalFood=allowConditionalPlunder&&city===20?(w.people[44].IQ+w.people[44].Force)*5:0;assert.ok(c.Food+conditionalFood<=65535,'No conditional food overflow');return{city,food:c.Food,money:c.Money,minimumCash:500,residentArms,pendingArms,potentialTargetArms,monthlyFloor,requiredFood:monthlyFloor+1,conditionalFood,actualSafe:c.Money>=500&&c.Food>monthlyFloor,conditionalSafe:c.Money>=500&&c.Food+conditionalFood>monthlyFloor};});return{accepted:rows.every(r=>r.actualSafe),conditionalAccepted:rows.every(r=>r.conditionalSafe),rows,futureIncomeCredited:false,futureHarvestCredited:false,actualMonthAccepted:false};
}
export function v27GuardsBeforeBattle({world,referenceWorld,envoys=V27_ENVOYS}){
 shape(world);for(const city of V27_OWNED)for(const id of v27Residents(referenceWorld,city)){assert.ok(v27Residents(world,city).includes(id),'Every original resident returned before AI battle '+id);assert.equal(world.people[id].Arms,referenceWorld.people[id].Arms,'Resident arms preserved before AI battle '+id);assert.equal(world.people[id].Belong,1);}for(const[,id]of envoys)assert.ok(!world.orders.some(o=>o.OrderId!==255&&o.OrderId!==27&&o.Person===id),'No envoy pending before battle '+id);for(const id of V27_COMBAT_GUARDS)assert.ok(v27Residents(world,20).includes(id));return{accepted:true,scope:'Measured original monthly residents and arms immediately before this native AI battle only',wholeMonthPreservationAccepted:false};
}
export function v27VerifyPlunderReturn({before,after,orderIndex}){
 const e=structuredClone(before),o=e.orders[orderIndex];eq([o.OrderId,o.City,o.Person,o.TimeCount],[26,20,44,0]);const p=e.people[44],c=e.cities[20],n=p.IQ+p.Force;assert.ok(c.Food+n*5<=65535&&c.Money+n*2<=65535);Object.assign(c,{PeopleDevotion:Math.floor(c.PeopleDevotion/2),Farming:Math.floor(c.Farming/2),Commerce:Math.floor(c.Commerce/2),Food:c.Food+n*5,Money:c.Money+n*2});for(let j=199;j>c.PersonQueue;j--)e.queue[j]=e.queue[j-1];e.queue[c.PersonQueue]=44;c.Persons++;for(let i=21;i<38;i++)e.cities[i].PersonQueue++;o.OrderId=255;eq(after,e,'Complete original Plunder/AddPerson/DelOrder adjacent transition');return{accepted:true,foodGain:n*5,moneyGain:n*2,sourceIntermediateOnly:true,actualIntermediateObserved:false,actualCastAccepted:false};
}

// Stable legacy names are API aliases, not historical-run acceptance flags.
export const V23_ENVOYS=V27_ENVOYS,V23_TARGETS=V27_TARGETS,V23_OWNED=V27_OWNED,V23_COMBAT_GUARDS=V27_COMBAT_GUARDS;
export const v23Residents=v27Residents,v23BaseCasters=v27BaseCasters,v23PlanCanvasses=v27PlanCanvasses,v23FoodBudget=v27FoodBudget,v23GuardsBeforeBattle=v27GuardsBeforeBattle,v23VerifyPlunderReturn=v27VerifyPlunderReturn;
