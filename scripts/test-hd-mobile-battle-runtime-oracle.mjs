import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {verifyMobileBattleMarch,verifyMobileBattleRest,nativeRestMpLimit} from './hd-mobile-battle-runtime-oracle.mjs';

// Replay recorded native evidence, without starting a browser or game.
const raw=gunzipSync(fs.readFileSync(new URL('../docs/validation/m5-mobile-battle-20261011/raw/battle-result.json.gz',import.meta.url)));
const record=JSON.parse(raw),libBytes=fs.readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const march=()=>({before:structuredClone(record.battleBootstrap.before),after:structuredClone(record.battleBootstrap.after),
    qty:structuredClone(record.battleBootstrap.food),selectedPersonIds:record.battleBootstrap.selectedPersonIds.slice(),libBytes});
const rest=()=>structuredClone(record.battleRest);

test('recorded original march matches all sampled world fields and exact native fighter tokens',()=>{
    const v=verifyMobileBattleMarch(march());assert.equal(v.ok,true);
    assert.deepEqual(v.tokens,[6,59,61,62,63,64,66,67,0,0]);
    assert.deepEqual(v.food,{confirmed:505,before:505,after:0});assert.deepEqual(v.money,{cost:0,before:237,after:237});
});
test('march oracle rejects unrelated person, city, order, queue and fighter changes',()=>{
    for(const mutate of [a=>a.after.people[199].IQ^=1,a=>a.after.cities[37].Money^=1,
        a=>a.after.orders[0].Food^=1,a=>a.after.queue[1999]^=1,a=>a.after.fighters[599]^=1,
        a=>a.after.fighterIndex[29]^=1,a=>a.after.month=a.after.month===12?1:a.after.month+1]){
        const a=march();mutate(a);assert.throws(()=>verifyMobileBattleMarch(a));
    }
});
test('march oracle rejects forged quantity, selected identity and actual LIB identity',()=>{
    for(const mutate of [a=>a.qty.value--,a=>a.selectedPersonIds.reverse(),
        a=>{a.libBytes=Buffer.from(a.libBytes);a.libBytes[0]^=1;},a=>a.after.fighters[0]^=1]){
        const a=march();mutate(a);assert.throws(()=>verifyMobileBattleMarch(a));
    }
});
test('recorded single-general rest preserves the sampled world and every other battle unit',()=>{
    const v=verifyMobileBattleRest(rest());assert.equal(v.restAccepted,true);assert.equal(v.maxmp,41);
    assert.deepEqual(v.mp,{before:41,after:41});assert.deepEqual(v.active,{before:0,after:1});
});
test('rest oracle rejects troop, food, settings, actor, bout or other-world mutations',()=>{
    for(const mutate of [a=>a.after.units[1].arms++,a=>a.after.units[0].mp++,a=>a.after.food.player++,
        a=>a.after.settings.movie^=1,a=>a.before.fight.actorIndex=1,a=>a.after.fight.bout++,
        a=>a.worldAfter.people[199].Thew^=1,a=>a.after.touches++]){
        const a=rest();mutate(a);assert.throws(()=>verifyMobileBattleRest(a));
    }
});
test('native rest uses integer divisions, square-root extraction and the U8 maximum',()=>{
    assert.equal(nativeRestMpLimit({IQ:46,Force:89,Level:1,Thew:100}),41);
    assert.equal(nativeRestMpLimit({IQ:46,Force:89,Level:1,Thew:50}),20);
    assert.equal(nativeRestMpLimit({IQ:100,Force:255,Level:99,Thew:100}),186);
    assert.equal(nativeRestMpLimit({IQ:255,Force:255,Level:255,Thew:100}),210);
    const a=rest();a.before.units.find(u=>u.i===a.actorIndex).mp=40;
    assert.deepEqual(verifyMobileBattleRest(a).mp,{before:40,after:41});
});
test('archived success is bounded and carries trusted input, native LCD retirement and owned cleanup',()=>{
    const manifest=JSON.parse(fs.readFileSync(new URL('../docs/validation/m5-mobile-battle-20261011.json',import.meta.url)));
    assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.runtime.rawResult.sha256);
    assert.equal(record.ok,true);assert.equal(record.accepted,true);assert.equal(record.fullHdAccepted,false);
    assert.equal(record.realDeviceAccepted,false);assert.equal(record.cleanup.treeExited,true);assert.equal(record.serverClosed,true);
    assert.deepEqual(record.sourceDrift,[]);assert.deepEqual(record.exceptions,[]);
    assert.ok(record.trustedEvents.some(e=>e.trusted&&e.type==='pointerdown'&&e.target==='hd-mobile-battle-canvas'));
    assert.equal(record.battleHelp.downRetired.fight.inputKind,3);assert.equal(record.battleView.after.fight.inputKind,1);
    assert.equal(record.battleVisibility.hidden.hidden,true);assert.equal(record.battleVisibility.restored.hidden,false);
    assert.equal(record.battleTurn.after.fight.bout,record.battleTurn.before.fight.bout+1);
});
