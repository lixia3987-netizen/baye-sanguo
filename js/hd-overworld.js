/**
 * HD 大地图表现壳（P0 容器 + P1 城态/点选 + P2 路网 + P3 反馈）。
 * 视觉地理：中国 LCC 地形全图（China LCC topographic, eqdc）。不改 WASM / dat.lib。
 * 经典模式默认，可切回。规格：docs/hd-overworld-spec.md
 */
(function (global) {
    var STORAGE_KEY = 'baye/overworldMode';
    var ASSET_ROOT = 'assets/hd-overworld/';
    var DESIGN_W = 1920;
    var DESIGN_H = 1080;
    var SAFE = { left: 48, top: 72, right: 1872, bottom: 1048 };
    var HIT_RADIUS = 52;
    var PERIOD_NAMES = { 1: '董卓弄权', 2: '曹操崛起', 3: '赤壁之战', 4: '三国鼎立' };

    var YEAR_FIELDS = ['g_YearDate', 'g_YearN', 'g_Year', 'YearN', 'g_DateYear', 'year', 'g_PYear'];
    var MONTH_FIELDS = ['g_MonthDate', 'g_MonthN', 'g_Month', 'MonthN', 'g_DateMonth', 'month', 'g_PMonth'];
    var DATE_OBJECT_FIELDS = ['g_DateN', 'g_Date', 'g_GameDate', 'DateN'];
    var CURSOR_FIELDS = [
        'g_CityCrt', 'g_CityCur', 'g_CurCity', 'g_CityIndex',
        'g_CrtCity', 'g_iCity', 'g_currentCity', 'g_CityId', 'g_CityIdx'
    ];
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
    var FOCUS_X_FIELDS = ['g_CityX', 'g_FoucsX', 'g_FocusX', 'g_MapFocusX'];
    var FOCUS_Y_FIELDS = ['g_CityY', 'g_FoucsY', 'g_FocusY', 'g_MapFocusY'];
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
        pendingEnter: false,
        learnedCursorField: null,
        learnedCityXY: false,
        engineCursorIndex: -1,
        menuDepth: 0,
        hdOpenedMenu: false,
        dateInfo: { year: null, month: null, source: 'none' },
        sawFightHook: false,
        adjacencyJson: null,
        geoCities: null,
        geoMeta: null,
        engineTileEdges: [],
        roads: { source: 'none', edges: [], passes: 0 },
        camera: {
            x: 0, y: 0, scale: 1, mapW: 1920, mapH: 1080,
            minX: 0, minY: 0, maxX: 0, maxY: 0, inited: false
        },
        pan: { on: false, lastX: 0, lastY: 0, moved: false, suppressClick: false },
        pointer: { x: 0, y: 0, on: false },
        enterFx: { index: -1, start: 0, duration: 150 },
        /* os-pointer：不画自定义光标。cursor.png 会与系统指针叠影；cursor_hover.png 像禁止符。 */
        cursorPolicy: 'os-pointer',
        haveCityPos: false,
        hint: '经典 LCD 可随时切回。拖动平移地图；点己方城打开经典城池菜单。'
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

    function ensureEngineData() {
        if (window.baye && baye.data) {
            return baye.data;
        }
        if (typeof _bayeGetGlobal === 'function' && typeof baye_bridge_value === 'function') {
            try {
                if (window.baye === undefined) {
                    window.baye = {};
                }
                if (window.baye.hooks === undefined) {
                    window.baye.hooks = {};
                }
                window.baye.data = baye_bridge_value(_bayeGetGlobal());
            } catch (e) {
                console.warn('[hd-overworld] bind baye.data failed', e);
            }
        }
        return window.baye && baye.data ? baye.data : null;
    }

    function engineData() {
        return ensureEngineData();
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
                        'terrain/base_plains.jpg',
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
            var roadsLayer = layers.roads || {};
            add('road:stroke', roadsLayer.stroke || 'roads/stroke.png');
            add('road:pass', roadsLayer.pass || 'roads/pass.png');
            var paletteRel = layers.palette || 'palette/factions.json';

            var left = pending.length + 3;
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
            loadJSON(assetUrl('roads/adjacency.json'), function (adj) {
                state.adjacencyJson = adj;
                tick();
            });
            loadJSON(assetUrl('china-lcc-cities.json'), function (geo) {
                state.geoMeta = geo;
                state.geoCities = geo && geo.cities ? geo.cities : null;
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

    function mapSize() {
        var r = playableMapRect();
        return { w: r.w, h: r.h };
    }

    /*
     * Planned playable rectangle in map-space pixels.
     * Camera offset is the top-left of the viewport on this rect:
     *   offsetX ∈ [rect.x, rect.x + max(0, rect.w - DESIGN_W / scale)]
     *   offsetY ∈ [rect.y, rect.y + max(0, rect.h - DESIGN_H / scale)]
     * Viewport never samples outside the texture (intersection of
     * geoMeta.mapSize / fit.playableBounds and the base image).
     */
    function playableMapRect() {
        var x = 0;
        var y = 0;
        var w = DESIGN_W;
        var h = DESIGN_H;
        var meta = state.geoMeta && state.geoMeta.mapSize;
        if (meta && meta.length >= 2 && Number(meta[0]) > 0 && Number(meta[1]) > 0) {
            w = Number(meta[0]);
            h = Number(meta[1]);
        } else if (state.manifest && state.manifest.mapWidth && state.manifest.mapHeight) {
            w = Number(state.manifest.mapWidth);
            h = Number(state.manifest.mapHeight);
        } else {
            var fallback = terrainImageByPart('base_plains') || terrainImages()[0];
            if (fallback && fallback.width && fallback.height) {
                w = fallback.width;
                h = fallback.height;
            }
        }
        var bounds = state.geoMeta && state.geoMeta.fit && state.geoMeta.fit.playableBounds;
        if (bounds && bounds.length >= 4) {
            x = Number(bounds[0]) || 0;
            y = Number(bounds[1]) || 0;
            if (Number(bounds[2]) > 0) {
                w = Number(bounds[2]);
            }
            if (Number(bounds[3]) > 0) {
                h = Number(bounds[3]);
            }
        }
        var img = terrainImageByPart('base_plains') || terrainImages()[0];
        if (img && img.width && img.height) {
            if (x < 0) {
                x = 0;
            }
            if (y < 0) {
                y = 0;
            }
            if (x + w > img.width) {
                w = Math.max(0, img.width - x);
            }
            if (y + h > img.height) {
                h = Math.max(0, img.height - y);
            }
        }
        return { x: x, y: y, w: w, h: h };
    }

    function cameraLimits() {
        var r = playableMapRect();
        var scale = state.camera.scale || 1;
        var minScale = Math.max(DESIGN_W / r.w, DESIGN_H / r.h);
        if (!isFinite(minScale) || minScale <= 0) {
            minScale = 1;
        }
        var maxScale = 2.2;
        if (scale < minScale) {
            scale = minScale;
        }
        if (scale > maxScale) {
            scale = maxScale;
        }
        var vw = DESIGN_W / scale;
        var vh = DESIGN_H / scale;
        var minX = r.x;
        var minY = r.y;
        var maxX = r.x + Math.max(0, r.w - vw);
        var maxY = r.y + Math.max(0, r.h - vh);
        return {
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY,
            vw: vw,
            vh: vh,
            scale: scale,
            minScale: minScale,
            maxScale: maxScale,
            mapW: r.w,
            mapH: r.h
        };
    }

    function clampCamera() {
        var lim = cameraLimits();
        state.camera.scale = lim.scale;
        if (state.camera.x < lim.minX) {
            state.camera.x = lim.minX;
        }
        if (state.camera.y < lim.minY) {
            state.camera.y = lim.minY;
        }
        if (state.camera.x > lim.maxX) {
            state.camera.x = lim.maxX;
        }
        if (state.camera.y > lim.maxY) {
            state.camera.y = lim.maxY;
        }
        state.camera.mapW = lim.mapW;
        state.camera.mapH = lim.mapH;
        state.camera.minX = lim.minX;
        state.camera.minY = lim.minY;
        state.camera.maxX = lim.maxX;
        state.camera.maxY = lim.maxY;
        return lim;
    }

    function ensureCamera() {
        var m = mapSize();
        if (!m.w || !state.cities.length) {
            return;
        }
        var geoReady = !!(state.geoCities && state.geoCities.length);
        var img = terrainImageByPart('base_plains') || terrainImages()[0];
        var imgReady = !!(img && img.width > DESIGN_W);
        if (state.camera.inited) {
            if (!(geoReady && imgReady && !state.camera.lockedFull)) {
                clampCamera();
                return;
            }
        }
        if (!geoReady || !imgReady) {
            return;
        }
        var want = { '西凉': 1, '襄平': 1, '建业': 1, '成都': 1 };
        var xs = [];
        var ys = [];
        var i;
        for (i = 0; i < state.cities.length; i++) {
            if (want[state.cities[i].name]) {
                xs.push(state.cities[i].hdX);
                ys.push(state.cities[i].hdY);
            }
        }
        if (xs.length < 2) {
            state.camera.scale = 1;
            state.camera.x = Math.max(0, m.w * 0.40);
            state.camera.y = Math.max(0, m.h * 0.30);
        } else {
            var minX = Math.min.apply(null, xs);
            var maxX = Math.max.apply(null, xs);
            var minY = Math.min.apply(null, ys);
            var maxY = Math.max.apply(null, ys);
            var padX = Math.max(140, (maxX - minX) * 0.18);
            var padY = Math.max(120, (maxY - minY) * 0.18);
            var bw = (maxX - minX) + padX * 2;
            var bh = (maxY - minY) + padY * 2;
            var scale = Math.min(DESIGN_W / bw, DESIGN_H / bh);
            if (scale < 0.85) {
                scale = 0.85;
            }
            if (scale > 2.2) {
                scale = 2.2;
            }
            state.camera.scale = scale;
            state.camera.x = (minX + maxX) / 2 - DESIGN_W / scale / 2;
            state.camera.y = (minY + maxY) / 2 - DESIGN_H / scale / 2;
        }
        clampCamera();
        state.camera.inited = true;
        state.camera.lockedFull = true;
    }

    function toScreen(mx, my) {
        var s = state.camera.scale || 1;
        return {
            x: (mx - state.camera.x) * s,
            y: (my - state.camera.y) * s
        };
    }

    function toMap(sx, sy) {
        var s = state.camera.scale || 1;
        return {
            x: sx / s + state.camera.x,
            y: sy / s + state.camera.y
        };
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
        return resolvePlayerBelong(raw);
    }

    function resolvePlayerBelong(rawKing) {
        var data = engineData();
        var oneBased = rawKing + 1;
        if (!data || !data.g_Cities) {
            return oneBased;
        }
        var ca = 0;
        var cb = 0;
        for (var i = 0; i < data.g_Cities.length; i++) {
            var bel = readNumber(data.g_Cities[i], 'Belong');
            if (bel === oneBased) {
                ca += 1;
            }
            if (bel === rawKing) {
                cb += 1;
            }
        }
        if (ca > 0) {
            return oneBased;
        }
        if (cb > 0) {
            return rawKing;
        }
        return oneBased;
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

    function geoRecord(row) {
        var table = state.geoCities;
        if (!table || !table.length) {
            return null;
        }
        var i;
        for (i = 0; i < table.length; i++) {
            if (table[i].i === row.index || table[i].name === row.name) {
                return table[i];
            }
        }
        return null;
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
        var usedGeo = 0;
        for (var r = 0; r < rows.length; r++) {
            var rec = geoRecord(rows[r]);
            if (rec && rec.hdX != null && rec.hdY != null) {
                rows[r].hdX = rec.hdX;
                rows[r].hdY = rec.hdY;
                rows[r].layout = 'china-lcc';
                usedGeo += 1;
            } else {
                var hd = mapEngineToHd(rows[r].engX, rows[r].engY, bounds);
                rows[r].hdX = hd.x;
                rows[r].hdY = hd.y;
                rows[r].layout = rows[r].source;
            }
            rows[r].labelY = rows[r].hdY + 44;
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
                usedGeo: usedGeo,
                safe: SAFE
            });
            for (var c = 0; c < rows.length; c++) {
                console.log('[hd-overworld] city', rows[c].index, rows[c].name,
                    'eng=', rows[c].engX, rows[c].engY,
                    'hd=', Math.round(rows[c].hdX), Math.round(rows[c].hdY),
                    'src=', rows[c].source, 'layout=', rows[c].layout, 'belong=', rows[c].belong);
            }
            if (global.BayeHdOverworldProbe) {
                global.BayeHdOverworldProbe.run();
            }
        }

        state.cities = rows;
        rebuildRoads();
        ensureCamera();
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
            if (state.camera.mapH && labels[a].labelY > state.camera.mapH - 12) {
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

    function onHook(name, context) {
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.onEngineHook === 'function') {
            try {
                BayeHdCityMenu.onEngineHook(name, context);
            } catch (e) {
                console.warn('[hd-overworld] city-menu hook', name, e);
            }
        }
        if (state.aligning || state.pendingEnter) {
            console.log('[hd-overworld] hook while entering', name);
        }
        if (name === 'onMenuIdle' && (state.pendingEnter || state.aligning || state.hdOpenedMenu)) {
            confirmClassicMenu('经典城池菜单。空格关闭；点地图空白回 HD。');
            return;
        }
        if (name === 'cityMakeCommand') {
            confirmClassicMenu('经典城池菜单。空格关子菜单；再空格或点地图空白回 HD。');
            return;
        }
        if (name === 'willCloseMenu' && state.phase === 'classic-menu') {
            if (global.BayeHdCityMenu && BayeHdCityMenu.isOpen()) {
                return;
            }
            state.menuDepth = Math.max(0, state.menuDepth - 1);
            if (state.menuDepth <= 0) {
                leaveClassicMenu('已回到大地图。点城打开经典菜单。');
            }
            return;
        }
        if (name === 'didOpenNewGame' || name === 'didLoadGame') {
            state.probed = false;
            state._roadsLogged = false;
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
        if (state.hookWrapped || !window.baye) {
            return;
        }
        if (!baye.hooks) {
            baye.hooks = {};
        }
        ['onMenuIdle', 'cityMakeCommand', 'willCloseMenu', 'didOpenNewGame', 'didLoadGame'].forEach(function (name) {
            if (typeof baye.hooks[name] !== 'function') {
                baye.hooks[name] = function () {};
            }
        });
        if (typeof baye.callHook !== 'function') {
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
        ensureCamera();
        var base = terrainImageByPart('base_plains') || terrainImages()[0];
        if (!base) {
            drawFallbackContinent(ctx);
            return;
        }
        var lim = clampCamera();
        var sx = state.camera.x;
        var sy = state.camera.y;
        var sw = lim.vw;
        var sh = lim.vh;
        if (sx < 0) {
            sx = 0;
        }
        if (sy < 0) {
            sy = 0;
        }
        if (sx + sw > base.width) {
            sx = Math.max(0, base.width - sw);
        }
        if (sy + sh > base.height) {
            sy = Math.max(0, base.height - sh);
        }
        if (sx + sw > base.width) {
            sw = base.width - sx;
        }
        if (sy + sh > base.height) {
            sh = base.height - sy;
        }
        if (sw <= 0 || sh <= 0) {
            drawFallbackContinent(ctx);
            return;
        }
        try {
            /* Dest is always the full 1920×1080 viewport — no edge sliver of empty void. */
            ctx.drawImage(base, sx, sy, sw, sh, 0, 0, DESIGN_W, DESIGN_H);
        } catch (e) {
            drawFallbackContinent(ctx);
        }
    }

    function terrainImageByPart(part) {
        var keys = Object.keys(state.images);
        var i;
        for (i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('terrain:') === 0 && keys[i].indexOf(part) >= 0) {
                return state.images[keys[i]];
            }
        }
        return null;
    }

    function overlayOpaqueAt(img, x, y, threshold) {
        if (!img || !img.width || !img.height) {
            return false;
        }
        var scratch = state._overlayScratch;
        if (!scratch) {
            scratch = document.createElement('canvas');
            scratch.width = 1;
            scratch.height = 1;
            state._overlayScratch = scratch;
            state._overlayScratchCtx = scratch.getContext('2d', { willReadFrequently: true });
        }
        var sctx = state._overlayScratchCtx;
        sctx.clearRect(0, 0, 1, 1);
        var alignW = 3840;
        var alignH = 3309;
        if (state.geoMeta && state.geoMeta.fit && state.geoMeta.fit.rasterSize) {
            alignW = Number(state.geoMeta.fit.rasterSize[0]) || alignW;
            alignH = Number(state.geoMeta.fit.rasterSize[1]) || alignH;
        }
        if (x < 0 || y < 0 || x > alignW || y > alignH) {
            return false;
        }
        var sx = x / alignW * img.width;
        var sy = y / alignH * img.height;
        try {
            sctx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
            return sctx.getImageData(0, 0, 1, 1).data[3] > (threshold || 160);
        } catch (e) {
            return false;
        }
    }

    function validPairIndex(value, n) {
        return value !== null && value >= 0 && value < n && value === Math.floor(value);
    }

    function extractEngineAdjacency(cities) {
        var data = engineData();
        var rawCities = data && data.g_Cities;
        var n = cities.length;
        if (!rawCities || !rawCities.length) {
            return { fieldHits: 0, edges: [] };
        }
        var re = /exit|link|road|out|neighbor|adjacent|gate|pass|round/i;
        var p = probe();
        var listProps = p && p.listProps ? p.listProps : function () { return []; };
        var seen = {};
        var edges = [];
        var hits = 0;
        var i;
        function add(a, b) {
            if (!validPairIndex(a, n) || !validPairIndex(b, n) || a === b) {
                return;
            }
            var lo = Math.min(a, b);
            var hi = Math.max(a, b);
            var key = lo + '-' + hi;
            if (seen[key]) {
                return;
            }
            seen[key] = true;
            edges.push({ a: lo, b: hi });
        }
        for (i = 0; i < n && i < rawCities.length; i++) {
            var city = rawCities[i];
            var names = listProps(city);
            var f;
            for (f = 0; f < names.length; f++) {
                var name = names[f];
                if (!re.test(name)) {
                    continue;
                }
                hits += 1;
                var raw = city[name];
                if (raw && typeof raw.length === 'number') {
                    var k;
                    for (k = 0; k < raw.length; k++) {
                        var v = readNumber(raw, k);
                        if (v === null) {
                            v = Number(raw[k]);
                        }
                        add(i, v);
                    }
                } else {
                    add(i, readNumber(city, name));
                }
            }
        }
        return { fieldHits: hits, edges: edges };
    }

    function tileNeighborEdges(cities) {
        var edges = [];
        var i;
        var j;
        for (i = 0; i < cities.length; i++) {
            for (j = i + 1; j < cities.length; j++) {
                var dx = Math.abs(cities[i].engX - cities[j].engX);
                var dy = Math.abs(cities[i].engY - cities[j].engY);
                if (Math.max(dx, dy) <= 1) {
                    edges.push({ a: cities[i].index, b: cities[j].index });
                }
            }
        }
        return edges;
    }

    function historicalNeighborEdges(cities) {
        var edges = [];
        var seen = {};
        function add(a, b) {
            var lo = Math.min(a, b);
            var hi = Math.max(a, b);
            var key = lo + '-' + hi;
            if (seen[key] || lo === hi) {
                return;
            }
            seen[key] = true;
            edges.push({ a: lo, b: hi });
        }
        var maxDist = 520;
        if (state.geoMeta && state.geoMeta.fit && state.geoMeta.fit.neighborMaxDist) {
            maxDist = Number(state.geoMeta.fit.neighborMaxDist) || maxDist;
        }
        var i;
        var j;
        var k;
        for (i = 0; i < cities.length; i++) {
            var dists = [];
            for (j = 0; j < cities.length; j++) {
                if (i === j) {
                    continue;
                }
                var dx = cities[i].hdX - cities[j].hdX;
                var dy = cities[i].hdY - cities[j].hdY;
                dists.push({ j: j, d: Math.sqrt(dx * dx + dy * dy) });
            }
            dists.sort(function (a, b) { return a.d - b.d; });
            var kept = 0;
            for (k = 0; k < dists.length && kept < 3; k++) {
                if (dists[k].d <= maxDist || kept < 2) {
                    add(cities[i].index, cities[dists[k].j].index);
                    kept += 1;
                }
            }
        }
        return edges;
    }

    function normalizeJsonEdges(list, n) {
        var edges = [];
        var seen = {};
        var i;
        for (i = 0; i < list.length; i++) {
            var item = list[i];
            var a = item && (item.a != null ? item.a : item[0]);
            var b = item && (item.b != null ? item.b : item[1]);
            a = Number(a);
            b = Number(b);
            if (!validPairIndex(a, n) || !validPairIndex(b, n) || a === b) {
                continue;
            }
            var lo = Math.min(a, b);
            var hi = Math.max(a, b);
            var key = lo + '-' + hi;
            if (seen[key]) {
                continue;
            }
            seen[key] = true;
            edges.push({ a: lo, b: hi });
        }
        return edges;
    }

    function curveControl(a, b) {
        var dx = b.hdX - a.hdX;
        var dy = b.hdY - a.hdY;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var bulge = Math.min(40, Math.max(14, len * 0.14));
        return {
            x: (a.hdX + b.hdX) / 2 - dy / len * bulge,
            y: (a.hdY + b.hdY) / 2 + dx / len * bulge
        };
    }

    function decorateRoadEdge(edge, cities) {
        var a = cities[edge.a];
        var b = cities[edge.b];
        if (!a || !b) {
            return null;
        }
        var ctrl = curveControl(a, b);
        var riverImg = terrainImageByPart('rivers');
        var riverMid = overlayOpaqueAt(riverImg, ctrl.x, ctrl.y, 180);
        var riverA = overlayOpaqueAt(riverImg, a.hdX, a.hdY, 180);
        var riverB = overlayOpaqueAt(riverImg, b.hdX, b.hdY, 180);
        var pass = riverMid && !riverA && !riverB;
        return {
            a: edge.a,
            b: edge.b,
            ax: a.hdX,
            ay: a.hdY,
            bx: b.hdX,
            by: b.hdY,
            cx: ctrl.x,
            cy: ctrl.y,
            pass: pass,
            passReason: pass ? 'river-crossing' : ''
        };
    }

    function rebuildRoads() {
        var cities = state.cities;
        var info = { source: 'none', edges: [], passes: 0, isolated: [] };
        if (!cities.length) {
            state.roads = info;
            return info;
        }
        var engine = extractEngineAdjacency(cities);
        state.engineTileEdges = tileNeighborEdges(cities);
        var rawEdges = [];
        if (state.geoCities && state.geoCities.length) {
            info.source = 'lcc-neighbors';
            rawEdges = historicalNeighborEdges(cities);
        } else if (engine.edges.length) {
            info.source = 'engine';
            rawEdges = engine.edges;
        } else if (state.adjacencyJson && state.adjacencyJson.edges && state.adjacencyJson.edges.length &&
            state.adjacencyJson.useRuntimePositions !== true) {
            info.source = 'json';
            rawEdges = normalizeJsonEdges(state.adjacencyJson.edges, cities.length);
        } else {
            info.source = 'tile-neighbors';
            rawEdges = state.engineTileEdges;
        }
        var decorated = [];
        var connected = {};
        var i;
        for (i = 0; i < rawEdges.length; i++) {
            var row = decorateRoadEdge(rawEdges[i], cities);
            if (!row) {
                continue;
            }
            decorated.push(row);
            connected[row.a] = true;
            connected[row.b] = true;
            if (row.pass) {
                info.passes += 1;
            }
        }
        info.edges = decorated;
        for (i = 0; i < cities.length; i++) {
            if (!connected[cities[i].index]) {
                info.isolated.push({ i: cities[i].index, name: cities[i].name });
            }
        }
        state.roads = info;
        if (!state._roadsLogged) {
            state._roadsLogged = true;
            console.log('[hd-overworld] roads', {
                source: info.source,
                edges: info.edges.length,
                passes: info.passes,
                isolated: info.isolated,
                engineFieldHits: engine.fieldHits
            });
        }
        return info;
    }

    function strokeRoad(ctx, edge, width, color) {
        var a = toScreen(edge.ax, edge.ay);
        var b = toScreen(edge.bx, edge.by);
        var c = toScreen(edge.cx, edge.cy);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    function focusCityIndex() {
        if (validCityIndex(state.selectedIndex)) {
            return state.selectedIndex;
        }
        if (validCityIndex(state.engineCursorIndex)) {
            return state.engineCursorIndex;
        }
        return guessCurrentCity();
    }

    function isReachableEdge(edge, focus) {
        return focus >= 0 && (edge.a === focus || edge.b === focus);
    }

    function drawRoads(ctx) {
        var roads = state.roads && state.roads.edges ? state.roads.edges : [];
        if (!roads.length) {
            return;
        }
        var focus = focusCityIndex();
        var pattern = null;
        if (state.images['road:stroke'] && state.ctx) {
            try {
                pattern = ctx.createPattern(state.images['road:stroke'], 'repeat');
            } catch (e) {
                pattern = null;
            }
        }
        var i;
        for (i = 0; i < roads.length; i++) {
            strokeRoad(ctx, roads[i], 7, 'rgba(42, 30, 18, 0.55)');
        }
        for (i = 0; i < roads.length; i++) {
            if (isReachableEdge(roads[i], focus)) {
                continue;
            }
            strokeRoad(ctx, roads[i], 5, pattern || '#8b6a45');
        }
        for (i = 0; i < roads.length; i++) {
            if (!isReachableEdge(roads[i], focus)) {
                continue;
            }
            strokeRoad(ctx, roads[i], 10, 'rgba(255, 228, 140, 0.35)');
            strokeRoad(ctx, roads[i], 8, '#f0c75a');
        }
        var passImg = state.images['road:pass'];
        for (i = 0; i < roads.length; i++) {
            if (!roads[i].pass) {
                continue;
            }
            var pc = toScreen(roads[i].cx, roads[i].cy);
            if (passImg) {
                ctx.drawImage(passImg, pc.x - 16, pc.y - 16, 32, 32);
            } else {
                ctx.beginPath();
                ctx.fillStyle = '#d8c4a0';
                ctx.strokeStyle = '#3b2a18';
                ctx.lineWidth = 2;
                ctx.arc(pc.x, pc.y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    function markerImage(kind, selected) {
        if (selected && state.images['city:selected']) {
            return state.images['city:selected'];
        }
        var key = 'city:' + kind;
        return state.images[key] || state.images['city:neutral'] || state.images['city:empty'] || null;
    }

    function enterFxAmount(index, now) {
        var fx = state.enterFx;
        if (!fx || fx.index !== index || !fx.start) {
            return 0;
        }
        var t = (now - fx.start) / (fx.duration || 150);
        if (t < 0 || t > 1) {
            return 0;
        }
        return Math.sin(t * Math.PI);
    }

    function drawCities(ctx, now) {
        var cities = state.cities;
        var focus = focusCityIndex();
        for (var i = 0; i < cities.length; i++) {
            var city = cities[i];
            var scr = toScreen(city.hdX, city.hdY);
            var selected = city.index === state.selectedIndex;
            var hover = city.index === state.hoverIndex && hitsEnabled();
            var neighbor = !selected && focus >= 0 && city.index !== focus &&
                state.roads && state.roads.edges && state.roads.edges.some(function (edge) {
                    return (edge.a === focus && edge.b === city.index) ||
                        (edge.b === focus && edge.a === city.index);
                });
            var flash = enterFxAmount(city.index, now);
            var base = markerImage(city.kind, false);
            var sel = selected ? markerImage(city.kind, true) : null;
            var size = selected || flash ? 64 : (hover ? 60 : 56);
            size = Math.round(size * (1 + flash * 0.16));

            ctx.beginPath();
            ctx.fillStyle = city.color;
            ctx.globalAlpha = city.kind === 'empty' ? 0.35 : (city.kind === 'owned' ? 0.62 : 0.5);
            ctx.arc(scr.x, scr.y + 6, selected ? 26 : (city.kind === 'owned' ? 22 : 18), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            if (base) {
                ctx.drawImage(base, scr.x - size / 2, scr.y - size / 2 - 8, size, size);
            } else {
                ctx.beginPath();
                ctx.fillStyle = city.color;
                ctx.arc(scr.x, scr.y, selected ? 14 : 11, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#1b1f27';
                ctx.stroke();
            }
            if (selected && sel && sel !== base) {
                ctx.drawImage(sel, scr.x - 40, scr.y - 48, 80, 80);
            }

            ctx.beginPath();
            ctx.strokeStyle = city.color;
            ctx.lineWidth = selected ? 5 : (city.kind === 'owned' ? 4 : 3);
            ctx.arc(scr.x, scr.y + 2, selected ? 32 : (city.kind === 'owned' ? 28 : 24), 0, Math.PI * 2);
            ctx.stroke();

            if (neighbor) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(240,199,90,0.7)';
                ctx.lineWidth = 2;
                ctx.arc(scr.x, scr.y + 2, 30, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (hover) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,248,210,0.98)';
                ctx.lineWidth = 3.5;
                ctx.arc(scr.x, scr.y + 2, 38, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 1.5;
                ctx.arc(scr.x, scr.y + 2, 42, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (selected) {
                var pulse = 32 + Math.sin(now / 180) * 5;
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.88)';
                ctx.lineWidth = 2.5;
                ctx.arc(scr.x, scr.y + 2, pulse, 0, Math.PI * 2);
                ctx.stroke();
            }

            if (flash > 0) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255,255,255,' + (0.18 + flash * 0.42) + ')';
                ctx.arc(scr.x, scr.y + 2, 22 + flash * 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 + flash * 0.4) + ')';
                ctx.lineWidth = 3;
                ctx.arc(scr.x, scr.y + 2, 36 + flash * 10, 0, Math.PI * 2);
                ctx.stroke();
            }

            var label = city.name || ('城' + (city.index + 1));
            var lab = toScreen(
                city.labelX != null ? city.labelX : city.hdX,
                city.labelY != null ? city.labelY : city.hdY + 44
            );
            var lx = lab.x;
            var ly = lab.y;
            var labelPx = hover || selected ? 22 : 20;
            ctx.font = (hover || selected ? 'bold ' : '') + labelPx + 'px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            var tw = ctx.measureText(label).width;
            ctx.fillStyle = hover ? 'rgba(40, 28, 8, 0.86)' : 'rgba(14,17,22,0.72)';
            ctx.fillRect(lx - tw / 2 - 8, ly - 3, tw + 16, hover || selected ? 28 : 24);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(14,17,22,0.85)';
            ctx.strokeText(label, lx, ly);
            ctx.fillStyle = hover ? '#ffe9a8' : '#f4f7fb';
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
            if (!year && guess.year && guess.year.value >= 184 && guess.year.value <= 220) {
                year = guess.year;
            }
            if (!month && guess.month) {
                month = guess.month;
            }
        }
        if (year && year.value >= 184 && year.value <= 220) {
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
        var roadN = state.roads && state.roads.edges ? state.roads.edges.length : 0;
        var passN = state.roads && state.roads.passes ? state.roads.passes : 0;
        var roadBit = roadN ? (roadN + ' 路') : '无路网';
        if (passN) {
            roadBit += '/' + passN + ' 关';
        }
        var hoverCity = hitsEnabled() && validCityIndex(state.hoverIndex) ? state.cities[state.hoverIndex] : null;
        if (hoverCity) {
            extra = '悬停 ' + hoverCity.name + (hoverCity.kind === 'owned' ? '（己方）' : '') + '  ·  ' + extra;
        }
        state.hudRight.textContent = n + ' 城  ·  ' + roadBit + '  ·  ' + extra;
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
        drawRoads(ctx);
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
            var scr = toScreen(c.hdX, c.hdY);
            var dx = pt.x - scr.x;
            var dy = pt.y - scr.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            var lab = toScreen(
                c.labelX != null ? c.labelX : c.hdX,
                c.labelY != null ? c.labelY : c.hdY + 44
            );
            var dl = Math.sqrt((pt.x - lab.x) * (pt.x - lab.x) + (pt.y - lab.y) * (pt.y - lab.y));
            if (d < bestD) {
                bestD = d;
                best = c.index;
            } else if (dl < 28 && dl < bestD) {
                bestD = dl;
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

    function readCityPos() {
        var data = engineData();
        var pos = data && data.g_CityPos;
        if (!pos) {
            return null;
        }
        var x = readNumber(pos, 'setx');
        var y = readNumber(pos, 'sety');
        if (x === null) {
            x = readNumber(pos, 'x');
        }
        if (y === null) {
            y = readNumber(pos, 'y');
        }
        if (x === null || y === null) {
            return null;
        }
        return { x: x, y: y };
    }

    function cityAtTile(x, y) {
        for (var i = 0; i < state.cities.length; i++) {
            if (state.cities[i].engX === x && state.cities[i].engY === y) {
                return state.cities[i].index;
            }
        }
        return -1;
    }

    function writeCityPos(x, y, tried) {
        var data = engineData();
        var pos = data && data.g_CityPos;
        if (!pos) {
            return false;
        }
        var namesX = ['setx', 'x'];
        var namesY = ['sety', 'y'];
        var i;
        for (i = 0; i < namesX.length; i++) {
            if (pos[namesX[i]] !== undefined) {
                tried.push('write:g_CityPos.' + namesX[i]);
                writeNumber(pos, namesX[i], x);
            }
        }
        for (i = 0; i < namesY.length; i++) {
            if (pos[namesY[i]] !== undefined) {
                tried.push('write:g_CityPos.' + namesY[i]);
                writeNumber(pos, namesY[i], y);
            }
        }
        var now = readCityPos();
        return !!(now && now.x === x && now.y === y);
    }

    function inferCurrentCity() {
        var pos = readCityPos();
        if (pos) {
            var atPos = cityAtTile(pos.x, pos.y);
            if (atPos >= 0) {
                state.haveCityPos = true;
                return atPos;
            }
        }
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
        if (state.learnedCityXY) {
            var cx = readNumber(data, 'g_CityX');
            var cy = readNumber(data, 'g_CityY');
            if (cx !== null && cy !== null) {
                var byCityXY = nearestCityToEng(cx, cy);
                if (byCityXY >= 0) {
                    var at = state.cities[byCityXY];
                    if (at.engX === cx && at.engY === cy) {
                        return byCityXY;
                    }
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

    function adjacencyNeighbors(index) {
        var edges = state.engineTileEdges && state.engineTileEdges.length
            ? state.engineTileEdges
            : (state.roads && state.roads.edges ? state.roads.edges : []);
        var out = [];
        var i;
        for (i = 0; i < edges.length; i++) {
            if (edges[i].a === index) {
                out.push(edges[i].b);
            } else if (edges[i].b === index) {
                out.push(edges[i].a);
            }
        }
        return out;
    }

    function dirBetweenCities(fromIdx, toIdx) {
        var from = state.cities[fromIdx];
        var to = state.cities[toIdx];
        if (!from || !to) {
            return null;
        }
        var dx = to.engX - from.engX;
        var dy = to.engY - from.engY;
        if (dx === 0 && dy === 0) {
            return null;
        }
        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? 'R' : 'L';
        }
        return dy >= 0 ? 'D' : 'U';
    }

    function bfsCityPath(fromIdx, toIdx) {
        var keys = [];
        var hops = [];
        if (!validCityIndex(fromIdx) || !validCityIndex(toIdx) || fromIdx === toIdx) {
            return { keys: keys, hops: hops, landed: fromIdx === toIdx, end: fromIdx };
        }
        var queue = [fromIdx];
        var prev = {};
        prev[fromIdx] = null;
        var qi = 0;
        while (qi < queue.length) {
            var cur = queue[qi++];
            if (cur === toIdx) {
                break;
            }
            var neigh = adjacencyNeighbors(cur);
            var i;
            for (i = 0; i < neigh.length; i++) {
                if (prev[neigh[i]] === undefined) {
                    prev[neigh[i]] = cur;
                    queue.push(neigh[i]);
                }
            }
        }
        if (prev[toIdx] === undefined) {
            return { keys: keys, hops: hops, landed: false, end: fromIdx };
        }
        var walk = [];
        var node = toIdx;
        while (node !== fromIdx) {
            walk.push(node);
            node = prev[node];
        }
        walk.reverse();
        var at = fromIdx;
        var s;
        for (s = 0; s < walk.length; s++) {
            var dir = dirBetweenCities(at, walk[s]);
            if (!dir) {
                break;
            }
            keys.push(dir);
            hops.push(walk[s]);
            at = walk[s];
        }
        return { keys: keys, hops: hops, landed: at === toIdx, end: at };
    }

    function tileKeySequence(fromTile, toTile) {
        var keys = [];
        if (!fromTile || !toTile) {
            return keys;
        }
        var x = fromTile.x;
        var y = fromTile.y;
        while (x < toTile.x) {
            keys.push('R');
            x += 1;
        }
        while (x > toTile.x) {
            keys.push('L');
            x -= 1;
        }
        while (y < toTile.y) {
            keys.push('D');
            y += 1;
        }
        while (y > toTile.y) {
            keys.push('U');
            y -= 1;
        }
        return keys;
    }

    function buildCityPath(fromIdx, toIdx) {
        var bfs = bfsCityPath(fromIdx, toIdx);
        if (bfs.keys.length) {
            return bfs;
        }
        var keys = [];
        if (!validCityIndex(fromIdx) || !validCityIndex(toIdx) || fromIdx === toIdx) {
            return { keys: keys, landed: fromIdx === toIdx, end: fromIdx };
        }
        var cur = fromIdx;
        var visited = {};
        var guard = 0;
        while (cur !== toIdx && guard++ < 10) {
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

    function tryWriteCityXY(city, tried) {
        var data = engineData();
        if (!data || !city) {
            return false;
        }
        var wroteX = false;
        var wroteY = false;
        if (data.g_CityX !== undefined) {
            tried.push('write:g_CityX');
            wroteX = writeNumber(data, 'g_CityX', city.engX);
        }
        if (data.g_CityY !== undefined) {
            tried.push('write:g_CityY');
            wroteY = writeNumber(data, 'g_CityY', city.engY);
        }
        if (data.g_CityPos && typeof data.g_CityPos === 'object') {
            if (data.g_CityPos.x !== undefined) {
                tried.push('write:g_CityPos.x');
                writeNumber(data.g_CityPos, 'x', city.engX);
            }
            if (data.g_CityPos.y !== undefined) {
                tried.push('write:g_CityPos.y');
                writeNumber(data.g_CityPos, 'y', city.engY);
            }
        }
        return wroteX && wroteY &&
            readNumber(data, 'g_CityX') === city.engX &&
            readNumber(data, 'g_CityY') === city.engY;
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
        engineSendKey((window.baye && baye.VK_EXIT) || VK.EXIT);
        state.menuDepth = 0;
        state.hdOpenedMenu = false;
        state.pendingEnter = false;
        state.aligning = false;
        if (global.BayeHdCityMenu) {
            BayeHdCityMenu.close({ silent: true });
        }
        setPhase(playerKingId() !== null && citiesHaveBelong(engineData()) ? 'map' : inferPhase());
        state.hint = hint || '已回到大地图。';
    }

    function confirmClassicMenu(hint) {
        state.pendingEnter = false;
        state.aligning = false;
        state.hdOpenedMenu = true;
        state.menuDepth = Math.max(1, state.menuDepth);
        setPhase('classic-menu');
        var idx = validCityIndex(state.selectedIndex) ? state.selectedIndex : state.engineCursorIndex;
        var hdMenu = global.BayeHdCityMenu && BayeHdCityMenu.shouldShowHd();
        if (hdMenu) {
            BayeHdCityMenu.open({
                cityIndex: idx,
                cityName: validCityIndex(idx) && state.cities[idx] ? state.cities[idx].name : '',
                hook: 'confirm'
            });
            state.hint = hint || 'HD 城池菜单。点内政/外交/军备/状况；返回回大地图。';
        } else {
            state.hint = hint || '经典城池菜单（内政/外交/军备/状况）。空格关闭；点地图空白回 HD。';
        }
    }

    function guessCurrentCity() {
        var cur = inferCurrentCity();
        if (validCityIndex(cur)) {
            return cur;
        }
        if (validCityIndex(state.engineCursorIndex)) {
            return state.engineCursorIndex;
        }
        var owned = -1;
        var ownedCount = 0;
        for (var i = 0; i < state.cities.length; i++) {
            if (state.cities[i].kind === 'owned') {
                ownedCount += 1;
                if (owned < 0) {
                    owned = i;
                }
            }
        }
        if (ownedCount === 1) {
            return owned;
        }
        return owned;
    }

    function logAlign(from, to, method, ok, extra) {
        var fromCity = validCityIndex(from) ? state.cities[from] : null;
        var toCity = validCityIndex(to) ? state.cities[to] : null;
        var line = '[hd-overworld] align ' +
            (fromCity ? fromCity.name : '?') + '(' + from + ') → ' +
            (toCity ? toCity.name : '?') + '(' + to + ') method=' + method +
            (ok ? ' ok' : ' fail');
        if (extra) {
            line += ' ' + extra;
        }
        if (ok) {
            console.log(line);
        } else {
            console.warn(line);
        }
        return line;
    }

    function finishAlignFail(token, tried, from, to, method, extra) {
        if (token !== state.alignToken) {
            return;
        }
        state.pendingEnter = false;
        state.aligning = false;
        state.hdOpenedMenu = false;
        state.alignLog = {
            ok: false,
            method: method,
            from: from,
            to: to,
            tried: tried,
            cursor: inferCurrentCity(),
            cityPos: readCityPos(),
            learned: state.learnedCursorField
        };
        logAlign(from, to, method, false, extra || '');
        state.hint = '未能对齐到目标城，已留在 HD。可再点一次或切回经典键操。';
        applyChrome();
    }

    function sendEnterWaitMenu(token, tried, wrote, meta) {
        if (token !== state.alignToken) {
            return;
        }
        meta = meta || {};
        var enter = (window.baye && baye.VK_ENTER) || VK.ENTER;
        var from = meta.from;
        var to = meta.to != null ? meta.to : state.selectedIndex;
        var method = meta.method || (wrote ? 'write' : 'enter');
        var cursor = inferCurrentCity();
        if (validCityIndex(to) && cursor !== to && !meta.skipCursorCheck) {
            finishAlignFail(token, tried, from, to, method, 'cursor=' + cursor + ' before ENTER');
            return;
        }
        state.pendingEnter = true;
        if (validCityIndex(to)) {
            state.engineCursorIndex = to;
        }
        engineSendKey(enter);
        state.alignLog = {
            ok: true,
            method: method,
            from: from,
            to: to,
            wroteField: wrote,
            tried: tried,
            target: to,
            cursor: cursor,
            cityPos: readCityPos(),
            learned: state.learnedCursorField
        };
        logAlign(from, to, method, true, 'enter');
        console.log('[hd-overworld] input P1', state.alignLog);
        state.hint = '已发送确认，等待经典菜单…';
        later(token, 420, function () {
            if (state.phase === 'classic-menu') {
                return;
            }
            tried.push('retry-enter');
            engineSendKey(enter);
            later(token, 480, function () {
                if (state.phase === 'classic-menu') {
                    return;
                }
                finishAlignFail(token, tried, from, to, method, 'menu-timeout');
            });
        });
    }

    function sendEnterAndOpenMenu(token, tried, wrote) {
        sendEnterWaitMenu(token, tried, wrote, { method: 'enter-fallback', skipCursorCheck: true });
    }

    function walkKeysThenEnter(token, tried, from, to, keys, method, expectTile) {
        var step = 0;
        var maxSteps = Math.max(keys.length, 1) + 4;
        function sendNext() {
            if (token !== state.alignToken) {
                return;
            }
            if (step >= keys.length) {
                var landed = inferCurrentCity();
                var pos = readCityPos();
                var tileOk = !expectTile || (pos && pos.x === expectTile.x && pos.y === expectTile.y);
                if (landed === to || tileOk) {
                    if (landed === to) {
                        state.engineCursorIndex = to;
                    }
                    later(token, 70, function () {
                        sendEnterWaitMenu(token, tried, false, {
                            from: from,
                            to: to,
                            method: method,
                            skipCursorCheck: tileOk && landed !== to
                        });
                    });
                    return;
                }
                finishAlignFail(token, tried, from, to, method, 'landed=' + landed);
                return;
            }
            if (step >= maxSteps) {
                finishAlignFail(token, tried, from, to, method, 'step-timeout');
                return;
            }
            var beforePos = readCityPos();
            var before = snapshotIndexFields();
            engineSendKey(dirCode(keys[step]));
            step += 1;
            later(token, 100, function () {
                learnCursorField(before, snapshotIndexFields());
                var nowPos = readCityPos();
                if (beforePos && nowPos && beforePos.x === nowPos.x && beforePos.y === nowPos.y) {
                    tried.push('stuck:' + keys[step - 1]);
                    if (!tried._exitedForStuck) {
                        tried._exitedForStuck = true;
                        tried.push('exit-to-map');
                        engineSendKey((window.baye && baye.VK_EXIT) || VK.EXIT);
                        step -= 1;
                        later(token, 160, sendNext);
                        return;
                    }
                }
                var now = inferCurrentCity();
                if (validCityIndex(now)) {
                    state.engineCursorIndex = now;
                }
                sendNext();
            });
        }
        sendNext();
    }

    function alignAndEnter(index) {
        var city = state.cities[index];
        var tried = [];
        var token = state.alignToken;
        if (!city) {
            state.aligning = false;
            return;
        }
        var from = guessCurrentCity();
        var fromPos = readCityPos();
        var toTile = { x: city.engX, y: city.engY };
        tried.push('from:' + from);
        if (fromPos) {
            tried.push('fromTile:' + fromPos.x + ',' + fromPos.y);
        }

        if (from === index) {
            tried.push('already-on-target');
            later(token, 50, function () {
                sendEnterWaitMenu(token, tried, false, { from: from, to: index, method: 'already-on-target' });
            });
            return;
        }

        // g_CityPos.setx/sety 读回可写，但 ENTER 仍走引擎内部光标（西凉点安定会进错城）。
        // 只按探测到的格坐标发方向键，不靠盲写。
        if (state.learnedCursorField) {
            var wrote = tryWriteCursor(index, tried);
            if (wrote && inferCurrentCity() === index && !fromPos) {
                tried.push('verified-write');
                later(token, 70, function () {
                    sendEnterWaitMenu(token, tried, true, { from: from, to: index, method: 'write-index' });
                });
                return;
            }
        }

        alignByKeys(token, tried, from, index, fromPos, toTile);
    }

    function alignByKeys(token, tried, from, index, fromPos, toTile) {
        if (fromPos && toTile) {
            var tileKeys = tileKeySequence(fromPos, toTile);
            tried.push('tileKeys:' + tileKeys.join(''));
            if (tileKeys.length) {
                walkKeysThenEnter(token, tried, from, index, tileKeys, 'tile-walk', toTile);
                return;
            }
        }
        if (from >= 0) {
            var path = bfsCityPath(from, index);
            if (!path.keys.length) {
                path = buildCityPath(from, index);
            }
            tried.push('bfs:' + path.keys.join('') + (path.landed ? ':ok' : ':partial'));
            if (path.keys.length) {
                walkKeysThenEnter(token, tried, from, index, path.keys, 'bfs-adj', null);
                return;
            }
        }
        finishAlignFail(token, tried, from, index, 'none', 'no-path');
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
        var city = state.cities[index];
        state.selectedIndex = index;
        state.aligning = true;
        state.alignToken += 1;
        state.enterFx = { index: index, start: Date.now(), duration: 150 };
        state.hint = city && city.kind === 'owned'
            ? '对齐己方城并打开经典菜单…'
            : '对齐光标…他方/空城可能只查看，己方城才能内政。';
        later(state.alignToken, 160, function () {
            try {
                alignAndEnter(index);
            } catch (err) {
                console.warn('[hd-overworld] align failed', err);
                finishAlignFail(state.alignToken, ['align-error'], inferCurrentCity(), index, 'error', String(err));
            }
        });
    }

    function bindInput() {
        if (!state.canvas || state.inputBound) {
            return;
        }
        state.inputBound = true;
        state.canvas.addEventListener('pointerdown', function (ev) {
            if (state.mode !== 'hd-map' || state.phase !== 'map' || state.aligning) {
                return;
            }
            state.pan.on = true;
            state.pan.moved = false;
            state.pan.suppressClick = false;
            state.pan.lastX = ev.clientX;
            state.pan.lastY = ev.clientY;
            try {
                state.canvas.setPointerCapture(ev.pointerId);
            } catch (e) {}
            state.canvas.classList.add('hd-panning');
        });
        state.canvas.addEventListener('pointermove', function (ev) {
            var pt = eventToDesign(ev);
            if (pt) {
                state.pointer.x = pt.x;
                state.pointer.y = pt.y;
                state.pointer.on = true;
            }
            if (state.pan.on && state.mode === 'hd-map' && state.phase === 'map') {
                var s = state.camera.scale || 1;
                var dx = ev.clientX - state.pan.lastX;
                var dy = ev.clientY - state.pan.lastY;
                if (Math.abs(dx) + Math.abs(dy) > 2) {
                    state.pan.moved = true;
                    state.pan.suppressClick = true;
                }
                if (state.pan.moved) {
                    var rect = state.canvas.getBoundingClientRect();
                    var sx = rect.width ? DESIGN_W / rect.width : 1;
                    var sy = rect.height ? DESIGN_H / rect.height : 1;
                    state.camera.x -= dx * sx / s;
                    state.camera.y -= dy * sy / s;
                    clampCamera();
                    state.pan.lastX = ev.clientX;
                    state.pan.lastY = ev.clientY;
                    state.hoverIndex = -1;
                    return;
                }
            }
            if (!hitsEnabled()) {
                state.hoverIndex = -1;
                return;
            }
            if (!pt) {
                return;
            }
            state.hoverIndex = hitCity(pt);
        });
        function endPan(ev) {
            if (state.pan.on) {
                state.pan.on = false;
                /* Hard clamp on release. No inertia / leftover velocity. */
                clampCamera();
                state.canvas.classList.remove('hd-panning');
                try {
                    state.canvas.releasePointerCapture(ev.pointerId);
                } catch (e) {}
            }
        }
        state.canvas.addEventListener('pointerup', endPan);
        state.canvas.addEventListener('pointercancel', endPan);
        state.canvas.addEventListener('mouseleave', function () {
            state.hoverIndex = -1;
            state.pointer.on = false;
        });
        state.canvas.addEventListener('click', function (ev) {
            if (state.mode !== 'hd-map') {
                return;
            }
            if (state.pan.suppressClick) {
                state.pan.suppressClick = false;
                ev.preventDefault();
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
            if (global.BayeHdCityMenu && BayeHdCityMenu.isOpen()) {
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
        cancelAlign();
        var mode = normalizeMode(value);
        writeStorage(STORAGE_KEY, mode);
        state.mode = mode;
        if (mode === 'hd-map') {
            state.hint = '拖动平移。点己方城打开经典菜单；可切回经典 LCD。';
            state.probed = false;
            state._roadsLogged = false;
            if (global.BayeHdOverworldProbe) {
                global.BayeHdOverworldProbe.run();
            }
            state.phase = inferPhase();
            loadAssets(function () {
                sampleCities();
                state.phase = inferPhase();
                if (!validCityIndex(state.engineCursorIndex)) {
                    state.engineCursorIndex = guessCurrentCity();
                }
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
            clampCamera();
            draw();
        }
    });

    global.BayeHdOverworld = {
        STORAGE_KEY: STORAGE_KEY,
        getMode: getMode,
        setMode: setMode,
        getPhase: function () { return state.phase; },
        getCities: function () { return state.cities; },
        mapToScreen: toScreen,
        panBy: function (dx, dy) {
            state.camera.x += dx;
            state.camera.y += dy;
            clampCamera();
            if (state.mode === 'hd-map') {
                draw();
            }
            return state.camera;
        },
        setScale: function (scale, aroundSx, aroundSy) {
            var ax = aroundSx != null ? aroundSx : DESIGN_W / 2;
            var ay = aroundSy != null ? aroundSy : DESIGN_H / 2;
            var before = toMap(ax, ay);
            state.camera.scale = scale;
            clampCamera();
            var s = state.camera.scale || 1;
            state.camera.x = before.x - ax / s;
            state.camera.y = before.y - ay / s;
            clampCamera();
            if (state.mode === 'hd-map') {
                draw();
            }
            return state.camera;
        },
        getCamera: function () { return state.camera; },
        getCameraBounds: cameraLimits,
        leaveMenu: leaveClassicMenu,
        getAlignLog: function () { return state.alignLog; },
        getDateInfo: function () { return state.dateInfo; },
        getLearnedCursor: function () { return state.learnedCursorField; },
        getRoads: function () { return state.roads; },
        getCursorPolicy: function () { return state.cursorPolicy; },
        getFocusCity: function () { return focusCityIndex(); },
        debugPaintFeedback: function (opts) {
            opts = opts || {};
            if (opts.hoverIndex != null) {
                state.hoverIndex = opts.hoverIndex;
            }
            if (opts.selectedIndex != null) {
                state.selectedIndex = opts.selectedIndex;
            }
            if (opts.flashIndex != null) {
                state.enterFx = {
                    index: opts.flashIndex,
                    start: Date.now() - (opts.flashAt != null ? opts.flashAt : 75),
                    duration: opts.duration || 150
                };
            }
            if (state.mode === 'hd-map') {
                draw();
            }
            return this.debugSnapshot();
        },
        applyPcPage: applyPcPage,
        applyEarlyDocumentAttrs: applyEarlyDocumentAttrs,
        start: start,
        debugSnapshot: function () {
            var data = engineData();
            return {
                mode: state.mode,
                phase: state.phase,
                aligning: state.aligning,
                selectedIndex: state.selectedIndex,
                hoverIndex: state.hoverIndex,
                focusCity: focusCityIndex(),
                cursorPolicy: state.cursorPolicy,
                enterFx: state.enterFx,
                dateInfo: state.dateInfo,
                learnedCursor: state.learnedCursorField,
                haveCityPos: state.haveCityPos,
                engineCursorIndex: state.engineCursorIndex,
                cityPos: readCityPos(),
                alignLog: state.alignLog,
                playerKingRaw: data ? readNumber(data, 'g_PlayerKing') : null,
                playerBelong: playerKingId(),
                yearDate: data ? readNumber(data, 'g_YearDate') : null,
                monthDate: data ? readNumber(data, 'g_MonthDate') : null,
                cityX: data ? readNumber(data, 'g_CityX') : null,
                cityY: data ? readNumber(data, 'g_CityY') : null,
                focusX: data ? readNumber(data, 'g_FoucsX') : null,
                focusY: data ? readNumber(data, 'g_FoucsY') : null,
                owned: state.cities.filter(function (c) { return c.kind === 'owned'; })
                    .map(function (c) { return { i: c.index, name: c.name, belong: c.belong }; }),
                layout: state.geoCities ? 'china-lcc' : 'engine-grid',
                camera: {
                    x: Number(state.camera.x.toFixed(3)),
                    y: Number(state.camera.y.toFixed(3)),
                    scale: Number(state.camera.scale.toFixed(3)),
                    mapW: state.camera.mapW,
                    mapH: state.camera.mapH,
                    minX: state.camera.minX,
                    minY: state.camera.minY,
                    maxX: state.camera.maxX,
                    maxY: state.camera.maxY,
                    inited: state.camera.inited
                },
                roads: {
                    source: state.roads.source,
                    edges: state.roads.edges ? state.roads.edges.length : 0,
                    passes: state.roads.passes || 0,
                    isolated: state.roads.isolated || []
                }
            };
        }
    };
})(window);
