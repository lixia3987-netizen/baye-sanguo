import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {planOriginalRiverRoute,ORIGINAL_RIVER_ROUTE_SCOPE} from './hd-impact-river-route.mjs';
import {planOriginalRiverApproach} from './hd-impact-river-approach.mjs';
import {readOriginalMovePath} from './hd-impact-move-path.mjs';
const raw=fs.readFileSync(new URL('./fixtures/hd-impact-v15-west-river-move.json',import.meta.url));
assert.equal(raw.length,15737);assert.equal(createHash('sha256').update(raw).digest('hex'),'301150fd0fee566f266209a2d6c394850737a665b7fa61ab401054964d42d919');
const fixture=JSON.parse(raw),copy=v=>structuredClone(v),run=x=>planOriginalRiverRoute({...x,navyResistance:copy(fixture.originalNavyResistance)});

// Explicit controlled native snapshots. They model no game input or future AI.
function model({width=9,height=5,water=[[6,2],[6,3]],positions={},live72=false,legal=[[1,2,0],[2,2,3],[3,2,1]],tileEdits=[]}={}){
 const x=copy(fixture.input),p=x.planning,c=x.current;
 p.width=width;p.height=height;p.tiles=Array(width*height).fill(1);
 for(const [a,b]of water)p.tiles[b*width+a]=17;
 for(const [a,b,v]of tileEdits)p.tiles[b*width+a]=v;
 const pos={130:[1,2],149:[8,4],150:[7,2],72:[8,3],...positions};
 const terrain=v=>v>15?(v===41?6:7):v>5?2:v>4?3:v>3?4:v>2?5:v>1?0:1;
 for(const u of c.units){[u.x,u.y]=pos[u.id];assert.ok(u.x>=0&&u.x<width&&u.y>=0&&u.y<height);u.terrain=terrain(p.tiles[u.y*width+u.x]);
  if(u.id===149||u.id===72&&!live72){u.state=8;u.hp=0;u.arms=0;}else{u.state=0;u.hp=59;u.active=0;}
  const r=p.readOnly.units[u.i];for(const k of ['x','y','hp','mp','move','active','state'])r.position[k]=u[k];for(const k of ['arms','belong','personIndex','name'])r.person[k]=u[k];
 }
 p.fight.mapW=width;p.fight.mapH=height;p.readOnly.fight=copy(p.fight);c.fight=copy(p.fight);c.mapWidth=width;c.mapHeight=height;
 p.pathOrigin={sx:0,sy:0,ux:0,uy:0};p.pathStorage=Array(250).fill(255);for(const [a,b,v]of legal)p.pathStorage[b*15+a]=v;
 x.planning=readOriginalMovePath(p);return x;
}
function isFreshCell(input,target){assert.deepEqual(input.planning.cells.find(c=>c.x===target.x&&c.y===target.y),target);}
function noCredit(d){for(const k of ['actualInputAccepted','actualCastAccepted','hdAccepted'])assert.equal(d[k],false);assert.equal(d.futureRouteIsHintOnly,true);}

test('genuine V15 bout4 observation: old west-bay hold becomes legal land staging on an east-river route, controlled only',()=>{
 const input=copy(fixture.input),before=copy(input),old=planOriginalRiverApproach(input),d=run(input);
 assert.deepEqual([old.target.x,old.target.y],[4,21]);assert.deepEqual([fixture.oldActualEndpoint.x,fixture.oldActualEndpoint.y],[4,21]);
 assert.deepEqual([d.target.x,d.target.y,d.target.plannedTerrain],[4,19,0]);isFreshCell(input,d.target);assert.equal(d.reason,'native-land-staging-between-rivers');
 assert.deepEqual(d.routeHint.goal.actorRiver,{x:12,y:20});assert.deepEqual([d.routeHint.actorCostAtStart,d.routeHint.actorCostAfterEndpoint,d.routeHint.weightedProgress],[14,10,4]);
 assert.deepEqual(d.routeHint.goal.enemyRiver,{x:12,y:21});assert.ok(d.routeHint.goal.actorRiver.x===12);assert.ok(d.routeHint.weightedProgress>0);assert.equal(d.routeHint.futureNativeReachabilityAccepted,false);noCredit(d);assert.deepEqual(input,before);
});
test('original entry costs: grass2 and river1 produce cost10 and legal land progress',()=>{
 const x=model(),d=run(x);assert.deepEqual([d.target.x,d.target.y],[3,2]);assert.equal(d.routeHint.actorCostAtStart,10);assert.equal(d.routeHint.actorCostAfterEndpoint,6);assert.equal(d.routeHint.weightedProgress,4);isFreshCell(x,d.target);noCredit(d);
});
test('original mountain cost3 changes whole-route cost without changing resistance bytes',()=>{
 const x=model({tileEdits:[[2,2,5]],legal:[[1,2,0],[2,2,2]]}),d=run(x);assert.equal(d.routeHint.actorCostAtStart,11);assert.deepEqual([d.target.x,d.target.y],[2,2]);isFreshCell(x,d.target);
});
test('a live occupied fresh endpoint is never selected; route may use a later unoccupied detour',()=>{
 const x=model({positions:{72:[3,2]},live72:true}),d=run(x);assert.ok(d.target);assert.notDeepEqual([d.target.x,d.target.y],[3,2]);assert.deepEqual([d.target.x,d.target.y],[2,2]);isFreshCell(x,d.target);
});
test('a full-map live blocker separates every river pair: no invented crossing',()=>{
 const x=model({width:9,height:1,water:[[5,0],[6,0]],positions:{130:[1,0],149:[8,0],150:[7,0],72:[4,0]},live72:true,legal:[[1,0,0],[2,0,3],[3,0,1]]}),d=run(x);
 assert.equal(d.target,null);assert.equal(d.reason,'no-reachable-river-contact-pair');noCredit(d);
});
test('no adjacent river pair returns pending with no endpoint',()=>{const d=run(model({water:[]}));assert.equal(d.target,null);assert.equal(d.reason,'no-reachable-river-contact-pair');});
test('all living enemies on Castle stop immediately; no idle-turn promise',()=>{
 const x=model({tileEdits:[[7,2,3]]}),d=run(x);assert.equal(d.target,null);assert.equal(d.reason,'all-live-enemies-on-castle');noCredit(d);
});
test('current real adjacent river enemy may keep our current legal river cell for separate AIM checks',()=>{
 const x=model({water:[[1,2],[2,2]],positions:{150:[2,2]}}),d=run(x);assert.deepEqual([d.target.x,d.target.y],[1,2]);assert.equal(d.reason,'current-native-river-contact');assert.equal(d.routeHint.futurePredictionRequired,false);noCredit(d);
});
test('future attractive route does not create an unavailable native endpoint',()=>{
 const x=model({legal:[[1,2,0]]}),d=run(x);assert.equal(d.target,null);assert.equal(d.reason,'no-progressing-current-native-endpoint');noCredit(d);
});
test('source objects and original46-byte row remain unchanged',()=>{
 const x=model(),row=copy(fixture.originalNavyResistance),before=copy(x),r0=copy(row);planOriginalRiverRoute({...x,navyResistance:row});assert.deepEqual(x,before);assert.deepEqual(row,r0);
});
test('strictly reject missing/truncated/replaced original cost row',()=>{
 for(const row of [undefined,fixture.originalNavyResistance.slice(1),fixture.originalNavyResistance.map((v,i)=>i===1?129:v)])assert.throws(()=>planOriginalRiverRoute({...model(),navyResistance:row}));
});
test('old complete validation still rejects unrelated MOVE owner and custom hooks',()=>{
 const a=model();a.current.fight.inputSeq++;assert.throws(()=>run(a));const b=model();b.planning.hooks.countLandResistance=true;assert.throws(()=>run(b));
});
test('corrupted full250 tail/read-only person/unknown owner fields are not normalized away',()=>{
 const a=model();a.planning.pathStorage.pop();assert.throws(()=>run(a));const b=model();b.planning.readOnly.units[0].person.arms--;assert.throws(()=>run(b));const c=model();c.current.fight.unreviewedField=1;assert.throws(()=>run(c));
});
test('deterministic static decision and explicit source-only scope',()=>{
 const x=model();assert.deepEqual(run(x),run(x));assert.equal(ORIGINAL_RIVER_ROUTE_SCOPE.pathStorage,250);assert.equal(ORIGINAL_RIVER_ROUTE_SCOPE.actualInputAccepted,false);assert.equal(ORIGINAL_RIVER_ROUTE_SCOPE.futureRouteIsHintOnly,true);
});
