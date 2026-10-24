#!/usr/bin/env node
/**
 * Real Chromium + shipped LIB/WASM smoke, with no npm/browser dependencies.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-runtime.mjs
 *   node scripts/test-hd-runtime.mjs --staged --artifact-dir build/runtime-smoke
 * --staged serves build/wasm/src/baye.{js,wasm,wasm.map} without replacing js/.
 * --performance records map rendering, real tab visibility and native quantity ACK latency.
 * --renderer-dir compares archived overworld/battle/terrain renderers under the same measurement.
 * --input-dir serves only archived lcd.js, hd-city-menu.js, hd-dialog.js and bridge.js.
 * --engine-dir serves an archived four-file WASM build; mutually exclusive with --staged.
 * --library-identity additionally boots genuine IndexedDB LIB caches under mismatched preferred URLs.
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
import crypto from 'node:crypto';
import { summarizeSamples, summarizeFrames } from './hd-performance-metrics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staged = process.argv.includes('--staged');
const performanceMode = process.argv.includes('--performance');
const libraryIdentityMode = process.argv.includes('--library-identity');
const cityHudMode = libraryIdentityMode || process.argv.includes('--city-hud');
const directoryArgument = (flag) => {
    const index = process.argv.indexOf(flag);
    if (index < 0) return null;
    const value = process.argv[index + 1];
    assert.ok(value && !value.startsWith('--'), flag + ' requires a directory');
    return path.resolve(value);
};
const rendererDir = directoryArgument('--renderer-dir');
const inputDir = directoryArgument('--input-dir');
const engineDir = directoryArgument('--engine-dir');
assert.ok(!rendererDir || performanceMode, '--renderer-dir requires --performance');
assert.ok(!(staged && engineDir), '--engine-dir and --staged are mutually exclusive');
const artifactDir = directoryArgument('--artifact-dir') || path.join(root, 'build/runtime-smoke');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.lib': 'application/octet-stream' };
const report = { staged, libraryIdentityMode, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], nativeDialogs: [], blocked: [], requests: [] };
const engineNames = ['baye.js', 'baye.wasm', 'baye.wasm.map', 'baye.build.json'];
const inputNames = ['lcd.js', 'hd-city-menu.js', 'hd-dialog.js', 'bridge.js', 'idbkvstore.min.js'];
const rendererNames = ['hd-overworld.js', 'hd-battle.js', 'hd-battle-terrain.js', 'hd-battle-feedback.js'];
const identityNames = ['hd-lib-identity.js', 'hd-portraits.js', 'hd-spe.js'];
const servedAssets = new Map();
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function prepareServedAssets() {
    report.sources = {};
    for (const [group, names, directory] of [
        ['engine', engineNames, engineDir || (staged ? path.join(root, 'build/wasm/src') : path.join(root, 'js'))],
        ['inputs', inputNames, inputDir || path.join(root, 'js')],
        ['renderers', rendererNames, rendererDir || path.join(root, 'js')],
        ['identityConsumers', identityNames, path.join(root, 'js')]
    ]) {
        report.sources[group] = {};
        for (const name of names) {
            const filename = path.join(directory, name);
            // Earlier archived renderers may predate support modules. Freeze
            // empty scripts rather than silently mix current modules into them.
            if (group === 'renderers' && rendererDir && ['hd-battle-terrain.js', 'hd-battle-feedback.js'].includes(name) && !fs.existsSync(filename)) {
                const data = Buffer.from('/* Archived renderer predates ' + name + '. */\n');
                const metadata = { source: path.relative(root, filename), absentInArchive: true, bytes: data.length, sha256: sha256(data) };
                report.sources[group][name] = metadata;
                servedAssets.set('js/' + name, { data, metadata });
                continue;
            }
            assert.ok(fs.existsSync(filename), 'Missing ' + group + ' file: ' + filename);
            const data = fs.readFileSync(filename);
            const metadata = { source: path.relative(root, filename), bytes: data.length, sha256: sha256(data) };
            report.sources[group][name] = metadata;
            // Snapshot exactly the bytes whose hashes are reported, so edits or
            // subsequent builds cannot silently change a running comparison.
            servedAssets.set('js/' + name, { data, metadata });
        }
    }
    report.engineManifest = JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));
    for (const name of engineNames.filter(name => name !== 'baye.build.json')) {
        const actual = report.sources.engine[name], declared = report.engineManifest.artifacts?.[name];
        assert.ok(declared, 'Engine manifest declares artifact: ' + name);
        assert.equal(actual.bytes, declared.bytes, 'Served engine bytes match manifest: ' + name);
        assert.equal(actual.sha256, declared.sha256, 'Served engine hash matches manifest: ' + name);
    }
    report.sources.presentation = {};
    for (const name of ['pc.html', 'css/hd-city-menu.css', 'css/hd-dialog.css', 'css/hd-overworld.css', 'css/hd-portraits.css',
        'assets/hd-overworld/manifest.json', 'assets/hd-overworld/china-lcc-cities.json', 'assets/hd-overworld/roads/adjacency.json',
        'assets/hd-portraits/manifest.json', 'assets/hd-portraits/refs/index.json', 'assets/hd-spe/manifest.json',
        'libs/dat-mod.lib', 'libs/sc-mod.lib']) {
        const data = fs.readFileSync(path.join(root, name));
        const metadata = { source: name, bytes: data.length, sha256: sha256(data) };
        servedAssets.set(name, { data, metadata });
        report.sources.presentation[name] = metadata;
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
            const base = root;
            const filename = path.resolve(base, rel);
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
        libraryIdentity: window.BayeHdLibIdentity && BayeHdLibIdentity.read(),
        battle: window.BayeHdBattle && BayeHdBattle.debugSnapshot(),
        bodyClass: document.body.className, lastHdCall: window.__bayeLastHdCall
    };
})()`;

async function checkpoint(cdp, name) {
    const state = await evaluate(cdp, snapshotExpression);
    report.phases.push({ name, ...state });
    console.log('PASS', name);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(image.data, 'base64'));
    return state;
}

async function key(cdp, name) {
    const codes = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, h: 72 };
    assert.ok(codes[name], 'Supported physical key: ' + name);
    const code = name === 'h' ? 'KeyH' : name;
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await delay(180);
}

async function clickPoint(cdp, selector) {
    const point = await evaluate(cdp, `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block: 'center' });
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    assert.ok(point, 'Visible click target: ' + selector);
    return point;
}

async function click(cdp, selector) {
    const point = await clickPoint(cdp, selector);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await delay(250);
}

async function smoke(cdp) {
    await waitFor(cdp, 'real LIB/WASM initialization', 'window.baye && baye.hd && baye.hd.ready()', 60000);
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
        const target = menu.kings.findIndex((person) => person.name === '曹操');
        return { target: target < 0 ? 0 : target, index: menu.index, kings: menu.kings };
    })()`);
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'real lord highlight', `baye.hd.kings().index === ${lord.target}`);
    report.selectedLord = lord.kings[lord.target];
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', `baye.hd.march().pick && baye.hd.realm().ownedCount > 0`);
    await checkpoint(cdp, '05-classic-map');

    const toggles = await evaluate(cdp, `(() => {
        const own = () => Object.prototype.hasOwnProperty.call(baye.hooks, 'fightOpenMainMenu');
        const before = baye.hooks.fightOpenMainMenu;
        BayeHdBattle.setMode('hd');
        const installed = typeof baye.hooks.fightOpenMainMenu === 'function' && baye.hooks.fightOpenMainMenu !== before;
        BayeHdBattle.setMode('classic');
        const state = BayeHdBattle.debugSnapshot();
        return { installed, restored: baye.hooks.fightOpenMainMenu === before, own: own(),
            control: baye.data.g_hdFightMenuControl, queue: state.queueLen, open: state.open, sending: state.sending };
    })()`);
    assert.equal(toggles.installed, true, 'HD mode installs its hook synchronously');
    assert.equal(toggles.restored, true, 'classic restores the exact prior hook synchronously');
    assert.equal(toggles.own, false);
    assert.equal(toggles.control, 0);
    assert.equal(toggles.open, false);
    assert.equal(toggles.queue, 0);
    report.battleMode = toggles;
    await delay(500);
    assert.equal(await evaluate(cdp, 'Object.prototype.hasOwnProperty.call(baye.hooks, "fightOpenMainMenu")'), false, 'polling cannot reinstall a classic battle hook');
    await checkpoint(cdp, '06-battle-mode-restored');

    const portraits = await evaluate(cdp, `(async () => {
        await BayeHdPortraits.loadManifest();
        const valid = await BayeHdPortraits.chooseSource(2, 1);
        const lib = localStorage.getItem('baye/libpath');
        let preferredPathChanged;
        try { localStorage.setItem('baye/libpath', 'libs/sc-mod.lib'); preferredPathChanged = await BayeHdPortraits.chooseSource(2, 1); }
        finally { localStorage.setItem('baye/libpath', lib); }
        return { valid, preferredPathChanged, identity: BayeHdLibIdentity.read(), name: baye.getPersonName(2), promiseIsNative: /native code/.test(String(window.Promise)) };
    })()`);
    assert.equal(portraits.valid.mode, 'ref');
    assert.equal(portraits.valid.url, 'assets/hd-portraits/refs/period-1/2-袁绍.png');
    assert.equal(portraits.name, '袁绍');
    assert.equal(portraits.preferredPathChanged.mode, 'ref', 'unchanged actual dictionary bytes retain their matching reference under another preferred path');
    assert.equal(portraits.preferredPathChanged.url, portraits.valid.url);
    assert.equal(portraits.identity.status, 'ready');
    assert.equal(portraits.identity.sha256, '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    assert.equal(portraits.promiseIsNative, false, 'portrait awaits work under the engine Promise callback shim');
    report.portraits = portraits;
    await checkpoint(cdp, '07-portraits');

    await quantitySmoke(cdp);
}

async function quantitySmoke(cdp) {
    // Enter through the player's HD map/city menu; never call NumOperate or
    // fabricate g_hdQtyActive, person lists, money, troops or battle results.
    await evaluate(cdp, `(() => {
        BayeHdOverworld.setMode('hd-map');
        BayeHdCityMenu.setMode('hd');
    })()`);
    if (performanceMode) await measureMapPerformance(cdp);
    const owned = await waitFor(cdp, 'owned HD map city', `(() => {
        const map = BayeHdOverworld.debugSnapshot();
        return map.phase === 'map' && map.owned.length && map.owned[0];
    })()`);
    const legend = await waitFor(cdp, 'visible map legend', `(() => {
        const legend = document.getElementById('hd-overworld-legend');
        if (!legend || getComputedStyle(legend).display !== 'flex') return false;
        const labels = ['owned', 'neutral', 'empty'].map(kind => document.getElementById('hd-overworld-legend-' + kind).textContent);
        if (labels.some(label => !label)) return false;
        const cities = BayeHdOverworld.getCities(), king = Number(baye.data.g_PlayerKing) + 1;
        return {
            count: cities.length,
            owned: cities.filter(city => Number(city.city.Belong) === king).length,
            neutral: cities.filter(city => Number(city.city.Belong) !== 0 && Number(city.city.Belong) !== king).length,
            unowned: cities.filter(city => Number(city.city.Belong) === 0).length,
            labels,
            roadLabel: legend.querySelector('.hd-overworld-legend-road').textContent,
            pointerEvents: getComputedStyle(legend).pointerEvents
        };
    })()`);
    assert.equal(legend.count, 38, 'original LIB keeps all 38 city anchors');
    assert.deepEqual(legend.labels, ['己方 ' + legend.owned, '其他势力 ' + legend.neutral, '无主城 ' + legend.unowned]);
    assert.equal(legend.owned + legend.neutral + legend.unowned, legend.count);
    assert.equal(legend.pointerEvents, 'none', 'legend cannot intercept map clicks');
    assert.equal(legend.roadLabel, '装饰道路，出征目标以引擎为准');
    report.mapLegend = legend;
    await checkpoint(cdp, '07-hd-map-legend');
    const opened = await evaluate(cdp, `BayeHdOverworld.walkToCity(${owned.i})`);
    assert.ok(opened, 'open an actual player-owned city through the map API');
    await waitFor(cdp, 'real city root menu', `BayeHdCityMenu.isOpen() && BayeHdCityMenu.getLayer() === 'root' && baye.hd.menuItems().names[0] === '内政'`);
    await checkpoint(cdp, '08-hd-city');
    if (cityHudMode) await cityStatusSmoke(cdp, owned.i);
    await click(cdp, '#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp, 'real military submenu', `BayeHdCityMenu.getLayer() === 'sub' && baye.hd.menuItems().names[0] === '侦察'`);
    await click(cdp, '#hd-city-menu [data-hd-sub="1"]');
    await waitFor(cdp, 'real enlist person picker', `(() => {
        const city = BayeHdCityMenu.debugSnapshot();
        return city.layer === 'deep' && city.deepLabel === '征兵' && city.deepItems.length > 0;
    })()`);
    if (cityHudMode) await personDetailsSmoke(cdp, owned.i);
    await click(cdp, '#hd-city-menu [data-hd-deep="0"]');
    const initial = await waitFor(cdp, 'real enlist quantity input', `(() => {
        const q = baye.hd.qty();
        return q.active && q.min === 0 && q.max > 11 && BayeHdCityMenu.isQtyLive() && q;
    })()`);
    report.quantity = { city: owned, initial, steps: [] };
    await checkpoint(cdp, '09-enlist-quantity');

    await evaluate(cdp, `(() => {
        window.__runtimeKeys = [];
        window.__runtimeOriginalSendKey = sendKey;
        window.sendKey = function (code) {
            window.__runtimeKeys.push(code);
            return window.__runtimeOriginalSendKey.apply(this, arguments);
        };
    })()`);
    try {
        // Real mouse clicks exercise the shared city/dialog controller. Resolve
        // the visible presentation for each step, since an HD dialog may cover
        // the inline city quantity buttons.
        let expected = initial.value;
        for (const delta of [-1, -10, 1, 10]) {
            const selector = await evaluate(cdp, `BayeHdDialog.isQtyOpen() ? '#hd-dialog [data-hd-qty="${delta}"]' : '#hd-city-menu [data-hd-qty="${delta}"]'`);
            await click(cdp, selector);
            expected = Math.max(initial.min, Math.min(initial.max, expected + delta));
            const q = await waitFor(cdp, 'exact quantity change ' + delta, `(() => {
                const q = baye.hd.qty(), city = BayeHdCityMenu.debugSnapshot();
                return q.active && q.value === ${expected} && city.queueLen === 0 && !city.sending && q;
            })()`);
            report.quantity.steps.push({ delta, value: q.value });
        }
        assert.equal(expected, initial.max, 'enlist input returns to its upper bound');
        await quantityOrderingSmoke(cdp, initial);
        if (performanceMode) await measureQuantityPerformance(cdp, initial);
        const bounded = await evaluate(cdp, `(() => {
            const before = window.__runtimeKeys.length;
            BayeHdCityMenu.stepQty(10);
            return { before, after: window.__runtimeKeys.length, value: baye.hd.qty().value };
        })()`);
        await delay(100);
        assert.equal(bounded.value, initial.max, 'stepping above max keeps the engine bound');
        assert.equal(await evaluate(cdp, 'window.__runtimeKeys.length'), bounded.before, 'a clamped step queues no engine keys');
        // Keep a genuine queued operation pending, then cancel through the same
        // public player action as the Back button. No pending step may leak into
        // the next person picker after the actual engine EXIT.
        const canceled = await evaluate(cdp, `(() => {
            for (let i = 0; i < 8; i++) BayeHdCityMenu.stepQty(-10);
            BayeHdCityMenu.cancelQty();
            return { count: window.__runtimeKeys.length, keys: window.__runtimeKeys.slice() };
        })()`);
        assert.equal(canceled.keys.at(-1), 0x28, 'cancellation delivers engine EXIT');
        await waitFor(cdp, 'quantity cancellation reaches the real engine', '!baye.hd.qty().active');
        await delay(500);
        const afterCancel = await evaluate(cdp, `({ count: window.__runtimeKeys.length, city: BayeHdCityMenu.debugSnapshot() })`);
        assert.equal(afterCancel.count, canceled.count, 'canceled quantity queue sends no later keys');
        assert.equal(afterCancel.city.queueLen, 0);
        assert.equal(afterCancel.city.sending, false);
        report.quantity.canceledKeys = canceled.keys;
        await checkpoint(cdp, '10-quantity-cancel');
        await quantityPendingConfirmSmoke(cdp, owned.i);
    } finally {
        await evaluate(cdp, `window.sendKey = window.__runtimeOriginalSendKey; delete window.__runtimeOriginalSendKey;`);
    }
}

async function quantityPendingConfirmSmoke(cdp, cityIndex) {
    const chooser = await waitFor(cdp, 'real enlist person picker after quantity cancellation', `(() => {
        const c=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();
        return c.layer==='deep'&&c.deepLabel==='征兵'&&c.deepItems.length&&m.active&&m.kind===3&&c;
    })()`);
    const nativePicker = await evaluate(cdp, `(() => {
        const d=baye.data,c=d.g_Cities[${cityIndex}],menu=baye.hd.menuItems();
        // Mirror GetCityPersons' read-only filtering, including U16 queue IDs.
        // A city also contains out-of-office residents absent from this picker.
        const people=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
            .filter(i=>Number(d.g_Persons[i].Belong)===Number(c.Belong))
            .map(i=>({personIndex:i,name:baye.getPersonName(i)}));
        return {menu,people};
    })()`);
    assert.deepEqual(nativePicker.people.map(person=>person.name),nativePicker.menu.names,'complete native enlist menu agrees with the actual allied PersonQueue order');
    assert.equal(chooser.deepItems[0].name,nativePicker.people[0]?.name,'visible first enlist choice agrees with the genuine native general');
    const personIndex = Number(nativePicker.people[0]?.personIndex);
    assert.ok(Number.isInteger(personIndex) && personIndex >= 0, 'enlist selection has a genuine PersonQueue identity');
    const world = `(() => {
        const d=baye.data,c=d.g_Cities[${cityIndex}],p=d.g_Persons[${personIndex}];
        return {cityIndex:${cityIndex},personIndex:${personIndex},money:Number(c.Money),reserve:Number(c.MothballArms),
            arms:Number(p.Arms),thew:Number(p.Thew),armsPerMoney:Number(d.g_engineConfig.armsPerMoney),
            persons:Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])),
            orders:Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)===24&&Number(o.City)===${cityIndex}&&Number(o.Person)===${personIndex})
                .map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),TimeCount:Number(o.TimeCount)}))};
    })()`;
    const before = await evaluate(cdp, world);
    assert.ok(before.armsPerMoney>0, 'enlist cost comes from the native engine configuration');
    assert.ok(before.persons.includes(personIndex), 'selected recruiter is actually in the city');
    await click(cdp, '#hd-city-menu [data-hd-deep="0"]');
    const initial = await waitFor(cdp, 'reopened native enlist quantity', `(() => {
        const q=baye.hd.qty();return q.active&&q.value===q.max&&q.max>10&&BayeHdCityMenu.isQtyLive()&&q;
    })()`);
    const quantity=initial.value-10;
    assert.ok(before.reserve+quantity<=65535, 'fixture stays below native reserve overflow limits');
    const stepSelector=await evaluate(cdp, `BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-qty="-10"]':'#hd-city-menu [data-hd-qty="-10"]'`);
    const confirmSelector=await evaluate(cdp, `BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'`);
    const stepPoint=await clickPoint(cdp,stepSelector),confirmPoint=await clickPoint(cdp,confirmSelector);
    const startKeys=await evaluate(cdp, `(() => {
        window.__runtimePendingConfirm={stepTrusted:false,confirmTrusted:false,pendingAtConfirm:false};
        window.__runtimePendingClick=function(event){
            const target=event.target;if(!target.closest)return;
            if(target.closest(${JSON.stringify(stepSelector)}))window.__runtimePendingConfirm.stepTrusted=event.isTrusted;
            if(target.closest(${JSON.stringify(confirmSelector)})){
                const c=BayeHdCityMenu.debugSnapshot();window.__runtimePendingConfirm.confirmTrusted=event.isTrusted;
                window.__runtimePendingConfirm.pendingAtConfirm=!!(c.sending||c.queueLen);
                window.__runtimePendingConfirm.atConfirm={qty:{...baye.hd.qty()},queueLen:c.queueLen,sending:c.sending};
            }
        };document.addEventListener('click',window.__runtimePendingClick,true);return window.__runtimeKeys.length;
    })()`);
    // Queue all four ordered CDP events without a host pause, so confirmation
    // reaches the real DOM while the -10 native-key sequence is still pending.
    await Promise.all([
        cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...stepPoint,button:'left',clickCount:1}),
        cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...stepPoint,button:'left',clickCount:1}),
        cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...confirmPoint,button:'left',clickCount:1}),
        cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...confirmPoint,button:'left',clickCount:1})
    ]);
    const interaction=await evaluate(cdp,`(() => {
        document.removeEventListener('click',window.__runtimePendingClick,true);delete window.__runtimePendingClick;
        return window.__runtimePendingConfirm;
    })()`);
    assert.equal(interaction.stepTrusted,true,'pending step is a trusted player click');
    assert.equal(interaction.confirmTrusted,true,'pending confirmation is a trusted player click');
    assert.equal(interaction.pendingAtConfirm,true,'confirmation really occurs with native quantity keys pending');
    await waitFor(cdp,'pending quantity commits exactly the selected native enlist amount',`(() => {
        const c=baye.data.g_Cities[${cityIndex}],q=baye.hd.qty(),ui=BayeHdCityMenu.debugSnapshot();
        if(ui.qtyAckFailed)throw new Error('Native quantity ACK failed: '+ui.qtyAckError);
        return !q.active&&Number(c.MothballArms)===${before.reserve+quantity}&&!ui.sending&&!ui.queueLen;
    })()`);
    const after=await evaluate(cdp,world),keys=await evaluate(cdp,`window.__runtimeKeys.slice(${startKeys})`);
    assert.equal(keys.filter(code=>code===0x27).length,1,'pending quantity confirmation emits exactly one native ENTER');
    assert.equal(keys.at(-1),0x27,'no quantity key follows the committing ENTER');
    assert.equal(after.reserve,before.reserve+quantity,'native enlist adds exactly the queued amount to city reserves');
    assert.equal(after.money,before.money-Math.floor(quantity/before.armsPerMoney),'native enlist charges the actual configured money cost');
    assert.equal(after.arms,before.arms,'enlist reserves preserve the selected general’s existing personal troops');
    assert.equal(after.orders.length,before.orders.length+1,'native enlist creates exactly one order for the selected general');
    assert.deepEqual(after.persons.slice().sort((a,b)=>a-b),before.persons.filter(i=>i!==personIndex).sort((a,b)=>a-b),'native enlist removes exactly its assigned general from the resident queue');
    await delay(500);
    assert.equal(await evaluate(cdp,'window.__runtimeKeys.length'),startKeys+keys.length,'committed quantity leaves no stale queued keys');
    report.quantity.pendingConfirm={nativePicker,initial,quantity,interaction,before,after,keys};
    await checkpoint(cdp,'quantity-pending-confirm-real-enlist-order');

    const seen=new Set(),deadline=Date.now()+30000;
    while(Date.now()<deadline) {
        const state=await evaluate(cdp,snapshotExpression);
        if(state.march?.pick&&!state.march.battlePick&&!state.menu?.active&&!state.dialog?.open) {
            await checkpoint(cdp,'quantity-enlist-return-to-map');return;
        }
        if(state.menu?.active&&state.menu.context===1&&!seen.has(state.menu.seq)) {
            seen.add(state.menu.seq);await key(cdp,'Escape');
        } else if(state.dialog?.open&&state.dialog.kind==='report')await click(cdp,'#hd-dialog [data-hd-dlg-ok]');
        await delay(150);
    }
    throw new Error('Native enlist quantity scenario did not return to the strategy map');
}

async function quantityOrderingSmoke(cdp, initial) {
    const settle = async (expected, description) => waitFor(cdp, description, `(() => {
        const q=baye.hd.qty(),c=BayeHdCityMenu.debugSnapshot();
        if(c.qtyAckFailed)throw new Error('Native quantity ACK failed: '+c.qtyAckError);
        return q.active&&q.value===${expected}&&!c.sending&&!c.queueLen&&q;
    })()`);
    const sameSession = (before, after) => {
        if (before.protocol) {
            assert.equal(after.session, before.session, 'queued operations stay in the genuine NumOperate session');
            assert.equal(after.ready, 1, 'quantity is back at the native input wait');
        }
    };
    let before = await evaluate(cdp, 'baye.hd.qty()');
    await evaluate(cdp, '[ -10, 10, -10, 10 ].forEach(delta=>BayeHdCityMenu.stepQty(delta))');
    let after = await settle(initial.max, 'rapid opposite quantity steps preserve FIFO');
    sameSession(before, after);
    report.quantity.rapidSteps = { deltas: [-10, 10, -10, 10], before, after };

    // HELP is the actual H keyboard shortcut handled by NumOperate. It toggles
    // bounds without issuing an order or assigning any native quantity field.
    await key(cdp, 'h');
    before = await settle(initial.min, 'native H shortcut selects the quantity minimum');
    const count = await evaluate(cdp, 'window.__runtimeKeys.length');
    await evaluate(cdp, 'BayeHdCityMenu.stepQty(-10);BayeHdCityMenu.stepQty(-1)');
    after = await settle(initial.min, 'lower-bound steps are no-ops');
    assert.equal(await evaluate(cdp, 'window.__runtimeKeys.length'), count, 'clamped lower-bound steps send no native keys');
    sameSession(before, after);
    report.quantity.lowerBound = { before, after };
    await key(cdp, 'h');
    await settle(initial.max, 'native H shortcut restores the maximum');

    // At units, native RIGHT is a cursor no-op. Its receipt still advances the
    // native character-input sequence; no value-change shortcut can prove ACK.
    before = await evaluate(cdp, 'baye.hd.qty()');
    await key(cdp, 'ArrowRight');
    after = await settle(initial.max, 'native cursor no-op completes');
    sameSession(before, after);
    if (before.protocol) {
        assert.equal(after.inputSeq, ((before.inputSeq + 1) >>> 0) || 1, 'cursor no-op has a genuine character receipt');
        assert.equal(after.lastKey, 0x25);
        assert.equal(after.cursor, before.cursor);
    }
    report.quantity.cursorNoop = { before, after };

    // C's digit position is its existing visual cursor bit. Select the current
    // digit, then immediately enqueue -1/+1: the first key deliberately leaves
    // the number unchanged, but must receive native ACK before either step.
    before = after;
    const cursor = before.protocol ? before.cursor : String(initial.max).length - 1;
    const digit = Math.floor(before.value / 10 ** cursor) % 10;
    const keysBefore = await evaluate(cdp, 'window.__runtimeKeys.length');
    await evaluate(cdp, `BayeHdCityMenu.digitQty(${digit});BayeHdCityMenu.stepQty(-1);BayeHdCityMenu.stepQty(1)`);
    after = await settle(initial.max, 'same-value digit and subsequent steps receive ordered native input');
    sameSession(before, after);
    const keys = await evaluate(cdp, `window.__runtimeKeys.slice(${keysBefore})`);
    assert.equal(keys[0], 0x40 + digit, 'digit is dispatched before its queued steps');
    if (before.protocol && !inputDir) {
        assert.deepEqual(keys,[0x40+digit,0x23,0x22],'native fast path dispatches exactly the digit and two unit steps');
        let sequence = before.inputSeq;
        for (let i=0;i<3;i++) sequence=((sequence+1)>>>0)||1;
        assert.equal(after.inputSeq, sequence, 'unchanged digit has its own native receipt');
        assert.equal(after.lastKey, 0x22);
    }
    report.quantity.digitThenSteps = { digit, before, after, keys };
    await checkpoint(cdp, 'quantity-ordered-input-and-noop-receipts');
}

const hudRows = details => Object.fromEntries(details.groups.flatMap(group => group.rows));
async function hudLcdComparison(cdp) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const nativeBefore = await evaluate(cdp, 'baye.hd.menuItems()');
    await click(cdp, '#hd-city-menu [data-hd-menu-lcd]');
    await delay(750); // Several normal render polls must preserve the explicit request.
    const geometry = await evaluate(cdp, `(() => {
        const stage=document.querySelector('#hd-city-menu .hd-city-menu-stage'),lcd=document.getElementById('lcd');
        const s=stage.getBoundingClientRect(),r=lcd.getBoundingClientRect(),style=getComputedStyle(lcd);
        return {stage:{left:s.left,right:s.right,top:s.top,bottom:s.bottom},lcd:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
            visible:style.visibility==='visible'&&style.display!=='none',mode:document.documentElement.getAttribute('data-baye-city-lcd')};
    })()`);
    assert.equal(geometry.mode, 'on');
    assert.equal(geometry.visible, true);
    assert.ok(geometry.stage.right <= geometry.lcd.left, 'explicit LCD comparison has reserved space beside the HD panel');
    assert.ok(geometry.lcd.right <= 1280 && geometry.lcd.bottom <= 720);
    assert.deepEqual(await evaluate(cdp, 'baye.hd.menuItems()'), nativeBefore, 'comparison does not change native menu or selection');
    await checkpoint(cdp, 'hud-person-explicit-lcd-1280x720');
    await click(cdp, '#hd-city-menu [data-hd-menu-lcd]');
    await waitFor(cdp, 'LCD comparison closes without changing the native person menu',
        'document.documentElement.getAttribute("data-baye-city-lcd")==="off"');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    return geometry;
}
async function hudScreens(cdp, label, selector) {
    const samples = [];
    for (const [width, height] of [[1920, 1080], [1280, 720]]) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await delay(150);
        const geometry = await evaluate(cdp, `(() => {
            const box=document.querySelector(${JSON.stringify(selector)}),stage=document.querySelector('#hd-city-menu .hd-city-menu-stage');
            const footer=document.querySelector('#hd-city-menu .hd-city-menu-footer');
            if(!box||box.hidden)return null;
            const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
            return {viewport:{width:innerWidth,height:innerHeight},box:rect(box),stage:rect(stage),footer:rect(footer),
                boxWidth:box.clientWidth,boxScrollWidth:box.scrollWidth,boxHeight:box.clientHeight,boxScrollHeight:box.scrollHeight,
                overflow:getComputedStyle(box).overflowY,text:box.innerText,
                lcdVisible:(()=>{const n=document.getElementById('lcd'),s=getComputedStyle(n);return s.visibility==='visible'&&s.display!=='none';})(),
                portraitDocked:!!document.querySelector('#hd-city-menu-person-portrait #hd-portrait:not([hidden])'),
                headerUncovered:(()=>{const n=document.getElementById('hd-city-menu-title'),r=n.getBoundingClientRect();
                    const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!top&&!!top.closest('#hd-city-menu');})()};
        })()`);
        assert.ok(geometry, 'actual visible HUD: ' + selector);
        assert.equal(geometry.lcdVisible, false, 'known HD detail has no automatic LCD overlay');
        if (selector === '#hd-city-menu-person-details') assert.equal(geometry.portraitDocked, true,
            'actual portrait belongs to the scrolling detail pane instead of covering menu controls');
        assert.ok(geometry.stage.left >= 0 && geometry.stage.right <= width + 1);
        assert.ok(geometry.stage.top >= 0 && geometry.stage.bottom <= height + 1);
        assert.ok(geometry.footer.bottom <= height + 1 && geometry.footer.top >= geometry.stage.top, 'return controls stay within the viewport');
        assert.ok(geometry.boxScrollWidth <= geometry.boxWidth + 1, 'HUD has no horizontal content overflow');
        assert.equal(geometry.headerUncovered, true, 'settings toolbar cannot cover the active city header');
        samples.push(geometry);
        await checkpoint(cdp, label + '-' + width + 'x' + height);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await delay(100);
    return samples;
}

async function cityStatusSmoke(cdp, cityIndex) {
    await click(cdp, '#hd-city-menu [data-hd-root="3"]');
    const details = await waitFor(cdp, 'actual grouped city details', 'BayeHdCityMenu.debugSnapshot().cityDetails');
    const native = await evaluate(cdp, `(() => {
        const c=baye.data.g_Cities[${cityIndex}];
        return {name:baye.getCityName(${cityIndex}),owner:baye.cityOwnership(c.Belong),
            ...Object.fromEntries(['Farming','FarmingLimit','Commerce','CommerceLimit','Population','PopulationLimit',
                'PeopleDevotion','AvoidCalamity','Money','Food','MothballArms','Persons','Tools'].map(key=>[key,Number(c[key])]))};
    })()`);
    assert.equal(details.cityIndex, cityIndex);
    assert.equal(details.name, native.name);
    const rows = hudRows(details);
    assert.equal(rows['归属'], native.owner.label);
    for (const [label, key] of [['农业 / 上限','Farming'],['商业 / 上限','Commerce'],['人口 / 上限','Population']]) {
        assert.equal(rows[label], native[key] + ' / ' + native[key + 'Limit']);
    }
    for (const [label, key] of [['民忠','PeopleDevotion'],['防灾','AvoidCalamity'],['金钱','Money'],['粮食','Food'],
        ['预备兵','MothballArms'],['城内人物','Persons'],['城内道具','Tools']]) assert.equal(rows[label], String(native[key]));
    assert.ok(!('PersonQueue' in rows) && !('ToolQueue' in rows), 'internal queue offsets are not city property labels');
    const screens = await hudScreens(cdp, 'hud-city-status', '#hd-city-menu-status');
    report.hud ||= {};
    report.hud.city = { details, native, screens };
    await click(cdp, '#hd-city-menu [data-hd-menu-back]');
    await waitFor(cdp, 'native root after local status view', 'BayeHdCityMenu.getLayer()==="root" && baye.hd.menuItems().context===1');
}

async function personDetailsSmoke(cdp, cityIndex) {
    const details = await waitFor(cdp, 'actual highlighted person details', 'BayeHdCityMenu.debugSnapshot().personDetail');
    const native = await evaluate(cdp, `(() => {
        const menu=baye.hd.menuItems(),d=baye.data,c=d.g_Cities[${cityIndex}];
        const people=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]))
            .filter(index=>Number(d.g_Persons[index].Belong)===Number(c.Belong));
        const index=people[menu.index],p=d.g_Persons[index];
        return {personIndex:index,name:baye.getPersonName(index),owner:baye.personOwnership(p.Belong,index),menu,
            equipment:[Number(p.Equip[0]),Number(p.Equip[1])],
            ...Object.fromEntries(['Age','Level','Force','IQ','Devotion','Experience','Thew','Arms','ArmsType','Character'].map(key=>[key,Number(p[key])]))};
    })()`);
    assert.equal(details.personIndex, native.personIndex);
    assert.equal(details.nativeIndex, native.menu.index);
    assert.equal(details.seq, native.menu.seq);
    assert.equal(details.name, native.name);
    const rows = hudRows(details);
    assert.equal(rows['归属'], native.owner.label);
    for (const [label, key] of [['年龄','Age'],['等级','Level'],['武力','Force'],['智力','IQ'],['忠诚值','Devotion'],
        ['经验','Experience'],['体力','Thew'],['兵力','Arms']]) assert.equal(rows[label], String(native[key]));
    assert.ok(rows['基础兵种'].includes('码 ' + native.ArmsType));
    assert.ok(rows['性格码'].startsWith(String(native.Character)));
    for (const [slot, label] of ['装备一','装备二'].entries()) {
        if (native.equipment[slot] === 0) assert.equal(rows[label], '无');
        else assert.ok(rows[label].includes('编号 ' + native.equipment[slot]));
    }
    const portrait = await waitFor(cdp, 'portrait agrees with the actual native highlighted person', `(() => {
        const p=BayeHdPortraits.debugSnapshot();
        return Number(p.personId)===${native.personIndex} && (p.mode==='hd'||p.mode==='ref') && p;
    })()`);
    const highlight = await evaluate(cdp, `(() => {
        const n=document.querySelector('#hd-city-menu [data-hd-deep].is-idle');
        return n ? {index:Number(n.getAttribute('data-hd-deep')),name:n.textContent.trim()} : null;
    })()`);
    assert.equal(highlight?.index, native.menu.index, 'visible person highlight uses the current native menu index');
    assert.equal(highlight?.name, native.name);
    const lcdComparison = await hudLcdComparison(cdp);
    const screens = await hudScreens(cdp, 'hud-person-details', '#hd-city-menu-person-details');
    report.hud ||= {};
    report.hud.person = { details, native, portrait, highlight, screens, lcdComparison };
}

async function enterCachedStrategy(cdp, label) {
    await waitFor(cdp, label + ' actual LIB/WASM initialization', 'window.baye && baye.hd && baye.hd.ready()', 60000);
    await evaluate(cdp, `(() => {
        window.__runtimeSpeSeen=[];
        const remember=()=>{const s=baye.hd.spe();if(s.id)__runtimeSpeSeen.push(s.id);};
        const original=BayeHdSpe.onEngineSpe;
        BayeHdSpe.onEngineSpe=function(){remember();return original.apply(this,arguments);};remember();
    })()`);
    for (let i = 0; i < 20; i++) {
        if (await evaluate(cdp, '__runtimeSpeSeen.includes(100)')) break;
        if (await evaluate(cdp, 'baye.hd.movie().active || (baye.hd.spe().active && baye.hd.spe().kind===1)')) await key(cdp, 'Enter');
        else await delay(150);
    }
    await waitFor(cdp, label + ' native title', '__runtimeSpeSeen.includes(100)');
    await key(cdp, 'Enter');
    await waitFor(cdp, label + ' native period selection', '__runtimeSpeSeen.includes(104)');
    await key(cdp, 'Enter');
    await waitFor(cdp, label + ' native lord list', 'baye.data.g_PIdx===1 && baye.hd.kings().count>0');
    const lord = await evaluate(cdp, 'baye.hd.kings()');
    await key(cdp, 'Enter');
    const setup = await waitFor(cdp, label + ' native new-game setup', `(() => {
        if(baye.hd.march().pick && baye.hd.realm().ownedCount>0)return {kind:'map'};
        const menu=baye.hd.menuItems();
        if(menu.active && menu.context===0 && menu.count===4 && menu.names.length===4 &&
            menu.names.every(name=>name.indexOf('难度选择')===0))return {kind:'difficulty',menu};
        return false;
    })()`);
    if (setup.kind === 'difficulty') {
        assert.equal(setup.menu.index, 0, 'actual Mod defaults to the first native difficulty option');
        report.libraryIdentity.setupMenus ||= [];
        report.libraryIdentity.setupMenus.push({ label, ...setup });
        await checkpoint(cdp, label + '-native-difficulty');
        await key(cdp, 'Enter');
        const confirmation = await waitFor(cdp, label + ' native difficulty confirmation', `(() => {
            const menu=baye.hd.menuItems();
            return menu.active && menu.context===0 && menu.count===2 && menu.index===0 &&
                menu.names[0]==='确认选择-普通版' && menu.names[1]==='返回难度选择' && menu;
        })()`);
        report.libraryIdentity.setupMenus.push({ label, kind: 'difficulty-confirmation', menu: confirmation });
        await checkpoint(cdp, label + '-native-difficulty-confirmation');
        await key(cdp, 'Enter');
    }
    await waitFor(cdp, label + ' native strategy pick', 'baye.hd.march().pick && baye.hd.realm().ownedCount>0');
    await waitFor(cdp, label + ' actual byte identity', 'BayeHdLibIdentity.read().status==="ready"');
    return { lord, state: await checkpoint(cdp, label) };
}

async function setRealCache(cdp, source, preferred) {
    const result = await evaluate(cdp, `(async()=>{
        const response=await fetch(${JSON.stringify(source)},{cache:'no-store'});
        if(!response.ok)throw new Error('LIB fetch failed');
        const bytes=new Uint8Array(await response.arrayBuffer());
        let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
        await new window.__perfNativePromise((resolve,reject)=>libCacheSet(binary,error=>error?reject(error):resolve()));
        const cached=await new window.__perfNativePromise((resolve,reject)=>new IdbKvStore('baye').get('lib',(error,value)=>error?reject(error):resolve(value)));
        if(cached!==binary)throw new Error('IndexedDB did not preserve actual LIB bytes');
        localStorage.setItem('baye/libpath',${JSON.stringify(preferred)});
        return {source:${JSON.stringify(source)},preferred:${JSON.stringify(preferred)},byteLength:bytes.length,cacheMatches:true};
    })()`);
    assert.equal(result.byteLength, report.sources.presentation[source].bytes);
    await cdp.send('Page.reload', { ignoreCache: true });
    await delay(300);
    return result;
}

async function libraryIdentitySmoke(cdp, bootstrapId) {
    // Stop the initial fresh-profile preferences from overwriting the deliberately
    // mismatched cache/URL cases on reload. The isolated browser is the only store touched.
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootstrapId });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__perfNativePromise=Promise;' });
    report.libraryIdentity = { cases: [], scope: 'genuine cached LIB boots and native core menus; full Mod battles remain separate' };
    for (const scenario of [
        { label: 'identity-standard-cache-other-url', source: 'libs/dat-mod.lib', preferred: 'libs/sc-mod.lib', supported: true },
        { label: 'identity-real-mod-cache-standard-url', source: 'libs/sc-mod.lib', preferred: 'libs/dat-mod.lib', supported: false },
        { label: 'identity-standard-cache-recovered', source: 'libs/dat-mod.lib', preferred: 'libs/custom-cache.lib', supported: true }
    ]) {
        report.currentLibraryScenario = scenario.label;
        const cache = await setRealCache(cdp, scenario.source, scenario.preferred);
        const entered = await enterCachedStrategy(cdp, scenario.label);
        assert.equal(entered.state.libraryIdentity.sha256, report.sources.presentation[scenario.source].sha256);
        await evaluate(cdp, `BayeHdOverworld.setMode('hd-map');BayeHdCityMenu.setMode('hd');`);
        const presentation = await waitFor(cdp, scenario.label + ' current presentation gate', `(() => {
            const s=BayeHdOverworld.debugSnapshot();
            if(s.libraryIdentity?.status!=='ready')return false;
            return ${scenario.supported ? 's.presentationReady' : '!s.presentationReady'} && s;
        })()`);
        const portrait = await evaluate(cdp, '(async()=>{await BayeHdPortraits.loadManifest();return BayeHdPortraits.chooseSource(2,1);})()');
        const viewport = await evaluate(cdp, `({preferred:localStorage.getItem('baye/libpath'),classes:document.body.className,
            mapHidden:document.getElementById('hd-overworld').getAttribute('aria-hidden'),
            lcd:(()=>{const node=document.getElementById('lcd'),r=node.getBoundingClientRect(),s=getComputedStyle(node);
                return {hasLayout:r.width>0&&r.height>0,visibility:s.visibility,display:s.display,
                    visible:r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none'};})(),
            realm:baye.hd.realm(),cursor:{x:Number(baye.data.g_CityPos.x),y:Number(baye.data.g_CityPos.y)}})`);
        assert.equal(viewport.preferred, scenario.preferred);
        assert.equal(viewport.lcd.hasLayout, true, 'classic LCD retains its layout for fallback');
        if (scenario.supported) {
            assert.equal(presentation.presentationReady, true);
            assert.equal(portrait.mode, 'ref');
            assert.equal(portrait.url, 'assets/hd-portraits/refs/period-1/2-袁绍.png');
            assert.equal(viewport.mapHidden, 'false');
        } else {
            assert.equal(viewport.lcd.visible, true, 'unknown actual Mod fallback really makes the classic LCD visible');
            assert.equal(portrait.mode, 'lcd', 'real Mod does not borrow another LIB portrait');
            assert.equal(viewport.mapHidden, 'true');
            assert.equal(viewport.classes.includes('baye-hd-overworld-map'), false);
            const guarded = await evaluate(cdp, `(() => {
                const original=sendKey,keys=[];window.sendKey=function(code){keys.push(code);return original.apply(this,arguments);};
                const cursor=()=>({x:Number(baye.data.g_CityPos.x),y:Number(baye.data.g_CityPos.y)}),before=cursor();
                try{return {accepted:BayeHdOverworld.walkToCity(0),keys,before,after:cursor()};}
                finally{window.sendKey=original;}
            })()`);
            assert.equal(guarded.accepted, false);
            assert.deepEqual(guarded.keys, []);
            assert.deepEqual(guarded.after, guarded.before, 'unknown map coordinates cannot write native cursor');
            await key(cdp, 'Enter');
            await waitFor(cdp, 'actual Mod city menu through the classic map', 'baye.hd.menuItems().active && baye.hd.menuItems().context===1');
            const nativeMenu = await checkpoint(cdp, scenario.label + '-native-city');
            assert.equal(nativeMenu.menu.names[0], '内政');
            report.libraryIdentity.cases.push({ ...scenario, cache, identity: entered.state.libraryIdentity,
                presentation, portrait, viewport, guarded, nativeMenu });
            continue;
        }
        await checkpoint(cdp, scenario.label + '-hd-verified');
        report.libraryIdentity.cases.push({ ...scenario, cache, identity: entered.state.libraryIdentity, presentation, portrait, viewport });
    }
}

async function measureMapPerformance(cdp) {
    await waitFor(cdp, 'stable HD map for measurement', "BayeHdOverworld.debugSnapshot().phase==='map' && !document.hidden");
    const browser = await cdp.send('Browser.getVersion');
    const environment = await evaluate(cdp, `({viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
        userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGiB:navigator.deviceMemory||null,
        resourceVersion:window.BAYE_ASSET_VER,visibility:document.visibilityState,period:Number(baye.data.g_PIdx),
        cityCount:baye.hd.realm().cities.length,personCount:baye.getPersonCount(),lib:localStorage.getItem('baye/libpath'),
        wasmHeapBytes:window.Module&&Module.HEAPU8?Module.HEAPU8.byteLength:null})`);
    report.performance = { browser, environment, host:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,
        availableParallelism:os.availableParallelism(),totalMemoryBytes:os.totalmem()},headless:true,gpuDisabled:true,
        manifest:report.engineManifest, sources:report.sources, renderers:report.sources.renderers };
    report.performance.environment.libSha256=sha256(fs.readFileSync(path.join(root,environment.lib)));
    await cdp.send('Performance.enable');
    const before = await cdp.send('Performance.getMetrics');
    const measured = await evaluate(cdp, `new window.__perfNativePromise(resolve => {
        const context=document.getElementById('hd-overworld-canvas').getContext('2d'),original=context.clearRect;
        const startedAt=performance.now(),frames=[],draws=[];
        context.clearRect=function(){draws.push(performance.now());return original.apply(this,arguments);};
        const tick=time=>{
            if(time>=startedAt)frames.push(time);
            if(time-startedAt<3000){requestAnimationFrame(tick);return;}
            context.clearRect=original;resolve({startedAt,endedAt:performance.now(),frames,draws});
        };
        requestAnimationFrame(tick);
    })`);
    const after = await cdp.send('Performance.getMetrics');
    const metrics = entries => Object.fromEntries(entries.metrics.map(item=>[item.name,item.value]));
    const a=metrics(before),b=metrics(after);
    report.performance.map={raf:summarizeFrames(measured.frames,measured.startedAt,measured.endedAt),
        canvas:summarizeFrames(measured.draws,measured.startedAt,measured.endedAt),raw:measured,
        jsHeapUsedBytes:b.JSHeapUsedSize,jsHeapTotalBytes:b.JSHeapTotalSize,
        taskDurationSeconds:b.TaskDuration-a.TaskDuration,scriptDurationSeconds:b.ScriptDuration-a.ScriptDuration,
        layoutCount:b.LayoutCount-a.LayoutCount};
    await measureBackgroundDrawing(cdp);
    await checkpoint(cdp,'perf-map-and-background');
}

async function measureBackgroundDrawing(cdp) {
    const viewport=report.performance.environment.viewport;
    const before=await evaluate(cdp,`(() => {
        window.__perfBackground={draws:0,keys:0};
        const ctx=document.getElementById('hd-overworld-canvas').getContext('2d');
        window.__perfClearRect=ctx.clearRect;window.__perfSendKey=sendKey;
        ctx.clearRect=function(){window.__perfBackground.draws++;return window.__perfClearRect.apply(this,arguments);};
        window.sendKey=function(){window.__perfBackground.keys++;return window.__perfSendKey.apply(this,arguments);};
        return {year:Number(baye.data.g_YearDate),month:Number(baye.data.g_MonthDate),realm:baye.hd.realm()};
    })()`);
    const tab=await cdp.send('Target.createTarget',{url:'about:blank'});
    try {
        await cdp.send('Target.activateTarget',{targetId:tab.targetId});
        await waitFor(cdp,'actual background tab','document.hidden===true');
        const start=await evaluate(cdp,'({...window.__perfBackground,at:performance.now()})');
        await cdp.send('Emulation.setDeviceMetricsOverride',{width:viewport.width-80,height:viewport.height-80,deviceScaleFactor:viewport.dpr,mobile:false});
        await delay(750);
        const end=await evaluate(cdp,'({...window.__perfBackground,at:performance.now()})');
        report.performance.background={trigger:'actual hidden tab and viewport resize',durationMs:end.at-start.at,canvasDraws:end.draws-start.draws,engineKeys:end.keys-start.keys};
        assert.equal(report.performance.background.engineKeys,0,'background transition sends no engine input');
        if(!rendererDir)assert.equal(report.performance.background.canvasDraws,0,'background map does not redraw');
        await cdp.send('Page.bringToFront');
        await cdp.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:viewport.dpr,mobile:false});
        await waitFor(cdp,'actual foreground tab','document.hidden===false');
        const restored=await evaluate(cdp,'window.__perfBackground.draws');
        await waitFor(cdp,'foreground drawing resumes','window.__perfBackground.draws>'+restored);
        const after=await evaluate(cdp,`({year:Number(baye.data.g_YearDate),month:Number(baye.data.g_MonthDate),realm:baye.hd.realm()})`);
        assert.deepEqual(after,before,'background/foreground transition preserves native date and ownership');
    } finally {
        await cdp.send('Page.bringToFront');
        await cdp.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:viewport.dpr,mobile:false});
        await cdp.send('Target.closeTarget',{targetId:tab.targetId});
        const transition=await evaluate(cdp,`(() => {const ctx=document.getElementById('hd-overworld-canvas').getContext('2d');
            const keys=window.__perfBackground.keys;
            ctx.clearRect=window.__perfClearRect;window.sendKey=window.__perfSendKey;return {engineKeys:keys};})()`);
        report.performance.visibilityTransition=transition;
        assert.equal(transition.engineKeys,0,'the complete hide, resize and restore transition sends no engine input');
    }
}

async function measureQuantityPerformance(cdp,initial) {
    const raw=[];
    await evaluate(cdp,`(() => {
        const original=window.sendKey;
        window.__perfQtyOriginalSendKey=original;
        window.__perfQtyTrace=null;
        window.__perfQtyObserve=function(q,source){
            const sample=window.__perfQtyTrace;if(!sample)return;
            const now=performance.now();
            sample.keys.forEach(key=>{
                if(key.ackAt!=null||!key.before.protocol)return;
                const next=((key.before.inputSeq+1)>>>0)||1;
                if(q.protocol&&q.active&&q.ready&&q.session===key.before.session&&q.inputSeq===next&&q.lastKey===key.code){
                    key.ackAt=now;key.ackSource=source;key.ack={...q};
                }
            });
            if(q.value!==sample.initial.value&&sample.firstValueChangeAt==null)sample.firstValueChangeAt=now;
            const city=BayeHdCityMenu.debugSnapshot();
            if(q.active&&q.value===sample.expected&&!city.sending&&!city.queueLen&&(!q.protocol||q.ready)&&sample.queueIdleAt==null)
                sample.queueIdleAt=now;
        };
        window.__perfQtySendKey=function(code){
            const sample=window.__perfQtyTrace;
            if(!sample)return original.apply(this,arguments);
            const before=baye.hd.qty();window.__perfQtyObserve(before,'before-next-dispatch');
            const key={code,dispatchAt:performance.now(),before:{...before},ackAt:null};sample.keys.push(key);
            try{return original.apply(this,arguments);}
            finally{key.returnAt=performance.now();key.after={...baye.hd.qty()};window.__perfQtyObserve(key.after,'send-return');}
        };
        window.sendKey=window.__perfQtySendKey;
    })()`);
    try {
        for(let i=0;i<12;i++) {
            const delta=i%2?1:-1,expected=initial.value+(i%2?0:-1);
            const selector=await evaluate(cdp,`BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-qty="${delta}"]':'#hd-city-menu [data-hd-qty="${delta}"]'`);
            await evaluate(cdp,`(() => {
                window.__perfQtyAck=null;
                document.querySelector(${JSON.stringify(selector)}).addEventListener('click',event=>{
                    const sample={startedAt:performance.now(),expected:${expected},trusted:event.isTrusted,
                        initial:{...baye.hd.qty()},keys:[],queueIdleAt:null,firstValueChangeAt:null};
                    window.__perfQtyTrace=sample;
                    window.__perfQtyObserverTimer=setInterval(()=>window.__perfQtyObserve(baye.hd.qty(),'4ms-observer'),4);
                    const tick=()=>{const q=baye.hd.qty(),c=BayeHdCityMenu.debugSnapshot();
                        if(c.qtyAckFailed){clearInterval(window.__perfQtyObserverTimer);window.__perfQtyObserverTimer=null;
                            window.__perfQtyTrace=null;window.__perfQtyAck={error:c.qtyAckError||'Native quantity ACK failed'};return;}
                        window.__perfQtyObserve(q,'animation-frame');
                        if(q.active&&q.value===sample.expected&&!c.sending&&!c.queueLen&&(!q.protocol||q.ready)){
                            sample.observedAt=performance.now();sample.durationMs=sample.observedAt-sample.startedAt;sample.actual=q.value;
                            clearInterval(window.__perfQtyObserverTimer);window.__perfQtyObserverTimer=null;
                            window.__perfQtyTrace=null;window.__perfQtyAck=sample;return;}
                        if(performance.now()-sample.startedAt<5000)requestAnimationFrame(tick);
                        else{clearInterval(window.__perfQtyObserverTimer);window.__perfQtyObserverTimer=null;window.__perfQtyTrace=null;}
                    };requestAnimationFrame(tick);
                },{capture:true,once:true});
            })()`);
            await click(cdp,selector);
            const sample=await waitFor(cdp,'measured native quantity acknowledgement','window.__perfQtyAck',6000);
            assert.ok(!sample.error,'native quantity measurement: '+sample.error);
            assert.equal(sample.actual,expected);assert.equal(sample.trusted,true,'quantity sample uses a genuine mouse click');
            if(sample.initial.protocol)assert.ok(sample.keys.every(key=>key.ackAt!=null),'every measured character has its own matching native wait receipt');
            const lastAck=sample.keys.every(key=>key.ackAt!=null)?Math.max(...sample.keys.map(key=>key.ackAt)):null;
            sample.breakdownMs={
                clickToFirstDispatch:sample.keys[0].dispatchAt-sample.startedAt,
                firstDispatchToLastNativeAck:lastAck==null?null:lastAck-sample.keys[0].dispatchAt,
                lastNativeAckToQueueIdle:lastAck==null?null:Math.max(0,sample.queueIdleAt-lastAck),
                queueIdleToObservedFrame:sample.observedAt-sample.queueIdleAt,
                clickToFirstNativeValueChange:sample.firstValueChangeAt==null?null:sample.firstValueChangeAt-sample.startedAt
            };
            raw.push(sample);
        }
    } finally {
        await evaluate(cdp,`(() => {
            if(window.__perfQtyObserverTimer!=null)clearInterval(window.__perfQtyObserverTimer);
            window.__perfQtyObserverTimer=null;window.__perfQtyTrace=null;
            window.sendKey=window.__perfQtyOriginalSendKey;
            delete window.__perfQtyOriginalSendKey;delete window.__perfQtySendKey;delete window.__perfQtyObserve;
        })()`);
    }
    assert.equal(await evaluate(cdp,'baye.hd.qty().value'),initial.value,'latency sampling restores the quantity without confirming enlistment');
    report.performance.quantity={source:'trusted click handler to next frame observing native value and empty input queue',
        acknowledgement:'native session + next nonzero inputSeq + lastKey + ready, when the served engine exposes the receipt protocol',
        observation:'read-only 4ms receipt observer plus the existing animation-frame end measurement; sendKey return and this are preserved',
        latencyMs:summarizeSamples(raw.map(sample=>sample.durationMs)),
        nativeKeyAckMs:raw[0].initial.protocol?summarizeSamples(raw.flatMap(sample=>sample.keys.map(key=>key.ackAt-key.dispatchAt))):null,
        breakdownMs:Object.fromEntries(Object.keys(raw[0].breakdownMs).map(name=>[name,raw.every(sample=>sample.breakdownMs[name]!=null)?summarizeSamples(raw.map(sample=>sample.breakdownMs[name])):null])),raw};
    await checkpoint(cdp,'perf-native-quantity-latency');
}

async function main() {
    fs.mkdirSync(artifactDir, { recursive: true });
    if (typeof WebSocket !== 'function') throw new Error('Node 22+ is required for built-in WebSocket');
    prepareServedAssets();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'baye-runtime-'));
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
            '--disable-background-networking', '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
            '--window-size=1920,1080', '--remote-debugging-port=' + debugPort,
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
            // sc-mod's actual didOpenNewGame script asks for the player's name.
            // Only this exact prompt during the genuine cached Mod boot is expected.
            const nativeNamePrompt = libraryIdentityMode &&
                report.currentLibraryScenario === 'identity-real-mod-cache-standard-url' &&
                event.type === 'prompt' && event.message === '来将可留姓名？' &&
                event.defaultPrompt === '常山赵子龙' && report.nativeDialogs.length === 0;
            if (nativeNamePrompt) {
                report.nativeDialogs ||= [];
                report.nativeDialogs.push({ type: event.type, message: event.message, defaultPrompt: event.defaultPrompt,
                    scenario: report.currentLibraryScenario, response: '测试玩家' });
            } else report.dialogs.push(event.message);
            cdp.send('Page.handleJavaScriptDialog', nativeNamePrompt ?
                { accept: true, promptText: '测试玩家' } : { accept: false }).catch(() => {});
        });
        cdp.on('Fetch.requestPaused', (event) => {
            const local = new URL(event.request.url).origin === origin;
            if (!local) report.blocked.push(event.request.url);
            cdp.send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId: event.requestId } :
                { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
        });
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');
        if(performanceMode||cityHudMode)await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        const bootstrap = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
            window.__perfNativePromise = Promise;
            localStorage.clear();
            localStorage.setItem('baye/libpath', 'libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode', 'classic');
            localStorage.setItem('baye/systemUiMode', 'classic');
            localStorage.setItem('baye/cityMenuMode', 'classic');
        ` });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        await smoke(cdp);
        if (libraryIdentityMode) await libraryIdentitySmoke(cdp, bootstrap.identifier);
        if (libraryIdentityMode) assert.equal(report.nativeDialogs.length, 1, 'the genuine Mod asks for the player name exactly once');
        assert.deepEqual(report.exceptions, [], 'browser has no uncaught exceptions');
        assert.deepEqual(report.dialogs, [], 'game boot has no unexpected alert dialogs');
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = error.stack || String(error);
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression); } catch {}
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
        const resolvedProfile = path.resolve(profile), temporaryRoot = path.resolve(os.tmpdir());
        assert.ok(path.dirname(resolvedProfile) === temporaryRoot && path.basename(resolvedProfile).startsWith('baye-runtime-'), 'cleanup stays in this isolated temporary profile');
        fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Real LIB/WASM browser smoke passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
