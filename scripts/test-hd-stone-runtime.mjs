#!/usr/bin/env node
/**
 * STONE42/skill23 real-player validation driver: P4 LiuShan, BaJun31 to WuLing32.
 * --baseline-only observes actual caster/skill menu without casting; --allow-lcd casts without claiming HD.
 * Default requires full160x96 LCD with the authenticated64x64@48,16 STONE window.
 * --720, --classic and --missing-assets select independent cases; --preflight-only launches no browser.
 * State6/MP20/unchanged target arms+move and real state report are required; no NUM/HOLD branch.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-stone-runtime.mjs --staged --recruit
 *   node scripts/test-hd-stone-runtime.mjs --recruit --artifact-dir build/stone-runtime
 * --staged serves build/wasm/src/baye.{js,wasm,wasm.map} without replacing js/.
 * Uses a retained private browser profile and verified owned-tree cleanup; never edits game assets.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {snapshotOwnedChrome,cleanupOwnedChrome} from './hd-runtime-owned-chrome.mjs';
import {writeJsonAtomicSync} from './hd-runtime-json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedFlags=new Set(['--staged','--720','--classic','--missing-assets','--preflight-only','--recruit','--baseline-only','--allow-lcd']);
const seenFlags=new Set();
for(let i=2;i<process.argv.length;i++){
 const flag=process.argv[i];assert.ok(!seenFlags.has(flag),'Duplicate option: '+flag);seenFlags.add(flag);
 if(['--artifact-dir','--recruit-arms','--max-turns'].includes(flag)){assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing '+flag+' value');i++;}
 else assert.ok(allowedFlags.has(flag),'Unknown option: '+flag);
}
const staged=seenFlags.has('--staged'),classic=seenFlags.has('--classic'),missingAssets=seenFlags.has('--missing-assets'),preflightOnly=seenFlags.has('--preflight-only');
assert.ok(!(classic&&missingAssets),'Choose classic or missing-assets independently');
const recruit=seenFlags.has('--recruit'),baselineOnly=seenFlags.has('--baseline-only'),allowLcd=seenFlags.has('--allow-lcd')||classic||missingAssets;
assert.ok(!baselineOnly||!classic&&!missingAssets&&!seenFlags.has('--allow-lcd'),'Baseline-only is independent of cast matrix options');
const numberArg=(name,fallback,max)=>{const i=process.argv.indexOf(name),text=i<0?String(fallback):process.argv[i+1];assert.ok(/^\d+$/.test(text||''),'Invalid '+name);const value=Number(text);assert.ok(Number.isInteger(value)&&value>0&&value<=max,'Out of range '+name);return value;};
const recruitArms=numberArg('--recruit-arms',800,65535),maxTurns=numberArg('--max-turns',4,20);
assert.ok(!seenFlags.has('--recruit-arms')||recruit,'Custom troop request requires real recruitment');
const period=4,originCity=31,destination=32,casterPerson=72,casterNativeId=73,skillId=23,speId=42;
const artifactFlag=process.argv.indexOf('--artifact-dir');
const artifactDir=path.resolve(artifactFlag>=0?process.argv[artifactFlag+1]:path.join(root,'build/stone-runtime'));
assert.ok(artifactDir.startsWith(path.join(root,'build')+path.sep),'Evidence must use a fresh subdirectory of this repository build/');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream', '.ttf':'font/ttf', '.woff':'font/woff', '.woff2':'font/woff2' };
const report = { baselineOnly,allowLcd,recruit,recruitArms,maxTurns,period,originCity,destination,casterPerson,skillId,speId,staged, classic, missingAssets, preflightOnly, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const servedAssets = new Map();
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const nativeMovies=new Map();let nativeLib,stoneEntry;
const requestedActor=p=>p.personIndex===casterPerson;
// Persistent evidence contains command lines only for independently verified owned processes.
const identity = p => ({ProcessId:p.ProcessId, ParentProcessId:p.ParentProcessId,
  CreationDate:p.CreationDate, ExecutablePath:p.ExecutablePath});
function persistOwnership(s, sameRoot) {
  return {schemaVersion:s.schemaVersion,rootPid:s.rootPid,profile:s.profile,sampledAt:s.sampledAt,
    rootVerified:s.rootVerified && sameRoot,sameRoot,owned:sameRoot && s.rootVerified ? s.owned : [],
    excludedIdentities:s.excluded.map(identity),profileMatchIdentities:s.profileMatches.map(identity)};
}
function persistCleanup(p, basis) {
  const recorded = q => basis.owned.some(o => o.ProcessId===q.ProcessId && o.CreationDate===q.CreationDate &&
    o.ExecutablePath===q.ExecutablePath && o.CommandLine===q.CommandLine);
  return {schemaVersion:p.schemaVersion,rootPid:p.rootPid,profile:p.profile,treeExited:p.treeExited,
    directoriesDeleted:p.directoriesDeleted,errors:p.errors,stopEvents:p.stopEvents,recordedOwned:basis.owned,
    samples:p.samples.map(s=>({stage:s.stage,sampledAt:s.sampledAt,owned:s.processes.filter(recorded),
      unrelatedCount:s.processes.filter(q=>!recorded(q)).length})),
    recheck:p.recheck && {targets:p.recheck.targets.map(identity),absent:p.recheck.absent.map(identity),
      refused:p.recheck.refused.map(q=>({recorded:identity(q.recorded),current:identity(q.current),reason:q.reason}))},
    exitVerification:p.exitVerification && {treeExited:p.exitVerification.treeExited,
      survivingRecorded:p.exitVerification.survivingRecorded.map(identity),
      rootDescendants:p.exitVerification.rootDescendants.map(identity),profileMatches:p.exitVerification.profileMatches.map(identity)}};
}
let sampleOwned=async()=>{};
function writeEvidencePng(name,data){const filename=path.join(artifactDir,name);if(fs.existsSync(filename))assert.deepEqual(fs.readFileSync(filename),data,'Existing evidence PNG must be byte-identical');else fs.writeFileSync(filename,data,{flag:'wx'});}
function childExited(child){return child.exitCode!==null||child.signalCode!==null;}
async function readCdpTargets(port){return new Promise((resolve,reject)=>{const req=http.get('http://127.0.0.1:'+port+'/json/list',res=>{let body='';res.setEncoding('utf8');res.on('data',part=>{body+=part;if(body.length>1024*1024)req.destroy(Error('CDP endpoint bound exceeded'));});res.on('end',()=>{try{assert.equal(res.statusCode,200);const list=JSON.parse(body);assert.ok(Array.isArray(list));resolve(list);}catch(e){reject(e);}});});req.setTimeout(1000,()=>req.destroy(Error('CDP endpoint timeout')));req.on('error',reject);});}

const targetName=()=>path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/');
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
 for(const name of ['scripts/write-wasm-manifest.mjs',targetName(),'scripts/hd-runtime-owned-chrome.mjs','scripts/hd-runtime-json.mjs'])freezeAsset(name);nativeLib=freezeAsset('libs/dat-mod.lib').data;
 assert.equal(report.sources['libs/dat-mod.lib'].sha256,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 report.tool={source:targetName(),sha256:crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')};
 for(const name of ['baye.js','baye.wasm','baye.wasm.map','baye.build.json']){
  const filename=path.join(root,staged?'build/wasm/src':'js',name),data=fs.readFileSync(filename),metadata={source:path.relative(root,filename),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};report.sources[name]=metadata;servedAssets.set('js/'+name,{data,metadata});
 }
 const manifest=JSON.parse(freezeAsset('assets/hd-spe/manifest.json').data.toString('utf8'));
 assert.equal(manifest.libSha256,report.sources['libs/dat-mod.lib'].sha256);assert.equal(manifest.axScale,1);
 for(const e of manifest.entries)for(const p of [...e.pictures,e.background].filter(Boolean))if(p.src)freezeAsset(p.src);
 for(const rel of ['pc.html','qr.png','fonts/HarmonyOS_Sans_SC_Regular.ttf','favicon.png'])freezeAsset(rel);const entries=manifest.entries.filter(e=>e.speId===42&&e.kind===2&&e.resourceIndex===0&&e.startFrm===0&&e.endFrm===7&&e.stoneVersion===1);assert.equal(entries.length,1,'Exactly one independently authenticated STONE23 entry');stoneEntry=entries[0];assert.equal(stoneEntry.opaqueCoverageVersion,1);assert.equal(stoneEntry.skillId,23);
 const movie=nativeMovie(42);assert.deepEqual([movie.count,movie.picmax,movie.start,movie.end,movie.length,movie.fingerprint],[8,2,0,7,1084,'fnv1a32:0e6f8d97:1084']);
 assert.ok(movie.units.every((u,i)=>u.x===0&&u.y===0&&u.cdelay===20&&u.ndelay===20&&u.picIndex===i%2));assert.ok(movie.pictures.every(p=>p.width===64&&p.height===64&&p.mask===0));
 if(!baselineOnly&&!allowLcd)assert.ok(stoneEntry,'Strict actual HD test awaits published, authenticated STONE42 entry; missing art is not HD completion');
 if(stoneEntry){assert.equal(stoneEntry.resourceFingerprint,movie.fingerprint);assert.equal(stoneEntry.resourceLength,movie.length);assert.equal(stoneEntry.count,8);assert.equal(stoneEntry.picmax,2);
  assert.equal(stoneEntry.units.length,8);assert.equal(stoneEntry.pictures.length,2);
  stoneEntry.units.forEach((u,i)=>{const r=movie.units[i];assert.deepEqual({frame:u.frame,x:u.x,y:u.y,picIndex:u.picIndex},{frame:i,x:r.x,y:r.y,picIndex:r.picIndex});});
  stoneEntry.pictures.forEach((p,i)=>{const r=movie.pictures[i],png=servedAssets.get(p.src).data;assert.equal(p.picIndex,i);assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[r.width,r.height,r.width,r.height,r.mask]);assert.equal(png.readUInt32BE(16),p.width);assert.equal(png.readUInt32BE(20),p.height);});
 }
 const nameBytes=nativeItem(11,22),special=nativeItem(14,3),skillRecord=nativeItem(10).subarray(22*34,23*34),casterNameBytes=nativeItem(72,casterPerson);assert.equal(special.readUInt16LE(casterPerson*2),23);assert.equal(skillRecord.toString('hex'),'00060000000014646464640050506464000000646464646464646464505050505050');assert.equal(nameBytes.toString('hex'),"caafd5f3");
  const decode=bytes=>new TextDecoder('gbk',{fatal:true}).decode(bytes.subarray(0,bytes.indexOf(0)<0?bytes.length:bytes.indexOf(0)));assert.equal(decode(casterNameBytes),'诸葛亮');
 report.stoneNativeResource={id:42,index:0,start:0,end:7,count:8,picmax:2,length:movie.length,fingerprint:movie.fingerprint,units:movie.units,pictures:movie.pictures.map((p,i)=>({picIndex:i,width:p.width,height:p.height,mask:p.mask})),
  actualSkillName:{resourceId:11,itemIndex:22,bytes:nameBytes.length,hex:nameBytes.toString('hex'),name:new TextDecoder('gbk',{fatal:true}).decode(nameBytes)},
  actualSpecialSkill:{resourceId:14,itemIndex:3,period:4,personIndex:72,elementBytes:2,offset:144,skillId:special.readUInt16LE(144)},
   actualSkill:{resourceId:10,index:22,recordBytes:34,hex:skillRecord.toString('hex'),aim:0,state:6,power:0,destroy:0,useMp:20},
   casterName:{resourceId:72,itemIndex:casterPerson,period:4,personIndex:casterPerson,hex:casterNameBytes.toString('hex'),name:decode(casterNameBytes),source:'GetPersonName P4 GENERAL_NAME4'}};
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
 const missing=new Set(missingAssets?stoneEntry.pictures.map(p=>p.src):[]);
 const server=http.createServer((req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'pc.html';
   if(missing.has(rel)){report.requests.push({url:url.pathname,status:404,expected:true,reason:'requested STONE asset fallback',source:rel});res.writeHead(404,{'Cache-Control':'no-store'}).end();return;}
   const snapshot=servedAssets.get(rel);
   if(!snapshot){report.requests.push({url:url.pathname,status:404,expected:false,reason:'not in frozen source allowlist'});res.writeHead(404,{'Cache-Control':'no-store'}).end();return;}
   report.requests.push({url:url.pathname,status:200,...snapshot.metadata});
   res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(snapshot.data);
  }catch{res.writeHead(400).end();}
 });
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
    if (state.fight?.active) state.rawBattle = await evaluate(cdp, battleStateExpression);
    report.phases.push({ name, ...state });
    console.log('PASS', name);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeEvidencePng(name+'.png',Buffer.from(image.data,'base64'));
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
const speObserverSource='('+function(expectedClassic){
 window.__speSamples=[];window.__skillCaptures=[];window.__speEngineKeys=[];window.__speObserverErrors=[];window.__spePhase='opening';window.__skillDrawLog=[];
 let api=null,originalKey=null,lastStone=null;const held=new Set();
 for(const name of ['clearRect','drawImage','fillRect','fillText','rect','clip']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(){const result=original.apply(this,arguments);if(this.canvas&&this.canvas.id==='hd-spe-canvas'){const args=Array.from(arguments);if(name==='clearRect'&&args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height)window.__skillDrawLog=[];let op={type:name,args,fillStyle:this.fillStyle,font:this.font};if(name==='drawImage'){const source=args.shift();op.src=source.src?new URL(source.src,location.href).pathname.replace(/^\//,''):null;op.args=args;op.naturalWidth=source.naturalWidth||source.width;op.naturalHeight=source.naturalHeight||source.height;}if(name==='fillText'){op.text=String(args.shift());op.args=args;}window.__skillDrawLog.push(op);}return result;};}
 const snapshot=()=>{try{if(!baye.hd.ready())return null;const d=baye.data,count=baye.getPersonCount(),units=Array.from({length:20},(_,i)=>{const id=Number(d.g_FgtParam.GenArray[i]),p=d.g_GenPos[i];if(!Number.isInteger(id)||id<0||id>count)throw Error('Actual battle token is outside current native person count');const pos=Object.fromEntries(['x','y','hp','mp','move','active','state'].map(k=>[k,Number(p[k])]));return {i,id,position:pos,person:id?{personIndex:id-1,name:baye.getPersonName(id-1),arms:Number(d.g_Persons[id-1].Arms),belong:Number(d.g_Persons[id-1].Belong)}:null};});return JSON.parse(JSON.stringify({spe:baye.hd.spe(),result:baye.hd.skillResult(),top:baye.hd.resultOwner(),fight:baye.hd.fight(),report:baye.hd.report(),units,library:window.BayeHdLibIdentity&&BayeHdLibIdentity.read()}));}catch(e){if(window.baye&&baye.hd&&baye.hd.ready())throw e;return null;}};
 function capture(stage,img,w,h,callbackBefore,callbackAfter){try{
  if(!window.baye||!baye.hd||!baye.hd.ready())return;
  const s=snapshot(),spe=s.spe,result=s.result,ui=api&&api.debugSnapshot();window.__speSamples.push({stage,phase:window.__spePhase,at:performance.now(),spe,result,top:s.top,fight:s.fight,report:s.report,units:s.units,library:s.library,ui});
  if(spe.active&&spe.id===42&&spe.kind===2&&spe.contextKnown&&spe.skillId===23)lastStone={generation:spe.generation,eventId:spe.eventId,actorIndex:spe.actorIndex,targetIndex:spe.targetIndex,skillId:spe.skillId};
  const isStone=result.active&&result.speId===42&&result.skillId===23,key=result.generation+':'+result.session;
  const readback=stage==='lifecycle'&&isStone&&result.phase==='hold'&&result.display&&result.display.valid&&!held.has(key);
  if(readback){const lcd=document.getElementById('lcd');img=lcd.getContext('2d').getImageData(0,0,lcd.width,lcd.height);w=lcd.width;h=lcd.height;held.add(key);}
  if((stage==='lcd-flush'||readback)&&img&&(isStone||lastStone)){
   const before=snapshot(),native=document.createElement('canvas'),hd=document.getElementById('hd-spe-canvas'),lcd=document.getElementById('lcd'),shown=ui.open?hd:lcd;native.width=w||img.width;native.height=h||img.height;native.getContext('2d').putImageData(img,0,0);
   const base64=data=>{let text='';for(const byte of data)text+=String.fromCharCode(byte);return btoa(text);};
   const rect=ui.open?ui.sourceRect:{x:0,y:0,width:160,height:96};let hdLogicalRgba=null;
   if(shown&&rect){const data=shown.getContext('2d').getImageData(0,0,shown.width,shown.height).data,logical=[],sx=shown.width/rect.width,sy=shown.height/rect.height;for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++){const offset=(Math.min(shown.height-1,Math.floor((y+.5)*sy))*shown.width+Math.min(shown.width-1,Math.floor((x+.5)*sx)))*4;for(let channel=0;channel<4;channel++)logical.push(data[offset+channel]);}hdLogicalRgba=base64(logical);}
   const node=ui.open?document.getElementById('hd-spe'):lcd,r=shown&&shown.getBoundingClientRect(),top=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),chain=[];let chainVisible=true;for(let p=shown;p;p=p.parentElement){const style=getComputedStyle(p);chain.push({id:p.id,tag:p.tagName,hidden:p.hidden,display:style.display,visibility:style.visibility,opacity:style.opacity,background:style.backgroundColor,filter:style.filter});if(p.hidden||style.visibility!=='visible'||style.display==='none'||Number(style.opacity)!==1)chainVisible=false;}const hitPoints=r&&[[.1,.1],[.5,.5],[.9,.9]].map(([fx,fy])=>{const x=r.x+r.width*fx,y=r.y+r.height*fy,t=document.elementFromPoint(x,y);return{x,y,owned:!!t&&(t===shown||!!node&&node.contains(t)),top:t&&{id:t.id,tag:t.tagName}};});
   const dom=r&&{x:r.x,y:r.y,width:r.width,height:r.height,visible:!!(r.width&&r.height&&chainVisible),inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,stackOwned:hitPoints.every(p=>p.owned),chain,hitPoints,top:top&&{id:top.id,className:top.className}};
   const nativeUrl=native.toDataURL('image/png'),hdUrl=shown&&shown.toDataURL('image/png'),after=snapshot();
   window.__skillCaptures.push({stage:readback?'held-lcd-readback':'lcd-flush',rawSource:readback?'canvas-readback-normalized':'lcd-callback-image-data',at:performance.now(),callbackBefore,callbackAfter,before,after,spe,result,top:s.top,ui,dom,lastStone,lastFight:s.fight,hidden:document.hidden,expectedClassic,displayedCanvas:shown&&shown.id,mode:BayeHdBattle.getMode(),drawing:{scale:Number(baye.data.g_scale),flip:Number(baye.data.g_FlipDrawing),paint:Number(baye.data.g_paintColor),palette0:Number(baye.data.g_paintPalette[0]),palette255:Number(baye.data.g_paintPalette[255])},nativeWidth:native.width,nativeHeight:native.height,nativeRgba:base64(img.data),hdLogicalRgba,nativeUrl,hdUrl,drawLog:window.__skillDrawLog.slice()});
  }
  if(!spe.active&&!result.active&&s.fight.inputKind===1)lastStone=null;
  if(window.__skillCaptures.length>2000||window.__speSamples.length>20000)throw Error('Read-only capture limit');
 }catch(e){window.__speObserverErrors.push(String(e));}}
 Object.defineProperty(window,'BayeHdSpe',{configurable:true,get(){return api;},set(value){api=value;for(const name of ['onEngineSpe','onLcdFlush']){const original=api[name];api[name]=function(){const before=snapshot(),result=original.apply(this,arguments),after=snapshot();capture(name==='onLcdFlush'?'lcd-flush':'lifecycle',name==='onLcdFlush'?arguments[0]:null,arguments[1],arguments[2],before,after);return result;};}if(!originalKey&&typeof window.sendKey==='function'){originalKey=window.sendKey;window.sendKey=function(code){const s=snapshot();window.__speEngineKeys.push({code,at:performance.now(),phase:window.__spePhase,generation:s&&s.spe.generation,eventId:s&&s.spe.eventId,kind:s&&s.spe.kind,speActive:s&&s.spe.active,resultActive:s&&s.result.active,resultSession:s&&s.result.session,resultPhase:s&&s.result.phase,inputKind:s&&s.fight.inputKind,actorIndex:s&&s.fight.actorIndex,focusX:s&&s.fight.focusX,focusY:s&&s.fight.focusY,report:s&&s.report});return originalKey.apply(this,arguments);};}}});
}.toString()+')('+JSON.stringify(classic)+');';

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
    await evaluate(cdp, "window.__spePhase='battle';");
    await marchSmoke(cdp);
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

async function reopenMilitaryAfterPersonPicker(cdp,cityIndex,label) {
    const outcome=await waitPersonPickerOrNativeMap(cdp,label,cityIndex),before=await evaluate(cdp,recruitWorldExpression(cityIndex)),inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    if(outcome.mode==='picker') {
        const current=await currentPersonPicker(cdp,label,cityIndex);
        assert.deepEqual(current.menu,outcome.menu,'Cancellation belongs to the still-current native person picker');
        await click(cdp,'#hd-city-menu [data-hd-menu-back]');
    } else {
        // Conscription can consume all available money and return by itself.
        // The public silent close retires only the stale HD pane; no extra EXIT.
        await action(cdp,'retire-only-stale-'+label+'-pane','BayeHdCityMenu.close({silent:true})');
        assert.equal(await evaluate(cdp,'BayeHdCityMenu.isOpen()'),false,'Silent close must retire the already-native-map pane; no force is used');
    }
    await waitFor(cdp,`native map after stopping ${label}`,'!baye.hd.menuItems().active&&!baye.hd.qty().active&&!baye.hd.report().active&&baye.hd.march().pick===1&&baye.hd.march().phase===0&&BayeHdOverworld.debugSnapshot().phase===\'map\'&&!BayeHdCityMenu.debugSnapshot().sending&&BayeHdCityMenu.debugSnapshot().queueLen===0');
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
    assert.ok(facts.origin&&facts.origin.i===originCity&&facts.origin.owned&&facts.origin.belong===facts.playerBelong,'巴郡 is currently owned by the actual player');
    assert.ok(facts.target&&facts.target.i===destination&&facts.target.owned===false&&Number.isInteger(facts.target.belong)&&
        facts.target.belong!==facts.origin.belong,'Requested destination currently has different native ownership');
    assert.equal(facts.nativeLinkMask.length,8);
    assert.ok(facts.nativeLinkMask.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'All eight actual native link bytes are available');
    const resource=nativeItem(59),offset=originCity*16;
    assert.ok(offset+8<=resource.length,'CITY_LINKR actual item contains the 巴郡 native row');
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


async function marchSmoke(cdp) {
    await evaluate(cdp, `(() => { BayeHdOverworld.setMode('hd-map'); BayeHdCityMenu.setMode('hd'); BayeHdBattle.setMode('hd'); })()`);
    const owned = await waitFor(cdp, 'actual owned HD map 巴郡', `(() => { const m=BayeHdOverworld.debugSnapshot(); return m.phase==='map' && m.owned.find(c=>c.i===31 && c.name==='巴郡'); })()`);
    await readMarchDestination(cdp,'initial-map');
    await observeCity(cdp,'current-owned-city-before-preparation',originCity);
    report.marchPlan = await evaluate(cdp, `(() => {
        const realm=baye.hd.realm();
        return realm.cities.filter(c=>c.owned).map(c=>({ ...c, links:baye.hd.cityLinks(c.i), persons:Number(baye.data.g_Cities[c.i].Persons), food:Number(baye.data.g_Cities[c.i].Food) }));
    })()`);
    assert.ok(await action(cdp,'open-owned-city', `BayeHdOverworld.walkToCity(${owned.i})`));
    await waitFor(cdp, 'real city root menu', `BayeHdCityMenu.isOpen() && BayeHdCityMenu.getLayer() === 'root' && baye.hd.menuItems().active`);
    await checkpoint(cdp,'06-hd-city');
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp, 'military submenu', `BayeHdCityMenu.getLayer() === 'sub' && baye.hd.menuItems().active && baye.hd.menuItems().names[0] === '侦察'`);
    if(recruit)await recruitSmoke(cdp,owned.i);
    await click(cdp,'#hd-city-menu [data-hd-sub="4"]');
    await waitFor(cdp, 'march person picker', `(() => { const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.march(); return m.phase===1 && m.origin===31 && s.deepItems.length && baye.hd.menuItems().active; })()`);
    await checkpoint(cdp,'07-march-persons');
    report.marchPersonIds=[];
    for(let selection=0;selection<6;selection++){
        const before=await evaluate(cdp,'({march:baye.hd.march(),menu:baye.hd.menuItems(),city:BayeHdCityMenu.debugSnapshot()})');
        if(before.march.phase!==1||!before.menu.active||!before.menu.count)break;
        assert.equal(before.menu.context,1);assert.equal(before.menu.kind,3);assert.equal(before.menu.idsValid,true);
        const queue=await evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${originCity}];return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong));})()`);
        assert.deepEqual(before.menu.ids,queue,'Current native allied queue and actual menu IDs agree');
        const index=selection===0?before.menu.ids.indexOf(casterPerson):0;assert.ok(index>=0,'Actual caster is still resident and selected first');
        const id=before.menu.ids[index];assert.equal(before.city.deepItems.find(item=>item.i===index)?.pind,id);
        await click(cdp,`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${id}"]`);
        await waitFor(cdp,'one actual person selected ACK',`baye.hd.march().selected>${before.march.selected}||baye.hd.march().phase!==1`);
        report.marchPersonIds.push(id);
    }
    assert.equal(report.marchPersonIds[0],casterPerson,'Actual caster entered the native march queue');
    await checkpoint(cdp,'08-march-persons-picked');
    if(await evaluate(cdp,'baye.hd.march().phase === 1')) {
        await click(cdp,'#hd-city-menu [data-hd-finish-persons]');
    }
    await waitFor(cdp, 'march food quantity', `baye.hd.march().phase===2 && baye.hd.qty().active && baye.hd.qty().min === 1`);
    await checkpoint(cdp,'09-march-food');
    const foodSelector=await evaluate(cdp, `BayeHdDialog.isQtyOpen() ? '#hd-dialog [data-hd-dlg-ok]' : '#hd-city-menu [data-hd-qty-ok]'`);
    await click(cdp,foodSelector);
    await waitFor(cdp, 'explicit target instruction', `baye.hd.march().phase === 3`);
    await checkpoint(cdp,'10-march-target-instruction');
    await action(cdp,'continue-target-instruction','BayeHdCityMenu.continueMarch()');
    await waitFor(cdp, 'march target map', `baye.hd.march().phase === 4 && baye.hd.march().battlePick === 1`);
    await checkpoint(cdp,'11-march-target');
    await readMarchDestination(cdp,'before-selection');
    const selected=await action(cdp,'select-target-only','BayeHdCityMenu.selectMarchTarget(32)');
    assert.equal(selected.selected,32);
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4,'selecting alone must not send confirmation');
    await readMarchDestination(cdp,'before-confirmation');
    await action(cdp,'confirm-target','BayeHdCityMenu.confirmMarchTarget(32)');
    await waitFor(cdp,'real departure report','baye.hd.march().phase===6',20000);
    await checkpoint(cdp,'12-march-departure-report');
    const departureMapSeq=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await action(cdp,'confirm-departure-report','BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'actual AddFightOrder ACK','baye.hd.march().phase===7 && baye.hd.march().ok===1');
    report.marchOrderReceipt=await evaluate(cdp,'baye.hd.march()');assert.equal(report.marchOrderReceipt.city,31);assert.equal(report.marchOrderReceipt.obj,32);assert.equal(report.marchOrderReceipt.ok,1);
    await waitFor(cdp,'actual strategy input after departure',`(() => {const m=baye.hd.march(),menu=baye.hd.menuItems();return (menu.active&&[1,2].includes(menu.context))||(!menu.active&&m.pick===1&&m.battlePick===0&&m.mapInputSeq>${departureMapSeq});})()`);
    await checkpoint(cdp,'13-march-order-ack');
    await action(cdp,'end-strategy-once','BayeHdCityMenu.goStrategyEnd()');
    await waitFor(cdp,'explicit strategy request accepted','BayeHdCityMenu.debugSnapshot().handoff || baye.hd.fight().active');
    await waitFor(cdp,'real battle player selection','baye.hd.fight().active && !baye.hd.fight().over && baye.hd.fight().inputKind===1',60000);
    report.battleDestinationReceipt=await evaluate(cdp,'baye.hd.fight()');assert.equal(report.battleDestinationReceipt.cityIndex,32);
    await observeCity(cdp,'current-origin-after-dispatch',originCity);
    await checkpoint(cdp,'14-battle-ready');
    await battleSmoke(cdp);
}

const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<0xfffe) units.push({i,id,personIndex:id-1,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),state:Number(d.g_GenPos[i].state),belong:Number(d.g_Persons[id-1].Belong),arms:Number(d.g_Persons[id-1].Arms),iq:Number(d.g_Persons[id-1].IQ),armType:baye.hd.personArmType(id-1),terrain:baye.getTerrainByGeneralIndex(i)});
    }
    return {fight:baye.hd.fight(),generation:Number(d.g_hdSpeGeneration),nativeBoutMax:Number(d.g_FgtBoutMax),nativeMapId:Number(d.g_FgtParam.MapId),mapWidth:Number(d.g_MapWid),mapHeight:Number(d.g_MapHgt),units,movieConfig:{lookMovie:d.g_LookMovie==null?null:Number(d.g_LookMovie),engineDebug:d.g_engineDebug==null?null:Number(d.g_engineDebug)},weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
})()`;


async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&f;})()`,timeout);
}
const moveTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),out=[];
    const sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY);
    for(let y=0;y<Number(d.g_MapHgt);y++)for(let x=0;x<Number(d.g_MapWid);x++) {
        const px=(x-sx+ux)&255,py=(y-sy+uy)&255;
        if(px<15&&py<15){const v=Number(d.g_FightPath[py*15+px]);if(Number.isInteger(v)&&v>=0&&v<=128)out.push({x,y});}
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
    return skill.ids.map((id,index)=>{const x=d.g_Skills[id-1];return {id,index,name:skill.names[index],speId:Number(d.dJNSpeId[id-1]),aim:Number(x.aim),state:Number(x.state),power:Number(x.power),destroy:Number(x.destroy),useMp:Number(x.useMp),eland:array(x.eland,8),earm:array(x.earm,6),available:Number(x.useMp)>0&&Number(x.useMp)<=Number(actor.mp)&&Number(x.weather[weather])>0&&Number(x.oland[terrain])>0};});
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
async function attemptAttack(cdp,actor) {
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name,5);
    const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.arms>0);
    if(!targets.length) {await action(cdp,'cancel-attack-no-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'return from unavailable attack');return false;}
    const target=targets.sort((a,b)=>a.arms-b.arms)[0],before=await evaluate(cdp,battleStateExpression);
    const result=await action(cdp,'confirm-attack-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(result.ok,true);
    await waitActionResolved(cdp,'actual attack resolves');
    const after=await evaluate(cdp,battleStateExpression),enemy=after.units.find(u=>u.i===target.i);
    assert.ok(!enemy||enemy.arms<target.arms,'confirmed normal attack reduces actual enemy troops');
    report.attackCost={actor:actor.name,actorIndex:actor.i,target:target.name,targetIndex:target.i,before,after};
    await checkpoint(cdp,'29-attack-real-troop-cost');
    return true;
}

async function waitActionResolved(cdp,label,afterBout=null){
 const deadline=Date.now()+60000,observed=new Map();
 while(Date.now()<deadline){const s=await evaluate(cdp,'({f:baye.hd.fight(),s:baye.hd.spe(),r:baye.hd.skillResult(),report:baye.hd.report(),generation:Number(baye.data.g_hdDetailGeneration),b:BayeHdBattle.debugSnapshot(),d:BayeHdDialog.debugSnapshot()})');
  if(s.report.active){const owner={generation:s.generation,seq:s.report.seq,inputSeq:s.report.inputSeq,kind:s.report.kind,person:s.report.person},id=JSON.stringify(owner);
   if(!observed.has(id)){const world=await evaluate(cdp,battleStateExpression),again=await evaluate(cdp,'({report:baye.hd.report(),generation:Number(baye.data.g_hdDetailGeneration)})');
    if(again.generation===s.generation&&JSON.stringify(again.report)===JSON.stringify(s.report)){const record={owner,native:s.report,body:s.report.text,uiOwner:s.d.reportOwner||null,spe:s.s,result:s.r,fight:s.f,world,resolution:'pending',ackKeys:[]};report.actualReports??=[];report.actualReports.push(record);observed.set(id,record);await checkpoint(cdp,'actual-report-'+report.actualReports.length);}
   }
  }
  for(const [id,record]of observed){if(record.resolution==='pending'&&(!s.report.active||JSON.stringify({generation:s.generation,seq:s.report.seq,inputSeq:s.report.inputSeq,kind:s.report.kind,person:s.report.person})!==id)){record.resolution='naturally-retired';record.retired={report:s.report,generation:s.generation,spe:s.s,result:s.r};}}
  if(s.f.over||(!s.b.transaction&&s.f.inputKind===1&&!s.s.active&&!s.r.active&&!s.report.active&&(afterBout==null||s.f.bout>afterBout)))return s.f;
  // Original GamMsgBox state reports naturally retire. Never queue a blind Enter after a timer boundary.
  await delay(100);
 }throw Error('Timeout: '+label);
}
async function restActor(cdp,actor,selection){
 if(selection.inputKind===2){assert.equal((await action(cdp,'stay-at-real-tile-'+actor.id,`BayeHdBattle.clickTile(${actor.x},${actor.y})`)).ok,true);await waitBattle(cdp,3,'actual action menu after legal stay');}
 await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
}
async function attemptStone(cdp,actor){
 const current=await evaluate(cdp,battleStateExpression),fresh=current.units.find(u=>u.id===casterNativeId&&u.i===actor.i);
 assert.ok(fresh&&fresh.side==='player'&&fresh.arms>0&&![8,1,6].includes(fresh.state));assert.notEqual(fresh.state,2,'STATE_JZ2 forbids opening the native skill menu; never wait for SKILL4 while silenced');
 assert.equal(current.fight.actorIndex,fresh.i);assert.equal(current.fight.inputKind,3);
 const actionName=await evaluate(cdp,'baye.hd.menuItems().names[1]');await menuChoice(cdp,actionName,4);
 const owner=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),options=await evaluate(cdp,skillOptionsExpression),skill=options.find(s=>s.id===23);
 assert.ok(skill,'Actual current caster native menu contains special skill23');assert.equal(skill.name,report.stoneNativeResource.actualSkillName.name,'Name comes from the actual resource11/index22 and native menu ID, never a guessed label');assert.equal(skill.speId,42);assert.equal(skill.useMp,20);assert.equal(skill.power,0);assert.equal(skill.destroy,0);assert.equal(skill.state,6);assert.equal(skill.aim,0);
 report.stoneOptions??=[];report.stoneOptions.push({owner,actor:fresh,skill,options});
 if(!skill.available){await action(cdp,'cancel-native-unavailable-stone','BayeHdBattle.cancel()');await waitBattle(cdp,3,'actual unavailable skill return');return false;}
 assert.ok(fresh.mp>=20);const latest=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})');assert.deepEqual(latest,owner,'Actual skill menu ownership and ID order are unchanged before selecting');assert.equal(owner.skills.active,1);assert.equal(owner.skills.ids[skill.index],23);assert.equal(owner.skills.ids.filter(id=>id===23).length,1);
 const picked=await action(cdp,'choose-current-native-skill-id23-index',`BayeHdBattle.pickMenu(${skill.index})`);assert.equal(picked.ok,true);await waitBattle(cdp,5,'actual Stone targeting');
 const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.state!==8&&u.state!==6&&u.arms>0&&Number.isInteger(u.terrain)&&skill.eland[u.terrain]>0&&Number.isInteger(u.armType)&&skill.earm[u.armType]>0);
 if(!targets.length){await action(cdp,'cancel-native-stone-without-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'no legal stone target return');return false;}
 const before=await evaluate(cdp,battleStateExpression),target=targets.sort((a,b)=>(before.units.find(u=>u.id===a.id)?.iq??255)-(before.units.find(u=>u.id===b.id)?.iq??255)||a.i-b.i)[0];
 const proof=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,n=Number(r[0]),x=Number(r[1]),y=Number(r[2]),u=d.g_GenPos[${target.i}],caster=d.g_GenPos[f.actorIndex];return {fight:f,generation:Number(d.g_hdSpeGeneration),casterId:Number(d.g_FgtParam.GenArray[f.actorIndex]),casterMp:Number(caster.mp),casterState:Number(caster.state),casterActive:Number(caster.active),casterTerrain:baye.getTerrainByGeneralIndex(f.actorIndex),weather:Number(d.g_FgtWeather),targetId:Number(d.g_FgtParam.GenArray[${target.i}]),x:Number(u.x),y:Number(u.y),state:Number(u.state),terrain:baye.getTerrainByGeneralIndex(${target.i}),arm:baye.hd.personArmType(Number(d.g_FgtParam.GenArray[${target.i}])-1),size:n,originX:x,originY:y,values:Array.from({length:n*n},(_,i)=>Number(r[3+i]))};})()`);
 assert.equal(proof.generation,owner.generation);assert.equal(proof.fight.active,1);assert.equal(proof.fight.over,0);assert.equal(proof.fight.wait,1);assert.equal(proof.fight.inputKind,5);assert.equal(proof.fight.aimType,1);assert.equal(proof.fight.actorIndex,fresh.i);assert.equal(proof.casterId,casterNativeId);assert.equal(proof.targetId,target.id);
 assert.equal(proof.casterMp,fresh.mp);assert.equal(proof.casterActive,0);assert.ok(![8,1,6].includes(proof.casterState));assert.ok(proof.weather>=1&&proof.weather<=4);assert.ok(proof.casterTerrain>=0&&proof.casterTerrain<8);
 assert.ok(Number.isInteger(proof.size)&&proof.size>=1&&proof.size<=15&&proof.values.length===proof.size*proof.size&&proof.values.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
 assert.deepEqual([proof.x,proof.y],[target.x,target.y]);assert.ok(proof.state!==8&&proof.state!==6);assert.ok(skill.eland[proof.terrain]>0&&skill.earm[proof.arm]>0);
 const px=(target.x-proof.originX)&255,py=(target.y-proof.originY)&255;assert.ok(px<proof.size&&py<proof.size);assert.equal(proof.values[py*proof.size+px],1,'Only current real native skill AIM permits this target');
 const reportStart=report.actualReports?.length||0,captureStart=await evaluate(cdp,'window.__skillCaptures.length');
 let confirmation;
 if(classic){
  await evaluate(cdp,"BayeHdBattle.setMode('classic')");report.inputs.push({type:'presentation-mode',mode:'classic',noGameplayWorldWrites:true,controlFieldCleanup:'Public battle mode synchronization may clear retreat control; no gameplay world/RNG writes'});
  for(let n=0;n<512;n++){const f=await evaluate(cdp,'baye.hd.fight()');assert.equal(f.inputKind,5,'Only actual STONE AIM receives classic player movement');assert.equal(f.actorIndex,fresh.i);if(f.focusX===target.x&&f.focusY===target.y)break;const code=f.focusX<target.x?'ArrowRight':f.focusX>target.x?'ArrowLeft':f.focusY<target.y?'ArrowDown':'ArrowUp',nx=f.focusX+(code==='ArrowRight'?1:code==='ArrowLeft'?-1:0),ny=f.focusY+(code==='ArrowDown'?1:code==='ArrowUp'?-1:0);await key(cdp,code);await waitFor(cdp,'one classic STONE AIM cursor ACK','(()=>{const f=baye.hd.fight();return f.inputKind===5&&f.inputSeq==='+f.inputSeq+'&&f.actorIndex==='+f.actorIndex+'&&f.focusX==='+nx+'&&f.focusY==='+ny+'})()');if(n===511)throw Error('Classic STONE AIM cursor bound');}
  const aim=await evaluate(cdp,'baye.hd.fight()');assert.deepEqual([aim.focusX,aim.focusY],[target.x,target.y]);await key(cdp,'Enter');confirmation={ok:true,source:'genuine CDP keyDown/keyUp within exact native AIM owner',aim};
 }else{confirmation=await action(cdp,'confirm-current-stone23-native-target-'+target.id,'BayeHdBattle.clickTile('+target.x+','+target.y+')');assert.equal(confirmation.ok,true);}
 await waitActionResolved(cdp,'real skill23 complete movie/failure and actual report');
 const after=await evaluate(cdp,battleStateExpression),resultOwnerAfter=await evaluate(cdp,'baye.hd.skillResult()'),caster=after.units.find(u=>u.id===casterNativeId),victim=after.units.find(u=>u.id===target.id&&u.i===target.i);if(classic)await evaluate(cdp,"BayeHdBattle.setMode('hd')");
 assert.ok(caster&&caster.state!==8&&caster.arms>0,'Real caster survives; never replaced');assert.equal(fresh.mp-caster.mp,20,'Actual skill use consumes exact native MP cost even on natural failure');assert.ok(victim&&victim.arms===target.arms,'Power0/destroy0 do not fabricate troop damage');
 const evidence=await collectSpe(cdp),movie=evidence.samples.filter(r=>r.stage==='lcd-flush'&&r.spe.active&&r.spe.id===42&&r.spe.actorIndex===fresh.i&&r.spe.targetIndex===target.i&&r.spe.skillId===23&&r.spe.display.frameValid);
 const succeeded=movie.length>0;
 if(succeeded){assert.equal(victim.state,6,'Native successful skill actually changes the selected target to STATE_SZ6');assert.equal(victim.move,before.units.find(u=>u.id===target.id&&u.i===target.i).move,'STONE6 does not use the STATE_DS3 movement-to1 branch');const expectedReport=expectedStateReport(target.name);assert.ok((report.actualReports||[]).slice(reportStart).some(r=>r.owner&&r.native.active===1&&r.native.kind===1&&!r.spe.active&&!r.result.active&&r.resolution==='naturally-retired'&&r.body.replace(/\s/g,'')===expectedReport.replace(/\s/g,'')&&r.world.units.some(u=>u.id===target.id&&u.i===target.i&&u.state===6)),'Actual owned report matches real LIB state-message fragments and the same native target identity');}
 report.stoneAttempts??=[];report.stoneAttempts.push({actor:fresh,skill,target,proof,before,after,confirmation,resultOwnerAfter,captureStart,movieEvents:[...new Set(movie.map(r=>r.spe.eventId))],succeeded,reports:(report.actualReports||[]).slice(reportStart)});
 await checkpoint(cdp,succeeded?'stone23-real-state6-report':'stone23-natural-random-failure-'+report.stoneAttempts.length);return succeeded;
}
async function battleSmoke(cdp){
 report.combatStart=await evaluate(cdp,battleStateExpression);assert.equal(report.combatStart.fight.cityIndex,32);
 const caster=report.combatStart.units.find(u=>u.id===casterNativeId&&u.side==='player');assert.ok(caster&&caster.arms>0&&caster.state!==8);assert.equal(caster.name,report.stoneNativeResource.casterName.name,'Actual P4 GetPersonName matches the same frozen ROM person72');assert.ok(caster.mp>=20);
 if(recruit)assert.equal(caster.arms,report.recruitment.distribution.wanted,'Only actually distributed troops enter battle');
 if(baselineOnly){assert.notEqual(caster.state,2,'Actual baseline caster must not be silenced before opening the native skill menu');const selection=await chooseGeneral(cdp,caster);if(selection.inputKind===2){assert.equal((await action(cdp,'baseline-stay-real-caster-tile',`BayeHdBattle.clickTile(${caster.x},${caster.y})`)).ok,true);await waitBattle(cdp,3,'baseline actual action menu');}
  await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[1]'),4);const options=await evaluate(cdp,skillOptionsExpression);assert.ok(options.some(s=>s.id===23&&s.speId===42));report.baseline={caster,options,note:'Current genuine entry/MP/skill menu census only; no stone cast or HD acceptance'};
  await checkpoint(cdp,'baseline-actual-caster-stone-menu');await action(cdp,'baseline-cancel-uncommitted-skill','BayeHdBattle.cancel()');await waitBattle(cdp,3,'baseline skill menu retired');await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);report.combatEnd=await evaluate(cdp,battleStateExpression);assert.equal(report.combatEnd.units.find(u=>u.id===casterNativeId).mp,caster.mp);return;
 }
 let success=false;
 for(let step=0;step<maxTurns*20&&!success;step++){
  const current=await evaluate(cdp,battleStateExpression),actualCaster=current.units.find(u=>u.id===casterNativeId);
  assert.ok(actualCaster&&actualCaster.state!==8&&actualCaster.arms>0,'Actual caster alive; death is not repaired');assert.ok(!current.fight.over,'Natural battle end stops the requested real skill scenario');
  const available=current.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![8,1,6].includes(u.state));
  const actor=available.find(u=>u.id===casterNativeId)||available[0];
  if(!actor){if((report.turns?.length||0)>=maxTurns)break;await endArmyTurn(cdp);continue;}
  const selection=await chooseGeneral(cdp,actor);
  if(actor.id!==casterNativeId){await restActor(cdp,actor,selection);continue;}
  if(actor.state===2){report.skippedCasts??=[];report.skippedCasts.push({reason:'Actual STATE_JZ2 forbids skill selection; legally rest this actor and wait for a real later turn',actor,current,selection});await restActor(cdp,actor,selection);continue;}
  assert.ok(actor.mp>=20,'No MP fabrication or arbitrary refill');
  if(selection.inputKind===2){const candidates=await evaluate(cdp,moveTilesExpression),enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.state!==6&&u.arms>0&&[0,1,2,3,7].includes(u.terrain));assert.ok(enemies.length,'At least one actual enemy has allowed stone terrain');
   const distance=p=>Math.min(...enemies.map(u=>Math.abs(p.x-u.x)+Math.abs(p.y-u.y)));
   const target=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.state!==8&&u.x===p.x&&u.y===p.y)).sort((a,b)=>distance(a)-distance(b))[0];assert.ok(target,'Current actual MOVE gives an unoccupied legal tile');
   report.movePlanning??=[];report.movePlanning.push({before:current,actor,target,source:'Current actual g_FightPath; proximity only ranks, fresh native AIM still required'});
   assert.equal((await action(cdp,'actual-stone-caster-move',`BayeHdBattle.clickTile(${target.x},${target.y})`)).ok,true);await waitBattle(cdp,3,'actual action after caster movement');
  }
  success=await attemptStone(cdp,actor);if(!success&&await evaluate(cdp,'baye.hd.fight().inputKind===3'))await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
 }
 assert.ok(success,'A real successful skill23 player confirmation, not a fabricated event or random failure, must be observed');
 const evidence=await collectSpe(cdp);assert.deepEqual(evidence.keys.filter(k=>k.resultActive),[],'Native Stone movie owns input and receives no skip/return key');
 report.combatEnd=await evaluate(cdp,battleStateExpression);assert.equal(await evaluate(cdp,'baye.hd.skillResult().active'),false);await checkpoint(cdp,'stone23-native-owner-retired-no-number-wait');
}

function movieOracle(movie,start,end,x,y){
 const width=160,height=96,pixels=Buffer.alloc(width*height),spec=movie.units.slice(start,end+1).map(u=>u.cdelay),spem=movie.units.slice(start,end+1).map(u=>u.ndelay),clears=Buffer.alloc(32),records=[];let mcount=0,ymount=0,cls=true,show=true;
 for(let loop=0;loop<100000;loop++){
  for(let i=0;i<=mcount;i++){if(spec[i]===1){const u=movie.units[start+i],p=movie.pictures[u.picIndex];for(let row=y+u.y;row<y+u.y+p.height;row++)for(let col=x+u.x;col<x+u.x+p.width;col++)if(row>=0&&row<height&&col>=0&&col<width)pixels[row*width+col]=0;clears[(start+i)>>3]|=1<<((start+i)&7);cls=true;}if(spec[i])spec[i]=(spec[i]-1)&255;}
  const draw=i=>{const u=movie.units[start+i];nativePaint(pixels,width,height,movie.pictures[u.picIndex],x+u.x,y+u.y);};
  if(cls)for(let i=0;i<=ymount;i++)if(spec[i])draw(i);if(show){for(let i=ymount+1;i<=mcount;i++)if(spec[i])draw(i);ymount=mcount;}
  if(cls||show){const visible=Buffer.alloc(32);for(let i=0;i<=mcount;i++)if(spec[i])visible[(start+i)>>3]|=1<<((start+i)&7);records.push({frame:start+mcount,visible,clears:Buffer.from(clears),pixels:Buffer.from(pixels)});cls=show=false;}
  if(spem[mcount])spem[mcount]--;while(spem[mcount]<=1&&mcount+start<end){mcount++;show=true;}if(mcount+start>=end&&spec.slice(0,mcount+1).every(v=>v<=1))return records;
 }throw Error('Native counter bound exceeded');
}
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function frames(bits){return Array.from({length:256},(_,i)=>i).filter(i=>bits[i>>3]&(1<<(i&7)));}
function expectedStateReport(personName){
 const source=servedAssets.get('vendor/iBaye/src/data/pstring.h').data.toString('utf8').replace(/\/\*[\s\S]*?\*\//g,''),body=source.match(/enum\s*\{([\s\S]*?)\}/)[1],names=new Map();let index=0;
 for(const item of body.split(',')){const m=/\b(\w+)\s*(?:=\s*(\d+))?/.exec(item);if(!m)continue;index=m[2]?Number(m[2]):index+1;names.set(m[1],index);}
 const text=(name,offset=0)=>{assert.ok(names.has(name));const b=nativeItem(1,names.get(name)+offset-1),n=b.indexOf(0);return new TextDecoder('gbk',{fatal:true}).decode(n<0?b:b.subarray(0,n));};
 return personName+text('dFgtInSta')+text('dFgtState0',6)+text('dFgtState');
}
function assertStoneGeometry(c,expected){
 const scale=c.ui.scale;assert.ok(Number.isInteger(scale)&&scale>=1);const ops=c.drawLog.filter(o=>o.type==='fillRect'||o.type==='fillText'||o.type==='drawImage'&&o.src),live=frames(expected.visible);
 assert.equal(ops.length,live.length,'Only authenticated actual picture copies are drawn; state-only STONE has no invented fill/label/digits');
 live.forEach((frame,i)=>{const u=stoneEntry.units[frame],p=stoneEntry.pictures[u.picIndex],op=ops[i];assert.equal(op.type,'drawImage');assert.equal(op.src,p.src);assert.deepEqual(op.args,[(48+u.x)*scale,(16+u.y)*scale,64*scale,64*scale]);assert.deepEqual([op.naturalWidth,op.naturalHeight],[p.width,p.height]);});
 assert.deepEqual(c.drawLog.filter(o=>o.type==='rect').map(o=>o.args),[[48*scale,16*scale,64*scale,64*scale]],'Exact64 opaque window is the only certified clip');
 for(const op of c.drawLog.filter(o=>o.type==='clearRect')){const[x,y,w,h]=op.args;assert.ok(x===0&&y===0&&w===c.ui.canvasW&&h===c.ui.canvasH||x>=48*scale&&y>=16*scale&&x+w<=112*scale&&y+h<=80*scale,'Clear is initialization or contained in actual STONE window');}
}
function verifySkillCaptures(captures){
 if(baselineOnly){report.baselineAccepted=true;report.actualCastAccepted=false;report.hdAccepted=false;report.fallbackAccepted=false;report.scope={accepted:'Actual standard P4 original route and current person72/skill23 menu only',notRun:'No STONE cast or HD/fallback acceptance'};return;}
 const match=report.stoneAttempts?.find(a=>a.succeeded);assert.ok(match,'At least one actual player-confirmed successful skill23 is required');
 const selected=captures.filter(c=>c.spe.active&&c.spe.id===42&&c.spe.kind===2&&c.spe.contextKnown===true&&c.spe.skillId===23&&c.spe.actorIndex===match.actor.i&&c.spe.targetIndex===match.target.i&&match.movieEvents.includes(c.spe.eventId));assert.ok(selected.length);
 const events=new Map(),verified=[];let actualCallbacks=0,movieHd=0,fallbackReadbacks=0,outsidePixelComparisons=0;const normalizedPixel=(raw,o)=>{const p=Buffer.from(raw.subarray(o,o+4));if(p[3]===0)p.fill(0);return p;};
 const actorBefore=match.before.units.find(u=>u.i===match.actor.i&&u.id===match.actor.id),targetBefore=match.before.units.find(u=>u.i===match.target.i&&u.id===match.target.id);assert.ok(actorBefore&&targetBefore);
 for(const c of selected){
  assert.deepEqual(c.before,c.after,'Readonly full native owner/unit/library snapshots are unchanged');assert.ok(c.callbackBefore&&c.callbackAfter);assert.deepEqual(c.callbackBefore,c.callbackAfter,'Production presentation callback changes no native owner/unit/library field');
  const s=c.spe,d=s.display,r=c.result;if(!d.frameValid)continue;
  assert.deepEqual([s.id,s.kind,s.skillId,s.resourceIndex,s.count,s.picmax,s.startFrm,s.endFrm,s.x,s.y,s.keyflag],[42,2,23,0,8,2,0,7,48,16,0]);assert.equal(s.protocolValid,true);assert.equal(s.contextKnown,true);assert.equal(s.skipEligible,false);assert.equal(s.resourceFingerprint,'fnv1a32:0e6f8d97:1084');assert.equal(s.resourceLength,1084);
  assert.equal(r.active,true);assert.equal(r.protocolVersion,1);assert.equal(r.phase,'movie');assert.equal(r.sourceValid,true);assert.equal(r.custom,false);assert.equal(r.resultKind,1,'Native aim0 uses ARMS_LOSS session kind1 even when state-only value0 leaves troop count unchanged');assert.equal(r.value,0);assert.equal(r.skipEligible,false);assert.equal(r.returnEligible,false);assert.deepEqual([r.generation,r.skillId,r.speId,r.actorIndex,r.targetIndex],[s.generation,23,42,match.actor.i,match.target.i]);assert.deepEqual(r.digits,[],'State-only skill23 never enters NUM');
  assert.ok(c.top.active&&c.top.valid);assert.deepEqual([c.top.kind,c.top.generation,c.top.session],[2,r.generation,r.session]);
  if(r.display.valid){assert.deepEqual([r.display.generation,r.display.session,r.display.eventId],[r.generation,r.session,s.eventId]);assert.deepEqual(r.display.digits,[]);}
  for(const q of [c.callbackBefore,c.callbackAfter,c.before,c.after]){assert.equal(q.units.length,20);assert.equal(q.library.status,'ready');assert.equal(q.library.sha256,report.sources['libs/dat-mod.lib'].sha256);assert.equal(q.library.byteLength,report.sources['libs/dat-mod.lib'].bytes);const a=q.units[match.actor.i],t=q.units[match.target.i];assert.deepEqual([a.id,t.id],[match.actor.id,match.target.id]);assert.equal(a.person.arms,actorBefore.arms);assert.equal(t.person.arms,targetBefore.arms);for(const k of ['x','y','hp','move','state'])assert.equal(a.position[k],Number(actorBefore[k]),'Caster native '+k+' is unchanged during real movie');assert.equal(a.position.mp,actorBefore.mp-20);for(const k of ['x','y','hp','mp','move','active'])assert.equal(t.position[k],Number(targetBefore[k]),'Target native '+k+' is unchanged');assert.equal(t.position.state,6,'State6 was actually applied before the movie');}
  assert.deepEqual([c.nativeWidth,c.nativeHeight],[160,96]);assert.deepEqual([c.drawing.scale,c.drawing.flip,c.drawing.paint,c.drawing.palette0,c.drawing.palette255],[1,0,255,0x00ffffff,0xff000000]);const key=s.generation+':'+s.eventId,raw=Buffer.from(c.nativeRgba,'base64');assert.equal(raw.length,160*96*4);
  if(!events.has(key)){assert.equal(c.rawSource,'lcd-callback-image-data');events.set(key,{records:movieOracle(nativeMovie(42),0,7,48,16),outside:raw,session:r.session});}
  const event=events.get(key),expected=event.records[d.commitSeq-1];assert.ok(expected);assert.equal(event.session,r.session);assert.equal(d.generation,s.generation);assert.equal(d.eventId,s.eventId);assert.ok(d.commitSeq>0&&d.commitSeq<=s.commitSeq);assert.equal(d.frameIndex,expected.frame);assert.deepEqual(Buffer.from(d.visibleFrames),expected.visible);assert.deepEqual(Buffer.from(d.composition.clearFrames),expected.clears);assert.equal(d.composition.valid,true);assert.equal(d.composition.mode,2);assert.deepEqual([d.composition.x,d.composition.y,d.composition.width,d.composition.height],[48,16,64,64]);
  const full=Buffer.from(event.outside);for(let y=16;y<80;y++)for(let x=48;x<112;x++){const i=y*160+x;full.writeUInt32LE(expected.pixels[i]?0xff000000:0x00ffffff,i*4);}assert.deepEqual(raw,full,'Entire160x96 LCD equals independent native timer/bitplanes with unchanged11264 outside pixels');
  assert.ok(c.dom.visible&&c.dom.inViewport&&c.dom.stackOwned);assert.ok(c.dom.hitPoints.length===3&&c.dom.hitPoints.every(p=>p.owned));assert.equal(c.hidden,false);assert.ok(c.nativeFile&&c.hdFile);const shown=Buffer.from(c.hdLogicalRgba||'','base64');assert.equal(shown.length,160*96*4,'Physical presented canvas contains full160x96');
  const fallback=c.ui.source!=='hd-assets';
  if(classic||missingAssets||fallback){assert.ok(allowLcd,'Default run cannot accept a silent LCD fallback');
   if(classic){assert.equal(c.mode,'classic');assert.equal(c.ui.open,false);assert.equal(c.displayedCanvas,'lcd');}
   else{assert.equal(c.ui.open,true);assert.equal(c.ui.source,'lcd');assert.deepEqual(c.ui.sourceRect,{x:0,y:0,width:160,height:96});assert.equal(c.displayedCanvas,'hd-spe-canvas');}
   for(let i=0;i<raw.length;i+=4)assert.deepEqual(shown.subarray(i,i+4),normalizedPixel(raw,i),'All actual native LCD pixels are physically retained in fallback');fallbackReadbacks++;
  }else{assert.equal(c.ui.open,true);assert.equal(c.ui.source,'hd-assets');assert.equal(c.ui.outsideSource,'lcd');assert.equal(c.ui.skipVisible,false);assert.deepEqual(c.ui.sourceRect,{x:0,y:0,width:160,height:96});assert.deepEqual([c.ui.hdRegion.x,c.ui.hdRegion.y,c.ui.hdRegion.width,c.ui.hdRegion.height],[48,16,64,64]);assertStoneGeometry(c,expected);movieHd++;
   let outside=0;for(let y=0;y<96;y++)for(let x=0;x<160;x++){if(x>=48&&x<112&&y>=16&&y<80)continue;const i=(y*160+x)*4;assert.deepEqual(shown.subarray(i,i+4),normalizedPixel(raw,i),'All11264 logical pixels outside exact STONE window use actual LCD');outside++;}assert.equal(outside,11264);outsidePixelComparisons+=outside;
  }
  actualCallbacks++;verified.push({generation:s.generation,eventId:s.eventId,session:r.session,phase:'movie',commitSeq:d.commitSeq,frameIndex:d.frameIndex,visible:frames(expected.visible),clear:frames(expected.clears),source:classic?'lcd':c.ui.source,displayedCanvas:c.displayedCanvas,nativeFile:c.nativeFile,hdFile:c.hdFile,nativeRawSource:c.rawSource,nativeRgbaSha256:sha(raw),independentExpectedSha256:sha(full)});
 }
 assert.ok(actualCallbacks>=2&&verified.some(v=>v.frameIndex===7),'Measured actual timer flushes include final logical frame7');
 const copies=(report.speObservations||[]).filter(c=>c.spe.active&&c.spe.id===42&&c.spe.kind===2&&c.spe.skillId===23&&c.spe.contextKnown&&c.spe.frameValid&&events.has(c.spe.generation+':'+c.spe.eventId));
 for(const [key]of events){const per=copies.filter(c=>c.spe.generation+':'+c.spe.eventId===key),copyFrames=[...new Set(per.map(c=>c.spe.frameIndex))].sort((a,b)=>a-b);assert.deepEqual(copyFrames,[0,1,2,3,4,5,6,7],'Each accepted event has all eight genuine source copies');for(let i=0;i<8;i++)assert.ok(per.some(c=>c.spe.frameIndex===i&&c.spe.commitSeq===i+1),'Each actual source copy has exact introduced commit');}
 const unexpectedNumeric=(report.speObservations||[]).filter(q=>q.result.active&&q.result.skillId===23&&q.result.speId===42&&[...events.values()].some(v=>v.session===q.result.session)&&(q.result.phase!=='movie'||q.result.digits.length));assert.deepEqual(unexpectedNumeric,[],'All actual state-only owner samples exclude NUM and HOLD');
 assert.deepEqual((report.engineInputs||[]).filter(k=>k.speActive&&k.kind===2&&match.movieEvents.includes(k.eventId)||k.resultActive&&[...events.values()].some(v=>v.session===k.resultSession)),[],'No movie/result skip or extra input');
 const targetAfter=match.after.units.find(u=>u.i===match.target.i&&u.id===match.target.id),actorAfter=match.after.units.find(u=>u.i===match.actor.i&&u.id===match.actor.id);assert.ok(targetAfter&&actorAfter);assert.equal(actorBefore.mp-actorAfter.mp,20);assert.equal(targetAfter.state,6);for(const k of ['arms','move','hp','mp','x','y'])assert.equal(targetAfter[k],targetBefore[k],'State-only target '+k+' is unchanged');assert.equal(actorAfter.arms,actorBefore.arms);assert.equal(match.resultOwnerAfter.active,false);
 const stateReport=match.reports.find(q=>q.native?.active===1&&q.native.kind===1&&q.body.replace(/\s/g,'')===expectedStateReport(match.target.name).replace(/\s/g,'')&&!q.spe.active&&!q.result.active&&q.resolution==='naturally-retired'&&q.retired);assert.ok(stateReport,'Actual original state6 report was sampled and naturally retired');assert.deepEqual(stateReport.ackKeys,[]);assert.ok(stateReport.world.units.some(u=>u.i===match.target.i&&u.id===match.target.id&&u.state===6&&u.arms===targetBefore.arms&&u.move===targetBefore.move));
 if(missingAssets)assert.ok(report.requests.some(r=>r.status===404&&r.expected&&stoneEntry.pictures.some(p=>'/'+p.src===r.url)),'A selected actual STONE picture really returned404');
 assert.deepEqual(report.requests.filter(r=>r.status!==200&&!(missingAssets&&r.status===404&&r.expected&&stoneEntry.pictures.some(p=>'/'+p.src===r.url))),[],'No unrelated missing or live-served resource is accepted');
 if(classic||missingAssets)assert.equal(fallbackReadbacks,verified.length);else if(!allowLcd)assert.equal(movieHd,verified.length);else assert.ok(movieHd===verified.length||fallbackReadbacks===verified.length,'Legacy allow-lcd does not accept a mixed/incomplete presentation');
 report.nativePixelOracle={stateOnly:true,actualLcdCallbacks:actualCallbacks,events:events.size,sourceCopies:8*events.size,movieHd,fallbackReadbacks,numericReadbacks:0,completedHoldReadbacks:0,outsidePixelsPerHdReadback:11264,outsidePixelComparisons,verified};
 report.actualStateEffect={actorId:match.actor.id,targetId:match.target.id,skillId:23,session:verified[0].session,actorMpBefore:actorBefore.mp,actorMpAfter:actorAfter.mp,targetStateBefore:targetBefore.state,targetStateAfter:targetAfter.state,targetArmsBefore:targetBefore.arms,targetArmsAfter:targetAfter.arms,targetMoveBefore:targetBefore.move,targetMoveAfter:targetAfter.move,reportOwner:stateReport.owner,reportRetirement:stateReport.retired};
 report.scope={accepted:'One genuine original P4 LiuShan/BaJun31 to WuLing32 person72/native73 '+report.stoneNativeResource.casterName.name+' skill23: exactMP20, real enemy native AIM, state6 before movie, eight copied STONE42 frames, measured full160x96 native bitplanes and actual state report retirement. '+(fallbackReadbacks?'Full actual nativeLCD is physically presented.':'Only authenticated64x64@48,16 is replaced; all11264 outside logical pixels equal actualLCD.'),notRun:'No NUM/HOLD exists for this state-only action. Coalesced callbacks are not every physical frame. No mobile/touch, other skills/Mods/noMovie/month-end/performance/fullABI/fullHD acceptance.',publicInput:'Original public shared UI and genuine CDP keys; no gameplay world/RNG writes or forced outcome.'};
 report.actualCastAccepted=true;report.hdAccepted=!allowLcd&&movieHd===verified.length;report.observationOnly=seenFlags.has('--allow-lcd')&&movieHd===verified.length;report.fallbackAccepted=fallbackReadbacks===verified.length;
}
async function saveSkillEvidence(cdp){if(report.evidenceSaved)return;const raw=await evaluate(cdp,'({captures:window.__skillCaptures,errors:window.__speObserverErrors,keys:window.__speEngineKeys,samples:window.__speSamples})');
 for(let i=0;i<raw.captures.length;i++){const c=raw.captures[i],stem='stone-'+String(i).padStart(3,'0')+'-'+(c.result.phase||'movie');for(const[type,url]of[['lcd',c.nativeUrl],['hd',c.hdUrl]])if(url){const data=Buffer.from(url.split(',')[1],'base64'),name=stem+'-'+type+'.png';writeEvidencePng(name,data);c[type==='lcd'?'nativeFile':'hdFile']={file:name,bytes:data.length,sha256:sha(data)};}delete c.nativeUrl;delete c.hdUrl;}
 report.skillCaptures=raw.captures;report.observerErrors=raw.errors;report.engineInputs=raw.keys;report.speObservations=raw.samples;
 for(const[name,data]of[['native-skill-captures',raw.captures],['observer-errors',raw.errors],['engine-inputs',raw.keys],['spe-observations',raw.samples]])writeJsonAtomicSync(path.join(artifactDir,name+'.json'),data);
 report.evidenceSaved=true;await sampleOwned('saved-stone-evidence');assert.deepEqual(raw.errors,[],'Read-only presentation observer has no errors');
}


async function main() {
    assert.ok(!fs.existsSync(artifactDir),'Use a fresh artifact directory; preserve all previous evidence');
    fs.mkdirSync(path.dirname(artifactDir),{recursive:true});fs.mkdirSync(artifactDir);
    let server,chrome,cdp,chromeError,profile,ownership=null,rootIdentity=null;
    const historical=new Map();
    sampleOwned=async label=>{if(!chrome)return;try{const s=await snapshotOwnedChrome(chrome.pid,profile),r=s.owned.find(p=>p.ProcessId===chrome.pid),sameRoot=!rootIdentity||!!r&&r.CreationDate===rootIdentity.CreationDate&&r.ExecutablePath===rootIdentity.ExecutablePath&&r.CommandLine===rootIdentity.CommandLine;fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),...persistOwnership(s,sameRoot)})+'\n');if(s.rootVerified&&sameRoot){ownership=s;rootIdentity||=r;for(const p of s.owned)historical.set(p.ProcessId+'|'+p.CreationDate,identity(p));}}catch{fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),error:'Owned sampling failed; previous verified basis retained'})+'\n');}};
    const interrupt=()=>{report.interrupted=true;cdp?.close();};
    process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try {
        prepareServedAssets();
        for(const[name,rel]of[['executed-tool.mjs',targetName()],['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],['executed-json-writer.mjs','scripts/hd-runtime-json.mjs']])fs.writeFileSync(path.join(artifactDir,name),servedAssets.get(rel).data,{flag:'wx'});
        console.log('Frozen',Object.keys(report.sources).length,'sources; native',report.nativeSourceCheck.aggregate,'; runner',report.tool.sha256);
        if(preflightOnly){report.ok=true;report.preflight={accepted:true,browserLaunched:false,httpStarted:false,inputSent:false};return;}
        assert.equal(typeof WebSocket,'function','Node 22+ built-in WebSocket is available');
        profile=path.join(artifactDir,'private-browser-profile');fs.mkdirSync(profile);
        server=await startServer();const origin='http://127.0.0.1:'+server.address().port,debugPort=await unusedPort();
        assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);
        const candidates=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/chromium-browser'];
        const binary=process.env.CHROME||candidates.find(filename=>fs.existsSync(filename));assert.ok(binary,'Set CHROME to a Chromium/Chrome executable');
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size='+viewport.width+','+viewport.height,'--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
        report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};
        chrome.on('error',error=>{chromeError=error;});chrome.on('exit',(code,signal)=>{report.chromeExit={code,signal};});
        let target;const deadline=Date.now()+15000;
        while(Date.now()<deadline){if(chromeError)throw chromeError;if(childExited(chrome))throw Error('Private Chrome exited');try{target=(await readCdpTargets(debugPort)).find(item=>item.type==='page');if(target)break;}catch(e){report.chromeEndpointProbeError={message:e.message,code:e.code||null,childExit:report.chromeExit||null};}await delay(100);}
        assert.ok(target,'Private Chrome target '+JSON.stringify(report.chromeEndpointProbeError||null));
        await sampleOwned('launch-before-page');assert.ok(ownership?.rootVerified,'PID birth/executable/exact private profile verified before page');report.rootBirth=rootIdentity.CreationDate;
        cdp=await connectCdp(target.webSocketDebuggerUrl);
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
        await saveSkillEvidence(cdp);verifySkillCaptures(report.skillCaptures);
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
            try { await saveSkillEvidence(cdp); } catch(e) { report.evidenceError=e.stack||String(e); }
            try {
                const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                writeEvidencePng('failure.png',Buffer.from(screenshot.data,'base64'));
            } catch {}
        }
        console.error(report.error);
        process.exitCode = 1;
    } finally {
        process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
        await sampleOwned('before-cleanup');
        if(cdp&&ownership?.rootVerified){try{await cdp.send('Browser.close');report.gracefulBrowserClose=true;}catch{report.gracefulBrowserClose=false;}await delay(750);}cdp?.close();
        if(ownership?.rootVerified){try{const p=await cleanupOwnedChrome(ownership);report.cleanup=persistCleanup(p,ownership);if(!p.treeExited){report.ok=false;process.exitCode=1;}}catch{report.cleanup={treeExited:false,error:'Owned cleanup failed; private profile retained'};report.ok=false;process.exitCode=1;}}
        else if(chrome){report.cleanup={treeExited:false,error:'No verified ownership basis; broad stop refused'};report.ok=false;process.exitCode=1;}
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        report.historicalRecordedIdentities=[...historical.values()];report.profileRetained=!!profile&&fs.existsSync(profile);report.directoriesDeleted=false;
        const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),exists=fs.existsSync(f),after=exists?sha(fs.readFileSync(f)):null;return {path:name,...m,actualSha256:after,match:exists&&after===m.sha256};});
        const added=productionDirectories.flatMap(dir=>walk(path.join(root,dir))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(name=>!servedAssets.has(name));
        const drift=sources.filter(s=>!s.match),runnerMatch=!!report.tool&&sha(fs.readFileSync(fileURLToPath(import.meta.url)))===report.tool.sha256;
        report.sourceVerification={ok:drift.length===0&&added.length===0&&runnerMatch,count:sources.length,drift,added,runnerMatch,sources};
        report.isolation={...report.isolation,user8080Touched:false,profile:profile||null,cleaned:!chrome||report.cleanup?.treeExited===true,chromeExited:!chrome||report.cleanup?.treeExited===true,httpClosed:!server||!server.listening,profileRetained:report.profileRetained,directoriesDeleted:false};
        if(!report.sourceVerification.ok||!report.isolation.cleaned||!report.isolation.httpClosed){report.ok=false;process.exitCode=1;}
        report.finishedAt=new Date().toISOString();report.actualCastAccepted=report.ok===true&&report.actualCastAccepted===true;report.hdAccepted=report.ok===true&&report.hdAccepted===true;report.fallbackAccepted=report.ok===true&&report.fallbackAccepted===true;report.accepted=report.ok===true&&(preflightOnly||report.actualCastAccepted&&(report.hdAccepted||report.fallbackAccepted));report.baselineAccepted=report.ok===true&&baselineOnly&&report.baselineAccepted===true;
        for(const[name,value]of[['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])writeJsonAtomicSync(path.join(artifactDir,name),value);
        console.log('Artifacts:',artifactDir);console.log('Finished',JSON.stringify({ok:report.ok,accepted:report.accepted,actualCastAccepted:report.actualCastAccepted,hdAccepted:report.hdAccepted,fallbackAccepted:report.fallbackAccepted,sources:sources.length}));
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
