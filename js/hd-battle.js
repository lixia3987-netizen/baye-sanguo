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
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
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
        probed: false,
        resultCode: 0,
        resultText: '',
        menuKind: '',
        menuTitle: '',
        menuNames: [],
        menuIndex: 0,
        lastMenuIdleAt: 0,
        lastMenuIdleKind: '',
        liveMenuKind: '',
        lastWait: 0,
        sawWait: false,
        pendingSys: 0,
        resultDismissed: false,
        occupyTimer: 0,
        occupyPending: false,
        occupyStarted: false,
        occupyDone: false,
        occupyCity: null,
        occupyOwner: '',
        occupyBelong: 0,
        ownedBefore: 0,
        occupyEnters: 0,
        savedNoteSkip: null,
        lastOccupy: null,
        queue: [],
        sending: false
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

    function hdReady() {
        try {
            return !!(window.baye && baye.hd && typeof baye.hd.ready === 'function' && baye.hd.ready());
        } catch (e) {
            return false;
        }
    }

    function engineData() {
        if (!hdReady()) {
            return null;
        }
        if (window.baye && typeof baye.ensureData === 'function') {
            return baye.ensureData();
        }
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

    function enqueueKeys(codes, gap) {
        gap = gap || 55;
        var i;
        for (i = 0; i < codes.length; i++) {
            state.queue.push({ code: codes[i], wait: gap });
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
                engineSendKey(item.code);
                setTimeout(next, item.wait || 55);
            }, 0);
        }
        next();
    }

    function classifyFightMenu(names) {
        var list = [];
        var i;
        for (i = 0; i < (names || []).length; i++) {
            if (names[i]) {
                list.push(names[i]);
            }
        }
        if (!list.length) {
            return null;
        }
        if (list[0] === '回合结束' && list.indexOf('全军撤退') >= 0) {
            return { kind: 'sys', title: '战场系统', names: list };
        }
        if (list.length === 1 && list[0] === '全军撤退') {
            return { kind: 'confirm', title: '确认撤退', names: list };
        }
        if (list[0] === '不看' && list.indexOf('观看') >= 0) {
            return { kind: 'look', title: '战斗动画', names: list };
        }
        if (list[0] === '快速' && list.indexOf('慢速') >= 0) {
            return { kind: 'speed', title: '移动速度', names: list };
        }
        if (list[0] === '攻击' && list.indexOf('待机') >= 0) {
            return { kind: 'act', title: '将领行动', names: list };
        }
        return null;
    }

    function readFight() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.fight === 'function') {
                return baye.hd.fight();
            }
        } catch (e) {}
        return null;
    }

    function readMenuItems() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.menuItems === 'function') {
                return baye.hd.menuItems();
            }
        } catch (e) {}
        return { names: [], index: null, count: 0 };
    }

    function menuIdleFresh() {
        return (Date.now() - (state.lastMenuIdleAt || 0)) < 1200;
    }

    function readFightMenu() {
        if (!state.open || state.preview || state.resultText) {
            return null;
        }
        var fight = readFight();
        if (!fight || !fight.active) {
            return null;
        }
        /* FgtGetFoucs 选将/走格：g_hdFightWait=1，g_hdMenuBytes 仍可能是上一份「回合结束」。 */
        if (fight.wait) {
            return null;
        }
        var items = readMenuItems();
        var skills = null;
        try {
            skills = window.baye && baye.hd && baye.hd.skills ? baye.hd.skills() : null;
        } catch (e) {}
        if (skills && skills.active && skills.names && skills.names.length) {
            return {
                kind: 'skill',
                title: '计谋',
                names: skills.names,
                index: items && items.index != null ? items.index : 0
            };
        }
        if (!items || !items.names) {
            return null;
        }
        var cls = classifyFightMenu(items.names);
        if (!cls) {
            return null;
        }
        /* 开战瞬间 wait=0，g_hdMenuBytes 可能还是「回合结束」。没进过选将就当残留。 */
        if (!state.sawWait) {
            return null;
        }
        /* 活菜单以 onMenuIdle 置位、willCloseMenu / wait 变化清位。过期 idle 不再把活着的壳藏掉。 */
        if (state.liveMenuKind !== cls.kind && !menuIdleFresh()) {
            return null;
        }
        cls.index = items.index != null ? items.index : 0;
        return cls;
    }

    function noteFightWait(fight) {
        if (!fight || !fight.active) {
            state.lastWait = 0;
            return;
        }
        var w = fight.wait ? 1 : 0;
        if (w !== state.lastWait) {
            state.lastMenuIdleAt = 0;
            state.lastMenuIdleKind = '';
            state.liveMenuKind = '';
            if (w === 1) {
                state.sawWait = true;
            }
            state.lastWait = w;
        } else if (w === 1) {
            state.sawWait = true;
        }
        if (state.pendingSys && w === 1 && !fight.over) {
            state.pendingSys = 0;
            engineSendKey(VK.EXIT);
        }
    }

    function toggleSystemMenu() {
        var fight = readFight();
        if (!fight || !fight.active || fight.over) {
            return false;
        }
        if (fightMenuLive()) {
            state.lastMenuIdleAt = 0;
            renderFightMenu();
            engineSendKey(VK.EXIT);
            return true;
        }
        if (fight.wait) {
            engineSendKey(VK.EXIT);
            return true;
        }
        /* FgtGetFoucs 还没进 GamGetMsg：记下，等 wait=1 再 EXIT。 */
        state.pendingSys = Date.now();
        return true;
    }

    function fightMenuLive() {
        return !!readFightMenu();
    }

    function pickFightMenu(index) {
        var cur = state.menuIndex;
        if (cur == null || cur < 0) {
            cur = 0;
        }
        var keys = [];
        var d = index - cur;
        var key = d > 0 ? VK.DOWN : VK.UP;
        var i;
        for (i = 0; i < Math.abs(d); i++) {
            keys.push(key);
        }
        keys.push(VK.ENTER);
        state.menuIndex = index;
        enqueueKeys(keys, 55);
    }

    function renderFightMenu() {
        var panel = el('hd-battle-menu');
        var list = el('hd-battle-menu-list');
        var title = el('hd-battle-menu-title');
        var info = readFightMenu();
        if (!panel || !list) {
            return;
        }
        if (!info) {
            state.menuKind = '';
            state.menuNames = [];
            panel.hidden = true;
            return;
        }
        state.menuKind = info.kind;
        state.menuTitle = info.title;
        state.menuNames = info.names;
        state.menuIndex = info.index;
        if (title) {
            title.textContent = info.title;
        }
        var html = '';
        var i;
        for (i = 0; i < info.names.length; i++) {
            html += '<button type="button" class="hd-battle-menu-item' +
                (i === info.index ? ' is-on' : '') +
                '" data-hd-battle-menu="' + i + '">' + info.names[i] + '</button>';
        }
        if (list.getAttribute('data-sig') !== html) {
            list.setAttribute('data-sig', html);
            list.innerHTML = html;
        } else {
            var btns = list.querySelectorAll('[data-hd-battle-menu]');
            var b;
            for (b = 0; b < btns.length; b++) {
                btns[b].classList.toggle('is-on', b === info.index);
            }
        }
        panel.hidden = false;
    }

    function eventToTile(ev) {
        var canvas = el('hd-battle-canvas');
        if (!canvas || !state.mapW || !state.mapH) {
            return null;
        }
        var rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return null;
        }
        var sx = (ev.clientX - rect.left) / rect.width * DESIGN_W;
        var sy = (ev.clientY - rect.top) / rect.height * DESIGN_H;
        var pad = 80;
        var boardW = DESIGN_W - pad * 2;
        var boardH = DESIGN_H - 160;
        var cw = boardW / state.mapW;
        var ch = boardH / state.mapH;
        var ox = pad;
        var oy = 72;
        var c = Math.floor((sx - ox) / cw);
        var r = Math.floor((sy - oy) / ch);
        if (c < 0 || r < 0 || c >= state.mapW || r >= state.mapH) {
            return null;
        }
        return { x: c, y: r };
    }

    function unitAt(x, y) {
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u.x === x && u.y === y) {
                return u;
            }
        }
        return null;
    }

    function walkFocusTo(x, y, thenEnter) {
        var fx = state.focus.x;
        var fy = state.focus.y;
        if (fx == null || fy == null) {
            if (thenEnter) {
                enqueueKeys([VK.ENTER], 50);
            }
            return;
        }
        var keys = [];
        while (fy > y) { keys.push(VK.UP); fy -= 1; }
        while (fy < y) { keys.push(VK.DOWN); fy += 1; }
        while (fx > x) { keys.push(VK.LEFT); fx -= 1; }
        while (fx < x) { keys.push(VK.RIGHT); fx += 1; }
        if (thenEnter) {
            keys.push(VK.ENTER);
        }
        enqueueKeys(keys, 45);
    }

    function clearFightBridge() {
        try {
            if (window.baye && baye.data && (!baye.hdEngineReady || baye.hdEngineReady())) {
                if (baye.data.g_hdFightOver != null) {
                    baye.data.g_hdFightOver = 0;
                }
                if (baye.data.g_hdFightActive != null) {
                    baye.data.g_hdFightActive = 0;
                }
                if (baye.data.g_hdFightWait != null) {
                    baye.data.g_hdFightWait = 0;
                }
                if (typeof baye.data.g_hdFightResultGbk === 'string') {
                    baye.data.g_hdFightResultGbk = '';
                }
            }
        } catch (e) {}
    }

    function prepareNewFight() {
        stopOccupyDrain();
        state.resultCode = 0;
        state.resultText = '';
        state.resultDismissed = false;
        state.occupyDone = false;
        state.occupyCity = null;
        state.occupyOwner = '';
        state.occupyBelong = 0;
        state.ownedBefore = 0;
        state.occupyEnters = 0;
        state.menuKind = '';
        state.menuTitle = '';
        state.menuNames = [];
        state.liveMenuKind = '';
        state.lastMenuIdleKind = '';
        state.lastMenuIdleAt = 0;
        state.lastWait = 0;
        state.sawWait = false;
        state.pendingSys = 0;
        state.lastHook = '';
        clearFightBridge();
        if (state.open) {
            closeBattle({ silent: true });
            state.resultDismissed = false;
            state.resultCode = 0;
            state.resultText = '';
        }
        applyChrome();
    }

    function readRealm() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.realm === 'function') {
                return baye.hd.realm();
            }
        } catch (e) {}
        return null;
    }

    function fightCityIndex() {
        var data = engineData();
        var idx = data && data.g_FgtParam ? readNumber(data.g_FgtParam, 'CityIndex') : null;
        if (idx != null && idx >= 0 && idx < 64) {
            return idx;
        }
        try {
            if (window.baye && baye.hd && typeof baye.hd.march === 'function') {
                var m = baye.hd.march();
                if (m && m.obj != null && Number(m.obj) >= 0 && Number(m.obj) < 64) {
                    return Number(m.obj);
                }
            }
        } catch (e) {}
        return state.occupyCity;
    }

    function cityRecord(realm, index) {
        if (!realm || !realm.cities || index == null || index < 0) {
            return null;
        }
        return realm.cities[index] || null;
    }

    function liveAsyncReport() {
        try {
            if (window.baye && baye.data) {
                var id = Number(baye.data.g_asyncActionID);
                return id === 1 || id === 2 || id === 13;
            }
        } catch (e) {}
        return false;
    }

    function liveOccupyReport() {
        var text = '';
        try {
            if (window.baye && baye.hd && typeof baye.hd.reportText === 'function') {
                text = baye.hd.reportText() || '';
            }
        } catch (e) {}
        return /占领|战胜|俘虏|遭劫|势力灭亡|拥立|归降|沦陷|我军/.test(String(text));
    }

    function functionMenuLive() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.menuItems === 'function') {
                var names = (baye.hd.menuItems() || {}).names || [];
                return names[0] === '策略结束';
            }
        } catch (e) {}
        return false;
    }

    function occupyLooksPending() {
        var realm = readRealm();
        var city = fightCityIndex();
        var rec = cityRecord(realm, city);
        var mine = realm && realm.playerBelong;
        if (state.resultCode === 1 && rec && mine && rec.belong !== mine) {
            return true;
        }
        if (liveAsyncReport() && !functionMenuLive()) {
            return true;
        }
        if (liveOccupyReport() && liveAsyncReport()) {
            return true;
        }
        return false;
    }

    function occupyLine() {
        var realm = readRealm();
        var city = fightCityIndex();
        var rec = cityRecord(realm, city);
        var bits = [];
        if (rec) {
            if (rec.owned && rec.owner) {
                bits.push(rec.name + '→' + rec.owner);
            } else if (rec.name) {
                bits.push(rec.name + (state.resultCode === 1 ? '待占领' : ''));
            }
        }
        if (realm) {
            bits.push('己方' + realm.ownedCount + '/' + realm.total);
        }
        return bits.join(' · ');
    }

    function enableNoteSkip() {
        try {
            if (window.baye && baye.data && baye.data.g_engineConfig &&
                baye.data.g_engineConfig.responseNoteOfBettle != null) {
                if (state.savedNoteSkip == null) {
                    state.savedNoteSkip = Number(baye.data.g_engineConfig.responseNoteOfBettle) || 0;
                }
                baye.data.g_engineConfig.responseNoteOfBettle = 2;
            }
        } catch (e) {}
    }

    function restoreNoteSkip() {
        try {
            if (state.savedNoteSkip != null && window.baye && baye.data &&
                baye.data.g_engineConfig && baye.data.g_engineConfig.responseNoteOfBettle != null) {
                baye.data.g_engineConfig.responseNoteOfBettle = state.savedNoteSkip;
            }
        } catch (e) {}
        state.savedNoteSkip = null;
    }

    function stopOccupyDrain() {
        if (state.occupyTimer) {
            clearTimeout(state.occupyTimer);
            state.occupyTimer = 0;
        }
        state.occupyPending = false;
        state.occupyStarted = false;
    }

    function finishOccupyDrain() {
        var realm = readRealm();
        var city = fightCityIndex();
        var rec = cityRecord(realm, city);
        if (state.occupyTimer) {
            clearTimeout(state.occupyTimer);
            state.occupyTimer = 0;
        }
        restoreNoteSkip();
        state.occupyDone = true;
        state.occupyPending = true;
        state.occupyCity = city;
        state.occupyBelong = rec ? rec.belong : 0;
        state.occupyOwner = rec ? rec.owner : '';
        state.lastOccupy = {
            city: city,
            name: rec && rec.name,
            owner: rec && rec.owner,
            belong: rec && rec.belong,
            owned: rec && rec.owned,
            ownedCount: realm && realm.ownedCount,
            total: realm && realm.total,
            result: state.resultCode
        };
        state.resultDismissed = true;
        applyChrome();
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.resetAfterFight === 'function') {
            BayeHdCityMenu.resetAfterFight();
        } else if (global.BayeHdCityMenu && typeof BayeHdCityMenu.consumeLeftoverMarch === 'function') {
            BayeHdCityMenu.consumeLeftoverMarch();
        }
        /* 先让结算横幅停住（河内→马腾 · 己方N/38），再关壳清 leftover。 */
        setTimeout(function () {
            state.occupyPending = false;
            state.occupyStarted = false;
            closeBattle({ silent: true });
            prepareNewFight();
        }, 900);
        try {
            if (global.BayeHdOverworld && typeof BayeHdOverworld.debugSnapshot === 'function') {
                /* sampleCities 在 overworld loop 里，这里只触发一次 HUD。 */
            }
        } catch (e) {}
        console.log('[hd-battle] occupy-done', {
            city: city,
            name: rec && rec.name,
            owner: rec && rec.owner,
            belong: rec && rec.belong,
            owned: realm && realm.ownedCount,
            total: realm && realm.total
        });
    }

    function startOccupyDrain() {
        if (state.occupyStarted || state.occupyDone) {
            return;
        }
        state.occupyStarted = true;
        state.occupyPending = true;
        state.lastMenuIdleAt = 0;
        if (!state.ownedBefore) {
            var before = readRealm();
            state.ownedBefore = before ? before.ownedCount : 0;
        }
        enableNoteSkip();
        engineSendKey(VK.ENTER);
        state.occupyEnters = 1;
        var started = Date.now();
        function tick() {
            state.occupyTimer = 0;
            var f = null;
            try { f = readFight(); } catch (e) {}
            if (f && f.active && !f.over) {
                state.occupyTimer = setTimeout(tick, 200);
                return;
            }
            if (occupyLooksPending() && Date.now() - started < 9000 && state.occupyEnters < 28) {
                if (!functionMenuLive()) {
                    engineSendKey(VK.ENTER);
                    state.occupyEnters += 1;
                }
                applyChrome();
                state.occupyTimer = setTimeout(tick, 200);
                return;
            }
            finishOccupyDrain();
        }
        state.occupyTimer = setTimeout(tick, 180);
        applyChrome();
    }

    function dismissResult() {
        startOccupyDrain();
    }

    function fightLooksActive() {
        var data = engineData();
        if (data && Number(data.g_hdFightActive)) {
            return true;
        }
        if (state.resultText) {
            return true;
        }
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
        var mw = readNumber(data, 'g_MapWid');
        var mh = readNumber(data, 'g_MapHgt');
        var map = data.g_FightMapData && data.g_FightMapData.length ? data.g_FightMapData : data.g_FightMap;
        if (mw && mh) {
            info.mapW = mw;
            info.mapH = mh;
            info.mapLen = mw * mh;
        } else if (map && map.length) {
            info.mapLen = map.length;
            var sz = inferMapSize(info.mapLen);
            info.mapW = sz.w;
            info.mapH = sz.h;
        }
        if (map && info.mapW && info.mapH) {
            var t;
            var lim = Math.min(map.length || 0, info.mapW * info.mapH);
            for (t = 0; t < lim; t++) {
                var tv = readNumber(map, t);
                if (tv === null && map[t] != null) {
                    tv = Number(map[t]);
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
            if (!id || id >= 0xfffe) {
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
        document.documentElement.setAttribute('data-baye-battle-menu',
            (show && state.menuKind) ? state.menuKind : 'off');
        var hud = el('hd-battle-hud');
        if (hud) {
            var over = 0;
            try {
                if (window.baye && baye.data && baye.data.g_hdFightOver != null) {
                    over = Number(baye.data.g_hdFightOver) || 0;
                }
            } catch (e) {}
            hud.textContent = (state.preview ? 'HD 战场预览 · ' : 'HD 战场 · ') +
                (state.lastHook || '无 hook') +
                ' · 将=' + state.units.length +
                ' · 图=' + (state.mapW ? (state.mapW + '×' + state.mapH) : '无') +
                (state.resultText ? ' · ' + state.resultText : (over ? ' · 结束码=' + over : '')) +
                (occupyLine() ? ' · ' + occupyLine() : '');
        }
        var banner = el('hd-battle-result');
        if (banner) {
            if (state.resultText) {
                var occ = occupyLine();
                banner.hidden = false;
                banner.textContent = state.resultText +
                    (state.resultCode ? '  (' + state.resultCode + ')' : '') +
                    (occ ? '  ·  ' + occ : '');
            } else {
                banner.hidden = true;
                banner.textContent = '';
            }
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
        noteFightWait(readFight());
        renderFightMenu();
        applyChrome();
        draw();
    }

    function loop() {
        if (!state.open) {
            state.loopId = 0;
            return;
        }
        refresh();
        if (!state.preview && !fightLooksActive() && !state.resultText &&
            state.lastHook && (Date.now() - state.lastHookAt) > 16000) {
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
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        var already = state.open && !state.preview && !meta.preview;
        var fresh = meta.hook === 'enterBattle' || meta.hook === 'g_hdFightActive';
        state.open = true;
        state.preview = !!meta.preview;
        if (!meta.keepResult && (!already || fresh)) {
            state.resultCode = 0;
            state.resultText = '';
            state.resultDismissed = false;
        }
        if (!already || fresh) {
            state.lastMenuIdleAt = 0;
            state.lastMenuIdleKind = '';
            state.liveMenuKind = '';
            state.lastWait = 0;
            state.sawWait = false;
            state.pendingSys = 0;
            state.menuKind = '';
        }
        if (meta.hook) {
            state.lastHook = meta.hook;
            state.lastHookAt = Date.now();
        }
        if (!state.preview) {
            state.showLcd = false;
        }
        applyChrome();
        refresh();
        ensureLoop();
        console.log('[hd-battle] enter', meta.hook || (state.preview ? 'preview' : 'detect'));
        return true;
    }

    function closeBattle(opts) {
        opts = opts || {};
        if (state.resultText || state.resultCode) {
            state.resultDismissed = true;
        }
        state.open = false;
        state.preview = false;
        state.menuKind = '';
        state.menuNames = [];
        state.lastMenuIdleAt = 0;
        state.lastMenuIdleKind = '';
        state.liveMenuKind = '';
        state.lastWait = 0;
        state.sawWait = false;
        state.pendingSys = 0;
        var menu = el('hd-battle-menu');
        if (menu) {
            menu.hidden = true;
        }
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
        if (name === 'onMenuIdle') {
            var names = readMenuItems().names || [];
            var cls = classifyFightMenu(names);
            if (cls && state.open) {
                var fight = readFight();
                if (fight && fight.active && !fight.wait && state.sawWait) {
                    state.lastMenuIdleAt = Date.now();
                    state.lastMenuIdleKind = cls.kind;
                    state.liveMenuKind = cls.kind;
                    renderFightMenu();
                }
            }
            return;
        }
        if (name === 'willCloseMenu') {
            state.lastMenuIdleAt = 0;
            state.lastMenuIdleKind = '';
            state.liveMenuKind = '';
            if (state.open) {
                renderFightMenu();
            }
            return;
        }
        if (!FIGHT_HOOKS[name]) {
            return;
        }
        state.lastHook = name;
        state.lastHookAt = Date.now();
        if (name === 'exitBattle') {
            onEngineFight();
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
                if (t.getAttribute && t.getAttribute('data-hd-battle-sys') != null) {
                    ev.preventDefault();
                    toggleSystemMenu();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-battle-menu-exit') != null) {
                    ev.preventDefault();
                    if (fightMenuLive()) {
                        state.lastMenuIdleAt = 0;
                        renderFightMenu();
                        engineSendKey(VK.EXIT);
                    } else {
                        state.lastMenuIdleAt = 0;
                        renderFightMenu();
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-battle-menu') != null) {
                    ev.preventDefault();
                    if (!fightMenuLive()) {
                        state.lastMenuIdleAt = 0;
                        renderFightMenu();
                        return;
                    }
                    pickFightMenu(Number(t.getAttribute('data-hd-battle-menu')));
                    return;
                }
                if (t.id === 'hd-battle-result' && state.resultText) {
                    ev.preventDefault();
                    dismissResult();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-battle-close') != null) {
                    ev.preventDefault();
                    if (state.resultText) {
                        dismissResult();
                        return;
                    }
                    closeBattle({ silent: false });
                    return;
                }
                t = t.parentNode;
            }
            if (ev.target && ev.target.id === 'hd-battle-canvas') {
                var fight = readFight();
                if (state.resultText) {
                    dismissResult();
                    return;
                }
                if (fightMenuLive()) {
                    return;
                }
                var tile = eventToTile(ev);
                if (!tile) {
                    return;
                }
                ev.preventDefault();
                var u = unitAt(tile.x, tile.y);
                walkFocusTo(tile.x, tile.y, !!(fight && fight.wait && u && u.side === 'player'));
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

    function onEngineFight() {
        var info = null;
        try {
            info = window.baye && baye.hd && baye.hd.fight ? baye.hd.fight() : null;
        } catch (e) {}
        if (info && info.active) {
            /* Live fight never inherits leftover 全军覆没 from the previous battle. */
            if (info.over) {
                try {
                    if (window.baye && baye.data && baye.data.g_hdFightOver != null &&
                        (!baye.hdEngineReady || baye.hdEngineReady())) {
                        baye.data.g_hdFightOver = 0;
                    }
                } catch (e) {}
                info.over = 0;
            }
            var leftover = !!(state.resultDismissed || state.resultText || state.resultCode);
            if (leftover) {
                state.resultDismissed = false;
                state.resultText = '';
                state.resultCode = 0;
            }
            if (shouldShowHd() && (!state.open || leftover)) {
                enterBattle({ hook: 'g_hdFightActive' });
            }
        }
        if (info && info.over && !info.active) {
            if (state.occupyDone || state.resultDismissed) {
                return;
            }
            state.resultCode = info.over;
            state.resultText = info.result || (info.over === 1 ? '我军大获全胜' : (info.over === 2 ? '我军全军覆没' : ''));
            state.lastHook = 'exitBattle';
            state.lastHookAt = Date.now();
            if (info.cityIndex != null) {
                state.occupyCity = info.cityIndex;
            }
            if (!state.open && shouldShowHd()) {
                enterBattle({ hook: 'exitBattle', keepResult: true });
            }
            /* 胜负报告出来时 C 已进 FightResultDeal。必须回车走完
             * ShowFightWinNote / BeOccupied / 俘虏框，不能 280ms 关壳。 */
            startOccupyDrain();
        }
        if (state.open) {
            refresh();
        }
    }

    function start() {
        bindUi();
        applyChrome();
        setInterval(function () {
            if (!hdReady() || !shouldShowHd()) {
                return;
            }
            var d = engineData();
            var f = null;
            try { f = baye.hd && baye.hd.fight ? baye.hd.fight() : null; } catch (e) {}
            if (d && Number(d.g_hdFightActive)) {
                if (f && f.over) {
                    try {
                        if (d.g_hdFightOver != null && (!baye.hdEngineReady || baye.hdEngineReady())) {
                            d.g_hdFightOver = 0;
                        }
                    } catch (e) {}
                    f.over = 0;
                }
                var leftover = !!(state.resultDismissed || state.resultText);
                if (leftover) {
                    state.resultDismissed = false;
                    state.resultText = '';
                    state.resultCode = 0;
                }
                if (!state.open || leftover) {
                    enterBattle({ hook: 'g_hdFightActive' });
                }
            }
            if (state.open && state.resultDismissed && !state.occupyPending && (!f || !f.active || f.over)) {
                closeBattle({ silent: true });
                return;
            }
            if (state.open) {
                if (f && f.over && !state.resultText && !state.occupyDone) {
                    onEngineFight();
                }
            }
        }, 220);
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
        prepareNewFight: prepareNewFight,
        onEngineHook: onEngineHook,
        onEngineFight: onEngineFight,
        clickOwnUnit: function () {
            var fight = readFight();
            var i;
            for (i = 0; i < state.units.length; i++) {
                var u = state.units[i];
                if (u && u.side === 'player' && u.x != null && u.y != null) {
                    walkFocusTo(u.x, u.y, !!(fight && fight.wait));
                    return { x: u.x, y: u.y, i: u.i, wait: !!(fight && fight.wait) };
                }
            }
            return null;
        },
        openSystemMenu: toggleSystemMenu,
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
                unitList: state.units.slice(0, 8).map(function (u) {
                    return { i: u.i, name: u.name, x: u.x, y: u.y, side: u.side };
                }),
                mapW: state.mapW,
                mapH: state.mapH,
                genCount: fightArrayCount(),
                focus: state.focus,
                resultCode: state.resultCode,
                resultText: state.resultText,
                menuKind: state.menuKind,
                menuTitle: state.menuTitle,
                menuNames: state.menuNames.slice(),
                menuIndex: state.menuIndex,
                menuLive: fightMenuLive(),
                menuIdleAge: state.lastMenuIdleAt ? (Date.now() - state.lastMenuIdleAt) : null,
                liveMenuKind: state.liveMenuKind,
                sawWait: state.sawWait,
                pendingSys: state.pendingSys,
                resultDismissed: state.resultDismissed,
                occupyPending: state.occupyPending,
                occupyDone: state.occupyDone,
                occupyCity: state.occupyCity,
                occupyOwner: state.occupyOwner,
                occupyEnters: state.occupyEnters,
                lastOccupy: state.lastOccupy,
                realm: readRealm(),
                skills: (function () {
                    try { return window.baye && baye.hd && baye.hd.skills ? baye.hd.skills() : null; }
                    catch (e) { return null; }
                }())
            };
        }
    };
})(window);
