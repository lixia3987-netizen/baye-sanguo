/**
 * HD battle renderer and manual input adapter. The engine owns all game rules.
 * Rendering sends no inputs. A user request delivers one key at a time and
 * advances only after a real snapshot acknowledges the preceding key.
 */
(function (global) {
    var STORAGE_KEY = 'baye/battleMode';
    var MOBILE_STORAGE_KEY = 'baye/mobileBattleMode';
    var OVERWORLD_KEY = 'baye/overworldMode';
    var DESIGN_W = 1920, DESIGN_H = 1080;
    var HD_BATTLE_VER = '20261008k';
    var VK = { UP: 0x22, DOWN: 0x23, LEFT: 0x24, RIGHT: 0x25, HELP: 0x26, ENTER: 0x27, EXIT: 0x28, SEARCH: 0x33 };
    var INPUT = { BUSY: 0, PICK: 1, MOVE: 2, ACTION: 3, SKILL: 4, AIM: 5, SYSTEM: 6, RETREAT: 7, SETTINGS: 8, HELP: 9, VIEW: 10 };
    var ARM_NAMES = ['骑兵', '步兵', '弓兵', '水军', '极兵', '玄兵'];
    var ARM_GLYPHS = ['骑', '步', '弓', '水', '极', '玄'];
    var UNIT_STATES = ['正常', '混乱', '禁咒', '定身', '奇门', '遁甲', '石阵', '潜踪', '死亡'];
    var state = {
        open: false, preview: false, bound: false, showLcd: false, loopId: 0, visibilityBound: false,
        lastHook: '', lastHookAt: 0, readDepth: 0, refreshing: false,
        readingEngine: false, samplingFight: false, probed: false,
        units: [], tiles: [], terrain: null, focus: { x: null, y: null },
        mapW: 0, mapH: 0, viewOx: 0, viewOy: 0, viewW: 0, viewH: 0, tileW: 0,
        menuKind: '', menuTitle: '', menuNames: [], menuIndex: 0,
        resultCode: 0, resultText: '', resultDismissed: false,
        fightTip: '', tipDismissed: '', lastRefreshStack: '',
        transaction: null, lastRequest: null, lastCommit: null, sysMenuHooked: false
    };
    var sysMenuBinding = null, modeEpoch = 0, pollId = 0, commandTimer = 0, terrainSession = 0;
    var mobileHost = null, mobileMode = 'auto', mobileLifecycleBound = false, mobileRendering = false;

    function el(id) { return document.getElementById(id); }
    function readStorage(key, fallback) {
        try { return global.localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
    }
    function writeStorage(key, value) {
        try { global.localStorage.setItem(key, String(value)); } catch (e) {}
    }
    function normalizeMode(value) { return value === 'hd' || value === 'classic' ? value : 'auto'; }
    function getMode() { return normalizeMode(readStorage(mobileHost ? MOBILE_STORAGE_KEY : STORAGE_KEY,
        mobileHost ? mobileMode : 'auto')); }
    function mobileTicket() {
        try {
            if (!mobileHost || document.hidden || !mobileHost.isAvailable || mobileHost.isAvailable() !== true ||
                typeof mobileHost.readTicket !== 'function') { return null; }
            var ticket = mobileHost.readTicket(), data = engineData();
            if (!ticket || !data || ticket.data !== data || typeof ticket.key !== 'string' || !ticket.key ||
                typeof ticket.stableKey !== 'string' || !ticket.stableKey ||
                (ticket.presentation !== 'hd' && ticket.presentation !== 'lcd') ||
                !Number.isInteger(ticket.libraryGeneration) || ticket.libraryGeneration <= 0 || ticket.libraryGeneration > 0xffffffff ||
                !Number.isInteger(ticket.kind) || ticket.kind < INPUT.BUSY || ticket.kind > INPUT.VIEW ||
                !Number.isInteger(ticket.seq) || ticket.seq <= 0 || ticket.seq > 0xffffffff ||
                !Number.isInteger(ticket.actor) || ticket.actor < 0 || ticket.actor > 255 || engineData() !== data) { return null; }
            return ticket;
        } catch (e) { return null; }
    }
    function sameMobileTicket(a, b, full) {
        return !!(a && b && a.data === b.data && a.libraryGeneration === b.libraryGeneration &&
            a.kind === b.kind && a.seq === b.seq && a.actor === b.actor && a.stableKey === b.stableKey &&
            (!full || a.key === b.key));
    }
    function shouldShowHd() {
        if (mobileHost && !mobileTicket()) { return false; }
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
    function readRangeNumber(obj, name) {
        if (!obj || state.readDepth > 8) { return null; }
        state.readDepth += 1;
        try {
            var value = obj[name];
            if (value && typeof value === 'object' && 'value' in value) { value = value.value; }
            return typeof value === 'number' && isFinite(value) ? value : null;
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
    function peekPersonArmType(id) {
        try {
            // The native getter includes equipped tools that change a unit's arm type.
            // The current native export takes a U8 index. Larger roster IDs must
            // stay unknown rather than silently reading another person's tools.
            if (!id || id > 256 || typeof baye.getArmType !== 'function') { return null; }
            var value = baye.getArmType(id - 1);
            if (value == null) { return null; }
            value = Number(value);
            return value >= 0 && value < ARM_NAMES.length && value === Math.floor(value) ? value : null;
        } catch (e) { return null; }
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
    function actorUnit(index) {
        for (var i = 0; i < state.units.length; i += 1) {
            if (state.units[i].i === index && state.units[i].state !== 8) { return state.units[i]; }
        }
        return null;
    }
    function unitStatus(unit) {
        if (unit.state != null && unit.state !== 0) { return UNIT_STATES[unit.state] || '状态未知'; }
        if (unit.active === 1) { return '已行动'; }
        return selectable(unit) ? '待行动' : (UNIT_STATES[unit.state] || '状态未知');
    }
    function unitDetails(unit) {
        return (unit.name || '#' + unit.i) + ' · ' + (ARM_NAMES[unit.armType] || '兵种未知') +
            ' · 兵 ' + (unit.arms == null ? '—' : unit.arms) +
            ' · HP ' + (unit.hp == null ? '—' : unit.hp) +
            ' · MP ' + (unit.mp == null ? '—' : unit.mp) + ' · ' + unitStatus(unit);
    }
    function terrainAt(x, y, snapshot) {
        if (global.BayeHdBattleTerrain) { return global.BayeHdBattleTerrain.inspect(snapshot || state.terrain, x, y); }
        return { kind: 'unknown', label: '未知地形', index: null, raw: null, x: x, y: y };
    }
    function clearTerrainPaint() {
        if (global.BayeHdBattleTerrain) { global.BayeHdBattleTerrain.clear(); }
    }
    function aimPreview(snap) {
        if (state.preview || !state.open || document.hidden || !snap.ready ||
            !snap.fight.wait || (snap.menu && snap.menu.active) || snap.kind !== INPUT.AIM || !snap.focus) { return null; }
        var actor = actorUnit(snap.actor), target = unitAt(snap.focus.x, snap.focus.y);
        if (!actor || !selectable(actor) || !target || !legalEnter(snap.focus, target, snap.fight)) { return null; }
        // A skill can still fail native side, terrain or MP checks after confirmation.
        return { actor: actor, target: target,
            label: readRangeNumber(snap.fight, 'aimType') === 1 ? '射程内目标' : '攻击目标' };
    }
    function engineFocusTile() {
        var data = engineData(), x = readNumber(data, 'g_FoucsX'), y = readNumber(data, 'g_FoucsY');
        return x == null || y == null ? null : { x: x, y: y };
    }
    function canMoveTo(x, y) {
        var data = engineData(), path = data && data.g_FightPath;
        if (!path) { return null; }
        var sx = readRangeNumber(data, 'g_PathSX'), sy = readRangeNumber(data, 'g_PathSY');
        var ux = readRangeNumber(data, 'g_PUseSX'), uy = readRangeNumber(data, 'g_PUseSY');
        var bounds = { width: readRangeNumber(data, 'g_MapWid'), height: readRangeNumber(data, 'g_MapHgt') };
        if (global.BayeHdBattleFeedback) {
            var answer = global.BayeHdBattleFeedback.lookupMove({ originX: sx, originY: sy, useX: ux, useY: uy, values: path }, x, y, bounds);
            return answer.status === 'unknown' ? null : answer.status === 'in';
        }
        if (!validNativeTile(x, y, bounds)) { return false; }
        if (!nativeByte(sx) || !nativeByte(sy) || !nativeByte(ux) || !nativeByte(uy) || path.length < 225) { return null; }
        var px = (x - sx + ux) & 255, py = (y - sy + uy) & 255;
        if (px < 0 || py < 0 || px >= 15 || py >= 15) { return false; }
        var value = path[py * 15 + px];
        return nativeByte(value) ? value <= 0x80 : null;
    }
    function nativeByte(value) { return typeof value === 'number' && value >= 0 && value <= 255 && value === Math.floor(value); }
    function validNativeTile(x, y, bounds) {
        return bounds && typeof bounds.width === 'number' && typeof bounds.height === 'number' &&
            bounds.width > 0 && bounds.width <= 255 && bounds.width === Math.floor(bounds.width) &&
            bounds.height > 0 && bounds.height <= 255 && bounds.height === Math.floor(bounds.height) &&
            typeof x === 'number' && typeof y === 'number' && x === Math.floor(x) && y === Math.floor(y) &&
            x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
    }
    function readRangeValues(buffer, offset, count) {
        var values = [];
        for (var i = offset; buffer && i < Math.min(buffer.length, offset + count); i += 1) {
            values.push(readRangeNumber(buffer, i));
        }
        return values;
    }
    function readAimMask(data) {
        var rng = data && data.g_FgtAtkRng, size = readRangeNumber(rng, 0);
        return { size: size, originX: readRangeNumber(rng, 1), originY: readRangeNumber(rng, 2),
            values: nativeByte(size) && size >= 1 && size <= 15 ? readRangeValues(rng, 3, size * size) : [] };
    }
    function inAtkRng(x, y) {
        var data = engineData(), mask = readAimMask(data), size = mask.size, sx = mask.originX, sy = mask.originY;
        var bounds = { width: readRangeNumber(data, 'g_MapWid'), height: readRangeNumber(data, 'g_MapHgt') };
        if (global.BayeHdBattleFeedback) {
            return global.BayeHdBattleFeedback.lookupAim(mask, x, y, bounds).status === 'in';
        }
        if (!validNativeTile(x, y, bounds) || !nativeByte(size) || size < 1 || size > 15 ||
            !nativeByte(sx) || !nativeByte(sy) || mask.values.length < size * size) { return false; }
        // C stores both range origins and coordinate differences as U8.
        var dx = (x - sx) & 0xff, dy = (y - sy) & 0xff;
        return dx >= 0 && dy >= 0 && dx < size && dy < size &&
            mask.values[dx + dy * size] === 1;
    }
    function rangeFeedback(snap) {
        if (!global.BayeHdBattleFeedback) { return { active: false, reason: 'feedback-module-unavailable', cells: [], rangedUnits: [], focus: null }; }
        var data = engineData(), actor = actorUnit(snap.actor);
        return global.BayeHdBattleFeedback.build({ visible: state.open && !state.preview && shouldShowHd(),
            hidden: !!document.hidden, classic: !shouldShowHd(), ready: snap.ready, wait: !!(snap.fight && snap.fight.wait),
            active: !!(snap.fight && snap.fight.active), over: !!(snap.fight && snap.fight.over),
            reportActive: nativeReportWaiting(), menuActive: !!(snap.menu && snap.menu.active),
            inputKind: snap.kind, inputSeq: snap.seq, actorIndex: snap.actor, actor: actor,
            aimType: readRangeNumber(snap.fight, 'aimType'), focus: snap.focus,
            bounds: { width: readRangeNumber(data, 'g_MapWid'), height: readRangeNumber(data, 'g_MapHgt') },
            view: { x: state.viewOx, y: state.viewOy, width: state.viewW || state.mapW, height: state.viewH || state.mapH },
            move: snap.kind === INPUT.MOVE ? { originX: readRangeNumber(data, 'g_PathSX'), originY: readRangeNumber(data, 'g_PathSY'),
                useX: readRangeNumber(data, 'g_PUseSX'), useY: readRangeNumber(data, 'g_PUseSY'), values: readRangeValues(data && data.g_FightPath, 0, 225) } : null,
            aim: snap.kind === INPUT.AIM ? readAimMask(data) : null, units: state.units });
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
        var ticket = mobileHost ? mobileTicket() : null;
        return {
            fight: fight, menu: menu, kind: kind, seq: seq,
            actor: fight && readNumber(fight, 'actorIndex'), focus: engineFocusTile(),
            ready: !!(shouldShowHd() && !nativeReportWaiting() && fight && fight.active && !fight.over &&
                kind >= INPUT.PICK && kind <= INPUT.VIEW && seq != null && seq > 0 &&
                (!mobileHost || ticket && ticket.presentation === 'hd' && ticket.kind === kind &&
                    ticket.seq === seq && ticket.actor === readNumber(fight, 'actorIndex')))
        };
    }
    function getInputTicket() {
        if (!mobileHost || state.preview || state.showLcd) { return null; }
        var before = mobileTicket(), snap = inputSnapshot(), after = mobileTicket();
        if (!snap.ready || !sameMobileTicket(before, after, true) || after.presentation !== 'hd' ||
            after.kind !== snap.kind || after.seq !== snap.seq || after.actor !== snap.actor ||
            snap.kind === INPUT.HELP || snap.kind === INPUT.VIEW) { return null; }
        var ticket = { key: after.key, stableKey: after.stableKey, libraryGeneration: after.libraryGeneration,
            kind: after.kind, seq: after.seq, actor: after.actor };
        Object.defineProperty(ticket, 'data', { value: after.data, enumerable: false });
        return Object.freeze(ticket);
    }
    function retireInteraction(reason) {
        invalidateHdWork();
        state.lastRequest = { type: 'retired', reason: reason || 'mobile-boundary' };
    }
    function getLcdPresentation() {
        if (!mobileHost) { return state.showLcd ? 'on' : 'off'; }
        var ticket = mobileTicket();
        return !shouldShowHd() || !ticket || state.showLcd || ticket.presentation !== 'hd' ||
            ticket.kind === INPUT.BUSY || ticket.kind === INPUT.HELP || ticket.kind === INPUT.VIEW ||
            nativeReportWaiting() || !getInputTicket() ? 'passthrough' : 'off';
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
            var aimType = readRangeNumber(fight, 'aimType');
            return aimType === 1 || (aimType === 0 && unit.side === 'enemy');
        }
        return false;
    }
    function rawSendKey(code) {
        if (mobileHost && (!state.transaction ||
            !sameMobileTicket(state.transaction.mobileStepOwner, getInputTicket(), true))) { return false; }
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
        clearTerrainPaint();
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
        if (mobileHost && !sameMobileTicket(transaction.mobileOwner, getInputTicket(), false)) { return false; }
        if (transaction.viewOwner) {
            var view;
            try { view = baye.hd.view && baye.hd.view(); } catch (e) { return false; }
            var owner = transaction.viewOwner;
            if (!view || view.active !== 1 || view.protocolVersion !== 1 ||
                view.generation !== view.detailGeneration || owner.generation !== view.generation ||
                owner.seq !== view.seq || owner.inputSeq !== view.inputSeq || view.inputSeq !== snap.seq) { return false; }
        }
        if (transaction.menuSeq != null) {
            var menu = menuSnapshot(snap);
            return !!(menu && menu.seq === transaction.menuSeq && menu.names.join('\u0000') === transaction.menuSignature);
        }
        return true;
    }
    function sendRequestKey(transaction, code, expected) {
        // Timers poll acknowledgements only; they never invent or retry an action.
        var stepOwner = mobileHost ? getInputTicket() : null, snap = inputSnapshot();
        if (state.transaction !== transaction || !sameInput(transaction, snap) ||
            mobileHost && !sameMobileTicket(stepOwner, getInputTicket(), true)) {
            finishRequest('input-changed'); return;
        }
        if (mobileHost) {
            if (code === VK.ENTER && (transaction.type === 'tile' && (!snap.focus ||
                snap.focus.x !== transaction.x || snap.focus.y !== transaction.y ||
                !legalEnter(snap.focus, unitAt(snap.focus.x, snap.focus.y), snap.fight)) ||
                transaction.type === 'menu' && (!snap.menu || Number(snap.menu.index) !== transaction.target))) {
                finishRequest('target-changed'); return;
            }
            if (expected) {
                var dx = code === VK.RIGHT ? 1 : code === VK.LEFT ? -1 : 0;
                var dy = code === VK.DOWN ? 1 : code === VK.UP ? -1 : 0;
                if (expected.index != null ? !snap.menu ||
                    (Number(snap.menu.index) + snap.menu.names.length + (code === VK.DOWN ? 1 : -1)) % snap.menu.names.length !== expected.index :
                    !snap.focus || snap.focus.x + dx !== expected.x || snap.focus.y + dy !== expected.y) {
                    finishRequest('focus-changed'); return;
                }
            }
            transaction.mobileStepOwner = stepOwner;
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
        if (mobileHost) {
            transaction.mobileOwner = getInputTicket();
            if (!transaction.mobileOwner || transaction.mobileOwner.kind !== snap.kind ||
                transaction.mobileOwner.seq !== snap.seq || transaction.mobileOwner.actor !== snap.actor) { return reject('mobile-owner-changed'); }
        }
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
    function viewKey(code, owner) {
        var snap = inputSnapshot(), view;
        try { view = baye.hd.view && baye.hd.view(); } catch (e) { return reject('view-unavailable'); }
        if (!owner || !view || !snap.ready || snap.kind !== INPUT.VIEW || owner.kind !== INPUT.VIEW ||
            view.active !== 1 || view.protocolVersion !== 1 || view.generation !== view.detailGeneration ||
            owner.seq !== view.seq || owner.generation !== view.generation ||
            owner.inputSeq !== view.inputSeq || view.inputSeq !== snap.seq ||
            document.hidden || [VK.UP, VK.DOWN, VK.LEFT, VK.RIGHT, VK.ENTER, VK.EXIT].indexOf(code) < 0) {
            return reject('view-owner-changed');
        }
        return beginRequest('key', { code: code, viewOwner: { kind: owner.kind, seq: owner.seq,
            generation: owner.generation, inputSeq: owner.inputSeq } }, snap);
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
        var actor = actorUnit(snap.actor);
        var guidance = { 0: '正在处理战场行动…', 1: '选择己方将领', 2: '选择移动位置（可选择原地）',
            3: '选择将领行动', 4: '选择计谋', 5: '选择射程内目标', 6: '战场系统', 7: '确认全军撤退', 8: '选择战场设置',
            9: '查看将领信息 · Enter / Esc 返回', 10: '战场形势 · 箭头翻页，Enter / Esc 返回' };
        var hud = el('hd-battle-hud');
        if (hud) {
            hud.textContent = state.preview ? 'HD 战场预览' :
                (actor && actor.name ? actor.name + ' · ' : '') + (guidance[snap.kind] || '等待引擎战场数据…') +
                (state.transaction ? ' · 等待操作完成' : '');
        }
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
                state.units = info.units; state.tiles = info.tiles; state.terrain = info.terrain; state.focus = info.focus;
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
        if (document.hidden || !state.open || !shouldShowHd()) { return; }
        if (!state.preview && !fightStrictActive()) { onEngineFight(); return; }
        refresh();
        ensureLoop();
    }
    function ensureLoop() {
        if (document.hidden || !state.open || !shouldShowHd() || state.loopId) { return; }
        var epoch = modeEpoch;
        var id = global.requestAnimationFrame(function () {
            if (state.loopId !== id || epoch !== modeEpoch) { return; }
            state.loopId = 0;
            loop();
        });
        state.loopId = id;
    }
    function bindRenderVisibility() {
        if (state.visibilityBound || typeof document.addEventListener !== 'function') { return; }
        state.visibilityBound = true;
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (state.loopId) { global.cancelAnimationFrame(state.loopId); state.loopId = 0; }
                return;
            }
            // Keep native-owner and input ACK polling alive while hidden.
            // Resume from C's current fight, never from the cancelled frame.
            syncMode();
            if (!shouldShowHd() || !hdReady()) { return; }
            onEngineFight();
            ensureLoop();
        });
    }
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
        terrainSession += 1;
        state.resultCode = 0; state.resultText = ''; state.resultDismissed = false;
        state.units = []; state.tiles = []; state.terrain = null; state.focus = { x: null, y: null };
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
        if (mobileHost) {
            if (!shouldShowHd()) { closeBattle({ force: true, preserveEngine: true }); }
            return;
        }
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
    function setMode(value) {
        var mode = normalizeMode(value);
        if (mobileHost) { mobileMode = mode; retireInteraction('mode-changed'); }
        writeStorage(mobileHost ? MOBILE_STORAGE_KEY : STORAGE_KEY, mode); syncMode();
        if (mobileHost && shouldShowHd()) { onEngineFight(); }
        applyChrome();
    }
    function setShowLcd(value) {
        retireInteraction('lcd-presentation-changed'); state.showLcd = value === true;
        applyChrome();
        if (mobileHost && state.open) { refresh(); }
    }
    function bindMobileLifecycle() {
        if (mobileLifecycleBound) { return; }
        mobileLifecycleBound = true;
        function boundary() {
            if (!mobileHost) { return; }
            retireInteraction('mobile-lifecycle'); closeBattle({ force: true, preserveEngine: true });
        }
        if (global.addEventListener) {
            ['blur', 'pagehide', 'resize', 'orientationchange'].forEach(function (name) { global.addEventListener(name, boundary); });
        }
        if (document.addEventListener) {
            document.addEventListener('visibilitychange', function () { if (document.hidden) { boundary(); } });
        }
        if (global.visualViewport && global.visualViewport.addEventListener) { global.visualViewport.addEventListener('resize', boundary); }
        if (global.BayeHdLibIdentity && typeof global.BayeHdLibIdentity.subscribe === 'function') {
            global.BayeHdLibIdentity.subscribe(boundary);
        }
    }
    function configureMobileHost(options) {
        // Configuration precedes start on mobile; do not inherit a PC request.
        invalidateHdWork(); mobileHost = options || {}; state.showLcd = false;
        state.open = false; state.preview = false; bindMobileLifecycle(); applyChrome();
    }
    function bindUi() {
        if (mobileHost) { return; }
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
        bindRenderVisibility();
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
            mobileHost: !!mobileHost, lcdPresentation: getLcdPresentation(),
            lastHook: state.lastHook, units: state.units.length, unitList: state.units.slice(),
            mapW: state.mapW, mapH: state.mapH, view: { x: state.viewOx, y: state.viewOy, w: state.viewW, h: state.viewH },
            terrain: state.terrain ? { source: state.terrain.source, width: state.terrain.width,
                height: state.terrain.height, stride: state.terrain.stride, verified: state.terrain.verified,
                libPath: state.terrain.libPath, preferredLibPath: state.terrain.preferredLibPath,
                sha256: state.terrain.sha256, libGeneration: state.terrain.libGeneration,
                session: state.terrain.session, reason: state.terrain.reason } : null,
            focusTerrain: terrainAt(state.focus.x, state.focus.y),
            feedback: rangeFeedback(snap),
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

    function sampleFight() {
        var info = {
            genCount: 0,
            mapLen: 0,
            units: [],
            focus: { x: null, y: null },
            mapW: 0,
            mapH: 0,
            tiles: [],
            terrain: null,
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
        var nativeDimensions = mw > 0 && mw <= 255 && mw === Math.floor(mw) &&
            mh > 0 && mh <= 255 && mh === Math.floor(mh);
        // The full allocation is 65536 bytes, but only native width * height
        // bytes belong to this map. g_FightMap is a separate LCD viewport cache
        // with a different origin/stride; it is never guessed to be a full map.
        var map = data.g_FightMapData;
        if (nativeDimensions) {
            info.mapW = mw;
            info.mapH = mh;
            info.mapLen = mw * mh;
        }
        info.tileW = info.mapW;
        var hasFullMap = nativeDimensions && map && map.length > 0;
        if (hasFullMap) {
            var t;
            var lim = Math.min(map.length || 0, info.mapW * info.mapH);
            for (t = 0; t < lim; t++) {
                var tv = readNumber(map, t);
                info.tiles.push(tv != null && tv >= 0 && tv <= 255 && tv === Math.floor(tv) ? tv : null);
            }
        }
        var trust = global.BayeHdBattleTerrain ? global.BayeHdBattleTerrain.verifyLib(global.dynLib, baye.hooks) :
            { verified: false, reason: 'terrain-module-unavailable', libPath: '', sha256: null, generation: 0 };
        info.terrain = { source: hasFullMap ? 'full' : 'unknown',
            width: nativeDimensions ? mw : 0, height: nativeDimensions ? mh : 0,
            stride: nativeDimensions ? mw : 0, tiles: info.tiles,
            libPath: trust.libPath, preferredLibPath: readStorage('baye/libpath', ''),
            sha256: trust.sha256, libGeneration: trust.generation, session: terrainSession, mode: 'hd',
            verified: !!(hasFullMap && trust.verified), reason: !hasFullMap ? 'missing-full-map' :
                (trust.reason || (map.length < info.mapLen ? 'incomplete-full-map' : '')) };
        info.focus.x = readNumber(data, 'g_FoucsX');
        info.focus.y = readNumber(data, 'g_FoucsY');
        /* Keep the presentation board around generals and focus as before.
         * Terrain retains the original native bounds/stride independently. */
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
                mp: readNumber(p, 'mp'),
                arms: peekPersonArms(id),
                armType: peekPersonArmType(id),
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
        if (global.BayeHdBattleTerrain && info.terrain.source === 'full' &&
            info.terrain.libPath === 'libs/dat-mod.lib' && typeof baye.getTerrainByGeneralIndex === 'function') {
            for (i = 0; i < info.units.length; i += 1) {
                var candidate = info.units[i];
                if (candidate.state === 8) { continue; }
                var inferred = terrainAt(candidate.x, candidate.y, info.terrain);
                if (inferred.index == null) { continue; }
                try {
                    var nativeTerrain = baye.getTerrainByGeneralIndex(candidate.i);
                    if (nativeTerrain != null && Number(nativeTerrain) === Math.floor(Number(nativeTerrain)) &&
                        Number(nativeTerrain) >= 0 && Number(nativeTerrain) <= 255 && Number(nativeTerrain) !== inferred.index) {
                        info.terrain.verified = false; info.terrain.reason = 'native-mismatch'; break;
                    }
                } catch (e) {}
            }
        }
        for (i = 0; i < info.units.length; i += 1) {
            info.units[i].terrain = terrainAt(info.units[i].x, info.units[i].y, info.terrain);
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

    function drawUnitLegend(ctx, canvas, boardBottom, left) {
        var canvasRect = canvas.getBoundingClientRect(), blockers = [];
        function addBlocker(node) {
            if (!node || typeof node.getBoundingClientRect !== 'function' ||
                !(canvasRect.width > 0) || !(canvasRect.height > 0)) { return; }
            var rect = node.getBoundingClientRect();
            if (!(rect.width > 0) || !(rect.height > 0)) { return; }
            blockers.push({
                left: (rect.left - canvasRect.left) / canvasRect.width * DESIGN_W,
                right: (rect.left + rect.width - canvasRect.left) / canvasRect.width * DESIGN_W,
                top: (rect.top - canvasRect.top) / canvasRect.height * DESIGN_H,
                bottom: (rect.top + rect.height - canvasRect.top) / canvasRect.height * DESIGN_H
            });
        }
        var root = el('hd-battle');
        if (root && root.querySelectorAll) {
            var buttons = root.querySelectorAll('.hd-battle-footer button');
            for (var i = 0; i < buttons.length; i += 1) { addBlocker(buttons[i]); }
        }
        addBlocker(el('baye-build-badge'));
        ctx.save();
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = '15px BayeUI, "Noto Sans CJK SC", sans-serif';
        ctx.fillStyle = '#9aa6b8';
        var entries = ['蓝：己方', '红：敌方', '待：可行动', '已：已行动', '行：当前将领'];
        var next = 0, lines = [], height = 18, gap = 4;
        // The right-hand focus cards keep their own 650px boundary. Only use
        // the lower canvas margin; the board and its hit geometry never move.
        for (var y = boardBottom + 6; y + height <= DESIGN_H - 4 && next < entries.length; y += height + 2) {
            var slots = [{ left: left, right: left + 638 }];
            for (i = 0; i < blockers.length; i += 1) {
                var b = blockers[i];
                if (b.top >= y + height + gap || b.bottom <= y - gap) { continue; }
                var cut = [];
                for (var s = 0; s < slots.length; s += 1) {
                    var slot = slots[s];
                    if (b.right + gap <= slot.left || b.left - gap >= slot.right) { cut.push(slot); continue; }
                    if (b.left - gap > slot.left) { cut.push({ left: slot.left, right: b.left - gap }); }
                    if (b.right + gap < slot.right) { cut.push({ left: b.right + gap, right: slot.right }); }
                }
                slots = cut;
            }
            for (s = 0; s < slots.length && next < entries.length; s += 1) {
                var text = '', end = next;
                while (end < entries.length) {
                    var candidate = text ? text + ' · ' + entries[end] : entries[end];
                    if (ctx.measureText(candidate).width > slots[s].right - slots[s].left) { break; }
                    text = candidate; end += 1;
                }
                if (end > next) { lines.push({ text: text, x: slots[s].left, y: y }); next = end; }
            }
        }
        // Very small or unusually crowded stages may have no complete slot.
        // Never paint half a key or cover a live button with canvas text.
        if (next === entries.length) {
            for (i = 0; i < lines.length; i += 1) { ctx.fillText(lines[i].text, lines[i].x, lines[i].y); }
        }
        ctx.restore();
    }

    function draw() {
        if (mobileHost) {
            if (document.hidden || mobileRendering || !shouldShowHd() || typeof mobileHost.render !== 'function') { return; }
            mobileRendering = true;
            try {
                var payload = JSON.parse(JSON.stringify(debugSnapshot()));
                payload.terrainSnapshot = state.terrain ? Object.assign({}, state.terrain,
                    { tiles: (state.terrain.tiles || []).slice() }) : null;
                mobileHost.render(payload);
            }
            finally { mobileRendering = false; }
            return;
        }
        if (document.hidden) { return; }
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
        var cw = boardW / cols;
        var ch = boardH / rows;
        var ox = pad;
        var oy = 72;
        var r;
        var c;
        var terrainPainted = global.BayeHdBattleTerrain && global.BayeHdBattleTerrain.paint(ctx,
            { ox: ox, oy: oy, cw: cw, ch: ch, cols: cols, rows: rows, viewOx: viewOx, viewOy: viewOy, dpr: dpr },
            state.terrain);
        if (!terrainPainted) {
            for (r = 0; r < rows; r++) {
                for (c = 0; c < cols; c++) {
                    ctx.fillStyle = (r + c) % 2 ? '#1a2030' : '#161b26';
                    ctx.fillRect(ox + c * cw, oy + r * ch, cw + 0.5, ch + 0.5);
                }
            }
        }
        ctx.globalAlpha = 1;
        // One owned input snapshot governs the range, its legend, focus status,
        // and target preview; native reports cannot leave old actionable wash.
        var visualSnap = inputSnapshot(), feedback = rangeFeedback(visualSnap);
        if (global.BayeHdBattleFeedback) {
            global.BayeHdBattleFeedback.paint(ctx,
                { ox: ox, oy: oy, cw: cw, ch: ch, cols: cols, rows: rows, viewOx: viewOx, viewOy: viewOy }, feedback);
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
        if (!feedback.active && state.focus.x != null && state.focus.y != null) {
            ctx.strokeStyle = '#f0c75a';
            ctx.lineWidth = 3;
            ctx.strokeRect(
                ox + (state.focus.x - viewOx) * cw + 2,
                oy + (state.focus.y - viewOy) * ch + 2,
                cw - 4, ch - 4
            );
        }
        var targetPreview = global.BayeHdBattleFeedback ? null : aimPreview(visualSnap);
        var actorMenu = (visualSnap.kind === INPUT.ACTION || visualSnap.kind === INPUT.SKILL) && menuSnapshot(visualSnap);
        if (feedback.active && feedback.kind !== 'move' && feedback.focus && feedback.focus.targetIndex != null) {
            var previewActor = actorUnit(visualSnap.actor), previewTarget = unitAt(feedback.focus.x, feedback.focus.y);
            if (previewActor && previewTarget) { targetPreview = { actor: previewActor, target: previewTarget,
                label: feedback.kind === 'skill' ? '射程内目标' : '攻击目标' }; }
        }
        if (targetPreview && targetPreview.actor !== targetPreview.target &&
            targetPreview.actor.x != null && targetPreview.actor.y != null) {
            ctx.strokeStyle = 'rgba(255,207,116,0.92)';
            ctx.lineWidth = 3;
            ctx.setLineDash([9, 7]);
            ctx.beginPath();
            ctx.moveTo(ox + (targetPreview.actor.x - viewOx + 0.5) * cw,
                oy + (targetPreview.actor.y - viewOy + 0.5) * ch);
            ctx.lineTo(ox + (targetPreview.target.x - viewOx + 0.5) * cw,
                oy + (targetPreview.target.y - viewOy + 0.5) * ch);
            ctx.stroke();
            ctx.setLineDash([]);
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
            var size = Math.min(cw, ch), flagW = size * 0.58, flagH = size * 0.44;
            var isActor = u.i === visualSnap.actor && selectable(u) &&
                ((feedback.active && feedback.actorValid) || !!actorMenu);
            var spent = u.active === 1, ready = selectable(u);
            var focused = u.x === state.focus.x && u.y === state.focus.y;
            // Pennants carry the engine's effective arm type. Unknown types
            // retain a generic unit mark so missing data never hides a general.
            ctx.globalAlpha = spent && !isActor ? 0.58 : 1;
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fillRect(ux - flagW / 2 + 3, uy - flagH / 2 + 4, flagW, flagH);
            ctx.beginPath();
            ctx.moveTo(ux - flagW / 2, uy - flagH / 2);
            ctx.lineTo(ux + flagW / 2, uy - flagH / 2);
            ctx.lineTo(ux + flagW / 2, uy + flagH * 0.32);
            ctx.lineTo(ux, uy + flagH / 2);
            ctx.lineTo(ux - flagW / 2, uy + flagH * 0.32);
            ctx.closePath();
            ctx.fillStyle = u.side === 'player' ? '#275f9d' : '#983d40';
            ctx.fill();
            ctx.strokeStyle = isActor || focused ? '#f0c75a' : (ready ? '#a1d4ff' : '#c3a4a4');
            ctx.lineWidth = isActor || focused ? 3 : 1.5;
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff2d7';
            ctx.font = '700 ' + Math.max(9, Math.min(30, flagH * 0.64)) + 'px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.fillText(ARM_GLYPHS[u.armType] || '兵', ux, uy + flagH * 0.17);
            var badge = spent ? '已' : (isActor ? '行' : (ready ? '待' :
                (u.state != null && u.state !== 0 ? (UNIT_STATES[u.state] || '?').charAt(0) : '')));
            if (badge) {
                ctx.font = '700 ' + Math.max(10, Math.min(14, size * 0.18)) + 'px BayeUI, sans-serif';
                ctx.fillStyle = isActor ? '#f0c75a' : '#d2dae6';
                ctx.fillText(badge, ux + flagW * 0.68, uy + flagH * 0.12);
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = focused || isActor ? '#ffe1a0' : '#f4f7fb';
            ctx.font = '600 ' + Math.max(9, Math.min(17, size * 0.15)) + 'px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.fillText(u.name || ('#' + u.i), ux, uy - size * 0.29, cw - 8);
            ctx.fillStyle = spent ? '#a0a8b5' : '#e0e6ef';
            ctx.font = Math.max(9, Math.min(15, size * 0.14)) + 'px BayeUI, sans-serif';
            ctx.fillText(u.arms == null ? '兵 —' : '兵 ' + u.arms, ux, uy + size * 0.39, cw - 8);
        }
        drawUnitLegend(ctx, canvas, oy + rows * ch, ox);
        var focusUnit = visualSnap.focus && unitAt(visualSnap.focus.x, visualSnap.focus.y);
        if (!state.preview && visualSnap.focus) {
            var focusedTerrain = terrainAt(visualSnap.focus.x, visualSnap.focus.y);
            ctx.fillStyle = 'rgba(15,20,29,0.94)';
            ctx.fillRect(ox + 650, focusUnit ? DESIGN_H - 78 : DESIGN_H - 52, boardW - 650, 25);
            ctx.textAlign = 'right'; ctx.fillStyle = '#e2d8ba';
            ctx.font = '19px BayeUI, "Noto Sans CJK SC", sans-serif';
            var terrainText = '地形：' + focusedTerrain.label + ' · 位置 ' + focusedTerrain.x + ',' + focusedTerrain.y;
            if (focusedTerrain.kind === 'unknown' && focusedTerrain.raw != null) { terrainText += ' · 图块 ' + focusedTerrain.raw; }
            ctx.fillText(terrainText, ox + boardW - 8, focusUnit ? DESIGN_H - 59 : DESIGN_H - 33, boardW - 666);
        }
        if (!state.preview && focusUnit) {
            ctx.fillStyle = 'rgba(15,20,29,0.94)';
            ctx.fillRect(ox + 650, DESIGN_H - 52, boardW - 650, 30);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#e9d7ad';
            ctx.font = '17px BayeUI, "Noto Sans CJK SC", sans-serif';
            ctx.fillText((targetPreview ? targetPreview.label + '：' : '') + unitDetails(focusUnit),
                ox + boardW - 8, DESIGN_H - 31, boardW - 666);
        }
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
        cancel: cancelInput, handleKey: handleKey, returnFromHelp: returnFromHelp, viewKey: viewKey,
        onRetreatBlocked: function () { state.fightTip = '撤退操作未被引擎接受。'; applyChrome(); },
        debugBoxSlow: function () { return { supported: false }; },
        debugPreview: function () { return enterBattle({ preview: true, hook: 'debugPreview' }); },
        start: start, applyPcPage: start, debugSnapshot: debugSnapshot,
        configureMobileHost: configureMobileHost,
        applyMobilePage: function (options) { configureMobileHost(options); start(); },
        getInputTicket: getInputTicket, retireInteraction: retireInteraction,
        getLcdPresentation: getLcdPresentation, setShowLcd: setShowLcd
    };
})(window);
