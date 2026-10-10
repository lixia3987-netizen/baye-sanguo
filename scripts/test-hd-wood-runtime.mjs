#!/usr/bin/env node
/**
 * R21 actual public-player preparation only. Fresh P4 CaoPi, own Wan20.
 * Original strategy months naturally train ZhangXiu131 (backup ZhangWen130).
 * Real Canvass pickers/orders/costs acquire a qualified infantry; original
 * Save menu writes the two unmodified native save files into a private slot.
 * No direct LevelUp/PolicyExec/CanvassDrv, no config/RNG/world/save edits.
 * Prepare mode now selects real incoming defenders and plays original combat.
 * Cast mode separately loads an unmodified prepared pair and validates 6/7.
 * --staged --preflight-only never starts Chrome. --prepare-only is default.
 * This baseline runner remains under development; successful preflight does
 * not prove preparation or real skill playback. See docs/hd-wood-runtime.md.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeJsonAtomicSync, writeReportAtomicSync } from './hd-runtime-json.mjs';
import { snapshotOwnedChrome, cleanupOwnedChrome } from './hd-runtime-owned-chrome.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staged=process.argv.includes('--staged'),preflightOnly=process.argv.includes('--preflight-only'),castOnly=process.argv.includes('--cast-only'),allowLcd=process.argv.includes('--allow-lcd');
assert.ok(!castOnly||!process.argv.includes('--prepare-only'),'Preparation and cast-only are distinct evidence scopes');
const known=new Set(['--staged','--preflight-only','--prepare-only','--artifact-dir','--months','--canvass-months','--orders-per-month','--save-slot','--720','--resume-checkpoint','--checkpoint-tag','--cast-only','--from-preparation','--allow-lcd','--recruit-arms','--max-turns']);
for(let i=2;i<process.argv.length;i++){assert.ok(known.has(process.argv[i]),'Unsupported option: '+process.argv[i]);if(['--artifact-dir','--months','--canvass-months','--orders-per-month','--save-slot','--resume-checkpoint','--checkpoint-tag','--from-preparation','--recruit-arms','--max-turns'].includes(process.argv[i]))i++;}
const numeric=(name,fallback,max)=>{const i=process.argv.indexOf(name),raw=i<0?String(fallback):process.argv[i+1];assert.ok(/^\d+$/.test(raw||''));const v=Number(raw);assert.ok(Number.isInteger(v)&&v>0&&v<=max);return v;};
const months=numeric('--months',180,720),canvassMonths=numeric('--canvass-months',60,240),ordersPerMonth=numeric('--orders-per-month',4,8),saveSlot=numeric('--save-slot',1,3)-1;
const recruitArms=numeric('--recruit-arms',3000,65535),maxTurns=numeric('--max-turns',20,30);
const preparationFlag=process.argv.indexOf('--from-preparation'),preparationDir=preparationFlag<0?null:path.resolve(process.argv[preparationFlag+1]);
assert.ok(!castOnly||preflightOnly||preparationDir,'Casting requires an actual previously completed public native preparation/save result');
const resumeFlag=process.argv.indexOf('--resume-checkpoint'),resumeDirectory=resumeFlag<0?null:path.resolve(process.argv[resumeFlag+1]);const tagFlag=process.argv.indexOf('--checkpoint-tag'),resumeTag=tagFlag<0?'initial':process.argv[tagFlag+1];assert.ok(!resumeDirectory||!castOnly,'Resume checkpoint prepares only, never a movie shortcut');let resumeInput=null;
const artifactFlag=process.argv.indexOf('--artifact-dir');
const artifactDir=path.resolve(artifactFlag>=0?process.argv[artifactFlag+1]:path.join(root,'build/r21-route-preparation'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.lib':'application/octet-stream','.ttf':'font/ttf'};
const period=4,originCity=20,destination=26,playerKing=0,candidateIds=[131,130];
const report={preflightOnly,prepareOnly:!castOnly,castOnly,allowLcd,recruit:true,recruitArms,maxTurns,staged,period,originCity,destination,months,canvassMonths,ordersPerMonth,saveSlot,startedAt:new Date().toISOString(),phases:[],console:[],exceptions:[],dialogs:[],blocked:[],requests:[],inputs:[]};
const servedAssets=new Map(),nativeMovies=new Map();let nativeLib,plan,font,woodObserverSource,verifyWoodCaptures,preparationInput;let casterPerson=131,casterNativeId=132;const woodEntries=new Map();
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const targetName=()=>path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/');
const productionDirectories=['js','css','assets','vendor/iBaye/src'];
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(directory,item.name)):[path.join(directory,item.name)]);}
const fnv=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619)>>>0;return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+bytes.length;};
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
const childExited=child=>!!child&&(child.exitCode!==null||child.signalCode!==null);
let captureOwnedSnapshot=async()=>null;
function nativeItem(id,index=0) {
    const b=nativeLib,a=b.readUInt32LE((id-1)*4);
    assert.ok(a>0&&a+14<=b.length,'real native resource header bounds');
    const length=b.readUInt32LE(a),count=b.readUInt16LE(a+6),fixed=b.readUInt32LE(a+8);
    assert.equal(b.readUInt16LE(a+4),id);assert.ok(index<count&&a+length<=b.length);assert.equal(b[a+12],0);
    const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(a+14+index*8);
    const size=fixed|| (count===1?length-14:b.readUInt32LE(a+18+index*8));
    assert.ok(offset>=14&&size>0&&offset+size<=length);
    return b.subarray(a+offset,a+offset+size);
}
function nativePicture(bytes,offset=0,multiple=false) {
    assert.ok(offset+7<=bytes.length);const width=bytes.readUInt16LE(offset),height=bytes.readUInt16LE(offset+2),count=bytes.readUInt16LE(offset+4),mask=bytes[offset+6],planeBytes=Math.ceil(width/8)*height;
    assert.ok(width&&height&&count&&mask<=1);
    const length=7+planeBytes*(mask+1)*(multiple?count:1);assert.ok(offset+length<=bytes.length);
    return {width,height,count,mask,planeBytes,rowBytes:Math.ceil(width/8),length,data:bytes.subarray(offset+7,offset+length)};
}
function nativeMovie(id,index=0) {
    const key=id+':'+index;if(nativeMovies.has(key))return nativeMovies.get(key);
    const bytes=nativeItem(id,index),count=bytes[2],picmax=bytes[3],units=[];assert.ok(count&&picmax);
    for(let i=0;i<count;i++){const o=6+i*5;assert.ok(o+5<=bytes.length);units.push({x:bytes[o],y:bytes[o+1],cdelay:bytes[o+2],ndelay:bytes[o+3],picIndex:bytes[o+4]});}
    let offset=6+count*5;const pictures=[];for(let i=0;i<picmax;i++){const picture=nativePicture(bytes,offset);pictures.push(picture);offset+=picture.length;}
    assert.ok(units.every(u=>u.picIndex<picmax));const movie={id,index,count,picmax,start:bytes[4],end:bytes[5],units,pictures,fingerprint:fnv(bytes),length:bytes.length};nativeMovies.set(key,movie);return movie;
}
function freezeAsset(rel) {
    assert.equal(typeof rel,'string');assert.ok(!path.isAbsolute(rel) && !rel.split('/').includes('..'),'Frozen asset path stays in this repository');
    if(servedAssets.has(rel))return servedAssets.get(rel);
    const data=fs.readFileSync(path.join(root,rel)),metadata={source:rel,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
    report.sources[rel]=metadata;servedAssets.set(rel,{data,metadata});return servedAssets.get(rel);
}



function prepareServedAssets(){
 report.sources={};
 report.runtimeHelpers={json:freezeAsset('scripts/hd-runtime-json.mjs').metadata,ownedChrome:freezeAsset('scripts/hd-runtime-owned-chrome.mjs').metadata};
 for(const dir of productionDirectories)for(const filename of walk(path.join(root,dir)))freezeAsset(path.relative(root,filename).replaceAll('\\','/'));
 freezeAsset('scripts/write-wasm-manifest.mjs');nativeLib=freezeAsset('libs/dat-mod.lib').data;freezeAsset('pc.html');freezeAsset('qr.png');freezeAsset('favicon.png');freezeAsset('fonts/HarmonyOS_Sans_SC_Regular.ttf');
 assert.equal(sha(nativeLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 report.tool={source:targetName(),bytes:fs.statSync(fileURLToPath(import.meta.url)).size,sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))};
 const planPath='scripts/specs/hd-wood-runtime-route-plan.json',bytes=freezeAsset(planPath).data;plan=JSON.parse(bytes);assert.equal(sha(bytes),'3788e1ae247c2f5f91cd84d00f0dad284623082ac6f64cf19d81ba4efdbfb2b8');assert.equal(plan.library.sha256,sha(nativeLib));
 report.inputPlan={path:planPath,bytes:bytes.length,sha256:sha(bytes),scope:'Static route facts only; current native ownership, queues, level and costs authorize each input'};
 const movie=nativeMovie(37);assert.deepEqual([movie.count,movie.picmax,movie.start,movie.end,movie.length,movie.fingerprint],[8,2,0,7,1148,'fnv1a32:d38c3c8b:1148']);
 assert.deepEqual(movie.units,Array.from({length:8},(_,i)=>({x:0,y:0,cdelay:20,ndelay:20,picIndex:i%2})));
 assert.deepEqual(movie.pictures.map(p=>[p.width,p.height,p.count,p.mask]),[[64,64,1,0],[66,64,1,0]]);
 const decode=b=>new TextDecoder('gbk',{fatal:true}).decode(b.subarray(0,b.indexOf(0)<0?b.length:b.indexOf(0)));
 const people=nativeItem(61,3),cities=nativeItem(57,3),queue=nativeItem(65,3),iface=nativeItem(2,1);
 for(const p of [plan.preferred.lord,plan.preferred.caster,plan.preferred.backupCaster]){assert.equal(people.subarray(p.personIndex*19,(p.personIndex+1)*19).toString('hex'),p.recordHex);assert.equal(decode(nativeItem(72,p.personIndex)),p.name);}
 const origin=plan.preferred.origin;assert.equal(cities.subarray(20*37,21*37).toString('hex'),origin.recordHex);assert.equal(decode(nativeItem(58,20)),origin.name);assert.deepEqual(Array.from({length:origin.queue.length},(_,i)=>queue.readUInt16LE((origin.queueOffset+i)*2)),origin.queue);
 // IFACE_CONID ConsumeMoney=11 and ConsumeThew=10 are one-based items.
 const costs=nativeItem(2,10),thew=nativeItem(2,9);assert.equal(costs[16],50);assert.equal(thew[16],20);
 assert.deepEqual(Array.from(iface.subarray(10,20)),[5,6,7,8,0,0,0,0,0,0]);
 report.routeRomProof={period,lord:plan.preferred.lord,origin,primary:plan.preferred.caster,backup:plan.preferred.backupCaster,resource37:{length:movie.length,fingerprint:movie.fingerprint,units:movie.units,pictures:movie.pictures.map(p=>({width:p.width,height:p.height,mask:p.mask}))},cost:{order:16,money:50,thew:20},scope:'No actual month, acquisition, save or cast is proven by preflight'};
 for(const name of ['baye.js','baye.wasm','baye.wasm.map','baye.build.json']){const filename=path.join(root,staged?'build/wasm/src':'js',name),data=fs.readFileSync(filename),metadata={source:path.relative(root,filename),bytes:data.length,sha256:sha(data)};report.sources[name]=metadata;servedAssets.set('js/'+name,{data,metadata});}
 const build=JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));assert.equal(build.hdSpeProtocol.version,2);assert.equal(build.hdSkillResultProtocol.version,1);
 for(const name of ['baye.js','baye.wasm','baye.wasm.map']){assert.equal(report.sources[name].bytes,build.artifacts[name].bytes);assert.equal(report.sources[name].sha256,build.artifacts[name].sha256);}
 const hash=crypto.createHash('sha256'),files=[],tracked=execFileSync('git',['ls-files','-z','vendor/iBaye'],{cwd:root}).toString('utf8').split('\0').filter(Boolean).sort();assert.ok(tracked.length);
 for(const name of tracked){const {data,metadata}=freezeAsset(name);files.push({name,bytes:data.length,sha256:metadata.sha256});hash.update(name+'\0');hash.update(data);}
 report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),manifest:build.engineSourceSha256,files};assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256);
 report.engineManifest=build;report.viewport=viewport;report.freezeScope='Exact production JS/CSS/assets/native, tracked engine, standard LIB, private served quartet, real font, this runner and static route plan; no browser in preflight';
}
async function startServer(){
 const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/,'')||'pc.html',snapshot=servedAssets.get(rel);if(!snapshot){report.requests.push({url:url.pathname,status:404});res.writeHead(404).end();return;}report.requests.push({url:url.pathname,status:200,...snapshot.metadata});res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(snapshot.data);}catch{res.writeHead(400).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;
}
async function unusedPort() {
    const socket = net.createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    return port;
}

async function connectCdp(url) {
    const ws = new WebSocket(url);
    let sequence = 0;
    const pending = new Map();
    const listeners = new Map();
    const rejectAll = () => {
        for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('CDP connection closed')); }
        pending.clear();
    };
    ws.addEventListener('close', rejectAll);
    ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const task = pending.get(msg.id); pending.delete(msg.id); clearTimeout(task.timer);
            if (msg.error) task.reject(new Error(JSON.stringify(msg.error)));
            else task.resolve(msg.result);
        } else if (listeners.has(msg.method)) {
            listeners.get(msg.method)(msg.params);
        }
    });
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error('Cannot connect to Chrome DevTools')), { once: true });
    });
    return {
        on: (name, callback) => listeners.set(name, callback),
        send(method, params = {}) {
            if (ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP connection is closed'));
            const id = ++sequence;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
                pending.set(id, { resolve, reject, timer });
                ws.send(JSON.stringify({ id, method, params }));
            });
        },
        close() { rejectAll(); ws.close(); }
    };
}

async function evaluate(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
}

async function waitFor(cdp, description, expression, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const value = await evaluate(cdp, expression);
        if (value) return value;
        await delay(150);
    }
    throw new Error('Timed out waiting for ' + description);
}

const snapshotExpression = `(() => {
    const api = window.baye, d = api && api.data;
    const read = (key) => { try { return d && d[key]; } catch { return null; } };
    return {
        ready: !!(api && api.hd && api.hd.ready()), engineReady: read('g_hdEngineReady'),
        fightMenuControl: read('g_hdFightMenuControl'), period: read('g_PIdx'), playerKing: read('g_PlayerKing'),
        menu: api && api.hd && api.hd.menuItems(), qty: api && api.hd && api.hd.qty(),
        movie: api && api.hd && api.hd.movie(), spe: api && api.hd && api.hd.spe(),
        fight: api && api.hd && api.hd.fight(), march: api && api.hd && api.hd.march(),
        system: window.BayeHdSystemUi && BayeHdSystemUi.debugSnapshot(),
        city: window.BayeHdCityMenu && BayeHdCityMenu.debugSnapshot(),
        dialog: window.BayeHdDialog && BayeHdDialog.debugSnapshot(),
        overworld: window.BayeHdOverworld && BayeHdOverworld.debugSnapshot(),
        battle: window.BayeHdBattle && BayeHdBattle.debugSnapshot(),
        bodyClass: document.body.className, lastHdCall: window.__bayeLastHdCall
    };
})()`;

async function checkpoint(cdp, name) {
    const state = await evaluate(cdp, snapshotExpression);
    // Every preparation battle is separately recorded; it is not WOOD37 acceptance.
    report.phases.push({ name, ...state });
    console.log('PASS', name);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(image.data, 'base64'));
    return state;
}

async function key(cdp, name) {
    report.inputs.push({ type:"key", key:name, at:new Date().toISOString() });
    const codes = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, h: 72, f: 70, s: 83, ' ': 32 };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await delay(180);
}

async function click(cdp, selector) {
    report.inputs.push({ type:"click", selector, at:new Date().toISOString() });
    const point = await evaluate(cdp, `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block: 'center' });
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        const x=rect.x+rect.width/2,y=rect.y+rect.height/2,top=document.elementFromPoint(x,y);
        return {x,y,unobstructed:!!(top&&(top===node||node.contains(top))),top:top&&top.id};
    })()`);
    assert.ok(point, 'Visible click target: ' + selector);
    assert.ok(point.unobstructed, 'Click target is not covered: '+selector+' (top='+point.top+')');
    const mousePoint={x:point.x,y:point.y};
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mousePoint, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mousePoint, button: 'left', clickCount: 1 });
    await delay(250);
}


const speObserverSource='('+function(){
 window.__speSamples=[];window.__speEngineKeys=[];window.__speObserverErrors=[];window.__spePhase='opening';
 const snapshot=()=>{try{return window.baye&&baye.hd&&baye.hd.ready()?JSON.parse(JSON.stringify(baye.hd.spe())):null;}catch{return null;}};
 let api=null,keyInstalled=false;
 Object.defineProperty(window,'BayeHdSpe',{configurable:true,get(){return api;},set(value){api=value;for(const name of ['onEngineSpe','onLcdFlush']){const original=api[name];api[name]=function(){const before=snapshot(),result=original.apply(this,arguments),after=snapshot();try{window.__speSamples.push({stage:name==='onLcdFlush'?'lcd-flush':'lifecycle',phase:window.__spePhase,spe:after,before,after});if(window.__speSamples.length>100000)throw Error('Bounded preparation observation capacity');}catch(e){window.__speObserverErrors.push(String(e));}return result;};}
 if(!keyInstalled&&typeof window.sendKey==='function'){keyInstalled=true;const original=window.sendKey;window.sendKey=function(code){const s=snapshot();window.__speEngineKeys.push({code,phase:window.__spePhase,generation:s&&s.generation,eventId:s&&s.eventId,speActive:s&&s.active,kind:s&&s.kind});return original.apply(this,arguments);};}}});
}.toString()+')();';
async function observeActualLib(cdp,stage){
 const expression="(() => {const generationBefore=Number(baye.data.g_hdSpeGeneration),identityBefore=BayeHdLibIdentity.read(),hex=window.dynLib,preferred=localStorage.getItem('baye/libpath'),identityAfter=BayeHdLibIdentity.read(),generationAfter=Number(baye.data.g_hdSpeGeneration);return {generationBefore,generationAfter,identityBefore,identityAfter,hex,preferred};})()";
 const first=await evaluate(cdp,expression),expected=report.sources['libs/dat-mod.lib'].sha256;
 const verify=r=>{assert.ok(Number.isInteger(r.generationBefore)&&r.generationBefore>0);assert.equal(r.generationAfter,r.generationBefore,'Native generation stays current during actual LIB read');assert.equal(r.identityAfter.generation,r.identityBefore.generation,'Actual LIB identity stays current during read');assert.equal(r.identityBefore.status,'ready');assert.equal(r.identityAfter.status,'ready');assert.equal(r.identityBefore.sha256,expected);assert.equal(r.identityAfter.sha256,expected);assert.equal(typeof r.hex,'string');assert.ok(r.hex.length&&r.hex.length%2===0&&/^[0-9a-f]+$/i.test(r.hex),'Actual loaded dynLib is exact hex bytes');const bytes=Buffer.from(r.hex,'hex');assert.equal(bytes.length,report.sources['libs/dat-mod.lib'].bytes);const hash=sha(bytes);assert.equal(hash,expected,'Actual loaded bytes must equal frozen standard LIB before player route or identity claims');return hash;};
 const hash=verify(first),after=await evaluate(cdp,expression);verify(after);
 assert.equal(after.generationBefore,first.generationBefore,'Native generation stays current across hashing');assert.equal(after.identityBefore.generation,first.identityBefore.generation,'Actual LIB generation stays current across hashing');assert.equal(after.hex,first.hex,'No LIB change is accepted across the hash observation');
 delete first.hex;delete after.hex;
 report.actualLib={preferred:after.preferred,sha256:hash,byteLength:report.sources['libs/dat-mod.lib'].bytes,generation:after.identityAfter.generation,nativeGeneration:after.generationAfter};
 report.actualLibObservations??=[];report.actualLibObservations.push({stage,sha256:hash,before:first,after});return report.actualLib;
}
const campaignWorldExpression=`(() => {
 const d=baye.data,generationBefore=Number(d.g_hdSpeGeneration),keysBefore=window.__speEngineKeys.length,count=baye.getPersonCount();
 const read=id=>{if(!Number.isInteger(id)||id<0||id>=count)throw Error('Actual person ID outside native count');const p=d.g_Persons[id];return {personIndex:id,nativeId:id+1,name:baye.getPersonName(id),belong:Number(p.Belong),oldBelong:Number(p.OldBelong),level:Number(p.Level),experience:Number(p.Experience),iq:Number(p.IQ),force:Number(p.Force),age:Number(p.Age),devotion:Number(p.Devotion),character:Number(p.Character),thew:Number(p.Thew),arms:Number(p.Arms),baseArm:Number(p.ArmsType),armType:baye.hd.personArmType(id),equip:[Number(p.Tool1),Number(p.Tool2)]};};
 const cities=Array.from({length:Number(d.g_engineConfig.citiesCount)},(_,i)=>{const c=d.g_Cities[i],q=Array.from({length:Number(c.Persons)},(_,j)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+j]));return {i,name:baye.getCityName(i),belong:Number(c.Belong),money:Number(c.Money),food:Number(c.Food),reserve:Number(c.MothballArms),queue:q,ownedQueue:q.filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong))};});
 const origin=cities[20],fighters=Array.from({length:Number(d.FIGHTERS.length)},(_,i)=>Number(d.FIGHTERS[i])),orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)!==255).map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),Object:Number(o.Object),TimeCount:Number(o.TimeCount)}));
 const people=Array.from({length:count},(_,id)=>read(id));
 const observed=Array.from(new Set([...origin.queue,131,130,...orders.filter(o=>o.City===20).map(o=>o.Person)])).map(read);
 const enemyIds=cities.filter(c=>c.belong&&c.belong!==Number(d.g_PlayerKing)+1).flatMap(c=>c.queue.filter(id=>Number(d.g_Persons[id].Belong)===c.belong&&id+1!==c.belong));
 return {generationBefore,generationAfter:Number(d.g_hdSpeGeneration),keysBefore,keysAfter:window.__speEngineKeys.length,period:Number(d.g_PIdx),playerKing:Number(d.g_PlayerKing),aiLevelUpSpeed:Number(d.g_engineConfig.aiLevelUpSpeed),enable16bitConsumeMoney:Number(d.g_engineConfig.enable16bitConsumeMoney),date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)},origin,cities,observed,people,orders,fighters,enemyIds,menu:baye.hd.menuItems(),march:baye.hd.march(),qty:baye.hd.qty(),report:baye.hd.report()};
})()`;
async function observeCampaign(cdp,stage){const world=await evaluate(cdp,campaignWorldExpression);assert.equal(world.generationAfter,world.generationBefore);assert.equal(world.keysAfter,world.keysBefore,'Read-only world snapshot sends no key');assert.equal(world.period,4);assert.equal(world.playerKing,0);assert.equal(world.origin.belong,1,'Actual source city remains player owned');assert.equal(world.aiLevelUpSpeed,0,'No artificial AI level acceleration');assert.equal(world.enable16bitConsumeMoney,0);report.campaignObservations??=[];report.campaignObservations.push({stage,world});return world;}
const qualified=p=>p&&p.level>=11&&p.level<=20&&p.armType===1&&p.belong>0&&p.belong!==65535;
const eligibleEnemyCandidates=world=>(world.people||world.observed).filter(p=>qualified(p)&&p.iq>=60&&world.enemyIds.includes(p.personIndex)&&p.personIndex+1!==p.belong).sort((a,b)=>a.devotion-b.devotion||b.level-a.level||b.iq-a.iq||a.personIndex-b.personIndex);
const acquired=world=>(world.people||world.observed).find(p=>p.personIndex!==world.playerKing&&qualified(p)&&p.iq>=60&&p.belong===1&&world.origin.ownedQueue.includes(p.personIndex));
function sameWorld(a,b,label){for(const field of ['date','origin','cities','observed','orders','enemyIds','playerKing','period','aiLevelUpSpeed'])assert.deepEqual(b[field],a[field],label+' preserves actual '+field);}
async function waitCampaignOutcome(cdp,label,predicate,timeout=180000){let deadline=Date.now()+timeout;const acked=new Set();while(Date.now()<deadline){const s=await evaluate(cdp,'({fight:baye.hd.fight(),menu:baye.hd.menuItems(),report:baye.hd.report(),help:baye.hd.help(),qty:baye.hd.qty(),march:baye.hd.march(),dialog:BayeHdDialog.debugSnapshot(),city:BayeHdCityMenu.debugSnapshot(),phase:BayeHdOverworld.debugSnapshot().phase})');if(s.menu.active===1&&s.menu.context===5&&s.menu.kind===2){if(s.menu.count===0){await delay(100);continue;}await playNpcDefense(cdp,label);deadline=Date.now()+timeout;continue;}assert.ok(!s.fight.active||s.fight.over,'Unmatched actual campaign battle is retained as preparation failure');if(s.report.active){const o=s.dialog.reportOwner;if(s.dialog.open&&s.dialog.kind==='report'&&o&&o.seq===s.report.seq&&o.inputSeq===s.report.inputSeq){const token=JSON.stringify(o);if(!acked.has(token)){acked.add(token);const record={label,owner:o,native:s.report,body:s.dialog.body,world:await observeCampaign(cdp,label+' report')};report.campaignReports??=[];report.campaignReports.push(record);await checkpoint(cdp,'campaign-report-'+report.campaignReports.length);const start=await evaluate(cdp,'window.__speEngineKeys.length'),fresh=await evaluate(cdp,'baye.hd.report()');assert.equal(fresh.seq,o.seq);assert.equal(fresh.inputSeq,o.inputSeq);assert.equal(fresh.active,1);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');record.keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);assert.deepEqual(record.keys.map(k=>k.code),[39],'One player acknowledgement for this exact native report');}}}else if(!s.qty.active&&!s.help.active&&!s.city.sending&&!s.city.queueLen&&predicate(s))return s;await delay(100);}throw Error('Bounded wait ended: '+label+'; original world retained, no retry/reset');}
function menuIdentity(m){return {active:m.active,context:m.context,kind:m.kind,seq:m.seq,generation:m.generation,detailGeneration:m.detailGeneration,count:m.count,idsValid:m.idsValid,ids:m.ids,names:m.names};}
async function readNativeMenu(cdp,kind,ids=null){const a=await waitCampaignOutcome(cdp,'actual native menu '+kind,s=>s.menu.active===1&&s.menu.context===1&&s.menu.kind===kind);const m=a.menu;if(kind===3){assert.equal(m.idsValid,true);assert.ok(m.ids.length);assert.equal(m.count,m.ids.length);if(ids)assert.deepEqual(m.ids,ids,'Whole actual native ordered ID list, never name inference');}const b=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(b,m);return m;}
async function lcdVisible(cdp){return waitFor(cdp,'actual classic LCD visible and on top',`(() => {const n=document.getElementById('lcd');if(!n)return false;const r=n.getBoundingClientRect();if(!r.width||!r.height||r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5)return false;for(let a=n;a;a=a.parentElement){const s=getComputedStyle(a);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)return false;}return [[.2,.2],[.5,.5],[.8,.8]].every(p=>document.elementsFromPoint(r.x+r.width*p[0],r.y+r.height*p[1])[0]===n)&&{x:r.x,y:r.y,width:r.width,height:r.height};})()`);}
async function selectNativeMenu(cdp,owner,index,label){assert.ok(Number.isInteger(index)&&index>=0&&index<owner.count);const identity=menuIdentity(owner),record={label,owner,index,moves:[],lcd:await lcdVisible(cdp)};let m=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(menuIdentity(m),identity);for(let i=0;m.index!==index&&i<owner.count;i++){const before=await observeCampaign(cdp,label+' arrow before'),next=m.index+(index>m.index?1:-1),name=index>m.index?'ArrowDown':'ArrowUp',code=index>m.index?35:34,start=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,name);m=await waitFor(cdp,label+' exact highlight ACK',`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===${owner.kind}&&m.seq===${owner.seq}&&m.generation===${owner.generation}&&m.detailGeneration===${owner.detailGeneration}&&m.index===${next}&&m;})()`);assert.deepEqual(menuIdentity(m),identity);const after=await observeCampaign(cdp,label+' arrow after');sameWorld(before,after,label+' highlight');const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);assert.deepEqual(keys.map(k=>k.code),[code]);record.moves.push({beforeIndex:next-(code===35?1:-1),index:next,keys});}
 assert.equal(m.index,index);await lcdVisible(cdp);const fresh=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(fresh,m);const start=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,'Enter');record.confirmKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);assert.deepEqual(record.confirmKeys.map(k=>k.code),[39]);report.nativeSelections??=[];report.nativeSelections.push(record);return record;}
async function retireToMap(cdp,label){const before=await observeCampaign(cdp,label+' before'),start=await evaluate(cdp,'window.__speEngineKeys.length');for(let i=0;i<4;i++){const s=await waitCampaignOutcome(cdp,label+' Back owner',s=>s.menu.active&&s.menu.context===1||!s.menu.active&&s.march.pick===1&&s.march.phase===0);if(!s.menu.active)break;await lcdVisible(cdp);const m=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(m,s.menu);const n=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,'Escape');await waitFor(cdp,label+' owner retired',`!baye.hd.menuItems().active||baye.hd.menuItems().seq!==${m.seq}`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${n})`)).map(k=>k.code),[40]);}await waitCampaignOutcome(cdp,label+' actual map',s=>!s.menu.active&&s.march.pick===1&&s.march.phase===0&&s.march.battlePick===0&&s.phase==='map');const after=await observeCampaign(cdp,label+' after');sameWorld(before,after,label+' cancellation');return {before,after,keys:await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)};}
async function openSystem(cdp,label){const before=await observeCampaign(cdp,label+' before');assert.ok(!before.menu.active&&!before.qty.active&&!before.report.active&&before.march.pick===1&&before.march.phase===0);const start=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,'Escape');const owner=await waitFor(cdp,label+' native FunctionMenu',`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active===1&&m.context===2&&m.names[0]==='策略结束'&&s.open&&s.screen==='insystem'&&m;})()`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)).map(k=>k.code),[40]);return owner;}
async function executeMonth(cdp,number,orders=[]){await retireToMap(cdp,'month-'+number);const defenseStart=(report.extraDefenses||[]).length,before=await observeCampaign(cdp,'month-'+number+' before execution'),owner=await openSystem(cdp,'month-'+number),start=await evaluate(cdp,'window.__speEngineKeys.length');assert.deepEqual(await evaluate(cdp,'baye.hd.menuItems()'),owner);await click(cdp,'#hd-system-ui [data-hd-sys="0"][data-hd-sys-owner]');await waitCampaignOutcome(cdp,'original strategy month '+number,s=>!s.menu.active&&s.march.pick===1&&s.march.phase===0&&s.march.battlePick===0&&s.phase==='map'&&s.march.mapInputSeq>before.march.mapInputSeq);const after=await observeCampaign(cdp,'month-'+number+' after execution'),serial=x=>x.year*12+x.month-1;assert.equal(serial(after.date),serial(before.date)+1,'One actual strategy month, never direct PolicyExec');recordAbandonmentMonth(after,defenseStart,'actual month '+number);for(const o of orders){assert.equal(after.orders.filter(x=>x.OrderId===16&&x.City===20&&x.Person===o.envoy).length,0);assert.ok(after.origin.queue.includes(o.envoy),'Original envoy returned through AddPerson');assert.equal(after.observed.find(p=>p.personIndex===o.envoy)?.belong,1);}report.monthReceipts??=[];const record={number,before,after,orders,owner,keys:await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)};report.monthReceipts.push(record);await evaluate(cdp,"BayeHdCityMenu.setMode('classic');");await checkpoint(cdp,'month-'+String(number).padStart(3,'0')+'-actual-world');return after;}
async function openCanvass(cdp){const before=await observeCampaign(cdp,'canvass before entry');assert.ok(before.origin.money>=50);const pos=await evaluate(cdp,'BayeHdOverworld.cityScreenPos(20)');assert.equal(pos.index,20);assert.equal(pos.name,await evaluate(cdp,'baye.getCityName(20)'));const walk=await evaluate(cdp,'BayeHdOverworld.walkToCity(20)');assert.deepEqual(walk,{name:pos.name,to:{x:pos.engX,y:pos.engY}});const rootOwner=await readNativeMenu(cdp,1);const i=rootOwner.names.indexOf('外交');assert.ok(i>=0);await selectNativeMenu(cdp,rootOwner,i,'real foreign submenu');const sub=await readNativeMenu(cdp,2),j=sub.names.indexOf('招揽');assert.ok(j>=0);await selectNativeMenu(cdp,sub,j,'real Canvass command');return readNativeMenu(cdp,3,before.origin.ownedQueue);}
async function queueCanvass(cdp,target,number){const world=await observeCampaign(cdp,'canvass-'+number+' candidates'),currentTarget=(world.people||world.observed).find(p=>p.personIndex===target.personIndex);assert.ok(qualified(currentTarget)&&currentTarget.belong!==1&&world.enemyIds.includes(target.personIndex));assert.ok(world.origin.money>=50);const own=await openCanvass(cdp),eligible=world.observed.filter(p=>own.ids.includes(p.personIndex)&&p.belong===1&&p.thew>=20&&p.personIndex!==0);assert.ok(eligible.length,'Current real envoy with sufficient Thew');eligible.sort((a,b)=>a.iq-b.iq||a.personIndex-b.personIndex);const envoy=eligible[0];await selectNativeMenu(cdp,own,own.ids.indexOf(envoy.personIndex),'Canvass envoy '+envoy.personIndex);const enemyWorld=await observeCampaign(cdp,'canvass-'+number+' enemy picker'),enemy=await readNativeMenu(cdp,3,enemyWorld.enemyIds);assert.notEqual(enemy.seq,own.seq,'Enemy list has a new actual native picker owner');const index=enemy.ids.indexOf(target.personIndex);assert.ok(index>=0,'Qualified actual target is in complete current enemy roster');await selectNativeMenu(cdp,enemy,index,'Canvass actual target '+target.personIndex);await waitCampaignOutcome(cdp,'queued original Canvass',s=>s.menu.active&&s.menu.context===1&&[1,2].includes(s.menu.kind)||!s.menu.active&&s.march.pick===1&&s.march.phase===0);const after=await observeCampaign(cdp,'canvass-'+number+' queued');assert.equal(after.origin.money,world.origin.money-50);assert.equal(after.observed.find(p=>p.personIndex===envoy.personIndex).thew,envoy.thew-20);assert.deepEqual(after.origin.queue,world.origin.queue.filter(id=>id!==envoy.personIndex));const pending=after.orders.filter(o=>o.OrderId===16&&o.City===20&&o.Person===envoy.personIndex&&o.Object===target.personIndex);assert.equal(pending.length,1);assert.equal(pending[0].TimeCount,10);assert.deepEqual(after.date,world.date);assert.equal((after.people||after.observed).find(p=>p.personIndex===target.personIndex).belong,currentTarget.belong,'Queued order is not an acquisition');const record={number,envoy:envoy.personIndex,target:target.personIndex,before:world,own,enemy,after,order:pending[0]};report.canvassOrders??=[];report.canvassOrders.push(record);await checkpoint(cdp,'canvass-'+number+'-real-order');await retireToMap(cdp,'canvass-'+number+' after queue');return record;}
async function prepareCaster(cdp){let world=await observeCampaign(cdp,'initial actual world'),current=acquired(world);assert.ok(!current,'This fresh private P4 starts without an owned qualified caster');report.trainingBudget={months,canvassMonths,ordersPerMonth,guarantee:false,candidatePolicy:'Read every actual native person; current full enemyIds resident, derived infantry1, Level>=11, IQ>=60, never the owning lord. Rank actual Devotion then Level/IQ; no artificial training or fixed-ID guarantee.'};let qualifiedTarget=null;
 for(let n=0;n<=months;n++){world=await observeCampaign(cdp,'training-'+n);qualifiedTarget=eligibleEnemyCandidates(world)[0];if(qualifiedTarget)break;if(n===months)break;world=await executeMonth(cdp,n+1);if((n+1)%3===0){await saveActualPreparation(cdp,'month-'+String(n+1).padStart(3,'0'),false);await strengthenProtectedCities(cdp,n+1);await saveActualPreparation(cdp,'month-'+String(n+1).padStart(3,'0')+'-strengthened',false);}}
 assert.ok(qualifiedTarget,'Natural AI level budget ended without an actual eligible Lv11 infantry; keep failure without fake XP/config');report.actualTraining={target:qualifiedTarget,months:report.monthReceipts.length,world};await checkpoint(cdp,'actual-natural-level11-candidate');
 for(let month=1;month<=canvassMonths;month++){const orders=[];for(let n=1;n<=ordersPerMonth;n++){world=await observeCampaign(cdp,'join-month-'+month+' order-'+n);if(acquired(world))break;const target=eligibleEnemyCandidates(world)[0];if(!target){report.costStops??=[];report.costStops.push({month,reason:'No current qualified non-lord enemy resident',world});break;}const eligible=world.observed.filter(p=>world.origin.ownedQueue.includes(p.personIndex)&&p.thew>=20&&p.personIndex!==0);if(world.origin.money<50||!eligible.length){report.costStops??=[];report.costStops.push({month,reason:world.origin.money<50?'Actual Money below native50':'No actual available envoy with native20Thew',world});break;}orders.push(await queueCanvass(cdp,target,(report.canvassOrders?.length||0)+1));}world=await executeMonth(cdp,(report.monthReceipts.length||0)+1,orders);current=acquired(world);if(current)break;}
 assert.ok(current,'Natural Canvass budget ended without actual Belong1/current Wan20 queue/derived infantry/Lv11; preserve failure');report.actualAcquisition={caster:current,world,scope:'Real original Canvass orders and months, exact current Belong1 and queue; report text alone does not authorize ownership'};await observeActualLib(cdp,'actual natural owned caster');await checkpoint(cdp,'actual-owned-level11-infantry');return current;}
async function saveActualPreparation(cdp,tag='final',requireCaster=true){const before=await observeCampaign(cdp,'before public native save '+tag);if(requireCaster)assert.ok(acquired(before));const owner=await openSystem(cdp,'public native save');assert.equal(owner.names[1],'存储进度');await click(cdp,'#hd-system-ui [data-hd-sys="1"][data-hd-sys-owner]');const record=await waitFor(cdp,'original save record owner',`(() => {const r=baye.hd.record(),s=BayeHdSystemUi.debugSnapshot();return r.active===1&&r.mode===1&&s.open&&s.screen==='saveload'&&r;})()`);assert.equal(record.count,3);const n=await evaluate(cdp,'window.__speEngineKeys.length');await click(cdp,`#hd-system-ui [data-hd-sys="${saveSlot}"][data-hd-sys-owner]`);await waitFor(cdp,'original save fully returned with new actual map owner',`(() => {const m=baye.hd.march(),menu=baye.hd.menuItems(),sys=BayeHdSystemUi.debugSnapshot();return !baye.hd.record().active&&!menu.active&&!sys.open&&m.pick===1&&m.phase===0&&m.mapInputSeq>${before.march.mapInputSeq}&&BayeSaveStorage.inspectSlot(${saveSlot}).canLoad&&!localStorage.getItem('baye/save-transaction/${saveSlot}');})()`);const snapshot=await evaluate(cdp,`(() => {const slot=${saveSlot},keys=[slot*2,slot*2+1].map(i=>'baye//data//sango'+i+'.sav');return {slot,info:BayeSaveStorage.inspectSlot(slot),files:keys.map(key=>({key,hex:BayeSaveStorage.readFile(key),lib:BayeSaveStorage.readMetadata(key+'.lib'),name:BayeSaveStorage.readMetadata(key+'.name'),identity:BayeSaveStorage.readMetadata(key+'.lib-id')})),lastError:BayeSaveStorage.lastError()};})()`);assert.equal(snapshot.info.status,'ready');assert.equal(snapshot.info.period,4);assert.equal(snapshot.info.king,0);assert.equal(snapshot.lastError,null);const files=[];for(const f of snapshot.files){assert.ok(/^(?:[0-9a-fA-F]{2})+$/.test(f.hex));const data=Buffer.from(f.hex,'hex'),name='native-'+tag+'-'+path.basename(f.key);fs.writeFileSync(path.join(artifactDir,name),data);files.push({...f,hex:undefined,path:name,bytes:data.length,sha256:sha(data),scope:'Exact bytes read from original public native save, never edited/re-encoded as a new world'});}const after=await observeCampaign(cdp,'after public native save');sameWorld(before,after,'Saving');const byteProof=validateSavedPair(files.map(f=>fs.readFileSync(path.join(artifactDir,f.path))),after,'actual completed native save '+tag);const proof={tag,owner,record,slot:saveSlot,info:snapshot.info,files,byteProof,before,after,keys:await evaluate(cdp,`window.__speEngineKeys.slice(${n})`)};if(requireCaster)report.publicSave=proof;else {report.publicCheckpoints??=[];report.publicCheckpoints.push(proof);}await checkpoint(cdp,'prepared-public-native-save-'+tag);if(!requireCaster){await waitFor(cdp,'actual original map after checkpoint save','!baye.hd.menuItems().active&&!baye.hd.record().active&&baye.hd.march().pick===1&&baye.hd.march().phase===0');proof.mapReturn=await evaluate(cdp,'({menu:baye.hd.menuItems(),march:baye.hd.march(),keys:window.__speEngineKeys.length})');assert.equal(proof.mapReturn.keys,n+1,'Save confirmation returns natively to map with no extra EXIT/Enter');sameWorld(after,await observeCampaign(cdp,'after native checkpoint map return '+tag),'Saved checkpoint native return');}await captureOwnedSnapshot('after-public-native-save-'+tag);}
async function smoke(cdp){if(resumeInput){await loadResumeCheckpoint(cdp);await strengthenProtectedCities(cdp,0);await saveActualPreparation(cdp,'resume-strengthened',false);await prepareCaster(cdp);await saveActualPreparation(cdp);assert.deepEqual(await evaluate(cdp,'window.__speObserverErrors'),[]);report.preparationAccepted=true;report.hdAccepted=false;report.scope={accepted:'Public import/load of an independently byte-verified original native saved pair, followed by original actual months/Canvass/defense/save',notRun:'No WOOD37 cast or HD movie acceptance'};return;}await waitFor(cdp,'real SPE v2 ready','window.baye&&baye.hd&&baye.hd.ready()&&baye.hd.spe().protocolVersion===2',60000);await observeActualLib(cdp,'opening actual bytes');const opening=await waitFor(cdp,'actual skippable MAIN3',"(() => {const s=baye.hd.spe();return s.active===1&&s.id===3&&s.kind===1&&s.skipEligible&&s;})()");await checkpoint(cdp,'01-original-MAIN');const start=await evaluate(cdp,'window.__speEngineKeys.length'),fresh=await evaluate(cdp,'baye.hd.spe()');assert.equal(fresh.eventId,opening.eventId);assert.equal(fresh.generation,opening.generation);assert.equal(fresh.skipEligible,true);await key(cdp,'Enter');await waitFor(cdp,'original opening skip acknowledged',`(() => {const s=baye.hd.spe();return s.lastEnd.eventId===${opening.eventId}&&s.lastEnd.reason==='key'&&s.lastEnd.key===39;})()`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)).map(k=>k.code),[39]);await waitFor(cdp,'actual title picture',"window.__speSamples.some(r=>r.spe&&r.spe.id===100)");await key(cdp,'Enter');await waitFor(cdp,'actual period picture',"window.__speSamples.some(r=>r.spe&&r.spe.id===104)");for(let i=1;i<period;i++)await key(cdp,'ArrowDown');await key(cdp,'Enter');const kings=await waitFor(cdp,'actual period4 lords',"Number(baye.data.g_PIdx)===4&&baye.hd.kings().count>0&&baye.hd.kings()");const wanted=kings.kings.findIndex(k=>k.id===0&&k.name==='曹丕');assert.ok(wanted>=0);for(let i=kings.index;i<wanted;i++)await key(cdp,'ArrowDown');for(let i=kings.index;i>wanted;i--)await key(cdp,'ArrowUp');await waitFor(cdp,'actual CaoPi highlight',`baye.hd.kings().index===${wanted}`);await key(cdp,'Enter');await waitFor(cdp,'original strategy map','!baye.hd.menuItems().active&&baye.hd.march().pick===1&&baye.hd.march().phase===0');await evaluate(cdp,"window.__spePhase='preparation';BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('classic');BayeHdSystemUi.setMode('hd');");await waitFor(cdp,'actual HD map and classic city input',"BayeHdOverworld.debugSnapshot().phase==='map'&&BayeHdOverworld.getMode()==='hd-map'&&BayeHdCityMenu.getMode()==='classic'");await observeActualLib(cdp,'fresh P4 actual standard');await checkpoint(cdp,'02-fresh-period4-world');await preparationCapital(cdp);await saveActualPreparation(cdp,'initial',false);await strengthenProtectedCities(cdp,0);await saveActualPreparation(cdp,'initial-strengthened',false);await prepareCaster(cdp);await saveActualPreparation(cdp);assert.deepEqual(await evaluate(cdp,'window.__speObserverErrors'),[]);report.preparationAccepted=true;report.hdAccepted=false;report.scope={accepted:'Fresh P4 actual original strategy months/natural AI LevelUp, public Canvass exact-ID orders/costs/ack, real owned qualified infantry and native public save pair',notRun:'No dispatch/skill6/skill7/movie/LCD or HD oracle; no whole HD or long-term route guarantee'};}

async function prepareCastInputs(){
 const helper='scripts/hd-wood-runtime-oracle.mjs';freezeAsset(helper);const module=await import(pathToFileURL(path.join(root,helper)).href);woodObserverSource=module.woodObserverSource;verifyWoodCaptures=module.verifyWoodCaptures;assert.equal(typeof woodObserverSource,'string');assert.equal(typeof verifyWoodCaptures,'function');
 const text=servedAssets.get('vendor/iBaye/src/platform/js/font.bin.c').data.toString('utf8');font=Buffer.from([...text.matchAll(/0x([\da-f]{2})/gi)].map(m=>parseInt(m[1],16)));assert.equal(font.length,163840);assert.equal(sha(font),'31197c48c77e82bc244b17f44e405a3a055df8162af06fadd7271cc1990cc6b8');
 const manifest=JSON.parse(servedAssets.get('assets/hd-spe/manifest.json').data);assert.equal(manifest.libSha256,sha(nativeLib));assert.equal(manifest.axScale,1);
 const movie=nativeMovie(37),number=nativePicture(nativeItem(15),0,true);assert.deepEqual([number.width,number.height,number.count,number.mask],[12,16,10,0]);
 for(const skillId of [6,7]){const end=skillId===6?7:0,e=manifest.entries.find(e=>e.kind===2&&e.speId===37&&e.resourceIndex===0&&e.startFrm===0&&e.endFrm===end&&e.skillId===skillId);if(!allowLcd)assert.ok(e,'Strict cast preflight requires authenticated actual skill'+skillId+' art entry');if(!e)continue;assert.equal(e.opaqueCoverageVersion,1);assert.equal(e.skillResultVersion,1);assert.equal(e.resourceFingerprint,movie.fingerprint);assert.equal(e.resourceLength,movie.length);assert.equal(e.count,8);assert.equal(e.picmax,2);assert.deepEqual(e.units.map(u=>[u.frame,u.x,u.y,u.picIndex]),movie.units.map((u,i)=>[i,u.x,u.y,u.picIndex]));assert.equal(e.skillNumber.resourceFingerprint,fnv(nativeItem(15)));assert.equal(e.skillNumber.resourceLength,nativeItem(15).length);
  for(const i of skillId===6?[0,1]:[0]){const p=e.pictures.find(p=>p.picIndex===i);assert.ok(p&&p.src);const bytes=freezeAsset(p.src).data;assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[i?66:64,64,i?66:64,64,0]);assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[p.width,p.height]);}woodEntries.set(skillId,e);}
 const records=nativeItem(10);report.actualWoodSkills=[6,7].map(id=>{const row=records.subarray((id-1)*34,id*34),expected=plan.skills.find(p=>p.id===id);assert.equal(row.toString('hex'),expected.recordHex);const name=new TextDecoder('gbk',{fatal:true}).decode(nativeItem(11,id-1));assert.equal(name,expected.name);return {...expected,resourceId:37,start:0,end:id===6?7:0};});
 if(!preparationDir){assert.ok(preflightOnly);report.preparationPending={noBrowser:true,reason:'No completed public native save pair supplied; static cast source preflight alone does not authorize load/ownership'};return;}
 const rel=path.relative(root,preparationDir).replaceAll('\\','/');assert.ok(rel.startsWith('build/')&&!rel.split('/').includes('..'),'Preparation evidence is an existing repository build artifact, never user storage');const resultBytes=freezeAsset(rel+'/result.json').data,input=JSON.parse(resultBytes);assert.equal(input.ok,true);assert.equal(input.preparationAccepted,true);assert.equal(input.hdAccepted,false);assert.equal(input.period,4);assert.equal(input.originCity,20);assert.equal(input.sourceVerification.ok,true);assert.equal(input.isolation.cleaned,true);assert.equal(input.actualLib.sha256,sha(nativeLib));assert.equal(input.publicSave.info.status,'ready');assert.equal(input.publicSave.info.period,4);assert.equal(input.publicSave.info.king,0);assert.equal(input.publicSave.files.length,2);assert.equal(input.publicSave.byteProof.ok,true,'Actual final save requires completed map ACK and independent native bytes');
 const acquiredCaster=input.actualAcquisition?.caster,world=input.publicSave.after;
 assert.ok(acquiredCaster&&Number.isInteger(acquiredCaster.personIndex)&&acquiredCaster.personIndex>=0&&acquiredCaster.personIndex<2000&&acquiredCaster.personIndex!==world.playerKing);
 const caster=(world.people||world.observed).find(p=>p.personIndex===acquiredCaster.personIndex);
 assert.ok(caster&&caster.belong===1&&qualified(caster)&&caster.iq>=60&&world.origin.belong===1&&world.origin.ownedQueue.includes(caster.personIndex),'Only the actual saved, owned Lv11/IQ60 infantry resident authorizes a cast route; no fixed-name or fixed-two-ID assumption');
 for(const field of ['personIndex','nativeId','belong','level','iq','baseArm','armType'])assert.equal(caster[field],acquiredCaster[field],'Prepared caster remains the same actual person at native save '+field);
 casterPerson=caster.personIndex;casterNativeId=casterPerson+1;
 const files=input.publicSave.files.map(f=>{assert.ok(f.path&&path.basename(f.path)===f.path);const bytes=freezeAsset(rel+'/'+f.path).data;assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);return {key:f.key,hex:bytes.toString('hex'),lib:f.lib,name:f.name,identity:f.identity,path:rel+'/'+f.path,bytes:f.bytes,sha256:f.sha256};});assert.ok(files.every(f=>f.lib==='libs/dat-mod.lib'&&typeof f.identity==='string'&&f.identity.length));assert.equal(files[0].identity,files[1].identity);
 const nativeByteProof=validateSavedPair(files.map(f=>Buffer.from(f.hex,'hex')),input.publicSave.after,'Actual prepared original pair before cast browser');preparationInput={slot:input.publicSave.slot,files,world:input.publicSave.after,caster,nativeByteProof};report.preparationInput={directory:rel,result:{bytes:resultBytes.length,sha256:sha(resultBytes)},executedTool:input.tool,caster,slot:input.publicSave.slot,files:files.map(({hex,...f})=>f),nativeByteProof,sourceBoundary:'Unmodified original public native saved pair and successful preparation report; fresh native load still required, no edited world bytes'};report.casterPerson=casterPerson;report.casterNativeId=casterNativeId;
}
async function loadActualPreparation(cdp){
 await waitFor(cdp,'actual SPE v2 ready','window.baye&&baye.hd&&baye.hd.ready()&&baye.hd.spe().protocolVersion===2',60000);await observeActualLib(cdp,'cast boot actual bytes');
 const opening=await waitFor(cdp,'actual skippable native MAIN3',"(() => {const s=baye.hd.spe();return s.active===1&&s.id===3&&s.kind===1&&s.skipEligible&&s;})()"),start=await evaluate(cdp,'window.__speEngineKeys.length'),fresh=await evaluate(cdp,'baye.hd.spe()');assert.equal(fresh.generation,opening.generation);assert.equal(fresh.eventId,opening.eventId);assert.equal(fresh.skipEligible,true);await key(cdp,'Enter');await waitFor(cdp,'actual opening skip ended',`baye.hd.spe().lastEnd.eventId===${opening.eventId}&&baye.hd.spe().lastEnd.key===39&&baye.hd.spe().lastEnd.reason==='key'`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)).map(k=>k.code),[39]);
 await waitFor(cdp,'original title loaded',"window.__speSamples.some(r=>r.spe&&r.spe.id===100)");assert.ok(preparationInput);const before=await evaluate(cdp,'({spe:baye.hd.spe(),keys:window.__speEngineKeys.length,record:baye.hd.record()})');
 const pair={sav0:preparationInput.files[0].hex,sav1:preparationInput.files[1].hex,lib:preparationInput.files[0].lib,name:preparationInput.files[0].name,identity:preparationInput.files[0].identity};
 const imported=await evaluate(cdp,`(() => {const pair=${JSON.stringify(pair)};if(!BayeSaveStorage.validatePair(pair.sav0,pair.sav1))throw Error('Original native saved pair rejected');const ok=BayeSaveStorage.importSlot(${preparationInput.slot},pair);return {ok,slot:BayeSaveStorage.inspectSlot(${preparationInput.slot}),keys:window.__speEngineKeys.length};})()`);assert.equal(imported.ok,true);assert.equal(imported.slot.canLoad,true);assert.equal(imported.keys,before.keys,'Public unmodified save import emits no game key');assert.equal(imported.slot.period,4);assert.equal(imported.slot.king,0);report.publicImport={before,imported,files:report.preparationInput.files};
 // Native title index0 is new game; index1 loads an existing native record.
 await key(cdp,'ArrowDown');await key(cdp,'Enter');const record=await waitFor(cdp,'actual native LOAD record owner',"(() => {const r=baye.hd.record();return r.active===1&&r.mode===2&&r;})()");assert.equal(record.count,4);assert.ok(Number.isInteger(record.index)&&record.index>=0&&record.index<4);
 let current=record;for(let n=0;current.index!==preparationInput.slot&&n<4;n++){const wanted=current.index+(preparationInput.slot>current.index?1:-1),name=preparationInput.slot>current.index?'ArrowDown':'ArrowUp',prior=current;await key(cdp,name);current=await waitFor(cdp,'native record highlight ACK',`(() => {const r=baye.hd.record();return r.active===1&&r.mode===2&&r.index===${wanted}&&r;})()`);assert.equal(current.seq,prior.seq);assert.equal(current.count,4);}
 assert.equal(current.index,preparationInput.slot);assert.deepEqual(await evaluate(cdp,'baye.hd.record()'),current);await key(cdp,'Enter');await waitFor(cdp,'actual native saved world loaded','!baye.hd.record().active&&Number(baye.data.g_PIdx)===4&&Number(baye.data.g_PlayerKing)===0&&baye.hd.march().pick===1&&baye.hd.march().phase===0',60000);
 const world=await observeCampaign(cdp,'fresh actual loaded public native save');sameWorld(preparationInput.world,world,'Unmodified original native load');validateSavedPair(preparationInput.files.map(f=>Buffer.from(f.hex,'hex')),world,'Fresh actual native cast world');assert.ok(acquired(world)&&acquired(world).personIndex===casterPerson);await observeActualLib(cdp,'after public native load');report.nativeLoad={record,current,world};await checkpoint(cdp,'01-original-saved-level11-world');
 await evaluate(cdp,"window.__spePhase='battle';BayeHdSystemUi.setMode('hd');BayeHdCityMenu.setMode('hd');BayeHdOverworld.setMode('hd-map');BayeHdBattle.setMode('hd');");await waitFor(cdp,'loaded owned actual HD map',"BayeHdOverworld.debugSnapshot().phase==='map'&&BayeHdOverworld.getMode()==='hd-map'");await marchWood(cdp);
}
async function action(cdp, label, expression) {
    const before=await evaluate(cdp,'({fight:baye.hd.fight(),march:baye.hd.march(),menu:baye.hd.menuItems()})');
    const result=await evaluate(cdp, expression);
    report.inputs.push({type:'action', label, before, result, at:new Date().toISOString()});
    return result;
}

function recruitWorldExpression(cityIndex) {
    return `(() => {
        const d=baye.data,c=d.g_Cities[${cityIndex}],count=baye.getPersonCount();
        const ids=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));
        const persons=ids.map(id=>{if(!Number.isInteger(id)||id<0||id>=count)throw Error('Invalid native PersonQueue ID');const p=d.g_Persons[id];return {personIndex:id,nativeGenId:id+1,name:baye.getPersonName(id),belong:Number(p.Belong),arms:Number(p.Arms),thew:Number(p.Thew),force:Number(p.Force),iq:Number(p.IQ),armType:baye.hd.personArmType(id)};});
        const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)!==255).map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),TimeCount:Number(o.TimeCount)}));
        return {cityIndex:${cityIndex},personQueueOffset:Number(c.PersonQueue),personCount:Number(c.Persons),personQueue:ids,belong:Number(c.Belong),playerKing:Number(d.g_PlayerKing),money:Number(c.Money),reserve:Number(c.MothballArms),armsPerMoney:Number(d.g_engineConfig.armsPerMoney),persons,orders,date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)},menu:baye.hd.menuItems(),qty:baye.hd.qty()};
    })()`;
}

async function currentPersonPicker(cdp,label,cityIndex) {
    return waitFor(cdp,'actual '+label+' native IDs',`(() => {
        const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),d=baye.data,c=d.g_Cities[${cityIndex}];
        if(s.layer!=='deep'||s.deepLabel!==${JSON.stringify(label)}||!m.active||m.context!==1||m.kind!==3||!m.idsValid||!m.ids.length||s.sending||s.queueLen)return false;
        const actual=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong));
        if(JSON.stringify(actual)!==JSON.stringify(m.ids))throw Error('Native picker IDs differ from actual allied PersonQueue');
        const owner=s.deepMenuOwner;
        if(!owner||owner.context!==m.context||owner.kind!==m.kind||owner.seq!==m.seq||owner.detailGeneration!==m.detailGeneration||
            !m.ids.every((id,index)=>s.deepItems.some(item=>item.i===index&&item.pind===id)))return false;
        return {menu:m,city:s,personIds:actual};
    })()`);
}

async function chooseNativePerson(cdp,label,cityIndex,personIndex) {
    const picker=await currentPersonPicker(cdp,label,cityIndex),index=picker.menu.ids.indexOf(personIndex);
    assert.ok(index>=0,'Requested person is in the actual native '+label+' picker');
    const item=picker.city.deepItems.find(item=>item.i===index);
    assert.equal(item?.pind,personIndex,'HD row belongs to the exact current native U16 person ID');
    await click(cdp,`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${personIndex}"]`);
    const qty=await waitFor(cdp,label+' genuine quantity wait',`(() => {
        const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();
        if(s.qtyAckFailed)throw Error('Native quantity ACK failed: '+s.qtyAckError);
        return q.active&&q.protocol&&q.ready===1&&q.min===0&&q.max>0&&BayeHdCityMenu.isQtyLive()&&!s.sending&&!s.queueLen&&q;
    })()`);
    assert.ok(Number.isInteger(qty.session)&&qty.session>0);
    assert.ok(Number.isInteger(qty.step)&&qty.step>0);
    return {picker,index,personIndex,nativeGenId:personIndex+1,qty};
}

async function setRecruitQuantity(cdp,initial,description,requestedArms=recruitArms) {
    const wanted=Math.min(initial.max,requestedArms),steps=[];
    assert.ok(Number.isInteger(wanted)&&wanted>=initial.min&&wanted>0,'Requested amount is inside actual native bounds');
    let q=initial;
    const keyAck=async(name,expectedValue=null)=>{
        const before=q,code={h:0x26,ArrowLeft:0x24,ArrowRight:0x25,ArrowUp:0x22,ArrowDown:0x23}[name];
        await key(cdp,name);
        q=await waitFor(cdp,description+' '+name+' native ACK',`(() => {
            const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();
            if(s.qtyAckFailed)throw Error('Native quantity ACK failed: '+s.qtyAckError);
            return q.active&&q.protocol&&q.session===${initial.session}&&q.ready===1&&q.inputSeq!==${before.inputSeq}&&!s.sending&&!s.queueLen&&q;
        })()`);
        assert.equal(q.inputSeq,before.inputSeq===0xffffffff?1:before.inputSeq+1,'One player key has exactly one native quantity receipt');
        assert.equal(q.lastKey,code,'Receipt belongs to this exact physical quantity key');
        assert.equal(q.min,initial.min);assert.equal(q.max,initial.max);
        if(expectedValue!==null)assert.equal(q.value,expectedValue,'Native quantity changed by the observed arithmetic place');
        steps.push({physicalKey:name,nativeCode:code,before,after:q});
    };
    if(q.value!==wanted) {
        // H is the original NumOperate max/min toggle. Start from real min0;
        // physical arrows then use C's observed decimal step, never a setter.
        if(q.value!==q.max)await keyAck('h',q.max);
        await keyAck('h',q.min);
        for(let iterations=0;q.value!==wanted&&iterations<100;iterations++) {
            const remaining=wanted-q.value;
            assert.ok(remaining>0,'Quantity planner never exceeds its original requested amount');
            const place=10**Math.floor(Math.log10(remaining));
            if(q.step<place)await keyAck('ArrowLeft',q.value);
            else if(q.step>place)await keyAck('ArrowRight',q.value);
            else await keyAck('ArrowUp',q.value+q.step);
        }
    }
    assert.equal(q.value,wanted,'Player controls reached min(actual native max,requested amount)');
    return {initial,requested:requestedArms,wanted,steps,atConfirmation:q};
}

async function commitRecruitQuantity(cdp,description) {
    const q=await evaluate(cdp,'baye.hd.qty()');
    const keyStart=await evaluate(cdp,'window.__speEngineKeys.length');
    const selector=await waitFor(cdp,description+' actual visible current quantity confirmation',`(() => {
        const q=baye.hd.qty();
        if(!q.active||q.ready!==1||q.session!==${q.session}||q.inputSeq!==${q.inputSeq}||q.value!==${q.value})return false;
        for(const selector of ['#hd-dialog [data-hd-dlg-ok]','#hd-city-menu [data-hd-qty-ok]']){
            if(selector.startsWith('#hd-dialog')?!BayeHdDialog.isQtyOpen():!BayeHdCityMenu.isQtyLive())continue;
            const node=document.querySelector(selector);if(!node||node.disabled)continue;
            const r=node.getBoundingClientRect(),s=getComputedStyle(node),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            if(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&top&&(top===node||node.contains(top)))return selector;
        }
        return false;
    })()`);
    await click(cdp,selector);
    await waitFor(cdp,description+' consumed by original quantity input',`(() => {
        const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();
        if(s.qtyAckFailed)throw Error('Native quantity ACK failed: '+s.qtyAckError);
        return !q.active&&!s.sending&&!s.queueLen;
    })()`);
    const after=await evaluate(cdp,'baye.hd.qty()'),keys=await evaluate(cdp,`window.__speEngineKeys.slice(${keyStart})`);
    assert.deepEqual(keys.map(k=>k.code),[0x27],'One actual confirmation emits one native ENTER');
    assert.equal(after.session,q.session);assert.equal(after.lastKey,0x27);assert.equal(after.value,q.value);
    assert.equal(after.inputSeq,q.inputSeq===0xffffffff?1:q.inputSeq+1);
    return {before:q,after,nativeKeys:keys};
}

// Runtime fragment for the real Water driver; the builder embeds these helpers.
// All gameplay changes below are original public UI/player inputs, never setters.
async function waitPersonPickerOrNativeMap(cdp,label,cityIndex) {
    return waitFor(cdp,'actual '+label+' picker or original map retirement',`(() => {
        const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),q=baye.hd.qty(),march=baye.hd.march(),r=baye.hd.report();
        if(q.active||s.sending||s.queueLen||r.active)return false;
        if(!m.active&&march.pick===1&&march.phase===0&&BayeHdOverworld.debugSnapshot().phase==='map')return {mode:'native-map',menu:m,qty:q,march,report:r,city:s};
        if(s.layer!=='deep'||s.deepLabel!==${JSON.stringify(label)}||!m.active||m.context!==1||m.kind!==3||!m.idsValid||!m.ids.length)return false;
        const d=baye.data,c=d.g_Cities[${cityIndex}],actual=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong)),owner=s.deepMenuOwner;
        if(JSON.stringify(actual)!==JSON.stringify(m.ids))throw Error('Actual picker IDs differ from current allied queue');
        if(!owner||owner.context!==m.context||owner.kind!==m.kind||owner.seq!==m.seq||owner.detailGeneration!==m.detailGeneration||!m.ids.every((id,index)=>s.deepItems.some(item=>item.i===index&&item.pind===id)))return false;
        return {mode:'picker',menu:m,qty:q,march,report:r,city:s,personIds:actual};
    })()`);
}

async function reopenMilitaryAfterPersonPicker(cdp,cityIndex,label) {
    const outcome=await waitPersonPickerOrNativeMap(cdp,label,cityIndex),before=await evaluate(cdp,recruitWorldExpression(cityIndex)),inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    if(outcome.mode==='picker') {
        const current=await currentPersonPicker(cdp,label,cityIndex);
        assert.deepEqual(current.menu,outcome.menu,'Cancellation belongs to the still-current native person picker');
        await click(cdp,'#hd-city-menu [data-hd-menu-back]');
    } else {
        // Conscription can consume all available money and return by itself.
        // Current product Back owns only local retirement after proven native map.
        if(await evaluate(cdp,'BayeHdCityMenu.isOpen()'))await click(cdp,'#hd-city-menu [data-hd-menu-back]');
        await waitFor(cdp,'ordinary player Back retires stale '+label+' shell','!BayeHdCityMenu.isOpen()');
    }
    await waitFor(cdp,`native map after stopping ${label}`,'!baye.hd.menuItems().active&&!baye.hd.qty().active&&!baye.hd.report().active&&baye.hd.march().pick===1&&baye.hd.march().phase===0&&BayeHdOverworld.debugSnapshot().phase===\'map\'&&!BayeHdCityMenu.debugSnapshot().sending&&BayeHdCityMenu.debugSnapshot().queueLen===0&&!BayeHdCityMenu.isOpen()');
    const retired=await evaluate(cdp,recruitWorldExpression(cityIndex)),exitInputs=await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`);
    assert.deepEqual(exitInputs.map(k=>k.code),outcome.mode==='picker'?[0x28]:[],`${label}: active picker gets one EXIT; already-native-map gets zero native keys`);
    const preserved=['money','reserve','persons','orders','date','personQueueOffset','personCount','personQueue'];
    for(const field of preserved)assert.deepEqual(retired[field],before[field],`${label} retirement preserves ${field}`);
    assert.ok(await action(cdp,`reopen-owned-city-after-${label}`,`BayeHdOverworld.walkToCity(${cityIndex})`));
    await waitFor(cdp,`real city root after ${label}`,`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return s.open&&s.layer==='root'&&s.cityIndex===${cityIndex}&&m.active&&m.context===1&&m.kind===1;})()`);
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,`real military submenu after ${label}`,"(() => {const m=baye.hd.menuItems();return BayeHdCityMenu.getLayer()==='sub'&&m.active&&m.context===1&&m.kind===2&&m.names[0]==='侦察';})()");
    const reopened=await evaluate(cdp,recruitWorldExpression(cityIndex));
    for(const field of preserved)assert.deepEqual(reopened[field],before[field],`${label} re-entry preserves ${field}`);
    return {label,mode:outcome.mode,outcome,before,retired,reopened,exitInputs,nativeInputs:await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`)};
}

async function recruitSmoke(cdp,cityIndex) {
    const inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    await click(cdp,'#hd-city-menu [data-hd-sub="1"]');
    const picker=await currentPersonPicker(cdp,'征兵',cityIndex),before=await evaluate(cdp,recruitWorldExpression(cityIndex));
    const allowed=before.persons.filter(p=>picker.menu.ids.includes(p.personIndex)),actor=allowed.find(p=>p.personIndex===casterPerson);
    assert.ok(actor,'The actual resident caster is chosen by its native person ID');
    const recruiter=allowed.slice().reverse().find(p=>p.personIndex!==actor.personIndex&&p.personIndex!==before.playerKing&&p.thew>=nativeItem(2,9)[24]);
    assert.ok(recruiter,'A different actual current resident can perform conscription');assert.ok(before.armsPerMoney>0&&Number.isInteger(before.armsPerMoney));
    report.recruitmentProgress={cityIndex,requestedArms:recruitArms,before,picker,actor,recruiter,enlistments:[],inputStart};
    const chosen=await chooseNativePerson(cdp,'征兵',cityIndex,recruiter.personIndex);report.recruitmentProgress.chosen=chosen;
    const quantity=await setRecruitQuantity(cdp,chosen.qty,'征兵');report.recruitmentProgress.quantity=quantity;
    const confirmation=await commitRecruitQuantity(cdp,'征兵');report.recruitmentProgress.confirmation=confirmation;
    let outcome=await waitPersonPickerOrNativeMap(cdp,'征兵',cityIndex);report.recruitmentProgress.outcome=outcome;
    let enlisted=(await observeCity(cdp,'actual-committed-conscription',cityIndex)).world;report.recruitmentProgress.enlisted=enlisted;
    const verifyEnlist=(previous,who,amount,after)=>{
        assert.equal(after.reserve,previous.reserve+amount,'Conscription adds only the actually confirmed soldiers to reserves');
        assert.equal(after.money,previous.money-Math.floor(amount/before.armsPerMoney),'Actual money follows native configured conscription cost');
        assert.equal(after.persons.find(p=>p.personIndex===actor.personIndex)?.arms,actor.arms,'Conscription does not equip the caster');
        assert.deepEqual(after.persons.map(p=>p.personIndex).sort((a,b)=>a-b),previous.persons.filter(p=>p.personIndex!==who.personIndex).map(p=>p.personIndex).sort((a,b)=>a-b),'Only the actual recruiter leaves the resident queue');
        assert.equal(after.orders.filter(o=>o.OrderId===24&&o.City===cityIndex&&o.Person===who.personIndex).length,previous.orders.filter(o=>o.OrderId===24&&o.City===cityIndex&&o.Person===who.personIndex).length+1);
        assert.deepEqual(after.date,before.date,'No campaign time advance manufactures residents or money');
    };
    verifyEnlist(before,recruiter,quantity.wanted,enlisted);
    const enlistments=report.recruitmentProgress.enlistments;enlistments.push({recruiter,before,chosen,quantity,confirmation,outcome,after:enlisted});
    await checkpoint(cdp,'06a-real-enlisted-city-reserves');
    for(let round=1;recruitArms>800&&enlisted.reserve-before.reserve<recruitArms&&round<10;round++) {
        if(outcome.mode==='native-map'||enlisted.money===0){report.recruitmentProgress.stoppedAdditionalOrders={reason:'Actual command retired or available money exhausted',outcome,money:enlisted.money,reserve:enlisted.reserve};break;}
        const previous=enlisted,current=await currentPersonPicker(cdp,'征兵',cityIndex),candidate=previous.persons.slice().reverse().find(p=>p.personIndex!==actor.personIndex&&p.personIndex!==before.playerKing&&p.thew>=nativeItem(2,9)[24]&&current.menu.ids.includes(p.personIndex));
        if(!candidate){report.recruitmentProgress.stoppedAdditionalOrders={reason:'No remaining distinct actual native resident recruiter',reserve:previous.reserve,money:previous.money,personIds:current.menu.ids};break;}
        const selected=await chooseNativePerson(cdp,'征兵',cityIndex,candidate.personIndex),amount=await setRecruitQuantity(cdp,selected.qty,'征兵第'+(round+1)+'次',recruitArms-(previous.reserve-before.reserve));
        const progress={recruiter:candidate,before:previous,chosen:selected,quantity:amount};report.recruitmentProgress.pendingOrder=progress;
        progress.confirmation=await commitRecruitQuantity(cdp,'征兵第'+(round+1)+'次');outcome=await waitPersonPickerOrNativeMap(cdp,'征兵',cityIndex);progress.outcome=outcome;
        enlisted=(await observeCity(cdp,'actual-committed-additional-conscription-'+round,cityIndex)).world;progress.after=enlisted;
        verifyEnlist(previous,candidate,amount.wanted,enlisted);enlistments.push(progress);delete report.recruitmentProgress.pendingOrder;
        await checkpoint(cdp,'06a-real-enlisted-additional-order-'+round);
    }
    const enlistRetirement=await reopenMilitaryAfterPersonPicker(cdp,cityIndex,'征兵');report.recruitmentProgress.enlistRetirement=enlistRetirement;
    await click(cdp,'#hd-city-menu [data-hd-sub="2"]');
    const distribute=await chooseNativePerson(cdp,'分配',cityIndex,actor.personIndex);report.recruitmentProgress.distribute=distribute;
    const distribution=await setRecruitQuantity(cdp,distribute.qty,'分配');report.recruitmentProgress.distribution=distribution;
    const distributionConfirmation=await commitRecruitQuantity(cdp,'分配');report.recruitmentProgress.distributionConfirmation=distributionConfirmation;
    const distributionOutcome=await waitPersonPickerOrNativeMap(cdp,'分配',cityIndex);report.recruitmentProgress.distributionOutcome=distributionOutcome;
    const equipped=(await observeCity(cdp,'actual-committed-distribution',cityIndex)).world;report.recruitmentProgress.equipped=equipped;
    assert.equal(equipped.persons.find(p=>p.personIndex===actor.personIndex)?.arms,distribution.wanted,'Only original DistributeMake sets actual caster troops');
    assert.equal(equipped.reserve,enlisted.reserve+actor.arms-distribution.wanted,'Actual reserves and old personal troops fund the distribution');
    assert.equal(equipped.money,enlisted.money,'Distribution charges no invented money');assert.deepEqual(equipped.persons.map(p=>p.personIndex),enlisted.persons.map(p=>p.personIndex));
    assert.deepEqual(equipped.orders,enlisted.orders);assert.deepEqual(equipped.date,before.date);
    report.recruitment={cityIndex,requestedArms:recruitArms,expectedCasterPerson:casterPerson,actualCasterArmType:actor.armType,recruiter,actor,casterNativeGenId:actor.nativeGenId,before,chosen,quantity,confirmation,enlistments,enlisted,enlistRetirement,distribute,distribution,distributionConfirmation,distributionOutcome,equipped,nativeInputs:await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`),scope:'Original bounded conscription and actual native distribution to the current saved caster; source preparation provides identity. Exact IDs, money, orders, queues and receipts are recorded; no world setters, automatic time advance or artificial troops.'};
    await checkpoint(cdp,'06b-real-distributed-caster-troops');
    report.recruitment.distributionRetirement=await reopenMilitaryAfterPersonPicker(cdp,cityIndex,'分配');
}

async function readMarchDestination(cdp,stage) {
    const facts=await evaluate(cdp,`(() => {
        const d=baye.data,readGeneration=()=>d.g_hdSpeGeneration==null?null:Number(d.g_hdSpeGeneration);
        const generationBefore=readGeneration(),before=baye.hd.march(),keysBefore=window.__speEngineKeys.length;
        const realm=baye.hd.realm(),origin=realm.cities.find(c=>c.i===${originCity}),target=realm.cities.find(c=>c.i===${destination});
        const links=baye.hd.cityLinks(${originCity}),mask=d.g_hdCityLinks;
        const nativeLinkMask=Array.from({length:8},(_,i)=>mask&&mask[i]!=null?Number(mask[i]):null);
        const after=baye.hd.march(),generationAfter=readGeneration(),keysAfter=window.__speEngineKeys.length;
        return {generationBefore,generationAfter,before,after,keysBefore,keysAfter,total:realm.total,
            playerKing:realm.playerKing,playerBelong:realm.playerBelong,origin,target,links,nativeLinkMask};
    })()`);
    assert.ok(Number.isInteger(facts.generationBefore)&&facts.generationBefore>=0,'Actual native generation is present');
    assert.equal(facts.generationAfter,facts.generationBefore,'Realm and native route reads cannot mix generations');
    for(const key of ['phase','session','origin','inputSeq','mapInputSeq','pick','battlePick'])
        assert.equal(facts.after[key],facts.before[key],'Route observation preserves current native '+key);
    assert.equal(facts.keysAfter,facts.keysBefore,'Route observation injects no native keys');
    assert.ok(Number.isInteger(facts.total)&&facts.total>0&&facts.total<=64&&destination<facts.total,'Current actual Realm includes the requested destination');
    assert.ok(facts.origin&&facts.origin.i===originCity&&facts.origin.owned&&facts.origin.belong===facts.playerBelong,'宛城 is currently owned by the actual player');
    assert.ok(facts.target&&facts.target.i===destination&&facts.target.owned===false&&Number.isInteger(facts.target.belong)&&
        facts.target.belong!==facts.origin.belong,'Requested destination currently has different native ownership');
    assert.equal(facts.nativeLinkMask.length,8);
    assert.ok(facts.nativeLinkMask.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'All eight actual native link bytes are available');
    const resource=nativeItem(59),offset=originCity*16;
    assert.ok(offset+8<=resource.length,'CITY_LINKR actual item contains the 长沙 native row');
    const rawResourceMask=Array.from(resource.subarray(offset,offset+8));
    const permittedMask=rawResourceMask.map(id=>id===0||id===255||id-1>=facts.total?0:id);
    assert.deepEqual(facts.nativeLinkMask,permittedMask,'Actual link observation agrees with the real CITY_LINKR first-eight-byte native mask');
    assert.ok(facts.nativeLinkMask.includes(destination+1)&&facts.links.some(c=>c.id===destination+1&&c.index===destination),
        'Current native adjacency permits this exact destination; an empty UI fallback cannot authorize it');
    if(stage!=='initial-map')assert.ok(facts.after.phase===4&&facts.after.pick===1&&facts.after.battlePick===1&&facts.after.origin===originCity,
        'Only the actual current native march target owner authorizes selecting or confirming');
    report.marchTargetAuthorizations??=[];
    report.marchTargetAuthorizations.push({stage,...facts,resourceId:59,resourceIndex:0,cityStride:16,nativeLinkCount:8,rawResourceMask,
        scope:'Actual current Realm ownership and native eight-link observation, independently checked against the served real LIB payload. Native BattleMake/AttackCityRoad and AddFightOrder still decide dispatch.'});
    return facts;
}



async function marchWood(cdp){
 await waitFor(cdp,'current native map with actual owned source city',`(() => {const s=BayeHdOverworld.debugSnapshot();return s.phase==='map'&&s.owned.some(c=>c.i===20);})()`);await readMarchDestination(cdp,'initial-map');const world=await observeCampaign(cdp,'loaded real owned current caster');assert.ok(acquired(world)&&acquired(world).personIndex===casterPerson);
 const pos=await evaluate(cdp,'BayeHdOverworld.cityScreenPos(20)'),walk=await action(cdp,'open current owned Wan20','BayeHdOverworld.walkToCity(20)');assert.deepEqual(walk,{name:pos.name,to:{x:pos.engX,y:pos.engY}});await waitFor(cdp,'actual source native city root','BayeHdCityMenu.isOpen()&&BayeHdCityMenu.getLayer()==="root"&&baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1');await click(cdp,'#hd-city-menu [data-hd-root="2"]');await waitFor(cdp,'actual military submenu','BayeHdCityMenu.getLayer()==="sub"&&baye.hd.menuItems().active&&baye.hd.menuItems().names[0]==="侦察"');await recruitSmoke(cdp,originCity);
 await click(cdp,'#hd-city-menu [data-hd-sub="4"]');await waitFor(cdp,'actual march person phase','baye.hd.march().phase===1&&baye.hd.march().origin===20');report.marchPersonIds=[];
 for(let selection=0;selection<6;selection++){const prior=await evaluate(cdp,'baye.hd.march()');if(prior.phase!==1)break;const picker=await currentPersonPicker(cdp,'出征',20),fresh=await evaluate(cdp,'baye.hd.march()');for(const f of ['phase','session','origin','selected'])assert.equal(fresh[f],prior[f]);assert.equal(fresh.selected,selection);const index=selection===0?picker.menu.ids.indexOf(casterPerson):0;assert.ok(index>=0);const id=picker.menu.ids[index];assert.equal(picker.city.deepItems.find(p=>p.i===index)?.pind,id);await click(cdp,`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${id}"]`);await waitFor(cdp,'exact selected native dispatch receipt',`baye.hd.march().selected===${selection+1}||baye.hd.march().phase!==1`);report.marchPersonIds.push(id);const now=await evaluate(cdp,'baye.hd.march()');if(now.phase===1&&await evaluate(cdp,'baye.hd.menuItems().count===0'))break;}
 assert.equal(report.marchPersonIds[0],casterPerson);await checkpoint(cdp,'02-actual-native-march-persons');if(await evaluate(cdp,'baye.hd.march().phase===1'))await click(cdp,'#hd-city-menu [data-hd-finish-persons]');await waitFor(cdp,'actual march food quantity','baye.hd.march().phase===2&&baye.hd.qty().active&&baye.hd.qty().min===1');const foodSelector=await evaluate(cdp,"BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'");await click(cdp,foodSelector);await waitFor(cdp,'actual target instruction','baye.hd.march().phase===3');await action(cdp,'ack genuine target instruction','BayeHdCityMenu.continueMarch()');await waitFor(cdp,'actual march target owner','baye.hd.march().phase===4&&baye.hd.march().battlePick===1');await readMarchDestination(cdp,'before-selection');assert.equal((await action(cdp,'select actual linked city26','BayeHdCityMenu.selectMarchTarget(26)')).selected,26);await readMarchDestination(cdp,'before-confirmation');await action(cdp,'confirm native current target26','BayeHdCityMenu.confirmMarchTarget(26)');await waitFor(cdp,'real departure report','baye.hd.march().phase===6');await action(cdp,'ack real departure','BayeHdCityMenu.continueMarch()');await waitFor(cdp,'actual AddFightOrder native receipt','baye.hd.march().phase===7&&baye.hd.march().ok===1');report.marchOrderReceipt=await evaluate(cdp,'baye.hd.march()');assert.equal(report.marchOrderReceipt.city,20);assert.equal(report.marchOrderReceipt.obj,26);await checkpoint(cdp,'03-original-dispatch-order');
 await waitFor(cdp,'original map/submenu after actual departure',"(() => {const m=baye.hd.march(),menu=baye.hd.menuItems();return menu.active&&menu.context===1||!menu.active&&m.pick===1&&m.battlePick===0;})()");await action(cdp,'explicit one strategy execution after departure','BayeHdCityMenu.goStrategyEnd()');await waitFor(cdp,'actual battle player selection','baye.hd.fight().active&&!baye.hd.fight().over&&baye.hd.fight().inputKind===1',120000);report.battleDestinationReceipt=await evaluate(cdp,'baye.hd.fight()');assert.equal(report.battleDestinationReceipt.cityIndex,26);await checkpoint(cdp,'04-real-battle-caster');await battleWood(cdp);
}
const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<0xfffe) units.push({i,id,personIndex:id-1,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),state:Number(d.g_GenPos[i].state),belong:Number(d.g_Persons[id-1].Belong),arms:Number(d.g_Persons[id-1].Arms),iq:Number(d.g_Persons[id-1].IQ),armType:baye.hd.personArmType(id-1),terrain:baye.getTerrainByGeneralIndex(i)});
    }
    return {mode:Number(d.g_FgtParam.Mode),mainGen:Number(d.g_MainGenIdx),fight:baye.hd.fight(),generation:Number(d.g_hdSpeGeneration),nativeBoutMax:Number(d.g_FgtBoutMax),nativeMapId:Number(d.g_FgtParam.MapId),mapWidth:Number(d.g_MapWid),mapHeight:Number(d.g_MapHgt),units,weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
})()`;


async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&f;})()`,timeout);
}
const moveTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),out=[];
    const sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY);
    for(let y=0;y<Number(d.g_MapHgt);y++)for(let x=0;x<Number(d.g_MapWid);x++) {
        const px=(x-sx+ux)&255,py=(y-sy+uy)&255;
        if(px<15&&py<15){const v=Number(d.g_FightPath[py*15+px]);if(Number.isInteger(v)&&v>=0&&v<=128)out.push({x,y,raw:v,index:py*15+px,px,py});}
    }
    return out;
})()`;
async function chooseGeneral(cdp,unit){
 const current=await evaluate(cdp,battleStateExpression),fresh=current.units.find(u=>u.id===unit.id&&u.i===unit.i);
 assert.ok(fresh&&fresh.side==='player'&&fresh.state!==8&&fresh.arms>0&&fresh.active===0);
 assert.equal(current.fight.inputKind,1);
 const result=await action(cdp,'select-native-id-'+fresh.id,`BayeHdBattle.clickTile(${fresh.x},${fresh.y})`);assert.equal(result.ok,true);
 return waitFor(cdp,'real native selected actor ID and owner',`(() => {const f=baye.hd.fight(),d=baye.data,b=BayeHdBattle.debugSnapshot();return !b.transaction&&[2,3].includes(f.inputKind)&&f.actorIndex===${fresh.i}&&Number(d.g_FgtParam.GenArray[f.actorIndex])===${fresh.id}&&f;})()`);
}
async function menuChoice(cdp,name,kind) {
    const result=await action(cdp,'choose-'+name,`BayeHdBattle.pickMenuName(${JSON.stringify(name)})`);
    assert.equal(result.ok,true,'actual menu choice '+name);
    if(kind) await waitBattle(cdp,kind,'menu choice '+name);
}

const rangedUnitsExpression=`(() => {
    const d=baye.data,r=d.g_FgtAtkRng,size=Number(r[0]),sx=Number(r[1]),sy=Number(r[2]);
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);if(!id||id>=0xfffe)continue;
        const p=d.g_GenPos[i],x=Number(p.x),y=Number(p.y),dx=(x-sx)&255,dy=(y-sy)&255;
        if(p.state===8||dx<0||dy<0||dx>=size||dy>=size||Number(r[3+dx+dy*size])!==1)continue;
        units.push({i,id,personIndex:id-1,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x,y,state:Number(p.state),belong:Number(d.g_Persons[id-1].Belong),arms:Number(d.g_Persons[id-1].Arms),terrain:baye.getTerrainByGeneralIndex(i),armType:baye.hd.personArmType(id-1)});
    }
    return units;
})()`;

const skillOptionsExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),skill=baye.hd.skills(),actor=d.g_GenPos[f.actorIndex];
    const terrain=baye.getTerrainByGeneralIndex(f.actorIndex),weather=Number(d.g_FgtWeather)-1;
    const array=(a,n)=>Array.from({length:n},(_,i)=>Number(a[i]));
    return skill.ids.map((id,index)=>{const x=d.g_Skills[id-1];return {id,index,name:skill.names[index],speId:Number(d.dJNSpeId[id-1]),aim:Number(x.aim),state:Number(x.state),power:Number(x.power),destroy:Number(x.destroy),useMp:Number(x.useMp),eland:array(x.eland,8),earm:array(x.earm,6),oland:array(x.oland,8),weather:array(x.weather,5),available:Number(x.useMp)>0&&Number(x.useMp)<=Number(actor.mp)&&Number(x.weather[weather])>0&&Number(x.oland[terrain])>0};});
})()`;
async function endArmyTurn(cdp) {
    const before=await evaluate(cdp,battleStateExpression);
    await action(cdp,'explicit-end-turn-system','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'end-turn actual system menu');
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name);
    await waitActionResolved(cdp,'enemy turn followed by next player input',before.fight.bout);
    const after=await evaluate(cdp,battleStateExpression);
    if(after.fight.over) {
        report.turns??=[];report.turns.push({before,after,ended:true});
        await checkpoint(cdp,'28-real-battle-ended-'+report.turns.length);
        return;
    }
    assert.equal(after.fight.bout,before.fight.bout+1,'one end-turn advances exactly one engine bout');
    await delay(1200);
    const paused=await evaluate(cdp,battleStateExpression);
    assert.deepEqual(paused,after,'returning to player input does not trigger a second enemy turn');
    report.turns??=[];report.turns.push({before,after,paused});
    await checkpoint(cdp,'28-explicit-end-turn-'+report.turns.length);
}
async function waitActionResolved(cdp,label,afterBout=null){
 const deadline=Date.now()+180000,acknowledged=new Set();
 while(Date.now()<deadline){const expression='({f:baye.hd.fight(),s:baye.hd.spe(),r:baye.hd.skillResult(),a:baye.hd.attack(),top:baye.hd.resultOwner(),native:baye.hd.report(),b:BayeHdBattle.debugSnapshot(),d:BayeHdDialog.debugSnapshot()})',s=await evaluate(cdp,expression);
  if(!s.s.active&&!s.r.active&&!s.a.active&&!s.top.active&&!s.native.active&&(s.f.over||(!s.b.transaction&&s.f.inputKind===1&&(afterBout==null||s.f.bout>afterBout))))return s.f;
  const owner=s.d.reportOwner;
  if(!s.s.active&&!s.r.active&&!s.a.active&&!s.top.active&&s.native.active===1&&s.native.inputSeq>0&&s.d.open&&s.d.kind==='report'&&!s.d.pass&&owner&&owner.seq===s.native.seq&&owner.inputSeq===s.native.inputSeq){const token=JSON.stringify(owner);
   if(!acknowledged.has(token)){const world=await evaluate(cdp,battleStateExpression),fresh=await evaluate(cdp,expression);assert.deepEqual(fresh.native,s.native,'Report owner must still be current before player acknowledgement');assert.deepEqual(fresh.d.reportOwner,owner);assert.ok(!fresh.s.active&&!fresh.r.active&&!fresh.a.active&&!fresh.top.active&&fresh.d.open&&fresh.d.kind==='report'&&!fresh.d.pass);const inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    acknowledged.add(token);const receipt={owner,native:s.native,body:s.d.body,spe:s.s,result:s.r,top:s.top,fight:s.f,world};report.actualReports??=[];report.actualReports.push(receipt);await checkpoint(cdp,'actual-report-'+report.actualReports.length);const final=await evaluate(cdp,expression);assert.deepEqual(final.native,s.native);assert.deepEqual(final.d.reportOwner,owner);assert.ok(!final.s.active&&!final.r.active&&!final.a.active&&!final.top.active&&final.d.open&&!final.d.pass);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');receipt.keys=await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`);assert.deepEqual(receipt.keys.map(k=>k.code),[39],'Exactly one acknowledgement belongs to this actual native report');}
  }await delay(100);
 }throw Error('Timeout: '+label);
}
async function restActor(cdp,actor,selection){
 if(selection.inputKind===2){assert.equal((await action(cdp,'stay-at-real-tile-'+actor.id,`BayeHdBattle.clickTile(${actor.x},${actor.y})`)).ok,true);await waitBattle(cdp,3,'actual action menu after legal stay');}
 await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
}

const actualTerrainExpression=`(() => {const d=baye.data,w=Number(d.g_MapWid),h=Number(d.g_MapHgt),a=d.g_FightMapData;return {width:w,height:h,tiles:Array.from({length:w*h},(_,i)=>Number(a[i]))};})()`;
function terrainClass(raw){assert.ok(Number.isInteger(raw)&&raw>0&&raw<=255);return raw>15?raw===41?6:7:raw>5?2:raw===5?3:raw===4?4:raw===3?5:raw===2?0:1;}
async function attemptWood(cdp,actor,skillId){
 const current=await evaluate(cdp,battleStateExpression),fresh=current.units.find(u=>u.id===casterNativeId&&u.i===actor.i);assert.ok(fresh&&fresh.side==='player'&&fresh.arms>0&&![8,1,6,2].includes(fresh.state));assert.equal(current.fight.actorIndex,fresh.i);assert.equal(current.fight.inputKind,3);await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[1]'),4);
 const owner=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),options=await evaluate(cdp,skillOptionsExpression),skill=options.find(s=>s.id===skillId),expected=report.actualWoodSkills.find(s=>s.id===skillId);assert.ok(skill,'Actual derived infantry/Lv11 native menu includes requested skill');assert.equal(skill.name,expected.name);assert.equal(skill.speId,37);assert.equal(skill.useMp,expected.mp);assert.equal(skill.power,expected.power);assert.equal(skill.destroy,0);assert.equal(skill.state,0);assert.equal(skill.aim,0);assert.deepEqual(skill.eland,expected.targetTerrain);assert.deepEqual(skill.earm,expected.targetArm);assert.deepEqual(skill.oland,expected.actorTerrain);assert.deepEqual(skill.weather,expected.weather);
 report.woodOptions??=[];report.woodOptions.push({actor:fresh,skill,options,owner});if(!skill.available){await action(cdp,'cancel genuinely unavailable skill'+skillId,'BayeHdBattle.cancel()');await waitBattle(cdp,3,'actual unavailable skill return');return false;}assert.deepEqual(await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),owner);assert.equal(owner.skills.ids[skill.index],skillId);assert.equal((await action(cdp,'select actual skill ID'+skillId,`BayeHdBattle.pickMenu(${skill.index})`)).ok,true);await waitBattle(cdp,5,'actual skill AIM owner');
 const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.state!==8&&u.state!==6&&u.arms>0&&skill.eland[u.terrain]>0&&Number.isInteger(u.armType)&&skill.earm[u.armType]>0);if(!targets.length){report.missingConditions??=[];report.missingConditions.push({reason:'No current enemy satisfies fresh native AIM and actual SKILLEF target fields',skillId,owner,current:await evaluate(cdp,battleStateExpression)});await action(cdp,'cancel no legal target for skill'+skillId,'BayeHdBattle.cancel()');await waitBattle(cdp,3,'cancel current empty legal AIM');return false;}
 const before=await evaluate(cdp,battleStateExpression);targets.sort((a,b)=>(before.units.find(u=>u.id===a.id)?.iq??255)-(before.units.find(u=>u.id===b.id)?.iq??255)||b.arms-a.arms||a.i-b.i);const target=targets[0];
 const proof=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,n=Number(r[0]),sx=Number(r[1]),sy=Number(r[2]),u=d.g_GenPos[${target.i}],a=d.g_GenPos[f.actorIndex];return {generation:Number(d.g_hdSpeGeneration),fight:f,casterId:Number(d.g_FgtParam.GenArray[f.actorIndex]),casterMp:Number(a.mp),casterState:Number(a.state),casterActive:Number(a.active),casterTerrain:baye.getTerrainByGeneralIndex(f.actorIndex),weather:Number(d.g_FgtWeather),targetId:Number(d.g_FgtParam.GenArray[${target.i}]),x:Number(u.x),y:Number(u.y),state:Number(u.state),terrain:baye.getTerrainByGeneralIndex(${target.i}),arm:baye.hd.personArmType(Number(d.g_FgtParam.GenArray[${target.i}])-1),size:n,originX:sx,originY:sy,values:Array.from({length:n*n},(_,i)=>Number(r[3+i]))};})()`);
 assert.equal(proof.generation,owner.generation);assert.equal(proof.fight.active,1);assert.equal(proof.fight.over,0);assert.equal(proof.fight.wait,1);assert.equal(proof.fight.inputKind,5);assert.equal(proof.fight.aimType,1);assert.equal(proof.fight.actorIndex,fresh.i);assert.equal(proof.casterId,casterNativeId);assert.equal(proof.targetId,target.id);assert.equal(proof.casterActive,0);assert.equal(proof.casterMp,fresh.mp);assert.ok(![8,1,6,2].includes(proof.casterState));assert.ok(proof.weather>=1&&proof.weather<=5&&skill.weather[proof.weather-1]>0);assert.ok(skill.oland[proof.casterTerrain]>0&&skill.eland[proof.terrain]>0&&skill.earm[proof.arm]>0);assert.deepEqual([proof.x,proof.y],[target.x,target.y]);assert.ok(proof.state!==8&&proof.state!==6);assert.ok(Number.isInteger(proof.size)&&proof.size>=1&&proof.size<=15&&proof.values.length===proof.size**2&&proof.values.every(v=>Number.isInteger(v)&&v>=0&&v<=255));const px=(target.x-proof.originX)&255,py=(target.y-proof.originY)&255;assert.ok(px<proof.size&&py<proof.size);assert.equal(proof.values[py*proof.size+px],1,'Fresh complete native AIM, never distance inference');
 const reportStart=report.actualReports?.length||0,captureStart=await evaluate(cdp,'window.__woodCaptures.length'),sampleStart=await evaluate(cdp,'window.__speSamples.length'),inputStart=await evaluate(cdp,'window.__speEngineKeys.length');const confirmation=await action(cdp,'confirm real skill'+skillId+' target'+target.id,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(confirmation.ok,true);assert.equal(confirmation.kind,proof.fight.inputKind);assert.equal(confirmation.inputSeq,proof.fight.inputSeq);await waitFor(cdp,'actual target Enter consumed and original AIM owner retired',`(() => {const f=baye.hd.fight();return f.inputSeq!==${proof.fight.inputSeq}||f.inputKind!==5||f.actorIndex!==${fresh.i};})()`,30000);const confirmationKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`);assert.equal(confirmationKeys.filter(k=>k.code===39).length,1,'The exact original AIM transaction has one target Enter before any report ACK');assert.ok(confirmationKeys.every(k=>[34,35,36,37,39].includes(k.code)));await waitActionResolved(cdp,'original wood/stone movie and numeric owner retired');const after=await evaluate(cdp,battleStateExpression),caster=after.units.find(u=>u.id===casterNativeId);assert.ok(caster&&caster.state!==8&&caster.arms>0);assert.equal(fresh.mp-caster.mp,skill.useMp,'Actual exact native MP cost even on natural failure');
 const samples=await evaluate(cdp,`window.__speSamples.slice(${sampleStart})`),movie=samples.filter(r=>r.stage==='lcd-flush'&&r.spe?.active&&r.spe.id===37&&r.spe.kind===2&&r.spe.skillId===skillId&&r.spe.startFrm===0&&r.spe.endFrm===(skillId===6?7:0)&&r.spe.actorIndex===fresh.i&&r.spe.targetIndex===target.i&&r.spe.display.frameValid),succeeded=movie.length>0;const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`);assert.deepEqual(keys.filter(k=>k.speActive&&k.kind===2||k.resultActive),[],'No skip/return key while actual movie/numbers/hold owns input');
 report.woodAttempts??=[];report.woodAttempts.push({actor:fresh,skill,target,proof,before,after,confirmation,captureStart,movieEvents:[...new Set(movie.map(r=>r.spe.eventId))],succeeded,reports:(report.actualReports||[]).slice(reportStart),keys:confirmationKeys,allActionKeys:keys});await checkpoint(cdp,'skill'+skillId+(succeeded?'-true-player-movie':'-natural-failure')+'-'+report.woodAttempts.length);return succeeded;
}
async function battleWood(cdp){
 const initial=await evaluate(cdp,battleStateExpression),caster=initial.units.find(u=>u.id===casterNativeId&&u.side==='player');report.combatStart=initial;assert.equal(initial.fight.cityIndex,26);assert.deepEqual([initial.nativeMapId,initial.mapWidth,initial.mapHeight],[113,32,32]);assert.ok(caster&&caster.state!==8&&caster.arms>0&&caster.armType===1);assert.equal(caster.arms,report.recruitment.distribution.wanted);const map=await evaluate(cdp,actualTerrainExpression),raw=nativeItem(113);assert.deepEqual([map.width,map.height],[32,32]);assert.deepEqual(Buffer.from(map.tiles),raw.subarray(16,16+map.width*map.height),'Actual full native fight map agrees with authenticated current standard map113');report.actualTerrain=map;
 const complete=new Set();
 for(let actionNumber=0;actionNumber<maxTurns*20&&complete.size<2;actionNumber++){const current=await evaluate(cdp,battleStateExpression),actor=current.units.find(u=>u.id===casterNativeId);assert.ok(actor&&actor.arms>0&&actor.state!==8,'Caster death is preserved, not repaired');assert.equal(current.fight.over,0,'Natural battle end before both skills is honest failure');const available=current.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![8,1,6].includes(u.state));const selected=available.find(u=>u.id===casterNativeId)||available[0];if(!selected){if((report.turns?.length||0)>=maxTurns)break;await endArmyTurn(cdp);continue;}const selection=await chooseGeneral(cdp,selected);if(selected.id!==casterNativeId||selected.state===2){await restActor(cdp,selected,selection);continue;}
  const skillId=complete.has(6)?7:6,cost=skillId===6?20:25;if(selected.mp<cost){report.mpWaits??=[];report.mpWaits.push({selected,skillId,cost,selection,scope:'Actual original REST only restores native1; no direct MP/world writes'});await restActor(cdp,selected,selection);continue;}
  if(selection.inputKind===2){const candidates=await evaluate(cdp,moveTilesExpression),enemies=current.units.filter(u=>u.side==='enemy'&&u.arms>0&&![8,6].includes(u.state)&&[0,1,3,...(skillId===7?[7]:[])].includes(u.terrain));if(!enemies.length){await restActor(cdp,selected,selection);continue;}const distance=p=>Math.min(...enemies.map(u=>Math.max(Math.abs(p.x-u.x),Math.abs(p.y-u.y))));const valid=candidates.filter(p=>!current.units.some(u=>u.i!==selected.i&&u.state!==8&&u.x===p.x&&u.y===p.y));assert.ok(valid.length);valid.sort((a,b)=>{const ah=[2,5].includes(terrainClass(map.tiles[a.y*map.width+a.x])),bh=[2,5].includes(terrainClass(map.tiles[b.y*map.width+b.x]));return (distance(a)<=4&&ah?0:1)-(distance(b)<=4&&bh?0:1)||distance(a)-distance(b)||Number(bh)-Number(ah)||a.raw-b.raw||a.y-b.y||a.x-b.x;});const target=valid[0];report.movePlanning??=[];report.movePlanning.push({before:current,actor:selected,skillId,target,candidates,terrain:terrainClass(map.tiles[target.y*map.width+target.x]),source:'Actual complete MOVE ranks static authenticated terrain; subsequent fresh native SKILL/AIM still authorizes each confirmation'});assert.equal((await action(cdp,'legal current caster MOVE',`BayeHdBattle.clickTile(${target.x},${target.y})`)).ok,true);await waitBattle(cdp,3,'current action menu after actual move');}
  if(await attemptWood(cdp,selected,skillId))complete.add(skillId);else if(await evaluate(cdp,'baye.hd.fight().inputKind===3'))await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
 }
 assert.deepEqual([...complete].sort(),[6,7],'Both distinct genuine player skills/resource37 intervals must actually occur');report.combatEnd=await evaluate(cdp,battleStateExpression);report.woodRetired=await evaluate(cdp,'({spe:baye.hd.spe(),result:baye.hd.skillResult(),top:baye.hd.resultOwner(),ui:BayeHdSpe.debugSnapshot()})');assert.equal(report.woodRetired.spe.active,0);assert.equal(report.woodRetired.result.active,false);assert.equal(report.woodRetired.top.active,false);await checkpoint(cdp,'05-both-original-skill-owners-retired');
}
async function saveWoodEvidence(cdp){const raw=await evaluate(cdp,'({captures:window.__woodCaptures,errors:window.__woodObserverErrors,keys:window.__speEngineKeys,samples:window.__speSamples})');for(let i=0;i<raw.captures.length;i++){const c=raw.captures[i],stem='wood-'+String(i).padStart(4,'0')+'-'+(c.result?.phase||'movie');for(const [type,url]of [['lcd',c.nativeUrl],['hd',c.hdUrl]])if(url){const bytes=Buffer.from(url.split(',')[1],'base64'),file=stem+'-'+type+'.png';fs.writeFileSync(path.join(artifactDir,file),bytes);c[type==='lcd'?'nativeFile':'hdFile']={file,bytes:bytes.length,sha256:sha(bytes)};}delete c.nativeUrl;delete c.hdUrl;}report.woodCaptures=raw.captures;report.observerErrors=raw.errors;report.engineInputs=raw.keys;report.speObservations=raw.samples;for(const [name,data]of [['native-skill-captures',raw.captures],['observer-errors',raw.errors],['engine-inputs',raw.keys],['spe-observations',raw.samples]])fs.writeFileSync(path.join(artifactDir,name+'.json'),JSON.stringify(data,null,2)+'\n');assert.deepEqual(raw.errors,[]);}

async function observeCity(cdp,stage,cityIndex){
 const expression="({generation:Number(baye.data.g_hdSpeGeneration),march:baye.hd.march(),keys:window.__speEngineKeys.length})",before=await evaluate(cdp,expression),world=await evaluate(cdp,recruitWorldExpression(cityIndex)),after=await evaluate(cdp,expression);
 assert.deepEqual(after,before,'Readonly current city money/reserve/queue reads preserve native generation, owner and inputs');assert.ok(Number.isInteger(world.money)&&world.money>=0&&Number.isInteger(world.reserve)&&world.reserve>=0);assert.equal(world.personQueue.length,world.personCount);assert.deepEqual(world.persons.map(p=>p.personIndex),world.personQueue);
 report.cityObservations??=[];const observation={stage,before,after,world};report.cityObservations.push(observation);return observation;
}
const worldExpression=campaignWorldExpression;
async function readCityPersons(cdp,cityIndex) {
    return evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${cityIndex}];
        return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
            .map(pind=>({pind,name:baye.getPersonName(pind),arms:Number(d.g_Persons[pind].Arms),belong:Number(d.g_Persons[pind].Belong)}));})()`);
}

function assertDispatchedArmy(initial,march) {
    const actual=initial.units.filter(p=>p.side==='player').map(p=>({pind:p.id-1,name:p.name,arms:p.arms}));
    const expected=march.selected.map(p=>({pind:p.pind,name:p.name,arms:p.arms}));
    assert.deepEqual(actual,expected,'native GenArray identities and troops exactly match every selected and acknowledged general: '+march.label);
    march.battleReadyArmy=actual;
}

const cityTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),tiles=[];
    for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++)if(Number(d.g_FightMapData[y*f.mapW+x])===3)tiles.push({x,y});
    return tiles;
})()`;

function attackOffsets(mask) {
    assert.ok(Number.isInteger(mask.size)&&mask.size>0&&mask.size<=15,'actual C attack mask has a supported size');
    assert.equal(mask.cells.length,mask.size*mask.size,'actual C attack mask is complete');
    const signedByte=value=>((value+128)%256+256)%256-128;
    const sx=signedByte(mask.origin.x-mask.anchor.x),sy=signedByte(mask.origin.y-mask.anchor.y),offsets=[];
    for(let y=0;y<mask.size;y++)for(let x=0;x<mask.size;x++)if(mask.cells[y*mask.size+x]===1)offsets.push({x:sx+x,y:sy+y});
    assert.ok(offsets.length,'the actual selected general has a nonempty attack mask');
    return offsets;
}

function attackCovers(offsets,position,target) {
    return offsets.some(p=>p.x===target.x-position.x&&p.y===target.y-position.y);
}

function chooseCampaignTile(candidates,units,actor,mainGen,cities,offsets,defending=false) {
    const enemies=units.filter(u=>u.side==='enemy'&&u.arms>0&&u.state!==8);
    const onCity=p=>cities.some(c=>c.x===p.x&&c.y===p.y);
    const guards=defending?enemies.filter(u=>u.i===10):enemies.filter(onCity),distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    const garrison=units.filter(u=>u.side==='player'&&u.arms>0&&u.state!==8&&onCity(u));
    const holdCity=defending&&onCity(actor)&&!garrison.some(u=>u.i!==actor.i);
    const available=candidates.filter(p=>!units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8)&&
        (!holdCity||p.x===actor.x&&p.y===actor.y));
    const choices=available.map(p=> {
        const targets=enemies.filter(u=>attackCovers(offsets,p,u));
        const guardTargets=targets.filter(u=>defending?u.i===10:onCity(u));
        return {x:p.x,y:p.y,capture:onCity(p)&&(!defending||!garrison.length),holdCity,
            guardTargets:guardTargets.map(u=>u.name),targets:targets.map(u=>u.name),
            // Distance pressure is a conservative positioning tie-breaker,
            // never a replacement for the actual mask's legal target check.
            commanderPressure:actor.i===mainGen?enemies.reduce((sum,u)=>sum+1/(1+distance(p,u)**2),0):0,
            objectiveDistance:Math.min(...(guards.length?guards:cities).map(c=>distance(p,c))),moveDistance:distance(p,actor)};
    });
    choices.sort((a,b)=> {
        const opportunity=Number(b.capture)-Number(a.capture)||
            Number(b.guardTargets.length>0)-Number(a.guardTargets.length>0)||
            Number(b.targets.length>0)-Number(a.targets.length>0);
        if(opportunity)return opportunity;
        if(a.targets.length&&b.targets.length)return a.commanderPressure-b.commanderPressure||
            b.targets.length-a.targets.length||a.objectiveDistance-b.objectiveDistance||a.moveDistance-b.moveDistance;
        return a.objectiveDistance-b.objectiveDistance||a.commanderPressure-b.commanderPressure||a.moveDistance-b.moveDistance;
    });
    return choices[0];
}

async function readAttackMask(cdp,actor) {
    const mask=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,size=Number(r[0]),u=d.g_GenPos[${actor.i}],p=d.g_Persons[${actor.id-1}];
        return {actorIndex:f.actorIndex,inputKind:f.inputKind,inputSeq:f.inputSeq,size,origin:{x:Number(r[1]),y:Number(r[2])},
            anchor:{x:Number(u.x),y:Number(u.y)},unitId:Number(d.g_FgtParam.GenArray[${actor.i}]),armType:baye.hd.personArmType(${actor.id-1}),
            equip:[Number(p.Equip[0]),Number(p.Equip[1])],cells:Array.from({length:size*size},(_,i)=>Number(r[3+i]))};})()`);
    assert.equal(mask.inputKind,5,'attack mask is read only while the real attack AIM is waiting');
    assert.equal(mask.actorIndex,actor.i);assert.equal(mask.unitId,actor.id);
    mask.offsets=attackOffsets(mask);
    return mask;
}

async function cacheAttackMask(cdp,actor,selected,round) {
    const before=await evaluate(cdp,battleStateExpression),original=before.units.find(u=>u.i===actor.i);
    if(selected.inputKind===2) {
        const legal=await evaluate(cdp,moveTilesExpression);
        assert.ok(legal.some(p=>p.x===original.x&&p.y===original.y),'the general current tile is a real legal MOVE choice');
        const response=await action(cdp,'mask-probe-current-tile-'+actor.name,`BayeHdBattle.clickTile(${original.x},${original.y})`);
        assert.equal(response.ok,true);await waitBattle(cdp,3,'mask probe action '+actor.name);
    }
    const names=await evaluate(cdp,'baye.hd.menuItems().names');
    await menuChoice(cdp,names[0],5);
    const mask=await readAttackMask(cdp,actor);
    const probe={round,actor:actor.name,mask,before:original,after:null};
    report.attackMasks??=[];report.attackMasks.push(probe);
    await checkpoint(cdp,'battle-'+round+'-mask-'+actor.id,{attackMask:mask});
    await action(cdp,'mask-probe-cancel-aim-'+actor.name,'BayeHdBattle.cancel()');await waitBattle(cdp,3,'mask probe returns ACTION');
    await action(cdp,'mask-probe-cancel-action-'+actor.name,'BayeHdBattle.cancel()');await waitBattle(cdp,1,'mask probe returns PICK');
    const restored=await evaluate(cdp,battleStateExpression),after=restored.units.find(u=>u.i===actor.i);
    assert.equal(restored.fight.bout,before.fight.bout,'one mask probe does not advance the native battle day');
    assert.equal(restored.fight.over,0);assert.equal(after.active,0);
    assert.deepEqual({x:after.x,y:after.y,arms:after.arms},{x:original.x,y:original.y,arms:original.arms},'native ACTION cancel restores the general without spending troops');
    probe.after=after;
    return mask;
}

async function conquerBattle(cdp,round,defending=false) {
    const initial=await evaluate(cdp,battleStateExpression);
    assert.equal(initial.mode,defending?0:1,'the combat driver follows the actual native attack/defense mode');
    if(defending)assert.equal(initial.mainGen,10,'the real attacking commander is native index 10 in defense');
    const cities=await evaluate(cdp,cityTilesExpression);
    assert.ok(cities.length,'real C battle map contains a city terrain tile');
    report.objectives??=[];report.objectives.push({round,cities,defending});
    // Preserve the real native movie/settings values; preparation is not an animation shortcut.
    const masks=new Map();
    const maxSteps=Math.min(initial.fight.boutMax,30)*(initial.units.filter(u=>u.side==='player').length+1)+1;
    for(let step=0;step<maxSteps;step++) {
        const state=await evaluate(cdp,battleStateExpression);
        if(state.fight.over||!state.fight.active)break;
        assert.ok(state.fight.bout<=Math.min(state.fight.boutMax,30),'city capture stays within native battle duration');
        const actor=state.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![1,6,8].includes(u.state))
            .sort((a,b)=>b.arms-a.arms)[0];
        if(!actor) {await advanceTurn(cdp,round);continue;}
        let selected=await chooseGeneral(cdp,actor);
        if(!masks.has(actor.id)) {
            masks.set(actor.id,await cacheAttackMask(cdp,actor,selected,round));
            selected=await chooseGeneral(cdp,actor);
        }
        if(selected.inputKind===2) {
            const candidates=await evaluate(cdp,moveTilesExpression),target=chooseCampaignTile(candidates,state.units,actor,state.mainGen,cities,masks.get(actor.id).offsets,defending);
            assert.ok(target,'real legal unoccupied movement toward objective exists');
            report.tactics??=[];report.tactics.push({round,step,defending,bout:state.fight.bout,actor:actor.name,unitId:actor.id,
                maskInputSeq:masks.get(actor.id).inputSeq,legalCandidates:candidates.length,from:{x:actor.x,y:actor.y},target});
            const response=await action(cdp,'campaign-legal-move-'+actor.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
            assert.equal(response.ok,true);
            await waitBattle(cdp,3,'campaign action menu '+actor.name);
        }
        const moved=await evaluate(cdp,battleStateExpression),unit=moved.units.find(u=>u.i===actor.i);
        const standingCity=cities.some(p=>unit&&unit.x===p.x&&unit.y===p.y);
        if((defending||!standingCity)&&await attackIfPossible(cdp,actor,round,step,cities,masks,defending))continue;
        const names=await evaluate(cdp,'baye.hd.menuItems().names');
        await menuChoice(cdp,names[3]);
        await waitForGameProgress(cdp,'rest or actual city capture',`baye.hd.fight().over||baye.hd.fight().inputKind===1`,30000);
        if(standingCity)await checkpoint(cdp,'battle-'+round+'-city-action-'+step);
    }
    const terminal=await evaluate(cdp,battleStateExpression);
    if(defending)await waitFor(cdp,'native defense result','!baye.hd.fight().active&&[1,2].includes(baye.hd.fight().over)',30000);
    else {
        assert.notEqual(terminal.fight.over,2,'the real campaign cannot be counted as victory after a native defeat');
        await waitFor(cdp,'native campaign victory','!baye.hd.fight().active&&baye.hd.fight().over===1',30000);
    }
}

async function attackIfPossible(cdp,actor,round,step,cities,masks,defending=false) {
    const names=await evaluate(cdp,'baye.hd.menuItems().names');
    await menuChoice(cdp,names[0],5);
    const actualMask=await readAttackMask(cdp,actor);
    const old=masks.get(actor.id);
    if(JSON.stringify(old.offsets)!==JSON.stringify(actualMask.offsets)) {
        report.attackMaskChanges??=[];report.attackMaskChanges.push({round,step,actor:actor.name,before:old,after:actualMask});
    }
    masks.set(actor.id,actualMask);
    const onCity=u=>cities.some(c=>c.x===u.x&&c.y===u.y);
    const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.arms>0)
        .sort((a,b)=>Number(defending?b.i===10:onCity(b))-Number(defending?a.i===10:onCity(a))||a.arms-b.arms);
    if(!targets.length) {
        await action(cdp,'cancel-no-legal-enemy','BayeHdBattle.cancel()');await waitBattle(cdp,3,'no target returns action');return false;
    }
    const target=targets[0],before=await evaluate(cdp,battleStateExpression);
    assert.ok(attackCovers(actualMask.offsets,actualMask.anchor,target),'the final native AIM mask covers the actual chosen target');
    const response=await action(cdp,'campaign-attack-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(response.ok,true);
    await waitForGameProgress(cdp,'campaign attack resolves','baye.hd.fight().over||baye.hd.fight().inputKind===1',30000);
    const after=await evaluate(cdp,battleStateExpression),enemy=after.units.find(u=>u.i===target.i);
    assert.ok(!enemy||enemy.arms<target.arms,'real campaign attack damages target');
    report.attacks??=[];report.attacks.push({round,step,defending,actor:actor.name,target:target.name,actualMask,before,after});
    await checkpoint(cdp,'battle-'+round+'-attack-'+step);
    return true;
}

async function advanceTurn(cdp,round) {
    const before=await evaluate(cdp,battleStateExpression);
    await action(cdp,'campaign-explicit-end-turn','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'campaign turn system');
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name);
    await waitForGameProgress(cdp,'campaign enemy turn',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.over||!s.transaction&&f.inputKind===1&&f.bout>${before.fight.bout};})()`,60000,
        {maxTimeout:240000,round,bout:before.fight.bout});
    const after=await evaluate(cdp,battleStateExpression);
    assert.ok(after.fight.over||after.fight.bout===before.fight.bout+1,'one player end advances one round');
    report.turns??=[];report.turns.push({round,before,after});
    await checkpoint(cdp,'battle-'+round+'-bout-'+after.fight.bout);
}

const defenseStateExpression=`(() => {
    const d=baye.data,p=d.g_FgtParam,people=(start,end)=>Array.from({length:end-start},(_,i)=>Number(p.GenArray[start+i]))
        .filter(id=>id>0&&id<0xfffe).map(id=>({pind:id-1,name:baye.getPersonName(id-1),arms:Number(d.g_Persons[id-1].Arms),belong:Number(d.g_Persons[id-1].Belong)}));
    return {mode:Number(p.Mode),cityIndex:Number(p.CityIndex),defenders:people(0,10),attackers:people(10,20)};
})()`;

async function liveDefenderMenu(cdp,description,previousSeq=null) {
    return waitFor(cdp,'actual native DEFENDERS and visible ownership '+description,`(() => {
        const menu=baye.hd.menuItems(),dialog=BayeHdDialog.debugSnapshot(),owner=dialog.defenseOwner,d=baye.data;
        if(!menu.active||menu.context!==5||menu.kind!==2||${previousSeq===null?'false':`menu.seq===${previousSeq}`}||
            !dialog.open||dialog.kind!=='defenders'||dialog.defenseRequest||!owner||owner.context!==5||owner.kind!==2||
            owner.seq!==menu.seq||Number(d.g_FgtParam.Mode)!==0||Number(d.g_FgtParam.CityIndex)!==owner.cityIndex||
            JSON.stringify(owner.names)!==JSON.stringify(menu.names))return false;
        const nodes=[...document.querySelectorAll('#hd-dialog [data-hd-defender-index]')];
        if(nodes.length!==menu.names.length||!nodes.length)return false;
        const city=d.g_Cities[owner.cityIndex],belong=baye.hd.realm().playerBelong;
        if(Number(city.Belong)!==belong)throw new Error('Native DEFENDERS must belong to an actual player city');
        const queue=Array.from({length:Number(city.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(city.PersonQueue)+i]));
        const persons=[],token=nodes[0].getAttribute('data-hd-defenders-owner');
        for(let index=0;index<menu.names.length;index++) {
            const name=menu.names[index],node=nodes.find(n=>Number(n.getAttribute('data-hd-defender-index'))===index);
            if(!node||node.disabled||node.getAttribute('data-hd-defender-name')!==name||
                Number(node.getAttribute('data-hd-defender-seq'))!==menu.seq||
                Number(node.getAttribute('data-hd-menu-context'))!==5||Number(node.getAttribute('data-hd-menu-kind'))!==2||
                !token||node.getAttribute('data-hd-defenders-owner')!==token)return false;
            const matches=queue.filter(pid=>baye.getPersonName(pid)===name);
            if(matches.length!==1)throw new Error('Defender name must resolve to exactly one true city PersonQueue ID: '+name);
            const pind=matches[0],p=d.g_Persons[pind];
            if(Number(p.Belong)!==belong)throw new Error('Native defender is not an actual allied city general: '+name);
            persons.push({index,pind,name,arms:Number(p.Arms),belong:Number(p.Belong)});
        }
        const selected=Array.from({length:10},(_,i)=>Number(d.g_FgtParam.GenArray[i])).filter(id=>id>0&&id<0xfffe);
        if(JSON.stringify(selected)!==JSON.stringify(owner.selected))return false;
        return {menu,owner,token,persons,selected,cityIndex:owner.cityIndex};
    })()`);
}

function defenderSelector(owner,person) {
    return '#hd-dialog [data-hd-defender-index="'+person.index+'"]'+
        '[data-hd-defender-name='+JSON.stringify(person.name)+'][data-hd-defender-seq="'+owner.menu.seq+'"]'+
        '[data-hd-menu-context="5"][data-hd-menu-kind="2"][data-hd-defenders-owner='+JSON.stringify(owner.token)+']';
}

function incomingDefenseOrder(world,cityIndex,attackers) {
    const ids=attackers.map(p=>p.pind+1);
    const orders=world.orders.filter(order=>order.OrderId===27&&order.Object===cityIndex&&order.TimeCount===0);
    const exact=orders.filter(order=> {
        const bytes=world.fighters.slice(order.Person*20,order.Person*20+20),stored=[];
        for(let i=0;i<bytes.length;i+=2) {const id=bytes[i]+256*bytes[i+1];if(id>0&&id<0xfffe)stored.push(id);}
        return JSON.stringify(stored)===JSON.stringify(ids);
    });
    assert.equal(exact.length,1,'one real pending BATTLE order matches the native attacking GenArray IDs');
    return {order:exact[0],pendingOrders:orders,attackerIds:ids};
}

async function playNpcDefense(cdp,label) {
    const presentation=await evaluate(cdp,'({keys:window.__speEngineKeys.length,city:BayeHdCityMenu.getMode(),battle:BayeHdBattle.getMode()})');
    await evaluate(cdp,"BayeHdCityMenu.setMode('hd');BayeHdBattle.setMode('hd');");
    assert.equal(await evaluate(cdp,'window.__speEngineKeys.length'),presentation.keys,'Presentation mode changes send no native input');
    const first=await liveDefenderMenu(cdp,label),before=await evaluate(cdp,worldExpression),pending=await evaluate(cdp,defenseStateExpression);
    assert.equal(pending.mode,0);assert.equal(pending.cityIndex,first.cityIndex);assert.equal(first.selected.length,0,'native NPC defense starts with a cleared defending team');
    const queue=await readCityPersons(cdp,first.cityIndex),belong=before.playerKing+1;
    const protection=preparationProtection(before),abandonment=!protection.protectedCities.includes(first.cityIndex);
    assert.ok(before.cities[first.cityIndex].belong===1&&first.selected.length===0);
    if(abandonment){assert.ok(first.cityIndex!==20&&first.cityIndex!==protection.capital);assert.ok(!before.cities[first.cityIndex].queue.includes(0));assert.ok(protection.ownedCities.length>1,'Never abandon the last actual player city');}
    const roster=abandonment?[]:queue.filter(p=>p.belong===belong&&p.arms>0)
        .sort((a,b)=>b.arms-a.arms||a.pind-b.pind).slice(0,10);
    assert.ok(roster.every(p=>first.persons.some(item=>item.pind===p.pind)),'every armed allied defender is offered by the real native selection menu');
    const round='defense-'+((report.extraDefenses?.length||0)+1),protectedTarget=entryCityForProtection(first.cityIndex,before);
    const previousFight=await evaluate(cdp,'baye.hd.fight()');
    const entry={label:round,source:label,cityIndex:first.cityIndex,protectedTarget,
        before,pending,previousFight,protection,abandonment,originalResidents:queue,strategy:abandonment?'Explicit zero-defender abandonment: real defeat/occupation/resident loss':'Original selected-defender manual combat',...incomingDefenseOrder(before,first.cityIndex,pending.attackers),selected:[],menuSeq:first.menu.seq};
    report.extraDefenses??=[];report.extraDefenses.push(entry);
    await checkpoint(cdp,round+'-native-selection',{defense:pending,incomingOrder:entry.order});
    let previousSeq=null;
    for(const desired of roster) {
        const owner=await liveDefenderMenu(cdp,round+' '+desired.name,previousSeq),currentQueue=await readCityPersons(cdp,entry.cityIndex);
        const item=owner.persons.find(p=>p.pind===desired.pind&&p.name===desired.name);
        assert.ok(item,'the exact armed defender is still in the current native menu: '+desired.name);
        assert.equal(item.arms,desired.arms,'the native defender troops remain unchanged before selection');
        assert.deepEqual(owner.selected,entry.selected.map(p=>p.pind+1),'native selected defender IDs equal the acknowledged prefix');
        await checkpoint(cdp,round+'-select-'+entry.selected.length+'-ready',{defender:item});
        await click(cdp,defenderSelector(owner,item));
        const expected=entry.selected.map(p=>p.pind+1).concat(item.pind+1);
        await waitFor(cdp,'real defender GenArray ACK '+item.name,`JSON.stringify(Array.from({length:10},(_,i)=>Number(baye.data.g_FgtParam.GenArray[i])).filter(id=>id>0&&id<0xfffe))===${JSON.stringify(JSON.stringify(expected))}`);
        const remaining=await readCityPersons(cdp,entry.cityIndex);
        assert.deepEqual(remaining.map(p=>p.pind).sort((a,b)=>a-b),currentQueue.filter(p=>p.pind!==item.pind).map(p=>p.pind).sort((a,b)=>a-b),
            'native defensive selection removes exactly the named city general: '+item.name);
        entry.selected.push({...item,menuSeq:owner.menu.seq});previousSeq=owner.menu.seq;
        await checkpoint(cdp,round+'-select-'+(entry.selected.length-1)+'-ack');
    }
    const menu=await evaluate(cdp,'baye.hd.menuItems()');
    if(menu.active&&menu.context===5&&menu.kind===2) {
        const owner=await liveDefenderMenu(cdp,round+' explicit finish',previousSeq);
        entry.finish='explicit-exit';
        if(abandonment){
            assert.deepEqual(owner.selected,[]);assert.deepEqual(entry.selected,[]);
            const world=await observeCampaign(cdp,round+' final abandonment world'),current=await liveDefenderMenu(cdp,round+' final abandonment owner');
            sameWorld(before,world,'No input while authenticating abandonment');assert.deepEqual(preparationProtection(world),protection);
            assert.deepEqual(current,owner,'Only the exact same fresh context5 owner permits this one EXIT');
            assert.equal(current.cityIndex,first.cityIndex);assert.deepEqual(current.selected,[]);
            // The two complete owner/world reads above are authoritative. The
            // final tuple below is direct, not inferred from an old fight result.
            const final=await evaluate(cdp,'({menu:baye.hd.menuItems(),mode:Number(baye.data.g_FgtParam.Mode),cityIndex:Number(baye.data.g_FgtParam.CityIndex),selected:Array.from({length:10},(_,i)=>Number(baye.data.g_FgtParam.GenArray[i]))})');
            assert.deepEqual(final.menu,current.menu);assert.equal(final.mode,0);assert.equal(final.cityIndex,first.cityIndex);assert.ok(final.selected.every(id=>id===0));
            entry.abandonmentOwner={owner:current,world,final};entry.finishKeyStart=await evaluate(cdp,'window.__speEngineKeys.length');
        }
        await click(cdp,'#hd-dialog [data-hd-defenders-finish][data-hd-defender-seq="'+owner.menu.seq+'"]'+
            '[data-hd-defenders-owner='+JSON.stringify(owner.token)+']');
        if(abandonment){entry.finishKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${entry.finishKeyStart})`);assert.deepEqual(entry.finishKeys.map(k=>k.code),[40],'One explicit EXIT abandons this actual non-protected city');}
    } else entry.finish='auto-exhausted';
    if(entry.selected.length) {
        await waitForGameProgress(cdp,'fresh native NPC defense PICK',`(() => {const f=baye.hd.fight();return f.active&&f.over===0&&f.inputKind===1&&baye.data.g_FgtParam.Mode===0&&baye.data.g_MainGenIdx===10;})()`,60000);
        entry.initial=await evaluate(cdp,battleStateExpression);
        assert.equal(entry.initial.fight.cityIndex,entry.cityIndex);
        assert.ok(entry.initial.fight.inputSeq>previousFight.inputSeq,'NPC defense starts a new native input generation after the prior result');
        assertDispatchedArmy(entry.initial,entry);
        const enemies=entry.initial.units.filter(p=>p.side==='enemy').map(p=>({pind:p.id-1,name:p.name,arms:p.arms}));
        assert.deepEqual(enemies,pending.attackers.map(p=>({pind:p.pind,name:p.name,arms:p.arms})),'the true NPC army retains its original order identities and troops');
        assert.equal(entry.initial.units.find(p=>p.i===10)?.id-1,pending.attackers[0].pind,'defense index 10 is the actual incoming commander');
        const cityTiles=await evaluate(cdp,cityTilesExpression),firstGuard=entry.initial.units.find(p=>p.side==='player');
        assert.ok(cityTiles.some(p=>p.x===firstGuard.x&&p.y===firstGuard.y),'the first real selected defender starts on the actual city tile');
        await checkpoint(cdp,round+'-battle-ready');
        await conquerBattle(cdp,round,true);
    } else {
        await waitForGameProgress(cdp,'native empty defending army result','!baye.hd.fight().active&&baye.hd.fight().over===2&&baye.hd.fight().skip===4&&baye.data.g_FgtParam.Mode===0&&baye.data.g_MainGenIdx===10',60000);
        entry.instantEmptyDefense=true;
    }
    entry.terminal=await evaluate(cdp,battleStateExpression);entry.outcome=entry.terminal.fight.over;
    assert.ok([1,2].includes(entry.outcome),'NPC defense records only a real native victory or defeat');
    await checkpoint(cdp,round+'-terminal');
    if(abandonment){
        assert.equal(entry.outcome,2);assert.equal(entry.terminal.mode,0);assert.equal(entry.terminal.fight.skip,4);assert.deepEqual(entry.selected,[]);
        await waitForGameProgress(cdp,round+' real native occupation after zero defenders',`Number(baye.data.g_Cities[${entry.cityIndex}].Belong)!==1`,60000);
        const world=await observeCampaign(cdp,round+' actual abandonment occupation'),residents=await evaluate(cdp,`(() => {const d=baye.data;return ${JSON.stringify(queue)}.map(p=>({...p,belong:Number(d.g_Persons[p.pind].Belong),arms:Number(d.g_Persons[p.pind].Arms)}));})()`);
        const occupied=world.cities.find(c=>c.i===entry.cityIndex);assert.ok(occupied&&occupied.belong!==1);preparationProtection(world);
        for(const person of residents.filter(p=>queue.some(old=>old.pind===p.pind&&old.belong===1))){assert.notEqual(person.pind,0);assert.equal(person.belong,0,'Native BeOccupied makes this unselected non-lord resident unowned');assert.equal(person.arms,0,'Native occupation clears the unselected resident troops');}
        entry.occupation={world,city:occupied,residents,scope:'Actual original loss/occupation. No selected defending army; unselected old allied residents become unowned with zero arms. No claim of safe/no-loss automatic defense.'};
        await checkpoint(cdp,round+'-actual-abandonment-occupation');
    }
    if(protectedTarget!==null)assert.equal(entry.outcome,1,'the originally captured target must survive its real NPC defense before saving its occupation');
    entry.presentation=presentation;return entry;
}


// This strategy explicitly abandons a non-protected city, never auto-battles.
// Current native resident queues identify the actual lord city on every read.
function preparationProtection(world){
 assert.equal(world.playerKing,0);assert.equal(world.origin.i,20);assert.equal(world.origin.belong,1);
 const lordCities=world.cities.filter(c=>c.queue.includes(0));
 assert.equal(lordCities.length,1,'The actual original lord remains resident in exactly one current city');
 const capital=lordCities[0];assert.equal(capital.belong,1);assert.ok(capital.ownedQueue.includes(0),'The actual lord still belongs to the player faction');
 const owned=world.cities.filter(c=>c.belong===1);assert.ok(owned.length>=new Set([20,capital.i]).size);
 return {playerKing:0,playerBelong:1,origin:20,capital:capital.i,protectedCities:[...new Set([20,capital.i])],ownedCities:owned.map(c=>c.i),lordCity:capital};
}
function entryCityForProtection(city,world){const p=preparationProtection(world);return p.protectedCities.includes(city)?city:null;}
function recordAbandonmentMonth(world,defenseStart,label){
 const protection=preparationProtection(world),entries=(report.extraDefenses||[]).slice(defenseStart).filter(e=>e.abandonment);
 for(const entry of entries){entry.monthEnd={label,date:world.date,protection,city:world.cities.find(c=>c.i===entry.cityIndex),world};}
 report.protectionReceipts??=[];report.protectionReceipts.push({label,date:world.date,protection,abandoned:entries.map(e=>e.label)});
}

const acknowledgedProgressReports=new Set();let progressReportIndex=0;
async function waitForGameProgress(cdp,description,expression,timeout=20000,nativeProgress=null) {
    const started=Date.now(),deadline=started+(nativeProgress?.maxTimeout??timeout);
    let lastProgress=started,previousNative=null;
    const progress=nativeProgress?{description,round:nativeProgress.round,bout:nativeProgress.bout,
        startedAt:new Date(started).toISOString(),noProgressTimeoutMs:timeout,
        totalTimeoutMs:nativeProgress.maxTimeout,trace:[]}:null;
    if(progress) {report.progressWaits??=[];report.progressWaits.push(progress);}
    const finish=(status)=> {
        if(progress)Object.assign(progress,{status,elapsedMs:Date.now()-started,
            noProgressMs:Date.now()-lastProgress,finishedAt:new Date().toISOString()});
    };
    while(Date.now()<deadline) {
        const value=await evaluate(cdp,expression);
        if(value&&!progress)return value;
        const owners=await evaluate(cdp,progress?
            `({fight:baye.hd.fight(),spe:baye.hd.spe(),report:baye.hd.report(),dialog:BayeHdDialog.debugSnapshot()})`:
            `({report:baye.hd.report(),dialog:BayeHdDialog.debugSnapshot()})`);
        if(progress) {
            const now=Date.now(),f=owners.fight,s=owners.spe,r=owners.report;
            if(now>=deadline) {
                finish('total-timeout');
                throw new Error('Timed out waiting for '+description+' (total native wait limit reached)');
            }
            const native={bout:f.bout,fightInputSeq:f.inputSeq,focusX:f.focusX,focusY:f.focusY,
                speSeq:s.seq,speActive:s.active,reportSeq:r.seq,reportInputSeq:r.inputSeq,reportActive:r.active};
            const changed=Object.keys(native).filter(key=>!previousNative||native[key]!==previousNative[key]);
            if(changed.length) {
                lastProgress=now;
                progress.trace.push({at:new Date(now).toISOString(),elapsedMs:now-started,changed,native});
                previousNative=native;
            }
            if(value) {finish('complete');return value;}
            if(now-lastProgress>=timeout) {
                finish('no-native-progress');
                throw new Error('Timed out waiting for '+description+' (no native progress for '+timeout+'ms)');
            }
        }
        const native=owners.report,dialog=owners.dialog;
        if(native?.active===1&&native.inputSeq>0&&dialog?.open&&dialog.kind==='report'&&!dialog.pass&&
            dialog.reportOwner&&Number(dialog.reportOwner.inputSeq)===Number(native.inputSeq)&&
            Number(dialog.reportOwner.seq)===Number(native.seq)) {
            const token=native.seq+':'+native.inputSeq;
            if(!acknowledgedProgressReports.has(token)) {
                acknowledgedProgressReports.add(token);
                await checkpoint(cdp,'progress-native-report-'+(++progressReportIndex));
                const current=await evaluate(cdp,'baye.hd.report()');
                if(current.active===1&&current.seq===native.seq&&current.inputSeq===native.inputSeq) {
                    report.progressReports??=[];
                    report.progressReports.push({description,owner:native});
                    await click(cdp,'#hd-dialog [data-hd-dlg-ok]');
                }
            }
        }
        await delay(150);
    }
    finish('total-timeout');
    throw new Error('Timed out waiting for '+description);
}


async function preparationCapital(cdp){
 const w=await observeCampaign(cdp,'current actual capital identity');
 const cities=w.cities.filter(c=>c.belong===1&&c.ownedQueue.includes(0));
 assert.equal(cities.length,1,'Current genuine CaoPi has one resident city');
 report.protectedCapital=cities[0].i;return cities[0].i;
}
async function strengthenCity(cdp,number,cityIndex){
 const world=await evaluate(cdp,recruitWorldExpression(cityIndex));
 const allies=world.persons.filter(p=>p.belong===1),target=allies.filter(p=>p.arms<1800).sort((a,b)=>Number(b.personIndex===0)-Number(a.personIndex===0)||b.force-a.force||b.iq-a.iq||a.personIndex-b.personIndex)[0],recruiters=allies.filter(p=>p.personIndex!==target?.personIndex&&p.personIndex!==world.playerKing&&p.thew>=nativeItem(2,9)[24]);
 if(!target||world.money<400||!recruiters.length){report.defenseCostStops??=[];report.defenseCostStops.push({number,cityIndex,world,reason:!target?'Current defenders already at planned floor':world.money<400?'Actual Money below bounded preparation reserve':'No distinct available native recruiter with actual Thew cost'});return;}
 const mode=await evaluate(cdp,'BayeHdCityMenu.getMode()'),savedPerson=casterPerson,savedNative=casterNativeId;
 casterPerson=target.personIndex;casterNativeId=casterPerson+1;
 try{
  await evaluate(cdp,"BayeHdCityMenu.setMode('hd');");
  const pos=await evaluate(cdp,`BayeHdOverworld.cityScreenPos(${cityIndex})`),walk=await action(cdp,'open current protected city for public recruitment',`BayeHdOverworld.walkToCity(${cityIndex})`);
  assert.deepEqual(walk,{name:pos.name,to:{x:pos.engX,y:pos.engY}});
  await waitFor(cdp,'actual capital HD root',`BayeHdCityMenu.isOpen()&&BayeHdCityMenu.getLayer()==='root'&&baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1`);
  await click(cdp,'#hd-city-menu [data-hd-root="2"]');await waitFor(cdp,'actual capital military submenu',`BayeHdCityMenu.getLayer()==='sub'&&baye.hd.menuItems().active&&baye.hd.menuItems().names[0]==='侦察'`);
  await recruitSmoke(cdp,cityIndex);report.defenseRecruitment??=[];report.defenseRecruitment.push({number,cityIndex,target,proof:report.recruitment});
  await click(cdp,'#hd-city-menu [data-hd-menu-back]');const rootOwner=await waitFor(cdp,'actual capital submenu Back reaches current native root',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return s.open&&s.layer==='root'&&s.cityIndex===${cityIndex}&&!s.sending&&!s.queueLen&&m.active===1&&m.context===1&&m.kind===1&&m;})()`);assert.deepEqual(await evaluate(cdp,'baye.hd.menuItems()'),rootOwner,'Second Back has the actual new native root owner');const backKeys=await evaluate(cdp,'window.__speEngineKeys.length');await click(cdp,'#hd-city-menu [data-hd-menu-back]');await waitFor(cdp,'current native capital root Back returns actual map','!baye.hd.menuItems().active&&baye.hd.march().pick===1&&baye.hd.march().phase===0&&!BayeHdCityMenu.debugSnapshot().sending&&BayeHdCityMenu.debugSnapshot().queueLen===0');assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${backKeys})`)).map(k=>k.code),[40],'One EXIT belongs only to the acknowledged current native root');
 }finally{casterPerson=savedPerson;casterNativeId=savedNative;await evaluate(cdp,`BayeHdCityMenu.setMode(${JSON.stringify(mode)});`);}
}
async function strengthenProtectedCities(cdp,number){
 const before=await observeCampaign(cdp,'protected cities before real bounded recruitment'),protection=preparationProtection(before);
 for(const cityIndex of protection.protectedCities){
  const world=await observeCampaign(cdp,'current protection before recruitment city'+cityIndex),current=preparationProtection(world);
  assert.ok(current.protectedCities.includes(cityIndex));await strengthenCity(cdp,number,cityIndex);
 }
 const after=await observeCampaign(cdp,'protected cities after real bounded recruitment');preparationProtection(after);
 report.protectedRecruitmentReceipts??=[];report.protectedRecruitmentReceipts.push({number,before,after,scope:'Original legal conscription and distribution only. Actual remaining residents, Money, Thew and native quantity maxima bound each order; no claim of guaranteed victory.'});
}



// ABI comes directly from packed attribute.h and GamSaveRcd: Person19 + queue2,
// City37, Order14. Never edits or manufactures either original native file.
function validateSavedPair(files,world,label){
 assert.ok(Array.isArray(files)&&files.length===2&&files.every(Buffer.isBuffer));const [a,b]=files;
 assert.ok(a.length>=21&&b.length>=3434);assert.equal(a[0],0x95,label+' actual version');
 const count=a.readUInt16LE(2),personOffset=16,queueOffset=personOffset+count*19,customOffset=queueOffset+count*2+4000;
 assert.ok(count>0&&count<=2000&&customOffset+5<=a.length);assert.equal(a[1],world.period);assert.equal(a.readUInt16LE(4),world.playerKing);assert.equal(a.readUInt16LE(6),world.date.year,label+' genuine saved year');assert.equal(a[11],world.date.month,label+' genuine saved month');
 assert.equal(a.readUInt32LE(customOffset+1),a.length-customOffset-5,'Complete actual custom-data length, no partial/stale pair');
 const parsedPerson=id=>{assert.ok(Number.isInteger(id)&&id>=0&&id<count);const o=16+id*19;return {personIndex:id,oldBelong:a.readUInt16LE(o),belong:a.readUInt16LE(o+2),level:a[o+4],force:a[o+5],iq:a[o+6],devotion:a[o+7],character:a[o+8],experience:a[o+9],thew:a[o+10],baseArm:a[o+11],arms:a.readUInt16LE(o+12),equip:[a.readUInt16LE(o+14),a.readUInt16LE(o+16)],age:a[o+18]};};
 const people=world.observed.map(p=>{const raw=parsedPerson(p.personIndex);for(const field of ['oldBelong','belong','level','force','iq','devotion','character','experience','thew','baseArm','arms','age'])assert.equal(raw[field],p[field],label+' real person'+p.personIndex+' '+field);if(p.equip?.every(Number.isInteger))assert.deepEqual(raw.equip,p.equip);return raw;});
 const queue=Array.from({length:count},(_,i)=>a.readUInt16LE(queueOffset+i*2));assert.ok(queue.every(id=>id<count));
 const cityOffset=30+600+200*14;assert.equal(b.length,cityOffset+world.cities.length*37+4);
 const cities=world.cities.map(c=>{const o=cityOffset+c.i*37,raw={i:c.i,belong:b.readUInt16LE(o+1),money:b.readUInt16LE(o+23),food:b.readUInt16LE(o+25),reserve:b.readUInt16LE(o+27),personQueue:b.readUInt16LE(o+29),persons:b.readUInt16LE(o+31)};assert.ok(raw.personQueue+raw.persons<=count);raw.queue=queue.slice(raw.personQueue,raw.personQueue+raw.persons);for(const field of ['belong','money','food','reserve','queue'])assert.deepEqual(raw[field],c[field],label+' real city'+c.i+' '+field);assert.deepEqual(raw.queue.filter(id=>parsedPerson(id).belong===raw.belong),c.ownedQueue);return raw;});
 const orders=Array.from({length:200},(_,i)=>{const o=630+i*14;return {OrderId:b[o],City:b[o+3],Person:b.readUInt16LE(o+1),Object:b.readUInt16LE(o+4),TimeCount:b[o+13]};}).filter(o=>o.OrderId!==255);assert.deepEqual(orders,world.orders,label+' original complete actual order queue');
 if(world.fighters)assert.deepEqual(Array.from(b.subarray(30,630)),world.fighters,label+' original fight-order data');
 return {ok:true,label,abi:{version:149,headerBytes:16,personBytes:19,queueIdBytes:2,cityBytes:37,orderBytes:14,cityOffset},header:{period:a[1],count,king:a.readUInt16LE(4),year:a.readUInt16LE(6),month:a[11]},checkedObservedPeople:people,checkedCities:cities,checkedOrders:orders,files:files.map(data=>({bytes:data.length,sha256:sha(data)})),scope:'Read-only original byte parser; observed persons/all cities and their resident queues/orders/date, not a reconstructed or edited world'};
}
function prepareResumeInputs(){
 const rel=path.relative(root,resumeDirectory).replaceAll('\\','/');assert.ok(rel.startsWith('build/')&&!rel.split('/').includes('..'));const result=freezeAsset(rel+'/result.json').data,previous=JSON.parse(result);assert.equal(previous.sourceVerification.ok,true);assert.equal(previous.isolation.cleaned,true);assert.equal(previous.actualLib.sha256,sha(nativeLib));assert.equal(previous.period,4);assert.equal(previous.playerKing??0,0);
 const checkpoint=previous.publicCheckpoints?.find(p=>p.tag===resumeTag);assert.ok(checkpoint,'Requested independently preserved original checkpoint tag must exist');assert.equal(checkpoint.slot,saveSlot);assert.equal(checkpoint.files.length,2);assert.equal(checkpoint.info.status,'ready');assert.equal(checkpoint.info.king,0);assert.equal(checkpoint.info.period,4);
 const files=checkpoint.files.map(f=>{assert.equal(path.basename(f.path),f.path);const data=freezeAsset(rel+'/'+f.path).data;assert.equal(data.length,f.bytes);assert.equal(sha(data),f.sha256);assert.equal(f.lib,'libs/dat-mod.lib');assert.equal(typeof f.identity,'string');return {...f,hex:data.toString('hex'),data,path:rel+'/'+f.path};});assert.equal(files[0].identity,files[1].identity);
 const byteProof=validateSavedPair(files.map(f=>f.data),checkpoint.after,'original requested resume '+resumeTag);resumeInput={directory:rel,tag:resumeTag,slot:checkpoint.slot,files,world:checkpoint.after,byteProof};report.resumeCheckpoint={directory:rel,tag:resumeTag,slot:checkpoint.slot,previousOutcome:previous.ok===true?'pass':'failure retained',result:{bytes:result.length,sha256:sha(result)},executedTool:previous.tool,byteProof,files:files.map(({hex,data,...f})=>f),scope:'Unmodified native bytes are authoritative; failed previous run may supply a successfully byte-matching earlier save. Metadata mismatch is rejected before browser.'};
}
async function loadResumeCheckpoint(cdp){
 await waitFor(cdp,'actual resume engine ready','window.baye&&baye.hd&&baye.hd.ready()',60000);await observeActualLib(cdp,'resume current actual standard LIB');
 const opening=await waitFor(cdp,'actual resume MAIN3 owner',"(() => {const s=baye.hd.spe();return s.active===1&&s.id===3&&s.kind===1&&s.skipEligible&&s;})()"),n=await evaluate(cdp,'window.__speEngineKeys.length');assert.deepEqual(await evaluate(cdp,'baye.hd.spe()'),opening);await key(cdp,'Enter');await waitFor(cdp,'resume original MAIN ended',`baye.hd.spe().lastEnd.eventId===${opening.eventId}&&baye.hd.spe().lastEnd.reason==='key'&&baye.hd.spe().lastEnd.key===39`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${n})`)).map(k=>k.code),[39]);await waitFor(cdp,'resume native title picture',"window.__speSamples.some(r=>r.spe&&r.spe.id===100)");
 const count=await evaluate(cdp,'window.__speEngineKeys.length'),pair={sav0:resumeInput.files[0].hex,sav1:resumeInput.files[1].hex,lib:resumeInput.files[0].lib,name:resumeInput.files[0].name,identity:resumeInput.files[0].identity};
 const imported=await evaluate(cdp,`(() => {const pair=${JSON.stringify(pair)};if(!BayeSaveStorage.validatePair(pair.sav0,pair.sav1))throw Error('Original native pair rejected');return {ok:BayeSaveStorage.importSlot(${saveSlot},pair),slot:BayeSaveStorage.inspectSlot(${saveSlot}),keys:window.__speEngineKeys.length};})()`);assert.equal(imported.ok,true);assert.equal(imported.slot.canLoad,true);assert.equal(imported.keys,count,'Public original import has no game input');assert.equal(imported.slot.king,0);assert.equal(imported.slot.period,4);report.publicResumeImport=imported;
 await key(cdp,'ArrowDown');await key(cdp,'Enter');let r=await waitFor(cdp,'actual resume LOAD owner',"(() => {const r=baye.hd.record();return r.active===1&&r.mode===2&&r;})()");assert.equal(r.count,4);for(let i=0;r.index!==saveSlot&&i<4;i++){const before=r,next=r.index+(saveSlot>r.index?1:-1);await key(cdp,saveSlot>r.index?'ArrowDown':'ArrowUp');r=await waitFor(cdp,'resume native record highlight ACK',`(() => {const r=baye.hd.record();return r.active===1&&r.mode===2&&r.seq===${before.seq}&&r.index===${next}&&r;})()`);}assert.equal(r.index,saveSlot);assert.deepEqual(await evaluate(cdp,'baye.hd.record()'),r);await key(cdp,'Enter');await waitFor(cdp,'genuine native resumed strategy world','!baye.hd.record().active&&!baye.hd.menuItems().active&&Number(baye.data.g_PIdx)===4&&Number(baye.data.g_PlayerKing)===0&&baye.hd.march().pick===1&&baye.hd.march().phase===0',60000);
 const after=await observeCampaign(cdp,'actual public native checkpoint loaded');sameWorld(resumeInput.world,after,'Original public checkpoint load');validateSavedPair(resumeInput.files.map(f=>f.data),after,'Actual loaded world from original pair');report.resumeNativeLoad={owner:r,before:resumeInput.world,after};await observeActualLib(cdp,'native loaded actual checkpoint LIB');await evaluate(cdp,"window.__spePhase='preparation';BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('classic');BayeHdSystemUi.setMode('hd');");await waitFor(cdp,'current genuine resumed HD map','BayeHdOverworld.debugSnapshot().phase===\'map\'');await preparationCapital(cdp);await checkpoint(cdp,'02-public-original-checkpoint-loaded');
}

// Full CIM samples stay in memory. Only verified-owned command lines may reach disk.
const osIdentity=p=>({ProcessId:p.ProcessId,ParentProcessId:p.ParentProcessId,CreationDate:p.CreationDate});
function persistentOwnership(s){return {schemaVersion:s.schemaVersion,rootPid:s.rootPid,profile:s.profile,sampledAt:s.sampledAt,rootVerified:s.rootVerified,reason:s.reason,owned:s.owned,excludedIdentities:s.excluded.map(osIdentity),profileMatchIdentities:s.profileMatches.map(osIdentity)};}
function persistentCleanup(proof,basis){
 const ownedAt=p=>basis.owned.some(o=>o.ProcessId===p.ProcessId&&o.CreationDate===p.CreationDate&&o.ExecutablePath===p.ExecutablePath&&o.CommandLine===p.CommandLine);
 return {schemaVersion:proof.schemaVersion,rootPid:proof.rootPid,profile:proof.profile,dryRun:proof.dryRun,directoriesDeleted:proof.directoriesDeleted,treeExited:proof.treeExited,errors:proof.errors,stopEvents:proof.stopEvents,recordedOwned:basis.owned,
  recheck:proof.recheck&&{targets:proof.recheck.targets.map(osIdentity),refused:proof.recheck.refused.map(p=>({recorded:osIdentity(p.recorded),current:osIdentity(p.current),reason:p.reason})),absent:proof.recheck.absent.map(osIdentity)},
  samples:proof.samples.map(s=>({stage:s.stage,sampledAt:s.sampledAt,owned:s.processes.filter(ownedAt),unrelatedCount:s.processes.filter(p=>!ownedAt(p)).length})),
  exitVerification:proof.exitVerification&&{treeExited:proof.exitVerification.treeExited,survivingRecorded:proof.exitVerification.survivingRecorded.map(osIdentity),rootDescendants:proof.exitVerification.rootDescendants.map(osIdentity),profileMatches:proof.exitVerification.profileMatches.map(osIdentity)}};
}
async function main() {
    assert.ok(!fs.existsSync(path.join(artifactDir,'result.json')),'Use a fresh artifact directory; prior success/failure evidence is preserved');
    fs.mkdirSync(artifactDir, { recursive: true });
    let server, chrome, cdp, chromeError, profile, ownership;
    const ownSnapshot=async label=>{
        if(!chrome||!profile)return ownership||null;
        try{const s=await snapshotOwnedChrome(chrome.pid,profile),first=ownership?.owned.find(p=>p.ProcessId===chrome.pid),next=s.owned.find(p=>p.ProcessId===chrome.pid);
            const sameRoot=!first||next&&first.CreationDate===next.CreationDate&&first.ExecutablePath===next.ExecutablePath&&first.CommandLine===next.CommandLine;
            fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),...persistentOwnership(sameRoot?s:{...s,owned:[]}),sameRoot})+String.fromCharCode(10));
            if(s.rootVerified===true&&sameRoot)ownership=s;
        }catch(e){fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),error:{name:String(e?.name||'Error'),code:typeof e?.code==='string'?e.code:null,message:'Owned snapshot failed; previous verified basis retained; unrelated CIM command lines are never persisted'}})+String.fromCharCode(10));}
        return ownership||null;
    };
    captureOwnedSnapshot=ownSnapshot;

    const interrupt = () => {
        report.interrupted = true;
        if (cdp) cdp.close();
        // Root stays alive until finally refreshes the full owned-tree basis.
        if (server) server.closeAllConnections();
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
        prepareServedAssets();if(resumeDirectory)prepareResumeInputs();if(castOnly)await prepareCastInputs();
        assert.equal(typeof WebSocket,'function','Node 22+ built-in WebSocket is available');
        console.log('Frozen',Object.keys(report.sources).length,'sources; native',report.nativeSourceCheck.aggregate,'; runner',report.tool.sha256);
        if(preflightOnly){report.ok=true;report.hdAccepted=false;report.scope={accepted:'Readonly exact-source/LIB/resource/native-build preflight',notRun:'No private browser or game input'};return;}
        profile=path.join(artifactDir,'private-browser-profile');assert.ok(!fs.existsSync(profile),'Fresh private evidence profile only');fs.mkdirSync(profile);
        server = await startServer();
        const origin = 'http://127.0.0.1:' + server.address().port;
        const debugPort = await unusedPort();
        assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);
        const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
        const binary = process.env.CHROME || candidates.find((filename) => fs.existsSync(filename));
        assert.ok(binary, 'Set CHROME to a Chromium/Chrome executable');
        chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
            '--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows', '--window-size='+viewport.width+','+viewport.height, '--remote-debugging-port=' + debugPort,
            '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide:true });
        report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,rootPid:chrome.pid,user8080Touched:false,profileIntentionallyRetained:true};
        chrome.on('error', (error) => { chromeError = error; });
        let target;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (chromeError) throw chromeError;
            if (childExited(chrome)) throw new Error('Chrome exited with ' + chrome.exitCode);
            try {
                const list = await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) }).then((res) => res.json());
                target = list.find((item) => item.type === 'page');
                if (target) break;
            } catch {}
            await delay(100);
        }
        assert.ok(target, 'Chrome DevTools started');
        await ownSnapshot('launch-before-first-page');assert.ok(ownership?.rootVerified,'Owned PID/profile/birth required before game page');report.isolation.rootBirth=ownership.owned.find(p=>p.ProcessId===chrome.pid).CreationDate;
        cdp = await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled', (event) => {
            report.console.push({ type: event.type, text: event.args.map((arg) => arg.value ?? arg.description ?? '').join(' ') });
            if (report.console.length > 100) report.console.shift();
        });
        cdp.on('Runtime.exceptionThrown', (event) => report.exceptions.push(event.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening', (event) => {
            report.dialogs.push(event.message);
            cdp.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
        });
        cdp.on('Fetch.requestPaused', (event) => {
            const local = new URL(event.request.url).origin === origin;
            if (!local) report.blocked.push(event.request.url);
            cdp.send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId: event.requestId } :
                { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
        });
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');
        report.browser=await cdp.send('Browser.getVersion');
        await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
            localStorage.clear();
            localStorage.setItem('baye/libpath', 'libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode', 'classic');
            localStorage.setItem('baye/systemUiMode', 'classic');
            localStorage.setItem('baye/cityMenuMode', 'classic');
        ` });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: castOnly?woodObserverSource:speObserverSource });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        if(castOnly){await loadActualPreparation(cdp);await saveWoodEvidence(cdp);report.nativePixelOracle=verifyWoodCaptures(report,{library:nativeLib,font,assets:servedAssets,artifactDir,allowLcd});report.hdAccepted=!allowLcd;report.scope={accepted:'Actual originally prepared and unmodified native save loaded by public UI, original conscription/distribution/dispatch/MOVE and skill6 full0..7 plus skill7 only0..0; native movie/label/NUM/hold checked independently',notRun:'Other skills, full game/Mod/mobile/performance; natural preparation has a separate executed source and no movie acceptance'};}
        else await smoke(cdp);
        report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');report.speObservations=await evaluate(cdp,'window.__speSamples');report.observerErrors=await evaluate(cdp,'window.__speObserverErrors');assert.deepEqual(report.observerErrors,[]);assert.deepEqual(report.requests.filter(r=>r.status!==200),[],'All private frozen resources load successfully');
        report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');
        report.speObservations=await evaluate(cdp,'window.__speSamples');

        assert.deepEqual(report.exceptions, [], 'browser has no uncaught exceptions');
        assert.deepEqual(report.dialogs, [], 'game boot has no unexpected alert dialogs');
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = error.stack || String(error);
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression);report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');report.speObservations=await evaluate(cdp,'window.__speSamples'); } catch {}
            if(castOnly)try{await saveWoodEvidence(cdp);}catch(e){report.captureEvidenceError=e.stack||String(e);}
            try { report.failureWorld=await evaluate(cdp,campaignWorldExpression);report.observerErrors=await evaluate(cdp,'window.__speObserverErrors'); } catch(e) { report.evidenceError=e.stack||String(e); }
            try {
                const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                fs.writeFileSync(path.join(artifactDir, 'failure.png'), Buffer.from(screenshot.data, 'base64'));
            } catch {}
        }
        console.error(report.error);
        process.exitCode = 1;
    } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        ownership=await ownSnapshot('before-cleanup')||ownership;
        if(cdp)cdp.close();
        if(ownership){try{const proof=await cleanupOwnedChrome(ownership);report.ownedTreeCleanup=persistentCleanup(proof,ownership);}catch(e){report.treeCleanupError=e.stack||String(e);}}
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        report.privateCleanup={chromeExited:!chrome||childExited(chrome),chromeExitCode:chrome?.exitCode??null,chromeSignal:chrome?.signalCode??null,treeExited:!chrome||report.ownedTreeCleanup?.treeExited===true,httpClosed:!server||!server.listening,profileIntentionallyRetained:!!profile,profileExists:!!profile&&fs.existsSync(profile),directoriesDeleted:false};
        // Full OS tree proof is mandatory; the retained profile is intentional evidence.
        if(!report.privateCleanup.treeExited||!report.privateCleanup.httpClosed){report.ok=false;report.cleanupError='Full owned tree or HTTP cleanup not proved; profile retained';process.exitCode=1;}
        const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),exists=fs.existsSync(f),after=exists?sha(fs.readFileSync(f)):null;return {path:name,...m,actualSha256:after,match:exists&&after===m.sha256};});
        const added=productionDirectories.flatMap(dir=>walk(path.join(root,dir))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(name=>!servedAssets.has(name));
        const drift=sources.filter(s=>!s.match),runnerMatch=!!report.tool&&sha(fs.readFileSync(fileURLToPath(import.meta.url)))===report.tool.sha256;
        report.sourceVerification={ok:drift.length===0&&added.length===0&&runnerMatch,count:sources.length,drift,added,runnerMatch,sources};if(!report.sourceVerification.ok){report.ok=false;report.freezeFailure='Frozen source/runner drift, missing file or added production file';process.exitCode=1;}
        report.isolation={...report.isolation,user8080Touched:false,profile:profile||null,cleaned:report.privateCleanup.treeExited&&report.privateCleanup.httpClosed,ownedProcessesExited:report.privateCleanup.treeExited,profileIntentionallyRetained:!!profile,profileExists:!!profile&&fs.existsSync(profile),directoriesDeleted:false};
        writeJsonAtomicSync(path.join(artifactDir,'source-verification.json'),report.sourceVerification);
        writeJsonAtomicSync(path.join(artifactDir,'browser-console.json'),{console:report.console,exceptions:report.exceptions,dialogs:report.dialogs});
        report.finishedAt = new Date().toISOString();
        report.hdAccepted=report.ok===true&&report.hdAccepted===true;
        writeReportAtomicSync(path.join(artifactDir,'result.json'),report);
        console.log('Artifacts:', artifactDir);
        if(report.ok)console.log(preflightOnly?'Readonly frozen source/route preflight passed; no browser or movie acceptance':castOnly?'Both real skills and independent native composition oracle passed; HD status remains explicit':'Actual natural preparation/public native save passed; no movie or HD acceptance');
    }
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
