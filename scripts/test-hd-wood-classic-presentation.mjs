// Controlled full-ticket display switches. No browser or native input.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyWoodClassicPresentation as verify} from './hd-wood-classic-presentation.mjs';
const P='docs/validation/m5-wood67-hd720-20261024-v38',bytes=fs.readFileSync(P+'-latest-world.json');
assert.equal(createHash('sha256').update(bytes).digest('hex'),'6b4e5ff05bec60e8c93689f00ea39ecb0927aceef1db3ec8f563e8e50a724e2f');
const copy=structuredClone;
function fixture(mode='classic',phase=mode==='classic'?'before-native-AIM-confirmation':'after-native-retirement'){
 const fight={active:1,over:0,wait:1,inputKind:mode==='classic'?5:1,aimType:mode==='classic'?1:0,actorIndex:0,focusX:29,focusY:27,inputSeq:117,cityIndex:1,mapId:110,unknownFight:{bytes:[5,0,255]}};
 const before={world:JSON.parse(bytes),state:{keys:7,snapshot:{spe:{active:0,generation:3,unknown:'retired'},result:{active:false,session:41},top:{active:false,kind:0},report:{active:0,unknownReport:[2,4]},fight,units:Array.from({length:20},(_,i)=>({i,id:i===0?132:0,unknownUnit:{source:'controlled'}}))},references:{fullQueue:[0,255,9],unknownRef:777}},meta:{battleMode:mode==='classic'?'hd':'classic',cityMode:'classic',overworldMode:'hd-map',unknownMeta:{raw:[17,8,0]}}};
 const after=copy(before);after.meta.battleMode=mode;
 return{before,after,mode,phase,proof:{generation:3,fight:copy(fight)}};
}
function accept(x){const before=copy(x);const r=verify(x);assert.deepEqual(x,before,'Pure validation never changes the caller ticket');assert.deepEqual([r.accepted,r.sourceOnly,r.fullTicketPreservedExceptBattleMode,r.worldPreserved,r.nativeKeysPreserved],[true,true,true,true,true]);for(const k of['nativeInputSent','actualClassicAccepted','actualCastAccepted','hdAccepted','globalHdComplete'])assert.equal(r[k],false,k);return r;}
function reject(name,mutate,mode='classic',phase){test(name,()=>{const x=fixture(mode,phase);mutate(x);const original=copy(x);assert.throws(()=>verify(x));assert.deepEqual(x,original,'Refusal also preserves every input field');});}

test('same complete current native AIM permits only the public classic display change',()=>accept(fixture()));
test('unknown world/fight/report/meta fields remain present and preserved',()=>{const x=fixture();x.before.world.extraOpaque={tail:[1,2,3]};x.after.world.extraOpaque=copy(x.before.world.extraOpaque);accept(x);});
test('complete retirement returns to visible HD controls at a genuine PICK owner',()=>accept(fixture('hd')));
test('native battle-over retirement does not require another PICK or a fixed caster outcome',()=>{const x=fixture('hd');x.before.state.snapshot.fight.over=2;x.before.state.snapshot.fight.inputKind=7;x.after.state.snapshot.fight=copy(x.before.state.snapshot.fight);accept(x);});
test('failed native action can retire without a successful spell proof',()=>{const x=fixture('hd','failure-retirement');x.proof=null;accept(x);});
test('failure with fully inactive battle retires without inventing a PICK',()=>{const x=fixture('hd','failure-retirement');x.proof=null;x.before.state.snapshot.fight.active=0;x.before.state.snapshot.fight.inputKind=0;x.after.state.snapshot.fight=copy(x.before.state.snapshot.fight);accept(x);});
test('controlled current casualty and ownership metadata are preserved during restore',()=>{const x=fixture('hd');for(const t of[x.before,x.after]){t.world.people[131].Belong=65535;t.world.people[131].Arms=0;t.world.people[131].Experience=12;}accept(x);});

reject('refuse one food change hidden behind the display switch',x=>x.after.world.cities[20].Food++);
reject('refuse a changed full raw queue tail',x=>x.after.world.queue[1999]^=1);
reject('refuse changed stale opaque order fields',x=>x.after.world.orders[0].Consume^=1);
reject('refuse lost player-army metadata',x=>x.after.world.fighters[599]^=1);
reject('refuse an extra native key',x=>x.after.state.keys++);
reject('refuse one changed native unit slot',x=>x.after.state.snapshot.units[19].id=149);
reject('refuse changed report unknown data',x=>x.after.state.snapshot.report.unknownReport[0]++);
reject('refuse changed unknown metadata',x=>x.after.meta.unknownMeta.raw[0]++);
reject('refuse a deleted reference field',x=>delete x.after.state.references.unknownRef);
reject('refuse a live native SPE on either matching ticket',x=>{x.before.state.snapshot.spe.active=1;x.after.state.snapshot.spe.active=1;});
reject('refuse a live native result on both matching tickets',x=>{x.before.state.snapshot.result.active=true;x.after.state.snapshot.result.active=true;});
reject('refuse a live top owner on both matching tickets',x=>{x.before.state.snapshot.top.active=true;x.after.state.snapshot.top.active=true;});
reject('refuse a live report on both matching tickets',x=>{x.before.state.snapshot.report.active=1;x.after.state.snapshot.report.active=1;});
reject('refuse proof generation plus1000 independent pollution',x=>x.proof.generation+=1000);
reject('refuse before generation plus1000 even when after matches it',x=>{x.before.state.snapshot.spe.generation+=1000;x.after.state.snapshot.spe.generation=x.before.state.snapshot.spe.generation;});
reject('refuse after generation plus1000 independent pollution',x=>x.after.state.snapshot.spe.generation+=1000);
reject('refuse fractional generation on all matching inputs',x=>{x.proof.generation=3.5;x.before.state.snapshot.spe.generation=3.5;x.after.state.snapshot.spe.generation=3.5;});
reject('refuse zero generation on all matching inputs',x=>{x.proof.generation=0;x.before.state.snapshot.spe.generation=0;x.after.state.snapshot.spe.generation=0;});
reject('refuse a missing actual AIM proof',x=>x.proof=null);
reject('refuse changed unknown fields in the full AIM proof',x=>x.proof.fight.unknownFight.bytes[0]++);
reject('refuse non-AIM owner even if supplied proof matches it',x=>{for(const f of[x.before.state.snapshot.fight,x.after.state.snapshot.fight,x.proof.fight])f.inputKind=4;});
reject('refuse AIM not waiting for native confirmation',x=>{for(const f of[x.before.state.snapshot.fight,x.after.state.snapshot.fight,x.proof.fight])f.wait=0;});
reject('refuse active battle restoration before the action returns to PICK',x=>{x.before.state.snapshot.fight.inputKind=5;x.after.state.snapshot.fight.inputKind=5;},'hd');
reject('refuse successful restoration without its same-generation proof',x=>x.proof=null,'hd');
reject('refuse switching classic from an already-classic origin',x=>x.before.meta.battleMode='classic');
reject('refuse an after ticket that never applied the requested display mode',x=>x.after.meta.battleMode='hd');
reject('refuse using the retirement phase to enter classic',x=>x.phase='after-native-retirement');
reject('refuse using the AIM phase to restore HD',x=>x.phase='before-native-AIM-confirmation','hd');
