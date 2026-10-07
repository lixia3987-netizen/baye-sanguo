#!/usr/bin/env node
/**
 * Real Chromium + LIB/WASM HD campaign acceptance; every engine action uses a player entry.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-campaign-runtime.mjs -- --staged
 *   node scripts/test-hd-campaign-runtime.mjs -- --artifact-dir build/campaign-runtime-smoke
 * --staged serves build/wasm/src/baye.{js,wasm,wasm.map} without replacing js/.
 * Uses a temporary browser profile; it never edits portraits, saves or game assets.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staged = process.argv.includes('--staged');
const scenarioFlag = process.argv.indexOf('--scenario');
const scenario = scenarioFlag >= 0 ? process.argv[scenarioFlag + 1] : 'victory';
assert.ok(['victory', 'retreat', 'empty', 'campaign', 'save', 'restart', 'domestic', 'probe'].includes(scenario), 'Unknown campaign scenario: ' + scenario);
const winningScenarios=new Set(['victory','campaign','save','restart']);
const winningFixture={lord:'董卓',origin:15,target:16,leaders:['吕布','张辽','李儒'],recruitments:7};
const artifactFlag = process.argv.indexOf('--artifact-dir');
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/campaign-runtime-smoke'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.lib': 'application/octet-stream' };
const report = { scenario, staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const acknowledgedProgressReports=new Set();
let progressReportIndex=0;

async function startServer() {
    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'pc.html';
            const base = staged && /^js\/baye\.(js|wasm|wasm\.map)$/.test(rel) ? path.join(root, 'build/wasm/src') : root;
            const filename = path.resolve(base, base === root ? rel : path.basename(rel));
            if (!filename.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
            fs.readFile(filename, (err, data) => {
                if (err) { report.requests.push({ url: url.pathname, status: 404 }); res.writeHead(404).end(); return; }
                if (/baye\.(js|wasm|wasm\.map)$/.test(filename) || /\.lib$/.test(filename)) {
                    report.requests.push({ url: url.pathname, status: 200, source: path.relative(root, filename), bytes: data.length });
                }
                res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(data);
            });
        } catch { res.writeHead(400).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return server;
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

async function waitForGameProgress(cdp,description,expression,timeout=20000,nativeProgress=null) {
    const started=Date.now(),deadline=started+(nativeProgress?.maxTimeout??timeout);
    let lastProgress=started,previousNative=null;
    const progress=nativeProgress?{description,round:nativeProgress.round,bout:nativeProgress.bout,
        startedAt:new Date(started).toISOString(),noProgressTimeoutMs:timeout,
        totalTimeoutMs:nativeProgress.maxTimeout,trace:[]}:null;
    if(progress) {report.progressWaits??=[];report.progressWaits.push(progress);}
    const finish=(status)=> {
        if(progress)Object.assign(progress,{status,elapsedMs:Date.now()-started,
            noProgressMs:Date.now()-lastProgress,finishedAt:new Date().toISOString()});
    };
    while(Date.now()<deadline) {
        const value=await evaluate(cdp,expression);
        if(value&&!progress)return value;
        const owners=await evaluate(cdp,progress?
            `({fight:baye.hd.fight(),spe:baye.hd.spe(),report:baye.hd.report(),dialog:BayeHdDialog.debugSnapshot()})`:
            `({report:baye.hd.report(),dialog:BayeHdDialog.debugSnapshot()})`);
        if(progress) {
            const now=Date.now(),f=owners.fight,s=owners.spe,r=owners.report;
            if(now>=deadline) {
                finish('total-timeout');
                throw new Error('Timed out waiting for '+description+' (total native wait limit reached)');
            }
            const native={bout:f.bout,fightInputSeq:f.inputSeq,focusX:f.focusX,focusY:f.focusY,
                speSeq:s.seq,speActive:s.active,reportSeq:r.seq,reportInputSeq:r.inputSeq,reportActive:r.active};
            const changed=Object.keys(native).filter(key=>!previousNative||native[key]!==previousNative[key]);
            if(changed.length) {
                lastProgress=now;
                progress.trace.push({at:new Date(now).toISOString(),elapsedMs:now-started,changed,native});
                previousNative=native;
            }
            if(value) {finish('complete');return value;}
            if(now-lastProgress>=timeout) {
                finish('no-native-progress');
                throw new Error('Timed out waiting for '+description+' (no native progress for '+timeout+'ms)');
            }
        }
        const native=owners.report,dialog=owners.dialog;
        if(native?.active===1&&native.inputSeq>0&&dialog?.open&&dialog.kind==='report'&&!dialog.pass&&
            dialog.reportOwner&&Number(dialog.reportOwner.inputSeq)===Number(native.inputSeq)&&
            Number(dialog.reportOwner.seq)===Number(native.seq)) {
            const token=native.seq+':'+native.inputSeq;
            if(!acknowledgedProgressReports.has(token)) {
                acknowledgedProgressReports.add(token);
                await checkpoint(cdp,'progress-native-report-'+(++progressReportIndex));
                const current=await evaluate(cdp,'baye.hd.report()');
                if(current.active===1&&current.seq===native.seq&&current.inputSeq===native.inputSeq) {
                    report.progressReports??=[];
                    report.progressReports.push({description,owner:native});
                    await click(cdp,'#hd-dialog [data-hd-dlg-ok]');
                }
            }
        }
        await delay(150);
    }
    finish('total-timeout');
    throw new Error('Timed out waiting for '+description);
}

const snapshotExpression = `(() => {
    const api = window.baye, d = api && api.data;
    const read = (key) => { try { return d && d[key]; } catch { return null; } };
    return {
        ready: !!(api && api.hd && api.hd.ready()), engineReady: read('g_hdEngineReady'),
        fightMenuControl: read('g_hdFightMenuControl'), period: read('g_PIdx'), playerKing: read('g_PlayerKing'),
        menu: api && api.hd && api.hd.menuItems(), qty: api && api.hd && api.hd.qty(),
        kings: api && api.hd && api.hd.kings(),
        record: api && api.hd && api.hd.record && api.hd.record(),
        movie: api && api.hd && api.hd.movie(), spe: api && api.hd && api.hd.spe(),
        realm: api && api.hd && api.hd.realm(), report: api && api.hd && api.hd.report(), year: read('g_YearDate'), month: read('g_MonthDate'),
        fight: api && api.hd && api.hd.fight(), march: api && api.hd && api.hd.march(),
        system: window.BayeHdSystemUi && BayeHdSystemUi.debugSnapshot(),
        city: window.BayeHdCityMenu && BayeHdCityMenu.debugSnapshot(),
        dialog: window.BayeHdDialog && BayeHdDialog.debugSnapshot(),
        overworld: window.BayeHdOverworld && BayeHdOverworld.debugSnapshot(),
        battle: window.BayeHdBattle && BayeHdBattle.debugSnapshot(),
        bodyClass: document.body.className, lastHdCall: window.__bayeLastHdCall
    };
})()`;

function unloadedWorldOwner(state, personCount) {
    if(personCount!==0)return null;
    if(state.menu?.active===1&&state.menu.context===4&&state.menu.kind===1)
        return {loaded:false,reason:'native-world-not-loaded',personCount,owner:'title',seq:state.menu.seq};
    if(state.record?.active===1&&state.record.mode===2)
        return {loaded:false,reason:'native-world-not-loaded',personCount,owner:'load',seq:state.record.seq};
    return null;
}

async function checkpoint(cdp, name, extra = null) {
    const state = await evaluate(cdp, snapshotExpression);
    if(extra)Object.assign(state,extra);
    if (state.fight?.active) state.rawBattle = await evaluate(cdp, battleStateExpression);
    if (/^(army-fixture|domestic|save|load|restart)/.test(name)) {
        const personCount=await evaluate(cdp,'baye.getPersonCount()');
        state.worldStatus=unloadedWorldOwner(state,personCount);
        if(!state.worldStatus) {
            state.world=await evaluate(cdp,worldExpression);
            state.worldStatus={loaded:true,personCount:state.world.personCount};
        }
    }
    report.phases.push({ name, ...state });
    fs.writeFileSync(path.join(artifactDir, name + '.json'), JSON.stringify(state, null, 2) + '\n');
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
    const expression=`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block: 'center' });
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        const x=rect.x+rect.width/2,y=rect.y+rect.height/2,top=document.elementFromPoint(x,y);
        return {x,y,unobstructed:!!(top&&(top===node||node.contains(top))),disabled:!!node.disabled,top:top&&top.id};
    })()`;
    let point=null,previous=null,last=null;
    const deadline=Date.now()+20000;
    while(Date.now()<deadline) {
        const current=await evaluate(cdp,expression);
        last=current;
        if(current?.unobstructed&&!current.disabled&&previous&&
            Math.abs(current.x-previous.x)<0.5&&Math.abs(current.y-previous.y)<0.5) {point=current;break;}
        previous=current?.unobstructed&&!current.disabled?current:null;
        await delay(100);
    }
    report.lastClickTarget={selector,last,stable:!!point};
    assert.ok(point, 'Visible click target: ' + selector);
    assert.ok(point.unobstructed, 'Click target is not covered: '+selector+' (top='+point.top+')');
    const mousePoint={x:point.x,y:point.y};
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mousePoint, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mousePoint, button: 'left', clickCount: 1 });
    await delay(250);
}

async function smoke(cdp) {
    await waitFor(cdp, 'real LIB/WASM initialization', 'window.baye && baye.hd && baye.hd.ready()', 60000);
    await evaluate(cdp, `(() => {
        window.__runtimeEngineInputs=[];const original=window.sendKey;
        window.sendKey=function(code){const f=baye.hd.fight(),m=baye.hd.march();window.__runtimeEngineInputs.push({code,fightKind:f.inputKind,fightSeq:f.inputSeq,marchPhase:m.phase,marchSeq:m.inputSeq,marchSession:m.session});return original.apply(this,arguments);};
    })()`);
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
    // Skip only the real opening movie, using the same Enter as a player.
    for (let i = 0; i < 20; i++) {
        const title = await evaluate(cdp, `window.__runtimeSpeSeen.includes(100)`);
        if (title) break;
        if (await evaluate(cdp, `baye.hd.movie().active || (baye.hd.spe().active && baye.hd.spe().kind === 1)`)) {
            await key(cdp, 'Enter');
        } else await delay(150);
    }
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
        let target = menu.kings.findIndex((person) => person.name === ${JSON.stringify(winningScenarios.has(scenario)?winningFixture.lord:'马腾')});
        if (${JSON.stringify(scenario)}==='empty') {
            const d=baye.data;
            const candidate=menu.kings.findIndex(king=>Array.from({length:baye.hdCityLimit()},(_,i)=>i).some(i=>
                Number(d.g_Cities[i].Belong)===king.id+1&&Number(d.g_Cities[i].Persons)>0&&
                baye.hd.cityLinks(i).some(link=>Number(d.g_Cities[Number(link.index)].Belong)===0)));
            if(candidate>=0)target=candidate;
        }
        return { target, index: menu.index, kings: menu.kings };
    })()`);
    assert.ok(lord.target>=0,'the actual native menu offers the requested starting lord');
    for (let i = lord.index; i < lord.target; i++) {await key(cdp, 'ArrowDown');await waitFor(cdp,'native initial lord DOWN ACK','baye.hd.kings().index==='+Number(i+1));}
    for (let i = lord.index; i > lord.target; i--) {await key(cdp, 'ArrowUp');await waitFor(cdp,'native initial lord UP ACK','baye.hd.kings().index==='+Number(i-1));}
    await waitFor(cdp, 'real lord highlight', `baye.hd.kings().index === ${lord.target}`);
    report.selectedLord = lord.kings[lord.target];
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', `baye.hd.march().pick && baye.hd.realm().ownedCount > 0`);
    await checkpoint(cdp, '05-classic-map');

    await campaignSmoke(cdp);
}

async function action(cdp, label, expression) {
    const before=await evaluate(cdp,'({fight:baye.hd.fight(),march:baye.hd.march(),menu:baye.hd.menuItems()})');
    const result=await evaluate(cdp, expression);
    report.inputs.push({type:'action', label, before, result, at:new Date().toISOString()});
    return result;
}

const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<0xfffe) units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),arms:Number(d.g_Persons[id-1].Arms)});
    }
    return {fight:baye.hd.fight(),units,mode:Number(d.g_FgtParam.Mode),mainGen:Number(d.g_MainGenIdx),weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
})()`;

async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&f;})()`,timeout);
}
async function nativeLcdVisibility(cdp) {
    return evaluate(cdp,`(() => {
        const help=BayeHdDialog.debugSnapshot();
        const dialog=document.querySelector('#hd-dialog');
        if(help.open&&help.kind==='help'&&help.body&&dialog) {const r=dialog.getBoundingClientRect(),s=getComputedStyle(dialog),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&dialog.contains(top))return {visible:true,id:'hd-dialog',kind:help.kind,text:help.body,top:top&&top.id};}
        const nodes=[...document.querySelectorAll('canvas')].filter(n=>n.id!=='hd-battle-canvas' && n.id!=='hd-overworld-canvas');
        return nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:n.id,width:r.width,height:r.height,display:s.display,visibility:s.visibility,top:top&&top.id,visible:!!(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&(top===n||n.contains(top)))};}).find(n=>n.visible)||{visible:false,nodes:nodes.map(n=>n.id)};
    })()`);
}
const moveTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),out=[];
    const sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY);
    for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++) {
        const px=x-sx+ux,py=y-sy+uy;
        if(px>=0&&py>=0&&px<15&&py<15&&Number(d.g_FightPath[py*15+px])<=128)out.push({x,y});
    }
    return out;
})()`;
async function chooseGeneral(cdp,unit) {
    const selected=await action(cdp,'select-'+unit.name,`BayeHdBattle.clickUnitByName(${JSON.stringify(unit.name)})`);
    assert.equal(selected.ok,true);
    return waitFor(cdp,'selected general movement or direct action',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return !s.transaction&&(f.inputKind===2||f.inputKind===3)&&f.actorIndex===${unit.i}&&f;})()`);
}
async function menuChoice(cdp,name,kind) {
    const result=await action(cdp,'choose-'+name,`BayeHdBattle.pickMenuName(${JSON.stringify(name)})`);
    assert.equal(result.ok,true,'actual menu choice '+name);
    if(kind) await waitBattle(cdp,kind,'menu choice '+name);
}
const rangedUnitsExpression=`(() => {
    const d=baye.data,r=d.g_FgtAtkRng,size=Number(r[0]),sx=Number(r[1]),sy=Number(r[2]);
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);if(!id||id>=0xfffe)continue;
        const p=d.g_GenPos[i],x=Number(p.x),y=Number(p.y),dx=(x-sx)&255,dy=(y-sy)&255;
        if(p.state===8||dx>=size||dy>=size||Number(r[3+dx+dy*size])!==1)continue;
        units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x,y,arms:Number(d.g_Persons[id-1].Arms),terrain:baye.getTerrainByGeneralIndex(i),armType:baye.getArmType(id-1)});
    }
    return units;
})()`;

const worldExpression = `(() => {
    const d=baye.data,read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=> {
        const v=o[k];return [k,v&&typeof v==='object'&&Number.isFinite(Number(v.length))?Array.from({length:Number(v.length)},(_,i)=>Number(v[i])):v];
    }));
    const realm=baye.hd.realm();
    const array=(key,size)=> {
        const value=d[key];
        if(!value||Number(value.length)!==size)throw new Error('Actual native array '+key+' must expose '+size+' entries; got '+(value&&value.length));
        return Array.from({length:size},(_,i)=>Number(value[i]));
    };
    if(!d.g_OrderQueue||Number(d.g_OrderQueue.length)!==200)throw new Error('Native g_OrderQueue must expose all 200 records');
    if(Number(d.g_Cities.length)!==Number(d.g_engineConfig.citiesCount)||realm.cities.length!==Number(d.g_Cities.length))throw new Error('World snapshot must include every native CITY_MAX city');
    const cities=realm.cities.map(c=>({...c,...read(d.g_Cities[c.i])}));
    const persons=[],allPersons=[],count=baye.getPersonCount();
    for(let i=0;i<count;i++) {
        const p=d.g_Persons[i];
        const item={i,name:baye.getPersonName(i),...read(p)};
        if(!Array.isArray(item.Equip)||item.Equip.length!==2)throw new Error('Person '+i+' must expose both actual equipment slots');
        allPersons.push(item);
        if(Number(p.Belong)===realm.playerBelong)persons.push(item);
    }
    if(count<=0||count>Number(d.g_PersonsQueue.length)||count>Number(d.g_Persons.length))throw new Error('Native person count must be valid before world snapshot');
    const personQueue=Array.from({length:count},(_,i)=>Number(d.g_PersonsQueue[i]));
    const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>read(d.g_OrderQueue[i]));
    const goods=array('g_GoodsQueue',2000),fighters=array('FIGHTERS',600),fighterIndex=array('FIGHTERS_IDX',30);
    return {realm,cities,persons,allPersons,personCount:count,personQueue,orders,goods,fighters,fighterIndex,
        cityCursor:read(d.g_CityPos),period:Number(d.g_PIdx),settings:{lookEnemy:Number(d.g_LookEnemy),lookMovie:Number(d.g_LookMovie),moveSpeed:Number(d.g_MoveSpeed)},
        year:Number(d.g_YearDate),month:Number(d.g_MonthDate)};
})()`;

function realmChanges(before,after) {
    assert.deepEqual(after.cities.map(c=>c.i),before.cities.map(c=>c.i),'ownership comparison reads the same complete native city set');
    return before.cities.flatMap(city=> {
        const next=after.cities.find(c=>c.i===city.i);
        return Number(city.Belong)===Number(next.Belong)?[]:[{
            i:city.i,name:city.name,beforeBelong:Number(city.Belong),afterBelong:Number(next.Belong),
            beforeOwner:city.owner,afterOwner:next.owner,beforeOwned:city.owned,afterOwned:next.owned
        }];
    });
}

async function prepareArmy(cdp,fixture) {
    const cityIndex=fixture.origin;
    await openCity(cdp,cityIndex,'army-fixture');
    const before=await evaluate(cdp,worldExpression);
    const city=before.cities.find(c=>c.i===cityIndex);
    const rootArmy=()=>click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await rootArmy();
    await waitFor(cdp,'recruitment actual military submenu',`baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2&&baye.hd.menuItems().names[1]==='征兵'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="1"]');
    const recruitments=[];
    let recruiterMenuSeq=null;
    for(let attempt=0;attempt<fixture.recruitments;attempt++) {
        assert.ok(await evaluate(cdp,`Number(baye.data.g_Cities[${cityIndex}].Money)>0`),'real recruitment '+attempt+' still has native money');
        const live=await livePersonMenu(cdp,'recruitment '+attempt,recruiterMenuSeq),chooser=live.city;
        const index=chooser.deepItems.length-1,auxiliary=chooser.deepItems[index].name;
        const recruitmentQueue=await readCityPersons(cdp,cityIndex);
        const oldReserve=await evaluate(cdp,`Number(baye.data.g_Cities[${cityIndex}].MothballArms)`);
        const auxiliaryId=Number(chooser.deepItems[index].pind);
        assert.ok(Number.isInteger(auxiliaryId)&&auxiliaryId>=0,'recruitment exposes the actual zero-based PersonQueue identity');
        await checkpoint(cdp,'army-fixture-recruit-person-'+attempt);
        await click(cdp,personSelector(live.menu,chooser.deepItems[index]));
        recruiterMenuSeq=live.menu.seq;
        await waitFor(cdp,'real recruitment GetArmy',`baye.hd.qty().active&&baye.hd.qty().min===0&&baye.hd.qty().max>0`);
        const qty=await evaluate(cdp,'baye.hd.qty()');
        assert.equal(qty.value,qty.max,'GetArmy presents its legitimate maximum by default');
        await checkpoint(cdp,'army-fixture-recruit-quantity-'+attempt);
        await click(cdp,await evaluate(cdp,`BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'`));
        await waitFor(cdp,'recruitment actual reserve and order',`(() => {const d=baye.data,c=d.g_Cities[${cityIndex}],queue=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));return Number(c.MothballArms)===${oldReserve+qty.value}&&!queue.includes(${auxiliaryId});})()`);
        const remaining=await readCityPersons(cdp,cityIndex);
        assert.deepEqual(remaining.map(p=>p.pind).sort((a,b)=>a-b),recruitmentQueue.filter(p=>p.pind!==auxiliaryId).map(p=>p.pind).sort((a,b)=>a-b),
            'native recruitment removes exactly its assigned allied general, preserving every in-wild resident');
        recruitments.push({auxiliary,auxiliaryId,qty:qty.value,beforeReserve:oldReserve,afterReserve:oldReserve+qty.value});
    }
    assert.equal(recruitments.length,fixture.recruitments,'all requested recruitment commands actually complete');
    assert.equal(new Set(recruitments.map(p=>p.auxiliaryId)).size,recruitments.length,'every native recruitment order uses a distinct available allied general');
    await settleDomestic(cdp);
    const recruited=await evaluate(cdp,worldExpression);
    assert.equal(recruited.cities.find(c=>c.i===cityIndex).MothballArms,Number(city.MothballArms)+recruitments.reduce((n,p)=>n+p.qty,0),'native recruitment allocates exactly the confirmed troops to reserves');
    await checkpoint(cdp,'army-fixture-reserve-recruited');
    await openFunctionMenu(cdp,'army-fixture-end-month');
    const seq=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    await waitForGameProgress(cdp,'actual end-month map input',`baye.hd.march().pick===1&&!baye.hd.march().battlePick&&baye.hd.march().mapInputSeq!==${seq}`,90000);
    await settleToMap(cdp,'army-fixture-end-month');
    const afterMonth=await evaluate(cdp,worldExpression);
    assert.ok(afterMonth.year!==before.year||afterMonth.month!==before.month,'one explicit strategy end advances the real game date');
    assert.ok(recruitments.every(p=>afterMonth.persons.some(v=>v.i===p.auxiliaryId)), 'the real recruit orders preserve their assigned generals');
    const returned=await evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${cityIndex}],queue=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));return [${recruitments.map(p=>p.auxiliaryId).join(',')}].every(i=>queue.includes(i));})()`);
    assert.equal(returned,true,'one explicit month completes the native recruitment orders and returns generals');
    await checkpoint(cdp,'army-fixture-recruiter-returned');
    await openCity(cdp,cityIndex,'army-fixture-distribute');
    await rootArmy();
    await waitFor(cdp,'distribution actual military submenu',`baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2&&baye.hd.menuItems().names[2]==='分配'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="2"]');
    const allocations=[];
    let distributionMenuSeq=null;
    for(const name of fixture.leaders) {
        const current=await livePersonMenu(cdp,'distribution '+name,distributionMenuSeq),live=current.city;
        const at=live.deepItems.findIndex(p=>(p.name||p.label||String(p)).includes(name));
        assert.ok(at>=0,'the intended returned general is available for distribution: '+name);
        const personIndex=Number(live.deepItems[at].pind);
        assert.ok(Number.isInteger(personIndex)&&personIndex>=0,'distribution exposes the real selected general identity');
        const general={i:personIndex,arms:await evaluate(cdp,`Number(baye.data.g_Persons[${personIndex}].Arms)`)};
        await click(cdp,personSelector(current.menu,live.deepItems[at]));
        distributionMenuSeq=current.menu.seq;
        await waitFor(cdp,'actual distribution GetArmy '+name,`baye.hd.qty().active&&baye.hd.qty().min===0&&baye.hd.qty().max>0`);
        const quantity=await evaluate(cdp,'baye.hd.qty()');
        assert.equal(quantity.value,quantity.max,'distribution presents its legitimate maximum');
        await checkpoint(cdp,'army-fixture-distribute-'+general.i);
        await click(cdp,await evaluate(cdp,`BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'`));
        await waitFor(cdp,'real troops distributed '+name,`!baye.hd.qty().active&&Number(baye.data.g_Persons[${general.i}].Arms)===${quantity.value}`);
        assert.ok(quantity.value>general.arms,'distribution gives '+name+' more troops than the initial army');
        allocations.push({name,pind:general.i,before:general.arms,after:quantity.value,nativeMax:quantity.max});
    }
    await settleDomestic(cdp);
    const prepared=await evaluate(cdp,worldExpression);
    assert.equal(allocations.length,fixture.leaders.length,'every chosen leader completes actual native troop allocation');
    for(const allocation of allocations) {
        assert.equal(prepared.persons.find(p=>p.i===allocation.pind)?.Arms,allocation.nativeMax,'prepared leader retains exactly the confirmed native allocation maximum: '+allocation.name);
    }
    report.armyFixture={...fixture,requestedRecruitments:fixture.recruitments,cityIndex,recruitments,before,recruited,afterMonth,allocations,prepared};
    await checkpoint(cdp,'army-fixture-prepared-map');
}

async function campaignSmoke(cdp) {
    await evaluate(cdp, `(() => { BayeHdOverworld.setMode('hd-map'); BayeHdCityMenu.setMode('hd'); BayeHdBattle.setMode('hd'); })()`);
    const before=await evaluate(cdp,worldExpression);
    report.campaignBefore=before;
    await checkpoint(cdp,'06-hd-map');
    if(scenario==='probe') {
        const metadata=await evaluate(cdp,`(() => {
            const d=baye.data,realm=baye.hd.realm();
            return realm.cities.map(city=> {
                const native=d.g_Cities[city.i],belong=Number(native.Belong);
                const generals=Array.from({length:Number(native.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(native.PersonQueue)+i]))
                    .map(pind=>({pind,name:baye.getPersonName(pind),belong:Number(d.g_Persons[pind].Belong),
                        arms:Number(d.g_Persons[pind].Arms),force:Number(d.g_Persons[pind].Force),iq:Number(d.g_Persons[pind].IQ),
                        level:Number(d.g_Persons[pind].Level),age:Number(d.g_Persons[pind].Age),armsType:Number(d.g_Persons[pind].ArmsType)}));
                const links=baye.hd.cityLinks(city.i);
                const troops=generals.filter(p=>p.belong===belong).reduce((sum,p)=>sum+p.arms,0);
                return {...city,belong,money:Number(native.Money),food:Number(native.Food),reserve:Number(native.MothballArms),
                    devotion:Number(native.PeopleDevotion),generals,troops,links};
            });
        })()`);
        assert.equal(metadata.length,before.cities.length,'probe reads every actual native city and its real link table');
        report.probe={realm:before.realm,year:before.year,month:before.month,cities:metadata};
        fs.writeFileSync(path.join(artifactDir,'probe.json'),JSON.stringify(report.probe,null,2)+'\n');
        await checkpoint(cdp,'probe-readonly-map');
        return;
    }
    if(scenario==='empty') {
        const empty=await chooseMarchPair(cdp,true);
        assert.ok(empty,'an owned city has a genuinely unowned neighboring target');
        await dispatchMarch(cdp,empty.origin,empty.target,'empty',{generalNames:empty.generals.map(p=>p.name)});
        await settleToMap(cdp,'empty');
        const after=await evaluate(cdp,worldExpression);
        assert.equal(after.cities.find(c=>c.i===empty.target).Belong,after.realm.playerBelong,'empty target is owned after the actual order');
        report.emptyCapture={plan:empty,before,after,realmChanges:realmChanges(before,after)};
        await checkpoint(cdp,'empty-occupied-map');
        return;
    }
    if(scenario==='domestic')await domesticBeforeMarch(cdp,8);
    if(winningScenarios.has(scenario))await prepareArmy(cdp,winningFixture);
    const rounds=['campaign','retreat'].includes(scenario)?3:1;
    for(let round=1;round<=rounds;round++) {
        const winRequested=!['retreat','domestic'].includes(scenario)&&!(scenario==='campaign'&&round>1);
        const plan=round===1&&winningScenarios.has(scenario)?{origin:winningFixture.origin,target:winningFixture.target}:
            scenario==='domestic'?{origin:8,target:9}:await chooseMarchPair(cdp,false);
        assert.ok(plan,'a further legal attack target is adjacent to an owned staffed city');
        const worldBefore=await evaluate(cdp,worldExpression);
        if(!plan.generals)plan.generals=await evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${plan.origin}],belong=baye.hd.realm().playerBelong;
            return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
                .filter(p=>Number(d.g_Persons[p].Belong)===belong&&Number(d.g_Persons[p].Arms)>0)
                .map(p=>({pind:p,name:baye.getPersonName(p),arms:Number(d.g_Persons[p].Arms),iq:Number(d.g_Persons[p].IQ),force:Number(d.g_Persons[p].Force)}))
                .sort((a,b)=>b.arms-a.arms||b.force-a.force);})()`);
        assert.ok(plan.generals.length,'the actual origin has armed player generals');
        let generalNames=winningFixture.leaders.slice();
        if(winRequested) {
            assert.ok(generalNames.every(name=>plan.generals.some(p=>p.name===name)),'all prepared leaders are genuine armed allied generals in the origin');
        }
        if(!winRequested) {
            // A separate real general for each retreat keeps enough actual
            // participants for the three-order campaign lifecycle. Captures,
            // escapes and succession still belong entirely to native C.
            const participants=plan.generals.filter(p=>p.pind!==worldBefore.realm.playerKing);
            generalNames=[(participants.length?participants:plan.generals).sort((a,b)=>b.iq-a.iq)[0].name];
        }
        const march=await dispatchMarch(cdp,plan.origin,plan.target,'march-'+round,{generalNames,foodBudget:winRequested?undefined:10});
        await waitForGameProgress(cdp,'real player battle',`baye.hd.fight().active && !baye.hd.fight().over && baye.hd.fight().inputKind===1`,60000);
        await checkpoint(cdp,'battle-'+round+'-ready');
        const initial=await evaluate(cdp,battleStateExpression);
        assertDispatchedArmy(initial,march);
        assert.equal(initial.fight.over,0,'the new native battle clears the previous terminal result');
        assert.ok(initial.units.filter(p=>p.side==='player').every(p=>p.arms>0),'every submitted player general has genuine troops');
        if(winRequested)await conquerBattle(cdp,round);
        else await retreatBattle(cdp,round);
        const terminal=await evaluate(cdp,battleStateExpression);
        const expected=winRequested?1:2;
        assert.equal(terminal.fight.over,expected,'native battle terminal result matches requested campaign scenario');
        await checkpoint(cdp,'battle-'+round+'-terminal');
        await settleToMap(cdp,'battle-'+round);
        const after=await evaluate(cdp,worldExpression);
        const ownershipChanges=realmChanges(worldBefore,after);
        if(expected===1) {
            assert.equal(after.cities.find(c=>c.i===plan.target).Belong,after.realm.playerBelong,'actual occupation assigns target to player');
            assert.notEqual(worldBefore.cities.find(c=>c.i===plan.target).Belong,worldBefore.realm.playerBelong,'the occupied target was an actual enemy city before departure');
        } else {
            assert.equal(after.cities.find(c=>c.i===plan.target).Belong,worldBefore.cities.find(c=>c.i===plan.target).Belong,'retreat preserves defender ownership');
        }
        if(scenario==='domestic') {
            assert.equal(worldBefore.year,report.domestic.before.year,'cultivation and march are submitted in the same strategy year');
            assert.equal(worldBefore.month,report.domestic.before.month,'cultivation and march are submitted in the same strategy month');
            assert.ok(!march.selected.some(p=>p.pind===report.domestic.order.Person),'the cultivating general is not reused by the march order');
            assert.ok(after.cities.find(c=>c.i===8).Farming>=report.domestic.after.cities.find(c=>c.i===8).Farming,'the actual agricultural result remains after the march settles');
            const returned=await readCityPersons(cdp,8);
            assert.ok(returned.some(p=>p.pind===report.domestic.order.Person),'the actual cultivation order returns its general separately');
            report.domestic.march=march;
            report.domestic.settled=after;
        }
        report.battles??=[];report.battles.push({round,plan,march,expectedOutcome:winRequested?'victory':'retreat',worldBefore,initial,terminal,after,realmChanges:ownershipChanges});
        await checkpoint(cdp,'battle-'+round+'-settled-map');
    }
    if(scenario==='campaign')assert.deepEqual(report.battles.map(b=>b.terminal.fight.over),[1,2,2],'mixed campaign verifies one occupation and two explicit retreats across three fresh battles');
    if(scenario==='save')await saveRefreshLoad(cdp);
    if(scenario==='restart')await restartSamePage(cdp);
}

async function chooseMarchPair(cdp,emptyOnly) {
    return evaluate(cdp,`(() => {
        const realm=baye.hd.realm(),d=baye.data;
        const candidates=[];
        for(const city of realm.cities.filter(c=>c.owned&&Number(d.g_Cities[c.i].Persons)>0)) {
            const raw=d.g_Cities[city.i];
            if(Number(raw.Food)<=0)continue;
            const generals=Array.from({length:Number(raw.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(raw.PersonQueue)+i]))
                .filter(p=>Number(d.g_Persons[p].Belong)===realm.playerBelong&&Number(d.g_Persons[p].Arms)>0)
                .map(p=>({pind:p,name:baye.getPersonName(p),arms:Number(d.g_Persons[p].Arms),iq:Number(d.g_Persons[p].IQ)}));
            if(!generals.length)continue;
            for(const link of baye.hd.cityLinks(city.i)) {
                const target=realm.cities.find(c=>c.i===Number(link.index));
                if(!target||target.owned||(${emptyOnly}&&Number(d.g_Cities[target.i].Belong)!==0))continue;
                if(!${emptyOnly}&&Number(d.g_Cities[target.i].Belong)===0)continue;
                const defenderIds=Array.from({length:Number(d.g_Cities[target.i].Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(d.g_Cities[target.i].PersonQueue)+i]));
                const defenderTroops=defenderIds.filter(p=>Number(d.g_Persons[p].Belong)===Number(d.g_Cities[target.i].Belong))
                    .reduce((n,p)=>n+Number(d.g_Persons[p].Arms),0);
                const troops=generals.reduce((n,p)=>n+p.arms,0);
                candidates.push({origin:city.i,target:target.i,originName:city.name,targetName:target.name,empty:Number(d.g_Cities[target.i].Belong)===0,defenders:Number(d.g_Cities[target.i].Persons),food:Number(raw.Food),money:Number(raw.Money),generals,troops,defenderTroops});
            }
        }
        return candidates.sort((a,b)=>(b.troops/Math.max(1,b.defenderTroops))-(a.troops/Math.max(1,a.defenderTroops))||b.food-a.food)[0]||null;
    })()`);
}

async function openCity(cdp,cityIndex,label) {
    await waitFor(cdp,'real map before opening '+label,`baye.hd.march().pick===1 && !baye.hd.march().battlePick && !baye.hd.fight().active`,60000);
    assert.ok(await action(cdp,'open-city-'+label,`BayeHdOverworld.walkToCity(${cityIndex})`));
    await waitFor(cdp,'bound native root '+label,`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();return s.open&&s.layer==='root'&&s.cityIndex===${cityIndex}&&!s.entryPending&&m.active&&m.context===1&&m.kind===1;})()`);
    await checkpoint(cdp,label+'-city-root');
}

async function readCityPersons(cdp,cityIndex) {
    return evaluate(cdp,`(() => {const d=baye.data,c=d.g_Cities[${cityIndex}];
        return Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
            .map(pind=>({pind,name:baye.getPersonName(pind),arms:Number(d.g_Persons[pind].Arms),belong:Number(d.g_Persons[pind].Belong)}));})()`);
}

async function livePersonMenu(cdp,description,previousSeq=null) {
    return waitFor(cdp,'current native and DOM person menu '+description,`(() => {
        const menu=baye.hd.menuItems(),city=BayeHdCityMenu.debugSnapshot(),owner=city.deepMenuOwner;
        if(!menu.active||menu.context!==1||menu.kind!==3||${previousSeq===null?'false':`menu.seq===${previousSeq}`}||
            !owner||owner.context!==menu.context||owner.kind!==menu.kind||owner.seq!==menu.seq||
            !city.open||!city.deepItems.length||city.deepItems.length!==menu.names.length)return false;
        const nodes=[...document.querySelectorAll('#hd-city-menu [data-hd-deep]')];
        if(nodes.length!==menu.names.length)return false;
        const d=baye.data,nativeCity=d.g_Cities[city.cityIndex],playerBelong=baye.hd.realm().playerBelong;
        const queue=Array.from({length:Number(nativeCity.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(nativeCity.PersonQueue)+i]));
        const resolved=[];
        for(let i=0;i<menu.names.length;i++) {
            const item=city.deepItems[i],node=nodes.find(n=>Number(n.getAttribute('data-hd-deep'))===i);
            if(!node||item.name!==menu.names[i]||node.getAttribute('data-hd-deep-name')!==item.name||
                Number(node.getAttribute('data-hd-menu-context'))!==menu.context||
                Number(node.getAttribute('data-hd-menu-kind'))!==menu.kind||
                Number(node.getAttribute('data-hd-menu-seq'))!==menu.seq)return false;
            const matches=queue.filter(pind=>baye.getPersonName(pind)===item.name);
            if(matches.length!==1)throw new Error('Native person name must resolve to one actual origin queue ID: '+item.name);
            const pind=matches[0];
            if(Number(d.g_Persons[pind].Belong)!==playerBelong)throw new Error('Native military/domestic menu includes a non-allied origin identity: '+item.name);
            if(item.pind!=null&&Number(item.pind)!==pind)throw new Error('HD person identity disagrees with actual origin queue: '+item.name);
            const domPind=node.hasAttribute('data-hd-deep-pind')?Number(node.getAttribute('data-hd-deep-pind')):null;
            if(domPind!=null&&domPind!==pind)throw new Error('DOM person identity disagrees with actual native menu name: '+item.name);
            resolved.push({...item,i,pind,domPind});
        }
        return {menu,city:{...city,deepItems:resolved},march:baye.hd.march()};
    })()`);
}

function personSelector(menu,person) {
    return '#hd-city-menu [data-hd-deep-name='+JSON.stringify(person.name)+']'+
        '[data-hd-deep="'+person.i+'"]'+
        (person.domPind!=null?'[data-hd-deep-pind="'+person.domPind+'"]':'')+
        '[data-hd-menu-context="'+menu.context+'"]'+
        '[data-hd-menu-kind="'+menu.kind+'"]'+
        '[data-hd-menu-seq="'+menu.seq+'"]';
}

function assertDispatchedArmy(initial,march) {
    const actual=initial.units.filter(p=>p.side==='player').map(p=>({pind:p.id-1,name:p.name,arms:p.arms}));
    const expected=march.selected.map(p=>({pind:p.pind,name:p.name,arms:p.arms}));
    assert.deepEqual(actual,expected,'native GenArray identities and troops exactly match every selected and acknowledged general: '+march.label);
    march.battleReadyArmy=actual;
}

async function dispatchMarch(cdp,origin,target,label,options={}) {
    await openCity(cdp,origin,label);
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,'live military menu '+label,`BayeHdCityMenu.getLayer()==='sub' && baye.hd.menuItems().active && baye.hd.menuItems().names[0]==='侦察'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="4"]');
    await waitFor(cdp,'live selected origin '+label,`(() => {const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.march();return m.phase===1&&m.origin===${origin}&&s.deepItems.length&&baye.hd.menuItems().active;})()`);
    const start=await evaluate(cdp,'baye.hd.march()');
    const march={label,origin,target,start,selected:[]};
    report.marches??=[];report.marches.push(march);
    await checkpoint(cdp,label+'-persons');
    let previousSeq=null;
    for(let i=0;i<(options.generalNames?options.generalNames.length:10);i++) {
        if(previousSeq!==null)await waitFor(cdp,'native next general wait '+label,`(() => {const m=baye.hd.menuItems();return baye.hd.march().phase!==1||m.active&&m.context===1&&m.kind===3&&m.seq!==${previousSeq};})()`);
        if(await evaluate(cdp,'baye.hd.march().phase!==1'))break;
        const before=await livePersonMenu(cdp,label+' selection '+i,previousSeq);
        assert.equal(before.march.origin,origin,'live native selection still belongs to this origin');
        const personIndex=options.generalNames?before.city.deepItems.findIndex(p=>p.name===options.generalNames[i]):0;
        assert.ok(personIndex>=0,'named prepared general is truly present: '+(options.generalNames?.[i]||'first available'));
        const item=before.city.deepItems[personIndex],queue=await readCityPersons(cdp,origin);
        const person=queue.find(p=>p.pind===Number(item.pind));
        assert.ok(person&&person.name===item.name,'the displayed name maps to the exact native origin PersonQueue identity');
        assert.equal(person.belong,await evaluate(cdp,'baye.hd.realm().playerBelong'),'only an actual allied origin general is dispatched');
        assert.ok(person.arms>0,'every selected general has actual troops before departure');
        await checkpoint(cdp,label+'-select-'+i+'-ready');
        await click(cdp,personSelector(before.menu,item));
        await waitFor(cdp,'general selection ACK '+label,`baye.hd.march().selected===${before.march.selected+1}`);
        const remaining=await readCityPersons(cdp,origin);
        assert.deepEqual(remaining.map(p=>p.pind).sort((a,b)=>a-b),queue.filter(p=>p.pind!==person.pind).map(p=>p.pind).sort((a,b)=>a-b),
            'native selection removes exactly the intended general from the city: '+person.name);
        march.selected.push({...person,nativeIndex:personIndex,menuSeq:before.menu.seq});
        previousSeq=before.menu.seq;
        await checkpoint(cdp,label+'-select-'+i+'-ack');
    }
    if(options.generalNames)assert.equal(march.selected.length,options.generalNames.length,'every requested name receives its actual native selection ACK');
    if(await evaluate(cdp,'baye.hd.march().phase===1')) {
        await livePersonMenu(cdp,label+' finish persons',previousSeq);
        await click(cdp,'#hd-city-menu [data-hd-finish-persons]');
    }
    await waitFor(cdp,'native food quantity '+label,`baye.hd.march().phase===2&&baye.hd.qty().active&&baye.hd.qty().min===1`);
    if(Number.isFinite(options.foodBudget)) {
        const quantity=await evaluate(cdp,'baye.hd.qty()');
        const budget=Math.max(quantity.min,Math.min(quantity.max,Math.floor(options.foodBudget)));
        let current=quantity.value;
        while(current!==budget) {
            const step=Math.abs(current-budget)>=10?10:1,delta=current>budget?-step:step;
            assert.equal(await action(cdp,'explicit-food-step-'+label,`BayeHdCityMenu.stepQty(${delta})`),true);
            current+=delta;
            await waitFor(cdp,'actual food step acknowledged '+label,`baye.hd.qty().active&&baye.hd.qty().value===${current}`);
        }
        assert.equal(await evaluate(cdp,'baye.hd.qty().value'),budget,'repeat retreat retains the city food by explicitly selecting a legal small ration');
    }
    await checkpoint(cdp,label+'-food');
    await click(cdp,await evaluate(cdp,`BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'`));
    await waitFor(cdp,'target instruction '+label,'baye.hd.march().phase===3');
    await action(cdp,'continue-target-'+label,'BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'target map '+label,'baye.hd.march().phase===4&&baye.hd.march().battlePick===1');
    const selected=await action(cdp,'select-target-'+label,`BayeHdCityMenu.selectMarchTarget(${target})`);
    assert.equal(selected.selected,target);
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4,'select target alone delivers no confirmation');
    await action(cdp,'confirm-target-'+label,`BayeHdCityMenu.confirmMarchTarget(${target})`);
    await waitFor(cdp,'native departure report '+label,'baye.hd.march().phase===6');
    await checkpoint(cdp,label+'-departure-report');
    await action(cdp,'confirm-departure-'+label,'BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'native AddFightOrder '+label,'baye.hd.march().phase===7&&baye.hd.march().ok===1');
    await waitFor(cdp,'native strategy input '+label,`(() => {const m=baye.hd.march(),x=baye.hd.menuItems();return x.active&&[1,2].includes(x.context)||!x.active&&m.pick===1&&!m.battlePick;})()`);
    const nativeOrder=await evaluate(cdp,`(() => {
        const d=baye.data,orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]);
        return orders.filter(o=>Number(o.OrderId)===27&&Number(o.City)===${origin}&&Number(o.Object)===${target}).map(o=> {
            const slot=Number(o.Person),offset=slot*20;
            const ids=Array.from({length:10},(_,i)=>Number(d.FIGHTERS[offset+i*2])|(Number(d.FIGHTERS[offset+i*2+1])<<8));
            return {slot,active:Number(d.FIGHTERS_IDX[slot]),ids:ids.filter(id=>id>0),food:Number(o.Food)};
        });
    })()`);
    assert.equal(nativeOrder.length,1,'one native pending fight order belongs to this exact origin and target');
    assert.equal(nativeOrder[0].active,1,'the actual pending fighter slot is active');
    assert.deepEqual(nativeOrder[0].ids,march.selected.map(p=>p.pind+1),'native AddFightOrder stores exactly the named acknowledged team');
    march.order=nativeOrder[0];
    if(scenario==='domestic') {
        const pending=await evaluate(cdp,worldExpression);
        assert.ok(pending.orders.some(o=>o.OrderId===1&&o.Person===report.domestic.order.Person&&o.City===origin),'the original cultivation order remains distinct while the march is queued');
        assert.ok(pending.orders.some(o=>o.OrderId===27&&o.Person===march.order.slot&&o.City===origin&&o.Object===target),'the native fight order uses its fighter slot and target separately');
        march.pendingDomesticWorld=pending;
    }
    await checkpoint(cdp,label+'-order-ack');
    await action(cdp,'end-strategy-'+label,'BayeHdCityMenu.goStrategyEnd()');
    await waitFor(cdp,'strategy request '+label,'BayeHdCityMenu.debugSnapshot().handoff||baye.hd.fight().active||baye.hd.fight().skip',20000);
    return march;
}

async function retreatBattle(cdp,round) {
    const before=await evaluate(cdp,battleStateExpression);
    await action(cdp,'retreat-open-system','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'retreat system menu');
    const system=await evaluate(cdp,'baye.hd.menuItems()');
    await menuChoice(cdp,system.names[1],7);
    await checkpoint(cdp,'battle-'+round+'-retreat-confirm');
    const confirmation=await evaluate(cdp,'baye.hd.menuItems()');
    assert.ok(confirmation.active&&confirmation.context===3&&confirmation.kind===7);
    await menuChoice(cdp,confirmation.names[0]);
    await waitFor(cdp,'native retreat completes','!baye.hd.fight().active&&baye.hd.fight().over===2',30000);
    report.retreat={before,confirmation,after:await evaluate(cdp,battleStateExpression)};
}

const cityTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),tiles=[];
    for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++)if(Number(d.g_FightMapData[y*f.mapW+x])===3)tiles.push({x,y});
    return tiles;
})()`;

function attackOffsets(mask) {
    assert.ok(Number.isInteger(mask.size)&&mask.size>0&&mask.size<=15,'actual C attack mask has a supported size');
    assert.equal(mask.cells.length,mask.size*mask.size,'actual C attack mask is complete');
    const signedByte=value=>((value+128)%256+256)%256-128;
    const sx=signedByte(mask.origin.x-mask.anchor.x),sy=signedByte(mask.origin.y-mask.anchor.y),offsets=[];
    for(let y=0;y<mask.size;y++)for(let x=0;x<mask.size;x++)if(mask.cells[y*mask.size+x]===1)offsets.push({x:sx+x,y:sy+y});
    assert.ok(offsets.length,'the actual selected general has a nonempty attack mask');
    return offsets;
}

function attackCovers(offsets,position,target) {
    return offsets.some(p=>p.x===target.x-position.x&&p.y===target.y-position.y);
}

function chooseCampaignTile(candidates,units,actor,mainGen,cities,offsets,defending=false) {
    const enemies=units.filter(u=>u.side==='enemy'&&u.arms>0&&u.state!==8);
    const onCity=p=>cities.some(c=>c.x===p.x&&c.y===p.y);
    const guards=defending?enemies.filter(u=>u.i===10):enemies.filter(onCity),distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    const garrison=units.filter(u=>u.side==='player'&&u.arms>0&&u.state!==8&&onCity(u));
    const holdCity=defending&&onCity(actor)&&!garrison.some(u=>u.i!==actor.i);
    const available=candidates.filter(p=>!units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8)&&
        (!holdCity||p.x===actor.x&&p.y===actor.y));
    const choices=available.map(p=> {
        const targets=enemies.filter(u=>attackCovers(offsets,p,u));
        const guardTargets=targets.filter(u=>defending?u.i===10:onCity(u));
        return {x:p.x,y:p.y,capture:onCity(p)&&(!defending||!garrison.length),holdCity,
            guardTargets:guardTargets.map(u=>u.name),targets:targets.map(u=>u.name),
            // Distance pressure is a conservative positioning tie-breaker,
            // never a replacement for the actual mask's legal target check.
            commanderPressure:actor.i===mainGen?enemies.reduce((sum,u)=>sum+1/(1+distance(p,u)**2),0):0,
            objectiveDistance:Math.min(...(guards.length?guards:cities).map(c=>distance(p,c))),moveDistance:distance(p,actor)};
    });
    choices.sort((a,b)=> {
        const opportunity=Number(b.capture)-Number(a.capture)||
            Number(b.guardTargets.length>0)-Number(a.guardTargets.length>0)||
            Number(b.targets.length>0)-Number(a.targets.length>0);
        if(opportunity)return opportunity;
        if(a.targets.length&&b.targets.length)return a.commanderPressure-b.commanderPressure||
            b.targets.length-a.targets.length||a.objectiveDistance-b.objectiveDistance||a.moveDistance-b.moveDistance;
        return a.objectiveDistance-b.objectiveDistance||a.commanderPressure-b.commanderPressure||a.moveDistance-b.moveDistance;
    });
    return choices[0];
}

async function readAttackMask(cdp,actor) {
    const mask=await evaluate(cdp,`(() => {const d=baye.data,f=baye.hd.fight(),r=d.g_FgtAtkRng,size=Number(r[0]),u=d.g_GenPos[${actor.i}],p=d.g_Persons[${actor.id-1}];
        return {actorIndex:f.actorIndex,inputKind:f.inputKind,inputSeq:f.inputSeq,size,origin:{x:Number(r[1]),y:Number(r[2])},
            anchor:{x:Number(u.x),y:Number(u.y)},unitId:Number(d.g_FgtParam.GenArray[${actor.i}]),armType:baye.getArmType(${actor.id-1}),
            equip:[Number(p.Equip[0]),Number(p.Equip[1])],cells:Array.from({length:size*size},(_,i)=>Number(r[3+i]))};})()`);
    assert.equal(mask.inputKind,5,'attack mask is read only while the real attack AIM is waiting');
    assert.equal(mask.actorIndex,actor.i);assert.equal(mask.unitId,actor.id);
    mask.offsets=attackOffsets(mask);
    return mask;
}

async function cacheAttackMask(cdp,actor,selected,round) {
    const before=await evaluate(cdp,battleStateExpression),original=before.units.find(u=>u.i===actor.i);
    if(selected.inputKind===2) {
        const legal=await evaluate(cdp,moveTilesExpression);
        assert.ok(legal.some(p=>p.x===original.x&&p.y===original.y),'the general current tile is a real legal MOVE choice');
        const response=await action(cdp,'mask-probe-current-tile-'+actor.name,`BayeHdBattle.clickTile(${original.x},${original.y})`);
        assert.equal(response.ok,true);await waitBattle(cdp,3,'mask probe action '+actor.name);
    }
    const names=await evaluate(cdp,'baye.hd.menuItems().names');
    await menuChoice(cdp,names[0],5);
    const mask=await readAttackMask(cdp,actor);
    const probe={round,actor:actor.name,mask,before:original,after:null};
    report.attackMasks??=[];report.attackMasks.push(probe);
    await checkpoint(cdp,'battle-'+round+'-mask-'+actor.id,{attackMask:mask});
    await action(cdp,'mask-probe-cancel-aim-'+actor.name,'BayeHdBattle.cancel()');await waitBattle(cdp,3,'mask probe returns ACTION');
    await action(cdp,'mask-probe-cancel-action-'+actor.name,'BayeHdBattle.cancel()');await waitBattle(cdp,1,'mask probe returns PICK');
    const restored=await evaluate(cdp,battleStateExpression),after=restored.units.find(u=>u.i===actor.i);
    assert.equal(restored.fight.bout,before.fight.bout,'one mask probe does not advance the native battle day');
    assert.equal(restored.fight.over,0);assert.equal(after.active,0);
    assert.deepEqual({x:after.x,y:after.y,arms:after.arms},{x:original.x,y:original.y,arms:original.arms},'native ACTION cancel restores the general without spending troops');
    probe.after=after;
    return mask;
}

async function configureBattleSettings(cdp,round) {
    await action(cdp,'battle-settings-open-system','BayeHdBattle.openSystemMenu()');await waitBattle(cdp,6,'battle settings SYSTEM');
    const choices=[{index:2,field:'g_LookMovie',label:'战斗动画',choice:'不看'},
        {index:3,field:'g_MoveSpeed',label:'移动速度',choice:'快速'},
        {index:4,field:'g_LookEnemy',label:'敌军移动',choice:'不看'}];
    const before=await evaluate(cdp,'({lookMovie:Number(baye.data.g_LookMovie),moveSpeed:Number(baye.data.g_MoveSpeed),lookEnemy:Number(baye.data.g_LookEnemy)})');
    for(const choice of choices) {
        const system=await evaluate(cdp,'baye.hd.menuItems()');assert.equal(system.names[choice.index],choice.label);
        await menuChoice(cdp,system.names[choice.index],8);
        const setting=await evaluate(cdp,'baye.hd.menuItems()');assert.equal(setting.names[0],choice.choice);
        await menuChoice(cdp,setting.names[0]);
        await waitFor(cdp,'native battle setting ACK '+choice.field,`baye.data.${choice.field}===0&&baye.hd.fight().inputKind===6&&!BayeHdBattle.debugSnapshot().transaction`);
    }
    await action(cdp,'battle-settings-cancel-system','BayeHdBattle.cancel()');await waitBattle(cdp,1,'settings return real PICK');
    const after=await evaluate(cdp,'({lookMovie:Number(baye.data.g_LookMovie),moveSpeed:Number(baye.data.g_MoveSpeed),lookEnemy:Number(baye.data.g_LookEnemy)})');
    assert.deepEqual(after,{lookMovie:0,moveSpeed:0,lookEnemy:0});
    report.battleSettings??=[];report.battleSettings.push({round,before,after});
    await checkpoint(cdp,'battle-'+round+'-settings');
}

async function conquerBattle(cdp,round,defending=false) {
    const initial=await evaluate(cdp,battleStateExpression);
    assert.equal(initial.mode,defending?0:1,'the combat driver follows the actual native attack/defense mode');
    if(defending)assert.equal(initial.mainGen,10,'the real attacking commander is native index 10 in defense');
    const cities=await evaluate(cdp,cityTilesExpression);
    assert.ok(cities.length,'real C battle map contains a city terrain tile');
    report.objectives??=[];report.objectives.push({round,cities,defending});
    await configureBattleSettings(cdp,round);
    const masks=new Map();
    const maxSteps=Math.min(initial.fight.boutMax,30)*(initial.units.filter(u=>u.side==='player').length+1)+1;
    for(let step=0;step<maxSteps;step++) {
        const state=await evaluate(cdp,battleStateExpression);
        if(state.fight.over||!state.fight.active)break;
        assert.ok(state.fight.bout<=Math.min(state.fight.boutMax,30),'city capture stays within native battle duration');
        const actor=state.units.filter(u=>u.side==='player'&&u.active===0&&u.arms>0&&![1,6,8].includes(u.state))
            .sort((a,b)=>b.arms-a.arms)[0];
        if(!actor) {await advanceTurn(cdp,round);continue;}
        let selected=await chooseGeneral(cdp,actor);
        if(!masks.has(actor.id)) {
            masks.set(actor.id,await cacheAttackMask(cdp,actor,selected,round));
            selected=await chooseGeneral(cdp,actor);
        }
        if(selected.inputKind===2) {
            const candidates=await evaluate(cdp,moveTilesExpression),target=chooseCampaignTile(candidates,state.units,actor,state.mainGen,cities,masks.get(actor.id).offsets,defending);
            assert.ok(target,'real legal unoccupied movement toward objective exists');
            report.tactics??=[];report.tactics.push({round,step,defending,bout:state.fight.bout,actor:actor.name,unitId:actor.id,
                maskInputSeq:masks.get(actor.id).inputSeq,legalCandidates:candidates.length,from:{x:actor.x,y:actor.y},target});
            const response=await action(cdp,'campaign-legal-move-'+actor.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
            assert.equal(response.ok,true);
            await waitBattle(cdp,3,'campaign action menu '+actor.name);
        }
        const moved=await evaluate(cdp,battleStateExpression),unit=moved.units.find(u=>u.i===actor.i);
        const standingCity=cities.some(p=>unit&&unit.x===p.x&&unit.y===p.y);
        if((defending||!standingCity)&&await attackIfPossible(cdp,actor,round,step,cities,masks,defending))continue;
        const names=await evaluate(cdp,'baye.hd.menuItems().names');
        await menuChoice(cdp,names[3]);
        await waitForGameProgress(cdp,'rest or actual city capture',`baye.hd.fight().over||baye.hd.fight().inputKind===1`,30000);
        if(standingCity)await checkpoint(cdp,'battle-'+round+'-city-action-'+step);
    }
    const terminal=await evaluate(cdp,battleStateExpression);
    if(defending)await waitFor(cdp,'native defense result','!baye.hd.fight().active&&[1,2].includes(baye.hd.fight().over)',30000);
    else {
        assert.notEqual(terminal.fight.over,2,'the real campaign cannot be counted as victory after a native defeat');
        await waitFor(cdp,'native campaign victory','!baye.hd.fight().active&&baye.hd.fight().over===1',30000);
    }
}

async function attackIfPossible(cdp,actor,round,step,cities,masks,defending=false) {
    const names=await evaluate(cdp,'baye.hd.menuItems().names');
    await menuChoice(cdp,names[0],5);
    const actualMask=await readAttackMask(cdp,actor);
    const old=masks.get(actor.id);
    if(JSON.stringify(old.offsets)!==JSON.stringify(actualMask.offsets)) {
        report.attackMaskChanges??=[];report.attackMaskChanges.push({round,step,actor:actor.name,before:old,after:actualMask});
    }
    masks.set(actor.id,actualMask);
    const onCity=u=>cities.some(c=>c.x===u.x&&c.y===u.y);
    const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.arms>0)
        .sort((a,b)=>Number(defending?b.i===10:onCity(b))-Number(defending?a.i===10:onCity(a))||a.arms-b.arms);
    if(!targets.length) {
        await action(cdp,'cancel-no-legal-enemy','BayeHdBattle.cancel()');await waitBattle(cdp,3,'no target returns action');return false;
    }
    const target=targets[0],before=await evaluate(cdp,battleStateExpression);
    assert.ok(attackCovers(actualMask.offsets,actualMask.anchor,target),'the final native AIM mask covers the actual chosen target');
    const response=await action(cdp,'campaign-attack-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(response.ok,true);
    await waitForGameProgress(cdp,'campaign attack resolves','baye.hd.fight().over||baye.hd.fight().inputKind===1',30000);
    const after=await evaluate(cdp,battleStateExpression),enemy=after.units.find(u=>u.i===target.i);
    assert.ok(!enemy||enemy.arms<target.arms,'real campaign attack damages target');
    report.attacks??=[];report.attacks.push({round,step,defending,actor:actor.name,target:target.name,actualMask,before,after});
    await checkpoint(cdp,'battle-'+round+'-attack-'+step);
    return true;
}

async function advanceTurn(cdp,round) {
    const before=await evaluate(cdp,battleStateExpression);
    await action(cdp,'campaign-explicit-end-turn','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'campaign turn system');
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name);
    await waitForGameProgress(cdp,'campaign enemy turn',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.over||!s.transaction&&f.inputKind===1&&f.bout>${before.fight.bout};})()`,60000,
        {maxTimeout:240000,round,bout:before.fight.bout});
    const after=await evaluate(cdp,battleStateExpression);
    assert.ok(after.fight.over||after.fight.bout===before.fight.bout+1,'one player end advances one round');
    report.turns??=[];report.turns.push({round,before,after});
    await checkpoint(cdp,'battle-'+round+'-bout-'+after.fight.bout);
}

const defenseStateExpression=`(() => {
    const d=baye.data,p=d.g_FgtParam,people=(start,end)=>Array.from({length:end-start},(_,i)=>Number(p.GenArray[start+i]))
        .filter(id=>id>0&&id<0xfffe).map(id=>({pind:id-1,name:baye.getPersonName(id-1),arms:Number(d.g_Persons[id-1].Arms),belong:Number(d.g_Persons[id-1].Belong)}));
    return {mode:Number(p.Mode),cityIndex:Number(p.CityIndex),defenders:people(0,10),attackers:people(10,20)};
})()`;

async function liveDefenderMenu(cdp,description,previousSeq=null) {
    return waitFor(cdp,'actual native DEFENDERS and visible ownership '+description,`(() => {
        const menu=baye.hd.menuItems(),dialog=BayeHdDialog.debugSnapshot(),owner=dialog.defenseOwner,d=baye.data;
        if(!menu.active||menu.context!==5||menu.kind!==2||${previousSeq===null?'false':`menu.seq===${previousSeq}`}||
            !dialog.open||dialog.kind!=='defenders'||dialog.defenseRequest||!owner||owner.context!==5||owner.kind!==2||
            owner.seq!==menu.seq||Number(d.g_FgtParam.Mode)!==0||Number(d.g_FgtParam.CityIndex)!==owner.cityIndex||
            JSON.stringify(owner.names)!==JSON.stringify(menu.names))return false;
        const nodes=[...document.querySelectorAll('#hd-dialog [data-hd-defender-index]')];
        if(nodes.length!==menu.names.length||!nodes.length)return false;
        const city=d.g_Cities[owner.cityIndex],belong=baye.hd.realm().playerBelong;
        if(Number(city.Belong)!==belong)throw new Error('Native DEFENDERS must belong to an actual player city');
        const queue=Array.from({length:Number(city.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(city.PersonQueue)+i]));
        const persons=[],token=nodes[0].getAttribute('data-hd-defenders-owner');
        for(let index=0;index<menu.names.length;index++) {
            const name=menu.names[index],node=nodes.find(n=>Number(n.getAttribute('data-hd-defender-index'))===index);
            if(!node||node.disabled||node.getAttribute('data-hd-defender-name')!==name||
                Number(node.getAttribute('data-hd-defender-seq'))!==menu.seq||
                Number(node.getAttribute('data-hd-menu-context'))!==5||Number(node.getAttribute('data-hd-menu-kind'))!==2||
                !token||node.getAttribute('data-hd-defenders-owner')!==token)return false;
            const matches=queue.filter(pid=>baye.getPersonName(pid)===name);
            if(matches.length!==1)throw new Error('Defender name must resolve to exactly one true city PersonQueue ID: '+name);
            const pind=matches[0],p=d.g_Persons[pind];
            if(Number(p.Belong)!==belong)throw new Error('Native defender is not an actual allied city general: '+name);
            persons.push({index,pind,name,arms:Number(p.Arms),belong:Number(p.Belong)});
        }
        const selected=Array.from({length:10},(_,i)=>Number(d.g_FgtParam.GenArray[i])).filter(id=>id>0&&id<0xfffe);
        if(JSON.stringify(selected)!==JSON.stringify(owner.selected))return false;
        return {menu,owner,token,persons,selected,cityIndex:owner.cityIndex};
    })()`);
}

function defenderSelector(owner,person) {
    return '#hd-dialog [data-hd-defender-index="'+person.index+'"]'+
        '[data-hd-defender-name='+JSON.stringify(person.name)+'][data-hd-defender-seq="'+owner.menu.seq+'"]'+
        '[data-hd-menu-context="5"][data-hd-menu-kind="2"][data-hd-defenders-owner='+JSON.stringify(owner.token)+']';
}

function incomingDefenseOrder(world,cityIndex,attackers) {
    const ids=attackers.map(p=>p.pind+1);
    const orders=world.orders.filter(order=>order.OrderId===27&&order.Object===cityIndex&&order.TimeCount===0);
    const exact=orders.filter(order=> {
        const bytes=world.fighters.slice(order.Person*20,order.Person*20+20),stored=[];
        for(let i=0;i<bytes.length;i+=2) {const id=bytes[i]+256*bytes[i+1];if(id>0&&id<0xfffe)stored.push(id);}
        return JSON.stringify(stored)===JSON.stringify(ids);
    });
    assert.equal(exact.length,1,'one real pending BATTLE order matches the native attacking GenArray IDs');
    return {order:exact[0],pendingOrders:orders,attackerIds:ids};
}

async function playNpcDefense(cdp,label) {
    const first=await liveDefenderMenu(cdp,label),before=await evaluate(cdp,worldExpression),pending=await evaluate(cdp,defenseStateExpression);
    assert.equal(pending.mode,0);assert.equal(pending.cityIndex,first.cityIndex);assert.equal(first.selected.length,0,'native NPC defense starts with a cleared defending team');
    const queue=await readCityPersons(cdp,first.cityIndex),belong=before.realm.playerBelong;
    const roster=queue.filter(p=>p.belong===belong&&p.arms>0)
        .sort((a,b)=>Number(b.name==='张辽')-Number(a.name==='张辽')||b.arms-a.arms).slice(0,10);
    assert.ok(roster.every(p=>first.persons.some(item=>item.pind===p.pind)),'every armed allied defender is offered by the real native selection menu');
    const round='defense-'+((report.extraDefenses?.length||0)+1),protectedTarget=report.marches?.[0]?.target;
    const previousFight=await evaluate(cdp,'baye.hd.fight()');
    const entry={label:round,source:label,cityIndex:first.cityIndex,protectedTarget,
        before,pending,previousFight,...incomingDefenseOrder(before,first.cityIndex,pending.attackers),selected:[],menuSeq:first.menu.seq};
    report.extraDefenses??=[];report.extraDefenses.push(entry);
    await checkpoint(cdp,round+'-native-selection',{defense:pending,incomingOrder:entry.order});
    let previousSeq=null;
    for(const desired of roster) {
        const owner=await liveDefenderMenu(cdp,round+' '+desired.name,previousSeq),currentQueue=await readCityPersons(cdp,entry.cityIndex);
        const item=owner.persons.find(p=>p.pind===desired.pind&&p.name===desired.name);
        assert.ok(item,'the exact armed defender is still in the current native menu: '+desired.name);
        assert.equal(item.arms,desired.arms,'the native defender troops remain unchanged before selection');
        assert.deepEqual(owner.selected,entry.selected.map(p=>p.pind+1),'native selected defender IDs equal the acknowledged prefix');
        await checkpoint(cdp,round+'-select-'+entry.selected.length+'-ready',{defender:item});
        await click(cdp,defenderSelector(owner,item));
        const expected=entry.selected.map(p=>p.pind+1).concat(item.pind+1);
        await waitFor(cdp,'real defender GenArray ACK '+item.name,`JSON.stringify(Array.from({length:10},(_,i)=>Number(baye.data.g_FgtParam.GenArray[i])).filter(id=>id>0&&id<0xfffe))===${JSON.stringify(JSON.stringify(expected))}`);
        const remaining=await readCityPersons(cdp,entry.cityIndex);
        assert.deepEqual(remaining.map(p=>p.pind).sort((a,b)=>a-b),currentQueue.filter(p=>p.pind!==item.pind).map(p=>p.pind).sort((a,b)=>a-b),
            'native defensive selection removes exactly the named city general: '+item.name);
        entry.selected.push({...item,menuSeq:owner.menu.seq});previousSeq=owner.menu.seq;
        await checkpoint(cdp,round+'-select-'+(entry.selected.length-1)+'-ack');
    }
    const menu=await evaluate(cdp,'baye.hd.menuItems()');
    if(menu.active&&menu.context===5&&menu.kind===2) {
        const owner=await liveDefenderMenu(cdp,round+' explicit finish',previousSeq);
        entry.finish='explicit-exit';
        await click(cdp,'#hd-dialog [data-hd-defenders-finish][data-hd-defender-seq="'+owner.menu.seq+'"]'+
            '[data-hd-defenders-owner='+JSON.stringify(owner.token)+']');
    } else entry.finish='auto-exhausted';
    if(entry.selected.length) {
        await waitForGameProgress(cdp,'fresh native NPC defense PICK',`(() => {const f=baye.hd.fight();return f.active&&f.over===0&&f.inputKind===1&&baye.data.g_FgtParam.Mode===0&&baye.data.g_MainGenIdx===10;})()`,60000);
        entry.initial=await evaluate(cdp,battleStateExpression);
        assert.equal(entry.initial.fight.cityIndex,entry.cityIndex);
        assert.ok(entry.initial.fight.inputSeq>previousFight.inputSeq,'NPC defense starts a new native input generation after the prior result');
        assertDispatchedArmy(entry.initial,entry);
        const enemies=entry.initial.units.filter(p=>p.side==='enemy').map(p=>({pind:p.id-1,name:p.name,arms:p.arms}));
        assert.deepEqual(enemies,pending.attackers.map(p=>({pind:p.pind,name:p.name,arms:p.arms})),'the true NPC army retains its original order identities and troops');
        assert.equal(entry.initial.units.find(p=>p.i===10)?.id-1,pending.attackers[0].pind,'defense index 10 is the actual incoming commander');
        const cityTiles=await evaluate(cdp,cityTilesExpression),firstGuard=entry.initial.units.find(p=>p.side==='player');
        assert.ok(cityTiles.some(p=>p.x===firstGuard.x&&p.y===firstGuard.y),'the first real selected defender starts on the actual city tile');
        await checkpoint(cdp,round+'-battle-ready');
        await conquerBattle(cdp,round,true);
    } else {
        await waitForGameProgress(cdp,'native empty defending army result','!baye.hd.fight().active&&baye.hd.fight().over===2&&baye.hd.fight().skip===4&&baye.data.g_FgtParam.Mode===0&&baye.data.g_MainGenIdx===10',60000);
        entry.instantEmptyDefense=true;
    }
    entry.terminal=await evaluate(cdp,battleStateExpression);entry.outcome=entry.terminal.fight.over;
    assert.ok([1,2].includes(entry.outcome),'NPC defense records only a real native victory or defeat');
    await checkpoint(cdp,round+'-terminal');
    if(entry.cityIndex===protectedTarget)assert.equal(entry.outcome,1,'the originally captured target must survive its real NPC defense before saving its occupation');
    return entry;
}

async function settleToMap(cdp,label) {
    const seen=new Set(),defenses=[];let deadline=Date.now()+150000;
    while(Date.now()<deadline) {
        const state=await evaluate(cdp,snapshotExpression);
        if(!state.fight?.active&&state.march?.pick===1&&!state.march?.battlePick&&state.overworld?.phase==='map'&&!state.dialog?.open) {
            await delay(400);
            const settled=await evaluate(cdp,snapshotExpression);
            if(!settled.fight?.active&&settled.march?.pick===1&&!settled.dialog?.open) {
                if(defenses.length) {
                    const after=await evaluate(cdp,worldExpression);
                    for(const defense of defenses) {
                        defense.after=after;defense.realmChanges=realmChanges(defense.before,after);
                        const city=after.cities.find(c=>c.i===defense.cityIndex);
                        if(defense.cityIndex===defense.protectedTarget)assert.equal(city.Belong,after.realm.playerBelong,'the actual captured city remains owned after all NPC defense and monthly reports');
                    }
                }
                return settled;
            }
        }
        const nativeMenu=state.menu;
        if(nativeMenu?.active&&nativeMenu.context===5&&nativeMenu.kind===2) {
            defenses.push(await playNpcDefense(cdp,label));
            // Full native combat has its own bounded action/turn waits. The
            // report settlement budget restarts only after that real result.
            deadline=Date.now()+150000;
            continue;
        }
        if(nativeMenu?.active&&nativeMenu.context===5&&nativeMenu.kind===1) {
            const token='successor:'+nativeMenu.seq;
            if(!seen.has(token)) {
                seen.add(token);
                await checkpoint(cdp,label+'-successor-'+seen.size);
                await click(cdp,'#hd-dialog [data-hd-successor-index="0"]');
            }
        }
        const dialogue=state.dialog,nativeReport=state.report;
        if(dialogue?.open&&dialogue.kind==='report'&&!dialogue.pass&&
            nativeReport?.active===1&&nativeReport.inputSeq>0&&dialogue.reportOwner&&
            dialogue.reportOwner.seq===nativeReport.seq&&dialogue.reportOwner.inputSeq===nativeReport.inputSeq) {
            const token=nativeReport.seq+':'+nativeReport.inputSeq;
            if(!seen.has(token)) {
                seen.add(token);
                await checkpoint(cdp,label+'-report-'+seen.size);
                await click(cdp,'#hd-dialog [data-hd-dlg-ok]');
            }
        }
        await delay(200);
    }
    throw new Error('Timed out settling actual campaign reports to map: '+label);
}

async function domesticBeforeMarch(cdp,cityIndex) {
    await openCity(cdp,cityIndex,'domestic');
    const before=await evaluate(cdp,worldExpression);
    await click(cdp,'#hd-city-menu [data-hd-root="0"]');
    await waitFor(cdp,'real domestic submenu',`baye.hd.menuItems().active&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2&&baye.hd.menuItems().names[0]==='开垦'`);
    await click(cdp,'#hd-city-menu [data-hd-sub="0"]');
    const picker=await livePersonMenu(cdp,'cultivation'),person=picker.city.deepItems[0];
    assert.ok(person&&Number.isInteger(Number(person.pind)),'cultivation binds a genuine native general identity');
    await checkpoint(cdp,'domestic-person-picker');
    await click(cdp,personSelector(picker.menu,person));
    const oldFarming=before.cities.find(c=>c.i===cityIndex).Farming;
    await waitFor(cdp,'actual farming rises',`Number(baye.data.g_Cities[${cityIndex}].Farming)>${oldFarming}`);
    await checkpoint(cdp,'domestic-real-farming');
    await settleDomestic(cdp);
    const after=await evaluate(cdp,worldExpression);
    assert.ok(after.cities.find(c=>c.i===cityIndex).Farming>oldFarming,'explicit cultivation changes real C agriculture');
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),0,'domestic work leaves no active march ownership');
    const orders=after.orders.filter(o=>o.OrderId===1&&o.City===cityIndex&&o.Person===person.pind);
    assert.equal(orders.length,1,'the native cultivation command has its own exact assigned general');
    assert.ok(!(await readCityPersons(cdp,cityIndex)).some(p=>p.pind===person.pind),'the cultivating general is genuinely busy outside the city selection queue');
    report.domestic={before,after,person,order:orders[0]};
    await checkpoint(cdp,'domestic-then-map');
}

async function settleDomestic(cdp) {
    const seen=new Set(),deadline=Date.now()+60000;
    while(Date.now()<deadline) {
        const state=await evaluate(cdp,snapshotExpression);
        if(state.march?.pick===1&&!state.march.battlePick&&!state.menu?.active&&!state.dialog?.open)return;
        if(state.report?.active===1&&state.report.inputSeq>0&&state.dialog?.open&&state.dialog.kind==='report'&&state.dialog.reportOwner&&
            state.dialog.reportOwner.seq===state.report.seq&&state.dialog.reportOwner.inputSeq===state.report.inputSeq) {
            const token='report:'+state.report.seq+':'+state.report.inputSeq;
            if(!seen.has(token)) {seen.add(token);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');}
        } else if(state.menu?.active&&state.menu.context===1) {
            const token='menu:'+state.menu.seq;
            if(!seen.has(token)) {seen.add(token);await key(cdp,'Escape');}
        }
        await delay(180);
    }
    throw new Error('Domestic work did not return to native strategy map');
}

async function openFunctionMenu(cdp,label) {
    await waitFor(cdp,'actual strategy map before '+label,'baye.hd.march().pick===1&&!baye.hd.march().battlePick&&!baye.hd.fight().active',60000);
    await action(cdp,'use-hd-system-'+label,`BayeHdSystemUi.setMode('hd')`);
    await key(cdp,'Escape');
    await waitFor(cdp,'native function menu '+label,`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active&&m.context===2&&m.kind===1&&s.open&&s.screen==='insystem'&&s.input&&s.input.screen==='insystem'&&!s.pending;})()`);
    await checkpoint(cdp,label+'-function-menu');
}

async function saveRefreshLoad(cdp) {
    const before=await evaluate(cdp,worldExpression);
    await openFunctionMenu(cdp,'save');
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    await waitFor(cdp,'native three-slot save owner',`(() => {const r=baye.hd.record(),s=BayeHdSystemUi.debugSnapshot();return r.active&&r.mode===1&&r.count===3&&s.open&&s.screen==='saveload'&&s.recordMode===1&&!s.pending;})()`);
    await checkpoint(cdp,'save-empty-three-slots');
    const emptySlots=await evaluate(cdp,'BayeHdSystemUi.debugSnapshot().saves');
    assert.equal(await evaluate(cdp,'document.querySelectorAll("#hd-system-ui [data-hd-sys]").length'),3,'fresh profile exposes the three real save buttons');
    assert.ok(emptySlots.every(s=>s.status==='empty'),'fresh profile contains no saved slots');
    // Slot 2 deliberately exercises a sparse file pair (sango4 + sango5).
    await click(cdp,'#hd-system-ui [data-hd-sys="2"]');
    await waitFor(cdp,'explicit save finishes','!baye.hd.record().active&&baye.hd.march().pick===1',30000);
    report.savedStorage=await evaluate(cdp,`Object.keys(localStorage).filter(k=>/sango[0-7]\\.sav$/.test(k)).sort().map(key=>({key,bytes:(localStorage.getItem(key)||'').length}))`);
    assert.equal(report.savedStorage.length,2,'one real slot creates its two file halves');
    assert.ok(report.savedStorage.every(s=>/sango[45]\.sav/.test(s.key)),'slot 2 maps to native filenames 4 and 5');
    assert.deepEqual(await evaluate(cdp,worldExpression),before,'saving does not mutate campaign state');
    await checkpoint(cdp,'save-real-slot-two');
    await cdp.send('Page.reload',{ignoreCache:true});
    acknowledgedProgressReports.clear();
    await waitFor(cdp,'fresh WASM initializes after refresh','window.baye&&baye.hd&&baye.hd.ready()',60000);
    await evaluate(cdp,`BayeHdSystemUi.setMode('hd')`);
    for(let i=0;i<20;i++) {
        if(await evaluate(cdp,'baye.hd.menuItems().active&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1'))break;
        if(await evaluate(cdp,'baye.hd.movie().active'))await key(cdp,'Enter');
        else await delay(150);
    }
    await waitFor(cdp,'real refreshed title owner',`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active&&m.context===4&&m.kind===1&&s.open&&s.screen==='title'&&s.input&&!s.pending;})()`,60000);
    await checkpoint(cdp,'load-refreshed-title');
    await click(cdp,'#hd-system-ui [data-hd-sys="1"]');
    await waitFor(cdp,'native four-slot load owner',`(() => {const r=baye.hd.record(),s=BayeHdSystemUi.debugSnapshot();return r.active&&r.mode===2&&r.count===4&&s.open&&s.screen==='saveload'&&s.recordMode===2&&!s.pending;})()`);
    const slots=await evaluate(cdp,'BayeHdSystemUi.debugSnapshot().saves');
    assert.equal(slots.length,4,'load shows every native slot including auto slot');
    assert.equal(slots[2].canLoad,true,'the sparse saved slot is independently loadable');
    assert.equal(slots[0].canLoad,false,'an earlier empty slot remains empty');
    await checkpoint(cdp,'load-sparse-four-slots');
    await click(cdp,'#hd-system-ui [data-hd-sys="2"]');
    await waitFor(cdp,'real load returns actual strategy map','baye.hd.march().pick===1&&!baye.hd.march().battlePick&&!baye.hd.record().active',60000);
    await evaluate(cdp,`(() => {BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd');BayeHdBattle.setMode('hd');})()`);
    await settleToMap(cdp,'load');
    const after=await evaluate(cdp,worldExpression);
    assert.deepEqual(after,before,'refresh and native load restore every city, player general, date and captured ownership');
    report.saveLoad={slot:2,before,after,slots};
    await checkpoint(cdp,'load-restored-campaign');
    const plan=await chooseMarchPair(cdp,false);
    assert.ok(plan,'the loaded army can enter a subsequent legal campaign');
    const march=await dispatchMarch(cdp,plan.origin,plan.target,'load-next',{generalNames:plan.generals.map(p=>p.name),foodBudget:10});
    await waitForGameProgress(cdp,'real battle after loading','baye.hd.fight().active&&baye.hd.fight().inputKind===1',60000);
    await checkpoint(cdp,'load-next-battle');
    assertDispatchedArmy(await evaluate(cdp,battleStateExpression),march);
    await retreatBattle(cdp,2);
    await settleToMap(cdp,'load-next-retreat');
    await checkpoint(cdp,'load-next-retreat-map');
}

async function restartSamePage(cdp) {
    const before=await evaluate(cdp,worldExpression),oldSession=await evaluate(cdp,'baye.hd.march().session');
    await openFunctionMenu(cdp,'restart');
    await click(cdp,'#hd-system-ui [data-hd-sys="2"]');
    await waitFor(cdp,'real exit confirmation',`baye.hd.menuItems().active&&baye.hd.menuItems().context===2&&baye.hd.menuItems().kind===2`);
    await checkpoint(cdp,'restart-native-exit-confirm');
    await key(cdp,'Enter');
    await waitFor(cdp,'real same-page title owner',`(() => {const m=baye.hd.menuItems(),s=BayeHdSystemUi.debugSnapshot();return m.active&&m.context===4&&m.kind===1&&s.open&&s.screen==='title'&&!s.pending;})()`,60000);
    await checkpoint(cdp,'restart-real-title');
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    await waitFor(cdp,'real new period owner',`baye.hd.menuItems().active&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===2`);
    await click(cdp,'#hd-system-ui [data-hd-sys="0"]');
    const lordOwner=await waitFor(cdp,'actual second native lord input owner',`(() => {
        const menu=baye.hd.menuItems(),system=BayeHdSystemUi.debugSnapshot(),kings=baye.hd.kings();
        if(!menu.active||menu.context!==4||menu.kind!==3||!kings.count||menu.count!==kings.count||
            !system.open||system.screen!=='king'||system.pending||!system.input||
            system.input.screen!=='king'||system.input.seq!==menu.seq||system.input.context!==4||system.input.kind!==3||
            system.kings.length!==kings.kings.length||!system.kings.every((name,i)=>name===kings.kings[i].name))return false;
        const token='menu:'+menu.seq+':4:3',nodes=[...document.querySelectorAll('#hd-system-ui [data-hd-sys]')];
        if(nodes.length!==kings.count||nodes.some((node,i)=>node.getAttribute('data-hd-sys-owner')!==token||
            Number(node.getAttribute('data-hd-sys'))!==i||!node.textContent.startsWith(kings.kings[i].name)))return false;
        return {menu,system,kings,token};
    })()`);
    await checkpoint(cdp,'restart-native-lord-owner');
    const kings=lordOwner.kings,target=kings.kings.findIndex(k=>k.id===report.selectedLord.id&&k.name===report.selectedLord.name);
    assert.ok(target>=0,'real second game offers the exact originally selected lord');
    const inputStart=await evaluate(cdp,'window.__runtimeEngineInputs.length');
    await click(cdp,'#hd-system-ui [data-hd-sys="'+target+'"][data-hd-sys-owner='+JSON.stringify(lordOwner.token)+']');
    await waitFor(cdp,'actual second new-game map','baye.hd.march().pick===1&&!baye.hd.march().battlePick&&!baye.hd.fight().active',60000);
    const lordInputs=await evaluate(cdp,`window.__runtimeEngineInputs.slice(${inputStart})`);
    assert.equal(lordInputs.filter(input=>input.code===0x27).length,1,'the visible native lord choice sends one acknowledged Enter');
    assert.equal(await evaluate(cdp,'Number(baye.data.g_PlayerKing)'),kings.kings[target].id,'native lord confirmation chooses the exact displayed zero-based person ID');
    await settleToMap(cdp,'restart');
    const after=await evaluate(cdp,worldExpression);
    assert.equal(after.realm.ownedCount,report.campaignBefore.realm.ownedCount,'new game restores original number of cities');
    const originalCampaign=report.battles[0].plan;
    assert.equal(after.cities.find(c=>c.i===originalCampaign.target).Belong,report.campaignBefore.cities.find(c=>c.i===originalCampaign.target).Belong,'new game clears the exact city captured by the original campaign');
    assert.equal(await evaluate(cdp,'baye.hd.fight().over'),0,'new game clears previous battle result');
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),0,'new game leaves no old march phase');
    report.restart={before,after,oldSession,newSession:await evaluate(cdp,'baye.hd.march().session'),lordOwner,lordInputs};
    await checkpoint(cdp,'restart-clean-game-map');
    const march=await dispatchMarch(cdp,originalCampaign.origin,originalCampaign.target,'restart-march',{generalNames:winningFixture.leaders,foodBudget:10});
    await waitForGameProgress(cdp,'new march enters real fresh battle','baye.hd.fight().active&&baye.hd.fight().inputKind===1',60000);
    await checkpoint(cdp,'restart-fresh-battle');
    assertDispatchedArmy(await evaluate(cdp,battleStateExpression),march);
    await retreatBattle(cdp,2);
    await settleToMap(cdp,'restart-next-retreat');
    await checkpoint(cdp,'restart-next-retreat-map');
}
async function main() {
    fs.mkdirSync(artifactDir, { recursive: true });
    if (typeof WebSocket !== 'function') throw new Error('Node 22+ is required for built-in WebSocket');
    if (staged) for (const filename of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.ok(fs.existsSync(path.join(root, 'build/wasm/src', filename)), 'Missing staged WASM file: ' + filename);
    }
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'baye-campaign-runtime-'));
    let server, chrome, cdp, chromeError;
    const interrupt = () => {
        report.interrupted = true;
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) chrome.kill('SIGTERM');
        if (server) server.closeAllConnections();
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
        server = await startServer();
        const origin = 'http://127.0.0.1:' + server.address().port;
        const debugPort = await unusedPort();
        const candidates = ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
        const binary = process.env.CHROME || candidates.find((filename) => fs.existsSync(filename));
        assert.ok(binary, 'Set CHROME to a Chromium/Chrome executable');
        chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
            '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows', '--window-size=1920,1080', '--remote-debugging-port=' + debugPort,
            '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
        chrome.on('error', (error) => { chromeError = error; });
        let target;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (chromeError) throw chromeError;
            if (chrome.exitCode !== null) throw new Error('Chrome exited with ' + chrome.exitCode);
            try {
                const list = await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) }).then((res) => res.json());
                target = list.find((item) => item.type === 'page');
                if (target) break;
            } catch {}
            await delay(100);
        }
        assert.ok(target, 'Chrome DevTools started');
        cdp = await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled', (event) => {
            report.console.push({ type: event.type, text: event.args.map((arg) => arg.value ?? arg.description ?? '').join(' ') });
            if (report.console.length > 100) report.console.shift();
        });
        cdp.on('Runtime.exceptionThrown', (event) => report.exceptions.push(event.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening', (event) => {
            report.dialogs.push(event.message);
            cdp.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
        });
        cdp.on('Fetch.requestPaused', (event) => {
            const local = new URL(event.request.url).origin === origin;
            if (!local) report.blocked.push(event.request.url);
            cdp.send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId: event.requestId } :
                { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
        });
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
            if (!sessionStorage.getItem('campaign-profile-initialized')) {
                localStorage.clear();
                sessionStorage.setItem('campaign-profile-initialized', '1');
            }
            localStorage.setItem('baye/libpath', 'libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode', 'classic');
            localStorage.setItem('baye/systemUiMode', 'classic');
            localStorage.setItem('baye/cityMenuMode', 'classic');
        ` });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        await smoke(cdp);
        report.engineInputs=await evaluate(cdp,'window.__runtimeEngineInputs');
        assert.deepEqual(report.exceptions, [], 'browser has no uncaught exceptions');
        assert.deepEqual(report.dialogs, [], 'game boot has no unexpected alert dialogs');
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = error.stack || String(error);
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression); } catch {}
            try { report.engineInputs=await evaluate(cdp,'window.__runtimeEngineInputs'); } catch {}
            try { report.battleKeys=await evaluate(cdp,'window.__battleKeys'); } catch {}
            try { report.failureWorld=await evaluate(cdp,worldExpression); } catch (worldError) { report.failureWorldError=worldError.message||String(worldError); }
            try {
                const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                fs.writeFileSync(path.join(artifactDir, 'failure.png'), Buffer.from(screenshot.data, 'base64'));
            } catch {}
        }
        console.error(report.error);
        process.exitCode = 1;
    } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) {
            const stopped = new Promise((resolve) => chrome.once('exit', resolve));
            chrome.kill('SIGTERM');
            await Promise.race([stopped, delay(1500)]);
            if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([stopped, delay(1500)]); }
        }
        if (server) await new Promise((resolve) => server.close(resolve));
        // Chromium children may briefly finish profile writes after the parent exits.
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Real LIB/WASM campaign browser acceptance passed: ' + scenario);
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
