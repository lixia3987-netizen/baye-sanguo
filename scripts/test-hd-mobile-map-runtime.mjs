#!/usr/bin/env node
// Trusted Chrome touch smoke test. Importing this file does not launch or sample an OS process.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {snapshotOwnedChrome, cleanupOwnedChrome} from './hd-runtime-owned-chrome.mjs';
import {writeJsonAtomicSync} from './hd-runtime-json.mjs';

const ORIGINAL_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const MOBILE_PREF = 'baye/mobileOverworldMode', PC_PREF = 'baye/overworldMode';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.png':'image/png'};

// The native king list uses zero-based person IDs; City.Belong is that ID plus one.
export function chooseMultiCityKing(snapshot) {
  assert.ok(snapshot && Array.isArray(snapshot.kings) && Array.isArray(snapshot.cities));
  assert.equal(snapshot.cities.length,38,'Original first-period city census');
  assert.ok(snapshot.cities.every(c=>Number.isInteger(c.belong)&&c.belong>=0&&c.belong<=200));
  const candidates=snapshot.kings.map((k,index)=>{
    assert.ok(Number.isInteger(k.id)&&k.id>=0&&k.id<200,'Actual native king ID');
    return {...k,index,ownedCount:snapshot.cities.filter(c=>c.belong===k.id+1).length};
  }).filter(k=>k.ownedCount>=2&&k.ownedCount<38);
  const selected=candidates.find(k=>k.name==='董卓')||candidates[0];
  assert.ok(selected,'A genuine selectable king with at least two owned cities is required');
  return {selected,candidates};
}

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

const worldSource = `(() => {
  const d=baye.data,n=Number(baye.getPersonCount()),nc=Number(d.g_engineConfig.citiesCount);
  if(n!==200||nc!==38)throw Error('Original world ABI counts differ');
  const take=(o,fields)=>Object.fromEntries(fields.map(k=>{const v=Number(o[k]);if(!Number.isInteger(v))throw Error('Noninteger native '+k);return [k,v];}));
  return {period:Number(d.g_PIdx),king:Number(d.g_PlayerKing),year:Number(d.g_YearDate),month:Number(d.g_MonthDate),
    people:Array.from({length:n},(_,i)=>take(d.g_Persons[i],['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'])),
    cities:Array.from({length:nc},(_,i)=>take(d.g_Cities[i],['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'])),
    queue:Array.from(d.g_PersonsQueue,Number),fighters:Array.from(d.FIGHTERS,Number),
    orders:Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>take(d.g_OrderQueue[i],['OrderId','City','Person','Object','TimeCount','Food']))};
})()`;
const nativeWaitSource = `(() => {const d=baye.data;return {mapCity:Number(d.g_hdMapCity),mapPick:Number(d.g_hdMapPick),
  cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},menu:baye.hd.menuItems(),march:baye.hd.march(),report:baye.hd.report()};})()`;
const readSource = `(() => {
  const d=baye.data,map=window.BayeHdOverworld,rect=n=>{if(!n)return null;const r=n.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const shown=n=>{if(!n||n.hidden)return false;for(let q=n;q&&q.nodeType===1;q=q.parentElement){const s=getComputedStyle(q);if(q.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}const r=n.getBoundingClientRect();return r.width>0&&r.height>0;};
  const lcd=document.getElementById('lcd'),canvas=document.getElementById('hd-overworld-canvas'),stage=document.getElementById('hd-mobile-stage'),bar=document.getElementById('hd-mobile-bar');
  const hit=n=>{if(!shown(n))return false;const r=n.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===n;};
  const menu=baye.hd.menuItems(),march=baye.hd.march(),city=Number(d.g_hdMapCity)-1,c=city>=0&&city<38?d.g_Cities[city]:null;
  const expected=c?{city:baye.getCityName(city),owner:Number(c.Belong)?baye.getPersonName(Number(c.Belong)-1):'无主',
    date:Number(d.g_YearDate)+'年'+Number(d.g_MonthDate)+'月',money:String(Number(c.Money)),food:String(Number(c.Food)),arms:String(Number(c.MothballArms))}:null;
  return {at:performance.now(),viewport:[innerWidth,innerHeight],identity:BayeHdLibIdentity.read(),hud:BayeHdMobile.refresh(),adapter:window.BayeHdMobileMap&&BayeHdMobileMap.refresh(),expected,
    map:map&&map.debugSnapshot(),camera:map&&{...map.getCamera()},menu,march,report:baye.hd.report(),mapCity:city,
    cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)},lcd:{shown:shown(lcd),hit:hit(lcd),rect:rect(lcd),rotation:lcdRotateMode,width:lcdWidth,height:lcdHeight},
    canvas:{shown:shown(canvas),rect:rect(canvas),width:canvas&&canvas.width,height:canvas&&canvas.height},stage:rect(stage),barHeight:bar?bar.getBoundingClientRect().height:0,
    mobilePreference:localStorage.getItem('${MOBILE_PREF}'),pcPreference:localStorage.getItem('${PC_PREF}'),
    keyCount:__mobileMapKeys.length,touchCount:__mobileMapNativeTouches.length,eventCount:__mobileMapEvents.length};
})()`;
const mapReadySource = `(() => {if(!window.BayeHdOverworld||!window.BayeHdMobile)return false;
  const m=BayeHdOverworld.debugSnapshot(),n=baye.hd.menuItems(),p=baye.hd.march(),r=baye.hd.report();
  return m.mode==='hd-map'&&m.presentationReady&&m.phase==='map'&&m.hitsEnabled&&!m.aligning&&
    !n.active&&!r.active&&p.pick===1&&!p.battlePick&&BayeHdMobile.refresh().visible&&
    window.BayeHdMobileMap&&BayeHdMobileMap.refresh().active&&m;})()`;

async function connectCdp(url) {
  const ws=new WebSocket(url),pending=new Map(),listeners=new Map();let sequence=0;
  const rejectAll=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('CDP closed'));}pending.clear();};
  ws.addEventListener('close',rejectAll);
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){
    const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
  }else listeners.get(m.method)?.(m.params);});
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(Error('CDP connection failed')),{once:true});});
  return {on:(name,fn)=>listeners.set(name,fn),close(){rejectAll();ws.close();},send(method,params={}){
    const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},20000);
      pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}};
}
async function unusedPort() {
  const s=net.createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});
  const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;
}

export async function main(args=process.argv.slice(2)) {
  assert.ok(args.length===0 || args.length===2 && args[0]==='--artifact-dir','Usage: node scripts/test-hd-mobile-map-runtime.mjs [--artifact-dir build/new-directory]');
  const root=process.cwd(),relative=args[1]||'build/mobile-map-runtime-'+Date.now(),out=path.resolve(root,relative);
  assert.ok(out.startsWith(path.join(root,'build')+path.sep),'Artifacts must stay in a fresh build subdirectory');
  assert.ok(!fs.existsSync(out),'Preserve prior evidence: artifact directory must not already exist');fs.mkdirSync(out,{recursive:true});
  const profile=path.join(out,'private-browser-profile');fs.mkdirSync(profile);
  const report={schemaVersion:1,scope:'Original mobile landscape HD map with trusted Chrome emulated touch; not real Android/iOS, battle HD or all-city coverage',
    startedAt:new Date().toISOString(),ok:false,accepted:false,realDeviceAccepted:false,reportInteractionAccepted:false,
    artifacts:relative,profileRetained:true,directoriesDeleted:false,sourceFiles:[],requests:[],blockedExternal:[],console:[],exceptions:[],
    phases:[],actions:[],cities:[],inputs:[],ownershipSamples:'owned-process-samples.jsonl',user8080Accessed:false};
  const frozen=new Map(),historical=new Map();let server,chrome,cdp,ownership,rootIdentity,interrupted=false;
  const freeze=rel=>{if(frozen.has(rel))return frozen.get(rel);const filename=path.resolve(root,rel);
    assert.ok(filename.startsWith(root+path.sep));const bytes=fs.readFileSync(filename),ref={path:rel,bytes:bytes.length,sha256:sha(bytes)};
    const item={bytes,ref};frozen.set(rel,item);report.sourceFiles.push(ref);return item;};
  const write=(name,value)=>writeJsonAtomicSync(path.join(out,name),value);
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  const until=async(label,expression,timeout=45000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(interrupted)throw Error('Interrupted');
    const r=await evaluate(expression);if(r)return r;await delay(100);}throw Error('Timed out '+label);};
  const sampleOwned=async label=>{if(!chrome)return;try{const s=await snapshotOwnedChrome(chrome.pid,profile),r=s.owned.find(p=>p.ProcessId===chrome.pid);
    const sameRoot=!rootIdentity || !!r&&r.CreationDate===rootIdentity.CreationDate&&r.ExecutablePath===rootIdentity.ExecutablePath&&r.CommandLine===rootIdentity.CommandLine;
    fs.appendFileSync(path.join(out,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),...persistOwnership(s,sameRoot)})+'\n');
    if(s.rootVerified&&sameRoot){ownership=s;rootIdentity||=r;for(const p of s.owned)historical.set(p.ProcessId+'|'+p.CreationDate,identity(p));}
  }catch{fs.appendFileSync(path.join(out,'owned-process-samples.jsonl'),JSON.stringify({label,at:new Date().toISOString(),error:'Owned sampling failed; previous verified basis retained'})+'\n');}};
  const checkpoint=async name=>{const s=await evaluate(readSource);report.phases.push({name,state:s});
    const png=await cdp.send('Page.captureScreenshot',{format:'png'});const bytes=Buffer.from(png.data,'base64'),file=name+'.png';fs.writeFileSync(path.join(out,file),bytes,{flag:'wx'});
    report.phases.at(-1).screenshot={file,bytes:bytes.length,sha256:sha(bytes)};
    const canvasId=s.canvas.shown?'hd-overworld-canvas':s.lcd.shown?'lcd':null;
    if(canvasId){const raw=await evaluate(`(() => {const c=document.getElementById(${JSON.stringify(canvasId)}),ctx=c.getContext('2d'),colors=new Set();
      for(let y=0;y<c.height;y+=Math.max(1,Math.floor(c.height/24)))for(let x=0;x<c.width;x+=Math.max(1,Math.floor(c.width/40))){colors.add(Array.from(ctx.getImageData(x,y,1,1).data).join(','));}
      return {url:c.toDataURL('image/png'),colorCount:colors.size,width:c.width,height:c.height};})()`);
      const b=Buffer.from(raw.url.slice(raw.url.indexOf(',')+1),'base64'),rawFile=name+'-'+canvasId+'.png';fs.writeFileSync(path.join(out,rawFile),b,{flag:'wx'});
      report.phases.at(-1).actualCanvas={file:rawFile,bytes:b.length,sha256:sha(b),width:raw.width,height:raw.height,sampledColors:raw.colorCount};
      if(s.canvas.shown)assert.ok(raw.colorCount>8,'HD map contains actual varied painted pixels');}
    await sampleOwned(name);console.log('PASS',name);return s;};
  const key=async(code,reason)=>{report.inputs.push({type:'public native key',code,reason});await evaluate('sendKey('+code+')');await delay(160);};
  const metrics=async(width,height)=>{report.inputs.push({type:'CDP viewport',width,height});await cdp.send('Emulation.setDeviceMetricsOverride',{
    width,height,deviceScaleFactor:1,mobile:true,screenOrientation:{type:width>height?'landscapePrimary':'portraitPrimary',angle:width>height?90:0}});await delay(250);};
  const touches=async(type,points=[])=>{report.inputs.push({type:'trusted CDP '+type,points});await cdp.send('Input.dispatchTouchEvent',{
    type,touchPoints:points.map(p=>({x:p.x,y:p.y,id:p.id??1,radiusX:1,radiusY:1}))});await delay(90);};
  const tap=async(point,jitter=false)=>{await touches('touchStart',[{x:point.x,y:point.y}]);
    if(jitter)await touches('touchMove',[{x:point.x+2,y:point.y+1}]);await touches('touchEnd');await delay(150);};
  const buttonPoint=async selector=>{const p=await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.hidden||n.disabled)return null;
    const r=n.getBoundingClientRect(),s=getComputedStyle(n),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);
    return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&(top===n||n.contains(top))?{x,y,width:r.width,height:r.height}:null;})()`);
    assert.ok(p,'Visible unobstructed mobile control '+selector);return p;};
  const button=async selector=>tap(await buttonPoint(selector));
  const mark=async()=>({world:await evaluate(worldSource),native:await evaluate(nativeWaitSource),state:await evaluate(readSource)});
  const presentationUnchanged=async(before,label,{native=true}={})=>{await delay(150);const after=await mark();
    assert.deepEqual(after.world,before.world,label+' preserves all 200 people/38 cities/queues/orders/fighters');
    if(native)assert.deepEqual(after.native,before.native,label+' preserves actual native input owner/cursor');
    assert.equal(after.state.keyCount,before.state.keyCount,label+' zero native keys');
    assert.equal(after.state.touchCount,before.state.touchCount,label+' zero native LCD touch');
    assert.equal(after.state.pcPreference,report.initialPreferences.pc,label+' does not change PC mode');return after;};
  const assertHud=s=>{assert.equal(s.identity.sha256,ORIGINAL_SHA);assert.equal(s.hud.visible,true);
    for(const [k,v]of Object.entries(s.expected))assert.equal(s.hud[k],v,'HUD equals current native '+k);};
  const assertHd=s=>{assertHud(s);assert.ok(Math.abs(s.viewport[0]-s.stage.width)<.1&&Math.abs(s.viewport[1]-s.stage.bottom)<.1,'Stage ends at viewport bottom');
    assert.equal(s.map.mode,'hd-map');assert.equal(s.map.presentationReady,true);assert.equal(s.canvas.shown,true);assert.equal(s.lcd.shown,false);
    assert.equal(s.adapter.active,true);assert.equal(s.map.mobile,true);
    assert.ok(s.canvas.width>0&&s.canvas.height>0,'Actual HD backing canvas exists');
    for(const k of ['left','top','right','bottom'])assert.ok(Math.abs(s.canvas.rect[k]-s.stage[k])<=1,'Map fills mobile stage '+k);};
  const assertLcd=s=>{assert.equal(s.lcd.shown,true,'Native LCD restored');assert.equal(s.canvas.shown,false,'HD map cannot cover native LCD');
    const r=s.lcd.rect,t=s.stage;assert.ok(r.width>0&&r.height>0&&r.left>=t.left-.1&&r.top>=t.top-.1&&r.right<=t.right+.1&&r.bottom<=t.bottom+.1,'Native LCD remains inside stage');
    assert.ok(Math.abs((s.lcd.rotation===0?r.width/r.height:r.height/r.width)-s.lcd.width/s.lcd.height)<.003,'Native LCD aspect ratio');};
  const cityPoint=async city=>{const before=await mark();const result=await evaluate('BayeHdOverworld.centerOnCity('+city.index+')');
    assert.notEqual(result,false,'Public presentation-only city centering');await until('map after centering',mapReadySource);
    await presentationUnchanged(before,'centerOnCity('+city.name+')');
    const p=await evaluate(`(() => {const p=BayeHdOverworld.cityScreenPos(${city.index}),c=document.getElementById('hd-overworld-canvas');
      if(!p)return null;return {...p,hit:document.elementFromPoint(p.clientX,p.clientY)===c};})()`);
    assert.ok(p&&p.hit,'City geometry is unobstructed on actual canvas '+city.name);return {x:p.clientX,y:p.clientY,...p};};
  const visit=async(city,label,jitter)=>{await until('map before city',mapReadySource);const point=await cityPoint(city),before=await mark();
    await tap(point,jitter);await until('native city root '+city.name,`(() => {const d=baye.data,n=baye.hd.menuItems();return n.active===1&&n.context===1&&n.kind===1&&
      Number(d.g_hdMapCity)-1===${city.index}&&Number(d.g_CityPos.setx)===${city.engX}&&Number(d.g_CityPos.sety)===${city.engY};})()`);
    const menu=await checkpoint(label+'-menu');assertLcd(menu);assert.equal(menu.hud.visible,false,'City native owner retires HUD');
    assert.equal(menu.hud.city,'');assert.deepEqual(await evaluate(worldSource),before.world,'Entering city is not a gameplay mutation');
    const entry=await evaluate('__mobileMapKeys.slice('+before.state.keyCount+')'),codes=entry.map(k=>k.code),vk=await evaluate('({enter:baye.VK_ENTER,exit:baye.VK_EXIT,arrows:[baye.VK_UP,baye.VK_DOWN,baye.VK_LEFT,baye.VK_RIGHT]})');
    assert.equal(codes.filter(k=>k===vk.enter).length,1,'Trusted city tap enters once');
    assert.ok(codes.every(k=>k===vk.enter||vk.arrows.includes(k)),'Entry contains only actual cursor arrows and one Enter');
    assert.equal(menu.touchCount,before.state.touchCount,'HD city tap does not leak to native touch handler');
    const backAt=menu.keyCount;await button('#hd-mobile-exit');await until('HUD and HD map after one EXIT',mapReadySource);
    const returned=await checkpoint(label+'-returned');assertHd(returned);const back=await evaluate('__mobileMapKeys.slice('+backAt+')');
    assert.deepEqual(back.map(k=>k.code),[vk.exit],'One trusted header return sends one native EXIT');
    assert.equal(returned.mapCity,city.index);assert.notEqual(returned.march.mapInputSeq,before.state.march.mapInputSeq,'Native map wait was renewed');
    assert.deepEqual(await evaluate(worldSource),before.world,'City roundtrip preserves native world');
    report.cities.push({label,city,point,jitter,before:before.state,menu,returned,entry,back});};
  const interrupt=()=>{interrupted=true;report.interrupted=true;cdp?.close();server?.closeAllConnections();};
  process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
  try {
    assert.equal(typeof WebSocket,'function','Node 22+ built-in WebSocket is required');
    const tool=freeze('scripts/test-hd-mobile-map-runtime.mjs');fs.writeFileSync(path.join(out,'executed-tool.mjs'),tool.bytes,{flag:'wx'});
    for(const f of ['scripts/hd-runtime-owned-chrome.mjs','scripts/hd-runtime-json.mjs','m.html','js/original-game.js','js/hd-mobile.js','js/hd-mobile-map.js','js/hd-overworld.js','js/lcd.js','libs/dat-mod.lib'])freeze(f);
    assert.equal(frozen.get('libs/dat-mod.lib').ref.sha256,ORIGINAL_SHA);assert.equal(frozen.get('libs/dat-mod.lib').ref.bytes,207195);
    server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://private'),rel=decodeURIComponent(url.pathname).replace(/^\/+/,''),filename=path.resolve(root,rel);
      const allowed=/^(?:js|css|assets|libs|fonts|vendor)\//.test(rel)||['m.html','favicon.png','manifest.json'].includes(rel);
      if(!allowed||!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){
        report.requests.push({url:req.url,status:404});res.writeHead(404).end();return;}
      const item=freeze(rel);report.requests.push({url:req.url,status:200,...item.ref});
      res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'}).end(item.bytes);
    }catch{res.writeHead(500).end();report.requests.push({url:req.url,status:500});}});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    report.httpPort=server.address().port;report.debugPort=await unusedPort();assert.notEqual(report.httpPort,8080);assert.notEqual(report.debugPort,8080);
    const origin='http://127.0.0.1:'+report.httpPort;
    chrome=spawn(process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding',
      '--remote-debugging-port='+report.debugPort,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
    chrome.on('error',()=>{report.chromeSpawnError=true;});report.chromePid=chrome.pid;
    let target;for(let n=0;n<100&&!target;n++){if(report.chromeSpawnError)throw Error('Private Chrome launch failed');
      try{target=(await new Promise((resolve,reject)=>{const request=http.get('http://127.0.0.1:'+report.debugPort+'/json/list',response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>{try{resolve(JSON.parse(body));}catch(error){reject(error);}});});request.on('error',reject);request.setTimeout(1000,()=>request.destroy(new Error('Private endpoint timeout')));})).find(t=>t.type==='page');}catch{}if(!target)await delay(100);}
    assert.ok(target,'Private Chrome page target');await sampleOwned('launch-before-page');assert.ok(ownership?.rootVerified,'PID, birth and exact private profile verified before page load');
    report.rootBirth=rootIdentity.CreationDate;cdp=await connectCdp(target.webSocketDebuggerUrl);
    cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e));cdp.on('Runtime.consoleAPICalled',e=>report.console.push(e));
    cdp.on('Fetch.requestPaused',e=>{const local=e.request.url.startsWith(origin+'/');if(!local)report.blockedExternal.push(e.request.url);
      cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
    await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    await metrics(844,390);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await cdp.send('Page.navigate',{url:origin+'/m.html#'+Math.floor(Date.now()/1000)});
    await until('original engine','window.baye&&baye.hd&&baye.hd.ready()',60000);
    await evaluate(`(() => {window.__mobileMapKeys=[];window.__mobileMapNativeTouches=[];window.__mobileMapEvents=[];
      const k=window.sendKey,t=window._bayeSendTouchEvent;window.sendKey=function(code){__mobileMapKeys.push({code,at:performance.now()});return k.apply(this,arguments);};
      window._bayeSendTouchEvent=function observeTouch(){__mobileMapNativeTouches.push({args:Array.from(arguments),at:performance.now()});const r=t.apply(this,arguments);window._bayeSendTouchEvent=observeTouch;return r;};
      for(const type of ['touchstart','touchmove','touchend','touchcancel','pointerdown','pointerup','pointercancel'])document.addEventListener(type,e=>
        __mobileMapEvents.push({type,trusted:e.isTrusted,target:e.target.id||e.target.tagName,at:performance.now()}),true);
      return true;})()`);
    report.initialPreferences=await evaluate(`({mobile:localStorage.getItem('${MOBILE_PREF}'),pc:localStorage.getItem('${PC_PREF}'),debug:localStorage.getItem('baye/debug')})`);
    assert.notEqual(report.initialPreferences.debug,'1','Fresh profile starts without requested native debug');
    for(let n=0;n<60;n++){if(await evaluate('baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1'))break;
      const intro=await evaluate('baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)');if(intro)await key(0x27,'Public intro acknowledgement');else await delay(150);}
    await until('native title','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1');
    await checkpoint('00-title-844');await key(0x27,'Start genuine new game');
    await until('native period','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===2');await key(0x27,'Select original first period');
    await until('native king list','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===3&&Number(baye.data.g_PIdx)===1&&baye.hd.kings().count>0');
    const kingCensus=await evaluate(`(() => {const d=baye.data,first=baye.hd.kings(),menu=baye.hd.menuItems();
      const cities=Array.from({length:38},(_,index)=>({index,name:baye.getCityName(index),belong:Number(d.g_Cities[index].Belong)}));
      const last=baye.hd.kings(),again=baye.hd.menuItems();
      if(menu.active!==1||menu.context!==4||menu.kind!==3||JSON.stringify(first)!==JSON.stringify(last)||JSON.stringify(menu)!==JSON.stringify(again))throw Error('Native king census owner changed');
      return {kings:first.kings,index:first.index,currentId:first.currentId,menu,cities};})()`);
    report.initialKingSelection={census:kingCensus};
    const selection=chooseMultiCityKing(kingCensus),chosenKing=selection.selected;Object.assign(report.initialKingSelection,selection);
    for(let i=kingCensus.index;i<chosenKing.index;i++)await key(0x23,'Select actual multi-city king row');
    for(let i=kingCensus.index;i>chosenKing.index;i--)await key(0x22,'Select actual multi-city king row');
    const selectedNativeKing=await evaluate('baye.hd.kings()');assert.equal(selectedNativeKing.index,chosenKing.index);assert.equal(selectedNativeKing.currentId,chosenKing.id);
    report.initialKingSelection.beforeConfirmation=selectedNativeKing;await key(0x27,'Confirm actual multi-city king '+chosenKing.name);
    await until('mobile public map API','window.BayeHdOverworld&&typeof BayeHdOverworld.applyMobilePage===\'function\'&&typeof BayeHdOverworld.centerOnCity===\'function\'');
    await until('default mobile HD map',mapReadySource,60000);report.defaultHdMap=true;
    const all=await evaluate('BayeHdOverworld.getCities().map(c=>({index:c.index,name:c.name,kind:c.kind,belong:c.belong,engX:c.engX,engY:c.engY}))');
    report.initialAllCities=all;assert.equal(all.length,38);const owned=all.filter(c=>c.kind==='owned'),foreign=all.find(c=>c.kind!=='owned');
    const actualKing=await evaluate('Number(baye.data.g_PlayerKing)');report.actualKing={id:actualKing,name:await evaluate('baye.getPersonName(Number(baye.data.g_PlayerKing))'),ownedCount:owned.length};
    assert.equal(actualKing,chosenKing.id);assert.equal(owned.length,chosenKing.ownedCount);assert.ok(owned.length>=2&&foreign);
    const initialMapCity=(await evaluate(readSource)).mapCity,current=all.find(c=>c.index===initialMapCity),otherOwned=owned.find(c=>c.index!==initialMapCity);
    assert.ok(current&&current.kind==='owned'&&otherOwned);report.selectedCities={current,otherOwned,nonOwned:foreign};
    // This suite retains the native LCD menu handoff/return contract. The
    // dedicated mobile-city suite covers the default HD menu presentation.
    await button('#hd-mobile-menu-mode');
    await until('explicit classic mobile menus',"BayeHdCityMenu.getMode()==='classic'");
    report.menuPresentation='classic selected by trusted mobile control';
    const initialWorld=await evaluate(worldSource);
    for(const [width,height] of [[844,390],[667,375]]){
      const label=width+'x'+height,beforeResize=await mark();await metrics(width,height);await until('HD map '+label,mapReadySource);
      await presentationUnchanged(beforeResize,'Idle resize '+label);const map=await checkpoint('map-'+label);assertHd(map);
      const currentCity=all.find(c=>c.index===map.mapCity),anotherOwned=owned.find(c=>c.index!==map.mapCity);
      assert.ok(currentCity&&currentCity.kind==='owned'&&anotherOwned,'Actual current and another owned city at this viewport');
      await visit(currentCity,label+'-current-city',true);await visit(anotherOwned,label+'-other-owned-city',false);
      await until('ready after owned cities',mapReadySource);const p=await cityPoint(foreign),before=await mark();await tap(p);
      await until('non-owned selection','BayeHdOverworld.debugSnapshot().selectedIndex==='+foreign.index);
      const selected=await presentationUnchanged(before,'Non-owned city tap');assert.equal(selected.state.menu.active,0);
      assert.ok(selected.state.map.hint.includes(foreign.name)&&selected.state.map.hint.includes('不是己方城'));
      report.actions.push({type:'non-owned trusted city tap',label,city:foreign,point:p,before:before.state,after:selected.state});
      const focused=await mark();await button('#hd-mobile-map-focus');await presentationUnchanged(focused,'Presentation-only focus button');
      const g=await evaluate(readSource),r=g.canvas.rect,x=r.left+r.width*.55,y=r.top+r.height*.55,dragBefore=await mark();
      assert.equal(await evaluate(`document.elementFromPoint(${x},${y})===document.getElementById('hd-overworld-canvas')`),true);
      await touches('touchStart',[{x,y}]);for(let n=1;n<=6;n++)await touches('touchMove',[{x:x+55*n/6,y:y+25*n/6}]);await touches('touchEnd');
      const dragAfter=await presentationUnchanged(dragBefore,'Trusted map drag');assert.equal(dragAfter.state.map.pan.on,false);
      assert.ok(Math.abs(dragAfter.state.camera.x-dragBefore.state.camera.x)>.01||Math.abs(dragAfter.state.camera.y-dragBefore.state.camera.y)>.01,'Actual map camera moved');
      report.actions.push({type:'trusted drag',label,before:dragBefore.state.camera,after:dragAfter.state.camera,zeroKeys:true});
      const cancelBefore=await mark();await touches('touchStart',[{x,y}]);await touches('touchMove',[{x:x+20,y:y+10}]);await touches('touchCancel');
      const cancelled=await presentationUnchanged(cancelBefore,'Map touchcancel');assert.equal(cancelled.state.map.pan.on,false);
      const multiBefore=await mark(),header=await buttonPoint('#hd-mobile-map-focus');
      await touches('touchStart',[{x,y,id:1}]);await touches('touchStart',[{x,y,id:1},{x:header.x,y:header.y,id:2}]);await touches('touchCancel');
      const multi=await presentationUnchanged(multiBefore,'Two-finger map/header cancellation');assert.equal(multi.state.map.pan.on,false);
      await checkpoint('cancelled-'+label);
    }
    const rotationBefore=await mark(),r=rotationBefore.state.canvas.rect,x=r.left+r.width*.55,y=r.top+r.height*.55;
    await touches('touchStart',[{x,y}]);await touches('touchMove',[{x:x+25,y:y+10}]);await metrics(375,667);await touches('touchEnd');
    await until('portrait LCD fallback',`(()=>{const s=${readSource};return s.lcd.shown&&s.lcd.hit&&!s.canvas.shown&&s.adapter.active===false&&s.barHeight===0;})()`);
    const portrait=await checkpoint('portrait-active-rotation');assertLcd(portrait);assert.equal(portrait.adapter.active,false);assert.equal(portrait.barHeight,0);
    assert.equal(portrait.lcd.hit,true);assert.equal(portrait.map.pan.on,false);
    await presentationUnchanged(rotationBefore,'Active HD rotation retires gesture');await metrics(844,390);await until('HD after rotation',mapReadySource);
    const restored=await checkpoint('landscape-restored');assertHd(restored);await presentationUnchanged(rotationBefore,'Landscape restoration');
    const modeBefore=await mark();await button('#hd-mobile-map-mode');await until('classic mobile preference',`localStorage.getItem('${MOBILE_PREF}')==='classic'`);
    const classic=await checkpoint('classic-844');assertLcd(classic);await presentationUnchanged(modeBefore,'HD to classic control');
    assert.equal(classic.map.pan.on,false);assert.equal(classic.pcPreference,report.initialPreferences.pc);
    const lr=classic.lcd.rect,cx=lr.left+lr.width*.28,cy=lr.top+lr.height*.58,nativeBefore=await mark();
    await touches('touchStart',[{x:cx,y:cy}]);await touches('touchMove',[{x:cx+4,y:cy+2}]);await touches('touchCancel');
    const nativeAfter=await mark(),touchTrace=await evaluate('__mobileMapNativeTouches.slice('+nativeBefore.state.touchCount+')');
    assert.deepEqual(touchTrace.map(t=>t.args[0]),[1,3,4],'Classic LCD retains genuine down/move/cancel route');
    assert.equal(nativeAfter.state.keyCount,nativeBefore.state.keyCount);assert.deepEqual(nativeAfter.world,nativeBefore.world);
    assert.equal(nativeAfter.native.menu.active,0,'Native cancel does not enter a city');assert.equal(nativeAfter.native.march.pick,1);
    assert.equal(nativeAfter.native.report.active,0);report.actions.push({type:'classic native touch cancellation',before:nativeBefore.native,after:nativeAfter.native,touchTrace});
    const classicMultiBefore=await mark(),modePoint=await buttonPoint('#hd-mobile-map-mode');
    await touches('touchStart',[{x:cx,y:cy,id:1}]);await touches('touchStart',[{x:cx,y:cy,id:1},{x:modePoint.x,y:modePoint.y,id:2}]);await touches('touchCancel');
    const classicMultiAfter=await mark(),classicMultiTrace=await evaluate('__mobileMapNativeTouches.slice('+classicMultiBefore.state.touchCount+')');
    assert.deepEqual(classicMultiTrace.map(t=>t.args[0]),[1,4],'Second finger outside LCD retires native gesture once without UP');
    assert.equal(classicMultiAfter.state.keyCount,classicMultiBefore.state.keyCount);assert.deepEqual(classicMultiAfter.world,classicMultiBefore.world);
    assert.equal(classicMultiAfter.native.menu.active,0);assert.equal(classicMultiAfter.native.march.pick,1);assert.equal(classicMultiAfter.state.adapter.mode,'classic');
    report.actions.push({type:'classic LCD plus header second finger',before:classicMultiBefore.native,after:classicMultiAfter.native,touchTrace:classicMultiTrace});
    await button('#hd-mobile-map-mode');await until('HD preference restored',mapReadySource);
    const final=await checkpoint('final-hd-map');assertHd(final);assert.deepEqual(await evaluate(worldSource),initialWorld,'All display/city-entry cases preserve complete gameplay world');
    assert.equal(final.pcPreference,report.initialPreferences.pc);assert.equal(final.mobilePreference,'hd-map');
    const events=await evaluate('__mobileMapEvents');assert.ok(events.some(e=>e.type==='touchcancel'));assert.ok(events.some(e=>e.type==='pointerup'&&e.target==='hd-overworld-canvas'));
    assert.ok(events.length&&events.every(e=>e.trusted),'Only Chrome trusted touch/pointer events were used');
    report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=events;
    assert.deepEqual(report.requests.filter(r=>r.status!==200),[],'All private local resources loaded');assert.equal(report.exceptions.length,0);
    report.ok=true;report.accepted=true;report.acceptedScope=['844x390 and 667x375 landscape HD map','trusted current/other owned and non-owned city touch','pan/cancel/rotation/multitouch retirement','native menu LCD and single Exit return','independent mobile classic preference'];
  }catch(error){report.ok=false;report.accepted=false;report.error=error.stack||String(error);process.exitCode=1;console.error(report.error);
    if(cdp){try{await checkpoint('failure');}catch{report.failureCaptureUnavailable=true;}}
  }finally{
    await sampleOwned('before-cleanup');cdp?.close();
    if(ownership?.rootVerified){try{const p=await cleanupOwnedChrome(ownership);report.cleanup=persistCleanup(p,ownership);if(!p.treeExited){report.ok=false;report.accepted=false;process.exitCode=1;}}
      catch{report.cleanup={treeExited:false,error:'Owned cleanup failed; private profile retained'};report.ok=false;report.accepted=false;process.exitCode=1;}}
    else if(chrome){report.cleanup={treeExited:false,error:'No verified owned browser basis; no broad stop attempted'};report.ok=false;report.accepted=false;process.exitCode=1;}
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}report.serverClosed=!server?.listening;
    report.historicalRecordedIdentities=[...historical.values()];report.profileRetained=fs.existsSync(profile);
    report.sourceDrift=report.sourceFiles.filter(ref=>{try{const b=fs.readFileSync(path.join(root,ref.path));return b.length!==ref.bytes||sha(b)!==ref.sha256;}catch{return true;}});
    if(report.sourceDrift.length){report.ok=false;report.accepted=false;process.exitCode=1;}
    report.finishedAt=new Date().toISOString();write('source-verification.json',{sourceFiles:report.sourceFiles,sourceDrift:report.sourceDrift});write('result.json',report);
    process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
    console.log(JSON.stringify({ok:report.ok,accepted:report.accepted,out,phases:report.phases.map(p=>p.name),error:report.error}));
  }
  return report;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
