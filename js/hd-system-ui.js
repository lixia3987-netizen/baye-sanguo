/**
 * HD 系统界面壳：标题 / 时期 / 君主 / 存读档。
 * 只发 sendKey；不 stub 会替换系统菜单的 hook。
 * 规格：docs/hd-system-ui-spec.md
 */
(function (global) {
    var STORAGE_KEY = 'baye/systemUiMode';
    var OVERWORLD_KEY = 'baye/overworldMode';
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, ENTER: 0x27, EXIT: 0x28 };
    var TITLE = ['新君登基', '重返沙场', '制作群组', '解甲归田'];
    var PERIODS = ['董卓弄权', '曹操崛起', '赤壁之战', '三国鼎立'];
    var INSYSTEM = ['策略结束', '存储进度', '结束游戏'];
    var REPLACE_HOOKS = {
        chooseGameEntry: 1,
        loadPeriod: 1,
        chooseActor: 1,
        mainSystemMenu: 1
    };

    var state = {
        mode: 'auto',
        open: false,
        screen: 'title',
        idleIndex: 0,
        lastHook: '',
        showLcd: false,
        bound: false,
        sending: false,
        queue: [],
        kings: [],
        saves: [],
        probed: false
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

    function playerKingId() {
        var data = engineData();
        if (!data) {
            return null;
        }
        var raw = readNumber(data, 'g_PlayerKing');
        if (raw === null || raw === 0xff || raw === 255 || raw === 0xffff) {
            return null;
        }
        return raw;
    }

    function citiesHaveBelong() {
        var data = engineData();
        if (!data || !data.g_Cities) {
            return false;
        }
        var i;
        for (i = 0; i < data.g_Cities.length; i++) {
            var b = readNumber(data.g_Cities[i], 'Belong');
            if (b && b !== 0xff && b !== 255) {
                return true;
            }
        }
        return false;
    }

    function personNameById(id) {
        try {
            if (window.baye && typeof baye.getPersonNameByID === 'function') {
                return baye.getPersonNameByID(id);
            }
        } catch (e) {}
        return String(id);
    }

    function probeKings() {
        var data = engineData();
        var list = [];
        var seen = {};
        if (!data || !data.g_Cities) {
            return list;
        }
        var i;
        for (i = 0; i < data.g_Cities.length; i++) {
            var b = readNumber(data.g_Cities[i], 'Belong');
            if (!b || b === 0xff || b === 255 || seen[b]) {
                continue;
            }
            seen[b] = true;
            var name = personNameById(b);
            var cityName = '';
            try {
                cityName = baye.getCityName(i) || '';
            } catch (e) {}
            list.push({ id: b, name: name || ('ID ' + b), city: cityName });
        }
        return list;
    }

    function probeSaves() {
        var list = [];
        var i;
        try {
            for (i = 0; i < 8; i++) {
                var key = 'baye//data//sango' + i + '.sav';
                var raw = global.localStorage.getItem(key);
                if (raw) {
                    list.push({ index: i, key: 'sango' + i + '.sav', bytes: raw.length });
                }
            }
        } catch (e) {}
        return list;
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
            engineSendKey(item.code);
            setTimeout(next, item.wait || 55);
        }
        next();
    }

    function keysToIndex(target) {
        var keys = [];
        var cur = state.idleIndex;
        var i;
        if (cur == null || cur < 0) {
            for (i = 0; i < 12; i++) {
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

    function inferScreen() {
        var king = playerKingId();
        var belong = citiesHaveBelong();
        if (king != null && belong) {
            if (state.screen === 'insystem' || state.screen === 'saveload') {
                return state.screen;
            }
            return null;
        }
        if (belong && king == null) {
            return 'king';
        }
        if (state.screen === 'period' || state.screen === 'saveload' || state.screen === 'insystem') {
            return state.screen;
        }
        return 'title';
    }

    function applyChrome() {
        var show = state.open && shouldShowHd();
        document.documentElement.setAttribute('data-baye-system-ui', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-system-ui-pref', getMode());
        if (document.body) {
            document.body.classList.toggle('baye-hd-system-ui-on', show);
            document.body.classList.toggle('baye-hd-system-ui-lcd', show && state.showLcd);
        }
        var root = el('hd-system-ui');
        if (root) {
            root.classList.toggle('is-open', show);
            root.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
    }

    function currentItems() {
        if (state.screen === 'period') {
            return PERIODS;
        }
        if (state.screen === 'insystem') {
            return INSYSTEM;
        }
        if (state.screen === 'king') {
            return state.kings.map(function (k) {
                return k.name + (k.city ? ' · ' + k.city : '');
            });
        }
        if (state.screen === 'saveload') {
            if (!state.saves.length) {
                return [];
            }
            return state.saves.map(function (s) {
                return s.key + ' · ' + s.bytes + 'B';
            });
        }
        return TITLE;
    }

    function screenTitle() {
        return {
            title: '三国霸业',
            period: '选择时期',
            king: '选择君主',
            saveload: '存读档',
            insystem: '系统指令'
        }[state.screen] || '系统';
    }

    function screenHint() {
        if (state.screen === 'king') {
            return '名单来自各城 Belong，点选按 onMenuIdle 光标发键，形势图顺序可能不同。';
        }
        if (state.screen === 'saveload') {
            return state.saves.length
                ? '只列出探测到的 sango*.sav，不编造空档。'
                : '未探测到本地 sango*.sav。经典 LCD 可对照引擎空列表。';
        }
        if (state.screen === 'period') {
            return '董卓弄权 / 曹操崛起 / 赤壁之战 / 三国鼎立 · 点选发键';
        }
        if (state.screen === 'insystem') {
            return '策略结束 / 存储进度 / 结束游戏 · FEATURES 已核验';
        }
        return '新君登基 / 重返沙场 / 制作群组 / 解甲归田 · 与引擎主菜单一致';
    }

    function fillList() {
        var list = el('hd-system-ui-list');
        if (!list) {
            return;
        }
        var items = currentItems();
        list.innerHTML = '';
        var i;
        if (!items.length) {
            var empty = document.createElement('div');
            empty.className = 'hd-system-ui-empty';
            empty.textContent = state.screen === 'saveload'
                ? '未探测到存档。请用经典 LCD 或先在游戏内存储进度。'
                : '暂无探测项。';
            list.appendChild(empty);
            return;
        }
        for (i = 0; i < items.length; i++) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'hd-system-ui-item';
            btn.setAttribute('data-hd-sys', String(i));
            if (state.idleIndex === i) {
                btn.classList.add('is-idle');
            }
            btn.textContent = items[i];
            list.appendChild(btn);
        }
    }

    function render() {
        applyChrome();
        if (!(state.open && shouldShowHd())) {
            return;
        }
        setText(el('hd-system-ui-title'), screenTitle());
        setText(el('hd-system-ui-sub'), screenHint());
        fillList();
        var probe = el('hd-system-ui-probe');
        setText(probe, 'screen=' + state.screen +
            '  hook=' + (state.lastHook || '—') +
            '  idle=' + (state.idleIndex == null ? '—' : state.idleIndex) +
            '  kings=' + state.kings.length +
            '  saves=' + state.saves.length);
        syncToolbar();
    }

    function refresh() {
        var next = inferScreen();
        if (!shouldShowHd()) {
            if (state.open) {
                closeUi({ silent: true });
            }
            return;
        }
        if (global.BayeHdBattle && BayeHdBattle.isOpen && BayeHdBattle.isOpen()) {
            if (state.open) {
                closeUi({ silent: true });
            }
            return;
        }
        if (!next) {
            if (state.open) {
                closeUi({ silent: true });
            }
            return;
        }
        if (next === 'king') {
            state.kings = probeKings();
        }
        if (next === 'saveload') {
            state.saves = probeSaves();
        }
        var wasOpen = state.open;
        state.screen = next;
        state.open = true;
        if (!wasOpen) {
            console.log('[hd-system-ui] open', next);
        }
        render();
    }

    function closeUi(opts) {
        opts = opts || {};
        state.open = false;
        applyChrome();
        if (!opts.silent) {
            console.log('[hd-system-ui] close');
        }
    }

    function choose(index) {
        pickIndex(index, true);
        if (state.screen === 'title') {
            if (index === 0) {
                state.screen = 'period';
                state.idleIndex = 0;
            } else if (index === 1) {
                state.screen = 'saveload';
                state.showLcd = true;
                state.saves = probeSaves();
                state.idleIndex = 0;
            } else {
                state.showLcd = true;
            }
        } else if (state.screen === 'period') {
            state.idleIndex = 0;
        } else if (state.screen === 'insystem' && index === 1) {
            state.screen = 'saveload';
            state.showLcd = true;
            state.saves = probeSaves();
            state.idleIndex = 0;
        }
        render();
    }

    function back() {
        if (state.screen === 'period' || state.screen === 'saveload' || state.screen === 'king') {
            enqueueKeys([VK.EXIT], 60);
            state.screen = 'title';
            state.idleIndex = 0;
            render();
            return;
        }
        if (state.screen === 'insystem') {
            enqueueKeys([VK.EXIT], 60);
            closeUi({ silent: false });
            return;
        }
        enqueueKeys([VK.EXIT], 60);
    }

    function onEngineHook(name, ctx) {
        if (REPLACE_HOOKS[name]) {
            state.lastHook = name;
            if (name === 'chooseGameEntry') {
                state.screen = 'title';
            } else if (name === 'loadPeriod') {
                state.screen = 'period';
            } else if (name === 'chooseActor') {
                state.screen = 'king';
                state.kings = probeKings();
            } else if (name === 'mainSystemMenu') {
                state.screen = 'insystem';
            }
        } else {
            state.lastHook = name || state.lastHook;
        }
        if (ctx && ctx.index != null && isFinite(Number(ctx.index))) {
            state.idleIndex = Number(ctx.index);
        }
        if (name === 'didOpenNewGame' || name === 'didLoadGame') {
            closeUi({ silent: true });
            return;
        }
        if (shouldShowHd()) {
            refresh();
        }
    }

    function bindUi() {
        if (state.bound) {
            return;
        }
        var root = el('hd-system-ui');
        if (!root) {
            return;
        }
        state.bound = true;
        root.addEventListener('click', function (ev) {
            if (ev.target === root) {
                return;
            }
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && t.getAttribute('data-hd-sys') != null) {
                    ev.preventDefault();
                    choose(Number(t.getAttribute('data-hd-sys')));
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-sys-back') != null) {
                    ev.preventDefault();
                    back();
                    return;
                }
                if (t.getAttribute && t.getAttribute('data-hd-sys-lcd') != null) {
                    ev.preventDefault();
                    state.showLcd = !state.showLcd;
                    applyChrome();
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
            if (e.keyCode === 27) {
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
        var mode = getMode();
        var buttons = toolbar.querySelectorAll('[data-hd-system-ui]');
        var i;
        for (i = 0; i < buttons.length; i++) {
            var active = buttons[i].getAttribute('data-hd-system-ui') === mode;
            buttons[i].classList.toggle('is-active', active);
            buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
        }
    }

    function bindToolbar() {
        var toolbar = document.getElementById('baye-hd-toolbar');
        if (!toolbar || toolbar.getAttribute('data-hd-sys-bound')) {
            return;
        }
        toolbar.setAttribute('data-hd-sys-bound', '1');
        toolbar.addEventListener('click', function (event) {
            var node = event.target;
            while (node && node !== toolbar) {
                if (node.tagName === 'BUTTON' && node.getAttribute('data-hd-system-ui')) {
                    setMode(node.getAttribute('data-hd-system-ui'));
                    return;
                }
                node = node.parentNode;
            }
        });
        syncToolbar();
    }

    function setMode(value) {
        writeStorage(STORAGE_KEY, normalizeMode(value));
        if (getMode() === 'classic' && state.open) {
            closeUi({ silent: true });
        }
        applyChrome();
        syncToolbar();
        refresh();
    }

    var pollId = 0;

    function start() {
        bindUi();
        bindToolbar();
        applyChrome();
        if (!pollId) {
            pollId = setInterval(function () {
                if (!shouldShowHd()) {
                    if (state.open) {
                        closeUi({ silent: true });
                    }
                    return;
                }
                if (!playerKingId() || state.screen === 'insystem' || state.screen === 'saveload') {
                    refresh();
                } else if (state.open) {
                    refresh();
                }
            }, 400);
        }
        setTimeout(refresh, 350);
    }

    applyChrome();

    global.BayeHdSystemUi = {
        STORAGE_KEY: STORAGE_KEY,
        getMode: getMode,
        setMode: setMode,
        shouldShowHd: shouldShowHd,
        isOpen: function () { return state.open; },
        getScreen: function () { return state.screen; },
        openInsystem: function () {
            state.screen = 'insystem';
            state.open = true;
            render();
        },
        onEngineHook: onEngineHook,
        start: start,
        applyPcPage: start,
        debugSnapshot: function () {
            return {
                pref: getMode(),
                showHd: shouldShowHd(),
                open: state.open,
                screen: state.screen,
                idleIndex: state.idleIndex,
                lastHook: state.lastHook,
                kings: state.kings.map(function (k) { return k.name; }),
                saves: state.saves.map(function (s) { return s.key; }),
                playerKing: playerKingId(),
                haveBelong: citiesHaveBelong()
            };
        }
    };
})(window);
