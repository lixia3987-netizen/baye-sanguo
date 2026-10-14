// Independent checks for one nonlethal original ordinary attack. No game writes.
import assert from 'node:assert/strict';

function exact(actual,expected,path='$') {
  if(Object.is(actual,expected))return;
  assert.ok(actual&&expected&&typeof actual==='object'&&typeof expected==='object','Actual attack differs at '+path);
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),'Attack field set differs at '+path);
  for(const k of Object.keys(expected))exact(actual[k],expected[k],path+'.'+k);
}
export function verifyMobileNonlethalAttack({before,after,world,worldAfter,actorIndex,targetIndex,traces}) {
  assert.ok(Array.isArray(traces)&&traces.length>0,'Actual native display samples required');
  assert.ok(Number.isInteger(actorIndex)&&actorIndex>=0&&actorIndex<10);
  assert.ok(Number.isInteger(targetIndex)&&targetIndex>=10&&targetIndex<20);
  const actor=before.units.find(u=>u.i===actorIndex),target=before.units.find(u=>u.i===targetIndex);
  assert.ok(actor&&target&&actor.state===0&&actor.active===0&&target.state!==8);
  assert.equal(before.fight.inputKind,5);assert.equal(before.fight.aimType,0);assert.equal(before.fight.actorIndex,actorIndex);
  const {session,generation,hurt}=traces[0].attack;
  assert.ok(Number.isInteger(session)&&session>0&&Number.isInteger(generation)&&generation>0);
  assert.ok(Number.isInteger(hurt)&&hurt>0&&hurt<target.arms,'This oracle accepts a positive nonlethal strike only');
  for(const t of traces){const a=t.attack;assert.equal(a.active,true);assert.equal(a.actorIndex,actorIndex);assert.equal(a.targetIndex,targetIndex);
    assert.equal(a.session,session);assert.equal(a.generation,generation);assert.equal(a.hurt,hurt);
    assert.equal(t.units.find(u=>u.i===targetIndex).arms,target.arms-hurt,'Soldier loss already committed during original display');}
  const expectedUnits=structuredClone(before.units);
  expectedUnits.find(u=>u.i===actorIndex).active=1;expectedUnits.find(u=>u.i===targetIndex).arms-=hurt;
  exact(after.units,expectedUnits,'units');exact(after.food,before.food,'food');exact(after.settings,before.settings,'settings');
  assert.equal(after.fight.active,1);assert.equal(after.fight.over,0);assert.equal(after.fight.inputKind,1);
  assert.equal(after.fight.bout,before.fight.bout);assert.equal(after.report.active,0);
  const expected=structuredClone(world),person=expected.people[actor.id-1],victim=expected.people[target.id-1];
  assert.ok(person&&victim&&world.config&&Number.isInteger(world.config.disableExpGrowing)&&Number.isInteger(world.config.maxLevel));
  // FightSub:FgtGetExp uses U32 subtraction; FgtAtkAction returns U8. There
  // is no kill bonus in this deliberately nonlethal acceptance contract.
  const delta=(person.Level-victim.Level)>>>0;
  let exp=Math.floor(Math.sqrt(hurt))>>>2;
  exp=delta>0x80?(exp-delta)>>>0:exp>delta?exp-delta:0;
  const gain=((exp+2)>>>0)&255;
  if(gain){
    if(!world.config.disableExpGrowing)person.Experience=(person.Experience+gain)&255;
    for(const u of before.units){if(u.state===8)continue;const p=expected.people[u.id-1];if(p.Experience>=100){p.Experience-=100;p.Level=(p.Level+1)&255;if(p.Level>world.config.maxLevel)p.Level=world.config.maxLevel;}}
  }
  victim.Arms-=hurt;exact(worldAfter,expected,'world');
  return {accepted:true,actorIndex,targetIndex,session,generation,hurt,targetArms:[target.arms,target.arms-hurt],
    experience:{before:world.people[actor.id-1].Experience,after:person.Experience,gain},nativeDisplays:traces.length,actualDevice:false};
}
