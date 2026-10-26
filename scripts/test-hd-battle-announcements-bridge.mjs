#!/usr/bin/env node
// Actual read-only bridge with native captured text. No engine, world or input.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(persons = 200) {
    const raw = {g_hdDetailGeneration: 7, g_hdBattleNoteProtocolVersion: 1, g_hdBattleNoteActive: 1,
        g_hdBattleNoteSeq: 9, g_hdBattleNoteGeneration: 7, g_hdBattleNoteOutcome: 3,
        g_hdBattleNoteWinner: 65535, g_hdBattleNoteText: '我军攻打襄阳'};
    const writes = [], keys = [], forbiddenReads = [];
    let reads = 0, onRead = null;
    const context = vm.createContext({TextDecoder, TextEncoder, Module: {HEAPU8: new Uint8Array(8192)},
        console: {log(){}, warn(){}}, addEventListener(){}, alert(){}, lcdBlur(){}});
    context.window = context;
    for (const name of new Set(source.match(/\b_baye\w+/g))) context[name] = () => 0;
    context._bayeHdReady = () => 1;
    context._bayeGetPersonCount = () => {reads++; return persons;};
    context._bayeSendKey = key => keys.push(key);
    for (const name of ['_bayeGetPersonName','_bayeGetCityName','_bayeGetCityCount','_bayeGetToolName']) {
        context[name] = () => {forbiddenReads.push(name); throw Error('Uncaptured native getter');};
    }
    vm.runInContext(source, context); context.baye_bridge_init();
    const data = new Proxy(raw, {
        get(object, key) {
            if (onRead) onRead(key);
            if (['g_Persons','g_Cities','g_PIdx','g_hdMapCity','g_PlayerKing'].includes(key)) {
                forbiddenReads.push(key); throw Error('Uncaptured world source');
            }
            return object[key];
        },
        set(object, key) {writes.push(String(key)); throw Error('World write');}
    });
    context.baye.data = data; context.baye.ensureData = () => context.baye.data;
    return {raw, data, context, read: () => context.baye.hd.battleNote(),
        onRead: callback => {onRead = callback;}, personCountReads: () => reads,
        untouched() {assert.deepEqual(writes, []); assert.deepEqual(keys, []); assert.deepEqual(forbiddenReads, []);}};
}

test('attack and confrontation retain actual decoded GBK text and explicit unknown winner without world or name reads', () => {
    const h = fixture();
    const text = new TextDecoder('gbk').decode(new Uint8Array([0xbd,0xf8,0xb9,0xa5,0xcf,0xe5,0xd1,0xf4]));
    assert.equal(text, '进攻襄阳');
    for (const outcome of [3,4]) {
        h.raw.g_hdBattleNoteOutcome = outcome;
        h.raw.g_hdBattleNoteText = '  ' + text + '\n原生公告  ';
        assert.deepEqual(plain(h.read()), {protocolVersion:1, active:1, seq:9, generation:7,
            outcome, winner:65535, text:'  进攻襄阳\n原生公告  '});
    }
    assert.equal(h.personCountReads(), 0); h.untouched();
});

test('new announcements require their sentinel and reject malformed or unknown classifications without guessing a winner', () => {
    for (const outcome of [3,4]) for (const winner of [0,1,199,511,65534,-1,65536,'65535',true,null]) {
        const h = fixture(); h.raw.g_hdBattleNoteOutcome = outcome; h.raw.g_hdBattleNoteWinner = winner;
        assert.equal(h.read(), null, outcome + '/' + winner); assert.equal(h.personCountReads(), 0); h.untouched();
    }
    for (const [name,value] of [['ProtocolVersion',2],['Active',2],['Seq',0],['Seq',0x100000000],
        ['Generation',6],['Outcome',0],['Outcome',5],['Outcome','3'],['Text',''],['Text','x'.repeat(512)],['Text',[]]]) {
        const h = fixture(); h.raw['g_hdBattleNote'+name] = value;
        assert.equal(h.read(), null, name + '/' + value); h.untouched();
    }
});

test('legacy victory U16 identity, defeat and explicit inactive publication keep the existing contract', () => {
    const h = fixture(600); h.raw.g_hdBattleNoteOutcome = 1;
    for (const winner of [0,199,511,599]) {h.raw.g_hdBattleNoteWinner=winner; assert.equal(h.read().winner,winner);}
    h.raw.g_hdBattleNoteWinner=600; assert.equal(h.read(),null);
    h.raw.g_hdBattleNoteOutcome=2; h.raw.g_hdBattleNoteWinner=65535; assert.equal(h.read().outcome,2);
    h.raw.g_hdBattleNoteWinner=0; assert.equal(h.read(),null);
    Object.assign(h.raw,{g_hdBattleNoteActive:0,g_hdBattleNoteOutcome:0,g_hdBattleNoteWinner:65535,
        g_hdBattleNoteGeneration:0,g_hdBattleNoteSeq:0,g_hdBattleNoteText:''});
    assert.deepEqual(plain(h.read()),{protocolVersion:1,active:0,seq:0,generation:0,outcome:0,winner:65535,text:''});
    for (const outcome of [1,2,3,4]) {h.raw.g_hdBattleNoteOutcome=outcome; assert.equal(h.read(),null);}
    assert.ok(h.personCountReads()>0); h.untouched();
});

test('missing or coercible fields cannot become a complete announcement and typed scalar wrappers still work', () => {
    for (const field of ['ProtocolVersion','Active','Seq','Generation','Outcome','Winner','Text']) {
        const h=fixture(); delete h.raw['g_hdBattleNote'+field]; assert.equal(h.read(),null,field); h.untouched();
    }
    for (const [field,value] of [['Seq','9'],['Generation','7'],['Active',true],['Outcome',3.5],['Winner',NaN]]) {
        const h=fixture(); h.raw['g_hdBattleNote'+field]=value; assert.equal(h.read(),null,field); h.untouched();
    }
    const h=fixture();
    for (const name of Object.keys(h.raw).filter(name=>name!=='g_hdBattleNoteText')) h.raw[name]={value:h.raw[name]};
    assert.equal(h.read().outcome,3); assert.equal(h.personCountReads(),0); h.untouched();
});

test('mixed generation, sequence, kind, winner and text samples retire rather than return a torn announcement', () => {
    for (const field of ['g_hdDetailGeneration','g_hdBattleNoteSeq','g_hdBattleNoteGeneration',
        'g_hdBattleNoteOutcome','g_hdBattleNoteWinner']) {
        const h=fixture(); let changed=false;
        h.onRead(name=>{if(name==='g_hdBattleNoteText'&&!changed){changed=true;h.raw[field]++;}});
        assert.equal(h.read(),null,field); h.untouched();
    }
    const h=fixture(); let count=0;
    Object.defineProperty(h.raw,'g_hdBattleNoteText',{get(){return count++ ? '另一条原生消息' : '我军攻打襄阳';}});
    assert.equal(h.read(),null); assert.equal(h.personCountReads(),0); h.untouched();
});

test('same-shape data replacement and publication changes between reads cannot retain an old announcement', () => {
    const h=fixture(); const before=plain(h.read()); let changed=false;
    h.onRead(name=>{if(name==='g_hdBattleNoteText'&&!changed){changed=true;h.context.baye.data={...h.raw};}});
    assert.equal(h.read(),null); assert.equal(h.personCountReads(),0); h.untouched();
    const next=fixture(); const first=plain(next.read());
    Object.assign(next.raw,{g_hdBattleNoteOutcome:4,g_hdBattleNoteSeq:10,g_hdBattleNoteText:'双方交锋原文'});
    assert.deepEqual(first,before); assert.equal(next.read().outcome,4); assert.equal(next.read().seq,10);
    assert.equal(next.read().text,'双方交锋原文'); assert.equal(next.personCountReads(),0); next.untouched();
});
