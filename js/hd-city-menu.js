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
        finishPersonsBusy: false,
        personExitTries: 0,
        lastPersonExitAt: 0,
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
        lastStep4: null
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
            (state.marchReady || freshMarchOk() || state.handoff) ? '1' : '0');
        document.documentElement.setAttribute('data-baye-wizard-step',
            show ? (displayWizardStep() || 'none') : 'none');
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
        return !!(holdExit() || state.marchReady || state.handoff);
    }

    /* 完成选将 EXIT 已发出后到 HD 确认粮草前，多余 ENTER 会跳过 GetFood。
     * 点将队列里的 ENTER（pick-person）必须放行，否则 6 将未入引擎就 EXIT，选粮永不来。 */
    function holdEnterForFood() {
        return !!(state.battleMake && state.personExitSent && !state.foodConfirmedThisMarch &&
            !state.marchReady && !state.handoff);
    }

    function allowEnterDuringFoodHold(reason) {
        return reason === 'qty-ok' || reason === 'dismiss-live-disaster' ||
            reason === 'dismiss-leftover-help';
    }

    function engineSendKey(code, reason) {
        if (code === VK.ENTER && holdEnterForFood() && !allowEnterDuringFoodHold(reason)) {
            state.lastBlockedEnter = reason || 'unknown';
            console.warn('[hd-city-menu] blocked ENTER until GetFood confirm', state.lastBlockedEnter);
            return false;
        }
        if (code === VK.EXIT && holdExit() && reason !== 'finish-persons' && reason !== 'qty-cancel') {
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

    function pickIndex(target, thenEnter, reason) {
        var keys = keysToIndex(target);
        if (thenEnter) {
            keys.push(VK.ENTER);
        }
        enqueueKeys(keys, 55, reason || '');
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
            liveFood: liveGetFood()
        };
        state.step4Trace = (state.step4Trace || []).concat([row]).slice(-28);
        state.lastStep4 = row;
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

    function confirmMarchTarget(cityIndex, opts) {
        opts = opts || {};
        cityIndex = Number(cityIndex);
        if (!isFinite(cityIndex) || cityIndex < 0) {
            cityIndex = state.pendingTarget != null ? Number(state.pendingTarget) : firstEnemyTarget();
        }
        if (!isFinite(cityIndex) || cityIndex < 0) {
            state.marchHint = '先点邻城或地图上的目标城，再点确认出征。高亮不够。';
            noteStep4('skip-bad-city', { skipped: 'bad-city' });
            render();
            return { skipped: 'bad-city' };
        }
        if (state.marchReady || freshMarchOk()) {
            noteStep4('already-ok', { cityIndex: cityIndex, skipped: 'already-ok' });
            return { skipped: 'already-ok', cityIndex: cityIndex };
        }
        if (leftoverQtyFlag() && !liveGetFood()) {
            clearLeftoverQtyFlag();
            noteStep4('clear-leftover-qty', { cityIndex: cityIndex });
        }
        if (liveQty()) {
            state.marchHint = '先确认粮草，再点目标城。';
            noteStep4('skip-qty', { cityIndex: cityIndex, skipped: 'qty' });
            render();
            return { skipped: 'qty', cityIndex: cityIndex };
        }
        if (state.wizardStep === 'persons' && !state.personExitSent) {
            state.marchHint = '先点至少一名将领，再点「完成选将 · 选粮出发」，不要直接点目标城。';
            noteStep4('skip-persons', { cityIndex: cityIndex, skipped: 'wizard-persons' });
            render();
            return { skipped: 'wizard-persons', cityIndex: cityIndex, hint: state.marchHint };
        }
        state.campaignPick = true;
        state.battleMake = true;
        if (engineInGetCitySet()) {
            state.acceptMarchOk = true;
        }
        if (!opts.resume) {
            state.confirmToken = (state.confirmToken || 0) + 1;
            state.walkBusy = false;
            state.lastWalkCity = null;
            state.lastWalkAt = 0;
        }
        var token = state.confirmToken;
        var attempt = opts.attempt || 0;
        noteStep4('confirm', { cityIndex: cityIndex, attempt: attempt });

        function again(ms, why) {
            if (token !== state.confirmToken) {
                return;
            }
            if (attempt >= 12) {
                if (!state.marchHint) {
                    state.marchHint = '引擎未确认目标城。再点一次「' +
                        (cityName(cityIndex) || '邻城') + '」或「确认出征」。';
                }
                noteStep4('give-up', { cityIndex: cityIndex, skipped: why || 'max-retry', attempt: attempt });
                render();
                return;
            }
            setTimeout(function () {
                if (token !== state.confirmToken) {
                    return;
                }
                confirmMarchTarget(cityIndex, {
                    resume: true,
                    attempt: attempt + 1,
                    retriedOwn: opts.retriedOwn,
                    retriedOk: opts.retriedOk
                });
            }, ms || 220);
        }

        if (state.confirmingTarget && !freshMarchOk() && !state.marchReady) {
            noteStep4('await-dest', { cityIndex: cityIndex, attempt: attempt });
            again(240, 'await-dest');
            return { deferred: 'await-dest', cityIndex: cityIndex };
        }
        if (!engineInGetCitySet()) {
            var driven = driveFoodToCitySet('confirm-need-city-set');
            var phase = engineMarchPhase();
            var m0 = engineMarch();
            var mc0 = engineMapCityIndex();
            state.pendingTarget = null;
            state.marchHint = 'UI 步骤4 ≠ 引擎 GetCitySet。' + marchDebugLine() +
                '。河内确认已拒绝，先把粮草交到 pick=1。';
            noteStep4('refuse-no-city-set', {
                cityIndex: cityIndex,
                attempt: attempt,
                skipped: (driven && driven.deferred) || phase
            });
            render();
            if (driven && driven.deferred) {
                again(280, driven.deferred);
                return { deferred: driven.deferred, cityIndex: cityIndex, phase: phase, pick: !!(m0 && m0.pick), mapCity: mc0 };
            }
            again(300, 'no-city-set');
            return { skipped: 'no-city-set', cityIndex: cityIndex, phase: phase, pick: !!(m0 && m0.pick), mapCity: mc0 };
        }
        markTargetSelected(cityIndex);
        if (waitingArmout()) {
            noteStep4('armout', { cityIndex: cityIndex, attempt: attempt });
            dismissLiveArmout();
            scheduleMarchWatch();
            again(200, 'armout');
            return { deferred: 'armout', cityIndex: cityIndex };
        }
        var refuse = liveEngineReport();
        if (/我方城池|无法到达/.test(refuse)) {
            state.marchHint = /无法到达/.test(refuse)
                ? '引擎拒绝：无法到达。只能打 CITY_LINKR 邻城。'
                : '引擎提示「我方城池」（多半确认了出发城）。已关掉，改走敌邻。';
            noteStep4('engine-refuse', { cityIndex: cityIndex, attempt: attempt, skipped: refuse });
            engineSendKey(VK.ENTER);
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            render();
            again(240, 'engine-refuse');
            return { deferred: 'engine-refuse', cityIndex: cityIndex };
        }
        if (chooseTargetOverlay()) {
            state.dismissedObj = true;
            advanceWizard('target-tip', 'confirm-dismiss-tip');
            noteStep4('dismiss-tip', { cityIndex: cityIndex, attempt: attempt });
            engineSendKey(VK.ENTER);
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            advanceWizard('map-pick', 'confirm-after-tip');
            again(280, 'choose-target');
            return { deferred: 'choose-target', cityIndex: cityIndex };
        }
        if (!mapPickActive()) {
            state.marchHint = attempt < 8
                ? '等待引擎打开目标地图…'
                : '引擎未打开目标选择（GetCitySet）。再点邻城或「确认出征」。';
            noteStep4('wait-pick', { cityIndex: cityIndex, attempt: attempt, skipped: 'not-map-pick' });
            render();
            again(220, 'not-map-pick');
            return { deferred: 'wait-pick', cityIndex: cityIndex };
        }
        state.marchHint = '';
        var walked = walkCursorToCity(cityIndex, true, {
            force: true,
            requireLanded: true,
            confirm: true,
            retriedOwn: !!opts.retriedOwn,
            retriedOk: !!opts.retriedOk,
            step4Token: token,
            attempt: attempt
        });
        scheduleMarchWatch();
        return walked || { cityIndex: cityIndex };
    }

    function walkCursorToCity(cityIndex, thenEnter, opts) {
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
                if (shown === cityIndex) {
                    sendEnter();
                    return;
                }
                if (shown >= 0 && shown !== cityIndex && n >= 6) {
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
                if (n >= 16) {
                    if (requireLanded && !cursorOnCity(cityIndex) && !landed()) {
                        state.marchHint = '光标未落到目标城，未向引擎确认。再点一次。';
                        noteStep4('enter-blocked-cursor', { cityIndex: cityIndex });
                        render();
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
                    if (state.confirmingTarget && !freshMarchOk() && !state.marchReady) {
                        noteStep4('enter-wait-dest', { cityIndex: cityIndex });
                        return;
                    }
                    if (opts.confirm && !freshMarchOk() && !state.marchReady) {
                        noteStep4('enter-noop', { cityIndex: cityIndex, skipped: 'enter-noop' });
                        confirmMarchTarget(cityIndex, {
                            resume: true,
                            attempt: (opts.attempt || 0) + 1
                        });
                    }
                }, 280);
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

    function dismissLiveArmout() {
        if (!waitingArmout()) {
            return false;
        }
        state.acceptMarchOk = true;
        state.campaignPick = true;
        advanceWizard('map-pick', 'armout-enter');
        engineSendKey(VK.ENTER);
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        return true;
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
        if (!state.personExitSent || showingQty() || mapPickActive() || liveGetFood()) {
            return false;
        }
        if (!state.sawQtyThisMarch) {
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
    function realMarchDest(m) {
        m = m || engineMarch();
        if (!(m && m.ok)) {
            return false;
        }
        var from = Number(m.city);
        var obj = Number(m.obj);
        if (!isFinite(obj) || obj < 0 || obj >= 64 || obj === 0xff) {
            return false;
        }
        if (isFinite(from) && obj === from) {
            return false;
        }
        var seq = marchSeqOf(m);
        if (seq && seq <= (state.consumedMarchSeq || 0)) {
            return false;
        }
        return true;
    }

    function freshMarchOk() {
        var m = engineMarch();
        if (!(state.acceptMarchOk && m && m.ok)) {
            return false;
        }
        if (!realMarchDest(m)) {
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
        state.confirmingTarget = false;
        try {
            if (window.baye && baye.data && (!baye.hdEngineReady || baye.hdEngineReady())) {
                if (baye.data.g_hdMarchOk != null) {
                    baye.data.g_hdMarchOk = 0;
                }
                /* leftover dest=河内 会让下一趟向导以为已有目标。ok/obj/city 一并清。 */
                if (baye.data.g_hdMarchObj != null) {
                    baye.data.g_hdMarchObj = 0;
                }
                if (baye.data.g_hdMarchCity != null) {
                    baye.data.g_hdMarchCity = 0;
                }
                if (baye.data.g_hdMarchTime != null) {
                    baye.data.g_hdMarchTime = 0;
                }
            }
        } catch (e) {}
        if (global.BayeHdDialog && typeof BayeHdDialog.clearLeftoverMarch === 'function') {
            BayeHdDialog.clearLeftoverMarch();
        }
        /* 活着的过图 GetCitySet 不能写 0。败仗后 leftover dest 已清，pick=1 交给 landOwnedCity。 */
        if (!liveOverworldGetCitySet()) {
            forceClearMapPick('consume-march');
        }
    }

    function forceClearMapPick(why) {
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
        consumeLeftoverMarch();
        /* 败仗后 leftover dest 已清。若仍 pick=1 battlePick=0，是过图 GetCitySet，不能写 0。
         * battlePick 残留 1（GetCitySet 已返回）才写掉，避免挡住下一趟 GetFood。 */
        try {
            if (window.baye && baye.data && (!baye.hdEngineReady || baye.hdEngineReady())) {
                if (baye.data.g_hdBattlePick != null && !mapPickActive()) {
                    baye.data.g_hdBattlePick = 0;
                }
                if (baye.data.g_hdFightOver != null) {
                    baye.data.g_hdFightOver = 0;
                }
                if (baye.data.g_hdFightActive != null) {
                    baye.data.g_hdFightActive = 0;
                }
                if (baye.data.g_hdFightWait != null) {
                    baye.data.g_hdFightWait = 0;
                }
            }
        } catch (e) {}
        if (!liveOverworldGetCitySet()) {
            forceClearMapPick('after-fight-stale');
        }
        var q = engineQty();
        if (q && q.active) {
            state.qtyDismissed = true;
            clearLeftoverQtyFlag();
        }
        clearLeftoverQtyValues();
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
        state.qtyDismissed = false;
        state.qtyDismissedAt = 0;
        state.wizardStep = 'none';
        state.marchReady = false;
        state.handoff = false;
        state.handoffStatus = '';
        state.confirmingTarget = false;
        state.acceptMarchOk = false;
        stopMarchWatch();
        /* 全军覆没 / 选择目标 残留文本回车 = 策略结束。只有活着的 async 灾异 / 拥立才回车。 */
        var afterReport = liveEngineReport();
        var names0 = (engineMenuItems().names || [])[0] || '';
        if (/拥立|成为君主/.test(afterReport || '') && names0 && names0 !== '策略结束' &&
            names0 !== '内政' && names0 !== '军备' && names0 !== '侦察' && names0 !== '开垦') {
            engineSendKey(VK.ENTER, 'after-fight-enthron');
        } else if (leftoverDisasterReport(afterReport) && liveReportAsync() &&
            !looksLikeFunctionMenu()) {
            engineSendKey(VK.ENTER, 'after-fight-report');
        } else {
            clearStaleDisasterReport();
            try {
                if (window.baye && baye.data && baye.data.g_hdReportGbk != null &&
                    (!baye.hdEngineReady || baye.hdEngineReady())) {
                    if (leftoverChooseTarget(liveEngineReport()) ||
                        leftoverMarchReport(liveEngineReport()) ||
                        /全军覆没|大获全胜/.test(liveEngineReport() || '')) {
                        baye.data.g_hdReportGbk = '';
                    }
                }
            } catch (e2) {}
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        if (global.BayeHdOverworld && typeof BayeHdOverworld.afterFightMapReady === 'function') {
            BayeHdOverworld.afterFightMapReady('after-fight');
        }
    }

    /* 同页 新君登基 / 读档：HD 出征旗标不能带到下一局，否则完成选将空操作、GetFood 永不来。 */
    function resetForNewGame(why) {
        why = why || 'new-game';
        noteStep4('reset-new-game', { skipped: why });
        stopMarchWatch();
        state.queue = [];
        state.sending = false;
        state.battleMake = false;
        state.campaignPick = false;
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
        state.pickedPersons = 0;
        state.foodGaveUp = false;
        state.foodAttempt = 0;
        state.foodRecovered = false;
        state.foodRecoverEnter = false;
        state.foodRecoverNeeded = false;
        state.sawQtyThisMarch = false;
        state.sawGetFoodUi = false;
        state.foodConfirmedThisMarch = false;
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
        state.marchHint = '';
        state.lastBlockedEnter = '';
        state.lastBlockedExit = '';
        state.lastExit = '';
        state.deepKind = '';
        state.deepLabel = '';
        state.deepStep = 0;
        state.deepSig = '';
        try {
            if (window.baye && baye.data && (!baye.hdEngineReady || baye.hdEngineReady())) {
                if (baye.data.g_hdBattlePick != null) {
                    baye.data.g_hdBattlePick = 0;
                }
                if (baye.data.g_hdMapPick != null) {
                    baye.data.g_hdMapPick = 0;
                }
                if (baye.data.g_hdFightOver != null) {
                    baye.data.g_hdFightOver = 0;
                }
                if (baye.data.g_hdFightActive != null) {
                    baye.data.g_hdFightActive = 0;
                }
                if (baye.data.g_hdFightWait != null) {
                    baye.data.g_hdFightWait = 0;
                }
            }
        } catch (e) {}
        clearLeftoverQtyValues();
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

    /* PlayerTactic 正在 GetCitySet：写 pick=0 是撒谎，下一发 ENTER 会点进空城（无人占领）。
     * pick=1 且 !battlePick 就是过图 GetCitySet。残留菜单字节「侦察/开垦」不能当成已在军备，
     * 否则 DOWN×4 会把光标从天水(3,2)走到巴郡(3,6)。 */
    function liveOverworldGetCitySet() {
        return leftoverOverworldPick();
    }

    function bindOpenedMapCity(cityIndex, why) {
        cityIndex = cityIndex != null && cityIndex >= 0 ? Number(cityIndex) : state.cityIndex;
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
        while (y > to.y) { dirs.push(VK.UP); y -= 1; }
        while (y < to.y) { dirs.push(VK.DOWN); y += 1; }
        while (x > to.x) { dirs.push(VK.LEFT); x -= 1; }
        while (x < to.x) { dirs.push(VK.RIGHT); x += 1; }
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
        var names = engineMenuItems().names || [];
        var n0 = names[0] || '';
        /* 出征向导里 g_hdMenuBytes 常残留「策略结束 / 侦察 / 开垦」，不是真离开 BattleMake。 */
        if (n0 === '侦察') {
            return liveJunbeiMenu();
        }
        if (n0 === '内政') {
            return liveCityRootMenu();
        }
        if (n0 === '军备' || n0 === '外交') {
            return names.indexOf('内政') >= 0 || names.indexOf('状况') >= 0;
        }
        if (n0 === '开垦') {
            return names.length >= 2 && (names.indexOf('招商') >= 0 || names.indexOf('搜索') >= 0);
        }
        if (n0 === '策略结束') {
            return !!(looksLikeFunctionMenu() &&
                (Date.now() - (state.lastFuncMenuIdle || 0)) < 1400);
        }
        return false;
    }

    function engineStillInPersonPick() {
        if (liveGetFood() || engineQtyActiveMin1() || qtyLooksLikeGetFood()) {
            return false;
        }
        if (engineLeftBattleMake()) {
            return false;
        }
        /* 空菜单 / 残留「策略结束」/ 将表：EXIT 还没进 GetFood。 */
        return true;
    }

    function qtyLooksLikeGetFood(q) {
        q = q || engineQty();
        return !!(q && Number(q.min) >= 1 && Number(q.max) >= 1);
    }

    function latentGetFood() {
        /* C NumOperate 确认/取消后仍留下 min/max、active=0。出征 GetFood min 恒 1，
         * 征兵 min=0。pex 后 min≥1/max≥1 且未离开 BattleMake，就是选粮（含 active 被 leftover 清掉）。 */
        if (!state.battleMake || !state.personExitSent || state.foodGaveUp ||
            state.foodConfirmedThisMarch || state.marchReady || freshMarchOk()) {
            return false;
        }
        if (engineLeftBattleMake()) {
            return false;
        }
        return qtyLooksLikeGetFood();
    }

    function restoreGetFoodActive(why) {
        var q = engineQty();
        if (!qtyLooksLikeGetFood(q) || (q && q.active)) {
            return !!(q && q.active);
        }
        try {
            if (window.baye && baye.data && baye.data.g_hdQtyActive != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdQtyActive = 1;
                noteStep4('restore-qty-active', { skipped: why || 'latent-food' });
            }
        } catch (e) {}
        return true;
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
        state.marchHint = '引擎已打开选粮，请确认粮草。' + marchDebugLine();
        scheduleMarchWatch();
        render();
        return true;
    }

    function liveGetFood() {
        var q = engineQty();
        /* 活着的出征 GetFood：min 恒 ≥1。引擎可能比 HD「完成选将」先结束选将。
         * 不能要求 personExitSent，否则会把提前打开的选粮当 leftover 写掉 active。 */
        if (state.battleMake && q && q.active && Number(q.min) >= 1) {
            var before = state.qtyBeforePersonExit;
            if (!(before && before.active && before.min >= 1 && qtySameAs(before, qtySnapshot()))) {
                return true;
            }
        }
        return latentGetFood();
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
        /* 点河内后 GetCitySet 已返回、AddFightOrder 还没写 dest：C 仍应算在出征选城。 */
        if (state.confirmingTarget && state.battleMake && foodReadyForCitySet() &&
            !state.foodGaveUp && !freshMarchOk() && !state.marchReady) {
            return true;
        }
        /* 必须 C 出征 GetCitySet，且本趟 HD 见过并确认过 GetFood。
         * personExitSent / leftover battlePick 不能跳过选粮。 */
        if (!foodReadyForCitySet()) {
            return false;
        }
        if (!(battlePickActive() && mapPickActive())) {
            return false;
        }
        if (liveGetFood()) {
            return false;
        }
        return true;
    }

    function displayWizardStep() {
        var phase = engineMarchPhase();
        var map = {
            'march-ok': 'march-ok',
            'get-city-set': 'map-pick',
            'armout': 'march-ok',
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
        if (freshMarchOk() || state.marchReady) {
            return 'march-ok';
        }
        if (liveGetFood() || (state.personExitSent && !foodReadyForCitySet() && !state.foodGaveUp)) {
            return liveGetFood() ? 'get-food' : 'wait-get-food';
        }
        if (engineInGetCitySet()) {
            return 'get-city-set';
        }
        if (waitingArmout()) {
            return 'armout';
        }
        if (state.personExitSent && leftoverChooseTarget(liveEngineReport()) &&
            foodReadyForCitySet() && !mapPickActive()) {
            return 'choose-target';
        }
        if (!state.personExitSent) {
            return 'persons';
        }
        if (!state.sawQtyThisMarch) {
            return 'wait-get-food';
        }
        return 'wait-get-city-set';
    }

    function liveTargetStep() {
        return engineInGetCitySet();
    }

    /* GetCitySet 已返回，引擎停在 ShowConstStrMsg(部队已出发)，AddFightOrder 还没跑。 */
    function waitingArmout() {
        if (freshMarchOk() || state.marchReady || mapPickActive() || showingQty() || liveGetFood()) {
            return false;
        }
        if (!state.personExitSent || !foodReadyForCitySet()) {
            return false;
        }
        return leftoverMarchReport(liveEngineReport());
    }

    function usesMapCursor(kind, step) {
        /* 只有引擎真在 GetCitySet（pick=1）才画城列表。向导步骤不够。 */
        return !!(waitingArmout() || engineInGetCitySet());
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
        return /农业|商业|开发度|变为|无足够金钱|金钱不足|城中无空闲武将/.test(String(text || ''));
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
        var ov = leftoverMarchOverlay();
        var visible = !!(ov.blocking || ov.engineHelp || ov.help || (ov.open && ov.farm));
        if (ov.open || ov.engineHelp || leftoverFarmReportText(liveEngineReport())) {
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            if (global.BayeHdDialog && typeof BayeHdDialog.dismissLeftoverSpeech === 'function') {
                BayeHdDialog.dismissLeftoverSpeech();
            }
            if (!liveReportAsync() && leftoverFarmReportText(liveEngineReport())) {
                try {
                    if (window.baye && baye.data && baye.data.g_hdReportGbk != null &&
                        (!baye.hdEngineReady || baye.hdEngineReady())) {
                        baye.data.g_hdReportGbk = '';
                    }
                } catch (e) {}
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
        if (sent) {
            noteStep4('requeue-picks', { skipped: why || 'overlay', attempt: sent });
        }
        return sent;
    }

    function clearStaleDisasterReport() {
        if (!leftoverDisasterReport(liveEngineReport()) || liveReportAsync()) {
            return false;
        }
        try {
            if (window.baye && baye.data && baye.data.g_hdReportGbk != null &&
                (!baye.hdEngineReady || baye.hdEngineReady())) {
                baye.data.g_hdReportGbk = '';
            }
        } catch (e) {}
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

    function driveFoodToCitySet(why) {
        if (state.confirmingTarget && !freshMarchOk() && !state.marchReady) {
            return { deferred: 'await-dest', phase: engineMarchPhase() };
        }
        if (state.foodGaveUp) {
            return { deferred: 'gave-up', phase: engineMarchPhase() };
        }
        if (state.marchReady || freshMarchOk() || engineInGetCitySet()) {
            return { ok: true, phase: engineMarchPhase() };
        }
        if (foodReadyForCitySet() || liveGetFood()) {
            clearBattleMakeLeftoverPick(why || 'drive-food');
        }
        if (bindLiveGetFoodQty(why || 'drive-bind')) {
            return { deferred: 'wait-food-ui', phase: 'get-food' };
        }
        if (adoptLiveGetFood(why || 'drive')) {
            /* engine 已打开 GetFood：只展示数量条，等 HD「确认」再回车。 */
            var liveQ = engineQty();
            if (liveQ && Number(liveQ.max) <= 0) {
                state.marchHint = '城中无粮，无法确认选粮。' + marchDebugLine();
                scheduleMarchWatch();
                return { deferred: 'no-city-food', phase: 'get-food' };
            }
            state.marchHint = '引擎已打开选粮，请确认粮草。' + marchDebugLine();
            advanceWizard('food', 'wait-food-ui');
            scheduleMarchWatch();
            render();
            return { deferred: 'wait-food-ui', phase: 'get-food' };
        }
        var q = engineQty();
        if (q && q.active && leftoverQtyFlag()) {
            clearLeftoverQtyFlag();
            return { deferred: 'clear-leftover-qty', phase: engineMarchPhase() };
        }
        if (waitingGetFoodSoftLock()) {
            if (leftoverOverworldPick()) {
                clearStaleMapPick(why || 'drive-food');
            }
            if (leftoverDisasterReport(liveEngineReport()) && !liveReportAsync()) {
                clearStaleDisasterReport();
            }
            var liveFunc = looksLikeFunctionMenu() &&
                (Date.now() - (state.lastFuncMenuIdle || 0)) < 1400;
            if (!liveFunc) {
                if (state.lastPersonExitAt && Date.now() - state.lastPersonExitAt < 800) {
                    state.marchHint = '等待引擎打开选粮… ' + marchDebugLine();
                    scheduleMarchWatch();
                    return { deferred: 'wait-after-exit', phase: engineMarchPhase() };
                }
                var report = liveEngineReport();
                /* 只有活着的灾异 ShowConstStrMsg 才回车。过月残留文本（async=0）回车 = 策略结束。 */
                if (!state.foodRecoverEnter && leftoverDisasterReport(report) &&
                    liveReportAsync() && !thisMarchGetFoodOpened()) {
                    state.foodRecoverEnter = true;
                    state.foodRecoverNeeded = true;
                    state.foodRecovered = true;
                    state.lastPersonExitAt = Date.now();
                    noteStep4('drive-food-enter-report', { skipped: why || 'live-disaster' });
                    if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                        BayeHdDialog.close({ silent: true });
                    }
                    engineSendKey(VK.ENTER);
                    state.marchHint = '选粮未打开，先回车关掉活着的灾异。' + marchDebugLine();
                    scheduleMarchWatch();
                    return { deferred: 'recover-report-enter', phase: engineMarchPhase() };
                }
                var ov = leftoverMarchOverlay();
                if ((ov.blocking || ov.engineHelp || ov.help || ov.farm) &&
                    (state.overlayRetry || 0) < 1 && !thisMarchGetFoodOpened()) {
                    state.overlayRetry = 1;
                    dismissMarchOverlay('drive-food-overlay');
                    state.marchHint = '已关掉残留帮助/报告，再试完成选将。' + marchDebugLine();
                    if (!state.lastExit) {
                        state.personExitSent = false;
                        state.finishPersonsBusy = false;
                        state.foodGaveUp = false;
                        state.finishVisibleRetry = (state.finishVisibleRetry || 0) + 1;
                        finishPersonPick();
                        return { deferred: 'overlay-retry-finish', phase: engineMarchPhase() };
                    }
                    var personsLive = cityPersons(state.cityIndex).length;
                    var startLive = state.enginePersonsAtPickStart || state.enginePersonsAtFinish || personsLive;
                    if (startLive && personsLive < startLive) {
                        state.personExitTries = (state.personExitTries || 0) + 1;
                        state.lastPersonExitAt = Date.now();
                        engineSendKey(VK.EXIT, 'finish-persons');
                        scheduleMarchWatch();
                        render();
                        return { deferred: 'overlay-retry-exit', phase: engineMarchPhase() };
                    }
                    scheduleMarchWatch();
                    render();
                    return { deferred: 'overlay-dismissed', phase: engineMarchPhase() };
                }
                var GETFOOD_OPEN_MS = 8000;
                var GETFOOD_RETRY_MS = 1200;
                var sinceExit = state.lastPersonExitAt ? (Date.now() - state.lastPersonExitAt) : 0;
                var waited = sinceExit > GETFOOD_OPEN_MS;
                var n0 = (engineMenuItems().names || [])[0] || '';
                var leftBattle = engineLeftBattleMake();
                var stillPick = engineStillInPersonPick();
                var qNow = engineQty();
                /* 只有 min≥1 且 max≥1 才是 GetFood。征兵残留 min=0/max=940 也要再发 EXIT。 */
                var minMaxZero = !qtyLooksLikeGetFood(qNow);
                /* 开垦后水灾/选择目标残留不能在 1s 内再 EXIT：会取消刚打开的 GetFood。
                 * 0 点将就 EXIT 会离开 BattleMake；遮罩吃掉 EXIT 时 lastExit 为空，先补发完成选将。 */
                if (!thisMarchGetFoodOpened() && !state.foodGaveUp &&
                    !state.lastExit && (state.finishVisibleRetry || 0) < 1) {
                    dismissMarchOverlay('drive-no-exit');
                    state.personExitSent = false;
                    state.finishPersonsBusy = false;
                    state.finishVisibleRetry = 1;
                    state.marchHint = '完成选将未发出 EXIT（残留遮罩），已关掉并再点一次。' + marchDebugLine();
                    finishPersonPick();
                    return { deferred: 'retry-finish-no-exit', phase: engineMarchPhase() };
                }
                /* 真回到军备「侦察」：EXIT 取消了 BattleMake，重进出征再点将。 */
                if (!thisMarchGetFoodOpened() && !state.foodGaveUp &&
                    leftBattle && liveJunbeiMenu() &&
                    (state.personExitTries || 0) < 3 &&
                    sinceExit >= GETFOOD_RETRY_MS) {
                    state.personExitSent = false;
                    state.finishPersonsBusy = false;
                    state.personExitTries = (state.personExitTries || 0) + 1;
                    state.lastPersonExitAt = Date.now();
                    state.battleMake = true;
                    setWizardStep('persons', 'reenter-battle');
                    noteStep4('drive-reenter-battle', {
                        skipped: why || 'left-to-scout',
                        attempt: state.personExitTries
                    });
                    dismissMarchOverlay('reenter-battle');
                    enqueueKeys([VK.DOWN, VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER], 70, 'retry-battle-make');
                    setTimeout(function () {
                        if (liveGetFood() || engineQtyActiveMin1() || state.personExitSent) {
                            return;
                        }
                        requeuePickedPersons('reenter-battle');
                        setTimeout(function () {
                            if (!state.personExitSent && !state.finishPersonsBusy) {
                                finishPersonPick();
                            }
                        }, 420);
                    }, 360);
                    state.marchHint = 'EXIT 已离开选将回到军备，已重进出征。' + marchDebugLine();
                    scheduleMarchWatch();
                    render();
                    return { deferred: 'reenter-battle-make', phase: engineMarchPhase() };
                }
                /* ~1.2s 后仍 min/max=0 且仍在选将：先关 HELP 再补 EXIT。
                 * 不要等 8s，也不要把残留「策略结束」当 leftBattle。q 的 min/max≥1 绑条仍优先。 */
                if (!thisMarchGetFoodOpened() && !state.foodGaveUp &&
                    minMaxZero && stillPick && !leftBattle &&
                    sinceExit >= GETFOOD_RETRY_MS &&
                    (state.personExitTries || 0) < 3 &&
                    !engineQtyActiveMin1()) {
                    var nowPersonsEarly = cityPersons(state.cityIndex).length;
                    var startPersonsEarly = state.enginePersonsAtPickStart ||
                        state.enginePersonsAtFinish || nowPersonsEarly;
                    if (!(startPersonsEarly && nowPersonsEarly < startPersonsEarly)) {
                        state.marchHint = '选粮未打开，点将尚未进入引擎，不重发 EXIT。' + marchDebugLine();
                        scheduleMarchWatch();
                        return { deferred: 'wait-engine-picks', phase: engineMarchPhase() };
                    }
                    state.personExitTries = (state.personExitTries || 0) + 1;
                    state.lastPersonExitAt = Date.now();
                    state.foodRecovered = true;
                    state.foodRecoverNeeded = false;
                    noteStep4('drive-person-exit', {
                        skipped: why || 'retry-exit-early',
                        attempt: state.personExitTries
                    });
                    if (dismissMarchOverlay('retry-exit-help')) {
                        enqueueKeys([VK.EXIT], 240, 'finish-persons');
                        state.marchHint = '残留帮助挡住 EXIT，已关掉后再发 EXIT。' + marchDebugLine();
                    } else {
                        engineSendKey(VK.EXIT, 'finish-persons');
                        state.marchHint = '选粮未打开（min/max=0），已再发 EXIT 进入 GetFood。' +
                            marchDebugLine();
                    }
                    scheduleMarchWatch();
                    render();
                    return { deferred: 'retry-person-exit', phase: engineMarchPhase() };
                }
                if (!thisMarchGetFoodOpened() && !state.foodGaveUp &&
                    sinceExit >= 4000 &&
                    (state.foodRecoverNeeded || waited) &&
                    (state.personExitTries || 0) < 3 &&
                    !engineQtyActiveMin1() &&
                    !leftBattle) {
                    var nowPersons = cityPersons(state.cityIndex).length;
                    var startPersons = state.enginePersonsAtPickStart || state.enginePersonsAtFinish || nowPersons;
                    if (!(startPersons && nowPersons < startPersons)) {
                        state.marchHint = '选粮未打开，点将尚未进入引擎，不重发 EXIT。' + marchDebugLine();
                        scheduleMarchWatch();
                        return { deferred: 'wait-engine-picks', phase: engineMarchPhase() };
                    }
                    state.personExitTries = (state.personExitTries || 0) + 1;
                    state.lastPersonExitAt = Date.now();
                    state.foodRecovered = true;
                    state.foodRecoverNeeded = false;
                    noteStep4('drive-person-exit', { skipped: why || 'retry-exit', attempt: state.personExitTries });
                    dismissMarchOverlay('retry-exit');
                    engineSendKey(VK.EXIT, 'finish-persons');
                    state.marchHint = '选粮未打开，已安全再发一次 EXIT。' + marchDebugLine();
                    scheduleMarchWatch();
                    return { deferred: 'retry-person-exit', phase: engineMarchPhase() };
                }
                if (!thisMarchGetFoodOpened() &&
                    ((state.personExitTries || 0) >= 3 || state.foodGaveUp) &&
                    state.lastPersonExitAt &&
                    (Date.now() - state.lastPersonExitAt > GETFOOD_OPEN_MS)) {
                    /* 再发 EXIT 后再等一轮。立刻认输会把刚打开的 GetFood 当失败。 */
                    state.foodGaveUp = true;
                    state.personExitSent = false;
                    state.finishPersonsBusy = false;
                    state.foodRecoverNeeded = false;
                    state.foodRecoverEnter = false;
                    stopMarchWatch();
                    state.marchHint = '引擎未打开 GetFood。已退出选粮，请再点「完成选将」。' + marchDebugLine();
                    setWizardStep('persons', 'getfood-timeout');
                    state.deepSig = '';
                    render();
                    return { deferred: 'getfood-timeout', phase: engineMarchPhase() };
                }
            }
        }
        if (state.personExitSent && foodReadyForCitySet() && !battlePickActive() &&
            leftoverChooseTarget(liveEngineReport()) && !mapPickActive()) {
            if (state.lastTipEnterAt && Date.now() - state.lastTipEnterAt < 700) {
                return { deferred: 'tip-cooldown', phase: engineMarchPhase() };
            }
            state.lastTipEnterAt = Date.now();
            state.dismissedObj = true;
            noteStep4('drive-tip-enter', { skipped: why || 'tip' });
            engineSendKey(VK.ENTER);
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            advanceWizard('target-tip', 'drive-tip');
            scheduleMarchWatch();
            return { deferred: 'tip-enter', phase: 'choose-target' };
        }
        return { ok: false, phase: engineMarchPhase() };
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

    function leftoverQtyFlag() {
        var q = engineQty();
        if (!(q && q.active)) {
            return false;
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
        if (!(q && q.active) || leftoverQtyFlag()) {
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
        if (state.qtyDismissed) {
            return false;
        }
        return !!(state.deepKind === 'person-qty' && state.deepStep === 1 && !state.battleMake);
    }

    function clearLeftoverQtyValues() {
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

    function commitQty() {
        if (leftoverQtyFlag() || !liveQty()) {
            state.qtyDismissed = true;
            state.qtyDismissedAt = Date.now();
            clearLeftoverQtyFlag();
            render();
            scheduleMarchWatch();
            return;
        }
        engineSendKey(VK.ENTER, 'qty-ok');
        state.qtyDismissed = true;
        state.qtyDismissedAt = Date.now();
        if (state.battleMake && (state.personExitSent || liveGetFood() || state.sawGetFoodUi)) {
            state.sawGetFoodUi = true;
            state.foodConfirmedThisMarch = true;
            state.sawQtyThisMarch = true;
            advanceWizard('food', 'commit-qty');
            clearBattleMakeLeftoverPick('commit-qty');
        }
        setTimeout(function () {
            if (liveGetFood() || liveQty()) {
                engineSendKey(VK.ENTER, 'qty-ok');
            }
            setTimeout(function () {
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
        engineSendKey(VK.EXIT, 'qty-cancel');
        state.qtyDismissed = true;
        state.qtyDismissedAt = Date.now();
        setTimeout(function () {
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

    function cityPersons(index) {
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
            if (pind === null || !isFinite(pind) || pind < 0 || pind >= 0xfffe || pind >= qlen) {
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

    function probeDeepItems() {
        var kind = state.deepKind;
        var step = state.deepStep;
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
            ':' + ((freshMarchOk() || state.marchReady || state.handoff) ? 'ok' : '') +
            ':' + (state.handoff ? ('h:' + (state.handoffStatus || '')) : '') +
            ':' + (state.personExitSent ? 'pex' : '') +
            ':' + (state.acceptMarchOk ? 'acc' : '') +
            ':' + (state.wizardStep || '') +
            ':' + displayWizardStep() +
            ':' + engineMarchPhase() +
            ':' + (engineInGetCitySet() ? 'gcs' : '') +
            ':' + (state.marchHint || '') +
            ':' + (state.pendingTarget == null ? '' : state.pendingTarget) +
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
                '<span class="hd-city-menu-wizard-debug" data-hd-march-debug="1">' +
                marchDebugLine() + '</span>';
            list.appendChild(qtySteps);
            if (!engineInGetCitySet() && !freshMarchOk() && !state.marchReady &&
                !state.confirmingTarget &&
                (state.wizardStep === 'map-pick' ||
                (state.pendingTarget != null && shownStep !== 'march-ok') ||
                shownStep === 'target-tip' || shownStep === 'food' ||
                (battlePickActive() && !foodReadyForCitySet()))) {
                var mismatch = document.createElement('div');
                mismatch.className = 'hd-city-menu-march-hint';
                mismatch.setAttribute('data-hd-cityset-mismatch', '1');
                if (state.foodGaveUp || waitingGetFoodSoftLock() ||
                    (shownStep === 'food' && !liveGetFood()) ||
                    (battlePickActive() && !foodReadyForCitySet() && !liveGetFood())) {
                    mismatch.setAttribute('data-hd-food-mismatch', '1');
                    mismatch.textContent = state.foodGaveUp
                        ? ('引擎未打开 GetFood。已退出选粮，请再点「完成选将」。' + marchDebugLine())
                        : leftoverOverworldPick()
                        ? ('过图残留 pick=1，不是选粮。' + marchDebugLine())
                        : ('引擎未打开 GetFood，不能确认河内。请先确认粮草。' + marchDebugLine());
                } else if (leftoverOverworldPick()) {
                    mismatch.textContent = '过图 leftover pick=1，不是出征 GetCitySet。' + marchDebugLine();
                } else {
                    mismatch.textContent = '引擎未打开出征 GetCitySet，不能确认河内。' + marchDebugLine();
                }
                if (mismatch.textContent) {
                    list.appendChild(mismatch);
                }
            }
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
                : '需「策略结束」让 PolicyExec 走军入战';
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
            var hasEnemy = state.deepItems.some(function (it) { return it && it.enemy; });
            hint.textContent = hasEnemy
                ? '点敌邻城或地图上的敌邻会立刻走格并确认出征（CITY_LINKR）。只高亮不够。'
                : '邻城都是己方。引擎不能打非邻城；点己方会提示「我方城池」，不会出发。';
            list.appendChild(hint);
            if (!showMarchOk) {
                var confirm = document.createElement('div');
                confirm.className = 'hd-city-menu-confirm-march';
                var tName = '';
                if (state.pendingTarget != null) {
                    tName = cityName(state.pendingTarget) || ('城' + (state.pendingTarget + 1));
                }
                confirm.innerHTML = '<p>' + (tName
                    ? ('已点 ' + tName + ' · 确认会走 setx/sety 并对引擎回车')
                    : '先点邻城或地图目标，再可按确认出征') + '</p>' +
                    '<button type="button" data-hd-confirm-march' +
                    (state.pendingTarget == null ? ' disabled' : '') + '>' +
                    (tName ? ('确认出征 · ' + tName) : '确认出征') + '</button>';
                list.appendChild(confirm);
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
                var shownHint = displayWizardStep();
                stepHint = '出征步骤 ' + (WIZARD_LABEL[shownHint] || WIZARD_LABEL[state.wizardStep]);
                if (!engineInGetCitySet() && (shownHint === 'map-pick' || state.wizardStep === 'map-pick')) {
                    stepHint += ' · 引擎未 GetCitySet';
                }
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
            clearStaleMapPick('reopen-city');
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
        /* 征兵 leftover g_hdQtyActive 进下一次城菜单时必须清掉。 */
        if (engineQty() && engineQty().active && !state.battleMake) {
            state.qtyDismissed = true;
            clearLeftoverQtyFlag();
        }
        /* 开垦/过图 leftover pick=1 必须在点军备之前写掉，否则 ENTER 会确认过图而不是进军备。 */
        bindOpenedMapCity(state.cityIndex, 'open-city');
        clearStaleMapPick('open-city');
        try {
            if (global.BayeHdSystemUi && typeof BayeHdSystemUi.isOpen === 'function' &&
                BayeHdSystemUi.isOpen() && typeof BayeHdSystemUi.close === 'function') {
                BayeHdSystemUi.close({ silent: true });
            }
        } catch (e) {}
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
                state.marchHint = marchHintForHold().replace('不要返回', '不要关菜单');
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
            state.sawGetFoodUi = false;
            state.foodConfirmedThisMarch = false;
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
        if (liveQty() || leftoverQtyFlag()) {
            cancelQty();
            return;
        }
        if (holdMenu()) {
            /* 出征向导 / 部队已出发 横幅期间 HD「返回」绝不 EXIT。 */
            if (!state.marchReady) {
                state.marchHint = marchHintForHold();
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
        /* 开垦数月后 leftover pick 还在：先回本城，再发军备/内政 ENTER。 */
        bindOpenedMapCity(state.cityIndex, 'choose-root');
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
        var names = preferEngineNames(SUBS[state.subKind] || []);
        var willMarch = deepKindFor(state.subKind, index) === 'person-city' || names[index] === '出征';
        if (willMarch && global.BayeHdDialog &&
            typeof BayeHdDialog.dismissLeftoverSpeech === 'function') {
            BayeHdDialog.dismissLeftoverSpeech();
        }
        if (willMarch) {
            clearStaleDisasterReport();
            try {
                if (window.baye && baye.data && (!baye.hdEngineReady || baye.hdEngineReady())) {
                    if (baye.data.g_hdFightOver != null) {
                        baye.data.g_hdFightOver = 0;
                    }
                    if (baye.data.g_hdFightActive != null) {
                        baye.data.g_hdFightActive = 0;
                    }
                }
            } catch (e) {}
            if (looksLikeFunctionMenu() &&
                (Date.now() - (state.lastFuncMenuIdle || 0)) < 1400) {
                engineSendKey(VK.EXIT, 'leave-leftover-func-for-march');
            }
        }
        function sendMarchKeys() {
            if (leftoverOverworldPick()) {
                return;
            }
            bindOpenedMapCity(state.cityIndex, 'choose-sub');
            /* 先清上场向导旗标，再认 leftover pick；否则 sawQtyThisMarch 仍真，清不掉。 */
            state.sawQtyThisMarch = false;
            state.sawGetFoodUi = false;
            state.foodConfirmedThisMarch = false;
            state.personExitSent = false;
            state.finishPersonsBusy = false;
            state.lastPickEnterAt = 0;
            state.enginePersonsAtFinish = 0;
            state.enginePersonsAtPickStart = 0;
            state.engineHelpOpen = false;
            state.overlayRetry = 0;
            state.finishVisibleRetry = 0;
            state.pickedPersonNames = [];
            state.foodGaveUp = false;
            state.foodAttempt = 0;
            clearStaleMapPick('choose-sub');
            var now0 = (engineMenuItems().names || [])[0] || '';
            /* 过月后 HD 已在军备，引擎还停在城池根「内政」。ENTER 出征会进内政。 */
            if (now0 === '内政') {
                enqueueKeys([VK.DOWN, VK.DOWN, VK.ENTER], 70, 'enter-junbei-for-march');
            } else {
                pickIndex(index, true);
            }
            setTimeout(function () {
                if (!state.battleMake || state.personExitSent || showingQty() || liveGetFood()) {
                    return;
                }
                if (leftoverOverworldPick()) {
                    return;
                }
                if (adoptLiveGetFood('choose-sub')) {
                    return;
                }
                var liveNames = engineMenuItems().names || [];
                if (liveNames[0] === '侦察') {
                    enqueueKeys([VK.DOWN, VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER], 70, 'retry-battle-make');
                } else if (liveNames[0] === '开垦') {
                    enqueueKeys([VK.EXIT, VK.DOWN, VK.DOWN, VK.ENTER], 70, 'retry-from-neizheng');
                }
            }, 320);
        }
        if (willMarch && leftoverOverworldPick()) {
            landOwnedCity('choose-sub-march', sendMarchKeys);
        } else if (willMarch) {
            sendMarchKeys();
        } else {
            pickIndex(index, true);
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
        state.wizardStep = (state.deepKind === 'person-city' || state.deepLabel === '出征') ? 'persons' : 'none';
        state.sawQtyThisMarch = false;
        state.sawGetFoodUi = false;
        state.foodConfirmedThisMarch = false;
        state.qtyDismissed = false;
        state.qtyDismissedAt = 0;
        state.reportAtMarchStart = liveEngineReport();
        state.lastFuncMenuIdle = 0;
        state.lastWalkCity = null;
        state.lastWalkAt = 0;
        state.walkBusy = false;
        state.pendingTarget = null;
        state.confirmToken = 0;
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
        if (state.wizardStep !== 'persons' && state.wizardStep !== 'none') {
            return;
        }
        /* 同页 新君登基 leftover：上场 personExitSent / showingQty 不能让完成选将空操作。 */
        if (state.personExitSent && !liveGetFood() && !state.foodConfirmedThisMarch &&
            !state.finishPersonsBusy) {
            state.personExitSent = false;
        }
        if (leftoverQtyFlag() && !liveGetFood()) {
            clearLeftoverQtyFlag();
        }
        if (state.finishPersonsBusy || state.personExitSent || state.marchReady) {
            return;
        }
        if (showingQty() && liveGetFood()) {
            adoptLiveGetFood('finish-persons-live-qty');
            return;
        }
        if (showingQty()) {
            return;
        }
        if (mapPickActive() && !leftoverOverworldPick()) {
            return;
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.dismissLeftoverSpeech === 'function') {
            BayeHdDialog.dismissLeftoverSpeech();
        }
        clearStaleDisasterReport();
        if (dismissMarchOverlay('finish-persons') && (state.finishVisibleRetry || 0) < 1) {
            state.finishVisibleRetry = 1;
            state.marchHint = '已关掉残留帮助/农业报告，再结束选将。' + marchDebugLine();
            render();
            setTimeout(function () {
                if (!state.personExitSent && !state.finishPersonsBusy) {
                    finishPersonPick();
                }
            }, 180);
            return;
        }
        if (!(state.pickedPersons > 0)) {
            state.marchHint = '先点至少一名将领，再点「完成选将」。';
            render();
            return;
        }
        if (liveGetFood()) {
            adoptLiveGetFood('finish-persons-live');
            advanceWizard('food', 'finish-persons-live');
            state.marchHint = '引擎已打开选粮。';
            scheduleMarchWatch();
            render();
            return;
        }
        /* 已在 BattleMake 选将：leftover pick=1 只是过图残留旗。landOwnedCity
         * 会把完成选将变成回城，EXIT 进不了 GetFood（6 将 + 开垦后常见）。 */
        if (leftoverOverworldPick() && state.battleMake && state.pickedPersons > 0) {
            try {
                if (window.baye && baye.data && baye.data.g_hdMapPick != null &&
                    (!baye.hdEngineReady || baye.hdEngineReady())) {
                    baye.data.g_hdMapPick = 0;
                }
            } catch (e) {}
            bindOpenedMapCity(state.cityIndex, 'finish-persons-stale-pick');
            noteStep4('finish-stale-pick', { skipped: 'write-0-then-exit' });
        } else if (leftoverOverworldPick()) {
            state.marchHint = '过图 leftover pick，先回本城再出征。' + marchDebugLine();
            noteStep4('finish-leftover-pick', { skipped: 'overworld-pick' });
            landOwnedCity('finish-persons-leftover', function () {
                var now0 = (engineMenuItems().names || [])[0] || '';
                if (now0 === '内政' || now0 === '外交' || now0 === '军备' || now0 === '状况') {
                    enqueueKeys([VK.DOWN, VK.DOWN, VK.ENTER], 70, 'enter-junbei-for-march');
                    setTimeout(function () {
                        if (!leftoverOverworldPick()) {
                            enqueueKeys([VK.DOWN, VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER], 70, 'retry-battle-make');
                        }
                    }, 280);
                } else if (now0 === '侦察' && !leftoverOverworldPick()) {
                    enqueueKeys([VK.DOWN, VK.DOWN, VK.DOWN, VK.DOWN, VK.ENTER], 70, 'retry-battle-make');
                }
                scheduleMarchWatch();
                render();
            });
            render();
            return;
        }
        if (state.foodGaveUp && (state.foodAttempt || 0) >= 2) {
            state.marchHint = '引擎未打开 GetFood。请返回军备重新出征。' + marchDebugLine();
            stopMarchWatch();
            render();
            return;
        }
        state.dismissedObj = false;
        /* 先排空点将 ENTER。未排空就立 personExitSent 会拦队列，EXIT 打在空将表上。 */
        state.finishPersonsBusy = true;
        state.foodAttempt = (state.foodAttempt || 0) + 1;
        state.foodGaveUp = false;
        state.qtyBeforePersonExit = qtySnapshot();
        state.foodRecoverEnter = false;
        /* 只有活着的灾异 async 才需要先回车。残留「选择目标」/水灾文本再 EXIT 会掐 GetFood。 */
        state.foodRecoverNeeded = leftoverDisasterReport(liveEngineReport()) && liveReportAsync();
        state.enginePersonsAtFinish = cityPersons(state.cityIndex).length;
        /* 完成选将时人数往往已下降。用点将前人数判断引擎是否吃掉 ENTER，
         * 不能拿 finish 瞬间人数当起点，否则 engineTook 永远假、干等 10s。 */
        if (!state.enginePersonsAtPickStart) {
            state.enginePersonsAtPickStart = state.enginePersonsAtFinish + (state.pickedPersons || 0);
        }
        clearStaleMapPick('finish-persons');
        state.campaignPick = false;
        state.marchHint = '正在结束选将，等待点将键进入引擎…';
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }
        if (leftoverDisasterReport(liveEngineReport()) && !liveReportAsync()) {
            clearStaleDisasterReport();
        }
        function sendFinishExit(started, retriedPicks) {
            started = started || Date.now();
            /* 必须等引擎人数下降后再 EXIT。只凭 lastPickEnterAt+320ms 会在
             * 开垦残留 HELP 吃掉点将 ENTER 后空 EXIT，离开 BattleMake。 */
            var waitMs = Math.max(5000, 800 * Math.max(1, state.pickedPersons || 1));
            var ov = leftoverMarchOverlay();
            if (ov.blocking || ov.engineHelp || ov.help || ov.farm) {
                dismissMarchOverlay('finish-exit');
            }
            var enters = queuePickEnters();
            var personsNow = cityPersons(state.cityIndex).length;
            var startCount = state.enginePersonsAtPickStart || state.enginePersonsAtFinish || personsNow;
            var dropped = startCount ? Math.max(0, startCount - personsNow) : 0;
            var needDrop = Math.max(1, state.pickedPersons || 1);
            var engineTookAll = dropped >= needDrop;
            var engineTook = dropped >= 1;
            var elapsed = Date.now() - started;
            var pickFired = !!state.lastPickEnterAt;
            var sincePick = pickFired ? (Date.now() - state.lastPickEnterAt) : 0;
            if (enters > 0 && elapsed < waitMs) {
                setTimeout(function () {
                    sendFinishExit(started, retriedPicks);
                }, 50);
                return;
            }
            if (enters === 0 && (state.queue.length || state.sending)) {
                dropQueuedDirections('finish-settle');
            }
            if ((state.queue.length || state.sending) && elapsed < waitMs) {
                setTimeout(function () {
                    sendFinishExit(started, retriedPicks);
                }, 50);
                return;
            }
            if (liveGetFood() || engineQtyActiveMin1()) {
                state.finishPersonsBusy = false;
                adoptLiveGetFood('finish-queue');
                scheduleMarchWatch();
                render();
                return;
            }
            if (engineTookAll || (engineTook && elapsed > 2400)) {
                if (sincePick && sincePick < 400 && elapsed < waitMs) {
                    setTimeout(function () {
                        sendFinishExit(started, retriedPicks);
                    }, 40);
                    return;
                }
            } else if (elapsed < waitMs) {
                if (!engineTook && !retriedPicks && elapsed > 900) {
                    dismissMarchOverlay('finish-requeue');
                    if (requeuePickedPersons('finish-wait')) {
                        setTimeout(function () {
                            sendFinishExit(started, true);
                        }, 80);
                        return;
                    }
                }
                setTimeout(function () {
                    sendFinishExit(started, retriedPicks);
                }, 80);
                return;
            } else if (!engineTook) {
                dismissMarchOverlay('finish-timeout-no-drop');
                if (!retriedPicks && requeuePickedPersons('finish-timeout')) {
                    setTimeout(function () {
                        sendFinishExit(Date.now(), true);
                    }, 80);
                    return;
                }
                state.finishPersonsBusy = false;
                state.personExitSent = false;
                state.marchHint = '点将未进入引擎。已关掉残留遮罩，请再点将后「完成选将」。' +
                    marchDebugLine();
                noteStep4('finish-no-engine-picks', { skipped: 'no-drop' });
                render();
                return;
            }
            /* 点将 ENTER 已进引擎后再立旗、再 EXIT。绝不丢掉未发出的 ENTER。
             * leftover HELP 会吃掉立刻发出的 EXIT，先关壳再隔 240ms 发。 */
            var ovExit = leftoverMarchOverlay();
            var helpGap = !!(ovExit.blocking || ovExit.engineHelp || ovExit.help || ovExit.farm);
            if (helpGap) {
                dismissMarchOverlay('finish-exit-pre');
            }
            state.personExitSent = true;
            state.finishPersonsBusy = false;
            state.personExitTries = 1;
            state.lastPersonExitAt = Date.now();
            if (leftoverDisasterReport(liveEngineReport()) && liveReportAsync()) {
                engineSendKey(VK.ENTER, 'dismiss-live-disaster');
                state.foodRecoverEnter = true;
                state.foodRecoverNeeded = true;
                enqueueKeys([VK.EXIT], 280, 'finish-persons');
            } else if (helpGap) {
                enqueueKeys([VK.EXIT], 240, 'finish-persons');
            } else {
                engineSendKey(VK.EXIT, 'finish-persons');
            }
            state.marchHint = '已结束选将，等待引擎打开选粮… ' + marchDebugLine();
            scheduleMarchWatch();
            render();
        }
        sendFinishExit();
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
        /* 部队已出发后引擎还在城池 OrderMenu。g_hdMenuBytes 常年残留「策略结束」，
         * 立刻回车会点进内政。EXIT 出城一次后必须等真 FunctionMenu 再回车；
         * 再 EXIT 会关掉 FunctionMenu 回到大地图，PolicyExec 不跑。 */
        if (!realMarchDest() && !freshMarchOk()) {
            state.marchHint = '还没有有效出征目标。等出征 GetCitySet（battlePick=1）打开后点河内，看到部队已出发再策略结束。' +
                marchDebugLine();
            noteStep4('refuse-strategy-end', { skipped: engineMarchPhase() });
            if (engineInGetCitySet()) {
                advanceWizard('map-pick', 'need-dest');
            } else if (state.personExitSent) {
                driveFoodToCitySet('need-city-set-before-end');
            }
            render();
            return;
        }
        var haveFresh = freshMarchOk() || !!(state.marchReady && state.handoffHaveFresh && realMarchDest());
        if (state.handoff && state.handoffTimer) {
            if (fightIsActive()) {
                consumeMarchSeqIfFight();
                finishHandoff(true);
            }
            return;
        }
        if (fightIsActive()) {
            consumeMarchSeqIfFight();
            finishHandoff(true);
            return;
        }

        var stillSelecting = !haveFresh && !!(state.battleMake || state.campaignPick || wizardInMarch());
        var retrying = !!(haveFresh && (state.lastHandoffExitAt || 0) &&
            (Date.now() - state.lastHandoffExitAt) < 15000 && !mapPickActive());

        clearHandoffTimer();
        state.queue = [];
        state.sending = false;
        state.handoff = true;
        state.handoffToken = (state.handoffToken || 0) + 1;
        var token = state.handoffToken;
        state.handoffAt = Date.now();
        state.handoffHaveFresh = haveFresh;
        state.handoffConfirmed = false;
        state.handoffEnterCount = 0;
        state.lastHandoffEnterAt = 0;
        if (!retrying) {
            state.handoffExitCount = 0;
            state.lastHandoffExitAt = 0;
            state.lastFuncMenuIdle = 0;
        } else if ((state.handoffExitCount || 0) < 1) {
            state.handoffExitCount = 1;
        }

        state.battleMake = false;
        state.campaignPick = false;
        if (haveFresh) {
            state.marchReady = true;
            state.wizardStep = 'march-ok';
        } else {
            state.marchReady = false;
            state.wizardStep = 'none';
        }

        var seqNow = marchSeqOf(engineMarch());
        if (haveFresh && !fightIsActive() && seqNow && state.handoffPreparedSeq !== seqNow) {
            if (global.BayeHdBattle && typeof BayeHdBattle.prepareNewFight === 'function') {
                BayeHdBattle.prepareNewFight();
            }
            state.handoffPreparedSeq = seqNow;
        }
        if (!haveFresh) {
            consumeLeftoverMarch();
        }
        if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
            BayeHdDialog.close({ silent: true });
        }

        var HANDOFF_MAX_EXIT = 6;
        var HANDOFF_MAX_ENTER = 2;
        var HANDOFF_MAX_MS = 10000;
        var HANDOFF_TICK_MS = 220;

        setHandoffStatus(haveFresh ? '正在退出城池…' : '没有新的出征队列');

        function liveFunctionMenu() {
            var names = engineMenuItems().names || [];
            if (!functionMenuItemsLive(names)) {
                return false;
            }
            if (mapPickActive() || showingQty() || fightIsActive()) {
                return false;
            }
            if ((state.handoffExitCount || 0) < 1) {
                return false;
            }
            if ((state.lastFuncMenuIdle || 0) < (state.lastHandoffExitAt || state.handoffAt)) {
                return false;
            }
            if ((Date.now() - (state.lastHandoffExitAt || 0)) < 180) {
                return false;
            }
            return true;
        }

        function sendHandoffKey(code, reason) {
            if (code === VK.EXIT) {
                if (state.handoffExitCount >= HANDOFF_MAX_EXIT) {
                    return false;
                }
                if (functionMenuItemsLive(engineMenuItems().names || []) && !mapPickActive() &&
                    (state.handoffExitCount || 0) >= 1) {
                    return false;
                }
                state.handoffExitCount += 1;
                state.lastHandoffExitAt = Date.now();
                state.lastFuncMenuIdle = 0;
            } else if (code === VK.ENTER) {
                if (state.handoffEnterCount >= HANDOFF_MAX_ENTER) {
                    return false;
                }
                state.handoffEnterCount += 1;
                state.lastHandoffEnterAt = Date.now();
            }
            engineSendKey(code, reason);
            return true;
        }

        function confirmOnce() {
            setHandoffStatus('正在确认…');
            state.handoffConfirmed = true;
            if (state.handoffEnterCount >= HANDOFF_MAX_ENTER) {
                return;
            }
            var sent = !!(global.BayeHdSystemUi &&
                typeof BayeHdSystemUi.confirmStrategyEnd === 'function' &&
                BayeHdSystemUi.confirmStrategyEnd());
            if (sent) {
                state.handoffEnterCount += 1;
                state.lastHandoffEnterAt = Date.now();
            } else {
                sendHandoffKey(VK.ENTER, 'strategy-end-enter');
            }
            setHandoffStatus('即将开战…');
        }

        function arm() {
            if (token !== state.handoffToken || !state.handoff) {
                return;
            }
            state.handoffTimer = setTimeout(step, HANDOFF_TICK_MS);
        }

        function step() {
            state.handoffTimer = 0;
            if (token !== state.handoffToken || !state.handoff) {
                return;
            }
            if (fightIsActive()) {
                consumeMarchSeqIfFight();
                setHandoffStatus('即将开战…');
                finishHandoff(true);
                return;
            }
            if (Date.now() - state.handoffAt > HANDOFF_MAX_MS) {
                finishHandoff(false);
                return;
            }

            var names = engineMenuItems().names || [];
            var pick = mapPickActive();

            if (functionMenuItemsLive(names) && !pick && !showingQty()) {
                if ((state.handoffExitCount || 0) < 1) {
                    setHandoffStatus('正在退出城池…');
                    sendHandoffKey(VK.EXIT, 'strategy-end');
                    arm();
                    return;
                }
                if (liveFunctionMenu()) {
                    if (!state.handoffConfirmed) {
                        confirmOnce();
                    } else if ((state.handoffEnterCount || 0) < HANDOFF_MAX_ENTER &&
                        (Date.now() - (state.lastHandoffEnterAt || 0)) > 700) {
                        confirmOnce();
                    }
                } else {
                    setHandoffStatus('等待策略结束菜单…');
                }
                arm();
                return;
            }

            if (pick) {
                if (!haveFresh && stillSelecting) {
                    setHandoffStatus('请先点目标城等到部队已出发');
                    arm();
                    return;
                }
                setHandoffStatus('正在退出选城…');
                sendHandoffKey(VK.EXIT, 'strategy-end');
                arm();
                return;
            }

            if (leftoverFightSys(names)) {
                arm();
                return;
            }

            if (cityOrderMenuNow(names) || (state.handoffExitCount || 0) < 1) {
                setHandoffStatus('正在退出城池…');
                sendHandoffKey(VK.EXIT, 'strategy-end');
                arm();
                return;
            }

            if ((state.handoffExitCount || 0) < 2 && names[0] !== '策略结束') {
                setHandoffStatus('正在退出城池…');
                sendHandoffKey(VK.EXIT, 'strategy-end');
                arm();
                return;
            }

            setHandoffStatus('等待策略结束菜单…');
            arm();
        }

        state.handoffTimer = setTimeout(step, 80);
    }

    function isMarching() {
        /* 部队已出发后不再占 isMarching：报告壳才能关，地图点己方城才能开招商。
         * handoff 期间占住，避免地图点击把出征队列冲掉。 */
        if (state.handoff) {
            return true;
        }
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

    function syncMarchPhase() {
        if (state.handoff) {
            return;
        }
        if (leftoverQtyFlag() && !liveGetFood()) {
            clearLeftoverQtyFlag();
        }
        if ((state.wizardStep === 'persons' || waitingGetFoodSoftLock()) && leftoverOverworldPick()) {
            clearStaleMapPick('sync');
        }
        if (state.battleMake && (state.foodConfirmedThisMarch || liveGetFood() || state.personExitSent)) {
            clearBattleMakeLeftoverPick('sync');
        }
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
        if (qty && qty.active && leftoverQtyFlag() && !liveGetFood()) {
            clearLeftoverQtyFlag();
        }
        if (bindLiveGetFoodQty('sync')) {
            return;
        }
        if (adoptLiveGetFood('sync')) {
            advanceWizard('food', 'qty-active');
            state.deepSig = '';
        } else if (qty && qty.active && state.battleMake && state.personExitSent && !leftoverQtyFlag()) {
            state.sawQtyThisMarch = true;
            advanceWizard('food', 'qty-active');
            state.deepSig = '';
        }
        var liveAbort = liveEngineReport();
        if (wizardInMarch() &&
            /城中无空闲武将|金钱不足|粮草不足|无足够金钱/.test(liveAbort) &&
            liveAbort !== state.reportAtMarchStart &&
            liveReportAsync() && !state.personExitSent && !liveGetFood()) {
            setWizardStep('none', 'engine-abort');
            state.battleMake = false;
            state.personExitSent = false;
            state.finishPersonsBusy = false;
            state.marchHint = liveAbort;
            render();
            return;
        }
        if (state.personExitSent && /无足够金钱|金钱不足|城中无空闲武将/.test(liveAbort) &&
            !liveReportAsync()) {
            try {
                if (window.baye && baye.data && baye.data.g_hdReportGbk != null &&
                    (!baye.hdEngineReady || baye.hdEngineReady())) {
                    baye.data.g_hdReportGbk = '';
                }
            } catch (eAbort) {}
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
        }
        if (state.personExitSent && !engineInGetCitySet() && !state.marchReady && !freshMarchOk()) {
            var driven = driveFoodToCitySet('sync');
            if (driven && driven.deferred) {
                pullWizardToEngine();
                scheduleMarchWatch();
                render();
                return;
            }
        }
        pullWizardToEngine();
        if (state.personExitSent && state.wizardStep === 'food' && !mapPickActive() && liveChooseTarget()) {
            advanceWizard('target-tip', 'sync-food-done');
        }
        if (holdExit() && leftoverDisasterReport(liveEngineReport()) && !showingQty() && !mapPickActive()) {
            /* 选将时回车天灾 = 策略结束。只有活着的 ShowConstStrMsg 才回车。 */
            if (!liveReportAsync()) {
                clearStaleDisasterReport();
                scheduleMarchWatch();
                return;
            }
            if (state.wizardStep === 'persons') {
                if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                    BayeHdDialog.close({ silent: true });
                }
                scheduleMarchWatch();
                return;
            }
            if ((state.wizardStep === 'food' || state.personExitSent) &&
                !engineStillPersonQueue() && !liveFunc) {
                engineSendKey(VK.ENTER);
                if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                    BayeHdDialog.close({ silent: true });
                }
                scheduleMarchWatch();
                return;
            }
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            scheduleMarchWatch();
            return;
        }
        /* leftover 选择目标 只在选粮之后经 driveFoodToCitySet 回车，避免跳过 GetFood。 */
        if (dismissLiveArmout()) {
            scheduleMarchWatch();
            render();
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
        if (engineInGetCitySet()) {
            state.campaignPick = true;
            state.acceptMarchOk = true;
            advanceWizard('map-pick', 'sync-pick');
            if (!(march && march.ok)) {
                state.sawMarchCleared = true;
            }
        } else if (state.wizardStep === 'map-pick') {
            pullWizardToEngine();
        }
        if (mapPickActive() || freshMarchOk()) {
            if (global.BayeHdDialog && typeof BayeHdDialog.close === 'function') {
                BayeHdDialog.close({ silent: true });
            }
            if (freshMarchOk()) {
                state.confirmingTarget = false;
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

    function chooseDeep(index) {
        var item = state.deepItems[index];
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
                    ? ('过图 leftover pick，不是出征 GetCitySet。' + marchDebugLine())
                    : ('引擎未打开出征 GetCitySet。' + marchDebugLine() + '。点河内已拒绝。');
                noteStep4('refuse-choose-deep', { cityIndex: item.cityIndex, skipped: engineMarchPhase() });
                render();
                return driven;
            }
            confirmMarchTarget(item.cityIndex);
            return;
        }
        if (showingQty()) {
            return;
        }
        if (usesMapCursor(state.deepKind, state.deepStep) && item && item.cityIndex != null) {
            confirmMarchTarget(item.cityIndex);
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
                ? '已结束选将，请确认粮草。' + marchDebugLine()
                : '已结束选将，等待引擎打开选粮。' + marchDebugLine();
            render();
            return;
        }
        if (state.deepKind === 'person-city') {
            dismissMarchOverlay('pick-person');
        }
        pickIndex(index, true, state.deepKind === 'person-city' ? 'pick-person' : '');
        if (state.deepKind === 'person-city' && !(mapPickActive() && !leftoverOverworldPick()) &&
            !showingQty()) {
            if (!state.enginePersonsAtPickStart) {
                state.enginePersonsAtPickStart = cityPersons(state.cityIndex).length;
            }
            state.pickedPersons += 1;
            if (item && item.name) {
                if (!state.pickedPersonNames) {
                    state.pickedPersonNames = [];
                }
                state.pickedPersonNames.push(item.name);
            }
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
        if (name === 'chooseGameEntry' || name === 'didOpenNewGame' || name === 'didLoadGame') {
            resetForNewGame(name);
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
                    if (state.handoff) {
                        if ((state.handoffExitCount || 0) > 0 && !mapPickActive()) {
                            state.lastFuncMenuIdle = Date.now();
                        }
                    } else if (!state.open || (!wizardInMarch() && !state.marchReady && !holdExit())) {
                        state.lastFuncMenuIdle = Date.now();
                    }
                    if (state.handoff) {
                        /* keep 部队已出发 panel visible during handoff */
                    } else if (!holdExit() && !state.battleMake && !state.campaignPick &&
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
            if (state.handoff || holdExit() || state.marchReady || state.campaignPick ||
                mapPickActive() || showingQty() || /选择目标|部队已出发/.test(reportText())) {
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
                if (t.getAttribute && t.getAttribute('data-hd-confirm-march') != null) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var target = state.pendingTarget != null ? state.pendingTarget : firstEnemyTarget();
                    if (target != null) {
                        confirmMarchTarget(target);
                    } else {
                        state.marchHint = '先点邻城或地图上的目标城，再点确认出征。高亮不够。';
                        noteStep4('confirm-btn-empty', { skipped: 'no-target' });
                        render();
                    }
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
            if (global.BayeHdSpe && typeof BayeHdSpe.isOpen === 'function' && BayeHdSpe.isOpen()) {
                return;
            }
            if (!state.open || !shouldShowHd()) {
                return;
            }
            if (liveQty() || leftoverQtyFlag() ||
                (global.BayeHdDialog && typeof BayeHdDialog.isQtyOpen === 'function' &&
                    BayeHdDialog.isQtyOpen())) {
                if (e.keyCode === 13) {
                    e.preventDefault();
                    commitQty();
                    return;
                }
                if (e.keyCode === 27) {
                    e.preventDefault();
                    cancelQty();
                    return;
                }
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
            try {
                if (!hdReady() || !state.open) {
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
                reportAtMarchStart: state.reportAtMarchStart,
                march: engineMarch(),
                qty: engineQty(),
                lastStep4: state.lastStep4,
                step4Trace: (state.step4Trace || []).slice(-16)
            };
        },
        walkToCity: function (cityIndex, thenEnter) {
            if (thenEnter !== false && (liveTargetStep() || usesMapCursor(state.deepKind, state.deepStep))) {
                return confirmMarchTarget(cityIndex);
            }
            return walkCursorToCity(cityIndex, thenEnter);
        },
        confirmMarchTarget: confirmMarchTarget,
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
        resetAfterFight: resetAfterFight,
        resetForNewGame: resetForNewGame,
        forceClearMapPick: forceClearMapPick,
        freshMarchOk: freshMarchOk,
        isQtyLive: liveQty,
        leftoverQty: leftoverQtyFlag,
        commitQty: commitQty,
        cancelQty: cancelQty
    };
})(window);
