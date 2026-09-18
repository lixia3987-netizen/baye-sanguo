/**
 * HD 大地图表现壳（P0 容器 + P1 城态/点选）。
 * 不改 WASM / 不改 dat.lib。经典模式默认，可切回。
 * 规格：docs/hd-overworld-spec.md
 */
(function (global) {
    var STORAGE_KEY = 'baye/overworldMode';
    var ASSET_ROOT = 'assets/hd-overworld/';
    var DESIGN_W = 1920;
    var DESIGN_H = 1080;
    var SAFE = { left: 48, top: 72, right: 1872, bottom: 1048 };
    var HIT_RADIUS = 36;
    var PERIOD_NAMES = { 1: '董卓弄权', 2: '曹操崛起', 3: '赤壁之战', 4: '三国鼎立' };

    var YEAR_FIELDS = ['g_YearN', 'g_Year', 'YearN', 'g_DateYear', 'year', 'g_PYear'];
    var MONTH_FIELDS = ['g_MonthN', 'g_Month', 'MonthN', 'g_DateMonth', 'month', 'g_PMonth'];
    var DATE_OBJECT_FIELDS = ['g_DateN', 'g_Date', 'g_GameDate', 'DateN'];
    var CURSOR_FIELDS = [
        'g_CityCrt', 'g_CityCur', 'g_CurCity', 'g_CityIndex',
        'g_CrtCity', 'g_iCity', 'g_currentCity', 'g_CityId', 'g_CityIdx'
    ];
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
    var FOCUS_X_FIELDS = ['g_FoucsX', 'g_FocusX', 'g_MapFocusX'];
    var FOCUS_Y_FIELDS = ['g_FoucsY', 'g_FocusY', 'g_MapFocusY'];
    var MAP_SX_FIELDS = ['g_MapSX', 'g_LandMapSX', 'g_CityMapSX'];
    var MAP_SY_FIELDS = ['g_MapSY', 'g_LandMapSY', 'g_CityMapSY'];

    var NAME_LAYOUT = {
        '西凉': [0, 2], '武威': [0, 1], '安定': [1, 2], '天水': [1, 3],
        '朔方': [2, 0], '长安': [2, 3], '汉中': [2, 5], '西川': [1, 6],
        '并州': [3, 1], '上党': [4, 2], '弘农': [3, 3], '洛阳': [4, 3],
        '冀州': [5, 1], '渤海': [6, 1], '平原': [6, 2], '北海': [7, 2],
        '濮阳': [5, 2], '陈留': [5, 3], '许昌': [5, 4], '豫州': [4, 4],
        '汝南': [5, 5], '南阳': [3, 5], '新野': [4, 5], '襄阳': [3, 6],
        '上庸': [2, 6], '江陵': [3, 7], '长沙': [4, 8], '武陵': [2, 8],
        '零陵': [3, 8], '桂阳': [5, 8], '寿春': [6, 4], '庐江': [7, 5],
        '徐州': [7, 3], '下邳': [8, 3], '泰山': [6, 3], '扬州': [7, 6],
        '建业': [8, 5], '吴': [9, 6], '会稽': [10, 7]
    };

    var DEFAULT_PALETTE = {
        empty: '#8a8f98',
        player: '#3d8bfd',
        byBelongId: {},
        fallback: [
            '#e0a14a', '#5cb87a', '#9b6bdb', '#d97b3e', '#4aa3a3', '#c43c3c',
            '#6b8cae', '#d4a574', '#7ec8e3', '#e07bb0', '#b7c75b', '#8d6e63',
            '#5c6bc0', '#ef6c00', '#26a69a', '#8e24aa', '#c0ca33', '#546e7a',
            '#ec407a', '#66bb6a', '#29b6f6', '#ff7043', '#ab47bc', '#9ccc65'
        ]
    };

    var state = {
        mode: 'classic',
        phase: 'other',
        canvas: null,
        ctx: null,
        hudLeft: null,
        hudRight: null,
        manifest: null,
        images: {},
        palette: DEFAULT_PALETTE,
        cities: [],
        hoverIndex: -1,
        selectedIndex: -1,
        assetsReady: false,
        assetsLoading: false,
        loopId: 0,
        lastSample: 0,
        lastDraw: 0,
        probed: false,
        hookWrapped: false,
        toolbarBound: false,
        inputBound: false,
        inputFallbackNoted: false,
        alignLog: null,
        aligning: false,
        alignToken: 0,
        alignTimer: 0,
        learnedCursorField: null,
        engineCursorIndex: -1,
        menuDepth: 0,
        hdOpenedMenu: false,
        dateInfo: { year: null, month: null, source: 'none' },
        sawFightHook: false,
        hint: '经典 LCD 可随时切回。点己方城打开经典城池菜单。'
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
        return value === 'hd-map' ? 'hd-map' : 'classic';
    }

    function getMode() {
        return normalizeMode(readStorage(STORAGE_KEY, 'classic'));
    }

    function applyEarlyDocumentAttrs() {
        var mode = getMode();
        document.documentElement.setAttribute('data-baye-overworld', mode);
        state.mode = mode;
    }

    function probe() {
        return global.BayeHdOverworldProbe || null;
    }

    function readNumber(obj, name) {
        var p = probe();
        if (p && typeof p.readNumber === 'function') {
            return p.readNumber(obj, name);
        }
        if (!obj || obj[name] === undefined || obj[name] === null) {
            return null;
        }
        var v = obj[name];
        v = Number(v);
        return isFinite(v) ? v : null;
    }

    function pickField(data, names) {
        var p = probe();
        if (p && typeof p.pickFirstNumber === 'function') {
            return p.pickFirstNumber(data, names);
        }
        if (!data) {
            return null;
        }
        for (var i = 0; i < names.length; i++) {
            var v = readNumber(data, names[i]);
            if (v !== null) {
                return { name: names[i], value: v };
            }
        }
        return null;
    }

    function writeNumber(obj, name, value) {
        if (!obj || obj[name] === undefined) {
            return false;
        }
        try {
            obj[name] = value;
            return readNumber(obj, name) === value;
        } catch (e) {
            return false;
        }
    }

    function engineData() {
        return window.baye && baye.data ? baye.data : null;
    }

    function loadImage(url, done) {
        var img = new Image();
        img.onload = function () { done(img); };
        img.onerror = function () {
            console.warn('[hd-overworld] missing asset, fallback geometry:', url);
            done(null);
        };
        img.src = url;
    }

    function loadJSON(url, done) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    done(JSON.parse(xhr.responseText));
                } catch (e) {
                    console.warn('[hd-overworld] bad json', url, e);
                    done(null);
                }
            } else {
                console.warn('[hd-overworld] missing', url, xhr.status);
                done(null);
            }
        };
        xhr.send();
    }

    function assetUrl(rel) {
        if (!rel) {
            return null;
        }
        return ASSET_ROOT + rel;
    }

    function loadAssets(done) {
        if (state.assetsReady || state.assetsLoading) {
            if (state.assetsReady && done) {
                done();
            }
            return;
        }
        state.assetsLoading = true;
        loadJSON(assetUrl('manifest.json'), function (manifest) {
            state.manifest = manifest || {
                designWidth: DESIGN_W,
                designHeight: DESIGN_H,
                layers: {
                    terrain: [
                        'terrain/base_plains.png',
                        'terrain/overlay_mountains.png',
                        'terrain/overlay_rivers.png',
                        'terrain/overlay_forest.png'
                    ],
                    cities: {
                        empty: 'cities/marker_empty.png',
                        neutral: 'cities/marker_neutral.png',
                        owned: 'cities/marker_owned.png',
                        selected: 'cities/marker_selected.png'
                    }
                }
            };
            var layers = state.manifest.layers || {};
            var pending = [];
            function add(key, rel) {
                if (rel) {
                    pending.push({ key: key, url: assetUrl(rel) });
                }
            }
            var terrain = layers.terrain || [];
            for (var i = 0; i < terrain.length; i++) {
                add('terrain:' + i + ':' + terrain[i], terrain[i]);
            }
            var cities = layers.cities || {};
            add('city:empty', cities.empty);
            add('city:neutral', cities.neutral);
            add('city:owned', cities.owned);
            add('city:selected', cities.selected);
            var ui = layers.ui || {};
            add('ui:cursor', ui.cursor);
            add('ui:cursorHover', ui.cursorHover);
            var paletteRel = layers.palette || 'palette/factions.json';

            var left = pending.length + 1;
            function tick() {
                left -= 1;
                if (left <= 0) {
                    state.assetsReady = true;
                    state.assetsLoading = false;
                    if (done) {
                        done();
                    }
                }
            }
            loadJSON(assetUrl(paletteRel), function (palette) {
                if (palette) {
                    state.palette = palette;
                }
                tick();
            });
            for (var p = 0; p < pending.length; p++) {
                (function (item) {
                    loadImage(item.url, function (img) {
                        if (img) {
                            state.images[item.key] = img;
                        }
                        tick();
                    });
                })(pending[p]);
            }
        });
    }

    function terrainImages() {
        var list = [];
        var keys = Object.keys(state.images);
        keys.sort();
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('terrain:') === 0 && state.images[keys[i]]) {
                list.push(state.images[keys[i]]);
            }
        }
        return list;
    }

    function playerKingId() {
        var data = engineData();
        if (!data) {
            return null;
        }
        var raw = readNumber(data, 'g_PlayerKing');
        if (raw === null || raw === 0xff || raw === 255 || raw === 0xffff) {
            return null;
        }
        return raw + 1;
    }

    function cityName(index) {
        try {
            if (window.baye && typeof baye.getCityName === 'function') {
                var n = baye.getCityName(index);
                if (n) {
                    return n;
                }
            }
        } catch (e) {}
        return '城' + (index + 1);
    }

    function cityKind(city, kingId) {
        if (!city) {
            return 'empty';
        }
        var belong = city.Belong;
        if (belong === undefined || belong === null) {
            return 'empty';
        }
        belong = Number(belong);
        if (!belong || belong === 0xff || belong === 255) {
            return 'empty';
        }
        if (kingId && belong === kingId) {
            return 'owned';
        }
        return 'neutral';
    }

    function activePalette() {
        var pal = state.palette || {};
        var fallback = DEFAULT_PALETTE.fallback.slice();
        if (pal.fallback && pal.fallback.length) {
            var i;
            for (i = 0; i < pal.fallback.length; i++) {
                if (fallback.indexOf(pal.fallback[i]) < 0) {
                    fallback.push(pal.fallback[i]);
                }
            }
            fallback = pal.fallback.concat(DEFAULT_PALETTE.fallback);
        }
        return {
            empty: pal.empty || DEFAULT_PALETTE.empty,
            player: pal.player || DEFAULT_PALETTE.player,
            byBelongId: pal.byBelongId || {},
            fallback: fallback
        };
    }

    function factionColor(belong) {
        var pal = activePalette();
        if (!belong || belong === 0xff || belong === 255) {
            return pal.empty;
        }
        var kingId = playerKingId();
        if (kingId && belong === kingId) {
            return pal.player;
        }
        if (pal.byBelongId && pal.byBelongId[String(belong)]) {
            return pal.byBelongId[String(belong)];
        }
        var fb = pal.fallback;
        return fb[Math.abs(belong * 17) % fb.length];
    }

    function mapEngineToHd(engX, engY, bounds) {
        var layoutW = SAFE.right - SAFE.left;
        var layoutH = SAFE.bottom - SAFE.top;
        var spanX = Math.max(1, bounds.maxX - bounds.minX);
        var spanY = Math.max(1, bounds.maxY - bounds.minY);
        return {
            x: SAFE.left + (engX - bounds.minX) / spanX * layoutW,
            y: SAFE.top + (engY - bounds.minY) / spanY * layoutH
        };
    }

    function sampleCities() {
        var data = engineData();
        var rawPos = data && data.g_CityPositions;
        var rawCities = data && data.g_Cities;
        var n = 38;
        if (rawCities && rawCities.length) {
            n = rawCities.length;
        } else if (rawPos && rawPos.length) {
            n = rawPos.length;
        }

        var rows = [];
        var minX = Infinity;
        var maxX = -Infinity;
        var minY = Infinity;
        var maxY = -Infinity;
        var usedEngine = 0;
        var usedName = 0;
        var usedGrid = 0;
        var kingId = playerKingId();

        for (var i = 0; i < n; i++) {
            var city = rawCities && rawCities[i] ? rawCities[i] : null;
            var name = cityName(i);
            var pos = rawPos && rawPos[i];
            var engX = pos ? readNumber(pos, 'x') : null;
            var engY = pos ? readNumber(pos, 'y') : null;
            var source = 'grid';
            if (engX !== null && engY !== null && !(engX === 0 && engY === 0 && i > 0)) {
                source = 'engine';
                usedEngine += 1;
            } else if (NAME_LAYOUT[name]) {
                engX = NAME_LAYOUT[name][0];
                engY = NAME_LAYOUT[name][1];
                source = 'name';
                usedName += 1;
            } else {
                engX = i % 12;
                engY = Math.floor(i / 12);
                usedGrid += 1;
            }
            var belong = city ? readNumber(city, 'Belong') : 0;
            if (belong === null) {
                belong = Number(city && city.Belong);
                if (!isFinite(belong)) {
                    belong = 0;
                }
            }
            rows.push({
                index: i,
                name: name,
                engX: engX,
                engY: engY,
                source: source,
                belong: belong,
                kind: cityKind(city, kingId),
                color: factionColor(belong),
                city: city
            });
            minX = Math.min(minX, engX);
            maxX = Math.max(maxX, engX);
            minY = Math.min(minY, engY);
            maxY = Math.max(maxY, engY);
        }

        if (minX === maxX) {
            minX -= 1;
            maxX += 1;
        }
        if (minY === maxY) {
            minY -= 1;
            maxY += 1;
        }

        var bounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
        var labels = [];
        for (var r = 0; r < rows.length; r++) {
            var hd = mapEngineToHd(rows[r].engX, rows[r].engY, bounds);
            rows[r].hdX = hd.x;
            rows[r].hdY = hd.y;
            rows[r].labelY = hd.y + 44;
            labels.push(rows[r]);
        }
        dodgeLabels(rows);

        if (!state.probed) {
            state.probed = true;
            console.log('[hd-overworld] calibration', {
                count: n,
                min: [minX, minY],
                max: [maxX, maxY],
                span: [maxX - minX, maxY - minY],
                usedEngine: usedEngine,
                usedNameLayout: usedName,
                usedGrid: usedGrid,
                safe: SAFE
            });
            for (var c = 0; c < rows.length; c++) {
                console.log('[hd-overworld] city', rows[c].index, rows[c].name,
                    'eng=', rows[c].engX, rows[c].engY,
                    'hd=', Math.round(rows[c].hdX), Math.round(rows[c].hdY),
                    'src=', rows[c].source, 'belong=', rows[c].belong);
            }
            if (global.BayeHdOverworldProbe) {
                global.BayeHdOverworldProbe.run();
            }
        }

        state.cities = rows;
        refreshDateInfo();
        return rows;
    }

    function dodgeLabels(rows) {
        var labels = rows.slice().sort(function (a, b) {
            return a.hdY - b.hdY || a.hdX - b.hdX;
        });
        for (var a = 0; a < labels.length; a++) {
            labels[a].labelX = labels[a].hdX;
            labels[a].labelY = labels[a].hdY + 44;
            var guard = 0;
            while (guard++ < 8) {
                var hit = false;
                for (var b = 0; b < a; b++) {
                    if (Math.abs(labels[a].labelX - labels[b].labelX) < 72 &&
                        Math.abs(labels[a].labelY - labels[b].labelY) < 20) {
                        labels[a].labelY = labels[b].labelY + 20;
                        hit = true;
                    }
                }
                if (!hit) {
                    break;
                }
            }
            if (labels[a].labelY > SAFE.bottom - 8) {
                labels[a].labelY = labels[a].hdY - 52;
            }
        }
    }

    function inCampaign() {
        var p = readNumber(engineData(), 'g_PIdx');
        return p !== null && p >= 1 && p <= 8;
    }

    function isFightActive() {
        return !!state.sawFightHook;
    }

    function citiesHaveBelong(data) {
        if (!data || !data.g_Cities || !data.g_Cities.length) {
            return false;
        }
        for (var i = 0; i < data.g_Cities.length; i++) {
            var b = readNumber(data.g_Cities[i], 'Belong');
            if (b === null) {
                b = Number(data.g_Cities[i].Belong);
            }
            if (b && b !== 0xff && b !== 255) {
                return true;
            }
        }
        return false;
    }

    function inferPhase() {
        if (state.phase === 'classic-menu') {
            return 'classic-menu';
        }
        var data = engineData();
        if (!data) {
            return 'other';
        }
        if (isFightActive()) {
            return 'other';
        }
        if (inCampaign() && (citiesHaveBelong(data) || playerKingId() !== null || (state.cities && state.cities.length >= 20))) {
            return 'map';
        }
        if (playerKingId() !== null && citiesHaveBelong(data)) {
            return 'map';
        }
        return 'other';
    }

    function hitsEnabled() {
        return state.mode === 'hd-map' && state.phase === 'map' && !state.aligning;
    }

    function setPhase(phase) {
        if (state.phase === phase) {
            applyChrome();
            return;
        }
        state.phase = phase;
        applyChrome();
    }

    function onHook(name) {
        if (name === 'cityMakeCommand') {
            state.menuDepth = Math.max(2, state.menuDepth + 1);
            setPhase('classic-menu');
            state.hint = '经典城池菜单。空格关子菜单；再空格或点地图空白回 HD。';
            return;
        }
        if (name === 'willCloseMenu' && state.phase === 'classic-menu') {
            state.menuDepth = Math.max(0, state.menuDepth - 1);
            if (state.menuDepth <= 0) {
                leaveClassicMenu('已回到大地图。点城打开经典菜单。');
            }
            return;
        }
        if (name === 'didOpenNewGame' || name === 'didLoadGame') {
            state.probed = false;
            state.sawFightHook = false;
            sampleCities();
            state.phase = 'other';
            state.hint = '开局/读档后进入大地图才会同步城池归属。';
            applyChrome();
            return;
        }
        if (name === 'chooseActor' || name === 'chooseGameEntry' || name === 'loadPeriod') {
            setPhase('other');
            return;
        }
        if (name === 'fightOpenMainMenu' || name === 'meetFight') {
            state.sawFightHook = true;
            setPhase('other');
            state.hint = '战斗仍走经典 LCD。';
        }
    }

    function wrapCallHook() {
        if (state.hookWrapped || !window.baye || typeof baye.callHook !== 'function') {
            return;
        }
        var orig = baye.callHook;
        baye.callHook = function (name, context) {
            try {
                onHook(name, context);
            } catch (e) {
                console.warn('[hd-overworld] hook', name, e);
            }
            return orig.apply(this, arguments);
        };
        state.hookWrapped = true;
    }

    function syncCanvasSize() {
        if (!state.canvas || !state.ctx) {
            return;
        }
        var dpr = global.devicePixelRatio || 1;
        if (dpr > 2) {
            dpr = 2;
        }
        var w = Math.round(DESIGN_W * dpr);
        var h = Math.round(DESIGN_H * dpr);
        if (state.canvas.width !== w || state.canvas.height !== h) {
            state.canvas.width = w;
            state.canvas.height = h;
        }
        state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawFallbackContinent(ctx) {
        ctx.save();
        var grd = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
        grd.addColorStop(0, '#1a3a28');
        grd.addColorStop(1, '#2d4a30');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
        ctx.fillStyle = '#3d6a45';
        ctx.beginPath();
        ctx.ellipse(960, 560, 780, 390, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawTerrain(ctx) {
        var layers = terrainImages();
        if (!layers.length) {
            drawFallbackContinent(ctx);
            return;
        }
        for (var i = 0; i < layers.length; i++) {
            try {
                ctx.drawImage(layers[i], 0, 0, DESIGN_W, DESIGN_H);
            } catch (e) {}
        }
    }

    function markerImage(kind, selected) {
        if (selected && state.images['city:selected']) {
            return state.images['city:selected'];
        }
        var key = 'city:' + kind;
        return state.images[key] || state.images['city:neutral'] || state.images['city:empty'] || null;
    }

    function drawCities(ctx, now) {
        var cities = state.cities;
        for (var i = 0; i < cities.length; i++) {
            var city = cities[i];
            var selected = city.index === state.selectedIndex;
            var hover = city.index === state.hoverIndex && hitsEnabled();
            var base = markerImage(city.kind, false);
            var sel = selected ? markerImage(city.kind, true) : null;
            var size = selected ? 64 : 56;

            ctx.beginPath();
            ctx.fillStyle = city.color;
            ctx.globalAlpha = city.kind === 'empty' ? 0.28 : 0.42;
            ctx.arc(city.hdX, city.hdY + 6, selected ? 22 : 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            if (base) {
                ctx.drawImage(base, city.hdX - size / 2, city.hdY - size / 2 - 8, size, size);
            } else {
                ctx.beginPath();
                ctx.fillStyle = city.color;
                ctx.arc(city.hdX, city.hdY, selected ? 14 : 11, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#1b1f27';
                ctx.stroke();
            }
            if (selected && sel && sel !== base) {
                ctx.drawImage(sel, city.hdX - 40, city.hdY - 48, 80, 80);
            }

            ctx.beginPath();
            ctx.strokeStyle = city.color;
            ctx.lineWidth = selected ? 3.5 : 2.5;
            ctx.arc(city.hdX, city.hdY + 2, selected ? 30 : 24, 0, Math.PI * 2);
            ctx.stroke();

            if (hover) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,244,200,0.95)';
                ctx.lineWidth = 2;
                ctx.arc(city.hdX, city.hdY + 2, 34, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (selected) {
                var pulse = 30 + Math.sin(now / 200) * 4;
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = 2;
                ctx.arc(city.hdX, city.hdY + 2, pulse, 0, Math.PI * 2);
                ctx.stroke();
            }

            var label = city.name || ('城' + (city.index + 1));
            var lx = city.labelX != null ? city.labelX : city.hdX;
            var ly = city.labelY != null ? city.labelY : city.hdY + 44;
            ctx.font = (hover || selected ? 'bold ' : '') + '20px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            var tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(14,17,22,0.72)';
            ctx.fillRect(lx - tw / 2 - 7, ly - 2, tw + 14, 24);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(14,17,22,0.85)';
            ctx.strokeText(label, lx, ly);
            ctx.fillStyle = '#f4f7fb';
            ctx.fillText(label, lx, ly);
        }
    }

    function readNestedNumber(obj, names) {
        if (!obj) {
            return null;
        }
        for (var i = 0; i < names.length; i++) {
            var v = readNumber(obj, names[i]);
            if (v !== null) {
                return { name: names[i], value: v };
            }
        }
        return null;
    }

    function refreshDateInfo() {
        var data = engineData();
        var info = { year: null, month: null, yearPath: null, monthPath: null, source: 'none' };
        if (!data) {
            state.dateInfo = info;
            return info;
        }
        var year = pickField(data, YEAR_FIELDS);
        var month = pickField(data, MONTH_FIELDS);
        if ((!year || !month) && DATE_OBJECT_FIELDS) {
            for (var i = 0; i < DATE_OBJECT_FIELDS.length; i++) {
                var obj = data[DATE_OBJECT_FIELDS[i]];
                if (obj && typeof obj === 'object') {
                    if (!year) {
                        year = readNestedNumber(obj, ['year', 'Year', 'y', 'YearN']);
                        if (year) {
                            year.name = DATE_OBJECT_FIELDS[i] + '.' + year.name;
                        }
                    }
                    if (!month) {
                        month = readNestedNumber(obj, ['month', 'Month', 'm', 'MonthN']);
                        if (month) {
                            month.name = DATE_OBJECT_FIELDS[i] + '.' + month.name;
                        }
                    }
                }
            }
        }
        if ((!year || !month) && global.BayeHdOverworldProbe && typeof BayeHdOverworldProbe.guessDate === 'function') {
            var guess = BayeHdOverworldProbe.guessDate(data);
            if (!year && guess.year && (!guess.year.weak || inCampaign())) {
                year = guess.year;
            }
            if (!month && guess.month) {
                month = guess.month;
            }
        }
        if (year && year.value >= 180 && year.value <= 300) {
            info.year = year.value;
            info.yearPath = year.name || year.path;
            info.source = 'probe';
        }
        if (month && month.value >= 1 && month.value <= 12) {
            info.month = month.value;
            info.monthPath = month.name || month.path;
            if (info.source === 'none') {
                info.source = 'probe';
            }
        }
        state.dateInfo = info;
        return info;
    }

    function dateLabel() {
        var info = state.dateInfo || refreshDateInfo();
        var period = readNumber(engineData(), 'g_PIdx');
        var periodName = period && PERIOD_NAMES[period] ? PERIOD_NAMES[period] : '';
        if (info.year != null && info.month != null) {
            return info.year + '年' + info.month + '月';
        }
        if (info.year != null) {
            return info.year + '年';
        }
        if (periodName) {
            return periodName + ' · 年月未探测到';
        }
        return '年月未探测到';
    }

    function kingLabel() {
        var data = engineData();
        if (!data) {
            return '';
        }
        var id = playerKingId();
        if (!id) {
            return '';
        }
        try {
            if (window.baye && typeof baye.getPersonNameByID === 'function') {
                return baye.getPersonNameByID(id);
            }
            if (window.baye && typeof baye.getPersonName === 'function') {
                return baye.getPersonName(id - 1);
            }
        } catch (e) {}
        return '';
    }

    function updateHud() {
        if (!state.hudLeft || !state.hudRight) {
            return;
        }
        var date = dateLabel();
        var king = kingLabel();
        var title = date;
        if (king) {
            title += '  ·  ' + king;
        }
        if (state.phase === 'other') {
            title += '  ·  预览';
        } else if (state.phase === 'classic-menu') {
            title += '  ·  经典菜单';
        }
        state.hudLeft.textContent = title;
        var n = state.cities.length;
        var extra = state.hint || '';
        state.hudRight.textContent = n + ' 城  ·  ' + extra;
    }

    function draw() {
        if (!state.ctx) {
            return;
        }
        syncCanvasSize();
        var ctx = state.ctx;
        var now = Date.now();
        ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
        drawTerrain(ctx);
        drawCities(ctx, now);
        updateHud();
        state.lastDraw = now;
    }

    function sampleEngine() {
        var inferred = inferPhase();
        if (inferred !== state.phase) {
            if (!(state.phase === 'classic-menu' && inferred === 'map')) {
                state.phase = inferred;
            }
        }
        sampleCities();
        if (state.phase === 'map' && !state.aligning) {
            var cursor = inferCurrentCity();
            if (validCityIndex(cursor)) {
                state.engineCursorIndex = cursor;
                if (state.selectedIndex < 0) {
                    state.selectedIndex = cursor;
                }
            }
        }
        applyChrome();
    }

    function loop() {
        if (state.mode !== 'hd-map') {
            state.loopId = 0;
            return;
        }
        var now = Date.now();
        if (now - state.lastSample > 160) {
            sampleEngine();
            state.lastSample = now;
        }
        draw();
        state.loopId = global.requestAnimationFrame(loop);
    }

    function ensureLoop() {
        if (state.mode === 'hd-map' && !state.loopId) {
            state.loopId = global.requestAnimationFrame(loop);
        }
    }

    function applyChrome() {
        var mode = getMode();
        state.mode = mode;
        document.documentElement.setAttribute('data-baye-overworld', mode);
        var body = document.body;
        if (!body) {
            return;
        }
        var show = mode === 'hd-map';
        body.classList.toggle('baye-hd-overworld-on', show);
        body.classList.toggle('baye-hd-overworld-map', show && state.phase === 'map');
        body.classList.toggle('baye-hd-overworld-menu', show && state.phase === 'classic-menu');
        body.classList.toggle('baye-hd-overworld-preview', show && state.phase === 'other');
        body.classList.toggle('baye-hd-overworld-aligning', show && state.aligning);
        var layer = document.getElementById('hd-overworld');
        if (layer) {
            layer.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
        syncToolbar();
    }

    function syncToolbar() {
        var toolbar = document.getElementById('baye-hd-toolbar');
        if (!toolbar) {
            return;
        }
        var mode = getMode();
        var buttons = toolbar.querySelectorAll('[data-hd-overworld]');
        for (var i = 0; i < buttons.length; i++) {
            var active = buttons[i].getAttribute('data-hd-overworld') === mode;
            buttons[i].classList.toggle('is-active', active);
            buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
        }
    }

    function bindToolbar() {
        var toolbar = document.getElementById('baye-hd-toolbar');
        if (!toolbar || state.toolbarBound) {
            return;
        }
        state.toolbarBound = true;
        toolbar.addEventListener('click', function (event) {
            var el = event.target;
            while (el && el !== toolbar) {
                if (el.tagName === 'BUTTON' && el.getAttribute('data-hd-overworld')) {
                    setMode(el.getAttribute('data-hd-overworld'));
                    return;
                }
                el = el.parentNode;
            }
        });
    }

    function eventToDesign(ev) {
        var rect = state.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return null;
        }
        return {
            x: (ev.clientX - rect.left) / rect.width * DESIGN_W,
            y: (ev.clientY - rect.top) / rect.height * DESIGN_H
        };
    }

    function hitCity(pt) {
        var best = -1;
        var bestD = HIT_RADIUS;
        for (var i = 0; i < state.cities.length; i++) {
            var c = state.cities[i];
            var dx = pt.x - c.hdX;
            var dy = pt.y - c.hdY;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < bestD) {
                bestD = d;
                best = c.index;
            }
        }
        return best;
    }

    function engineSendKey(code) {
        if (typeof sendKey === 'function') {
            sendKey(code);
            return true;
        }
        if (window.baye && typeof baye.sendKey === 'function') {
            baye.sendKey(code);
            return true;
        }
        return false;
    }

    function sendTouch(x, y) {
        if (typeof _bayeSendTouchEvent !== 'function') {
            return false;
        }
        try {
            _bayeSendTouchEvent(1, x, y);
            _bayeSendTouchEvent(2, x, y);
            return true;
        } catch (e) {
            return false;
        }
    }

    function validCityIndex(value) {
        return value !== null && value >= 0 && value < state.cities.length;
    }

    function snapshotIndexFields() {
        var data = engineData();
        var snap = {};
        if (!data) {
            return snap;
        }
        var names = CURSOR_FIELDS.slice();
        if (state.learnedCursorField && names.indexOf(state.learnedCursorField) < 0) {
            names.push(state.learnedCursorField);
        }
        var extra = [];
        if (global.BayeHdOverworldProbe && data._baye_properties) {
            extra = data._baye_properties;
        }
        var i;
        for (i = 0; i < names.length; i++) {
            snap[names[i]] = readNumber(data, names[i]);
        }
        for (i = 0; i < extra.length; i++) {
            var n = extra[i];
            if (/city|cursor|crt|idx|index/i.test(n) && snap[n] === undefined) {
                snap[n] = readNumber(data, n);
            }
        }
        return snap;
    }

    function learnCursorField(before, after) {
        if (!before || !after) {
            return;
        }
        var name;
        for (name in after) {
            if (!Object.prototype.hasOwnProperty.call(after, name)) {
                continue;
            }
            var a = after[name];
            var b = before[name];
            if (a !== b && validCityIndex(a) && validCityIndex(b)) {
                state.learnedCursorField = name;
                console.log('[hd-overworld] learned cursor field', name, b, '→', a);
                return name;
            }
        }
        return null;
    }

    function inferCurrentCity() {
        var data = engineData();
        if (state.learnedCursorField && data) {
            var learned = readNumber(data, state.learnedCursorField);
            if (validCityIndex(learned)) {
                return learned;
            }
        }
        var cur = pickField(data, CURSOR_FIELDS);
        if (cur && validCityIndex(cur.value)) {
            return cur.value;
        }
        var fx = pickField(data, FOCUS_X_FIELDS);
        var fy = pickField(data, FOCUS_Y_FIELDS);
        if (fx && fy) {
            var nearest = nearestCityToEng(fx.value, fy.value);
            if (nearest >= 0) {
                var city = state.cities[nearest];
                if (Math.abs(city.engX - fx.value) <= 1 && Math.abs(city.engY - fy.value) <= 1) {
                    return nearest;
                }
            }
        }
        if (validCityIndex(state.engineCursorIndex)) {
            return state.engineCursorIndex;
        }
        return -1;
    }

    function nearestCityToEng(x, y) {
        var best = -1;
        var bestD = Infinity;
        for (var i = 0; i < state.cities.length; i++) {
            var dx = state.cities[i].engX - x;
            var dy = state.cities[i].engY - y;
            var d = dx * dx + dy * dy;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    }

    function dirCode(dir) {
        if (dir === 'L') {
            return VK.LEFT;
        }
        if (dir === 'R') {
            return VK.RIGHT;
        }
        if (dir === 'U') {
            return VK.UP;
        }
        return VK.DOWN;
    }

    function nearestCityInDir(fromIdx, dir) {
        var from = state.cities[fromIdx];
        if (!from) {
            return -1;
        }
        var best = -1;
        var bestScore = Infinity;
        for (var i = 0; i < state.cities.length; i++) {
            if (i === fromIdx) {
                continue;
            }
            var dx = state.cities[i].engX - from.engX;
            var dy = state.cities[i].engY - from.engY;
            var score = Infinity;
            if (dir === 'R' && dx > 0) {
                score = dx + Math.abs(dy) * 1.4;
            } else if (dir === 'L' && dx < 0) {
                score = -dx + Math.abs(dy) * 1.4;
            } else if (dir === 'D' && dy > 0) {
                score = dy + Math.abs(dx) * 1.4;
            } else if (dir === 'U' && dy < 0) {
                score = -dy + Math.abs(dx) * 1.4;
            }
            if (score < bestScore) {
                bestScore = score;
                best = i;
            }
        }
        return best;
    }

    function buildCityPath(fromIdx, toIdx) {
        var keys = [];
        if (!validCityIndex(fromIdx) || !validCityIndex(toIdx) || fromIdx === toIdx) {
            return { keys: keys, landed: fromIdx === toIdx };
        }
        var cur = fromIdx;
        var visited = {};
        var guard = 0;
        while (cur !== toIdx && guard++ < 24) {
            if (visited[cur]) {
                break;
            }
            visited[cur] = true;
            var from = state.cities[cur];
            var to = state.cities[toIdx];
            var dx = to.engX - from.engX;
            var dy = to.engY - from.engY;
            var order = Math.abs(dx) >= Math.abs(dy)
                ? [dx >= 0 ? 'R' : 'L', dy >= 0 ? 'D' : 'U', dy >= 0 ? 'U' : 'D', dx >= 0 ? 'L' : 'R']
                : [dy >= 0 ? 'D' : 'U', dx >= 0 ? 'R' : 'L', dx >= 0 ? 'L' : 'R', dy >= 0 ? 'U' : 'D'];
            var next = -1;
            var used = null;
            for (var i = 0; i < order.length; i++) {
                var cand = nearestCityInDir(cur, order[i]);
                if (cand >= 0 && cand !== cur && !visited[cand]) {
                    next = cand;
                    used = order[i];
                    break;
                }
            }
            if (next < 0 || !used) {
                break;
            }
            keys.push(used);
            cur = next;
        }
        return { keys: keys, landed: cur === toIdx, end: cur };
    }

    function coordsLookLikeTiles() {
        var max = 0;
        for (var i = 0; i < state.cities.length; i++) {
            max = Math.max(max, Math.abs(state.cities[i].engX), Math.abs(state.cities[i].engY));
        }
        return max > 0 && max <= 40;
    }

    function tryWriteCursor(index, tried) {
        var data = engineData();
        var wrote = false;
        if (!data) {
            return false;
        }
        var names = CURSOR_FIELDS.slice();
        if (state.learnedCursorField) {
            names.unshift(state.learnedCursorField);
        }
        for (var i = 0; i < names.length; i++) {
            if (data[names[i]] === undefined) {
                continue;
            }
            var current = readNumber(data, names[i]);
            if (!validCityIndex(current) && names[i] !== state.learnedCursorField) {
                continue;
            }
            tried.push('write:' + names[i]);
            if (writeNumber(data, names[i], index) && readNumber(data, names[i]) === index) {
                wrote = true;
                state.learnedCursorField = names[i];
                state.engineCursorIndex = index;
            }
        }
        return wrote;
    }

    function tryWriteFocusAndTouch(city, tried) {
        var data = engineData();
        if (!data || !city) {
            return false;
        }
        var i;
        for (i = 0; i < FOCUS_X_FIELDS.length; i++) {
            if (data[FOCUS_X_FIELDS[i]] !== undefined) {
                writeNumber(data, FOCUS_X_FIELDS[i], city.engX);
                tried.push('focusX:' + FOCUS_X_FIELDS[i]);
            }
        }
        for (i = 0; i < FOCUS_Y_FIELDS.length; i++) {
            if (data[FOCUS_Y_FIELDS[i]] !== undefined) {
                writeNumber(data, FOCUS_Y_FIELDS[i], city.engY);
                tried.push('focusY:' + FOCUS_Y_FIELDS[i]);
            }
        }
        var tile = coordsLookLikeTiles();
        var sx = pickField(data, MAP_SX_FIELDS);
        var sy = pickField(data, MAP_SY_FIELDS);
        var lcdW = typeof lcdWidth === 'number' ? lcdWidth : 160;
        var lcdH = typeof lcdHeight === 'number' ? lcdHeight : 96;
        if (tile && sx && data[sx.name] !== undefined) {
            var tilesX = Math.max(1, Math.round(lcdW / 16));
            var tilesY = Math.max(1, Math.round(lcdH / 16));
            writeNumber(data, sx.name, Math.max(0, city.engX - Math.floor(tilesX / 2)));
            if (sy) {
                writeNumber(data, sy.name, Math.max(0, city.engY - Math.floor(tilesY / 2)));
            }
            tried.push('map-scroll');
            sx = pickField(data, MAP_SX_FIELDS);
            sy = pickField(data, MAP_SY_FIELDS);
        }
        if (sx && sy) {
            var scale = tile ? 16 : 1;
            var lx = (city.engX - sx.value) * scale + (tile ? 8 : 0);
            var ly = (city.engY - sy.value) * scale + (tile ? 8 : 0);
            if (lx >= 0 && ly >= 0 && lx < lcdW && ly < lcdH) {
                if (sendTouch(lx, ly)) {
                    tried.push('_bayeSendTouchEvent');
                    return true;
                }
            }
        }
        return false;
    }

    function cancelAlign() {
        state.alignToken += 1;
        if (state.alignTimer) {
            clearTimeout(state.alignTimer);
            state.alignTimer = 0;
        }
        state.aligning = false;
    }

    function later(token, ms, fn) {
        state.alignTimer = setTimeout(function () {
            if (token !== state.alignToken) {
                return;
            }
            fn();
        }, ms);
    }

    function leaveClassicMenu(hint) {
        state.menuDepth = 0;
        state.hdOpenedMenu = false;
        state.aligning = false;
        setPhase(playerKingId() !== null && citiesHaveBelong(engineData()) ? 'map' : inferPhase());
        state.hint = hint || '已回到大地图。';
    }

    function sendEnterAndOpenMenu(token, tried, wrote) {
        if (token !== state.alignToken) {
            return;
        }
        var enter = (window.baye && baye.VK_ENTER) || VK.ENTER;
        engineSendKey(enter);
        state.aligning = false;
        state.hdOpenedMenu = true;
        state.menuDepth = 1;
        setPhase('classic-menu');
        state.hint = '经典城池菜单（内政/外交/军备/状况）。空格关闭；点地图空白回 HD。';
        state.alignLog = {
            wroteField: wrote,
            tried: tried,
            target: state.selectedIndex,
            cursor: inferCurrentCity(),
            learned: state.learnedCursorField
        };
        if (!state.inputFallbackNoted) {
            state.inputFallbackNoted = true;
            console.log('[hd-overworld] input P1', state.alignLog);
        }
        if (!wrote && inferCurrentCity() !== state.selectedIndex) {
            console.warn('[hd-overworld] cursor may not match target', state.alignLog);
            state.hint = '已回车。若不是目标城，切回经典用方向键入城。';
        }
    }

    function alignAndEnter(index) {
        var city = state.cities[index];
        var tried = [];
        var token = state.alignToken;
        if (!city) {
            state.aligning = false;
            return;
        }
        var wrote = tryWriteCursor(index, tried);
        tryWriteFocusAndTouch(city, tried);
        if (wrote && readNumber(engineData(), state.learnedCursorField) === index) {
            tried.push('verified-write');
            later(token, 70, function () {
                sendEnterAndOpenMenu(token, tried, true);
            });
            return;
        }
        var from = inferCurrentCity();
        if (from === index) {
            tried.push('already-on-target');
            later(token, 60, function () {
                sendEnterAndOpenMenu(token, tried, wrote);
            });
            return;
        }
        if (from >= 0) {
            var path = buildCityPath(from, index);
            tried.push('path:' + path.keys.join('') + (path.landed ? ':ok' : ':partial'));
            var step = 0;
            function sendNext() {
                if (token !== state.alignToken) {
                    return;
                }
                if (step >= path.keys.length) {
                    state.engineCursorIndex = path.landed ? index : path.end;
                    later(token, 70, function () {
                        sendEnterAndOpenMenu(token, tried, wrote || path.landed);
                    });
                    return;
                }
                var before = snapshotIndexFields();
                engineSendKey(dirCode(path.keys[step]));
                step += 1;
                later(token, 55, function () {
                    learnCursorField(before, snapshotIndexFields());
                    var now = inferCurrentCity();
                    if (validCityIndex(now)) {
                        state.engineCursorIndex = now;
                    }
                    sendNext();
                });
            }
            sendNext();
            return;
        }
        tried.push('no-current-city');
        later(token, 80, function () {
            sendEnterAndOpenMenu(token, tried, wrote);
        });
    }

    function openClassicCity(index) {
        if (state.phase === 'classic-menu') {
            return;
        }
        if (state.phase !== 'map') {
            state.selectedIndex = index;
            state.hint = '预览中：进入大地图后点击才会向引擎发送入城。现在可切回经典继续开局。';
            return;
        }
        if (state.aligning) {
            return;
        }
        cancelAlign();
        state.selectedIndex = index;
        state.aligning = true;
        state.alignToken += 1;
        state.hint = '对齐光标并打开经典菜单…';
        later(state.alignToken, 20, function () {
            alignAndEnter(index);
        });
    }

    function bindInput() {
        if (!state.canvas || state.inputBound) {
            return;
        }
        state.inputBound = true;
        state.canvas.addEventListener('mousemove', function (ev) {
            if (!hitsEnabled()) {
                state.hoverIndex = -1;
                return;
            }
            var pt = eventToDesign(ev);
            if (!pt) {
                return;
            }
            state.hoverIndex = hitCity(pt);
        });
        state.canvas.addEventListener('mouseleave', function () {
            state.hoverIndex = -1;
        });
        state.canvas.addEventListener('click', function (ev) {
            if (state.mode !== 'hd-map') {
                return;
            }
            if (state.phase === 'classic-menu') {
                ev.preventDefault();
                leaveClassicMenu('已回到 HD 大地图。点城打开经典菜单。');
                return;
            }
            if (!hitsEnabled()) {
                return;
            }
            var pt = eventToDesign(ev);
            if (!pt) {
                return;
            }
            var idx = hitCity(pt);
            if (idx < 0) {
                return;
            }
            ev.preventDefault();
            openClassicCity(idx);
        });
        document.addEventListener('keydown', function (e) {
            if (state.mode !== 'hd-map') {
                return;
            }
            var code = e.keyCode;
            if ((code === 32 || code === 27) && state.phase === 'classic-menu') {
                state.menuDepth = Math.max(0, state.menuDepth - 1);
                if (state.menuDepth <= 0 && state.hdOpenedMenu) {
                    setTimeout(function () {
                        if (state.phase === 'classic-menu' && state.menuDepth <= 0) {
                            leaveClassicMenu('已回到大地图。点城打开经典菜单。');
                        }
                    }, 280);
                } else {
                    state.hint = '仍在经典菜单。再按空格或点地图空白回 HD。';
                }
            }
        });
    }

    function cacheDom() {
        state.canvas = document.getElementById('hd-overworld-canvas');
        state.hudLeft = document.getElementById('hd-overworld-hud-left');
        state.hudRight = document.getElementById('hd-overworld-hud-right');
        if (state.canvas) {
            state.ctx = state.canvas.getContext('2d');
            if (state.ctx) {
                state.ctx.imageSmoothingEnabled = true;
            }
        }
    }

    function setMode(value) {
        var mode = normalizeMode(value);
        writeStorage(STORAGE_KEY, mode);
        state.mode = mode;
        if (mode === 'hd-map') {
            state.hint = 'HD 地图。默认仍可切回经典；1×/2× 只作用于经典 LCD。';
            state.probed = false;
            if (global.BayeHdOverworldProbe) {
                global.BayeHdOverworldProbe.run();
            }
            state.phase = inferPhase();
            loadAssets(function () {
                sampleCities();
                state.phase = inferPhase();
                applyChrome();
                draw();
            });
            ensureLoop();
        } else {
            state.phase = inferPhase();
            state.hint = '经典 LCD。';
        }
        applyChrome();
        if (mode === 'classic' && state.loopId) {
            global.cancelAnimationFrame(state.loopId);
            state.loopId = 0;
        }
    }

    function applyPcPage() {
        cacheDom();
        bindToolbar();
        bindInput();
        applyChrome();
        syncToolbar();
        if (getMode() === 'hd-map') {
            loadAssets(function () {
                sampleCities();
                draw();
            });
            ensureLoop();
        }
    }

    function start() {
        wrapCallHook();
        applyPcPage();
        sampleCities();
        if (getMode() === 'hd-map') {
            state.phase = inferPhase();
            applyChrome();
        }
    }

    applyEarlyDocumentAttrs();

    global.addEventListener('resize', function () {
        if (state.mode === 'hd-map') {
            syncCanvasSize();
            draw();
        }
    });

    global.BayeHdOverworld = {
        STORAGE_KEY: STORAGE_KEY,
        getMode: getMode,
        setMode: setMode,
        getPhase: function () { return state.phase; },
        getCities: function () { return state.cities; },
        getAlignLog: function () { return state.alignLog; },
        getDateInfo: function () { return state.dateInfo; },
        getLearnedCursor: function () { return state.learnedCursorField; },
        applyPcPage: applyPcPage,
        applyEarlyDocumentAttrs: applyEarlyDocumentAttrs,
        start: start
    };
})(window);
