import assert from 'node:assert/strict';

// Original native ABI: fight.h FGT_MRG=15, gamEng.c allocates 225+25,
// bind-objects.c exposes all 250 bytes. Only the first 225 form the path grid.
export const ORIGINAL_MOVE_PATH = Object.freeze({side:15,gridLength:225,storageLength:250,tileLimit:46,maxMapDimension:255});
export const ORIGINAL_MOVE_HOOKS = Object.freeze(['drawMapUnit','getTerrainInfo','loadFightMap','countMoveRange','countLandResistance']);

// Read only. The caller must already have installed its read-only observation
// snapshot. This expression sends no input and writes no game or UI state.
export const ORIGINAL_MOVE_PATH_READ_EXPRESSION = "(() => {\n  const d=baye.data,f=baye.hd.fight(),width=Number(d.g_MapWid),height=Number(d.g_MapHgt);\n  if(!Number.isInteger(width)||width<1||width>255||!Number.isInteger(height)||height<1||height>255)throw Error('Original MOVE dimensions missing');\n  if(typeof window.__impactReadSnapshot!=='function')throw Error('Original MOVE read-only snapshot missing');\n  return {fight:f,generation:Number(d.g_hdSpeGeneration),mapId:Number(d.g_FgtParam.MapId),actorId:Number(d.g_FgtParam.GenArray[f.actorIndex]),width,height,\n    pathOrigin:{sx:Number(d.g_PathSX),sy:Number(d.g_PathSY),ux:Number(d.g_PUseSX),uy:Number(d.g_PUseSY)},\n    pathStorage:Array.from(d.g_FightPath,Number),tiles:Array.from({length:width*height},(_,i)=>Number(d.g_FightMapData[i])),\n    hooks:Object.fromEntries(['drawMapUnit','getTerrainInfo','loadFightMap','countMoveRange','countLandResistance'].map(k=>[k,!!(baye.hooks&&baye.hooks[k])])),\n    readOnly:window.__impactReadSnapshot()};\n})()";

function integer(value,min,max,label){assert.ok(Number.isInteger(value)&&value>=min&&value<=max,label);}
function terrain(raw){
  // FightSub.c FgtGetTerrain: zero is invalid; 41 is tent, other >15 river.
  return raw>15?(raw===41?6:7):raw>5?2:raw>4?3:raw>3?4:raw>2?5:raw>1?0:1;
}

/** Validate one complete original MOVE read and derive its logical 15x15 grid.
 * The complete 250-byte storage, including its 25-byte tail, remains in output.
 * Tail bytes are not cells and are never discarded from freshness comparison.
 */
export function readOriginalMovePath(snapshot){
  assert.ok(snapshot&&typeof snapshot==='object','Complete original MOVE snapshot required');
  const {fight:f,width,height,pathOrigin:p,pathStorage,tiles,hooks,readOnly}=snapshot;
  assert.ok(f&&p&&hooks&&readOnly,'Complete MOVE owner/origin/hooks/read-only references required');
  assert.deepEqual([f.active,f.over,f.wait,f.phase,f.inputKind],[1,0,1,2,2],'Only current original native MOVE owner');
  integer(f.actorIndex,0,19,'Current MOVE actor index');
  integer(f.inputSeq,1,0xffffffff,'Current MOVE input sequence');
  integer(snapshot.actorId,1,0xfffd,'Current native MOVE actor identity');
  integer(snapshot.generation,0,0xffffffff,'Current native generation');
  integer(snapshot.mapId,1,0xffff,'Current native map identity');
  integer(width,1,ORIGINAL_MOVE_PATH.maxMapDimension,'Original map width');
  integer(height,1,ORIGINAL_MOVE_PATH.maxMapDimension,'Original map height');
  assert.deepEqual([f.mapW,f.mapH],[width,height],'Native MOVE dimensions agree with current map');
  assert.deepEqual(readOnly.fight,f,'Read-only snapshot and current MOVE owner agree');
  for(const name of ORIGINAL_MOVE_HOOKS)assert.equal(hooks[name],false,'Custom '+name+' is outside original MOVE scope');
  assert.ok(Array.isArray(pathStorage),'Complete native path storage required');
  assert.equal(pathStorage.length,ORIGINAL_MOVE_PATH.storageLength,'Original public path storage is exactly250; no truncation/padding');
  for(const v of pathStorage)integer(v,0,255,'Every path storage byte, including tail, is U8');
  assert.ok(Array.isArray(tiles),'Complete logical native map required');
  assert.equal(tiles.length,width*height,'All logical native map tiles required');
  for(const v of tiles)integer(v,1,ORIGINAL_MOVE_PATH.tileLimit-1,'Original tile IDs are1..45; zero/unknown are invalid');
  for(const k of ['sx','sy','ux','uy'])integer(p[k],0,255,'Native U8 path origin '+k);
  assert.ok(p.sx<width&&p.sy<height&&p.ux<15&&p.uy<15,'Original path projection belongs to current map/grid');
  const path=pathStorage.slice(0,ORIGINAL_MOVE_PATH.gridLength),cells=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    // Fight.c FgtGenMove assigns these expressions to U8 before the range test.
    const px=(x-p.sx+p.ux)&255,py=(y-p.sy+p.uy)&255;
    if(px>=15||py>=15)continue;
    const pathIndex=py*15+px,value=path[pathIndex];
    if(value<=128)cells.push({x,y,pathIndex,value,rawTile:tiles[y*width+x],plannedTerrain:terrain(tiles[y*width+x])});
  }
  return {...structuredClone(snapshot),path,cells,storageLength:pathStorage.length,activeGridLength:path.length};
}

/** A final pair is complete and equal, including unknown fields and tail bytes.
 * Explicit selected-actor context prevents a stable but unrelated MOVE owner.
 */
export function verifyOriginalMovePathPair(before,after,owner){
  assert.deepEqual(after,before,'Entire readonly MOVE pair must remain equal, including path tail/world/references/unknown fields');
  assert.ok(owner&&typeof owner==='object','Explicit current selected MOVE owner required');
  const planning=readOriginalMovePath(before);
  for(const k of ['generation','mapId','actorId'])assert.equal(before[k],owner[k],'Current selected MOVE '+k);
  for(const k of ['actorIndex','inputSeq'])assert.equal(before.fight[k],owner[k],'Current selected MOVE '+k);
  return {accepted:true,owner:structuredClone(owner),planning};
}
