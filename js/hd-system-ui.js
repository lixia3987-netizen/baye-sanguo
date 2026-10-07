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
        probed: false,
        lastFuncMenuIdle: 0,
        recordMode: 0,
        recordSource: '',
        recordSeq: 0,
        inputToken: '',
        kingProtocolObserved: false,
        request: null,
        requestEpoch: 0,
        confirmedToken: '',
        exitedToken: '',
        retiredToken: '',
        hint: ''
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

    function playerKingId() {
        var data = engineData();
        if (!data) {
            return null;
        }
        var raw = readNumber(data, 'g_PlayerKing');
        /* 开局未选时词典原版是 0；0 在 getPersonNameByID 里也是 "-"。真开局靠 didOpenNewGame 关壳。 */
        if (raw === null || raw === 0 || raw === 0xff || raw === 255 || raw === 0xffff) {
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
        var name = '';
        try {
            if (window.baye && typeof baye.getPersonNameByID === 'function') {
                name = baye.getPersonNameByID(id) || '';
            }
        } catch (e) {}
        if (!name || name === '-' || name === String(id)) {
            try {
                if (window.baye && typeof baye.getPersonName === 'function' && id > 0) {
                    name = baye.getPersonName(id - 1) || name;
                }
            } catch (e) {}
        }
        if (!name || name === '-') {
            try {
                var data = engineData();
                var p = data && data.g_Persons && data.g_Persons[id - 1];
                if (p && typeof p.name === 'string' && p.name && p.name !== '-') {
                    name = p.name;
                }
            } catch (e) {}
        }
        return name && name !== '-' ? name : '';
    }

    function probeKings() {
        var data = engineData();
        var list = [];
        var seen = {};
        var i;
        try {
            if (window.baye && baye.hd && typeof baye.hd.kings === 'function') {
                var hd = baye.hd.kings();
                if (hd && hd.kings && hd.kings.length) {
                    for (i = 0; i < hd.kings.length; i++) {
                        var hk = hd.kings[i];
                        if (!hk) {
                            continue;
                        }
                        list.push({
                            id: hk.id + 1,
                            engineId: hk.id,
                            name: (hk.name && hk.name !== '-') ? hk.name : ('君主' + hk.id),
                            city: ''
                        });
                    }
                    if (list.length) {
                        syncKingHighlight(hd, list);
                        return list;
                    }
                }
            }
        } catch (e) {}
        if (data && data.g_Cities) {
            for (i = 0; i < data.g_Cities.length; i++) {
                var b = readNumber(data.g_Cities[i], 'Belong');
                if (!b || b === 0xff || b === 255 || seen[b]) {
                    continue;
                }
                seen[b] = true;
                var name = personNameById(b);
                if (!name) {
                    continue;
                }
                var cityName = '';
                try {
                    if (typeof baye.hdCityLimit === 'function' && i >= baye.hdCityLimit()) {
                        cityName = '';
                    } else {
                        cityName = baye.getCityName(i) || '';
                    }
                } catch (e) {}
                list.push({ id: b, name: name, city: cityName });
            }
        }
        if (list.length) {
            return list;
        }
        /* 城 Belong 未写入时：人物 Belong===自己 即为君主（demos.js 人物表）。 */
        if (data && data.g_Persons) {
            var n = data.g_Persons.length || 0;
            for (i = 0; i < n && i < 260; i++) {
                var p = data.g_Persons[i];
                var belong = readNumber(p, 'Belong');
                var level = readNumber(p, 'Level');
                if (belong !== i + 1) {
                    continue;
                }
                if (level !== null && level <= 0) {
                    continue;
                }
                var pname = '';
                try {
                    pname = baye.getPersonName(i) || '';
                } catch (e) {}
                if (!pname || pname === '-') {
                    continue;
                }
                list.push({ id: i + 1, name: pname, city: '' });
            }
        }
        if (list.length) {
            return list;
        }
        /* 再扫已挂到人物对象上的 name（demos/printPersons 会写）。 */
        if (data && data.g_Persons) {
            var n2 = data.g_Persons.length || 0;
            for (i = 0; i < n2 && i < 260; i++) {
                var p2 = data.g_Persons[i];
                var belong2 = readNumber(p2, 'Belong');
                if (belong2 !== i + 1) {
                    continue;
                }
                var n2name = (p2 && typeof p2.name === 'string') ? p2.name : '';
                if (!n2name || n2name === '-') {
                    continue;
                }
                list.push({ id: i + 1, name: n2name, city: '' });
            }
        }
        return list;
    }

    function syncKingHighlight(hd, list) {
        var rows = list || state.kings;
        var i;
        if (hd && hd.currentId != null && hd.currentId !== 0xffff && hd.currentId !== 65535) {
            for (i = 0; i < rows.length; i++) {
                if (rows[i].engineId === hd.currentId || rows[i].id === hd.currentId + 1) {
                    state.idleIndex = i;
                    return;
                }
            }
        }
        if (hd && hd.index != null && hd.index >= 0 && hd.index < rows.length) {
            state.idleIndex = hd.index;
        }
    }

    function probeSaves() {
        var list = [];
        var i, slot;
        try {
            if (global.BayeSaveStorage && typeof BayeSaveStorage.slots === 'function') {
                var slots = BayeSaveStorage.slots() || [];
                for (i = 0; i < 4; i++) {
                    slot = slots.filter(function (s) { return s && Number(s.slot) === i; })[0];
                    list.push(slot || { slot: i, status: 'empty', canLoad: false, bytes: 0 });
                }
                return list;
            }
        } catch (e) {}
        // An older runtime can still show the paired files, but cannot certify
        // them for loading. Selection requires the native record protocol.
        for (i = 0; i < 4; i++) {
            var first = readStorage('baye//data//sango' + (i * 2) + '.sav', '');
            var second = readStorage('baye//data//sango' + (i * 2 + 1) + '.sav', '');
            list.push({ slot: i, status: first || second ? 'invalid' : 'empty',
                canLoad: false, bytes: (first.length + second.length) / 2,
                error: first || second ? '请更新运行时后读取此存档。' : '' });
        }
        return list;
    }

    function liveRecord() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.record === 'function') {
                return baye.hd.record();
            }
            var data = engineData();
            if (data && data.g_hdRecordActive != null) {
                return { active: readNumber(data, 'g_hdRecordActive'), mode: readNumber(data, 'g_hdRecordMode'),
                    index: readNumber(data, 'g_hdRecordIndex'), count: readNumber(data, 'g_hdRecordCount'),
                    seq: readNumber(data, 'g_hdRecordSeq') };
            }
        } catch (e) {}
        return null;
    }

    function liveMenu() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.menuItems === 'function') {
                return baye.hd.menuItems();
            }
        } catch (e) {}
        return null;
    }

    function inputOwner() {
        if (fightActive()) { return null; }
        var record = liveRecord();
        if (record && Number(record.active) && Number(record.seq) &&
            ((Number(record.mode) === 1 && Number(record.count) === 3) ||
                (Number(record.mode) === 2 && Number(record.count) === 4)) &&
            Number(record.index) >= 0 && Number(record.index) < Number(record.count)) {
            return { type: 'record', seq: Number(record.seq), index: Number(record.index),
                count: Number(record.count), mode: Number(record.mode), screen: 'saveload' };
        }
        var menu = liveMenu();
        if (!menu || !Number(menu.active) || !Number(menu.seq)) { return null; }
        var screen = Number(menu.context) === 2 && Number(menu.kind) === 1 ? 'insystem'
            : Number(menu.context) === 4 && Number(menu.kind) === 1 ? 'title'
            : Number(menu.context) === 4 && Number(menu.kind) === 2 ? 'period'
            : Number(menu.context) === 4 && Number(menu.kind) === 3 ? 'king' : '';
        if (!screen) { return null; }
        var count = Number(menu.count), index = Number(menu.index);
        if (!(count > 0) || !(index >= 0 && index < count)) { return null; }
        return { type: 'menu', seq: Number(menu.seq), index: index, count: count,
            context: Number(menu.context), kind: Number(menu.kind), screen: screen };
    }

    function ownerToken(owner) {
        return owner.type + ':' + owner.seq + ':' + (owner.mode || owner.context + ':' + owner.kind);
    }

    function invalidateInput() {
        state.requestEpoch += 1;
        state.request = null;
        state.queue = [];
        state.sending = false;
    }

    function sameOwner(a, b) {
        return !!(a && b && ownerToken(a) === ownerToken(b));
    }

    function failRequest(text, owner) {
        state.request = null;
        state.retiredToken = ownerToken(owner);
        state.hint = text;
        render();
    }

    function canLoadSlot(index) {
        var slot = null;
        try {
            if (global.BayeSaveStorage && typeof BayeSaveStorage.inspectSlot === 'function') {
                slot = BayeSaveStorage.inspectSlot(index);
            }
        } catch (e) {}
        if (!slot) { slot = probeSaves()[index]; }
        state.saves[index] = slot || { slot: index, status: 'empty', canLoad: false };
        if (slot && slot.canLoad) { return true; }
        state.hint = slot && slot.error || '此槽没有可读取的完整存档。';
        return false;
    }

    function chooseNative(index, confirm, displayedToken) {
        var owner = inputOwner();
        if (!shouldShowHd() || !state.open || state.request || !owner || owner.screen !== state.screen ||
            !(index >= 0 && index < owner.count) || state.confirmedToken === ownerToken(owner) ||
            state.exitedToken === ownerToken(owner) || state.retiredToken === ownerToken(owner) ||
            (displayedToken != null && displayedToken !== ownerToken(owner))) { return false; }
        if (owner.type === 'record' && owner.mode === 2 && confirm && !canLoadSlot(index)) {
            render();
            return false;
        }
        state.hint = '';
        var epoch = state.requestEpoch;
        var now = Date.now();
        var request = { owner: owner, target: index, confirm: confirm, started: now,
            progressAt: now, waiting: false, expected: owner.index };
        state.request = request;
        function step() {
            if (epoch !== state.requestEpoch || state.request !== request || !shouldShowHd()) { return; }
            var current = inputOwner();
            if (!sameOwner(current, owner)) {
                state.request = null;
                refresh();
                return;
            }
            var now = Date.now();
            if (now - request.started > 60000) {
                failRequest('菜单选择等待过久。请切换经典界面检查，或返回后重试。', owner);
                return;
            }
            if (request.waiting) {
                if (current.index !== request.expected) {
                    if (now - request.progressAt > 5000) {
                        failRequest('引擎尚未确认菜单移动。请切换经典界面检查，或返回后重试。', owner);
                        return;
                    }
                    setTimeout(step, 40);
                    return;
                }
                // A slow but progressing native menu may need several seconds
                // per item. Only its actual ACK renews the next step's budget.
                request.progressAt = now;
            }
            request.waiting = false;
            state.idleIndex = current.index;
            if (current.index === index) {
                state.request = null;
                if (confirm) {
                    if (owner.type === 'record' && owner.mode === 2 && !canLoadSlot(index)) {
                        render();
                        return;
                    }
                    state.confirmedToken = ownerToken(owner);
                    engineSendKey(VK.ENTER);
                }
                refresh();
                return;
            }
            request.expected = current.index + (current.index > index ? -1 : 1);
            request.waiting = true;
            if (!engineSendKey(current.index > index ? VK.UP : VK.DOWN)) {
                failRequest('当前引擎输入不可用，请返回后重试。', owner);
                return;
            }
            render();
            setTimeout(step, 40);
        }
        step();
        render();
        return true;
    }

    function el(id) {
        return document.getElementById(id);
    }

    function setText(node, text) {
        if (node) {
            node.textContent = text;
        }
    }

    function cityMenuHoldExit() {
        return !!(global.BayeHdCityMenu &&
            typeof BayeHdCityMenu.holdExit === 'function' &&
            BayeHdCityMenu.holdExit());
    }

    function fightLive() {
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

    function engineSendKey(code) {
        if (fightLive()) {
            console.warn('[hd-system-ui] blocked key during fight', code);
            return false;
        }
        if (code === VK.EXIT && cityMenuHoldExit()) {
            console.warn('[hd-system-ui] blocked EXIT during BattleMake');
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

    function enqueueKeys(codes, gap) {
        if (fightLive()) {
            console.warn('[hd-system-ui] blocked queue during fight');
            return;
        }
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
        var epoch = state.requestEpoch;
        function next() {
            if (epoch !== state.requestEpoch || !shouldShowHd()) { return; }
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

    function liveMenuNames() {
        try {
            if (window.baye && baye.hd && typeof baye.hd.menuItems === 'function') {
                return (baye.hd.menuItems().names || []);
            }
        } catch (e) {}
        return [];
    }

    function fightActive() {
        try {
            if (global.BayeHdBattle && BayeHdBattle.isOpen && BayeHdBattle.isOpen()) {
                return true;
            }
            if (window.baye && baye.hd && typeof baye.hd.fight === 'function') {
                var f = baye.hd.fight();
                return !!(f && f.active && !f.over);
            }
        } catch (e) {}
        return false;
    }

    function inferScreen() {
        if (fightActive()) {
            return null;
        }
        var owner = inputOwner();
        if (owner) { return owner.screen; }
        if (state.kingProtocolObserved) { return null; }
        // A record selector is an actual native wait, not a sticky screen set
        // optimistically by a preceding click. Save and its cancellation return
        // to the map; title loading returns to the title or the loaded map.
        if (state.screen === 'saveload' || state.screen === 'insystem') { return null; }
        try {
            var march = window.baye && baye.hd && typeof baye.hd.march === 'function' && baye.hd.march();
            if (march && Number(march.pick) && !Number(march.battlePick)) { return null; }
        } catch (e) {}
        var king = playerKingId();
        var belong = citiesHaveBelong();
        if (king != null && belong) {
            return null;
        }
        if (belong && king == null) {
            return 'king';
        }
        if (state.screen === 'king' || state.screen === 'period') {
            return state.screen;
        }
        return 'title';
    }

    function applyChrome() {
        var show = state.open && shouldShowHd();
        document.documentElement.setAttribute('data-baye-system-ui', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-system-ui-pref', getMode());
        if (document.body) {
            var kingEmpty = show && state.screen === 'king' && !state.kings.length;
            var hasKings = show && state.screen === 'king' && state.kings.length > 0;
            if (hasKings) {
                state.showLcd = false;
            }
            document.body.classList.toggle('baye-hd-system-ui-on', show);
            document.body.classList.toggle('baye-hd-system-ui-lcd', show && state.showLcd && !hasKings);
            document.body.classList.toggle('baye-hd-system-ui-king-empty', kingEmpty);
            document.body.classList.toggle('baye-hd-system-ui-has-kings', hasKings);
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
            var count = state.recordMode === 1 ? 3 : 4;
            return state.saves.slice(0, count).map(function (s) {
                var label = '存档 ' + (Number(s.slot) + 1) + ' · ';
                if (s.status === 'empty') { return label + '空'; }
                if (s.status === 'wrong-lib') { return label + '属于其他版本'; }
                if (s.status === 'incomplete') { return label + '文件不完整'; }
                if (!s.canLoad) { return label + '无法读取'; }
                var data = engineData();
                var currentPeriod = data && readNumber(data, 'g_PIdx');
                var samePeriod = s.period == null || Number(s.period) === currentPeriod;
                var name = s.king != null && samePeriod ? personNameById(Number(s.king) + 1) : '';
                var period = PERIODS[Number(s.period) - 1] || '';
                return label + (name || period || '已有进度') + (s.year != null ? ' · ' + s.year + ' 年' : '');
            });
        }
        return TITLE;
    }

    function screenTitle() {
        return {
            title: '三国霸业',
            period: '选择时期',
            king: '选择君主',
            saveload: state.recordMode === 1 ? '存储进度' : '重返沙场',
            insystem: '系统指令'
        }[state.screen] || '系统';
    }

    function screenHint() {
        if (state.hint) { return state.hint; }
        if (state.screen === 'king') {
            return state.kings.length
                ? '请选择一个势力开始游戏。'
                : '请在右侧经典画面选择君主：方向键移动，回车确认。';
        }
        if (state.screen === 'saveload') {
            return state.recordMode === 1
                ? '选择一个存档位置保存当前进度。已有进度会被替换。'
                : '选择完整且属于当前游戏版本的存档。';
        }
        if (state.screen === 'period') {
            return '选择战役开始的历史时期。';
        }
        if (state.screen === 'insystem') {
            return '请选择下一步指令。';
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
                : (state.screen === 'king'
                    ? '还没有可读的君主名。右侧是引擎势力形势图：方向键移动，回车选定。不编造名单。'
                    : '暂无探测项。');
            list.appendChild(empty);
            return;
        }
        for (i = 0; i < items.length; i++) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'hd-system-ui-item';
            btn.setAttribute('data-hd-sys', String(i));
            var owner = inputOwner();
            if (owner) { btn.setAttribute('data-hd-sys-owner', ownerToken(owner)); }
            var pending = !!state.request || !!(owner &&
                (state.confirmedToken === ownerToken(owner) || state.exitedToken === ownerToken(owner) ||
                    state.retiredToken === ownerToken(owner)));
            var unavailable = state.screen === 'saveload' && state.recordMode === 2 &&
                (!state.saves[i] || !state.saves[i].canLoad);
            btn.disabled = pending || unavailable || (!owner &&
                (state.screen !== 'king' || state.kingProtocolObserved));
            if (unavailable) { btn.title = state.saves[i] && state.saves[i].error || '此槽没有可读取的完整存档。'; }
            if (state.idleIndex === i) {
                btn.classList.add('is-idle');
            }
            btn.textContent = items[i];
            list.appendChild(btn);
        }
        var idle = list.querySelector('.hd-system-ui-item.is-idle');
        if (idle && idle.scrollIntoView) {
            try {
                idle.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (e) {
                idle.scrollIntoView(false);
            }
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
        if (probe) { probe.hidden = !global.BAYE_HD_DEBUG; }
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
            var nextKings = probeKings();
            if (nextKings.length || !state.kings.length) {
                state.kings = nextKings;
            }
            if (state.kings.length) {
                state.showLcd = false;
            }
        }
        var owner = inputOwner();
        if (owner && owner.screen === 'king') { state.kingProtocolObserved = true; }
        if (owner && state.inputToken !== ownerToken(owner)) {
            invalidateInput();
            state.hint = '';
            state.inputToken = ownerToken(owner);
        }
        if (next === 'saveload') {
            var record = liveRecord();
            if (!record || !Number(record.active)) { return; }
            if (state.recordSeq !== Number(record.seq)) {
                if (state.screen !== 'saveload') {
                    state.recordSource = Number(record.mode) === 1 ? 'insystem' : 'title';
                }
                if (Number(record.mode) === 1 && global.BayeSaveStorage && typeof BayeSaveStorage.lastError === 'function') {
                    var saveError = BayeSaveStorage.lastError();
                    if (saveError && saveError.message) { state.hint = String(saveError.message); }
                }
            }
            state.recordSeq = Number(record.seq);
            state.recordMode = Number(record.mode);
            state.saves = probeSaves();
        }
        if (owner) { state.idleIndex = owner.index; }
        var wasOpen = state.open;
        state.screen = next;
        state.open = true;
        if (!wasOpen) {
            console.log('[hd-system-ui] open', next);
        }
        render();
    }

    function scheduleKingRefresh() {
        [120, 280, 560, 1100, 2000, 3200].forEach(function (ms) {
            setTimeout(function () {
                if (!state.open || state.screen !== 'king') {
                    return;
                }
                var next = probeKings();
                var prevSig = state.kings.map(function (k) { return k.id + ':' + k.name; }).join(',');
                var nextSig = next.map(function (k) { return k.id + ':' + k.name; }).join(',');
                state.kings = next.length ? next : state.kings;
                if (state.kings.length) {
                    state.showLcd = false;
                }
                try {
                    if (window.baye && baye.hd) {
                        syncKingHighlight(baye.hd.kings(), state.kings);
                    }
                } catch (e) {}
                if (nextSig !== prevSig || next.length) {
                    render();
                }
            }, ms);
        });
    }

    function closeUi(opts) {
        opts = opts || {};
        invalidateInput();
        state.open = false;
        applyChrome();
        if (!opts.silent) {
            console.log('[hd-system-ui] close');
        }
    }

    function choose(index, displayedToken) {
        if (!state.open || !shouldShowHd()) { return false; }
        var owner = inputOwner();
        if (state.screen !== 'king' || owner) {
            return chooseNative(index, true, displayedToken);
        }
        if (state.kingProtocolObserved || displayedToken) { return false; }
        pickIndex(index, true);
        render();
        return true;
    }

    function back() {
        if (fightLive()) {
            console.warn('[hd-system-ui] blocked back EXIT during fight');
            return;
        }
        if (cityMenuHoldExit()) {
            console.warn('[hd-system-ui] blocked back EXIT during BattleMake');
            return;
        }
        var owner = inputOwner();
        if (owner) {
            var token = ownerToken(owner);
            if (state.exitedToken === token) { return false; }
            invalidateInput();
            state.exitedToken = token;
            state.hint = '';
            engineSendKey(VK.EXIT);
            refresh();
            return true;
        }
        if (state.screen === 'saveload' || state.screen === 'insystem' ||
            state.screen === 'king' && state.kingProtocolObserved) { return false; }
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
            } else if (name === 'chooseActor' || name === 'willChooseActor' || name === 'choosingActorUpdate') {
                state.screen = 'king';
                state.kings = probeKings();
                state.showLcd = !state.kings.length;
                scheduleKingRefresh();
            } else if (name === 'mainSystemMenu') {
                state.screen = 'insystem';
            }
        } else {
            state.lastHook = name || state.lastHook;
        }
        if (ctx && ctx.index != null && isFinite(Number(ctx.index))) {
            state.idleIndex = Number(ctx.index);
        }
        if (name === 'onMenuIdle') {
            var idleNames = liveMenuNames();
            if (idleNames[0] === '策略结束' && idleNames.indexOf('存储进度') >= 0 &&
                idleNames.indexOf('结束游戏') >= 0) {
                state.lastFuncMenuIdle = Date.now();
            }
        }
        if (name === 'chooseGameEntry') {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.resetForNewGame === 'function') {
                BayeHdCityMenu.resetForNewGame('chooseGameEntry');
            }
        }
        if (name === 'didOpenNewGame' || name === 'didLoadGame') {
            if (global.BayeHdCityMenu && typeof BayeHdCityMenu.resetForNewGame === 'function') {
                BayeHdCityMenu.resetForNewGame(name);
            }
            if (state.screen === 'king') {
                state.kings = probeKings();
                if (state.kings.length) {
                    state.showLcd = false;
                    render();
                }
            }
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
        var pressedOwner = '';
        root.addEventListener('pointerdown', function (ev) {
            pressedOwner = '';
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && t.getAttribute('data-hd-sys') != null) {
                    pressedOwner = t.getAttribute('data-hd-sys-owner') || '';
                    return;
                }
                t = t.parentNode;
            }
        });
        root.addEventListener('click', function (ev) {
            if (ev.target === root) {
                return;
            }
            var t = ev.target;
            while (t && t !== root) {
                if (t.getAttribute && t.getAttribute('data-hd-sys') != null) {
                    ev.preventDefault();
                    var token = pressedOwner || t.getAttribute('data-hd-sys-owner') || '';
                    pressedOwner = '';
                    if (!t.disabled) { choose(Number(t.getAttribute('data-hd-sys')), token); }
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
            if (global.BayeHdSpe && typeof BayeHdSpe.isOpen === 'function' && BayeHdSpe.isOpen()) {
                return;
            }
            if (!state.open || !shouldShowHd()) {
                return;
            }
            if (typeof global.bayeInputIgnored === 'function' && bayeInputIgnored(e)) { return; }
            var codes = { 13: VK.ENTER, 27: VK.EXIT, 32: VK.EXIT, 37: VK.LEFT,
                38: VK.UP, 39: VK.RIGHT, 40: VK.DOWN };
            var code = codes[e.keyCode];
            if (code == null) { return; }
            var owner = inputOwner();
            if (!owner && state.screen !== 'saveload' && state.screen !== 'insystem' &&
                !(state.screen === 'king' && state.kingProtocolObserved)) {
                if (code === VK.EXIT) { e.preventDefault(); back(); }
                return;
            }
            if (typeof global.bayeConsumeKeyEvent === 'function') { bayeConsumeKeyEvent(e); }
            else { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) { e.stopImmediatePropagation(); } }
            if (e.repeat) { return; }
            if (code === VK.EXIT) { back(); return; }
            if (!owner || state.request) { return; }
            if (code === VK.ENTER) { chooseNative(owner.index, true); return; }
            var target = (owner.index + (code === VK.UP || code === VK.LEFT ? -1 : 1) + owner.count) % owner.count;
            chooseNative(target, false);
        }, true);
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
        invalidateInput();
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
                if (!hdReady()) {
                    return;
                }
                if (!shouldShowHd()) {
                    if (state.open) {
                        closeUi({ silent: true });
                    }
                    return;
                }
                if (inputOwner() || !playerKingId() || state.screen === 'insystem' || state.screen === 'saveload') {
                    refresh();
                } else if (inferScreen() === 'insystem') {
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
        close: closeUi,
        getScreen: function () { return state.screen; },
        openInsystem: function () {
            var owner = inputOwner();
            if (!owner || owner.screen !== 'insystem') { return false; }
            state.screen = 'insystem';
            state.open = true;
            render();
            return true;
        },
        confirmStrategyEnd: function () {
            if (liveMenuNames()[0] !== '策略结束') {
                return false;
            }
            if (fightActive()) {
                return false;
            }
            var handing = !!(global.BayeHdCityMenu &&
                typeof BayeHdCityMenu.isHandoff === 'function' &&
                BayeHdCityMenu.isHandoff());
            if (!handing && global.BayeHdCityMenu && typeof BayeHdCityMenu.isOpen === 'function' &&
                BayeHdCityMenu.isOpen()) {
                return false;
            }
            var pick = 0;
            try {
                if (window.baye && baye.hd && typeof baye.hd.march === 'function') {
                    pick = baye.hd.march().pick;
                }
            } catch (e) {}
            if (pick) {
                return false;
            }
            var handoffAt = 0;
            try {
                if (global.BayeHdCityMenu && typeof BayeHdCityMenu.handoffAt === 'function') {
                    handoffAt = Number(BayeHdCityMenu.handoffAt()) || 0;
                }
            } catch (e) {}
            if (handoffAt && (state.lastFuncMenuIdle || 0) < handoffAt) {
                return false;
            }
            /* 不要 prepareNewFight：会清掉刚亮起的 g_hdFightActive。 */
            var owner = inputOwner();
            if (!owner || owner.screen !== 'insystem') { return false; }
            state.screen = 'insystem';
            state.open = true;
            return chooseNative(0, true);
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
                saves: state.saves.map(function (s) { return { slot: s.slot, status: s.status, canLoad: !!s.canLoad }; }),
                recordMode: state.recordMode,
                recordSource: state.recordSource,
                recordSeq: state.recordSeq,
                input: inputOwner(),
                pending: !!state.request,
                hint: state.hint,
                playerKing: playerKingId(),
                haveBelong: citiesHaveBelong()
            };
        }
    };
})(window);
