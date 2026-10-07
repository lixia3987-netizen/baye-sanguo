#!/usr/bin/env node
/**
 * Real Chromium + LIB/WASM HD march and manual battle acceptance.
 *   CHROME=/usr/bin/chromium npm run test:battle-runtime -- --staged
 *   npm run test:battle-runtime -- --artifact-dir build/battle-runtime-smoke
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
const artifactFlag = process.argv.indexOf('--artifact-dir');
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/battle-runtime-smoke'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.lib': 'application/octet-stream' };
const report = { staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };

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

const snapshotExpression = `(() => {
    const api = window.baye, d = api && api.data;
    const read = (key) => { try { return d && d[key]; } catch { return null; } };
    return {
        ready: !!(api && api.hd && api.hd.ready()), engineReady: read('g_hdEngineReady'),
        fightMenuControl: read('g_hdFightMenuControl'), period: read('g_PIdx'), playerKing: read('g_PlayerKing'),
        menu: api && api.hd && api.hd.menuItems(), qty: api && api.hd && api.hd.qty(),
        movie: api && api.hd && api.hd.movie(), spe: api && api.hd && api.hd.spe(),
        fight: api && api.hd && api.hd.fight(), march: api && api.hd && api.hd.march(),
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
        const target = menu.kings.findIndex((person) => person.name === '马腾');
        return { target: target < 0 ? 0 : target, index: menu.index, kings: menu.kings };
    })()`);
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
    for(let i=0;i<6;i++) {
        const before=await evaluate(cdp,'({march:baye.hd.march(),menu:baye.hd.menuItems(),city:BayeHdCityMenu.debugSnapshot()})');
        if(before.march.phase!==1 || !before.menu.active || !before.city.deepItems.length) break;
        await click(cdp,'#hd-city-menu [data-hd-deep="0"]');
        await waitFor(cdp,'selected general acknowledged',`baye.hd.march().selected > ${before.march.selected} || baye.hd.march().phase !== 1`);
    }
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
    await battleSmoke(cdp);
}

const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<0xfffe) units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),arms:Number(d.g_Persons[id-1].Arms)});
    }
    return {fight:baye.hd.fight(),units,weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
})()`;

async function battleSmoke(cdp) {
    await evaluate(cdp, `(() => {
        window.__battleKeys=[];
        const original=window.sendKey;
        window.sendKey=function(code){window.__battleKeys.push({code,kind:baye.hd.fight().inputKind,seq:baye.hd.fight().inputSeq});return original.apply(this,arguments);};
    })()`);
    const before=await evaluate(cdp,battleStateExpression);
    await delay(1500);
    const after=await evaluate(cdp,battleStateExpression);
    assert.deepEqual(after,before,'idle rendering cannot move, attack, spend MP or end turn');
    assert.deepEqual(await evaluate(cdp,'window.__battleKeys'),[],'idle HD renderer delivers no engine inputs');
    report.pause={before,after};
    await checkpoint(cdp,'15-battle-idle-no-input');
    const own=before.units.find(u=>u.side==='player' && u.active===0);
    assert.ok(own,'an actual player general remains available');
    await action(cdp,'select-own-for-cancel',`BayeHdBattle.clickUnitByName(${JSON.stringify(own.name)})`);
    await waitBattle(cdp,2,'move selection');
    await action(cdp,'cancel-uncommitted-move','BayeHdBattle.cancel()');
    await waitBattle(cdp,1,'move canceled');
    assert.deepEqual((await evaluate(cdp,battleStateExpression)).units,before.units,'canceling movement preserves every general');
    await checkpoint(cdp,'16-move-cancel');

    // Help and strategic view are genuine engine inputs; use the real player
    // keyboard and assert native LCD is visible above the opaque HD board.
    await key(cdp,'h');
    await waitBattle(cdp,9,'native general information');
    report.helpVisibility=await nativeLcdVisibility(cdp);
    assert.ok(report.helpVisibility.visible,'general information is visibly rendered above the board');
    await checkpoint(cdp,'17-battle-help');
    await action(cdp,'return-general-info','BayeHdBattle.returnFromHelp()');
    await waitBattle(cdp,1,'return from general info');
    await key(cdp,'f');
    await waitBattle(cdp,10,'native strategic view');
    const viewSeq=await evaluate(cdp,'baye.hd.fight().inputSeq');
    await key(cdp,'ArrowRight');
    await waitFor(cdp,'strategic view paging ACK',`baye.hd.fight().inputKind===10 && baye.hd.fight().inputSeq > ${viewSeq}`);
    report.viewVisibility=await nativeLcdVisibility(cdp);
    assert.ok(report.viewVisibility.visible,'strategic view LCD is visible');
    await checkpoint(cdp,'18-battle-view');
    await action(cdp,'return-strategic-view','BayeHdBattle.returnFromHelp()');
    await waitBattle(cdp,1,'return from strategic view');

    await action(cdp,'open-real-system-menu','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'native five-item system menu');
    const systemMenu=await evaluate(cdp,'baye.hd.menuItems()');
    assert.equal(systemMenu.names.length,5);
    assert.equal(systemMenu.context,3);
    assert.equal(systemMenu.kind,6);
    report.realSystemNames=systemMenu.names;
    await checkpoint(cdp,'19-battle-system-menu');
    const modeBefore=await evaluate(cdp,battleStateExpression);
    const modeKeyCount=await evaluate(cdp,'window.__battleKeys.length');
    await evaluate(cdp,"BayeHdBattle.setMode('classic')");
    await delay(600);
    assert.deepEqual(await evaluate(cdp,battleStateExpression),modeBefore,'classic mode preserves native menu and units');
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),modeKeyCount,'switching classic sends no battle key');
    await checkpoint(cdp,'20-battle-classic-system');
    await evaluate(cdp,"BayeHdBattle.setMode('hd')");
    await waitFor(cdp,'restored HD native menu','BayeHdBattle.debugSnapshot().menuLive && BayeHdBattle.debugSnapshot().menuClickable');
    await checkpoint(cdp,'21-battle-hd-system-restored');
    // Retreat must reach its native confirmation, then cancel without losing.
    await action(cdp,'request-retreat-confirmation',`BayeHdBattle.pickMenuName(${JSON.stringify(systemMenu.names[1])})`);
    await waitBattle(cdp,7,'native retreat confirmation');
    await checkpoint(cdp,'22-retreat-confirm');
    await action(cdp,'cancel-retreat','BayeHdBattle.cancel()');
    await waitBattle(cdp,6,'retreat canceled');
    assert.equal(await evaluate(cdp,'baye.data.g_FgtOver'),0,'canceling retreat preserves battle');
    for(const index of [2,3,4]) {
        await action(cdp,'open-system-setting-'+index,`BayeHdBattle.pickMenuName(${JSON.stringify(systemMenu.names[index])})`);
        await waitBattle(cdp,8,'native system setting '+index);
        await checkpoint(cdp,'23-setting-'+index);
        await action(cdp,'cancel-system-setting-'+index,'BayeHdBattle.cancel()');
        await waitBattle(cdp,6,'setting canceled');
    }
    await action(cdp,'cancel-system-menu','BayeHdBattle.cancel()');
    await waitBattle(cdp,1,'system canceled');
    assert.deepEqual((await evaluate(cdp,battleStateExpression)).units,before.units,'view/help/settings/canceled retreat preserve units');
    await checkpoint(cdp,'24-battle-system-cancel');
    await manualCombat(cdp);

}

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
async function focusBattleTarget(cdp, target, label) {
    for (let step = 0; step < 128; step++) {
        const focus = await evaluate(cdp, '({x:Number(baye.data.g_FoucsX),y:Number(baye.data.g_FoucsY)})');
        if (focus.x === target.x && focus.y === target.y) {
            const keys = await evaluate(cdp, 'window.__battleKeys.length');
            await delay(250);
            assert.equal(await evaluate(cdp, 'window.__battleKeys.length'), keys, 'target preview cannot confirm or send keys');
            await checkpoint(cdp, label);
            return;
        }
        const direction = focus.x !== target.x ? (focus.x < target.x ? 'ArrowRight' : 'ArrowLeft') :
            (focus.y < target.y ? 'ArrowDown' : 'ArrowUp');
        await key(cdp, direction);
        await waitFor(cdp, 'target cursor native acknowledgement', `(() => {
            const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();
            return f.inputKind===5&&!s.transaction&&
                (Number(baye.data.g_FoucsX)!==${focus.x}||Number(baye.data.g_FoucsY)!==${focus.y});
        })()`);
    }
    throw new Error('Target preview cursor did not reach the native target');
}
async function manualCombat(cdp) {
    const before=await evaluate(cdp,battleStateExpression);
    const actor=before.units.find(u=>u.side==='player'&&u.active===0);
    await chooseGeneral(cdp,actor);
    const candidates=await evaluate(cdp,moveTilesExpression);
    const enemies=before.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);
    const occupied=(p)=>before.units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8);
    const distance=(p)=>Math.min(...enemies.map(u=>Math.abs(u.x-p.x)+Math.abs(u.y-p.y)));
    const target=candidates.filter(p=>!occupied(p)&&(p.x!==actor.x||p.y!==actor.y)).sort((a,b)=>distance(a)-distance(b))[0];
    assert.ok(target,'a real non-occupied legal movement tile exists');
    await action(cdp,'move-exact-legal-tile',`BayeHdBattle.clickTile(${target.x},${target.y})`);
    await waitBattle(cdp,3,'actual movement reaches action menu');
    const moved=(await evaluate(cdp,battleStateExpression)).units.find(u=>u.i===actor.i);
    assert.equal(moved.x,target.x);assert.equal(moved.y,target.y);
    await checkpoint(cdp,'25-manual-move');
    await action(cdp,'cancel-action-restore-movement','BayeHdBattle.cancel()');
    await waitBattle(cdp,1,'canceled action rolls movement back');
    const restored=(await evaluate(cdp,battleStateExpression)).units.find(u=>u.i===actor.i);
    assert.equal(restored.x,actor.x);assert.equal(restored.y,actor.y);assert.equal(restored.active,0);
    await checkpoint(cdp,'26-action-cancel');

    await chooseGeneral(cdp,actor);
    await action(cdp,'stay-original-tile',`BayeHdBattle.clickTile(${actor.x},${actor.y})`);
    await waitBattle(cdp,3,'stay reaches action menu');
    const actionNames=await evaluate(cdp,'baye.hd.menuItems().names');
    report.realActionNames=actionNames;
    await menuChoice(cdp,actionNames[3],1);
    const rested=await evaluate(cdp,battleStateExpression);
    assert.equal(rested.units.find(u=>u.i===actor.i).active,1,'rest marks only the chosen general ended');
    for(const u of before.units.filter(u=>u.side==='player'&&u.i!==actor.i))assert.equal(rested.units.find(v=>v.i===u.i).active,u.active,'rest preserves other general availability');
    assert.equal(rested.fight.bout,before.fight.bout,'rest does not end army turn');
    await checkpoint(cdp,'27-rest-single-general');
    await performCombatCosts(cdp);
    report.battleKeys=await evaluate(cdp,'window.__battleKeys');
}
const rangedUnitsExpression=`(() => {
    const d=baye.data,r=d.g_FgtAtkRng,size=Number(r[0]),sx=Number(r[1]),sy=Number(r[2]);
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);if(!id||id>=0xfffe)continue;
        const p=d.g_GenPos[i],x=Number(p.x),y=Number(p.y),dx=x-sx,dy=y-sy;
        if(p.state===8||dx<0||dy<0||dx>=size||dy>=size||Number(r[3+dx+dy*size])!==1)continue;
        units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x,y,arms:Number(d.g_Persons[id-1].Arms),terrain:baye.getTerrainByGeneralIndex(i),armType:baye.getArmType(id-1)});
    }
    return units;
})()`;
const skillOptionsExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),skill=baye.hd.skills(),actor=d.g_GenPos[f.actorIndex];
    const terrain=baye.getTerrainByGeneralIndex(f.actorIndex),weather=Number(d.g_FgtWeather)-1;
    const array=(a,n)=>Array.from({length:n},(_,i)=>Number(a[i]));
    return skill.ids.map((id,index)=>{const x=d.g_Skills[id-1];return {id,index,name:skill.names[index],aim:Number(x.aim),state:Number(x.state),power:Number(x.power),destroy:Number(x.destroy),useMp:Number(x.useMp),eland:array(x.eland,8),earm:array(x.earm,6),available:Number(x.useMp)>0&&Number(x.useMp)<=Number(actor.mp)&&Number(x.weather[weather])>0&&Number(x.oland[terrain])>0};});
})()`;
async function endArmyTurn(cdp) {
    const before=await evaluate(cdp,battleStateExpression);
    await action(cdp,'explicit-end-turn-system','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'end-turn actual system menu');
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name);
    await waitFor(cdp,'enemy turn followed by next player input',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.over||(!s.transaction&&f.inputKind===1&&f.bout>${before.fight.bout});})()`,60000);
    const after=await evaluate(cdp,battleStateExpression);
    assert.equal(after.fight.over,0,'end-turn validation preserves live battle');
    assert.equal(after.fight.bout,before.fight.bout+1,'one end-turn advances exactly one engine bout');
    await delay(1200);
    const paused=await evaluate(cdp,battleStateExpression);
    assert.deepEqual(paused,after,'returning to player input does not trigger a second enemy turn');
    report.turns??=[];report.turns.push({before,after,paused});
    await checkpoint(cdp,'28-explicit-end-turn-'+report.turns.length);
}
async function attemptAttack(cdp,actor) {
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name,5);
    const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.side==='enemy'&&u.arms>0);
    if(!targets.length) {await action(cdp,'cancel-attack-no-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'return from unavailable attack');return false;}
    const target=targets.sort((a,b)=>a.arms-b.arms)[0],before=await evaluate(cdp,battleStateExpression);
    await focusBattleTarget(cdp,target,'29-attack-target-preview');
    const result=await action(cdp,'confirm-attack-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(result.ok,true);
    await waitFor(cdp,'actual attack resolves',`(() => {const f=baye.hd.fight();return f.over||f.inputKind===1;})()`,30000);
    const after=await evaluate(cdp,battleStateExpression),enemy=after.units.find(u=>u.i===target.i);
    assert.ok(!enemy||enemy.arms<target.arms,'confirmed normal attack reduces actual enemy troops');
    report.attackCost={actor:actor.name,target:target.name,before,after};
    await checkpoint(cdp,'29-attack-real-troop-cost');
    return true;
}
async function attemptSkill(cdp,actor) {
    const name=await evaluate(cdp,'baye.hd.menuItems().names[1]');
    await menuChoice(cdp,name,4);
    const options=(await evaluate(cdp,skillOptionsExpression)).filter(s=>s.available).sort((a,b)=>(b.power+b.destroy+Number(b.state>0)*100)-(a.power+a.destroy+Number(a.state>0)*100));
    report.skillOptions??=[];report.skillOptions.push({actor:actor.name,options});
    for(const skill of options) {
        const before=await evaluate(cdp,battleStateExpression),mp=before.units.find(u=>u.i===actor.i).mp;
        await menuChoice(cdp,skill.name);
        await waitFor(cdp,'actual skill aim or action',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return !s.transaction&&(f.inputKind===5||f.inputKind===1||f.over);})()`,20000);
        const fight=await evaluate(cdp,'baye.hd.fight()');
        if(fight.inputKind===5) {
            const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>
                (Boolean(skill.aim&1)===(u.side==='player'))&&skill.eland[u.terrain]>0&&skill.earm[u.armType]>0);
            if(!targets.length) {
                await action(cdp,'cancel-skill-no-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'return from no skill target');
                await menuChoice(cdp,name,4);continue;
            }
            const target=targets[0];
            await focusBattleTarget(cdp,target,'30-skill-target-preview-'+(report.skillAttempts?.length||0));
            const result=await action(cdp,'confirm-skill-'+skill.name+'-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(result.ok,true);
            await waitFor(cdp,'actual skill resolves',`baye.hd.fight().over||baye.hd.fight().inputKind===1`,30000);
        }
        const after=await evaluate(cdp,battleStateExpression),caster=after.units.find(u=>u.i===actor.i);
        assert.ok(caster&&caster.mp<mp,'confirmed skill consumes actual actor MP');
        assert.equal(mp-caster.mp,skill.useMp,'MP decreases by real LIB skill useMp');
        const effects=[];
        for(const unit of before.units) {
            const changed=after.units.find(u=>u.i===unit.i);
            if(!changed) {effects.push({general:unit.name,field:'present',before:true,after:false});continue;}
            for(const field of ['arms','hp','state','mp']) {
                if(field==='mp'&&unit.i===actor.i)continue;
                if(changed[field]!==unit[field])effects.push({general:unit.name,field,before:unit[field],after:changed[field]});
            }
        }
        if(before.weather!==after.weather)effects.push({field:'weather',before:before.weather,after:after.weather});
        for(const field of ['player','enemy','knownEnemy'])if(before.food[field]!==after.food[field])effects.push({field:'food.'+field,before:before.food[field],after:after.food[field]});
        const attempt={actor:actor.name,skill,before,after,effects};
        report.skillAttempts??=[];report.skillAttempts.push(attempt);
        report.skillCost??=attempt;
        if(effects.length)report.skillEffect=attempt;
        await checkpoint(cdp,'30-skill-real-mp-cost-'+report.skillAttempts.length);return true;
    }
    await action(cdp,'cancel-unavailable-skills','BayeHdBattle.cancel()');await waitBattle(cdp,3,'return from unavailable skills');return false;
}
async function performCombatCosts(cdp) {
    report.combatStart=await evaluate(cdp,battleStateExpression);
    // Every action below represents explicit player intent. These helpers read
    // native legal paths, ranges and LIB skill restrictions, and deliver only
    // the same UI actions a player can make. No engine field is assigned.
    for(let step=0;step<60&&(!report.attackCost||!report.skillCost||!report.skillEffect);step++) {
        const current=await evaluate(cdp,battleStateExpression);
        assert.equal(current.fight.over,0,'battle remains live until both action costs are verified');
        const actor=current.units.find(u=>u.side==='player'&&u.active===0&&u.state!==8&&u.state!==1&&u.state!==6&&u.arms>0);
        if(!actor) {assert.ok((report.turns?.length||0)<8,'combat cost verification reaches its bounded turn limit');await endArmyTurn(cdp);continue;}
        const selection=await chooseGeneral(cdp,actor);
        if(selection.inputKind===2) {
        const candidates=await evaluate(cdp,moveTilesExpression),enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);
        const distance=(p)=>Math.min(...enemies.map(u=>Math.abs(p.x-u.x)+Math.abs(p.y-u.y)));
        const target=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8)).sort((a,b)=>distance(a)-distance(b))[0];
        assert.ok(target,'real legal movement exists for combat actor');
        await action(cdp,'approach-exact-path-tile-'+actor.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
        await waitBattle(cdp,3,'manual combat action '+actor.name);
        }
        if(!report.attackCost && await attemptAttack(cdp,actor))continue;
        if(!report.skillEffect && await attemptSkill(cdp,actor))continue;
        const rest=await evaluate(cdp,'baye.hd.menuItems().names[3]');await menuChoice(cdp,rest,1);
    }
    assert.ok(report.attackCost,'a genuine normal attack was verified');assert.ok(report.skillCost,'a genuine MP-consuming skill was verified');assert.ok(report.skillEffect,'a genuine skill effect beyond MP cost was verified');
    if(!report.turns?.length) await endArmyTurn(cdp);
}

async function main() {
    fs.mkdirSync(artifactDir, { recursive: true });
    if (typeof WebSocket !== 'function') throw new Error('Node 22+ is required for built-in WebSocket');
    if (staged) for (const filename of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.ok(fs.existsSync(path.join(root, 'build/wasm/src', filename)), 'Missing staged WASM file: ' + filename);
    }
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'baye-battle-runtime-'));
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
            '--disable-background-networking', '--window-size=1920,1080', '--remote-debugging-port=' + debugPort,
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
            localStorage.clear();
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
            try { report.failureState = await evaluate(cdp, snapshotExpression);report.engineInputs=await evaluate(cdp,'window.__runtimeEngineInputs');report.battleKeys=await evaluate(cdp,'window.__battleKeys'); } catch {}
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
        fs.rmSync(profile, { recursive: true, force: true });
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Real LIB/WASM battle browser smoke passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
