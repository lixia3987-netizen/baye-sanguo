#!/usr/bin/env node
// Execute the real EM_JS semaphore bodies and generated Asyncify object.
// The fake WASM export models only the C wait/rewind boundary. No native engine,
// browser, message queue, or recompiled artifact is represented by these checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const self=fileURLToPath(import.meta.url),args=process.argv.slice(2);
assert.ok(args.length===0||args.length===2&&args[0]==='--before-source',
  'Usage: node test-hd-native-sem.mjs [--before-source path/to/sem.c]');
let root=path.dirname(self);
while(!fs.existsSync(path.join(root,'package.json'))||!fs.existsSync(path.join(root,'js/baye.js'))){
  const parent=path.dirname(root);assert.notEqual(parent,root,'Find actual project and generated runtime');root=parent;
}
const semPath=args.length?path.resolve(root,args[1]):path.resolve(path.dirname(self),'../vendor/iBaye/src/platform/js/sem.c');
const enginePath=path.join(root,'js/baye.js');
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const semSource=read(semPath),engineSource=read(enginePath);
function uniqueIndex(source,needle){const start=source.indexOf(needle);assert.ok(start>=0,'Actual source marker: '+needle);assert.equal(source.indexOf(needle,start+needle.length),-1,'Unique actual source marker');return start;}
function emBody(name){
  const header=new RegExp('^EM_JS\\([^\\n]*,\\s*'+name+',\\s*\\([^\\n]*\\),\\s*\\{\\s*$','gm');
  const rows=[...semSource.matchAll(header)];assert.equal(rows.length,1,'One actual EM_JS '+name);
  const start=rows[0].index+rows[0][0].lastIndexOf('{')+1,end=semSource.indexOf('\n});',start);
  assert.ok(end>start,'Complete original EM_JS body '+name);return semSource.slice(start,end);
}
const bodies={create:emBody('gam_sem_create'),signal:emBody('gam_sem_signal'),wait:emBody('gam_sem_wait')};
const asyncStart=uniqueIndex(engineSource,'var Asyncify = ')+ 'var Asyncify = '.length;
const asyncEnd=uniqueIndex(engineSource,'\n  var FSNode =');assert.ok(asyncEnd>asyncStart);
const asyncDeclaration=engineSource.slice(asyncStart,asyncEnd).trim();
assert.ok(asyncDeclaration.startsWith('{')&&asyncDeclaration.endsWith('};'),'Complete actual Asyncify object literal');
const asyncObject=asyncDeclaration.slice(0,-1);
function actualDeclaration(begin,next){const start=uniqueIndex(engineSource,begin),end=uniqueIndex(engineSource,next);assert.ok(end>start);return engineSource.slice(start,end).trim();}
const runAndAbort=actualDeclaration('var runAndAbortIfError =','\n  var sigToWasmTypes =');
const userCallback=actualDeclaration('var callUserCallback =','\n  /** @param {number=} timeout */');

function fixture(){
  const timers=[],events=[],completed=[],allocations=new Set(),heap=new ArrayBuffer(65536);
  let cursor=64,timerId=0,activeSem=null,activeRequest=0,requests=0;
  const counts={allocate:0,free:0,startUnwind:0,stopUnwind:0,startRewind:0,stopRewind:0};
  const context=vm.createContext({Module:{},ABORT:false,HEAP32:new Int32Array(heap),HEAPU32:new Uint32Array(heap),
    setTimeout(callback,delay){assert.equal(typeof callback,'function');assert.equal(delay,0);const id=++timerId;timers.push({id,callback});events.push({kind:'timer-queued',id});return id;},
    _malloc(size){const ptr=cursor;cursor+=Math.ceil(size/4)*4;assert.ok(cursor<=heap.byteLength);assert.ok(!allocations.has(ptr));allocations.add(ptr);counts.allocate++;events.push({kind:'allocate',ptr,size});return ptr;},
    _free(ptr){assert.ok(allocations.delete(ptr),'An actual rewind frees its allocated data exactly once');counts.free++;events.push({kind:'free',ptr});},
    _asyncify_start_unwind(ptr){assert.ok(allocations.has(ptr));counts.startUnwind++;events.push({kind:'start-unwind',ptr});},
    _asyncify_stop_unwind(){counts.stopUnwind++;events.push({kind:'stop-unwind'});},
    _asyncify_start_rewind(ptr){assert.ok(allocations.has(ptr));counts.startRewind++;events.push({kind:'start-rewind',ptr});},
    _asyncify_stop_rewind(){counts.stopRewind++;events.push({kind:'stop-rewind'});},
    abort(error){throw error instanceof Error?error:new Error(String(error));}
  });
  vm.runInContext(runAndAbort+'\n'+userCallback+'\nvar Asyncify = '+asyncObject+';\n'+
    'function gam_sem_create(){'+bodies.create+'}\n'+
    'function gam_sem_signal(semid){'+bodies.signal+'}\n'+
    'function gam_sem_wait(semid){'+bodies.wait+'}\n',context,{filename:'actual-sem-and-asyncify.js'});
  // This is the C/WASM continuation boundary only: unwinding exits the fake
  // export; rewinding re-enters the same real import with its saved C argument.
  // The real generated instrumentWasmExports/maybeStopUnwind/doRewind and
  // handleSleep implement every Asyncify state transition and data release.
  context.wasmExports=context.Asyncify.instrumentWasmExports({native_wait_once(semid){
    const A=context.Asyncify;
    if(A.state!==A.State.Rewinding){activeSem=semid;activeRequest=++requests;}
    const value=context.gam_sem_wait(activeSem);
    if(A.state===A.State.Unwinding)return value;
    completed.push({semid:activeSem,request:activeRequest,countAtReturn:context.Module.sems[activeSem].cnt});
    return value;
  }});
  const create=()=>context.gam_sem_create(),signal=id=>context.gam_sem_signal(id),row=id=>context.Module.sems[id];
  const wait=id=>{assert.equal(context.Asyncify.state,context.Asyncify.State.Normal);assert.equal(context.Asyncify.currData,null,'One active C wait at a time');return context.wasmExports.native_wait_once(id);};
  const flushOne=()=>{assert.ok(timers.length,'A real asynchronous wake was scheduled');const timer=timers.shift();events.push({kind:'timer-run',id:timer.id});timer.callback();return timer.id;};
  return{context,timers,events,completed,counts,allocations,create,signal,row,wait,flushOne};
}
const noAsync=f=>{assert.equal(f.timers.length,0);assert.deepEqual(f.counts,{allocate:0,free:0,startUnwind:0,stopUnwind:0,startRewind:0,stopRewind:0});assert.equal(f.context.Asyncify.currData,null);assert.equal(f.context.Asyncify.state,f.context.Asyncify.State.Normal);};

test('queued semaphore credits complete synchronously through the real Asyncify path',()=>{
  for(const credits of [1,3,100]){
    const f=fixture(),id=f.create();for(let n=0;n<credits;n++)f.signal(id);
    assert.equal(f.row(id).cnt,credits);
    for(let left=credits-1;left>=0;left--){
      assert.equal(f.wait(id),0);assert.equal(f.row(id).cnt,left);assert.equal(f.completed.length,credits-left);
      assert.equal(f.row(id).signal,undefined);noAsync(f);
    }
    assert.equal(f.row(id).cnt,0);
  }
});

test('an empty semaphore waits for one signal and resumes asynchronously exactly once',()=>{
  const f=fixture(),id=f.create();f.wait(id);
  assert.equal(f.row(id).cnt,0);assert.equal(typeof f.row(id).signal,'function');assert.equal(f.completed.length,0);
  assert.equal(f.timers.length,0);assert.equal(f.context.Asyncify.state,f.context.Asyncify.State.Normal);
  assert.ok(f.context.Asyncify.currData);assert.equal(f.counts.startUnwind,1);assert.equal(f.counts.stopUnwind,1);
  f.signal(id);assert.equal(f.row(id).cnt,0);assert.equal(f.row(id).signal,null);assert.equal(f.timers.length,1);
  assert.equal(f.completed.length,0,'Native signal does not re-enter an unwound C export');
  f.flushOne();assert.deepEqual(f.completed,[{semid:id,request:1,countAtReturn:0}]);assert.equal(f.timers.length,0);
  assert.deepEqual(f.counts,{allocate:1,free:1,startUnwind:1,stopUnwind:1,startRewind:1,stopRewind:1});
  assert.equal(f.context.Asyncify.currData,null);assert.equal(f.context.Asyncify.state,f.context.Asyncify.State.Normal);
  assert.equal(f.allocations.size,0);assert.equal(f.row(id).cnt,0);
});

test('credits arriving behind a pending wake survive rewind and the next waits consume them synchronously',()=>{
  const f=fixture(),id=f.create();f.wait(id);f.signal(id);f.signal(id);f.signal(id);
  assert.equal(f.row(id).cnt,2);assert.equal(f.timers.length,1);assert.equal(f.completed.length,0);
  f.flushOne();assert.equal(f.row(id).cnt,2,'Rewinding skips startAsync and cannot consume another credit');
  assert.deepEqual(f.completed,[{semid:id,request:1,countAtReturn:2}]);
  const counts={...f.counts};assert.equal(counts.free,1);assert.equal(counts.stopRewind,1);
  f.wait(id);assert.equal(f.row(id).cnt,1);f.wait(id);assert.equal(f.row(id).cnt,0);
  assert.deepEqual(f.counts,counts);assert.equal(f.timers.length,0);assert.equal(f.completed.length,3);
  assert.equal(f.context.Asyncify.currData,null);assert.equal(f.allocations.size,0);
});

test('independent semaphore rows preserve ordered credits and repeated empty waits never underflow',()=>{
  const f=fixture(),a=f.create(),b=f.create();assert.notEqual(a,b);assert.notEqual(f.row(a),f.row(b));
  f.signal(a);f.signal(a);f.signal(b);
  for(const id of [a,b,a])f.wait(id);
  assert.deepEqual(f.completed.map(p=>p.semid),[a,b,a]);assert.deepEqual([f.row(a).cnt,f.row(b).cnt],[0,0]);noAsync(f);
  for(let cycle=0;cycle<3;cycle++){
    f.wait(a);assert.equal(f.row(a).cnt,0);const waiting=f.row(a).signal;
    f.signal(b);assert.equal(f.row(a).signal,waiting);assert.equal(f.row(a).cnt,0);assert.equal(f.row(b).cnt,1);
    assert.equal(f.timers.length,0,'A different row cannot wake the current row');
    f.signal(a);assert.equal(f.row(a).cnt,0);assert.equal(f.timers.length,1);f.flushOne();f.wait(b);
    assert.deepEqual([f.row(a).cnt,f.row(b).cnt],[0,0]);assert.equal(f.timers.length,0);assert.equal(f.allocations.size,0);
  }
  assert.deepEqual(f.completed.map(p=>p.semid),[a,b,a,a,b,a,b,a,b]);
  assert.deepEqual(f.events.filter(e=>e.kind==='timer-run').map(e=>e.id),[1,2,3],'Model timer queue runs the real wake closures in FIFO order');
  assert.deepEqual(f.counts,{allocate:3,free:3,startUnwind:3,stopUnwind:3,startRewind:3,stopRewind:3});
});
