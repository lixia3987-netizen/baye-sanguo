// Pure validation of the original game's current successor picker. No input,
// files, native writes or name-to-ID recovery. The caller must double-read the
// same world/menu owner before its single public confirmation and verify the
// resulting PlayerKing afterwards; this is not a settlement outcome oracle.
import assert from 'node:assert/strict';

export const mobileSuccessorContract = Object.freeze({
  people:200, cities:38, queue:2000, context:5, kind:1,
  nativeSources:['vendor/iBaye/src/cityedit.c:696-711,906-918',
    'vendor/iBaye/src/citycmdd.c:808-854',
    'vendor/iBaye/src/showface.c:852-859,922-942',
    'vendor/iBaye/src/hd-bridge.c:1111-1116','js/bridge.js:2640-2654'],
  scope:'Exact current original GetKingPersons/GetCityPersons list and selected native index; no confirmation or succession outcome claim'
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
  // kind1 deliberately has idsValid=false in the current public ABI. Do not
  // relabel it as an ID publication. If a future ABI supplies IDs, bind them too.
  if(menu.idsValid===true)assert.deepEqual(menu.ids,candidateIds,'Any actual published IDs agree with native queue order');
  return {accepted:true,candidateIds,chosenIndex:menu.index,chosenId:candidateIds[menu.index],nativeNames:names.slice(),
    owner:{context:5,kind:1,seq:menu.seq,generation:menu.generation,detailGeneration:menu.detailGeneration},
    identitySource:'Original native GetKingPersons/GetCityPersons order; names only cross-check identity',
    successionOutcomeAccepted:false};
}
