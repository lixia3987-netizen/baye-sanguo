/**
 * Dump GEN_HEADPIC faces (resid 47 + g_PIdx) through the engine LCD.
 *
 * Headless: node scripts/dump-hd-portraits.mjs
 * Page:     hd-portrait-dump.html  (loads libs/dat-mod.lib, periods 1–4)
 * In game:  after a period is selected, console:
 *           BayePortraitDump.dumpCurrent()
 *           This flickers #lcd. It does not call LoadPeriod.
 *           dumpAll() resets the campaign and only runs on the dump page
 *           unless { allowReset: true } is passed.
 */
(function (global) {
    var GEN_HEADPIC1 = 47;
    var CELL = 24;

    function qs() {
        try {
            return new URLSearchParams(global.location ? global.location.search : '');
        } catch (e) {
            return new URLSearchParams();
        }
    }

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function onDumpPage() {
        return !!(global.location && /hd-portrait-dump\.html$/.test(global.location.pathname));
    }

    function setStatus(text) {
        var el = document.getElementById('dump-status');
        if (el) {
            el.textContent = text;
        }
        if (!global.__hdPortraitDump) {
            global.__hdPortraitDump = { status: 'idle', log: [] };
        }
        global.__hdPortraitDump.message = text;
        global.__hdPortraitDump.log.push(text);
        if (global.__hdPortraitDump.log.length > 80) {
            global.__hdPortraitDump.log.shift();
        }
        console.log('[hd-portrait-dump]', text);
    }

    function fail(err) {
        var message = err && err.message ? err.message : String(err);
        if (!global.__hdPortraitDump) {
            global.__hdPortraitDump = { status: 'error', log: [] };
        }
        global.__hdPortraitDump.status = 'error';
        global.__hdPortraitDump.error = message;
        setStatus('失败: ' + message);
        throw err;
    }

    function bytesToHex(bytes) {
        var parts = new Array(bytes.length);
        var i;
        for (i = 0; i < bytes.length; i++) {
            var h = bytes[i].toString(16);
            parts[i] = h.length < 2 ? '0' + h : h;
        }
        return parts.join('');
    }

    function lcdCanvas() {
        var canvas = document.getElementById('lcd');
        if (!canvas) {
            throw new Error('missing #lcd');
        }
        return canvas;
    }

    function waitUntil(pred, timeout) {
        var start = Date.now();
        return new Promise(function (resolve) {
            function tick() {
                var value = pred();
                if (value || Date.now() - start > timeout) {
                    resolve(value);
                    return;
                }
                setTimeout(tick, 16);
            }
            tick();
        });
    }

    function backgroundAt(image, width, height) {
        var i = ((height - 1) * width + (width - 1)) * 4;
        return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
    }

    function inkBox(image, width, height, dot) {
        var bg = backgroundAt(image, width, height);
        var limX = Math.min(width, 48 * dot);
        var limY = Math.min(height, 48 * dot);
        var minX = limX;
        var minY = limY;
        var maxX = -1;
        var maxY = -1;
        var ink = 0;
        var y;
        var x;
        for (y = 0; y < limY; y++) {
            for (x = 0; x < limX; x++) {
                var i = (y * width + x) * 4;
                var d = Math.abs(image.data[i] - bg[0]) +
                    Math.abs(image.data[i + 1] - bg[1]) +
                    Math.abs(image.data[i + 2] - bg[2]) +
                    Math.abs(image.data[i + 3] - bg[3]);
                if (d > 36) {
                    ink += 1;
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (ink < 12 || maxX < 0) {
            return null;
        }
        var cell = CELL * dot;
        if (maxX < cell && maxY < cell && minX < cell && minY < cell) {
            return { x: 0, y: 0, w: cell, h: cell, ink: ink, logicalW: CELL, logicalH: CELL };
        }
        var pad = dot;
        var x0 = Math.max(0, minX - pad);
        var y0 = Math.max(0, minY - pad);
        var x1 = Math.min(limX - 1, maxX + pad);
        var y1 = Math.min(limY - 1, maxY + pad);
        return {
            x: x0,
            y: y0,
            w: x1 - x0 + 1,
            h: y1 - y0 + 1,
            ink: ink,
            logicalW: Math.max(1, Math.round((x1 - x0 + 1) / dot)),
            logicalH: Math.max(1, Math.round((y1 - y0 + 1) / dot))
        };
    }

    function cropPng(canvas, box) {
        var out = document.createElement('canvas');
        out.width = box.w;
        out.height = box.h;
        var ctx = out.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, box.w, box.h);
        ctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        return out.toDataURL('image/png');
    }

    function clearLcd() {
        var w = global.lcdWidth || 160;
        var h = global.lcdHeight || 96;
        if (typeof global._bayeLcdClearRect === 'function') {
            global._bayeLcdClearRect(0, 0, w - 1, h - 1, 0);
            return;
        }
        if (global.baye && typeof baye.clearScreen === 'function' && baye.data) {
            baye.clearScreen();
        }
    }

    function drawHead(personId, period) {
        var resid = GEN_HEADPIC1 + period;
        if (global.baye && typeof baye.drawImage === 'function') {
            baye.drawImage(0, 0, resid, 0, personId);
            return resid;
        }
        if (typeof global._bayeLcdDrawImage !== 'function') {
            throw new Error('drawImage is not ready');
        }
        global._bayeLcdDrawImage(resid, 0, personId, 0, 0, 1);
        return resid;
    }

    function readBox() {
        var canvas = lcdCanvas();
        var dot = global.dotSize || 1;
        var full = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var box = inkBox(full, canvas.width, canvas.height, dot);
        return box ? { box: box, dot: dot } : null;
    }

    async function captureHead(personId, period) {
        var flush = global.__hdPortraitFlushMs || 70;
        clearLcd();
        await sleep(flush);
        var resid = drawHead(personId, period);
        await sleep(flush);
        var shot = readBox();
        if (!shot) {
            await sleep(flush);
            shot = readBox();
        }
        if (!shot) {
            return null;
        }
        shot.resid = resid;
        return shot;
    }

    async function calibrateFlush(period) {
        if (global.__hdPortraitFlushMs) {
            return;
        }
        var delays = [20, 40, 80, 120];
        var id;
        for (id = 0; id < 12; id++) {
            var d;
            for (d = 0; d < delays.length; d++) {
                clearLcd();
                await sleep(delays[d]);
                drawHead(id, period);
                await sleep(delays[d]);
                if (readBox()) {
                    global.__hdPortraitFlushMs = delays[d];
                    setStatus('LCD 刷新约 ' + delays[d] + 'ms（dotSize ' + (global.dotSize || '?') + '）');
                    return;
                }
            }
        }
        global.__hdPortraitFlushMs = 80;
        setStatus('没量到头像墨迹，仍按 80ms 刷新继续（若全空白，resid 可能不对）');
    }

    function safeFile(id, name) {
        var n = String(name || '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, '');
        if (!n || n === '-' || n === '—' || n === '－') {
            return String(id);
        }
        return id + '-' + n;
    }

    function personCount() {
        try {
            if (global.baye && typeof baye.getPersonCount === 'function') {
                var n = Number(baye.getPersonCount()) || 0;
                if (n > 0 && n <= 2000) {
                    return n;
                }
            }
        } catch (e) {}
        return 0;
    }

    function personName(id) {
        try {
            if (global.baye && typeof baye.getPersonName === 'function') {
                return String(baye.getPersonName(id) || '').trim();
            }
        } catch (e) {}
        return '';
    }

    async function postJson(url, payload) {
        var res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error('POST ' + res.status);
        }
    }

    function rememberSample(record) {
        var gallery = document.getElementById('dump-gallery');
        if (!gallery || gallery.childNodes.length >= 8 || !record.dataUrl) {
            return;
        }
        var fig = document.createElement('figure');
        var img = document.createElement('img');
        img.src = record.dataUrl;
        img.alt = record.name || String(record.id);
        var cap = document.createElement('figcaption');
        cap.textContent = record.file;
        fig.appendChild(img);
        fig.appendChild(cap);
        gallery.appendChild(fig);
    }

    async function dumpPeriod(period, opts) {
        opts = opts || {};
        if (typeof global._bayeLoadPeriod === 'function' && opts.loadPeriod) {
            global._bayeLoadPeriod(period);
            await sleep(30);
        }
        var limit = Number(opts.limit) || 0;
        var total = personCount();
        if (!total) {
            total = 600;
        }
        if (limit > 0) {
            total = Math.min(total, limit);
        }
        var people = [];
        var saved = 0;
        var skipped = 0;
        var blankRun = 0;
        var id;
        setStatus('时期 ' + period + ' · 将领 ' + total + ' · dotSize ' + (global.dotSize || '?'));
        for (id = 0; id < total; id++) {
            var name = personName(id);
            var shot = null;
            try {
                shot = await captureHead(id, period);
            } catch (e) {
                shot = null;
            }
            if (!shot) {
                skipped += 1;
                blankRun += 1;
                people.push({ id: id, name: name, skipped: true });
                if (!personCount() && blankRun >= 40 && id > 40) {
                    break;
                }
                continue;
            }
            blankRun = 0;
            var file = 'period-' + period + '/' + safeFile(id, name) + '.png';
            var record = {
                id: id,
                name: name,
                file: file,
                ink: shot.box.ink,
                logicalW: shot.box.logicalW,
                logicalH: shot.box.logicalH,
                pxW: shot.box.w,
                pxH: shot.box.h,
                resid: shot.resid,
                skipped: false
            };
            var png = cropPng(lcdCanvas(), shot.box);
            rememberSample({ dataUrl: png, name: name, file: file });
            if (opts.postUrl) {
                await postJson(opts.postUrl, { file: file, pngBase64: png.split(',')[1] });
            }
            saved += 1;
            people.push(record);
            if (saved % 25 === 0) {
                setStatus('时期 ' + period + ' 已写 ' + saved + ' / 扫到 ' + (id + 1));
            }
        }
        return {
            period: period,
            resid: GEN_HEADPIC1 + period,
            personCount: personCount() || total,
            dotSize: global.dotSize || null,
            saved: saved,
            skipped: skipped,
            people: people
        };
    }

    async function ensureEngine(libUrl) {
        if (global.__hdPortraitEngineReady) {
            return;
        }
        setStatus('读取 ' + libUrl);
        var res = await fetch(libUrl);
        if (!res.ok) {
            throw new Error('lib HTTP ' + res.status + ' ' + libUrl);
        }
        var bytes = new Uint8Array(await res.arrayBuffer());
        if (!bytes.length) {
            throw new Error('empty lib');
        }
        global.dynLib = bytesToHex(bytes);
        setStatus('lib ' + bytes.length + ' 字节，等待 WASM');
        await waitUntil(function () {
            return !!global.__bayeWasmReady && typeof global._bayeGameEnvInit === 'function';
        }, 20000);
        if (!global.__bayeWasmReady || typeof global._bayeGameEnvInit !== 'function') {
            throw new Error('WASM 未就绪');
        }
        if (typeof global.lcdInit === 'function') {
            global.lcdInit();
        }
        setStatus('初始化引擎（不进入主循环）');
        global._bayeGameEnvInit();
        await sleep(40);
        global.__hdPortraitEngineReady = true;
    }

    async function run(opts) {
        opts = opts || {};
        var query = qs();
        var libUrl = opts.lib || query.get('lib') || 'libs/dat-mod.lib';
        var postUrl = opts.postUrl || query.get('post') || '';
        var limit = opts.limit != null ? Number(opts.limit) : Number(query.get('limit') || 0);
        var periodArg = opts.periods || query.get('periods') || '1,2,3,4';
        var periods = String(periodArg).split(',').map(function (s) { return Number(s); }).filter(function (n) {
            return n >= 1 && n <= 4;
        });
        if (!periods.length) {
            periods = [1, 2, 3, 4];
        }
        if (global.__hdPortraitDump && global.__hdPortraitDump.status === 'running') {
            return global.__hdPortraitDump.promise;
        }
        global.__hdPortraitDump = { status: 'running', log: [], message: '' };
        var job = (async function () {
        try {
            await ensureEngine(libUrl);
            await calibrateFlush(periods[0]);
            var summary = {
                lib: libUrl,
                residFormula: '47 + period',
                cell: CELL,
                periods: []
            };
            var p;
            for (p = 0; p < periods.length; p++) {
                var block = await dumpPeriod(periods[p], {
                    loadPeriod: true,
                    limit: limit,
                    postUrl: postUrl
                });
                summary.periods.push(block);
                setStatus('时期 ' + periods[p] + ' 完成，头像 ' + block.saved + '，空白 ' + block.skipped);
            }
            summary.saved = summary.periods.reduce(function (n, block) { return n + block.saved; }, 0);
            if (postUrl) {
                await postJson(postUrl, { kind: 'summary', summary: summary });
            }
            global.__hdPortraitDump.status = 'done';
            global.__hdPortraitDump.summary = {
                saved: summary.saved,
                periods: summary.periods.map(function (block) {
                    return { period: block.period, saved: block.saved, skipped: block.skipped, personCount: block.personCount };
                })
            };
            setStatus('完成，共 ' + summary.saved + ' 张。' + (postUrl ? '已写入 refs/' : '未配置 post=，只在页面上预览。'));
            return summary;
        } catch (err) {
            fail(err);
        }
        })();
        global.__hdPortraitDump.promise = job;
        return job;
    }

    async function dumpCurrent(opts) {
        opts = opts || {};
        var period = 0;
        try {
            period = Number(global.baye && baye.data && baye.data.g_PIdx) || 0;
        } catch (e) {}
        if (period < 1 || period > 4) {
            throw new Error('g_PIdx 不在 1–4。先在游戏里选好时期，或打开 hd-portrait-dump.html。');
        }
        global.__hdPortraitDump = { status: 'running', log: [], message: '' };
        setStatus('从当前引擎导出时期 ' + period + '（会闪一下 LCD）');
        var block = await dumpPeriod(period, {
            loadPeriod: false,
            limit: opts.limit || 0,
            postUrl: opts.postUrl || ''
        });
        global.__hdPortraitDump.status = 'done';
        global.__hdPortraitDump.summary = { saved: block.saved, periods: [block.period] };
        setStatus('当前时期导出 ' + block.saved + ' 张');
        return block;
    }

    function dumpAll(opts) {
        opts = opts || {};
        if (!onDumpPage() && !opts.allowReset) {
            return Promise.reject(new Error('dumpAll 会 LoadPeriod，清掉当前战役。请用 hd-portrait-dump.html，或显式传入 {allowReset:true}。'));
        }
        return run(opts);
    }

    global.BayePortraitDump = {
        GEN_HEADPIC1: GEN_HEADPIC1,
        run: run,
        dumpAll: dumpAll,
        dumpCurrent: dumpCurrent,
        captureHead: captureHead
    };

    function autorun() {
        var query = qs();
        var forced = query.get('autorun') === '1';
        if (!forced && query.get('manual') === '1') {
            return;
        }
        if (forced || onDumpPage()) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () { run(); });
            } else {
                run();
            }
        }
    }

    autorun();
})(window);
