import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {APPROVED_V34_NORTH_ROUTE,V34_NORTH_ROUTE_CONTRACT,sourceV34NorthRoute,verifyV34NorthMove,verifyV34NorthFinalAim} from './hd-impact-v34-north-route.mjs';
import {APPROVED_IMPACT13_ROUTE112,verifyImpact13Route112FinalAim} from './hd-impact-route112-final-aim.mjs';

const copy=structuredClone,hash=b=>createHash('sha256').update(b).digest('hex');
const library=fs.readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const source=sourceV34NorthRoute({libBytes:library});
const raw=fs.readFileSync(new URL('./fixtures/hd-impact-v15-west-river-move.json',import.meta.url));
assert.equal(hash(raw),'301150fd0fee566f266209a2d6c394850737a665b7fa61ab401054964d42d919');
const fixture=JSON.parse(raw),terrain=v=>v>15?(v===41?6:7):v>5?2:v>4?3:v>3?4:v>2?5:v>1?0:1;

// The committed genuine V15 snapshot supplies full native field types/shape.
// All north-route coordinates, rosters, MOVE cells and AIM below are explicitly
// controlled data, not actual V34 battle/MOVE/MP/skill/return acceptance.
function moveModel(){
  const first=copy(fixture.input.planning),current=copy(fixture.input.current);
  for(const k of ['path','cells','storageLength','activeGridLength'])delete first[k];
  Object.assign(first.fight,{cityIndex:12,bout:1,focusX:16,focusY:2});
  first.mapId=112;first.tiles=copy(source.tiles);first.pathOrigin={sx:10,sy:0,ux:0,uy:0};
  first.pathStorage=Array(250).fill(255);first.pathStorage[2*15+6]=0;first.pathStorage[3*15+6]=4;first.pathStorage[3*15+7]=1;first.pathStorage[4*15+7]=0;
  first.pathStorage[249]=173;
  first.readOnly.fight=copy(first.fight);
  first.readOnly.futureWorld={orders:[{OrderId:255,Consume:65132,unknown:{preserve:true}}],queueTail:[129,129,65535]};
  const rows=[
    {i:0,id:130,personIndex:129,name:'潘浚',side:'player',x:16,y:2,hp:59,mp:68,move:5,active:0,state:0,belong:1,arms:1910,level:8,iq:72,armType:3},
    {i:10,id:137,personIndex:136,name:'贾华',side:'enemy',x:15,y:14,hp:61,mp:50,move:4,active:0,state:0,belong:2,arms:2970,level:20,iq:36,armType:1},
    {i:11,id:118,personIndex:117,name:'朱治',side:'enemy',x:15,y:15,hp:72,mp:61,move:5,active:0,state:0,belong:2,arms:2380,level:11,iq:56,armType:3},
    {i:12,id:17,personIndex:16,name:'乐进',side:'enemy',x:14,y:14,hp:82,mp:53,move:4,active:0,state:0,belong:2,arms:1840,level:6,iq:42,armType:1},
    {i:13,id:135,personIndex:134,name:'孙浩',side:'enemy',x:16,y:14,hp:44,mp:55,move:5,active:0,state:0,belong:2,arms:1330,level:4,iq:49,armType:0},
  ];
  current.units=rows.map(u=>({...u,terrain:terrain(first.tiles[u.y*32+u.x])}));
  for(const u of current.units){const s=first.readOnly.units[u.i];s.id=u.id;for(const k of ['x','y','hp','mp','move','active','state'])s.position[k]=u[k];s.person=Object.fromEntries(['personIndex','name','arms','belong'].map(k=>[k,u[k]]));}
  current.fight=copy(first.fight);current.nativeMapId=112;current.futureField={untouched:[4,5]};
  return {first,second:copy(first),current,navyResistance:copy(source.navyResistance)};
}
function aimModel(mp=30){
  const m=moveModel(),snapshot=m.first.readOnly;
  Object.assign(snapshot.fight,{phase:3,inputKind:5,aimType:1,inputSeq:103,focusX:17,focusY:4});
  const actor=m.current.units[0],target=m.current.units.find(u=>u.id===17);
  Object.assign(actor,{x:17,y:4,mp,terrain:7});Object.assign(target,{x:18,y:4,terrain:7});
  for(const u of [actor,target])for(const k of ['x','y','hp','mp','move','active','state'])snapshot.units[u.i].position[k]=u[k];
  const values=[0,0,0,0,0,1,0,0,0];
  const first={snapshot,keys:42,generation:3,mapId:112,weather:2,actorTerrain:7,targetTerrain:7,range:{size:3,x:16,y:3,values},futureRoot:{sourceOnly:true}};
  const original={fight:copy(snapshot.fight),generation:3,casterId:130,casterX:17,casterY:4,casterMp:mp,casterState:0,casterActive:0,casterTerrain:7,weather:2,targetId:17,x:18,y:4,state:0,terrain:7,arm:1,size:3,originX:16,originY:3,values:copy(values)};
  return {first,second:copy(first),original,target,actor,approvedRoute:copy(APPROVED_V34_NORTH_ROUTE),casterNativeId:130,librarySha256:snapshot.library.sha256};
}
function stable(value,edit){edit(value.first);value.second=copy(value.first);return value;}
function noCredit(receipt){for(const k of ['actualInputAccepted','actualCastAccepted','actualMovieAccepted','classicNativePixelAccepted','hdAccepted','globalHdComplete','successForecastAccepted'])assert.equal(receipt[k],false,k);}

test('exact original LIB proves north0, adjacent city6→12, map112 and spawn16,2 only as source hints',()=>{
  const before=Buffer.from(library),r=sourceV34NorthRoute({libBytes:library});
  assert.deepEqual(r.route,{originCity:6,destinationCity:12,mapId:112});
  assert.deepEqual([r.direction,r.nativeWay,r.width,r.height,r.sourceTravelMonths],[0,0,32,32,1]);
  assert.deepEqual(r.sourceInitialPlayerPosition,{x:16,y:2});assert.deepEqual(r.eligibleArmRatios,[100,100,100,80,100,100]);
  assert.equal(r.navyResistance.length,46);assert.equal(r.tiles.filter(v=>terrain(v)===7).length,357);
  assert.equal(r.actualBattleMpObserved,false);assert.equal(r.futureEnemyMovementGuaranteed,false);assert.equal(r.futureRouteIsHintOnly,true);
  noCredit(r);assert.deepEqual(library,before);assert.equal(Object.isFrozen(APPROVED_V34_NORTH_ROUTE),true);
  assert.equal(V34_NORTH_ROUTE_CONTRACT.minimumBattleMp,30);assert.match(V34_NORTH_ROUTE_CONTRACT.scope,/current original skill13 menu proof/);
});
test('a different, truncated or one-byte modified library cannot supply north-route authority',()=>{
  const changed=Buffer.from(library);changed[changed.length-1]^=1;
  for(const libBytes of [undefined,[],library.subarray(1),changed])assert.throws(()=>sourceV34NorthRoute({libBytes}));
});
test('full current north MOVE retains all250 bytes,20 slots and unknown world/order tails without mutating inputs',()=>{
  const x=moveModel(),before=copy(x),r=verifyV34NorthMove(x);assert.deepEqual(x,before);
  assert.equal(r.planning.pathStorage.length,250);assert.equal(r.planning.pathStorage[249],173);assert.equal(r.planning.readOnly.units.length,20);
  assert.deepEqual(r.planning.readOnly.futureWorld,x.first.readOnly.futureWorld);assert.deepEqual(r.current,x.current);
  assert.ok(r.decision.target);assert.deepEqual(r.planning.cells.find(c=>c.x===r.decision.target.x&&c.y===r.decision.target.y),r.decision.target);
  assert.equal(r.decision.futureRouteIsHintOnly,true);noCredit(r);
});
test('every fresh MOVE pair catches tail, empty slot, order, queue, references and unknown-field drift',()=>{
  for(const edit of [f=>f.pathStorage[249]++,f=>f.readOnly.units[19].position.x++,f=>f.readOnly.futureWorld.orders[0].unknown.preserve=false,f=>f.readOnly.futureWorld.queueTail[0]++,f=>f.readOnly.references.data++,f=>f.unpublished={value:1}]){
    const x=moveModel();edit(x.second);assert.throws(()=>verifyV34NorthMove(x),/Entire readonly MOVE pair/);
  }
});
test('a route hint never creates a MOVE endpoint absent from the current original grid',()=>{
  const x=moveModel();x.first.pathStorage.fill(255,0,225);x.first.pathStorage[2*15+6]=0;x.second=copy(x.first);
  const r=verifyV34NorthMove(x);assert.equal(r.decision.target,null);assert.equal(r.decision.reason,'no-progressing-current-native-endpoint');noCredit(r);
});
test('stable stale MOVE, changed map tiles, custom resistance and wrong route fail closed',()=>{
  for(const edit of [x=>x.current.fight.inputSeq++,x=>x.current.generation++,x=>x.current.units[0].arms++,x=>{x.first.tiles[0]=x.first.tiles[0]===1?2:1;x.second=copy(x.first);},x=>{x.first.hooks.countMoveRange=true;x.second=copy(x.first);},x=>x.navyResistance[1]--,x=>x.approvedRoute={originCity:16,destinationCity:12,mapId:112}]){const x=moveModel();edit(x);assert.throws(()=>verifyV34NorthMove(x));}
});
test('the north MOVE contract rejects missing, reordered, duplicate or invented native20 slots',()=>{
  for(const edit of [f=>f.readOnly.units.pop(),f=>[f.readOnly.units[18],f.readOnly.units[19]]=[f.readOnly.units[19],f.readOnly.units[18]],f=>f.readOnly.units[19].i=18,f=>f.readOnly.units[19].id=201])assert.throws(()=>verifyV34NorthMove(stable(moveModel(),edit)));
});
test('static MP68 is not a battle requirement: current MP30/31/67/68 all pass actual native AIM checks',()=>{
  for(const mp of [30,31,67,68]){const x=aimModel(mp),before=copy(x),r=verifyV34NorthFinalAim(x);assert.deepEqual(x,before);assert.equal(r.first,x.first);assert.equal(r.actualConfirmationNotYetSent,true);assert.equal(r.currentSkillRequiresVerifiedMenu,true);noCredit(r);}
});
test('actual MP29, or a proof/current-context MP mismatch, cannot spend native30',()=>{
  assert.throws(()=>verifyV34NorthFinalAim(aimModel(29)));
  const a=aimModel();a.original.casterMp++;assert.throws(()=>verifyV34NorthFinalAim(a));
  const b=aimModel();b.actor.mp++;assert.throws(()=>verifyV34NorthFinalAim(b));
});
test('all AIM observations retain full unknown world/order/unit/owner/key/range identity',()=>{
  for(const edit of [f=>f.keys++,f=>f.snapshot.references.data++,f=>f.snapshot.units[19].position.y++,f=>f.snapshot.futureWorld.orders[0].Consume++,f=>f.snapshot.futureWorld.queueTail.pop(),f=>f.futureRoot.sourceOnly=false,f=>f.range.values[8]=1]){const x=aimModel();edit(x.second);assert.throws(()=>verifyV34NorthFinalAim(x),/Entire readonly AIM pair/);}
});
test('classic focus movement is legal while every other original AIM owner field remains bound',()=>{
  const x=stable(aimModel(),f=>{f.snapshot.fight.focusX=18;});assert.doesNotThrow(()=>verifyV34NorthFinalAim(x));
  for(const k of ['inputSeq','bout','phase','aimType','actorIndex','cityIndex']){const y=aimModel();y.original.fight[k]++;assert.throws(()=>verifyV34NorthFinalAim(y));}
  const z=aimModel();z.original.fight.unknownNativeOwner=1;assert.throws(()=>verifyV34NorthFinalAim(z));
});
test('only an actual live enemy slot may be targeted; friendly half, dead/hidden/zero-army targets fail',()=>{
  const a=aimModel();a.target.i=1;assert.throws(()=>verifyV34NorthFinalAim(a));
  const b=aimModel();b.target.side='player';assert.throws(()=>verifyV34NorthFinalAim(b));
  for(const edit of [f=>f.snapshot.units[12].position.hp=0,f=>f.snapshot.units[12].person.arms=0])assert.throws(()=>verifyV34NorthFinalAim(stable(aimModel(),edit)));
  for(const state of [6,8]){const x=aimModel();x.target.state=state;x.original.state=state;stable(x,f=>{f.snapshot.units[12].position.state=state;});assert.throws(()=>verifyV34NorthFinalAim(x));}
});
test('the current player actor remains native130, effective navy, available, alive and eligible level',()=>{
  for(const edit of [x=>x.actor.id++,x=>x.actor.side='enemy',x=>x.actor.armType=1,x=>x.actor.level=6,x=>x.original.casterId++,x=>x.casterNativeId++,x=>x.actor.personIndex++]){const x=aimModel();edit(x);assert.throws(()=>verifyV34NorthFinalAim(x));}
  for(const state of [1,2,6,8]){const x=aimModel();x.actor.state=state;x.original.casterState=state;stable(x,f=>{f.snapshot.units[0].position.state=state;});assert.throws(()=>verifyV34NorthFinalAim(x));}
});
test('actual native terrain7 on both units and Manhattan1 are necessary even when the range bit is1',()=>{
  for(const edit of [x=>x.actor.terrain=3,x=>x.target.terrain=3,x=>x.original.casterTerrain=3,x=>x.original.terrain=3]){const x=aimModel();edit(x);assert.throws(()=>verifyV34NorthFinalAim(x));}
  for(const k of ['actorTerrain','targetTerrain'])assert.throws(()=>verifyV34NorthFinalAim(stable(aimModel(),f=>{f[k]=3;})));
  const x=aimModel();x.target.x=19;x.original.x=19;stable(x,f=>{f.snapshot.units[12].position.x=19;});assert.throws(()=>verifyV34NorthFinalAim(x),/adjacency/);
});
test('AIM authority requires a complete U8 grid and the exact current enemy bit, not static double-river examples',()=>{
  for(const edit of [f=>f.range.values.pop(),f=>f.range.values[0]=256,f=>f.range.size=0,f=>f.range.size=16,f=>f.range.x=-1,f=>f.range.values[5]=0])assert.throws(()=>verifyV34NorthFinalAim(stable(aimModel(),edit)));
  const x=aimModel();x.original.values[5]=0;stable(x,f=>{f.range.values[5]=0;});assert.throws(()=>verifyV34NorthFinalAim(x),/bit authorizes/);
  const y=aimModel();y.original.values[8]=1;assert.throws(()=>verifyV34NorthFinalAim(y));
});
test('original weather1..4 is current and bound; generation/library/active-owner types remain exact',()=>{
  for(const weather of [1,2,3,4]){const x=aimModel();x.original.weather=weather;stable(x,f=>{f.weather=weather;});assert.doesNotThrow(()=>verifyV34NorthFinalAim(x));}
  for(const weather of [0,5]){const x=aimModel();x.original.weather=weather;stable(x,f=>{f.weather=weather;});assert.throws(()=>verifyV34NorthFinalAim(x));}
  for(const edit of [f=>f.generation++,f=>f.snapshot.spe.generation++,f=>f.snapshot.library.sha256='0'.repeat(64),f=>f.snapshot.library.byteLength--,f=>f.snapshot.library.status='loading'])assert.throws(()=>verifyV34NorthFinalAim(stable(aimModel(),edit)));
  for(const [name,values]of [['spe',[false,'0',1]],['report',[false,'0',1]],['result',[0,'false',true]]])for(const value of values)assert.throws(()=>verifyV34NorthFinalAim(stable(aimModel(),f=>{f.snapshot[name].active=value;})));
});
test('the actual AIM still needs all20 slots and their native person bindings',()=>{
  for(const edit of [f=>f.snapshot.units.pop(),f=>f.snapshot.units[19].i=18,f=>f.snapshot.units[0].person.personIndex++,f=>f.snapshot.units[12].id=201,f=>f.snapshot.units[19].position.state=9,f=>f.snapshot.units[19].position.move=256])assert.throws(()=>verifyV34NorthFinalAim(stable(aimModel(),edit)));
});
test('old original13/16 or another destination/map cannot inherit north-route final-AIM permission',()=>{
  for(const route of [null,{originCity:13,destinationCity:12,mapId:112},{originCity:16,destinationCity:12,mapId:112},{originCity:6,destinationCity:1,mapId:110},{originCity:6,destinationCity:12,mapId:112,extra:true}]){const x=aimModel();x.approvedRoute=route;assert.throws(()=>verifyV34NorthFinalAim(x));}
  for(const edit of [f=>f.mapId=110,f=>f.snapshot.fight.cityIndex=1,f=>f.snapshot.fight.mapW=31,f=>f.snapshot.fight.mapH=31])assert.throws(()=>verifyV34NorthFinalAim(stable(aimModel(),edit)));
});
test('the existing original13 fence retains its own scope and rejects new north-route authority',()=>{
  assert.deepEqual(APPROVED_IMPACT13_ROUTE112,{originCity:13,destinationCity:12,mapId:112});
  assert.throws(()=>verifyImpact13Route112FinalAim(aimModel()));
  const old=aimModel();old.approvedRoute=copy(APPROVED_IMPACT13_ROUTE112);
  assert.doesNotThrow(()=>verifyImpact13Route112FinalAim(old));
});
