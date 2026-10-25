#!/usr/bin/env node
/**
 * Genuine MAIN_SPE=3 playback acceptance, using an isolated HTTP/CDP/profile.
 *   $env:CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
 *   node scripts/test-hd-opening-runtime.mjs --artifact-dir build/r07-opening-final
 * --allow-lcd is a native-only development baseline, never HD acceptance.
 * --staged serves the four build/wasm/src loader files without installing.
 * The observer forwards presentation callbacks and draw calls unchanged; it
 * never replaces a native getter, invokes PlcMovie, or writes baye.data.
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
const argument=flag=>{const i=process.argv.indexOf(flag);if(i<0)return null;const value=process.argv[i+1];
    assert.ok(value&&!value.startsWith('--'),flag+' requires a value');return value;};
const artifactDir=path.resolve(argument('--artifact-dir')||path.join(root,'build/r07-opening-runtime'));
const verifyCaptured=argument('--verify-captured');
const allowLcd=process.argv.includes('--allow-lcd'),staged=process.argv.includes('--staged'),unknownOnly=process.argv.includes('--unknown-only');
assert.ok(!unknownOnly||allowLcd,'--unknown-only is a native development probe and requires --allow-lcd');
const standardSha='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const snapshots=new Map(),missing=new Set(),pendingResponses=[];
const productionDirectories=['js','css','assets'];
let delayedPaths=new Set();
const report={startedAt:new Date().toISOString(),allowLcd,staged,unknownOnly,verifyCaptured,hdAccepted:false,
    scope:'Real complete MAIN3 displayed LCD commits and HD picture-slot mapping; timer merging is preserved',
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
function decodeOpening(lib){const bytes=resource(lib,3,0),count=bytes[2],picmax=bytes[3],start=bytes[4],end=bytes[5];
    assert.equal(count,9);assert.equal(picmax,7);assert.equal(start,0);assert.equal(end,8);
    const units=Array.from({length:count},(_,frame)=>{const o=6+frame*5;return {frame,x:bytes[o],y:bytes[o+1],cdelay:bytes[o+2],ndelay:bytes[o+3],picIndex:bytes[o+4]};});
    let offset=6+count*5;const pictures=[];
    for(let picIndex=0;picIndex<picmax;picIndex++){assert.ok(offset+7<=bytes.length);const width=bytes.readUInt16LE(offset),height=bytes.readUInt16LE(offset+2),mask=bytes[offset+6];
        assert.ok(width>0&&height>0&&mask<=1);const stride=Math.ceil(width/8),size=stride*height*(mask+1),begin=offset+7;
        assert.ok(begin+size<=bytes.length);pictures.push({picIndex,width,height,mask,stride,payloadOffset:offset,bytes:size,data:bytes.subarray(begin,begin+size)});offset=begin+size;}
    assert.equal(offset,bytes.length,'complete native MAIN payload was decoded');
    assert.deepEqual(units.map(u=>[u.x,u.y,u.cdelay,u.ndelay,u.picIndex]),[[0,0,20,20,0],[0,0,20,20,1],[0,0,20,20,2],[0,0,20,20,3],[0,0,80,80,4],[0,0,60,20,0],[20,15,40,1,5],[90,25,30,30,6],[90,25,1,1,6]]);
    return {speId:3,resourceIndex:0,kind:1,count,picmax,startFrm:start,endFrm:end,resourceLength:bytes.length,
        resourceFingerprint:fnv(bytes),units,pictures};}
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
let native,mainEntry=null,nativePixels=[];
function prepareAssets(){
    const runner=fs.readFileSync(fileURLToPath(import.meta.url));report.runner={bytes:runner.length,sha256:sha(runner)};
    for(const directory of productionDirectories)for(const filename of walk(path.join(root,directory)))freeze(path.relative(root,filename).replaceAll('\\','/'),filename);
    for(const rel of ['pc.html','libs/dat-mod.lib','libs/sc-mod.lib'])freeze(rel);
    if(staged)for(const name of engines)freeze('js/'+name,path.join(root,'build/wasm/src',name));
    report.engineManifest=JSON.parse(snapshots.get('js/baye.build.json').bytes.toString('utf8'));
    assert.equal(report.engineManifest.hdSpeProtocol.version,2);
    for(const name of engines.filter(n=>n!=='baye.build.json')){const actual=report.sources['js/'+name],declared=report.engineManifest.artifacts[name];
        assert.equal(actual.bytes,declared.bytes);assert.equal(actual.sha256,declared.sha256,'actual engine manifest '+name);}
    assert.equal(report.sources['libs/dat-mod.lib'].sha256,standardSha);native=decodeOpening(snapshots.get('libs/dat-mod.lib').bytes);
    const references=path.join(artifactDir,'native-reference');fs.mkdirSync(references,{recursive:true});
    report.nativeResource={...native,pictures:native.pictures.map(({data,...p})=>{const bytes=nativePicture({...p,data}),filename='MAIN3-picture-'+p.picIndex+'.png';
        nativePixels[p.picIndex]=inspectPng(bytes,true).rgba;
        fs.writeFileSync(path.join(references,filename),bytes);return {...p,file:'native-reference/'+filename,sha256:sha(bytes)};}),libSha256:standardSha};
    fs.writeFileSync(path.join(references,'resource.json'),JSON.stringify(report.nativeResource,null,2)+'\n');
    const manifest=JSON.parse(snapshots.get('assets/hd-spe/manifest.json').bytes.toString('utf8'));report.manifest=manifest;
    mainEntry=manifest.entries.find(e=>e.speId===3&&e.resourceIndex===0&&e.kind===1&&e.startFrm===0&&e.endFrm===8)||null;
    if(!mainEntry){assert.ok(allowLcd,'strict MAIN acceptance requires the complete authenticated seven-slot MAIN manifest');return;}
    assert.equal(manifest.libSha256,standardSha);assert.equal(manifest.axScale,1);assert.equal(mainEntry.libSha256||manifest.libSha256,standardSha);
    assert.equal(mainEntry.resourceFingerprint,native.resourceFingerprint);assert.equal(mainEntry.resourceLength,native.resourceLength);
    assert.equal(mainEntry.count,native.count);assert.equal(mainEntry.picmax,native.picmax);assert.equal(mainEntry.units.length,9);assert.equal(mainEntry.pictures.length,7);
    assert.deepEqual(mainEntry.units,native.units.map(({frame,x,y,picIndex})=>({frame,x,y,picIndex})),'HD unit geometry exactly matches native MAIN');
    report.mainAssets=mainEntry.pictures.map(p=>{const original=native.pictures.find(n=>n.picIndex===p.picIndex);assert.ok(original);
        assert.equal(p.nativeWidth,original.width);assert.equal(p.nativeHeight,original.height);assert.equal(p.mask,original.mask);
        assert.equal(p.logicalWidth,original.width);assert.equal(p.logicalHeight,original.height);
        const file=snapshots.get(p.src);assert.ok(file,'genuine MAIN PNG '+p.src);const decoded=inspectPng(file.bytes);
        assert.equal(decoded.width,p.width);assert.equal(decoded.height,p.height);assert.ok(p.width>100&&p.height>100);
        if(original.mask)assert.ok(decoded.transparent>0&&decoded.opaque+decoded.partial>0,'title preserves transparency '+p.src);
        else assert.equal(decoded.transparent+decoded.partial,0,'opaque full background '+p.src);
        assert.notEqual(sha(file.bytes),report.nativeResource.pictures.find(n=>n.picIndex===p.picIndex).sha256,'HD art is not copied native PNG');
        return {...p,...decoded,sha256:file.metadata.sha256};});
    assert.equal(new Set(report.mainAssets.map(p=>p.picIndex)).size,7);
}
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

// Read-only observation of the actual renderer invocation, not a synthetic event.
const observer='('+function(){
    window.__r07={samples:[],captures:[],keys:[],errors:[],allDraws:[],visibility:[],preparations:[]};let api=null,currentDraws=null,send=null;
    const clone=x=>JSON.parse(JSON.stringify(x));
    const native=()=>{try{return window.baye&&baye.hd&&baye.hd.ready()?clone(baye.hd.spe()):null;}catch{return null;}};
    document.addEventListener('visibilitychange',()=>window.__r07.visibility.push({at:performance.now(),hidden:document.hidden,spe:native()}));
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image){
        const result=draw.apply(this,arguments);
        if(this.canvas.id==='hd-spe-canvas'&&image&&image.tagName==='IMG'){
            const op={src:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight,args:Array.from(arguments).slice(1)};
            if(currentDraws)currentDraws.push(op);else window.__r07.allDraws.push({at:performance.now(),spe:native(),hidden:document.hidden,...op});
        }return result;};
    function record(stage,before,img,w,h,draws){try{
        const spe=native();if(!spe)return;const ui=api&&clone(api.debugSnapshot());
        const sample={stage,at:performance.now(),spe,ui:ui&&{open:ui.open,source:ui.source,fallbackReason:ui.fallbackReason,displayedFrames:ui.displayedFrames,
            scale:ui.scale,flushKey:ui.flushKey,flushW:ui.flushW,flushH:ui.flushH,canvasW:ui.canvasW,canvasH:ui.canvasH,skipVisible:ui.skipVisible},hidden:document.hidden,draws:draws||[]};
        window.__r07.samples.push(sample);
        if(stage==='lcd-flush'&&spe.active&&spe.id===3&&spe.kind===1&&spe.display.frameValid){
            const lcd=document.createElement('canvas');lcd.width=w;lcd.height=h;lcd.getContext('2d').putImageData(img,0,0);
            const hd=document.getElementById('hd-spe-canvas'),after=native();
            const data=baye.data,paintColor=Number(data.g_paintColor),raster={scale:Number(data.g_scale),flip:Number(data.g_FlipDrawing),paintColor,
                paletteZero:Number(data.g_paintPalette[0])>>>0,palettePaint:Number(data.g_paintPalette[paintColor])>>>0};
            window.__r07.captures.push({at:sample.at,before:before.display,after:after.display,spe,ui:sample.ui,draws:sample.draws,raster,
                nativeWidth:w,nativeHeight:h,nativePng:lcd.toDataURL('image/png'),hdWidth:hd.width,hdHeight:hd.height,hdPng:hd.toDataURL('image/png'),hidden:document.hidden});
        }
        if(window.__r07.samples.length>2000||window.__r07.captures.length>500)throw new Error('Observation limit exceeded');
    }catch(error){window.__r07.errors.push(String(error));}}
    Object.defineProperty(window,'BayeHdSpe',{configurable:true,get(){return api;},set(value){api=value;
        if(typeof api.prepareStart==='function'){const original=api.prepareStart;api.prepareStart=function(callback,options){
            if(typeof callback!=='function')return original.apply(this,arguments);
            const call={at:performance.now(),keysBefore:window.__r07.keys.length,continuations:[]};window.__r07.preparations.push(call);
            // This continuation runs before _main. Record only the supplied
            // presentation result; do not query C, baye.data or debugSnapshot.
            return original.call(this,function(result){call.continuations.push({at:performance.now(),keysBefore:window.__r07.keys.length,result:clone(result)});
                return callback.apply(this,arguments);},options);};}
        for(const name of ['onEngineSpe','onLcdFlush']){const original=api[name];api[name]=function(){
            const before=native(),oldDraws=currentDraws,draws=[];if(name==='onLcdFlush')currentDraws=draws;
            let result;try{result=original.apply(this,arguments);}finally{currentDraws=oldDraws;
                record(name==='onLcdFlush'?'lcd-flush':'lifecycle',before,arguments[0],arguments[1],arguments[2],draws);}return result;};}
        if(!send&&typeof window.sendKey==='function'){send=window.sendKey;window.sendKey=function(code){const spe=native();
            window.__r07.keys.push({code,at:performance.now(),spe});return send.apply(this,arguments);};}
    }});
}.toString()+')();';
const stateExpression=`({spe:window.baye&&baye.hd&&baye.hd.ready()?baye.hd.spe():null,
    ui:window.BayeHdSpe?BayeHdSpe.debugSnapshot():null,identity:window.BayeHdLibIdentity?BayeHdLibIdentity.read():null,
    keys:window.__r07&&window.__r07.keys,hidden:document.hidden,system:window.BayeHdSystemUi?BayeHdSystemUi.debugSnapshot():null})`;
function frames(display){assert.equal(display.visibleFrames.length,32);assert.ok(display.visibleFrames.every(n=>Number.isInteger(n)&&n>=0&&n<=255));
    return Array.from({length:256},(_,i)=>i).filter(i=>(display.visibleFrames[i>>3]&(1<<(i&7)))!==0);}
const defaultRaster={scale:1,flip:0,paintColor:255,paletteZero:0x00ffffff,palettePaint:0xff000000};
function expectedNativePixels(visible,raster=defaultRaster){assert.deepEqual(raster,defaultRaster,'standard MAIN uses the observed native default raster/palette');
    const pixels=Buffer.alloc(160*96*4,255);
    for(const frame of visible){const unit=native.units[frame],picture=native.pictures[unit.picIndex],rgba=nativePixels[unit.picIndex];
        for(let y=0;y<picture.height;y++)for(let x=0;x<picture.width;x++){const px=unit.x+x,py=unit.y+y,o=(y*picture.width+x)*4;
            if(px>=0&&py>=0&&px<160&&py<96&&rgba[o+3]!==0)rgba.copy(pixels,(py*160+px)*4,o,o+4);}}
    // Native LCD conversion uses U32 RGBA palette entries, unlike readable
    // black/opaque-white resource references. Default white is alpha=0;
    // the browser PNG encoder canonicalizes its invisible RGB to zero.
    for(let i=0;i<pixels.length;i+=4){const color=pixels[i]===0?raster.palettePaint:raster.paletteZero,alpha=(color>>>24)&255;
        pixels[i]=alpha?color&255:0;pixels[i+1]=alpha?(color>>>8)&255:0;pixels[i+2]=alpha?(color>>>16)&255:0;pixels[i+3]=alpha;}
    return pixels;}
function assertNativePixels(bytes,visible,raster){const actual=inspectPng(bytes,true);assert.equal(actual.width,160);assert.equal(actual.height,96);
    const expected=expectedNativePixels(visible,raster);
    if(!actual.rgba.equals(expected)){const first=actual.rgba.findIndex((v,i)=>v!==expected[i]),pixel=Math.floor(first/4);
        assert.fail('Native pixel composition mismatch at '+(pixel%160)+','+Math.floor(pixel/160)+' channel '+(first%4)+': actual '+actual.rgba[first]+' expected '+expected[first]+'; visible '+visible.join(','));}
    return {width:160,height:96,rgbaSha256:sha(actual.rgba),expectedRgbaSha256:sha(expected),match:true};}
function validateCapture(c,standard=true){const s=c.spe,d=c.before;assert.deepEqual(c.before,c.after,'native display identity stayed identical during pixel+HD capture');
    assert.equal(s.protocolVersion,2);assert.equal(s.generation,d.generation);assert.equal(s.eventId,d.eventId);assert.equal(d.frameValid,true);
    assert.ok(d.commitSeq>0&&d.commitSeq<=s.commitSeq);
    const visible=frames(d);assert.ok(visible.every(i=>i>=s.startFrm&&i<=d.frameIndex&&i<=s.endFrm&&i<s.count));
    if(!standard){assert.equal(c.ui.source,'lcd','unknown actual LIB always uses the captured native LCD');assert.equal(c.draws.length,0);return visible;}
    assert.equal(s.protocolValid,true);assert.equal(s.resourceIndex,0);assert.equal(s.resourceFingerprint,native.resourceFingerprint);
    assert.equal(s.resourceLength,native.resourceLength);assert.equal(s.count,9);assert.equal(s.picmax,7);assert.equal(s.startFrm,0);assert.equal(s.endFrm,8);
    assert.equal(s.x,0);assert.equal(s.y,0);assert.equal(s.keyflag,1);assert.equal(s.skipEligible,true);
    if(c.ui.source==='hd-assets'){
        assert.deepEqual(c.ui.displayedFrames,visible,'actual HD renderer consumes the displayed native bitmap');
        assert.equal(c.draws.length,visible.length,'exactly one actual image draw for each visible native unit');
        for(let i=0;i<visible.length;i++){const u=native.units[visible[i]],p=mainEntry.pictures.find(p=>p.picIndex===u.picIndex),op=c.draws[i];
            assert.equal(op.src.replace(/^\//,''),p.src,'actual picture slot matches native display unit '+visible[i]);
            assert.equal(op.width,p.width);assert.equal(op.height,p.height);
            assert.deepEqual(op.args,[u.x*c.ui.scale,u.y*c.ui.scale,p.logicalWidth*c.ui.scale,p.logicalHeight*c.ui.scale],'native origin/size/order preserved');}
    }else assert.equal(c.draws.length,0,'LCD fallback never partially draws MAIN asset slots');
    return visible;}
const layoutExpression=`(() => {const read=selector=>{const n=document.querySelector(selector);if(!n)return null;const r=n.getBoundingClientRect(),s=getComputedStyle(n),
    x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
    visible:s.visibility==='visible'&&s.display!=='none',hit:t===n||n.contains(t)};};return {width:innerWidth,height:innerHeight,canvas:read('#hd-spe-canvas'),
    stage:read('.hd-spe-stage'),skip:read('#hd-spe-skip'),classic:read('[data-hd-spe-lcd]'),lcd:read('.container.js-baye-pc-lcd')};})()`;
async function checkpoint(cdp,name,extra={}){const state=await evaluate(cdp,stateExpression),layout=await evaluate(cdp,layoutExpression),filename=String(report.phases.length+1).padStart(2,'0')+'-'+name+'.png';
    const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,filename),Buffer.from(image.data,'base64'));
    report.phases.push({name,screenshot:filename,...extra,state,layout});console.log('PASS',name);return state;}
async function collect(cdp,name,standard=true){const evidence=await evaluate(cdp,'window.__r07');assert.deepEqual(evidence.errors,[],'read-only observer has no errors');
    const directory=path.join(artifactDir,name);fs.mkdirSync(directory,{recursive:true});
    evidence.captures=evidence.captures.map((c,i)=>{const visible=validateCapture(c,standard),prefix=String(i+1).padStart(3,'0')+'-commit-'+c.before.commitSeq+'-frame-'+c.before.frameIndex;
        const files={};for(const [key,pngKey] of [['native','nativePng'],['hd','hdPng']]){const bytes=Buffer.from(c[pngKey].split(',')[1],'base64'),file=name+'/'+prefix+'-'+key+'.png';
            if(key==='native'&&standard)c.nativePixels=assertNativePixels(bytes,visible,c.raster);
            fs.writeFileSync(path.join(artifactDir,file),bytes);files[key]={file,bytes:bytes.length,sha256:sha(bytes)};delete c[pngKey];}
        return {...c,visible,files};});
    const session={name,...evidence};report.sessions.push(session);fs.writeFileSync(path.join(directory,'observations.json'),JSON.stringify(session,null,2)+'\n');return session;}
async function navigate(cdp,origin,name,width=1920,height=1080){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await cdp.send('Page.navigate',{url:origin+'/pc.html?r07='+name+'&t='+Date.now()});
    await waitFor(cdp,'actual opening introduced',`window.__r07&&window.__r07.samples.some(r=>r.spe.active&&r.spe.id===3&&r.spe.kind===1)`,60000);
    return waitFor(cdp,'actual first displayed MAIN commit',`(() => {const c=window.__r07.captures[0];return c&&{generation:c.spe.generation,eventId:c.spe.eventId};})()`);}
async function complete(cdp,owner){return waitFor(cdp,'full natural MAIN completion',`(() => {const s=baye.hd.spe();return s.generation===${owner.generation}&&s.lastEnd.eventId===${owner.eventId}&&s.lastEnd.reason==='complete'&&s;})()`,60000);}
async function assertActualLib(cdp){const actual=await evaluate(cdp,'({hex:window.dynLib,identity:window.BayeHdLibIdentity?BayeHdLibIdentity.read():null})');
    assert.equal(typeof actual.hex,'string');const bytes=Buffer.from(actual.hex,'hex');assert.equal(sha(bytes),standardSha,'actual loaded bytes, independent of preferred path');
    return {sha256:sha(bytes),byteLength:bytes.length,identity:actual.identity};}
async function fullOpening(cdp,origin,name,width=1920,height=1080){const owner=await navigate(cdp,origin,name,width,height);
    await waitFor(cdp,'both native titles are naturally composited',`window.__r07.captures.some(c=>(c.before.visibleFrames[0]&0xc0)===0xc0)`);
    const layout=await evaluate(cdp,layoutExpression);assert.ok(layout.canvas.visible&&layout.canvas.width>0&&layout.canvas.height>0);
    assert.ok(layout.canvas.left>=0&&layout.canvas.top>=0&&layout.canvas.right<=width&&layout.canvas.bottom<=height,'opening canvas is inside the real viewport');
    for(const b of [layout.skip,layout.classic])assert.ok(b.visible&&b.hit&&b.height>=44&&b.bottom<=height,'opening footer is visible and unobstructed at '+width+'x'+height);
    const overlap=(a,b)=>Math.max(a.left,b.left)<Math.min(a.right,b.right)&&Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom);
    assert.equal(overlap(layout.canvas,layout.skip),false);assert.equal(overlap(layout.canvas,layout.classic),false);
    await checkpoint(cdp,name+'-titles');const ended=await complete(cdp,owner),actualLib=await assertActualLib(cdp),session=await collect(cdp,name);
    assert.deepEqual(session.keys,[],'complete opening has no player or automatic native input');assert.ok(session.captures.length>=5,'multiple actual LCD commits were captured');
    const first=session.captures[0],composite=session.captures.find(c=>c.visible.includes(5)&&c.visible.includes(6)&&c.visible.includes(7));
    assert.ok(composite,'native later background plus both transparent titles actually displayed together');
    const picturesSeen=[...new Set(session.captures.flatMap(c=>c.visible.map(i=>native.units[i].picIndex)))].sort((a,b)=>a-b);
    assert.deepEqual(picturesSeen,[0,1,2,3,4,5,6],'all seven native picture slots displayed through actual timer playback');
    if(!allowLcd){assert.equal(session.preparations.length,1,'one real pre-main preparation call');
        assert.equal(session.preparations[0].continuations.length,1,'one real native startup continuation');
        const prepared=session.preparations[0].continuations[0];assert.equal(prepared.keysBefore,0);assert.equal(prepared.result.ready,true);
        assert.equal(prepared.result.reason,'assets-ready');assert.equal(prepared.result.slots,7);assert.equal(prepared.result.libSha256,standardSha);
        assert.ok(session.captures.every(c=>c.ui.source==='hd-assets'),'every actual cold opening displayed commit uses authenticated HD assets');
        assert.equal(first.ui.source,'hd-assets','cold MAIN first actual display is HD');assert.equal(composite.ui.source,'hd-assets');}
    session.summary={owner,width,height,dpr:1,actualLib,ended:ended.lastEnd,displayedCommits:session.captures.length,
        logicalFrames:[...new Set(session.captures.map(c=>c.before.frameIndex))],picturesSeen,firstSource:first.ui.source,
        hdCommits:session.captures.filter(c=>c.ui.source==='hd-assets').length,compositeCommit:composite.before.commitSeq,layout};
    await waitFor(cdp,'completed MAIN UI retires',`!BayeHdSpe.isOpen()`);await checkpoint(cdp,name+'-completed',session.summary);return session;}
async function click(cdp,selector){const p=await evaluate(cdp,`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;
    const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,s=getComputedStyle(n),t=document.elementFromPoint(x,y);
    return {x,y,width:r.width,height:r.height,visible:s.display!=='none'&&s.visibility!=='hidden',hit:t===n||n.contains(t)};})()`);
    assert.ok(p?.visible&&p.hit&&p.width>0&&p.height>=44,'unobstructed actual button '+selector+' '+JSON.stringify(p));
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1});return p;}
async function skipOpening(cdp,origin){const owner=await navigate(cdp,origin,'one-skip',1280,720);
    await waitFor(cdp,'native skip button owns current MAIN',`BayeHdSpe.debugSnapshot().open&&BayeHdSpe.debugSnapshot().skipVisible`);
    await checkpoint(cdp,'720p-skip-button');const button=await click(cdp,'#hd-spe-skip');
    const end=await waitFor(cdp,'actual MAIN key end',`(() => {const s=baye.hd.spe();return s.generation===${owner.generation}&&s.lastEnd.eventId===${owner.eventId}&&s.lastEnd.reason==='key'&&s;})()`);
    assert.equal(end.lastEnd.key,39);await waitFor(cdp,'new title owner after skip',`baye.hd.spe().eventId!==${owner.eventId}&&!BayeHdSpe.isOpen()`);
    const keysBefore=await evaluate(cdp,'window.__r07.keys.length');assert.equal(await evaluate(cdp,'BayeHdSpe.skip()'),false,'retired opening API cannot send into title');
    await delay(400);assert.equal(await evaluate(cdp,'window.__r07.keys.length'),keysBefore,'no queued key leaks into new native owner');
    const session=await collect(cdp,'one-skip');assert.deepEqual(session.keys.map(k=>k.code),[39],'one actual pointer skip delivers one native Enter');
    assert.equal(session.keys[0].spe.eventId,owner.eventId);session.summary={owner,button,ended:end.lastEnd};await checkpoint(cdp,'one-skip-retired',session.summary);}

async function presentationLifecycle(cdp,origin){const owner=await navigate(cdp,origin,'mode-resize',1280,720);
    const before=await evaluate(cdp,stateExpression);await click(cdp,'[data-hd-spe-lcd]');
    await waitFor(cdp,'classic opening overlay exits',`!BayeHdSpe.isOpen()`);const classic=await evaluate(cdp,stateExpression),classicLayout=await evaluate(cdp,layoutExpression);
    assert.deepEqual(classic.keys,[]);assert.equal(classic.spe.eventId,owner.eventId);assert.ok(classicLayout.lcd.visible&&classicLayout.lcd.width>0&&classicLayout.lcd.hit,
        'classic LCD is visible and is the actual top paint/hit layer at its center');
    await checkpoint(cdp,'720p-classic-opening');
    await evaluate(cdp,`BayeHdSystemUi.setMode('hd')`);
    await waitFor(cdp,'HD opening reenters same native event',`baye.hd.spe().eventId===${owner.eventId}&&BayeHdSpe.isOpen()`);
    const restored=await evaluate(cdp,stateExpression);assert.deepEqual(restored.keys,[]);assert.equal(restored.spe.generation,owner.generation);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    const resized=await evaluate(cdp,stateExpression);assert.equal(resized.spe.eventId,owner.eventId);assert.deepEqual(resized.keys,[]);
    const ended=await complete(cdp,owner),session=await collect(cdp,'mode-resize');assert.deepEqual(session.keys,[]);
    assert.ok(session.captures.every(c=>c.spe.generation===owner.generation&&c.spe.eventId===owner.eventId));
    session.summary={owner,before:before.spe.display,classic:classic.spe.display,restored:restored.spe.display,resized:resized.spe.display,
        classicLcd:classicLayout.lcd,ended:ended.lastEnd,zeroNativeKeys:true};await checkpoint(cdp,'mode-resize-complete',session.summary);}

async function hiddenLifecycle(cdp,origin,targetId){const owner=await navigate(cdp,origin,'hidden-restore',1280,720);
    // A separate owned tab is activated through CDP. If the headless browser
    // does not expose tab visibility, preserve that fact and test the documented
    // visibility event fallback, rather than calling it real backgrounding.
    const other=await cdp.send('Target.createTarget',{url:'about:blank'});let method='actual-tab-activation';
    try{await cdp.send('Target.activateTarget',{targetId:other.targetId});await delay(25);
        let hidden=await evaluate(cdp,'document.hidden');
        if(!hidden){method='explicit-document-visibility-simulation';await evaluate(cdp,`(() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
            document.dispatchEvent(new Event('visibilitychange'));})()`);hidden=await evaluate(cdp,'document.hidden');}
        assert.equal(hidden,true);const hiddenState=await evaluate(cdp,stateExpression);assert.equal(hiddenState.ui.open,false);assert.deepEqual(hiddenState.keys,[]);
        await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await delay(80);await cdp.send('Page.setWebLifecycleState',{state:'active'});
        await cdp.send('Target.activateTarget',{targetId});
        if(method==='explicit-document-visibility-simulation')await evaluate(cdp,`(() => {delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));})()`);
        await waitFor(cdp,'visible opening reenters same owner',`!document.hidden&&baye.hd.spe().eventId===${owner.eventId}&&BayeHdSpe.isOpen()`);
        const restored=await evaluate(cdp,stateExpression);assert.equal(restored.spe.generation,owner.generation);assert.deepEqual(restored.keys,[]);
        await checkpoint(cdp,'720p-hidden-restored',{method,hiddenState,restored});const ended=await complete(cdp,owner),session=await collect(cdp,'hidden-restore');
        assert.deepEqual(session.keys,[]);assert.ok(session.visibility.some(v=>v.hidden)&&session.visibility.some(v=>!v.hidden));
        const hiddenCaptures=session.captures.filter(c=>c.hidden);
        assert.ok(hiddenCaptures.every(c=>c.ui.open===false&&c.draws.length===0),'any actual hidden LCD commit has no HD draws');
        assert.ok(session.allDraws.every(d=>!d.hidden),'no independently triggered HD image draw occurs while hidden');
        session.summary={owner,visibilityMethod:method,actualFreezeActive:true,hiddenCapturedCommits:hiddenCaptures.length,
            ended:ended.lastEnd,zeroNativeKeys:true};await checkpoint(cdp,'hidden-restore-complete',session.summary);
    }finally{await cdp.send('Page.setWebLifecycleState',{state:'active'}).catch(()=>{});await cdp.send('Target.closeTarget',{targetId:other.targetId}).catch(()=>{});}}

async function controlledFailure(cdp,origin,kind){assert.ok(mainEntry);const failedPath=mainEntry.pictures.find(p=>p.picIndex===4).src;
    const requestStart=report.requests.length;
    if(kind==='missing')missing.add(failedPath);else delayedPaths.add(failedPath);
    try{const owner=await navigate(cdp,origin,kind+'-png');const ended=await complete(cdp,owner);
        const before=await evaluate(cdp,stateExpression),session=await collect(cdp,kind+'-png');
        assert.deepEqual(session.keys,[]);assert.ok(session.captures.length>0);assert.ok(session.captures.every(c=>c.ui.source==='lcd'&&c.draws.length===0),
            'incomplete seven-slot load uses only the actual complete LCD capture');
        assert.equal(session.preparations.length,1);assert.equal(session.preparations[0].continuations.length,1,'failed preload continues native startup exactly once');
        const prepared=session.preparations[0].continuations[0];assert.equal(prepared.keysBefore,0);assert.equal(prepared.result.ready,false);
        assert.equal(prepared.result.reason,kind==='missing'?'asset-load-failed':'timeout');
        assert.ok(prepared.result.elapsedMs<=10000,'actual failed preparation has a bounded startup wait');
        assert.ok(report.requests.slice(requestStart).some(r=>r.path==='/'+failedPath&&(kind==='missing'?r.status===404:r.delayed)),
            'the controlled HTTP failure really intercepted the requested PNG');
        if(kind==='delayed'){releaseImages();await delay(600);const after=await evaluate(cdp,stateExpression);
            assert.equal(after.ui.open,false,'late PNG cannot reopen a retired opening over the title');assert.deepEqual(after.keys,[]);
            assert.ok(after.spe.eventId!==owner.eventId);const later=await evaluate(cdp,'window.__r07.allDraws');
            assert.equal(later.filter(d=>d.at>session.captures.at(-1).at&&d.spe?.eventId!==owner.eventId).length,0,'no late image draw into a different native owner');
            session.afterRelease={state:after,allDraws:later};}
        session.summary={owner,kind,path:failedPath,ended:ended.lastEnd,fallbackOnly:true,hdAccepted:false,finalOwner:before.spe.eventId};
        await checkpoint(cdp,kind+'-png-native-completed',session.summary);
    }finally{missing.delete(failedPath);releaseImages();}}

async function enter(cdp){for(const type of ['keyDown','keyUp'])await cdp.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});}
async function unknownOpening(cdp,origin){await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    const requestStart=report.requests.length;await cdp.send('Page.navigate',{url:origin+'/pc.html?r07-unknown=1&t='+Date.now()});
    await waitFor(cdp,'actual Mod bridge ready',`window.baye&&baye.hd&&baye.hd.ready()`,60000);
    const identity=await waitFor(cdp,'actual Mod bytes hashed',`BayeHdLibIdentity.read().status==='ready'&&BayeHdLibIdentity.read()`);
    const loaded=await evaluate(cdp,'window.dynLib');assert.equal(sha(Buffer.from(loaded,'hex')),report.sources['libs/sc-mod.lib'].sha256);
    assert.equal(identity.sha256,report.sources['libs/sc-mod.lib'].sha256);assert.notEqual(identity.sha256,standardSha);
    const owner=await waitFor(cdp,'actual Mod MAIN shown',`(() => {const c=window.__r07.captures[0];return c&&{eventId:c.spe.eventId,generation:c.spe.generation};})()`);
    const end=await complete(cdp,owner),session=await collect(cdp,'actual-unknown-lib',false);assert.deepEqual(session.keys,[]);
    assert.ok(session.captures.length>0);if(mainEntry)assert.equal(report.requests.slice(requestStart).filter(r=>mainEntry.pictures.some(p=>r.path==='/'+p.src)).length,0,
        'actual unknown LIB never fetches standard MAIN art');
    await waitFor(cdp,'actual Mod title',`window.__r07.samples.some(r=>r.spe.id===100)`);const before=await evaluate(cdp,'window.__r07.keys.length');
    await enter(cdp);await waitFor(cdp,'actual Mod native period chooser',`window.__r07.samples.some(r=>r.spe.id===104)`);
    assert.equal(await evaluate(cdp,'window.__r07.keys.length'),before+1,'actual unknown LIB native title input remains playable');
    session.nativeTitleInput=await evaluate(cdp,'({keys:window.__r07.keys,spe:baye.hd.spe(),ui:BayeHdSpe.debugSnapshot()})');
    session.summary={identity,owner,ended:end.lastEnd,openingAndNativeTitleOnly:true,fullModNewGame:false,fullModBattle:false};await checkpoint(cdp,'actual-unknown-lib-native-period',session.summary);}

async function main(){fs.mkdirSync(artifactDir,{recursive:true});assert.equal(typeof WebSocket,'function','Node22+ built-in WebSocket');
    let server,unknownServer,chrome,cdp,profile,chromeError;const interrupt=()=>{report.interrupted=true;cdp?.close();if(chrome&&chrome.exitCode===null)chrome.kill('SIGTERM');server?.closeAllConnections();unknownServer?.closeAllConnections();};
    process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{if(verifyCaptured){freeze('libs/dat-mod.lib');assert.equal(report.sources['libs/dat-mod.lib'].sha256,standardSha);
            const runner=fs.readFileSync(fileURLToPath(import.meta.url));report.runner={bytes:runner.length,sha256:sha(runner)};
            native=decodeOpening(snapshots.get('libs/dat-mod.lib').bytes);nativePixels=native.pictures.map(p=>inspectPng(nativePicture(p),true).rgba);
            const archive=path.resolve(verifyCaptured),r=JSON.parse(fs.readFileSync(path.join(archive,'result.json'),'utf8'));assert.equal(r.nativeResource.libSha256,standardSha);
            report.scope='Offline revalidation of saved actual native LCD pixels against authenticated LIB slots; no HD acceptance';report.pixelChecks=[];
            for(const session of r.sessions)for(const c of session.captures){if(c.spe.resourceFingerprint!==native.resourceFingerprint)continue;
                const filename=path.resolve(archive,c.files.native.file);assert.ok(filename.startsWith(archive+path.sep),'saved image is inside its archive');
                const bytes=fs.readFileSync(filename);assert.equal(sha(bytes),c.files.native.sha256,'recorded actual PNG bytes stay unchanged');
                assert.deepEqual(c.before,c.after);report.pixelChecks.push({session:session.name,file:c.files.native.file,display:c.before,raster:c.raster||defaultRaster,
                    ...assertNativePixels(bytes,frames(c.before),c.raster)});}
            assert.ok(report.pixelChecks.length>0);report.ok=true;console.log('PASS',report.pixelChecks.length,'archived native LCD pixel compositions');return;}
        prepareAssets();console.log('Frozen',Object.keys(report.sources).length,'sources; runner',report.runner.sha256);
        server=await startServer();if(!allowLcd||unknownOnly)unknownServer=await startServer();const origin='http://127.0.0.1:'+server.address().port,
            unknownOrigin=unknownServer?'http://127.0.0.1:'+unknownServer.address().port:null,debugPort=await unusedPort();
        assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);if(unknownServer)assert.notEqual(unknownServer.address().port,8080);
        profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-opening-runtime-'));const candidates=['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome'];
        const binary=process.env.CHROME||candidates.find(filename=>fs.existsSync(filename));assert.ok(binary,'Set CHROME to a Chromium executable');
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking',
            '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
            '--window-size=1920,1080','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
        chrome.on('error',error=>{chromeError=error;});report.isolation={httpPort:server.address().port,unknownHttpPort:unknownServer?.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};
        let target;for(const deadline=Date.now()+20000;Date.now()<deadline;){if(chromeError)throw chromeError;if(chrome.exitCode!==null)throw new Error('Chrome exited '+chrome.exitCode);
            try{target=(await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json())).find(t=>t.type==='page');if(target)break;}catch{}await delay(100);}
        assert.ok(target);cdp=await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));cdp.on('Runtime.consoleAPICalled',e=>{report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')});if(report.console.length>200)report.console.shift();});
        cdp.on('Page.javascriptDialogOpening',e=>{report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});
        cdp.on('Fetch.requestPaused',e=>{const requestOrigin=new URL(e.request.url).origin,local=requestOrigin===origin||requestOrigin===unknownOrigin;if(!local)report.blocked.push(e.request.url);
            cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});report.browser=await cdp.send('Browser.getVersion');
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('baye/libpath',location.origin===${JSON.stringify(unknownOrigin)}?'libs/sc-mod.lib':'libs/dat-mod.lib');
            localStorage.setItem('baye/systemUiMode','hd');localStorage.setItem('baye/overworldMode','classic');localStorage.setItem('baye/cityMenuMode','classic');`});
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:observer});
        if(unknownOnly)await unknownOpening(cdp,unknownOrigin);
        else{await fullOpening(cdp,origin,'cold-main-1080p');await fullOpening(cdp,origin,'cold-main-720p',1280,720);await skipOpening(cdp,origin);
            await presentationLifecycle(cdp,origin);await hiddenLifecycle(cdp,origin,target.id);
            if(!allowLcd){await controlledFailure(cdp,origin,'missing');await controlledFailure(cdp,origin,'delayed');await unknownOpening(cdp,unknownOrigin);
                await fullOpening(cdp,origin,'standard-restored',1280,720);}}
        assert.deepEqual(report.exceptions,[],'no uncaught browser exceptions');assert.deepEqual(report.dialogs,[],'no unexpected game dialogs');assert.deepEqual(report.serverErrors||[],[]);
        report.ok=true;report.hdAccepted=!allowLcd;
    }catch(error){report.ok=false;report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;
        if(cdp){try{report.failureState=await evaluate(cdp,stateExpression);await collect(cdp,'failure-observations');}catch(error){report.failureObservationError=String(error);}
            try{const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(image.data,'base64'));}catch{}}
    }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);releaseImages();cdp?.close();
        if(chrome&&chrome.exitCode===null){const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([stopped,delay(1500)]);
            if(chrome.exitCode===null){chrome.kill('SIGKILL');await Promise.race([stopped,delay(1500)]);}}
        for(const s of [server,unknownServer])if(s){s.closeAllConnections();await new Promise(resolve=>s.close(resolve));}
        if(profile){const absolute=path.resolve(profile);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('baye-opening-runtime-'));
            fs.rmSync(absolute,{recursive:true,force:true,maxRetries:5,retryDelay:100});report.isolation.cleaned=!fs.existsSync(absolute);}
        const sources=Object.entries(report.sources).map(([name,s])=>{const filename=path.join(root,s.source);return {path:name,...s,
            match:fs.existsSync(filename)&&sha(fs.readFileSync(filename))===s.sha256};});
        const runnerBytes=fs.readFileSync(fileURLToPath(import.meta.url)),runnerMatch=report.runner&&sha(runnerBytes)===report.runner.sha256;
        const added=verifyCaptured?[]:productionDirectories.flatMap(directory=>walk(path.join(root,directory))).map(filename=>path.relative(root,filename).replaceAll('\\','/')).filter(rel=>!snapshots.has(rel));
        const verification={ok:sources.every(s=>s.match)&&!!runnerMatch&&added.length===0,count:sources.length,runnerMatch,added,sources};
        fs.writeFileSync(path.join(artifactDir,'source-verification.json'),JSON.stringify(verification,null,2)+'\n');
        report.sourceVerification={ok:verification.ok,count:verification.count,runnerMatch,added,drift:sources.filter(s=>!s.match).map(s=>s.path)};
        if(!verification.ok){report.ok=false;report.sourceError='Frozen source or runner changed/missing during acceptance';process.exitCode=1;}
        for(const session of report.sessions)fs.writeFileSync(path.join(artifactDir,session.name,'observations.json'),JSON.stringify(session,null,2)+'\n');
        report.hdAccepted=report.ok===true&&!allowLcd&&!verifyCaptured;
        report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(report,null,2)+'\n');
        console.log('Artifacts:',artifactDir);if(report.ok)console.log(allowLcd||verifyCaptured?'Native LCD baseline passed; HD is NOT accepted':'Strict full MAIN HD acceptance passed');
    }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
