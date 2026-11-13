import assert from 'node:assert/strict';
import {planOriginalRiverApproach} from './hd-impact-river-approach.mjs';

// Original LIB 3bd20146..., IFACE_CONID2/item2 (zero based), navy3, stride46.
// FgtCount.c: MOV_RSTD=128; normal resistance is an entry-tile cost.
// These distances are static hints, never native movement or enemy predictions.
const ORIGINAL_NAVY=Object.freeze([0,...Array(4).fill(130),...Array(11).fill(131),...Array(25).fill(129),130,...Array(4).fill(129)]);
const key=p=>p.y*65536+p.x,manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const alive=u=>u.arms>0&&u.hp>0&&u.state!==8;
const terrain=v=>v>15?(v===41?6:7):v>5?2:v>4?3:v>3?4:v>2?5:v>1?0:1;
export const ORIGINAL_RIVER_ROUTE_SCOPE=Object.freeze({sourceOnly:true,pathStorage:250,navyResistanceBytes:46,actualInputAccepted:false,actualCastAccepted:false,hdAccepted:false,futureRouteIsHintOnly:true});

// Binary heap keeps the full original map bounded by O(V log V), not V squared.
function distances(tiles,width,height,start,blocked,cost,reverse=false){
 const size=tiles.length,d=Array(size).fill(Infinity),prev=Array(size).fill(-1),heap=[];
 const push=(n,v)=>{let i=heap.length;heap.push([n,v]);while(i){const p=(i-1)>>1;if(heap[p][1]<=v)break;heap[i]=heap[p];i=p;}heap[i]=[n,v];};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
 d[start]=0;push(start,0);
 while(heap.length){const [n,value]=pop();if(value!==d[n])continue;const x=n%width,y=Math.floor(n/width);
  for(const [a,b]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(a<0||b<0||a>=width||b>=height)continue;const m=b*width+a;if(blocked.has(m)&&m!==start)continue;const weight=cost[tiles[reverse?n:m]],v=value+weight;if(!Number.isFinite(weight)||v>=d[m])continue;d[m]=v;prev[m]=n;push(m,v);}
 }
 return {d,prev};
}

/** Full validation is delegated unchanged to the previous pure approach module.
 * navyResistance must be the caller's explicitly extracted original46 bytes.
 * The caller still needs rawA=rawB, rawB=rawC and the complete fresh owner ticket.
 */
export function planOriginalRiverRoute({planning,current,actorId=130,eligibleArmRatios,navyResistance}){
 const validated=planOriginalRiverApproach({planning,current,actorId,eligibleArmRatios});
 assert.ok(Array.isArray(navyResistance),'Explicit original navy46-byte row required');
 assert.deepEqual(navyResistance,ORIGINAL_NAVY,'Exact original LIB navy resistance row');
 const cost=navyResistance.map(v=>v>128&&v<160?v-128:Infinity),p=planning,{width,height,tiles}=p;
 const actor=current.units.find(u=>u.id===actorId&&u.i===p.fight.actorIndex),start=actor.y*width+actor.x;
 const mobile=current.units.filter(u=>u.side==='enemy'&&alive(u)&&u.state!==6&&u.terrain!==5&&eligibleArmRatios[u.armType]>0);
 const occupied=current.units.filter(u=>u.i!==actor.i&&alive(u)),blocked=new Set(occupied.map(u=>u.y*width+u.x));
 const cells=p.cells.filter(c=>!blocked.has(c.y*width+c.x));
 const output=(reason,target=null,routeHint=null)=>({accepted:true,reason,target:target?structuredClone(target):null,owner:structuredClone(validated.owner),mobileEnemyIds:mobile.map(u=>u.id),routeHint,sourceOnlyPlanning:true,actualInputAccepted:false,actualCastAccepted:false,hdAccepted:false,futureRouteIsHintOnly:true});
 if(!mobile.length)return output(validated.reason==='all-live-enemies-on-castle'?validated.reason:'no-eligible-mobile-enemy');
 const direct=cells.filter(c=>c.plannedTerrain===7&&mobile.some(u=>u.terrain===7&&manhattan(c,u)===1));
 if(direct.length){direct.sort((a,b)=>manhattan(a,actor)-manhattan(b,actor)||a.y-b.y||a.x-b.x);return output('current-native-river-contact',direct[0],{futurePredictionRequired:false,skillStillRequiresFreshNativeMenuAIMWeatherMP:true});}
 const from=distances(tiles,width,height,start,blocked,cost),goals=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(terrain(tiles[y*width+x])===7){
  const b={x,y};for(const [ax,ay]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
   if(ax<0||ay<0||ax>=width||ay>=height)continue;const n=ay*width+ax;
   if(terrain(tiles[n])!==7||blocked.has(n)||!Number.isFinite(from.d[n]))continue;
   for(const enemy of mobile){if(occupied.some(u=>u.x===x&&u.y===y&&u.i!==enemy.i))continue;
    goals.push({actorRiver:{x:ax,y:ay},enemyRiver:b,enemyId:enemy.id,enemyAccessManhattan:manhattan(enemy,b),actorWeightedCost:from.d[n],index:n});
   }
  }
 }
 if(!goals.length)return output('no-reachable-river-contact-pair');
 // Enemy proximity is primary: a nearby western pool cannot trap us while
 // the observed mobile enemy is already beside/on a different river component.
 // This is an explicit optimistic hint, not a modeled future enemy route.
 goals.sort((a,b)=>a.enemyAccessManhattan-b.enemyAccessManhattan||a.actorWeightedCost-b.actorWeightedCost||a.actorRiver.y-b.actorRiver.y||a.actorRiver.x-b.actorRiver.x||a.enemyId-b.enemyId);
 const goal=goals[0],to=distances(tiles,width,height,goal.index,blocked,cost,true),at=to.d[start];
 assert.equal(at,goal.actorWeightedCost,'Forward/reverse directed entry-cost distances agree');
 const candidates=cells.map(cell=>({cell,left:to.d[cell.y*width+cell.x]})).filter(c=>Number.isFinite(c.left)&&c.left<at);
 if(!candidates.length)return output(at===0?'holding-nearest-enemy-river-contact':'no-progressing-current-native-endpoint',null,{goal,actorCostAtStart:at,futureEnemyMovementGuaranteed:false});
 candidates.sort((a,b)=>a.left-b.left||b.cell.value-a.cell.value||a.cell.y-b.cell.y||a.cell.x-b.cell.x);
 const chosen=candidates[0],route=[];let n=chosen.cell.y*width+chosen.cell.x;
 for(let i=0;i<=tiles.length;i++){route.push({x:n%width,y:Math.floor(n/width)});if(n===goal.index)break;n=to.prev[n];assert.ok(n>=0,'Finite distance has a route successor');}
 assert.equal(key(route.at(-1)),key(goal.actorRiver));
 return output(chosen.cell.plannedTerrain===7?'native-river-progress':'native-land-staging-between-rivers',chosen.cell,{goal,actorCostAtStart:at,actorCostAfterEndpoint:chosen.left,weightedProgress:at-chosen.left,estimatedRouteFromEndpoint:route,edgeCost:'Original navy entryTileResistance-128; current live occupied cells blocked',enemyAccess:'Manhattan hint only; no enemy path/arrival or future turn guarantee',futureEnemyMovementGuaranteed:false,futureNativeReachabilityAccepted:false});
}
