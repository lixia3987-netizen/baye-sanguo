#!/usr/bin/env node
/**
 * Real standard-LIB/WASM overworld acceptance, with isolated HTTP/CDP/profile.
 *   $env:CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
 *   node scripts/test-hd-overworld-runtime.mjs --artifact-dir build/r08-overworld
 *   node scripts/test-hd-overworld-runtime.mjs --all-lords --artifact-dir build/r08-lords
 * --bridge-art validates actual naturally derived bridge draws and HTTP bytes at both viewports.
 * --missing-bridge-asset serves only the new bridge PNG as an intentional 404.
 * --bridge-only runs bridge/classic/hidden/pan/zoom checks and skips the 38-city traversal.
 * Without these flags the original complete acceptance flow remains in use.
 * --staged serves the four build/wasm/src loader artifacts without installing.
 * Only trusted pointer/key events change native state. setScale is explicitly
 * a presentation-only API (the current page has no native zoom control).
 * A non-owned city must NOT enter PlayerTactic's city menu. Period 1 has 25
 * owned and 13 unowned cities; --all-lords legitimately covers those 25 roots.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {inflateSync} from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staged=process.argv.includes('--staged'),allLords=process.argv.includes('--all-lords');
const missingBridgeAsset=process.argv.includes('--missing-bridge-asset'),bridgeOnly=process.argv.includes('--bridge-only');
const bridgeArt=process.argv.includes('--bridge-art')||missingBridgeAsset||bridgeOnly;
const bridgePath='/assets/hd-overworld/roads/bridge-crossing-v1.png';
const bridgeSha='110a48d457f5af9be4f51d156f2841eab1dc7e524232d5592ab7bbe1c64f1e88';
assert.ok(!bridgeOnly||!allLords,'--bridge-only cannot claim --all-lords coverage');
const argument=flag=>{const i=process.argv.indexOf(flag);if(i<0)return null;
    const value=process.argv[i+1];assert.ok(value&&!value.startsWith('--'),flag+' requires a value');return value;};
const artifactDir=path.resolve(argument('--artifact-dir')||path.join(root,'build/r08-overworld'+(allLords?'-lords':'')));
const probeLordId=argument('--probe-lord-id');if(probeLordId!=null)assert.ok(/^\d+$/.test(probeLordId)&&!allLords,'--probe-lord-id requires a nonnegative actual lord ID, without --all-lords');
assert.ok(!bridgeArt||probeLordId==null,'bridge acceptance requires the ordinary two-viewport flow, without --probe-lord-id');
const standardSha='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const snapshots=new Map();
const report={startedAt:new Date().toISOString(),staged,allLords,probeLordId,bridgeArt,bridgeOnly,missingBridgeAsset,bridgeChecks:[],actions:[],sessions:[],cities:[],phases:[],
    sources:{},requests:[],console:[],exceptions:[],dialogs:[],blocked:[],zoomInput:'presentation-only BayeHdOverworld.setScale; native keys must remain zero'};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
    '.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg',
    '.jpeg':'image/jpeg','.lib':'application/octet-stream'};
const engines=['baye.js','baye.wasm','baye.wasm.map','baye.build.json'];
function walk(directory,skip){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    if(skip&&skip(entry))return [];const filename=path.join(directory,entry.name);
    return entry.isDirectory()?walk(filename,skip):[filename];});}
function freeze(rel,filename=path.join(root,rel)){
    const bytes=fs.readFileSync(filename),metadata={source:path.relative(root,filename).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)};
    snapshots.set(rel,{bytes,metadata});report.sources[rel]=metadata;
}
function pngAlpha(bytes){
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],type=bytes[25];
    if(depth!==8||bytes[28]!==0)return {decoded:false,reason:'alpha census supports noninterlaced 8-bit PNG'};
    const channels={0:1,2:3,3:1,4:2,6:4}[type];if(!channels)return {decoded:false,reason:'unsupported PNG color type'};
    const chunks=[];let transparency=null;
    for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset),name=bytes.subarray(offset+4,offset+8).toString('ascii');
        assert.ok(offset+12+length<=bytes.length,'bounded PNG chunk');const payload=bytes.subarray(offset+8,offset+8+length);
        if(name==='IDAT')chunks.push(payload);if(name==='tRNS')transparency=payload;offset+=length+12;if(name==='IEND')break;}
    const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels;assert.equal(raw.length,(stride+1)*height,'decoded PNG scanline length');
    let previous=Buffer.alloc(stride),current=Buffer.alloc(stride),transparent=0,partial=0,opaque=0;
    const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
    for(let y=0;y<height;y++){const offset=y*(stride+1),filter=raw[offset];assert.ok(filter<=4,'known PNG filter');
        for(let i=0;i<stride;i++){const a=i>=channels?current[i-channels]:0,b=previous[i],c=i>=channels?previous[i-channels]:0;
            current[i]=(raw[offset+1+i]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}
        for(let x=0;x<width;x++){const alpha=type===6?current[x*4+3]:type===4?current[x*2+1]:type===3&&transparency?(transparency[current[x]]??255):255;
            if(alpha===0)transparent++;else if(alpha===255)opaque++;else partial++;}
        const swap=previous;previous=current;current=swap;
    }
    return {decoded:true,pixels:width*height,transparent,partial,opaque,visibleFraction:(partial+opaque)/(width*height)};
}
function prepareAssets(){
    const runner=fs.readFileSync(fileURLToPath(import.meta.url));report.runner={bytes:runner.length,sha256:sha(runner)};
    for(const directory of ['js','css'])for(const filename of walk(path.join(root,directory)))
        freeze(path.relative(root,filename).replaceAll('\\','/'),filename);
    freeze('pc.html');freeze('libs/dat-mod.lib');
    for(const filename of walk(path.join(root,'assets/hd-overworld'),entry=>entry.isDirectory()&&entry.name==='reference'))
        freeze(path.relative(root,filename).replaceAll('\\','/'),filename);
    if(staged)for(const name of engines)freeze('js/'+name,path.join(root,'build/wasm/src',name));
    report.engineManifest=JSON.parse(snapshots.get('js/baye.build.json').bytes.toString('utf8'));
    for(const name of engines.filter(n=>n!=='baye.build.json')){
        const actual=report.sources['js/'+name],declared=report.engineManifest.artifacts[name];
        assert.equal(actual.bytes,declared.bytes,'manifest byte length '+name);assert.equal(actual.sha256,declared.sha256,'manifest SHA '+name);
    }
    assert.equal(report.sources['libs/dat-mod.lib'].sha256,standardSha,'actual standard LIB bytes');
    report.mapManifest=JSON.parse(snapshots.get('assets/hd-overworld/manifest.json').bytes.toString('utf8'));
    report.geo=JSON.parse(snapshots.get('assets/hd-overworld/china-lcc-cities.json').bytes.toString('utf8'));
    if(bridgeArt){assert.equal(report.mapManifest.layers.roads.pass,'roads/bridge-crossing-v1.png');
        assert.equal(report.sources[bridgePath.slice(1)]?.sha256,bridgeSha,'frozen original bridge PNG');
        assert.equal(report.sources[bridgePath.slice(1)]?.bytes,1198185,'frozen original bridge PNG bytes');}
    assert.equal(report.geo.libSha256,standardSha);assert.equal(report.mapManifest.libSha256,standardSha);
    report.pngHeaders={};for(const [rel,item] of snapshots){if(!rel.startsWith('assets/hd-overworld/')||!rel.endsWith('.png'))continue;
        assert.equal(item.bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','actual PNG signature '+rel);
        report.pngHeaders[rel]={width:item.bytes.readUInt32BE(16),height:item.bytes.readUInt32BE(20),bitDepth:item.bytes[24],colorType:item.bytes[25],
            alphaChannel:[4,6].includes(item.bytes[25]),sha256:item.metadata.sha256,alpha:pngAlpha(item.bytes)};}
}
// Read-only bridge observation within the existing isolated overworld runner.
const bridgeWorldExpression=`(() => {const d=baye.data,n=(v)=>{const x=Number(v);if(!Number.isInteger(x))throw Error('Missing native world field');return x;};
    const personFields=['OldBelong','Belong','Level','Force','IQ','Devotion','Character','Experience','Thew','ArmsType','Arms','Tool1','Tool2','Age'];
    const cityFields=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce','PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms','PersonQueue','Persons','ToolQueue','Tools'];
    const orderFields=['OrderId','Person','City','Object','Arms','Food','Money','Consume','TimeCount'];
    const rows=(a,fields,count)=>Array.from({length:count},(_,i)=>Object.fromEntries(fields.map(k=>[k,n(a[i][k])])));
    return {period:n(d.g_PIdx),king:n(d.g_PlayerKing),year:n(d.g_YearDate),month:n(d.g_MonthDate),
        cursor:{x:n(d.g_CityPos.setx),y:n(d.g_CityPos.sety)},mapCity:n(d.g_hdMapCity),menu:baye.hd.menuItems(),march:baye.hd.march(),
        people:rows(d.g_Persons,personFields,baye.getPersonCount()),cities:rows(d.g_Cities,cityFields,38),
        personQueue:Array.from(d.g_PersonsQueue,n),orders:rows(d.g_OrderQueue,orderFields,d.g_OrderQueue.length),fighters:Array.from(d.FIGHTERS,n)};})()`;

const bridgeObserverSource=`(() => {const canvas=document.getElementById('hd-overworld-canvas'),ctx=canvas.getContext('2d');
    window.__r23BridgeOps=[];window.__r23BridgeErrors=[];window.__r23BridgeRecording=false;
    const observe=(kind,args)=>{if(!window.__r23BridgeRecording)return;try{
        if(kind==='drawImage'&&!(typeof args[0]?.src==='string'&&new URL(args[0].src,location.href).pathname===${JSON.stringify('/assets/hd-overworld/roads/bridge-crossing-v1.png')}))return;
        if(kind==='arc'&&args[2]!==7)return;
        const r=canvas.getBoundingClientRect(),m=BayeHdOverworld.debugSnapshot(),camera={...BayeHdOverworld.getCamera()};
        window.__r23BridgeOps.push({kind,at:performance.now(),frame:window.__r08Draws,hidden:document.hidden,
            mode:m.mode,phase:m.phase,ready:m.presentationReady,camera,rect:{left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom},
            canvas:{width:canvas.width,height:canvas.height},source:kind==='drawImage'?args[0].src:null,
            naturalSize:kind==='drawImage'?[args[0].naturalWidth,args[0].naturalHeight]:null,
            args:kind==='drawImage'?Array.from(args).slice(1):Array.from(args),fillStyle:String(ctx.fillStyle)});
    }catch(error){window.__r23BridgeErrors.push(String(error.stack||error));}};
    for(const kind of ['drawImage','arc']){const original=ctx[kind];ctx[kind]=function(){const result=original.apply(this,arguments);observe(kind,arguments);return result;};}
})()`;

function bridgeGeometry(op,edge){
    if(!op||op.hidden||op.mode!=='hd-map'||op.phase!=='map'||!op.ready)return false;
    const c=op.camera,r=op.rect;if(!c||!r||!(r.width>0&&r.height>0)||!(c.scale>0))return false;
    const center=[(edge.cx-c.x)*c.scale,(edge.cy-c.y)*c.scale],expected=op.kind==='drawImage'?[center[0]-16,center[1]-16,32,32]:[...center,7,0,Math.PI*2];
    if(op.args.length!==expected.length||op.args.some((v,i)=>!Number.isFinite(v)||Math.abs(v-expected[i])>1e-6))return false;
    if(op.kind==='drawImage'&&(op.naturalSize[0]!==1254||op.naturalSize[1]!==1254))return false;
    if(op.canvas.width!==1920||op.canvas.height!==1080)return false;
    const client={x:r.left+center[0]*r.width/1920,y:r.top+center[1]*r.height/1080};
    const size={width:32*r.width/1920,height:32*r.height/1080};
    if(client.x-size.width/2<r.left+12||client.x+size.width/2>r.right-12||client.y-size.height/2<r.top+12||client.y+size.height/2>r.bottom-12)return false;
    return {center,client,cssSize:size,designSize:[32,32],fallbackRadius:op.kind==='arc'?7:null};
}
function bridgeReadExpression(edge,minFrame){return `(() => {const canvas=document.getElementById('hd-overworld-canvas'),r=canvas.getBoundingClientRect(),camera={...BayeHdOverworld.getCamera()},m=BayeHdOverworld.debugSnapshot();
    if(document.hidden||m.mode!=='hd-map'||m.phase!=='map'||!m.presentationReady||!m.hitsEnabled)return false;
    for(let n=canvas;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<=0)return false;}
    const edge=${JSON.stringify(edge)},kind=${JSON.stringify(missingBridgeAsset?'arc':'drawImage')};
    for(let i=window.__r23BridgeOps.length-1;i>=0;i--){const op=window.__r23BridgeOps[i];if(op.frame<=${minFrame}||op.kind!==kind)continue;
        if(op.camera.x!==camera.x||op.camera.y!==camera.y||op.camera.scale!==camera.scale||Math.abs(op.rect.left-r.left)>.01||Math.abs(op.rect.top-r.top)>.01||Math.abs(op.rect.width-r.width)>.01||Math.abs(op.rect.height-r.height)>.01)continue;
        const geometry=(${bridgeGeometry.toString()})(op,edge);if(!geometry)continue;
        if(geometry.client.x<=0||geometry.client.y<=0||geometry.client.x>=innerWidth||geometry.client.y>=innerHeight)continue;
        const top=document.elementFromPoint(geometry.client.x,geometry.client.y);if(top!==canvas)continue;
        return {edge,op,geometry,viewport:{width:innerWidth,height:innerHeight},top:{id:top.id,tag:top.tagName}};
    }return false;})()`;}

async function positionBridge(cdp,edge,label){
    for(let i=0;i<28;i++){
        const p=await evaluate(cdp,`(() => {const c=BayeHdOverworld.getCamera(),n=document.getElementById('hd-overworld-canvas'),r=n.getBoundingClientRect(),e=${JSON.stringify(edge)};
            return {x:r.left+(e.cx-c.x)*c.scale*r.width/1920,y:r.top+(e.cy-c.y)*c.scale*r.height/1080,left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};})()`);
        const hit=await evaluate(cdp,`document.elementFromPoint(${p.x},${p.y})===document.getElementById('hd-overworld-canvas')`);
        if(hit&&p.x>p.left+65&&p.x<p.right-65&&p.y>p.top+100&&p.y<p.bottom-100)return p;
        const dx=p.left+p.width*.46-p.x,dy=p.top+p.height*.5-p.y;
        assert.ok(Math.abs(dx)>8||Math.abs(dy)>8,'bridge center can move to unobstructed canvas');await drag(cdp,dx,dy,label+'-'+i);
    }throw Error('Unable to position a naturally derived bridge');
}
function writeArtifact(name,bytes){
    assert.equal(path.basename(name),name,'artifact filename only');const filename=path.join(artifactDir,name);
    fs.writeFileSync(filename,bytes,{flag:'wx'});return {file:name,bytes:bytes.length,sha256:sha(bytes)};
}
async function bridgeScreenshot(cdp,name,sample){
    const full=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const fullFile=writeArtifact(name+'-full.png',Buffer.from(full.data,'base64'));
    const p=sample.geometry.client,s=sample.geometry.cssSize,pad=10;
    const clip={x:p.x-s.width/2-pad,y:p.y-s.height/2-pad,width:s.width+2*pad,height:s.height+2*pad,scale:1};
    assert.ok(clip.x>=0&&clip.y>=0&&clip.x+clip.width<=sample.viewport.width&&clip.y+clip.height<=sample.viewport.height,'actual ROI within viewport');
    const roi=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip});
    return {full:fullFile,roi:writeArtifact(name+'-roi.png',Buffer.from(roi.data,'base64')),clip,
        scope:'Actual viewport and CDP clip of naturally drawn decorative bridge; not an image-only preview'};
}
async function bridgeAcceptance(cdp,label){
    await mapReady(cdp);const before=await evaluate(cdp,bridgeWorldExpression),keys=await evaluate(cdp,'window.__r08Keys.length');
    const roads=await evaluate(cdp,'BayeHdOverworld.getRoads()');assert.equal(roads.source,'lcc-neighbors');
    const passes=roads.edges.filter(e=>e.pass===true);assert.ok(passes.length,'actual geographic graph naturally derives at least one pass');
    await evaluate(cdp,'window.__r23BridgeRecording=true');const samples=[];
    try{
        await scale(cdp,1);const c=await evaluate(cdp,'({...BayeHdOverworld.getCamera()})');
        const edge=passes.slice().sort((a,b)=>Math.hypot(a.cx-c.x-960,a.cy-c.y-540)-Math.hypot(b.cx-c.x-960,b.cy-c.y-540))[0];
        await positionBridge(cdp,edge,label+'-position');
        const capture=async suffix=>{const frame=await evaluate(cdp,'window.__r08Draws');
            const sample=await waitFor(cdp,'actual bridge '+label+' '+suffix,bridgeReadExpression(edge,frame));
            assert.ok(bridgeGeometry(sample.op,edge),'independent actual draw geometry');
            if(missingBridgeAsset){assert.equal(sample.op.kind,'arc');assert.equal(sample.op.fillStyle,'#d8c4a0');}
            else {assert.equal(new URL(sample.op.source).pathname,bridgePath);assert.deepEqual(sample.op.naturalSize,[1254,1254]);}
            const screenshots=await bridgeScreenshot(cdp,label+'-bridge-'+suffix,sample);samples.push({...sample,screenshots});return sample;};
        await capture('design32');
        // Trusted pan changes only presentation and must produce a fresh correctly placed bridge.
        await drag(cdp,80,45,label+'-bridge-pan');await positionBridge(cdp,edge,label+'-pan-position');await capture('panned');
        await scale(cdp,1.35);await positionBridge(cdp,edge,label+'-zoom-position');await capture('zoomed');
        await scale(cdp,1);await positionBridge(cdp,edge,label+'-restore-position');
        await chromeSmoke(cdp,label+'-bridge');await positionBridge(cdp,edge,label+'-after-hidden-position');await capture('restored');
        const after=await evaluate(cdp,bridgeWorldExpression);assert.deepEqual(after,before,'bridge presentation/classic/hidden/pan/zoom preserves full native world and owners');
        assert.equal(await evaluate(cdp,'window.__r08Keys.length'),keys,'bridge presentation has zero native keys');
        const errors=await evaluate(cdp,'window.__r23BridgeErrors');assert.deepEqual(errors,[],'observer preserves drawing without observer errors');
        report.bridgeChecks.push({label,missing:missingBridgeAsset,naturalPassCount:passes.length,edge,samples,before,after,keysBefore:keys,keysAfter:keys,
            operations:await evaluate(cdp,'window.__r23BridgeOps'),observerErrors:errors});
    }finally{await evaluate(cdp,'window.__r23BridgeRecording=false;window.__r23BridgeOps=[]');}
}
function verifyBridgeRequests(){
    if(!bridgeArt)return;
    const manifests=report.requests.filter(r=>r.path==='/assets/hd-overworld/manifest.json');assert.ok(manifests.length,'actual manifest HTTP request');
    for(const r of manifests){assert.equal(new URL(r.url,'http://localhost').searchParams.get('ver'),'20261010a');assert.equal(r.status,200);
        assert.equal(r.sha256,report.sources['assets/hd-overworld/manifest.json'].sha256);}
    const art=report.requests.filter(r=>r.path===bridgePath);assert.ok(art.length,'actual bridge PNG request');
    for(const r of art){assert.equal(r.status,missingBridgeAsset?404:200);if(!missingBridgeAsset)assert.equal(r.sha256,bridgeSha);}
    const unexpected=report.requests.filter(r=>r.status>=400&&!(missingBridgeAsset&&r.path===bridgePath));assert.deepEqual(unexpected,[],'no unexpected HTTP asset failures');
    assert.equal(report.bridgeChecks.length,2,'bridge checked in both actual viewports');
    report.bridgeRequests={manifests,art,expectedMissing404:missingBridgeAsset,queryRetained:true};
}
const childExited=child=>!child||child.exitCode!==null||child.signalCode!==null;
async function portListening(port){if(!port)return false;return new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});let done=false;
    const finish=value=>{if(done)return;done=true;socket.destroy();resolve(value);};socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.setTimeout(800,()=>finish(false));});}

async function startServer(){
    const server=http.createServer((req,res)=>{try{
        const pathname=new URL(req.url,'http://localhost').pathname,rel=decodeURIComponent(pathname).replace(/^\/+/, '')||'pc.html';
        const filename=path.resolve(root,rel);
        if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
        if(!snapshots.has(rel)&&fs.existsSync(filename)&&fs.statSync(filename).isFile())freeze(rel,filename);
        const item=snapshots.get(rel);
        if(missingBridgeAsset&&pathname===bridgePath){report.requests.push({path:pathname,url:req.url,status:404,intentionalMissingBridge:true});res.writeHead(404,{'Cache-Control':'no-store'}).end();return;}
        if(!item){report.requests.push({path:pathname,url:req.url,status:404});res.writeHead(404).end();return;}
        report.requests.push({path:pathname,url:req.url,status:200,...item.metadata});
        res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(item.bytes);
    }catch(error){report.serverErrors||=[];report.serverErrors.push(String(error));res.writeHead(400).end();}});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;
}
async function unusedPort(){const socket=net.createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});
    const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;}
async function connectCdp(url){
    const ws=new WebSocket(url),pending=new Map(),listeners=new Map();let sequence=0;
    const rejectAll=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('CDP closed'));}pending.clear();};
    ws.addEventListener('close',rejectAll);ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);
        if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);}
        else if(listeners.has(msg.method))listeners.get(msg.method)(msg.params);});
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(new Error('CDP connection failed')),{once:true});});
    return {on:(name,fn)=>listeners.set(name,fn),send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});},
    close(){rejectAll();ws.close();}};
}
async function evaluate(cdp,expression){const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function waitFor(cdp,label,expression,timeout=25000){const deadline=Date.now()+timeout;
    while(Date.now()<deadline){const value=await evaluate(cdp,expression);if(value)return value;await delay(100);}throw new Error('Timed out: '+label);}
const stateExpression=`(() => {const d=baye.data,m=BayeHdOverworld.debugSnapshot(),c=BayeHdCityMenu.debugSnapshot();return {
    hidden:document.hidden,identity:BayeHdLibIdentity.read(),period:Number(d.g_PIdx),king:Number(d.g_PlayerKing),rawCamera:{...BayeHdOverworld.getCamera()},
    cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},mapCity:Number(d.g_hdMapCity)-1,
    menu:baye.hd.menuItems(),march:baye.hd.march(),map:m,city:c,keys:window.__r08Keys.length,pointers:window.__r08Pointers.length,draws:window.__r08Draws,
    year:Number(d.g_YearDate),month:Number(d.g_MonthDate)}})()`;
const nativeExpression=`(() => {const d=baye.data;return {cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},
    mapCity:Number(d.g_hdMapCity)-1,menu:baye.hd.menuItems(),march:baye.hd.march(),year:Number(d.g_YearDate),month:Number(d.g_MonthDate),
    king:Number(d.g_PlayerKing),cities:Array.from({length:38},(_,i)=>Number(d.g_Cities[i].Belong))}})()`;
async function checkpoint(cdp,name,extra={}){const state=await evaluate(cdp,stateExpression);auditEnvironment(state,name);report.phases.push({...extra,name,state});
    const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,name+'.png'),Buffer.from(image.data,'base64'),{flag:'wx'});console.log('PASS',name);return state;}
async function key(cdp,name){const codes={Enter:13,Escape:27,ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39};
    assert.ok(codes[name]);for(const type of ['keyDown','keyUp'])await cdp.send('Input.dispatchKeyEvent',{type,key:name,code:name,windowsVirtualKeyCode:codes[name],nativeVirtualKeyCode:codes[name]});await delay(170);}
async function pointer(cdp,x,y){await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});await delay(160);}
async function button(cdp,selector){const point=await evaluate(cdp,`(() => {const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>{
        const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';});
        if(!n)return null;const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);
        return {x,y,hit:top===n||n.contains(top),top:top&&(top.id||top.tagName),width:r.width,height:r.height};})()`);
    assert.ok(point&&point.hit,'actual unobstructed button '+selector+': '+JSON.stringify(point));await pointer(cdp,point.x,point.y);return point;}
async function resize(cdp,width,height){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(180);}
async function mapReady(cdp){return waitFor(cdp,'current native map waiting and HD hits',`(() => {const m=BayeHdOverworld.debugSnapshot(),c=BayeHdCityMenu.debugSnapshot(),n=baye.hd.menuItems(),p=baye.hd.march();
    return m.presentationReady&&m.phase==='map'&&m.hitsEnabled&&!m.aligning&&!c.open&&!c.sending&&!c.queueLen&&!n.active&&p.pick===1&&!p.battlePick&&m;})()`);}
async function boot(cdp,origin,lordId=null){
    await cdp.send('Page.navigate',{url:origin+'/pc.html?acceptance=r08-'+report.sessions.length});
    await waitFor(cdp,'real LIB/WASM initialization','window.baye&&baye.hd&&baye.hd.ready()',60000);
    await evaluate(cdp,`(() => {window.__r08Keys=[];window.__r08Draws=0;window.__r08Visibility=[];window.__r08Pointers=[];
        document.addEventListener('pointerup',event=>window.__r08Pointers.push({trusted:event.isTrusted,target:event.target.id||event.target.tagName,
            x:event.clientX,y:event.clientY}),true);
        const original=window.sendKey;window.sendKey=function(code){window.__r08Keys.push({code,at:performance.now(),stack:new Error().stack});return original.apply(this,arguments);};
        const ctx=document.getElementById('hd-overworld-canvas').getContext('2d'),clear=ctx.clearRect;
        ctx.clearRect=function(){window.__r08Draws++;return clear.apply(this,arguments);};
        document.addEventListener('visibilitychange',()=>window.__r08Visibility.push({hidden:document.hidden,at:performance.now()}));
        window.__r08SpeSeen=[];const remember=()=>{const s=baye.hd.spe();if(s.id)window.__r08SpeSeen.push(s.id);};
        const originalSpe=BayeHdSpe.onEngineSpe;BayeHdSpe.onEngineSpe=function(){remember();return originalSpe.apply(this,arguments);};remember();})()`);
    if(bridgeArt)await evaluate(cdp,bridgeObserverSource);
    for(let i=0;i<25;i++){if(await evaluate(cdp,'window.__r08SpeSeen.includes(100)'))break;
        if(await evaluate(cdp,'baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)'))await key(cdp,'Enter');else await delay(130);}
    await waitFor(cdp,'actual title','window.__r08SpeSeen.includes(100)');await key(cdp,'Enter');
    await waitFor(cdp,'actual period menu','window.__r08SpeSeen.includes(104)');await key(cdp,'Enter');
    await waitFor(cdp,'actual period1 king menu','Number(baye.data.g_PIdx)===1&&baye.hd.kings().count>0');
    const kings=await evaluate(cdp,'baye.hd.kings()');
    const target=lordId==null?kings.kings.findIndex(p=>p.name==='曹操'):kings.kings.findIndex(p=>p.id===lordId);
    assert.ok(target>=0,'requested actual selectable lord '+lordId);
    for(let i=kings.index;i<target;i++){await key(cdp,'ArrowDown');await waitFor(cdp,'lord down receipt',`baye.hd.kings().index===${i+1}`);}
    for(let i=kings.index;i>target;i--){await key(cdp,'ArrowUp');await waitFor(cdp,'lord up receipt',`baye.hd.kings().index===${i-1}`);}
    await key(cdp,'Enter');await waitFor(cdp,'actual PlayerTactic map','baye.hd.march().pick===1&&baye.hd.realm().ownedCount>0');
    await button(cdp,'[data-hd-overworld="hd-map"]');
    // This is a presentation preference only; native input must remain idle.
    await evaluate(cdp,"BayeHdCityMenu.setMode('hd')");await mapReady(cdp);
    const layout=await evaluate(cdp,`({identity:BayeHdLibIdentity.read(),realm:baye.hd.realm(),kings:${JSON.stringify(kings.kings)},
        native:Array.from({length:38},(_,index)=>({index,name:baye.getCityName(index),belong:Number(baye.data.g_Cities[index].Belong),
            engX:Number(baye.data.g_CityPositions[index].x),engY:Number(baye.data.g_CityPositions[index].y)})),roads:BayeHdOverworld.getRoads(),
        cities:BayeHdOverworld.getCities().map(c=>({index:c.index,name:c.name,engX:c.engX,engY:c.engY,hdX:c.hdX,hdY:c.hdY,kind:c.kind,belong:c.belong}))})`);
    assert.equal(layout.identity.status,'ready');assert.equal(layout.identity.sha256,standardSha);assert.equal(layout.cities.length,38);
    for(const row of layout.cities){const geo=report.geo.cities.find(c=>c.i===row.index),native=layout.native[row.index];assert.ok(geo);
        for(const field of ['name','engX','engY']){assert.equal(row[field],native[field],'actual native/map '+row.index+' '+field);assert.equal(row[field],geo[field],'native/geo '+row.index+' '+field);}
        assert.equal(row.belong,native.belong);assert.equal(row.kind,native.belong===layout.realm.playerBelong?'owned':native.belong===0?'empty':'neutral');}
    const pairs=[];for(let a=0;a<38;a++)for(let b=a+1;b<38;b++){
        const p=layout.native[a],q=layout.native[b];if(Math.max(Math.abs(p.engX-q.engX),Math.abs(p.engY-q.engY))<=1)pairs.push(a+'-'+b);}
    // LCC decorative roads are geographic neighbours, not native movement
    // or tile adjacency. Record both without turning art into reachability.
    layout.nativeTileAdjacency=pairs.sort();const roadPairs=new Set();
    for(const edge of layout.roads.edges){assert.ok(Number.isInteger(edge.a)&&Number.isInteger(edge.b)&&edge.a>=0&&edge.b<38&&edge.a<edge.b);
        const pair=edge.a+'-'+edge.b;assert.ok(!roadPairs.has(pair),'no duplicate decorative road');roadPairs.add(pair);
        const a=layout.cities[edge.a],b=layout.cities[edge.b];assert.deepEqual([edge.ax,edge.ay,edge.bx,edge.by],[a.hdX,a.hdY,b.hdX,b.hdY],'road endpoints use authenticated city geometry');}
    assert.equal(layout.roads.source,'lcc-neighbors');
    report.sessions.push({lord:kings.kings[target],identity:layout.identity,realm:layout.realm,cities:layout.cities,roads:layout.roads,nativeTileAdjacency:layout.nativeTileAdjacency});return layout;
}
async function canvasGeometry(cdp){return evaluate(cdp,`(() => {const n=document.getElementById('hd-overworld-canvas'),r=n.getBoundingClientRect();return {
    left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom,camera:BayeHdOverworld.debugSnapshot().camera};})()`);}
async function drag(cdp,dx,dy,label){const g=await canvasGeometry(cdp),x=g.left+g.width*.48,y=g.top+g.height*.5;
    dx=Math.max(-g.width*.32,Math.min(g.width*.32,dx));dy=Math.max(-g.height*.3,Math.min(g.height*.3,dy));
    const before=await evaluate(cdp,nativeExpression),keys=await evaluate(cdp,'window.__r08Keys.length');
    assert.equal(await evaluate(cdp,`document.elementFromPoint(${x},${y})===document.getElementById('hd-overworld-canvas')`),true,'drag starts on real canvas');
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/8,y:y+dy*i/8,button:'left',buttons:1});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',buttons:0,clickCount:1});await delay(110);
    assert.equal(await evaluate(cdp,'window.__r08Keys.length'),keys,'drag/release sends no native input');
    assert.deepEqual(await evaluate(cdp,nativeExpression),before,'drag/release preserves native cursor/menu/date/ownership');
    const after=await canvasGeometry(cdp);assert.ok(after.camera.x>=after.camera.minX-.01&&after.camera.x<=after.camera.maxX+.01&&after.camera.y>=after.camera.minY-.01&&after.camera.y<=after.camera.maxY+.01,'camera remains within native-independent visual bounds');
    report.actions.push({type:'trusted-pointer-drag',label,dx,dy,before:g.camera,after:after.camera,keys:0});return after;
}
async function placeCity(cdp,index){for(let i=0;i<24;i++){
    const point=await evaluate(cdp,`BayeHdOverworld.cityScreenPos(${index})`),g=await canvasGeometry(cdp);
    assert.ok(point,'read-only city screen position '+index);
    const safe=point.clientX>g.left+80&&point.clientX<g.right-80&&point.clientY>g.top+95&&point.clientY<g.bottom-95;
    const hit=await evaluate(cdp,`document.elementFromPoint(${point.clientX},${point.clientY})===document.getElementById('hd-overworld-canvas')`);
    if(safe&&hit)return point;
    const dx=g.left+g.width*.46-point.clientX,dy=g.top+g.height*.5-point.clientY;
    assert.ok(Math.abs(dx)>8||Math.abs(dy)>8,'city is not blocked at intended safe center');await drag(cdp,dx,dy,'position-city-'+index);
}throw new Error('Unable to place city on unobstructed canvas '+index);}
async function visit(cdp,city,label){await mapReady(cdp);const point=await placeCity(cdp,city.index);
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.clientX,y:point.clientY});
    await waitFor(cdp,'actual hover index '+city.index,`BayeHdOverworld.debugSnapshot().hoverIndex===${city.index}`);
    const before=await evaluate(cdp,stateExpression),nativeBefore=await evaluate(cdp,nativeExpression);
    await pointer(cdp,point.clientX,point.clientY);
    let after,returned=null;
    if(city.kind==='owned'){
        await waitFor(cdp,'native exact city root '+city.index,`(() => {const d=baye.data,n=baye.hd.menuItems(),c=BayeHdCityMenu.debugSnapshot();return (
            n.active===1&&n.context===1&&n.kind===1&&c.open&&c.layer==='root'&&c.cityIndex===${city.index}&&
            Number(d.g_hdMapCity)-1===${city.index}&&Number(d.g_CityPos.setx)===${city.engX}&&Number(d.g_CityPos.sety)===${city.engY});})()`);
        after=await evaluate(cdp,stateExpression);assert.equal(after.city.cityName,city.name);assert.equal(after.menu.names[0],'内政');
        assert.ok(after.keys>before.keys,'actual owned city click emits native alignment/Enter');
        const enterCode=await evaluate(cdp,'baye.VK_ENTER'),entry=await evaluate(cdp,`window.__r08Keys.slice(${before.keys},${after.keys})`);
        assert.equal(entry.filter(k=>k.code===enterCode).length,1,'city pointer enters the actual root once');
        await checkpoint(cdp,label+'-root',{city:city.index,name:city.name,point});
        const beforeReturn=await evaluate(cdp,'window.__r08Keys.length');
        await button(cdp,'#hd-city-menu [data-hd-menu-back]');await mapReady(cdp);returned=await evaluate(cdp,stateExpression);
        const exitCode=await evaluate(cdp,'baye.VK_EXIT'),exit=await evaluate(cdp,`window.__r08Keys.slice(${beforeReturn})`);
        assert.deepEqual(exit.map(k=>k.code),[exitCode],'one actual back button sends exactly one native EXIT');
        assert.notEqual(returned.march.mapInputSeq,before.march.mapInputSeq,'return creates a new actual GetCitySet wait');
        assert.equal(returned.map.mapCity,city.index);assert.equal(returned.city.queueLen,0);assert.equal(returned.city.sending,false);
    }else{
        await waitFor(cdp,'actual non-owned selection '+city.index,`BayeHdOverworld.debugSnapshot().selectedIndex===${city.index}`);
        after=await evaluate(cdp,stateExpression);assert.equal(after.keys,before.keys,'non-owned selection has zero engine keys');
        assert.deepEqual(await evaluate(cdp,nativeExpression),nativeBefore,'non-owned selection never changes native cursor/menu/date/ownership');
        assert.ok(after.map.hint.includes(city.name)&&after.map.hint.includes('不是己方城'),'actual ownership guard explains native rule');
        assert.equal(after.city.open,false);await checkpoint(cdp,label+'-selected',{city:city.index,name:city.name,point});
    }
    const trace=await evaluate(cdp,`window.__r08Keys.slice(${before.keys})`);
    const pointerEvents=await evaluate(cdp,`window.__r08Pointers.slice(${before.pointers})`);
    assert.ok(pointerEvents.length&&pointerEvents[0].trusted&&pointerEvents[0].target==='hd-overworld-canvas','city tap is a trusted canvas pointer release');
    report.cities.push({label,lord:before.king,index:city.index,name:city.name,kind:city.kind,belong:city.belong,point,
        before:{cursor:before.cursor,mapCity:before.mapCity,mapInputSeq:before.march.mapInputSeq},
        after:{cursor:after.cursor,mapCity:after.mapCity,menu:after.menu},returned:returned&&{cursor:returned.cursor,mapCity:returned.mapCity,mapInputSeq:returned.march.mapInputSeq},trace,pointerEvents});
}
async function boundary(cdp,xSide,ySide,label){for(let i=0;i<25;i++){
    const g=await canvasGeometry(cdp),c=g.camera,x=xSide==='min'?c.minX:c.maxX,y=ySide==='min'?c.minY:c.maxY;
    if(Math.abs(c.x-x)<.02&&Math.abs(c.y-y)<.02){await checkpoint(cdp,label);return c;}
    const beyondThreshold=value=>Math.abs(value)<.001?0:Math.sign(value)*Math.max(24,Math.abs(value));
    await drag(cdp,beyondThreshold((c.x-x)*c.scale*g.width/1920),beyondThreshold((c.y-y)*c.scale*g.height/1080),label);
}throw new Error('Camera did not reach '+label);}
async function scale(cdp,value){const before=await evaluate(cdp,nativeExpression),keys=await evaluate(cdp,'window.__r08Keys.length');
    const camera=await evaluate(cdp,`BayeHdOverworld.setScale(${value});BayeHdOverworld.debugSnapshot().camera`);await delay(100);
    assert.equal(camera.scale,value,'requested documented visual zoom');assert.equal(await evaluate(cdp,'window.__r08Keys.length'),keys);
    assert.deepEqual(await evaluate(cdp,nativeExpression),before);report.actions.push({type:'presentation-scale-api',value,camera,keys:0});return camera;}
async function chromeSmoke(cdp,label){const before=await evaluate(cdp,nativeExpression),keys=await evaluate(cdp,'window.__r08Keys.length');
    await button(cdp,'[data-hd-overworld="classic"]');
    const classic=await evaluate(cdp,`(() => {const n=document.getElementById('lcd'),c=document.getElementById('hd-overworld'),s=getComputedStyle(n),m=getComputedStyle(c);return {lcd:s.display!=='none'&&s.visibility!=='hidden',map:m.display==='none',mode:BayeHdOverworld.getMode()};})()`);
    assert.deepEqual(classic,{lcd:true,map:true,mode:'classic'});await button(cdp,'[data-hd-overworld="hd-map"]');await mapReady(cdp);
    assert.equal(await evaluate(cdp,'window.__r08Keys.length'),keys);assert.deepEqual(await evaluate(cdp,nativeExpression),before);
    const tab=await cdp.send('Target.createTarget',{url:'about:blank'});let hidden;
    try{await cdp.send('Target.activateTarget',{targetId:tab.targetId});await waitFor(cdp,'actual background visibility','document.hidden===true');
        const start=await evaluate(cdp,'({draws:window.__r08Draws,keys:window.__r08Keys.length})');await delay(450);
        hidden=await evaluate(cdp,'({draws:window.__r08Draws,keys:window.__r08Keys.length,hidden:document.hidden})');
        assert.equal(hidden.keys,start.keys);assert.equal(hidden.draws,start.draws,'hidden map renderer sleeps');
        await cdp.send('Page.bringToFront');await waitFor(cdp,'actual foreground visibility','document.hidden===false');
        await waitFor(cdp,'foreground drawing resumes',`window.__r08Draws>${hidden.draws}`);await mapReady(cdp);
    }finally{await cdp.send('Page.bringToFront');await cdp.send('Target.closeTarget',{targetId:tab.targetId});}
    assert.equal(await evaluate(cdp,'window.__r08Keys.length'),keys);assert.deepEqual(await evaluate(cdp,nativeExpression),before);
    report.actions.push({type:'classic-HD-and-real-tab-visibility',label,classic,hidden,visibility:await evaluate(cdp,'window.__r08Visibility'),keys:0});await checkpoint(cdp,label+'-restored');
}
async function cameras(cdp){await scale(cdp,1);
    for(const [x,y] of [['min','min'],['max','min'],['max','max'],['min','max']])await boundary(cdp,x,y,'camera-'+x+'-'+y);
    await scale(cdp,.5);const south=await boundary(cdp,'max','max','camera-05-south-and-ocean-pad');
    assert.equal(south.mapW,3840);assert.equal(south.mapH,4000);assert.ok(south.y+1080/south.scale>=4000-.1,'southern ocean pad reaches full map bottom');
    report.southCoverage={camera:south,sourceRasterHeight:report.geo.fit.rasterSize[1],oceanPadPixels:4000-report.geo.fit.rasterSize[1],
        evidence:'actual southern viewport screenshot; 0.5 zoom spans full 3840-pixel map width'};
    // These are source-image review ROIs supplied by the asset owner, not
    // precise geographical measurements or any claim about island ownership.
    const rois=[{id:'hainan-source-review',rect:[2370,3010,220,210]},{id:'southern-ocean-pad',rect:[2760,3710,340,240]}];
    for(const roi of rois){const [x,y,w,h]=roi.rect;assert.ok(x>=south.x&&y>=south.y&&x+w<=south.x+1920/south.scale&&y+h<=south.y+1080/south.scale,'actual south viewport covers '+roi.id);}
    const pixels=await evaluate(cdp,`(() => {const overview=BayeHdOverworld.overviewData();if(!overview)return null;
        return ${JSON.stringify(rois)}.map(roi=>{const c=document.createElement('canvas');c.width=roi.rect[2];c.height=roi.rect[3];
            const ctx=c.getContext('2d');ctx.drawImage(overview.image,...roi.rect,0,0,c.width,c.height);const p=ctx.getImageData(0,0,c.width,c.height).data;
            const min=[255,255,255],max=[0,0,0],sum=[0,0,0];let opaque=0;
            for(let i=0;i<p.length;i+=4){if(p[i+3]===255)opaque++;for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[i+j]);max[j]=Math.max(max[j],p[i+j]);sum[j]+=p[i+j];}}
            return {id:roi.id,rect:roi.rect,opaque,pixels:c.width*c.height,min,max,mean:sum.map(v=>v/(c.width*c.height)),
                source:overview.image.src,naturalWidth:overview.image.naturalWidth,naturalHeight:overview.image.naturalHeight};});})()`);
    assert.ok(pixels);for(const roi of pixels){assert.equal(roi.naturalWidth,3840);assert.equal(roi.naturalHeight,4000);assert.equal(roi.opaque,roi.pixels);}
    assert.ok(pixels[0].max.some((v,i)=>v-pixels[0].min[i]>20),'Hainan source-review ROI contains visible source detail');
    report.southCoverage.sourceImageRois=pixels;
    await scale(cdp,2.2);await boundary(cdp,'max','min','camera-22-east');await scale(cdp,1);
}
function auditEnvironment(state,label){
    const description=report.mapManifest.layers.environment;
    if(!description){report.environment={available:false,reason:'baseline manifest has no environment descriptors'};return;}
    if(state.map.mode!=='hd-map'||state.map.phase!=='map'||state.hidden)return;
    const layers=Array.isArray(description)?description:description.layers;
    assert.ok(Array.isArray(layers)&&layers.length,'frozen environment descriptor list');
    const actual=state.map.environmentLayers;assert.ok(actual,'readonly actual environment operations');
    assert.equal(description.coordinateSystem,'china-lcc-raster-padded-v1');assert.equal(actual.coordinateSystem,description.coordinateSystem);
    assert.deepEqual(description.mapSize,[3840,4000]);assert.deepEqual(description.rasterSize,[3840,3309]);
    // debugSnapshot's compact camera rounds to 3 decimals; use the public
    // read-only raw camera copy when comparing exact native canvas calls.
    const c=state.rawCamera,viewport=[c.x,c.y,1920/c.scale,1080/c.scale],expected=[];
    const intersect=(a,b)=>{const x=Math.max(a[0],b[0]),y=Math.max(a[1],b[1]),w=Math.min(a[0]+a[2],b[0]+b[2])-x,h=Math.min(a[1]+a[3],b[1]+b[3])-y;
        return w>0&&h>0?[x,y,w,h]:null;};
    for(const layer of layers){if(layer.draw!==true)continue;
        const header=report.pngHeaders['assets/hd-overworld/'+layer.path];assert.ok(header,'actual frozen PNG '+layer.path);
        assert.deepEqual([header.width,header.height],layer.pixelSize,'declared pixel size matches PNG '+layer.id);
        assert.ok(header.alpha.decoded&&header.alpha.visibleFraction>0,'enabled layer contains actual visible pixels '+layer.id);
        const instances=layer.kind==='stamps'?layer.instances.map((instance,index)=>({rect:instance.rect,index})):[{rect:layer.worldRect}];
        for(const instance of instances){const within=intersect(instance.rect,layer.worldRect),visible=within&&intersect(within,viewport);if(!visible)continue;
            expected.push({id:layer.id,path:layer.path,instanceIndex:instance.index,
                source:[(visible[0]-instance.rect[0])/instance.rect[2]*header.width,(visible[1]-instance.rect[1])/instance.rect[3]*header.height,
                    visible[2]/instance.rect[2]*header.width,visible[3]/instance.rect[3]*header.height],
                destination:[(visible[0]-viewport[0])*c.scale,(visible[1]-viewport[1])*c.scale,visible[2]*c.scale,visible[3]*c.scale]});}
    }
    assert.equal(actual.descriptorCount,layers.length,'actual descriptor count');assert.equal(actual.drawn,expected.length,'visible layers drawn '+label);
    assert.equal(actual.operations.length,expected.length,'actual operations count '+label);
    for(let i=0;i<expected.length;i++){const a=actual.operations[i],e=expected[i];assert.equal(a.id,e.id);assert.equal(a.path,e.path);assert.equal(a.instanceIndex,e.instanceIndex);
        for(const field of ['source','destination']){assert.equal(a[field].length,4);for(let k=0;k<4;k++)assert.ok(Math.abs(a[field][k]-e[field][k])<.00001,'actual image clip/scale '+label+' '+e.id+' '+field+k);}}
    report.environment||={available:true,seen:[],samples:[]};report.environment.available=true;
    for(const e of expected)if(!report.environment.seen.includes(e.id))report.environment.seen.push(e.id);
    report.environment.samples.push({label,camera:c,coordinateSystem:actual.coordinateSystem,drawn:actual.drawn,skipped:actual.skipped,ids:expected.map(e=>e.id)});
}
async function acceptance(cdp,origin){const initial=await boot(cdp,origin,probeLordId==null?null:Number(probeLordId));await checkpoint(cdp,'01-standard-native-map');
    if(probeLordId!=null){for(const city of initial.cities.filter(c=>c.kind==='owned'))await visit(cdp,city,'probe-lord-'+probeLordId+'-city-'+city.index);
        report.coverage={probeOnly:true,ownedRoots:report.cities.length};return;}
    if(bridgeOnly){for(const [width,height] of [[1920,1080],[1280,720]]){await resize(cdp,width,height);await mapReady(cdp);await bridgeAcceptance(cdp,width+'x'+height);}
        verifyBridgeRequests();report.coverage={bridgeOnly:true,pointerCities1080:0,pointerCities720:0,bridgeViewports:2,
            actualTabHiding:true,classicReturn:true,trustedPan:true,presentationZoom:[1,1.35],full38CityTraversal:false};return;}
    const cities=initial.cities,unowned=cities.filter(c=>c.belong===0),owners=[...new Set(cities.filter(c=>c.belong>0).map(c=>c.belong-1))];
    assert.equal(unowned.length,13,'actual period1 unowned count');assert.equal(cities.length-unowned.length,25,'actual period1 owned count');
    report.expected={total:38,unowned:unowned.map(c=>({index:c.index,name:c.name})),owned:25,ownerIds:owners};
    for(const [width,height] of [[1920,1080],[1280,720]]){await resize(cdp,width,height);await mapReady(cdp);
        if(bridgeArt)await bridgeAcceptance(cdp,width+'x'+height);
        if(width===1920)await cameras(cdp);await chromeSmoke(cdp,width+'x'+height);
        for(const city of cities)await visit(cdp,city,width+'x'+height+'-city-'+String(city.index).padStart(2,'0'));
    }
    verifyBridgeRequests();
    if(allLords){const covered=new Set(report.cities.filter(c=>c.kind==='owned').map(c=>c.index));
        for(const id of owners){if(id===initial.realm.playerKing)continue;await resize(cdp,1920,1080);const layout=await boot(cdp,origin,id);
            for(const city of layout.cities.filter(c=>c.kind==='owned')){await visit(cdp,city,'lord-'+id+'-city-'+String(city.index).padStart(2,'0'));covered.add(city.index);}}
        assert.equal(covered.size,25,'legitimate lord selection covers all period1 owned roots');report.allLordRootIndices=[...covered].sort((a,b)=>a-b);
    }
    report.coverage={pointerCities1080:report.cities.filter(c=>c.label.startsWith('1920x1080')).length,
        pointerCities720:report.cities.filter(c=>c.label.startsWith('1280x720')).length,
        distinctOwnedRoots:new Set(report.cities.filter(c=>c.kind==='owned').map(c=>c.index)).size,
        nonOwnedSelections:report.cities.filter(c=>c.kind!=='owned').length,actualTabHiding:true,cameraBounds:true,zoom:[.5,2.2]};
    assert.equal(report.coverage.pointerCities1080,38);assert.equal(report.coverage.pointerCities720,38);
    if(report.mapManifest.layers.environment){const description=report.mapManifest.layers.environment,layers=Array.isArray(description)?description:description.layers;
        for(const layer of layers.filter(l=>l.draw===true))assert.ok(report.environment.seen.includes(layer.id),'enabled environment layer observed in actual render '+layer.id);}
}
async function main(){
    const buildRoot=path.resolve(root,'build');assert.ok(artifactDir.startsWith(buildRoot+path.sep),'artifacts must be a new directory within repository build/');
    assert.ok(!fs.existsSync(artifactDir),'Refusing existing artifact directory: '+artifactDir);fs.mkdirSync(artifactDir,{recursive:false});
    assert.equal(typeof WebSocket,'function','Node22+ built-in WebSocket');prepareAssets();
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-overworld-runtime-'));let server,chrome,cdp,chromeError;
    report.isolation={profile,httpPort:null,debugPort:null,chromePid:null,userServicePort:8080,scope:'Only the server, Chrome child and fresh profile created by this runner are owned'};
    const interrupt=()=>{report.interrupted=true;if(cdp)cdp.close();if(chrome&&!childExited(chrome))chrome.kill('SIGTERM');if(server)server.closeAllConnections();};
    process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{server=await startServer();const origin='http://127.0.0.1:'+server.address().port,debugPort=await unusedPort();report.origin=origin;
        Object.assign(report.isolation,{httpPort:server.address().port,debugPort});
        assert.notEqual(debugPort,8080);assert.notEqual(debugPort,server.address().port);
        assert.notEqual(server.address().port,8080);const candidates=['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome'];
        const binary=process.env.CHROME||candidates.find(f=>fs.existsSync(f));assert.ok(binary,'Set CHROME to Chrome/Chromium');
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking',
            '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
            '--window-size=1920,1080','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
        report.isolation.chromePid=chrome.pid??null;chrome.on('error',error=>{chromeError=error;});let target;const deadline=Date.now()+15000;
        while(Date.now()<deadline){if(chromeError)throw chromeError;if(childExited(chrome))throw new Error('Chrome exited '+chrome.exitCode+'/'+chrome.signalCode);
            try{target=(await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json())).find(t=>t.type==='page');if(target)break;}catch{}await delay(100);}
        assert.ok(target,'isolated CDP target');cdp=await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));
        cdp.on('Runtime.consoleAPICalled',e=>{report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')});if(report.console.length>150)report.console.shift();});
        cdp.on('Page.javascriptDialogOpening',e=>{report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});
        cdp.on('Fetch.requestPaused',e=>{const local=new URL(e.request.url).origin===origin;if(!local)report.blocked.push(e.request.url);
            cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});await resize(cdp,1920,1080);
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('baye/libpath','libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode','classic');localStorage.setItem('baye/systemUiMode','classic');localStorage.setItem('baye/cityMenuMode','classic');`});
        await acceptance(cdp,origin);assert.deepEqual(report.exceptions,[],'zero uncaught browser exceptions');assert.deepEqual(report.dialogs,[],'no unexpected native dialogs');report.ok=true;
    }catch(error){report.ok=false;report.error=error.stack||String(error);process.exitCode=1;console.error(report.error);
        if(cdp){try{report.failureState=await evaluate(cdp,stateExpression);report.failureKeys=await evaluate(cdp,'window.__r08Keys');if(bridgeArt)report.failureBridgeObserved=await evaluate(cdp,'({operations:window.__r23BridgeOps,errors:window.__r23BridgeErrors})');}catch{}try{const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(image.data,'base64'),{flag:'wx'});}catch{}}
    }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);if(cdp)cdp.close();
        if(chrome&&!childExited(chrome)){const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([stopped,delay(2000)]);
            if(!childExited(chrome)){chrome.kill('SIGKILL');await Promise.race([stopped,delay(2000)]);}}
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        const resolved=path.resolve(profile);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('baye-overworld-runtime-'));
        let profileError=null;if(childExited(chrome)){try{fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(error){profileError=String(error);}}else profileError='Chrome child has not terminated; profile retained';
        Object.assign(report.isolation,{chromeExitCode:chrome?.exitCode??null,chromeSignalCode:chrome?.signalCode??null,chromeExited:childExited(chrome),
            serverClosed:!server||!server.listening,profileRemoved:!fs.existsSync(resolved),profileError,
            httpPortClosed:!await portListening(report.isolation.httpPort),debugPortClosed:!await portListening(report.isolation.debugPort)});
        report.isolation.cleaned=report.isolation.chromeExited&&report.isolation.serverClosed&&report.isolation.profileRemoved&&report.isolation.httpPortClosed&&report.isolation.debugPortClosed;
        if(!report.isolation.cleaned){report.ok=false;process.exitCode=1;report.error||='Private cleanup did not complete; see isolation';}
        writeArtifact('isolation.json',Buffer.from(JSON.stringify(report.isolation,null,2)+'\n'));report.finishedAt=new Date().toISOString();
        report.sourceDrift=[];const verification={};
        for(const [rel,item] of snapshots){const filename=path.join(root,item.metadata.source),exists=fs.existsSync(filename),current=exists?sha(fs.readFileSync(filename)):null;
            verification[rel]={...item.metadata,currentSha256:current,match:current===item.metadata.sha256};
            if(current!==item.metadata.sha256)report.sourceDrift.push({path:rel,reason:exists?'changed':'missing',expected:item.metadata.sha256,actual:current});}
        const runnerPath=fileURLToPath(import.meta.url),runnerCurrent=fs.existsSync(runnerPath)?sha(fs.readFileSync(runnerPath)):null;
        verification.runner={...report.runner,currentSha256:runnerCurrent,match:runnerCurrent===report.runner.sha256};
        if(runnerCurrent!==report.runner.sha256)report.sourceDrift.push({path:path.relative(root,runnerPath),reason:runnerCurrent?'changed':'missing',expected:report.runner.sha256,actual:runnerCurrent});
        fs.writeFileSync(path.join(artifactDir,'source-verification.json'),JSON.stringify(verification,null,2)+'\n',{flag:'wx'});
        if(report.sourceDrift.length){report.ok=false;process.exitCode=1;report.error||='Source freeze changed during acceptance; see sourceDrift';}
        fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log('Artifacts:',artifactDir);if(report.ok)console.log('Real overworld acceptance passed',report.coverage);
    }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
