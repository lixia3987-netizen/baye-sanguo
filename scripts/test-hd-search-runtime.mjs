/**
 * Real SEARCH HD acceptance. Private server/profile; no month, recruitment or battle.
 * node scripts/test-hd-search-runtime.mjs --preflight-only --artifact-dir build/r17-search-preflight
 * CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/test-hd-search-runtime.mjs --artifact-dir build/r17-search-installed
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=process.argv.slice(2),allowed=new Set(['--preflight-only','--artifact-dir']);
for(let i=0;i<cli.length;i++){assert.ok(allowed.has(cli[i]),'Unsupported argument: '+cli[i]);if(cli[i]==='--artifact-dir'){assert.ok(cli[i+1]&&!cli[i+1].startsWith('--'),'Artifact path is required');i++;}}
assert.equal(new Set(cli.filter(v=>v.startsWith('--'))).size,cli.filter(v=>v.startsWith('--')).length,'Duplicate flags are rejected');
const preflightOnly=cli.includes('--preflight-only'),artifactIndex=cli.indexOf('--artifact-dir');
const artifactDir=path.resolve(artifactIndex<0?path.join(root,'build/r17-search-runtime'):cli[artifactIndex+1]);
const period=2,originCity=26,lordPerson=12,searchPerson=110;
const viewport={width:1920,height:1080},viewports=[viewport,{width:1280,height:720}];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const childExited=child=>!child||child.exitCode!==null||child.signalCode!==null;
const report={startedAt:new Date().toISOString(),preflightOnly,period,originCity,lordPerson,searchPerson,viewports,phases:[],inputs:[],console:[],exceptions:[],dialogs:[],blocked:[],requests:[],worldObservations:[],detailChecks:[],resizes:[],staleChecks:[]};
const servedAssets=new Map(),productionDirectories=['js','css','assets','vendor/iBaye/src'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.lib':'application/octet-stream'};
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(directory,item.name)):[path.join(directory,item.name)]);
let nativeLib;
function freezeAsset(name){
    name=name.replaceAll('\\','/');assert.ok(!path.isAbsolute(name)&&!name.split('/').includes('..'));
    if(servedAssets.has(name))return servedAssets.get(name);
    const data=fs.readFileSync(path.join(root,name)),metadata={source:name,bytes:data.length,sha256:sha(data)};
    report.sources[name]=metadata;servedAssets.set(name,{data,metadata});return servedAssets.get(name);
}
function nativeItem(id,index=0){
    const b=nativeLib,address=b.readUInt32LE((id-1)*4);assert.ok(address>0&&address+14<=b.length);
    const length=b.readUInt32LE(address),count=b.readUInt16LE(address+6),fixed=b.readUInt32LE(address+8);
    assert.equal(b.readUInt16LE(address+4),id);assert.ok(index>=0&&index<count&&address+length<=b.length);assert.equal(b[address+12],0);
    const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(address+14+index*8),size=fixed||(count===1?length-14:b.readUInt32LE(address+18+index*8));
    assert.ok(offset>=14&&size>0&&offset+size<=length);return b.subarray(address+offset,address+offset+size);
}
function prepareServedAssets(){
    report.sources={};for(const dir of productionDirectories)for(const f of walk(path.join(root,dir)))freezeAsset(path.relative(root,f));
    freezeAsset('scripts/write-wasm-manifest.mjs');nativeLib=freezeAsset('libs/dat-mod.lib').data;freezeAsset('pc.html');freezeAsset('qr.png');freezeAsset('favicon.png');freezeAsset('fonts/HarmonyOS_Sans_SC_Regular.ttf');
    assert.equal(sha(nativeLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    const runner=freezeAsset(path.relative(root,fileURLToPath(import.meta.url)));report.tool=runner.metadata;
    const build=JSON.parse(servedAssets.get('js/baye.build.json').data);
    for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const m=report.sources['js/'+name];assert.equal(m.bytes,build.artifacts[name].bytes);assert.equal(m.sha256,build.artifacts[name].sha256);}
    const tracked=execFileSync('git',['ls-files','-z','vendor/iBaye'],{cwd:root}).toString('utf8').split('\0').filter(Boolean).sort(),hash=crypto.createHash('sha256'),files=[];
    for(const name of tracked){const f=freezeAsset(name);hash.update(name+'\0');hash.update(f.data);files.push({name,...f.metadata});}
    report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),expected:build.engineSourceSha256,files};
    assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256,'Installed engine matches actual native source bytes');report.engineManifest=build;
    const cities=nativeItem(57,1),people=nativeItem(61,1),queue=nativeItem(65,1),c=cities.subarray(26*37,27*37),offset=c.readUInt16LE(29),count=c.readUInt16LE(31);
    const ids=Array.from({length:count},(_,i)=>queue.readUInt16LE((offset+i)*2));assert.equal(cities.readUInt16LE(38*37),198);
    const owned=ids.filter(id=>people.readUInt16LE(id*19+2)===13);assert.ok(owned.includes(lordPerson)&&owned.includes(searchPerson));assert.ok(ids.includes(171)&&!owned.includes(171));
    const thew=nativeItem(2,9)[3],money=nativeItem(2,10)[3];assert.equal(thew,8);assert.equal(money,0);
    const source=servedAssets.get('vendor/iBaye/src/citycmdb.c').data.toString('utf8'),start=source.indexOf('FAR U8 SearchMake(U8 city)'),end=source.indexOf('\n}',start);
    assert.ok(start>=0&&end>start);const body=source.slice(start,end);assert.ok(body.indexOf('ShowGReport(p,str)')<body.indexOf('AddOrderHead(&order)'));assert.ok(body.includes('DelPerson(city,p)'));
    report.nativeContract={commandId:3,city:26,personIDs:ids,initialOwnedIDs:owned,thew,money,personIDType:'U16 zero based',source:'vendor/iBaye/src/citycmdb.c',reportBeforeAddOrder:true,notClaimed:'Static ROM/source only; no game, menu, SEARCH order or HD rendering accepted by preflight.'};
    report.freezeScope='Every JS/CSS/asset/native file, all Git tracked engine files, installed engine quartet, actual standard LIB, pc.html, actual BayeUI font and exact runner bytes. No ignored plan dependencies.';
}
async function startServer(){
    const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'pc.html',f=servedAssets.get(name);
        if(!f){report.requests.push({url:url.pathname,status:404});res.writeHead(404).end();return;}
        report.requests.push({url:url.pathname,status:200,...f.metadata});res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(f.data);
    }catch{res.writeHead(400).end();}});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;
}
async function unusedPort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
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

const snapshotExpression=`(() => ({ready:baye.hd.ready(),generation:Number(baye.data.g_hdSpeGeneration),period:Number(baye.data.g_PIdx),playerKing:Number(baye.data.g_PlayerKing),menu:baye.hd.menuItems(),qty:baye.hd.qty(),report:baye.hd.report(),help:baye.hd.help(),march:baye.hd.march(),fight:baye.hd.fight(),city:BayeHdCityMenu.debugSnapshot(),dialog:BayeHdDialog.debugSnapshot(),system:BayeHdSystemUi.debugSnapshot(),map:BayeHdOverworld.debugSnapshot(),keyCount:window.__searchEngineKeys.length}))()`;
async function checkpoint(cdp,name){const state=await evaluate(cdp,snapshotExpression);assert.ok(!state.fight.active,'SEARCH validation never enters battle');report.phases.push({name,...state});console.log('PASS',name);const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,name+'.png'),Buffer.from(png.data,'base64'));return state;}
async function key(cdp,name){
    const codes={Enter:13,Escape:27,ArrowDown:40,ArrowUp:38};assert.ok(codes[name]);report.inputs.push({type:'physical-key',key:name,at:new Date().toISOString()});
    for(const type of ['keyDown','keyUp'])await cdp.send('Input.dispatchKeyEvent',{type,key:name,code:name,windowsVirtualKeyCode:codes[name],nativeVirtualKeyCode:codes[name]});await delay(100);
}
async function targetPoint(cdp,selector){
    const point=await evaluate(cdp,`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),s=getComputedStyle(n),x=r.x+r.width/2,y=r.y+r.height/2,t=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,visible:!!(r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'),hit:!!(t&&(t===n||n.contains(t))),top:t&&t.id};})()`);
    assert.ok(point&&point.visible&&point.hit,'Actually visible/hittable target '+selector);return {x:point.x,y:point.y};
}
async function mouse(cdp,type,point){await cdp.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});}
async function click(cdp,selector,pause=150){const point=await targetPoint(cdp,selector);report.inputs.push({type:'physical-pointer',selector,point,at:new Date().toISOString()});await mouse(cdp,'mousePressed',point);await mouse(cdp,'mouseReleased',point);if(pause)await delay(pause);}
async function installKeyObserver(cdp){
    await evaluate(cdp,`(() => {window.__searchEngineKeys=[];window.__searchObserverErrors=[];let depth=0;const wrap=(owner,key)=>{const original=owner[key];if(typeof original!=='function')throw Error('Missing native input function '+key);owner[key]=function(code){if(!depth){try{window.__searchEngineKeys.push({code,at:performance.now(),generation:Number(baye.data.g_hdSpeGeneration),menu:baye.hd.menuItems(),report:baye.hd.report(),qty:baye.hd.qty(),march:baye.hd.march()});}catch(e){window.__searchObserverErrors.push(String(e));}}depth++;try{return original.apply(this,arguments);}finally{depth--;}};};wrap(window,'sendKey');wrap(baye,'sendKey');return true;})()`);
}
async function readKeys(cdp,start=0){return evaluate(cdp,`window.__searchEngineKeys.slice(${start})`);}
async function observeActualLib(cdp,stage){
    const expression=`(() => {const before=Number(baye.data.g_hdSpeGeneration),a=BayeHdLibIdentity.read(),hex=window.dynLib,b=BayeHdLibIdentity.read(),after=Number(baye.data.g_hdSpeGeneration);return {before,after,a,b,hex};})()`;
    const first=await evaluate(cdp,expression),last=await evaluate(cdp,expression),expected=report.sources['libs/dat-mod.lib'];
    for(const r of [first,last]){assert.equal(r.before,r.after);assert.ok(Number.isInteger(r.before)&&r.before>0);assert.equal(r.a.status,'ready');assert.equal(r.b.status,'ready');assert.equal(r.a.generation,r.b.generation);assert.equal(r.a.sha256,expected.sha256);assert.equal(r.b.sha256,expected.sha256);assert.ok(typeof r.hex==='string'&&/^(?:[0-9a-f]{2})+$/i.test(r.hex));const bytes=Buffer.from(r.hex,'hex');assert.equal(bytes.length,expected.bytes);assert.equal(sha(bytes),expected.sha256);}
    assert.equal(last.before,first.before);assert.equal(last.a.generation,first.a.generation);assert.equal(last.hex,first.hex);delete first.hex;delete last.hex;
    report.actualLib={stage,sha256:expected.sha256,bytes:expected.bytes,nativeGeneration:last.after,identityGeneration:last.b.generation};report.actualLibReads??=[];report.actualLibReads.push({stage,first,last});
}
const personFields=['Belong','OldBelong','Age','Character','Level','Force','IQ','Devotion','Experience','Thew','ArmsType','Arms','Tool1','Tool2'];
const worldExpression=`(() => {
    const d=baye.data,gen=Number(d.g_hdSpeGeneration),keys=window.__searchEngineKeys.length,c=d.g_Cities[26],count=baye.getPersonCount();
    const fields=${JSON.stringify(personFields)},persons=Array.from({length:count},(_,id)=>{const p=d.g_Persons[id],v={id,name:baye.getPersonName(id),derivedArm:baye.hd.personArmType(id)};for(const f of fields)v[f]=Number(p[f]);return v;});
    const queue=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));
    const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)!==255).map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),TimeCount:Number(o.TimeCount)}));
    const pos=d.g_CityPos,cursor={setx:Number(pos.setx),sety:Number(pos.sety),x:Number(pos.x),y:Number(pos.y)};
    return {gen,genAfter:Number(d.g_hdSpeGeneration),keys,keysAfter:window.__searchEngineKeys.length,period:Number(d.g_PIdx),playerKing:Number(d.g_PlayerKing),cityBelong:Number(c.Belong),money:Number(c.Money),food:Number(c.Food),reserve:Number(c.MothballArms),queueOffset:Number(c.PersonQueue),queue,persons,orders,cursor,date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)}};
})()`;
async function readWorld(cdp,label){const r=await evaluate(cdp,worldExpression);assert.equal(r.gen,r.genAfter,label+' native generation');assert.equal(r.keys,r.keysAfter,label+' readonly inputs');assert.equal(r.period,2);assert.equal(r.playerKing,12);assert.equal(r.cityBelong,13);assert.ok(r.persons.length&&r.persons.every(p=>personFields.every(f=>Number.isInteger(p[f])&&p[f]>=0&&p[f]<=65535)),'Native numeric person fields are fully available');report.worldObservations.push({label,world:r});return r;}
function worldFacts(r){const {keys,keysAfter,genAfter,...facts}=r;return facts;}
function assertWorldSame(a,b,label){assert.deepEqual(worldFacts(b),worldFacts(a),label+' preserves actual persons, resources, orders, queue, date and cursor');}
async function stableZeroInput(cdp,label,operation){const before=await readWorld(cdp,label+'-before');await operation();await delay(350);const after=await readWorld(cdp,label+'-after');assert.equal(after.keys,before.keys,label+' emits zero native keys');assertWorldSame(before,after,label);return {label,before,after};}
async function currentPersonPicker(cdp){
    return waitFor(cdp,'current actual HD SEARCH IDs/owner/rows',`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),d=baye.data,c=d.g_Cities[26],r=baye.hd.report(),q=baye.hd.qty(),h=baye.hd.help();
    if(!s.open||!s.showHd||s.layer!=='deep'||s.cityIndex!==26||s.deepKind!=='person'||s.deepLabel!=='搜寻'||s.sending||s.queueLen||r.active||q.active||h.active||!m.active||m.context!==1||m.kind!==3||!m.idsValid||!m.ids.length)return false;
    const ids=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong)),o=s.deepMenuOwner;
    if(JSON.stringify(ids)!==JSON.stringify(m.ids))throw Error('SEARCH IDs differ from actual allied queue');
    if(!o||o.seq!==m.seq||o.detailGeneration!==m.detailGeneration||o.context!==1||o.kind!==3||s.deepItems.length!==ids.length||!ids.every((id,i)=>s.deepItems.some(p=>p.i===i&&p.pind===id&&p.nativeId)))return false;
    return {menu:m,city:s,ids};})()`);
}
function ownerIdentity(p){return {context:p.menu.context,kind:p.menu.kind,seq:p.menu.seq,generation:p.menu.generation,detailGeneration:p.menu.detailGeneration,ids:p.menu.ids,key:p.city.deepMenuOwner.key};}
async function validateDetails(cdp,label,picker){
    const actual=await readWorld(cdp,label+'-native'),index=picker.menu.index,id=picker.ids[index],person=actual.persons[id];
    const data=await waitFor(cdp,label+' full actual person pane',`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),p=s.personDetail,n=document.getElementById('hd-city-menu-person-details'),fields=document.getElementById('hd-city-menu-person-fields');if(!p||p.ownerKey!==${JSON.stringify(picker.city.deepMenuOwner.key)}||p.nativeIndex!==${index}||p.personIndex!==${id}||m.seq!==${picker.menu.seq}||m.index!==${index}||!n||n.hidden||!fields)return false;return {detail:p,name:document.getElementById('hd-city-menu-person-name').textContent,rows:Array.from(fields.querySelectorAll('.hd-city-menu-stat'),r=>[r.querySelector('span').textContent,r.querySelector('strong').textContent])};})()`);
    assert.equal(data.name,person.name);assert.equal(data.detail.name,person.name);assert.equal(data.detail.personIndex,id);assert.equal(data.rows.length,15,'All original person detail rows render');
    const rows=new Map(data.rows);for(const [title,field] of [['年龄','Age'],['等级','Level'],['武力','Force'],['智力','IQ'],['忠诚值','Devotion'],['经验','Experience'],['体力','Thew'],['兵力','Arms']])assert.equal(rows.get(title),String(person[field]),'Complete native numeric detail '+title+' including U16 arms');
    assert.ok(rows.get('性格码').startsWith(String(person.Character)));for(const [title,value] of [['基础兵种',person.ArmsType],['装备后兵种',person.derivedArm]])assert.ok(rows.get(title).includes('码 '+value),'Native actual type code '+title);
    for(const [title,field] of [['装备一','Tool1'],['装备二','Tool2']])assert.ok(person[field]===0?rows.get(title)==='无':rows.get(title).includes('编号 '+person[field]),'Full U16 equipment index');
    assert.equal(data.detail.ownership.value,person.Belong);assert.equal(data.detail.ownership.personIndex,person.Belong-1,'Person allegiance points to the actual owning lord');
    const selector=`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${id}"]`;await targetPoint(cdp,selector);
    const facts=await evaluate(cdp,`(() => {const fields=document.getElementById('hd-city-menu-person-fields');return Array.from(fields.querySelectorAll('.hd-city-menu-stat strong'),n=>{n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),s=getComputedStyle(n),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:n.textContent,width:r.width,height:r.height,visible:!!(r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'),hit:!!(t&&(t===n||n.contains(t)))};});})()`);
    assert.ok(facts.every(f=>f.visible&&f.hit),'All detail values are actually visible after scrolling and unobstructed');
    const portraitManifest=JSON.parse(servedAssets.get('assets/hd-portraits/manifest.json').data),referenceIndex=JSON.parse(servedAssets.get('assets/hd-portraits/refs/index.json').data);
    const entry=portraitManifest.entries.find(e=>e.period===2&&e.personId===id&&!e.missing),reference=referenceIndex.periods.find(p=>p.period===2)?.people.find(p=>p.id===id&&!p.skipped);
    const expectedSource=entry?.hd?'assets/hd-portraits/'+entry.hd:entry?.ref?'assets/hd-portraits/'+entry.ref:reference?'assets/hd-portraits/refs/'+reference.file:null;
    assert.ok(expectedSource&&servedAssets.has(expectedSource),'Actual portrait reference/HD source is frozen for this exact native person and period');
    const portrait=await waitFor(cdp,label+' actual image ready/source/docked owner',`(() => {const root=document.getElementById('hd-portrait'),img=document.getElementById('hd-portrait-img'),pane=document.getElementById('hd-city-menu-person-details'),slot=document.getElementById('hd-city-menu-person-portrait'),s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();
        if(!root||!img||!slot||!pane||pane.hidden||root.hidden||!img.complete||!img.naturalWidth||!img.naturalHeight||root.parentNode!==slot||root.getAttribute('data-hd-portrait-source')!=='runtime'||root.getAttribute('data-person-id')!==${JSON.stringify(String(id))}||root.getAttribute('data-period')!=='2'||!s.personDetail||s.personDetail.ownerKey!==${JSON.stringify(picker.city.deepMenuOwner.key)}||m.seq!==${picker.menu.seq}||m.index!==${index})return false;
        img.scrollIntoView({block:'center'});const r=img.getBoundingClientRect(),sr=slot.getBoundingClientRect(),ps=pane.getBoundingClientRect(),style=getComputedStyle(img),ancestors=[];
        for(let n=img;n&&n.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);ancestors.push({id:n.id,tag:n.tagName,opacity:Number(s.opacity),display:s.display,visibility:s.visibility,pointerEvents:s.pointerEvents});}
        const points=[.25,.5,.75].map(f=>{const x=r.x+r.width*f,y=r.y+r.height*f,t=document.elementFromPoint(x,y);return {x,y,top:t&&{id:t.id,tag:t.tagName},paneForeground:!!(t&&(t===slot||t===pane||slot.contains(t))),stack:document.elementsFromPoint(x,y).slice(0,5).map(n=>({id:n.id,tag:n.tagName}))};});
        return {mode:root.getAttribute('data-hd-portrait'),source:root.getAttribute('data-hd-portrait-source'),src:new URL(img.currentSrc||img.src,location.href).pathname.slice(1),naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height},slot:{x:sr.x,y:sr.y,width:sr.width,height:sr.height},pane:{x:ps.x,y:ps.y,width:ps.width,height:ps.height},visible:!!(r.width&&r.height&&ancestors.every(a=>a.opacity>0&&a.visibility!=='hidden'&&a.display!=='none')),unobstructed:points.every(p=>p.paneForeground),pointerEvents:style.pointerEvents,ancestors,points,personId:root.getAttribute('data-person-id'),period:root.getAttribute('data-period'),context:root.getAttribute('data-context')};})()`);
    assert.equal(decodeURIComponent(portrait.src),expectedSource);assert.equal(portrait.mode,entry?.hd?'hd':'ref');assert.ok(portrait.visible&&portrait.unobstructed,'Actual non-interactive portrait is visible with its own slot/pane in the foreground');
    const originalPng=servedAssets.get(expectedSource).data;assert.equal(portrait.naturalWidth,originalPng.readUInt32BE(16));assert.equal(portrait.naturalHeight,originalPng.readUInt32BE(20));
    const displayedViewport=await evaluate(cdp,'({width:innerWidth,height:innerHeight})');
    for(const [label,bounds] of [['slot',portrait.slot],['pane',portrait.pane],['viewport',{x:0,y:0,...displayedViewport}]])assert.ok(portrait.rect.x>=bounds.x-1&&portrait.rect.y>=bounds.y-1&&portrait.rect.x+portrait.rect.width<=bounds.x+bounds.width+1&&portrait.rect.y+portrait.rect.height<=bounds.y+bounds.height+1,'Portrait is fully inside the actual '+label+' clip');
    const after=await readWorld(cdp,label+'-after-detail');assert.equal(after.keys,actual.keys,'Detail/image rendering and scrolling have zero input');assertWorldSame(actual,after,label+' readonly details');
    const record={label,viewport:await evaluate(cdp,'({width:innerWidth,height:innerHeight})'),owner:ownerIdentity(picker),id,native:person,detail:data,geometry:facts,portrait:{...portrait,expectedSource,sourceSha256:servedAssets.get(expectedSource).metadata.sha256,note:entry?.hd?'Accepted HD art':'Exact native portrait reference inside HD details; not newly generated HD art'}};report.detailChecks.push(record);return record;
}
async function highlight(cdp,index){
    let picker=await currentPersonPicker(cdp);const owner=ownerIdentity(picker);while(picker.menu.index!==index){const down=picker.menu.index<index,before=await readWorld(cdp,'highlight-'+index+'-before'),old=picker.menu.index;
        await key(cdp,down?'ArrowDown':'ArrowUp');await waitFor(cdp,'actual SEARCH native highlight ACK',`baye.hd.menuItems().active&&baye.hd.menuItems().seq===${owner.seq}&&baye.hd.menuItems().index===${old+(down?1:-1)}`);
        picker=await currentPersonPicker(cdp);assert.deepEqual(ownerIdentity(picker),owner);const after=await readWorld(cdp,'highlight-'+index+'-after');assertWorldSame(before,after,'Player highlight');assert.deepEqual((await readKeys(cdp,before.keys)).map(k=>k.code),[down?0x23:0x22]);
    }return picker;
}
async function inspectViewport(cdp,size,label,allDetails){
    const resize=await stableZeroInput(cdp,label+'-resize',()=>cdp.send('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:false}));report.resizes.push(resize);
    let picker=await currentPersonPicker(cdp);const owner=ownerIdentity(picker),actual=await readWorld(cdp,label+'-rows');
    const rows=await evaluate(cdp,`Array.from(document.querySelectorAll('#hd-city-menu [data-hd-deep]'),n=>({index:Number(n.dataset.hdDeep),person:Number(n.dataset.hdDeepPind),owner:n.dataset.hdDeepOwner,context:Number(n.dataset.hdMenuContext),kind:Number(n.dataset.hdMenuKind),seq:Number(n.dataset.hdMenuSeq),name:n.dataset.hdDeepName,text:n.textContent}))`);
    assert.equal(rows.length,picker.ids.length);rows.forEach((row,i)=>{assert.equal(row.index,i);assert.equal(row.person,picker.ids[i]);assert.equal(row.owner,owner.key);assert.equal(row.seq,owner.seq);assert.equal(row.context,1);assert.equal(row.kind,3);assert.equal(row.name,actual.persons[row.person].name);assert.ok(row.text.includes(row.name));});
    for(const row of rows)await targetPoint(cdp,`#hd-city-menu [data-hd-deep="${row.index}"]`);
    if(allDetails)for(let i=0;i<rows.length;i++){picker=await highlight(cdp,i);await validateDetails(cdp,label+'-person-'+picker.ids[i],picker);}else{picker=await highlight(cdp,0);await validateDetails(cdp,label+'-filtered-person-'+picker.ids[0],picker);}
    await targetPoint(cdp,'#hd-city-menu [data-hd-menu-back]');report.viewportChecks??=[];report.viewportChecks.push({label,size,rows,owner,nativeOwnedIDs:picker.ids});await checkpoint(cdp,label);
}
async function boot(cdp){
    await waitFor(cdp,'real native ready','window.baye&&baye.hd&&baye.hd.ready()',60000);await installKeyObserver(cdp);await observeActualLib(cdp,'startup');
    const fontKeyStart=(await readKeys(cdp)).length;
    const font=await evaluate(cdp,`(async () => {const loaded=await document.fonts.load('16px BayeUI','刘表搜寻');await document.fonts.ready;return {faces:loaded.map(f=>({family:f.family,status:f.status})),status:document.fonts.status,check:document.fonts.check('16px BayeUI','刘表搜寻')};})()`);
    assert.equal(font.status,'loaded');assert.equal(font.check,true);assert.ok(font.faces.some(f=>f.family.replace(/["']/g,'')==='BayeUI'&&f.status==='loaded'),'Actual BayeUI font face is loaded');
    assert.equal((await readKeys(cdp)).length,fontKeyStart,'Font readiness emits zero native input');
    const fontSource=servedAssets.get('fonts/HarmonyOS_Sans_SC_Regular.ttf').metadata,fontRequests=report.requests.filter(r=>r.url==='/fonts/HarmonyOS_Sans_SC_Regular.ttf');
    assert.ok(fontRequests.length&&fontRequests.every(r=>r.status===200&&r.sha256===fontSource.sha256),'Actual font is served from the frozen project bytes');report.fontValidation={...font,source:fontSource,requests:fontRequests,keysBefore:fontKeyStart,keysAfter:(await readKeys(cdp)).length};
    await waitFor(cdp,'real opening skip or actual title','baye.hd.spe().active&&baye.hd.spe().id===3&&baye.hd.spe().skipEligible||baye.hd.spe().id===100');
    if(await evaluate(cdp,'baye.hd.spe().active&&baye.hd.spe().id===3')){
        const owner=await evaluate(cdp,'baye.hd.spe()'),start=(await readKeys(cdp)).length;assert.ok(owner.active&&owner.id===3&&owner.skipEligible);
        const fresh=await evaluate(cdp,'baye.hd.spe()');assert.equal(fresh.eventId,owner.eventId);assert.equal(fresh.generation,owner.generation);assert.ok(fresh.active&&fresh.id===3&&fresh.skipEligible);
        await key(cdp,'Enter');const ended=await waitFor(cdp,'actual opening accepts exactly the player Enter',`(() => {const s=baye.hd.spe();return s.lastEnd.eventId===${owner.eventId}&&s.lastEnd.reason==='key'&&s.lastEnd.key===39&&s;})()`);
        const keys=await readKeys(cdp,start);assert.deepEqual(keys.map(k=>k.code),[0x27]);
        await waitFor(cdp,'actual prior opening owner and presentation retired',`(() => {const s=baye.hd.spe();return (!s.active||s.eventId!==${owner.eventId})&&!BayeHdSpe.isOpen();})()`);
        report.openingSkip={owner,ended,keys,method:'Actual physical CDP Enter under the current native MAIN skip owner; no hidden HD button'};
    }
    await waitFor(cdp,'actual title','baye.hd.spe().id===100');await key(cdp,'Enter');await waitFor(cdp,'actual period picture','baye.hd.spe().id===104');
    await key(cdp,'ArrowDown');await key(cdp,'Enter');await waitFor(cdp,'actual P2 native lord picker','Number(baye.data.g_PIdx)===2&&baye.hd.kings().count>0');
    const kings=await evaluate(cdp,'baye.hd.kings()'),target=kings.kings.findIndex(k=>k.id===12&&k.name==='刘表');assert.ok(target>=0);
    for(let i=kings.index;i<target;i++)await key(cdp,'ArrowDown');for(let i=kings.index;i>target;i--)await key(cdp,'ArrowUp');await waitFor(cdp,'real LiuBiao highlight','baye.hd.kings().index==='+target);report.selectedLord=kings.kings[target];
    await key(cdp,'Enter');await waitFor(cdp,'actual strategy map','baye.hd.march().pick===1&&baye.hd.realm().ownedCount>0');await observeActualLib(cdp,'actual-P2-map');
    const preferences=await evaluate(cdp,'({system:BayeHdSystemUi.getMode(),map:BayeHdOverworld.getMode(),city:BayeHdCityMenu.getMode()})');assert.deepEqual(preferences,{system:'classic',map:'hd-map',city:'hd'});
    report.profilePreferenceObservation={...await stableZeroInput(cdp,'readonly private-profile UI preferences',()=>evaluate(cdp,'({system:BayeHdSystemUi.getMode(),map:BayeHdOverworld.getMode(),city:BayeHdCityMenu.getMode(),march:baye.hd.march()})')),preferences,method:'Initial private-origin localStorage user preferences, no toolbar interaction claimed'};
    await waitFor(cdp,'HD real map authorized','BayeHdOverworld.debugSnapshot().phase==="map"&&BayeHdOverworld.debugSnapshot().presentationReady');await checkpoint(cdp,'01-real-P2-LiuBiao-map');
    const before=await readWorld(cdp,'before-city-entry'),start=before.keys,cityTarget=await evaluate(cdp,'(() => {const c=BayeHdOverworld.cityScreenPos(26);return c&&{index:c.index,name:c.name,nativeName:baye.getCityName(26),engX:c.engX,engY:c.engY};})()');
    assert.ok(cityTarget&&cityTarget.index===26&&cityTarget.name===cityTarget.nativeName&&cityTarget.name.length>0&&Number.isInteger(cityTarget.engX)&&Number.isInteger(cityTarget.engY),'Current city target contains the actual name and engine coordinates');
    const result=await evaluate(cdp,'BayeHdOverworld.walkToCity(26)');report.inputs.push({type:'public-actual-city-click',city:26,target:cityTarget,result});assert.deepEqual(result,{name:cityTarget.name,to:{x:cityTarget.engX,y:cityTarget.engY}},'Public city entry returns its actual name/to object');
    await waitFor(cdp,'real owned city root','(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return s.open&&s.cityIndex===26&&s.layer==="root"&&m.active&&m.context===1&&m.kind===1&&!s.sending&&!s.queueLen;})()');
    const after=await readWorld(cdp,'after-city-entry');for(const f of ['persons','orders','queue','money','food','reserve','date'])assert.deepEqual(after[f],before[f]);assert.deepEqual((await readKeys(cdp,start)).map(k=>k.code),[0x27]);
    const rootMenu=await evaluate(cdp,'baye.hd.menuItems()'),interior=rootMenu.names.indexOf('内政');assert.ok(interior>=0);await click(cdp,`#hd-city-menu [data-hd-root="${interior}"]`);
    await waitFor(cdp,'real interior submenu','BayeHdCityMenu.getLayer()==="sub"&&baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2');
    const sub=await evaluate(cdp,'baye.hd.menuItems()'),search=sub.names.indexOf('搜寻');assert.ok(search>=0);report.submenu=sub;await click(cdp,`#hd-city-menu [data-hd-sub="${search}"]`);
    const picker=await currentPersonPicker(cdp);assert.deepEqual(picker.ids,report.nativeContract.initialOwnedIDs);await checkpoint(cdp,'02-native-HD-SEARCH');return picker;
}
async function commitSearch(cdp){
    let picker=await currentPersonPicker(cdp),index=picker.ids.indexOf(searchPerson);assert.ok(index>=0);
    // Preserve the actual last row index after the detail tour, so selection drives real native arrows.
    const before=await readWorld(cdp,'search-before-selection'),person=before.persons[searchPerson];assert.equal(person.Belong,13);assert.ok(person.Thew>=report.nativeContract.thew);
    const oldSelector=`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${searchPerson}"]`;
    await evaluate(cdp,`window.__searchOldRow=document.querySelector(${JSON.stringify(oldSelector)})`);
    const start=before.keys;await click(cdp,oldSelector,0);
    const originalReport=await waitFor(cdp,'actual selected person speech before order','(() => {const r=baye.hd.report(),d=BayeHdDialog.debugSnapshot();return r.active&&d.open&&d.kind==="report"&&d.reportOwner&&d.reportOwner.seq===r.seq&&d.reportOwner.inputSeq===r.inputSeq&&{native:r,ui:d};})()');
    assert.equal(originalReport.native.kind,2);assert.equal(originalReport.native.person,searchPerson,'The real speech is from the selected SEARCH actor');assert.equal(originalReport.ui.body,originalReport.native.text);assert.ok(originalReport.native.text.length>0);
    await waitFor(cdp,'report retires old person details','BayeHdCityMenu.debugSnapshot().personDetail===null&&document.getElementById("hd-city-menu-person-details").hidden');
    const atReport=await readWorld(cdp,'search-report-before-AddOrder');assert.equal(atReport.persons[searchPerson].Thew,person.Thew-8);assert.deepEqual(atReport.queue,before.queue,'Native success speech occurs before DelPerson');assert.deepEqual(atReport.orders,before.orders,'A report alone is not an accepted SEARCH order');assert.equal(atReport.money,before.money);assert.deepEqual(atReport.date,before.date);
    await checkpoint(cdp,'05-original-search-report-before-order');
    const staleDuringReport=await stableZeroInput(cdp,'captured old row click during current report',()=>evaluate(cdp,'(() => {const n=window.__searchOldRow;if(!n)throw Error("Missing actual old row");n.click();return {connected:n.isConnected,owner:n.dataset.hdDeepOwner};})()'));
    report.staleChecks.push({...staleDuringReport,method:'HTMLElement.click on the retained original native-owned row; no fabricated IDs or token'});
    const confirmStart=atReport.keys,fresh=await evaluate(cdp,'baye.hd.report()');assert.equal(fresh.seq,originalReport.native.seq);assert.equal(fresh.inputSeq,originalReport.native.inputSeq);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');
    picker=await currentPersonPicker(cdp);assert.notEqual(picker.menu.seq,report.firstPicker.menu.seq,'Accepted SEARCH retires the original native menu sequence');
    const after=await readWorld(cdp,'search-order-after-report-ACK');assert.equal(after.persons[searchPerson].Thew,person.Thew-8);assert.equal(after.money,before.money);assert.equal(after.food,before.food);assert.equal(after.reserve,before.reserve);assert.deepEqual(after.date,before.date);
    assert.deepEqual(after.queue,before.queue.filter(id=>id!==searchPerson));const newOrders=after.orders.filter(o=>o.OrderId===3&&o.City===26&&o.Person===searchPerson);assert.equal(newOrders.length,before.orders.filter(o=>o.OrderId===3&&o.City===26&&o.Person===searchPerson).length+1);assert.equal(newOrders.at(-1).TimeCount,0);
    const expectedPersons=structuredClone(before.persons);expectedPersons[searchPerson].Thew-=8;assert.deepEqual(after.persons,expectedPersons,'Only legitimate SEARCH stamina changes person values');
    assert.ok(!picker.ids.includes(searchPerson));assert.ok(picker.menu.seq!==report.viewportChecks[0].owner.seq);assert.deepEqual(picker.ids,after.queue.filter(id=>after.persons[id].Belong===13));
    const selectionKeys=await readKeys(cdp,start);
    assert.equal(selectionKeys.filter(k=>k.code===0x27).length,2,'One SEARCH selection Enter and one original speech confirmation');assert.ok(selectionKeys.every(k=>[0x22,0x23,0x27].includes(k.code)));
    assert.deepEqual((await readKeys(cdp,confirmStart)).map(k=>k.code),[0x27],'Report confirmation supplies exactly one Enter');
    const staleAfter=await stableZeroInput(cdp,'captured previous SEARCH row after new native menu seq',()=>evaluate(cdp,'(() => {const n=window.__searchOldRow;n.click();return {connected:n.isConnected,owner:n.dataset.hdDeepOwner};})()'));
    report.staleChecks.push({...staleAfter,method:'Retained original DOM row click after native menu generation/sequence retirement; no fabricated owner'});
    report.searchOrder={owner:ownerIdentity(report.firstPicker),personIndex:searchPerson,nativeId:searchPerson+1,before,atReport,originalReport,after,newMenu:picker.menu,keys:selectionKeys,reportConfirmationKeys:await readKeys(cdp,confirmStart),reportBeforeAddOrder:true};return picker;
}
async function returnToMap(cdp){
    const before=await readWorld(cdp,'return-before'),steps=[];for(let i=0;i<4;i++){
        const s=await evaluate(cdp,snapshotExpression);if(!s.menu.active)break;assert.equal(s.menu.context,1);assert.ok(s.city.open&&!s.city.sending&&!s.city.queueLen&&!s.report.active&&!s.qty.active);
        const fresh=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(fresh,s.menu);const keyStart=s.keyCount;await click(cdp,'#hd-city-menu [data-hd-menu-back]');
        await waitFor(cdp,'actual previous menu owner retired','!baye.hd.menuItems().active||baye.hd.menuItems().seq!=='+s.menu.seq);
        await delay(400);const next=await evaluate(cdp,snapshotExpression),keys=await readKeys(cdp,keyStart);assert.deepEqual(keys.map(k=>k.code),[0x28],'Exactly one user Back for one active native menu');steps.push({before:s,after:next,keys});
        if(next.menu.active){assert.equal(next.menu.context,1);assert.ok([1,2].includes(next.menu.kind),'Native return goes through real city submenu/root');}
    }
    const map=await waitFor(cdp,'real map and old city pane automatically retired','(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),q=baye.hd.qty(),r=baye.hd.report(),p=baye.hd.march(),map=BayeHdOverworld.debugSnapshot();return !s.open&&!s.sending&&!s.queueLen&&!m.active&&!q.active&&!r.active&&p.pick===1&&p.phase===0&&p.battlePick===0&&map.phase==="map"&&{city:s,menu:m,march:p,map};})()');
    const after=await readWorld(cdp,'return-after');assertWorldSame(before,after,'User Back retirement');const quietStart=after.keys;await delay(600);assert.equal((await readKeys(cdp,quietStart)).length,0,'ACK/local pane retirement does not issue a second EXIT');report.returnToMap={before,after,steps,map};await checkpoint(cdp,'08-real-map-after-user-back');
}
async function smoke(cdp){
    report.firstPicker=await boot(cdp);
    for(const size of viewports)await inspectViewport(cdp,size,size.height===1080?'03-search-1080p':'04-search-720p',true);
    await commitSearch(cdp);
    for(const size of viewports)await inspectViewport(cdp,size,size.height===1080?'06-filtered-1080p':'07-filtered-720p',false);
    await returnToMap(cdp);await observeActualLib(cdp,'finished-SEARCH');report.engineInputs=await readKeys(cdp);report.observerErrors=await evaluate(cdp,'window.__searchObserverErrors');assert.deepEqual(report.observerErrors,[]);
    assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.dialogs,[]);
    const knownBlocked=['https://img.bbkgames.com/script/js-sdk.js?ver=20260329','http://hm.baidu.com/hm.js?55cdc246d0c836cecfdf39ce0d5657f3'];
    assert.ok(report.blocked.every(url=>knownBlocked.includes(url)),'Private acceptance only permits the two known, blocked page analytics/SDK requests');report.blockedThirdParty={urls:report.blocked,notGameHttpErrors:true};
    report.httpErrors=report.requests.filter(r=>r.status>=400&&!r.url.endsWith('/favicon.ico'));assert.deepEqual(report.httpErrors,[]);report.hdAccepted=true;
}
async function main(){
    assert.ok(!fs.existsSync(path.join(artifactDir,'result.json')),'Prior results are preserved; use a fresh artifact directory');fs.mkdirSync(artifactDir,{recursive:true});
    let server,chrome,cdp,profile,chromeError;const interrupt=()=>{report.interrupted=true;cdp?.close();if(!childExited(chrome))chrome.kill('SIGTERM');server?.closeAllConnections();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{
        prepareServedAssets();console.log('Frozen',Object.keys(report.sources).length,'sources; native',report.nativeSourceCheck.aggregate,'runner',report.tool.sha256);
        if(preflightOnly){report.ok=true;report.scope={accepted:'Readonly ROM command cost, actual initial U16 allied queue, installed native provenance and source freeze only',notRun:'No Chrome/profile/server/SEARCH/order/person UI/HD acceptance'};return;}
        assert.equal(typeof WebSocket,'function');profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-search-runtime-'));server=await startServer();const origin='http://127.0.0.1:'+server.address().port,debugPort=await unusedPort();assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);
        const binary=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(fs.existsSync(binary));
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size=1920,1080','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>chromeError=e);
        report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};console.log('Private isolation',JSON.stringify(report.isolation));
        let target;const deadline=Date.now()+15000;while(Date.now()<deadline){if(chromeError)throw chromeError;if(childExited(chrome))throw Error('Chrome exited '+chrome.exitCode+' signal '+chrome.signalCode);try{const tabs=await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json());target=tabs.find(t=>t.type==='page');if(target)break;}catch{}await delay(100);}assert.ok(target,'Private CDP started');cdp=await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled',e=>report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')}));cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening',e=>{report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});
        cdp.on('Fetch.requestPaused',e=>{const local=new URL(e.request.url).origin===origin;if(!local)report.blocked.push(e.request.url);cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');report.browser=await cdp.send('Browser.getVersion');await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.clear();localStorage.setItem('baye/libpath','libs/dat-mod.lib');localStorage.setItem('baye/overworldMode','hd-map');localStorage.setItem('baye/systemUiMode','classic');localStorage.setItem('baye/cityMenuMode','hd');"});
        await cdp.send('Page.navigate',{url:origin+'/pc.html'});await smoke(cdp);report.ok=true;
    }catch(error){report.ok=false;report.error=error.stack||String(error);process.exitCode=1;console.error(report.error);if(cdp){try{report.failureState=await evaluate(cdp,snapshotExpression);report.engineInputs=await readKeys(cdp);report.failureWorld=await readWorld(cdp,'terminal-failure');}catch(e){report.failureReadError=String(e);}try{const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(png.data,'base64'));}catch{}}}
    finally{
        process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);cdp?.close();if(!childExited(chrome)){const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([stopped,delay(1500)]);if(!childExited(chrome)){chrome.kill('SIGKILL');await Promise.race([stopped,delay(1500)]);}}
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        if(profile){assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));assert.ok(path.basename(profile).startsWith('baye-search-runtime-'));try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(e){report.ok=false;report.cleanupError=String(e);process.exitCode=1;}}
        const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),exists=fs.existsSync(f),actualSha256=exists?sha(fs.readFileSync(f)):null;return {path:name,...m,actualSha256,match:exists&&actualSha256===m.sha256};}),added=productionDirectories.flatMap(d=>walk(path.join(root,d))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(n=>!servedAssets.has(n)),drift=sources.filter(s=>!s.match);
        report.sourceVerification={ok:!drift.length&&!added.length,count:sources.length,drift,added,sources};if(!report.sourceVerification.ok){report.ok=false;report.freezeFailure='Source bytes missing/changed/added';process.exitCode=1;}
        report.isolation={...report.isolation,profile:profile||null,cleaned:!profile||!fs.existsSync(profile),chromeExited:childExited(chrome),chromeExitCode:chrome?.exitCode??null,chromeSignalCode:chrome?.signalCode??null,httpClosed:!server||!server.listening,user8080Touched:false};if(!report.isolation.cleaned||!report.isolation.chromeExited||!report.isolation.httpClosed){report.ok=false;process.exitCode=1;}
        report.hdAccepted=report.ok===true&&report.hdAccepted===true;report.finishedAt=new Date().toISOString();
        for(const [name,value] of [['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])fs.writeFileSync(path.join(artifactDir,name),JSON.stringify(value,null,2)+'\n');
        console.log('Finished',JSON.stringify({ok:report.ok,preflightOnly,hdAccepted:report.hdAccepted,checkpoints:report.phases.length,sources:report.sourceVerification.count,drift:drift.length,added:added.length,exceptions:report.exceptions.length,cleanup:report.isolation.cleaned,artifactDir}));
    }
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
