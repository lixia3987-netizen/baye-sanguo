#!/usr/bin/env node
// Read actual pre-computation note publications; no game, world or inputs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(persons=200) {
    const raw={g_hdDetailGeneration:7,g_hdBattleNoteProtocolVersion:1,g_hdBattleNoteActive:1,
        g_hdBattleNoteSeq:11,g_hdBattleNoteGeneration:7,g_hdBattleNoteOutcome:5,
        g_hdBattleNoteWinner:65535,g_hdBattleNoteText:'曹操策略中'};
    const writes=[],keys=[],forbidden=[];let countReads=0,onRead=null;
    const env=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},
        console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});env.window=env;
    for(const name of new Set(source.match(/\b_baye\w+/g)))env[name]=()=>0;
    env._bayeHdReady=()=>1;env._bayeGetPersonCount=()=>{countReads++;return persons;};
    env._bayeSendKey=key=>keys.push(key);
    for(const name of ['_bayeGetPersonName','_bayeGetCityName','_bayeGetCityCount','_bayeGetToolName'])
        env[name]=()=>{forbidden.push(name);throw Error('Unexpected native lookup');};
    vm.runInContext(source,env);env.baye_bridge_init();
    const data=new Proxy(raw,{get(object,key){
        if(onRead)onRead(key);
        if(['g_Persons','g_Cities','g_PIdx','g_PlayerKing','g_hdMapCity','g_EnemyKings'].includes(key)){
            forbidden.push(String(key));throw Error('Unpublished world source');
        }
        return object[key];
    },set(object,key){writes.push(String(key));throw Error('World write');}});
    env.baye.data=data;env.baye.ensureData=()=>env.baye.data;
    return {raw,data,env,read:()=>env.baye.hd.battleNote(),countReads:()=>countReads,
        onRead:fn=>{onRead=fn;},untouched(){assert.deepEqual(writes,[]);assert.deepEqual(keys,[]);assert.deepEqual(forbidden,[]);}};
}

test('tactic prelude returns only its actual captured GBK sentence with unknown winner, without person or world reads',()=>{
    const f=fixture(),text=new TextDecoder('gbk').decode(Uint8Array.from([0xb2,0xdc,0xb2,0xd9,0xb2,0xdf,0xc2,0xd4,0xd6,0xd0]));
    assert.equal(text,'曹操策略中');f.raw.g_hdBattleNoteText='  '+text+'\n原生短暂文字  ';
    assert.deepEqual(plain(f.read()),{protocolVersion:1,active:1,seq:11,generation:7,outcome:5,winner:65535,text:'  曹操策略中\n原生短暂文字  '});
    assert.equal(Object.hasOwn(f.read(),'progress'),false);assert.equal(Object.hasOwn(f.read(),'currentKing'),false);
    assert.equal(f.countReads(),0);f.untouched();
});

test('prelude requires the unknown-winner sentinel and rejects malformed or future classifications',()=>{
    for(const winner of [0,1,199,511,65534,65536,-1,NaN,'65535',true,null]){
        const f=fixture();f.raw.g_hdBattleNoteWinner=winner;assert.equal(f.read(),null,String(winner));
        assert.equal(f.countReads(),0);f.untouched();
    }
    for(const [name,value]of [['Outcome',0],['Outcome',8],['Outcome',255],['Outcome','5'],['Outcome',5.5],
        ['ProtocolVersion',2],['Active',2],['Seq',0],['Seq',0x100000000],['Generation',6],
        ['Text',''],['Text','x'.repeat(512)],['Text',[]]]){
        const f=fixture();f.raw['g_hdBattleNote'+name]=value;assert.equal(f.read(),null,name);f.untouched();
    }
});

test('old or partial ABI and coercible fields do not turn into a prelude, while typed native scalar wrappers remain supported',()=>{
    for(const name of ['ProtocolVersion','Active','Seq','Generation','Outcome','Winner','Text']){
        const f=fixture();delete f.raw['g_hdBattleNote'+name];assert.equal(f.read(),null,name);f.untouched();
    }
    for(const [name,value]of [['Seq','11'],['Generation','7'],['Active',true],['Winner',NaN]]){
        const f=fixture();f.raw['g_hdBattleNote'+name]=value;assert.equal(f.read(),null,name);f.untouched();
    }
    const f=fixture();for(const name of Object.keys(f.raw).filter(name=>name!=='g_hdBattleNoteText'))f.raw[name]={value:f.raw[name]};
    assert.equal(f.read().outcome,5);assert.equal(f.countReads(),0);f.untouched();
});

test('generation, sequence, classification, winner or text changing while read cannot produce a mixed prelude',()=>{
    for(const field of ['g_hdDetailGeneration','g_hdBattleNoteSeq','g_hdBattleNoteGeneration','g_hdBattleNoteOutcome','g_hdBattleNoteWinner']){
        const f=fixture();let changed=false;f.onRead(name=>{if(name==='g_hdBattleNoteText'&&!changed){changed=true;f.raw[field]++;}});
        assert.equal(f.read(),null,field);assert.equal(f.countReads(),0);f.untouched();
    }
    const f=fixture();let count=0;Object.defineProperty(f.raw,'g_hdBattleNoteText',{get(){return count++?'另一条原生预告':'曹操策略中';}});
    assert.equal(f.read(),null);assert.equal(f.countReads(),0);f.untouched();
});

test('same-shaped data replacement is rejected and successive native publications stay distinct',()=>{
    const f=fixture();let changed=false;f.onRead(name=>{if(name==='g_hdBattleNoteText'&&!changed){changed=true;f.env.baye.data={...f.raw};}});
    assert.equal(f.read(),null);assert.equal(f.countReads(),0);f.untouched();
    const next=fixture(),first=plain(next.read());Object.assign(next.raw,{g_hdBattleNoteSeq:12,g_hdBattleNoteText:'孙权策略中'});
    assert.equal(first.text,'曹操策略中');assert.equal(next.read().text,'孙权策略中');assert.equal(next.read().seq,12);
    assert.equal(next.countReads(),0);next.untouched();
});

test('legacy win/loss and inactive semantics remain intact while all passive announcement types skip person lookup',()=>{
    const f=fixture(600);f.raw.g_hdBattleNoteOutcome=1;
    for(const winner of [0,199,511,599]){f.raw.g_hdBattleNoteWinner=winner;assert.equal(f.read().winner,winner);}
    f.raw.g_hdBattleNoteWinner=600;assert.equal(f.read(),null);f.raw.g_hdBattleNoteOutcome=2;
    f.raw.g_hdBattleNoteWinner=65535;assert.equal(f.read().outcome,2);assert.ok(f.countReads()>0);
    for(const outcome of [3,4,5]){const before=f.countReads();f.raw.g_hdBattleNoteOutcome=outcome;assert.equal(f.read().outcome,outcome);assert.equal(f.countReads(),before);}
    Object.assign(f.raw,{g_hdBattleNoteActive:0,g_hdBattleNoteOutcome:0,g_hdBattleNoteWinner:65535,g_hdBattleNoteSeq:0,g_hdBattleNoteGeneration:0,g_hdBattleNoteText:''});
    const before=f.countReads();assert.deepEqual(plain(f.read()),{protocolVersion:1,active:0,seq:0,generation:0,outcome:0,winner:65535,text:''});assert.ok(f.countReads()>before);
    f.raw.g_hdBattleNoteOutcome=5;assert.equal(f.read(),null);f.untouched();
});
