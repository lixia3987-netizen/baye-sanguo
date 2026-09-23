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
    var HD_BATTLE_VER = '20260923h';
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
        lordOpenDeferred: false,
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
        lastMeleeTryAt: 0,
        lastRestCommitAt: 0,
        actedThisTurn: 0,
        approachPathWaitAt: 0,
        approachWaitLogs: 0,
        lastArmNextAt: 0,
        holdEndTurnUntil: 0,
        endTurnAt: 0,
        afterEndTurnUntil: 0,
        playerTurnEnded: false,
        openedSysForEndTurn: false,
        sawMoveThisTurn: false,
        lastHitAt: 0,
        fightHitAt: 0,
        lastHitActor: null,
        turnHitActor: null,
        aimCommit: null,
        lastPickEnterAt: 0,
        holdPickUntil: 0,
        lastMenuCommitEnterAt: 0,
        phase1EnterSent: false,
        phase1EnterAt: 0,
        phase1EnterStuckHandled: false,
        phase1EnterCapKey: '',
        phase1StuckUnitKey: '',
        phase1StuckUnitKeys: {},
        phase1StuckTimer: 0,
        pendingPickUnit: '',
        lastAdjMeleeAt: 0,
        lastPickWalkAt: 0,
        lastFirstActMeleeAt: 0,
        lastHpDropAt: 0,
        lastHpDrop: null,
        lastHitHpBefore: null,
        lastHitArmsBefore: null,
        lastPhaseLeaveHoldLogAt: 0,
        lastHitTarget: null,
        sameTileHitN: 0,
        lastAttackClickAt: 0,
        phase1AdjEnterHoldUntil: 0,
        lastOpenAimAt: 0,
        lastOpenAimReselectAt: 0,
        lastPhase0AimAt: 0,
        lastOnTileAimAt: 0,
        phase0AimRetryN: 0,
        phase0IdleTimer: 0,
        lastAdjRecoverAt: 0,
        adjRecoverPickSent: false,
        adjRecoverPickAt: 0,
        adjRecoverPickKey: '',
        adjRecoverPickN: 0,
        adjRecoverGiveUpKey: '',
        adjRecoverStage: '',
        adjRecoverStageAt: 0,
        adjRecoverHoldAt: 0,
        adjRecoverTimer: 0,
        lastAdjRecoverWalkAt: 0,
        lastAdjRecoverWalkDest: '',
        adjRecoverGiveUpAt: 0,
        lastKeyAt: 0,
        afterHitTimer: 0,
        lastEnemyQuietLogAt: 0,
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
        allowRetreatArmed: false,
        endTurnStallN: 0,
        endTurnStallActed: -1,
        endTurnStallAt: 0,
        nextUnitArmedKey: '',
        nextUnitArmedAt: 0,
        keepAttackEnterUntil: 0,
        forceEndTurnUntil: 0,
        endTurnBrokeN: 0,
        stallMeleeTried: false,
        approachedThisAct: false,
        lordHoldRestN: 0,
        lastLeftoverActExitAt: 0,
        pendingHandoff: false,
        handoffAt: 0,
        handoffBanExitUntil: 0,
        handoffSkipKeys: {},
        handoffSkipWhy: {},
        lastHandoffSkipRestAt: 0,
        leftoverAimReopenAt: 0,
        leftoverAimReopenN: 0,
        leftoverAimReopenActor: '',
        leftoverAimReopenTimer: 0,
        phase1FailKey: '',
        phase1FailN: 0
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

    /* 标题/开场/城菜单/不确定一律否。只认 fight().active && !over，不信 leftover 旗标。
     * 已开战场壳时 leftover 城菜单不得因敌回合 flicker 把活战判死。 */
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
                var fgtOver = 0;
                try { fgtOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eOv) {}
                if (state.open && !state.preview && !fgtOver) {
                    state.strictLive = true;
                    return true;
                }
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
            if (code === VK.ENTER && fightReallyActive() && !overNow &&
                fightKey && Number(fightKey.phase) === 1 && fightKey.wait &&
                !state.allowEndTurnEnter) {
                var muteWhy = mutePhase1Enter(fightKey);
                if (muteWhy) {
                    dumpEnterSwallow(muteWhy === 'enemy-turn' ? 'enemy-turn-block' : muteWhy, {
                        key: 'ENTER'
                    });
                    if ((muteWhy === 'pick-throttle' || muteWhy === 'phase1-enter-cap') &&
                        postHitAdjMeleeNeedsEnter()) {
                        clearAdjMeleeThrottle('send-enter-post-hit');
                        /* fall through: 命中后贴脸 ENTER 必须落地 */
                    } else {
                        if (muteWhy === 'enemy-turn') {
                            noteEnemyTurnQuiet('send-enter', fightKey);
                        } else if (muteWhy === 'no-player-pick' || muteWhy === 'enemy-focus') {
                            dropQueuedEnters();
                        } else if (muteWhy === 'pick-throttle' || muteWhy === 'phase1-enter-cap') {
                            dropQueuedEnters();
                            if (muteWhy === 'pick-throttle' &&
                                state.lastHitAt && Date.now() - state.lastHitAt < 2800) {
                                scheduleAfterHitSettle(80);
                            }
                            if (muteWhy === 'phase1-enter-cap') {
                                schedulePhase1StuckRecover(40);
                            }
                        }
                        return false;
                    }
                }
                state.lastPickEnterAt = Date.now();
                notePhase1EnterCommit(fightKey);
                if (liveActMenu() || hdActMenuVisible()) {
                    state.lastMenuCommitEnterAt = Date.now();
                }
                dropQueuedEnters();
            }
            if (code === VK.ENTER && fightKey && Number(fightKey.phase) === 3 && !overNow &&
                !(state.aimCommit && state.aimCommit.onTile)) {
                dumpEnterSwallow('aim-off-tile', {
                    legal: hasLegalAimTarget(),
                    commit: !!(state.aimCommit)
                });
                dropQueuedEnters();
                try { tryCommitMeleeAim('aim-off-tile'); } catch (eOff) {}
                return false;
            }
            if (code === VK.ENTER && fightKey && Number(fightKey.phase) === 3 &&
                state.aimCommit) {
                if (state.aimCommit.hpDropped) {
                    dumpEnterSwallow('aim-commit-block', {
                        hits: state.aimCommit.hits,
                        age: aimCommitAgeMs(),
                        sent: !!state.aimCommit.sentEnter
                    });
                    return false;
                }
                if (!state.aimCommit.sentEnter) {
                    state.aimCommit.sentEnter = true;
                } else if (!state.aimCommit.secondEnterSent && aimCommitAgeMs() > 400) {
                    state.aimCommit.secondEnterSent = true;
                    console.log('[hd-battle] aim-second-enter', {
                        why: 'send-key', unit: state.aimCommit.name, age: aimCommitAgeMs()
                    });
                } else {
                    dumpEnterSwallow('aim-commit-block', {
                        hits: state.aimCommit.hits,
                        age: aimCommitAgeMs(),
                        sent: !!state.aimCommit.sentEnter
                    });
                    return false;
                }
            }
            if (code === VK.EXIT && !overNow && !state.leavingAim && keepAimEnter('send-exit')) {
                dumpEnterSwallow('aim-exit-blocked', { key: 'EXIT' });
                return false;
            }
            if (code === VK.EXIT && fightReallyActive() && !overNow &&
                !state.leavingAim && !state.openedSysForEndTurn && !state.allowEndTurnEnter &&
                !forceEndTurnArmed() && !endTurnBrokeArmed()) {
                /* 真伤交接禁止 leftover EXIT：清状态后等 phase=1 选下一将。 */
                var leftoverActExit = !leftoverExitBanned() && !leftoverHitterMenu(fightKey) &&
                    !!(state.pendingApproach || state.pendingPickUnit) &&
                    fightKey && !fightKey.wait && (Number(fightKey.phase) || 0) === 0 &&
                    !!(state.lastHitAt || state.fightHitAt);
                if (!leftoverActExit) {
                var moreOwn = playerHasWaitingOwn() || endTurnHeld() ||
                    ((state.actedThisTurn || 0) < countPlayerUnits() &&
                        Date.now() - (state.lastRestCommitAt || 0) < 5000);
                if (moreOwn) {
                    dumpEnterSwallow('exit-blocked-more-units', {
                        acted: state.actedThisTurn,
                        players: countPlayerUnits(),
                        waiting: playerHasWaitingOwn(),
                        hold: endTurnHeld()
                    });
                    if (playerHasWaitingOwn() && !nextUnitStalled() && !endTurnBrokeArmed()) {
                        armNextWaitingOwn('exit-blocked');
                    }
                    return false;
                }
                }
            }
            if (fightReallyActive() && state.lastRestCommitAt &&
                Date.now() - state.lastRestCommitAt < 1400 &&
                (code === VK.DOWN || code === VK.UP) &&
                fightKey && !fightKey.wait) {
                /* 只挡 wait=0 菜单导航。wait=1 的上下是走格/选将光标。 */
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
                state.lastKeyAt = Date.now();
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
            if (codes[i] === VK.ENTER && phase1EnterCapBlocksEnter()) {
                if (postHitAdjMeleeNeedsEnter()) {
                    clearAdjMeleeThrottle('enqueue-post-hit');
                } else {
                    dumpEnterSwallow('phase1-enter-cap', { via: 'enqueue' });
                    continue;
                }
            }
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
        if (firstWaitingOwn({ skipLord: true }) || firstWaitingOwn({ lordOnly: true })) {
            return true;
        }
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u && u.side === 'player' && (u.active === 0 || u.active == null) &&
                u.x != null && u.y != null && !actorSpent(u) && !recentlyHitActor(u)) {
                return true;
            }
        }
        return !state.units.length && engineHasWaitingOwn();
    }

    function mainGenIndex() {
        try {
            var n = readNumber(engineData(), 'g_MainGenIdx');
            if (n != null && n >= 0 && n < 10) {
                return n;
            }
        } catch (eM) {}
        return 0;
    }

    function isLordUnit(u) {
        return !!(u && u.side === 'player' && Number(u.i) === mainGenIndex());
    }

    function actingLordUnit() {
        var fu = focusedFightUnit();
        if (fu && isLordUnit(fu)) {
            return fu;
        }
        var actor = null;
        try { actor = syncFocusFromEngine(); } catch (eA) {}
        if (actor && actor.x != null) {
            var u = unitAt(actor.x, actor.y);
            if (isLordUnit(u)) {
                return u;
            }
        }
        if (state.actorAt && state.actorAt.x != null) {
            var au = unitAt(state.actorAt.x, state.actorAt.y);
            if (isLordUnit(au)) {
                return au;
            }
        }
        return null;
    }

    function countPlayerUnits() {
        var n = 0;
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u && u.side === 'player' && u.x != null && u.y != null) {
                n += 1;
            }
        }
        return n;
    }

    function noteUnitActed(why) {
        state.actedThisTurn = (state.actedThisTurn || 0) + 1;
        clearNextUnitStall(why || 'acted');
        console.log('[hd-battle] unit-acted', {
            via: why || 'act',
            n: state.actedThisTurn,
            players: countPlayerUnits(),
            waiting: playerHasWaitingOwn()
        });
    }

    function endTurnHeld() {
        return !!(state.holdEndTurnUntil && Date.now() < state.holdEndTurnUntil);
    }

    function holdEndTurnAfterRest() {
        dropQueuedExits();
        state.holdEndTurnUntil = Date.now() + 2600;
    }

    function forceEndTurnArmed() {
        return !!(state.forceEndTurnUntil && Date.now() < state.forceEndTurnUntil);
    }

    function endTurnBrokeArmed() {
        return (state.endTurnBrokeN || 0) >= 1;
    }

    function nextUnitStalled() {
        if (state.lastHitAt && Date.now() - state.lastHitAt < 12000) {
            return false;
        }
        return (state.endTurnStallN || 0) >= 3;
    }

    function noteNextUnitArm(why, acted, destKey) {
        if (state.endTurnStallActed === acted && state.nextUnitArmedKey === destKey) {
            state.endTurnStallN = (state.endTurnStallN || 0) + 1;
        } else {
            state.endTurnStallActed = acted;
            state.endTurnStallN = 1;
            state.endTurnStallAt = Date.now();
        }
        state.nextUnitArmedKey = destKey || '';
        state.nextUnitArmedAt = Date.now();
        if (state.endTurnStallN >= 2) {
            if (!state.lastStallHoldLogAt || Date.now() - state.lastStallHoldLogAt > 1600) {
                state.lastStallHoldLogAt = Date.now();
                console.log('[hd-battle] next-unit-stall', {
                    via: 'same-dest',
                    why: why || 'arm',
                    n: state.endTurnStallN,
                    acted: acted,
                    dest: destKey || ''
                });
            }
        }
    }

    function clearNextUnitStall(why) {
        if (state.endTurnStallN || state.forceEndTurnUntil || state.endTurnBrokeN) {
            console.log('[hd-battle] next-unit-stall-clear', {
                via: why || 'clear', n: state.endTurnStallN || 0, broke: state.endTurnBrokeN || 0
            });
        }
        state.endTurnStallN = 0;
        state.endTurnStallActed = -1;
        state.endTurnStallAt = 0;
        state.nextUnitArmedKey = '';
        state.nextUnitArmedAt = 0;
        if (why === 'new-player-turn' || why === 'prepare-new') {
            state.forceEndTurnUntil = 0;
            state.endTurnBrokeN = 0;
            state.stallMeleeTried = false;
        }
    }

    function keepAttackCommitEnter(why) {
        var fightKeep = null;
        try { fightKeep = readFight(); } catch (eKeep) {}
        /* AIM 走位时菜单残留 ENTER 必须丢掉，否则会在敌军格外打空。 */
        if (fightKeep && Number(fightKeep.phase) === 3) {
            return !!(state.aimCommit && !state.aimCommit.sentEnter && aimCommitAgeMs() < 220);
        }
        if (state.keepAttackEnterUntil && Date.now() < state.keepAttackEnterUntil) {
            if (why !== 'drop-enters') {
                console.log('[hd-battle] enter-kept', { why: why || 'attack-commit' });
            }
            return true;
        }
        var fight = null;
        try { fight = readFight(); } catch (eK) {}
        if (adjacentEnemy(1) && (state.pendingActPick === 0 || awaitingAim()) &&
            (liveActMenu() || canCommitActMenu(fight))) {
            return true;
        }
        if (adjacentWaitingStrike() && (state.pendingActPick === 0 || hdActMenuVisible() ||
            liveActMenu())) {
            return true;
        }
        return false;
    }

    function forceFinishWaitingOrEndTurn(why) {
        var fightBreak = null;
        try { fightBreak = readFight(); } catch (eB) {}
        if (fightBreak && (Number(fightBreak.phase) === 2 || Number(fightBreak.phase) === 3 ||
            awaitingAim())) {
            return false;
        }
        /* 第一击前禁止 stall-break：走半格待机后 acted≥1 也会把其余将直接结束回合。 */
        if (!state.lastHitAt) {
            if (!state.lastStallHoldLogAt || Date.now() - state.lastStallHoldLogAt > 1600) {
                state.lastStallHoldLogAt = Date.now();
                console.log('[hd-battle] next-unit-stall-hold', {
                    via: 'pre-first-hit', why: why || 'stall'
                });
            }
            return false;
        }
        /* 真伤后 12s 内禁止 stall-break：下一将走近中。 */
        if (Date.now() - state.lastHitAt < 12000) {
            if (!state.lastStallHoldLogAt || Date.now() - state.lastStallHoldLogAt > 1600) {
                state.lastStallHoldLogAt = Date.now();
                console.log('[hd-battle] next-unit-stall-hold', {
                    via: 'post-hit', why: why || 'stall'
                });
            }
            return false;
        }
        dropQueuedEnters();
        clearPendingApproach();
        var already = endTurnBrokeArmed();
        state.endTurnBrokeN = (state.endTurnBrokeN || 0) + 1;
        state.forceEndTurnUntil = Date.now() + 6000;
        state.holdEndTurnUntil = 0;
        var tryMelee = !state.stallMeleeTried && !already &&
            killableAdjAlive() &&
            (liveActMenu() || hdActMenuVisible());
        console.log('[hd-battle] next-unit-stall-break', {
            via: 'stall-break',
            why: why || 'stall',
            n: state.endTurnStallN,
            broke: state.endTurnBrokeN,
            acted: state.actedThisTurn,
            waiting: playerHasWaitingOwn(),
            adj: !!adjacentEnemy(1),
            strike: !!(adjacentWaitingStrike()),
            melee: !!tryMelee
        });
        if ((tryMelee || killableAdjAlive()) && (state.endTurnBrokeN || 0) < 3) {
            state.stallMeleeTried = true;
            state.pendingActPick = 0;
            state.keepAttackEnterUntil = Date.now() + 900;
            clearAdjMeleeThrottle('stall-break-melee');
            if (commitAdjacentMelee('stall-break-melee')) {
                return true;
            }
        }
        if (state.lastHitAt && (state.endTurnBrokeN || 0) >= 2) {
            sysEndPlayerTurn('stall-break-spent');
            return true;
        }
        state.pendingActPick = 3;
        if (already && state.lastRestCommitAt && Date.now() - state.lastRestCommitAt < 1800) {
            scheduleForceEndTurn(200);
            return true;
        }
        preferRest('stall-break-rest');
        scheduleForceEndTurn(480);
        return true;
    }

    function scheduleForceEndTurn(ms) {
        setTimeout(function () {
            if (!fightReallyActive() || state.resultText || state.playerTurnEnded) {
                return;
            }
            var fight = null;
            try { fight = readFight(); } catch (eF) {}
            if (!fight || fight.over || enemyTurnQuiet(fight)) {
                return;
            }
            if (Number(fight.phase) === 2 || Number(fight.phase) === 3 || awaitingAim()) {
                return;
            }
            if (killableAdjAlive() &&
                (liveActMenu() || hdActMenuVisible() || !state.stallMeleeTried)) {
                state.stallMeleeTried = true;
                state.keepAttackEnterUntil = Date.now() + 900;
                clearAdjMeleeThrottle('stall-break-melee');
                if (!commitAdjacentMelee('stall-break-melee')) {
                    pickFightMenu(0);
                }
                return;
            }
            state.forceEndTurnUntil = Date.now() + 4000;
            state.holdEndTurnUntil = 0;
            state.endTurnAt = Date.now();
            state.openedSysForEndTurn = true;
            state.allowEndTurnEnter = false;
            dropQueuedKeys();
            enqueueKeys([VK.EXIT], 70);
            console.log('[hd-battle] rest-commit', {
                via: 'end-player-turn-stall', hooked: !!state.sysMenuHooked
            });
        }, ms == null ? 480 : ms);
    }

    function armNextWaitingOwn(why, opts) {
        opts = opts || {};
        var endTurnWhy = /end-turn|exit-blocked|refresh|after-attack-hit/i.test(why || '');
        if ((forceEndTurnArmed() || endTurnBrokeArmed()) && endTurnWhy) {
            if (!state.lastHitAt && (state.actedThisTurn || 0) < 1) {
                return false;
            }
            if (endTurnBrokeArmed() && /end-turn|exit-blocked/i.test(why || '')) {
                return forceFinishWaitingOrEndTurn(why || 'broke-requeue');
            }
            return false;
        }
        if (!playerHasWaitingOwn()) {
            return false;
        }
        var fightNow = null;
        try { fightNow = readFight(); } catch (eF) {}
        if (enemyTurnQuiet(fightNow)) {
            return false;
        }
        if (leftoverHitterMenu(fightNow)) {
            return false;
        }
        if (!opts.force && state.holdPickUntil && Date.now() < state.holdPickUntil) {
            return false;
        }
        var phaseNow = Number(fightNow && fightNow.phase) || 0;
        /* 本将已在走格/瞄准：禁止 refresh 把 pendingApproach 写回去、打断 melee。 */
        if (phaseNow === 2 && (state.pendingApproach || state.approachPathWaitAt)) {
            return false;
        }
        if (phaseNow === 3 || awaitingAim()) {
            var leftoverAdj = null;
            try { leftoverAdj = namedAdjStrike(); } catch (eLa) { leftoverAdj = null; }
            if (phaseNow === 3 && leftoverAdj && leftoverAdj.unit &&
                leftoverAimNeedsReopen(fightNow, leftoverAdj.unit)) {
                return exitLeftoverAimThenReopen(leftoverAdj.unit, why || 'arm-next-leftover');
            }
            return false;
        }
        if (!opts.force && (liveActMenu() || state.sending || (state.queue && state.queue.length))) {
            return false;
        }
        if (!opts.force && state.lastArmNextAt && Date.now() - state.lastArmNextAt < 1600) {
            return false;
        }
        var nextLord = null;
        var strikeNext = adjacentWaitingStrike();
        var nextOther = (strikeNext && strikeNext.unit) || firstWaitingOwn({ skipLord: true });
        if (!nextOther && (state.lastHitAt || state.fightHitAt)) {
            nextOther = firstWaitingOwn({ skipLord: true, includeStuck: true });
        }
        if (!nextOther) {
            nextLord = firstWaitingOwn({ lordOnly: true });
        }
        if (!nextOther && !nextLord) {
            if (/end-turn|exit-blocked/i.test(why || '')) {
                forceFinishWaitingOrEndTurn(why || 'no-actionable');
            }
            return false;
        }
        var foe = bestEnemyForApproach(nextOther || nextLord) || nearestEnemy();
        var destKey = ((nextOther && nextOther.name) || (nextLord && nextLord.name) || '') +
            '>' + (foe ? foe.name : '') + '@' + String(state.actedThisTurn || 0);
        if (state.nextUnitArmedKey === destKey &&
            state.nextUnitArmedAt && Date.now() - state.nextUnitArmedAt < 4000) {
            if (phaseNow === 2 || phaseNow === 3) {
                var destAdj = strikeNext;
                try { destAdj = destAdj || namedAdjStrike(); } catch (eDa) {}
                if (phaseNow === 3 && destAdj && destAdj.unit &&
                    leftoverAimNeedsReopen(fightNow, destAdj.unit)) {
                    return exitLeftoverAimThenReopen(destAdj.unit, why || 'same-dest-leftover');
                }
                return false;
            }
            state.lastArmNextAt = Date.now();
            noteNextUnitArm(why || 'same-dest', state.actedThisTurn || 0, destKey);
            /* 真伤后同 dest 再失败 2 次才跳过。开战走近 / leftover 交接不得 skip 庞德。 */
            var sameAdj = strikeNext || null;
            try { sameAdj = sameAdj || namedAdjStrike(); } catch (eSa) {}
            if (sameAdj && sameAdj.unit && !isHandoffSkip(sameAdj.unit) &&
                !actorSpent(sameAdj.unit)) {
                state.nextUnitArmedKey = '';
                state.nextUnitArmedAt = 0;
                state.endTurnStallN = 0;
                notePendingPick(sameAdj.unit);
                noteActingUnit(sameAdj.unit);
                clearPendingApproach();
                console.log('[hd-battle] same-dest-adj', {
                    via: why || 'arm-next',
                    unit: sameAdj.unit.name,
                    ux: sameAdj.unit.x,
                    uy: sameAdj.unit.y,
                    enemy: sameAdj.enemy && sameAdj.enemy.name
                });
                if (commitAdjacentMelee('same-dest-adj')) {
                    return true;
                }
                return pickNextCapableAfterGiveUp('same-dest-adj');
            }
            if (state.lastHitAt && !state.pendingHandoff &&
                !leftoverHitterMenu(fightNow) && (state.endTurnStallN || 0) >= 3) {
                markHandoffSkip(nextOther || nextLord, 'same-dest-2');
                state.nextUnitArmedKey = '';
                state.nextUnitArmedAt = 0;
                state.endTurnStallN = 0;
                nextOther = firstWaitingOwn({ skipLord: true }) ||
                    nearestActionableOwn({ skipLord: true }) ||
                    firstWaitingOwn({ skipLord: true, includeStuck: true });
                nextLord = nextOther ? null : firstWaitingOwn({ lordOnly: true });
                if (!nextOther) {
                    if (pickNextAfterHandoffSkip(why || 'handoff-skip-next')) {
                        return true;
                    }
                    return sysEndPlayerTurn(why || 'handoff-skip-end');
                }
                foe = bestEnemyForApproach(nextOther) || nearestEnemy();
                destKey = ((nextOther && nextOther.name) || '') +
                    '>' + (foe ? foe.name : '') + '@' + String(state.actedThisTurn || 0);
            } else {
                if (nextUnitStalled() || endTurnBrokeArmed()) {
                    return forceFinishWaitingOrEndTurn(why || 'same-dest-stall');
                }
                return false;
            }
        }
        if ((nextUnitStalled() || endTurnBrokeArmed()) && endTurnWhy) {
            return forceFinishWaitingOrEndTurn(why || 'stall');
        }
        if (opts.force) {
            dropQueuedEnters();
            clearPickThrottle(why || 'arm-next');
        }
        state.lastArmNextAt = Date.now();
        state.movedThisAct = false;
        state.sawMoveThisTurn = false;
        state.walkSubmittedAt = 0;
        state.approachedThisAct = false;
        if (strikeNext) {
            state.pendingActPick = 0;
            clearPendingApproach();
            notePendingPick(strikeNext.unit);
            noteActingUnit(strikeNext.unit);
            noteNextUnitArm(why || 'after-rest', state.actedThisTurn || 0, destKey);
            console.log('[hd-battle] next-unit', {
                via: why || 'after-rest',
                melee: true,
                name: strikeNext.unit.name,
                dest: { name: strikeNext.enemy.name, x: strikeNext.enemy.x, y: strikeNext.enemy.y },
                acted: state.actedThisTurn
            });
            if (commitAdjacentMelee(why || 'next-unit-melee')) {
                return true;
            }
            scheduleDriveSoon(why || 'next-waiting-melee', 80);
            return true;
        }
        if (nextLord && !adjacentEnemy(1)) {
            /* 还有能走近的副将时禁止落到君主待机环。 */
            var stillOther = firstWaitingOwn({ skipLord: true });
            if (stillOther) {
                nextOther = stillOther;
                nextLord = null;
            }
        }
        if (nextLord && !adjacentEnemy(1) && !nextOther) {
            if (shouldSysEndAfterLordHold()) {
                return sysEndPlayerTurn(why || 'next-lord-end');
            }
            state.pendingActPick = 3;
            clearPendingApproach();
            noteNextUnitArm(why || 'after-rest', state.actedThisTurn || 0, destKey);
            console.log('[hd-battle] next-unit', {
                via: why || 'after-rest',
                lordHold: true,
                name: nextLord.name,
                acted: state.actedThisTurn
            });
            scheduleDriveSoon(why || 'next-lord-hold', 220);
            return true;
        }
        state.pendingActPick = 0;
        if (foe) {
            setPendingApproach(foe.x, foe.y);
        }
        noteNextUnitArm(why || 'after-rest', state.actedThisTurn || 0, destKey);
        console.log('[hd-battle] next-unit', {
            via: why || 'after-rest',
            acted: state.actedThisTurn,
            dest: foe ? { name: foe.name, x: foe.x, y: foe.y } : null,
            stall: state.endTurnStallN || 0
        });
        try { clickWaitingOwn(); } catch (eC) {}
        scheduleDriveSoon(why || 'next-waiting-own', 220);
        return true;
    }

    function countMoveTiles() {
        var n = 0;
        var x;
        var y;
        if (!state.mapW || !state.mapH) {
            return 0;
        }
        for (y = 0; y < state.mapH; y++) {
            for (x = 0; x < state.mapW; x++) {
                if (canMoveTo(x, y) === true && !unitAt(x, y)) {
                    n += 1;
                }
            }
        }
        return n;
    }

    function noteActingUnit(u) {
        if (!u || u.x == null || u.y == null) {
            return;
        }
        var named = u;
        if (!u.name) {
            try { named = resolveNamedActor(u) || u; } catch (eN) { named = u; }
        }
        if (!state.actorAt || state.actorAt.name !== (named.name || u.name || '')) {
            state.staleRngN = 0;
        }
        state.actorAt = {
            x: named.x != null ? named.x : u.x,
            y: named.y != null ? named.y : u.y,
            name: named.name || u.name || '',
            i: named.i != null ? named.i : u.i
        };
    }

    function actingActor() {
        var fight = null;
        try { fight = readFight(); } catch (eA) {}
        var phase = Number(fight && fight.phase) || 0;
        var named = null;
        if (phase === 3 && state.actorAt && state.actorAt.x != null) {
            try { named = resolveNamedActor(state.actorAt); } catch (eR) {}
            return named || state.actorAt;
        }
        /* 刚走完格：用落点，勿用 waitingOwn（焦点常跳回君主马腾，会把贴脸误判成超距）。 */
        if (state.movedThisAct && state.actorAt && state.actorAt.x != null) {
            try { named = resolveNamedActor(state.actorAt); } catch (eM) {}
            return named || state.actorAt;
        }
        var own = waitingOwnUnit();
        if (own) {
            return own;
        }
        if (state.actorAt && state.actorAt.x != null) {
            try { named = resolveNamedActor(state.actorAt); } catch (eA2) {}
            return named || state.actorAt;
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
        var pick = state.pendingPickUnit || '';
        var actor = actingActor();
        var strike = null;
        try { strike = adjacentWaitingStrike(); } catch (eS) {}
        /* 只挡正交贴脸。对角 chebyshev=1 还要再走近一格，不能 skip。 */
        if (x != null && y != null && pick) {
            if (actor && unitCapKey(actor) === pick && unitMeleeEnemy(actor)) {
                console.log('[hd-battle] approach-skip-adj', {
                    via: 'actor', name: actor.name, dest: { x: x, y: y }
                });
                return false;
            }
            if (strike && strike.unit && unitCapKey(strike.unit) === pick &&
                unitMeleeEnemy(strike.unit)) {
                console.log('[hd-battle] approach-skip-adj', {
                    via: 'strike', name: strike.unit.name, dest: { x: x, y: y }
                });
                return false;
            }
        }
        state.pendingApproach = { x: x, y: y };
        if (!state.approachArmedAt) {
            state.approachArmedAt = Date.now();
        }
        return true;
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
        /* AIM 期间 leftover pendingApproach 会让 blank-watchdog 卡在 phase=3。 */
        if (fight && Number(fight.phase) === 3) {
            if (state.pendingApproach) {
                clearPendingApproach();
                if (state.pendingActPick === 0) {
                    state.pendingActPick = null;
                }
            }
            return;
        }
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
            if (u.hp != null && Number(u.hp) <= 0) {
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

    function unitAdjacentEnemy(unit, maxD) {
        var limit = maxD == null ? 1 : maxD;
        var best = null;
        var bestD = 99;
        var i;
        if (!unit || unit.x == null || unit.y == null) {
            return null;
        }
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'enemy' || u.x == null || u.y == null) {
                continue;
            }
            if (u.hp != null && Number(u.hp) <= 0) {
                continue;
            }
            var d = chebyshev(unit.x, unit.y, u.x, u.y);
            if (d <= limit && d < bestD) {
                best = u;
                bestD = d;
            }
        }
        return best;
    }

    /* 近战只认正交贴脸。leftover g_FgtAtkRng（庞德打完还标着方悦）不得把杨秋对角当成能打。 */
    function unitMeleeEnemy(unit) {
        var e = unitAdjacentEnemy(unit, 1);
        if (!e || !enemyIsLiving(e)) {
            return null;
        }
        var dx = Math.abs(unit.x - e.x);
        var dy = Math.abs(unit.y - e.y);
        if (dx + dy === 1) {
            return e;
        }
        if (inAtkRng(e.x, e.y) === true && aimRngMatchesActor(unit)) {
            return e;
        }
        return null;
    }

    function enemyIsLiving(u) {
        if (!u || u.side !== 'enemy' || u.x == null || u.y == null) {
            return false;
        }
        if (u.hp != null && Number(u.hp) <= 0) {
            return false;
        }
        return true;
    }

    function nearestEnemyFrom(actor) {
        actor = actor || actingActor();
        var best = null;
        var bestD = 99;
        var i;
        if (!actor || actor.x == null || actor.y == null) {
            return null;
        }
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'enemy' || u.x == null || u.y == null) {
                continue;
            }
            if (!enemyIsLiving(u)) {
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

    function enemyHasFreeOrtho(e) {
        var dirs;
        var di;
        if (!e || e.x == null || e.y == null) {
            return false;
        }
        dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (di = 0; di < dirs.length; di++) {
            var tx = e.x + dirs[di][0];
            var ty = e.y + dirs[di][1];
            if (tx < 0 || ty < 0 || tx >= state.mapW || ty >= state.mapH) {
                continue;
            }
            if (!unitAt(tx, ty)) {
                return true;
            }
        }
        return false;
    }

    /* 优先能正交贴脸的敌军。方悦两侧被占时改走近王匡。 */
    function bestEnemyForApproach(actor) {
        actor = actor || actingActor();
        var best = null;
        var bestScore = 1e9;
        var i;
        if (!actor || actor.x == null || actor.y == null) {
            return nearestEnemyFrom(actor);
        }
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'enemy' || !enemyIsLiving(u)) {
                continue;
            }
            var d = chebyshev(actor.x, actor.y, u.x, u.y);
            var score = d + (enemyHasFreeOrtho(u) ? 0 : 12);
            if (score < bestScore) {
                best = u;
                bestScore = score;
            }
        }
        return best || nearestEnemyFrom(actor);
    }

    function unitCanReachEnemy(u) {
        if (!u || u.x == null || u.y == null) {
            return false;
        }
        if (unitAdjacentEnemy(u, 1)) {
            return true;
        }
        var foe = nearestEnemyFrom(u);
        if (!foe) {
            return false;
        }
        return chebyshev(u.x, u.y, foe.x, foe.y) <= 8;
    }

    function bindWalkedActor() {
        var name = pendingPickName() || (state.actorAt && state.actorAt.name) || '';
        if (!name) {
            return null;
        }
        var live = peekPlayerByName(name);
        if (!live || !live.name || live.x == null || live.y == null) {
            return null;
        }
        noteActingUnit(live);
        notePendingPick(live);
        return live;
    }

    function movedActorUnit() {
        var bound = null;
        try { bound = bindWalkedActor(); } catch (eB) { bound = null; }
        if (bound && bound.name) {
            if (actorSpent(bound) && !state.movedThisAct) {
                return null;
            }
            if (bound.active === 1 && !state.movedThisAct) {
                return null;
            }
            return bound;
        }
        if (!state.actorAt || state.actorAt.x == null || state.actorAt.y == null) {
            return null;
        }
        var i;
        var byName = null;
        for (i = 0; i < state.units.length; i++) {
            var rec = state.units[i];
            if (!rec || rec.side !== 'player') {
                continue;
            }
            if (state.actorAt.name && rec.name === state.actorAt.name) {
                byName = rec;
                break;
            }
        }
        if (byName) {
            if (actorSpent(byName) && !state.movedThisAct) {
                return null;
            }
            if (byName.active === 1 && !state.movedThisAct) {
                return null;
            }
            return byName;
        }
        var u = unitAt(state.actorAt.x, state.actorAt.y);
        if (u && u.side === 'player' && u.name) {
            if (actorSpent(u) && !state.movedThisAct) {
                return null;
            }
            if (u.active === 1 && !state.movedThisAct) {
                return null;
            }
            return u;
        }
        var resolved = null;
        try { resolved = resolveNamedActor(state.actorAt); } catch (eR) { resolved = null; }
        if (resolved && resolved.name) {
            if (actorSpent(resolved) && !state.movedThisAct) {
                return null;
            }
            if (resolved.active === 1 && !state.movedThisAct) {
                return null;
            }
            return resolved;
        }
        return null;
    }

    function movedActorAdjacentEnemy() {
        var actor = movedActorUnit();
        if (!actor) {
            return null;
        }
        var e = unitMeleeEnemy(actor);
        return (e && enemyIsLiving(e)) ? e : null;
    }

    function aimOrMeleeMovedActor(why) {
        try { bindWalkedActor(); } catch (eBind) {}
        var enemy = movedActorAdjacentEnemy();
        var actor = movedActorUnit();
        if (!enemy || !actor) {
            return false;
        }
        var strike = namedAdjStrike({ unit: actor, enemy: enemy });
        if (!strike || !actorBoundForAim(strike.unit)) {
            console.log('[hd-battle] after-walk-aim-refuse', {
                via: why || 'after-walk',
                actor: actor && actor.name,
                ux: actor && actor.x,
                uy: actor && actor.y
            });
            return false;
        }
        actor = strike.unit;
        enemy = strike.enemy;
        state.pendingActPick = 0;
        noteActingUnit(actor);
        notePendingPick(actor);
        console.log('[hd-battle] after-walk-aim', {
            via: why || 'after-walk',
            unit: actor.name,
            ux: actor.x,
            uy: actor.y,
            enemy: enemy.name,
            ex: enemy.x,
            ey: enemy.y
        });
        if (openAimFromActMenu(why || 'after-walk-aim', strike)) {
            return true;
        }
        if (commitAdjacentMelee(why || 'after-walk-melee')) {
            return true;
        }
        return false;
    }

    function findHitTarget(rec) {
        rec = rec || state.lastHitTarget || (state.aimCommit ? {
            name: state.aimCommit.name, x: state.aimCommit.x, y: state.aimCommit.y
        } : null);
        if (!rec) {
            return null;
        }
        var i;
        var byName = null;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'enemy' || u.x == null || u.y == null) {
                continue;
            }
            if (rec.x != null && u.x === rec.x && u.y === rec.y) {
                return u;
            }
            if (rec.name && u.name === rec.name) {
                byName = byName || u;
            }
        }
        return byName;
    }

    function sameTileHitCapped(enemy) {
        if (!enemy || !state.lastHitTarget) {
            return false;
        }
        if (state.lastHitTarget.x !== enemy.x || state.lastHitTarget.y !== enemy.y) {
            return false;
        }
        return (state.sameTileHitN || 0) >= 8;
    }

    function killableAdjAlive() {
        var waiting = adjacentWaitingStrike();
        if (waiting && waiting.unit && waiting.unit.name && !actorSpent(waiting.unit)) {
            return true;
        }
        var next = nearestNamedAdjAttacker(null);
        return !!(next && next.name && !actorSpent(next));
    }

    function postHitAdjMeleeNeedsEnter() {
        if (!fightReallyActive() || recentlyEndedTurn()) {
            return false;
        }
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        var phase = Number(fight.phase) || 0;
        if (phase === 3) {
            return false;
        }
        /* phase=1 贴脸不再用 ENTER 当近战；recover 自己决定是否 one-shot pick。 */
        if (phase === 1 && fight.wait) {
            return false;
        }
        if (state.phase1AdjEnterHoldUntil && Date.now() < state.phase1AdjEnterHoldUntil) {
            return false;
        }
        var strike = adjacentWaitingStrike();
        var adj = !!(strike || (adjacentEnemy(1) && enemyIsLiving(adjacentEnemy(1))));
        if (!adj) {
            return false;
        }
        if (!(hdActMenuVisible() || liveActMenu() || phase === 0 ||
            phase === 2 || state.pendingActPick === 0)) {
            return false;
        }
        return !!(state.lastHitAt || strike);
    }

    function clearAdjMeleeThrottle(why) {
        clearPickThrottle(why || 'adj-melee');
        clearPhase1EnterCap(why || 'adj-melee');
    }

    function peekPersonArms(id) {
        if (!id || id < 1 || id >= 0xfffe) {
            return null;
        }
        try {
            var persons = engineData() && engineData().g_Persons;
            var p = persons && persons[id - 1];
            if (!p) {
                return null;
            }
            var arms = readNumber(p, 'Arms');
            if (arms == null && p.Arms != null) {
                arms = Number(p.Arms);
            }
            return arms;
        } catch (eA) {}
        return null;
    }

    function peekEnemyCombat(rec) {
        rec = rec || state.lastHitTarget || (state.aimCommit ? {
            name: state.aimCommit.name, x: state.aimCommit.x, y: state.aimCommit.y
        } : null);
        var out = { hp: null, arms: null, id: null, name: '', x: null, y: null };
        if (!rec) {
            return out;
        }
        try {
            var data = engineData();
            var arr = data && data.g_FgtParam && data.g_FgtParam.GenArray;
            var pos = data && data.g_GenPos;
            var i;
            var byName = null;
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
                } catch (eN) {}
                var ux = readNumber(p, 'x');
                if (ux == null && p && p.x != null) {
                    ux = Number(p.x);
                }
                var uy = readNumber(p, 'y');
                if (uy == null && p && p.y != null) {
                    uy = Number(p.y);
                }
                var hp = readNumber(p, 'hp');
                if (hp == null && p && p.hp != null) {
                    hp = Number(p.hp);
                }
                var arms = peekPersonArms(id);
                var hit = {
                    hp: hp, arms: arms, id: id, name: name, x: ux, y: uy
                };
                if (rec.x != null && ux === rec.x && uy === rec.y) {
                    return hit;
                }
                if (rec.name && name === rec.name && byName == null) {
                    byName = hit;
                }
            }
            if (byName) {
                return byName;
            }
        } catch (ePeek) {}
        var t = findHitTarget(rec);
        if (t) {
            out.hp = t.hp;
            out.arms = t.arms != null ? t.arms : peekPersonArms(t.id);
            out.id = t.id;
            out.name = t.name;
            out.x = t.x;
            out.y = t.y;
        }
        return out;
    }

    function peekEnemyHp(rec) {
        var c = peekEnemyCombat(rec);
        return c && c.hp != null ? c.hp : null;
    }

    function aimCommitPending() {
        return !!(state.aimCommit && state.aimCommit.sentEnter &&
            !state.aimCommit.hpDropped && aimCommitAgeMs() < 1600);
    }

    function leftoverExitBanned() {
        return !!(state.pendingHandoff && state.handoffBanExitUntil &&
            Date.now() < state.handoffBanExitUntil);
    }

    function leftoverHitterMenu(fight) {
        if (!fight || fight.over || fight.wait) {
            return false;
        }
        if ((Number(fight.phase) || 0) !== 0) {
            return false;
        }
        if (!liveActMenu()) {
            return false;
        }
        if (state.lastHitAt && Date.now() - state.lastHitAt > 800) {
            return false;
        }
        var fu = null;
        try { fu = focusedFightUnit(); } catch (eFu) { fu = null; }
        if (fu && fu.side === 'player' && fu.name && isHandoffSkip(fu)) {
            return true;
        }
        if (!(state.lastHitAt || state.fightHitAt)) {
            return false;
        }
        if (fu && fu.side === 'player' && fu.name &&
            !actorSpent(fu) && !recentlyHitActor(fu) && !isHandoffSkip(fu)) {
            return false;
        }
        return true;
    }

    function handoffSkipName(u) {
        if (!u) {
            return '';
        }
        if (typeof u === 'string') {
            var cut = u.indexOf('@');
            return cut > 0 ? u.slice(0, cut) : u;
        }
        return String(u.name || '');
    }

    function markHandoffSkip(u, why) {
        var key = typeof u === 'string' ? u : unitCapKey(u);
        var name = handoffSkipName(u);
        if (!key && !name) {
            return;
        }
        if (!state.handoffSkipKeys) {
            state.handoffSkipKeys = {};
        }
        if ((key && state.handoffSkipKeys[key]) || (name && isHandoffSkip(name))) {
            return;
        }
        if (key) {
            state.handoffSkipKeys[key] = Date.now();
        }
        if (name) {
            state.handoffSkipKeys[name] = Date.now();
        }
        if (!state.handoffSkipWhy) {
            state.handoffSkipWhy = {};
        }
        if (name) {
            state.handoffSkipWhy[name] = why || 'skip';
        }
        if (key) {
            state.handoffSkipWhy[key] = why || 'skip';
        }
        console.log('[hd-battle] handoff-skip', { via: why || 'skip', unit: key || name });
    }

    function isHandoffSkip(u) {
        var name = handoffSkipName(u);
        var key = typeof u === 'string' ? u : unitCapKey(u);
        var k;
        if (!state.handoffSkipKeys) {
            return false;
        }
        if (key && state.handoffSkipKeys[key]) {
            return true;
        }
        if (name && state.handoffSkipKeys[name]) {
            return true;
        }
        if (name) {
            for (k in state.handoffSkipKeys) {
                if (state.handoffSkipKeys.hasOwnProperty(k) &&
                    (k === name || k.indexOf(name + '@') === 0)) {
                    return true;
                }
            }
        }
        return false;
    }

    function pruneHandoffSkipMoved() {
        var keep = {};
        var k;
        var live;
        var name;
        var via;
        var nKeep = 0;
        if (!state.handoffSkipKeys) {
            return 0;
        }
        for (k in state.handoffSkipKeys) {
            if (!state.handoffSkipKeys.hasOwnProperty(k) || k.indexOf('@') < 0) {
                continue;
            }
            name = k.slice(0, k.indexOf('@'));
            live = peekPlayerByName(name);
            via = (state.handoffSkipWhy && (state.handoffSkipWhy[k] || state.handoffSkipWhy[name])) || '';
            /* 只保留无掉血 / leftover-AIM 封顶。same-dest / phase1-enter 下回合必须再走近。 */
            if (!/no-drop-aim|leftover-aim-stuck/.test(via)) {
                continue;
            }
            if (live && unitCapKey(live) === k) {
                keep[k] = state.handoffSkipKeys[k];
                keep[name] = state.handoffSkipKeys[name] || Date.now();
                nKeep += 1;
            }
        }
        state.handoffSkipKeys = keep;
        return nKeep;
    }

    function clearHandoffSkip(why) {
        var n = 0;
        var k;
        var kept = 0;
        if ((why === 'new-player-turn' || why === 'prepare-new') && state.handoffSkipKeys) {
            kept = pruneHandoffSkipMoved();
            if (kept) {
                console.log('[hd-battle] handoff-skip-keep', { via: why || 'keep', n: kept });
                return;
            }
        }
        if (state.handoffSkipKeys) {
            for (k in state.handoffSkipKeys) {
                if (state.handoffSkipKeys.hasOwnProperty(k)) {
                    n += 1;
                }
            }
        }
        state.handoffSkipKeys = {};
        state.handoffSkipWhy = {};
        state.lastHandoffSkipRestAt = 0;
        state.phase1FailKey = '';
        state.phase1FailN = 0;
        if (n) {
            console.log('[hd-battle] handoff-skip-clear', { via: why || 'clear', n: n });
        }
    }

    function attackerRank(u) {
        var name = u && u.name ? String(u.name) : '';
        if (name === '庞德' || name === '梁兴') {
            return 0;
        }
        if (name === '马腾') {
            return 1;
        }
        if (name === '杨秋') {
            return 3;
        }
        return 2;
    }

    function finishHandoff(why) {
        if (!state.pendingHandoff && !state.handoffBanExitUntil) {
            return;
        }
        state.pendingHandoff = false;
        state.handoffBanExitUntil = 0;
        console.log('[hd-battle] handoff-ready', { via: why || 'ready' });
    }

    function clearLeftoverAfterHit(why) {
        try { dropQueuedExits(); } catch (eEx) {}
        try { dropQueuedDirs(); } catch (eDir) {}
        state.lastLeftoverActExitAt = 0;
        state.pendingHandoff = true;
        state.handoffAt = Date.now();
        state.handoffBanExitUntil = Date.now() + 450;
        state.leavingAim = false;
        state.awaitingAimUntil = 0;
        state.pendingAimEnter = null;
        if (state.aimCommit && state.aimCommit.hpDropped) {
            try { clearAimCommit('after-hit-clear'); } catch (eAim) {}
        }
        clearPickThrottle(why || 'after-hit-clear');
        writeFightActCommit(0xFF);
        if (state.pendingActPick === 0) {
            state.pendingActPick = null;
        }
        state.leftoverAimReopenN = 0;
        state.leftoverAimReopenActor = '';
        state.leftoverAimReopenAt = 0;
        console.log('[hd-battle] leftover-clear', {
            via: why || 'after-hit',
            actor: state.lastHitActor && state.lastHitActor.name,
            pendingPick: state.pendingPickUnit || '',
            commit: 0xFF
        });
    }

    function noteRealAttackHit(info) {
        /* 每一击都刷新 lastHitAt，否则 5s stall-hold 只护第一击。 */
        state.lastHitAt = Date.now();
        state.fightHitAt = state.lastHitAt;
        state.lastHpDropAt = Date.now();
        state.lastHpDrop = info || state.lastHpDrop;
        state.endTurnBrokeN = 0;
        state.forceEndTurnUntil = 0;
        state.adjRecoverPickN = 0;
        state.adjRecoverPickKey = '';
        state.adjRecoverPickSent = false;
        state.adjRecoverGiveUpAt = 0;
        state.lastAdjRecoverWalkDest = '';
        state.lastHitActor = state.actorAt && state.actorAt.name
            ? { x: state.actorAt.x, y: state.actorAt.y, name: state.actorAt.name }
            : (state.aimCommit && state.aimCommit.actorName
                ? {
                    x: state.aimCommit.actorX,
                    y: state.aimCommit.actorY,
                    name: state.aimCommit.actorName
                }
                : state.lastHitActor);
        if (state.lastHitActor && state.lastHitActor.name) {
            state.turnHitActor = {
                x: state.lastHitActor.x,
                y: state.lastHitActor.y,
                name: state.lastHitActor.name
            };
        }
        /* 真伤后清 give-up/stuck：杨秋等仍 STA_WAIT 的副将必须再走近/AIM。 */
        state.adjRecoverGiveUpKey = '';
        try { clearPhase1StuckUnits('attack-hit'); } catch (eClr) {}
        if (state.pendingPickUnit && state.lastHitActor &&
            state.pendingPickUnit === unitCapKey(state.lastHitActor)) {
            state.pendingPickUnit = '';
        }
        state.movedThisAct = false;
        state.staleRngN = 0;
        noteUnitActed('attack-hit');
        /* 清 leftover EXIT / AIM / pick-throttle / act-commit，禁止交接时 EXIT 连发。 */
        clearLeftoverAfterHit('attack-hit');
        console.log('[hd-battle] attack-hit', {
            via: 'hp-drop',
            unit: info && info.unit,
            x: info && info.x,
            y: info && info.y,
            before: info && info.before,
            after: info && info.after,
            armsBefore: info && info.armsBefore,
            armsAfter: info && info.armsAfter,
            dist: 1
        });
    }

    function verifyHitHpDrop(why) {
        var rec = state.aimCommit || {};
        var before = rec.hpBefore != null ? rec.hpBefore : state.lastHitHpBefore;
        var armsBefore = rec.armsBefore != null ? rec.armsBefore : state.lastHitArmsBefore;
        var target = findHitTarget(rec);
        var combat = peekEnemyCombat(rec);
        if (combat.hp == null && combat.arms == null) {
            try { sampleFight(); } catch (eSamp) {}
            combat = peekEnemyCombat(rec);
            target = findHitTarget(rec) || target;
        }
        var after = combat.hp;
        var armsAfter = combat.arms;
        if (after == null && target && target.hp != null) {
            after = target.hp;
        }
        if (armsAfter == null && target && target.arms != null) {
            armsAfter = target.arms;
        }
        var hadTarget = !!(rec.name || rec.x != null || (state.lastHitTarget && state.lastHitTarget.name));
        /* after==null 且单位表暂时采不到：禁止当成击杀，否则 phase-leave 会假 lastHitAt。 */
        var gone = !!(hadTarget && !target &&
            ((after != null && Number(after) <= 0) || (armsAfter != null && Number(armsAfter) <= 0)));
        /* FgtAtkAction 扣的是 Person.Arms，g_GenPos.hp 开战时算一次不再改。 */
        var dropHp = before != null && after != null && Number(after) < Number(before);
        var dropArms = armsBefore != null && armsAfter != null && Number(armsAfter) < Number(armsBefore);
        var drop = gone || dropHp || dropArms;
        var info = {
            via: why || 'verify',
            unit: combat.name || (target && target.name) || rec.name ||
                (state.lastHitTarget && state.lastHitTarget.name),
            x: combat.x != null ? combat.x : (target && target.x != null ? target.x : rec.x),
            y: combat.y != null ? combat.y : (target && target.y != null ? target.y : rec.y),
            before: before,
            after: after,
            armsBefore: armsBefore,
            armsAfter: armsAfter,
            gone: !!gone,
            drop: !!drop
        };
        if (why === 'phase-leave-hold' && !drop &&
            state.lastPhaseLeaveHoldLogAt && Date.now() - state.lastPhaseLeaveHoldLogAt < 400) {
            return false;
        }
        if (why === 'phase-leave-hold') {
            state.lastPhaseLeaveHoldLogAt = Date.now();
        }
        console.log('[hd-battle] hit-hp ' + JSON.stringify({
            via: info.via,
            unit: info.unit,
            x: info.x,
            y: info.y,
            before: info.before,
            after: info.after,
            armsBefore: info.armsBefore,
            armsAfter: info.armsAfter,
            gone: !!info.gone,
            drop: !!info.drop
        }));
        if (drop) {
            if (state.aimCommit) {
                state.aimCommit.hpDropped = true;
            }
            state.sameTileHitN = 0;
            if (!state.lastHpDropAt || state.lastHpDropAt < (state.aimCommit && state.aimCommit.at || 0)) {
                noteRealAttackHit(info);
            } else {
                state.lastHpDropAt = Date.now();
                state.lastHpDrop = info;
            }
            return true;
        }
        /* 动画空隙 after==null：禁止把已经记下的真伤抹掉。 */
        if (state.lastHitAt || state.fightHitAt || (state.aimCommit && state.aimCommit.hpDropped)) {
            return true;
        }
        if (state.aimCommit) {
            state.aimCommit.hpDropped = false;
        }
        return false;
    }

    /* 任一未行动己方贴脸即可近战。引擎焦点常停在君主马腾，actingActor 会漏掉庞德。 */
    function adjacentWaitingStrike() {
        var i;
        var lordStrike = null;
        var best = null;
        if (state.movedThisAct) {
            var moved = movedActorUnit();
            var movedE = moved && unitMeleeEnemy(moved);
            if (moved && movedE && enemyIsLiving(movedE) && !actorSpent(moved) &&
                !isHandoffSkip(moved) &&
                !(state.adjRecoverGiveUpKey && state.adjRecoverGiveUpKey === unitCapKey(moved))) {
                return { unit: moved, enemy: movedE };
            }
        }
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'player' || u.x == null || u.y == null) {
                continue;
            }
            if (!(u.active === 0 || u.active == null) || actorSpent(u)) {
                continue;
            }
            if (isHandoffSkip(u)) {
                continue;
            }
            var e = unitMeleeEnemy(u);
            if (!e || !enemyIsLiving(e)) {
                continue;
            }
            if (sameTileHitCapped(e)) {
                continue;
            }
            /* 两次选将仍停在 phase1 的贴脸将：先换别人。2.5s 后若仍是唯一贴脸则重试。 */
            if (state.adjRecoverGiveUpKey && state.adjRecoverGiveUpKey === unitCapKey(u)) {
                if (!(state.adjRecoverGiveUpAt && Date.now() - state.adjRecoverGiveUpAt > 2500)) {
                    continue;
                }
                state.adjRecoverGiveUpKey = '';
                state.adjRecoverGiveUpAt = 0;
                state.adjRecoverPickN = 0;
            }
            if (isLordUnit(u)) {
                if (!lordStrike) {
                    lordStrike = { unit: u, enemy: e };
                }
                continue;
            }
            if (!best || attackerRank(u) < attackerRank(best.unit)) {
                best = { unit: u, enemy: e };
            }
        }
        return best || lordStrike;
    }

    /* 真 PlcSplMenu 开着时：贴脸将即使刚走格不再 STA_WAIT，也要能开 AIM。 */
    function liveAdjStrike() {
        var waiting = adjacentWaitingStrike();
        if (waiting) {
            return waiting;
        }
        var actor = actingActor();
        var e = actor && unitMeleeEnemy(actor);
        if (actor && actor.side !== 'enemy' && e && enemyIsLiving(e) &&
            !sameTileHitCapped(e) && !actorSpent(actor) && !isHandoffSkip(actor)) {
            return { unit: actor, enemy: e };
        }
        if (state.actorAt && state.actorAt.x != null) {
            var fromAt = resolveNamedActor(state.actorAt);
            if (fromAt && fromAt.name && !actorSpent(fromAt) && !isHandoffSkip(fromAt)) {
                var eAt = unitMeleeEnemy(fromAt);
                if (eAt && enemyIsLiving(eAt) && !sameTileHitCapped(eAt)) {
                    return { unit: fromAt, enemy: eAt };
                }
            }
        }
        var fu = focusedFightUnit();
        if (fu && fu.side === 'player' && fu.name && !actorSpent(fu) &&
            !isHandoffSkip(fu)) {
            var eFu = unitMeleeEnemy(fu);
            if (eFu && enemyIsLiving(eFu) && !sameTileHitCapped(eFu)) {
                return { unit: fu, enemy: eFu };
            }
        }
        return null;
    }

    function pendingPickName() {
        var key = String(state.pendingPickUnit || '');
        var cut = key.indexOf('@');
        if (cut > 0) {
            return key.slice(0, cut);
        }
        return '';
    }

    function peekEnginePlayer(match) {
        try {
            var data = engineData();
            var arr = data && data.g_FgtParam && data.g_FgtParam.GenArray;
            var pos = data && data.g_GenPos;
            var i;
            for (i = 0; i < 10; i++) {
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
                } catch (eN) {}
                if (!name) {
                    continue;
                }
                var rec = {
                    i: i,
                    id: id,
                    name: name,
                    x: readNumber(p, 'x'),
                    y: readNumber(p, 'y'),
                    hp: readNumber(p, 'hp'),
                    active: readNumber(p, 'active'),
                    side: 'player'
                };
                if (match(rec)) {
                    return rec;
                }
            }
        } catch (eP) {}
        return null;
    }

    function peekPlayerByName(name) {
        if (!name) {
            return null;
        }
        var live = peekEnginePlayer(function (rec) { return rec.name === name; });
        if (live) {
            return live;
        }
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (u && u.side === 'player' && u.name === name) {
                return u;
            }
        }
        return null;
    }

    function peekPlayerAt(x, y) {
        if (x == null || y == null) {
            return null;
        }
        var live = peekEnginePlayer(function (rec) {
            return rec.x === x && rec.y === y;
        });
        if (live) {
            return live;
        }
        var u = unitAt(x, y);
        return (u && u.side === 'player' && u.name) ? u : null;
    }

    function nearestNamedAdjAttacker(hint) {
        var cur = null;
        try { cur = syncFocusFromEngine(); } catch (eC) { cur = null; }
        var hx = hint && hint.x != null ? hint.x : (cur && cur.x);
        var hy = hint && hint.y != null ? hint.y : (cur && cur.y);
        var best = null;
        var bestScore = 1e9;
        var i;
        var pool = [];
        try {
            var data = engineData();
            var arr = data && data.g_FgtParam && data.g_FgtParam.GenArray;
            var pos = data && data.g_GenPos;
            for (i = 0; i < 10; i++) {
                var id = arr ? readNumber(arr, i) : null;
                if (!id || id >= 0xfffe) {
                    continue;
                }
                var p = pos && pos[i] ? pos[i] : {};
                var name = '';
                try {
                    if (typeof baye.getPersonName === 'function') {
                        name = baye.getPersonName(id - 1) || '';
                    }
                } catch (eN2) {}
                if (!name) {
                    continue;
                }
                pool.push({
                    i: i, id: id, name: name,
                    x: readNumber(p, 'x'), y: readNumber(p, 'y'),
                    hp: readNumber(p, 'hp'), active: readNumber(p, 'active'),
                    side: 'player'
                });
            }
        } catch (ePool) {}
        if (!pool.length) {
            pool = state.units;
        }
        for (i = 0; i < pool.length; i++) {
            var u = pool[i];
            if (!u || u.side !== 'player' || !u.name || u.x == null || u.y == null) {
                continue;
            }
            var e = unitMeleeEnemy(u);
            if (!e || !enemyIsLiving(e)) {
                continue;
            }
            if (actorSpent(u) || isHandoffSkip(u) ||
                !(u.active === 0 || u.active == null)) {
                continue;
            }
            if (state.adjRecoverGiveUpKey &&
                String(state.adjRecoverGiveUpKey).indexOf(u.name + '@') === 0) {
                continue;
            }
            var score = (hx != null && hy != null) ? chebyshev(u.x, u.y, hx, hy) : 0;
            if (isLordUnit(u)) {
                score += 5;
            }
            if (score < bestScore) {
                best = u;
                bestScore = score;
            }
        }
        return best;
    }

    /* 空名字 actorAt 不能开 AIM。从 g_GenPos + 光标 + 选将残留找回庞德@11,16。 */
    function resolveNamedActor(hint) {
        var u = null;
        var pickName = pendingPickName();
        /* 走格后 pending 坐标可能还是杨秋@9,16，必须按名字取 live 落点。 */
        if (pickName && !(hint && hint.name && hint.name !== pickName)) {
            u = peekPlayerByName(pickName);
            if (u) {
                return u;
            }
        }
        if (hint && hint.name) {
            u = peekPlayerByName(hint.name);
            if (u) {
                return u;
            }
        }
        if (hint && hint.x != null && hint.y != null) {
            u = peekPlayerAt(hint.x, hint.y);
            if (u) {
                return u;
            }
        }
        if (state.actorAt && state.actorAt.name &&
            !(hint && hint.name && hint.name === state.actorAt.name)) {
            u = peekPlayerByName(state.actorAt.name);
            if (u) {
                return u;
            }
        }
        if (state.actorAt && state.actorAt.x != null &&
            !(hint && hint.x === state.actorAt.x && hint.y === state.actorAt.y)) {
            u = peekPlayerAt(state.actorAt.x, state.actorAt.y);
            if (u) {
                return u;
            }
        }
        var fu = focusedFightUnit();
        if (fu && fu.side === 'player' && fu.name && unitAdjacentEnemy(fu, 1)) {
            return fu;
        }
        return nearestNamedAdjAttacker(hint || state.actorAt || fu);
    }

    function namedAdjStrike(raw) {
        try { bindWalkedActor(); } catch (eBind) {}
        var strike = raw || liveAdjStrike() || adjacentWaitingStrike();
        var unit = resolveNamedActor(strike && strike.unit);
        if (actorSpent(unit) || recentlyHitActor(unit)) {
            unit = nearestNamedAdjAttacker(strike && strike.unit);
        }
        if (!unit || !unit.name) {
            var pickName = pendingPickName();
            if (pickName) {
                unit = peekPlayerByName(pickName);
                if (unit && (actorSpent(unit) || recentlyHitActor(unit))) {
                    unit = nearestNamedAdjAttacker(unit);
                }
            }
        }
        if (unit && isHandoffSkip(unit)) {
            unit = nearestNamedAdjAttacker(unit);
            if (unit && isHandoffSkip(unit)) {
                unit = null;
            }
        }
        if (!unit || !unit.name || actorSpent(unit) || recentlyHitActor(unit) ||
            isHandoffSkip(unit)) {
            if (!pendingPickName() &&
                (!state.lastNamelessRefuseAt || Date.now() - state.lastNamelessRefuseAt > 800)) {
                state.lastNamelessRefuseAt = Date.now();
                console.log('[hd-battle] nameless-actor-refuse', {
                    via: 'named-strike',
                    raw: strike && strike.unit ? {
                        name: strike.unit.name || '',
                        x: strike.unit.x,
                        y: strike.unit.y,
                        active: strike.unit.active
                    } : null,
                    spent: !!(unit && actorSpent(unit)),
                    actorAt: state.actorAt,
                    pending: state.pendingPickUnit || ''
                });
            }
            return null;
        }
        var enemy = unitMeleeEnemy(unit);
        if (!enemy || !enemyIsLiving(enemy)) {
            return null;
        }
        noteActingUnit(unit);
        return { unit: unit, enemy: enemy };
    }

    function readAimType() {
        try {
            var f = readFight();
            if (f && f.aimType != null && f.aimType !== '') {
                return Number(f.aimType);
            }
        } catch (eF) {}
        try {
            if (window.baye && baye.data && baye.data.g_hdFightAimType != null) {
                return Number(baye.data.g_hdFightAimType);
            }
        } catch (eD) {}
        return 0xff;
    }

    function actorBoundForAim(actor) {
        return !!(actor && actor.name && String(actor.name).length);
    }

    function phase0LiveAdjReady(fight) {
        fight = fight || null;
        if (!fight) {
            try { fight = readFight(); } catch (eF) { fight = null; }
        }
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (enemyTurnQuiet(fight) || recentlyEndedTurn()) {
            return false;
        }
        if ((Number(fight.phase) || 0) !== 0 || fight.wait) {
            return false;
        }
        if (!liveActMenu()) {
            return false;
        }
        if (aimCommitPending()) {
            return false;
        }
        return !!namedAdjStrike();
    }

    function notePendingPick(u) {
        state.pendingPickUnit = unitCapKey(u);
    }

    function readFightActCommit() {
        try {
            if (window.baye && baye.data && baye.data.g_hdFightActCommit != null) {
                return Number(baye.data.g_hdFightActCommit);
            }
        } catch (eC) {}
        return state.actCommit;
    }

    function hideSyntheticActMenu(why) {
        try {
            var panel = el('hd-battle-menu');
            var wasOn = !!(panel && !panel.hidden &&
                panel.getAttribute('data-hd-battle-menu-synthetic') === '1');
            if (panel) {
                panel.hidden = true;
                panel.removeAttribute('data-hd-battle-menu-synthetic');
                panel.classList.remove('is-synthetic', 'is-forced');
                try { panel.style.display = 'none'; } catch (eS) {}
            }
            state.holdActMenuUntil = 0;
            if (state.menuKind === 'act' && !liveActMenu()) {
                state.menuKind = '';
                state.menuNames = [];
            }
            if (why && wasOn) {
                console.log('[hd-battle] hide-synthetic-act', { via: why });
            }
        } catch (eH) {}
    }

    function setAdjRecoverStage(stage) {
        if (state.adjRecoverStage !== stage) {
            state.adjRecoverStage = stage || '';
            state.adjRecoverStageAt = Date.now();
        }
    }

    function scheduleAdjRecover(why, ms) {
        if (state.adjRecoverTimer) {
            clearTimeout(state.adjRecoverTimer);
        }
        state.adjRecoverTimer = setTimeout(function () {
            state.adjRecoverTimer = 0;
            try { recoverAdjActThenAim(why || 'adj-recover-tick'); } catch (eT) {}
        }, ms == null ? 160 : ms);
    }

    function giveUpAdjRecover(strike, why, fight) {
        var strikeKey = unitCapKey(strike && strike.unit);
        console.log('[hd-battle] adj-recover-give-up', {
            via: why || 'adj-recover',
            unit: strike && strike.unit && strike.unit.name,
            phase: fight ? Number(fight.phase) : null,
            wait: !!(fight && fight.wait),
            pickN: state.adjRecoverPickN || 0,
            next: 'other-unit'
        });
        state.adjRecoverGiveUpKey = strikeKey;
        state.adjRecoverGiveUpAt = Date.now();
        markPhase1StuckUnit(strikeKey);
        clearPhase1EnterCap('adj-recover-give-up');
        hideSyntheticActMenu('adj-recover-give-up');
        writeFightActCommit(0xFF);
        setAdjRecoverStage('give-up');
        state.movedThisAct = false;
        state.actorAt = null;
        state.adjRecoverPickSent = false;
        state.nextUnitArmedKey = '';
        state.lastArmNextAt = 0;
        pickNextCapableAfterGiveUp('adj-recover-give-up');
        return false;
    }

    function pickNextAfterHandoffSkip(why) {
        var strike = null;
        var next = null;
        try { strike = adjacentWaitingStrike(); } catch (eS) { strike = null; }
        if (strike && strike.unit && !isHandoffSkip(strike.unit) &&
            !actorSpent(strike.unit)) {
            return pickNextCapableAfterGiveUp(why || 'handoff-skip-adj');
        }
        next = nearestActionableOwn({ skipLord: true }) ||
            firstWaitingOwn({ skipLord: true });
        if (!next) {
            try { strike = namedAdjStrike(); } catch (eN) { strike = null; }
            if (strike && strike.unit && !isHandoffSkip(strike.unit) &&
                !actorSpent(strike.unit)) {
                return pickNextCapableAfterGiveUp(why || 'handoff-skip-adj');
            }
            if (!armCapableSkipLord(why || 'handoff-skip-end')) {
                sysEndPlayerTurn(why || 'handoff-skip-end');
            }
            return false;
        }
        return pickNextCapableAfterGiveUp(why || 'handoff-skip-next');
    }

    /* 无掉血 skip 后必须待机清 leftover PlcSplMenu，禁止 leftover 攻击再开同一将 AIM。 */
    function restSkippedThenPickNext(why) {
        var actor = null;
        try { actor = resolveNamedActor(actingActor()); } catch (eA) { actor = actingActor(); }
        dropQueuedEnters();
        dropQueuedDirs();
        state.pendingAimEnter = null;
        state.leavingAim = false;
        if (state.aimCommit) {
            try { clearAimCommit('handoff-skip-rest'); } catch (eC) {}
        }
        writeFightActCommit(3);
        state.pendingActPick = 3;
        state.lastHandoffSkipRestAt = Date.now();
        if (!recentlyLeftAim(700)) {
            exitLeftoverAimOnce(why || 'handoff-skip-rest', {
                thenRest: true,
                unit: actor && actor.name
            });
        }
        if (actor && actor.name) {
            try { noteUnitActed('handoff-skip-rest'); } catch (eN) {}
        }
        console.log('[hd-battle] handoff-skip-rest', {
            via: why || 'no-drop',
            unit: actor && actor.name,
            ux: actor && actor.x,
            uy: actor && actor.y
        });
        setTimeout(function () {
            try {
                var fight = null;
                var phase = 0;
                try { fight = readFight(); } catch (eF) { fight = null; }
                phase = Number(fight && fight.phase) || 0;
                if (phase === 3 && !recentlyLeftAim(700)) {
                    exitLeftoverAimOnce(why || 'handoff-skip-rest-2', { thenRest: true });
                }
                writeFightActCommit(3);
                if (phase === 0 && !!(fight && !fight.wait) && liveActMenu()) {
                    enqueueKeys([VK.ENTER], 55);
                }
            } catch (eR) {}
            setTimeout(function () {
                try { pickNextAfterHandoffSkip(why || 'handoff-skip-rest'); } catch (eP) {}
            }, 280);
        }, 280);
        return true;
    }

    function pickNextCapableAfterGiveUp(why) {
        var strike = adjacentWaitingStrike();
        var next = (strike && strike.unit) ||
            nearestActionableOwn({ skipLord: true }) ||
            firstWaitingOwn({ skipLord: true });
        if (!next && (state.lastHitAt || state.fightHitAt)) {
            next = nearestActionableOwn({ skipLord: true, includeStuck: true }) ||
                firstWaitingOwn({ skipLord: true, includeStuck: true });
        }
        if (!next) {
            return armNextWaitingOwn(why || 'adj-recover-give-up', { force: true });
        }
        notePendingPick(next);
        noteActingUnit(next);
        state.pendingActPick = 0;
        state.movedThisAct = false;
        state.sawMoveThisTurn = false;
        state.walkSubmittedAt = 0;
        var foe = (strike && strike.enemy) || unitAdjacentEnemy(next, 1) ||
            bestEnemyForApproach(next) || nearestEnemyFrom(next);
        if (foe && !(unitAdjacentEnemy(next, 1))) {
            setPendingApproach(foe.x, foe.y);
        }
        console.log('[hd-battle] next-unit', {
            via: why || 'adj-recover-give-up',
            name: next.name,
            x: next.x,
            y: next.y,
            dest: foe ? { name: foe.name, x: foe.x, y: foe.y } : null,
            acted: state.actedThisTurn
        });
        try { clickWaitingOwn(); } catch (eClick) {}
        scheduleDriveSoon(why || 'adj-recover-give-up', 80);
        return true;
    }

    function armPhase0IdleRetry() {
        if (state.phase0IdleTimer) {
            clearTimeout(state.phase0IdleTimer);
        }
        state.phase0IdleTimer = setTimeout(function () {
            state.phase0IdleTimer = 0;
            try {
                var fIdle = readFight();
                if (!phase0LiveAdjReady(fIdle)) {
                    return;
                }
                if (state.lastHitAt && Date.now() - state.lastHitAt < 800) {
                    return;
                }
                if (state.lastOnTileAimAt && Date.now() - state.lastOnTileAimAt < 2000) {
                    return;
                }
                state.lastOpenAimAt = 0;
                state.lastFirstActMeleeAt = 0;
                state.phase0AimRetryN = (state.phase0AimRetryN || 0) + 1;
                console.log('[hd-battle] phase0-idle-retry', {
                    n: state.phase0AimRetryN,
                    idle: state.lastPhase0AimAt ? (Date.now() - state.lastPhase0AimAt) : 0,
                    unit: (liveAdjStrike() && liveAdjStrike().unit && liveAdjStrike().unit.name) || ''
                });
                drivePhase0LiveAdjAim('phase0-idle-1s');
            } catch (eIdle) {}
        }, 1000);
    }

    /* phase=0 wait=false + 真 PlcSplMenu + 攻击 + 贴脸：清节流、开 AIM、走到敌军格再 ENTER。
     * leftover 合成菜单上回车是选将，这里必须 liveActMenu。 */
    function drivePhase0LiveAdjAim(why) {
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        if (!phase0LiveAdjReady(fight)) {
            return false;
        }
        var strike = namedAdjStrike();
        if (!strike) {
            return false;
        }
        clearPendingApproach();
        state.pendingActPick = 0;
        hideSyntheticActMenu('phase0-live-adj');
        clearPickThrottle(why || 'phase0-live-adj');
        clearPhase1EnterCap(why || 'phase0-live-adj');
        var idleMs = state.lastPhase0AimAt ? (Date.now() - state.lastPhase0AimAt) : 1e9;
        var force = !!(why && /idle|force/.test(why)) || idleMs >= 1000;
        if (!force && state.lastOpenAimAt && Date.now() - state.lastOpenAimAt < 420) {
            armPhase0IdleRetry();
            return false;
        }
        if (force) {
            state.lastOpenAimAt = 0;
            state.lastFirstActMeleeAt = 0;
        }
        state.lastPhase0AimAt = Date.now();
        var opened = openAimFromActMenu(why || 'phase0-live-adj', strike);
        if (opened || phase0LiveAdjReady(fight)) {
            armPhase0IdleRetry();
        }
        return opened;
    }

    /* phase=0 wait=false + 攻击高亮 + 贴脸：ENTER 开 AIM，再走到敌军格打真伤。
     * 禁止当成 phase1 选将。 */
    function openAimFromActMenu(why, strike) {
        if (aimCommitPending()) {
            return false;
        }
        strike = namedAdjStrike(strike);
        if (strike && strike.unit && isHandoffSkip(strike.unit)) {
            console.log('[hd-battle] open-aim-refuse', {
                via: 'handoff-skip',
                unit: strike.unit.name
            });
            return false;
        }
        if (!strike || !actorBoundForAim(strike.unit)) {
            console.log('[hd-battle] open-aim-refuse', {
                via: why || 'nameless',
                actorAt: state.actorAt,
                pending: state.pendingPickUnit || ''
            });
            return false;
        }
        var force = !!(why && /idle|force|phase0-live/.test(why));
        if (!force && state.lastOpenAimAt && Date.now() - state.lastOpenAimAt < 420) {
            return false;
        }
        if (recentlyEndedTurn() || (awaitingAim() && !killableAdjAlive() && !force)) {
            return false;
        }
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (enemyTurnQuiet(fight)) {
            return false;
        }
        var phase = Number(fight.phase) || 0;
        if (phase === 3) {
            noteActingUnit(strike.unit);
            if (leftoverAimNeedsReopen(fight, strike.unit)) {
                return exitLeftoverAimThenReopen(strike.unit, why || 'open-aim-leftover');
            }
            return tryCommitMeleeAim(why || 'open-aim');
        }
        var live = liveActMenu();
        /* 必须是 PlcSplMenu 真菜单。phase=0 leftover + 合成「攻击」上回车是选将，不是 AIM。 */
        if (!(phase === 0 && !fight.wait && live)) {
            if (phase === 1 && fight.wait) {
                console.log('[hd-battle] open-aim-reselect', {
                    via: why || 'act-menu',
                    unit: strike.unit.name,
                    ux: strike.unit.x,
                    uy: strike.unit.y,
                    phase: phase
                });
                return recoverAdjActThenAim(why || 'open-aim-reselect');
            }
            return false;
        }
        var focusU = focusedFightUnit();
        if (focusU && focusU.side === 'player' && focusU.name &&
            focusU.name !== strike.unit.name &&
            !(state.lastOpenAimReselectAt && Date.now() - state.lastOpenAimReselectAt < 800)) {
            if (leftoverExitBanned() || leftoverHitterMenu(fight)) {
                console.log('[hd-battle] open-aim-reselect', {
                    via: 'handoff-no-exit',
                    have: focusU.name,
                    want: strike.unit.name
                });
                return false;
            }
            state.lastOpenAimReselectAt = Date.now();
            console.log('[hd-battle] open-aim-reselect', {
                via: why || 'wrong-menu',
                have: focusU.name,
                want: strike.unit.name,
                hx: focusU.x,
                hy: focusU.y
            });
            writeFightActCommit(0xFF);
            enqueueKeys([VK.EXIT], 55);
            setTimeout(function () {
                try { recoverAdjActThenAim(why || 'open-aim-reselect'); } catch (eRs) {}
            }, 180);
            return true;
        }
        state.lastOpenAimAt = Date.now();
        state.lastAdjMeleeAt = Date.now();
        state.lastPhase0AimAt = Date.now();
        noteActingUnit(strike.unit);
        notePendingPick(strike.unit);
        state.pendingActPick = 0;
        state.movedThisAct = true;
        state.sawMoveThisTurn = true;
        state.lastAttackAt = Date.now();
        state.keepAttackEnterUntil = 0;
        noteAwaitingAim(2200);
        state.pendingAimEnter = {
            x: strike.enemy.x, y: strike.enemy.y, at: Date.now(), name: strike.enemy.name
        };
        state.holdActMenuUntil = 0;
        resetActMenuIndex('open-aim-from-act');
        clearPendingApproach();
        clearPickThrottle(why || 'open-aim-from-act');
        clearPhase1EnterCap(why || 'open-aim-from-act');
        writeFightActCommit(0);
        finishHandoff('open-aim-from-act');
        console.log('[hd-battle] open-aim-from-act', {
            via: why || 'act-menu',
            unit: strike.unit.name,
            ux: strike.unit.x,
            uy: strike.unit.y,
            enemy: strike.enemy.name,
            ex: strike.enemy.x,
            ey: strike.enemy.y,
            phase: phase,
            wait: !!fight.wait,
            live: live,
            hdMenu: hdActMenuVisible(),
            force: force
        });
        enqueueKeys([VK.ENTER], 55);
        /* AIM 打开后走到敌军格再 ENTER，禁止 rearm 再灌菜单回车。 */
        setTimeout(function () {
            try {
                var fAim = readFight();
                if (fAim && Number(fAim.phase) === 3) {
                    tryCommitMeleeAim('open-aim-walk');
                }
            } catch (eWalk) {}
        }, 220);
        armPhase0IdleRetry();
        return true;
    }

    /* phase=1 wait + 已贴脸：禁止对将自己格连发 ENTER（phase1-enter-stuck）。
     * 阶段机：walk → hold(焦点停稳+队列空) → 一次 pick ENTER → wait-move
     * → stay ENTER(commit=0xFF 打开 PlcSplMenu) → wait-act → openAim。
     * 禁止 phase1 合成「攻击」/提前 movedThisAct。空格 ENTER 不计 pickN。 */
    function recoverAdjActThenAim(why) {
        var strike = namedAdjStrike(adjacentWaitingStrike());
        var fight = null;
        var cur = null;
        var onUnit = false;
        var phase = 0;
        var queueBusy = false;
        var holdMs = 0;
        var focusStable = false;
        var dist = 99;
        var strikeKey = '';
        var commitNow = 0xFF;
        if (!strike || !actorBoundForAim(strike.unit)) {
            return false;
        }
        if (recentlyEndedTurn()) {
            return false;
        }
        try { fight = readFight(); } catch (eF) {}
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (enemyTurnQuiet(fight)) {
            return false;
        }
        /* 已贴脸禁止走近敌军格：那是 MOVE 会把将领拉开。 */
        clearPendingApproach();
        phase = Number(fight.phase) || 0;
        if (phase === 3) {
            setAdjRecoverStage('');
            noteActingUnit(strike.unit);
            if (leftoverAimNeedsReopen(fight, strike.unit)) {
                return exitLeftoverAimThenReopen(strike.unit, why || 'adj-recover-leftover');
            }
            if (strike.enemy && inAtkRng(strike.enemy.x, strike.enemy.y) === true &&
                aimRngMatchesActor(strike.unit)) {
                return tryCommitMeleeAim(why || 'adj-recover-aim');
            }
            return tryCommitMeleeAim(why || 'adj-recover-aim');
        }
        if (phase === 0 && !fight.wait && liveActMenu()) {
            setAdjRecoverStage('');
            clearPendingApproach();
            clearPickThrottle(why || 'adj-recover-act');
            return drivePhase0LiveAdjAim(why || 'adj-recover-act') ||
                openAimFromActMenu(why || 'adj-recover-act', strike);
        }
        try { cur = engineFocusTile() || syncFocusFromEngine(); } catch (eC) { cur = null; }
        /* 必须引擎光标真的停在该将格。walkFocusTo 乐观坐标会把 ENTER 打到邻格敌军。 */
        onUnit = focusOnNamedUnit(strike.unit);
        if (onUnit) {
            if (!state.adjRecoverHoldAt) {
                state.adjRecoverHoldAt = Date.now();
            }
        } else {
            state.adjRecoverHoldAt = 0;
        }
        queueBusy = !!(state.sending || (state.queue && state.queue.length));
        holdMs = state.adjRecoverHoldAt ? (Date.now() - state.adjRecoverHoldAt) : 0;
        var lastSendAge = state.lastPickEnterAt ? (Date.now() - state.lastPickEnterAt) : 1e9;
        try {
            if (state.lastKeyAt && Date.now() - state.lastKeyAt < lastSendAge) {
                lastSendAge = Date.now() - state.lastKeyAt;
            }
        } catch (eAge) {}
        focusStable = !!(onUnit && !queueBusy && holdMs >= 360 && lastSendAge >= 360);
        if (cur && cur.x != null && cur.y != null) {
            dist = chebyshev(cur.x, cur.y, strike.unit.x, strike.unit.y);
        }
        commitNow = readFightActCommit();
        var recoverSig = [why || '', strike.unit.name, phase, onUnit ? 1 : 0,
            state.adjRecoverStage || '', state.adjRecoverPickN || 0].join('|');
        if (state.lastAdjRecoverLogSig !== recoverSig ||
            !state.lastAdjRecoverLogAt || Date.now() - state.lastAdjRecoverLogAt > 700) {
            state.lastAdjRecoverLogSig = recoverSig;
            state.lastAdjRecoverLogAt = Date.now();
        console.log('[hd-battle] adj-recover-act', {
            via: why || 'adj-recover',
            unit: strike.unit.name,
            ux: strike.unit.x,
            uy: strike.unit.y,
            enemy: strike.enemy.name,
            ex: strike.enemy.x,
            ey: strike.enemy.y,
            onUnit: onUnit,
            focus: cur && { x: cur.x, y: cur.y },
            phase: phase,
            wait: !!fight.wait,
            hdMenu: hdActMenuVisible(),
            live: liveActMenu(),
            stage: state.adjRecoverStage || '',
            holdMs: holdMs,
            stable: focusStable,
            queue: state.queue ? state.queue.length : 0,
            sending: !!state.sending,
            pickN: state.adjRecoverPickN || 0,
            commit: commitNow,
            sysEnd: !!state.openedSysForEndTurn,
            moved: !!state.movedThisAct
        });
        }
        hideSyntheticActMenu('adj-recover-hide');
        if (commitNow != null && commitNow !== 0xFF && phase === 1) {
            writeFightActCommit(0xFF);
        }
        if (phase === 2 && fight.wait) {
            var focusEnemy = false;
            try {
                var ef = engineFocusTile();
                var eu = ef && unitAt(ef.x, ef.y);
                focusEnemy = !!(eu && eu.side === 'enemy');
            } catch (eFe) { focusEnemy = false; }
            if (focusEnemy || !onUnit) {
                if (focusEnemy) {
                    console.log('[hd-battle] adj-recover-no-enemy-enter', {
                        via: why || 'adj-recover',
                        unit: strike.unit.name,
                        ux: strike.unit.x,
                        uy: strike.unit.y,
                        focus: engineFocusTile()
                    });
                }
                if (actingLordUnit()) {
                    writeFightActCommit(3);
                    enqueueKeys([VK.ENTER], 55);
                    scheduleDriveSoon('adj-recover-after-lord-rest', 140);
                    return true;
                }
                if (queueBusy || (dist <= 1 && state.lastAdjRecoverWalkAt &&
                    Date.now() - state.lastAdjRecoverWalkAt < 400)) {
                    setAdjRecoverStage('hold');
                    scheduleAdjRecover('adj-recover-sync-stay', 80);
                    return true;
                }
                setAdjRecoverStage('walk');
                state.lastAdjRecoverWalkAt = Date.now();
                walkFocusTo(strike.unit.x, strike.unit.y, false);
                scheduleAdjRecover('adj-recover-after-walk', 180);
                return true;
            }
            if (queueBusy) {
                setAdjRecoverStage('hold');
                scheduleAdjRecover('adj-recover-hold-stay', 80);
                return true;
            }
            setAdjRecoverStage('stay');
            noteActingUnit(strike.unit);
            notePendingPick(strike.unit);
            state.pendingActPick = 0;
            /* stay 打开 PlcSplMenu，不预写攻击 commit，留给 openAimFromActMenu。 */
            writeFightActCommit(0xFF);
            enqueueKeys([VK.ENTER], 55);
            state.movedThisAct = true;
            state.sawMoveThisTurn = true;
            state.walkSubmittedAt = Date.now();
            scheduleActRearm('adj-recover-stay');
            scheduleAdjRecover('adj-recover-wait-act', 180);
            return true;
        }
        if (!onUnit) {
            if (phase === 2 && fight.wait && actingLordUnit()) {
                writeFightActCommit(3);
                enqueueKeys([VK.ENTER], 55);
                scheduleDriveSoon('adj-recover-after-lord-rest', 140);
                return true;
            }
            if (!(fight.wait && (phase === 1 || phase === 2)) &&
                !(hdActMenuVisible() || liveActMenu())) {
                if (actingLordUnit()) {
                    preferRest('lord-hold-for-strike');
                    scheduleDriveSoon('adj-recover-after-rest', 160);
                    return true;
                }
                scheduleAdjRecover('adj-recover-wait-pick', 80);
                return true;
            }
            if (queueBusy || (dist <= 1 && state.lastAdjRecoverWalkAt &&
                Date.now() - state.lastAdjRecoverWalkAt < 400)) {
                setAdjRecoverStage('hold');
                scheduleAdjRecover('adj-recover-sync-focus', 80);
                return true;
            }
            if (state.lastAdjRecoverWalkAt && Date.now() - state.lastAdjRecoverWalkAt < 180) {
                setAdjRecoverStage('walk');
                return true;
            }
            var walkKey = unitCapKey(strike.unit);
            if (state.lastAdjRecoverWalkDest === walkKey && state.lastAdjRecoverWalkAt &&
                Date.now() - state.lastAdjRecoverWalkAt < 400 &&
                (queueBusy || dist <= 1)) {
                setAdjRecoverStage('walk');
                scheduleAdjRecover('adj-recover-walk-wait', 120);
                return true;
            }
            setAdjRecoverStage('walk');
            state.lastAdjRecoverWalkAt = Date.now();
            state.lastAdjRecoverWalkDest = walkKey;
            state.lastPickWalkAt = Date.now();
            dropQueuedEnters();
            walkFocusTo(strike.unit.x, strike.unit.y, false);
            var walkDelay = 180;
            try {
                var wx = (cur && cur.x != null) ? cur.x : strike.unit.x;
                var wy = (cur && cur.y != null) ? cur.y : strike.unit.y;
                walkDelay = Math.min(1600, 160 + (Math.abs(wx - strike.unit.x) +
                    Math.abs(wy - strike.unit.y)) * 90);
            } catch (eDelay) {}
            scheduleAdjRecover(why || 'adj-recover-after-walk', walkDelay);
            return true;
        }
        noteActingUnit(strike.unit);
        notePendingPick(strike.unit);
        state.pendingActPick = 0;
        strikeKey = unitCapKey(strike.unit);
        if (phase === 1 && fight.wait) {
            if (!focusStable) {
                setAdjRecoverStage('hold');
                scheduleAdjRecover('adj-recover-hold', 80);
                return true;
            }
            if (state.adjRecoverPickKey && state.adjRecoverPickKey !== strikeKey) {
                state.adjRecoverPickN = 0;
            }
            if ((state.adjRecoverPickN || 0) >= 4 && state.adjRecoverPickKey === strikeKey) {
                return giveUpAdjRecover(strike, why, fight);
            }
            if (state.adjRecoverStage === 'wait-move' && state.adjRecoverPickAt &&
                Date.now() - state.adjRecoverPickAt < 900) {
                scheduleAdjRecover('adj-recover-wait-move', 120);
                return true;
            }
            if (state.lastAdjRecoverAt && Date.now() - state.lastAdjRecoverAt < 700) {
                scheduleAdjRecover('adj-recover-pick-gap', 80);
                return true;
            }
            /* 焦点已停在贴脸将上且队列空：最多两次真实选将 ENTER。 */
            setAdjRecoverStage('pick');
            state.lastAdjRecoverAt = Date.now();
            state.adjRecoverPickSent = true;
            state.adjRecoverPickAt = Date.now();
            state.adjRecoverPickKey = strikeKey;
            state.adjRecoverPickN = (state.adjRecoverPickN || 0) + 1;
            writeFightActCommit(0xFF);
            clearPhase1EnterCap('adj-recover-pick');
            clearPickThrottle('adj-recover-pick');
            clearAdjMeleeThrottle(why || 'adj-recover-pick');
            enqueueKeys([VK.ENTER], 55);
            setAdjRecoverStage('wait-move');
            scheduleAdjRecover('adj-recover-after-pick', 220);
            return true;
        }
        setAdjRecoverStage('wait-act');
        scheduleAdjRecover('adj-recover-wait-phase0', 160);
        return true;
    }

    function commitAdjacentMelee(why) {
        if (aimCommitPending()) {
            return false;
        }
        var strike = namedAdjStrike(adjacentWaitingStrike() || liveAdjStrike());
        var fight = null;
        var cur = null;
        var onUnit = false;
        var phase = 0;
        if (!strike || !actorBoundForAim(strike.unit)) {
            console.log('[hd-battle] adj-melee-refuse', {
                via: why || 'nameless',
                actorAt: state.actorAt,
                pending: state.pendingPickUnit || ''
            });
            return false;
        }
        var bypassCool = /post-hit|phase1-stuck|phase1-adj|after-hit|stall-break-melee|rest-blocked|adj-recover|open-aim/.test(why || '');
        if (!bypassCool && state.lastAdjMeleeAt && Date.now() - state.lastAdjMeleeAt < 360) {
            return false;
        }
        if (recentlyEndedTurn()) {
            return false;
        }
        try { fight = readFight(); } catch (eF) {}
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (enemyTurnQuiet(fight)) {
            return false;
        }
        phase = Number(fight.phase) || 0;
        if (phase === 3) {
            noteActingUnit(strike.unit);
            if (leftoverAimNeedsReopen(fight, strike.unit)) {
                return exitLeftoverAimThenReopen(strike.unit, why || 'adj-melee-leftover');
            }
            return tryCommitMeleeAim(why || 'adj-melee-aim');
        }
        if (phase === 0 && !fight.wait && liveActMenu()) {
            clearPickThrottle(why || 'adj-act-aim');
            return drivePhase0LiveAdjAim(why || 'adj-act-aim') ||
                openAimFromActMenu(why || 'adj-act-aim', strike);
        }
        if (phase === 1 && fight.wait) {
            return recoverAdjActThenAim(why || 'adj-phase1-recover');
        }
        clearPendingApproach();
        noteActingUnit(strike.unit);
        notePendingPick(strike.unit);
        state.pendingActPick = 0;
        state.keepAttackEnterUntil = Date.now() + 1400;
        try { cur = syncFocusFromEngine(); } catch (eC) { cur = null; }
        onUnit = !!(cur && cur.x === strike.unit.x && cur.y === strike.unit.y);
        var focusU = (cur && cur.x != null) ? unitAt(cur.x, cur.y) : null;
        /* 焦点还在敌军格上时禁止把 lastPickWalk 当成已走到己方，否则 ENTER 打在敌军身上。 */
        if (!onUnit && state.lastPickWalkAt && Date.now() - state.lastPickWalkAt < 2500 &&
            state.pendingPickUnit === unitCapKey(strike.unit) &&
            !(focusU && focusU.side === 'enemy')) {
            onUnit = true;
        }
        console.log('[hd-battle] adj-melee-commit', {
            via: why || 'adj',
            unit: strike.unit.name,
            ux: strike.unit.x,
            uy: strike.unit.y,
            enemy: strike.enemy.name,
            ex: strike.enemy.x,
            ey: strike.enemy.y,
            onUnit: onUnit,
            focus: cur && { x: cur.x, y: cur.y, name: cur.name },
            phase: phase,
            wait: !!fight.wait,
            hdMenu: hdActMenuVisible(),
            live: liveActMenu()
        });
        /* 先走到贴脸将，禁止和方向键同队列回车（焦点还在君主会被 lord-hold 吞掉）。 */
        if (!onUnit) {
            if (phase === 2 && fight.wait && actingLordUnit()) {
                writeFightActCommit(3);
                enqueueKeys([VK.ENTER], 55);
                scheduleDriveSoon('adj-melee-after-lord-rest', 140);
                return true;
            }
            if (!(fight.wait && (phase === 1 || phase === 2)) &&
                !(hdActMenuVisible() || liveActMenu())) {
                if (actingLordUnit()) {
                    preferRest('lord-hold-for-strike');
                    scheduleDriveSoon('adj-melee-after-rest', 160);
                    return true;
                }
                scheduleDriveSoon('adj-melee-wait-pick', 80);
                return true;
            }
            walkFocusTo(strike.unit.x, strike.unit.y, false);
            state.lastPickWalkAt = Date.now();
            var walkDelay = 180;
            try {
                var wx = (cur && cur.x != null) ? cur.x : strike.unit.x;
                var wy = (cur && cur.y != null) ? cur.y : strike.unit.y;
                walkDelay = Math.min(1600, 160 + (Math.abs(wx - strike.unit.x) +
                    Math.abs(wy - strike.unit.y)) * 90);
            } catch (eDelay) {}
            setTimeout(function () {
                try { commitAdjacentMelee(why || 'adj-melee-after-walk'); } catch (eAfter) {}
            }, walkDelay);
            return true;
        }
        state.lastAdjMeleeAt = Date.now();
        clearAdjMeleeThrottle(why || 'adj-melee-commit');
        if (phase === 2) {
            if (!unitAdjacentEnemy(strike.unit, 1)) {
                console.log('[hd-battle] adj-melee-wait-walk', {
                    unit: strike.unit.name,
                    ux: strike.unit.x,
                    uy: strike.unit.y,
                    enemy: strike.enemy && strike.enemy.name
                });
                return false;
            }
            state.movedThisAct = true;
            state.sawMoveThisTurn = true;
            state.walkSubmittedAt = Date.now();
            writeFightActCommit(0);
            enqueueKeys([VK.ENTER], 55);
            scheduleActRearm('adj-melee-move');
            return true;
        }
        /* 其余相位不再对将自己格 ENTER。等 phase0 真菜单再开 AIM。 */
        if (phase !== 1) {
            forceShowFightMenu(why || 'adj-melee-wait-act');
        }
        scheduleDriveSoon('adj-melee-wait-act', 120);
        return true;
    }

    /* 将领行动已出「攻击」且有人贴脸：phase0 开 AIM；phase1 先恢复菜单。 */
    function maybeCommitFirstActMelee(why) {
        var fightEarly = null;
        try { fightEarly = readFight(); } catch (eE) {}
        if (phase0LiveAdjReady(fightEarly)) {
            return drivePhase0LiveAdjAim(why || 'first-act-aim');
        }
        if (state.lastFirstActMeleeAt && Date.now() - state.lastFirstActMeleeAt < 400) {
            return false;
        }
        if (recentlyEndedTurn() || (aimCommitHolds() && !killableAdjAlive())) {
            return false;
        }
        if (awaitingAim()) {
            var holdFight = null;
            try { holdFight = readFight(); } catch (eH) {}
            /* 仍停在 phase0 真菜单时允许再开 AIM；已进 AIM 则交给 tryCommitMeleeAim。 */
            if (!(holdFight && Number(holdFight.phase) === 0 && !holdFight.wait &&
                liveActMenu())) {
                return false;
            }
        }
        var fight = fightEarly;
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (enemyTurnQuiet(fight)) {
            return false;
        }
        var phase = Number(fight.phase) || 0;
        if (phase === 3) {
            return false;
        }
        if (!(adjacentWaitingStrike() || liveAdjStrike())) {
            return false;
        }
        if (!(hdActMenuVisible() || liveActMenu() || state.pendingActPick === 0 ||
            state.lastAttackAt || phase === 1 || phase === 0 || phase === 2)) {
            return false;
        }
        /* 真 phase0 菜单在时禁止掉进 recover / 走近。 */
        if (phase === 0 && !fight.wait && liveActMenu()) {
            return drivePhase0LiveAdjAim(why || 'first-act-aim');
        }
        state.lastFirstActMeleeAt = Date.now();
        if (phase === 1 && fight.wait) {
            return recoverAdjActThenAim(why || 'first-act-recover');
        }
        return commitAdjacentMelee(why || 'first-act-melee');
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

    function clearAimCommit(why) {
        if (!state.aimCommit) {
            return;
        }
        var rec = state.aimCommit;
        console.log('[hd-battle] aim-commit-clear', {
            via: why || 'clear',
            hits: rec.hits,
            sent: !!rec.sentEnter,
            drop: !!rec.hpDropped,
            success: !!(rec.hpDropped && rec.sentEnter),
            actor: rec.actorName || (state.actorAt && state.actorAt.name) || '',
            unit: rec.name,
            x: rec.x,
            y: rec.y,
            age: Date.now() - rec.at
        });
        /* hits:1 sent:true 但没 after<before：禁止当成命中。 */
        /* phase 离开 AIM 太快时 after-hit-settle 会被清掉。先在敌军格回车记录掉血。 */
        if (rec.sentEnter && rec.onTile && !rec.hpDropped &&
            /phase-leave|fight-over/.test(why || '')) {
            try { verifyHitHpDrop(why || 'phase-leave'); } catch (eDrop) {}
            if (!state.lastHitAt) {
                var lateRec = {
                    name: rec.name, x: rec.x, y: rec.y,
                    hpBefore: rec.hpBefore, sentEnter: true, onTile: true,
                    at: rec.at || Date.now()
                };
                setTimeout(function () {
                    if (state.lastHitAt) {
                        return;
                    }
                    if (!state.aimCommit) {
                        state.aimCommit = lateRec;
                    }
                    try { verifyHitHpDrop('phase-leave-late'); } catch (eLate) {}
                    if (state.aimCommit === lateRec && !state.aimCommit.hpDropped) {
                        state.aimCommit = null;
                    }
                }, 400);
            }
        }
        state.aimCommit = null;
    }

    function syncAimCommit(fight) {
        var c = state.aimCommit;
        if (!c) {
            return;
        }
        if (!fight || fight.over) {
            clearAimCommit(fight && fight.over ? 'fight-over' : 'no-fight');
            return;
        }
        if (Number(fight.phase) !== 3) {
            /* FgtGetFoucs ENTER 后 wait=0 会把 g_hdFightPhase 清成 0，此时仍在
             * FgtCmdAimGet / FgtAtkAction。立刻清 commit 会假 phase-leave。 */
            if (c.sentEnter && c.onTile && !c.hpDropped && aimCommitAgeMs() < 1400) {
                try { verifyHitHpDrop('phase-leave-hold'); } catch (eHold) {}
                return;
            }
            clearAimCommit('phase-leave');
        }
    }

    function aimCommitAgeMs() {
        return state.aimCommit ? (Date.now() - state.aimCommit.at) : 0;
    }

    function aimCommitHolds() {
        return !!(state.aimCommit && state.aimCommit.hits >= 1);
    }

    function confirmAimHit(u, x, y, via, extra) {
        extra = extra || {};
        extra.via = via || 'in-range';
        extra.unit = u && u.name;
        extra.x = x;
        extra.y = y;
        var fightNow = null;
        try { fightNow = readFight(); } catch (eF) {}
        syncAimCommit(fightNow);
        var c = state.aimCommit;
        if (c) {
            c.hits += 1;
            extra.hits = c.hits;
            extra.hold = true;
            extra.age = Date.now() - c.at;
            extra.sent = !!c.sentEnter;
            state.pendingAimEnter = null;
            if (c.hits >= 10) {
                console.log('[hd-battle] aim-commit-cap', extra);
                return {
                    x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                    tip: state.fightTip, blocked: 'aim-commit-cap',
                    inRng: true, via: extra.via
                };
            }
            console.log('[hd-battle] aim-commit-hold', extra);
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                tip: state.fightTip, blocked: 'aim-commit-hold',
                inRng: true, via: extra.via
            };
        }
        dropQueuedExits();
        state.leavingAim = false;
        var curAim = null;
        try { curAim = syncFocusFromEngine(); } catch (eAim) { curAim = null; }
        /* 光标不在敌军格上回车是假 hit：引擎不扣血，lastHitAt 会骗过占领门槛。 */
        if (!curAim || curAim.x !== x || curAim.y !== y) {
            dropQueuedEnters();
            dropQueuedDirs();
            walkFocusTo(x, y, false);
            state.pendingAimEnter = { x: x, y: y, at: Date.now(), name: u && u.name };
            console.log('[hd-battle] aim-walk-to', {
                via: extra.via, unit: u && u.name, from: curAim, to: { x: x, y: y }
            });
            setTimeout(function () {
                try { tryCommitMeleeAim('aim-after-walk'); } catch (eAfter) {}
            }, 240);
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                tip: state.fightTip, blocked: 'aim-walk', inRng: true, via: extra.via
            };
        }
        /* 方向键还在飞时禁止立刻 ENTER，否则 RIGHT 走过敌军格再回车不掉血。 */
        if (state.sending || (state.queue && state.queue.length)) {
            dropQueuedDirs();
            state.pendingAimEnter = { x: x, y: y, at: Date.now(), name: u && u.name };
            console.log('[hd-battle] aim-flush-wait', {
                via: extra.via, unit: u && u.name, to: { x: x, y: y },
                sending: !!state.sending, queue: state.queue.length
            });
            setTimeout(function () {
                try { tryCommitMeleeAim('aim-after-flush'); } catch (eFlush) {}
            }, 160);
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                tip: state.fightTip, blocked: 'aim-flush', inRng: true, via: extra.via
            };
        }
        /* 已在敌军格：丢掉叠起来的方向键，否则 RIGHT 会走过目标再 ENTER。 */
        dropQueuedKeys();
        state.lastBlockedEnter = '';
        state.pendingAimEnter = null;
        var actor = null;
        try { actor = resolveNamedActor(actingActor()); } catch (eAct) { actor = actingActor(); }
        if (!actorBoundForAim(actor)) {
            console.log('[hd-battle] aim-enter-refuse', JSON.stringify({
                via: extra.via || 'nameless-actor',
                target: u && u.name,
                x: x,
                y: y,
                actorAt: state.actorAt,
                pending: state.pendingPickUnit || ''
            }));
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                tip: state.fightTip, blocked: 'nameless-actor',
                inRng: true, via: extra.via
            };
        }
        noteActingUnit(actor);
        var aimType = readAimType();
        extra.actor = actor.name;
        extra.ax = actor.x;
        extra.ay = actor.y;
        extra.aimType = aimType;
        extra.inRng = inAtkRng(x, y) === true;
        extra.ortho = !!(actor.x != null && x != null &&
            Math.abs(actor.x - x) + Math.abs(actor.y - y) === 1);
        extra.rngAt = aimRngOrigin();
        extra.rngMatch = aimRngMatchesActor(actor);
        /* leftover 他将射程表：EXIT 重开本将 AIM。本将表已绑上但邻格尚未标 1：
         * 正交贴脸仍在敌军格 ENTER（FgtChkRng 近战），禁止再 EXIT 空转。 */
        if (!extra.rngMatch) {
            if (extra.ortho) {
                console.log('[hd-battle] aim-stale-rng', JSON.stringify({
                    via: extra.via || 'stale-rng',
                    actor: actor.name,
                    ax: actor.x,
                    ay: actor.y,
                    unit: u && u.name,
                    x: x,
                    y: y,
                    inRng: extra.inRng,
                    rngMatch: extra.rngMatch,
                    rngAt: extra.rngAt,
                    n: (state.staleRngN || 0) + 1
                }));
                exitLeftoverAimThenReopen(actor, extra.via || 'stale-rng');
                return {
                    x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                    tip: state.fightTip, blocked: 'stale-rng',
                    inRng: extra.inRng, via: extra.via
                };
            }
            console.log('[hd-battle] aim-enter-refuse', JSON.stringify({
                via: extra.via || 'not-in-rng',
                actor: actor.name,
                ax: actor.x,
                ay: actor.y,
                unit: u && u.name,
                x: x,
                y: y,
                aimType: aimType,
                rngAt: extra.rngAt
            }));
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                tip: state.fightTip, blocked: 'not-in-rng',
                inRng: extra.inRng, via: extra.via
            };
        }
        if (!extra.inRng && extra.ortho) {
            extra.inRng = true;
            extra.orthoCommit = true;
        }
        if (!extra.inRng) {
            console.log('[hd-battle] aim-enter-refuse', JSON.stringify({
                via: extra.via || 'not-in-rng',
                actor: actor.name,
                ax: actor.x,
                ay: actor.y,
                unit: u && u.name,
                x: x,
                y: y,
                aimType: aimType,
                rngAt: extra.rngAt
            }));
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                tip: state.fightTip, blocked: 'not-in-rng',
                inRng: extra.inRng, via: extra.via
            };
        }
        extra.hp = u && u.hp;
        extra.hpBefore = u && u.hp;
        extra.armsBefore = u && u.arms != null ? u.arms : peekPersonArms(u && u.id);
        extra.focus = curAim;
        extra.queue = state.queue.length;
        extra.leaving = !!state.leavingAim;
        extra.hold = holdingActMenu();
        extra.tip = state.fightTip;
        extra.swallowed = false;
        extra.hits = 1;
        extra.onTile = true;
        /* CMD_ATK=0 才走 FgtAtkAction。计谋/待机 AIM 上 ENTER 不掉血。 */
        if (aimType !== 0 && aimType !== 0xff) {
            console.log('[hd-battle] aim-wrong-type', JSON.stringify({
                actor: actor.name, aimType: aimType, target: u && u.name, x: x, y: y
            }));
            leaveAimAndRearm('aim-wrong-type');
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: 3,
                tip: state.fightTip, blocked: 'aim-wrong-type',
                inRng: extra.inRng, via: extra.via
            };
        }
        if (aimType === 0xff) {
            writeFightActCommit(0);
        }
        state.awaitingAimUntil = 0;
        state.lastOnTileAimAt = Date.now();
        state.lastHitHpBefore = u && u.hp;
        state.lastHitArmsBefore = extra.armsBefore;
        if (state.lastHitTarget && state.lastHitTarget.x === x && state.lastHitTarget.y === y &&
            state.lastHitTarget.name === (u && u.name)) {
            state.sameTileHitN = (state.sameTileHitN || 0) + 1;
        } else {
            state.sameTileHitN = 1;
        }
        state.lastHitTarget = { name: u && u.name, x: x, y: y };
        state.aimCommit = {
            x: x, y: y, name: u && u.name,
            actorName: actor.name, actorX: actor.x, actorY: actor.y,
            aimType: aimType,
            at: Date.now(), hits: 1, sentEnter: false,
            hpBefore: u && u.hp, armsBefore: extra.armsBefore,
            hpDropped: false, secondEnterSent: false, onTile: true
        };
        enqueueKeys([VK.ENTER], 55);
        if (state.pendingActPick === 0) {
            state.pendingActPick = null;
        }
        clearPendingApproach();
        console.log('[hd-battle] aim-on-tile', JSON.stringify({
            via: extra.via,
            actor: actor.name,
            ax: actor.x,
            ay: actor.y,
            unit: u && u.name,
            x: x,
            y: y,
            inRng: extra.inRng,
            aimType: aimType,
            hpBefore: extra.hpBefore,
            armsBefore: extra.armsBefore
        }));
        scheduleAfterHitSettle(700);
        return {
            x: x, y: y, enter: true, unit: u && u.name, phase: 3,
            tip: state.fightTip, blocked: '', inRng: extra.inRng, via: extra.via
        };
    }

    function tryCommitMeleeAim(why) {
        var fight = null;
        try { fight = readFight(); } catch (eM) {}
        syncAimCommit(fight);
        if (!fight || Number(fight.phase) !== 3 || fight.over) {
            return false;
        }
        if (aimCommitHolds()) {
            return true;
        }
        if (state.lastMeleeTryAt && Date.now() - state.lastMeleeTryAt < 280) {
            return false;
        }
        clearPendingApproach();
        if (state.pendingActPick === 0) {
            state.pendingActPick = null;
        }
        var target = firstLegalAimEnemy();
        if (!target) {
            var adjOnly = adjacentEnemy(1);
            if (adjOnly && inAtkRng(adjOnly.x, adjOnly.y) === true) {
                target = adjOnly;
            }
        }
        if (!target) {
            var adjStuck = null;
            try { adjStuck = namedAdjStrike(); } catch (eAs) { adjStuck = null; }
            if (adjStuck && adjStuck.enemy && actorBoundForAim(adjStuck.unit)) {
                if (leftoverAimNeedsReopen(fight, adjStuck.unit)) {
                    console.log('[hd-battle] melee-wait', {
                        why: why || 'auto-melee', reason: 'reopen-adj',
                        unit: adjStuck.unit.name, enemy: adjStuck.enemy.name
                    });
                    exitLeftoverAimThenReopen(adjStuck.unit, why || 'reopen-adj');
                    return true;
                }
                target = adjStuck.enemy;
            }
        }
        if (!target) {
            if (!atkRngReady()) {
                console.log('[hd-battle] melee-wait', {
                    why: why || 'auto-melee', reason: 'no-rng'
                });
            }
            return false;
        }
        var cur = null;
        try { cur = syncFocusFromEngine(); } catch (eF) {}
        state.lastMeleeTryAt = Date.now();
        state.pendingAimEnter = { x: target.x, y: target.y, at: Date.now(), name: target.name };
        if (!cur || cur.x == null || cur.y == null) {
            console.log('[hd-battle] melee-wait', {
                why: why || 'auto-melee', unit: target.name, reason: 'no-focus'
            });
            return false;
        }
        var actor = null;
        try { actor = resolveNamedActor(actingActor()); } catch (eA) { actor = actingActor(); }
        if (!actorBoundForAim(actor)) {
            console.log('[hd-battle] melee-wait', {
                why: why || 'auto-melee', unit: target.name, reason: 'nameless-actor',
                actorAt: state.actorAt
            });
            return false;
        }
        noteActingUnit(actor);
        if (leftoverAimNeedsReopen(fight, actor)) {
            console.log('[hd-battle] melee-wait', {
                why: why || 'auto-melee', reason: 'reopen-adj',
                unit: actor.name, enemy: target.name
            });
            exitLeftoverAimThenReopen(actor, why || 'reopen-adj');
            return true;
        }
        var dist = (actor && actor.x != null)
            ? chebyshev(actor.x, actor.y, target.x, target.y) : 99;
        confirmAimHit(target, target.x, target.y, why || 'auto-melee', {
            dist: dist, actor: actor.name
        });
        return true;
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

    function focusedFightUnit() {
        var cur = null;
        try { cur = engineFocusTile() || syncFocusFromEngine(); } catch (eF) {}
        if (!cur || cur.x == null || cur.y == null) {
            return null;
        }
        return unitAt(cur.x, cur.y);
    }

    function enemyTurnQuiet(fight) {
        fight = fight || null;
        if (!fight) {
            try { fight = readFight(); } catch (eR) { fight = null; }
        }
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        if (state.playerTurnEnded || recentlyEndedTurn()) {
            return true;
        }
        var phase = Number(fight.phase) || 0;
        if (phase === 2 || phase === 3) {
            return false;
        }
        if (!(phase === 1 && fight.wait) || liveActMenu()) {
            return false;
        }
        if (playerHasWaitingOwn()) {
            return false;
        }
        /* 刚待机/命中后引擎还在选下一将：空隙里 waiting 可能空一帧，不能当敌方回合。 */
        if (state.lastRestCommitAt && Date.now() - state.lastRestCommitAt < 1800) {
            return false;
        }
        if (state.lastHitAt && Date.now() - state.lastHitAt < 1800) {
            return false;
        }
        if (state.lastPickEnterAt && Date.now() - state.lastPickEnterAt < 1800) {
            return false;
        }
        var fu = focusedFightUnit();
        if (fu && fu.side === 'enemy') {
            return true;
        }
        if ((state.actedThisTurn || 0) >= Math.max(1, countPlayerUnits())) {
            return true;
        }
        return false;
    }

    function hdActMenuVisible() {
        if (!menuPanelClickable()) {
            return false;
        }
        var names = state.menuNames || [];
        if (names.indexOf('攻击') >= 0) {
            return true;
        }
        try {
            var info = readFightMenu();
            return !!(info && info.names && info.names.indexOf('攻击') >= 0);
        } catch (eVis) {
            return false;
        }
    }

    function clearPickThrottle(why) {
        var held = !!(state.holdPickUntil && Date.now() < state.holdPickUntil);
        var had = !!(state.lastPickEnterAt || held);
        state.lastPickEnterAt = 0;
        state.holdPickUntil = 0;
        if (had) {
            console.log('[hd-battle] pick-throttle-clear', { via: why || 'clear' });
        }
        /* 命中后 / 换将：下一将必须还能发那一次选将 ENTER。 */
        clearPhase1EnterCap(why || 'pick-throttle');
    }

    function unitCapKey(u) {
        if (!u || u.x == null || u.y == null) {
            return '';
        }
        return String(u.name || '') + '@' + String(u.x) + ',' + String(u.y);
    }

    function markPhase1StuckUnit(key) {
        if (!key) {
            return;
        }
        if (!state.phase1StuckUnitKeys) {
            state.phase1StuckUnitKeys = {};
        }
        state.phase1StuckUnitKeys[key] = Date.now();
        state.phase1StuckUnitKey = key;
    }

    function isPhase1StuckUnit(u) {
        var key = unitCapKey(u);
        return !!(key && state.phase1StuckUnitKeys && state.phase1StuckUnitKeys[key]);
    }

    function clearPhase1StuckUnits(why) {
        var n = 0;
        var k;
        if (state.phase1StuckUnitKeys) {
            for (k in state.phase1StuckUnitKeys) {
                if (state.phase1StuckUnitKeys.hasOwnProperty(k)) {
                    n += 1;
                }
            }
        }
        state.phase1StuckUnitKeys = {};
        state.phase1StuckUnitKey = '';
        if (n) {
            console.log('[hd-battle] phase1-stuck-clear', { via: why || 'clear', n: n });
        }
    }

    function clearPhase1EnterCap(why) {
        var had = !!(state.phase1EnterSent || state.phase1EnterAt);
        if (state.phase1StuckTimer) {
            clearTimeout(state.phase1StuckTimer);
            state.phase1StuckTimer = 0;
        }
        state.phase1EnterSent = false;
        state.phase1EnterAt = 0;
        state.phase1EnterStuckHandled = false;
        state.phase1EnterCapKey = '';
        if (had) {
            console.log('[hd-battle] phase1-enter-cap-clear', { via: why || 'clear' });
        }
    }

    function notePhase1EnterCommit(fight) {
        var fu = null;
        try { fu = focusedFightUnit(); } catch (eFu) {}
        state.phase1EnterSent = true;
        state.phase1EnterAt = Date.now();
        state.phase1EnterStuckHandled = false;
        state.phase1EnterCapKey = unitCapKey(fu) || state.phase1EnterCapKey || 'pick';
        if (state.phase1FailKey === state.phase1EnterCapKey) {
            state.phase1FailN = (state.phase1FailN || 0) + 1;
        } else {
            state.phase1FailKey = state.phase1EnterCapKey;
            state.phase1FailN = 1;
        }
        if (state.pendingHandoff && fu && fu.name &&
            !(state.lastHitActor && state.lastHitActor.name === fu.name)) {
            finishHandoff('phase1-pick');
        }
        dropQueuedEnters();
        console.log('[hd-battle] phase1-enter-commit', {
            unit: state.phase1EnterCapKey,
            hdMenu: hdActMenuVisible(),
            index: state.menuIndex,
            pending: !!state.pendingApproach,
            moved: !!state.movedThisAct,
            phase: fight ? Number(fight.phase) : null
        });
        schedulePhase1StuckRecover(300);
    }

    function phase1EnterCapBlocksEnter(destX, destY) {
        var fight = null;
        try { fight = readFight(); } catch (eR) { fight = null; }
        if (!(fight && Number(fight.phase) === 1 && fight.wait && !fight.over)) {
            return false;
        }
        if (!state.phase1EnterSent) {
            return false;
        }
        if (destX != null && destY != null) {
            var dest = unitAt(destX, destY);
            var destKey = unitCapKey(dest);
            if (destKey && destKey !== state.phase1EnterCapKey) {
                return false;
            }
            return true;
        }
        var fu = null;
        try { fu = focusedFightUnit(); } catch (eF) {}
        var key = unitCapKey(fu);
        if (key && state.phase1EnterCapKey && key !== state.phase1EnterCapKey) {
            return false;
        }
        return true;
    }

    function schedulePhase1StuckRecover(ms) {
        if (state.phase1StuckTimer) {
            clearTimeout(state.phase1StuckTimer);
        }
        state.phase1StuckTimer = setTimeout(function () {
            state.phase1StuckTimer = 0;
            try { recoverPhase1EnterStuck(); } catch (eStuck) {}
        }, ms == null ? 300 : ms);
    }

    function recoverPhase1EnterStuck() {
        if (!state.phase1EnterSent || state.phase1EnterStuckHandled) {
            return;
        }
        if (state.phase1EnterAt && Date.now() - state.phase1EnterAt < 300) {
            schedulePhase1StuckRecover(Math.max(40, 300 - (Date.now() - state.phase1EnterAt)));
            return;
        }
        if (!fightReallyActive() || state.resultText) {
            return;
        }
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        if (!(fight && Number(fight.phase) === 1 && fight.wait && !fight.over)) {
            return;
        }
        /* 刚发出的选将 ENTER 先等状态变；300ms 就清 cap 再打会灌 phase=1 ENTER。 */
        if (state.lastPickEnterAt && Date.now() - state.lastPickEnterAt < 1100) {
            schedulePhase1StuckRecover(400);
            return;
        }
        var earlySkip = state.phase1EnterCapKey || unitCapKey(focusedFightUnit());
        if (earlySkip && isHandoffSkip(earlySkip)) {
            dropQueuedEnters();
            if (pickNextAfterHandoffSkip('phase1-already-skip')) {
                return;
            }
            if (adjacentWaitingStrike() || namedAdjStrike()) {
                pickNextCapableAfterGiveUp('phase1-already-skip-adj');
                return;
            }
            sysEndPlayerTurn('phase1-already-skip-end');
            return;
        }
        dropQueuedEnters();
        clearPhase1EnterCap('phase1-stuck-melee');
        clearPickThrottle('phase1-stuck-melee');
        var adjNow = !!adjacentWaitingStrike();
        console.log('[hd-battle] phase1-enter-stuck', {
            via: 'no-state-change',
            unit: state.phase1EnterCapKey || unitCapKey(focusedFightUnit()),
            hdMenu: hdActMenuVisible(),
            index: state.menuIndex,
            adj: adjNow,
            moved: !!state.movedThisAct,
            live: liveActMenu()
        });
        /* 贴脸将禁止再对将自己格 ENTER。STA_END leftover 换下一未行动将。 */
        if (adjNow) {
            if (recoverAdjActThenAim('phase1-stuck-recover')) {
                return;
            }
            if (state.adjRecoverGiveUpKey) {
                armNextWaitingOwn('phase1-enter-stuck', { force: true });
                return;
            }
        }
        state.phase1EnterStuckHandled = true;
        var stuckKey = state.phase1EnterCapKey || unitCapKey(focusedFightUnit());
        var alreadyStuck = !!(stuckKey && state.phase1StuckUnitKeys &&
            state.phase1StuckUnitKeys[stuckKey]);
        markPhase1StuckUnit(stuckKey);
        if (isHandoffSkip(stuckKey)) {
            dropQueuedEnters();
            if (pickNextAfterHandoffSkip('phase1-enter-already-skip')) {
                return;
            }
            if (adjacentWaitingStrike() || namedAdjStrike()) {
                pickNextCapableAfterGiveUp('phase1-enter-adj');
                return;
            }
            sysEndPlayerTurn('phase1-enter-skip-end');
            return;
        }
        if (state.lastHitAt && (alreadyStuck || (state.phase1FailN || 0) >= 2)) {
            markHandoffSkip(stuckKey, 'phase1-enter-2');
            dropQueuedEnters();
            if (pickNextAfterHandoffSkip('phase1-enter-skip')) {
                return;
            }
            if (adjacentWaitingStrike() || namedAdjStrike()) {
                pickNextCapableAfterGiveUp('phase1-enter-adj');
                return;
            }
            sysEndPlayerTurn('phase1-enter-skip-end');
            return;
        }
        if (canCommitActMenu(fight) && killableAdjAlive()) {
            pickFightMenu(0);
            return;
        }
        if (hdActMenuVisible() && killableAdjAlive() && (state.movedThisAct || liveActMenu())) {
            pickFightMenu(0);
            return;
        }
        var nextOther = firstWaitingOwn({ skipLord: true });
        if (nextOther && unitCapKey(nextOther) === stuckKey) {
            nextOther = null;
            var iSkip;
            for (iSkip = 0; iSkip < state.units.length && !nextOther; iSkip++) {
                var uSkip = state.units[iSkip];
                if (!uSkip || uSkip.side !== 'player') {
                    continue;
                }
                if (isLordUnit(uSkip) || unitCapKey(uSkip) === stuckKey) {
                    continue;
                }
                if (!(uSkip.active === 0 || uSkip.active == null)) {
                    continue;
                }
                if (state.adjRecoverGiveUpKey && state.adjRecoverGiveUpKey === unitCapKey(uSkip)) {
                    continue;
                }
                nextOther = uSkip;
            }
        }
        var nextLord = firstWaitingOwn({ lordOnly: true });
        if (adjacentWaitingStrike() || liveAdjStrike()) {
            clearPendingApproach();
            clearPhase1EnterCap('phase1-stuck-strike');
            pickNextCapableAfterGiveUp('phase1-enter-stuck-strike');
            return;
        }
        if (nextOther) {
            clearPendingApproach();
            clearPhase1EnterCap('phase1-stuck-next');
            pickNextCapableAfterGiveUp('phase1-enter-stuck');
            return;
        }
        if (state.lastHitAt && shouldSysEndAfterLordHold() && !playerHasWaitingOwn()) {
            sysEndPlayerTurn('phase1-enter-stuck-end');
            return;
        }
        if (nextLord) {
            clearPendingApproach();
            clearPhase1EnterCap('phase1-stuck-next');
            armNextWaitingOwn('phase1-enter-stuck', { force: true });
            return;
        }
        preferRest('phase1-enter-stuck');
    }

    /* STA_END 或本场已打出真伤的将：禁止再开 AIM / recover。 */
    function actorSpent(u) {
        if (!u) {
            return false;
        }
        if (u.active === 1) {
            /* 刚走格还没打：active 偶发 STA_END，不能当成 leftover。 */
            if (state.movedThisAct && u.name && state.actorAt &&
                state.actorAt.name === u.name &&
                !(state.lastHitActor && state.lastHitActor.name === u.name &&
                    (state.lastHitAt || state.fightHitAt))) {
                return false;
            }
            return true;
        }
        if (!state.turnHitActor || !(state.lastHitAt || state.fightHitAt)) {
            return false;
        }
        /* 只花本回合。lastHitActor 会 persist 到 occupy，不能用来 spent。 */
        if (!(state.lastHpDropAt || state.fightHitAt)) {
            return false;
        }
        if (u.name && state.turnHitActor.name && u.name === state.turnHitActor.name) {
            return true;
        }
        return u.x === state.turnHitActor.x && u.y === state.turnHitActor.y;
    }

    function recentlyHitActor(u) {
        if (actorSpent(u)) {
            return true;
        }
        if (!u || !state.turnHitActor || !(state.lastHitAt || state.fightHitAt)) {
            return false;
        }
        /* 假 hit（没掉血）：本将必须还能再打。真掉血后按名字跳过，贴脸也不得再武装。 */
        if (!(state.lastHpDropAt || state.fightHitAt)) {
            return false;
        }
        if (u.name && state.turnHitActor.name && u.name === state.turnHitActor.name) {
            return true;
        }
        return u.x === state.turnHitActor.x && u.y === state.turnHitActor.y;
    }

    function clickNextAfterHit() {
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        if (!fight || !fight.active || fight.over || state.resultText || enemyTurnQuiet(fight)) {
            return false;
        }
        var phase = Number(fight.phase) || 0;
        if (phase === 2 || phase === 3 || awaitingAim()) {
            return false;
        }
        var liveNext = null;
        try { liveNext = namedAdjStrike(); } catch (eL) { liveNext = null; }
        if (liveActMenu() && liveNext && liveNext.unit &&
            !actorSpent(liveNext.unit) && !recentlyHitActor(liveNext.unit) &&
            !leftoverHitterMenu(fight)) {
            finishHandoff('after-hit-live');
            return openAimFromActMenu('after-hit-live', liveNext);
        }
        /* leftover 出手将菜单：只等 phase=1，禁止 EXIT/LEFT 交接。 */
        if (leftoverHitterMenu(fight) || leftoverExitBanned()) {
            if (phase === 0 && !fight.wait) {
                if (!leftoverExitBanned() &&
                    (!state.lastLeftoverActExitAt ||
                        Date.now() - state.lastLeftoverActExitAt >= 2400)) {
                    state.lastLeftoverActExitAt = Date.now();
                    dumpEnterSwallow('leftover-act-exit', { via: 'handoff-last-resort' });
                    enqueueKeys([VK.EXIT], 70);
                } else {
                    dumpEnterSwallow('leftover-handoff-wait', { via: 'after-hit-next' });
                }
                scheduleAfterHitSettle(180);
                return true;
            }
        }
        try { clickWaitingOwn(); } catch (eC) {}
        scheduleDriveSoon('after-hit-next', 80);
        return true;
    }

    function scheduleAfterHitSettle(ms) {
        if (state.afterHitTimer) {
            clearTimeout(state.afterHitTimer);
        }
        state.afterHitTimer = setTimeout(function () {
            state.afterHitTimer = 0;
            try { settleAfterAttackHit(); } catch (eHit) {}
        }, ms == null ? 240 : ms);
    }

    function settleAfterAttackHit() {
        if (!fightReallyActive() || state.resultText) {
            return false;
        }
        if (state.lastHandoffSkipRestAt && Date.now() - state.lastHandoffSkipRestAt < 900) {
            return true;
        }
        var fight = null;
        try { fight = readFight(); } catch (eF) {}
        if (enemyTurnQuiet(fight)) {
            return false;
        }
        var dropped = verifyHitHpDrop('after-hit-settle');
        if (!dropped && (state.lastHitAt || state.fightHitAt ||
            (state.aimCommit && state.aimCommit.hpDropped))) {
            dropped = true;
        }
        if (fight && Number(fight.phase) === 2) {
            return false;
        }
        if (dropped && leftoverHitterMenu(fight)) {
            console.log('[hd-battle] after-hit-settle', {
                phase: fight ? Number(fight.phase) : null,
                wait: !!(fight && fight.wait),
                hdMenu: hdActMenuVisible(),
                drop: !!dropped,
                next: 'handoff-wait'
            });
            scheduleAfterHitSettle(180);
            return true;
        }
        if (fight && Number(fight.phase) === 1 && fight.wait && state.lastHitAt) {
            try { clickNextAfterHit(); } catch (eP1) {}
            return true;
        }
        if (fight && Number(fight.phase) === 3) {
            /* 命中后先让引擎结算伤害。没掉血就再灌一次 phase3 ENTER，禁止立刻 EXIT。 */
            if (!dropped && aimCommitHolds() && !state.leavingAim) {
                var missActor = null;
                var realMiss = false;
                try { missActor = resolveNamedActor(actingActor()); } catch (eM) { missActor = actingActor(); }
                if (state.aimCommit && state.aimCommit.onTile && state.aimCommit.sentEnter &&
                    aimCommitAgeMs() > 450) {
                    realMiss = inAtkRng(state.aimCommit.x, state.aimCommit.y) === true &&
                        !!(missActor && aimRngMatchesActor(missActor));
                }
                if ((state.sameTileHitN || 0) >= 2 || realMiss) {
                    if (missActor && missActor.name) {
                        markHandoffSkip(missActor, 'no-drop-aim');
                    }
                    console.log('[hd-battle] after-hit-same-tile', {
                        n: state.sameTileHitN, unit: state.aimCommit && state.aimCommit.name,
                        actor: missActor && missActor.name,
                        realMiss: realMiss
                    });
                    return restSkippedThenPickNext('after-hit-same-tile');
                }
                if (state.aimCommit && !state.aimCommit.secondEnterSent && aimCommitAgeMs() > 400) {
                    var boundName = state.aimCommit.actorName ||
                        (state.actorAt && state.actorAt.name) || '';
                    if (!boundName) {
                        console.log('[hd-battle] aim-second-enter-refuse', {
                            why: 'actor-unbound',
                            unit: state.aimCommit.name,
                            actorAt: state.actorAt
                        });
                    } else {
                    var nudgeTo = { x: state.aimCommit.x, y: state.aimCommit.y };
                    var nudgeCur = null;
                    try { nudgeCur = syncFocusFromEngine(); } catch (eN) { nudgeCur = null; }
                    if (!nudgeCur || nudgeCur.x !== nudgeTo.x || nudgeCur.y !== nudgeTo.y) {
                        dropQueuedDirs();
                        walkFocusTo(nudgeTo.x, nudgeTo.y, false);
                        console.log('[hd-battle] aim-nudge', {
                            from: nudgeCur, to: nudgeTo, unit: state.aimCommit.name,
                            actor: boundName
                        });
                    }
                    console.log('[hd-battle] aim-second-enter', {
                        why: 'no-hp-drop',
                        actor: boundName,
                        unit: state.aimCommit.name,
                        before: state.aimCommit.hpBefore,
                        after: peekEnemyHp(state.aimCommit),
                        age: aimCommitAgeMs(),
                        aimType: state.aimCommit.aimType
                    });
                    /* 不预写 secondEnterSent：engineSendKey 发出时再置位，否则会被 aim-commit-block 吞掉。 */
                    enqueueKeys([VK.ENTER], 55);
                    }
                }
                if (aimCommitAgeMs() < 2400) {
                    scheduleAfterHitSettle(400);
                    return true;
                }
                var missNo = null;
                try { missNo = resolveNamedActor(actingActor()); } catch (eN2) { missNo = actingActor(); }
                if (missNo && missNo.name) {
                    markHandoffSkip(missNo, 'no-drop-aim');
                }
                return restSkippedThenPickNext('after-hit-no-drop');
            } else if (aimCommitHolds() && !state.leavingAim) {
                if (aimCommitAgeMs() < 1400) {
                    scheduleAfterHitSettle(400);
                    return true;
                }
                leaveAimAndRearm('after-hit-settle');
            }
            scheduleAfterHitSettle(400);
            return true;
        }
        clearPickThrottle('after-hit-settle');
        if (state.pendingActPick === 0) {
            state.pendingActPick = null;
        }
        clearPendingApproach();
        if (killableAdjAlive()) {
            console.log('[hd-battle] after-hit-settle', {
                phase: fight ? Number(fight.phase) : null,
                wait: !!(fight && fight.wait),
                hdMenu: hdActMenuVisible(),
                drop: !!dropped,
                next: 'adj-melee'
            });
            clearAdjMeleeThrottle('after-hit-adj');
            if (commitAdjacentMelee('after-hit-adj')) {
                return true;
            }
        }
        var nextOwn = nearestActionableOwn({ skipLord: true, includeStuck: true }) ||
            firstWaitingOwn({ skipLord: true, includeStuck: true }) ||
            firstWaitingOwn({ skipLord: true }) ||
            firstWaitingOwn({ lordOnly: true });
        if (nextOwn && !actorSpent(nextOwn) && !recentlyHitActor(nextOwn)) {
            console.log('[hd-battle] after-hit-settle', {
                phase: fight ? Number(fight.phase) : null,
                wait: !!(fight && fight.wait),
                hdMenu: hdActMenuVisible(),
                drop: !!dropped,
                next: nextOwn.name
            });
            if (killableAdjAlive()) {
                return commitAdjacentMelee('after-hit-stall-melee') ||
                    armNextWaitingOwn('after-attack-hit', { force: true });
            }
            var armedHit = armNextWaitingOwn('after-attack-hit', { force: true });
            setTimeout(function () {
                try { clickNextAfterHit(); } catch (eRetry) {}
            }, 280);
            return armedHit;
        }
        if (dropped || state.lastHitAt || state.fightHitAt) {
            var leftoverHit = nearestActionableOwn({ skipLord: true, includeStuck: true }) ||
                firstWaitingOwn({ skipLord: true, includeStuck: true });
            if (leftoverHit && !actorSpent(leftoverHit) && !recentlyHitActor(leftoverHit)) {
                console.log('[hd-battle] after-hit-settle', {
                    phase: fight ? Number(fight.phase) : null,
                    wait: !!(fight && fight.wait),
                    hdMenu: hdActMenuVisible(),
                    drop: !!dropped,
                    next: leftoverHit.name
                });
                var armedLeft = armNextWaitingOwn('after-attack-hit', { force: true });
                setTimeout(function () {
                    try { clickNextAfterHit(); } catch (eLeft) {}
                }, 280);
                return armedLeft;
            }
            console.log('[hd-battle] after-hit-settle', {
                phase: fight ? Number(fight.phase) : null,
                wait: !!(fight && fight.wait),
                hdMenu: hdActMenuVisible(),
                drop: !!dropped,
                next: 'end-turn'
            });
            return sysEndPlayerTurn('after-hit-no-next');
        }
        return false;
    }

    function mutePhase1Enter(fight) {
        if (!(fight && Number(fight.phase) === 1 && fight.wait)) {
            return '';
        }
        /* 将领行动已开也不能连发：盒子会停在 wait=true + 攻击高亮，zr 放行流会灌 ENTER。 */
        if (phase1EnterCapBlocksEnter()) {
            return 'phase1-enter-cap';
        }
        var skipFu = null;
        try { skipFu = focusedFightUnit(); } catch (eSk) { skipFu = null; }
        if (skipFu && isHandoffSkip(skipFu)) {
            return 'handoff-skip';
        }
        if (liveActMenu()) {
            return '';
        }
        if (enemyTurnQuiet(fight)) {
            return 'enemy-turn';
        }
        var hitFresh = !!(state.lastHitAt && Date.now() - state.lastHitAt < 2200);
        if (state.holdPickUntil && Date.now() < state.holdPickUntil) {
            /* 命中后必须放行下一将 ENTER，不能继续 pick-hold。 */
            if (!hitFresh) {
                return 'pick-hold';
            }
        }
        var fu = focusedFightUnit();
        if (fu && fu.side === 'enemy') {
            var wantPick = peekPlayerByName(pendingPickName());
            if (wantPick && (unitMeleeEnemy(wantPick) || adjacentWaitingStrike())) {
                walkFocusTo(wantPick.x, wantPick.y, false);
            }
            return 'enemy-focus';
        }
        /* 无未行动己方时选将 ENTER 只会打进敌方 AI。刚待机/命中留 400ms 给引擎标下一将。
         * 只吞键，不 latch playerTurnEnded（空隙里 latch 会把下一将打成 ended）。 */
        if (!playerHasWaitingOwn()) {
            var restAge = state.lastRestCommitAt ? Date.now() - state.lastRestCommitAt : 1e9;
            var hitAge = state.lastHitAt ? Date.now() - state.lastHitAt : 1e9;
            if (restAge >= 400 && hitAge >= 400) {
                return 'no-player-pick';
            }
        }
        if (fu && isLordUnit(fu) && !adjacentEnemy(1) && firstWaitingOwn({ skipLord: true })) {
            var strikePick = adjacentWaitingStrike();
            var fuKey = unitCapKey(fu);
            var pendingKey = state.pendingPickUnit || '';
            /* 焦点已在贴脸副将：放行选将 ENTER。焦点仍在君主则继续吞，避免点到马腾。 */
            if (pendingKey && pendingKey === fuKey) {
                return '';
            }
            if (strikePick && unitCapKey(strikePick.unit) === fuKey) {
                return '';
            }
            /* 方向键刚走到副将，引擎焦点可能滞后一帧，必须放行这次 ENTER。 */
            if (pendingKey && strikePick && pendingKey === unitCapKey(strikePick.unit) &&
                state.lastPickWalkAt && Date.now() - state.lastPickWalkAt < 2500) {
                return '';
            }
            if (pendingKey && pendingKey !== fuKey && state.lastPickWalkAt &&
                Date.now() - state.lastPickWalkAt < 2500) {
                return '';
            }
            return 'lord-hold-pick';
        }
        if (state.lastPickEnterAt && Date.now() - state.lastPickEnterAt < 1200) {
            if (postHitAdjMeleeNeedsEnter()) {
                clearPickThrottle('post-hit-adj-melee');
                return '';
            }
            return 'pick-throttle';
        }
        return '';
    }

    function noteEnemyTurnQuiet(why, fight) {
        dropQueuedEnters();
        clearPendingApproach();
        state.turnHitActor = null;
        if (state.pendingActPick === 0) {
            state.pendingActPick = null;
        }
        /* 只吞 leftover ENTER。回合结束必须走 EXIT → fightOpenMainMenu return 0。
         * 在此 latch playerTurnEnded 会挡掉那次 EXIT，FgtGetControl 永远等键。 */
        var now = Date.now();
        if (state.lastEnemyQuietLogAt && now - state.lastEnemyQuietLogAt < 2500) {
            return;
        }
        state.lastEnemyQuietLogAt = now;
        console.log('[hd-battle] enemy-turn', {
            via: why || 'enemy-quiet',
            latched: !!state.playerTurnEnded,
            phase: fight ? fight.phase : null,
            wait: !!(fight && fight.wait),
            waiting: playerHasWaitingOwn(),
            focus: (function () {
                var u = focusedFightUnit();
                return u ? { name: u.name, side: u.side, x: u.x, y: u.y } : null;
            }())
        });
    }

    function notePlayerTurnEnded(why) {
        state.playerTurnEnded = true;
        state.afterEndTurnUntil = Date.now() + 9000;
        state.sawMoveThisTurn = false;
        state.openedSysForEndTurn = false;
        resetActMenuIndex('end-player-turn');
        clearMovedThisAct(why || 'end-player-turn');
        state.pendingActPick = null;
        clearPendingApproach();
        clearAimCommit('end-player-turn');
    }

    function maybeResumePlayerTurn(fight) {
        if (!state.playerTurnEnded) {
            return;
        }
        var phase = Number(fight && fight.phase) || 0;
        var endedAt = state.afterEndTurnUntil ? (state.afterEndTurnUntil - 9000) : 0;
        if (endedAt && Date.now() - endedAt < 900) {
            return;
        }
        /* 只在下一回合选将/走格 wait=1 时解除。wait=0 leftover 会把键打进敌方 AI。
         * 引擎已回到 phase=1 PICK 时即使 leftover STA_END 采样漏掉 waiting，也必须放行，
         * 否则 playerTurnEnded 会把 after-end-turn 钉死整场。 */
        if (fight && !fight.over && fight.wait && (phase === 1 || phase === 2) &&
            (playerHasWaitingOwn() || phase === 1)) {
            state.playerTurnEnded = false;
            state.afterEndTurnUntil = 0;
            state.sawMoveThisTurn = phase === 2;
            state.movedThisAct = false;
            state.openedSysForEndTurn = false;
            state.allowEndTurnEnter = false;
            resetActMenuIndex('new-player-turn');
            state.actedThisTurn = 0;
            state.approachedThisAct = false;
            clearNextUnitStall('new-player-turn');
            clearAimCommit('new-player-turn');
            state.lastPickEnterAt = 0;
            state.holdPickUntil = 0;
            state.lastMenuCommitEnterAt = 0;
            clearPhase1StuckUnits('new-player-turn');
            clearPhase1EnterCap('new-player-turn');
            state.turnHitActor = null;
            state.lastHpDropAt = 0;
            state.lastHpDrop = null;
            state.lastHitHpBefore = null;
            state.lastHitTarget = null;
            state.sameTileHitN = 0;
            state.lastAttackClickAt = 0;
            state.phase1AdjEnterHoldUntil = 0;
            state.lastFirstActMeleeAt = 0;
            state.lastOpenAimAt = 0;
            state.lastPhase0AimAt = 0;
            state.lastOnTileAimAt = 0;
            state.phase0AimRetryN = 0;
            if (state.phase0IdleTimer) {
                clearTimeout(state.phase0IdleTimer);
                state.phase0IdleTimer = 0;
            }
            state.lastAdjRecoverAt = 0;
            state.adjRecoverPickSent = false;
            state.adjRecoverPickAt = 0;
            state.adjRecoverPickKey = '';
            state.adjRecoverPickN = 0;
            state.adjRecoverGiveUpKey = '';
            state.adjRecoverStage = '';
            state.adjRecoverStageAt = 0;
            state.adjRecoverHoldAt = 0;
            state.lastAdjRecoverWalkAt = 0;
            state.approachRepeatCount = 0;
            state.lastApproachKey = '';
            state.approachTilesPeak = 0;
            state.approachTilesStableAt = 0;
            state.lastLeftoverActExitAt = 0;
            state.pendingHandoff = false;
            state.handoffAt = 0;
            state.handoffBanExitUntil = 0;
            try { clearHandoffSkip('new-player-turn'); } catch (eHs) {}
            state.leftoverAimReopenN = 0;
            state.leftoverAimReopenActor = '';
            state.leftoverAimReopenAt = 0;
            if (state.leftoverAimReopenTimer) {
                clearTimeout(state.leftoverAimReopenTimer);
                state.leftoverAimReopenTimer = 0;
            }
            state.lastAdjRecoverWalkDest = '';
            state.adjRecoverGiveUpAt = 0;
            if (state.adjRecoverTimer) {
                clearTimeout(state.adjRecoverTimer);
                state.adjRecoverTimer = 0;
            }
            writeFightActCommit(0xFF);
            state.lastEnemyQuietLogAt = 0;
            state.approachPathWaitAt = 0;
            state.approachWaitLogs = 0;
            state.lastArmNextAt = 0;
            state.holdEndTurnUntil = 0;
            state.lordOpenDeferred = false;
            state.pendingPickUnit = '';
            state.lastAdjMeleeAt = 0;
            state.lastPickWalkAt = 0;
            state.lordHoldRestN = 0;
            console.log('[hd-battle] act-reset', { via: 'new-player-turn', phase: phase });
            maybePickOtherOnOpen();
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
        /* 一次 melee ENTER 后等引擎离开 AIM；超时才 leftover EXIT，禁止再 ENTER。 */
        if (aimCommitHolds()) {
            if (state.aimCommit && !state.aimCommit.hpDropped) {
                return aimCommitAgeMs() > 2800;
            }
            return aimCommitAgeMs() > 2200;
        }
        if (state.lastHitAt && Date.now() - state.lastHitAt < 900) {
            return false;
        }
        var age = aimAgeMs();
        var legal = hasLegalAimTarget();
        var stuckAim = null;
        try { stuckAim = namedAdjStrike(); } catch (eSt) { stuckAim = null; }
        if (stuckAim && stuckAim.unit && actorBoundForAim(stuckAim.unit) &&
            leftoverAimNeedsReopen(fight, stuckAim.unit)) {
            if (age > 280) {
                dumpEnterSwallow('leftover-aim-reopen', {
                    aimAge: age, unit: stuckAim.unit.name,
                    enemy: stuckAim.enemy && stuckAim.enemy.name
                });
                return true;
            }
            return false;
        }
        /* 贴脸但射程未标：先给 melee ENTER ~2.8s（含走到敌军格）；失败再 leftover。 */
        if (age > 2000 && !legal) {
            if (stuckAim && stuckAim.unit && likelyAimTarget() && age < 2800) {
                return false;
            }
            dumpEnterSwallow('leftover-aim-stuck', {
                aimAge: age, adj: !!(adjacentEnemy(1)), likely: likelyAimTarget()
            });
            return true;
        }
        /* Attack ENTER 之后等射程表；awaiting 窗口内绝不当 leftover，否则 refresh 会 EXIT 掉 attack-hit。 */
        if (awaitingAim()) {
            return false;
        }
        if (likelyAimTarget()) {
            return false;
        }
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
                clearPendingApproach();
                if (state.pendingActPick === 0) {
                    state.pendingActPick = null;
                }
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
            if (!aimCommitHolds() && (hasLegalAimTarget() ||
                (likelyAimTarget() && (adjacentWaitingStrike() || liveAdjStrike())))) {
                tryCommitMeleeAim('aim-enter');
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

    function leftoverAimNeedsReopen(fight, actor) {
        var enemy;
        var origin;
        var match;
        var inRng;
        if (!(fight && Number(fight.phase) === 3)) {
            return false;
        }
        if (aimCommitHolds()) {
            return false;
        }
        if (!actor || !actorBoundForAim(actor)) {
            return false;
        }
        if (actorSpent(actor) || recentlyHitActor(actor)) {
            return false;
        }
        try { enemy = unitMeleeEnemy(actor); } catch (eM) { enemy = null; }
        if (!enemy || !enemyIsLiving(enemy)) {
            return false;
        }
        origin = aimRngOrigin();
        match = aimRngMatchesActor(actor);
        inRng = inAtkRng(enemy.x, enemy.y) === true;
        if (match) {
            return false;
        }
        if (origin && !match) {
            if (state.lastOpenAimAt && Date.now() - state.lastOpenAimAt < 800) {
                return false;
            }
            return true;
        }
        if (awaitingAim() && aimAgeMs() < 1600) {
            return false;
        }
        if (aimAgeMs() < 800) {
            return false;
        }
        return !inRng || !match;
    }

    function scheduleLeftoverAimReopen(actor, why) {
        if (state.leftoverAimReopenTimer) {
            clearTimeout(state.leftoverAimReopenTimer);
        }
        state.leftoverAimReopenTimer = setTimeout(function () {
            state.leftoverAimReopenTimer = 0;
            try {
                var fight = null;
                var live = null;
                var strike = null;
                var phase = 0;
                try { fight = readFight(); } catch (eF) { fight = null; }
                if (!fight || !fight.active || fight.over || state.resultText) {
                    return;
                }
                live = peekPlayerByName(actor && actor.name) || actor;
                if (!live || !actorBoundForAim(live) || actorSpent(live)) {
                    return;
                }
                noteActingUnit(live);
                notePendingPick(live);
                try { strike = namedAdjStrike({ unit: live }); } catch (eS) { strike = null; }
                phase = Number(fight.phase) || 0;
                if (phase === 3) {
                    if (leftoverAimNeedsReopen(fight, live) && !recentlyLeftAim(400)) {
                        exitLeftoverAimThenReopen(live, why || 'reopen-still-aim');
                        return;
                    }
                    tryCommitMeleeAim(why || 'reopen-aim');
                    return;
                }
                if (phase === 0 && !fight.wait && liveActMenu() && strike) {
                    state.lastOpenAimAt = 0;
                    openAimFromActMenu(why || 'reopen-act', strike);
                    return;
                }
                recoverAdjActThenAim(why || 'reopen-recover');
            } catch (eR) {}
        }, 240);
    }

    function exitLeftoverAimThenReopen(actor, why) {
        var key;
        var n;
        if (!actor || !actorBoundForAim(actor)) {
            return false;
        }
        key = unitCapKey(actor) || actor.name;
        n = state.leftoverAimReopenN || 0;
        if (state.leftoverAimReopenActor === key && n >= 4) {
            console.log('[hd-battle] leftover-aim-reopen-give-up', {
                via: why || 'adj-handoff',
                unit: actor.name,
                n: n
            });
            pickNextCapableAfterGiveUp(why || 'leftover-aim-reopen');
            return false;
        }
        if (state.leftoverAimReopenAt && Date.now() - state.leftoverAimReopenAt < 700 &&
            state.leftoverAimReopenActor === key) {
            scheduleLeftoverAimReopen(actor, why);
            return true;
        }
        state.leftoverAimReopenAt = Date.now();
        state.leftoverAimReopenActor = key;
        state.leftoverAimReopenN = n + 1;
        dropQueuedEnters();
        dropQueuedDirs();
        state.pendingAimEnter = null;
        state.staleRngN = 0;
        noteActingUnit(actor);
        notePendingPick(actor);
        finishHandoff('leftover-aim-reopen');
        console.log('[hd-battle] leftover-aim-reopen', {
            via: why || 'adj-handoff',
            unit: actor.name,
            ux: actor.x,
            uy: actor.y,
            n: state.leftoverAimReopenN,
            rngAt: aimRngOrigin()
        });
        if (!recentlyLeftAim(700)) {
            state.leavingAim = true;
            state.lastAimExitAt = Date.now();
            logAimExit(why || 'leftover-reopen', { unit: actor.name });
            enqueueKeys([VK.EXIT], 55);
        }
        scheduleLeftoverAimReopen(actor, why);
        return true;
    }

    function handleLeftoverAimAdj(why) {
        var strike = null;
        try { strike = namedAdjStrike(); } catch (eS) { strike = null; }
        if (!(strike && strike.unit && actorBoundForAim(strike.unit) &&
            !actorSpent(strike.unit))) {
            return false;
        }
        if (isHandoffSkip(strike.unit)) {
            return restSkippedThenPickNext(why || 'leftover-skip');
        }
        /* 本将 AIM 已绑上仍无合法格，或已经 EXIT 重开过：待机换将，禁止 leftover-AIM 空转。 */
        if (aimRngMatchesActor(strike.unit) || (state.leftoverAimReopenN || 0) >= 1) {
            markHandoffSkip(strike.unit, 'leftover-aim-stuck');
            return restSkippedThenPickNext(why || 'leftover-aim-stuck');
        }
        return exitLeftoverAimThenReopen(strike.unit, why || 'leftover-adj');
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

    function adjRecoverHidesMenu() {
        var st = state.adjRecoverStage || '';
        return !!(st && st !== 'give-up');
    }

    /* 只要还有己方未行动，菜单必须能点。待机后 leftover wait=1/phase=2 不得再藏死。 */
    function shouldShowActMenu(fight) {
        if (!fight || !fight.active || fight.over || state.resultText) {
            return false;
        }
        /* phase1 贴脸 recover：禁止合成「攻击」，否则 pickFightMenu 会当成 AIM。 */
        if (adjRecoverHidesMenu()) {
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
        clearAimCommit('reset-act');
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
                clearPendingApproach();
                if (state.pendingActPick === 0) {
                    state.pendingActPick = null;
                }
                console.log('[hd-battle] blank-watchdog', {
                    why: why || 'aim-hidden',
                    pendingApproach: state.pendingApproach,
                    pendingActPick: state.pendingActPick,
                    phase: 3,
                    wait: !!fight.wait,
                    leftoverAim: leftoverAim(fight),
                    legalAim: hasLegalAimTarget(),
                    adj: !!(adjacentEnemy(1)),
                    aimAge: aimAgeMs()
                });
                if (aimCommitHolds()) {
                    if (leftoverAim(fight) || aimCommitAgeMs() > 2200) {
                        leaveAimAndRearm('watchdog-aim-commit');
                        return;
                    }
                    armBlankMenuWatchdog('aim-commit-wait');
                    return;
                }
                if (tryCommitMeleeAim(why || 'watchdog-aim')) {
                    return;
                }
                if (handleLeftoverAimAdj(why || 'watchdog-aim')) {
                    return;
                }
                /* leftover AIM 先 EXIT 再 forceShow，绝不能停在 phase=3 空白。 */
                if (leftoverAim(fight) || aimAgeMs() > 2000) {
                    leaveAimAndRearm('watchdog-aim');
                    return;
                }
                armBlankMenuWatchdog(why || 'still-aim');
                return;
            }
            if (!playerHasWaitingOwn()) {
                return;
            }
            if (state.lastHitAt && Number(fight && fight.phase) === 2) {
                if (state.pendingApproach) {
                    scheduleDrive('after-hit-phase2');
                } else {
                    var stayHit = null;
                    try { stayHit = bindWalkedActor() || actingActor(); } catch (eSh) {
                        stayHit = actingActor();
                    }
                    if (stayHit && unitMeleeEnemy(stayHit)) {
                        if (!focusOnNamedUnit(stayHit)) {
                            logBlankWatchdog('after-hit-phase2-walk-actor', fight);
                            walkFocusTo(stayHit.x, stayHit.y, false);
                        } else {
                            logBlankWatchdog('after-hit-phase2-melee', fight);
                            writeFightActCommit(0xFF);
                            enqueueKeys([VK.ENTER], 55);
                            state.movedThisAct = true;
                            scheduleActRearm('after-hit-phase2-melee');
                        }
                    } else {
                        var foeHit = bestEnemyForApproach(stayHit) || nearestEnemyFrom(stayHit);
                        if (foeHit && stayHit && stayHit.name && !isLordUnit(stayHit)) {
                            logBlankWatchdog('after-hit-phase2-walk', fight);
                            setPendingApproach(foeHit.x, foeHit.y);
                            scheduleDriveSoon('after-hit-phase2-walk', 80);
                        }
                    }
                }
                armBlankMenuWatchdog('after-hit-phase2');
                return;
            }
            if (state.lastHitAt && Number(fight && fight.phase) === 1) {
                try { clickNextAfterHit(); } catch (eP1w) {}
                armBlankMenuWatchdog('after-hit-phase1');
                return;
            }
            if (state.lastHitAt && Number(fight && fight.phase) !== 3 &&
                (firstWaitingOwn({ skipLord: true, includeStuck: true }) ||
                    Date.now() - state.lastHitAt < 2200)) {
                logBlankWatchdog('after-hit-settle', fight);
                settleAfterAttackHit();
                try { clickNextAfterHit(); } catch (eN) {}
                armBlankMenuWatchdog('after-hit-continue');
                return;
            }
            if (menuPanelClickable()) {
                return;
            }
            if (state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 1400) {
                armBlankMenuWatchdog('still-walk');
                return;
            }
            if (enemyTurnQuiet(fight)) {
                dropQueuedEnters();
                return;
            }
            if (fight && Number(fight.phase) === 2 && fight.wait) {
                if (state.pendingApproach) {
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
                var stay2 = null;
                try { stay2 = bindWalkedActor() || actingActor(); } catch (eS2) {}
                if (stay2 && unitMeleeEnemy(stay2)) {
                    logBlankWatchdog('phase2-melee-stay', fight);
                    writeFightActCommit(0xFF);
                    enqueueKeys([VK.ENTER], 55);
                    state.movedThisAct = true;
                    scheduleActRearm('watchdog-phase2-melee');
                    return;
                }
                var foe2 = nearestEnemyFrom(stay2) || nearestEnemy();
                if (foe2 && stay2 && stay2.name && !isLordUnit(stay2)) {
                    logBlankWatchdog('phase2-no-dest', fight);
                    setPendingApproach(foe2.x, foe2.y);
                    scheduleDriveSoon('watchdog-phase2-walk', 80);
                    return;
                }
                logBlankWatchdog('phase2-idle-rest', fight);
                preferRest('watchdog-phase2-idle');
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
        if (adjRecoverHidesMenu()) {
            return;
        }
        var keepApproach = state.pendingApproach;
        var keepPick = state.pendingActPick;
        var fightKeep = null;
        try { fightKeep = readFight(); } catch (eK) {}
        if (enemyTurnQuiet(fightKeep)) {
            return;
        }
        if (fightKeep && Number(fightKeep.phase) === 3) {
            keepApproach = null;
            keepPick = (keepPick === 0) ? null : keepPick;
            clearPendingApproach();
        }
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
                if (aimCommitHolds()) {
                    if (leftoverAim(fight) || aimCommitAgeMs() > 2200) {
                        exitLeftoverAimOnce(why || 'rearm-aim-commit', { afterHit: true });
                    }
                    return;
                }
                if (tryCommitMeleeAim(why || 'rearm-aim')) {
                    return;
                }
                if (likelyAimTarget() && Date.now() - started < 2000) {
                    state.rearmTimer = setTimeout(tick, 80);
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
                if (leftoverAim(fight) && Date.now() - started < 2200) {
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
                if (likelyAimTarget() && Date.now() - started < 2000) {
                    state.rearmTimer = setTimeout(tick, 80);
                    return;
                }
            }
            if (/after-attack|aim-oor|leftover|watchdog-aim/.test(why || '') &&
                state.movedThisAct && !likelyAimTarget() && !awaitingAim()) {
                preferRest('rearm-leftover-after-move');
                return;
            }
            state.leavingAim = false;
            if (/after-approach/.test(why || '')) {
                try { bindWalkedActor(); } catch (eBind) {}
                var walkMelee = namedAdjStrike();
                if (walkMelee) {
                    state.pendingActPick = 0;
                    console.log('[hd-battle] after-approach-melee', {
                        actor: walkMelee.unit && walkMelee.unit.name,
                        ux: walkMelee.unit && walkMelee.unit.x,
                        uy: walkMelee.unit && walkMelee.unit.y,
                        enemy: walkMelee.enemy && walkMelee.enemy.name,
                        ex: walkMelee.enemy && walkMelee.enemy.x,
                        ey: walkMelee.enemy && walkMelee.enemy.y
                    });
                    if (drivePhase0LiveAdjAim('after-approach-melee')) {
                        return;
                    }
                    if (aimOrMeleeMovedActor('after-approach-melee')) {
                        return;
                    }
                    forceShowFightMenu('after-approach-melee');
                    if (commitAdjacentMelee('after-approach-melee')) {
                        return;
                    }
                    scheduleDriveSoon('after-approach-melee', 80);
                    return;
                }
                var fightAp = null;
                try { fightAp = readFight(); } catch (eAp) {}
                var phaseAp = Number(fightAp && fightAp.phase) || 0;
                var walkActor = null;
                try { walkActor = bindWalkedActor() || actingActor(); } catch (eWa) {
                    walkActor = actingActor();
                }
                var walkFoe = walkActor && nearestEnemyFrom(walkActor);
                var walkD = (walkActor && walkFoe)
                    ? chebyshev(walkActor.x, walkActor.y, walkFoe.x, walkFoe.y) : 99;
                if (phaseAp === 2 && !state.movedThisAct && walkFoe) {
                    console.log('[hd-battle] after-approach-keep-walk', {
                        actor: walkActor && walkActor.name,
                        ux: walkActor && walkActor.x,
                        uy: walkActor && walkActor.y,
                        dest: { name: walkFoe.name, x: walkFoe.x, y: walkFoe.y },
                        dist: walkD,
                        phase: phaseAp
                    });
                    setPendingApproach(walkFoe.x, walkFoe.y);
                    scheduleDriveSoon('after-approach-keep-walk', 80);
                    return;
                }
                console.log('[hd-battle] after-approach-short', {
                    via: 'not-melee',
                    actor: walkActor || state.actorAt,
                    pending: state.pendingPickUnit || '',
                    dist: walkD,
                    phase: phaseAp,
                    moved: !!state.movedThisAct
                });
                preferRest('after-approach-short');
                setTimeout(function () {
                    try { armNextWaitingOwn('after-approach-short', { force: true }); } catch (eNx) {}
                }, 280);
                return;
            }
            forceShowFightMenu(why || 'after-rearm');
        }
        state.rearmTimer = setTimeout(tick, 180);
    }

    function leaveAimAndRearm(why, opts) {
        opts = opts || {};
        /* 已经 melee ENTER 过：只 EXIT 离 AIM，禁止再武装攻击/走近。 */
        if (aimCommitHolds()) {
            dropQueuedKeys();
            state.pendingAimEnter = null;
            clearPendingApproach();
            state.pendingActPick = null;
            clearPickThrottle('aim-commit');
            exitLeftoverAimOnce(why || 'aim-commit', { afterHit: true });
            scheduleAfterHitSettle(180);
            return;
        }
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
            holdEndTurnAfterRest();
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
        if (forceEndTurnArmed()) {
            return false;
        }
        if (endTurnBrokeArmed()) {
            forceFinishWaitingOrEndTurn('broke-end-turn');
            return false;
        }
        if (endTurnHeld()) {
            if (playerHasWaitingOwn() && Number(fight.phase) !== 2 && Number(fight.phase) !== 3 &&
                !state.pendingApproach && !awaitingAim() && !nextUnitStalled()) {
                armNextWaitingOwn('end-turn-hold-waiting');
            }
            return false;
        }
        if (playerHasWaitingOwn()) {
            if (!state.lastHitAt) {
                return false;
            }
            if (state.lastHitAt && Date.now() - state.lastHitAt < 2200) {
                return false;
            }
            if (liveActMenu() || hdActMenuVisible()) {
                if (leftoverHitterMenu(fight) || leftoverExitBanned()) {
                    return false;
                }
                var postStrike = adjacentWaitingStrike();
                if (postStrike && commitAdjacentMelee('post-hit-adj-menu')) {
                    return true;
                }
                if (playerHasWaitingOwn()) {
                    armNextWaitingOwn('post-hit-next', { force: true });
                }
                return false;
            }
            if (nextUnitStalled()) {
                forceFinishWaitingOrEndTurn('end-turn-still-waiting');
                return false;
            }
            if (Number(fight.phase) === 2 || Number(fight.phase) === 3 ||
                state.pendingApproach || state.approachPathWaitAt || awaitingAim() ||
                liveActMenu()) {
                return false;
            }
            armNextWaitingOwn('end-turn-still-waiting');
            return false;
        }
        if ((state.actedThisTurn || 0) < countPlayerUnits() &&
            Date.now() - (state.lastRestCommitAt || state.walkSubmittedAt || 0) < 4800) {
            return false;
        }
        if (state.pendingApproach ||
            (state.walkSubmittedAt && (Date.now() - state.walkSubmittedAt) < 1400)) {
            return false;
        }
        if (state.lastRestCommitAt && Date.now() - state.lastRestCommitAt < 3600) {
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

    function capableSkipLordWaiting() {
        var strike = null;
        try { strike = adjacentWaitingStrike(); } catch (eS) {}
        if (strike && strike.unit && !isLordUnit(strike.unit)) {
            return strike.unit;
        }
        var next = firstWaitingOwn({ skipLord: true });
        if (next) {
            return next;
        }
        /* 真伤后：give-up/stuck 副将仍 STA_WAIT，必须再走近/AIM。 */
        if (state.lastHitAt || state.fightHitAt) {
            return firstWaitingOwn({ skipLord: true, includeStuck: true });
        }
        return null;
    }

    function shouldSysEndAfterLordHold() {
        if (capableSkipLordWaiting()) {
            return false;
        }
        if (firstWaitingOwn({ skipLord: true, includeStuck: true })) {
            return false;
        }
        if (state.lastHitAt || state.adjRecoverGiveUpKey) {
            return true;
        }
        return (state.lordHoldRestN || 0) >= 1;
    }

    function armCapableSkipLord(why) {
        var next = capableSkipLordWaiting();
        if (!next) {
            return false;
        }
        notePendingPick(next);
        noteActingUnit(next);
        state.pendingActPick = 0;
        state.movedThisAct = false;
        var foe = unitMeleeEnemy(next) || bestEnemyForApproach(next) || nearestEnemyFrom(next);
        if (foe) {
            setPendingApproach(foe.x, foe.y);
        }
        console.log('[hd-battle] next-unit', {
            via: why || 'skip-lord',
            name: next.name,
            x: next.x,
            y: next.y,
            dest: foe ? { name: foe.name, x: foe.x, y: foe.y } : null,
            acted: state.actedThisTurn
        });
        try { clickWaitingOwn(); } catch (eC) {}
        scheduleDriveSoon(why || 'skip-lord', 80);
        return true;
    }

    function sysEndPlayerTurn(why) {
        if (!fightReallyActive() || state.resultText || state.playerTurnEnded || recentlyEndedTurn()) {
            return false;
        }
        if (armCapableSkipLord((why || 'sys-end') + '-still-other')) {
            return true;
        }
        var leftoverEnd = firstWaitingOwn({ skipLord: true, includeStuck: true });
        if (leftoverEnd && !actorSpent(leftoverEnd) && !recentlyHitActor(leftoverEnd)) {
            console.log('[hd-battle] sys-end-blocked', {
                via: why || 'sys',
                leftover: leftoverEnd.name,
                waiting: true
            });
            notePendingPick(leftoverEnd);
            noteActingUnit(leftoverEnd);
            return armNextWaitingOwn((why || 'sys-end') + '-leftover', { force: true }) ||
                pickNextCapableAfterGiveUp((why || 'sys-end') + '-leftover');
        }
        if (adjacentWaitingStrike() && commitAdjacentMelee('end-turn-last-melee')) {
            return true;
        }
        if (movedActorAdjacentEnemy() && aimOrMeleeMovedActor('end-turn-last-aim')) {
            return true;
        }
        dropQueuedEnters();
        dropQueuedKeys();
        clearPendingApproach();
        state.pendingActPick = 3;
        state.holdEndTurnUntil = 0;
        state.lastRestCommitAt = 0;
        state.forceEndTurnUntil = Date.now() + 8000;
        state.endTurnAt = Date.now();
        state.openedSysForEndTurn = true;
        state.allowEndTurnEnter = false;
        state.lordHoldRestN = (state.lordHoldRestN || 0) + 1;
        try { installSysMenuHook(); } catch (eHook) {}
        enqueueKeys([VK.EXIT], 70);
        console.log('[hd-battle] sys-end-turn', {
            via: why || 'sys',
            acted: state.actedThisTurn,
            waiting: playerHasWaitingOwn(),
            giveUp: !!state.adjRecoverGiveUpKey,
            lordHoldN: state.lordHoldRestN,
            hit: !!state.lastHitAt
        });
        setTimeout(function () {
            if (state.playerTurnEnded || !state.openedSysForEndTurn) {
                return;
            }
            enqueueKeys([VK.EXIT], 70);
            console.log('[hd-battle] rest-commit', { via: 'end-turn-exit-retry' });
        }, 400);
        return true;
    }

    function lordHoldRestOrEndTurn(why) {
        if (armCapableSkipLord((why || 'lord-hold') + '-pick-other')) {
            return true;
        }
        var fightNow = null;
        try { fightNow = readFight(); } catch (eF) {}
        var phaseNow = Number(fightNow && fightNow.phase) || 0;
        if (state.openedSysForEndTurn || forceEndTurnArmed() || (state.lordHoldRestN || 0) >= 1) {
            if (shouldSysEndAfterLordHold()) {
                return sysEndPlayerTurn(why || 'lord-hold-repeat');
            }
            return true;
        }
        if (phaseNow === 1 && fightNow && fightNow.wait) {
            console.log('[hd-battle] rest-skip', {
                via: why || 'lord-hold', why: 'phase1-wait-noop'
            });
            if (shouldSysEndAfterLordHold()) {
                return sysEndPlayerTurn(why || 'lord-hold-phase1');
            }
            return true;
        }
        if (liveActMenu() && phaseNow === 0 && fightNow && !fightNow.wait) {
            state.lordHoldRestN = (state.lordHoldRestN || 0) + 1;
            return false;
        }
        if (shouldSysEndAfterLordHold()) {
            return sysEndPlayerTurn(why || 'lord-hold-end');
        }
        return false;
    }

    function preferRest(why) {
        var restFight = null;
        try { restFight = readFight(); } catch (eRF) {}
        if (phase0LiveAdjReady(restFight) && drivePhase0LiveAdjAim(why || 'rest-blocked-phase0')) {
            return;
        }
        if (killableAdjAlive() &&
            /stall-break-rest|act-commit|approach-nowait|after-hit|end-player-turn-stall|phase1-enter-stuck|lord-hold|attack-after-short-walk/.test(why || '')) {
            console.log('[hd-battle] rest-blocked', { via: why || 'prefer-rest', why: 'adj-enemy-alive' });
            clearAdjMeleeThrottle('rest-blocked-adj');
            if (commitAdjacentMelee('rest-blocked-adj')) {
                return;
            }
            if (aimOrMeleeMovedActor('rest-blocked-moved')) {
                return;
            }
        }
        if (/attack-after-short-walk|approach-nowait-after-walk|after-approach/.test(why || '')) {
            if (aimOrMeleeMovedActor(why || 'after-walk-aim')) {
                return;
            }
        }
        if (/lord-hold/.test(why || '')) {
            if (lordHoldRestOrEndTurn(why)) {
                return;
            }
        }
        var fightRest = null;
        try { fightRest = readFight(); } catch (eR) {}
        var phase1Wait = !!(fightRest && Number(fightRest.phase) === 1 && fightRest.wait);
        if (phase1Wait) {
            console.log('[hd-battle] rest-skip', {
                via: why || 'prefer-rest', why: 'phase1-wait-noop'
            });
            if (armCapableSkipLord((why || 'prefer-rest') + '-phase1-other')) {
                return;
            }
            if (/after-approach-short/.test(why || '') &&
                firstWaitingOwn({ skipLord: true, includeStuck: true })) {
                try { armNextWaitingOwn('after-approach-short-phase1', { force: true }); } catch (eAs) {}
                return;
            }
            if (shouldSysEndAfterLordHold()) {
                sysEndPlayerTurn(why || 'phase1-rest-end');
            }
            return;
        }
        clearPendingApproach();
        state.pendingActPick = 3;
        state.approachRepeatCount = 0;
        state.movedThisAct = false;
        writeFightActCommit(3);
        console.log('[hd-battle] rest-commit', {
            via: why || 'prefer-rest', moved: !!state.movedThisAct, commit: 3
        });
        state.lastRestAt = Date.now();
        state.lastRestCommitAt = Date.now();
        noteUnitActed(why || 'prefer-rest');
        holdEndTurnAfterRest();
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
            if (state.lastPickWalkAt && Date.now() - state.lastPickWalkAt < 2200 &&
                adjacentWaitingStrike() && commitAdjacentMelee('drive-after-pick-walk')) {
                return;
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
        var fightOwn = null;
        try { fightOwn = readFight(); } catch (eOwn) {}
        if (enemyTurnQuiet(fightOwn) || (state.holdPickUntil && Date.now() < state.holdPickUntil)) {
            return null;
        }
        if (awaitingAim() || aimCommitHolds()) {
            return null;
        }
        if (leftoverHitterMenu(fightOwn) ||
            (leftoverExitBanned() && fightOwn && Number(fightOwn.phase) === 0 &&
                !fightOwn.wait)) {
            var livePick = null;
            try { livePick = namedAdjStrike(); } catch (eLp) { livePick = null; }
            if (liveActMenu() && livePick && livePick.unit &&
                !actorSpent(livePick.unit) && !leftoverHitterMenu(fightOwn)) {
                finishHandoff('after-hit-pick-live');
                try { openAimFromActMenu('after-hit-pick-live', livePick); } catch (eAim) {}
            }
            return null;
        }
        /* 真伤后必须立刻点下一将。焦点还在敌军格时再等半秒会丢掉 after-hit 武装。 */
        if (state.lastHitAt && Date.now() - state.lastHitAt < 220 &&
            !state.pendingPickUnit && !state.pendingApproach) {
            return null;
        }
        if (state.movedThisAct && adjacentEnemy(1) &&
            (state.pendingActPick === 0 || awaitingAim())) {
            return null;
        }
        if (fightOwn && Number(fightOwn.phase) === 1 && fightOwn.wait &&
            state.lastPickEnterAt && Date.now() - state.lastPickEnterAt < 800 &&
            !(state.lastHitAt && Date.now() - state.lastHitAt < 2200) &&
            !state.pendingApproach) {
            return null;
        }
        var strikeOwn = adjacentWaitingStrike();
        var includeStuckPick = !!(state.lastHitAt || state.fightHitAt);
        var pick = (strikeOwn && strikeOwn.unit) ||
            nearestActionableOwn({ skipLord: true, includeStuck: includeStuckPick }) ||
            firstWaitingOwn({ skipLord: true, includeStuck: includeStuckPick }) ||
            firstWaitingOwn({ lordOnly: true });
        if (!pick) {
            return null;
        }
        if (fightOwn && Number(fightOwn.phase) === 1 && fightOwn.wait &&
            phase1EnterCapBlocksEnter(pick.x, pick.y)) {
            schedulePhase1StuckRecover(40);
            return null;
        }
        if (fightOwn && Number(fightOwn.phase) === 1) {
            clearMovedThisAct('pick-next-general');
        }
        if (isLordUnit(pick) && !adjacentEnemy(1) && !strikeOwn) {
            var otherOwn = firstWaitingOwn({ skipLord: true });
            if (otherOwn) {
                pick = otherOwn;
                state.pendingActPick = 0;
                var otherFoe = unitAdjacentEnemy(otherOwn, 1) || nearestEnemyFrom(otherOwn);
                if (otherFoe) {
                    setPendingApproach(otherFoe.x, otherFoe.y);
                }
                console.log('[hd-battle] lord-hold', {
                    via: 'pick-skip-to-other',
                    to: otherOwn.name,
                    x: otherOwn.x,
                    y: otherOwn.y
                });
            } else {
                state.pendingActPick = 3;
                clearPendingApproach();
                console.log('[hd-battle] lord-hold', { name: pick.name, x: pick.x, y: pick.y, via: 'pick' });
            }
        }
        notePendingPick(pick);
        noteActingUnit(pick);
        return clickBattleTile(pick.x, pick.y);
    }

    function firstWaitingOwn(opts) {
        opts = opts || {};
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'player' || u.x == null || u.y == null) {
                continue;
            }
            if (!(u.active === 0 || u.active == null)) {
                continue;
            }
            if (opts.skipLord && isLordUnit(u)) {
                continue;
            }
            if (opts.lordOnly && !isLordUnit(u)) {
                continue;
            }
            /* 真伤 leftover 即使还贴脸也跳过，换杨秋/梁兴，禁止 after-hit-settle 再点庞德。 */
            if (actorSpent(u) || recentlyHitActor(u)) {
                continue;
            }
            if (isHandoffSkip(u) && !opts.includeHandoffSkip) {
                continue;
            }
            if (!opts.includeStuck) {
                /* 两次选将仍停 phase1 的贴脸将：换杨秋/梁兴，禁止再点回庞德。 */
                if (state.adjRecoverGiveUpKey && state.adjRecoverGiveUpKey === unitCapKey(u)) {
                    continue;
                }
                /* 两次选将仍停 phase1 且未贴脸：换人，禁止对杨秋自己格连发 ENTER。 */
                if (isPhase1StuckUnit(u)) {
                    continue;
                }
            }
            return u;
        }
        return null;
    }

    /* 优先贴脸，再按 Chebyshev 最近可走近副将。真伤后 includeStuck 放行 give-up。 */
    function nearestActionableOwn(opts) {
        opts = opts || {};
        var strike = null;
        try { strike = adjacentWaitingStrike(); } catch (eS) {}
        if (strike && strike.unit && !(opts.skipLord && isLordUnit(strike.unit))) {
            return strike.unit;
        }
        var best = null;
        var bestD = 99;
        var i;
        for (i = 0; i < state.units.length; i++) {
            var u = state.units[i];
            if (!u || u.side !== 'player' || u.x == null || u.y == null) {
                continue;
            }
            if (!(u.active === 0 || u.active == null)) {
                continue;
            }
            if (opts.skipLord && isLordUnit(u)) {
                continue;
            }
            if (opts.lordOnly && !isLordUnit(u)) {
                continue;
            }
            if (actorSpent(u) || recentlyHitActor(u)) {
                continue;
            }
            if (isHandoffSkip(u) && !opts.includeHandoffSkip) {
                continue;
            }
            if (!opts.includeStuck) {
                if (state.adjRecoverGiveUpKey && state.adjRecoverGiveUpKey === unitCapKey(u)) {
                    continue;
                }
                if (isPhase1StuckUnit(u)) {
                    continue;
                }
            }
            var foe = unitMeleeEnemy(u) || nearestEnemyFrom(u);
            var d = foe ? chebyshev(u.x, u.y, foe.x, foe.y) : 98;
            var r = attackerRank(u);
            var br = best ? attackerRank(best) : 99;
            if (!best || r < br || (r === br && d < bestD) ||
                (r === br && d === bestD && !isLordUnit(u) && isLordUnit(best))) {
                best = u;
                bestD = d;
            }
        }
        return best;
    }

    /* 君主未贴脸：改点下一名未行动己方，走近再打。禁止把君主推到王匡面前。 */
    function deferLordToOther(why) {
        var strikeDef = adjacentWaitingStrike();
        var other = (strikeDef && strikeDef.unit) || firstWaitingOwn({ skipLord: true });
        if (!other) {
            return false;
        }
        var fightNow = null;
        try { fightNow = readFight(); } catch (eD) {}
        var phaseNow = Number(fightNow && fightNow.phase) || 0;
        /* phase=2 点别人格会把君主走过去。wait=0 真菜单只能待机，不能改点。 */
        if (phaseNow === 2 || phaseNow === 3) {
            return false;
        }
        if (fightNow && !fightNow.wait) {
            if (strikeDef || other) {
                preferRest('lord-hold-for-other');
                notePendingPick(other);
                noteActingUnit(other);
                scheduleDriveSoon('lord-hold-after-rest', 160);
                return true;
            }
            return false;
        }
        if (strikeDef) {
            console.log('[hd-battle] lord-hold', {
                via: (why || 'defer') + '-melee',
                to: other.name,
                x: other.x,
                y: other.y,
                dest: { name: strikeDef.enemy.name, x: strikeDef.enemy.x, y: strikeDef.enemy.y }
            });
            return commitAdjacentMelee(why || 'lord-defer-melee');
        }
        var foe = bestEnemyForApproach(other) || nearestEnemy();
        clearPendingApproach();
        state.pendingActPick = 0;
        if (foe) {
            setPendingApproach(foe.x, foe.y);
        }
        notePendingPick(other);
        noteActingUnit(other);
        console.log('[hd-battle] lord-hold', {
            via: why || 'defer',
            to: other.name,
            x: other.x,
            y: other.y,
            dest: foe ? { name: foe.name, x: foe.x, y: foe.y } : null
        });
        scheduleDriveSoon(why || 'lord-defer', 80);
        return true;
    }

    function maybePickOtherOnOpen() {
        if (state.lordOpenDeferred) {
            return;
        }
        var nextOpen = nearestActionableOwn({ skipLord: true, includeStuck: true }) ||
            firstWaitingOwn({ skipLord: true, includeStuck: true });
        if (!nextOpen) {
            return;
        }
        var fightNow = null;
        try { fightNow = readFight(); } catch (eO) {}
        if (!fightNow || !fightNow.active || fightNow.over) {
            return;
        }
        var phaseNow = Number(fightNow.phase) || 0;
        if (phaseNow !== 1 && !(phaseNow === 0 && fightNow.wait)) {
            return;
        }
        state.lordOpenDeferred = true;
        notePendingPick(nextOpen);
        noteActingUnit(nextOpen);
        var openFoe = unitMeleeEnemy(nextOpen) || bestEnemyForApproach(nextOpen) ||
            nearestEnemyFrom(nextOpen);
        if (openFoe && !unitMeleeEnemy(nextOpen)) {
            setPendingApproach(openFoe.x, openFoe.y);
        }
        console.log('[hd-battle] lord-hold', {
            via: 'open-pick-other',
            to: nextOpen.name,
            dest: openFoe ? { name: openFoe.name, x: openFoe.x, y: openFoe.y } : null
        });
        setTimeout(function () {
            try { clickWaitingOwn(); } catch (eP) {}
        }, 0);
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
        if (enemyTurnQuiet(fight) || (state.holdPickUntil && Date.now() < state.holdPickUntil)) {
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
                if (idx === 0 && adjacentWaitingStrike() &&
                    commitAdjacentMelee('drive-act-melee')) {
                    return true;
                }
                if (idx === 0 && actingLordUnit() && !adjacentEnemy(1) &&
                    !adjacentWaitingStrike()) {
                    state.pendingActPick = 3;
                    state.autoActTries = 0;
                    pickFightMenu(3);
                    return true;
                }
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
                if (handleLeftoverAimAdj('drive-leftover-aim')) {
                    return true;
                }
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
            holdEndTurnAfterRest();
            if (playerHasWaitingOwn()) {
                armNextWaitingOwn('stay-then-rest');
            }
            return true;
        }
        if (phase === 2 && wantsWalkBeforeAct(state.pendingActPick)) {
            /* 点「攻击」后停在 FgtGenMove。超距就走近再打，绝不原地回车进瞄准。 */
            if (!state.pendingApproach) {
                var foe = bestEnemyForApproach(actingActor()) || nearestEnemy();
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
        rec.hdMenu = hdActMenuVisible();
        rec.hitAge = state.lastHitAt ? (Date.now() - state.lastHitAt) : null;
        rec.lastPickAge = state.lastPickEnterAt ? (Date.now() - state.lastPickEnterAt) : null;
        rec.phase1EnterSent = !!state.phase1EnterSent;
        rec.phase1CapKey = state.phase1EnterCapKey || '';
        rec.phase1Stuck = state.phase1StuckUnitKey || '';
        rec.pendingPick = state.pendingPickUnit || '';
        rec.strike = (function () {
            var s = null;
            try { s = adjacentWaitingStrike(); } catch (eS) {}
            return s ? (s.unit && s.unit.name) : '';
        }());
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
        return nearestEnemyFrom(actingActor());
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
            if (phase0LiveAdjReady(fight) && drivePhase0LiveAdjAim('approach-nowait-aim')) {
                return true;
            }
            if (adjacentWaitingStrike() && commitAdjacentMelee('approach-nowait-melee')) {
                return true;
            }
            if (state.movedThisAct && state.pendingApproach) {
                if (aimOrMeleeMovedActor('approach-nowait-after-walk')) {
                    return true;
                }
                clearPendingApproach();
                preferRest('approach-nowait-after-walk');
                setTimeout(function () {
                    try { armNextWaitingOwn('approach-nowait-after-walk', { force: true }); } catch (eAw) {}
                }, 280);
                return true;
            }
            if (!recentlyEndedTurn() && !endTurnHeld() && !state.movedThisAct &&
                !state.sawMoveThisTurn && liveActMenu() && (Number(fight.phase) || 0) === 0) {
                if (liveAdjStrike() && drivePhase0LiveAdjAim('approach-nowait-live-adj')) {
                    return true;
                }
                if (leftoverExitBanned() || leftoverHitterMenu(fight)) {
                    scheduleDriveSoon('handoff-no-exit', 160);
                    return true;
                }
                if (state.lastLeftoverActExitAt && Date.now() - state.lastLeftoverActExitAt < 900) {
                    scheduleDriveSoon('leftover-act-exit-wait', 120);
                    return true;
                }
                state.lastLeftoverActExitAt = Date.now();
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
        if (phase === 2 && dest) {
            var stayActor = actingActor();
            if (stayActor && stayActor.x != null && unitMeleeEnemy(stayActor)) {
                if (!focusOnNamedUnit(stayActor)) {
                    console.log('[hd-battle] approach-stay-walk', {
                        unit: stayActor.name,
                        ux: stayActor.x,
                        uy: stayActor.y,
                        dest: dest,
                        focus: engineFocusTile()
                    });
                    walkFocusTo(stayActor.x, stayActor.y, false);
                    scheduleDriveSoon('approach-stay-walk', 120);
                    return true;
                }
                console.log('[hd-battle] approach-stay-adj', {
                    unit: stayActor.name,
                    ux: stayActor.x,
                    uy: stayActor.y,
                    dest: dest
                });
                clearPendingApproach();
                writeFightActCommit(0xFF);
                enqueueKeys([VK.ENTER], 55);
                state.movedThisAct = true;
                state.sawMoveThisTurn = true;
                noteActingUnit(stayActor);
                scheduleActRearm('approach-stay-adj');
                scheduleDriveSoon('approach-stay-adj', 180);
                return true;
            }
        }
        if (phase === 2 && actingLordUnit() && !adjacentEnemy(1)) {
            clearPendingApproach();
            state.pendingActPick = 3;
            enqueueKeys([VK.ENTER], 55);
            preferRest('lord-hold-move');
            console.log('[hd-battle] lord-hold', { via: 'phase2', dest: dest });
            return true;
        }
        if (phase === 2) {
            var actor = syncFocusFromEngine();
            var tiles = countMoveTiles();
            if (!state.approachPathWaitAt) {
                state.approachPathWaitAt = Date.now();
                state.approachTilesPeak = 0;
                state.approachTilesStableAt = 0;
            }
            if (tiles > (state.approachTilesPeak || 0)) {
                state.approachTilesPeak = tiles;
                state.approachTilesStableAt = Date.now();
            }
            var pathWaitMs = Date.now() - state.approachPathWaitAt;
            var expired = pathWaitMs >= 1800 || (state.approachWaitLogs || 0) >= 12;
            var tilesStable = (state.approachTilesPeak || 0) >= 8 &&
                state.approachTilesStableAt &&
                Date.now() - state.approachTilesStableAt >= 500;
            var filled = expired || tilesStable;
            var closer = findCloserMoveTile(actor.x, actor.y, dest.x, dest.y, {
                noStep: !filled && tiles < 6
            });
            var closerRank = closer ? approachTileRank(closer.x, closer.y, dest.x, dest.y) : 99;
            var closerD = closer ? chebyshev(closer.x, closer.y, dest.x, dest.y) : 99;
            var noVia = !closer;
            /* 未正交贴脸（rank>1，对角 1.45 也算短）且走格表还在涨：继续等。 */
            var stillFilling = !filled && closer && closerRank > 1;
            var emptyFilling = !filled && tiles < 2 && noVia;
            if (stillFilling || emptyFilling) {
                state.approachWaitLogs = (state.approachWaitLogs || 0) + 1;
                console.log('[hd-battle] approach-wait-path', {
                    tiles: tiles, via: closer, dest: dest, d: closerD, wait: pathWaitMs
                });
                scheduleDriveSoon('wait-move-range', 80);
                return true;
            }
            if (noVia) {
                closer = findCloserMoveTile(actor.x, actor.y, dest.x, dest.y, { noStep: false });
                closerRank = closer ? approachTileRank(closer.x, closer.y, dest.x, dest.y) : 99;
                closerD = closer ? chebyshev(closer.x, closer.y, dest.x, dest.y) : 99;
            }
            if (closer && closerRank > 1) {
                var altDest = bestEnemyForApproach(actor);
                if (altDest && (altDest.x !== dest.x || altDest.y !== dest.y)) {
                    var altVia = findCloserMoveTile(actor.x, actor.y, altDest.x, altDest.y, {
                        noStep: false
                    });
                    var altRank = altVia ? approachTileRank(altVia.x, altVia.y, altDest.x, altDest.y) : 99;
                    if (altVia && altRank < closerRank) {
                        console.log('[hd-battle] approach-retarget', {
                            from: dest, to: { name: altDest.name, x: altDest.x, y: altDest.y },
                            rank: closerRank, altRank: altRank
                        });
                        dest = { x: altDest.x, y: altDest.y };
                        closer = altVia;
                        closerRank = altRank;
                        closerD = chebyshev(altVia.x, altVia.y, dest.x, dest.y);
                    }
                }
            }
            if (!closer) {
                console.log('[hd-battle] approach-giveup', {
                    why: expired ? 'wait-expired' : 'unreachable',
                    tiles: tiles,
                    dest: dest,
                    from: { x: actor.x, y: actor.y, name: actor && actor.name },
                    wait: pathWaitMs
                });
                state.approachPathWaitAt = 0;
                state.approachWaitLogs = 0;
                clearPendingApproach();
                preferRest('approach-unreachable');
                return true;
            }
            state.approachPathWaitAt = 0;
            state.approachWaitLogs = 0;
            clearPendingApproach();
            /* 走格一旦提交，把「攻击」意图交给落点后的真菜单，才能点待机。 */
            if (wantsWalkBeforeAct(state.pendingActPick)) {
                state.pendingActPick = null;
            }
            if (closer && closer.x === actor.x && closer.y === actor.y) {
                closer = null;
            }
            if (closer) {
                if (noteApproachAttempt(closer, dest, actor)) {
                    return true;
                }
                console.log('[hd-battle] approach walk', dest, 'via', closer, {
                    tiles: tiles,
                    dist: closerD,
                    rank: closerRank,
                    short: closerRank > 1,
                    from: { x: actor.x, y: actor.y, name: actor && actor.name }
                });
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
            if (recentlyEndedTurn() || enemyTurnQuiet(fight) ||
                (state.holdPickUntil && Date.now() < state.holdPickUntil)) {
                clearPendingApproach();
                return false;
            }
            if (state.movedThisAct) {
                /* 本将走格已花：PlcSplMenu 只能瞄准/待机，禁止再 pick-approach。 */
                clearPendingApproach();
                return false;
            }
            if (fight.wait && state.phase1EnterSent && phase1EnterCapBlocksEnter()) {
                schedulePhase1StuckRecover(40);
                return false;
            }
            if (liveActMenu() && (state.sawMoveThisTurn || Number(fight.phase) === 0) &&
                fight && !fight.wait) {
                /* 真 PlcSplMenu（走完 wait=0）才挡。回合后 leftover 攻击字节不能挡走近。 */
                if (state.sawMoveThisTurn) {
                    clearPendingApproach();
                    return false;
                }
                if (endTurnHeld()) {
                    return false;
                }
                if (leftoverExitBanned() || leftoverHitterMenu(fight)) {
                    scheduleDriveSoon('handoff-no-exit', 160);
                    return true;
                }
                if (state.lastLeftoverActExitAt && Date.now() - state.lastLeftoverActExitAt < 900) {
                    scheduleDriveSoon('leftover-act-exit-wait', 120);
                    return true;
                }
                state.lastLeftoverActExitAt = Date.now();
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
        var phaseNowWait = Number(fight.phase) || 0;
        if ((phaseNowWait === 2 || phaseNowWait === 3) && state.phase1EnterSent) {
            clearPhase1EnterCap(phaseNowWait === 2 ? 'move-phase' : 'aim-phase');
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
            if (state.lastHpDropAt && Date.now() - state.lastHpDropAt < 400 &&
                recentlyHitActor(actingActor()) && !adjacentWaitingStrike()) {
                console.log('[hd-battle] attack-skip', { why: 'just-hit' });
                settleAfterAttackHit();
                return;
            }
            var fightPhase1 = null;
            try { fightPhase1 = readFight(); } catch (eP1) {}
            var phaseClick = Number(fightPhase1 && fightPhase1.phase) || 0;
            var adjClick = !!(adjacentWaitingStrike() || adjacentEnemy(1));
            var attackLit = !!(hdActMenuVisible() || liveActMenu() || state.menuIndex === 0);
            if (phaseClick === 1 && fightPhase1 && fightPhase1.wait && adjClick) {
                var recoverBusy = /walk|hold|pick|wait-move|stay|wait-act/.test(state.adjRecoverStage || '');
                if (recoverBusy || (state.phase1AdjEnterHoldUntil &&
                    Date.now() < state.phase1AdjEnterHoldUntil)) {
                    return;
                }
                if (state.adjRecoverGiveUpKey) {
                    armNextWaitingOwn('phase1-adj-give-up', { force: true });
                    return;
                }
                state.phase1AdjEnterHoldUntil = Date.now() + 900;
                recoverAdjActThenAim('phase1-adj-enter');
                return;
            }
            if (state.lastAttackClickAt && Date.now() - state.lastAttackClickAt < 500 &&
                phaseClick === 1 && fightPhase1 && fightPhase1.wait) {
                return;
            }
            state.pendingActPick = 0;
            state.lastAttackAt = Date.now();
            state.lastAttackClickAt = Date.now();
            logAttackClick('pick');
            var fightAtk = null;
            try { fightAtk = readFight(); } catch (eAtk) {}
            var skipLeftover = null;
            try { skipLeftover = focusedFightUnit() || actingActor(); } catch (eSk) {
                skipLeftover = actingActor();
            }
            if (skipLeftover && (isHandoffSkip(skipLeftover) ||
                recentlyHitActor(skipLeftover) || actorSpent(skipLeftover))) {
                console.log('[hd-battle] attack-skip', {
                    why: 'leftover-spent',
                    unit: skipLeftover.name,
                    skip: !!isHandoffSkip(skipLeftover),
                    spent: !!actorSpent(skipLeftover)
                });
                preferRest('leftover-spent');
                if (!pickNextAfterHandoffSkip('leftover-spent')) {
                    sysEndPlayerTurn('leftover-spent-end');
                }
                return;
            }
            /* 攻击已点：贴脸立刻近战 ENTER。走格已花且未贴脸必须待机，禁止 keep-walk 软循环。 */
            if (phase0LiveAdjReady(fightAtk) && drivePhase0LiveAdjAim('attack-adj-menu')) {
                return;
            }
            if ((adjacentWaitingStrike() || liveAdjStrike()) &&
                commitAdjacentMelee('attack-adj-menu')) {
                return;
            }
            if (!adjacentEnemy(1) && !adjacentWaitingStrike() && !liveAdjStrike()) {
                var alreadyMoved = !!(state.movedThisAct ||
                    (state.sawMoveThisTurn && fightAtk && !fightAtk.wait));
                if (alreadyMoved) {
                    if (aimOrMeleeMovedActor('attack-after-short-walk')) {
                        return;
                    }
                    if (state.lastHitAt &&
                        firstWaitingOwn({ skipLord: true, includeStuck: true })) {
                        try { armNextWaitingOwn('attack-after-short-walk-next', { force: true }); } catch (eNx) {}
                        return;
                    }
                    preferRest('attack-after-short-walk');
                    return;
                }
                var keepOwn = firstWaitingOwn({ skipLord: true }) || firstWaitingOwn({ lordOnly: true });
                var keepFoe = bestEnemyForApproach(keepOwn) || nearestEnemy();
                if (keepOwn && (actorSpent(keepOwn) || recentlyHitActor(keepOwn))) {
                    keepOwn = firstWaitingOwn({ skipLord: true }) || firstWaitingOwn({ lordOnly: true });
                }
                if (keepFoe && keepOwn && !actorSpent(keepOwn) && !recentlyHitActor(keepOwn) &&
                    !(isLordUnit(keepOwn) && firstWaitingOwn({ skipLord: true }))) {
                    notePendingPick(keepOwn);
                    noteActingUnit(keepOwn);
                    setPendingApproach(keepFoe.x, keepFoe.y);
                    state.pendingActPick = 0;
                    console.log('[hd-battle] open-aim', {
                        why: 'attack-keep-walk',
                        unit: keepFoe.name,
                        actor: keepOwn.name
                    });
                    scheduleDriveSoon('attack-keep-walk', 70);
                    return;
                }
            }
            noteAimPhase(fightAtk);
            if (fightAtk && Number(fightAtk.phase) === 3 && !leftoverAim(fightAtk)) {
                /* 已在真瞄准：再点攻击不得 EXIT / 不得把菜单盖住棋盘。 */
                console.log('[hd-battle] aim-enter', { why: 'attack-already-aiming', legal: hasLegalAimTarget() });
                tryCommitMeleeAim('attack-already-aiming');
                return;
            }
            state.holdActMenuUntil = Date.now() + 1600;
            forceRevealActMenu('attack-click');
            armBlankMenuWatchdog('after-attack');
            if (leftoverAim(fightAtk)) {
                if (handleLeftoverAimAdj('attack-leftover-aim')) {
                    return;
                }
                var foe = nearestEnemy();
                leaveAimAndRearm('attack-leftover-aim', state.movedThisAct
                    ? { thenRest: true }
                    : (foe ? { thenApproach: { x: foe.x, y: foe.y } } : { thenRest: true }));
                return;
            }
            /* 攻击已高亮且有人贴脸：立刻近战，禁止待机/合成菜单软循环。 */
            if (adjacentWaitingStrike() && commitAdjacentMelee('attack-adj-menu')) {
                return;
            }
            /* PlcSplMenu 真菜单 wait=0 且本将已走格才 ENTER 攻击。否则先走近。 */
            if (!canCommitActMenu(fightAtk)) {
                state.autoActTries = 0;
                state.lastAutoActAt = 0;
                state.menuIndex = 0;
                if (adjacentWaitingStrike()) {
                    state.keepAttackEnterUntil = Date.now() + 900;
                    scheduleDriveSoon('attack-adj-commit', 40);
                    return;
                }
                if (actingLordUnit() && !adjacentEnemy(1)) {
                    if (state.openedSysForEndTurn || forceEndTurnArmed() ||
                        (state.lordHoldRestN || 0) >= 1) {
                        sysEndPlayerTurn('lord-hold-attack-repeat');
                        return;
                    }
                    if (deferLordToOther('lord-hold-attack')) {
                        return;
                    }
                    var otherAtk = firstWaitingOwn({ skipLord: true });
                    if (otherAtk) {
                        notePendingPick(otherAtk);
                        noteActingUnit(otherAtk);
                        state.pendingActPick = 0;
                        scheduleDriveSoon('lord-hold-pick-other', 80);
                        return;
                    }
                    preferRest('lord-hold-attack');
                    return;
                }
                var foeAtk = bestEnemyForApproach(actingActor()) || nearestEnemy();
                if (foeAtk) {
                    state.approachedThisAct = true;
                    setPendingApproach(foeAtk.x, foeAtk.y);
                    state.pendingActPick = 0;
                    console.log('[hd-battle] open-aim', { why: 'attack-then-walk', unit: foeAtk.name });
                    scheduleDriveSoon('attack-then-walk', 70);
                    return;
                }
                if (adjacentEnemy(1)) {
                    state.keepAttackEnterUntil = Date.now() + 900;
                    scheduleDriveSoon('attack-adj-commit', 40);
                    return;
                }
                preferRest('attack-once-not-adj');
                return;
            }
            /* FgtDealMan：FgtGenMove 已返回才会到 PlcSplMenu。此后只能瞄准，不能再走近。 */
            if (!adjacentEnemy(1) && !adjacentWaitingStrike()) {
                if (actingLordUnit() && firstWaitingOwn({ skipLord: true })) {
                    if (deferLordToOther('lord-hold-attack')) {
                        return;
                    }
                    preferRest('lord-hold');
                    return;
                }
                if (actingLordUnit() && (state.openedSysForEndTurn || forceEndTurnArmed() ||
                    (state.lordHoldRestN || 0) >= 1 || state.lastHitAt ||
                    state.adjRecoverGiveUpKey)) {
                    sysEndPlayerTurn('lord-hold-attack-commit');
                    return;
                }
                var foeHold = bestEnemyForApproach(actingActor()) || nearestEnemy();
                if (foeHold) {
                    state.approachedThisAct = true;
                    setPendingApproach(foeHold.x, foeHold.y);
                    state.pendingActPick = 0;
                    console.log('[hd-battle] attack-skip', { why: 'not-adjacent-walk', unit: foeHold.name });
                    scheduleDriveSoon('attack-not-adj-walk', 70);
                    return;
                }
                console.log('[hd-battle] attack-skip', { why: 'not-adjacent' });
                preferRest('attack-not-adjacent');
                return;
            }
            if (adjacentWaitingStrike() && !adjacentEnemy(1) &&
                commitAdjacentMelee('attack-adj-after-commit')) {
                return;
            }
            state.movedThisAct = true;
            noteAwaitingAim(2200);
            state.holdActMenuUntil = 0;
            state.keepAttackEnterUntil = Date.now() + 900;
            resetActMenuIndex('attack-commit');
            clearPendingApproach();
            var meleeAtk = adjacentEnemy(1) || firstLegalAimEnemy();
            if (meleeAtk) {
                state.pendingAimEnter = {
                    x: meleeAtk.x, y: meleeAtk.y, at: Date.now(), name: meleeAtk.name
                };
            }
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
                    holdEndTurnAfterRest();
                    scheduleDrive(stuckMove ? 'rest-stuck-move' : 'rest-move-phase');
                    return;
                }
                if (!liveActMenu() || (!state.movedThisAct && !state.sawMoveThisTurn)) {
                    var lordHoldRest = !!(actingLordUnit() && !adjacentEnemy(1) && liveActMenu());
                    if (!lordHoldRest) {
                        dumpEnterSwallow('rest-enter-blocked', {
                            via: !liveActMenu() ? 'no-live-act' : 'not-walked'
                        });
                        return;
                    }
                    console.log('[hd-battle] lord-hold', { via: 'rest-unmoved' });
                }
                state.lastRestAt = Date.now();
                state.lastRestCommitAt = Date.now();
                var fightRest = fightRestEarly;
                if (fightRest && Number(fightRest.phase) === 3) {
                    writeFightActCommit(3);
                    leaveAimAndRearm('rest-cancel-aim', { thenRest: true });
                    state.pendingActPick = 3;
                    holdEndTurnAfterRest();
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
                noteUnitActed('rest');
                holdEndTurnAfterRest();
                if (fightRest && !fightRest.wait) {
                    enqueueKeys([VK.ENTER], 55);
                } else {
                    scheduleDrive('prefer-rest');
                }
                if (playerHasWaitingOwn()) {
                    armNextWaitingOwn('after-rest');
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

    function engineFocusTile() {
        var fx = null;
        var fy = null;
        try {
            var data = engineData();
            fx = readNumber(data, 'g_FoucsX');
            fy = readNumber(data, 'g_FoucsY');
        } catch (eE) {}
        if (fx == null || fy == null || !isFinite(fx) || !isFinite(fy)) {
            return null;
        }
        return { x: Number(fx), y: Number(fy) };
    }

    function focusOnNamedUnit(u) {
        if (!u || !u.name || u.x == null || u.y == null) {
            return false;
        }
        var cur = engineFocusTile();
        if (!cur || cur.x !== u.x || cur.y !== u.y) {
            return false;
        }
        var at = unitAt(cur.x, cur.y);
        return !!(at && at.side === 'player' && at.name === u.name);
    }

    function syncFocusFromEngine() {
        var fight = readFight();
        var data = engineData();
        var live = engineFocusTile();
        var fx = live ? live.x : (fight && fight.focusX != null ? Number(fight.focusX) : readNumber(data, 'g_FoucsX'));
        var fy = live ? live.y : (fight && fight.focusY != null ? Number(fight.focusY) : readNumber(data, 'g_FoucsY'));
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

    function aimRngOrigin() {
        try {
            var data = engineData();
            var rng = data && data.g_FgtAtkRng;
            var size = rng ? readNumber(rng, 0) : 0;
            if (!size) {
                return null;
            }
            return {
                x: readNumber(rng, 1) + (size >> 1),
                y: readNumber(rng, 2) + (size >> 1),
                size: size
            };
        } catch (eO) {
            return null;
        }
    }

    function aimRngMatchesActor(actor) {
        var o = aimRngOrigin();
        return !!(o && actor && actor.x != null && o.x === actor.x && o.y === actor.y);
    }

    function rebuildStaleAimRng(actor) {
        if (actor && actorBoundForAim(actor) &&
            (unitMeleeEnemy(actor) || unitAdjacentEnemy(actor, 1))) {
            exitLeftoverAimThenReopen(actor, 'stale-rng');
            return;
        }
        state.staleRngN = (state.staleRngN || 0) + 1;
        if (state.staleRngN >= 2) {
            console.log('[hd-battle] aim-stale-rng-give-up', {
                n: state.staleRngN,
                actor: actor && actor.name,
                rngAt: aimRngOrigin()
            });
            state.staleRngN = 0;
            leaveAimAndRearm('aim-stale-rng-give-up', { thenRest: true });
            pickNextCapableAfterGiveUp('aim-stale-rng');
            return;
        }
        leaveAimAndRearm('aim-stale-rng');
        setTimeout(function () {
            try {
                if (actor) {
                    noteActingUnit(actor);
                    notePendingPick(actor);
                }
                recoverAdjActThenAim('aim-rebuild-rng');
            } catch (eR) {}
        }, 220);
    }

    function keepAimEnter(why) {
        var fight = null;
        try { fight = readFight(); } catch (eK) {}
        /* 敌军格上尚未发出的 AIM ENTER 必须保住，220ms 会被 drop-queued-enters 吞掉。 */
        if (state.aimCommit && !state.aimCommit.sentEnter && state.aimCommit.onTile &&
            aimCommitAgeMs() < 1600) {
            console.log('[hd-battle] enter-kept', { why: why || 'aim-on-tile-pending' });
            return true;
        }
        /* 提交后只保住刚入队的那一发 ENTER；之后必须丢掉，否则 refresh 会连打。 */
        if (aimCommitHolds()) {
            if (!state.aimCommit.sentEnter && aimCommitAgeMs() < 220) {
                console.log('[hd-battle] enter-kept', { why: why || 'aim-commit' });
                return true;
            }
            return false;
        }
        if (state.lastHitAt && Date.now() - state.lastHitAt < 180) {
            console.log('[hd-battle] enter-kept', { why: why || 'after-hit' });
            return true;
        }
        if (fight && Number(fight.phase) === 3 && leftoverAim(fight)) {
            return false;
        }
        if (fight && Number(fight.phase) === 3 && aimAgeMs() > 2000 && !hasLegalAimTarget()) {
            return false;
        }
        /* 等走位时必须丢掉开菜单残留 ENTER，否则会在敌军格外打「命令无效」。 */
        if (awaitingAim() && !(state.aimCommit && !state.aimCommit.sentEnter &&
            (state.aimCommit.onTile ? aimCommitAgeMs() < 1600 : aimCommitAgeMs() < 220))) {
            return false;
        }
        if (fight && Number(fight.phase) === 3 && !leftoverAim(fight)) {
            if (state.aimCommit && !state.aimCommit.sentEnter &&
                (state.aimCommit.onTile ? aimCommitAgeMs() < 1600 : aimCommitAgeMs() < 220)) {
                console.log('[hd-battle] enter-kept', { why: why || 'aim-on-tile' });
                return true;
            }
            return false;
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
        if (keepAimEnter('drop-enters') || keepAttackCommitEnter('drop-enters')) {
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

    function approachTileRank(x, y, destX, destY) {
        var dx = Math.abs(x - destX);
        var dy = Math.abs(y - destY);
        var d = Math.max(dx, dy);
        if (dx + dy === 1) {
            return d;
        }
        /* 对角 chebyshev=1 打不进 FgtChkRng，比正交差。 */
        if (d === 1) {
            return 1.45;
        }
        return d;
    }

    function findCloserMoveTile(fromX, fromY, destX, destY, opts) {
        opts = opts || {};
        var stay = approachTileRank(fromX, fromY, destX, destY);
        var best = null;
        var bestD = stay;
        var bestFrom = -1;
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
                var d = approachTileRank(x, y, destX, destY);
                var df = chebyshev(x, y, fromX, fromY);
                /* 先正交贴脸；同距则用满走格（df 越大越好）。 */
                if (d < bestD || (d === bestD && d < stay && df > bestFrom)) {
                    bestD = d;
                    bestFrom = df;
                    best = { x: x, y: y };
                }
            }
        }
        if (best && bestD < stay) {
            return best;
        }
        if (opts.noStep) {
            return null;
        }
        /* 走格范围还没灌进 g_FightPath，或敌军在当前 3 格外：朝目标迈一格。 */
        var sx = destX > fromX ? 1 : destX < fromX ? -1 : 0;
        var sy = destY > fromY ? 1 : destY < fromY ? -1 : 0;
        var cands = [
            { x: fromX + sx, y: fromY + sy },
            { x: fromX + sx, y: fromY },
            { x: fromX, y: fromY + sy }
        ];
        var ci;
        for (ci = 0; ci < cands.length; ci++) {
            var nx = cands[ci].x;
            var ny = cands[ci].y;
            if (nx === fromX && ny === fromY) {
                continue;
            }
            if (nx === destX && ny === destY && unitAt(destX, destY)) {
                continue;
            }
            if (!unitAt(nx, ny) &&
                nx >= 0 && ny >= 0 && nx < state.mapW && ny < state.mapH) {
                return { x: nx, y: ny };
            }
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
        /* pick-unit：只点未行动己方。已行动将 / 敌方回合 leftover 点将不得 ENTER。 */
        if (!(unit && unit.side === 'player' && phase !== 3)) {
            return false;
        }
        if (unit.active !== 0 && unit.active != null) {
            return false;
        }
        return !enemyTurnQuiet(fight);
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

    function dropQueuedDirs() {
        var kept = [];
        var i;
        for (i = 0; i < state.queue.length; i++) {
            var c = state.queue[i].code;
            if (c !== VK.UP && c !== VK.DOWN && c !== VK.LEFT && c !== VK.RIGHT) {
                kept.push(state.queue[i]);
            }
        }
        state.queue = kept;
    }

    function walkFocusTo(x, y, thenEnter) {
        if (state.aimCommit && state.aimCommit.sentEnter) {
            return;
        }
        var leftoverFight = null;
        try { leftoverFight = readFight(); } catch (eLf) { leftoverFight = null; }
        if (leftoverHitterMenu(leftoverFight)) {
            console.log('[hd-battle] walk-skip-handoff', { x: x, y: y, enter: !!thenEnter });
            return;
        }
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
            if (phase1EnterCapBlocksEnter(x, y)) {
                console.log('[hd-battle] walk-skip-enter', {
                    via: 'phase1-enter-cap', x: x, y: y
                });
            } else {
                keys.push(VK.ENTER);
            }
        }
        /* AIM/贴脸走近不得叠方向键，否则会走过敌军格。 */
        dropQueuedDirs();
        enqueueKeys(keys, 70);
        /* 不乐观改 state.focus：recover 必须等 g_FoucsX/Y 真到格才 ENTER。 */
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
        if (leftoverHitterMenu(fight)) {
            return {
                x: x, y: y, enter: false, unit: u && u.name, phase: phase,
                blocked: 'leftover-handoff'
            };
        }
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
            if (actingLordUnit() && !adjacentEnemy(1)) {
                if (deferLordToOther('lord-hold-click-enemy')) {
                    return {
                        x: x, y: y, enter: false, unit: u.name, phase: phase,
                        blocked: 'lord-hold-defer'
                    };
                }
                clearPendingApproach();
                state.pendingActPick = 3;
                console.log('[hd-battle] lord-hold', { via: 'click-enemy', unit: u.name });
                return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'lord-hold' };
            }
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
            if (actingLordUnit() && !adjacentEnemy(1)) {
                clearPendingApproach();
                state.pendingActPick = 3;
                enqueueKeys([VK.ENTER], 55);
                preferRest('lord-hold-click');
                return { x: x, y: y, enter: false, unit: u.name, phase: phase, blocked: 'lord-hold' };
            }
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
            var adjNow = !!(actor && actor.x != null && chebyshev(actor.x, actor.y, x, y) <= 1);
            dropQueuedEnters();
            if (adjNow) {
                clearPendingApproach();
                state.pendingActPick = 0;
                state.keepAttackEnterUntil = Date.now() + 900;
                state.walkSubmittedAt = Date.now();
                state.movedThisAct = true;
                state.sawMoveThisTurn = true;
                enqueueKeys([VK.ENTER], 55);
                scheduleActRearm('after-adjacent-move');
                console.log('[hd-battle] move-submit-adj', {
                    actor: actor && { name: actor.name, x: actor.x, y: actor.y },
                    enemy: u.name, x: x, y: y
                });
                return {
                    x: x, y: y, enter: true, unit: u.name, phase: phase,
                    blocked: 'move-submit-adj', inRng: true
                };
            }
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
            preferRest('move-oor-rest');
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
        var persistHit = !!(state.lastHitAt || state.fightHitAt);
        var occupyHold = !!(state.occupyDone || state.occupyStarted || state.occupyPending);
        var fightStill = false;
        try { fightStill = fightReallyActive(); } catch (eLive) {}
        /* 占领横幅 / 活战中途 reset 保住 lastHitAt。新出征 handoff 清上场命中。 */
        if (persistHit && !occupyHold && !fightStill) {
            persistHit = false;
        }
        var savedHit = persistHit ? {
            lastHitAt: state.lastHitAt || state.fightHitAt || 0,
            fightHitAt: state.fightHitAt || state.lastHitAt || 0,
            lastHitActor: state.lastHitActor,
            lastHpDropAt: state.lastHpDropAt,
            lastHpDrop: state.lastHpDrop,
            lastHitHpBefore: state.lastHitHpBefore,
            lastHitTarget: state.lastHitTarget
        } : null;
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
        state.actedThisTurn = 0;
        state.approachPathWaitAt = 0;
        state.approachWaitLogs = 0;
        state.lastArmNextAt = 0;
        state.holdEndTurnUntil = 0;
        state.afterEndTurnUntil = 0;
        state.playerTurnEnded = false;
        state.openedSysForEndTurn = false;
        state.sawMoveThisTurn = false;
            if (savedHit) {
                state.lastHitAt = savedHit.lastHitAt;
                state.fightHitAt = savedHit.fightHitAt;
                state.lastHitActor = savedHit.lastHitActor;
                state.lastHpDropAt = savedHit.lastHpDropAt;
                state.lastHpDrop = savedHit.lastHpDrop;
                state.lastHitHpBefore = savedHit.lastHitHpBefore;
                state.lastHitTarget = savedHit.lastHitTarget;
            } else {
                state.lastHitAt = 0;
                state.fightHitAt = 0;
                state.lastHitActor = null;
                state.lastHpDropAt = 0;
                state.lastHpDrop = null;
                state.lastHitHpBefore = null;
                state.lastHitTarget = null;
            }
            state.sameTileHitN = 0;
            state.lastAttackClickAt = 0;
            state.phase1AdjEnterHoldUntil = 0;
            state.aimCommit = null;
            state.lastPickEnterAt = 0;
            state.holdPickUntil = 0;
            state.lastMenuCommitEnterAt = 0;
            clearPhase1StuckUnits('prepare-new');
            clearPhase1EnterCap('prepare-new');
            clearNextUnitStall('prepare-new');
            try { clearHandoffSkip('prepare-new'); } catch (eHs) {}
            state.leftoverAimReopenN = 0;
            state.leftoverAimReopenActor = '';
            state.leftoverAimReopenAt = 0;
            if (state.leftoverAimReopenTimer) {
                clearTimeout(state.leftoverAimReopenTimer);
                state.leftoverAimReopenTimer = 0;
            }
            state.pendingHandoff = false;
            state.handoffBanExitUntil = 0;
            state.approachedThisAct = false;
            state.keepAttackEnterUntil = 0;
            state.pendingPickUnit = '';
            state.lastAdjMeleeAt = 0;
            state.lastPickWalkAt = 0;
            state.lastFirstActMeleeAt = 0;
            state.lastOpenAimAt = 0;
            state.lastPhase0AimAt = 0;
            state.lastOnTileAimAt = 0;
            state.phase0AimRetryN = 0;
            if (state.phase0IdleTimer) {
                clearTimeout(state.phase0IdleTimer);
                state.phase0IdleTimer = 0;
            }
            if (state.afterHitTimer) {
                clearTimeout(state.afterHitTimer);
                state.afterHitTimer = 0;
            }
        state.lastEnemyQuietLogAt = 0;
        state.lastSwallowAt = 0;
        state.lastSwallowWhy = '';
        state.allowEndTurnEnter = false;
        state.actCommit = null;
        state.actCommitAt = 0;
        state.allowRetreatArmed = false;
        state.lastRestCommitAt = 0;
        state.lordHoldRestN = 0;
        state.actorAt = null;
        state.awaitingAimUntil = 0;
        state.endTurnAt = 0;
        clearFightBridge();
        if (state.open) {
            closeBattle({ silent: true, force: true, why: 'prepare-new' });
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
            closeBattle({ silent: true, force: true, why: 'occupy-done' });
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
                arms: peekPersonArms(id),
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
        syncAimCommit(fightNow);
        noteAimPhase(fightNow);
        noteFightWait(fightNow);
        recoverFightMenu(fightNow);
        if (enemyTurnQuiet(fightNow)) {
            dropQueuedEnters();
            noteEnemyTurnQuiet('refresh', fightNow);
        }
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
        if (fightNow && Number(fightNow.phase) === 3) {
            clearPendingApproach();
            if (state.pendingActPick === 0) {
                state.pendingActPick = null;
            }
        }
        if (state.pendingAimEnter && fightNow && Number(fightNow.phase) === 3) {
            if (aimCommitHolds()) {
                state.pendingAimEnter = null;
            } else {
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
                if (!handleLeftoverAimAdj('refresh-aim-wait-oor')) {
                    leaveAimAndRearm('refresh-aim-wait-oor', state.movedThisAct
                        ? { thenRest: true }
                        : { thenApproach: { x: pe.x, y: pe.y } });
                }
            }
            }
        } else if (fightNow && Number(fightNow.phase) === 3 &&
            (hasLegalAimTarget() || adjacentEnemy(1))) {
            if (aimCommitHolds()) {
                if (leftoverAim(fightNow) && !recentlyLeftAim() &&
                    Date.now() - (state.lastAimExitAt || 0) > 400) {
                    if (!handleLeftoverAimAdj('refresh-aim-commit')) {
                        leaveAimAndRearm('refresh-aim-commit', state.movedThisAct ? { thenRest: true } : null);
                    }
                }
            } else if (!tryCommitMeleeAim('refresh-aim') && leftoverAim(fightNow) &&
                !recentlyLeftAim() && Date.now() - (state.lastAimExitAt || 0) > 400) {
                if (!handleLeftoverAimAdj('refresh-leftover-aim')) {
                    leaveAimAndRearm('refresh-leftover-aim', state.movedThisAct ? { thenRest: true } : null);
                }
            }
        } else if (leftoverAim(fightNow) && !recentlyLeftAim() &&
            Date.now() - (state.lastAimExitAt || 0) > 400) {
            if (!handleLeftoverAimAdj('refresh-leftover-aim')) {
                leaveAimAndRearm('refresh-leftover-aim', state.movedThisAct ? { thenRest: true } : null);
            }
        }
        maybeResumePlayerTurn(fightNow);
        if (!enemyTurnQuiet(fightNow) && Number(fightNow && fightNow.phase) !== 3) {
            if (!(phase0LiveAdjReady(fightNow) && drivePhase0LiveAdjAim('refresh'))) {
                maybeCommitFirstActMelee('refresh');
            }
        }
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
            var loopOver = 0;
            var loopActive = 0;
            try { loopOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eLo) {}
            try { loopActive = Number(window.baye && baye.data && baye.data.g_hdFightActive) || 0; } catch (eLa) {}
            if (loopOver || !loopActive) {
                closeBattle({ silent: true, why: 'stale-loop' });
            }
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
            state.lordOpenDeferred = false;
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
        if (!already && !meta.preview) {
            maybePickOtherOnOpen();
        }
        console.log('[hd-battle] enter', meta.hook || (state.preview ? 'preview' : 'detect'));
        return true;
    }

    function closeBattle(opts) {
        opts = opts || {};
        var liveOver = 0;
        var hdActive = 0;
        try { liveOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eOv) {}
        try { hdActive = Number(window.baye && baye.data && baye.data.g_hdFightActive) || 0; } catch (eAc) {}
        if (!opts.force && !liveOver && hdActive) {
            console.warn('[hd-battle] skip-close-live', { why: opts.why || 'closeBattle' });
            return;
        }
        state.resultDismissed = true;
        try {
            if (liveOver && global.BayeHdCityMenu &&
                typeof BayeHdCityMenu.resetAfterFight === 'function') {
                BayeHdCityMenu.resetAfterFight();
            }
        } catch (e) {}
        state.open = false;
        state.preview = false;
        state.lordOpenDeferred = false;
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
            if (keepAimEnter('willCloseMenu') || keepAttackCommitEnter('willCloseMenu')) {
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
                var titleOver = 0;
                var titleActive = 0;
                try { titleOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eTo) {}
                try { titleActive = Number(window.baye && baye.data && baye.data.g_hdFightActive) || 0; } catch (eTa) {}
                if (state.open && !state.preview && !state.resultText &&
                    !state.occupyPending && !state.occupyStarted &&
                    (titleOver || !titleActive)) {
                    closeBattle({ silent: true, why: 'title-opening' });
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
            if (state.open && state.resultDismissed && !state.occupyPending &&
                (!f || !f.active || f.over) && liveOverPoll) {
                closeBattle({ silent: true, why: 'result-dismissed' });
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
            if (actingLordUnit() && !adjacentEnemy(1) && firstWaitingOwn({ skipLord: true })) {
                if (e) {
                    setPendingApproach(e.x, e.y);
                }
                state.pendingActPick = 0;
                return {
                    e: { name: e.name, x: e.x, y: e.y },
                    click: clickWaitingOwn() || { blocked: 'lord-hold-defer' }
                };
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
                holdEndTurnUntil: state.holdEndTurnUntil || 0,
                allowRetreatArmed: !!state.allowRetreatArmed,
                sawMoveThisTurn: !!state.sawMoveThisTurn,
                awaitingAim: awaitingAim(),
                lastHitAt: state.lastHitAt || state.fightHitAt || 0,
                fightHitAt: state.fightHitAt || 0,
                lastHitActor: state.lastHitActor,
                lastHpDropAt: state.lastHpDropAt || 0,
                lastHpDrop: state.lastHpDrop,
                sameTileHitN: state.sameTileHitN || 0,
                phase1AdjEnterHoldUntil: state.phase1AdjEnterHoldUntil || 0,
                lastOpenAimAt: state.lastOpenAimAt || 0,
                lastPhase0AimAt: state.lastPhase0AimAt || 0,
                phase0AimRetryN: state.phase0AimRetryN || 0,
                adjRecoverPickSent: !!state.adjRecoverPickSent,
                adjRecoverPickN: state.adjRecoverPickN || 0,
                adjRecoverStage: state.adjRecoverStage || '',
                adjRecoverGiveUpKey: state.adjRecoverGiveUpKey || '',
                turnHitActor: state.turnHitActor,
                aimCommit: state.aimCommit,
                lastPickEnterAt: state.lastPickEnterAt || 0,
                holdPickUntil: state.holdPickUntil || 0,
                hdMenuVisible: hdActMenuVisible(),
                lastMenuCommitEnterAt: state.lastMenuCommitEnterAt || 0,
                phase1EnterSent: !!state.phase1EnterSent,
                phase1EnterAt: state.phase1EnterAt || 0,
                phase1EnterCapKey: state.phase1EnterCapKey || '',
                phase1StuckUnitKey: state.phase1StuckUnitKey || '',
                endTurnStallN: state.endTurnStallN || 0,
                nextUnitArmedKey: state.nextUnitArmedKey || '',
                forceEndTurn: forceEndTurnArmed(),
                endTurnBrokeN: state.endTurnBrokeN || 0,
                stallMeleeTried: !!state.stallMeleeTried,
                approachedThisAct: !!state.approachedThisAct,
                phase1StuckCount: (function () {
                    var n = 0;
                    var k;
                    if (state.phase1StuckUnitKeys) {
                        for (k in state.phase1StuckUnitKeys) {
                            if (state.phase1StuckUnitKeys.hasOwnProperty(k)) {
                                n += 1;
                            }
                        }
                    }
                    return n;
                }()),
                enemyQuiet: enemyTurnQuiet(fightSnap),
                lord: (function () {
                    var lu = null;
                    var iL;
                    for (iL = 0; iL < state.units.length; iL++) {
                        if (isLordUnit(state.units[iL])) {
                            lu = state.units[iL];
                            break;
                        }
                    }
                    return lu ? { i: lu.i, name: lu.name, x: lu.x, y: lu.y, hp: lu.hp } : null;
                }()),
                lordHold: !!(actingLordUnit() && !adjacentEnemy(1)),
                lordHoldRestN: state.lordHoldRestN || 0,
                pendingPickUnit: state.pendingPickUnit || '',
                lastAdjMeleeAt: state.lastAdjMeleeAt || 0,
                strike: (function () {
                    var s = null;
                    try { s = adjacentWaitingStrike(); } catch (eS) {}
                    return s ? {
                        unit: s.unit && s.unit.name,
                        ux: s.unit && s.unit.x,
                        uy: s.unit && s.unit.y,
                        enemy: s.enemy && s.enemy.name,
                        ex: s.enemy && s.enemy.x,
                        ey: s.enemy && s.enemy.y
                    } : null;
                }()),
                lordOpenDeferred: !!state.lordOpenDeferred,
                lastSwallowWhy: state.lastSwallowWhy || '',
                adjacent: !!adjacentEnemy(1),
                actorAt: state.actorAt,
                boundActor: (function () {
                    try {
                        var ba = resolveNamedActor(state.actorAt);
                        return ba ? { name: ba.name, x: ba.x, y: ba.y, i: ba.i } : null;
                    } catch (eB) { return null; }
                }()),
                lastOpenAimReselectAt: state.lastOpenAimReselectAt || 0,
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
