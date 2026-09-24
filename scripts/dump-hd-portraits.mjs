#!/usr/bin/env node
/**
 * Headless GEN_HEADPIC dump + portrait smoke.
 *
 *   node scripts/dump-hd-portraits.mjs
 *   node scripts/dump-hd-portraits.mjs --periods 1 --limit 8
 *   node scripts/dump-hd-portraits.mjs --smoke-only
 *
 * Serves the repo, opens hd-portrait-dump.html in headless Chrome, and writes
 * assets/hd-portraits/refs/period-{1..4}/{id}-{name}.png plus manifest.json.
 *
 * The page must crop document.getElementById('lcd') only, top-left 24 * dotSize,
 * after baye.drawImage(0, 0, GEN_HEADPIC1 + g_PIdx, 0, personIndex, 1) and one
 * rAF + LCD flush. Period 1 resid is 48 (GEN_HEADPIC1 is 47). querySelector('canvas')
 * hits the HD overworld and is near-black.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PILOT_NAMES = ['马腾', '庞德', '杨秋', '梁兴', '曹操', '刘备', '关羽', '张飞', '诸葛亮', '孙权', '周瑜', '吕布', '董卓', '方悦', '王匡'];
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.wasm': 'application/wasm',
    '.lib': 'application/octet-stream',
    '.md': 'text/plain; charset=utf-8'
};

function arg(name, fallback) {
    const i = process.argv.indexOf(name);
    if (i < 0) {
        return fallback;
    }
    return process.argv[i + 1];
}

const periods = arg('--periods', '1,2,3,4');
const limit = arg('--limit', '0');
const smokeOnly = process.argv.includes('--smoke-only');
const port = Number(arg('--port', '8765'));
const chromePort = Number(arg('--chrome-port', '9333'));

function safeRef(file) {
    if (typeof file !== 'string' || file.includes('..') || path.isAbsolute(file)) {
        return null;
    }
    if (!/^period-[1-4]\/\d+(?:-.+)?\.png$/.test(file)) {
        return null;
    }
    return file;
}

function existingHdPaths() {
    const dest = path.join(root, 'assets/hd-portraits/manifest.json');
    const kept = new Map();
    let prev;
    try {
        prev = JSON.parse(fs.readFileSync(dest, 'utf8'));
    } catch (e) {
        return kept;
    }
    for (const entry of prev.entries || []) {
        if (!entry || entry.missing || !entry.hd || entry.period == null || entry.personId == null) {
            continue;
        }
        if (fs.existsSync(path.join(root, 'assets/hd-portraits', entry.hd))) {
            kept.set(entry.period + ':' + entry.personId, entry.hd);
        }
    }
    return kept;
}

function buildManifest(summary) {
    const keptHd = existingHdPaths();
    const byName = new Map();
    for (const block of summary.periods || []) {
        for (const person of block.people || []) {
            if (person.skipped || !person.name || !person.file) {
                continue;
            }
            const list = byName.get(person.name) || [];
            list.push({ period: block.period, id: person.id, file: person.file, name: person.name });
            byName.set(person.name, list);
        }
    }
    const entries = [];
    const missing = [];
    for (const name of PILOT_NAMES) {
        const hits = byName.get(name) || [];
        if (!hits.length) {
            missing.push(name);
            entries.push({ name, personId: null, period: null, pilot: true, missing: true, ref: null, hd: null });
            continue;
        }
        const seen = new Set();
        for (const hit of hits) {
            const key = hit.period + ':' + hit.id;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            entries.push({
                name,
                personId: hit.id,
                period: hit.period,
                pilot: true,
                missing: false,
                ref: 'refs/' + hit.file,
                hd: keptHd.get(key) || ('hd/' + hit.file)
            });
        }
    }
    const manifest = {
        version: 1,
        lib: 'libs/dat-mod.lib',
        personId: '0-based PersonID. Same index as gam_drawpic(GEN_HEADPIC1 + g_PIdx, personId) and baye.drawImage(..., picIndex).',
        period: 'g_PIdx 1-4',
        resid: 'GEN_HEADPIC1(47) + g_PIdx. Period 1 resid is 48.',
        canvas: 'document.getElementById("lcd") only. Never querySelector("canvas") (HD overworld, near-black).',
        crop: 'top-left 24 * dotSize after baye.drawImage(0, 0, GEN_HEADPIC1 + g_PIdx, 0, personIndex, 1) and one rAF + LCD flush.',
        pilotNames: PILOT_NAMES,
        missingPilots: missing,
        entries
    };
    const dest = path.join(root, 'assets/hd-portraits/manifest.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
}

function startServer() {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (req.method === 'POST' && url.pathname === '/dump') {
            const chunks = [];
            let size = 0;
            req.on('data', (chunk) => {
                size += chunk.length;
                if (size > 20_000_000) {
                    res.writeHead(413);
                    res.end('too large');
                    req.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => {
                let payload;
                try {
                    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                } catch (e) {
                    res.writeHead(400);
                    res.end('bad json');
                    return;
                }
                if (payload.kind === 'summary') {
                    const indexPath = path.join(root, 'assets/hd-portraits/refs/index.json');
                    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
                    fs.writeFileSync(indexPath, JSON.stringify(payload.summary, null, 2) + '\n');
                    const manifest = buildManifest(payload.summary);
                    server.summary = payload.summary;
                    server.manifest = manifest;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end('{"ok":true}');
                    return;
                }
                const rel = safeRef(payload.file);
                const b64 = payload.pngBase64;
                if (!rel || typeof b64 !== 'string' || b64.length < 32) {
                    res.writeHead(400);
                    res.end('bad file');
                    return;
                }
                const buf = Buffer.from(b64, 'base64');
                if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) {
                    res.writeHead(400);
                    res.end('not png');
                    return;
                }
                const dest = path.join(root, 'assets/hd-portraits/refs', rel);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.writeFileSync(dest, buf);
                server.written = (server.written || 0) + 1;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"ok":true}');
            });
            return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405);
            res.end();
            return;
        }
        let rel = decodeURIComponent(url.pathname);
        if (rel === '/') {
            rel = '/hd-portrait-dump.html';
        }
        const file = path.normalize(path.join(root, rel));
        if (!file.startsWith(root)) {
            res.writeHead(403);
            res.end();
            return;
        }
        fs.readFile(file, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('not found');
                return;
            }
            const ext = path.extname(file);
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : data);
        });
    });
    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => resolve(server));
    });
}

function connectCdp(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let seq = 0;
        const pending = new Map();
        const logs = [];
        ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.method === 'Runtime.consoleAPICalled') {
                const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
                logs.push(text);
                if (logs.length > 40) {
                    logs.shift();
                }
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                logs.push('EXC ' + JSON.stringify(msg.params.exceptionDetails && msg.params.exceptionDetails.exception));
            }
            if (msg.id && pending.has(msg.id)) {
                const slot = pending.get(msg.id);
                pending.delete(msg.id);
                if (msg.error) {
                    slot.reject(new Error(JSON.stringify(msg.error)));
                } else {
                    slot.resolve(msg.result);
                }
            }
        });
        ws.addEventListener('open', () => {
            resolve({
                logs,
                send(method, params) {
                    const id = ++seq;
                    return new Promise((res, rej) => {
                        pending.set(id, { resolve: res, reject: rej });
                        ws.send(JSON.stringify({ id, method, params: params || {} }));
                    });
                },
                close() {
                    ws.close();
                }
            });
        });
        ws.addEventListener('error', () => reject(new Error('CDP websocket failed')));
    });
}

async function chromeTarget() {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        try {
            const list = await fetch('http://127.0.0.1:' + chromePort + '/json/list').then((r) => r.json());
            const pages = list.filter((item) => item.type === 'page' && item.webSocketDebuggerUrl);
            const page = pages.find((item) => item.url && item.url.indexOf('hd-portrait') >= 0) || pages[pages.length - 1];
            if (page) {
                return page;
            }
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Chrome DevTools did not come up');
}

async function evalJson(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
    });
    if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result && result.result.value;
}

async function waitFor(cdp, expression, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const value = await evalJson(cdp, expression);
        if (value) {
            return value;
        }
        await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error('timeout waiting for ' + expression + '\n' + cdp.logs.join('\n'));
}

function launchChrome(url) {
    const bin = process.env.CHROME || '/usr/bin/google-chrome';
    const userData = '/tmp/hd-portrait-chrome-' + chromePort;
    fs.rmSync(userData, { recursive: true, force: true });
    const child = spawn(bin, [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--remote-debugging-port=' + chromePort,
        '--user-data-dir=' + userData,
        url
    ], { stdio: 'ignore' });
    return child;
}

async function main() {
    const server = await startServer();
    console.log('serving', root, 'on', port);
    const dumpUrl = 'http://127.0.0.1:' + port + '/hd-portrait-dump.html?autorun=1&post=http://127.0.0.1:' + port + '/dump&periods=' + encodeURIComponent(periods) + '&limit=' + encodeURIComponent(limit);
    const chrome = launchChrome(smokeOnly ? 'about:blank' : dumpUrl);
    let failed = null;
    try {
        const page = await chromeTarget();
        const cdp = await connectCdp(page.webSocketDebuggerUrl);
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');
        if (!smokeOnly) {
            console.log('dumping', dumpUrl);
            const done = await waitFor(cdp, 'window.__hdPortraitDump && (window.__hdPortraitDump.status === "done" || window.__hdPortraitDump.status === "error") && window.__hdPortraitDump.status', 12 * 60 * 1000);
            const info = await evalJson(cdp, '({status:window.__hdPortraitDump.status,error:window.__hdPortraitDump.error,message:window.__hdPortraitDump.message,summary:window.__hdPortraitDump.summary,probe:window.__hdPortraitDump.probe,log:window.__hdPortraitDump.log})');
            console.log(JSON.stringify(info, null, 2));
            console.log('console', cdp.logs.slice(-20).join('\n'));
            if (done === 'error' || !server.summary) {
                throw new Error((info && info.error) || 'dump failed\n' + cdp.logs.slice(-15).join('\n'));
            }
            if (!info.probe || info.probe.canvasId !== 'lcd' || info.probe.residPeriod1 !== 48) {
                throw new Error('dump did not use #lcd or period-1 resid 48: ' + JSON.stringify(info.probe));
            }
            for (const block of server.summary.periods || []) {
                if (block.period === 1 && block.resid !== 48) {
                    throw new Error('period 1 resid was ' + block.resid + ', expected 48');
                }
                const head = (block.people || []).find((person) => person && !person.skipped);
                if (head && (head.logicalW !== 24 || head.logicalH !== 24 || head.pxW !== head.logicalW * (block.dotSize || 1))) {
                    throw new Error('crop is not the top-left 24 * dotSize cell: ' + JSON.stringify(head));
                }
            }
            const sample = [];
            for (const block of server.summary.periods || []) {
                for (const person of block.people || []) {
                    if (person.name && !person.skipped && sample.length < 24) {
                        sample.push(block.period + ':' + person.id + ':' + person.name + ' ' + person.logicalW + 'x' + person.logicalH);
                    }
                }
            }
            console.log('sample', sample.join(' | '));
            console.log('wrote', server.written, 'pngs; missing pilots', (server.manifest.missingPilots || []).join(',') || '(none)');
        }
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/hd-portraits/manifest.json'), 'utf8'));
        function absPortrait(rel) {
            return path.join(root, 'assets/hd-portraits', rel);
        }
        const shipped = (manifest.entries || []).filter((entry) => entry && !entry.missing && entry.hd && fs.existsSync(absPortrait(entry.hd)));
        const fallback = (manifest.entries || []).find((entry) => entry && !entry.missing && entry.ref && entry.hd && fs.existsSync(absPortrait(entry.ref)) && !fs.existsSync(absPortrait(entry.hd)));
        if (!shipped.length || !fallback) {
            throw new Error('need one shipped HD portrait and one ref-only pilot to smoke');
        }
        async function smoke(entry, expect, contains) {
            const url = 'http://127.0.0.1:' + port + '/hd-portrait-smoke.html?expect=' + encodeURIComponent(expect) + '&personId=' + entry.personId + '&period=' + entry.period + (contains ? '&contains=' + encodeURIComponent(contains) : '') + '&t=' + Date.now();
            await cdp.send('Page.navigate', { url });
            const result = await waitFor(cdp, '(function(){var s=window.__hdPortraitSmoke; if(!s||s.personId!==' + entry.personId + '||s.expect!==' + JSON.stringify(expect) + ') return null; return s;})()', 20000);
            if (!result.ok) {
                throw new Error('smoke ' + expect + ' ' + entry.name + ' ' + (result.errors || []).join('; '));
            }
            console.log('smoke', expect, entry.period + ':' + entry.personId + ':' + entry.name, result.url || '');
            return result;
        }
        for (const entry of shipped) {
            await smoke(entry, 'hd', entry.hd);
            const hdPath = absPortrait(entry.hd);
            const aside = hdPath + '.smoke-aside';
            fs.renameSync(hdPath, aside);
            try {
                await smoke(entry, 'ref', entry.ref);
            } finally {
                fs.renameSync(aside, hdPath);
            }
            await smoke(entry, 'hd', entry.hd);
        }
        const refPath = absPortrait(fallback.ref);
        const hdPath = absPortrait(fallback.hd);
        await smoke(fallback, 'ref', fallback.ref);
        fs.mkdirSync(path.dirname(hdPath), { recursive: true });
        fs.copyFileSync(refPath, hdPath);
        try {
            await smoke(fallback, 'hd', fallback.hd);
        } finally {
            fs.rmSync(hdPath, { force: true });
        }
        await smoke(fallback, 'ref', fallback.ref);
        cdp.close();
    } catch (err) {
        failed = err;
    } finally {
        chrome.kill('SIGKILL');
        server.close();
    }
    if (failed) {
        console.error(failed && failed.stack ? failed.stack : failed);
        process.exit(1);
    }
    console.log('portrait dump and smoke ok');
}

main();
