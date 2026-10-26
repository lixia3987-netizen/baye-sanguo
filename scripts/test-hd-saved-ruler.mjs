// Actual original LIB names; no game, native name getter, state or input.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import {readOriginalPersonIdentityRom} from './hd-person-identity-rom.mjs';

const source=readFileSync(new URL('../js/hd-saved-ruler.js',import.meta.url),'utf8');
const original=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const SHA='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const resources=[62,70,71,72],tables=resources.map((_,p)=>readOriginalPersonIdentityRom(original,p+1).names200);
function fixture(bytes=original) {
    let identity={status:'ready',sha256:SHA,byteLength:207195,generation:4},reads=0,checks=0,decodes=0;
    const calls=[],hooks={read:null,current:null,decode:null},keys=[],writes=[];
    const context=vm.createContext({TextDecoder:class extends TextDecoder {
        decode(...args){decodes++;hooks.decode?.();return super.decode(...args);}
    },Uint8Array,JSON,Number,parseInt,console});context.window=context;
    context.dynLib=Buffer.from(bytes).toString('hex');
    const api={read(){reads++;hooks.read?.(reads);return identity;},isCurrent(value){checks++;hooks.current?.(checks);return value===identity;}};
    context.BayeHdLibIdentity=api;
    context.baye=new Proxy({},{get(_,key){calls.push(String(key));throw Error('live game access');},set(_,key){writes.push(String(key));throw Error('world write');}});
    context.sendKey=key=>keys.push(key);
    context.localStorage=new Proxy({},{get(_,key){calls.push('storage.'+String(key));throw Error('storage access');}});
    vm.runInContext(source,context);
    return {context,api,hooks,read:(p,id)=>context.BayeHdSavedRuler.read(p,id),
        identity:()=>identity,setIdentity:value=>{identity=value;},counts:()=>({reads,checks,decodes}),
        untouched(){assert.deepEqual(calls,[]);assert.deepEqual(keys,[]);assert.deepEqual(writes,[]);}};
}
test('all 800 actual original names follow saved period and zero-based ID, including genuinely unused slots',()=>{
    assert.equal(original.length,207195);assert.equal(createHash('sha256').update(original).digest('hex'),SHA);
    const f=fixture();
    for(let p=1;p<=4;p++)for(let id=0;id<200;id++)assert.equal(f.read(p,id),tables[p-1][id]||null,'period '+p+' id '+id);
    assert.deepEqual([1,2,3,4].map(p=>f.read(p,0)),['董卓','李傕','韩玄','曹丕']);
    assert.deepEqual([1,2,3,4].map(p=>f.read(p,5)),['马腾','孙策','刘备','徐庶']);
    assert.equal(f.read(4,129),'潘浚');assert.equal(f.read(4,199),null);f.untouched();
});
test('unchanged immutable source is decoded once and reauthorized on every read',()=>{
    const f=fixture();assert.equal(f.read(1,0),'董卓');const first=f.counts();assert.equal(first.decodes,800);
    for(let i=0;i<8;i++)assert.equal(f.read(4,129),'潘浚');
    const next=f.counts();assert.equal(next.decodes,800);assert.equal(next.reads-first.reads,16);assert.equal(next.checks-first.checks,16);
    f.setIdentity({...f.identity(),generation:5});assert.equal(f.read(1,0),'董卓');assert.equal(f.counts().decodes,800);f.untouched();
});
test('strict original identity, API and argument requirements fail without consulting live people or current period',()=>{
    for(const [p,id] of [[0,0],[5,0],['1',0],[true,0],[1.5,0],[NaN,0],[1,-1],[1,200],[1,'0'],[1,false],[1,Infinity],[null,0]]) {
        const f=fixture();assert.equal(f.read(p,id),null);assert.equal(f.counts().decodes,0);f.untouched();
    }
    for(const value of [null,{status:'pending',sha256:SHA,byteLength:207195,generation:4},
        {status:'ready',sha256:'f'.repeat(64),byteLength:207195,generation:4},
        {status:'ready',sha256:SHA,byteLength:207194,generation:4},
        {status:'ready',sha256:SHA,byteLength:207195,generation:0},
        {status:'ready',sha256:SHA,byteLength:207195,generation:'4'}]) {
        const f=fixture();f.setIdentity(value);assert.equal(f.read(1,0),null);assert.equal(f.counts().decodes,0);f.untouched();
    }
    for(const api of [null,{}, {read:()=>({})},{read:'ready',isCurrent:()=>true}]) {
        const f=fixture();f.context.BayeHdLibIdentity=api;assert.equal(f.read(1,0),null);f.untouched();
    }
    const f=fixture();f.api.isCurrent=()=>false;assert.equal(f.read(1,0),null);assert.equal(f.counts().decodes,0);f.untouched();
});
test('truncated, malformed and unsupported resource directories or name bytes fail closed',()=>{
    const start=original.readUInt32LE((62-1)*4),at=start+14;
    const mutations=[
        b=>b.writeUInt32LE(0,(62-1)*4),b=>b.writeUInt32LE(b.length-8,(62-1)*4),
        b=>b.writeUInt32LE(1613,start),b=>b.writeUInt32LE(b.length,start),
        b=>b.writeUInt16LE(61,start+4),b=>b.writeUInt16LE(199,start+6),
        b=>b.writeUInt32LE(1,start+8),b=>{b[start+12]=1;},b=>{b[start+13]=1;},
        b=>b.writeUInt32LE(14,at),b=>b.writeUInt32LE(0xffffffff,at),
        b=>b.writeUInt32LE(0xffffffff,at+4),b=>b.writeUInt32LE(32,at+4),
        b=>{const p=start+b.readUInt32LE(at);b[p]=0x81;b[p+1]=0;}
    ];
    for(const mutate of mutations){const bytes=Buffer.from(original);mutate(bytes);const f=fixture(bytes);assert.equal(f.read(1,0),null,String(mutate));f.untouched();}
    for(const value of [null,'','0'.repeat(414388),'0'.repeat(414389),'x'.repeat(414390),new Uint8Array(207195)]) {
        const f=fixture();f.context.dynLib=value;assert.equal(f.read(1,0),null);f.untouched();
    }
});
test('an identity or source change in the last callback cannot expose an old cached name',()=>{
    for(const callback of [
        f=>{f.context.dynLib='0'.repeat(414390);},
        f=>{f.context.BayeHdLibIdentity={...f.api};},
        f=>{f.api.read=()=>f.identity();},
        f=>{f.api.isCurrent=()=>true;},
        f=>{f.identity().generation++;},
        f=>{f.setIdentity({...f.identity(),generation:8});}
    ]) {
        const f=fixture();assert.equal(f.read(1,0),'董卓');
        f.hooks.current=n=>{if(n===4)callback(f);};assert.equal(f.read(4,0),null,String(callback));f.untouched();
    }
    const f=fixture();f.hooks.read=n=>{if(n===2)f.context.dynLib='0'.repeat(414390);};assert.equal(f.read(1,0),null);f.untouched();
});
test('reentrant identity or decoder reads retire the outer result and never reuse a stale authorization',()=>{
    for(const field of ['read','current','decode']) {
        const f=fixture();let once=false,inner='not-called';
        f.hooks[field]=()=>{if(!once){once=true;inner=f.read(4,0);}};
        assert.equal(f.read(1,0),null,field);assert.equal(inner,null,field);
        f.hooks[field]=null;assert.equal(f.read(4,0),'曹丕');f.untouched();
    }
});
test('callback exceptions and a changed source invalidate cached data; restored original bytes can be freshly read',()=>{
    const f=fixture();assert.equal(f.read(1,0),'董卓');f.hooks.read=()=>{throw Error('identity unavailable');};
    assert.equal(f.read(4,129),null);f.hooks.read=null;assert.equal(f.read(4,129),'潘浚');
    f.context.dynLib=original.toString('hex').slice(0,-2);assert.equal(f.read(1,0),null);
    f.context.dynLib=original.toString('hex');assert.equal(f.read(1,0),'董卓');f.untouched();
});
