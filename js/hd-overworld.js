/**
 * HD 大地图表现壳（P0）。
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

    var YEAR_FIELDS = ['g_YearN', 'g_Year', 'YearN', 'g_DateYear', 'year'];
    var MONTH_FIELDS = ['g_MonthN', 'g_Month', 'MonthN', 'g_DateMonth', 'month'];
    var CURSOR_FIELDS = [
        'g_CityCrt', 'g_CityCur', 'g_CurCity', 'g_CityIndex',
        'g_CrtCity', 'g_iCity', 'g_currentCity', 'g_CityId'
    ];
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
        fallback: ['#e0a14a', '#5cb87a', '#9b6bdb', '#d97b3e', '#4aa3a3', '#c43c3c', '#6b8cae', '#d4a574']
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
        hint: '经典 LCD 可随时切回。点城尝试打开经典城池菜单。'
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

    function factionColor(belong) {
        var pal = state.palette || DEFAULT_PALETTE;
        if (!belong || belong === 0xff || belong === 255) {
            return pal.empty || DEFAULT_PALETTE.empty;
        }
        var kingId = playerKingId();
        if (kingId && belong === kingId) {
            return pal.player || DEFAULT_PALETTE.player;
        }
        if (pal.byBelongId && pal.byBelongId[String(belong)]) {
            return pal.byBelongId[String(belong)];
        }
        var fb = pal.fallback || DEFAULT_PALETTE.fallback;
        return fb[Math.abs(belong) % fb.length];
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
            var belong = city ? Number(city.Belong) : 0;
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
        labels.sort(function (a, b) { return a.hdY - b.hdY || a.hdX - b.hdX; });
        for (var a = 0; a < labels.length; a++) {
            for (var b = 0; b < a; b++) {
                if (Math.abs(labels[a].hdX - labels[b].hdX) < 70 &&
                    Math.abs(labels[a].labelY - labels[b].labelY) < 18) {
                    labels[a].labelY = labels[b].labelY + 18;
                }
            }
        }

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
        return rows;
    }

    function isFightActive(data) {
        if (!data || !data.g_FgtParam) {
            return false;
        }
        try {
            var gens = data.g_FgtParam.GenArray;
            if (!gens) {
                return false;
            }
            var n = 0;
            for (var i = 0; i < Math.min(gens.length, 20); i++) {
                if (gens[i]) {
                    n += 1;
                }
            }
            return n >= 2;
        } catch (e) {
            return false;
        }
    }

    function citiesHaveBelong(data) {
        if (!data || !data.g_Cities || !data.g_Cities.length) {
            return false;
        }
        for (var i = 0; i < data.g_Cities.length; i++) {
            var b = Number(data.g_Cities[i].Belong);
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
        if (isFightActive(data)) {
            return 'other';
        }
        if (playerKingId() !== null && citiesHaveBelong(data)) {
            return 'map';
        }
        return 'other';
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
            setPhase('classic-menu');
            state.hint = '经典城池菜单（内政/外交/军备/状况）。空格返回大地图。';
            return;
        }
        if (name === 'willCloseMenu' && state.phase === 'classic-menu') {
            setPhase('map');
            state.hint = '已回到大地图。点城或用方向键。';
            return;
        }
        if (name === 'didOpenNewGame' || name === 'didLoadGame') {
            state.probed = false;
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
            var hover = city.index === state.hoverIndex;
            var img = markerImage(city.kind, selected);
            var size = selected ? 72 : 56;
            if (img) {
                ctx.drawImage(img, city.hdX - size / 2, city.hdY - size / 2 - 6, size, size);
            } else {
                ctx.beginPath();
                ctx.fillStyle = city.color;
                ctx.arc(city.hdX, city.hdY, selected ? 14 : 11, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#1b1f27';
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.strokeStyle = city.color;
            ctx.lineWidth = hover || selected ? 3 : 2;
            ctx.globalAlpha = 0.9;
            ctx.arc(city.hdX, city.hdY + 2, selected ? 28 : 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            if (selected) {
                var pulse = 26 + Math.sin(now / 220) * 4;
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = 2;
                ctx.arc(city.hdX, city.hdY + 2, pulse, 0, Math.PI * 2);
                ctx.stroke();
            }

            var label = city.name || ('#' + city.index);
            ctx.font = (hover || selected ? 'bold ' : '') + '20px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            var tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(14,17,22,0.62)';
            ctx.fillRect(city.hdX - tw / 2 - 6, city.labelY - 2, tw + 12, 22);
            ctx.fillStyle = '#f4f7fb';
            ctx.fillText(label, city.hdX, city.labelY);
        }
    }

    function dateLabel() {
        var data = engineData();
        if (!data) {
            return '';
        }
        var year = pickField(data, YEAR_FIELDS);
        var month = pickField(data, MONTH_FIELDS);
        var period = readNumber(data, 'g_PIdx');
        var parts = [];
        if (year) {
            parts.push(year.value + '年');
        }
        if (month) {
            parts.push(month.value + '月');
        }
        if (!parts.length && period && PERIOD_NAMES[period]) {
            parts.push(PERIOD_NAMES[period]);
        }
        return parts.join('');
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
        var title = date || 'HD 大地图';
        if (king) {
            title += '  ·  ' + king;
        }
        if (state.phase === 'other') {
            title += '  ·  预览';
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
        var cur = pickField(engineData(), CURSOR_FIELDS);
        if (cur && cur.value >= 0 && cur.value < state.cities.length && state.phase === 'map') {
            state.selectedIndex = cur.value;
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

    function currentCursorIndex() {
        var cur = pickField(engineData(), CURSOR_FIELDS);
        if (cur && cur.value >= 0 && cur.value < state.cities.length) {
            return cur.value;
        }
        return state.selectedIndex;
    }

    function alignCursor(index) {
        var data = engineData();
        var city = state.cities[index];
        var tried = [];
        var wrote = false;
        if (!city) {
            return { wrote: false, tried: tried };
        }
        if (data) {
            for (var i = 0; i < CURSOR_FIELDS.length; i++) {
                if (data[CURSOR_FIELDS[i]] !== undefined) {
                    tried.push(CURSOR_FIELDS[i]);
                    if (writeNumber(data, CURSOR_FIELDS[i], index)) {
                        wrote = true;
                    }
                }
            }
            for (var fx = 0; fx < FOCUS_X_FIELDS.length; fx++) {
                if (data[FOCUS_X_FIELDS[fx]] !== undefined) {
                    tried.push(FOCUS_X_FIELDS[fx]);
                    writeNumber(data, FOCUS_X_FIELDS[fx], city.engX);
                }
            }
            for (var fy = 0; fy < FOCUS_Y_FIELDS.length; fy++) {
                if (data[FOCUS_Y_FIELDS[fy]] !== undefined) {
                    tried.push(FOCUS_Y_FIELDS[fy]);
                    writeNumber(data, FOCUS_Y_FIELDS[fy], city.engY);
                }
            }
            var sx = pickField(data, MAP_SX_FIELDS);
            var sy = pickField(data, MAP_SY_FIELDS);
            var lcdW = typeof lcdWidth === 'number' ? lcdWidth : 160;
            var lcdH = typeof lcdHeight === 'number' ? lcdHeight : 96;
            if (sx && sy) {
                var lx = (city.engX - sx.value) * 16 + 8;
                var ly = (city.engY - sy.value) * 16 + 8;
                if (lx >= 0 && ly >= 0 && lx < lcdW && ly < lcdH) {
                    if (sendTouch(lx, ly)) {
                        tried.push('_bayeSendTouchEvent');
                        wrote = true;
                    }
                }
            }
        }

        var from = currentCursorIndex();
        var VK_UP = 0x22, VK_DOWN = 0x23, VK_LEFT = 0x24, VK_RIGHT = 0x25;
        if (from >= 0 && from !== index && state.cities[from]) {
            var dx = city.engX - state.cities[from].engX;
            var dy = city.engY - state.cities[from].engY;
            var stepsX = Math.max(1, Math.min(8, Math.round(Math.abs(dx)) || 1));
            var stepsY = Math.max(1, Math.min(8, Math.round(Math.abs(dy)) || 1));
            var delay = 0;
            if (dx !== 0) {
                for (var kx = 0; kx < stepsX; kx++) {
                    (function (code, t) {
                        setTimeout(function () { engineSendKey(code); }, t);
                    })(dx > 0 ? VK_RIGHT : VK_LEFT, delay);
                    delay += 45;
                }
            }
            if (dy !== 0) {
                for (var ky = 0; ky < stepsY; ky++) {
                    (function (code, t) {
                        setTimeout(function () { engineSendKey(code); }, t);
                    })(dy > 0 ? VK_DOWN : VK_UP, delay);
                    delay += 45;
                }
            }
            tried.push('arrow-keys');
            city._enterDelay = delay + 80;
        } else {
            city._enterDelay = 60;
        }

        if (!state.inputFallbackNoted) {
            state.inputFallbackNoted = true;
            state.alignLog = {
                wroteField: wrote,
                tried: tried,
                note: wrote
                    ? '已尝试写入光标/当前城字段并回车。'
                    : '未找到可写的当前城字段；已尝试方向键逼近 + ENTER。若没打开菜单，请切回经典用键盘入城。'
            };
            console.warn('[hd-overworld] input v1', state.alignLog);
        }
        return { wrote: wrote, tried: tried, enterDelay: city._enterDelay };
    }

    function openClassicCity(index) {
        if (state.phase !== 'map') {
            state.selectedIndex = index;
            state.hint = '预览中：进入大地图后点击才会向引擎发送入城。现在可切回经典继续开局。';
            return;
        }
        state.selectedIndex = index;
        state.hint = '对齐光标并打开经典菜单…';
        var align = alignCursor(index);
        var VK_ENTER = (window.baye && baye.VK_ENTER) || 0x27;
        setTimeout(function () {
            engineSendKey(VK_ENTER);
            setPhase('classic-menu');
            state.hint = '已发送回车。若菜单未开，切回经典用键盘入城。';
        }, align && align.enterDelay ? align.enterDelay : 80);
    }

    function bindInput() {
        if (!state.canvas || state.inputBound) {
            return;
        }
        state.inputBound = true;
        state.canvas.addEventListener('mousemove', function (ev) {
            if (state.mode !== 'hd-map' || state.phase === 'classic-menu') {
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
            if (state.mode !== 'hd-map' || state.phase === 'classic-menu') {
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
                setTimeout(function () {
                    if (state.phase === 'classic-menu') {
                        setPhase(inferPhase() === 'map' ? 'map' : 'other');
                        state.hint = '已返回。点城或切回经典继续。';
                    }
                }, 220);
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
            loadAssets(function () {
                sampleCities();
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
        applyPcPage: applyPcPage,
        applyEarlyDocumentAttrs: applyEarlyDocumentAttrs,
        start: start
    };
})(window);
