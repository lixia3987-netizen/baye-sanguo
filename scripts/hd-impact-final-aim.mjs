/** Pure final native AIM fence for the original Impact13/caster130/map110 route.
 * Two complete readonly observations remain exact, including unknown fields.
 * This authorizes no input and grants no cast, damage, movie or HD acceptance.
 * Native spe/report active fields are numeric U8 values; skillResult.active is
 * a boolean. In particular, a legitimate inactive spe.active is exactly 0.
 */
import assert from 'node:assert/strict';

export const IMPACT13_FINAL_AIM_SCOPE = 'Pure current native AIM fence only; no native input, cast, movie, damage or HD acceptance';

export function verifyImpact13FinalAim({first,second,original,target,actor,destination,casterNativeId,librarySha256}) {
  assert.ok(first && second && original && target && actor);
  assert.equal(destination,1,'This fence is scoped to the original destination1 route');
  assert.equal(casterNativeId,130,'This fence is scoped to original caster130');
  assert.match(librarySha256,/^[0-9a-f]{64}$/,'An exact current original-library hash is required');
  assert.deepEqual(second,first,'Immediately before confirmation, readonly native owner/refs/world/range and keys are stable');
  const snapshot=first.snapshot,f=snapshot.fight;
  assert.equal(first.mapId,110);
  assert.equal(f.cityIndex,destination);
  assert.deepEqual([f.active,f.over,f.wait,f.inputKind,f.aimType,f.actorIndex],[1,0,1,5,1,actor.i]);
  for(const k of ['inputSeq','actorIndex','aimType','cityIndex','bout'])assert.equal(f[k],original.fight[k]);
  assert.equal(first.generation,original.generation);
  assert.equal(snapshot.spe.active,0,'Native SPE active is numeric U8 zero before confirmation');
  assert.equal(snapshot.result.active,false,'Published skill-result active is boolean false before confirmation');
  assert.equal(snapshot.report.active,0,'Native report active is numeric U8 zero before confirmation');
  assert.equal(snapshot.library.status,'ready');
  assert.equal(snapshot.library.sha256,librarySha256);
  const a=snapshot.units[actor.i],t=snapshot.units[target.i];
  assert.equal(a.id,casterNativeId);
  assert.equal(t.id,target.id);
  assert.equal(a.position.mp,original.casterMp);
  assert.ok(a.position.mp>=30);
  assert.equal(a.position.active,0);
  assert.ok(![1,2,6,8].includes(a.position.state));
  assert.equal(t.position.state,target.state);
  assert.ok(t.person.arms>0);
  assert.deepEqual([a.position.x,a.position.y,t.position.x,t.position.y],[original.casterX,original.casterY,original.x,original.y]);
  assert.deepEqual([first.actorTerrain,first.targetTerrain],[7,7]);
  assert.equal(first.weather,original.weather);
  assert.ok(first.weather>=1&&first.weather<=4);
  assert.equal(Math.abs(a.position.x-t.position.x)+Math.abs(a.position.y-t.position.y),1);
  assert.deepEqual(first.range,{size:original.size,x:original.originX,y:original.originY,values:original.values});
  const dx=(t.position.x-first.range.x)&255,dy=(t.position.y-first.range.y)&255;
  assert.ok(dx<first.range.size&&dy<first.range.size);
  assert.equal(first.range.values[dy*first.range.size+dx],1);
  return {first,second,actualConfirmationNotYetSent:true};
}
