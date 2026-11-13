// Targeted pure Node tests. The fixed input is the exact last genuine v2 SAVE world.
// The last genuine v2 SAVE is real input. TARGET/DONE and dispatch effects below
// are explicitly CONTROLLED fixtures, never evidence of an actual Induce action.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getRawInduceCandidates,verifyRawInduceDispatch,impactRawDiplomacyContract} from './hd-impact-diplomacy-runtime-oracle.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const clone=x=>structuredClone(x);
const next=n=>n===0xffffffff?1:n+1;
const input=readFileSync(new URL('./fixtures/hd-impact-induce-loaded-world.json',import.meta.url));
assert.equal(input.length,175199,'Pin exact tracked saved-world fixture');
assert.equal(hash(input),'b04a4052b5ad5a4e6007231eaab433f98c8a8efd0f8b9eb6c9499cd3c298ce6c');
const fixedInput=JSON.parse(input);
assert.equal(fixedInput.schemaVersion,1);
assert.equal(fixedInput.provenance.worldNormalizationPerformed,false);
assert.equal(fixedInput.provenance.controlledDispatch.actualDispatchAccepted,false);
assert.deepEqual(fixedInput.provenance.sourceResult,{path:'build/impact-skill-20261014/prepare-induce-actual-v2/result.json',bytes:30463271,sha256:'72b74416b73103f21e79e606c1fdb9a0470998aa4fd9b1de0a3b2fd92d6f1f31'});
const savedResult=fixedInput.provenance.sourceResultOutcome,saved=fixedInput.provenance.publicSave;
assert.equal(saved.onlyCheckpointInFailedRun,true);
assert.equal(saved.lastGenuinePublicSave,true);
assert.equal(saved.tag,'impact-induce-loaded');
const savedWorld=fixedInput.world;
assert.equal(hash(Buffer.from(JSON.stringify(savedWorld))),'b913a71c95b07ab1685920d9f65810f6d66da2de19d5737d807b1b4d4e2ae74d');
assert.equal(fixedInput.worldSemanticSha256,'b913a71c95b07ab1685920d9f65810f6d66da2de19d5737d807b1b4d4e2ae74d');
const libBytes=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
assert.equal(libBytes.length,207195);
assert.equal(hash(libBytes),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
const oracleBytes=readFileSync(new URL('./hd-impact-diplomacy-runtime-oracle.mjs',import.meta.url));
assert.equal(oracleBytes.length,17456);
assert.equal(hash(oracleBytes),'711a62f8299e3fcd2c739e90acfe3b03f5cca68af3dab05126a8bff85efbe5de');

// Independent ROM directory reader: this fixture does not call oracle helpers.
function romItem(id,index){
 const at=libBytes.readUInt32LE((id-1)*4),len=libBytes.readUInt32LE(at);
 assert.equal(libBytes.readUInt16LE(at+4),id);
 const count=libBytes.readUInt16LE(at+6),fixed=libBytes.readUInt32LE(at+8);
 assert.ok(index<count); assert.equal(libBytes[at+12],0);
 const offset=fixed?14+index*fixed:count===1?14:libBytes.readUInt32LE(at+14+index*8);
 const size=fixed||(count===1?len-14:libBytes.readUInt32LE(at+18+index*8));
 assert.ok(offset>=14&&offset+size<=len&&at+len<=libBytes.length);
 return libBytes.subarray(at+offset,at+offset+size);
}
const decode=bytes=>new TextDecoder('gbk',{fatal:true}).decode(bytes.subarray(0,bytes.indexOf(0)<0?bytes.length:bytes.indexOf(0)));
const romName=id=>decode(romItem(72,id)); // real P4 name table (68+period)
const nativeCosts={money:romItem(2,10)[19],thew:romItem(2,9)[19]};
function expectedCandidates(w){
 const c=w.cities[7],actors=w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>w.people[id].Belong===c.Belong);
 const targets=[...new Set(w.cities.filter(c=>c.Belong!==0&&c.Belong!==w.king+1).map(c=>c.Belong-1))];
 return {actors,targets};
}
function rawRepeats(w){
 const occurrences=new Map();
 w.cities.forEach((c,cityIndex)=>{for(let j=0;j<c.Persons;j++){
  const queueIndex=c.PersonQueue+j,id=w.queue[queueIndex];
  if(!occurrences.has(id))occurrences.set(id,[]);
  occurrences.get(id).push({cityIndex,queueIndex,cityBelong:c.Belong,personBelong:w.people[id].Belong,eligible:c.Belong===w.people[id].Belong});
 }});
 return [...occurrences].filter(([,places])=>places.length>1).map(([personId,positions])=>({personId,positions}));
}
// Independently derive C InduceMake/DelPerson using array slices rather than
// oracle's shifting loop. The only deliberately opaque outputs are four bytes/
// words at the first newly copied order slot; all other world fields stay exact.
function expectedDispatch(before,opaque={Arms:321,Food:65432,Money:32101,Consume:197}){
 const after=clone(before),city=before.cities[7];
 const local=before.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons);
 const at=city.PersonQueue+local.indexOf(12);assert.ok(local.includes(12));
 const orderIndex=before.orders.findIndex(o=>o.OrderId===255);assert.ok(orderIndex>=0);
 after.people[12].Thew=before.people[12].Thew-nativeCosts.thew;
 after.cities=before.cities.map((c,i)=>({...c,...(i===7?{Money:c.Money-nativeCosts.money,Persons:c.Persons-1}:{}),...(i>7?{PersonQueue:(c.PersonQueue-1)&65535}:{})}));
 after.queue=[...before.queue.slice(0,at),...before.queue.slice(at+1,200),before.queue[199],...before.queue.slice(200)];
 after.orders[orderIndex]={...before.orders[orderIndex],OrderId:19,Person:12,City:7,Object:136,TimeCount:10,...opaque};
 return {after,at,orderIndex};
}
function fixture(world=savedWorld){
 const before=clone(world),{after,at,orderIndex}=expectedDispatch(before),targets=expectedCandidates(before).targets;
 const names=targets.map(romName),generation=3;
 const beforeTicket={label:'CONTROLLED final TARGET fixture; not actual input',world:before,readOnly:true,keys:41,dataToken:101,gameToken:102,hdToken:103,
  identity:{status:'ready',generation:2,sha256:hash(libBytes),byteLength:libBytes.length},
  owner:{generation,speGeneration:3,record:{active:0},qty:{active:0},report:{active:0},help:{active:0},fight:{active:0},spe:{active:0},transfer:{active:0},
   menu:{active:1,context:1,kind:3,seq:40,generation,detailGeneration:generation,idsValid:true,itemLen:8,count:targets.length,index:targets.indexOf(136),ids:targets,names,packedNames:[...names]},
   march:{phase:0,pick:0,battlePick:0,mapCity:8,mapInputSeq:6},
   diplomacy:{protocolVersion:1,active:1,command:19,phase:2,session:13,inputSeq:7,generation,origin:7,actor:12,target:65535,commitSeq:4,commitResult:0}}};
 const afterTicket=clone(beforeTicket);afterTicket.label='CONTROLLED successful DONE fixture; not actual dispatch';afterTicket.world=after;afterTicket.keys++;
 Object.assign(afterTicket.owner.menu,{active:0,context:0,kind:0,seq:41});
 Object.assign(afterTicket.owner.march,{pick:1,mapInputSeq:7});
 Object.assign(afterTicket.owner.diplomacy,{active:0,phase:5,inputSeq:9,target:136,commitSeq:5,commitResult:1});
 return {before,after,beforeTicket,afterTicket,libBytes,cityIndex:7,command:19,personId:12,targetId:136,at,orderIndex};
}
const verify=f=>verifyRawInduceDispatch(f);
const reject=mutate=>{const f=fixture();mutate(f);assert.throws(()=>verify(f));};
const rejectWorld=mutate=>reject(f=>mutate(f.after,f));
const getCandidates=world=>getRawInduceCandidates({world,cityIndex:7,command:19,libBytes});

// Input provenance and controlled positive contracts.
test('real input is the last genuine SAVE of a failed run, not an accepted preparation',()=>{
 assert.equal(savedResult.ok,false);assert.equal(savedResult.actualPreparationAccepted,false);assert.equal(savedResult.actualCastAccepted,false);
 assert.equal(saved.beforeAfterWorldEqual,true);assert.equal(saved.beforeWorldSemanticSha256,hash(Buffer.from(JSON.stringify(savedWorld))));assert.equal(saved.afterWorldSemanticSha256,saved.beforeWorldSemanticSha256);
 assert.deepEqual(saved.keys.map(x=>x.code),[39]);
 assert.equal(savedWorld.queue.length,2000);assert.equal(savedWorld.people.length,200);assert.equal(savedWorld.cities.length,38);
});
test('independent original ROM cost19 is money50/thew10 and actual identities are 曹植/贾华',()=>{
 assert.deepEqual(nativeCosts,{money:50,thew:10});assert.equal(romName(12),'曹植');assert.equal(romName(136),'贾华');
});
test('raw C candidate order preserves three actual cross-city duplicate groups',()=>{
 const got=getCandidates(clone(savedWorld));assert.deepEqual(got.actors,expectedCandidates(savedWorld).actors);assert.deepEqual(got.targets,expectedCandidates(savedWorld).targets);
 assert.equal(got.actorQueueIndex,25);assert.deepEqual(got.rawDuplicateResidents,rawRepeats(savedWorld));
 assert.deepEqual(got.rawDuplicateResidents.map(x=>x.personId),[65,136,138]);
 assert.deepEqual(got.rawDuplicateResidents.map(x=>x.positions.map(p=>[p.cityIndex,p.queueIndex])),[[[1,8],[7,22]],[[12,48],[21,97]],[[22,98],[26,118]]]);
});
test('CONTROLLED dispatch exactly matches independent full raw-world result; no actual acceptance',()=>{
 const f=fixture(),before=clone(f.before),after=clone(f.after),got=verify(f);
 assert.equal(got.ok,true);assert.equal(got.dispatchWorldAccepted,true);assert.equal(got.ownerReceiptAccepted,true);
 assert.deepEqual(got.order,{OrderId:19,Person:12,City:7,Object:136,TimeCount:10});assert.equal(got.orderIndex,0);assert.equal(got.queueIndex,25);
 assert.equal(f.after.cities[7].Money,29950);assert.equal(f.after.people[12].Thew,90);
 for(const flag of ['publicInputAccepted','sourceFreezeAccepted','monthEffectsAccepted','wholeNativeAbiAccepted','actualPreparationAccepted','actualCastAccepted'])assert.equal(got[flag],false);
 assert.deepEqual(f.before,before);assert.deepEqual(f.after,after);assert.equal(got.opaqueOrder.semanticAcceptance,false);
});
test('DelPerson shifts only j..198, retains old199 and full200..1999 tail, adjusts all later CITY indexes',()=>{
 const f=fixture();verify(f);
 assert.deepEqual(f.after.queue.slice(0,25),f.before.queue.slice(0,25));assert.deepEqual(f.after.queue.slice(25,199),f.before.queue.slice(26,200));
 assert.equal(f.after.queue[199],f.before.queue[199]);assert.deepEqual(f.after.queue.slice(200),f.before.queue.slice(200));
 for(let i=0;i<38;i++)assert.equal(f.after.cities[i].PersonQueue,(f.before.cities[i].PersonQueue-(i>7?1:0))&65535);
 assert.deepEqual(rawRepeats(f.after).map(x=>[x.personId,x.positions.map(p=>[p.cityIndex,p.queueIndex])]),[[65,[[1,8],[7,22]]],[136,[[12,47],[21,96]]],[138,[[22,97],[26,117]]]]);
});
test('four uninitialized cargo fields may vary only at the one new slot, without semantic acceptance',()=>{
 for(const opaque of [{Arms:0,Food:0,Money:0,Consume:0},{Arms:65535,Food:65535,Money:65535,Consume:255}]){
  const f=fixture();Object.assign(f.after.orders[f.orderIndex],opaque);const got=verify(f);assert.deepEqual(got.opaqueOrder.values,opaque);assert.equal(got.opaqueOrder.semanticAcceptance,false);
 }
});
test('first empty order search includes physical slots after170, preserving all preceding occupied orders',()=>{
 const w=clone(savedWorld);for(let i=0;i<173;i++)w.orders[i].OrderId=4;const f=fixture(w);assert.equal(verify(f).orderIndex,173);
});
test('native U32 counters wrap with skipped zero; one Enter and two diplomacy phases stay exact',()=>{
 const f=fixture(),a=f.beforeTicket.owner,b=f.afterTicket.owner;
 a.menu.seq=0xffffffff;b.menu.seq=1;a.march.mapInputSeq=0xffffffff;b.march.mapInputSeq=1;
 a.diplomacy.inputSeq=0xffffffff;b.diplomacy.inputSeq=2;a.diplomacy.commitSeq=0xffffffff;b.diplomacy.commitSeq=1;
 assert.equal(verify(f).accepted,true);
});
test('terminal march7 is permitted only with the complete current TARGET/DONE and MAP gates',()=>{
 const f=fixture();f.beforeTicket.owner.march.phase=f.afterTicket.owner.march.phase=7;assert.equal(verify(f).accepted,true);
});
test('unpublished debug null remains real measurement, not inferred0',()=>{
 assert.equal(savedWorld.engineDebug,null);assert.equal(verify(fixture()).wholeNativeAbiAccepted,false);
});
test('LIB byte view of pinned original bytes is accepted; fixture is never changed by the oracle',()=>{
 const f=fixture();f.libBytes=new Uint8Array(libBytes);assert.equal(verify(f).accepted,true);
});

// Field-local corruptions must reject even when the claimed DONE is successful.
const worldFaults=[
 ['wrong money cost49',w=>w.cities[7].Money++],['wrong thew cost9',w=>w.people[12].Thew++],
 ['target thew changes',w=>w.people[136].Thew--],['actor Arms changes',w=>w.people[12].Arms++],['unrelated person changes',w=>w.people[13].Devotion^=1],
 ['origin food changes',w=>w.cities[7].Food++],['origin reserve changes',w=>w.cities[7].MothballArms++],['unrelated farming changes',w=>w.cities[16].Farming++],
 ['wrong origin Persons count',w=>w.cities[7].Persons++],['later city offset omitted',w=>w.cities[8].PersonQueue++],['earlier city offset changed',w=>w.cities[6].PersonQueue^=1],
 ['last CITY offset omitted',w=>w.cities[37].PersonQueue++],['resident shift wrong',w=>w.queue[25]=12],['shift endpoint198 wrong',w=>w.queue[198]^=1],
 ['old slot199 altered',w=>w.queue[199]^=1],['tail200 altered',w=>w.queue[200]^=1],['tail1999 altered',w=>w.queue[1999]^=1],
 ['goods queue altered',w=>w.goodsQueue[1999]^=1],['fighter byte altered',w=>w.fighters[599]^=1],['fighter flag altered',w=>w.fighterIndex[29]^=1],
 ['month advanced',w=>w.month=w.month===12?1:w.month+1],['year changed',w=>w.year++],['player king changed',w=>w.king=1],
 ['sampled config changed',w=>w.config.armsPerMoney++],['lookMovie changed',w=>w.lookMovie^=1],['debug null invented as0',w=>w.engineDebug=0],
 ['new unreported world field',w=>w.unpublishedField=0],['missing required person field',w=>delete w.people[12].Age],['missing required CITY field',w=>delete w.cities[0].CommerceLimit],
 ['another order cargo changed',w=>w.orders[1].Food^=1],['another order id changed',w=>w.orders[1].OrderId=4],
 ['raw duplicate normalized',w=>w.queue[96]=137],['raw array globally sorted',w=>w.queue.sort((a,b)=>a-b)],
 ['unknown new-order field invented',w=>w.orders[0].Unpublished=0],['sparse queue hole',w=>delete w.queue[170]],['non-finite measurement',w=>w.config.armsPerMoney=NaN]
];
for(const [name,change]of worldFaults)test('reject '+name,()=>rejectWorld(change));
for(const [field,value]of Object.entries({OrderId:18,Person:13,City:8,Object:137,TimeCount:9}))test('reject initialized order '+field,()=>rejectWorld(w=>w.orders[0][field]=value));
for(const field of ['Arms','Food','Money','Consume']){
 test('reject missing opaque new-slot '+field,()=>rejectWorld(w=>delete w.orders[0][field]));
 test('reject out-of-range opaque new-slot '+field,()=>rejectWorld(w=>w.orders[0][field]=field==='Consume'?256:65536));
}

const ticketFaults=[
 ['stale menu seq',f=>f.afterTicket.owner.menu.seq--],['wrong diplomacy input delta',f=>f.afterTicket.owner.diplomacy.inputSeq--],
 ['double commit receipt',f=>f.afterTicket.owner.diplomacy.commitSeq++],['extra native key',f=>f.afterTicket.keys++],['missing native key',f=>f.afterTicket.keys--],
 ['stale MAP input seq',f=>f.afterTicket.owner.march.mapInputSeq--],['wrong after session',f=>f.afterTicket.owner.diplomacy.session++],
 ['wrong after detail generation',f=>f.afterTicket.owner.generation++],['wrong after diplomacy generation',f=>f.afterTicket.owner.diplomacy.generation++],
 ['wrong SPE generation',f=>f.afterTicket.owner.speGeneration++],['identity rebind',f=>f.afterTicket.identity.generation++],
 ['dataToken rebind',f=>f.afterTicket.dataToken++],['gameToken rebind',f=>f.afterTicket.gameToken++],['hdToken rebind',f=>f.afterTicket.hdToken++],
 ['torn before world',f=>{f.beforeTicket.world=clone(f.before);f.beforeTicket.world.people[12].Thew--;}],
 ['torn after world',f=>{f.afterTicket.world=clone(f.after);f.afterTicket.world.cities[7].Money++;}],
 ['before is not readOnly',f=>f.beforeTicket.readOnly=false],['after is not readOnly',f=>f.afterTicket.readOnly=false],
 ['initial TARGET highlight instead of final136',f=>f.beforeTicket.owner.menu.index=0],
 ['wrong candidate ID',f=>f.beforeTicket.owner.menu.ids[0]=12],['reordered complete candidates',f=>f.beforeTicket.owner.menu.ids.reverse()],
 ['truncated full candidate list',f=>f.beforeTicket.owner.menu.ids.pop()],['wrong count',f=>f.beforeTicket.owner.menu.count--],
 ['IDs unpublished',f=>f.beforeTicket.owner.menu.idsValid=false],['missing complete IDs',f=>delete f.beforeTicket.owner.menu.ids],
 ['wrong full name for realID',f=>f.beforeTicket.owner.menu.names[0]='伪名'],['wrong packed name',f=>f.beforeTicket.owner.menu.packedNames[0]='伪名'],
 ['missing packed names',f=>delete f.beforeTicket.owner.menu.packedNames],['wrong native packed width',f=>f.beforeTicket.owner.menu.itemLen=7],
 ['menu detail-generation torn',f=>f.beforeTicket.owner.menu.detailGeneration++],['menu generation torn',f=>f.beforeTicket.owner.menu.generation++],
 ['wrong context',f=>f.beforeTicket.owner.menu.context=5],['wrong menu kind',f=>f.beforeTicket.owner.menu.kind=4],
 ['wrong protocol',f=>f.beforeTicket.owner.diplomacy.protocolVersion=0],['wrong command',f=>f.beforeTicket.owner.diplomacy.command=16],
 ['wrong origin',f=>f.beforeTicket.owner.diplomacy.origin=8],['wrong selected actor',f=>f.beforeTicket.owner.diplomacy.actor=13],
 ['before already target-committed',f=>f.beforeTicket.owner.diplomacy.target=136],['before wrong phase',f=>f.beforeTicket.owner.diplomacy.phase=1],
 ['before already commitResult',f=>f.beforeTicket.owner.diplomacy.commitResult=1],['zero session',f=>f.beforeTicket.owner.diplomacy.session=0],
 ['zero input publication',f=>f.beforeTicket.owner.diplomacy.inputSeq=0],['DONE still active',f=>f.afterTicket.owner.diplomacy.active=1],
 ['failed AddOrder receipt',f=>f.afterTicket.owner.diplomacy.commitResult=2],['wrong DONE target',f=>f.afterTicket.owner.diplomacy.target=137],
 ['DONE is still COMMIT',f=>f.afterTicket.owner.diplomacy.phase=3],['menu not ended',f=>f.afterTicket.owner.menu.active=1],
 ['MAP not published',f=>f.afterTicket.owner.march.pick=0],['wrong current MAP city',f=>f.afterTicket.owner.march.mapCity=13],
 ['battle MAP competition',f=>f.afterTicket.owner.march.battlePick=1],['active march',f=>f.beforeTicket.owner.march.phase=f.afterTicket.owner.march.phase=4],
 ['unknown march phase',f=>f.beforeTicket.owner.march.phase=f.afterTicket.owner.march.phase=8],
 ['identity not ready',f=>f.beforeTicket.identity.status='loading'],['identity bad SHA',f=>f.beforeTicket.identity.sha256='0'.repeat(64)],
 ['identity byteLength wrong',f=>f.beforeTicket.identity.byteLength--],['zero opaque token',f=>f.beforeTicket.dataToken=0],
 ['unpublished owner generation',f=>delete f.beforeTicket.owner.generation],['unpublished report blocker',f=>delete f.beforeTicket.owner.report]
];
for(const [name,change]of ticketFaults)test('reject '+name,()=>reject(change));
for(const blocker of ['record','qty','report','help','fight','spe','transfer'])test('reject competing active '+blocker,()=>reject(f=>f.beforeTicket.owner[blocker].active=1));
for(const [field,value]of Object.entries({cityIndex:8,command:16,personId:13,targetId:137}))test('reject widened approved route '+field,()=>reject(f=>f[field]=value));

// Validity of the supplied raw input is separate from a claimed world delta.
test('reject actor duplicated within its own raw city slice without repairing it',()=>{
 const w=clone(savedWorld);w.queue[w.cities[7].PersonQueue]=12;assert.throws(()=>getCandidates(w));
});
test('reject overlapping physical CITY resident slices, while cross-city PID repeats stay legal',()=>{
 const w=clone(savedWorld);w.cities[8].PersonQueue=w.cities[7].PersonQueue;assert.throws(()=>getCandidates(w));
});
test('reject actor no longer eligible in the exact origin',()=>{
 const w=clone(savedWorld);w.people[12].Belong=0;assert.throws(()=>getCandidates(w));
});
test('reject target136 no longer actually a king',()=>{
 const w=clone(savedWorld);w.people[136].Belong=1;assert.throws(()=>getCandidates(w));
});
test('reject absent target rather than substitute another enemy king',()=>{
 const w=clone(savedWorld);for(const c of w.cities)if(c.Belong===137)c.Belong=1;assert.throws(()=>getCandidates(w));
});
for(const [field,value]of Object.entries({enable16bitConsumeMoney:1,enableCustomRatio:1,maxLevel:21}))test('reject dirty unsupported config '+field,()=>{
 const w=clone(savedWorld);w.config[field]=value;assert.throws(()=>getCandidates(w));
});
test('reject unpublished config field rather than default it to0',()=>{
 const w=clone(savedWorld);delete w.config.fixAlienateComsumeThew;assert.throws(()=>getCandidates(w));
});
test('reject wrong original period',()=>{const w=clone(savedWorld);w.period=3;assert.throws(()=>getCandidates(w));});
test('reject wrong current playerKing',()=>{const w=clone(savedWorld);w.king=1;assert.throws(()=>getCandidates(w));});
test('reject full order queue instead of accepting masked business failure',()=>{
 const f=fixture();for(const o of f.before.orders)o.OrderId=4;assert.throws(()=>verify(f));
});
test('reject insufficient50 money and insufficient10 thew without U16/U8 underflow',()=>{
 for(const kind of ['money','thew']){const f=fixture();if(kind==='money')f.before.cities[7].Money=49;else f.before.people[12].Thew=9;assert.throws(()=>verify(f));}
});
test('reject changed originalLIB and absent LIB bytes',()=>{
 const f=fixture(),bad=Buffer.from(libBytes);bad[100]^=1;f.libBytes=bad;assert.throws(()=>verify(f));delete f.libBytes;assert.throws(()=>verify(f));
});
test('reject accessor/cycle/non-JSON world instead of invoking or normalizing it',()=>{
 const f=fixture();Object.defineProperty(f.after,'opaqueGetter',{enumerable:true,get(){throw new Error('must not invoke');}});assert.throws(()=>verify(f));
 const c=fixture();c.after.cycle=c.after;assert.throws(()=>verify(c));
});
test('scope contract never claims public input, month execution, preparation, cast or whole ABI',()=>{
 for(const flag of ['publicInputAccepted','monthEffectsAccepted','wholeNativeAbiAccepted','actualPreparationAccepted','actualCastAccepted'])assert.equal(impactRawDiplomacyContract[flag],false);
 assert.deepEqual(impactRawDiplomacyContract.initializedOrder,['OrderId','Person','City','Object','TimeCount']);
 assert.deepEqual(impactRawDiplomacyContract.opaqueOrder,['Arms','Food','Money','Consume']);
});
