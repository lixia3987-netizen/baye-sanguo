#!/usr/bin/env node
/** Genuine original P4 ruler and full-ROM-maximum names; trusted PC/mobile inputs, fresh private browser only. */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {snapshotOwnedChrome,cleanupOwnedChrome} from './hd-runtime-owned-chrome.mjs';
import {writeJsonAtomicSync} from './hd-runtime-json.mjs';
import {checkPersonIdentity} from './hd-person-identity-runtime-checks.mjs';
import {readOriginalPersonIdentityRom} from './hd-person-identity-rom.mjs';
import {createMobileDetailRuntimeDriver} from './hd-mobile-preview-runtime-checks.mjs';
import {runForeignPersonRoles} from './hd-person-roles-runtime-checks.mjs';
import {runPersonLocationRoles} from './hd-person-location-runtime-checks.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const flags=new Set(['--720','--mobile844','--mobile667','--foreign-ownership','--person-location','--preflight-only']);for(let i=2;i<process.argv.length;i++){const flag=process.argv[i];if(flag==='--artifact-dir'||flag==='--city-menu-source'){assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing --artifact-dir value');i++;}else assert.ok(flags.has(flag),'Unknown option: '+flag);}

const preflightOnly=process.argv.includes('--preflight-only'),locationOnly=process.argv.includes('--person-location'),foreignOnly=locationOnly||process.argv.includes('--foreign-ownership');
const variantArg=process.argv.indexOf('--city-menu-source'),cityMenuSource=variantArg<0?null:path.resolve(process.argv[variantArg+1]);if(cityMenuSource){assert.ok(foreignOnly,'Explicit baseline source is limited to the foreign-ownership check');assert.ok(cityMenuSource.startsWith(path.resolve(root,locationOnly?'build/person-location-20261026-v72/before':'build/person-roles-20261026-v71/before')+path.sep),'Baseline source stays in the explicit task snapshot');assert.ok(fs.lstatSync(cityMenuSource).isFile()&&!fs.lstatSync(cityMenuSource).isSymbolicLink());}
const artifactFlag=process.argv.indexOf('--artifact-dir'),artifactDir=path.resolve(artifactFlag>=0?process.argv[artifactFlag+1]:path.join(root,'build/pc-person-identity-runtime'));
assert.ok(['--720','--mobile844','--mobile667'].filter(f=>process.argv.includes(f)).length<=1,'Choose one layout');
const mobile=process.argv.includes('--mobile844')||process.argv.includes('--mobile667'),layout=process.argv.includes('--mobile667')?'mobile667':process.argv.includes('--mobile844')?'mobile844':process.argv.includes('--720')?'pc720':'pc1080';
const viewport=layout==='mobile667'?{width:667,height:375}:layout==='mobile844'?{width:844,height:390}:layout==='pc720'?{width:1280,height:720}:{width:1920,height:1080};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const report={scenario:locationOnly?"original-p4-person-city-location":foreignOnly?"original-p4-foreign-person-identity":"original-p4-person-identity",locationOnly,foreignOnly,layout,mobile,preflightOnly,viewport,accepted:false,identityAccepted:false,hdAccepted:false,startedAt:new Date().toISOString(),phases:[],console:[],log:[],exceptions:[],dialogs:[],blocked:[],requests:[],inputs:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.lib':'application/octet-stream','.ttf':'font/ttf'};
const servedAssets=new Map(),productionDirectories=['js','css','assets','vendor/iBaye'];let nativeLib;
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
const targetName=()=>path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/');
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(i=>i.isDirectory()?walk(path.join(directory,i.name)):[path.join(directory,i.name)]);}
function freezeAsset(rel) {
    assert.equal(typeof rel,'string');assert.ok(!path.isAbsolute(rel) && !rel.split('/').includes('..'),'Frozen asset path stays in this repository');
    if(servedAssets.has(rel))return servedAssets.get(rel);
    const source=rel==='js/hd-city-menu.js'&&cityMenuSource?path.relative(root,cityMenuSource).replaceAll('\\','/'):rel,data=fs.readFileSync(path.join(root,source)),metadata={source,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};if(source!==rel)report.sourceVariant={servedAs:rel,...metadata};
    report.sources[rel]=metadata;servedAssets.set(rel,{data,metadata});return servedAssets.get(rel);
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
        if(report.interrupted)throw Error('Interrupted');
        const value = await evaluate(cdp, expression);
        if (value) return value;
        await delay(150);
    }
    throw new Error('Timed out waiting for ' + description);
}

function prepareServedAssets(){
 report.sources={};for(const dir of productionDirectories)for(const filename of walk(path.join(root,dir)))freezeAsset(path.relative(root,filename).replaceAll('\\','/'));
 for(const rel of ['package.json','.gitattributes','scripts/hd-runtime-owned-chrome.mjs','scripts/hd-runtime-json.mjs','scripts/hd-person-identity-runtime-checks.mjs','scripts/hd-person-identity-rom.mjs','scripts/hd-mobile-preview-runtime-checks.mjs','scripts/hd-person-roles-runtime-checks.mjs','scripts/hd-person-location-runtime-checks.mjs','scripts/write-wasm-manifest.mjs','pc.html','m.html','fonts/HarmonyOS_Sans_SC_Regular.ttf','favicon.png','qr.png',targetName()])freezeAsset(rel);
 nativeLib=freezeAsset('libs/dat-mod.lib').data;assert.equal(nativeLib.length,207195);assert.equal(sha(nativeLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 const build=JSON.parse(freezeAsset('js/baye.build.json').data);for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const s=freezeAsset('js/'+name);assert.equal(s.data.length,build.artifacts[name].bytes);assert.equal(s.metadata.sha256,build.artifacts[name].sha256);}
 // The build-generated version.h is frozen/served but excluded from the native manifest's source aggregate.
 const names=walk(path.join(root,'vendor/iBaye')).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(f=>f!=='vendor/iBaye/src/baye/version.h').sort(),hash=crypto.createHash('sha256'),files=[];
 for(const name of names){const s=freezeAsset(name);hash.update(name+'\0');hash.update(s.data);files.push({name,...s.metadata});}assert.equal(names.length,128);report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),manifest:build.engineSourceSha256,files};assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256);
 const font='fonts/HarmonyOS_Sans_SC_Regular.ttf';report.fontSource=freezeAsset(font).metadata;report.engineManifest=build;report.tool=freezeAsset(targetName()).metadata;
 for(const [source,dest] of [[targetName(),'executed-tool.mjs'],['scripts/hd-person-identity-runtime-checks.mjs','executed-checks.mjs'],['scripts/hd-person-identity-rom.mjs','executed-rom.mjs'],['scripts/hd-person-roles-runtime-checks.mjs','executed-roles-helper.mjs'],['scripts/hd-person-location-runtime-checks.mjs','executed-location-helper.mjs'],['js/hd-city-menu.js','executed-city-menu.js'],['scripts/hd-mobile-preview-runtime-checks.mjs','executed-preview-helper.mjs'],['scripts/hd-runtime-owned-chrome.mjs','executed-owned-chrome.mjs'],['scripts/hd-runtime-json.mjs','executed-json.mjs']])fs.writeFileSync(path.join(artifactDir,dest),freezeAsset(source).data,{flag:'wx'});
}
async function startServer(){
 const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'pc.html';
 const s=servedAssets.get(rel);if(!s){report.requests.push({url:url.pathname,status:404,expected:rel==='favicon.ico'});res.writeHead(404).end();return;}
 report.requests.push({url:url.pathname,status:200,...s.metadata});res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(s.data);
 }catch(e){report.requests.push({url:req.url,status:400,error:String(e)});res.writeHead(400).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;
}
const identityObserverSource="(function(){\n window.__identityKeys=[];window.__identityTouches=[];window.__identityCalls=[];window.__identityEvents=[];\n let depth=0;for(const[object,name,api]of[[window,'sendKey','window.sendKey'],[baye,'sendKey','baye.sendKey']]){const old=object[name];if(typeof old!=='function')throw Error('Missing public native input');object[name]=function(code){const outer=depth++===0;try{return old.apply(this,arguments);}finally{depth--;window.__identityCalls.push({api,code,at:performance.now(),depth});if(outer)window.__identityKeys.push(code);}};}\n if(typeof window._bayeSendTouchEvent!=='function')throw Error('Missing real touch binding');const touch=window._bayeSendTouchEvent;window._bayeSendTouchEvent=function(){window.__identityTouches.push(Array.from(arguments));return touch.apply(this,arguments);};\n for(const type of ['pointerdown','pointerup','click','keydown','keyup','wheel','touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{if(e.isTrusted)window.__identityEvents.push({type,key:e.key||null,x:e.clientX||0,y:e.clientY||0,target:e.target.id||e.target.tagName,at:performance.now()});},true);\n window.__identitySample=function(){\n  const d=baye.data,a=BayeHdLibIdentity.read();\n  const take=(o,ks)=>Object.fromEntries(ks.map(k=>{const v=Number(o[k]);if(!Number.isInteger(v))throw Error('Noninteger native '+k);return[k,v];}));\n  const world=()=>{const n=Number(baye.getPersonCount()),nc=Number(d.g_engineConfig.citiesCount);if(n!==200||nc!==38||Number(baye.getToolCount())!==33)throw Error('Original world ABI counts');return {config:take(d.g_engineConfig,['citiesCount','enable16bitConsumeMoney','fixAlienateComsumeThew']),period:Number(d.g_PIdx),king:Number(d.g_PlayerKing),year:Number(d.g_YearDate),month:Number(d.g_MonthDate),people:Array.from({length:200},(_,i)=>take(d.g_Persons[i],['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'])),cities:Array.from({length:38},(_,i)=>take(d.g_Cities[i],['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons','Tools','ToolQueue'])),queue:Array.from(d.g_PersonsQueue,Number),goodsQueue:Array.from(d.g_GoodsQueue,Number),fighters:Array.from(d.FIGHTERS,Number),fighterIndex:Array.from(d.FIGHTERS_IDX,Number),orders:Array.from(d.g_OrderQueue,o=>take(o,['OrderId','City','Person','Object','TimeCount','Food','Arms','Money','Consume'])),tools:Array.from({length:33},(_,i)=>take(d.g_Tools[i],['useflag','changeAttackRange','at','iq','move','arm']))};};\n  const native=()=>({generation:Number(d.g_hdDetailGeneration),mapCity:Number(d.g_hdMapCity),mapPick:Number(d.g_hdMapPick),cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},menu:baye.hd.menuItems(),march:baye.hd.march(),report:baye.hd.report(),qty:baye.hd.qty(),person:baye.hd.personProperties(),diplomacy:baye.hd.diplomacy()});\n  const before=native(),w=world(),cityUi=BayeHdCityMenu.debugSnapshot(),after=native(),w2=world(),b=BayeHdLibIdentity.read();\n  if(d!==baye.data||a.status!=='ready'||a.sha256!=='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'||JSON.stringify(a)!==JSON.stringify(b)||JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(w)!==JSON.stringify(w2))throw Error('Unstable original native/person/world sample');\n  if(w.queue.length!==2000||w.goodsQueue.length!==2000||w.fighters.length!==600||w.fighterIndex.length!==30||w.orders.length!==200)throw Error('Truncated original world arrays'); for(const name of ['queue','goodsQueue','fighters','fighterIndex'])if(!w[name].every(Number.isInteger))throw Error('Invalid native '+name);\n  return {world:w,native:after,state:{menu:after.menu,cityUi,qty:after.qty,report:after.report,keyCount:window.__identityKeys.length,touchCount:window.__identityTouches.length},identity:a};\n };\n return {keys:true,touch:true,forwardOnce:true};\n})()";
const identityGeometrySource="function(selector){const n=document.querySelector(selector);if(!n)return null;const r=n.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight};let shown=!n.hidden,scroll=null;for(let q=n;q;q=q.parentElement){const s=getComputedStyle(q);if(q.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)<=0)shown=false;// BODY/HTML overflow propagates to the viewport; their normal-flow boxes do not clip fixed HD layers.\nconst viewportRoot=q===document.body||q===document.documentElement;if(!viewportRoot&&q!==n&&/(auto|scroll|hidden|clip)/.test(s.overflowY+' '+s.overflowX)){const p=q.getBoundingClientRect();clip.left=Math.max(clip.left,p.left);clip.top=Math.max(clip.top,p.top);clip.right=Math.min(clip.right,p.right);clip.bottom=Math.min(clip.bottom,p.bottom);}if(!viewportRoot&&!scroll&&q!==n&&/(auto|scroll)/.test(s.overflowY)&&q.scrollHeight>q.clientHeight+1){const p=q.getBoundingClientRect();scroll={left:p.left,top:p.top,right:p.right,bottom:p.bottom,topValue:q.scrollTop,max:q.scrollHeight-q.clientHeight};}}const visible=shown&&r.width>0&&r.height>0&&r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5,x=Math.max(clip.left,Math.min(clip.right,r.left+r.width/2)),y=Math.max(clip.top,Math.min(clip.bottom,r.top+r.height/2)),top=document.elementFromPoint(x,y);return {visible,shown,hit:!!top&&(top===n||n.contains(top)),disabled:!!n.disabled,text:n.textContent,x,y,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},clip,scroll};}";


async function identitySmoke(cdp){
 const ev=expression=>evaluate(cdp,expression),until=(label,expression,timeout)=>waitFor(cdp,label,expression,timeout);
 await until('actual original LIB identity',"window.BayeHdLibIdentity&&BayeHdLibIdentity.read().status==='ready'&&BayeHdLibIdentity.read().sha256==='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'&&typeof dynLib==='string'&&dynLib.length===414390",60000);
 await until('original native engine ready','window.baye&&baye.hd&&baye.hd.ready()',60000);await observeActualLib(cdp,'startup');report.inputObserver=await ev(identityObserverSource);
 const rawRom=readOriginalPersonIdentityRom(nativeLib,4),rom={...rawRom,names:rawRom.names200};report.rom=rom;const setup={lordId:foreignOnly?0:3,lordName:foreignOnly?'曹丕':'孟获',cityIndex:foreignOnly?4:30,cityName:foreignOnly?'晋阳':'云南'};report.setup=setup;
 async function snap(label){const png=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'),file=layout+'-identity-'+String(report.phases.length).padStart(2,'0')+'-'+label+'.png';fs.writeFileSync(path.join(artifactDir,file),png,{flag:'wx'});const entry={label,file,bytes:png.length,sha256:sha(png),sample:await ev('__identitySample()')};report.phases.push(entry);await sampleOwned('checkpoint-'+label);return entry;}
 const geometry=selector=>ev('('+identityGeometrySource+')('+JSON.stringify(selector)+')');
 async function touches(type,points=[]){for(const p of points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<viewport.width&&p.y<viewport.height);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({...p,id:i,radiusX:2,radiusY:2,force:1}))});report.inputs.push({type:'cdp-'+type,points});await delay(80);}
 async function tap(x,y){await touches('touchStart',[{x,y}]);await touches('touchEnd');}
 async function mouse(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<viewport.width&&y<viewport.height);if(mobile)return tap(x,y);await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x,y});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x,y});report.inputs.push({type:'cdp-mouse-click',x,y});}
 async function revealPc(selector,{control=true}={}){let last=null;try{for(let n=0;n<35;n++){const g=await geometry(selector);last=g;assert.ok(g&&g.shown,'Actual displayed DOM '+selector);if(g.visible&&g.hit){if(control)assert.equal(g.disabled,false);return g;}assert.ok(g.scroll,'A real scroll container must reveal '+selector);const s=g.scroll,x=(Math.max(0,s.left)+Math.min(viewport.width,s.right))/2,y=(Math.max(0,s.top)+Math.min(viewport.height,s.bottom))/2,deltaY=g.rect.top<g.clip.top?-Math.min(260,g.clip.top-g.rect.top+40):Math.min(260,g.rect.bottom-g.clip.bottom+40);assert.ok(deltaY!==0);assert.ok(await ev('(() => {const n=document.elementFromPoint('+x+','+y+');return n&&n.closest("#hd-city-menu");})()'),'Wheel begins in actual HD panel');await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY});report.inputs.push({type:'cdp-wheel',selector,x,y,deltaY});await delay(100);}throw Error('Bounded wheel did not reveal '+selector);}catch(error){report.geometryFailures??=[];report.geometryFailures.push({selector,control,geometry:last,error:error.message});throw error;}}
 let reveal=revealPc;
 async function click(selector){if(mobile){const settled=await until('actually shown enabled current mobile control '+selector,'(() => {const n=document.querySelector('+JSON.stringify(selector)+');if(!n||!n.isConnected||n.disabled)return false;for(let p=n;p;p=p.parentElement){const c=getComputedStyle(p);if(p.hidden||c.display==="none"||c.visibility==="hidden"||Number(c.opacity)===0)return false;}const r=n.getBoundingClientRect(),s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();return r.width>0&&r.height>0&&s.open&&s.showHd&&!s.sending&&!s.queueLen&&m.active===1&&m.context===1&&{shown:true,disabled:n.disabled,menu:m,layer:s.layer,rect:{left:r.left,top:r.top,width:r.width,height:r.height}};})()');report.controlReadiness??=[];report.controlReadiness.push({selector,settled});}const g=await reveal(selector),last=await geometry(selector);assert.ok(last.visible&&last.hit&&!last.disabled);await mouse(last.x,last.y);}
 async function arrow(name){const vk={ArrowUp:38,ArrowDown:40}[name];assert.ok(vk);await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});report.inputs.push({type:'cdp-key',key:name});}
 async function bootKey(code,label){await ev('sendKey('+code+')');report.inputs.push({type:'public-title-key',code,label});}
 await until('actual native title','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1',60000);await bootKey(39,'Start fresh original game');
 await until('actual native period chooser','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===2');
 const periodMenu=await ev('baye.hd.menuItems()');assert.equal(periodMenu.index,0);assert.equal(periodMenu.count,4);report.periodSelection={before:periodMenu,steps:[]};
 for(let i=1;i<4;i++){await bootKey(35,'Select actual period four');const m=await until('native period cursor '+i,'(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===4&&m.kind===2&&m.seq==='+periodMenu.seq+'&&m.index==='+i+'&&m;})()');report.periodSelection.steps.push(m);}
 await bootKey(39,'Confirm original period four');await until('P4 native lords','Number(baye.data.g_PIdx)===4&&baye.hd.kings().count>0');
 const lord=await ev('(() => {const m=baye.hd.kings();return {...m,target:m.kings.findIndex(p=>p.id==='+setup.lordId+')};})()');assert.ok(lord.target>=0,'Real original selected P4 lord selectable');let li=lord.index;
 for(let n=0;n<20&&li!==lord.target;n++){const next=li+(li<lord.target?1:-1);await bootKey(next>li?35:34,'Native lord cursor');await until('lord ACK '+next,'baye.hd.kings().index==='+next);li=next;}
 assert.equal(li,lord.target);report.selectedLord=lord.kings[lord.target];assert.equal(report.selectedLord.id,setup.lordId);assert.equal(rom.names[setup.lordId],setup.lordName);await bootKey(39,'Confirm actual '+setup.lordName);
 await until('actual owned HD map','baye.hd.march().pick&&baye.hd.realm().ownedCount>0&&BayeHdOverworld.debugSnapshot().presentationReady&&BayeHdOverworld.debugSnapshot().hitsEnabled',60000);
 const initial=await ev('__identitySample()');report.initialWorld=initial.world;assert.equal(initial.world.period,4);assert.equal(initial.world.king,setup.lordId);
 const nativeNames=await ev('Array.from({length:baye.getPersonCount()},(_,id)=>baye.getPersonName(id))');assert.deepEqual(nativeNames,rom.names,'All200 actual native P4 names match independent raw ROM');report.nativeNames=nativeNames;
 async function revealYunnan(){
  const navigation=report.mapNavigation={cityIndex:setup.cityIndex,attempts:[],nativeInputsDuringPan:0};
  const point=()=>ev('(() => {const m=BayeHdOverworld,s=m.debugSnapshot(),cs=m.getCities(),c=cs['+setup.cityIndex+'];if(c.name!=='+JSON.stringify(setup.cityName)+'||c.kind!=="owned")throw Error("Real owned selected city missing");const p=m.mapToScreen(c.hdX,c.hdY),n=document.getElementById("hd-overworld-canvas"),r=n.getBoundingClientRect(),x=r.left+p.x*r.width/s.design[0],y=r.top+p.y*r.height/s.design[1],h=document.elementFromPoint(x,y);return {index:'+setup.cityIndex+',name:c.name,x,y,hit:h===n,top:h&&(h.id||h.tagName),viewport:{width:innerWidth,height:innerHeight},design:s.design,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},camera:s.camera,phase:s.phase,presentationReady:s.presentationReady,hitsEnabled:s.hitsEnabled,aligning:s.aligning,pan:s.pan};})()');
  for(let attempt=0;attempt<12;attempt++){
   const beforePoint=await point();navigation.lastPoint=beforePoint;assert.ok(beforePoint.presentationReady&&beforePoint.hitsEnabled&&!beforePoint.aligning&&beforePoint.phase==='map');
   if(beforePoint.hit&&beforePoint.x>=24&&beforePoint.x<=viewport.width-24&&beforePoint.y>=64&&beforePoint.y<=viewport.height-48){navigation.accepted=true;navigation.final=beforePoint;return beforePoint;}
   const clamp=(v,limit)=>Math.max(-limit,Math.min(limit,v)),dx=clamp(viewport.width*.6-beforePoint.x,viewport.width*.28),dy=clamp(viewport.height*.55-beforePoint.y,viewport.height*.28);assert.ok(Math.hypot(dx,dy)>20,'A genuine drag must cross the existing10px threshold');
   const candidates=await ev('(() => {const n=document.getElementById("hd-overworld-canvas"),out=[];for(const a of [.55,.4,.7,.3,.8])for(const b of [.55,.4,.7,.3,.8]){const x=innerWidth*a,y=innerHeight*b,points=Array.from({length:9},(_,i)=>({x:x+'+dx+'*i/8,y:y+'+dy+'*i/8}));if(points.every(p=>p.x>=24&&p.x<=innerWidth-24&&p.y>=64&&p.y<=innerHeight-48&&document.elementFromPoint(p.x,p.y)===n))out.push({x,y,points});}return out;})()');
   let chosen=null;for(const c of candidates){await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:c.x,y:c.y,buttons:0});report.inputs.push({type:'cdp-map-hover',x:c.x,y:c.y});await delay(40);const hover=await ev('BayeHdOverworld.debugSnapshot().hoverIndex');if(hover===-1){chosen={...c,hover};break;}}
   assert.ok(chosen,'Actual empty canvas start and unobstructed drag path');const before=await ev('__identitySample()'),mapBefore=await ev('BayeHdOverworld.debugSnapshot()');
   assert.ok(!mapBefore.pan.on&&!mapBefore.aligning&&mapBefore.phase==='map');
   if(mobile){await touches('touchStart',[chosen.points[0]]);for(const p of chosen.points.slice(1))await touches('touchMove',[p]);await touches('touchEnd');}
   else{const p=chosen.points[0];await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x:p.x,y:p.y});for(const p of chosen.points.slice(1)){await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:p.x,y:p.y});await delay(40);}const q=chosen.points.at(-1);await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:q.x,y:q.y});report.inputs.push({type:'cdp-map-pan',points:chosen.points});}
   await delay(180);const after=await ev('__identitySample()'),mapAfter=await ev('BayeHdOverworld.debugSnapshot()'),keys=await ev('__identityKeys.slice('+before.state.keyCount+')');
   assert.deepEqual(keys,[],'Map reveal never moves the native cursor or sends Enter');assert.deepEqual(after.native,before.native,'Trusted camera drag keeps every measured native field');assert.deepEqual(after.world,before.world);assert.deepEqual(after.world,report.initialWorld);assert.equal(after.state.touchCount,before.state.touchCount,'No native LCD touch');assert.equal(mapAfter.pan.on,false);
   assert.ok(Math.abs(mapAfter.camera.x-mapBefore.camera.x)>.01||Math.abs(mapAfter.camera.y-mapBefore.camera.y)>.01,'The existing camera actually moved');for(const axis of ['x','y'])assert.ok(mapAfter.camera[axis]>=mapAfter.camera[axis==='x'?'minX':'minY']-.001&&mapAfter.camera[axis]<=mapAfter.camera[axis==='x'?'maxX':'maxY']+.001);
   navigation.attempts.push({beforePoint,delta:{dx,dy},chosen,before,after,mapBefore,mapAfter,keys});
  }
  throw Error('Selected city remains outside a safely tappable real canvas after bounded trusted pans');
 }
 const point=await revealYunnan();report.cityPoint=point;await mouse(point.x,point.y);
 await until('real selected city HD root','(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===1&&s.open&&s.layer==="root"&&s.cityIndex==='+setup.cityIndex+'&&!s.sending&&!s.queueLen;})()',60000);await snap(foreignOnly?'jinyang-root':'yunnan-root');
 const readKeys=(offset=0)=>ev('__identityKeys.slice('+offset+')'),baseSample=()=>ev('__identitySample()');
 const city=initial.world.cities[setup.cityIndex],queue=initial.world.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons),allied=queue.filter(id=>initial.world.people[id].Belong===city.Belong);assert.equal(city.Belong,setup.lordId+1);if(!foreignOnly)assert.deepEqual(allied,[3,139,140,141,142,143,144,145,146,147]);report.roster={cityIndex:setup.cityIndex,city,queue,allied};
 async function revealIdentityList(selector){
  const target=await ev('(() => {const n=document.querySelector('+JSON.stringify(selector)+'),m=baye.hd.menuItems(),raw=n?.getAttribute("data-hd-deep-preview")??n?.getAttribute("data-hd-deep");if(!n||raw==null||!n.closest("#hd-city-menu-deep")||m.active!==1||m.context!==1||m.kind!==3||!m.idsValid)return null;const index=Number(raw);return {index,personId:m.ids[index],count:m.count};})()');assert.ok(target&&Number.isInteger(target.index)&&Number.isInteger(target.personId));const {index,personId}=target,budget=foreignOnly?Math.min(240,Math.max(12,target.count*2+4)):12;let visible=false;
   for(let panAttempt=0;panAttempt<budget;panAttempt++){
    const g=await geometry(selector);assert.ok(g?.shown&&!g.disabled,'Current original preview button exists');if(g.visible&&g.hit){visible=true;break;}
    const plan=await ev('(() => {const n=document.querySelector('+JSON.stringify(selector)+'),p=n?.closest("#hd-city-menu-deep");if(!p||p.scrollHeight<=p.clientHeight)return null;const r=p.getBoundingClientRect(),L=Math.max(r.left+'+g.clip.left+'-Math.min(r.left,'+g.clip.left+'),r.left)+p.clientLeft,R=Math.min(r.right,'+g.clip.right+')-(p.offsetWidth-p.clientWidth-p.clientLeft),T=Math.max(r.top,'+g.clip.top+')+4,B=Math.min(r.bottom,'+g.clip.bottom+')-4;if(R-L<8||B-T<52)return null;const nodes=[...p.querySelectorAll("button,a,input,select,textarea,[role=button]")],rects=nodes.map(n=>({n,s:getComputedStyle(n),r:n.getBoundingClientRect()})).filter(o=>!o.n.hidden&&o.s.display!=="none"&&o.s.visibility!=="hidden"&&o.r.width>0&&o.r.height>0).map(o=>o.r),edges=[...new Set([L+2,R-2,...rects.flatMap(r=>[r.left,r.right]).filter(x=>x>L+2&&x<R-2)])].sort((a,b)=>a-b),xs=[R-12,...edges.slice(1).map((x,i)=>(x+edges[i])/2),L+2,R-2];for(const x of xs){if(x<L+2||x>R-2)continue;let bands=[[T,B]];for(const r of rects){if(x<r.left-2||x>r.right+2)continue;bands=bands.flatMap(([a,b])=>r.bottom+8<=a||r.top-8>=b?[[a,b]]:[[a,Math.min(b,r.top-8)],[Math.max(a,r.bottom+8),b]].filter(([c,d])=>d>c));}bands.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));const band=bands[0];if(!band||band[1]-band[0]<52)continue;const down='+JSON.stringify(g.rect.bottom>g.clip.bottom)+',y=band[0]+(band[1]-band[0])*(down?.8:.2),end=band[0]+(band[1]-band[0])*(down?.2:.8),points=Array.from({length:7},(_,i)=>({x,y:y+(end-y)*i/6}));if(!points.every(q=>{const h=document.elementFromPoint(q.x,q.y);return h&&(h===p||p.contains(h))&&!h.closest("button,a,input,select,textarea,[role=button]");}))continue;return {pane:p.id,x,band,points,scrollTop:p.scrollTop,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,clip:{left:L,right:R,top:T,bottom:B},interactiveRects:rects.map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),down};}return null;})()');
    assert.ok(plan,'The actual list has a noninteractive vertical gutter and genuine swipe band');const before=await baseSample();await touches('touchStart',[plan.points[0]]);for(const p of plan.points.slice(1))await touches('touchMove',[p]);await touches('touchEnd');const after=await baseSample(),panKeys=await readKeys(before.state.keyCount),scrollTop=await ev('document.getElementById("hd-city-menu-deep").scrollTop');assert.deepEqual(panKeys,[],'A real list-gutter swipe never selects or confirms');assert.deepEqual(after.native,before.native);assert.deepEqual(after.world,before.world);assert.deepEqual(after.world,report.initialWorld);assert.equal(after.state.touchCount,before.state.touchCount);assert.ok(plan.down?scrollTop>plan.scrollTop:scrollTop<plan.scrollTop,'The real list scroll offset advances in the swipe direction');report.listPreviewPans??=[];report.listPreviewPans.push({personId,index,selector,geometry:g,plan,before,after,keys:panKeys,scrollTop});await snap('list-preview-reveal-'+personId+'-'+panAttempt);
   }
  assert.equal(visible,true,'The real list target is fully visible after bounded genuine swipes');
 }
 let mobileDriver,scrollEntry;
 if(mobile){scrollEntry={baseline:await baseSample(),scrollChecks:[],checks:[]};report.mobileNavigation=scrollEntry;mobileDriver=await createMobileDetailRuntimeDriver({report,evaluate:ev,until,checkpoint:snap,ready:baseSample,checkWorld:s=>assert.deepEqual(s.world,report.initialWorld,'Every trusted mobile pan preserves original world'),readKeys:async o=>(await readKeys(o)).map(code=>({code})),touches,touchButton:async selector=>{const p=await geometry(selector);assert.ok(p?.visible&&p.hit&&!p.disabled);await tap(p.x,p.y);},label:layout},scrollEntry);reveal=async(selector,options)=>{if(selector.includes("[data-hd-deep"))await revealIdentityList(selector);return mobileDriver.reveal(selector,options);};}
 if(foreignOnly){await (locationOnly?runPersonLocationRoles:runForeignPersonRoles)({report,evaluate:ev,until,sample:baseSample,snap,click,arrow,readKeys,reveal,rom,libBytes:nativeLib,mobile,detailDriver:mobileDriver});await observeActualLib(cdp,'after-foreign-ownership');return;}
 const roots=await ev('baye.hd.menuItems()'),interior=roots.names.indexOf('内政');assert.ok(interior>=0);await click('[data-hd-root="'+interior+'"]');
 await until('actual internal affairs','(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===2&&s.open&&s.layer==="sub"&&s.subKind==="neizheng";})()');const sub=await ev('baye.hd.menuItems()'),search=sub.names.indexOf('搜寻');assert.ok(search>=0);await click('[data-hd-sub="'+search+'"]');
 const currentExpression='(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),p=baye.hd.personProperties();return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids.length===m.count&&s.open&&s.layer==="deep"&&!s.sending&&!s.queueLen&&!s.personPagePending&&s.personDetail?.personIndex===m.ids[m.index]&&p.active===1&&p.pageComplete===1&&p.pageStart===0&&p.person===m.ids[m.index]&&p.menuSeq===m.seq&&p.generation===m.detailGeneration&&p.index===m.index&&true;})()';
 await until('complete original SEARCH PERSON page0',currentExpression,60000);const picker=await baseSample();assert.deepEqual(picker.state.menu.ids,allied);assert.deepEqual(picker.state.menu.names,allied.map(id=>rom.names[id]));await snap('search-person-list');
 const targets=[3,...allied.filter(id=>id!==3&&Array.from(rom.names[id]).length===rom.allPeriodMaxNameCodePoints)];assert.deepEqual(targets,[3,139,140,143,144]);report.targets=targets;report.people=[];
 for(const personId of targets){
  const before=await baseSample(),m=before.state.menu,index=m.ids.indexOf(personId);assert.ok(index>=0);assert.deepEqual(before.world,report.initialWorld);let keys;
  if(mobile){await reveal('#hd-city-menu [data-hd-deep-preview="'+index+'"]');await mobileDriver.preview(3,index);keys=await readKeys(before.state.keyCount);}
  else{await reveal('[data-hd-deep="'+m.index+'"]',{control:false});let current=m.index;for(let n=0;n<m.count&&current!==index;n++){const next=current+(current<index?1:-1);await arrow(next>current?'ArrowDown':'ArrowUp');await until('real physical person Arrow ACK '+next,'(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===3&&m.seq==='+m.seq+'&&m.detailGeneration==='+m.detailGeneration+'&&m.index==='+next+';})()');current=next;}assert.equal(current,index);keys=await readKeys(before.state.keyCount);assert.deepEqual(keys,Array(Math.abs(index-m.index)).fill(index>m.index?35:34));}
  await until('fresh current native identity page0',currentExpression);const focused=await baseSample();assert.equal(focused.state.menu.ids[focused.state.menu.index],personId);assert.deepEqual(focused.world,report.initialWorld);
  const entry={personId,name:rom.names[personId],nameCodePoints:Array.from(rom.names[personId]).length,selection:{before,after:focused,physicalKeys:keys}};await checkPersonIdentity({evaluate:ev,until,readKeys,libBytes:nativeLib},{sample:baseSample,reveal,snap},entry,personId,rom);report.people.push(entry);
 }
 report.returnChecks=[];
 const cancelBefore=await baseSample();await click('#hd-city-menu [data-hd-menu-back]');await until('real native PERSON cancel returns directly to MAP and retires CITY','!BayeHdCityMenu.debugSnapshot().open&&baye.hd.menuItems().active===0&&baye.hd.march().pick===1&&BayeHdOverworld.debugSnapshot().presentationReady&&BayeHdOverworld.debugSnapshot().hitsEnabled');const cancelAfter=await baseSample(),cancelKeys=await readKeys(cancelBefore.state.keyCount);assert.deepEqual(cancelKeys,[40],'One actual VK_EXIT cancels the original SEARCH picker to MAP');assert.deepEqual(cancelAfter.world,report.initialWorld);assert.equal(cancelAfter.native.qty.active,0);assert.equal(cancelAfter.native.report.active,0);assert.equal(cancelAfter.native.march.phase,0);report.returnChecks.push({layer:'map',before:cancelBefore,after:cancelAfter,keys:cancelKeys});await snap('return-map');
 report.final=await baseSample();assert.deepEqual(report.final.world,report.initialWorld);report.nativeKeys=await ev('__identityKeys');report.nativeTouches=await ev('__identityTouches');report.publicInputCalls=await ev('__identityCalls');report.trustedEvents=await ev('__identityEvents');assert.deepEqual(report.nativeTouches,[]);await observeActualLib(cdp,'after-identity');
 report.identityAccepted=true;report.accepted=true;report.hdAccepted=true;report.summary={people:targets.length,rulers:1,maximumLengthAlliedNames:targets.length-1,maximumNameCodePoints:rom.allPeriodMaxNameCodePoints,identityInspectionKeys:0,nativeTouches:0,worldUnchanged:true,returnedToActualMap:true};report.scope={accepted:'Original P4 MengHuo Yunnan, real full-library-maximum4-character allied names, complete current PERSON identity and native/HD ownership semantics, trusted scrolling/navigation and return with recorded world invariance',notRun:'Captive/free/enemy ownership, arbitrary Mod names, other periods actual gameplay, physical device, stable performance, complete native ABI/RNG or globalHD'};
}

const childExited=child=>!child||child.exitCode!==null||child.signalCode!==null;
async function main(){
 assert.ok(!fs.existsSync(artifactDir),'Use a fresh evidence directory without earlier evidence');fs.mkdirSync(artifactDir,{recursive:true});let server,chrome,cdp,profile,chromeError,ownership,rootIdentity;const historical=new Map();
 sampleOwned=async label=>{if(!chrome)return;try{const s=await snapshotOwnedChrome(chrome.pid,profile),r=s.owned.find(p=>p.ProcessId===chrome.pid),sameRoot=!rootIdentity||!!r&&r.CreationDate===rootIdentity.CreationDate&&r.ExecutablePath===rootIdentity.ExecutablePath&&r.CommandLine===rootIdentity.CommandLine;fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),...persistOwnership(s,sameRoot)})+'\n');if(s.rootVerified&&sameRoot){ownership=s;rootIdentity||=r;for(const p of s.owned)historical.set(p.ProcessId+'|'+p.CreationDate,identity(p));}}catch{fs.appendFileSync(path.join(artifactDir,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),error:'Owned sampling failed; previous verified basis retained'})+'\n');}};
 const interrupt=()=>{report.interrupted=true;cdp?.close();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try{prepareServedAssets();console.log('Frozen',Object.keys(report.sources).length,'sources; engine',report.nativeSourceCheck.aggregate);if(preflightOnly){report.ok=true;return;}assert.equal(typeof WebSocket,'function');profile=path.join(artifactDir,'private-browser-profile');fs.mkdirSync(profile);server=await startServer();const origin='http://127.0.0.1:'+server.address().port,debugPort=await unusedPort();assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);const binary=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(fs.existsSync(binary));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size='+viewport.width+','+viewport.height,'--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});chrome.on('error',e=>chromeError=e);chrome.on('exit',(code,signal)=>{report.chromeExit={code,signal,at:new Date().toISOString()};});report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};console.log('Private',JSON.stringify(report.isolation));
 let target;const deadline=Date.now()+15000;while(Date.now()<deadline){if(chromeError)throw chromeError;if(childExited(chrome))throw Error('Private Chrome exited');try{const list=await new Promise((resolve,reject)=>{const req=http.get('http://127.0.0.1:'+debugPort+'/json/list',res=>{let body='';res.setEncoding('utf8');res.on('data',part=>{body+=part;if(body.length>1024*1024)req.destroy(Error('CDP endpoint bound exceeded'));});res.on('end',()=>{try{assert.equal(res.statusCode,200);resolve(JSON.parse(body));}catch(e){reject(e);}});});req.setTimeout(1000,()=>req.destroy(Error('CDP endpoint timeout')));req.on('error',reject);});target=list.find(i=>i.type==='page');if(target)break;}catch(e){report.chromeEndpointProbeError={message:e.message,code:e.code||null,childExit:report.chromeExit||null};}await delay(100);}assert.ok(target,'Private Chrome target '+JSON.stringify(report.chromeEndpointProbeError||null));await sampleOwned('launch-before-page');assert.ok(ownership?.rootVerified,'PID birth/executable/exact private profile verified before page');report.rootBirth=rootIdentity.CreationDate;report.isolation.rootIdentityVerified=true;report.isolation.rootIdentity=identity(rootIdentity);cdp=await connectCdp(target.webSocketDebuggerUrl);
 cdp.on('Runtime.consoleAPICalled',e=>report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')}));cdp.on('Log.entryAdded',e=>report.log.push(e.entry));cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));cdp.on('Page.javascriptDialogOpening',e=>{report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});cdp.on('Fetch.requestPaused',e=>{const local=new URL(e.request.url).origin===origin;if(!local)report.blocked.push(e.request.url);cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
 await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');report.browser=await cdp.send('Browser.getVersion');await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile});if(mobile)await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.clear();localStorage.setItem('baye/libpath','libs/dat-mod.lib');localStorage.setItem('baye/overworldMode','hd-map');localStorage.setItem('baye/systemUiMode','classic');localStorage.setItem('baye/cityMenuMode','hd');localStorage.setItem('baye/mobileOverworldMode','hd-map');localStorage.setItem('baye/mobileCityMenuMode','hd');"});await cdp.send('Page.navigate',{url:origin+(mobile?'/m.html#'+Math.floor(Date.now()/1000):'/pc.html')});await identitySmoke(cdp);
 assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.dialogs,[]);assert.deepEqual(report.requests.filter(r=>r.status>=400&&!r.expected),[]);report.ok=true;
 }catch(e){report.ok=false;report.error=e.stack||String(e);console.error(report.error);process.exitCode=1;if(cdp){try{report.failureState=await evaluate(cdp,'window.__identitySample?__identitySample():null');}catch{}try{const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure-identity.png'),Buffer.from(png.data,'base64'));}catch{}}}
 finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await sampleOwned('before-cleanup');if(cdp&&ownership?.rootVerified){try{await cdp.send('Browser.close');report.gracefulBrowserClose=true;}catch{report.gracefulBrowserClose=false;}await delay(750);}cdp?.close();if(ownership?.rootVerified){try{const p=await cleanupOwnedChrome(ownership);report.cleanup=persistCleanup(p,ownership);if(!p.treeExited){report.ok=false;process.exitCode=1;}}catch{report.cleanup={treeExited:false,error:'Owned cleanup failed; private profile retained'};report.ok=false;process.exitCode=1;}}else if(chrome){report.cleanup={treeExited:false,error:'No verified ownership basis; broad stop refused'};report.ok=false;process.exitCode=1;}if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}report.serverClosed=!server||!server.listening;report.historicalRecordedIdentities=[...historical.values()];report.profileRetained=!!profile&&fs.existsSync(profile);report.directoriesDeleted=false;
 const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),actualSha256=fs.existsSync(f)?sha(fs.readFileSync(f)):null;return {name,...m,actualSha256,match:actualSha256===m.sha256};}),added=productionDirectories.flatMap(d=>walk(path.join(root,d))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(n=>!servedAssets.has(n)),drift=sources.filter(s=>!s.match);report.sourceVerification={ok:!added.length&&!drift.length,count:sources.length,added,drift,sources};report.isolation={...report.isolation,cleaned:!chrome||report.cleanup?.treeExited===true,chromeExited:!chrome||report.cleanup?.treeExited===true,profileRetained:report.profileRetained,directoriesDeleted:false,httpClosed:!server||!server.listening,serverClosed:!server||!server.listening,user8080Touched:false};if(!report.sourceVerification.ok||!report.isolation.cleaned||!report.isolation.chromeExited||!report.isolation.httpClosed){report.ok=false;process.exitCode=1;}report.accepted=report.ok===true&&report.accepted===true;report.identityAccepted=report.ok===true&&report.identityAccepted===true;report.hdAccepted=report.ok===true&&report.hdAccepted===true;if(locationOnly)report.personLocationAccepted=report.ok===true&&report.personLocationAccepted===true;report.finishedAt=new Date().toISOString();for(const[name,value]of[['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,log:report.log,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])writeJsonAtomicSync(path.join(artifactDir,name),value);console.log('Finished',JSON.stringify({ok:report.ok,hdAccepted:report.hdAccepted,identityAccepted:report.identityAccepted,...(locationOnly?{personLocationAccepted:report.personLocationAccepted}:{}),checkpoints:report.phases.length,sources:report.sourceVerification.count,artifactDir}));}
}


async function observeActualLib(cdp,stage){
 const expression='(()=>{const before=Number(baye.data.g_hdSpeGeneration),a=BayeHdLibIdentity.read(),hex=window.dynLib,b=BayeHdLibIdentity.read(),after=Number(baye.data.g_hdSpeGeneration);return {before,after,a,b,hex};})()',first=await evaluate(cdp,expression),last=await evaluate(cdp,expression);
 for(const r of [first,last]){assert.equal(r.before,r.after);assert.ok(Number.isInteger(r.before)&&r.before>0);assert.equal(r.a.status,'ready');assert.equal(r.b.status,'ready');assert.equal(r.a.generation,r.b.generation);assert.equal(r.a.sha256,sha(nativeLib));assert.equal(r.b.sha256,sha(nativeLib));assert.ok(typeof r.hex==='string'&&/^(?:[0-9a-f]{2})+$/i.test(r.hex));const bytes=Buffer.from(r.hex,'hex');assert.equal(bytes.length,nativeLib.length);assert.equal(sha(bytes),sha(nativeLib));}assert.equal(last.before,first.before);assert.equal(last.a.generation,first.a.generation);assert.equal(last.hex,first.hex);delete first.hex;delete last.hex;report.actualLibReads??=[];report.actualLibReads.push({stage,first,last});
}


main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
