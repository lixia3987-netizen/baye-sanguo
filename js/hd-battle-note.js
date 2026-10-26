(function (global) {
    'use strict';
    var ORIGINAL_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var FIELDS = ['protocolVersion', 'active', 'seq', 'generation', 'outcome', 'winner', 'text'];
    var BLOCKERS = ['g_hdMenuActive', 'g_hdReportActive', 'g_hdRecordActive', 'g_hdQtyActive',
        'g_hdHelpActive', 'g_hdViewActive', 'g_hdMiniMapActive', 'g_hdMovieActive', 'g_hdSpeActive',
        'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdResultOwnerKind',
        'g_hdResultOwnerValid', 'g_hdMapPick', 'g_hdBattlePick', 'g_hdFightActive'];
    var FENCES = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdMenuSeq', 'g_hdReportSeq',
        'g_hdRecordSeq', 'g_hdMapInputSeq', 'g_hdFightInputSeq'];

    function uint(value, max) {
        return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= (max == null ? 0xffffffff : max);
    }
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
            if (mode === 'hd') { return true; }
            return mode === 'auto' && !!(map && typeof map.getMode === 'function' && map.getMode() === 'hd-map');
        }
        function identity(api, read, current) {
            var value = read.call(api);
            if (!value || value.status !== 'ready' ||
                value.sha256 !== ORIGINAL_SHA || value.byteLength !== 207195 || !uint(value.generation) ||
                !value.generation || current.call(api, value) !== true) { return null; }
            return {generation: value.generation, sha256: value.sha256, byteLength: value.byteLength, status: value.status, source: value};
        }
        function identityKey(value) { return JSON.stringify([value.generation, value.sha256, value.byteLength, value.status]); }
        function sample(data, hd, read) {
            var value = read.call(hd), note = {}, raw = {};
            if (data.g_hdCityInfoActive !== undefined && data.g_hdCityInfoActive !== 0) { return null; }
            if (!value) { return null; }
            for (var i = 0; i < FIELDS.length; i++) {
                var name = FIELDS[i], nativeName = 'g_hdBattleNote' + name.charAt(0).toUpperCase() + name.slice(1);
                var nativeValue = data[nativeName];
                if (value[name] !== nativeValue || (name === 'text' ? typeof nativeValue !== 'string' : !uint(nativeValue))) { return null; }
                note[name] = nativeValue;
            }
            if (note.protocolVersion !== 1 || note.active !== 1 || !note.seq || !note.generation ||
                !uint(note.outcome, 5) || !note.outcome ||
                (note.outcome === 1 ? !uint(note.winner, 199) : note.winner !== 65535) ||
                !note.text.trim() || note.text.length > 512 || note.text.indexOf('\u0000') >= 0) { return null; }
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
            if (raw.g_hdEngineReady !== 1 || note.generation !== raw.g_hdDetailGeneration) { return null; }
            return {note: note, raw: raw};
        }
        function rawMatches(value, data) {
            if (!value || data.g_hdCityInfoActive !== undefined && data.g_hdCityInfoActive !== 0) { return false; }
            return FIELDS.every(function (name) {
                return data['g_hdBattleNote' + name.charAt(0).toUpperCase() + name.slice(1)] === value.note[name];
            }) && BLOCKERS.concat(FENCES).every(function (name) { return data[name] === value.raw[name]; });
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
                // Reference getters above may change the actual presentation
                // mode or lifecycle without changing the function they return.
                var finalMode = battleMode.call(battle), finalHd = finalMode === 'hd' || finalMode === 'auto' &&
                    typeof mapMode === 'function' && mapMode.call(map) === 'hd-map';
                var finalReady = ready.call(hd), finalAvailable = available();
                // These callbacks can in turn change native/source values.
                // Keep the primitive publication check after all of them.
                if (!finalHd || finalReady !== true || !finalAvailable ||
                    identityKey(id) !== identityKey(id.source) || identityKey(latest) !== identityKey(latest.source) ||
                    env.baye !== baye || baye.data !== data || baye.hd !== hd || env.dynLib !== lib ||
                    env.BayeHdLibIdentity !== identityApi || env.BayeHdBattle !== battle || env.BayeHdOverworld !== map ||
                    !rawMatches(second, data) || ticket !== readEpoch) { return null; }
                return {data: data, note: second.note, libraryGeneration: latest.generation};
            } catch (error) { return null; }
            finally { reading = false; }
        }
        function paint(value, reason) {
            var root = node('hd-battle-note'), text = node('hd-battle-note-text'), body = doc() && doc().body;
            var show = !!(value && root && text);
            if (text) { text.textContent = show ? value.note.text : ''; }
            if (root) {
                root.hidden = !show;
                root.setAttribute('aria-hidden', show ? 'false' : 'true');
                root.setAttribute('data-outcome', show ? String(value.note.outcome) : '');
                root.setAttribute('aria-label', show && value.note.outcome === 5 ? '电脑策略预告' : '战事公告');
            }
            if (body) {
                body.setAttribute('data-hd-battle-note', show ? 'hd' : 'off');
                body.setAttribute('data-hd-battle-note-kind', show ? String(value.note.outcome) : '');
            }
            last = show ? {active: true, presentation: 'hd', reason: '', seq: value.note.seq,
                generation: value.note.generation, libraryGeneration: value.libraryGeneration,
                outcome: value.note.outcome, winner: value.note.winner, text: value.note.text} :
                {active: false, presentation: 'off', reason: reason || 'unavailable'};
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
            // Read the public mode after its actual UI handler, even when that
            // handler stops propagation at document. This never handles input.
            ['pointerup', 'click', 'keyup'].forEach(function (event) {
                env.addEventListener(event, afterInput, true);
            });
            if (env.BayeHdLibIdentity && typeof env.BayeHdLibIdentity.subscribe === 'function') {
                env.BayeHdLibIdentity.subscribe(function () { boundary('library'); refresh(); });
            }
            refresh(); schedule(); return api;
        }
        var api = {init: init, refresh: refresh, onEngineNote: refresh, retire: retire,
            debugSnapshot: function () { return Object.assign({}, last, {mounted: mounted, polling: timer !== null}); }};
        return api;
    }
    var controller = createController(global);
    global.BayeHdBattleNote = Object.freeze({createController: createController, init: controller.init,
        refresh: controller.refresh, onEngineNote: controller.onEngineNote, retire: controller.retire,
        debugSnapshot: controller.debugSnapshot});
})(window);
