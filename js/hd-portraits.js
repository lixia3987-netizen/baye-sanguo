/**
 * HD 武将立绘壳。
 * 有 assets/hd-portraits/hd/... 时，在人物信息 / 战场说明头像 / 地图君主头像上显示 HD。
 * 没有 HD 文件时用 refs 里的引擎原头像；refs 也没有则留空，经典 LCD 仍画 GEN_HEADPIC。
 * 不改 WASM，不改战斗自动操作。
 */
(function (global) {
    // baye_bridge_init() replaces window.Promise with the engine's callback shim.
    // Async functions retain the native constructor even after that replacement.
    var NativePromise = (async function () { return null; })().constructor;
    var MANIFEST_URL = 'assets/hd-portraits/manifest.json';
    var REFERENCE_INDEX_URL = 'assets/hd-portraits/refs/index.json';
    var PERIOD_NAME = { 1: '董卓弄权', 2: '曹操崛起', 3: '赤壁之战', 4: '三足鼎立' };

    var state = {
        manifest: null,
        byKey: {},
        referencesByKey: {},
        referenceLib: '',
        loading: null,
        generation: 0,
        viewSeq: 0,
        tickSeq: 0,
        pendingKey: '',
        nameById: null,
        namePeriod: 0,
        nameLib: '',
        key: '',
        busy: false,
        timer: 0,
        started: false
    };

    function num(obj, name) {
        if (!obj || obj[name] == null) {
            return null;
        }
        var v = obj[name];
        if (v && typeof v === 'object' && 'value' in v) {
            v = v.value;
        }
        v = Number(v);
        return isFinite(v) ? v : null;
    }

    function validPerson(id) {
        return typeof id === 'number' && isFinite(id) && Math.floor(id) === id && id >= 0 && id < 0xfffe;
    }

    function validPeriod(period) {
        return period >= 1 && period <= 4 && Math.floor(period) === period;
    }

    function currentLib() {
        var lib = '';
        try { lib = global.localStorage.getItem('baye/libpath') || ''; } catch (e) {}
        // The standalone smoke page previews assets without selecting a game.
        if (!lib && document.body && document.body.getAttribute('data-hd-portrait-manual') === '1') {
            lib = state.manifest && state.manifest.lib || '';
        }
        return lib;
    }

    function supportsLib(lib) {
        return !!(lib && state.manifest && lib === state.manifest.lib);
    }

    function lcdSource(entry) {
        return { mode: 'lcd', url: '', entry: entry || null };
    }

    function periodNow() {
        try {
            var p = num(global.baye && baye.data, 'g_PIdx');
            if (p >= 1 && p <= 4) {
                return p;
            }
        } catch (e) {}
        return null;
    }

    function asset(rel) {
        return 'assets/hd-portraits/' + String(rel || '').replace(/^\/+/, '');
    }

    function indexManifest(manifest) {
        var map = {};
        var entries = manifest && manifest.entries ? manifest.entries : [];
        var i;
        for (i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry || entry.missing || entry.personId == null || entry.period == null) {
                continue;
            }
            map[entry.period + ':' + entry.personId] = entry;
        }
        state.byKey = map;
        state.manifest = manifest;
    }

    function indexReferences(index) {
        var map = {};
        var periods = index && index.periods || [];
        for (var i = 0; i < periods.length; i++) {
            var block = periods[i];
            if (!block || !validPeriod(block.period)) {
                continue;
            }
            var people = block.people || [];
            for (var j = 0; j < people.length; j++) {
                var person = people[j];
                if (!person || person.skipped || !person.file || !validPerson(person.id)) {
                    continue;
                }
                map[block.period + ':' + person.id] = {
                    name: person.name,
                    personId: person.id,
                    period: block.period,
                    ref: 'refs/' + person.file
                };
            }
        }
        state.referencesByKey = map;
        state.referenceLib = index && index.lib || '';
    }

    function fetchIndex(url) {
        return fetch(url, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) {
                throw new Error(url + ' ' + res.status);
            }
            return res.json();
        }).catch(function (err) {
            console.warn('[hd-portraits] index', err && err.message ? err.message : err);
            return null;
        });
    }

    function loadManifest() {
        if (state.loading) {
            return state.loading;
        }
        state.generation += 1;
        state.viewSeq += 1;
        state.tickSeq += 1;
        state.busy = false;
        state.pendingKey = '';
        state.manifest = null;
        state.byKey = {};
        state.referencesByKey = {};
        state.referenceLib = '';
        state.nameById = null;
        probeCache = Object.create(null);
        sourceCache = Object.create(null);
        paint(null, lcdSource());
        state.loading = NativePromise.all([fetchIndex(MANIFEST_URL), fetchIndex(REFERENCE_INDEX_URL)]).then(function (indexes) {
            indexManifest(indexes[0]);
            indexReferences(indexes[1]);
            state.loading = null;
            return indexes[0];
        });
        return state.loading;
    }

    function entryFor(personId, period) {
        return state.byKey[period + ':' + personId] || null;
    }

    function dedupe(list) {
        var out = [];
        var seen = {};
        var i;
        for (i = 0; i < list.length; i++) {
            if (!list[i] || seen[list[i]]) {
                continue;
            }
            seen[list[i]] = 1;
            out.push(list[i]);
        }
        return out;
    }

    var probeCache = Object.create(null);
    var sourceCache = Object.create(null);

    function probe(url) {
        if (probeCache[url]) {
            return probeCache[url];
        }
        // Cache the pending request too: concurrent callers share both hits and misses.
        var pending = new NativePromise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                resolve('ok');
            };
            img.onerror = function () {
                resolve('miss');
            };
            img.src = url;
        });
        probeCache[url] = pending;
        return pending;
    }

    function urlsFor(personId, period) {
        var entry = entryFor(personId, period);
        var reference = state.referenceLib === state.manifest.lib ?
            state.referencesByKey[period + ':' + personId] : null;
        var hd = [];
        var ref = [];
        if (entry && entry.hd) {
            hd.push(asset(entry.hd));
        }
        if (entry && entry.ref) {
            ref.push(asset(entry.ref));
        }
        if (reference && reference.ref) {
            ref.push(asset(reference.ref));
        }
        // Use exported paths, including names; guessed filenames cause unnecessary 404s.
        return { hd: dedupe(hd), ref: dedupe(ref), entry: entry || reference };
    }

    function chooseSource(personId, period) {
        var lib = currentLib();
        var generation = state.generation;
        if (!supportsLib(lib) || !validPerson(personId) || !validPeriod(period)) {
            return NativePromise.resolve(lcdSource());
        }
        var cacheKey = lib + '|' + period + ':' + personId;
        function stillCurrent(src) {
            return generation === state.generation && lib === currentLib() ? src : lcdSource();
        }
        if (sourceCache[cacheKey]) {
            return sourceCache[cacheKey].then(stillCurrent);
        }
        var urls = urlsFor(personId, period);
        var chain = NativePromise.resolve(null);
        function tryList(list, mode) {
            var j;
            for (j = 0; j < list.length; j++) {
                (function (url) {
                    chain = chain.then(function (found) {
                        if (found) {
                            return found;
                        }
                        return probe(url).then(function (status) {
                            return status === 'ok' ? { mode: mode, url: url, entry: urls.entry } : null;
                        });
                    });
                })(list[j]);
            }
        }
        tryList(urls.hd, 'hd');
        tryList(urls.ref, 'ref');
        sourceCache[cacheKey] = chain.then(function (found) {
            return found || lcdSource(urls.entry);
        });
        return sourceCache[cacheKey].then(stillCurrent);
    }

    function personName(id) {
        try {
            if (global.baye && typeof baye.getPersonName === 'function') {
                var name = String(baye.getPersonName(id) || '').trim();
                if (name) {
                    return name;
                }
            }
        } catch (e) {}
        var period = periodNow();
        var entry = period ? entryFor(id, period) : null;
        return entry && entry.name ? entry.name : '';
    }

    function ensureNameIndex(period) {
        var lib = currentLib();
        if (state.nameById && state.namePeriod === period && state.nameLib === lib) {
            return;
        }
        var map = {};
        var n = 0;
        try {
            if (global.baye && typeof baye.getPersonCount === 'function') {
                n = Number(baye.getPersonCount()) || 0;
            }
        } catch (e) {}
        if (n > 0 && n <= 2000 && global.baye && typeof baye.getPersonName === 'function') {
            var i;
            for (i = 0; i < n; i++) {
                var name = '';
                try { name = String(baye.getPersonName(i) || '').trim(); } catch (e2) {}
                if (name && map[name] == null) {
                    map[name] = i;
                }
            }
        }
        state.nameById = map;
        state.namePeriod = period;
        state.nameLib = lib;
    }

    function dialogSnap() {
        try {
            if (global.BayeHdDialog && typeof BayeHdDialog.debugSnapshot === 'function') {
                return BayeHdDialog.debugSnapshot();
            }
        } catch (e) {}
        return null;
    }

    function battleNotePerson() {
        var dlg = dialogSnap();
        if (!dlg || !dlg.open || dlg.kind !== 'help') {
            return null;
        }
        var data = global.baye && baye.data;
        if (!data || !Number(data.g_hdFightActive) || Number(data.g_hdFightOver)) {
            return null;
        }
        var x = num(data, 'g_FoucsX');
        var y = num(data, 'g_FoucsY');
        var arr = data.g_FgtParam && data.g_FgtParam.GenArray;
        var pos = data.g_GenPos;
        if (x == null || y == null || !arr || !pos) {
            return null;
        }
        var i;
        for (i = 0; i < 20; i++) {
            var gid = num(arr, i);
            if (gid == null && arr[i] != null) {
                gid = Number(arr[i]);
            }
            if (!gid || gid >= 0xfffe) {
                continue;
            }
            var p = pos[i];
            if (!p) {
                continue;
            }
            if (num(p, 'x') === x && num(p, 'y') === y) {
                return gid - 1;
            }
        }
        return null;
    }

    function reportPerson() {
        var dlg = dialogSnap();
        if (!dlg || !dlg.open || dlg.kind !== 'report') {
            return null;
        }
        var rep = null;
        try {
            rep = global.baye && baye.hd && baye.hd.report ? baye.hd.report() : null;
        } catch (e) {}
        if (!rep || Number(rep.kind) !== 2 || !validPerson(Number(rep.person))) {
            return null;
        }
        return Number(rep.person);
    }

    function menuPerson() {
        var api = global.BayeHdCityMenu;
        if (!api || typeof api.isOpen !== 'function' || !api.isOpen()) {
            return null;
        }
        var snap = null;
        try {
            snap = typeof api.debugSnapshot === 'function' ? api.debugSnapshot() : null;
        } catch (e) {}
        if (!snap || snap.layer !== 'deep' || !/^person/.test(String(snap.deepKind || ''))) {
            return null;
        }
        var idx = snap.idleIndex;
        var item = snap.deepItems && idx != null ? snap.deepItems[idx] : null;
        if (!item) {
            return null;
        }
        if (item.pind != null && validPerson(Number(item.pind))) {
            return { id: Number(item.pind), name: item.name || '' };
        }
        var period = periodNow();
        if (period && item.name) {
            ensureNameIndex(period);
            var id = state.nameById[String(item.name).trim()];
            if (validPerson(id)) {
                return { id: id, name: item.name };
            }
        }
        return null;
    }

    function mapKing() {
        if (!document.body || !document.body.classList.contains('baye-hd-overworld-map')) {
            return null;
        }
        try {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.isOpen === 'function' && BayeHdCityMenu.isOpen()) {
                return null;
            }
        } catch (e) {}
        try {
            if (global.BayeHdBattle && typeof BayeHdBattle.isOpen === 'function' && BayeHdBattle.isOpen()) {
                return null;
            }
        } catch (e2) {}
        var id = num(global.baye && baye.data, 'g_PlayerKing');
        if (!validPerson(id)) {
            return null;
        }
        return id;
    }

    function detectView() {
        if (!supportsLib(currentLib())) {
            return null;
        }
        var period = periodNow();
        if (!period) {
            return null;
        }
        var battleId = battleNotePerson();
        if (validPerson(battleId)) {
            return { context: 'battle-note', personId: battleId, period: period, name: personName(battleId) };
        }
        var reportId = reportPerson();
        if (validPerson(reportId)) {
            return { context: 'person-info', personId: reportId, period: period, name: personName(reportId) };
        }
        var menu = menuPerson();
        if (menu && validPerson(menu.id)) {
            return {
                context: 'person-info',
                personId: menu.id,
                period: period,
                name: menu.name || personName(menu.id)
            };
        }
        var king = mapKing();
        if (validPerson(king)) {
            return { context: 'map-king', personId: king, period: period, name: personName(king) };
        }
        return null;
    }

    function paint(view, src) {
        var root = document.getElementById('hd-portrait');
        var img = document.getElementById('hd-portrait-img');
        var cap = document.getElementById('hd-portrait-cap');
        if (!root) {
            return;
        }
        if (!view || !src || src.mode === 'lcd') {
            root.hidden = true;
            root.setAttribute('data-hd-portrait', 'off');
            root.setAttribute('data-context', view && view.context ? view.context : '');
            if (img) {
                img.removeAttribute('src');
            }
            if (cap) {
                cap.textContent = '';
            }
            return;
        }
        var name = view.name || (src.entry && src.entry.name) || ('将' + view.personId);
        var periodLabel = PERIOD_NAME[view.period] || ('时期' + view.period);
        var modeLabel = src.mode === 'hd' ? 'HD 立绘' : '原头像';
        root.hidden = false;
        root.setAttribute('data-hd-portrait', src.mode);
        root.setAttribute('data-context', view.context);
        root.setAttribute('data-person-id', String(view.personId));
        root.setAttribute('data-period', String(view.period));
        if (img) {
            img.alt = name + ' ' + modeLabel;
            if (img.getAttribute('src') !== src.url) {
                img.src = src.url;
            }
        }
        if (cap) {
            cap.textContent = name + ' · ' + periodLabel + ' · ' + modeLabel;
        }
    }

    function viewKey(view) {
        return view ? [currentLib(), view.context, view.personId, view.period, view.name || ''].join('|') : 'off';
    }

    function applyView(view, verifyDetectedView) {
        var seq = ++state.viewSeq;
        var lib = currentLib();
        var generation = state.generation;
        if (!view) {
            paint(null, lcdSource());
            state.key = 'off';
            return NativePromise.resolve({ mode: 'lcd', url: '' });
        }
        var requestedKey = viewKey(view);
        var root = document.getElementById('hd-portrait');
        if (root && (root.getAttribute('data-person-id') !== String(view.personId) ||
            root.getAttribute('data-period') !== String(view.period) ||
            root.getAttribute('data-context') !== view.context || !supportsLib(lib))) {
            paint(null, lcdSource());
        }
        return chooseSource(view.personId, view.period).then(function (src) {
            if (seq !== state.viewSeq || generation !== state.generation) {
                return lcdSource();
            }
            if (lib !== currentLib()) {
                src = lcdSource();
            }
            if (verifyDetectedView) {
                var currentView = null;
                try { currentView = detectView(); } catch (e) {}
                if (requestedKey !== viewKey(currentView)) {
                    src = lcdSource();
                }
            }
            var key = [src.mode, src.url, view.context, view.personId, view.period].join('|');
            state.key = key;
            paint(view, src);
            return src;
        });
    }

    function tick() {
        var view = null;
        try {
            view = detectView();
        } catch (e) {
            view = null;
        }
        var nextKey = viewKey(view);
        if (state.busy && state.pendingKey === nextKey) {
            return;
        }
        var seq = ++state.tickSeq;
        state.busy = true;
        state.pendingKey = nextKey;
        if (nextKey === 'off') {
            applyView(null);
            state.busy = false;
            return;
        }
        function settled() {
            if (seq === state.tickSeq) {
                state.busy = false;
            }
        }
        applyView(view, true).then(settled, settled);
    }

    function start() {
        if (state.started) {
            return loadManifest();
        }
        state.started = true;
        return loadManifest().then(function () {
            if (state.timer) {
                return;
            }
            tick();
            state.timer = setInterval(tick, 320);
        });
    }

    function stop() {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = 0;
        }
    }

    global.BayeHdPortraits = {
        start: start,
        stop: stop,
        loadManifest: loadManifest,
        entryFor: entryFor,
        chooseSource: chooseSource,
        detectView: detectView,
        applyView: applyView,
        debugSnapshot: function () {
            var root = document.getElementById('hd-portrait');
            return {
                mode: root ? root.getAttribute('data-hd-portrait') : null,
                context: root ? root.getAttribute('data-context') : null,
                personId: root ? root.getAttribute('data-person-id') : null,
                period: root ? root.getAttribute('data-period') : null,
                manifest: !!(state.manifest && state.manifest.entries),
                lib: currentLib(),
                supportedLib: supportsLib(currentLib()),
                referenceCount: Object.keys(state.referencesByKey).length
            };
        }
    };

    function boot() {
        if (document.body && document.body.getAttribute('data-hd-portrait-manual') === '1') {
            loadManifest();
            return;
        }
        start();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
