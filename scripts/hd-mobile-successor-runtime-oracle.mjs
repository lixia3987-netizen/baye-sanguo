// Pure validation of the original game's current successor picker. No input,
// files, native writes or name-to-ID recovery. The caller must double-read the
// same world/menu owner before confirmation. Settlement is sampled synchronously
// at the native completion notification, before the enclosing random month.
import assert from 'node:assert/strict';

export const mobileSuccessorContract = Object.freeze({
  people:200, cities:38, queue:2000, context:5, kind:1,
  nativeSources:['vendor/iBaye/src/cityedit.c:696-711,906-918',
    'vendor/iBaye/src/citycmdd.c:808-854',
    'vendor/iBaye/src/showface.c:852-859,922-942',
    'vendor/iBaye/src/hd-bridge.c:1111-1116','js/bridge.js:2640-2654'],
  scope:'Direct native candidate IDs cross-checked against GetKingPersons, report-active and synchronous KingOverDeal completion worlds; no random-month or RNG-continuity claim'
});
const uint=(v,max,label)=>{
  assert.ok(Number.isInteger(v)&&v>=0&&v<=max,label+' is an unsigned native integer');
  return v;
};
function worldShape(world) {
  assert.ok(world&&typeof world==='object','Current measured original world required');
  assert.ok(Number.isInteger(world.period)&&world.period>=1&&world.period<=4,'Original period 1..4');
  uint(world.king,199,'Current PlayerKing');
  assert.ok(Array.isArray(world.people)&&world.people.length===200,'All 200 original people required');
  assert.ok(Array.isArray(world.cities)&&world.cities.length===38,'All 38 original cities required');
  assert.ok(Array.isArray(world.queue)&&world.queue.length===2000,'Complete native person queue required');
  for(const [i,p] of world.people.entries()) {
    uint(p?.Belong,65535,'Person '+i+' Belong');
    assert.ok(p.Belong<=200||p.Belong===65535,'Person Belong is original faction/free/captive');
  }
  world.queue.forEach((v,i)=>uint(v,65535,'Person queue '+i));
  const occupiedPositions=new Set(), residentIds=new Set();
  for(const [i,c] of world.cities.entries()) {
    uint(c?.Belong,200,'City '+i+' Belong');
    uint(c?.PersonQueue,1999,'City '+i+' PersonQueue');
    uint(c?.Persons,200,'City '+i+' Persons');
    assert.ok(c.PersonQueue+c.Persons<=world.queue.length,'City active queue is in bounds');
    for(let j=0;j<c.Persons;j++) {
      const position=c.PersonQueue+j,id=world.queue[position];
      uint(id,199,'Active city queue person');
      assert.ok(!occupiedPositions.has(position),'City active queue ranges must not overlap');
      assert.ok(!residentIds.has(id),'Actual city residents must not duplicate an ID');
      occupiedPositions.add(position);residentIds.add(id);
    }
  }
  return world;
}

export function mobileSuccessorCandidateIds(world) {
  worldShape(world);
  const ids=[];
  // Exact native order: increasing city index, then each native resident queue.
  // Foreign/free/captive people present in a city are excluded by GetCityPersons.
  for(const c of world.cities) {
    if(c.Belong!==world.king+1)continue;
    for(let i=0;i<c.Persons;i++) {
      const id=world.queue[c.PersonQueue+i];
      if(world.people[id].Belong===c.Belong)ids.push(id);
    }
  }
  assert.ok(ids.length>0&&ids.length<=200,'A nonempty original successor list remains');
  return ids;
}

export function verifyMobileSuccessorChoice({world,menu,names}) {
  const candidateIds=mobileSuccessorCandidateIds(world);
  assert.ok(menu&&typeof menu==='object','Actual current menu required');
  assert.equal(menu.active,1,'Successor menu is active');
  assert.equal(menu.context,5,'Only the native CAMPAIGN context is accepted');
  assert.equal(menu.kind,1,'Only the native SUCCESSOR kind is accepted');
  assert.ok(uint(menu.seq,0xffffffff,'Menu sequence')>0,'Live menu sequence required');
  assert.ok(uint(menu.generation,0xffffffff,'Menu generation')>0,'Live menu generation required');
  assert.equal(menu.detailGeneration,menu.generation,'Menu detail generation is current');
  assert.equal(menu.itemLen,8,'Original person-name publication uses eight-byte slots');
  assert.equal(menu.count,candidateIds.length,'Every native successor is published');
  uint(menu.index,candidateIds.length-1,'Current selected successor index');
  assert.ok(Array.isArray(names)&&names.length===candidateIds.length,'Native full names correspond to derived IDs');
  for(const name of names)assert.ok(typeof name==='string'&&name.length>0&&name.trim()===name&&!name.includes('\0'),'Native names are complete and nonempty');
  assert.ok(Array.isArray(menu.names)&&menu.names.length===candidateIds.length,'Current menu has all names');
  assert.deepEqual(menu.names,names,'Published menu names equal native full names in derived queue order');
  if(menu.packedNames!==undefined)assert.deepEqual(menu.packedNames,names,'Packed native names are complete');
  assert.equal(menu.idsValid,true,'The current native successor owner publishes authenticated IDs');
  assert.deepEqual(menu.ids,candidateIds,'Direct zero-based IDs equal original city/resident queue order');
  return {accepted:true,oldKing:world.king,candidateIds,chosenIndex:menu.index,chosenId:candidateIds[menu.index],nativeNames:names.slice(),
    owner:{context:5,kind:1,seq:menu.seq,generation:menu.generation,detailGeneration:menu.detailGeneration},
    identitySource:'Direct native zero-based publication, independently checked against GetKingPersons/GetCityPersons and full names',
    successionOutcomeAccepted:false};
}

const PERSON_FIELDS=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const CITY_FIELDS=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce','PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms','PersonQueue','Persons','ToolQueue','Tools'];
const ORDER_FIELDS=['OrderId','Person','City','Object','Arms','Food','Money','Consume','TimeCount'];
function completeWorld(world) {
  worldShape(world);
  for(const field of ['year','month'])uint(world[field],field==='month'?12:65535,field);
  assert.ok(world.month>=1,'Actual month is published');
  for(const [i,p]of world.people.entries())for(const field of PERSON_FIELDS)uint(p[field],field==='Belong'||field==='OldBelong'||field==='Arms'||field==='Tool1'||field==='Tool2'?65535:255,'Person '+i+' '+field);
  for(const [i,c]of world.cities.entries())for(const field of CITY_FIELDS)uint(c[field],field==='Population'||field==='PopulationLimit'?0xffffffff:65535,'City '+i+' '+field);
  for(const [field,count,max]of [['orders',200,null],['fighters',600,255],['fighterIndex',30,255],['goodsQueue',2000,65535]]) {
    assert.ok(Array.isArray(world[field])&&world[field].length===count,'Complete '+field+' required');
    if(max!==null)world[field].forEach((v,i)=>uint(v,max,field+' '+i));
  }
  for(const [i,o]of world.orders.entries())for(const field of ORDER_FIELDS)uint(o[field],['OrderId','City','Consume','TimeCount'].includes(field)?255:65535,'Order '+i+' '+field);
  assert.ok(Array.isArray(world.tools)&&world.tools.length>0,'Actual full tool table required');
  for(const tool of world.tools)for(const field of ['useflag','changeAttackRange','at','iq','move','arm'])uint(tool[field],65535,'Tool '+field);
  assert.ok(world.config&&[0,1].includes(world.config.fixOverFlow16),'Actual overflow configuration required');
  return world;
}
function boundChoice(before,choice) {
  completeWorld(before);
  assert.ok(choice&&choice.accepted===true,'Authenticated current successor choice required');
  const ids=mobileSuccessorCandidateIds(before);
  assert.equal(choice.oldKing,before.king,'Choice binds the old player king');
  assert.deepEqual(choice.candidateIds,ids,'Choice candidates remain tied to this exact current world');
  uint(choice.chosenIndex,ids.length-1,'Chosen row');
  assert.equal(choice.chosenId,ids[choice.chosenIndex],'Chosen ID is the actual selected row');
  assert.ok(choice.owner&&choice.owner.context===5&&choice.owner.kind===1&&choice.owner.generation>0,'Choice native owner required');
  return ids;
}
export function verifyMobileSuccessorReport({before,during,choice,report}) {
  boundChoice(before,choice);completeWorld(during);
  assert.ok(report&&report.active===1&&report.kind===1&&report.seq>0&&report.inputSeq>0,'Actual blocking NewKingNote MSGBOX required');
  assert.ok(typeof report.text==='string'&&report.text.startsWith(choice.nativeNames[choice.chosenIndex]),'Report starts with the current native chosen name');
  const expected=structuredClone(before);expected.king=choice.chosenId;
  assert.deepEqual(during,expected,'During NewKingNote only PlayerKing has changed; devotion/ownership changes follow its return');
  return {accepted:true,stage:'new-king-report',oldKing:before.king,newKing:choice.chosenId,checkedWorld:true};
}
export function verifyMobileSuccessorSettlement({before,after,choice,receipt}) {
  const ids=boundChoice(before,choice);completeWorld(after);
  assert.ok(receipt&&receipt.generation===choice.owner.generation&&receipt.oldKing===before.king&&
    receipt.newKing===choice.chosenId&&receipt.playerKing===choice.chosenId,'Synchronous native completion receipt exactly binds the current choice');
  const expected=structuredClone(before),cities=[];
  expected.king=choice.chosenId;expected.people[choice.chosenId].Devotion=100;
  for(const [index,c]of expected.cities.entries())if(c.Belong===before.king+1){c.Belong=choice.chosenId+1;cities.push(index);}
  for(const id of ids)expected.people[id].Belong=choice.chosenId+1;
  assert.deepEqual(after,expected,'Complete KingOverDeal world changes only PlayerKing, selected devotion and exact old-faction city/person ownership');
  return {accepted:true,stage:'native-successor-committed',oldKing:before.king,newKing:choice.chosenId,cityIds:cities,personIds:ids,
    checked:{people:200,cities:38,queue:2000,orders:200,fighterBytes:600,fighterFlags:30,goodsQueue:2000},
    successionOutcomeAccepted:true,randomMonthAccepted:false,rngContinuityAccepted:false};
}
export function verifyMobileSuccessorBattleContext({world,battle,orderIndex}) {
  completeWorld(world);uint(orderIndex,199,'Current battle order index');
  assert.ok(battle&&battle.mode===1&&battle.over===2,'This scenario is an actual attacking army retreat');
  uint(battle.cityIndex,37,'Current battlefield city');uint(battle.playerFood,65535,'Current player grain');uint(battle.enemyFood,65535,'Current enemy grain');
  assert.ok(Array.isArray(battle.genArray)&&battle.genArray.length===20,'All actual battle person tokens required');
  battle.genArray.forEach((id,i)=>uint(id,200,'Battle token '+i));
  assert.ok(battle.genArray.slice(0,10).includes(world.king+1),'The old king belonged to the actual defeated army');
  const c=world.cities[battle.cityIndex],residents=world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons),old=world.people[world.king],order=world.orders[orderIndex];
  assert.equal(old.Belong,65535,'This genuine random branch captured the old king');assert.equal(old.OldBelong,world.king+1);assert.equal(old.Arms,0);
  assert.ok(residents.includes(world.king),'The captive is in the actual battlefield resident queue');
  for(const token of battle.genArray.slice(10).filter(Boolean))assert.ok(residents.includes(token-1),'Every actual winning defender returned to the battlefield city');
  assert.equal(order.OrderId,27);assert.equal(order.Object,battle.cityIndex);uint(order.Person,29,'Army slot');
  assert.equal(world.fighterIndex[order.Person],0,'BattleDrv released the actual allocation before settlement');
  return {accepted:true,oldKing:world.king,captiveCity:battle.cityIndex,orderIndex,armySlot:order.Person,
    winnerIds:battle.genArray.slice(10).filter(Boolean).map(v=>v-1),randomCaptureObserved:true};
}
export function verifyMobileSuccessorReturn({committed,returned,choice,orderIndex,armySlot}) {
  completeWorld(committed);completeWorld(returned);uint(orderIndex,199,'Current order');uint(armySlot,29,'Current army slot');
  assert.equal(returned.king,choice.chosenId);assert.equal(returned.people[choice.chosenId].Devotion,100);
  for(const [index,c]of committed.cities.entries())if(c.Belong===choice.chosenId+1)assert.equal(returned.cities[index].Belong,c.Belong,'Inherited city remains owned at current MAP');
  for(const id of choice.candidateIds)assert.equal(returned.people[id].Belong,choice.chosenId+1,'Inherited person remains owned at current MAP');
  assert.equal(returned.people[choice.oldKing].Belong,committed.people[choice.oldKing].Belong,'The actual captive remains a captive at terminal MAP');
  assert.equal(returned.orders[orderIndex].OrderId,255,'The exact processed battle order retired');
  assert.deepEqual({...returned.orders[orderIndex],OrderId:committed.orders[orderIndex].OrderId},committed.orders[orderIndex],'DelOrder changes only OrderId of the processed row');
  assert.equal(returned.fighterIndex[armySlot],0,'Retired army allocation stays released');
  return {accepted:true,stage:'terminal-map',randomMonthAccepted:false,
    limits:['Monthly random city/person/food changes are observed, not predicted by the succession oracle','Save/load independently binds the complete recorded terminal world']};
}
