#!/usr/bin/env node
/**
 * Ignored FENG39/skill20 preparation: real P2 LiuBiao26, SEARCH acquisition of XuShu171, allied LiuQi115, march26->20.
 * --preflight-only checks frozen actual ROM/source metadata and never starts Chrome.
 * --baseline-only stops after genuine acquisition/dispatch/current skill menu; default mode additionally casts the actual same-side state4 spell.
 * Strict mode accepts only authenticated FENG39 real timer frames, original state report and native scope retirement; no NUM/hold is invented.
 * --search-orders 8 and --search-months 12 are explicit private-game budgets, never new native rules or guaranteed recruitment.
 * Windows: node scripts/test-hd-qimen-runtime.mjs --preflight-only --artifact-dir build/r16-qimen-preflight
 * Wait for the root source-freeze authorization before any browser run. No user8080/profile/save is reused.
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
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/r16-qimen-runtime'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream' };
const preflightOnly=process.argv.includes('--preflight-only'),baselineOnly=process.argv.includes('--baseline-only'),allowLcd=process.argv.includes('--allow-lcd'),recruit=process.argv.includes('--recruit');
const numberArg=(name,fallback,max)=>{const i=process.argv.indexOf(name),text=i<0?String(fallback):process.argv[i+1];assert.ok(/^\d+$/.test(text||''));const value=Number(text);assert.ok(Number.isInteger(value)&&value>0&&value<=max);return value;};
const recruitArms=numberArg('--recruit-arms',800,65535),maxTurns=numberArg('--max-turns',4,20),searchMonths=numberArg('--search-months',12,60),searchOrders=numberArg('--search-orders',8,12);
assert.ok(!process.argv.includes('--recruit-arms')||recruit,'Custom troop request requires real recruitment');
const period=2,originCity=26,destination=20,casterPerson=171,casterNativeId=172,allyPerson=115,skillId=20,speId=39,acceptedRange=[39,0,7];
const requestedActor=p=>p.personIndex===casterPerson;
const report = { preflightOnly,baselineOnly,allowLcd,recruit,recruitArms,searchMonths,searchOrders,period,originCity,destination,casterPerson,allyPerson,skillId,speId,maxTurns, staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const servedAssets = new Map();
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const nativeMovies=new Map();let nativeLib,qimenEntry,font;
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
 freezeAsset('pc.html');qimenEntry=manifest.entries.find(e=>e.speId===39&&e.kind===2&&e.resourceIndex===0&&e.startFrm===0&&e.endFrm===7)||null;
 const movie=nativeMovie(39);assert.deepEqual([movie.count,movie.picmax,movie.start,movie.end,movie.length,movie.fingerprint],[8,2,0,7,1084,'fnv1a32:6b0ebc5a:1084']);
 assert.ok(movie.units.every((u,i)=>u.x===0&&u.y===0&&u.picIndex===i%2));assert.ok(movie.pictures.every(p=>p.width===64&&p.height===64&&p.mask===0));
 if(!baselineOnly&&!allowLcd)assert.ok(qimenEntry,'Strict actual HD test awaits published, authenticated FENG39 entry; missing art is not HD completion');
 if(qimenEntry){assert.equal(qimenEntry.resourceFingerprint,movie.fingerprint);assert.equal(qimenEntry.resourceLength,movie.length);assert.equal(qimenEntry.count,8);assert.equal(qimenEntry.picmax,2);
  assert.equal(qimenEntry.units.length,8);assert.equal(qimenEntry.pictures.length,2);
  qimenEntry.units.forEach((u,i)=>{const r=movie.units[i];assert.deepEqual({frame:u.frame,x:u.x,y:u.y,picIndex:u.picIndex},{frame:i,x:r.x,y:r.y,picIndex:r.picIndex});});
  qimenEntry.pictures.forEach((p,i)=>{const r=movie.pictures[i],png=servedAssets.get(p.src).data;assert.equal(p.picIndex,i);assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[r.width,r.height,r.width,r.height,r.mask]);assert.equal(png.readUInt32BE(16),p.width);assert.equal(png.readUInt32BE(20),p.height);});
 }
 const nameBytes=nativeItem(11,19),special=nativeItem(14,1);assert.equal(special.readUInt16LE(casterPerson*2),20);
 report.qimenNativeResource={id:39,index:0,start:0,end:7,count:8,picmax:2,length:movie.length,fingerprint:movie.fingerprint,units:movie.units,pictures:movie.pictures.map((p,i)=>({picIndex:i,width:p.width,height:p.height,mask:p.mask})),
  actualSkillName:{resourceId:11,itemIndex:19,bytes:nameBytes.length,hex:nameBytes.toString('hex'),name:new TextDecoder('gbk',{fatal:true}).decode(nameBytes)},
  actualSpecialSkill:{resourceId:14,itemIndex:1,period:2,personIndex:171,elementBytes:2,offset:342,skillId:special.readUInt16LE(342)}};
 const build=JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));assert.equal(build.hdSpeProtocol.version,2);assert.equal(build.hdSkillResultProtocol.version,1);

 const routeBytes=freezeAsset('docs/validation/m4-qimen-20261009/route-plan.json').data,contractBytes=freezeAsset('docs/validation/m4-qimen-20261009/search-contract.json').data;
 const route=JSON.parse(routeBytes),contract=JSON.parse(contractBytes);assert.equal(sha(contractBytes),'644af0beac307c852d4f8239cc477e006251bdcddb16641493e1ed7e24b5cba3');
 assert.equal(route.library.sha256,report.sources['libs/dat-mod.lib'].sha256);assert.equal(contract.library.sha256,route.library.sha256);
 const p=route.preferred,cities=nativeItem(57,1),people=nativeItem(61,1),queue=nativeItem(65,1),specialSkills=nativeItem(14,1),skill=nativeItem(10).subarray(19*34,20*34);
 assert.equal(cities.readUInt16LE(38*37),198);
 for(const [i,record] of [[26,p.origin.recordHex],[20,p.dispatch.cityRecordHex]].filter(v=>v[1]))assert.equal(cities.subarray(i*37,i*37+37).toString('hex'),record);
 for(const person of [p.lord,p.caster,p.casterPrerequisite.searcher,p.targetAlly])assert.equal(people.subarray(person.personIndex*19,person.personIndex*19+19).toString('hex'),person.recordHex);
 const c=cities.subarray(26*37,27*37),queueOffset=c.readUInt16LE(29),queueCount=c.readUInt16LE(31),actualQueue=Array.from({length:queueCount},(_,i)=>queue.readUInt16LE((queueOffset+i)*2));
 assert.deepEqual(actualQueue,p.origin.rawQueue);assert.ok(actualQueue.includes(171));assert.equal(people.readUInt16LE(171*19+2),0);assert.equal(people.readUInt16LE(115*19+2),13);
 assert.equal(specialSkills.readUInt16LE(342),20);assert.equal(skill.toString('hex'),p.skill.recordHex);assert.deepEqual(Array.from(skill.subarray(0,7)),[1,4,0,0,0,0,20]);
 const range=nativeItem(13).subarray(19*81,20*81);assert.equal(range.length,81);assert.equal(range.filter(v=>v===1).length,24);assert.equal(range[40],2);
 const condition=nativeItem(63,1).subarray(171*4,172*4);assert.equal(condition.toString('hex'),'b400001b');
 const thew=nativeItem(2,9)[3],money=nativeItem(2,10)[3];assert.equal(thew,8);assert.equal(money,0);
 const map=nativeItem(111);assert.equal(map.length,1040);assert.deepEqual([map[0],map[2]],[32,32]);assert.equal(map[16+29*32+16],1);assert.equal(map[16+30*32+16],1);
 const link=nativeItem(59).subarray(26*16,26*16+8);assert.deepEqual(Array.from(link),p.dispatch.originNativeLinks);assert.ok(link.includes(21));
 report.searchNativeCost={commandId:3,resourceId:2,thewItem:9,moneyItem:10,thew,money};
 report.inputPlans={route:{source:'docs/validation/m4-qimen-20261009/route-plan.json',bytes:routeBytes.length,sha256:sha(routeBytes)},searchContract:{source:'docs/validation/m4-qimen-20261009/search-contract.json',bytes:contractBytes.length,sha256:sha(contractBytes)}};
 report.qimenRouteRomProof={period:2,year:198,lord:p.lord,caster:p.caster,rawQueue:actualQueue,alliedQueue:actualQueue.filter(id=>people.readUInt16LE(id*19+2)===13),special20:true,currentUnowned171:true,searchCondition:condition.toString('hex'),ally:p.targetAlly,dispatch:p.dispatch,mapId:111,width:32,height:32,nativeAim:Array.from(range),notClaimed:'Static ROM facts only. No true ownership, successful search, current MP/skill availability, dispatch, cast or HD acceptance is claimed.'};

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
    if (state.fight?.active) state.rawBattle = await evaluate(cdp, battleStateExpression);
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
const speObserverSource='('+function(){
 window.__speSamples=[];window.__skillCaptures=[];window.__speEngineKeys=[];window.__speObserverErrors=[];window.__spePhase='opening';window.__skillDrawLog=[];
 let api=null,originalKey=null,lastQimen=null;const held=new Set();
 for(const name of ['clearRect','drawImage','fillRect','fillText','rect','clip']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(){const result=original.apply(this,arguments);if(this.canvas&&this.canvas.id==='hd-spe-canvas'){const args=Array.from(arguments);if(name==='clearRect'&&args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height)window.__skillDrawLog=[];let op={type:name,args,fillStyle:this.fillStyle,font:this.font};if(name==='drawImage'){const source=args.shift();op.src=source.src?new URL(source.src,location.href).pathname.replace(/^\//,''):null;op.args=args;op.naturalWidth=source.naturalWidth||source.width;op.naturalHeight=source.naturalHeight||source.height;}if(name==='fillText'){op.text=String(args.shift());op.args=args;}window.__skillDrawLog.push(op);}return result;};}
 const snapshot=()=>{try{return baye.hd.ready()?JSON.parse(JSON.stringify({spe:baye.hd.spe(),result:baye.hd.skillResult(),top:baye.hd.resultOwner(),fight:baye.hd.fight()})):null;}catch{return null;}};
 function capture(stage,img,w,h,callbackBefore,callbackAfter){try{
  if(!window.baye||!baye.hd||!baye.hd.ready())return;
  const s=snapshot(),spe=s.spe,result=s.result,ui=api&&api.debugSnapshot();window.__speSamples.push({stage,phase:window.__spePhase,at:performance.now(),spe,result,top:s.top,ui});
  if(spe.active&&spe.id===39&&spe.kind===2)lastQimen={generation:spe.generation,eventId:spe.eventId,actorIndex:spe.actorIndex,targetIndex:spe.targetIndex,skillId:spe.skillId};
  const isQimen=result.active&&result.speId===39,key=result.generation+':'+result.session;
  const readback=stage==='lifecycle'&&isQimen&&result.phase==='hold'&&result.display&&result.display.valid&&!held.has(key);
  if(readback){const lcd=document.getElementById('lcd');img=lcd.getContext('2d').getImageData(0,0,lcd.width,lcd.height);w=lcd.width;h=lcd.height;held.add(key);}
  if((stage==='lcd-flush'||readback)&&img&&(isQimen||lastQimen)){
   const before=snapshot(),native=document.createElement('canvas'),hd=document.getElementById('hd-spe-canvas');native.width=w||img.width;native.height=h||img.height;native.getContext('2d').putImageData(img,0,0);
   const base64=data=>{let text='';for(const byte of data)text+=String.fromCharCode(byte);return btoa(text);};
   const rect=ui.sourceRect;let hdLogicalRgba=null;if(hd&&ui.open&&rect&&hd.width===rect.width*ui.scale&&hd.height===rect.height*ui.scale){const data=hd.getContext('2d').getImageData(0,0,hd.width,hd.height).data,logical=[];for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++){const offset=(Math.floor((y+.5)*ui.scale)*hd.width+Math.floor((x+.5)*ui.scale))*4;for(let channel=0;channel<4;channel++)logical.push(data[offset+channel]);}hdLogicalRgba=base64(logical);}
   const node=document.getElementById('hd-spe'),r=hd&&hd.getBoundingClientRect(),style=hd&&getComputedStyle(hd),rootStyle=node&&getComputedStyle(node),top=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   const dom=r&&{x:r.x,y:r.y,width:r.width,height:r.height,visible:!!(r.width&&r.height&&style.visibility==='visible'&&style.display!=='none'&&rootStyle.visibility==='visible'&&rootStyle.display!=='none'),inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,stackOwned:!!(top&&node.contains(top)),top:top&&{id:top.id,className:top.className}};
   const nativeUrl=native.toDataURL('image/png'),hdUrl=hd&&ui.open&&hd.toDataURL('image/png'),after=snapshot();
   window.__skillCaptures.push({stage:readback?'held-lcd-readback':'lcd-flush',rawSource:readback?'canvas-readback-normalized':'lcd-callback-image-data',at:performance.now(),callbackBefore,callbackAfter,before,after,spe,result,top:s.top,ui,dom,lastQimen,lastFight:s.fight,hidden:document.hidden,mode:BayeHdBattle.getMode(),drawing:{scale:Number(baye.data.g_scale),flip:Number(baye.data.g_FlipDrawing),paint:Number(baye.data.g_paintColor),palette0:Number(baye.data.g_paintPalette[0]),palette255:Number(baye.data.g_paintPalette[255])},nativeWidth:native.width,nativeHeight:native.height,nativeRgba:base64(img.data),hdLogicalRgba,nativeUrl,hdUrl,drawLog:window.__skillDrawLog.slice()});
  }
  if(!spe.active&&!result.active&&s.fight.inputKind===1)lastQimen=null;
  if(window.__skillCaptures.length>2000||window.__speSamples.length>20000)throw Error('Read-only capture limit');
 }catch(e){window.__speObserverErrors.push(String(e));}}
 Object.defineProperty(window,'BayeHdSpe',{configurable:true,get(){return api;},set(value){api=value;for(const name of ['onEngineSpe','onLcdFlush']){const original=api[name];api[name]=function(){const before=snapshot(),result=original.apply(this,arguments),after=snapshot();capture(name==='onLcdFlush'?'lcd-flush':'lifecycle',name==='onLcdFlush'?arguments[0]:null,arguments[1],arguments[2],before,after);return result;};}if(!originalKey&&typeof window.sendKey==='function'){originalKey=window.sendKey;window.sendKey=function(code){const s=snapshot();window.__speEngineKeys.push({code,at:performance.now(),phase:window.__spePhase,generation:s&&s.spe.generation,eventId:s&&s.spe.eventId,kind:s&&s.spe.kind,speActive:s&&s.spe.active,resultActive:s&&s.result.active,resultSession:s&&s.result.session,resultPhase:s&&s.result.phase});return originalKey.apply(this,arguments);};}}});
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
    await waitFor(cdp, 'real period2 lord selection', 'Number(baye.data.g_PIdx)===2 && baye.hd.kings().count>0');
    const lord = await evaluate(cdp, "(() => {const m=baye.hd.kings();return {target:m.kings.findIndex(k=>k.id===12&&k.name==='刘表'),index:m.index,kings:m.kings};})()");
    assert.ok(lord.target >= 0, 'Actual period2 contains LiuBiao person12');
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'native lord highlight', 'baye.hd.kings().index===' + lord.target);
    report.selectedLord = lord.kings[lord.target];assert.equal(report.selectedLord.id,12);
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

// Runtime fragment for the real Qimen driver; the builder embeds these helpers.
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
    report.recruitment={cityIndex,requestedArms:recruitArms,expectedCasterPerson:casterPerson,actualCasterArmType:actor.armType,recruiter,actor,casterNativeGenId:actor.nativeGenId,before,chosen,quantity,confirmation,enlistments,enlisted,enlistRetirement,distribute,distribution,distributionConfirmation,distributionOutcome,equipped,nativeInputs:await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`),scope:'Original bounded conscription into actual city reserve followed by original distribution to current caster person171/native172. Exact IDs, money, orders, queues and receipts are recorded; no world setters, automatic time advance or artificial troops.'};
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
    assert.ok(facts.origin&&facts.origin.i===originCity&&facts.origin.owned&&facts.origin.belong===facts.playerBelong,'襄阳 is currently owned by the actual player');
    assert.ok(facts.target&&facts.target.i===destination&&facts.target.owned===false&&Number.isInteger(facts.target.belong)&&
        facts.target.belong!==facts.origin.belong,'Requested destination currently has different native ownership');
    assert.equal(facts.nativeLinkMask.length,8);
    assert.ok(facts.nativeLinkMask.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'All eight actual native link bytes are available');
    const resource=nativeItem(59),offset=originCity*16;
    assert.ok(offset+8<=resource.length,'CITY_LINKR actual item contains the 襄阳 native row');
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


// Embedded by the ignored candidate builder. All changes are genuine UI input.
function campaignWorldExpression() {
    return `(() => {
        const d=baye.data,c=d.g_Cities[${originCity}],count=baye.getPersonCount();
        const generationBefore=Number(d.g_hdSpeGeneration),keysBefore=window.__speEngineKeys.length;
        const queue=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));
        const read=id=>{if(!Number.isInteger(id)||id<0||id>=count)throw Error('Invalid current person ID');const p=d.g_Persons[id];
            return {id,personIndex:id,nativeId:id+1,name:baye.getPersonName(id),belong:Number(p.Belong),oldBelong:Number(p.OldBelong),iq:Number(p.IQ),thew:Number(p.Thew),arms:Number(p.Arms),devotion:Number(p.Devotion),level:Number(p.Level),armType:baye.hd.personArmType(id),equip:[Number(p.Tool1),Number(p.Tool2)]};};
        const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)!==255)
            .map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),TimeCount:Number(o.TimeCount)}));
        const orderedPeople=orders.map(o=>o.Person).filter(id=>Number.isInteger(id)&&id>=0&&id<count);
        const resident=queue.map(read),observed=Array.from(new Set([...queue,...orderedPeople,${casterPerson},${allyPerson},110,12])).map(read);
        const cities=baye.hd.realm().cities.map(c=>({i:c.i,name:c.name,belong:c.belong,owned:c.owned}));
        return {generationBefore,generationAfter:Number(d.g_hdSpeGeneration),keysBefore,keysAfter:window.__speEngineKeys.length,
            city:${originCity},cityBelong:Number(c.Belong),playerKing:Number(d.g_PlayerKing),personQueueOffset:Number(c.PersonQueue),queue,resident,observed,orders,cities,
            money:Number(c.Money),food:Number(c.Food),reserve:Number(c.MothballArms),date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)},
            enable16bitConsumeMoney:Number(d.g_engineConfig.enable16bitConsumeMoney),menu:baye.hd.menuItems(),march:baye.hd.march(),qty:baye.hd.qty(),report:baye.hd.report()};
    })()`;
}
async function observeCampaign(cdp,stage) {
    const world=await evaluate(cdp,campaignWorldExpression());
    assert.equal(world.generationAfter,world.generationBefore,'Current world read is one native generation');
    assert.equal(world.keysAfter,world.keysBefore,'Readonly campaign observation emits no native input');
    assert.equal(world.playerKing,12); assert.equal(world.cityBelong,13,'Current city must still be owned by real LiuBiao');
    assert.equal(world.enable16bitConsumeMoney,0,'Verified standard command-cost layout remains current');
    report.campaignObservations??=[];report.campaignObservations.push({stage,world});return world;
}
function isActualOwnedCaster(world) {
    const caster=world.observed.find(p=>p.personIndex===casterPerson);
    return !!(caster&&caster.belong===world.cityBelong&&world.queue.includes(casterPerson));
}
async function waitCampaignOutcome(cdp,label,predicate,timeout=120000) {
    const acknowledged=new Set(),deadline=Date.now()+timeout;
    while(Date.now()<deadline) {
        const s=await evaluate(cdp,'({fight:baye.hd.fight(),menu:baye.hd.menuItems(),report:baye.hd.report(),qty:baye.hd.qty(),march:baye.hd.march(),dialog:BayeHdDialog.debugSnapshot(),city:BayeHdCityMenu.debugSnapshot(),phase:BayeHdOverworld.debugSnapshot().phase})');
        assert.ok(!s.fight.active||s.fight.over,'Unexpected real campaign battle is preserved as failure; never auto-resolved by this search baseline');
        if(s.report.active) {
            const owner=s.dialog.reportOwner;
            if(s.dialog.open&&s.dialog.kind==='report'&&owner&&owner.seq===s.report.seq&&owner.inputSeq===s.report.inputSeq) {
                const token=JSON.stringify(owner);
                if(!acknowledged.has(token)) {
                    acknowledged.add(token);
                    const world=await observeCampaign(cdp,label+'-report-'+s.report.seq),start=await evaluate(cdp,'window.__speEngineKeys.length');
                    report.campaignReports??=[];const record={label,owner,native:s.report,body:s.dialog.body,world,inputStart:start};report.campaignReports.push(record);
                    await checkpoint(cdp,'search-report-'+report.campaignReports.length);
                    const fresh=await evaluate(cdp,'baye.hd.report()');assert.equal(fresh.active,1);assert.equal(fresh.seq,owner.seq);assert.equal(fresh.inputSeq,owner.inputSeq);
                    await click(cdp,'#hd-dialog [data-hd-dlg-ok]');
                    record.keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);
                    assert.deepEqual(record.keys.map(k=>k.code),[0x27],'Exactly one current native report confirmation');
                }
            }
        } else if(!s.qty.active&&!s.city.sending&&!s.city.queueLen&&predicate(s)) return s;
        await delay(100);
    }
    throw Error('Timeout: '+label+'; original reports/world retained, no automatic restart');
}
async function retireSearchToMap(cdp,label) {
    const before=await observeCampaign(cdp,label+'-before-back'),start=await evaluate(cdp,'window.__speEngineKeys.length');
    for(let step=0;step<4;step++) {
        const state=await waitCampaignOutcome(cdp,label+'-current-back-owner',s=>s.menu.active&&s.menu.context===1||!s.menu.active&&s.march.pick===1&&s.march.phase===0);
        if(!state.menu.active) break;
        const owner={generation:before.generationBefore,context:state.menu.context,kind:state.menu.kind,seq:state.menu.seq,detailGeneration:state.menu.detailGeneration};
        const fresh=await evaluate(cdp,'({menu:baye.hd.menuItems(),generation:Number(baye.data.g_hdSpeGeneration)})');
        assert.deepEqual({generation:fresh.generation,context:fresh.menu.context,kind:fresh.menu.kind,seq:fresh.menu.seq,detailGeneration:fresh.menu.detailGeneration},owner);
        const keyStart=await evaluate(cdp,'window.__speEngineKeys.length');await click(cdp,'#hd-city-menu [data-hd-menu-back]');
        await waitFor(cdp,label+' exact current menu owner retired',`!baye.hd.menuItems().active||baye.hd.menuItems().seq!==${owner.seq}`);
        const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${keyStart})`);assert.deepEqual(keys.map(k=>k.code),[0x28]);
    }
    const map=await waitCampaignOutcome(cdp,label+' real map',s=>!s.menu.active&&s.march.pick===1&&s.march.phase===0&&s.march.battlePick===0&&s.phase==='map'&&!s.city.open);
    const after=await observeCampaign(cdp,label+'-after-back');
    for(const field of ['queue','observed','orders','money','food','reserve','date'])assert.deepEqual(after[field],before[field],label+' Back cannot change '+field);
    return {before,after,map,keys:await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)};
}
function searchMenuIdentity(picker) {
    const m=picker.menu;
    return {active:m.active,context:m.context,kind:m.kind,seq:m.seq,generation:m.generation,detailGeneration:m.detailGeneration,idsValid:m.idsValid,ids:m.ids,names:m.names};
}
async function currentSearchPicker(cdp) {
    return waitFor(cdp,'actual SEARCH native owner/IDs and visible input surface',`(() => {
        const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),d=baye.data,c=d.g_Cities[${originCity}],q=baye.hd.qty(),r=baye.hd.report();
        if(!s.open||s.layer!=='deep'||s.subKind!=='neizheng'||s.deepLabel!=='搜寻'||!m.active||m.context!==1||m.kind!==3||!m.idsValid||!m.ids.length||s.sending||s.queueLen||q.active||r.active)return false;
        if(m.generation!==Number(d.g_hdSpeGeneration)||m.detailGeneration!==Number(d.g_hdDetailGeneration)||!Number.isInteger(m.index)||m.index<0||m.index>=m.ids.length)return false;
        const actual=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong));
        if(JSON.stringify(actual)!==JSON.stringify(m.ids))throw Error('Current SEARCH menu IDs differ from actual allied PersonQueue');
        const owner=s.deepMenuOwner,hd=owner&&owner.context===m.context&&owner.kind===m.kind&&owner.seq===m.seq&&owner.detailGeneration===m.detailGeneration&&m.ids.every((id,index)=>s.deepItems.some(item=>item.i===index&&item.pind===id));
        if(hd)return {mode:'hd',menu:m,city:s,personIds:actual};
        if(s.deepKind!=='lcd')return false;
        const lcd=document.getElementById('lcd');if(!lcd)return false;
        const rect=lcd.getBoundingClientRect(),style=getComputedStyle(lcd),container=getComputedStyle(lcd.parentElement),points=[[.2,.2],[.5,.5],[.8,.8]];
        if(!rect.width||!rect.height||style.visibility!=='visible'||style.display==='none'||container.visibility!=='visible'||container.display==='none'||rect.x<0||rect.y<0||rect.right>innerWidth+.5||rect.bottom>innerHeight+.5)return false;
        if(!points.every(p=>{const stack=document.elementsFromPoint(rect.x+rect.width*p[0],rect.y+rect.height*p[1]);return stack[0]===lcd;}))return false;
        return {mode:'native-lcd',menu:m,city:s,personIds:actual,lcd:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,visible:true,stackOwned:true}};
    })()`);
}
async function selectActualSearchActor(cdp,picker,personIndex,month,number) {
    const identity=searchMenuIdentity(picker),index=picker.menu.ids.indexOf(personIndex);
    assert.ok(index>=0);const record={month,number,personIndex,nativeId:personIndex+1,mode:picker.mode,owner:identity,initialIndex:picker.menu.index,moves:[]};
    report.searchSelections??=[];report.searchSelections.push(record);
    if(picker.mode==='hd') {
        assert.equal(picker.city.deepItems.find(item=>item.i===index)?.pind,personIndex);
        await click(cdp,`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${personIndex}"]`);return record;
    }
    assert.equal(picker.mode,'native-lcd');
    let current=await currentSearchPicker(cdp);assert.deepEqual(searchMenuIdentity(current),identity);
    for(let step=0;current.menu.index!==index&&step<identity.ids.length;step++) {
        const before=await observeCampaign(cdp,`search-${month}-${number}-lcd-arrow-before`),old=current.menu.index,next=old+(index>old?1:-1),name=index>old?'ArrowDown':'ArrowUp',code=index>old?0x23:0x22,start=await evaluate(cdp,'window.__speEngineKeys.length');
        await key(cdp,name);
        await waitFor(cdp,'exact current SEARCH native highlight ACK',`(() => {const m=baye.hd.menuItems();return m.active&&m.context===1&&m.kind===3&&m.seq===${identity.seq}&&m.generation===${identity.generation}&&m.detailGeneration===${identity.detailGeneration}&&m.index===${next};})()`);
        current=await currentSearchPicker(cdp);assert.deepEqual(searchMenuIdentity(current),identity);assert.equal(current.menu.index,next);
        const after=await observeCampaign(cdp,`search-${month}-${number}-lcd-arrow-after`),keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);
        assert.deepEqual(keys.map(k=>k.code),[code],'Exactly one physical key belongs to this unchanged native SEARCH owner');
        for(const field of ['queue','observed','orders','money','food','reserve','date'])assert.deepEqual(after[field],before[field],'Native highlight alone cannot change '+field);
        record.moves.push({key:name,code,beforeIndex:old,afterIndex:next,keys});
    }
    assert.equal(current.menu.index,index);assert.equal(current.menu.ids[index],personIndex);assert.deepEqual(searchMenuIdentity(current),identity);
    record.confirmedOwner=current;record.inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    await checkpoint(cdp,`search-${month}-${number}-actual-lcd-person-${personIndex}`);
    const fresh=await currentSearchPicker(cdp);assert.deepEqual(searchMenuIdentity(fresh),identity);assert.equal(fresh.menu.index,index);assert.equal(fresh.menu.ids[index],personIndex);
    await key(cdp,'Enter');record.confirmationKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${record.inputStart})`);
    assert.deepEqual(record.confirmationKeys.map(k=>k.code),[0x27],'One physical Enter selects the freshly highlighted native person ID');return record;
}

async function enterSearchPicker(cdp,month) {
    const world=await observeCampaign(cdp,'search-month-'+month+'-before-city');
    assert.ok(await action(cdp,'open-actual-search-city',`BayeHdOverworld.walkToCity(${originCity})`));
    await waitFor(cdp,'current native city root',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return s.open&&s.layer==='root'&&s.cityIndex===${originCity}&&m.active&&m.context===1&&m.kind===1;})()`);
    const rootMenu=await evaluate(cdp,'baye.hd.menuItems()'),rootIndex=rootMenu.names.indexOf('内政');assert.ok(rootIndex>=0);
    await click(cdp,`#hd-city-menu [data-hd-root="${rootIndex}"]`);
    await waitFor(cdp,'real interior submenu',"BayeHdCityMenu.getLayer()==='sub'&&baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2");
    const sub=await evaluate(cdp,'baye.hd.menuItems()'),index=sub.names.indexOf('搜寻');assert.ok(index>=0,'Actual original menu contains SEARCH');
    await click(cdp,`#hd-city-menu [data-hd-sub="${index}"]`);
    const current=await currentSearchPicker(cdp);
    assert.deepEqual(current.menu.ids,world.resident.filter(p=>p.belong===world.cityBelong).map(p=>p.personIndex));
    assert.ok(!current.menu.ids.includes(casterPerson)||isActualOwnedCaster(world),'Unowned XuShu cannot be selected as a search actor');
    return current;
}
async function commitSearchOrder(cdp,personIndex,month,number) {
    const picker=await currentSearchPicker(cdp),before=await observeCampaign(cdp,`search-${month}-${number}-before`);
    const actual=before.resident.find(p=>p.personIndex===personIndex),index=picker.menu.ids.indexOf(personIndex);
    assert.ok(actual&&index>=0&&actual.belong===13&&actual.thew>=report.searchNativeCost.thew);
    assert.ok(personIndex!==casterPerson&&personIndex!==allyPerson&&personIndex!==12,'Search retains actual future caster/ally/lord');
    if(picker.mode==='hd')assert.equal(picker.city.deepItems.find(p=>p.i===index)?.pind,personIndex);
    const start=await evaluate(cdp,'window.__speEngineKeys.length');
    const fresh=await evaluate(cdp,'({menu:baye.hd.menuItems(),generation:Number(baye.data.g_hdSpeGeneration)})');
    assert.deepEqual(fresh.menu,picker.menu);assert.equal(fresh.generation,before.generationBefore);
    const selection=await selectActualSearchActor(cdp,picker,personIndex,month,number);
    const outcome=await waitCampaignOutcome(cdp,`search-${month}-${number}-original-speech-and-order`,s=>s.menu.active&&s.menu.context===1&&s.menu.kind===3&&s.city.deepLabel==='搜寻'||!s.menu.active&&s.march.pick===1&&s.march.phase===0);
    const after=await observeCampaign(cdp,`search-${month}-${number}-actual-queued`);
    assert.equal(after.money,before.money,'Standard SEARCH consumes zero actual money');
    assert.equal(after.observed.find(p=>p.personIndex===personIndex)?.thew,actual.thew-report.searchNativeCost.thew);
    assert.deepEqual(after.queue,before.queue.filter(id=>id!==personIndex),'Successful AddOrderHead removes only the actual searcher');
    const orders=after.orders.filter(o=>o.OrderId===3&&o.City===originCity&&o.Person===personIndex);
    assert.equal(orders.length,before.orders.filter(o=>o.OrderId===3&&o.City===originCity&&o.Person===personIndex).length+1);
    assert.equal(orders.at(-1).TimeCount,0);assert.deepEqual(after.date,before.date,'Queuing SEARCH does not execute it or advance time');
    assert.equal(after.observed.find(p=>p.personIndex===casterPerson).belong,before.observed.find(p=>p.personIndex===casterPerson).belong,'A search order is not fake acquisition');
    const record={month,number,personIndex,nativeId:personIndex+1,actual,before,after,outcome,selection,owner:picker.menu,keys:await evaluate(cdp,`window.__speEngineKeys.slice(${start})`)};
    report.searchOrderRecords??=[];report.searchOrderRecords.push(record);return record;
}
async function executeSearchMonth(cdp,month,orders) {
    const retirement=await retireSearchToMap(cdp,'search-month-'+month),before=await observeCampaign(cdp,'search-month-'+month+'-before-strategy-end');
    assert.ok(!before.menu.active&&!before.qty.active&&!before.report.active&&before.march.pick===1&&before.march.battlePick===0);
    // The original period/lord flow explicitly used classic System UI. Restore
    // HD through the visible player toolbar while the actual native map owns input.
    const modeInputStart=await evaluate(cdp,'window.__speEngineKeys.length'),modeBefore=await evaluate(cdp,'BayeHdSystemUi.debugSnapshot()');
    await click(cdp,'#baye-hd-toolbar [data-hd-system-ui="hd"]');
    await waitFor(cdp,'explicit player HD System UI mode',"BayeHdSystemUi.debugSnapshot().pref==='hd'");
    const modeAfter=await observeCampaign(cdp,'search-month-'+month+'-after-Hd-interface-button'),modeKeys=await evaluate(cdp,`window.__speEngineKeys.slice(${modeInputStart})`);
    assert.deepEqual(modeKeys,[],'Interface mode selection emits no native key');
    for(const field of ['queue','observed','orders','money','food','reserve','date'])assert.deepEqual(modeAfter[field],before[field],'Player HD Interface selection cannot change '+field);
    assert.ok(!modeAfter.menu.active&&!modeAfter.qty.active&&!modeAfter.report.active&&modeAfter.march.pick===1&&modeAfter.march.phase===0&&modeAfter.march.battlePick===0);
    report.systemModeChanges??=[];report.systemModeChanges.push({month,before:modeBefore,after:await evaluate(cdp,'BayeHdSystemUi.debugSnapshot()'),worldBefore:before,worldAfter:modeAfter,keys:modeKeys});
    const start=await evaluate(cdp,'window.__speEngineKeys.length');
    await key(cdp,'Escape');
    const owner=await waitFor(cdp,'current original strategy menu',"(() => {const m=baye.hd.menuItems();return m.active&&m.context===2&&m.names[0]==='策略结束'&&BayeHdSystemUi.isOpen()&&BayeHdSystemUi.getScreen()==='insystem'&&m;})()");
    const fresh=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(fresh,owner);
    await click(cdp,'#hd-system-ui [data-hd-sys="0"][data-hd-sys-owner]');
    const serial=d=>d.year*12+d.month-1,expected=serial(before.date)+1;
    await waitCampaignOutcome(cdp,'search-month-'+month+' original ComputerTactic/PolicyExec/ConditionUpdate',s=>!s.menu.active&&s.march.pick===1&&s.march.battlePick===0&&s.phase==='map'&&!s.city.open&&s.march.mapInputSeq>before.march.mapInputSeq,180000);
    const after=await observeCampaign(cdp,'search-month-'+month+'-after-original-execution');
    assert.equal(serial(after.date),expected,'Exactly one genuine strategy month was executed');
    for(const order of orders) {
        assert.ok(after.queue.includes(order.personIndex),'Actual searcher returned via original AddPerson');
        assert.equal(after.observed.find(p=>p.personIndex===order.personIndex)?.belong,13);
        assert.equal(after.orders.filter(o=>o.OrderId===3&&o.City===originCity&&o.Person===order.personIndex).length,0,'Original search order was executed and deleted');
    }
    const keys=await evaluate(cdp,`window.__speEngineKeys.slice(${start})`);
    assert.equal(keys.filter(k=>k.code===0x28).length,1,'One native map EXIT opens FunctionMenu; no second EXIT is manufactured');
    const result={month,retirement,before,after,orders:orders.map(o=>({personIndex:o.personIndex,nativeId:o.nativeId})),functionOwner:owner,keys,owned:isActualOwnedCaster(after)};
    report.searchMonthRecords??=[];report.searchMonthRecords.push(result);await checkpoint(cdp,'search-month-'+month+'-original-world');return result;
}
async function searchForActualCaster(cdp) {
    const initial=await observeCampaign(cdp,'search-initial-original-city'),caster=initial.observed.find(p=>p.personIndex===casterPerson);
    assert.equal(caster.belong,0,'Original P2 XuShu starts unowned, never in an allied dispatch');
    assert.ok(initial.queue.includes(casterPerson));
    report.searchBudget={months:searchMonths,ordersPerMonth:searchOrders,initial,scope:'Actual SEARCH commands and original strategy execution; no diplomat Canvass on an unowned target, no direct call to SearchDrv/PolicyExec/ConditionUpdate or any world assignment.'};
    for(let month=1;month<=searchMonths;month++) {
        await enterSearchPicker(cdp,month);const orders=[];
        for(let number=1;number<=searchOrders;number++) {
            const world=await observeCampaign(cdp,`search-${month}-${number}-actual-candidates`);
            if(isActualOwnedCaster(world))break;
            const picker=await currentSearchPicker(cdp);
            const eligible=world.resident.filter(p=>p.belong===13&&picker.menu.ids.includes(p.personIndex)&&p.thew>=report.searchNativeCost.thew&&![12,allyPerson,casterPerson].includes(p.personIndex));
            eligible.sort((a,b)=>(a.personIndex===110?-1:b.personIndex===110?1:b.iq-a.iq)||a.personIndex-b.personIndex);
            if(!eligible.length){report.searchBudgetExhausted??=[];report.searchBudgetExhausted.push({month,number,reason:'No current owned resident has native search Thew',world});break;}
            orders.push(await commitSearchOrder(cdp,eligible[0].personIndex,month,number));
        }
        assert.ok(orders.length,'At least one genuine SEARCH order is required before ending this strategy month');
        const executed=await executeSearchMonth(cdp,month,orders);
        if(executed.owned) {
            report.actualAcquisition={month,world:executed.after,caster:executed.after.observed.find(p=>p.personIndex===casterPerson),evidence:'Actual Belong13 and current native queue only. Report text alone or static original placement cannot authorize ownership.'};
            break;
        }
    }
    const final=await observeCampaign(cdp,'search-budget-final');
    assert.ok(isActualOwnedCaster(final),'Natural SEARCH budget ended before actual XuShu acquisition; preserve this private game failure');
    await observeActualLib(cdp,'post-search-actual-standard-LIB');
    await checkpoint(cdp,'search-actual-owned-XuShu');
}

async function marchSmoke(cdp) {
    await evaluate(cdp, `(() => { BayeHdOverworld.setMode('hd-map'); BayeHdCityMenu.setMode('hd'); BayeHdBattle.setMode('hd'); })()`);
    const owned = await waitFor(cdp, 'actual owned HD map 襄阳', `(() => { const m=BayeHdOverworld.debugSnapshot(); return m.phase==='map' && m.owned.find(c=>c.i===26 && c.name==='襄阳'); })()`);
    await readMarchDestination(cdp,'initial-map');
    await observeCity(cdp,'current-owned-city-before-preparation',originCity);
    report.marchPlan = await evaluate(cdp, `(() => {
        const realm=baye.hd.realm();
        return realm.cities.filter(c=>c.owned).map(c=>({ ...c, links:baye.hd.cityLinks(c.i), persons:Number(baye.data.g_Cities[c.i].Persons), food:Number(baye.data.g_Cities[c.i].Food) }));
    })()`);
    assert.ok(await action(cdp,'open-owned-city', `BayeHdOverworld.walkToCity(${owned.i})`));
    await waitFor(cdp, 'real city root menu', `BayeHdCityMenu.isOpen() && BayeHdCityMenu.getLayer() === 'root' && baye.hd.menuItems().active`);
    await checkpoint(cdp,'06-hd-city');
    await retireSearchToMap(cdp,'initial-city-root');
    await searchForActualCaster(cdp);
    assert.ok(await action(cdp,'reopen-owned-city-after-real-search',`BayeHdOverworld.walkToCity(${originCity})`));
    await waitFor(cdp,'actual acquired-caster city root',`BayeHdCityMenu.isOpen()&&BayeHdCityMenu.getLayer()==='root'&&baye.hd.menuItems().active`);
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp, 'military submenu', `BayeHdCityMenu.getLayer() === 'sub' && baye.hd.menuItems().active && baye.hd.menuItems().names[0] === '侦察'`);
    if(recruit)await recruitSmoke(cdp,owned.i);
    await click(cdp,'#hd-city-menu [data-hd-sub="4"]');
    await waitFor(cdp, 'march person picker', `(() => { const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.march(); return m.phase===1 && m.origin===26 && s.deepItems.length && baye.hd.menuItems().active; })()`);
    await checkpoint(cdp,'07-march-persons');
    report.marchPersonIds=[];
    for(let selection=0;selection<2;selection++){
        const march=await evaluate(cdp,'baye.hd.march()');
        const picker=await currentPersonPicker(cdp,'出征',originCity);
        const before={menu:picker.menu,city:picker.city,march:await evaluate(cdp,'baye.hd.march()')};
        for(const field of ['phase','session','origin','selected'])assert.equal(before.march[field],march[field],'Waiting for current HD rows preserves actual march '+field);
        assert.equal(before.march.phase,1);assert.equal(before.march.origin,originCity);assert.equal(before.march.selected,selection);
        if(before.march.phase!==1||!before.menu.active||!before.menu.count)break;
        assert.equal(before.menu.context,1);assert.equal(before.menu.kind,3);assert.equal(before.menu.idsValid,true);
        const queue=await evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${originCity}];return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong));})()`);
        assert.deepEqual(before.menu.ids,queue,'Current native allied queue and actual menu IDs agree');
        const index=before.menu.ids.indexOf(selection===0?casterPerson:allyPerson);assert.ok(index>=0,'Actual caster is still resident and selected first');
        const id=before.menu.ids[index];assert.equal(before.city.deepItems.find(item=>item.i===index)?.pind,id);
        await click(cdp,`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${id}"]`);
        await waitFor(cdp,'one actual person selected ACK',`baye.hd.march().selected>${before.march.selected}||baye.hd.march().phase!==1`);
        report.marchPersonIds.push(id);
    }
    assert.deepEqual(report.marchPersonIds,[casterPerson,allyPerson],'Actual owned XuShu first and real LiuQi second; no static or unowned ID substitution');
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
    const selected=await action(cdp,'select-target-only','BayeHdCityMenu.selectMarchTarget(20)');
    assert.equal(selected.selected,20);
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4,'selecting alone must not send confirmation');
    await readMarchDestination(cdp,'before-confirmation');
    await action(cdp,'confirm-target','BayeHdCityMenu.confirmMarchTarget(20)');
    await waitFor(cdp,'real departure report','baye.hd.march().phase===6',20000);
    await checkpoint(cdp,'12-march-departure-report');
    const departureMapSeq=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await action(cdp,'confirm-departure-report','BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'actual AddFightOrder ACK','baye.hd.march().phase===7 && baye.hd.march().ok===1');
    report.marchOrderReceipt=await evaluate(cdp,'baye.hd.march()');assert.equal(report.marchOrderReceipt.city,26);assert.equal(report.marchOrderReceipt.obj,20);assert.equal(report.marchOrderReceipt.ok,1);
    await waitFor(cdp,'actual strategy input after departure',`(() => {const m=baye.hd.march(),menu=baye.hd.menuItems();return (menu.active&&[1,2].includes(menu.context))||(!menu.active&&m.pick===1&&m.battlePick===0&&m.mapInputSeq>${departureMapSeq});})()`);
    await checkpoint(cdp,'13-march-order-ack');
    await action(cdp,'end-strategy-once','BayeHdCityMenu.goStrategyEnd()');
    await waitFor(cdp,'explicit strategy request accepted','BayeHdCityMenu.debugSnapshot().handoff || baye.hd.fight().active');
    await waitFor(cdp,'real battle player selection','baye.hd.fight().active && !baye.hd.fight().over && baye.hd.fight().inputKind===1',60000);
    report.battleDestinationReceipt=await evaluate(cdp,'baye.hd.fight()');assert.equal(report.battleDestinationReceipt.cityIndex,20);
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
    return {fight:baye.hd.fight(),generation:Number(d.g_hdSpeGeneration),nativeBoutMax:Number(d.g_FgtBoutMax),units,weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
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
 const deadline=Date.now()+60000,acknowledged=new Set();
 while(Date.now()<deadline){const s=await evaluate(cdp,'({f:baye.hd.fight(),s:baye.hd.spe(),r:baye.hd.skillResult(),b:BayeHdBattle.debugSnapshot(),d:BayeHdDialog.debugSnapshot()})');
  if(s.f.over||(!s.b.transaction&&s.f.inputKind===1&&!s.s.active&&!s.r.active&&(afterBout==null||s.f.bout>afterBout)))return s.f;
  if(s.d.open&&s.d.kind==='report'&&s.d.reportOwner){const key=JSON.stringify(s.d.reportOwner);
   if(!acknowledged.has(key)){acknowledged.add(key);const world=await evaluate(cdp,battleStateExpression);
    report.actualReports??=[];report.actualReports.push({owner:s.d.reportOwner,body:s.d.body,spe:s.s,result:s.r,fight:s.f,world});
    await checkpoint(cdp,'actual-report-'+report.actualReports.length);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');}
  }await delay(100);
 }throw Error('Timeout: '+label);
}
async function restActor(cdp,actor,selection){
 if(selection.inputKind===2){assert.equal((await action(cdp,'stay-at-real-tile-'+actor.id,`BayeHdBattle.clickTile(${actor.x},${actor.y})`)).ok,true);await waitBattle(cdp,3,'actual action menu after legal stay');}
 await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
}
async function attemptQimen(cdp,actor){
 const current=await evaluate(cdp,battleStateExpression),fresh=current.units.find(u=>u.id===casterNativeId&&u.i===actor.i);
 assert.ok(fresh&&fresh.side==='player'&&fresh.arms>0&&![8,1,6].includes(fresh.state));assert.notEqual(fresh.state,2,'STATE_JZ2 forbids opening the native skill menu; never wait for SKILL4 while silenced');
 assert.equal(current.fight.actorIndex,fresh.i);assert.equal(current.fight.inputKind,3);
 const actionName=await evaluate(cdp,'baye.hd.menuItems().names[1]');await menuChoice(cdp,actionName,4);
 const owner=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),options=await evaluate(cdp,skillOptionsExpression),skill=options.find(s=>s.id===20);
 assert.ok(skill,'Actual current caster native menu contains special skill20');assert.equal(skill.name,report.qimenNativeResource.actualSkillName.name,'Name comes from the actual resource11/index19 and native menu ID, never a guessed label');assert.equal(skill.speId,39);assert.equal(skill.useMp,20);assert.equal(skill.power,0);assert.equal(skill.destroy,0);assert.equal(skill.state,4);assert.equal(skill.aim,1);
 report.qimenOptions??=[];report.qimenOptions.push({owner,actor:fresh,skill,options});
 if(!skill.available){await action(cdp,'cancel-native-unavailable-qimen','BayeHdBattle.cancel()');await waitBattle(cdp,3,'actual unavailable skill return');return false;}
 assert.ok(fresh.mp>=20);const latest=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})');assert.deepEqual(latest,owner,'Actual skill menu ownership and ID order are unchanged before selecting');assert.equal(owner.skills.active,1);assert.equal(owner.skills.ids[skill.index],20);assert.equal(owner.skills.ids.filter(id=>id===20).length,1);
 const picked=await action(cdp,'choose-current-native-skill-id20-index',`BayeHdBattle.pickMenu(${skill.index})`);assert.equal(picked.ok,true);await waitBattle(cdp,5,'actual Qimen targeting');
 const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='player'&&u.id===allyPerson+1&&u.state===0&&u.arms>0&&Number.isInteger(u.terrain)&&skill.eland[u.terrain]>0&&Number.isInteger(u.armType)&&skill.earm[u.armType]>0);
 if(!targets.length){await action(cdp,'cancel-native-qimen-without-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'no legal qimen target return');return false;}
 const before=await evaluate(cdp,battleStateExpression),target=targets.sort((a,b)=>(before.units.find(u=>u.id===a.id)?.iq??255)-(before.units.find(u=>u.id===b.id)?.iq??255)||a.i-b.i)[0];
 const proof=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,n=Number(r[0]),x=Number(r[1]),y=Number(r[2]),u=d.g_GenPos[${target.i}],caster=d.g_GenPos[f.actorIndex];return {fight:f,generation:Number(d.g_hdSpeGeneration),casterId:Number(d.g_FgtParam.GenArray[f.actorIndex]),casterMp:Number(caster.mp),casterState:Number(caster.state),casterActive:Number(caster.active),casterTerrain:baye.getTerrainByGeneralIndex(f.actorIndex),weather:Number(d.g_FgtWeather),targetId:Number(d.g_FgtParam.GenArray[${target.i}]),x:Number(u.x),y:Number(u.y),state:Number(u.state),terrain:baye.getTerrainByGeneralIndex(${target.i}),arm:baye.hd.personArmType(Number(d.g_FgtParam.GenArray[${target.i}])-1),size:n,originX:x,originY:y,values:Array.from({length:n*n},(_,i)=>Number(r[3+i]))};})()`);
 assert.equal(proof.generation,owner.generation);assert.equal(proof.fight.active,1);assert.equal(proof.fight.over,0);assert.equal(proof.fight.wait,1);assert.equal(proof.fight.inputKind,5);assert.equal(proof.fight.aimType,1);assert.equal(proof.fight.actorIndex,fresh.i);assert.equal(proof.casterId,casterNativeId);assert.equal(proof.targetId,target.id);assert.equal(target.side,fresh.side);assert.equal(target.id,allyPerson+1);assert.equal(before.units.find(u=>u.id===target.id).belong,fresh.belong);
 assert.equal(proof.casterMp,fresh.mp);assert.equal(proof.casterActive,0);assert.ok(![8,1,6].includes(proof.casterState));assert.ok(proof.weather>=1&&proof.weather<=4);assert.ok(proof.casterTerrain>=0&&proof.casterTerrain<7);
 assert.ok(Number.isInteger(proof.size)&&proof.size>=1&&proof.size<=15&&proof.values.length===proof.size*proof.size&&proof.values.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
 assert.deepEqual([proof.x,proof.y],[target.x,target.y]);assert.ok(proof.state===0);assert.ok(skill.eland[proof.terrain]>0&&skill.earm[proof.arm]>0);
 const px=(target.x-proof.originX)&255,py=(target.y-proof.originY)&255;assert.ok(px<proof.size&&py<proof.size);assert.equal(proof.values[py*proof.size+px],1,'Only current real native skill AIM permits this target');
 const reportStart=report.actualReports?.length||0,captureStart=await evaluate(cdp,'window.__skillCaptures.length');
 const confirmation=await action(cdp,'confirm-current-qimen20-native-target-'+target.id,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(confirmation.ok,true);
 await waitActionResolved(cdp,'real skill20 complete movie/failure and actual report');
 const after=await evaluate(cdp,battleStateExpression),caster=after.units.find(u=>u.id===casterNativeId),victim=after.units.find(u=>u.id===target.id&&u.i===target.i);
 assert.ok(caster&&caster.state!==8&&caster.arms>0,'Real caster survives; never replaced');assert.equal(fresh.mp-caster.mp,20,'Actual skill use consumes exact native MP cost even on natural failure');assert.ok(victim&&victim.arms===target.arms,'Power0/destroy0 do not fabricate troop damage');
 const evidence=await collectSpe(cdp),movie=evidence.samples.filter(r=>r.stage==='lcd-flush'&&r.spe.active&&r.spe.id===39&&r.spe.actorIndex===fresh.i&&r.spe.targetIndex===target.i&&r.spe.skillId===20&&r.spe.display.frameValid);
 const succeeded=movie.length>0;
 if(succeeded){assert.equal(victim.state,4,'Native successful skill actually changes the selected target to STATE_QM4');const expectedReport=expectedStateReport(target.name);assert.ok((report.actualReports||[]).slice(reportStart).some(r=>r.owner&&r.body.replace(/\s/g,'')===expectedReport.replace(/\s/g,'')&&r.world.units.some(u=>u.id===target.id&&u.i===target.i&&u.state===4)),'Actual owned report matches real LIB state-message fragments and the same native target identity');}
 report.qimenAttempts??=[];report.qimenAttempts.push({actor:fresh,skill,target,proof,before,after,confirmation,captureStart,movieEvents:[...new Set(movie.map(r=>r.spe.eventId))],succeeded,reports:(report.actualReports||[]).slice(reportStart)});
 await checkpoint(cdp,succeeded?'qimen20-real-state4-report':'qimen20-natural-random-failure-'+report.qimenAttempts.length);return succeeded;
}
async function battleSmoke(cdp){
 report.combatStart=await evaluate(cdp,battleStateExpression);assert.equal(report.combatStart.fight.cityIndex,20);
 const map=await evaluate(cdp,'({id:Number(baye.data.g_FgtParam.MapId),width:Number(baye.data.g_MapWid),height:Number(baye.data.g_MapHgt)})');
 assert.deepEqual(map,{id:111,width:32,height:32});report.actualBattleMap=map;
 const caster=report.combatStart.units.find(u=>u.id===casterNativeId&&u.side==='player'),ally=report.combatStart.units.find(u=>u.id===allyPerson+1&&u.side==='player');
 assert.ok(caster&&caster.arms>0&&![8,1,2,6].includes(caster.state)&&caster.active===0);assert.ok(caster.mp>=20);
 assert.ok(ally&&ally.arms>0&&ally.state===0&&ally.belong===caster.belong);assert.equal(caster.belong,13);
 const selection=await chooseGeneral(cdp,caster);if(selection.inputKind===2){assert.equal((await action(cdp,'baseline-stay-real-caster-tile',`BayeHdBattle.clickTile(${caster.x},${caster.y})`)).ok,true);await waitBattle(cdp,3,'baseline actual action menu');}
 await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[1]'),4);
 const owner=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),options=await evaluate(cdp,skillOptionsExpression),skill=options.find(s=>s.id===20);
 assert.ok(skill);assert.equal(owner.skills.active,1);assert.equal(owner.skills.ids[skill.index],20);assert.equal(skill.name,report.qimenNativeResource.actualSkillName.name);
 assert.deepEqual([skill.speId,skill.aim,skill.state,skill.power,skill.destroy,skill.useMp],[39,1,4,0,0,20]);
 assert.equal(owner.fight.active,1);assert.equal(owner.fight.over,0);assert.equal(owner.fight.actorIndex,caster.i);assert.equal(owner.fight.inputKind,4);
 report.baseline={caster,ally,owner,options,skill,weather:report.combatStart.weather,note:'Actual SEARCH acquisition/current owned dispatch and native skill20 menu only. Availability is observed, not presumed. No AIM confirmation, spell, NUM/hold or HD acceptance.'};
 await checkpoint(cdp,'baseline-actual-caster-qimen-menu');await action(cdp,'baseline-cancel-uncommitted-skill','BayeHdBattle.cancel()');
 await waitBattle(cdp,3,'baseline skill menu retired');
 const cancelled=await evaluate(cdp,battleStateExpression);assert.equal(cancelled.units.find(u=>u.id===casterNativeId).mp,caster.mp);
 if(baselineOnly){await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);report.combatEnd=await evaluate(cdp,battleStateExpression);const after=report.combatEnd.units.find(u=>u.id===casterNativeId);assert.equal(after.mp,caster.mp);assert.equal(after.arms,caster.arms);report.hdAccepted=false;return;}
 let success=await attemptQimen(cdp,caster);
 if(!success&&await evaluate(cdp,'baye.hd.fight().inputKind===3'))await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
 for(let step=0;step<maxTurns*20&&!success;step++){
  const current=await evaluate(cdp,battleStateExpression),actual=current.units.find(u=>u.id===casterNativeId);
  assert.ok(actual&&actual.arms>0&&actual.state!==8,'Natural caster death remains a failure');assert.ok(!current.fight.over);
  const available=current.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![8,1,6].includes(u.state)),actor=available.find(u=>u.id===casterNativeId)||available[0];
  if(!actor){if((report.turns?.length||0)>=maxTurns)break;await endArmyTurn(cdp);continue;}
  const selected=await chooseGeneral(cdp,actor);
  if(actor.id!==casterNativeId||actor.state===2){if(actor.state===2){report.skippedCasts??=[];report.skippedCasts.push({actor,reason:'Current STATE_JZ2: rest legally rather than opening SKILL4'});}await restActor(cdp,actor,selected);continue;}
  assert.ok(actor.mp>=20,'Only actual current MP funds another natural cast attempt');
  if(selected.inputKind===2){assert.equal((await action(cdp,'qimen-stay-at-actual-current-caster-tile',`BayeHdBattle.clickTile(${actor.x},${actor.y})`)).ok,true);await waitBattle(cdp,3,'actual legal stay before spell');}
  success=await attemptQimen(cdp,actor);if(!success&&await evaluate(cdp,'baye.hd.fight().inputKind===3'))await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
 }
 assert.ok(success,'A player-confirmed skill20 same-side state4 success must occur; an enemy event or natural failure does not complete acceptance');
 const evidence=await collectSpe(cdp);assert.deepEqual(evidence.keys.filter(k=>k.resultActive),[],'State-only native movie receives no skip or invented return key');
 report.combatEnd=await evaluate(cdp,battleStateExpression);assert.equal(await evaluate(cdp,'baye.hd.skillResult().active'),false);
 await checkpoint(cdp,'qimen20-native-owner-retired-no-number-wait');
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
 return personName+text('dFgtInSta')+text('dFgtState0',4)+text('dFgtState');
}
function verifySkillCaptures(captures){
 if(baselineOnly){report.hdAccepted=false;report.scope={accepted:'Actual P2 LiuBiao/XiangYang26 real XuShu SEARCH acquisition, owned dispatch to Wan20 and current caster171/skill20 menu only',notRun:'No Qimen cast, pixel movie or HD acceptance'};return;}
 const match=report.qimenAttempts.find(a=>a.succeeded),events=new Map(),verified=[];assert.ok(match);
 const selected=captures.filter(c=>c.spe.active&&c.spe.id===39&&c.spe.kind===2&&c.spe.skillId===20&&c.spe.actorIndex===match.actor.i&&c.spe.targetIndex===match.target.i&&match.movieEvents.includes(c.spe.eventId));
 let hd=0;
 for(const c of selected){assert.deepEqual(c.before,c.after,'Readbacks write no native owner');if(c.callbackBefore)assert.deepEqual(c.callbackBefore,c.callbackAfter,'Production presentation callback writes no native owner');const s=c.spe,d=s.display;if(!d.frameValid)continue;
  assert.deepEqual([s.id,s.kind,s.skillId,s.resourceIndex,s.count,s.picmax,s.startFrm,s.endFrm,s.x,s.y,s.keyflag],[39,2,20,0,8,2,0,7,48,16,0]);assert.equal(s.skipEligible,false);assert.equal(s.protocolValid,true);assert.equal(s.resourceFingerprint,'fnv1a32:6b0ebc5a:1084');
  assert.deepEqual([c.nativeWidth,c.nativeHeight],[160,96]);assert.deepEqual([c.drawing.scale,c.drawing.flip,c.drawing.paint,c.drawing.palette0,c.drawing.palette255],[1,0,255,0x00ffffff,0xff000000]);
  const key=s.generation+':'+s.eventId,raw=Buffer.from(c.nativeRgba,'base64');assert.equal(raw.length,160*96*4);
  if(!events.has(key)){assert.equal(c.rawSource,'lcd-callback-image-data');events.set(key,{records:movieOracle(nativeMovie(39),0,7,48,16),outside:raw});}
  const event=events.get(key),expected=event.records[d.commitSeq-1];assert.ok(expected);assert.equal(d.frameIndex,expected.frame);assert.deepEqual(Buffer.from(d.visibleFrames),expected.visible);assert.deepEqual(Buffer.from(d.composition.clearFrames),expected.clears);
  const full=Buffer.from(event.outside);for(let y=16;y<80;y++)for(let x=48;x<112;x++){const i=y*160+x;full.writeUInt32LE(expected.pixels[i]?0xff000000:0x00ffffff,i*4);}assert.deepEqual(raw,full,'Complete160x96 actual LCD equals independent Qimen bitplanes and unchanged native outside region');
  assert.ok(c.ui.open&&c.dom.visible&&c.dom.inViewport&&c.dom.stackOwned);assert.equal(c.ui.skipVisible,false);assert.deepEqual(c.ui.sourceRect,{x:15,y:16,width:130,height:64});
  if(c.ui.source==='hd-assets'){assert.ok(qimenEntry);const scale=c.ui.scale,ops=c.drawLog.filter(o=>o.type==='fillRect'||o.type==='fillText'||o.type==='drawImage'&&o.src),live=frames(expected.visible);assert.equal(ops.length,1+live.length);assert.equal(ops[0].type,'fillRect');assert.deepEqual(ops[0].args,[0,0,130*scale,64*scale]);
   live.forEach((frame,index)=>{const u=qimenEntry.units[frame],p=qimenEntry.pictures[u.picIndex],op=ops[index+1];assert.equal(op.type,'drawImage');assert.equal(op.src,p.src);assert.deepEqual(op.args,[(48+u.x-15)*scale,u.y*scale,64*scale,64*scale]);assert.deepEqual([op.naturalWidth,op.naturalHeight],[p.width,p.height]);});hd++;
  }else{assert.ok(allowLcd,'Strict supported Qimen display must have actualHD assets');assert.equal(c.ui.source,'lcd');}
  assert.equal(c.result.active,true);assert.equal(c.result.phase,'movie');assert.deepEqual([c.result.generation,c.result.skillId,c.result.actorIndex,c.result.targetIndex],[s.generation,20,match.actor.i,match.target.i]);
  assert.equal(c.result.digits.length,0,'Current state-only Qimen owner never enters the numeric branch');
  if(c.result.display.valid){assert.deepEqual([c.result.display.generation,c.result.display.session,c.result.display.eventId],[c.result.generation,c.result.session,s.eventId]);assert.equal(c.result.display.digits.length,0,'Only the currently displayed Qimen owner has no numeric branch; invalid archived displays are not assigned to this cast');}
  verified.push({generation:s.generation,eventId:s.eventId,frameIndex:d.frameIndex,commitSeq:d.commitSeq,visible:frames(expected.visible),cleared:frames(expected.clears),source:c.ui.source,nativeFile:c.nativeFile,hdFile:c.hdFile,nativeRgbaSha256:sha(raw),independentExpectedSha256:sha(full)});
 }
 assert.ok(verified.length>=2,'Multiple actual native timer flushes observed');assert.ok(verified.some(v=>v.frameIndex===7),'Actual final logical Qimen frame was displayed');if(!allowLcd)assert.equal(hd,verified.length,'All actual supported Qimen timer frames are HD');
 report.nativePixelOracle={actualLcdCallbacks:verified.length,events:events.size,hdReadbacks:hd,verified};report.hdAccepted=!allowLcd&&hd===verified.length;
 report.scope={accepted:'One genuine P2 skill20 success: MP20, native Feng39 actual timer frames0..7, state4 plus actual report and retirement. STATE_QM4 is separate from STATE_DS3 and no movement-to1 branch is claimed. No NUM15 or artificial wait.',notRun:'Other skills, arbitrary Mods, noMovie, touch/mobile, performance; does not call this state-only movie a FIRE numeric postlude.'};
}
async function saveSkillEvidence(cdp){const raw=await evaluate(cdp,'({captures:window.__skillCaptures,errors:window.__speObserverErrors,keys:window.__speEngineKeys,samples:window.__speSamples})');
 for(let i=0;i<raw.captures.length;i++){const c=raw.captures[i],stem='qimen-'+String(i).padStart(3,'0')+'-'+(c.result.phase||'movie');for(const[type,url]of[['lcd',c.nativeUrl],['hd',c.hdUrl]])if(url){const data=Buffer.from(url.split(',')[1],'base64'),name=stem+'-'+type+'.png';fs.writeFileSync(path.join(artifactDir,name),data);c[type==='lcd'?'nativeFile':'hdFile']={file:name,bytes:data.length,sha256:sha(data)};}delete c.nativeUrl;delete c.hdUrl;}
 report.skillCaptures=raw.captures;report.observerErrors=raw.errors;
 for(const[name,data]of[['native-skill-captures',raw.captures],['observer-errors',raw.errors],['engine-inputs',raw.keys],['spe-observations',raw.samples]])fs.writeFileSync(path.join(artifactDir,name+'.json'),JSON.stringify(data,null,2)+'\n');
 assert.deepEqual(raw.errors,[],'Read-only presentation observer has no errors');
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
        if(preflightOnly){report.ok=true;report.scope={accepted:'Readonly actual standard-LIB FENG39/skill20/search/route metadata and source preflight',notRun:'No browser, SEARCH, campaign month, owned acquisition, dispatch, skill input or HD acceptance'};return;}
        profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-skill-runtime-'));
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
        if(profile){assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));assert.ok(path.basename(profile).startsWith('baye-skill-runtime-'));try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(e){report.ok=false;report.cleanupError=e.stack||String(e);process.exitCode=1;}}
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
        if (report.ok) console.log(preflightOnly?'Readonly Qimen search/route preflight passed; no browser/ownership/cast/HD claimed':baselineOnly?'Actual Qimen search/owned/menu baseline passed; no cast/HD claimed':'Actual Feng39 state-only skill20 lifecycle/pixels passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
