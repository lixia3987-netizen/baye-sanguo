/**
 * HD 城池四项菜单表现壳（M0–M3）。
 * 只发 sendKey；不改 WASM / dat.lib。规格：docs/hd-city-menu-spec.md
 */
(function (global) {
    var STORAGE_KEY = 'baye/cityMenuMode';
    var OVERWORLD_KEY = 'baye/overworldMode';
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
    var ROOTS = [
        { id: 'neizheng', name: '内政', hint: '开垦 / 招商 / 搜寻…' },
        { id: 'waijiao', name: '外交', hint: '离间 / 招揽 / 策反…' },
        { id: 'junbei', name: '军备', hint: '侦察 / 征兵 / 出征…' },
        { id: 'zhuangkuang', name: '状况', hint: '只显示引擎里读到的城数据' }
    ];
    /* 项名来自 FEATURES.md 已核验的引擎菜单，只作标签。 */
    var SUBS = {
        neizheng: ['开垦', '招商', '搜寻', '治理', '出巡', '招降', '处斩', '流放', '赏赐', '没收', '交易', '宴请', '输送', '移动'],
        waijiao: ['离间', '招揽', '策反', '反间', '劝降'],
        junbei: ['侦察', '征兵', '分配', '掠夺', '出征']
    };
    var STATUS_FIELDS = [
        ['Belong', '归属'],
        ['Satrap', '太守'],
        ['SatrapId', '太守'],
        ['Mayor', '太守'],
        ['Governor', '太守'],
        ['Farming', '农业'],
        ['Agriculture', '农业'],
        ['Commerce', '商业'],
        ['PeopleDevotion', '民忠'],
        ['Devotion', '民忠'],
        ['AvoidCalamity', '防灾'],
        ['Population', '人口'],
        ['People', '人口'],
        ['Money', '金钱'],
        ['Food', '粮食'],
        ['MothballArms', '后备兵力'],
        ['Arms', '兵力'],
        ['State', '状态']
    ];
    var STATE_LABELS = ['正常', '饥荒', '旱灾', '水灾', '暴动'];
    /* 一层之后常见深层：人物 / 城池 / 数量。项名已核验，种类是启发式。 */
    var DEEP = {
        neizheng: ['person', 'person', 'lcd', 'person', 'person', 'person', 'person', 'person', 'goods', 'person-goods', 'person', 'person', 'city', 'city'],
        waijiao: ['city', 'city', 'city', 'city', 'city'],
        junbei: ['city', 'person-qty', 'person', 'city', 'person-city']
    };

    var state = {
        mode: 'auto',
        open: false,
        layer: 'root',
        subKind: '',
        cityIndex: -1,
        cityName: '',
        idleIndex: null,
        idleKeys: [],
        lastHook: '',
        probed: false,
        sending: false,
        queue: [],
        showLcd: false,
        closingSub: false,
        bound: false,
        listKind: '',
        probedCityKeys: [],
        deepKind: '',
        deepLabel: '',
        deepStep: 0,
        deepItems: [],
        deepSig: '',
        walkToken: 0,
        pickedPersons: 0,
        dismissedObj: false,
        marchReady: false,
        campaignPick: false,
        battleMake: false,
        personExitSent: false,
        lastFuncMenuIdle: 0,
        lastExit: '',
        lastBlockedExit: '',
        marchHint: '',
        lastWalkCity: null,
        lastWalkAt: 0,
        walkBusy: false,
        acceptMarchOk: false,
        handoff: false,
        consumedMarchSeq: 0,
        sawMarchCleared: false,
        wizardStep: 'none',
        sawQtyThisMarch: false,
        reportAtMarchStart: ''
    };

    var WIZARD_ORDER = { none: 0, persons: 1, food: 2, 'target-tip': 3, 'map-pick': 4, 'march-ok': 5 };
    var WIZARD_LABEL = {
        none: '',
        persons: '1 选将',
        food: '2 选粮',
        'target-tip': '3 选择目标',
        'map-pick': '4 点目标城',
        'march-ok': '5 部队已出发'
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

    function normalizeMenuMode(value) {
        if (value === 'hd' || value === 'classic') {
            return value;
        }
        return 'auto';
    }

    function getMenuMode() {
        return normalizeMenuMode(readStorage(STORAGE_KEY, 'auto'));
    }

    function overworldIsHd() {
        if (global.BayeHdOverworld && typeof BayeHdOverworld.getMode === 'function') {
            return BayeHdOverworld.getMode() === 'hd-map';
        }
        return readStorage(OVERWORLD_KEY, 'classic') === 'hd-map';
    }

    function shouldShowHd() {
        var mode = getMenuMode();
        if (mode === 'classic') {
            return false;
        }
        if (mode === 'hd') {
            return true;
        }
        return overworldIsHd();
    }

    function applyDocAttr() {
        var show = state.open && shouldShowHd();
        document.documentElement.setAttribute('data-baye-city-menu', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-city-menu-pref', getMenuMode());
        document.documentElement.setAttribute('data-baye-city-menu-map-pick',
            (show && usesMapCursor(state.deepKind, state.deepStep)) ? '1' : '0');
        document.documentElement.setAttribute('data-baye-battle-make',
            holdExit() ? '1' : '0');
        document.documentElement.setAttribute('data-baye-march-ok',
            (state.marchReady || freshMarchOk()) ? '1' : '0');
        document.documentElement.setAttribute('data-baye-wizard-step',
            show ? (state.wizardStep || 'none') : 'none');
        if (document.body) {
            var deepEmpty = show && state.layer === 'deep' && !showingQty() &&
                !state.deepItems.length && !mapPickActive() && !state.marchReady;
            document.body.classList.toggle('baye-hd-city-menu-on', show);
            document.body.classList.toggle('baye-hd-city-menu-lcd', show && state.showLcd);
            document.body.classList.toggle('baye-hd-city-menu-deep-empty', deepEmpty);
            document.body.classList.toggle('baye-hd-city-menu-map-pick',
                show && usesMapCursor(state.deepKind, state.deepStep));
        }
    }

    function holdExit() {
        return !!(state.battleMake && !state.marchReady && !state.handoff);
    }

    function holdMenu() {
        return !!(holdExit() || (state.marchReady && !state.handoff));
    }

    function engineSendKey(code, reason) {
        if (code === VK.EXIT && holdExit() && reason !== 'finish-persons') {
            state.lastBlockedExit = reason || 'unknown';
            console.warn('[hd-city-menu] blocked EXIT', state.lastBlockedExit);
            return false;
        }
        if (code === VK.EXIT) {
            state.lastExit = reason || 'unknown';
            console.log('[hd-city-menu] EXIT', state.lastExit);
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

    function enqueueKeys(codes, gap, reason) {
        gap = gap || 55;
        var i;
        for (i = 0; i < codes.length; i++) {
            if (codes[i] === VK.EXIT && holdExit() && reason !== 'finish-persons') {
                state.lastBlockedExit = reason || 'queue';
                console.warn('[hd-city-menu] blocked queued EXIT', state.lastBlockedExit);
                continue;
            }
            if (codes[i] === VK.EXIT) {
                state.lastExit = reason || 'queue';
            }
            state.queue.push({ code: codes[i], wait: gap, reason: reason || '' });
        }
        pumpQueue();
    }

    function pumpQueue() {
        if (state.sending) {
            return;
        }
        state.sending = true;
        function next() {
            if (!state.queue.length) {
                state.sending = false;
                return;
            }
            var item = state.queue.shift();
            setTimeout(function () {
                engineSendKey(item.code, item.reason);
                setTimeout(next, item.wait || 55);
            }, 0);
        }
        next();
    }

    function keysToIndex(target) {
        var keys = [];
        var cur = state.idleIndex;
        var i;
        if (cur == null || cur < 0) {
            for (i = 0; i < 10; i++) {
                keys.push(VK.UP);
            }
            cur = 0;
        }
        var d = target - cur;
        var key = d > 0 ? VK.DOWN : VK.UP;
        for (i = 0; i < Math.abs(d); i++) {
            keys.push(key);
        }
        state.idleIndex = target;
        return keys;
    }

    function pickIndex(target, thenEnter) {
        var keys = keysToIndex(target);
        if (thenEnter) {
            keys.push(VK.ENTER);
        }
        enqueueKeys(keys, 55);
    }

    function readEngineCursor() {
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

    function cityEngineTile(cityIndex) {
        if (global.BayeHdOverworld && typeof BayeHdOverworld.getCities === 'function') {
            var cities = BayeHdOverworld.getCities();
            var i;
            for (i = 0; i < cities.length; i++) {
                if (cities[i].index === cityIndex) {
                    return { x: cities[i].engX, y: cities[i].engY, name: cities[i].name };
                }
            }
        }
        return null;
    }

    function walkCursorToCity(cityIndex, thenEnter) {
        if (state.marchReady) {
            return { skipped: 'already-ok' };
        }
        if (showingQty()) {
            state.marchHint = '先确认粮草，再点目标城。';
            render();
            return { skipped: 'qty' };
        }
        if (state.wizardStep === 'food' && state.personExitSent && liveChooseTarget()) {
            advanceWizard('target-tip', 'walk-food-done');
        }
        if (state.wizardStep === 'persons') {
            state.marchHint = '先点至少一名将领，再点「完成选将 · 选粮出发」，不要直接点目标城。';
            render();
            return { skipped: 'wizard-persons', cityIndex: cityIndex, hint: state.marchHint };
        }
        if (mapPickActive() && !(state.sawQtyThisMarch || state.dismissedObj ||
            state.wizardStep === 'map-pick' || liveChooseTarget())) {
            state.marchHint = '还在选将/选粮。过图 leftover pick 不是出征目标。';
            render();
            return { skipped: 'overworld-pick', cityIndex: cityIndex };
        }
        if (!mapPickActive()) {
            if (liveChooseTarget() || state.wizardStep === 'target-tip') {
                if (!state.dismissedObj) {
                    state.dismissedObj = true;
                }
                state.campaignPick = true;
                state.battleMake = true;
                advanceWizard('target-tip', 'walk-dismiss-tip');
                engineSendKey(VK.ENTER);
                setTimeout(function () {
                    if (mapPickActive()) {
                        advanceWizard('map-pick', 'walk-after-tip');
                        walkCursorToCity(cityIndex, thenEnter);
                        return;
                    }
                    if (liveChooseTarget() || /我方城池|无法到达/.test(liveEngineReport())) {
                        engineSendKey(VK.ENTER);
                        setTimeout(function () {
                            if (mapPickActive()) {
                                advanceWizard('map-pick', 'walk-after-tip-2');
                                walkCursorToCity(cityIndex, thenEnter);
                            }
                        }, 220);
                    }
                }, 220);
                return { deferred: 'choose-target', cityIndex: cityIndex };
            }
            state.marchHint = state.personExitSent
                ? '等「选择目标」出现后再点邻城。现在点城不会出发。'
                : '先点至少一名将领，再点「完成选将 · 选粮出发」，不要直接点目标城。';
            render();
            return { skipped: 'not-map-pick', cityIndex: cityIndex, hint: state.marchHint };
        }
        if (state.walkBusy && state.lastWalkCity === cityIndex) {
            return { skipped: 'walk-in-flight', cityIndex: cityIndex };
        }
        if (state.lastWalkCity === cityIndex && (Date.now() - (state.lastWalkAt || 0)) < 900) {
            return { skipped: 'walk-debounce', cityIndex: cityIndex };
        }
        state.lastWalkCity = cityIndex;
        state.lastWalkAt = Date.now();
        state.walkBusy = true;
        state.marchHint = '';
        var to = cityEngineTile(cityIndex);
        var from = readEngineCursor();
        var dirs = [];
        if (from && to && to.x != null && to.y != null) {
            var x = from.x;
            var y = from.y;
            while (y > to.y) { dirs.push(VK.UP); y -= 1; }
            while (y < to.y) { dirs.push(VK.DOWN); y += 1; }
            while (x > to.x) { dirs.push(VK.LEFT); x -= 1; }
            while (x < to.x) { dirs.push(VK.RIGHT); x += 1; }
        }
        state.walkToken = (state.walkToken || 0) + 1;
        var token = state.walkToken;
        var step = 0;
        function posEq(a, b) {
            return !!(a && b && a.x === b.x && a.y === b.y);
        }
        function landed() {
            var now = readEngineCursor();
            return !!(now && to && posEq(now, to));
        }
        function finish() {
            if (token !== state.walkToken) {
                return;
            }
            state.walkBusy = false;
            if (thenEnter === false) {
                return;
            }
            setTimeout(function () {
                if (token !== state.walkToken) {
                    return;
                }
                engineSendKey(VK.ENTER);
                scheduleMarchWatch();
            }, landed() ? 90 : 220);
        }
        function sendNext() {
            if (token !== state.walkToken) {
                return;
            }
            if (step >= dirs.length) {
                var wait = 0;
                function waitLand() {
                    if (token !== state.walkToken) {
                        return;
                    }
                    if (landed() || wait >= 10) {
                        finish();
                        return;
                    }
                    wait += 1;
                    setTimeout(waitLand, 40);
                }
                setTimeout(waitLand, 40);
                return;
            }
            var before = readEngineCursor();
            var code = dirs[step];
            engineSendKey(code);
            step += 1;
            var tries = 0;
            function poll() {
                if (token !== state.walkToken) {
                    return;
                }
                var now = readEngineCursor();
                if (!posEq(before, now) || tries >= 9) {
                    if (tries >= 9 && posEq(before, now)) {
                        engineSendKey(code);
                    }
                    sendNext();
                    return;
                }
                tries += 1;
                setTimeout(poll, 40);
            }
            setTimeout(poll, 50);
        }
        if (!dirs.length) {
            finish();
        } else {
            sendNext();
        }
        return { from: from, to: to, keys: dirs.length + (thenEnter !== false ? 1 : 0) };
    }

    function engineMarch() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.march === 'function') {
                return baye.hd.march();
            }
        } catch (e) {}
        return { pick: 0, ok: 0, mapCity: 0, seq: 0 };
    }

    function marchSeqOf(m) {
        return (m && m.seq) ? Number(m.seq) : 0;
    }

    function leftoverMarchReport(text) {
        return /部队已出发/.test(String(text || ''));
    }

    function leftoverChooseTarget(text) {
        return /选择目标/.test(String(text || ''));
    }

    function setWizardStep(step, why) {
        if (state.wizardStep === step) {
            return;
        }
        console.log('[hd-city-menu] wizard', state.wizardStep, '→', step, why || '');
        state.wizardStep = step;
    }

    function advanceWizard(step, why) {
        if (!step) {
            return;
        }
        if (step === 'none' || (WIZARD_ORDER[step] || 0) >= (WIZARD_ORDER[state.wizardStep] || 0)) {
            setWizardStep(step, why);
        }
    }

    function wizardInMarch() {
        return state.wizardStep !== 'none' && state.wizardStep !== 'march-ok';
    }

    function liveChooseTarget() {
        if (!state.personExitSent || showingQty() || mapPickActive()) {
            return false;
        }
        if (state.wizardStep === 'persons') {
            return false;
        }
        return leftoverChooseTarget(liveEngineReport());
    }

    function liveEngineReport() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.reportText === 'function') {
                return baye.hd.reportText() || '';
            }
        } catch (e) {}
        return '';
    }

    /* Only a NEW AddFightOrder this 出征: leftover ok=1 / leftover 部队已出发 text do not count. */
    function freshMarchOk() {
        var m = engineMarch();
        if (!(state.acceptMarchOk && m && m.ok)) {
            return false;
        }
        var seq = marchSeqOf(m);
        if (seq && seq > (state.consumedMarchSeq || 0)) {
            return true;
        }
        return !!(state.sawMarchCleared && m.ok);
    }

    function consumeLeftoverMarch() {
        var m = engineMarch();
        var seq = marchSeqOf(m);
        if (seq) {
            state.consumedMarchSeq = seq;
        }
        state.marchReady = false;
        state.acceptMarchOk = false;
        state.sawMarchCleared = false;
        try {
            if (window.baye && baye.data && baye.data.g_hdMarchOk != null) {
                baye.data.g_hdMarchOk = 0;
            }
        } catch (e) {}
        if (global.BayeHdDialog && typeof BayeHdDialog.clearLeftoverMarch === 'function') {
            BayeHdDialog.clearLeftoverMarch();
        }
    }

    function mapPickActive() {
        var m = engineMarch();
        return !!(m && m.pick);
    }

    function leftoverOverworldPick() {
        /* PlayerTactic 过图与 BattleMake GetCitySet 共用 g_hdMapPick。选将/选粮时 pick=1 是残留。 */
        return mapPickActive() && !state.sawQtyThisMarch && !state.dismissedObj &&
            state.wizardStep !== 'map-pick' && state.wizardStep !== 'target-tip' &&
            !liveChooseTarget();
    }

    function usesMapCursor(kind, step) {
        /* GetCitySet 打开前不要画城列表。过图 leftover pick=1 不是出征目标。 */
        return mapPickActive() && !leftoverOverworldPick();
    }

    function usesGoodsMenu(kind, step) {
        return kind === 'goods' || (kind === 'person-goods' && step === 1);
    }

    function engineQty() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.qty === 'function') {
                return baye.hd.qty();
            }
        } catch (e) {}
        return null;
    }

    function showingQty() {
        var q = engineQty();
        return !!(state.deepKind === 'qty' || (state.deepKind === 'person-qty' && state.deepStep === 1) ||
            (q && q.active));
    }

    function cityName(index) {
        try {
            if (window.baye && typeof baye.getCityName === 'function' && index >= 0) {
                return baye.getCityName(index) || '';
            }
        } catch (e) {}
        return '';
    }

    function personNameById(id) {
        try {
            if (window.baye && typeof baye.getPersonNameByID === 'function') {
                return baye.getPersonNameByID(id);
            }
        } catch (e) {}
        return String(id);
    }

    function engineData() {
        if (window.baye && typeof baye.ensureData === 'function') {
            return baye.ensureData();
        }
        return window.baye && baye.data ? baye.data : null;
    }

    function readCity(index) {
        var data = engineData();
        if (!data || !data.g_Cities || index < 0 || !data.g_Cities[index]) {
            return null;
        }
        return data.g_Cities[index];
    }

    function cityPersons(index) {
        var data = engineData();
        var city = readCity(index);
        var list = [];
        if (!data || !city || !data.g_PersonsQueue) {
            return list;
        }
        var n = readNumber(city, 'Persons') || 0;
        var q0 = readNumber(city, 'PersonQueue') || 0;
        var i;
        for (i = 0; i < n && i < 40; i++) {
            var pind = readNumber(data.g_PersonsQueue, q0 + i);
            if (pind === null && data.g_PersonsQueue[q0 + i] != null) {
                pind = Number(data.g_PersonsQueue[q0 + i]);
            }
            if (pind === null || !isFinite(pind)) {
                continue;
            }
            var name = '';
            try {
                name = baye.getPersonName(pind) || '';
            } catch (e) {}
            list.push({ i: list.length, pind: pind, name: name || ('人物 ' + pind) });
        }
        return list;
    }

    function cityLinkIndexes() {
        var data = engineData();
        var links = data && data.g_hdCityLinks;
        var out = [];
        var i;
        if (!links) {
            return out;
        }
        for (i = 0; i < 8; i++) {
            var id = readNumber(links, i);
            if (id === null && links[i] != null) {
                id = Number(links[i]);
            }
            if (id) {
                out.push(id - 1);
            }
        }
        return out;
    }

    function otherCities(except) {
        var data = engineData();
        var list = [];
        if (!data || !data.g_Cities) {
            return list;
        }
        var restrict = usesMapCursor(state.deepKind, state.deepStep) ? cityLinkIndexes() : [];
        var i;
        for (i = 0; i < data.g_Cities.length; i++) {
            if (i === except) {
                continue;
            }
            if (restrict.length && restrict.indexOf(i) < 0) {
                continue;
            }
            var name = cityName(i);
            var belong = readNumber(data.g_Cities[i], 'Belong');
            var owner = belong ? personNameById(belong) : '';
            list.push({
                i: list.length,
                cityIndex: i,
                name: name || ('城' + (i + 1)),
                owner: owner
            });
        }
        return list;
    }

    function deepKindFor(subKind, index) {
        var row = DEEP[subKind];
        if (!row) {
            return 'lcd';
        }
        return row[index] || 'lcd';
    }

    function engineMenuItems() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.menuItems === 'function') {
                return baye.hd.menuItems();
            }
        } catch (e) {}
        return { names: [], index: null, count: 0 };
    }

    function preferEngineNames(fallback) {
        var eng = engineMenuItems();
        var fb = fallback || [];
        if (eng.names && eng.names.length && fb.length &&
            (eng.names[0] === fb[0] || eng.names.length === fb.length)) {
            return eng.names;
        }
        if (eng.names && eng.names.length && !fb.length) {
            return eng.names;
        }
        return fb;
    }

    function probeDeepItems() {
        var kind = state.deepKind;
        var step = state.deepStep;
        if (usesMapCursor(kind, step)) {
            return otherCities(state.cityIndex);
        }
        if (kind === 'person' || kind === 'person-goods' || kind === 'person-qty' ||
            (kind === 'person-city' && !mapPickActive() && !showingQty())) {
            var persons = cityPersons(state.cityIndex);
            if (persons.length) {
                return persons;
            }
        }
        var eng = engineMenuItems();
        var subNames = SUBS[state.subKind] || [];
        var stillParentMenu = !!(eng.names && subNames.length &&
            eng.names.length === subNames.length &&
            eng.names[0] === subNames[0]);
        if (eng.names && eng.names.length && !stillParentMenu) {
            var mapped = [];
            var ei;
            for (ei = 0; ei < eng.names.length; ei++) {
                if (eng.names[ei]) {
                    mapped.push({ i: ei, name: eng.names[ei] });
                }
            }
            if (mapped.length) {
                if (eng.index != null) {
                    state.idleIndex = eng.index;
                }
                return mapped;
            }
        }
        return [];
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

    function el(id) {
        return document.getElementById(id);
    }

    function setText(node, text) {
        if (node) {
            node.textContent = text;
        }
    }

    function renderStatus() {
        var box = el('hd-city-menu-status');
        if (!box) {
            return;
        }
        box.innerHTML = '';
        var city = readCity(state.cityIndex);
        if (!city) {
            box.textContent = '未读到 g_Cities[' + state.cityIndex + ']，不编造数值。';
            return;
        }
        var seen = {};
        var i;
        var any = false;
        for (i = 0; i < STATUS_FIELDS.length; i++) {
            var key = STATUS_FIELDS[i][0];
            var label = STATUS_FIELDS[i][1];
            if (seen[label]) {
                continue;
            }
            if (city[key] === undefined) {
                continue;
            }
            seen[label] = true;
            any = true;
            var num = readNumber(city, key);
            var value = num;
            if (key === 'Belong' && num !== null) {
                value = personNameById(num);
            } else if ((key === 'Satrap' || key === 'SatrapId' || key === 'Mayor' || key === 'Governor') && num !== null) {
                value = personNameById(num);
            } else if (key === 'State' && num !== null && STATE_LABELS[num]) {
                value = STATE_LABELS[num] + ' (' + num + ')';
            }
            if (value === null) {
                value = String(city[key]);
            }
            appendStat(box, label, value);
        }
        var extras = listProps(city);
        state.probedCityKeys = extras.slice();
        for (i = 0; i < extras.length; i++) {
            var extra = extras[i];
            if (seen[extra]) {
                continue;
            }
            var already = false;
            var s;
            for (s = 0; s < STATUS_FIELDS.length; s++) {
                if (STATUS_FIELDS[s][0] === extra) {
                    already = true;
                }
            }
            if (already) {
                continue;
            }
            var extraNum = readNumber(city, extra);
            if (extraNum === null) {
                continue;
            }
            seen[extra] = true;
            any = true;
            appendStat(box, extra, extraNum);
        }
        if (!any) {
            box.textContent = '该城对象上没有已登记的状况字段。已记录键名，不填假数。';
        }
        if (!state.probed) {
            state.probed = true;
            console.log('[hd-city-menu] city keys', extras);
        }
    }

    function appendStat(box, label, value) {
        var row = document.createElement('div');
        row.className = 'hd-city-menu-stat';
        row.innerHTML = '<span></span><strong></strong>';
        row.querySelector('span').textContent = label;
        row.querySelector('strong').textContent = String(value);
        box.appendChild(row);
    }

    function applyHighlight() {
        var cards = document.querySelectorAll('[data-hd-root]');
        var i;
        for (i = 0; i < cards.length; i++) {
            var idx = Number(cards[i].getAttribute('data-hd-root'));
            cards[i].classList.toggle('is-idle', state.layer === 'root' && state.idleIndex === idx);
        }
        var items = document.querySelectorAll('[data-hd-sub]');
        for (i = 0; i < items.length; i++) {
            var si = Number(items[i].getAttribute('data-hd-sub'));
            items[i].classList.toggle('is-idle', state.layer === 'sub' && state.idleIndex === si);
        }
        var deeps = document.querySelectorAll('[data-hd-deep]');
        var idleNode = null;
        for (i = 0; i < deeps.length; i++) {
            var di = Number(deeps[i].getAttribute('data-hd-deep'));
            var on = state.layer === 'deep' && state.idleIndex === di;
            deeps[i].classList.toggle('is-idle', on);
            if (on) {
                idleNode = deeps[i];
            }
        }
        for (i = 0; i < items.length; i++) {
            if (items[i].classList.contains('is-idle')) {
                idleNode = items[i];
            }
        }
        if (idleNode && idleNode.scrollIntoView) {
            try {
                idleNode.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (e) {
                idleNode.scrollIntoView(false);
            }
        }
    }

    function fillDeepList() {
        var list = el('hd-city-menu-deep');
        if (!list) {
            return;
        }
        state.deepItems = probeDeepItems();
        var liveQty = engineQty();
        var march = engineMarch();
        var sig = (showingQty() ? 'qty:' + (liveQty && liveQty.value) : state.deepKind + ':' + state.deepStep) +
            ':' + (state.pickedPersons || 0) +
            ':' + (mapPickActive() ? 'pick' : '') +
            ':' + ((freshMarchOk() || state.marchReady) ? 'ok' : '') +
            ':' + (state.personExitSent ? 'pex' : '') +
            ':' + (state.acceptMarchOk ? 'acc' : '') +
            ':' + (state.wizardStep || '') +
            ':' + (state.marchHint || '') +
            ':' + state.deepItems.map(function (it) {
                return it.name;
            }).join(',');
        if (state.deepSig === sig && list.children.length) {
            applyHighlight();
            return;
        }
        state.deepSig = sig;
        list.innerHTML = '';
        var i;
        if (state.wizardStep !== 'none' && WIZARD_LABEL[state.wizardStep]) {
            var qtySteps = document.createElement('div');
            qtySteps.className = 'hd-city-menu-wizard';
            qtySteps.setAttribute('data-hd-wizard', state.wizardStep);
            var wizardKeys = ['persons', 'food', 'target-tip', 'map-pick', 'march-ok'];
            var wizardBits = [];
            var wi;
            for (wi = 0; wi < wizardKeys.length; wi++) {
                var wKey = wizardKeys[wi];
                wizardBits.push('<span class="hd-city-menu-wizard-step' +
                    (wKey === state.wizardStep ? ' is-current' : '') +
                    '" data-hd-wizard-step="' + wKey + '">' +
                    WIZARD_LABEL[wKey] + '</span>');
            }
            qtySteps.innerHTML = wizardBits.join('<span class="hd-city-menu-wizard-sep">→</span>') +
                (state.wizardStep === 'persons' ? '<span class="hd-city-menu-wizard-extra">已点 ' +
                    (state.pickedPersons || 0) + ' 人</span>' : '');
            list.appendChild(qtySteps);
        }
        if (showingQty()) {
            var bar = document.createElement('div');
            bar.className = 'hd-city-menu-qty';
            var q = { value: '', min: '', max: '' };
            try {
                if (window.baye && baye.hd && baye.hd.qty) {
                    q = baye.hd.qty();
                }
            } catch (e) {}
            bar.innerHTML = '<p>引擎数量 <strong id="hd-city-qty-val">' +
                (q.value !== '' && q.value != null ? q.value : '—') +
                '</strong> · 可用方向步进或 0–9（VK_DIGIT0=0x40）</p>' +
                '<div>' +
                '<button type="button" data-hd-qty="-10">−10</button>' +
                '<button type="button" data-hd-qty="-1">−</button>' +
                '<button type="button" data-hd-qty="1">+</button>' +
                '<button type="button" data-hd-qty="10">+10</button>' +
                '<button type="button" data-hd-digit="0">0</button>' +
                '<button type="button" data-hd-digit="1">1</button>' +
                '<button type="button" data-hd-digit="2">2</button>' +
                '<button type="button" data-hd-digit="3">3</button>' +
                '<button type="button" data-hd-digit="4">4</button>' +
                '<button type="button" data-hd-digit="5">5</button>' +
                '<button type="button" data-hd-digit="6">6</button>' +
                '<button type="button" data-hd-digit="7">7</button>' +
                '<button type="button" data-hd-digit="8">8</button>' +
                '<button type="button" data-hd-digit="9">9</button>' +
                '<button type="button" data-hd-qty-ok>确认</button>' +
                '</div>';
            list.appendChild(bar);
            return;
        }
        var showMarchOk = (state.marchReady || freshMarchOk()) &&
            (state.deepKind === 'person-city' || state.deepLabel === '出征');
        if (showMarchOk) {
            var done = document.createElement('div');
            done.className = 'hd-city-menu-march-ok';
            done.setAttribute('data-hd-march-ok', '1');
            done.innerHTML = '<p>部队已出发</p>' +
                '<p>需「策略结束」让 PolicyExec 走军入战</p>' +
                '<button type="button" data-hd-strategy-end>策略结束</button>';
            list.appendChild(done);
        } else if (state.marchHint) {
            var warn = document.createElement('div');
            warn.className = 'hd-city-menu-march-hint';
            warn.setAttribute('data-hd-march-hint', '1');
            warn.textContent = state.marchHint;
            list.appendChild(warn);
        }
        if (!showMarchOk && state.deepKind === 'person-city' &&
            !(mapPickActive() && !leftoverOverworldPick()) &&
            !state.personExitSent && state.wizardStep === 'persons') {
            var fin = document.createElement('div');
            fin.className = 'hd-city-menu-finish-persons';
            fin.innerHTML = '<p>已点将 ' + (state.pickedPersons || 0) +
                ' 人 · EXIT 结束选将，再选粮、选目标城</p>' +
                '<button type="button" data-hd-finish-persons>完成选将 · 选粮出发</button>';
            list.appendChild(fin);
        }
        if (usesMapCursor(state.deepKind, state.deepStep)) {
            var hint = document.createElement('div');
            hint.className = 'hd-city-menu-map-hint';
            hint.textContent = '选择目标：点邻城或点大地图高亮城（走引擎格，不是 china-lcc 像素）。';
            list.appendChild(hint);
        }
        if (!state.deepItems.length && !showMarchOk &&
            !(state.deepKind === 'person-city' && !mapPickActive())) {
            var empty = document.createElement('div');
            empty.className = 'hd-city-menu-deep-empty';
            empty.textContent = '还没有读到人物/城池名单。右侧放大的经典 LCD 是引擎当前列表；名单一对上就收起对照。';
            list.appendChild(empty);
            return;
        }
        for (i = 0; i < state.deepItems.length; i++) {
            var it = state.deepItems[i];
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'hd-city-menu-item';
            btn.setAttribute('data-hd-deep', String(i));
            btn.textContent = it.owner ? (it.name + ' · ' + it.owner) : it.name;
            list.appendChild(btn);
        }
        applyHighlight();
    }

    function fillSubList(kind) {
        var list = el('hd-city-menu-sublist');
        if (!list) {
            return;
        }
        var items = preferEngineNames(SUBS[kind] || []);
        var sig = kind + ':' + items.join(',');
        if (state.listKind === sig && list.children.length) {
            applyHighlight();
            return;
        }
        list.innerHTML = '';
        var i;
        for (i = 0; i < items.length; i++) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'hd-city-menu-item';
            btn.setAttribute('data-hd-sub', String(i));
            btn.textContent = items[i];
            list.appendChild(btn);
        }
        state.listKind = sig;
        applyHighlight();
    }

    function applyRootLabels() {
        var cards = document.querySelectorAll('[data-hd-root]');
        var names = preferEngineNames([]);
        var i;
        for (i = 0; i < cards.length; i++) {
            var strong = cards[i].querySelector('strong');
            if (!strong) {
                continue;
            }
            if (state.layer === 'root' && names.length === cards.length && names[i]) {
                strong.textContent = names[i];
            } else if (ROOTS[i]) {
                strong.textContent = ROOTS[i].name;
            }
        }
    }

    function render() {
        var root = el('hd-city-menu');
        if (!root) {
            return;
        }
        var show = state.open && shouldShowHd();
        root.setAttribute('aria-hidden', show ? 'false' : 'true');
        root.classList.toggle('is-open', show);
        root.classList.toggle('is-sub', show && state.layer !== 'root');
        applyDocAttr();
        if (!show) {
            if (!state.open) {
                setText(el('hd-city-menu-title'), '城池');
            }
            return;
        }
        var liveName = cityName(state.cityIndex);
        if (liveName) {
            state.cityName = liveName;
        }
        var title = state.cityName || (state.cityIndex >= 0 ? '城' + (state.cityIndex + 1) : '城池');
        setText(el('hd-city-menu-title'), title);
        var sub = el('hd-city-menu-sub');
        var grid = el('hd-city-menu-root');
        var list = el('hd-city-menu-sublist');
        var status = el('hd-city-menu-status');
        var deep = el('hd-city-menu-deep');
        var probe = el('hd-city-menu-probe');
        function hideAllLayers() {
            if (grid) {
                grid.hidden = true;
            }
            if (list) {
                list.hidden = true;
            }
            if (status) {
                status.hidden = true;
            }
            if (deep) {
                deep.hidden = true;
            }
        }
        if (state.layer === 'root') {
            setText(sub, '城池指令 · 项名优先 baye.hd.menuItems()');
            hideAllLayers();
            if (grid) {
                grid.hidden = false;
                applyRootLabels();
            }
        } else if (state.layer === 'status') {
            setText(sub, '状况 · 只列出读到的 g_Cities 字段');
            hideAllLayers();
            if (status) {
                status.hidden = false;
            }
            renderStatus();
        } else if (state.layer === 'deep') {
            var stepHint = showingQty()
                ? '数量'
                : ((state.deepKind === 'person-city' || state.deepLabel === '出征') &&
                    (state.marchReady || freshMarchOk())
                    ? '部队已出发'
                    : (usesMapCursor(state.deepKind, state.deepStep)
                        ? '目标城池（方向键对齐引擎光标）'
                        : (usesGoodsMenu(state.deepKind, state.deepStep) ? '道具（baye.hd.menuItems）' : '人物')));
            if (state.wizardStep !== 'none' && WIZARD_LABEL[state.wizardStep]) {
                stepHint = '出征步骤 ' + WIZARD_LABEL[state.wizardStep];
            }
            setText(sub, (state.deepLabel || '深层') + ' · ' + stepHint +
                (state.showLcd ? ' · 经典 LCD 对照' : ' · 光标与引擎同步'));
            hideAllLayers();
            if (deep) {
                deep.hidden = false;
                fillDeepList();
                if (!showingQty() && state.deepItems.length) {
                    state.showLcd = false;
                    applyDocAttr();
                } else if (!showingQty() && !state.deepItems.length) {
                    state.showLcd = true;
                    applyDocAttr();
                }
            }
        } else {
            var items = preferEngineNames(SUBS[state.subKind] || []);
            var kindName = '';
            var r;
            for (r = 0; r < ROOTS.length; r++) {
                if (ROOTS[r].id === state.subKind) {
                    kindName = ROOTS[r].name;
                }
            }
            setText(sub, kindName + ' · 点选发方向键 + 确认，引擎执行');
            hideAllLayers();
            if (list) {
                list.hidden = false;
                fillSubList(state.subKind);
            }
        }
        applyHighlight();
        var idle = state.idleIndex == null ? '—' : String(state.idleIndex);
        setText(probe, 'hook=' + (state.lastHook || '—') + '  idleIndex=' + idle +
            (state.idleKeys.length ? '  ctx=' + state.idleKeys.join(',') : '') +
            (state.probedCityKeys.length ? '  cityKeys=' + state.probedCityKeys.length : ''));
        syncToolbar();
    }

    function bindOpenedCity(meta) {
        meta = meta || {};
        var nextIndex = meta.cityIndex;
        if (nextIndex == null || nextIndex < 0) {
            nextIndex = state.cityIndex;
        }
        var switched = nextIndex >= 0 && nextIndex !== state.cityIndex;
        if (nextIndex >= 0) {
            state.cityIndex = nextIndex;
        }
        var live = cityName(state.cityIndex);
        state.cityName = (meta.cityName && String(meta.cityName)) || live || state.cityName || '';
        if (switched && state.open) {
            state.layer = 'root';
            state.subKind = '';
            state.deepKind = '';
            state.deepLabel = '';
            state.deepItems = [];
            state.idleIndex = 0;
        }
        return switched;
    }

    function openMenu(meta) {
        meta = meta || {};
        if (!shouldShowHd()) {
            return false;
        }
        bindOpenedCity(meta);
        state.lastHook = meta.hook || state.lastHook;
        if (state.open) {
            render();
            return true;
        }
        state.listKind = '';
        state.open = true;
        state.layer = 'root';
        state.subKind = '';
        state.showLcd = false;
        state.queue = [];
        state.cityName = state.cityName || cityName(state.cityIndex);
        render();
        console.log('[hd-city-menu] open', {
            city: state.cityName,
            index: state.cityIndex,
            pref: getMenuMode()
        });
        return true;
    }

    function closeMenu(opts) {
        opts = opts || {};
        if (holdMenu() && !opts.force) {
            state.lastBlockedExit = state.marchReady ? 'closeMenu-march-ok' : 'closeMenu-hold';
            console.warn('[hd-city-menu] blocked closeMenu', state.lastBlockedExit);
            if (!opts.silent && !state.marchReady) {
                state.marchHint = state.personExitSent
                    ? '出征进行中：点邻城出发，不要关菜单。'
                    : '出征进行中：点将后点「完成选将」，不要关菜单。';
            }
            applyDocAttr();
            render();
            return;
        }
        if (!state.open) {
            state.cityIndex = -1;
            state.cityName = '';
            applyDocAttr();
            return;
        }
        state.open = false;
        state.layer = 'root';
        state.queue = [];
        state.sending = false;
        state.cityIndex = -1;
        state.cityName = '';
        if (!freshMarchOk()) {
            state.marchReady = false;
        }
        if (!mapPickActive() && !state.handoff && !state.battleMake) {
            state.campaignPick = false;
        }
        if (!opts.keepWizard) {
            state.wizardStep = 'none';
            state.sawQtyThisMarch = false;
        }
        render();
        if (!opts.silent && global.BayeHdOverworld &&
            typeof BayeHdOverworld.leaveMenu === 'function') {
            BayeHdOverworld.leaveMenu('已回到 HD 大地图。');
        }
    }

    function back() {
        if (!state.open) {
            return;
        }
        if (holdMenu()) {
            /* 出征向导 / 部队已出发 横幅期间 HD「返回」绝不 EXIT。 */
            if (!state.marchReady) {
                state.marchHint = state.personExitSent
                    ? '出征进行中：点邻城出发，不要返回。'
                    : '出征进行中：点将后点「完成选将」，不要返回。';
            }
            render();
            return;
        }
        if (state.layer === 'deep') {
            if (mapPickActive() || state.campaignPick || /选择目标/.test(reportText())) {
                closeMenu({ silent: true });
                return;
            }
            if (state.deepKind === 'person-city' && state.pickedPersons > 0 &&
                !mapPickActive() && !showingQty() && !state.marchReady) {
                finishPersonPick();
                return;
            }
            state.closingSub = true;
            state.layer = 'sub';
            state.deepKind = '';
            state.deepLabel = '';
            state.deepStep = 0;
            state.idleIndex = 0;
            state.battleMake = false;
            state.campaignPick = false;
            enqueueKeys([VK.EXIT], 60, 'back-deep');
            render();
            return;
        }
        if (state.layer !== 'root') {
            state.closingSub = true;
            state.layer = 'root';
            state.subKind = '';
            state.idleIndex = null;
            enqueueKeys([VK.EXIT], 60, 'back-sub');
            render();
            return;
        }
        closeMenu({ silent: false });
    }

    function chooseRoot(index) {
        if (index < 0 || index >= ROOTS.length) {
            return;
        }
        var root = ROOTS[index];
        pickIndex(index, true);
        if (root.id === 'zhuangkuang') {
            state.layer = 'status';
            state.subKind = root.id;
        } else {
            state.layer = 'sub';
            state.subKind = root.id;
            state.idleIndex = 0;
        }
        render();
    }

    function chooseSub(index) {
        var names = preferEngineNames(SUBS[state.subKind] || []);
        var willMarch = deepKindFor(state.subKind, index) === 'person-city' || names[index] === '出征';
        if (willMarch && global.BayeHdDialog &&
            typeof BayeHdDialog.dismissLeftoverSpeech === 'function') {
            BayeHdDialog.dismissLeftoverSpeech();
        }
        pickIndex(index, true);
        state.deepKind = deepKindFor(state.subKind, index);
        state.deepLabel = names[index] || '';
        state.deepStep = 0;
        state.layer = 'deep';
        state.idleIndex = 0;
        state.deepSig = '';
        state.pickedPersons = 0;
        state.dismissedObj = false;
        state.marchReady = false;
        state.campaignPick = false;
        state.battleMake = (state.deepKind === 'person-city' || state.deepLabel === '出征');
        state.personExitSent = false;
        state.wizardStep = (state.deepKind === 'person-city' || state.deepLabel === '出征') ? 'persons' : 'none';
        state.sawQtyThisMarch = false;
        state.reportAtMarchStart = liveEngineReport();
        state.lastFuncMenuIdle = 0;
        state.lastWalkCity = null;
        state.lastWalkAt = 0;
        state.walkBusy = false;
        state.acceptMarchOk = false;
        state.sawMarchCleared = false;
        state.lastBlockedExit = '';
        state.lastExit = '';
        state.marchHint = state.battleMake ? '点将后必须点「完成选将 · 选粮出发」，再点目标城。' : '';
        state.handoff = false;
        if (state.battleMake) {
            consumeLeftoverMarch();
            state.battleMake = true;
            state.marchHint = '点将后必须点「完成选将 · 选粮出发」，再点目标城。';
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.resetArmout === 'function') {
            BayeHdDialog.resetArmout();
        }
        if (state.battleMake && global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        state.showLcd = false;
        applyDocAttr();
        var lcdBtn = document.querySelector('[data-hd-menu-lcd]');
        if (lcdBtn) {
            lcdBtn.textContent = '经典 LCD';
        }
        render();
        scheduleMarchWatch();
    }

    function finishPersonPick() {
        if (state.wizardStep !== 'persons' && state.wizardStep !== 'none') {
            return;
        }
        if (state.personExitSent || showingQty() || state.marchReady) {
            return;
        }
        if (mapPickActive() && !leftoverOverworldPick()) {
            return;
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.dismissLeftoverSpeech === 'function') {
            BayeHdDialog.dismissLeftoverSpeech();
        }
        if (!(state.pickedPersons > 0)) {
            state.marchHint = '先点至少一名将领，再点「完成选将」。';
            render();
            return;
        }
        state.dismissedObj = false;
        state.personExitSent = true;
        state.campaignPick = false;
        advanceWizard('food', 'finish-persons');
        state.marchHint = '已结束选将，接着确认粮草。';
        enqueueKeys([VK.EXIT], 70, 'finish-persons');
        scheduleMarchWatch();
        render();
    }

    function fightIsActive() {
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
        return false;
    }

    function goStrategyEnd() {
        /* 部队已出发后引擎回到 PlayerTactic GetCitySet。EXIT 一次进 FunctionMenu，
         * ENTER 确认策略结束。再 EXIT 会取消 FunctionMenu；再回车会打进河内/战场。 */
        var haveFresh = freshMarchOk();
        var stillSelecting = !haveFresh && !!(state.battleMake || state.campaignPick || wizardInMarch());
        state.handoff = true;
        state.battleMake = false;
        state.marchReady = false;
        state.campaignPick = false;
        state.wizardStep = haveFresh ? 'march-ok' : 'none';
        if (global.BayeHdBattle && typeof BayeHdBattle.prepareNewFight === 'function') {
            BayeHdBattle.prepareNewFight();
        }
        if (!haveFresh) {
            consumeLeftoverMarch();
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        closeMenu({ silent: true });
        var tries = 0;
        var confirmed = false;
        var leftPick = mapPickActive();
        function leftoverFightSys(names) {
            return names[0] === '全军撤退' || names[0] === '回合结束';
        }
        function liveFunctionMenu() {
            return looksLikeFunctionMenu() &&
                (Date.now() - (state.lastFuncMenuIdle || 0)) < 2000;
        }
        function step() {
            if (confirmed) {
                return;
            }
            if (fightIsActive()) {
                state.handoff = false;
                return;
            }
            var names = engineMenuItems().names || [];
            var pick = mapPickActive();
            if (pick) {
                /* Still in BattleMake GetCitySet without a NEW AddFightOrder: EXIT cancels 出征. */
                if (!freshMarchOk() && stillSelecting) {
                    tries += 1;
                    if (tries >= 16) {
                        state.handoff = false;
                        state.marchHint = '先点目标城等到「部队已出发」，再策略结束。';
                        return;
                    }
                    setTimeout(step, 240);
                    return;
                }
                leftPick = true;
                tries += 1;
                engineSendKey(VK.EXIT, 'strategy-end');
                setTimeout(step, 240);
                return;
            }
            /* 活 FunctionMenu（新鲜 onMenuIdle）才回车。残留「策略结束」字节不确认。 */
            if (names[0] === '策略结束' && liveFunctionMenu()) {
                confirmed = true;
                if (freshMarchOk()) {
                    var m = engineMarch();
                    if (marchSeqOf(m)) {
                        state.consumedMarchSeq = marchSeqOf(m);
                    }
                }
                if (!(global.BayeHdSystemUi &&
                    typeof BayeHdSystemUi.confirmStrategyEnd === 'function' &&
                    BayeHdSystemUi.confirmStrategyEnd())) {
                    engineSendKey(VK.ENTER);
                }
                setTimeout(function () {
                    state.handoff = false;
                    if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                        BayeHdDialog.close({ silent: true });
                    }
                }, 700);
                return;
            }
            /* 上场覆没后残留「全军撤退」字节：战斗已关则不当活菜单，继续找 FunctionMenu。 */
            if (leftoverFightSys(names) && fightIsActive()) {
                tries += 1;
                if (tries >= 16) {
                    state.handoff = false;
                    return;
                }
                setTimeout(step, 240);
                return;
            }
            if (tries >= 16) {
                state.handoff = false;
                return;
            }
            tries += 1;
            engineSendKey(VK.EXIT, 'strategy-end');
            setTimeout(step, 240);
        }
        setTimeout(step, 80);
    }

    function isMarching() {
        /* 部队已出发后不再占 isMarching：报告壳才能关，地图点己方城才能开招商。 */
        if (state.marchReady) {
            return false;
        }
        if (state.campaignPick || state.battleMake || wizardInMarch()) {
            return true;
        }
        try {
            if (liveChooseTarget() || state.wizardStep === 'target-tip' || state.wizardStep === 'map-pick') {
                return true;
            }
        } catch (e) {}
        if (!state.open || state.layer !== 'deep') {
            return false;
        }
        return state.deepKind === 'person-city' || state.deepLabel === '出征';
    }

    function isHandoff() {
        return !!state.handoff;
    }

    function reportText() {
        var engine = liveEngineReport();
        if (engine) {
            /* g_hdReportGbk leftover 选择目标 after 策略结束 must not look live during 选将. */
            if (leftoverChooseTarget(engine) && (!state.personExitSent || state.wizardStep === 'persons')) {
                return '';
            }
            return engine;
        }
        try {
            if (global.BayeHdDialog && typeof BayeHdDialog.debugSnapshot === 'function') {
                var d = BayeHdDialog.debugSnapshot();
                var body = (d && (d.body || d.reportText)) || '';
                /* Closed-dialog leftover 部队已出发 / 选择目标 must not look like a live step. */
                if ((leftoverMarchReport(body) || leftoverChooseTarget(body)) && !(d && d.open)) {
                    return '';
                }
                return body;
            }
        } catch (e) {}
        return '';
    }

    function looksLikeFunctionMenu() {
        var names = engineMenuItems().names || [];
        return names[0] === '策略结束';
    }

    function syncMarchPhase() {
        if (!state.open || state.layer !== 'deep') {
            return;
        }
        /* g_hdMenuBytes 会残留「策略结束」。出征选将/选粮/选择目标时不能当 FunctionMenu 关向导。 */
        var liveFunc = looksLikeFunctionMenu() &&
            (Date.now() - (state.lastFuncMenuIdle || 0)) < 1400;
        if (liveFunc && !holdExit() && !state.campaignPick && !state.battleMake &&
            !state.marchReady && !mapPickActive() && !showingQty() &&
            !/选择目标|部队已出发/.test(reportText())) {
            closeMenu({ silent: true });
            return;
        }
        var qty = engineQty();
        var march = engineMarch();
        var report = reportText();
        if (qty && qty.active) {
            state.sawQtyThisMarch = true;
            advanceWizard('food', 'qty-active');
            state.deepSig = '';
            render();
            return;
        }
        var liveAbort = liveEngineReport();
        if (wizardInMarch() && !state.pickedPersons &&
            /城中无空闲武将|金钱不足|粮草不足/.test(liveAbort) &&
            liveAbort !== state.reportAtMarchStart) {
            setWizardStep('none', 'engine-abort');
            state.battleMake = false;
            state.personExitSent = false;
            state.marchHint = liveAbort;
            render();
            return;
        }
        if (state.personExitSent && state.wizardStep === 'food' && !mapPickActive() && liveChooseTarget()) {
            advanceWizard('target-tip', 'sync-food-done');
        }
        if (holdExit() && /饥荒|旱灾|水灾|暴动/.test(report) && !showingQty() && !mapPickActive()) {
            enqueueKeys([VK.ENTER], 70);
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            scheduleMarchWatch();
            return;
        }
        /* Leftover 选择目标 from last month / last city must not ENTER during 选将. */
        if (!state.dismissedObj && liveChooseTarget()) {
            state.dismissedObj = true;
            state.campaignPick = true;
            advanceWizard('target-tip', 'sync-live-tip');
            enqueueKeys([VK.ENTER], 80);
            setTimeout(function () {
                if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                    BayeHdDialog.close({ silent: true });
                }
            }, 120);
            scheduleMarchWatch();
            return;
        }
        if (/我方城池|无法到达/.test(report) && (state.campaignPick || mapPickActive())) {
            enqueueKeys([VK.ENTER], 80);
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            scheduleMarchWatch();
            return;
        }
        if (mapPickActive() && (state.sawQtyThisMarch || state.dismissedObj ||
            state.wizardStep === 'target-tip' || state.wizardStep === 'map-pick' ||
            leftoverChooseTarget(liveEngineReport()))) {
            state.campaignPick = true;
            state.acceptMarchOk = true;
            advanceWizard('map-pick', 'sync-pick');
            if (!(march && march.ok)) {
                state.sawMarchCleared = true;
            }
        }
        if (mapPickActive() || freshMarchOk()) {
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            if (freshMarchOk()) {
                state.marchReady = true;
                state.campaignPick = false;
                state.battleMake = false;
                state.walkBusy = false;
                state.marchHint = '';
                advanceWizard('march-ok', 'sync-ok');
            } else if (leftoverMarchReport(report) && !freshMarchOk()) {
                /* Leftover 部队已出发 from the last battle is not a new AddFightOrder. */
                if (global.BayeHdDialog && typeof BayeHdDialog.clearLeftoverMarch === 'function') {
                    BayeHdDialog.clearLeftoverMarch();
                }
            }
            state.deepSig = '';
            render();
        }
    }

    function scheduleMarchWatch() {
        [80, 200, 400, 700, 1100, 1600, 2200, 3200].forEach(function (ms) {
            setTimeout(function () {
                syncMarchPhase();
            }, ms);
        });
    }

    function chooseDeep(index) {
        if (showingQty()) {
            return;
        }
        var liveMarch = engineMarch();
        if (state.marchReady || freshMarchOk()) {
            return;
        }
        var item = state.deepItems[index];
        if (usesMapCursor(state.deepKind, state.deepStep) && item && item.cityIndex != null) {
            walkCursorToCity(item.cityIndex, true);
            scheduleMarchWatch();
            return;
        }
        if (mapPickActive() || showingQty() || state.personExitSent || state.campaignPick ||
            state.wizardStep === 'food' || state.wizardStep === 'target-tip' || state.wizardStep === 'map-pick') {
            state.marchHint = mapPickActive() || state.wizardStep === 'map-pick' || state.wizardStep === 'target-tip'
                ? '现在点邻城或地图上的目标城，不要再点将领。'
                : '已结束选将，请确认粮草。';
            render();
            return;
        }
        pickIndex(index, true);
        if (state.deepKind === 'person-city' && !mapPickActive() && !showingQty()) {
            state.pickedPersons += 1;
            state.deepSig = '';
            setTimeout(function () {
                if (state.open && state.layer === 'deep') {
                    fillDeepList();
                }
            }, 220);
            return;
        }
        if ((state.deepKind === 'person-goods' || state.deepKind === 'person-qty') &&
            state.deepStep === 0) {
            state.deepStep = 1;
            state.idleIndex = 0;
            state.deepSig = '';
            setTimeout(function () {
                if (state.open && state.layer === 'deep') {
                    render();
                }
            }, 280);
            return;
        }
        if (global.BayeHdDialog) {
            setTimeout(function () {
                if (global.BayeHdDialog && typeof BayeHdDialog.poll === 'function') {
                    BayeHdDialog.poll();
                }
            }, 80);
        }
        scheduleMarchWatch();
    }

    function onEngineHook(name, ctx) {
        state.lastHook = name;
        if (ctx && typeof ctx === 'object') {
            var keys = listProps(ctx);
            if (keys.length) {
                state.idleKeys = keys;
            }
            if (ctx.index != null && isFinite(Number(ctx.index))) {
                state.idleIndex = Number(ctx.index);
                if (state.open) {
                    applyHighlight();
                }
            }
            if (name === 'onMenuIdle') {
                var engIdle = engineMenuItems();
                if (engIdle.index != null) {
                    state.idleIndex = engIdle.index;
                }
                if (looksLikeFunctionMenu()) {
                    state.lastFuncMenuIdle = Date.now();
                    if (!holdExit() && !state.battleMake && !state.campaignPick &&
                        !state.marchReady && !mapPickActive() && !showingQty() &&
                        !/选择目标|部队已出发/.test(reportText())) {
                        closeMenu({ silent: true });
                        return;
                    }
                }
                if (state.layer === 'deep' && engIdle.names && engIdle.names.length) {
                    state.deepSig = '';
                    fillDeepList();
                    applyHighlight();
                }
                if (state.layer === 'sub' && engIdle.names && engIdle.names.length) {
                    fillSubList(state.subKind);
                    applyHighlight();
                }
                if (state.layer === 'root' && engIdle.names && engIdle.names.length) {
                    applyRootLabels();
                    applyHighlight();
                }
                syncMarchPhase();
            }
            if (!state.probed && keys.length) {
                console.log('[hd-city-menu] hook ctx', name, keys, ctx);
            }
        }
        if (looksLikeFunctionMenu() && state.open) {
            if (holdExit() || state.marchReady || state.campaignPick || mapPickActive() ||
                showingQty() || /选择目标|部队已出发/.test(reportText())) {
                return;
            }
            closeMenu({ silent: true });
            return;
        }
        if (!state.open) {
            return;
        }
        if (name === 'willCloseMenu') {
            if (state.closingSub) {
                state.closingSub = false;
                if (state.layer === 'deep') {
                    state.layer = 'sub';
                    state.deepKind = '';
                } else {
                    state.layer = 'root';
                    state.subKind = '';
                }
                render();
            }
        }
        if (name === 'onMenuIdle' || name === 'cityMakeCommand') {
            var probe = el('hd-city-menu-probe');
            if (probe && state.open) {
                setText(probe, 'hook=' + name + '  idleIndex=' +
                    (state.idleIndex == null ? '—' : state.idleIndex) +
                    (state.idleKeys.length ? '  ctx=' + state.idleKeys.join(',') : ''));
            }
        }
    }

    function bindUi() {
        if (state.bound) {
            return;
        }
        var root = el('hd-city-menu');
        if (!root) {
            return;
        }
        state.bound = true;
        root.addEventListener('click', function (ev) {
            if (ev.target === root) {
                ev.preventDefault();
                back();
                return;
            }
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && t.getAttribute('data-hd-root') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    chooseRoot(Number(t.getAttribute('data-hd-root')));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-sub') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    chooseSub(Number(t.getAttribute('data-hd-sub')));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-deep') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    chooseDeep(Number(t.getAttribute('data-hd-deep')));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-qty') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var delta = Number(t.getAttribute('data-hd-qty'));
                    if (delta < 0) {
                        enqueueKeys(delta <= -10 ? [VK.LEFT, VK.DOWN] : [VK.DOWN], 40);
                    } else {
                        enqueueKeys(delta >= 10 ? [VK.RIGHT, VK.UP] : [VK.UP], 40);
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-finish-persons') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    finishPersonPick();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-strategy-end') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    goStrategyEnd();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-qty-ok') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    enqueueKeys([VK.ENTER], 60);
                    scheduleMarchWatch();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-digit') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var digit = Number(t.getAttribute('data-hd-digit'));
                    if (isFinite(digit) && digit >= 0 && digit <= 9) {
                        enqueueKeys([0x40 + digit], 30);
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-menu-help') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (global.BayeHdDialog) {
                        BayeHdDialog.openHelp();
                    } else {
                        enqueueKeys([0x26], 40);
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-menu-back') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    back();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-menu-lcd') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    state.showLcd = !state.showLcd;
                    applyDocAttr();
                    t.textContent = state.showLcd ? '隐藏经典 LCD' : '经典 LCD';
                    return;
                }
                t = t.parentNode;
            }
        });
        document.addEventListener('keydown', function (e) {
            if (!state.open || !shouldShowHd()) {
                return;
            }
            if (e.keyCode === 27 || e.keyCode === 32) {
                e.preventDefault();
                back();
            }
        });
    }

    function syncToolbar() {
        var toolbar = document.getElementById('baye-hd-toolbar');
        if (!toolbar) {
            return;
        }
        var mode = getMenuMode();
        var buttons = toolbar.querySelectorAll('[data-hd-city-menu]');
        var i;
        for (i = 0; i < buttons.length; i++) {
            var active = buttons[i].getAttribute('data-hd-city-menu') === mode;
            buttons[i].classList.toggle('is-active', active);
            buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
        }
    }

    function bindToolbar() {
        var toolbar = document.getElementById('baye-hd-toolbar');
        if (!toolbar || toolbar.getAttribute('data-hd-city-bound')) {
            return;
        }
        toolbar.setAttribute('data-hd-city-bound', '1');
        toolbar.addEventListener('click', function (event) {
            var node = event.target;
            while (node && node !== toolbar) {
                if (node.tagName === 'BUTTON' && node.getAttribute('data-hd-city-menu')) {
                    setMenuMode(node.getAttribute('data-hd-city-menu'));
                    return;
                }
                node = node.parentNode;
            }
        });
        syncToolbar();
    }

    function setMenuMode(value) {
        var mode = normalizeMenuMode(value);
        writeStorage(STORAGE_KEY, mode);
        state.mode = mode;
        if (state.open && !shouldShowHd()) {
            closeMenu({ silent: true });
        }
        applyDocAttr();
        syncToolbar();
        render();
    }

    function start() {
        state.mode = getMenuMode();
        bindUi();
        bindToolbar();
        applyDocAttr();
        render();
        setInterval(function () {
            if (!(state.open && state.layer === 'deep')) {
                return;
            }
            syncMarchPhase();
            if (showingQty()) {
                fillDeepList();
                var node = el('hd-city-qty-val');
                var q = engineQty();
                if (node && q) {
                    node.textContent = q.active ? q.value : (q.value || '—');
                }
                return;
            }
            if (usesGoodsMenu(state.deepKind, state.deepStep) ||
                state.deepKind === 'person' ||
                state.deepKind === 'person-goods' ||
                state.deepKind === 'person-qty' ||
                state.deepKind === 'person-city' ||
                mapPickActive() ||
                state.marchReady) {
                fillDeepList();
            }
        }, 200);
    }

    applyDocAttr();

    global.BayeHdCityMenu = {
        STORAGE_KEY: STORAGE_KEY,
        getMode: getMenuMode,
        setMode: setMenuMode,
        shouldShowHd: shouldShowHd,
        isOpen: function () { return state.open; },
        getLayer: function () { return state.layer; },
        open: openMenu,
        close: closeMenu,
        back: back,
        onEngineHook: onEngineHook,
        onMapPick: function () {
            if (state.open && state.layer === 'deep') {
                state.deepSig = '';
                applyDocAttr();
                fillDeepList();
            }
        },
        start: start,
        applyPcPage: start,
        debugSnapshot: function () {
            return {
                pref: getMenuMode(),
                showHd: shouldShowHd(),
                open: state.open,
                layer: state.layer,
                subKind: state.subKind,
                cityIndex: state.cityIndex,
                cityName: state.cityName,
                titleText: (el('hd-city-menu-title') && el('hd-city-menu-title').textContent) || '',
                idleIndex: state.idleIndex,
                idleKeys: state.idleKeys.slice(),
                lastHook: state.lastHook,
                showLcd: state.showLcd,
                probedCityKeys: state.probedCityKeys.slice(),
                deepKind: state.deepKind,
                deepLabel: state.deepLabel,
                deepCount: state.deepItems.length,
                deepItems: state.deepItems.slice(0, 20),
                pickedPersons: state.pickedPersons,
                dismissedObj: state.dismissedObj,
                marchReady: state.marchReady,
                marching: isMarching(),
                campaignPick: state.campaignPick,
                battleMake: state.battleMake,
                handoff: state.handoff,
                personExitSent: state.personExitSent,
                lastExit: state.lastExit,
                lastBlockedExit: state.lastBlockedExit,
                marchHint: state.marchHint,
                holdExit: holdExit(),
                holdMenu: holdMenu(),
                acceptMarchOk: state.acceptMarchOk,
                freshMarch: freshMarchOk(),
                consumedMarchSeq: state.consumedMarchSeq,
                sawMarchCleared: state.sawMarchCleared,
                walkBusy: state.walkBusy,
                wizardStep: state.wizardStep,
                wizardLabel: WIZARD_LABEL[state.wizardStep] || '',
                sawQtyThisMarch: state.sawQtyThisMarch,
                leftoverPick: leftoverOverworldPick(),
                reportAtMarchStart: state.reportAtMarchStart,
                march: engineMarch(),
                qty: engineQty()
            };
        },
        walkToCity: walkCursorToCity,
        isMarching: isMarching,
        isHandoff: isHandoff,
        holdExit: holdExit,
        holdMenu: holdMenu,
        isMarchReady: function () { return !!(state.marchReady && !state.handoff && freshMarchOk()); },
        finishPersons: finishPersonPick,
        leftoverOverworldPick: leftoverOverworldPick,
        wizardStep: function () { return state.wizardStep; },
        goStrategyEnd: goStrategyEnd,
        consumeLeftoverMarch: consumeLeftoverMarch,
        freshMarchOk: freshMarchOk
    };
})(window);
