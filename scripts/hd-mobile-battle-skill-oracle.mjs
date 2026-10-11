// Pure original-LIB skill30 evidence verifier. It never reads files or sends input.
// Effect acceptance is independent of the natural RNG outcome; no HD/movie claim.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileSpySkillContract = Object.freeze({
  skillId:30, mpCost:10, experienceAward:8, noAim:true,
  originalLib:{bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'},
  extraFields:['before/after.eneTmpProv','before.skills','world.config.disableExpGrowing','world.config.disableAllPersonReport','world.config.maxLevel'],
  reports:'reportObservations: [{observation: battleObservation + eneTmpProv, world: same-pause worldSource}]',
  scope:'One real same-bout skill30 command through SKILL -> BUSY -> fresh PICK; success or failure, exact measured world only',
  nativeSources:['vendor/iBaye/src/FightSub.c:53-85,380-448','vendor/iBaye/src/Fight.c:311-318,468-487,1050-1056,1431-1475',
    'vendor/iBaye/src/FgtPkAi.c:407-479','vendor/iBaye/src/FgtCount.c:259-277','vendor/iBaye/src/tactic.c:1445-1449',
    'vendor/iBaye/src/bind-objects.c:118,164-180,352-389,436-449','vendor/iBaye/src/infdeal.c:644-669','vendor/iBaye/src/PublicFun.c:664-684']
});
const PERSON_FIELDS=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const P16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY_FIELDS=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'];
const ORDER_FIELDS=['OrderId','City','Person','Object','TimeCount','Food'];
const uint=(n,max,label)=>{assert.ok(Number.isInteger(n)&&n>=0&&n<=max,label+' must be U'+(max===255?'8':max===65535?'16':'32'));return n;};
const seq=n=>{uint(n,0xffffffff,'native sequence');assert.ok(n>0,'Live native sequence must be positive');return n===0xffffffff?1:n+1;};
function exact(a,b,label,path='$'){
  if(Object.is(a,b))return;
  assert.ok(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object',label+' differs at '+path);
  assert.equal(Array.isArray(a),Array.isArray(b),label+' kind differs at '+path);
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),label+' fields differ at '+path);
  for(const k of Object.keys(b))exact(a[k],b[k],label,path+'.'+k);
}
function matches(a,b){try{exact(a,b,'Native checkpoint');return true;}catch{return false;}}
function array(a,n,max,label){assert.ok(Array.isArray(a)&&a.length===n,label+' exact length '+n);a.forEach((v,i)=>uint(v,max,label+'['+i+']'));}
function worldShape(w,label){
  assert.ok(w&&typeof w==='object',label+' required');assert.ok(Number.isInteger(w.period)&&w.period>=1&&w.period<=4,label+' actual period');
  uint(w.king,199,label+'.king');uint(w.year,65535,label+'.year');assert.ok(Number.isInteger(w.month)&&w.month>=1&&w.month<=12,label+' actual month');
  assert.ok(Array.isArray(w.people)&&w.people.length===200,label+' all 200 people');
  w.people.forEach((p,i)=>PERSON_FIELDS.forEach(k=>uint(p?.[k],P16.has(k)?65535:255,label+'.people['+i+'].'+k)));
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,label+' all 38 cities');
  w.cities.forEach((c,i)=>{CITY_FIELDS.forEach(k=>uint(c?.[k],['State','AvoidCalamity','PeopleDevotion'].includes(k)?255:65535,label+'.cities['+i+'].'+k));assert.ok(c.PersonQueue+c.Persons<=200,label+' active city queue range');});
  array(w.queue,2000,65535,label+'.queue');array(w.fighters,600,255,label+'.fighters');array(w.fighterIndex,30,1,label+'.fighterIndex');
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,label+' all 200 order slots');
  w.orders.forEach((o,i)=>ORDER_FIELDS.forEach(k=>uint(o?.[k],['OrderId','City','TimeCount'].includes(k)?255:65535,label+'.orders['+i+'].'+k)));
  assert.ok(w.config&&typeof w.config==='object',label+' actual config');
  for(const k of ['disableExpGrowing','disableAllPersonReport'])uint(w.config[k],1,label+'.config.'+k);
  assert.ok(Number.isInteger(w.config.maxLevel)&&w.config.maxLevel>=1&&w.config.maxLevel<=255,label+' actual maxLevel');
}
function libItem(b,id,index){
  const at=(id-1)*4;assert.ok(at>=0&&at+4<=b.length,'ROM table bounds');const base=b.readUInt32LE(at);assert.ok(base+14<=b.length,'ROM header bounds');
  const len=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);assert.equal(b.readUInt16LE(base+4),id,'ROM resource ID');
  assert.ok(index>=0&&index<count&&base+len<=b.length,'ROM item range');
  const off=fixed?14+index*fixed:count===1?14:b.readUInt32LE(base+14+index*8),size=fixed||(count===1?len-14:b.readUInt32LE(base+18+index*8));
  assert.ok(off>=14&&size>0&&off+size<=len,'ROM payload bounds');return b.subarray(base+off,base+off+size);
}
function library(input){
  assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes required');
  const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),r=mobileSpySkillContract.originalLib;
  assert.equal(b.length,r.bytes,'Original LIB size');assert.equal(createHash('sha256').update(b).digest('hex'),r.sha256,'Original LIB SHA');return b;
}
function unitsShape(o,w,label){
  assert.ok(o&&Array.isArray(o.units)&&o.units.length>0,label+' actual units');const slots=new Set(),people=new Set();
  for(const u of o.units){uint(u.i,19,label+' unit slot');assert.ok(!slots.has(u.i),label+' unique slots');slots.add(u.i);
    assert.ok(Number.isInteger(u.id)&&u.id>=1&&u.id<=200,label+' one-based person token');assert.ok(!people.has(u.id),label+' unique persons');people.add(u.id);
    assert.equal(u.side,u.i<10?'player':'enemy',label+' real slot side');for(const k of ['x','y','move','active','state'])uint(u[k],255,label+'.'+k);
    for(const k of ['hp','mp','arms'])uint(u[k],65535,label+'.'+k);assert.equal(u.arms,w.people[u.id-1].Arms,label+' unit Arms binds person');
  }
  uint(o.eneTmpProv,65535,label+'.eneTmpProv');uint(o.food?.player,65535,label+' player grain');uint(o.food?.enemy,65535,label+' enemy grain');
  assert.ok(Number.isInteger(o.weather)&&o.weather>=1&&o.weather<=5,label+' weather');assert.ok(o.fight&&o.report,label+' native owner snapshots');
  for(const k of ['keys','touches'])assert.ok(Number.isSafeInteger(o[k])&&o[k]>=0,label+' input count '+k);
  assert.equal(o.fight.active,1,label+' battle remains active');assert.equal(o.fight.over,0,label+' battle not ended');assert.equal(o.nativeOver,0,label+' native battle not ended');
}
function invariant(o,before,label){
  for(const k of ['food','weather','nativeOver','settings','pcBattle']){assert.ok(Object.hasOwn(o,k)&&Object.hasOwn(before,k),label+' includes '+k);exact(o[k],before[k],label+' invariant '+k);}
  for(const k of ['bout','boutMax','cityIndex','mapW','mapH'])assert.equal(o.fight[k],before.fight[k],label+' same battle '+k);
}
/** Inputs are immutable JSON evidence, except libBytes which is the frozen actual LIB.
 * The caller must separately bind these records to trusted input/source/cleanup evidence.
 * Failure uses PlcGraMsgBox with no report owner; do not invent a failure GREPORT.
 */
export function verifyMobileSpySkill({before,after,world,worldAfter,reportObservations,libBytes,actorIndex,skillId}={}){
  assert.equal(skillId,30,'Only native spy skill30');uint(actorIndex,9,'Player actor slot');
  worldShape(world,'before world');worldShape(worldAfter,'after world');unitsShape(before,world,'before');unitsShape(after,worldAfter,'after');
  const lib=library(libBytes),effects=libItem(lib,10,0);assert.equal(effects.length,30*34,'All actual SKILLEF records');const ef=effects.subarray(29*34,30*34);
  assert.equal(ef[6],10,'Actual skill30 MP10');assert.equal(ef[1],0,'No state effect');assert.equal(ef.readUInt16LE(2),0,'No Arms power');assert.equal(ef.readUInt16LE(4),0,'No grain damage');
  assert.ok(Array.from(ef.subarray(7,12)).every(n=>n===100)&&Array.from(ef.subarray(20,28)).every(n=>n===100),'Actual all-weather/all-own-terrain skill30 availability');
  const actor=before.units.find(u=>u.i===actorIndex);assert.ok(actor&&actor.side==='player','Current actual player actor');assert.equal(world.people[actor.id-1].Belong,world.king+1,'Actor is currently player owned');
  assert.equal(actor.active,0,'Actor has not acted');assert.notEqual(actor.state,8,'Actor alive');assert.notEqual(actor.state,2,'Actor not spell sealed');assert.ok(actor.hp>0&&actor.arms>0,'Living armed actor');assert.ok(actor.mp>=ef[6],'Native MP budget');
  assert.equal(before.fight.inputKind,4,'Before is native SKILL');assert.equal(before.fight.actorIndex,actorIndex,'Before actual SKILL actor');assert.equal(before.fight.wait,0);assert.equal(before.fight.phase,0);
  const m=before.menu,s=before.skills;assert.ok(m&&m.active===1&&m.context===3&&m.kind===4,'Real fight SKILL menu owner');seq(m.seq);
  assert.ok(s&&s.active===1&&Number.isInteger(s.count)&&s.count>0&&s.count<=10,'Actual skill publication');assert.equal(m.count,s.count);
  assert.ok(Array.isArray(s.ids)&&Array.isArray(s.names)&&s.ids.length===s.count&&s.names.length===s.count,'Complete actual skill IDs/names');
  s.ids.forEach(id=>{assert.ok(Number.isInteger(id)&&id>=1&&id<=30,'Native skill ID range');});assert.equal(new Set(s.ids).size,s.count,'Unique actual skill IDs');exact(m.names,s.names,'Menu names bind skill publication');
  assert.ok(Number.isInteger(m.index)&&m.index>=0&&m.index<s.count,'Actual selected native skill index');assert.equal(s.ids[m.index],30,'Currently focused actual spy skill');
  const decode=new TextDecoder('gbk'),skillName=decode.decode(libItem(lib,11,29)).replace(/\u0000/g,'').trimEnd();assert.equal(s.names[m.index],skillName,'Actual ROM spy name');
  assert.equal(before.report.active,0,'No report already owns input');assert.equal(before.eneTmpProv,0,'Fresh unknown enemy grain required');assert.ok(before.food.enemy>0,'Nonzero enemy grain makes success/failure independently observable');
  invariant(after,before,'After');assert.equal(after.fight.inputKind,1,'Fresh PICK after command');assert.equal(after.fight.actorIndex,255,'PICK has no selected actor');assert.equal(after.fight.wait,1);assert.equal(after.fight.phase,1);
  const busySeq=seq(before.fight.inputSeq);assert.equal(after.fight.inputSeq,seq(busySeq),'Exactly SKILL-end then next PICK owner');assert.equal(after.report.active,0,'All native reports retired');assert.equal(after.menu?.active,0,'Native skill menu retired');
  const succeeded=after.eneTmpProv===before.food.enemy;assert.ok(succeeded||after.eneTmpProv===0,'Only exact enemy-grain reveal or unchanged unknown state');
  const expectedWorld=structuredClone(world),expectedUnits=structuredClone(before.units),ea=expectedUnits.find(u=>u.i===actorIndex);ea.mp-=ef[6];ea.active=1;
  const pausedUnits=structuredClone(expectedUnits),pausedWorld=structuredClone(expectedWorld),transitions=[];let focus={x:before.fight.focusX,y:before.fight.focusY};
  if(succeeded){
    if(!world.config.disableExpGrowing)expectedWorld.people[actor.id-1].Experience=(expectedWorld.people[actor.id-1].Experience+8)&255;
    // FgtChkAtkEnd executes even when experience growth is disabled. Preserve C order.
    for(const u of [...expectedUnits].sort((a,b)=>a.i-b.i)){
      if(u.state===8)continue;const p=expectedWorld.people[u.id-1];
      if(p.Experience>=100){p.Experience-=100;p.Level=(p.Level+1)&255;if(p.Level>world.config.maxLevel)p.Level=world.config.maxLevel;
        focus={x:u.x,y:u.y};transitions.push({kind:'upgrade',personId:u.id-1,slot:u.i,world:structuredClone(expectedWorld),units:structuredClone(expectedUnits)});}
      if(!u.hp||!p.Arms){u.state=8;focus={x:u.x,y:u.y};transitions.push({kind:'death',personId:u.id-1,slot:u.i,world:structuredClone(expectedWorld),units:structuredClone(expectedUnits)});}
    }
  }
  exact(worldAfter,expectedWorld,'Only exact native skill/status world changes');exact(after.units,expectedUnits,'Only MP/active and exact native status changes');
  assert.equal(after.fight.focusX,focus.x,'Native post-command focus X');assert.equal(after.fight.focusY,focus.y,'Native post-command focus Y');
  assert.ok(Array.isArray(reportObservations),'Actual report observations array required');
  const successText=decode.decode(libItem(lib,1,54)),upgradeTexts=[38,39,40].map(i=>decode.decode(libItem(lib,1,i))),deathTexts=[41,42,43].map(i=>decode.decode(libItem(lib,1,i)));
  const owners=new Map(),transitionOwners=new Map();let spySeen=false,spyOwner=null,lastReport=null;
  for(const [i,r] of reportObservations.entries()){
    assert.ok(r&&r.observation&&r.world,'Report observation '+i+' includes same-pause battle and world');const o=r.observation;
    worldShape(r.world,'report world '+i);unitsShape(o,r.world,'report '+i);invariant(o,before,'Report '+i);
    assert.equal(o.fight.inputKind,0,'Report pause remains BUSY, never AIM');assert.equal(o.fight.actorIndex,255);assert.equal(o.fight.inputSeq,busySeq,'Report pause binds the command owner');
    assert.equal(o.eneTmpProv,succeeded?before.food.enemy:0,'Report actual revealed grain');const rp=o.report;
    assert.equal(rp.active,1,'Only actual active GREPORT observations supplied');assert.equal(rp.kind,2,'Native GREPORT kind');uint(rp.seq,65535,'Report publication seq');assert.ok(rp.seq>0,'Positive report publication');seq(rp.inputSeq);
    assert.ok(o.keys>=before.keys+1&&o.keys<=after.keys,'Report keys are inside this real command');
    assert.ok(o.touches>=before.touches&&o.touches<=after.touches,'Report touches are inside this real command');
    assert.ok(succeeded,'Failure has no GREPORT owner');let checkpoint,transitionIndex=-1;
    const ownerKey=JSON.stringify([rp.seq,rp.inputSeq,rp.person,rp.text]);
    if(rp.text===successText){assert.equal(rp.person,actor.id-1,'Spy report actual caster PID');checkpoint={world:pausedWorld,units:pausedUnits};
      assert.ok(spyOwner===null||spyOwner===ownerKey,'Only one actual spy report owner');spyOwner=ownerKey;spySeen=true;}
    else {transitionIndex=transitions.findIndex(t=>t.personId===rp.person&&(t.kind==='upgrade'?upgradeTexts:deathTexts).includes(rp.text)&&
      matches(t.world,r.world)&&matches(t.units,o.units));checkpoint=transitions[transitionIndex];
      assert.ok(!transitionOwners.has(transitionIndex)||transitionOwners.get(transitionIndex)===ownerKey,'One owner per actual native status report');transitionOwners.set(transitionIndex,ownerKey);}
    assert.ok(checkpoint,'Report must match exact spy/status branch and person');exact(r.world,checkpoint.world,'Report paused world');exact(o.units,checkpoint.units,'Report paused units');
    const prior=owners.get(ownerKey);if(prior)exact(prior,rp,'Stable report publication');else owners.set(ownerKey,structuredClone(rp));lastReport=structuredClone(rp);
  }
  if(succeeded&&!world.config.disableAllPersonReport){assert.ok(spySeen,'Real success GREPORT pause required');
    assert.equal(transitionOwners.size,transitions.length,'Every actual status report pause observed');assert.equal(owners.size,1+transitions.length,'Exact spy/status report owner count');
    exact(after.report,{...lastReport,active:0,inputSeq:seq(lastReport.inputSeq)},'Last actual report retired into the final PICK');}
  if(!succeeded||world.config.disableAllPersonReport)assert.equal(reportObservations.length,0,'No fabricated active report for failure/disabled reports');
  const keyDelta=after.keys-before.keys,touchDelta=after.touches-before.touches;
  assert.ok(Number.isInteger(keyDelta)&&keyDelta>=1,'Real skill confirmation key recorded');assert.ok(Number.isInteger(touchDelta)&&touchDelta>=0&&touchDelta%2===0,'Only complete recorded LCD DOWN/UP pairs');
  const acknowledgements=keyDelta-1+touchDelta/2;assert.ok(acknowledgements<=owners.size,'At most one acknowledgement per observed native report');
  if(!succeeded)assert.equal(acknowledgements,0,'Failed graphic note retires naturally in this bounded path');
  return {ok:true,accepted:true,skillEffectAccepted:true,skillId:30,actorIndex,personId:actor.id-1,outcome:succeeded?'success':'failure',naturalOutcome:succeeded?'success':'failure',
    mp:{before:actor.mp,after:ea.mp,cost:ef[6]},active:{before:actor.active,after:ea.active},enemyGrain:{before:before.eneTmpProv,after:after.eneTmpProv,actualEnemy:before.food.enemy},
    experience:{award:succeeded&&!world.config.disableExpGrowing?8:0,before:world.people[actor.id-1].Experience,after:worldAfter.people[actor.id-1].Experience},
    level:{before:world.people[actor.id-1].Level,after:worldAfter.people[actor.id-1].Level,max:world.config.maxLevel},statusTransitions:transitions.map(({kind,personId,slot})=>({kind,personId,slot})),
    report:{observedOwners:owners.size,spyReportObserved:spySeen,recordedAcknowledgements:acknowledgements,keyDelta,touchDelta,retired:true},
    battleBout:after.fight.bout,hdAccepted:false,battleCompletionAccepted:false,naturalReleaseAccepted:false,
    checked:{people:200,cities:38,queue:2000,orderRows:200,fighterBytes:600,fighterFlags:30},
    scope:mobileSpySkillContract.scope,
    limits:['RNG state is neither read nor written; source/trusted-input evidence must establish no forced outcome',
      'Only measured worldSource fields; unobserved OrderType Arms/Money/Consume are not byte-exact',
      'Input counters bound acknowledgements; exact trusted key/touch codes and owner timing remain caller evidence',
      'No attack damage, ordinary skill movie/NUM, battle victory, strategy return, or whole mobile HD acceptance']};
}
