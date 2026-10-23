// Current original WOOD MOVE/AIM checks. Source route derives every map/city/Way.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyOriginalMovePathPair} from './hd-impact-move-path.mjs';
import {sourceOriginalWoodRoute} from './hd-wood-native-route.mjs';
const LIB={bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'};
const hash=b=>createHash('sha256').update(b).digest('hex'),copy=structuredClone;
const NO_CREDIT=Object.freeze({actualInputAccepted:false,actualCastAccepted:false,actualMovieAccepted:false,classicNativePixelAccepted:false,hdAccepted:false,globalHdComplete:false,successForecastAccepted:false});
function terrain(raw){return raw>15?(raw===41?6:7):raw>5?2:raw===5?3:raw===4?4:raw===3?5:raw===2?0:raw===1?1:255;}
function context({libBytes,origin,destination,skillId}){assert.ok(skillId===6||skillId===7,'Only original WOOD6/7');const r=sourceOriginalWoodRoute({libBytes,origin,destination}),s={...r.skillConditions.find(s=>s.id===skillId),minimumLevel:skillId===6?6:11},at=(x,y)=>terrain(r.tiles[y*r.width+x]);return{r,s,at};}
function uint(v,max,label){assert.ok(Number.isInteger(v)&&v>=0&&v<=max,label);}
function library(v){assert.ok(v&&v.status==='ready','Current original LIB ready');assert.deepEqual([v.byteLength,v.sha256],[LIB.bytes,LIB.sha256],'Exact current original LIB identity');}
function slots(snapshot){
  assert.ok(snapshot&&Array.isArray(snapshot.units)&&snapshot.units.length===20,'Full original20 native slots');
  const occupied=new Set();
  for(let i=0;i<20;i++){
    const u=snapshot.units[i];assert.ok(u&&u.position);assert.equal(u.i,i,'Exact native slot order');uint(u.id,65535,'Native unit token');assert.ok(u.id===0||u.id>=65534||u.id<=200,'Original native token/sentinel');
    for(const k of ['x','y'])uint(u.position[k],31,'Reviewed native32 map '+k);
    for(const k of ['hp','mp'])uint(u.position[k],65535,'Native U16 '+k);
    for(const k of ['move','active'])uint(u.position[k],255,'Native U8 '+k);uint(u.position.state,8,'Original state');
    if(u.id>0&&u.id<65534){assert.ok(!occupied.has(u.id),'No duplicate occupied person tokens');occupied.add(u.id);assert.ok(u.person);assert.equal(u.person.personIndex,u.id-1);assert.equal(typeof u.person.name,'string');uint(u.person.arms,65535,'Original arms');uint(u.person.belong,65535,'Original owner');}
  }
}
function bind(raw,current,label,at){
  assert.ok(raw?.person&&current,label+' actual unit');assert.equal(raw.i,current.i);assert.equal(raw.id,current.id);
  for(const k of ['x','y','hp','mp','move','active','state'])if(Object.hasOwn(current,k))assert.equal(raw.position[k],current[k],label+' current '+k);
  for(const k of ['personIndex','name','arms','belong'])assert.equal(raw.person[k],current[k],label+' person '+k);
  assert.equal(current.side,current.i<10?'player':'enemy',label+' native side');
  assert.equal(current.terrain,at(raw.position.x,raw.position.y),label+' exact original map terrain');
}
function caster(actor,s){
  assert.equal(actor.id,132);assert.equal(actor.personIndex,131);assert.equal(actor.side,'player');assert.equal(actor.belong,1,'Original current player owns131');uint(actor.i,9,'Player actor slot');
  assert.equal(actor.armType,1,'Current effective infantry');assert.equal(actor.level,17,'Current source131 level17');assert.ok(actor.level>=s.minimumLevel);
  assert.ok(actor.arms>0&&actor.hp>0&&actor.active===0&&![1,2,6,8].includes(actor.state),'Current caster live/available');
}
function targetEligible(t,s,actor){return t.side==='enemy'&&t.i>=10&&t.i<20&&t.id>0&&t.id<=200&&t.arms>0&&t.hp>0&&![6,8].includes(t.state)&&Number.isInteger(t.armType)&&t.armType>=0&&t.armType<6&&s.earm[t.armType]>0&&s.eland[t.terrain]>0&&t.belong!==actor.belong;}
function inRange(x,y,t,s){const dx=(t.x-x+4),dy=(t.y-y+4);return dx>=0&&dy>=0&&dx<9&&dy<9&&s.range[dy*9+dx]===1;}

export function verifyOriginalWoodMove({first,second,current,skillId,libBytes,origin,destination}={}){
  const {r,at,s}=context({libBytes,origin,destination,skillId});assert.ok(first&&current?.fight);assert.deepEqual(current.fight,first.fight,'Complete current selected MOVE owner');
  const owner={generation:current.generation,mapId:current.nativeMapId,actorId:132,actorIndex:current.fight.actorIndex,inputSeq:current.fight.inputSeq};
  const checked=verifyOriginalMovePathPair(first,second,owner),p=checked.planning;
  assert.deepEqual([p.mapId,p.fight.cityIndex,p.width,p.height],[r.mapId,r.destination,r.width,r.height]);library(p.readOnly.library);slots(p.readOnly);assert.equal(hash(Buffer.from(p.tiles)),r.mapTilesSha256,'Exact current approved original map tiles');assert.equal(p.readOnly.spe.generation,p.generation);
  assert.deepEqual([p.readOnly.spe.active,p.readOnly.report.active,p.readOnly.result.active,p.readOnly.top.active],[0,0,false,false],'No competing MOVE presentation owner');
  assert.ok(Array.isArray(current.units));const seen=new Set();for(const u of current.units){assert.ok(!seen.has(u.i));seen.add(u.i);bind(p.readOnly.units[u.i],u,'Current MOVE roster',at);}
  assert.equal(current.units.length,p.readOnly.units.filter(u=>u.id>0&&u.id<65534).length,'Current flat roster retains all occupied slots');
  const actor=current.units.find(u=>u.i===p.fight.actorIndex);caster(actor,s);assert.equal(actor.mp,p.readOnly.units[actor.i].position.mp);
  uint(current.weather,5,'Current native weather');assert.ok(current.weather>=1);const canPay=actor.mp>=s.useMp&&s.weather[current.weather-1]>0;
  const enemies=current.units.filter(t=>targetEligible(t,s,actor));
  const eligible=(x,y)=>canPay&&s.oland[at(x,y)]>0?enemies.filter(t=>inRange(x,y,t,s)):[];
  const currentTargets=eligible(actor.x,actor.y);let selected=null,reason;
  const endpoints=p.cells.filter(c=>(c.x!==actor.x||c.y!==actor.y)&&!current.units.some(u=>u.i!==actor.i&&u.state!==8&&u.x===c.x&&u.y===c.y));
  const ready=endpoints.map(c=>({cell:c,targets:eligible(c.x,c.y)})).filter(x=>x.targets.length).sort((a,b)=>b.targets.length-a.targets.length||Math.abs(a.cell.x-actor.x)+Math.abs(a.cell.y-actor.y)-Math.abs(b.cell.x-actor.x)-Math.abs(b.cell.y-actor.y)||a.cell.y-b.cell.y||a.cell.x-b.cell.x);
  if(currentTargets.length)reason='current-actor-already-has-current-wood-target';
  else if(ready.length){selected=ready[0].cell;reason='current-native-endpoint-enables-current-wood-target';}
  else{
    const hills=p.tiles.flatMap((t,i)=>terrain(t)===2?[{x:i%32,y:Math.trunc(i/32)}]:[]);
    const hint=point=>Math.min(...hills.map(h=>Math.abs(h.x-point.x)+Math.abs(h.y-point.y)));
    const onMountain=at(actor.x,actor.y)===2||at(actor.x,actor.y)===5;
    const land=endpoints.filter(c=>s.oland[c.plannedTerrain]>0).sort((a,b)=>Math.abs(a.x-actor.x)+Math.abs(a.y-actor.y)-Math.abs(b.x-actor.x)-Math.abs(b.y-actor.y)||a.y-b.y||a.x-b.x);
    if(onMountain)reason='current-caster-terrain-ready-await-fresh-enemy-aim';
    else if(land.length){selected=land[0];reason='current-native-endpoint-on-original-caster-terrain';}
    else{const progressing=endpoints.filter(c=>hint(c)<hint(actor)).sort((a,b)=>hint(a)-hint(b)||a.y-b.y||a.x-b.x);selected=progressing[0]||null;reason=selected?'current-native-endpoint-toward-static-mountain-hint':'no-progressing-current-native-endpoint';}
  }
  return {...checked,current:copy(current),route:copy(r.route),decision:{target:copy(selected),reason,eligibleTargets:copy(selected?eligible(selected.x,selected.y):currentTargets),futureRouteIsHintOnly:true,futureEnemyMovementGuaranteed:false,currentTargetStillRequiresFreshNativeAim:true},
    sourceOnlyPlanning:true,originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT};
}

export function verifyOriginalWoodAimFence({first,second,original,target,actor,skillId,casterNativeId,libBytes,origin,destination}={}){
  const {r,at,s}=context({libBytes,origin,destination,skillId}),RANGE=s.range;assert.ok(first&&second&&original&&target&&actor,'Complete actual WOOD AIM proof');assert.equal(casterNativeId,132);
  assert.deepEqual(second,first,'Entire readonly AIM pair including keys/world/20 slots/refs/unknown fields');
  const snapshot=first.snapshot,f=snapshot.fight;slots(snapshot);library(snapshot.library);uint(first.keys,0xffffffff,'Current key history');uint(first.generation,0xffffffff,'Current generation');assert.ok(first.generation>0);
  assert.equal(first.generation,original.generation);assert.equal(snapshot.spe.generation,first.generation);assert.deepEqual([first.mapId,f.cityIndex,f.mapW,f.mapH],[r.mapId,r.destination,r.width,r.height]);
  assert.deepEqual([f.active,f.over,f.wait,f.phase,f.inputKind,f.aimType,f.actorIndex],[1,0,1,3,5,1,actor.i]);uint(f.inputSeq,0xffffffff,'Current native AIM sequence');assert.ok(f.inputSeq>0);
  assert.deepEqual(f,{...original.fight,focusX:f.focusX,focusY:f.focusY},'Full original AIM owner except legal classic cursor focus');
  assert.deepEqual([snapshot.spe.active,snapshot.report.active,snapshot.result.active],[0,0,false],'No active movie/report/result before confirmation');assert.equal(snapshot.top.active,false,'No competing result owner');
  caster(actor,s);uint(target.i,19,'Enemy target slot');assert.ok(target.i>=10);const a=snapshot.units[actor.i],t=snapshot.units[target.i];bind(a,actor,'WOOD caster',at);bind(t,target,'WOOD target',at);
  const fullTarget={...target,...t.position,...t.person,i:t.i,id:t.id};
  assert.equal(original.casterId,132);assert.equal(original.targetId,target.id);assert.ok(targetEligible(fullTarget,s,actor),'Actual live enemy and original earm/eland');
  assert.deepEqual([a.position.active,a.position.state,a.position.mp],[0,original.casterState,original.casterMp]);assert.equal(original.casterActive,0);assert.ok(a.position.mp>=s.useMp,'Current actual MP pays original WOOD; source84 is not a requirement');
  assert.deepEqual([a.position.x,a.position.y,t.position.x,t.position.y],[original.casterX,original.casterY,original.x,original.y]);assert.deepEqual([f.focusX,f.focusY],[target.x,target.y],'Current classic cursor reaches actual target');
  assert.equal(t.position.state,original.state);assert.equal(target.armType,original.arm);uint(original.arm,5,'Actual target effective arm');
  assert.deepEqual([first.actorTerrain,original.casterTerrain,actor.terrain],[at(actor.x,actor.y),at(actor.x,actor.y),at(actor.x,actor.y)]);assert.ok(s.oland[first.actorTerrain]>0,'Original caster must stand on hill2/city5');
  assert.deepEqual([first.targetTerrain,original.terrain,target.terrain],[at(target.x,target.y),at(target.x,target.y),at(target.x,target.y)]);assert.ok(s.eland[first.targetTerrain]>0,'Original skill-specific target terrain');
  uint(first.weather,5,'Actual weather');assert.ok(first.weather>=1&&s.weather[first.weather-1]>0);assert.equal(first.weather,original.weather);
  const range=first.range;assert.ok(range&&Array.isArray(range.values));assert.deepEqual(range,{size:9,x:(actor.x-4)&255,y:(actor.y-4)&255,values:[...RANGE]},'Exact current original9x9 WOOD range and actor origin');
  assert.deepEqual(range,{size:original.size,x:original.originX,y:original.originY,values:original.values},'Complete original actual AIM range');
  const dx=(target.x-range.x)&255,dy=(target.y-range.y)&255;assert.ok(dx<9&&dy<9);assert.equal(range.values[dy*9+dx],1,'Current native AIM value1 authorizes enemy');
  return {first,second,skillId,route:copy(r.route),expectedNativeWay:r.nativeWay,mpRequired:s.useMp,actualConfirmationNotYetSent:true,currentSkillRequiresVerifiedMenu:true,currentPersonMetadataRequiresIndependentGetterAndRaw:true,originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT};
}

export function v41SelectWoodMoveCell({proof,actor}={}){
 assert.equal(proof?.accepted,true,'Current verified native MOVE proof');assert.ok(proof.planning&&proof.decision&&actor);assert.equal(actor.id,132);assert.equal(proof.planning.actorId,132);assert.equal(proof.planning.fight.actorIndex,actor.i);
 if(proof.decision.target){const t=proof.decision.target,c=proof.planning.cells.find(c=>c.x===t.x&&c.y===t.y);assert.ok(c,'Only actual current native MOVE cell');assert.deepEqual(t,c,'Complete actual native endpoint');return copy(c);}
 if(['current-actor-already-has-current-wood-target','current-caster-terrain-ready-await-fresh-enemy-aim'].includes(proof.decision.reason)){const c=proof.planning.cells.find(c=>c.x===actor.x&&c.y===actor.y);assert.ok(c,'Current native MOVE cell required even for same-position confirmation');return copy(c);}
 return null;
}
