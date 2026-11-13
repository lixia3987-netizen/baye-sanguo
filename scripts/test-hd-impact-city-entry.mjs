import test from 'node:test';
import assert from 'node:assert/strict';
import {v13AssertCityEntry} from './hd-impact-city-entry.mjs';

// Controlled Node contracts only. No browser/game command or actual UI credit.
const rom={"geometry":{"mapWidth":12,"mapHeight":9,"screenWidth":160,"screenHeight":96,"cursorRange":{"left":0,"top":0,"right":100,"bottom":100}},"map":[0,1,0,0,0,0,0,0,0,2,0,3,0,0,4,0,0,5,0,6,7,0,8,0,0,0,0,9,10,11,0,12,13,14,0,0,0,0,0,15,0,0,0,16,17,18,19,0,0,0,20,0,0,0,21,22,0,23,24,0,0,0,25,26,0,0,27,28,29,0,30,0,31,0,0,32,33,0,0,34,0,35,0,0,0,0,0,0,0,36,0,37,0,38,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"positions":[1,0,9,0,11,0,2,1,5,1,7,1,8,1,10,1,3,2,4,2,5,2,7,2,8,2,9,2,3,3,7,3,8,3,9,3,10,3,2,4,6,4,7,4,9,4,10,4,2,5,3,5,6,5,7,5,8,5,10,5,0,6,3,6,4,6,7,6,9,6,5,7,7,7,9,7],"rootMenuBytes":[196,218,213,254,205,226,189,187,190,252,177,184,215,180,191,246]};
const clone=structuredClone;
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}
function fixture(){
  const report={text:'存储中...',seq:2,active:0,inputSeq:2,kind:1,person:65535};
  const before={world:{king:0,date:[237,3],cities:Array.from({length:38},(_,i)=>({Belong:i===16?1:0,Money:123,Food:456})),unknownWorld:{keep:[4,5]}},meta:{overworldMode:'hd-map',cityMode:'classic',currentIdentity:true,identity:{status:'ready',sha256:'a'.repeat(64)},cityPos:{x:4,y:0,setx:8,sety:2,unknownCursor:17},unknownMeta:{keep:91}},state:{snapshot:{references:{data:1,engine:2,hd:3},spe:{active:0,generation:3,eventId:0,kind:0},result:{active:false,session:0,phase:null},fight:{active:0,inputKind:0,actorIndex:255,focusX:0,focusY:0},report},menu:{active:0,context:0,kind:0,seq:6,itemLen:8,count:3,index:1,names:['策略结束','存储进度','结束游戏'],packedNames:['策略结束','存储进度','结束游戏'],ids:[],idsValid:false,generation:3,detailGeneration:3,unknownMenu:61},march:{pick:1,battlePick:0,mapCity:13,mapInputSeq:2,ok:0,city:0,obj:0,time:0,seq:0,phase:0,session:0,origin:255,selected:0,inputSeq:2},qty:{active:0,session:2,inputSeq:0},record:{active:0,seq:6},keys:11,overworld:'map',unknownState:{keep:23}}};
  const after=clone(before);after.meta.cityPos.sety=3;after.state.keys=13;after.state.overworld='classic-menu';after.state.march.pick=0;after.state.march.mapCity=17;
  after.state.menu={active:1,context:1,kind:1,seq:7,itemLen:4,count:4,index:0,names:['内政','外交','军备','状况'],packedNames:['内政','外交','军备','状况'],ids:[],idsValid:false,generation:3,detailGeneration:3,unknownMenu:61};
  const template={at:100,phase:'battle',generation:3,eventId:0,kind:0,speActive:0,resultActive:false,resultSession:0,resultPhase:null,inputKind:0,actorIndex:255,focusX:0,focusY:0,report:clone(report)};
  return {before,after,pos:{index:16,engX:8,engY:3},keys:[{...clone(template),code:35},{...clone(template),at:101,code:39}],native:clone(rom)};
}
const run=f=>v13AssertCityEntry(f.before,f.after,f.pos,f.keys,f.native);
function literalWalk(f,start,finish,codes,mapCity){
  f.before.meta.cityPos={...f.before.meta.cityPos,...start};f.before.state.march.mapCity=f.native.map[start.sety*12+start.setx];
  f.after.meta.cityPos={...f.after.meta.cityPos,...finish};f.after.state.march.mapCity=mapCity;
  f.keys=codes.map((code,i)=>({...clone(f.keys[0]),code,at:100+i}));f.after.state.keys=f.before.state.keys+codes.length;return f;
}

test('measured-shape Down/Enter city entry passes without changing its inputs',()=>{
  const f=fixture(),original=clone(f);freeze(f);const r=run(f);assert.equal(r.accepted,true);assert.deepEqual(r.expectedCodes,[35,39]);assert.deepEqual(r.expectedPosition,{x:4,y:0,setx:8,sety:3,unknownCursor:17});assert.deepEqual(f,original);assert.equal(r.mapInputSeq,2);assert.equal(r.menuSeq,7);
});
test('complete world/meta/ref/unknown/menu/native owner changes remain rejected',()=>{
  const mutations=[f=>f.after.world.cities[16].Food++,f=>f.after.world.unknownWorld.keep.push(9),f=>f.after.meta.identity.sha256='b'.repeat(64),f=>f.after.meta.unknownMeta.keep++,f=>f.after.meta.cityPos.unknownCursor++,f=>f.after.state.snapshot.references.hd++,f=>f.after.state.march.mapInputSeq++,f=>f.after.state.march.session++,f=>f.after.state.menu.seq++,f=>f.after.state.menu.detailGeneration++,f=>f.after.state.menu.names[0]='内政x',f=>f.after.state.unknownState.keep++,f=>f.after.state.march.pick=1];
  for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(()=>run(f),/City entry permits only C-derived/);}
});
test('native key slice must contain exactly the source-derived arrows and one Enter',()=>{
  for(const mutate of [f=>f.keys.pop(),f=>f.keys.push(clone(f.keys[1])),f=>f.keys[0].code=34,f=>f.keys[1].code=40]){const f=fixture();mutate(f);assert.throws(()=>run(f),/Only exact C-derived public walk/);}
  const f=fixture();f.after.state.keys++;assert.throws(()=>run(f),/Actual native key slice exactly spans/);
});
test('input records must retain generation, result, battle/report ownership and monotonic time',()=>{
  const mutations=[[f=>f.keys[0].generation++,/original generation/],[f=>f.keys[1].resultSession++,/No result owner/],[f=>f.keys[0].actorIndex=0,/No battle input owner/],[f=>f.keys[1].report.inputSeq++,/No report owner/],[f=>f.keys[1].at=99,/monotonic/],[f=>f.keys[1].phase='other',/instrumentation phase/]];
  for(const [mutate,reason] of mutations){const f=fixture();mutate(f);assert.throws(()=>run(f),reason);}
  const f=fixture();for(const t of [f.before,f.after]){t.state.snapshot.result.session=9;t.state.snapshot.result.phase='retired';}for(const k of f.keys){k.resultSession=9;k.resultPhase='retired';}assert.equal(run(f).accepted,true,'inactive retained result metadata is compared to real before, not fabricated zero');
});
test('C horizontal scroll uses 8 columns: explicit Y-first 3 Down + 8 Right then Enter',()=>{
  const f=literalWalk(fixture(),{x:0,y:0,setx:0,sety:0},{x:1,y:0,setx:8,sety:3},[35,35,35,37,37,37,37,37,37,37,37,39],17);assert.equal(run(f).accepted,true);
  f.after.meta.cityPos.x=0;assert.throws(()=>run(f),/City entry permits only C-derived/);
});
test('C vertical scroll uses 6 rows and preserves all unrelated cursor fields',()=>{
  const f=fixture();f.pos={index:35,engX:5,engY:7};for(const t of [f.before,f.after])t.world.cities[35].Belong=1;
  literalWalk(f,{x:0,y:0,setx:0,sety:0},{x:0,y:2,setx:5,sety:7},[35,35,35,35,35,35,35,37,37,37,37,37,39],36);assert.equal(run(f).accepted,true);
  f.after.meta.cityPos.y=1;assert.throws(()=>run(f),/City entry permits only C-derived/);
});
test('same-tile entry has one Enter; original U32 menu sequence wraps to 1',()=>{
  const f=literalWalk(fixture(),{x:4,y:0,setx:8,sety:3},{x:4,y:0,setx:8,sety:3},[39],17);f.before.state.menu.seq=0xffffffff;f.after.state.menu.seq=1;assert.equal(run(f).accepted,true);
  f.before.state.menu.seq=NaN;assert.throws(()=>run(f));
});
test('ROM target, source menu bytes, native range and unowned target cannot be substituted',()=>{
  const mutations=[[f=>f.pos.engY=2,/Public target is bound/],[f=>f.native.positions[33]=2,/Public target is bound/],[f=>f.native.map[44]=0,/Original map cell/],[f=>f.native.rootMenuBytes[0]=197,/Original root-menu ROM names/],[f=>f.native.geometry.cursorRange.bottom=2,/Every native arrow/],[f=>f.native.geometry.mapWidth=13,/deep-equal/],[f=>f.before.world.cities[16].Belong=2,/Only a currently owned/],[f=>f.before.state.march.mapCity=12,/Initial native mapCity/]];
  for(const [mutate,reason] of mutations){const f=fixture();mutate(f);assert.throws(()=>run(f),reason);}
});
