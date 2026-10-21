import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readOriginalMovePath,verifyOriginalMovePathPair} from './hd-impact-move-path.mjs';
import {planOriginalRiverApproach} from './hd-impact-river-approach.mjs';

// Original map bytes are read afresh. Unit deployment is a small recorded V10
// first-PICK hint (result145278594/a0b56ac2... /combatStart); no old result is
// read by this standalone suite. Every MOVE owner/path/bout below is CONTROLLED,
// not an actual native capture, UI input, campaign or Impact13 acceptance.
const lib=fs.readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
assert.equal(createHash('sha256').update(lib).digest('hex'),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
function item(id,index){
  const at=lib.readUInt32LE((id-1)*4),length=lib.readUInt32LE(at),count=lib.readUInt16LE(at+6),fixed=lib.readUInt32LE(at+8);
  assert.ok(index<count);const offset=fixed?14+index*fixed:count===1?14:lib.readUInt32LE(at+14+index*8),size=fixed||(count===1?length-14:lib.readUInt32LE(at+18+index*8));return lib.subarray(at+offset,at+offset+size);
}
const map=item(112,0),tiles=Array.from(map.subarray(16)),navy=Array.from(item(2,2).subarray(3*46,4*46)),clone=structuredClone,ratios=[100,100,100,80,100,100];
const ter=t=>t>15?(t===41?6:7):t>5?2:t>4?3:t>3?4:t>2?5:t>1?0:1;
const historic=[
 {i:0,id:130,personIndex:129,name:'潘浚',side:'player',x:16,y:2,hp:59,mp:67,move:5,active:0,state:0,belong:1,arms:1810,level:7,iq:72,armType:3},
 {i:10,id:137,personIndex:136,name:'贾华',side:'enemy',x:15,y:14,hp:78,mp:51,move:4,active:0,state:0,belong:2,arms:2970,level:20,iq:36,armType:1},
 {i:11,id:118,personIndex:117,name:'朱治',side:'enemy',x:15,y:15,hp:84,mp:59,move:5,active:0,state:0,belong:2,arms:2280,level:11,iq:56,armType:3},
 {i:12,id:17,personIndex:16,name:'乐进',side:'enemy',x:14,y:14,hp:83,mp:43,move:4,active:0,state:0,belong:2,arms:1840,level:6,iq:42,armType:1},
 {i:13,id:135,personIndex:134,name:'孙浩',side:'enemy',x:16,y:14,hp:53,mp:46,move:5,active:0,state:0,belong:2,arms:1330,level:4,iq:49,armType:0}
];
function fixture({actor={},enemies=historic.slice(1),friends=[],mapTiles=tiles,bout=1}={}){
  const units=[{...historic[0],...actor},...clone(enemies),...clone(friends)].map(u=>({...u,terrain:ter(mapTiles[u.y*32+u.x])}));
  const a=units[0],fight={active:1,over:0,wait:1,phase:2,inputKind:2,inputSeq:7+bout-1,actorIndex:0,mapW:32,mapH:32,cityIndex:12,bout};
  const pathOrigin={sx:Math.max(0,a.x+1-5),sy:Math.max(0,a.y+1-5),ux:Math.max(0,5-a.x-1),uy:Math.max(0,5-a.y-1)};
  // Independent small positive-cost four-neighbour model for native-shaped
  // test data. Exact-cost5 is intentionally unreachable (FgtUnfurlTree837/846).
  // This is not asserted to reproduce enemy-ZOC or every original path byte.
  const costs=Array(1024).fill(Infinity),buckets=Array.from({length:5},()=>[]),blocked=new Set(units.slice(1).filter(u=>u.arms>0&&u.state!==8).map(u=>u.x+','+u.y));costs[a.y*32+a.x]=0;buckets[0].push({x:a.x,y:a.y});
  for(let cost=0;cost<5;cost++)for(const v of buckets[cost]){
    if(costs[v.y*32+v.x]!==cost)continue;
    for(const [x,y]of [[v.x-1,v.y],[v.x+1,v.y],[v.x,v.y-1],[v.x,v.y+1]])if(x>=0&&y>=0&&x<32&&y<32&&!blocked.has(x+','+y)){
      const next=cost+navy[mapTiles[y*32+x]]-128;
      if(next>cost&&next<5&&next<costs[y*32+x]){costs[y*32+x]=next;buckets[next].push({x,y});}
    }
  }
  const pathStorage=Array(250).fill(255);for(let i=225;i<250;i++)pathStorage[i]=(i*3)&255;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const px=(x-pathOrigin.sx+pathOrigin.ux)&255,py=(y-pathOrigin.sy+pathOrigin.uy)&255,c=costs[y*32+x];
    if(px<15&&py<15&&c<5)pathStorage[py*15+px]=(x===a.x&&y===a.y)?0:5-c;
  }
  const observed=Array.from({length:20},(_,i)=>{const u=units.find(u=>u.i===i);return u?{i,id:u.id,position:Object.fromEntries(['x','y','hp','mp','move','active','state'].map(k=>[k,u[k]])),person:Object.fromEntries(['personIndex','name','arms','belong'].map(k=>[k,u[k]]))}:{i,id:0,position:{x:0,y:0,hp:0,mp:0,move:0,active:0,state:8},person:null};});
  const raw={fight:clone(fight),generation:3,mapId:112,actorId:130,width:32,height:32,pathOrigin,pathStorage,tiles:mapTiles.slice(),hooks:Object.fromEntries(['drawMapUnit','getTerrainInfo','loadFightMap','countMoveRange','countLandResistance'].map(k=>[k,false])),readOnly:{fight:clone(fight),units:observed,references:{data:1,engine:2,hd:3},unknown:{preserved:true}}};
  const current={fight,generation:3,nativeMapId:112,mapWidth:32,mapHeight:32,units};return {raw,planning:readOriginalMovePath(raw),current,actorId:130,eligibleArmRatios:ratios.slice()};
}
const run=f=>planOriginalRiverApproach(f),belongs=(f,t)=>assert.ok(f.planning.cells.some(c=>JSON.stringify(c)===JSON.stringify(t)),'Target must be an exact actual planning cell');
const owner=f=>({generation:3,mapId:112,actorId:130,actorIndex:0,inputSeq:f.raw.fight.inputSeq});
function noCredit(v){assert.equal(v.actualInputAccepted,false);assert.equal(v.actualCastAccepted,false);assert.equal(v.hdAccepted,false);}

test('Original map112 and recorded first-PICK deployment remain source-only/controlled',()=>{
  assert.equal(map.length,1040);assert.equal(createHash('sha256').update(map).digest('hex'),'d631fee02389fd321203ebdf6e0e9960eb62172495cef7171a61b8f9525f4053');
  const f=fixture();assert.deepEqual(f.current.units.map(u=>[u.id,u.x,u.y,u.terrain]),[[130,16,2,3],[137,15,14,5],[118,15,15,3],[17,14,14,3],[135,16,14,3]]);
  assert.equal(tiles.filter(t=>ter(t)===7).length,357);assert.equal(f.current.units[0].mp,67);
});
test('Strict cost5 deadlock is escaped by a native legal land stage',()=>{
  const f=fixture();assert.equal(navy[tiles[3*32+16]]-128,2);assert.equal(navy[tiles[4*32+16]]-128,2);assert.equal(navy[tiles[5*32+16]]-128,1);
  assert.equal(f.planning.cells.filter(c=>c.plannedTerrain===7).length,0,'Old river-only selector would Rest forever');
  const v=run(f);noCredit(v);assert.equal(v.reason,'land-staging-toward-valuable-river');assert.ok(v.target);assert.notEqual(v.target.plannedTerrain,7);assert.ok(v.heuristicAfter<v.heuristicBefore);assert.notDeepEqual([v.target.x,v.target.y],[16,2]);belongs(f,v.target);
});
test('Two native-shaped stages reach river without inventing a first-turn water endpoint',()=>{
  const first=run(fixture());assert.notEqual(first.target.plannedTerrain,7);
  const f=fixture({actor:{x:first.target.x,y:first.target.y},bout:2}),second=run(f);noCredit(second);assert.equal(second.target.plannedTerrain,7);assert.equal(second.reason,'river-approach-mobile-enemy');belongs(f,second.target);
});
test('Actual river plus adjacent eligible river enemy takes priority and never grants cast credit',()=>{
  const enemy={...historic[2],x:17,y:5},f=fixture({actor:{x:16,y:5},enemies:[enemy]}),v=run(f);noCredit(v);assert.equal(v.reason,'ready-river-adjacency');assert.deepEqual([v.target.x,v.target.y],[16,5]);assert.equal(v.skillStillRequiresFreshNativeMenuAIMWeatherMP,true);belongs(f,v.target);
});
test('All living enemies on Castle return no target, rather than blind waiting',()=>{const v=run(fixture({enemies:[historic[1]]}));noCredit(v);assert.equal(v.target,null);assert.equal(v.reason,'all-live-enemies-on-castle');});
test('Other living units cannot be selected even if a controlled path byte admits their tile',()=>{
  const friend={...historic[0],i:1,id:52,personIndex:51,name:'受控友将',x:16,y:6},f=fixture({actor:{x:16,y:5},friends:[friend]});
  const x=(friend.x-f.raw.pathOrigin.sx+f.raw.pathOrigin.ux)&255,y=(friend.y-f.raw.pathOrigin.sy+f.raw.pathOrigin.uy)&255;f.raw.pathStorage[y*15+x]=1;f.planning=readOriginalMovePath(f.raw);
  assert.ok(f.planning.cells.some(c=>c.x===16&&c.y===6));const v=run(f);assert.ok(v.target);assert.notDeepEqual([v.target.x,v.target.y],[16,6]);belongs(f,v.target);
});
test('A map with no adjacent river pair and zero eligible ratios both stop explicitly',()=>{
  const dry=fixture({mapTiles:Array(1024).fill(1)});assert.equal(run(dry).reason,'no-adjacent-river-pair-in-map');
  const f=fixture();f.eligibleArmRatios.fill(0);assert.equal(run(f).reason,'no-eligible-mobile-enemy');
});
test('Complete storage and freshness remain a caller-proven pair, including the unused tail',()=>{
  const f=fixture();assert.equal(verifyOriginalMovePathPair(f.raw,clone(f.raw),owner(f)).accepted,true);
  for(const change of [s=>s.pathStorage[249]^=1,s=>s.readOnly.unknown.preserved=false,s=>s.fight.inputSeq++]){const after=clone(f.raw);change(after);assert.throws(()=>verifyOriginalMovePathPair(f.raw,after,owner(f)));}
  assert.throws(()=>verifyOriginalMovePathPair(f.raw,clone(f.raw),{...owner(f),inputSeq:999}));
});
test('Planner rejects malformed tails, forged derived cells and stale full owner/unit bindings',()=>{
  const changes=[f=>f.planning.pathStorage.pop(),f=>f.planning.pathStorage[249]=256,f=>f.planning.cells[0].x++,f=>f.current.fight.inputSeq++,f=>f.current.generation++,f=>f.current.nativeMapId++,f=>f.current.mapWidth++,f=>f.current.units[0].x++,f=>f.current.units.pop(),f=>f.current.units[0].side='enemy',f=>f.current.units[0].armType=0,f=>f.eligibleArmRatios.pop()];
  for(const change of changes){const f=fixture();change(f);assert.throws(()=>run(f));}
});
test('No native hook bypass and no mutation of complete caller evidence',()=>{
  const f=fixture(),before=clone(f);run(f);assert.deepEqual(f,before);
  const bad=fixture();bad.planning.hooks.countMoveRange=true;assert.throws(()=>run(bad));
});
