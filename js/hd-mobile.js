/** Read-only mobile HUD for the verified original dictionary game.
 * This header does not provide an HD map, battle UI or input controls.
 */
(function (global) {
    'use strict';
    var LIB_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var LIB_BYTES = 207195, INTERVAL_MS = 80;
    var FIELDS = ['city', 'owner', 'date', 'money', 'food', 'arms'];
    var BLOCKERS = ['g_hdBattlePick', 'g_hdMenuActive', 'g_hdReportActive', 'g_hdQtyActive',
        'g_hdFightActive', 'g_hdHelpActive', 'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive',
        'g_hdSkillActive', 'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive',
        'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdGoodsActive', 'g_hdPersonPropertiesActive',
        'g_hdResultOwnerKind', 'g_hdResultOwnerValid', 'g_hdMarchPhase'];
    var TICKETS = ['g_hdDetailGeneration', 'g_hdSpeGeneration', 'g_hdMapInputSeq',
        'g_hdMenuSeq', 'g_hdReportSeq', 'g_hdReportInputSeq', 'g_hdQtySession', 'g_hdQtyInputSeq',
        'g_hdFightInputSeq', 'g_hdHelpInputSeq', 'g_hdRecordSeq', 'g_hdMarchSession', 'g_hdMarchInputSeq'];

    function integer(value, min, max) {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= min && value <= max;
    }
    function neutral(reason) {
        return Object.freeze({visible: false, status: '原版游戏', reason: reason || 'unavailable',
            cityIndex: null, city: '', owner: '', date: '', money: '', food: '', arms: '', ticket: null});
    }
    function identityAllowed(identity) {
        return !!identity && identity.status === 'ready' && identity.sha256 === LIB_SHA &&
            identity.byteLength === LIB_BYTES && integer(identity.generation, 1, 0xffffffff);
    }
    function equal(a, b) {
        if (!a || !b) { return false; }
        var keys = Object.keys(a), other = Object.keys(b);
        return keys.length === other.length && keys.every(function (key) { return a[key] === b[key]; });
    }
    function mapOwner(owner) {
        return !!owner && owner.g_hdEngineReady === 1 && owner.g_hdMapPick === 1 &&
            integer(owner.g_hdMapCity, 1, 38) && integer(owner.g_hdMapInputSeq, 1, 0xffffffff) &&
            integer(owner.g_hdDetailGeneration, 1, 0xffffffff) && integer(owner.g_hdSpeGeneration, 1, 0xffffffff) &&
            BLOCKERS.every(function (key) { return owner[key] === 0; }) &&
            TICKETS.every(function (key) { return integer(owner[key], 0, 0xffffffff); });
    }
    function fence(data) {
        if (!data) { return null; }
        var owner = {g_hdEngineReady: data.g_hdEngineReady, g_hdMapPick: data.g_hdMapPick, g_hdMapCity: data.g_hdMapCity};
        BLOCKERS.concat(TICKETS).forEach(function (key) { owner[key] = data[key]; });
        return owner;
    }
    function readCity(data, owner) {
        if (!mapOwner(owner) || !data.g_Cities || data.g_Cities.length !== 38 ||
            !integer(data.g_PIdx, 1, 4)) { return null; }
        var city = data.g_Cities[owner.g_hdMapCity - 1];
        if (!city) { return null; }
        return {index: owner.g_hdMapCity - 1, belong: city.Belong, money: city.Money,
            food: city.Food, arms: city.MothballArms, year: data.g_YearDate, month: data.g_MonthDate, period: data.g_PIdx};
    }
    function cityAllowed(city) {
        return !!city && integer(city.index, 0, 37) && integer(city.belong, 0, 200) &&
            integer(city.money, 0, 65535) && integer(city.food, 0, 65535) && integer(city.arms, 0, 65535) &&
            integer(city.year, 0, 65535) && integer(city.month, 1, 12) && integer(city.period, 1, 4);
    }
    function validName(name) {
        return typeof name === 'string' && name.trim().length > 0 && name.trim() !== '-' &&
            name.length <= 64 && !/[\u0000-\u001f\u007f]/.test(name);
    }
    // Pure presentation model. A URL, previous city or preferred LIB is never authority.
    function model(reading) {
        if (!reading || !identityAllowed(reading.identity) || reading.ready !== true ||
            !mapOwner(reading.owner) || !cityAllowed(reading.city) ||
            reading.city.index !== reading.owner.g_hdMapCity - 1 || !validName(reading.cityName) ||
            !validName(reading.ownerName)) { return neutral('unverified-reading'); }
        return Object.freeze({visible: true, status: '原版游戏', reason: '', cityIndex: reading.city.index,
            city: reading.cityName.trim(), owner: reading.ownerName.trim(),
            date: reading.city.year + '年' + reading.city.month + '月', money: String(reading.city.money),
            food: String(reading.city.food), arms: String(reading.city.arms),
            ticket: Object.freeze({libraryGeneration: reading.identity.generation,
                generation: reading.owner.g_hdDetailGeneration, speGeneration: reading.owner.g_hdSpeGeneration,
                mapInputSeq: reading.owner.g_hdMapInputSeq, mapCity: reading.owner.g_hdMapCity})});
    }
    function sample(environment) {
        var doc = environment.document, api = environment.BayeHdLibIdentity, baye = environment.baye;
        if (doc && doc.hidden) { return neutral('hidden'); }
        try {
            if (!api || typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return neutral('identity-unavailable'); }
            var identity = api.read();
            if (!identityAllowed(identity) || !api.isCurrent(identity)) { return neutral('library'); }
            if (!baye || !baye.hd || typeof baye.hd.ready !== 'function' || baye.hd.ready() !== true) { return neutral('not-ready'); }
            var data = typeof baye.ensureData === 'function' ? baye.ensureData() : baye.data;
            var owner = fence(data), city = readCity(data, owner);
            if (!mapOwner(owner) || !cityAllowed(city)) { return neutral('not-map'); }
            function current() {
                var latest = api.read();
                return !(doc && doc.hidden) && equal(identity, latest) && api.isCurrent(identity) &&
                    baye.hd.ready() === true && baye.data === data && equal(owner, fence(data)) &&
                    equal(city, readCity(data, owner));
            }
            if (!current() || typeof baye.getCityName !== 'function') { return neutral('changed'); }
            var cityName = baye.getCityName(city.index);
            if (!current()) { return neutral('changed-city-name'); }
            var ownerName = '无主';
            if (city.belong !== 0) {
                if (!current() || typeof baye.getPersonName !== 'function') { return neutral('changed'); }
                ownerName = baye.getPersonName(city.belong - 1);
                if (!current()) { return neutral('changed-owner-name'); }
            }
            if (!current()) { return neutral('changed'); }
            return model({identity: identity, ready: true, owner: owner, city: city, cityName: cityName, ownerName: ownerName});
        } catch (e) { return neutral('read-failed'); }
    }
    function createController(environment) {
        var mounted = false, timer = null, busy = false, identityApi = null, unsubscribe = null;
        var last = neutral('not-initialized');
        function paint(value) {
            var doc = environment.document;
            if (!doc || typeof doc.getElementById !== 'function') { return; }
            var hud = doc.getElementById('hd-mobile-hud'), status = doc.getElementById('hd-mobile-status');
            if (status) { status.textContent = '原版游戏'; status.hidden = value.visible; }
            if (hud) { hud.hidden = !value.visible; }
            FIELDS.forEach(function (field) {
                var node = doc.getElementById('hd-mobile-' + field);
                if (node) { node.textContent = value.visible ? value[field] : ''; }
            });
        }
        function subscribeIdentity() {
            var api = environment.BayeHdLibIdentity;
            if (identityApi === api) { return; }
            if (unsubscribe) { unsubscribe(); }
            unsubscribe = null; identityApi = api;
            if (api && typeof api.subscribe === 'function') {
                unsubscribe = api.subscribe(function () { if (mounted && !busy) { refresh(); } });
            }
        }
        function refresh() {
            if (busy) { return last; }
            busy = true;
            try {
                if (mounted) { subscribeIdentity(); }
                last = sample(environment); paint(last); return last;
            } finally { busy = false; }
        }
        function stop() {
            if (timer !== null) { environment.clearInterval(timer); timer = null; }
        }
        function start() {
            if (timer === null && !(environment.document && environment.document.hidden)) {
                timer = environment.setInterval(refresh, INTERVAL_MS);
            }
        }
        function visibility() {
            stop(); refresh();
            if (!(environment.document && environment.document.hidden)) { start(); }
        }
        function init() {
            if (mounted) { return refresh(); }
            mounted = true;
            var doc = environment.document;
            if (doc && typeof doc.addEventListener === 'function') { doc.addEventListener('visibilitychange', visibility); }
            refresh(); start(); return last;
        }
        return Object.freeze({init: init, refresh: refresh, snapshot: function () { return last; }});
    }
    var controller = createController(global);
    global.BayeHdMobile = Object.freeze({init: controller.init, refresh: controller.refresh, snapshot: controller.snapshot,
        model: model, sample: sample, createController: createController});
})(window);
