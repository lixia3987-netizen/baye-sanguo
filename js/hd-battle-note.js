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
    var PLACE_LABELS = {attack: '进攻', defense: '守城', occupation: '占领', arrival: '入驻', clash: '交战', result: '战果'};

    function uint(value, max) {
        return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= (max == null ? 0xffffffff : max);
    }
    function battleCity(data) {
        try {
            var params = data.g_FgtParam, cityIndex = params && params.CityIndex;
            return uint(cityIndex, 37) ? cityIndex : null;
        } catch (error) { return null; }
    }
    function isAttackAnnouncement(data) {
        return !!data && data.g_hdBattleNoteActive === 1 && data.g_hdBattleNoteOutcome === 3;
    }
    function resultPlace(data, note, cityIndex, inputSeq, order) {
        if ((note.outcome !== 1 && note.outcome !== 2) || cityIndex === null) { return null; }
        try {
            var king = data.g_PlayerKing, skip = data.g_hdFightSkip;
            if (!uint(king, 199) || note.outcome === 1 && note.winner !== king) { return null; }
            var sameOrder = order && order.cityIndex === cityIndex && order.generation === note.generation;
            // BattleDrv announces each order before GamFight advances the input sequence.
            // A prior order's skip flag can still be present after a real battle.
            if (sameOrder && inputSeq === order.inputSeq) {
                if (note.outcome !== 1 || (skip !== 1 && skip !== 2)) { return null; }
                var cities = data.g_Cities, city = cities && cities[cityIndex];
                return city && city.Belong === king + 1 ? {cityIndex: cityIndex, kind: skip === 1 ? 'occupation' : 'arrival'} : null;
            }
            if ((!sameOrder && skip !== 0) || data.g_FgtOver !== note.outcome || data.g_hdFightOver !== note.outcome) { return null; }
            var params = data.g_FgtParam, mode = params && params.Mode;
            return mode === 0 || mode === 1 ? {cityIndex: cityIndex, kind: mode === 0 ? 'defense' : 'attack'} : null;
        } catch (error) { return null; }
    }
    function noticePlace(data, note, cityIndex, publishedCity, inputSeq, order) {
        if (note.outcome === 4 && publishedCity !== null) { return {cityIndex: publishedCity, kind: 'clash'}; }
        if (note.outcome !== 1 && note.outcome !== 2) { return null; }
        var result = resultPlace(data, note, cityIndex, inputSeq, order);
        return publishedCity !== null && (!result || result.cityIndex !== publishedCity)
            ? {cityIndex: publishedCity, kind: 'result'} : result;
    }
    function resultSummary(data, place) {
        if (place.kind !== 'attack' && place.kind !== 'defense') { return null; }
        try {
            var day = data.g_FgtBoutCnt, limit = data.g_FgtBoutMax, food = data.g_FgtParam.MProvender;
            if (!uint(day, 65535) || !day || !uint(limit, 65535) || !limit || day > limit + 1 || !uint(food, 65535)) { return null; }
            // FgtDealBout increments once more when ending a battle at the time limit.
            return {days: Math.min(day, limit), food: food};
        } catch (error) { return null; }
    }
    function createController(environment) {
        var env = environment || global, mounted = false, focused = true, pageActive = true, timer = null, afterInputPending = false;
        var reading = false, readEpoch = 0, announcedOrder = null;
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
        function preloadIllustration() {
            var atlas = node('hd-battle-note-atlas');
            if (!atlas || atlas.getAttribute('src') !== null || !available() || !effectiveHd()) { return; }
            var source = atlas.getAttribute('data-src'), api = env.BayeHdLibIdentity;
            try {
                if (!source || !api || typeof api.read !== 'function' || typeof api.isCurrent !== 'function' ||
                    !identity(api, api.read, api.isCurrent)) { return; }
                atlas.addEventListener('load', refresh, {once: true});
                atlas.setAttribute('src', source);
            } catch (error) {}
        }
        function sample(data, hd, read, order) {
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
            var publishedCity = value.cityIndex === undefined ? null : value.cityIndex;
            if (publishedCity !== null && (!uint(publishedCity, 37) || note.outcome > 4 ||
                data.g_hdBattleNoteCity !== publishedCity)) { return null; }
            var cityIndex = note.outcome <= 3 ? battleCity(data) : null;
            return {note: note, raw: raw, cityIndex: cityIndex, publishedCity: publishedCity,
                place: noticePlace(data, note, cityIndex, publishedCity, raw.g_hdFightInputSeq, order)};
        }
        function rawMatches(value, data) {
            if (!value || data.g_hdCityInfoActive !== undefined && data.g_hdCityInfoActive !== 0) { return false; }
            return FIELDS.every(function (name) {
                return data['g_hdBattleNote' + name.charAt(0).toUpperCase() + name.slice(1)] === value.note[name];
            }) && BLOCKERS.concat(FENCES).every(function (name) { return data[name] === value.raw[name]; }) &&
                (value.publishedCity === null || data.g_hdBattleNoteCity === value.publishedCity);
        }
        function readCurrent(observeAnnouncement) {
            if (reading) { readEpoch += 1; return null; }
            reading = true;
            var ticket = ++readEpoch;
            try {
                var display = available() && effectiveHd();
                if (!display && (!observeAnnouncement || !mounted)) { return null; }
                var baye = env.baye, hd = baye && baye.hd, identityApi = env.BayeHdLibIdentity,
                    battle = env.BayeHdBattle, map = env.BayeHdOverworld, lib = env.dynLib, document = doc();
                // The native callback can identify the order while the LCD is visible in portrait.
                if (!display && !isAttackAnnouncement(baye && baye.data)) { return null; }
                if (!hd || !identityApi || typeof identityApi.read !== 'function' || typeof identityApi.isCurrent !== 'function' ||
                    typeof hd.battleNote !== 'function' || typeof hd.ready !== 'function' ||
                    typeof lib !== 'string' || lib.length !== 414390) { return null; }
                var read = hd.battleNote, ready = hd.ready, getData = baye.ensureData, identify = identityApi.read,
                    current = identityApi.isCurrent, battleMode = battle && battle.getMode, mapMode = map && map.getMode;
                var id = identity(identityApi, identify, current);
                if (!id || ready.call(hd) !== true) { return null; }
                var data = typeof getData === 'function' ? getData.call(baye) : baye.data;
                if (!data || baye.data !== data) { return null; }
                var order = announcedOrder && announcedOrder.data === data && announcedOrder.libraryGeneration === id.generation ? announcedOrder : null;
                var first = sample(data, hd, read, order);
                var firstSummary = display && !mobile() && node('hd-battle-note-summary') && first && first.place &&
                    first.publishedCity === first.place.cityIndex ? resultSummary(data, first.place) : null;
                var second = sample(data, hd, read, order);
                if (!first || !second || JSON.stringify(first) !== JSON.stringify(second) ||
                    (!display && second.note.outcome !== 3)) { return null; }
                var place = second.place, params = place && data.g_FgtParam, getCityName = place && baye.getCityName, cityName = '';
                if (place && typeof getCityName === 'function') {
                    try {
                        var name = getCityName.call(baye, place.cityIndex);
                        if (typeof name === 'string' && name.length <= 32 && name.indexOf('\u0000') < 0) { cityName = name.trim(); }
                    } catch (error) {}
                }
                var latest = identity(identityApi, identify, current);
                var stillReady = ready.call(hd), displayAvailable = !display || available() && effectiveHd();
                if (!latest ||
                    identityKey(id) !== identityKey(latest) || identityKey(id) !== identityKey(id.source) ||
                    identityKey(latest) !== identityKey(latest.source) || stillReady !== true || !displayAvailable ||
                    env.baye !== baye || baye.data !== data || baye.hd !== hd || baye.ensureData !== getData ||
                    hd.battleNote !== read || hd.ready !== ready || env.BayeHdLibIdentity !== identityApi ||
                    identityApi.read !== identify || identityApi.isCurrent !== current || env.dynLib !== lib ||
                    env.BayeHdBattle !== battle || battle && battle.getMode !== battleMode ||
                    env.BayeHdOverworld !== map || map && map.getMode !== mapMode || doc() !== document ||
                    (display && !available()) || ticket !== readEpoch) { return null; }
                // Reference getters above may change the actual presentation
                // mode or lifecycle without changing the function they return.
                var finalMode = display && battleMode.call(battle), finalHd = !display || finalMode === 'hd' || finalMode === 'auto' &&
                    typeof mapMode === 'function' && mapMode.call(map) === 'hd-map';
                var finalReady = ready.call(hd), finalAvailable = !display || available();
                var finalCity = second.cityIndex === null ? null : battleCity(data), inputSeq = second.raw.g_hdFightInputSeq;
                var location = cityName && baye.getCityName === getCityName &&
                    (second.publishedCity !== null || data.g_FgtParam === params) &&
                    JSON.stringify(noticePlace(data, second.note, finalCity, second.publishedCity, inputSeq, order)) === JSON.stringify(place) ?
                    {cityIndex: place.cityIndex, cityName: cityName, kind: place.kind} : null;
                var summary = location && firstSummary &&
                    JSON.stringify(firstSummary) === JSON.stringify(resultSummary(data, location)) ? firstSummary : null;
                // These callbacks can in turn change native/source values.
                // Keep the primitive publication check after all of them.
                if (!finalHd || finalReady !== true || !finalAvailable ||
                    identityKey(id) !== identityKey(id.source) || identityKey(latest) !== identityKey(latest.source) ||
                    env.baye !== baye || baye.data !== data || baye.hd !== hd || env.dynLib !== lib ||
                    env.BayeHdLibIdentity !== identityApi || env.BayeHdBattle !== battle || env.BayeHdOverworld !== map ||
                    !rawMatches(second, data) || ticket !== readEpoch) { return null; }
                if (second.note.outcome === 3 && finalCity !== null && finalCity === second.cityIndex &&
                    (second.publishedCity === null || second.publishedCity === finalCity) &&
                    (!order || order.seq !== second.note.seq || order.generation !== second.note.generation)) {
                    announcedOrder = {data: data, libraryGeneration: latest.generation, generation: second.note.generation,
                        seq: second.note.seq, cityIndex: finalCity, inputSeq: inputSeq};
                }
                return display ? {data: data, note: second.note, place: location, summary: summary, libraryGeneration: latest.generation} : null;
            } catch (error) { return null; }
            finally { reading = false; }
        }
        function paintSummary(value) {
            var panel = node('hd-battle-note-summary');
            if (!panel || !value && panel.hidden) { return null; }
            var days = node('hd-battle-note-days'), food = node('hd-battle-note-food');
            var visible = !!(value && days && food);
            var daysText = visible ? value.days + ' 天' : '', foodText = visible ? value.food.toLocaleString('zh-CN') : '';
            if (days && days.textContent !== daysText) { days.textContent = daysText; }
            if (food && food.textContent !== foodText) { food.textContent = foodText; }
            panel.hidden = !visible;
            return visible ? value : null;
        }
        function paint(value, reason) {
            var root = node('hd-battle-note'), text = node('hd-battle-note-text'), body = doc() && doc().body;
            var show = !!(value && root && text), place = show && value.place;
            var caption = node('hd-battle-note-place'), message = show ? value.note.text : '';
            var art = node('hd-battle-note-art'), atlas = node('hd-battle-note-atlas');
            if (art) {
                art.hidden = !(show && value.note.outcome <= 4 && atlas && atlas.complete &&
                    atlas.naturalWidth === 1430 && atlas.naturalHeight === 1100);
            }
            if (text && text.textContent !== message) { text.textContent = message; }
            if (caption) {
                var captionText = place ? PLACE_LABELS[place.kind] + ' · ' + place.cityName : '';
                if (caption.textContent !== captionText) { caption.textContent = captionText; }
                caption.hidden = !place;
            }
            var summary = paintSummary(show ? value.summary : null);
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
                outcome: value.note.outcome, winner: value.note.winner, text: value.note.text, place: value.place} :
                {active: false, presentation: 'off', reason: reason || 'unavailable'};
            if (summary) { last.summary = summary; }
            return last;
        }
        function refresh() {
            preloadIllustration();
            return paint(readCurrent(), 'unavailable');
        }
        function onEngineNote() {
            preloadIllustration();
            if (announcedOrder) {
                try {
                    var data = env.baye && env.baye.data;
                    // A new announcement can arrive while HD is off or the page is hidden.
                    if (data !== announcedOrder.data || data.g_hdDetailGeneration !== announcedOrder.generation ||
                        isAttackAnnouncement(data) && data.g_hdBattleNoteSeq !== announcedOrder.seq) {
                        announcedOrder = null;
                    }
                } catch (error) { announcedOrder = null; }
            }
            return paint(readCurrent(true), 'unavailable');
        }
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
        var api = {init: init, refresh: refresh, onEngineNote: onEngineNote, retire: retire,
            debugSnapshot: function () { return Object.assign({}, last, {mounted: mounted, polling: timer !== null}); }};
        return api;
    }
    var controller = createController(global);
    global.BayeHdBattleNote = Object.freeze({createController: createController, init: controller.init,
        refresh: controller.refresh, onEngineNote: controller.onEngineNote, retire: controller.retire,
        debugSnapshot: controller.debugSnapshot});
})(window);
