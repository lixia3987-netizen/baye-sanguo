/**
 * HD 战场表现壳（B0 / B1）。
 * 只读 fight 数组 + sendKey；不 stub 会替换系统菜单的 hook。
 * 规格：docs/hd-battle-spec.md
 */
(function (global) {
    var STORAGE_KEY = 'baye/battleMode';
    var OVERWORLD_KEY = 'baye/overworldMode';
    var DESIGN_W = 1920;
    var DESIGN_H = 1080;
    var FIGHT_HOOKS = {
        fightOpenMainMenu: 1,
        meetFight: 1,
        drawMapUnit: 1,
        drawOneGeneral: 1,
        fightChooseAction: 1,
        fightStatusBarTouched: 1,
        enterBattle: 1,
        exitBattle: 1,
        battleStage1: 1
    };

    var state = {
        open: false,
        preview: false,
        lastHook: '',
        lastHookAt: 0,
        mapW: 0,
        mapH: 0,
        tiles: [],
        units: [],
        focus: { x: null, y: null },
        showLcd: true,
        bound: false,
        loopId: 0,
        probed: false
    };

    function readStorage(key, fallback) {
        try {
            var value = global.localStorage.getItem(key);
            if (value === null || value === '') {
                return fallback;
            }
            return value;
        } catch (e) {
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            global.localStorage.setItem(key, String(value));
        } catch (e) {}
    }

    function normalizeMode(value) {
        if (value === 'hd' || value === 'classic') {
            return value;
        }
        return 'auto';
    }

    function getMode() {
        return normalizeMode(readStorage(STORAGE_KEY, 'auto'));
    }

    function overworldIsHd() {
        if (global.BayeHdOverworld && typeof BayeHdOverworld.getMode === 'function') {
            return BayeHdOverworld.getMode() === 'hd-map';
        }
        return readStorage(OVERWORLD_KEY, 'classic') === 'hd-map';
    }

    function shouldShowHd() {
        var mode = getMode();
        if (mode === 'classic') {
            return false;
        }
        if (mode === 'hd') {
            return true;
        }
        return overworldIsHd();
    }

    function el(id) {
        return document.getElementById(id);
    }

    function listProps(obj) {
        if (!obj) {
            return [];
        }
        if (obj._baye_properties && obj._baye_properties.length) {
            return obj._baye_properties.slice();
        }
        var keys = [];
        var k;
        for (k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k) && k.charAt(0) !== '_') {
                keys.push(k);
            }
        }
        return keys;
    }

    function readNumber(obj, name) {
        if (!obj || obj[name] === undefined || obj[name] === null) {
            return null;
        }
        var v = obj[name];
        if (v && typeof v === 'object' && 'value' in v) {
            v = v.value;
        }
        v = Number(v);
        return isFinite(v) ? v : null;
    }

    function engineData() {
        return window.baye && baye.data ? baye.data : null;
    }

    function fightArrayCount() {
        var data = engineData();
        var arr = data && data.g_FgtParam && data.g_FgtParam.GenArray;
        if (!arr) {
            return 0;
        }
        var n = 0;
        var i;
        var len = arr.length || 20;
        for (i = 0; i < len && i < 24; i++) {
            var id = readNumber(arr, i);
            if (id === null && arr[i] != null) {
                id = Number(arr[i]);
            }
            if (id) {
                n += 1;
            }
        }
        return n;
    }

    function fightLooksActive() {
        if (state.lastHook && FIGHT_HOOKS[state.lastHook] && (Date.now() - state.lastHookAt) < 8000) {
            return true;
        }
        return fightArrayCount() >= 2;
    }

    function inferMapSize(len) {
        var cands = [12, 16, 18, 15, 10, 8, 20, 24];
        var i;
        for (i = 0; i < cands.length; i++) {
            if (len % cands[i] === 0) {
                var w = cands[i];
                var h = len / w;
                if (h >= 8 && h <= 32) {
                    return { w: w, h: h };
                }
            }
        }
        var side = Math.round(Math.sqrt(len));
        return { w: side || 16, h: side || 16 };
    }

    function sampleFight() {
        var data = engineData();
        var info = {
            genCount: fightArrayCount(),
            mapLen: 0,
            units: [],
            focus: { x: null, y: null },
            mapW: 0,
            mapH: 0,
            tiles: [],
            keys: []
        };
        if (!data) {
            return info;
        }
        info.keys = listProps(data).filter(function (name) {
            return /fight|fgt|genpos|tile/i.test(name);
        });
        if (data.g_FightMap && data.g_FightMap.length) {
            info.mapLen = data.g_FightMap.length;
            var sz = inferMapSize(info.mapLen);
            info.mapW = sz.w;
            info.mapH = sz.h;
            var t;
            for (t = 0; t < info.mapLen; t++) {
                var tv = readNumber(data.g_FightMap, t);
                if (tv === null && data.g_FightMap[t] != null) {
                    tv = Number(data.g_FightMap[t]);
                }
                info.tiles.push(tv || 0);
            }
        }
        info.focus.x = readNumber(data, 'g_FoucsX');
        info.focus.y = readNumber(data, 'g_FoucsY');
        var arr = data.g_FgtParam && data.g_FgtParam.GenArray;
        var pos = data.g_GenPos;
        var i;
        for (i = 0; i < 20; i++) {
            var id = arr ? readNumber(arr, i) : null;
            if (id === null && arr && arr[i] != null) {
                id = Number(arr[i]);
            }
            if (!id) {
                continue;
            }
            var p = pos && pos[i] ? pos[i] : {};
            var name = '';
            try {
                if (typeof baye.getPersonName === 'function') {
                    name = baye.getPersonName(id - 1) || '';
                }
            } catch (e) {}
            info.units.push({
                i: i,
                id: id,
                name: name,
                x: readNumber(p, 'x'),
                y: readNumber(p, 'y'),
                hp: readNumber(p, 'hp'),
                active: readNumber(p, 'active'),
                side: i < 10 ? 'player' : 'enemy'
            });
        }
        if (!state.probed) {
            state.probed = true;
            console.log('[hd-battle] probe', info);
        }
        return info;
    }

    function applyChrome() {
        var show = state.open && shouldShowHd();
        document.documentElement.setAttribute('data-baye-battle', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-battle-pref', getMode());
        if (document.body) {
            document.body.classList.toggle('baye-hd-battle-on', show);
            document.body.classList.toggle('baye-hd-battle-lcd', show && state.showLcd);
        }
        var root = el('hd-battle');
        if (root) {
            root.classList.toggle('is-open', show);
            root.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
        var hud = el('hd-battle-hud');
        if (hud) {
            hud.textContent = (state.preview ? 'HD 战场预览 · ' : 'HD 战场 · ') +
                (state.lastHook || '无 hook') +
                ' · 将=' + state.units.length +
                ' · 图=' + (state.mapW ? (state.mapW + '×' + state.mapH) : '无');
        }
    }

    function draw() {
        var canvas = el('hd-battle-canvas');
        if (!canvas) {
            return;
        }
        var ctx = canvas.getContext('2d');
        var dpr = global.devicePixelRatio || 1;
        if (dpr > 2) {
            dpr = 2;
        }
        var w = Math.round(DESIGN_W * dpr);
        var h = Math.round(DESIGN_H * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
        ctx.fillStyle = '#12161d';
        ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

        var pad = 80;
        var boardW = DESIGN_W - pad * 2;
        var boardH = DESIGN_H - 160;
        var cols = state.mapW || 16;
        var rows = state.mapH || 12;
        var cw = boardW / cols;
        var ch = boardH / rows;
        var ox = pad;
        var oy = 72;
        var r;
        var c;
        var pal = ['#2f5d32', '#c2b280', '#6b5a4a', '#1f4d2e', '#8a6a3a', '#7a3a3a', '#5a4a3a', '#2a4a6a'];
        var painted = 0;
        if (state.tiles && state.tiles.length) {
            for (r = 0; r < state.tiles.length; r++) {
                if (state.tiles[r]) {
                    painted += 1;
                }
            }
        }
        var useTiles = state.tiles && state.tiles.length && cols && rows && (painted || !state.preview);
        for (r = 0; r < rows; r++) {
            for (c = 0; c < cols; c++) {
                if (useTiles) {
                    var tile = state.tiles[r * cols + c] || 0;
                    ctx.fillStyle = pal[Math.abs(tile) % pal.length];
                    ctx.globalAlpha = 0.62;
                } else {
                    ctx.fillStyle = (r + c) % 2 ? '#1a2030' : '#161b26';
                    ctx.globalAlpha = 1;
                }
                ctx.fillRect(ox + c * cw, oy + r * ch, cw + 0.5, ch + 0.5);
            }
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        for (r = 0; r <= rows; r++) {
            ctx.beginPath();
            ctx.moveTo(ox, oy + r * ch);
            ctx.lineTo(ox + cols * cw, oy + r * ch);
            ctx.stroke();
        }
        for (c = 0; c <= cols; c++) {
            ctx.beginPath();
            ctx.moveTo(ox + c * cw, oy);
            ctx.lineTo(ox + c * cw, oy + rows * ch);
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(220,226,236,0.45)';
        ctx.font = '11px BayeUI, sans-serif';
        ctx.textAlign = 'center';
        for (c = 0; c < cols; c += Math.max(1, Math.floor(cols / 8))) {
            ctx.fillText(String(c), ox + (c + 0.5) * cw, oy - 8);
        }
        ctx.textAlign = 'right';
        for (r = 0; r < rows; r += Math.max(1, Math.floor(rows / 8))) {
            ctx.fillText(String(r), ox - 8, oy + (r + 0.65) * ch);
        }
        if (state.focus.x != null && state.focus.y != null) {
            ctx.strokeStyle = '#f0c75a';
            ctx.lineWidth = 3;
            ctx.strokeRect(ox + state.focus.x * cw + 2, oy + state.focus.y * ch + 2, cw - 4, ch - 4);
        }
        var i;
        var drawn = 0;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u.x == null || u.y == null) {
                continue;
            }
            drawn += 1;
            var ux = ox + (u.x + 0.5) * cw;
            var uy = oy + (u.y + 0.5) * ch;
            var rad = Math.min(cw, ch) * 0.3;
            ctx.beginPath();
            ctx.fillStyle = u.side === 'player' ? '#3d8bfd' : '#c43c3c';
            ctx.arc(ux, uy, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = u.active ? '#f4f7fb' : 'rgba(244,247,251,0.35)';
            ctx.lineWidth = 2;
            ctx.stroke();
            if (u.hp != null) {
                ctx.fillStyle = '#1b1f27';
                ctx.fillRect(ux - rad, uy + rad * 0.55, rad * 2, 5);
                ctx.fillStyle = '#6bcf7a';
                ctx.fillRect(ux - rad, uy + rad * 0.55, rad * 2 * Math.max(0, Math.min(1, u.hp / 100)), 5);
            }
            ctx.fillStyle = '#f4f7fb';
            ctx.font = '13px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(u.name || ('#' + u.i), ux, uy - rad - 4);
        }
        ctx.textAlign = 'left';
        ctx.font = '15px BayeUI, "Noto Sans CJK SC", sans-serif';
        ctx.fillStyle = '#9aa6b8';
        ctx.fillText('蓝=己方  红=敌方  ·  格色来自 g_FightMap 图元  ·  无坐标的将不画', ox, oy + rows * ch + 28);
        if (!drawn) {
            ctx.fillStyle = 'rgba(243,246,251,0.82)';
            ctx.font = '22px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(state.preview
                ? '预览棋盘。进战斗后从 g_GenPos / GenArray 画将。'
                : '等待 fight hook 或 g_GenPos 坐标…', DESIGN_W / 2, DESIGN_H / 2);
        }
    }

    function refresh() {
        var info = sampleFight();
        state.units = info.units;
        state.mapW = info.mapW;
        state.mapH = info.mapH;
        state.tiles = info.tiles;
        state.focus = info.focus;
        applyChrome();
        draw();
    }

    function loop() {
        if (!state.open) {
            state.loopId = 0;
            return;
        }
        refresh();
        if (!state.preview && !fightLooksActive() && state.lastHook && (Date.now() - state.lastHookAt) > 12000) {
            closeBattle({ silent: true });
            return;
        }
        state.loopId = global.requestAnimationFrame(loop);
    }

    function ensureLoop() {
        if (state.open && !state.loopId) {
            state.loopId = global.requestAnimationFrame(loop);
        }
    }

    function enterBattle(meta) {
        meta = meta || {};
        if (!shouldShowHd()) {
            return false;
        }
        if (global.BayeHdCityMenu && BayeHdCityMenu.isOpen()) {
            BayeHdCityMenu.close({ silent: true });
        }
        state.open = true;
        state.preview = !!meta.preview;
        if (meta.hook) {
            state.lastHook = meta.hook;
            state.lastHookAt = Date.now();
        }
        applyChrome();
        refresh();
        ensureLoop();
        console.log('[hd-battle] enter', meta.hook || (state.preview ? 'preview' : 'detect'));
        return true;
    }

    function closeBattle(opts) {
        opts = opts || {};
        state.open = false;
        state.preview = false;
        if (state.loopId) {
            global.cancelAnimationFrame(state.loopId);
            state.loopId = 0;
        }
        applyChrome();
        if (!opts.silent) {
            console.log('[hd-battle] close');
        }
    }

    function onEngineHook(name) {
        if (!FIGHT_HOOKS[name]) {
            return;
        }
        state.lastHook = name;
        state.lastHookAt = Date.now();
        if (name === 'exitBattle') {
            refresh();
            return;
        }
        if (shouldShowHd()) {
            enterBattle({ hook: name });
        }
    }

    function bindUi() {
        if (state.bound) {
            return;
        }
        var root = el('hd-battle');
        if (!root) {
            return;
        }
        state.bound = true;
        root.addEventListener('click', function (ev) {
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && t.getAttribute('data-hd-battle-lcd') != null) {
                    state.showLcd = !state.showLcd;
                    applyChrome();
                    t.textContent = state.showLcd ? '隐藏经典 LCD' : '经典 LCD';
                    ev.preventDefault();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-battle-close') != null) {
                    ev.preventDefault();
                    closeBattle({ silent: false });
                    return;
                }
                t = t.parentNode;
            }
        });
    }

    function setMode(value) {
        writeStorage(STORAGE_KEY, normalizeMode(value));
        if (getMode() === 'classic' && state.open) {
            closeBattle({ silent: true });
        }
        applyChrome();
    }

    function start() {
        bindUi();
        applyChrome();
    }

    applyChrome();

    global.BayeHdBattle = {
        STORAGE_KEY: STORAGE_KEY,
        getMode: getMode,
        setMode: setMode,
        shouldShowHd: shouldShowHd,
        isOpen: function () { return state.open; },
        enter: enterBattle,
        close: closeBattle,
        onEngineHook: onEngineHook,
        debugPreview: function () {
            return enterBattle({ preview: true, hook: 'debugPreview' });
        },
        start: start,
        applyPcPage: start,
        debugSnapshot: function () {
            return {
                pref: getMode(),
                showHd: shouldShowHd(),
                open: state.open,
                preview: state.preview,
                lastHook: state.lastHook,
                units: state.units.length,
                mapW: state.mapW,
                mapH: state.mapH,
                genCount: fightArrayCount(),
                focus: state.focus
            };
        }
    };
})(window);
