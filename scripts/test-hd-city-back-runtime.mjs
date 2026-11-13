#!/usr/bin/env node
/**
 * City return real-player acceptance: P4 LiuShan/巴郡31 only.
 * npm run test:city-back-runtime -- --artifact-dir build/r14-city-back-installed-v1
 * Uses private server/profile and original visible UI buttons; no battle or skill cast.
 * Freeze production sources before running; preserve each attempt in a new directory.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staged = process.argv.includes('--staged');
const artifactFlag = process.argv.indexOf('--artifact-dir');
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/r14-city-back-runtime'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream' };
const recruit=true;
const numberArg=(name,fallback,max)=>{const i=process.argv.indexOf(name),text=i<0?String(fallback):process.argv[i+1];assert.ok(/^\d+$/.test(text||''));const value=Number(text);assert.ok(Number.isInteger(value)&&value>0&&value<=max);return value;};
const recruitArms=numberArg('--recruit-arms',800,800);assert.equal(recruitArms,800,'Use the original real money-exhaustion scenario, not manufactured troops');
const period=4,originCity=31,casterPerson=72;
const report={scenario:'city-back',recruit,recruitArms,period,originCity,staged,startedAt:new Date().toISOString(),phases:[],console:[],exceptions:[],dialogs:[],blocked:[],requests:[],inputs:[]};
const servedAssets = new Map();
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const nativeMovies=new Map();let nativeLib;
const targetName=()=>path.relative(root,fileURLToPath(import.meta.url));
const productionDirectories=['js','css','assets','vendor/iBaye/src'];
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(directory,item.name)):[path.join(directory,item.name)]);}
const fnv=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619)>>>0;return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+bytes.length;};
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
function nativePaint(pixels,width,height,picture,x,y,slot=0) {
    const data=picture.data.subarray(slot*picture.planeBytes*(picture.mask+1));
    for(let row=0;row<picture.height;row++)for(let col=0;col<picture.width;col++) {
        const dx=x+col,dy=y+row;if(dx<0||dy<0||dx>=width||dy>=height)continue;
        const offset=row*picture.rowBytes+(col>>3),bit=128>>(col&7),first=!!(data[offset]&bit),ind=dy*width+dx;
        pixels[ind]=picture.mask?(first?pixels[ind]:0)|(data[picture.planeBytes+offset]&bit?255:0):(first?255:0);
    }
}

function freezeAsset(rel) {
    assert.equal(typeof rel,'string');assert.ok(!path.isAbsolute(rel) && !rel.split('/').includes('..'),'Frozen asset path stays in this repository');
    if(servedAssets.has(rel))return servedAssets.get(rel);
    const data=fs.readFileSync(path.join(root,rel)),metadata={source:rel,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
    report.sources[rel]=metadata;servedAssets.set(rel,{data,metadata});return servedAssets.get(rel);
}



function prepareServedAssets() {
 report.sources={};
 for(const dir of productionDirectories)for(const filename of walk(path.join(root,dir)))freezeAsset(path.relative(root,filename).replaceAll('\\','/'));
 freezeAsset('scripts/write-wasm-manifest.mjs');nativeLib=freezeAsset('libs/dat-mod.lib').data;
 assert.equal(report.sources['libs/dat-mod.lib'].sha256,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 report.tool={source:targetName(),sha256:crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')};
 for(const name of ['baye.js','baye.wasm','baye.wasm.map','baye.build.json']){
  const filename=path.join(root,staged?'build/wasm/src':'js',name),data=fs.readFileSync(filename),metadata={source:path.relative(root,filename),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};report.sources[name]=metadata;servedAssets.set('js/'+name,{data,metadata});
 }
 const manifest=JSON.parse(freezeAsset('assets/hd-spe/manifest.json').data.toString('utf8'));
 assert.equal(manifest.libSha256,report.sources['libs/dat-mod.lib'].sha256);assert.equal(manifest.axScale,1);
 for(const e of manifest.entries)for(const p of [...e.pictures,e.background].filter(Boolean))if(p.src)freezeAsset(p.src);
 freezeAsset('pc.html');
 const build=JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));assert.equal(build.hdSpeProtocol.version,2);assert.equal(build.hdSkillResultProtocol.version,1);
 for(const name of ['baye.js','baye.wasm','baye.wasm.map']){assert.equal(report.sources[name].bytes,build.artifacts[name].bytes);assert.equal(report.sources[name].sha256,build.artifacts[name].sha256);}
 const hash=crypto.createHash('sha256'),files=[],tracked=execFileSync('git',['ls-files','-z','vendor/iBaye'],{cwd:root}).toString('utf8').split('\0').filter(Boolean).sort();
 assert.ok(tracked.length>0,'Actual tracked engine sources are enumerated with Git, like the build tool');
 for(const name of tracked){const {data,metadata}=freezeAsset(name);files.push({name,bytes:data.length,sha256:metadata.sha256});hash.update(name+'\0');hash.update(data);}
 report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),manifest:build.engineSourceSha256,files};
 assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256,'The actually served staged/installed engine was built from these exact tracked native bytes');
 report.engineManifest=build;report.viewport=viewport;
 report.freezeScope='All current JS/CSS/assets/native source, all tracked engine files, actual standard LIB, served engine quartet and this runner byte hash. No live user service.';
}

async function startServer() {
    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'pc.html';
            const snapshot = servedAssets.get(rel);
            if (snapshot) {
                report.requests.push({ url: url.pathname, status: 200, ...snapshot.metadata });
                res.writeHead(200, { 'Content-Type': mime[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(snapshot.data);
                return;
            }
            const base = staged && /^js\/baye\.(js|wasm|wasm\.map)$/.test(rel) ? path.join(root, 'build/wasm/src') : root;
            const filename = path.resolve(base, base === root ? rel : path.basename(rel));
            if (!filename.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
            fs.readFile(filename, (err, data) => {
                if (err) { report.requests.push({ url: url.pathname, status: 404 }); res.writeHead(404).end(); return; }
                if (/baye\.(js|wasm|wasm\.map)$/.test(filename) || /\.lib$/.test(filename)) {
                    report.requests.push({ url: url.pathname, status: 200, source: path.relative(root, filename), bytes: data.length });
                }
                res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(data);
            });
        } catch { res.writeHead(400).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return server;
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
    assert.ok(!state.fight?.active,'This validation stays in the original strategy/city input loop');
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


// Presentation wrappers observe original callbacks and deliver only player keys.
// Original opening/LCD callbacks and sendKey are called exactly once.
const speObserverSource='('+function(){
 window.__speSamples=[];window.__speEngineKeys=[];window.__speObserverErrors=[];window.__spePhase='opening';
 let api=null,originalKey=null;
 const snapshot=()=>{try{return window.baye&&baye.hd&&baye.hd.ready()?JSON.parse(JSON.stringify({spe:baye.hd.spe(),menu:baye.hd.menuItems(),march:baye.hd.march()})):null;}catch{return null;}};
 const capture=(stage,before,after)=>{try{
  const s=snapshot();if(!s)return;
  window.__speSamples.push({stage,phase:window.__spePhase,at:performance.now(),spe:s.spe,menu:s.menu,march:s.march,ui:api&&api.debugSnapshot(),callbackBefore:before,callbackAfter:after});
  if(window.__speSamples.length>20000)throw Error('Read-only opening observation limit');
 }catch(e){window.__speObserverErrors.push(String(e));}};
 Object.defineProperty(window,'BayeHdSpe',{configurable:true,get(){return api;},set(value){
  api=value;
  for(const name of ['onEngineSpe','onLcdFlush']){const original=api[name];api[name]=function(){const before=snapshot(),result=original.apply(this,arguments),after=snapshot();capture(name==='onLcdFlush'?'lcd-flush':'lifecycle',before,after);return result;};}
  if(!originalKey&&typeof window.sendKey==='function'){
   originalKey=window.sendKey;window.sendKey=function(code){
    const s=snapshot();window.__speEngineKeys.push({code,at:performance.now(),phase:window.__spePhase,generation:s&&s.spe.generation,eventId:s&&s.spe.eventId,kind:s&&s.spe.kind,speActive:s&&s.spe.active,menu:s&&s.menu,march:s&&s.march});
    return originalKey.apply(this,arguments);
   };
  }
 }});
}.toString()+')();';

function assertDisplayRecords(records) {
    assert.ok(Array.isArray(records), 'Real SPE observations were captured');
    const displayed = records.filter(r => r.stage === 'lcd-flush' && r.spe.active &&
        r.spe.protocolVersion === 2 && r.spe.display.frameValid);
    for (const record of displayed) {
        const s = record.spe, d = s.display;
        assert.equal(d.generation, s.generation, 'Flushed generation matches its live event');
        assert.equal(d.eventId, s.eventId, 'Flushed event matches its live scope');
        assert.ok(Number.isInteger(d.commitSeq) && d.commitSeq > 0 && d.commitSeq <= s.commitSeq,
            'Displayed commit is an actual copied native commit');
        assert.ok(d.frameIndex >= s.startFrm && d.frameIndex <= s.endFrm, 'Displayed logical frame is in the actual interval');
        assert.equal(d.visibleFrames.length, 32);
        assert.ok(d.visibleFrames.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'Actual visible bitmap contains bytes');
        const frames = [];
        for (let i = 0; i < 256; i++) {
            if (d.visibleFrames[i >> 3] & (1 << (i & 7))) {
                assert.ok(i >= s.startFrm && i <= d.frameIndex && i <= s.endFrm && i < s.count,
                    'Only introduced in-range native picture units are visible');
                frames.push(i);
            }
        }
        if (record.ui.source === 'hd-assets') {
            assert.deepEqual(record.ui.displayedFrames, frames, 'HD slots exactly follow the flushed native bitmap');
        }
    }
    return displayed;
}

async function collectSpe(cdp) {
    const evidence = await evaluate(cdp, '({samples:window.__speSamples,keys:window.__speEngineKeys,errors:window.__speObserverErrors})');
    assert.deepEqual(evidence.errors, [], 'Read-only observer has no errors');
    assertDisplayRecords(evidence.samples);
    return evidence;
}

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
async function observeCity(cdp,stage,cityIndex){
 const expression="({generation:Number(baye.data.g_hdSpeGeneration),march:baye.hd.march(),keys:window.__speEngineKeys.length})",before=await evaluate(cdp,expression),world=await evaluate(cdp,recruitWorldExpression(cityIndex)),after=await evaluate(cdp,expression);
 assert.deepEqual(after,before,'Readonly current city money/reserve/queue reads preserve native generation, owner and inputs');assert.ok(Number.isInteger(world.money)&&world.money>=0&&Number.isInteger(world.reserve)&&world.reserve>=0);assert.equal(world.personQueue.length,world.personCount);assert.deepEqual(world.persons.map(p=>p.personIndex),world.personQueue);
 report.cityObservations??=[];const observation={stage,before,after,world};report.cityObservations.push(observation);return observation;
}
async function smoke(cdp) {
    await waitFor(cdp, 'SPE v2 ready', 'window.baye && baye.hd && baye.hd.ready() && baye.hd.spe().protocolVersion === 2', 60000);
    await observeActualLib(cdp,'startup');
    await waitFor(cdp, 'at least three actual opening display commits', "(() => { const s=baye.hd.spe(),r=window.__speSamples.filter(r=>r.stage==='lcd-flush'&&r.spe.generation===s.generation&&r.spe.eventId===s.eventId&&r.spe.display.frameValid); return s.active&&s.id===3&&s.kind===1&&new Set(r.map(r=>r.spe.display.commitSeq)).size>=3&&new Set(r.map(r=>r.spe.display.frameIndex)).size>=2; })()", 20000);
    const opening = await evaluate(cdp, 'baye.hd.spe()');
    const evidence = await collectSpe(cdp);
    const frames = evidence.samples.filter(r => r.stage === 'lcd-flush' && r.spe.eventId === opening.eventId && r.spe.display.frameValid);
    assert.ok(new Set(frames.map(r => r.spe.display.commitSeq)).size >= 3, 'Opening has multiple actual displayed commits');
    assert.ok(new Set(frames.map(r => r.spe.display.frameIndex)).size >= 2, 'Opening shows multiple native logical frames');
    assert.equal(opening.skipEligible, true, 'Native opening really accepts a player skip');
    assert.ok(frames.every(r=>r.ui.open&&r.ui.skipVisible),'Actual displayed opening exposes the HD player skip');
    report.opening = { eventId: opening.eventId, generation: opening.generation, displayedCommits: frames.length };
    await checkpoint(cdp, '01-native-opening-frames');
    await click(cdp, '#hd-spe-skip');
    await waitFor(cdp, 'native opening key termination', 'window.__speSamples.some(r=>r.spe.lastEnd.eventId===' + opening.eventId + "&&r.spe.lastEnd.reason==='key'&&r.spe.lastEnd.key===39)");
    const skipped = await collectSpe(cdp);
    const keys = skipped.keys.filter(k => k.generation === opening.generation && k.eventId === opening.eventId);
    assert.deepEqual(keys.map(k => k.code), [0x27], 'One player skip delivers exactly one native Enter');
    await waitFor(cdp, 'opening overlay retired', 'baye.hd.spe().eventId!==' + opening.eventId + ' && !BayeHdSpe.isOpen()');
    report.opening.skip = keys;
    await checkpoint(cdp, '02-opening-ended-cleanly');
    await evaluate(cdp, "BayeHdSystemUi.setMode('classic');window.__spePhase='menus';");
    await waitFor(cdp, 'actual title picture', 'window.__speSamples.some(r=>r.spe.id===100)', 20000);
    await key(cdp, 'Enter');
    await waitFor(cdp, 'actual period picture', 'window.__speSamples.some(r=>r.spe.id===104)');
    for(let i=1;i<period;i++)await key(cdp,'ArrowDown');
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real period4 lord selection', 'Number(baye.data.g_PIdx)===4 && baye.hd.kings().count>0');
    const lord = await evaluate(cdp, "(() => {const m=baye.hd.kings();return {target:m.kings.findIndex(k=>k.id===1&&k.name==='刘禅'),index:m.index,kings:m.kings};})()");
    assert.ok(lord.target >= 0, 'Actual period4 contains LiuShan ID1');
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'native lord highlight', 'baye.hd.kings().index===' + lord.target);
    report.selectedLord = lord.kings[lord.target];assert.equal(report.selectedLord.id,1);
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', 'baye.hd.march().pick && baye.hd.realm().ownedCount>0');
    await checkpoint(cdp, '03-real-map');
    await observeActualLib(cdp,'strategy-map');
    await cityBackSmoke(cdp);
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
        const persons=ids.map(id=>{if(!Number.isInteger(id)||id<0||id>=count)throw Error('Invalid native PersonQueue ID');const p=d.g_Persons[id];return {personIndex:id,nativeGenId:id+1,name:baye.getPersonName(id),belong:Number(p.Belong),arms:Number(p.Arms),thew:Number(p.Thew),armType:baye.hd.personArmType(id)};});
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

// Runtime fragment for the real Stone driver; the builder embeds these helpers.
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

async function recruitSmoke(cdp,cityIndex) {
    const inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    await click(cdp,'#hd-city-menu [data-hd-sub="1"]');
    const picker=await currentPersonPicker(cdp,'征兵',cityIndex),before=await evaluate(cdp,recruitWorldExpression(cityIndex));
    const allowed=before.persons.filter(p=>picker.menu.ids.includes(p.personIndex)),actor=allowed.find(p=>p.personIndex!==before.playerKing&&p.personIndex===casterPerson);
    assert.ok(actor,'The actual resident caster is chosen by its native person ID');
    const recruiter=allowed.slice().reverse().find(p=>p.personIndex!==actor.personIndex&&p.personIndex!==before.playerKing);
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
        const previous=enlisted,current=await currentPersonPicker(cdp,'征兵',cityIndex),candidate=previous.persons.slice().reverse().find(p=>p.personIndex!==actor.personIndex&&p.personIndex!==before.playerKing&&current.menu.ids.includes(p.personIndex));
        assert.ok(candidate,'Another actual resident must perform an additional bounded order');
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
    report.recruitment={cityIndex,requestedArms:recruitArms,expectedCasterPerson:casterPerson,actualCasterArmType:actor.armType,recruiter,actor,casterNativeGenId:actor.nativeGenId,before,chosen,quantity,confirmation,enlistments,enlisted,enlistRetirement,distribute,distribution,distributionConfirmation,distributionOutcome,equipped,nativeInputs:await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`),scope:'Original bounded conscription into actual city reserve followed by original distribution to current caster person72/native73. Exact IDs, money, orders, queues and receipts are recorded; no world setters, automatic time advance or artificial troops.'};
    await checkpoint(cdp,'06b-real-distributed-caster-troops');
    report.recruitment.distributionRetirement=await reopenMilitaryAfterPersonPicker(cdp,cityIndex,'分配');
}

function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
// Embedded into the ignored R14 driver. Every input below is a real DOM click.
const preservedCityFields=['cityIndex','belong','playerKing','money','reserve','armsPerMoney','persons','orders','date','personQueueOffset','personCount','personQueue'];
function assertCityPreserved(before,after,label){for(const field of preservedCityFields)assert.deepEqual(after[field],before[field],label+' preserves '+field);}
const returnStateExpression=`(() => {
 const menu=baye.hd.menuItems(),qty=baye.hd.qty(),report=baye.hd.report(),march=baye.hd.march(),city=BayeHdCityMenu.debugSnapshot(),map=BayeHdOverworld.debugSnapshot();
 const p=baye.data.g_CityPos,cursor={setx:Number(p.setx),sety:Number(p.sety),x:Number(p.x),y:Number(p.y)};
 return {generation:Number(baye.data.g_hdSpeGeneration),menu,qty,report,march,city,cursor,
   map:{phase:map.phase,functionMenu:map.functionMenu,mapCity:map.mapCity},
   functionMenu:!!(menu.active&&menu.context===2),keys:window.__speEngineKeys.length,
   nativeMap:!menu.active&&!qty.active&&!report.active&&march.pick===1&&march.battlePick===0&&march.phase===0&&map.phase==='map'&&!city.sending&&city.queueLen===0};
})()`;
async function readReturnState(cdp,label){
 const before=await evaluate(cdp,returnStateExpression),world=(await observeCity(cdp,label,originCity)).world,after=await evaluate(cdp,returnStateExpression);
 assert.equal(after.generation,before.generation,label+' keeps the native generation current');
 assert.equal(after.keys,before.keys,label+' is read-only');
 assert.deepEqual(after.menu,before.menu,label+' keeps the current native menu owner');
 assert.deepEqual(after.march,before.march,label+' keeps the native map/march owner');
 assert.deepEqual(after.cursor,before.cursor,label+' read keeps actual cursor and viewport');
 assert.ok(Object.values(after.cursor).every(v=>Number.isInteger(v)&&v>=0&&v<=255),label+' requires actual native position fields');
 return {...after,world};
}
async function installMenuReadObserver(cdp){
 await evaluate(cdp,`(() => {
  if(window.__cityBackMenuObserverInstalled)throw Error('Menu observer already installed');
  window.__cityBackMenuObserverInstalled=true;window.__cityBackMenuReads=[];
  const original=baye.hd.menuItems;let last='';
  baye.hd.menuItems=function(){
   const value=original.apply(this,arguments),key=JSON.stringify(value);
   if(key!==last){last=key;window.__cityBackMenuReads.push({at:performance.now(),value:JSON.parse(key)});}
   return value;
  };
  return true;
 })()`);
}
async function freshOwnedCity(cdp,label,beforeWorld){
 const before=await evaluate(cdp,returnStateExpression);assert.ok(before.nativeMap,label+' begins at the actual map');
 assert.equal(before.city.open,false,label+' has no old HD shell');
 assert.ok(await action(cdp,label+' real city entry',`BayeHdOverworld.walkToCity(${originCity})`));
 const owner=await waitFor(cdp,label+' fresh city root',`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();return s.open&&s.layer==='root'&&s.cityIndex===31&&m.active&&m.context===1&&m.kind===1&&!s.sending&&!s.queueLen&&{menu:m,city:s};})()`);
 assert.ok(Number.isInteger(owner.menu.seq)&&owner.menu.seq>before.menu.seq,label+' has a new actual native menu sequence');
 const after=await readReturnState(cdp,label+' read after entry');assert.equal(after.generation,before.generation);
 if(beforeWorld)assertCityPreserved(beforeWorld,after.world,label+' city re-entry');
 assert.equal(after.world.belong,after.world.playerKing+1,'Actual city belongs to the current player');
 return {before,owner,after};
}
async function openMilitary(cdp,label){
 await click(cdp,'#hd-city-menu [data-hd-root="2"]');
 const owner=await waitFor(cdp,label+' real military submenu',"(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return s.open&&s.layer==='sub'&&s.cityIndex===31&&m.active&&m.context===1&&m.kind===2&&m.names[0]==='侦察'&&!s.sending&&!s.queueLen&&{menu:m,city:s};})()");
 return owner;
}
async function pressBackWithOwner(cdp,label,expectedCodes,expectedAfter){
 const before=await readReturnState(cdp,label+' before'),menuReadStart=await evaluate(cdp,'window.__cityBackMenuReads.length');
 assert.equal(before.functionMenu,false);assert.equal(before.map.functionMenu,false);
 const check={label,before,expectedCodes,menuReadStart,method:'Actual visible #hd-city-menu [data-hd-menu-back] mouse press/release; no public close or native setter'};
 report.returnChecks??=[];report.returnChecks.push(check);
 await click(cdp,'#hd-city-menu [data-hd-menu-back]');
 await waitFor(cdp,label+' native owner/UI retirement',expectedAfter);
 // Catch queued duplicate EXIT after the first ACK without introducing input.
 await delay(450);
 const after=await readReturnState(cdp,label+' after'),keys=await evaluate(cdp,`window.__speEngineKeys.slice(${before.keys})`),menuReads=await evaluate(cdp,`window.__cityBackMenuReads.slice(${menuReadStart})`);
 Object.assign(check,{after,keys,menuReads});
 assert.deepEqual(keys.map(k=>k.code),expectedCodes,label+' has exactly the original native input count');
 assert.equal(after.generation,before.generation,label+' stays in the same native generation');
 assert.deepEqual(after.cursor,before.cursor,label+' preserves the actual native cursor and viewport');
 assert.equal(after.functionMenu,false);assert.equal(after.map.functionMenu,false);
 assert.ok(menuReads.every(r=>!(r.value.active&&r.value.context===2)),label+' observes no native FunctionMenu');
 assertCityPreserved(before.world,after.world,label);
 return check;
}
const retiredCityMapExpression=`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),q=baye.hd.qty(),r=baye.hd.report(),w=baye.hd.march(),map=BayeHdOverworld.debugSnapshot();return !s.open&&!s.sending&&!s.queueLen&&!m.active&&!q.active&&!r.active&&w.pick===1&&w.battlePick===0&&w.phase===0&&map.phase==='map'&&!map.functionMenu;})()`;
async function reopenMilitaryAfterPersonPicker(cdp,cityIndex,label){
 assert.equal(cityIndex,originCity);
 const outcome=await waitPersonPickerOrNativeMap(cdp,label,cityIndex),fresh=await readReturnState(cdp,label+' current native return owner');
 assert.deepEqual(fresh.menu,outcome.menu,'Back uses the still-current original native menu owner');
 if(outcome.mode==='native-map'){
  assert.equal(label,'征兵');assert.ok(fresh.nativeMap);assert.equal(fresh.world.money,0);
  assert.equal(fresh.city.open,true);assert.equal(fresh.city.layer,'deep');assert.equal(fresh.city.deepLabel,'征兵');
  assert.equal(fresh.city.deepItems.length,0,'The actual stale empty conscription pane is visible before the user back');
  await checkpoint(cdp,'07-exhausted-native-map-stale-conscription-before-back');
 }else{
  const picker=await currentPersonPicker(cdp,label,cityIndex);assert.deepEqual(picker.menu,fresh.menu);
  assert.ok(picker.menu.ids.length>0);assert.ok(picker.city.deepMenuOwner);
  await checkpoint(cdp,'10-active-native-distribution-picker-before-back');
 }
 const check=await pressBackWithOwner(cdp,label+' user back',outcome.mode==='native-map'?[]:[0x28],retiredCityMapExpression);
 check.outcome=outcome;
 assert.ok(check.after.nativeMap);assert.equal(check.after.city.open,false);
 if(outcome.mode==='native-map')assert.deepEqual(check.after.march,check.before.march,'Retiring the old shell does not change native map/march fields');
 await checkpoint(cdp,outcome.mode==='native-map'?'08-stale-conscription-user-back-zero-keys':'11-active-person-picker-back-one-exit');
 const reentry=await freshOwnedCity(cdp,label+' re-entry',check.after.world),military=await openMilitary(cdp,label+' re-entry');
 check.reentry=reentry;check.military=military;
 assertCityPreserved(check.before.world,(await readReturnState(cdp,label+' military re-entry facts')).world,label+' military re-entry');
 return check;
}
async function cityBackSmoke(cdp){
 await installMenuReadObserver(cdp);
 await evaluate(cdp,"BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd');window.__spePhase='city-back';");
 const owned=await waitFor(cdp,'actual owned 巴郡31 map',"(() => {const m=BayeHdOverworld.debugSnapshot();return m.phase==='map'&&m.owned.find(c=>c.i===31&&c.name==='巴郡');})()");assert.equal(owned.i,originCity);
 const before=await readReturnState(cdp,'initial actual 巴郡 facts');
 assert.equal(before.world.money,59,'The genuine P4 initial financial baseline is observed');assert.equal(before.world.reserve,0);
 report.initialCity=before;
 await freshOwnedCity(cdp,'initial 巴郡',before.world);await checkpoint(cdp,'04-current-native-city-root');
 await openMilitary(cdp,'initial 巴郡');await checkpoint(cdp,'05-current-native-military-submenu');
 await recruitSmoke(cdp,originCity);
 assert.equal(report.recruitment.quantity.wanted,590);assert.equal(report.recruitment.enlisted.money,0);assert.equal(report.recruitment.enlisted.reserve,590);
 assert.equal(report.recruitment.distribution.wanted,690);assert.equal(report.recruitment.equipped.persons.find(p=>p.personIndex===casterPerson).arms,690);
 await checkpoint(cdp,'12-distribution-back-fresh-military-submenu');
 await pressBackWithOwner(cdp,'military submenu back',[0x28],"(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();return s.open&&s.layer==='root'&&s.cityIndex===31&&m.active&&m.context===1&&m.kind===1&&!s.sending&&!s.queueLen;})()");
 await checkpoint(cdp,'13-military-submenu-back-current-root');
 await pressBackWithOwner(cdp,'current city root back',[0x28],retiredCityMapExpression);
 await checkpoint(cdp,'14-current-root-back-native-map');
 const map=await readReturnState(cdp,'final original map');assert.ok(map.nativeMap);assert.equal(map.city.open,false);
 const lastEntry=await freshOwnedCity(cdp,'final user re-entry',map.world);report.finalCityReentry=lastEntry;
 await checkpoint(cdp,'15-final-fresh-native-root-reentry');
 await pressBackWithOwner(cdp,'final city root back',[0x28],retiredCityMapExpression);
 report.finalCity=await readReturnState(cdp,'final retired original city menu');
 await checkpoint(cdp,'16-final-native-map-owner');
 report.scope={accepted:'One actual P4 LiuShan/巴郡31 private game: native money exhaustion, visible stale conscription pane user back zero keys, original distribution person picker user back one EXIT, original submenu/root return and new native city entry. Exact current IDs/money/reserve/orders/queue/date are preserved across return.',notRun:'No battle, skill cast, RNG, seeded state, Mod scenario, touchscreen, general menu completeness or performance claim.'};
 report.hdAccepted=false;
}
async function saveCityEvidence(cdp){
 const raw=await evaluate(cdp,'({keys:window.__speEngineKeys,menuReads:window.__cityBackMenuReads||[],samples:window.__speSamples,errors:window.__speObserverErrors})');
 report.engineInputs=raw.keys;report.nativeMenuReads=raw.menuReads;report.speObservations=raw.samples;report.observerErrors=raw.errors;
 for(const[name,data]of[['engine-inputs',raw.keys],['native-menu-reads',raw.menuReads],['spe-observations',raw.samples],['observer-errors',raw.errors]])fs.writeFileSync(path.join(artifactDir,name+'.json'),JSON.stringify(data,null,2)+'\n');
}
function verifyCityBackEvidence(){
 assert.deepEqual(report.observerErrors,[]);assert.equal(report.returnChecks.length,5);
 assert.deepEqual(report.returnChecks.map(c=>c.keys.map(k=>k.code)),[[],[0x28],[0x28],[0x28],[0x28]]);
 assert.ok(report.returnChecks.every(c=>c.after&&!c.after.functionMenu&&!c.after.map.functionMenu));
 assert.ok(report.nativeMenuReads.every(r=>!(r.value.active&&r.value.context===2)),'No native FunctionMenu is observed during the whole city-only flow');
 assert.equal(report.finalCity.city.open,false);assert.ok(report.finalCity.nativeMap);
 assertCityPreserved(report.recruitment.equipped,report.finalCity.world,'All later returns and re-entry');
}

async function main() {
    assert.ok(!fs.existsSync(path.join(artifactDir,'result.json')),'Use a fresh artifact directory; prior success/failure evidence is preserved');
    fs.mkdirSync(artifactDir, { recursive: true });
    let server, chrome, cdp, chromeError, profile;
    const interrupt = () => {
        report.interrupted = true;
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) chrome.kill('SIGTERM');
        if (server) server.closeAllConnections();
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
        prepareServedAssets();
        assert.equal(typeof WebSocket,'function','Node 22+ built-in WebSocket is available');
        console.log('Frozen',Object.keys(report.sources).length,'sources; native',report.nativeSourceCheck.aggregate,'; runner',report.tool.sha256);
        profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-city-back-runtime-'));
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
            '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
        report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};
        chrome.on('error', (error) => { chromeError = error; });
        let target;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (chromeError) throw chromeError;
            if (chrome.exitCode !== null) throw new Error('Chrome exited with ' + chrome.exitCode);
            try {
                const list = await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) }).then((res) => res.json());
                target = list.find((item) => item.type === 'page');
                if (target) break;
            } catch {}
            await delay(100);
        }
        assert.ok(target, 'Chrome DevTools started');
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
            localStorage.setItem('baye/systemUiMode', 'hd');
            localStorage.setItem('baye/cityMenuMode', 'classic');
        ` });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: speObserverSource });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        await smoke(cdp);
        await saveCityEvidence(cdp);verifyCityBackEvidence();
        report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');
        report.speObservations=await evaluate(cdp,'window.__speSamples');
        assertDisplayRecords(report.speObservations);
        assert.deepEqual(report.exceptions, [], 'browser has no uncaught exceptions');
        assert.deepEqual(report.dialogs, [], 'game boot has no unexpected alert dialogs');
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = error.stack || String(error);
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression);report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');report.speObservations=await evaluate(cdp,'window.__speSamples'); } catch {}
            try { await saveCityEvidence(cdp); } catch(e) { report.evidenceError=e.stack||String(e); }
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
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) {
            const stopped = new Promise((resolve) => chrome.once('exit', resolve));
            chrome.kill('SIGTERM');
            await Promise.race([stopped, delay(1500)]);
            if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([stopped, delay(1500)]); }
        }
        if (server) await new Promise((resolve) => server.close(resolve));
        if(profile){assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));assert.ok(path.basename(profile).startsWith('baye-city-back-runtime-'));try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(e){report.ok=false;report.cleanupError=e.stack||String(e);process.exitCode=1;}}
        const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),exists=fs.existsSync(f),after=exists?sha(fs.readFileSync(f)):null;return {path:name,...m,actualSha256:after,match:exists&&after===m.sha256};});
        const added=productionDirectories.flatMap(dir=>walk(path.join(root,dir))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(name=>!servedAssets.has(name));
        const drift=sources.filter(s=>!s.match),runnerMatch=!!report.tool&&sha(fs.readFileSync(fileURLToPath(import.meta.url)))===report.tool.sha256;
        report.sourceVerification={ok:drift.length===0&&added.length===0&&runnerMatch,count:sources.length,drift,added,runnerMatch,sources};if(!report.sourceVerification.ok){report.ok=false;report.freezeFailure='Frozen source/runner drift, missing file or added production file';process.exitCode=1;}
        report.isolation={...report.isolation,user8080Touched:false,profile:profile||null,cleaned:!profile||!fs.existsSync(profile)};
        fs.writeFileSync(path.join(artifactDir,'source-verification.json'),JSON.stringify(report.sourceVerification,null,2)+'\n');
        fs.writeFileSync(path.join(artifactDir,'browser-console.json'),JSON.stringify({console:report.console,exceptions:report.exceptions,dialogs:report.dialogs},null,2)+'\n');
        report.finishedAt = new Date().toISOString();
        report.hdAccepted=report.ok===true&&report.hdAccepted===true;
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Actual city back/native ownership/world preservation passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
