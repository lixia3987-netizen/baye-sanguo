(function (global) {
    'use strict';
    var ORIGINAL_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var FIELDS = ['protocolVersion', 'active', 'seq', 'generation', 'outcome', 'winner', 'text', 'value'];
    var BLOCKERS = ['g_hdMenuActive', 'g_hdReportActive', 'g_hdRecordActive', 'g_hdQtyActive',
        'g_hdHelpActive', 'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdMovieActive', 'g_hdSpeActive',
        'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdResultOwnerKind',
        'g_hdResultOwnerValid', 'g_hdMapPick', 'g_hdBattlePick'];
    var FENCES = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdMenuSeq', 'g_hdReportSeq',
        'g_hdRecordSeq', 'g_hdMapInputSeq', 'g_hdFightInputSeq', 'g_hdFightActive', 'g_hdFightOver', 'g_hdFightInputKind', 'g_FgtOver'];
    var WEATHER = ['', '晴', '阴', '风', '雨', '冰雹'];
    // These are fixed, local graphics. Native text is only assigned to textContent.
    // In particular weather 5 is round hail, never a snowflake/snow forecast.
    var CLOUD = '<path d="M30 78C13 78 11 52 29 48C31 24 65 19 77 40C98 32 117 48 114 65C113 74 106 78 97 78Z" fill="currentColor"/>';
    var ICONS = [null,
        '<circle cx="64" cy="64" r="24" fill="currentColor"/><path d="M64 12V25M64 103V116M12 64H25M103 64H116M27 27L36 36M92 92L101 101M27 101L36 92M92 36L101 27" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
        '<path d="M19 91C4 88 4 65 20 61C22 41 49 35 62 52C78 43 96 55 96 72C97 85 86 92 74 92Z" fill="currentColor" opacity=".45"/>' + CLOUD,
        '<path d="M18 40H80C104 40 104 13 86 17C80 18 78 22 78 26M9 62H102C125 62 123 37 109 39M21 84H70C95 84 96 114 76 110C70 109 68 104 69 99" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
        CLOUD + '<path d="M36 91L29 109M64 91L57 109M92 91L85 109" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
        CLOUD + '<g fill="currentColor"><circle cx="31" cy="102" r="6"/><circle cx="61" cy="94" r="6"/><circle cx="91" cy="103" r="6"/><circle cx="53" cy="116" r="5"/><circle cx="80" cy="119" r="5"/></g>'
    ];
    function uint(value, max) {
        return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= (max == null ? 0xffffffff : max);
    }
    function nativeName(name) { return 'g_hdBattleNote' + name.charAt(0).toUpperCase() + name.slice(1); }
    function createController(environment) {
        var env = environment || global, mounted = false, focused = true, pageActive = true, timer = null, afterInputPending = false;
        var reading = false, readEpoch = 0;
        var last = {active: false, presentation: 'off', reason: 'not-initialized'};
        function doc() { return env.document; }
        function node(id) { return doc() && doc().getElementById(id); }
        function mobile() { return !!(doc() && doc().body && doc().body.classList.contains('hd-mobile-page')); }
        function available() {
            return !!(mounted && doc() && doc().body && !doc().hidden && focused && pageActive &&
                (!mobile() || env.innerWidth > env.innerHeight));
        }
        function effectiveHd() {
            var battle = env.BayeHdBattle, map = env.BayeHdOverworld;
            if (!battle || typeof battle.getMode !== 'function') { return false; }
            var mode = battle.getMode();
            return mode === 'hd' || mode === 'auto' && !!(map && typeof map.getMode === 'function' && map.getMode() === 'hd-map');
        }
        function identity(api, read, current) {
            var value = read.call(api);
            if (!value || value.status !== 'ready' || value.sha256 !== ORIGINAL_SHA || value.byteLength !== 207195 ||
                !uint(value.generation) || !value.generation || current.call(api, value) !== true) { return null; }
            return {generation: value.generation, sha256: value.sha256, byteLength: value.byteLength, status: value.status, source: value};
        }
        function identityKey(value) { return JSON.stringify([value.generation, value.sha256, value.byteLength, value.status]); }
        function sample(data, hd, read) {
            var value = read.call(hd), note = {}, raw = {};
            if (!value || data.g_hdCityInfoActive !== undefined && data.g_hdCityInfoActive !== 0) { return null; }
            for (var i = 0; i < FIELDS.length; i++) {
                var name = FIELDS[i], nativeValue = data[nativeName(name)];
                if (value[name] !== nativeValue || (name === 'text' ? typeof nativeValue !== 'string' : !uint(nativeValue))) { return null; }
                note[name] = nativeValue;
            }
            if (note.protocolVersion !== 1 || note.active !== 1 || !note.seq || !note.generation || note.winner !== 65535 ||
                !(note.outcome === 6 && uint(note.value, 5) && note.value >= 1 && note.text === '' ||
                    note.outcome === 7 && uint(note.value, 65535) && note.text === String(note.value))) { return null; }
            for (var b = 0; b < BLOCKERS.length; b++) {
                var blocker = BLOCKERS[b];
                if (data[blocker] !== 0) { return null; }
                raw[blocker] = 0;
            }
            for (var f = 0; f < FENCES.length; f++) {
                var field = FENCES[f], next = data[field];
                if (!uint(next)) { return null; }
                raw[field] = next;
            }
            // Both displays are native noninteractive waits inside an actual fight.
            if (raw.g_hdEngineReady !== 1 || note.generation !== raw.g_hdDetailGeneration || raw.g_hdFightActive !== 1 ||
                raw.g_hdFightOver !== 0 || raw.g_FgtOver !== 0 || raw.g_hdFightInputKind !== 0 || !raw.g_hdFightInputSeq) { return null; }
            return {note: note, raw: raw};
        }
        function rawMatches(value, data) {
            if (!value || data.g_hdCityInfoActive !== undefined && data.g_hdCityInfoActive !== 0) { return false; }
            return FIELDS.every(function (name) { return data[nativeName(name)] === value.note[name]; }) &&
                BLOCKERS.concat(FENCES).every(function (name) { return data[name] === value.raw[name]; });
        }
        function readCurrent() {
            if (reading) { readEpoch += 1; return null; }
            reading = true;
            var ticket = ++readEpoch;
            try {
                if (!available() || !effectiveHd()) { return null; }
                var baye = env.baye, hd = baye && baye.hd, identityApi = env.BayeHdLibIdentity,
                    battle = env.BayeHdBattle, map = env.BayeHdOverworld, lib = env.dynLib, document = doc();
                if (!hd || !identityApi || typeof identityApi.read !== 'function' || typeof identityApi.isCurrent !== 'function' ||
                    typeof hd.battleNote !== 'function' || typeof hd.ready !== 'function' ||
                    typeof lib !== 'string' || lib.length !== 414390) { return null; }
                var read = hd.battleNote, ready = hd.ready, getData = baye.ensureData, identify = identityApi.read,
                    current = identityApi.isCurrent, battleMode = battle && battle.getMode, mapMode = map && map.getMode;
                var id = identity(identityApi, identify, current);
                if (!id || ready.call(hd) !== true) { return null; }
                var data = typeof getData === 'function' ? getData.call(baye) : baye.data;
                if (!data || baye.data !== data) { return null; }
                var first = sample(data, hd, read), second = sample(data, hd, read), latest = identity(identityApi, identify, current);
                var stillReady = ready.call(hd), shown = available() && effectiveHd();
                if (!first || !second || JSON.stringify(first) !== JSON.stringify(second) || !latest ||
                    identityKey(id) !== identityKey(latest) || identityKey(id) !== identityKey(id.source) ||
                    identityKey(latest) !== identityKey(latest.source) || stillReady !== true || !shown ||
                    env.baye !== baye || baye.data !== data || baye.hd !== hd || baye.ensureData !== getData ||
                    hd.battleNote !== read || hd.ready !== ready || env.BayeHdLibIdentity !== identityApi ||
                    identityApi.read !== identify || identityApi.isCurrent !== current || env.dynLib !== lib ||
                    env.BayeHdBattle !== battle || battle && battle.getMode !== battleMode ||
                    env.BayeHdOverworld !== map || map && map.getMode !== mapMode || doc() !== document ||
                    !available() || ticket !== readEpoch) { return null; }
                // Final getters can run callbacks; re-seal their actual mode and
                // primitive publication after those callbacks, before painting.
                var finalMode = battleMode.call(battle), finalHd = finalMode === 'hd' || finalMode === 'auto' &&
                    typeof mapMode === 'function' && mapMode.call(map) === 'hd-map';
                var finalReady = ready.call(hd), finalAvailable = available();
                if (!finalHd || finalReady !== true || !finalAvailable ||
                    identityKey(id) !== identityKey(id.source) || identityKey(latest) !== identityKey(latest.source) ||
                    env.baye !== baye || baye.data !== data || baye.hd !== hd || env.dynLib !== lib ||
                    env.BayeHdLibIdentity !== identityApi || env.BayeHdBattle !== battle || env.BayeHdOverworld !== map ||
                    baye.ensureData !== getData || hd.battleNote !== read || hd.ready !== ready ||
                    identityApi.read !== identify || identityApi.isCurrent !== current ||
                    battle.getMode !== battleMode || map && map.getMode !== mapMode || doc() !== document ||
                    !rawMatches(second, data) || ticket !== readEpoch) { return null; }
                return {note: second.note, libraryGeneration: latest.generation};
            } catch (error) { return null; }
            finally { reading = false; }
        }
        function paint(value, reason) {
            var root = node('hd-battle-transition'), graphic = node('hd-battle-transition-graphic'),
                label = node('hd-battle-transition-label'), number = node('hd-battle-transition-value'), body = doc() && doc().body;
            var show = !!(value && root && graphic && label && number), weather = show && value.note.outcome === 6;
            if (graphic) { graphic.innerHTML = weather ? '<svg viewBox="0 0 128 128" focusable="false" aria-hidden="true">' + ICONS[value.note.value] + '</svg>' : ''; }
            if (label) { label.textContent = show ? weather ? '天气' : '战斗日' : ''; }
            if (number) { number.textContent = show ? weather ? WEATHER[value.note.value] : '第 ' + value.note.text + ' 天' : ''; }
            if (root) {
                root.hidden = !show;
                root.setAttribute('aria-hidden', show ? 'false' : 'true');
                root.setAttribute('data-kind', show ? weather ? 'weather' : 'day' : '');
                root.setAttribute('data-weather', weather ? String(value.note.value) : '');
            }
            if (body) { body.setAttribute('data-hd-battle-transition', show ? 'hd' : 'off'); }
            last = show ? {active: true, presentation: 'hd', reason: '', seq: value.note.seq,
                generation: value.note.generation, libraryGeneration: value.libraryGeneration, outcome: value.note.outcome,
                value: value.note.value, text: value.note.text} : {active: false, presentation: 'off', reason: reason || 'unavailable'};
            return last;
        }
        function refresh() { return paint(readCurrent(), 'unavailable'); }
        function retire(reason) { return paint(null, reason || 'retired'); }
        function schedule() {
            if (timer !== null) { env.clearTimeout(timer); timer = null; }
            if (!mounted || doc().hidden || !focused || !pageActive) { return; }
            timer = env.setTimeout(function () { timer = null; refresh(); schedule(); }, 80);
        }
        function boundary(reason) { retire(reason); schedule(); }
        function afterInput() {
            if (afterInputPending) { return; }
            afterInputPending = true;
            var reread = function () { afterInputPending = false; refresh(); };
            if (typeof env.queueMicrotask === 'function') { env.queueMicrotask(reread); }
            else { env.setTimeout(reread, 0); }
        }
        function init() {
            if (mounted) { refresh(); return api; }
            if (!doc() || !doc().body) { return api; }
            mounted = true;
            doc().addEventListener('visibilitychange', function () {
                retire('visibility'); if (!doc().hidden) { refresh(); } schedule();
            });
            env.addEventListener('blur', function () { focused = false; boundary('blur'); });
            env.addEventListener('focus', function () { focused = true; refresh(); schedule(); });
            env.addEventListener('pagehide', function () { pageActive = false; boundary('pagehide'); });
            env.addEventListener('pageshow', function () { pageActive = true; refresh(); schedule(); });
            ['resize', 'orientationchange'].forEach(function (event) {
                env.addEventListener(event, function () { boundary(event); refresh(); });
            });
            // Read preferences after the existing handler; never consume an event.
            ['pointerup', 'click', 'keyup'].forEach(function (event) { env.addEventListener(event, afterInput, true); });
            if (env.BayeHdLibIdentity && typeof env.BayeHdLibIdentity.subscribe === 'function') {
                env.BayeHdLibIdentity.subscribe(function () { boundary('library'); refresh(); });
            }
            refresh(); schedule(); return api;
        }
        var api = {init: init, refresh: refresh, onEngineTransition: refresh, retire: retire,
            debugSnapshot: function () { return Object.assign({}, last, {mounted: mounted, polling: timer !== null}); }};
        return api;
    }
    var controller = createController(global);
    global.BayeHdBattleTransition = Object.freeze({createController: createController, init: controller.init,
        refresh: controller.refresh, onEngineTransition: controller.onEngineTransition, retire: controller.retire,
        debugSnapshot: controller.debugSnapshot});
})(window);
