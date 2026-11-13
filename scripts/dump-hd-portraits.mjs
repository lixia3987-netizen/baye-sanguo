#!/usr/bin/env node
/**
 * Headless GEN_HEADPIC dump + portrait smoke.
 *
 *   node scripts/dump-hd-portraits.mjs
 *   node scripts/dump-hd-portraits.mjs --periods 1 --limit 8
 *   node scripts/dump-hd-portraits.mjs --smoke-only
 *   CHROME may point to a Windows Chrome executable. Default server and CDP
 *   ports are ephemeral. --smoke-only never exports or rewrites references;
 *   it delegates to the isolated real-PNG runner and requires every manifest HD slot,
 *   including the 39 historical pilots.
 *   Partial or other-LIB exports retain their verified dump result without
 *   running the standard-dictionary full-manifest acceptance.
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
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createHash } from 'node:crypto';

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
const port = Number(arg('--port', '0'));
let chromePort = Number(arg('--chrome-port', '0'));
let chromeProfile = null;
for (const value of [port, chromePort]) {
    if (!Number.isInteger(value) || value < 0 || value > 65535 || value === 8080) {
        throw new Error('Use an available port from 0..65535; user game port 8080 is reserved');
    }
}

function safeRef(file) {
    if (typeof file !== 'string' || file.includes('..') || path.isAbsolute(file)) {
        return null;
    }
    if (!/^period-[1-4]\/\d+(?:-[^/\\?#%:\0]+)?\.png$/.test(file)) {
        return null;
    }
    return file;
}

function safeHd(file) {
    return typeof file === 'string' && !file.includes('..') && !path.isAbsolute(file) &&
        /^hd\/(?:[^/\\?#%:\0]+\/)*[^/\\?#%:\0]+\.png$/.test(file);
}

function hasStandardSmokeExport(manifest, references) {
    const standardSha = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    if (!manifest || !references || manifest.libSha256 !== standardSha || references.libSha256 !== standardSha ||
        !Array.isArray(manifest.entries) || manifest.entries.length < 39 ||
        !Array.isArray(references.periods) || (manifest.missingPilots || []).length) return false;
    const expected = new Map(), allReferences = new Map(), seenPeriods = new Set();
    for (const block of references.periods) {
        if (!block || !Number.isInteger(block.period) || block.period < 1 || block.period > 4 ||
            seenPeriods.has(block.period) || !Array.isArray(block.people)) return false;
        seenPeriods.add(block.period);
        const seenIds = new Set();
        for (const person of block.people) {
            if (!person || person.skipped) continue;
            if (!Number.isInteger(person.id) || person.id < 0 || seenIds.has(person.id) || typeof person.name !== 'string' ||
                !safeRef(person.file) || ![ 'period-' + block.period + '/' + person.id + '.png',
                    'period-' + block.period + '/' + person.id + '-' + person.name + '.png' ].includes(person.file)) return false;
            seenIds.add(person.id);
            allReferences.set(block.period + ':' + person.id, person);
            if (!PILOT_NAMES.includes(person.name)) continue;
            expected.set(block.period + ':' + person.id, person);
        }
    }
    if (seenPeriods.size !== 4 || expected.size !== 39) return false;
    const matched = new Set(), matchedPilots = new Set();
    for (const entry of manifest.entries) {
        if (!entry || entry.missing !== false || !Number.isInteger(entry.period) ||
            !Number.isInteger(entry.personId) || !safeHd(entry.hd)) return false;
        const key = entry.period + ':' + entry.personId, person = allReferences.get(key), pilot = expected.has(key);
        if (!person || matched.has(key) || entry.name !== person.name || entry.ref !== 'refs/' + person.file) return false;
        if (entry.pilot !== pilot) return false;
        matched.add(key);
        if (pilot) matchedPilots.add(key);
    }
    return matchedPilots.size === 39;
}

function existingHdEntries(libSha256) {
    const dest = path.join(root, 'assets/hd-portraits/manifest.json');
    const kept = new Map(), duplicated = new Set();
    let prev;
    try {
        prev = JSON.parse(fs.readFileSync(dest, 'utf8'));
    } catch (e) {
        return kept;
    }
    if (prev.libSha256 !== libSha256) { return kept; }
    for (const entry of prev.entries || []) {
        if (!entry || entry.missing !== false || !safeHd(entry.hd) || !Number.isInteger(entry.period) ||
            entry.period < 1 || entry.period > 4 || !Number.isInteger(entry.personId) || entry.personId < 0 ||
            typeof entry.name !== 'string' || !safeRef(String(entry.ref || '').replace(/^refs\//, '')) ||
            !entry.ref.startsWith('refs/') || typeof entry.pilot !== 'boolean') {
            continue;
        }
        const key = entry.period + ':' + entry.personId;
        if (kept.has(key) || duplicated.has(key)) { kept.delete(key); duplicated.add(key); continue; }
        if (fs.existsSync(path.join(root, 'assets/hd-portraits', entry.hd))) {
            kept.set(key, entry);
        }
    }
    return kept;
}

function buildManifest(summary) {
    if (!/^[0-9a-f]{64}$/.test(summary.libSha256 || '')) { throw new Error('portrait dump has no actual LIB SHA'); }
    const keptHd = existingHdEntries(summary.libSha256);
    const byName = new Map(), byKey = new Map();
    for (const block of summary.periods || []) {
        if (!Number.isInteger(block.period) || block.period < 1 || block.period > 4) continue;
        for (const person of block.people || []) {
            if (person.skipped || !person.name || !Number.isInteger(person.id) || person.id < 0 || !safeRef(person.file) ||
                ![ 'period-' + block.period + '/' + person.id + '.png',
                    'period-' + block.period + '/' + person.id + '-' + person.name + '.png' ].includes(person.file)) {
                continue;
            }
            const key = block.period + ':' + person.id;
            byKey.set(key, byKey.has(key) ? null : { ...person, period: block.period });
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
                hd: keptHd.get(key)?.name === name && keptHd.get(key)?.ref === 'refs/' + hit.file ?
                    keptHd.get(key).hd : ('hd/by-lib/' + summary.libSha256 + '/' + hit.file)
            });
        }
    }
    // New coverage is separate from the historical pilots. Retain it only for
    // the same actual LIB and an identity present in this particular export.
    const keys = new Set(entries.filter(entry => !entry.missing).map(entry => entry.period + ':' + entry.personId));
    for (const [key, previous] of keptHd) {
        if (previous.pilot || keys.has(key)) continue;
        const person = byKey.get(key);
        if (!person || person.name !== previous.name || previous.ref !== 'refs/' + person.file) continue;
        const entry = { name: person.name, personId: person.id, period: person.period,
            pilot: false, missing: false, ref: previous.ref, hd: previous.hd };
        if (typeof previous.expansion === 'string' && previous.expansion) entry.expansion = previous.expansion;
        entries.push(entry); keys.add(key);
    }
    const manifest = {
        version: 1,
        lib: summary.lib,
        libSha256: summary.libSha256,
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
            req.on('end', async () => {
                let payload;
                try {
                    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                } catch (e) {
                    res.writeHead(400);
                    res.end('bad json');
                    return;
                }
                if (payload.kind === 'summary') {
                    try {
                        if (!payload.summary || !Array.isArray(payload.summary.periods)) { throw new Error('invalid portrait summary'); }
                        if (!server.cdp) { throw new Error('portrait dump has no live CDP source'); }
                        const value = await server.cdp.send('Runtime.evaluate', {
                            expression: 'typeof window.dynLib === "string" ? window.dynLib : null', returnByValue: true
                        });
                        const hex = value.result && value.result.value;
                        if (typeof hex !== 'string' || !hex.length || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) {
                            throw new Error('portrait dump has no valid actual loaded LIB bytes');
                        }
                        const summary = { ...payload.summary,
                            libSha256: createHash('sha256').update(Buffer.from(hex, 'hex')).digest('hex') };
                        // Commit images only after their actual source is known. A failed
                        // dump must not overwrite references under an older identity.
                        for (const [rel, png] of server.pendingPngs || []) {
                            const dest = path.join(root, 'assets/hd-portraits/refs', rel);
                            fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, png);
                        }
                        server.pendingPngs = new Map();
                        const indexPath = path.join(root, 'assets/hd-portraits/refs/index.json');
                        fs.mkdirSync(path.dirname(indexPath), { recursive: true });
                        fs.writeFileSync(indexPath, JSON.stringify(summary, null, 2) + '\n');
                        const manifest = buildManifest(summary);
                        server.summary = summary; server.manifest = manifest;
                        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
                    } catch (e) {
                        server.pendingPngs = new Map();
                        res.writeHead(503); res.end('portrait source verification failed');
                    }
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
                if (!server.pendingPngs) { server.pendingPngs = new Map(); }
                server.pendingPngs.set(rel, buf);
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
        if (!file.startsWith(root + path.sep)) {
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

async function unusedPort(requested = 0) {
    const socket = net.createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(requested, '127.0.0.1', resolve); });
    const assigned = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    return assigned;
}

async function runPortraitSmoke() {
    // Genuine HD files stay immutable. Missing HD/ref and late responses are
    // controlled solely by the isolated runner's ephemeral HTTP server.
    const args = [path.join(root, 'scripts/test-hd-portraits-runtime.mjs'), '--assets-only',
        '--artifact-dir', path.resolve(arg('--artifact-dir', path.join(root, 'build/r06-dump-smoke')))];
    if (process.argv.includes('--allow-partial')) args.push('--allow-partial');
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error('Isolated portrait smoke exited ' + code)));
    });
}

function launchChrome(url) {
    const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
    const bin = process.env.CHROME || candidates.find(file => fs.existsSync(file));
    if (!bin) throw new Error('Set CHROME to a Chrome/Chromium executable');
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'baye-portrait-dump-'));
    chromeProfile = userData;
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
    if (smokeOnly) { await runPortraitSmoke(); return; }
    // Never attach to a pre-existing debugging endpoint, even for an explicit
    // port. The Chrome process below always receives its own fresh profile.
    chromePort = await unusedPort(chromePort);
    const server = await startServer();
    const servedPort = server.address().port;
    if (servedPort === 8080) { server.close(); throw new Error('The user game port 8080 is reserved'); }
    console.log('serving', root, 'on', servedPort);
    const dumpUrl = 'http://127.0.0.1:' + servedPort + '/hd-portrait-dump.html?autorun=1&post=http://127.0.0.1:' + servedPort + '/dump&periods=' + encodeURIComponent(periods) + '&limit=' + encodeURIComponent(limit);
    let chrome = null, cdp = null;
    let failed = null;
    try {
        chrome = launchChrome(dumpUrl);
        let chromeError = null;
        chrome.once('error', error => { chromeError = error; });
        const page = await chromeTarget();
        if (chromeError) throw chromeError;
        if (chrome.exitCode !== null) throw new Error('Private dump Chrome exited ' + chrome.exitCode);
        cdp = await connectCdp(page.webSocketDebuggerUrl);
        server.cdp = cdp;
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
        cdp.close();
    } catch (err) {
        failed = err;
    } finally {
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) {
            const stopped = new Promise(resolve => chrome.once('exit', resolve));
            chrome.kill('SIGTERM');
            await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 1500))]);
            if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 1500))]); }
        }
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        if (chromeProfile) {
            const resolved = path.resolve(chromeProfile);
            if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('baye-portrait-dump-')) throw new Error('Unsafe profile cleanup path');
            fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    }
    if (failed) {
        console.error(failed && failed.stack ? failed.stack : failed);
        process.exit(1);
    }
    if (hasStandardSmokeExport(server.manifest, server.summary)) {
        await runPortraitSmoke();
        console.log('portrait dump and isolated asset smoke ok');
    } else {
        console.log('本次为部分或其他LIB导出，未运行标准全清单素材smoke（含39历史试点）');
        console.log('portrait dump ok');
    }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
