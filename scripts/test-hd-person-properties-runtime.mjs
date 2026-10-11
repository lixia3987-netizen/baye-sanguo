/**
 * Real Native person-property page acceptance. Private server/profile; no month, recruitment or battle.
 * node scripts/test-hd-person-properties-runtime.mjs --staged --preflight-only --artifact-dir build/r18-person-properties-preflight
 * node scripts/test-hd-person-properties-runtime.mjs --library sc-mod --artifact-dir build/r18-person-properties-mod-installed
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
const cli=process.argv.slice(2),allowed=new Set(['--preflight-only','--artifact-dir','--staged','--library']);
for(let i=0;i<cli.length;i++){assert.ok(allowed.has(cli[i]),'Unsupported argument: '+cli[i]);if(cli[i]==='--artifact-dir'||cli[i]==='--library'){assert.ok(cli[i+1]&&!cli[i+1].startsWith('--'),'Artifact path is required');i++;}}
assert.equal(new Set(cli.filter(v=>v.startsWith('--'))).size,cli.filter(v=>v.startsWith('--')).length,'Duplicate flags are rejected');
const preflightOnly=cli.includes('--preflight-only'),staged=cli.includes('--staged'),artifactIndex=cli.indexOf('--artifact-dir'),libraryIndex=cli.indexOf('--library');
const library=libraryIndex<0?'standard':cli[libraryIndex+1];assert.ok(['standard','sc-mod'].includes(library),'Unknown library');const mod=library==='sc-mod';
const artifactDir=path.resolve(artifactIndex<0?path.join(root,'build/r18-person-properties-runtime'):cli[artifactIndex+1]);
const period=mod?1:2,originCity=mod?null:26,lordPerson=mod?null:12;
const viewport={width:1920,height:1080},viewports=[viewport,{width:1280,height:720}];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const childExited=child=>!child||child.exitCode!==null||child.signalCode!==null;
const report={startedAt:new Date().toISOString(),preflightOnly,staged,library,period,originCity,lordPerson,viewports,phases:[],inputs:[],console:[],exceptions:[],dialogs:[],blocked:[],requests:[],worldObservations:[],detailChecks:[],resizes:[],staleChecks:[]};
const servedAssets=new Map(),productionDirectories=['js','css','assets','vendor/iBaye/src'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.lib':'application/octet-stream'};
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(directory,item.name)):[path.join(directory,item.name)]);
let nativeLib;
function freezeAsset(name,sourceName=name){
    name=name.replaceAll('\\','/');assert.ok(!path.isAbsolute(name)&&!name.split('/').includes('..'));
    if(servedAssets.has(name)&&sourceName===name)return servedAssets.get(name);
    const data=fs.readFileSync(path.join(root,sourceName)),metadata={source:sourceName,bytes:data.length,sha256:sha(data)};
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
    freezeAsset('scripts/write-wasm-manifest.mjs');nativeLib=freezeAsset('libs/dat-mod.lib').data;for(const entry of ['pc.html','designer.html','hd-portrait-dump.html','m.html','m-ges.html','m-ktouch.html','m-old.html'])freezeAsset(entry);freezeAsset('qr.png');freezeAsset('favicon.png');freezeAsset('fonts/HarmonyOS_Sans_SC_Regular.ttf');freezeAsset('libs/sc-mod.lib');
    if(staged)for(const f of ['baye.js','baye.wasm','baye.wasm.map','baye.build.json'])freezeAsset('js/'+f,'build/wasm/src/'+f);
    assert.equal(sha(nativeLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    const runner=freezeAsset(path.relative(root,fileURLToPath(import.meta.url)));report.tool=runner.metadata;
    const build=JSON.parse(servedAssets.get('js/baye.build.json').data);
    assert.equal(build.hdPersonPropertiesProtocol?.version,1,'Engine quartet declares the current person-property observer protocol');
    for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const m=report.sources['js/'+name];assert.equal(m.bytes,build.artifacts[name].bytes);assert.equal(m.sha256,build.artifacts[name].sha256);}
    const tracked=execFileSync('git',['ls-files','-z','vendor/iBaye'],{cwd:root}).toString('utf8').split('\0').filter(Boolean).sort(),hash=crypto.createHash('sha256'),files=[];
    for(const name of tracked){const f=freezeAsset(name);hash.update(name+'\0');hash.update(f.data);files.push({name,...f.metadata});}
    report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),expected:build.engineSourceSha256,files};
    assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256,'Installed engine matches actual native source bytes');report.engineManifest=build;
    const decode=bytes=>new TextDecoder('gbk',{fatal:true}).decode(bytes.subarray(0,bytes.indexOf(0)>=0?bytes.indexOf(0):bytes.length));
    const standardTitles=Array.from({length:13},(_,i)=>decode(nativeItem(64,23+i)));
    const modText=servedAssets.get('libs/sc-mod.lib').data.toString('utf8'),declared=/var baye_person_heads\s*=\s*(\[[^;]+\]);/.exec(modText);
    assert.ok(declared&&modText.includes('baye.data.g_uiCfg.personPropertiesCount = 12'));const modTitles=JSON.parse(declared[1].replace(/^\[\s*\/\/[^\r\n]*\r?\n/,'[\n'));assert.equal(modTitles.length,12);assert.ok(modTitles.every(v=>typeof v==='string'&&v.length));
    const constantSource=servedAssets.get('vendor/iBaye/src/baye/sconst.h').data.toString('utf8');
    const constant=n=>{const match=new RegExp('#define\\s+ATRR_STR'+n+'\\s+(\\d+)').exec(constantSource);assert.ok(match);return decode(nativeItem(64,Number(match[1])-1));};
    const keySource=servedAssets.get('vendor/iBaye/src/baye/comm.h').data.toString('utf8'),lcdSource=servedAssets.get('js/lcd.js').data.toString('utf8');
    report.nativeKeys=Object.fromEntries(['LEFT','RIGHT'].map(name=>{const c=new RegExp('#define\\s+VK_'+name+'\\s+(0x[0-9a-f]+)').exec(keySource),js=new RegExp('VK_'+name+'\\s*=\\s*(0x[0-9a-f]+)').exec(lcdSource);assert.ok(c&&js);assert.equal(Number(c[1]),Number(js[1]));return [name.toLowerCase(),Number(c[1])];}));
    report.nativeContract={standardTitles,modTitles,standardLabels:{free:constant(67),king:constant(68),captive:constant(69),noDevotion:constant(71),arms:Array.from({length:6},(_,i)=>constant(11+i))},personIDType:'U16 native zero based',standardPropertyCount:13,modDeclaredPropertyCount:12,nativeObservers:'Only original selected-row/title draw calls; no additional property hook calls',notClaimed:'ROM/source preflight only, no actual person property UI acceptance.'};
    report.freezeScope='Every JS/CSS/asset/native file, the actually served '+(staged?'staged':'installed')+' engine quartet, all Git tracked engine files, actual standard and sc-mod LIB, seven current engine HTML entries, actual BayeUI font and exact runner bytes. Staged quartet overrides logical js/baye.* records; old installed quartet is not independently authenticated by a staged run. No ignored plan dependencies.';
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

const snapshotExpression=`(() => ({ready:baye.hd.ready(),generation:Number(baye.data.g_hdSpeGeneration),period:Number(baye.data.g_PIdx),playerKing:Number(baye.data.g_PlayerKing),menu:baye.hd.menuItems(),personProperties:baye.hd.personProperties(),qty:baye.hd.qty(),report:baye.hd.report(),help:baye.hd.help(),march:baye.hd.march(),fight:baye.hd.fight(),city:BayeHdCityMenu.debugSnapshot(),dialog:BayeHdDialog.debugSnapshot(),system:BayeHdSystemUi.debugSnapshot(),map:BayeHdOverworld.debugSnapshot(),keyCount:window.__searchEngineKeys.length}))()`;
async function checkpoint(cdp,name){const state=await evaluate(cdp,snapshotExpression);assert.ok(!state.fight.active,'Person-property validation never enters battle');report.phases.push({name,...state});console.log('PASS',name);const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,name+'.png'),Buffer.from(png.data,'base64'));return state;}
async function key(cdp,name){
    const codes={Enter:13,Escape:27,ArrowDown:40,ArrowUp:38,ArrowLeft:37,ArrowRight:39};assert.ok(codes[name]);report.inputs.push({type:'physical-key',key:name,at:new Date().toISOString()});
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
    const first=await evaluate(cdp,expression),last=await evaluate(cdp,expression),expected=report.sources[mod?'libs/sc-mod.lib':'libs/dat-mod.lib'];
    for(const r of [first,last]){assert.equal(r.before,r.after);assert.ok(Number.isInteger(r.before)&&r.before>0);assert.equal(r.a.status,'ready');assert.equal(r.b.status,'ready');assert.equal(r.a.generation,r.b.generation);assert.equal(r.a.sha256,expected.sha256);assert.equal(r.b.sha256,expected.sha256);assert.ok(typeof r.hex==='string'&&/^(?:[0-9a-f]{2})+$/i.test(r.hex));const bytes=Buffer.from(r.hex,'hex');assert.equal(bytes.length,expected.bytes);assert.equal(sha(bytes),expected.sha256);}
    assert.equal(last.before,first.before);assert.equal(last.a.generation,first.a.generation);assert.equal(last.hex,first.hex);delete first.hex;delete last.hex;
    report.actualLib={stage,sha256:expected.sha256,bytes:expected.bytes,nativeGeneration:last.after,identityGeneration:last.b.generation};report.actualLibReads??=[];report.actualLibReads.push({stage,first,last});
}
const personFields=['Belong','OldBelong','Age','Character','Level','Force','IQ','Devotion','Experience','Thew','ArmsType','Arms','Tool1','Tool2'];
const worldExpression=`(() => {
    const d=baye.data,gen=Number(d.g_hdSpeGeneration),keys=window.__searchEngineKeys.length,c=d.g_Cities[window.__personRuntimeCity],count=baye.getPersonCount();
    const fields=${JSON.stringify(personFields)},persons=Array.from({length:count},(_,id)=>{const p=d.g_Persons[id],v={id,name:baye.getPersonName(id),derivedArm:baye.hd.personArmType(id)};for(const f of fields)v[f]=Number(p[f]);return v;});
    const queue=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));
    const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)!==255).map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),TimeCount:Number(o.TimeCount)}));
    const pos=d.g_CityPos,cursor={setx:Number(pos.setx),sety:Number(pos.sety),x:Number(pos.x),y:Number(pos.y)};
    return {gen,genAfter:Number(d.g_hdSpeGeneration),keys,keysAfter:window.__searchEngineKeys.length,period:Number(d.g_PIdx),playerKing:Number(d.g_PlayerKing),cityBelong:Number(c.Belong),money:Number(c.Money),food:Number(c.Food),reserve:Number(c.MothballArms),queueOffset:Number(c.PersonQueue),queue,persons,orders,cursor,date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)}};
})()`;
async function readWorld(cdp,label){const r=await evaluate(cdp,worldExpression);assert.equal(r.gen,r.genAfter,label+' native generation');assert.equal(r.keys,r.keysAfter,label+' readonly inputs');assert.equal(r.period,period);assert.equal(r.playerKing,report.selectedLord.id);assert.equal(r.cityBelong,r.playerKing+1);assert.ok(r.persons.length&&r.persons.every(p=>personFields.every(f=>Number.isInteger(p[f])&&p[f]>=0&&p[f]<=65535)),'Native numeric person fields are fully available');report.worldObservations.push({label,world:r});return r;}
function worldFacts(r){const {keys,keysAfter,genAfter,...facts}=r;return facts;}
function assertWorldSame(a,b,label){assert.deepEqual(worldFacts(b),worldFacts(a),label+' preserves actual persons, resources, orders, queue, date and cursor');}
async function stableZeroInput(cdp,label,operation){const before=await readWorld(cdp,label+'-before');await operation();await delay(350);const after=await readWorld(cdp,label+'-after');assert.equal(after.keys,before.keys,label+' emits zero native keys');assertWorldSame(before,after,label);return {label,before,after};}
async function currentPersonPicker(cdp){
    return waitFor(cdp,'actual current PERSON IDs and property paint', '(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),p=baye.hd.personProperties(),d=baye.data,c=d.g_Cities[window.__personRuntimeCity];if(!s.open||!s.showHd||s.layer!=="deep"||s.deepKind!=="person"||s.deepLabel!=="搜寻"||s.sending||s.queueLen||baye.hd.report().active||baye.hd.qty().active||baye.hd.help().active||!m.active||m.context!==1||m.kind!==3||!m.idsValid||!m.ids.length||!p.active||!p.pageComplete||p.person!==m.ids[m.index]||p.index!==m.index||p.menuSeq!==m.seq||p.generation!==m.detailGeneration||!s.personProperties||s.personPagePending)return false;const ids=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong));if(JSON.stringify(ids)!==JSON.stringify(m.ids))throw Error("Native current allied IDs disagree");return {menu:m,city:s,ids,properties:p};})()');
}
function ownerIdentity(p){return {context:p.menu.context,kind:p.menu.kind,seq:p.menu.seq,generation:p.menu.generation,detailGeneration:p.menu.detailGeneration,ids:p.menu.ids,key:p.city.deepMenuOwner.key};}
async function currentPaint(cdp){
    const picker=await currentPersonPicker(cdp),p=picker.properties;
    await waitFor(cdp,'UI shows exact current native property paint','(() => {const s=BayeHdCityMenu.debugSnapshot(),u=s.personProperties;return u&&u.nativeIndex==='+p.index+'&&u.personIndex==='+p.person+'&&u.paintSeq==='+p.paintSeq+'&&u.pageIndex==='+p.pageIndex+'&&u.pageStart==='+p.pageStart+'&&u.pageEnd==='+p.pageEnd+'&&!s.personPagePending;})()');
    return currentPersonPicker(cdp);
}
async function highlight(cdp,index){
    let picker=await currentPersonPicker(cdp);const owner=ownerIdentity(picker);while(picker.menu.index!==index){const down=picker.menu.index<index,before=await readWorld(cdp,'highlight-'+index+'-before'),old=picker.menu.index;
        await key(cdp,down?'ArrowDown':'ArrowUp');await waitFor(cdp,'actual SEARCH native highlight ACK',`baye.hd.menuItems().active&&baye.hd.menuItems().seq===${owner.seq}&&baye.hd.menuItems().index===${old+(down?1:-1)}`);
        picker=await currentPersonPicker(cdp);assert.deepEqual(ownerIdentity(picker),owner);const after=await readWorld(cdp,'highlight-'+index+'-after');assertWorldSame(before,after,'Player highlight');assert.deepEqual((await readKeys(cdp,before.keys)).map(k=>k.code),[down?0x23:0x22]);
    }return picker;
}
async function observeOriginalPropertyHooks(cdp){
    await evaluate(cdp,'(() => {window.__personPropertyHookLog=[];const original=baye.callHook;baye.callHook=function(name,c){if(name!=="getPersonPropertyTitle"&&name!=="getPersonPropertyValue")return original.apply(this,arguments);let before;try{before={name,person:c.personIndex,property:c.propertyIndex,generation:Number(baye.data.g_hdDetailGeneration),seq:Number(baye.data.g_hdMenuSeq)};}catch(e){window.__searchObserverErrors.push(String(e));}const rv=original.apply(this,arguments);try{window.__personPropertyHookLog.push({...before,value:String(c.value),returned:rv,generationAfter:Number(baye.data.g_hdDetailGeneration),seqAfter:Number(baye.data.g_hdMenuSeq)});}catch(e){window.__searchObserverErrors.push(String(e));}return rv;};return true;})()');
}
async function fontReady(cdp){
    const start=(await readKeys(cdp)).length,font=await evaluate(cdp,'(async()=>{const loaded=await document.fonts.load("16px BayeUI","人物属性");await document.fonts.ready;return {faces:loaded.map(f=>({family:f.family,status:f.status})),status:document.fonts.status,check:document.fonts.check("16px BayeUI","人物属性")};})()');
    assert.equal(font.status,'loaded');assert.ok(font.check&&font.faces.some(f=>f.family.replace(/["']/g,'')==='BayeUI'&&f.status==='loaded'));assert.equal((await readKeys(cdp)).length,start);
    const frozen=servedAssets.get('fonts/HarmonyOS_Sans_SC_Regular.ttf').metadata,requests=report.requests.filter(r=>r.url==='/fonts/HarmonyOS_Sans_SC_Regular.ttf');assert.ok(requests.length&&requests.every(r=>r.status===200&&r.sha256===frozen.sha256));report.fontValidation={...font,source:frozen,requests,keysBefore:start,keysAfter:start};
}
async function boot(cdp){
    await waitFor(cdp,'actual native ready','window.baye&&baye.hd&&baye.hd.ready()',60000);await installKeyObserver(cdp);await observeActualLib(cdp,'startup');await fontReady(cdp);
    const openingStart=(await readKeys(cdp)).length,opening=await waitFor(cdp,'actual opening or title','(() => {const s=baye.hd.spe();return (s.active&&s.id===3||s.id===100)&&s;})()');
    const title=await waitFor(cdp,'natural native opening completion and title','(() => {const s=baye.hd.spe();return s.id===100&&s;})()',60000);assert.equal((await readKeys(cdp)).length,openingStart);report.openingProgress={method:'Wait for the original opening to finish naturally; no opening skip input or transient end-ACK dependency',opening,title,keysBefore:openingStart,keysAfter:openingStart};
    await key(cdp,'Enter');await waitFor(cdp,'actual period chooser','baye.hd.spe().id===104');if(!mod)await key(cdp,'ArrowDown');await key(cdp,'Enter');
    await waitFor(cdp,'actual native lord list','Number(baye.data.g_PIdx)==='+period+'&&baye.hd.kings().count>0');const kings=await evaluate(cdp,'baye.hd.kings()'),target=mod?kings.index:kings.kings.findIndex(k=>k.id===12&&k.name==='刘表');assert.ok(target>=0);for(let i=kings.index;i<target;i++)await key(cdp,'ArrowDown');for(let i=kings.index;i>target;i--)await key(cdp,'ArrowUp');await waitFor(cdp,'actual lord highlight','baye.hd.kings().index==='+target);report.selectedLord=kings.kings[target];await key(cdp,'Enter');
    if(mod){const setup=await waitFor(cdp,'actual Mod setup or map','(() => {if(baye.hd.march().pick===1&&baye.hd.realm().ownedCount>0)return {kind:"map"};const m=baye.hd.menuItems();return m.active&&m.context===0&&m.count===4&&m.names.every(n=>n.startsWith("难度选择"))&&{kind:"difficulty",menu:m};})()');if(setup.kind==='difficulty'){await key(cdp,'Enter');const confirmation=await waitFor(cdp,'actual Mod ordinary difficulty confirmation','(() => {const m=baye.hd.menuItems();return m.active&&m.context===0&&m.count===2&&m.index===0&&m.names[0]==="确认选择-普通版"&&m.names[1]==="返回难度选择"&&m;})()');report.modSetup={setup,confirmation};await key(cdp,'Enter');}}
    await waitFor(cdp,'actual strategy map','baye.hd.march().pick===1&&baye.hd.realm().ownedCount>0');await observeActualLib(cdp,'actual-map');await observeOriginalPropertyHooks(cdp);await checkpoint(cdp,'01-real-native-map');
    if(mod){const start=(await readKeys(cdp)).length;await key(cdp,'Enter');const native=await waitFor(cdp,'actual Mod owned native city root','(() => {const m=baye.hd.menuItems(),s=baye.hd.march();return m.active&&m.context===1&&m.kind===1&&s.phase===0&&s.pick===0&&!s.battlePick&&!baye.hd.report().active&&!baye.hd.help().active&&!baye.hd.qty().active&&!baye.hd.fight().active&&{menu:m,march:s,cityIndex:Number(baye.data.g_hdMapCity)-1};})()');assert.deepEqual((await readKeys(cdp,start)).map(k=>k.code),[39]);assert.ok(Number.isInteger(native.cityIndex)&&native.cityIndex>=0);await evaluate(cdp,'window.__personRuntimeCity='+native.cityIndex);const before=await readWorld(cdp,'mod-before-explicit-hd-ui');const opened=await evaluate(cdp,'BayeHdCityMenu.open({cityIndex:'+native.cityIndex+'})');assert.equal(opened,true);const ui=await waitFor(cdp,'explicit production HD root API activation','(() => {const s=BayeHdCityMenu.debugSnapshot();return s.open&&s.showHd&&s.layer==="root"&&s.cityIndex==='+native.cityIndex+'&&s;})()');const after=await readWorld(cdp,'mod-after-explicit-hd-ui');assert.equal(after.keys,before.keys);assertWorldSame(before,after,'Explicit HD UI activation preserves actual world and cursor');const menu=await evaluate(cdp,'baye.hd.menuItems()');assert.deepEqual(menu,native.menu);report.modHdUiActivation={method:'Production public BayeHdCityMenu.open after one real native Enter into owned CITY/root; no fabricated owner or engine writes by runner',native,opened,ui,before,after,menu,notClaimed:'Classic Mod city entry does not automatically adopt the HD shell; this run explicitly invokes the existing UI API. Full Mod journey remains separate.'};}
    else{await evaluate(cdp,'window.__personRuntimeCity=26');const before=await readWorld(cdp,'before-city-entry'),city=await evaluate(cdp,'BayeHdOverworld.cityScreenPos(26)'),result=await evaluate(cdp,'BayeHdOverworld.walkToCity(26)');assert.deepEqual(result,{name:city.name,to:{x:city.engX,y:city.engY}});await waitFor(cdp,'actual standard city root','baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1&&BayeHdCityMenu.debugSnapshot().open');assert.deepEqual((await readKeys(cdp,before.keys)).map(k=>k.code),[39]);}
    const city=await evaluate(cdp,'BayeHdCityMenu.debugSnapshot().cityIndex');assert.ok(Number.isInteger(city)&&city>=0);report.originCity=city;await evaluate(cdp,'window.__personRuntimeCity='+city);report.beforePersonList=await readWorld(cdp,'before-person-list');
    const rootMenu=await evaluate(cdp,'baye.hd.menuItems()'),interior=rootMenu.names.indexOf('内政');assert.ok(interior>=0);await click(cdp,'#hd-city-menu [data-hd-root="'+interior+'"]');await waitFor(cdp,'actual interior submenu','baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2&&BayeHdCityMenu.getLayer()==="sub"');
    const sub=await evaluate(cdp,'baye.hd.menuItems()'),search=sub.names.indexOf('搜寻');assert.ok(search>=0);await click(cdp,'#hd-city-menu [data-hd-sub="'+search+'"]');if(mod){const next=await waitFor(cdp,'actual Mod ordinary-search option or PERSON list','(() => {const m=baye.hd.menuItems();if(m.active&&m.context===1&&m.kind===3)return {kind:"person",menu:m};if(m.active&&m.context===0&&m.kind===0&&m.count===2&&m.index===0&&m.names[0]==="一键搜寻"&&m.names[1]==="普通搜寻")return {kind:"choice",menu:m};return false;})()');if(next.kind==='choice'){const start=(await readKeys(cdp)).length,before=await readWorld(cdp,'mod-before-ordinary-search-choice');await key(cdp,'ArrowDown');await waitFor(cdp,'actual ordinary search highlighted','baye.hd.menuItems().active&&baye.hd.menuItems().seq==='+next.menu.seq+'&&baye.hd.menuItems().index===1');await key(cdp,'Enter');await waitFor(cdp,'actual native ordinary SEARCH PERSON menu','baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===3');const after=await readWorld(cdp,'mod-after-ordinary-search-choice');assert.deepEqual((await readKeys(cdp,start)).map(k=>k.code),[35,39]);assertWorldSame(before,after,'Explicit ordinary search option does not create orders or change world');report.modOrdinarySearchChoice={beforeMenu:next.menu,before,after,keys:await readKeys(cdp,start)};}}
    const picker=await currentPersonPicker(cdp);assert.equal(picker.properties.propertyCount,mod?12:13);await checkpoint(cdp,'02-current-selected-person-properties');return picker;
}
async function nativePropertyPage(cdp,label){
    const picker=await currentPaint(cdp),p=picker.properties,before=await readWorld(cdp,label+'-before');
    assert.equal(p.protocolVersion,1);assert.equal(p.propertyCount,mod?12:13);assert.ok(p.pageEnd>p.pageStart&&p.pageEnd<=p.propertyCount);assert.equal(p.custom,mod?1:0);
    const corePresentation=await evaluate(cdp,'(() => {const f=document.querySelector("#hd-city-menu-person-fields"),d=BayeHdCityMenu.debugSnapshot().personDetail;if(!f||!d)return null;return {personIndex:d.personIndex,name:f.querySelector("h2")?.textContent,rowCount:f.querySelectorAll(".hd-city-menu-stat").length,noteText:Array.from(f.querySelectorAll(".hd-city-menu-info-note"),n=>n.textContent),debugGroups:d.groups,debugFieldCount:d.groups.reduce((n,g)=>n+g.rows.length,0)};})()');
    assert.ok(corePresentation);assert.equal(corePresentation.personIndex,p.person);assert.equal(corePresentation.name,before.persons[p.person].name);assert.equal(corePresentation.debugFieldCount,15,'Raw person fields remain available for inspection');assert.equal(corePresentation.rowCount,mod?0:15,'Custom native properties replace fixed standard field meanings; standard fields remain');if(mod)assert.ok(corePresentation.noteText.some(t=>t.includes('自定义人物属性')&&t.includes('原生人物属性')));
    const raw=await evaluate(cdp,'(() => {const d=baye.data,decode=(a,i)=>{const b=Uint8Array.from({length:128},(_,n)=>Number(a[i*128+n]));const end=b.indexOf(0);if(end<0)throw Error("Native unterminated property");return new TextDecoder("gbk",{fatal:true}).decode(b.subarray(0,end));};return Array.from({length:Number(d.g_hdPersonPropertiesPropertyCount)},(_,i)=>({index:i,flags:Number(d.g_hdPersonPropertiesPropertyFlags[i]),title:decode(d.g_hdPersonPropertiesPropertyTitles,i),value:decode(d.g_hdPersonPropertiesPropertyValues,i),titlePaintSeq:Number(d.g_hdPersonPropertiesTitlePaintSeq[i]),valuePaintSeq:Number(d.g_hdPersonPropertiesValuePaintSeq[i])}));})()');
    const hookStart=await evaluate(cdp,'window.__personPropertyHookLog.length');
    let expectedValues;const observedCells=[];
    if(!mod){const person=before.persons[p.person],labels=report.nativeContract.standardLabels,cityName=await evaluate(cdp,'baye.getCityName(window.__personRuntimeCity)');
        assert.ok(before.queue.includes(p.person));assert.ok(Number.isInteger(person.derivedArm)&&person.derivedArm>=0&&person.derivedArm<6);
        const equipment=await evaluate(cdp,'['+person.Tool1+','+person.Tool2+'].map(id=>id?baye.getToolName(id-1):"")');
        expectedValues=[person.Belong===65535?labels.captive:person.Belong===p.person+1?labels.king:person.Belong?before.persons[person.Belong-1].name:labels.free,cityName,String(person.Level),String(person.Force),String(person.IQ),!person.Belong||person.Belong===p.person+1?labels.noDevotion:String(person.Devotion),String(person.Experience),String(person.Thew),labels.arms[person.derivedArm],String(person.Arms),String(person.Age),...equipment];}
    for(let i=p.pageStart;i<p.pageEnd;i++){const property=p.properties[i],native=raw[i];assert.ok(property.captured&&property.titleCaptured&&property.valueCaptured);assert.equal(property.titlePaintSeq,p.paintSeq);assert.equal(property.valuePaintSeq,p.paintSeq);assert.equal(native.flags,3);assert.equal(property.title,native.title);assert.equal(property.value,native.value);assert.equal(property.title,(mod?report.nativeContract.modTitles:report.nativeContract.standardTitles)[i]);
        if(!mod)assert.equal(property.value,expectedValues[i],'Original selected person value agrees with independent native fields/ROM');
        if(mod){const log=await evaluate(cdp,'window.__personPropertyHookLog'),title=log.findLast(e=>e.name==='getPersonPropertyTitle'&&e.property===i),value=log.findLast(e=>e.name==='getPersonPropertyValue'&&e.person===p.person&&e.property===i);assert.ok(title&&value);assert.equal(title.value,property.title);assert.equal(value.value,property.value);assert.equal(title.returned,0);assert.equal(value.returned,0);}
        const selector='#hd-city-menu-person-properties-fields [data-hd-person-property="'+i+'"]',dom=await evaluate(cdp,'(() => {const n=document.querySelector('+JSON.stringify(selector)+');if(!n)return null;n.scrollIntoView({block:"center"});const r=n.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {title:n.querySelector("span").textContent,value:n.querySelector("strong").textContent,current:n.dataset.hdPersonPropertyCurrent,visible:r.width>0&&r.height>0&&!!t&&(t===n||n.contains(t)),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};})()');assert.ok(dom&&dom.visible);assert.equal(dom.title,property.title||'（空标题）');assert.equal(dom.value,property.value||'（空）');assert.equal(dom.current,'1');observedCells.push({index:i,...dom});}
    for(const direction of ['prev','next'])await targetPoint(cdp,'#hd-city-menu-person-properties-controls [data-hd-person-page="'+direction+'"]');
    await delay(200);const after=await readWorld(cdp,label+'-after');assertWorldSame(before,after,'Readonly property page/scroll');assert.equal(after.keys,before.keys);assert.equal(await evaluate(cdp,'window.__personPropertyHookLog.length'),hookStart,'Snapshot and UI never replay Mod property hooks');
    const record={label,viewport:await evaluate(cdp,'({width:innerWidth,height:innerHeight})'),owner:ownerIdentity(picker),native:p,raw,cells:observedCells,expectedValues,corePresentation,before,after,hookCount:hookStart};report.propertyChecks??=[];report.propertyChecks.push(record);return picker;
}
async function page(cdp,direction,label){
    const picker=await currentPersonPicker(cdp),p=picker.properties,start=(await readKeys(cdp)).length,before=await readWorld(cdp,label+'-before');assert.ok(direction==='next'?p.pageEnd<p.propertyCount:p.pageIndex>0);
    await click(cdp,'#hd-city-menu-person-properties-controls [data-hd-person-page="'+direction+'"]');const next=await waitFor(cdp,'one original property page ACK','(() => {const p=baye.hd.personProperties();return p.active&&p.pageComplete&&p.person==='+p.person+'&&p.menuSeq==='+p.menuSeq+'&&p.paintSeq!=='+p.paintSeq+'&&p.pageIndex==='+ (p.pageIndex+(direction==='next'?1:-1))+'&&p;})()');
    if(direction==='next')assert.equal(next.pageStart,p.pageEnd);else assert.equal(next.pageEnd,p.pageStart);assert.deepEqual((await readKeys(cdp,start)).map(k=>k.code),[report.nativeKeys[direction==='next'?'right':'left']]);const after=await readWorld(cdp,label+'-after');assertWorldSame(before,after,'Manual native property page');report.pageInputs??=[];report.pageInputs.push({label,direction,before:p,after:next,keys:await readKeys(cdp,start)});return next;
}
async function armPagePointer(cdp,direction){
    const selector='#hd-city-menu-person-properties-controls [data-hd-person-page="'+direction+'"]',point=await targetPoint(cdp,selector);
    await evaluate(cdp,'(() => {window.__personOldPage=document.querySelector('+JSON.stringify(selector)+');if(window.__personOldPage.disabled)throw Error("Cannot arm disabled page button");window.__personOldPageEvents=[];for(const type of ["pointerdown","click"])window.__personOldPage.addEventListener(type,e=>window.__personOldPageEvents.push({type:e.type,detail:e.detail,trusted:e.isTrusted}),{once:true});})()');
    await mouse(cdp,'mousePressed',point);const events=await evaluate(cdp,'window.__personOldPageEvents');assert.ok(events.some(e=>e.type==='pointerdown'&&e.trusted));report.inputs.push({type:'physical-held-page-pointer',direction,point});return point;
}
async function releasePagePointer(cdp,point){
    await evaluate(cdp,'if(window.__personOldPage.disabled)throw Error("Stale click must target an enabled button")');
    await mouse(cdp,'mouseReleased',point);await delay(200);const events=await evaluate(cdp,'window.__personOldPageEvents');assert.ok(events.some(e=>e.type==='click'&&e.detail===1&&e.trusted),'Actual retained gesture delivered a trusted click');return events;
}
async function heldPointerNewPaint(cdp,picker,label){
    const p=picker.properties,before=await readWorld(cdp,label+'-before'),start=before.keys;
    assert.ok(p.pageIndex>1,'Real previous-page click stays enabled after one keyboard LEFT');const point=await armPagePointer(cdp,'prev');
    await key(cdp,'ArrowLeft');
    await waitFor(cdp,'real keyboard page ACK while original pointer remains armed','(() => {const p=baye.hd.personProperties();return p.active&&p.pageComplete&&p.person==='+p.person+'&&p.menuSeq==='+p.menuSeq+'&&p.paintSeq!=='+p.paintSeq+'&&p.pageIndex==='+(p.pageIndex-1)+'&&p;})()');
    const next=await currentPaint(cdp);assert.equal(next.properties.pageEnd,p.pageStart);assert.deepEqual((await readKeys(cdp,start)).map(k=>k.code),[report.nativeKeys.left]);
    const after=await readWorld(cdp,label+'-after');assertWorldSame(before,after,'Actual keyboard paging preserves world');
    let events;const stale=await stableZeroInput(cdp,label+'-old-pointer',async()=>{events=await releasePagePointer(cdp,point);});
    report.staleChecks.push({...stale,events,beforePaint:p,afterPaint:next.properties,method:'Actual page pointer pressed before one physical keyboard LEFT, trusted release/click after native paint ACK; enabled button rejects old ticket'});
}
async function classicRetirement(cdp,label){
    const picker=await currentPaint(cdp),before=await readWorld(cdp,label+'-before'),hookCount=await evaluate(cdp,'window.__personPropertyHookLog.length');
    const point=await armPagePointer(cdp,'next');await evaluate(cdp,'BayeHdCityMenu.setMode("classic")');
    await waitFor(cdp,'real classic mode retires property pane','!BayeHdCityMenu.debugSnapshot().showHd&&!BayeHdCityMenu.debugSnapshot().personProperties&&document.getElementById("hd-city-menu-person-properties").hidden');
    await evaluate(cdp,'BayeHdCityMenu.setMode("hd")');const restored=await currentPaint(cdp);
    assert.equal(restored.properties.paintSeq,picker.properties.paintSeq);assert.notEqual(restored.city.personProperties.pageOwnerKey,picker.city.personProperties.pageOwnerKey);
    let events;await stableZeroInput(cdp,label+'-retired-ticket',async()=>{events=await releasePagePointer(cdp,point);});
    const after=await readWorld(cdp,label+'-after');assert.equal(after.keys,before.keys);assertWorldSame(before,after,'Mode changes and old pointer emit no game action');assert.equal(await evaluate(cdp,'window.__personPropertyHookLog.length'),hookCount);
    report.staleChecks.push({label,before,after,events,beforeOwner:picker.city.personProperties.pageOwnerKey,restoredOwner:restored.city.personProperties.pageOwnerKey,method:'Actual classic to HD mode retirement; same native paint, fresh UI epoch, trusted pointer release/click on enabled button rejected'});
}
async function tour(cdp,size,label){
    report.resizes.push(await stableZeroInput(cdp,label+'-resize',()=>cdp.send('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:false})));
    let picker=await currentPersonPicker(cdp);const indices=[...new Set([0,Math.floor(picker.ids.length/2),picker.ids.length-1])];
    for(const index of indices){picker=await highlight(cdp,index);while(picker.properties.pageIndex>0){await page(cdp,'prev',label+'-reset-'+index);picker=await currentPersonPicker(cdp);}const start=await readWorld(cdp,label+'-person-'+picker.ids[index]+'-start');
        const visited=[];for(let n=0;n<255;n++){picker=await nativePropertyPage(cdp,label+'-person-'+picker.ids[index]+'-page-'+n);visited.push({start:picker.properties.pageStart,end:picker.properties.pageEnd,paint:picker.properties.paintSeq});if(picker.properties.pageEnd===picker.properties.propertyCount)break;await page(cdp,'next',label+'-person-'+picker.ids[index]+'-next-'+n);}
        assert.equal(visited[0].start,0);assert.equal(visited.at(-1).end,mod?12:13);assert.equal(new Set(visited.flatMap(p=>Array.from({length:p.end-p.start},(_,i)=>p.start+i))).size,mod?12:13);assert.equal(picker.properties.complete,1);
        const oldKey=picker.city.personProperties.pageOwnerKey;
        const atEnd=await stableZeroInput(cdp,label+'-last-page-boundary',()=>evaluate(cdp,'document.querySelector("#hd-city-menu-person-properties-controls [data-hd-person-page=next]").click()'));report.staleChecks.push({...atEnd,method:'Actual disabled native end-page button, no key'});
        if(picker.properties.pageIndex>0)await heldPointerNewPaint(cdp,picker,label+'-held-page-after-new-paint');
        while((await currentPaint(cdp)).properties.pageIndex>0)await page(cdp,'prev',label+'-mode-reset');
        await classicRetirement(cdp,label+'-classic-retirement-'+index);
        const end=await readWorld(cdp,label+'-person-'+picker.ids[index]+'-end');assertWorldSame(start,end,'Complete person property tour');report.personTours??=[];report.personTours.push({label,id:picker.ids[index],index,visited,before:start,after:end,oldKey});}
    report.viewportChecks??=[];report.viewportChecks.push({label,size,ids:picker.ids});await checkpoint(cdp,label);
}
async function returnToMap(cdp){
    const before=await readWorld(cdp,'before-native-back'),picker=await currentPersonPicker(cdp),start=before.keys;await click(cdp,'#hd-city-menu [data-hd-menu-back]');await waitFor(cdp,'real map ACK and property retirement','(() => {const s=BayeHdCityMenu.debugSnapshot(),p=baye.hd.march();return !baye.hd.menuItems().active&&!s.open&&!s.personProperties&&!baye.hd.personProperties().active&&p.pick===1&&p.phase===0&&p.battlePick===0;})()');
    assert.deepEqual((await readKeys(cdp,start)).map(k=>k.code),[40]);const after=await readWorld(cdp,'after-native-back');assertWorldSame(before,after,'Person browsing never changes persons/orders/resources/date/cursor');await delay(500);assert.equal((await readKeys(cdp,after.keys)).length,0);report.returnToMap={before,after,owner:ownerIdentity(picker),keys:await readKeys(cdp,start)};await checkpoint(cdp,'05-real-map-after-one-native-back');
}
async function smoke(cdp){
    report.firstPicker=await boot(cdp);for(const size of viewports)await tour(cdp,size,size.height===1080?'03-person-properties-1080p':'04-person-properties-720p');await returnToMap(cdp);await observeActualLib(cdp,'finished-person-properties');
    report.engineInputs=await readKeys(cdp);report.originalHookCalls=await evaluate(cdp,'window.__personPropertyHookLog');report.observerErrors=await evaluate(cdp,'window.__searchObserverErrors');assert.deepEqual(report.observerErrors,[]);assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.dialogs,[]);
    if(mod)assert.equal(report.nativeDialogs?.length,1,'Actual sc-mod startup has exactly its expected native name prompt');
    const known=['https://img.bbkgames.com/script/js-sdk.js?ver=20260329','http://hm.baidu.com/hm.js?55cdc246d0c836cecfdf39ce0d5657f3'];assert.ok(report.blocked.every(url=>known.includes(url)));report.httpErrors=report.requests.filter(r=>r.status>=400&&!r.url.endsWith('/favicon.ico'));assert.deepEqual(report.httpErrors,[]);report.hdAccepted=true;
}
async function main(){
    assert.ok(!fs.existsSync(path.join(artifactDir,'result.json')),'Prior results are preserved; use a fresh artifact directory');fs.mkdirSync(artifactDir,{recursive:true});
    let server,chrome,cdp,profile,chromeError;const interrupt=()=>{report.interrupted=true;cdp?.close();if(!childExited(chrome))chrome.kill('SIGTERM');server?.closeAllConnections();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
    try{
        prepareServedAssets();console.log('Frozen',Object.keys(report.sources).length,'sources; native',report.nativeSourceCheck.aggregate,'runner',report.tool.sha256);
        if(preflightOnly){report.ok=true;report.scope={accepted:'Readonly actual property-title ROM/source metadata, staged/installed native provenance and frozen sources',notRun:'No browser/server/person property page acceptance'};return;}
        assert.equal(typeof WebSocket,'function');profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-person-properties-runtime-'));server=await startServer();const origin='http://127.0.0.1:'+server.address().port,debugPort=await unusedPort();assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);
        const binary=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(fs.existsSync(binary));
        chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size=1920,1080','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>chromeError=e);
        report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};console.log('Private isolation',JSON.stringify(report.isolation));
        let target;const deadline=Date.now()+15000;while(Date.now()<deadline){if(chromeError)throw chromeError;if(childExited(chrome))throw Error('Chrome exited '+chrome.exitCode+' signal '+chrome.signalCode);try{const tabs=await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json());target=tabs.find(t=>t.type==='page');if(target)break;}catch{}await delay(100);}assert.ok(target,'Private CDP started');cdp=await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled',e=>report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')}));cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening',e=>{const expected=mod&&e.type==='prompt'&&e.message==='来将可留姓名？'&&e.defaultPrompt==='常山赵子龙'&&!(report.nativeDialogs?.length);if(expected){report.nativeDialogs??=[];report.nativeDialogs.push({type:e.type,message:e.message,defaultPrompt:e.defaultPrompt,response:'测试玩家'});}else report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',expected?{accept:true,promptText:'测试玩家'}:{accept:false}).catch(()=>{});});
        cdp.on('Fetch.requestPaused',e=>{const local=new URL(e.request.url).origin===origin;if(!local)report.blocked.push(e.request.url);cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');report.browser=await cdp.send('Browser.getVersion');await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
        await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.clear();localStorage.setItem('baye/libpath',"+JSON.stringify(mod?'libs/sc-mod.lib':'libs/dat-mod.lib')+");localStorage.setItem('baye/overworldMode',"+JSON.stringify(mod?'classic':'hd-map')+");localStorage.setItem('baye/systemUiMode','classic');localStorage.setItem('baye/cityMenuMode','hd');"});
        await cdp.send('Page.navigate',{url:origin+'/pc.html'});await smoke(cdp);report.ok=true;
    }catch(error){report.ok=false;report.error=error.stack||String(error);process.exitCode=1;console.error(report.error);if(cdp){try{report.failureState=await evaluate(cdp,snapshotExpression);report.engineInputs=await readKeys(cdp);report.failureWorld=await readWorld(cdp,'terminal-failure');}catch(e){report.failureReadError=String(e);}try{const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(png.data,'base64'));}catch{}}}
    finally{
        process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);cdp?.close();if(!childExited(chrome)){const stopped=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([stopped,delay(1500)]);if(!childExited(chrome)){chrome.kill('SIGKILL');await Promise.race([stopped,delay(1500)]);}}
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        if(profile){assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));assert.ok(path.basename(profile).startsWith('baye-person-properties-runtime-'));try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(e){report.ok=false;report.cleanupError=String(e);process.exitCode=1;}}
        const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),exists=fs.existsSync(f),actualSha256=exists?sha(fs.readFileSync(f)):null;return {path:name,...m,actualSha256,match:exists&&actualSha256===m.sha256};}),added=productionDirectories.flatMap(d=>walk(path.join(root,d))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(n=>!servedAssets.has(n)),drift=sources.filter(s=>!s.match);
        report.sourceVerification={ok:!drift.length&&!added.length,count:sources.length,drift,added,sources};if(!report.sourceVerification.ok){report.ok=false;report.freezeFailure='Source bytes missing/changed/added';process.exitCode=1;}
        report.isolation={...report.isolation,profile:profile||null,cleaned:!profile||!fs.existsSync(profile),chromeExited:childExited(chrome),chromeExitCode:chrome?.exitCode??null,chromeSignalCode:chrome?.signalCode??null,httpClosed:!server||!server.listening,user8080Touched:false};if(!report.isolation.cleaned||!report.isolation.chromeExited||!report.isolation.httpClosed){report.ok=false;process.exitCode=1;}
        report.hdAccepted=report.ok===true&&report.hdAccepted===true;report.finishedAt=new Date().toISOString();
        for(const [name,value] of [['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])fs.writeFileSync(path.join(artifactDir,name),JSON.stringify(value,null,2)+'\n');
        console.log('Finished',JSON.stringify({ok:report.ok,preflightOnly,hdAccepted:report.hdAccepted,checkpoints:report.phases.length,sources:report.sourceVerification.count,drift:drift.length,added:added.length,exceptions:report.exceptions.length,cleanup:report.isolation.cleaned,artifactDir}));
    }
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
