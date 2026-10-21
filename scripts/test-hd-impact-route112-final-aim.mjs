import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyImpact13Route112FinalAim,APPROVED_IMPACT13_ROUTE112,IMPACT13_ROUTE112_FINAL_AIM_SCOPE} from './hd-impact-route112-final-aim.mjs';

// Genuine saved V15 MOVE observation supplies the complete original readonly
// snapshot shape and exact active-field types. Route112 AIM positions/range below are
// explicitly controlled test data, not a restored or accepted actual battle. Static east spawn29,16 is a source
// expectation; these controls grant no actual map/MOVE/AIM acceptance.
const raw=fs.readFileSync(new URL('./fixtures/hd-impact-v15-west-river-move.json',import.meta.url));
assert.equal(raw.length,15737);
assert.equal(createHash('sha256').update(raw).digest('hex'),'301150fd0fee566f266209a2d6c394850737a665b7fa61ab401054964d42d919');
const fixture=JSON.parse(raw),copy=x=>structuredClone(x);

function model() {
  const snapshot=copy(fixture.input.planning.readOnly);
  Object.assign(snapshot.fight,{active:1,over:0,wait:1,inputKind:5,aimType:1,actorIndex:0,inputSeq:103,cityIndex:12,bout:2,focusX:29,focusY:16});
  Object.assign(snapshot.units[0].position,{x:29,y:16,mp:67,active:0,state:0});
  Object.assign(snapshot.units[11].position,{x:28,y:16,state:0});
  snapshot.units[11].id=17;Object.assign(snapshot.units[11].person,{personIndex:16,name:'乐进',arms:1840});
  snapshot.futureOwnerField={protocol:9,tag:'retained-unknown'};
  const range={size:3,x:27,y:15,values:[0,0,0,0,1,0,0,0,0]};
  const first={snapshot,keys:42,generation:3,mapId:112,weather:2,actorTerrain:7,targetTerrain:7,range};
  const original={fight:copy(snapshot.fight),generation:3,casterMp:67,casterX:29,casterY:16,x:28,y:16,weather:2,size:3,originX:27,originY:15,values:copy(range.values)};
  return {first,second:copy(first),original,target:{i:11,id:17,state:0,x:28,y:16},actor:{i:0,id:130},approvedRoute:copy(APPROVED_IMPACT13_ROUTE112),casterNativeId:130,librarySha256:snapshot.library.sha256};
}
function stableEdit(x,edit){edit(x.first);x.second=copy(x.first);return x;}

test('numeric inactive native SPE passes without coercion or mutation and grants no actual acceptance',()=>{
  const x=model(),before=copy(x),receipt=verifyImpact13Route112FinalAim(x);
  assert.deepEqual([x.first.snapshot.spe.active,x.first.snapshot.result.active,x.first.snapshot.report.active],[0,false,0]);
  assert.deepEqual(x,before);
  assert.equal(receipt.first,x.first);assert.equal(receipt.second,x.second);
  assert.equal(receipt.actualConfirmationNotYetSent,true);
  assert.deepEqual(Object.keys(receipt),['first','second','actualConfirmationNotYetSent']);
  assert.match(IMPACT13_ROUTE112_FINAL_AIM_SCOPE,/no native input, cast, movie, damage or HD acceptance/);
});

test('each inactive owner retains its exact native or published field type',()=>{
  for(const [owner,values]of [['spe',[false,'0',1,null]],['result',[0,'false',true,null]],['report',[false,'0',1,null]]]){
    for(const value of values){const x=stableEdit(model(),f=>{f.snapshot[owner].active=value;});assert.throws(()=>verifyImpact13Route112FinalAim(x),undefined,owner+' rejects '+String(value));}
  }
});

test('complete two-read fence rejects owner, reference, key, unit, identity and unknown-field drift',()=>{
  const edits=[
    f=>{f.snapshot.references.data++;},f=>{f.snapshot.spe.generation++;},
    f=>{f.snapshot.report.seq++;},f=>{f.snapshot.top.session++;},
    f=>{f.keys++;},f=>{f.snapshot.units[19].position.x++;},
    f=>{f.snapshot.library.reason='changed';},f=>{f.snapshot.futureOwnerField.tag='changed';},
    f=>{f.unknownRoot={newField:true};},f=>{f.range.values[8]=1;}
  ];
  for(const edit of edits){const x=model();edit(x.second);assert.throws(()=>verifyImpact13Route112FinalAim(x),/readonly native owner\/refs\/world\/range and keys are stable/);}
});

test('equal observations with a stale native ticket remain rejected against the original current AIM proof',()=>{
  for(const k of ['inputSeq','actorIndex','aimType','cityIndex','bout']){
    const x=model();x.original.fight[k]++;assert.throws(()=>verifyImpact13Route112FinalAim(x),undefined,k);
  }
  const x=model();x.original.generation++;assert.throws(()=>verifyImpact13Route112FinalAim(x));
});

test('equal observations still require the exact active current native AIM owner',()=>{
  for(const [key,value]of [['active',0],['over',1],['wait',0],['inputKind',4],['aimType',0],['actorIndex',1],['cityIndex',1]]){
    const x=stableEdit(model(),f=>{f.snapshot.fight[key]=value;});assert.throws(()=>verifyImpact13Route112FinalAim(x),undefined,key);
  }
  for(const edit of [f=>{f.mapId=110;},f=>{f.generation=4;},f=>{f.snapshot.library.status='loading';},f=>{f.snapshot.library.sha256='0'.repeat(64);}]){
    assert.throws(()=>verifyImpact13Route112FinalAim(stableEdit(model(),edit)));
  }
});

test('caster and target keep exact tokens, MP, states and a live target',()=>{
  const edits=[
    f=>{f.snapshot.units[0].id=131;},f=>{f.snapshot.units[11].id=72;},
    f=>{f.snapshot.units[0].position.mp--;},f=>{f.snapshot.units[0].position.active=1;},
    ...[1,2,6,8].map(state=>f=>{f.snapshot.units[0].position.state=state;}),
    f=>{f.snapshot.units[11].position.state=8;},f=>{f.snapshot.units[11].person.arms=0;}
  ];
  for(const edit of edits)assert.throws(()=>verifyImpact13Route112FinalAim(stableEdit(model(),edit)));
  const low=model();low.original.casterMp=29;stableEdit(low,f=>{f.snapshot.units[0].position.mp=29;});assert.throws(()=>verifyImpact13Route112FinalAim(low));
});

test('river terrain, weather, positions and adjacency remain mandatory after the type correction',()=>{
  for(const edit of [f=>{f.actorTerrain=0;},f=>{f.targetTerrain=0;},f=>{f.weather=3;},f=>{f.snapshot.units[0].position.x++;},f=>{f.snapshot.units[11].position.y++;}]){
    assert.throws(()=>verifyImpact13Route112FinalAim(stableEdit(model(),edit)));
  }
  for(const weather of [0,5]){const x=model();x.original.weather=weather;stableEdit(x,f=>{f.weather=weather;});assert.throws(()=>verifyImpact13Route112FinalAim(x));}
  const distant=model();distant.original.x=27;stableEdit(distant,f=>{f.snapshot.units[11].position.x=27;});assert.throws(()=>verifyImpact13Route112FinalAim(distant));
});

test('the complete native range and the current target bit, rather than adjacency alone, authorize the target',()=>{
  for(const edit of [f=>{f.range.values[8]=1;},f=>{f.range.x=10;},f=>{f.range.size=4;}])assert.throws(()=>verifyImpact13Route112FinalAim(stableEdit(model(),edit)));
  const absent=model();absent.original.values[4]=0;stableEdit(absent,f=>{f.range.values[4]=0;});assert.throws(()=>verifyImpact13Route112FinalAim(absent));
  const out=model();out.original.originX=29;stableEdit(out,f=>{f.range.x=29;});assert.throws(()=>verifyImpact13Route112FinalAim(out));
});

test('a classic cursor move may change focus while the original AIM ticket, units and native range stay current',()=>{
  const x=stableEdit(model(),f=>{f.snapshot.fight.focusX=28;});
  assert.doesNotThrow(()=>verifyImpact13Route112FinalAim(x));
});

test('the new fence accepts only the exact approved13 to12/map112 route and caster130',()=>{
  assert.equal(Object.isFrozen(APPROVED_IMPACT13_ROUTE112),true);
  assert.deepEqual(APPROVED_IMPACT13_ROUTE112,{originCity:13,destinationCity:12,mapId:112});
  for(const route of [{originCity:6,destinationCity:1,mapId:110},{originCity:6,destinationCity:12,mapId:112},{originCity:13,destinationCity:1,mapId:112},{originCity:13,destinationCity:12,mapId:110},{originCity:13,destinationCity:12,mapId:112,unknown:true},null]){
    const x=model();x.approvedRoute=route;assert.throws(()=>verifyImpact13Route112FinalAim(x));
  }
  const y=model();y.casterNativeId=131;assert.throws(()=>verifyImpact13Route112FinalAim(y));
});

test('the actual current owner must still be destination12/map112 with original32x32 dimensions',()=>{
  for(const edit of [f=>{f.mapId=110;},f=>{f.snapshot.fight.cityIndex=1;},f=>{f.snapshot.fight.mapW=31;},f=>{f.snapshot.fight.mapH=31;}])assert.throws(()=>verifyImpact13Route112FinalAim(stableEdit(model(),edit)));
});

test('the historical destination1/map110 final-AIM module remains byte-exact',()=>{
  const old=fs.readFileSync(new URL('./hd-impact-final-aim.mjs',import.meta.url));
  assert.equal(old.length,3107);assert.equal(createHash('sha256').update(old).digest('hex'),'e0a9806c8f8e91d8f392ad32543c574aa6ffe5e4749ab99d18326260b7331b36');
});
