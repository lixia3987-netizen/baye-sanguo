import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const sourcePath=new URL('../js/original-game.js',import.meta.url);
const actualSdkSource=readFileSync(new URL('../js/idbkvstore.min.js',import.meta.url),'utf8');
const original=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const oldMod=readFileSync(new URL('../libs/sc-mod.lib',import.meta.url)).toString('latin1');
const PATH='libs/dat-mod.lib',TITLE='三国霸业-词典原版';
const SHA='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const hex=original.toString('hex'),binary=original.toString('latin1');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const corrupted=Buffer.from(original);corrupted[corrupted.length-17]^=1;
const initialSaves=()=>Object.fromEntries(Array.from({length:8},(_,i)=>[
  ['baye//data//sango'+i+'.sav','unmodified-save-'+i],
  ['baye//data//sango'+i+'.sav.lib',i%2?'libs/sc-mod.lib':PATH],
  ['baye//data//sango'+i+'.sav.lib-id','unmodified-identity-'+i]
]).flat());

function harness({cache=null,path,name,network=original,fetchError=null,httpStatus=200,
  subtle=true,idbUnavailable=false,idbGetError=false,actualSdkOpenError=false,storageFailKey=null,holdFetch=false}={}){
  const values=new Map(Object.entries(initialSaves()));
  if(path!==undefined)values.set('baye/libpath',path);
  if(name!==undefined)values.set('baye/libname',name);
  const before=new Map(values),storageWrites=[],idbWrites=[],requests=[],digests=[],idbOpens=[];
  let cached=cache,getCount=0,storeCount=0,closedCount=0,failStorage=!!storageFailKey,mainCalls=0;
  let releaseFetch,markFetchStarted;const fetchStarted=new Promise(resolve=>{markFetchStarted=resolve;});
  const fetchGate=holdFetch?new Promise(resolve=>{releaseFetch=resolve;}):Promise.resolve();
  const storage={
    getItem:key=>values.has(String(key))?values.get(String(key)):null,
    setItem(key,value){key=String(key);storageWrites.push({kind:'set',key,value:String(value)});
      if(failStorage&&key===storageFailKey){failStorage=false;throw new Error('localStorage denied '+key);}
      values.set(key,String(value));},
    removeItem(key){key=String(key);storageWrites.push({kind:'remove',key});values.delete(key);},
    key:index=>[...values.keys()][index]??null,
    get length(){return values.size;}
  };
  const localStorage=new Proxy(storage,{
    get(target,key){return Reflect.has(target,key)?Reflect.get(target,key):target.getItem(key)??undefined;},
    set(target,key,value){target.setItem(key,value);return true;},
    deleteProperty(target,key){target.removeItem(key);return true;}
  });
  class Store{
    constructor(name){storeCount++;assert.equal(name,'baye');if(idbUnavailable)throw new Error('IndexedDB unavailable');}
    transaction(mode,done){assert.equal(mode,'readonly');assert.equal(typeof done,'function');
      return {get:(key,callback)=>this.get(key,(error,value)=>{callback(error,value);done(error);})};}
    get(key,callback){assert.equal(key,'lib');getCount++;queueMicrotask(()=>callback(idbGetError?new Error('read denied'):null,cached));}
    set(key,value,callback){assert.equal(key,'lib');idbWrites.push({key,value});cached=value;
      const promise=Promise.resolve();if(callback)queueMicrotask(()=>callback(null));return promise;}
    close(){closedCount++;}
  }
  const context=vm.createContext({
    console,localStorage,IdbKvStore:Store,Promise,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,
    setTimeout,clearTimeout,queueMicrotask,AbortController,
    crypto:subtle?{subtle:{async digest(algorithm,data){digests.push({algorithm,bytes:data.byteLength});return webcrypto.subtle.digest(algorithm,data);}}}:{},
    async fetch(url){requests.push(String(url));markFetchStarted();await fetchGate;if(fetchError)throw fetchError;
      return {ok:httpStatus>=200&&httpStatus<300,status:httpStatus,async arrayBuffer(){const b=Buffer.from(network);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}};},
    dynLib:'old-runtime-hex',_main(){mainCalls++;}
  });
  context.window=context;
  if(actualSdkOpenError){
    context.indexedDB={open(name){idbOpens.push(name);const request={};
      queueMicrotask(()=>request.onerror({target:{error:new Error('Actual SDK IndexedDB open denied')},
        preventDefault(){},stopPropagation(){}}));return request;}};
    vm.runInContext(actualSdkSource,context,{filename:'js/idbkvstore.min.js'});
  }
  vm.runInContext(readFileSync(sourcePath,'utf8'),context,{filename:'js/original-game.js'});
  assert.equal(typeof context.BayeOriginalGame?.load,'function');
  const calls=[];
  function load(){
    const call={ready:0,failed:0,hex:null,error:null,readyState:null};calls.push(call);
    const promise=context.BayeOriginalGame.load(value=>{
      call.ready++;call.hex=value;call.readyState={path:values.get('baye/libpath'),name:values.get('baye/libname'),dynLib:context.dynLib};
      context._main();
    },error=>{call.failed++;call.error=error;});
    assert.equal(typeof promise?.then,'function','public load returns a Promise');
    return {call,promise};
  }
  function assertSavesUnchanged(){
    for(const[key,value]of before)if(key.startsWith('baye//data//sango'))assert.equal(values.get(key),value,key);
    assert.deepEqual(storageWrites.filter(x=>x.key!=='baye/libpath'&&x.key!=='baye/libname'),[],'only selected-LIB metadata may be written');
  }
  function assertReady(call){
    assert.equal(call.ready,1);assert.equal(call.failed,0);assert.equal(call.hex,hex);
    assert.deepEqual(call.readyState,{path:PATH,name:TITLE,dynLib:hex});assertSavesUnchanged();
  }
  function assertFailure(call){
    assert.equal(call.ready,0);assert.equal(call.failed,1);assert.ok(call.error);
    assert.equal(mainCalls,0);assert.equal(context.dynLib,'old-runtime-hex');
    assert.equal(values.get('baye/libpath'),before.get('baye/libpath'));
    assert.equal(values.get('baye/libname'),before.get('baye/libname'));assertSavesUnchanged();
  }
  return {context,values,before,storageWrites,idbWrites,requests,digests,idbOpens,calls,load,assertReady,assertFailure,assertSavesUnchanged,fetchStarted,
    releaseFetch:()=>releaseFetch?.(),get cached(){return cached;},get gets(){return getCount;},get stores(){return storeCount;},get closes(){return closedCount;},get mainCalls(){return mainCalls;}};
}
async function ready(h){const {call,promise}=h.load();assert.equal(await promise,hex);h.assertReady(call);return call;}
async function failed(h){const {call,promise}=h.load();await assert.rejects(promise);h.assertFailure(call);return call;}

test('original entry fixture is the complete real standard LIB with its pinned bytes and SHA',()=>{
  assert.equal(original.length,207195);assert.equal(sha(original),SHA);
});

test('public original save identity matches both independent 32-bit hashes of the real lowercase LIB hex',()=>{
  // BigInt modulo arithmetic independently checks the two native-storage
  // multiplications without relying on the implementation's Math.imul path.
  let first=2166136261n,second=0x9e3779b9n;
  for(const char of hex){const code=BigInt(char.charCodeAt(0));
    first=((first^code)*16777619n)&0xffffffffn;
    second=((second^code)*2246822519n)&0xffffffffn;
  }
  const expected=`v1:${hex.length}:${first.toString(16)}:${second.toString(16)}`;
  assert.equal(expected,'v1:414390:1d36da77:1e9c0477');
  const h=harness();assert.equal(h.context.BayeOriginalGame.saveIdentity,expected);
  assert.deepEqual(h.storageWrites,[]);assert.deepEqual(h.idbWrites,[]);assert.equal(h.mainCalls,0);
});

test('first visit without a selected path fetches verified original bytes and preserves every save',async()=>{
  const h=harness();await ready(h);
  assert.equal(h.gets,1);assert.deepEqual(h.requests,[PATH]);assert.equal(h.cached,binary);
  assert.equal(h.idbWrites.length,1);assert.equal(sha(Buffer.from(h.idbWrites[0].value,'latin1')),SHA);
  assert.equal(h.mainCalls,1);
});

test('old Mod path and cached Mod bytes are replaced only after the original download is verified',async()=>{
  const h=harness({path:'libs/sc-mod.lib',name:'Old Mod',cache:oldMod,holdFetch:true});
  const {call,promise}=h.load();await h.fetchStarted;
  assert.equal(h.gets,1);assert.deepEqual(h.requests,[PATH]);assert.equal(h.cached,oldMod);
  assert.equal(h.values.get('baye/libpath'),'libs/sc-mod.lib');assert.deepEqual(h.storageWrites,[]);assert.equal(call.ready,0);
  h.releaseFetch();assert.equal(await promise,hex);h.assertReady(call);assert.equal(h.cached,binary);
});

test('an original-looking path cannot authorize a same-length corrupted cache',async()=>{
  const h=harness({path:PATH,name:TITLE,cache:corrupted.toString('latin1')});await ready(h);
  assert.deepEqual(h.requests,[PATH]);assert.equal(h.cached,binary);assert.equal(h.idbWrites.length,1);
});

test('verified original cache starts offline even when the previous selected path was another version',async()=>{
  const h=harness({path:'libs/sc-mod.lib',name:'Old Mod',cache:binary,fetchError:new Error('offline')});await ready(h);
  assert.deepEqual(h.requests,[]);assert.equal(h.gets,1);assert.equal(h.mainCalls,1);
});

test('fetch failure starts no engine and preserves invalid cache, prior metadata and all saves',async()=>{
  const cached=corrupted.toString('latin1');const h=harness({path:'libs/sc-mod.lib',name:'Old Mod',cache:cached,fetchError:new Error('offline')});
  await failed(h);assert.equal(h.cached,cached);assert.deepEqual(h.idbWrites,[]);assert.deepEqual(h.storageWrites,[]);
});

test('HTTP errors are not accepted as original LIB responses',async()=>{
  const h=harness({path:PATH,name:TITLE,httpStatus:404});await failed(h);assert.deepEqual(h.idbWrites,[]);
});

test('a complete same-size network response with the wrong SHA cannot start or replace the cache',async()=>{
  const h=harness({path:'libs/sc-mod.lib',name:'Old Mod',cache:'old-cache',network:corrupted});await failed(h);
  assert.equal(h.cached,'old-cache');assert.deepEqual(h.idbWrites,[]);assert.deepEqual(h.storageWrites,[]);
});

test('a truncated network response is rejected without changing selected-LIB metadata or saves',async()=>{
  const h=harness({network:original.subarray(0,original.length-1)});await failed(h);assert.deepEqual(h.idbWrites,[]);
});

test('non-secure LAN fallback hashes real original bytes correctly without crypto.subtle',async()=>{
  const h=harness({subtle:false});await ready(h);assert.deepEqual(h.digests,[]);assert.equal(h.cached,binary);
});

test('pure SHA fallback rejects same-length corrupted original bytes',async()=>{
  const h=harness({subtle:false,network:corrupted});await failed(h);assert.deepEqual(h.idbWrites,[]);
});

test('cached strings containing non-byte Unicode cannot alias a valid binary LIB',async()=>{
  const at=19,value=binary.charCodeAt(at);const invalid=binary.slice(0,at)+String.fromCharCode(value+256)+binary.slice(at+1);
  const h=harness({cache:invalid,fetchError:new Error('offline')});await failed(h);
  assert.equal(h.cached,invalid);assert.deepEqual(h.requests,[PATH]);
});

test('unavailable or failed IndexedDB can still load verified network original without touching saves',async()=>{
  for(const options of [{idbUnavailable:true},{idbGetError:true}]){
    const h=harness(options);await ready(h);assert.deepEqual(h.requests,[PATH]);
  }
});

test('bundled IndexedDB SDK open failures fall back to verified original without an unhandled transaction rejection',async()=>{
  const h=harness({actualSdkOpenError:true,path:'libs/sc-mod.lib',name:'Old Mod'});
  await ready(h);
  // Let actual SDK rejection callbacks drain; node:test treats any unhandled
  // rejection as a failure rather than suppressing it with a process handler.
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(h.idbOpens,['baye','baye']);assert.deepEqual(h.requests,[PATH]);
  assert.equal(h.mainCalls,1);h.assertSavesUnchanged();
});

test('selected-LIB metadata write failure rolls back only path/name and refuses engine startup',async()=>{
  for(const prior of [{path:'libs/sc-mod.lib',name:'Old Mod'},{}])for(const storageFailKey of ['baye/libname','baye/libpath']){
    const h=harness({...prior,storageFailKey});await failed(h);
    assert.equal(h.cached,binary,'an already verified cache may remain reusable');
  }
});

test('concurrent starts share one cache read and one fetch, with each caller settled exactly once',async()=>{
  const h=harness({cache:'old-cache',holdFetch:true});const runs=Array.from({length:5},()=>h.load());
  await h.fetchStarted;assert.equal(h.gets,1);assert.deepEqual(h.requests,[PATH]);assert.deepEqual(h.storageWrites,[]);
  h.releaseFetch();assert.deepEqual(await Promise.all(runs.map(x=>x.promise)),Array(5).fill(hex));
  for(const run of runs)h.assertReady(run.call);assert.equal(h.idbWrites.length,1);assert.equal(h.mainCalls,5);
});

test('one concurrent failed download rejects each caller once without any startup or save writes',async()=>{
  const h=harness({fetchError:new Error('offline')});const runs=Array.from({length:3},()=>h.load());
  const outcomes=await Promise.allSettled(runs.map(x=>x.promise));assert.ok(outcomes.every(x=>x.status==='rejected'));
  for(const run of runs)h.assertFailure(run.call);assert.equal(h.gets,1);assert.deepEqual(h.requests,[PATH]);assert.deepEqual(h.storageWrites,[]);
});
