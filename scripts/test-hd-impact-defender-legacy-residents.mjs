import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyMobileDefenderPicker,verifyMobileDefenderSelection} from './hd-mobile-defender-runtime-oracle.mjs';

// Only world is a measured genuine SAVE. Every incoming order, native owner,
// name, position, key count and selection below is a controlled Node model.
// These tests execute no input and provide no actual defense/battle/cast credit.
const raw=fs.readFileSync(new URL('./fixtures/hd-impact-v13-dispatched-world.json',import.meta.url));
assert.equal(raw.length,77877);assert.equal(createHash('sha256').update(raw).digest('hex'),'bba1d332325630b32bd3028ee2d89d8ec6f36e7dd4ac3ed87921e7c6bdda7111');
const saved=JSON.parse(raw),clone=structuredClone;
const namesFor=ids=>ids.map(id=>'人物'+id);
const residents=(w,i)=>{const c=w.cities[i];return w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons);};
function envelope(){
 const world=clone(saved);
 // Controlled native projection only: these fields are absent from the saved JSON.
 world.tools=[{useflag:0,changeAttackRange:0,at:0,iq:0,move:0,arm:0}];
 world.config={...world.config,disableFightToDeath:0};
 // Preserve saved0/1/170 and army0; model a different incoming army1 released by BattleDrv.
 world.orders[171]={...world.orders[171],OrderId:27,Person:1,City:10,Object:4,Food:605,TimeCount:0};
 world.fighters.fill(0,20,40);world.fighters[20]=33;world.fighterIndex[1]=0;
 const ids=[33,29],names=namesFor(ids);
 const native={detailGeneration:3,keys:100,touches:0,menu:{active:1,context:5,kind:2,seq:86,generation:3,detailGeneration:3,itemLen:8,count:2,index:0,names:names.slice(),packedNames:names.slice(),ids,idsValid:true},report:{active:0,seq:20,inputSeq:22},fight:{active:0,over:2,skip:3},march:{phase:7,session:5,inputSeq:7},battle:{mode:0,over:2,cityIndex:4,playerFood:world.cities[4].Food,enemyFood:605,mainGenIndex:0,genArray:[0,0,0,0,0,0,0,0,0,0,33,0,0,0,0,0,0,0,0,0],positions:Array.from({length:20},()=>({x:7,y:8,hp:300,mp:420,move:4,active:1,state:2}))}};
 return {world,native,names};
}
function select33(before=envelope()){
 const after=clone(before),city=after.world.cities[4],at=city.PersonQueue;
 assert.equal(before.world.queue[at],33);
 // Independent literal original DelPerson projection: retain199 and complete200..1999.
 after.world.queue=before.world.queue.slice(0,at).concat(before.world.queue.slice(at+1,200),[before.world.queue[199]],before.world.queue.slice(200));
 city.Persons--;for(let i=5;i<38;i++)after.world.cities[i].PersonQueue--;
 after.native.battle.genArray[0]=34;
 after.native.keys++;after.names=namesFor([29]);
 after.native.menu={...after.native.menu,seq:88,index:0,count:1,ids:[29],names:after.names.slice(),packedNames:after.names.slice()};
 return {before,after,chosenIndex:0};
}
const noActual=v=>{assert.equal(v.actualInputAccepted,false);assert.equal(v.battleAccepted,false);};

test('unchanged genuine world retains full tables and three legacy cross-city duplicate IDs',()=>{
 assert.deepEqual([saved.people.length,saved.cities.length,saved.queue.length,saved.orders.length,saved.fighters.length],[200,38,2000,200,600]);
 for(const [id,cities]of [[65,[1,7]],[136,[12,21]],[138,[22,26]]])for(const c of cities)assert.ok(residents(saved,c).includes(id));
 assert.deepEqual(residents(saved,4),[33,29,175]);assert.equal(saved.people[175].Belong,0);
 assert.equal(Object.hasOwn(saved,'tools'),false);assert.equal(Object.hasOwn(saved.config,'disableFightToDeath'),false);
});
test('controlled incoming171/army1 permits current city4 picker while preserving all saved queued actions',()=>{
 const f=envelope(),v=verifyMobileDefenderPicker(f);noActual(v);
 for(const key of ['people','cities','queue'])assert.deepEqual(f.world[key],saved[key]);
 assert.deepEqual(f.world.tools,[{useflag:0,changeAttackRange:0,at:0,iq:0,move:0,arm:0}]);assert.deepEqual(f.world.config,{...saved.config,disableFightToDeath:0});
 assert.deepEqual(v.candidateIds,[33,29]);assert.deepEqual(v.selectedIds,[]);assert.equal(v.orderIndex,171);assert.equal(v.armySlot,1);
 for(const i of [0,1,170])assert.deepEqual(f.world.orders[i],saved.orders[i]);
 assert.deepEqual(f.world.fighters.slice(0,20),saved.fighters.slice(0,20));assert.equal(f.world.fighterIndex[0],1);
});
test('one controlled native DelPerson and fresh shrinking owner preserve complete world and legacy duplicates',()=>{
 const f=select33(),v=verifyMobileDefenderSelection(f);noActual(v);assert.equal(v.chosenId,33);assert.equal(v.absoluteQueueIndex,12);assert.deepEqual(v.remainingIds,[29]);assert.equal(v.freshPicker,true);
 assert.equal(f.after.world.queue[199],f.before.world.queue[199]);assert.deepEqual(f.after.world.queue.slice(200),f.before.world.queue.slice(200));
 const next=verifyMobileDefenderPicker({...f.after,names:f.after.native.menu.names});noActual(next);assert.deepEqual(next.selectedIds,[33]);assert.deepEqual(next.candidateIds,[29]);
});
test('a selected33 duplicate in another city is not confused with current-city removal',()=>{
 const before=envelope(),other=before.world.cities[7];before.world.queue[other.PersonQueue]=33;
 const f=select33(before),v=verifyMobileDefenderSelection(f);noActual(v);assert.deepEqual(v.selectedIds,[33]);assert.ok(!residents(f.after.world,4).includes(33));assert.ok(residents(f.after.world,7).includes(33));
 assert.equal(verifyMobileDefenderPicker({...f.after,names:f.after.native.menu.names}).accepted,true);
});
test('overlapping active queue ranges remain invalid despite allowed cross-city IDs',()=>{
 const f=envelope();f.world.cities[5].PersonQueue=f.world.cities[4].PersonQueue;
 assert.throws(()=>verifyMobileDefenderPicker(f),/overlap/);
});
test('selection still compares unknown world fields and complete queue tails',()=>{
 const f=select33();f.before.world.auditUnknown={value:1};f.after.world.auditUnknown={value:2};assert.throws(()=>verifyMobileDefenderSelection(f),/One native DelPerson/);
 const g=select33();g.after.world.queue[1900]++;assert.throws(()=>verifyMobileDefenderSelection(g),/One native DelPerson/);
});
test('full incoming ten-token binding, unique order and released army flag remain required',()=>{
 for(const change of [f=>f.world.fighters[38]=1,f=>f.world.orders[171].Object=5,f=>f.world.orders[172]=clone(f.world.orders[171]),f=>f.world.fighterIndex[1]=1]){const f=envelope();change(f);assert.throws(()=>verifyMobileDefenderPicker(f));}
});
test('a selected defender still resident in the defended city remains invalid',()=>{
 const f=envelope();f.native.battle.genArray[0]=34;assert.throws(()=>verifyMobileDefenderPicker(f),/removed|resident/i);
});
