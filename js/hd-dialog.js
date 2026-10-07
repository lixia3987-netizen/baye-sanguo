/**
 * HD 报告 / 对话 / 帮助 / 数量输入壳。
 * 只发 sendKey；不 stub showMainHelp。规格：docs/hd-dialog-spec.md
 */
(function (global) {
    var OVERWORLD_KEY = 'baye/overworldMode';
    var qtyEpoch = 0;
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, HELP: 0x26, ENTER: 0x27, EXIT: 0x28, SEARCH: 0x33 };

    var state = {
        open: false,
        kind: 'report',
        title: '报告',
        body: '',
        min: null,
        max: null,
        init: null,
        asyncId: 0,
        showLcd: true,
        bound: false,
        lastHook: '',
        lastReportSeq: 0,
        lastArmoutEnterSeq: 0,
        lastSpeechEnterSeq: 0,
        viewEpoch: 0,
        marchOwner: null,
        helpOwner: null,
        reportOwner: null,
        reportCommit: null,
        successorOwner: null,
        successorRequest: null,
        successorCommit: null,
        defenseOwner: null,
        defenseRequest: null,
        defenseCommit: null,
        reportSeq: 0,
        pressedView: null,
        qtyQueue: [],
        qtySending: false,
        qtyCommitPending: false,
        qtyInputClosed: false,
        qtySession: 0,
        qtyClosedSession: 0,
        qtyAckFailed: false,
        qtyAckError: ''
    };

    function overworldIsHd() {
        if (global.BayeHdOverworld && typeof BayeHdOverworld.getMode === 'function') {
            return BayeHdOverworld.getMode() === 'hd-map';
        }
        try {
            return global.localStorage.getItem(OVERWORLD_KEY) === 'hd-map';
        } catch (e) {
            return false;
        }
    }

    function shouldShowHd() {
        if (fightActive()) {
            // A live battle owns its presentation mode. Falling back to the
            // city preference would keep HELP visible and swallow Enter/Esc
            // after its controller has returned input to classic mode.
            return !!(global.BayeHdBattle && typeof BayeHdBattle.shouldShowHd === 'function' &&
                BayeHdBattle.shouldShowHd());
        }
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.shouldShowHd === 'function') {
            return BayeHdCityMenu.shouldShowHd();
        }
        return overworldIsHd();
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

    function readString(obj, name) {
        if (!obj || obj[name] == null) {
            return '';
        }
        var v = obj[name];
        if (typeof v === 'string') {
            return v;
        }
        if (v && typeof v === 'object' && typeof v.value === 'string') {
            return v.value;
        }
        return String(v);
    }

    function el(id) {
        return document.getElementById(id);
    }

    function setText(node, text) {
        if (node) {
            node.textContent = text;
        }
    }

    function engineSendKey(code) {
        var ownedReport = state.open && state.kind === 'report' &&
            sameReport(state.reportOwner, nativeReportOwner(readAsync()));
        var ownedDefense = state.open && state.kind === 'defenders' &&
            sameCampaignPersons(state.defenseOwner, readDefenders());
        if (fightActive() && (!(code === VK.ENTER || code === VK.EXIT) || !ownedReport)) {
            console.warn('[hd-dialog] blocked key during fight', code);
            return false;
        }
        if (code === VK.EXIT && cityMenuHoldExit() && state.kind !== 'qty' &&
            !ownedDefense &&
            !(state.kind === 'report' && sameReport(state.reportOwner, nativeReportOwner(readAsync())))) {
            console.warn('[hd-dialog] blocked EXIT during BattleMake');
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

    function readMarchReport() {
        try {
            var m = global.baye && baye.hd && baye.hd.march && baye.hd.march();
            if (m && Number(m.session) > 0 && Number(m.inputSeq) > 0 &&
                [3, 5, 6].indexOf(Number(m.phase)) >= 0) {
                return { session: Number(m.session), inputSeq: Number(m.inputSeq), phase: Number(m.phase) };
            }
        } catch (e) {}
        return null;
    }

    function readBattleHelp() {
        try {
            var f = global.baye && baye.hd && baye.hd.fight && baye.hd.fight();
            if (f && f.active && !f.over && [9, 10].indexOf(Number(f.inputKind)) >= 0 &&
                Number(f.inputSeq) > 0) {
                return { kind: Number(f.inputKind), inputSeq: Number(f.inputSeq) };
            }
        } catch (e) {}
        return null;
    }

    function sameMarch(a, b) {
        return !!(a && b && a.session === b.session && a.inputSeq === b.inputSeq && a.phase === b.phase);
    }

    function sameHelp(a, b) {
        return !!(a && b && a.kind === b.kind && a.inputSeq === b.inputSeq);
    }

    function nativeReportOwner(info) {
        return info && info.hdActive != null && Number(info.hdActive) && Number(info.hdInputSeq)
            ? { seq: Number(info.hdSeq), inputSeq: Number(info.hdInputSeq) } : null;
    }

    function sameReport(a, b) {
        return !!(a && b && a.seq === b.seq && a.inputSeq === b.inputSeq);
    }

    function isBlockingKeyboard() {
        return !!(shouldShowHd() && state.open && (
            state.kind === 'report' && sameReport(state.reportOwner, nativeReportOwner(readAsync())) ||
            state.kind === 'defenders' && sameCampaignPersons(state.defenseOwner, readDefenders())));
    }

    function readCampaignPersons(kind) {
        try {
            var menu = global.baye && baye.hd && baye.hd.menuItems && baye.hd.menuItems();
            if (!menu || !Number(menu.active) || Number(menu.context) !== 5 || Number(menu.kind) !== kind ||
                !Number(menu.seq) || !menu.names || !menu.names.length) { return null; }
            if (menu.count != null && Number(menu.count) !== menu.names.length) { return null; }
            var index = Number(menu.index);
            if (!isFinite(index) || index < 0 || index >= menu.names.length) { return null; }
            return { context: 5, kind: kind, seq: Number(menu.seq), index: index, names: menu.names.slice(),
                signature: menu.names.join('\u0000') };
        } catch (e) { return null; }
    }

    function readSuccessor() { return readCampaignPersons(1); }

    function readDefenders() {
        if (fightActive()) { return null; }
        var owner = readCampaignPersons(2);
        if (!owner) { return null; }
        var data = engineData(), params = data && data.g_FgtParam;
        owner.cityIndex = readNumber(params, 'CityIndex');
        if (owner.cityIndex == null) {
            try { owner.cityIndex = readNumber(baye.hd.fight(), 'cityIndex'); } catch (e) {}
        }
        owner.selected = [];
        owner.selectedNames = [];
        var arr = params && params.GenArray;
        for (var i = 0; arr && i < 10; i += 1) {
            var id = readNumber(arr, i);
            if (!id || id >= 0xfffe) { continue; }
            owner.selected.push(id);
            var name = '';
            try { name = baye.getPersonName(id - 1) || ''; } catch (e) {}
            owner.selectedNames.push(name);
        }
        return owner;
    }

    function sameCampaignPersons(a, b) {
        return !!(a && b && a.context === b.context && a.kind === b.kind &&
            a.seq === b.seq && a.signature === b.signature && a.cityIndex === b.cityIndex);
    }

    function sameSuccessor(a, b) {
        return sameCampaignPersons(a, b);
    }

    function stopPersonRequest(defense) {
        var key = defense ? 'defenseRequest' : 'successorRequest';
        var request = state[key];
        state[key] = null;
        if (request && request.timer) { global.clearTimeout(request.timer); }
    }

    function stopSuccessorRequest() { stopPersonRequest(false); }
    function stopDefenseRequest() { stopPersonRequest(true); }

    function chooseCampaignPerson(index, confirm, defense) {
        var kind = defense ? 'defenders' : 'successor';
        var ownerKey = defense ? 'defenseOwner' : 'successorOwner';
        var requestKey = defense ? 'defenseRequest' : 'successorRequest';
        var commitKey = defense ? 'defenseCommit' : 'successorCommit';
        var readMenu = defense ? readDefenders : readSuccessor;
        var live = readMenu();
        index = Number(index);
        if (!state.open || state.kind !== kind || !shouldShowHd() || nativeReportOwner(readAsync()) ||
            !sameCampaignPersons(state[ownerKey], live) || !isFinite(index) ||
            index < 0 || index >= live.names.length || Math.floor(index) !== index ||
            state[requestKey] || sameCampaignPersons(state[commitKey], live)) { return false; }
        var request = { owner: live, index: index, confirm: confirm !== false,
            epoch: state.viewEpoch, waitingIndex: null, expectedIndex: null,
            deadline: Date.now() + 5000,
            totalDeadline: Date.now() + Math.min(3 * 60 * 60 * 1000,
                Math.max(60000, live.names.length * 5000)), timer: 0 };
        state[requestKey] = request;
        function step() {
            request.timer = 0;
            if (state[requestKey] !== request) { return; }
            if (request.epoch !== state.viewEpoch ||
                state.kind !== kind || !shouldShowHd() || nativeReportOwner(readAsync())) {
                stopPersonRequest(defense); return;
            }
            var menu = readMenu();
            if (!sameCampaignPersons(request.owner, menu)) { stopPersonRequest(defense); return; }
            if (Date.now() > request.deadline || Date.now() > request.totalDeadline) {
                stopPersonRequest(defense);
                state.body = '引擎尚未响应，请等待或切换经典画面查看。';
                render(); return;
            }
            if (request.waitingIndex != null) {
                if (menu.index === request.waitingIndex) {
                    request.timer = global.setTimeout(step, 16); return;
                }
                if (menu.index !== request.expectedIndex) {
                    stopPersonRequest(defense); return;
                }
                // Large Mods can expose thousands of candidates. The timeout
                // resets only for the exact arrow ACK sent by this request.
                request.deadline = Date.now() + 5000;
            }
            request.waitingIndex = null;
            if (menu.index !== request.index) {
                request.waitingIndex = menu.index;
                request.expectedIndex = menu.index + (menu.index < request.index ? 1 : -1);
                if (!engineSendKey(menu.index < request.index ? VK.DOWN : VK.UP)) {
                    stopPersonRequest(defense); return;
                }
                request.timer = global.setTimeout(step, 16); return;
            }
            stopPersonRequest(defense);
            if (request.confirm) {
                // One explicit choice commits only this real person menu.
                state[commitKey] = request.owner;
                engineSendKey(VK.ENTER);
            }
        }
        step();
        return true;
    }

    function chooseSuccessor(index, confirm) { return chooseCampaignPerson(index, confirm, false); }
    function chooseDefender(index, confirm) { return chooseCampaignPerson(index, confirm, true); }

    function finishDefenders() {
        var live = readDefenders();
        if (!state.open || state.kind !== 'defenders' || !shouldShowHd() ||
            !sameCampaignPersons(state.defenseOwner, live) || nativeReportOwner(readAsync()) ||
            state.defenseRequest || sameCampaignPersons(state.defenseCommit, live)) { return false; }
        // EXIT completes this real selection wait, including choosing nobody.
        state.defenseCommit = live;
        return engineSendKey(VK.EXIT);
    }

    function defenseToken(owner) {
        return owner ? JSON.stringify([state.viewEpoch, owner.context, owner.kind,
            owner.seq, owner.cityIndex, owner.names]) : '';
    }

    function ownedDefenseButton(target, finish) {
        var live = readDefenders();
        if (!state.open || state.kind !== 'defenders' || !shouldShowHd() ||
            !sameCampaignPersons(state.defenseOwner, live) ||
            target.getAttribute('data-hd-defenders-owner') !== defenseToken(live) ||
            Number(target.getAttribute('data-hd-defender-seq')) !== live.seq) { return false; }
        if (finish) { return true; }
        var index = Number(target.getAttribute('data-hd-defender-index'));
        return isFinite(index) && Math.floor(index) === index && index >= 0 && index < live.names.length &&
            Number(target.getAttribute('data-hd-menu-context')) === live.context &&
            Number(target.getAttribute('data-hd-menu-kind')) === live.kind &&
            target.getAttribute('data-hd-defender-name') === live.names[index];
    }

    function confirmMarchReport() {
        var owner = state.marchOwner, live = readMarchReport();
        var info = readAsync();
        if (!sameMarch(owner, live) || (state.reportSeq && Number(info.hdSeq) !== state.reportSeq)) {
            return false;
        }
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.continueMarch === 'function') {
            return !!BayeHdCityMenu.continueMarch(owner);
        }
        return false;
    }

    function returnFromBattleHelp() {
        var owner = state.helpOwner;
        if (!sameHelp(owner, readBattleHelp()) || !global.BayeHdBattle ||
            typeof BayeHdBattle.returnFromHelp !== 'function') { return false; }
        var epoch = state.viewEpoch;
        var result = BayeHdBattle.returnFromHelp(owner);
        if (result && result.ok && epoch === state.viewEpoch && state.kind === 'help' &&
            sameHelp(owner, state.helpOwner)) {
            closeDialog({ silent: true });
        }
        return !!(result && result.ok);
    }

    function requestHelp(code, title) {
        if (fightActive()) {
            if (!global.BayeHdBattle || typeof BayeHdBattle.handleKey !== 'function') { return false; }
            // Toolbar clicks use the same guarded controller path as H/S.
            return BayeHdBattle.handleKey({ key: code === VK.HELP ? 'h' : 's',
                keyCode: code === VK.HELP ? 72 : 83, target: document.body,
                preventDefault: function () {}, stopPropagation: function () {},
                stopImmediatePropagation: function () {} });
        }
        if (!engineSendKey(code)) { return false; }
        return openDialog({ kind: 'help', title: title, body: '', showLcd: true });
    }

    function looksLikeSpeech(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        var t = text.replace(/\s+/g, '');
        if (t.length < 2 || t.length >= 400) {
            return false;
        }
        if (/^\[object/.test(t) || /^(Array|Object|Uint\d*Array|Int\d*Array|Float\d*Array)\[/i.test(t)) {
            return false;
        }
        /* 只收已暴露的中文，避免把类型数组 dump 当成报告。 */
        return /[\u4e00-\u9fff]/.test(t);
    }

    function probeExtraStrings(data) {
        var found = [];
        var names = [
            'g_asyncActionStringParam', 'g_sysMsg', 'g_Message', 'g_TalkMsg',
            'g_HelpText', 'g_Report', 'g_InfoText'
        ];
        var i;
        for (i = 0; i < names.length; i++) {
            var s = readString(data, names[i]);
            if (looksLikeSpeech(s)) {
                found.push(s);
            }
        }
        try {
            if (typeof baye.getCustomData === 'function') {
                var custom = baye.getCustomData();
                if (looksLikeSpeech(custom)) {
                    found.push(custom);
                }
            }
        } catch (e) {}
        var props = data && data._baye_properties ? data._baye_properties : [];
        for (i = 0; i < props.length; i++) {
            if (!/string|msg|talk|text|help|report|info/i.test(props[i])) {
                continue;
            }
            if (/param|len|size|ptr|buf|map|array/i.test(props[i]) && !/stringparam/i.test(props[i])) {
                continue;
            }
            var extra = readString(data, props[i]);
            if (looksLikeSpeech(extra) && found.indexOf(extra) < 0) {
                found.push(extra);
            }
        }
        return found;
    }

    function readAsync() {
        var data = engineData();
        var info = { id: 0, min: null, max: null, init: null, text: '', keys: [] };
        try {
            if (window.baye && baye.hd && typeof baye.hd.report === 'function') {
                var hd0 = baye.hd.report();
                info.hdSeq = hd0.seq;
                info.hdKind = hd0.kind;
                info.hdPerson = hd0.person;
                info.hdActive = hd0.active;
                info.hdInputSeq = hd0.inputSeq;
                if (looksLikeSpeech(hd0.text)) {
                    info.text = hd0.text;
                }
            }
        } catch (e) {}
        if (!data) {
            return info;
        }
        info.id = readNumber(data, 'g_asyncActionID') || 0;
        var params = data.g_asyncActionParams;
        if (params) {
            info.min = readNumber(params, 0);
            info.max = readNumber(params, 1);
            info.init = readNumber(params, 2);
        }
        if (!looksLikeSpeech(info.text)) {
            info.text = readString(data, 'g_asyncActionStringParam');
        }
        if (!looksLikeSpeech(info.text)) {
            var extras = probeExtraStrings(data);
            if (extras.length) {
                info.text = extras[0];
            }
        }
        if (data._baye_properties) {
            info.keys = data._baye_properties.filter(function (name) {
                return /msg|talk|text|help|report|string/i.test(name);
            });
        }
        return info;
    }

    function leftoverMarchTip(text) {
        return !!(text && /部队已出发|选择目标|敌方城池|我方城池|无法到达|无人占领/.test(String(text)));
    }

    /* 过月策略结束残留的人物台词，不是出征「选择目标」。回车会打进 FunctionMenu / GetCitySet。 */
    function leftoverCharacterSpeech(text) {
        if (!looksLikeSpeech(text)) {
            return false;
        }
        if (leftoverMarchTip(text)) {
            return false;
        }
        if (/饥荒|旱灾|水灾|暴动|俘虏|拥立|成为|遭劫|病逝|金钱不足|粮草不足|城中无空闲武将|归降|势力/.test(String(text))) {
            return false;
        }
        if (/农业|商业|开发度|变为/.test(String(text))) {
            return false;
        }
        return true;
    }

    function liveSpeechAsync(info) {
        return !!(info && (info.id === 1 || info.id === 2 || info.id === 13));
    }

    function actuallyFunctionMenu() {
        if (!functionMenuLive()) {
            return false;
        }
        /* g_hdMenuBytes 过月后常年残留「策略结束」。pick=1 / 出征向导 / 选粮都不是活 FunctionMenu。 */
        if (mapPickActive() || cityMenuQty() || cityMenuMarching()) {
            return false;
        }
        try {
            var info = readAsync();
            if (leftoverCharacterSpeech((info && info.text) || state.body)) {
                return false;
            }
        } catch (e) {}
        return true;
    }

    function fightActive() {
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

    function functionMenuLive() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.menuItems === 'function') {
                return (baye.hd.menuItems().names || [])[0] === '策略结束';
            }
        } catch (e) {}
        return false;
    }

    function cityMenuOpen() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.isOpen === 'function' &&
            BayeHdCityMenu.isOpen());
    }

    function strategyHandoff() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.isHandoff === 'function' &&
            BayeHdCityMenu.isHandoff());
    }

    function leftoverHelpDuringMarch() {
        return !!((cityMenuMarching() || cityMenuOpen()) && state.kind === 'help' && !cityMenuQty());
    }

    function leftoverFarmReport(text) {
        return /农业|商业|开发度|变为|无足够金钱|金钱不足|城中无空闲武将|命令无效|无目标/.test(String(text || ''));
    }

    function applyChrome() {
        var show = state.open && shouldShowHd();
        var pass = show && (
            (state.kind === 'report' && state.marchOwner && cityMenuOpen()) ||
            (state.kind === 'report' && !state.marchOwner && !state.reportOwner && !state.asyncId && leftoverMarchTip(state.body)) ||
            leftoverHelpDuringMarch() ||
            (state.kind === 'report' && !state.reportOwner && !state.asyncId && leftoverFarmReport(state.body))
        );
        document.documentElement.setAttribute('data-baye-dialog', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-dialog-pass', pass ? '1' : '0');
        document.documentElement.setAttribute('data-baye-dialog-qty', (show && state.kind === 'qty') ? '1' : '0');
        if (document.body) {
            document.body.classList.toggle('baye-hd-dialog-on', show);
            document.body.classList.toggle('baye-hd-dialog-lcd', show && state.showLcd);
            document.body.classList.toggle('baye-hd-dialog-help', show && (state.kind === 'help'));
            document.body.classList.toggle('baye-hd-dialog-empty-text', show && !state.body);
            document.body.classList.toggle('baye-hd-dialog-pass', pass);
        }
        var root = el('hd-dialog');
        if (root) {
            root.setAttribute('data-hd-native-report', show && state.kind === 'report' && isBlockingKeyboard() ? '1' : '0');
            root.setAttribute('data-hd-native-defenders', show && state.kind === 'defenders' &&
                sameCampaignPersons(state.defenseOwner, readDefenders()) ? '1' : '0');
            root.classList.toggle('is-open', show);
            root.classList.toggle('is-qty', show && state.kind === 'qty');
            root.classList.toggle('is-empty-text', !state.body);
            root.setAttribute('aria-hidden', show ? 'false' : 'true');
            root.style.pointerEvents = (show && !pass) ? 'auto' : 'none';
        }
    }

    function render() {
        applyChrome();
        if (!(state.open && shouldShowHd())) {
            return;
        }
        setText(el('hd-dialog-title'), state.title);
        var body = el('hd-dialog-body');
        if (body) {
            if (state.kind === 'defenders' && state.defenseOwner) {
                if (body._hdDefendersView !== state.viewEpoch) {
                    body._hdDefendersView = state.viewEpoch;
                    body.textContent = state.body;
                    var selected = document.createElement('p');
                    selected.setAttribute('data-hd-defenders-selected', '');
                    body.appendChild(selected);
                    var defenders = document.createElement('div');
                    defenders.className = 'hd-dialog-qty';
                    state.defenseOwner.names.forEach(function (name, index) {
                        var button = document.createElement('button');
                        button.type = 'button';
                        button.setAttribute('data-hd-defender-index', String(index));
                        button.setAttribute('data-hd-defender-name', name);
                        button.setAttribute('data-hd-defender-seq', String(state.defenseOwner.seq));
                        button.setAttribute('data-hd-menu-context', '5');
                        button.setAttribute('data-hd-menu-kind', '2');
                        button.setAttribute('data-hd-defenders-owner', defenseToken(state.defenseOwner));
                        button.textContent = name;
                        defenders.appendChild(button);
                    });
                    var finish = document.createElement('button');
                    finish.type = 'button';
                    finish.setAttribute('data-hd-defenders-finish', '');
                    finish.setAttribute('data-hd-defender-seq', String(state.defenseOwner.seq));
                    finish.setAttribute('data-hd-defenders-owner', defenseToken(state.defenseOwner));
                    finish.textContent = '完成选将';
                    defenders.appendChild(finish);
                    body.appendChild(defenders);
                }
                var selectedNode = body.querySelector && body.querySelector('[data-hd-defenders-selected]');
                setText(selectedNode, state.defenseOwner.selected.length ?
                    '已选 ' + state.defenseOwner.selected.length + ' 人：' +
                        state.defenseOwner.selectedNames.filter(Boolean).join('、') : '尚未选择防将。');
            } else if (state.kind === 'successor' && state.successorOwner) {
                // Keep the same button nodes through polling; replacing them
                // between pointerdown and click would lose a player's choice.
                if (body._hdSuccessorView !== state.viewEpoch) {
                    body._hdSuccessorView = state.viewEpoch;
                    body.textContent = state.body || '请选择继任君主。';
                    var choices = document.createElement('div');
                    choices.className = 'hd-dialog-qty';
                    state.successorOwner.names.forEach(function (name, index) {
                        var button = document.createElement('button');
                        button.type = 'button';
                        button.setAttribute('data-hd-successor-index', String(index));
                        button.setAttribute('data-hd-successor-seq', String(state.successorOwner.seq));
                        button.textContent = name;
                        choices.appendChild(button);
                    });
                    body.appendChild(choices);
                }
            } else if (state.body) {
                body._hdSuccessorView = null;
                body._hdDefendersView = null;
                body.textContent = state.body;
            } else if (state.kind === 'qty') {
                var qv = '';
                try {
                    if (window.baye && baye.hd && baye.hd.qty) {
                        var q = baye.hd.qty();
                        if (q && q.active) {
                            qv = '当前 ' + q.value + '（' + q.min + '–' + q.max + '）。';
                            state.min = q.min;
                            state.max = q.max;
                            state.init = q.value;
                        }
                    }
                } catch (e) {}
                body.textContent = qv +
                    (state.qtyAckFailed ? '数量调整未完成，请取消后重新输入。' :
                        '使用按钮或方向键调整数量，也可按 0–9 输入数字。');
            } else if (state.kind === 'help') {
                body.textContent = '在下方经典画面查看' + (state.title === '查找' ? '查找结果' : '帮助内容') +
                    '，查看完毕后点击“返回”。';
            } else if (state.kind === 'movie') {
                body.textContent = '正在播放开场动画，点击“确认”跳过。';
            } else {
                body.textContent = '请在下方经典画面查看报告，点击“确认”继续。';
            }
        }
        var range = el('hd-dialog-range');
        if (range) {
            var bits = [];
            if (state.min != null) {
                bits.push('最小 ' + state.min);
            }
            if (state.max != null) {
                bits.push('最大 ' + state.max);
            }
            if (state.init != null) {
                bits.push('当前 ' + state.init);
            }
            range.textContent = bits.join(' · ');
            range.hidden = !bits.length;
        }
        var qty = el('hd-dialog-qty');
        if (qty) {
            qty.hidden = state.kind !== 'qty';
            var digits = el('hd-dialog-qty-digits');
            if (digits && !digits.getAttribute('data-built')) {
                digits.setAttribute('data-built', '1');
                var di;
                for (di = 0; di <= 9; di++) {
                    var db = document.createElement('button');
                    db.type = 'button';
                    db.setAttribute('data-hd-digit', String(di));
                    db.textContent = String(di);
                    digits.appendChild(db);
                }
            }
        }
        var caption = el('hd-dialog-caption');
        if (caption) {
            caption.textContent = '在下方经典画面查看完整内容。';
            caption.hidden = !!state.body || state.kind === 'qty';
        }
        var probe = el('hd-dialog-probe');
        if (probe) {
            probe.hidden = !global.BAYE_HD_DEBUG;
            probe.textContent = global.BAYE_HD_DEBUG ? 'kind=' + state.kind + '  async=' + state.asyncId +
                '  hook=' + (state.lastHook || '—') +
                (state.body ? '  text=' + state.body.length : '') : '';
        }
        var lcdButton = document.querySelector && document.querySelector('[data-hd-dlg-lcd]');
        setText(lcdButton, state.showLcd ? '隐藏经典画面' : '经典画面');
        var confirm = document.querySelector && document.querySelector('[data-hd-dlg-ok]');
        var back = document.querySelector && document.querySelector('[data-hd-dlg-back]');
        if (confirm) { confirm.hidden = state.kind === 'successor' || state.kind === 'defenders'; }
        if (back) { back.hidden = state.kind === 'successor' || state.kind === 'defenders'; }
    }

    function mapPickActive() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.march === 'function') {
                return !!(baye.hd.march().pick);
            }
        } catch (e) {}
        return false;
    }

    function isMapPickTip(text) {
        return !!(text && /选择目标|敌方城池|我方城池|无法到达|无人占领/.test(String(text)));
    }

    function cityMenuMarching() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.isMarching === 'function' &&
            BayeHdCityMenu.isMarching());
    }

    function cityMenuWaitingGetFood() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.waitingGetFood === 'function' &&
            BayeHdCityMenu.waitingGetFood());
    }

    function cityMenuHoldExit() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.holdExit === 'function' &&
            BayeHdCityMenu.holdExit());
    }

    function cityMenuQty() {
        try {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.isQtyLive === 'function') {
                return !!BayeHdCityMenu.isQtyLive();
            }
            if (window.baye && baye.hd && typeof baye.hd.qty === 'function') {
                var q = baye.hd.qty();
                return !!(q && q.active);
            }
        } catch (e) {}
        return false;
    }

    function cityMenuLeftoverQty() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.leftoverQty === 'function' &&
            BayeHdCityMenu.leftoverQty());
    }

    function closeQtyDialog() {
        if (state.open && state.kind === 'qty') {
            closeDialog({ silent: true });
        }
    }

    function commitQtyDialog() {
        if (cityMenuLeftoverQty() || !cityMenuQty()) {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.commitQty === 'function') {
                BayeHdCityMenu.commitQty();
            } else {
                closeQtyDialog();
            }
            return;
        }
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.commitQty === 'function') {
            BayeHdCityMenu.commitQty();
            return;
        }
        var q = standaloneQty();
        if (!q || !q.active || state.qtyInputClosed || state.qtyAckFailed || state.qtyCommitPending) { return; }
        state.qtyCommitPending = true;
        state.qtyQueue.push({ commit: true, epoch: qtyEpoch });
        pumpStandaloneQty();
    }

    function cancelQtyDialog() {
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.cancelQty === 'function') {
            BayeHdCityMenu.cancelQty();
            return;
        }
        if (!state.open || state.kind !== 'qty' || state.qtyInputClosed) { return; }
        var q = standaloneQty();
        invalidateDialogQty();
        state.qtyInputClosed = true;
        if (q && q.protocol && q.active) { state.qtyClosedSession = Number(q.session); }
        if (q && q.active) {
            bayeQtyCloseInput(q);
            engineSendKey(VK.EXIT);
        }
        closeQtyDialog();
    }

    function cityMenuFreshMarch() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.freshMarchOk === 'function' &&
            BayeHdCityMenu.freshMarchOk());
    }

    function cityMenuPersonExitSent() {
        try {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.debugSnapshot === 'function') {
                var snap = BayeHdCityMenu.debugSnapshot();
                return !!(snap && snap.personExitSent);
            }
        } catch (e) {}
        return false;
    }

    function closeReportSilent(info) {
        if (info && state.reportSeq && Number(info.hdSeq) !== state.reportSeq) { return false; }
        if (info && info.hdSeq) {
            state.lastReportSeq = info.hdSeq;
        }
        if (state.open && state.kind === 'report') {
            closeDialog({ silent: true });
        }
        return false;
    }

    function dismissLeftoverSpeech(info) {
        info = info || readAsync();
        if (nativeReportOwner(info) || readMarchReport() || liveSpeechAsync(info)) { return false; }
        // Retiring an old presentation never acknowledges a native input.
        if (leftoverMarchTip(info.text || state.body) ||
            leftoverCharacterSpeech(info.text || state.body)) {
            return closeReportSilent(info);
        }
        return false;
    }

    function tryOpenQty() {
        if (cityMenuLeftoverQty() || (global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.isQtyLive === 'function' && !BayeHdCityMenu.isQtyLive() &&
            !(typeof BayeHdCityMenu.liveGetFood === 'function' && BayeHdCityMenu.liveGetFood()))) {
            closeQtyDialog();
            return false;
        }
        try {
            if (window.baye && baye.hd && baye.hd.qty) {
                var qtyInfo = baye.hd.qty();
                var foodLive = !!(global.BayeHdCityMenu &&
                    typeof BayeHdCityMenu.liveGetFood === 'function' &&
                    BayeHdCityMenu.liveGetFood());
                if (qtyInfo && (qtyInfo.active || foodLive) &&
                    (cityMenuQty() || foodLive) && Number(qtyInfo.max) >= 1) {
                    openDialog({
                        kind: 'qty',
                        title: '数量',
                        min: qtyInfo.min,
                        max: qtyInfo.max,
                        init: qtyInfo.value,
                        showLcd: false
                    });
                    return true;
                }
            }
        } catch (e) {}
        if (state.open && state.kind === 'qty' && !cityMenuQty()) {
            closeQtyDialog();
        }
        return false;
    }

    function applyEngineReport(info) {
        info = info || {};
        if (!looksLikeSpeech(info.text)) { return false; }
        var owner = readMarchReport();
        if (info.hdActive != null && !Number(info.hdActive)) {
            return closeReportSilent(info);
        }
        // Only an actual waiting report can own a confirmation. Text and old
        // menu buffers are retained by C after their input has ended.
        if (!owner && !liveSpeechAsync(info) && !info.hdSeq) {
            return closeReportSilent(info);
        }
        if (cityMenuMarching() && !owner && !nativeReportOwner(info)) { return closeReportSilent(info); }
        if (info.hdSeq) { state.lastReportSeq = info.hdSeq; }
        var title = info.hdKind === 2 ? '对话' : '报告';
        try {
            if (info.hdPerson != null && info.hdPerson !== 0xffff && global.baye) {
                title = baye.getPersonName(info.hdPerson) || title;
            }
        } catch (e) {}
        return openDialog({ kind: 'report', title: title, body: info.text,
            asyncId: info.id, showLcd: false, marchOwner: owner,
            reportOwner: nativeReportOwner(info),
            reportSeq: Number(info.hdSeq) || 0 });
    }

    function looksLikeHelp(text) {
        if (looksLikeSpeech(text)) {
            return true;
        }
        return !!(text && /^Ver\s/i.test(String(text).replace(/^\s+/, '')));
    }

    function formatHelpBody(text) {
        return String(text || '').replace(/\|/g, '\n');
    }

    function applyEngineHelp(info) {
        info = info || {};
        if (!looksLikeHelp(info.text)) { return false; }
        var owner = readBattleHelp();
        if (fightActive() && (!owner || owner.kind !== 9)) { return false; }
        return openDialog({ kind: 'help', title: owner ? '战场帮助' : '帮助',
            body: formatHelpBody(info.text), showLcd: false, helpOwner: owner });
    }

    function onEngineHelp() {
        var info = null;
        try { info = global.baye && baye.hd && baye.hd.help && baye.hd.help(); } catch (e) {}
        if (info && info.active && looksLikeHelp(info.text) && applyEngineHelp(info)) { return; }
        if (state.open && state.kind === 'help') { closeDialog({ silent: true }); }
    }

    function speOverlayHandlesMovie() {
        return !!(global.BayeHdSpe && typeof BayeHdSpe.isHandling === 'function' && BayeHdSpe.isHandling());
    }

    function onEngineMovie() {
        if (speOverlayHandlesMovie()) {
            if (state.open && state.kind === 'movie') {
                closeDialog({ silent: true });
            }
            return;
        }
        var info = null;
        try {
            info = window.baye && baye.hd && baye.hd.movie ? baye.hd.movie() : null;
        } catch (e) {}
        if (info && info.active) {
            openDialog({
                kind: 'movie',
                title: '开场动画',
                body: '正在播放开场动画，点击“确认”跳过。',
                showLcd: true,
                allowEmpty: true
            });
            return;
        }
        if (state.open && state.kind === 'movie') {
            closeDialog({ silent: true });
        }
    }

    function onEngineReport() {
        var info = readAsync();
        if (!looksLikeSpeech(info.text) && window.baye && baye.hd && typeof baye.hd.reportText === 'function') {
            info.text = baye.hd.reportText();
        }
        applyEngineReport(info);
    }

    function openDialog(meta) {
        meta = meta || {};
        if (!shouldShowHd()) {
            return false;
        }
        if (meta.kind === 'report' && !looksLikeSpeech(meta.body) && !meta.allowEmpty) {
            return false;
        }
        var kind = meta.kind || 'report';
        if (kind === 'qty') {
            var quantity = standaloneQty();
            if (quantity && quantity.protocol && quantity.active &&
                (Number(quantity.session) === state.qtyClosedSession || bayeQtyNativeClosed(quantity))) { return false; }
        }
        var marchOwner = kind === 'report' ? (meta.marchOwner ||
            (leftoverMarchTip(meta.body) ? readMarchReport() : null)) : null;
        var helpOwner = kind === 'help' ? (meta.helpOwner || readBattleHelp()) : null;
        var reportOwner = kind === 'report' ? meta.reportOwner || null : null;
        var successorOwner = kind === 'successor' ? meta.successorOwner || readSuccessor() : null;
        var defenseOwner = kind === 'defenders' ? meta.defenseOwner || readDefenders() : null;
        var reportSeq = kind === 'report' ? Number(meta.reportSeq) || 0 : 0;
        if (!state.open || state.kind !== kind || state.body !== (meta.body || '') ||
            (!sameMarch(state.marchOwner, marchOwner) && (state.marchOwner || marchOwner)) ||
            (!sameHelp(state.helpOwner, helpOwner) && (state.helpOwner || helpOwner)) ||
            (!sameReport(state.reportOwner, reportOwner) && (state.reportOwner || reportOwner)) ||
            (!sameSuccessor(state.successorOwner, successorOwner) && (state.successorOwner || successorOwner)) ||
            (!sameCampaignPersons(state.defenseOwner, defenseOwner) && (state.defenseOwner || defenseOwner)) ||
            state.reportSeq !== reportSeq) {
            state.viewEpoch += 1;
            stopSuccessorRequest();
            stopDefenseRequest();
        }
        if (!state.open || state.kind !== kind) {
            invalidateDialogQty();
        }
        state.open = true;
        state.kind = kind;
        if (kind === 'qty') { standaloneQty(); }
        state.marchOwner = marchOwner;
        state.helpOwner = helpOwner;
        state.reportOwner = reportOwner;
        state.successorOwner = successorOwner;
        state.defenseOwner = defenseOwner;
        state.reportSeq = reportSeq;
        state.title = meta.title || (state.kind === 'qty' ? '数量' :
            (state.kind === 'help' ? '帮助' : (state.kind === 'movie' ? '开场动画' : '报告')));
        state.body = meta.body || '';
        state.min = meta.min != null ? meta.min : null;
        state.max = meta.max != null ? meta.max : null;
        state.init = meta.init != null ? meta.init : null;
        state.showLcd = looksLikeSpeech(state.body) ? false : (meta.showLcd !== false);
        state.asyncId = meta.asyncId != null ? meta.asyncId : 0;
        render();
        return true;
    }

    function closeDialog(opts) {
        opts = opts || {};
        if (opts.marchOwner && (!state.marchOwner ||
            Number(opts.marchOwner.session) !== state.marchOwner.session ||
            Number(opts.marchOwner.inputSeq) !== state.marchOwner.inputSeq)) { return false; }
        // Keep keyboard ownership while the acknowledged report is still the
        // same C wait; repeated keys cannot fall through to the native layer.
        if (opts.marchOwner && sameMarch(state.marchOwner, readMarchReport())) { return false; }
        invalidateDialogQty();
        state.viewEpoch += 1;
        stopSuccessorRequest();
        stopDefenseRequest();
        state.open = false;
        state.marchOwner = null;
        state.helpOwner = null;
        state.reportOwner = null;
        state.successorOwner = null;
        state.defenseOwner = null;
        applyChrome();
        document.documentElement.setAttribute('data-baye-dialog-pass', '0');
        if (!opts.silent) {
            console.log('[hd-dialog] close');
        }
    }

    function clearLeftoverMarch() {
        if (leftoverMarchTip(state.body)) {
            var info = readAsync();
            if (readMarchReport() || nativeReportOwner(info) || liveSpeechAsync(info)) { return false; }
            state.body = '';
            closeDialog({ silent: true });
        }
    }

    function retireStaleReport() {
        if (!state.open || state.kind !== 'report') { return false; }
        var info = readAsync();
        if (readMarchReport() || nativeReportOwner(info) || liveSpeechAsync(info)) { return false; }
        closeReportSilent(info);
        return !state.open;
    }

    function pollEngine() {
        if (!hdReady()) { return; }
        if (!shouldShowHd()) {
            if (state.open) { closeDialog({ silent: true }); }
            return;
        }
        var nativeInfo = readAsync();
        var nativeOwner = nativeReportOwner(nativeInfo);
        if (nativeOwner) {
            // Death, damage and skill speech can block C while fight.active
            // stays true and inputKind is BUSY. That actual report wait owns
            // its explicit confirmation before any battle/help presentation.
            if (looksLikeSpeech(nativeInfo.text)) { applyEngineReport(nativeInfo); }
            else { openDialog({ kind: 'report', title: '报告', body: '', allowEmpty: true,
                asyncId: nativeInfo.id, showLcd: true, reportOwner: nativeOwner,
                reportSeq: Number(nativeInfo.hdSeq) || 0 }); }
            return;
        }
        var successor = readSuccessor();
        if (successor) {
            openDialog({ kind: 'successor', title: '拥立新君', body: '请选择继任君主。',
                successorOwner: successor, showLcd: false });
            return;
        }
        if (state.open && state.kind === 'successor') { closeDialog({ silent: true }); }
        var defense = readDefenders();
        if (defense) {
            var cityName = '';
            try { if (defense.cityIndex != null) { cityName = baye.getCityName(defense.cityIndex) || ''; } } catch (e) {}
            openDialog({ kind: 'defenders', title: cityName ? '防守' + cityName : '防守选将',
                body: '请选择守城武将，选好后点击“完成选将”。', defenseOwner: defense, showLcd: false });
            return;
        }
        if (state.open && state.kind === 'defenders') { closeDialog({ silent: true }); }
        // Help owns a separate C wait. A retained help buffer must never cover
        // the action/system menu which follows its acknowledgement.
        var help = null;
        try { help = baye.hd.help && baye.hd.help(); } catch (e) {}
        var battleHelp = readBattleHelp();
        if (fightActive()) {
            if (battleHelp && battleHelp.kind === 9 && help && help.active) {
                applyEngineHelp(help);
            } else if (state.open && state.kind !== 'qty') {
                closeDialog({ silent: true });
            }
            return;
        }
        if (help && help.active && applyEngineHelp(help)) { return; }
        if (state.open && state.kind === 'help' && state.helpOwner) {
            closeDialog({ silent: true });
        }
        var movie = null;
        try { movie = baye.hd.movie && baye.hd.movie(); } catch (e) {}
        if (movie && movie.active && !speOverlayHandlesMovie()) {
            onEngineMovie(); return;
        }
        if (state.open && state.kind === 'movie') { closeDialog({ silent: true }); }
        if (tryOpenQty()) { return; }
        var info = readAsync();
        var owner = readMarchReport();
        var reportOwner = nativeReportOwner(info);
        var waitingReport = info.hdActive != null ? !!Number(info.hdActive) :
            liveSpeechAsync(info) || (info.hdSeq && info.hdSeq !== state.lastReportSeq);
        if (owner || waitingReport) {
            if (looksLikeSpeech(info.text)) { applyEngineReport(info); }
            else {
                openDialog({ kind: 'report', title: info.id === 2 ? '对话' : '报告',
                    body: '', asyncId: info.id, allowEmpty: true, showLcd: true,
                    marchOwner: owner, reportOwner: reportOwner, reportSeq: Number(info.hdSeq) || 0 });
            }
            return;
        }
        if (info.id === 9 && cityMenuQty() && !cityMenuLeftoverQty()) {
            openDialog({ kind: 'qty', title: '数量', body: info.text,
                min: info.min, max: info.max, init: info.init, asyncId: 9 });
            return;
        }
        var menu = null;
        try { menu = baye.hd.menuItems && baye.hd.menuItems(); } catch (e) {}
        if (state.open && state.kind === 'report' && !owner &&
            !reportOwner && !liveSpeechAsync(info) && (info.hdActive != null || mapPickActive() || menu && menu.active)) {
            closeDialog({ silent: true }); return;
        }
        if (state.open && state.kind === 'report' && state.asyncId) {
            closeDialog({ silent: true });
        }
    }

    function qtyStep(delta) {
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.stepQty === 'function') {
            BayeHdCityMenu.stepQty(delta);
            return;
        }
        var q = standaloneQty();
        delta = Number(delta);
        if (!q || !q.active || state.qtyInputClosed || state.qtyAckFailed || state.qtyCommitPending ||
            [-10, -1, 1, 10].indexOf(delta) < 0) { return; }
        state.qtyQueue.push({ delta: delta, epoch: qtyEpoch });
        pumpStandaloneQty();
    }

    function invalidateDialogQty() {
        qtyEpoch += 1;
        state.qtyQueue = [];
        state.qtySending = false;
        state.qtyCommitPending = false;
        state.qtyInputClosed = false;
        state.qtySession = 0;
        state.qtyAckFailed = false;
        state.qtyAckError = '';
    }

    function readStandaloneQty() {
        try { return window.baye && baye.hd && baye.hd.qty ? baye.hd.qty() : null; }
        catch (error) { return null; }
    }

    function standaloneQty() {
        var q = readStandaloneQty();
        if (q && (!q.active || q.protocol && Number(q.session) !== state.qtyClosedSession)) {
            state.qtyClosedSession = 0;
        }
        if (q && q.protocol && q.active && Number(q.session) !== state.qtySession) {
            invalidateDialogQty();
            state.qtySession = Number(q.session);
        }
        if (q && q.protocol && q.active &&
            (Number(q.session) === state.qtyClosedSession || bayeQtyNativeClosed(q))) {
            state.qtyInputClosed = true;
        }
        return q;
    }

    function quantityKey(code) {
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.quantityKey === 'function') {
            BayeHdCityMenu.quantityKey(code);
            return;
        }
        code = Number(code);
        if ([VK.UP, VK.DOWN, VK.LEFT, VK.RIGHT, VK.HELP, VK.SEARCH].indexOf(code) < 0 &&
            !(code >= 0x40 && code <= 0x49 && Math.floor(code) === code)) { return; }
        var q = standaloneQty();
        if (!q || !q.active || state.qtyInputClosed || state.qtyAckFailed || state.qtyCommitPending) { return; }
        state.qtyQueue.push({ code: code, epoch: qtyEpoch });
        pumpStandaloneQty();
    }

    function pumpStandaloneQty() {
        if (state.qtySending) { return; }
        state.qtySending = true;
        var epoch = qtyEpoch;
        function valid() {
            return epoch === qtyEpoch && shouldShowHd() && state.open && state.kind === 'qty' &&
                !state.qtyInputClosed && !state.qtyAckFailed;
        }
        function stop(reason) {
            if (epoch !== qtyEpoch) { return; }
            state.qtyQueue = [];
            state.qtySending = false;
            state.qtyCommitPending = false;
            if (reason !== 'stale') {
                state.qtyAckFailed = true;
                state.qtyAckError = reason;
                render();
            }
        }
        function wait(code, q, after) {
            bayeQtyInputAck(code, q, { read: readStandaloneQty, valid: valid, send: engineSendKey },
                function (ok, reason, latest) {
                    if (!valid()) { stop('stale'); return; }
                    if (!ok) { stop(reason); return; }
                    after(latest);
                });
        }
        function next() {
            if (!valid()) { stop('stale'); return; }
            if (!state.qtyQueue.length) {
                state.qtySending = false;
                return;
            }
            var item = state.qtyQueue.shift();
            setTimeout(function () {
                if (!valid() || item.epoch !== qtyEpoch) { stop('stale'); return; }
                var q = readStandaloneQty();
                if (!q || !q.active || q.protocol && Number(q.session) !== state.qtySession) {
                    stop('owner'); return;
                }
                if (item.delta != null) {
                    function expand(latest) {
                        state.qtyQueue = bayeQtyStepKeys(item.delta, latest).map(function (code) {
                            return { code: code, epoch: epoch };
                        }).concat(state.qtyQueue);
                        next();
                    }
                    if (q.protocol) { wait(null, q, expand); } else { expand(q); }
                } else if (item.commit) {
                    function commit(latest) {
                        state.qtyCommitPending = false;
                        state.qtyInputClosed = true;
                        if (latest.protocol) { state.qtyClosedSession = Number(latest.session); }
                        state.qtyQueue = [];
                        state.qtySending = false;
                        var session = Number(latest.session);
                        bayeQtyCloseInput(latest);
                        engineSendKey(VK.ENTER);
                        setTimeout(function () {
                            var current = readStandaloneQty();
                            if (epoch === qtyEpoch && (!latest.protocol || !current || Number(current.session) === session)) {
                                closeQtyDialog();
                            }
                        }, 80);
                    }
                    if (q.protocol) { wait(null, q, commit); } else { commit(q); }
                } else if (q.protocol) {
                    wait(item.code, q, next);
                } else {
                    engineSendKey(item.code);
                    setTimeout(next, 40);
                }
            }, 0);
        }
        next();
    }

    function confirmDialog() {
        if (state.kind === 'defenders') {
            var defense = readDefenders();
            if (defense) { chooseDefender(defense.index); }
            return;
        }
        if (state.kind === 'successor') {
            var successor = readSuccessor();
            if (successor) { chooseSuccessor(successor.index); }
            return;
        }
        if (state.kind === 'qty') { commitQtyDialog(); return; }
        if (state.kind === 'help' && (state.helpOwner || fightActive())) {
            returnFromBattleHelp(); return;
        }
        if (state.kind === 'report' && (state.marchOwner || readMarchReport() ||
            !state.reportOwner && cityMenuMarching())) {
            confirmMarchReport(); return;
        }
        var info = readAsync();
        if (state.kind === 'report' && state.reportOwner) {
            if (!sameReport(state.reportOwner, nativeReportOwner(info)) ||
                sameReport(state.reportCommit, state.reportOwner)) { return; }
            state.reportCommit = state.reportOwner;
            engineSendKey(VK.ENTER);
            return;
        }
        if (state.kind === 'report' && info.hdActive != null) { return; }
        if (state.kind === 'report' && ((state.reportSeq && Number(info.hdSeq) !== state.reportSeq) ||
            (state.asyncId && info.id !== state.asyncId))) { return; }
        if (state.kind === 'report' && !liveSpeechAsync(info)) {
            var menu = null;
            try { menu = baye.hd.menuItems && baye.hd.menuItems(); } catch (e) {}
            if (mapPickActive() || menu && menu.active) { closeDialog({ silent: true }); return; }
        }
        if (state.kind === 'report' && !liveSpeechAsync(info) &&
            (leftoverMarchTip(state.body) || leftoverFarmReport(state.body))) {
            closeDialog({ silent: true }); return;
        }
        var epoch = state.viewEpoch;
        if (engineSendKey(VK.ENTER) && state.kind === 'help' && epoch === state.viewEpoch) {
            closeDialog({ silent: true });
        }
    }

    function backDialog() {
        if (state.kind === 'defenders') { finishDefenders(); return; }
        if (state.kind === 'successor') { return; }
        if (state.kind === 'qty') { cancelQtyDialog(); return; }
        if (state.kind === 'help' && (state.helpOwner || fightActive())) {
            returnFromBattleHelp(); return;
        }
        if (state.kind === 'report' && (state.marchOwner || readMarchReport() ||
            !state.reportOwner && (mapPickActive() || cityMenuMarching() || cityMenuHoldExit() || cityMenuQty()))) {
            closeDialog({ silent: true }); return;
        }
        if (state.kind === 'report' && state.reportOwner) {
            var info = readAsync();
            if (!sameReport(state.reportOwner, nativeReportOwner(info)) ||
                sameReport(state.reportCommit, state.reportOwner)) { return; }
            state.reportCommit = state.reportOwner;
            engineSendKey(VK.EXIT);
            return;
        }
        var epoch = state.viewEpoch;
        engineSendKey(VK.EXIT);
        if (epoch === state.viewEpoch) { closeDialog({ silent: true }); }
    }

    function bindUi() {
        if (state.bound) {
            return;
        }
        var root = el('hd-dialog');
        if (!root) {
            return;
        }
        state.bound = true;
        root.addEventListener('pointerdown', function (event) {
            state.pressedView = null;
            var target = event.target;
            while (target && target !== root) {
                if (target.getAttribute && (target.getAttribute('data-hd-dlg-ok') != null ||
                    target.getAttribute('data-hd-dlg-back') != null ||
                    target.getAttribute('data-hd-defender-index') != null ||
                    target.getAttribute('data-hd-defenders-finish') != null ||
                    target.getAttribute('data-hd-successor-index') != null)) {
                    state.pressedView = { epoch: state.viewEpoch, target: target,
                        defenseToken: target.getAttribute('data-hd-defenders-owner') };
                    return;
                }
                target = target.parentNode;
            }
        });
        root.addEventListener('pointercancel', function () { state.pressedView = null; });
        document.addEventListener('keydown', function (e) {
            if (bayeInputIgnored(e) || (global.BayeHdSpe && BayeHdSpe.isOpen && BayeHdSpe.isOpen())) { return; }
            var closedQty = readStandaloneQty();
            if (closedQty && closedQty.protocol && closedQty.active &&
                (Number(closedQty.session) === state.qtyClosedSession || bayeQtyNativeClosed(closedQty)) &&
                ([13, 27, 32].indexOf(e.keyCode) >= 0 || bayeQtyKeyboardCode(e.keyCode) != null)) {
                bayeConsumeKeyEvent(e);
                return;
            }
            if (!state.open || !shouldShowHd()) { return; }
            var quantity = state.kind === 'qty';
            var ownedReport = state.kind === 'report' && !!state.marchOwner;
            var ownedHelp = state.kind === 'help' && !!state.helpOwner;
            var ownedNativeReport = state.kind === 'report' && !!state.reportOwner;
            var ownedSuccessor = state.kind === 'successor' && !!state.successorOwner;
            var ownedDefense = state.kind === 'defenders' && !!state.defenseOwner;
            if ((ownedSuccessor || ownedDefense) && [38, 40].indexOf(e.keyCode) >= 0) {
                bayeConsumeKeyEvent(e);
                var menu = ownedDefense ? readDefenders() : readSuccessor();
                if (!e.repeat && menu) {
                    var index = menu.index + (e.keyCode === 38 ? -1 : 1);
                    if (index >= 0 && index < menu.names.length) {
                        if (ownedDefense) { chooseDefender(index, false); } else { chooseSuccessor(index, false); }
                    }
                }
                return;
            }
            if ((quantity || ownedReport || ownedHelp || ownedNativeReport || ownedSuccessor || ownedDefense) &&
                (e.keyCode === 13 || e.keyCode === 27 || quantity && e.keyCode === 32)) {
                bayeConsumeKeyEvent(e);
                if (!e.repeat) {
                    if (e.keyCode === 13) { confirmDialog(); } else { backDialog(); }
                }
                return;
            }
            if (quantity) {
                var qtyCode = bayeQtyKeyboardCode(e.keyCode);
                if (qtyCode != null) {
                    bayeConsumeKeyEvent(e);
                    quantityKey(qtyCode);
                    return;
                }
            }
            if ((ownedNativeReport || ownedDefense) && [32, 37, 38, 39, 40, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 70, 72, 83].indexOf(e.keyCode) >= 0) {
                // A modal report accepts an explicit Enter/Esc. Other game
                // hotkeys cannot leak into C or acknowledge it implicitly.
                bayeConsumeKeyEvent(e);
            }
        }, true);
        root.addEventListener('click', function (ev) {
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && (t.getAttribute('data-hd-defender-index') != null ||
                    t.getAttribute('data-hd-defenders-finish') != null)) {
                    ev.preventDefault();
                    var defensePressed = state.pressedView;
                    state.pressedView = null;
                    if (defensePressed && defensePressed.target === t &&
                        (defensePressed.epoch !== state.viewEpoch ||
                            defensePressed.defenseToken !== defenseToken(state.defenseOwner))) { return; }
                    var finish = t.getAttribute('data-hd-defenders-finish') != null;
                    if (ownedDefenseButton(t, finish)) {
                        if (finish) { finishDefenders(); }
                        else { chooseDefender(Number(t.getAttribute('data-hd-defender-index'))); }
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-successor-index') != null) {
                    ev.preventDefault();
                    var successorPressed = state.pressedView;
                    state.pressedView = null;
                    if (successorPressed && successorPressed.target === t &&
                        successorPressed.epoch !== state.viewEpoch) { return; }
                    if (state.successorOwner && Number(t.getAttribute('data-hd-successor-seq')) === state.successorOwner.seq) {
                        chooseSuccessor(Number(t.getAttribute('data-hd-successor-index')));
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-dlg-ok') != null) {
                    ev.preventDefault();
                    var pressed = state.pressedView;
                    state.pressedView = null;
                    if (pressed && pressed.target === t && pressed.epoch !== state.viewEpoch) { return; }
                    if (state.open && shouldShowHd()) { confirmDialog(); }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-dlg-back') != null) {
                    ev.preventDefault();
                    var backPressed = state.pressedView;
                    state.pressedView = null;
                    if (backPressed && backPressed.target === t && backPressed.epoch !== state.viewEpoch) { return; }
                    if (state.open && shouldShowHd()) { backDialog(); }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-dlg-lcd') != null) {
                    ev.preventDefault();
                    state.showLcd = !state.showLcd;
                    applyChrome();
                    t.textContent = state.showLcd ? '隐藏经典画面' : '经典画面';
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-qty') != null) {
                    ev.preventDefault();
                    qtyStep(Number(t.getAttribute('data-hd-qty')));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-digit') != null) {
                    ev.preventDefault();
                    var dgt = Number(t.getAttribute('data-hd-digit'));
                    if (isFinite(dgt) && dgt >= 0 && dgt <= 9) {
                        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.digitQty === 'function') {
                            BayeHdCityMenu.digitQty(dgt);
                        } else {
                            quantityKey(0x40 + dgt);
                        }
                    }
                    return;
                }
                t = t.parentNode;
            }
        });
    }

    function onEngineHook(name) {
        state.lastHook = name;
        if (name === 'chooseGameEntry' || name === 'didOpenNewGame' || name === 'didLoadGame') {
            closeDialog({ silent: true });
            state.reportCommit = null;
            state.successorCommit = null;
            state.defenseCommit = null;
            return;
        }
        if (name === 'showMainHelp') {
            if (cityMenuMarching() && !cityMenuQty()) {
                closeDialog({ silent: true });
            } else {
                openDialog({ kind: 'help', title: '帮助', body: '', showLcd: true });
            }
        }
        pollEngine();
    }

    function start() {
        bindUi();
        applyChrome();
        setInterval(function () {
            try {
                pollEngine();
            } catch (e) {
                console.warn('[hd-dialog] poll', e);
            }
        }, 220);
    }

    applyChrome();

    global.BayeHdDialog = {
        shouldShowHd: shouldShowHd,
        isOpen: function () { return state.open; },
        isBlockingKeyboard: isBlockingKeyboard,
        openReport: function (body, title) {
            return openDialog({ kind: 'report', title: title || '报告', body: body || '', showLcd: true });
        },
        openQty: function (meta) {
            meta = meta || {};
            meta.kind = 'qty';
            meta.title = meta.title || '数量';
            meta.showLcd = true;
            return openDialog(meta);
        },
        openHelp: function () {
            return requestHelp(VK.HELP, '帮助');
        },
        openSearch: function () {
            return requestHelp(VK.SEARCH, '查找');
        },
        close: closeDialog,
        closeQty: closeQtyDialog,
        retireStaleReport: retireStaleReport,
        chooseSuccessor: chooseSuccessor,
        chooseDefender: chooseDefender,
        finishDefenders: finishDefenders,
        isQtyOpen: function () { return !!(state.open && state.kind === 'qty'); },
        clearLeftoverMarch: clearLeftoverMarch,
        dismissLeftoverSpeech: dismissLeftoverSpeech,
        resetArmout: function () {
            /* 新出征不要把上场「部队已出发」seq 清零，否则会再回车一次。 */
            try {
                var r = window.baye && baye.hd && typeof baye.hd.report === 'function' && baye.hd.report();
                if (r && /部队已出发/.test(r.text || '') && r.seq) {
                    state.lastArmoutEnterSeq = r.seq;
                }
            } catch (e) {}
            state.lastSpeechEnterSeq = 0;
        },
        onEngineHook: onEngineHook,
        onEngineReport: onEngineReport,
        onEngineHelp: onEngineHelp,
        onEngineMovie: onEngineMovie,
        poll: pollEngine,
        start: start,
        applyPcPage: start,
        debugSnapshot: function () {
            var info = readAsync();
            return {
                open: state.open,
                kind: state.kind,
                asyncId: info.id,
                textLen: (info.text || '').length,
                min: info.min,
                max: info.max,
                body: state.body,
                reportText: (window.baye && baye.hd && baye.hd.reportText) ? baye.hd.reportText() : '',
                pass: state.kind === 'report' && (state.marchOwner && cityMenuOpen() ||
                    !state.marchOwner && !state.reportOwner && !state.asyncId && leftoverMarchTip(state.body) ||
                    !state.reportOwner && !state.asyncId && leftoverFarmReport(state.body)) || leftoverHelpDuringMarch(),
                leftoverHelp: leftoverHelpDuringMarch(),
                leftoverFarm: leftoverFarmReport(state.body || ''),
                lastReportSeq: state.lastReportSeq,
                lastSpeechEnterSeq: state.lastSpeechEnterSeq,
                marchOwner: state.marchOwner,
                helpOwner: state.helpOwner,
                reportOwner: state.reportOwner,
                successorOwner: state.successorOwner,
                successorRequest: state.successorRequest ? { index: state.successorRequest.index, seq: state.successorRequest.owner.seq } : null,
                defenseOwner: state.defenseOwner,
                defenseRequest: state.defenseRequest ? { index: state.defenseRequest.index,
                    seq: state.defenseRequest.owner.seq, expectedIndex: state.defenseRequest.expectedIndex } : null,
                defenseCommitted: sameCampaignPersons(state.defenseCommit, state.defenseOwner),
                reportSeq: state.reportSeq,
                viewEpoch: state.viewEpoch
            };
        }
    };
})(window);
