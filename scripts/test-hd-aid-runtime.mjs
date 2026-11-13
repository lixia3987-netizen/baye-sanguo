#!/usr/bin/env node
/** Current original-LIB AID41 classic matrix. One skill17 or29 per independent public LOAD of the accepted P3/player9 frozen preparation pair. Uses the current installed engine/product, exact owned-Chrome cleanup, original native pixels/GBK/NUM/HOLD and explicit visible LCD readbacks. No game/RNG/Level/unit setters. --classic --skill17|29 --from-phase2 build/r22-aid-phase2-actual-v5 [--preflight-only] */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {writeJsonAtomicSync} from './hd-runtime-json.mjs';
import {snapshotOwnedChrome,cleanupOwnedChrome} from './hd-runtime-owned-chrome.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),booleans=new Set(['--staged','--preflight-only','--self-test','--720','--classic']),valued=new Set(['--artifact-dir','--max-turns','--save-slot','--from-phase2','--phase2-source','--skill']);
for(let i=0;i<args.length;i++){assert.ok(booleans.has(args[i])||valued.has(args[i]),'Unknown option '+args[i]);if(valued.has(args[i]))assert.ok(args[++i]&&!args[i].startsWith('--'),'Missing argument');}
const option=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];},bounded=(k,d,max)=>{const s=option(k,String(d));assert.match(s,/^\d+$/);const n=Number(s);assert.ok(n>0&&n<=max);return n;};
const staged=args.includes('--staged'),preflightOnly=args.includes('--preflight-only')||args.includes('--self-test'),selfTest=args.includes('--self-test'),missingAidAsset=false,classic=args.includes('--classic'),allowLcd=classic;
assert.equal(classic,true,'Explicit --classic is required; this runner grants classic-LCD acceptance only');
const requestedSkill=Number(option('--skill','0'));assert.ok([17,29].includes(requestedSkill),'Explicit --skill17 or29 is required');const requestedSkills=[requestedSkill];
const phase2Source=option('--phase2-source','approved-v5'),phase2Sources=Object.freeze({
 'cb9f-v3':{path:'build/r22-aid-prepare-driver-v3-final.mjs',bytes:106929,sha256:'cb9f25c6d5bda53c7099f062c1ba13eba52e826b7b039312879177843d431e2d'},
 'approved-v4':{path:'build/r22-aid-phase2-driver-v4.mjs',bytes:117878,sha256:'8f0d0ecec741baf77f0d77a0b7283e92720c2eff7d3ad5da6211a32c73fa0bd5'},
 'approved-v5':{path:'build/r22-aid-phase2-driver-v5-final-v2.mjs',bytes:138744,sha256:'6734d992f05c9cdb687469fba73d481676330f101f9fd1046964619c47ca6746'}
});assert.ok(Object.hasOwn(phase2Sources,phase2Source),'Only explicit approved phase2 source profiles are permitted');const phase2SourceDescriptor=phase2Sources[phase2Source];
const period=3,playerKing=9,originCity=31,searchCity=31,bolePerson=134,casterPerson=188,maxTurns=bounded('--max-turns',20,30),saveSlot=bounded('--save-slot',1,3)-1;
const resumeDirectory=option('--from-phase2',null),resumeTag='caster188-owned';let resumeInput=null;
const artifactDir=path.resolve(option('--artifact-dir','build/r22-aid-cast-preflight-v1'));assert.ok(artifactDir.startsWith(path.join(root,'build')+path.sep),'Evidence stays inside ignored build');
const viewport=args.includes('--720')?{width:1280,height:720}:{width:1920,height:1080},delay=ms=>new Promise(r=>setTimeout(r,ms));
const report={schemaVersion:1,route:'P3-LiuZhang-actual188and144-BaJun31-WuLing32-AID41',phase:'cast',phase2Source,preflightOnly,selfTest,classic,requestedSkills,allowLcd,missingAidAsset,staged,period,playerKing,originCity,searchCity,bolePerson,casterPerson,maxTurns,saveSlot,phase3InputReady:false,startedAt:new Date().toISOString(),phases:[],console:[],exceptions:[],dialogs:[],blocked:[],requests:[],inputs:[],publicCheckpoints:[],hdAccepted:false,preparationAccepted:false,phaseAccepted:false};
const servedAssets=new Map(),nativeMovies=new Map();let nativeLib,plan;// Persistent evidence contains command lines only for independently verified owned processes.
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
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.lib':'application/octet-stream','.ttf':'font/ttf'};
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(directory,item.name)):[path.join(directory,item.name)]);}
const fnv=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619)>>>0;return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+bytes.length;};
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
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
 report.sources={};for(const rel of [targetName(),'scripts/hd-aid-runtime-oracle.mjs','scripts/hd-runtime-owned-chrome.mjs','scripts/hd-runtime-json.mjs'])freezeAsset(rel);
 for(const dir of productionDirectories)for(const f of walk(path.join(root,dir)))freezeAsset(path.relative(root,f).replaceAll('\\','/'));
 for(const p of ['scripts/write-wasm-manifest.mjs','pc.html','qr.png','favicon.png','fonts/HarmonyOS_Sans_SC_Regular.ttf'])freezeAsset(p);
 nativeLib=freezeAsset('libs/dat-mod.lib').data;assert.equal(sha(nativeLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 const planBytes=freezeAsset('build/r22-aid-runtime-route-plan.json').data;plan=JSON.parse(planBytes);assert.equal(plan.library.sha256,sha(nativeLib));assert.equal(plan.selected.period,period);
 report.inputPlan={path:'build/r22-aid-runtime-route-plan.json',bytes:planBytes.length,sha256:sha(planBytes),scope:'Static plan only, not authority to send inputs. SEARCH3 actually costs0 Money/8Thew; one earlier plan sentence50 is superseded by freshIFACE below.'};
 const p=nativeItem(61,period-1),decode=b=>new TextDecoder('gbk',{fatal:true}).decode(b.subarray(0,b.indexOf(0)<0?b.length:b.indexOf(0)));
 const nameResource=[62,70,71,72][period-1];for(const r of [plan.selected.lord,plan.selected.requiredBole,plan.selected.caster]){assert.equal(p.subarray(r.personIndex*19,(r.personIndex+1)*19).toString('hex'),r.rawHex);assert.equal(decode(nativeItem(nameResource,r.personIndex)),r.name);}
 const money=nativeItem(2,10),thew=nativeItem(2,9);assert.deepEqual([money[16],thew[16],money[3],thew[3]],[50,20,0,8]);
 const condition=nativeItem(63,period-1);assert.equal(condition.subarray(casterPerson*4,casterPerson*4+4).toString('hex'),plan.selected.searchCondition.rawHex);assert.equal(condition[casterPerson*4+1],bolePerson+1);
 const movie=nativeMovie(41);assert.deepEqual([movie.count,movie.picmax,movie.start,movie.end,movie.length,movie.fingerprint],[8,2,0,7,1084,'fnv1a32:1d4637e9:1084']);
 report.routeRomProof={period,playerKing,originCity,searchCity,bolePerson,casterPerson,personNames:[9,134,188].map(id=>({id,name:decode(nativeItem(nameResource,id))})),costs:{canvass:{money:money[16],thew:thew[16]},search:{money:money[3],thew:thew[3]}},actualMovie:{length:movie.length,fingerprint:movie.fingerprint},scope:'Read-only original ROM; only successful phase2 original save plus current native owners authorize actual dispatch/cast'};
 for(const name of ['baye.js','baye.wasm','baye.wasm.map','baye.build.json']){const filename=path.join(root,staged?'build/wasm/src':'js',name),data=fs.readFileSync(filename),metadata={source:path.relative(root,filename),bytes:data.length,sha256:sha(data)};report.sources[name]=metadata;servedAssets.set('js/'+name,{data,metadata});}
 const build=JSON.parse(servedAssets.get('js/baye.build.json').data);assert.equal(build.hdSpeProtocol.version,2);for(const name of ['baye.js','baye.wasm','baye.wasm.map']){assert.equal(report.sources[name].bytes,build.artifacts[name].bytes);assert.equal(report.sources[name].sha256,build.artifacts[name].sha256);}
 const hash=crypto.createHash('sha256'),tracked=execFileSync('git',['ls-files','-z','vendor/iBaye'],{cwd:root}).toString('utf8').split('\0').filter(Boolean).sort(),files=[];
 for(const name of tracked){const {data,metadata}=freezeAsset(name);files.push({name,bytes:data.length,sha256:metadata.sha256});hash.update(name+'\0');hash.update(data);}report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),manifest:build.engineSourceSha256,files};assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256);
 report.tool={source:targetName(),bytes:fs.statSync(fileURLToPath(import.meta.url)).size,sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))};report.engineManifest=build;report.sourceRevision={revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),modified:!!execFileSync('git',['status','--porcelain'],{cwd:root}).length,compiledParent:build.sourceRevision??null};report.viewport=viewport;
}
async function startServer(){
 const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/,'')||'pc.html',snapshot=servedAssets.get(rel);if(missingAidAsset&&rel===report.missingAidAssetPath){report.requests.push({url:url.pathname,status:404,scenario:'exact selected AID picture0 intentionally unavailable'});res.writeHead(404,{'Cache-Control':'no-store'}).end();return;}if(!snapshot){report.requests.push({url:url.pathname,status:404});res.writeHead(404).end();return;}report.requests.push({url:url.pathname,status:200,...snapshot.metadata});res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(snapshot.data);}catch{res.writeHead(400).end();}});
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
    // Screenshot checkpoints are distinct from callback pixel/owner acceptance.
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
 const origin=cities[${originCity}],fighters=Array.from({length:Number(d.FIGHTERS.length)},(_,i)=>Number(d.FIGHTERS[i])),orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)!==255).map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),Object:Number(o.Object),TimeCount:Number(o.TimeCount)}));
 const people=Array.from({length:count},(_,id)=>read(id));
 const observed=people;
 const enemyIds=cities.filter(c=>c.belong&&c.belong!==Number(d.g_PlayerKing)+1).flatMap(c=>c.queue.filter(id=>Number(d.g_Persons[id].Belong)===c.belong&&id+1!==c.belong));
 return {generationBefore,generationAfter:Number(d.g_hdSpeGeneration),keysBefore,keysAfter:window.__speEngineKeys.length,period:Number(d.g_PIdx),playerKing:Number(d.g_PlayerKing),aiLevelUpSpeed:Number(d.g_engineConfig.aiLevelUpSpeed),enable16bitConsumeMoney:Number(d.g_engineConfig.enable16bitConsumeMoney),date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)},origin,cities,observed,people,orders,fighters,enemyIds,menu:baye.hd.menuItems(),march:baye.hd.march(),qty:baye.hd.qty(),report:baye.hd.report()};
})()`;
async function observeCampaign(cdp,stage){const world=await evaluate(cdp,campaignWorldExpression);assert.equal(world.generationAfter,world.generationBefore);assert.equal(world.keysAfter,world.keysBefore,'Read-only world snapshot sends no key');assert.equal(world.period,period);assert.equal(world.playerKing,playerKing);assert.equal(world.origin.belong,playerKing+1,'Actual source city remains player owned');assert.equal(world.aiLevelUpSpeed,0,'No artificial AI level acceleration');assert.equal(world.enable16bitConsumeMoney,0);report.campaignObservations??=[];report.campaignObservations.push({stage,world});return world;}

const acquired=world=>world.people[bolePerson]?.belong===playerKing+1&&world.origin.ownedQueue.includes(bolePerson)?world.people[bolePerson]:null;
function sameWorld(a,b,label){for(const f of ['date','origin','cities','people','orders','fighters','enemyIds','playerKing','period','aiLevelUpSpeed'])assert.deepEqual(a[f],b[f],label+' preserves actual '+f);}
function selectRetained(world,civic){assert.equal(civic.satrapId,playerKing+1,'Phase1 requires the actual resident lord to remain governor; no borrowed P4 loyalty profile');assert.ok(world.origin.ownedQueue.includes(playerKing)||kingCanvassPending(world),'Lord must be resident or on one exact authorized current Canvass16 order');const guard=world.origin.ownedQueue.map(id=>world.people[id]).filter(p=>p.personIndex!==playerKing&&p.personIndex!==bolePerson&&p.arms>0).sort((a,b)=>b.arms-a.arms||b.force-a.force||a.personIndex-b.personIndex)[0];assert.ok(guard,'At least one actual armed resident remains with the lord');return allowKingEnvoy?[guard.personIndex]:[playerKing,guard.personIndex];}
function eligibleEnvoys(world,civic,retained){return world.origin.ownedQueue.map(id=>world.people[id]).filter(p=>p.belong===playerKing+1&&(p.personIndex!==playerKing||allowKingEnvoy)&&p.personIndex!==bolePerson&&(p.personIndex+1!==civic.satrapId||p.personIndex===playerKing&&allowKingEnvoy)&&!retained.includes(p.personIndex)&&p.thew>=20&&!world.orders.some(o=>o.Person===p.personIndex)).sort((a,b)=>a.iq-b.iq||a.personIndex-b.personIndex);}
async function waitCampaignOutcome(cdp,label,predicate,timeout=180000){const deadline=Date.now()+timeout,acked=new Set();while(Date.now()<deadline){const s=await evaluate(cdp,'({fight:baye.hd.fight(),menu:baye.hd.menuItems(),report:baye.hd.report(),help:baye.hd.help(),qty:baye.hd.qty(),march:baye.hd.march(),dialog:BayeHdDialog.debugSnapshot(),city:BayeHdCityMenu.debugSnapshot(),phase:BayeHdOverworld.debugSnapshot().phase})');
 if(s.menu.active===1&&s.menu.context===5){report.defenseInterruption={label,state:s,world:await observeCampaign(cdp,label+' genuine defense interruption')};throw Error('Real incoming defense owner: bounded phase1 stops without selecting/abandoning defenders or pretending automatic combat');}
 assert.ok(!s.fight.active||s.fight.over,'Unexpected actual combat is retained as failure');
 if(s.report.active){const o=s.dialog.reportOwner;if(s.dialog.open&&s.dialog.kind==='report'&&o&&o.seq===s.report.seq&&o.inputSeq===s.report.inputSeq){const token=JSON.stringify(o);if(!acked.has(token)){acked.add(token);const current=await evaluate(cdp,'({report:baye.hd.report(),dialog:BayeHdDialog.debugSnapshot(),qty:baye.hd.qty(),help:baye.hd.help(),spe:baye.hd.spe()})');assert.deepEqual(current.report,s.report);assert.deepEqual(current.dialog.reportOwner,o);assert.equal(current.qty.active,0);assert.equal(current.help.active,0);assert.equal(current.spe.active,0);const start=await evaluate(cdp,'window.__speEngineKeys.length');await click(cdp,'#hd-dialog [data-hd-dlg-ok]');const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);assert.deepEqual(keys.map(k=>k.code),[39]);report.campaignReports??=[];report.campaignReports.push({label,owner:o,native:s.report,keys});}}}
 else if(!s.qty.active&&!s.help.active&&!s.city.sending&&!s.city.queueLen&&predicate(s))return s;await delay(100);}throw Error('Bounded wait ended: '+label+'; original world retained, no retry/reset');}
function menuIdentity(m){return {active:m.active,context:m.context,kind:m.kind,seq:m.seq,generation:m.generation,detailGeneration:m.detailGeneration,count:m.count,idsValid:m.idsValid,ids:m.ids,names:m.names};}
async function readNativeMenu(cdp,kind,ids=null){const a=await waitCampaignOutcome(cdp,'actual native menu '+kind,s=>s.menu.active===1&&s.menu.context===1&&s.menu.kind===kind);const m=a.menu;if(kind===3){assert.equal(m.idsValid,true);assert.ok(m.ids.length);assert.equal(m.count,m.ids.length);if(ids)assert.deepEqual(m.ids,ids,'Whole actual native ordered ID list, never name inference');}const b=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(b,m);return m;}
async function lcdVisible(cdp){return waitFor(cdp,'actual classic LCD visible and on top',`(() => {const n=document.getElementById('lcd');if(!n)return false;const r=n.getBoundingClientRect();if(!r.width||!r.height||r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5)return false;for(let a=n;a;a=a.parentElement){const s=getComputedStyle(a);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)return false;}return [[.2,.2],[.5,.5],[.8,.8]].every(p=>document.elementsFromPoint(r.x+r.width*p[0],r.y+r.height*p[1])[0]===n)&&{x:r.x,y:r.y,width:r.width,height:r.height};})()`);}
async function selectNativeMenu(cdp,owner,index,label){assert.ok(Number.isInteger(index)&&index>=0&&index<owner.count);const identity=menuIdentity(owner),record={label,owner,index,moves:[],lcd:await lcdVisible(cdp)};let m=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(menuIdentity(m),identity);
 // Sixteen is only a distant-target policy, never an inferred native page size.
 // ShowPersonControl owns the actual H increment; an overshoot uses the old UP loop.
 if(owner.context===1&&owner.kind===3){
  assert.equal(owner.idsValid,true);assert.equal(owner.ids.length,owner.count);
  for(let i=0;index-m.index>=16&&i<owner.count;i++){
   const from=m.index,before=await observeCampaign(cdp,label+' page before');
   await lcdVisible(cdp);
   const fresh=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(menuIdentity(fresh),identity);assert.equal(fresh.index,from);
   const start=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,'h');
   m=await waitFor(cdp,label+' actual forward page ACK',`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===3&&m.seq===${owner.seq}&&m.generation===${owner.generation}&&m.detailGeneration===${owner.detailGeneration}&&m.index>${from}&&m.index<${owner.count}&&m;})()`);
   assert.deepEqual(menuIdentity(m),identity);assert.ok(Number.isInteger(m.index)&&m.index>from&&m.index<owner.count);
   const after=await observeCampaign(cdp,label+' page after');sameWorld(before,after,label+' actual H page');
   const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);assert.deepEqual(keys.map(k=>k.code),[38]);
   record.moves.push({beforeIndex:from,index:m.index,delta:m.index-from,key:'h',code:38,keys,source:'Native H focus ACK; no page-size or wrap inference'});
  }
 }
 for(let i=0;m.index!==index&&i<owner.count;i++){const before=await observeCampaign(cdp,label+' arrow before');if(owner.context===1&&owner.kind===3){await lcdVisible(cdp);const fresh=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(menuIdentity(fresh),identity);assert.equal(fresh.index,m.index);}const next=m.index+(index>m.index?1:-1),name=index>m.index?'ArrowDown':'ArrowUp',code=index>m.index?35:34,start=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,name);m=await waitFor(cdp,label+' exact highlight ACK',`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===${owner.kind}&&m.seq===${owner.seq}&&m.generation===${owner.generation}&&m.detailGeneration===${owner.detailGeneration}&&m.index===${next}&&m;})()`);assert.deepEqual(menuIdentity(m),identity);const after=await observeCampaign(cdp,label+' arrow after');sameWorld(before,after,label+' highlight');const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);assert.deepEqual(keys.map(k=>k.code),[code]);record.moves.push({beforeIndex:next-(code===35?1:-1),index:next,keys});}
 assert.equal(m.index,index);await lcdVisible(cdp);const fresh=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(fresh,m);const start=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,'Enter');record.confirmKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);assert.deepEqual(record.confirmKeys.map(k=>k.code),[39]);report.nativeSelections??=[];report.nativeSelections.push(record);return record;}
async function retireToMap(cdp,label){const before=await observeCampaign(cdp,label+' before'),start=await evaluate(cdp,'window.__speEngineKeys.length');for(let i=0;i<4;i++){const s=await waitCampaignOutcome(cdp,label+' Back owner',s=>s.menu.active&&s.menu.context===1||!s.menu.active&&s.march.pick===1&&s.march.phase===0);if(!s.menu.active)break;await lcdVisible(cdp);const m=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(m,s.menu);const n=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,'Escape');await waitFor(cdp,label+' owner retired',`!baye.hd.menuItems().active||baye.hd.menuItems().seq!==${m.seq}`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${n})`)).map(k=>k.code),[40]);}await waitCampaignOutcome(cdp,label+' actual map',s=>!s.menu.active&&s.march.pick===1&&s.march.phase===0&&s.march.battlePick===0&&s.phase==='map');const after=await observeCampaign(cdp,label+' after');sameWorld(before,after,label+' cancellation');return {before,after,keys:await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)};}
async function openSystem(cdp,label){const before=await observeCampaign(cdp,label+' before');assert.ok(!before.menu.active&&!before.qty.active&&!before.report.active&&before.march.pick===1&&before.march.phase===0);const start=await evaluate(cdp,'window.__speEngineKeys.length');await key(cdp,'Escape');const owner=await waitFor(cdp,label+' native FunctionMenu',`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active===1&&m.context===2&&m.names[0]==='策略结束'&&s.open&&s.screen==='insystem'&&m;})()`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)).map(k=>k.code),[40]);return owner;}
const civicReadSource = function(cityIndex) {
 const read=()=>{const d=baye.data,count=baye.getPersonCount(),c=d.g_Cities[cityIndex],start=Number(c.PersonQueue),size=Number(c.Persons),queue=Array.from({length:size},(_,i)=>Number(d.g_PersonsQueue[start+i]));return {generation:Number(d.g_hdSpeGeneration),keys:window.__speEngineKeys.length,period:Number(d.g_PIdx),playerKing:Number(d.g_PlayerKing),date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)},cityIndex,belong:Number(c.Belong),satrapId:Number(c.SatrapId),state:Number(c.State),avoidCalamity:Number(c.AvoidCalamity),peopleDevotion:Number(c.PeopleDevotion),commerce:Number(c.Commerce),money:Number(c.Money),food:Number(c.Food),reserve:Number(c.MothballArms),personCount:count,queue,people:queue.map(id=>{const p=d.g_Persons[id];return {personIndex:id,belong:Number(p.Belong),iq:Number(p.IQ),devotion:Number(p.Devotion),thew:Number(p.Thew),arms:Number(p.Arms)};})};};
 const before=read(),after=read();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Readonly civic facts changed during actual native read');return after;
};
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
async function loadResumeCheckpoint(cdp){
 await waitFor(cdp,'actual resume engine ready','window.baye&&baye.hd&&baye.hd.ready()',60000);await observeActualLib(cdp,'resume current actual standard LIB');
 const opening=await waitFor(cdp,'actual resume MAIN3 owner',"(() => {const s=baye.hd.spe();return s.active===1&&s.id===3&&s.kind===1&&s.skipEligible&&s;})()"),n=await evaluate(cdp,'window.__speEngineKeys.length');assert.deepEqual(await evaluate(cdp,'baye.hd.spe()'),opening);await key(cdp,'Enter');await waitFor(cdp,'resume original MAIN ended',`baye.hd.spe().lastEnd.eventId===${opening.eventId}&&baye.hd.spe().lastEnd.reason==='key'&&baye.hd.spe().lastEnd.key===39`);assert.deepEqual((await evaluate(cdp,`window.__speEngineKeys.slice(${n})`)).map(k=>k.code),[39]);await waitFor(cdp,'resume native title picture',"window.__speSamples.some(r=>r.spe&&r.spe.id===100)");
 const count=await evaluate(cdp,'window.__speEngineKeys.length'),pair={sav0:resumeInput.files[0].hex,sav1:resumeInput.files[1].hex,lib:resumeInput.files[0].lib,name:resumeInput.files[0].name,identity:resumeInput.files[0].identity};
 const imported=await evaluate(cdp,`(() => {const pair=${JSON.stringify(pair)};if(!BayeSaveStorage.validatePair(pair.sav0,pair.sav1))throw Error('Original native pair rejected');return {ok:BayeSaveStorage.importSlot(${saveSlot},pair),slot:BayeSaveStorage.inspectSlot(${saveSlot}),keys:window.__speEngineKeys.length};})()`);assert.equal(imported.ok,true);assert.equal(imported.slot.canLoad,true);assert.equal(imported.keys,count,'Public original import has no game input');assert.equal(imported.slot.king,playerKing);assert.equal(imported.slot.period,period);report.publicResumeImport=imported;if(resumeInput){const stored=await evaluate(cdp,`[BayeSaveStorage.readFile('baye//data//sango'+${saveSlot*2}+'.sav'),BayeSaveStorage.readFile('baye//data//sango'+${saveSlot*2+1}+'.sav')]`);assert.deepEqual(stored,resumeInput.files.map(f=>f.hex),'Public import stores the exact original pair bytes, not a reconstructed world');}
 await key(cdp,'ArrowDown');await key(cdp,'Enter');let r=await waitFor(cdp,'actual resume LOAD owner',"(() => {const r=baye.hd.record();return r.active===1&&r.mode===2&&r;})()");assert.equal(r.count,4);for(let i=0;r.index!==saveSlot&&i<4;i++){const before=r,next=r.index+(saveSlot>r.index?1:-1);await key(cdp,saveSlot>r.index?'ArrowDown':'ArrowUp');r=await waitFor(cdp,'resume native record highlight ACK',`(() => {const r=baye.hd.record();return r.active===1&&r.mode===2&&r.seq===${before.seq}&&r.index===${next}&&r;})()`);}assert.equal(r.index,saveSlot);assert.deepEqual(await evaluate(cdp,'baye.hd.record()'),r);await key(cdp,'Enter');await waitFor(cdp,'genuine native resumed strategy world',`!baye.hd.record().active&&!baye.hd.menuItems().active&&Number(baye.data.g_PIdx)===${period}&&Number(baye.data.g_PlayerKing)===${playerKing}&&baye.hd.march().pick===1&&baye.hd.march().phase===0`,60000);
 const after=await observeCampaign(cdp,'actual public native checkpoint loaded');let byteProof;if(resumeInput.rawPair){assert.equal(after.people.length,resumeInput.structure.header.count);byteProof=validateSavedPair(resumeInput.files.map(f=>f.data),{...after,observed:after.people},'All actual native persons/cities/orders after public raw-pair load');report.resumeNativeLoad={owner:r,after,byteProof,rawPair:true,scope:'No previous result or saved-after world exists. Original bytes are compared against the actual freshly public-loaded native world, including every person, city, resident queue, order and fighter byte.'};}else{sameWorld(resumeInput.world,after,'Original public checkpoint load');byteProof=validateSavedPair(resumeInput.files.map(f=>f.data),after,'Actual loaded world from original pair');report.resumeNativeLoad={owner:r,before:resumeInput.world,after,byteProof};}await observeActualLib(cdp,'native loaded actual checkpoint LIB');await evaluate(cdp,"window.__spePhase='preparation';BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('classic');BayeHdSystemUi.setMode('hd');");await waitFor(cdp,'current genuine resumed HD map','BayeHdOverworld.debugSnapshot().phase===\'map\'');await checkpoint(cdp,'02-public-original-checkpoint-loaded');
}

// Authored AID-only boundaries. Imported into a new ignored executable by the source creator.
let font,aidObserverSource,verifyAidCaptures;const aidEntries=new Map();
const casterNativeId=casterPerson+1,allyPerson=144,allyNativeId=145,destination=32;

function assertPhase3Input(previous){
 assert.equal(previous.ok,true,'A successful phase2 actual result is mandatory, not a preflight/phase1 save');
 assert.equal(previous.preflightOnly,false);assert.equal(previous.phase,'search');
 assert.equal(previous.phaseAccepted,true);assert.equal(previous.casterAcquired,true);
 assert.equal(previous.preparationAccepted,false);assert.equal(previous.hdAccepted,false);
 assert.equal(previous.period,3);assert.equal(previous.playerKing,9);assert.equal(previous.searchCity,31);
 assert.equal(previous.sourceVerification.ok,true);assert.equal(previous.sourceVerification.drift.length,0);assert.equal(previous.sourceVerification.added.length,0);
 assert.equal(previous.isolation.cleaned,true);assert.equal(previous.actualLib.sha256,sha(nativeLib));
 const expected=fs.readFileSync(path.join(root,phase2SourceDescriptor.path));assert.equal(sha(expected),phase2SourceDescriptor.sha256);assert.equal(expected.length,phase2SourceDescriptor.bytes);
 assert.equal(previous.tool.sha256,phase2SourceDescriptor.sha256);assert.equal(previous.tool.bytes,phase2SourceDescriptor.bytes);
 const saved=previous.publicCheckpoints?.find(p=>p.tag==='caster188-owned');
 assert.ok(saved);assert.deepEqual(previous.publicSave,saved,'The exact accepted phase2 public checkpoint, not an arbitrary earlier save');
 assert.equal(saved.byteProof.ok,true);assert.equal(saved.info.status,'ready');assert.equal(saved.info.king,9);assert.equal(saved.info.period,3);assert.equal(saved.files.length,2);
 const p=saved.after.people?.[188],ally=saved.after.people?.[144],city=saved.after.cities?.[31];
 assert.ok(p&&p.personIndex===188&&p.belong===10&&p.level===20&&p.iq===150&&p.armType===5&&city.belong===10&&city.ownedQueue.includes(188));
 assert.ok(ally&&ally.personIndex===144&&ally.belong===10&&city.ownedQueue.includes(144)&&ally.arms>0,'The actual ally144 remains owned/armed/resident');
 assert.equal(previous.actualCasterAcquisition.eligibility.person.personIndex,188);
 assert.deepEqual(previous.actualCasterAcquisition.eligibility.person,p);
 return saved;
}
function prepareResumeInputs(){
 const rel=path.relative(root,resumeDirectory).replaceAll('\\','/');assert.ok(rel.startsWith('build/')&&!rel.split('/').includes('..'));
 const resultBytes=freezeAsset(rel+'/result.json').data,previous=JSON.parse(resultBytes),checkpoint=assertPhase3Input(previous);
 assert.equal(resumeTag,'caster188-owned');assert.equal(checkpoint.slot,saveSlot);
 const files=checkpoint.files.map(f=>{assert.equal(path.basename(f.path),f.path);const data=freezeAsset(rel+'/'+f.path).data;assert.equal(data.length,f.bytes);assert.equal(sha(data),f.sha256);assert.equal(f.lib,'libs/dat-mod.lib');assert.ok(typeof f.identity==='string'&&f.identity.length);return {...f,data,hex:data.toString('hex'),path:rel+'/'+f.path};});
 assert.equal(files[0].identity,files[1].identity);
 const byteProof=validateSavedPair(files.map(f=>f.data),checkpoint.after,'Full actual phase2 original save before any browser');
 // Reproject the existing city31 into the observer's origin field, without changing a native byte or person/city fact.
 const world={...checkpoint.after,origin:checkpoint.after.cities[originCity]};
 resumeInput={directory:rel,tag:resumeTag,slot:checkpoint.slot,files,world,byteProof};
 report.phase3InputReady=true;report.phase2Input={directory:rel,result:{bytes:resultBytes.length,sha256:sha(resultBytes)},executedTool:previous.tool,approvedSourceProfile:phase2Source,approvedSource:phase2SourceDescriptor,tag:resumeTag,slot:checkpoint.slot,files:files.map(({hex,data,...f})=>f),byteProof,originProjection:{old:checkpoint.after.origin.i,current:originCity},scope:'Only successful explicit approved-source phase2 caster188-owned original public saved pair; previous phase1, another source profile or failed/preflight evidence cannot authorize Chrome'};
}

async function prepareAidSources(){
 const helper='scripts/hd-aid-runtime-oracle.mjs';freezeAsset(helper);const approved=freezeAsset(phase2SourceDescriptor.path).metadata;assert.equal(approved.sha256,phase2SourceDescriptor.sha256);assert.equal(approved.bytes,phase2SourceDescriptor.bytes);report.approvedPhase2Source={profile:phase2Source,...phase2SourceDescriptor};
 const module=await import(pathToFileURL(path.join(root,helper)).href);aidObserverSource=module.aidObserverSource;verifyAidCaptures=module.verifyAidCaptures;assert.equal(typeof aidObserverSource,'string');assert.equal(typeof verifyAidCaptures,'function');
 const text=servedAssets.get('vendor/iBaye/src/platform/js/font.bin.c').data.toString('utf8');font=Buffer.from([...text.matchAll(/0x([\da-f]{2})/gi)].map(m=>parseInt(m[1],16)));assert.equal(font.length,163840);assert.equal(sha(font),'31197c48c77e82bc244b17f44e405a3a055df8162af06fadd7271cc1990cc6b8');
 const manifest=JSON.parse(servedAssets.get('assets/hd-spe/manifest.json').data);assert.equal(manifest.libSha256,sha(nativeLib));assert.equal(manifest.axScale,1);
 const movie=nativeMovie(41),num=nativePicture(nativeItem(15),0,true);assert.deepEqual([num.width,num.height,num.count,num.mask],[12,16,10,0]);
 const entry=manifest.entries.find(e=>e.kind===2&&e.speId===41&&e.resourceIndex===0&&e.startFrm===0&&e.endFrm===7);
 assert.ok(entry,'Strict AID source manifest must contain authenticated41/0/0..7');assert.equal(entry.aidVersion,1);assert.equal(entry.opaqueCoverageVersion,1);assert.equal(entry.skillResultVersion,1);assert.deepEqual(entry.skillIds,[17,29]);assert.equal(entry.resourceFingerprint,movie.fingerprint);assert.equal(entry.resourceLength,movie.length);assert.deepEqual([entry.count,entry.picmax],[8,2]);assert.deepEqual(entry.units.map(u=>[u.frame,u.x,u.y,u.picIndex]),movie.units.map((u,i)=>[i,u.x,u.y,u.picIndex]));assert.equal(entry.skillNumber.resourceFingerprint,fnv(nativeItem(15)));
 for(const p of entry.pictures){assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[64,64,64,64,0]);const bytes=freezeAsset(p.src).data;assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[p.width,p.height]);}for(const id of [17,29])aidEntries.set(id,entry);report.missingAidAssetPath=missingAidAsset?entry.pictures.find(p=>p.picIndex===0).src:null;
 report.actualAidSkills=[17,29].map(id=>{const row=nativeItem(10).subarray((id-1)*34,id*34),name=new TextDecoder('gbk',{fatal:true}).decode(nativeItem(11,id-1)),x={id,name,aim:row[0],state:row[1],power:row.readUInt16LE(2),destroy:row.readUInt16LE(4),mp:row[6],weather:Array.from(row.subarray(7,12)),targetArm:Array.from(row.subarray(12,18)),targetTerrain:Array.from(row.subarray(18,26)),actorTerrain:Array.from(row.subarray(26,34)),recordHex:row.toString('hex')};assert.deepEqual([x.aim,x.state,x.destroy,x.mp,x.power],[1,0,0,id===17?15:30,id===17?800:1800]);return x;});
 const source=servedAssets.get('vendor/iBaye/src/FightSub.c').data.toString('utf8');assert.ok(source.includes('GamDelay(SHOW_DLYBASE * 5,false);'));const header=servedAssets.get('vendor/iBaye/src/baye/consdef.h').data.toString('utf8');assert.match(header,/#define\s+SHOW_DLYBASE\s+10\b/);
 report.holdSourceContract={nativeTicks:50,source:'FightSub.c _CommonJNAction',scope:'Frozen native50tick noninterruptible delay plus actual observed hold/later retirement; elapsed milliseconds are not relabelled as engine ticks'};
 report.mapResource=110+nativeItem(2,14)[destination];assert.ok(report.mapResource>=110&&report.mapResource<117);report.phase3InputReady=false;
 if(!resumeDirectory)report.preparationPending={noBrowser:true,reason:'Successful phase2 caster188-owned pair not supplied. Static source/oracle checks do not authorize game input.'};
}

async function prepareAidArmy(cdp){
 const world=await observeCampaign(cdp,'fresh actual AID dispatch roster'),city=world.cities[originCity];
 const selected=[casterPerson,allyPerson].map(id=>world.people[id]);assert.ok(selected.every(p=>p&&p.belong===10&&city.ownedQueue.includes(p.personIndex)&&p.arms>0));assert.deepEqual(selected.map(p=>p.personIndex),[188,144]);assert.deepEqual([selected[0].level,selected[0].iq,selected[0].armType],[20,150,5]);
 const rawRatio=await evaluate(cdp,'Number(baye.data.g_engineConfig.ratioOfFoodToArmsPerDay)'),ratio=rawRatio||3;assert.ok(Number.isInteger(ratio)&&ratio>=1&&ratio<=255);
 // Both successful gains can increase the actual total: budget the authenticated default capacities, not just pre-cast troops.
 const capacity=await evaluate(cdp,'('+aidCapacitiesSource.toString()+')()');assert.equal(capacity.length,2);assert.ok(capacity.every(p=>Number.isInteger(p.capacity)&&p.capacity>=p.arms));
 const totalArms=capacity.reduce((sum,p)=>sum+p.capacity,0);assert.ok(totalArms<=65535);
 const perBout=Math.floor(Math.floor(Math.sqrt(totalArms))/ratio),foodBudget={totalArms,ratio,turns:maxTurns,perBout,required:perBout*maxTurns+1};assert.ok(city.food>=foodBudget.required,'Insufficient actual food: stop instead of inventing supply');assert.ok(city.money>=nativeItem(2,10)[27]);
 report.aidArmy={selected,capacity,foodBudget,final:{city,world},scope:'Current original troops only; no conscription/distribution or world edit in phase3. Both default capacity upper bounds budget post-AID food.'};
}
const aidCapacitiesSource=function(){const d=baye.data,c=d.g_engineConfig;return [188,144].map(id=>{const p=d.g_Persons[id];const custom=Number(c.enableCustomRatio);if(custom!==0)throw Error('Only authenticated standard default capacity is accepted');const capacity=(Number(p.Level)*100+Number(p.Force)*10+Number(p.IQ)*10)&65535;return{personIndex:id,arms:Number(p.Arms),capacity,custom};});};

function scaledAidPower(skill,proof){let value=skill.power;for(const multiplier of [skill.weather[proof.weather-1],skill.earm[proof.arm],skill.eland[proof.terrain],skill.oland[proof.casterTerrain]]){assert.ok(Number.isInteger(multiplier)&&multiplier>0);value=Math.trunc(Math.fround(value*Math.fround(multiplier/100)))&65535;}return value;}

async function battleAid(cdp){
 const initial=await evaluate(cdp,battleStateExpression);report.combatStart=initial;assert.equal(initial.fight.cityIndex,destination);assert.equal(initial.nativeMapId,report.mapResource);assert.deepEqual(initial.units.filter(u=>u.side==='player').map(u=>({personIndex:u.id-1,arms:u.arms})),report.aidArmy.selected.map(p=>({personIndex:p.personIndex,arms:p.arms})));assert.equal(initial.food.player,report.marchFood.food.value);assert.ok(initial.food.player>=report.aidArmy.foodBudget.required);
 const map=await evaluate(cdp,actualTerrainExpression),raw=nativeItem(report.mapResource);assert.ok(map.width>0&&map.height>0);assert.deepEqual(Buffer.from(map.tiles),raw.subarray(16,16+map.width*map.height));report.actualTerrain=map;
 const complete=new Set();let positive=false;
 for(let step=0;step<maxTurns*20;step++){
  const current=await evaluate(cdp,battleStateExpression),caster=current.units.find(u=>u.id===casterNativeId),ally=current.units.find(u=>u.id===allyNativeId);
  assert.ok(caster&&ally&&caster.arms>0&&ally.arms>0&&caster.state!==8&&ally.state!==8,'Natural caster/required friendly target loss is retained as failure');assert.equal(current.fight.over,0);
  if(complete.size===requestedSkills.length&&positive)break;
  const eligible=current.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![8,1,6].includes(u.state)),actor=eligible.find(u=>u.id===casterNativeId)||eligible[0];
  if(!actor){if((report.turns?.length||0)>=maxTurns)break;await endArmyTurn(cdp);continue;}
  const owner=await chooseGeneral(cdp,actor);
  if(actor.id!==casterNativeId){await moveAidAlly(cdp,actor,owner,current,positive);continue;}
  if(actor.state===2){await restActor(cdp,actor,owner);continue;}
  const skillId=requestedSkills.find(id=>!complete.has(id))||requestedSkills[0],cost=skillId===17?15:30;
  if(actor.mp<cost){report.mpWaits??=[];report.mpWaits.push({actor,skillId,cost,owner});await restActor(cdp,actor,owner);continue;}
  if(owner.inputKind===2){const candidates=await evaluate(cdp,moveTilesExpression),legal=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.state!==8&&u.x===p.x&&u.y===p.y));assert.ok(legal.length);const distance=p=>Math.max(Math.abs(p.x-ally.x),Math.abs(p.y-ally.y)),danger=p=>Math.min(...current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0).map(u=>Math.abs(u.x-p.x)+Math.abs(u.y-p.y)),100);legal.sort((a,b)=>distance(a)-distance(b)||danger(b)-danger(a)||Math.abs(a.x-actor.x)+Math.abs(a.y-actor.y)-Math.abs(b.x-actor.x)-Math.abs(b.y-actor.y)||a.y-b.y||a.x-b.x);const target=legal[0];report.movePlanning??=[];report.movePlanning.push({kind:'caster-to-actual-friendly',before:current,actor,target,candidates});assert.equal((await action(cdp,'legal AID caster MOVE',`BayeHdBattle.clickTile(${target.x},${target.y})`)).ok,true);await waitBattle(cdp,3,'actual AID caster ACTION');}
  if(await attemptAid(cdp,actor,skillId)){complete.add(skillId);positive=report.aidAttempts.some(a=>a.succeeded&&a.appliedGain>0);}else if(await evaluate(cdp,'baye.hd.fight().inputKind===3'))await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
 }
 assert.deepEqual([...complete].sort((a,b)=>a-b),requestedSkills);assert.equal(positive,true,'At least one real positive gain is required; all-zero capacity alone is incomplete');report.combatEnd=await evaluate(cdp,battleStateExpression);report.aidRetired=await evaluate(cdp,'({spe:baye.hd.spe(),result:baye.hd.skillResult(),top:baye.hd.resultOwner(),ui:BayeHdSpe.debugSnapshot()})');assert.equal(report.aidRetired.spe.active,0);assert.equal(report.aidRetired.result.active,false);assert.equal(report.aidRetired.top.active,false);await checkpoint(cdp,'05-two-AID-owners-retired');
}
async function moveAidAlly(cdp,actor,owner,current,positive){
 assert.equal(actor.id,allyNativeId);const capacity=(await evaluate(cdp,'('+aidCapacitiesSource.toString()+')()')).find(p=>p.personIndex===allyPerson);
 // Normally stay adjacent to caster. Only a genuinely full ally with no positive coverage yet is ranked toward current enemy positions, allowing natural damage without manufactured wounds.
 const seekNaturalWound=!positive&&actor.arms>=capacity.capacity;
 if(owner.inputKind===2){const candidates=await evaluate(cdp,moveTilesExpression),legal=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.state!==8&&u.x===p.x&&u.y===p.y)),caster=current.units.find(u=>u.id===casterNativeId),enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);assert.ok(legal.length);const distance=(p,u)=>Math.abs(p.x-u.x)+Math.abs(p.y-u.y),rank=p=>seekNaturalWound?Math.min(...enemies.map(u=>distance(p,u)),100):distance(p,caster);legal.sort((a,b)=>rank(a)-rank(b)||distance(a,actor)-distance(b,actor)||a.y-b.y||a.x-b.x);const target=legal[0];report.movePlanning??=[];report.movePlanning.push({kind:'friendly-public-move-and-rest',seekNaturalWound,before:current,actor,target,candidates});assert.equal((await action(cdp,'legal friendly target MOVE',`BayeHdBattle.clickTile(${target.x},${target.y})`)).ok,true);await waitBattle(cdp,3,'actual friendly ACTION');}
 await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
}
async function ensureAidFont(cdp){
 const before=await evaluate(cdp,campaignWorldExpression),keysBefore=await evaluate(cdp,'window.__speEngineKeys.length');
 const font=await evaluate(cdp,`(async()=>{const faces=await document.fonts.load('16px BayeUI','兵力增加援兵援军');await document.fonts.ready;return{status:document.fonts.status,check:document.fonts.check('16px BayeUI','兵力增加援兵援军'),faces:faces.map(f=>({family:f.family,status:f.status}))};})()`);
 assert.equal(font.status,'loaded');assert.equal(font.check,true);assert.ok(font.faces.some(f=>f.family.replace(/["']/g,'')==='BayeUI'&&f.status==='loaded'));
 const after=await evaluate(cdp,campaignWorldExpression),keysAfter=await evaluate(cdp,'window.__speEngineKeys.length');sameWorld(before,after,'Font readiness');assert.equal(keysAfter,keysBefore);
 const source=servedAssets.get('fonts/HarmonyOS_Sans_SC_Regular.ttf').metadata,requests=report.requests.filter(r=>r.url==='/fonts/HarmonyOS_Sans_SC_Regular.ttf');assert.ok(requests.length&&requests.every(r=>r.status===200&&r.bytes===source.bytes&&r.sha256===source.sha256),'The actual BayeUI font request serves the frozen original bytes');report.fontValidation={...font,source,requests,keysBefore,keysAfter};
}
async function smokeAid(cdp){await loadResumeCheckpoint(cdp);await ensureAidFont(cdp);await evaluate(cdp,"window.__spePhase='battle';BayeHdSystemUi.setMode('hd');BayeHdCityMenu.setMode('hd');BayeHdOverworld.setMode('hd-map');BayeHdBattle.setMode('hd');");await marchAid(cdp);await saveAidEvidence(cdp);report.nativePixelOracle=verifyAidCaptures(report,{library:nativeLib,font,assets:servedAssets,artifactDir,allowLcd,expectClassic:classic,expectedSkills:requestedSkills,expectMissing:missingAidAsset});report.hdAccepted=false;report.actualCastAccepted=true;report.fallbackAccepted=classic;report.classicNegativeAccepted=classic;report.presentationScope='Explicit classic selected player AID movie/NUM/hold: actual visible full160x96 LCD readbacks only; no HD artwork acceptance';report.scope={accepted:'Actual successful phase2 original public LOAD, native31→32 army order27 and friendly skills17/29 AID41, true GBK ARMS_GAIN/NUM/hold, independent full LCD/originalPNG/window64/outsideLCD and owner retirement',notRun:'Other skills/factions/Mod; controlled C full/partial/cap-zero classes stay separate, actual positive gain is mandatory'};}

const cityControlReadSource = function(cityIndex,layer,kind,selector) {
    if(document.hidden||!window.baye||!baye.hd||!baye.hd.ready()||
        !window.BayeHdCityMenu||BayeHdCityMenu.getMode()!=='hd')return null;
    const read=()=>{
        const menu=JSON.parse(JSON.stringify(baye.hd.menuItems())),march=baye.hd.march(),
            qty=baye.hd.qty(),report=baye.hd.report(),help=baye.hd.help(),fight=baye.hd.fight(),
            city=BayeHdCityMenu.debugSnapshot(),system=BayeHdSystemUi.debugSnapshot();
        if(menu.active!==1||menu.context!==1||menu.kind!==kind||
            !Number.isInteger(menu.seq)||menu.seq<=0||!Number.isInteger(menu.generation)||
            !Number.isInteger(menu.detailGeneration)||!Array.isArray(menu.names)||
            menu.count!==menu.names.length||menu.count<=0||
            march.mapCity!==cityIndex+1||march.pick!==0||
            qty.active!==0||report.active!==0||help.active!==0||fight.active!==0||
            !city.open||!city.showHd||city.pref!=='hd'||city.layer!==layer||city.cityIndex!==cityIndex||
            city.sending||city.queueLen!==0||city.handoff||city.confirmingTarget||
            system.open!==false||system.pref!=='hd'||BayeHdSystemUi.isOpen()!==false||
            (window.BayeHdDialog&&BayeHdDialog.isOpen())||
            (window.BayeHdSpe&&BayeHdSpe.isOpen()))return null;
        return {menu,march:{mapCity:march.mapCity,mapInputSeq:march.mapInputSeq,pick:march.pick,phase:march.phase},
            city:{open:city.open,showHd:city.showHd,pref:city.pref,layer:city.layer,subKind:city.subKind,
                cityIndex:city.cityIndex,sending:city.sending,queueLen:city.queueLen},
            system:{open:system.open,pref:system.pref},keys:window.__speEngineKeys.length};
    };
    const before=read();if(!before)return null;
    const pane=document.getElementById('hd-city-menu'),node=document.querySelector(selector);
    if(!pane||!node||!pane.contains(node)||node.disabled)return null;
    const chain=[];
    for(let p=node;p;p=p.parentElement){const style=getComputedStyle(p),opacity=Number(style.opacity);
        if(style.display==='none'||style.visibility!=='visible'||!Number.isFinite(opacity)||opacity<=0)return null;
        chain.push({tag:p.tagName,id:p.id,display:style.display,visibility:style.visibility,opacity});
    }
    const r=node.getBoundingClientRect();
    if(![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0||
        r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return null;
    const x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);
    if(!top||(top!==node&&!node.contains(top)))return null;
    const after=read();if(!after||JSON.stringify(before)!==JSON.stringify(after))return null;
    return {...after,dom:{selector,rect:{x:r.x,y:r.y,width:r.width,height:r.height},
        point:{x,y},top:{tag:top.tagName,id:top.id,className:top.className},chain}};
};
function cityControlIdentity(snapshot) {
    const {rect,point,chain,...dom}=snapshot.dom;
    return {...snapshot,dom:{...dom,chain:chain.map(({opacity,...style})=>style)}};
}
async function clickCityControl(cdp,cityIndex,layer,kind,selector,label){
    const inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    const expression='('+cityControlReadSource.toString()+')('+[cityIndex,layer,kind,selector].map(v=>JSON.stringify(v)).join(',')+')';
    const ready=await waitFor(cdp,label+' real native owner and topmost HD button',expression);
    const fresh=await evaluate(cdp,expression);
    assert.ok(fresh,label+' stays genuinely visible before this one click');
    assert.deepEqual(cityControlIdentity(fresh),cityControlIdentity(ready),label+' preserves the full native owner and current visible hit target through the final read');
    assert.equal(fresh.keys,inputStart,label+' readonly readiness sends zero native keys');
    report.cityReadyReceipts??=[];report.cityReadyReceipts.push({label,cityIndex,layer,kind,ready,fresh,
        scope:'Readonly full native owner plus actual visible topmost HD city control; system mode stays HD, no overlay dismissal or synthetic key'});
    await click(cdp,selector);
}

const protectedCityWalkReadSource = function(cityIndex,selector,readCityControl) {
 const idle=()=>{const c=BayeHdCityMenu.debugSnapshot();return c.walkBusy===false&&c.sending===false&&c.queueLen===0;};
 if(!idle())return null;
 const before=readCityControl(cityIndex,'root',1,selector);if(!before||!idle())return null;
 const after=readCityControl(cityIndex,'root',1,selector);
 if(!after||!idle()||JSON.stringify(before)!==JSON.stringify(after))return null;
 return {...after,walkBusy:false};
};
async function waitProtectedCityWalk(cdp,cityIndex,selector,label,walkStart) {
 const expression='('+protectedCityWalkReadSource.toString()+')('+JSON.stringify(cityIndex)+','+JSON.stringify(selector)+','+cityControlReadSource.toString()+')';
 const settled=await waitFor(cdp,label+' actual queued walk reaches stable HD city root',expression),fresh=await evaluate(cdp,expression);
 assert.ok(fresh,label+' walk remains idle at the final readonly observation');
 assert.deepEqual(cityControlIdentity(fresh),cityControlIdentity(settled),label+' settled walk preserves the actual root owner and visible button');
 assert.equal(fresh.march.mapCity,cityIndex+1);assert.equal(fresh.city.cityIndex,cityIndex);
 assert.ok(Number.isInteger(walkStart)&&walkStart>=0&&fresh.keys>=walkStart);
 const nativeInputs=await evaluate(cdp,`window.__speEngineKeys.slice(${walkStart})`);
 assert.equal(nativeInputs.length,fresh.keys-walkStart,'Record only the real queued walk keys through its settled root');
 report.protectedWalkReceipts??=[];report.protectedWalkReceipts.push({label,cityIndex,walkStart,settled,fresh,nativeInputs,
  scope:'Readonly wait after the public asynchronous walk; actual native root/mapCity and topmost HD control, empty queue/no sending/no walkBusy. Queued walking keys are recorded here; the subsequent control helper still independently requires zero keys during its own readiness.'});
 return fresh;
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

async function observeCity(cdp,stage,cityIndex){
 const expression="({generation:Number(baye.data.g_hdSpeGeneration),march:baye.hd.march(),keys:window.__speEngineKeys.length})",before=await evaluate(cdp,expression),world=await evaluate(cdp,recruitWorldExpression(cityIndex)),after=await evaluate(cdp,expression);
 assert.deepEqual(after,before,'Readonly current city money/reserve/queue reads preserve native generation, owner and inputs');assert.ok(Number.isInteger(world.money)&&world.money>=0&&Number.isInteger(world.reserve)&&world.reserve>=0);assert.equal(world.personQueue.length,world.personCount);assert.deepEqual(world.persons.map(p=>p.personIndex),world.personQueue);
 report.cityObservations??=[];const observation={stage,before,after,world};report.cityObservations.push(observation);return observation;
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



async function marchAid(cdp){
 await waitFor(cdp,'current native map with actual owned source city',`(() => {const s=BayeHdOverworld.debugSnapshot();return s.phase==='map'&&s.owned.some(c=>c.i===31);})()`);await readMarchDestination(cdp,'initial-map');const world=await observeCampaign(cdp,'loaded real owned current caster');assert.ok(world.people[casterPerson].belong===10&&world.origin.ownedQueue.includes(casterPerson));
 const walkStart=await evaluate(cdp,'window.__speEngineKeys.length'),pos=await evaluate(cdp,'BayeHdOverworld.cityScreenPos(31)'),walk=await action(cdp,'open current owned Wan20','BayeHdOverworld.walkToCity(31)');assert.deepEqual(walk,{name:pos.name,to:{x:pos.engX,y:pos.engY}});await waitFor(cdp,'actual source native city root','BayeHdCityMenu.isOpen()&&BayeHdCityMenu.getLayer()==="root"&&baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1');await waitProtectedCityWalk(cdp,originCity,'#hd-city-menu [data-hd-root="2"]','actual AID origin walk',walkStart);await clickCityControl(cdp,originCity,'root',1,'#hd-city-menu [data-hd-root="2"]','current city military root');await waitFor(cdp,'actual military submenu','BayeHdCityMenu.getLayer()==="sub"&&baye.hd.menuItems().active&&baye.hd.menuItems().names[0]==="侦察"');await prepareAidArmy(cdp);
 await clickCityControl(cdp,originCity,'sub',2,'#hd-city-menu [data-hd-sub="4"]','current source city march');await waitFor(cdp,'actual march person phase','baye.hd.march().phase===1&&baye.hd.march().origin===31');report.marchPersonIds=[];
 const dispatchIds=report.aidArmy.selected.map(p=>p.personIndex);report.marchSelections=[];
 for(let selection=0;selection<dispatchIds.length;selection++){
  const prior=await evaluate(cdp,'baye.hd.march()');assert.equal(prior.phase,1);
  const picker=await currentPersonPicker(cdp,'出征',originCity),fresh=await evaluate(cdp,'baye.hd.march()');
  for(const f of ['phase','session','origin','selected'])assert.equal(fresh[f],prior[f]);assert.equal(fresh.selected,selection);
  const id=dispatchIds[selection],index=picker.menu.ids.indexOf(id),person=report.aidArmy.selected[selection];assert.ok(index>=0);assert.equal(picker.city.deepItems.find(p=>p.i===index)?.pind,id);
  const actual=await evaluate(cdp,`({belong:Number(baye.data.g_Persons[${id}].Belong),arms:Number(baye.data.g_Persons[${id}].Arms),menu:baye.hd.menuItems()})`);assert.equal(actual.belong,10);assert.equal(actual.arms,person.arms);assert.ok(actual.arms>0);assert.deepEqual(actual.menu,picker.menu);
  const keyStart=await evaluate(cdp,'window.__speEngineKeys.length');await click(cdp,`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${id}"]`);
  await waitFor(cdp,'exact selected native caster/escort receipt',`baye.hd.march().selected===${selection+1}||baye.hd.march().phase!==1`);
  const after=await evaluate(cdp,'baye.hd.march()');assert.equal(after.selected,selection+1);report.marchPersonIds.push(id);report.marchSelections.push({id,index,person,prior,picker,actual,after,keys:await evaluate(cdp,`window.__speEngineKeys.slice(${keyStart})`)});
 }
 assert.deepEqual(report.marchPersonIds,dispatchIds,'Only this actually equipped caster and real resident escorts depart');
 assert.equal(report.marchPersonIds[0],casterPerson);await checkpoint(cdp,'02-actual-native-march-persons');if(await evaluate(cdp,'baye.hd.march().phase===1'))await click(cdp,'#hd-city-menu [data-hd-finish-persons]');await waitFor(cdp,'actual march food quantity','baye.hd.march().phase===2&&baye.hd.qty().active&&baye.hd.qty().min===1');const food=await waitFor(cdp,'current ready native march GetFood',"(() => {const q=baye.hd.qty(),m=baye.hd.march(),s=BayeHdCityMenu.debugSnapshot();return q.active===1&&q.protocol&&q.ready===1&&q.min===1&&m.phase===2&&m.origin===31&&BayeHdCityMenu.isQtyLive()&&!s.sending&&!s.queueLen&&q;})()");assert.equal(food.max,report.aidArmy.final.city.food);assert.equal(food.value,food.max);assert.ok(food.value>=report.aidArmy.foodBudget.required);const foodOwner=await evaluate(cdp,'baye.hd.march()'),foodKeys=await evaluate(cdp,'window.__speEngineKeys.length');assert.deepEqual(await evaluate(cdp,'baye.hd.qty()'),food);const foodSelector=await evaluate(cdp,"BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'");await click(cdp,foodSelector);await waitFor(cdp,'actual target instruction','baye.hd.march().phase===3');const foodAck=await evaluate(cdp,'baye.hd.qty()');assert.equal(foodAck.active,0);assert.equal(foodAck.session,food.session);assert.equal(foodAck.value,food.value);assert.equal(foodAck.inputSeq,food.inputSeq===0xffffffff?1:food.inputSeq+1);assert.equal(foodAck.lastKey,39);const foodNativeKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${foodKeys})`);assert.deepEqual(foodNativeKeys.map(k=>k.code),[39]);report.marchFood={food,foodOwner,foodAck,foodNativeKeys,budget:report.aidArmy.foodBudget};await action(cdp,'ack genuine target instruction','BayeHdCityMenu.continueMarch()');await waitFor(cdp,'actual march target owner','baye.hd.march().phase===4&&baye.hd.march().battlePick===1');await readMarchDestination(cdp,'before-selection');assert.equal((await action(cdp,'select actual linked city26','BayeHdCityMenu.selectMarchTarget(32)')).selected,32);await readMarchDestination(cdp,'before-confirmation');await action(cdp,'confirm native current target26','BayeHdCityMenu.confirmMarchTarget(32)');await waitFor(cdp,'real departure report','baye.hd.march().phase===6');await action(cdp,'ack real departure','BayeHdCityMenu.continueMarch()');await waitFor(cdp,'actual AddFightOrder native receipt','baye.hd.march().phase===7&&baye.hd.march().ok===1');report.marchOrderReceipt=await evaluate(cdp,'baye.hd.march()');assert.equal(report.marchOrderReceipt.city,31);assert.equal(report.marchOrderReceipt.obj,32);const actualDispatch=await evaluate(cdp,`(() => {const d=baye.data,raw=Array.from({length:Number(d.FIGHTERS.length)},(_,i)=>Number(d.FIGHTERS[i]));if(raw.length!==600||raw.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Invalid native fighter byte array');const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)===27&&Number(o.City)===31&&Number(o.Object)===32).map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Object:Number(o.Object),Person:Number(o.Person),Food:Number(o.Food),TimeCount:Number(o.TimeCount),army:Array.from({length:10},(_,i)=>{const n=Number(o.Person);if(!Number.isInteger(n)||n<0||n>=30)throw Error('Invalid native fighter order slot');const x=2*(n*10+i);return raw[x]|(raw[x+1]<<8);})}));return {orders,food:Number(d.g_Cities[31].Food),money:Number(d.g_Cities[31].Money),march:baye.hd.march()};})()`);const matching=actualDispatch.orders.filter(o=>JSON.stringify(o.army)===JSON.stringify([...report.marchPersonIds.map(id=>id+1),...Array(10-report.marchPersonIds.length).fill(0)]));assert.equal(matching.length,1,'Actual AddFightOrder preserves exact caster/escort identities and native zero tail');assert.equal(matching[0].Food,report.marchFood.food.value);assert.equal(actualDispatch.food,report.aidArmy.final.city.food-matching[0].Food);assert.equal(actualDispatch.money,report.aidArmy.final.city.money-nativeItem(2,10)[27]);report.actualDispatch=actualDispatch;await checkpoint(cdp,'03-original-dispatch-order');
 await waitFor(cdp,'original map/submenu after actual departure',"(() => {const m=baye.hd.march(),menu=baye.hd.menuItems();return menu.active&&menu.context===1||!menu.active&&m.pick===1&&m.battlePick===0;})()");await action(cdp,'explicit one strategy execution after departure','BayeHdCityMenu.goStrategyEnd()');await waitFor(cdp,'actual battle player selection','baye.hd.fight().active&&!baye.hd.fight().over&&baye.hd.fight().inputKind===1',120000);report.battleDestinationReceipt=await evaluate(cdp,'baye.hd.fight()');assert.equal(report.battleDestinationReceipt.cityIndex,32);await checkpoint(cdp,'04-real-battle-caster');await battleAid(cdp);
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
async function attemptAid(cdp,actor,skillId){
 const current=await evaluate(cdp,battleStateExpression),fresh=current.units.find(u=>u.id===casterNativeId&&u.i===actor.i);assert.ok(fresh&&fresh.side==='player'&&fresh.arms>0&&![8,1,6,2].includes(fresh.state));assert.equal(current.fight.actorIndex,fresh.i);assert.equal(current.fight.inputKind,3);await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[1]'),4);
 const owner=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),options=await evaluate(cdp,skillOptionsExpression),skill=options.find(s=>s.id===skillId),expected=report.actualAidSkills.find(s=>s.id===skillId);assert.ok(skill,'Actual special23/effectivearm5/Lv20 menu includes requested AID skill');assert.equal(skill.name,expected.name);assert.equal(skill.speId,41);assert.equal(skill.useMp,expected.mp);assert.equal(skill.power,expected.power);assert.equal(skill.destroy,0);assert.equal(skill.state,0);assert.equal(skill.aim,1);assert.deepEqual(skill.eland,expected.targetTerrain);assert.deepEqual(skill.earm,expected.targetArm);assert.deepEqual(skill.oland,expected.actorTerrain);assert.deepEqual(skill.weather,expected.weather);
 report.aidOptions??=[];report.aidOptions.push({actor:fresh,skill,options,owner});if(!skill.available){await action(cdp,'cancel genuinely unavailable skill'+skillId,'BayeHdBattle.cancel()');await waitBattle(cdp,3,'actual unavailable skill return');return false;}assert.deepEqual(await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),owner);assert.equal(owner.skills.ids[skill.index],skillId);assert.equal((await action(cdp,'select actual skill ID'+skillId,`BayeHdBattle.pickMenu(${skill.index})`)).ok,true);await waitBattle(cdp,5,'actual skill AIM owner');
 const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='player'&&u.id===allyNativeId&&u.state!==8&&u.state!==6&&u.arms>0&&skill.eland[u.terrain]>0&&Number.isInteger(u.armType)&&skill.earm[u.armType]>0);if(!targets.length){report.missingConditions??=[];report.missingConditions.push({reason:'Current friendly144 is absent from fresh native AIM or does not satisfy actual SKILLEF fields',skillId,owner,current:await evaluate(cdp,battleStateExpression)});await action(cdp,'cancel no legal target for skill'+skillId,'BayeHdBattle.cancel()');await waitBattle(cdp,3,'cancel current empty legal AIM');return false;}
 const before=await evaluate(cdp,battleStateExpression);targets.sort((a,b)=>(before.units.find(u=>u.id===a.id)?.iq??255)-(before.units.find(u=>u.id===b.id)?.iq??255)||b.arms-a.arms||a.i-b.i);const target=targets[0];
 const proof=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,n=Number(r[0]),sx=Number(r[1]),sy=Number(r[2]),u=d.g_GenPos[${target.i}],a=d.g_GenPos[f.actorIndex];return {generation:Number(d.g_hdSpeGeneration),fight:f,casterId:Number(d.g_FgtParam.GenArray[f.actorIndex]),casterMp:Number(a.mp),casterState:Number(a.state),casterActive:Number(a.active),casterTerrain:baye.getTerrainByGeneralIndex(f.actorIndex),weather:Number(d.g_FgtWeather),targetId:Number(d.g_FgtParam.GenArray[${target.i}]),x:Number(u.x),y:Number(u.y),state:Number(u.state),terrain:baye.getTerrainByGeneralIndex(${target.i}),arm:baye.hd.personArmType(Number(d.g_FgtParam.GenArray[${target.i}])-1),size:n,originX:sx,originY:sy,values:Array.from({length:n*n},(_,i)=>Number(r[3+i]))};})()`);
 const capacities=await evaluate(cdp,'('+aidCapacitiesSource.toString()+')()');proof.targetCapacity=capacities.find(p=>p.personIndex===allyPerson).capacity;assert.ok(proof.targetCapacity>=target.arms);assert.equal(proof.generation,owner.generation);assert.equal(proof.fight.active,1);assert.equal(proof.fight.over,0);assert.equal(proof.fight.wait,1);assert.equal(proof.fight.inputKind,5);assert.equal(proof.fight.aimType,1);assert.equal(proof.fight.actorIndex,fresh.i);assert.equal(proof.casterId,casterNativeId);assert.equal(proof.targetId,target.id);assert.equal(proof.casterActive,0);assert.equal(proof.casterMp,fresh.mp);assert.ok(![8,1,6,2].includes(proof.casterState));assert.ok(proof.weather>=1&&proof.weather<=5&&skill.weather[proof.weather-1]>0);assert.ok(skill.oland[proof.casterTerrain]>0&&skill.eland[proof.terrain]>0&&skill.earm[proof.arm]>0);assert.deepEqual([proof.x,proof.y],[target.x,target.y]);assert.ok(proof.state!==8&&proof.state!==6);assert.ok(Number.isInteger(proof.size)&&proof.size>=1&&proof.size<=15&&proof.values.length===proof.size**2&&proof.values.every(v=>Number.isInteger(v)&&v>=0&&v<=255));const px=(target.x-proof.originX)&255,py=(target.y-proof.originY)&255;assert.ok(px<proof.size&&py<proof.size);assert.equal(proof.values[py*proof.size+px],1,'Fresh complete native AIM, never distance inference');
 const reportStart=report.actualReports?.length||0,captureStart=await evaluate(cdp,'window.__aidCaptures.length'),sampleStart=await evaluate(cdp,'window.__speSamples.length'),inputStart=await evaluate(cdp,'window.__speEngineKeys.length');let confirmation;
 await evaluate(cdp,"BayeHdBattle.setMode('classic')");
 const modeBefore=await evaluate(cdp,battleStateExpression);assert.deepEqual(modeBefore,before,'Classic presentation switch preserves current battle world and exact AIM owner');
 report.inputs.push({type:'presentation-mode',mode:'classic',skillId,noGameplayWorldWrites:true});
 for(let n=0;n<512;n++){const f=await evaluate(cdp,'baye.hd.fight()');assert.deepEqual([f.inputKind,f.actorIndex],[5,fresh.i]);if(f.focusX===target.x&&f.focusY===target.y)break;const code=f.focusX<target.x?'ArrowRight':f.focusX>target.x?'ArrowLeft':f.focusY<target.y?'ArrowDown':'ArrowUp',nx=f.focusX+(code==='ArrowRight'?1:code==='ArrowLeft'?-1:0),ny=f.focusY+(code==='ArrowDown'?1:code==='ArrowUp'?-1:0);await key(cdp,code);await waitFor(cdp,'classic friendly native AIM cursor ACK','(()=>{const f=baye.hd.fight();return f.inputKind===5&&f.inputSeq==='+f.inputSeq+'&&f.actorIndex==='+fresh.i+'&&f.focusX==='+nx+'&&f.focusY==='+ny+'})()');if(n===511)throw Error('Classic native AIM movement bound');}
 const aim=await evaluate(cdp,'baye.hd.fight()');assert.deepEqual([aim.focusX,aim.focusY],[target.x,target.y]);await lcdVisible(cdp);await key(cdp,'Enter');confirmation={ok:true,kind:proof.fight.inputKind,inputSeq:proof.fight.inputSeq,source:'genuine CDP keyDown/keyUp within exact native friendly AIM',aim};await waitFor(cdp,'actual target Enter consumed and original AIM owner retired',`(() => {const f=baye.hd.fight();return f.inputSeq!==${proof.fight.inputSeq}||f.inputKind!==5||f.actorIndex!==${fresh.i};})()`,30000);const confirmationKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`);assert.equal(confirmationKeys.filter(k=>k.code===39).length,1,'The exact original AIM transaction has one target Enter before any report ACK');assert.ok(confirmationKeys.every(k=>[34,35,36,37,39].includes(k.code)));await waitActionResolved(cdp,'original aid/stone movie and numeric owner retired');const after=await evaluate(cdp,battleStateExpression),caster=after.units.find(u=>u.id===casterNativeId);assert.ok(caster&&caster.state!==8&&caster.arms>0);assert.equal(fresh.mp-caster.mp,skill.useMp,'Actual exact native MP cost even on natural failure');
 const samples=await evaluate(cdp,`window.__speSamples.slice(${sampleStart})`),movie=samples.filter(r=>r.stage==='lcd-flush'&&r.spe?.active&&r.spe.id===41&&r.spe.kind===2&&r.spe.skillId===skillId&&r.spe.startFrm===0&&r.spe.endFrm===(7)&&r.spe.actorIndex===fresh.i&&r.spe.targetIndex===target.i&&r.spe.display.frameValid),succeeded=movie.length>0;const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`);assert.deepEqual(keys.filter(k=>k.speActive&&k.kind===2||k.resultActive),[],'No skip/return key while actual movie/numbers/hold owns input');
 await evaluate(cdp,"BayeHdBattle.setMode('hd')");
 const appliedGain=after.units.find(u=>u.id===allyNativeId).arms-before.units.find(u=>u.id===allyNativeId).arms;const expectedGain=Math.min(scaledAidPower(skill,proof),proof.targetCapacity-target.arms);if(succeeded)assert.equal(appliedGain,expectedGain,'Actual native capacity-limited ARMS_GAIN');else assert.equal(appliedGain,0);report.aidAttempts??=[];report.aidAttempts.push({actor:fresh,skill,target,proof,before,after,confirmation,captureStart,appliedGain,capacityBefore:proof.targetCapacity,movieEvents:[...new Set(movie.map(r=>r.spe.eventId))],succeeded,reports:(report.actualReports||[]).slice(reportStart),keys:confirmationKeys,allActionKeys:keys});await checkpoint(cdp,'skill'+skillId+(succeeded?'-true-player-movie':'-natural-failure')+'-'+report.aidAttempts.length);return succeeded;
}
async function saveAidEvidence(cdp){if(report.evidenceSaved)return;const raw=await evaluate(cdp,'({captures:window.__aidCaptures,errors:window.__aidObserverErrors,keys:window.__speEngineKeys,samples:window.__speSamples})');for(let i=0;i<raw.captures.length;i++){const c=raw.captures[i],stem='aid-'+String(i).padStart(4,'0')+'-'+(c.result?.phase||'movie');for(const [type,url]of [['native',c.nativeUrl],['hd',c.hdUrl],['lcd',c.nativeCanvasUrl]])if(url){const bytes=Buffer.from(url.split(',')[1],'base64'),file=stem+'-'+type+'.png';writeEvidencePng(file,bytes);c[type==='native'?'nativeFile':type==='lcd'?'lcdFile':'hdFile']={file,bytes:bytes.length,sha256:sha(bytes)};}delete c.nativeUrl;delete c.hdUrl;delete c.nativeCanvasUrl;}report.aidCaptures=raw.captures;report.observerErrors=raw.errors;report.engineInputs=raw.keys;report.speObservations=raw.samples;for(const [name,data]of [['native-skill-captures',raw.captures],['observer-errors',raw.errors],['engine-inputs',raw.keys],['spe-observations',raw.samples]])writeJsonAtomicSync(path.join(artifactDir,name+'.json'),data);report.evidenceSaved=true;await sampleOwned('saved-AID-evidence');assert.deepEqual(raw.errors,[]);}


function runAidDriverSelfTests(){assert.equal(typeof assertPhase3Input,'function');assert.equal(typeof aidCapacitiesSource,'function');assert.deepEqual(report.actualAidSkills.map(s=>[s.id,s.mp,s.power]),[[17,15,800],[29,30,1800]]);assert.equal(report.mapResource,111);report.selfTests={ok:true,scope:'ROM/source only; no browser, actual cast or saved input acceptance'};}

async function main() {
    assert.ok(!fs.existsSync(artifactDir),'Use a fresh artifact directory; preserve all previous evidence');
    fs.mkdirSync(path.dirname(artifactDir),{recursive:true});fs.mkdirSync(artifactDir);
    let server,chrome,cdp,chromeError,profile,ownership=null,rootIdentity=null;
    const historical=new Map();
    sampleOwned=async label=>{if(!chrome)return;try{const s=await snapshotOwnedChrome(chrome.pid,profile),r=s.owned.find(p=>p.ProcessId===chrome.pid),sameRoot=!rootIdentity||!!r&&r.CreationDate===rootIdentity.CreationDate&&r.ExecutablePath===rootIdentity.ExecutablePath&&r.CommandLine===rootIdentity.CommandLine;fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),...persistOwnership(s,sameRoot)})+'\n');if(s.rootVerified&&sameRoot){ownership=s;rootIdentity||=r;for(const p of s.owned)historical.set(p.ProcessId+'|'+p.CreationDate,identity(p));}}catch{fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),error:'Owned sampling failed; previous verified basis retained'})+'\n');}};
    const interrupt=()=>{report.interrupted=true;cdp?.close();};
    process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try {
        prepareServedAssets();await prepareAidSources();assert.ok(resumeDirectory,'Explicit unchanged --from-phase2 is required');prepareResumeInputs();if(selfTest)runAidDriverSelfTests();
        for(const[name,rel]of[['executed-tool.mjs',targetName()],['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],['executed-json-writer.mjs','scripts/hd-runtime-json.mjs'],['executed-aid-oracle.mjs','scripts/hd-aid-runtime-oracle.mjs']])fs.writeFileSync(path.join(artifactDir,name),servedAssets.get(rel).data,{flag:'wx'});
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
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: aidObserverSource });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        await smokeAid(cdp);
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
            try { await saveAidEvidence(cdp); } catch(e) { report.evidenceError=e.stack||String(e); }
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
        report.finishedAt=new Date().toISOString();report.actualCastAccepted=report.ok===true&&report.actualCastAccepted===true;report.hdAccepted=report.ok===true&&report.hdAccepted===true;report.fallbackAccepted=report.ok===true&&report.fallbackAccepted===true;report.accepted=report.ok===true&&(preflightOnly||report.actualCastAccepted&&(report.hdAccepted||report.fallbackAccepted));report.classicNegativeAccepted=report.ok===true&&report.classicNegativeAccepted===true;
        for(const[name,value]of[['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])writeJsonAtomicSync(path.join(artifactDir,name),value);
        console.log('Artifacts:',artifactDir);console.log('Finished',JSON.stringify({ok:report.ok,accepted:report.accepted,actualCastAccepted:report.actualCastAccepted,hdAccepted:report.hdAccepted,fallbackAccepted:report.fallbackAccepted,sources:sources.length}));
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
