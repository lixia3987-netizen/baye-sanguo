#!/usr/bin/env node
/**
 * Real native SPE displayed-frame and player-input acceptance.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-spe-runtime.mjs --staged
 *   node scripts/test-hd-spe-runtime.mjs --artifact-dir build/spe-runtime-smoke
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
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/spe-runtime-smoke'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream' };
const report = { staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const servedAssets = new Map();

function prepareServedAssets() {
    report.sources = {};
    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map', 'baye.build.json',
        ...fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js')&&n!=='baye.js')]) {
        const base = staged && name.startsWith('baye.') ? path.join(root, 'build/wasm/src') : path.join(root, 'js');
        const filename = path.join(base, name), data = fs.readFileSync(filename);
        const metadata = { source: path.relative(root, filename), bytes: data.length,
            sha256: crypto.createHash('sha256').update(data).digest('hex') };
        report.sources[name] = metadata;
        servedAssets.set('js/' + name, { data, metadata });
    }
    const speManifest = JSON.parse(fs.readFileSync(path.join(root,'assets/hd-spe/manifest.json'),'utf8'));
    const files=['pc.html','css/hd-spe.css','assets/hd-spe/manifest.json',...speManifest.entries.flatMap(e=>e.pictures.map(p=>p.src))];
    for(const name of new Set(files)) {
        const data=fs.readFileSync(path.join(root,name));
        const metadata={source:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
        report.sources[name]=metadata;servedAssets.set(name,{data,metadata});
    }
    const manifest = JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));
    assert.equal(manifest.hdSpeProtocol.version,2,'Build manifest declares actual SPE v2');
    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.equal(report.sources[name].bytes, manifest.artifacts[name].bytes, 'Engine artifact bytes match manifest: ' + name);
        assert.equal(report.sources[name].sha256, manifest.artifacts[name].sha256, 'Engine artifact hash matches manifest: ' + name);
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


// The observer wraps presentation callbacks, never an engine rule or input hook.
const speObserverSource = '(' + function () {
    window.__speSamples = [];
    window.__speHdImages = [];
    window.__speEngineKeys = [];
    window.__speObserverErrors = [];
    window.__spePhase = 'opening';
    let currentApi = null, originalSendKey = null;
    function record(stage) {
        try {
            if (!window.baye || !baye.hd || !baye.hd.ready()) return;
            const spe = baye.hd.spe(), ui = currentApi && currentApi.debugSnapshot();
            window.__speSamples.push({ stage, phase: window.__spePhase, at: performance.now(),
                spe, ui: ui && { open: ui.open, source: ui.source, fallbackReason: ui.fallbackReason,
                    displayedFrames: ui.displayedFrames, flushKey: ui.flushKey,skipVisible:ui.skipVisible,
                    scale:ui.scale,canvasW:ui.canvasW,canvasH:ui.canvasH } });
            if(stage==='lcd-flush'&&spe.active&&spe.kind===2&&spe.id===35&&ui&&ui.source==='hd-assets') {
                const images=window.__speHdImages.filter(x=>x.before.generation===spe.generation&&x.before.eventId===spe.eventId);
                if(images.length<2&&!images.some(x=>x.before.commitSeq===spe.display.commitSeq)) {
                    const before={...spe.display},canvas=document.getElementById('hd-spe-canvas');
                    const dataUrl=canvas.toDataURL('image/png'),after={...baye.hd.spe().display};
                    window.__speHdImages.push({before,after,dataUrl,spe,ui,at:performance.now()});
                }
            }
            if (window.__speSamples.length > 20000) throw new Error('SPE observation limit exceeded');
        } catch (error) { window.__speObserverErrors.push(String(error)); }
    }
    Object.defineProperty(window, 'BayeHdSpe', {
        configurable: true, get() { return currentApi; },
        set(api) {
            currentApi = api;
            for (const name of ['onEngineSpe', 'onLcdFlush']) {
                const original = api[name];
                api[name] = function () {
                    const result = original.apply(this, arguments);
                    record(name === 'onLcdFlush' ? 'lcd-flush' : 'lifecycle');
                    return result;
                };
            }
            if (!originalSendKey && typeof window.sendKey === 'function') {
                originalSendKey = window.sendKey;
                window.sendKey = function (code) {
                    let spe = null, fight = null;
                    try { if (baye.hd.ready()) { spe = baye.hd.spe(); fight = baye.hd.fight(); } } catch {}
                    window.__speEngineKeys.push({ code, at: performance.now(), phase: window.__spePhase,
                        generation: spe && spe.generation, eventId: spe && spe.eventId, kind: spe && spe.kind,
                        speActive:spe&&spe.active,
                        fightKind: fight && fight.inputKind, fightSeq: fight && fight.inputSeq });
                    return originalSendKey.apply(this, arguments);
                };
            }
        }
    });
}.toString() + ')();';

function assertDisplayRecords(records) {
    assert.ok(Array.isArray(records), 'Real SPE observations were captured');
    const displayed = records.filter(r => r.stage === 'lcd-flush' && r.spe.active &&
        r.spe.protocolVersion === 2 && r.spe.display.frameValid);
    for (const record of displayed) {
        const s = record.spe, d = s.display;
        assert.equal(d.generation, s.generation, 'Flushed generation matches its live event');
        assert.equal(d.eventId, s.eventId, 'Flushed event matches its live scope');
        assert.ok(Number.isInteger(d.commitSeq) && d.commitSeq > 0 && d.commitSeq <= s.commitSeq,
            'Displayed commit is an actual copied native commit');
        assert.ok(d.frameIndex >= s.startFrm && d.frameIndex <= s.endFrm, 'Displayed logical frame is in the actual interval');
        assert.equal(d.visibleFrames.length, 32);
        assert.ok(d.visibleFrames.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'Actual visible bitmap contains bytes');
        const frames = [];
        for (let i = 0; i < 256; i++) {
            if (d.visibleFrames[i >> 3] & (1 << (i & 7))) {
                assert.ok(i >= s.startFrm && i <= d.frameIndex && i <= s.endFrm && i < s.count,
                    'Only introduced in-range native picture units are visible');
                frames.push(i);
            }
        }
        if (record.ui.source === 'hd-assets') {
            assert.deepEqual(record.ui.displayedFrames, frames, 'HD slots exactly follow the flushed native bitmap');
        }
    }
    return displayed;
}

async function collectSpe(cdp) {
    const evidence = await evaluate(cdp, '({samples:window.__speSamples,keys:window.__speEngineKeys,errors:window.__speObserverErrors})');
    assert.deepEqual(evidence.errors, [], 'Read-only observer has no errors');
    assertDisplayRecords(evidence.samples);
    return evidence;
}

async function smoke(cdp) {
    await waitFor(cdp, 'SPE v2 ready', 'window.baye && baye.hd && baye.hd.ready() && baye.hd.spe().protocolVersion === 2', 60000);
    await waitFor(cdp, 'at least three actual opening display commits', "(() => { const s=baye.hd.spe(),r=window.__speSamples.filter(r=>r.stage==='lcd-flush'&&r.spe.generation===s.generation&&r.spe.eventId===s.eventId&&r.spe.display.frameValid); return s.active&&s.id===3&&s.kind===1&&new Set(r.map(r=>r.spe.display.commitSeq)).size>=3&&new Set(r.map(r=>r.spe.display.frameIndex)).size>=2; })()", 20000);
    const opening = await evaluate(cdp, 'baye.hd.spe()');
    const evidence = await collectSpe(cdp);
    const frames = evidence.samples.filter(r => r.stage === 'lcd-flush' && r.spe.eventId === opening.eventId && r.spe.display.frameValid);
    assert.ok(new Set(frames.map(r => r.spe.display.commitSeq)).size >= 3, 'Opening has multiple actual displayed commits');
    assert.ok(new Set(frames.map(r => r.spe.display.frameIndex)).size >= 2, 'Opening shows multiple native logical frames');
    assert.equal(opening.skipEligible, true, 'Native opening really accepts a player skip');
    assert.ok(frames.every(r=>r.ui.open&&r.ui.skipVisible),'Actual displayed opening exposes the HD player skip');
    report.opening = { eventId: opening.eventId, generation: opening.generation, displayedCommits: frames.length };
    await checkpoint(cdp, '01-native-opening-frames');
    await click(cdp, '#hd-spe-skip');
    await waitFor(cdp, 'native opening key termination', 'window.__speSamples.some(r=>r.spe.lastEnd.eventId===' + opening.eventId + "&&r.spe.lastEnd.reason==='key'&&r.spe.lastEnd.key===39)");
    const skipped = await collectSpe(cdp);
    const keys = skipped.keys.filter(k => k.generation === opening.generation && k.eventId === opening.eventId);
    assert.deepEqual(keys.map(k => k.code), [0x27], 'One player skip delivers exactly one native Enter');
    await waitFor(cdp, 'opening overlay retired', 'baye.hd.spe().eventId!==' + opening.eventId + ' && !BayeHdSpe.isOpen()');
    report.opening.skip = keys;
    await checkpoint(cdp, '02-opening-ended-cleanly');
    await evaluate(cdp, "BayeHdSystemUi.setMode('classic');window.__spePhase='menus';");
    await waitFor(cdp, 'actual title picture', 'window.__speSamples.some(r=>r.spe.id===100)', 20000);
    await key(cdp, 'Enter');
    await waitFor(cdp, 'actual period picture', 'window.__speSamples.some(r=>r.spe.id===104)');
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real period 1 lord selection', 'baye.data.g_PIdx===1 && baye.hd.kings().count>0');
    const lord = await evaluate(cdp, "(() => {const m=baye.hd.kings();return {target:m.kings.findIndex(k=>k.name==='马腾'),index:m.index,kings:m.kings};})()");
    assert.ok(lord.target >= 0, 'Real period 1 contains Ma Teng');
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'native lord highlight', 'baye.hd.kings().index===' + lord.target);
    report.selectedLord = lord.kings[lord.target];
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', 'baye.hd.march().pick && baye.hd.realm().ownedCount>0');
    await checkpoint(cdp, '03-real-map');
    report.actualLib = await evaluate(cdp, '({preferred:localStorage.getItem("baye/libpath"),hex:window.dynLib})');
    report.actualLib.sha256 = crypto.createHash('sha256').update(Buffer.from(report.actualLib.hex, 'hex')).digest('hex');
    delete report.actualLib.hex;
    await evaluate(cdp, "window.__spePhase='battle';");
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

async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&f;})()`,timeout);
}
const moveTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),out=[];
    const sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY);
    for(let y=0;y<Number(d.g_MapHgt);y++)for(let x=0;x<Number(d.g_MapWid);x++) {
        const px=(x-sx+ux)&255,py=(y-sy+uy)&255;
        if(px<15&&py<15){const v=Number(d.g_FightPath[py*15+px]);if(Number.isInteger(v)&&v>=0&&v<=128)out.push({x,y});}
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
        if(p.state===8||dx<0||dy<0||dx>=size||dy>=size||Number(r[3+dx+dy*size])!==1)continue;
        units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x,y,arms:Number(d.g_Persons[id-1].Arms),terrain:baye.getTerrainByGeneralIndex(i),armType:baye.getArmType(id-1)});
    }
    return units;
})()`;
const skillOptionsExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),skill=baye.hd.skills(),actor=d.g_GenPos[f.actorIndex];
    const terrain=baye.getTerrainByGeneralIndex(f.actorIndex),weather=Number(d.g_FgtWeather)-1;
    const array=(a,n)=>Array.from({length:n},(_,i)=>Number(a[i]));
    return skill.ids.map((id,index)=>{const x=d.g_Skills[id-1];return {id,index,name:skill.names[index],speId:Number(d.dJNSpeId[id-1]),aim:Number(x.aim),state:Number(x.state),power:Number(x.power),destroy:Number(x.destroy),useMp:Number(x.useMp),eland:array(x.eland,8),earm:array(x.earm,6),available:Number(x.useMp)>0&&Number(x.useMp)<=Number(actor.mp)&&Number(x.weather[weather])>0&&Number(x.oland[terrain])>0};});
})()`;
async function endArmyTurn(cdp) {
    const before=await evaluate(cdp,battleStateExpression);
    await action(cdp,'explicit-end-turn-system','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'end-turn actual system menu');
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name);
    await waitActionResolved(cdp,'enemy turn followed by next player input',before.fight.bout);
    const after=await evaluate(cdp,battleStateExpression);
    if(after.fight.over) {
        report.turns??=[];report.turns.push({before,after,ended:true});
        await checkpoint(cdp,'28-real-battle-ended-'+report.turns.length);
        return;
    }
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
    const result=await action(cdp,'confirm-attack-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(result.ok,true);
    await waitActionResolved(cdp,'actual attack resolves');
    const after=await evaluate(cdp,battleStateExpression),enemy=after.units.find(u=>u.i===target.i);
    assert.ok(!enemy||enemy.arms<target.arms,'confirmed normal attack reduces actual enemy troops');
    report.attackCost={actor:actor.name,actorIndex:actor.i,target:target.name,targetIndex:target.i,before,after};
    await checkpoint(cdp,'29-attack-real-troop-cost');
    return true;
}

async function waitActionResolved(cdp,label,afterBout=null) {
    const deadline=Date.now()+60000,accepted=new Set();
    while(Date.now()<deadline) {
        const s=await evaluate(cdp,'({f:baye.hd.fight(),s:baye.hd.spe(),b:BayeHdBattle.debugSnapshot(),d:BayeHdDialog.debugSnapshot()})');
        if(s.f.over||(!s.b.transaction&&s.f.inputKind===1&&!s.s.active&&(afterBout==null||s.f.bout>afterBout)))return s.f;
        // Only an actual waiting report owner permits this explicit player ACK.
        if(s.d.open&&s.d.kind==='report'&&s.d.reportOwner) {
            const owner=JSON.stringify(s.d.reportOwner);
            if(!accepted.has(owner)) {accepted.add(owner);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');}
        }
        await delay(150);
    }
    throw new Error('Timeout: '+label);
}

async function attemptFire(cdp,actor) {
    const name=await evaluate(cdp,'baye.hd.menuItems().names[1]');
    await menuChoice(cdp,name,4);
    const options=await evaluate(cdp,skillOptionsExpression);
    report.fireOptions??=[];report.fireOptions.push({actor:actor.name,options});
    for(const skill of options.filter(s=>s.available&&s.speId===35)) {
        const before=await evaluate(cdp,battleStateExpression),mp=before.units.find(u=>u.i===actor.i).mp;
        await menuChoice(cdp,skill.name);
        await waitFor(cdp,'actual fire targeting','!BayeHdBattle.debugSnapshot().transaction && [1,5].includes(baye.hd.fight().inputKind)');
        let target=null;
        if(await evaluate(cdp,'baye.hd.fight().inputKind===5')) {
            const targets=(await evaluate(cdp,rangedUnitsExpression)).filter(u=>u.arms>0&&
                (Boolean(skill.aim&1)===(u.side==='player'))&&skill.eland[u.terrain]>0&&skill.earm[u.armType]>0);
            target=targets[0];
            if(!target) {
                await action(cdp,'cancel-fire-no-legal-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'actual no-target return');
                await menuChoice(cdp,name,4);continue;
            }
            const result=await action(cdp,'confirm-real-fire-'+skill.name+'-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
            assert.equal(result.ok,true);
        }
        await waitActionResolved(cdp,'actual fire action resolves');
        const after=await evaluate(cdp,battleStateExpression),caster=after.units.find(u=>u.i===actor.i);
        assert.ok(caster,'actual fire caster still exists for MP verification');
        assert.equal(mp-caster.mp,skill.useMp,'Fire consumes the real LIB MP cost');
        report.fireAttempts??=[];report.fireAttempts.push({actor,skill,target,before,after});
        await checkpoint(cdp,'30-real-fire-attempt-'+report.fireAttempts.length);
        return true;
    }
    await action(cdp,'cancel-unavailable-fire','BayeHdBattle.cancel()');await waitBattle(cdp,3,'return from unavailable fire');return false;
}

async function battleSmoke(cdp) {
    report.combatStart=await evaluate(cdp,battleStateExpression);
    // Keep the 100-troop lord at his actual starting tile. The existing battle
    // acceptance uses this same legal rest before approaching with other units.
    const lord=report.combatStart.units.find(u=>u.i===0);
    await chooseGeneral(cdp,lord);
    assert.equal((await action(cdp,'protect-lord-stay-native-tile',`BayeHdBattle.clickTile(${lord.x},${lord.y})`)).ok,true);
    await waitBattle(cdp,3,'lord stays at actual starting tile');
    await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
    // Read-only native masks choose legal targets; every command is a public UI
    // operation a player can issue. No engine fields or private movies are written.
    for(let step=0;step<36;step++) {
        const evidence=await collectSpe(cdp);
        const fire=evidence.samples.filter(r=>r.stage==='lcd-flush'&&r.spe.active&&r.spe.kind===2&&r.spe.id===35&&r.spe.display.frameValid);
        if(report.attackCost&&fire.some(r=>r.ui.source==='hd-assets'))break;
        const current=await evaluate(cdp,battleStateExpression);
        if(current.fight.over)break;
        const actor=current.units.filter(u=>u.side==='player'&&u.active===0&&![8,1,6].includes(u.state)&&u.arms>0)
            .sort((a,b)=>Number(a.i===0)-Number(b.i===0))[0];
        if(!actor) {
            if((report.turns?.length||0)>=4)break;
            await endArmyTurn(cdp);continue;
        }
        const selection=await chooseGeneral(cdp,actor);
        if(selection.inputKind===2) {
            if(actor.i===0) {
                assert.equal((await action(cdp,'keep-lord-protected',`BayeHdBattle.clickTile(${actor.x},${actor.y})`)).ok,true);
                await waitBattle(cdp,3,'lord action menu');
                await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
                continue;
            }
            const candidates=await evaluate(cdp,moveTilesExpression),enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);
            if(!enemies.length)break;
            const distance=p=>Math.min(...enemies.map(u=>Math.abs(p.x-u.x)+Math.abs(p.y-u.y)));
            const target=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8)).sort((a,b)=>distance(a)-distance(b))[0];
            assert.ok(target,'A genuinely legal unoccupied move tile exists');
            const moved=await action(cdp,'approach-native-path-'+actor.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
            assert.equal(moved.ok,true);await waitBattle(cdp,3,'native action menu after movement');
        }
        if(!report.attackCost&&await attemptAttack(cdp,actor))continue;
        if(await attemptFire(cdp,actor))continue;
        const rest=await evaluate(cdp,'baye.hd.menuItems().names[3]');await menuChoice(cdp,rest,1);
    }
    const evidence=await collectSpe(cdp),displayed=assertDisplayRecords(evidence.samples);
    const actualAttacks=displayed.filter(r=>r.spe.kind===3&&r.spe.contextKnown&&Number.isInteger(r.spe.actorIndex)&&Number.isInteger(r.spe.targetIndex));
    const first=report.attackCost?actualAttacks.find(r=>r.spe.actorIndex===report.attackCost.actorIndex&&r.spe.targetIndex===report.attackCost.targetIndex):actualAttacks[0];
    assert.ok(first,'A real player or naturally acting enemy attack produced an authoritative SPE event');
    const attack=actualAttacks.filter(r=>r.spe.generation===first.spe.generation&&r.spe.eventId===first.spe.eventId);
    assert.ok(attack.length>=2,'The actual attack produced multiple displayed SPE frames');
    const attackEvent=attack[0].spe.eventId;
    assert.ok(new Set(attack.map(r=>r.spe.display.commitSeq)).size>=2,'Attack displayed distinct native commits');
    assert.ok(evidence.samples.some(r=>r.spe.lastEnd.eventId===attackEvent),'Actual attack event has an observed end');
    assert.ok(!await evaluate(cdp,'BayeHdSpe.isOpen()'),'Combat SPE overlay is retired after the actual event');
    assert.deepEqual(evidence.keys.filter(k=>k.speActive&&[2,3].includes(k.kind)),[],'Battle presentation delivers zero automatic or skip keys');
    assert.ok(displayed.filter(r=>[2,3].includes(r.spe.kind)).every(r=>!r.spe.skipEligible&&!r.ui.skipVisible),'Unskippable combat events have no player skip control');
    report.attackSpe={eventId:attackEvent,actorIndex:first.spe.actorIndex,targetIndex:first.spe.targetIndex,
        actorSide:first.spe.actorIndex<10?'player':'enemy',playerTroopCostVerified:!!report.attackCost,
        displayedCommits:attack.length,source:[...new Set(attack.map(r=>r.ui.source))]};
    const fire=displayed.filter(r=>r.spe.kind===2&&r.spe.id===35),hd=fire.filter(r=>r.ui.source==='hd-assets');
    report.fireCoverage={observed:fire.length>0,hdAssetsObserved:hd.length>0,
        displayedCommits:fire.length,events:[...new Set(fire.map(r=>r.spe.eventId))],
        hdVisibleFrames:hd.map(r=>({eventId:r.spe.eventId,commitSeq:r.spe.display.commitSeq,frames:r.ui.displayedFrames})),
        reason:hd.length?'actual-native-fire-displays':fire.length?'native-fire-observed-with-lcd-fallback':'no-legally-observed-fire-in-bounded-player-flow'};
    const images=await evaluate(cdp,'window.__speHdImages');
    report.fireCanvasImages=[];
    for(let i=0;i<images.length;i++) {
        const image=images[i];
        assert.deepEqual(image.after,image.before,'Canvas PNG capture stays within its actual native displayed stamp');
        assert.equal(image.ui.source,'hd-assets');
        const filename='fire-35-native-frame-'+image.before.frameIndex+'-'+i+'.png';
        const data=Buffer.from(image.dataUrl.split(',')[1],'base64');
        fs.writeFileSync(path.join(artifactDir,filename),data);delete image.dataUrl;
        report.fireCanvasImages.push({...image,file:filename,sha256:crypto.createHash('sha256').update(data).digest('hex'),
            baselineArena:{x:15,y:16,width:130,height:64},
            expectedNativeOriginOnCanvas:{x:(image.spe.x-15)*image.ui.scale,y:(image.spe.y-16)*image.ui.scale}});
    }
    if(hd.length>=2)assert.ok(images.length>=2,'Two real native HD fire display frames have matching-stamp canvas PNGs');
    report.combatEnd=await evaluate(cdp,battleStateExpression);
    await checkpoint(cdp,'31-real-combat-spe-evidence');
}
async function main() {
    fs.mkdirSync(artifactDir, { recursive: true });
    prepareServedAssets();
    if (typeof WebSocket !== 'function') throw new Error('Node 22+ is required for built-in WebSocket');
    if (staged) for (const filename of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.ok(fs.existsSync(path.join(root, 'build/wasm/src', filename)), 'Missing staged WASM file: ' + filename);
    }
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'baye-spe-runtime-'));
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
        const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
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
            localStorage.clear();
            localStorage.setItem('baye/libpath', 'libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode', 'classic');
            localStorage.setItem('baye/systemUiMode', 'hd');
            localStorage.setItem('baye/cityMenuMode', 'classic');
        ` });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: speObserverSource });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        await smoke(cdp);
        report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');
        report.speObservations=await evaluate(cdp,'window.__speSamples');
        assertDisplayRecords(report.speObservations);
        assert.deepEqual(report.exceptions, [], 'browser has no uncaught exceptions');
        assert.deepEqual(report.dialogs, [], 'game boot has no unexpected alert dialogs');
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = error.stack || String(error);
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression);report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');report.speObservations=await evaluate(cdp,'window.__speSamples'); } catch {}
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
        assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()), 'Temporary profile stays in the OS temp directory');
        assert.ok(path.basename(profile).startsWith('baye-spe-runtime-'), 'Cleanup targets only this task profile');
        fs.rmSync(profile, { recursive: true, force: true });
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Real native SPE browser acceptance passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
