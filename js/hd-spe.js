/**
 * HD SPE overlay: blit the engine-composited LCD each flush onto a 1080p canvas.
 * Timing stays in PlcMovie / GamDelay. No replacement VFX.
 * Spec: docs/hd-spe-spec.md
 */
(function (global) {
    var SYS_KEY = 'baye/systemUiMode';
    var BATTLE_KEY = 'baye/battleMode';
    var OVERWORLD_KEY = 'baye/overworldMode';
    var VK_ENTER = 0x27;
    var VK_EXIT = 0x28;

    var KIND_NAME = {
        0: 'other',
        1: 'opening',
        2: 'skill',
        3: 'attack',
        4: 'status'
    };

    var LOGICAL_W = 160;
    var LOGICAL_H = 96;
    var SPE_W = 130;
    var SPE_H = 64;
    var STAGE_W = 1920;
    var STAGE_H = 1080;

    var state = {
        open: false,
        lastSeq: 0,
        scale: 1,
        canvasW: 0,
        canvasH: 0,
        bound: false,
        scratch: null
    };

    function readStorage(key, fallback) {
        try {
            var v = global.localStorage.getItem(key);
            return v == null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function overworldIsHd() {
        if (global.BayeHdOverworld && typeof BayeHdOverworld.getMode === 'function') {
            return BayeHdOverworld.getMode() === 'hd-map';
        }
        return readStorage(OVERWORLD_KEY, 'classic') === 'hd-map';
    }

    function modeShowsHd(mode) {
        if (mode === 'classic') {
            return false;
        }
        if (mode === 'hd') {
            return true;
        }
        return overworldIsHd();
    }

    function openingHd() {
        if (global.BayeHdSystemUi && typeof BayeHdSystemUi.shouldShowHd === 'function') {
            return BayeHdSystemUi.shouldShowHd();
        }
        return modeShowsHd(readStorage(SYS_KEY, 'auto'));
    }

    function battleHd() {
        if (global.BayeHdBattle && typeof BayeHdBattle.shouldShowHd === 'function') {
            return BayeHdBattle.shouldShowHd();
        }
        return modeShowsHd(readStorage(BATTLE_KEY, 'auto'));
    }

    function readSpe() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.spe === 'function') {
                return baye.hd.spe() || {};
            }
        } catch (e) {}
        return {};
    }

    function kindOf(info) {
        var k = info && info.kind != null ? Number(info.kind) : 0;
        if (k) {
            return k;
        }
        if (info && (Number(info.id) === 3 || Number(info.id) === 6)) {
            return 1;
        }
        return 0;
    }

    function shouldShowFor(info) {
        if (!info || !info.active) {
            return false;
        }
        var kind = kindOf(info);
        if (kind === 1) {
            return openingHd();
        }
        if (kind === 2 || kind === 3) {
            return battleHd();
        }
        if (kind === 4) {
            return false;
        }
        return openingHd() || battleHd();
    }

    function isHandling() {
        return shouldShowFor(readSpe());
    }

    function el(id) {
        return document.getElementById(id);
    }

    function engineSendKey(code) {
        try {
            if (typeof sendKey === 'function') {
                sendKey(code);
            }
        } catch (e) {}
    }

    function scratchCanvas() {
        if (!state.scratch) {
            state.scratch = document.createElement('canvas');
        }
        return state.scratch;
    }

    function integerScale(srcW, srcH) {
        var sx = Math.floor(STAGE_W / srcW);
        var sy = Math.floor(STAGE_H / srcH);
        return Math.max(2, Math.min(sx, sy));
    }

    function applyChrome() {
        var root = el('hd-spe');
        if (!root) {
            return;
        }
        var info = readSpe();
        var show = shouldShowFor(info);
        state.open = show;
        root.classList.toggle('is-open', show);
        root.setAttribute('aria-hidden', show ? 'false' : 'true');
        var skip = el('hd-spe-skip');
        if (skip) {
            skip.hidden = kindOf(info) !== 1;
        }
        var title = el('hd-spe-title');
        if (title) {
            var kind = kindOf(info);
            title.textContent = kind === 1 ? '开场动画' : (kind === 2 ? '计谋 SPE' : (kind === 3 ? '战斗 SPE' : 'SPE'));
        }
        updateProbe(info);
        if (show) {
            blit();
        }
    }

    function updateProbe(info) {
        var probe = el('hd-spe-probe');
        if (!probe) {
            return;
        }
        info = info || readSpe();
        var kind = kindOf(info);
        probe.textContent = 'spe=' + (info.id != null ? info.id : '—') +
            ' kind=' + (KIND_NAME[kind] || kind) +
            ' seq=' + (info.seq != null ? info.seq : 0) +
            ' scale=' + state.scale + '×' +
            ' canvas=' + state.canvasW + '×' + state.canvasH +
            ' xy=' + (info.x || 0) + ',' + (info.y || 0);
    }

    function blit() {
        var lcd = el('lcd');
        var canvas = el('hd-spe-canvas');
        if (!lcd || !canvas || !lcd.width || !lcd.height) {
            return;
        }
        var info = readSpe();
        var kind = kindOf(info);
        var srcX = 0;
        var srcY = 0;
        var srcW = LOGICAL_W;
        var srcH = LOGICAL_H;
        if (kind === 2 || kind === 3) {
            var sx = info.x != null ? Number(info.x) : 15;
            var sy = info.y != null ? Number(info.y) : 16;
            if (!(sx >= 0 && sy >= 0 && sx + SPE_W <= LOGICAL_W && sy + SPE_H <= LOGICAL_H)) {
                sx = Math.max(0, Math.min(LOGICAL_W - SPE_W, sx));
                sy = Math.max(0, Math.min(LOGICAL_H - SPE_H, sy));
            }
            srcX = sx;
            srcY = sy;
            srcW = Math.min(SPE_W, LOGICAL_W - srcX);
            srcH = Math.min(SPE_H, LOGICAL_H - srcY);
        }
        var scale = integerScale(srcW, srcH);
        var dstW = srcW * scale;
        var dstH = srcH * scale;
        if (canvas.width !== dstW || canvas.height !== dstH) {
            canvas.width = dstW;
            canvas.height = dstH;
        }
        state.scale = scale;
        state.canvasW = dstW;
        state.canvasH = dstH;

        var tmp = scratchCanvas();
        if (tmp.width !== LOGICAL_W || tmp.height !== LOGICAL_H) {
            tmp.width = LOGICAL_W;
            tmp.height = LOGICAL_H;
        }
        var tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
        tctx.drawImage(lcd, 0, 0, lcd.width, lcd.height, 0, 0, LOGICAL_W, LOGICAL_H);

        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, dstW, dstH);
        ctx.drawImage(tmp, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
        updateProbe(info);
    }

    function onLcdFlush() {
        if (!state.open && !shouldShowFor(readSpe())) {
            return;
        }
        if (!state.open) {
            applyChrome();
            return;
        }
        blit();
    }

    function onEngineSpe() {
        applyChrome();
    }

    function skipOpening() {
        var info = readSpe();
        if (kindOf(info) === 1) {
            engineSendKey(VK_ENTER);
        }
    }

    function bindUi() {
        if (state.bound) {
            return;
        }
        var root = el('hd-spe');
        if (!root) {
            return;
        }
        state.bound = true;
        root.addEventListener('click', function (ev) {
            var t = ev.target;
            if (!t || !t.getAttribute) {
                return;
            }
            if (t.getAttribute('data-hd-spe-skip') != null) {
                skipOpening();
            }
            if (t.getAttribute('data-hd-spe-lcd') != null) {
                engineSendKey(VK_EXIT);
            }
        });
    }

    function start() {
        bindUi();
        applyChrome();
    }

    global.BayeHdSpe = {
        shouldShowHd: function () {
            return openingHd() || battleHd();
        },
        isHandling: isHandling,
        isOpen: function () { return state.open; },
        onLcdFlush: onLcdFlush,
        onEngineSpe: onEngineSpe,
        skip: skipOpening,
        blit: blit,
        start: start,
        applyPcPage: start,
        debugSnapshot: function () {
            var info = readSpe();
            return {
                open: state.open,
                scale: state.scale,
                canvasW: state.canvasW,
                canvasH: state.canvasH,
                spe: info
            };
        }
    };
})(window);
