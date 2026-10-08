/**
 * HD 城池四项菜单表现壳（M0–M3）。
 * 只发 sendKey；不改 WASM / dat.lib。规格：docs/hd-city-menu-spec.md
 */
(function (global) {
    var STORAGE_KEY = 'baye/cityMenuMode';
    var OVERWORLD_KEY = 'baye/overworldMode';
    var qtyEpoch = 0;
    var marchEpoch = 0;
    var queueEpoch = 0;
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
    var ROOTS = [
        { id: 'neizheng', name: '内政', hint: '开垦 / 招商 / 搜寻…' },
        { id: 'waijiao', name: '外交', hint: '离间 / 招揽 / 策反…' },
        { id: 'junbei', name: '军备', hint: '侦察 / 征兵 / 出征…' },
        { id: 'zhuangkuang', name: '状况', hint: '归属 / 民生发展 / 资源军备' }
    ];
    /* 项名来自 FEATURES.md 已核验的引擎菜单，只作标签。 */
    var SUBS = {
        neizheng: ['开垦', '招商', '搜寻', '治理', '出巡', '招降', '处斩', '流放', '赏赐', '没收', '交易', '宴请', '输送', '移动'],
        waijiao: ['离间', '招揽', '策反', '反间', '劝降'],
        junbei: ['侦察', '征兵', '分配', '掠夺', '出征']
    };
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
        activeQueueReason: '',
        qtyCommitQueued: false,
        qtyInputClosed: false,
        qtyAckFailed: false,
        qtyAckError: '',
        showLcd: false,
        closingSub: false,
        bound: false,
        listKind: '',
        probedCityKeys: [],
        cityDetails: null,
        deepKind: '',
        deepLabel: '',
        deepStep: 0,
        deepItems: [],
        deepSig: '',
        deepMenuOwner: null,
        personDetailSig: '',
        personDetail: null,
        toolDetailSig: '',
        toolDetail: null,
        toolPointerOwner: null,
        toolPagePending: null,
        toolPaneEpoch: 0,
        highlightScrollKey: '',
        deepPointerOwner: null,
        backPointerOwner: null,
        deepSelectionPending: null,
        walkToken: 0,
        pickedPersons: 0,
        dismissedObj: false,
        marchReady: false,
        campaignPick: false,
        battleMake: false,
        sawFightThisMarch: false,
        fightEndedThisMarch: false,
        personExitSent: false,
        finishPersonsBusy: false,
        personExitTries: 0,
        lastPersonExitAt: 0,
        lastPolicyLeaveAt: 0,
        qtyBeforePersonExit: null,
        foodRecovered: false,
        foodRecoverEnter: false,
        foodRecoverNeeded: false,
        foodGaveUp: false,
        foodAttempt: 0,
        lastTipEnterAt: 0,
        lastFuncMenuIdle: 0,
        lastExit: '',
        lastBlockedExit: '',
        lastBlockedEnter: '',
        lastPickEnterAt: 0,
        enginePersonsAtFinish: 0,
        enginePersonsAtPickStart: 0,
        engineHelpOpen: false,
        overlayRetry: 0,
        finishVisibleRetry: 0,
        pickedPersonNames: [],
        marchHint: '',
        lastWalkCity: null,
        lastWalkAt: 0,
        walkBusy: false,
        confirmingTarget: false,
        lastCitySetEnterAt: 0,
        landToken: 0,
        pendingTarget: null,
        confirmToken: 0,
        acceptMarchOk: false,
        handoff: false,
        handoffAt: 0,
        handoffToken: 0,
        handoffTimer: 0,
        handoffStatus: '',
        handoffExitCount: 0,
        handoffEnterCount: 0,
        handoffConfirmed: false,
        handoffHaveFresh: false,
        lastHandoffExitAt: 0,
        lastHandoffEnterAt: 0,
        handoffPreparedSeq: 0,
        consumedMarchSeq: 0,
        sawMarchCleared: false,
        wizardStep: 'none',
        sawQtyThisMarch: false,
        sawGetFoodUi: false,
        foodConfirmedThisMarch: false,
        reportAtMarchStart: '',
        qtyDismissed: false,
        qtyDismissedAt: 0,
        step4Trace: [],
        lastStep4: null,
        lastBannerLog: null,
        originRetryTried: false,
        originRetryBusy: false,
        originRetryFrom: null,
        originRetryTo: null,
        marchOriginIndex: null,
        keepPendingTarget: null,
        marchSession: 0,
        marchBaselineSeq: 0,
        marchContinueKey: '',
        marchTargetInputKey: '',
        marchSubmittedTarget: null,
        marchFoodCommitSent: false,
        marchCancelKey: '',
        marchStrategyOrder: null,
        nativeMenuRequest: null,
        nativeMenuCommit: '',
        qtyWaitKey: ''
    };

    // Blocking C states belong to one BattleMake session. Reports and menu
    // bytes are presentation data and cannot acknowledge a player command.
    var MARCH = { IDLE: 0, PERSONS: 1, FOOD: 2, TARGET_TIP: 3,
        TARGET_PICK: 4, REJECT: 5, ARMOUT: 6, DEPARTED: 7 };

    function marchProtocol() {
        var m = engineMarch();
        return m && m.phase != null && m.session != null ? m : null;
    }

    function currentMarch() {
        var m = marchProtocol();
        if (!m || !state.marchSession || Number(m.session) !== state.marchSession ||
            (Number(m.phase) !== MARCH.IDLE &&
                Number(m.origin) !== Number(state.marchOriginIndex))) {
            return null;
        }
        return m;
    }

    function bindMarchSession() {
        var m = marchProtocol();
        if (!state.marchSession && state.battleMake && m &&
            Number(m.phase) === MARCH.PERSONS &&
            Number(m.origin) === Number(state.cityIndex)) {
            state.marchSession = Number(m.session);
            state.marchOriginIndex = Number(m.origin);
        }
        return currentMarch();
    }

    function invalidateMarchWork() {
        marchEpoch += 1;
        queueEpoch += 1;
        state.walkToken += 1;
        state.confirmToken += 1;
        state.handoffToken += 1;
        state.queue = [];
        state.sending = false;
        state.handoff = false;
        clearHandoffTimer();
        state.finishPersonsBusy = false;
        state.rootMenuPending = false;
        state.walkBusy = false;
        state.confirmingTarget = false;
        state.nativeMenuRequest = null;
        state.deepMenuOwner = null;
        state.deepPointerOwner = null;
        state.deepSelectionPending = null;
        retireToolDetails();
    }

    function marchInputKey(m) {
        return String(m.session) + ':' + String(m.inputSeq);
    }

    function selectLiveMenu(target, thenEnter, reason, initial) {
        target = Number(target);
        var count = Number(initial && initial.count) || (initial && initial.names || []).length;
        if (!initial || !Number(initial.active) || !isFinite(target) || target < 0 ||
            Math.floor(target) !== target || target >= count) { return false; }
        var epoch = marchEpoch;
        var seq = Number(initial.seq);
        var context = Number(initial.context), kind = Number(initial.kind);
        var signature = (initial.names || []).join('\u0000');
        var identitySignature = menuIdentitySignature(initial);
        var key = [seq, context, kind, signature].join(':');
        var pending = state.nativeMenuRequest;
        if (pending && pending.key === key || thenEnter && state.nativeMenuCommit === key) { return false; }
        var request = { key: key };
        state.nativeMenuRequest = request;
        var expected = Number(initial.index);
        var waiting = false;
        var deadline = Date.now() + 5000;
        function finish() {
            if (state.nativeMenuRequest === request) { state.nativeMenuRequest = null; }
        }
        function step() {
            var menu = engineMenuItems();
            if (state.nativeMenuRequest !== request) { return; }
            if (epoch !== marchEpoch || !shouldShowHd() || !Number(menu.active) ||
                Number(menu.seq) !== seq || Number(menu.context) !== context || Number(menu.kind) !== kind ||
                (menu.names || []).join('\u0000') !== signature ||
                menuIdentitySignature(menu) !== identitySignature || Date.now() > deadline) { finish(); return; }
            var index = Number(menu.index);
            if (!isFinite(index) || index < 0 || index >= count) { finish(); return; }
            if (waiting && index !== expected) {
                setTimeout(step, 40);
                return;
            }
            if (waiting) { deadline = Date.now() + 5000; }
            waiting = false;
            if (index === target) {
                finish();
                if (thenEnter) {
                    state.nativeMenuCommit = key;
                    engineSendKey(VK.ENTER, reason);
                }
                return;
            }
            expected = index + (index > target ? -1 : 1);
            waiting = true;
            if (!engineSendKey(index > target ? VK.UP : VK.DOWN, reason)) { finish(); return; }
            setTimeout(step, 40);
        }
        step();
        return true;
    }

    function continueMarch(expected) {
        var m = currentMarch();
        if (!m || !shouldShowHd() ||
            [MARCH.TARGET_TIP, MARCH.REJECT, MARCH.ARMOUT].indexOf(Number(m.phase)) < 0) {
            return false;
        }
        if (expected && (Number(expected.session) !== Number(m.session) ||
            Number(expected.inputSeq) !== Number(m.inputSeq))) {
            return false;
        }
        var key = marchInputKey(m);
        if (state.marchContinueKey === key) {
            return false;
        }
        state.marchContinueKey = key;
        var owner = { session: Number(m.session), inputSeq: Number(m.inputSeq) };
        // ARMOUT precedes AddFightOrder. Its confirmation acknowledges the
        // report; only the later matching order acknowledges departure.
        engineSendKey(VK.ENTER, 'march-report-ok');
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true, marchOwner: owner });
        }
        scheduleMarchWatch();
        render();
        return true;
    }

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

    function cityLcdPresentation() {
        if (!state.open || !shouldShowHd()) { return 'passthrough'; }
        // The native report/help owner can temporarily take over a retained
        // city menu. Keep its LCD fallback, regardless of the city preference.
        try {
            var help = window.baye && baye.hd && typeof baye.hd.help === 'function' ? baye.hd.help() : null;
            var report = window.baye && baye.hd && typeof baye.hd.report === 'function' ? baye.hd.report() : null;
            if (help && Number(help.active) || report && Number(report.active)) { return 'passthrough'; }
            if (global.BayeHdDialog && typeof BayeHdDialog.debugSnapshot === 'function') {
                var dialog = BayeHdDialog.debugSnapshot();
                if (dialog && dialog.open && !dialog.pass && (dialog.kind === 'report' || dialog.kind === 'help')) {
                    return 'passthrough';
                }
            }
        } catch (e) { return 'passthrough'; }
        var fallback = state.layer === 'deep' && !showingQty() && !state.deepItems.length &&
            !mapPickActive() && !state.marchReady;
        if (state.layer === 'deep' && !showingQty() && usesGoodsMenu(state.deepKind, state.deepStep) &&
            !liveToolContext()) { fallback = true; }
        return state.showLcd || fallback ? 'on' : 'off';
    }

    function applyDocAttr() {
        var show = state.open && shouldShowHd();
        var lcdMode = cityLcdPresentation();
        document.documentElement.setAttribute('data-baye-city-menu', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-city-lcd', lcdMode);
        document.documentElement.setAttribute('data-baye-city-menu-pref', getMenuMode());
        document.documentElement.setAttribute('data-baye-city-menu-map-pick',
            (show && usesMapCursor(state.deepKind, state.deepStep)) ? '1' : '0');
        document.documentElement.setAttribute('data-baye-battle-make',
            holdExit() ? '1' : '0');
        document.documentElement.setAttribute('data-baye-march-ok',
            (state.marchReady || freshMarchOk() || state.handoff) ? '1' : '0');
        document.documentElement.setAttribute('data-baye-wizard-step',
            show ? (displayWizardStep() || 'none') : 'none');
        if (document.body) {
            var deepEmpty = show && state.layer === 'deep' && !showingQty() &&
                !state.deepItems.length && !mapPickActive() && !state.marchReady;
            document.body.classList.toggle('baye-hd-city-menu-on', show);
            document.body.classList.toggle('baye-hd-city-menu-lcd', show && lcdMode === 'on');
            document.body.classList.toggle('baye-hd-city-menu-deep-empty', deepEmpty);
            document.body.classList.toggle('baye-hd-city-menu-map-pick',
                show && usesMapCursor(state.deepKind, state.deepStep));
        }
        var lcdButton = document.querySelector ? document.querySelector('[data-hd-menu-lcd]') : null;
        if (lcdButton) {
            lcdButton.textContent = state.showLcd ? '隐藏经典 LCD' : '经典 LCD';
            lcdButton.setAttribute('aria-pressed', state.showLcd ? 'true' : 'false');
        }
    }

    function occupyDrainPending() {
        try {
            if (global.BayeHdBattle && typeof BayeHdBattle.occupyBusy === 'function') {
                return !!BayeHdBattle.occupyBusy();
            }
            if (global.BayeHdBattle && typeof BayeHdBattle.debugSnapshot === 'function') {
                var s = BayeHdBattle.debugSnapshot();
                return !!(s && (s.occupyPending || (s.resultCode && !s.occupyDone && !s.resultDismissed)));
            }
        } catch (e) {}
        return false;
    }

    function leftoverMarchAfterFight() {
        if (fightIsActive()) {
            state.sawFightThisMarch = true;
            return false;
        }
        var liveOverNow = 0;
        try { liveOverNow = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eOv) {}
        /* 没 g_FgtOver 就不能 after-fight：敌回合 flicker / leftover 城菜单会拆活战场。 */
        if (!liveOverNow) {
            return false;
        }
        try {
            if (global.BayeHdBattle && typeof BayeHdBattle.debugSnapshot === 'function') {
                var liveSnap = BayeHdBattle.debugSnapshot();
                if (liveSnap && liveSnap.open && !liveSnap.over) {
                    state.sawFightThisMarch = true;
                    return false;
                }
            }
        } catch (eLive) {}
        if (occupyDrainPending()) {
            return false;
        }
        if (state.sawFightThisMarch) {
            state.fightEndedThisMarch = true;
        }
        if (!state.fightEndedThisMarch && !state.sawFightThisMarch) {
            return false;
        }
        return !!(state.battleMake || state.handoff || state.marchReady || wizardInMarch() ||
            state.personExitSent || state.campaignPick || state.confirmingTarget ||
            (state.deepLabel === '出征' && state.layer === 'deep') ||
            stickyMarchBanner());
    }

    function stickyMarchBanner() {
        return /出征进行中/.test(state.marchHint || '');
    }

    function liveGetFoodNow() {
        return !!(liveGetFood() || (showingQty() && state.battleMake &&
            engineQty() && Number(engineQty().min) >= 1));
    }

    function liveGetCitySetNow() {
        return !!(engineInGetCitySet() ||
            (battlePickActive() && mapPickActive() && foodReadyForCitySet()));
    }

    function livePersonPickNow() {
        if (fightIsActive() || liveGetFoodNow() || liveGetCitySetNow()) {
            return false;
        }
        if (!state.battleMake || state.personExitSent || state.foodConfirmedThisMarch ||
            state.marchReady || freshMarchOk()) {
            return false;
        }
        /* HD 还停在出征选将层：g_hdMenuBytes 残留「侦察/开垦」不是真离开 BattleMake。 */
        if (state.layer === 'deep' && (state.deepLabel === '出征' || state.deepKind === 'person-city')) {
            return true;
        }
        if (engineLeftBattleMake()) {
            return false;
        }
        return state.wizardStep === 'persons';
    }

    function liveWaitGetFoodNow() {
        if (liveGetFoodNow()) {
            return true;
        }
        if (!state.battleMake || !state.personExitSent || state.foodConfirmedThisMarch ||
            state.foodGaveUp || state.marchReady || freshMarchOk()) {
            return false;
        }
        if (engineLeftBattleMake() || liveGetCitySetNow() || fightIsActive()) {
            return false;
        }
        var since = state.lastPersonExitAt ? (Date.now() - state.lastPersonExitAt) : 99999;
        return since < 8000;
    }

    function liveHandoffNow() {
        if (!state.handoff) {
            return false;
        }
        if (fightIsActive()) {
            return false;
        }
        return (Date.now() - (state.handoffAt || 0)) < 10000;
    }

    function liveMarchOrFight() {
        var m = currentMarch();
        return !!(fightIsActive() || occupyDrainPending() || state.handoff ||
            m && Number(m.phase) >= MARCH.PERSONS && Number(m.phase) <= MARCH.ARMOUT);
    }

    function consumedStrategyOrder(march) {
        var order = state.marchStrategyOrder;
        return !!(order && march && Number(march.session) === order.session &&
            marchSeqOf(march) === order.seq && Number(march.origin) === order.origin &&
            Number(march.obj) === order.target && Number(march.phase) === MARCH.DEPARTED &&
            !Number(march.ok));
    }

    function marchBannerFlags() {
        var m = engineMarch();
        var f = null;
        try { f = window.baye && baye.hd && baye.hd.fight ? baye.hd.fight() : null; } catch (e) {}
        return {
            hint: (state.marchHint || '').slice(0, 48),
            isMarching: isMarching(),
            battleMake: !!state.battleMake,
            marchOk: !!(state.marchReady || (m && m.ok) || freshMarchOk()),
            pick: !!(m && m.pick),
            fightActive: !!(f && f.active && !f.over),
            holdMenu: holdMenu(),
            wizard: state.wizardStep,
            live: liveMarchOrFight(),
            leftoverAfterFight: leftoverMarchAfterFight()
        };
    }

    function logMarchBanner(ev, extra) {
        var flags = marchBannerFlags();
        flags.ev = ev || '';
        flags.why = extra || '';
        state.lastBannerLog = flags;
        console.log('[hd-city-menu] banner', ev || '', flags);
        return flags;
    }

    function releaseMarchShell(why) {
        var hadBanner = stickyMarchBanner();
        state.battleMake = false;
        state.handoff = false;
        state.handoffStatus = '';
        state.marchReady = false;
        state.campaignPick = false;
        state.personExitSent = false;
        state.finishPersonsBusy = false;
        state.confirmingTarget = false;
        state.acceptMarchOk = false;
        state.wizardStep = 'none';
        state.marchHint = '';
        state.pendingTarget = null;
        stopMarchWatch();
        if (state.open && state.layer === 'deep' &&
            (state.deepLabel === '出征' || state.deepKind === 'person-city')) {
            state.layer = 'root';
            state.deepKind = '';
            state.deepLabel = '';
            state.deepItems = [];
        }
        console.log('[hd-city-menu] release march shell', why || '');
        if (hadBanner) {
            logMarchBanner('cleared', why || 'release');
        }
        applyDocAttr();
        render();
        return true;
    }

    /* 没有活出征/战场时摘掉「出征进行中」，不挡内政/军备/征兵。
     * 部队已出发（pick=0）只清横幅和 hold，保留策略结束钮。 */
    function sweepStickyMarch(why) {
        if (consumedStrategyOrder(currentMarch())) {
            resetAfterFight();
            return true;
        }
        if (liveMarchOrFight()) {
            return false;
        }
        if (leftoverMarchAfterFight()) {
            logMarchBanner('sweep-after-fight', why);
            releaseMarchShell(why || 'sweep-after-fight');
            var sweepOver = 0;
            try { sweepOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eSw) {}
            if (sweepOver && !occupyDrainPending()) {
                resetAfterFight();
            }
            return true;
        }
        var sticky = stickyMarchBanner();
        if (state.marchReady || freshMarchOk() || state.handoff) {
            if (sticky || state.battleMake || state.campaignPick || state.personExitSent) {
                state.battleMake = false;
                state.campaignPick = false;
                state.personExitSent = false;
                state.confirmingTarget = false;
                if (sticky) {
                    state.marchHint = '';
                }
                logMarchBanner('sweep-pick0', why);
                applyDocAttr();
                render();
                return true;
            }
            return false;
        }
        /* 还在出征深层面板（选将/选粮/选城）时不要当 leftover 整壳清掉。
         * 征兵后残留「侦察」会让 live 误判，sweep-stale 会拆掉刚点的出征。 */
        if (state.layer === 'deep' && (state.deepLabel === '出征' || state.deepKind === 'person-city') &&
            !state.fightEndedThisMarch) {
            return false;
        }
        if (sticky) {
            logMarchBanner('sweep-stale', why);
            releaseMarchShell(why || 'sweep-stale');
            return true;
        }
        return false;
    }

    function dismissMarchBanner() {
        logMarchBanner('dismiss-click');
        if (liveMarchOrFight() && !leftoverMarchAfterFight()) {
            state.marchHint = '';
            applyDocAttr();
            render();
            return { live: true, clearedHint: true };
        }
        sweepStickyMarch('dismiss-click');
        if (stickyMarchBanner()) {
            state.marchHint = '';
            applyDocAttr();
            render();
        }
        return { live: false, cleared: true };
    }

    function holdExit() {
        var m = currentMarch();
        return !!(m && Number(m.phase) >= MARCH.PERSONS && Number(m.phase) <= MARCH.ARMOUT);
    }

    function holdMenu() {
        return holdExit() || !!state.handoff;
    }

    function holdEnterForFood() {
        if (!liveWaitGetFoodNow() || leftoverMarchAfterFight()) {
            return false;
        }
        return !!(state.battleMake && state.personExitSent && !state.foodConfirmedThisMarch &&
            !state.marchReady && !state.handoff);
    }

    function allowEnterDuringFoodHold(reason) {
        return reason === 'qty-ok' || reason === 'march-report-ok' || reason === 'dismiss-live-disaster' ||
            reason === 'dismiss-leftover-help';
    }

    function engineSendKey(code, reason, currentOwner) {
        if (reason === 'pick-person') {
            var march = bindMarchSession();
            if (!march || Number(march.phase) !== MARCH.PERSONS || !shouldShowHd()) {
                return false;
            }
        }
        if ((reason === 'qty-step' || reason === 'qty-digit') && !liveQty()) {
            return false;
        }
        if (fightIsActive()) {
            state.lastBlockedExit = 'fight-' + (reason || 'key');
            console.warn('[hd-city-menu] blocked', code === VK.EXIT ? 'EXIT' : code, 'during fight', reason || '');
            return false;
        }
        if (code === VK.ENTER && holdEnterForFood() && !allowEnterDuringFoodHold(reason)) {
            state.lastBlockedEnter = reason || 'unknown';
            console.warn('[hd-city-menu] blocked ENTER until GetFood confirm', state.lastBlockedEnter);
            return false;
        }
        if (code === VK.EXIT && holdExit() && reason !== 'finish-persons' &&
            reason !== 'qty-cancel' && reason !== 'march-cancel') {
            state.lastBlockedExit = reason || 'unknown';
            console.warn('[hd-city-menu] blocked EXIT', state.lastBlockedExit);
            return false;
        }
        if (code === VK.EXIT) {
            state.lastExit = reason || 'unknown';
            console.log('[hd-city-menu] EXIT', state.lastExit);
        }
        if (code === VK.ENTER && reason === 'pick-person') {
            state.lastPickEnterAt = Date.now();
        }
        if (code === VK.ENTER || code === VK.EXIT || code === VK.HELP) {
            state.engineHelpOpen = false;
        }
        if (currentOwner && !currentOwner()) { return false; }
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

    function enqueueKeys(codes, gap, reason, currentOwner) {
        if (fightIsActive()) {
            console.warn('[hd-city-menu] blocked queue during fight', reason || '');
            return;
        }
        if ((codes && codes.length > 24) || state.queue.length > 80) {
            console.warn('[hd-city-menu] drop insane key burst', codes && codes.length, state.queue.length, reason || '');
            queueEpoch += 1;
            state.queue.length = 0;
            state.sending = false;
            invalidateQtyWork();
            return;
        }
        if (state.handoff && reason !== 'strategy-end' && reason !== 'strategy-end-enter') {
            return;
        }
        gap = gap || 55;
        var i;
        for (i = 0; i < codes.length; i++) {
            if (codes[i] === VK.ENTER && holdEnterForFood() && !allowEnterDuringFoodHold(reason)) {
                console.warn('[hd-city-menu] blocked queued ENTER until GetFood confirm', reason || 'queue');
                continue;
            }
            if (codes[i] === VK.EXIT && holdExit() && reason !== 'finish-persons') {
                state.lastBlockedExit = reason || 'queue';
                console.warn('[hd-city-menu] blocked queued EXIT', state.lastBlockedExit);
                continue;
            }
            if (codes[i] === VK.EXIT) {
                state.lastExit = reason || 'queue';
            }
            state.queue.push({ code: codes[i], wait: gap, reason: reason || '',
                currentOwner: currentOwner || null,
                marchEpoch: reason === 'pick-person' || reason === 'finish-persons' ? marchEpoch : null,
                menuSeq: reason === 'march-start' || reason === 'strategy-end' ? engineMenuItems().seq : null,
                qtyEpoch: /^qty-/.test(reason || '') ? qtyEpoch : null });
        }
        pumpQueue();
    }

    function pumpQueue() {
        if (state.sending) {
            return;
        }
        state.sending = true;
        var epoch = queueEpoch;
        function next() {
            if (epoch !== queueEpoch) { return; }
            if (!state.queue.length) {
                state.sending = false;
                state.activeQueueReason = '';
                state.qtyCommitQueued = false;
                return;
            }
            var item = state.queue.shift();
            if (item.marchEpoch != null && (item.marchEpoch !== marchEpoch || !shouldShowHd())) {
                setTimeout(next, 0);
                return;
            }
            if (item.qtyEpoch != null && (item.qtyEpoch !== qtyEpoch || !shouldShowHd())) {
                setTimeout(next, 0);
                return;
            }
            if (item.qtyStep != null) {
                // Read bounds/value when this click reaches the engine, so a
                // fast +10 then -10 uses the first click's updated quantity.
                var quantity = engineQty();
                function expandStep(q) {
                    var keys = liveQty() ? bayeQtyStepKeys(item.qtyStep, q) : [];
                    state.queue = keys.map(function (code) {
                        return { code: code, wait: 40, reason: 'qty-step', qtyEpoch: item.qtyEpoch };
                    }).concat(state.queue);
                    if (q && q.protocol) { next(); } else { setTimeout(next, 0); }
                }
                if (quantity && quantity.protocol) {
                    state.activeQueueReason = 'qty-step';
                    waitQuantity(null, quantity, item, function (q) { expandStep(q); });
                } else {
                    expandStep(quantity);
                }
                return;
            }
            state.activeQueueReason = item.reason || '';
            var nativeQuantity = item.qtyEpoch != null ? engineQty() : null;
            if (nativeQuantity && nativeQuantity.protocol) {
                waitQuantity(item.qtyCommit ? null : item.code, nativeQuantity, item, function () {
                    if (item.qtyCommit && state.qtyCommitQueued) {
                        state.qtyCommitQueued = false;
                        commitQty(true);
                    }
                    next();
                });
                return;
            }
            setTimeout(function () {
                if (epoch !== queueEpoch) { return; }
                if (item.qtyEpoch != null || item.qtyCommit) { syncQuantityWait(engineQty()); }
                if (item.menuSeq != null) {
                    var menu = engineMenuItems();
                    if (!Number(menu.active) || Number(menu.seq) !== Number(item.menuSeq)) {
                        setTimeout(next, item.wait || 55);
                        return;
                    }
                }
                if (item.marchEpoch != null && (item.marchEpoch !== marchEpoch || !shouldShowHd())) {
                    setTimeout(next, item.wait || 55);
                    return;
                }
                if (item.qtyEpoch != null && (item.qtyEpoch !== qtyEpoch || !shouldShowHd())) {
                    setTimeout(next, item.wait || 55);
                    return;
                }
                if (item.qtyCommit) {
                    if (state.qtyCommitQueued) {
                        state.qtyCommitQueued = false;
                        commitQty();
                    }
                } else {
                    engineSendKey(item.code, item.reason, item.currentOwner);
                }
                state.activeQueueReason = '';
                setTimeout(next, item.wait || 55);
            }, 0);
        }
        function waitQuantity(code, owner, item, after) {
            bayeQtyInputAck(code, owner, {
                read: engineQty,
                valid: function () {
                    syncQuantityWait(engineQty());
                    return epoch === queueEpoch && item.qtyEpoch === qtyEpoch &&
                        shouldShowHd() && !state.qtyInputClosed && !state.qtyAckFailed;
                },
                send: function (key) { engineSendKey(key, item.reason); }
            }, function (ok, reason, q) {
                if (epoch !== queueEpoch) { return; }
                syncQuantityWait(engineQty());
                if (item.qtyEpoch !== qtyEpoch) { next(); return; }
                state.activeQueueReason = '';
                if (!ok) {
                    invalidateQtyWork();
                    if (reason !== 'stale') {
                        state.qtyAckFailed = true;
                        state.qtyAckError = reason;
                        render();
                    }
                    next();
                    return;
                }
                after(q);
            });
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

    function pickIndex(target, thenEnter, reason) {
        var menu = engineMenuItems();
        if (menu.active != null) {
            if (!Number(menu.active) || Number(menu.context) !== 1 ||
                [1, 2, 3, 4].indexOf(Number(menu.kind)) < 0) { return false; }
            return selectLiveMenu(target, thenEnter, reason || '', menu);
        }
        var keys = keysToIndex(target);
        if (thenEnter) {
            keys.push(VK.ENTER);
        }
        enqueueKeys(keys, 55, reason || '');
        return true;
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

    function engineMapCityIndex() {
        var m = engineMarch();
        if (m && m.mapCity) {
            var id = Number(m.mapCity);
            if (id > 0 && id < 0xfffe) {
                return id - 1;
            }
        }
        return -1;
    }

    function cursorOnCity(cityIndex) {
        var to = cityEngineTile(cityIndex);
        var from = readEngineCursor();
        if (from && to && from.x === to.x && from.y === to.y) {
            return true;
        }
        return engineMapCityIndex() === cityIndex;
    }

    function deepIndexForCity(cityIndex) {
        var i;
        for (i = 0; i < state.deepItems.length; i++) {
            if (state.deepItems[i] && state.deepItems[i].cityIndex === cityIndex) {
                return i;
            }
        }
        return -1;
    }

    function markTargetSelected(cityIndex) {
        state.pendingTarget = cityIndex;
        var di = deepIndexForCity(cityIndex);
        if (di >= 0) {
            state.idleIndex = di;
        }
        state.deepSig = '';
        applyHighlight();
    }

    function noteStep4(ev, extra) {
        extra = extra || {};
        var m = engineMarch();
        var q = engineQty();
        var cur = readEngineCursor();
        var row = {
            t: Date.now(),
            ev: ev,
            city: extra.cityIndex,
            skip: extra.skipped || '',
            attempt: extra.attempt,
            wizard: state.wizardStep,
            pick: !!(m && m.pick),
            ok: !!(m && m.ok),
            seq: marchSeqOf(m),
            mapCity: engineMapCityIndex(),
            cursor: cur,
            qtyActive: !!(q && q.active),
            leftoverQty: leftoverQtyFlag(),
            liveQty: liveQty(),
            report: String(liveEngineReport() || '').slice(0, 28),
            dismissedObj: state.dismissedObj,
            personExit: state.personExitSent,
            walkBusy: state.walkBusy,
            pending: state.pendingTarget,
            token: state.confirmToken,
            phase: engineMarchPhase(),
            inCitySet: engineInGetCitySet(),
            liveFood: liveGetFood(),
            origin: state.cityIndex,
            originRetry: state.originRetryTo
        };
        state.step4Trace = (state.step4Trace || []).concat([row]).slice(-28);
        state.lastStep4 = row;
        if (ev === 'bind-map-city' &&
            (liveFightBlocksCityOpen() || extra.skipped === 'sync')) {
            return row;
        }
        console.log('[hd-city-menu] step4', ev, row);
        return row;
    }

    function chooseTargetOverlay() {
        /* GetCitySet 已打开时 leftover「选择目标」再回车 = 确认当前格（天水）。只关壳。 */
        if (mapPickActive()) {
            if (leftoverChooseTarget(liveEngineReport()) &&
                global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            return false;
        }
        if (!leftoverChooseTarget(liveEngineReport())) {
            return false;
        }
        try {
            if (global.BayeHdDialog && typeof BayeHdDialog.debugSnapshot === 'function') {
                var d = BayeHdDialog.debugSnapshot();
                var body = (d && (d.body || d.text || d.report || '')) || '';
                if (d && (d.open || d.visible || d.showing) && leftoverChooseTarget(body)) {
                    return true;
                }
            }
        } catch (e) {}
        /* leftover pick=0 + 未回车的「选择目标」仍是 ShowGReport，必须先 ENTER。
         * 完成选将后、GetFood 前的上月残留不能回车，否则会跳过选粮、永远进不了 GetCitySet。 */
        return !!(state.sawQtyThisMarch && !liveGetFood() && !state.dismissedObj);
    }

    function citySetNeedsOverlayEnter() {
        if (mapPickActive() || freshMarchOk() || state.marchReady || liveGetFood()) {
            return false;
        }
        if (!foodReadyForCitySet()) {
            return false;
        }
        var report = liveEngineReport() || '';
        return !!(battlePickActive() || leftoverChooseTarget(report) ||
            /无法到达|我方城池|无人占领/.test(report));
    }

    function reopenGetCitySet(why) {
        if (engineInGetCitySet() || freshMarchOk() || state.marchReady) {
            return { ok: true, phase: engineMarchPhase() };
        }
        if (!foodReadyForCitySet()) {
            return driveFoodToCitySet(why || 'reopen-need-food');
        }
        if (liveGetFood()) {
            return { deferred: 'wait-food-ui', phase: 'get-food' };
        }
        if (state.lastCitySetEnterAt && Date.now() - state.lastCitySetEnterAt < 480) {
            return { deferred: 'cityset-cooldown', phase: engineMarchPhase() };
        }
        if (citySetNeedsOverlayEnter()) {
            state.lastCitySetEnterAt = Date.now();
            state.dismissedObj = true;
            noteStep4('reopen-city-set', { skipped: why || 'overlay' });
            engineSendKey(VK.ENTER);
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            scheduleMarchWatch();
            return { deferred: 'reopen-city-set', phase: engineMarchPhase() };
        }
        return driveFoodToCitySet(why || 'reopen');
    }

    function isMarchNeighbor(cityIndex) {
        var links = cityLinkIndexes();
        var i;
        if (!links || !links.length) {
            return true;
        }
        for (i = 0; i < links.length; i++) {
            if (Number(links[i]) === Number(cityIndex)) {
                return true;
            }
        }
        return false;
    }

    function cityLinksOf(fromIndex) {
        var out = [];
        fromIndex = Number(fromIndex);
        if (!isFinite(fromIndex) || fromIndex < 0) {
            return out;
        }
        try {
            if (window.baye && baye.hd && typeof baye.hd.cityLinks === 'function') {
                var loaded = baye.hd.cityLinks(fromIndex) || [];
                var i;
                for (i = 0; i < loaded.length; i++) {
                    if (loaded[i] && loaded[i].index != null && isFinite(Number(loaded[i].index))) {
                        out.push(Number(loaded[i].index));
                    }
                }
            }
        } catch (e) {}
        return out;
    }

    function isOwnedCityIndex(cityIndex) {
        cityIndex = Number(cityIndex);
        if (!isFinite(cityIndex) || cityIndex < 0) {
            return false;
        }
        var mine = playerBelong();
        var data = engineData();
        if (!data || !data.g_Cities || !data.g_Cities[cityIndex]) {
            return false;
        }
        var belong = readNumber(data.g_Cities[cityIndex], 'Belong');
        return !!(mine && belong && belong === mine);
    }

    function ownedCityIndexes() {
        var out = [];
        var n = cityCount() || 38;
        var i;
        for (i = 0; i < n; i++) {
            if (isOwnedCityIndex(i)) {
                out.push(i);
            }
        }
        return out;
    }

    function originLinksTarget(originIndex, targetIndex) {
        var links = cityLinksOf(originIndex);
        var i;
        if (!links || !links.length) {
            return false;
        }
        for (i = 0; i < links.length; i++) {
            if (Number(links[i]) === Number(targetIndex)) {
                return true;
            }
        }
        return false;
    }

    function preferredMarchOrigin(targetIndex, exclude) {
        targetIndex = targetIndex == null ? 9 : Number(targetIndex);
        exclude = exclude == null ? -1 : Number(exclude);
        var current = state.cityIndex;
        if (current >= 0 && current !== targetIndex && current !== exclude &&
            isOwnedCityIndex(current) && originLinksTarget(current, targetIndex)) {
            return current;
        }
        var owned = ownedCityIndexes();
        var prefer = [3, 0, 8];
        var candidates = [];
        var i;
        for (i = 0; i < owned.length; i++) {
            var idx = owned[i];
            if (idx === targetIndex || idx === exclude) {
                continue;
            }
            if (originLinksTarget(idx, targetIndex)) {
                candidates.push(idx);
            }
        }
        for (i = 0; i < prefer.length; i++) {
            if (candidates.indexOf(prefer[i]) >= 0) {
                return prefer[i];
            }
        }
        if (candidates.length) {
            return candidates[0];
        }
        return null;
    }

    function clearLeftoverMarchDest() {
        return false;
    }

    function handleUnreachableOrigin(targetIndex, why) {
        // Selecting a different origin would replace the player's army and
        // food choices. Keep both selections until the player cancels.
        state.marchHint = why || '无法到达该城，请选择可到达的敌方邻城。';
        state.confirmingTarget = false;
        render();
        return false;
    }

    function restartMarchFromOrigin(originIndex, targetIndex) {
        state.confirmToken = (state.confirmToken || 0) + 1;
        state.confirmingTarget = false;
        state.walkBusy = false;
        state.acceptMarchOk = false;
        state.pendingTarget = targetIndex;
        if (/无法到达|我方城池|选择目标/.test(liveEngineReport() || '')) {
            engineSendKey(VK.ENTER, 'origin-retry-dismiss');
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        setTimeout(function () {
            if (engineInGetCitySet() || battlePickActive() || mapPickActive()) {
                engineSendKey(VK.EXIT, 'origin-retry-abort');
            }
            setTimeout(function () {
                state.battleMake = false;
                state.campaignPick = false;
                state.personExitSent = false;
                state.wizardStep = 'none';
                closeMenu({ silent: true, force: true });
                try {
                    if (global.BayeHdOverworld && typeof BayeHdOverworld.walkToCity === 'function') {
                        BayeHdOverworld.walkToCity(originIndex);
                    }
                } catch (eWalk) {}
                openMenu({
                    cityIndex: originIndex,
                    cityName: cityName(originIndex),
                    hook: 'origin-retry'
                });
                landOwnedCity('origin-retry', function () {
                    chooseRoot(2);
                    setTimeout(function () {
                        var names = preferEngineNames(SUBS.junbei || []);
                        var idx = names.indexOf('出征');
                        if (idx < 0) {
                            idx = 4;
                        }
                        state.keepPendingTarget = targetIndex;
                        chooseSub(idx);
                        state.pendingTarget = targetIndex;
                        state.originRetryBusy = false;
                        state.marchOriginIndex = originIndex;
                        state.marchHint = '已改从「' + (cityName(originIndex) || '邻城') +
                            '」出征，目标仍是「' + (cityName(targetIndex) || '目标城') +
                            '」。请再点将选粮。';
                        noteStep4('origin-retry-reopen', {
                            cityIndex: targetIndex,
                            skipped: 'origin-' + originIndex
                        });
                        render();
                    }, 380);
                });
            }, 280);
        }, 200);
    }

    function firstEnemyTarget() {
        var i;
        for (i = 0; i < state.deepItems.length; i++) {
            var it = state.deepItems[i];
            if (it && it.enemy && it.cityIndex != null) {
                return Number(it.cityIndex);
            }
        }
        return null;
    }

    function selectMarchTarget(cityIndex) {
        var m = bindMarchSession();
        cityIndex = Number(cityIndex);
        if (!m || Number(m.phase) !== MARCH.TARGET_PICK || !Number(m.pick) ||
            !Number(m.battlePick)) {
            state.marchHint = '请先完成选将和粮草确认，再选择目标城。';
            render();
            return { skipped: 'not-target-pick' };
        }
        if (!isFinite(cityIndex) || cityIndex < 0 || cityIndex >= cityCount() ||
            cityIndex === Number(m.origin) || !isMarchNeighbor(cityIndex) ||
            isOwnedCityIndex(cityIndex)) {
            state.marchHint = '请选择可到达的敌方邻城。';
            render();
            return { skipped: 'invalid-target', cityIndex: cityIndex };
        }
        if (state.confirmingTarget) {
            return { skipped: 'confirmation-pending', cityIndex: cityIndex };
        }
        state.walkToken += 1;
        state.walkBusy = false;
        markTargetSelected(cityIndex);
        state.marchHint = '已选择「' + cityName(cityIndex) + '」，点击「确认出征」后出发。';
        render();
        return { selected: cityIndex };
    }

    function confirmMarchTarget(cityIndex) {
        var m = bindMarchSession();
        cityIndex = Number(cityIndex == null ? state.pendingTarget : cityIndex);
        if (state.pendingTarget == null || cityIndex !== Number(state.pendingTarget)) {
            return selectMarchTarget(cityIndex);
        }
        if (!m || !shouldShowHd() || Number(m.phase) !== MARCH.TARGET_PICK ||
            !Number(m.pick) || !Number(m.battlePick)) {
            state.marchHint = '等待引擎打开目标选择。';
            render();
            return { skipped: 'not-target-pick' };
        }
        if (state.confirmingTarget || state.walkBusy ||
            state.marchTargetInputKey === marchInputKey(m)) {
            return { skipped: 'confirmation-pending' };
        }
        state.acceptMarchOk = true;
        state.confirmingTarget = true;
        state.marchSubmittedTarget = cityIndex;
        state.marchHint = '正在对准「' + cityName(cityIndex) + '」…';
        return walkMarchTarget(cityIndex, m);
    }

    function walkMarchTarget(cityIndex, initial) {
        var to = cityEngineTile(cityIndex);
        if (!to || !readEngineCursor()) {
            state.confirmingTarget = false;
            state.marchHint = '无法读取目标城位置，请重新选择。';
            render();
            return { skipped: 'missing-position' };
        }
        var epoch = marchEpoch;
        var token = ++state.walkToken;
        var inputKey = marchInputKey(initial);
        var polls = 0;
        var pendingKey = false;
        state.walkBusy = true;
        function valid() {
            var m = currentMarch();
            return epoch === marchEpoch && token === state.walkToken && shouldShowHd() &&
                m && Number(m.phase) === MARCH.TARGET_PICK && Number(m.pick) &&
                marchInputKey(m) === inputKey;
        }
        function stop(hint) {
            if (token !== state.walkToken) { return; }
            state.walkBusy = false;
            state.confirmingTarget = false;
            if (hint) { state.marchHint = hint; }
            render();
        }
        function poll() {
            if (!valid()) { stop(); return; }
            if (++polls > 160) {
                stop('引擎尚未对准目标城，请重新选择后确认。');
                return;
            }
            var pos = readEngineCursor();
            if (pos && pos.x === to.x && pos.y === to.y && engineMapCityIndex() === cityIndex) {
                state.walkBusy = false;
                state.marchTargetInputKey = inputKey;
                state.marchHint = '等待引擎确认出征目标…';
                engineSendKey(VK.ENTER, 'march-target-ok');
                scheduleMarchWatch();
                render();
                return;
            }
            if (!pendingKey && pos) {
                var key;
                if (pos.y !== to.y) { key = pos.y > to.y ? VK.UP : VK.DOWN; }
                else if (pos.x !== to.x) { key = pos.x > to.x ? VK.LEFT : VK.RIGHT; }
                else { key = to.x > 0 ? VK.LEFT : VK.RIGHT; }
                var before = { x: pos.x, y: pos.y };
                pendingKey = true;
                engineSendKey(key, 'march-target-walk');
                function waitMoved(n) {
                    if (!valid()) { stop(); return; }
                    var now = readEngineCursor();
                    if (now && (now.x !== before.x || now.y !== before.y)) {
                        pendingKey = false;
                        setTimeout(poll, 30);
                    } else if (n < 80) {
                        setTimeout(function () { waitMoved(n + 1); }, 40);
                    } else {
                        stop('引擎未响应地图移动，请重新确认目标。');
                    }
                }
                setTimeout(function () { waitMoved(0); }, 40);
                return;
            }
            setTimeout(poll, 40);
        }
        poll();
        return { confirming: cityIndex };
    }

    function walkCursorToCity(cityIndex, thenEnter, opts) {
        if (state.deepKind === 'person-city' || currentMarch()) {
            return thenEnter === false ? selectMarchTarget(cityIndex) : confirmMarchTarget(cityIndex);
        }
        opts = opts || {};
        var force = !!opts.force;
        var requireLanded = !!opts.requireLanded || force;
        if (state.marchReady) {
            return { skipped: 'already-ok' };
        }
        if (leftoverQtyFlag() && !liveGetFood()) {
            clearLeftoverQtyFlag();
        }
        if (liveQty()) {
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
        if (force && chooseTargetOverlay()) {
            return confirmMarchTarget(cityIndex, opts);
        }
        if (leftoverOverworldPick() && state.wizardStep === 'persons') {
            state.marchHint = '还在选将/选粮。过图 leftover pick 不是出征目标。';
            noteStep4('skip-overworld-pick', { cityIndex: cityIndex, skipped: 'overworld-pick' });
            render();
            return { skipped: 'overworld-pick', cityIndex: cityIndex };
        }
        if (!mapPickActive()) {
            if (force && state.wizardStep !== 'persons') {
                noteStep4('walk-handoff-confirm', { cityIndex: cityIndex, skipped: 'not-map-pick' });
                return confirmMarchTarget(cityIndex, {
                    resume: true,
                    attempt: (opts.attempt || 0) + 1
                });
            }
            state.marchHint = state.personExitSent
                ? '等「选择目标」出现后再点邻城。现在点城不会出发。'
                : '先点至少一名将领，再点「完成选将 · 选粮出发」，不要直接点目标城。';
            noteStep4('skip-not-map-pick', { cityIndex: cityIndex, skipped: 'not-map-pick' });
            render();
            return { skipped: 'not-map-pick', cityIndex: cityIndex, hint: state.marchHint };
        }
        if (!force && state.walkBusy && state.lastWalkCity === cityIndex) {
            return { skipped: 'walk-in-flight', cityIndex: cityIndex };
        }
        if (!force && state.lastWalkCity === cityIndex && (Date.now() - (state.lastWalkAt || 0)) < 900) {
            return { skipped: 'walk-debounce', cityIndex: cityIndex };
        }
        if (force) {
            state.walkToken = (state.walkToken || 0) + 1;
            state.walkBusy = false;
        }
        state.lastWalkCity = cityIndex;
        state.lastWalkAt = Date.now();
        state.walkBusy = true;
        state.marchHint = '';
        var to = cityEngineTile(cityIndex);
        var from = readEngineCursor();
        var dirs = [];
        if (from && to && to.x != null && to.y != null &&
            from.x >= 0 && from.y >= 0 && to.x >= 0 && to.y >= 0 &&
            from.x <= 40 && from.y <= 40 && to.x <= 40 && to.y <= 40) {
            var x = from.x;
            var y = from.y;
            while (y > to.y && dirs.length < 16) { dirs.push(VK.UP); y -= 1; }
            while (y < to.y && dirs.length < 16) { dirs.push(VK.DOWN); y += 1; }
            while (x > to.x && dirs.length < 16) { dirs.push(VK.LEFT); x -= 1; }
            while (x < to.x && dirs.length < 16) { dirs.push(VK.RIGHT); x += 1; }
        }
        var snapOk = false;
        if (to && to.x != null && to.y != null &&
            global.BayeHdOverworld && typeof BayeHdOverworld.writeCityPos === 'function') {
            var snapTried = [];
            snapOk = BayeHdOverworld.writeCityPos(to.x, to.y, snapTried);
            console.log('[hd-city-menu] dest-setxy ' + JSON.stringify({
                cityIndex: cityIndex,
                to: to,
                from: from,
                keys: dirs.length,
                snapOk: snapOk,
                tried: snapTried,
                now: readEngineCursor(),
                mapCity: engineMapCityIndex(),
                inCitySet: engineInGetCitySet()
            }));
        }
        /* dest-setxy 只改 setx/sety，GetCitySetInner 的 city 仍是上次 ShowCityMap。
         * HD bind 的 g_hdMapCity 对上目标也不能跳过：ENTER 会确认旧格（无法到达/空操作）。 */
        if (thenEnter !== false && (force || opts.confirm || requireLanded ||
            (to && (snapOk || cursorOnCity(cityIndex))))) {
            dirs = (to && to.x > 0) ? [VK.LEFT, VK.RIGHT] : [VK.RIGHT, VK.LEFT];
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
            var onTarget = landed() || cursorOnCity(cityIndex);
            if (requireLanded && !onTarget) {
                state.marchHint = '光标未落到目标城，正在再走一格确认。';
                noteStep4('walk-miss', { cityIndex: cityIndex, attempt: opts.attempt });
                render();
                if (!opts.retriedWalk) {
                    setTimeout(function () {
                        if (token !== state.walkToken) {
                            return;
                        }
                        opts.retriedWalk = true;
                        walkCursorToCity(cityIndex, thenEnter, opts);
                    }, 200);
                } else if (opts.confirm) {
                    state.marchHint = '光标未落到目标城。再点邻城或「确认出征」才会出发，高亮不够。';
                    noteStep4('walk-miss-final', { cityIndex: cityIndex, skipped: 'cursor-miss' });
                    render();
                    confirmMarchTarget(cityIndex, {
                        resume: true,
                        attempt: (opts.attempt || 0) + 1
                    });
                } else {
                    state.marchHint = '光标未落到目标城。再点邻城或「确认出征」才会出发，高亮不够。';
                    render();
                }
                return;
            }
            function waitShown(n) {
                if (token !== state.walkToken) {
                    return;
                }
                var shown = engineMapCityIndex();
                var onTarget = landed() || cursorOnCity(cityIndex);
                if (chooseTargetOverlay()) {
                    noteStep4('wait-dismiss-tip', { cityIndex: cityIndex, attempt: opts.attempt });
                    engineSendKey(VK.ENTER);
                    if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                        BayeHdDialog.close({ silent: true });
                    }
                    setTimeout(function () {
                        waitShown(n + 1);
                    }, 200);
                    return;
                }
                if (shown === cityIndex) {
                    sendEnter();
                    return;
                }
                /* 格已在目标、mapCity 仍是出发城/错城：等 ShowCityMap 刷新。
                 * mapCity 对不上就 ENTER 会确认庐江/天水并离开 GetCitySet。 */
                if (onTarget && shown !== cityIndex && n >= 8 && n < 20 && (n % 4) === 0) {
                    var nudgeTo = cityEngineTile(cityIndex);
                    if (nudgeTo && nudgeTo.x > 0) {
                        engineSendKey(VK.LEFT);
                        engineSendKey(VK.RIGHT);
                    } else {
                        engineSendKey(VK.RIGHT);
                        engineSendKey(VK.LEFT);
                    }
                }
                if (onTarget && n >= 22 && shown === cityIndex) {
                    sendEnter();
                    return;
                }
                if (shown >= 0 && shown !== cityIndex && !onTarget && n >= 8) {
                    noteStep4('mapcity-mismatch', {
                        cityIndex: cityIndex,
                        skipped: 'mapcity-' + shown,
                        attempt: opts.attempt
                    });
                    state.marchHint = '地图仍停在出发城，未向引擎确认。正在再走「' +
                        (cityName(cityIndex) || '目标城') + '」。';
                    render();
                    if (opts.confirm) {
                        confirmMarchTarget(cityIndex, {
                            resume: true,
                            attempt: (opts.attempt || 0) + 1
                        });
                    }
                    return;
                }
                if (n >= 24) {
                    if (requireLanded && !onTarget) {
                        state.marchHint = '光标未落到目标城，未向引擎确认。再点一次。';
                        noteStep4('enter-blocked-cursor', { cityIndex: cityIndex });
                        render();
                        return;
                    }
                    if (shown !== cityIndex) {
                        noteStep4('enter-blocked-mapcity', {
                            cityIndex: cityIndex, skipped: 'mapcity-' + shown
                        });
                        if (opts.confirm) {
                            confirmMarchTarget(cityIndex, {
                                resume: true,
                                attempt: (opts.attempt || 0) + 1
                            });
                        }
                        return;
                    }
                    sendEnter();
                    return;
                }
                setTimeout(function () {
                    waitShown(n + 1);
                }, 40);
            }
            function sendEnter() {
                if (token !== state.walkToken) {
                    return;
                }
                var shownNow = engineMapCityIndex();
                if (shownNow !== cityIndex) {
                    noteStep4('refuse-enter-mapcity', {
                        cityIndex: cityIndex,
                        skipped: 'mapcity-' + shownNow,
                        attempt: opts.attempt
                    });
                    state.confirmingTarget = false;
                    state.marchHint = '引擎光标未对准「' +
                        (cityName(cityIndex) || '目标城') + '」，未回车。正在再走格。';
                    render();
                    if (opts.confirm) {
                        confirmMarchTarget(cityIndex, {
                            resume: true,
                            attempt: (opts.attempt || 0) + 1
                        });
                    }
                    return;
                }
                noteStep4('enter-target', { cityIndex: cityIndex, attempt: opts.attempt });
                state.confirmingTarget = true;
                engineSendKey(VK.ENTER);
                scheduleMarchWatch();
                setTimeout(function () {
                    if (token !== state.walkToken) {
                        return;
                    }
                    if (freshMarchOk() || state.marchReady || realMarchDest(engineMarch())) {
                        state.confirmingTarget = false;
                        noteStep4('enter-ok', { cityIndex: cityIndex });
                        return;
                    }
                    var report = liveEngineReport();
                    if (/我方城池|无法到达/.test(report)) {
                        state.confirmingTarget = false;
                        noteStep4('enter-refuse', { cityIndex: cityIndex, skipped: report });
                        if (/无法到达/.test(report) &&
                            handleUnreachableOrigin(cityIndex, report)) {
                            return;
                        }
                        engineSendKey(VK.ENTER);
                        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                            BayeHdDialog.close({ silent: true });
                        }
                        state.marchHint = /无法到达/.test(report)
                            ? '引擎拒绝：无法到达。只能打 CITY_LINKR 邻城。'
                            : '引擎提示「我方城池」。已关掉，改走敌邻。';
                        render();
                        if (opts.confirm) {
                            confirmMarchTarget(cityIndex, {
                                resume: true,
                                attempt: (opts.attempt || 0) + 1
                            });
                        }
                        scheduleMarchWatch();
                        return;
                    }
                    if (waitingArmout() || leftoverMarchReport(report)) {
                        noteStep4('enter-armout', { cityIndex: cityIndex });
                        dismissLiveArmout();
                        scheduleMarchWatch();
                        if (opts.confirm) {
                            confirmMarchTarget(cityIndex, {
                                resume: true,
                                attempt: (opts.attempt || 0) + 1
                            });
                        }
                        return;
                    }
                    if (citySetNeedsOverlayEnter()) {
                        noteStep4('enter-overlay', { cityIndex: cityIndex });
                        reopenGetCitySet('after-enter');
                        if (opts.confirm) {
                            confirmMarchTarget(cityIndex, {
                                resume: true,
                                attempt: (opts.attempt || 0) + 1
                            });
                        }
                        return;
                    }
                    if (state.confirmingTarget && !freshMarchOk() && !state.marchReady) {
                        noteStep4('enter-wait-dest', { cityIndex: cityIndex });
                        if (opts.confirm) {
                            confirmMarchTarget(cityIndex, {
                                resume: true,
                                attempt: (opts.attempt || 0) + 1
                            });
                        }
                        return;
                    }
                    if (opts.confirm && !freshMarchOk() && !state.marchReady) {
                        noteStep4('enter-noop', { cityIndex: cityIndex, skipped: 'enter-noop' });
                        confirmMarchTarget(cityIndex, {
                            resume: true,
                            attempt: (opts.attempt || 0) + 1
                        });
                    }
                }, 900);
            }
            setTimeout(function () {
                waitShown(0);
            }, onTarget ? 90 : 220);
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
        return { pick: 0, battlePick: 0, ok: 0, mapCity: 0, seq: 0 };
    }

    function battlePickActive() {
        var m = engineMarch();
        if (m && Number(m.battlePick)) {
            return true;
        }
        try {
            if (window.baye && baye.data && Number(baye.data.g_hdBattlePick)) {
                return true;
            }
        } catch (e) {}
        return false;
    }

    function marchSeqOf(m) {
        return (m && m.seq) ? Number(m.seq) : 0;
    }

    function leftoverMarchReport(text) {
        return /部队已出发/.test(String(text || ''));
    }

    function leftoverEnemyCityReport(text) {
        return /敌方城池|我方城池|无法到达|无人占领/.test(String(text || ''));
    }

    function dismissLiveArmout() {
        // Departure reports require the player's explicit acknowledgement.
        return false;
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
        var m = currentMarch();
        return !!(m && Number(m.phase) === MARCH.TARGET_TIP);
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
    function realMarchDest(m) {
        m = m || currentMarch();
        if (!m || !state.marchSession || Number(m.session) !== state.marchSession ||
            Number(m.phase) !== MARCH.DEPARTED || !Number(m.ok) ||
            Number(m.origin) !== Number(state.marchOriginIndex) ||
            Number(m.city) !== Number(state.marchOriginIndex) ||
            state.marchSubmittedTarget == null ||
            Number(m.obj) !== Number(state.marchSubmittedTarget)) {
            return false;
        }
        var seq = marchSeqOf(m);
        return !!(seq && seq !== state.marchBaselineSeq &&
            Number(m.obj) !== Number(m.city));
    }

    function freshMarchOk() {
        return !!(state.acceptMarchOk && realMarchDest(currentMarch()));
    }

    function consumeLeftoverMarch() {
        // These are engine-owned acknowledgement fields. Never write them to
        // manufacture a transition or clear another in-flight command.
        var seq = marchSeqOf(engineMarch());
        state.consumedMarchSeq = seq;
        state.marchBaselineSeq = seq;
        state.marchReady = false;
        state.acceptMarchOk = false;
        state.sawMarchCleared = false;
        state.confirmingTarget = false;
        if (global.BayeHdDialog && typeof BayeHdDialog.clearLeftoverMarch === 'function') {
            BayeHdDialog.clearLeftoverMarch();
        }
    }

    function forceClearMapPick(why) {
        if (marchProtocol()) { return false; }
        if (battlePickActive()) {
            noteStep4('force-clear-pick', { skipped: 'live-battle-pick' });
            return false;
        }
        if (liveOverworldGetCitySet() && why !== 'consume-march' && why !== 'after-fight-stale') {
            noteStep4('force-clear-pick', { skipped: 'live-overworld-pick' });
            return false;
        }
        try {
            if (window.baye && baye.data && baye.data.g_hdMapPick != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdMapPick = 0;
            }
        } catch (e) {}
        noteStep4('force-clear-pick', { skipped: why || 'force' });
        return !mapPickActive();
    }

    function resetAfterFight() {
        invalidateMarchWork();
        state.marchStrategyOrder = null;
        state.marchSession = 0;
        consumeLeftoverMarch();
        state.battleMake = false;
        state.campaignPick = false;
        state.personExitSent = false;
        state.finishPersonsBusy = false;
        state.personExitTries = 0;
        state.lastPickEnterAt = 0;
        state.enginePersonsAtFinish = 0;
        state.enginePersonsAtPickStart = 0;
        state.engineHelpOpen = false;
        state.overlayRetry = 0;
        state.finishVisibleRetry = 0;
        state.pickedPersonNames = [];
        state.foodGaveUp = false;
        state.foodAttempt = 0;
        state.foodRecovered = false;
        state.foodRecoverEnter = false;
        state.foodRecoverNeeded = false;
        state.sawQtyThisMarch = false;
        state.sawGetFoodUi = false;
        state.foodConfirmedThisMarch = false;
        invalidateQtyWork();
        state.qtyInputClosed = false;
        state.qtyDismissed = false;
        state.qtyDismissedAt = 0;
        state.wizardStep = 'none';
        state.marchReady = false;
        state.handoff = false;
        state.handoffStatus = '';
        state.confirmingTarget = false;
        state.acceptMarchOk = false;
        state.originRetryTried = false;
        state.originRetryBusy = false;
        state.originRetryFrom = null;
        state.originRetryTo = null;
        state.marchOriginIndex = null;
        state.keepPendingTarget = null;
        state.sawFightThisMarch = false;
        state.fightEndedThisMarch = false;
        state.marchHint = '';
        stopMarchWatch();
        releaseMarchShell('reset-after-fight');
        // Result/occupation/succession reports remain owned by the engine
        // and their player controls. A shell reset never advances them.
    }

    /* 同页 新君登基 / 读档：HD 出征旗标不能带到下一局，否则完成选将空操作、GetFood 永不来。 */
    function resetForNewGame(why) {
        invalidateMarchWork();
        state.marchStrategyOrder = null;
        state.marchSession = 0;
        why = why || 'new-game';
        noteStep4('reset-new-game', { skipped: why });
        stopMarchWatch();
        state.queue = [];
        state.sending = false;
        state.qtyCommitQueued = false;
        state.activeQueueReason = '';
        state.battleMake = false;
        state.sawFightThisMarch = false;
        state.fightEndedThisMarch = false;
        state.campaignPick = false;
        state.personExitSent = false;
        state.finishPersonsBusy = false;
        state.personExitTries = 0;
        state.lastPersonExitAt = 0;
        state.lastPolicyLeaveAt = 0;
        state.lastPickEnterAt = 0;
        state.enginePersonsAtFinish = 0;
        state.enginePersonsAtPickStart = 0;
        state.engineHelpOpen = false;
        state.overlayRetry = 0;
        state.finishVisibleRetry = 0;
        state.pickedPersonNames = [];
        state.pickedPersons = 0;
        state.foodGaveUp = false;
        state.foodAttempt = 0;
        state.foodRecovered = false;
        state.foodRecoverEnter = false;
        state.foodRecoverNeeded = false;
        state.sawQtyThisMarch = false;
        state.sawGetFoodUi = false;
        state.foodConfirmedThisMarch = false;
        invalidateQtyWork();
        state.qtyInputClosed = false;
        state.qtyDismissed = false;
        state.qtyDismissedAt = 0;
        state.qtyBeforePersonExit = null;
        state.wizardStep = 'none';
        state.marchReady = false;
        state.handoff = false;
        state.handoffStatus = '';
        state.confirmingTarget = false;
        state.acceptMarchOk = false;
        state.pendingTarget = null;
        state.originRetryTried = false;
        state.originRetryBusy = false;
        state.originRetryFrom = null;
        state.originRetryTo = null;
        state.marchOriginIndex = null;
        state.keepPendingTarget = null;
        state.marchHint = '';
        state.lastBlockedEnter = '';
        state.lastBlockedExit = '';
        state.lastExit = '';
        state.deepKind = '';
        state.deepLabel = '';
        state.deepStep = 0;
        state.deepSig = '';
        // New-game/load hooks retire the presentation and queued work only.
        // C owns the new world's input flags and may already be waiting for
        // its first quantity, report or map selection when this hook arrives.
        consumeLeftoverMarch();
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        if (state.open) {
            closeMenu({ silent: true, force: true });
        }
        console.log('[hd-city-menu] resetForNewGame', why);
    }

    function mapPickActive() {
        var m = engineMarch();
        return !!(m && m.pick);
    }

    function leftoverOverworldPick() {
        /* PlayerTactic 过图与 BattleMake GetCitySet 共用 g_hdMapPick。
         * 只有 C 立了 g_hdBattlePick 才是出征选城。过图 leftover pick=1 必须清。
         * BattleMake 已结束选将后引擎不在 PlayerTactic：pick=1 只是残留旗，
         * 再当成 leftover GetCitySet 会挡住 选择目标 / battlePick=1。
         * 选将中 leftover pick 仍当过图旗（避免被当成活 GetCitySet），但完成选将不得 landOwnedCity。 */
        try {
            if (Number(window.baye && baye.data && baye.data.g_FgtOver)) {
                return false;
            }
        } catch (eFgt) {}
        if (freshMarchOk() || state.marchReady || state.confirmingTarget) {
            return false;
        }
        if (state.battleMake && (state.personExitSent || state.foodConfirmedThisMarch || liveGetFood())) {
            return false;
        }
        if (state.acceptMarchOk && realMarchDest(engineMarch())) {
            return false;
        }
        return !!(mapPickActive() && !battlePickActive());
    }

    function clearLeftoverPickAfterMarch(why) {
        if (marchProtocol()) { return false; }
        try {
            if (window.baye && baye.data) {
                if (baye.data.g_hdMapPick != null) {
                    baye.data.g_hdMapPick = 0;
                }
                if (baye.data.g_hdBattlePick != null) {
                    baye.data.g_hdBattlePick = 0;
                }
            }
        } catch (eClr) {}
        noteStep4('clear-leftover-pick-after-march', { skipped: why || '' });
    }

    /* HD 已回城池根，引擎还停在内政/军备/人物表（开垦过月最常见）。 */
    function leftoverEngineSubAtHdRoot() {
        if (state.layer !== 'root') {
            return '';
        }
        var names = engineMenuItems().names || [];
        var n0 = names[0] || '';
        if (!n0 || n0 === '内政' || n0 === '军备' || n0 === '外交' || n0 === '状况') {
            return '';
        }
        if (n0 === '策略结束' || n0 === '确定退出' || n0 === '结束游戏' || n0 === '存储进度') {
            return '';
        }
        if (SUBS.neizheng.indexOf(n0) >= 0) {
            return 'neizheng';
        }
        if (SUBS.junbei.indexOf(n0) >= 0) {
            return 'junbei';
        }
        if (SUBS.waijiao.indexOf(n0) >= 0) {
            return 'waijiao';
        }
        return 'person';
    }

    /* 招商/开垦人物表残留：引擎还在 PlcPerson，HD 已回根/子层。出征前必须 EXIT，
     * 否则 finish-persons 的 EXIT 会点掉 leftover 商业开发度并跳进策略结束。 */
    function engineInPolicyPerson() {
        if (state.battleMake || state.personExitSent || state.finishPersonsBusy ||
            state.wizardStep === 'persons' || state.wizardStep === 'food' ||
            state.wizardStep === 'wait-get-food' || state.wizardStep === 'map-pick' ||
            state.deepKind === 'person-city' || state.deepLabel === '出征') {
            return false;
        }
        if (liveGetFoodNow() || showingQty() || mapPickActive() || fightIsActive()) {
            return false;
        }
        var names = engineMenuItems().names || [];
        var n0 = names[0] || '';
        if (!n0) {
            return false;
        }
        if (n0 === '内政' || n0 === '军备' || n0 === '外交' || n0 === '状况' ||
            n0 === '侦察' || n0 === '征兵' || n0 === '出征' || n0 === '开垦' ||
            n0 === '招商' || n0 === '策略结束' || n0 === '确定退出' ||
            n0 === '结束游戏' || n0 === '存储进度' || n0 === '全军撤退' ||
            n0 === '回合结束') {
            return false;
        }
        if (SUBS.neizheng.indexOf(n0) >= 0 || SUBS.junbei.indexOf(n0) >= 0 ||
            SUBS.waijiao.indexOf(n0) >= 0) {
            return false;
        }
        return true;
    }

    function leftoverPolicyPerson() {
        if (!engineInPolicyPerson()) {
            return false;
        }
        if (state.layer === 'deep' && state.deepKind === 'person') {
            /* 正在看招商/开垦人物表，不是残留。 */
            return false;
        }
        return true;
    }

    function leaveLeftoverPolicyPerson(why, force) {
        if (state.battleMake || state.deepKind === 'person-city' ||
            state.deepLabel === '出征') {
            return false;
        }
        if (!(force ? engineInPolicyPerson() : leftoverPolicyPerson())) {
            return false;
        }
        if (state.lastPolicyLeaveAt && (Date.now() - state.lastPolicyLeaveAt) < 420) {
            return true;
        }
        state.lastPolicyLeaveAt = Date.now();
        clearLeftoverCityReports(why || 'leave-policy-person');
        enqueueKeys([VK.EXIT], 80, 'leave-policy-person');
        if (state.layer === 'deep' && state.deepLabel !== '出征' &&
            state.deepKind !== 'person-city') {
            state.layer = 'sub';
            state.deepKind = '';
            state.deepLabel = '';
        }
        console.log('[hd-city-menu] leave leftover policy person', why || '', !!force);
        return true;
    }

    /* PlayerTactic 正在 GetCitySet：写 pick=0 是撒谎，下一发 ENTER 会点进空城（无人占领）。
     * pick=1 且 !battlePick 就是过图 GetCitySet。残留菜单字节「侦察/开垦」不能当成已在军备，
     * 否则 DOWN×4 会把光标从天水(3,2)走到巴郡(3,6)。 */
    function liveOverworldGetCitySet() {
        return leftoverOverworldPick();
    }

    function bindOpenedMapCity(cityIndex, why) {
        if (marchProtocol()) { return false; }
        cityIndex = cityIndex != null && cityIndex >= 0 ? Number(cityIndex) : state.cityIndex;
        if (liveFightBlocksCityOpen()) {
            return false;
        }
        if (engineInGetCitySet() && Number(cityIndex) !== Number(state.pendingTarget)) {
            noteStep4('bind-map-city', { cityIndex: cityIndex, skipped: 'live-city-set' });
            return false;
        }
        if (!isFinite(cityIndex) || cityIndex < 0 || cityIndex >= 64) {
            return false;
        }
        try {
            if (window.baye && baye.data && baye.data.g_hdMapCity != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdMapCity = cityIndex + 1;
            }
        } catch (e) {}
        try {
            if (typeof bayeHdLoadCityLinks === 'function') {
                bayeHdLoadCityLinks(cityIndex);
            }
        } catch (e) {}
        noteStep4('bind-map-city', { cityIndex: cityIndex, skipped: why || 'bind' });
        return engineMapCityIndex() === cityIndex;
    }

    /* 过图 leftover pick 时先走回 HD 打开的城再 ENTER，绝不能对着 GetCitySet 发军备方向键。 */
    function landOwnedCity(why, done) {
        var cityIndex = state.cityIndex;
        done = typeof done === 'function' ? done : function () {};
        bindOpenedMapCity(cityIndex, why);
        if (!isFinite(cityIndex) || cityIndex < 0) {
            done(false);
            return false;
        }
        if (battlePickActive()) {
            done(true);
            return true;
        }
        if (!mapPickActive()) {
            try {
                if (window.baye && baye.data && baye.data.g_hdMapPick != null &&
                    (!baye.hdEngineReady || baye.hdEngineReady())) {
                    baye.data.g_hdMapPick = 0;
                }
            } catch (e) {}
            bindOpenedMapCity(cityIndex, why);
            done(true);
            return true;
        }
        noteStep4('land-owned-city', { cityIndex: cityIndex, skipped: why || 'land' });
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        if (/无人占领|敌方城池/.test(liveEngineReport()) && liveReportAsync()) {
            engineSendKey(VK.ENTER, 'dismiss-city-refuse');
        }
        var to = cityEngineTile(cityIndex);
        var from = readEngineCursor();
        if (!from || !to || to.x == null || to.y == null) {
            noteStep4('land-owned-no-cursor', { cityIndex: cityIndex, skipped: why || 'no-cursor' });
            done(false);
            return false;
        }
        state.landToken = (state.landToken || 0) + 1;
        var token = state.landToken;
        var dirs = [];
        var x = from.x;
        var y = from.y;
        if (x < 0 || y < 0 || to.x < 0 || to.y < 0 || x > 40 || y > 40 || to.x > 40 || to.y > 40) {
            noteStep4('land-owned-bad-cursor', { cityIndex: cityIndex, from: from, to: to });
            done(false);
            return false;
        }
        while (y > to.y && dirs.length < 16) { dirs.push(VK.UP); y -= 1; }
        while (y < to.y && dirs.length < 16) { dirs.push(VK.DOWN); y += 1; }
        while (x > to.x && dirs.length < 16) { dirs.push(VK.LEFT); x -= 1; }
        while (x < to.x && dirs.length < 16) { dirs.push(VK.RIGHT); x += 1; }
        var step = 0;
        function finishLand() {
            if (token !== state.landToken) {
                return;
            }
            bindOpenedMapCity(cityIndex, why);
            done(cursorOnCity(cityIndex) || !mapPickActive());
            render();
        }
        function sendNext() {
            if (token !== state.landToken) {
                return;
            }
            if (cursorOnCity(cityIndex)) {
                engineSendKey(VK.ENTER, 'land-owned-city');
                setTimeout(finishLand, 200);
                return;
            }
            if (step >= dirs.length) {
                noteStep4('land-owned-miss', { cityIndex: cityIndex, skipped: why || 'miss' });
                bindOpenedMapCity(cityIndex, why);
                done(false);
                return;
            }
            engineSendKey(dirs[step], 'land-owned-city');
            step += 1;
            setTimeout(sendNext, 45);
        }
        sendNext();
        return true;
    }

    /* 选粮 / 选将之前 pick=1 只能是过图残留。写掉旗标，绝不能 EXIT（会退出军备，GetFood 永远不来）。
     * 活着的过图 GetCitySet 不能写 0。 */
    function clearStaleMapPick(why) {
        if (marchProtocol()) { return false; }
        if (battlePickActive() || liveOverworldGetCitySet()) {
            return false;
        }
        if (!leftoverOverworldPick()) {
            return false;
        }
        try {
            if (window.baye && baye.data && baye.data.g_hdMapPick != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdMapPick = 0;
            }
        } catch (e) {}
        noteStep4('clear-stale-pick', { skipped: why || 'stale-pick' });
        return !mapPickActive();
    }

    /* 选粮已确认后 leftover pick=1 不是出征 GetCitySet。写掉旗标并钉出发城，
     * 让 C ShowGReport→battlePick=1→GetCitySet，避免 drive-tip 被 mapPickActive 挡住。 */
    function clearBattleMakeLeftoverPick(why) {
        if (marchProtocol()) { return false; }
        if (battlePickActive()) {
            return false;
        }
        if (!state.battleMake ||
            !(state.personExitSent || state.foodConfirmedThisMarch || liveGetFood())) {
            return false;
        }
        if (!mapPickActive()) {
            bindOpenedMapCity(state.cityIndex, why || 'after-food-bind');
            return false;
        }
        try {
            if (window.baye && baye.data && baye.data.g_hdMapPick != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdMapPick = 0;
            }
        } catch (e) {}
        bindOpenedMapCity(state.cityIndex, why || 'after-food');
        noteStep4('clear-battle-leftover-pick', { skipped: why || 'after-food' });
        return !mapPickActive();
    }

    function engineQtyActiveMin1() {
        var q = engineQty();
        return !!(q && q.active && Number(q.min) >= 1);
    }

    function queuePickEnters() {
        var n = 0, i;
        for (i = 0; i < state.queue.length; i++) {
            if (state.queue[i].code === VK.ENTER) {
                n += 1;
            }
        }
        return n;
    }

    function dropQueuedDirections(why) {
        var kept = [];
        var i;
        for (i = 0; i < state.queue.length; i++) {
            var c = state.queue[i].code;
            if (c === VK.ENTER || c === VK.EXIT) {
                kept.push(state.queue[i]);
            }
        }
        if (kept.length !== state.queue.length) {
            noteStep4('drop-dir-keys', { skipped: why || 'settle', attempt: state.queue.length - kept.length });
            state.queue = kept;
        }
    }

    function liveJunbeiMenu() {
        var names = engineMenuItems().names || [];
        return names[0] === '侦察' &&
            (names.indexOf('出征') >= 0 || names.indexOf('征兵') >= 0);
    }

    function liveCityRootMenu() {
        var names = engineMenuItems().names || [];
        return names[0] === '内政' &&
            (names.indexOf('军备') >= 0 || names.indexOf('外交') >= 0);
    }

    function engineLeftBattleMake() {
        var m = currentMarch();
        return !!(m && Number(m.phase) === MARCH.IDLE);
    }

    function engineStillInPersonPick() {
        var m = currentMarch();
        return !!(m && Number(m.phase) === MARCH.PERSONS);
    }

    function qtyLooksLikeGetFood(q) {
        q = q || engineQty();
        return !!(q && Number(q.min) >= 1 && Number(q.max) >= 1);
    }

    function latentGetFood() {
        // Inactive quantity fields are retained snapshots, never live input.
        return false;
    }

    function restoreGetFoodActive() {
        return !!(engineQty() && engineQty().active);
    }

    function bindLiveGetFoodQty(why) {
        if (!state.battleMake || state.foodGaveUp || state.foodConfirmedThisMarch) {
            return false;
        }
        if (!(liveGetFood() || latentGetFood())) {
            return false;
        }
        restoreGetFoodActive(why || 'bind-qty');
        adoptLiveGetFood(why || 'bind-qty');
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            var dlg = null;
            try {
                dlg = BayeHdDialog.debugSnapshot && BayeHdDialog.debugSnapshot();
            } catch (e) {}
            if (dlg && dlg.open && dlg.kind !== 'qty') {
                BayeHdDialog.close({ silent: true });
            }
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.openQty === 'function') {
            var q = engineQty() || {};
            BayeHdDialog.openQty({
                min: q.min,
                max: q.max,
                init: q.value
            });
        }
        advanceWizard('food', why || 'bind-qty');
        state.marchHint = '请选择随军粮草，然后确认。';
        scheduleMarchWatch();
        render();
        return true;
    }

    function liveGetFood() {
        var m = bindMarchSession();
        var q = engineQty();
        return !!(m && Number(m.phase) === MARCH.FOOD &&
            q && Number(q.active) && Number(q.min) >= 1);
    }

    function marchHintForHold() {
        var phase = engineMarchPhase();
        if (phase === 'get-food' || phase === 'wait-get-food' || liveGetFood() || showingQty()) {
            return liveGetFood() || showingQty()
                ? '出征进行中：请确认粮草，不要返回。'
                : ('出征进行中：等待引擎打开选粮，不要返回。' + marchDebugLine());
        }
        if (state.personExitSent && (engineInGetCitySet() || foodReadyForCitySet() ||
            phase === 'get-city-set' || phase === 'choose-target' || phase === 'armout')) {
            return '出征进行中：点邻城出发，不要返回。';
        }
        if (state.personExitSent) {
            return '出征进行中：等待引擎打开选粮，不要返回。' + marchDebugLine();
        }
        return '出征进行中：点将后点「完成选将」，不要返回。';
    }

    function adoptLiveGetFood(why) {
        if (!liveGetFood()) {
            return false;
        }
        if (!state.personExitSent) {
            state.personExitSent = true;
            state.lastPersonExitAt = state.lastPersonExitAt || Date.now();
            noteStep4('adopt-get-food', { skipped: why || 'early-food' });
        }
        state.sawGetFoodUi = true;
        state.sawQtyThisMarch = true;
        state.foodGaveUp = false;
        clearBattleMakeLeftoverPick(why || 'adopt-food');
        return true;
    }

    function foodReadyForCitySet() {
        return !!(state.sawGetFoodUi && state.foodConfirmedThisMarch);
    }

    function engineInGetCitySet() {
        var m = currentMarch();
        return !!(m && Number(m.phase) === MARCH.TARGET_PICK &&
            Number(m.pick) && Number(m.battlePick));
    }

    function displayWizardStep() {
        var phase = engineMarchPhase();
        var map = {
            'march-ok': 'march-ok',
            'get-city-set': 'map-pick',
            'armout': 'target-tip',
            'get-food': 'food',
            'choose-target': 'target-tip',
            'persons': 'persons',
            'wait-get-food': 'food',
            'wait-get-city-set': 'target-tip'
        };
        return map[phase] || state.wizardStep || 'none';
    }

    function pullWizardToEngine() {
        var shown = displayWizardStep();
        if ((WIZARD_ORDER[state.wizardStep] || 0) > (WIZARD_ORDER[shown] || 0)) {
            setWizardStep(shown, 'pull-to-engine-' + engineMarchPhase());
        }
    }

    function marchDebugLine() {
        var m = engineMarch();
        var q = engineQty();
        var mc = engineMapCityIndex();
        var mcName = mc >= 0 ? (cityName(mc) || '') : '';
        return 'pick=' + ((m && m.pick) ? 1 : 0) +
            ' battlePick=' + ((m && m.battlePick) ? 1 : 0) +
            ' dest=' + ((m && m.obj != null) ? m.obj : '—') +
            ' mapCity=' + (mc < 0 ? '—' : mc) +
            (mcName ? '(' + mcName + ')' : '') +
            ' phase=' + engineMarchPhase() +
            ' qty=' + ((q && q.active)
                ? (String(q.min) + '-' + String(q.value) + '/' + String(q.max))
                : ('0' + (q && Number(q.min) >= 1 ? '/' + q.min : ''))) +
            ' min=' + (q ? q.min : '—') +
            ' max=' + (q ? q.max : '—') +
            ' queue=' + state.queue.length +
            (state.sending ? '/send' : '') +
            ' pex=' + (state.personExitSent ? 1 : 0) +
            ' hold=' + (holdEnterForFood() ? 1 : 0) +
            ' leftoverPick=' + (leftoverOverworldPick() ? 1 : 0) +
            ' persons=' + cityPersons(state.cityIndex).length +
            (state.enginePersonsAtPickStart ? ('/' + state.enginePersonsAtPickStart) : '') +
            ' lastExit=' + (state.lastExit || '—') +
            ' help=' + (function () {
                var ov = leftoverMarchOverlay();
                return (ov.help || ov.engineHelp ? 1 : 0) + (ov.blocking ? 'b' : '') +
                    (ov.kind ? ('/' + ov.kind) : '');
            }()) +
            ' qtyA=' + (function () {
                try {
                    return Number(window.baye && baye.data && baye.data.g_hdQtyActive) || 0;
                } catch (e) { return 0; }
            }()) +
            ' ui=' + (state.wizardStep || 'none');
    }

    function engineMarchPhase() {
        var m = currentMarch();
        if (!m) { return 'none'; }
        return ['none', 'persons', 'get-food', 'choose-target', 'get-city-set',
            'target-rejected', 'armout', 'march-ok'][Number(m.phase)] || 'none';
    }

    function liveTargetStep() {
        return engineInGetCitySet();
    }

    /* GetCitySet 已返回，引擎停在 ShowConstStrMsg(部队已出发)，AddFightOrder 还没跑。 */
    function waitingArmout() {
        var m = currentMarch();
        return !!(m && Number(m.phase) === MARCH.ARMOUT);
    }

    function usesMapCursor() {
        return engineInGetCitySet();
    }

    function qtySnapshot() {
        var q = engineQty() || {};
        return {
            active: !!(q && q.active),
            min: Number(q && q.min) || 0,
            value: Number(q && q.value) || 0
        };
    }

    function qtySameAs(a, b) {
        return !!(a && b && a.active === b.active && a.min === b.min && a.value === b.value);
    }

    /* 本趟 HD 真见过 GetFood 数量条。上场残留 min≥1/active=0 不算。 */
    function thisMarchGetFoodOpened() {
        return !!(liveGetFood() || state.sawGetFoodUi);
    }

    function waitingGetFoodSoftLock() {
        return !!(state.personExitSent && !state.foodGaveUp && !liveGetFood() && !state.sawQtyThisMarch &&
            !engineInGetCitySet() && !state.marchReady && !freshMarchOk());
    }

    function engineStillPersonQueue() {
        if (!state.personExitSent || liveGetFood() || engineInGetCitySet() ||
            state.sawQtyThisMarch || thisMarchGetFoodOpened()) {
            return false;
        }
        var liveFunc = looksLikeFunctionMenu() &&
            (Date.now() - (state.lastFuncMenuIdle || 0)) < 1400;
        if (liveFunc) {
            return false;
        }
        /* 上场 GetFood 残留 min≥1 / leftover pick / 侦察字节都不能当成已离开选将。 */
        return true;
    }

    function leftoverDisasterReport(text) {
        return /饥荒|旱灾|水灾|暴动|须尽快治理|成为君主|拥立|俘虏|病逝|遭劫|归降|势力灭亡|占领|沦陷|战胜|被策反|全军覆没|大获全胜|我军/.test(String(text || ''));
    }

    function leftoverFarmReportText(text) {
        return /农业|商业|开发度|变为|无足够金钱|金钱不足|城中无空闲武将|命令无效|无目标/.test(String(text || ''));
    }

    function leftoverMarchOverlay() {
        var snap = null;
        try {
            if (global.BayeHdDialog && typeof BayeHdDialog.debugSnapshot === 'function') {
                snap = BayeHdDialog.debugSnapshot();
            }
        } catch (e) {}
        var root = el('hd-dialog');
        var open = !!(root && root.classList.contains('is-open'));
        var pe = '';
        try {
            pe = open ? getComputedStyle(root).pointerEvents : 'none';
        } catch (e2) {}
        var kind = snap && snap.kind;
        var body = (snap && (snap.body || snap.reportText)) || liveEngineReport() || '';
        var help = !!(open && kind === 'help');
        var farm = !!(open && kind === 'report' && leftoverFarmReportText(body));
        var blocking = !!(open && pe !== 'none' && (help || farm || !(snap && snap.body)));
        var qtyActive = 0;
        try {
            qtyActive = Number(window.baye && baye.data && baye.data.g_hdQtyActive) || 0;
        } catch (e3) {}
        return {
            open: open,
            kind: kind || '',
            pe: pe,
            help: help,
            farm: farm,
            blocking: blocking,
            engineHelp: !!state.engineHelpOpen,
            qtyActive: qtyActive,
            body: String(body || '').slice(0, 24)
        };
    }

    function dismissMarchOverlay(why) {
        if (marchProtocol()) {
            return !!(global.BayeHdDialog && typeof BayeHdDialog.retireStaleReport === 'function' &&
                BayeHdDialog.retireStaleReport());
        }
        var ov = leftoverMarchOverlay();
        var visible = !!(ov.blocking || ov.engineHelp || ov.help || (ov.open && ov.farm));
        if (ov.open || ov.engineHelp || leftoverFarmReportText(liveEngineReport())) {
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            if (global.BayeHdDialog && typeof BayeHdDialog.dismissLeftoverSpeech === 'function') {
                BayeHdDialog.dismissLeftoverSpeech();
            }
        }
        if (state.engineHelpOpen && !liveGetFood() && !state.foodConfirmedThisMarch) {
            engineSendKey(VK.ENTER, 'dismiss-leftover-help');
            visible = true;
        }
        if (visible) {
            noteStep4('dismiss-overlay', { skipped: why || 'overlay', attempt: ov.kind || '' });
        }
        return visible;
    }

    function requeuePickedPersons(why) {
        dismissMarchOverlay(why || 'requeue');
        var names = state.pickedPersonNames || [];
        var live = cityPersons(state.cityIndex);
        var sent = 0;
        var i;
        var j;
        for (i = 0; i < names.length; i++) {
            for (j = 0; j < live.length; j++) {
                if (live[j] && live[j].name === names[i]) {
                    pickIndex(j, true, 'pick-person');
                    sent += 1;
                    break;
                }
            }
        }
        if (!sent && (state.pickedPersons || 0) > 0 && live.length) {
            pickIndex(0, true, 'pick-person');
            sent = 1;
        }
        if (sent) {
            noteStep4('requeue-picks', { skipped: why || 'overlay', attempt: sent });
        }
        return sent;
    }

    function clearStaleDisasterReport() {
        if (marchProtocol()) {
            return !!(global.BayeHdDialog && typeof BayeHdDialog.retireStaleReport === 'function' &&
                BayeHdDialog.retireStaleReport());
        }
        if (!leftoverDisasterReport(liveEngineReport()) || liveReportAsync()) {
            return false;
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        return true;
    }

    function liveReportAsync() {
        try {
            if (window.baye && baye.data) {
                var id = Number(baye.data.g_asyncActionID);
                return id === 1 || id === 2 || id === 13;
            }
        } catch (e) {}
        return false;
    }

    function driveFoodToCitySet() {
        var m = bindMarchSession();
        if (!m) {
            return { deferred: 'wait-march-session', phase: 'none' };
        }
        if (Number(m.phase) === MARCH.FOOD) {
            adoptLiveGetFood('engine-food');
            advanceWizard('food', 'engine-food');
            return { deferred: 'wait-food-ui', phase: 'get-food' };
        }
        // Polling only observes state. Reports, food values and menus are
        // confirmed by their own player controls, never by a timer.
        return { ok: Number(m.phase) === MARCH.TARGET_PICK,
            deferred: Number(m.phase) === MARCH.TARGET_PICK ? '' : 'wait-player',
            phase: engineMarchPhase() };
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

    function syncQuantityWait(q) {
        if (!q || !Number(q.active)) { return; }
        if (q.protocol) {
            var nativeKey = 'qty:' + String(q.session);
            if (state.qtyWaitKey === nativeKey) {
                if (bayeQtyNativeClosed(q)) { state.qtyInputClosed = true; }
                return;
            }
            state.qtyWaitKey = nativeKey;
            invalidateQtyWork();
            state.qtyInputClosed = bayeQtyNativeClosed(q);
            state.qtyAckFailed = false;
            state.qtyAckError = '';
            state.qtyDismissed = false;
            state.qtyDismissedAt = 0;
            return;
        }
        if (!marchProtocol()) { return; }
        var menu = engineMenuItems();
        if (menu.active == null || Number(menu.active) || !Number(menu.seq)) { return; }
        // NumOperate starts after its person/menu closes. That C menu end
        // advances the native sequence, distinguishing consecutive quantities.
        var march = marchProtocol();
        var key = String(menu.seq) + ':' + (Number(march.phase) === MARCH.FOOD
            ? String(march.session) + ':' + String(march.inputSeq) : 'city');
        if (state.qtyWaitKey === key) { return; }
        state.qtyWaitKey = key;
        invalidateQtyWork();
        state.qtyInputClosed = false;
        state.qtyAckFailed = false;
        state.qtyAckError = '';
        state.qtyDismissed = false;
        state.qtyDismissedAt = 0;
    }

    function leftoverQtyFlag() {
        var q = engineQty();
        syncQuantityWait(q);
        if (!(q && q.active)) {
            return false;
        }
        if (marchProtocol()) {
            var menu = engineMenuItems();
            return !!(state.qtyInputClosed || menu.active != null && Number(menu.active));
        }
        /* 活着的出征 GetFood（min≥1）绝不当残留。向导/选择目标/qtyDismissed 不能清掉它。 */
        if (liveGetFood()) {
            return false;
        }
        if (state.qtyDismissed) {
            return true;
        }
        if (state.marchReady || state.handoff || freshMarchOk()) {
            return true;
        }
        /* 征兵 NumOperate 残留 min=0。出征 GetFood min 恒为 1，选将阶段提前打开也不当残留。 */
        if (state.battleMake && Number(q.min) === 0) {
            return true;
        }
        if (state.battleMake && !state.personExitSent && Number(q.min) >= 1) {
            return false;
        }
        if (engineInGetCitySet()) {
            return true;
        }
        return false;
    }

    function liveQty() {
        var q = engineQty();
        syncQuantityWait(q);
        if (state.qtyInputClosed || !(q && q.active) || leftoverQtyFlag()) {
            return false;
        }
        return true;
    }

    function showingQty() {
        if (leftoverQtyFlag()) {
            return false;
        }
        if (liveQty() || liveGetFood()) {
            return true;
        }
        if (marchProtocol()) { return false; }
        if (state.qtyDismissed) {
            return false;
        }
        return !!(state.deepKind === 'person-qty' && state.deepStep === 1 && !state.battleMake);
    }

    function clearLeftoverQtyValues() {
        if (marchProtocol() || engineQty() && engineQty().protocol) { return; }
        try {
            if (window.baye && baye.data && (!baye.hdEngineReady || baye.hdEngineReady())) {
                if (baye.data.g_hdQtyActive != null) {
                    baye.data.g_hdQtyActive = 0;
                }
                if (baye.data.g_hdQtyMin != null) {
                    baye.data.g_hdQtyMin = 0;
                }
                if (baye.data.g_hdQtyMax != null) {
                    baye.data.g_hdQtyMax = 0;
                }
                if (baye.data.g_hdQtyValue != null) {
                    baye.data.g_hdQtyValue = 0;
                }
            }
        } catch (e) {}
    }

    function clearLeftoverQtyFlag() {
        if (liveGetFood()) {
            return;
        }
        try {
            if (window.baye && baye.data && baye.data.g_hdQtyActive != null &&
                !marchProtocol() && !(engineQty() && engineQty().protocol) &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdQtyActive = 0;
            }
        } catch (e) {}
        if (global.BayeHdDialog && typeof BayeHdDialog.closeQty === 'function') {
            BayeHdDialog.closeQty();
        } else if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            try {
                var d = BayeHdDialog.debugSnapshot && BayeHdDialog.debugSnapshot();
                if (d && d.open && d.kind === 'qty') {
                    BayeHdDialog.close({ silent: true });
                }
            } catch (e2) {}
        }
    }

    function invalidateQtyWork() {
        qtyEpoch += 1;
        state.queue = state.queue.filter(function (item) { return item.qtyEpoch == null; });
        state.qtyCommitQueued = false;
        state.activeQueueReason = '';
    }

    function stepQty(delta) {
        if (!liveQty()) {
            return false;
        }
        if (state.qtyCommitQueued || state.qtyAckFailed) {
            return true;
        }
        delta = Number(delta);
        if (delta === -10 || delta === -1 || delta === 1 || delta === 10) {
            state.queue.push({ qtyStep: delta, reason: 'qty-step', qtyEpoch: qtyEpoch });
            pumpQueue();
        }
        return true;
    }

    function digitQty(digit) {
        if (!liveQty()) {
            return false;
        }
        digit = Number(digit);
        if (!state.qtyCommitQueued && !state.qtyAckFailed && digit >= 0 && digit <= 9 && Math.floor(digit) === digit) {
            enqueueKeys([0x40 + digit], 30, 'qty-digit');
        }
        return true;
    }

    function quantityKey(code) {
        if (!liveQty()) { return false; }
        code = Number(code);
        if ([VK.UP, VK.DOWN, VK.LEFT, VK.RIGHT, 0x26, 0x33].indexOf(code) < 0 &&
            !(code >= 0x40 && code <= 0x49 && Math.floor(code) === code)) { return false; }
        if (!state.qtyCommitQueued && !state.qtyAckFailed) {
            enqueueKeys([code], 40, 'qty-key');
        }
        return true;
    }

    function commitQty(nativeReady) {
        syncQuantityWait(engineQty());
        if (state.qtyInputClosed || state.qtyCommitQueued || state.qtyAckFailed) {
            return;
        }
        var quantityKeyPending = /^qty-/.test(state.activeQueueReason) || state.queue.some(function (item) {
                return /^qty-/.test(item.reason || '');
            });
        var quantity = engineQty();
        if (liveQty() && (quantityKeyPending || quantity && quantity.protocol && !nativeReady)) {
            // Confirm after the queued digits/steps, rather than closing their
            // NumOperate early and sending its remaining keys into the next UI.
            state.qtyCommitQueued = true;
            state.queue.push({ qtyCommit: true, wait: 40, qtyEpoch: qtyEpoch });
            pumpQueue();
            return;
        }
        if (leftoverQtyFlag() || !liveQty()) {
            state.qtyDismissed = true;
            state.qtyDismissedAt = Date.now();
            clearLeftoverQtyFlag();
            render();
            scheduleMarchWatch();
            return;
        }
        bayeQtyCloseInput(engineQty());
        engineSendKey(VK.ENTER, 'qty-ok');
        state.qtyInputClosed = true;
        invalidateQtyWork();
        var epoch = qtyEpoch;
        state.qtyDismissed = true;
        state.qtyDismissedAt = Date.now();
        if (state.battleMake && (state.personExitSent || liveGetFood() || state.sawGetFoodUi)) {
            state.sawGetFoodUi = true;
            state.marchFoodCommitSent = true;
            state.sawQtyThisMarch = true;
            advanceWizard('food', 'commit-qty');

        }
        setTimeout(function () {
            syncQuantityWait(engineQty());
            if (epoch !== qtyEpoch || !shouldShowHd()) {
                return;
            }
            setTimeout(function () {
                syncQuantityWait(engineQty());
                if (epoch !== qtyEpoch || !shouldShowHd()) {
                    return;
                }
                if (engineQty() && engineQty().active && leftoverQtyFlag()) {
                    clearLeftoverQtyFlag();
                }
                if (global.BayeHdDialog && typeof BayeHdDialog.closeQty === 'function') {
                    BayeHdDialog.closeQty();
                }
                driveFoodToCitySet('commit-qty');
                scheduleMarchWatch();
                render();
            }, 160);
        }, 80);
    }

    function cancelQty() {
        syncQuantityWait(engineQty());
        if (state.qtyInputClosed) {
            return;
        }
        invalidateQtyWork();
        if (!liveQty()) {
            clearLeftoverQtyFlag();
            render();
            return;
        }
        bayeQtyCloseInput(engineQty());
        engineSendKey(VK.EXIT, 'qty-cancel');
        state.qtyInputClosed = true;
        var epoch = qtyEpoch;
        state.qtyDismissed = true;
        state.qtyDismissedAt = Date.now();
        setTimeout(function () {
            syncQuantityWait(engineQty());
            if (epoch !== qtyEpoch || !shouldShowHd()) {
                return;
            }
            clearLeftoverQtyFlag();
            render();
        }, 80);
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

    function readCity(index) {
        var data = engineData();
        if (!data || !data.g_Cities || index < 0 || !data.g_Cities[index]) {
            return null;
        }
        return data.g_Cities[index];
    }

    function cityPersons(index, alliedOnly) {
        var data = engineData();
        var city = readCity(index);
        var list = [];
        if (!data || !city || !data.g_PersonsQueue) {
            return list;
        }
        var n = readNumber(city, 'Persons') || 0;
        var q0 = readNumber(city, 'PersonQueue') || 0;
        var qlen = data.g_PersonsQueue.length || 0;
        if (q0 < 0 || q0 >= qlen || q0 >= 0xfffe || n <= 0) {
            return list;
        }
        var i;
        for (i = 0; i < n && i < 40; i++) {
            if (q0 + i >= qlen) {
                break;
            }
            var pind = readNumber(data.g_PersonsQueue, q0 + i);
            if (pind === null && data.g_PersonsQueue[q0 + i] != null) {
                pind = Number(data.g_PersonsQueue[q0 + i]);
            }
            if (pind === null || !isFinite(pind) || pind < 0 || pind >= 0xfffe ||
                data.g_Persons && pind >= data.g_Persons.length) {
                continue;
            }
            if (alliedOnly && (!data.g_Persons || !data.g_Persons[pind] ||
                readNumber(data.g_Persons[pind], 'Belong') !== readNumber(city, 'Belong'))) {
                continue;
            }
            var name = '';
            try {
                name = baye.getPersonName(pind) || '';
            } catch (e) {}
            if (!name) {
                continue;
            }
            list.push({ i: list.length, pind: pind, name: name });
        }
        return list;
    }

    function cityPersonCount(index) {
        var city = readCity(index);
        var n = city ? readNumber(city, 'Persons') : 0;
        if (n && n > 0 && n < 0xfffe) {
            return n;
        }
        return cityPersons(index).length;
    }

    function pickedNamesGoneCount() {
        var names = state.pickedPersonNames || [];
        var live = cityPersons(state.cityIndex);
        var gone = 0;
        var i;
        var j;
        for (i = 0; i < names.length; i++) {
            var found = false;
            for (j = 0; j < live.length; j++) {
                if (live[j] && live[j].name === names[i]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                gone += 1;
            }
        }
        return gone;
    }

    function engineTookPickedGenerals() {
        var personsNow = cityPersonCount(state.cityIndex);
        var startCount = state.enginePersonsAtPickStart || state.enginePersonsAtFinish || personsNow;
        var dropped = startCount ? Math.max(0, startCount - personsNow) : 0;
        return dropped >= 1 || pickedNamesGoneCount() >= 1;
    }

    function cityLinkIndexes() {
        var from = state.cityIndex;
        var loaded = [];
        try {
            if (window.baye && baye.hd && typeof baye.hd.cityLinks === 'function' &&
                from != null && from >= 0) {
                loaded = baye.hd.cityLinks(from) || [];
            }
        } catch (e) {}
        var out = [];
        var i;
        if (loaded && loaded.length) {
            for (i = 0; i < loaded.length; i++) {
                if (loaded[i] && loaded[i].index != null && isFinite(Number(loaded[i].index))) {
                    out.push(Number(loaded[i].index));
                }
            }
            return out;
        }
        var data = engineData();
        var links = data && data.g_hdCityLinks;
        if (!links) {
            return out;
        }
        for (i = 0; i < 8; i++) {
            var id = readNumber(links, i);
            if (id === null && links[i] != null) {
                id = Number(links[i]);
            }
            if (id && id !== 0xff && id < 0xfffe) {
                var idx = id - 1;
                var max = cityCount();
                if (idx >= 0 && (!max || idx < max)) {
                    out.push(idx);
                }
            }
        }
        return out;
    }

    function playerBelong() {
        var data = engineData();
        var king = data ? readNumber(data, 'g_PlayerKing') : null;
        if (king == null || !isFinite(king)) {
            return 0;
        }
        return king + 1;
    }

    function otherCities(except) {
        var data = engineData();
        var list = [];
        if (!data || !data.g_Cities) {
            return list;
        }
        var restrict = (usesMapCursor(state.deepKind, state.deepStep) || liveTargetStep())
            ? cityLinkIndexes() : [];
        var mine = playerBelong();
        var i;
        var rows = [];
        var n = cityCount() || Math.min(data.g_Cities.length, 64);
        for (i = 0; i < n; i++) {
            if (i === except) {
                continue;
            }
            if (restrict.length && restrict.indexOf(i) < 0) {
                continue;
            }
            var name = cityName(i);
            var belong = readNumber(data.g_Cities[i], 'Belong');
            var owner = belong ? personNameById(belong) : '';
            var enemy = !mine || !belong || belong !== mine;
            rows.push({
                cityIndex: i,
                name: name || ('城' + (i + 1)),
                owner: owner,
                enemy: enemy
            });
        }
        rows.sort(function (a, b) {
            if (a.enemy !== b.enemy) {
                return a.enemy ? -1 : 1;
            }
            return a.cityIndex - b.cityIndex;
        });
        for (i = 0; i < rows.length; i++) {
            rows[i].i = i;
            list.push(rows[i]);
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

    function detailNumber(value, max) {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value &&
            value >= 0 && value <= max ? value : null;
    }

    function actualMenuIds(menu) {
        if (!menu || menu.idsValid !== true || !Array.isArray(menu.ids) || !Array.isArray(menu.names) ||
            menu.ids.length !== menu.names.length || menu.count !== menu.names.length ||
            !menu.ids.every(function (id) { return detailNumber(id, 65534) != null; })) { return null; }
        return menu.ids;
    }

    function menuIdentitySignature(menu) {
        return JSON.stringify([menu && menu.detailGeneration, actualMenuIds(menu)]);
    }

    function deepMenuOwner(menu) {
        if (!menu || menu.active == null || !Number(menu.active) ||
            Number(menu.context) !== 1 || [3, 4].indexOf(Number(menu.kind)) < 0 ||
            !menu.names || !menu.names.length ||
            (Number(menu.count) && Number(menu.count) !== menu.names.length)) { return null; }
        var kind = Number(menu.kind);
        var expected = usesGoodsMenu(state.deepKind, state.deepStep) ? 4 : 3;
        if (kind !== expected) { return null; }
        if (state.deepKind === 'person-city') {
            var march = currentMarch();
            if (!march || Number(march.phase) !== MARCH.PERSONS) { return null; }
        }
        var generation = detailNumber(menu.detailGeneration, 4294967295);
        return { context: 1, kind: kind, seq: Number(menu.seq), detailGeneration: generation,
            key: JSON.stringify([marchEpoch, 1, kind, Number(menu.seq), menu.names,
                generation, actualMenuIds(menu)]) };
    }

    function readyDeepMenuOwner(menu) {
        var owner = deepMenuOwner(menu);
        var pending = state.deepSelectionPending;
        if (!pending) { return owner; }
        if (pending.epoch !== marchEpoch) {
            state.deepSelectionPending = null;
            return owner;
        }
        if (!state.nativeMenuRequest && state.nativeMenuCommit !== pending.key) {
            state.deepSelectionPending = null;
            return owner;
        }
        // Enter closes a real person menu before C removes the chosen person
        // and opens the next one. Never publish the previous list in that gap.
        var march = currentMarch();
        if (state.nativeMenuRequest || Number(menu.seq) === pending.seq ||
            pending.selected != null && (!march || Number(march.session) !== pending.session ||
                Number(march.selected) < pending.selected)) { return null; }
        state.deepSelectionPending = null;
        return owner;
    }

    function nativeDeepItems(menu, owner) {
        if (!owner) { return []; }
        var ids = actualMenuIds(menu);
        if (ids) {
            return menu.names.map(function (name, index) {
                var item = { i: index, name: name, nativeId: true };
                if (owner.kind === 3) { item.pind = ids[index]; }
                else if (owner.kind === 4) { item.toolIndex = ids[index]; }
                return item;
            });
        }
        // Native GetCityPersons walks the queue in order and keeps only
        // Person.Belong === City.Belong. The raw city queue also contains free
        // people/captives and is not the current actor menu.
        var persons = owner.kind === 3 && menu.idsValid !== true ? cityPersons(state.cityIndex, true) : [];
        var samePersons = persons.length === menu.names.length && persons.every(function (person, index) {
            return person.name === menu.names[index] && menu.names.indexOf(person.name) === index;
        });
        return menu.names.map(function (name, index) {
            var item = { i: index, name: name };
            // A Mod may filter/reorder the native list. Only attach queue IDs
            // when every entry agrees; names and native indices remain primary.
            if (samePersons) { item.pind = persons[index].pind; }
            return item;
        });
    }

    function probeDeepItems() {
        var kind = state.deepKind;
        var step = state.deepStep;
        var native = engineMenuItems();
        if (native.active != null && !usesMapCursor(kind, step) &&
            !(kind === 'person-city' && liveTargetStep())) {
            return nativeDeepItems(native, readyDeepMenuOwner(native));
        }
        if (kind === 'person-city') {
            var march = bindMarchSession();
            if (march && Number(march.phase) === MARCH.PERSONS) {
                var menu = engineMenuItems();
                if (Number(menu.active) && Number(menu.context) === 1 &&
                    Number(menu.kind) === 3 && menu.names && menu.names.length) {
                    // The live native menu also includes Mod filtering/order.
                    // Preserve its indices; retained bytes are never a menu.
                    return menu.names.map(function (name, index) {
                        return { i: index, name: name };
                    });
                }
                return cityPersons(state.cityIndex, true);
            }
            return march && Number(march.phase) === MARCH.TARGET_PICK
                ? otherCities(state.cityIndex) : [];
        }
        if (kind === 'person-city' && !state.personExitSent &&
            state.wizardStep === 'persons' && !showingQty()) {
            var picking = cityPersons(state.cityIndex);
            if (picking.length) {
                return picking;
            }
        }
        if (usesMapCursor(kind, step) || (kind === 'person-city' && liveTargetStep())) {
            return otherCities(state.cityIndex);
        }
        if (kind === 'person' || kind === 'person-goods' || kind === 'person-qty' ||
            (kind === 'person-city' && !state.personExitSent &&
            !mapPickActive() && !showingQty() && !liveTargetStep())) {
            var persons = cityPersons(state.cityIndex);
            if (persons.length) {
                return persons;
            }
        }
        if (kind === 'person-city' && state.personExitSent && !showingQty() && !liveTargetStep()) {
            return [];
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

    // Presentation reads are narrower than the historic input helpers: a
    // missing field, boolean or empty string must never appear as numeric zero.
    function hudNumber(obj, key) {
        var value = obj && obj[key];
        if (value && typeof value === 'object' && 'value' in value) { value = value.value; }
        if (value == null || (typeof value !== 'number' && typeof value !== 'string') ||
            typeof value === 'string' && !value.trim()) { return null; }
        value = Number(value);
        return isFinite(value) && Math.floor(value) === value && value >= 0 ? value : null;
    }

    function hudValue(obj, key) {
        var value = hudNumber(obj, key);
        return value == null ? '未读取' : String(value);
    }

    function hudCapacity(obj, key, limit) {
        var value = hudValue(obj, key);
        var max = hudNumber(obj, limit);
        return max == null ? value + ' / 上限未读取' : value + ' / ' + max;
    }

    function hudOwnership(value, personIndex, city) {
        var method = city ? 'cityOwnership' : 'personOwnership';
        try {
            if (window.baye && typeof baye[method] === 'function') {
                return baye[method](value, personIndex);
            }
        } catch (e) {}
        return { kind: 'unknown', value: value, label: '归属未知' };
    }

    function hudPersonId(value) {
        if (value == null) { return '未读取'; }
        if (value === 0) { return '未设'; }
        var owner = hudOwnership(value, null, true);
        return owner.kind === 'owned' ? owner.name : '人物未知（编号 ' + value + '）';
    }

    function standardHudLabels(hookNames) {
        var identity = global.BayeHdLibIdentity;
        try {
            var loaded = identity && identity.read();
            if (!loaded || loaded.status !== 'ready' ||
                loaded.sha256 !== '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e' ||
                !identity.isCurrent(loaded)) { return false; }
            var hooks = window.baye && baye.hooks;
            return !hooks || !hookNames.some(function (key) { return typeof hooks[key] === 'function'; });
        } catch (e) { return false; }
    }

    function cityDetails(city) {
        if (!city) { return null; }
        var code = hudNumber(city, 'State');
        var standard = standardHudLabels(['getCityPropertyDisplay']);
        var groups = [
            { title: '归属与城况', rows: [
                ['归属', hudOwnership(hudNumber(city, 'Belong'), null, true).label],
                ['太守', hudPersonId(hudNumber(city, 'SatrapId'))],
                ['城况', code == null ? '未读取' : standard && STATE_LABELS[code]
                    ? STATE_LABELS[code] + '（码 ' + code + '）' : '原始码 ' + code]
            ] },
            { title: '民生与发展', rows: [
                ['农业 / 上限', hudCapacity(city, 'Farming', 'FarmingLimit')],
                ['商业 / 上限', hudCapacity(city, 'Commerce', 'CommerceLimit')],
                ['人口 / 上限', hudCapacity(city, 'Population', 'PopulationLimit')],
                ['民忠', hudValue(city, 'PeopleDevotion')], ['防灾', hudValue(city, 'AvoidCalamity')]
            ] },
            { title: '资源与军备', rows: [
                ['金钱', hudValue(city, 'Money')], ['粮食', hudValue(city, 'Food')],
                ['预备兵', hudValue(city, 'MothballArms')],
                ['城内人物', hudValue(city, 'Persons')], ['城内道具', hudValue(city, 'Tools')]
            ] }
        ];
        var represented = ['State', 'Belong', 'SatrapId', 'Farming', 'FarmingLimit', 'Commerce',
            'CommerceLimit', 'Population', 'PopulationLimit', 'PeopleDevotion', 'AvoidCalamity',
            'Money', 'Food', 'MothballArms', 'Persons', 'Tools', 'PersonQueue', 'ToolQueue'];
        var extras = [];
        listProps(city).forEach(function (key) {
            if (represented.indexOf(key) < 0 && hudNumber(city, key) != null) {
                extras.push([key === 'Arms' ? '兵力' : key, hudValue(city, key)]);
            }
        });
        if (extras.length) { groups.push({ title: '其他属性', rows: extras }); }
        return { cityIndex: state.cityIndex, name: cityName(state.cityIndex), groups: groups };
    }

    function appendStat(box, label, value) {
        var row = document.createElement('div');
        row.className = 'hd-city-menu-stat';
        var name = document.createElement('span');
        name.textContent = label;
        var number = document.createElement('strong');
        number.textContent = String(value);
        row.appendChild(name);
        row.appendChild(number);
        box.appendChild(row);
    }

    function appendHudGroups(box, groups) {
        groups.forEach(function (group) {
            var section = document.createElement('section');
            section.className = 'hd-city-menu-info-group';
            var heading = document.createElement('h3');
            heading.textContent = group.title;
            section.appendChild(heading);
            var rows = document.createElement('div');
            rows.className = 'hd-city-menu-info-rows';
            group.rows.forEach(function (row) { appendStat(rows, row[0], row[1]); });
            section.appendChild(rows);
            box.appendChild(section);
        });
    }

    function renderStatus() {
        var box = el('hd-city-menu-status');
        if (!box) { return; }
        box.innerHTML = '';
        var city = readCity(state.cityIndex);
        state.cityDetails = cityDetails(city);
        state.probedCityKeys = listProps(city);
        if (!state.cityDetails) {
            box.textContent = '城池资料尚未读取。';
            return;
        }
        appendHudGroups(box, state.cityDetails.groups);
    }

    function equipmentLabel(person, slot) {
        var equip = person && person.Equip;
        var value = equip && equip[slot] !== undefined
            ? hudNumber(equip, slot) : hudNumber(person, slot ? 'Tool2' : 'Tool1');
        if (value == null) { return '未读取'; }
        if (value === 0) { return '无'; }
        var name = '';
        var count = 512;
        // Equipment is one-based. The current resource getter validates its
        // payload and name table; only older bridges need the legacy bound.
        if (window.baye && typeof baye.getToolCount === 'function') {
            try { count = detailNumber(baye.getToolCount(), 2000); } catch (e) { count = null; }
        }
        if (count != null && value <= count) {
            try { name = window.baye && baye.getToolName ? baye.getToolName(value - 1) || '' : ''; } catch (e) {}
        }
        return name && name !== '-' ? name + '（编号 ' + value + '）' : '道具编号 ' + value + '（名称未读取）';
    }

    function priorOwnershipLabel(value) {
        if (value == null) { return '未读取'; }
        if (value === 0) { return '未记录（0）'; }
        // OldBelong stores a previous allegiance, not current captive status.
        var owner = hudOwnership(value, null, true);
        return owner.kind === 'owned' ? owner.name : '原归属未知（码 ' + value + '）';
    }

    function personDetails(index, name) {
        var data = engineData();
        var count = 0;
        try { count = window.baye && baye.getPersonCount ? baye.getPersonCount() : 0; } catch (e) {}
        if (!Number.isInteger(index) || index < 0 || index >= count || !data ||
            !data.g_Persons || !data.g_Persons[index]) { return null; }
        var person = data.g_Persons[index];
        var owner = hudOwnership(hudNumber(person, 'Belong'), index, false);
        var oldBelong = hudNumber(person, 'OldBelong');
        var character = hudNumber(person, 'Character');
        var lord = owner.kind === 'lord';
        var standard = standardHudLabels(['getPersonPropertyValue', 'getPersonPropertyTitle']);
        var chars = lord ? ['冒进', '狂人', '奸诈', '大义', '和平'] : ['鲁莽', '怕死', '贪财', '大志', '忠义'];
        var characterLabel = character == null ? '未读取' : String(character);
        // Lord character semantics require a verified owner/name. Missing
        // ownership only exposes the raw code, without guessing its meaning.
        if (standard && character != null && owner.kind !== 'unknown' && chars[character]) {
            characterLabel += '（' + (lord ? '君主' : '武将') + '：' + chars[character] + '）';
        }
        var arm = hudNumber(person, 'ArmsType');
        var arms = ['骑兵', '步兵', '弓箭兵', '水军', '极兵', '玄兵'];
        var derivedArm = null;
        try {
            if (baye.hd && typeof baye.hd.personArmType === 'function') {
                derivedArm = detailNumber(baye.hd.personArmType(index), 255);
            }
        } catch (e2) {}
        var groups = [
            { title: '身份与经历', rows: [
                ['归属', owner.label],
                ['原归属', priorOwnershipLabel(oldBelong)],
                ['年龄', hudValue(person, 'Age')], ['性格码', characterLabel]
            ] },
            { title: '能力与状态', rows: [
                ['等级', hudValue(person, 'Level')], ['武力', hudValue(person, 'Force')],
                ['智力', hudValue(person, 'IQ')], ['忠诚值', hudValue(person, 'Devotion')],
                ['经验', hudValue(person, 'Experience')], ['体力', hudValue(person, 'Thew')]
            ] },
            { title: '军队与装备', rows: [
                ['基础兵种', arm == null ? '未读取' : standard && arms[arm]
                    ? arms[arm] + '（码 ' + arm + '）' : '原始码 ' + arm],
                ['装备后兵种', derivedArm == null ? '未读取' : standard && arms[derivedArm]
                    ? arms[derivedArm] + '（码 ' + derivedArm + '）' : '原始码 ' + derivedArm],
                ['兵力', hudValue(person, 'Arms')],
                ['装备一', equipmentLabel(person, 0)], ['装备二', equipmentLabel(person, 1)]
            ] }
        ];
        return { personIndex: index, name: name, ownership: owner, groups: groups,
            note: '装备可能改变实际兵种。忠诚值保留原始数值，君主与在野人物不以此判断归属。' };
    }

    function retirePersonDetails() {
        state.personDetail = null;
        state.personDetailSig = '';
        var pane = el('hd-city-menu-person-details');
        if (pane) { pane.hidden = true; }
        var layout = el('hd-city-menu-person-layout');
        if (layout) { layout.classList.remove('has-person-details'); }
    }

    function ensurePersonDetailsPane() {
        var pane = el('hd-city-menu-person-details');
        if (!pane) {
            var deep = el('hd-city-menu-deep');
            if (!deep || !deep.parentElement) { return null; }
            var layout = document.createElement('div');
            layout.id = 'hd-city-menu-person-layout';
            layout.className = 'hd-city-menu-person-layout';
            deep.parentElement.insertBefore(layout, deep);
            layout.appendChild(deep);
            pane = document.createElement('aside');
            pane.id = 'hd-city-menu-person-details';
            pane.className = 'hd-city-menu-person-details';
            pane.setAttribute('aria-label', '当前人物资料');
            pane.hidden = true;
            layout.appendChild(pane);
        }
        if (!el('hd-city-menu-person-portrait')) {
            var slot = document.createElement('div');
            slot.id = 'hd-city-menu-person-portrait';
            slot.className = 'hd-city-menu-person-portrait';
            pane.appendChild(slot);
        }
        if (!el('hd-city-menu-person-fields')) {
            var fields = document.createElement('div');
            fields.id = 'hd-city-menu-person-fields';
            fields.className = 'hd-city-menu-person-fields';
            pane.appendChild(fields);
        }
        return pane;
    }

    function renderPersonDetails() {
        if (!state.open || state.layer !== 'deep' || document.hidden || !shouldShowHd() ||
            !/^person/.test(state.deepKind) || usesGoodsMenu(state.deepKind, state.deepStep) ||
            showingQty() || state.nativeMenuRequest || state.deepSelectionPending) {
            retirePersonDetails();
            return;
        }
        try {
            var help = baye.hd && typeof baye.hd.help === 'function' ? baye.hd.help() : null;
            var report = baye.hd && typeof baye.hd.report === 'function' ? baye.hd.report() : null;
            if (help && Number(help.active) || report && Number(report.active)) {
                retirePersonDetails();
                return;
            }
        } catch (e) { retirePersonDetails(); return; }
        var menu = engineMenuItems();
        var owner = deepMenuOwner(menu);
        if (!owner || owner.kind !== 3 || !state.deepMenuOwner || owner.key !== state.deepMenuOwner.key) {
            retirePersonDetails();
            return;
        }
        var index = hudNumber(menu, 'index');
        if (index == null || index >= menu.names.length) { retirePersonDetails(); return; }
        var items = nativeDeepItems(menu, owner);
        var item = items[index];
        // Without native person IDs, identical names make reordering ambiguous.
        // Keep the native buttons usable, but do not attach inferred statistics.
        var unique = menu.names.every(function (name, i) { return menu.names.indexOf(name) === i; });
        var details = item && (item.nativeId || unique) && item.pind != null ? personDetails(item.pind, item.name) : null;
        // Read-only bridge/name getters can still reenter a Mod callback. Do
        // not publish a person sampled under a menu that has since retired.
        var afterMenu = engineMenuItems(), afterOwner = deepMenuOwner(afterMenu);
        if (!afterOwner || afterOwner.key !== owner.key || hudNumber(afterMenu, 'index') !== index || detailOverlayActive()) {
            retirePersonDetails();
            return;
        }
        var signature = JSON.stringify([owner.key, index, details]);
        var pane = ensurePersonDetailsPane();
        if (!pane) { return; }
        var fields = el('hd-city-menu-person-fields');
        pane.hidden = false;
        el('hd-city-menu-person-layout').classList.add('has-person-details');
        state.personDetail = details && { ownerKey: owner.key, context: owner.context, kind: owner.kind,
            seq: owner.seq, nativeIndex: index, personIndex: details.personIndex,
            name: details.name, ownership: details.ownership, groups: details.groups };
        if (state.personDetailSig === signature && fields.children.length) { return; }
        state.personDetailSig = signature;
        fields.innerHTML = '';
        var heading = document.createElement('h2');
        heading.id = 'hd-city-menu-person-name';
        heading.className = 'hd-city-menu-person-name';
        heading.textContent = item ? item.name : '人物资料';
        fields.appendChild(heading);
        if (!details) {
            var missing = document.createElement('p');
            missing.className = 'hd-city-menu-info-note';
            missing.textContent = '当前人物资料尚未关联。';
            fields.appendChild(missing);
            return;
        }
        appendHudGroups(fields, details.groups);
        var note = document.createElement('p');
        note.className = 'hd-city-menu-info-note';
        note.textContent = details.note;
        fields.appendChild(note);
    }

    function retireToolDetails() {
        if (state.toolDetail || state.toolPagePending) { state.toolPaneEpoch += 1; }
        state.toolDetail = null;
        state.toolDetailSig = '';
        state.toolPagePending = null;
        var pane = el('hd-city-menu-tool-details');
        if (pane) { pane.hidden = true; }
        var layout = el('hd-city-menu-person-layout');
        if (layout) { layout.classList.remove('has-tool-details'); }
    }

    function detailFlag(value) {
        return value === true || value === 1 ? true : value === false || value === 0 ? false : null;
    }

    function detailOverlayActive() {
        try {
            var help = baye.hd && typeof baye.hd.help === 'function' ? baye.hd.help() : null;
            var report = baye.hd && typeof baye.hd.report === 'function' ? baye.hd.report() : null;
            if (help && Number(help.active) || report && Number(report.active)) { return true; }
            var dialog = global.BayeHdDialog && typeof BayeHdDialog.debugSnapshot === 'function'
                ? BayeHdDialog.debugSnapshot() : null;
            return !!(dialog && dialog.open && !dialog.pass && ['report', 'help', 'qty'].indexOf(dialog.kind) >= 0);
        } catch (e) { return true; }
    }

    function liveToolContext() {
        if (!state.open || state.layer !== 'deep' || document.hidden || !shouldShowHd() ||
            !usesGoodsMenu(state.deepKind, state.deepStep) || showingQty() || state.nativeMenuRequest ||
            state.deepSelectionPending || state.sending || state.queue.length || detailOverlayActive()) { return null; }
        var menu = engineMenuItems(), owner = deepMenuOwner(menu), ids = actualMenuIds(menu);
        if (!owner || owner.kind !== 4 || !state.deepMenuOwner || owner.key !== state.deepMenuOwner.key || !ids ||
            !owner.detailGeneration || menu.generation !== owner.detailGeneration ||
            !detailNumber(owner.seq, 4294967295)) { return null; }
        var index = detailNumber(menu.index, ids.length - 1);
        if (index == null) { return null; }
        var goods;
        try { goods = baye.hd && typeof baye.hd.goods === 'function' ? baye.hd.goods() : null; } catch (e) { return null; }
        if (!goods || detailFlag(goods.active) !== true || detailFlag(goods.complete) == null ||
            detailFlag(goods.custom) == null || goods.generation !== owner.detailGeneration ||
            goods.detailGeneration !== owner.detailGeneration || goods.menuSeq !== owner.seq ||
            goods.index !== index || goods.tool !== ids[index] ||
            detailNumber(goods.propertyCount, 255) == null || detailNumber(goods.pageStart, goods.propertyCount) == null ||
            detailNumber(goods.pageEnd, goods.propertyCount) == null || goods.pageEnd < goods.pageStart ||
            typeof goods.name !== 'string' || !Array.isArray(goods.properties) ||
            goods.properties.length !== goods.propertyCount) { return null; }
        var properties = [];
        for (var p = 0; p < goods.propertyCount; p++) {
            var property = goods.properties[p];
            if (!property || property.index !== p || typeof property.captured !== 'boolean' ||
                typeof property.title !== 'string' || typeof property.value !== 'string') { return null; }
            properties.push({ index: p, title: property.title, value: property.value, captured: property.captured });
        }
        if (detailFlag(goods.complete) && !properties.every(function (property) { return property.captured; })) { return null; }
        var pageOwnerKey = JSON.stringify([owner.key, index, goods.tool, goods.generation,
            goods.propertyCount, goods.pageStart, goods.pageEnd, state.toolPaneEpoch]);
        var snapshotKey = JSON.stringify([pageOwnerKey, goods.name, goods.complete, goods.custom, properties]);
        // A bridge getter or an actual Mod accessor can retire the menu while
        // it is read. Recheck the live owner before using any captured data.
        var after = engineMenuItems(), afterOwner = deepMenuOwner(after);
        if (!afterOwner || afterOwner.key !== owner.key || after.index !== index || detailOverlayActive()) { return null; }
        return { owner: owner, index: index, tool: goods.tool, generation: goods.generation,
            nativeComplete: detailFlag(goods.complete), custom: detailFlag(goods.custom),
            propertyCount: goods.propertyCount, pageStart: goods.pageStart, pageEnd: goods.pageEnd,
            name: goods.name || menu.names[index], properties: properties,
            pageOwnerKey: pageOwnerKey, snapshotKey: snapshotKey };
    }

    function ensureToolDetailsPane() {
        if (!ensurePersonDetailsPane()) { return null; }
        var pane = el('hd-city-menu-tool-details');
        if (!pane) {
            pane = document.createElement('aside');
            pane.id = 'hd-city-menu-tool-details';
            pane.className = 'hd-city-menu-tool-details';
            pane.setAttribute('aria-label', '当前道具资料');
            pane.hidden = true;
            el('hd-city-menu-person-layout').appendChild(pane);
            var fields = document.createElement('div');
            fields.id = 'hd-city-menu-tool-fields';
            fields.className = 'hd-city-menu-tool-fields';
            pane.appendChild(fields);
            var controls = document.createElement('div');
            controls.id = 'hd-city-menu-tool-controls';
            controls.className = 'hd-city-menu-tool-controls';
            ['prev', 'next'].forEach(function (direction) {
                var button = document.createElement('button');
                button.type = 'button';
                button.className = 'hd-city-menu-item';
                button.setAttribute('data-hd-tool-page', direction);
                button.textContent = direction === 'prev' ? '上一属性页' : '下一属性页';
                controls.appendChild(button);
            });
            pane.appendChild(controls);
        }
        return pane;
    }

    function standardToolProperties(context) {
        if (context.custom || context.propertyCount !== 5 ||
            !standardHudLabels(['getToolPropertyTitle', 'getToolPropertyValue'])) { return null; }
        var tool;
        try { tool = baye.hd && typeof baye.hd.toolDetails === 'function' ? baye.hd.toolDetails(context.tool) : null; }
        catch (e) { return null; }
        if (!tool || tool.standard !== true || tool.index !== context.tool || tool.generation !== context.generation ||
            ['attack', 'iq', 'move', 'arm'].some(function (key) { return detailNumber(tool[key], 255) == null; }) ||
            detailNumber(tool.useFlag, 1) == null) { return null; }
        var arms = ['骑兵', '步兵', '弓箭兵', '水军', '极兵', '玄兵'];
        var arm = tool.arm === 0 ? '无' : tool.arm === 1 ? '水军' : tool.arm === 2 ? '玄兵' :
            tool.arm === 3 ? '极兵' : arms[tool.arm - 4] || '原始码 ' + tool.arm;
        var properties = [ ['用法', tool.useFlag ? '使用' : '装备'], ['武力加成', String(tool.attack)],
            ['智力加成', String(tool.iq)], ['移动加成', String(tool.move)], ['兵种变化', arm] ];
        var rangeFlag = detailNumber(tool.changeAttackRange, 255);
        if (rangeFlag != null) { properties.rangeFlag = rangeFlag; }
        return properties;
    }

    function renderToolDetails() {
        var context = liveToolContext();
        if (!context) { retireToolDetails(); return; }
        var defaults = standardToolProperties(context);
        var after = liveToolContext();
        if (!after || after.snapshotKey !== context.snapshotKey) { retireToolDetails(); return; }
        if (state.toolPagePending && state.toolPagePending !== context.pageOwnerKey) { state.toolPagePending = null; }
        var properties = context.properties.map(function (property, index) {
            var fallback = defaults && defaults[index];
            return { index: index, captured: property.captured,
                read: property.captured || !!fallback,
                title: property.captured ? property.title || '属性 ' + (index + 1) + '（标题为空）'
                    : fallback ? fallback[0] : '属性 ' + (index + 1),
                value: property.captured ? property.value || '（空）' : fallback ? fallback[1] : '未读取' };
        });
        var complete = properties.every(function (property) { return property.read; });
        var groups = [{ title: '道具属性', rows: properties.map(function (property) { return [property.title, property.value]; }) }];
        if (defaults && defaults.rangeFlag != null) {
            groups.push({ title: '附加属性', rows: [ ['改变攻击范围标志',
                (defaults.rangeFlag ? '改变' : '不改变') + '（码 ' + defaults.rangeFlag + '）'] ] });
        }
        var detail = { ownerKey: context.owner.key, context: 1, kind: 4, seq: context.owner.seq,
            nativeIndex: context.index, toolIndex: context.tool, generation: context.generation,
            detailGeneration: context.generation, name: context.name, complete: complete,
            nativeComplete: context.nativeComplete, custom: context.custom, propertyCount: context.propertyCount,
            pageStart: context.pageStart, pageEnd: context.pageEnd, properties: properties, groups: groups,
            source: defaults && !context.nativeComplete ? 'standard-raw' : 'native-capture', pageOwnerKey: context.pageOwnerKey };
        var signature = JSON.stringify(detail), pane = ensureToolDetailsPane();
        if (!pane) { return; }
        retirePersonDetails();
        pane.hidden = false;
        el('hd-city-menu-person-layout').classList.add('has-tool-details');
        state.toolDetail = detail;
        var fields = el('hd-city-menu-tool-fields');
        if (state.toolDetailSig !== signature || !fields.children.length) {
            state.toolDetailSig = signature;
            fields.innerHTML = '';
            var heading = document.createElement('h2');
            heading.id = 'hd-city-menu-tool-name';
            heading.className = 'hd-city-menu-tool-name';
            heading.textContent = detail.name;
            fields.appendChild(heading);
            appendHudGroups(fields, groups);
            var note = document.createElement('p');
            note.className = 'hd-city-menu-info-note';
            var captured = properties.filter(function (property) { return property.captured; }).length;
            note.textContent = !context.propertyCount ? '原生菜单没有道具属性。' : defaults
                ? '已从当前标准资源读取完整属性；原生已显示 ' + captured + ' / ' + context.propertyCount + ' 项。'
                : '原生已显示 ' + captured + ' / ' + context.propertyCount + ' 项。' +
                    (complete ? '' : '未读取的属性可用下方按钮手动翻页。');
            if (defaults && defaults.rangeFlag != null) { note.textContent += '实际攻击范围以战场为准。'; }
            fields.appendChild(note);
        }
        var buttons = el('hd-city-menu-tool-controls').querySelectorAll('[data-hd-tool-page]');
        for (var i = 0; i < buttons.length; i++) {
            var previous = buttons[i].getAttribute('data-hd-tool-page') === 'prev';
            buttons[i].setAttribute('data-hd-tool-page-owner', context.pageOwnerKey);
            buttons[i].disabled = !!state.toolPagePending || (previous ? context.pageStart === 0 :
                context.pageEnd <= context.pageStart || context.pageEnd >= context.propertyCount);
        }
    }

    function pageTool(direction, expectedOwner) {
        var context = liveToolContext();
        if (!context || expectedOwner !== context.pageOwnerKey || state.toolPagePending ||
            direction !== 'prev' && direction !== 'next' ||
            direction === 'prev' && context.pageStart === 0 ||
            direction === 'next' && (context.pageEnd <= context.pageStart || context.pageEnd >= context.propertyCount)) {
            renderToolDetails();
            return false;
        }
        // One deliberate click sends one native page key. The real menu must
        // acknowledge a different page before another click can send a key.
        state.toolPagePending = context.pageOwnerKey;
        var sent = engineSendKey(direction === 'prev' ? VK.LEFT : VK.RIGHT, 'goods-property-page', function () {
            var current = liveToolContext();
            return current && current.pageOwnerKey === context.pageOwnerKey && current.snapshotKey === context.snapshotKey;
        });
        if (!sent) { state.toolPagePending = null; }
        renderToolDetails();
        return sent;
    }

    function applyHighlight() {
        if (state.open && state.layer === 'deep' && !document.hidden && shouldShowHd() && state.deepMenuOwner) {
            var nativeMenu = engineMenuItems();
            var nativeOwner = deepMenuOwner(nativeMenu);
            var nativeIndex = hudNumber(nativeMenu, 'index');
            if (nativeOwner && nativeOwner.key === state.deepMenuOwner.key && nativeIndex != null &&
                nativeIndex < nativeMenu.names.length) {
                state.idleIndex = nativeIndex;
            }
        }
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
            var item = state.deepItems[di];
            var on;
            if (state.layer === 'deep' && item && item.cityIndex != null) {
                on = state.pendingTarget === item.cityIndex;
            } else {
                on = state.layer === 'deep' && state.idleIndex === di;
            }
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
        var scrollKey = JSON.stringify([state.layer, state.subKind, state.deepKind,
            state.deepMenuOwner && state.deepMenuOwner.key, state.idleIndex, state.pendingTarget]);
        if (idleNode && idleNode.scrollIntoView && state.highlightScrollKey !== scrollKey) {
            try {
                idleNode.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (e) {
                idleNode.scrollIntoView(false);
            }
        }
        state.highlightScrollKey = scrollKey;
        renderPersonDetails();
        renderToolDetails();
    }

    function fillDeepList() {
        var list = el('hd-city-menu-deep');
        if (!list) {
            return;
        }
        var deepMenu = engineMenuItems();
        var owner = readyDeepMenuOwner(deepMenu);
        state.deepMenuOwner = owner;
        state.deepItems = probeDeepItems();
        if (!owner || owner.kind !== 3 || !state.deepItems.length || showingQty()) { retirePersonDetails(); }
        if (!owner || owner.kind !== 4 || !state.deepItems.length || showingQty()) { retireToolDetails(); }
        applyDocAttr();
        var liveQty = engineQty();
        var march = engineMarch();
        var sig = (showingQty() ? 'qty:' + (liveQty && liveQty.value) : state.deepKind + ':' + state.deepStep) +
            ':' + (state.pickedPersons || 0) +
            ':' + (mapPickActive() ? 'pick' : '') +
            ':' + ((freshMarchOk() || state.marchReady || state.handoff) ? 'ok' : '') +
            ':' + (state.handoff ? ('h:' + (state.handoffStatus || '')) : '') +
            ':' + (state.personExitSent ? 'pex' : '') +
            ':' + (state.acceptMarchOk ? 'acc' : '') +
            ':' + (state.wizardStep || '') +
            ':' + displayWizardStep() +
            ':' + engineMarchPhase() +
            ':' + (currentMarch() ? marchInputKey(currentMarch()) : '') +
            ':' + (engineInGetCitySet() ? 'gcs' : '') +
            ':' + (state.marchHint || '') +
            ':' + (state.pendingTarget == null ? '' : state.pendingTarget) +
            ':' + (owner ? owner.key : '') +
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
            var shownStep = displayWizardStep();
            var qtySteps = document.createElement('div');
            qtySteps.className = 'hd-city-menu-wizard';
            qtySteps.setAttribute('data-hd-wizard', shownStep);
            qtySteps.setAttribute('data-hd-engine-phase', engineMarchPhase());
            var wizardKeys = ['persons', 'food', 'target-tip', 'map-pick', 'march-ok'];
            var wizardBits = [];
            var wi;
            for (wi = 0; wi < wizardKeys.length; wi++) {
                var wKey = wizardKeys[wi];
                wizardBits.push('<span class="hd-city-menu-wizard-step' +
                    (wKey === shownStep ? ' is-current' : '') +
                    '" data-hd-wizard-step="' + wKey + '">' +
                    WIZARD_LABEL[wKey] + '</span>');
            }
            qtySteps.innerHTML = wizardBits.join('<span class="hd-city-menu-wizard-sep">→</span>') +
                (shownStep === 'persons' ? '<span class="hd-city-menu-wizard-extra">已点 ' +
                    (state.pickedPersons || 0) + ' 人</span>' : '') +
                (global.BAYE_HD_DEBUG ? '<span class="hd-city-menu-wizard-debug" data-hd-march-debug="1">' +
                    marchDebugLine() + '</span>' : '');
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
            bar.innerHTML = '<p>' + (state.battleMake ? '随军粮草' : '数量') + ' <strong id="hd-city-qty-val">' +
                (q.value !== '' && q.value != null ? q.value : '—') +
                '</strong> · 可用按钮或数字键调整</p>' +
                (state.qtyAckFailed ? '<p>数量调整未完成，请取消后重新输入。</p>' : '') +
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
        var showMarchOk = (state.marchReady || freshMarchOk() || state.handoff) &&
            (state.deepKind === 'person-city' || state.deepLabel === '出征' || state.handoff);
        if (showMarchOk) {
            var done = document.createElement('div');
            done.className = 'hd-city-menu-march-ok' + (state.handoff ? ' is-handoff' : '');
            done.setAttribute('data-hd-march-ok', '1');
            if (state.handoff) {
                done.setAttribute('data-hd-handoff', '1');
            }
            var status = state.handoff
                ? (state.handoffStatus || '正在退出城池…')
                : '结束本月策略后，部队开始行军。';
            var statusEl = document.createElement('p');
            statusEl.className = 'hd-city-menu-handoff-status';
            statusEl.setAttribute('data-hd-handoff-status', state.handoff ? '1' : '0');
            statusEl.textContent = status;
            var titleEl = document.createElement('p');
            titleEl.textContent = '部队已出发';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('data-hd-strategy-end', '');
            btn.textContent = state.handoff ? '进行中' : '策略结束';
            done.appendChild(titleEl);
            done.appendChild(statusEl);
            done.appendChild(btn);
            list.appendChild(done);
            applyHighlight();
            return;
        } else if (state.marchHint) {
            var warn = document.createElement('div');
            warn.className = 'hd-city-menu-march-hint';
            warn.setAttribute('data-hd-march-hint', '1');
            var warnText = document.createElement('p');
            warnText.textContent = state.marchHint;
            var dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.setAttribute('data-hd-dismiss-march', '');
            dismiss.textContent = '知道了';
            warn.appendChild(warnText);
            warn.appendChild(dismiss);
            list.appendChild(warn);
        }
        var liveMarch = currentMarch();
        if (liveMarch && [MARCH.TARGET_TIP, MARCH.REJECT, MARCH.ARMOUT].indexOf(Number(liveMarch.phase)) >= 0) {
            var cont = document.createElement('button');
            cont.type = 'button';
            cont.setAttribute('data-hd-march-continue', '');
            cont.setAttribute('data-hd-march-session', liveMarch.session);
            cont.setAttribute('data-hd-march-input-seq', liveMarch.inputSeq);
            cont.disabled = state.marchContinueKey === marchInputKey(liveMarch);
            cont.textContent = Number(liveMarch.phase) === MARCH.ARMOUT ? '确认部队出发'
                : Number(liveMarch.phase) === MARCH.REJECT ? '确认提示 · 重选目标' : '选择目标城';
            list.appendChild(cont);
        }
        if (!showMarchOk && state.deepKind === 'person-city' &&
            !(mapPickActive() && !leftoverOverworldPick()) &&
            !state.personExitSent && state.wizardStep === 'persons') {
            var fin = document.createElement('div');
            fin.className = 'hd-city-menu-finish-persons';
            fin.innerHTML = '<p>已点将 ' + (state.pickedPersons || 0) +
                ' 人 · 完成后选择随军粮草和目标城</p>' +
                '<button type="button" data-hd-finish-persons>完成选将 · 选粮出发</button>';
            list.appendChild(fin);
        }
        if (usesMapCursor(state.deepKind, state.deepStep)) {
            var hint = document.createElement('div');
            hint.className = 'hd-city-menu-map-hint';
            var hasEnemy = state.deepItems.some(function (it) { return it && it.enemy; });
            hint.textContent = hasEnemy
                ? '先选择敌方邻城，再点击「确认出征」。'
                : '邻城都是己方。请选择其他出发城。';
            list.appendChild(hint);
            if (!showMarchOk) {
                var confirm = document.createElement('div');
                confirm.className = 'hd-city-menu-confirm-march';
                var tName = '';
                if (state.pendingTarget != null) {
                    tName = cityName(state.pendingTarget) || ('城' + (state.pendingTarget + 1));
                }
                confirm.innerHTML = '<p>' + (tName
                    ? ('已选择 ' + tName)
                    : '先点邻城或地图目标，再可按确认出征') + '</p>' +
                    '<button type="button" data-hd-confirm-march' +
                    (state.pendingTarget == null ? ' disabled' : '') + '>' +
                    (tName ? ('确认出征 · ' + tName) : '确认出征') + '</button>';
                list.appendChild(confirm);
                var cancel = document.createElement('button');
                cancel.type = 'button';
                cancel.setAttribute('data-hd-march-cancel', '');
                cancel.textContent = '取消出征';
                list.appendChild(cancel);
            }
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
            if (owner) {
                btn.setAttribute('data-hd-deep-owner', owner.key);
                btn.setAttribute('data-hd-menu-context', String(owner.context));
                btn.setAttribute('data-hd-menu-kind', String(owner.kind));
                btn.setAttribute('data-hd-menu-seq', String(owner.seq));
                btn.setAttribute('data-hd-deep-name', it.name);
                if (it.pind != null) { btn.setAttribute('data-hd-deep-pind', String(it.pind)); }
                if (it.toolIndex != null) { btn.setAttribute('data-hd-deep-tool', String(it.toolIndex)); }
            }
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

    function renderStickyBannerSlot() {
        var stage = document.querySelector('#hd-city-menu .hd-city-menu-stage');
        if (!stage) {
            return;
        }
        var existing = el('hd-city-menu-banner');
        var showMarchOk = !!(state.marchReady || freshMarchOk() || state.handoff);
        var showSlot = !!(state.open && shouldShowHd() && stickyMarchBanner() &&
            !showMarchOk && state.layer !== 'deep');
        if (!showSlot) {
            if (existing) {
                existing.parentNode.removeChild(existing);
            }
            return;
        }
        if (!existing) {
            existing = document.createElement('div');
            existing.id = 'hd-city-menu-banner';
            existing.className = 'hd-city-menu-march-hint';
            existing.setAttribute('data-hd-march-hint', '1');
            var after = el('hd-city-menu-sub');
            if (after && after.parentNode === stage) {
                if (after.nextSibling) {
                    stage.insertBefore(existing, after.nextSibling);
                } else {
                    stage.appendChild(existing);
                }
            } else {
                stage.insertBefore(existing, stage.firstChild);
            }
        }
        existing.innerHTML = '';
        var warnText = document.createElement('p');
        warnText.textContent = state.marchHint;
        var dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.setAttribute('data-hd-dismiss-march', '');
        dismiss.textContent = '知道了';
        existing.appendChild(warnText);
        existing.appendChild(dismiss);
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
            retirePersonDetails();
            retireToolDetails();
            renderStickyBannerSlot();
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
        if (probe) { probe.hidden = !global.BAYE_HD_DEBUG; }
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
        renderStickyBannerSlot();
        if (state.layer === 'root') {
            setText(sub, '选择城池指令');
            hideAllLayers();
            if (grid) {
                grid.hidden = false;
                applyRootLabels();
            }
        } else if (state.layer === 'status') {
            setText(sub, '状况 · 归属、发展与资源军备');
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
                        : (usesGoodsMenu(state.deepKind, state.deepStep) ? '道具' : '人物')));
            if (state.wizardStep !== 'none' && WIZARD_LABEL[state.wizardStep]) {
                var shownHint = displayWizardStep();
                stepHint = '出征步骤 ' + (WIZARD_LABEL[shownHint] || WIZARD_LABEL[state.wizardStep]);
                if (!engineInGetCitySet() && (shownHint === 'map-pick' || state.wizardStep === 'map-pick')) {
                    stepHint += ' · 等待目标选择';
                }
            }
            setText(sub, (state.deepLabel || '深层') + ' · ' + stepHint +
                (state.showLcd ? ' · 经典 LCD 对照' : ' · 光标与引擎同步'));
            hideAllLayers();
            if (deep) {
                deep.hidden = false;
                fillDeepList();
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
            invalidateQtyWork();
            state.layer = 'root';
            state.subKind = '';
            state.deepKind = '';
            state.deepLabel = '';
            state.deepItems = [];
            state.idleIndex = 0;
        }
        return switched;
    }

    function liveFightBlocksCityOpen() {
        return fightIsActive();
    }

    function openMenu(meta) {
        meta = meta || {};
        var nativeMenu = engineMenuItems();
        if (nativeMenu.active != null) {
            var actualCity = engineMapCityIndex();
            if (!Number(nativeMenu.active) || Number(nativeMenu.context) !== 1 ||
                Number(nativeMenu.kind) !== 1 ||
                !isFinite(actualCity) || actualCity < 0 ||
                meta.cityIndex != null && Number(meta.cityIndex) !== actualCity) {
                return false;
            }
            meta.cityIndex = actualCity;
            meta.cityName = cityName(actualCity);
        }
        if (liveFightBlocksCityOpen()) {
            console.warn('[hd-city-menu] skip open during fight', {
                city: (meta && meta.cityName) || state.cityName,
                index: (meta && meta.cityIndex != null) ? meta.cityIndex : state.cityIndex
            });
            return false;
        }
        if (!shouldShowHd()) {
            return false;
        }
        bindOpenedCity(meta);
        state.lastHook = meta.hook || state.lastHook;
        if (state.open) {
            clearStaleMapPick('reopen-city');
            render();
            return true;
        }
        state.listKind = '';
        state.open = true;
        state.layer = 'root';
        state.subKind = '';
        state.showLcd = false;
        invalidateQtyWork();
        state.qtyInputClosed = false;
        state.queue = [];
        state.qtyCommitQueued = false;
        state.activeQueueReason = '';
        state.cityName = state.cityName || cityName(state.cityIndex);
        /* 征兵 leftover g_hdQtyActive 进下一次城菜单时必须清掉。 */
        if (engineQty() && engineQty().active && !state.battleMake) {
            state.qtyDismissed = true;
            clearLeftoverQtyFlag();
        }
        /* 开垦/过图 leftover pick=1 必须在点军备之前写掉，否则 ENTER 会确认过图而不是进军备。 */
        bindOpenedMapCity(state.cityIndex, 'open-city');
        clearStaleMapPick('open-city');
        sweepStickyMarch('open-city');
        unstickMenuLoop('open-city');
        leaveLeftoverPolicyPerson('open-city');
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
        if (fightIsActive()) {
            invalidateMarchWork();
            invalidateQtyWork();
            state.open = false;
            state.queue = [];
            state.sending = false;
            state.qtyCommitQueued = false;
            state.activeQueueReason = '';
            applyDocAttr();
            render();
            console.warn('[hd-city-menu] hide leftover city menu during fight, no leaveMenu EXIT');
            return;
        }
        if (holdMenu() && !opts.force) {
            state.lastBlockedExit = state.marchReady ? 'closeMenu-march-ok' : 'closeMenu-hold';
            console.warn('[hd-city-menu] blocked closeMenu', state.lastBlockedExit);
            if (!opts.silent && liveMarchOrFight()) {
                state.marchHint = marchHintForHold().replace('不要返回', '不要关菜单');
                logMarchBanner('hold-show', 'closeMenu');
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
        invalidateMarchWork();
        invalidateQtyWork();
        state.open = false;
        state.layer = 'root';
        state.queue = [];
        state.sending = false;
        state.qtyCommitQueued = false;
        state.activeQueueReason = '';
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
            state.sawGetFoodUi = false;
            state.foodConfirmedThisMarch = false;
        }
        render();
        if (!opts.silent && global.BayeHdOverworld &&
            typeof BayeHdOverworld.leaveMenu === 'function') {
            BayeHdOverworld.leaveMenu('已回到 HD 大地图。');
        }
    }

    function cityBackMenuOwner() {
        try {
            function readOwner() {
                var menu = engineMenuItems();
                if (!menu || menu.active !== 1 || menu.context !== 1 ||
                    detailNumber(menu.seq, 4294967295) == null || !menu.seq ||
                    detailNumber(menu.kind, 4) == null || !menu.kind) { return null; }
                return JSON.stringify([marchEpoch, menu.context, menu.kind, menu.seq,
                    detailNumber(menu.detailGeneration, 4294967295), menu.names, actualMenuIds(menu)]);
            }
            var owner = readOwner(), hd = window.baye && baye.hd;
            if (!owner || !state.open || !shouldShowHd() || !hd) { return null; }
            // Reports and HELP can take input without clearing the underlying menu.
            var readers = [hd.report, hd.help, hd.qty];
            for (var i = 0; i < readers.length; i++) {
                if (typeof readers[i] !== 'function') { return null; }
                var info = readers[i].call(hd);
                if (!info || info.active !== 0) { return null; }
            }
            var overlays = [global.BayeHdDialog, global.BayeHdSystemUi, global.BayeHdMiniMap,
                global.BayeHdBattle, global.BayeHdSpe];
            for (i = 0; i < overlays.length; i++) {
                if (overlays[i] && (typeof overlays[i].isOpen !== 'function' || overlays[i].isOpen() !== false)) {
                    return null;
                }
            }
            return owner === readOwner() ? owner : null;
        } catch (e) { return null; }
    }

    function cityBackPressOwner() {
        try {
            var menu = engineMenuItems(), qty = engineQty(), march = engineMarch();
            return JSON.stringify([marchEpoch, state.open, state.cityIndex, state.layer, state.deepKind,
                menu.active, menu.context, menu.kind, menu.seq, menu.detailGeneration, menu.names, actualMenuIds(menu),
                qty && qty.active, qty && qty.session, qty && qty.generation,
                march && march.phase, march && march.session, march && march.mapInputSeq,
                window.baye && baye.data && baye.data.g_hdDetailGeneration]);
        } catch (e) { return null; }
    }

    function retiredCityMapOwner() {
        if (state.queue.length || state.sending || state.handoff || state.confirmingTarget || state.nativeMenuRequest) {
            return false;
        }
        try {
            function readOwner() {
                var d = window.baye && baye.data;
                if (!d) { return null; }
                var generation = detailNumber(d.g_hdDetailGeneration, 4294967295),
                    inputSeq = detailNumber(d.g_hdMapInputSeq, 4294967295),
                    menuSeq = detailNumber(d.g_hdMenuSeq, 4294967295),
                    mapCity = detailNumber(d.g_hdMapCity, 255);
                if (!generation || !inputSeq || menuSeq == null || mapCity == null ||
                    d.g_hdMapPick !== 1 || d.g_hdBattlePick !== 0 || d.g_hdMarchPhase !== MARCH.IDLE ||
                    d.g_hdMenuActive !== 0 || d.g_hdQtyActive !== 0 || d.g_hdReportActive !== 0 ||
                    d.g_hdHelpActive !== 0 || d.g_hdFightActive !== 0 || d.g_asyncActionID !== 0) { return null; }
                // A late getter may enter a new menu while this snapshot is read.
                if (d.g_hdDetailGeneration !== generation || d.g_hdMapInputSeq !== inputSeq ||
                    d.g_hdMenuSeq !== menuSeq || d.g_hdMapCity !== mapCity || d.g_hdMenuActive !== 0) {
                    return null;
                }
                return JSON.stringify([generation, inputSeq, menuSeq, mapCity]);
            }
            var before = readOwner();
            if (!before) { return false; }
            var overlays = [global.BayeHdDialog, global.BayeHdSystemUi, global.BayeHdMiniMap,
                global.BayeHdBattle, global.BayeHdSpe];
            for (var i = 0; i < overlays.length; i++) {
                if (overlays[i] && (typeof overlays[i].isOpen !== 'function' || overlays[i].isOpen() !== false)) {
                    return false;
                }
            }
            return before === readOwner() && !state.queue.length && !state.sending &&
                !state.handoff && !state.confirmingTarget && !state.nativeMenuRequest;
        } catch (e) { return false; }
    }

    function back(pressedOwner) {
        if (!state.open) {
            return;
        }
        var actionOwner = cityBackPressOwner();
        if (!actionOwner || pressedOwner != null && pressedOwner !== actionOwner) { return; }
        // A command can already have unwound through PlayerTactic into the map.
        // Closing its leftover pane must not send GetCitySet a second EXIT.
        var retiredMap = retiredCityMapOwner();
        if (actionOwner !== cityBackPressOwner()) { return; }
        if (retiredMap) {
            closeMenu({ silent: true });
            return;
        }
        if (state.layer === 'status') {
            // Status is a local read-only page: C is still waiting in the
            // root menu. EXIT here would close that real menu behind the shell.
            var menu = engineMenuItems();
            state.layer = 'root';
            state.subKind = '';
            state.closingSub = false;
            state.idleIndex = Number(menu.active) && Number(menu.context) === 1 && Number(menu.kind) === 1
                ? hudNumber(menu, 'index') : null;
            render();
            return;
        }
        if (liveQty() || leftoverQtyFlag()) {
            cancelQty();
            return;
        }
        if (holdMenu()) {
            /* 活出征向导期间 HD「返回」绝不 EXIT。 */
            if (liveMarchOrFight() && !state.marchReady) {
                state.marchHint = marchHintForHold();
                logMarchBanner('hold-show', 'back');
            }
            render();
            return;
        }
        if (actionOwner !== cityBackPressOwner()) { return; }
        var backOwner = cityBackMenuOwner();
        var observedMenu = engineMenuItems();
        if (actionOwner !== cityBackPressOwner()) { return; }
        if (observedMenu.active != null && !backOwner) { return; }
        var ownsBack = backOwner == null ? null : function () { return cityBackMenuOwner() === backOwner; };
        if (state.layer === 'deep') {
            if (engineInGetCitySet() || (state.campaignPick && mapPickActive())) {
                closeMenu({ silent: true });
                return;
            }
            if (/选择目标/.test(reportText()) && !engineInGetCitySet()) {
                unstickMenuLoop('back-deep');
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
            enqueueKeys([VK.EXIT], 60, 'back-deep', ownsBack);
            render();
            return;
        }
        if (state.layer !== 'root') {
            state.closingSub = true;
            state.layer = 'root';
            state.subKind = '';
            state.idleIndex = null;
            enqueueKeys([VK.EXIT], 60, 'back-sub', ownsBack);
            render();
            return;
        }
        closeMenu({ silent: false });
    }

    function chooseRoot(index) {
        var menu = engineMenuItems();
        if (menu.active != null && (!Number(menu.active) || Number(menu.context) !== 1 ||
            Number(menu.kind) !== 1 || engineMapCityIndex() !== state.cityIndex)) {
            return;
        }
        if (index < 0 || index >= ROOTS.length) {
            return;
        }
        var root = ROOTS[index];
        if (menu.active != null) {
            if (state.rootMenuPending) { return; }
            if (root.id === 'zhuangkuang') {
                state.layer = 'status';
                state.subKind = root.id;
                render();
                return;
            }
            state.rootMenuPending = true;
            var epoch = marchEpoch;
            var startSeq = Number(menu.seq);
            var checks = 0;
            if (!selectLiveMenu(index, true, 'city-root', menu)) {
                state.rootMenuPending = false;
                return;
            }
            function waitSubmenu() {
                if (epoch !== marchEpoch || !shouldShowHd() || !state.open) { return; }
                var live = engineMenuItems();
                if (Number(live.active) && Number(live.context) === 1 &&
                    Number(live.kind) === 2 && Number(live.seq) !== startSeq &&
                    engineMapCityIndex() === state.cityIndex) {
                    state.rootMenuPending = false;
                    state.layer = 'sub';
                    state.subKind = root.id;
                    state.idleIndex = Number(live.index);
                    render();
                    return;
                }
                if (++checks > 200) {
                    state.rootMenuPending = false;
                    state.marchHint = '菜单尚未打开，请重新选择指令。';
                    render();
                    return;
                }
                setTimeout(waitSubmenu, 40);
            }
            waitSubmenu();
            render();
            return;
        }
        /* 开垦数月后 leftover pick 还在：先回本城，再发军备/内政 ENTER。 */
        bindOpenedMapCity(state.cityIndex, 'choose-root');
        sweepStickyMarch('choose-root');
        unstickMenuLoop('choose-root');
        var enthron = liveEngineReport();
        if (/拥立|成为君主/.test(enthron || '')) {
            engineSendKey(VK.ENTER, 'choose-root-enthron');
        }
        if ((root.id === 'junbei' || root.id === 'neizheng') &&
            leftoverOverworldPick()) {
            landOwnedCity('choose-root-' + root.id, function () {
                chooseRootAfterLand(index);
            });
            return;
        }
        chooseRootAfterLand(index);
    }

    function chooseRootAfterLand(index) {
        var root = ROOTS[index];
        clearStaleMapPick('choose-root');
        var leftoverSub = leftoverEngineSubAtHdRoot();
        if (leftoverDisasterReport(liveEngineReport()) && liveReportAsync()) {
            engineSendKey(VK.ENTER, 'dismiss-live-disaster');
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
        }
        if ((liveFunctionMenu() || looksLikeFunctionMenu()) && !state.handoff &&
            !state.marchReady && !engineInGetCitySet()) {
            engineSendKey(VK.EXIT, 'choose-root-leave-func');
        }
        if (root.id === 'zhuangkuang') {
            state.layer = 'status';
            state.subKind = root.id;
            render();
            return;
        }
        if (leftoverSub === root.id) {
            /* 引擎已在该层（过月后常见 leftover 开垦），再 ENTER 会点开第一项。 */
            state.layer = 'sub';
            state.subKind = root.id;
            state.idleIndex = 0;
            render();
            return;
        }
        if (leftoverSub === 'person') {
            enqueueKeys([VK.EXIT, VK.EXIT], 70, 'leave-leftover-person');
            state.idleIndex = 0;
        } else if (leftoverSub) {
            enqueueKeys([VK.EXIT], 70, 'leave-leftover-sub');
            state.idleIndex = 0;
        }
        pickIndex(index, true);
        state.layer = 'sub';
        state.subKind = root.id;
        state.idleIndex = 0;
        render();
    }

    function chooseSub(index) {
        var menu = engineMenuItems();
        if (menu.active != null && (!Number(menu.active) || Number(menu.context) !== 1 ||
            Number(menu.kind) !== 2 || engineMapCityIndex() !== state.cityIndex)) {
            return;
        }
        var names = preferEngineNames(SUBS[state.subKind] || []);
        var willMarch = deepKindFor(state.subKind, index) === 'person-city' || names[index] === '出征';
        if (willMarch) {
            invalidateMarchWork();
            state.marchSession = 0;
            state.marchBaselineSeq = marchSeqOf(engineMarch());
            state.marchContinueKey = '';
            state.marchTargetInputKey = '';
            state.marchSubmittedTarget = null;
            state.marchFoodCommitSent = false;
            state.marchCancelKey = '';
            state.marchPersonExpected = 0;
            var epoch = marchEpoch;
            var used = {};
            var polls = 0;
            function sendMarchKeys() {
                if (epoch !== marchEpoch || !shouldShowHd()) { return; }
                var m = bindMarchSession();
                if (m && Number(m.phase) === MARCH.PERSONS) {
                    state.marchHint = '请选择将领，再点击「完成选将」。';
                    render();
                    return;
                }
                var menu = engineMenuItems();
                if (++polls > 100) {
                    state.marchHint = '引擎尚未打开选将，请检查当前菜单后重新选择出征。';
                    render();
                    return;
                }
                if (Number(menu.active) && Number(menu.context) === 1 &&
                    !state.queue.length && !state.sending && !used[String(menu.seq)]) {
                    var target = -1;
                    if (Number(menu.kind) === 1) { target = (menu.names || []).indexOf('军备'); }
                    else if (Number(menu.kind) === 2) { target = (menu.names || []).indexOf('出征'); }
                    if (target >= 0) {
                        used[String(menu.seq)] = true;
                        selectLiveMenu(target, true, 'march-start', menu);
                    }
                }
                setTimeout(sendMarchKeys, 80);
            }
            setTimeout(sendMarchKeys, 0);
        } else {
            if (!pickIndex(index, true)) { return; }
        }
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
        state.marchStrategyOrder = null;
        state.personExitSent = false;
        state.finishPersonsBusy = false;
        state.personExitTries = 0;
        state.lastPersonExitAt = 0;
        state.lastPickEnterAt = 0;
        state.enginePersonsAtFinish = 0;
        state.enginePersonsAtPickStart = 0;
        state.engineHelpOpen = false;
        state.overlayRetry = 0;
        state.finishVisibleRetry = 0;
        state.pickedPersonNames = [];
        state.qtyBeforePersonExit = qtySnapshot();
        state.foodRecovered = false;
        state.foodRecoverEnter = false;
        state.foodRecoverNeeded = false;
        state.foodGaveUp = false;
        state.foodAttempt = 0;
        stopMarchWatch();
        state.lastTipEnterAt = 0;
        state.sawFightThisMarch = false;
        state.fightEndedThisMarch = false;
        state.wizardStep = (state.deepKind === 'person-city' || state.deepLabel === '出征') ? 'persons' : 'none';
        state.sawQtyThisMarch = false;
        state.sawGetFoodUi = false;
        state.foodConfirmedThisMarch = false;
        invalidateQtyWork();
        state.qtyInputClosed = false;
        state.qtyDismissed = false;
        state.qtyDismissedAt = 0;
        state.reportAtMarchStart = liveEngineReport();
        state.lastFuncMenuIdle = 0;
        state.lastWalkCity = null;
        state.lastWalkAt = 0;
        state.walkBusy = false;
        if (state.keepPendingTarget != null) {
            state.pendingTarget = Number(state.keepPendingTarget);
            state.keepPendingTarget = null;
        } else {
            state.pendingTarget = null;
            state.originRetryTried = false;
            state.originRetryBusy = false;
            state.originRetryFrom = null;
            state.originRetryTo = null;
            state.marchOriginIndex = state.cityIndex;
        }
        state.confirmToken += 1;
        state.step4Trace = [];
        state.lastStep4 = null;
        state.acceptMarchOk = false;
        state.sawMarchCleared = false;
        state.confirmingTarget = false;
        state.lastBlockedExit = '';
        state.lastExit = '';
        state.marchHint = state.battleMake ? '点将后必须点「完成选将 · 选粮出发」，再点目标城。' : '';
        state.handoff = false;
        state.handoffStatus = '';
        state.handoffConfirmed = false;
        state.handoffHaveFresh = false;
        if (state.handoffTimer) {
            clearTimeout(state.handoffTimer);
            state.handoffTimer = 0;
        }
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
        var m = bindMarchSession();
        if (!m || !shouldShowHd() || state.finishPersonsBusy || state.personExitSent) {
            return;
        }
        if (Number(m.phase) === MARCH.FOOD) {
            adoptLiveGetFood('finish-already-food');
            render();
            return;
        }
        if (Number(m.phase) !== MARCH.PERSONS || !(state.pickedPersons > 0)) {
            state.marchHint = '请先选择至少一名将领。';
            render();
            return;
        }
        state.finishPersonsBusy = true;
        var epoch = marchEpoch;
        var session = state.marchSession;
        var attempts = 0;
        function waitSelected() {
            var live = currentMarch();
            if (epoch !== marchEpoch || session !== state.marchSession || !shouldShowHd() || !live) {
                state.finishPersonsBusy = false;
                return;
            }
            if (Number(live.phase) === MARCH.FOOD) {
                state.finishPersonsBusy = false;
                adoptLiveGetFood('finish-engine-food');
                render();
                return;
            }
            if (Number(live.phase) !== MARCH.PERSONS) {
                state.finishPersonsBusy = false;
                render();
                return;
            }
            if (!state.queue.length && !state.sending &&
                Number(live.selected) >= state.pickedPersons) {
                state.personExitSent = true;
                state.finishPersonsBusy = false;
                engineSendKey(VK.EXIT, 'finish-persons');
                state.marchHint = '等待引擎打开粮草选择…';
                scheduleMarchWatch();
                render();
                return;
            }
            if (++attempts >= 200) {
                state.finishPersonsBusy = false;
                state.marchHint = '将领选择尚未全部进入引擎，请检查后再次完成选将。';
                render();
                return;
            }
            setTimeout(waitSelected, 50);
        }
        waitSelected();
        render();
    }

    function fightIsActive() {
        try {
            var fgtOver = 0;
            var hdActive = 0;
            var hdOver = 0;
            try {
                if (window.baye && baye.data) {
                    fgtOver = Number(baye.data.g_FgtOver) || 0;
                    hdActive = Number(baye.data.g_hdFightActive) || 0;
                    hdOver = Number(baye.data.g_hdFightOver) || 0;
                }
            } catch (eFlags) {}
            /* 本趟已开战且引擎未写 g_FgtOver：敌回合 flicker / leftover 城菜单不得拆战场。 */
            if (state.sawFightThisMarch && !fgtOver) {
                return true;
            }
            var battleOpen = false;
            try {
                if (global.BayeHdBattle && typeof BayeHdBattle.debugSnapshot === 'function') {
                    var snap = BayeHdBattle.debugSnapshot();
                    battleOpen = !!(snap && snap.open && !snap.preview && !snap.over);
                }
            } catch (eSnap) {}
            if (battleOpen && !fgtOver) {
                state.sawFightThisMarch = true;
                return true;
            }
            if (fgtOver) {
                return false;
            }
            var departed = !!(state.handoff || state.marchReady);
            if (window.baye && baye.hd && typeof baye.hd.fight === 'function') {
                var f = baye.hd.fight();
                if (f && f.active && !f.over) {
                    /* 招商/选将 leftover 旗：城菜单还开着且未出发，不当活战。 */
                    if (state.open && !departed && !battleOpen) {
                        return false;
                    }
                    state.sawFightThisMarch = true;
                    return true;
                }
            }
            if (hdActive && !hdOver) {
                if (state.open && !departed && !battleOpen) {
                    return false;
                }
                if (departed || !state.open) {
                    state.sawFightThisMarch = true;
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function functionMenuItemsLive(names) {
        names = names || [];
        if (names[0] !== '策略结束') {
            return false;
        }
        var hasSave = false;
        var hasQuit = false;
        var i;
        for (i = 0; i < names.length; i++) {
            if (names[i] === '存储进度') {
                hasSave = true;
            }
            if (names[i] === '结束游戏') {
                hasQuit = true;
            }
        }
        return hasSave && hasQuit;
    }

    function leftoverFightSys(names) {
        names = names || [];
        return names[0] === '全军撤退' || names[0] === '回合结束';
    }

    function cityOrderMenuNow(names) {
        names = names || [];
        return names[0] === '内政' || names[0] === '外交' || names[0] === '军备' ||
            names[0] === '状况' || names[0] === '开垦' || names[0] === '侦察' ||
            names[0] === '出征';
    }

    function setHandoffStatus(msg) {
        if (state.handoffStatus === msg) {
            return;
        }
        state.handoffStatus = msg || '';
        applyDocAttr();
        render();
    }

    function clearHandoffTimer() {
        if (state.handoffTimer) {
            clearTimeout(state.handoffTimer);
            state.handoffTimer = 0;
        }
    }

    function consumeMarchSeqIfFight() {
        if (!fightIsActive()) {
            return false;
        }
        var seq = marchSeqOf(engineMarch());
        if (seq) {
            state.consumedMarchSeq = seq;
        }
        return true;
    }

    function finishHandoff(ok) {
        clearHandoffTimer();
        state.handoff = false;
        state.handoffConfirmed = false;
        if (ok) {
            state.handoffStatus = '即将开战…';
            state.marchReady = false;
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            closeMenu({ silent: true, force: true, keepWizard: true });
            return;
        }
        if (freshMarchOk()) {
            state.marchReady = true;
            state.wizardStep = 'march-ok';
            state.handoffHaveFresh = true;
            state.handoffStatus = '策略结束未确认，可再点一次';
            state.marchHint = state.handoffStatus;
        } else {
            state.handoffStatus = '';
            state.handoffHaveFresh = false;
        }
        applyDocAttr();
        render();
    }

    function goStrategyEnd() {
        if (!freshMarchOk() || state.handoff || !shouldShowHd()) {
            return;
        }
        var menu = engineMenuItems();
        var march = currentMarch();
        var nativeMap = !!(march && Number(march.pick) && !Number(march.battlePick) &&
            Number(march.mapInputSeq) && !Number(menu.active));
        if (!nativeMap && (!Number(menu.active) || [1, 2].indexOf(Number(menu.context)) < 0)) {
            state.marchHint = '等待引擎返回地图或城池菜单，再结束策略。';
            render();
            return;
        }
        invalidateQtyWork();
        state.handoff = true;
        state.handoffConfirmed = false;
        state.handoffAt = Date.now();
        state.handoffExitCount = 0;
        state.handoffEnterCount = 0;
        var submittedOrder = { session: Number(march.session), seq: marchSeqOf(march),
            origin: Number(march.origin), target: Number(march.obj) };
        var token = ++state.handoffToken;
        var epoch = marchEpoch;
        var exited = {};
        var exitedMap = {};
        var moved = false;
        var checks = 0;
        function step() {
            state.handoffTimer = 0;
            if (token !== state.handoffToken || epoch !== marchEpoch ||
                !state.handoff || !shouldShowHd()) { return; }
            if (fightIsActive()) {
                consumeMarchSeqIfFight();
                finishHandoff(true);
                return;
            }
            var live = engineMenuItems();
            var march = currentMarch();
            if (consumedStrategyOrder(march)) {
                // Empty/owned cities and deleted armies can consume an order
                // without entering GamFight. C's consumed order is the ACK;
                // waiting for a battle hook would keep the old wizard alive.
                resetAfterFight();
                return;
            }
            if (++checks > 100) {
                // A delayed engine response never authorizes a repeated key.
                finishHandoff(false);
                return;
            }
            if (Number(live.active) && Number(live.context) === 1 && !state.handoffConfirmed) {
                var key = String(live.seq);
                if (!exited[key]) {
                    exited[key] = true;
                    state.handoffExitCount += 1;
                    engineSendKey(VK.EXIT, 'strategy-end');
                    setHandoffStatus('正在返回策略菜单…');
                }
            } else if (!Number(live.active) && march && Number(march.pick) &&
                !Number(march.battlePick) && Number(march.mapInputSeq) && !state.handoffConfirmed) {
                var mapKey = String(march.mapInputSeq);
                if (!exitedMap[mapKey]) {
                    exitedMap[mapKey] = true;
                    state.handoffExitCount += 1;
                    engineSendKey(VK.EXIT, 'strategy-end');
                    setHandoffStatus('正在打开策略菜单…');
                }
            } else if (Number(live.active) && Number(live.context) === 2 &&
                !state.handoffConfirmed && functionMenuItemsLive(live.names || [])) {
                if (Number(live.index) === 0) {
                    state.handoffConfirmed = true;
                    state.handoffEnterCount = 1;
                    state.marchStrategyOrder = submittedOrder;
                    engineSendKey(VK.ENTER, 'strategy-end-enter');
                    setHandoffStatus('策略已结束，等待引擎执行行军…');
                } else if (!moved && Number(live.index) > 0) {
                    // Select the first entry once; await the live index before
                    // confirming. No time-based fallback to ENTER is used.
                    moved = true;
                    selectLiveMenu(0, false, 'strategy-end', live);
                }
            }
            state.handoffTimer = setTimeout(step, 100);
        }
        step();
        render();
    }

    function isMarching() {
        return liveMarchOrFight();
    }

    function isHandoff() {
        return !!state.handoff;
    }

    function cancelMarch() {
        var m = currentMarch();
        if (!m || Number(m.phase) !== MARCH.TARGET_PICK || !shouldShowHd()) { return false; }
        var key = marchInputKey(m);
        if (state.marchCancelKey === key) { return false; }
        state.marchCancelKey = key;
        invalidateMarchWork();
        engineSendKey(VK.EXIT, 'march-cancel');
        scheduleMarchWatch();
        return true;
    }

    function reportText() {
        var engine = liveEngineReport();
        if (engine) {
            /* g_hdReportGbk leftover 选择目标 after 策略结束 must not look live during 选将. */
            if (leftoverChooseTarget(engine) && (!state.personExitSent || state.wizardStep === 'persons')) {
                return '';
            }
            /* 选将阶段的残留「部队已出发」才藏。GetCitySet 刚返回的真提示必须留下，好回车放行 AddFightOrder。 */
            if (leftoverMarchReport(engine) && !freshMarchOk() && state.wizardStep === 'persons') {
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

    /* leftover g_hdMenuBytes 常只剩「策略结束」。真 FunctionMenu 还有存储进度/结束游戏。 */
    function liveFunctionMenu() {
        var menu = engineMenuItems();
        return !!(Number(menu.active) && Number(menu.context) === 2 &&
            functionMenuItemsLive(menu.names || []));
    }

    function leftoverMoneyReport(text) {
        return /无足够金钱|金钱不足|城中无空闲武将/.test(String(text || ''));
    }

    function clearLeftoverCityReports(why) {
        if (marchProtocol()) {
            return !!(global.BayeHdDialog && typeof BayeHdDialog.retireStaleReport === 'function' &&
                BayeHdDialog.retireStaleReport());
        }
        var text = liveEngineReport();
        var money = leftoverMoneyReport(text);
        var choose = leftoverChooseTarget(text) && !engineInGetCitySet();
        var farm = leftoverFarmReportText(text);
        var disaster = leftoverDisasterReport(text) && !liveReportAsync();
        if (!(money || choose || farm || disaster || leftoverMarchReport(text) ||
            leftoverEnemyCityReport(text))) {
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            return false;
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.dismissLeftoverSpeech === 'function') {
            BayeHdDialog.dismissLeftoverSpeech();
        }
        console.log('[hd-city-menu] clear leftover report', why || '', String(text || '').slice(0, 24));
        return true;
    }

    function unstickMenuLoop(why) {
        clearLeftoverCityReports(why || 'unstick');
        leaveLeftoverPolicyPerson(why || 'unstick');
        try {
            if (global.BayeHdSystemUi && typeof BayeHdSystemUi.isOpen === 'function' &&
                BayeHdSystemUi.isOpen() && typeof BayeHdSystemUi.close === 'function') {
                BayeHdSystemUi.close({ silent: true });
            }
        } catch (e) {}
        if (!engineInGetCitySet() && !state.handoff && !state.marchReady && !state.personExitSent) {
            state.campaignPick = false;
            if (state.wizardStep === 'target-tip' || state.wizardStep === 'map-pick') {
                state.wizardStep = 'none';
            }
        }
        if (liveFunctionMenu() && !state.handoff && !state.marchReady && !engineInGetCitySet()) {
            engineSendKey(VK.EXIT, 'unstick-func-menu');
            if (state.open && !optsKeepCity(why)) {
                closeMenu({ silent: true, force: true });
                if (global.BayeHdOverworld && typeof BayeHdOverworld.afterFightMapReady === 'function') {
                    BayeHdOverworld.afterFightMapReady('unstick-func');
                }
            }
        }
        return true;
    }

    function optsKeepCity(why) {
        return why === 'open-city' || why === 'choose-root' || why === 'back-deep' ||
            why === 'money-tip';
    }

    function syncMarchPhase() {
        if (liveFightBlocksCityOpen() || state.handoff || !state.battleMake &&
            state.deepKind !== 'person-city') {
            return;
        }
        var m = bindMarchSession();
        if (!m || !state.open || state.layer !== 'deep') {
            return;
        }
        var phase = Number(m.phase);
        if (phase === MARCH.IDLE) {
            invalidateMarchWork();
            state.battleMake = false;
            state.campaignPick = false;
            state.personExitSent = false;
            state.pickedPersons = 0;
            state.wizardStep = 'none';
            state.layer = 'sub';
            state.deepKind = '';
            state.deepLabel = '';
            state.marchSession = 0;
            state.marchHint = '已取消出征。';
            render();
            return;
        }
        if (phase === MARCH.FOOD) {
            state.personExitSent = true;
            state.finishPersonsBusy = false;
            state.sawGetFoodUi = true;
            state.sawQtyThisMarch = true;
            setWizardStep('food', 'engine-food');
            if (!state.marchFoodCommitSent) {
                bindLiveGetFoodQty('engine-food');
            }
            return;
        }
        if (phase >= MARCH.TARGET_TIP && state.marchFoodCommitSent) {
            state.foodConfirmedThisMarch = true;
        }
        if (phase === MARCH.TARGET_TIP) {
            state.confirmingTarget = false;
            state.campaignPick = false;
            setWizardStep('target-tip', 'engine-target-tip');
            state.marchHint = '粮草已确认，点击「选择目标城」继续。';
        } else if (phase === MARCH.TARGET_PICK) {
            state.campaignPick = true;
            setWizardStep('map-pick', 'engine-target-pick');
        } else if (phase === MARCH.REJECT) {
            state.confirmingTarget = false;
            state.walkBusy = false;
            state.campaignPick = false;
            state.marchHint = liveEngineReport() || '引擎拒绝该目标，请确认提示后重新选择。';
        } else if (phase === MARCH.ARMOUT) {
            state.confirmingTarget = false;
            state.walkBusy = false;
            state.campaignPick = false;
            state.marchHint = '目标已确认，点击「确认部队出发」继续。';
        } else if (phase === MARCH.DEPARTED && freshMarchOk()) {
            state.confirmingTarget = false;
            state.marchReady = true;
            state.campaignPick = false;
            state.battleMake = false;
            state.walkBusy = false;
            state.marchHint = '';
            setWizardStep('march-ok', 'engine-order-ack');
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
        }
        if (phase !== MARCH.PERSONS) { state.deepSig = ''; }
        render();
    }

    var marchWatchTimer = 0;

    function stopMarchWatch() {
        if (marchWatchTimer) {
            clearTimeout(marchWatchTimer);
            marchWatchTimer = 0;
        }
    }
    /* 单飞：旧实现每次 driveFood 再挂 8 个 timeout，sync/interval 再套一层会把标签页打崩。 */
    function scheduleMarchWatch() {
        if (state.foodGaveUp || state.handoff || !state.open) {
            return;
        }
        if (marchWatchTimer) {
            return;
        }
        marchWatchTimer = setTimeout(function () {
            marchWatchTimer = 0;
            try {
                syncMarchPhase();
            } catch (e) {
                console.warn('[hd-city-menu] march-watch', e);
            }
            if (state.foodGaveUp || !state.open || state.handoff) {
                return;
            }
            if (waitingGetFoodSoftLock() ||
                (state.personExitSent && !engineInGetCitySet() && !state.marchReady && !freshMarchOk())) {
                scheduleMarchWatch();
            }
        }, 280);
    }

    function chooseDeep(index, pressedOwner) {
        var item = state.deepItems[index];
        var native = engineMenuItems();
        var owner = native.active != null ? readyDeepMenuOwner(native) : null;
        var nativeIndex = item && item.i != null ? Number(item.i) : Number(index);
        if (native.active != null && (!item || item.cityIndex == null)) {
            var expectedOwner = pressedOwner || state.deepMenuOwner || owner;
            if (!item || !owner || !expectedOwner || expectedOwner.key !== owner.key ||
                expectedOwner.name != null && expectedOwner.name !== item.name ||
                expectedOwner.pind != null && String(expectedOwner.pind) !== String(item.pind) ||
                expectedOwner.toolIndex != null && String(expectedOwner.toolIndex) !== String(item.toolIndex) ||
                item.name !== native.names[nativeIndex]) {
                fillDeepList();
                return false;
            }
        }
        if (leftoverQtyFlag() && !liveGetFood()) {
            clearLeftoverQtyFlag();
        }
        if (state.marchReady || freshMarchOk()) {
            return;
        }
        if (item && item.cityIndex != null && state.wizardStep !== 'persons' && !liveQty()) {
            if (!engineInGetCitySet()) {
                var driven = driveFoodToCitySet('choose-deep');
                state.pendingTarget = null;
                state.marchHint = leftoverOverworldPick()
                    ? ('请先完成选将和粮草确认。')
                    : ('请先完成选将和粮草确认，再选择目标城。');
                noteStep4('refuse-choose-deep', { cityIndex: item.cityIndex, skipped: engineMarchPhase() });
                render();
                return driven;
            }
            selectMarchTarget(item.cityIndex);
            return;
        }
        if (showingQty()) {
            return;
        }
        if (usesMapCursor(state.deepKind, state.deepStep) && item && item.cityIndex != null) {
            selectMarchTarget(item.cityIndex);
            return;
        }
        if ((mapPickActive() && !leftoverOverworldPick()) || showingQty() || state.personExitSent ||
            state.campaignPick || state.wizardStep === 'food' || state.wizardStep === 'target-tip' ||
            state.wizardStep === 'map-pick') {
            var holdPhase = engineMarchPhase();
            state.marchHint = (mapPickActive() && !leftoverOverworldPick()) ||
                state.wizardStep === 'map-pick' || state.wizardStep === 'target-tip' ||
                holdPhase === 'get-city-set' || holdPhase === 'choose-target'
                ? '现在点邻城或地图上的目标城，不要再点将领。'
                : (holdPhase === 'get-food' || holdPhase === 'wait-get-food' || liveGetFood())
                ? '请选择随军粮草。'
                : '正在打开粮草选择…';
            render();
            return;
        }
        var selection = null;
        if (owner) {
            selection = { epoch: marchEpoch, seq: owner.seq,
                key: [owner.seq, owner.context, owner.kind, (native.names || []).join('\u0000')].join(':') };
            if (state.deepKind === 'person-city') {
                var selectingMarch = currentMarch();
                selection.session = Number(selectingMarch.session);
                selection.selected = Number(selectingMarch.selected) + 1;
            }
            state.deepSelectionPending = selection;
            retirePersonDetails();
            retireToolDetails();
        }
        if (state.deepKind === 'person-city') {
            var liveMarch = bindMarchSession();
            if (!liveMarch || Number(liveMarch.phase) !== MARCH.PERSONS ||
                state.finishPersonsBusy || state.personExitSent ||
                state.queue.length || state.sending ||
                Number(liveMarch.selected) < (state.marchPersonExpected || 0)) {
                if (state.deepSelectionPending === selection) { state.deepSelectionPending = null; }
                return;
            }
            if (!pickIndex(nativeIndex, true, 'pick-person')) {
                if (state.deepSelectionPending === selection) { state.deepSelectionPending = null; }
                return;
            }
            state.marchPersonExpected = selection ? selection.selected : Number(liveMarch.selected) + 1;
        } else {
            if (!pickIndex(nativeIndex, true, '')) {
                if (state.deepSelectionPending === selection) { state.deepSelectionPending = null; }
                return;
            }
        }
        if (state.deepKind === 'person-city' && !(mapPickActive() && !leftoverOverworldPick()) &&
            !showingQty()) {
            if (!state.enginePersonsAtPickStart) {
                state.enginePersonsAtPickStart = cityPersonCount(state.cityIndex);
            }
            state.pickedPersons += 1;
            if (item && item.name) {
                if (!state.pickedPersonNames) {
                    state.pickedPersonNames = [];
                }
                state.pickedPersonNames.push(item.name);
            }
            state.deepSig = '';
            if (owner) { fillDeepList(); }
            var selectedEpoch = marchEpoch;
            setTimeout(function () {
                if (selectedEpoch === marchEpoch && state.open && state.layer === 'deep') {
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
            if (owner) { fillDeepList(); }
            var nextEpoch = marchEpoch;
            setTimeout(function () {
                if (nextEpoch === marchEpoch && state.open && state.layer === 'deep') {
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
        if (name === 'chooseGameEntry' || name === 'didOpenNewGame' || name === 'didLoadGame') {
            resetForNewGame(name);
        }
        if (name === 'enterBattle') {
            // FgtInit can end an empty-city battle immediately, before a
            // polling frame ever observes an active battle. The real engine
            // hooks still delimit that campaign order.
            state.sawFightThisMarch = true;
        }
        if (name === 'exitBattle') {
            var result = 0;
            try { result = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eResult) {}
            if (result) {
                state.fightEndedThisMarch = true;
                resetAfterFight();
            }
        }
        if (name === 'showMainHelp') {
            state.engineHelpOpen = true;
            if (state.battleMake && !liveGetFood() && !state.foodConfirmedThisMarch) {
                dismissMarchOverlay('hook-help');
            }
        }
        if (state.handoff && fightIsActive()) {
            consumeMarchSeqIfFight();
            finishHandoff(true);
            return;
        }
        if (liveFightBlocksCityOpen()) {
            if (state.open) {
                closeMenu({ silent: true, force: true });
            }
            return;
        }
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
                    /* 出征向导开着时 g_hdMenuBytes 残留「策略结束」不是 FunctionMenu。 */
                    if (liveFunctionMenu()) {
                        if (state.handoff) {
                            if ((state.handoffExitCount || 0) > 0 && !mapPickActive()) {
                                state.lastFuncMenuIdle = Date.now();
                            }
                        } else if (!state.open || (!wizardInMarch() && !state.marchReady && !holdExit())) {
                            state.lastFuncMenuIdle = Date.now();
                        }
                    }
                    if (state.handoff) {
                        /* keep 部队已出发 panel visible during handoff */
                    } else if (liveFunctionMenu() && !holdExit() && !state.battleMake &&
                        !state.campaignPick &&
                        !state.marchReady && !mapPickActive() && !showingQty() &&
                        !engineInGetCitySet() &&
                        !/选择目标|部队已出发/.test(reportText())) {
                        closeMenu({ silent: true });
                        return;
                    }
                }
                if (state.layer === 'deep' && engIdle.names && engIdle.names.length) {
                    if (engIdle.active == null) { state.deepSig = ''; }
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
        if (liveFunctionMenu() && state.open) {
            if (state.handoff || holdExit() || state.marchReady || state.campaignPick ||
                mapPickActive() || showingQty() || engineInGetCitySet() ||
                /选择目标|部队已出发/.test(reportText())) {
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
        function buttonOwner(button) {
            var key = button.getAttribute('data-hd-deep-owner');
            return key == null ? null : { key: key,
                name: button.getAttribute('data-hd-deep-name'),
                pind: button.getAttribute('data-hd-deep-pind'),
                toolIndex: button.getAttribute('data-hd-deep-tool') };
        }
        root.addEventListener('pointerdown', function (ev) {
            state.deepPointerOwner = null;
            state.toolPointerOwner = null;
            state.backPointerOwner = null;
            var target = ev.target;
            if (target === root) { state.backPointerOwner = { target: root, key: cityBackPressOwner() }; return; }
            while (target && target !== root) {
                if (target.getAttribute && target.getAttribute('data-hd-menu-back') != null) {
                    state.backPointerOwner = { target: target, key: cityBackPressOwner() };
                    return;
                }
                if (target.getAttribute && target.getAttribute('data-hd-tool-page') != null) {
                    state.toolPointerOwner = { target: target, key: target.getAttribute('data-hd-tool-page-owner') };
                    return;
                }
                if (target.getAttribute && target.getAttribute('data-hd-deep') != null) {
                    state.deepPointerOwner = { target: target, owner: buttonOwner(target) };
                    return;
                }
                target = target.parentNode;
            }
        });
        root.addEventListener('pointercancel', function () {
            state.deepPointerOwner = null;
            state.toolPointerOwner = null;
            if (state.backPointerOwner) { state.backPointerOwner.cancelled = true; }
        });
        root.addEventListener('click', function (ev) {
            var pressed = state.deepPointerOwner;
            var pagePressed = state.toolPointerOwner;
            var backPressed = state.backPointerOwner;
            state.deepPointerOwner = null;
            state.toolPointerOwner = null;
            state.backPointerOwner = null;
            // Keyboard activation starts a new action, even after a cancelled pointer.
            if (ev.detail === 0) { backPressed = null; }
            if (ev.target === root) {
                ev.preventDefault();
                if (backPressed && (backPressed.target !== root || !backPressed.key || backPressed.cancelled)) { return; }
                back(backPressed ? backPressed.key : null);
                return;
            }
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && t.getAttribute('data-hd-tool-page') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (pagePressed && pagePressed.target !== t) { renderToolDetails(); return; }
                    pageTool(t.getAttribute('data-hd-tool-page'), pagePressed ? pagePressed.key :
                        t.getAttribute('data-hd-tool-page-owner'));
                    return;
                }
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
                    if (pressed && pressed.target !== t) { fillDeepList(); return; }
                    chooseDeep(Number(t.getAttribute('data-hd-deep')),
                        pressed ? pressed.owner : buttonOwner(t));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-qty') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    stepQty(Number(t.getAttribute('data-hd-qty')));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-finish-persons') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    finishPersonPick();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-confirm-march') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var target = state.pendingTarget;
                    if (target != null) {
                        confirmMarchTarget(target);
                    } else {
                        state.marchHint = '先点邻城或地图上的目标城，再点确认出征。高亮不够。';
                        noteStep4('confirm-btn-empty', { skipped: 'no-target' });
                        render();
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-march-continue') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    continueMarch({ session: t.getAttribute('data-hd-march-session'),
                        inputSeq: t.getAttribute('data-hd-march-input-seq') });
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-march-cancel') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    cancelMarch();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-dismiss-march') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    dismissMarchBanner();
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
                    commitQty();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-digit') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    digitQty(Number(t.getAttribute('data-hd-digit')));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-menu-help') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    retirePersonDetails();
                    retireToolDetails();
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
                    if (backPressed && (backPressed.target !== t || !backPressed.key || backPressed.cancelled)) { return; }
                    back(backPressed ? backPressed.key : null);
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
            if (bayeInputIgnored(e)) {
                return;
            }
            if (global.BayeHdSpe && typeof BayeHdSpe.isOpen === 'function' && BayeHdSpe.isOpen()) {
                return;
            }
            if (!state.open || !shouldShowHd()) {
                return;
            }
            if (e.repeat && (e.keyCode === 13 || e.keyCode === 27 || e.keyCode === 32)) {
                bayeConsumeKeyEvent(e);
                return;
            }
            if (liveQty() || leftoverQtyFlag() ||
                (global.BayeHdDialog && typeof BayeHdDialog.isQtyOpen === 'function' &&
                    BayeHdDialog.isQtyOpen())) {
                if (e.keyCode === 13) {
                    bayeConsumeKeyEvent(e);
                    if (!e.repeat) {
                        commitQty();
                    }
                    return;
                }
                var qtyCode = bayeQtyKeyboardCode(e.keyCode);
                if (qtyCode != null) {
                    bayeConsumeKeyEvent(e);
                    quantityKey(qtyCode);
                    return;
                }
                if (e.keyCode === 27 || e.keyCode === 32) {
                    bayeConsumeKeyEvent(e);
                    if (!e.repeat) {
                        cancelQty();
                    }
                    return;
                }
            }
            if (e.keyCode === 27 || e.keyCode === 32) {
                bayeConsumeKeyEvent(e);
                if (!e.repeat) {
                    if (!cancelMarch()) { back(); }
                }
                return;
            }
            var march = currentMarch();
            if (e.keyCode === 13 && march && state.deepKind === 'person-city') {
                bayeConsumeKeyEvent(e);
                if (Number(march.phase) === MARCH.PERSONS) { finishPersonPick(); }
                else if ([MARCH.TARGET_TIP, MARCH.REJECT, MARCH.ARMOUT].indexOf(Number(march.phase)) >= 0) { continueMarch(); }
                else if (Number(march.phase) === MARCH.TARGET_PICK && state.pendingTarget != null) { confirmMarchTarget(state.pendingTarget); }
                else if (Number(march.phase) === MARCH.DEPARTED) { goStrategyEnd(); }
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
        syncMode();
        if (!shouldShowHd()) {
            invalidateQtyWork();
        }
        if (state.open && !shouldShowHd()) {
            state.open = false;
        }
        applyDocAttr();
        syncToolbar();
        render();
    }

    function syncMode() {
        var signature = getMenuMode() + ':' + (overworldIsHd() ? 'hd' : 'classic');
        if (state.modeSignature === signature) { return; }
        state.modeSignature = signature;
        invalidateMarchWork();
        invalidateQtyWork();
        if (!shouldShowHd()) {
            state.open = false;
        } else {
            var m = currentMarch();
            if (m && Number(m.phase) > MARCH.IDLE) {
                state.open = true;
                state.layer = 'deep';
                state.subKind = 'junbei';
                state.deepKind = 'person-city';
                state.deepLabel = '出征';
                state.cityIndex = Number(m.origin);
                state.pickedPersons = Number(m.selected);
                state.marchPersonExpected = Number(m.selected);
                if (Number(m.phase) === MARCH.FOOD) {
                    state.qtyInputClosed = false;
                    state.qtyDismissed = false;
                }
            }
        }
        applyDocAttr();
        render();
    }

    function start() {
        state.mode = getMenuMode();
        state.modeSignature = getMenuMode() + ':' + (overworldIsHd() ? 'hd' : 'classic');
        bindUi();
        bindToolbar();
        applyDocAttr();
        render();
        setInterval(function () {
            try {
                syncMode();
                if (!shouldShowHd() && (state.qtyCommitQueued || /^qty-/.test(state.activeQueueReason) ||
                    state.queue.some(function (item) { return item.qtyEpoch != null; }))) {
                    invalidateQtyWork();
                }
                if (fightIsActive()) {
                    state.sawFightThisMarch = true;
                } else if (leftoverMarchAfterFight()) {
                    releaseMarchShell('poll-after-fight');
                    var liveOver = 0;
                    try { liveOver = Number(window.baye && baye.data && baye.data.g_FgtOver) || 0; } catch (eOver) {}
                    var battleSnap = null;
                    try {
                        if (global.BayeHdBattle && typeof BayeHdBattle.debugSnapshot === 'function') {
                            battleSnap = BayeHdBattle.debugSnapshot();
                        }
                    } catch (eSnap) {}
                    /* 胜仗还要走 BeOccupied：只摘横幅，等占领回车结束再 reset。 */
                    var battleWillOccupy = !!(liveOver && battleSnap && battleSnap.open &&
                        !battleSnap.occupyDone);
                    var battleStillLive = !!(!liveOver && battleSnap && battleSnap.open &&
                        !battleSnap.over);
                    if (!liveOver || battleStillLive) {
                        return;
                    }
                    if (!occupyDrainPending() && !battleWillOccupy) {
                        resetAfterFight();
                    }
                    return;
                } else {
                    /* 菜单关着也要扫：完成选将 / GetFood / 部队已出发 leftover 不能卡住横幅。 */
                    sweepStickyMarch('poll');
                }
                if (!hdReady() || !state.open) {
                    return;
                }
                // A person-picker cancellation can return directly to GetCitySet
                // without willCloseMenu. Retire only after the player's Back ACK.
                if (state.closingSub && retiredCityMapOwner()) {
                    state.closingSub = false;
                    closeMenu({ silent: true });
                    return;
                }
                if (state.layer !== 'deep') {
                    if (engineQty() && engineQty().active && !state.battleMake && !state.personExitSent) {
                        state.qtyDismissed = true;
                        clearLeftoverQtyFlag();
                    }
                    return;
                }
                if (!state.foodGaveUp) {
                    syncMarchPhase();
                }
                if (showingQty()) {
                    fillDeepList();
                    var node = el('hd-city-qty-val');
                    var q = engineQty();
                    if (node && q) {
                        node.textContent = q.active ? q.value : (q.value || '—');
                    }
                    return;
                }
                if (state.foodGaveUp) {
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
            } catch (e) {
                console.warn('[hd-city-menu] poll', e);
            }
        }, 280);
    }

    applyDocAttr();

    global.BayeHdCityMenu = {
        STORAGE_KEY: STORAGE_KEY,
        getMode: getMenuMode,
        setMode: setMenuMode,
        syncMode: syncMode,
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
                cityLcdMode: cityLcdPresentation(),
                probedCityKeys: state.probedCityKeys.slice(),
                deepKind: state.deepKind,
                deepLabel: state.deepLabel,
                deepCount: state.deepItems.length,
                deepItems: state.deepItems.slice(0, 20),
                deepMenuOwner: state.deepMenuOwner && { context: state.deepMenuOwner.context,
                    kind: state.deepMenuOwner.kind, seq: state.deepMenuOwner.seq,
                    detailGeneration: state.deepMenuOwner.detailGeneration, key: state.deepMenuOwner.key },
                cityDetails: state.open && state.layer === 'status' && state.cityDetails
                    ? JSON.parse(JSON.stringify(state.cityDetails)) : null,
                personDetail: state.personDetail ? JSON.parse(JSON.stringify(state.personDetail)) : null,
                toolDetail: state.toolDetail ? JSON.parse(JSON.stringify(state.toolDetail)) : null,
                toolPagePending: state.toolPagePending,
                pickedPersons: state.pickedPersons,
                dismissedObj: state.dismissedObj,
                marchReady: state.marchReady,
                marching: isMarching(),
                leftoverAfterFight: leftoverMarchAfterFight(),
                sawFightThisMarch: state.sawFightThisMarch,
                fightEndedThisMarch: state.fightEndedThisMarch,
                campaignPick: state.campaignPick,
                battleMake: state.battleMake,
                handoff: state.handoff,
                handoffAt: state.handoffAt,
                handoffStatus: state.handoffStatus,
                handoffExitCount: state.handoffExitCount,
                handoffEnterCount: state.handoffEnterCount,
                lastHandoffExitAt: state.lastHandoffExitAt,
                lastFuncMenuIdle: state.lastFuncMenuIdle,
                personExitSent: state.personExitSent,
                finishPersonsBusy: !!state.finishPersonsBusy,
                personExitTries: state.personExitTries,
                lastExit: state.lastExit,
                engineHelpOpen: !!state.engineHelpOpen,
                overlayRetry: state.overlayRetry || 0,
                finishVisibleRetry: state.finishVisibleRetry || 0,
                pickedPersonNames: (state.pickedPersonNames || []).slice(),
                leftoverOverlay: leftoverMarchOverlay(),
                engineLeftBattleMake: engineLeftBattleMake(),
                engineStillInPersonPick: engineStillInPersonPick(),
                liveJunbeiMenu: liveJunbeiMenu(),
                qtyActive: (function () {
                    try {
                        return Number(window.baye && baye.data && baye.data.g_hdQtyActive) || 0;
                    } catch (e) { return 0; }
                }()),
                lastBlockedExit: state.lastBlockedExit,
                lastBlockedEnter: state.lastBlockedEnter || '',
                lastPickEnterAt: state.lastPickEnterAt || 0,
                holdEnterForFood: holdEnterForFood(),
                queueLen: state.queue.length,
                sending: !!state.sending,
                enginePersons: cityPersons(state.cityIndex).length,
                enginePersonNames: cityPersons(state.cityIndex).map(function (p) {
                    return p.name;
                }),
                enginePersonsAtFinish: state.enginePersonsAtFinish || 0,
                enginePersonsAtPickStart: state.enginePersonsAtPickStart || 0,
                marchHint: state.marchHint,
                holdExit: holdExit(),
                holdMenu: holdMenu(),
                acceptMarchOk: state.acceptMarchOk,
                freshMarch: freshMarchOk(),
                consumedMarchSeq: state.consumedMarchSeq,
                sawMarchCleared: state.sawMarchCleared,
                walkBusy: state.walkBusy,
                pendingTarget: state.pendingTarget,
                wizardStep: state.wizardStep,
                wizardLabel: WIZARD_LABEL[state.wizardStep] || '',
                sawQtyThisMarch: state.sawQtyThisMarch,
                sawGetFoodUi: !!state.sawGetFoodUi,
                foodConfirmed: !!state.foodConfirmedThisMarch,
                leftoverPick: leftoverOverworldPick(),
                liveMarch: liveMarchOrFight(),
                stickyBanner: stickyMarchBanner(),
                lastBannerLog: state.lastBannerLog,
                battlePick: battlePickActive(),
                openedCity: state.cityIndex,
                marchDest: (function () {
                    var m = engineMarch();
                    return { city: m && m.city, obj: m && m.obj, ok: !!(m && m.ok), real: realMarchDest(m) };
                }()),
                leftoverEngineSub: leftoverEngineSubAtHdRoot(),
                leftoverQty: leftoverQtyFlag(),
                liveQty: liveQty(),
                liveGetFood: liveGetFood(),
                latentGetFood: latentGetFood(),
                realm: (function () {
                    try {
                        return window.baye && baye.hd && baye.hd.realm ? baye.hd.realm() : null;
                    } catch (e) { return null; }
                }()),
                waitingGetFood: waitingGetFoodSoftLock(),
                foodRecovered: state.foodRecovered,
                foodRecoverEnter: state.foodRecoverEnter,
                foodRecoverNeeded: state.foodRecoverNeeded,
                foodGaveUp: !!state.foodGaveUp,
                foodAttempt: state.foodAttempt || 0,
                qtyBeforePersonExit: state.qtyBeforePersonExit,
                engineInGetCitySet: engineInGetCitySet(),
                confirmingTarget: !!state.confirmingTarget,
                enginePhase: engineMarchPhase(),
                displayWizard: displayWizardStep(),
                mapCity: engineMapCityIndex(),
                debug: marchDebugLine(),
                qtyDismissed: state.qtyDismissed,
                qtyAckFailed: !!state.qtyAckFailed,
                qtyAckError: state.qtyAckError,
                reportAtMarchStart: state.reportAtMarchStart,
                march: engineMarch(),
                qty: engineQty(),
                lastStep4: state.lastStep4,
                step4Trace: (state.step4Trace || []).slice(-16),
                marchOriginIndex: state.marchOriginIndex,
                originRetryTried: !!state.originRetryTried,
                originRetryBusy: !!state.originRetryBusy,
                originRetryFrom: state.originRetryFrom,
                originRetryTo: state.originRetryTo,
                preferredOrigin: preferredMarchOrigin(
                    state.pendingTarget != null ? state.pendingTarget : 9
                ),
                originLinks: cityLinksOf(state.cityIndex)
            };
        },
        walkToCity: function (cityIndex, thenEnter) {
            if (thenEnter !== false && (liveTargetStep() || usesMapCursor(state.deepKind, state.deepStep))) {
                return confirmMarchTarget(cityIndex);
            }
            return walkCursorToCity(cityIndex, thenEnter);
        },
        confirmMarchTarget: confirmMarchTarget,
        selectMarchTarget: selectMarchTarget,
        continueMarch: continueMarch,
        cancelMarch: cancelMarch,
        preferredMarchOrigin: preferredMarchOrigin,
        cityLinksOf: cityLinksOf,
        isMarching: isMarching,
        isHandoff: isHandoff,
        holdExit: holdExit,
        holdMenu: holdMenu,
        isMarchReady: function () { return !!(state.marchReady && !state.handoff && freshMarchOk()); },
        finishPersons: finishPersonPick,
        dismissMarchOverlay: dismissMarchOverlay,
        leftoverOverworldPick: leftoverOverworldPick,
        battlePickActive: battlePickActive,
        realMarchDest: realMarchDest,
        clearStaleMapPick: clearStaleMapPick,
        clearBattleMakeLeftoverPick: clearBattleMakeLeftoverPick,
        bindOpenedMapCity: bindOpenedMapCity,
        landOwnedCity: landOwnedCity,
        unstickMenuLoop: unstickMenuLoop,
        leaveLeftoverPolicyPerson: leaveLeftoverPolicyPerson,
        liveFunctionMenu: liveFunctionMenu,
        leftoverMoneyReport: leftoverMoneyReport,
        waitingArmout: waitingArmout,
        liveTargetStep: liveTargetStep,
        engineInGetCitySet: engineInGetCitySet,
        engineMarchPhase: engineMarchPhase,
        liveGetFood: liveGetFood,
        latentGetFood: latentGetFood,
        engineLeftBattleMake: engineLeftBattleMake,
        engineStillInPersonPick: engineStillInPersonPick,
        bindLiveGetFoodQty: bindLiveGetFoodQty,
        thisMarchGetFoodOpened: thisMarchGetFoodOpened,
        foodReadyForCitySet: foodReadyForCitySet,
        waitingGetFood: waitingGetFoodSoftLock,
        driveFoodToCitySet: driveFoodToCitySet,
        wizardStep: function () { return state.wizardStep; },
        displayWizardStep: displayWizardStep,
        goStrategyEnd: goStrategyEnd,
        handoffAt: function () { return state.handoffAt || 0; },
        consumeLeftoverMarch: consumeLeftoverMarch,
        leftoverMarchAfterFight: leftoverMarchAfterFight,
        liveMarchOrFight: liveMarchOrFight,
        sweepStickyMarch: sweepStickyMarch,
        dismissMarchBanner: dismissMarchBanner,
        logMarchBanner: logMarchBanner,
        releaseMarchShell: releaseMarchShell,
        resetAfterFight: resetAfterFight,
        resetForNewGame: resetForNewGame,
        forceClearMapPick: forceClearMapPick,
        freshMarchOk: freshMarchOk,
        isQtyLive: liveQty,
        leftoverQty: leftoverQtyFlag,
        stepQty: stepQty,
        digitQty: digitQty,
        quantityKey: quantityKey,
        commitQty: commitQty,
        cancelQty: cancelQty
    };
})(window);
