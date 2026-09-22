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
    var HD_BATTLE_VER = '20260922zh';
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
        rearmTimer: 0,
        walkSubmittedAt: 0,
        leavingAim: false,
        holdActMenuUntil: 0,
        blankWatchTimer: 0,
        lastAimExitAt: 0,
        lastAttackAt: 0,
        aimEnteredAt: 0,
        approachRepeatCount: 0,
        lastApproachKey: '',
        lastApproachActor: '',
        pendingAimEnter: null,
        lastRestCommitAt: 0,
        endTurnAt: 0,
        afterEndTurnUntil: 0,
        playerTurnEnded: false,
        openedSysForEndTurn: false,
        sawMoveThisTurn: false,
        lastHitAt: 0,
        lastSwallowAt: 0,
        lastSwallowWhy: '',
        allowEndTurnEnter: false,
        sysMenuHooked: false,
        actorAt: null,
        awaitingAimUntil: 0,
        movedThisAct: false,
        strictLive: false,
        refreshStackLogged: false,
        lastRefreshStack: '',
        readDepth: 0,
        approachArmedAt: 0,
        lastBlankWatchAt: 0,
        lastBlankWatchWhy: '',
        boxSlowMs: 0,
        boxSlowUntil: 0,
        actCommit: null,
        actCommitAt: 0,
        allowRetreatArmed: false
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

    function keyName(code) {
        if (code === VK.ENTER) {
            return 'ENTER';
        }
        if (code === VK.EXIT) {
            return 'EXIT';
        }
        if (code === VK.UP) {
            return 'UP';
        }
        if (code === VK.DOWN) {
            return 'DOWN';
        }
        if (code === VK.LEFT) {
            return 'LEFT';
        }
        if (code === VK.RIGHT) {
            return 'RIGHT';
        }
        return '0x' + Number(code).toString(16);
    }

    function engineSendKey(code) {
        try {
            var fightKey = null;
            try { fightKey = readFight(); } catch (eK) {}
            var overNow = !!(fightKey && fightKey.over);
            try {
                if (!overNow && window.baye && baye.data && Number(baye.data.g_FgtOver)) {
                    overNow = true;
                }
            } catch (eOver) {}
            if (code === VK.EXIT && !overNow && !state.leavingAim && keepAimEnter('send-exit')) {
                dumpEnterSwallow('aim-exit-blocked', { key: 'EXIT' });
                return false;
            }
            if (fightReallyActive() && state.lastRestCommitAt &&
                Date.now() - state.lastRestCommitAt < 1400 &&
                (code === VK.DOWN || code === VK.UP)) {
                dumpEnterSwallow('rest-nav-blocked', { key: keyName(code) });
                return false;
            }
            if (fightReallyActive() && recentlyEndedTurn() && !overNow &&
                (code === VK.ENTER || code === VK.EXIT || code === VK.UP || code === VK.DOWN)) {
                var allowEnd = (code === VK.ENTER && state.allowEndTurnEnter) ||
                    (code === VK.EXIT && (state.allowEndTurnEnter || state.openedSysForEndTurn));
                if (allowEnd) {
                    if (code === VK.ENTER) {
                        state.allowEndTurnEnter = false;
                    }
                } else {
                    dumpEnterSwallow('ended-turn-block', { key: keyName(code) });
                    return false;
                }
            }
            if (fightReallyActive()) {
                console.log('[hd-battle] send-key', {
                    key: keyName(code),
                    phase: fightKey ? fightKey.phase : null,
                    wait: fightKey ? !!fightKey.wait : null,
                    over: overNow,
                    ended: !!state.playerTurnEnded,
                    moved: !!state.movedThisAct,
                    sawMove: !!state.sawMoveThisTurn,
                    sysEnd: !!state.openedSysForEndTurn,
                    leaving: !!state.leavingAim,
                    queue: state.queue.length
                });
            }
        } catch (eLog) {}
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

    function engineHasWaitingOwn() {
        try {
            var data = engineData();
            var arr = data && data.g_FgtParam && data.g_FgtParam.GenArray;
            var pos = data && data.g_GenPos;
            if (!arr || !pos) {
                return false;
            }
            var i;
            for (i = 0; i < 10; i++) {
                var id = readNumber(arr, i);
                if (id === null && arr[i] != null) {
                    id = Number(arr[i]);
                }
                if (!id || id >= 0xfffe) {
                    continue;
                }
                var p = pos[i];
                if (!p) {
                    continue;
                }
                var active = readNumber(p, 'active');
                var x = readNumber(p, 'x');
                var y = readNumber(p, 'y');
                if ((active === 0 || active == null) && x != null && y != null) {
                    return true;
                }
            }
        } catch (eWait) {}
        return false;
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
        return engineHasWaitingOwn();
    }

    function noteActingUnit(u) {
        if (u && u.x != null && u.y != null) {
            state.actorAt = { x: u.x, y: u.y, name: u.name || '' };
        }
    }

    function actingActor() {
        var fight = null;
        try { fight = readFight(); } catch (eA) {}
        var phase = Number(fight && fight.phase) || 0;
        if (phase === 3 && state.actorAt && state.actorAt.x != null) {
            return state.actorAt;
        }
        var own = waitingOwnUnit();
        if (own) {
            return own;
        }
        if (state.actorAt && state.actorAt.x != null) {
            return state.actorAt;
        }
        return syncFocusFromEngine();
    }

    function fightIdleForMenu(fight) {
        var phase = Number(fight && fight.phase) || 0;
        /* wait=0 或选将(phase 1)可以画菜单；phase 1 仍可能带着 pendingActPick，不能当走完。 */
        return !!(fight && fight.active && !fight.over && (!fight.wait || phase === 0 || phase === 1));
    }

    function approachFullyIdle(fight) {
        var phase = Number(fight && fight.phase) || 0;
        return !!(fight && fight.active && !fight.over && (!fight.wait || phase === 0));
    }

    function walkFinishedLeftover(fight) {
        var phase = Number(fight && fight.phase) || 0;
        return !!(fight && fight.active && !fight.over && fight.wait && phase === 2 &&
            state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) >= 1400 &&
            !state.sending && !state.queue.length && !state.drivingAct && !state.clickingTile);
    }

    function setPendingApproach(x, y) {
        state.pendingApproach = { x: x, y: y };
        if (!state.approachArmedAt) {
            state.approachArmedAt = Date.now();
        }
    }

    function clearPendingApproach() {
        state.pendingApproach = null;
        state.approachArmedAt = 0;
    }

    function approachAgeMs() {
        if (!state.pendingApproach) {
            return 0;
        }
        var armed = state.approachArmedAt || state.lastAttackAt || 0;
        return armed ? (Date.now() - armed) : 0;
    }

    function approachStuck(fight) {
        var phase = Number(fight && fight.phase) || 0;
        if (!(state.pendingApproach && fight && fight.active && !fight.over &&
            fight.wait && phase === 2)) {
            return false;
        }
        if (state.drivingAct || state.clickingTile) {
            return false;
        }
        if (state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 1400) {
            return false;
        }
        var age = approachAgeMs();
        if (state.sending || state.queue.length) {
            return age >= 2200;
        }
        return age >= 2000;
    }

    function flushStuckApproach(why) {
        if (!state.pendingApproach && state.pendingActPick == null) {
            return false;
        }
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        console.log('[hd-battle] approach-stuck-flush', {
            why: why || 'flush',
            pendingApproach: state.pendingApproach,
            pendingActPick: state.pendingActPick,
            armedMs: approachAgeMs(),
            phase: fight ? Number(fight.phase) : null,
            wait: !!(fight && fight.wait),
            moved: !!state.movedThisAct
        });
        clearPendingApproach();
        if (wantsWalkBeforeAct(state.pendingActPick)) {
            state.pendingActPick = null;
        }
        state.walkSubmittedAt = 0;
        state.approachRepeatCount = 0;
        return true;
    }

    function clearStuckApproach(fight) {
        /* 只在走完/闲置/走近卡死时清 pendingApproach。选将 phase 1 清掉会取消刚点的攻击走近。 */
        if (approachStuck(fight)) {
            flushStuckApproach('clear-stuck');
            return;
        }
        if (approachFullyIdle(fight) || walkFinishedLeftover(fight)) {
            clearPendingApproach();
            if (wantsWalkBeforeAct(state.pendingActPick)) {
                state.pendingActPick = null;
            }
            state.walkSubmittedAt = 0;
        }
    }

    function walkingTiles(fight) {
        var phase = Number(fight && fight.phase) || 0;
        if (walkFinishedLeftover(fight) || approachStuck(fight)) {
            clearStuckApproach(fight);
            return false;
        }
        if (!(fight && fight.wait && phase === 2)) {
            return false;
        }
        /* 只有真正走近/走格才藏菜单。单靠 pendingActPick 会把第一次「攻击」点成空白。 */
        if (state.pendingApproach) {
            return true;
        }
        return !!(state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 1400);
    }

    function atkRngSize() {
        try {
            var data = engineData();
            var rng = data && data.g_FgtAtkRng;
            return rng ? (readNumber(rng, 0) || 0) : 0;
        } catch (eRng) {
            return 0;
        }
    }

    function atkRngReady() {
        var fight = null;
        try { fight = readFight(); } catch (eR) {}
        if (!fight || Number(fight.phase) !== 3) {
            return false;
        }
        return atkRngSize() > 0;
    }

    function waitingOwnUnit() {
        var i;
        var focus = null;
        try { focus = syncFocusFromEngine(); } catch (eF) {}
        var first = null;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'player' || u.x == null || u.y == null) {
                continue;
            }
            if (!(u.active === 0 || u.active == null)) {
                continue;
            }
            if (!first) {
                first = u;
            }
            if (focus && focus.x === u.x && focus.y === u.y) {
                return u;
            }
        }
        return first;
    }

    function adjacentEnemy(maxD) {
        /* AIM 用本将落点（actorAt），勿用另一名未行动将的坐标，否则 leftover 假阳性会 EXIT。 */
        var actor = actingActor();
        var limit = maxD == null ? 1 : maxD;
        var best = null;
        var bestD = 99;
        var i;
        if (actor.x == null || actor.y == null) {
            return null;
        }
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'enemy' || u.x == null || u.y == null) {
                continue;
            }
            var d = chebyshev(actor.x, actor.y, u.x, u.y);
            if (d <= limit && d < bestD) {
                best = u;
                bestD = d;
            }
        }
        return best;
    }

    function aimAgeMs() {
        return Date.now() - (state.aimEnteredAt || state.lastAttackAt || 0);
    }

    function firstLegalAimEnemy() {
        var i;
        if (!atkRngReady()) {
            return null;
        }
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u && u.side === 'enemy' && u.x != null && u.y != null &&
                inAtkRng(u.x, u.y) === true) {
                return u;
            }
        }
        return null;
    }

    function hasLegalAimTarget() {
        return !!firstLegalAimEnemy();
    }

    function confirmAimHit(u, x, y, via, extra) {
        dropQueuedExits();
        state.leavingAim = false;
        walkFocusTo(x, y, true);
        state.lastBlockedEnter = '';
        state.pendingAimEnter = null;
        extra = extra || {};
        extra.via = via || 'in-range';
        extra.unit = u && u.name;
        extra.x = x;
        extra.y = y;
        extra.inRng = true;
        extra.hp = u && u.hp;
        extra.focus = syncFocusFromEngine();
        extra.queue = state.queue.length;
        extra.leaving = !!state.leavingAim;
        extra.hold = holdingActMenu();
        extra.tip = state.fightTip;
        extra.swallowed = false;
        state.awaitingAimUntil = 0;
        state.lastHitAt = Date.now();
        console.log('[hd-battle] attack-hit', extra);
        return {
            x: x, y: y, enter: true, unit: u && u.name, phase: 3,
            tip: state.fightTip, blocked: '', inRng: true, via: extra.via
        };
    }

    function likelyAimTarget() {
        /* 只有真 AIM（phase 3）才把贴脸当成瞄准。phase 0 的 leftover 射程表不算。 */
        var fight = null;
        try { fight = readFight(); } catch (eL) {}
        if (!fight || Number(fight.phase) !== 3) {
            return false;
        }
        return !!(hasLegalAimTarget() || adjacentEnemy(1));
    }

    function recentlyEndedTurn() {
        return !!(state.playerTurnEnded ||
            (state.afterEndTurnUntil && Date.now() < state.afterEndTurnUntil));
    }

    function notePlayerTurnEnded(why) {
        state.playerTurnEnded = true;
        state.afterEndTurnUntil = Date.now() + 3600;
        state.sawMoveThisTurn = false;
        state.openedSysForEndTurn = false;
        resetActMenuIndex('end-player-turn');
        clearMovedThisAct(why || 'end-player-turn');
        state.pendingActPick = null;
        clearPendingApproach();
    }

    function maybeResumePlayerTurn(fight) {
        if (!state.playerTurnEnded) {
            return;
        }
        var phase = Number(fight && fight.phase) || 0;
        var endedAt = state.afterEndTurnUntil ? (state.afterEndTurnUntil - 3600) : 0;
        if (endedAt && Date.now() - endedAt < 900) {
            return;
        }
        /* 只在下一回合选将/走格 wait=1 时解除。wait=0 leftover 会把键打进敌方 AI。 */
        if (playerHasWaitingOwn() && fight && !fight.over && fight.wait &&
            (phase === 1 || phase === 2)) {
            state.playerTurnEnded = false;
            state.afterEndTurnUntil = 0;
            state.sawMoveThisTurn = phase === 2;
            state.movedThisAct = false;
            state.openedSysForEndTurn = false;
            state.allowEndTurnEnter = false;
            resetActMenuIndex('new-player-turn');
            console.log('[hd-battle] act-reset', { via: 'new-player-turn', phase: phase });
        } else if (endedAt && Date.now() - endedAt > 4200 &&
            fight && !fight.over && fight.wait && phase === 1 &&
            !playerHasWaitingOwn()) {
            /* 敌方回合后若仍停在选将且无未行动己方，放开 latch 才能再 EXIT 回合结束。 */
            state.playerTurnEnded = false;
            state.afterEndTurnUntil = 0;
            state.openedSysForEndTurn = false;
            console.log('[hd-battle] act-reset', { via: 'end-turn-retry', phase: phase });
        }
    }

    /* 走近后的正确顺序（天下一统阻塞路径）：
     *   FgtDealMan: FgtGetControl(选将) → FgtGenMove(走格 ENTER) → PlcSplMenu
     *   1. 等 PlcSplMenu 真菜单 wait=0（liveActMenu / canCommitActMenu）
     *   2. ENTER 攻击 → FgtGetCmdRng + FgtCmdAimGet（phase=3，aim-enter）
     *   3. 等射程表或贴脸，对 in-range 敌军 ENTER（attack-hit）
     * 射程内敌军在光标下时不得 leftover EXIT。
     * 回合结束后 leftover wait=0 / 合成菜单上的 ENTER 会把战斗打成 after-fight。 */

    function liveActMenu() {
        var info = null;
        try { info = readFightMenu(); } catch (eI) {}
        return !!(info && info.kind === 'act' && !info.synthetic &&
            info.names && info.names.indexOf('攻击') >= 0);
    }

    function canCommitActMenu(fight) {
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (recentlyEndedTurn()) {
            return false;
        }
        if (!state.movedThisAct && !state.sawMoveThisTurn) {
            return false;
        }
        if (awaitingAim() || state.pendingActPick === 3) {
            return false;
        }
        if (fight.wait) {
            return false;
        }
        return liveActMenu();
    }

    function awaitingAim() {
        return !!(state.awaitingAimUntil && Date.now() < state.awaitingAimUntil);
    }

    function noteAwaitingAim(ms) {
        state.awaitingAimUntil = Date.now() + (ms == null ? 2200 : ms);
    }

    function clearMovedThisAct(why) {
        if (state.movedThisAct || state.awaitingAimUntil) {
            console.log('[hd-battle] act-reset', {
                via: why || 'clear', moved: !!state.movedThisAct
            });
        }
        state.movedThisAct = false;
        state.awaitingAimUntil = 0;
    }

    function leftoverAim(fight) {
        if (!(fight && Number(fight.phase) === 3)) {
            return false;
        }
        /* Attack ENTER 之后等射程表；awaiting 窗口内绝不当 leftover，否则 refresh 会 EXIT 掉 attack-hit。 */
        if (awaitingAim()) {
            return false;
        }
        if (likelyAimTarget()) {
            return false;
        }
        var age = aimAgeMs();
        if (!atkRngReady()) {
            if (age > 800) {
                dumpEnterSwallow('leftover-aim-no-rng', { aimAge: age });
            }
            return age > 800;
        }
        if (age > 800) {
            dumpEnterSwallow('leftover-aim-ready-no-target', { aimAge: age });
        }
        return age > 800;
    }

    function noteAimPhase(fight) {
        var phase = Number(fight && fight.phase) || 0;
        if (phase === 3) {
            if (!state.aimEnteredAt) {
                state.aimEnteredAt = Date.now();
                console.log('[hd-battle] aim-enter', {
                    wait: !!(fight && fight.wait),
                    legal: hasLegalAimTarget(),
                    likely: likelyAimTarget(),
                    rng: atkRngReady(),
                    adj: !!(adjacentEnemy(1)),
                    leaving: !!state.leavingAim
                });
            }
            if (likelyAimTarget() || awaitingAim()) {
                /* 真瞄准时菜单不得挡住点敌军。 */
                state.holdActMenuUntil = 0;
            }
            return;
        }
        state.aimEnteredAt = 0;
        if (state.leavingAim && Date.now() - (state.lastAimExitAt || 0) > 180) {
            state.leavingAim = false;
        }
    }

    function logAimExit(why, extra) {
        var rec = extra || {};
        rec.why = why || 'aim-exit';
        rec.legal = hasLegalAimTarget();
        rec.likely = likelyAimTarget();
        rec.rng = atkRngReady();
        rec.aimAge = state.aimEnteredAt ? (Date.now() - state.aimEnteredAt) : 0;
        console.log('[hd-battle] aim-exit-reason', rec);
    }

    function recentlyLeftAim(ms) {
        var win = ms == null ? 750 : ms;
        return !!(state.lastAimExitAt && (Date.now() - state.lastAimExitAt) < win);
    }

    function exitLeftoverAimOnce(why, extra) {
        if (recentlyLeftAim(750)) {
            return false;
        }
        dropQueuedEnters();
        state.leavingAim = true;
        state.lastAimExitAt = Date.now();
        logAimExit(why || 'leftover', extra || {});
        enqueueKeys([VK.EXIT], 55);
        return true;
    }

    function aimingTiles(fight) {
        /* 真瞄准（射程内或贴脸待灌表）才藏菜单。确认 leftover 才把将领行动露出来。 */
        return !!(fight && Number(fight.phase) === 3 && !leftoverAim(fight) && !state.leavingAim);
    }

    function holdingActMenu() {
        return !!(state.holdActMenuUntil && Date.now() < state.holdActMenuUntil);
    }

    /* 只要还有己方未行动，菜单必须能点。待机后 leftover wait=1/phase=2 不得再藏死。 */
    function shouldShowActMenu(fight) {
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (holdingActMenu()) {
            return true;
        }
        if (aimingTiles(fight) || walkingTiles(fight)) {
            return false;
        }
        if (playerHasWaitingOwn()) {
            return true;
        }
        /* 全员已行动：藏菜单，勿再点攻击挡住敌方回合。 */
        if (state.lastRestCommitAt && Date.now() - state.lastRestCommitAt < 900) {
            return true;
        }
        return false;
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
            leftoverDlg: false,
            clickable: false,
            pointerEvents: '',
            width: 0,
            height: 0,
            btnCount: 0,
            hold: holdingActMenu(),
            leftoverAim: leftoverAim(fight),
            legalAim: hasLegalAimTarget()
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
            if (panel) {
                var cs = global.getComputedStyle(panel) || {};
                rec.pointerEvents = String(cs.pointerEvents || '');
                rec.width = panel.offsetWidth || 0;
                rec.height = panel.offsetHeight || 0;
                rec.btnCount = panel.querySelectorAll('[data-hd-battle-menu]').length;
                rec.clickable = !panel.hidden && rec.display !== 'none' &&
                    rec.pointerEvents !== 'none' && rec.width > 8 && rec.height > 8 &&
                    rec.btnCount >= 2;
            }
        } catch (eClick) {}
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
        clearPendingApproach();
        state.lastAutoActAt = 0;
        state.autoActTries = 0;
        state.drivingAct = false;
        state.pickingMenu = false;
        state.clickingTile = false;
        state.walkSubmittedAt = 0;
        state.leavingAim = false;
        state.pendingAimEnter = null;
        state.approachRepeatCount = 0;
        state.movedThisAct = false;
        if (state.driveTimer) {
            clearTimeout(state.driveTimer);
            state.driveTimer = 0;
        }
    }

    function menuPanelClickable() {
        try {
            var panel = el('hd-battle-menu');
            if (!panel || panel.hidden) {
                return false;
            }
            var cs = global.getComputedStyle(panel) || {};
            return cs.display !== 'none' && cs.pointerEvents !== 'none' &&
                (panel.offsetWidth || 0) > 8 && (panel.offsetHeight || 0) > 8;
        } catch (eClick) {
            return false;
        }
    }

    function logAttackClick(via) {
        var fight = null;
        var panel = null;
        var cs = {};
        try { fight = readFight(); } catch (eF) {}
        try { panel = el('hd-battle-menu'); } catch (eP) {}
        try { cs = panel ? (global.getComputedStyle(panel) || {}) : {}; } catch (eC) {}
        console.log('[hd-battle] attack-click', {
            via: via || 'pick',
            pendingApproach: state.pendingApproach,
            pendingActPick: state.pendingActPick,
            phase: fight ? fight.phase : null,
            wait: fight ? !!fight.wait : null,
            display: String(cs.display || ''),
            hidden: !!(panel && panel.hidden),
            pointerEvents: String(cs.pointerEvents || ''),
            hold: holdingActMenu(),
            leftoverAim: leftoverAim(fight),
            legalAim: hasLegalAimTarget()
        });
    }

    function armBlankMenuWatchdog(why) {
        if (state.blankWatchTimer) {
            clearTimeout(state.blankWatchTimer);
            state.blankWatchTimer = 0;
        }
        state.blankWatchTimer = setTimeout(function () {
            state.blankWatchTimer = 0;
            if (!fightReallyActive() || state.resultText) {
                return;
            }
            var fight = null;
            try { fight = readFight(); } catch (eF) {}
            if (fight && Number(fight.phase) === 3) {
                console.log('[hd-battle] blank-watchdog', {
                    why: why || 'aim-hidden',
                    pendingApproach: state.pendingApproach,
                    pendingActPick: state.pendingActPick,
                    phase: 3,
                    wait: !!fight.wait,
                    leftoverAim: leftoverAim(fight),
                    legalAim: hasLegalAimTarget()
                });
                /* leftover AIM 先 EXIT 再 forceShow，绝不能停在 phase=3 空白。 */
                if (leftoverAim(fight)) {
                    leaveAimAndRearm('watchdog-aim');
                    return;
                }
                return;
            }
            if (!playerHasWaitingOwn()) {
                return;
            }
            if (menuPanelClickable()) {
                return;
            }
            if (state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 1400) {
                armBlankMenuWatchdog('still-walk');
                return;
            }
            if (state.pendingApproach && fight && Number(fight.phase) === 2 && fight.wait) {
                if (!approachStuck(fight)) {
                    scheduleDrive('watchdog-flush-walk');
                    armBlankMenuWatchdog('still-approach');
                    return;
                }
                logBlankWatchdog('approach-stuck-flush', fight);
                flushStuckApproach('watchdog');
                forceShowFightMenu('watchdog-approach-stuck');
                return;
            }
            logBlankWatchdog(why || 'idle-hidden', fight);
            forceShowFightMenu('watchdog');
        }, 1500);
    }

    function logBlankWatchdog(why, fight) {
        var now = Date.now();
        if (why === state.lastBlankWatchWhy && state.lastBlankWatchAt &&
            now - state.lastBlankWatchAt < 2500) {
            return;
        }
        state.lastBlankWatchWhy = why || '';
        state.lastBlankWatchAt = now;
        console.log('[hd-battle] blank-watchdog', {
            why: why || 'idle-hidden',
            pendingApproach: state.pendingApproach,
            pendingActPick: state.pendingActPick,
            phase: fight ? fight.phase : null,
            wait: fight ? !!fight.wait : null,
            armedMs: approachAgeMs()
        });
    }

    function forceShowFightMenu(why) {
        var keepApproach = state.pendingApproach;
        var keepPick = state.pendingActPick;
        var fightKeep = null;
        try { fightKeep = readFight(); } catch (eK) {}
        if (keepApproach && approachStuck(fightKeep)) {
            keepApproach = null;
        }
        clearStuckApproach(fightKeep);
        if (keepApproach && !approachStuck(fightKeep)) {
            setPendingApproach(keepApproach.x, keepApproach.y);
            if (keepPick != null) {
                state.pendingActPick = keepPick;
            }
        } else {
            clearPendingApproach();
            if (wantsWalkBeforeAct(state.pendingActPick)) {
                state.pendingActPick = null;
            }
        }
        if (!state.movedThisAct) {
            state.walkSubmittedAt = 0;
        }
        state.holdActMenuUntil = Date.now() + 700;
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        if (fight && Number(fight.phase) === 3 && leftoverAim(fight)) {
            exitLeftoverAimOnce(why || 'force-show', { phase: 3, wait: !!fight.wait });
        }
        forceRevealActMenu(why || 'force-show');
    }

    function forceRevealActMenu(why) {
        state.needWaitBeforeMenu = false;
        state.menuArmLogged = false;
        var info = syntheticActMenu();
        state.menuKind = info.kind;
        state.menuTitle = info.title;
        state.menuNames = info.names;
        state.menuIndex = info.index;
        try {
            var panel = el('hd-battle-menu');
            var list = el('hd-battle-menu-list');
            var title = el('hd-battle-menu-title');
            if (title) {
                title.textContent = info.title;
            }
            if (list) {
                var html = '';
                var i;
                for (i = 0; i < info.names.length; i++) {
                    html += '<button type="button" class="hd-battle-menu-item' +
                        (i === info.index ? ' is-on' : '') +
                        '" data-hd-battle-menu="' + i + '">' + info.names[i] + '</button>';
                }
                list.setAttribute('data-sig', html);
                list.innerHTML = html;
            }
            if (panel) {
                panel.hidden = false;
                panel.removeAttribute('hidden');
                panel.setAttribute('data-hd-battle-menu-synthetic', '1');
                panel.classList.add('is-synthetic', 'is-forced');
                panel.style.display = 'flex';
                panel.style.flexDirection = 'column';
                panel.style.pointerEvents = 'auto';
                panel.style.zIndex = '30';
            }
        } catch (eForce) {}
        try {
            applyChrome();
        } catch (eChrome) {}
        logMenuProbe(why || 'force-reveal');
    }

    function paintActMenu(why) {
        state.needWaitBeforeMenu = false;
        state.menuArmLogged = false;
        try {
            if (state.open) {
                recoverFightMenu(readFight());
                renderFightMenu();
                applyChrome();
            }
        } catch (ePaint) {}
        if (holdingActMenu() ||
            /aim-empty|aim-oor|aim-own|failed-aim|after-walk|after-approach|after-rearm|move-oor|after-attack|leftover-aim|watchdog-aim/.test(why || '')) {
            forceShowFightMenu(why || 'act-rearm');
            return;
        }
        logMenuProbe(why || 'act-rearm');
    }

    function scheduleActRearm(why) {
        if (state.rearmTimer) {
            clearTimeout(state.rearmTimer);
            state.rearmTimer = 0;
        }
        var started = Date.now();
        var tries = 0;
        function tick() {
            state.rearmTimer = 0;
            if (!fightReallyActive()) {
                return;
            }
            if ((state.sending || state.queue.length) && Date.now() - started < 1600) {
                state.rearmTimer = setTimeout(tick, 80);
                return;
            }
            var fight = readFight();
            if (!fight || fight.over || state.resultText) {
                return;
            }
            var phase = Number(fight.phase) || 0;
            if (phase === 2 && fight.wait && Date.now() - started < 700) {
                state.rearmTimer = setTimeout(tick, 80);
                return;
            }
            if (phase === 3) {
                noteAimPhase(fight);
                if (likelyAimTarget()) {
                    return;
                }
                if (awaitingAim() && !leftoverAim(fight) && Date.now() - started < 2200) {
                    state.rearmTimer = setTimeout(tick, 80);
                    return;
                }
                if (!atkRngReady() && Date.now() - started < 800) {
                    state.rearmTimer = setTimeout(tick, 80);
                    return;
                }
                if (leftoverAim(fight) && Date.now() - started < 1200) {
                    if (recentlyLeftAim()) {
                        state.rearmTimer = setTimeout(tick, 120);
                        return;
                    }
                    if (exitLeftoverAimOnce(why || 'after-rearm', { try: tries + 1 })) {
                        tries += 1;
                    }
                    state.rearmTimer = setTimeout(tick, 160);
                    return;
                }
                if (likelyAimTarget()) {
                    return;
                }
            }
            if (/after-attack|aim-oor|leftover|watchdog-aim/.test(why || '') &&
                state.movedThisAct && !likelyAimTarget() && !awaitingAim()) {
                preferRest('rearm-leftover-after-move');
                return;
            }
            state.leavingAim = false;
            forceShowFightMenu(why || 'after-rearm');
        }
        state.rearmTimer = setTimeout(tick, 180);
    }

    function leaveAimAndRearm(why, opts) {
        opts = opts || {};
        dropQueuedEnters();
        if (opts.thenApproach && state.movedThisAct) {
            /* 本将走格已落定，不能再走近； leftover AIM 只能待机。 */
            opts.thenApproach = null;
            opts.thenRest = true;
        }
        if (!opts.keepApproach && !opts.thenApproach && !opts.thenRest) {
            clearPendingApproach();
            if (state.pendingActPick !== 3) {
                state.pendingActPick = null;
            }
        }
        if (opts.thenApproach) {
            setPendingApproach(opts.thenApproach.x, opts.thenApproach.y);
            state.pendingActPick = 0;
        }
        if (opts.thenRest) {
            clearPendingApproach();
            state.pendingActPick = 3;
        }
        state.pendingAimEnter = null;
        exitLeftoverAimOnce(why || 'aim-oor', {
            keepApproach: !!opts.keepApproach,
            thenApproach: opts.thenApproach || null,
            thenRest: !!opts.thenRest,
            moved: !!state.movedThisAct
        });
        forceShowFightMenu(why || 'aim-oor');
        if (opts.thenRest) {
            writeFightActCommit(3);
            console.log('[hd-battle] rest-commit', {
                via: 'leftover-after-move', why: why || 'aim-oor', commit: 3
            });
            state.lastRestAt = Date.now();
            state.lastRestCommitAt = Date.now();
            scheduleDriveSoon('prefer-rest', 260);
        } else {
            scheduleActRearm(why || 'aim-oor');
            if (opts.thenApproach) {
                scheduleDrive('after-leftover-approach');
            }
        }
    }

    function writeFightActCommit(index) {
        try {
            if (window.baye && baye.data && baye.data.g_hdFightActCommit != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdFightActCommit = index;
                state.actCommit = index;
                state.actCommitAt = Date.now();
                return true;
            }
        } catch (eW) {}
        state.actCommit = index;
        state.actCommitAt = Date.now();
        return false;
    }

    function writeFightAllowRetreat(on) {
        try {
            if (window.baye && baye.data && baye.data.g_hdFightAllowRetreat != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdFightAllowRetreat = on ? 1 : 0;
                return true;
            }
        } catch (eR) {}
        return false;
    }

    function maybeEndPlayerTurn(fight) {
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        maybeResumePlayerTurn(fight);
        if (state.playerTurnEnded) {
            return false;
        }
        if (playerHasWaitingOwn()) {
            return false;
        }
        if (state.pendingApproach ||
            (state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 1400)) {
            return false;
        }
        if (state.lastRestCommitAt && Date.now() - state.lastRestCommitAt < 1600) {
            return false;
        }
        if (state.queue.length) {
            return false;
        }
        installSysMenuHook();
        var info = null;
        try { info = readFightMenu(); } catch (eInfo) {}
        if (info && info.kind === 'sys' && info.names && info.names.indexOf('回合结束') >= 0) {
            /* fightOpenMainMenu 钩子已经 return 0，再 ENTER 会落到全军撤退。 */
            if (!state.playerTurnEnded) {
                notePlayerTurnEnded('end-player-turn-menu');
                console.log('[hd-battle] rest-commit', { via: 'end-player-turn-hook' });
                console.log('[hd-battle] enemy-turn', { via: 'end-player-turn-hook' });
            }
            return false;
        }
        if (Number(fight.phase) !== 1 || !fight.wait) {
            return false;
        }
        if (state.endTurnAt && Date.now() - state.endTurnAt < 1400) {
            return false;
        }
        state.endTurnAt = Date.now();
        dropQueuedKeys();
        state.openedSysForEndTurn = true;
        state.allowEndTurnEnter = false;
        enqueueKeys([VK.EXIT], 70);
        console.log('[hd-battle] rest-commit', {
            via: 'end-player-turn', hooked: !!state.sysMenuHooked
        });
        setTimeout(function () {
            if (state.playerTurnEnded || !state.openedSysForEndTurn) {
                return;
            }
            /* 只再 EXIT。绝不再 ENTER：系统菜单 leftover 下标 1 是全军撤退。 */
            enqueueKeys([VK.EXIT], 70);
            console.log('[hd-battle] rest-commit', { via: 'end-turn-exit-retry' });
        }, 400);
        return true;
    }

    function preferRest(why) {
        clearPendingApproach();
        state.pendingActPick = 3;
        state.approachRepeatCount = 0;
        writeFightActCommit(3);
        console.log('[hd-battle] rest-commit', {
            via: why || 'prefer-rest', moved: !!state.movedThisAct, commit: 3
        });
        state.lastRestAt = Date.now();
        state.lastRestCommitAt = Date.now();
        forceShowFightMenu(why || 'prefer-rest');
        scheduleDriveSoon('prefer-rest', 260);
    }

    function noteApproachAttempt(via, dest, actor) {
        var viaX = via && via.x;
        var viaY = via && via.y;
        var destX = dest && dest.x;
        var destY = dest && dest.y;
        var key = String(viaX) + ',' + String(viaY) + '>' + String(destX) + ',' + String(destY);
        if (key === state.lastApproachKey) {
            state.approachRepeatCount = (state.approachRepeatCount || 0) + 1;
        } else {
            state.lastApproachKey = key;
            state.approachRepeatCount = 1;
        }
        if (state.approachRepeatCount >= 3) {
            console.log('[hd-battle] approach-loop-break', {
                via: via, dest: dest, actor: actor, n: state.approachRepeatCount
            });
            clearPendingApproach();
            state.walkSubmittedAt = 0;
            state.approachRepeatCount = 0;
            state.lastApproachKey = '';
            state.lastApproachActor = '';
            state.pendingActPick = 3;
            writeFightActCommit(3);
            console.log('[hd-battle] rest-commit', { via: 'approach-loop-break', commit: 3 });
            state.lastRestAt = Date.now();
            state.lastRestCommitAt = Date.now();
            forceShowFightMenu('approach-loop-break');
            scheduleDrive('prefer-rest');
            return true;
        }
        return false;
    }

    function scheduleDrive(why) {
        if (state.driveTimer) {
            return;
        }
        if (!fightReallyActive() || cityMenuOwnsScreen()) {
            resetActDrive();
            return;
        }
        /* BOX 慢 HD：refresh 一帧可超过 setTimeout(0)。丢掉 after-pick 会永远停在 phase=2。 */
        var delay = (state.refreshing || state.samplingFight || state.readingEngine) ? 80 : 0;
        if (state.boxSlowUntil && Date.now() < state.boxSlowUntil && state.boxSlowMs > delay) {
            delay = state.boxSlowMs;
        }
        state.driveTimer = setTimeout(function () {
            state.driveTimer = 0;
            runScheduledDrive(why || 'tick');
        }, delay);
    }

    function scheduleDriveSoon(why, ms) {
        setTimeout(function () {
            scheduleDrive(why || 'soon');
        }, ms == null ? 220 : ms);
    }

    function runScheduledDrive(why) {
        if (!fightReallyActive() || cityMenuOwnsScreen()) {
            resetActDrive();
            return;
        }
        if (state.clickingTile || state.drivingAct) {
            scheduleDrive(why || 'busy');
            return;
        }
        if (state.refreshing || state.samplingFight) {
            var fightBusy = null;
            try { fightBusy = readFight(); } catch (eB) {}
            if (state.pendingApproach && fightBusy && Number(fightBusy.phase) === 2) {
                driveApproach();
                return;
            }
            scheduleDrive(why || 'busy');
            return;
        }
        if (!enterStack('runScheduledDrive')) {
            console.warn('[hd-battle] stack-guard drop', why);
            return;
        }
        try {
            if (state.pendingActPick != null && !state.pendingApproach &&
                wantsWalkBeforeAct(state.pendingActPick) &&
                !holdingActMenu() &&
                !(state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 1600)) {
                var fight0 = readFight();
                var phase0 = fight0 ? (Number(fight0.phase) || 0) : 0;
                if (phase0 === 2) {
                    var foe = nearestEnemy();
                    if (foe) {
                        setPendingApproach(foe.x, foe.y);
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
                var fightOwn = null;
                try { fightOwn = readFight(); } catch (eOwn) {}
                if (fightOwn && Number(fightOwn.phase) === 1) {
                    clearMovedThisAct('pick-next-general');
                }
                noteActingUnit(u);
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
            clearPendingApproach();
        }
        var fight = readFight();
        if (!fight || !fight.active || fight.over || state.resultText) {
            resetActDrive();
            return false;
        }
        if (!playerHasWaitingOwn()) {
            state.pendingActPick = null;
            clearPendingApproach();
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
            if (state.pendingActPick === 3) {
                scheduleDriveSoon('rest-wait-menu', 200);
            }
            return false;
        }
        var phase = Number(fight.phase) || 0;
        if (phase === 3) {
            if (leftoverAim(fight)) {
                if (recentlyLeftAim()) {
                    scheduleDriveSoon('rest-after-aim-exit', 240);
                    return true;
                }
                leaveAimAndRearm('drive-leftover-aim', state.movedThisAct
                    ? { thenRest: true } : null);
                return true;
            }
            return false;
        }
        if (phase === 2 && state.pendingActPick === 3) {
            /* 待机：先 ENTER 落定当前格，g_hdFightActCommit=3 让 FgtGetPCmd 直接 CMD_REST。 */
            if (Date.now() - (state.lastRestAt || 0) < 280) {
                return true;
            }
            dropQueuedEnters();
            writeFightActCommit(3);
            enqueueKeys([VK.ENTER], 55);
            state.movedThisAct = true;
            state.walkSubmittedAt = Date.now();
            state.lastRestCommitAt = Date.now();
            console.log('[hd-battle] rest-commit', { via: 'stay-then-rest', phase: 2, wait: !!fight.wait, commit: 3 });
            state.lastRestAt = Date.now();
            state.pendingActPick = null;
            return true;
        }
        if (phase === 2 && wantsWalkBeforeAct(state.pendingActPick)) {
            /* 点「攻击」后停在 FgtGenMove。超距就走近再打，绝不原地回车进瞄准。 */
            if (!state.pendingApproach) {
                var foe = nearestEnemy();
                if (foe) {
                    setPendingApproach(foe.x, foe.y);
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

    function dumpEnterSwallow(why, extra) {
        var nowDump = Date.now();
        if (why === state.lastSwallowWhy && state.lastSwallowAt &&
            nowDump - state.lastSwallowAt < 400) {
            return extra || {};
        }
        state.lastSwallowAt = nowDump;
        state.lastSwallowWhy = why || '';
        var fight = null;
        var info = null;
        try { fight = readFight(); } catch (eF) {}
        try { info = readFightMenu(); } catch (eI) {}
        var rec = extra || {};
        rec.why = why || 'enter-swallowed';
        rec.phase = fight ? Number(fight.phase) : null;
        rec.wait = !!(fight && fight.wait);
        rec.over = !!(fight && fight.over);
        rec.menuIndex = state.menuIndex;
        rec.menuKind = info && info.kind;
        rec.menuNames = info && info.names;
        rec.synthetic = !!(info && info.synthetic);
        rec.willCloseMenu = why === 'willCloseMenu';
        rec.aimOor = state.lastBlockedEnter === 'aim-oor';
        rec.leaving = !!state.leavingAim;
        rec.awaiting = awaitingAim();
        rec.legal = hasLegalAimTarget();
        rec.adj = !!adjacentEnemy(1);
        rec.rng = atkRngReady();
        rec.ended = recentlyEndedTurn();
        rec.moved = !!state.movedThisAct;
        rec.sawMove = !!state.sawMoveThisTurn;
        rec.sysEnd = !!state.openedSysForEndTurn;
        rec.hooked = !!state.sysMenuHooked;
        rec.actor = state.actorAt;
        rec.queue = state.queue.map(function (q) { return keyName(q.code); });
        rec.hold = holdingActMenu();
        rec.tip = state.fightTip;
        console.log('[hd-battle] enter-swallowed', rec);
        return rec;
    }

    function resetActMenuIndex(why) {
        if (state.menuIndex) {
            console.log('[hd-battle] menu-index-reset', {
                via: why || 'reset', from: state.menuIndex
            });
        }
        state.menuIndex = 0;
    }

    function nearestEnemy() {
        var actor = actingActor();
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
            var fightBusy = null;
            try { fightBusy = readFight(); } catch (eB) {}
            /* phase=2 走近只 enqueue 方向键，refresh 期间也能发；选将 click 仍须让开。 */
            if (!(fightBusy && Number(fightBusy.phase) === 2 && state.pendingApproach)) {
                scheduleDriveSoon('approach-busy-refresh', 80);
                return false;
            }
        }
        if (state.drivingAct || !state.pendingApproach) {
            return false;
        }
        if (!wantsWalkBeforeAct(state.pendingActPick) && state.pendingActPick != null) {
            clearPendingApproach();
            return false;
        }
        if (!enterStack('driveApproach')) {
            scheduleDriveSoon('approach-stack', 80);
            return false;
        }
        try {
        var fight = readFight();
        if (!fight || !fight.active || fight.over) {
            return false;
        }
        if (state.sending || state.queue.length) {
            scheduleDriveSoon('approach-wait-keys', 80);
            return false;
        }
        if (!fight.wait) {
            if (!recentlyEndedTurn() && !state.movedThisAct && !state.sawMoveThisTurn &&
                liveActMenu() && (Number(fight.phase) || 0) === 0) {
                dumpEnterSwallow('leftover-act-exit', { via: 'drive-approach-nowait' });
                resetActMenuIndex('leftover-act');
                enqueueKeys([VK.EXIT], 70);
                scheduleDrive('after-leftover-act-exit');
                return true;
            }
            return false;
        }
        var phase = Number(fight.phase) || 0;
        var dest = state.pendingApproach;
        if (phase === 2) {
            clearPendingApproach();
            /* 走格一旦提交，把「攻击」意图交给落点后的真菜单，才能点待机。 */
            if (wantsWalkBeforeAct(state.pendingActPick)) {
                state.pendingActPick = null;
            }
            var actor = syncFocusFromEngine();
            var closer = findCloserMoveTile(actor.x, actor.y, dest.x, dest.y);
            if (closer && closer.x === actor.x && closer.y === actor.y) {
                closer = null;
            }
            if (closer) {
                if (noteApproachAttempt(closer, dest, actor)) {
                    return true;
                }
                console.log('[hd-battle] approach walk', dest, 'via', closer);
                state.walkSubmittedAt = Date.now();
                state.movedThisAct = true;
                state.sawMoveThisTurn = true;
                noteActingUnit({ x: closer.x, y: closer.y, name: actor && actor.name });
                walkFocusTo(closer.x, closer.y, true);
                scheduleActRearm('after-approach');
                return true;
            }
            /* 已贴脸或无更近格：落定当前格，随后 pendingActPick 选攻击。 */
            state.walkSubmittedAt = Date.now();
            state.movedThisAct = true;
            state.sawMoveThisTurn = true;
            enqueueKeys([VK.ENTER], 55);
            scheduleActRearm('after-approach');
            return true;
        }
        if (phase === 2) {
            state.sawMoveThisTurn = true;
        }
        if (phase === 1 || phase === 0) {
            if (recentlyEndedTurn()) {
                clearPendingApproach();
                return false;
            }
            if (state.movedThisAct) {
                /* 本将走格已花：PlcSplMenu 只能瞄准/待机，禁止再 pick-approach。 */
                clearPendingApproach();
                return false;
            }
            if (liveActMenu() && (state.sawMoveThisTurn || Number(fight.phase) === 0) &&
                fight && !fight.wait) {
                /* 真 PlcSplMenu（走完 wait=0）才挡。回合后 leftover 攻击字节不能挡走近。 */
                if (state.sawMoveThisTurn) {
                    clearPendingApproach();
                    return false;
                }
                dumpEnterSwallow('leftover-act-exit', { via: 'drive-approach' });
                resetActMenuIndex('leftover-act');
                enqueueKeys([VK.EXIT], 70);
                scheduleDrive('after-leftover-act-exit');
                return true;
            }
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
                    scheduleDriveSoon('after-pick', 90);
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
        installSysMenuHook();
        if (!fight || !fight.active) {
            state.lastWait = 0;
            return;
        }
        var w = fight.wait ? 1 : 0;
        if (w !== state.lastWait) {
            if (w === 1) {
                /* 进选将/走格/瞄准：上一份行动菜单必须藏掉，否则挡棋盘点击。 */
                if (!holdingActMenu() && !leftoverAim(fight)) {
                    clearLiveFightMenu();
                }
                state.sawWait = true;
                state.fightTip = '';
                if (!holdingActMenu()) {
                    dropQueuedEnters();
                }
                /* 选将（phase 1）是新的一将；瞄准/走格不要放开 willCloseMenu 的残留武装。 */
                if (Number(fight.phase) === 2) {
                    state.sawMoveThisTurn = true;
                }
                if ((Number(fight.phase) || 0) <= 1) {
                    state.needWaitBeforeMenu = false;
                    state.movedThisAct = false;
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
        var fightNowPick = null;
        try { fightNowPick = readFight(); } catch (eF) {}
        if (fightNowPick && fightNowPick.over) {
            return;
        }
        var liveKind = null;
        try {
            var liveInfo = readFightMenu();
            liveKind = liveInfo && liveInfo.kind;
        } catch (eKind) {}
        if (liveKind === 'sys' || liveKind === 'confirm') {
            if (index === 1 || liveKind === 'confirm') {
                state.allowRetreatArmed = true;
                writeFightAllowRetreat(1);
                console.log('[hd-battle] retreat-selected', { via: 'menu-click', index: index, kind: liveKind });
                return;
            }
            if (index === 0 && liveKind === 'sys') {
                if (!state.openedSysForEndTurn || recentlyEndedTurn()) {
                    dumpEnterSwallow('sys-enter-blocked', { index: index, kind: liveKind });
                    return;
                }
            } else {
                dumpEnterSwallow('sys-menu-skip', { index: index, kind: liveKind });
                return;
            }
        }
        if (index === 0 && !playerHasWaitingOwn() && liveKind !== 'sys') {
            console.log('[hd-battle] attack-skip', { why: 'no-waiting-own' });
            return;
        }
        if (index === 0 && liveKind !== 'sys') {
            if (recentlyEndedTurn()) {
                console.log('[hd-battle] attack-skip', { why: 'after-end-turn' });
                return;
            }
            state.pendingActPick = 0;
            state.lastAttackAt = Date.now();
            logAttackClick('pick');
            var fightAtk = null;
            try { fightAtk = readFight(); } catch (eAtk) {}
            noteAimPhase(fightAtk);
            if (fightAtk && Number(fightAtk.phase) === 3 && !leftoverAim(fightAtk)) {
                /* 已在真瞄准：再点攻击不得 EXIT / 不得把菜单盖住棋盘。 */
                console.log('[hd-battle] aim-enter', { why: 'attack-already-aiming', legal: hasLegalAimTarget() });
                return;
            }
            state.holdActMenuUntil = Date.now() + 1600;
            forceRevealActMenu('attack-click');
            armBlankMenuWatchdog('after-attack');
            if (leftoverAim(fightAtk)) {
                var foe = nearestEnemy();
                leaveAimAndRearm('attack-leftover-aim', state.movedThisAct
                    ? { thenRest: true }
                    : (foe ? { thenApproach: { x: foe.x, y: foe.y } } : { thenRest: true }));
                return;
            }
            /* PlcSplMenu 真菜单 wait=0 且本将已走格才 ENTER 攻击。否则先走近。 */
            if (!canCommitActMenu(fightAtk)) {
                state.autoActTries = 0;
                state.lastAutoActAt = 0;
                state.menuIndex = 0;
                var foeAtk = nearestEnemy();
                if (foeAtk && !state.movedThisAct) {
                    setPendingApproach(foeAtk.x, foeAtk.y);
                    state.pendingActPick = 0;
                    console.log('[hd-battle] open-aim', { why: 'attack-then-walk', unit: foeAtk.name });
                }
                scheduleDriveSoon('attack-then-walk', 70);
                return;
            }
            /* FgtDealMan：FgtGenMove 已返回才会到 PlcSplMenu。此后只能瞄准，不能再走近。 */
            if (!adjacentEnemy(1)) {
                console.log('[hd-battle] attack-skip', { why: 'not-adjacent' });
                preferRest('attack-not-adjacent');
                return;
            }
            state.movedThisAct = true;
            noteAwaitingAim(2200);
            state.holdActMenuUntil = 0;
            resetActMenuIndex('attack-commit');
        }
        if (index === 2 || index === 3) {
            /* 查看/待机：清掉上场走近残留，避免下一将选将时 driveApproach 重入。 */
            var fightRestEarly = null;
            try { fightRestEarly = readFight(); } catch (eRestE) {}
            var stuckMove = approachStuck(fightRestEarly) || walkFinishedLeftover(fightRestEarly) ||
                (!!state.pendingApproach && fightRestEarly && Number(fightRestEarly.phase) === 2 &&
                    fightRestEarly.wait && approachAgeMs() >= 1600);
            if (stuckMove) {
                flushStuckApproach('rest-stuck-move');
            } else {
                clearPendingApproach();
            }
            state.approachRepeatCount = 0;
            if (index === 3) {
                if (recentlyEndedTurn()) {
                    dumpEnterSwallow('rest-enter-blocked', { via: 'after-end-turn' });
                    return;
                }
                var phase2Wait = !!(fightRestEarly && Number(fightRestEarly.phase) === 2 &&
                    fightRestEarly.wait);
                if (stuckMove || phase2Wait) {
                    state.lastRestAt = Date.now();
                    state.lastRestCommitAt = Date.now();
                    state.pendingActPick = 3;
                    writeFightActCommit(3);
                    console.log('[hd-battle] rest-commit', {
                        via: stuckMove ? 'stuck-move' : 'move-phase-rest',
                        phase: fightRestEarly ? Number(fightRestEarly.phase) : null,
                        wait: !!(fightRestEarly && fightRestEarly.wait),
                        commit: 3
                    });
                    scheduleDrive(stuckMove ? 'rest-stuck-move' : 'rest-move-phase');
                    return;
                }
                if (!liveActMenu() || (!state.movedThisAct && !state.sawMoveThisTurn)) {
                    dumpEnterSwallow('rest-enter-blocked', {
                        via: !liveActMenu() ? 'no-live-act' : 'not-walked'
                    });
                    return;
                }
                state.lastRestAt = Date.now();
                state.lastRestCommitAt = Date.now();
                var fightRest = fightRestEarly;
                if (fightRest && Number(fightRest.phase) === 3) {
                    writeFightActCommit(3);
                    leaveAimAndRearm('rest-cancel-aim', { thenRest: true });
                    state.pendingActPick = 3;
                    console.log('[hd-battle] rest-commit', { via: 'cancel-aim', phase: 3, commit: 3 });
                    return;
                }
                /* 待机只走 g_hdFightActCommit=3。DOWN×3 ENTER 在慢盒会落到全军撤退。 */
                writeFightActCommit(3);
                resetActMenuIndex('rest-commit');
                console.log('[hd-battle] rest-commit', {
                    via: 'act-commit',
                    phase: fightRest ? Number(fightRest.phase) : null,
                    wait: !!(fightRest && fightRest.wait),
                    commit: 3
                });
                state.pendingActPick = null;
                clearMovedThisAct('rest-act-commit');
                if (fightRest && !fightRest.wait) {
                    enqueueKeys([VK.ENTER], 55);
                } else {
                    scheduleDrive('prefer-rest');
                }
                return;
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
        /* PlcSplMenu / FgtMainMenu 每次打开引擎 idx 都是 0。上场待机留下的
         * menuIndex=3 再点攻击会连发 UP，落到全军撤退（case 1 fallthrough）。 */
        if (info && (info.kind === 'act' || info.kind === 'sys') && !info.synthetic) {
            dropQueuedKeys();
        }
        var cur = (info && (info.kind === 'act' || info.kind === 'sys') && !info.synthetic)
            ? 0 : state.menuIndex;
        if (cur == null || cur < 0) {
            cur = 0;
        }
        if (index === 3) {
            dumpEnterSwallow('rest-nav-skipped', { via: 'pick-fallback' });
            return;
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
        if (index === 0 && fight && !fight.wait && liveKind !== 'sys' && !recentlyEndedTurn()) {
            state.pendingActPick = null;
            state.lastAttackAt = Date.now();
            scheduleActRearm('after-attack');
        }
        } finally {
            state.pickingMenu = false;
            leaveStack();
        }
    }

    function pickFightMenuName(name) {
        if (name === '全军撤退') {
            state.allowRetreatArmed = true;
            writeFightAllowRetreat(1);
            console.log('[hd-battle] retreat-selected', { via: 'pick-name' });
            return { ok: true, index: 1, kind: 'sys', names: ['全军撤退'] };
        }
        if (name === '回合结束') {
            if (state.playerTurnEnded || recentlyEndedTurn()) {
                return { ok: false, reason: 'after-end-turn' };
            }
            if (state.openedSysForEndTurn) {
                return { ok: true, index: 0, kind: 'sys', names: ['回合结束'], pending: true };
            }
            dropQueuedKeys();
            installSysMenuHook();
            state.openedSysForEndTurn = true;
            state.allowEndTurnEnter = true;
            enqueueKeys([VK.EXIT], 70);
            console.log('[hd-battle] rest-commit', { via: 'pick-end-turn' });
            return { ok: true, index: 0, kind: 'sys', names: ['回合结束'] };
        }
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
            if (holdingActMenu()) {
                forceRevealActMenu('render-hold');
                return;
            }
            state.menuKind = '';
            state.menuNames = [];
            panel.hidden = true;
            panel.removeAttribute('data-hd-battle-menu-synthetic');
            panel.classList.remove('is-synthetic', 'is-forced');
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
        if (holdingActMenu()) {
            panel.classList.add('is-forced');
        } else {
            panel.classList.remove('is-forced');
            panel.style.display = '';
            panel.style.pointerEvents = '';
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
        panel.removeAttribute('hidden');
        if (holdingActMenu() || info.synthetic) {
            panel.style.display = 'flex';
            panel.style.flexDirection = 'column';
            panel.style.pointerEvents = 'auto';
            panel.style.zIndex = '30';
        }
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

    function keepAimEnter(why) {
        var fight = null;
        try { fight = readFight(); } catch (eK) {}
        if (awaitingAim()) {
            console.log('[hd-battle] enter-kept', { why: why || 'awaiting-aim' });
            return true;
        }
        if (state.lastHitAt && Date.now() - state.lastHitAt < 900) {
            console.log('[hd-battle] enter-kept', { why: why || 'after-hit' });
            return true;
        }
        if (fight && Number(fight.phase) === 3 && !leftoverAim(fight)) {
            console.log('[hd-battle] enter-kept', { why: why || 'real-aim' });
            return true;
        }
        return false;
    }

    function dropQueuedExits() {
        var keptEx = [];
        var iEx;
        for (iEx = 0; iEx < state.queue.length; iEx++) {
            if (state.queue[iEx].code !== VK.EXIT) {
                keptEx.push(state.queue[iEx]);
            }
        }
        state.queue = keptEx;
    }

    function dropQueuedEnters() {
        if (keepAimEnter('drop-enters')) {
            dropQueuedExits();
            return;
        }
        var kept = [];
        var i;
        for (i = 0; i < state.queue.length; i++) {
            if (state.queue[i].code !== VK.ENTER) {
                kept.push(state.queue[i]);
            }
        }
        if (kept.length !== state.queue.length) {
            dumpEnterSwallow('drop-queued-enters', {
                dropped: state.queue.length - kept.length
            });
        }
        state.queue = kept;
    }

    function dropQueuedKeys() {
        state.queue = [];
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
        if (u && u.side === 'player') {
            noteActingUnit(u);
        }
        var phase = fight && fight.phase != null ? Number(fight.phase) : 0;
        var inRng = u ? inAtkRng(x, y) : false;
        var actorNow = syncFocusFromEngine();
        var enemyDist = (u && u.side === 'enemy' && actorNow.x != null)
            ? chebyshev(actorNow.x, actorNow.y, x, y) : 99;
        if (phase === 3 && u && u.side === 'enemy') {
            noteAimPhase(fight);
            var legal = firstLegalAimEnemy();
            if (inRng === true) {
                return confirmAimHit(u, x, y, 'in-range', { dist: enemyDist });
            }
            if (legal) {
                /* 点到另一格敌军也不能 EXIT：射程内已有合法目标。 */
                return confirmAimHit(legal, legal.x, legal.y, 'legal-redirect', {
                    dist: chebyshev(actorNow.x, actorNow.y, legal.x, legal.y),
                    clicked: { x: x, y: y, name: u.name }
                });
            }
            if (enemyDist <= 1) {
                if (!atkRngReady() && aimAgeMs() < 800) {
                    walkFocusTo(x, y, false);
                    state.pendingAimEnter = { x: x, y: y, at: Date.now(), name: u.name };
                    return {
                        x: x, y: y, enter: false, unit: u.name, phase: phase,
                        blocked: 'aim-wait-rng', inRng: false, dist: enemyDist
                    };
                }
                /* 贴脸：射程表空或未标中也 ENTER，绝不因 leftover 误判而 EXIT。 */
                return confirmAimHit(u, x, y, 'melee-adjacent', { dist: enemyDist });
            }
            if (!leftoverAim(fight) && !atkRngReady() && aimAgeMs() < 800) {
                state.pendingAimEnter = { x: x, y: y, at: Date.now(), name: u.name };
                return {
                    x: x, y: y, enter: false, unit: u.name, phase: phase,
                    blocked: 'aim-wait-rng', inRng: false, dist: enemyDist
                };
            }
            dumpEnterSwallow('aim-oor-false-positive?', {
                x: x, y: y, unit: u && u.name, dist: enemyDist,
                inRng: inRng, legal: !!legal, leftover: leftoverAim(fight)
            });
            dropQueuedEnters();
            state.lastBlockedEnter = 'aim-oor';
            state.fightTip = '超出攻击范围，先走格靠近。';
            console.warn('[hd-battle] aim-oor, cancel aim then approach', x, y);
            leaveAimAndRearm('aim-oor', state.movedThisAct
                ? { thenRest: true }
                : { thenApproach: { x: x, y: y } });
            applyChrome();
            return {
                x: x, y: y, enter: false, unit: u.name, phase: phase,
                tip: state.fightTip, blocked: 'aim-oor', inRng: false
            };
        }
        if ((phase === 1 || phase === 0) && u && u.side === 'enemy') {
            if (recentlyEndedTurn()) {
                return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'after-end-turn' };
            }
            if (!playerHasWaitingOwn()) {
                return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'no-waiting-own' };
            }
            if (awaitingAim()) {
                return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'awaiting-aim' };
            }
            /* 走格已花或已在 PlcSplMenu：只能开 AIM，禁止 pick-approach 盲发 ENTER。 */
            if (state.movedThisAct || liveActMenu()) {
                if (canCommitActMenu(fight) && adjacentEnemy(1)) {
                    clearPendingApproach();
                    state.pendingActPick = 0;
                    console.log('[hd-battle] open-aim', { x: x, y: y, via: 'after-move', unit: u.name });
                    setTimeout(function () {
                        pickFightMenu(0);
                    }, 0);
                    return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'open-aim' };
                }
                return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'wait-act-menu' };
            }
            setPendingApproach(x, y);
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
                if (!state.pendingApproach &&
                    !(state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 2200)) {
                    setPendingApproach(x, y);
                    scheduleDriveSoon('walk-busy-retry', 90);
                }
                return {
                    x: x, y: y, enter: false, unit: u.name, phase: phase,
                    blocked: 'walk-busy', tip: state.fightTip
                };
            }
            var actor = syncFocusFromEngine();
            var closer = findCloserMoveTile(actor.x, actor.y, x, y);
            if (closer && closer.x === actor.x && closer.y === actor.y) {
                closer = null;
            }
            dropQueuedEnters();
            state.lastBlockedEnter = closer ? 'move-closer' : 'aim-oor';
            if (closer) {
                if (noteApproachAttempt(closer, { x: x, y: y }, actor)) {
                    return {
                        x: x, y: y, enter: false, unit: u.name, phase: phase,
                        blocked: 'approach-loop-break', inRng: false
                    };
                }
                console.log('[hd-battle] move closer toward', x, y, 'via', closer.x, closer.y);
                clearPendingApproach();
                if (wantsWalkBeforeAct(state.pendingActPick)) {
                    state.pendingActPick = null;
                }
                state.walkSubmittedAt = Date.now();
                state.movedThisAct = true;
                state.sawMoveThisTurn = true;
                noteActingUnit({ x: closer.x, y: closer.y, name: actor && actor.name });
                walkFocusTo(closer.x, closer.y, true);
                scheduleActRearm('after-approach');
                return {
                    x: closer.x, y: closer.y, enter: true, unit: u.name, phase: phase,
                    toward: { x: x, y: y }, blocked: 'move-closer', inRng: false
                };
            }
            clearPendingApproach();
            if (wantsWalkBeforeAct(state.pendingActPick)) {
                state.pendingActPick = null;
            }
            state.fightTip = '超出攻击范围，先走格靠近。';
            scheduleActRearm('move-oor');
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
            leaveAimAndRearm('aim-own');
            applyChrome();
            return {
                x: x, y: y, enter: false, unit: u.name, phase: phase,
                tip: state.fightTip, blocked: 'aim-own', inRng: false
            };
        }
        if (!enter && phase === 3 && (!u || inRng !== true)) {
            if (hasLegalAimTarget() || likelyAimTarget()) {
                return {
                    x: x, y: y, enter: false, unit: u && u.name, phase: phase,
                    blocked: 'aim-keep', inRng: false
                };
            }
            if (!leftoverAim(fight) && !atkRngReady()) {
                return {
                    x: x, y: y, enter: false, unit: u && u.name, phase: phase,
                    blocked: 'aim-wait-rng', inRng: false
                };
            }
            dropQueuedEnters();
            state.lastBlockedEnter = u ? 'aim-oor' : 'aim-empty';
            console.warn('[hd-battle] blocked ENTER during aim', state.lastBlockedEnter);
            leaveAimAndRearm(state.lastBlockedEnter, state.movedThisAct
                ? { thenRest: true }
                : null);
            applyChrome();
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: phase,
                tip: state.fightTip, blocked: state.lastBlockedEnter, inRng: false
            };
        }
        walkFocusTo(x, y, enter);
        if (phase === 2 && enter) {
            clearPendingApproach();
            if (wantsWalkBeforeAct(state.pendingActPick)) {
                state.pendingActPick = null;
            }
            state.walkSubmittedAt = Date.now();
            state.movedThisAct = true;
            state.sawMoveThisTurn = true;
            scheduleActRearm('after-walk');
        }
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
        state.afterEndTurnUntil = 0;
        state.playerTurnEnded = false;
        state.openedSysForEndTurn = false;
        state.sawMoveThisTurn = false;
        state.lastHitAt = 0;
        state.lastSwallowAt = 0;
        state.lastSwallowWhy = '';
        state.allowEndTurnEnter = false;
        state.actCommit = null;
        state.actCommitAt = 0;
        state.allowRetreatArmed = false;
        state.lastRestCommitAt = 0;
        state.actorAt = null;
        state.awaitingAimUntil = 0;
        state.endTurnAt = 0;
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
        noteAimPhase(fightNow);
        noteFightWait(fightNow);
        recoverFightMenu(fightNow);
        clearStuckApproach(fightNow);
        if (state.pendingActPick != null && !wantsWalkBeforeAct(state.pendingActPick)) {
            clearPendingApproach();
        }
        if (state.pendingApproach && fightNow && Number(fightNow.phase) === 2 &&
            fightNow.wait && !state.driveTimer && !state.drivingAct && !state.clickingTile &&
            approachAgeMs() >= 200) {
            scheduleDrive('refresh-retry-approach');
        }
        noteFightTip(fightNow);
        suppressForeignShells();
        renderFightMenu();
        applyChrome();
        draw();
        if (state.pendingAimEnter && fightNow && Number(fightNow.phase) === 3) {
            var pe = state.pendingAimEnter;
            var peUnit = unitAt(pe.x, pe.y);
            var peLegal = firstLegalAimEnemy();
            var actorPe = syncFocusFromEngine();
            var peDist = (actorPe && actorPe.x != null)
                ? chebyshev(actorPe.x, actorPe.y, pe.x, pe.y) : 99;
            if (inAtkRng(pe.x, pe.y) === true) {
                confirmAimHit(peUnit || { name: pe.name }, pe.x, pe.y, 'wait-rng', {});
            } else if (peLegal) {
                confirmAimHit(peLegal, peLegal.x, peLegal.y, 'wait-rng-legal', {});
            } else if (peDist <= 1 && (atkRngReady() || leftoverAim(fightNow) || aimAgeMs() > 800)) {
                confirmAimHit(peUnit || { name: pe.name }, pe.x, pe.y, 'wait-rng-melee', { dist: peDist });
            } else if (leftoverAim(fightNow) && !recentlyLeftAim()) {
                state.pendingAimEnter = null;
                leaveAimAndRearm('refresh-aim-wait-oor', state.movedThisAct
                    ? { thenRest: true }
                    : { thenApproach: { x: pe.x, y: pe.y } });
            }
        } else if (leftoverAim(fightNow) && !recentlyLeftAim() &&
            Date.now() - (state.lastAimExitAt || 0) > 400) {
            leaveAimAndRearm('refresh-leftover-aim', state.movedThisAct ? { thenRest: true } : null);
        }
        maybeResumePlayerTurn(fightNow);
        maybeEndPlayerTurn(fightNow);
        if (!menuPanelClickable() && !state.blankWatchTimer) {
            armBlankMenuWatchdog('refresh-hidden');
        }
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
            if (!state.open || !fightReallyActive()) {
                return;
            }
            if (keepAimEnter('willCloseMenu')) {
                return;
            }
            resetActMenuIndex('willCloseMenu');
            if (holdingActMenu() || leftoverAim(readFight())) {
                state.needWaitBeforeMenu = false;
                clearPendingApproach();
                state.pendingActPick = null;
                forceRevealActMenu(leftoverAim(readFight()) ? 'leftover-willClose' : 'hold-willClose');
                return;
            }
            clearLiveFightMenu();
            /* 活战不要写掉 g_hdMenuCount：PlcSplMenu 刚开时 onMenuIdle 可能已过，
             * 清字节会让走格后「将领行动」整帧空白，盒子只能切经典战斗。 */
            if (!fightReallyActive()) {
                clearEngineMenuLeftover();
            }
            state.needWaitBeforeMenu = true;
            clearPendingApproach();
            if (state.lastRestAt && Date.now() - state.lastRestAt < 800) {
                logMenuProbe('after-rest');
                state.menuArmLogged = true;
            }
            state.pendingActPick = null;
            dropQueuedEnters();
            dumpEnterSwallow('willCloseMenu', {
                keep: false,
                menuIndex: state.menuIndex
            });
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
                        var exitFight = null;
                        try { exitFight = readFight(); } catch (eEx) {}
                        /* MOVE 卡死：EXIT 取消 FgtGenMove。选将假菜单 EXIT 会打开系统菜单。 */
                        if (exitFight && Number(exitFight.phase) === 2 && exitFight.wait) {
                            flushStuckApproach('menu-exit-move');
                            engineSendKey(VK.EXIT);
                            forceShowFightMenu('exit-stuck-move');
                            return;
                        }
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
                    var idx = Number(t.getAttribute('data-hd-battle-menu'));
                    if (!fightMenuLive()) {
                        forceShowFightMenu('menu-click-dead');
                    }
                    pickFightMenu(idx);
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

    function installSysMenuHook() {
        if (!window.baye) {
            return;
        }
        if (!baye.hooks) {
            baye.hooks = {};
        }
        if (state.sysMenuHooked) {
            return;
        }
        var prev = baye.hooks.fightOpenMainMenu;
        baye.hooks.fightOpenMainMenu = function () {
            try { onEngineHook('fightOpenMainMenu'); } catch (eH) {}
            if (fightReallyActive()) {
                if (state.allowRetreatArmed) {
                    state.allowRetreatArmed = false;
                    writeFightAllowRetreat(1);
                    console.log('[hd-battle] retreat-selected', { via: 'sys-menu-hook' });
                    return 1;
                }
                writeFightAllowRetreat(0);
                console.log('[hd-battle] sys-menu-hook', { ret: 0, ended: !!state.playerTurnEnded });
                console.log('[hd-battle] enemy-turn', { via: 'sys-menu-hook' });
                state.allowEndTurnEnter = false;
                if (!state.playerTurnEnded) {
                    notePlayerTurnEnded('sys-menu-hook');
                }
                /* 0 = 回合结束。绝不能回 1（全军撤退，case 1 fallthrough）。 */
                return 0;
            }
            if (typeof prev === 'function') {
                return prev.apply(this, arguments);
            }
            return -1;
        };
        state.sysMenuHooked = true;
        console.log('[hd-battle] sys-menu-hook', { installed: true });
    }

    function start() {
        bindUi();
        installSysMenuHook();
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
                    state.leavingAim = true;
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
        onRetreatBlocked: function () {
            console.log('[hd-battle] retreat-blocked', {
                via: 'engine', ended: !!state.playerTurnEnded, armed: !!state.allowRetreatArmed
            });
        },
        pickMenuName: pickFightMenuName,
        forceShowFightMenu: forceShowFightMenu,
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
        debugBoxSlow: function (ms, holdMs) {
            state.boxSlowMs = ms == null ? 80 : Number(ms) || 0;
            state.boxSlowUntil = Date.now() + (holdMs == null ? 3500 : Number(holdMs) || 0);
            return { ms: state.boxSlowMs, until: state.boxSlowUntil };
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
                approachArmedAt: state.approachArmedAt || 0,
                approachAgeMs: approachAgeMs(),
                approachStuck: approachStuck(fightSnap),
                menuClickable: menuPanelClickable(),
                walkSubmittedAt: state.walkSubmittedAt,
                leavingAim: !!state.leavingAim,
                leftoverAim: leftoverAim(fightSnap),
                legalAim: hasLegalAimTarget(),
                likelyAim: likelyAimTarget(),
                canCommitAct: canCommitActMenu(fightSnap),
                recentlyEndedTurn: recentlyEndedTurn(),
                playerTurnEnded: !!state.playerTurnEnded,
                openedSysForEndTurn: !!state.openedSysForEndTurn,
                actCommit: state.actCommit,
                lastRestCommitAt: state.lastRestCommitAt || 0,
                allowRetreatArmed: !!state.allowRetreatArmed,
                sawMoveThisTurn: !!state.sawMoveThisTurn,
                awaitingAim: awaitingAim(),
                lastHitAt: state.lastHitAt || 0,
                lastSwallowWhy: state.lastSwallowWhy || '',
                adjacent: !!adjacentEnemy(1),
                actorAt: state.actorAt,
                sysMenuHooked: !!state.sysMenuHooked,
                over: !!(fightSnap && fightSnap.over),
                afterEndTurnUntil: state.afterEndTurnUntil || 0,
                aimEnteredAt: state.aimEnteredAt,
                approachRepeatCount: state.approachRepeatCount,
                lastApproachKey: state.lastApproachKey,
                lastAimExitAt: state.lastAimExitAt,
                lastAttackAt: state.lastAttackAt,
                movedThisAct: !!state.movedThisAct,
                holdActMenuUntil: state.holdActMenuUntil,
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
