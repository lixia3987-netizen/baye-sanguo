/**
 * Dump GEN_HEADPIC faces onto #lcd and crop the top-left head cell.
 *
 * Contract (box-tested):
 *   - Canvas is document.getElementById('lcd') only.
 *     document.querySelector('canvas') is the HD overworld on pc.html
 *     and a crop of it is near-black.
 *   - Draw with baye.drawImage(0, 0, GEN_HEADPIC1 + g_PIdx, 0, personIndex, 1).
 *     GEN_HEADPIC1 is 47, so period 1 resid is 48.
 *   - bridge.js maps scr==1 to C flag 0 (g_VisScr). That buffer is not #lcd.
 *     The dump then blits the same picture with _bayeLcdDrawImage flag 1,
 *     which is the real LCD flushLcd copies.
 *   - Wait one requestAnimationFrame and one lcdFlushBuffer, then crop
 *     the top-left 24 * dotSize pixels. Do not tight-crop an ink box.
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
        if (!canvas || canvas.id !== 'lcd') {
            throw new Error('portrait dump only crops #lcd. querySelector("canvas") is the HD overworld and comes out near-black.');
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

    function cellInk(image, width, side) {
        var bg = backgroundAt(image, width, image.height);
        var ink = 0;
        var opaqueBlack = 0;
        var y;
        var x;
        for (y = 0; y < side; y++) {
            for (x = 0; x < side; x++) {
                var i = (y * width + x) * 4;
                var r = image.data[i];
                var g = image.data[i + 1];
                var b = image.data[i + 2];
                var a = image.data[i + 3];
                var d = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) + Math.abs(a - bg[3]);
                if (d > 36) {
                    ink += 1;
                }
                if (a > 200 && r < 12 && g < 12 && b < 12) {
                    opaqueBlack += 1;
                }
            }
        }
        return { ink: ink, opaqueBlack: opaqueBlack, pixels: side * side };
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

    function drawHead(personIndex, period) {
        var resid = GEN_HEADPIC1 + period;
        if (!(global.baye && typeof baye.drawImage === 'function')) {
            throw new Error('drawImage is not ready');
        }
        baye.drawImage(0, 0, resid, 0, personIndex, 1);
        if (typeof global._bayeLcdDrawImage !== 'function') {
            throw new Error('real LCD blit is not ready');
        }
        global._bayeLcdDrawImage(resid, 0, personIndex, 0, 0, 1);
        return resid;
    }

    function nextFrame() {
        return new Promise(function (resolve) {
            if (typeof global.requestAnimationFrame === 'function') {
                global.requestAnimationFrame(function () { resolve(); });
                return;
            }
            setTimeout(resolve, 16);
        });
    }

    function waitLcdFlush() {
        return new Promise(function (resolve) {
            var original = global.lcdFlushBuffer;
            var settled = false;
            function finish() {
                if (settled) {
                    return;
                }
                settled = true;
                if (typeof original === 'function') {
                    global.lcdFlushBuffer = original;
                }
                resolve();
            }
            if (typeof original === 'function') {
                global.lcdFlushBuffer = function (buffer) {
                    original(buffer);
                    finish();
                };
            }
            setTimeout(finish, 80);
        });
    }

    async function waitFrameAndFlush() {
        var flush = waitLcdFlush();
        await nextFrame();
        await flush;
    }

    function readCell() {
        var canvas = lcdCanvas();
        var dot = Number(global.dotSize) || 1;
        var side = CELL * dot;
        if (canvas.width < side || canvas.height < side) {
            throw new Error('#lcd is smaller than 24 * dotSize (' + side + ')');
        }
        var full = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var ink = cellInk(full, canvas.width, side);
        if (ink.ink < 12) {
            return null;
        }
        if (ink.opaqueBlack / ink.pixels > 0.92) {
            throw new Error('top-left #lcd cell is near-black. Crop #lcd only, never querySelector("canvas").');
        }
        return {
            box: { x: 0, y: 0, w: side, h: side, ink: ink.ink, logicalW: CELL, logicalH: CELL },
            dot: dot,
            canvasId: canvas.id
        };
    }

    async function captureHead(personId, period) {
        clearLcd();
        await waitFrameAndFlush();
        var resid = drawHead(personId, period);
        await waitFrameAndFlush();
        var shot = readCell();
        if (!shot) {
            await waitFrameAndFlush();
            shot = readCell();
        }
        if (!shot) {
            return null;
        }
        if (shot.canvasId !== 'lcd') {
            throw new Error('crop target was not #lcd');
        }
        shot.resid = resid;
        return shot;
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
            var summary = {
                lib: libUrl,
                canvas: 'lcd',
                crop: 'top-left 24 * dotSize',
                draw: 'baye.drawImage(0, 0, GEN_HEADPIC1 + g_PIdx, 0, personIndex, 1)',
                residFormula: 'GEN_HEADPIC1(47) + g_PIdx',
                residPeriod1: GEN_HEADPIC1 + 1,
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
            global.__hdPortraitDump.probe = {
                canvasId: 'lcd',
                crop: summary.crop,
                draw: summary.draw,
                residPeriod1: summary.residPeriod1,
                dotSize: global.dotSize || null
            };
            global.__hdPortraitDump.summary = {
                saved: summary.saved,
                canvas: 'lcd',
                residPeriod1: summary.residPeriod1,
                periods: summary.periods.map(function (block) {
                    return { period: block.period, resid: block.resid, saved: block.saved, skipped: block.skipped, personCount: block.personCount };
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
