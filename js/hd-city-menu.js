/**
 * HD 城池四项菜单表现壳（M0–M2）。
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
        probedCityKeys: []
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
        if (document.body) {
            document.body.classList.toggle('baye-hd-city-menu-on', show);
            document.body.classList.toggle('baye-hd-city-menu-lcd', show && state.showLcd);
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

    function pickIndex(target, thenEnter) {
        var keys = keysToIndex(target);
        if (thenEnter) {
            keys.push(VK.ENTER);
        }
        enqueueKeys(keys, 55);
    }

    function cityName(index) {
        try {
            if (window.baye && typeof baye.getCityName === 'function' && index >= 0) {
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

    function readCity(index) {
        var data = window.baye && baye.data;
        if (!data || !data.g_Cities || index < 0 || !data.g_Cities[index]) {
            return null;
        }
        return data.g_Cities[index];
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
    }

    function fillSubList(kind) {
        var list = el('hd-city-menu-sublist');
        if (!list) {
            return;
        }
        if (state.listKind === kind && list.children.length) {
            applyHighlight();
            return;
        }
        var items = SUBS[kind] || [];
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
        state.listKind = kind;
        applyHighlight();
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
            return;
        }
        var title = state.cityName || (state.cityIndex >= 0 ? '城' + (state.cityIndex + 1) : '城池');
        setText(el('hd-city-menu-title'), title);
        var sub = el('hd-city-menu-sub');
        var grid = el('hd-city-menu-root');
        var list = el('hd-city-menu-sublist');
        var status = el('hd-city-menu-status');
        var probe = el('hd-city-menu-probe');
        if (state.layer === 'root') {
            setText(sub, '城池指令 · 与引擎四项一致');
            if (grid) {
                grid.hidden = false;
            }
            if (list) {
                list.hidden = true;
            }
            if (status) {
                status.hidden = true;
            }
        } else if (state.layer === 'status') {
            setText(sub, '状况 · 只列出读到的 g_Cities 字段');
            if (grid) {
                grid.hidden = true;
            }
            if (list) {
                list.hidden = true;
            }
            if (status) {
                status.hidden = false;
            }
            renderStatus();
        } else {
            var items = SUBS[state.subKind] || [];
            var kindName = '';
            var r;
            for (r = 0; r < ROOTS.length; r++) {
                if (ROOTS[r].id === state.subKind) {
                    kindName = ROOTS[r].name;
                }
            }
            setText(sub, kindName + ' · 点选发方向键 + 确认，引擎执行');
            if (grid) {
                grid.hidden = true;
            }
            if (status) {
                status.hidden = true;
            }
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

    function openMenu(meta) {
        meta = meta || {};
        if (!shouldShowHd()) {
            return false;
        }
        if (meta.cityIndex != null && meta.cityIndex >= 0) {
            state.cityIndex = meta.cityIndex;
        }
        if (meta.cityName) {
            state.cityName = meta.cityName;
        } else if (!state.cityName) {
            state.cityName = cityName(state.cityIndex);
        }
        state.lastHook = meta.hook || state.lastHook;
        if (state.open) {
            applyHighlight();
            var probe = el('hd-city-menu-probe');
            if (probe) {
                setText(probe, 'hook=' + (state.lastHook || '—') + '  idleIndex=' +
                    (state.idleIndex == null ? '—' : state.idleIndex));
            }
            return true;
        }
        state.listKind = '';
        state.open = true;
        state.layer = 'root';
        state.subKind = '';
        state.showLcd = false;
        state.queue = [];
        state.cityName = state.cityName || cityName(state.cityIndex);
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
        if (!state.open) {
            applyDocAttr();
            return;
        }
        state.open = false;
        state.layer = 'root';
        state.queue = [];
        state.sending = false;
        render();
        if (!opts.silent && global.BayeHdOverworld && typeof BayeHdOverworld.leaveMenu === 'function') {
            BayeHdOverworld.leaveMenu('已回到 HD 大地图。');
        }
    }

    function back() {
        if (!state.open) {
            return;
        }
        if (state.layer !== 'root') {
            state.closingSub = true;
            state.layer = 'root';
            state.subKind = '';
            state.idleIndex = null;
            enqueueKeys([VK.EXIT], 60);
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
        pickIndex(index, true);
        if (root.id === 'zhuangkuang') {
            state.layer = 'status';
            state.subKind = root.id;
        } else {
            state.layer = 'sub';
            state.subKind = root.id;
            state.idleIndex = 0;
        }
        render();
    }

    function chooseSub(index) {
        pickIndex(index, true);
        /* 一层点选后引擎常进人物/数量/出征目标等 M3 LCD。露出对照，避免挡操作。 */
        state.showLcd = true;
        applyDocAttr();
        var lcdBtn = document.querySelector('[data-hd-menu-lcd]');
        if (lcdBtn) {
            lcdBtn.textContent = '隐藏经典 LCD';
        }
    }

    function onEngineHook(name, ctx) {
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
            if (!state.probed && keys.length) {
                console.log('[hd-city-menu] hook ctx', name, keys, ctx);
            }
        }
        if (!state.open) {
            return;
        }
        if (name === 'willCloseMenu') {
            if (state.closingSub) {
                state.closingSub = false;
                state.layer = 'root';
                state.subKind = '';
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
            if (!state.open || !shouldShowHd()) {
                return;
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
                idleIndex: state.idleIndex,
                idleKeys: state.idleKeys.slice(),
                lastHook: state.lastHook,
                showLcd: state.showLcd,
                probedCityKeys: state.probedCityKeys.slice()
            };
        }
    };
})(window);
