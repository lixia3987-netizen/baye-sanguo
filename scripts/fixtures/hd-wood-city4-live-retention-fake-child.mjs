// Test child only. No real CDP, WebSocket, browser, ports, SAVE or game capability.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createCity4LiveRetentionDriver} from '../hd-wood-city4-live-retention.mjs';

function main(){
 assert.ok(process.argv.includes('--owned-fake-retention-child'),'Refuse non-test entry');assert.ok(process.send&&process.channel,'The test parent must own this IPC child');
 const scenario=process.argv.find(x=>x.startsWith('--scenario='))?.slice('--scenario='.length)||'normal';assert.ok(['normal','sink-and-output-failure'].includes(scenario));
 let sendCalls=0,closeCalls=0,getterCalls=0,coercionCalls=0;const cdp={async send(){sendCalls++;throw Error('Fake CDP must never be used by retention commands');},close(){closeCalls++;}},session={identity:Object.freeze({}),cdp,state:'live-battle'};
 const originalError={};for(const name of['message','stack'])Object.defineProperty(originalError,name,{get(){getterCalls++;throw Error('Error getter must not execute');}});originalError[Symbol.toPrimitive]=()=>{coercionCalls++;throw Error('Error coercion must not execute');};
 const output=scenario==='normal'?process.stdout:new EventEmitter();if(scenario!=='normal')output.write=()=>{throw originalError;};
 const sink=scenario==='normal'?null:async()=>{throw originalError;};const driver=createCity4LiveRetentionDriver({session,cdp,input:process.stdin,output,persistExclusive:sink});driver.startRetention();
 const identity=()=>({sameSession:driver.session===session,sameCdp:driver.cdp===cdp,sameIdentity:driver.identity===session.identity});
 const send=message=>process.send({fakeOnly:true,...message});
 process.on('message',message=>{
  if(!message||!Number.isSafeInteger(message.id))return;const id=message.id;
  if(message.op==='inspect'){send({id,status:driver.status(),sendCalls,closeCalls,getterCalls,coercionCalls,...identity()});return;}
  if(message.op==='emit-node-sigint'){process.emit('SIGINT');send({id,event:'Node-SIGINT-handler-only',osSignalDeliveryTested:false,status:driver.status(),sendCalls,closeCalls,...identity()});return;}
  if(message.op==='caught-failure'){const result=driver.retainAfterFailure(originalError);send({id,retainedSameSession:result.session===session,retainedSameCdp:result.cdp===cdp,retainedSameDriver:result.driver===driver,originalErrorIdentity:result.originalError===originalError,cleanupAuthorized:result.cleanupAuthorized,status:driver.status(),sendCalls,closeCalls,getterCalls,coercionCalls});return;}
  send({id,rejected:true});
 });
 // IPC must not be the reason the child stays alive after real stdin EOF.
 process.channel.unref();send({ready:true,scenario,pid:process.pid,status:driver.status(),sendCalls,closeCalls,...identity()});
}
if(process.argv.includes('--owned-fake-retention-child'))main();
