import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyMobileBattleHelp,verifyMobileBattleView,verifyMobileBattleViewTransition,verifyMobileBattleOverviewWorld,terrainFromNativeTile,originalBattleOverviewLabels} from './hd-mobile-battle-overviews-runtime-oracle.mjs';

const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const labels=originalBattleOverviewLabels(lib);
const clone=v=>structuredClone(v);
function measured(){
  const ids=Array.from({length:20},(_,i)=>i<8||i===10||i===11?i+1:0);
  const units=ids.map((id,slot)=>({slot,x:id?slot%10:0,y:id?(slot<10?2:15):0,hp:300,mp:400,move:5,active:0,state:id?0:8,
    ...(id?{personIndex:id-1,name:'实际将'+id,person:{Level:3,Force:70,IQ:60,Experience:2,Arms:800,Belong:slot<10?1:11},armType:2}:{})}));
  return {detailGeneration:3,fight:{active:1,over:0,inputKind:10,inputSeq:50,focusX:0,focusY:2,mapW:20,mapH:20,bout:1},genArray:ids,units,
    maxLevel:20,attack:{at:100,df:90},mode:1,playerFood:1000,enemyKnownFood:0,secretEnemyFood:1398,leaderNames:['马腾','曹操'],map:Array(400).fill(2),
    world:{people:[{Arms:800,Thew:100}],cities:[{Food:1000}],orders:[{OrderId:255}],queue:[0,1,2]},touches:0,pcBattle:'hd'};
}
function view(s=measured(),force=1,start=0){
  const base=force*10;let total=0;while(total<10&&s.genArray[base+total])total++;
  const rows=[];for(let i=start;i<Math.min(total,start+5);i++){const u=s.units[base+i];rows.push({slot:u.slot,personIndex:u.personIndex,name:u.name,arms:u.person.Arms,text:u.name+' '+u.person.Arms});}
  const known=Number(!force||s.enemyKnownFood!==0),food=force?s.enemyKnownFood:s.playerFood;
  s.view={protocolVersion:1,active:1,complete:1,custom:0,seq:8,generation:3,detailGeneration:3,inputSeq:50,force,pageStart:start,pageSize:5,totalCount:total,rowCount:rows.length,
    width:20,height:20,days:1,playerMode:1,foodKnown:known,food,leaderPerson:s.units[base].person.Belong-1,
    title:labels.title.trimEnd(),daysText:'日1',positionsText:labels.positions.trimEnd(),factionText:(s.leaderNames[force]+labels.army).trimEnd(),foodText:(labels.food+(known?food:labels.unknown)).trimEnd(),rows,
    points:s.units.filter(u=>u.state!==8).map(u=>({slot:u.slot,personIndex:u.personIndex,x:u.x,y:u.y,state:u.state}))};return s;
}
function help(){const s=measured(),u=s.units[0];s.fight.inputKind=9;s.help={protocolVersion:1,active:1,complete:1,seq:6,generation:3,detailGeneration:3,inputSeq:50,
  kind:1,person:0,slot:0,x:0,y:2,terrain:255,name:u.name,arm:labels.arms[2],state:labels.states[0],levelMax:0,text:'实际原生人物信息',fields:[3,70,60,2,300,400,100,90,800,2]};return s;}
const verifyV=s=>verifyMobileBattleView({sample:s,libBytes:lib}),verifyH=s=>verifyMobileBattleHelp({sample:s,libBytes:lib});

test('original resource labels and terrain mapping are independently read from exact LIB',()=>{
  assert.equal(labels.arms.length,6);assert.equal(labels.states.length,8);assert.equal(labels.terrain.length,8);
  assert.deepEqual([0,1,2,3,4,5,6,15,16,41].map(terrainFromNativeTile),[255,1,0,5,4,3,2,2,7,6]);
});
test('HELP accepts zero person ID, U16 HP/MP and all ten current fields',()=>{assert.equal(verifyH(help()).person,0);});
test('HELP max level derives actual configured maximum',()=>{const s=help();s.maxLevel=3;s.help.levelMax=1;verifyH(s);s.help.levelMax=0;assert.throws(()=>verifyH(s));});
test('HELP terrain is actual empty focus and original ROM text',()=>{const s=help();s.fight.focusX=9;s.fight.focusY=9;s.help={...s.help,kind:2,slot:255,person:65535,x:9,y:9,terrain:0,text:labels.terrain[0]};assert.equal(verifyH(s).kind,2);});
for(const [name,change] of [
  ['wrong person',s=>s.help.person=1],['wrong slot',s=>s.help.slot=1],['focus drift',s=>s.fight.focusX=1],['torn generation',s=>s.help.generation=4],
  ['stale input',s=>s.help.inputSeq=49],['incomplete',s=>s.help.complete=0],['native owner not HELP',s=>s.fight.inputKind=1],
  ['wrong HP',s=>s.help.fields[4]=301],['wrong measured attack',s=>s.help.fields[6]=101],['wrong arm type',s=>s.help.fields[9]=1],
  ['wrong state label',s=>s.help.state='正常伪造'],['wrong name',s=>s.help.name='另一人']
])test('HELP rejects '+name,()=>{const s=help();change(s);assert.throws(()=>verifyH(s));});
test('HELP terrain cannot claim an occupied unit or invalid zero tile',()=>{
  const s=help();s.help={...s.help,kind:2,slot:255,person:65535,terrain:0,text:labels.terrain[0]};assert.throws(()=>verifyH(s));
  s.fight.focusX=s.help.x=9;s.fight.focusY=s.help.y=9;s.map[189]=0;assert.throws(()=>verifyH(s));
});
test('VIEW unknown grain does not reveal real nonzero enemy food',()=>{const s=view();assert.equal(verifyV(s).food,0);assert.equal(s.secretEnemyFood,1398);});
test('VIEW player eight units produce 5+3 native pages',()=>{assert.equal(verifyV(view(measured(),0,0)).rowCount,5);assert.equal(verifyV(view(measured(),0,5)).rowCount,3);});
test('VIEW dead roster entry remains in count while points omit it',()=>{const s=measured();s.units[7].state=8;const a=view(s,0,5);assert.equal(verifyV(a).rowCount,3);assert.equal(a.view.points.some(p=>p.slot===7),false);});
test('VIEW contiguous GenArray count stops at first zero, points still enumerate all live slots',()=>{const s=measured();s.genArray[3]=0;s.units[3]={slot:3,x:0,y:0,hp:0,mp:0,move:0,active:0,state:8};const a=view(s,0,0);assert.equal(verifyV(a).totalCount,3);assert.ok(a.view.points.some(p=>p.slot===7));});
test('VIEW known enemy grain uses actual reconnaissance field only',()=>{const s=measured();s.enemyKnownFood=400;assert.equal(verifyV(view(s)).food,400);});
for(const [name,change] of [
  ['secret grain exposed',s=>s.view.food=s.secretEnemyFood],['unknown relabelled known',s=>s.view.foodKnown=1],['wrong grain label',s=>s.view.foodText='粮草1398'],
  ['wrong current name',s=>s.view.rows[0].name='假人'],['wrong troops',s=>s.view.rows[0].arms--],['wrong side slot',s=>s.view.rows[0].slot=0],
  ['wrong leader uses side first person instead of Belong',s=>s.view.leaderPerson=11],['missing live point',s=>s.view.points.pop()],['wrong point coordinate',s=>s.view.points[0].x++],
  ['stale detail generation',s=>s.view.detailGeneration=2],['stale input',s=>s.view.inputSeq=49],['wrong page count',s=>s.view.totalCount=1],
  ['custom hook',s=>s.view.custom=1],['unknown live sentinel',s=>{s.genArray[0]=0;s.units[0]={...s.units[0],state:0};s.view.points[0].personIndex=65535;}]
])test('VIEW rejects '+name,()=>{const s=view();change(s);assert.throws(()=>verifyV(s));});
test('VIEW both switch directions reset to native first page',()=>{for(const key of [36,37]){const b=view(measured(),0,5),a=view(measured(),1,0);a.view.seq=9;a.view.inputSeq=a.fight.inputSeq=51;assert.equal(verifyMobileBattleViewTransition({before:b,after:a,key}).to.force,1);}});
test('VIEW boundary arrows still require one new native publication and input sequence',()=>{const b=view(),a=clone(b);a.view.seq=9;a.view.inputSeq=a.fight.inputSeq=51;assert.equal(verifyMobileBattleViewTransition({before:b,after:a,key:34}).boundaryNoop,true);a.view.inputSeq=50;assert.throws(()=>verifyMobileBattleViewTransition({before:b,after:a,key:34}));});
test('VIEW lower page and upper page use native page size',()=>{const b=view(measured(),0,0),a=view(measured(),0,5);a.view.seq=9;a.view.inputSeq=a.fight.inputSeq=51;verifyMobileBattleViewTransition({before:b,after:a,key:35});const n=view(measured(),0,0);n.view.seq=10;n.view.inputSeq=n.fight.inputSeq=52;verifyMobileBattleViewTransition({before:a,after:n,key:34});});
test('VIEW U32 sequence wraps to one without rejecting valid boundary ACK',()=>{const b=view();b.view.seq=b.view.inputSeq=b.fight.inputSeq=0xffffffff;const a=view();a.view.seq=a.view.inputSeq=a.fight.inputSeq=1;verifyMobileBattleViewTransition({before:b,after:a,key:35});});
test('VIEW transition rejects opposite side, skipped ACK or unsupported key',()=>{const b=view(),a=clone(b);a.view.seq=10;a.view.inputSeq=a.fight.inputSeq=51;assert.throws(()=>verifyMobileBattleViewTransition({before:b,after:a,key:35}));a.view.seq=9;a.view.force=0;assert.throws(()=>verifyMobileBattleViewTransition({before:b,after:a,key:35}));assert.throws(()=>verifyMobileBattleViewTransition({before:b,after:a,key:39}));});
test('readonly world permits focus/owner/derived HELP scratch changes but no gameplay effects',()=>{const b=measured(),a=clone(b);a.fight.focusX=12;a.fight.inputSeq++;a.attack.at++;verifyMobileBattleOverviewWorld({before:b,after:a});});
for(const [name,change] of [['world money',s=>s.world.cities[0].Money=1],['battle unit',s=>s.units[0].mp--],['PC preference',s=>s.pcBattle='classic'],['native LCD input',s=>s.touches++],['known enemy food',s=>s.enemyKnownFood++],['map',s=>s.map[0]++]] )
  test('readonly overview rejects '+name,()=>{const b=measured(),a=clone(b);change(a);assert.throws(()=>verifyMobileBattleOverviewWorld({before:b,after:a}));});
test('foreign library is never accepted by content oracle',()=>{const s=view(),bad=Buffer.from(lib);bad[100]^=1;assert.throws(()=>verifyMobileBattleView({sample:s,libBytes:bad}));});
