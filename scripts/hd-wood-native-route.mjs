// Pure, bounded original-ROM route facts. No world, native input, mutation or RNG.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const LIB={bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'};
const MAP_SHA={110:'d85fb46a63873b8f86ac10088b7e654e903c96d361813e87c2bc70e27bc46e1c',111:'0e2d67577232e7c89f4aa64367e707813ab629719fd87844f9a92dbdb4a7bb2b',112:'2becb0f6e54a237b67bda8f5dea3abcfd5f021bfe4afa0f5b2e1d87b4ba22a31'};
const reviewed=new Set(['7:1','16:15','16:12','4:10']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const uint=(n,max,label)=>assert.ok(Number.isInteger(n)&&n>=0&&n<=max,label);
function terrain(raw){return raw>15?(raw===41?6:7):raw>5?2:raw===5?3:raw===4?4:raw===3?5:raw===2?0:raw===1?1:255;}
function item(b,id,index=0){
 const base=b.readUInt32LE((id-1)*4),length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);assert.equal(b.readUInt16LE(base+4),id);assert.ok(index<count&&base+length<=b.length);
 const offset=fixed?14+fixed*index:count===1?14:b.readUInt32LE(base+14+index*8),size=fixed||(count===1?length-14:b.readUInt32LE(base+18+index*8));assert.ok(offset>=14&&size>0&&offset+size<=length);return b.subarray(base+offset,base+offset+size);
}
function attackerBase(way,width,height){
 let x=width-5,y=height-5;
 switch(way){case 0:x=(width>>1)-2;y=0;break;case 1:y=2;break;case 2:y=(height>>1)-2;break;case 3:break;case 4:x=(width>>1)-2;break;case 5:x=2;break;case 6:x=2;y=(height>>1)-2;break;case 7:x=0;y=0;break;default:assert.fail('Original direction must be0..7');}
 return{x,y};
}
export function sourceOriginalWoodRoute(options={}){
 assert.ok(options&&typeof options==='object'&&!Array.isArray(options));
 assert.deepEqual(Object.keys(options).sort(),['destination','libBytes','origin'],'Only original LIB and city IDs; caller cannot supply coordinates/Way/map/spawn');
 const {libBytes,origin,destination}=options;assert.ok(Buffer.isBuffer(libBytes)||libBytes instanceof Uint8Array,'Complete original LIB bytes');
 const b=Buffer.from(libBytes.buffer,libBytes.byteOffset,libBytes.byteLength);assert.deepEqual([b.length,sha(b)],[LIB.bytes,LIB.sha256],'Exact original LIB identity');
 uint(origin,37,'Original origin city0..37');uint(destination,37,'Original destination city0..37');assert.notEqual(origin,destination,'Different origin and destination');
 const links=item(b,59),coordinates=item(b,2,5),mapIds=item(b,2,14),positions=item(b,2,4);assert.deepEqual([links.length,coordinates.length,mapIds.length,positions.length],[608,76,38,180]);
 const neighbors=[...links.subarray(origin*16,origin*16+8)].filter(Boolean).map(v=>v-1);assert.ok(neighbors.includes(destination),'Original AttackCityRoad requires direct first8 ROM adjacency');
 const mapId=110+mapIds[destination];assert.ok(Object.hasOwn(MAP_SHA,mapId),'Only reviewed original WOOD maps110/112 plus111 for reviewed4to10; other maps need separate evidence');
 assert.ok(reviewed.has(origin+':'+destination),'Only the explicitly reviewed original WOOD routes');
 const nativeWay=[...links.subarray(destination*16,destination*16+8)].indexOf(origin+1);assert.ok(nativeWay>=0&&nativeWay<8,'Original GetDirect(destination,origin) reverse edge');
 const originPosition={x:coordinates[origin*2],y:coordinates[origin*2+1]},destinationPosition={x:coordinates[destination*2],y:coordinates[destination*2+1]},timeCount=Math.abs(originPosition.x-destinationPosition.x)+Math.abs(originPosition.y-destinationPosition.y);
 assert.ok(timeCount>0&&timeCount<255);const map=item(b,mapId),width=map.readUInt16LE(0),height=map.readUInt16LE(2),tiles=[...map.subarray(16)];assert.deepEqual([width,height,tiles.length,sha(Buffer.from(tiles))],[32,32,1024,MAP_SHA[mapId]],'Original reviewed map dimensions and every tile');
 const firstCity=tiles.indexOf(3);assert.ok(firstCity>=0);const cityTile={x:firstCity%width,y:Math.floor(firstCity/width)},base=attackerBase(nativeWay,width,height),defenderBase={x:cityTile.x-2,y:cityTile.y-2};
 const at=(x,y)=>terrain(tiles[y*width+x]),sourceInitialPlayerPosition={x:base.x+positions[nativeWay*20],y:base.y+positions[nativeWay*20+1]};
 const sourceInitialDefenderPositions=Array.from({length:10},(_,i)=>{const x=defenderBase.x+positions[8*20+i*2],y=defenderBase.y+positions[8*20+i*2+1];return{i:i+10,x,y,terrain:at(x,y)};});
 const sourceNearestCasterTerrainHints=tiles.flatMap((raw,index)=>[2,5].includes(terrain(raw))?[{x:index%width,y:Math.floor(index/width),terrain:terrain(raw)}]:[]).map(p=>({...p,manhattanDistance:Math.abs(p.x-sourceInitialPlayerPosition.x)+Math.abs(p.y-sourceInitialPlayerPosition.y)})).sort((a,b)=>a.manhattanDistance-b.manhattanDistance||a.y-b.y||a.x-b.x).slice(0,4);
 const skillConditions=[6,7].map(id=>{const s=item(b,10).subarray((id-1)*34,id*34);return{id,aim:s[0],state:s[1],power:s.readUInt16LE(2),destroy:s.readUInt16LE(4),useMp:s[6],weather:[...s.subarray(7,12)],eland:[...s.subarray(12,20)],oland:[...s.subarray(20,28)],earm:[...s.subarray(28,34)],range:[...item(b,13).subarray((id-1)*81,id*81)]};});
 assert.deepEqual(skillConditions.map(s=>[s.id,s.useMp,s.oland]),[[6,20,[0,0,100,0,0,100,0,0]],[7,25,[0,0,100,0,0,100,0,0]]]);
 return{accepted:true,sourceOnly:true,library:{status:'ready',byteLength:LIB.bytes,sha256:LIB.sha256},origin,destination,route:{originCity:origin,destinationCity:destination,mapId},mapId,nativeWay,direction:nativeWay,timeCount,originPosition,destinationPosition,width,height,tiles,mapTilesSha256:MAP_SHA[mapId],sourceAttackMode:1,sourceInitialPlayerPosition,sourceInitialPlayerTerrain:at(sourceInitialPlayerPosition.x,sourceInitialPlayerPosition.y),sourceInitialDefenderPositions,sourceCityTile:cityTile,sourceNearestCasterTerrainHints,skillConditions,sourceMinimumEndCount:1,timeCountIsNotMonthsToWait:true,currentOwnedWorldRequired:true,currentNativeModeWayMapAndFull20SlotsRequired:true,currentNativeMovePathRequired:true,currentVerifiedMenuAndMpRequired:true,currentTargetTerrainAndRangeRequired:true,futureEnemyMovementGuaranteed:false,actualInputAccepted:false,actualMarchAccepted:false,actualBattleAccepted:false,actualCastAccepted:false,actualMovieAccepted:false,classicNativePixelAccepted:false,hdAccepted:false,globalHdComplete:false,rngContinuityAccepted:false};
}
