// Pure saved-evidence checks for original mobile CAMPAIGN/DEFENDERS.
// No input, browser, files, native writes or name-to-ID inference. The caller
// authenticates original LIB/source bytes, opaque data and trusted current UI.
import assert from 'node:assert/strict';

export const mobileDefenderContract = Object.freeze({
  people:200,cities:38,queue:2000,orders:200,fighterBytes:600,fighterSlots:30,
  context:5,kind:2,playerSlots:10,totalSlots:20,
  nativeSources:['vendor/iBaye/src/citycmdd.c:262-339','vendor/iBaye/src/cityedit.c:108-145,696-711',
    'vendor/iBaye/src/showface.c:852-859,872-873,923-943',
    'vendor/iBaye/src/Fight.c:79-105,920-931,1050-1093,1431-1474',
    'vendor/iBaye/src/FgtCount.c:85-109,119-145','vendor/iBaye/src/hd-bridge.c:1468-1497,1679-1685'],
  scope:'Direct defender IDs and exact DelPerson selections; explicit EXIT or natural exhausted/ten-choice entry to the first unmodified defensive PICK; no battle outcome, random-month, RNG or complete ABI claim'
});
const PERSON_FIELDS=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const CITY_FIELDS=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce','PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms','PersonQueue','Persons','ToolQueue','Tools'];
const ORDER_FIELDS=['OrderId','Person','City','Object','Arms','Food','Money','Consume','TimeCount'];
function uint(value,max,label){assert.ok(Number.isInteger(value)&&value>=0&&value<=max,label+' must be a native unsigned integer');return value;}
function array(value,count,max,label){
  assert.ok(Array.isArray(value)&&value.length===count,label+' complete length '+count);
  for(const [i,v]of value.entries())uint(v,max,label+'['+i+']');return value;
}
// Bounded errors avoid printing complete saved worlds on a failed comparison.
function exact(actual,expected,label,path='$'){
  if(Object.is(actual,expected))return;
  assert.ok(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object',label+' differs at '+path);
  assert.equal(Array.isArray(actual),Array.isArray(expected),label+' type differs at '+path);
  const a=Object.keys(actual).sort(),e=Object.keys(expected).sort();
  assert.deepEqual(a,e,label+' fields differ at '+path);
  for(const k of e)exact(actual[k],expected[k],label,path+'.'+k);
}
function worldShape(w){
  assert.ok(w&&typeof w==='object','Complete measured original world required');
  assert.ok(uint(w.period,4,'Period')>=1,'Original period 1..4');uint(w.king,199,'PlayerKing');
  uint(w.year,65535,'Year');assert.ok(uint(w.month,12,'Month')>=1,'Actual month required');
  assert.ok(Array.isArray(w.people)&&w.people.length===200,'All original 200 people required');
  for(const [i,p]of w.people.entries()){
    for(const k of PERSON_FIELDS)uint(p?.[k],['Belong','OldBelong','Arms','Tool1','Tool2'].includes(k)?65535:255,'Person '+i+' '+k);
    assert.ok(p.Belong<=200||p.Belong===65535,'Actual original person faction/free/captive');
  }
  array(w.queue,2000,65535,'Resident queue');
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,'All original 38 cities required');
  const usedPositions=new Set(),residentIds=new Set();
  for(const [i,c]of w.cities.entries()){
    for(const k of CITY_FIELDS)uint(c?.[k],['Population','PopulationLimit'].includes(k)?0xffffffff:65535,'City '+i+' '+k);
    uint(c.Belong,200,'City faction');uint(c.PersonQueue,200,'Active queue offset');uint(c.Persons,200,'Active resident count');
    assert.ok(c.PersonQueue+c.Persons<=200,'Original city residents lie in active first 200 queue slots');
    for(let j=0;j<c.Persons;j++){
      const q=c.PersonQueue+j,id=uint(w.queue[q],199,'Resident ID');
      assert.ok(!usedPositions.has(q),'City active queue ranges do not overlap');
      // Original saves may retain a person ID in different city ranges.
      usedPositions.add(q);residentIds.add(id);
    }
  }
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,'All 200 order rows required');
  for(const [i,o]of w.orders.entries())for(const k of ORDER_FIELDS)uint(o?.[k],['OrderId','City','Consume','TimeCount'].includes(k)?255:65535,'Order '+i+' '+k);
  array(w.fighters,600,255,'Fighter bytes');array(w.fighterIndex,30,255,'Fighter allocation flags');array(w.goodsQueue,2000,65535,'Goods queue');
  assert.ok(Array.isArray(w.tools)&&w.tools.length>0,'Complete actual tool table required');
  for(const [i,t]of w.tools.entries())for(const k of ['useflag','changeAttackRange','at','iq','move','arm'])uint(t?.[k],65535,'Tool '+i+' '+k);
  assert.ok(w.config&&typeof w.config==='object'&&!Array.isArray(w.config),'Actual sampled configuration required');
  assert.ok([0,1].includes(w.config.fixOverFlow16),'Actual overflow configuration required');
  return {residentIds};
}
function nativeShape(n){
  assert.ok(n&&typeof n==='object','Actual native sample required');
  assert.ok(uint(n.detailGeneration,0xffffffff,'Detail generation')>0,'Current generation required');
  uint(n.keys,Number.MAX_SAFE_INTEGER,'Observed key count');uint(n.touches,Number.MAX_SAFE_INTEGER,'Observed native LCD touch count');
  assert.ok(n.menu&&n.report&&n.fight&&n.battle,'Menu, report, fight and battle samples required');
  uint(n.menu.seq,0xffffffff,'Menu sequence');uint(n.report.active,1,'Report active');uint(n.fight.active,1,'Fight active');
  const b=n.battle;assert.equal(b.mode,0,'Only genuine FGT_DF defense is accepted');uint(b.over,255,'Native battle result');
  uint(b.cityIndex,37,'Battle city');uint(b.playerFood,65535,'Player grain');uint(b.enemyFood,65535,'Enemy grain');
  array(b.genArray,20,200,'All battle person tokens');uint(b.mainGenIndex,19,'Actual g_MainGenIdx');
  assert.ok(Array.isArray(b.positions)&&b.positions.length===20,'All 20 current native positions required');
  for(const [i,p]of b.positions.entries())for(const k of ['x','y','hp','mp','move','active','state'])uint(p?.[k],['hp','mp'].includes(k)?65535:255,'Position '+i+' '+k);
}
const next=v=>v===0xffffffff?1:v+1;
function residents(w,cityIndex){const c=w.cities[cityIndex];return w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>w.people[id].Belong===c.Belong);}
function formation(w,n){
  const tokens=n.battle.genArray,selectedTokens=tokens.slice(0,10),enemyTokens=tokens.slice(10),selected=[];
  let ended=false;for(const token of selectedTokens){if(token===0){ended=true;continue;}assert.ok(!ended,'Selected defenders are a contiguous prefix');selected.push(token-1);}
  assert.equal(new Set(selected).size,selected.length,'No defender is selected twice');
  assert.ok(enemyTokens[0]>0,'Actual incoming army has its first commander');
  const nonzero=tokens.filter(Boolean);assert.equal(new Set(nonzero).size,nonzero.length,'All actual occupied battle slots are distinct');
  for(const id of selected)assert.equal(w.people[id].Belong,w.king+1,'Selected defenders belong to the player');
  const enemyBelong=w.people[enemyTokens[0]-1].Belong;
  assert.ok(enemyBelong>=1&&enemyBelong<=200&&enemyBelong!==w.king+1,'Incoming commander belongs to a genuine opposing faction');
  return {selectedIds:selected,enemyTokens};
}
function incoming(w,n){
  const cityIndex=n.battle.cityIndex,c=w.cities[cityIndex];assert.equal(c.Belong,w.king+1,'Battle city is currently player owned');
  assert.equal(n.battle.playerFood,c.Food,'BattleDrv copied actual city grain without spending it');
  const matches=[];
  for(const [orderIndex,o]of w.orders.entries()){
    if(o.OrderId!==27||o.Object!==cityIndex||!Number.isInteger(o.Person)||o.Person<0||o.Person>=30)continue;
    const enemy=Array.from({length:10},(_,i)=>{const p=(o.Person*10+i)*2;return w.fighters[p]+256*w.fighters[p+1];});
    if(enemy.every((token,i)=>token===n.battle.genArray[10+i]))matches.push({orderIndex,armySlot:o.Person,incomingOrder:structuredClone(o)});
  }
  assert.equal(matches.length,1,'Exactly one current Order27/target/complete ten LE-U16 fighter slot matches the incoming army');
  const match=matches[0];assert.equal(w.fighterIndex[match.armySlot],0,'BattleDrv has released this actual incoming army allocation');
  assert.equal(n.battle.enemyFood,match.incomingOrder.Food,'Actual incoming order grain copied exactly');
  return match;
}
function picker(world,native,names){
  const shape=worldShape(world);nativeShape(native);const m=native.menu;
  assert.equal(m.active,1,'Current defender picker is active');assert.equal(m.context,5,'Exact CAMPAIGN context');assert.equal(m.kind,2,'Exact DEFENDERS kind');
  assert.ok(m.seq>0,'Live menu sequence');assert.equal(m.generation,native.detailGeneration,'Menu generation is current');assert.equal(m.detailGeneration,native.detailGeneration,'Menu detail generation is current');
  assert.equal(m.itemLen,8,'Original native person-name slots are eight bytes');assert.equal(native.report.active,0,'No competing native report');assert.equal(native.fight.active,0,'GamFight has not started');
  const f=formation(world,native);assert.ok(f.selectedIds.length<10,'A live picker has fewer than ten already selected defenders');
  for(const id of f.selectedIds)assert.ok(!world.queue.slice(world.cities[native.battle.cityIndex].PersonQueue,world.cities[native.battle.cityIndex].PersonQueue+world.cities[native.battle.cityIndex].Persons).includes(id),'Selected defender is removed from this defended city; unrelated legacy city entries remain');
  const candidateIds=residents(world,native.battle.cityIndex);assert.ok(candidateIds.length>0,'Only a nonempty real resident picker is live');
  assert.equal(m.count,candidateIds.length,'The full remaining in-service resident list is published');uint(m.index,candidateIds.length-1,'Current menu index');
  assert.equal(m.idsValid,true,'Current native direct-ID owner is authenticated');array(m.ids,candidateIds.length,199,'Direct menu IDs');exact(m.ids,candidateIds,'Direct IDs equal GetCityPersons resident order');
  assert.ok(Array.isArray(names)&&names.length===candidateIds.length,'Current getPersonName values for every actual ID required');
  for(const name of names)assert.ok(typeof name==='string'&&name.length>0&&name.trim()===name&&!name.includes('\0'),'Full current native names are nonempty');
  exact(m.names,names,'Current published full names');exact(m.packedNames,names,'Complete native packed-name slots');
  const order=incoming(world,native);
  return {accepted:true,cityIndex:native.battle.cityIndex,candidateIds,selectedIds:f.selectedIds,nativeNames:names.slice(),
    owner:{context:5,kind:2,seq:m.seq,generation:native.detailGeneration,index:m.index,count:m.count},...order,
    incomingSource:'Unique current-world Order27/Object/complete ten LE-U16 fighter-slot match; not a directly published BattleDrv local',
    actualInputAccepted:false,battleAccepted:false};
}
export function verifyMobileDefenderPicker({world,native,names}){return picker(world,native,names);}

// Last selected row always performs exactly one original DelPerson. This
// common transition does not accept a battle, an EXIT, or arbitrary menu drift.
function selectedDefenderTransition(before,after,chosenIndex){
  assert.ok(before&&after,'Before and after samples required');
  const p=picker(before.world,before.native,before.native?.menu?.names);uint(chosenIndex,p.candidateIds.length-1,'Chosen actual row');
  worldShape(after.world);nativeShape(after.native);const chosenId=p.candidateIds[chosenIndex],expected=structuredClone(before.world),c=expected.cities[p.cityIndex];
  const absolute=c.PersonQueue+before.world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).indexOf(chosenId);
  assert.ok(absolute>=c.PersonQueue&&absolute<c.PersonQueue+c.Persons,'Actual chosen resident is present');
  for(let i=absolute;i<199;i++)expected.queue[i]=before.world.queue[i+1];c.Persons--;
  for(let i=p.cityIndex+1;i<38;i++){assert.ok(expected.cities[i].PersonQueue>0,'Later city offset cannot underflow in this original scenario');expected.cities[i].PersonQueue--;}
  exact(after.world,expected,'One native DelPerson changes only the exact full queue/city offsets');
  const expectedBattle=structuredClone(before.native.battle);expectedBattle.genArray[p.selectedIds.length]=chosenId+1;
  assert.equal(after.native.detailGeneration,before.native.detailGeneration,'Selection stays in the same library/detail generation');
  assert.equal(after.native.touches,before.native.touches,'HD selection does not inject native LCD touches');
  assert.equal(after.native.keys-before.native.keys,Math.abs(chosenIndex-before.native.menu.index)+1,'Exactly the necessary focus arrows and one ENTER were observed');
  return {p,chosenId,expectedBattle,absolute,remaining:residents(after.world,p.cityIndex),selectedIds:[...p.selectedIds,chosenId]};
}
export function verifyMobileDefenderSelection({before,after,chosenIndex}){
  const {p,chosenId,expectedBattle,absolute,remaining,selectedIds}=selectedDefenderTransition(before,after,chosenIndex);
  exact(after.native.battle,expectedBattle,'One defender appends token ID+1 without mutating any other battle field');
  let freshPicker=null;
  if(selectedIds.length<10&&remaining.length>0){
    freshPicker=picker(after.world,after.native,after.native.menu.names);
    assert.equal(after.native.menu.seq,next(next(before.native.menu.seq)),'Old menu ended and a fresh defender menu began');
    assert.equal(after.native.menu.index,0,'Each real ShowPersonControl restarts at row zero');
    assert.equal(freshPicker.orderIndex,p.orderIndex,'Same incoming order');assert.equal(freshPicker.armySlot,p.armySlot,'Same incoming fighter slot');
  }else{
    assert.equal(after.native.menu.active,0,'Ten selections or exhausted residents end the picker naturally');
    assert.equal(after.native.menu.context,0);assert.equal(after.native.menu.kind,0);
    assert.equal(after.native.menu.idsValid,false);exact(after.native.menu.ids,[],'Retired direct IDs are empty');
  }
  return {accepted:true,cityIndex:p.cityIndex,chosenIndex,chosenId,selectedIds,absoluteQueueIndex:absolute,
    orderIndex:p.orderIndex,armySlot:p.armySlot,freshPicker:!!freshPicker,remainingIds:remaining,
    checked:{queue:2000,cities:38,people:200,orders:200,fighterBytes:600,goodsQueue:2000},
    actualInputAccepted:false,battleAccepted:false};
}

// Shared ordinary first PICK checks. Callers separately prove the exact
// strategic-world transition, input count and source-specific menu lifecycle.
function firstDefensivePick(before,after,p,expectedFormation){
  const b=after.native.battle,f=after.native.fight,m=after.native.menu;
  assert.equal(after.native.detailGeneration,before.native.detailGeneration,'Same current detail generation');
  assert.equal(after.native.touches,before.native.touches,'No native LCD touch during finish');
  assert.equal(m.active,0);assert.equal(m.context,0);assert.equal(m.kind,0);assert.equal(m.idsValid,false);exact(m.ids,[],'Retired defender IDs');
  assert.equal(after.native.report.active,0,'First PICK is not an initialization report');
  assert.equal(f.active,1);assert.equal(f.over,0);assert.equal(f.wait,1);assert.equal(f.phase,1);assert.equal(f.inputKind,1);assert.equal(f.actorIndex,255);
  assert.ok(uint(f.inputSeq,0xffffffff,'PICK input sequence')>0,'Current PICK owner');assert.equal(f.bout,1,'Only the first player PICK before any AI turn is accepted');
  uint(f.skip,255,'Retained fight-skip diagnostic');assert.equal(f.cityIndex,p.cityIndex);
  assert.ok(uint(f.mapW,255,'Map width')>0&&uint(f.mapH,255,'Map height')>0,'Actual battle geometry');
  assert.equal(b.over,0);assert.equal(b.mainGenIndex,10,'Defense commander is the attacking first enemy slot');
  assert.equal(b.cityIndex,p.cityIndex);assert.equal(b.playerFood,before.native.battle.playerFood);assert.equal(b.enemyFood,before.native.battle.enemyFood);
  exact(b.genArray,expectedFormation,'Final formation preserves selected defenders and all ten incoming enemy slots');
  incoming(after.world,after.native);
  for(const [slot,token]of b.genArray.entries()){
    const pos=b.positions[slot];assert.equal(pos.active,0,'Initial bout restores every slot to WAIT');
    if(token===0){assert.equal(pos.state,8,'An empty actual formation slot is STATE_SW');continue;}
    const person=before.world.people[token-1];
    assert.ok(person.Experience<100,'Initialization upgrade is outside this no-business-mutation battle-entry scope');
    assert.ok(person.Arms>0,'Zero-arms initialization death is outside this battle-entry scope');
    const hp=Math.floor((Math.floor(person.Force*80/100)+Math.floor(person.IQ*30/100)+person.Level)*person.Thew/100);
    assert.ok(hp>0,'Zero-HP initialization death is outside this battle-entry scope');assert.equal(pos.hp,hp,'Initial HP follows native integer CountBaseAttr');
    assert.equal(pos.state,0,'Occupied initial slot is normal before any action');assert.ok(pos.x<f.mapW&&pos.y<f.mapH,'Actual initial unit lies inside the native map');
  }
}
export function verifyMobileDefenderBattle({before,after}){
  assert.ok(before&&after,'Finish and first PICK samples required');
  const p=picker(before.world,before.native,before.native?.menu?.names);worldShape(after.world);nativeShape(after.native);
  assert.ok(p.selectedIds.length>=1&&p.selectedIds.length<10,'Explicit EXIT scope has at least one selected defender and a remaining live picker');
  assert.equal(after.native.keys,before.native.keys+1,'Exactly one finish key before the first PICK');
  // ShowPersonControl end, GamFight reset set_fight(0), then set_fight(1) each end menu.
  assert.equal(after.native.menu.seq,next(next(next(before.native.menu.seq))),'Exact no-extra-report explicit EXIT to GamFight menu retirement');
  firstDefensivePick(before,after,p,before.native.battle.genArray);
  exact(after.world,before.world,'Explicit finish/ordinary first defensive PICK does not mutate the complete measured strategic world');
  const b=after.native.battle,f=after.native.fight;
  return {accepted:true,stage:'first-defensive-pick',cityIndex:p.cityIndex,selectedIds:p.selectedIds,
    enemyTokens:b.genArray.slice(10),orderIndex:p.orderIndex,armySlot:p.armySlot,mainGenIndex:10,firstBout:1,
    measuredWorldUnchanged:true,retainedFightSkip:f.skip,actualInputAccepted:false,battleOutcomeAccepted:false,
    notCovered:['Trusted UI/current opaque data/source provenance are checked by the actual caller',
      'RNG state, unused native globals, MP/move and map-position initialization formulas',
      'Initialization upgrades/deaths, zero/exhausted/ten-choice battle entry, AI turns, battle result and monthly settlement']};
}

export function verifyMobileDefenderFinalSelection({before,after,chosenIndex}){
  const {p,chosenId,expectedBattle,absolute,remaining,selectedIds}=selectedDefenderTransition(before,after,chosenIndex);
  const filledTen=selectedIds.length===10;
  assert.ok(filledTen||remaining.length===0,'Only the tenth defender or exhaustion of actual in-service residents may enter GamFight without EXIT');
  // BattleDrv's next empty ShowPersonControl still performs begin/end before
  // its pcount==0 inner return. A full ten-choice loop skips that extra call.
  // Last end + empty begin/end + GamFight set_fight(0/1) =5; ten-choice =3.
  const increments=filledTen?3:5;let seq=before.native.menu.seq;for(let i=0;i<increments;i++)seq=next(seq);
  assert.equal(after.native.menu.seq,seq,'Exact natural final-selection menu retirement, including skip-zero U32 wrap');
  firstDefensivePick(before,after,p,expectedBattle.genArray);
  return {accepted:true,stage:'final-selection-first-defensive-pick',cityIndex:p.cityIndex,chosenIndex,chosenId,
    selectedIds,remainingIds:remaining,absoluteQueueIndex:absolute,termination:filledTen?'ten-selected':'resident-exhausted',menuSequenceIncrements:increments,
    enemyTokens:after.native.battle.genArray.slice(10),orderIndex:p.orderIndex,armySlot:p.armySlot,mainGenIndex:10,firstBout:1,
    measuredWorldOnlyLastDelPerson:true,retainedFightSkip:after.native.fight.skip,actualInputAccepted:false,battleOutcomeAccepted:false,
    notCovered:['Trusted UI/current opaque data/source provenance are checked by the actual caller',
      'RNG state, unused native globals, MP/move and map-position initialization formulas',
      'Initialization upgrades/deaths, zero-defender automatic battle, AI turns, battle result and monthly settlement']};
}
