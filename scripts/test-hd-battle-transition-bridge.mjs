#!/usr/bin/env node
// Typed actual weather/day publications. No game, current-world inference or input.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(persons=200) {
    const raw={g_hdDetailGeneration:7,g_hdBattleNoteProtocolVersion:1,g_hdBattleNoteActive:1,
        g_hdBattleNoteSeq:11,g_hdBattleNoteGeneration:7,g_hdBattleNoteOutcome:6,
        g_hdBattleNoteWinner:65535,g_hdBattleNoteText:'',g_hdBattleNoteValue:1};
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
        if(['g_Persons','g_Cities','g_PIdx','g_PlayerKing','g_hdMapCity','g_FgtWeather','g_FgtBoutCnt','g_FgtBoutMax'].includes(key)){
            forbidden.push(String(key));throw Error('Unpublished world source');
        }
        return object[key];
    },set(object,key){writes.push(String(key));throw Error('World write');}});
    env.baye.data=data;env.baye.ensureData=()=>env.baye.data;
    return {raw,data,env,read:()=>env.baye.hd.battleNote(),countReads:()=>countReads,
        onRead:fn=>{onRead=fn;},untouched(){assert.deepEqual(writes,[]);assert.deepEqual(keys,[]);assert.deepEqual(forbidden,[]);}};
}

test('all five weather transitions return only the actual typed weather and empty native text',()=>{
    const f=fixture();
    for(let weather=1;weather<=5;weather++){
        f.raw.g_hdBattleNoteValue=weather;
        assert.deepEqual(plain(f.read()),{protocolVersion:1,active:1,seq:11,generation:7,outcome:6,winner:65535,value:weather,text:''});
        assert.equal(Object.hasOwn(f.read(),'weatherName'),false);
        assert.equal(Object.hasOwn(f.read(),'nextDay'),false);
    }
    assert.equal(f.countReads(),0);f.untouched();
});

test('day cards retain the actual full U16 day and canonical drawn digits, including zero and 65535',()=>{
    const f=fixture();f.raw.g_hdBattleNoteOutcome=7;
    for(const day of [0,1,9,10,30,255,256,9999,10000,65535]){
        f.raw.g_hdBattleNoteValue=day;f.raw.g_hdBattleNoteText=String(day);
        assert.deepEqual(plain(f.read()),{protocolVersion:1,active:1,seq:11,generation:7,outcome:7,winner:65535,value:day,text:String(day)});
    }
    assert.equal(f.countReads(),0);f.untouched();
});

test('typed transitions require their field, domains, sentinel and exact captured text without coercion',()=>{
    for(const value of [undefined,null,-1,0,6,65536,1.5,NaN,'1',true]){
        const f=fixture();if(value===undefined)delete f.raw.g_hdBattleNoteValue;else f.raw.g_hdBattleNoteValue=value;
        assert.equal(f.read(),null,String(value));assert.equal(f.countReads(),0);f.untouched();
    }
    for(const kind of [6,7])for(const winner of [0,199,511,65534,'65535',null]){
        const f=fixture();f.raw.g_hdBattleNoteOutcome=kind;f.raw.g_hdBattleNoteValue=1;
        f.raw.g_hdBattleNoteText=kind===7?'1':'';f.raw.g_hdBattleNoteWinner=winner;
        assert.equal(f.read(),null,kind+'/'+winner);assert.equal(f.countReads(),0);f.untouched();
    }
    for(const [kind,value,text]of [[6,1,'晴'],[6,1,'1'],[7,1,''],[7,1,'01'],[7,1,' 1'],[7,1,'1\n'],
        [7,1,'2'],[7,65535,'65536'],[7,1,1],[7,1,null],[7,65536,'65536'],[7,-1,'-1']]){
        const f=fixture();Object.assign(f.raw,{g_hdBattleNoteOutcome:kind,g_hdBattleNoteValue:value,g_hdBattleNoteText:text});
        assert.equal(f.read(),null,kind+'/'+value+'/'+text);assert.equal(f.countReads(),0);f.untouched();
    }
    for(const [name,value]of [['Outcome',8],['Outcome',0],['ProtocolVersion',2],['Active',2],['Seq',0],['Generation',6]]){
        const f=fixture();f.raw['g_hdBattleNote'+name]=value;assert.equal(f.read(),null,name);f.untouched();
    }
    const wrapped=fixture();for(const name of Object.keys(wrapped.raw).filter(name=>name!=='g_hdBattleNoteText'))wrapped.raw[name]={value:wrapped.raw[name]};
    assert.equal(wrapped.read().value,1);assert.equal(wrapped.countReads(),0);wrapped.untouched();
});

test('generation, owner, typed value or text changes during a read cannot certify mixed transition data',()=>{
    for(const field of ['g_hdDetailGeneration','g_hdBattleNoteActive','g_hdBattleNoteSeq','g_hdBattleNoteGeneration',
        'g_hdBattleNoteOutcome','g_hdBattleNoteWinner','g_hdBattleNoteValue']){
        const f=fixture();let changed=false;f.onRead(name=>{if(name==='g_hdBattleNoteText'&&!changed){changed=true;f.raw[field]++;}});
        assert.equal(f.read(),null,field);assert.equal(f.countReads(),0);f.untouched();
    }
    for(const field of ['g_hdBattleNoteSeq','g_hdBattleNoteGeneration','g_hdBattleNoteValue']){
        const f=fixture();let reads=0;f.onRead(name=>{if(name==='g_hdBattleNoteText'&&++reads===3)f.raw[field]++;});
        assert.equal(f.read(),null,'last text read '+field);assert.equal(f.countReads(),0);f.untouched();
    }
    const f=fixture();let reads=0;Object.defineProperty(f.raw,'g_hdBattleNoteText',{get(){return reads++?'later native text':'';}});
    assert.equal(f.read(),null);assert.equal(f.countReads(),0);f.untouched();
});

test('same-shaped data replacement and successive weather/day stages stay distinct without consulting the live world',()=>{
    const f=fixture();let changed=false;f.onRead(name=>{if(name==='g_hdBattleNoteText'&&!changed){changed=true;f.env.baye.data={...f.raw};}});
    assert.equal(f.read(),null);assert.equal(f.countReads(),0);f.untouched();
    const next=fixture(),weather=plain(next.read());
    Object.assign(next.raw,{g_hdBattleNoteSeq:12,g_hdBattleNoteOutcome:7,g_hdBattleNoteValue:30,g_hdBattleNoteText:'30'});
    const day=plain(next.read());assert.equal(weather.outcome,6);assert.equal(weather.value,1);
    assert.equal(day.outcome,7);assert.equal(day.value,30);assert.equal(day.text,'30');assert.equal(day.seq,12);
    assert.equal(next.countReads(),0);next.untouched();
});

test('old note and inactive DTOs retain their original shapes and legacy person-limit behavior',()=>{
    const f=fixture(600);delete f.raw.g_hdBattleNoteValue;f.raw.g_hdBattleNoteText='原生旧公告';
    for(const [outcome,winner]of [[1,511],[2,65535],[3,65535],[4,65535],[5,65535]]){
        f.raw.g_hdBattleNoteOutcome=outcome;f.raw.g_hdBattleNoteWinner=winner;const before=f.countReads();
        assert.deepEqual(plain(f.read()),{protocolVersion:1,active:1,seq:11,generation:7,outcome,winner,text:'原生旧公告'});
        assert.equal(f.countReads()>before,outcome<=2);assert.equal(Object.hasOwn(f.read(),'value'),false);
    }
    Object.assign(f.raw,{g_hdBattleNoteActive:0,g_hdBattleNoteSeq:0,g_hdBattleNoteGeneration:0,g_hdBattleNoteOutcome:0,
        g_hdBattleNoteWinner:65535,g_hdBattleNoteText:'',g_hdBattleNoteValue:'stale old-ABI extension'});
    assert.deepEqual(plain(f.read()),{protocolVersion:1,active:0,seq:0,generation:0,outcome:0,winner:65535,text:''});
    f.untouched();
});
