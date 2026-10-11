#!/usr/bin/env node
/** Genuine original PC P1 DongZhuo equipment-card inspection; private non8080 Chrome only. */
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
import {checkPersonEquipmentCards} from './hd-person-equipment-runtime-checks.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const flags=new Set(['--720','--preflight-only']);for(let i=2;i<process.argv.length;i++){const flag=process.argv[i];if(flag==='--artifact-dir'){assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing --artifact-dir value');i++;}else assert.ok(flags.has(flag),'Unknown option: '+flag);}

const preflightOnly=process.argv.includes('--preflight-only');
const artifactFlag=process.argv.indexOf('--artifact-dir'),artifactDir=path.resolve(artifactFlag>=0?process.argv[artifactFlag+1]:path.join(root,'build/pc-person-equipment-runtime'));
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const report={scenario:"original-pc-person-equipment",preflightOnly,viewport,accepted:false,equipmentAccepted:false,hdAccepted:false,startedAt:new Date().toISOString(),phases:[],console:[],log:[],exceptions:[],dialogs:[],blocked:[],requests:[],inputs:[]};
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
    const data=fs.readFileSync(path.join(root,rel)),metadata={source:rel,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
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
 for(const rel of ['scripts/hd-runtime-owned-chrome.mjs','scripts/hd-runtime-json.mjs','scripts/hd-person-equipment-runtime-checks.mjs','scripts/write-wasm-manifest.mjs','pc.html','fonts/HarmonyOS_Sans_SC_Regular.ttf','favicon.png','qr.png',targetName()])freezeAsset(rel);
 nativeLib=freezeAsset('libs/dat-mod.lib').data;assert.equal(nativeLib.length,207195);assert.equal(sha(nativeLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 const build=JSON.parse(freezeAsset('js/baye.build.json').data);for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const s=freezeAsset('js/'+name);assert.equal(s.data.length,build.artifacts[name].bytes);assert.equal(s.metadata.sha256,build.artifacts[name].sha256);}
 // The build-generated version.h is frozen/served but excluded from the native manifest's source aggregate.
 const names=walk(path.join(root,'vendor/iBaye')).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(f=>f!=='vendor/iBaye/src/baye/version.h').sort(),hash=crypto.createHash('sha256'),files=[];
 for(const name of names){const s=freezeAsset(name);hash.update(name+'\0');hash.update(s.data);files.push({name,...s.metadata});}assert.equal(names.length,128);report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),manifest:build.engineSourceSha256,files};assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256);
 const font='fonts/HarmonyOS_Sans_SC_Regular.ttf';report.fontSource=freezeAsset(font).metadata;report.engineManifest=build;report.tool=freezeAsset(targetName()).metadata;
 for(const [source,dest] of [[targetName(),'executed-tool.mjs'],['scripts/hd-person-equipment-runtime-checks.mjs','executed-checks.mjs'],['scripts/hd-runtime-owned-chrome.mjs','executed-owned-chrome.mjs'],['scripts/hd-runtime-json.mjs','executed-json.mjs']])fs.writeFileSync(path.join(artifactDir,dest),freezeAsset(source).data,{flag:'wx'});
}
async function startServer(){
 const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'pc.html';
 const s=servedAssets.get(rel);if(!s){report.requests.push({url:url.pathname,status:404,expected:rel==='favicon.ico'});res.writeHead(404).end();return;}
 report.requests.push({url:url.pathname,status:200,...s.metadata});res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(s.data);
 }catch(e){report.requests.push({url:req.url,status:400,error:String(e)});res.writeHead(400).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;
}
const equipmentObserverSource="(function(){\n window.__equipmentKeys=[];window.__equipmentTouches=[];window.__equipmentCalls=[];window.__equipmentEvents=[];\n let depth=0;for(const[object,name,api]of[[window,'sendKey','window.sendKey'],[baye,'sendKey','baye.sendKey']]){const old=object[name];if(typeof old!=='function')throw Error('Missing public native input');object[name]=function(code){const outer=depth++===0;try{return old.apply(this,arguments);}finally{depth--;window.__equipmentCalls.push({api,code,at:performance.now(),depth});if(outer)window.__equipmentKeys.push(code);}};}\n if(typeof window._bayeSendTouchEvent!=='function')throw Error('Missing real touch binding');const touch=window._bayeSendTouchEvent;window._bayeSendTouchEvent=function(){window.__equipmentTouches.push(Array.from(arguments));return touch.apply(this,arguments);};\n for(const type of ['pointerdown','pointerup','click','keydown','keyup','wheel'])document.addEventListener(type,e=>{if(e.isTrusted)window.__equipmentEvents.push({type,key:e.key||null,x:e.clientX||0,y:e.clientY||0,target:e.target.id||e.target.tagName,at:performance.now()});},true);\n window.__equipmentSample=function(){\n  const d=baye.data,a=BayeHdLibIdentity.read();\n  const take=(o,ks)=>Object.fromEntries(ks.map(k=>{const v=Number(o[k]);if(!Number.isInteger(v))throw Error('Noninteger native '+k);return[k,v];}));\n  const world=()=>{const n=Number(baye.getPersonCount()),nc=Number(d.g_engineConfig.citiesCount);if(n!==200||nc!==38||Number(baye.getToolCount())!==33)throw Error('Original world ABI counts');return {period:Number(d.g_PIdx),king:Number(d.g_PlayerKing),year:Number(d.g_YearDate),month:Number(d.g_MonthDate),people:Array.from({length:200},(_,i)=>take(d.g_Persons[i],['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'])),cities:Array.from({length:38},(_,i)=>take(d.g_Cities[i],['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons','Tools','ToolQueue'])),queue:Array.from(d.g_PersonsQueue,Number),goodsQueue:Array.from(d.g_GoodsQueue,Number),fighters:Array.from(d.FIGHTERS,Number),fighterIndex:Array.from(d.FIGHTERS_IDX,Number),orders:Array.from(d.g_OrderQueue,o=>take(o,['OrderId','City','Person','Object','TimeCount','Food','Arms','Money','Consume'])),tools:Array.from({length:33},(_,i)=>take(d.g_Tools[i],['useflag','changeAttackRange','at','iq','move','arm']))};};\n  const native=()=>({generation:Number(d.g_hdDetailGeneration),mapCity:Number(d.g_hdMapCity),mapPick:Number(d.g_hdMapPick),cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},menu:baye.hd.menuItems(),march:baye.hd.march(),report:baye.hd.report(),qty:baye.hd.qty(),person:baye.hd.personProperties()});\n  const before=native(),w=world(),cityUi=BayeHdCityMenu.debugSnapshot(),after=native(),w2=world(),b=BayeHdLibIdentity.read();\n  if(d!==baye.data||a.status!=='ready'||a.sha256!=='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'||JSON.stringify(a)!==JSON.stringify(b)||JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(w)!==JSON.stringify(w2))throw Error('Unstable original native/person/world sample');\n  if(w.queue.length!==2000||w.goodsQueue.length!==2000||w.fighters.length!==600||w.fighterIndex.length!==30||w.orders.length!==200)throw Error('Truncated original world arrays'); for(const name of ['queue','goodsQueue','fighters','fighterIndex'])if(!w[name].every(Number.isInteger))throw Error('Invalid native '+name);\n  return {world:w,native:after,state:{menu:after.menu,cityUi,keyCount:window.__equipmentKeys.length,touchCount:window.__equipmentTouches.length},identity:a};\n };\n return {keys:true,touch:true,forwardOnce:true};\n})()";
const equipmentGeometrySource="function(selector){const n=document.querySelector(selector);if(!n)return null;const r=n.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight};let shown=!n.hidden,scroll=null;for(let q=n;q;q=q.parentElement){const s=getComputedStyle(q);if(q.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)<=0)shown=false;// BODY/HTML overflow propagates to the viewport; their normal-flow boxes do not clip fixed HD layers.\nconst viewportRoot=q===document.body||q===document.documentElement;if(!viewportRoot&&q!==n&&/(auto|scroll|hidden|clip)/.test(s.overflowY+' '+s.overflowX)){const p=q.getBoundingClientRect();clip.left=Math.max(clip.left,p.left);clip.top=Math.max(clip.top,p.top);clip.right=Math.min(clip.right,p.right);clip.bottom=Math.min(clip.bottom,p.bottom);}if(!viewportRoot&&!scroll&&q!==n&&/(auto|scroll)/.test(s.overflowY)&&q.scrollHeight>q.clientHeight+1){const p=q.getBoundingClientRect();scroll={left:p.left,top:p.top,right:p.right,bottom:p.bottom,topValue:q.scrollTop,max:q.scrollHeight-q.clientHeight};}}const visible=shown&&r.width>0&&r.height>0&&r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5,x=Math.max(clip.left,Math.min(clip.right,r.left+r.width/2)),y=Math.max(clip.top,Math.min(clip.bottom,r.top+r.height/2)),top=document.elementFromPoint(x,y);return {visible,shown,hit:!!top&&(top===n||n.contains(top)),disabled:!!n.disabled,text:n.textContent,x,y,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},clip,scroll};}";


async function equipmentSmoke(cdp){
 const ev=expression=>evaluate(cdp,expression),until=(label,expression,timeout)=>waitFor(cdp,label,expression,timeout);
 await until('actual standard LIB identity',"window.BayeHdLibIdentity&&BayeHdLibIdentity.read().status==='ready'&&BayeHdLibIdentity.read().sha256==='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'&&typeof dynLib==='string'&&dynLib.length===414390",60000);
 await until('original native engine ready','window.baye&&baye.hd&&baye.hd.ready()',60000);await observeActualLib(cdp,'startup');report.inputObserver=await ev(equipmentObserverSource);
 async function snap(label){const png=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png'})).data,'base64'),file='pc'+viewport.height+'-equipment-'+String(report.phases.length).padStart(2,'0')+'-'+label+'.png';fs.writeFileSync(path.join(artifactDir,file),png,{flag:'wx'});const entry={label,file,bytes:png.length,sha256:sha(png),sample:await ev('__equipmentSample()')};report.phases.push(entry);await sampleOwned('checkpoint-'+label);return entry;}
 const geometry=selector=>ev('('+equipmentGeometrySource+')('+JSON.stringify(selector)+')');
 async function mouse(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<viewport.width&&y<viewport.height);await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x,y});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x,y});report.inputs.push({type:'cdp-mouse-click',x,y});}
 async function reveal(selector,{control=true}={}){let last=null;try{for(let n=0;n<35;n++){const g=await geometry(selector);last=g;assert.ok(g&&g.shown,'Actual displayed DOM '+selector);if(g.visible&&g.hit){if(control)assert.equal(g.disabled,false);return g;}assert.ok(g.scroll,'A real scroll container must reveal '+selector);const s=g.scroll,x=(Math.max(0,s.left)+Math.min(viewport.width,s.right))/2,y=(Math.max(0,s.top)+Math.min(viewport.height,s.bottom))/2,deltaY=g.rect.top<g.clip.top?-Math.min(260,g.clip.top-g.rect.top+40):Math.min(260,g.rect.bottom-g.clip.bottom+40);assert.ok(deltaY!==0);const hit=await ev('(() => {const n=document.elementFromPoint('+x+','+y+');return n&&n.closest("#hd-city-menu");})()');assert.ok(hit,'Wheel starts in the actual visible HD panel');await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY});report.inputs.push({type:'cdp-wheel',selector,x,y,deltaY});await delay(80);}throw Error('Bounded wheel did not reveal '+selector);}catch(error){report.geometryFailures??=[];report.geometryFailures.push({selector,control,geometry:last,error:error.message});throw error;}}
 async function click(selector){const g=await reveal(selector),last=await geometry(selector);assert.ok(last.visible&&last.hit&&!last.disabled);assert.deepEqual(last.rect,g.rect);await mouse(last.x,last.y);}
 async function arrow(name){const vk={ArrowUp:38,ArrowDown:40}[name];assert.ok(vk);await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});report.inputs.push({type:'cdp-key',key:name});}
 // Only the existing public keys operate the original animated title/period/lord setup.
 await until('original title','baye.hd.spe().id===100',60000);await ev('sendKey(VK_ENTER)');await until('period selection','baye.hd.spe().id===104');await ev('sendKey(VK_ENTER)');await until('P1 native lords','Number(baye.data.g_PIdx)===1&&baye.hd.kings().count>0');
 const lord=await ev('(() => {const m=baye.hd.kings();return {...m,target:m.kings.findIndex(p=>p.name==="董卓")};})()');assert.ok(lord.target>=0,'Actual DongZhuo native lord');let li=lord.index;for(let n=0;n<20&&li!==lord.target;n++){const next=li+(li<lord.target?1:-1);await ev('sendKey('+(next>li?'VK_DOWN':'VK_UP')+')');await until('lord Arrow ACK','baye.hd.kings().index==='+next);li=next;}assert.equal(li,lord.target);report.selectedLord=lord.kings[lord.target];await ev('sendKey(VK_ENTER)');
 await until('actual owned HD map','baye.hd.march().pick&&baye.hd.realm().ownedCount>0&&BayeHdOverworld.debugSnapshot().presentationReady&&BayeHdOverworld.debugSnapshot().hitsEnabled',60000);
 const initial=await ev('__equipmentSample()');report.initialWorld=initial.world;assert.equal(initial.world.period,1);assert.equal(await ev('baye.getPersonName(Number(baye.data.g_PlayerKing))'),'董卓');
 const point=await ev('(() => {const m=BayeHdOverworld,s=m.debugSnapshot(),cs=m.getCities(),i=cs.findIndex(c=>c.name==="洛阳");if(i<0||cs[i].kind!=="owned")throw Error("Original owned Luoyang missing");const c=cs[i],p=m.mapToScreen(c.hdX,c.hdY),n=document.getElementById("hd-overworld-canvas"),r=n.getBoundingClientRect(),x=r.left+p.x*r.width/s.design[0],y=r.top+p.y*r.height/s.design[1];return {index:i,name:c.name,x,y,hit:document.elementFromPoint(x,y)===n,design:s.design,rect:{left:r.left,top:r.top,width:r.width,height:r.height}};})()');assert.equal(point.hit,true);report.cityPoint=point;await mouse(point.x,point.y);
 await until('real Luoyang HD root','(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===1&&s.open&&s.layer==="root"&&s.cityIndex==='+point.index+';})()',60000);await snap('luoyang-root');await click('[data-hd-root="0"]');
 await until('actual internal affairs','(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===2&&s.open&&s.layer==="sub"&&s.subKind==="neizheng";})()');assert.equal(await ev("document.querySelector('[data-hd-sub=\"2\"]').textContent"),'搜寻');await click('[data-hd-sub="2"]');
 await until('actual search PERSON full owner','(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids.length===m.count&&m.names.length===m.count&&s.open&&s.layer==="deep"&&s.personDetail;})()');await snap('search-person-list');
 const driver={sample:()=>ev('__equipmentSample()'),reveal,snap},ctx={evaluate:ev,until,libBytes:nativeLib,readKeys:(offset=0)=>ev('__equipmentKeys.slice('+offset+')')};report.people=[];
 for(const [name,count] of [['吕布',2],['董卓',1],['李儒',0]]){
  const before=await driver.sample(),m=before.state.menu,index=m.names.indexOf(name);assert.ok(index>=0,'Actual native list contains '+name);const personId=m.ids[index];assert.equal(await ev('baye.getPersonName('+personId+')'),name);assert.equal([before.world.people[personId].Tool1,before.world.people[personId].Tool2].filter(Boolean).length,count);assert.deepEqual(before.world,report.initialWorld);
  // Current row is visible; never click it, because its click would confirm a business command.
  const row=await reveal('[data-hd-deep="'+m.index+'"]');assert.ok(row.visible&&row.hit);let current=m.index;
  for(let n=0;n<m.count&&current!==index;n++){const next=current+(current<index?1:-1);await arrow(next>current?'ArrowDown':'ArrowUp');await until('PERSON physical Arrow ACK '+next,'(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===3&&m.seq==='+m.seq+'&&m.detailGeneration==='+m.detailGeneration+'&&m.index==='+next+';})()');current=next;}
  assert.equal(current,index);await until('fresh current person detail','BayeHdCityMenu.debugSnapshot().personDetail?.personIndex==='+personId);const focused=await driver.sample(),keys=await ctx.readKeys(before.state.keyCount);assert.deepEqual(keys,Array(Math.abs(index-m.index)).fill(index>m.index?35:34));assert.deepEqual(focused.world,before.world);const unchanged=structuredClone(focused.state.menu);unchanged.index=m.index;assert.deepEqual(unchanged,m,'Focus changes only real native menu index');assert.equal(focused.state.touchCount,before.state.touchCount);
  const entry={personId,name,equipmentCount:count,selection:{beforeMenu:m,afterMenu:focused.state.menu,physicalKeys:keys}};await checkPersonEquipmentCards(ctx,driver,entry,personId);report.people.push(entry);
 }
 report.final=await driver.sample();assert.deepEqual(report.final.world,report.initialWorld);report.nativeKeys=await ev('__equipmentKeys');report.nativeTouches=await ev('__equipmentTouches');report.publicInputCalls=await ev('__equipmentCalls');report.trustedEvents=await ev('__equipmentEvents');assert.deepEqual(report.nativeTouches,[]);await observeActualLib(cdp,'after-equipment');
 report.equipmentAccepted=true;report.accepted=true;report.hdAccepted=true;report.summary={people:3,cards:3,propertyRows:18,selectionArrows:report.people.reduce((n,p)=>n+p.selection.physicalKeys.length,0),cardInspectionKeys:0,nativeTouches:0};report.scope={accepted:'Genuine original P1 DongZhuo PC Luoyang SEARCH PERSON focus, three initial equipment classes, native ROM fields and every visible equipment row',notRun:'Mobile, changing equipment or any business commit, other periods, complete native ABI/RNG, performance, global HD completion'};
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
 await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');report.browser=await cdp.send('Browser.getVersion');await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.clear();localStorage.setItem('baye/libpath','libs/dat-mod.lib');localStorage.setItem('baye/overworldMode','hd-map');localStorage.setItem('baye/systemUiMode','classic');localStorage.setItem('baye/cityMenuMode','hd');"});await cdp.send('Page.navigate',{url:origin+'/pc.html'});await equipmentSmoke(cdp);
 assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.dialogs,[]);assert.deepEqual(report.requests.filter(r=>r.status>=400&&!r.expected),[]);report.ok=true;
 }catch(e){report.ok=false;report.error=e.stack||String(e);console.error(report.error);process.exitCode=1;if(cdp){try{report.failureState=await evaluate(cdp,'window.__equipmentSample?__equipmentSample():null');}catch{}try{const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure-equipment.png'),Buffer.from(png.data,'base64'));}catch{}}}
 finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);await sampleOwned('before-cleanup');if(cdp&&ownership?.rootVerified){try{await cdp.send('Browser.close');report.gracefulBrowserClose=true;}catch{report.gracefulBrowserClose=false;}await delay(750);}cdp?.close();if(ownership?.rootVerified){try{const p=await cleanupOwnedChrome(ownership);report.cleanup=persistCleanup(p,ownership);if(!p.treeExited){report.ok=false;process.exitCode=1;}}catch{report.cleanup={treeExited:false,error:'Owned cleanup failed; private profile retained'};report.ok=false;process.exitCode=1;}}else if(chrome){report.cleanup={treeExited:false,error:'No verified ownership basis; broad stop refused'};report.ok=false;process.exitCode=1;}if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}report.serverClosed=!server||!server.listening;report.historicalRecordedIdentities=[...historical.values()];report.profileRetained=!!profile&&fs.existsSync(profile);report.directoriesDeleted=false;
 const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),actualSha256=fs.existsSync(f)?sha(fs.readFileSync(f)):null;return {name,...m,actualSha256,match:actualSha256===m.sha256};}),added=productionDirectories.flatMap(d=>walk(path.join(root,d))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(n=>!servedAssets.has(n)),drift=sources.filter(s=>!s.match);report.sourceVerification={ok:!added.length&&!drift.length,count:sources.length,added,drift,sources};report.isolation={...report.isolation,cleaned:!chrome||report.cleanup?.treeExited===true,chromeExited:!chrome||report.cleanup?.treeExited===true,profileRetained:report.profileRetained,directoriesDeleted:false,httpClosed:!server||!server.listening,serverClosed:!server||!server.listening,user8080Touched:false};if(!report.sourceVerification.ok||!report.isolation.cleaned||!report.isolation.chromeExited||!report.isolation.httpClosed){report.ok=false;process.exitCode=1;}report.accepted=report.ok===true&&report.accepted===true;report.equipmentAccepted=report.ok===true&&report.equipmentAccepted===true;report.hdAccepted=report.ok===true&&report.hdAccepted===true;report.finishedAt=new Date().toISOString();for(const[name,value]of[['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,log:report.log,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])writeJsonAtomicSync(path.join(artifactDir,name),value);console.log('Finished',JSON.stringify({ok:report.ok,hdAccepted:report.hdAccepted,equipmentAccepted:report.equipmentAccepted,checkpoints:report.phases.length,sources:report.sourceVerification.count,artifactDir}));}
}


async function observeActualLib(cdp,stage){
 const expression='(()=>{const before=Number(baye.data.g_hdSpeGeneration),a=BayeHdLibIdentity.read(),hex=window.dynLib,b=BayeHdLibIdentity.read(),after=Number(baye.data.g_hdSpeGeneration);return {before,after,a,b,hex};})()',first=await evaluate(cdp,expression),last=await evaluate(cdp,expression);
 for(const r of [first,last]){assert.equal(r.before,r.after);assert.ok(Number.isInteger(r.before)&&r.before>0);assert.equal(r.a.status,'ready');assert.equal(r.b.status,'ready');assert.equal(r.a.generation,r.b.generation);assert.equal(r.a.sha256,sha(nativeLib));assert.equal(r.b.sha256,sha(nativeLib));assert.ok(typeof r.hex==='string'&&/^(?:[0-9a-f]{2})+$/i.test(r.hex));const bytes=Buffer.from(r.hex,'hex');assert.equal(bytes.length,nativeLib.length);assert.equal(sha(bytes),sha(nativeLib));}assert.equal(last.before,first.before);assert.equal(last.a.generation,first.a.generation);assert.equal(last.hex,first.hex);delete first.hex;delete last.hex;report.actualLibReads??=[];report.actualLibReads.push({stage,first,last});
}


main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
