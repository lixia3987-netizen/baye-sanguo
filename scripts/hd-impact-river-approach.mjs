import assert from 'node:assert/strict';
import {readOriginalMovePath} from './hd-impact-move-path.mjs';

// Pure planning only. No input, files, browser, RNG or native writes.
// FgtCount.c513-578,589-707,813-859: the actual full native path alone
// authorizes this turn's endpoints. Whole-map distances below are heuristics,
// never a replacement for native resistance, blockers or a fresh final pair.
// FgtPkAi.c317-318: a computer unit on Castle terrain does not move.
export const ORIGINAL_RIVER_APPROACH_SCOPE = Object.freeze({
  pathStorage:250,pathGrid:225,sourceOnly:true,actualInputAccepted:false,
  actualCastAccepted:false,hdAccepted:false,
  caller:'Verify rawA=rawB, pass the current selected MOVE context, then verify rawB=rawC and the complete selected ticket again before any public click.'
});
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const pointKey=p=>p.x+','+p.y;
function uint(v,max,label){assert.ok(Number.isInteger(v)&&v>=0&&v<=max,label);}
function terrain(raw){return raw>15?(raw===41?6:7):raw>5?2:raw>4?3:raw>3?4:raw>2?5:raw>1?0:1;}
function alive(u){return u.arms>0&&u.hp>0&&u.state!==8;}

/** Only returns an exact cell from a revalidated original MOVE planning object.
 * current is battleStateExpression read AFTER selection, not the prior PICK.
 * eligibleArmRatios is the six original skill.earm bytes, with source provenance
 * established by the caller. This function does not authorize a skill cast.
 */
export function planOriginalRiverApproach({planning,current,actorId=130,eligibleArmRatios}){
  const p=readOriginalMovePath(planning);
  assert.deepEqual(planning,p,'Complete parsed MOVE planning, including250 storage and derived cells, must revalidate');
  assert.ok(current&&Array.isArray(current.units),'Complete current selected battle units');
  assert.deepEqual(current.fight,p.fight,'Current selected MOVE owner, including unknown fields, must equal planning');
  for(const [a,b,label]of [[current.generation,p.generation,'generation'],[current.nativeMapId,p.mapId,'map'],[current.mapWidth,p.width,'width'],[current.mapHeight,p.height,'height']])assert.equal(a,b,'Current '+label+' bound to native MOVE');
  uint(actorId,200,'Original one-based actor');assert.ok(actorId>0);assert.equal(p.actorId,actorId,'Actual selected actor');
  assert.ok(Array.isArray(eligibleArmRatios)&&eligibleArmRatios.length===6,'All six original target-arm ratios');
  for(const v of eligibleArmRatios)uint(v,255,'Original target-arm ratio');
  const observed=p.readOnly.units;
  assert.ok(Array.isArray(observed)&&observed.length===20,'Complete20-slot read-only unit binding');
  assert.equal(new Set(observed.map(u=>u.i)).size,20,'Unique native unit slots');
  for(let i=0;i<20;i++)assert.equal(observed[i].i,i,'Native slots retain their original order');
  const occupied=observed.filter(u=>u.id>0&&u.id<0xfffe);
  assert.equal(current.units.length,occupied.length,'All occupied current units required');
  assert.equal(new Set(current.units.map(u=>u.i)).size,current.units.length,'No repeated current unit slot');
  for(const raw of occupied){
    const u=current.units.find(u=>u.i===raw.i);assert.ok(u,'Every occupied native slot is represented');
    assert.equal(u.id,raw.id,'Current one-based person token');assert.equal(u.side,raw.i<10?'player':'enemy','Original side binding');
    assert.ok(raw.person&&raw.position,'Complete native person/position');
    for(const k of ['x','y','hp','mp','move','active','state'])assert.equal(u[k],raw.position[k],'Current unit '+k+' must match read-only native position');
    for(const k of ['arms','belong','personIndex','name'])assert.equal(u[k],raw.person[k],'Current unit '+k+' must match read-only native person');
    uint(u.x,p.width-1,'Unit x');uint(u.y,p.height-1,'Unit y');uint(u.hp,65535,'Unit HP');uint(u.arms,65535,'Unit arms');uint(u.state,255,'Unit state');uint(u.armType,5,'Actual effective army type');
    assert.equal(u.terrain,terrain(p.tiles[u.y*p.width+u.x]),'Current terrain follows the complete original map');
  }
  const actor=current.units.find(u=>u.id===actorId&&u.i===p.fight.actorIndex);
  assert.ok(actor&&actor.side==='player'&&alive(actor)&&actor.active===0,'Live available original player actor');
  assert.equal(actor.armType,3,'This Impact river approach is for a native navy caster');
  assert.ok(p.cells.some(c=>c.x===actor.x&&c.y===actor.y),'Native path includes its selected actor');
  const blocked=new Set(current.units.filter(u=>u.i!==actor.i&&alive(u)).map(pointKey));
  const cells=p.cells.filter(c=>!blocked.has(pointKey(c)));
  const liveEnemies=current.units.filter(u=>u.side==='enemy'&&alive(u)&&u.state!==6);
  const eligible=liveEnemies.filter(u=>eligibleArmRatios[u.armType]>0);
  const mobile=eligible.filter(u=>u.terrain!==5);
  const output=(reason,target=null,extra={})=>({accepted:true,reason,target:target?structuredClone(target):null,
    owner:{generation:p.generation,mapId:p.mapId,actorId,actorIndex:p.fight.actorIndex,inputSeq:p.fight.inputSeq},
    mobileEnemyIds:mobile.map(u=>u.id),sourceOnlyPlanning:true,actualInputAccepted:false,actualCastAccepted:false,hdAccepted:false,...extra});
  if(!liveEnemies.length)return output('no-live-enemy');
  if(liveEnemies.every(u=>u.terrain===5))return output('all-live-enemies-on-castle');
  if(!mobile.length)return output('no-eligible-mobile-enemy');
  const river=cells.filter(c=>c.plannedTerrain===7),direct=river.filter(c=>mobile.some(u=>u.terrain===7&&distance(c,u)===1));
  if(direct.length){direct.sort((a,b)=>distance(a,actor)-distance(b,actor)||a.y-b.y||a.x-b.x);return output('ready-river-adjacency',direct[0],{skillStillRequiresFreshNativeMenuAIMWeatherMP:true});}
  const water=(x,y)=>x>=0&&y>=0&&x<p.width&&y<p.height&&terrain(p.tiles[y*p.width+x])===7;
  const goals=[];
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(water(x,y)){
    const degree=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>water(a,b)).length;
    if(degree)goals.push({x,y,degree,enemyDistance:Math.min(...mobile.map(u=>distance({x,y},u)))});
  }
  if(!goals.length)return output('no-adjacent-river-pair-in-map');
  // Positive Manhattan estimates deliberately do not authorize any future step.
  // Weight our distance so a nearby upper river beats a distant side pool even
  // when that side pool is slightly nearer to the current enemy position.
  const potential=c=>Math.min(...goals.map(g=>2*distance(c,g)+g.enemyDistance));
  const degree=c=>[[c.x-1,c.y],[c.x+1,c.y],[c.x,c.y-1],[c.x,c.y+1]].filter(([x,y])=>water(x,y)).length;
  const rank=(a,b)=>potential(a)-potential(b)||degree(b)-degree(a)||distance(a,actor)-distance(b,actor)||a.y-b.y||a.x-b.x;
  if(river.length){river.sort(rank);return output('river-approach-mobile-enemy',river[0],{heldPosition:distance(river[0],actor)===0});}
  const base=potential(actor),staging=cells.filter(c=>distance(c,actor)>0&&potential(c)<base);
  staging.sort(rank);
  if(!staging.length)return output('no-progressing-native-land-staging');
  return output('land-staging-toward-valuable-river',staging[0],{heuristicBefore:base,heuristicAfter:potential(staging[0]),castAuthorized:false});
}
