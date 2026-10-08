#!/usr/bin/env node
/**
 * Actual FIRE skill result, native font/NUM15 pixels and bounded HD window acceptance.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-skill-runtime.mjs --staged
 *   node scripts/test-hd-skill-runtime.mjs --artifact-dir build/r10-skill-runtime
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
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/r10-skill-runtime'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream' };
const report = { staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const servedAssets = new Map();
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const nativeMovies=new Map();let nativeLib,fireEntry,font;
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
 freezeAsset('pc.html');fireEntry=manifest.entries.find(e=>e.speId===35&&e.kind===2&&e.resourceIndex===0&&e.startFrm===0&&e.endFrm===7);assert.ok(fireEntry);assert.equal(fireEntry.skillResultVersion,1);
 const movie=nativeMovie(35);assert.equal(fireEntry.resourceFingerprint,movie.fingerprint);assert.equal(fireEntry.resourceLength,movie.length);assert.equal(fireEntry.count,movie.count);assert.equal(fireEntry.picmax,movie.picmax);
 assert.equal(fireEntry.units.length,movie.count);assert.equal(fireEntry.pictures.length,movie.picmax);
 fireEntry.units.forEach((u,i)=>{const r=movie.units[i];assert.deepEqual({frame:u.frame,x:u.x,y:u.y,picIndex:u.picIndex},{frame:i,x:r.x,y:r.y,picIndex:r.picIndex});});
 fireEntry.pictures.forEach((p,i)=>{const r=movie.pictures[i],png=servedAssets.get(p.src).data;assert.equal(p.picIndex,i);assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[r.width,r.height,r.width,r.height,r.mask]);assert.equal(png.readUInt32BE(16),p.width);assert.equal(png.readUInt32BE(20),p.height);});
 const number=nativePicture(nativeItem(15),0,true),source=fireEntry.skillNumber;
 assert.deepEqual([source.id,source.resourceIndex,source.pictureIndex,source.nativeWidth,source.nativeHeight,source.count,source.mask],[15,0,0,number.width,number.height,number.count,number.mask]);assert.equal(source.resourceFingerprint,fnv(nativeItem(15)));assert.equal(source.resourceLength,nativeItem(15).length);
 const fontText=servedAssets.get('vendor/iBaye/src/platform/js/font.bin.c').data.toString('utf8');font=Buffer.from([...fontText.matchAll(/0x([\da-f]{2})/gi)].map(m=>parseInt(m[1],16)));assert.equal(font.length,163840);assert.equal(crypto.createHash('sha256').update(font).digest('hex'),'31197c48c77e82bc244b17f44e405a3a055df8162af06fadd7271cc1990cc6b8');
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
 let api=null,originalKey=null,lastFire=null;const held=new Set();
 for(const name of ['clearRect','drawImage','fillRect','fillText','rect','clip']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(){const result=original.apply(this,arguments);if(this.canvas&&this.canvas.id==='hd-spe-canvas'){const args=Array.from(arguments);if(name==='clearRect'&&args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height)window.__skillDrawLog=[];let op={type:name,args,fillStyle:this.fillStyle,font:this.font};if(name==='drawImage'){const source=args.shift();op.src=source.src?new URL(source.src,location.href).pathname.replace(/^\//,''):null;op.args=args;op.naturalWidth=source.naturalWidth||source.width;op.naturalHeight=source.naturalHeight||source.height;}if(name==='fillText'){op.text=String(args.shift());op.args=args;}window.__skillDrawLog.push(op);}return result;};}
 const snapshot=()=>{try{return baye.hd.ready()?JSON.parse(JSON.stringify({spe:baye.hd.spe(),result:baye.hd.skillResult(),top:baye.hd.resultOwner(),fight:baye.hd.fight()})):null;}catch{return null;}};
 function capture(stage,img,w,h,callbackBefore,callbackAfter){try{
  if(!window.baye||!baye.hd||!baye.hd.ready())return;
  const s=snapshot(),spe=s.spe,result=s.result,ui=api&&api.debugSnapshot();window.__speSamples.push({stage,phase:window.__spePhase,at:performance.now(),spe,result,top:s.top,ui});
  if(spe.active&&spe.id===35&&spe.kind===2)lastFire={generation:spe.generation,eventId:spe.eventId,actorIndex:spe.actorIndex,targetIndex:spe.targetIndex,skillId:spe.skillId};
  const isFire=result.active&&result.speId===35,key=result.generation+':'+result.session;
  const readback=stage==='lifecycle'&&isFire&&result.phase==='hold'&&result.display&&result.display.valid&&!held.has(key);
  if(readback){const lcd=document.getElementById('lcd');img=lcd.getContext('2d').getImageData(0,0,lcd.width,lcd.height);w=lcd.width;h=lcd.height;held.add(key);}
  if((stage==='lcd-flush'||readback)&&img&&(isFire||lastFire)){
   const before=snapshot(),native=document.createElement('canvas'),hd=document.getElementById('hd-spe-canvas');native.width=w||img.width;native.height=h||img.height;native.getContext('2d').putImageData(img,0,0);
   const base64=data=>{let text='';for(const byte of data)text+=String.fromCharCode(byte);return btoa(text);};
   const rect=ui.sourceRect;let hdLogicalRgba=null;if(hd&&ui.open&&rect&&hd.width===rect.width*ui.scale&&hd.height===rect.height*ui.scale){const data=hd.getContext('2d').getImageData(0,0,hd.width,hd.height).data,logical=[];for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++){const offset=(Math.floor((y+.5)*ui.scale)*hd.width+Math.floor((x+.5)*ui.scale))*4;for(let channel=0;channel<4;channel++)logical.push(data[offset+channel]);}hdLogicalRgba=base64(logical);}
   const node=document.getElementById('hd-spe'),r=hd&&hd.getBoundingClientRect(),style=hd&&getComputedStyle(hd),rootStyle=node&&getComputedStyle(node),top=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   const dom=r&&{x:r.x,y:r.y,width:r.width,height:r.height,visible:!!(r.width&&r.height&&style.visibility==='visible'&&style.display!=='none'&&rootStyle.visibility==='visible'&&rootStyle.display!=='none'),inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,stackOwned:!!(top&&node.contains(top)),top:top&&{id:top.id,className:top.className}};
   const nativeUrl=native.toDataURL('image/png'),hdUrl=hd&&ui.open&&hd.toDataURL('image/png'),after=snapshot();
   window.__skillCaptures.push({stage:readback?'held-lcd-readback':'lcd-flush',rawSource:readback?'canvas-readback-normalized':'lcd-callback-image-data',at:performance.now(),callbackBefore,callbackAfter,before,after,spe,result,top:s.top,ui,dom,lastFire,lastFight:s.fight,hidden:document.hidden,mode:BayeHdBattle.getMode(),drawing:{scale:Number(baye.data.g_scale),flip:Number(baye.data.g_FlipDrawing),paint:Number(baye.data.g_paintColor),palette0:Number(baye.data.g_paintPalette[0]),palette255:Number(baye.data.g_paintPalette[255])},nativeWidth:native.width,nativeHeight:native.height,nativeRgba:base64(img.data),hdLogicalRgba,nativeUrl,hdUrl,drawLog:window.__skillDrawLog.slice()});
  }
  if(!spe.active&&!result.active&&s.fight.inputKind===1)lastFire=null;
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

async function smoke(cdp) {
    await waitFor(cdp, 'SPE v2 ready', 'window.baye && baye.hd && baye.hd.ready() && baye.hd.spe().protocolVersion === 2', 60000);
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
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real period 1 lord selection', 'baye.data.g_PIdx===1 && baye.hd.kings().count>0');
    const lord = await evaluate(cdp, "(() => {const m=baye.hd.kings();return {target:m.kings.findIndex(k=>k.name==='马腾'),index:m.index,kings:m.kings};})()");
    assert.ok(lord.target >= 0, 'Real period 1 contains Ma Teng');
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'native lord highlight', 'baye.hd.kings().index===' + lord.target);
    report.selectedLord = lord.kings[lord.target];
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', 'baye.hd.march().pick && baye.hd.realm().ownedCount>0');
    await checkpoint(cdp, '03-real-map');
    report.actualLib = await evaluate(cdp, '({preferred:localStorage.getItem("baye/libpath"),hex:window.dynLib})');
    report.actualLib.sha256 = crypto.createHash('sha256').update(Buffer.from(report.actualLib.hex, 'hex')).digest('hex');
    delete report.actualLib.hex;
    await evaluate(cdp, "window.__spePhase='battle';");
    await marchSmoke(cdp);
}
async function action(cdp, label, expression) {
    const before=await evaluate(cdp,'({fight:baye.hd.fight(),march:baye.hd.march(),menu:baye.hd.menuItems()})');
    const result=await evaluate(cdp, expression);
    report.inputs.push({type:'action', label, before, result, at:new Date().toISOString()});
    return result;
}

async function marchSmoke(cdp) {
    await evaluate(cdp, `(() => { BayeHdOverworld.setMode('hd-map'); BayeHdCityMenu.setMode('hd'); BayeHdBattle.setMode('hd'); })()`);
    const owned = await waitFor(cdp, 'owned HD map 天水', `(() => { const m=BayeHdOverworld.debugSnapshot(); return m.phase==='map' && m.owned.find(c=>c.i===8 && c.name==='天水'); })()`);
    report.marchPlan = await evaluate(cdp, `(() => {
        const realm=baye.hd.realm();
        return realm.cities.filter(c=>c.owned).map(c=>({ ...c, links:baye.hd.cityLinks(c.i), persons:Number(baye.data.g_Cities[c.i].Persons), food:Number(baye.data.g_Cities[c.i].Food) }));
    })()`);
    assert.ok(await action(cdp,'open-owned-city', `BayeHdOverworld.walkToCity(${owned.i})`));
    await waitFor(cdp, 'real city root menu', `BayeHdCityMenu.isOpen() && BayeHdCityMenu.getLayer() === 'root' && baye.hd.menuItems().active`);
    await checkpoint(cdp,'06-hd-city');
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp, 'military submenu', `BayeHdCityMenu.getLayer() === 'sub' && baye.hd.menuItems().active && baye.hd.menuItems().names[0] === '侦察'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="4"]');
    await waitFor(cdp, 'march person picker', `(() => { const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.march(); return m.phase===1 && m.origin===8 && s.deepItems.length && baye.hd.menuItems().active; })()`);
    await checkpoint(cdp,'07-march-persons');
    // The engine can finish automatically after the final remaining general.
    // Observe selected ACK and live phase before choosing another person.
    for(let i=0;i<6;i++) {
        const before=await evaluate(cdp,'({march:baye.hd.march(),menu:baye.hd.menuItems(),city:BayeHdCityMenu.debugSnapshot()})');
        if(before.march.phase!==1 || !before.menu.active || !before.city.deepItems.length) break;
        await click(cdp,'#hd-city-menu [data-hd-deep="0"]');
        await waitFor(cdp,'selected general acknowledged',`baye.hd.march().selected > ${before.march.selected} || baye.hd.march().phase !== 1`);
    }
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
    const selected=await action(cdp,'select-target-only','BayeHdCityMenu.selectMarchTarget(9)');
    assert.equal(selected.selected,9);
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4,'selecting alone must not send confirmation');
    await action(cdp,'confirm-target','BayeHdCityMenu.confirmMarchTarget(9)');
    await waitFor(cdp,'real departure report','baye.hd.march().phase===6',20000);
    await checkpoint(cdp,'12-march-departure-report');
    const departureMapSeq=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await action(cdp,'confirm-departure-report','BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'actual AddFightOrder ACK','baye.hd.march().phase===7 && baye.hd.march().ok===1');
    await waitFor(cdp,'actual strategy input after departure',`(() => {const m=baye.hd.march(),menu=baye.hd.menuItems();return (menu.active&&[1,2].includes(menu.context))||(!menu.active&&m.pick===1&&m.battlePick===0&&m.mapInputSeq>${departureMapSeq});})()`);
    await checkpoint(cdp,'13-march-order-ack');
    await action(cdp,'end-strategy-once','BayeHdCityMenu.goStrategyEnd()');
    await waitFor(cdp,'explicit strategy request accepted','BayeHdCityMenu.debugSnapshot().handoff || baye.hd.fight().active');
    await waitFor(cdp,'real battle player selection','baye.hd.fight().active && !baye.hd.fight().over && baye.hd.fight().inputKind===1',60000);
    await checkpoint(cdp,'14-battle-ready');
    await battleSmoke(cdp);
}

const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<0xfffe) units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),arms:Number(d.g_Persons[id-1].Arms)});
    }
    return {fight:baye.hd.fight(),units,weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),knownEnemy:Number(d.g_EneTmpProv)}};
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
async function chooseGeneral(cdp,unit) {
    const selected=await action(cdp,'select-'+unit.name,`BayeHdBattle.clickUnitByName(${JSON.stringify(unit.name)})`);
    assert.equal(selected.ok,true);
    return waitFor(cdp,'selected general movement or direct action',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return !s.transaction&&(f.inputKind===2||f.inputKind===3)&&f.actorIndex===${unit.i}&&f;})()`);
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
        units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x,y,arms:Number(d.g_Persons[id-1].Arms),terrain:baye.getTerrainByGeneralIndex(i),armType:baye.getArmType(id-1)});
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

async function waitActionResolved(cdp,label,afterBout=null) {
    const deadline=Date.now()+60000,accepted=new Set();
    while(Date.now()<deadline) {
        const s=await evaluate(cdp,'({f:baye.hd.fight(),s:baye.hd.spe(),b:BayeHdBattle.debugSnapshot(),d:BayeHdDialog.debugSnapshot()})');
        if(s.f.over||(!s.b.transaction&&s.f.inputKind===1&&!s.s.active&&(afterBout==null||s.f.bout>afterBout)))return s.f;
        // Only an actual waiting report owner permits this explicit player ACK.
        if(s.d.open&&s.d.kind==='report'&&s.d.reportOwner) {
            const owner=JSON.stringify(s.d.reportOwner);
            if(!accepted.has(owner)) {accepted.add(owner);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');}
        }
        await delay(150);
    }
    throw new Error('Timeout: '+label);
}

async function attemptFire(cdp,actor) {
    const name=await evaluate(cdp,'baye.hd.menuItems().names[1]');
    await menuChoice(cdp,name,4);
    const options=await evaluate(cdp,skillOptionsExpression);
    report.fireOptions??=[];report.fireOptions.push({actor:actor.name,options});
    for(const skill of options.filter(s=>s.available&&s.speId===35)) {
        const before=await evaluate(cdp,battleStateExpression),mp=before.units.find(u=>u.i===actor.i).mp;
        await menuChoice(cdp,skill.name);
        await waitFor(cdp,'actual fire targeting','!BayeHdBattle.debugSnapshot().transaction && [1,5].includes(baye.hd.fight().inputKind)');
        let target=null;
        if(await evaluate(cdp,'baye.hd.fight().inputKind===5')) {
            const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.arms>0&&
                (Boolean(skill.aim&1)===(u.side==='player'))&&skill.eland[u.terrain]>0&&skill.earm[u.armType]>0);
            target=targets[0];
            if(!target) {
                await action(cdp,'cancel-fire-no-legal-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'actual no-target return');
                await menuChoice(cdp,name,4);continue;
            }
            const result=await action(cdp,'confirm-real-fire-'+skill.name+'-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
            assert.equal(result.ok,true);
        }
        await waitActionResolved(cdp,'actual fire action resolves');
        const after=await evaluate(cdp,battleStateExpression),caster=after.units.find(u=>u.i===actor.i);
        assert.ok(caster,'actual fire caster still exists for MP verification');
        assert.equal(mp-caster.mp,skill.useMp,'Fire consumes the real LIB MP cost');
        const resultOwner=await evaluate(cdp,'baye.hd.skillResult()');
        report.fireAttempts??=[];report.fireAttempts.push({actor,skill,target,before,after,resultOwnerAfter:resultOwner});
        await checkpoint(cdp,'30-real-fire-attempt-'+report.fireAttempts.length);
        return true;
    }
    await action(cdp,'cancel-unavailable-fire','BayeHdBattle.cancel()');await waitBattle(cdp,3,'return from unavailable fire');return false;
}

async function battleSmoke(cdp) {
    report.combatStart=await evaluate(cdp,battleStateExpression);
    // Keep the 100-troop lord at his actual starting tile. The existing battle
    // acceptance uses this same legal rest before approaching with other units.
    const lord=report.combatStart.units.find(u=>u.i===0);
    await chooseGeneral(cdp,lord);
    assert.equal((await action(cdp,'protect-lord-stay-native-tile',`BayeHdBattle.clickTile(${lord.x},${lord.y})`)).ok,true);
    await waitBattle(cdp,3,'lord stays at actual starting tile');
    await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
    // Read-only native masks choose legal targets; every command is a public UI
    // operation a player can issue. No engine fields or private movies are written.
    for(let step=0;step<36;step++) {
        const evidence=await collectSpe(cdp);
        const fire=evidence.samples.filter(r=>r.stage==='lcd-flush'&&r.spe.active&&r.spe.kind===2&&r.spe.id===35&&r.spe.display.frameValid);
        if(await evaluate(cdp,"window.__skillCaptures.some(c=>c.result&&c.result.active&&c.result.speId===35&&c.result.phase==='hold'&&c.result.display.valid&&c.result.display.digits.length&&c.result.display.digits.every(d=>d.drawCount===8))"))break;
        const current=await evaluate(cdp,battleStateExpression);
        if(current.fight.over)break;
        const actor=current.units.filter(u=>u.side==='player'&&u.active===0&&![8,1,6].includes(u.state)&&u.arms>0)
            .sort((a,b)=>Number(a.i===0)-Number(b.i===0))[0];
        if(!actor) {
            if((report.turns?.length||0)>=4)break;
            await endArmyTurn(cdp);continue;
        }
        const selection=await chooseGeneral(cdp,actor);
        if(selection.inputKind===2) {
            if(actor.i===0) {
                assert.equal((await action(cdp,'keep-lord-protected',`BayeHdBattle.clickTile(${actor.x},${actor.y})`)).ok,true);
                await waitBattle(cdp,3,'lord action menu');
                await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
                continue;
            }
            const candidates=await evaluate(cdp,moveTilesExpression),enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);
            if(!enemies.length)break;
            const distance=p=>Math.min(...enemies.map(u=>Math.abs(p.x-u.x)+Math.abs(p.y-u.y)));
            const target=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8)).sort((a,b)=>distance(a)-distance(b))[0];
            assert.ok(target,'A genuinely legal unoccupied move tile exists');
            const moved=await action(cdp,'approach-native-path-'+actor.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
            assert.equal(moved.ok,true);await waitBattle(cdp,3,'native action menu after movement');
        }
        if(await attemptFire(cdp,actor))continue;
        const rest=await evaluate(cdp,'baye.hd.menuItems().names[3]');await menuChoice(cdp,rest,1);
    }
    const evidence=await collectSpe(cdp);assertDisplayRecords(evidence.samples);
    assert.deepEqual(evidence.keys.filter(k=>k.resultActive),[],'Actual skill movie/numbers/hold delivers no keys');
    report.combatEnd=await evaluate(cdp,battleStateExpression);assert.ok(!await evaluate(cdp,'baye.hd.skillResult().active'),'Actual native result owner retires after the original wait');
    await checkpoint(cdp,'31-real-skill-result-retired');
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
 else for(const frame of frames(expected.clears)){const u=fireEntry.units[frame],p=fireEntry.pictures[u.picIndex];consume('fillRect',[(48+u.x-15)*scale,u.y*scale,p.logicalWidth*scale,p.logicalHeight*scale]);}
 for(const frame of frames(expected.visible)){const u=fireEntry.units[frame],p=fireEntry.pictures[u.picIndex],op=consume('drawImage',[(48+u.x-15)*scale,u.y*scale,p.logicalWidth*scale,p.logicalHeight*scale],null,p.src);assert.deepEqual([op.naturalWidth,op.naturalHeight],[p.width,p.height]);}
 if(post){
  const rects=c.drawLog.filter(o=>o.type==='rect'),expectedRects=[[33*scale,0,65*scale,64*scale]];
  if(label){const box=[40*scale,2*scale,label.bytes.length*6*scale,12*scale];consume('fillRect',box);const op=consume('fillText',box.slice(0,3),c.result.display.label.text);assert.match(op.font,new RegExp('^'+12*scale+'px '));expectedRects.push(box);}
  for(const p of c.result.display.digits)for(let draw=0;draw<p.drawCount;draw++){const box=[(p.x-15)*scale,(p.firstY-draw-16)*scale,12*scale,16*scale];consume('fillRect',box);const op=consume('fillText',[box[0],box[1],6*scale],String(p.digit));assert.equal(op.font,'bold '+16*scale+'px Georgia, serif');expectedRects.push(box);}
  assert.deepEqual(rects.map(o=>o.args),expectedRects,'Every label/digit is clipped inside its own true native box and the certified effect window');
 }
 assert.equal(index,ops.length,'No unobserved scene, label or numeric draw is added');
}
function verifySkillCaptures(captures){
 const selected=captures.filter(c=>c.spe.active&&c.spe.id===35&&c.spe.kind===2||c.result.active&&c.result.speId===35&&c.result.display&&c.result.display.valid);
 assert.ok(selected.length,'The actual game produced default FIRE');const events=new Map(),verified=[];let labels=0,numbers=0,holds=0,movieHd=0,postHd=0,actualCallbacks=0;
 for(const c of selected){assert.deepEqual(c.after,c.before,'Reading pixels and PNG preserves all native owner/display snapshots');if(c.callbackBefore)assert.deepEqual(c.callbackAfter,c.callbackBefore,'Production presentation callback makes no native owner/field writes');
  const post=!c.spe.active&&c.result.active,r=c.result,s=c.spe,d=post?r.display:s.display;if(!d||!d.frameValid)continue;
  const event=post?d.eventId:s.eventId,generation=post?r.generation:s.generation,key=generation+':'+event,x=post?r.x:s.x,y=post?r.y:s.y,movie=nativeMovie(35),region={x:48,y:16,width:65,height:64};assert.deepEqual([x,y],[48,16]);assert.deepEqual([movie.count,movie.picmax],[8,2]);
  assert.equal(c.nativeWidth,160);assert.equal(c.nativeHeight,96);assert.deepEqual([c.drawing.scale,c.drawing.flip,c.drawing.paint,c.drawing.palette0,c.drawing.palette255],[1,0,255,0x00ffffff,0xff000000]);
  const raw=Buffer.from(c.nativeRgba,'base64');assert.equal(raw.length,160*96*4);
  if(!events.has(key)){assert.equal(c.rawSource,'lcd-callback-image-data','Each event begins with actual timer callback ImageData');events.set(key,{records:movieOracle(movie,0,7,x,y),outside:raw,actor:post?r.actorIndex:s.actorIndex,target:post?r.targetIndex:s.targetIndex});}
  const state=events.get(key),expected=state.records[d.commitSeq-1];assert.ok(expected);assert.equal(d.frameIndex,expected.frame);assert.deepEqual(Buffer.from(d.visibleFrames),expected.visible);assert.deepEqual(Buffer.from(d.composition.clearFrames),expected.clears);
  const pixels=Buffer.from(expected.pixels);let label=null;
  if(post){assert.equal(r.protocolVersion,1);assert.equal(r.sourceValid,true);assert.equal(r.custom,false);assert.equal(r.skipEligible,false);assert.equal(r.returnEligible,false);assert.equal(r.resourceFingerprint,movie.fingerprint);assert.equal(r.resourceLength,movie.length);assert.equal(r.startFrm,0);assert.equal(r.endFrm,7);assert.equal(r.scene.composition.mode,2);assert.equal(d.composition.valid,true);assert.deepEqual([d.composition.x,d.composition.y,d.composition.width,d.composition.height],[48,16,65,64]);assert.equal(c.top.kind,2);assert.equal(c.top.active,true);assert.equal(c.top.valid,true);assert.equal(c.top.session,r.session);assert.equal(c.top.generation,r.generation);assert.equal(d.session,r.session);assert.equal(d.generation,r.generation);assert.equal(c.spe.active,0);assert.equal(c.ui.presentation,'skill-postlude');assert.equal(c.ui.outsideSource,'lcd');assert.equal(c.ui.source,'hd-assets','Every actual supported label/number/hold readback is HD inside its native window');assert.ok(c.ui.hdRegion&&c.ui.hdRegion.mode===2);assert.equal(c.ui.skipVisible,false);
   if(d.label.claimed){label=nativeLabel(r.resultKind);assert.equal(d.label.valid,true);assert.deepEqual(Buffer.from(d.label.bytes).subarray(0,d.label.length),label.bytes);assert.equal(d.label.length,label.bytes.length);assert.equal(d.label.text,new TextDecoder('gbk',{fatal:true}).decode(label.bytes));assert.deepEqual([d.label.x,d.label.y],[55,18]);drawLabel(pixels,label.bytes,55,18);labels++;}else assert.equal(d.digits.length,0);
   const num=nativePicture(nativeItem(15),0,true),decimal=String(r.value);assert.equal(r.number.resourceFingerprint,fnv(nativeItem(15)));assert.deepEqual([num.width,num.height,num.count,num.mask],[12,16,10,0]);assert.ok(d.digits.length<=decimal.length);
   for(let i=0;i<d.digits.length;i++){const p=d.digits[i];assert.equal(p.digit,Number(decimal[i]));assert.equal(p.x,55+6*i);assert.equal(p.firstY,56);assert.equal(p.y,57-p.drawCount);assert.ok(p.drawCount>0&&p.drawCount<=8);for(let draw=0;draw<p.drawCount;draw++)nativePaint(pixels,160,96,num,p.x,p.firstY-draw,p.digit);}
   if(d.digits.length)numbers++;if(r.phase==='hold'&&d.digits.length===decimal.length&&d.digits.every(p=>p.drawCount===8))holds++;postHd++;
  }else{assert.equal(s.protocolValid,true);assert.equal(s.skipEligible,false);assert.equal(s.resourceFingerprint,movie.fingerprint);assert.equal(s.resourceLength,movie.length);if(c.ui.source==='hd-assets')movieHd++;}
  const normalized=c.rawSource==='canvas-readback-normalized',full=Buffer.from(state.outside);if(normalized)for(let i=0;i<full.length;i+=4)if(full[i+3]===0)full.fill(0,i,i+4);
  for(let yy=region.y;yy<region.y+region.height;yy++)for(let xx=region.x;xx<region.x+region.width;xx++){const i=yy*160+xx;full.writeUInt32LE(pixels[i]?0xff000000:normalized?0:0x00ffffff,i*4);}
  assert.deepEqual(raw,full,'Full actual 160x96 LCD matches independent SPE planes, GBK font, opaque NUM15 six-pixel advances and complete upward footprints; outside actual window stays unchanged');
  assert.ok(c.ui.open&&c.dom.visible&&c.dom.inViewport&&c.dom.stackOwned,'Actual presentation canvas appears above the battle board');assert.deepEqual(c.ui.sourceRect,{x:15,y:16,width:130,height:64});assert.ok(c.nativeFile&&c.hdFile);
  if(c.ui.source==='hd-assets'){
   assertHdGeometry(c,expected,label,post);
   const scale=c.ui.scale,images=c.drawLog.filter(o=>o.type==='drawImage'&&o.src),live=frames(expected.visible);assert.deepEqual(images.map(o=>o.src),live.map(f=>fireEntry.pictures[movie.units[f].picIndex].src));
   images.forEach((o,i)=>{const p=fireEntry.pictures[movie.units[live[i]].picIndex];assert.deepEqual(o.args,[33*scale,0,65*scale,64*scale]);assert.deepEqual([o.naturalWidth,o.naturalHeight],[p.width,p.height]);});
   if(post){assert.ok(c.drawLog.some(o=>o.type==='rect'&&JSON.stringify(o.args)===JSON.stringify([33*scale,0,65*scale,64*scale])),'HD effect is clipped to the certified window');const texts=c.drawLog.filter(o=>o.type==='fillText'),expectedTexts=[];if(label)expectedTexts.push(d.label.text);for(const p of d.digits)for(let draw=0;draw<p.drawCount;draw++)expectedTexts.push(String(p.digit));assert.deepEqual(texts.map(o=>o.text),expectedTexts,'Only actual consumed label and displayed numeric history are replayed');let n=0;if(label){assert.deepEqual(texts[n++].args,[40*scale,2*scale,label.bytes.length*6*scale]);}for(const p of d.digits)for(let draw=0;draw<p.drawCount;draw++)assert.deepEqual(texts[n++].args,[(p.x-15)*scale,(p.firstY-draw-16)*scale,6*scale]);
    const shown=Buffer.from(c.hdLogicalRgba,'base64');assert.equal(shown.length,130*64*4);let outside=0;for(let yy=0;yy<64;yy++)for(let xx=0;xx<130;xx++){const nx=15+xx,ny=16+yy;if(nx>=48&&nx<113&&ny>=16&&ny<80)continue;const off=(ny*160+nx)*4,target=(yy*130+xx)*4,expect=Buffer.from(raw.subarray(off,off+4));if(expect[3]===0)expect.fill(0);assert.deepEqual(shown.subarray(target,target+4),expect,'Every logical pixel outside the HD window is the actual LCD');outside++;}assert.equal(outside,4160);
   }
  }
  if(c.rawSource==='lcd-callback-image-data')actualCallbacks++;verified.push({generation,eventId:event,session:r.session,phase:post?r.phase:'movie',paintSeq:d.paintSeq,commitSeq:d.commitSeq,frameIndex:d.frameIndex,source:c.ui.source,visible:frames(expected.visible),clear:frames(expected.clears),label:post?d.label:null,digits:post?d.digits:[],nativeFile:c.nativeFile,hdFile:c.hdFile,nativeRawSource:c.rawSource,nativeRgbaSha256:sha(raw),independentExpectedSha256:sha(full)});
 }
 assert.ok(movieHd>=2,'Multiple actual FIRE movie display frames render HD');assert.ok(labels&&numbers&&holds&&postHd&&actualCallbacks,'Actual consumed label, actual numeric callbacks and final native hold all occurred');
 const matched=report.fireAttempts?.find(a=>verified.some(v=>events.get(v.generation+':'+v.eventId)?.actor===a.actor.i&&events.get(v.generation+':'+v.eventId)?.target===a.target?.i&&(!a.resultOwnerAfter||a.resultOwnerAfter.session===v.session)));assert.ok(matched,'A real player-confirmed fire action matches the observed actor, target and actual result session');
 const nativeResult=selected.find(c=>c.result.active&&c.result.speId===35&&c.result.actorIndex===matched.actor.i&&c.result.targetIndex===matched.target.i&&(!matched.resultOwnerAfter||c.result.session===matched.resultOwnerAfter.session)&&['numbers','hold'].includes(c.result.phase)&&c.result.display?.valid&&c.result.display.digits.length)?.result;assert.ok(nativeResult);const before=matched.before.units.find(u=>u.i===matched.target.i)?.arms,after=matched.after.units.find(u=>u.i===matched.target.i)?.arms||0;if(nativeResult.resultKind===1)assert.equal(nativeResult.value,before-after,'Applied native result value matches troop delta; delta never supplies the displayed value');
 report.nativePixelOracle={actualLcdCallbacks:actualCallbacks,events:events.size,movieHd,postHd,labels,numericReadbacks:numbers,completedHoldReadbacks:holds,verified};report.scope={accepted:'One actual standard-LIB default FIRE35 action including real font label, NUM15 history and original native result wait. HD effect pictures occupy the actual opaque65x64window; the result label/numeric/hold presenter preserves surrounding actualLCD. The existing movie presenter uses neutral artwork surround, not an authenticated full-arena replacement.',notRun:'Other skills, custom hooks, unknown LIB, noMovie/map-edge fallback, AOE, mobile or performance; C/JS suites cover some boundaries separately',legacyEvidence:'Old spe-runtime file names containing native-frame were HD canvas exports and are not used as native-pixel evidence here'};report.hdAccepted=true;
}
async function saveSkillEvidence(cdp){const raw=await evaluate(cdp,'({captures:window.__skillCaptures,errors:window.__speObserverErrors,keys:window.__speEngineKeys,samples:window.__speSamples})');
 for(let i=0;i<raw.captures.length;i++){const c=raw.captures[i],stem='fire-'+String(i).padStart(3,'0')+'-'+(c.result.phase||'movie');for(const[type,url]of[['lcd',c.nativeUrl],['hd',c.hdUrl]])if(url){const data=Buffer.from(url.split(',')[1],'base64'),name=stem+'-'+type+'.png';fs.writeFileSync(path.join(artifactDir,name),data);c[type==='lcd'?'nativeFile':'hdFile']={file:name,bytes:data.length,sha256:sha(data)};}delete c.nativeUrl;delete c.hdUrl;}
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
        if (report.ok) console.log('Real FIRE label/number/hold, native-pixel and bounded HD-window acceptance passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
