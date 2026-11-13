// Pure V32 February bounded convertible-person policy; original conditional Plunder admission is a separate module. No I/O, RNG or actual credit.
// CanvassMake: citycmdc.c666-741; CanvassDrv: citycmd.c673-753;
// GetEnemyPersons/GetPersonCity: cityedit.c665-680/790-812. Source scores are uniform residue counts only.
import assert from 'node:assert/strict';
export const V28_ENVOYS=Object.freeze([[13,37],[13,43],[13,60],[6,5],[6,36],[6,51],[7,28],[7,6],[7,48],[7,68],[4,33],[5,59],[5,7],[7,25],[7,27],[13,39],[16,40]].map(Object.freeze));
export const V28_ACTORS_BY_CITY=Object.freeze({4:Object.freeze([33]),5:Object.freeze([59,7]),6:Object.freeze([5,36,51]),7:Object.freeze([28,6,48,68,25,27]),13:Object.freeze([37,43,60,39]),16:Object.freeze([40])});
export const V28_TARGETS=Object.freeze([4,26,64,77,86,91,104,105,106,107,109,110,112,113,114,115,116,117,118,119,120,121,123,124,125,126,127,128,129,130,131,132,133,135,136,137,138,148,149,162,168]);
export const V28_OWNED=Object.freeze([4,5,6,7,13,16,20]);
export const V28_COMBAT_GUARDS=Object.freeze([30,45,8,17,69,70,11,10,38]);
export const V28_PLANNING_LIMITS=Object.freeze({maximumCanvassesPerMonth:10,maximumPerTargetPerMonth:2,primaryTarget:null,maximumPrimaryTargetPerMonth:2,minimumCashAfterAllPlannedPayments:500,moneyPerCanvass:50,thewPerCanvass:20,maximumMonths:1,maximumCanvassesInRun:10,maximumInitialBuys:0,maximumPlunders:1,lowerIqPlanningSubset:true});
const eq=(a,b,m)=>assert.deepEqual(a,b,m);
function integer(x,a,b,m){assert.ok(Number.isInteger(x)&&x>=a&&x<=b,m);}
function dense(a,n,m){assert.ok(Array.isArray(a));assert.equal(a.length,n,m);assert.equal(Object.keys(a).length,n,m+' dense');for(let i=0;i<n;i++)assert.ok(Object.hasOwn(a,i));}
function shape(w){eq([w.period,w.king],[4,0]);integer(w.year,0,65535,'year');integer(w.month,1,12,'month');for(const[k,n]of Object.entries({cities:38,people:200,orders:200,queue:2000,goodsQueue:2000,fighters:600,fighterIndex:30}))dense(w[k],n,k);eq(w.cities.flatMap((c,i)=>c.Belong===1?[i]:[]),V28_OWNED);assert.equal(w.config.enableCustomRatio,0);assert.equal(w.config.maxLevel,20);assert.equal(w.config.checkRedundantOnAddPerson,0);const used=new Set();for(const[cid,c]of w.cities.entries()){for(const k of ['PersonQueue','Persons','MothballArms','Money','Food','SatrapId','Belong'])integer(c[k],0,65535,'city '+cid+' '+k);integer(c.State,0,4,'native State0..4');assert.ok(c.PersonQueue+c.Persons<=200);for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++){assert.ok(!used.has(j),'Physical resident slices may not overlap');used.add(j);integer(w.queue[j],0,199,'raw PID');}}for(const p of w.people){for(const k of ['IQ','Devotion','Thew'])integer(p[k],0,255,k);integer(p.Character,0,255,'Character');integer(p.Level,0,255,'Level');integer(p.Arms,0,65535,'Arms');integer(p.ArmsType,0,255,'ArmsType');integer(p.Belong,0,65535,'Belong');}for(const o of w.orders){integer(o.OrderId,0,255,'OrderId');integer(o.Person,0,65535,'Person');integer(o.City,0,255,'City');integer(o.Object,0,65535,'Object');}}
export function v28Residents(w,c){const x=w.cities[c];return w.queue.slice(x.PersonQueue,x.PersonQueue+x.Persons).filter(id=>w.people[id].Belong===x.Belong);}
function rawPlaces(w,id){return w.cities.flatMap((c,cityIndex)=>w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).flatMap((p,localIndex)=>p===id?[{cityIndex,queueIndex:c.PersonQueue+localIndex}]:[]));}
export function v28BaseCasters(w){shape(w);return w.people.flatMap((p,id)=>{if(p.Belong!==1||v32EffectiveArmType(w,p)!==3||p.Level<7||p.Level>20)return[];const locations=V28_OWNED.flatMap(c=>v28Residents(w,c).filter(x=>x===id).map(()=>c));return locations.length===1?[{personId:id,cityIndex:locations[0],arms:p.Arms,battleReady:p.Arms>0}]:[];});}

// Character tokens 0..4 map to TEMERITY,DREAD,AVARICE,IDEAL,LOYALISM.
// Counts enumerate accepted rand()%100 residues in three original source gates.
// They are not an observed RNG distribution or an actual success prediction.
export function v28SourceResidueCounts({actorIQ,targetIQ,devotion,character}){
 integer(actorIQ,0,100,'actor IQ');integer(targetIQ,0,100,'target IQ');integer(devotion,0,100,'target devotion');integer(character,0,4,'target Character');
 const difference=(actorIQ-targetIQ)&255;
 return [Math.min(100,difference+1),100-devotion,[15,40,30,20,5][character]+1];
}
export function v28TargetMonthlyCap(targetId){return 2;}
function maximumWeightAssignment(edges,cityCaps,targetCaps,maximum){
 // This small residual network permits reassignment. A one-pass greedy choice
 // can consume the only lower-IQ actor able to reach a secondary target.
 const cities=[...cityCaps.keys()],actors=[...new Set(edges.map(e=>e.personId))],targets=[...targetCaps.keys()];
 const S=0,cityNode=new Map(cities.map((id,i)=>[id,1+i])),actorStart=1+cities.length,actorNode=new Map(actors.map((id,i)=>[id,actorStart+i])),targetStart=actorStart+actors.length,targetNode=new Map(targets.map((id,i)=>[id,targetStart+i])),T=targetStart+targets.length,n=T+1,g=Array.from({length:n},()=>[]),pick=[];
 function add(a,b,cap,cost,edge){const f={to:b,rev:g[b].length,cap,cost,edge},r={to:a,rev:g[a].length,cap:0,cost:-cost};g[a].push(f);g[b].push(r);return f;}
 for(const id of cities)add(S,cityNode.get(id),cityCaps.get(id),0);
 for(const id of actors){const e=edges.find(x=>x.personId===id);add(cityNode.get(e.cityIndex),actorNode.get(id),1,0);}
 for(const e of edges){const f=add(actorNode.get(e.personId),targetNode.get(e.targetId),1,-e.sourceScore*262144+(e.cityIndex===6?0:16384)+e.actorRank*64+e.targetRank,e);pick.push(f);}
 for(const id of targets)add(targetNode.get(id),T,targetCaps.get(id),0);
 let flow=0;
 while(flow<maximum){
  const dist=Array(n).fill(Infinity),prevNode=Array(n).fill(-1),prevEdge=Array(n).fill(-1);dist[S]=0;
  for(let k=0;k<n-1;k++){let changed=false;for(let u=0;u<n;u++){if(!Number.isFinite(dist[u]))continue;for(let j=0;j<g[u].length;j++){const e=g[u][j];if(e.cap>0&&dist[u]+e.cost<dist[e.to]){dist[e.to]=dist[u]+e.cost;prevNode[e.to]=u;prevEdge[e.to]=j;changed=true;}}}if(!changed)break;}
  if(!Number.isFinite(dist[T])||dist[T]>=0)break;
  for(let v=T;v!==S;v=prevNode[v]){assert.ok(prevNode[v]>=0,'Residual path');const e=g[prevNode[v]][prevEdge[v]];e.cap--;g[v][e.rev].cap++;}flow++;
 }
 // 262144 dominates at most10 geographic/rank penalties (<176000).
 // 16384 dominates at most10 actor/target tie ranks (<12000).
 // Source-residue total is primary, number of city6 envoys secondary, stable ranks third.
 // Allocation tie preference remains unchanged; dispatch within equal sourceScore places city6 last below. No success is predicted.
 return pick.filter(e=>e.cap===0).map(e=>e.edge);
}
export function v28PlanCanvasses(w){
 shape(w);if(v32AdvancedOwned(w).length)return[];
 const pending=w.orders.filter(o=>o.OrderId===16&&o.Person<200&&o.City<38&&w.people[o.Person].Belong===1&&w.cities[o.City].Belong===1),targetCounts=new Map();
 for(const o of pending)targetCounts.set(o.Object,(targetCounts.get(o.Object)||0)+1);
 const slots=w.orders.slice(0,170).filter(o=>o.OrderId===255).length,maximum=Math.min(10-pending.length,slots);
 if(maximum<=0)return[];
 const cash=new Map(V28_OWNED.map(c=>[c,w.cities[c].Money])),cityCaps=new Map(V28_OWNED.map(c=>[c,Math.max(0,Math.floor((cash.get(c)-500)/50))])),targetCaps=new Map(V28_TARGETS.map(id=>[id,Math.max(0,v28TargetMonthlyCap(id)-(targetCounts.get(id)||0))])),edges=[];
 for(const[actorRank,[cityIndex,personId]]of V28_ENVOYS.entries()){
  const p=w.people[personId],c=w.cities[cityIndex],places=rawPlaces(w,personId);
  if(p.IQ>100||p.Belong!==1||places.length!==1||places[0].cityIndex!==cityIndex||v28Residents(w,cityIndex).filter(id=>id===personId).length!==1||p.Thew<20||c.SatrapId===personId+1||!v28Residents(w,cityIndex).includes(c.SatrapId-1)||c.Money<550||w.orders.some(o=>o.OrderId!==255&&o.Person===personId))continue;
  for(const[targetRank,targetId]of V28_TARGETS.entries()){
   const t=w.people[targetId],places=rawPlaces(w,targetId),first=places[0];
   // Retain the already independently checked MAKE lower-IQ planning subset.
   if(t.IQ>100||t.Devotion>100||t.Character>4||[0,1,65535].includes(t.Belong)||targetId+1===t.Belong||!v32TargetConversionInfo(w,targetId).approvedGoalCandidate||t.Level<7||t.Level>20||p.IQ>=t.IQ||!first||w.cities[first.cityIndex].Belong!==t.Belong)continue;
   const counts=v28SourceResidueCounts({actorIQ:p.IQ,targetIQ:t.IQ,devotion:t.Devotion,character:t.Character}),sourceScore=counts.reduce((a,b)=>a*b,1);
   if(sourceScore>0&&targetCaps.get(targetId)>0&&cityCaps.get(cityIndex)>0)edges.push({cityIndex,personId,targetId,targetCity:first.cityIndex,sourceAllowedValueCounts:counts,sourceScore,actorRank,targetRank});
  }
 }
 const selected=maximumWeightAssignment(edges,cityCaps,targetCaps,maximum).sort((a,b)=>b.sourceScore-a.sourceScore||(a.cityIndex===6?1:0)-(b.cityIndex===6?1:0)||a.actorRank-b.actorRank||a.targetRank-b.targetRank),plans=[];
 for(const e of selected){cash.set(e.cityIndex,cash.get(e.cityIndex)-50);targetCounts.set(e.targetId,(targetCounts.get(e.targetId)||0)+1);const{actorRank,targetRank,...plan}=e;plans.push({...plan,plannedCashAfter:cash.get(e.cityIndex),targetMonthlyOrderCountAfterPlan:targetCounts.get(e.targetId),targetAvailableAtPlanning:true,randomValuesObserved:false,successForecastAccepted:false});}
 return plans;
}

// Conservative food/guard/Plunder models are byte-preserving V23 bodies except names.
export function v28FoodBudget(w,{plans=[],allowConditionalPlunder=false}={}){
 shape(w);const rows=V28_OWNED.map(city=>{const c=w.cities[city],residentIds=v28Residents(w,city),pending=w.orders.filter(o=>o.OrderId!==255&&o.City===city&&o.OrderId!==14&&o.OrderId!==27&&o.Person<200&&w.people[o.Person].Belong===1&&!residentIds.includes(o.Person));const pendingIds=[...new Set(pending.map(o=>o.Person))];const targets=[...new Set([...plans.filter(p=>p.cityIndex===city).map(p=>p.targetId),...pending.filter(o=>o.OrderId===16).map(o=>o.Object)])].filter(id=>!residentIds.includes(id));const residentArms=residentIds.reduce((a,id)=>a+w.people[id].Arms,0),pendingArms=pendingIds.reduce((a,id)=>a+w.people[id].Arms,0),potentialTargetArms=targets.length*7100,total=c.MothballArms+residentArms+pendingArms+potentialTargetArms;assert.ok(total<=65535,'No U16 army overflow');const monthlyFloor=Math.floor(total/50),conditionalFood=allowConditionalPlunder&&city===20?(w.people[44].IQ+w.people[44].Force)*5:0;assert.ok(c.Food+conditionalFood<=65535,'No conditional food overflow');return{city,food:c.Food,money:c.Money,minimumCash:500,residentArms,pendingArms,potentialTargetArms,monthlyFloor,requiredFood:monthlyFloor+1,conditionalFood,actualSafe:c.Money>=500&&c.Food>monthlyFloor,conditionalSafe:c.Money>=500&&c.Food+conditionalFood>monthlyFloor};});return{accepted:rows.every(r=>r.actualSafe),conditionalAccepted:rows.every(r=>r.conditionalSafe),rows,futureIncomeCredited:false,futureHarvestCredited:false,actualMonthAccepted:false};
}
export function v28GuardsBeforeBattle({world,referenceWorld,envoys=V28_ENVOYS}){
 shape(world);for(const city of V28_OWNED)for(const id of v28Residents(referenceWorld,city)){assert.ok(v28Residents(world,city).includes(id),'Every original resident returned before AI battle '+id);assert.equal(world.people[id].Arms,referenceWorld.people[id].Arms,'Resident arms preserved before AI battle '+id);assert.equal(world.people[id].Belong,1);}for(const[,id]of envoys)assert.ok(!world.orders.some(o=>o.OrderId!==255&&o.OrderId!==27&&o.Person===id),'No envoy pending before battle '+id);for(const id of V28_COMBAT_GUARDS)assert.ok(v28Residents(world,20).includes(id));return{accepted:true,scope:'Measured original monthly residents and arms immediately before this native AI battle only',wholeMonthPreservationAccepted:false};
}
export function v28VerifyPlunderReturn({before,after,orderIndex}){
 const e=structuredClone(before),o=e.orders[orderIndex];eq([o.OrderId,o.City,o.Person,o.TimeCount],[26,20,44,0]);const p=e.people[44],c=e.cities[20],n=p.IQ+p.Force;assert.ok(c.Food+n*5<=65535&&c.Money+n*2<=65535);Object.assign(c,{PeopleDevotion:Math.floor(c.PeopleDevotion/2),Farming:Math.floor(c.Farming/2),Commerce:Math.floor(c.Commerce/2),Food:c.Food+n*5,Money:c.Money+n*2});for(let j=199;j>c.PersonQueue;j--)e.queue[j]=e.queue[j-1];e.queue[c.PersonQueue]=44;c.Persons++;for(let i=21;i<38;i++)e.cities[i].PersonQueue++;o.OrderId=255;eq(after,e,'Complete original Plunder/AddPerson/DelOrder adjacent transition');return{accepted:true,foodGain:n*5,moneyGain:n*2,sourceIntermediateOnly:true,actualIntermediateObserved:false,actualCastAccepted:false};
}


// Compatibility names identify this V28 source API only; no historical or fresh run acceptance.
export const V27_ENVOYS=V28_ENVOYS,V27_TARGETS=V28_TARGETS,V27_OWNED=V28_OWNED,V27_COMBAT_GUARDS=V28_COMBAT_GUARDS;
export const V23_ENVOYS=V28_ENVOYS,V23_TARGETS=V28_TARGETS,V23_OWNED=V28_OWNED,V23_COMBAT_GUARDS=V28_COMBAT_GUARDS;
export const V27_ACTORS_BY_CITY=V28_ACTORS_BY_CITY,V27_PLANNING_LIMITS=V28_PLANNING_LIMITS;
export const v27Residents=v28Residents,v27BaseCasters=v28BaseCasters,v27PlanCanvasses=v28PlanCanvasses,v27FoodBudget=v28FoodBudget,v27GuardsBeforeBattle=v28GuardsBeforeBattle,v27VerifyPlunderReturn=v28VerifyPlunderReturn;
export const v23Residents=v28Residents,v23BaseCasters=v28BaseCasters,v23PlanCanvasses=v28PlanCanvasses,v23FoodBudget=v28FoodBudget,v23GuardsBeforeBattle=v28GuardsBeforeBattle,v23VerifyPlunderReturn=v28VerifyPlunderReturn;

// V32 uses the same cap2 for every explicit target; no historical target absence is a permanent native prohibition.
export const V29_ACQUISITION_POLICY=Object.freeze({temporarilyDeprioritizedTarget:null,maximum129OrdersPerMonth:2,maximumOtherTargetOrdersPerMonth:2,maximumOrdersPerMonth:10,maximumMonthsAuthorizedByThisModule:0,sourceOnly:true,actualAcquisitionAccepted:false,actualCastAccepted:false});
export const V29_ENVOYS=V28_ENVOYS,V29_ACTORS_BY_CITY=V28_ACTORS_BY_CITY,V29_TARGETS=V28_TARGETS,V29_OWNED=V28_OWNED;
export const v29Residents=v28Residents,v29BaseCasters=v28BaseCasters,v29PlanCanvasses=v28PlanCanvasses,v29FoodBudget=v28FoodBudget,v29GuardsBeforeBattle=v28GuardsBeforeBattle,v29VerifyPlunderReturn=v28VerifyPlunderReturn,v29SourceResidueCounts=v28SourceResidueCounts,v29TargetMonthlyCap=v28TargetMonthlyCap;


export const V32_SOURCE_SCOPE=Object.freeze({period:4,king:0,currentFebruary:[239,2],maximumMonths:1,maximumCanvasses:10,maximumInitialBuys:0,maximumBuyQuantity:0,maximumTreats:0,maximumPlunders:1,moneyPerCanvass:50,minimumCash:500,maximumPerTargetMonthlyOrders:2,shipRawId:32,discoveredShipToken:32800,sourceOnly:true,actualSearchOrGiveOrAcquisitionAccepted:false});
const V32_ARM_CODES=Object.freeze([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,2,1]);
export const V32_ENVOYS=V28_ENVOYS,V32_ACTORS_BY_CITY=V28_ACTORS_BY_CITY,V32_TARGETS=V28_TARGETS,V32_OWNED=V28_OWNED,V32_COMBAT_GUARDS=V28_COMBAT_GUARDS;
export function v32EffectiveArmType(w,p){let arm=p.ArmsType;for(const token of[p.Tool1,p.Tool2]){if(!token)continue;integer(token,1,V32_ARM_CODES.length,'Original equipped one-based goods token');const code=V32_ARM_CODES[token-1];if(code===1)arm=3;else if(code===2)arm=5;else if(code===3)arm=4;else if(code)arm=(code-4)&255;}return arm;}
export function v32NativeMpAfterNavyConversion(p){integer(p.IQ,0,255,'Target native U8 IQ');integer(p.Force,0,255,'Target native U8 Force');integer(p.Level,0,255,'Target native U8 Level');integer(p.Thew,0,100,'Scoped original current Thew');const base=Math.floor(p.IQ*80/100)+(Math.floor(Math.sqrt(p.Force))>>1)+p.Level;return Math.floor(base*p.Thew/100)&255;}
export function v32DiscoveredShip(w){const c=w.cities[6];return c.Belong===1&&w.goodsQueue.slice(c.ToolQueue,c.ToolQueue+c.Tools).includes(32800);}
export function v32TargetConversionInfo(w,id){integer(id,0,199,'Target id');const p=w.people[id],effectiveType=v32EffectiveArmType(w,p),nativeNavy=effectiveType===3,emptySlot=p.Tool1===0||p.Tool2===0,bothSlotsEmpty=p.Tool1===0&&p.Tool2===0,mp=v32NativeMpAfterNavyConversion(p),advanced=p.Level>=7&&p.Level<=20,canShip=v32DiscoveredShip(w)&&bothSlotsEmpty;
 return{personId:id,advanced,effectiveType,nativeNavy,emptySlot,bothSlotsEmpty,mpAfterNavyConversion:mp,containsImpact13AtOriginalLevel:advanced,originalNavySkills:[12,13,11],impact13UseMp:30,requiresActualGive:!nativeNavy,discoveredShipAvailable:v32DiscoveredShip(w),approvedGoalCandidate:advanced&&mp>=30&&(nativeNavy||canShip),giftOrConversionPerformed:false,actualCastAccepted:false,scope:'MP/skill eligibility is original source arithmetic only. A nonnavy candidate is not a caster until an actual lawful Give and fresh native qualification; current approved nonnavy targets have both gear slots empty.'};}
export function v32AdvancedOwned(w){shape(w);return w.people.flatMap((p,id)=>{if(p.Belong!==1)return[];const info=v32TargetConversionInfo(w,id);if(!info.approvedGoalCandidate)return[];const locations=V28_OWNED.flatMap(c=>v28Residents(w,c).filter(x=>x===id).map(()=>c));return locations.length===1?[{personId:id,cityIndex:locations[0],arms:p.Arms,battleReady:info.nativeNavy&&p.Arms>0,requiresActualGive:info.requiresActualGive,alreadyEffectiveNavy:info.nativeNavy,mpAfterNavyConversion:info.mpAfterNavyConversion,impact13AfterActualNavyConversion:true,actualConversionAccepted:false}]:[];});}
export function v32RequireActualFoodBeforeEnd({world:w,plans=[]}={}){shape(w);const b=v28FoodBudget(w,{plans,allowConditionalPlunder:false});assert.equal(b.accepted,true,'No END while actual owned food/cash is unsafe; future Plunder/transport/harvest is not current food');return{accepted:true,sourceOnly:true,food:b,futureIncomeCredited:false,publicSaveObservedByThisFunction:false,actualStrategyEndAccepted:false};}
export const v32Residents=v28Residents,v32BaseCasters=v28BaseCasters,v32PlanCanvasses=v28PlanCanvasses,v32FoodBudget=v28FoodBudget,v32GuardsBeforeBattle=v28GuardsBeforeBattle;
// Complete original Plunder adjacent-world model; actual prefix/order/food authority is separate.
export const v32VerifyPlunderReturn=v28VerifyPlunderReturn;

export const V32_DISPATCH_ORDER=Object.freeze({primary:'descending-sourceScore',tie:'non-city6-before-city6',scope:'Execution order only; same maximum-weight assignment, target caps and source residue scores. A later original Canvass may relocate an already-owned target; city6-last is no RNG or final-residence guarantee.'});
