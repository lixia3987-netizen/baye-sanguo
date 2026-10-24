import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {sourceOriginalWoodRoute} from './hd-wood-native-route.mjs';
const lib=fs.readFileSync('libs/dat-mod.lib'),run=(origin=16,destination=15,more={})=>sourceOriginalWoodRoute({libBytes:lib,origin,destination,...more});
test('native7 to1 retains actual reverse Way3 and south-east spawn',()=>{const r=run(7,1);assert.deepEqual([r.route,r.nativeWay,r.timeCount,r.originPosition,r.destinationPosition,r.sourceInitialPlayerPosition],[{originCity:7,destinationCity:1,mapId:110},3,2,{x:10,y:1},{x:9,y:0},{x:29,y:29}]);});
test('native16 to15 derives Way2 and east-edge spawn from both ROM resources',()=>{const r=run();assert.deepEqual([r.route,r.nativeWay,r.timeCount,r.originPosition,r.destinationPosition,r.sourceInitialPlayerPosition],[{originCity:16,destinationCity:15,mapId:110},2,1,{x:8,y:3},{x:7,y:3},{x:29,y:16}]);assert.deepEqual([r.sourceInitialDefenderPositions.length,r.sourceInitialDefenderPositions[0]],[10,{i:10,x:15,y:15,terrain:5}]);});
test('both routes bind identical complete map110 but distinct real spawn geometry',()=>{const a=run(),b=run(7,1);assert.deepEqual(a.tiles,b.tiles);assert.equal(a.tiles.length,1024);assert.equal(createHash('sha256').update(Buffer.from(a.tiles)).digest('hex'),a.mapTilesSha256);assert.notDeepEqual(a.sourceInitialPlayerPosition,b.sourceInitialPlayerPosition);});
test('original6 and7 retain different target terrain and exact MP/range rather than copied Impact settings',()=>{const r=run(),[a,b]=r.skillConditions;assert.deepEqual([a.useMp,b.useMp],[20,25]);assert.deepEqual(a.oland,[0,0,100,0,0,100,0,0]);assert.equal(a.eland[7],0);assert.equal(b.eland[7],100);assert.equal(a.range.length,81);assert.deepEqual(a.range,b.range);assert.equal(a.range[40],2);assert.equal(a.range.filter(x=>x===1).length,12);});
test('source route never supplies actual MP, current target or actual gameplay credit',()=>{const r=run();for(const k of ['actualInputAccepted','actualMarchAccepted','actualBattleAccepted','actualCastAccepted','actualMovieAccepted','classicNativePixelAccepted','hdAccepted','globalHdComplete','rngContinuityAccepted','futureEnemyMovementGuaranteed'])assert.equal(r[k],false,k);assert.equal(r.currentNativeMovePathRequired,true);assert.equal(r.currentVerifiedMenuAndMpRequired,true);assert.equal(r.sourceMinimumEndCount,1);assert.equal(r.timeCountIsNotMonthsToWait,true);assert.equal(Object.hasOwn(r,'actualMp'),false);});
test('terrain hints remain separate from native legal MOVE evidence',()=>{const r=run();assert.equal(r.sourceNearestCasterTerrainHints.length,4);for(const h of r.sourceNearestCasterTerrainHints)assert.ok([2,5].includes(h.terrain));assert.equal(r.currentNativeMovePathRequired,true);});
test('detached route results cannot contaminate later calls or original LIB',()=>{const before=Buffer.from(lib),a=run();a.tiles.fill(255);a.route.mapId=999;a.skillConditions[0].oland.fill(255);const b=run();assert.equal(b.route.mapId,110);assert.notEqual(b.tiles[0],255);assert.equal(b.skillConditions[0].oland[2],100);assert.deepEqual(lib,before);});
test('exact Uint8Array subview keeps the real byte offset and identity',()=>{const backing=new Uint8Array(lib.length+8);backing.set(lib,4);const r=sourceOriginalWoodRoute({libBytes:backing.subarray(4,lib.length+4),origin:16,destination:15});assert.equal(r.nativeWay,2);});
test('16 to1 is rejected as an invented direct native road',()=>assert.throws(()=>run(16,1),/direct first8 ROM adjacency/));
test('adjacent16 to12 map112 uses explicitly reviewed native Way4 and forest-side spawn',()=>{const r=run(16,12);assert.deepEqual([r.mapId,r.nativeWay,r.timeCount,r.sourceInitialPlayerPosition,r.sourceInitialPlayerTerrain],[112,4,1,{x:16,y:29},3]);assert.deepEqual(r.sourceCityTile,{x:15,y:14});assert.equal(r.mapTilesSha256,'2becb0f6e54a237b67bda8f5dea3abcfd5f021bfe4afa0f5b2e1d87b4ba22a31');});
test('adjacent16 to22 map113 is outside the reviewed WOOD map scope',()=>assert.throws(()=>run(16,22),/Only reviewed original WOOD maps110\/112/));
test('wrong original ROM byte is rejected before route facts can be credited',()=>{const b=Buffer.from(lib);b[190000]^=1;assert.throws(()=>sourceOriginalWoodRoute({libBytes:b,origin:16,destination:15}),/Exact original LIB identity/);});
test('truncated original ROM cannot masquerade as a complete source',()=>assert.throws(()=>sourceOriginalWoodRoute({libBytes:lib.subarray(0,-1),origin:16,destination:15}),/Exact original LIB identity/));
for(const[origin,destination,label]of[[-1,15,'negative origin'],[38,15,'out-of-range origin'],[16.5,15,'fractional origin'],['16',15,'string origin'],[16,38,'out-of-range destination'],[16,NaN,'NaN destination'],[16,16,'self destination']])test('rejects '+label,()=>assert.throws(()=>run(origin,destination)));
for(const key of ['nativeWay','originPosition','destinationPosition','mapId','sourceInitialPlayerPosition'])test('caller cannot override ROM '+key,()=>assert.throws(()=>run(16,15,{[key]:0}),/caller cannot supply coordinates/));
test('missing original identity input is rejected',()=>assert.throws(()=>sourceOriginalWoodRoute({origin:16,destination:15}),/caller cannot supply coordinates/));
test('a different directed edge into map110 still needs its own reviewed scope',()=>{const b=lib,base=b.readUInt32LE((59-1)*4),links=b.subarray(base+14,base+14+608),mapBase=b.readUInt32LE(4),tableOffset=b.readUInt32LE(mapBase+14+14*8),maps=b.subarray(mapBase+tableOffset,mapBase+tableOffset+38);let route=null;for(let o=0;o<38&&!route;o++)for(const token of links.subarray(o*16,o*16+8)){const d=token-1;if(token&&maps[d]===0&&!['7:1','16:15'].includes(o+':'+d)){route=[o,d];break;}}assert.ok(route);assert.throws(()=>run(...route),/Only the explicitly reviewed/);});
test('map112 keeps the city guard and four source non-city forest slots distinct',()=>{const r=run(16,12);assert.deepEqual(r.sourceInitialDefenderPositions.slice(0,5).map(u=>[u.x,u.y,u.terrain]),[[15,14,5],[15,15,3],[14,14,3],[16,14,3],[15,13,3]]);for(const s of r.skillConditions){assert.equal(s.eland[5],0);assert.ok(s.eland[3]>0);}});
test('map112 tiles cannot inherit map110 hash or city coordinates',()=>{const a=run(16,12),b=run();assert.notDeepEqual(a.tiles,b.tiles);assert.notEqual(a.mapTilesSha256,b.mapTilesSha256);assert.notDeepEqual(a.sourceCityTile,b.sourceCityTile);assert.deepEqual([a.width,a.height],[32,32]);});
test('opposite direction12 to16 cannot reuse reviewed16 to12 authority',()=>assert.throws(()=>run(12,16)));

test('native4 to10 derives original map111 reverse Way0 and north-edge spawn',()=>{
 const r=run(4,10);
 assert.deepEqual([r.route,r.nativeWay,r.direction,r.timeCount,r.originPosition,r.destinationPosition,r.sourceInitialPlayerPosition,r.sourceInitialPlayerTerrain],
  [{originCity:4,destinationCity:10,mapId:111},0,0,1,{x:5,y:1},{x:5,y:2},{x:16,y:2},1]);
 assert.deepEqual([r.width,r.height,r.tiles.length],[32,32,1024]);
});
test('map111 binds every tile and its own mountain and forest distribution',()=>{
 const r=run(4,10);
 assert.equal(r.mapTilesSha256,'0e2d67577232e7c89f4aa64367e707813ab629719fd87844f9a92dbdb4a7bb2b');
 assert.equal(createHash('sha256').update(Buffer.from(r.tiles)).digest('hex'),r.mapTilesSha256);
 assert.equal(r.tiles.filter(v=>v>5&&v<=15).length,52);
 assert.equal(r.tiles.filter(v=>v===5).length,131);
 for(const old of [run(7,1),run(16,15),run(16,12)]){assert.notEqual(r.mapTilesSha256,old.mapTilesSha256);assert.notDeepEqual(r.tiles,old.tiles);assert.notDeepEqual(r.sourceCityTile,old.sourceCityTile);}
});
test('map111 retains city guard versus all nine original non-city defender slots',()=>{
 const r=run(4,10);assert.deepEqual(r.sourceCityTile,{x:16,y:17});
 assert.deepEqual(r.sourceInitialDefenderPositions,[
  {i:10,x:16,y:17,terrain:5},{i:11,x:16,y:18,terrain:3},{i:12,x:15,y:17,terrain:0},
  {i:13,x:17,y:17,terrain:3},{i:14,x:16,y:16,terrain:0},{i:15,x:15,y:16,terrain:0},
  {i:16,x:17,y:18,terrain:3},{i:17,x:15,y:18,terrain:3},{i:18,x:17,y:16,terrain:0},{i:19,x:16,y:15,terrain:0}
 ]);
 for(const s of r.skillConditions){assert.equal(s.eland[r.sourceInitialDefenderPositions[0].terrain],0);for(const d of r.sourceInitialDefenderPositions.slice(1))assert.ok(s.eland[d.terrain]>0);}
 assert.equal(Object.hasOwn(r,'currentEnemyIds'),false);
});
test('map111 adjacent mountain is a source hint while initial plain cannot cast WOOD',()=>{
 const r=run(4,10);assert.deepEqual(r.sourceNearestCasterTerrainHints[0],{x:15,y:2,terrain:2,manhattanDistance:1});
 for(const s of r.skillConditions){assert.equal(s.oland[r.sourceInitialPlayerTerrain],0);assert.ok(s.oland[2]>0);}
 assert.equal(r.currentNativeMovePathRequired,true);assert.equal(r.currentTargetTerrainAndRangeRequired,true);
 assert.equal(r.futureEnemyMovementGuaranteed,false);assert.equal(Object.hasOwn(r,'movePath'),false);
});
test('reviewing4 to10 does not authorize another map111 edge or caller-supplied native facts',()=>{
 for(const edge of [[9,10],[14,10],[15,10],[20,10]])assert.throws(()=>run(...edge),/Only the explicitly reviewed/);
 assert.throws(()=>run(10,4));
 for(const [key,value] of [['nativeWay',0],['mapId',111],['originPosition',{x:5,y:1}],['sourceInitialPlayerPosition',{x:16,y:2}]])assert.throws(()=>run(4,10,{[key]:value}),/caller cannot supply coordinates/);
});
test('map111 results cannot grant real campaign credit or contaminate original ROM and later calls',()=>{
 const before=Buffer.from(lib),a=run(4,10);
 for(const k of ['actualInputAccepted','actualMarchAccepted','actualBattleAccepted','actualCastAccepted','actualMovieAccepted','classicNativePixelAccepted','hdAccepted','globalHdComplete','rngContinuityAccepted'])assert.equal(a[k],false,k);
 for(const k of ['actualMp','world','carry','residentGuard','currentTargets','nativeMoveAccepted'])assert.equal(Object.hasOwn(a,k),false,k);
 a.tiles[2*32+15]=1;a.sourceInitialDefenderPositions[0].terrain=0;a.sourceInitialPlayerPosition.x=0;a.skillConditions[0].oland[2]=0;
 const b=run(4,10);assert.deepEqual(b.sourceInitialPlayerPosition,{x:16,y:2});assert.equal(b.sourceInitialDefenderPositions[0].terrain,5);assert.equal(b.sourceNearestCasterTerrainHints[0].terrain,2);assert.equal(b.skillConditions[0].oland[2],100);assert.deepEqual(lib,before);
});
