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
    var HD_BATTLE_VER = '20260922n';
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
    /* 角标只由本文件运行时常量上色。HTML 不得预写版本，否则缓存的旧 hd-battle.js 也能显示新号。 */
    function paintRuntimeBadge() {
        try {
            global.BAYE_ASSET_VER = HD_BATTLE_VER;
            global.HD_BATTLE_VER = HD_BATTLE_VER;
            var src = '';
            try {
                if (document.currentScript && document.currentScript.src) {
                    src = String(document.currentScript.src);
                }
            } catch (eCur) {}
            if (!src) {
                var scripts = document.getElementsByTagName('script');
                var si;
                for (si = 0; si < scripts.length; si++) {
                    var href = scripts[si] && scripts[si].src;
                    if (href && /hd-battle\.js/i.test(href)) {
                        src = String(href);
                    }
                }
            }
            var urlVer = '';
            var m = src.match(/[?&]ver=([^&#]+)/);
            if (m) {
                try { urlVer = decodeURIComponent(m[1]); } catch (eDec) { urlVer = m[1]; }
            }
            var badgeEl = global.document && document.getElementById('baye-build-badge');
            if (badgeEl) {
                var mismatch = !!(urlVer && urlVer !== HD_BATTLE_VER);
                badgeEl.textContent = mismatch ? ('MISMATCH ' + urlVer + '/' + HD_BATTLE_VER) : HD_BATTLE_VER;
                badgeEl.setAttribute('data-baye-asset-ver', HD_BATTLE_VER);
                badgeEl.setAttribute('data-hd-script-src', src);
                badgeEl.setAttribute('data-hd-script-ver', urlVer || '');
                badgeEl.style.background = mismatch ? '#5a1a1a' : '#1a3a22';
                badgeEl.style.color = mismatch ? '#ffd0d0' : '#b8f0c2';
            }
        } catch (eBadge) {}
    }
    paintRuntimeBadge();
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
        viewOx: 0,
        viewOy: 0,
        viewW: 0,
        viewH: 0,
        tileW: 0,
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
        needWaitBeforeMenu: false,
        menuArmLogged: false,
        lastRestAt: 0,
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
        occupySettledAt: 0,
        savedNoteSkip: null,
        lastOccupy: null,
        settledOver: 0,
        forcedOverPoke: 0,
        queue: [],
        sending: false,
        fightTip: '',
        lastInvalidAt: 0,
        lastBlockedEnter: '',
        pendingActPick: null,
        pendingApproach: null,
        lastAutoActAt: 0,
        autoActTries: 0,
        drivingAct: false,
        refreshing: false,
        pickingMenu: false,
        clickingTile: false,
        stackDepth: 0,
        driveTimer: 0,
        samplingFight: false,
        readingEngine: false,
        strictLive: false,
        refreshStackLogged: false,
        lastRefreshStack: '',
        readDepth: 0
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
        if (!obj || state.readDepth > 8) {
            return null;
        }
        state.readDepth += 1;
        try {
            if (obj[name] === undefined || obj[name] === null) {
                return null;
            }
            var v = obj[name];
            if (v && typeof v === 'object' && 'value' in v) {
                v = v.value;
            }
            v = Number(v);
            return isFinite(v) ? v : null;
        } catch (eRead) {
            return null;
        } finally {
            state.readDepth -= 1;
        }
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

    function cityMenuOpen() {
        try {
            return !!(global.BayeHdCityMenu &&
                typeof BayeHdCityMenu.isOpen === 'function' &&
                BayeHdCityMenu.isOpen());
        } catch (e) {
            return false;
        }
    }

    function cityMenuOwnsScreen() {
        return cityMenuOpen() && !state.strictLive && !fightEngineActiveRaw();
    }

    function titleOrOpeningScreen() {
        try {
            if (global.BayeHdSpe && typeof BayeHdSpe.isOpen === 'function' &&
                BayeHdSpe.isOpen()) {
                return true;
            }
            if (global.BayeHdSpe && typeof BayeHdSpe.isHandling === 'function' &&
                BayeHdSpe.isHandling()) {
                return true;
            }
        } catch (eSpe) {}
        try {
            if (global.BayeHdSystemUi && typeof BayeHdSystemUi.isOpen === 'function' &&
                BayeHdSystemUi.isOpen()) {
                var scr = '';
                try {
                    scr = BayeHdSystemUi.getScreen ? String(BayeHdSystemUi.getScreen() || '') : '';
                } catch (eScr) {}
                if (!scr || scr === 'title' || scr === 'period' || scr === 'king') {
                    return true;
                }
            }
        } catch (eSys) {}
        try {
            if (!hdReady()) {
                return true;
            }
            var data = window.baye && baye.data;
            if (!data) {
                return true;
            }
            var king = Number(data.g_PlayerKing);
            var year = Number(data.g_YearDate);
            if (!isFinite(king) || king <= 0) {
                return true;
            }
            if (!isFinite(year) || year < 180) {
                return true;
            }
        } catch (eData) {
            return true;
        }
        return false;
    }

    function fightEngineActiveRaw() {
        var f = null;
        try {
            f = readFight();
        } catch (e) {
            return false;
        }
        if (!f) {
            return false;
        }
        var active = Number(f.active);
        var over = Number(f.over);
        if (!isFinite(active) || !active) {
            return false;
        }
        if (isFinite(over) && over) {
            return false;
        }
        return true;
    }

    /* 标题/开场/城菜单/不确定一律否。只认 fight().active && !over，不信 leftover 旗标。 */
    function fightStrictActive() {
        if (state.readingEngine && !state.samplingFight) {
            return false;
        }
        if (titleOrOpeningScreen()) {
            state.strictLive = false;
            return false;
        }
        if (state.samplingFight) {
            return !!state.strictLive;
        }
        state.readingEngine = true;
        try {
            var live = fightEngineActiveRaw();
            if (!live && cityMenuOpen()) {
                state.strictLive = false;
                return false;
            }
            state.strictLive = live;
            return !!live;
        } catch (e) {
            state.strictLive = false;
            return false;
        } finally {
            state.readingEngine = false;
        }
    }

    function fightReallyActive() {
        return fightStrictActive();
    }

    function logRefreshStackOnce(err) {
        var s = '';
        try {
            s = String((err && err.stack) || err || '');
        } catch (eS) {
            s = 'refresh-stack-unreadable';
        }
        state.lastRefreshStack = s;
        if (!state.refreshStackLogged) {
            state.refreshStackLogged = true;
            try {
                console.error('[hd-battle] refresh-stack', s);
            } catch (eLog) {}
        }
    }

    function fightArrayCount() {
        if (!state.samplingFight && !fightStrictActive()) {
            return 0;
        }
        var data = engineData();
        var arr = data && data.g_FgtParam && data.g_FgtParam.GenArray;
        if (!arr) {
            return 0;
        }
        var n = 0;
        var i;
        var len = Number(arr.length);
        if (!isFinite(len) || len < 0) {
            len = 20;
        }
        for (i = 0; i < len && i < 24; i++) {
            var id = readNumber(arr, i);
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
        return (Date.now() - (state.lastMenuIdleAt || 0)) < 1600;
    }

    function peekFightMenuClass() {
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
        cls.index = items.index != null ? items.index : 0;
        return cls;
    }

    function clearLiveFightMenu() {
        state.lastMenuIdleAt = 0;
        state.lastMenuIdleKind = '';
        state.liveMenuKind = '';
    }

    function clearEngineMenuLeftover() {
        try {
            if (window.baye && baye.data && (!baye.hdEngineReady || baye.hdEngineReady())) {
                if (baye.data.g_hdMenuCount != null) {
                    baye.data.g_hdMenuCount = 0;
                }
            }
        } catch (e) {}
    }

    function rearmFightMenuFromBytes() {
        var cls = peekFightMenuClass();
        if (!cls) {
            return null;
        }
        state.liveMenuKind = cls.kind;
        state.lastMenuIdleKind = cls.kind;
        state.lastMenuIdleAt = Date.now();
        state.sawWait = true;
        state.needWaitBeforeMenu = false;
        return cls;
    }

    function syntheticActMenu() {
        return {
            kind: 'act',
            title: '将领行动',
            names: ['攻击', '计谋', '查看', '待机'],
            index: 0,
            synthetic: true
        };
    }

    function playerHasWaitingOwn() {
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u && u.side === 'player' && (u.active === 0 || u.active == null) &&
                u.x != null && u.y != null) {
                return true;
            }
        }
        return false;
    }

    function walkingTiles(fight) {
        var phase = Number(fight && fight.phase) || 0;
        return !!(fight && fight.wait && phase === 2 &&
            (state.pendingApproach || wantsWalkBeforeAct(state.pendingActPick)));
    }

    function aimingTiles(fight) {
        return !!(fight && Number(fight.phase) === 3);
    }

    /* 只要还有己方未行动，菜单必须能点。待机后 leftover wait=1/phase=2 不得再藏死。 */
    function shouldShowActMenu(fight) {
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (aimingTiles(fight) || walkingTiles(fight)) {
            return false;
        }
        if (playerHasWaitingOwn()) {
            return true;
        }
        var phase = Number(fight.phase) || 0;
        return phase === 0 || phase === 1;
    }

    function logMenuProbe(why) {
        var fight = null;
        var panel = null;
        var items = { names: [], count: 0 };
        try { fight = readFight(); } catch (eF) {}
        try { panel = el('hd-battle-menu'); } catch (eP) {}
        try { items = readMenuItems(); } catch (eI) {}
        var rec = {
            why: why,
            wait: fight ? !!fight.wait : null,
            phase: fight ? fight.phase : null,
            active: fight ? !!fight.active : false,
            over: fight ? !!fight.over : false,
            menuCount: 0,
            menuBytes: (items && items.names) || [],
            needWaitBeforeMenu: !!state.needWaitBeforeMenu,
            fightStrictActive: false,
            fakeMenu: false,
            panelId: 'hd-battle-menu',
            hidden: !!(panel && panel.hidden),
            display: '',
            leftoverCity: false,
            leftoverDlg: false
        };
        try { rec.menuCount = Number(window.baye && baye.data && baye.data.g_hdMenuCount) || 0; } catch (eC) {}
        try { rec.fightStrictActive = !!fightStrictActive(); } catch (eS) {}
        try { rec.fakeMenu = !!playerTurnWaiting(fight); } catch (eW) {}
        try { rec.display = panel ? String((global.getComputedStyle(panel) || {}).display || '') : ''; } catch (eD) {}
        try {
            rec.leftoverCity = !!(global.BayeHdCityMenu && BayeHdCityMenu.isOpen && BayeHdCityMenu.isOpen());
        } catch (eCity) {}
        try {
            rec.leftoverDlg = !!(global.BayeHdDialog && BayeHdDialog.isOpen && BayeHdDialog.isOpen());
        } catch (eDlg) {}
        try {
            console.log('[hd-battle] menu-probe', rec);
        } catch (eLog) {}
        return rec;
    }

    function playerTurnWaiting(fight) {
        if (!shouldShowActMenu(fight)) {
            return false;
        }
        var cls = peekFightMenuClass();
        if (cls && (cls.kind === 'act' || cls.kind === 'skill') && fight && !fight.wait) {
            return false;
        }
        return true;
    }

    function resetActDrive() {
        state.pendingActPick = null;
        state.pendingApproach = null;
        state.lastAutoActAt = 0;
        state.autoActTries = 0;
        state.drivingAct = false;
        state.pickingMenu = false;
        state.clickingTile = false;
        if (state.driveTimer) {
            clearTimeout(state.driveTimer);
            state.driveTimer = 0;
        }
    }

    function scheduleDrive(why) {
        if (state.refreshing || state.samplingFight || state.readingEngine) {
            return;
        }
        if (state.driveTimer) {
            return;
        }
        if (!fightReallyActive() || cityMenuOwnsScreen()) {
            resetActDrive();
            return;
        }
        state.driveTimer = setTimeout(function () {
            state.driveTimer = 0;
            runScheduledDrive(why || 'tick');
        }, 0);
    }

    function runScheduledDrive(why) {
        if (!fightReallyActive() || cityMenuOwnsScreen()) {
            resetActDrive();
            return;
        }
        if (state.refreshing || state.clickingTile || state.drivingAct || state.samplingFight) {
            scheduleDrive(why || 'busy');
            return;
        }
        if (!enterStack('runScheduledDrive')) {
            console.warn('[hd-battle] stack-guard drop', why);
            return;
        }
        try {
            if (state.pendingActPick != null && !state.pendingApproach &&
                wantsWalkBeforeAct(state.pendingActPick)) {
                var fight0 = readFight();
                var phase0 = fight0 ? (Number(fight0.phase) || 0) : 0;
                if (phase0 === 2) {
                    var foe = nearestEnemy();
                    if (foe) {
                        state.pendingApproach = { x: foe.x, y: foe.y };
                    }
                }
            }
            if (state.pendingApproach) {
                driveApproach();
                return;
            }
            if (state.pendingActPick != null) {
                drivePlayerToActMenu();
            }
        } finally {
            leaveStack();
        }
    }

    function enterStack(name) {
        if (state.stackDepth >= 4) {
            console.warn('[hd-battle] stack-guard', name, state.stackDepth);
            return false;
        }
        state.stackDepth += 1;
        return true;
    }

    function leaveStack() {
        if (state.stackDepth > 0) {
            state.stackDepth -= 1;
        }
    }

    function wantsWalkBeforeAct(index) {
        /* 攻击/计谋要先走格靠近；查看/待机可以原地落定。 */
        return index === 0 || index === 1;
    }

    function whyMenuHidden() {
        var fight = readFight();
        var panel = el('hd-battle-menu');
        var items = readMenuItems();
        var cls = peekFightMenuClass();
        var reasons = [];
        var waiting = playerTurnWaiting(fight);
        if (!state.open) {
            reasons.push('not-open');
        }
        if (state.preview) {
            reasons.push('preview');
        }
        if (state.resultText) {
            reasons.push('result');
        }
        if (!fight || !fight.active) {
            reasons.push('fight-inactive');
        }
        if (fight && fight.wait) {
            reasons.push('wait=1');
        }
        if (fight && fight.over) {
            reasons.push('over');
        }
        if (!cls) {
            reasons.push('no-class');
        } else {
            reasons.push('class=' + cls.kind);
        }
        if (state.needWaitBeforeMenu) {
            reasons.push('needWaitBeforeMenu');
        }
        if (!state.sawWait) {
            reasons.push('!sawWait');
        }
        if (waiting) {
            reasons.push('player-turn-waiting-synthetic');
        }
        if (panel && panel.hidden) {
            reasons.push('panel-hidden');
        }
        var cs = null;
        try {
            cs = panel ? global.getComputedStyle(panel) : null;
        } catch (eCs) {}
        if (cs) {
            if (cs.display === 'none') {
                reasons.push('css-display-none');
            }
            if (cs.visibility === 'hidden') {
                reasons.push('css-visibility-hidden');
            }
            if (cs.pointerEvents === 'none' && !panel.hidden) {
                reasons.push('css-pointer-events-none');
            }
            if (Number(cs.opacity) === 0) {
                reasons.push('css-opacity-0');
            }
        }
        var count = 0;
        try {
            count = Number(window.baye && baye.data && baye.data.g_hdMenuCount) || 0;
        } catch (e) {}
        return {
            reasons: reasons,
            wait: fight ? !!fight.wait : null,
            phase: fight ? fight.phase : null,
            active: fight ? !!fight.active : false,
            over: fight ? !!fight.over : false,
            menuCount: count,
            menuNames: (items && items.names) || [],
            liveMenuKind: state.liveMenuKind,
            needWaitBeforeMenu: state.needWaitBeforeMenu,
            sawWait: state.sawWait,
            pendingActPick: state.pendingActPick,
            panelHidden: !!(panel && panel.hidden),
            footerOnly: !!(panel && panel.hidden && state.open),
            armed: !!(state.liveMenuKind || waiting),
            synthetic: waiting,
            css: cs ? {
                display: cs.display,
                visibility: cs.visibility,
                pointerEvents: cs.pointerEvents,
                zIndex: cs.zIndex,
                opacity: cs.opacity
            } : null
        };
    }

    function clickWaitingOwn() {
        if (!fightReallyActive() || cityMenuOwnsScreen()) {
            return null;
        }
        if (state.refreshing || state.samplingFight) {
            return null;
        }
        if (state.clickingTile) {
            scheduleDrive('pick-own-busy');
            return null;
        }
        var i;
        var fallback = null;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'player' || u.x == null || u.y == null) {
                continue;
            }
            if (u.active === 0 || u.active == null) {
                return clickBattleTile(u.x, u.y);
            }
            if (!fallback) {
                fallback = u;
            }
        }
        if (fallback) {
            return clickBattleTile(fallback.x, fallback.y);
        }
        return null;
    }

    function drivePlayerToActMenu() {
        if (state.drivingAct) {
            return false;
        }
        if (!enterStack('drivePlayerToActMenu')) {
            return false;
        }
        try {
        /* 只在玩家点了将领行动项后才选将/落定。开战第一帧只画菜单，不自动待机。 */
        if (state.pendingActPick == null) {
            return false;
        }
        if (!wantsWalkBeforeAct(state.pendingActPick)) {
            /* 查看/待机绝不再走近，避免 refresh→driveApproach 把待机点成走格。 */
            state.pendingApproach = null;
        }
        var fight = readFight();
        if (!fight || !fight.active || fight.over || state.resultText) {
            resetActDrive();
            return false;
        }
        if (!fight.wait) {
            recoverFightMenu(fight);
            var live = readFightMenu();
            if (live && !live.synthetic) {
                var idx = state.pendingActPick;
                state.pendingActPick = null;
                state.autoActTries = 0;
                pickFightMenu(idx);
                return true;
            }
            return false;
        }
        var phase = Number(fight.phase) || 0;
        if (phase === 3) {
            return false;
        }
        if (phase === 2 && wantsWalkBeforeAct(state.pendingActPick)) {
            /* 点「攻击」后停在 FgtGenMove。超距就走近再打，绝不原地回车进瞄准。 */
            if (!state.pendingApproach) {
                var foe = nearestEnemy();
                if (foe) {
                    state.pendingApproach = { x: foe.x, y: foe.y };
                }
            }
            scheduleDrive('act-approach');
            return true;
        }
        if (state.sending || state.queue.length) {
            return false;
        }
        if (Date.now() - (state.lastAutoActAt || 0) < 220) {
            scheduleDrive('act-throttle');
            return false;
        }
        if (state.autoActTries > 8) {
            return false;
        }
        state.lastAutoActAt = Date.now();
        state.autoActTries += 1;
        if (phase === 2) {
            enqueueKeys([VK.ENTER], 55);
            return true;
        }
        state.drivingAct = true;
        setTimeout(function () {
            try {
                clickWaitingOwn();
            } finally {
                state.drivingAct = false;
            }
        }, 0);
        return true;
        } finally {
            leaveStack();
        }
    }

    function nearestEnemy() {
        var actor = syncFocusFromEngine();
        var best = null;
        var bestD = 99;
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'enemy' || u.x == null || u.y == null) {
                continue;
            }
            var d = chebyshev(actor.x, actor.y, u.x, u.y);
            if (!best || d < bestD) {
                best = u;
                bestD = d;
            }
        }
        return best;
    }

    function driveApproach() {
        if (!fightReallyActive() || cityMenuOwnsScreen()) {
            resetActDrive();
            return false;
        }
        if (state.refreshing || state.samplingFight) {
            return false;
        }
        if (state.drivingAct || !state.pendingApproach) {
            return false;
        }
        if (!wantsWalkBeforeAct(state.pendingActPick) && state.pendingActPick != null) {
            state.pendingApproach = null;
            return false;
        }
        if (!enterStack('driveApproach')) {
            state.pendingApproach = null;
            return false;
        }
        try {
        var fight = readFight();
        if (!fight || !fight.active || fight.over || !fight.wait) {
            return false;
        }
        if (state.sending || state.queue.length) {
            return false;
        }
        var phase = Number(fight.phase) || 0;
        var dest = state.pendingApproach;
        if (phase === 2) {
            state.pendingApproach = null;
            /* 走格一旦提交，把「攻击」意图交给落点后的真菜单，才能点待机。 */
            if (wantsWalkBeforeAct(state.pendingActPick)) {
                state.pendingActPick = null;
            }
            var actor = syncFocusFromEngine();
            var closer = findCloserMoveTile(actor.x, actor.y, dest.x, dest.y);
            if (closer) {
                console.log('[hd-battle] approach walk', dest, 'via', closer);
                walkFocusTo(closer.x, closer.y, true);
                return true;
            }
            /* 已贴脸或无更近格：落定当前格，随后 pendingActPick 选攻击。 */
            enqueueKeys([VK.ENTER], 55);
            return true;
        }
        if (phase === 1 || phase === 0) {
            /* 选将只异步点己方，禁止 click→refresh→driveApproach 同步爆栈。 */
            if (Date.now() - (state.lastAutoActAt || 0) < 80) {
                scheduleDrive('approach-pick-throttle');
                return false;
            }
            state.lastAutoActAt = Date.now();
            state.drivingAct = true;
            setTimeout(function () {
                try {
                    clickWaitingOwn();
                } finally {
                    state.drivingAct = false;
                    scheduleDrive('after-pick');
                }
            }, 0);
            return true;
        }
        return false;
        } finally {
            leaveStack();
        }
    }

    function recoverFightMenu(fight) {
        if (!state.open || state.preview || state.resultText) {
            return null;
        }
        fight = fight || readFight();
        if (!fight || !fight.active || fight.wait || fight.over) {
            return null;
        }
        var cls = peekFightMenuClass();
        if (!cls || (cls.kind !== 'act' && cls.kind !== 'skill')) {
            return null;
        }
        /* 活战 wait=0 的攻击/待机就是 PlcSplMenu。willCloseMenu 的 needWait 不得藏菜单。 */
        if (state.liveMenuKind !== cls.kind) {
            console.log('[hd-battle] recover act menu', cls.kind, cls.names);
        }
        return rearmFightMenuFromBytes();
    }

    function readFightMenu() {
        if (!state.open || state.preview || state.resultText) {
            return null;
        }
        var fight = readFight();
        if (!fight || !fight.active) {
            return null;
        }
        /* 盒子开战停在 FgtGetFoucs wait=1，不会点棋盘。假「将领行动」必须第一帧就画出来。 */
        if (playerTurnWaiting(fight)) {
            return syntheticActMenu();
        }
        /* 真在走格/瞄准才藏。待机后 leftover wait=1 不得再一刀切 return null。 */
        if (fight.wait && !shouldShowActMenu(fight)) {
            return null;
        }
        var cls = peekFightMenuClass();
        if (!cls) {
            return null;
        }
        if (cls.kind === 'act' || cls.kind === 'skill') {
            /* PlcSplMenu 的 onMenuIdle 只在开菜单时打一次。wait=0 的攻击/待机直接武装，
             * 不靠 sawWait / liveMenuKind / needWaitBeforeMenu（走格后 willCloseMenu 会把后两样清掉）。 */
            if (state.liveMenuKind !== cls.kind) {
                rearmFightMenuFromBytes();
            }
            return cls;
        }
        /* 开战瞬间 wait=0，g_hdMenuBytes 可能还是「回合结束」。没进过选将就当残留。 */
        if (!state.sawWait) {
            return null;
        }
        if (state.liveMenuKind !== cls.kind && !menuIdleFresh()) {
            return null;
        }
        return cls;
    }

    function noteFightWait(fight) {
        if (!fight || !fight.active) {
            state.lastWait = 0;
            return;
        }
        var w = fight.wait ? 1 : 0;
        if (w !== state.lastWait) {
            if (w === 1) {
                /* 进选将/走格/瞄准：上一份行动菜单必须藏掉，否则挡棋盘点击。 */
                clearLiveFightMenu();
                state.sawWait = true;
                state.fightTip = '';
                dropQueuedEnters();
                /* 选将（phase 1）是新的一将；瞄准/走格不要放开 willCloseMenu 的残留武装。 */
                if ((Number(fight.phase) || 0) <= 1) {
                    state.needWaitBeforeMenu = false;
                }
            }
            /* wait 1→0：不要清 liveMenuKind。PlcSplMenu 的 onMenuIdle 往往已在
             * 本帧置位，清掉会让马超「将领行动」下一帧藏死、点击无响应。 */
            state.lastWait = w;
        } else if (w === 1) {
            state.sawWait = true;
        }
        if (state.pendingSys && w === 1 && !fight.over) {
            /* leftover 大地图 EXIT 不能打进瞄准/走格，否则取消命令或报命令无效。 */
            var phase = Number(fight.phase) || 0;
            if (phase === 1 || !phase) {
                state.pendingSys = 0;
                engineSendKey(VK.EXIT);
            } else {
                state.pendingSys = 0;
            }
        }
    }

    function toggleSystemMenu() {
        var fight = readFight();
        if (!fight || !fight.active || fight.over) {
            return false;
        }
        if (fightMenuLive()) {
            var sysInfo = readFightMenu();
            if (sysInfo && sysInfo.synthetic) {
                resetActDrive();
                engineSendKey(VK.EXIT);
                return true;
            }
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
        if (index === 2 || index === 3) {
            /* 查看/待机：清掉上场走近残留，避免下一将选将时 driveApproach 重入。 */
            state.pendingApproach = null;
            if (index === 3) {
                state.lastRestAt = Date.now();
                state.pendingActPick = null;
            }
        }
        if (state.pickingMenu) {
            state.pendingActPick = index;
            return;
        }
        if (!enterStack('pickFightMenu')) {
            return;
        }
        state.pickingMenu = true;
        try {
        var fight = readFight();
        var info = readFightMenu();
        if ((fight && fight.wait) || (info && info.synthetic)) {
            /* wait=1 时光标键是走格，不能当菜单 UP/DOWN。记下选项，先选将再落定。 */
            state.pendingActPick = index;
            state.autoActTries = 0;
            state.lastAutoActAt = 0;
            state.menuIndex = index;
            scheduleDrive('menu-pick');
            return;
        }
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
        } finally {
            state.pickingMenu = false;
            leaveStack();
        }
    }

    function pickFightMenuName(name) {
        if (!fightMenuLive()) {
            rearmFightMenuFromBytes();
            renderFightMenu();
        }
        var info = readFightMenu();
        if (!info) {
            return { ok: false, reason: 'no-menu', wait: !!(readFight() && readFight().wait) };
        }
        var i;
        for (i = 0; i < info.names.length; i++) {
            if (info.names[i] === name) {
                pickFightMenu(i);
                return { ok: true, index: i, kind: info.kind, names: info.names.slice() };
            }
        }
        return { ok: false, reason: 'no-item', kind: info.kind, names: info.names.slice() };
    }

    function renderFightMenu() {
        var panel = el('hd-battle-menu');
        var list = el('hd-battle-menu-list');
        var title = el('hd-battle-menu-title');
        var info = readFightMenu();
        if (!panel || !list) {
            return;
        }
        if (!info && shouldShowActMenu(readFight())) {
            if (!state.menuArmLogged) {
                state.menuArmLogged = true;
                logMenuProbe(state.lastRestAt ? 'after-rest-rearm' : 'force-rearm');
            }
            info = syntheticActMenu();
        }
        if (!info) {
            state.menuKind = '';
            state.menuNames = [];
            panel.hidden = true;
            panel.removeAttribute('data-hd-battle-menu-synthetic');
            panel.classList.remove('is-synthetic');
            return;
        }
        state.menuKind = info.kind;
        state.menuTitle = info.title;
        state.menuNames = info.names;
        state.menuIndex = info.index;
        if (info.synthetic) {
            panel.setAttribute('data-hd-battle-menu-synthetic', '1');
            panel.classList.add('is-synthetic');
        } else {
            panel.removeAttribute('data-hd-battle-menu-synthetic');
            panel.classList.remove('is-synthetic');
        }
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
        var cols = state.viewW || state.mapW;
        var rows = state.viewH || state.mapH;
        var cw = boardW / cols;
        var ch = boardH / rows;
        var ox = pad;
        var oy = 72;
        var c = Math.floor((sx - ox) / cw);
        var r = Math.floor((sy - oy) / ch);
        if (c < 0 || r < 0 || c >= cols || r >= rows) {
            return null;
        }
        return { x: c + (state.viewOx || 0), y: r + (state.viewOy || 0) };
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

    function syncFocusFromEngine() {
        var fight = readFight();
        var data = engineData();
        var fx = fight && fight.focusX != null ? Number(fight.focusX) : readNumber(data, 'g_FoucsX');
        var fy = fight && fight.focusY != null ? Number(fight.focusY) : readNumber(data, 'g_FoucsY');
        if (fx != null && isFinite(fx)) {
            state.focus.x = fx;
        }
        if (fy != null && isFinite(fy)) {
            state.focus.y = fy;
        }
        return { x: state.focus.x, y: state.focus.y };
    }

    function inAtkRng(x, y) {
        var data = engineData();
        var rng = data && data.g_FgtAtkRng;
        if (!rng) {
            return false;
        }
        var size = readNumber(rng, 0);
        var ox = readNumber(rng, 1);
        var oy = readNumber(rng, 2);
        if (!size) {
            return false;
        }
        var dx = x - ox;
        var dy = y - oy;
        if (dx < 0 || dy < 0 || dx >= size || dy >= size) {
            return false;
        }
        return readNumber(rng, 3 + dx + dy * size) === 1;
    }

    function dropQueuedEnters() {
        var kept = [];
        var i;
        for (i = 0; i < state.queue.length; i++) {
            if (state.queue[i].code !== VK.ENTER) {
                kept.push(state.queue[i]);
            }
        }
        state.queue = kept;
    }

    function chebyshev(ax, ay, bx, by) {
        return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
    }

    function findCloserMoveTile(fromX, fromY, destX, destY) {
        var stay = chebyshev(fromX, fromY, destX, destY);
        var best = null;
        var bestD = stay;
        var bestFrom = 99;
        var x;
        var y;
        for (y = 0; y < state.mapH; y++) {
            for (x = 0; x < state.mapW; x++) {
                if (unitAt(x, y) && !(x === fromX && y === fromY)) {
                    continue;
                }
                if (canMoveTo(x, y) !== true) {
                    continue;
                }
                var d = chebyshev(x, y, destX, destY);
                var df = chebyshev(x, y, fromX, fromY);
                if (d < bestD || (d === bestD && d < stay && df < bestFrom)) {
                    bestD = d;
                    bestFrom = df;
                    best = { x: x, y: y };
                }
            }
        }
        if (best && bestD < stay) {
            return best;
        }
        /* 走格范围还没灌进 g_FightPath 时，朝敌军迈一格，让 ENTER 能提交。 */
        var nx = fromX + (destX > fromX ? 1 : destX < fromX ? -1 : 0);
        var ny = fromY + (destY > fromY ? 1 : destY < fromY ? -1 : 0);
        if (nx === destX && ny === destY && unitAt(destX, destY)) {
            if (nx !== fromX) {
                nx = fromX;
            } else if (ny !== fromY) {
                ny = fromY;
            }
        }
        if ((nx !== fromX || ny !== fromY) && !unitAt(nx, ny) &&
            nx >= 0 && ny >= 0 && nx < state.mapW && ny < state.mapH) {
            return { x: nx, y: ny };
        }
        return null;
    }

    function canMoveTo(x, y) {
        var data = engineData();
        var path = data && data.g_FightPath;
        if (!path) {
            return null;
        }
        var pathSX = readNumber(data, 'g_PathSX');
        var pathSY = readNumber(data, 'g_PathSY');
        var useSX = readNumber(data, 'g_PUseSX');
        var useSY = readNumber(data, 'g_PUseSY');
        if (pathSX == null || pathSY == null || useSX == null || useSY == null) {
            return null;
        }
        var px = x - pathSX + useSX;
        var py = y - pathSY + useSY;
        var mrg = 15;
        if (px < 0 || py < 0 || px >= mrg || py >= mrg) {
            return false;
        }
        var v = readNumber(path, py * mrg + px);
        return v != null && v <= 0x80;
    }

    function legalEnter(tile, unit, fight) {
        var phase = fight && fight.phase != null ? Number(fight.phase) : 0;
        if (!fight || !fight.wait || fight.over) {
            return false;
        }
        if (phase === 2) {
            if (unit && unit.side === 'enemy') {
                return false;
            }
            var mv = canMoveTo(tile.x, tile.y);
            if (mv === false) {
                return false;
            }
            return !unit || unit.side === 'player';
        }
        if (phase === 3) {
            /* 只有敌方且引擎攻击范围内才回车。读不到范围 = 超距，绝不 ENTER。 */
            return !!(unit && unit.side === 'enemy' && inAtkRng(tile.x, tile.y) === true);
        }
        /* pick-unit 或未知：只点己方将，绝不在瞄准残留时对己方回车。 */
        return !!(unit && unit.side === 'player' && phase !== 3);
    }

    function dismissFightTip() {
        state.fightTip = '';
        try {
            if (window.baye && baye.data && baye.data.g_hdFightTipGbk != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdFightTipGbk = '';
            }
        } catch (e) {}
        applyChrome();
    }

    function noteFightTip(fight) {
        var tip = fight && fight.tip ? String(fight.tip) : '';
        if (/命令无效|无目标/.test(tip)) {
            state.fightTip = tip.replace(/\s+$/g, '');
            state.lastInvalidAt = Date.now();
        } else if (!tip) {
            if (state.fightTip && Date.now() - (state.lastInvalidAt || 0) > 1600) {
                state.fightTip = '';
            }
        }
    }

    function walkFocusTo(x, y, thenEnter) {
        var cur = syncFocusFromEngine();
        var fx = cur.x;
        var fy = cur.y;
        if (fx == null || fy == null) {
            /* 光标未同步时回车会打在原地，瞄准超距会命令无效。 */
            if (thenEnter) {
                state.lastBlockedEnter = 'aim-no-focus';
                console.warn('[hd-battle] blocked ENTER until focus sync');
            }
            return;
        }
        if (fx < 0 || fy < 0 || x < 0 || y < 0 || fx > 48 || fy > 48 || x > 48 || y > 48) {
            console.warn('[hd-battle] walk abort, insane focus', fx, fy, x, y);
            return;
        }
        var keys = [];
        while (fy > y && keys.length < 24) { keys.push(VK.UP); fy -= 1; }
        while (fy < y && keys.length < 24) { keys.push(VK.DOWN); fy += 1; }
        while (fx > x && keys.length < 24) { keys.push(VK.LEFT); fx -= 1; }
        while (fx < x && keys.length < 24) { keys.push(VK.RIGHT); fx += 1; }
        if (thenEnter) {
            keys.push(VK.ENTER);
        }
        enqueueKeys(keys, 70);
        state.focus.x = x;
        state.focus.y = y;
    }

    function clickBattleTile(x, y) {
        if (!enterStack('clickBattleTile')) {
            return { x: x, y: y, enter: false, blocked: 'stack-guard' };
        }
        var tookClick = false;
        try {
        if (state.clickingTile) {
            return { x: x, y: y, enter: false, blocked: 'reentry' };
        }
        state.clickingTile = true;
        tookClick = true;
        if (!fightReallyActive() || cityMenuOwnsScreen() ||
            state.refreshing || state.samplingFight) {
            return { x: x, y: y, enter: false, blocked: 'no-fight' };
        }
        var fight = readFight();
        noteFightTip(fight);
        var tile = { x: x, y: y };
        var u = unitAt(x, y);
        var phase = fight && fight.phase != null ? Number(fight.phase) : 0;
        var inRng = u ? inAtkRng(x, y) : false;
        if (phase === 3 && u && u.side === 'enemy' && inRng !== true) {
            dropQueuedEnters();
            state.lastBlockedEnter = 'aim-oor';
            state.fightTip = '超出攻击范围，先走格靠近。';
            console.warn('[hd-battle] aim-oor, cancel aim', x, y);
            enqueueKeys([VK.EXIT], 55);
            applyChrome();
            return {
                x: x, y: y, enter: false, unit: u.name, phase: phase,
                tip: state.fightTip, blocked: 'aim-oor', inRng: false
            };
        }
        if ((phase === 1 || phase === 0) && u && u.side === 'enemy') {
            state.pendingApproach = { x: x, y: y };
            if (state.pendingActPick == null) {
                state.pendingActPick = 0;
            }
            console.log('[hd-battle] pick-then-approach', x, y);
            scheduleDrive('pick-approach');
            return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'pick-approach' };
        }
        if (phase === 2 && u && u.side === 'enemy') {
            if (state.sending || state.queue.length) {
                state.lastBlockedEnter = 'walk-busy';
                return {
                    x: x, y: y, enter: false, unit: u.name, phase: phase,
                    blocked: 'walk-busy', tip: state.fightTip
                };
            }
            var actor = syncFocusFromEngine();
            var closer = findCloserMoveTile(actor.x, actor.y, x, y);
            dropQueuedEnters();
            state.lastBlockedEnter = closer ? 'move-closer' : 'aim-oor';
            if (closer) {
                console.log('[hd-battle] move closer toward', x, y, 'via', closer.x, closer.y);
                walkFocusTo(closer.x, closer.y, true);
                return {
                    x: closer.x, y: closer.y, enter: true, unit: u.name, phase: phase,
                    toward: { x: x, y: y }, blocked: 'move-closer', inRng: false
                };
            }
            state.fightTip = '超出攻击范围，先走格靠近。';
            applyChrome();
            return {
                x: x, y: y, enter: false, unit: u.name, phase: phase,
                tip: state.fightTip, blocked: 'aim-oor', inRng: false
            };
        }
        var enter = legalEnter(tile, u, fight);
        if (!enter && fight && fight.wait && /命令无效|无目标/.test(state.fightTip || (fight && fight.tip) || '')) {
            dismissFightTip();
        }
        if (!enter && phase === 3 && u && u.side === 'player') {
            dropQueuedEnters();
            state.lastBlockedEnter = 'aim-own';
            console.warn('[hd-battle] blocked ENTER on own unit during aim');
        }
        if (!enter && phase === 3 && (!u || inRng !== true)) {
            dropQueuedEnters();
            state.lastBlockedEnter = u ? 'aim-oor' : 'aim-empty';
            console.warn('[hd-battle] blocked ENTER during aim', state.lastBlockedEnter);
        }
        walkFocusTo(x, y, enter);
        return {
            x: x, y: y, enter: enter, unit: u && u.name, phase: fight && fight.phase,
            tip: state.fightTip, inRng: inRng
        };
        } finally {
            if (tookClick) {
                state.clickingTile = false;
            }
            leaveStack();
        }
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
        state.needWaitBeforeMenu = false;
        state.pendingSys = 0;
        state.lastHook = '';
        clearEngineMenuLeftover();
        state.fightTip = '';
        state.lastInvalidAt = 0;
        state.lastBlockedEnter = '';
        resetActDrive();
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
                /* leftover g_hdMenuBytes 常只剩「策略结束」，不是真 FunctionMenu。 */
                return names[0] === '策略结束' &&
                    names.indexOf('存储进度') >= 0 &&
                    names.indexOf('结束游戏') >= 0;
            }
        } catch (e) {}
        return false;
    }

    function occupyLooksPending() {
        var realm = readRealm();
        var city = fightCityIndex();
        var rec = cityRecord(realm, city);
        var mine = realm && realm.playerBelong;
        if (state.resultCode === 1) {
            if (rec && mine && rec.belong !== mine) {
                return true;
            }
            if (!rec) {
                return true;
            }
            if (state.ownedBefore && realm && realm.ownedCount <= state.ownedBefore) {
                return true;
            }
        }
        /* Belong 写完后还有 TheLoserDeal / KingOverDeal / 灾异 GamMsgBox。
         * FunctionMenu 残留「策略结束」不能当成已走完。 */
        if (liveAsyncReport()) {
            return true;
        }
        if (liveOccupyReport() && liveAsyncReport()) {
            return true;
        }
        /* 败仗 KingOverDeal：请拥立新君 / 成为君主，不占城也要回车走完。 */
        try {
            var report = '';
            if (window.baye && baye.hd && typeof baye.hd.reportText === 'function') {
                report = baye.hd.reportText() || '';
            }
            if (/拥立|成为君主/.test(report)) {
                return true;
            }
        } catch (e) {}
        if (state.occupySettledAt && (Date.now() - state.occupySettledAt) < 1400) {
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
        state.settledOver = state.resultCode || 0;
        try {
            if (!state.settledOver && window.baye && baye.data) {
                state.settledOver = Number(baye.data.g_FgtOver) || 0;
            }
        } catch (eSettled) {}
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
        if (!(state.resultCode === 2 && functionMenuLive() && !liveAsyncReport())) {
            engineSendKey(VK.ENTER);
            state.occupyEnters = 1;
        } else {
            state.occupyEnters = 0;
        }
        var started = Date.now();
        function tick() {
            state.occupyTimer = 0;
            var f = null;
            try { f = readFight(); } catch (e) {}
            var fgtOver = 0;
            try { fgtOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eOver) {}
            if (f && f.active && !f.over && !fgtOver && !state.resultCode) {
                state.occupyTimer = setTimeout(tick, 200);
                return;
            }
            if (occupyLooksPending() && Date.now() - started < 12000 && state.occupyEnters < 36) {
                var realmNow = readRealm();
                var recNow = cityRecord(realmNow, fightCityIndex());
                var mineNow = realmNow && realmNow.playerBelong;
                if (!state.occupySettledAt && recNow && mineNow && recNow.belong === mineNow) {
                    state.occupySettledAt = Date.now();
                }
                /* 败仗没有占领。FunctionMenu「策略结束」再回车会过月，留下 leftover GetCitySet，下一趟打不开 GetFood。 */
                var lossReport = '';
                try {
                    if (window.baye && baye.hd && typeof baye.hd.reportText === 'function') {
                        lossReport = baye.hd.reportText() || '';
                    }
                } catch (e2) {}
                if (state.resultCode === 2 && functionMenuLive() && !liveAsyncReport() &&
                    !/拥立|成为君主/.test(lossReport)) {
                    finishOccupyDrain();
                    return;
                }
                if (liveAsyncReport() || /拥立|成为君主/.test(lossReport) ||
                    (state.resultCode === 1 && !functionMenuLive() &&
                        (!recNow || !mineNow || recNow.belong !== mineNow ||
                            (state.ownedBefore && realmNow && realmNow.ownedCount <= state.ownedBefore) ||
                            liveOccupyReport()))) {
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
        if (fightReallyActive()) {
            return true;
        }
        if (state.resultText || state.occupyPending || state.occupyStarted) {
            return true;
        }
        return false;
    }

    function computeFightView(info) {
        var minX = info.mapW;
        var minY = info.mapH;
        var maxX = -1;
        var maxY = -1;
        var i;
        function include(x, y) {
            if (x == null || y == null || x < 0 || y < 0) {
                return;
            }
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
        }
        for (i = 0; i < info.units.length; i++) {
            include(info.units[i].x, info.units[i].y);
        }
        include(info.focus.x, info.focus.y);
        if (maxX < 0) {
            info.viewOx = 0;
            info.viewOy = 0;
            info.viewW = info.mapW || 16;
            info.viewH = info.mapH || 12;
            return;
        }
        var pad = 3;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = maxX + pad;
        maxY = maxY + pad;
        if (info.mapW && maxX >= info.mapW) {
            maxX = info.mapW - 1;
        }
        if (info.mapH && maxY >= info.mapH) {
            maxY = info.mapH - 1;
        }
        var bw = Math.max(8, maxX - minX + 1);
        var bh = Math.max(6, maxY - minY + 1);
        /* 32×32 缓冲或过大图元会把敌方缩成看不见的点。裁到将领周围。 */
        if (!info.mapW || info.mapW > 22 || info.mapH > 22 || bw * 2 < info.mapW) {
            info.viewOx = minX;
            info.viewOy = minY;
            info.viewW = bw;
            info.viewH = bh;
        } else {
            info.viewOx = 0;
            info.viewOy = 0;
            info.viewW = info.mapW;
            info.viewH = info.mapH;
        }
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
        var info = {
            genCount: 0,
            mapLen: 0,
            units: [],
            focus: { x: null, y: null },
            mapW: 0,
            mapH: 0,
            tiles: [],
            keys: []
        };
        if (state.samplingFight || state.readingEngine) {
            return info;
        }
        if (!state.preview && (!state.open || !fightStrictActive())) {
            return info;
        }
        state.samplingFight = true;
        state.readingEngine = true;
        try {
        var data = engineData();
        if (!data) {
            return info;
        }
        info.genCount = fightArrayCount();
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
        info.tileW = info.mapW;
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
        /* g_MapWid 偶发比将坐标小（屏显缓存），敌方会画到画布外。棋盘至少包住所有将。 */
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
            var ux = readNumber(p, 'x');
            var uy = readNumber(p, 'y');
            info.units.push({
                i: i,
                id: id,
                name: name,
                x: ux,
                y: uy,
                hp: readNumber(p, 'hp'),
                active: readNumber(p, 'active'),
                side: i < 10 ? 'player' : 'enemy'
            });
            if (ux != null && ux >= 0 && ux + 1 > info.mapW) {
                info.mapW = ux + 1;
            }
            if (uy != null && uy >= 0 && uy + 1 > info.mapH) {
                info.mapH = uy + 1;
            }
        }
        if (info.focus.x != null && info.focus.x + 1 > info.mapW) {
            info.mapW = info.focus.x + 1;
        }
        if (info.focus.y != null && info.focus.y + 1 > info.mapH) {
            info.mapH = info.focus.y + 1;
        }
        computeFightView(info);
        if (!state.probed) {
            state.probed = true;
            console.log('[hd-battle] probe', info);
        }
        return info;
        } finally {
            state.samplingFight = false;
            state.readingEngine = false;
        }
    }

    function suppressForeignShells() {
        if (state.preview || !state.open || !fightReallyActive()) {
            return;
        }
        try {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.isOpen === 'function' &&
                BayeHdCityMenu.isOpen() && typeof BayeHdCityMenu.close === 'function') {
                BayeHdCityMenu.close({ silent: true, force: true });
            }
        } catch (eCity) {}
        try {
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
        } catch (eDlg) {}
        try {
            document.documentElement.setAttribute('data-baye-battle', 'hd');
            if (document.body) {
                document.body.classList.remove('baye-hd-battle-lcd');
            }
        } catch (eAttr) {}
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
                (occupyLine() ? ' · ' + occupyLine() : '') +
                (state.fightTip ? ' · ' + state.fightTip : '');
        }
        var tipBanner = el('hd-battle-tip');
        if (tipBanner) {
            if (state.fightTip && !state.resultText) {
                tipBanner.hidden = false;
                tipBanner.textContent = state.fightTip + '（点此关掉，不重发命令）';
            } else {
                tipBanner.hidden = true;
                tipBanner.textContent = '';
            }
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
        var cols = state.viewW || state.mapW || 16;
        var rows = state.viewH || state.mapH || 12;
        var viewOx = state.viewOx || 0;
        var viewOy = state.viewOy || 0;
        var tileW = state.tileW || state.mapW || cols;
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
        var useTiles = state.tiles && state.tiles.length && tileW && (painted || !state.preview);
        for (r = 0; r < rows; r++) {
            for (c = 0; c < cols; c++) {
                if (useTiles) {
                    var tile = state.tiles[(r + viewOy) * tileW + (c + viewOx)] || 0;
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
            ctx.fillText(String(c + viewOx), ox + (c + 0.5) * cw, oy - 8);
        }
        ctx.textAlign = 'right';
        for (r = 0; r < rows; r += Math.max(1, Math.floor(rows / 8))) {
            ctx.fillText(String(r + viewOy), ox - 8, oy + (r + 0.65) * ch);
        }
        if (state.focus.x != null && state.focus.y != null) {
            ctx.strokeStyle = '#f0c75a';
            ctx.lineWidth = 3;
            ctx.strokeRect(
                ox + (state.focus.x - viewOx) * cw + 2,
                oy + (state.focus.y - viewOy) * ch + 2,
                cw - 4, ch - 4
            );
        }
        var i;
        var drawn = 0;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u.x == null || u.y == null) {
                continue;
            }
            drawn += 1;
            var ux = ox + (u.x - viewOx + 0.5) * cw;
            var uy = oy + (u.y - viewOy + 0.5) * ch;
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
        if (state.refreshing || state.samplingFight || state.readingEngine) {
            return;
        }
        if (!state.open) {
            return;
        }
        if (!state.preview && !fightStrictActive()) {
            applyChrome();
            return;
        }
        /* 活战也只采样上色。走近/选将必须走 scheduleDrive(setTimeout 0)，禁止本函数同步进
         * driveApproach / clickWaitingOwn / clickBattleTile（盒子 e 栈就是 refresh↔approach）。 */
        state.refreshing = true;
        try {
        var info = sampleFight();
        state.units = info.units;
        state.mapW = info.mapW;
        state.mapH = info.mapH;
        state.viewOx = info.viewOx || 0;
        state.viewOy = info.viewOy || 0;
        state.viewW = info.viewW || info.mapW;
        state.viewH = info.viewH || info.mapH;
        state.tileW = info.tileW || info.mapW;
        state.tiles = info.tiles;
        state.focus = info.focus;
        var fightNow = readFight();
        noteFightWait(fightNow);
        recoverFightMenu(fightNow);
        if (state.pendingActPick != null && !wantsWalkBeforeAct(state.pendingActPick)) {
            state.pendingApproach = null;
        }
        noteFightTip(fightNow);
        suppressForeignShells();
        renderFightMenu();
        applyChrome();
        draw();
        } catch (eRef) {
            logRefreshStackOnce(eRef);
        } finally {
            state.refreshing = false;
        }
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
        if (!meta.preview && !meta.keepResult && !fightStrictActive()) {
            return false;
        }
        if (global.BayeHdCityMenu && BayeHdCityMenu.isOpen()) {
            BayeHdCityMenu.close({ silent: true, force: true });
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
        /* 已在战场时 leftover g_hdFightActive / draw hook 不得清 live 菜单，
         * 否则刚武装的「将领行动」被当成 stale，攻击点不了。 */
        if (!already) {
            state.lastMenuIdleAt = 0;
            state.lastMenuIdleKind = '';
            state.liveMenuKind = '';
            state.lastWait = 0;
            state.sawWait = false;
            state.needWaitBeforeMenu = false;
            state.menuArmLogged = false;
            state.lastRestAt = 0;
            state.pendingSys = 0;
            state.menuKind = '';
            resetActDrive();
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
        state.resultDismissed = true;
        try {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.resetAfterFight === 'function') {
                BayeHdCityMenu.resetAfterFight();
            }
        } catch (e) {}
        state.open = false;
        state.preview = false;
        state.menuKind = '';
        state.menuNames = [];
        state.lastMenuIdleAt = 0;
        state.lastMenuIdleKind = '';
        state.liveMenuKind = '';
        state.lastWait = 0;
        state.sawWait = false;
        state.needWaitBeforeMenu = false;
        state.pendingSys = 0;
        resetActDrive();
        clearEngineMenuLeftover();
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
                if (fight && fight.active && !fight.wait) {
                    state.sawWait = true;
                    state.needWaitBeforeMenu = false;
                    state.lastMenuIdleAt = Date.now();
                    state.lastMenuIdleKind = cls.kind;
                    state.liveMenuKind = cls.kind;
                    renderFightMenu();
                }
            }
            return;
        }
        if (name === 'willCloseMenu') {
            clearLiveFightMenu();
            /* 活战不要写掉 g_hdMenuCount：PlcSplMenu 刚开时 onMenuIdle 可能已过，
             * 清字节会让走格后「将领行动」整帧空白，盒子只能切经典战斗。 */
            if (!fightReallyActive()) {
                clearEngineMenuLeftover();
            }
            state.needWaitBeforeMenu = true;
            state.pendingApproach = null;
            if (state.lastRestAt && Date.now() - state.lastRestAt < 800) {
                logMenuProbe('after-rest');
                state.menuArmLogged = true;
            }
            state.pendingActPick = null;
            dropQueuedEnters();
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
            if (state.open && fightReallyActive()) {
                refresh();
            }
            return;
        }
        if (name === 'drawMapUnit' || name === 'drawOneGeneral' ||
            name === 'fightStatusBarTouched' || name === 'battleStage1' ||
            name === 'enterBattle' || name === 'fightOpenMainMenu' ||
            name === 'meetFight') {
            if (!fightStrictActive()) {
                return;
            }
        }
        if (shouldShowHd() && fightStrictActive()) {
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
                    var exitInfo = readFightMenu();
                    if (exitInfo && exitInfo.synthetic) {
                        /* 假菜单「返回」不能 EXIT：选将阶段 EXIT 会打开系统菜单，只剩底栏。 */
                        return;
                    }
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
                        recoverFightMenu(readFight());
                        renderFightMenu();
                        if (!fightMenuLive()) {
                            return;
                        }
                    }
                    pickFightMenu(Number(t.getAttribute('data-hd-battle-menu')));
                    return;
                }
                if (t.id === 'hd-battle-result' && state.resultText) {
                    ev.preventDefault();
                    dismissResult();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-battle-tip') != null) {
                    ev.preventDefault();
                    dismissFightTip();
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
                recoverFightMenu(fight);
                var canvasMenu = readFightMenu();
                /* 假将领行动盖在棋盘上时仍要点将；真 PlcSplMenu 才挡格。 */
                if (canvasMenu && !canvasMenu.synthetic) {
                    return;
                }
                var tile = eventToTile(ev);
                if (!tile) {
                    return;
                }
                ev.preventDefault();
                if (state.fightTip && Date.now() - (state.lastInvalidAt || 0) < 400) {
                    dismissFightTip();
                    return;
                }
                clickBattleTile(tile.x, tile.y);
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
        if (titleOrOpeningScreen()) {
            return;
        }
        var info = null;
        try {
            info = window.baye && baye.hd && baye.hd.fight ? baye.hd.fight() : null;
        } catch (e) {}
        var liveOver = 0;
        try { liveOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eLive) {}
        var settleNow = !!(liveOver || (info && info.over) || state.occupyPending || state.occupyStarted);
        if (info && info.active) {
            /* Live fight never inherits leftover 全军覆没 from the previous battle.
             * 占领回车期间不要清 over，否则 FightResultDeal / BeOccupied 走不到。
             * g_FgtOver 已写时这是本场结束，不能清掉。 */
            if (info.over && !liveOver && !state.occupyPending && !state.occupyStarted) {
                try {
                    if (window.baye && baye.data && baye.data.g_hdFightOver != null &&
                        (!baye.hdEngineReady || baye.hdEngineReady())) {
                        baye.data.g_hdFightOver = 0;
                    }
                } catch (e) {}
                info.over = 0;
            }
            /* 只有新开的活战场才清上场 leftover。刚写 result / 占领中不能清。 */
            var leftover = !settleNow && !!(state.resultDismissed || state.resultText || state.resultCode);
            if (leftover) {
                state.resultDismissed = false;
                state.resultText = '';
                state.resultCode = 0;
            }
            if (!settleNow) {
                state.settledOver = 0;
            }
            if (shouldShowHd() && (!state.open || leftover)) {
                enterBattle({ hook: 'g_hdFightActive', keepResult: settleNow });
            }
        }
        var over = liveOver || (info && info.over) || 0;
        if (over && !state.occupyDone && !state.occupyStarted && over !== state.settledOver) {
            state.resultCode = over;
            state.resultText = (info && info.result) || (over === 1 ? '我军大获全胜' :
                (over === 2 ? '我军全军覆没' : ''));
            state.lastHook = (info && info.active) ? 'g_hdFightActive' : 'exitBattle';
            state.lastHookAt = Date.now();
            if (info && info.cityIndex != null) {
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
            if (titleOrOpeningScreen()) {
                if (state.open && !state.preview && !state.resultText &&
                    !state.occupyPending && !state.occupyStarted) {
                    closeBattle({ silent: true });
                }
                return;
            }
            var d = engineData();
            var f = null;
            try { f = baye.hd && baye.hd.fight ? baye.hd.fight() : null; } catch (e) {}
            /* C 已写 g_FgtOver 但 FgtGetFoucs 还在 wait=1：不发键则 CHECK_OVER 永远走不到。 */
            try {
                var fgtOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0;
                if (fgtOver && f && f.active && f.wait && Date.now() - (state.forcedOverPoke || 0) > 350) {
                    state.forcedOverPoke = Date.now();
                    engineSendKey(VK.EXIT);
                }
            } catch (e) {}
            var liveOverPoll = 0;
            try { liveOverPoll = Number(d && d.g_FgtOver) || 0; } catch (eOver) {}
            /* C 已写 g_FgtOver 即使 HD active 已清也要开占领回车。 */
            if (liveOverPoll && !state.occupyStarted && !state.occupyDone &&
                liveOverPoll !== state.settledOver) {
                onEngineFight();
            }
            if (fightStrictActive()) {
                if (f && f.over && !liveOverPoll && !state.occupyPending && !state.occupyStarted) {
                    try {
                        if (d.g_hdFightOver != null && (!baye.hdEngineReady || baye.hdEngineReady())) {
                            d.g_hdFightOver = 0;
                        }
                    } catch (e) {}
                    f.over = 0;
                }
                var settleNow = !!(liveOverPoll || state.occupyPending || state.occupyStarted);
                var leftover = !settleNow && !!(state.resultDismissed || state.resultText);
                if (leftover) {
                    state.resultDismissed = false;
                    state.resultText = '';
                    state.resultCode = 0;
                }
                if (!state.open || leftover) {
                    enterBattle({ hook: 'g_hdFightActive', keepResult: settleNow });
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
        occupyBusy: function () {
            return !!(state.occupyPending || state.occupyStarted ||
                (state.resultCode && !state.occupyDone && !state.resultDismissed));
        },
        clickOwnUnit: function () {
            if (!fightReallyActive()) {
                return { blocked: 'no-fight' };
            }
            refresh();
            var fight = readFight();
            var fallback = null;
            var i;
            for (i = 0; i < state.units.length; i++) {
                var u = state.units[i];
                if (!u || u.side !== 'player' || u.x == null || u.y == null) {
                    continue;
                }
                /* STA_WAIT=0 还能下命令；STA_END=1 已待机，再点只空转。 */
                if (u.active === 0 || u.active == null) {
                    return clickBattleTile(u.x, u.y);
                }
                if (!fallback) {
                    fallback = u;
                }
            }
            if (fallback) {
                return clickBattleTile(fallback.x, fallback.y);
            }
            return { wait: !!(fight && fight.wait), phase: fight && fight.phase };
        },
        clickTile: clickBattleTile,
        clickUnitByName: function (name) {
            if (!fightReallyActive()) {
                return { miss: name, blocked: 'no-fight' };
            }
            refresh();
            var i;
            for (i = 0; i < state.units.length; i++) {
                var u = state.units[i];
                if (u && u.name === name && u.x != null && u.y != null) {
                    return clickBattleTile(u.x, u.y);
                }
            }
            return { miss: name, wait: !!(readFight() && readFight().wait) };
        },
        pickMenuName: pickFightMenuName,
        clickNearestEnemy: function () {
            if (!fightReallyActive()) {
                return { none: true, blocked: 'no-fight' };
            }
            refresh();
            var e = nearestEnemy();
            if (!e) {
                return { none: true, wait: !!(readFight() && readFight().wait), phase: readFight() && readFight().phase };
            }
            return { e: { name: e.name, x: e.x, y: e.y }, click: clickBattleTile(e.x, e.y) };
        },
        walkCloserTo: function (x, y) {
            if (!fightReallyActive()) {
                return { blocked: 'no-fight' };
            }
            refresh();
            return clickBattleTile(x, y);
        },
        recoverMenu: function () {
            return recoverFightMenu(readFight());
        },
        legalEnter: legalEnter,
        dismissFightTip: dismissFightTip,
        openSystemMenu: toggleSystemMenu,
        debugPreview: function () {
            return enterBattle({ preview: true, hook: 'debugPreview' });
        },
        start: start,
        applyPcPage: start,
        forceWin: function (code) {
            var over = code == null ? 1 : Number(code) || 1;
            try {
                if (window.baye && baye.data && baye.data.g_FgtOver != null) {
                    baye.data.g_FgtOver = over;
                }
            } catch (e) {}
            state.forcedOverPoke = 0;
            engineSendKey(VK.EXIT);
            setTimeout(function () {
                engineSendKey(VK.ENTER);
            }, 80);
            try {
                return Number(window.baye && baye.data && baye.data.g_FgtOver);
            } catch (e2) {
                return over;
            }
        },
        debugSnapshot: function () {
            var live = fightReallyActive();
            var fightSnap = live ? readFight() : null;
            var menuSnap = live ? readFightMenu() : null;
            var itemsSnap = live ? readMenuItems() : { names: [] };
            var menuCountSnap = 0;
            try {
                if (live) {
                    menuCountSnap = Number(window.baye && baye.data && baye.data.g_hdMenuCount) || 0;
                }
            } catch (eMc) {}
            return {
                pref: getMode(),
                showHd: shouldShowHd(),
                open: state.open,
                preview: state.preview,
                lastHook: state.lastHook,
                units: state.units.length,
                unitList: state.units.slice(0, 20).map(function (u) {
                    return { i: u.i, name: u.name, x: u.x, y: u.y, side: u.side, active: u.active };
                }),
                mapW: state.mapW,
                mapH: state.mapH,
                view: { x: state.viewOx, y: state.viewOy, w: state.viewW, h: state.viewH },
                genCount: live ? fightArrayCount() : 0,
                focus: state.focus,
                resultCode: state.resultCode,
                resultText: state.resultText,
                menuKind: state.menuKind,
                menuTitle: state.menuTitle,
                menuNames: state.menuNames.slice(),
                menuIndex: state.menuIndex,
                menuLive: !!(live && fightMenuLive()),
                menuSynthetic: !!(menuSnap && menuSnap.synthetic),
                menuIdleAge: state.lastMenuIdleAt ? (Date.now() - state.lastMenuIdleAt) : null,
                liveMenuKind: state.liveMenuKind,
                needWaitBeforeMenu: state.needWaitBeforeMenu,
                lastWait: state.lastWait,
                wait: fightSnap ? !!fightSnap.wait : null,
                active: fightSnap ? !!fightSnap.active : false,
                menuCount: menuCountSnap,
                menuBytes: (itemsSnap && itemsSnap.names) || [],
                pendingActPick: state.pendingActPick,
                pendingApproach: state.pendingApproach,
                autoActTries: state.autoActTries,
                stackDepth: state.stackDepth,
                pickingMenu: state.pickingMenu,
                clickingTile: state.clickingTile,
                showLcd: !!state.showLcd,
                battleVer: HD_BATTLE_VER,
                scriptSrc: (function () {
                    try {
                        var el = document.getElementById('baye-build-badge');
                        return el ? (el.getAttribute('data-hd-script-src') || '') : '';
                    } catch (e) { return ''; }
                }()),
                scriptVer: (function () {
                    try {
                        var el = document.getElementById('baye-build-badge');
                        return el ? (el.getAttribute('data-hd-script-ver') || '') : '';
                    } catch (e) { return ''; }
                }()),
                lastRefreshStack: state.lastRefreshStack,
                strictLive: !!state.strictLive,
                titleOpening: titleOrOpeningScreen(),
                why: live ? whyMenuHidden() : { reasons: ['fight-inactive'] },
                queueLen: state.queue.length,
                sawWait: state.sawWait,
                pendingSys: state.pendingSys,
                fightTip: state.fightTip,
                lastInvalidAt: state.lastInvalidAt,
                lastBlockedEnter: state.lastBlockedEnter,
                atkRngReady: live && (function () {
                    try {
                        var rng = engineData() && engineData().g_FgtAtkRng;
                        return !!(rng && readNumber(rng, 0));
                    } catch (e) { return false; }
                }()),
                phase: fightSnap ? fightSnap.phase : null,
                aimType: fightSnap ? fightSnap.aimType : null,
                resultDismissed: state.resultDismissed,
                occupyPending: state.occupyPending,
                occupyDone: state.occupyDone,
                occupyCity: state.occupyCity,
                occupyOwner: state.occupyOwner,
                occupyEnters: state.occupyEnters,
                lastOccupy: state.lastOccupy,
                settledOver: state.settledOver,
                realm: readRealm(),
                skills: (function () {
                    try { return window.baye && baye.hd && baye.hd.skills ? baye.hd.skills() : null; }
                    catch (e) { return null; }
                }())
            };
        }
    };
})(window);
