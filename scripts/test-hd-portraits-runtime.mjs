#!/usr/bin/env node
/**
 * Real portrait assets and native identity acceptance, with isolated HTTP/CDP/profile.
 *   $env:CHROME='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
 *   node scripts/test-hd-portraits-runtime.mjs --artifact-dir build/r06-portraits
 *   node scripts/test-hd-portraits-runtime.mjs --assets-only --artifact-dir build/r06-assets
 * --staged serves the four build/wasm/src loader artifacts without installing.
 * Asset previews are explicitly manual and never count as runtime identities.
 * The real game suite uses native menus, actual city queues and real march
 * orders. It covers representatives in each period, not all 39 in battle.
 * --allow-partial is a development baseline; final acceptance requires 39 HD
 * slots. HTTP missing/delayed responses never rename or replace assets.
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


const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const staged=process.argv.includes('--staged'),assetsOnly=process.argv.includes('--assets-only');
const allowPartial=process.argv.includes('--allow-partial');
const argument=flag=>{const i=process.argv.indexOf(flag);if(i<0)return null;const value=process.argv[i+1];
    assert.ok(value&&!value.startsWith('--'),flag+' requires a value');return value;};
const artifactDir=path.resolve(argument('--artifact-dir')||path.join(root,'build/r06-portraits'+(assetsOnly?'-assets':'')));
const requestedPeriods=(argument('--periods')||'1,2,3,4').split(',').map(Number);
assert.ok(requestedPeriods.length&&requestedPeriods.every(n=>Number.isInteger(n)&&n>=1&&n<=4));
const standardSha='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const snapshots=new Map(),missing=new Set(),pendingResponses=[];
let delayedPath=null;
const report={startedAt:new Date().toISOString(),staged,assetsOnly,allowPartial,requestedPeriods,
    sources:{},requests:[],assets:[],fallbacks:[],sessions:[],contexts:[],phases:[],exceptions:[],console:[],dialogs:[],blocked:[],
    scope:'39 genuine HD PNG loading matrix; native three-context representatives by period; VM tests cover all manifest identities'};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
    '.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg',
    '.jpeg':'image/jpeg','.lib':'application/octet-stream'};
const engines=['baye.js','baye.wasm','baye.wasm.map','baye.build.json'];
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const filename=path.join(directory,entry.name);return entry.isDirectory()?walk(filename):[filename];});}
function freeze(rel,filename=path.join(root,rel)){
    const bytes=fs.readFileSync(filename),metadata={source:path.relative(root,filename).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)};
    snapshots.set(rel,{bytes,metadata});report.sources[rel]=metadata;
}
function prepareAssets(){
    const runner=fs.readFileSync(fileURLToPath(import.meta.url));report.runner={bytes:runner.length,sha256:sha(runner)};
    for(const directory of ['js','css','assets'])for(const filename of walk(path.join(root,directory)))
        freeze(path.relative(root,filename).replaceAll('\\','/'),filename);
    for(const rel of ['pc.html','hd-portrait-smoke.html','libs/dat-mod.lib','libs/sc-mod.lib',
        'scripts/dump-hd-portraits.mjs','scripts/test-hd-portraits.mjs'])freeze(rel);
    if(staged)for(const name of engines)freeze('js/'+name,path.join(root,'build/wasm/src',name));
    report.engineManifest=JSON.parse(snapshots.get('js/baye.build.json').bytes.toString('utf8'));
    for(const name of engines.filter(n=>n!=='baye.build.json')){const actual=report.sources['js/'+name],declared=report.engineManifest.artifacts[name];
        assert.equal(actual.bytes,declared.bytes);assert.equal(actual.sha256,declared.sha256,'actual engine manifest '+name);}
    assert.equal(report.sources['libs/dat-mod.lib'].sha256,standardSha);
    report.manifest=JSON.parse(snapshots.get('assets/hd-portraits/manifest.json').bytes.toString('utf8'));
    report.references=JSON.parse(snapshots.get('assets/hd-portraits/refs/index.json').bytes.toString('utf8'));
    assert.equal(report.manifest.libSha256,standardSha);assert.equal(report.references.libSha256,standardSha);
    const entries=report.manifest.entries.filter(e=>e&&!e.missing);assert.equal(entries.length,39,'actual 39 period/person portrait slots');
    const keys=new Set();for(const e of entries){assert.ok(Number.isInteger(e.personId)&&e.personId>=0&&e.period>=1&&e.period<=4);
        assert.ok(!keys.has(e.period+':'+e.personId));keys.add(e.period+':'+e.personId);
        const period=report.references.periods.find(p=>p.period===e.period),person=period.people.find(p=>p.id===e.personId&&!p.skipped);
        assert.ok(person);assert.equal(person.name,e.name);assert.equal(e.ref,'refs/'+person.file);
        const rel='assets/hd-portraits/'+e.hd,bytes=snapshots.get(rel)?.bytes;
        if(!bytes){assert.ok(allowPartial,'missing genuine HD slot '+rel);continue;}
        assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
        const nativeBytes=snapshots.get('assets/hd-portraits/'+e.ref).bytes;
        assert.notEqual(sha(bytes),sha(nativeBytes),'HD file is not a copied native reference '+rel);
        const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
        assert.ok(width>100&&height>100,'HD PNG is genuinely larger than native ref '+rel);
        report.assets.push({period:e.period,personId:e.personId,name:e.name,path:rel,width,height,sha256:sha(bytes)});
    }
    if(!allowPartial)assert.equal(report.assets.length,39);
}
const previewHtml=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/hd-portraits.css"></head>
<body data-hd-portrait-manual="1"><figure id="hd-portrait" class="hd-portrait" hidden><img id="hd-portrait-img"><figcaption id="hd-portrait-cap"></figcaption></figure>
<script src="/js/hd-lib-identity.js"></script><script src="/js/hd-portraits.js"></script></body></html>`;
async function startServer(){
    const server=http.createServer((req,res)=>{try{
        const pathname=new URL(req.url,'http://localhost').pathname,rel=decodeURIComponent(pathname).replace(/^\/+/, '')||'pc.html';
        if(rel==='__portrait-assets.html'){res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'}).end(previewHtml);return;}
        const filename=path.resolve(root,rel);if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
        if(!snapshots.has(rel)&&fs.existsSync(filename)&&fs.statSync(filename).isFile())freeze(rel,filename);
        const item=snapshots.get(rel),status=missing.has(rel)||!item?404:200;
        report.requests.push({path:pathname,status,controlled:missing.has(rel),...(item?.metadata||{})});
        const finish=()=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});
            res.end(status===200?item.bytes:'controlled missing asset');};
        if(rel===delayedPath){pendingResponses.push({rel,finish});return;}finish();
    }catch(error){report.serverErrors||=[];report.serverErrors.push(String(error));res.writeHead(400).end();}});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;
}
function releaseImages(){delayedPath=null;for(const p of pendingResponses.splice(0))p.finish();}

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
async function key(cdp,name){const codes={Enter:13,Escape:27,ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,h:72};assert.ok(codes[name]);
    for(const type of ['keyDown','keyUp'])await cdp.send('Input.dispatchKeyEvent',{type,key:name,code:name==='h'?'KeyH':name,
        windowsVirtualKeyCode:codes[name],nativeVirtualKeyCode:codes[name]});await delay(140);}
async function pointer(cdp,x,y){await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});await delay(160);}
async function button(cdp,selector){const point=await evaluate(cdp,`(() => {const n=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>{
    const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';});
    if(!n)return null;const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);
    return {x,y,hit:t===n||n.contains(t),top:t&&(t.id||t.tagName)};})()`);assert.ok(point?.hit,'actual unobstructed button '+selector+' '+JSON.stringify(point));
    await pointer(cdp,point.x,point.y);}
const portraitExpression=`(() => {if(!window.BayeHdPortraits)return null;const r=document.getElementById('hd-portrait'),i=document.getElementById('hd-portrait-img');return {
    debug:BayeHdPortraits.debugSnapshot(),detected:BayeHdPortraits.detectView(),hidden:!r||r.hidden,src:i&&i.getAttribute('src'),
    complete:i&&i.complete,width:i&&i.naturalWidth,height:i&&i.naturalHeight,
    attrs:r&&{context:r.getAttribute('data-context'),id:r.getAttribute('data-person-id'),period:r.getAttribute('data-period'),mode:r.getAttribute('data-hd-portrait')},
    parent:r&&r.parentNode.id,caption:document.getElementById('hd-portrait-cap')?.textContent};})()`;
async function checkpoint(cdp,name,extra={}){const state=await evaluate(cdp,`({portrait:${portraitExpression},identity:window.BayeHdLibIdentity?BayeHdLibIdentity.read():null,
    period:window.baye&&Number(baye.data.g_PIdx),king:window.baye&&Number(baye.data.g_PlayerKing),
    menu:window.baye&&baye.hd.menuItems(),march:window.baye&&baye.hd.march(),fight:window.baye&&baye.hd.fight(),
    help:window.baye&&baye.hd.help(),keys:window.__r06Keys?.length})`);
    const screenshot=String(report.phases.length+1).padStart(2,'0')+'-'+name+'.png';
    report.phases.push({name,screenshot,...extra,state});const image=await cdp.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(artifactDir,screenshot),Buffer.from(image.data,'base64'));console.log('PASS',name);return state;}
async function previewReady(cdp,origin){await cdp.send('Page.navigate',{url:origin+'/__portrait-assets.html?t='+Date.now()});
    await waitFor(cdp,'manual asset module','window.BayeHdPortraits&&BayeHdPortraits.debugSnapshot().manifest');}
async function assetDisplay(cdp,entry,mode){const source=await evaluate(cdp,`(async()=>{const s=await BayeHdPortraits.applyView({context:'map-king',
    personId:${entry.personId},period:${entry.period},name:${JSON.stringify(entry.name)}});return s;})()`);
    assert.equal(source.mode,mode);if(mode!=='lcd')assert.equal(source.preview,true,'asset matrix cannot impersonate a live native identity');
    const p=await waitFor(cdp,'actual image decode or LCD fallback',`(() => {const p=${portraitExpression};return ${JSON.stringify(mode)}==='lcd'?p.hidden&&p:p.complete&&p.width>0&&p;})()`);
    if(mode!=='lcd'){assert.equal(p.attrs.id,String(entry.personId));assert.equal(p.attrs.period,String(entry.period));
        assert.equal(p.hidden,false);assert.equal(p.attrs.mode,mode);assert.ok(p.width>8&&p.height>8);
        if(mode==='hd'){assert.ok(p.width>100&&p.height>100);assert.equal(source.url,'assets/hd-portraits/'+entry.hd);}}
    assert.equal(p.debug.identity.status,'unavailable');return {source,portrait:p};}
async function assetMatrix(cdp,origin){await previewReady(cdp,origin);
    for(const e of report.manifest.entries.filter(e=>!e.missing&&snapshots.has('assets/hd-portraits/'+e.hd))){
        const observed=await assetDisplay(cdp,e,'hd'),record=report.assets.find(a=>a.period===e.period&&a.personId===e.personId);
        assert.equal(observed.portrait.width,record.width);assert.equal(observed.portrait.height,record.height);record.decoded=true;record.preview=true;}
    await checkpoint(cdp,'01-all-real-hd-assets',{decoded:report.assets.length,previewOnly:true});
    const nonpilot=report.references.periods.flatMap(p=>p.people.filter(x=>!x.skipped).map(x=>({period:p.period,personId:x.id,name:x.name,ref:'refs/'+x.file})))
        .find(e=>!report.manifest.entries.some(m=>m.period===e.period&&m.personId===e.personId));assert.ok(nonpilot,'genuine nonpilot reference fallback');
    report.fallbacks.push({kind:'nonpilot-reference',...nonpilot,...await assetDisplay(cdp,nonpilot,'ref')});
    const first=report.manifest.entries.find(e=>!e.missing&&snapshots.has('assets/hd-portraits/'+e.hd));assert.ok(first);
    missing.add('assets/hd-portraits/'+first.hd);await previewReady(cdp,origin);
    report.fallbacks.push({kind:'controlled-hd-404',period:first.period,personId:first.personId,...await assetDisplay(cdp,first,'ref')});
    missing.add('assets/hd-portraits/'+first.ref);await previewReady(cdp,origin);
    report.fallbacks.push({kind:'controlled-hd-and-ref-404',period:first.period,personId:first.personId,...await assetDisplay(cdp,first,'lcd')});
    await checkpoint(cdp,'02-controlled-fallbacks',{productionBytesUnchanged:true});missing.clear();await previewReady(cdp,origin);
    report.fallbacks.push({kind:'restored-real-hd',period:first.period,personId:first.personId,...await assetDisplay(cdp,first,'hd')});
}
async function standalonePages(cdp,origin){await cdp.send('Page.navigate',{url:origin+'/hd-portrait-smoke.html'});
    const auto=await waitFor(cdp,'shipped smoke page default auto','window.__hdPortraitSmoke');assert.equal(auto.ok,true);assert.equal(auto.previewOnly,true);
    assert.equal(auto.expect,'auto');assert.equal(auto.actualMode,'hd');
    const nonpilot=report.references.periods.flatMap(p=>p.people.filter(x=>!x.skipped).map(x=>({period:p.period,personId:x.id})))
        .find(e=>!report.manifest.entries.some(m=>m.period===e.period&&m.personId===e.personId));
    await cdp.send('Page.navigate',{url:origin+'/hd-portrait-smoke.html?expect=ref&period='+nonpilot.period+'&personId='+nonpilot.personId});
    const ref=await waitFor(cdp,'shipped smoke nonpilot real reference','window.__hdPortraitSmoke');assert.equal(ref.ok,true);assert.equal(ref.previewOnly,true);
    assert.equal(ref.actualMode,'ref');assert.equal(ref.personId,nonpilot.personId);assert.equal(ref.period,nonpilot.period);
    await cdp.send('Page.navigate',{url:origin+'/assets/hd-portraits/review.html'});
    await waitFor(cdp,'actual material comparison 39 cards','document.querySelectorAll("#gallery article").length===39');
    const cards=[];for(let i=0;i<39;i++){await evaluate(cdp,`document.querySelectorAll('#gallery article')[${i}].scrollIntoView({block:'center'})`);
        const expected=report.manifest.entries.filter(e=>!e.missing).sort((a,b)=>a.period-b.period||a.personId-b.personId)[i];
        const available=snapshots.has('assets/hd-portraits/'+expected.hd);
        if(available)await waitFor(cdp,'comparison HD and native pictures '+i,`(() => {const c=document.querySelectorAll('#gallery article')[${i}],i=c.querySelector('.current img'),n=c.querySelector('img.native');
            return i.complete&&i.naturalWidth>100&&n.complete&&n.naturalWidth>8;})()`);
        const card=await evaluate(cdp,`(() => {const c=document.querySelectorAll('#gallery article')[${i}],n=c.querySelector('img.native'),h=c.querySelector('.current img');
            return {label:c.querySelector('h2').textContent,ref:{src:n.getAttribute('src'),complete:n.complete,width:n.naturalWidth,height:n.naturalHeight},
                hd:{src:h.getAttribute('src'),complete:h.complete,width:h.naturalWidth,height:h.naturalHeight}};})()`);
        assert.equal(card.ref.src,expected.ref);assert.equal(card.hd.src,expected.hd);assert.ok(card.label.includes('人物 '+expected.personId));
        if(available){assert.ok(card.hd.width>100&&card.hd.height>100);assert.ok(card.ref.width>8&&card.ref.height>8);}cards.push({...card,available});}
    report.standalonePages={auto,nonpilot:ref,review:{cards,count:cards.length,available:cards.filter(c=>c.available).length}};
    await checkpoint(cdp,'00-shipped-comparison-preview',{previewOnly:true});
}
async function observeKeys(cdp){await evaluate(cdp,`(() => {window.__r06Keys=[];const original=window.sendKey;window.sendKey=function(code){
    window.__r06Keys.push({code,at:performance.now(),menu:baye.hd.menuItems(),fight:baye.hd.fight()});return original.apply(this,arguments);};
    window.__r06SpeSeen=[];const remember=()=>{const s=baye.hd.spe();if(s.id)window.__r06SpeSeen.push(s.id);};
    const originalSpe=BayeHdSpe.onEngineSpe;BayeHdSpe.onEngineSpe=function(){remember();return originalSpe.apply(this,arguments);};remember();})()`);}
async function boot(cdp,origin,period,lordName=null){await cdp.send('Page.navigate',{url:origin+'/pc.html?r06-period='+period+'&t='+Date.now()});
    await waitFor(cdp,'real LIB/WASM initialized','window.baye&&baye.hd&&baye.hd.ready()',60000);await observeKeys(cdp);
    for(let i=0;i<25;i++){if(await evaluate(cdp,'window.__r06SpeSeen.includes(100)'))break;
        if(await evaluate(cdp,'baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)'))await key(cdp,'Enter');else await delay(150);}
    await waitFor(cdp,'actual title','window.__r06SpeSeen.includes(100)');await key(cdp,'Enter');
    await waitFor(cdp,'actual period chooser','window.__r06SpeSeen.includes(104)');
    for(let i=1;i<period;i++)await key(cdp,'ArrowDown');await key(cdp,'Enter');
    await waitFor(cdp,'native selected period and lord list',`Number(baye.data.g_PIdx)===${period}&&baye.hd.kings().count>0`);
    const kings=await evaluate(cdp,'baye.hd.kings()'),preferred=period===4?['孙权','刘备','曹丕']:['马腾','曹操','刘备','孙权'];
    const name=lordName||preferred.find(n=>kings.kings.some(k=>k.name===n)),target=kings.kings.findIndex(k=>k.name===name);
    assert.ok(target>=0,'genuine representative pilot lord available in period '+period);
    for(let i=kings.index;i<target;i++){await key(cdp,'ArrowDown');await waitFor(cdp,'lord native cursor',`baye.hd.kings().index===${i+1}`);}
    for(let i=kings.index;i>target;i--){await key(cdp,'ArrowUp');await waitFor(cdp,'lord native cursor',`baye.hd.kings().index===${i-1}`);}
    const selected=await evaluate(cdp,'baye.hd.kings()');assert.equal(selected.kings[selected.index].name,name);await key(cdp,'Enter');
    await waitFor(cdp,'real PlayerTactic map','baye.hd.march().pick===1&&baye.hd.realm().ownedCount>0');
    await evaluate(cdp,"BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd');BayeHdBattle.setMode('hd')");
    await waitFor(cdp,'trusted map presentation','BayeHdOverworld.debugSnapshot().presentationReady&&BayeHdOverworld.debugSnapshot().hitsEnabled');
    const identity=await evaluate(cdp,'BayeHdLibIdentity.read()');assert.equal(identity.sha256,standardSha);assert.equal(identity.status,'ready');
    const actual=await evaluate(cdp,'({period:Number(baye.data.g_PIdx),personId:Number(baye.data.g_PlayerKing),name:baye.getPersonName(Number(baye.data.g_PlayerKing))})');
    assert.deepEqual(actual,{period,personId:selected.kings[selected.index].id,name});
    const context=await verifyContext(cdp,'map-king',actual);report.sessions.push({period,kings:kings.kings,selected:selected.kings[selected.index],mapPortrait:context});
    await checkpoint(cdp,'period-'+period+'-map-lord');return actual;
}
async function verifyContext(cdp,context,expected){const p=await waitFor(cdp,'actual '+context+' portrait for '+expected.name,`(() => {const p=${portraitExpression};
    return p.detected&&p.detected.context===${JSON.stringify(context)}&&p.detected.personId===${expected.personId}&&p.detected.period===${expected.period}&&
    !p.hidden&&p.complete&&p.width>0&&p.attrs.id===${JSON.stringify(String(expected.personId))}&&p.attrs.period===${JSON.stringify(String(expected.period))}&&p;})()`);
    const e=report.manifest.entries.find(e=>e.period===expected.period&&e.personId===expected.personId),hd=e?.hd&&snapshots.has('assets/hd-portraits/'+e.hd);
    assert.equal(p.attrs.mode,hd?'hd':'ref');if(hd){assert.ok(p.width>100&&p.height>100);assert.equal(p.src,'assets/hd-portraits/'+e.hd);}
    assert.equal(p.detected.name,expected.name);assert.equal(p.debug.preview,false);assert.equal(p.debug.identity.sha256,standardSha);
    assert.equal(p.detected.personId,Number(p.attrs.id));report.contexts.push({context,...expected,portrait:p});return p;}
async function viewportPortrait(cdp,label,context){const nativeExpression='({menu:baye.hd.menuItems(),fight:baye.hd.fight(),help:baye.hd.help(),march:baye.hd.march()})';
    const before=await evaluate(cdp,nativeExpression),p=await evaluate(cdp,portraitExpression),keys=await evaluate(cdp,'window.__r06Keys.length');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await delay(250);
    const viewport=await evaluate(cdp,'({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
    assert.deepEqual(viewport,{width:1280,height:720,dpr:1});
    const shown=await waitFor(cdp,'same current portrait in 720p',`(() => {const p=${portraitExpression};return !p.hidden&&p.complete&&p.attrs.context===${JSON.stringify(context)}&&p;})()`);
    assert.deepEqual(shown.detected,p.detected);assert.equal(shown.src,p.src);
    const geometry=await evaluate(cdp,`(() => {const i=document.getElementById('hd-portrait-img'),r=i.getBoundingClientRect(),s=getComputedStyle(i),ancestors=[];let visible=true;
        for(let n=i;n;n=n.parentElement){const style=getComputedStyle(n),box=n.getBoundingClientRect();
            if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)visible=false;
            // BODY/HTML overflow can propagate to the viewport; their short
            // content box must not falsely clip fixed presentation panels.
            if(!['BODY','HTML'].includes(n.tagName)&&(style.overflowX==='hidden'||style.overflowX==='auto'||style.overflowY==='hidden'||style.overflowY==='auto')){
                if(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1)visible=false;}
            ancestors.push({id:n.id,tag:n.tagName,visibility:style.visibility,display:style.display,overflowX:style.overflowX,overflowY:style.overflowY});}
        return {visible:visible&&r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
            rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},objectFit:s.objectFit,ancestors};})()`);
    assert.equal(geometry.visible,true,'actual complete portrait pixels stay inside the 720p viewport and clipping parents');
    assert.equal(geometry.objectFit,'contain','new wide HD PNG remains fully visible');
    assert.deepEqual(await evaluate(cdp,nativeExpression),before,'resize preserves native owner, input and fields');assert.equal(await evaluate(cdp,'window.__r06Keys.length'),keys);
    report.viewportChecks||=[];report.viewportChecks.push({label,context,viewport,portrait:shown,geometry,nativeOwner:before,keys});await checkpoint(cdp,label);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await delay(200);
    assert.deepEqual(await evaluate(cdp,nativeExpression),before);assert.equal(await evaluate(cdp,'window.__r06Keys.length'),keys);
}
async function menuIndex(cdp,index){const start=await evaluate(cdp,'baye.hd.menuItems()');
    for(let i=start.index;i<index;i++){await key(cdp,'ArrowDown');await waitFor(cdp,'native person cursor down',`baye.hd.menuItems().index===${i+1}`);}
    for(let i=start.index;i>index;i--){await key(cdp,'ArrowUp');await waitFor(cdp,'native person cursor up',`baye.hd.menuItems().index===${i-1}`);}}
async function cityPortraits(cdp,period,{requireEnemy=true,wantedPerson=null}={}){const candidates=await evaluate(cdp,`(() => {const r=baye.hd.realm(),d=baye.data,n=baye.getPersonCount();return r.cities.filter(c=>c.owned).map(c=>{
    const city=d.g_Cities[c.i],start=Number(city.PersonQueue),count=Number(city.Persons),queue=[];
    if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||start+count>d.g_PersonsQueue.length)throw new Error('native owned queue bounds');
    for(let j=0;j<count;j++){const id=Number(d.g_PersonsQueue[start+j]);if(Number.isInteger(id)&&id>=0&&id<n&&Number(d.g_Persons[id].Belong)===Number(city.Belong))
        queue.push({id,name:baye.getPersonName(id),arms:Number(d.g_Persons[id].Arms)});}return {...c,persons:count,food:Number(city.Food),queue,links:baye.hd.cityLinks(c.i)};});})()`);
    report.sessions.at(-1).cityCandidates=candidates;
    const realm=await evaluate(cdp,'baye.hd.realm()'),origins=candidates.filter(c=>c.persons>0&&c.food>0&&
        (wantedPerson==null||c.queue.some(p=>p.id===wantedPerson))&&(!requireEnemy||c.links.some(l=>{
        const target=realm.cities.find(c=>c.i===l.index);return target&&target.belong>0&&!target.owned;})));
    const pilots=c=>c.queue.filter(p=>report.manifest.entries.some(e=>e.period===period&&e.personId===p.id&&snapshots.has('assets/hd-portraits/'+e.hd))).length;
    origins.sort((a,b)=>pilots(b)-pilots(a)||(b.i===8)-(a.i===8)||b.persons-a.persons);assert.ok(origins.length,'actual lord owns a city adjoining a genuine enemy in period '+period);
    const origin=origins[0],target=origin.links.find(l=>realm.cities.some(c=>c.i===l.index&&c.belong>0&&!c.owned));
    assert.ok(await evaluate(cdp,`BayeHdOverworld.walkToCity(${origin.i})`));
    await waitFor(cdp,'actual owned city root','BayeHdCityMenu.isOpen()&&BayeHdCityMenu.getLayer()==="root"&&baye.hd.menuItems().active');
    await button(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,'military submenu','BayeHdCityMenu.getLayer()==="sub"&&baye.hd.menuItems().names[0]==="侦察"');
    await button(cdp,'#hd-city-menu [data-hd-sub="4"]');
    await waitFor(cdp,'actual march person queue','baye.hd.march().phase===1&&baye.hd.menuItems().active&&BayeHdCityMenu.debugSnapshot().deepItems.length');
    const native=await evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${origin.i}],n=baye.getPersonCount(),queue=[],start=Number(c.PersonQueue),count=Number(c.Persons);
        if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||start+count>d.g_PersonsQueue.length)throw new Error('native city queue bounds');
        for(let j=0;j<count;j++){const id=Number(d.g_PersonsQueue[start+j]);
            if(Number.isInteger(id)&&id>=0&&id<n&&Number(d.g_Persons[id].Belong)===Number(c.Belong))queue.push({id,name:baye.getPersonName(id),arms:Number(d.g_Persons[id].Arms)});}
        return {menu:baye.hd.menuItems(),city:BayeHdCityMenu.debugSnapshot(),queue};})()`);
    assert.equal(native.menu.idsValid,true);assert.equal(native.menu.generation,native.menu.detailGeneration);
    assert.deepEqual(native.menu.ids,native.queue.map(p=>p.id),'actual picker IDs preserve the true owned city queue');
    assert.deepEqual(native.menu.names,native.queue.map(p=>p.name));
    const available=native.menu.ids.map((id,index)=>({id,index,name:native.menu.names[index],arms:native.queue[index].arms,entry:report.manifest.entries.find(e=>e.period===period&&e.personId===id)}));
    const representative=available.find(p=>p.id===wantedPerson)||available.find(p=>p.entry&&snapshots.has('assets/hd-portraits/'+p.entry.hd))||available[0];assert.ok(representative);
    await menuIndex(cdp,representative.index);const observed=await verifyContext(cdp,'person-info',{period,personId:representative.id,name:representative.name});
    const current=await evaluate(cdp,'({menu:baye.hd.menuItems(),city:BayeHdCityMenu.debugSnapshot()})');
    assert.equal(observed.detected.menuSeq,current.menu.seq);assert.equal(observed.detected.menuIndex,current.menu.index);
    assert.equal(observed.detected.menuOwnerKey,current.city.deepMenuOwner.key);
    assert.equal(observed.parent,'hd-city-menu-person-portrait');
    report.sessions.at(-1).city={origin,target,native,representative:{id:representative.id,index:representative.index,name:representative.name},observed};
    await checkpoint(cdp,'period-'+period+'-city-native-person');
    await viewportPortrait(cdp,'period-'+period+'-city-720p','person-info');
    // The server holds a genuine response while the real native cursor changes.
    // No fake Image, getter, memory write or application-generated input is used.
    if(available.length>1){const held=available.find(p=>p.id!==representative.id&&p.entry&&snapshots.has('assets/hd-portraits/'+p.entry.hd))||available.find(p=>p.id!==representative.id);
        const heldHd=held.entry?.hd&&snapshots.has('assets/hd-portraits/'+held.entry.hd);
        delayedPath='assets/hd-portraits/'+(heldHd?held.entry.hd:('refs/'+report.references.periods.find(p=>p.period===period).people.find(p=>p.id===held.id).file));
        await menuIndex(cdp,held.index);
        const deadline=Date.now()+8000;while(!pendingResponses.length&&Date.now()<deadline)await delay(80);
        assert.ok(pendingResponses.length,'actual HTTP portrait response is pending');
        const replacement=representative;await menuIndex(cdp,replacement.index);
        const next=await verifyContext(cdp,'person-info',{period,personId:replacement.id,name:replacement.name});
        const keys=await evaluate(cdp,'window.__r06Keys.length');releaseImages();await delay(700);
        const after=await evaluate(cdp,portraitExpression);assert.equal(after.attrs.id,String(replacement.id));assert.equal(after.detected.menuIndex,replacement.index);
        assert.equal(await evaluate(cdp,'window.__r06Keys.length'),keys,'late image delivery sends no native input');
        report.sessions.at(-1).lateImage={oldPerson:held.id,newPerson:replacement.id,before:next,after};
        await checkpoint(cdp,'period-'+period+'-late-old-image-retired');}
    return {origin,target,available,representative};
}
async function currentMarchPicker(cdp){
    // The selected-count ACK can precede the next picker/menu paint. A new
    // pointer action must belong to that observed native owner, not the still
    // retiring DOM from the prior selection. This wait never sends a key.
    return waitFor(cdp,'current native march picker and idle HD owner',`(() => {
        const march=baye.hd.march(),menu=baye.hd.menuItems(),city=BayeHdCityMenu.debugSnapshot(),owner=city.deepMenuOwner;
        if(march.phase!==1)return {march,menu,city};
        return menu.active===1&&menu.context===1&&menu.kind===3&&menu.idsValid&&owner&&
            owner.context===menu.context&&owner.kind===menu.kind&&owner.seq===menu.seq&&
            owner.detailGeneration===menu.detailGeneration&&city.deepKind==='person-city'&&
            city.deepItems.length===menu.count&&city.deepItems.every((p,i)=>p.pind===menu.ids[i])&&
            city.queueLen===0&&!city.sending&&!city.finishPersonsBusy&&{march,menu,city};})()`);
}
async function marchBattle(cdp,period,plan){
    // Explicitly select the actual HD representative first; additional real
    // queue entries provide a genuine army, with no troops or order injection.
    const initial=await currentMarchPicker(cdp);assert.equal(initial.march.phase,1);
    const m=initial.menu,targetIndex=m.ids.indexOf(plan.representative.id);assert.ok(targetIndex>=0);await menuIndex(cdp,targetIndex);
    await button(cdp,'#hd-city-menu [data-hd-deep="'+targetIndex+'"]');
    await waitFor(cdp,'native selection ACK','baye.hd.march().selected>0||baye.hd.march().phase!==1');
    for(let i=0;i<5;i++){const before=await currentMarchPicker(cdp);
        if(before.march.phase!==1||!before.menu.active||!before.menu.count)break;
        await button(cdp,'#hd-city-menu [data-hd-deep="0"]');await waitFor(cdp,'selected general ACK',`baye.hd.march().selected>${before.march.selected}||baye.hd.march().phase!==1`);}
    if((await currentMarchPicker(cdp)).march.phase===1)await button(cdp,'#hd-city-menu [data-hd-finish-persons]');
    await waitFor(cdp,'real food quantity','baye.hd.march().phase===2&&baye.hd.qty().active');
    await waitFor(cdp,'matching actual HD quantity dialog','BayeHdDialog.isQtyOpen()');
    await button(cdp,await evaluate(cdp,'BayeHdDialog.isQtyOpen()?"#hd-dialog [data-hd-dlg-ok]":"#hd-city-menu [data-hd-qty-ok]"'));
    await waitFor(cdp,'target instruction','baye.hd.march().phase===3');await evaluate(cdp,'BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'genuine march destination picker','baye.hd.march().phase===4&&baye.hd.march().battlePick===1');
    await evaluate(cdp,`BayeHdCityMenu.selectMarchTarget(${plan.target.index})`);
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4);await evaluate(cdp,`BayeHdCityMenu.confirmMarchTarget(${plan.target.index})`);
    await waitFor(cdp,'departure report','baye.hd.march().phase===6');const before=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await evaluate(cdp,'BayeHdCityMenu.continueMarch()');await waitFor(cdp,'actual AddFightOrder ACK','baye.hd.march().phase===7&&baye.hd.march().ok===1');
    await waitFor(cdp,'actual strategy ready after departure',`(() => {const m=baye.hd.march(),n=baye.hd.menuItems();return n.active&&[1,2].includes(n.context)||!n.active&&m.pick===1&&!m.battlePick&&m.mapInputSeq>${before};})()`);
    await evaluate(cdp,'BayeHdCityMenu.goStrategyEnd()');await waitFor(cdp,'actual native battle','baye.hd.fight().active&&!baye.hd.fight().over&&baye.hd.fight().inputKind===1',60000);
    const units=await evaluate(cdp,`(() => {const d=baye.data,n=baye.getPersonCount(),out=[];for(let i=0;i<20;i++){
        const id=Number(d.g_FgtParam.GenArray[i]),p=d.g_GenPos[i];if(id>0&&id<=n)out.push({slot:i,personId:id-1,name:baye.getPersonName(id-1),x:Number(p.x),y:Number(p.y),
            state:Number(p.state),active:Number(p.active),side:i<10?'player':'enemy'});}return out;})()`);
    const own=units.find(u=>u.side==='player'&&u.state!==8&&u.active===0&&u.personId===plan.representative.id);
    assert.ok(own);const result=await evaluate(cdp,`BayeHdBattle.clickUnitByName(${JSON.stringify(own.name)})`);assert.equal(result.ok,true);
    const actor=await waitFor(cdp,'real native actor ownership',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return !s.transaction&&[2,3].includes(f.inputKind)&&f.actorIndex===${own.slot}&&f;})()`);
    await evaluate(cdp,'BayeHdBattle.cancel()');await waitFor(cdp,'cancel only uncommitted actor movement','baye.hd.fight().inputKind===1&&!BayeHdBattle.debugSnapshot().transaction');
    for(let i=0;i<128;i++){const focus=await evaluate(cdp,'({x:Number(baye.data.g_FoucsX),y:Number(baye.data.g_FoucsY)})');if(focus.x===own.x&&focus.y===own.y)break;
        await key(cdp,focus.x!==own.x?(focus.x<own.x?'ArrowRight':'ArrowLeft'):(focus.y<own.y?'ArrowDown':'ArrowUp'));}
    await key(cdp,'h');await waitFor(cdp,'actual HELP captured for native battle actor','baye.hd.fight().inputKind===9&&baye.hd.help().active===1');
    const help=await evaluate(cdp,'baye.hd.help()');assert.equal(help.person,own.personId);assert.equal(help.slot,own.slot);assert.equal(help.name,own.name);
    assert.equal(help.complete,1);assert.equal(help.generation,help.detailGeneration);assert.equal(help.inputSeq,await evaluate(cdp,'baye.hd.fight().inputSeq'));
    const observed=await verifyContext(cdp,'battle-note',{period,personId:own.personId,name:own.name});
    report.sessions.at(-1).battle={origin:plan.origin.i,target:plan.target.index,units,actor,help,observed};
    await checkpoint(cdp,'period-'+period+'-battle-native-actor-help');
    await viewportPortrait(cdp,'period-'+period+'-battle-help-720p','battle-note');
    const keys=await evaluate(cdp,'window.__r06Keys.length');await delay(550);assert.deepEqual(await evaluate(cdp,'baye.hd.help()'),help);
    assert.equal(await evaluate(cdp,'window.__r06Keys.length'),keys,'portrait idle paints cannot issue battle keys');
    await button(cdp,'#hd-dialog [data-hd-dlg-ok]');await waitFor(cdp,'HELP owner retired','baye.hd.help().active===0&&baye.hd.fight().inputKind===1');
    await waitFor(cdp,'old battle portrait retired',`(() => {const p=${portraitExpression};return p.hidden&&p.detected===null;})()`);
    await checkpoint(cdp,'period-'+period+'-battle-help-retired');
}
async function unknownLibrary(cdp,unknownOrigin,standardOrigin){const requestStart=report.requests.length;
    report.currentLibrary='sc-mod';
    await cdp.send('Page.navigate',{url:unknownOrigin+'/pc.html?r06-unknown=1'});
    await waitFor(cdp,'genuine unknown LIB loaded','window.baye&&baye.hd&&baye.hd.ready()',60000);await observeKeys(cdp);
    const identity=await waitFor(cdp,'unknown actual bytes hashed','BayeHdLibIdentity.read().status==="ready"&&BayeHdLibIdentity.read()');
    assert.equal(identity.sha256,report.sources['libs/sc-mod.lib'].sha256);assert.notEqual(identity.sha256,standardSha);
    const p=await evaluate(cdp,portraitExpression);assert.equal(p.debug.supportedLib,false);assert.equal(p.detected,null);assert.equal(p.hidden,true);
    await delay(600);assert.equal(report.requests.slice(requestStart).filter(r=>r.path.startsWith('/assets/hd-portraits/')&&r.path.endsWith('.png')).length,0,
        'unknown actual LIB never requests standard portrait pictures');
    for(let i=0;i<25;i++){if(await evaluate(cdp,'window.__r06SpeSeen.includes(100)'))break;
        if(await evaluate(cdp,'baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)'))await key(cdp,'Enter');else await delay(150);}
    await waitFor(cdp,'Mod actual title','window.__r06SpeSeen.includes(100)');await key(cdp,'Enter');
    await waitFor(cdp,'Mod actual period chooser','window.__r06SpeSeen.includes(104)');await key(cdp,'Enter');
    await waitFor(cdp,'Mod actual selectable lord','Number(baye.data.g_PIdx)===1&&baye.hd.kings().count>0');
    const lord=await evaluate(cdp,'baye.hd.kings()');await key(cdp,'Enter');
    const setup=await waitFor(cdp,'Mod actual new-game setup',`(() => {if(baye.hd.march().pick===1&&baye.hd.realm().ownedCount>0)return {kind:'map'};
        const m=baye.hd.menuItems();return m.active&&m.context===0&&m.count===4&&m.names.every(n=>n.startsWith('难度选择'))&&{kind:'difficulty',menu:m};})()`);
    let confirmation=null;if(setup.kind==='difficulty'){assert.equal(setup.menu.index,0);await key(cdp,'Enter');
        confirmation=await waitFor(cdp,'Mod normal difficulty confirmation',`(() => {const m=baye.hd.menuItems();return m.active&&m.context===0&&m.count===2&&
            m.index===0&&m.names[0]==='确认选择-普通版'&&m.names[1]==='返回难度选择'&&m;})()`);await key(cdp,'Enter');}
    await waitFor(cdp,'real Mod new-game map','baye.hd.march().pick===1&&baye.hd.realm().ownedCount>0');
    await evaluate(cdp,"BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd')");await delay(450);
    const fallback=await evaluate(cdp,`(() => {const p=${portraitExpression},n=document.querySelector('.container.js-baye-pc-lcd'),s=getComputedStyle(n),r=n.getBoundingClientRect();
        return {portrait:p,map:BayeHdOverworld.debugSnapshot(),lcd:{visibility:s.visibility,display:s.display,width:r.width,height:r.height},menu:baye.hd.menuItems()};})()`);
    assert.equal(fallback.portrait.hidden,true);assert.equal(fallback.portrait.detected,null);assert.equal(fallback.map.presentationReady,false);
    assert.equal(fallback.lcd.visibility,'visible');assert.notEqual(fallback.lcd.display,'none');assert.ok(fallback.lcd.width>0&&fallback.lcd.height>0);
    const keys=await evaluate(cdp,'window.__r06Keys.length'),cursor=await evaluate(cdp,'({x:Number(baye.data.g_CityPos.setx),y:Number(baye.data.g_CityPos.sety)})');
    assert.equal(await evaluate(cdp,'BayeHdOverworld.walkToCity(0)'),false);assert.equal(await evaluate(cdp,'window.__r06Keys.length'),keys);
    assert.deepEqual(await evaluate(cdp,'({x:Number(baye.data.g_CityPos.setx),y:Number(baye.data.g_CityPos.sety)})'),cursor);
    await checkpoint(cdp,'unknown-real-lib-native-map-fallback');await key(cdp,'Enter');
    const nativeCity=await waitFor(cdp,'real Mod classic city menu','baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems()');
    assert.equal(nativeCity.names[0],'内政');assert.ok(await evaluate(cdp,'window.__r06Keys.length')>keys,'classic native input remains playable');
    report.unknownLibrary={identity,portrait:p,classicInput:true,lord,setup,confirmation,fallback,nativeCity,fullModBattle:false};
    await checkpoint(cdp,'unknown-real-lib-native-city-fallback');report.currentLibrary='standard';
    await boot(cdp,standardOrigin,1);report.unknownLibrary.restored=await evaluate(cdp,portraitExpression);await checkpoint(cdp,'standard-lib-restored-native-map');
}
async function main(){
    fs.mkdirSync(artifactDir,{recursive:true});assert.equal(typeof WebSocket,'function','Node22+ built-in WebSocket');prepareAssets();
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-portraits-runtime-'));let server,unknownServer,chrome,cdp,chromeError;
    const interrupt=()=>{report.interrupted=true;if(cdp)cdp.close();if(chrome&&chrome.exitCode===null)chrome.kill('SIGTERM');
        if(server)server.closeAllConnections();if(unknownServer)unknownServer.closeAllConnections();};
    process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{server=await startServer();unknownServer=await startServer();
        const origin='http://127.0.0.1:'+server.address().port,unknownOrigin='http://127.0.0.1:'+unknownServer.address().port,debugPort=await unusedPort();
        report.origins={standard:origin,unknown:unknownOrigin};assert.notEqual(server.address().port,8080);assert.notEqual(unknownServer.address().port,8080);
        const candidates=['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome'];
        const binary=process.env.CHROME||candidates.find(f=>fs.existsSync(f));assert.ok(binary,'Set CHROME to Chrome/Chromium');
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking',
            '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
            '--window-size=1920,1080','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
        chrome.on('error',error=>{chromeError=error;});let target;const deadline=Date.now()+15000;
        while(Date.now()<deadline){if(chromeError)throw chromeError;if(chrome.exitCode!==null)throw new Error('Chrome exited '+chrome.exitCode);
            try{target=(await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json())).find(t=>t.type==='page');if(target)break;}catch{}await delay(100);}
        assert.ok(target,'isolated CDP target');cdp=await connectCdp(target.webSocketDebuggerUrl);
        report.browser=await cdp.send('Browser.getVersion');
        cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));
        cdp.on('Runtime.consoleAPICalled',e=>{report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')});if(report.console.length>150)report.console.shift();});
        cdp.on('Page.javascriptDialogOpening',e=>{const expected=report.currentLibrary==='sc-mod'&&e.type==='prompt'&&e.message==='来将可留姓名？'&&
            e.defaultPrompt==='常山赵子龙'&&!(report.nativeDialogs?.length);
            if(expected){report.nativeDialogs||=[];report.nativeDialogs.push({type:e.type,message:e.message,defaultPrompt:e.defaultPrompt,response:'测试玩家'});}
            else report.dialogs.push(e.message);
            cdp.send('Page.handleJavaScriptDialog',expected?{accept:true,promptText:'测试玩家'}:{accept:false}).catch(()=>{});});
        cdp.on('Fetch.requestPaused',e=>{const local=[origin,unknownOrigin].includes(new URL(e.request.url).origin);if(!local)report.blocked.push(e.request.url);
            cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
        await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();
            localStorage.setItem('baye/libpath',location.origin===${JSON.stringify(unknownOrigin)}?'libs/sc-mod.lib':'libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode','classic');localStorage.setItem('baye/systemUiMode','classic');localStorage.setItem('baye/cityMenuMode','classic');`});
        await standalonePages(cdp,origin);await assetMatrix(cdp,origin);
        if(!assetsOnly){for(const period of requestedPeriods){await boot(cdp,origin,period);
                if(period===4){await cityPortraits(cdp,period,{requireEnemy:false,wantedPerson:2});
                    // 孙权 is genuinely stationed in 吴, whose only neighbour
                    // is friendly 建业. A separate legitimate 刘禅 new game
                    // locates the actual 诸葛亮 queue before planning battle.
                    await boot(cdp,origin,period,'刘禅');const plan=await cityPortraits(cdp,period,{wantedPerson:72});await marchBattle(cdp,period,plan);
                }else{const plan=await cityPortraits(cdp,period);await marchBattle(cdp,period,plan);}}
            await unknownLibrary(cdp,unknownOrigin,origin);}
        report.coverage={realHdPngDecoded:report.assets.filter(a=>a.decoded).length,manualPreviewOnly:true,
            realPeriods:report.sessions.filter(s=>s.battle).map(s=>s.period),
            nativeMapLords:report.contexts.filter(c=>c.context==='map-king').length,
            nativeCitySelections:report.contexts.filter(c=>c.context==='person-info').length,
            nativeBattleActors:report.contexts.filter(c=>c.context==='battle-note').length,
            lateImages:report.sessions.filter(s=>s.lateImage).length,controlledMissingFixtures:2,nonPilotRef:true,
            all39ActuallyInBattle:false,unknownActualLib:!!report.unknownLibrary};
        if(!assetsOnly){assert.equal(report.coverage.nativeBattleActors,requestedPeriods.length);assert.deepEqual(report.coverage.realPeriods,requestedPeriods);}
        assert.deepEqual(report.exceptions,[],'zero uncaught browser exceptions');assert.deepEqual(report.dialogs,[],'no unexpected native dialogs');report.ok=true;
    }catch(error){report.ok=false;report.error=error.stack||String(error);process.exitCode=1;console.error(report.error);
        if(cdp){try{report.failureState=await evaluate(cdp,`({portrait:${portraitExpression},menu:window.baye&&baye.hd.menuItems(),march:window.baye&&baye.hd.march(),
            fight:window.baye&&baye.hd.fight(),keys:window.__r06Keys})`);}catch{}
            try{const image=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(image.data,'base64'));}catch{}}
    }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);releaseImages();if(cdp)cdp.close();
        if(chrome&&chrome.exitCode===null){const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([stopped,delay(1500)]);
            if(chrome.exitCode===null){chrome.kill('SIGKILL');await Promise.race([stopped,delay(1500)]);}}
        for(const s of [server,unknownServer])if(s){s.closeAllConnections();await new Promise(resolve=>s.close(resolve));}
        const resolved=path.resolve(profile);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('baye-portraits-runtime-'));
        fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});report.finishedAt=new Date().toISOString();
        report.sourceDrift=[];const verification={};for(const [rel,item] of snapshots){const filename=path.join(root,item.metadata.source),exists=fs.existsSync(filename),current=exists?sha(fs.readFileSync(filename)):null;
            verification[rel]={...item.metadata,currentSha256:current,match:current===item.metadata.sha256};
            if(current!==item.metadata.sha256)report.sourceDrift.push({path:rel,reason:exists?'changed':'missing',expected:item.metadata.sha256,actual:current});}
        const runnerPath=fileURLToPath(import.meta.url),runnerCurrent=fs.existsSync(runnerPath)?sha(fs.readFileSync(runnerPath)):null;
        verification.runner={...report.runner,currentSha256:runnerCurrent,match:runnerCurrent===report.runner.sha256};
        if(runnerCurrent!==report.runner.sha256)report.sourceDrift.push({path:path.relative(root,runnerPath),reason:runnerCurrent?'changed':'missing',expected:report.runner.sha256,actual:runnerCurrent});
        fs.writeFileSync(path.join(artifactDir,'source-verification.json'),JSON.stringify(verification,null,2)+'\n');
        if(report.sourceDrift.length){report.ok=false;process.exitCode=1;report.error||='Source freeze changed during acceptance; see sourceDrift';}
        fs.writeFileSync(path.join(artifactDir,'result.json'),JSON.stringify(report,null,2)+'\n');console.log('Artifacts:',artifactDir);if(report.ok)console.log('Real portrait acceptance passed',report.coverage);
    }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
