#!/usr/bin/env node
/**
 * Actual title-menu MAKER6 acceptance. Private HTTP/CDP/profile; no engine writes,
 * no getter replacements, no direct movie/about calls. --staged is optional.
 * --allow-lcd records the installed pre-MAKER contract as a native baseline;
 * it never accepts HD. Default mode requires genuine full-resource MAKER art.
 * Native timer coalescing and the 5000-tick hold remain unchanged.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argument=flag=>{const i=process.argv.indexOf(flag);if(i<0)return null;const v=process.argv[i+1];assert.ok(v&&!v.startsWith('--'));return v;};
const artifactDir=path.resolve(argument('--artifact-dir')||path.join(root,'build/r08-maker-runtime'));
const staged=process.argv.includes('--staged');
const allowLcd=process.argv.includes('--allow-lcd');
const standardSha='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const snapshots=new Map(),missing=new Set(),pendingResponses=[];
const productionDirectories=['js','css','assets'];
let delayedPaths=new Set(),native,nativePixels=[],makerEntry=null;
const report={startedAt:new Date().toISOString(),staged,allowLcd,hdAccepted:false,
    scope:'Actual MAKER6 rolling playback, complete/skip, native post-movie hold, and title return through genuine menu input',
    sources:{},requests:[],sessions:[],phases:[],exceptions:[],console:[],dialogs:[],blocked:[]};
const engines=['baye.js','baye.wasm','baye.wasm.map','baye.build.json'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
    '.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml',
    '.lib':'application/octet-stream','.woff2':'font/woff2'};
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const filename=path.join(directory,entry.name);return entry.isDirectory()?walk(filename):[filename];});}
function freeze(rel,filename=path.join(root,rel)){
    const bytes=fs.readFileSync(filename),metadata={source:path.relative(root,filename).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)};
    snapshots.set(rel,{bytes,metadata});report.sources[rel]=metadata;
}
function fnv(bytes){let h=0x811c9dc5;for(const b of bytes)h=Math.imul(h^b,0x01000193)>>>0;
    return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+bytes.length;}
function resource(lib,id,index){const table=(id-1)*4;assert.ok(table+4<=lib.length);const offset=lib.readUInt32LE(table);
    assert.ok(offset+14<=lib.length,'actual RCHEAD exists');const count=lib.readUInt16LE(offset+6),fixed=lib.readUInt32LE(offset+8);
    assert.equal(lib.readUInt16LE(offset+4),id);assert.ok(index>=0&&index<count);
    let begin,length;if(fixed){begin=offset+14+fixed*index;length=fixed;}else{
        const row=offset+14+index*8;assert.ok(row+8<=lib.length);begin=offset+lib.readUInt32LE(row);length=lib.readUInt32LE(row+4);}
    assert.ok(length>0&&begin>=offset+14&&begin+length<=lib.length,'resource payload stays in actual LIB');return lib.subarray(begin,begin+length);}
function decodeMaker(lib){const bytes=resource(lib,6,0),count=bytes[2],picmax=bytes[3],start=bytes[4],end=bytes[5];
    assert.equal(count,96);assert.equal(picmax,1);assert.equal(start,0);assert.equal(end,95);
    const units=Array.from({length:count},(_,frame)=>{const o=6+frame*5;return {frame,x:bytes[o],y:bytes[o+1],cdelay:bytes[o+2],ndelay:bytes[o+3],picIndex:bytes[o+4]};});
    for(const u of units)assert.deepEqual([u.x,u.y,u.cdelay,u.ndelay,u.picIndex],[0,95-u.frame,10,10,0]);
    let offset=6+count*5;const pictures=[];
    for(let picIndex=0;picIndex<picmax;picIndex++){const width=bytes.readUInt16LE(offset),height=bytes.readUInt16LE(offset+2),mask=bytes[offset+6],stride=Math.ceil(width/8),size=stride*height*(mask+1),begin=offset+7;
        assert.ok(begin+size<=bytes.length);pictures.push({picIndex,width,height,mask,stride,payloadOffset:offset,bytes:size,data:bytes.subarray(begin,begin+size)});offset=begin+size;}
    assert.equal(offset,bytes.length);assert.deepEqual(pictures.map(p=>[p.width,p.height,p.mask]),[[159,96,0]]);
    return {speId:6,resourceIndex:0,kind:1,count,picmax,startFrm:start,endFrm:end,resourceLength:bytes.length,resourceFingerprint:fnv(bytes),units,pictures};}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function png(width,height,rgba){const chunk=(name,data)=>{const tag=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);tag.copy(out,4);data.copy(out,8);
    out.writeUInt32BE(crc32(Buffer.concat([tag,data])),8+data.length);return out;};
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
    const rows=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)rgba.copy(rows,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
    return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
function nativePicture(p){const rgba=Buffer.alloc(p.width*p.height*4),plane=p.stride*p.height;
    for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const bit=0x80>>(x&7),at=y*p.stride+(x>>3),o=(y*p.width+x)*4;
        const black=(p.data[at+(p.mask?plane:0)]&bit)!==0;rgba[o]=rgba[o+1]=rgba[o+2]=black?0:255;
        // Native masked composition is (destination & firstPlane) | secondPlane.
        // Only AND=1 / OR=0 retains the destination. OR=1 paints black;
        // AND=0 / OR=0 paints opaque white.
        rgba[o+3]=p.mask&&(p.data[at]&bit)&&!black?0:255;}
    return png(p.width,p.height,rgba);}
function inspectPng(bytes,withPixels=false){assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],color=bytes[25];
    assert.equal(depth,8);assert.ok(color===2||color===6,'MAIN art is RGB/RGBA PNG');assert.equal(bytes[28],0,'non-interlaced actual PNG');
    const compressed=[];for(let p=8;p<bytes.length;){const n=bytes.readUInt32BE(p),tag=bytes.toString('ascii',p+4,p+8);assert.ok(p+n+12<=bytes.length);
        const body=bytes.subarray(p+8,p+8+n);assert.equal(bytes.readUInt32BE(p+8+n),crc32(bytes.subarray(p+4,p+8+n)),'PNG CRC '+tag);
        if(tag==='IDAT')compressed.push(body);p+=n+12;}
    const channels=color===6?4:3,stride=width*channels,raw=zlib.inflateSync(Buffer.concat(compressed));assert.equal(raw.length,(stride+1)*height);
    const rgba=withPixels?Buffer.alloc(width*height*4):null;
    let previous=Buffer.alloc(stride),transparent=0,opaque=0,partial=0;const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
    for(let y=0;y<height;y++){const o=y*(stride+1),filter=raw[o],row=Buffer.alloc(stride);assert.ok(filter<=4);
        for(let i=0;i<stride;i++){const a=i>=channels?row[i-channels]:0,b=previous[i],c=i>=channels?previous[i-channels]:0;
            row[i]=(raw[o+1+i]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}
        for(let x=0;x<width;x++){const a=channels===4?row[x*4+3]:255;if(a===0)transparent++;else if(a===255)opaque++;else partial++;
            if(rgba){const p=(y*width+x)*4;rgba[p]=row[x*channels];rgba[p+1]=row[x*channels+1];rgba[p+2]=row[x*channels+2];rgba[p+3]=a;}}previous=row;}
    return {width,height,color,transparent,opaque,partial,...(rgba?{rgba}:{})};}
async function startServer(){const server=http.createServer((req,res)=>{try{
    const pathname=new URL(req.url,'http://localhost').pathname,rel=decodeURIComponent(pathname).replace(/^\/+/, '')||'pc.html';
    const filename=path.resolve(root,rel);if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(!snapshots.has(rel)&&fs.existsSync(filename)&&fs.statSync(filename).isFile())freeze(rel,filename);
    const item=snapshots.get(rel),status=missing.has(rel)||!item?404:200;
    report.requests.push({path:pathname,status,controlled:missing.has(rel),delayed:delayedPaths.has(rel),...(item?.metadata||{})});
    const finish=()=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'}).end(status===200?item.bytes:'controlled missing asset');};
    if(delayedPaths.has(rel)){pendingResponses.push({rel,finish});return;}finish();
    }catch(error){report.serverErrors||=[];report.serverErrors.push(String(error));res.writeHead(400).end();}});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;}
function releaseImages(){delayedPaths=new Set();for(const p of pendingResponses.splice(0))p.finish();}
async function unusedPort(){const s=net.createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
    const port=s.address().port;await new Promise(resolve=>s.close(resolve));return port;}
async function connectCdp(url){const ws=new WebSocket(url),pending=new Map(),listeners=new Map();let sequence=0;
    const rejectAll=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('CDP closed'));}pending.clear();};
    ws.addEventListener('close',rejectAll);ws.addEventListener('message',event=>{const m=JSON.parse(event.data);
        if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
        else if(listeners.has(m.method))listeners.get(m.method)(m.params);});
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(new Error('CDP failed')),{once:true});});
    return {on:(name,fn)=>listeners.set(name,fn),send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});},
    close(){rejectAll();ws.close();}};}
async function evaluate(cdp,expression){const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function waitFor(cdp,label,expression,timeout=45000){const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await evaluate(cdp,expression);
    if(value)return value;await delay(60);}throw new Error('Timed out: '+label);}

function prepareAssets(){
    const bytes=fs.readFileSync(fileURLToPath(import.meta.url));report.runner={bytes:bytes.length,sha256:sha(bytes)};
    fs.writeFileSync(path.join(artifactDir,'runner-source.mjs'),bytes);
    for(const directory of productionDirectories)for(const file of walk(path.join(root,directory)))freeze(path.relative(root,file).replaceAll('\\','/'),file);
    for(const rel of ['pc.html','libs/dat-mod.lib','libs/sc-mod.lib'])freeze(rel);
    if(staged)for(const name of engines)freeze('js/'+name,path.join(root,'build/wasm/src',name));
    report.engineManifest=JSON.parse(snapshots.get('js/baye.build.json').bytes.toString('utf8'));
    for(const name of engines.filter(n=>n!=='baye.build.json')){assert.equal(report.sources['js/'+name].bytes,report.engineManifest.artifacts[name].bytes);
        assert.equal(report.sources['js/'+name].sha256,report.engineManifest.artifacts[name].sha256);}
    assert.equal(report.sources['libs/dat-mod.lib'].sha256,standardSha);native=decodeMaker(snapshots.get('libs/dat-mod.lib').bytes);
    const dir=path.join(artifactDir,'native-reference');fs.mkdirSync(dir,{recursive:true});
    report.nativeResource={...native,libSha256:standardSha,pictures:native.pictures.map(({data,...p})=>{const bytes=nativePicture({...p,data});
        nativePixels[p.picIndex]=inspectPng(bytes,true).rgba;const file='native-reference/MAKER6-picture-'+p.picIndex+'.png';
        fs.writeFileSync(path.join(artifactDir,file),bytes);return {...p,file,sha256:sha(bytes)};})};
    fs.writeFileSync(path.join(dir,'resource.json'),JSON.stringify(report.nativeResource,null,2)+'\n');
    const manifest=JSON.parse(snapshots.get('assets/hd-spe/manifest.json').bytes.toString('utf8'));report.manifest=manifest;
    makerEntry=manifest.entries.find(e=>e.speId===6&&e.resourceIndex===0&&e.kind===1&&e.startFrm===0&&e.endFrm===95)||null;
    if(allowLcd)return;
    assert.ok(makerEntry,'strict MAKER acceptance requires the complete authenticated 96-unit resource');
    assert.equal(manifest.libSha256,standardSha);assert.equal(manifest.axScale,1);assert.equal(makerEntry.libSha256||manifest.libSha256,standardSha);
    assert.equal(makerEntry.resourceFingerprint,native.resourceFingerprint);assert.equal(makerEntry.resourceLength,native.resourceLength);
    assert.equal(makerEntry.count,96);assert.equal(makerEntry.picmax,1);assert.equal(makerEntry.pictures.length,1);
    assert.deepEqual(makerEntry.units,native.units.map(({frame,x,y,picIndex})=>({frame,x,y,picIndex})),'all actual rolling positions are retained');
    report.makerAssets=makerEntry.pictures.map(p=>{const original=native.pictures[p.picIndex];assert.ok(original);
        assert.equal(p.logicalWidth,original.width);assert.equal(p.logicalHeight,original.height);assert.equal(p.nativeWidth,original.width);assert.equal(p.nativeHeight,original.height);assert.equal(p.mask,0);
        const file=snapshots.get(p.src);assert.ok(file,'actual HD MAKER PNG exists');const decoded=inspectPng(file.bytes);
        assert.equal(decoded.width,p.width);assert.equal(decoded.height,p.height);assert.ok(p.width>100&&p.height>100);
        assert.equal(decoded.transparent+decoded.partial,0,'the entire native opaque picture slot stays opaque');
        assert.notEqual(sha(file.bytes),report.nativeResource.pictures[p.picIndex].sha256,'HD artwork is not a copied native picture');
        return {...p,...decoded,sha256:file.metadata.sha256};});
}

// Presentation callbacks are forwarded unchanged. The observer never replaces
// native getters or invokes native functions; early prepareStart is left alone.
const observer='('+function(){
    window.__r08={samples:[],captures:[],keys:[],errors:[],visibility:[],polls:[],allDraws:[]};let api=null,seenMaker=false,currentDraws=null,send=null;
    const clone=x=>JSON.parse(JSON.stringify(x));
    const read=()=>{try{if(!window.baye||!baye.hd||!baye.hd.ready())return null;
        return {spe:clone(baye.hd.spe()),maker:typeof baye.hd.maker==='function'?clone(baye.hd.maker()):null,movie:clone(baye.hd.movie()),menu:clone(baye.hd.menuItems()),ready:baye.hd.ready()};}catch{return null;}};
    document.addEventListener('visibilitychange',()=>window.__r08.visibility.push({at:performance.now(),hidden:document.hidden,native:read()}));
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image){const result=draw.apply(this,arguments);
        if(this.canvas.id==='hd-spe-canvas'&&image&&image.tagName==='IMG'){const op={src:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight,args:Array.from(arguments).slice(1)};
            if(currentDraws)currentDraws.push(op);window.__r08.allDraws.push({at:performance.now(),hidden:document.hidden,native:read(),...op});}
        return result;};
    function record(stage,before,img,w,h,draws){try{const after=read();if(!after)return;const spe=after.spe;
        if(spe.id===6&&spe.active)seenMaker=true;
        const ui=api&&clone(api.debugSnapshot()),system=window.BayeHdSystemUi&&clone(BayeHdSystemUi.debugSnapshot());
        const entry={stage,at:performance.now(),native:after,ui,system,hidden:document.hidden,draws:draws||[]};window.__r08.samples.push(entry);
        // A final native copy may flush after the SPE scope has already ended.
        // Keep that real callback under the independent Maker hold authority.
        if(stage==='lcd-flush'&&seenMaker&&(spe.id===6||after.maker&&after.maker.active&&after.maker.phase==='hold')){const scratch=document.createElement('canvas');scratch.width=w;scratch.height=h;scratch.getContext('2d').putImageData(img,0,0);
            const hd=document.getElementById('hd-spe-canvas'),end=read(),d=baye.data,paint=Number(d.g_paintColor);
            window.__r08.captures.push({at:entry.at,before:before.spe.display,after:end.spe.display,native:after,ui,system,draws:entry.draws,hidden:document.hidden,
                raster:{scale:Number(d.g_scale),flip:Number(d.g_FlipDrawing),paintColor:paint,paletteZero:Number(d.g_paintPalette[0])>>>0,palettePaint:Number(d.g_paintPalette[paint])>>>0},
                nativeWidth:w,nativeHeight:h,nativePng:scratch.toDataURL('image/png'),hdWidth:hd&&hd.width,hdHeight:hd&&hd.height,hdPng:hd&&hd.toDataURL('image/png')});}
        if(window.__r08.samples.length>5000||window.__r08.captures.length>1000)throw new Error('Observation limit exceeded');
    }catch(e){window.__r08.errors.push(String(e));}}
    Object.defineProperty(window,'BayeHdSpe',{configurable:true,get(){return api;},set(value){api=value;
        for(const name of ['onEngineSpe','onEngineMaker','onLcdFlush']){const original=api[name];if(typeof original!=='function')continue;api[name]=function(){const before=read(),prior=currentDraws,draws=[];
            if(name==='onLcdFlush')currentDraws=draws;let result;
            try{result=original.apply(this,arguments);}finally{currentDraws=prior;record(name==='onLcdFlush'?'lcd-flush':'lifecycle',before,arguments[0],arguments[1],arguments[2],draws);}return result;};}
        if(!send&&typeof window.sendKey==='function'){send=window.sendKey;window.sendKey=function(code){window.__r08.keys.push({code,at:performance.now(),native:read()});return send.apply(this,arguments);};}
    }});
}.toString()+')();';
const stateExpression=`(() => {const ready=window.baye&&baye.hd&&baye.hd.ready();const read=n=>{const e=document.querySelector(n);if(!e)return null;
    const r=e.getBoundingClientRect(),s=getComputedStyle(e),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,visible:s.display!=='none'&&s.visibility==='visible',hit:top===e||e.contains(top),topElement:top&&{id:top.id,className:top.className}};};
    return {at:performance.now(),spe:ready?baye.hd.spe():null,maker:ready&&typeof baye.hd.maker==='function'?baye.hd.maker():null,movie:ready?baye.hd.movie():null,menu:ready?baye.hd.menuItems():null,
        ui:window.BayeHdSpe?BayeHdSpe.debugSnapshot():null,system:window.BayeHdSystemUi?BayeHdSystemUi.debugSnapshot():null,
        identity:window.BayeHdLibIdentity?BayeHdLibIdentity.read():null,keys:window.__r08&&window.__r08.keys,hidden:document.hidden,
        layout:{width:innerWidth,height:innerHeight,lcd:read('.container.js-baye-pc-lcd'),spe:read('#hd-spe'),system:read('#hd-system-ui'),canvas:read('#hd-spe-canvas'),
            skip:read('#hd-spe-skip'),return:read('[data-hd-spe-return]'),classic:read('[data-hd-spe-lcd]')}};})()`;
async function checkpoint(cdp,name,extra={}){const state=await evaluate(cdp,stateExpression),file=String(report.phases.length+1).padStart(2,'0')+'-'+name+'.png';
    const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,file),Buffer.from(image.data,'base64'));
    report.phases.push({name,screenshot:file,...extra,state});console.log('PASS',name);return state;}
async function canvasProof(cdp,name){const raw=await evaluate(cdp,`(() => {const read=()=>({spe:baye.hd.spe(),maker:typeof baye.hd.maker==='function'?baye.hd.maker():null}),before=read();
    const extract=id=>{const n=document.getElementById(id);return n&&n.width&&n.height?{width:n.width,height:n.height,png:n.toDataURL('image/png')}:null;};
    const native=extract('lcd'),hd=extract('hd-spe-canvas'),ui=BayeHdSpe.debugSnapshot(),after=read();return {at:performance.now(),before,after,ui,native,hd};})()`);
    assert.deepEqual(raw.before.spe.display,raw.after.spe.display,'display stamp is stable around the real held LCD/HD canvas sample');
    assert.deepEqual(raw.before.maker,raw.after.maker,'native Maker authority is stable during this synchronous observation');
    const files={};for(const key of ['native','hd']){if(!raw[key])continue;const bytes=Buffer.from(raw[key].png.split(',')[1],'base64'),file=name+'-'+key+'.png';
        const decoded=inspectPng(bytes,true);assert.equal(decoded.width,raw[key].width);assert.equal(decoded.height,raw[key].height);
        fs.writeFileSync(path.join(artifactDir,file),bytes);files[key]={file,bytes:bytes.length,sha256:sha(bytes),rgbaSha256:sha(decoded.rgba),width:decoded.width,height:decoded.height};delete raw[key].png;}
    return {...raw,files};}
function frames(d){assert.equal(d.visibleFrames.length,32);assert.ok(d.visibleFrames.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
    return Array.from({length:256},(_,i)=>i).filter(i=>(d.visibleFrames[i>>3]&(1<<(i&7)))!==0);}
function makerOwner(m,phase){assert.equal(m?.protocolVersion,1);assert.equal(m.active,true);assert.equal(m.phase,phase);
    for(const field of ['generation','session','inputSeq'])assert.ok(Number.isInteger(m[field])&&m[field]>0,'actual Maker '+field);
    if(phase==='hold')assert.equal(m.returnEligible,true);
    return {protocolVersion:1,generation:m.generation,session:m.session,inputSeq:m.inputSeq,phase};}
function assertLayout(s,held=false){const l=s.layout,c=l.canvas;assert.ok(c?.visible&&c.width>0&&c.height>0);
    assert.ok(c.left>=0&&c.top>=0&&c.right<=l.width&&c.bottom<=l.height,'actual HD canvas is within the viewport');
    const overlap=(a,b)=>Math.max(a.left,b.left)<Math.min(a.right,b.right)&&Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom);
    for(const b of [held?l.return:l.skip,l.classic]){assert.ok(b?.visible&&b.hit&&b.width>=44&&b.height>=44&&b.bottom<=l.height,'real current-owner button is visible, unobstructed, and at least44px');
        assert.equal(overlap(c,b),false,'buttons do not cover credits');}}
function sourceFromSnapshot(n){if(n.spe.active&&n.spe.id===6)return n.spe;const m=n.maker;
    if(m&&m.active&&m.phase==='hold')return {...m,id:m.speId,eventId:m.display.eventId,commitSeq:m.display.commitSeq};return n.spe;}
const defaultRaster={scale:1,flip:0,paintColor:255,paletteZero:0x00ffffff,palettePaint:0xff000000};
function assertPixels(bytes,visible,raster){assert.deepEqual(raster,defaultRaster);const actual=inspectPng(bytes,true),expected=Buffer.alloc(160*96*4,255);
    assert.equal(actual.width,160);assert.equal(actual.height,96);
    for(const frame of visible){const u=native.units[frame],p=native.pictures[u.picIndex],rgba=nativePixels[u.picIndex];
        for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const px=u.x+x,py=u.y+y;if(px<160&&py<96)rgba.copy(expected,(py*160+px)*4,(y*p.width+x)*4,(y*p.width+x+1)*4);}}
    for(let i=0;i<expected.length;i+=4){const color=expected[i]===0?raster.palettePaint:raster.paletteZero,a=(color>>>24)&255;
        expected[i]=a?color&255:0;expected[i+1]=a?(color>>>8)&255:0;expected[i+2]=a?(color>>>16)&255:0;expected[i+3]=a;}
    assert.ok(actual.rgba.equals(expected),'actual native MAKER pixels match visible resource unit composition '+visible.join(','));
    return {match:true,rgbaSha256:sha(actual.rgba),expectedRgbaSha256:sha(expected)};}
function assertHdDraws(c,visible){assert.ok(makerEntry);assert.equal(c.ui.open,true);assert.equal(c.ui.source,'hd-assets');
    assert.deepEqual(c.ui.displayedFrames,visible,'HD draws use actual displayed bits, not the current logical frame');
    assert.equal(c.draws.length,visible.length);
    for(let i=0;i<visible.length;i++){const u=native.units[visible[i]],p=makerEntry.pictures.find(p=>p.picIndex===u.picIndex),op=c.draws[i];
        assert.equal(op.src.replace(/^\//,''),p.src);assert.equal(op.width,p.width);assert.equal(op.height,p.height);
        assert.deepEqual(op.args,[u.x*c.ui.scale,u.y*c.ui.scale,p.logicalWidth*c.ui.scale,p.logicalHeight*c.ui.scale],'real scroll offset/native rectangle retained');}}
async function collect(cdp,name,standard=true){const evidence=await evaluate(cdp,'window.__r08');assert.deepEqual(evidence.errors,[]);const dir=path.join(artifactDir,name);fs.mkdirSync(dir,{recursive:true});
    evidence.captures=evidence.captures.map((c,i)=>{const s=sourceFromSnapshot(c.native);assert.deepEqual(c.before,c.after,'same displayed stamp around actual LCD capture');
        const visible=c.before.frameValid?frames(c.before):[];
        if(c.before.frameValid&&standard){assert.equal(s.id,6);assert.equal(s.count,96);assert.equal(s.picmax,1);assert.equal(s.startFrm,0);assert.equal(s.endFrm,95);
            assert.equal(s.resourceFingerprint,native.resourceFingerprint);assert.equal(s.resourceLength,native.resourceLength);
            assert.equal(c.before.generation,s.generation);assert.equal(c.before.eventId,s.eventId);assert.ok(visible.every(f=>f<96&&f<=c.before.frameIndex));}
        if(c.native.maker&&c.native.maker.active&&c.native.maker.phase==='hold'&&c.native.maker.sourceValid)
            assert.deepEqual(c.before,c.native.maker.display,'post-end real LCD callback matches the saved native copied owner');
        if(c.ui.open&&c.ui.source==='hd-assets'&&c.before.frameValid&&standard)assertHdDraws(c,visible);
        else assert.equal(c.draws.length,0,'fallback/hidden/classic never draws a partial HD resource');
        const prefix=String(i+1).padStart(3,'0')+'-commit-'+c.before.commitSeq+'-frame-'+c.before.frameIndex,files={};
        for(const [key,pngKey] of [['native','nativePng'],['hd','hdPng']]){if(!c[pngKey])continue;const bytes=Buffer.from(c[pngKey].split(',')[1],'base64'),file=name+'/'+prefix+'-'+key+'.png';
            if(key==='native'&&c.before.frameValid&&standard)c.nativePixels=assertPixels(bytes,visible,c.raster);
            fs.writeFileSync(path.join(artifactDir,file),bytes);files[key]={file,bytes:bytes.length,sha256:sha(bytes)};delete c[pngKey];}
        return {...c,visible,files};});
    const session={name,...evidence};report.sessions.push(session);fs.writeFileSync(path.join(dir,'observations.json'),JSON.stringify(session,null,2)+'\n');return session;}
async function click(cdp,selector){const p=await evaluate(cdp,`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,
    s=getComputedStyle(n),t=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,text:n.textContent,visible:s.display!=='none'&&s.visibility!=='hidden',hit:t===n||n.contains(t),disabled:n.disabled};})()`);
    assert.ok(p?.visible&&p.hit&&!p.disabled&&p.width>0&&p.height>=44,'genuine button '+selector+' '+JSON.stringify(p));
    for(const type of ['mouseMoved','mousePressed','mouseReleased'])await cdp.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,...(type!=='mouseMoved'?{button:'left',buttons:type==='mousePressed'?1:0,clickCount:1}:{})});return p;}
async function enter(cdp){for(const type of ['keyDown','keyUp'])await cdp.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});}
async function startMaker(cdp,origin,name,width=1920,height=1080,standard=true){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await cdp.send('Page.navigate',{url:origin+'/pc.html?r08='+name+'&t='+Date.now()});
    await waitFor(cdp,'real fresh title',`window.baye&&baye.hd&&baye.hd.ready()&&baye.hd.menuItems().active&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1&&window.BayeHdSystemUi&&BayeHdSystemUi.debugSnapshot().open`,60000);
    await waitFor(cdp,'rendered title has the current native owner',`(() => {const n=document.querySelector('#hd-system-ui [data-hd-sys="2"]'),m=baye.hd.menuItems();return n&&!n.disabled&&n.getAttribute('data-hd-sys-owner')==='menu:'+m.seq+':4:1';})()`);
    const loaded=await evaluate(cdp,'window.dynLib');assert.equal(sha(Buffer.from(loaded,'hex')),standard?standardSha:report.sources['libs/sc-mod.lib'].sha256);
    const title=await checkpoint(cdp,name+'-title');assert.deepEqual(title.keys,[]);assert.equal(title.menu.count,4);assert.equal(title.menu.index,0);
    const button=await click(cdp,'#hd-system-ui [data-hd-sys="2"]');assert.equal(button.text,'制作群组');
    const owner=await waitFor(cdp,'real MAKER introduced',`(() => {const s=baye.hd.spe();return s.active&&s.id===6&&{eventId:s.eventId,generation:s.generation};})()`);
    await waitFor(cdp,'real MAKER first display',`window.__r08.captures.some(c=>c.before.eventId===${owner.eventId}&&c.before.frameValid)`);
    const state=await checkpoint(cdp,name+'-scrolling');assert.deepEqual(state.keys.map(k=>k.code),[35,35,39],'actual title route is two Down ACKs and one Enter');
    assert.equal(state.menu.active,0);if(!allowLcd){makerOwner(state.maker,'scroll');assertLayout(state);}return {owner,title,button,start:state};}
async function makerEnd(cdp,owner,reason){return waitFor(cdp,'real MAKER '+reason,`(() => {const s=baye.hd.spe();return s.generation===${owner.generation}&&s.lastEnd.eventId===${owner.eventId}&&s.lastEnd.reason===${JSON.stringify(reason)}&&s;})()`,30000);}
async function titleReturn(cdp,previous){return waitFor(cdp,'natural title input owner returns',`(() => {const m=baye.hd.menuItems();return m.active&&m.context===4&&m.kind===1&&m.seq>${previous.seq}&&m;})()`,90000);}
async function scenario(cdp,origin,name,kind,width=1920,height=1080){const intro=await startMaker(cdp,origin,name,width,height),{owner}=intro;
    let keyAction=null;
    if(kind==='scroll-skip'){await waitFor(cdp,'MAKER scroll progressed',`baye.hd.spe().display.frameIndex>=8&&baye.hd.spe().active&&baye.hd.spe().id===6`);
        keyAction={at:await evaluate(cdp,'performance.now()'),button:await click(cdp,'#hd-spe-skip')};}
    const ended=await makerEnd(cdp,owner,kind==='scroll-skip'?'key':'complete');const hold=await checkpoint(cdp,name+'-native-hold',{ended:ended.lastEnd});
    assert.equal(hold.spe.active,0);assert.equal(hold.menu.active,0);assert.equal(hold.movie.active,0);
    // Record default installed presentation first. Switching to classic here
    // only reveals the actual held LCD; it sends no native input or movie call.
    const beforeClassic=hold.keys.length;await evaluate(cdp,`BayeHdSystemUi.setMode('classic')`);await delay(150);
    const classicHold=await checkpoint(cdp,name+'-classic-hold');assert.equal(classicHold.keys.length,beforeClassic);
    assert.ok(classicHold.layout.lcd.visible&&classicHold.layout.lcd.hit,'held native LCD is truly visible at its center');
    if(kind==='hold-key'){keyAction={at:await evaluate(cdp,'performance.now()'),before:classicHold};await enter(cdp);}
    const polls=[];const deadline=Date.now()+90000;let returned;
    while(Date.now()<deadline){const s=await evaluate(cdp,stateExpression);polls.push({at:s.at,spe:s.spe,movie:s.movie,menu:s.menu,system:s.system,keys:s.keys.length});
        if(s.menu.active&&s.menu.context===4&&s.menu.kind===1&&s.menu.seq>intro.title.menu.seq){returned=s;break;}await delay(250);}
    assert.ok(returned,'real title returns without injected timers');await delay(300);
    const final=await checkpoint(cdp,name+'-returned'),session=await collect(cdp,name),expected=kind==='full'?[35,35,39]:[35,35,39,39];
    assert.deepEqual(session.keys.map(k=>k.code),expected,'only real title keys and the one intended action are delivered');
    assert.equal(final.keys.length,expected.length,'no old movie/hold action leaks into new title owner');assert.equal(final.menu.index,0);
    const captures=session.captures.filter(c=>c.before.eventId===owner.eventId&&c.before.frameValid);
    assert.ok(captures.length>0);const logical=[...new Set(captures.map(c=>c.before.frameIndex))];
    if(kind!=='scroll-skip'){assert.ok(logical.some(f=>f>=90),'late scrolling actually displayed');assert.ok(logical.length>40,'complete rolling sequence, not one still PNG');}
    session.summary={kind,width,height,owner,titleOwner:intro.title.menu,ended:ended.lastEnd,keyAction,
        lastRollingAt:captures.at(-1).at,endObservedAt:hold.at,titleReturnedAt:returned.at,holdObservedMs:returned.at-hold.at,
        displayedCommits:captures.length,logicalFrames:logical,visibleFrames:[...new Set(captures.flatMap(c=>c.visible))],
        defaultHold:{ui:hold.ui,system:hold.system,menu:hold.menu,movie:hold.movie,layout:hold.layout},classicHold:classicHold.layout,
        returnedOwner:final.menu,inputCodes:session.keys.map(k=>k.code),polls,hdAccepted:false};
    fs.writeFileSync(path.join(artifactDir,name,'observations.json'),JSON.stringify(session,null,2)+'\n');
    console.log('MAKER',name,JSON.stringify({commits:captures.length,first:logical[0],last:logical.at(-1),holdMs:session.summary.holdObservedMs,keys:expected}));
}

async function waitHold(cdp,owner,source){return waitFor(cdp,'actual Maker hold and current presentation',`(() => {const m=baye.hd.maker(),s=baye.hd.spe(),u=BayeHdSpe.debugSnapshot();
    return m.active&&m.phase==='hold'&&m.generation===${owner.generation}&&m.display.eventId===${owner.eventId}&&m.returnEligible&&u.open&&u.presentation==='maker-hold'&&u.source===${JSON.stringify(source)}&&{m,s,u};})()`,30000);}
function assertHold(state,owner,reason,source,standard=true){const ticket=makerOwner(state.maker,'hold'),m=state.maker;assert.equal(state.spe.active,0,'the true SPE scope remains retired during Maker hold');
    assertLayout(state,true);
    assert.equal(state.menu.active,0);assert.equal(state.system.open,false,'title shell is suppressed by the independent actual Maker owner');
    assert.equal(m.generation,owner.generation);assert.equal(m.display.eventId,owner.eventId);assert.equal(m.scrollEnd.reason,reason);assert.equal(m.scrollEnd.key,reason==='key'?39:255);
    assert.equal(state.ui.presentation,'maker-hold');assert.equal(state.ui.source,source);assert.equal(state.ui.open,true);
    if(standard){assert.equal(m.custom,false);assert.equal(m.sourceValid,true);assert.deepEqual(m.display,state.spe.display,'actual public display equals the saved native copied stamp');
        for(const key of ['resourceIndex','count','picmax','x','y','startFrm','endFrm','resourceLength','resourceFingerprint'])assert.equal(m[key],key==='x'||key==='y'?0:native[key]);}
    return {ticket,token:state.ui.ownerToken,display:m.display};}
async function retired(cdp,intro,token,expectedKeys){await titleReturn(cdp,intro.title.menu);await delay(300);const s=await evaluate(cdp,stateExpression);
    assert.equal(s.maker.active,false);assert.equal(s.ui.open,false);assert.equal(s.menu.index,0);assert.deepEqual(s.keys.map(k=>k.code),expectedKeys);
    assert.equal(await evaluate(cdp,`BayeHdSpe.returnToTitle(${JSON.stringify(token)})`),false,'retired presentation token cannot send into a new native title');
    await delay(150);assert.deepEqual(await evaluate(cdp,'window.__r08.keys.map(k=>k.code)'),expectedKeys,'no delayed return key is queued into the new owner');return s;}
async function holdLifecycle(cdp,owner,targetId){const start=await evaluate(cdp,stateExpression),keys=start.keys.length,token=start.ui.ownerToken;
    const point=await evaluate(cdp,`(() => {const r=document.querySelector('[data-hd-spe-return]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});
    await evaluate(cdp,`BayeHdSystemUi.setMode('classic')`);await waitFor(cdp,'classic held LCD',`!BayeHdSpe.isOpen()`);
    const classic=await checkpoint(cdp,'720p-maker-classic-hold');assert.ok(classic.layout.lcd.visible&&classic.layout.lcd.hit);assert.equal(classic.keys.length,keys);
    await evaluate(cdp,`BayeHdSystemUi.setMode('hd')`);await waitHold(cdp,owner,'hd-assets');
    const restored=await evaluate(cdp,stateExpression);assert.equal(restored.maker.session,start.maker.session);assert.notEqual(restored.ui.ownerToken,token,'local presentation retirement increments the epoch');
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});await delay(80);
    assert.equal(await evaluate(cdp,'window.__r08.keys.length'),keys,'old pointer press cannot return after mode retirement under the same native owner');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await waitFor(cdp,'actual enlarged held HD canvas',`document.getElementById('hd-spe-canvas').getBoundingClientRect().width>${start.layout.canvas.width}`);
    const enlarged={pixels:await canvasProof(cdp,'mode-resize-1080p-held'),layout:(await evaluate(cdp,stateExpression)).layout};
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    await waitFor(cdp,'actual restored 720p held HD canvas',`Math.abs(document.getElementById('hd-spe-canvas').getBoundingClientRect().width-${start.layout.canvas.width})<0.5`);await waitHold(cdp,owner,'hd-assets');
    const resized={pixels:await canvasProof(cdp,'mode-resize-720p-held'),layout:(await evaluate(cdp,stateExpression)).layout};
    const other=await cdp.send('Target.createTarget',{url:'about:blank'});let method='actual-tab-activation';
    try{await cdp.send('Target.activateTarget',{targetId:other.targetId});await delay(25);
        if(!await evaluate(cdp,'document.hidden')){method='explicit-document-visibility-simulation';await evaluate(cdp,`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));`);}
        const hidden=await evaluate(cdp,stateExpression);assert.equal(hidden.hidden,true);assert.equal(hidden.ui.open,false);assert.equal(hidden.keys.length,keys);
        await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await delay(80);await cdp.send('Page.setWebLifecycleState',{state:'active'});await cdp.send('Target.activateTarget',{targetId});
        if(method==='explicit-document-visibility-simulation')await evaluate(cdp,`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));`);
        await waitHold(cdp,owner,'hd-assets');const final=await checkpoint(cdp,'720p-maker-mode-hidden-resize-restored',{method,classic,hidden});
        assert.equal(final.maker.session,start.maker.session);assert.equal(final.keys.length,keys);
        assert.equal(await evaluate(cdp,`BayeHdSpe.returnToTitle(${JSON.stringify(token)})`),false,'stale epoch token is rejected after same-owner restoration');
        return {method,classic,hidden,enlarged,resized,restored:final,zeroNativeKeys:true};
    }finally{await cdp.send('Page.setWebLifecycleState',{state:'active'}).catch(()=>{});await cdp.send('Target.closeTarget',{targetId:other.targetId}).catch(()=>{});}}
async function strictScenario(cdp,origin,name,action,targetId,width=1920,height=1080){const intro=await startMaker(cdp,origin,name,width,height),{owner}=intro;let skipAction=null;
    if(action==='skip-enter'){await waitFor(cdp,'native scroll progressed',`baye.hd.spe().active&&baye.hd.spe().id===6&&baye.hd.spe().display.frameIndex>=8`);skipAction=await click(cdp,'#hd-spe-skip');}
    const reason=action==='skip-enter'?'key':'complete',ended=await makerEnd(cdp,owner,reason);await waitHold(cdp,owner,'hd-assets');
    const hold=await checkpoint(cdp,name+'-hold-hd'),authority=assertHold(hold,owner,reason,'hd-assets'),proof=await canvasProof(cdp,name+'-hold');
    assertPixels(Buffer.from(await evaluate(cdp,`document.getElementById('lcd').toDataURL('image/png').split(',')[1]`),'base64'),frames(authority.display),defaultRaster);
    if(reason==='complete'){assert.equal(authority.display.frameIndex,95);assert.ok(frames(authority.display).includes(95),'actual final unit is displayed, not merely advanced logically');}
    else assert.ok(authority.display.frameIndex<95,'skip retains a genuinely partial rolling position');
    let lifecycle=null;if(action==='lifecycle')lifecycle=await holdLifecycle(cdp,owner,targetId);
    const token=(await evaluate(cdp,'BayeHdSpe.debugSnapshot()')).ownerToken;
    if(action==='skip-enter')await enter(cdp);
    else if(action!=='natural')await click(cdp,'[data-hd-spe-return]');
    const expected=[35,35,39,...(action==='skip-enter'?[39,39]:action==='natural'?[]:[39])],final=await retired(cdp,intro,token,expected);
    const session=await collect(cdp,name),captures=session.captures.filter(c=>c.before.eventId===owner.eventId&&c.before.frameValid),visible=[...new Set(captures.flatMap(c=>c.visible))];
    for(const k of session.keys.slice(3)){assert.equal(k.native.maker.active,true);assert.equal(k.native.maker.generation,owner.generation);assert.equal(k.native.maker.session,hold.maker.session);
        if(k.native.spe.active){assert.equal(action,'skip-enter');assert.equal(k.native.spe.id,6);assert.equal(k.native.maker.phase,'scroll');}
        else{assert.equal(k.native.maker.phase,'hold');assert.equal(k.native.maker.inputSeq,authority.ticket.inputSeq);}}
    assert.ok(captures.length>0);assert.ok(captures.every(c=>c.ui.open&&c.ui.source==='hd-assets'),'every actual cold Maker display, including the first, is genuine full-slot HD');
    assert.equal(captures[0].before.frameIndex,0);assert.ok(visible.includes(0));if(reason==='complete'){assert.ok(visible.includes(95));assert.ok(visible.length>40,'the real full rolling sequence is observed');}
    const last=captures.filter(c=>JSON.stringify(c.before)===JSON.stringify(authority.display)).at(-1);assert.ok(last,'saved hold has a captured actual LCD source');
    assert.equal(proof.files.hd.sha256,last.files.hd.sha256,'held HD canvas preserves the actual final/partial scroll image');
    assert.ok(session.allDraws.every(d=>!d.hidden),'no HD image is drawn while hidden');
    session.summary={action,width,height,owner,ended:ended.lastEnd,authority,proof,skipAction,lifecycle,firstSource:captures[0].ui.source,
        actualCommits:captures.length,visibleFrames:visible,holdObservedMs:final.at-hold.at,returnedOwner:final.menu,inputCodes:expected,hdAccepted:true};
    fs.writeFileSync(path.join(artifactDir,name,'observations.json'),JSON.stringify(session,null,2)+'\n');await checkpoint(cdp,name+'-retired',session.summary);
}
async function failureScenario(cdp,origin,kind){const name=kind+'-maker-image',file=makerEntry.pictures[0].src,requestStart=report.requests.length;
    if(kind==='missing')missing.add(file);else delayedPaths.add(file);
    try{const intro=await startMaker(cdp,origin,name,1280,720),{owner}=intro;await makerEnd(cdp,owner,'complete');await waitHold(cdp,owner,'lcd');
        const hold=await checkpoint(cdp,name+'-lcd-hold'),authority=assertHold(hold,owner,'complete','lcd'),proof=await canvasProof(cdp,name+'-hold');
        await enter(cdp);const expected=[35,35,39,39],final=await retired(cdp,intro,authority.token,expected),session=await collect(cdp,name);
        assert.ok(session.captures.length>40);assert.ok(session.captures.every(c=>c.ui.source==='lcd'&&c.draws.length===0),'missing/timed-out resource is entirely actual LCD fallback');
        assert.ok(report.requests.slice(requestStart).some(r=>r.path==='/'+file&&(kind==='missing'?r.controlled&&r.status===404:r.delayed)),'controlled real HTTP failure was exercised');
        if(kind==='delayed'){releaseImages();await delay(650);const late=await evaluate(cdp,stateExpression),draws=await evaluate(cdp,'window.__r08.allDraws');
            assert.equal(late.maker.active,false);assert.equal(late.ui.open,false);assert.deepEqual(late.keys.map(k=>k.code),expected);
            assert.equal(draws.filter(d=>d.at>final.at&&d.src.replace(/^\//,'')===file).length,0,'late image cannot draw into returned/new native owner');session.afterRelease=late;}
        session.summary={kind,owner,authority,proof,returnedOwner:final.menu,inputCodes:expected,hdAccepted:false,fullNativeFallback:true};
        fs.writeFileSync(path.join(artifactDir,name,'observations.json'),JSON.stringify(session,null,2)+'\n');await checkpoint(cdp,name+'-retired');
    }finally{missing.delete(file);releaseImages();}}
async function unknownScenario(cdp,origin){const name='actual-unknown-library',requestStart=report.requests.length,intro=await startMaker(cdp,origin,name,1280,720,false),{owner}=intro;
    const identity=await waitFor(cdp,'actual Mod content identity',`BayeHdLibIdentity.read().status==='ready'&&BayeHdLibIdentity.read()`);
    assert.equal(identity.sha256,report.sources['libs/sc-mod.lib'].sha256);assert.notEqual(identity.sha256,standardSha);
    await makerEnd(cdp,owner,'complete');await waitHold(cdp,owner,'lcd');const hold=await checkpoint(cdp,name+'-held-lcd');
    const authority=assertHold(hold,owner,'complete','lcd',false),proof=await canvasProof(cdp,name+'-hold');await enter(cdp);
    const expected=[35,35,39,39],final=await retired(cdp,intro,authority.token,expected),session=await collect(cdp,name,false);
    assert.ok(session.captures.length>0);assert.ok(session.captures.every(c=>c.ui.source==='lcd'&&c.draws.length===0));
    assert.equal(report.requests.slice(requestStart).filter(r=>r.path==='/'+makerEntry.pictures[0].src).length,0,'unknown actual LIB never requests standard Maker art');
    session.summary={identity,owner,authority,proof,returnedOwner:final.menu,inputCodes:expected,actualMakerAndNativeTitleOnly:true,fullModNewGame:false,fullModBattle:false,hdAccepted:false};
    fs.writeFileSync(path.join(artifactDir,name,'observations.json'),JSON.stringify(session,null,2)+'\n');await checkpoint(cdp,name+'-retired');}

async function main(){fs.mkdirSync(artifactDir,{recursive:true});assert.equal(typeof WebSocket,'function');let server,unknownServer,chrome,cdp,profile,chromeError;
    const interrupt=()=>{report.interrupted=true;cdp?.close();if(chrome&&chrome.exitCode===null)chrome.kill('SIGTERM');server?.closeAllConnections();unknownServer?.closeAllConnections();};
    process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{prepareAssets();console.log('Frozen',Object.keys(report.sources).length,'sources; runner',report.runner.sha256);
        server=await startServer();if(!allowLcd)unknownServer=await startServer();const origin='http://127.0.0.1:'+server.address().port,
            unknownOrigin=unknownServer?'http://127.0.0.1:'+unknownServer.address().port:null,debugPort=await unusedPort();
        assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);if(unknownServer)assert.notEqual(unknownServer.address().port,8080);
        profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-maker-runtime-'));const binary=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(fs.existsSync(binary));
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking',
            '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
            '--window-size=1920,1080','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
        chrome.on('error',e=>{chromeError=e;});report.isolation={httpPort:server.address().port,unknownHttpPort:unknownServer?.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};
        let target;for(const deadline=Date.now()+20000;Date.now()<deadline;){if(chromeError)throw chromeError;if(chrome.exitCode!==null)throw new Error('Chrome exited '+chrome.exitCode);
            try{target=(await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json())).find(t=>t.type==='page');if(target)break;}catch{}await delay(100);}
        assert.ok(target);cdp=await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));cdp.on('Runtime.consoleAPICalled',e=>report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')}));
        cdp.on('Page.javascriptDialogOpening',e=>{report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});
        cdp.on('Fetch.requestPaused',e=>{const requestOrigin=new URL(e.request.url).origin,local=requestOrigin===origin||requestOrigin===unknownOrigin;if(!local)report.blocked.push(e.request.url);
            cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});report.browser=await cdp.send('Browser.getVersion');
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('baye/libpath',location.origin===${JSON.stringify(unknownOrigin)}?'libs/sc-mod.lib':'libs/dat-mod.lib');localStorage.setItem('baye/systemUiMode','hd');
            localStorage.setItem('baye/overworldMode','classic');localStorage.setItem('baye/cityMenuMode','classic');`});
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:observer});
        if(allowLcd){await scenario(cdp,origin,'full-natural-1080p','full');await scenario(cdp,origin,'scroll-skip-natural-720p','scroll-skip',1280,720);
            await scenario(cdp,origin,'full-hold-enter-720p','hold-key',1280,720);}
        else{await strictScenario(cdp,origin,'full-natural-1080p','natural',target.id);
            await strictScenario(cdp,origin,'scroll-skip-enter-720p','skip-enter',target.id,1280,720);
            await strictScenario(cdp,origin,'full-return-button-720p','button',target.id,1280,720);
            await strictScenario(cdp,origin,'mode-hidden-resize-720p','lifecycle',target.id,1280,720);
            await failureScenario(cdp,origin,'missing');await failureScenario(cdp,origin,'delayed');await unknownScenario(cdp,unknownOrigin);}
        assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.dialogs,[]);assert.deepEqual(report.serverErrors||[],[]);report.ok=true;
    }catch(e){report.ok=false;report.error=e.stack||String(e);console.error(report.error);process.exitCode=1;
        if(cdp){try{report.failureState=await evaluate(cdp,stateExpression);await collect(cdp,'failure-observations');}catch(e){report.failureObservationError=String(e);}
            try{const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(image.data,'base64'));}catch{}}
    }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);cdp?.close();
        if(chrome&&chrome.exitCode===null){const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([stopped,delay(1500)]);
            if(chrome.exitCode===null){chrome.kill('SIGKILL');await Promise.race([stopped,delay(1500)]);}}
        for(const s of [server,unknownServer])if(s){s.closeAllConnections();await new Promise(resolve=>s.close(resolve));}
        if(profile){const absolute=path.resolve(profile);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('baye-maker-runtime-'));
            fs.rmSync(absolute,{recursive:true,force:true,maxRetries:5,retryDelay:100});report.isolation.cleaned=!fs.existsSync(absolute);}
        const sources=Object.entries(report.sources).map(([name,s])=>({path:name,...s,match:fs.existsSync(path.join(root,s.source))&&sha(fs.readFileSync(path.join(root,s.source)))===s.sha256}));
        const runnerMatch=report.runner&&sha(fs.readFileSync(fileURLToPath(import.meta.url)))===report.runner.sha256;
        const added=productionDirectories.flatMap(d=>walk(path.join(root,d))).map(p=>path.relative(root,p).replaceAll('\\','/')).filter(p=>!snapshots.has(p));
        const verification={ok:sources.every(s=>s.match)&&!!runnerMatch&&added.length===0,count:sources.length,runnerMatch,added,sources};
        fs.writeFileSync(path.join(artifactDir,'source-verification.json'),JSON.stringify(verification,null,2)+'\n');report.sourceVerification={ok:verification.ok,count:verification.count,runnerMatch,added,drift:sources.filter(s=>!s.match).map(s=>s.path)};
        if(!verification.ok){report.ok=false;report.sourceError='Frozen source/runner changed';process.exitCode=1;}
        report.hdAccepted=report.ok===true&&!allowLcd;report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(report,null,2)+'\n');console.log('Artifacts:',artifactDir);
        if(report.ok)console.log(allowLcd?'Actual MAKER native baseline passed; no HD acceptance is claimed':'Strict actual MAKER rolling and hold acceptance passed');
    }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
