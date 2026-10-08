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
import crypto from 'node:crypto';
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
const servedAssets = new Map();

function prepareServedAssets() {
    report.sources = {};
    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map', 'baye.build.json',
        ...fs.readdirSync(path.join(root,'js')).filter(name=>name.endsWith('.js')&&name!=='baye.js'),
        ...fs.readdirSync(path.join(root,'css')).filter(name=>name.endsWith('.css'))]) {
        const base = staged && name.startsWith('baye.') ? path.join(root, 'build/wasm/src') :
            path.join(root, name.endsWith('.css') ? 'css' : 'js');
        const filename = path.join(base, name), data = fs.readFileSync(filename);
        const metadata = { source: path.relative(root, filename), bytes: data.length,
            sha256: crypto.createHash('sha256').update(data).digest('hex') };
        report.sources[name] = metadata;
        servedAssets.set((name.endsWith('.css') ? 'css/' : 'js/') + name, { data, metadata });
    }
    const manifest = JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));
    report.engineManifest=manifest;
    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.equal(report.sources[name].bytes, manifest.artifacts[name].bytes, 'Engine artifact bytes match manifest: ' + name);
        assert.equal(report.sources[name].sha256, manifest.artifacts[name].sha256, 'Engine artifact hash matches manifest: ' + name);
    }
    for (const name of ['pc.html','libs/dat-mod.lib','assets/hd-overworld/manifest.json',
        'assets/hd-overworld/china-lcc-cities.json','assets/hd-overworld/roads/adjacency.json',
        'assets/hd-overworld/palette/factions.json','assets/hd-overworld/terrain/base_plains.jpg',
        'assets/hd-portraits/manifest.json','assets/hd-portraits/refs/index.json','assets/hd-spe/manifest.json',
        'vendor/iBaye/src/data/pstring.h','scripts/test-hd-battle-runtime.mjs']) {
        const data=fs.readFileSync(path.join(root,name));
        const metadata={source:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
        report.sources[name]=metadata;servedAssets.set(name,{data,metadata});
    }
}

async function startServer() {
    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'pc.html';
            const snapshot = servedAssets.get(rel);
            if (snapshot) {
                report.requests.push({ url: url.pathname, status: 200, ...snapshot.metadata });
                res.writeHead(200, { 'Content-Type': mime[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(snapshot.data);
                return;
            }
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
    await terrainSmoke(cdp, before);
    const own=before.units.find(u=>u.side==='player' && u.active===0);
    assert.ok(own,'an actual player general remains available');
    await action(cdp,'select-own-for-cancel',`BayeHdBattle.clickUnitByName(${JSON.stringify(own.name)})`);
    await waitBattle(cdp,2,'move selection');
    await rangeFeedbackSmoke(cdp);
    await action(cdp,'cancel-uncommitted-move','BayeHdBattle.cancel()');
    await waitBattle(cdp,1,'move canceled');
    await verifyNativeFeedback(cdp,'canceled MOVE','inactive');
    assert.deepEqual((await evaluate(cdp,battleStateExpression)).units,before.units,'canceling movement preserves every general');
    await checkpoint(cdp,'16-move-cancel');

    // HELP is produced by the actual focused native general. Compare the new
    // captured fields to live Person/JLPOS/attack attributes, then retire and
    // reopen under another native input owner without assigning any game data.
    await helpSmoke(cdp, before);
    await viewSmoke(cdp, before);
    await waitBattle(cdp,1,'return from strategic view');

    await action(cdp,'open-real-system-menu','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'native five-item system menu');
    await verifyNativeFeedback(cdp,'SYSTEM menu','inactive');
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
    await verifyNativeFeedback(cdp,'CLASSIC mode','inactive');
    assert.deepEqual(await evaluate(cdp,battleStateExpression),modeBefore,'classic mode preserves native menu and units');
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),modeKeyCount,'switching classic sends no battle key');
    await checkpoint(cdp,'20-battle-classic-system');
    await evaluate(cdp,"BayeHdBattle.setMode('hd')");
    await waitFor(cdp,'restored HD native menu','BayeHdBattle.debugSnapshot().menuLive && BayeHdBattle.debugSnapshot().menuClickable');
    await verifyNativeFeedback(cdp,'restored HD SYSTEM menu','inactive');
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
    await knownEnemyViewSmoke(cdp);
    await terrainGallery(cdp);

}

async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&f;})()`,timeout);
}

function nativeHelpLabels() {
    const lib = servedAssets.get('libs/dat-mod.lib').data;
    assert.equal(crypto.createHash('sha256').update(lib).digest('hex'),
        '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    const source = servedAssets.get('vendor/iBaye/src/data/pstring.h').data.toString('utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const constants = {}, declarations = source.match(/enum\s*\{([\s\S]*?)\}/)[1].split(',');
    let next = 0;
    for (const declaration of declarations) {
        const match = declaration.trim().match(/^(\w+)(?:\s*=\s*(\d+))?$/);
        if (!match) continue;
        if (match[2]) next = Number(match[2]);
        constants[match[1]] = next++;
    }
    // FgtLoadToMem2 uses IFACE_STRID=1 and the native RCHEAD14/RIDX8 layout.
    const address = lib.readUInt32LE(0), end = address + lib.readUInt32LE(address);
    assert.equal(lib.readUInt16LE(address + 4), 1); assert.equal(lib.readUInt16LE(address + 12), 0);
    const count = lib.readUInt16LE(address + 6), itemLength = lib.readUInt32LE(address + 8);
    const item = index => {
        assert.ok(index >= 1 && index <= count);
        const row = address + 14 + (index - 1) * 8;
        const offset = itemLength ? address + 14 + (index - 1) * itemLength : address + lib.readUInt32LE(row);
        const length = itemLength || lib.readUInt32LE(row + 4);
        assert.ok(offset >= address + 14 && offset + length <= end && end <= lib.length);
        const bytes = lib.subarray(offset, offset + length), zero = bytes.indexOf(0);
        return bytes.subarray(0, zero < 0 ? bytes.length : zero);
    };
    const decoder = new TextDecoder('gbk'), arms = item(constants.dFgtGenTyp);
    return { situation: Object.fromEntries(['dPowerCmp','dDaysInf','dReserve0','dArmyInf','dProvInf','dNoView'].map(name=>[name,decoder.decode(item(constants[name]))])),
        arms: Array.from({ length: 6 }, (_, i) => decoder.decode(arms.subarray(i * 4, i * 4 + 4))),
        states: Array.from({ length: 8 }, (_, i) => decoder.decode(item(constants.dFgtState0 + i))) };
}

const viewObservationExpression = `(() => {
    const d=baye.data,v=baye.hd.view(),f=baye.hd.fight(),dialog=BayeHdDialog.debugSnapshot(),rows=[],points=[];
    const side=v.force*10,ids=Array.from({length:20},(_,i)=>Number(d.g_FgtParam.GenArray[i]));
    let total=0;while(total<10&&ids[side+total])total++;
    for(let i=v.pageStart;i<Math.min(total,v.pageStart+v.pageSize);i++) {
        const slot=side+i,personIndex=ids[slot]-1;rows.push({slot,personIndex,name:baye.getPersonName(personIndex),arms:Number(d.g_Persons[personIndex].Arms)});
    }
    for(let slot=0;slot<20;slot++) {const p=d.g_GenPos[slot];if(Number(p.state)!==8)points.push({slot,personIndex:ids[slot]-1,x:Number(p.x),y:Number(p.y),state:Number(p.state)});}
    const leaderPerson=Number(d.g_Persons[ids[side]-1].Belong)-1;
    const visual=n=>{
        if(!n)return {visible:false};const r=n.getBoundingClientRect();let visible=!!(r.width&&r.height&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight);
        const ancestors=[];
        for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p),a=p.getBoundingClientRect();if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)visible=false;
            // BODY overflow propagates to the viewport when HTML overflow is
            // visible; its short content box does not clip fixed HD overlays.
            const viewportClip=p===document.documentElement||(p===document.body&&getComputedStyle(document.documentElement).overflowY==='visible');
            const clipTop=viewportClip?0:a.top,clipBottom=viewportClip?innerHeight:a.bottom;
            const clipped=['auto','scroll','hidden','clip'].includes(s.overflowY)&&(r.top<clipTop-1||r.bottom>clipBottom+1);if(clipped)visible=false;
            ancestors.push({tag:p.tagName,id:p.id,className:p.className,overflowY:s.overflowY,pointerEvents:s.pointerEvents,viewportClip,clipped,top:a.top,bottom:a.bottom});}
        const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {visible:visible&&!!(top&&(top===n||n.contains(top))),top:top&&(top.id||top.className||top.tagName),ancestors,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    };
    const table=[...document.querySelectorAll('.hd-situation-row')];
    return {view:v,fight:f,dialog,native:{rows,points,total,leaderPerson,leaderName:baye.getPersonName(leaderPerson),days:Number(d.g_FgtBoutCnt),
        width:Number(d.g_MapWid),height:Number(d.g_MapHgt),mode:Number(d.g_FgtParam.Mode),foodKnown:v.force===0||Number(d.g_EneTmpProv)>0,
        food:v.force===0?Number(d.g_FgtParam.MProvender):Number(d.g_EneTmpProv),secretFood:Number(d.g_FgtParam.EProvender)},
        dom:{stage:visual(document.querySelector('#hd-dialog .hd-dialog-stage')),title:document.querySelector('#hd-dialog-title')?.textContent,
            faction:document.querySelector('.hd-situation-faction')?.textContent,food:document.querySelector('.hd-situation-food')?.textContent,
            page:document.querySelector('.hd-situation-page')?.textContent,map:visual(document.querySelector('.hd-situation-map')),
            rows:table.map(n=>({slot:Number(n.dataset.hdViewSlot),personIndex:Number(n.dataset.hdViewPerson),name:n.querySelector('.hd-situation-name')?.textContent,
                arms:n.querySelector('.hd-situation-arms')?.textContent,nameVisual:visual(n.querySelector('.hd-situation-name')),armsVisual:visual(n.querySelector('.hd-situation-arms'))})),
            points:[...document.querySelectorAll('.hd-situation-dot')].map(n=>({slot:Number(n.dataset.hdViewSlot),personIndex:Number(n.dataset.hdViewPerson),x:Number(n.dataset.hdViewX),y:Number(n.dataset.hdViewY),visual:visual(n)})),
            buttons:[...document.querySelectorAll('#hd-dialog [data-hd-view-key],#hd-dialog [data-hd-dlg-ok],#hd-dialog [data-hd-dlg-lcd]')].filter(n=>!n.hidden).map(n=>({text:n.textContent,key:n.getAttribute('data-hd-view-key'),visual:visual(n)}))}};
})()`;

async function verifyView(cdp,label) {
    await waitFor(cdp,'complete current native VIEW: '+label,`(() => {const v=baye.hd.view(),d=BayeHdDialog.debugSnapshot();return v.active===1&&v.complete===1&&d.open&&d.kind==='view'&&d.viewOwner?.seq===v.seq;})()`);
    const state=await evaluate(cdp,viewObservationExpression),{view:v,native:n,dom:d,dialog}=state,labels=nativeHelpLabels().situation;
    report.currentViewObservation={label,...state};
    assert.equal(v.protocolVersion,1);assert.equal(v.custom,0);assert.equal(v.generation,v.detailGeneration);assert.equal(v.inputSeq,state.fight.inputSeq);
    assert.deepEqual(v.rows.map(({slot,personIndex,name,arms})=>({slot,personIndex,name,arms})),n.rows);
    assert.deepEqual(v.points,n.points);assert.equal(v.totalCount,n.total);assert.equal(v.rowCount,n.rows.length);
    for(const [actual,expected] of [['leaderPerson','leaderPerson'],['days','days'],['width','width'],['height','height'],['playerMode','mode']])assert.equal(v[actual],n[expected]);
    assert.equal(v.foodKnown,Number(n.foodKnown));assert.equal(v.food,n.foodKnown?n.food:0);
    assert.equal(v.title,labels.dPowerCmp.trimEnd());assert.equal(v.positionsText,labels.dReserve0.trimEnd());
    assert.equal(v.factionText,(n.leaderName+labels.dArmyInf).trimEnd());
    assert.equal(v.foodText,(labels.dProvInf+(n.foodKnown?n.food:labels.dNoView)).trimEnd());
    assert.deepEqual(dialog.viewOwner,{kind:10,seq:v.seq,generation:v.generation,inputSeq:v.inputSeq});
    assert.equal(d.title,v.title);assert.equal(d.faction,v.factionText);assert.equal(d.food,v.foodText);
    assert.deepEqual(d.rows.map(row=>({slot:row.slot,personIndex:row.personIndex,name:row.name,arms:row.arms})),n.rows.map(row=>({...row,arms:'兵 '+row.arms})));
    assert.deepEqual(d.points.map(({slot,personIndex,x,y})=>({slot,personIndex,x,y})),n.points.map(({slot,personIndex,x,y})=>({slot,personIndex,x,y})));
    assert.equal(d.stage.visible,true,'VIEW card actually visible: '+label);assert.equal(d.map.visible,true,'VIEW position map actually visible: '+label);
    assert.ok(d.rows.every(row=>row.nameVisual.visible&&row.armsVisual.visible),'all current native page names and troops are actually visible');
    assert.equal(d.buttons.length,6,'actual VIEW has four native navigation controls, return and classic comparison');
    assert.ok(d.buttons.every(button=>button.visual.visible&&button.visual.rect.height>=44),'every current VIEW control is visible, hit-testable and at least 44px high');
    assert.ok(d.points.every(point=>point.visual.visible),'each captured actual unit position is visibly painted');
    (report.viewChecks ||= []).push({label,...state});return state;
}

async function viewSmoke(cdp,before) {
    await key(cdp,'f');await waitBattle(cdp,10,'native strategic view');await verifyNativeFeedback(cdp,'VIEW overlay','inactive');
    let current=await verifyView(cdp,'enemy first native page');assert.equal(current.view.force,1);assert.equal(current.view.pageStart,0);
    assert.equal(current.view.foodKnown,0);assert.equal(current.view.food,0);assert.ok(current.native.secretFood>0,'unknown enemy supply really differs from the revealed field');
    const keys=await evaluate(cdp,'window.__battleKeys.length'),snapshot=current.view;
    await delay(700);assert.deepEqual(await evaluate(cdp,'baye.hd.view()'),snapshot,'native blinking keeps exact page owner and data');
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),keys,'view painting and native blinking send no game key');
    await checkpoint(cdp,'18-battle-view-enemy-hd');
    const step=async(code,label)=>{
        const prev=current.view;await click(cdp,`#hd-dialog [data-hd-view-key="${code}"]`);
        await waitFor(cdp,'actual VIEW page ACK '+label,`baye.hd.fight().inputKind===10&&baye.hd.fight().inputSeq>${prev.inputSeq}&&baye.hd.view().seq>${prev.seq}`);
        current=await verifyView(cdp,label);return current;
    };
    await step(0x25,'player first native page');assert.equal(current.view.force,0);assert.equal(current.view.pageStart,0);
    assert.ok(current.view.totalCount>current.view.pageSize,'actual player squad spans more than one native page');
    const pageSize=current.view.pageSize;await step(0x23,'player second native page');assert.equal(current.view.pageStart,pageSize);
    await checkpoint(cdp,'18-battle-view-player-second-page');
    const boundary=current.view.pageStart;await step(0x23,'player last-page boundary');assert.equal(current.view.pageStart,boundary);
    await step(0x22,'player previous native page');assert.equal(current.view.pageStart,0);
    await step(0x24,'enemy switch resets native page');assert.equal(current.view.force,1);assert.equal(current.view.pageStart,0);
    for(const [width,height,label] of [[1920,1080,'1080p'],[1280,720,'720p']]) {
        await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(350);
        current=await verifyView(cdp,label+' HD');const startKeys=await evaluate(cdp,'window.__battleKeys.length'),owner=current.view;
        assert.equal(current.dialog.showLcd,false);assert.equal((await observeNativeLcd(cdp)).visible,false);
        await checkpoint(cdp,'18-battle-view-'+label+'-hd');await click(cdp,'#hd-dialog [data-hd-dlg-lcd]');
        current=await verifyView(cdp,label+' classic comparison');assert.equal(current.dialog.showLcd,true);
        const lcd=await observeNativeLcd(cdp);assert.equal(lcd.visible,true);assert.ok(lcd.bitmap.differentPixels>0);
        const r=current.dom.stage.rect;assert.ok(lcd.rect.left>=r.right||lcd.rect.right<=r.left||lcd.rect.top>=r.bottom||lcd.rect.bottom<=r.top,'VIEW card and real LCD do not overlap');
        await checkpoint(cdp,'18-battle-view-'+label+'-classic');await click(cdp,'#hd-dialog [data-hd-dlg-lcd]');
        current=await verifyView(cdp,label+' restored HD');assert.equal(current.dialog.showLcd,false);
        assert.deepEqual(await evaluate(cdp,'baye.hd.view()'),owner);assert.equal(await evaluate(cdp,'window.__battleKeys.length'),startKeys,'resize and explicit classic comparison send zero native keys');
    }
    await click(cdp,'#hd-dialog [data-hd-dlg-ok]');await waitBattle(cdp,1,'return from native VIEW10');
    await waitFor(cdp,'VIEW fields and exact owner retired',`baye.hd.view().active===0&&!BayeHdDialog.debugSnapshot().viewOwner`);
    assert.deepEqual((await evaluate(cdp,battleStateExpression)).units,before.units,'VIEW switching, pages and return preserve all actual native battle units');
    await checkpoint(cdp,'18-battle-view-retired');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await delay(300);
}

async function knownEnemyViewSmoke(cdp) {
    const before=await evaluate(cdp,battleStateExpression);
    const reveal=report.skillAttempts?.find(attempt=>attempt.skill.id===30&&attempt.effects.some(effect=>effect.field==='food.knownEnemy'&&effect.after>0));
    assert.ok(reveal,'actual successful native spy skill precedes the known enemy VIEW scenario');
    assert.ok(before.food.knownEnemy>0,'enemy supply is actually known after the native spy action');
    await key(cdp,'f');await waitBattle(cdp,10,'reopen VIEW after actual spy report');
    const current=await verifyView(cdp,'reopened enemy VIEW after actual spy');
    assert.equal(current.view.force,1);assert.equal(current.view.pageStart,0);assert.equal(current.view.foodKnown,1);
    assert.equal(current.view.food,before.food.knownEnemy);assert.ok(!current.dom.food.includes('?'));
    const oldOwner=report.viewChecks[0].dialog.viewOwner,keys=await evaluate(cdp,'window.__battleKeys.length');
    assert.ok(current.view.seq>oldOwner.seq&&current.view.inputSeq>oldOwner.inputSeq,'reopened actual VIEW owns a new draw and input');
    const staleResult=await evaluate(cdp,`BayeHdBattle.viewKey(0x23,${JSON.stringify(oldOwner)})`);
    assert.deepEqual(staleResult,{ok:false,reason:'view-owner-changed'},'retired VIEW button cannot reach the new native input');
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),keys);assert.deepEqual(await evaluate(cdp,'baye.hd.view()'),current.view);
    await checkpoint(cdp,'31-battle-view-known-enemy-reopened');
    await key(cdp,'Enter');await waitBattle(cdp,1,'physical Enter returns from current VIEW');
    await waitFor(cdp,'reopened VIEW owner retired','baye.hd.view().active===0&&!BayeHdDialog.debugSnapshot().viewOwner');
    const after=await evaluate(cdp,battleStateExpression);
    assert.deepEqual(after.units,before.units);assert.deepEqual(after.food,before.food);assert.equal(after.weather,before.weather);
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),keys+1,'one physical return reaches exactly one native key');
    report.knownEnemyView={reveal:{actor:reveal.actor,skill:reveal.skill.name,id:reveal.skill.id,effects:reveal.effects},oldOwner,staleResult,current,before,after};
    await checkpoint(cdp,'31-battle-view-known-enemy-returned');
}

const helpObservationExpression = `(() => {
    const d=baye.data,help=baye.hd.help(),fight=baye.hd.fight(),dialog=BayeHdDialog.debugSnapshot();
    const slot=help.slot,person=help.person,p=Number.isInteger(person)&&person>=0&&person<65535?d.g_Persons[person]:null;
    const pos=Number.isInteger(slot)&&slot>=0&&slot<20?d.g_GenPos[slot]:null,att=d.g_GenAtt[0];
    const derived=p?(typeof baye.hd.personArmType==='function'?baye.hd.personArmType(person):person<256?baye.getArmType(person):null):null;
    const root=document.querySelector('#hd-dialog'),stage=root&&root.querySelector('.hd-dialog-stage'),portrait=document.querySelector('#hd-portrait');
    const visual=node=>{
        if(!node)return {visible:false};
        const r=node.getBoundingClientRect();let styled=true;
        for(let p=node;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0){styled=false;break;}}
        const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return {visible:!!(styled&&r.width&&r.height&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&
            top&&(top===node||node.contains(top))),style:getComputedStyle(node).visibility,
            rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},top:top&&top.id};
    };
    return {help,fight,dialog,portrait:BayeHdPortraits.debugSnapshot(),
        portraitHidden:!portrait||portrait.hidden,portraitSource:portrait&&portrait.getAttribute('data-hd-portrait-source'),
        focus:{x:Number(d.g_FoucsX),y:Number(d.g_FoucsY)},native:pos&&p?{
            slotPerson:Number(d.g_FgtParam.GenArray[slot])-1,name:baye.getPersonName(person),
            x:Number(pos.x),y:Number(pos.y),state:Number(pos.state),
            fields:[Number(p.Level),Number(p.Force),Number(p.IQ),Number(p.Experience),Number(pos.hp),Number(pos.mp),
                Number(att.at),Number(att.df),Number(p.Arms),derived],levelMax:Number(p.Level)>=Number(d.g_engineConfig.maxLevel)?1:0}:null,
        dom:{visible:visual(stage).visible,stage:visual(stage),pass:document.documentElement.getAttribute('data-baye-dialog-pass'),
            kind:root&&root.getAttribute('data-hd-help-kind'),person:root&&root.getAttribute('data-hd-help-person'),
            name:document.querySelector('.hd-help-name')?.textContent,summary:document.querySelector('.hd-help-summary')?.textContent,
            nameVisibility:visual(document.querySelector('.hd-help-name')),summaryVisibility:visual(document.querySelector('.hd-help-summary')),
            controls:{lcd:visual(root&&root.querySelector('[data-hd-dlg-lcd]')),return:visual(root&&root.querySelector('[data-hd-dlg-ok]'))},
            rows:[...document.querySelectorAll('.hd-help-field')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]),
            rowVisibility:[...document.querySelectorAll('.hd-help-field')].map(row=>({label:visual(row.querySelector('dt')),value:visual(row.querySelector('dd'))}))}};
})()`;

async function verifyPersonHelp(cdp, unit, label, labels) {
    const observed = await waitFor(cdp, label + ' complete captured HUD', `(() => {
        const h=baye.hd.help(),d=BayeHdDialog.debugSnapshot();
        return h.active===1&&h.protocolVersion===1&&h.complete===1&&h.kind===1&&d.helpDetail&&d.helpDetail.person===${unit.id - 1};
    })()`);
    assert.equal(observed, true);
    const state = await evaluate(cdp, helpObservationExpression), { help, fight, dialog, native, dom } = state;
    assert.ok(native && dom.visible, label + ' is a visible native person HUD');
    assert.equal(dialog.pass, false, 'current native HELP9 cannot be mistaken for a retired march overlay');
    assert.equal(dom.pass, '0');
    assert.ok(dom.nameVisibility.visible && dom.summaryVisibility.visible, 'actual HUD heading/summary are visible on screen');
    assert.equal(dom.rowVisibility.length, 9);
    assert.ok(dom.rowVisibility.every(row => row.label.visible && row.value.visible), 'all nine native HUD labels and values are actually visible');
    assert.equal(fight.inputKind, 9); assert.equal(help.person, unit.id - 1); assert.equal(help.slot, unit.i);
    assert.equal(help.person, native.slotPerson); assert.equal(help.name, native.name); assert.equal(help.name, unit.name);
    assert.deepEqual({ x: help.x, y: help.y }, state.focus); assert.deepEqual(state.focus, { x: native.x, y: native.y });
    assert.ok(Number.isInteger(help.seq) && help.seq > 0); assert.ok(Number.isInteger(help.generation) && help.generation > 0);
    assert.equal(help.generation, help.detailGeneration); assert.equal(help.inputSeq, fight.inputSeq);
    assert.deepEqual(help.fields, native.fields, 'all ten captured values agree with actual Person/JLPOS/native BuiltAtkAttr');
    assert.equal(help.levelMax, native.levelMax); assert.equal(help.arm, labels.arms[native.fields[9]]);
    assert.equal(help.state, labels.states[native.state]);
    assert.deepEqual(dialog.helpOwner, { kind: 9, inputSeq: fight.inputSeq });
    for (const key of ['kind', 'seq', 'generation', 'inputSeq', 'person', 'slot', 'name']) {
        assert.equal(dialog.helpDetail[key], help[key], 'dialog carries exact native HELP owner field ' + key);
    }
    const expectedRows = ['等级','武力','智力','经验','生命','技能点','攻击','防御','兵力']
        .map((name, index) => [name, String(index === 0 && help.levelMax ? 'MX' : native.fields[index])]);
    assert.deepEqual(dialog.helpDetail.rows, expectedRows.map(([name, value], index) =>
        [name, index === 0 && help.levelMax ? 'MX' : native.fields[index]]));
    assert.deepEqual(dom.rows, expectedRows); assert.equal(dom.name, help.name);
    assert.equal(dom.summary, help.arm + ' · ' + help.state); assert.equal(dom.kind, '1'); assert.equal(dom.person, String(help.person));
    assert.equal(dialog.showLcd, false, 'complete native person HUD owns its structured presentation');
    state.lcd = await observeNativeLcd(cdp);
    assert.equal(state.lcd.containerVisibility, 'hidden', 'complete HD HELP defaults to hiding its native LCD');
    assert.equal(state.lcd.canvasVisibility, 'hidden');
    assert.equal(state.lcd.visible, false);
    await waitFor(cdp, label + ' portrait current identity', `(() => {
        const p=BayeHdPortraits.debugSnapshot(),root=document.querySelector('#hd-portrait');
        return root&&!root.hidden&&p.context==='battle-note'&&Number(p.personId)===${help.person};
    })()`);
    state.portrait = await evaluate(cdp, 'BayeHdPortraits.debugSnapshot()');
    assert.equal(state.portrait.supportedLib, true); assert.equal(state.portrait.preview, false);
    assert.equal(await evaluate(cdp, 'document.querySelector("#hd-portrait").getAttribute("data-hd-portrait-source")'), 'runtime');
    const keys = await evaluate(cdp, 'window.__battleKeys.length');
    await delay(350);
    assert.equal(await evaluate(cdp, 'window.__battleKeys.length'), keys, 'HELP paints/portrait completion send no inputs');
    assert.deepEqual(await evaluate(cdp, 'baye.hd.help()'), help, 'idle HELP keeps the same captured native owner and statistics');
    (report.helpChecks ||= []).push({ label, ...state });
    await checkpoint(cdp, label);
    return state;
}

async function observeNativeLcd(cdp) {
    return evaluate(cdp, `(() => {
        const canvas=document.querySelector('#lcd'),container=document.querySelector('.container.js-baye-pc-lcd');
        if(!canvas||!container)return {visible:false,missing:true};
        const r=canvas.getBoundingClientRect();let styled=true;
        for(let p=canvas;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0){styled=false;break;}}
        let bitmap=null;
        try {const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            let different=0;for(let i=4;i<bytes.length;i+=4)if(bytes[i]!==bytes[0]||bytes[i+1]!==bytes[1]||bytes[i+2]!==bytes[2]||bytes[i+3]!==bytes[3])different++;
            bitmap={width:canvas.width,height:canvas.height,differentPixels:different};} catch(error){bitmap={error:String(error)};}
        const board=document.querySelector('#hd-battle-canvas');
        const stacks=[0.25,0.5,0.75].map(part=>{
            const nodes=document.elementsFromPoint(r.left+r.width*part,r.top+r.height*part);
            const lcdIndex=nodes.indexOf(canvas),boardIndex=nodes.indexOf(board);
            return {lcdIndex,boardIndex,aboveBoard:lcdIndex>=0&&(boardIndex<0||lcdIndex<boardIndex),
                nodes:nodes.map(node=>node.id||node.className||node.tagName)};
        });
        const aboveBoard=stacks.every(stack=>stack.aboveBoard);
        return {visible:!!(styled&&r.width&&r.height&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&aboveBoard),
            containerVisibility:getComputedStyle(container).visibility,canvasVisibility:getComputedStyle(canvas).visibility,
            pointerEvents:getComputedStyle(container).pointerEvents,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
            aboveBoard,stacks,bitmap,dialog:BayeHdDialog.debugSnapshot().showLcd};
    })()`);
}

async function helpLcdToggleSmoke(cdp, current) {
    const before = await evaluate(cdp, battleStateExpression), keys = await evaluate(cdp, 'window.__battleKeys.length');
    const stable = async label => {
        assert.deepEqual(await evaluate(cdp, battleStateExpression), before, label + ' preserves actual HELP input and every native unit/stat');
        assert.deepEqual(await evaluate(cdp, 'baye.hd.help()'), current.help, label + ' preserves captured HELP owner/name/fields');
        assert.equal(await evaluate(cdp, 'window.__battleKeys.length'), keys, label + ' sends no native input');
        const hud = await evaluate(cdp, helpObservationExpression);
        assert.equal(hud.dom.visible, true); assert.equal(hud.dialog.pass, false);
        assert.deepEqual(hud.dialog.helpDetail, current.dialog.helpDetail);
        assert.ok(hud.dom.nameVisibility.visible && hud.dom.summaryVisibility.visible);
        assert.equal(hud.dom.rowVisibility.length, 9);
        assert.ok(hud.dom.rowVisibility.every(row => row.label.visible && row.value.visible));
        assert.ok(hud.dom.controls.lcd.visible && hud.dom.controls.return.visible, label + ' keeps both actual buttons unobstructed');
        return hud;
    };
    const views = [], overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const togglePair = async (label, suffix = '') => {
        const defaultHud = await stable(label + ' default HD');
        const defaultLcd = await observeNativeLcd(cdp);
        assert.equal(defaultLcd.visible, false); assert.equal(defaultLcd.containerVisibility, 'hidden');
        assert.equal(defaultLcd.canvasVisibility, 'hidden');
        await click(cdp, '#hd-dialog [data-hd-dlg-lcd]');
        await waitFor(cdp, label + ' explicit classic LCD visible under the same native HELP owner',
            'BayeHdDialog.debugSnapshot().showLcd===true&&getComputedStyle(document.querySelector("#lcd")).visibility==="visible"');
        const classic = await observeNativeLcd(cdp);
        assert.equal(classic.visible, true); assert.equal(classic.containerVisibility, 'visible');
        assert.equal(classic.aboveBoard, true, label + ' classic LCD is painted above the opaque HD board at three actual screen points');
        assert.ok(classic.bitmap && classic.bitmap.differentPixels > 0, 'visible native LCD contains the actual nonblank help frame');
        const classicHud = await stable(label + ' explicit classic LCD');
        assert.equal(overlaps(classic.rect, classicHud.dom.stage.rect), false, label + ' LCD and actual nine-field help card do not overlap');
        await checkpoint(cdp, '17-battle-help' + suffix + '-classic-lcd');
        await click(cdp, '#hd-dialog [data-hd-dlg-lcd]');
        await waitFor(cdp, label + ' explicit hide restores HD HELP without native input',
            'BayeHdDialog.debugSnapshot().showLcd===false&&getComputedStyle(document.querySelector("#lcd")).visibility==="hidden"');
        const hidden = await observeNativeLcd(cdp);
        assert.equal(hidden.visible, false); assert.equal(hidden.containerVisibility, 'hidden');
        const hiddenHud = await stable(label + ' return to HD HELP');
        await checkpoint(cdp, '17-battle-help' + suffix + '-hd-restored');
        views.push({ label, viewport: await evaluate(cdp, '({width:innerWidth,height:innerHeight})'),
            defaultLcd, defaultHud: defaultHud.dom, classic, classicHud: classicHud.dom, hidden, hiddenHud: hiddenHud.dom });
        return { classic, hidden };
    };
    const { classic, hidden } = await togglePair('1080p');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await waitFor(cdp, '720p actual HELP layout', 'innerWidth===1280&&innerHeight===720');
    await delay(200);
    await togglePair('720p', '-720p');
    report.helpLcdToggle = { owner: { seq: current.help.seq, inputSeq: current.help.inputSeq, generation: current.help.generation,
        person: current.help.person }, classic, hidden, views, nativeKeysBefore: keys, nativeKeysAfter: await evaluate(cdp, 'window.__battleKeys.length') };
}

async function verifyHelpRetired(cdp, label, oldHelp) {
    await waitFor(cdp, label + ' retired native owner', `(() => {
        const h=baye.hd.help(),d=BayeHdDialog.debugSnapshot(),p=document.querySelector('#hd-portrait');
        return h.active===0&&(!d.open||d.kind!=='help')&&!d.helpOwner&&!d.helpDetail&&(!p||p.hidden);
    })()`);
    const state = await evaluate(cdp, '({help:baye.hd.help(),fight:baye.hd.fight(),dialog:BayeHdDialog.debugSnapshot(),portrait:BayeHdPortraits.debugSnapshot()})');
    assert.equal(state.help.complete, 0); assert.equal(state.help.kind, 0);
    assert.notEqual(state.fight.inputSeq, oldHelp.inputSeq, 'finished HELP cannot own the new input wait');
    assert.equal(state.dialog.helpStamp, '');
    (report.helpRetirements ||= []).push({ label, oldOwner: { seq: oldHelp.seq, inputSeq: oldHelp.inputSeq,
        generation: oldHelp.generation, person: oldHelp.person }, ...state });
}

async function helpSmoke(cdp, before) {
    const labels = nativeHelpLabels(), own = before.units.find(u => u.side === 'player' && u.state !== 8);
    assert.ok(own, 'native battle contains a living player general for HELP');
    await focusBattleTarget(cdp, own, '17-battle-help-focused', 1);
    await key(cdp, 'h'); await waitBattle(cdp, 9, 'native general information');
    await verifyNativeFeedback(cdp, 'HELP overlay', 'inactive');
    const first = await verifyPersonHelp(cdp, own, '17-battle-help', labels);
    report.helpVisibility = await nativeLcdVisibility(cdp);
    assert.ok(report.helpVisibility.visible, 'general information is visibly rendered above the board');
    await helpLcdToggleSmoke(cdp, first);
    await click(cdp, '#hd-dialog [data-hd-dlg-ok]');
    await waitBattle(cdp, 1, 'return from general info'); await verifyHelpRetired(cdp, 'first HELP return', first.help);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await delay(200);
    const secondUnit = before.units.find(u => u.id !== own.id && u.state !== 8 && u.side === 'player');
    assert.ok(secondUnit, 'another genuine general proves HELP identity replacement');
    await focusBattleTarget(cdp, secondUnit, '17-battle-help-second-focused', 1);
    await key(cdp, 'h'); await waitBattle(cdp, 9, 'second native general information');
    const second = await verifyPersonHelp(cdp, secondUnit, '17-battle-help-second-owner', labels);
    assert.notEqual(second.help.person, first.help.person); assert.notEqual(second.help.seq, first.help.seq);
    assert.notEqual(second.help.inputSeq, first.help.inputSeq); assert.notEqual(second.dialog.helpStamp, first.dialog.helpStamp);
    assert.notEqual(second.portrait.personId, first.portrait.personId, 'previous HELP portrait is replaced by its current native person');
    await action(cdp, 'return-second-general-info', 'BayeHdBattle.returnFromHelp()');
    await waitBattle(cdp, 1, 'return from second general info'); await verifyHelpRetired(cdp, 'second HELP return', second.help);
    assert.deepEqual((await evaluate(cdp, battleStateExpression)).units, before.units, 'HELP and identity replacement preserve every native unit');
}

async function nativeLcdVisibility(cdp) {
    return evaluate(cdp,`(() => {
        const help=BayeHdDialog.debugSnapshot();
        const dialog=document.querySelector('#hd-dialog');
        const stage=dialog&&dialog.querySelector('.hd-dialog-stage');
        if(help.open&&!help.pass&&help.kind==='help'&&help.body&&stage) {const r=stage.getBoundingClientRect(),s=getComputedStyle(stage),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&stage.contains(top))return {visible:true,id:'hd-dialog-stage',kind:help.kind,text:help.body,top:top&&top.id};}
        const nodes=[...document.querySelectorAll('canvas')].filter(n=>n.id!=='hd-battle-canvas' && n.id!=='hd-overworld-canvas');
        return nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:n.id,width:r.width,height:r.height,display:s.display,visibility:s.visibility,top:top&&top.id,visible:!!(r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&(top===n||n.contains(top)))};}).find(n=>n.visible)||{visible:false,nodes:nodes.map(n=>n.id)};
    })()`);
}
const moveTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),out=[];
    const sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY);
    for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++) {
        const px=(x-sx+ux)&255,py=(y-sy+uy)&255;
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

async function verifyNativeFeedback(cdp, label, expectedKind) {
    const observed=await evaluate(cdp, `(() => {
        const d=baye.data,s=BayeHdBattle.debugSnapshot(),f=baye.hd.fight();
        const units=[];for(let i=0;i<20;i++) {
            const id=Number(d.g_FgtParam.GenArray[i]),p=d.g_GenPos[i];
            if(id>0&&id<0xfffe)units.push({i,x:Number(p.x),y:Number(p.y),state:Number(p.state),side:i<10?'player':'enemy'});
        }
        const r=d.g_FgtAtkRng,size=Number(r[0]);
        return {feedback:s.feedback,view:s.view,fight:f,units,bounds:{width:Number(d.g_MapWid),height:Number(d.g_MapHgt)},
            focus:{x:Number(d.g_FoucsX),y:Number(d.g_FoucsY)},
            move:{originX:Number(d.g_PathSX),originY:Number(d.g_PathSY),useX:Number(d.g_PUseSX),useY:Number(d.g_PUseSY),values:Array.from({length:225},(_,i)=>Number(d.g_FightPath[i]))},
            aim:{originX:Number(r[1]),originY:Number(r[2]),size,values:Array.from({length:size*size},(_,i)=>Number(r[3+i]))}};
    })()`);
    const {feedback,view,bounds,move,aim,fight,units}=observed;
    assert.ok(feedback,'battle exposes its actual rendered range feedback');
    if(expectedKind==='inactive') {
        assert.equal(feedback.active,false,label+' releases stale range feedback');
        assert.equal(feedback.cells.length,0);
        (report.feedbackChecks ||= []).push({label,active:false,reason:feedback.reason});
        return observed;
    }
    assert.equal(feedback.active,true,label+' belongs to a live range wait');
    assert.equal(feedback.kind,expectedKind);assert.equal(feedback.inputSeq,fight.inputSeq);
    assert.equal(feedback.actorIndex,fight.actorIndex);assert.deepEqual(feedback.bounds,bounds);
    // Independent oracle of C U8 assignments/row stride and confirmation rules.
    const cell=(x,y)=>{
        if(x<0||y<0||x>=bounds.width||y>=bounds.height)return {status:'out',raw:null,index:null};
        const mask=expectedKind==='move'?move:aim;
        const px=(x-mask.originX+(expectedKind==='move'?move.useX:0))&255;
        const py=(y-mask.originY+(expectedKind==='move'?move.useY:0))&255;
        const size=expectedKind==='move'?15:aim.size;
        if(px>=size||py>=size)return {status:'out',raw:null,index:null};
        const index=py*size+px,raw=mask.values[index];
        return {status:(expectedKind==='move'?raw<=128:raw===1)?'in':'out',raw,index};
    };
    const expected=[];
    for(let y=view.y;y<Math.min(bounds.height,view.y+view.h);y++)for(let x=view.x;x<Math.min(bounds.width,view.x+view.w);x++)expected.push({x,y,...cell(x,y)});
    assert.deepEqual(feedback.cells.map(c=>({x:c.x,y:c.y,status:c.status,raw:c.raw,index:c.index})),expected,
        'every visible cell agrees with actual native mask bytes and stride: '+label);
    for(const c of feedback.cells)for(const [edge,dx,dy] of [['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]]) {
        assert.equal(c.edges[edge],c.status==='in'&&cell(c.x+dx,c.y+dy).status!=='in','outline agrees with actual mask adjacency');
    }
    const targetIds=expectedKind==='move'?[]:units.filter(u=>u.state<8&&u.state>=0&&
        (expectedKind==='skill'||u.side==='enemy')&&cell(u.x,u.y).status==='in').map(u=>u.i);
    assert.deepEqual(feedback.rangedUnits.map(u=>u.i),targetIds,'target markers agree with real native units');
    const focus=cell(observed.focus.x,observed.focus.y);
    assert.equal(feedback.focus.status,focus.status);assert.equal(feedback.focus.raw,focus.raw);
    assert.equal(feedback.focus.x,observed.focus.x);assert.equal(feedback.focus.y,observed.focus.y);
    (report.feedbackChecks ||= []).push({label,kind:feedback.kind,inputSeq:feedback.inputSeq,actorIndex:feedback.actorIndex,
        mask:feedback.mask,bounds,view,checkedCells:feedback.cells.length,inRangeCells:feedback.cells.filter(c=>c.status==='in').length,
        focus:feedback.focus,rangedUnits:feedback.rangedUnits.map(u=>u.i)});
    return observed;
}

async function rangeFeedbackSmoke(cdp) {
    await waitFor(cdp,'live movement feedback','BayeHdBattle.debugSnapshot().feedback?.active');
    const first=await verifyNativeFeedback(cdp,'MOVE initial','move');
    const valid=first.feedback.cells.find(c=>c.status==='in');
    const blocked=first.feedback.cells.find(c=>c.status==='out');
    assert.ok(valid&&blocked,'native visible board has allowed and blocked movement cells');
    const before=await evaluate(cdp,battleStateExpression);
    await verifyBattleLegendLayout(cdp, 'MOVE 1080p');
    await checkpoint(cdp,'16-move-range-1080p');
    await focusBattleTarget(cdp,blocked,'16-move-blocked-focus',2);
    const focused=await verifyNativeFeedback(cdp,'MOVE blocked focus','move');
    assert.equal(focused.feedback.focus.label,'不可移动');
    await focusBattleTarget(cdp,valid,'16-move-valid-focus',2);
    await verifyNativeFeedback(cdp,'MOVE allowed focus','move');
    const keys=await evaluate(cdp,'window.__battleKeys.length');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    await waitFor(cdp,'720p movement feedback','innerWidth===1280&&innerHeight===720');
    await delay(200);await verifyNativeFeedback(cdp,'MOVE 720p','move');
    await verifyBattleLegendLayout(cdp, 'MOVE 720p');
    await checkpoint(cdp,'16-move-range-720p');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await delay(200);
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),keys,'range repaint/viewport never delivers a key');
    assert.deepEqual((await evaluate(cdp,battleStateExpression)).units,before.units,'hovering native range cannot move a unit');
}

async function verifyBattleLegendLayout(cdp, label) {
    const layout = await waitFor(cdp, label + ' actual legend paint', `(() => {
        const canvas=document.querySelector('#hd-battle-canvas'),root=document.querySelector('#hd-battle');
        if(!canvas||!root||!window.__battleLegendPaint?.length)return null;
        const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const buttons=[...root.querySelectorAll('.hd-battle-footer button')].map(node=>({text:node.textContent,disabled:node.disabled,...rect(node)}));
        const badge=document.querySelector('#baye-build-badge'),toolbar=document.querySelector('#baye-hd-toolbar');
        return {width:innerWidth,height:innerHeight,canvas:rect(canvas),paint:window.__battleLegendPaint,
            buttons,badge:badge&&rect(badge),toolbar:toolbar&&rect(toolbar),keys:window.__battleKeys.length};
    })()`);
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const legend = layout.paint.map(p => p.text).join(' ');
    for (const entry of ['蓝：己方','红：敌方','待：可行动','已：已行动','行：当前将领']) {
        assert.ok(legend.includes(entry), label + ' displays the complete unit legend: ' + entry);
    }
    const boardBottom = layout.canvas.top + 992 / 1080 * layout.canvas.height;
    const blockers = [...layout.buttons, layout.badge, layout.toolbar].filter(r => r && r.width > 0 && r.height > 0);
    for (const paint of layout.paint) {
        assert.equal(paint.baseline, 'top'); assert.equal(paint.align, 'left');
        assert.ok(paint.rect.top >= boardBottom, label + ' keeps all legend text below the actual unchanged board');
        assert.ok(paint.rect.left >= layout.canvas.left && paint.rect.right <= layout.canvas.right &&
            paint.rect.bottom <= layout.canvas.bottom, label + ' actual text bounds remain inside its canvas');
        for (const blocker of blockers) {
            assert.equal(overlaps(paint.rect, blocker), false, label + ' actual legend rect does not overlap a live control/badge');
        }
    }
    for (const button of layout.buttons) {
        assert.ok(button.width >= 36 && button.height >= 36, label + ' preserves usable actual footer button size: ' + button.text);
        assert.equal(overlaps(button, layout.badge), false, label + ' build badge has its own gap from footer buttons');
    }
    (report.legendChecks ||= []).push({ label, boardBottom, ...layout });
    return layout;
}

async function terrainSmoke(cdp, before) {
    // Read the real full map and occupied-cell C getter, never the scrolling cache.
    const native = await evaluate(cdp, `(() => {
        const d=baye.data,w=Number(d.g_MapWid),h=Number(d.g_MapHgt),units=[];
        const tiles=Array.from({length:w*h},(_,i)=>Number(d.g_FightMapData[i]));
        for(let i=0;i<20;i++) {
            const id=Number(d.g_FgtParam.GenArray[i]),p=d.g_GenPos[i];
            if(id>0&&id<0xfffe&&Number(p.state)!==8) units.push({i,x:Number(p.x),y:Number(p.y),index:Number(baye.getTerrainByGeneralIndex(i))});
        }
        return {w,h,tiles,units,focus:{x:Number(d.g_FoucsX),y:Number(d.g_FoucsY)}};
    })()`);
    assert.ok(native.w>0&&native.h>0);
    report.nativeTerrain = native;
    const inspect = async label => {
        const state = await waitFor(cdp, label, `(() => {
            const s=BayeHdBattle.debugSnapshot(),d=baye.data;
            return s.terrain&&s.focusTerrain&&s.focusTerrain.x===Number(d.g_FoucsX)&&s.focusTerrain.y===Number(d.g_FoucsY)&&s;
        })()`);
        assert.equal(state.terrain.source,'full');
        assert.equal(state.terrain.width,native.w);
        assert.equal(state.terrain.height,native.h);
        assert.equal(state.terrain.stride,native.w);
        assert.equal(state.terrain.verified,true,'standard terrain was crosschecked against C occupied-cell getters');
        for(const unit of state.unitList) {
            const real=native.units.find(u=>u.i===unit.i);
            assert.ok(real,'visible unit has actual native slot');
            assert.equal(unit.terrain.index,real.index,'terrain index agrees with compiled C for slot '+real.i);
        }
        const focus=state.focusTerrain;
        assert.equal(focus.raw,native.tiles[focus.y*native.w+focus.x],'focused terrain uses complete native row stride');
        assert.notEqual(focus.kind,'unknown');
        (report.terrainChecks ||= []).push({label,terrain:state.terrain,focus,units:state.unitList.map(u=>({i:u.i,terrain:u.terrain}))});
        return state;
    };
    await inspect('initial focused terrain');
    const own=before.units.find(u=>u.side==='player'&&u.state!==8);
    assert.ok(own);
    await focusBattleTarget(cdp,own,'15-terrain-occupied-1080p',1);
    await inspect('occupied focused terrain');
    const occupied=new Set(native.units.map(u=>u.x+','+u.y));
    const empty=native.tiles.map((raw,i)=>({raw,x:i%native.w,y:Math.floor(i/native.w)}))
        .filter(t=>t.raw>0&&!occupied.has(t.x+','+t.y))
        .sort((a,b)=>(Math.abs(a.x-own.x)+Math.abs(a.y-own.y))-(Math.abs(b.x-own.x)+Math.abs(b.y-own.y)))[0];
    assert.ok(empty,'map has an empty cell');
    await focusBattleTarget(cdp,empty,'15-terrain-empty-1080p',1);
    await inspect('empty focused terrain');
    const stable=await evaluate(cdp,battleStateExpression),keys=await evaluate(cdp,'window.__battleKeys.length');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    await waitFor(cdp,'720p resized canvas','innerWidth===1280&&innerHeight===720&&Math.abs(document.querySelector("#hd-battle-canvas").getBoundingClientRect().width-1280)<1');
    await inspect('720p focused terrain');
    await checkpoint(cdp,'15-terrain-empty-720p');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await waitFor(cdp,'1080p restored canvas','innerWidth===1920&&innerHeight===1080&&Math.abs(document.querySelector("#hd-battle-canvas").getBoundingClientRect().width-1920)<1');
    assert.deepEqual(await evaluate(cdp,battleStateExpression),stable,'viewport changes cannot mutate native battle');
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),keys,'terrain repaint/resize sends no engine input');
    await focusBattleTarget(cdp,native.focus,'15-terrain-focus-restored',1);
    assert.deepEqual((await evaluate(cdp,battleStateExpression)).units,before.units,'terrain focus observation cannot mutate units');
}

async function terrainGallery(cdp) {
    await waitBattle(cdp,1,'idle player selection for terrain fixture');
    const before=await evaluate(cdp,battleStateExpression),keys=await evaluate(cdp,'window.__battleKeys.length');
    // Clearly labelled renderer fixture, separate from native world data. It
    // makes every category inspectable even when this battle lacks some tiles.
    await evaluate(cdp, `(() => {
        const canvas=document.createElement('canvas');canvas.id='terrain-validation-gallery';
        canvas.width=1920;canvas.height=1080;
        canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;pointer-events:none';
        const ctx=canvas.getContext('2d');ctx.fillStyle='#121820';ctx.fillRect(0,0,1920,1080);
        ctx.fillStyle='#e2d8ba';ctx.font='36px BayeUI,sans-serif';ctx.fillText('HD 地形图例 · 标准 LIB 渲染测试',150,95);
        ctx.font='22px BayeUI,sans-serif';ctx.fillStyle='#9daabd';ctx.fillText('此图使用八类地形测试数据，不表示当前战场布局或行动效果。',150,140);
        const raw=[2,1,6,5,4,3,41,16];
        BayeHdBattleTerrain.createPainter().paint(ctx,{ox:150,oy:200,cw:405,ch:320,cols:4,rows:2,viewOx:0,viewOy:0,dpr:1},
            {source:'full',width:4,height:2,stride:4,tiles:raw,libPath:'libs/dat-mod.lib',session:'gallery',mode:'hd',verified:true});
        for(let i=0;i<raw.length;i++) {
            const x=150+(i%4)*405,y=200+Math.floor(i/4)*320;
            ctx.strokeStyle='#8c9189';ctx.lineWidth=2;ctx.strokeRect(x,y,405,320);
            ctx.fillStyle='rgba(12,17,23,0.8)';ctx.fillRect(x,y+268,405,52);
            ctx.font='28px BayeUI,sans-serif';ctx.fillStyle='#f0e5c8';ctx.fillText(BayeHdBattleTerrain.classifyTile(raw[i]).label,x+20,y+304);
        }
        document.body.appendChild(canvas);
    })()`);
    try { await checkpoint(cdp,'35-terrain-eight-class-fixture'); }
    finally { await evaluate(cdp,'document.getElementById("terrain-validation-gallery").remove()'); }
    assert.deepEqual(await evaluate(cdp,battleStateExpression),before,'terrain gallery cannot mutate native game');
    assert.equal(await evaluate(cdp,'window.__battleKeys.length'),keys,'terrain gallery cannot send a game input');
}
async function focusBattleTarget(cdp, target, label, kind = 5) {
    for (let step = 0; step < 128; step++) {
        const focus = await evaluate(cdp, '({x:Number(baye.data.g_FoucsX),y:Number(baye.data.g_FoucsY)})');
        if (focus.x === target.x && focus.y === target.y) {
            const keys = await evaluate(cdp, 'window.__battleKeys.length');
            await delay(250);
            assert.equal(await evaluate(cdp, 'window.__battleKeys.length'), keys, 'target preview cannot confirm or send keys');
            if(kind===5) await verifyNativeFeedback(cdp,label,Number(await evaluate(cdp,'baye.hd.fight().aimType'))===1?'skill':'attack');
            await checkpoint(cdp, label);
            return;
        }
        const direction = focus.x !== target.x ? (focus.x < target.x ? 'ArrowRight' : 'ArrowLeft') :
            (focus.y < target.y ? 'ArrowDown' : 'ArrowUp');
        await key(cdp, direction);
        await waitFor(cdp, 'target cursor native acknowledgement', `(() => {
            const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();
            return f.inputKind===${kind}&&!s.transaction&&
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
    await verifyNativeFeedback(cdp,'ACTION menu after move','inactive');
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
        const p=d.g_GenPos[i],x=Number(p.x),y=Number(p.y),dx=(x-sx)&255,dy=(y-sy)&255;
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
            await waitFor(cdp,'live native skill feedback','BayeHdBattle.debugSnapshot().feedback?.active');
            await verifyNativeFeedback(cdp,'SKILL range '+skill.name,'skill');
            await checkpoint(cdp,'30-skill-range-'+skill.id+'-'+(report.skillRangeCheckpoints=(report.skillRangeCheckpoints||0)+1));
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
    prepareServedAssets();
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
        await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
            // Observe the renderer's actual native Canvas calls. Forward every
            // call unchanged; these records never drive game or layout state.
            window.__battleLegendPaint=[];
            const originalBattleClear=CanvasRenderingContext2D.prototype.clearRect;
            CanvasRenderingContext2D.prototype.clearRect=function(){
                if(this.canvas.id==='hd-battle-canvas')window.__battleLegendPaint=[];
                return originalBattleClear.apply(this,arguments);
            };
            const originalBattleFill=CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText=function(text,x,y){
                if(this.canvas.id==='hd-battle-canvas'&&typeof text==='string'&&
                    ['蓝：己方','红：敌方','待：可行动','已：已行动','行：当前将领'].some(entry=>text.includes(entry))){
                    const r=this.canvas.getBoundingClientRect(),m=this.measureText(text),t=this.getTransform();
                    const sx=r.width/this.canvas.width,sy=r.height/this.canvas.height;
                    const left=(t.a*(x-m.actualBoundingBoxLeft)+t.e)*sx+r.left;
                    const right=(t.a*(x+m.actualBoundingBoxRight)+t.e)*sx+r.left;
                    const top=(t.d*(y-Math.max(0,m.actualBoundingBoxAscent))+t.f)*sy+r.top;
                    const bottom=(t.d*Math.max(y+18,y+m.actualBoundingBoxDescent)+t.f)*sy+r.top;
                    window.__battleLegendPaint.push({text,x,y,font:this.font,baseline:this.textBaseline,align:this.textAlign,
                        metrics:{width:m.width,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent},
                        rect:{left,right,top,bottom,width:right-left,height:bottom-top}});
                }
                return originalBattleFill.apply(this,arguments);
            };
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
        assert.deepEqual(report.requests.filter(request=>request.status>=400),[],'all actual game assets load successfully');
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
