// Controlled fake-session/packed SAVE coverage; no real game transport or OS signal acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {PassThrough} from 'node:stream';
import {createCity4LiveRetentionDriver,verifyCity4TerminalSaveEvidence} from './hd-wood-city4-live-retention.mjs';
import {terminalFixture} from './fixtures/hd-wood-city4-terminal-fixture.mjs';

// Every process below is newly forked by this helper and contains fake objects
// only. Termination is test isolation, never authority to terminate a game lease.
async function withFakeChild(scenario,run){
 const child=fork(fileURLToPath(new URL('./fixtures/hd-wood-city4-live-retention-fake-child.mjs',import.meta.url)),['--owned-fake-retention-child','--scenario='+scenario],{stdio:['pipe','pipe','pipe','ipc'],execArgv:[]});
 let sequence=0,stdout='',stderr='',alive=true;const messages=[],output=[],pending=new Map();
 const waiters=[];let text='';
 child.stdout.on('data',chunk=>{stdout+=chunk;assert.ok(stdout.length<2*1024*1024,'Bounded fake child stdout');text+=chunk;let at;while((at=text.indexOf('\n'))!==-1){const line=text.slice(0,at);text=text.slice(at+1);if(line)output.push(JSON.parse(line));for(const w of [...waiters])w();}});
 child.stderr.on('data',chunk=>{stderr+=chunk;});
 const ready=new Promise((resolve,reject)=>{child.on('message',m=>{assert.equal(m.fakeOnly,true);messages.push(m);if(m.ready)resolve(m);if(Number.isSafeInteger(m.id)&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);p.resolve(m);}});child.once('error',reject);child.once('exit',(code,signal)=>{alive=false;reject(Error('Fake child exited before ready: '+code+'/'+signal+' '+stderr));for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Fake child exited: '+code+'/'+signal+' '+stderr));}pending.clear();});});
 const ask=op=>new Promise((resolve,reject)=>{assert.ok(alive&&child.exitCode===null,'Owned fake child remains alive');const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Fake child IPC timeout '+op+' '+stderr));},5000);pending.set(id,{resolve,reject,timer});child.send({id,op},error=>{if(error&&pending.has(id)){clearTimeout(timer);pending.delete(id);reject(error);}});});
 const line=async command=>{const id='request_'+(++sequence);child.stdin.write(JSON.stringify({protocol:'city4-live-retention-v1',id,command})+'\n');return response(id);};
 const response=id=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{waiters.splice(waiters.indexOf(check),1);reject(Error('Fake child stdout timeout '+id+' '+stderr));},5000);function check(){const r=output.find(x=>x.id===id);if(r){clearTimeout(timeout);const at=waiters.indexOf(check);if(at!==-1)waiters.splice(at,1);resolve(r);}}waiters.push(check);check();});
 const waitOutput=async(predicate,label)=>{const until=Date.now()+5000;while(Date.now()<until){if(predicate(output))return;assert.ok(alive,'Fake child exited while awaiting '+label+' '+stderr);await delay(20);}throw Error('Fake child output timeout '+label+' '+stderr);};
 let readyTimer=null,exitTimer=null;
 try{const first=await Promise.race([ready,new Promise((resolve,reject)=>{readyTimer=setTimeout(()=>reject(Error('Fake child ready timeout '+stderr)),10000);})]);clearTimeout(readyTimer);assert.equal(first.sendCalls,0);assert.equal(first.closeCalls,0);await run({child,first,ask,line,response,output,messages,waitOutput,isAlive:()=>alive&&child.exitCode===null});}
 finally{clearTimeout(readyTimer);for(const p of pending.values())clearTimeout(p.timer);pending.clear();if(child.exitCode===null&&child.signalCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');try{await Promise.race([exited,new Promise((resolve,reject)=>{exitTimer=setTimeout(()=>reject(Error('Owned fake child did not terminate')),5000);})]);}finally{clearTimeout(exitTimer);}}}
}

test('A controlled complete terminal SAVE validates packed bytes and whole MAP but never issues cleanup authority',()=>{
 const f=terminalFixture(),r=verifyCity4TerminalSaveEvidence(f);assert.equal(r.terminalEvidenceQualified,true);assert.equal(r.wholePackedAndPublicOwnerMeasured,true);assert.equal(r.cleanupAuthorized,false);assert.equal(r.sessionReleaseAllowed,false);assert.equal(r.sameNodeLiveCaptureAuthenticated,false);assert.equal(r.actualPublicSaveAccepted,false);assert.equal(r.requiresReviewedTerminalAdapter,true);
});
test('Terminal proof rejects every competing owner pick cursor stale full ticket and changed protected pair',()=>{
 const changes=[x=>x.currentFirst.state.snapshot.fight.active=1,x=>x.currentFirst.state.snapshot.spe.active=1,x=>x.currentFirst.state.snapshot.report.active=1,x=>x.currentFirst.state.snapshot.result.active=true,x=>x.currentFirst.state.snapshot.top.active=true,x=>x.currentFirst.state.menu.active=1,x=>x.currentFirst.state.qty.active=1,x=>x.currentFirst.state.record.active=1,x=>x.currentFirst.state.march.pick=0,x=>x.currentFirst.state.march.battlePick=1,x=>x.currentFirst.state.overworld='other',x=>x.currentFirst.state.keys++,x=>x.currentFirst.world.cities[20].Food++,x=>x.currentPair.sav0='00'];
 for(const change of changes){const x=terminalFixture();change(x);assert.throws(()=>verifyCity4TerminalSaveEvidence(x));}
});
test('Terminal proof rejects raw SAV corruption epoch drift a boolean receipt and caller accessor evidence',()=>{
 const a=terminalFixture();a.files[0].bytes[0]^=1;assert.throws(()=>verifyCity4TerminalSaveEvidence(a));const b=terminalFixture();b.epochAnchor.state.snapshot.references.data++;assert.throws(()=>verifyCity4TerminalSaveEvidence(b));assert.throws(()=>verifyCity4TerminalSaveEvidence({packedPairVerified:true,ordinaryMap:true}));let reads=0;const c=terminalFixture();Object.defineProperty(c.currentFirst.state.qty,'extra',{enumerable:true,get(){reads++;return 0;}});assert.throws(()=>verifyCity4TerminalSaveEvidence(c));assert.equal(reads,0);
});
test('Retention factory enforces same CDP and one driver per identity without starting a timer',()=>{
 const cdp={async send(){}},session={identity:{},cdp},input=new PassThrough(),output=new PassThrough();assert.throws(()=>createCity4LiveRetentionDriver({session,cdp:{send:async()=>{}},input,output}),/same-Node/);const d=createCity4LiveRetentionDriver({session,cdp,input,output});assert.equal(d.status().started,false);assert.throws(()=>createCity4LiveRetentionDriver({session,cdp,input,output}),/one retention driver/i);assert.equal(d.readiness.maximumActualEnd,0);assert.equal(d.readiness.terminalAdapterBound,false);
});
test('Owned fake child remains alive after real stdin EOF with IPC unref and no CDP send or close',async()=>{
 await withFakeChild('normal',async x=>{x.child.stdin.end();await x.waitOutput(rows=>rows.some(r=>r.event==='stdin-eof'),'real stdin EOF');await delay(200);assert.equal(x.isAlive(),true);const s=await x.ask('inspect');assert.equal(s.status.stdinEnded,true);assert.equal(s.status.started,true);assert.equal(s.status.retainedLiveCapability,true);assert.equal(s.status.cleanupAuthorized,false);assert.equal(s.sameSession,true);assert.equal(s.sameCdp,true);assert.equal(s.sameIdentity,true);assert.equal(s.sendCalls,0);assert.equal(s.closeCalls,0);});
});
test('Owned fake child covers the Node SIGINT handler only and does not claim Windows OS Ctrl+C delivery',async()=>{
 await withFakeChild('normal',async x=>{const before=await x.ask('inspect'),signal=await x.ask('emit-node-sigint');assert.equal(signal.osSignalDeliveryTested,false);assert.equal(signal.event,'Node-SIGINT-handler-only');assert.equal(signal.status.signalCount,before.status.signalCount+1);x.child.stdin.end();await x.waitOutput(rows=>rows.some(r=>r.event==='stdin-eof'),'real stdin EOF after Node handler');await delay(200);assert.equal(x.isAlive(),true);const after=await x.ask('inspect');assert.equal(after.status.cleanupAuthorized,false);assert.equal(after.sendCalls,0);assert.equal(after.closeCalls,0);});
});
test('JSONL status works while both unbound reviewed commands and generic eval key LOAD END close are rejected',async()=>{
 await withFakeChild('normal',async x=>{const status=await x.line('status');assert.equal(status.accepted,true);assert.equal(status.status.maximumActualEnd,0);for(const name of['continue-reviewed','verify-terminal-save']){const r=await x.line(name);assert.equal(r.accepted,false);assert.match(r.code,/unbound/);assert.equal(r.cleanupAuthorized,false);}for(const command of['eval','native-key','LOAD','END','retry','force-close']){x.child.stdin.write(JSON.stringify({protocol:'city4-live-retention-v1',id:'bad',command})+'\n');}x.child.stdin.write(JSON.stringify({protocol:'city4-live-retention-v1',id:'extra',command:'status',expression:'forbidden'})+'\n');await x.waitOutput(rows=>rows.filter(r=>r.code==='invalid-command').length===7,'seven invalid commands');const s=await x.ask('inspect');assert.equal(s.sendCalls,0);assert.equal(s.closeCalls,0);assert.equal(s.status.continuationBound,false);assert.equal(s.status.terminalAdapterBound,false);});
});
test('Oversized stdin disables commands while retaining the same fake process and capability',async()=>{
 await withFakeChild('normal',async x=>{x.child.stdin.write('x'.repeat(5000)+'\n');await x.waitOutput(rows=>rows.some(r=>r.code==='stdin-bound-or-read-failure'),'oversized stdin rejection');const s=await x.ask('inspect');assert.equal(s.status.inputDisabled,true);assert.equal(s.status.cleanupAuthorized,false);assert.equal(s.sameSession,true);assert.equal(s.sameCdp,true);assert.equal(x.isAlive(),true);assert.equal(s.sendCalls,0);assert.equal(s.closeCalls,0);});
});
test('Sink and stdout failures plus an unprintable original error keep the fake child and same live capability',async()=>{
 await withFakeChild('sink-and-output-failure',async x=>{const r=await x.ask('caught-failure');assert.equal(r.retainedSameSession,true);assert.equal(r.retainedSameCdp,true);assert.equal(r.retainedSameDriver,true);assert.equal(r.originalErrorIdentity,true);assert.equal(r.cleanupAuthorized,false);assert.equal(r.getterCalls,0);assert.equal(r.coercionCalls,0);x.child.stdin.end();await delay(200);assert.equal(x.isAlive(),true);const s=await x.ask('inspect');assert.equal(s.status.stdinEnded,true);assert.equal(s.status.cleanupAuthorized,false);assert.equal(s.sendCalls,0);assert.equal(s.closeCalls,0);});
});
