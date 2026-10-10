/** Mobile host for the shared HD overworld. City/battle rules remain native-owned. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var ZERO = ['g_hdBattlePick', 'g_hdReportActive', 'g_hdQtyActive', 'g_hdFightActive', 'g_hdHelpActive',
        'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive', 'g_hdAttackActive',
        'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdViewActive', 'g_hdMiniMapActive',
        'g_hdGoodsActive', 'g_hdPersonPropertiesActive', 'g_hdResultOwnerKind', 'g_hdResultOwnerValid', 'g_hdMarchPhase'];
    var EXIT_FIELDS = ['g_hdEngineReady', 'g_hdMapPick', 'g_hdMapCity', 'g_hdMapInputSeq',
        'g_hdDetailGeneration', 'g_hdSpeGeneration', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind',
        'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex', 'g_hdReportInputSeq', 'g_hdQtySession',
        'g_hdQtyInputSeq', 'g_hdFightInputSeq', 'g_hdRecordSeq', 'g_hdMarchSession', 'g_hdMarchInputSeq'];
    var MAP_FIELDS = EXIT_FIELDS.concat(['g_hdReportSeq', 'g_hdHelpInputSeq']);
    function integer(n, min, max) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= min && n <= max; }
    function equal(a, b) { return !!a && !!b && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(function (k) { return a[k] === b[k]; }); }
    function createController(environment) {
        var mounted = false, busy = false, timer = null, subscribed = false, arm = null, pendingExit = null;
        var active = false, centeredGeneration = null;
        var last = Object.freeze({active: false, mode: 'classic', landscape: false, cityIndex: null,
            libraryGeneration: null, exitEnabled: false, exitPending: false, reason: 'not-initialized'});
        function doc() { return environment.document; }
        function node(id) { return doc() && doc().getElementById ? doc().getElementById(id) : null; }
        function map() { return environment.BayeHdOverworld; }
        function hidden() { return !!(doc() && doc().hidden); }
        function landscape() {
            if (typeof environment.matchMedia === 'function') { return environment.matchMedia('(orientation: landscape)').matches === true; }
            return environment.innerWidth > environment.innerHeight;
        }
        function mode() { try { return map() && map().getMode() === 'hd-map' ? 'hd-map' : 'classic'; } catch (e) { return 'classic'; } }
        function cancel() {
            arm = null;
            try {
                if (environment.mobileTouch && typeof environment.mobileTouch.cancel === 'function') { environment.mobileTouch.cancel(); }
                var shared = map();
                if (shared && typeof shared.cancelInteraction === 'function') { shared.cancelInteraction(); }
                else if (shared && typeof shared.cancelAlign === 'function') { shared.cancelAlign(); }
                return true;
            } catch (e) { return false; }
        }
        function paint(value, tipText) {
            var layer = node('hd-overworld'), body = doc() && doc().body;
            if (body && body.classList) { body.classList.toggle('hd-mobile-map-on', value.active); }
            if (layer) { layer.hidden = !value.active; }
            var toggle = node('hd-mobile-map-mode'), focus = node('hd-mobile-map-focus'), exit = node('hd-mobile-exit');
            if (toggle) { toggle.textContent = value.mode === 'hd-map' ? '经典地图' : 'HD 地图'; toggle.setAttribute('aria-pressed', value.mode === 'hd-map' ? 'true' : 'false'); }
            if (focus) { focus.disabled = !value.active || !integer(value.cityIndex, 0, 37); }
            if (exit) { exit.disabled = !value.exitEnabled; }
            var tip = node('hd-mobile-map-tip');
            if (tip) { tip.textContent = tipText || '拖动地图 · 点己方城进入 · 道路仅作装饰'; }
        }
        function identity() {
            var api = environment.BayeHdLibIdentity;
            if (!api || typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return null; }
            var value = api.read();
            return value && value.status === 'ready' && value.sha256 === SHA && value.byteLength === 207195 &&
                integer(value.generation, 1, 0xffffffff) && api.isCurrent(value) ? value : null;
        }
        function readExit() {
            if (hidden() || !landscape()) { return null; }
            try {
                // HD status is a local page above the native root menu. Its
                // own back action owns the transition; a header EXIT would
                // otherwise skip that page and leave the city unexpectedly.
                if (environment.BayeHdMobileCity && environment.BayeHdMobileCity.isActive()) { return null; }
                var firstIdentity = identity(), baye = environment.baye;
                if (!firstIdentity || !baye || !baye.hd || typeof baye.hd.ready !== 'function' || baye.hd.ready() !== true) { return null; }
                var data = typeof baye.ensureData === 'function' ? baye.ensureData() : baye.data;
                function readOwner() {
                    if (!data) { return null; }
                    var value = {};
                    ZERO.concat(EXIT_FIELDS).forEach(function (key) { value[key] = data[key]; });
                    return value;
                }
                var owner = readOwner();
                if (!owner || owner.g_hdEngineReady !== 1 || owner.g_hdMapPick !== 0 || owner.g_hdMenuActive !== 1 ||
                    owner.g_hdMenuContext !== 1 || !integer(owner.g_hdMenuKind, 1, 4) ||
                    !integer(owner.g_hdMapCity, 1, 38) || !integer(owner.g_hdMenuSeq, 1, 0xffffffff) ||
                    !integer(owner.g_hdDetailGeneration, 1, 0xffffffff) || !integer(owner.g_hdSpeGeneration, 1, 0xffffffff) ||
                    !integer(owner.g_hdMenuCount, 1, 2000) || !integer(owner.g_hdMenuIndex, 0, owner.g_hdMenuCount - 1) ||
                    !ZERO.every(function (key) { return owner[key] === 0; }) ||
                    !EXIT_FIELDS.every(function (key) { return integer(owner[key], 0, 0xffffffff); })) { return null; }
                if (baye.data !== data || baye.hd.ready() !== true || !equal(owner, readOwner()) ||
                    !equal(firstIdentity, identity())) { return null; }
                return {identity: firstIdentity, owner: owner, data: data};
            } catch (e) { return null; }
        }
        function sameExit(a, b) { return !!a && !!b && a.data === b.data && equal(a.identity, b.identity) && equal(a.owner, b.owner); }
        // GetCitySet remains the MAP owner while its cursor crosses blank ground (mapCity=0).
        // HUD data is a separate, stricter city reading and never authorizes this surface.
        function readMap() {
            if (hidden() || !landscape()) { return null; }
            try {
                var firstIdentity = identity(), baye = environment.baye;
                if (!firstIdentity || !baye || !baye.hd || typeof baye.hd.ready !== 'function' || baye.hd.ready() !== true) { return null; }
                var data = typeof baye.ensureData === 'function' ? baye.ensureData() : baye.data;
                function readOwner() {
                    if (!data) { return null; }
                    var value = {};
                    ZERO.concat(MAP_FIELDS).forEach(function (key) { value[key] = data[key]; });
                    return value;
                }
                var owner = readOwner();
                if (!owner || owner.g_hdEngineReady !== 1 || owner.g_hdMapPick !== 1 || owner.g_hdMenuActive !== 0 ||
                    !integer(owner.g_hdMapCity, 0, 38) || !integer(owner.g_hdMapInputSeq, 1, 0xffffffff) ||
                    !integer(owner.g_hdDetailGeneration, 1, 0xffffffff) || !integer(owner.g_hdSpeGeneration, 1, 0xffffffff) ||
                    !ZERO.every(function (key) { return owner[key] === 0; }) ||
                    !MAP_FIELDS.every(function (key) { return integer(owner[key], 0, 0xffffffff); })) { return null; }
                if (baye.data !== data || baye.hd.ready() !== true || hidden() || !landscape() ||
                    !equal(owner, readOwner()) || !equal(firstIdentity, identity())) { return null; }
                return {identity: firstIdentity, owner: owner, data: data};
            } catch (e) { return null; }
        }
        function sameMap(a, b) { return !!a && !!b && a.data === b.data && equal(a.identity, b.identity) && equal(a.owner, b.owner); }
        function hudMatches(hud, token) {
            if (!hud || !token) { return false; }
            var owner = token.owner;
            if (owner.g_hdMapCity === 0) { return hud.visible === false && hud.cityIndex === null && hud.ticket === null; }
            return hud.visible === true && hud.cityIndex === owner.g_hdMapCity - 1 && equal(hud.ticket, {
                libraryGeneration: token.identity.generation, generation: owner.g_hdDetailGeneration,
                speGeneration: owner.g_hdSpeGeneration, mapInputSeq: owner.g_hdMapInputSeq, mapCity: owner.g_hdMapCity
            });
        }
        function refresh() {
            if (busy) { return last; }
            busy = true;
            try {
                var isLandscape = landscape(), currentMode = mode(), shared = map(), hud = null, sharedState = null, next = false, tipText = '', mapToken = null;
                if (!hidden() && isLandscape && currentMode === 'hd-map' && shared && environment.BayeHdMobile &&
                    typeof environment.BayeHdMobile.refresh === 'function' && typeof shared.debugSnapshot === 'function') {
                    mapToken = readMap();
                    hud = environment.BayeHdMobile.refresh();
                    if (hudMatches(hud, mapToken) && sameMap(mapToken, readMap())) {
                        sharedState = shared.debugSnapshot();
                        var sharedOwnerCurrent = sameMap(mapToken, readMap());
                        if (sharedOwnerCurrent && node('hd-mobile-map-tip') && integer(sharedState.selectedIndex, 0, 37) && typeof shared.getCities === 'function') {
                            var selectedCities = shared.getCities(), selected = selectedCities && selectedCities[sharedState.selectedIndex];
                            if (selected && selected.index === sharedState.selectedIndex && typeof selected.name === 'string' && selected.name && selected.kind !== 'owned') {
                                tipText = selected.name + '不是己方城，请从己方城选择出征';
                            }
                            sharedOwnerCurrent = sameMap(mapToken, readMap());
                        }
                        var again = environment.BayeHdMobile.refresh();
                        next = !!(sharedOwnerCurrent && hudMatches(again, mapToken) && sameMap(mapToken, readMap()) &&
                            sharedState.presentationReady === true &&
                            sharedState.mode === 'hd-map' && sharedState.phase === 'map');
                        hud = again;
                    }
                }
                var exitToken = readExit();
                if (next && !sameMap(mapToken, readMap())) { next = false; }
                if (next !== active && !cancel()) { next = false; }
                active = next;
                if (active && hud && hud.visible && hud.ticket && centeredGeneration !== hud.ticket.libraryGeneration &&
                    typeof shared.centerOnCity === 'function') {
                    shared.centerOnCity(hud.cityIndex);
                    if (sameMap(mapToken, readMap())) { centeredGeneration = hud.ticket.libraryGeneration; }
                    else { cancel(); active = false; }
                }
                if (active && !sameMap(mapToken, readMap())) { cancel(); active = false; }
                if (pendingExit && !sameExit(pendingExit, exitToken)) { pendingExit = null; }
                var canExit = !!exitToken && !pendingExit && environment.VK_EXIT === 0x28 && typeof environment.sendKey === 'function';
                last = Object.freeze({active: active, mode: currentMode, landscape: isLandscape,
                    cityIndex: active && hud && hud.visible ? hud.cityIndex : null,
                    libraryGeneration: active ? mapToken.identity.generation : null,
                    exitEnabled: canExit, exitPending: !!pendingExit,
                    reason: active ? '' : hidden() ? 'hidden' : !isLandscape ? 'portrait' : currentMode === 'classic' ? 'classic' : 'not-current-map'});
                paint(last, active ? tipText : null); return last;
            } catch (e) {
                cancel(); active = false;
                last = Object.freeze({active: false, mode: mode(), landscape: false, cityIndex: null,
                    libraryGeneration: null, exitEnabled: false, exitPending: !!pendingExit, reason: 'read-failed'});
                paint(last); return last;
            } finally { busy = false; }
        }
        function consumeExit(expected) {
            var current = readExit();
            if (pendingExit || !sameExit(expected, current) || environment.VK_EXIT !== 0x28 || typeof environment.sendKey !== 'function') { refresh(); return false; }
            if (!cancel()) { refresh(); return false; }
            // Gesture cancellation can call native touch-cancel; revalidate the owner after it.
            current = readExit();
            if (!sameExit(expected, current)) { refresh(); return false; }
            pendingExit = current;
            environment.sendKey(environment.VK_EXIT);
            refresh(); return true;
        }
        function stop() { if (timer !== null) { environment.clearInterval(timer); timer = null; } }
        function start() { if (!hidden() && timer === null) { timer = environment.setInterval(refresh, 80); } }
        function boundary() { cancel(); refresh(); }
        function visibility() { stop(); boundary(); start(); }
        function bindButtons() {
            var toggle = node('hd-mobile-map-mode'), focus = node('hd-mobile-map-focus'), exit = node('hd-mobile-exit');
            if (toggle) { toggle.addEventListener('click', function (ev) {
                ev.preventDefault(); ev.stopPropagation();
                if (hidden() || !map() || typeof map().setMode !== 'function' || !cancel()) { return; }
                map().setMode(mode() === 'hd-map' ? 'classic' : 'hd-map'); refresh();
            }); }
            if (focus) { focus.addEventListener('click', function (ev) {
                ev.preventDefault(); ev.stopPropagation();
                var current = refresh();
                if (current.active && integer(current.cityIndex, 0, 37) && map() && typeof map().centerOnCity === 'function') { map().centerOnCity(current.cityIndex); }
            }); }
            if (!exit) { return; }
            exit.addEventListener('pointerdown', function (ev) {
                ev.preventDefault(); ev.stopPropagation(); arm = null;
                if (ev.isPrimary !== true || ev.button != null && ev.button !== 0 || pendingExit) { return; }
                var expected = readExit();
                if (expected) { arm = {kind: 'pointer', id: ev.pointerId, expected: expected}; }
            });
            exit.addEventListener('pointerup', function (ev) {
                ev.preventDefault(); ev.stopPropagation();
                var currentArm = arm; arm = null;
                if (currentArm && currentArm.kind === 'pointer' && ev.isPrimary === true && currentArm.id === ev.pointerId) { consumeExit(currentArm.expected); }
            });
            ['pointercancel', 'lostpointercapture'].forEach(function (name) { exit.addEventListener(name, function () { arm = null; }); });
            exit.addEventListener('keydown', function (ev) {
                if (ev.key !== 'Enter' && ev.key !== ' ') { return; }
                ev.preventDefault(); ev.stopPropagation();
                if (!ev.repeat && !pendingExit) { var expected = readExit(); arm = expected ? {kind: 'keyboard', key: ev.key, expected: expected} : null; }
            });
            exit.addEventListener('keyup', function (ev) {
                if (ev.key !== 'Enter' && ev.key !== ' ') { return; }
                ev.preventDefault(); ev.stopPropagation(); var currentArm = arm; arm = null;
                if (currentArm && currentArm.kind === 'keyboard' && currentArm.key === ev.key) { consumeExit(currentArm.expected); }
            });
            // Pointer/keyboard release owns the single EXIT. Never replay its compatibility click.
            exit.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
            if (doc() && doc().addEventListener) { doc().addEventListener('pointerdown', function (ev) {
                if (arm && (arm.kind !== 'pointer' || arm.id !== ev.pointerId)) { arm = null; }
            }, true); }
        }
        function init() {
            if (mounted) { return refresh(); }
            mounted = true;
            var shared = map();
            if (shared && typeof shared.applyMobilePage === 'function') { shared.applyMobilePage(); }
            if (shared && typeof shared.start === 'function') { shared.start(); }
            bindButtons();
            if (doc() && doc().addEventListener) { doc().addEventListener('visibilitychange', visibility); }
            if (environment.addEventListener) {
                environment.addEventListener('resize', boundary); environment.addEventListener('orientationchange', boundary);
                environment.addEventListener('blur', boundary); environment.addEventListener('pagehide', boundary);
            }
            if (environment.visualViewport && environment.visualViewport.addEventListener) { environment.visualViewport.addEventListener('resize', boundary); }
            var api = environment.BayeHdLibIdentity;
            if (!subscribed && api && typeof api.subscribe === 'function') {
                subscribed = true; api.subscribe(function () { boundary(); });
            }
            refresh(); start(); return last;
        }
        return Object.freeze({init: init, refresh: refresh, snapshot: function () { return last; }});
    }
    var controller = createController(global);
    global.BayeHdMobileMap = Object.freeze({init: controller.init, refresh: controller.refresh,
        snapshot: controller.snapshot, createController: createController});
})(window);
