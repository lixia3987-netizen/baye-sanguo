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
        // Opt-in diagnostics only retain primitive observations from the real
        // input checks. They never resample native state or authorize input.
        var traceLimit = 12, traceCount = 0, traces = [], lastTrace = {};
        function tracing() { try { return environment.BAYE_HD_MOBILE_SYSTEM_DIAGNOSTICS === true; } catch (e) { return false; } }
        function traceText(value) { return typeof value === 'string' ? value.slice(0, 96) : null; }
        function keySummary(ticket) {
            if (!ticket) { return null; }
            var key = ticket.key, hash = 2166136261;
            for (var i = 0; i < key.length; i++) { hash = Math.imul(hash ^ key.charCodeAt(i), 16777619); }
            return {keyHash: ('00000000' + (hash >>> 0).toString(16)).slice(-8), keyLength: key.length,
                type: ticket.owner.type, screen: ticket.owner.screen, seq: ticket.owner.seq, index: ticket.owner.index,
                generation: ticket.identity.generation, movieActive: ticket.raw.g_hdMovieActive, speActive: ticket.raw.g_hdSpeActive};
        }
        function gestureSummary(value) {
            return value ? {kind: value.kind, pointerId: value.id == null ? null : value.id,
                targetId: value.target.id || '', owner: keySummary(value.owner), rect: value.rect ? value.rect.slice() : null} : null;
        }
        function trace(type, reason, event, hit, probe) {
            if (!tracing()) { return; }
            try {
                var entry = {number: ++traceCount, type: type, reason: traceText(reason), at: Date.now(), mode: last.mode,
                    targetId: traceText(hit && hit.target.id || event && event.target && event.target.id || ''), kind: hit && hit.kind || null,
                    trusted: event ? event.isTrusted === true : null, primary: event ? event.isPrimary === true : null,
                    pointerId: event && uint(event.pointerId) ? event.pointerId : null, detail: event && uint(event.detail) ? event.detail : null,
                    blocked: blocked, pointerIDs: Object.keys(pointers).slice(0, 10), pointerCount: Object.keys(pointers).length,
                    arm: gestureSummary(arm), grant: gestureSummary(grant), checks: probe || null,
                    hidden: !!doc().hidden, viewport: [environment.innerWidth, environment.innerHeight],
                    fontsStatus: doc().fonts ? traceText(doc().fonts.status) : null};
                traces.push(entry); if (traces.length > traceLimit) { traces.shift(); }
                if (['down', 'up', 'click', 'retire'].indexOf(type) >= 0) { lastTrace[type] = entry; }
            } catch (e) { /* A diagnostic failure must not affect the input path. */ }
        }
        function debugSnapshot() {
            if (!tracing()) { return last; }
            var diagnostics = {enabled: true, limit: traceLimit, total: traceCount, observationsOnly: true,
                arm: gestureSummary(arm), grant: gestureSummary(grant), blocked: blocked,
                pointerIDs: Object.keys(pointers).slice(0, 10), pointerCount: Object.keys(pointers).length,
                last: lastTrace, events: traces};
            // No ticket.data, DOM node or mutable internal diagnostic object is exposed.
            return Object.assign({}, last, {diagnostics: JSON.parse(signature(diagnostics))});
        }
        function failed(ok, reason, probe, field) {
            if (tracing()) { probe[field || reason] = !!ok; }
            if (!ok) { probe.reason = reason; }
            return !ok;
        }
        function ownerMatches(expected, current, probe) {
            if (tracing()) {
                probe.expectedOwner = keySummary(expected); probe.currentOwner = keySummary(current);
                probe.dataSame = !!expected && !!current && expected.data === current.data;
                probe.keySame = !!expected && !!current && expected.key === current.key;
            }
            return same(expected, current);
        }
        function ownerReason(expected, current) {
            return !current ? 'current-owner-unavailable' : !expected ? 'expected-owner-unavailable'
                : expected.data !== current.data ? 'owner-data-changed' : 'owner-key-changed';
        }
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
        function retire(reason, close, probe, event) {
            trace('retire', reason, event, null, probe);
            arm = grant = null;
            var s = shared(); if (s && s.retireInteraction) { s.retireInteraction(reason, {keepShell: close !== true}); }
        }
        function refresh() {
            if (reading) { return last; }
            reading = true;
            try {
                var ticket = readInputTicket(), s = shared(), probe = {};
                if (arm && !ownerMatches(arm.owner, actionTicket(arm.kind), probe)) { retire('owner-changed', true, probe); }
                probe = {};
                if (grant && !ownerMatches(grant.owner, actionTicket(grant.kind), probe)) { retire('owner-changed', true, probe); }
                if (s && s.refresh) { s.refresh(); }
                var next = readInputTicket();
                probe = {};
                if ((ticket || next) && !ownerMatches(ticket, next, probe)) { retire('torn-owner', true, probe); ticket = next; }
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
        function rendered(hit, ticket, probe) {
            if (hit.kind === 'mode' || hit.kind === 'open') { return true; }
            var binding = hit.kind === 'choose' ? hit.target._bayeMobileSystemTicket : node('hd-system-ui-list')._bayeMobileSystemTicket;
            if (probe && tracing()) { probe.renderDataSame = !!binding && binding.data === ticket.data; probe.renderKeySame = !!binding && binding.key === ticket.key; }
            return same(binding, ticket);
        }
        function rect(target) { var r = target.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, environment.innerWidth, environment.innerHeight]; }
        function visible(target, event, probe) {
            function finish(value, reason) {
                if (probe && tracing()) { probe.visible = value; probe.visibilityReason = reason; }
                return value;
            }
            if (!target) { return finish(false, 'no-target'); }
            if (target.disabled) { return finish(false, 'target-disabled'); }
            if (target.isConnected === false || !target.getBoundingClientRect) { return finish(false, 'target-detached'); }
            var r = target.getBoundingClientRect(), x = event.clientX, y = event.clientY;
            if (probe && tracing()) { probe.hitRect = [r.left, r.top, r.width, r.height]; probe.point = [x, y]; }
            if (![r.left, r.top, r.width, r.height, x, y].every(function (n) { return typeof n === 'number' && isFinite(n); })) { return finish(false, 'geometry-invalid'); }
            if (r.width < 44 || r.height < 44) { return finish(false, 'target-too-small'); }
            if (x < r.left || y < r.top || x >= r.left + r.width || y >= r.top + r.height) { return finish(false, 'outside-target'); }
            var current = target;
            while (current && current.nodeType === 1) {
                if (current.hidden) { return finish(false, 'ancestor-hidden'); }
                var style = environment.getComputedStyle && environment.getComputedStyle(current);
                if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) { return finish(false, 'ancestor-style-hidden'); }
                current = current.parentElement || current.parentNode;
            }
            var top = doc().elementFromPoint && doc().elementFromPoint(x, y);
            var unobstructed = !doc().elementFromPoint || top === target || target.contains && target.contains(top);
            return finish(unobstructed, unobstructed ? 'hit-tested' : 'target-covered');
        }
        function stop(event) { event.preventDefault(); if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); } else { event.stopPropagation(); } }
        function down(event) {
            if (event.isTrusted !== true) { var untrusted = action(event.target); if (untrusted) { trace('down', 'untrusted', event, untrusted); stop(event); } return; }
            pointers[event.pointerId] = true; grant = null;
            if (Object.keys(pointers).length > 1 || event.isPrimary === false) { blocked = true; retire('multiple-pointers'); }
            var hit = action(event.target);
            if (!hit) { return; }
            var ticket = actionTicket(hit.kind), currentTicket, probe = {};
            if (failed(!blocked, 'blocked', probe, 'notBlocked') || failed(event.isPrimary === true, 'not-primary', probe, 'primary') ||
                failed(uint(event.pointerId), 'invalid-pointer-id', probe, 'pointerIdValid') ||
                failed(!(event.button != null && event.button !== 0), 'wrong-button', probe, 'buttonValid') ||
                failed(visible(hit.target, event, probe), 'not-visible', probe) || failed(!!ticket, 'owner-unavailable', probe, 'ownerAvailable') ||
                failed(rendered(hit, ticket, probe), 'stale-render', probe, 'rendered') ||
                failed(ownerMatches(ticket, (currentTicket = actionTicket(hit.kind)), probe), ownerReason(ticket, currentTicket), probe, 'ownerSame')) {
                trace('down', probe.reason, event, hit, probe); stop(event); return;
            }
            arm = {target: hit.target, kind: hit.kind, owner: ticket, id: event.pointerId,
                x: event.clientX, y: event.clientY, rect: rect(hit.target)};
            trace('down', 'armed', event, hit, probe);
        }
        function move(event) {
            var probe = {}, currentRect, currentTicket;
            if (arm && arm.id === event.pointerId && (
                failed(!(Math.hypot(event.clientX - arm.x, event.clientY - arm.y) > 10), 'moved-too-far', probe, 'movementValid') ||
                failed(signature(arm.rect) === signature(currentRect = rect(arm.target)), 'geometry-changed', probe, 'geometrySame') ||
                failed(ownerMatches(arm.owner, (currentTicket = actionTicket(arm.kind)), probe), ownerReason(arm.owner, currentTicket), probe, 'ownerSame'))) {
                if (tracing()) { probe.currentRect = currentRect || null; }
                retire('drag-or-owner-change', false, probe, event);
            }
        }
        function up(event) {
            var current = arm, hit = action(event.target), probe = {}, currentRect, currentTicket; arm = null;
            if (tracing()) { probe.expectedRect = current ? current.rect.slice() : null; }
            if (!(failed(!!current, 'no-arm', probe, 'hadArm') || failed(current.id === event.pointerId, 'pointer-id-changed', probe, 'pointerIdSame') ||
                failed(event.isTrusted === true, 'untrusted', probe, 'trusted') || failed(event.isPrimary === true, 'not-primary', probe, 'primary') ||
                failed(!blocked, 'blocked', probe, 'notBlocked') || failed(!!hit, 'no-action', probe, 'hasAction') ||
                failed(hit.target === current.target, 'target-changed', probe, 'targetSame') || failed(hit.kind === current.kind, 'action-changed', probe, 'kindSame') ||
                failed(visible(hit.target, event, probe), 'not-visible', probe) ||
                failed(Math.hypot(event.clientX - current.x, event.clientY - current.y) <= 10, 'moved-too-far', probe, 'movementValid') ||
                failed(signature(current.rect) === signature(currentRect = rect(current.target)), 'geometry-changed', probe, 'geometrySame') ||
                failed(ownerMatches(current.owner, (currentTicket = actionTicket(current.kind)), probe), ownerReason(current.owner, currentTicket), probe, 'ownerSame') ||
                failed(rendered(hit, current.owner, probe), 'stale-render', probe, 'rendered'))) {
                grant = {target: current.target, kind: current.kind, owner: current.owner, at: Date.now()};
            }
            if (tracing()) { probe.currentRect = currentRect || null; }
            if (current || hit) { trace('up', probe.reason || 'grant-created', event, hit, probe); }
            delete pointers[event.pointerId]; if (!Object.keys(pointers).length) { blocked = false; }
        }
        function cancel(event) { retire('pointer-cancel', false, null, event); delete pointers[event.pointerId]; if (!Object.keys(pointers).length) { blocked = false; } }
        function click(event) {
            var hit = action(event.target); if (!hit) { return; }
            stop(event); var current = grant, currentTicket, probe = {}; grant = null;
            if (failed(!!current, 'no-grant', probe, 'hadGrant') || failed(event.isTrusted === true, 'untrusted', probe, 'trusted') ||
                failed(event.detail !== 0, 'keyboard-click', probe, 'detailValid') || failed(!blocked, 'blocked', probe, 'notBlocked') ||
                failed(current.target === hit.target, 'target-changed', probe, 'targetSame') || failed(current.kind === hit.kind, 'action-changed', probe, 'kindSame') ||
                failed(!(Date.now() - current.at > 1000), 'grant-expired', probe, 'ageValid') || failed(visible(hit.target, event, probe), 'not-visible', probe) ||
                failed(ownerMatches(current.owner, (currentTicket = actionTicket(hit.kind)), probe), ownerReason(current.owner, currentTicket), probe, 'ownerSame') ||
                failed(rendered(hit, current.owner, probe), 'stale-render', probe, 'rendered')) { trace('click', probe.reason, event, hit, probe); return; }
            trace('click', 'authorized', event, hit, probe);
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
        return {init: init, refresh: refresh, snapshot: function () { return last; }, debugSnapshot: debugSnapshot,
            readInputTicket: readInputTicket, retireInteraction: boundary};
    }
    var controller = createController(global);
    global.BayeHdMobileSystem = {createController: createController, init: controller.init, refresh: controller.refresh,
        snapshot: controller.snapshot, debugSnapshot: controller.debugSnapshot, readInputTicket: controller.readInputTicket,
        retireInteraction: controller.retireInteraction};
})(window);
