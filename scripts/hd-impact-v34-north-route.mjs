// Pure V34 original6 ->12/map112 north-route contracts. No I/O, native input,
// world mutation or RNG. March/food/guards/prices remain the original military
// and economics verifiers' responsibility. Public fight() omits origin/Way:
// callers must separately bind the accepted March27 and measured native Way0.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyOriginalMovePathPair} from './hd-impact-move-path.mjs';
import {planOriginalRiverRoute} from './hd-impact-river-route.mjs';

export const APPROVED_V34_NORTH_ROUTE = Object.freeze({originCity:6,destinationCity:12,mapId:112});
const LIB = Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'});
const MAP_TILES_SHA256 = '2becb0f6e54a237b67bda8f5dea3abcfd5f021bfe4afa0f5b2e1d87b4ba22a31';
const ARM_RATIOS = Object.freeze([100,100,100,80,100,100]);
export const V34_NORTH_ROUTE_CONTRACT = Object.freeze({
  route:APPROVED_V34_NORTH_ROUTE,direction:0,nativeWay:0,casterNativeId:130,
  mapWidth:32,mapHeight:32,pathStorage:250,nativeUnitSlots:20,minimumBattleMp:30,
  originalLibrary:LIB,originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,
  scope:'Pure original6 to12/map112 north contract; source geography is a hint, each MOVE needs the complete current250 bytes/20 slots, and final AIM needs the current original skill13 menu proof. No input, cast, movie, pixels or HD acceptance.',
});
const NO_CREDIT = Object.freeze({
  actualInputAccepted:false,actualCastAccepted:false,actualMovieAccepted:false,
  classicNativePixelAccepted:false,hdAccepted:false,globalHdComplete:false,
  successForecastAccepted:false,
});
const copy = value => structuredClone(value);
const hash = value => createHash('sha256').update(value).digest('hex');
function uint(value,max,label){assert.ok(Number.isInteger(value)&&value>=0&&value<=max,label);}
function route(value){assert.deepEqual(value,APPROVED_V34_NORTH_ROUTE,'Only approved original6 to12/map112 north route');}
function libraryIdentity(value){
  assert.ok(value&&value.status==='ready','Current original library is ready');
  assert.equal(value.sha256,LIB.sha256,'Exact original-library hash');
  assert.equal(value.byteLength,LIB.bytes,'Exact original-library byte length');
}
function nativeSlots(snapshot){
  assert.ok(snapshot&&Array.isArray(snapshot.units)&&snapshot.units.length===20,'All original20 native slots required');
  for(let i=0;i<20;i++){
    const u=snapshot.units[i];assert.ok(u&&u.position,'Every native slot retains its full position');
    assert.equal(u.i,i,'Native slots retain exact order, including empty slots');
    uint(u.id,65535,'Native one-based unit token');
    assert.ok(u.id===0||u.id>=65534||u.id<=200,'Original person token or empty native sentinel');
    for(const k of ['x','y'])uint(u.position[k],31,'Original map112 slot '+k);
    for(const k of ['hp','mp'])uint(u.position[k],65535,'Native U16 slot '+k);
    for(const k of ['move','active'])uint(u.position[k],255,'Native U8 slot '+k);
    uint(u.position.state,8,'Original native state enum0..8');
    if(u.id>0&&u.id<65534){
      assert.ok(u.person,'Every occupied slot retains its native person');
      assert.equal(u.person.personIndex,u.id-1,'Native slot/person token binding');
      assert.equal(typeof u.person.name,'string','Current native person name');
      uint(u.person.arms,65535,'Native person arms');uint(u.person.belong,255,'Native person owner');
    }
  }
}
function boundContextUnit(raw,current,label){
  assert.ok(raw&&current,label+' current unit');
  assert.equal(current.id,raw.id,label+' one-based ID');
  for(const k of ['x','y','hp','mp','move','active','state']){
    // rangedUnitsExpression intentionally publishes no HP/MP/move/active.
    if(Object.hasOwn(current,k))assert.equal(current[k],raw.position[k],label+' current '+k);
  }
  for(const k of ['personIndex','name','arms','belong'])assert.equal(current[k],raw.person[k],label+' current '+k);
}

/** Source geography only. Exact LIB bytes establish link direction and initial
 * spawn; they establish neither current MOVE endpoints nor future AI movement.
 * No world is reduced to selected fields or used to infer a MAKE/return delta.
 */
export function sourceV34NorthRoute({libBytes}={}){
  assert.ok(Buffer.isBuffer(libBytes)||libBytes instanceof Uint8Array,'Complete original library bytes');
  const b=Buffer.from(libBytes.buffer,libBytes.byteOffset,libBytes.byteLength);
  assert.deepEqual([b.length,hash(b)],[LIB.bytes,LIB.sha256],'Exact complete original LIB');
  function item(id,index=0){
    const at=b.readUInt32LE((id-1)*4),length=b.readUInt32LE(at),count=b.readUInt16LE(at+6),fixed=b.readUInt32LE(at+8);
    assert.equal(b.readUInt16LE(at+4),id);assert.ok(index<count&&at+length<=b.length);
    const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(at+14+index*8);
    const size=fixed||(count===1?length-14:b.readUInt32LE(at+18+index*8));
    assert.ok(offset>=14&&size>0&&offset+size<=length);return b.subarray(at+offset,at+offset+size);
  }
  const links=item(59),mapIds=item(2,14),coords=item(2,5),positions=item(2,4),resistance=item(2,2);
  assert.deepEqual([links.length,mapIds.length,coords.length,positions.length,resistance.length],[608,38,76,180,277]);
  const direction=Array.from(links.subarray(12*16,12*16+8)).indexOf(6+1);
  assert.equal(direction,0,'GetDirect(destination12,origin6) is original north0');
  assert.ok(links.subarray(6*16,6*16+8).includes(12+1),'Original origin6 road reaches12');
  assert.equal(110+mapIds[12],112,'Original city12 native map');
  const payload=item(112),width=payload[0],height=payload[2],tiles=Array.from(payload.subarray(16));
  assert.deepEqual([width,height,tiles.length,hash(Buffer.from(tiles))],[32,32,1024,MAP_TILES_SHA256]);
  const origin={x:coords[12],y:coords[13]},destination={x:coords[24],y:coords[25]};
  const sourceInitialPlayerPosition={x:(width>>1)-2+positions[0],y:positions[1]};
  assert.deepEqual(sourceInitialPlayerPosition,{x:16,y:2});
  return {
    accepted:true,sourceOnly:true,route:copy(APPROVED_V34_NORTH_ROUTE),direction,nativeWay:direction,
    width,height,tiles,sourceInitialPlayerPosition,sourceTravelMonths:Math.abs(origin.x-destination.x)+Math.abs(origin.y-destination.y),
    origin,destination,navyResistance:Array.from(resistance.subarray(3*46,4*46)),eligibleArmRatios:[...ARM_RATIOS],
    futureRouteIsHintOnly:true,futureEnemyMovementGuaranteed:false,actualBattleMpObserved:false,
    originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT,
  };
}

/** Verify each A/B and B/C pair. decision.target is only a cell from the full
 * current native grid. A route hint cannot authorize a later step or a cast.
 */
export function verifyV34NorthMove({first,second,current,navyResistance,approvedRoute=APPROVED_V34_NORTH_ROUTE}={}){
  route(approvedRoute);assert.ok(first&&current&&current.fight,'Complete selected MOVE context');
  const owner={generation:current.generation,mapId:current.nativeMapId,actorId:130,actorIndex:current.fight.actorIndex,inputSeq:current.fight.inputSeq};
  const checked=verifyOriginalMovePathPair(first,second,owner),p=checked.planning;
  assert.deepEqual([p.mapId,p.fight.cityIndex,p.width,p.height],[112,12,32,32],'Current native north-route destination/map');
  libraryIdentity(p.readOnly.library);nativeSlots(p.readOnly);
  assert.equal(hash(Buffer.from(p.tiles)),MAP_TILES_SHA256,'Complete current original map112 tiles');
  const decision=planOriginalRiverRoute({planning:p,current,actorId:130,eligibleArmRatios:[...ARM_RATIOS],navyResistance});
  return {...checked,decision,current:copy(current),route:copy(approvedRoute),sourceOnlyPlanning:true,
    originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT};
}

/** A final readonly pair immediately before public confirmation. This checks
 * the actual current AIM, not static river examples or source MP arithmetic.
 * The caller separately verifies the original current menu really selected13.
 */
export function verifyV34NorthFinalAim({first,second,original,target,actor,approvedRoute,casterNativeId,librarySha256}={}){
  route(approvedRoute);assert.ok(first&&second&&original&&target&&actor,'Complete current native AIM proof');
  assert.equal(casterNativeId,130);assert.equal(librarySha256,LIB.sha256);
  assert.deepEqual(second,first,'Entire readonly AIM pair including keys,20 slots,world,refs and unknown fields remains exact');
  const s=first.snapshot,f=s.fight;nativeSlots(s);libraryIdentity(s.library);
  uint(first.keys,0xffffffff,'Observed key history length');uint(first.generation,0xffffffff,'Actual native AIM generation');
  assert.equal(first.generation,original.generation);assert.equal(s.spe.generation,first.generation);
  assert.deepEqual([first.mapId,f.cityIndex,f.mapW,f.mapH],[112,12,32,32]);
  uint(actor.i,9,'Original player slot');uint(target.i,19,'Original enemy slot');assert.ok(target.i>=10,'Target is in enemy native half');
  assert.deepEqual([f.active,f.over,f.wait,f.phase,f.inputKind,f.aimType,f.actorIndex],[1,0,1,3,5,1,actor.i]);
  uint(f.inputSeq,0xffffffff,'Current AIM input sequence');assert.ok(f.inputSeq>0);
  // Classic cursor movement is allowed; every other known/unknown fight field
  // remains bound to the preceding actual native AIM proof.
  assert.deepEqual(f,{...original.fight,focusX:f.focusX,focusY:f.focusY},'Complete original AIM owner except permitted cursor focus');
  assert.equal(s.spe.active,0);assert.equal(s.report.active,0);assert.equal(s.result.active,false);
  const a=s.units[actor.i],t=s.units[target.i];
  assert.deepEqual([actor.id,a.id,original.casterId],[130,130,130]);
  assert.deepEqual([actor.side,target.side],['player','enemy']);assert.equal(t.id,target.id);assert.equal(original.targetId,t.id);
  boundContextUnit(a,actor,'Caster');boundContextUnit(t,target,'Target');
  assert.equal(actor.armType,3,'Current effective native navy caster');assert.ok(actor.level>=7,'Actual original caster level');
  uint(original.arm,5,'Actual original target army type');assert.equal(target.armType,original.arm);assert.ok(ARM_RATIOS[original.arm]>0);
  assert.ok(a.person.arms>0&&a.position.hp>0&&t.person.arms>0&&t.position.hp>0,'Both actual units live');
  assert.ok(![1,2,6,8].includes(a.position.state));assert.ok(![6,8].includes(t.position.state));
  assert.deepEqual([a.position.active,a.position.state,a.position.mp],[0,original.casterState,original.casterMp]);
  assert.equal(original.casterActive,0);assert.ok(a.position.mp>=30,'Observed battle MP pays native30; source68 is not a requirement');
  assert.equal(t.position.state,target.state);assert.equal(t.position.state,original.state);
  assert.deepEqual([a.position.x,a.position.y,t.position.x,t.position.y],[original.casterX,original.casterY,original.x,original.y]);
  assert.deepEqual([target.x,target.y],[original.x,original.y]);
  assert.deepEqual([first.actorTerrain,first.targetTerrain,actor.terrain,target.terrain,original.casterTerrain,original.terrain],[7,7,7,7,7,7]);
  assert.equal(Math.abs(a.position.x-t.position.x)+Math.abs(a.position.y-t.position.y),1,'Current actual double-river enemy adjacency');
  uint(first.weather,4,'Original current weather');assert.ok(first.weather>=1);assert.equal(first.weather,original.weather);
  const r=first.range;assert.ok(r&&Array.isArray(r.values));uint(r.size,15,'Native AIM side');assert.ok(r.size>=1);
  uint(r.x,255,'Native AIM origin x');uint(r.y,255,'Native AIM origin y');
  assert.equal(r.values.length,r.size*r.size,'Complete native AIM grid');for(const v of r.values)uint(v,255,'Native AIM byte');
  assert.deepEqual(r,{size:original.size,x:original.originX,y:original.originY,values:original.values},'Exact complete original current AIM range');
  const dx=(t.position.x-r.x)&255,dy=(t.position.y-r.y)&255;assert.ok(dx<r.size&&dy<r.size);assert.equal(r.values[dy*r.size+dx],1,'Current original AIM bit authorizes target');
  return {first,second,actualConfirmationNotYetSent:true,currentSkillRequiresVerifiedMenu:true,
    originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT};
}
