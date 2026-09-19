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
        lastHook: ''
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
        return t.length >= 2 && t.length < 400 && !/^\[object/.test(t);
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
        info.text = readString(data, 'g_asyncActionStringParam');
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

    function applyChrome() {
        var show = state.open && shouldShowHd();
        document.documentElement.setAttribute('data-baye-dialog', show ? 'hd' : 'off');
        if (document.body) {
            document.body.classList.toggle('baye-hd-dialog-on', show);
            document.body.classList.toggle('baye-hd-dialog-lcd', show && state.showLcd);
            document.body.classList.toggle('baye-hd-dialog-help', show && (state.kind === 'help'));
            document.body.classList.toggle('baye-hd-dialog-empty-text', show && !state.body);
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
                body.textContent = '数量由引擎保存。词典无 0–9 键，HD 只发上下左右 / 确认。区间来自探测，没有就不写。';
            } else if (state.kind === 'help') {
                body.textContent = (state.title === '查找' ? '已发 VK_SEARCH。' : '已发 VK_HELP。') +
                    ' 引擎帮助/查找正文画在下方放大的经典屏上，这里不编造条目。';
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
        }
        setText(el('hd-dialog-probe'), 'kind=' + state.kind + '  async=' + state.asyncId +
            '  hook=' + (state.lastHook || '—'));
    }

    function openDialog(meta) {
        meta = meta || {};
        if (!shouldShowHd()) {
            return false;
        }
        state.open = true;
        state.kind = meta.kind || 'report';
        state.title = meta.title || (state.kind === 'qty' ? '数量' : (state.kind === 'help' ? '帮助' : '报告'));
        state.body = meta.body || '';
        state.min = meta.min != null ? meta.min : null;
        state.max = meta.max != null ? meta.max : null;
        state.init = meta.init != null ? meta.init : null;
        state.showLcd = meta.showLcd !== false;
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
        if (!opts.silent) {
            console.log('[hd-dialog] close');
        }
    }

    function pollEngine() {
        if (!shouldShowHd()) {
            if (state.open && state.kind !== 'qty' && state.kind !== 'help') {
                closeDialog({ silent: true });
            }
            return;
        }
        var info = readAsync();
        if (info.id === 1 || info.id === 2 || info.id === 13) {
            state.asyncId = info.id;
            openDialog({
                kind: 'report',
                title: info.id === 2 ? '对话' : '报告',
                body: info.text,
                asyncId: info.id
            });
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
        if (state.open && state.kind === 'report' && !state.body && info.id === 0 && state.lastHook === 'auto') {
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
                    engineSendKey(VK.ENTER);
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-dlg-back') != null) {
                    ev.preventDefault();
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
        setInterval(pollEngine, 350);
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
        onEngineHook: onEngineHook,
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
                body: state.body
            };
        }
    };
})(window);
