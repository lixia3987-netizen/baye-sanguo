// Pure V36 WOOD6/7 original7→1/map110 fence. No I/O, native calls, writes or RNG.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyOriginalMovePathPair} from './hd-impact-move-path.mjs';

export const APPROVED_V36_WOOD_ROUTE=Object.freeze({originCity:7,destinationCity:1,mapId:110});
const LIB=Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'});
const MAP_SHA='d85fb46a63873b8f86ac10088b7e654e903c96d361813e87c2bc70e27bc46e1c';
const TILE_BYTES=Buffer.from('AhEBAQICAgICAgUFAgICBwEBAgIdEBsQHgEHAQEHAgICEQEBAgICAQQBBQUCAgIBAQQCAgEBEQEBAQEBAQICBwIRAQECDg8BAQEFBQICAgEBAgICARIiAQEBAQEBAQICAhEBAQEBAQcBAQEBAQcBAQEBAQESJR4BBAEBAQEBAgICFxAQEBAQEBAQEBAYAQEHEh8fHyUeAQEBAQEBAQECAgICAgICAgEBAQEBAREBAQEhFiQgHgEBAgICAQcBAQICBQUFBQUCAQEFBQUBEQEHASEgHgEBAQIKCwIBAQEBAgIFBQUFBQIBAQUFBQEXEBAQFQEBAQECAgwNAgEBAQECAgUFBQUFBAEBBQUFAQEBAQEBAQEBAQICAgICAQEBBwICBQUFBQUBAQEBAQEHBQUFAgICAQEBAgICAgIBAQQCAgIFBQUFBQEBAQEBAQEFBQUCAgIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQUFBQICAgEBBwEBAQEBLBAQEBsQEBAQGAEODwECAgIBBQUFAgICAQEBAQEBAQEBAQEBEQIBAQERAQEBAQICAgEBAQUCAgIBAQUFBQUFBQUFBQcRAgICARcQEBgBAgICAQEBBQIHAQEBLBAQGxAQEBAQEBUCAgIBAQEBEQECAgIBAQEBAwEBAQEBAQERAQEBAQEBAQICAgEBBAERAQICAgEBAQECAgICAgIBAREBAgICAgICAgICAgICAREBAQEBAQcBAQICAgICAgEBEQECAgICAgICAgICAgIBEQ4PAQEBAQEBAgICAgICAQERAQICAgICAgICAgICAgEXEBAQEBAYAQECAgICAgIBAREBAQEBAQEBAQcBAQcBAQEBAQEBAREBAQICAgICAgEBFxAbEC0BAQcBEBAQEBgBAgICAgEBEQEBAgICAgICAQEBAREHAQEBAQEBAQEBEQECAgICAQERAQECAgICAgIBBwEBEQECAgICAQICAgERAQIFBQUBAREBAQEpAQEBAQEBAQERAQICAgIBAgICAREBBQUFBQEBEQEBAQEBAQEBAQEBAREBAQEBAQECAgIBEQEFBQUFAQERAQEBAQEBBwEBAQEBEQEHAQEBAQICAgERAQEBAQEBAREBAQEBAQEBAQEBBwEXEBAQEBAQAgICARcQEBAQEBAQFQEODwEBAQEBAQEBAQEBAQEHAQIFBQIBAQcBAQEBAQEBAQEBAQIFBQUFBQUFAgICAgEBAgUFAgEBAQEBBAEHAQcBAQEBAgUFBQUFBQUCAgICBAECBQUCAQEHAQICAgICAgEBBwECBQUFBQUFBQICAgIBAQIFAgIBAQEBAgICAgICAQEBAQEBBwEBAQEHAQEBAQcBAQ==','base64');
const RANGE=Object.freeze(Array.from(Buffer.from('000000000000000000000000000000000000000000000100000000000000010101000000000001010201010000000000010101000000000000000100000000000000000000000000000000000000000000','hex')));
const hash=b=>createHash('sha256').update(b).digest('hex'),copy=structuredClone;
assert.deepEqual([TILE_BYTES.length,hash(TILE_BYTES)],[1024,MAP_SHA]);
const NO_CREDIT=Object.freeze({actualInputAccepted:false,actualCastAccepted:false,actualMovieAccepted:false,classicNativePixelAccepted:false,hdAccepted:false,globalHdComplete:false,successForecastAccepted:false});
export const V36_WOOD_ROUTE_CONTRACT=Object.freeze({route:APPROVED_V36_WOOD_ROUTE,nativeWay:3,direction:3,casterNativeId:132,personIndex:131,effectiveArm:1,sourceLevel:17,sourceMpFormulaOnly:84,mapWidth:32,mapHeight:32,pathStorage:250,nativeUnitSlots:20,sourceInitialPlayerPosition:Object.freeze({x:29,y:29}),originalLibrary:LIB,originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,scope:'Static original7→1/map110/Way3 only; complete current native MOVE and current verified6/7 menu/AIM remain mandatory. Source MP84 is arithmetic, never a battle requirement.'});
function uint(v,max,label){assert.ok(Number.isInteger(v)&&v>=0&&v<=max,label);}
function route(r){assert.deepEqual(r,APPROVED_V36_WOOD_ROUTE,'Only approved original7→1/map110 WOOD route');}
function library(v){assert.ok(v&&v.status==='ready','Current original LIB ready');assert.deepEqual([v.byteLength,v.sha256],[LIB.bytes,LIB.sha256],'Exact current original LIB identity');}
function terrain(raw){return raw>15?(raw===41?6:7):raw>5?2:raw===5?3:raw===4?4:raw===3?5:raw===2?0:raw===1?1:255;}
const at=(x,y)=>terrain(TILE_BYTES[y*32+x]);
function skill(id){
  assert.ok(id===6||id===7,'Only actual original WOOD6/7');
  return {id,aim:0,state:0,power:id===6?800:1000,destroy:0,useMp:id===6?20:25,minimumLevel:id===6?6:11,
    sourceMovie:{speId:37,kind:2,startFrame:0,endFrame:id===6?7:0,x:48,y:16,backgroundMode:0,actualMovieAccepted:false},
    weather:[100,100,100,100,0],eland:id===6?[100,100,0,60,0,0,0,0]:[100,100,0,60,0,0,0,100],
    oland:[0,0,100,0,0,100,0,0],earm:[100,100,100,100,100,100],range:[...RANGE]};
}
function slots(snapshot){
  assert.ok(snapshot&&Array.isArray(snapshot.units)&&snapshot.units.length===20,'Full original20 native slots');
  const occupied=new Set();
  for(let i=0;i<20;i++){
    const u=snapshot.units[i];assert.ok(u&&u.position);assert.equal(u.i,i,'Exact native slot order');uint(u.id,65535,'Native unit token');assert.ok(u.id===0||u.id>=65534||u.id<=200,'Original native token/sentinel');
    for(const k of ['x','y'])uint(u.position[k],31,'Native map110 '+k);
    for(const k of ['hp','mp'])uint(u.position[k],65535,'Native U16 '+k);
    for(const k of ['move','active'])uint(u.position[k],255,'Native U8 '+k);uint(u.position.state,8,'Original state');
    if(u.id>0&&u.id<65534){assert.ok(!occupied.has(u.id),'No duplicate occupied person tokens');occupied.add(u.id);assert.ok(u.person);assert.equal(u.person.personIndex,u.id-1);assert.equal(typeof u.person.name,'string');uint(u.person.arms,65535,'Original arms');uint(u.person.belong,65535,'Original owner');}
  }
}
function bind(raw,current,label){
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

export function sourceV36WoodRoute({libBytes}={}){
  assert.ok(Buffer.isBuffer(libBytes)||libBytes instanceof Uint8Array,'Complete original LIB bytes');const b=Buffer.from(libBytes.buffer,libBytes.byteOffset,libBytes.byteLength);
  assert.deepEqual([b.length,hash(b)],[LIB.bytes,LIB.sha256],'Exact complete original LIB');
  const item=(id,i=0)=>{const a=b.readUInt32LE((id-1)*4),len=b.readUInt32LE(a),n=b.readUInt16LE(a+6),f=b.readUInt32LE(a+8);assert.equal(b.readUInt16LE(a+4),id);assert.ok(i>=0&&i<n&&a+len<=b.length);const off=f?14+i*f:n===1?14:b.readUInt32LE(a+14+i*8),size=f||(n===1?len-14:b.readUInt32LE(a+18+i*8));assert.ok(off>=14&&size>0&&off+size<=len);return b.subarray(a+off,a+off+size);};
  const links=item(59),ids=item(2,14),coords=item(2,5),pos=item(2,4),res=item(2,2),map=item(110);
  assert.deepEqual([links.length,ids.length,coords.length,pos.length,res.length,map.length],[608,38,76,180,277,1040]);
  const direction=[...links.subarray(16,24)].indexOf(8);assert.equal(direction,3);assert.ok(links.subarray(7*16,7*16+8).includes(2));assert.equal(110+ids[1],110);
  assert.deepEqual(map.subarray(16),TILE_BYTES);assert.deepEqual([map.readUInt16LE(0),map.readUInt16LE(2)],[32,32]);
  assert.deepEqual({x:27+pos[3*20],y:27+pos[3*20+1]},{x:29,y:29});assert.deepEqual([...item(2,1).subarray(10,20)],[5,6,7,8,0,0,0,0,0,0]);assert.equal(item(14,3).readUInt16LE(131*2),0);
  for(const id of [6,7]){const s=skill(id),r=item(10).subarray((id-1)*34,id*34);assert.deepEqual([r[0],r[1],r.readUInt16LE(2),r.readUInt16LE(4),r[6]],[s.aim,s.state,s.power,s.destroy,s.useMp]);assert.deepEqual([...r.subarray(7,12)],s.weather);assert.deepEqual([...r.subarray(12,20)],s.eland);assert.deepEqual([...r.subarray(20,28)],s.oland);assert.deepEqual([...r.subarray(28,34)],s.earm);assert.deepEqual([...item(13).subarray((id-1)*81,id*81)],s.range);}
  return {accepted:true,sourceOnly:true,route:copy(APPROVED_V36_WOOD_ROUTE),nativeWay:3,direction:3,width:32,height:32,tiles:[...TILE_BYTES],mapTilesSha256:MAP_SHA,
    sourceInitialPlayerPosition:{x:29,y:29},sourceTravelMonths:Math.abs(coords[14]-coords[2])+Math.abs(coords[15]-coords[3]),infantryResistance:[...res.subarray(46,92)],
    casterNativeId:132,personIndex:131,sourceLevel:17,sourceOrdinaryMenu:[5,6,7,8],sourceMpFormulaOnly:84,skills:[skill(6),skill(7)],
    sourceNearestMountainHints:[{x:29,y:27},{x:29,y:31}],futureRouteIsHintOnly:true,futureEnemyMovementGuaranteed:false,actualBattleMpObserved:false,
    originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT};
}

export function verifyV36WoodMove({first,second,current,skillId,approvedRoute=APPROVED_V36_WOOD_ROUTE}={}){
  route(approvedRoute);const s=skill(skillId);assert.ok(first&&current?.fight);assert.deepEqual(current.fight,first.fight,'Complete current selected MOVE owner');
  const owner={generation:current.generation,mapId:current.nativeMapId,actorId:132,actorIndex:current.fight.actorIndex,inputSeq:current.fight.inputSeq};
  const checked=verifyOriginalMovePathPair(first,second,owner),p=checked.planning;
  assert.deepEqual([p.mapId,p.fight.cityIndex,p.width,p.height],[110,1,32,32]);library(p.readOnly.library);slots(p.readOnly);assert.equal(hash(Buffer.from(p.tiles)),MAP_SHA,'Exact current map110 tiles');assert.equal(p.readOnly.spe.generation,p.generation);
  assert.deepEqual([p.readOnly.spe.active,p.readOnly.report.active,p.readOnly.result.active,p.readOnly.top.active],[0,0,false,false],'No competing MOVE presentation owner');
  assert.ok(Array.isArray(current.units));const seen=new Set();for(const u of current.units){assert.ok(!seen.has(u.i));seen.add(u.i);bind(p.readOnly.units[u.i],u,'Current MOVE roster');}
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
  return {...checked,current:copy(current),route:copy(approvedRoute),decision:{target:copy(selected),reason,eligibleTargets:copy(selected?eligible(selected.x,selected.y):currentTargets),futureRouteIsHintOnly:true,futureEnemyMovementGuaranteed:false,currentTargetStillRequiresFreshNativeAim:true},
    sourceOnlyPlanning:true,originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT};
}

export function verifyV36WoodFinalAim({first,second,original,target,actor,skillId,casterNativeId,librarySha256,approvedRoute}={}){
  route(approvedRoute);const s=skill(skillId);assert.ok(first&&second&&original&&target&&actor,'Complete actual WOOD AIM proof');assert.equal(casterNativeId,132);assert.equal(librarySha256,LIB.sha256);
  assert.deepEqual(second,first,'Entire readonly AIM pair including keys/world/20 slots/refs/unknown fields');
  const snapshot=first.snapshot,f=snapshot.fight;slots(snapshot);library(snapshot.library);uint(first.keys,0xffffffff,'Current key history');uint(first.generation,0xffffffff,'Current generation');assert.ok(first.generation>0);
  assert.equal(first.generation,original.generation);assert.equal(snapshot.spe.generation,first.generation);assert.deepEqual([first.mapId,f.cityIndex,f.mapW,f.mapH],[110,1,32,32]);
  assert.deepEqual([f.active,f.over,f.wait,f.phase,f.inputKind,f.aimType,f.actorIndex],[1,0,1,3,5,1,actor.i]);uint(f.inputSeq,0xffffffff,'Current native AIM sequence');assert.ok(f.inputSeq>0);
  assert.deepEqual(f,{...original.fight,focusX:f.focusX,focusY:f.focusY},'Full original AIM owner except legal classic cursor focus');
  assert.deepEqual([snapshot.spe.active,snapshot.report.active,snapshot.result.active],[0,0,false],'No active movie/report/result before confirmation');assert.equal(snapshot.top.active,false,'No competing result owner');
  caster(actor,s);uint(target.i,19,'Enemy target slot');assert.ok(target.i>=10);const a=snapshot.units[actor.i],t=snapshot.units[target.i];bind(a,actor,'WOOD caster');bind(t,target,'WOOD target');
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
  return {first,second,skillId,mpRequired:s.useMp,actualConfirmationNotYetSent:true,currentSkillRequiresVerifiedMenu:true,originRequiresVerifiedMarchOrder:true,nativeWayRequiresActualObservation:true,...NO_CREDIT};
}
