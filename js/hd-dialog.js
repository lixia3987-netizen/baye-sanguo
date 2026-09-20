/**
 * HD 报告 / 对话 / 帮助 / 数量输入壳。
 * 只发 sendKey；不 stub showMainHelp。规格：docs/hd-dialog-spec.md
 */
(function (global) {
    var OVERWORLD_KEY = 'baye/overworldMode';
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
        lastSpeechEnterSeq: 0
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
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.shouldShowHd === 'function') {
            return BayeHdCityMenu.shouldShowHd();
        }
        return overworldIsHd();
    }

    function engineData() {
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
        if (code === VK.EXIT && cityMenuHoldExit()) {
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
        if (/饥荒|旱灾|水灾|暴动|俘虏|拥立|成为|遭劫|病逝|金钱不足|粮草不足|城中无空闲武将/.test(String(text))) {
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
                if (f && f.active) {
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

    function applyChrome() {
        var show = state.open && shouldShowHd();
        var pass = show && state.kind === 'report' && leftoverMarchTip(state.body);
        document.documentElement.setAttribute('data-baye-dialog', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-dialog-pass', pass ? '1' : '0');
        if (document.body) {
            document.body.classList.toggle('baye-hd-dialog-on', show);
            document.body.classList.toggle('baye-hd-dialog-lcd', show && state.showLcd);
            document.body.classList.toggle('baye-hd-dialog-help', show && (state.kind === 'help'));
            document.body.classList.toggle('baye-hd-dialog-empty-text', show && !state.body);
            document.body.classList.toggle('baye-hd-dialog-pass', pass);
        }
        var root = el('hd-dialog');
        if (root) {
            root.classList.toggle('is-open', show);
            root.classList.toggle('is-qty', state.kind === 'qty');
            root.classList.toggle('is-empty-text', !state.body);
            root.setAttribute('aria-hidden', show ? 'false' : 'true');
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
            if (state.body) {
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
                body.textContent = (qv || '数量由引擎保存。') +
                    ' 方向键步进；0–9 发 VK_DIGIT0=0x40（不占用词典 0x30–0x33）。';
            } else if (state.kind === 'help') {
                body.textContent = (state.title === '查找' ? '已发 VK_SEARCH。' : '已发 VK_HELP。') +
                    ' 引擎若写入 g_hdHelpGbk 会显示在这里；否则下方放大经典屏是原文，不编造条目。';
            } else if (state.kind === 'movie') {
                body.textContent = '经典 SPE 帧动画，无独立图文接口。确认=跳过。';
            } else {
                body.textContent = '引擎没把报告字符串写进 JS 桥。下方放大的经典屏是原文；确认 / 返回仍发回引擎。';
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
                bits.push('初值 ' + state.init);
            }
            range.textContent = bits.length ? bits.join(' · ') : (state.kind === 'qty' ? '区间未探测' : '');
            range.hidden = state.kind !== 'qty' && !bits.length;
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
            caption.hidden = !!state.body;
        }
        setText(el('hd-dialog-probe'), 'kind=' + state.kind + '  async=' + state.asyncId +
            '  hook=' + (state.lastHook || '—') +
            (state.body ? '  text=' + state.body.length : ''));
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

    function cityMenuHoldExit() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.holdExit === 'function' &&
            BayeHdCityMenu.holdExit());
    }

    function cityMenuQty() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.qty === 'function') {
                var q = baye.hd.qty();
                return !!(q && q.active);
            }
        } catch (e) {}
        return false;
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
        var text = (info && info.text) || state.body || '';
        if (leftoverMarchTip(text) || leftoverMarchTip(state.body)) {
            return closeReportSilent(info);
        }
        if (!leftoverCharacterSpeech(text) && !leftoverCharacterSpeech(state.body)) {
            return false;
        }
        var seq = (info && info.hdSeq) || 0;
        var already = state.lastSpeechEnterSeq && (!seq || seq <= state.lastSpeechEnterSeq);
        var shown = state.open && state.kind === 'report';
        var liveAsync = liveSpeechAsync(info);
        /* 地图 leftover pick 上回车会确认当前城。完成选将后再回车会策略结束。 */
        var pickUnsafe = mapPickActive() && !cityMenuOpen() && !cityMenuMarching();
        if (!already && !fightActive() && !strategyHandoff() && !actuallyFunctionMenu() &&
            !cityMenuPersonExitSent() && !pickUnsafe &&
            (shown || liveAsync || cityMenuMarching() || cityMenuOpen())) {
            engineSendKey(VK.ENTER);
            state.lastSpeechEnterSeq = seq || (state.lastSpeechEnterSeq + 1) || 1;
        }
        return closeReportSilent(info);
    }

    function tryOpenQty() {
        try {
            if (window.baye && baye.hd && baye.hd.qty) {
                var qtyInfo = baye.hd.qty();
                if (qtyInfo && qtyInfo.active) {
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
        return false;
    }

    function applyEngineReport(info) {
        info = info || {};
        if (!looksLikeSpeech(info.text)) {
            return false;
        }
        /* 出征向导里过月残留台词必须关壳，否则挡住 GetFood；回车策略见 dismissLeftoverSpeech。 */
        if (cityMenuMarching() && leftoverCharacterSpeech(info.text)) {
            return dismissLeftoverSpeech(info);
        }
        /* PolicyExec「农业开发度变为」过月后常年残留。回车会策略结束或点进开垦将表。 */
        if (/农业|商业|开发度|变为/.test(info.text || '')) {
            return closeReportSilent(info);
        }
        /* 「部队已出发」是 ShowConstStrMsg：第一次（pick=0、引擎卡住）回车关掉；
         * 之后 g_hdReportGbk 残留。全屏壳会挡住策略结束 / 招商，回车会打进 FunctionMenu 或战场。 */
        if (/部队已出发/.test(info.text || '')) {
            var seq = info.hdSeq || 0;
            var already = state.lastArmoutEnterSeq && (!seq || seq <= state.lastArmoutEnterSeq);
            /* 新开一趟出征时 g_hdReportGbk 仍是上场「部队已出发」。回车会打进 FunctionMenu / 选将。 */
            var leftoverNewMarch = cityMenuMarching() && !cityMenuFreshMarch();
            var unsafe = mapPickActive() || fightActive() || functionMenuLive() ||
                strategyHandoff() || leftoverNewMarch;
            if (!already && !unsafe) {
                engineSendKey(VK.ENTER);
                state.lastArmoutEnterSeq = seq || (state.lastArmoutEnterSeq + 1) || 1;
            }
            return closeReportSilent(info);
        }
        if (/敌方城池|无人占领/.test(info.text || '') && !cityMenuMarching()) {
            /* pick=1 时只是桥残留，回车会确认当前格。pick=0 才是 PlayerTactic 真提示。 */
            if (!mapPickActive() && !fightActive() && !functionMenuLive() && !strategyHandoff()) {
                engineSendKey(VK.ENTER);
            }
            return closeReportSilent(info);
        }
        /* GetCitySet / 过图 pick 共用 g_hdMapPick。残留「选择目标」「敌方城池」全屏壳会挡住点城。
         * 出征中对「敌方城池」不能回车，那会确认当前格。 */
        if (isMapPickTip(info.text) && (mapPickActive() || cityMenuMarching() || cityMenuOpen())) {
            return closeReportSilent(info);
        }
        if (info.hdSeq) {
            state.lastReportSeq = info.hdSeq;
        }
        var title = info.hdKind === 2 ? '对话' : '报告';
        var personName = '';
        try {
            if (info.hdPerson != null && info.hdPerson !== 0xffff && info.hdPerson !== 65535 && window.baye) {
                personName = baye.getPersonName(info.hdPerson) || '';
            }
        } catch (e) {}
        if (personName) {
            title = personName;
        }
        return openDialog({
            kind: 'report',
            title: title,
            body: info.text,
            asyncId: info.id,
            showLcd: false
        });
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
        if (!looksLikeHelp(info.text)) {
            return false;
        }
        var fightOn = false;
        try {
            fightOn = !!(window.baye && baye.data && Number(baye.data.g_hdFightActive));
        } catch (e) {}
        return openDialog({
            kind: 'help',
            title: fightOn ? '战场帮助' : '帮助',
            body: formatHelpBody(info.text),
            showLcd: false
        });
    }

    function onEngineHelp() {
        var info = null;
        try {
            info = window.baye && baye.hd && baye.hd.help ? baye.hd.help() : null;
        } catch (e) {}
        if (info && info.active && looksLikeHelp(info.text)) {
            applyEngineHelp(info);
            return;
        }
        if (state.open && state.kind === 'help') {
            closeDialog({ silent: true });
        }
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
                body: '经典 SPE 帧（MAIN_SPE=' + (info.id != null ? info.id : '') + '）。无独立图文可导出。',
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
        state.open = true;
        state.kind = meta.kind || 'report';
        state.title = meta.title || (state.kind === 'qty' ? '数量' :
            (state.kind === 'help' ? '帮助' : (state.kind === 'movie' ? '开场动画' : '报告')));
        state.body = meta.body || '';
        state.min = meta.min != null ? meta.min : null;
        state.max = meta.max != null ? meta.max : null;
        state.init = meta.init != null ? meta.init : null;
        state.showLcd = looksLikeSpeech(state.body) ? false : (meta.showLcd !== false);
        if (meta.asyncId != null) {
            state.asyncId = meta.asyncId;
        }
        render();
        return true;
    }

    function closeDialog(opts) {
        opts = opts || {};
        state.open = false;
        applyChrome();
        document.documentElement.setAttribute('data-baye-dialog-pass', '0');
        if (!opts.silent) {
            console.log('[hd-dialog] close');
        }
    }

    function clearLeftoverMarch() {
        if (leftoverMarchTip(state.body)) {
            state.body = '';
            closeDialog({ silent: true });
        }
    }

    function pollEngine() {
        if (!shouldShowHd()) {
            if (state.open && state.kind !== 'qty' && state.kind !== 'help') {
                closeDialog({ silent: true });
            }
            return;
        }
        try {
            if (window.baye && baye.hd && baye.hd.movie) {
                var mv = baye.hd.movie();
                if (speOverlayHandlesMovie()) {
                    if (state.open && state.kind === 'movie') {
                        closeDialog({ silent: true });
                    }
                } else if (mv && mv.active) {
                    openDialog({
                        kind: 'movie',
                        title: '开场动画',
                        body: '经典 SPE 帧（MAIN_SPE）。无独立图文可导出；跳过发回车。',
                        showLcd: true,
                        allowEmpty: true
                    });
                    return;
                }
                if (state.open && state.kind === 'movie' && !(mv && mv.active)) {
                    closeDialog({ silent: true });
                }
            }
        } catch (e) {}
        try {
            if (window.baye && baye.hd && baye.hd.help) {
                var hp = baye.hd.help();
                if (hp && hp.active && looksLikeHelp(hp.text)) {
                    applyEngineHelp(hp);
                    return;
                }
            }
        } catch (e) {}
        try {
            if (window.baye && baye.data && Number(baye.data.g_hdFightActive) &&
                !Number(baye.data.g_hdFightOver)) {
                if (state.open && state.kind === 'report') {
                    closeDialog({ silent: true });
                }
                if (state.kind !== 'help') {
                    return;
                }
            }
        } catch (e) {}
        var info = readAsync();
        var tipText = info.text || state.body || '';
        /* GetFood 优先：残留台词 / leftover pick 不能挡住数量壳。 */
        if (tryOpenQty()) {
            return;
        }
        /* 残留「部队已出发」等出征提示在 pick=0、策略结束、全军撤退后、城菜单开着时都必须关壳。 */
        if (state.open && state.kind === 'report' && leftoverMarchTip(state.body || tipText)) {
            closeDialog({ silent: true });
            if (info.hdSeq) {
                state.lastReportSeq = info.hdSeq;
            }
            if ((mapPickActive() && !cityMenuMarching()) || fightActive() || strategyHandoff()) {
                return;
            }
        }
        if (cityMenuMarching() && leftoverCharacterSpeech(info.text || state.body)) {
            dismissLeftoverSpeech(info);
            if (tryOpenQty()) {
                return;
            }
        }
        if (mapPickActive() || (cityMenuMarching() && isMapPickTip(info.text || (state.body || '')))) {
            if (state.open && state.kind === 'report' && leftoverMarchTip(state.body || info.text)) {
                closeDialog({ silent: true });
            }
            if (info.hdSeq) {
                state.lastReportSeq = info.hdSeq;
            }
            /* 出征选粮阶段 leftover pick 是过图旗，不是 GetCitySet；继续探数量。 */
            if (mapPickActive() && !cityMenuMarching()) {
                return;
            }
            if (tryOpenQty()) {
                return;
            }
        }
        if (info.hdSeq && info.hdSeq !== state.lastReportSeq && looksLikeSpeech(info.text)) {
            applyEngineReport(info);
            return;
        }
        if (info.id === 1 || info.id === 2 || info.id === 13) {
            state.asyncId = info.id;
            if (cityMenuMarching() && leftoverCharacterSpeech(info.text)) {
                dismissLeftoverSpeech(info);
                if (tryOpenQty()) {
                    return;
                }
            } else if (looksLikeSpeech(info.text)) {
                applyEngineReport(info);
            } else {
                openDialog({
                    kind: 'report',
                    title: info.id === 2 ? '对话' : '报告',
                    body: '',
                    asyncId: info.id,
                    allowEmpty: true,
                    showLcd: true
                });
            }
            return;
        }
        if (info.id === 9) {
            state.asyncId = 9;
            openDialog({
                kind: 'qty',
                title: '数量',
                body: info.text,
                min: info.min,
                max: info.max,
                init: info.init,
                asyncId: 9
            });
            return;
        }
        state.asyncId = info.id;
        if (state.open && state.kind === 'report' && !state.body && looksLikeSpeech(info.text)) {
            state.body = info.text;
            render();
            return;
        }
        if (state.open && state.kind === 'report' && !state.body && info.id === 0 &&
            state.lastHook === 'auto' &&
            !(global.BayeHdCityMenu && BayeHdCityMenu.isOpen && BayeHdCityMenu.isOpen())) {
            closeDialog({ silent: true });
        }
    }

    function sendRepeat(code, n) {
        var i;
        for (i = 0; i < n; i++) {
            engineSendKey(code);
        }
    }

    function qtyStep(delta) {
        if (delta <= -10) {
            sendRepeat(VK.LEFT, 1);
            sendRepeat(VK.DOWN, Math.min(9, Math.abs(delta) - 1));
            return;
        }
        if (delta >= 10) {
            sendRepeat(VK.RIGHT, 1);
            sendRepeat(VK.UP, Math.min(9, delta - 1));
            return;
        }
        if (delta < 0) {
            sendRepeat(VK.DOWN, -delta);
        } else {
            sendRepeat(VK.UP, delta);
        }
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
        root.addEventListener('click', function (ev) {
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && t.getAttribute('data-hd-dlg-ok') != null) {
                    ev.preventDefault();
                    if (state.kind === 'report' && leftoverMarchTip(state.body)) {
                        var passOnly = /部队已出发/.test(state.body || '') ||
                            cityMenuMarching() || cityMenuOpen() || mapPickActive() ||
                            fightActive() || functionMenuLive() || strategyHandoff();
                        closeDialog({ silent: true });
                        if (passOnly) {
                            return;
                        }
                    }
                    engineSendKey(VK.ENTER);
                    if (state.kind === 'report' && leftoverMarchTip(state.body)) {
                        closeDialog({ silent: true });
                    }
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-dlg-back') != null) {
                    ev.preventDefault();
                    /* 「选择目标」/ 出征向导返回不能 EXIT：GetCitySet / BattleMake 会退回将领表。 */
                    if (isMapPickTip(state.body) || mapPickActive() || cityMenuMarching() ||
                        cityMenuHoldExit() || cityMenuQty()) {
                        closeDialog({ silent: true });
                        return;
                    }
                    engineSendKey(VK.EXIT);
                    closeDialog({ silent: false });
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-dlg-lcd') != null) {
                    ev.preventDefault();
                    state.showLcd = !state.showLcd;
                    applyChrome();
                    t.textContent = state.showLcd ? '隐藏经典 LCD' : '经典 LCD';
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
                        engineSendKey(0x40 + dgt);
                    }
                    return;
                }
                t = t.parentNode;
            }
        });
    }

    function onEngineHook(name) {
        state.lastHook = name;
        if (name === 'showMainHelp') {
            openDialog({ kind: 'help', title: '帮助', body: '', showLcd: true });
        }
        pollEngine();
    }

    function start() {
        bindUi();
        applyChrome();
        setInterval(pollEngine, 180);
    }

    applyChrome();

    global.BayeHdDialog = {
        shouldShowHd: shouldShowHd,
        isOpen: function () { return state.open; },
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
            engineSendKey(VK.HELP);
            return openDialog({ kind: 'help', title: '帮助', body: '', showLcd: true });
        },
        openSearch: function () {
            engineSendKey(VK.SEARCH);
            return openDialog({ kind: 'help', title: '查找', body: '', showLcd: true });
        },
        close: closeDialog,
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
                pass: leftoverMarchTip(state.body),
                lastReportSeq: state.lastReportSeq,
                lastSpeechEnterSeq: state.lastSpeechEnterSeq
            };
        }
    };
})(window);
