import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ORIGINAL_MOVE_PATH,ORIGINAL_MOVE_HOOKS,ORIGINAL_MOVE_PATH_READ_EXPRESSION,readOriginalMovePath,verifyOriginalMovePathPair} from './hd-impact-move-path.mjs';

// Controlled data; no saved JSON, ignored build file or live game dependency.
// The owner shape is the real V10 native MOVE shape, but all path bytes here
// are deliberately controlled. V10 did not capture its raw storage length.
const currentFight={active:1,over:0,wait:1,phase:2,aimType:255,inputKind:2,inputSeq:7,actorIndex:0,cityIndex:12,mapW:32,mapH:32,bout:1};
const owner={generation:3,mapId:112,actorId:130,actorIndex:0,inputSeq:7};
function sample(){
  const pathStorage=Array(250).fill(255);pathStorage[2*15+4]=0;pathStorage[2*15+5]=128;pathStorage[2*15+6]=129;
  // Every tail byte would be eligible if it were incorrectly treated as grid.
  pathStorage.fill(0,225);
  const tiles=Array(1024).fill(1);tiles[16]=41;tiles[17]=42;
  return {fight:structuredClone(currentFight),generation:3,mapId:112,actorId:130,width:32,height:32,pathOrigin:{sx:12,sy:0,ux:0,uy:2},pathStorage,tiles,hooks:Object.fromEntries(ORIGINAL_MOVE_HOOKS.map(k=>[k,false])),readOnly:{fight:structuredClone(currentFight),references:{data:1,engine:2,hd:3},world:{year:237,month:2}}};
}
function sameRealmRead(expression,baye,window){return vm.compileFunction('return '+expression,['baye','window'])(baye,window);}
function frozen(value){if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;}
function fixtureRoot(){let at=path.dirname(fileURLToPath(import.meta.url));for(let i=0;i<7;i++){if(fs.existsSync(path.join(at,'vendor/iBaye/src/baye/fight.h')))return at;const parent=path.dirname(at);if(parent===at)break;at=parent;}throw Error('Original checked-in native source root missing');}

test('native source independently specifies250 exposed bytes and225 active cells',()=>{
  const root=fixtureRoot(),read=p=>fs.readFileSync(path.join(root,p),'utf8');
  assert.match(read('vendor/iBaye/src/baye/fight.h'),/#define\s+FGT_MRG\s+15\b/);
  assert.match(read('vendor/iBaye/src/baye/fight.h'),/#define\s+FGT_TILMAX\s+46\b/);
  assert.match(read('vendor/iBaye/src/gamEng.c'),/g_FightPath\s*=\s*gam_malloc\(FGT_MRG\*FGT_MRG\s*\+\s*25\)/);
  assert.match(read('vendor/iBaye/src/bind-objects.c'),/DEFADD_U8ARR\(g_FightPath,\s*FGT_MRG\*FGT_MRG\s*\+\s*25\)/);
  assert.match(read('vendor/iBaye/src/FgtCount.c'),/gam_memset\(g_FightPath,MOV_OVER,FGT_MRG\*FGT_MRG\)/);
  assert.deepEqual([ORIGINAL_MOVE_PATH.storageLength,ORIGINAL_MOVE_PATH.gridLength],[250,225]);
});

test('exact readonly getter reads full public storage while planning uses only first225',()=>{
  const expected=sample(),d={g_MapWid:32,g_MapHgt:32,g_hdSpeGeneration:3,g_FgtParam:{MapId:112,GenArray:[130]},g_PathSX:12,g_PathSY:0,g_PUseSX:0,g_PUseSY:2,g_FightPath:structuredClone(expected.pathStorage),g_FightMapData:structuredClone(expected.tiles)};
  const baye=frozen({data:d,hd:{fight:()=>structuredClone(currentFight)},hooks:{}}),window=frozen({__impactReadSnapshot:()=>structuredClone(expected.readOnly)}),before=structuredClone(d);
  const actual=sameRealmRead(ORIGINAL_MOVE_PATH_READ_EXPRESSION,baye,window);assert.deepEqual(actual,expected);assert.deepEqual(d,before);
  const p=readOriginalMovePath(actual);assert.equal(p.pathStorage.length,250);assert.equal(p.path.length,225);assert.deepEqual(p.pathStorage.slice(225),Array(25).fill(0));assert.deepEqual(p.cells,[{x:16,y:0,pathIndex:34,value:0,rawTile:41,plannedTerrain:6},{x:17,y:0,pathIndex:35,value:128,rawTile:42,plannedTerrain:7}]);
  assert.equal(p.readOnly.references.engine,2);
});

test('truncation, padding and malformed tail bytes fail instead of weakening ABI',()=>{
  for(const n of [0,224,225,249,251,65536]){const s=sample();s.pathStorage=Array(n).fill(255);assert.throws(()=>readOriginalMovePath(s),/exactly250/);}
  for(const value of [-1,256,NaN,.5,undefined]){const s=sample();s.pathStorage[249]=value;assert.throws(()=>readOriginalMovePath(s),/including tail/);}
  const sparse=sample();delete sparse.pathStorage[240];assert.throws(()=>readOriginalMovePath(sparse),/including tail/);
});

test('logical map requires original valid tiles1to45 and exact dimensions',()=>{
  const valid=sample();for(let i=0;i<45;i++)valid.tiles[i]=i+1;assert.equal(readOriginalMovePath(valid).tiles[44],45);
  for(const value of [0,46,255,-1,NaN,1.5]){const s=sample();s.tiles[0]=value;assert.throws(()=>readOriginalMovePath(s),/tile IDs are1..45/);}
  for(const mutate of [s=>s.tiles.pop(),s=>s.tiles.push(1),s=>s.width=0,s=>s.height=256,s=>s.width=31]){const s=sample();mutate(s);assert.throws(()=>readOriginalMovePath(s));}
});

test('stable unrelated or stale owner cannot authorize MOVE planning',()=>{
  assert.equal(verifyOriginalMovePathPair(sample(),sample(),owner).accepted,true);
  for(const [key,value] of [['active',0],['over',1],['wait',0],['phase',1],['inputKind',1],['actorIndex',20],['inputSeq',0],['mapW',31]]){const s=sample();s.fight[key]=value;s.readOnly.fight=structuredClone(s.fight);assert.throws(()=>readOriginalMovePath(s));}
  for(const [key,value] of [['generation',4],['mapId',113],['actorId',118],['actorIndex',1],['inputSeq',8]]){assert.throws(()=>verifyOriginalMovePathPair(sample(),sample(),{...owner,[key]:value}),/Current selected MOVE/);}
  const incoherent=sample();incoherent.readOnly.fight.inputSeq++;assert.throws(()=>readOriginalMovePath(incoherent),/current MOVE owner agree/);
  for(const name of ORIGINAL_MOVE_HOOKS){const s=sample();s.hooks[name]=true;assert.throws(()=>readOriginalMovePath(s),/outside original MOVE scope/);}
});

test('U8 projection and128 threshold match C; tail never creates a cell',()=>{
  const s=sample(),p=readOriginalMovePath(s);assert.deepEqual(p.cells.map(c=>[c.x,c.y,c.value]),[[16,0,0],[17,0,128]]);assert.equal(p.cells.some(c=>c.x===18&&c.y===0),false);
  const edge=sample();edge.pathOrigin={sx:4,sy:3,ux:0,uy:0};edge.pathStorage.fill(255,0,225);edge.pathStorage[0]=128;assert.deepEqual(readOriginalMovePath(edge).cells.map(c=>[c.x,c.y,c.pathIndex]),[[4,3,0]]);
  edge.pathStorage.fill(0,225);assert.deepEqual(readOriginalMovePath(edge).cells.map(c=>[c.x,c.y,c.pathIndex]),[[4,3,0]]);
});

test('fresh pair retains tail, references, world and unknown fields without mutation',()=>{
  const s=sample(),before=structuredClone(s),out=verifyOriginalMovePathPair(s,structuredClone(s),owner);assert.deepEqual(s,before);out.planning.pathStorage[249]=17;out.planning.tiles[0]=45;out.planning.readOnly.references.engine=99;assert.deepEqual(s,before);
  for(const mutate of [s=>s.pathStorage[249]=17,s=>s.readOnly.references.engine++,s=>s.readOnly.world.month++,s=>s.unknownFutureOwner={seq:1},s=>s.pathOrigin.sx++]){const changed=sample();mutate(changed);assert.throws(()=>verifyOriginalMovePathPair(sample(),changed,owner),/Entire readonly MOVE pair/);}
});

test('browser read refuses unavailable dimensions/snapshot without constructing substitute state',()=>{
  assert.throws(()=>sameRealmRead(ORIGINAL_MOVE_PATH_READ_EXPRESSION,{data:{g_MapWid:NaN,g_MapHgt:32},hd:{fight:()=>currentFight}},{}),/dimensions missing/);
  assert.throws(()=>sameRealmRead(ORIGINAL_MOVE_PATH_READ_EXPRESSION,{data:{g_MapWid:32,g_MapHgt:32},hd:{fight:()=>currentFight}},{}),/snapshot missing/);
  const s=sample();for(const k of ['sx','sy','ux','uy']){const bad=structuredClone(s);bad.pathOrigin[k]=-1;assert.throws(()=>readOriginalMovePath(bad));}
});
