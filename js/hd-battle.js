/**
 * HD battle renderer and manual input adapter. The engine owns all game rules.
 * Rendering sends no inputs. A user request delivers one key at a time and
 * advances only after a real snapshot acknowledges the preceding key.
 */
(function (global) {
    var STORAGE_KEY = 'baye/battleMode';
    var OVERWORLD_KEY = 'baye/overworldMode';
    var DESIGN_W = 1920, DESIGN_H = 1080;
    var HD_BATTLE_VER = '20261007d';
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, HELP: 0x26, ENTER: 0x27, EXIT: 0x28, SEARCH: 0x33 };
    var INPUT = { BUSY: 0, PICK: 1, MOVE: 2, ACTION: 3, SKILL: 4, AIM: 5, SYSTEM: 6, RETREAT: 7, SETTINGS: 8, HELP: 9, VIEW: 10 };
    var state = {
        open: false, preview: false, bound: false, showLcd: false, loopId: 0,
        lastHook: '', lastHookAt: 0, readDepth: 0, refreshing: false,
        readingEngine: false, samplingFight: false, probed: false,
        units: [], tiles: [], focus: { x: null, y: null },
        mapW: 0, mapH: 0, viewOx: 0, viewOy: 0, viewW: 0, viewH: 0, tileW: 0,
        menuKind: '', menuTitle: '', menuNames: [], menuIndex: 0,
        resultCode: 0, resultText: '', resultDismissed: false,
        fightTip: '', tipDismissed: '', lastRefreshStack: '',
        transaction: null, lastRequest: null, lastCommit: null, sysMenuHooked: false
    };
    var sysMenuBinding = null, modeEpoch = 0, pollId = 0, commandTimer = 0;

    function el(id) { return document.getElementById(id); }
    function readStorage(key, fallback) {
        try { return global.localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
    }
    function writeStorage(key, value) {
        try { global.localStorage.setItem(key, String(value)); } catch (e) {}
    }
    function normalizeMode(value) { return value === 'hd' || value === 'classic' ? value : 'auto'; }
    function getMode() { return normalizeMode(readStorage(STORAGE_KEY, 'auto')); }
    function shouldShowHd() {
        var mode = getMode();
        if (mode !== 'auto') { return mode === 'hd'; }
        try {
            if (global.BayeHdOverworld && typeof BayeHdOverworld.getMode === 'function') {
                return BayeHdOverworld.getMode() === 'hd-map';
            }
        } catch (e) {}
        return readStorage(OVERWORLD_KEY, 'classic') === 'hd-map';
    }
    function readNumber(obj, name) {
        if (!obj || state.readDepth > 8) { return null; }
        state.readDepth += 1;
        try {
            var value = obj[name];
            if (value == null) { return null; }
            if (typeof value === 'object' && 'value' in value) { value = value.value; }
            value = Number(value);
            return isFinite(value) ? value : null;
        } catch (e) { return null; }
        finally { state.readDepth -= 1; }
    }
    function listProps(obj) {
        if (!obj) { return []; }
        return obj._baye_properties ? obj._baye_properties.slice() : Object.keys(obj);
    }
    function hdReady() {
        try { return !!(global.baye && baye.hd && baye.hd.ready && baye.hd.ready()); }
        catch (e) { return false; }
    }
    function engineData() {
        if (!hdReady()) { return null; }
        return typeof baye.ensureData === 'function' ? baye.ensureData() : baye.data;
    }
    function readFight() {
        try { return hdReady() && baye.hd.fight ? baye.hd.fight() : null; } catch (e) { return null; }
    }
    function readMenuItems() {
        try { return hdReady() && baye.hd.menuItems ? baye.hd.menuItems() : null; } catch (e) { return null; }
    }
    function fightStrictActive() {
        var fight = readFight();
        return !!(shouldShowHd() && fight && fight.active && !fight.over);
    }
    function fightArrayCount() {
        var data = engineData(), arr = data && data.g_FgtParam && data.g_FgtParam.GenArray;
        var count = 0;
        for (var i = 0; arr && i < 20; i += 1) {
            var id = readNumber(arr, i);
            if (id && id < 0xfffe) { count += 1; }
        }
        return count;
    }
    function readRealm() {
        try { return hdReady() && baye.hd.realm ? baye.hd.realm() : null; } catch (e) { return null; }
    }
    function peekPersonArms(id) {
        var data = engineData();
        return id && data && data.g_Persons ? readNumber(data.g_Persons[id - 1], 'Arms') : null;
    }
    function unitAt(x, y) {
        for (var i = 0; i < state.units.length; i += 1) {
            var unit = state.units[i];
            if (unit.x === x && unit.y === y && unit.state !== 8) { return unit; }
        }
        return null;
    }
    function selectable(unit) {
        return !!(unit && unit.side === 'player' && unit.active === 0 &&
            unit.state !== 8 && unit.state !== 1 && unit.state !== 6);
    }
    function engineFocusTile() {
        var data = engineData(), x = readNumber(data, 'g_FoucsX'), y = readNumber(data, 'g_FoucsY');
        return x == null || y == null ? null : { x: x, y: y };
    }
    function canMoveTo(x, y) {
        var data = engineData(), path = data && data.g_FightPath;
        if (!path) { return null; }
        var sx = readNumber(data, 'g_PathSX'), sy = readNumber(data, 'g_PathSY');
        var ux = readNumber(data, 'g_PUseSX'), uy = readNumber(data, 'g_PUseSY');
        if (sx == null || sy == null || ux == null || uy == null) { return null; }
        var px = x - sx + ux, py = y - sy + uy;
        if (px < 0 || py < 0 || px >= 15 || py >= 15) { return false; }
        var value = readNumber(path, py * 15 + px);
        return value != null && value <= 0x80;
    }
    function inAtkRng(x, y) {
        var data = engineData(), rng = data && data.g_FgtAtkRng;
        var size = readNumber(rng, 0), sx = readNumber(rng, 1), sy = readNumber(rng, 2);
        if (!size || sx == null || sy == null) { return false; }
        // C stores both range origins and coordinate differences as U8.
        var dx = (x - sx) & 0xff, dy = (y - sy) & 0xff;
        return dx >= 0 && dy >= 0 && dx < size && dy < size &&
            readNumber(rng, 3 + dx + dy * size) === 1;
    }
    function nativeReportWaiting() {
        try {
            if (global.baye && baye.hd && typeof baye.hd.report === 'function') {
                return Number(baye.hd.report().active) === 1;
            }
            return Number(readNumber(engineData(), 'g_hdReportActive')) === 1;
        } catch (e) { return false; }
    }
    function inputSnapshot() {
        var fight = readFight(), menu = readMenuItems();
        var kind = fight && readNumber(fight, 'inputKind'), seq = fight && readNumber(fight, 'inputSeq');
        return {
            fight: fight, menu: menu, kind: kind, seq: seq,
            actor: fight && readNumber(fight, 'actorIndex'), focus: engineFocusTile(),
            ready: !!(shouldShowHd() && !nativeReportWaiting() && fight && fight.active && !fight.over &&
                kind >= INPUT.PICK && kind <= INPUT.VIEW && seq != null && seq > 0)
        };
    }
    function isMenuKind(kind) {
        return kind === INPUT.ACTION || kind === INPUT.SKILL || kind === INPUT.SYSTEM ||
            kind === INPUT.RETREAT || kind === INPUT.SETTINGS;
    }
    function menuSnapshot(snap) {
        var menu = snap.menu;
        if (!snap.ready || !isMenuKind(snap.kind) || !menu || !menu.active ||
            Number(menu.context) !== 3 || Number(menu.kind) !== snap.kind || !menu.names || !menu.names.length) { return null; }
        var index = readNumber(menu, 'index');
        if (index == null || index < 0 || index >= menu.names.length) { return null; }
        var kinds = { 3: 'act', 4: 'skill', 6: 'sys', 7: 'confirm', 8: 'settings' };
        var titles = { 3: '将领行动', 4: '计谋', 6: '战场系统', 7: '确认撤退', 8: '战场设置' };
        return { kind: kinds[snap.kind], title: titles[snap.kind], names: menu.names.slice(),
            index: index, seq: readNumber(menu, 'seq'), inputSeq: snap.seq };
    }
    function legalEnter(tile, unit, fight) {
        if (!fight || !fight.active || fight.over || !Number(fight.inputSeq)) { return false; }
        var kind = Number(fight.inputKind);
        if (kind === INPUT.PICK) { return selectable(unit); }
        if (kind === INPUT.MOVE) { return canMoveTo(tile.x, tile.y) === true; }
        if (kind === INPUT.AIM) {
            if (!unit || !inAtkRng(tile.x, tile.y)) { return false; }
            // Skills can target friendly units. C validates skill-specific
            // side, terrain and MP rules after one user confirmation.
            return Number(fight.aimType) === 1 || unit.side === 'enemy';
        }
        return false;
    }
    function rawSendKey(code) {
        if (typeof global.sendKey === 'function') { global.sendKey(code); return true; }
        if (global.baye && typeof baye.sendKey === 'function') { baye.sendKey(code); return true; }
        return false;
    }
    function finishRequest(reason) {
        var transaction = state.transaction;
        if (transaction) { state.lastRequest = { type: transaction.type, inputSeq: transaction.seq, reason: reason || 'acknowledged' }; }
        state.transaction = null;
        if (commandTimer) { global.clearTimeout(commandTimer); commandTimer = 0; }
    }
    function invalidateHdWork() {
        modeEpoch += 1;
        finishRequest('scene-changed');
        if (state.loopId) { global.cancelAnimationFrame(state.loopId); state.loopId = 0; }
    }
    function scheduleCommand() {
        if (commandTimer || !state.transaction) { return; }
        var epoch = modeEpoch;
        commandTimer = global.setTimeout(function () {
            commandTimer = 0;
            if (epoch !== modeEpoch || !shouldShowHd()) { return; }
            advanceRequest();
        }, 16);
    }
    function reject(reason, text) {
        if (text) { state.fightTip = text; applyChrome(); }
        return { ok: false, reason: reason };
    }
    function sameInput(transaction, snap) {
        if (!snap.ready || transaction.epoch !== modeEpoch || transaction.seq !== snap.seq ||
            transaction.kind !== snap.kind || transaction.actor !== snap.actor) { return false; }
        if (transaction.menuSeq != null) {
            var menu = menuSnapshot(snap);
            return !!(menu && menu.seq === transaction.menuSeq && menu.names.join('\u0000') === transaction.menuSignature);
        }
        return true;
    }
    function sendRequestKey(transaction, code, expected) {
        // Timers poll acknowledgements only; they never invent or retry an action.
        if (state.transaction !== transaction || !sameInput(transaction, inputSnapshot())) {
            finishRequest('input-changed'); return;
        }
        transaction.expected = expected || null;
        transaction.sentAt = Date.now();
        if (code === VK.ENTER || code === VK.EXIT || code === VK.HELP || code === VK.SEARCH) {
            transaction.committed = true;
            state.lastCommit = { epoch: modeEpoch, seq: transaction.seq };
        }
        if (transaction.kind === INPUT.VIEW) { transaction.committed = true; }
        if (!rawSendKey(code)) { finishRequest('input-unavailable'); return; }
        scheduleCommand();
    }
    function advanceRequest() {
        var transaction = state.transaction;
        if (!transaction) { return; }
        var snap = inputSnapshot();
        if (!sameInput(transaction, snap)) { finishRequest('input-changed'); return; }
        if (transaction.sentAt && Date.now() - transaction.sentAt > 5000) {
            finishRequest('no-acknowledgement');
            state.fightTip = '引擎尚未响应，请等待或切换经典画面查看。';
            applyChrome(); return;
        }
        if (transaction.committed) { scheduleCommand(); return; }
        if (transaction.expected) {
            var acknowledged = transaction.type === 'menu' || transaction.expected.index != null
                ? snap.menu && Number(snap.menu.index) === transaction.expected.index
                : snap.focus && snap.focus.x === transaction.expected.x && snap.focus.y === transaction.expected.y;
            if (!acknowledged) { scheduleCommand(); return; }
            transaction.expected = null; transaction.sentAt = 0;
            if (transaction.type === 'key') { finishRequest('acknowledged'); return; }
        }
        if (transaction.type === 'menu') {
            var menu = menuSnapshot(snap);
            if (!menu || menu.seq !== transaction.menuSeq || menu.names.join('\u0000') !== transaction.menuSignature) {
                finishRequest('menu-changed'); return;
            }
            if (menu.index === transaction.target) { sendRequestKey(transaction, VK.ENTER); return; }
            var direction = menu.index < transaction.target ? VK.DOWN : VK.UP;
            sendRequestKey(transaction, direction, { index: menu.index + (direction === VK.DOWN ? 1 : -1) }); return;
        }
        if (transaction.type === 'tile') {
            if (!snap.focus) { finishRequest('focus-unavailable'); return; }
            if (snap.focus.x === transaction.x && snap.focus.y === transaction.y) {
                refresh();
                if (!legalEnter({ x: transaction.x, y: transaction.y }, unitAt(transaction.x, transaction.y), snap.fight)) {
                    finishRequest('target-changed'); return;
                }
                sendRequestKey(transaction, VK.ENTER); return;
            }
            var x = snap.focus.x, y = snap.focus.y, code;
            if (x !== transaction.x) { code = x < transaction.x ? VK.RIGHT : VK.LEFT; x += x < transaction.x ? 1 : -1; }
            else { code = y < transaction.y ? VK.DOWN : VK.UP; y += y < transaction.y ? 1 : -1; }
            sendRequestKey(transaction, code, { x: x, y: y }); return;
        }
        var expected = null;
        if (transaction.code !== VK.ENTER && transaction.code !== VK.EXIT &&
            transaction.code !== VK.HELP && transaction.code !== VK.SEARCH && transaction.kind !== INPUT.VIEW) {
            if (isMenuKind(snap.kind)) {
                var keyMenu = menuSnapshot(snap);
                if (!keyMenu) { finishRequest('menu-unavailable'); return; }
                if (transaction.code !== VK.UP && transaction.code !== VK.DOWN) { finishRequest('unsupported-menu-key'); return; }
                expected = { index: (keyMenu.index + keyMenu.names.length + (transaction.code === VK.DOWN ? 1 : -1)) % keyMenu.names.length };
                if (expected.index === keyMenu.index) { finishRequest('unchanged'); return; }
            } else {
                if (!snap.focus) { finishRequest('focus-unavailable'); return; }
                expected = { x: snap.focus.x, y: snap.focus.y };
                if (transaction.code === VK.UP) { expected.y = Math.max(0, expected.y - 1); }
                if (transaction.code === VK.DOWN) { expected.y = Math.min(state.mapH - 1, expected.y + 1); }
                if (transaction.code === VK.LEFT) { expected.x = Math.max(0, expected.x - 1); }
                if (transaction.code === VK.RIGHT) { expected.x = Math.min(state.mapW - 1, expected.x + 1); }
                if (expected.x === snap.focus.x && expected.y === snap.focus.y) { finishRequest('unchanged'); return; }
            }
        }
        sendRequestKey(transaction, transaction.code, expected);
    }
    function beginRequest(type, options, snap) {
        if (state.transaction) { return reject('pending-input', '请等待当前操作完成。'); }
        if (!snap.ready) { return reject('engine-busy', '正在处理战场行动，请稍候。'); }
        if (state.lastCommit && state.lastCommit.epoch === modeEpoch && state.lastCommit.seq === snap.seq) {
            return reject('awaiting-command', '请等待引擎确认当前操作。');
        }
        var transaction = { type: type, epoch: modeEpoch, seq: snap.seq, kind: snap.kind,
            actor: snap.actor, committed: false, expected: null, sentAt: 0 };
        Object.keys(options || {}).forEach(function (key) { transaction[key] = options[key]; });
        if (isMenuKind(snap.kind)) {
            var menu = menuSnapshot(snap);
            if (!menu) { return reject('menu-unavailable'); }
            transaction.menuSeq = menu.seq;
            transaction.menuSignature = menu.names.join('\u0000');
        }
        state.transaction = transaction; state.fightTip = '';
        advanceRequest(); renderFightMenu();
        return { ok: true, kind: snap.kind, inputSeq: snap.seq };
    }
    function clickBattleTile(x, y) {
        var snap = inputSnapshot();
        if (!snap.ready || isMenuKind(snap.kind)) { return reject('not-map-input'); }
        refresh(); x = Number(x); y = Number(y);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= state.mapW || y >= state.mapH) { return reject('outside-map'); }
        if (!legalEnter({ x: x, y: y }, unitAt(x, y), snap.fight)) {
            return reject('illegal-target', snap.kind === INPUT.PICK ? '请选择尚未行动的己方将领。' :
                (snap.kind === INPUT.MOVE ? '请选择移动范围内的格子。' : '请选择射程内的有效目标。'));
        }
        return beginRequest('tile', { x: x, y: y }, snap);
    }
    function pickFightMenu(index) {
        var snap = inputSnapshot(), info = menuSnapshot(snap);
        index = Number(index);
        if (!info || !Number.isInteger(index) || index < 0 || index >= info.names.length) { return reject('no-menu-item'); }
        return beginRequest('menu', { target: index, menuSeq: info.seq, menuSignature: info.names.join('\u0000') }, snap);
    }
    function pickFightMenuName(name) {
        var info = menuSnapshot(inputSnapshot());
        if (!info) { return reject('no-menu'); }
        var index = info.names.indexOf(name);
        return index < 0 ? reject('no-item') : pickFightMenu(index);
    }
    function cancelInput() {
        var snap = inputSnapshot();
        if (!snap.ready) { finishRequest('cancelled'); return reject('engine-busy'); }
        if (state.transaction && state.transaction.committed) { return reject('awaiting-command'); }
        // PICK's EXIT opens the system menu; cancel must not do that implicitly.
        if (snap.kind === INPUT.PICK) { finishRequest('cancelled'); return { ok: true, reason: 'selection-cleared' }; }
        finishRequest('cancelled'); return beginRequest('key', { code: VK.EXIT }, snap);
    }
    function toggleSystemMenu() {
        var snap = inputSnapshot();
        if (snap.kind === INPUT.SYSTEM) { return cancelInput(); }
        if (!snap.ready || snap.kind !== INPUT.PICK) { return reject('not-picking', '请先返回选将状态，再打开系统菜单。'); }
        return beginRequest('key', { code: VK.EXIT }, snap);
    }
    function dismissFightTip() {
        var fight = readFight(); state.tipDismissed = fight && fight.tip ? String(fight.tip) : '';
        state.fightTip = ''; applyChrome();
    }
    function returnFromHelp() {
        var snap = inputSnapshot();
        if (!snap.ready || (snap.kind !== INPUT.HELP && snap.kind !== INPUT.VIEW)) { return reject('not-help-input'); }
        return beginRequest('key', { code: VK.EXIT }, snap);
    }
    function handleKey(event) {
        if (global.BayeHdDialog && typeof BayeHdDialog.isBlockingKeyboard === 'function' &&
            BayeHdDialog.isBlockingKeyboard()) { return false; }
        if (!state.open || state.preview || !shouldShowHd()) { return false; }
        if (typeof global.bayeInputIgnored === 'function' && global.bayeInputIgnored(event)) { return false; }
        var legacyKeys = { 13: 'Enter', 27: 'Escape', 32: ' ', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 72: 'h', 70: 'f', 83: 's' };
        var key = event.key || legacyKeys[event.keyCode] ||
            (event.keyCode >= 48 && event.keyCode <= 57 ? String(event.keyCode - 48) : '');
        var keys = { ArrowUp: VK.UP, ArrowDown: VK.DOWN, ArrowLeft: VK.LEFT, ArrowRight: VK.RIGHT,
            Enter: VK.ENTER, Escape: VK.EXIT, ' ': VK.EXIT, Spacebar: VK.EXIT,
            h: VK.HELP, H: VK.HELP, f: VK.SEARCH, F: VK.SEARCH, s: VK.SEARCH, S: VK.SEARCH };
        var code = keys[key], digit = /^[0-9]$/.test(key);
        // The classic LCD handler maps physical keyCodes, even when Shift or
        // another keyboard layout changes event.key. Own those mappings too.
        if (code == null && !digit) {
            var physical = legacyKeys[event.keyCode];
            code = keys[physical];
            digit = event.keyCode >= 48 && event.keyCode <= 57;
        }
        if ((code == null && !digit) || event.isComposing) { return false; }
        if (typeof global.bayeConsumeKeyEvent === 'function') { global.bayeConsumeKeyEvent(event); }
        else { event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); } }
        if (event.repeat || digit) { return true; }
        var snap = inputSnapshot();
        if (code === VK.EXIT) { cancelInput(); return true; }
        if (!snap.ready || state.transaction) { return true; }
        if (isMenuKind(snap.kind) && !menuSnapshot(snap)) { return true; }
        if ((code === VK.HELP || code === VK.SEARCH) &&
            snap.kind !== INPUT.PICK && snap.kind !== INPUT.MOVE && snap.kind !== INPUT.AIM) { return true; }
        if (snap.kind === INPUT.HELP && code !== VK.ENTER) { return true; }
        if (code === VK.ENTER && !isMenuKind(snap.kind) && snap.kind !== INPUT.HELP && snap.kind !== INPUT.VIEW &&
            (!snap.focus || !legalEnter(snap.focus, unitAt(snap.focus.x, snap.focus.y), snap.fight))) { return true; }
        beginRequest('key', { code: code }, snap); return true;
    }
    function renderFightMenu() {
        var panel = el('hd-battle-menu'), list = el('hd-battle-menu-list'), title = el('hd-battle-menu-title');
        var info = menuSnapshot(inputSnapshot());
        state.menuKind = info ? info.kind : ''; state.menuTitle = info ? info.title : '';
        state.menuNames = info ? info.names : []; state.menuIndex = info ? info.index : 0;
        if (!panel || !list) { return; }
        panel.hidden = !info;
        if (!info) { return; }
        if (title) { title.textContent = info.title; }
        var html = '';
        for (var i = 0; i < info.names.length; i += 1) {
            var text = String(info.names[i]).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
            html += '<button type="button" class="hd-battle-menu-item' + (i === info.index ? ' is-on' : '') +
                '" data-hd-battle-menu="' + i + '"' + (state.transaction ? ' disabled' : '') + '>' + text + '</button>';
        }
        if (list.getAttribute('data-sig') !== html) { list.setAttribute('data-sig', html); list.innerHTML = html; }
    }
    function paintRuntimeBadge() {
        global.HD_BATTLE_VER = HD_BATTLE_VER;
        var badge = el('baye-build-badge');
        if (badge) { badge.textContent = HD_BATTLE_VER; badge.setAttribute('data-baye-asset-ver', HD_BATTLE_VER); }
    }
    function applyChrome() {
        var show = state.open && shouldShowHd();
        document.documentElement.setAttribute('data-baye-battle', show ? 'hd' : 'off');
        document.documentElement.setAttribute('data-baye-battle-pref', getMode());
        document.documentElement.setAttribute('data-baye-battle-menu', show && state.menuKind ? state.menuKind : 'off');
        var snap = inputSnapshot();
        var help = snap.kind === INPUT.HELP || snap.kind === INPUT.VIEW;
        document.documentElement.setAttribute('data-baye-battle-input', show && help ? 'help' : 'battle');
        if (document.body) {
            document.body.classList.toggle('baye-hd-battle-on', show);
            document.body.classList.toggle('baye-hd-battle-lcd', show && (state.showLcd || help));
        }
        var root = el('hd-battle');
        if (root) { root.classList.toggle('is-open', show); root.setAttribute('aria-hidden', show ? 'false' : 'true'); }
        var actor = null;
        for (var i = 0; i < state.units.length; i += 1) { if (state.units[i].i === snap.actor) { actor = state.units[i]; break; } }
        var guidance = { 0: '正在处理战场行动…', 1: '选择己方将领', 2: '选择移动位置（可选择原地）',
            3: '选择将领行动', 4: '选择计谋', 5: '选择射程内目标', 6: '战场系统', 7: '确认全军撤退', 8: '选择战场设置',
            9: '查看将领信息 · Enter / Esc 返回', 10: '战场形势 · 箭头翻页，Enter / Esc 返回' };
        var hud = el('hd-battle-hud');
        if (hud) { hud.textContent = state.preview ? 'HD 战场预览' :
            (actor && actor.name ? actor.name + ' · ' : '') + (guidance[snap.kind] || '等待引擎战场数据…') +
            (state.transaction ? ' · 等待操作完成' : ''); }
        var tip = el('hd-battle-tip');
        if (tip) { tip.hidden = !state.fightTip; tip.textContent = state.fightTip; }
        var banner = el('hd-battle-result');
        if (banner) { banner.hidden = true; }
        if (root && root.querySelectorAll) {
            var buttons = root.querySelectorAll('[data-hd-battle-sys]');
            for (var j = 0; j < buttons.length; j += 1) {
                buttons[j].disabled = !!state.transaction || !snap.ready || (snap.kind !== INPUT.PICK && snap.kind !== INPUT.SYSTEM);
            }
        }
    }
    function refresh() {
        if (state.refreshing || !state.open) { return; }
        state.refreshing = true;
        try {
            if (state.preview || fightStrictActive()) {
                var info = sampleFight();
                state.units = info.units; state.tiles = info.tiles; state.focus = info.focus;
                state.mapW = info.mapW; state.mapH = info.mapH; state.tileW = info.tileW || info.mapW;
                state.viewOx = info.viewOx || 0; state.viewOy = info.viewOy || 0;
                state.viewW = info.viewW || info.mapW; state.viewH = info.viewH || info.mapH;
            }
            var snap = inputSnapshot();
            // A renderer may retire stale requests, but cannot deliver keys.
            if (state.transaction && !sameInput(state.transaction, snap)) { finishRequest('input-changed'); }
            var tip = snap.fight && snap.fight.tip ? String(snap.fight.tip) : '';
            if (tip !== state.tipDismissed && tip) { state.fightTip = tip; }
            if (!tip) { state.tipDismissed = ''; }
            renderFightMenu(); applyChrome(); draw();
        } catch (e) {
            state.lastRefreshStack = String(e && e.stack || e);
            if (global.console && console.error) { console.error('[hd-battle] render', e); }
        } finally { state.refreshing = false; }
    }
    function loop() {
        if (!state.open || !shouldShowHd()) { state.loopId = 0; return; }
        refresh();
        var epoch = modeEpoch;
        state.loopId = global.requestAnimationFrame(function () { if (epoch === modeEpoch) { loop(); } });
    }
    function ensureLoop() { if (state.open && !state.loopId) { loop(); } }
    function enterBattle(meta) {
        meta = meta || {};
        if (!shouldShowHd() || (!meta.preview && !fightStrictActive())) { return false; }
        if (!state.open) {
            invalidateHdWork(); state.resultCode = 0; state.resultText = ''; state.resultDismissed = false;
            state.fightTip = ''; state.tipDismissed = '';
        }
        state.open = true; state.preview = !!meta.preview;
        state.lastHook = meta.hook || state.lastHook; state.lastHookAt = Date.now();
        if (global.BayeHdCityMenu && typeof BayeHdCityMenu.close === 'function') { BayeHdCityMenu.close({ silent: true, force: true }); }
        refresh(); ensureLoop(); return true;
    }
    function closeBattle(opts) {
        opts = opts || {};
        if (!opts.force && !state.preview && fightStrictActive()) { return false; }
        invalidateHdWork(); state.open = false; state.preview = false;
        state.menuKind = ''; state.menuNames = []; applyChrome(); return true;
    }
    function prepareNewFight() {
        closeBattle({ force: true, preserveEngine: true });
        state.resultCode = 0; state.resultText = ''; state.resultDismissed = false;
        state.units = []; state.tiles = []; state.focus = { x: null, y: null };
        state.fightTip = ''; state.tipDismissed = ''; state.lastRequest = null;
    }
    function onEngineFight() {
        if (!shouldShowHd()) { return; }
        var fight = readFight();
        if (!fight) { return; }
        if (fight.active && !fight.over) {
            if (!state.open) { enterBattle({ hook: 'g_hdFightActive' }); } else { refresh(); } return;
        }
        if (fight.over) {
            state.resultCode = Number(fight.over);
            state.resultText = state.resultCode === 2 ? '我军战败' : (fight.result || '我军大获全胜');
        }
        // Release the overlay for genuine post-battle dialogs. Observation
        // cannot dismiss a report, select a successor or alter a result.
        if (state.open && !state.preview) { closeBattle({ force: true, preserveEngine: true }); }
    }
    function onEngineHook(name) {
        if (name === 'chooseGameEntry' || name === 'didOpenNewGame' || name === 'didLoadGame') {
            prepareNewFight();
            return;
        }
        if (!shouldShowHd()) { return; }
        state.lastHook = name; state.lastHookAt = Date.now();
        if (name === 'exitBattle') { onEngineFight(); return; }
        if (fightStrictActive()) { if (!state.open) { enterBattle({ hook: name }); } else { refresh(); } }
    }
    function writeFightMenuControl(on) {
        try {
            if (global.baye && baye.data && baye.data.g_hdFightMenuControl != null) { baye.data.g_hdFightMenuControl = on ? 1 : 0; }
        } catch (e) {}
    }
    function uninstallSysMenuHook() {
        if (sysMenuBinding && sysMenuBinding.owner.fightOpenMainMenu === sysMenuBinding.hook) {
            if (sysMenuBinding.hadOwn) { sysMenuBinding.owner.fightOpenMainMenu = sysMenuBinding.previous; }
            else { delete sysMenuBinding.owner.fightOpenMainMenu; }
        }
        sysMenuBinding = null; state.sysMenuHooked = false; writeFightMenuControl(0);
    }
    function installSysMenuHook() {
        if (!shouldShowHd() || !global.baye) { return; }
        if (!baye.hooks) { baye.hooks = {}; }
        if (sysMenuBinding && sysMenuBinding.owner === baye.hooks && baye.hooks.fightOpenMainMenu === sysMenuBinding.hook) { return; }
        uninstallSysMenuHook();
        var binding = { owner: baye.hooks, hadOwn: Object.prototype.hasOwnProperty.call(baye.hooks, 'fightOpenMainMenu'),
            previous: baye.hooks.fightOpenMainMenu, hook: null };
        binding.hook = function () {
            if (!shouldShowHd() || sysMenuBinding !== binding || binding.owner.fightOpenMainMenu !== binding.hook) {
                if (!shouldShowHd()) { syncMode(); }
                writeFightMenuControl(0);
                return typeof binding.previous === 'function' ? binding.previous.apply(this, arguments) : -2;
            }
            if (fightStrictActive()) {
                // -2 asks C for its asynchronous native menu. Opening the
                // menu alone performs no action and never ends a turn.
                writeFightMenuControl(0); onEngineHook('fightOpenMainMenu'); return -2;
            }
            return typeof binding.previous === 'function' ? binding.previous.apply(this, arguments) : -2;
        };
        binding.owner.fightOpenMainMenu = binding.hook; sysMenuBinding = binding; state.sysMenuHooked = true;
    }
    function syncMode() {
        if (shouldShowHd()) { installSysMenuHook(); return; }
        var hadControl = !!(sysMenuBinding || state.open || state.transaction);
        uninstallSysMenuHook();
        if (!hadControl) { return; }
        invalidateHdWork();
        try {
            if (global.baye && baye.data && baye.data.g_hdFightAllowRetreat != null) { baye.data.g_hdFightAllowRetreat = 0; }
        } catch (e) {}
        closeBattle({ force: true, preserveEngine: true });
    }
    function setMode(value) { writeStorage(STORAGE_KEY, normalizeMode(value)); syncMode(); applyChrome(); }
    function bindUi() {
        if (state.bound) { return; }
        var root = el('hd-battle');
        if (!root) { return; }
        state.bound = true;
        root.addEventListener('click', function (event) {
            var node = event.target;
            while (node && node !== root) {
                if (node.getAttribute) {
                    if (node.getAttribute('data-hd-battle-lcd') != null) {
                        state.showLcd = !state.showLcd; applyChrome(); event.preventDefault(); return;
                    }
                    if (node.getAttribute('data-hd-battle-sys') != null) { toggleSystemMenu(); event.preventDefault(); return; }
                    if (node.getAttribute('data-hd-battle-cancel') != null || node.getAttribute('data-hd-battle-menu-exit') != null) {
                        cancelInput(); event.preventDefault(); return;
                    }
                    if (node.getAttribute('data-hd-battle-menu') != null) {
                        pickFightMenu(Number(node.getAttribute('data-hd-battle-menu'))); event.preventDefault(); return;
                    }
                    if (node.getAttribute('data-hd-battle-tip') != null) { dismissFightTip(); event.preventDefault(); return; }
                    if (node.getAttribute('data-hd-battle-close') != null) { closeBattle(); event.preventDefault(); return; }
                }
                node = node.parentNode;
            }
            if (event.target && event.target.id === 'hd-battle-canvas') {
                var tile = eventToTile(event);
                if (tile) { clickBattleTile(tile.x, tile.y); event.preventDefault(); }
            }
        });
        if (global.addEventListener) { global.addEventListener('keydown', handleKey, true); }
    }
    function start() {
        bindUi(); syncMode(); applyChrome();
        if (pollId) { return; }
        pollId = global.setInterval(function () {
            syncMode(); if (shouldShowHd() && hdReady()) { onEngineFight(); }
        }, 220);
    }
    function debugSnapshot() {
        var snap = inputSnapshot(), menu = menuSnapshot(snap), transaction = state.transaction;
        return {
            pref: getMode(), showHd: shouldShowHd(), open: state.open, preview: state.preview,
            lastHook: state.lastHook, units: state.units.length, unitList: state.units.slice(),
            mapW: state.mapW, mapH: state.mapH, view: { x: state.viewOx, y: state.viewOy, w: state.viewW, h: state.viewH },
            genCount: fightArrayCount(), focus: state.focus, phase: snap.fight && snap.fight.phase,
            wait: !!(snap.fight && snap.fight.wait), active: !!(snap.fight && snap.fight.active), over: !!(snap.fight && snap.fight.over),
            aimType: snap.fight && snap.fight.aimType, inputKind: snap.kind, inputSeq: snap.seq, actorIndex: snap.actor,
            inputReady: snap.ready, strictLive: fightStrictActive(), menuKind: menu ? menu.kind : '',
            menuTitle: menu ? menu.title : '', menuNames: menu ? menu.names : [], menuIndex: menu ? menu.index : 0,
            menuLive: !!menu, menuSynthetic: false, menuBytes: snap.menu && snap.menu.names || [], menuCount: snap.menu && snap.menu.count || 0,
            menuClickable: !!menu && !transaction,
            transaction: transaction ? { type: transaction.type, inputSeq: transaction.seq, kind: transaction.kind,
                committed: transaction.committed, expected: transaction.expected, x: transaction.x, y: transaction.y, target: transaction.target } : null,
            lastRequest: state.lastRequest, queueLen: transaction ? 1 : 0, pendingSys: 0,
            pendingActPick: null, pendingApproach: null, playerTurnEnded: false, sysMenuHooked: state.sysMenuHooked,
            fightTip: state.fightTip, resultCode: state.resultCode, resultText: state.resultText, resultDismissed: state.resultDismissed,
            occupyPending: false, occupyDone: false, occupyEnters: 0, showLcd: state.showLcd,
            battleVer: HD_BATTLE_VER, lastRefreshStack: state.lastRefreshStack, realm: readRealm(),
            why: { reasons: menu ? [] : ['no-active-engine-menu'] }
        };
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
                state: readNumber(p, 'state'),
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
        // These overlays read the engine's exact path/range tables. They do
        // not calculate substitute destinations or choose targets.
        var fightRange = readFight();
        var rangeKind = fightRange && Number(fightRange.inputKind);
        if (!state.preview && fightRange && fightRange.active && !fightRange.over &&
            (rangeKind === INPUT.MOVE || rangeKind === INPUT.AIM)) {
            ctx.fillStyle = rangeKind === INPUT.MOVE ? 'rgba(80,180,230,0.25)' : 'rgba(240,160,80,0.25)';
            for (r = 0; r < rows; r += 1) {
                for (c = 0; c < cols; c += 1) {
                    var tx = c + viewOx, ty = r + viewOy;
                    var legal = rangeKind === INPUT.MOVE ? canMoveTo(tx, ty) === true : inAtkRng(tx, ty);
                    if (legal) { ctx.fillRect(ox + c * cw + 1, oy + r * ch + 1, cw - 2, ch - 2); }
                }
            }
        }
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
            if (u.x == null || u.y == null || u.state === 8) {
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
        ctx.fillText('蓝色：己方  红色：敌方  ·  点击将领、移动位置或目标  ·  Esc 取消', ox, oy + rows * ch + 28);
        if (!drawn) {
            ctx.fillStyle = 'rgba(243,246,251,0.82)';
            ctx.font = '22px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(state.preview
                ? '预览棋盘。进战斗后从 g_GenPos / GenArray 画将。'
                : '等待 fight hook 或 g_GenPos 坐标…', DESIGN_W / 2, DESIGN_H / 2);
        }
    }

    paintRuntimeBadge(); applyChrome();
    global.BayeHdBattle = {
        STORAGE_KEY: STORAGE_KEY, INPUT: INPUT, getMode: getMode, setMode: setMode,
        syncMode: syncMode, shouldShowHd: shouldShowHd, isOpen: function () { return state.open; },
        enter: enterBattle, close: closeBattle, prepareNewFight: prepareNewFight,
        onEngineHook: onEngineHook, onEngineFight: onEngineFight, occupyBusy: function () { return false; },
        clickTile: clickBattleTile,
        clickOwnUnit: function () {
            refresh();
            for (var i = 0; i < state.units.length; i += 1) {
                if (selectable(state.units[i])) { return clickBattleTile(state.units[i].x, state.units[i].y); }
            }
            return reject('no-waiting-unit');
        },
        clickUnitByName: function (name) {
            refresh();
            for (var i = 0; i < state.units.length; i += 1) {
                if (state.units[i].name === name) { return clickBattleTile(state.units[i].x, state.units[i].y); }
            }
            return reject('no-unit');
        },
        clickNearestEnemy: function () { return reject('choose-target-manually'); }, walkCloserTo: clickBattleTile,
        pickMenuName: pickFightMenuName, pickMenu: pickFightMenu,
        forceShowFightMenu: function () { refresh(); return menuSnapshot(inputSnapshot()); },
        recoverMenu: function () { refresh(); return menuSnapshot(inputSnapshot()); },
        legalEnter: legalEnter, dismissFightTip: dismissFightTip, openSystemMenu: toggleSystemMenu,
        cancel: cancelInput, handleKey: handleKey, returnFromHelp: returnFromHelp,
        onRetreatBlocked: function () { state.fightTip = '撤退操作未被引擎接受。'; applyChrome(); },
        debugBoxSlow: function () { return { supported: false }; },
        debugPreview: function () { return enterBattle({ preview: true, hook: 'debugPreview' }); },
        start: start, applyPcPage: start, debugSnapshot: debugSnapshot
    };
})(window);
