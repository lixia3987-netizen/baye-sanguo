/** Mobile host for the native-owned city/dialog shells. This module never sends engine input. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var RAW = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdMapInputSeq', 'g_hdMapPick', 'g_hdMapCity',
        'g_hdBattlePick', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex',
        'g_hdMarchPhase', 'g_hdMarchSession', 'g_hdMarchInputSeq', 'g_hdReportActive', 'g_hdReportSeq',
        'g_hdReportInputSeq', 'g_hdReportKind', 'g_hdReportPerson', 'g_hdQtyActive', 'g_hdQtySession',
        'g_hdQtyInputSeq', 'g_hdQtyValue', 'g_hdQtyMin', 'g_hdQtyMax', 'g_hdQtyReady', 'g_hdHelpActive', 'g_hdHelpSeq', 'g_hdHelpInputSeq'];
    var BLOCKERS = ['g_hdFightActive', 'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive',
        'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdMiniMapActive', 'g_hdViewActive',
        'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];
    function uint(n, max) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= (max == null ? 0xffffffff : max); }
    function copy(value) {
        var text = JSON.stringify(value, function (key, item) {
            if (typeof item === 'number' && !isFinite(item)) { throw new Error('non-finite snapshot'); }
            return item;
        });
        return text == null ? null : JSON.parse(text);
    }
    function key(value) { return JSON.stringify(value); }
    function createController(environment) {
        var mounted = false, busy = false, timer = null, pageActive = true, pageFocused = true;
        var pointers = Object.create(null), blocked = false, arm = null, grant = null, keyboard = null;
        var lcdFallback = null;
        var previousIdentity = '', last = Object.freeze({active: false, cityVisible: false, dialogVisible: false,
            available: false, mode: 'auto', lcdPresentation: 'passthrough', fallbackActive: false,
            fallbackReason: '', fallbackOwner: null, owner: null, reason: 'not-initialized'});
        function doc() { return environment.document; }
        function node(id) { return doc() && doc().getElementById ? doc().getElementById(id) : null; }
        function city() { return environment.BayeHdCityMenu; }
        function dialog() { return environment.BayeHdDialog; }
        function available() {
            if (!pageActive || !pageFocused || !doc() || doc().hidden) { return false; }
            return typeof environment.matchMedia === 'function'
                ? environment.matchMedia('(orientation: landscape)').matches === true
                : environment.innerWidth > environment.innerHeight;
        }
        function identity() {
            var api = environment.BayeHdLibIdentity;
            if (!api || typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return null; }
            var value = api.read();
            return value && value.status === 'ready' && value.sha256 === SHA && value.byteLength === 207195 &&
                uint(value.generation) && value.generation > 0 && api.isCurrent(value)
                ? {status: value.status, sha256: value.sha256, byteLength: value.byteLength, generation: value.generation} : null;
        }
        function nativeReading(data, hd) {
            var raw = {};
            RAW.concat(BLOCKERS).forEach(function (field) { raw[field] = data[field]; });
            if (!RAW.every(function (field) { return uint(raw[field]); }) ||
                !BLOCKERS.every(function (field) { return raw[field] === 0; }) || raw.g_hdEngineReady !== 1 ||
                !raw.g_hdDetailGeneration || !raw.g_hdMapInputSeq || raw.g_hdMapCity > 38) { return null; }
            if (['menuItems', 'qty', 'report', 'help'].some(function (name) { return typeof hd[name] !== 'function'; })) { return null; }
            var menu = copy(hd.menuItems()), qty = copy(hd.qty()), report = copy(hd.report()), help = copy(hd.help());
            if (!menu || !qty || !report || !help || menu.active !== raw.g_hdMenuActive ||
                qty.active !== raw.g_hdQtyActive || report.active !== raw.g_hdReportActive || help.active !== raw.g_hdHelpActive) { return null; }
            if (menu.active && (menu.context !== raw.g_hdMenuContext || menu.kind !== raw.g_hdMenuKind ||
                menu.seq !== raw.g_hdMenuSeq || menu.detailGeneration !== raw.g_hdDetailGeneration ||
                menu.count !== raw.g_hdMenuCount || menu.index !== raw.g_hdMenuIndex || !Array.isArray(menu.names) ||
                menu.names.length !== menu.count || !uint(menu.index, menu.count - 1) ||
                !menu.names.every(function (name) { return typeof name === 'string' && name.length > 0; }) ||
                ([3, 4].indexOf(menu.kind) >= 0 && (menu.idsValid !== true || !Array.isArray(menu.ids) ||
                    menu.ids.length !== menu.count || !menu.ids.every(function (id) { return uint(id, 65534); }))))) { return null; }
            if (qty.active && (qty.protocol !== true || !qty.session || qty.session !== raw.g_hdQtySession ||
                qty.inputSeq !== raw.g_hdQtyInputSeq || qty.value !== raw.g_hdQtyValue || qty.min !== raw.g_hdQtyMin ||
                qty.max !== raw.g_hdQtyMax || qty.ready !== raw.g_hdQtyReady || qty.min > qty.value || qty.value > qty.max)) { return null; }
            if (report.active && (!report.seq || report.seq !== raw.g_hdReportSeq || report.inputSeq !== raw.g_hdReportInputSeq ||
                report.kind !== raw.g_hdReportKind || report.person !== raw.g_hdReportPerson || typeof report.text !== 'string' || !report.text)) { return null; }
            if (help.active && (help.seq !== raw.g_hdHelpSeq || help.inputSeq !== raw.g_hdHelpInputSeq ||
                help.detailGeneration !== raw.g_hdDetailGeneration)) { return null; }
            return {raw: raw, menu: menu, qty: qty, report: report, help: help};
        }
        function sample() {
            if (!available()) { return null; }
            try {
                var first = identity(), baye = environment.baye, hd = baye && baye.hd;
                if (!first || !hd || typeof hd.ready !== 'function' || hd.ready() !== true) { return null; }
                var data = typeof baye.ensureData === 'function' ? baye.ensureData() : baye.data;
                if (!data) { return null; }
                var before = nativeReading(data, hd), after = nativeReading(data, hd), latest = identity();
                if (!before || !after || !available() || baye.data !== data || hd.ready() !== true ||
                    key(before) !== key(after) || key(first) !== key(latest)) { return null; }
                return {data: data, identity: first, owner: before, key: key([first, before])};
            } catch (e) { return null; }
        }
        function mode() { try { return city() && city().getMode ? city().getMode() : 'auto'; } catch (e) { return 'auto'; } }
        function presentationReading() {
            if (!available()) { return null; }
            try {
                var first = identity(), baye = environment.baye, hd = baye && baye.hd;
                if (!first || !hd || typeof hd.ready !== 'function' || hd.ready() !== true) { return null; }
                var data = typeof baye.ensureData === 'function' ? baye.ensureData() : baye.data, latest = identity();
                return data && baye.data === data && available() && hd.ready() === true && key(first) === key(latest)
                    ? {data: data, identity: first, key: key(first)} : null;
            } catch (e) { return null; }
        }
        function ticketMetadata(ticket, reading) {
            if (!ticket || ticket.data !== reading.data || ticket.libraryGeneration !== reading.identity.generation ||
                typeof ticket.key !== 'string' || !ticket.key || typeof ticket.ownerType !== 'string' || !ticket.ownerType) { return null; }
            var result = {key: ticket.key, libraryGeneration: ticket.libraryGeneration, ownerType: ticket.ownerType};
            ['cityIndex', 'menuContext', 'menuKind', 'menuSeq', 'detailGeneration', 'session', 'inputSeq'].forEach(function (field) {
                if (ticket[field] !== undefined) {
                    if (!uint(ticket[field])) { throw new Error('invalid ticket metadata'); }
                    result[field] = ticket[field];
                }
            });
            return result;
        }
        function inputTicket(kind) {
            try {
                var before = kind === 'mode' ? presentationReading() : sample(), module = kind === 'dialog' ? dialog() : city();
                if (!before) { return null; }
                var ticket = kind === 'mode' ? {key: mode()} : module && typeof module.getInputTicket === 'function' && ticketMetadata(module.getInputTicket(), before);
                if (!ticket || typeof ticket.key !== 'string' || !ticket.key) { return null; }
                var after = kind === 'mode' ? presentationReading() : sample();
                if (!after) { return null; }
                var again = kind === 'mode' ? {key: mode()} : ticketMetadata(module.getInputTicket(), after);
                if (!after || before.data !== after.data || before.key !== after.key || key(ticket) !== key(again)) { return null; }
                return {kind: kind, data: before.data, key: key([kind, before.key, ticket]), native: before.owner, ticket: ticket};
            } catch (e) { return null; }
        }
        function same(a, b) { return !!a && !!b && a.kind === b.kind && a.data === b.data && a.key === b.key; }
        function personReading(kind) {
            if (kind !== 'city' && kind !== 'dialog' || mode() === 'classic') { return null; }
            function person(ticket) {
                if (!ticket || !ticket.native) { return null; }
                var n = ticket.native, pid = null;
                if (kind === 'city' && ticket.ticket.ownerType === 'city' && n.menu.active === 1 &&
                    n.menu.context === 1 && n.menu.kind === 3 && n.menu.idsValid === true &&
                    !n.report.active && !n.qty.active && !n.help.active) { pid = n.menu.ids[n.menu.index]; }
                if (kind === 'dialog' && ticket.ticket.ownerType === 'report' && n.report.active === 1 &&
                    n.report.kind === 2 && !n.menu.active && !n.qty.active && !n.help.active) { pid = n.report.person; }
                return uint(pid, 65534) ? pid : null;
            }
            try {
                var first = inputTicket(kind), period = first && first.data.g_PIdx, pid = person(first);
                if (!first || !uint(period, 4) || period < 1 || pid === null) { return null; }
                var module = kind === 'city' ? city() : dialog();
                if (!module || typeof module.isActive !== 'function' || module.isActive() !== true) { return null; }
                var second = inputTicket(kind), periodAfter = second && second.data.g_PIdx, pidAfter = person(second);
                if (!same(first, second) || period !== periodAfter || pid !== pidAfter || mode() === 'classic' ||
                    module.isActive() !== true) { return null; }
                return {owner: second, period: period, personId: pid};
            } catch (e) { return null; }
        }
        function sameFallback(value, reading) {
            return !!value && !!reading && same(value.owner, reading.owner) &&
                value.period === reading.period && value.personId === reading.personId;
        }
        function retire(reason, force, keepShell) {
            var hadInput = !!(arm || grant || keyboard);
            arm = grant = keyboard = null;
            if (hadInput || force) {
                if (keepShell || lcdFallback) {
                    // Ordinary city retirement also clears its deep owner;
                    // the preserving API rebinds only a fresh identical native
                    // person publication. Never close the report shell here.
                    var shared = city();
                    return !!(shared && typeof shared.retireInputPreservingOwner === 'function' &&
                        shared.retireInputPreservingOwner(reason || 'mobile-boundary') === true);
                }
                [city(), dialog()].forEach(function (module) {
                    if (module && typeof module.retireInteraction === 'function') { module.retireInteraction(reason || 'mobile-boundary'); }
                });
            }
            return false;
        }
        function dropFallback(reason) {
            if (!lcdFallback) { return false; }
            lcdFallback = null;
            retire(reason || 'fallback-retired', true, true);
            return true;
        }
        function requestLcdFallback(owner, reason) {
            if (!mounted || !owner || (owner.kind !== 'city' && owner.kind !== 'dialog')) { return null; }
            var reading = personReading(owner.kind);
            if (!reading || !same(owner, reading.owner) || owner.period !== reading.period || owner.personId !== reading.personId) { return null; }
            if (sameFallback(lcdFallback, reading)) { return lcdFallback.handle; }
            dropFallback('fallback-replaced');
            var preserved = retire('portrait-lcd-fallback', true, true);
            if (owner.kind === 'city' && !preserved) { return null; }
            var after = personReading(owner.kind);
            if (!after || !same(reading.owner, after.owner) || reading.period !== after.period || reading.personId !== after.personId) { return null; }
            var handle = Object.freeze({});
            lcdFallback = {handle: handle, owner: after.owner, period: after.period, personId: after.personId,
                reason: typeof reason === 'string' && reason ? reason.slice(0, 160) : 'portrait-unavailable'};
            refresh(true);
            return lcdFallback && lcdFallback.handle === handle ? handle : null;
        }
        function clearLcdFallback(handle) {
            if (!lcdFallback || handle !== lcdFallback.handle) { return false; }
            var current = personReading(lcdFallback.owner.kind), valid = sameFallback(lcdFallback, current);
            dropFallback(valid ? 'portrait-restored' : 'fallback-owner-changed');
            refresh(true);
            return valid;
        }
        function paint(value) {
            var body = doc() && doc().body;
            if (body && body.classList) {
                body.classList.toggle('hd-mobile-city-on', value.cityVisible);
                body.classList.toggle('hd-mobile-dialog-on', value.dialogVisible);
                body.setAttribute('data-hd-mobile-lcd', value.lcdPresentation);
            }
            var toggle = node('hd-mobile-menu-mode'), exit = node('hd-mobile-exit');
            if (toggle) {
                toggle.textContent = value.mode === 'classic' ? 'HD 菜单' : '经典菜单';
                toggle.setAttribute('aria-pressed', value.mode === 'classic' ? 'false' : 'true');
                toggle.disabled = !value.available;
            }
            if (exit && value.active) { exit.disabled = true; }
        }
        function refresh(keepShell) {
            if (busy) { return last; }
            keepShell = keepShell === true || !!lcdFallback;
            busy = true;
            try {
                var reading = sample(), c = city(), d = dialog(), cityActive = false, dialogActive = false, lcd = 'passthrough';
                if (reading) {
                    cityActive = !!(c && typeof c.isActive === 'function' && c.isActive() === true);
                    dialogActive = !!(d && typeof d.isActive === 'function' && d.isActive() === true);
                    if (dialogActive) {
                        if (typeof d.getLcdPresentation === 'function') { lcd = d.getLcdPresentation(); }
                        else { var detail = typeof d.debugSnapshot === 'function' && d.debugSnapshot(); lcd = detail && detail.showLcd === false ? 'off' : 'on'; }
                    } else if (cityActive && typeof c.getLcdPresentation === 'function') { lcd = c.getLcdPresentation(); }
                    if (['off', 'on', 'passthrough'].indexOf(lcd) < 0) { lcd = 'passthrough'; }
                    var after = sample();
                    if (!after || after.data !== reading.data || after.key !== reading.key) { reading = null; cityActive = dialogActive = false; lcd = 'passthrough'; }
                }
                if (lcdFallback && !sameFallback(lcdFallback, personReading(lcdFallback.owner.kind))) { dropFallback('fallback-owner-changed'); }
                if (lcdFallback) { lcd = 'passthrough'; }
                var presentation = presentationReading(), identityKey = presentation ? key(presentation.identity) : '';
                if (previousIdentity && previousIdentity !== identityKey) { retire('library-or-owner-unavailable', true, keepShell); }
                previousIdentity = identityKey;
                if (arm && !same(arm.owner, inputTicket(arm.kind)) || grant && !same(grant.owner, inputTicket(grant.kind)) ||
                    keyboard && !same(keyboard.owner, inputTicket(keyboard.kind))) { retire('owner-changed', true, keepShell); }
                last = Object.freeze({active: !!reading && (cityActive || dialogActive), cityVisible: !lcdFallback && !!reading && cityActive && !dialogActive && lcd === 'off',
                    dialogVisible: !lcdFallback && !!reading && dialogActive && lcd === 'off', available: !!presentation, mode: mode(), lcdPresentation: lcd,
                    fallbackActive: !!lcdFallback, fallbackReason: lcdFallback ? lcdFallback.reason : '',
                    fallbackOwner: lcdFallback ? {kind: lcdFallback.owner.kind, period: lcdFallback.period, personId: lcdFallback.personId} : null,
                    owner: reading ? reading.owner : null, reason: reading ? '' : !available() ? 'page-boundary' : 'unverified-native'});
                paint(last); return last;
            } catch (e) {
                dropFallback('read-failed'); retire('read-failed', true, keepShell);
                last = Object.freeze({active: false, cityVisible: false, dialogVisible: false, available: false,
                    mode: mode(), lcdPresentation: 'passthrough', fallbackActive: false,
                    fallbackReason: '', fallbackOwner: null, owner: null, reason: 'read-failed'});
                paint(last); return last;
            } finally { busy = false; }
        }
        function action(target) {
            var cityRoot = node('hd-city-menu'), dialogRoot = node('hd-dialog'), toggle = node('hd-mobile-menu-mode');
            if (target === toggle) { return {target: toggle, kind: 'mode'}; }
            var current = target, button = null;
            while (current) {
                if (!button && current.tagName === 'BUTTON') { button = current; }
                if (current === cityRoot || current === dialogRoot) {
                    return button || target === current ? {target: button || current, kind: current === cityRoot ? 'city' : 'dialog'} : null;
                }
                current = current.parentElement || current.parentNode;
            }
            return null;
        }
        function visible(target, event) {
            if (!target || target.disabled || target.isConnected === false || typeof target.getBoundingClientRect !== 'function') { return false; }
            var rect = target.getBoundingClientRect();
            if (!rect || ![rect.left, rect.top, rect.width, rect.height].every(function (n) { return typeof n === 'number' && isFinite(n); }) ||
                rect.width <= 0 || rect.height <= 0) { return false; }
            var x = event ? event.clientX : rect.left + rect.width / 2, y = event ? event.clientY : rect.top + rect.height / 2;
            if (![x, y].every(function (n) { return typeof n === 'number' && isFinite(n); }) ||
                x < rect.left || y < rect.top || x >= rect.left + rect.width || y >= rect.top + rect.height) { return false; }
            var current = target;
            while (current && current.nodeType === 1) {
                if (current.hidden) { return false; }
                if (typeof environment.getComputedStyle === 'function') {
                    var style = environment.getComputedStyle(current);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) { return false; }
                }
                current = current.parentElement || current.parentNode;
            }
            if (typeof doc().elementFromPoint === 'function') {
                var top = doc().elementFromPoint(x, y);
                if (top !== target && !(typeof target.contains === 'function' && target.contains(top))) { return false; }
            }
            return true;
        }
        function geometry(target) {
            var r = target.getBoundingClientRect();
            return [r.left, r.top, r.width, r.height, environment.innerWidth, environment.innerHeight];
        }
        function sameGeometry(before, target) {
            return geometry(target).every(function (n, i) { return typeof n === 'number' && isFinite(n) && Math.abs(n - before[i]) < 0.5; });
        }
        function stopEvent(event) {
            event.preventDefault();
            if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
            else { event.stopPropagation(); }
        }
        function down(event) {
            if (event.isTrusted !== true) { if (action(event.target)) { stopEvent(event); } return; }
            pointers[event.pointerId] = true; grant = null; keyboard = null;
            if (Object.keys(pointers).length > 1 || event.isPrimary === false) { blocked = true; retire('multiple-pointers', true); }
            var hit = action(event.target);
            if (!hit) { return; }
            if (blocked || event.isPrimary !== true || !uint(event.pointerId) || event.button != null && event.button !== 0 || !visible(hit.target, event)) {
                retire('invalid-pointer', false); stopEvent(event); return;
            }
            var owner = inputTicket(hit.kind);
            if (!owner || !same(owner, inputTicket(hit.kind))) { stopEvent(event); return; }
            arm = {kind: hit.kind, target: hit.target, id: event.pointerId, owner: owner,
                x: event.clientX, y: event.clientY, geometry: geometry(hit.target)};
        }
        function move(event) {
            if (!arm || event.pointerId !== arm.id) { return; }
            if (Math.hypot(event.clientX - arm.x, event.clientY - arm.y) > 10 || !sameGeometry(arm.geometry, arm.target) ||
                !same(arm.owner, inputTicket(arm.kind))) { retire('move-or-owner-change', true); }
        }
        function up(event) {
            var current = arm, hit = action(event.target);
            if (current && current.id === event.pointerId) {
                arm = null;
                if (event.isTrusted === true && !blocked && event.isPrimary === true && hit && hit.target === current.target && hit.kind === current.kind &&
                    Math.hypot(event.clientX - current.x, event.clientY - current.y) <= 10 && sameGeometry(current.geometry, current.target) &&
                    visible(current.target, event) && same(current.owner, inputTicket(current.kind))) {
                    grant = {kind: current.kind, target: current.target, owner: current.owner, at: Date.now(), keyboard: false};
                } else { retire('invalid-release', true); }
            }
            delete pointers[event.pointerId];
            if (!Object.keys(pointers).length) { blocked = false; }
        }
        function cancel(event) {
            if (arm && arm.id === event.pointerId || grant) { retire('pointer-cancel', true); }
            delete pointers[event.pointerId];
            if (!Object.keys(pointers).length) { blocked = false; }
        }
        function click(event) {
            var hit = action(event.target);
            if (!hit) { return; }
            var allowed = grant; grant = null;
            if (!allowed || event.isTrusted !== true && !allowed.keyboard || blocked || allowed.target !== hit.target || allowed.kind !== hit.kind || Date.now() - allowed.at > 1000 ||
                (event.detail === 0 && !allowed.keyboard) || !visible(hit.target, allowed.keyboard ? null : event) ||
                !same(allowed.owner, inputTicket(hit.kind))) { stopEvent(event); return; }
            if (hit.kind === 'mode') {
                stopEvent(event); var keepShell = !!lcdFallback; dropFallback('menu-mode-change'); retire('menu-mode-change', true, keepShell);
                var shared = city();
                if (shared && typeof shared.setMode === 'function') { shared.setMode(mode() === 'classic' ? 'hd' : 'classic'); }
                refresh(keepShell);
            }
        }
        function keydown(event) {
            var hit = action(event.target), activation = event.key === 'Enter' || event.key === ' ';
            if (hit && activation) {
                stopEvent(event);
                if (event.isTrusted !== true || event.repeat) { return; }
                var owner = inputTicket(hit.kind);
                keyboard = owner && !blocked && !Object.keys(pointers).length && visible(hit.target) ? {kind: hit.kind, target: hit.target, key: event.key, owner: owner} : null;
                grant = arm = null; return;
            }
            if ((last.cityVisible || last.dialogVisible) && [13, 27, 32, 37, 38, 39, 40, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 70, 72, 83].indexOf(event.keyCode) >= 0) {
                var current = inputTicket(last.dialogVisible ? 'dialog' : 'city');
                if (event.isTrusted !== true || !current || !same(current, inputTicket(current.kind))) { stopEvent(event); }
            }
        }
        function keyup(event) {
            var hit = action(event.target);
            if (!hit || event.key !== 'Enter' && event.key !== ' ') { return; }
            stopEvent(event); var current = keyboard; keyboard = null;
            if (event.isTrusted === true && current && current.key === event.key && current.target === hit.target && !blocked && visible(hit.target) &&
                same(current.owner, inputTicket(current.kind)) && typeof hit.target.click === 'function') {
                grant = {kind: current.kind, target: current.target, owner: current.owner, at: Date.now(), keyboard: true};
                hit.target.click(); grant = null;
            }
        }
        function boundary(reason) {
            var keepShell = !!lcdFallback;
            dropFallback(reason || 'page-boundary'); retire(reason || 'page-boundary', true, keepShell);
            blocked = Object.keys(pointers).length > 0; refresh(keepShell);
        }
        function startTimer() { if (available() && timer === null) { timer = environment.setInterval(refresh, 80); } }
        function stopTimer() { if (timer !== null) { environment.clearInterval(timer); timer = null; } }
        function init() {
            if (mounted) { return refresh(); }
            mounted = true;
            // Capture gates are installed before either shell's keyboard/click listeners.
            var document = doc();
            document.addEventListener('pointerdown', down, true);
            document.addEventListener('pointermove', move, true);
            document.addEventListener('pointerup', up, true);
            document.addEventListener('pointercancel', cancel, true);
            document.addEventListener('lostpointercapture', function (event) { if (arm && arm.id === event.pointerId) { retire('lost-capture', true); } }, true);
            document.addEventListener('scroll', function () { retire('scroll', false); }, true);
            document.addEventListener('click', click, true);
            document.addEventListener('keydown', keydown, true);
            document.addEventListener('keyup', keyup, true);
            document.addEventListener('visibilitychange', function () { stopTimer(); boundary('visibility'); startTimer(); });
            environment.addEventListener('resize', function () { boundary('resize'); });
            environment.addEventListener('orientationchange', function () { boundary('orientation'); });
            environment.addEventListener('blur', function () { pageFocused = false; stopTimer(); boundary('blur'); });
            environment.addEventListener('focus', function () { pageFocused = true; boundary('focus'); startTimer(); });
            environment.addEventListener('pagehide', function () { pageActive = false; stopTimer(); boundary('pagehide'); });
            environment.addEventListener('pageshow', function () { pageActive = true; boundary('pageshow'); startTimer(); });
            if (environment.visualViewport && environment.visualViewport.addEventListener) { environment.visualViewport.addEventListener('resize', function () { boundary('visual-viewport'); }); }
            var c = city(), d = dialog(), options = {isAvailable: available};
            if (c && typeof c.applyMobilePage === 'function') { c.applyMobilePage(options); }
            else if (c && typeof c.configureMobileHost === 'function') { c.configureMobileHost(options); if (typeof c.start === 'function') { c.start(); } }
            if (d && typeof d.configureMobileHost === 'function') { d.configureMobileHost(options); if (typeof d.start === 'function') { d.start(); } }
            var api = environment.BayeHdLibIdentity;
            if (api && typeof api.subscribe === 'function') { api.subscribe(function () { boundary('library-change'); }); }
            refresh(); startTimer(); return last;
        }
        return {init: init, refresh: refresh, snapshot: function () { return last; }, debugSnapshot: function () { return last; },
            isActive: function () { return refresh().active; }, readInputTicket: inputTicket,
            requestLcdFallback: requestLcdFallback, clearLcdFallback: clearLcdFallback,
            retireInteraction: function (reason) { boundary(reason); }};
    }
    var controller = createController(global);
    global.BayeHdMobileCity = {createController: createController, init: controller.init, refresh: controller.refresh,
        snapshot: controller.snapshot, debugSnapshot: controller.debugSnapshot, isActive: controller.isActive,
        readInputTicket: controller.readInputTicket, requestLcdFallback: controller.requestLcdFallback,
        clearLcdFallback: controller.clearLcdFallback, retireInteraction: controller.retireInteraction};
})(window);
