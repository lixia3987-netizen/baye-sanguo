/** Mobile host for the real original-game title, system and record selectors.
 * Navigation is forwarded to the shared native ACK selector; no save/world writes.
 */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var TITLE = ['新君登基', '重返沙场', '制作群组', '解甲归田'];
    var PERIODS = ['董卓弄权', '曹操崛起', '赤壁之战', '三国鼎立'];
    var RAW = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdSpeGeneration',
        'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex',
        'g_hdRecordActive', 'g_hdRecordMode', 'g_hdRecordIndex', 'g_hdRecordCount', 'g_hdRecordSeq',
        'g_hdMapPick', 'g_hdBattlePick', 'g_hdMapCity', 'g_hdMapInputSeq', 'g_hdMarchPhase',
        'g_hdReportActive', 'g_hdQtyActive', 'g_hdHelpActive', 'g_hdFightActive',
        'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive', 'g_hdAttackActive', 'g_hdSkillResultActive',
        'g_hdMakerActive', 'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdGoodsActive',
        'g_hdPersonPropertiesActive', 'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];
    var BLOCKERS = ['g_hdBattlePick', 'g_hdReportActive', 'g_hdQtyActive', 'g_hdHelpActive', 'g_hdFightActive',
        'g_hdSkillActive', 'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdViewActive',
        'g_hdMiniMapActive', 'g_hdGoodsActive', 'g_hdPersonPropertiesActive', 'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];
    function uint(n, max) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= (max == null ? 0xffffffff : max); }
    function signature(value) { return JSON.stringify(value); }
    function createController(environment) {
        var mounted = false, reading = false, timer = null, focused = true, pageActive = true;
        var arm = null, grant = null, pointers = Object.create(null), blocked = false, openedMap = null;
        var last = {active: false, available: false, mode: 'hd', screen: '', lcdPresentation: 'off', owner: null, pending: false, reason: 'not-initialized'};
        function doc() { return environment.document; }
        function node(id) { return doc() && doc().getElementById(id); }
        function shared() { return environment.BayeHdSystemUi; }
        function available() {
            return !!(pageActive && focused && doc() && !doc().hidden &&
                (environment.matchMedia ? environment.matchMedia('(orientation: landscape)').matches === true : environment.innerWidth > environment.innerHeight));
        }
        function identity() {
            var api = environment.BayeHdLibIdentity, value = api && api.read && api.read();
            return value && value.status === 'ready' && value.sha256 === SHA && value.byteLength === 207195 &&
                uint(value.generation) && value.generation > 0 && api.isCurrent && api.isCurrent(value) === true
                ? {status: value.status, sha256: value.sha256, byteLength: value.byteLength, generation: value.generation} : null;
        }
        function nativeReading(data, hd, allowMap) {
            var raw = {};
            RAW.forEach(function (name) { raw[name] = data[name]; });
            if (!RAW.every(function (name) { return uint(raw[name]); }) || raw.g_hdEngineReady !== 1 ||
                !raw.g_hdDetailGeneration || !raw.g_hdSpeGeneration || !BLOCKERS.every(function (name) { return raw[name] === 0; }) ||
                [0, 7].indexOf(raw.g_hdMarchPhase) < 0 || raw.g_hdMapCity > 38 ||
                raw.g_hdMovieActive > 1 || raw.g_hdSpeActive > 1) { return null; }
            var owner = null;
            if (raw.g_hdRecordActive === 1 && raw.g_hdMenuActive === 0 && raw.g_hdMapPick === 0 &&
                raw.g_hdMovieActive === 0 && raw.g_hdSpeActive === 0) {
                var record = hd.record && hd.record();
                if (!record || record.active !== 1 || record.mode !== raw.g_hdRecordMode || record.index !== raw.g_hdRecordIndex ||
                    record.count !== raw.g_hdRecordCount || record.seq !== raw.g_hdRecordSeq || !record.seq ||
                    (record.mode !== 1 || record.count !== 3) && (record.mode !== 2 || record.count !== 4) ||
                    !uint(record.index, record.count - 1)) { return null; }
                owner = {type: 'record', screen: 'saveload', seq: record.seq, mode: record.mode, index: record.index, count: record.count, names: []};
            } else if (raw.g_hdMenuActive === 1 && raw.g_hdRecordActive === 0 && raw.g_hdMapPick === 0) {
                var menu = hd.menuItems && hd.menuItems();
                if (!menu || menu.active !== 1 || menu.context !== raw.g_hdMenuContext || menu.kind !== raw.g_hdMenuKind ||
                    menu.seq !== raw.g_hdMenuSeq || !menu.seq || menu.count !== raw.g_hdMenuCount || menu.index !== raw.g_hdMenuIndex ||
                    menu.detailGeneration !== raw.g_hdDetailGeneration || !uint(menu.index, menu.count - 1)) { return null; }
                var screen = menu.context === 4 && menu.kind === 1 ? 'title' : menu.context === 4 && menu.kind === 2 ? 'period'
                    : menu.context === 4 && menu.kind === 3 ? 'king' : menu.context === 2 && menu.kind === 1 ? 'insystem'
                    : menu.context === 2 && menu.kind === 2 ? 'insystem-confirm' : '';
                if (!screen || (screen === 'title' || screen === 'period') && menu.count !== 4 ||
                    screen === 'insystem' && menu.count !== 3 || screen === 'insystem-confirm' && menu.count !== 1 ||
                    screen !== 'title' && screen !== 'period' && (raw.g_hdMovieActive || raw.g_hdSpeActive)) { return null; }
                // GamPicMenu publishes NULL/0 labels for these two original pictorial menus.
                var names = screen === 'title' ? TITLE.slice() : screen === 'period' ? PERIODS.slice() : menu.names && menu.names.slice();
                if (!Array.isArray(names) || names.length !== menu.count || !names.every(function (name) { return typeof name === 'string' && name.trim().length > 0; })) { return null; }
                owner = {type: 'menu', screen: screen, seq: menu.seq, context: menu.context, kind: menu.kind,
                    count: menu.count, index: menu.index, names: names};
                if (screen === 'king') {
                    var kings = hd.kings && hd.kings();
                    if (!kings || !uint(kings.count, 200) || !kings.count || kings.count !== menu.count || kings.index !== menu.index ||
                        !Array.isArray(kings.kings) || kings.kings.length !== menu.count ||
                        !kings.kings.every(function (king, index) { return king && uint(king.id, 199) && typeof king.name === 'string' &&
                            king.name.trim() === names[index].trim(); }) ||
                        new Set(kings.kings.map(function (king) { return king.id; })).size !== menu.count ||
                        kings.currentId !== kings.kings[menu.index].id) { return null; }
                    owner.kings = kings.kings.map(function (king) { return {id: king.id, name: king.name}; });
                    owner.period = data.g_PIdx;
                    if (!uint(owner.period, 4) || owner.period < 1) { return null; }
                }
            } else if (allowMap && raw.g_hdMapPick === 1 && raw.g_hdMapCity >= 1 && raw.g_hdMapInputSeq > 0 &&
                raw.g_hdMenuActive === 0 && raw.g_hdRecordActive === 0 && raw.g_hdMovieActive === 0 && raw.g_hdSpeActive === 0) {
                owner = {type: 'map', screen: 'map', seq: raw.g_hdMapInputSeq, index: raw.g_hdMapCity - 1, count: 38, names: []};
            }
            if (!owner) { return null; }
            var stable = Object.assign({}, owner); delete stable.index;
            owner.stableKey = signature([raw.g_hdDetailGeneration, raw.g_hdSpeGeneration, stable]);
            return {raw: raw, owner: owner};
        }
        function sample(allowMap) {
            if (!available()) { return null; }
            try {
                var first = identity(), baye = environment.baye, hd = baye && baye.hd;
                if (!first || !hd || !hd.ready || hd.ready() !== true) { return null; }
                var data = baye.ensureData ? baye.ensureData() : baye.data;
                if (!data || baye.data !== data) { return null; }
                var before = nativeReading(data, hd, allowMap), after = nativeReading(data, hd, allowMap), latest = identity();
                if (!before || !after || !available() || hd.ready() !== true || baye.data !== data || signature(first) !== signature(latest) ||
                    signature(before) !== signature(after)) { return null; }
                before.owner.stableKey = signature([first, before.owner.stableKey]);
                return {data: data, identity: first, owner: before.owner, raw: before.raw, key: signature([first, before])};
            } catch (e) { return null; }
        }
        function readInputTicket() { return sample(false); }
        function same(a, b) { return !!a && !!b && a.data === b.data && a.key === b.key; }
        function mode() { var s = shared(); return s && s.getMode ? s.getMode() : 'classic'; }
        function paint(show) {
            var ticket = readInputTicket(), active = !!ticket && show === true, state = active ? 'hd' : ticket ? 'lcd' : 'off';
            if (doc().body) { doc().body.setAttribute('data-hd-mobile-system', state); }
            var root = node('hd-system-ui');
            if (root) { root.hidden = !active; }
            var toggle = node('hd-mobile-system-mode'), open = node('hd-mobile-system-open'), map = sample(true);
            if (toggle) { toggle.hidden = !ticket; toggle.disabled = !ticket; toggle.textContent = mode() === 'classic' ? 'HD系统' : '经典系统'; }
            if (open) { open.hidden = !map || map.owner.type !== 'map'; open.disabled = !map || map.owner.type !== 'map' || same(openedMap, map); }
        }
        function retire(reason, close) {
            arm = grant = null;
            var s = shared(); if (s && s.retireInteraction) { s.retireInteraction(reason, {keepShell: close !== true}); }
        }
        function refresh() {
            if (reading) { return last; }
            reading = true;
            try {
                var ticket = readInputTicket(), s = shared();
                if (arm && !same(arm.owner, actionTicket(arm.kind))) { retire('owner-changed', true); }
                if (grant && !same(grant.owner, actionTicket(grant.kind))) { retire('owner-changed', true); }
                if (s && s.refresh) { s.refresh(); }
                var next = readInputTicket();
                if ((ticket || next) && !same(ticket, next)) { retire('torn-owner', true); ticket = next; }
                var active = !!ticket && !!(s && s.isOpen && s.isOpen() && s.shouldShowHd && s.shouldShowHd());
                paint(active);
                if (openedMap && !same(openedMap, sample(true))) { openedMap = null; }
                var snapshot = s && s.debugSnapshot && s.debugSnapshot();
                last = {active: active, available: available() && !!identity(), mode: mode(), screen: ticket ? ticket.owner.screen : '',
                    lcdPresentation: active ? 'hd' : ticket ? 'lcd' : 'off', owner: ticket ? ticket.owner : null,
                    pending: !!(snapshot && snapshot.pending), reason: ticket ? '' : available() ? 'unverified-native' : 'page-boundary'};
                return last;
            } catch (e) {
                retire('read-failed', true);
                last = {active: false, available: false, mode: mode(), screen: '', lcdPresentation: 'off',
                    owner: null, pending: false, reason: 'read-failed'};
                paint(false); return last;
            } finally { reading = false; }
        }
        function action(target) {
            if (target === node('hd-mobile-system-mode')) { return {target: target, kind: 'mode'}; }
            if (target === node('hd-mobile-system-open')) { return {target: target, kind: 'open'}; }
            var root = node('hd-system-ui'), current = target;
            while (current && current !== root) {
                if (current.tagName === 'BUTTON' && (current.getAttribute('data-hd-sys') != null || current.getAttribute('data-hd-sys-back') != null)) {
                    return {target: current, kind: current.getAttribute('data-hd-sys') != null ? 'choose' : 'back'};
                }
                current = current.parentElement || current.parentNode;
            }
            return null;
        }
        function actionTicket(kind) {
            var value = sample(kind === 'open');
            if (!value || kind === 'open' && value.owner.type !== 'map' || kind !== 'mode' && kind !== 'open' &&
                (!shared() || !shared().isOpen() || !shared().shouldShowHd())) { return null; }
            return value;
        }
        function rendered(hit, ticket) {
            if (hit.kind === 'mode' || hit.kind === 'open') { return true; }
            var binding = hit.kind === 'choose' ? hit.target._bayeMobileSystemTicket : node('hd-system-ui-list')._bayeMobileSystemTicket;
            return same(binding, ticket);
        }
        function rect(target) { var r = target.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, environment.innerWidth, environment.innerHeight]; }
        function visible(target, event) {
            if (!target || target.disabled || target.isConnected === false || !target.getBoundingClientRect) { return false; }
            var r = target.getBoundingClientRect(), x = event.clientX, y = event.clientY;
            if (![r.left, r.top, r.width, r.height, x, y].every(function (n) { return typeof n === 'number' && isFinite(n); }) ||
                r.width < 44 || r.height < 44 || x < r.left || y < r.top || x >= r.left + r.width || y >= r.top + r.height) { return false; }
            var current = target;
            while (current && current.nodeType === 1) {
                if (current.hidden) { return false; }
                var style = environment.getComputedStyle && environment.getComputedStyle(current);
                if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) { return false; }
                current = current.parentElement || current.parentNode;
            }
            var top = doc().elementFromPoint && doc().elementFromPoint(x, y);
            return !doc().elementFromPoint || top === target || target.contains && target.contains(top);
        }
        function stop(event) { event.preventDefault(); if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); } else { event.stopPropagation(); } }
        function down(event) {
            if (event.isTrusted !== true) { if (action(event.target)) { stop(event); } return; }
            pointers[event.pointerId] = true; grant = null;
            if (Object.keys(pointers).length > 1 || event.isPrimary === false) { blocked = true; retire('multiple-pointers'); }
            var hit = action(event.target);
            if (!hit) { return; }
            var ticket = actionTicket(hit.kind);
            if (blocked || event.isPrimary !== true || !uint(event.pointerId) || event.button != null && event.button !== 0 ||
                !visible(hit.target, event) || !ticket || !rendered(hit, ticket) || !same(ticket, actionTicket(hit.kind))) { stop(event); return; }
            arm = {target: hit.target, kind: hit.kind, owner: ticket, id: event.pointerId,
                x: event.clientX, y: event.clientY, rect: rect(hit.target)};
        }
        function move(event) {
            if (arm && arm.id === event.pointerId && (Math.hypot(event.clientX - arm.x, event.clientY - arm.y) > 10 ||
                signature(arm.rect) !== signature(rect(arm.target)) || !same(arm.owner, actionTicket(arm.kind)))) { retire('drag-or-owner-change'); }
        }
        function up(event) {
            var current = arm, hit = action(event.target); arm = null;
            if (current && current.id === event.pointerId && event.isTrusted === true && event.isPrimary === true && !blocked &&
                hit && hit.target === current.target && hit.kind === current.kind && visible(hit.target, event) &&
                Math.hypot(event.clientX - current.x, event.clientY - current.y) <= 10 && signature(current.rect) === signature(rect(current.target)) &&
                same(current.owner, actionTicket(current.kind)) && rendered(hit, current.owner)) {
                grant = {target: current.target, kind: current.kind, owner: current.owner, at: Date.now()};
            }
            delete pointers[event.pointerId]; if (!Object.keys(pointers).length) { blocked = false; }
        }
        function cancel(event) { retire('pointer-cancel'); delete pointers[event.pointerId]; if (!Object.keys(pointers).length) { blocked = false; } }
        function click(event) {
            var hit = action(event.target); if (!hit) { return; }
            stop(event); var current = grant; grant = null;
            if (!current || event.isTrusted !== true || event.detail === 0 || blocked || current.target !== hit.target || current.kind !== hit.kind ||
                Date.now() - current.at > 1000 || !visible(hit.target, event) || !same(current.owner, actionTicket(hit.kind)) || !rendered(hit, current.owner)) { return; }
            var s = shared();
            if (hit.kind === 'mode') { retire('mode-change'); s.setMode(mode() === 'classic' ? 'hd' : 'classic'); }
            else if (hit.kind === 'choose') { s.chooseInput(Number(hit.target.getAttribute('data-hd-sys')), current.owner); }
            else if (hit.kind === 'back') { s.backInput(current.owner); }
            else if (hit.kind === 'open' && !same(openedMap, current.owner) && same(current.owner, sample(true))) {
                // EXIT at the real GetCitySet wait opens FunctionMenu. This is
                // not a hook or a synthetic system selector.
                if (environment.mobileTouch && environment.mobileTouch.cancel) { environment.mobileTouch.cancel(); }
                if (!same(current.owner, sample(true))) { return; }
                openedMap = current.owner;
                if (typeof environment.sendKey === 'function') { environment.sendKey(0x28); }
                else if (environment.baye && environment.baye.sendKey) { environment.baye.sendKey(0x28); }
            }
            refresh();
        }
        function boundary(reason) { retire(reason, true); blocked = Object.keys(pointers).length > 0; refresh(); }
        function startTimer() { if (timer === null && available()) { timer = environment.setInterval(refresh, 80); } }
        function stopTimer() { if (timer !== null) { environment.clearInterval(timer); timer = null; } }
        function init() {
            if (mounted) { return refresh(); } mounted = true;
            var s = shared(); if (s && s.applyMobilePage) { s.applyMobilePage({isAvailable: available, readInputTicket: readInputTicket, onPresentation: paint}); }
            ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(function (name, index) {
                doc().addEventListener(name, [down, move, up, cancel][index], true);
            });
            doc().addEventListener('click', click, true);
            doc().addEventListener('scroll', function () { retire('scroll'); }, true);
            doc().addEventListener('keydown', function (event) {
                if (action(event.target) && (event.key === 'Enter' || event.key === ' ')) { stop(event); }
            }, true);
            doc().addEventListener('visibilitychange', function () { stopTimer(); boundary('visibility'); startTimer(); });
            ['resize', 'orientationchange'].forEach(function (name) { environment.addEventListener(name, function () { boundary(name); }); });
            environment.addEventListener('blur', function () { focused = false; stopTimer(); boundary('blur'); });
            environment.addEventListener('focus', function () { focused = true; boundary('focus'); startTimer(); });
            environment.addEventListener('pagehide', function () { pageActive = false; stopTimer(); boundary('pagehide'); });
            environment.addEventListener('pageshow', function () { pageActive = true; boundary('pageshow'); startTimer(); });
            if (environment.visualViewport) { environment.visualViewport.addEventListener('resize', function () { boundary('visual-viewport'); }); }
            var api = environment.BayeHdLibIdentity; if (api && api.subscribe) { api.subscribe(function () { boundary('library-change'); }); }
            startTimer(); return refresh();
        }
        return {init: init, refresh: refresh, snapshot: function () { return last; }, debugSnapshot: function () { return last; },
            readInputTicket: readInputTicket, retireInteraction: boundary};
    }
    var controller = createController(global);
    global.BayeHdMobileSystem = {createController: createController, init: controller.init, refresh: controller.refresh,
        snapshot: controller.snapshot, debugSnapshot: controller.debugSnapshot, readInputTicket: controller.readInputTicket,
        retireInteraction: controller.retireInteraction};
})(window);
