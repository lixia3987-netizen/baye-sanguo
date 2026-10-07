#!/usr/bin/env node
/**
 * Real Chromium + shipped LIB/WASM smoke, with no npm/browser dependencies.
 *   CHROME=/usr/bin/chromium node scripts/test-hd-runtime.mjs
 *   node scripts/test-hd-runtime.mjs --staged --artifact-dir build/runtime-smoke
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
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/runtime-smoke'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.lib': 'application/octet-stream' };
const report = { staged, startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [] };

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
    report.phases.push({ name, ...state });
    console.log('PASS', name);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(image.data, 'base64'));
    return state;
}

async function key(cdp, name) {
    const codes = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39 };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await delay(180);
}

async function click(cdp, selector) {
    const point = await evaluate(cdp, `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block: 'center' });
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    assert.ok(point, 'Visible click target: ' + selector);
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
        let mismatched;
        try { localStorage.setItem('baye/libpath', 'libs/sc-mod.lib'); mismatched = await BayeHdPortraits.chooseSource(2, 1); }
        finally { localStorage.setItem('baye/libpath', lib); }
        return { valid, mismatched, name: baye.getPersonName(2), promiseIsNative: /native code/.test(String(window.Promise)) };
    })()`);
    assert.equal(portraits.valid.mode, 'ref');
    assert.equal(portraits.valid.url, 'assets/hd-portraits/refs/period-1/2-袁绍.png');
    assert.equal(portraits.name, '袁绍');
    assert.equal(portraits.mismatched.mode, 'lcd');
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
    const owned = await waitFor(cdp, 'owned HD map city', `(() => {
        const map = BayeHdOverworld.debugSnapshot();
        return map.phase === 'map' && map.owned.length && map.owned[0];
    })()`);
    const opened = await evaluate(cdp, `BayeHdOverworld.walkToCity(${owned.i})`);
    assert.ok(opened, 'open an actual player-owned city through the map API');
    await waitFor(cdp, 'real city root menu', `BayeHdCityMenu.isOpen() && BayeHdCityMenu.getLayer() === 'root' && baye.hd.menuItems().names[0] === '内政'`);
    await checkpoint(cdp, '08-hd-city');
    await click(cdp, '#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp, 'real military submenu', `BayeHdCityMenu.getLayer() === 'sub' && baye.hd.menuItems().names[0] === '侦察'`);
    await click(cdp, '#hd-city-menu [data-hd-sub="1"]');
    await waitFor(cdp, 'real enlist person picker', `(() => {
        const city = BayeHdCityMenu.debugSnapshot();
        return city.layer === 'deep' && city.deepLabel === '征兵' && city.deepItems.length > 0;
    })()`);
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
    } finally {
        await evaluate(cdp, `window.sendKey = window.__runtimeOriginalSendKey; delete window.__runtimeOriginalSendKey;`);
    }
}

async function main() {
    fs.mkdirSync(artifactDir, { recursive: true });
    if (typeof WebSocket !== 'function') throw new Error('Node 22+ is required for built-in WebSocket');
    if (staged) for (const filename of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.ok(fs.existsSync(path.join(root, 'build/wasm/src', filename)), 'Missing staged WASM file: ' + filename);
    }
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
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log('Real LIB/WASM browser smoke passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
