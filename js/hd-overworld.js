/**
 * HD 大地图表现壳（P0 容器 + P1 城态/点选 + P2 路网 + P3 反馈）。
 * 视觉地理：中国 LCC 地形全图（China LCC topographic, eqdc）。不改 WASM / dat.lib。
 * 经典模式默认，可切回。规格：docs/hd-overworld-spec.md
 */
(function (global) {
    var STORAGE_KEY = 'baye/overworldMode';
    var MOBILE_STORAGE_KEY = 'baye/mobileOverworldMode';
    var ASSET_ROOT = 'assets/hd-overworld/';
    var STANDARD_LIB_SHA256 = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var DESIGN_W = 1920;
    var DESIGN_H = 1080;
    var SAFE = { left: 48, top: 72, right: 1872, bottom: 1048 };
    var HIT_RADIUS = 52;
    /* Client-pixel drag threshold. 2px treated tap jitter as a pan and ate the next city click. */
    var PAN_THRESHOLD = 10;
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
        mobile: false,
        mobileMode: null,
        mode: 'classic',
        phase: 'other',
        canvas: null,
        ctx: null,
        hudLeft: null,
        hudRight: null,
        legendOwned: null,
        legendNeutral: null,
        legendEmpty: null,
        legendSignature: '',
        manifest: null,
        images: {},
        environmentPaint: null,
        palette: DEFAULT_PALETTE,
        cities: [],
        hoverIndex: -1,
        selectedIndex: -1,
        assetsReady: false,
        assetsLoading: false,
        assetGeneration: 0,
        libraryIdentity: null,
        identityBound: false,
        layoutMatched: false,
        presentationReason: 'lib-unavailable',
        loopId: 0,
        visibilityBound: false,
        lastSample: 0,
        lastDraw: 0,
        probed: false,
        hookWrapped: false,
        toolbarBound: false,
        inputBound: false,
        inputFallbackNoted: false,
        alignLog: null,
        lastAlignWhy: null,
        aligning: false,
        alignSnapRetry: false,
        alignToken: 0,
        alignTimer: 0,
        pendingEnter: false,
        learnedCursorField: null,
        learnedCityXY: false,
        engineCursorIndex: -1,
        menuDepth: 0,
        hdOpenedMenu: false,
        suppressCityIdle: 0,
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
        pan: { on: false, lastX: 0, lastY: 0, startX: 0, startY: 0, moved: false, suppressClick: false, tapHandled: false },
        pointer: { x: 0, y: 0, on: false },
        enterFx: { index: -1, start: 0, duration: 150 },
        /* os-pointer：不画自定义光标。cursor.png 会与系统指针叠影；cursor_hover.png 像禁止符。 */
        cursorPolicy: 'os-pointer',
        haveCityPos: false,
        mapShownAt: 0,
        lastMapCity: -1,
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
        if (state.mobile && state.mobileMode !== null) { return state.mobileMode; }
        return normalizeMode(readStorage(state.mobile ? MOBILE_STORAGE_KEY : STORAGE_KEY, state.mobile ? 'hd-map' : 'classic'));
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

    function hdReady() {
        try {
            return !!(window.baye && baye.hd && typeof baye.hd.ready === 'function' && baye.hd.ready());
        } catch (e) {
            return false;
        }
    }

    function ensureEngineData() {
        if (!hdReady()) {
            return null;
        }
        if (window.baye && typeof baye.ensureData === 'function') {
            return baye.ensureData();
        }
        return window.baye && baye.data ? baye.data : null;
    }

    function engineData() {
        return ensureEngineData();
    }

    function identityApi() { return global.BayeHdLibIdentity || null; }

    function readIdentity() {
        var api = identityApi();
        try { return api && api.read ? api.read() : null; } catch (e) { return null; }
    }

    function libraryAllowed(snapshot) {
        var api = identityApi();
        try {
            return !!(snapshot && snapshot.status === 'ready' && snapshot.sha256 === STANDARD_LIB_SHA256 &&
                api && api.isCurrent && api.isCurrent(snapshot));
        } catch (e) { return false; }
    }

    function provenanceAllowed(record, snapshot) {
        return libraryAllowed(snapshot) && !!record && record.libSha256 === snapshot.sha256;
    }

    function mapAuthorized() {
        var snapshot = readIdentity();
        return libraryAllowed(snapshot) && !!state.libraryIdentity &&
            snapshot.generation === state.libraryIdentity.generation && state.layoutMatched && state.assetsReady &&
            provenanceAllowed(state.manifest, snapshot) && provenanceAllowed(state.geoMeta, snapshot);
    }

    function mapInputAuthorized() {
        if (!mapAuthorized() || miniMapActive()) { return false; }
        var data = engineData(), positions = data && data.g_CityPositions;
        var matching = cityCount() === state.cities.length && !!positions;
        for (var i = 0; matching && i < state.cities.length; i++) {
            var city = state.cities[i], pos = positions[city.index];
            matching = !!pos && cityName(city.index) === city.name &&
                readNumber(pos, 'x') === city.engX && readNumber(pos, 'y') === city.engY;
        }
        // Name getters can run Mod code. Recheck the actual loaded library
        // after those reads before granting any input to the engine.
        if (!mapAuthorized()) {
            cancelAlign();
            return false;
        }
        if (!matching) {
            cancelAlign();
            state.layoutMatched = false;
            state.engineTileEdges = [];
            state.roads = { source: 'none', edges: [], passes: 0, isolated: [] };
            state.presentationReason = 'city-layout-mismatch';
            applyChrome();
        }
        return matching;
    }

    function retireMapPresentation() {
        cancelAlign();
        state.assetGeneration++;
        state.assetsReady = false;
        state.assetsLoading = false;
        state.layoutMatched = false;
        state.manifest = null;
        state.images = {};
        state.environmentPaint = null;
        state.palette = DEFAULT_PALETTE;
        state.geoMeta = null;
        state.geoCities = null;
        state.adjacencyJson = null;
        state.cities = [];
        state.engineTileEdges = [];
        state.roads = { source: 'none', edges: [], passes: 0, isolated: [] };
        state.camera.inited = false;
        state.camera.lockedFull = false;
        state.selectedIndex = state.hoverIndex = state.engineCursorIndex = -1;
        state.learnedCursorField = null;
        state.haveCityPos = false;
        state.hdOpenedMenu = false;
        state.pendingEnter = false;
        state.menuDepth = 0;
        state.probed = false;
        state._roadsLogged = false;
        resetPan();
        if (state.loopId) { global.cancelAnimationFrame(state.loopId); state.loopId = 0; }
    }

    function syncLibraryIdentity(snapshot) {
        snapshot = snapshot || readIdentity();
        var previous = state.libraryIdentity;
        if (!previous || !snapshot || previous.generation !== snapshot.generation ||
            previous.status !== snapshot.status || previous.sha256 !== snapshot.sha256) {
            retireMapPresentation();
            state.libraryIdentity = snapshot;
        }
        state.presentationReason = libraryAllowed(snapshot) ? 'assets-pending' :
            (snapshot && snapshot.status === 'ready' ? 'lib-not-supported' : (snapshot && snapshot.reason || 'lib-unavailable'));
        if (state.mode === 'hd-map' && libraryAllowed(snapshot)) {
            loadAssets(function () {
                sampleCities();
                state.phase = inferPhase();
                applyChrome();
                draw();
                ensureLoop();
            });
        }
        applyChrome();
    }

    function bindLibraryIdentity() {
        if (state.identityBound) { return; }
        var api = identityApi();
        if (api && typeof api.subscribe === 'function') {
            state.identityBound = true;
            api.subscribe(syncLibraryIdentity);
        }
        syncLibraryIdentity();
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
        // Identity metadata changed with this renderer. Retire cached JSON
        // without forcing unchanged terrain images to download again.
        return ASSET_ROOT + rel + (/\.json$/.test(rel) ? '?ver=20261010a' : '');
    }

    function loadAssets(done) {
        var identity = readIdentity();
        if (!libraryAllowed(identity)) { return; }
        if (state.assetsReady || state.assetsLoading) {
            if (state.assetsReady && done) {
                done();
            }
            return;
        }
        state.assetsLoading = true;
        var ticket = ++state.assetGeneration;
        function current() {
            return ticket === state.assetGeneration && state.mode === 'hd-map' && libraryAllowed(identity);
        }
        loadJSON(assetUrl('manifest.json'), function (manifest) {
            if (!current()) { return; }
            if (!provenanceAllowed(manifest, identity)) {
                state.assetsLoading = false;
                state.presentationReason = 'manifest-identity-mismatch';
                applyChrome();
                return;
            }
            state.manifest = manifest;
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
                if (!current()) { return; }
                left -= 1;
                if (left <= 0) {
                    state.assetsReady = provenanceAllowed(state.geoMeta, identity) && !!state.geoCities;
                    state.assetsLoading = false;
                    if (!state.assetsReady) {
                        state.presentationReason = 'geo-identity-mismatch';
                        applyChrome();
                        return;
                    }
                    if (done) {
                        done();
                    }
                }
            }
            loadJSON(assetUrl(paletteRel), function (palette) {
                if (!current()) { return; }
                if (palette) {
                    state.palette = palette;
                }
                tick();
            });
            loadJSON(assetUrl('roads/adjacency.json'), function (adj) {
                if (!current()) { return; }
                state.adjacencyJson = provenanceAllowed(adj, identity) ? adj : null;
                tick();
            });
            loadJSON(assetUrl('china-lcc-cities.json'), function (geo) {
                if (!current()) { return; }
                state.geoMeta = provenanceAllowed(geo, identity) ? geo : null;
                state.geoCities = state.geoMeta && Array.isArray(geo.cities) ? geo.cities : null;
                tick();
            });
            for (var p = 0; p < pending.length; p++) {
                (function (item) {
                    loadImage(item.url, function (img) {
                        if (!current()) { return; }
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
        if (state.mobile) {
            var focus = state.cities[readMapCity()] || state.cities[0];
            state.camera.scale = 0.4;
            state.camera.x = focus.hdX - DESIGN_W / state.camera.scale / 2;
            state.camera.y = focus.hdY - DESIGN_H / state.camera.scale / 2;
            clampCamera();
            state.camera.inited = true;
            state.camera.lockedFull = true;
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
        if (raw === null || raw < 0 || raw >= 0xffff || Math.floor(raw) !== raw) {
            return null;
        }
        return resolvePlayerBelong(raw);
    }

    function resolvePlayerBelong(rawKing) {
        // Native City.Belong is a one-based PersonID; g_PlayerKing is zero-based.
        return rawKing + 1;
    }

    function cityCount() {
        try {
            if (window.baye && typeof baye.hdCityLimit === 'function') {
                return baye.hdCityLimit() || 0;
            }
        } catch (e) {}
        return 0;
    }

    function cityName(index) {
        index = Number(index);
        var max = cityCount();
        if (!isFinite(index) || index < 0 || index >= 0xfffe || (max > 0 && index >= max)) {
            return '';
        }
        try {
            if (window.baye && typeof baye.getCityName === 'function') {
                var n = baye.getCityName(index);
                if (n) {
                    return n;
                }
            }
        } catch (e) {}
        return '';
    }

    function cityKind(city, kingId) {
        var belong = cityBelong(city);
        if (belong === null) { return 'unknown'; }
        if (belong === 0) {
            return 'empty';
        }
        if (kingId && belong === kingId) {
            return 'owned';
        }
        return 'neutral';
    }

    function cityBelong(city) {
        var belong = city && city.Belong;
        if (belong && typeof belong === 'object' && 'value' in belong) { belong = belong.value; }
        // City owners use zero or a one-based PersonID; 0xffff is not a city lord.
        return typeof belong === 'number' && isFinite(belong) && belong >= 0 && belong < 0xffff &&
            Math.floor(belong) === belong ? belong : null;
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
        if (belong === null || belong === 0) {
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
        if (!table || !table.length || !provenanceAllowed(state.geoMeta, readIdentity())) {
            return null;
        }
        var i;
        for (i = 0; i < table.length; i++) {
            if (table[i].i === row.index && table[i].name === row.name && row.source === 'engine' &&
                table[i].engX === row.engX && table[i].engY === row.engY &&
                typeof table[i].hdX === 'number' && isFinite(table[i].hdX) &&
                typeof table[i].hdY === 'number' && isFinite(table[i].hdY)) {
                return table[i];
            }
        }
        return null;
    }

    function sampleCities() {
        var identity = readIdentity();
        if (!libraryAllowed(identity) || !state.assetsReady || !provenanceAllowed(state.manifest, identity) ||
            !provenanceAllowed(state.geoMeta, identity)) {
            state.layoutMatched = false;
            state.cities = [];
            state.engineTileEdges = [];
            state.roads = { source: 'none', edges: [], passes: 0, isolated: [] };
            return [];
        }
        var generation = state.assetGeneration;
        var geoCities = state.geoCities;
        function sampleCurrent() {
            return libraryAllowed(identity) && state.assetsReady &&
                generation === state.assetGeneration && geoCities && geoCities === state.geoCities;
        }
        var data = engineData();
        var rawPos = data && data.g_CityPositions;
        var rawCities = data && data.g_Cities;
        var n = cityCount();
        if (!n) {
            if (rawCities && rawCities.length) {
                n = Math.min(rawCities.length, 64);
            } else if (rawPos && rawPos.length) {
                n = Math.min(rawPos.length, 64);
            }
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
            var belong = cityBelong(city);
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
        // A native name getter may synchronously retire this presentation.
        // Never dereference or publish assets from the previous identity/view.
        if (!sampleCurrent()) { return []; }
        var matching = !!rows.length && geoCities.length === rows.length;
        for (var r = 0; r < rows.length; r++) {
            var rec = geoRecord(rows[r]);
            if (rec && rec.hdX != null && rec.hdY != null) {
                rows[r].hdX = rec.hdX;
                rows[r].hdY = rec.hdY;
                rows[r].layout = 'china-lcc';
                usedGeo += 1;
            } else {
                matching = false;
            }
            rows[r].labelY = rows[r].hdY + 44;
            labels.push(rows[r]);
        }
        if (!sampleCurrent()) { return []; }
        state.layoutMatched = matching;
        if (!matching) {
            cancelAlign();
            state.cities = [];
            state.engineTileEdges = [];
            state.roads = { source: 'none', edges: [], passes: 0, isolated: [] };
            state.presentationReason = 'city-layout-mismatch';
            return [];
        }
        state.presentationReason = '';
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

        if (!sampleCurrent()) { return []; }
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
        // A hook records history, not ownership of the next campaign input.
        // exitBattle fires before the bridge's active flag is retired, while
        // g_FgtOver already contains C's terminal result.
        try {
            var data = engineData();
            if (data && Number(readNumber(data, 'g_FgtOver'))) { return false; }
            if (global.baye && baye.hd && typeof baye.hd.fight === 'function') {
                var fight = baye.hd.fight();
                if (fight) { return !!(fight.active && !fight.over); }
            }
        } catch (e) {}
        return !!state.sawFightHook;
    }

    function citiesHaveBelong(data) {
        if (!data || !data.g_Cities || !data.g_Cities.length) {
            return false;
        }
        var n = cityCount() || Math.min(data.g_Cities.length, 64);
        for (var i = 0; i < n; i++) {
            var b = cityBelong(data.g_Cities[i]);
            if (b !== null && b > 0) {
                return true;
            }
        }
        return false;
    }

    function inferPhase() {
        if (global.BayeHdSystemUi && BayeHdSystemUi.isOpen()) {
            return 'other';
        }
        var data = engineData();
        if (!data) {
            return 'other';
        }
        if (isFightActive()) {
            return 'other';
        }
        try {
            var menu = baye.hd.menuItems && baye.hd.menuItems();
            var march = baye.hd.march && baye.hd.march();
            if (menu && menu.active != null && march && march.mapInputSeq != null) {
                var report = baye.hd.report && baye.hd.report();
                if (report && report.active != null && Number(report.active)) { return 'other'; }
                if (Number(menu.active)) {
                    return Number(menu.context) === 1 ? 'classic-menu' : 'other';
                }
                // Reports and succession run between battle exit and the next
                // real GetCitySet. A populated world alone is not a map wait.
                return Number(march.pick) ? 'map' : 'other';
            }
        } catch (eInput) {}
        if (state.phase === 'classic-menu') { return 'classic-menu'; }
        if (inCampaign() && (citiesHaveBelong(data) || playerKingId() !== null || (state.cities && state.cities.length >= 20))) {
            return 'map';
        }
        if (playerKingId() !== null && citiesHaveBelong(data)) {
            return 'map';
        }
        return 'other';
    }

    function hitsEnabled() {
        return mapAuthorized() && state.mode === 'hd-map' && state.phase === 'map' && !state.aligning && !miniMapActive();
    }

    function miniMapActive() {
        try { return !!(global.baye && baye.hd && baye.hd.miniMap && baye.hd.miniMap().active === 1); }
        catch (e) { return false; }
    }

    function overviewData() {
        if (document.hidden || !mapAuthorized()) { return null; }
        sampleCities();
        if (!mapAuthorized()) { return null; }
        var image = terrainImageByPart('base_plains'), identity = readIdentity();
        if (!image || !image.complete || !image.naturalWidth || !state.cities.length) { return null; }
        var generation = state.assetGeneration, libraryGeneration = identity.generation;
        return { image: image, width: image.naturalWidth, height: image.naturalHeight,
            generation: state.assetGeneration, libraryGeneration: identity.generation, libSha256: identity.sha256,
            paintEnvironment: function (ctx, destination) {
                // An overview can outlive its actual LIB or visibility owner.
                if (document.hidden || state.mode !== 'hd-map' || generation !== state.assetGeneration || !mapAuthorized() ||
                    readIdentity().generation !== libraryGeneration) { return { drawn: 0, skipped: 0, operations: [] }; }
                return paintEnvironment(ctx, { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }, destination);
            },
            cities: state.cities.map(function (city) { return { index: city.index, name: city.name,
                x: city.hdX, y: city.hdY, engineX: city.engX, engineY: city.engY,
                belong: city.belong, kind: city.kind, color: city.color }; }) };
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
        if (global.BayeHdBattle && typeof BayeHdBattle.onEngineHook === 'function') {
            try {
                BayeHdBattle.onEngineHook(name, context);
            } catch (e) {
                console.warn('[hd-overworld] battle hook', name, e);
            }
        }
        if (global.BayeHdSystemUi && typeof BayeHdSystemUi.onEngineHook === 'function') {
            try {
                BayeHdSystemUi.onEngineHook(name, context);
            } catch (e) {
                console.warn('[hd-overworld] system-ui hook', name, e);
            }
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.onEngineHook === 'function') {
            try {
                BayeHdDialog.onEngineHook(name, context);
            } catch (e) {
                console.warn('[hd-overworld] dialog hook', name, e);
            }
        }
        if (!document.hidden && ['didShowMainMap', 'didOpenNewGame', 'didLoadGame'].indexOf(name) !== -1) { sampleCities(); }
        if (!mapAuthorized()) { applyChrome(); return; }
        if (state.aligning || state.pendingEnter) {
            console.log('[hd-overworld] hook while entering', name);
        }
        if (name === 'didShowMainMap') {
            state.mapShownAt = Date.now();
            state.lastMapCity = readMapCity();
            // Cached assets can finish before C initializes the world, leaving
            // no authorized RAF. This event observes the real GetCitySet wait;
            // its current input owner, rather than the event name, sets phase.
            state.phase = inferPhase();
            applyChrome();
            draw();
            ensureLoop();
            return;
        }
        if (name === 'onMenuIdle') {
            if (fightLive()) {
                state.hdOpenedMenu = false;
                return;
            }
            /* ENTER 之后 C 可能改写 setx/sety，inferCurrentCity 会偏离 selected。
             * 已发确认或根菜单已开时不要丢掉 idle，否则 720ms 会误报「未能对齐」。 */
            if (state.pendingEnter || state.hdOpenedMenu) {
                confirmClassicMenu('经典城池菜单。空格关闭；点地图空白回 HD。');
                return;
            }
            if (state.aligning) {
                if (looksLikeCityRootMenu() || !validCityIndex(state.selectedIndex) ||
                    inferCurrentCity() === state.selectedIndex || inferCurrentCity() < 0) {
                    confirmClassicMenu('经典城池菜单。空格关闭；点地图空白回 HD。');
                    return;
                }
                return;
            }
            if (looksLikeCityRootMenu() && !state.suppressCityIdle) {
                confirmClassicMenu('经典城池菜单。空格关闭；点地图空白回 HD。');
                return;
            }
        }
        if (name === 'cityMakeCommand') {
            if (fightLive()) {
                return;
            }
            confirmClassicMenu('经典城池菜单。空格关子菜单；再空格或点地图空白回 HD。');
            return;
        }
        if (name === 'willCloseMenu' && state.phase === 'classic-menu') {
            if (fightLive()) {
                return;
            }
            if (global.BayeHdCityMenu && BayeHdCityMenu.isOpen()) {
                return;
            }
            if (cityMenuHoldExit() || cityMenuHoldMenu() || cityMenuMarching() || battleMakePending()) {
                return;
            }
            state.menuDepth = Math.max(0, state.menuDepth - 1);
            if (state.menuDepth <= 0) {
                // C already consumed the player's closing key. This hook only
                // retires the shell; another EXIT would leave GetCitySet.
                leaveClassicMenu('已回到大地图。点城打开经典菜单。', { nativeClosing: true });
            }
            return;
        }
        if (name === 'didOpenNewGame' || name === 'didLoadGame') {
            cancelAlign();
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.resetForNewGame === 'function') {
                BayeHdCityMenu.resetForNewGame(name);
            }
            state.probed = false;
            state._roadsLogged = false;
            state.sawFightHook = false;
            if (!document.hidden) { sampleCities(); }
            state.phase = inferPhase();
            state.hint = '开局/读档后进入大地图才会同步城池归属。';
            applyChrome();
            // GetCitySet starts after this hook. Keep a read-only sampler alive
            // while pick is still zero; it must not fabricate a map wait.
            ensureLoop();
            return;
        }
        if (name === 'chooseActor' || name === 'chooseGameEntry' || name === 'loadPeriod') {
            cancelAlign();
            if (name === 'chooseGameEntry' && global.BayeHdCityMenu &&
                typeof BayeHdCityMenu.resetForNewGame === 'function') {
                BayeHdCityMenu.resetForNewGame(name);
            }
            setPhase('other');
            return;
        }
        if (name === 'exitBattle') {
            cancelAlign();
            state.hdOpenedMenu = false;
            state.sawFightHook = false;
            setPhase(inferPhase());
            return;
        }
        if (name === 'fightOpenMainMenu' || name === 'meetFight' ||
            name === 'drawMapUnit' || name === 'drawOneGeneral' || name === 'fightChooseAction') {
            state.sawFightHook = true;
            if (global.BayeHdBattle && BayeHdBattle.shouldShowHd()) {
                state.hint = 'HD 战场。按键仍交引擎。';
            } else {
                setPhase('other');
                state.hint = '战斗仍走经典 LCD。';
            }
        }
    }

    function wrapCallHook() {
        if (state.hookWrapped || !window.baye) {
            return;
        }
        if (!baye.hooks) {
            baye.hooks = {};
        }
        ['onMenuIdle', 'cityMakeCommand', 'willCloseMenu', 'didOpenNewGame', 'didLoadGame', 'didShowMainMap'].forEach(function (name) {
            if (typeof baye.hooks[name] !== 'function') {
                /* -1 = 只观察，不替换 CityCommon / 系统菜单。return 0 会跳过 AssartMake。 */
                baye.hooks[name] = function () { return -1; };
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
            var rv = orig.apply(this, arguments);
            if (name === 'cityMakeCommand' && (rv === undefined || rv === 0 || rv === null)) {
                return -1;
            }
            return rv;
        };
        state.hookWrapped = true;
    }

    function syncCanvasSize() {
        if (!state.canvas || !state.ctx) {
            return;
        }
        if (state.mobile) {
            var stage = document.getElementById('hd-mobile-stage');
            var rect = stage && stage.getBoundingClientRect();
            if (rect && isFinite(rect.width) && isFinite(rect.height) && rect.width > 0 && rect.height > 0) {
                var width = Math.round(rect.width), height = Math.round(rect.height);
                if (width !== DESIGN_W || height !== DESIGN_H) {
                    var center = toMap(DESIGN_W / 2, DESIGN_H / 2);
                    cancelAlign(); resetPan();
                    DESIGN_W = width; DESIGN_H = height;
                    SAFE = {left: 24, top: 24, right: width - 24, bottom: height - 24};
                    state.camera.x = center.x - width / (state.camera.scale || 1) / 2;
                    state.camera.y = center.y - height / (state.camera.scale || 1) / 2;
                    clampCamera();
                }
            }
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
        state.environmentPaint = null;
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
            state.environmentPaint = paintEnvironment(ctx, { x: sx, y: sy, w: sw, h: sh },
                { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H });
        } catch (e) {
            state.environmentPaint = null;
            drawFallbackContinent(ctx);
        }
    }

    function environmentLayers() {
        var environment = state.manifest && state.manifest.layers && state.manifest.layers.environment;
        var geo = state.geoMeta, image = terrainImageByPart('base_plains');
        // Decorative coordinates are independent of the engine's 12×9 rule grid.
        // A malformed optional layer must not take away the verified city map.
        if (!environment || environment.coordinateSystem !== 'china-lcc-raster-padded-v1' ||
            !geo || !geo.fit || !Array.isArray(geo.fit.rasterSize) || geo.fit.rasterSize.length !== 2 ||
            !image || environment.source !== geo.source ||
            !Array.isArray(environment.mapSize) || !Array.isArray(environment.rasterSize) ||
            environment.mapSize.length !== 2 || environment.rasterSize.length !== 2 ||
            environment.mapSize[0] !== image.naturalWidth || environment.mapSize[1] !== image.naturalHeight ||
            environment.rasterSize[0] !== geo.fit.rasterSize[0] || environment.rasterSize[1] !== geo.fit.rasterSize[1] ||
            !Array.isArray(environment.layers)) { return []; }
        return environment.layers.filter(function (layer) {
            var rect = layer && layer.worldRect;
            return Array.isArray(rect) && rect.length === 4 && rect.every(function (n) { return typeof n === 'number' && isFinite(n); }) &&
                rect[0] >= 0 && rect[1] >= 0 && rect[2] > 0 && rect[3] > 0 &&
                rect[0] + rect[2] <= environment.rasterSize[0] && rect[1] + rect[3] <= environment.rasterSize[1];
        });
    }

    function paintEnvironment(ctx, viewport, destination) {
        var result = { drawn: 0, skipped: 0, operations: [] }, painter = global.BayeHdOverworldLayers;
        if (document.hidden || state.mode !== 'hd-map' || !mapAuthorized() || !painter || typeof painter.draw !== 'function') { return result; }
        var layers = environmentLayers(), images = {}, terrain = state.manifest.layers.terrain || [];
        for (var i = 0; i < terrain.length; i++) { images[terrain[i]] = state.images['terrain:' + i + ':' + terrain[i]]; }
        try { return painter.draw(ctx, layers, images, viewport, destination); }
        catch (e) { return result; }
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
        if (!cities.length || !mapAuthorized() || !provenanceAllowed(state.adjacencyJson, readIdentity())) {
            state.engineTileEdges = [];
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
        } else if (provenanceAllowed(state.adjacencyJson, readIdentity()) && state.adjacencyJson.edges && state.adjacencyJson.edges.length &&
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

    function drawRoads(ctx) {
        var roads = state.roads && state.roads.edges ? state.roads.edges : [];
        if (!roads.length) {
            return;
        }
        /* Geography and tile adjacency are presentation data, not the engine's
         * march table. Selection must never turn these lines into route claims. */
        ctx.save();
        ctx.setLineDash([12, 10]);
        var i;
        for (i = 0; i < roads.length; i++) {
            strokeRoad(ctx, roads[i], 5, 'rgba(42, 30, 18, 0.35)');
        }
        for (i = 0; i < roads.length; i++) {
            strokeRoad(ctx, roads[i], 3, 'rgba(173, 153, 120, 0.75)');
        }
        ctx.restore();
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
        var key = 'city:' + kind;
        var image = selected && state.images['city:selected'] || state.images[key] ||
            state.images['city:neutral'] || state.images['city:empty'] || null;
        var art = state.manifest && state.manifest.layers && state.manifest.layers.cityArt;
        if (art && (!Array.isArray(art.pixelSize) || art.pixelSize.length !== 2 || !image ||
            image.naturalWidth !== art.pixelSize[0] || image.naturalHeight !== art.pixelSize[1])) { return null; }
        return image;
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
        for (var i = 0; i < cities.length; i++) {
            var city = cities[i];
            var scr = toScreen(city.hdX, city.hdY);
            var selected = city.index === state.selectedIndex;
            var hover = city.index === state.hoverIndex && hitsEnabled();
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
            var labelPx = state.mobile ? (hover || selected ? 16 : 14) : (hover || selected ? 22 : 20);
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

    function updateMapLegend(counts, colors) {
        if (!state.legendOwned || !state.legendNeutral || !state.legendEmpty) {
            return;
        }
        var palette = activePalette();
        var ownedColor = colors.owned[0] || palette.player;
        var emptyColor = colors.empty[0] || palette.empty;
        var neutralColors = colors.neutral.length ? colors.neutral : [palette.empty];
        var signature = [counts.owned, counts.neutral, counts.empty, counts.unknown,
            ownedColor, emptyColor, neutralColors.join(',')].join('|');
        if (signature === state.legendSignature) {
            return;
        }
        state.legendSignature = signature;
        state.legendOwned.textContent = '己方 ' + counts.owned;
        state.legendNeutral.textContent = '其他势力 ' + counts.neutral;
        state.legendEmpty.textContent = '无主城 ' + counts.empty +
            (counts.unknown ? ' · 归属未知 ' + counts.unknown : '');
        state.legendOwned.style.setProperty('--city-swatch', ownedColor);
        state.legendEmpty.style.setProperty('--city-swatch', emptyColor);
        var bands = [];
        for (var i = 0; i < neutralColors.length; i++) {
            bands.push(neutralColors[i] + ' ' + (i * 100 / neutralColors.length) + '% ' +
                ((i + 1) * 100 / neutralColors.length) + '%');
        }
        state.legendNeutral.style.setProperty('--city-swatch', 'linear-gradient(90deg, ' + bands.join(', ') + ')');
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
        var roadBit = roadN ? (roadN + ' 条装饰道路') : '无装饰道路';
        if (passN) {
            roadBit += '/' + passN + ' 过河标记';
        }
        var hoverCity = hitsEnabled() && validCityIndex(state.hoverIndex) ? state.cities[state.hoverIndex] : null;
        var counts = { owned: 0, neutral: 0, empty: 0, unknown: 0 };
        var colors = { owned: [], neutral: [], empty: [] };
        var oi;
        for (oi = 0; oi < state.cities.length; oi++) {
            var city = state.cities[oi];
            if (counts[city.kind] !== undefined) {
                /* The old gray marker also covers missing data and legacy
                 * sentinels. Only a native zero owner verifies an unowned city. */
                var rawOwner = city.city && city.city.Belong;
                var kind = city.kind === 'empty' &&
                    (rawOwner === undefined || rawOwner === null || Number(rawOwner) !== 0)
                    ? 'unknown' : city.kind;
                counts[kind] += 1;
                if (city.color && colors[city.kind] && colors[city.kind].indexOf(city.color) < 0) {
                    colors[city.kind].push(city.color);
                }
            }
        }
        updateMapLegend(counts, colors);
        if (hoverCity) {
            var ownerName = '';
            try {
                if (hoverCity.belong && window.baye && typeof baye.getPersonNameByID === 'function') {
                    ownerName = baye.getPersonNameByID(hoverCity.belong) || '';
                }
            } catch (e) {}
            extra = '悬停 ' + hoverCity.name +
                (ownerName ? '（' + ownerName + '）' : (hoverCity.kind === 'owned' ? '（己方）' : '')) +
                '  ·  ' + extra;
        }
        /* 总城恒 38；占领后变的是己方数（天水 1 → 河内后 2），不是 38→39。 */
        state.hudRight.textContent = '己方 ' + counts.owned + '/' + n + ' 城  ·  ' + roadBit + '  ·  ' + extra;
    }

    // This marker is the exact CSS owner which hides the entire world layer.
    function battleCoversMapCanvas() {
        return !!(document.documentElement &&
            typeof document.documentElement.getAttribute === 'function' &&
            document.documentElement.getAttribute('data-baye-battle') === 'hd');
    }

    function draw() {
        if (document.hidden || !state.ctx || !mapAuthorized() || battleCoversMapCanvas()) {
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
        if (document.hidden || state.mode !== 'hd-map' || !mapAuthorized()) {
            return;
        }
        var now = Date.now();
        if (now - state.lastSample > 160) {
            if (hdReady()) {
                sampleEngine();
            }
            state.lastSample = now;
        }
        draw();
        ensureLoop();
    }

    function ensureLoop() {
        if (!document.hidden && state.mode === 'hd-map' && mapAuthorized() && !state.loopId) {
            var id = global.requestAnimationFrame(function () {
                if (state.loopId !== id) { return; }
                state.loopId = 0;
                loop();
            });
            state.loopId = id;
        }
    }

    function bindRenderVisibility() {
        if (state.visibilityBound || typeof document.addEventListener !== 'function') { return; }
        state.visibilityBound = true;
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                cancelAlign(); resetPan();
                if (state.loopId) { global.cancelAnimationFrame(state.loopId); state.loopId = 0; }
                return;
            }
            applyChrome();
            if (state.mode !== 'hd-map') { return; }
            // Visibility owns painting only. Re-read the current world rather
            // than reviving the phase or city ownership sampled before hiding.
            if (hdReady()) {
                state.phase = inferPhase();
                sampleEngine();
                state.lastSample = Date.now();
            }
            draw();
            ensureLoop();
        });
    }

    function applyChrome() {
        var mode = getMode();
        state.mode = mode;
        document.documentElement.setAttribute('data-baye-overworld', mode);
        var body = document.body;
        if (!body) {
            return;
        }
        var show = mode === 'hd-map' && mapAuthorized();
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
        if (!ev || !rect || ![rect.left, rect.top, rect.width, rect.height,
            ev.clientX, ev.clientY, DESIGN_W, DESIGN_H].every(function (n) {
                return typeof n === 'number' && isFinite(n);
            }) || rect.width <= 0 || rect.height <= 0 || DESIGN_W <= 0 || DESIGN_H <= 0 ||
            ev.clientX < rect.left || ev.clientY < rect.top ||
            ev.clientX >= rect.left + rect.width || ev.clientY >= rect.top + rect.height) {
            return null;
        }
        return {
            x: (ev.clientX - rect.left) / rect.width * DESIGN_W,
            y: (ev.clientY - rect.top) / rect.height * DESIGN_H
        };
    }

    function hitCity(pt) {
        if (!mapAuthorized() || !pt || !isFinite(pt.x) || !isFinite(pt.y)) { return -1; }
        var best = -1;
        var bestD = HIT_RADIUS;
        var radius = HIT_RADIUS, labelRadius = 28, scaleX = 1, scaleY = 1;
        if (state.mobile) {
            var rect = state.canvas.getBoundingClientRect();
            if (!rect || !(rect.width > 0 && rect.height > 0)) { return -1; }
            scaleX = rect.width / DESIGN_W;
            scaleY = rect.height / DESIGN_H;
            // Distances are CSS pixels on mobile, independent of backing DPR.
            radius = labelRadius = 22;
            bestD = Infinity;
        }
        for (var i = 0; i < state.cities.length; i++) {
            var c = state.cities[i];
            var scr = toScreen(c.hdX, c.hdY);
            var dx = pt.x - scr.x;
            var dy = pt.y - scr.y;
            var d = Math.hypot(dx * scaleX, dy * scaleY);
            var lab = toScreen(
                c.labelX != null ? c.labelX : c.hdX,
                c.labelY != null ? c.labelY : c.hdY + 44
            );
            var dl = Math.hypot((pt.x - lab.x) * scaleX, (pt.y - lab.y) * scaleY);
            if (d <= radius && d < bestD) {
                bestD = d;
                best = c.index;
            } else if ((state.mobile ? dl <= labelRadius : dl < labelRadius) && dl < bestD) {
                bestD = dl;
                best = c.index;
            }
        }
        return best;
    }

    function resetPan() {
        var retired = state.pan.on || state.pan.moved || state.pan.pointerId != null;
        var pointerId = state.pan.pointerId;
        state.pan.on = false;
        state.pan.moved = false;
        state.pan.pointerId = null;
        state.pan.ticket = null;
        state.pan.geometry = null;
        state.pan.suppressClick = retired || state.pan.suppressClick;
        state.pan.tapHandled = false;
        if (state.canvas) {
            state.canvas.classList.remove('hd-panning');
            if (pointerId != null && typeof state.canvas.releasePointerCapture === 'function') {
                try { state.canvas.releasePointerCapture(pointerId); } catch (e) {}
            }
        }
    }

    function fightLive() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.fight === 'function') {
                var f = baye.hd.fight();
                if (f && f.active && !f.over) {
                    return true;
                }
            }
            if (window.baye && baye.data && Number(baye.data.g_hdFightActive) &&
                !Number(baye.data.g_hdFightOver)) {
                return true;
            }
        } catch (e) {}
        return !!(global.BayeHdBattle && typeof BayeHdBattle.isOpen === 'function' &&
            BayeHdBattle.isOpen() && !global.BayeHdBattle.debugSnapshot().preview);
    }

    function cityMenuHoldExit() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.holdExit === 'function' &&
            BayeHdCityMenu.holdExit());
    }

    function cityMenuHoldMenu() {
        /* 只认活出征 hold。部队已出发(pick=0) 的 isMarchReady 不得再挡关菜单/内政。 */
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.holdMenu === 'function' &&
            BayeHdCityMenu.holdMenu());
    }

    function engineGetCitySetPending() {
        try {
            return !!(global.BayeHdCityMenu &&
                typeof BayeHdCityMenu.engineInGetCitySet === 'function' &&
                BayeHdCityMenu.engineInGetCitySet());
        } catch (e) {
            return false;
        }
    }

    function clearAlignFailHint() {
        if (state.hint && /未能对齐|已留在 HD|对齐未完成/.test(state.hint)) {
            state.hint = '点己方城打开菜单；出征时点邻城作为目标。';
            applyChrome();
        }
    }

    function engineSendKey(code) {
        if (document.hidden) { cancelAlign(); return false; }
        if (!mapInputAuthorized()) { cancelAlign(); return false; }
        var exitCode = (window.baye && baye.VK_EXIT) || VK.EXIT;
        if (fightLive()) {
            console.warn('[hd-overworld] blocked key during fight', code);
            return false;
        }
        if (code === exitCode && (cityMenuHoldExit() || cityMenuHoldMenu() || cityMenuMarching() || battleMakePending())) {
            console.warn('[hd-overworld] blocked EXIT during BattleMake');
            return false;
        }
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
        if (!mapInputAuthorized()) { return false; }
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
            if (/^g_hd/.test(name) || name === 'g_hdMenuIndex') {
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
        /* 不要回退到 viewport x/y：那是 LCD 窗口原点，不是光标。
         * 西凉视口常是 (0,0)，光标是 (1,0)；混用会把天水走到河内。 */
        if (x === null || y === null) {
            return null;
        }
        return { x: x, y: y };
    }

    function readMapPick() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.march === 'function') {
                var m = baye.hd.march();
                if (m && m.pick != null) {
                    return Number(m.pick) || 0;
                }
            }
        } catch (e) {}
        var data = engineData();
        var v = data ? readNumber(data, 'g_hdMapPick') : null;
        return v == null ? 0 : v;
    }

    function readMapCity() {
        var data = engineData();
        var v = data ? readNumber(data, 'g_hdMapCity') : null;
        if (v == null || v <= 0) {
            return -1;
        }
        var idx = v - 1;
        var max = cityCount();
        if (idx < 0 || idx >= 0xfffe || (max > 0 && idx >= max)) {
            return -1;
        }
        return idx;
    }

    function cursorInView() {
        var data = engineData();
        var pos = data && data.g_CityPos;
        if (!pos) {
            return true;
        }
        var vx = readNumber(pos, 'x');
        var vy = readNumber(pos, 'y');
        var cx = readNumber(pos, 'setx');
        var cy = readNumber(pos, 'sety');
        if (cx === null || cy === null || vx === null || vy === null) {
            return true;
        }
        var lcdW = typeof lcdWidth === 'number' ? lcdWidth : 160;
        var lcdH = typeof lcdHeight === 'number' ? lcdHeight : 96;
        var ws = Math.floor((lcdW + 1) / 16) - 2;
        var hs = Math.floor(lcdH / 16);
        if (ws < 1) {
            ws = 1;
        }
        if (hs < 1) {
            hs = 1;
        }
        return cx >= vx && cx <= vx + ws - 1 && cy >= vy && cy <= vy + hs - 1;
    }

    function posEquals(a, b) {
        return !!(a && b && a.x === b.x && a.y === b.y);
    }

    function looksLikeCityRootMenu() {
        try {
            if (!window.baye || !baye.hd || typeof baye.hd.menuItems !== 'function') {
                return false;
            }
            var m = baye.hd.menuItems();
            if (!m || !m.names || !m.names.length) {
                return false;
            }
            var names = m.names.join(' ');
            return names.indexOf('内政') >= 0 && names.indexOf('军备') >= 0;
        } catch (e) {
            return false;
        }
    }

    function functionMenuShowing() {
        try {
            if (!window.baye || !baye.hd || typeof baye.hd.menuItems !== 'function') {
                return false;
            }
            var m = baye.hd.menuItems();
            if (!m || !m.names || !m.names.length) {
                return false;
            }
            var names = m.names.join(' ');
            return names.indexOf('策略结束') >= 0 && names.indexOf('存储进度') >= 0;
        } catch (e) {
            return false;
        }
    }

    function cityMenuShellOpen() {
        return state.phase === 'classic-menu' || state.hdOpenedMenu ||
            !!(global.BayeHdCityMenu && typeof BayeHdCityMenu.isOpen === 'function' &&
                BayeHdCityMenu.isOpen());
    }

    function inGameOverworld() {
        return playerKingId() !== null && citiesHaveBelong(engineData());
    }

    function ensureOnMap(token, tried, then) {
        if (fightLive()) {
            tried.push('fight-skip-ensure');
            then();
            return;
        }
        if (readMapPick() === 1) {
            then();
            return;
        }
        if (cityMenuHoldExit() || cityMenuHoldMenu() || cityMenuMarching() || battleMakePending()) {
            tried.push('hold-exit-skip-ensure');
            then();
            return;
        }
        var n = 0;
        var dismissedFunc = 0;
        function kick() {
            if (token !== state.alignToken) {
                return;
            }
            if (readMapPick() === 1) {
                setPhase('map');
                then();
                return;
            }
            if (cityMenuHoldExit() || cityMenuHoldMenu() || cityMenuMarching() || battleMakePending()) {
                tried.push('hold-exit-skip-ensure');
                then();
                return;
            }
            if (functionMenuShowing() && dismissedFunc < 1) {
                dismissedFunc += 1;
                n += 1;
                tried.push('exit-function-menu');
                engineSendKey((window.baye && baye.VK_EXIT) || VK.EXIT);
                later(token, 200, kick);
                return;
            }
            if (functionMenuShowing()) {
                tried.push('function-menu-stuck');
                then();
                return;
            }
            if (inGameOverworld() && state.phase === 'map' && !state.hdOpenedMenu) {
                tried.push('already-on-map');
                then();
                return;
            }
            if (n >= 6) {
                tried.push('not-on-map');
                then();
                return;
            }
            n += 1;
            tried.push('exit-to-map:' + n);
            engineSendKey((window.baye && baye.VK_EXIT) || VK.EXIT);
            later(token, 180, kick);
        }
        kick();
    }

    function landedOnTarget(index, expectTile) {
        var city = validCityIndex(index) ? state.cities[index] : null;
        var tile = expectTile || (city ? { x: city.engX, y: city.engY } : null);
        var pos = readCityPos();
        if (pos && tile && pos.x === tile.x && pos.y === tile.y) {
            return true;
        }
        return readMapCity() === index;
    }

    function cityAtTile(x, y) {
        for (var i = 0; i < state.cities.length; i++) {
            if (state.cities[i].engX === x && state.cities[i].engY === y) {
                return state.cities[i].index;
            }
        }
        return -1;
    }

    function mapShowSize() {
        var lcdW = typeof lcdWidth === 'number' ? lcdWidth : 160;
        var lcdH = typeof lcdHeight === 'number' ? lcdHeight : 96;
        var ws = Math.floor((lcdW + 1) / 16) - 2;
        var hs = Math.floor(lcdH / 16);
        if (ws < 1) {
            ws = 1;
        }
        if (hs < 1) {
            hs = 1;
        }
        var cfg = null;
        try {
            cfg = window.baye && baye.data && baye.data.g_engineConfig;
        } catch (e) {}
        return {
            ws: ws,
            hs: hs,
            mapW: Number(cfg && cfg.cityMapWidth) || 40,
            mapH: Number(cfg && cfg.cityMapHeight) || 40
        };
    }

    function centerCityViewport(setx, sety, tried) {
        var data = engineData();
        var pos = data && data.g_CityPos;
        if (!pos) {
            return false;
        }
        var sz = mapShowSize();
        var vx;
        var vy;
        if ((setx + Math.floor(sz.ws / 2)) >= sz.mapW) {
            vx = sz.mapW > sz.ws ? sz.mapW - sz.ws : 0;
        } else if (setx < Math.floor(sz.ws / 2)) {
            vx = 0;
        } else {
            vx = setx - Math.floor(sz.ws / 2);
        }
        if ((sety + Math.floor(sz.hs / 2)) >= sz.mapH) {
            vy = sz.mapH > sz.hs ? sz.mapH - sz.hs : 0;
        } else if (sety < Math.floor(sz.hs / 2)) {
            vy = 0;
        } else {
            vy = sety - Math.floor(sz.hs / 2);
        }
        if (pos.x !== undefined) {
            writeNumber(pos, 'x', vx);
            tried.push('view:g_CityPos.x=' + vx);
        }
        if (pos.y !== undefined) {
            writeNumber(pos, 'y', vy);
            tried.push('view:g_CityPos.y=' + vy);
        }
        return true;
    }

    /* 只写光标 setx/sety，视口 x/y 居中。不能把 x/y 写成城格，那是窗口原点。 */
    function writeCityPos(x, y, tried) {
        if (!mapInputAuthorized()) { return false; }
        var data = engineData();
        var pos = data && data.g_CityPos;
        if (!pos) {
            return false;
        }
        tried = tried || [];
        if (pos.setx !== undefined) {
            tried.push('write:g_CityPos.setx=' + x);
            writeNumber(pos, 'setx', x);
        }
        if (pos.sety !== undefined) {
            tried.push('write:g_CityPos.sety=' + y);
            writeNumber(pos, 'sety', y);
        }
        centerCityViewport(x, y, tried);
        var now = readCityPos();
        return !!(now && now.x === x && now.y === y);
    }

    function snapCursorToCity(index, tried) {
        var city = validCityIndex(index) ? state.cities[index] : null;
        if (!city) {
            return false;
        }
        tried = tried || [];
        var ok = writeCityPos(city.engX, city.engY, tried);
        if (ok) {
            state.engineCursorIndex = index;
            state.haveCityPos = true;
        }
        return ok && landedOnTarget(index, { x: city.engX, y: city.engY });
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
        // LCC connectors are decorative and never drive native navigation.
        var edges = mapAuthorized() ? state.engineTileEdges : [];
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
        if (state.learnedCursorField && /^g_hd/.test(state.learnedCursorField)) {
            state.learnedCursorField = null;
        }
        for (var i = 0; i < names.length; i++) {
            if (!names[i] || /^g_hd/.test(names[i]) || data[names[i]] === undefined) {
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
        state.alignSnapRetry = false;
        state.pendingEnter = false;
    }

    function afterFightMapReady(why) {
        cancelAlign();
        state.hdOpenedMenu = false;
        state.sawFightHook = false;
        var current = inferCurrentCity();
        if (validCityIndex(current)) {
            state.engineCursorIndex = current;
            state.selectedIndex = current;
        }
        if (state.hint && /未能对齐/.test(state.hint)) {
            state.hint = '已回到大地图。点己方城打开城池菜单。';
        } else if (!cityMenuShellOpen()) {
            state.hint = '已回到大地图。点己方城打开城池菜单。';
        }
        setPhase(inferPhase());
        applyChrome();
        console.log('[hd-overworld] after-fight-map', why || '');
    }

    function later(token, ms, fn) {
        state.alignTimer = setTimeout(function () {
            if (token !== state.alignToken || !mapAuthorized()) {
                return;
            }
            fn();
        }, ms);
    }

    function leaveClassicMenu(hint, opts) {
        opts = opts || {};
        if (fightLive()) {
            console.warn('[hd-overworld] blocked leaveMenu EXIT during fight');
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.close === 'function') {
                BayeHdCityMenu.close({ silent: true, force: true });
            }
            return;
        }
        if (cityMenuHoldExit() || cityMenuHoldMenu() || cityMenuMarching() || battleMakePending()) {
            console.warn('[hd-overworld] blocked leaveMenu EXIT during BattleMake');
            if (cityMenuMarching() || cityMenuHoldMenu() || cityMenuHoldExit()) {
                state.hint = hint || '出征进行中，不能关菜单。';
            }
            applyChrome();
            return;
        }
        /* GetCitySet EXIT leaves PlayerTactic and opens 策略结束. Only leave
           an actual city OrderMenu; leftover closeMenu on the map must no-op. */
        var sendExit = !opts.nativeClosing && cityMenuShellOpen();
        state.menuDepth = 0;
        state.hdOpenedMenu = false;
        if (!opts.keepAlign) {
            cancelAlign();
            state.suppressCityIdle = 1;
        }
        resetPan();
        if (global.BayeHdCityMenu) {
            BayeHdCityMenu.close({ silent: true });
        }
        if (sendExit) { engineSendKey((window.baye && baye.VK_EXIT) || VK.EXIT); }
        setPhase(inferPhase());
        state.hint = hint || '已回到大地图。';
    }

    function confirmClassicMenu(hint) {
        if (fightLive()) {
            state.hdOpenedMenu = false;
            console.warn('[hd-overworld] skip city open during fight');
            return;
        }
        var menu = window.baye && baye.hd && baye.hd.menuItems ? baye.hd.menuItems() : null;
        var actual = readMapCity();
        if (!menu || !Number(menu.active) || Number(menu.context) !== 1 ||
            Number(menu.kind) !== 1 || !validCityIndex(actual) || readMapPick()) {
            return false;
        }
        if (state.aligning && (!state.pendingEnter || actual !== state.entryCityIndex)) {
            return false;
        }
        state.pendingEnter = false;
        state.aligning = false;
        state.hdOpenedMenu = true;
        state.suppressCityIdle = 0;
        resetPan();
        state.menuDepth = Math.max(1, state.menuDepth);
        setPhase('classic-menu');
        var idx = actual;
        state.selectedIndex = actual;
        state.engineCursorIndex = actual;
        var hdMenu = global.BayeHdCityMenu && BayeHdCityMenu.shouldShowHd();
        if (hdMenu) {
            var name = '';
            if (validCityIndex(idx) && state.cities[idx] && state.cities[idx].name) {
                name = state.cities[idx].name;
            } else if (validCityIndex(idx)) {
                name = cityName(idx);
            }
            BayeHdCityMenu.open({
                cityIndex: idx,
                cityName: name,
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

    function dumpAlignWhy(tag, from, to, extra) {
        var city = validCityIndex(to) ? state.cities[to] : null;
        var data = engineData();
        var gpos = data && data.g_CityPos;
        var why = {
            tag: tag,
            extra: extra || '',
            from: from,
            to: to,
            toName: city ? city.name : '',
            toKind: city ? city.kind : '',
            toTile: city ? { x: city.engX, y: city.engY } : null,
            setxy: readCityPos(),
            view: gpos ? { x: readNumber(gpos, 'x'), y: readNumber(gpos, 'y') } : null,
            mapCity: readMapCity(),
            mapPick: readMapPick(),
            infer: inferCurrentCity(),
            selected: state.selectedIndex,
            inView: cursorInView(),
            rootMenu: looksLikeCityRootMenu(),
            phase: state.phase,
            aligning: state.aligning,
            pendingEnter: state.pendingEnter,
            holdMenu: cityMenuHoldMenu(),
            marching: cityMenuMarching(),
            getCitySet: engineGetCitySetPending(),
            hint: state.hint
        };
        state.lastAlignWhy = why;
        console.warn('[hd-overworld] align-why', why);
        return why;
    }

    function finishAlignFail(token, tried, from, to, method, extra) {
        if (token !== state.alignToken) {
            return;
        }
        dumpAlignWhy(method || 'fail', from, to, extra);
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
            learned: state.learnedCursorField,
            why: state.lastAlignWhy
        };
        logAlign(from, to, method, false, extra || '');
        if (looksLikeCityRootMenu()) {
            tried.push('root-menu-on-fail');
            confirmClassicMenu('HD 城池菜单。点内政/外交/军备/状况；返回回大地图。');
            return;
        }
        /* 最后再写一次 setx/sety。失败也不卡住 aligning，下次点击可重试。 */
        if (validCityIndex(to) && snapCursorToCity(to, tried) && !(state.alignSnapRetry)) {
            state.alignSnapRetry = true;
            state.aligning = true;
            later(token, 80, function () {
                sendEnterWaitMenu(token, tried, true, {
                    from: from,
                    to: to,
                    method: 'setxy-fail-retry'
                });
            });
            return;
        }
        state.alignSnapRetry = false;
        /* 己方城：格坐标已对上则再发一次城编号 ENTER，不要留下「已留在 HD」软锁。 */
        if (validCityIndex(to) && state.cities[to] && state.cities[to].kind === 'owned' &&
            (landedOnTarget(to) || snapCursorToCity(to, tried))) {
            tried.push('owned-city-id-enter');
            logAlign(from, to, method, true, 'city-id-bypass ' + (extra || ''));
            state.pendingEnter = true;
            engineSendKey((window.baye && baye.VK_ENTER) || VK.ENTER);
            later(token, 220, function () {
                confirmClassicMenu('已按城编号打开菜单。');
            });
            return;
        }
        state.hint = '对齐未完成，可再点一次目标城。';
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
        var onTile = landedOnTarget(to);
        var expectTile = validCityIndex(to) && state.cities[to]
            ? { x: state.cities[to].engX, y: state.cities[to].engY }
            : null;
        if (validCityIndex(to) && !onTile && !meta.skipCursorCheck) {
            finishAlignFail(token, tried, from, to, method, 'cursor=' + cursor +
                ' tile=' + (readCityPos() ? readCityPos().x + ',' + readCityPos().y : '?') +
                ' before ENTER');
            return;
        }
        if (!cursorInView()) {
            tried.push('cursor-out-of-view');
        }
        var pickBefore = readMapPick();
        state.pendingEnter = true;
        if (validCityIndex(to) && onTile) {
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
            mapCity: readMapCity(),
            mapPick: pickBefore,
            inView: cursorInView(),
            learned: state.learnedCursorField
        };
        logAlign(from, to, method, true, 'enter tile=' +
            (expectTile ? expectTile.x + ',' + expectTile.y : '?') +
            ' mapCity=' + readMapCity());
        console.log('[hd-overworld] input P1', state.alignLog);
        dumpAlignWhy('enter-sent', from, to, method);
        state.hint = '已发送确认，等待经典菜单…';
        function menuOpened() {
            return state.phase === 'classic-menu' || state.hdOpenedMenu;
        }
        var pollStart = Date.now();
        var enterRetries = 0;
        function checkMenu() {
            if (token !== state.alignToken) {
                return;
            }
            if (menuOpened()) {
                state.alignSnapRetry = false;
                return;
            }
            if (looksLikeCityRootMenu()) {
                tried.push('root-menu-poll');
                confirmClassicMenu('HD 城池菜单。点内政/外交/军备/状况；返回回大地图。');
                return;
            }
            var pickNow = readMapPick();
            /* GetCitySet 成功返回后 g_hdMapPick 从 1→0，随后才是 OrderMenu / onMenuIdle。
             * leftover pick=0 时没有 1→0，要靠根菜单或更长轮询。 */
            if (pickBefore === 1 && pickNow === 0) {
                confirmClassicMenu('HD 城池菜单。点内政/外交/军备/状况；返回回大地图。');
                return;
            }
            var elapsed = Date.now() - pollStart;
            if (elapsed < 2200) {
                if (elapsed > 700 && enterRetries < 1 && pickNow === 1 && landedOnTarget(to, expectTile)) {
                    var retryCity = validCityIndex(to) ? state.cities[to] : null;
                    /* 出征刚确认后 PlayerTactic 立刻再 GetCitySet；对敌城再 ENTER 就是「敌方城池」。 */
                    if (retryCity && retryCity.kind !== 'owned') {
                        tried.push('skip-retry-enemy');
                        state.pendingEnter = false;
                        state.aligning = false;
                        state.hint = '未对他方城再回车（避免 PlayerTactic「敌方城池」）。';
                        applyChrome();
                        return;
                    }
                    enterRetries += 1;
                    tried.push('retry-enter');
                    engineSendKey(enter);
                }
                later(token, 180, checkMenu);
                return;
            }
            dumpAlignWhy('menu-timeout', from, to, 'pick=' + pickNow + ' elapsed=' + elapsed);
            finishAlignFail(token, tried, from, to, method, 'menu-timeout pick=' + pickNow +
                ' mapCity=' + readMapCity() + ' tile=' +
                (readCityPos() ? readCityPos().x + ',' + readCityPos().y : '?') +
                ' elapsed=' + elapsed);
        }
        later(token, 180, checkMenu);
    }

    function sendEnterAndOpenMenu(token, tried, wrote) {
        sendEnterWaitMenu(token, tried, wrote, { method: 'enter-fallback', skipCursorCheck: true });
    }

    function waitUntil(token, pred, ms, stepMs, then) {
        var start = Date.now();
        function tick() {
            if (token !== state.alignToken) {
                return;
            }
            if (pred()) {
                then(true);
                return;
            }
            if (Date.now() - start >= ms) {
                then(false);
                return;
            }
            later(token, stepMs || 40, tick);
        }
        later(token, stepMs || 40, tick);
    }

    function walkKeysThenEnter(token, tried, from, to, keys, method, expectTile) {
        var step = 0;
        function afterLand() {
            if (token !== state.alignToken) {
                return;
            }
            var landed = inferCurrentCity();
            var tileOk = landedOnTarget(to, expectTile);
            if (tileOk) {
                if (landed === to) {
                    state.engineCursorIndex = to;
                }
                later(token, 90, function () {
                    sendEnterWaitMenu(token, tried, false, {
                        from: from,
                        to: to,
                        method: method,
                        skipCursorCheck: false
                    });
                });
                return;
            }
            if (snapCursorToCity(to, tried) && landedOnTarget(to, expectTile)) {
                tried.push('snap-after-walk');
                later(token, 70, function () {
                    sendEnterWaitMenu(token, tried, true, {
                        from: from,
                        to: to,
                        method: 'setxy-after-walk',
                        skipCursorCheck: false
                    });
                });
                return;
            }
            finishAlignFail(token, tried, from, to, method, 'landed=' + landed +
                ' tile=' + (readCityPos() ? readCityPos().x + ',' + readCityPos().y : '?') +
                ' mapCity=' + readMapCity());
        }
        function sendNext() {
            if (token !== state.alignToken) {
                return;
            }
            if (step >= keys.length) {
                waitUntil(token, function () {
                    return landedOnTarget(to, expectTile);
                }, 480, 40, function () {
                    afterLand();
                });
                return;
            }
            var beforePos = readCityPos();
            var before = snapshotIndexFields();
            var dir = keys[step];
            engineSendKey(dirCode(dir));
            step += 1;
            function afterMove(moved) {
                learnCursorField(before, snapshotIndexFields());
                if (!moved) {
                    tried.push('stuck:' + dir);
                }
                var now = inferCurrentCity();
                if (validCityIndex(now)) {
                    state.engineCursorIndex = now;
                }
                sendNext();
            }
            waitUntil(token, function () {
                var nowPos = readCityPos();
                return !!(beforePos && nowPos && !posEquals(beforePos, nowPos));
            }, 360, 40, function (moved) {
                if (moved) {
                    afterMove(true);
                    return;
                }
                /* 再发一次同向键。不要 EXIT：GetCitySet 收到 EXIT 会离开大地图。 */
                tried.push('retry:' + dir);
                engineSendKey(dirCode(dir));
                waitUntil(token, function () {
                    var nowPos = readCityPos();
                    return !!(beforePos && nowPos && !posEquals(beforePos, nowPos));
                }, 280, 40, afterMove);
            });
        }
        sendNext();
    }

    function alignAndEnter(index) {
        var city = state.cities[index];
        var token = state.alignToken;
        var exits = {};
        var mapSeq = null;
        var pendingMove = null;
        var entered = false;
        var checks = 0;
        var from = readMapCity();
        function valid() {
            return !document.hidden && mapAuthorized() && token === state.alignToken && state.mode === 'hd-map' &&
                state.aligning && !fightLive() && !miniMapActive();
        }
        function fail(message) {
            if (token !== state.alignToken) { return; }
            state.pendingEnter = false;
            state.aligning = false;
            state.hdOpenedMenu = false;
            state.alignLog = { ok: false, method: 'native-city-entry', from: from,
                to: index, reason: message, cityPos: readCityPos(), mapCity: readMapCity() };
            state.hint = message;
            applyChrome();
        }
        function tick() {
            if (!valid()) { return; }
            if (!city || ++checks > 300) {
                fail('引擎尚未确认入城，请检查经典界面后重新选择。');
                return;
            }
            var menu = baye.hd.menuItems();
            var march = baye.hd.march();
            if (entered) {
                if (Number(menu.active) && Number(menu.context) === 1 && Number(menu.kind) === 1) {
                    if (readMapCity() !== index) {
                        fail('引擎打开的城池与目标不同，未开放城池指令。');
                        return;
                    }
                    state.alignLog = { ok: true, method: 'native-city-entry', from: from,
                        to: index, mapInputSeq: mapSeq, cityPos: readCityPos(), mapCity: readMapCity() };
                    confirmClassicMenu('已进入「' + city.name + '」。');
                    return;
                }
            } else if (Number(march.pick) && !Number(march.battlePick) && !Number(menu.active)) {
                if (mapSeq == null) { mapSeq = Number(march.mapInputSeq); }
                if (!mapSeq || Number(march.mapInputSeq) !== mapSeq) {
                    fail('地图输入已改变，请重新选择目标城。');
                    return;
                }
                var pos = readCityPos();
                if (!pos) { fail('无法读取引擎地图光标。'); return; }
                if (pendingMove) {
                    if (!posEquals(pos, pendingMove)) { pendingMove = null; }
                    else { later(token, 40, tick); return; }
                }
                var onTile = pos.x === city.engX && pos.y === city.engY;
                if (onTile && readMapCity() === index) {
                    entered = true;
                    state.pendingEnter = true;
                    state.entryCityIndex = index;
                    state.entryMapInputSeq = mapSeq;
                    engineSendKey((window.baye && baye.VK_ENTER) || VK.ENTER);
                } else {
                    var dir;
                    if (pos.y !== city.engY) { dir = pos.y > city.engY ? 'U' : 'D'; }
                    else if (pos.x !== city.engX) { dir = pos.x > city.engX ? 'L' : 'R'; }
                    else { dir = city.engX > 0 ? 'L' : 'R'; }
                    pendingMove = { x: pos.x, y: pos.y };
                    engineSendKey(dirCode(dir));
                }
            } else if (Number(menu.active) && [1, 2].indexOf(Number(menu.context)) >= 0) {
                if (mapSeq != null) {
                    fail('地图输入已关闭，请重新选择目标城。');
                    return;
                }
                var menuKey = String(menu.context) + ':' + String(menu.seq);
                if (!exits[menuKey]) {
                    exits[menuKey] = true;
                    engineSendKey((window.baye && baye.VK_EXIT) || VK.EXIT);
                }
            }
            later(token, 40, tick);
        }
        tick();
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
        if (snapCursorToCity(index, tried)) {
            tried.push('setxy-no-path');
            later(token, 70, function () {
                sendEnterWaitMenu(token, tried, true, {
                    from: from,
                    to: index,
                    method: 'setxy-no-path'
                });
            });
            return;
        }
        finishAlignFail(token, tried, from, index, 'none', 'no-path');
    }

    function cityMenuMarching() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.isMarching === 'function' &&
            BayeHdCityMenu.isMarching());
    }

    function marchTapCity(index) {
        if (!mapInputAuthorized()) { return false; }
        clearAlignFailHint();
        var now = Date.now();
        if (state.lastMarchTapAt && (now - state.lastMarchTapAt) < 350 &&
            state.lastMarchTapIndex === index) {
            return { skipped: 'tap-debounce', cityIndex: index };
        }
        state.lastMarchTapAt = now;
        state.lastMarchTapIndex = index;
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.selectMarchTarget === 'function') {
            return BayeHdCityMenu.selectMarchTarget(index);
        }
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.walkToCity === 'function') {
            return BayeHdCityMenu.walkToCity(index, true);
        }
        return null;
    }

    function battleMakePending() {
        if (cityMenuMarching()) {
            return true;
        }
        if (engineGetCitySetPending()) {
            return true;
        }
        try {
            if (window.baye && baye.hd && typeof baye.hd.qty === 'function') {
                var q = baye.hd.qty();
                if (q && q.active) {
                    return true;
                }
            }
            /* g_hdMapPick is shared: PlayerTactic stays pick=1 on the overworld.
               That is NOT 出征. Only the HD wizard (isMarching / 选择目标) may
               steal clicks as target walks. Treating leftover pick as BattleMake
               made 西凉/安定/天水 taps walk the cursor and never open the menu. */
            if (window.baye && baye.hd && typeof baye.hd.reportText === 'function') {
                var r = baye.hd.reportText() || '';
                if (/选择目标/.test(r) && (cityMenuMarching() || engineGetCitySetPending())) {
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function openClassicCity(index) {
        if (!mapInputAuthorized()) { return false; }
        if (fightLive()) {
            console.warn('[hd-overworld] blocked openCity during fight');
            return;
        }
        clearAlignFailHint();
        state.selectedIndex = index;
        state.suppressCityIdle = 0;
        /* holdMenu 在 BattleMake/GetCitySet 时为真。必须先交给 marchTapCity，
         * 否则点河内会被吞掉，残留「已留在 HD」看起来像二次对齐失败。 */
        if (cityMenuMarching() || battleMakePending() || engineGetCitySetPending()) {
            marchTapCity(index);
            return;
        }
        if (cityMenuHoldMenu()) {
            return;
        }
        if (!inGameOverworld()) {
            state.hint = '进入大地图后才可选择城池。';
            return;
        }
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.close === 'function') {
            BayeHdCityMenu.close({ silent: true, force: true });
        }
        state.hdOpenedMenu = false;
        state.suppressCityIdle = 1;
        setPhase('map');
        if (state.aligning) {
            cancelAlign();
        }
        cancelAlign();
        var city = state.cities[index];
        state.selectedIndex = index;
        if (city && city.kind !== 'owned') {
            state.hint = (city.name || '该城') + ' 不是己方城。PlayerTactic 回车会报「敌方城池」；出征请从己方城菜单选目标。';
            applyChrome();
            return;
        }
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
        var pressed = Object.create(null), blocked = false;
        var ownerFields = ['g_hdDetailGeneration', 'g_hdMapInputSeq', 'g_hdMapPick', 'g_hdBattlePick',
            'g_hdMapCity', 'g_hdMarchPhase', 'g_hdMarchSession', 'g_hdMarchInputSeq',
            'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq',
            'g_hdReportActive', 'g_hdHelpActive', 'g_hdQtyActive', 'g_hdFightActive'];
        function readOwner() {
            if (document.hidden || state.aligning || state.mode !== 'hd-map' || battleCoversMapCanvas() ||
                !mapInputAuthorized()) { return null; }
            var data = engineData();
            if (!data) { return null; }
            var values = ownerFields.map(function (name) { return data[name]; });
            if (!values.every(function (n) {
                return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= 4294967295;
            }) || !values[0] || !values[1] || values[12] || values[13] || values[14] || values[15]) { return null; }
            // DEPARTED (7) is the retained successful march result, not an input owner.
            var idleMarch = values[5] === 0 || values[5] === 7;
            var map = values[2] === 1 && values[3] === 0 && idleMarch && values[8] === 0;
            var target = values[2] === 1 && values[3] === 1 && values[5] === 4 && values[8] === 0;
            var cityMenu = !state.mobile && values[2] === 0 && values[3] === 0 && idleMarch &&
                values[8] === 1 && values[9] === 1 && values[10] === 1 && state.phase === 'classic-menu';
            if (!map && !target && !cityMenu) { return null; }
            var identity = readIdentity();
            if (!libraryAllowed(identity) || !mapInputAuthorized() || engineData() !== data ||
                !ownerFields.every(function (name, i) { return data[name] === values[i]; })) { return null; }
            return JSON.stringify([identity.generation, identity.sha256, state.assetGeneration, state.phase, values]);
        }
        function geometry() {
            var rect = state.canvas.getBoundingClientRect();
            var values = rect && [rect.left, rect.top, rect.width, rect.height, DESIGN_W, DESIGN_H];
            return values && values.every(function (n) { return typeof n === 'number' && isFinite(n); }) &&
                rect.width > 0 && rect.height > 0 ? values : null;
        }
        function sameGesture(ev) {
            var current = geometry(), old = state.pan.geometry;
            if (!state.pan.on || ev.pointerId !== state.pan.pointerId || !current || !old ||
                current.some(function (n, i) { return Math.abs(n - old[i]) >= 0.5; }) ||
                !state.pan.ticket || readOwner() !== state.pan.ticket) { return false; }
            return true;
        }
        function pointIsCanvas(ev) {
            if (!eventToDesign(ev)) { return false; }
            if (typeof global.getComputedStyle === 'function') {
                var node = state.canvas;
                while (node && node.nodeType === 1) {
                    var style = global.getComputedStyle(node);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' ||
                        Number(style.opacity) === 0) { return false; }
                    node = node.parentElement;
                }
            }
            if (typeof document.elementFromPoint === 'function' &&
                document.elementFromPoint(ev.clientX, ev.clientY) !== state.canvas) { return false; }
            return true;
        }
        function retireInteraction() { cancelAlign(); resetPan(); }
        function losePage() {
            retireInteraction();
            pressed = Object.create(null);
            blocked = false;
        }
        document.addEventListener('pointerdown', function (ev) {
            pressed[ev.pointerId] = true;
            if (Object.keys(pressed).length > 1 || ev.isPrimary === false) {
                blocked = true;
                retireInteraction();
            }
        }, true);
        function releasePointer(ev) {
            delete pressed[ev.pointerId];
            if (!Object.keys(pressed).length) { blocked = false; }
        }
        document.addEventListener('pointerup', releasePointer, true);
        document.addEventListener('pointercancel', releasePointer, true);
        global.addEventListener('blur', losePage);
        global.addEventListener('resize', losePage);
        global.addEventListener('orientationchange', losePage);
        global.addEventListener('pagehide', losePage);
        document.addEventListener('visibilitychange', function () { if (document.hidden) { losePage(); } });
        function handleMapTap(ev) {
            if (state.mode !== 'hd-map' || !mapAuthorized()) {
                return false;
            }
            if (state.phase === 'classic-menu') {
                var pickPt = eventToDesign(ev);
                var pickIdx = pickPt ? hitCity(pickPt) : -1;
                var marchingMenu = cityMenuMarching() || battleMakePending() || engineGetCitySetPending();
                if (marchingMenu && pickIdx >= 0) {
                    ev.preventDefault();
                    marchTapCity(pickIdx);
                    return true;
                }
                if (marchingMenu) {
                    ev.preventDefault();
                    return true;
                }
                if (cityMenuHoldMenu()) {
                    ev.preventDefault();
                    return true;
                }
                if (pickIdx >= 0) {
                    ev.preventDefault();
                    openClassicCity(pickIdx);
                    return true;
                }
                ev.preventDefault();
                leaveClassicMenu('已回到 HD 大地图。点城打开经典菜单。');
                return true;
            }
            if (cityMenuMarching() || battleMakePending() || engineGetCitySetPending()) {
                var marchPt = eventToDesign(ev);
                var marchIdx = marchPt ? hitCity(marchPt) : -1;
                if (marchIdx >= 0) {
                    ev.preventDefault();
                    marchTapCity(marchIdx);
                }
                return true;
            }
            if (cityMenuHoldMenu()) {
                ev.preventDefault();
                return true;
            }
            var pt = eventToDesign(ev);
            if (!pt) {
                return false;
            }
            var idx = hitCity(pt);
            if (idx < 0) {
                return false;
            }
            ev.preventDefault();
            openClassicCity(idx);
            return true;
        }
        state.canvas.addEventListener('pointerdown', function (ev) {
            if (blocked || state.pan.on || ev.isPrimary === false ||
                (ev.button != null && ev.button !== 0) || !pointIsCanvas(ev)) { return; }
            var ticket = readOwner(), shape = geometry();
            if (!ticket || !shape || readOwner() !== ticket) { return; }
            state.pan.on = true;
            state.pan.pointerId = ev.pointerId;
            state.pan.ticket = ticket;
            state.pan.geometry = shape;
            state.pan.moved = false;
            state.pan.suppressClick = false;
            state.pan.tapHandled = false;
            state.pan.lastX = ev.clientX;
            state.pan.lastY = ev.clientY;
            state.pan.startX = ev.clientX;
            state.pan.startY = ev.clientY;
            try {
                state.canvas.setPointerCapture(ev.pointerId);
            } catch (e) {}
        });
        state.canvas.addEventListener('pointermove', function (ev) {
            if (state.pan.on && ev.pointerId !== state.pan.pointerId) { return; }
            if (state.pan.on && !sameGesture(ev)) { retireInteraction(); return; }
            if (!mapAuthorized()) { return; }
            var pt = eventToDesign(ev);
            if (pt) {
                state.pointer.x = pt.x;
                state.pointer.y = pt.y;
                state.pointer.on = true;
            }
            if (state.pan.on && state.mode === 'hd-map') {
                var drag = Math.hypot(ev.clientX - state.pan.startX, ev.clientY - state.pan.startY);
                if (!state.pan.moved && drag > PAN_THRESHOLD) {
                    state.pan.moved = true;
                    state.pan.suppressClick = true;
                    state.canvas.classList.add('hd-panning');
                }
                if (state.pan.moved && state.phase === 'map' && !state.aligning) {
                    var s = state.camera.scale || 1;
                    var dx = ev.clientX - state.pan.lastX;
                    var dy = ev.clientY - state.pan.lastY;
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
            if (!(state.mode === 'hd-map' && (state.phase === 'map' || state.phase === 'classic-menu'))) {
                state.hoverIndex = -1;
                return;
            }
            if (!pt) {
                return;
            }
            state.hoverIndex = hitCity(pt);
        });
        function endPan(ev) {
            if (!state.pan.on || ev.pointerId !== state.pan.pointerId) { return; }
            var wasTap = !blocked && !state.pan.moved && !state.pan.suppressClick &&
                Math.hypot(ev.clientX - state.pan.startX, ev.clientY - state.pan.startY) <= PAN_THRESHOLD &&
                ev.type === 'pointerup' && sameGesture(ev) && pointIsCanvas(ev);
            resetPan();
            clampCamera();
            if (wasTap) {
                state.pan.tapHandled = handleMapTap(ev);
            }
            // A browser may synthesize click even after a drag or cancellation.
            state.pan.suppressClick = true;
        }
        state.canvas.addEventListener('pointerup', endPan);
        state.canvas.addEventListener('pointercancel', endPan);
        state.canvas.addEventListener('lostpointercapture', function (ev) {
            if (state.pan.on && ev.pointerId === state.pan.pointerId) { retireInteraction(); }
        });
        state.canvas.addEventListener('mouseleave', function () {
            state.hoverIndex = -1;
            state.pointer.on = false;
        });
        state.canvas.addEventListener('click', function (ev) {
            // Native actions require the owned DOWN/UP pair, never a bare or
            // compatibility click. Mouse also follows Pointer Events in Chrome.
            if (state.mode === 'hd-map' && mapAuthorized()) { ev.preventDefault(); }
            state.pan.tapHandled = false;
        });
        document.addEventListener('keydown', function (e) {
            if (state.mode !== 'hd-map' || !mapAuthorized()) {
                return;
            }
            if (global.BayeHdCityMenu && BayeHdCityMenu.isOpen()) {
                return;
            }
            if (cityMenuHoldExit() || cityMenuHoldMenu() || cityMenuMarching() || battleMakePending()) {
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
        state.legendOwned = document.getElementById('hd-overworld-legend-owned');
        state.legendNeutral = document.getElementById('hd-overworld-legend-neutral');
        state.legendEmpty = document.getElementById('hd-overworld-legend-empty');
        state.legendSignature = '';
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
        if (state.mobile) { state.mobileMode = mode; }
        if (mode !== state.mode) { retireMapPresentation(); }
        writeStorage(state.mobile ? MOBILE_STORAGE_KEY : STORAGE_KEY, mode);
        state.mode = mode;
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.syncMode === 'function') {
            BayeHdCityMenu.syncMode();
        }
        if (global.BayeHdBattle && typeof BayeHdBattle.syncMode === 'function') {
            BayeHdBattle.syncMode();
        }
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
                ensureLoop();
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
        bindRenderVisibility();
        cacheDom();
        bindToolbar();
        bindInput();
        bindLibraryIdentity();
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

    function applyMobilePage() {
        if (!state.mobile) {
            cancelAlign(); resetPan();
            state.mobile = true;
            state.camera.inited = false;
            state.camera.lockedFull = false;
            state.mode = getMode();
        }
        applyPcPage();
        syncCanvasSize();
    }

    // Presentation only: locating the current town never moves the native cursor.
    function centerOnCity(index) {
        if (typeof index !== 'number' || Math.floor(index) !== index || !mapAuthorized() ||
            !validCityIndex(index) || !state.cities[index]) { return false; }
        syncCanvasSize();
        var city = state.cities[index];
        state.camera.x = city.hdX - DESIGN_W / (state.camera.scale || 1) / 2;
        state.camera.y = city.hdY - DESIGN_H / (state.camera.scale || 1) / 2;
        clampCamera(); draw();
        return true;
    }

    applyEarlyDocumentAttrs();

    global.addEventListener('resize', function () {
        cancelAlign(); resetPan();
        if (!document.hidden && state.mode === 'hd-map' && !battleCoversMapCanvas()) {
            syncCanvasSize();
            clampCamera();
            draw();
        }
    });

    global.BayeHdOverworld = {
        STORAGE_KEY: STORAGE_KEY,
        MOBILE_STORAGE_KEY: MOBILE_STORAGE_KEY,
        getMode: getMode,
        setMode: setMode,
        getPhase: function () { return state.phase; },
        getCities: function () { return state.cities; },
        overviewData: overviewData,
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
        cancelAlign: cancelAlign,
        cancelInteraction: function () { cancelAlign(); resetPan(); },
        centerOnCity: centerOnCity,
        afterFightMapReady: afterFightMapReady,
        snapCursorToCity: snapCursorToCity,
        writeCityPos: writeCityPos,
        getAlignLog: function () { return state.alignLog; },
        getAlignWhy: function () { return state.lastAlignWhy || null; },
        landedOnCity: landedOnTarget,
        readCityPos: readCityPos,
        readMapCity: readMapCity,
        readMapPick: readMapPick,
        walkToCity: function (index) {
            var city = state.cities[index];
            if (!city) {
                return false;
            }
            if (openClassicCity(index) === false) { return false; }
            return { to: { x: city.engX, y: city.engY }, name: city.name };
        },
        cityScreenPos: function (indexOrName) {
            var city = null;
            var i;
            for (i = 0; i < state.cities.length; i++) {
                if (state.cities[i].index === indexOrName || state.cities[i].name === indexOrName) {
                    city = state.cities[i];
                    break;
                }
            }
            if (!city || !state.canvas) {
                return null;
            }
            var scr = toScreen(city.hdX, city.hdY);
            var rect = state.canvas.getBoundingClientRect();
            return {
                index: city.index,
                name: city.name,
                kind: city.kind,
                engX: city.engX,
                engY: city.engY,
                hdX: city.hdX,
                hdY: city.hdY,
                designX: scr.x,
                designY: scr.y,
                clientX: rect.left + scr.x / DESIGN_W * rect.width,
                clientY: rect.top + scr.y / DESIGN_H * rect.height
            };
        },
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
        applyMobilePage: applyMobilePage,
        applyEarlyDocumentAttrs: applyEarlyDocumentAttrs,
        start: start,
        debugSnapshot: function () {
            var data = engineData();
            return {
                mobile: state.mobile,
                design: [DESIGN_W, DESIGN_H],
                mode: state.mode,
                libraryIdentity: readIdentity(),
                presentationReady: mapAuthorized(),
                presentationReason: state.presentationReason,
                assetGeneration: state.assetGeneration,
                phase: state.phase,
                aligning: state.aligning,
                hitsEnabled: hitsEnabled(),
                battleMakePending: battleMakePending(),
                engineGetCitySet: engineGetCitySetPending(),
                holdMenu: cityMenuHoldMenu(),
                lastAlignWhy: state.lastAlignWhy || null,
                cityMenuMarching: cityMenuMarching(),
                functionMenu: functionMenuShowing(),
                cityMenuShell: cityMenuShellOpen(),
                pan: {
                    on: state.pan.on,
                    moved: state.pan.moved,
                    suppressClick: state.pan.suppressClick,
                    tapHandled: state.pan.tapHandled
                },
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
                mapCity: readMapCity(),
                mapPick: readMapPick(),
                cursorInView: cursorInView(),
                alignLog: state.alignLog,
                alignSnapRetry: !!state.alignSnapRetry,
                hint: state.hint,
                playerKingRaw: data ? readNumber(data, 'g_PlayerKing') : null,
                playerBelong: playerKingId(),
                yearDate: data ? readNumber(data, 'g_YearDate') : null,
                monthDate: data ? readNumber(data, 'g_MonthDate') : null,
                cityX: data ? readNumber(data, 'g_CityX') : null,
                cityY: data ? readNumber(data, 'g_CityY') : null,
                focusX: data ? readNumber(data, 'g_FoucsX') : null,
                focusY: data ? readNumber(data, 'g_FoucsY') : null,
                ownedCount: state.cities.filter(function (c) { return c.kind === 'owned'; }).length,
                cityTotal: state.cities.length,
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
                environmentLayers: {
                    coordinateSystem: state.manifest && state.manifest.layers && state.manifest.layers.environment &&
                        state.manifest.layers.environment.coordinateSystem || null,
                    descriptorCount: environmentLayers().length,
                    drawn: state.environmentPaint ? state.environmentPaint.drawn : 0,
                    skipped: state.environmentPaint ? state.environmentPaint.skipped : 0,
                    operations: state.environmentPaint ? state.environmentPaint.operations.map(function (operation) {
                        return { id: operation.id, path: operation.path, source: operation.source.slice(),
                            destination: operation.destination.slice(), instanceIndex: operation.instanceIndex };
                    }) : []
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
