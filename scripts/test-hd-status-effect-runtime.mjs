#!/usr/bin/env node
/** Genuine P1 MaTeng, TianShui8 -> HeNei9. Both native upgrade/departure27 ranges are required. Private non8080 Chrome only.
 * node scripts/test-hd-status-effect-runtime.mjs --staged --max-turns 12 --artifact-dir build/r20-status-staged
 * --preflight-only verifies frozen files without creating a server, profile or browser. */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const flags=new Set(['--staged','--classic','--missing-picture2','--720','--preflight-only','--protect-lord']);
for(let i=2;i<process.argv.length;i++){const flag=process.argv[i];if(flag==='--artifact-dir'||flag==='--max-turns'){assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing '+flag+' value');i++;}else assert.ok(flags.has(flag),'Unknown option: '+flag);}
const staged=process.argv.includes('--staged'),classic=process.argv.includes('--classic'),missing=process.argv.includes('--missing-picture2'),preflightOnly=process.argv.includes('--preflight-only');
const protectLord=process.argv.includes('--protect-lord');
const artifactFlag=process.argv.indexOf('--artifact-dir'),artifactDir=path.resolve(artifactFlag>=0?process.argv[artifactFlag+1]:path.join(root,'build/r20-status-effect-runtime'));
const viewport=process.argv.includes('--720')?{width:1280,height:720}:{width:1920,height:1080};
const turnFlag=process.argv.indexOf('--max-turns'),maxTurns=turnFlag>=0?Number(process.argv[turnFlag+1]):8;
assert.ok(maxTurns===8||maxTurns===12||maxTurns===20,'--max-turns is an explicit private-game budget of 8, 12 or 20');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const report={staged,classic,missing,preflightOnly,protectLord,viewport,maxTurns,startedAt:new Date().toISOString(),phases:[],console:[],exceptions:[],dialogs:[],blocked:[],requests:[],inputs:[],reportAcks:[],lordMoves:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.lib':'application/octet-stream','.ttf':'font/ttf'};
const servedAssets=new Map(),nativeMovies=new Map(),productionDirectories=['js','css','assets','vendor/iBaye/src'];let nativeLib,font;const statusEntries=new Map();
const targetName=()=>path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/');
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(i=>i.isDirectory()?walk(path.join(directory,i.name)):[path.join(directory,i.name)]);}
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
        help: api && api.hd && api.hd.help(), view: api && api.hd && api.hd.view(),
        portrait: window.BayeHdPortraits && BayeHdPortraits.debugSnapshot(),
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

async function smoke(cdp) {
    await waitFor(cdp, 'real LIB/WASM initialization', 'window.baye && baye.hd && baye.hd.ready()', 60000);
    await observeActualLib(cdp,'startup');
    report.inputObserver = await evaluate(cdp, `(() => {
        if (!baye.hd.ready() || typeof window.sendKey !== 'function' || typeof baye.sendKey !== 'function') throw Error('Real input bindings not ready');
        window.__statusInputCalls=[];window.__statusInputDepth=0;
        const snapshot=()=>{try{return JSON.parse(JSON.stringify({spe:baye.hd.spe(),fight:baye.hd.fight()}));}catch(e){window.__statusObserverErrors.push('input-snapshot: '+String(e));return null;}};
        const wrap=(api,original)=>function(code){
            const depth=++window.__statusInputDepth,before=snapshot();
            try{return original.apply(this,arguments);}
            finally{window.__statusInputCalls.push({api,code,depth,at:performance.now(),before,after:snapshot()});window.__statusInputDepth--;}
        };
        window.sendKey=wrap('window.sendKey',window.sendKey);baye.sendKey=wrap('baye.sendKey',baye.sendKey);
        window.__runtimeEngineInputs=[];const original=window.sendKey;
        window.sendKey=function(code){const f=baye.hd.fight(),m=baye.hd.march();window.__runtimeEngineInputs.push({code,fightKind:f.inputKind,fightSeq:f.inputSeq,marchPhase:m.phase,marchSeq:m.inputSeq,marchSession:m.session});return original.apply(this,arguments);};
        return {installedAfterNativeReady:true,window:true,baye:true,depth:window.__statusInputDepth,calls:window.__statusInputCalls.length};
    })()`);
    assert.deepEqual(report.inputObserver,{installedAfterNativeReady:true,window:true,baye:true,depth:0,calls:0});
    await verifyFont(cdp,'after-native-ready');
    const bindings = await evaluate(cdp, `({ ready: baye.data.g_hdEngineReady, control: baye.data.g_hdFightMenuControl,
        battlePref: BayeHdBattle.getMode(), hook: Object.prototype.hasOwnProperty.call(baye.hooks, 'fightOpenMainMenu') })`);
    assert.equal(bindings.ready, 1, 'HD C fields are bound after LIB initialization');
    assert.equal(bindings.control, 0);
    assert.equal(bindings.battlePref, 'auto', 'fresh profiles follow the overworld battle preference');
    assert.equal(await evaluate(cdp, 'BayeHdBattle.shouldShowHd()'), false, 'default overworld keeps classic battle');
    assert.equal(bindings.hook, false, 'classic battle does not own the engine menu hook');
    await checkpoint(cdp, '01-engine-ready');

    // Native title/era menus are animated pictures, not text menus. Observe
    // genuine C SPE notifications (MAIN_ICON1=100, YEAR_ICON1=104) without
    // creating replacement engine hooks or assigning game-state fields.
    await evaluate(cdp, `(() => {
        window.__runtimeSpeSeen = [];
        const remember = () => {
            const event = baye.hd.spe();
            if (event.id) window.__runtimeSpeSeen.push(event.id);
        };
        const original = BayeHdSpe.onEngineSpe;
        BayeHdSpe.onEngineSpe = function () { remember(); return original.apply(this, arguments); };
        remember();
    })()`);
    await waitFor(cdp, 'natural opening ends at title', `window.__runtimeSpeSeen.includes(100)`, 60000);
    await waitFor(cdp, 'classic animated title', `window.__runtimeSpeSeen.includes(100)`);
    await checkpoint(cdp, '02-classic-title');
    await key(cdp, 'Enter');
    await waitFor(cdp, 'classic animated period selection', `window.__runtimeSpeSeen.includes(104)`);
    await checkpoint(cdp, '03-period');
    await key(cdp, 'Enter');
    await waitFor(cdp, 'lord selection', `baye.data.g_PIdx === 1 && baye.hd.kings().count > 0`);
    await checkpoint(cdp, '04-lord');
    const lord = await evaluate(cdp, `(() => {
        const menu = baye.hd.kings();
        const target = menu.kings.findIndex((person) => person.name === '马腾');
        return { target, index: menu.index, kings: menu.kings };
    })()`);
    assert.ok(lord.target>=0,'Actual P1 马腾 lord exists');assert.equal(lord.kings[lord.target].id,5,'Actual P1 native person5, not a period2 guess');
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'real lord highlight', `baye.hd.kings().index === ${lord.target}`);
    report.selectedLord = lord.kings[lord.target];
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', `baye.hd.march().pick && baye.hd.realm().ownedCount > 0`);
    await checkpoint(cdp, '05-classic-map');

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
    report.marchSelections=[];
    for(let i=0;i<6;i++) {
        const before=await waitFor(cdp,'current complete march person owner '+i,
            `(()=>{const m=baye.hd.march(),n=baye.hd.menuItems(),c=BayeHdCityMenu.debugSnapshot();
            if(m.phase!==1)return {finished:true,march:m,menu:n,city:c};
            if(!n.active||n.context!==1||n.kind!==3||!n.idsValid||!c.deepMenuOwner||!c.deepItems.length)return null;
            if(c.deepMenuOwner.seq!==n.seq||c.deepMenuOwner.context!==n.context||c.deepMenuOwner.kind!==n.kind||c.deepItems.length!==n.ids.length||!c.deepItems.every((r,j)=>r.pind===n.ids[j]&&r.i===j))return null;
            return {march:m,menu:n,city:c};})()`);
        if(before.finished)break;
        const person=before.menu.ids[0];assert.equal(before.city.deepItems[0].pind,person);
        await click(cdp,'#hd-city-menu [data-hd-deep="0"]');
        const ack=await waitFor(cdp,'selected general acknowledged',`(()=>{const m=baye.hd.march();return (m.selected>${before.march.selected}||m.phase!==1)&&m;})()`);
        assert.equal(ack.selected,before.march.selected+1,'One actual person added per player confirmation');
        report.marchSelections.push({person,before,ack});
    }
    assert.equal(report.marchSelections.length,6,'Six actual resident generals depart without recruiting or changing troops');
    assert.equal(await evaluate(cdp,'baye.hd.march().selected'),6);
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
    return;
}

const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<=2000){const p=d.g_Persons[id-1];units.push({i,id,person:id-1,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),arms:Number(p.Arms),level:Number(p.Level),experience:Number(p.Experience)});}
    }
    return {fight:baye.hd.fight(),generation:Number(d.g_hdSpeGeneration),units,weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
})()`;

async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&f;})()`,timeout);
}
function prepareServedAssets(){
 report.sources={};for(const dir of productionDirectories)for(const filename of walk(path.join(root,dir)))freezeAsset(path.relative(root,filename).replaceAll('\\','/'));
 for(const rel of ['scripts/write-wasm-manifest.mjs','pc.html','fonts/HarmonyOS_Sans_SC_Regular.ttf','favicon.png','qr.png',targetName()])freezeAsset(rel);
 nativeLib=freezeAsset('libs/dat-mod.lib').data;assert.equal(sha(nativeLib),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 for(const name of ['baye.js','baye.wasm','baye.wasm.map','baye.build.json']){const source=(staged?'build/wasm/src/':'js/')+name,data=fs.readFileSync(path.join(root,source)),metadata={source,bytes:data.length,sha256:sha(data)};report.sources['served:'+name]=metadata;servedAssets.set('js/'+name,{data,metadata});}
 const build=JSON.parse(servedAssets.get('js/baye.build.json').data);assert.equal(build.hdSpeProtocol.version,2);assert.equal(build.hdAiTargetProtocol.version,2);assert.equal(build.hdStatusEffectProtocol.version,1,'The served quartet must contain the actual new status protocol');
 for(const name of ['baye.js','baye.wasm','baye.wasm.map']){assert.equal(report.sources['served:'+name].bytes,build.artifacts[name].bytes);assert.equal(report.sources['served:'+name].sha256,build.artifacts[name].sha256);}
 const hash=crypto.createHash('sha256'),files=[],tracked=execFileSync('git',['ls-files','-z','vendor/iBaye'],{cwd:root}).toString('utf8').split('\0').filter(Boolean).sort();
 for(const name of tracked){const asset=freezeAsset(name);files.push({name,...asset.metadata});hash.update(name+'\0');hash.update(asset.data);}report.nativeSourceCheck={count:files.length,aggregate:hash.digest('hex'),manifest:build.engineSourceSha256,files};assert.equal(files.length,128);assert.equal(report.nativeSourceCheck.aggregate,build.engineSourceSha256,'Actual new native source bytes equal the served staged/installed compilation');
 const manifest=JSON.parse(freezeAsset('assets/hd-spe/manifest.json').data);assert.equal(manifest.libSha256,sha(nativeLib));assert.equal(manifest.axScale,1);
 const movie=nativeMovie(27);assert.deepEqual([movie.count,movie.picmax,movie.length,movie.fingerprint],[18,9,735,'fnv1a32:ba494eea:735']);
 for(const reason of [1,2]){
    const start=reason===1?0:6,end=start+5,entry=manifest.entries.find(e=>e.speId===27&&e.kind===4&&e.resourceIndex===0&&e.startFrm===start&&e.endFrm===end);
    assert.ok(entry,'Real status range exists');assert.equal(entry.statusVersion,1);assert.equal(entry.statusReason,reason);assert.equal(entry.maskSemantics,'native-and-or-v1');assert.equal(entry.resourceFingerprint,movie.fingerprint);assert.equal(entry.resourceLength,movie.length);assert.equal(entry.pictures.length,9);assert.equal(entry.units.length,18);
    entry.units.forEach((u,i)=>assert.deepEqual(u,{frame:i,x:movie.units[i].x,y:movie.units[i].y,picIndex:movie.units[i].picIndex}));
    const used=new Set(movie.units.slice(start,end+1).map(u=>u.picIndex));
    for(const p of entry.pictures){const native=movie.pictures[p.picIndex];assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[16,16,16,16,1]);
        if(!used.has(p.picIndex)){assert.deepEqual([p.src,p.width,p.height],[null,null,null]);continue;}
        const white=Array(32).fill(0);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const offset=y*2+(x>>3),bit=128>>(x&7);if(!(native.data[offset]&bit)&&!(native.data[32+offset]&bit))white[(y*16+x)>>3]|=1<<((y*16+x)&7);}
        assert.deepEqual(p.nativeWhitePixels,white);const png=freezeAsset(p.src).data;assert.equal(png.readUInt32BE(16),p.width);assert.equal(png.readUInt32BE(20),p.height);assert.equal(png[25],6);assert.deepEqual([p.width,p.height],[1254,1254]);
    }
    statusEntries.set(reason,entry);
 }
 assert.equal(statusEntries.get(1).pictures[2].src,statusEntries.get(2).pictures[2].src,'Controlled missing picture2 is a real shared slot required by both ranges');
 font='fonts/HarmonyOS_Sans_SC_Regular.ttf';report.fontSource=servedAssets.get(font).metadata;report.engineManifest=build;
 report.statusNativeResource={id:27,index:0,reasons:[{reason:1,start:0,end:5},{reason:2,start:6,end:11}],count:18,picmax:9,bytes:movie.length,fingerprint:movie.fingerprint,units:movie.units,pictures:movie.pictures.map((p,picIndex)=>({picIndex,width:p.width,height:p.height,mask:p.mask}))};report.tool=servedAssets.get(targetName()).metadata;
 report.freezeScope='All actual js/css/assets/vendor sources, native128 and actual served quartet, tracked runner/writer/pc/Regular font and standard LIB. The old logical installed quartet is also frozen in staged runs but is not the served engine.';
}

async function startServer(){
 const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'pc.html';
 if(missing&&rel===statusEntries.get(1).pictures[2].src){report.requests.push({url:url.pathname,status:404,expected:true});res.writeHead(404).end();return;}
 const s=servedAssets.get(rel);if(!s){report.requests.push({url:url.pathname,status:404,expected:rel==='favicon.ico'});res.writeHead(404).end();return;}
 report.requests.push({url:url.pathname,status:200,...s.metadata});res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'});res.end(s.data);
 }catch(e){report.requests.push({url:req.url,status:400,error:String(e)});res.writeHead(400).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server;
}
const observerSource='('+function(){
 window.__statusSamples=[];window.__statusCaptures=[];window.__statusKeys=[];window.__statusObserverErrors=[];window.__statusDrawLog=[];let api=null,originalKey=null;
 for(const name of ['clearRect','drawImage','fillRect','fillText','rect','clip']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(){const result=original.apply(this,arguments);if(this.canvas&&this.canvas.id==='hd-spe-canvas'){const args=Array.from(arguments);if(name==='clearRect'&&args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height)window.__statusDrawLog=[];let op={type:name,args,fillStyle:this.fillStyle};if(name==='drawImage'){const source=args.shift();op.src=source.src?new URL(source.src,location.href).pathname.replace(/^\//,''):null;op.args=args;op.naturalWidth=source.naturalWidth||source.width;op.naturalHeight=source.naturalHeight||source.height;}window.__statusDrawLog.push(op);}return result;};}
 const snap=()=>{try{return baye.hd.ready()?JSON.parse(JSON.stringify({spe:baye.hd.spe(),fight:baye.hd.fight()})):null;}catch{return null;}};
 const base64=data=>{let text='';for(const byte of data)text+=String.fromCharCode(byte);return btoa(text);};
 function capture(stage,img,w,h,callbackBefore,callbackAfter){try{const s=snap();if(!s)return;const spe=s.spe;if(spe.active&&spe.id===27&&spe.kind===4&&((spe.startFrm===0&&spe.endFrm===5)||(spe.startFrm===6&&spe.endFrm===11))){const ui=api.debugSnapshot();window.__statusSamples.push({stage,at:performance.now(),spe,ui});if(stage==='lcd-flush'&&img){const before=snap(),lcd=document.createElement('canvas'),hd=document.getElementById('hd-spe-canvas');lcd.width=w;lcd.height=h;lcd.getContext('2d').putImageData(img,0,0);const node=document.getElementById('hd-spe'),rect=hd&&hd.getBoundingClientRect(),style=hd&&getComputedStyle(hd),rootStyle=node&&getComputedStyle(node),top=rect&&document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);let hdLogicalRgba=null;
 if(hd&&ui.open&&ui.sourceRect&&hd.width===ui.sourceRect.width*ui.scale&&hd.height===ui.sourceRect.height*ui.scale){const data=hd.getContext('2d').getImageData(0,0,hd.width,hd.height).data,logical=[];for(let y=0;y<ui.sourceRect.height;y++)for(let x=0;x<ui.sourceRect.width;x++){const o=(Math.floor((y+.5)*ui.scale)*hd.width+Math.floor((x+.5)*ui.scale))*4;for(let c=0;c<4;c++)logical.push(data[o+c]);}hdLogicalRgba=base64(logical);}
 const d=baye.data,units=[];for(let i=0;i<20;i++){const id=Number(d.g_FgtParam.GenArray[i]),p=d.g_GenPos[i];if(id>0&&id<0xfffe)units.push({i,person:id-1,x:Number(p.x),y:Number(p.y),hp:Number(p.hp),state:Number(p.state),arms:Number(d.g_Persons[id-1].Arms),level:Number(d.g_Persons[id-1].Level),experience:Number(d.g_Persons[id-1].Experience),name:baye.getPersonName(id-1)});}
 const after=snap();window.__statusCaptures.push({stage,at:performance.now(),before,after,callbackBefore,callbackAfter,spe,ui,units,hidden:document.hidden,mode:BayeHdBattle.getMode(),drawing:{scale:Number(d.g_scale),flip:Number(d.g_FlipDrawing),paint:Number(d.g_paintColor),palette0:Number(d.g_paintPalette[0]),palette255:Number(d.g_paintPalette[255])},paletteReadback:Array.from({length:256},(_,i)=>Number(d.g_paintPalette[i])>>>0),nativeWidth:w,nativeHeight:h,nativeRgba:base64(img.data),hdLogicalRgba,nativeUrl:lcd.toDataURL('image/png'),hdUrl:hd&&ui.open&&hd.toDataURL('image/png'),drawLog:window.__statusDrawLog.slice(),dom:rect&&{visible:!!(rect.width&&rect.height&&style.visibility==='visible'&&style.display!=='none'&&rootStyle.visibility==='visible'&&rootStyle.display!=='none'),inViewport:rect.x>=0&&rect.y>=0&&rect.right<=innerWidth+.5&&rect.bottom<=innerHeight+.5,stackOwned:!!(top&&node.contains(top)),x:rect.x,y:rect.y,width:rect.width,height:rect.height}});}}
 if(window.__statusCaptures.length>2000||window.__statusSamples.length>30000)throw Error('Read-only status capture bound exceeded');
 }catch(e){window.__statusObserverErrors.push(String(e));}}
 Object.defineProperty(window,'BayeHdSpe',{configurable:true,get(){return api;},set(value){api=value;for(const name of ['onEngineSpe','onLcdFlush']){const original=api[name];api[name]=function(){const before=snap(),result=original.apply(this,arguments),after=snap();capture(name==='onLcdFlush'?'lcd-flush':'lifecycle',name==='onLcdFlush'?arguments[0]:null,arguments[1],arguments[2],before,after);return result;};}if(!originalKey&&typeof window.sendKey==='function'){originalKey=window.sendKey;window.sendKey=function(code){const s=snap();window.__statusKeys.push({code,at:performance.now(),spe:s&&s.spe,fight:s&&s.fight});return originalKey.apply(this,arguments);};}}});
}.toString()+')();';
const frames=bits=>Array.from({length:256},(_,i)=>i).filter(i=>bits[i>>3]&(1<<(i&7)));
function movieOracle(movie,start,end,base){
 const width=16,height=16,pixels=Buffer.from(base),spec=movie.units.slice(start,end+1).map(u=>u.cdelay),spem=movie.units.slice(start,end+1).map(u=>u.ndelay),clears=Buffer.alloc(32),records=[];let mcount=0,ymount=0,cls=true,show=true;
 for(let loop=0;loop<100000;loop++){for(let i=0;i<=mcount;i++){if(spec[i]===1){pixels.fill(0);clears[(start+i)>>3]|=1<<((start+i)&7);cls=true;}if(spec[i])spec[i]=(spec[i]-1)&255;}
 const draw=i=>{const u=movie.units[start+i];nativePaint(pixels,width,height,movie.pictures[u.picIndex],u.x,u.y);};if(cls)for(let i=0;i<=ymount;i++)if(spec[i])draw(i);if(show){for(let i=ymount+1;i<=mcount;i++)if(spec[i])draw(i);ymount=mcount;}
 if(cls||show){const visible=Buffer.alloc(32);for(let i=0;i<=mcount;i++)if(spec[i])visible[(start+i)>>3]|=1<<((start+i)&7);records.push({frame:start+mcount,visible,clears:Buffer.from(clears),pixels:Buffer.from(pixels)});cls=show=false;}
 if(spem[mcount])spem[mcount]--;while(spem[mcount]<=1&&mcount+start<end){mcount++;show=true;}if(mcount+start>=end&&spec.every(v=>v<=1))return records;}throw Error('Native timer bound exceeded');
}
function verifyCaptures(captures,keys){
 const events=new Map(),verified=[];let hd=0;
 for(const c of captures){
    assert.deepEqual(c.before,c.after,'Readback writes no native fields');assert.deepEqual(c.callbackBefore,c.callbackAfter,'Presentation callback writes no native fields');
    const s=c.spe,d=s.display,a=d.statusEffect,current=s.statusEffect;if(!d.frameValid)continue;
    assert.ok(s.protocolValid&&current.valid&&a.valid,'Both independent native status copy/display proofs are valid');assert.equal(a.protocolVersion,1);assert.equal(current.protocolVersion,1);
    const start=a.reason===1?0:6,end=start+5,entry=statusEntries.get(a.reason);assert.ok(entry);assert.ok(a.phase===1||a.phase===2);
    assert.deepEqual([s.id,s.kind,s.resourceIndex,s.count,s.picmax,s.startFrm,s.endFrm,s.keyflag],[27,4,0,18,9,start,end,0]);assert.equal(s.skipEligible,false);assert.equal(s.resourceFingerprint,'fnv1a32:ba494eea:735');assert.equal(s.resourceLength,735);
    assert.equal(s.contextKnown,true);assert.equal(s.actorIndex,a.subjectIndex);assert.equal(s.targetIndex,a.subjectIndex);assert.equal(s.skillId,0);
    assert.equal(a.basePixels.length,256);assert.equal(a.baseRgba.length,1024);assert.deepEqual(a.basePixels,current.basePixels);assert.deepEqual(a.baseRgba,current.baseRgba);assert.equal(c.paletteReadback.length,256);
    for(let p=0;p<256;p++){const color=c.paletteReadback[a.basePixels[p]],rgba=[color&255,color>>>8&255,color>>>16&255,color>>>24];assert.deepEqual(a.baseRgba.slice(p*4,p*4+4),rgba,'Captured first-draw RGBA independently matches actual native palette');}
    const facts=['reason','phase','subjectIndex','subjectPerson','subjectX','subjectY','beforeLevel','afterLevel','beforeExperience','afterExperience','beforeState','afterState','beforeHp','afterHp','beforeArms','afterArms','levelMax','mapSX','mapSY','mapWidth','mapHeight','screenWidth','screenHeight','regionX','regionY','regionWidth','regionHeight','paletteZero','paletteInk'];
    for(const field of facts){assert.ok(Number.isInteger(a[field]),field);assert.equal(a[field],current[field],'Immutable current/display status '+field);}
    assert.equal(c.before.fight.active,a.phase===1?1:0,'Current phase is the authenticated native command/initialization scope');
    assert.ok(a.subjectIndex>=0&&a.subjectIndex<20&&a.subjectPerson>=0&&a.subjectPerson<2000);assert.ok(a.beforeState<8);assert.equal(a.afterHp,a.beforeHp);assert.equal(a.afterArms,a.beforeArms);
    if(a.reason===1){assert.ok(a.beforeExperience>=100);assert.equal(a.afterExperience,a.beforeExperience-100);assert.equal(a.afterLevel,Math.min((a.beforeLevel+1)&255,a.levelMax));assert.equal(a.afterState,a.beforeState);}
    else{assert.equal(a.afterState,8);assert.ok(a.afterHp===0||a.afterArms===0);assert.equal(a.afterLevel,a.beforeLevel);assert.equal(a.afterExperience,a.beforeExperience);}
    assert.deepEqual([c.nativeWidth,c.nativeHeight],[160,96]);assert.deepEqual([c.drawing.scale,c.drawing.flip,c.drawing.paint,c.drawing.palette0,c.drawing.palette255],[1,0,255,0x00ffffff,0xff000000]);
    const region={x:a.regionX,y:a.regionY,width:a.regionWidth,height:a.regionHeight},eventKey=s.generation+':'+s.eventId,raw=Buffer.from(c.nativeRgba,'base64'),x=region.x,y=region.y;
    assert.equal(raw.length,160*96*4);assert.deepEqual([region.width,region.height],[16,16]);assert.deepEqual([x,y],[s.x,s.y]);assert.deepEqual([x,y],[(a.subjectX-a.mapSX)*16,(a.subjectY-a.mapSY)*16]);assert.ok(x>=0&&x+16<=160&&y>=0&&y+16<=96);
    const subject=c.units.find(u=>u.i===a.subjectIndex);assert.ok(subject,'Subject is a real current GenArray unit, including STATE_SW');assert.equal(subject.person,a.subjectPerson);
    assert.deepEqual([subject.x,subject.y,subject.hp,subject.arms,subject.level,subject.experience,subject.state],[a.subjectX,a.subjectY,a.afterHp,a.afterArms,a.afterLevel,a.afterExperience,a.afterState],'Independent actual person/JLPOS readback matches post-mutation subject');
    if(!events.has(eventKey))events.set(eventKey,{reason:a.reason,start,end,records:movieOracle(nativeMovie(27),start,end,a.basePixels),outside:raw,base:a.basePixels,baseRgba:a.baseRgba,palette:c.paletteReadback,facts:Object.fromEntries(facts.map(f=>[f,a[f]]))});
    const event=events.get(eventKey);assert.deepEqual(event.facts,Object.fromEntries(facts.map(f=>[f,a[f]])));assert.deepEqual(a.basePixels,event.base,'First pre-draw index base stays fixed');assert.deepEqual(a.baseRgba,event.baseRgba,'First pre-draw RGBA stays fixed');
    const expected=event.records[d.commitSeq-1];assert.ok(expected,'Actual copied commit exists in independent native timer model');assert.equal(d.frameIndex,expected.frame);assert.deepEqual(Buffer.from(d.visibleFrames),expected.visible);assert.deepEqual(Buffer.from(a.clearFrames),expected.clears);
    const full=Buffer.from(event.outside);for(let row=0;row<16;row++)for(let col=0;col<16;col++)full.writeUInt32LE(event.palette[expected.pixels[row*16+col]],((y+row)*160+x+col)*4);
    assert.deepEqual(raw,full,'Full160x96 actual LCD: native AND/OR timer + real indexed palette + fixed first-draw base; outside equals first actual event LCD');
    if(classic){assert.equal(c.ui.open,false);assert.equal(c.hdLogicalRgba,null);}
    else{
        assert.ok(c.ui.open&&c.dom.visible&&c.dom.inViewport&&c.dom.stackOwned);assert.equal(c.ui.skipVisible,false);assert.deepEqual(c.ui.sourceRect,{x:0,y:0,width:160,height:96});assert.equal(c.ui.presentation,'status-effect');assert.equal(c.ui.outsideSource,'lcd');assert.ok(c.hdLogicalRgba);
        const rendered=Buffer.from(c.hdLogicalRgba,'base64');assert.equal(rendered.length,raw.length);
        for(let row=0;row<96;row++)for(let col=0;col<160;col++)if(missing||row<y||row>=y+16||col<x||col>=x+16){const i=(row*160+col)*4;assert.equal(rendered[i+3],raw[i+3]);assert.deepEqual(rendered.subarray(i,i+3),raw[i+3]?raw.subarray(i,i+3):Buffer.alloc(3),missing?'Missing picture preserves full actual LCD':'HD outside the authenticated subject cell preserves actual LCD (Canvas normalizes transparent RGB)');}
        if(missing)assert.equal(c.ui.source,'lcd');
        else{
            assert.equal(c.ui.source,'hd-assets');assert.deepEqual(c.ui.hdRegion,{x,y,width:16,height:16});const live=frames(expected.visible);assert.deepEqual(c.ui.displayedFrames,live);
            const arts=c.drawLog.filter(o=>o.type==='drawImage'&&o.src);assert.equal(arts.length,live.length);
            live.forEach((frame,i)=>{const p=entry.pictures[entry.units[frame].picIndex];assert.equal(arts[i].src,p.src);assert.deepEqual(arts[i].args,[x*c.ui.scale,y*c.ui.scale,16*c.ui.scale,16*c.ui.scale]);assert.deepEqual([arts[i].naturalWidth,arts[i].naturalHeight],[p.width,p.height]);});
            const scale=c.ui.scale,rect=[x*scale,y*scale,16*scale,16*scale],regionAt=c.drawLog.findIndex(o=>o.type==='rect'&&JSON.stringify(o.args)===JSON.stringify(rect));assert.ok(regionAt>=0,'Actual Canvas clip names the certified subject cell');
            const cellOps=c.drawLog.slice(regionAt),expectedOps=[{type:'rect',args:rect},{type:'clip',args:[]},{type:'clearRect',args:rect},{type:'drawImage',src:null,args:[0,0,16,16,...rect]}];
            for(const frame of live){const pic=entry.pictures[entry.units[frame].picIndex];for(let bit=0;bit<256;bit++)if(pic.nativeWhitePixels[bit>>3]&(1<<(bit&7)))expectedOps.push({type:'clearRect',args:[(x+bit%16)*scale,(y+Math.floor(bit/16))*scale,scale,scale]});expectedOps.push({type:'drawImage',src:pic.src,args:rect});}
            assert.deepEqual(cellOps.map(o=>({type:o.type,...(o.type==='drawImage'?{src:o.src}:{}),args:o.args})),expectedOps,'Actual ordered clip/base/explicit native white clears/HD source draws; no dotted native sprite overlay');hd++;
        }
    }
    verified.push({generation:s.generation,eventId:s.eventId,reason:a.reason,phase:a.phase,commitSeq:d.commitSeq,frameIndex:d.frameIndex,visible:frames(expected.visible),cleared:frames(expected.clears),region,subject,facts:event.facts,source:c.ui.source,baseIndices:[...new Set(a.basePixels)].sort((x,y)=>x-y),baseRgbaSha256:sha(Buffer.from(a.baseRgba)),nativeRgbaSha256:sha(raw),independentExpectedSha256:sha(full),nativeFile:c.nativeFile,hdFile:c.hdFile});
 }
 report.nativePixelOracle={events:events.size,actualLcdCallbacks:verified.length,hdReadbacks:hd,verified};
 report.coverage=Object.fromEntries([1,2].map(reason=>{const selected=verified.filter(v=>v.reason===reason);return [reason,{name:reason===1?'upgrade':'departure',events:new Set(selected.map(v=>v.generation+':'+v.eventId)).size,actualLcdCallbacks:selected.length,finalFrame:reason===1?5:11,finalObserved:selected.some(v=>v.frameIndex===(reason===1?5:11))}];}));
 for(const reason of [1,2]){const selected=verified.filter(v=>v.reason===reason);assert.ok(report.coverage[reason].events>0&&selected.length>=2,'Both genuine upgrade and departure must have multiple actual LCD callbacks, not a partial pass');assert.ok(report.coverage[reason].finalObserved,'Final logical frame observed for reason '+reason);}
 assert.deepEqual(keys.filter(k=>k.spe&&k.spe.active&&k.spe.id===27&&k.spe.kind===4),[],'Unskippable status and AI target movies receive zero native input');
 report.hdAccepted=!classic&&!missing&&hd===verified.length;report.fallbackAccepted=(classic||missing)&&hd===0;
 report.scope={accepted:'Both actual FgtChkAtkEnd upgrade27/0..5 and departure27/6..11 on either side, current GenArray/Person/JLPOS post-mutation facts, actual copied/displayed native timer/palette/ANDOR/clear, full native LCD and outside-pixel preservation. HD art only in the authenticated16x16 subject cell.',notRun:'No synthetic EXP/Level/HP/arms/RNG/seed writes; runtime does not independently execute initialization phase2 or Level255 wrap/cap/zero-HP upgrade boundaries (actual C suite scope). AI12..17 is not accepted status evidence. No arbitrary Mods, mobile, touch, performance or whole-game HD completion.',beforeFactsBoundary:'Native protocol captures synchronous pre-mutation facts; independent browser reads certify actual post-mutation fields. Native C tests certify before-capture order, not a fabricated browser observation before XP addition.'};
}
async function persistEvidence(cdp){
 const raw=await evaluate(cdp,'({captures:window.__statusCaptures||[],samples:window.__statusSamples||[],keys:window.__statusKeys||[],errors:window.__statusObserverErrors||[],inputCalls:window.__statusInputCalls||[],inputDepth:window.__statusInputDepth||0})');
 for(let i=0;i<raw.captures.length;i++){const c=raw.captures[i],stem='status-'+String(i).padStart(3,'0');for(const[type,url]of[['lcd',c.nativeUrl],['hd',c.hdUrl]])if(url){const data=Buffer.from(url.split(',')[1],'base64'),file=stem+'-'+type+'.png';fs.writeFileSync(path.join(artifactDir,file),data);c[type==='lcd'?'nativeFile':'hdFile']={file,bytes:data.length,sha256:sha(data)};}delete c.nativeUrl;delete c.hdUrl;}
 for(const[name,value]of[['native-status-captures',raw.captures],['spe-observations',raw.samples],['engine-inputs',raw.keys],['observer-errors',raw.errors],['public-input-calls',raw.inputCalls]])fs.writeFileSync(path.join(artifactDir,name+'.json'),JSON.stringify(value,null,2)+'\n');
 return raw;
}
async function saveEvidence(cdp){
 const raw=await persistEvidence(cdp);assert.deepEqual(raw.errors,[]);assert.equal(raw.inputDepth,0);assert.ok(raw.inputCalls.every(c=>Number.isInteger(c.depth)&&c.depth>0));
 const movieCalls=raw.inputCalls.filter(c=>c.before?.spe?.active&&c.before.spe.id===27&&c.before.spe.kind===4);
 assert.deepEqual(movieCalls,[],'Neither actual public sendKey API sends input during status/AI movies');
 report.publicInputObserver={installedAfterNativeReady:true,calls:raw.inputCalls.length,byApi:Object.fromEntries(['window.sendKey','baye.sendKey'].map(api=>[api,raw.inputCalls.filter(c=>c.api===api).length])),maxDepth:Math.max(0,...raw.inputCalls.map(c=>c.depth)),finalDepth:raw.inputDepth,statusOrAiCalls:movieCalls.length};
 report.observerErrors=raw.errors;report.engineInputs=raw.keys;verifyCaptures(raw.captures,raw.keys);return raw;
}
const ownedReportExpression=`(()=>{const r=baye.hd.report(),s=baye.hd.spe(),m=baye.hd.movie(),f=baye.hd.fight(),attack=baye.hd.attack(),skill=baye.hd.skillResult();return r.active===1&&r.inputSeq>0&&r.seq>0&&!s.active&&!m.active&&!attack.active&&!skill.active?{report:r,spe:s,movie:m,fight:f,attack,skill}:null;})()`;
async function acknowledgeActualReport(cdp){
 const before=await evaluate(cdp,ownedReportExpression);if(!before)return false;
 const current=await evaluate(cdp,ownedReportExpression);if(!current||JSON.stringify(current.report)!==JSON.stringify(before.report))return false;
 const keysBefore=await evaluate(cdp,'window.__statusKeys.length');
 await key(cdp,'Enter');
 const ack=await waitFor(cdp,'one current native report input ACK',`(()=>{const r=baye.hd.report();return (!r.active||r.seq!==${before.report.seq}||r.inputSeq!==${before.report.inputSeq})&&r;})()`,10000);
 const keys=await evaluate(cdp,'window.__statusKeys.slice('+keysBefore+')');assert.equal(keys.length,1,'Report receives one physical Enter');assert.equal(keys[0].code,39);assert.ok(!keys[0].spe?.active,'No report key during a native movie');
 report.reportAcks.push({before,current,ack,keys,at:new Date().toISOString()});return true;
}
const lordMoveSnapshotExpression=`(()=>{
 const d=baye.data,first=baye.hd.fight(),generation=Number(d.g_hdSpeGeneration),index=first.actorIndex;
 if(!first.active||first.over||first.inputKind!==2||first.wait!==1||index!==0||Number(d.g_FgtParam.GenArray[0])!==6)return null;
 const p=d.g_GenPos[0],sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY),width=Number(d.g_MapWid),height=Number(d.g_MapHgt),mask=Array.from({length:225},(_,i)=>Number(d.g_FightPath[i]));
 const lord={i:0,person:5,id:6,x:Number(p.x),y:Number(p.y),hp:Number(p.hp),move:Number(p.move),active:Number(p.active),state:Number(p.state),arms:Number(d.g_Persons[5].Arms),level:Number(d.g_Persons[5].Level),experience:Number(d.g_Persons[5].Experience),effectiveArm:baye.hd.personArmType(5)};
 const units=[];for(let i=0;i<20;i++){const id=Number(d.g_FgtParam.GenArray[i]);if(id>0&&id<=2000){const u=d.g_GenPos[i];units.push({i,person:id-1,x:Number(u.x),y:Number(u.y),state:Number(u.state),hp:Number(u.hp),arms:Number(d.g_Persons[id-1].Arms),level:Number(d.g_Persons[id-1].Level),experience:Number(d.g_Persons[id-1].Experience)});}}
 const observedUpgrade=(window.__statusCaptures||[]).some(c=>c.spe?.display?.statusEffect?.valid&&c.spe.display.statusEffect.reason===1);
 const candidates=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const px=(x-sx+ux)&255,py=(y-sy+uy)&255;if(px<15&&py<15){const raw=mask[py*15+px];if(Number.isInteger(raw)&&raw>=0&&raw<=128&&!units.some(u=>u.i!==0&&u.state!==8&&u.x===x&&u.y===y))candidates.push({x,y,px,py,raw,remainingPower:raw===0&&x===lord.x&&y===lord.y?lord.move:raw,derivedResistanceCost:raw===0&&x===lord.x&&y===lord.y?0:raw>0&&raw<=lord.move?lord.move-raw:null});}}
 const last=baye.hd.fight();if(generation!==Number(d.g_hdSpeGeneration)||last.inputSeq!==first.inputSeq||last.inputKind!==2||last.actorIndex!==0||Number(d.g_FgtParam.GenArray[0])!==6)return null;
 if(!mask.every(v=>Number.isInteger(v)&&v>=0&&v<=255)||!Number.isInteger(lord.effectiveArm)||lord.effectiveArm<0||lord.effectiveArm>5)throw Error('Invalid actual MOVE/type observation');
 return {first,last,generation,lord,sx,sy,ux,uy,width,height,mask,candidates,units,observedUpgrade};
})()`;
async function protectActualLord(cdp){
 const before=await evaluate(cdp,battleStateExpression),lord=before.units.find(u=>u.i===0);
 assert.ok(before.fight.active&&!before.fight.over&&before.fight.inputKind===1);assert.ok(lord&&lord.person===5&&lord.id===6&&lord.active===0&&lord.state!==8&&lord.hp>0&&lord.arms>0,'The real P1 lord is living and has not acted; no repair after death');
 const selected=await action(cdp,'select-current-native-lord-tile',`(()=>{const f=baye.hd.fight(),d=baye.data,p=d.g_GenPos[0];if(Number(d.g_hdSpeGeneration)!==${before.generation}||f.inputKind!==1||f.inputSeq!==${before.fight.inputSeq}||Number(d.g_FgtParam.GenArray[0])!==6||Number(p.x)!==${lord.x}||Number(p.y)!==${lord.y}||Number(p.active)!==0||Number(p.state)===8)throw Error('Lord selection owner changed');return BayeHdBattle.clickTile(${lord.x},${lord.y});})()`);assert.equal(selected.ok,true);
 const selection=await waitFor(cdp,'native lord MOVE/action ACK',`(()=>{const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&!s.transaction&&f.actorIndex===0&&(f.inputKind===2||f.inputKind===3)&&f;})()`);
 let fresh=null,destination=null,moveResult=null,routePolicy=null;
 if(selection.inputKind===2){
    fresh=await waitFor(cdp,'fresh complete native lord MOVE mask',lordMoveSnapshotExpression);assert.deepEqual([fresh.lord.person,fresh.lord.x,fresh.lord.y],[5,lord.x,lord.y]);assert.equal(fresh.generation,before.generation);assert.equal(fresh.first.bout,before.fight.bout);
    const enemies=fresh.units.filter(u=>u.i>=10&&u.state!==8&&u.hp>0&&u.arms>0);assert.ok(enemies.length,'At least one actual living enemy remains');
    const allies=fresh.units.filter(u=>u.i>0&&u.i<10),eligible=enemies.filter(u=>Number.isInteger(u.experience)&&u.experience>=80).sort((a,b)=>b.experience-a.experience||Math.abs(a.x-lord.x)+Math.abs(a.y-lord.y)-Math.abs(b.x-lord.x)-Math.abs(b.y-lord.y)||a.i-b.i);
    const approach=allies.length===5&&allies.every(u=>u.state===8)&&!fresh.observedUpgrade&&eligible.length>0,target=approach?eligible[0]:null;
    routePolicy={mode:approach?'approach-current-highest-experience-enemy':'protect-lord',observedUpgrade:fresh.observedUpgrade,allies,eligibleEnemies:eligible,target};
    const ranked=fresh.candidates.map(p=>({...p,nearestChebyshev:Math.min(...enemies.map(u=>Math.max(Math.abs(u.x-p.x),Math.abs(u.y-p.y)))),nearestManhattan:Math.min(...enemies.map(u=>Math.abs(u.x-p.x)+Math.abs(u.y-p.y))),targetChebyshev:target?Math.max(Math.abs(target.x-p.x),Math.abs(target.y-p.y)):null,targetManhattan:target?Math.abs(target.x-p.x)+Math.abs(target.y-p.y):null})).sort((a,b)=>approach?a.targetChebyshev-b.targetChebyshev||a.targetManhattan-b.targetManhattan||b.remainingPower-a.remainingPower||a.y-b.y||a.x-b.x:b.nearestChebyshev-a.nearestChebyshev||b.nearestManhattan-a.nearestManhattan||b.remainingPower-a.remainingPower||a.y-b.y||a.x-b.x);
    assert.ok(ranked.length,'Fresh native mask has an unoccupied legal tile');destination=ranked[0];
    const expected=JSON.stringify(fresh);
    moveResult=await action(cdp,'move-lord-only-fresh-native-mask',`(()=>{const current=${lordMoveSnapshotExpression};if(!current||JSON.stringify(current)!==${JSON.stringify(expected)})throw Error('Actual MOVE owner/type/map/mask/units changed before public confirmation');if(!current.candidates.some(p=>p.x===${destination.x}&&p.y===${destination.y}))throw Error('Destination no longer in fresh native mask');return BayeHdBattle.clickTile(${destination.x},${destination.y});})()`);assert.equal(moveResult.ok,true);
    await waitBattle(cdp,3,'lord actual destination/action owner');
 }
 const atDestination=await evaluate(cdp,battleStateExpression),actual=atDestination.units.find(u=>u.i===0);assert.ok(actual&&actual.person===5);assert.deepEqual([actual.x,actual.y],destination?[destination.x,destination.y]:[lord.x,lord.y]);
 for(const field of ['hp','arms','level','experience','state'])assert.equal(actual[field],lord[field],'Moving the lord changes no '+field);assert.equal(atDestination.fight.bout,before.fight.bout);
 assert.deepEqual(atDestination.units.filter(u=>u.i!==0),before.units.filter(u=>u.i!==0),'No other unit is moved or modified by the lord MOVE');
 const menu=await evaluate(cdp,'baye.hd.menuItems()');assert.ok(menu.active&&menu.names.length>=4&&menu.names[3],'Actual native action menu offers rest');
 const rest=await action(cdp,'lord-actual-native-rest-not-attack',`BayeHdBattle.pickMenuName(${JSON.stringify(menu.names[3])})`);assert.equal(rest.ok,true);await waitBattle(cdp,1,'one lord rest returns to real unit selection');
 const after=await evaluate(cdp,battleStateExpression),retired=after.units.find(u=>u.i===0);assert.deepEqual([retired.x,retired.y],[actual.x,actual.y]);assert.equal(retired.active,1);for(const field of ['hp','arms','level','experience','state'])assert.equal(retired[field],lord[field]);assert.deepEqual(after.units.filter(u=>u.i!==0),before.units.filter(u=>u.i!==0));assert.equal(after.fight.bout,before.fight.bout);
 report.lordMoves.push({before,selection,fresh,routePolicy,destination,moveResult,atDestination,menu,rest,after,policy:'Only fresh unoccupied actual MOVE destinations authorize movement. Protect the living lord initially; after all five actual allied departures, with no observed upgrade and an actual living enemy at80+XP, rank legal destinations toward the highest-XP enemy. This changes movement ranking only, not XP, attack range, native state or guaranteed survival. Native mask byte is remaining power; derived cost is recorded only for ordinary positive-power tiles or the unchanged origin.'});
}
async function endEnemyTurn(cdp){
 const turnStartedAt=Date.now();if(protectLord){
    const classicBefore=classic?await evaluate(cdp,battleStateExpression):null,keysBefore=classic?await evaluate(cdp,'window.__statusKeys.length'):null;
    await evaluate(cdp,'BayeHdBattle.setMode("hd")');
    if(classic){
       const ready=await waitFor(cdp,'classic-to-HD current native PICK and populated lord presentation',`(()=>{
          const read=()=>{const d=baye.data,f=baye.hd.fight(),p=d.g_GenPos[0],v=d.g_Persons[5],units=[];for(let i=0;i<20;i++){const id=Number(d.g_FgtParam.GenArray[i]);if(id>0&&id<=2000){const q=d.g_GenPos[i];units.push({i,id,x:Number(q.x),y:Number(q.y),hp:Number(q.hp),arms:Number(d.g_Persons[id-1].Arms),active:Number(q.active),state:Number(q.state)});}}return {fight:f,generation:Number(d.g_hdSpeGeneration),id:Number(d.g_FgtParam.GenArray[0]),lord:{x:Number(p.x),y:Number(p.y),hp:Number(p.hp),active:Number(p.active),state:Number(p.state),arms:Number(v.Arms)},units};},first=read();
          if(!first.fight.active||first.fight.over||first.fight.inputKind!==1||first.fight.wait!==1||first.id!==6||first.lord.active!==0||[1,6,8].includes(first.lord.state)||first.lord.hp<=0||first.lord.arms<=0||document.hidden)return null;
          const s=BayeHdBattle.debugSnapshot(),unit=s.unitList.find(u=>u.i===0),node=document.getElementById('hd-battle'),rect=node&&node.getBoundingClientRect(),style=node&&getComputedStyle(node),top=rect&&document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
          if(BayeHdBattle.getMode()!=='hd'||!s.open||!s.showHd||!s.strictLive||!s.inputReady||s.inputKind!==1||s.inputSeq!==first.fight.inputSeq||s.transaction||!unit||unit.id!==6||unit.side!=='player'||unit.x!==first.lord.x||unit.y!==first.lord.y||unit.hp!==first.lord.hp||unit.arms!==first.lord.arms||unit.active!==0||unit.state!==first.lord.state||!rect||!rect.width||!rect.height||style.visibility!=='visible'||style.display==='none'||Number(style.opacity)===0||!top||!node.contains(top))return null;
          const shownUnits=s.unitList.map(u=>({i:u.i,id:u.id,x:u.x,y:u.y,hp:u.hp,arms:u.arms,active:u.active,state:u.state}));if(JSON.stringify(shownUnits)!==JSON.stringify(first.units))return null;
          const last=read();if(JSON.stringify(last)!==JSON.stringify(first))return null;
          return {first,last,unit,shownUnits,presentation:{pref:s.pref,open:s.open,showHd:s.showHd,strictLive:s.strictLive,inputReady:s.inputReady,inputKind:s.inputKind,inputSeq:s.inputSeq,transaction:s.transaction,unitCount:s.unitList.length},dom:{visible:true,stackOwned:true,x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
       })()`);
       const classicAfter=await evaluate(cdp,battleStateExpression),keysAfter=await evaluate(cdp,'window.__statusKeys.length');assert.deepEqual(classicAfter,classicBefore,'Read-only presentation readiness preserves the real world and input owner');assert.equal(keysAfter,keysBefore,'Waiting for actual HD readiness delivers no native input');
       report.classicProtectionReadiness??=[];report.classicProtectionReadiness.push({before:classicBefore,ready,after:classicAfter,keysBefore,keysAfter});
    }
    await protectActualLord(cdp);
 }
 const before=await evaluate(cdp,battleStateExpression);assert.ok(before.fight.active&&!before.fight.over&&before.fight.inputKind===1);
 await evaluate(cdp,'BayeHdBattle.setMode("hd")');assert.equal((await action(cdp,'explicit-end-turn-system','BayeHdBattle.openSystemMenu()')).ok,true);await waitBattle(cdp,6,'actual end-turn system menu');assert.ok(await evaluate(cdp,'baye.hd.menuItems().names[0]'));
 if(classic)await evaluate(cdp,'BayeHdBattle.setMode("classic")');
 await key(cdp,'Enter');
 const deadline=Date.now()+180000;let after;
 while(Date.now()<deadline){
    const value=await evaluate(cdp,`({f:baye.hd.fight(),s:baye.hd.spe(),r:baye.hd.report(),m:baye.hd.march()})`);
    if(!value.s.active&&!value.r.active&&(value.f.over||!value.f.active||value.f.inputKind===1&&value.f.bout>before.fight.bout)){after=await evaluate(cdp,battleStateExpression);break;}
    if(value.r.active&&!value.s.active)await acknowledgeActualReport(cdp);
    else await delay(100);
 }
 assert.ok(after,'Natural enemy turn returns to a real player owner or ends the actual battle within the explicit180s budget');
 if(after.fight.active&&!after.fight.over)assert.equal(after.fight.bout,before.fight.bout+1);
 report.turns??=[];report.turns.push({before,after,elapsedMs:Date.now()-turnStartedAt,nativeWaitBudgetMs:180000});
 return after;
}

const childExited=child=>!child||child.exitCode!==null||child.signalCode!==null;
async function verifyFont(cdp,stage){
 const value=await evaluate(cdp,`(async()=>{
    const keyCount=()=>window.__statusInputCalls.length,beforeKeys=keyCount();
    const loaded=await document.fonts.load('16px BayeUI','升级退场');await document.fonts.ready;
    const plain=f=>({family:f.family,status:f.status,weight:f.weight,style:f.style});
    const faces=Array.from(document.fonts).map(plain),rules=[];
    for(const sheet of document.styleSheets){try{for(const rule of sheet.cssRules){if(rule.type===CSSRule.FONT_FACE_RULE&&rule.style.getPropertyValue('font-family').replace(/['"]/g,'').trim()==='BayeUI')rules.push({sheet:sheet.href,family:rule.style.getPropertyValue('font-family'),src:rule.style.getPropertyValue('src')});}}catch{}}
    return {beforeKeys,afterKeys:keyCount(),status:document.fonts.status,check:document.fonts.check('16px BayeUI','升级退场'),loaded:loaded.map(plain),faces,rules};
 })()`);
 assert.equal(value.beforeKeys,value.afterKeys,'Real font loading issues no native input');assert.equal(value.status,'loaded');assert.equal(value.check,true);
 assert.ok(value.loaded.some(f=>f.family.replace(/['"]/g,'')==='BayeUI'&&f.status==='loaded'));
 assert.ok(value.faces.some(f=>f.family.replace(/['"]/g,'')==='BayeUI'&&f.status==='loaded'&&f.weight==='400'&&f.style==='normal'));
 assert.ok(value.rules.some(r=>r.src.includes('HarmonyOS_Sans_SC_Regular.ttf')),'Actual production font-face uses the frozen Regular font');
 const request=report.requests.find(r=>r.status===200&&r.source===font&&r.sha256===report.fontSource.sha256&&r.bytes===report.fontSource.bytes);assert.ok(request,'Loaded font was served as frozen byte-exact HTTP200');
 report.fontChecks??=[];report.fontChecks.push({stage,...value,source:report.fontSource,request});report.font={loaded:true,check:true,source:report.fontSource,httpStatus:200};
}
async function verifyRetiredScene(cdp){
 const value=await waitFor(cdp,'actual battle/map scene visible after status owner retires',`(()=>{
    const snapshot=()=>JSON.parse(JSON.stringify({spe:baye.hd.spe(),fight:baye.hd.fight(),march:baye.hd.march(),report:baye.hd.report()})),before=snapshot(),beforeKeys=window.__statusInputCalls.length;
    const ui=BayeHdSpe.debugSnapshot(),player=before.fight.active&&!before.fight.over&&before.fight.inputKind===1,map=!before.fight.active&&before.march.pick===1&&!before.march.battlePick;
    if(before.spe.active||ui.open||before.spe.statusEffect.valid||before.report.active||(!player&&!map))return null;
    const isHd=player?BayeHdBattle.shouldShowHd():BayeHdOverworld.getMode()==='hd-map',id=isHd?(player?'hd-battle-canvas':'hd-overworld-canvas'):'lcd',canvas=document.getElementById(id);if(!canvas)return null;
    const rect=canvas.getBoundingClientRect(),chain=[];let node=canvas;while(node){const style=getComputedStyle(node);chain.push({id:node.id,tag:node.tagName,display:style.display,visibility:style.visibility,opacity:style.opacity});node=node.parentElement;}
    const visible=!!(rect.width&&rect.height&&chain.every(s=>s.display!=='none'&&s.visibility!=='hidden'&&s.visibility!=='collapse'&&Number(s.opacity)>0));
    const points=[[.5,.5],[.25,.35],[.75,.65]].map(([px,py])=>{const x=rect.x+rect.width*px,y=rect.y+rect.height*py,top=document.elementFromPoint(x,y);return {x,y,top:top&&top.id,canvasAtFront:top===canvas};});
    const inViewport=rect.x>=0&&rect.y>=0&&rect.right<=innerWidth+.5&&rect.bottom<=innerHeight+.5;if(!visible||!inViewport||!points.some(p=>p.canvasAtFront))return null;
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let inkPixels=0;for(let i=3;i<data.length;i+=4)if(data[i])inkPixels++;
    return {before,after:snapshot(),beforeKeys,afterKeys:window.__statusInputCalls.length,ui,scene:player?(isHd?'hd-battle':'classic-lcd'):(isHd?'hd-world-map':'classic-lcd-map'),id,visible,inViewport,chain,points,width:canvas.width,height:canvas.height,inkPixels,url:canvas.toDataURL('image/png'),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
 })()`,30000);
 assert.deepEqual(value.before,value.after,'Returned scene readback writes no state');assert.equal(value.beforeKeys,value.afterKeys,'Retirement inspection sends no key');assert.ok(value.inkPixels>0);
 const png=Buffer.from(value.url.split(',')[1],'base64'),file='retired-'+value.scene+'.png';fs.writeFileSync(path.join(artifactDir,file),png);delete value.url;value.file={file,bytes:png.length,sha256:sha(png)};report.retiredScene=value;return value;
}

async function main(){
 assert.ok(!fs.existsSync(path.join(artifactDir,'result.json')),'Use fresh evidence directory');fs.mkdirSync(artifactDir,{recursive:true});let server,chrome,cdp,profile,chromeError;
 const interrupt=()=>{report.interrupted=true;cdp?.close();if(!childExited(chrome))chrome.kill('SIGTERM');server?.closeAllConnections();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try{prepareServedAssets();console.log('Frozen',Object.keys(report.sources).length,'sources; engine',report.nativeSourceCheck.aggregate);if(preflightOnly){report.ok=true;return;}assert.equal(typeof WebSocket,'function');profile=fs.mkdtempSync(path.join(os.tmpdir(),'baye-status-effect-runtime-'));server=await startServer();const origin='http://127.0.0.1:'+server.address().port,debugPort=await unusedPort();assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);const binary=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(fs.existsSync(binary));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--window-size='+viewport.width+','+viewport.height,'--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>chromeError=e);report.isolation={httpPort:server.address().port,debugPort,profile,chromePid:chrome.pid,user8080Touched:false};console.log('Private',JSON.stringify(report.isolation));
 let target;const deadline=Date.now()+15000;while(Date.now()<deadline){if(chromeError)throw chromeError;if(childExited(chrome))throw Error('Private Chrome exited');try{const list=await fetch('http://127.0.0.1:'+debugPort+'/json/list',{signal:AbortSignal.timeout(1000)}).then(r=>r.json());target=list.find(i=>i.type==='page');if(target)break;}catch{}await delay(100);}assert.ok(target);cdp=await connectCdp(target.webSocketDebuggerUrl);
 cdp.on('Runtime.consoleAPICalled',e=>report.console.push({type:e.type,text:e.args.map(a=>a.value??a.description??'').join(' ')}));cdp.on('Runtime.exceptionThrown',e=>report.exceptions.push(e.exceptionDetails));cdp.on('Page.javascriptDialogOpening',e=>{report.dialogs.push(e.message);cdp.send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});});cdp.on('Fetch.requestPaused',e=>{const local=new URL(e.request.url).origin===origin;if(!local)report.blocked.push(e.request.url);cdp.send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:e.requestId}:{requestId:e.requestId,errorReason:'BlockedByClient'}).catch(()=>{});});
 await cdp.send('Runtime.enable');await cdp.send('Page.enable');report.browser=await cdp.send('Browser.getVersion');await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.clear();localStorage.setItem('baye/libpath','libs/dat-mod.lib');localStorage.setItem('baye/overworldMode','classic');localStorage.setItem('baye/systemUiMode','classic');localStorage.setItem('baye/cityMenuMode','classic');"+observerSource});await cdp.send('Page.navigate',{url:origin+'/pc.html'});await smoke(cdp);
 const idle=await evaluate(cdp,battleStateExpression),keysBefore=await evaluate(cdp,'window.__statusKeys.length');await delay(600);assert.deepEqual(await evaluate(cdp,battleStateExpression),idle);assert.equal(await evaluate(cdp,'window.__statusKeys.length'),keysBefore);report.idle={before:idle,keys:keysBefore};
 for(let n=0;n<maxTurns;n++){
    const after=await endEnemyTurn(cdp),observed=await evaluate(cdp,'[1,2].map(reason=>({reason,count:window.__statusCaptures.filter(c=>c.spe.display.frameValid&&c.spe.display.statusEffect.valid&&c.spe.display.statusEffect.reason===reason).length,final:window.__statusCaptures.some(c=>c.spe.display.frameValid&&c.spe.display.statusEffect.valid&&c.spe.display.statusEffect.reason===reason&&c.spe.display.frameIndex===(reason===1?5:11))}))');
    console.log('Actual enemy turn',n+1,JSON.stringify({bout:after.fight.bout,over:after.fight.over,status:observed}));
    if(observed.every(r=>r.count>=2&&r.final))break;
    if(after.fight.over||!after.fight.active)break;
 }
 await persistEvidence(cdp); // Preserve every real callback/PNG even when a required reason is missing.
 await saveEvidence(cdp);
 await checkpoint(cdp,'15-status-retired-actual-scene');const retired=await evaluate(cdp,'({spe:baye.hd.spe(),ui:BayeHdSpe.debugSnapshot(),fight:baye.hd.fight()})');assert.equal(retired.spe.active,0);assert.equal(retired.ui.open,false);assert.equal(retired.spe.statusEffect.valid,false);report.retired=retired;
 await verifyRetiredScene(cdp);await verifyFont(cdp,'after-real-status');await observeActualLib(cdp,'after-real-status');
 assert.deepEqual(report.blocked.filter(url=>!['https://img.bbkgames.com/script/js-sdk.js?ver=20260329','http://hm.baidu.com/hm.js?55cdc246d0c836cecfdf39ce0d5657f3'].includes(url)),[],'Only the two existing explicit external URLs may be blocked');

 assert.deepEqual(report.exceptions,[]);assert.deepEqual(report.dialogs,[]);assert.deepEqual(report.requests.filter(r=>r.status>=400&&!r.expected),[]);report.ok=true;
 }catch(e){report.ok=false;report.error=e.stack||String(e);console.error(report.error);process.exitCode=1;if(cdp){try{await persistEvidence(cdp);}catch(persistError){report.evidencePersistenceError=String(persistError);}try{report.failureState=await evaluate(cdp,snapshotExpression);const raw=await evaluate(cdp,'({captures:window.__statusCaptures,samples:window.__statusSamples,keys:window.__statusKeys,errors:window.__statusObserverErrors,inputCalls:window.__statusInputCalls,inputDepth:window.__statusInputDepth})');fs.writeFileSync(path.join(artifactDir,'failure-observations.json'),JSON.stringify(raw,null,2)+'\n');}catch{}try{const png=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,'failure.png'),Buffer.from(png.data,'base64'));}catch{}}}
 finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);cdp?.close();if(!childExited(chrome)){const stop=new Promise(resolve=>chrome.once('exit',resolve));chrome.kill('SIGTERM');await Promise.race([stop,delay(1500)]);if(!childExited(chrome)){chrome.kill('SIGKILL');await Promise.race([stop,delay(1500)]);}}if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(profile){assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));assert.ok(path.basename(profile).startsWith('baye-status-effect-runtime-'));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
 const sources=Object.entries(report.sources||{}).map(([name,m])=>{const f=path.join(root,m.source),actualSha256=fs.existsSync(f)?sha(fs.readFileSync(f)):null;return {name,...m,actualSha256,match:actualSha256===m.sha256};}),added=productionDirectories.flatMap(d=>walk(path.join(root,d))).map(f=>path.relative(root,f).replaceAll('\\','/')).filter(n=>!servedAssets.has(n)),drift=sources.filter(s=>!s.match);report.sourceVerification={ok:!added.length&&!drift.length,count:sources.length,added,drift,sources};report.isolation={...report.isolation,cleaned:!profile||!fs.existsSync(profile),chromeExited:childExited(chrome),httpClosed:!server||!server.listening,user8080Touched:false};if(!report.sourceVerification.ok||!report.isolation.cleaned||!report.isolation.chromeExited||!report.isolation.httpClosed){report.ok=false;process.exitCode=1;}report.hdAccepted=report.ok===true&&report.hdAccepted===true;report.fallbackAccepted=report.ok===true&&report.fallbackAccepted===true;report.accepted=report.ok===true&&!preflightOnly;report.finishedAt=new Date().toISOString();for(const[name,value]of[['source-verification.json',report.sourceVerification],['browser-console.json',{console:report.console,exceptions:report.exceptions,dialogs:report.dialogs}],['result.json',report]])fs.writeFileSync(path.join(artifactDir,name),JSON.stringify(value,null,2)+'\n');console.log('Finished',JSON.stringify({ok:report.ok,hdAccepted:report.hdAccepted,fallbackAccepted:report.ok===true&&report.fallbackAccepted===true,coverage:report.coverage,checkpoints:report.phases.length,sources:report.sourceVerification.count,artifactDir}));}
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});

async function observeActualLib(cdp,stage){
 const expression='(()=>{const before=Number(baye.data.g_hdSpeGeneration),a=BayeHdLibIdentity.read(),hex=window.dynLib,b=BayeHdLibIdentity.read(),after=Number(baye.data.g_hdSpeGeneration);return {before,after,a,b,hex};})()',first=await evaluate(cdp,expression),last=await evaluate(cdp,expression);
 for(const r of [first,last]){assert.equal(r.before,r.after);assert.ok(Number.isInteger(r.before)&&r.before>0);assert.equal(r.a.status,'ready');assert.equal(r.b.status,'ready');assert.equal(r.a.generation,r.b.generation);assert.equal(r.a.sha256,sha(nativeLib));assert.equal(r.b.sha256,sha(nativeLib));assert.ok(typeof r.hex==='string'&&/^(?:[0-9a-f]{2})+$/i.test(r.hex));const bytes=Buffer.from(r.hex,'hex');assert.equal(bytes.length,nativeLib.length);assert.equal(sha(bytes),sha(nativeLib));}assert.equal(last.before,first.before);assert.equal(last.a.generation,first.a.generation);assert.equal(last.hex,first.hex);delete first.hex;delete last.hex;report.actualLibReads??=[];report.actualLibReads.push({stage,first,last});
}
