#!/usr/bin/env node
/**
 * WATER36/skill12 real-player validation driver: P3 HanXuan0, ChangSha33 to GuiYang36; caster WangLang14/native15.
 * --baseline-only observes actual caster/skill menu without casting; --allow-lcd casts without claiming HD.
 * Strict mode requires authenticated WATER manifest and genuine selected pictures.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-water-runtime.mjs --staged --recruit
 *   node scripts/test-hd-water-runtime.mjs --recruit --artifact-dir build/water-runtime
 * --staged serves build/wasm/src/baye.{js,wasm,wasm.map} without replacing js/.
 * Uses a temporary browser profile; it never edits portraits, saves or game assets.
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
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/water-runtime'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream' };
const preflightOnly=process.argv.includes('--preflight-only'),baselineOnly=process.argv.includes('--baseline-only'),allowLcd=process.argv.includes('--allow-lcd'),recruit=process.argv.includes('--recruit');
const numberArg=(name,fallback,max)=>{const i=process.argv.indexOf(name),text=i<0?String(fallback):process.argv[i+1];assert.ok(/^\d+$/.test(text||''));const value=Number(text);assert.ok(Number.isInteger(value)&&value>0&&value<=max);return value;};
const recruitArms=numberArg('--recruit-arms',800,65535),maxTurns=numberArg('--max-turns',6,20);
assert.ok(!process.argv.includes('--recruit-arms')||recruit,'Custom troop request requires real recruitment');
const period=3,originCity=33,destination=36,casterPerson=14,casterNativeId=15,skillId=12,speId=36,acceptedRange=[36,0,7];
const requestedActor=p=>p.personIndex===casterPerson;
const report = { preflightOnly,baselineOnly,allowLcd,recruit,recruitArms,period,originCity,destination,casterPerson,skillId,speId,maxTurns, staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const servedAssets = new Map();
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const nativeMovies=new Map();let nativeLib,waterEntry,font;
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
 freezeAsset('pc.html');waterEntry=manifest.entries.find(e=>e.speId===36&&e.kind===2&&e.resourceIndex===0&&e.startFrm===0&&e.endFrm===7)||null;
 const movie=nativeMovie(36);assert.deepEqual([movie.count,movie.picmax,movie.start,movie.end,movie.length,movie.fingerprint],[8,2,0,7,1084,'fnv1a32:6d62e7a8:1084']);
 assert.ok(movie.units.every((u,i)=>u.x===0&&u.y===0&&u.picIndex===i%2));assert.ok(movie.pictures.every(p=>p.width===64&&p.height===64&&p.mask===0));
 if(!baselineOnly&&!allowLcd)assert.ok(waterEntry,'Strict actual HD test awaits published, authenticated WATER36 entry; missing art is not HD completion');
 if(waterEntry){assert.equal(waterEntry.resourceFingerprint,movie.fingerprint);assert.equal(waterEntry.resourceLength,movie.length);assert.equal(waterEntry.count,8);assert.equal(waterEntry.picmax,2);
  assert.equal(waterEntry.units.length,8);assert.equal(waterEntry.pictures.length,2);
  waterEntry.units.forEach((u,i)=>{const r=movie.units[i];assert.deepEqual({frame:u.frame,x:u.x,y:u.y,picIndex:u.picIndex},{frame:i,x:r.x,y:r.y,picIndex:r.picIndex});});
  waterEntry.pictures.forEach((p,i)=>{const r=movie.pictures[i],png=servedAssets.get(p.src).data;assert.equal(p.picIndex,i);assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[r.width,r.height,r.width,r.height,r.mask]);assert.equal(png.readUInt32BE(16),p.width);assert.equal(png.readUInt32BE(20),p.height);});
 }
 const nameBytes=nativeItem(11,11),special=nativeItem(14,2),skillRecord=nativeItem(10).subarray(11*34,12*34),range=Array.from(nativeItem(13).subarray(11*81,12*81));
 assert.equal(special.readUInt16LE(casterPerson*2),0,'Actual navy default skill, not a fabricated special');
 assert.equal(nameBytes.toString('hex'),'cbaed1cd');assert.equal(skillRecord.toString('hex'),'00002003000014505050640000000000000000646464646464646464646464326464');
 const constants=servedAssets.get('vendor/iBaye/src/pconst.c').data.toString('utf8'),body=constants.match(/dFgtJNArray\[\]\s*=\s*\{([\s\S]*?)\}/)[1],defaultRow=(body.match(/\d+/g)||[]).map(Number).slice(30,40);assert.deepEqual(defaultRow,[12,13,11,0,0,0,0,0,0,0]);
 assert.equal(range.length,81);assert.equal(range[40],2);assert.equal(range.filter(v=>v===1).length,8);range.forEach((v,i)=>assert.equal(v,i===40?2:Math.max(Math.abs(i%9-4),Math.abs(Math.floor(i/9)-4))===1?1:0));
 report.waterNativeResource={id:36,index:0,start:0,end:7,count:8,picmax:2,length:movie.length,fingerprint:movie.fingerprint,units:movie.units,pictures:movie.pictures.map((p,i)=>({picIndex:i,width:p.width,height:p.height,mask:p.mask})),
 actualSkillName:{resourceId:11,itemIndex:11,bytes:nameBytes.length,hex:nameBytes.toString('hex'),name:new TextDecoder('gbk',{fatal:true}).decode(nameBytes)},
 actualSkill:{resourceId:10,index:11,recordBytes:34,hex:skillRecord.toString('hex'),aim:0,state:0,power:800,destroy:0,useMp:20,weather:[80,80,80,100,0],eland:[0,0,0,0,0,0,0,100],oland:[100,100,100,100,100,100,100,100],earm:[100,100,100,50,100,100]},
 defaultNavySkills:{source:'vendor/iBaye/src/pconst.c',arm:3,row:defaultRow},special:{resourceId:14,itemIndex:2,personIndex:14,value:0},range:{resourceId:13,itemIndex:0,offset:11*81,size:9,values:range,note:'Eight adjacent targets only; this does not authorize an actual target or guarantee current position/weather/MP'}};
 const fontText=servedAssets.get('vendor/iBaye/src/platform/js/font.bin.c').data.toString('utf8');font=Buffer.from([...fontText.matchAll(/0x([\da-f]{2})/gi)].map(m=>parseInt(m[1],16)));assert.equal(font.length,163840);assert.equal(sha(font),'31197c48c77e82bc244b17f44e405a3a055df8162af06fadd7271cc1990cc6b8');
 report.inputPlans=['docs/validation/m4-water-20261009/route-plan.json','docs/validation/m4-water-20261009/resource-plan.json'].map(path=>{const data=freezeAsset(path).data;return{path,bytes:data.length,sha256:sha(data),scope:path.endsWith('/route-plan.json')?'Current route ROM plan; actual game may differ after its original commands':'Retained resource36/skill12 numeric/source facts; its previous preferred route is not current route authorization'};});

 const routePlanBytes=freezeAsset('docs/validation/m4-water-20261009/route-plan.json').data,routePlan=JSON.parse(routePlanBytes);assert.equal(sha(routePlanBytes),'2b52de7c64cdc08435b9801faf7c9f395fe815f5e261ff3231bf5ac303a0665d');assert.equal(routePlan.library.sha256,report.sources['libs/dat-mod.lib'].sha256);
 const decode=b=>new TextDecoder('gbk',{fatal:true}).decode(b.subarray(0,b.indexOf(0)<0?b.length:b.indexOf(0))),cityRows=nativeItem(57,period-1),people=nativeItem(61,period-1),queue=nativeItem(65,period-1),links=nativeItem(59),map=nativeItem(115);
 assert.equal(cityRows.readUInt16LE(38*37),208);const cities=[routePlan.candidate.origin,routePlan.candidate.destination].map(c=>{const row=cityRows.subarray(c.cityIndex*37,(c.cityIndex+1)*37);assert.equal(row.toString('hex'),c.recordHex);assert.equal(decode(nativeItem(58,c.cityIndex)),c.name);const ids=Array.from({length:c.personCount},(_,i)=>queue.readUInt16LE((c.queueOffset+i)*2));assert.deepEqual(ids,c.queue);const allied=ids.filter(id=>people[id*19+2]===c.belong);assert.deepEqual(allied,c.alliedQueue);return{cityIndex:c.cityIndex,name:c.name,belong:c.belong,rawRecordHex:row.toString('hex'),queue:ids,alliedQueue:allied,source:'Actual static LIB57/65/61, not runtime money or residents'};});
 for(const person of [routePlan.candidate.lord,routePlan.candidate.caster]){assert.equal(people.subarray(person.personIndex*19,(person.personIndex+1)*19).toString('hex'),person.recordHex);assert.equal(decode(nativeItem(71,person.personIndex)),person.name);}
 assert.deepEqual(Array.from(links.subarray(originCity*16,originCity*16+8)),routePlan.candidate.route.originLinks);assert.deepEqual(Array.from(links.subarray(destination*16,destination*16+8)),routePlan.candidate.route.destinationLinks);assert.equal(links[destination*16],originCity+1);assert.ok(Array.from(links.subarray(originCity*16,originCity*16+8)).includes(destination+1));
 assert.equal(map.length,1040);assert.equal(sha(map),routePlan.map.payloadSha256);assert.deepEqual([map[0],map[2]],[32,32]);const tiles=map.subarray(16);assert.equal(tiles.filter(v=>v>15&&v!==41).length,958);assert.equal(tiles[2*32+16],22);
 assert.ok(waterEntry&&waterEntry.skillResultVersion===1,'Published strict water entry includes current numeric observer composition');const num=nativePicture(nativeItem(15),0,true);assert.deepEqual([num.width,num.height,num.count,num.mask],[12,16,10,0]);assert.deepEqual([waterEntry.skillNumber.id,waterEntry.skillNumber.resourceIndex,waterEntry.skillNumber.nativeWidth,waterEntry.skillNumber.nativeHeight,waterEntry.skillNumber.count,waterEntry.skillNumber.mask,waterEntry.skillNumber.resourceLength,waterEntry.skillNumber.resourceFingerprint],[15,0,12,16,10,0,nativeItem(15).length,fnv(nativeItem(15))]);
 report.routeRomProof={planSha256:sha(routePlanBytes),cities,lord:{personIndex:0,name:'韩玄'},caster:{personIndex:14,nativeGenId:15,name:'王朗',rawRecord:routePlan.candidate.caster.recordHex,rawArm3:true,specialSkill0:true},map:{resourceId:115,sha256:sha(map),width:32,height:32,riverCells:958},way:0,route:routePlan.candidate.route,boundary:'Preflight only. Actual loaded library/Realm/person queue/Arm/MP/terrain/MOVE/AIM/formation and numeric source are still freshly checked by real input route; no static slot/person or probability authorization'};
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
 let api=null,originalKey=null,lastWater=null;const held=new Set();
 for(const name of ['clearRect','drawImage','fillRect','fillText','rect','clip']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(){const result=original.apply(this,arguments);if(this.canvas&&this.canvas.id==='hd-spe-canvas'){const args=Array.from(arguments);if(name==='clearRect'&&args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height)window.__skillDrawLog=[];let op={type:name,args,fillStyle:this.fillStyle,font:this.font};if(name==='drawImage'){const source=args.shift();op.src=source.src?new URL(source.src,location.href).pathname.replace(/^\//,''):null;op.args=args;op.naturalWidth=source.naturalWidth||source.width;op.naturalHeight=source.naturalHeight||source.height;}if(name==='fillText'){op.text=String(args.shift());op.args=args;}window.__skillDrawLog.push(op);}return result;};}
 const snapshot=()=>{try{return baye.hd.ready()?JSON.parse(JSON.stringify({spe:baye.hd.spe(),result:baye.hd.skillResult(),top:baye.hd.resultOwner(),fight:baye.hd.fight()})):null;}catch{return null;}};
 function capture(stage,img,w,h,callbackBefore,callbackAfter){try{
  if(!window.baye||!baye.hd||!baye.hd.ready())return;
  const s=snapshot(),spe=s.spe,result=s.result,ui=api&&api.debugSnapshot();window.__speSamples.push({stage,phase:window.__spePhase,at:performance.now(),spe,result,top:s.top,ui});
  if(spe.active&&spe.id===36&&spe.kind===2)lastWater={generation:spe.generation,eventId:spe.eventId,actorIndex:spe.actorIndex,targetIndex:spe.targetIndex,skillId:spe.skillId};
  const isWater=result.active&&result.speId===36,key=result.generation+':'+result.session;
  const readback=stage==='lifecycle'&&isWater&&result.phase==='hold'&&result.display&&result.display.valid&&!held.has(key);
  if(readback){const lcd=document.getElementById('lcd');img=lcd.getContext('2d').getImageData(0,0,lcd.width,lcd.height);w=lcd.width;h=lcd.height;held.add(key);}
  if((stage==='lcd-flush'||readback)&&img&&(isWater||lastWater)){
   const before=snapshot(),native=document.createElement('canvas'),hd=document.getElementById('hd-spe-canvas');native.width=w||img.width;native.height=h||img.height;native.getContext('2d').putImageData(img,0,0);
   const base64=data=>{let text='';for(const byte of data)text+=String.fromCharCode(byte);return btoa(text);};
   const rect=ui.sourceRect;let hdLogicalRgba=null;if(hd&&ui.open&&rect&&hd.width===rect.width*ui.scale&&hd.height===rect.height*ui.scale){const data=hd.getContext('2d').getImageData(0,0,hd.width,hd.height).data,logical=[];for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++){const offset=(Math.floor((y+.5)*ui.scale)*hd.width+Math.floor((x+.5)*ui.scale))*4;for(let channel=0;channel<4;channel++)logical.push(data[offset+channel]);}hdLogicalRgba=base64(logical);}
   const node=document.getElementById('hd-spe'),r=hd&&hd.getBoundingClientRect(),style=hd&&getComputedStyle(hd),rootStyle=node&&getComputedStyle(node),top=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   const dom=r&&{x:r.x,y:r.y,width:r.width,height:r.height,visible:!!(r.width&&r.height&&style.visibility==='visible'&&style.display!=='none'&&rootStyle.visibility==='visible'&&rootStyle.display!=='none'),inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,stackOwned:!!(top&&node.contains(top)),top:top&&{id:top.id,className:top.className}};
   const nativeUrl=native.toDataURL('image/png'),hdUrl=hd&&ui.open&&hd.toDataURL('image/png'),after=snapshot();
   window.__skillCaptures.push({stage:readback?'held-lcd-readback':'lcd-flush',rawSource:readback?'canvas-readback-normalized':'lcd-callback-image-data',at:performance.now(),callbackBefore,callbackAfter,before,after,spe,result,top:s.top,ui,dom,lastWater,lastFight:s.fight,hidden:document.hidden,mode:BayeHdBattle.getMode(),drawing:{scale:Number(baye.data.g_scale),flip:Number(baye.data.g_FlipDrawing),paint:Number(baye.data.g_paintColor),palette0:Number(baye.data.g_paintPalette[0]),palette255:Number(baye.data.g_paintPalette[255])},nativeWidth:native.width,nativeHeight:native.height,nativeRgba:base64(img.data),hdLogicalRgba,nativeUrl,hdUrl,drawLog:window.__skillDrawLog.slice()});
  }
  if(!spe.active&&!result.active&&s.fight.inputKind===1)lastWater=null;
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
    await waitFor(cdp, 'real period3 lord selection', 'Number(baye.data.g_PIdx)===3 && baye.hd.kings().count>0');
    const lord = await evaluate(cdp, "(() => {const m=baye.hd.kings();return {target:m.kings.findIndex(k=>k.id===0&&k.name==='韩玄'),index:m.index,kings:m.kings};})()");
    assert.ok(lord.target >= 0, 'Actual period3 contains HanXuan ID0');
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'native lord highlight', 'baye.hd.kings().index===' + lord.target);
    report.selectedLord = lord.kings[lord.target];assert.equal(report.selectedLord.id,0);
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
    report.recruitment={cityIndex,requestedArms:recruitArms,expectedCasterPerson:casterPerson,actualCasterArmType:actor.armType,recruiter,actor,casterNativeGenId:actor.nativeGenId,before,chosen,quantity,confirmation,enlistments,enlisted,enlistRetirement,distribute,distribution,distributionConfirmation,distributionOutcome,equipped,nativeInputs:await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`),scope:'Original bounded conscription into actual city reserve followed by original distribution to current caster person14/native15. Exact IDs, money, orders, queues and receipts are recorded; no world setters, automatic time advance or artificial troops.'};
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
    assert.ok(facts.origin&&facts.origin.i===originCity&&facts.origin.owned&&facts.origin.belong===facts.playerBelong,'长沙 is currently owned by the actual player');
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


async function marchSmoke(cdp) {
    await evaluate(cdp, `(() => { BayeHdOverworld.setMode('hd-map'); BayeHdCityMenu.setMode('hd'); BayeHdBattle.setMode('hd'); })()`);
    const owned = await waitFor(cdp, 'actual owned HD map 长沙', `(() => { const m=BayeHdOverworld.debugSnapshot(); return m.phase==='map' && m.owned.find(c=>c.i===33 && c.name==='长沙'); })()`);
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
    await waitFor(cdp, 'march person picker', `(() => { const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.march(); return m.phase===1 && m.origin===33 && s.deepItems.length && baye.hd.menuItems().active; })()`);
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
    const selected=await action(cdp,'select-target-only','BayeHdCityMenu.selectMarchTarget(36)');
    assert.equal(selected.selected,36);
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4,'selecting alone must not send confirmation');
    await readMarchDestination(cdp,'before-confirmation');
    await action(cdp,'confirm-target','BayeHdCityMenu.confirmMarchTarget(36)');
    await waitFor(cdp,'real departure report','baye.hd.march().phase===6',20000);
    await checkpoint(cdp,'12-march-departure-report');
    const departureMapSeq=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await action(cdp,'confirm-departure-report','BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'actual AddFightOrder ACK','baye.hd.march().phase===7 && baye.hd.march().ok===1');
    report.marchOrderReceipt=await evaluate(cdp,'baye.hd.march()');assert.equal(report.marchOrderReceipt.city,33);assert.equal(report.marchOrderReceipt.obj,36);assert.equal(report.marchOrderReceipt.ok,1);
    await waitFor(cdp,'actual strategy input after departure',`(() => {const m=baye.hd.march(),menu=baye.hd.menuItems();return (menu.active&&[1,2].includes(menu.context))||(!menu.active&&m.pick===1&&m.battlePick===0&&m.mapInputSeq>${departureMapSeq});})()`);
    await checkpoint(cdp,'13-march-order-ack');
    await action(cdp,'end-strategy-once','BayeHdCityMenu.goStrategyEnd()');
    await waitFor(cdp,'explicit strategy request accepted','BayeHdCityMenu.debugSnapshot().handoff || baye.hd.fight().active');
    await waitFor(cdp,'real battle player selection','baye.hd.fight().active && !baye.hd.fight().over && baye.hd.fight().inputKind===1',60000);
    report.battleDestinationReceipt=await evaluate(cdp,'baye.hd.fight()');assert.equal(report.battleDestinationReceipt.cityIndex,36);
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
    return {fight:baye.hd.fight(),generation:Number(d.g_hdSpeGeneration),nativeBoutMax:Number(d.g_FgtBoutMax),nativeMapId:Number(d.g_FgtParam.MapId),mapWidth:Number(d.g_MapWid),mapHeight:Number(d.g_MapHgt),units,weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
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
async function attemptWater(cdp,actor){
 const current=await evaluate(cdp,battleStateExpression),fresh=current.units.find(u=>u.id===casterNativeId&&u.i===actor.i);
 assert.ok(fresh&&fresh.side==='player'&&fresh.arms>0&&![8,1,6].includes(fresh.state));assert.notEqual(fresh.state,2,'STATE_JZ2 forbids opening the native skill menu; never wait for SKILL4 while silenced');
 assert.equal(current.fight.actorIndex,fresh.i);assert.equal(current.fight.inputKind,3);
 const actionName=await evaluate(cdp,'baye.hd.menuItems().names[1]');await menuChoice(cdp,actionName,4);
 const owner=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})'),options=await evaluate(cdp,skillOptionsExpression),skill=options.find(s=>s.id===12);
 assert.ok(skill,'Actual current caster native menu contains navy skill12');assert.equal(skill.name,report.waterNativeResource.actualSkillName.name,'Name comes from the actual resource11/index11 and native menu ID, never a guessed label');assert.equal(skill.speId,36);assert.equal(skill.useMp,20);assert.equal(skill.power,800);assert.equal(skill.destroy,0);assert.equal(skill.state,0);assert.equal(skill.aim,0);assert.equal(fresh.armType,3);assert.deepEqual(skill.eland,[0,0,0,0,0,0,0,100]);assert.deepEqual(skill.weather,[80,80,80,100,0]);assert.deepEqual(skill.earm,[100,100,100,50,100,100]);assert.deepEqual(skill.oland,[100,100,100,100,100,100,100,100]);
 report.waterOptions??=[];report.waterOptions.push({owner,actor:fresh,skill,options});
 if(!skill.available){await action(cdp,'cancel-native-unavailable-water','BayeHdBattle.cancel()');await waitBattle(cdp,3,'actual unavailable skill return');return false;}
 assert.ok(fresh.mp>=20);const latest=await evaluate(cdp,'({fight:baye.hd.fight(),skills:baye.hd.skills(),generation:Number(baye.data.g_hdSpeGeneration)})');assert.deepEqual(latest,owner,'Actual skill menu ownership and ID order are unchanged before selecting');assert.equal(owner.skills.active,1);assert.equal(owner.skills.ids[skill.index],12);assert.equal(owner.skills.ids.filter(id=>id===12).length,1);
 const picked=await action(cdp,'choose-current-native-skill-id12-index',`BayeHdBattle.pickMenu(${skill.index})`);assert.equal(picked.ok,true);await waitBattle(cdp,5,'actual Water targeting');
 const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.state!==8&&u.state!==6&&u.arms>0&&u.terrain===7&&skill.eland[u.terrain]>0&&Number.isInteger(u.armType)&&skill.earm[u.armType]>0);
 if(!targets.length){report.missingConditions??=[];report.missingConditions.push({reason:'No current live enemy on river7 inside fresh native skill AIM',owner,options,current:await evaluate(cdp,battleStateExpression),range:await evaluate(cdp,'Array.from({length:3+Number(baye.data.g_FgtAtkRng[0])**2},(_,i)=>Number(baye.data.g_FgtAtkRng[i]))')});await action(cdp,'cancel-native-water-without-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'no legal water target return');return false;}
 const before=await evaluate(cdp,battleStateExpression),target=targets.sort((a,b)=>(before.units.find(u=>u.id===a.id)?.iq??255)-(before.units.find(u=>u.id===b.id)?.iq??255)||a.i-b.i)[0];
 const proof=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,n=Number(r[0]),x=Number(r[1]),y=Number(r[2]),u=d.g_GenPos[${target.i}],caster=d.g_GenPos[f.actorIndex];return {fight:f,generation:Number(d.g_hdSpeGeneration),casterId:Number(d.g_FgtParam.GenArray[f.actorIndex]),casterMp:Number(caster.mp),casterState:Number(caster.state),casterActive:Number(caster.active),casterTerrain:baye.getTerrainByGeneralIndex(f.actorIndex),weather:Number(d.g_FgtWeather),targetId:Number(d.g_FgtParam.GenArray[${target.i}]),x:Number(u.x),y:Number(u.y),state:Number(u.state),terrain:baye.getTerrainByGeneralIndex(${target.i}),arm:baye.hd.personArmType(Number(d.g_FgtParam.GenArray[${target.i}])-1),size:n,originX:x,originY:y,values:Array.from({length:n*n},(_,i)=>Number(r[3+i]))};})()`);
 assert.equal(proof.generation,owner.generation);assert.equal(proof.fight.active,1);assert.equal(proof.fight.over,0);assert.equal(proof.fight.wait,1);assert.equal(proof.fight.inputKind,5);assert.equal(proof.fight.aimType,1);assert.equal(proof.fight.actorIndex,fresh.i);assert.equal(proof.casterId,casterNativeId);assert.equal(proof.targetId,target.id);
 assert.equal(proof.casterMp,fresh.mp);assert.equal(proof.casterActive,0);assert.ok(![8,1,6].includes(proof.casterState));assert.ok(proof.weather>=1&&proof.weather<=4);assert.ok(proof.casterTerrain>=0&&proof.casterTerrain<8);
 assert.ok(Number.isInteger(proof.size)&&proof.size>=1&&proof.size<=15&&proof.values.length===proof.size*proof.size&&proof.values.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
 assert.deepEqual([proof.x,proof.y],[target.x,target.y]);assert.ok(proof.state!==8&&proof.state!==6);assert.equal(proof.terrain,7);assert.ok(Math.max(Math.abs(target.x-fresh.x),Math.abs(target.y-fresh.y))===1);assert.notEqual(proof.casterState,2);assert.ok(skill.eland[proof.terrain]>0&&skill.earm[proof.arm]>0);
 const px=(target.x-proof.originX)&255,py=(target.y-proof.originY)&255;assert.ok(px<proof.size&&py<proof.size);assert.equal(proof.values[py*proof.size+px],1,'Only current real native skill AIM permits this target');
 const reportStart=report.actualReports?.length||0,captureStart=await evaluate(cdp,'window.__skillCaptures.length');
 const confirmation=await action(cdp,'confirm-current-water12-native-target-'+target.id,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(confirmation.ok,true);
 await waitActionResolved(cdp,'real skill12 complete movie/failure and actual report');
 const after=await evaluate(cdp,battleStateExpression),caster=after.units.find(u=>u.id===casterNativeId),victim=after.units.find(u=>u.id===target.id&&u.i===target.i);
 assert.ok(caster&&caster.state!==8&&caster.arms>0,'Real caster survives; never replaced');assert.equal(fresh.mp-caster.mp,20,'Actual skill use consumes exact native MP cost even on natural failure');
 const evidence=await collectSpe(cdp),movie=evidence.samples.filter(r=>r.stage==='lcd-flush'&&r.spe.active&&r.spe.id===36&&r.spe.actorIndex===fresh.i&&r.spe.targetIndex===target.i&&r.spe.skillId===12&&r.spe.display.frameValid);
 const succeeded=movie.length>0;
 if(succeeded){assert.ok(victim&&victim.id===target.id,'Actual selected target remains identifiable in the native battle census');assert.ok(victim.arms<=target.arms,'Observed water action cannot manufacture enemy troops');}
 report.waterAttempts??=[];report.waterAttempts.push({actor:fresh,skill,target,proof,before,after,confirmation,captureStart,movieEvents:[...new Set(movie.map(r=>r.spe.eventId))],succeeded,reports:(report.actualReports||[]).slice(reportStart)});
 await checkpoint(cdp,succeeded?'water12-real-movie-numeric-result':'water12-natural-random-failure-'+report.waterAttempts.length);return succeeded;
}

async function battleSmoke(cdp){
 report.combatStart=await evaluate(cdp,battleStateExpression);assert.equal(report.combatStart.fight.cityIndex,36);assert.deepEqual([report.combatStart.nativeMapId,report.combatStart.mapWidth,report.combatStart.mapHeight],[115,32,32]);
 const caster=report.combatStart.units.find(u=>u.id===casterNativeId&&u.side==='player');assert.ok(caster&&caster.arms>0&&caster.state!==8);assert.ok(caster.mp>=20);assert.equal(caster.armType,3,'Only the actual navy caster with default water skill qualifies');
 if(recruit)assert.equal(caster.arms,report.recruitment.distribution.wanted,'Only actually distributed troops enter battle');
 if(baselineOnly){assert.notEqual(caster.state,2,'Actual baseline caster must not be silenced before opening the native skill menu');const selection=await chooseGeneral(cdp,caster);if(selection.inputKind===2){assert.equal((await action(cdp,'baseline-stay-real-caster-tile',`BayeHdBattle.clickTile(${caster.x},${caster.y})`)).ok,true);await waitBattle(cdp,3,'baseline actual action menu');}
  await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[1]'),4);const options=await evaluate(cdp,skillOptionsExpression);assert.ok(options.some(s=>s.id===12&&s.speId===36));report.baseline={caster,options,note:'Current genuine entry/MP/skill menu census only; no water cast or HD acceptance'};
  await checkpoint(cdp,'baseline-actual-caster-water-menu');await action(cdp,'baseline-cancel-uncommitted-skill','BayeHdBattle.cancel()');await waitBattle(cdp,3,'baseline skill menu retired');await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);report.combatEnd=await evaluate(cdp,battleStateExpression);assert.equal(report.combatEnd.units.find(u=>u.id===casterNativeId).mp,caster.mp);return;
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
  if(selection.inputKind===2){const candidates=await evaluate(cdp,moveTilesExpression),enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.state!==6&&u.arms>0&&u.terrain===7);if(!enemies.length){report.missingConditions??=[];report.missingConditions.push({reason:'All current enemy units are outside river7; static formation cannot authorize a target',current,actor,selection,candidates});await restActor(cdp,actor,selection);continue;}
   const distance=p=>Math.min(...enemies.map(u=>Math.max(Math.abs(p.x-u.x),Math.abs(p.y-u.y))));
   const axialDistance=p=>Math.min(...enemies.map(u=>Math.abs(p.x-u.x)+Math.abs(p.y-u.y)));
   const target=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.state!==8&&u.x===p.x&&u.y===p.y)).sort((a,b)=>distance(a)-distance(b)||axialDistance(a)-axialDistance(b))[0];assert.ok(target,'Current actual MOVE gives an unoccupied legal tile');
   report.movePlanning??=[];report.movePlanning.push({before:current,actor,target,candidates,source:'Current actual g_FightPath including exact mask bytes/index; proximity only ranks, fresh native AIM still required'});
   assert.equal((await action(cdp,'actual-water-caster-move',`BayeHdBattle.clickTile(${target.x},${target.y})`)).ok,true);await waitBattle(cdp,3,'actual action after caster movement');
  }
  success=await attemptWater(cdp,actor);if(!success&&await evaluate(cdp,'baye.hd.fight().inputKind===3'))await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
 }
 assert.ok(success,'A real successful skill12 player confirmation, not a fabricated event or random failure, must be observed');
 const evidence=await collectSpe(cdp);assert.deepEqual(evidence.keys.filter(k=>k.resultActive),[],'Native Water movie/numbers/hold owns input and receives no skip/return key');
 report.combatEnd=await evaluate(cdp,battleStateExpression);assert.equal(await evaluate(cdp,'baye.hd.skillResult().active'),false);await checkpoint(cdp,'water12-native-numeric-owner-retired');
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
function nativeLabel(kind){
 const source=servedAssets.get('vendor/iBaye/src/data/pstring.h').data.toString('utf8').replace(/\/\*[\s\S]*?\*\//g,''),body=source.match(/enum\s*\{([\s\S]*?)\}/)[1];let index=0;const names=new Map();
 for(const item of body.split(',')){const m=/\b(\w+)\s*(?:=\s*(\d+))?/.exec(item);if(!m)continue;index=m[2]?Number(m[2]):index+1;names.set(m[1],index);}
 const name=kind===1?'dFgtArmsH':'dFgtArmsA',itemIndex=names.get(name)-1,payload=nativeItem(1,itemIndex),terminator=payload.indexOf(0);
 // Actual ResLoadToMem appends ptr[rlen]=0. ROM string items need not carry
 // that terminator; stop at an existing NUL or the authentic payload end.
 const bytes=payload.subarray(0,terminator<0?payload.length:terminator);assert.ok(bytes.length>0&&bytes.length<25);
 return{name,resourceId:1,itemIndex,payloadSha256:sha(payload),bytes};
}
function drawLabel(out,bytes,x,y){for(let i=0;i<bytes.length;){const first=bytes[i++],ascii=first<128,code=ascii?first:(first<<8)|bytes[i++],index=ascii?94*(0xa4-0xa1)+(code-0x21):94*((code>>8)-0xa1)+((code&255)-0xa1),offset=index*18,width=ascii?6:12;assert.ok(offset>=0&&offset+18<=font.length);for(let py=0;py<12;py++)for(let px=0;px<width;px++){const bit=py*12+px;out[(y+py)*160+x+px]=font[offset+(bit>>3)]&(128>>(bit&7))?255:0;}x+=width;}}
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function frames(bits){return Array.from({length:256},(_,i)=>i).filter(i=>bits[i>>3]&(1<<(i&7)));}
function assertHdGeometry(c,expected,label,post){
 const scale=c.ui.scale,ops=c.drawLog.filter(o=>o.type==='fillRect'||o.type==='fillText'||o.type==='drawImage'&&o.src);let index=0;
 const consume=(type,args,text=null,src=null)=>{const op=ops[index++];assert.equal(op?.type,type,'HD draw order comes from actual visible/clear/label/digit metadata');assert.deepEqual(op.args,args,'Each HD operation occupies the actual native logical rectangle');if(text!==null)assert.equal(op.text,text);if(src!==null)assert.equal(op.src,src);return op;};
 if(!post)consume('fillRect',[0,0,130*scale,64*scale]);
 else for(const frame of frames(expected.clears)){const u=waterEntry.units[frame],p=waterEntry.pictures[u.picIndex];consume('fillRect',[(48+u.x-15)*scale,u.y*scale,p.logicalWidth*scale,p.logicalHeight*scale]);}
 for(const frame of frames(expected.visible)){const u=waterEntry.units[frame],p=waterEntry.pictures[u.picIndex],op=consume('drawImage',[(48+u.x-15)*scale,u.y*scale,p.logicalWidth*scale,p.logicalHeight*scale],null,p.src);assert.deepEqual([op.naturalWidth,op.naturalHeight],[p.width,p.height]);}
 if(post){
  const rects=c.drawLog.filter(o=>o.type==='rect'),expectedRects=[[33*scale,0,64*scale,64*scale]];
  if(label){const box=[40*scale,2*scale,label.bytes.length*6*scale,12*scale];consume('fillRect',box);const op=consume('fillText',box.slice(0,3),c.result.display.label.text);assert.match(op.font,new RegExp('^'+12*scale+'px '));expectedRects.push(box);}
  for(const p of c.result.display.digits)for(let draw=0;draw<p.drawCount;draw++){const box=[(p.x-15)*scale,(p.firstY-draw-16)*scale,12*scale,16*scale];consume('fillRect',box);const op=consume('fillText',[box[0],box[1],6*scale],String(p.digit));assert.equal(op.font,'bold '+16*scale+'px Georgia, serif');expectedRects.push(box);}
  assert.deepEqual(rects.map(o=>o.args),expectedRects,'Every label/digit is clipped inside its own true native box and the certified effect window');
 }
 assert.equal(index,ops.length,'No unobserved scene, label or numeric draw is added');
}
function verifySkillCaptures(captures){
 if(baselineOnly){report.hdAccepted=false;report.scope={accepted:'Current actual P3 HanXuan/ChangSha33 to GuiYang36 and navy WangLang14/native15 skill12 menu',notRun:'No cast or HD acceptance'};return;}
 const match=report.waterAttempts.find(a=>a.succeeded);assert.ok(match,'A genuine player skill12 movie must occur');
 const selected=captures.filter(c=>c.spe.active&&c.spe.id===36&&c.spe.kind===2||c.result.active&&c.result.speId===36&&c.result.display&&c.result.display.valid);
 const matching=selected.filter(c=>c.spe.active?c.spe.skillId===12&&c.spe.actorIndex===match.actor.i&&c.spe.targetIndex===match.target.i&&match.movieEvents.includes(c.spe.eventId):c.result.skillId===12&&c.result.actorIndex===match.actor.i&&c.result.targetIndex===match.target.i&&match.movieEvents.includes(c.result.display?.eventId));selected.splice(0,selected.length,...matching);
 assert.ok(selected.length,'The actual game produced default WATER');const events=new Map(),verified=[];let labels=0,numbers=0,holds=0,movieHd=0,postHd=0,actualCallbacks=0,movieReadbacks=0,postReadbacks=0;
 for(const c of selected){assert.deepEqual(c.after,c.before,'Reading pixels and PNG preserves all native owner/display snapshots');if(c.callbackBefore)assert.deepEqual(c.callbackAfter,c.callbackBefore,'Production presentation callback makes no native owner/field writes');
  const post=!c.spe.active&&c.result.active,r=c.result,s=c.spe,d=post?r.display:s.display;if(!d||!d.frameValid)continue;
  const event=post?d.eventId:s.eventId,generation=post?r.generation:s.generation,key=generation+':'+event,x=post?r.x:s.x,y=post?r.y:s.y,movie=nativeMovie(36),region={x:48,y:16,width:64,height:64};assert.deepEqual([x,y],[48,16]);assert.deepEqual([movie.count,movie.picmax],[8,2]);
  assert.equal(c.nativeWidth,160);assert.equal(c.nativeHeight,96);assert.deepEqual([c.drawing.scale,c.drawing.flip,c.drawing.paint,c.drawing.palette0,c.drawing.palette255],[1,0,255,0x00ffffff,0xff000000]);
  const raw=Buffer.from(c.nativeRgba,'base64');assert.equal(raw.length,160*96*4);
  if(!events.has(key)){assert.equal(c.rawSource,'lcd-callback-image-data','Each event begins with actual timer callback ImageData');events.set(key,{records:movieOracle(movie,0,7,x,y),outside:raw,actor:post?r.actorIndex:s.actorIndex,target:post?r.targetIndex:s.targetIndex});}
  const state=events.get(key),expected=state.records[d.commitSeq-1];assert.ok(expected);assert.equal(d.frameIndex,expected.frame);assert.deepEqual(Buffer.from(d.visibleFrames),expected.visible);assert.deepEqual(Buffer.from(d.composition.clearFrames),expected.clears);
  const pixels=Buffer.from(expected.pixels);let label=null;
  if(post){assert.equal(r.protocolVersion,1);assert.equal(r.sourceValid,true);assert.equal(r.custom,false);assert.equal(r.skipEligible,false);assert.equal(r.returnEligible,false);assert.equal(r.resourceFingerprint,movie.fingerprint);assert.equal(r.resourceLength,movie.length);assert.equal(r.startFrm,0);assert.equal(r.endFrm,7);assert.equal(r.scene.composition.mode,2);assert.equal(d.composition.valid,true);assert.deepEqual([d.composition.x,d.composition.y,d.composition.width,d.composition.height],[48,16,64,64]);assert.equal(c.top.kind,2);assert.equal(c.top.active,true);assert.equal(c.top.valid,true);assert.equal(c.top.session,r.session);assert.equal(c.top.generation,r.generation);assert.equal(d.session,r.session);assert.equal(d.generation,r.generation);assert.equal(c.spe.active,0);assert.equal(c.ui.presentation,'skill-postlude');assert.equal(c.ui.outsideSource,'lcd');if(c.ui.source==='hd-assets'){assert.ok(waterEntry);assert.ok(c.ui.hdRegion&&c.ui.hdRegion.mode===2);}else{assert.ok(allowLcd,'Strict mode requires actual water assets');assert.equal(c.ui.source,'lcd');}assert.equal(c.ui.skipVisible,false);
   if(d.label.claimed){label=nativeLabel(r.resultKind);assert.equal(d.label.valid,true);assert.deepEqual(Buffer.from(d.label.bytes).subarray(0,d.label.length),label.bytes);assert.equal(d.label.length,label.bytes.length);assert.equal(d.label.text,new TextDecoder('gbk',{fatal:true}).decode(label.bytes));assert.deepEqual([d.label.x,d.label.y],[55,18]);drawLabel(pixels,label.bytes,55,18);labels++;}else assert.equal(d.digits.length,0);
   const num=nativePicture(nativeItem(15),0,true),decimal=String(r.value);assert.equal(r.number.resourceFingerprint,fnv(nativeItem(15)));assert.deepEqual([num.width,num.height,num.count,num.mask],[12,16,10,0]);assert.ok(d.digits.length<=decimal.length);
   for(let i=0;i<d.digits.length;i++){const p=d.digits[i];assert.equal(p.digit,Number(decimal[i]));assert.equal(p.x,55+6*i);assert.equal(p.firstY,56);assert.equal(p.y,57-p.drawCount);assert.ok(p.drawCount>0&&p.drawCount<=8);for(let draw=0;draw<p.drawCount;draw++)nativePaint(pixels,160,96,num,p.x,p.firstY-draw,p.digit);}
   if(d.digits.length)numbers++;if(r.phase==='hold'&&d.digits.length===decimal.length&&d.digits.every(p=>p.drawCount===8))holds++;postReadbacks++;if(c.ui.source==='hd-assets')postHd++;
  }else{assert.equal(s.protocolValid,true);assert.equal(s.skipEligible,false);assert.equal(s.resourceFingerprint,movie.fingerprint);assert.equal(s.resourceLength,movie.length);movieReadbacks++;if(c.ui.source==='hd-assets')movieHd++;else{assert.ok(allowLcd);assert.equal(c.ui.source,'lcd');}}
  const normalized=c.rawSource==='canvas-readback-normalized',full=Buffer.from(state.outside);if(normalized)for(let i=0;i<full.length;i+=4)if(full[i+3]===0)full.fill(0,i,i+4);
  for(let yy=region.y;yy<region.y+region.height;yy++)for(let xx=region.x;xx<region.x+region.width;xx++){const i=yy*160+xx;full.writeUInt32LE(pixels[i]?0xff000000:normalized?0:0x00ffffff,i*4);}
  assert.deepEqual(raw,full,'Full actual 160x96 LCD matches independent SPE planes, GBK font, opaque NUM15 six-pixel advances and complete upward footprints; outside actual window stays unchanged');
  assert.ok(c.ui.open&&c.dom.visible&&c.dom.inViewport&&c.dom.stackOwned,'Actual presentation canvas appears above the battle board');assert.deepEqual(c.ui.sourceRect,{x:15,y:16,width:130,height:64});assert.ok(c.nativeFile&&c.hdFile);
  if(c.ui.source==='hd-assets'){
   assertHdGeometry(c,expected,label,post);
   const scale=c.ui.scale,images=c.drawLog.filter(o=>o.type==='drawImage'&&o.src),live=frames(expected.visible);assert.deepEqual(images.map(o=>o.src),live.map(f=>waterEntry.pictures[movie.units[f].picIndex].src));
   images.forEach((o,i)=>{const p=waterEntry.pictures[movie.units[live[i]].picIndex];assert.deepEqual(o.args,[33*scale,0,64*scale,64*scale]);assert.deepEqual([o.naturalWidth,o.naturalHeight],[p.width,p.height]);});
   if(post){assert.ok(c.drawLog.some(o=>o.type==='rect'&&JSON.stringify(o.args)===JSON.stringify([33*scale,0,64*scale,64*scale])),'HD effect is clipped to the certified window');const texts=c.drawLog.filter(o=>o.type==='fillText'),expectedTexts=[];if(label)expectedTexts.push(d.label.text);for(const p of d.digits)for(let draw=0;draw<p.drawCount;draw++)expectedTexts.push(String(p.digit));assert.deepEqual(texts.map(o=>o.text),expectedTexts,'Only actual consumed label and displayed numeric history are replayed');let n=0;if(label){assert.deepEqual(texts[n++].args,[40*scale,2*scale,label.bytes.length*6*scale]);}for(const p of d.digits)for(let draw=0;draw<p.drawCount;draw++)assert.deepEqual(texts[n++].args,[(p.x-15)*scale,(p.firstY-draw-16)*scale,6*scale]);
    const shown=Buffer.from(c.hdLogicalRgba,'base64');assert.equal(shown.length,130*64*4);let outside=0;for(let yy=0;yy<64;yy++)for(let xx=0;xx<130;xx++){const nx=15+xx,ny=16+yy;if(nx>=48&&nx<112&&ny>=16&&ny<80)continue;const off=(ny*160+nx)*4,target=(yy*130+xx)*4,expect=Buffer.from(raw.subarray(off,off+4));if(expect[3]===0)expect.fill(0);assert.deepEqual(shown.subarray(target,target+4),expect,'Every logical pixel outside the HD window is the actual LCD');outside++;}assert.equal(outside,4224);
   }
  }
  if(c.rawSource==='lcd-callback-image-data')actualCallbacks++;verified.push({generation,eventId:event,session:r.session,phase:post?r.phase:'movie',paintSeq:d.paintSeq,commitSeq:d.commitSeq,frameIndex:d.frameIndex,source:c.ui.source,visible:frames(expected.visible),clear:frames(expected.clears),label:post?d.label:null,digits:post?d.digits:[],nativeFile:c.nativeFile,hdFile:c.hdFile,nativeRawSource:c.rawSource,nativeRgbaSha256:sha(raw),independentExpectedSha256:sha(full)});
 }
 assert.ok(movieReadbacks>=2,'Multiple actual native water movie timer flushes occurred');assert.ok(verified.some(v=>v.frameIndex===7),'Actual final water frame7 was displayed');assert.ok(labels&&numbers&&holds&&postReadbacks&&actualCallbacks,'Actual consumed label, actual numeric callbacks and final native hold all occurred');if(!allowLcd){assert.equal(movieHd,movieReadbacks);assert.equal(postHd,postReadbacks);}
 const matched=report.waterAttempts?.find(a=>verified.some(v=>events.get(v.generation+':'+v.eventId)?.actor===a.actor.i&&events.get(v.generation+':'+v.eventId)?.target===a.target?.i&&(!a.resultOwnerAfter||a.resultOwnerAfter.session===v.session)));assert.ok(matched,'A real player-confirmed water action matches the observed actor, target and actual result session');
 const nativeResult=selected.find(c=>c.result.active&&c.result.speId===36&&c.result.actorIndex===matched.actor.i&&c.result.targetIndex===matched.target.i&&(!matched.resultOwnerAfter||c.result.session===matched.resultOwnerAfter.session)&&['numbers','hold'].includes(c.result.phase)&&c.result.display?.valid&&c.result.display.digits.length)?.result;assert.ok(nativeResult);const before=matched.before.units.find(u=>u.i===matched.target.i)?.arms,after=matched.after.units.find(u=>u.i===matched.target.i)?.arms||0;if(nativeResult.resultKind===1)assert.equal(nativeResult.value,before-after,'Applied native result value matches troop delta; delta never supplies the displayed value');
 report.nativePixelOracle={actualLcdCallbacks:actualCallbacks,events:events.size,movieReadbacks,postReadbacks,movieHd,postHd,labels,numericReadbacks:numbers,completedHoldReadbacks:holds,verified};report.scope={accepted:'One actual standard-LIB P3 HanXuan/ChangSha33 to GuiYang36 navy WangLang14 skill12 water action on a current enemy river7 tile, original MP20/random outcome, WATER36 timer frames, real font label, NUM15 history and original numeric wait. All160x96 native source pixels are independently checked. LCD fallback does not complete HD art.',notRun:'Other skills, custom hooks, noMovie, mobile or performance; static river coordinates never authorize a target'};report.hdAccepted=!allowLcd&&movieHd===movieReadbacks&&postHd===postReadbacks;
}

async function saveSkillEvidence(cdp){const raw=await evaluate(cdp,'({captures:window.__skillCaptures,errors:window.__speObserverErrors,keys:window.__speEngineKeys,samples:window.__speSamples})');
 for(let i=0;i<raw.captures.length;i++){const c=raw.captures[i],stem='water-'+String(i).padStart(3,'0')+'-'+(c.result.phase||'movie');for(const[type,url]of[['lcd',c.nativeUrl],['hd',c.hdUrl]])if(url){const data=Buffer.from(url.split(',')[1],'base64'),name=stem+'-'+type+'.png';fs.writeFileSync(path.join(artifactDir,name),data);c[type==='lcd'?'nativeFile':'hdFile']={file:name,bytes:data.length,sha256:sha(data)};}delete c.nativeUrl;delete c.hdUrl;}
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
        if(preflightOnly){report.ok=true;report.hdAccepted=false;report.scope={accepted:'Readonly exact-source/LIB/resource/native-build preflight',notRun:'No private browser or game input'};return;}
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
        if (report.ok) console.log(preflightOnly?'Readonly preflight passed; no browser, cast, pixels or HD acceptance':baselineOnly?'Actual water route/menu baseline passed; no cast/HD claimed':'Actual WATER36 skill12 movie/label/NUM/hold native pixels passed; HD status is separately reported');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
