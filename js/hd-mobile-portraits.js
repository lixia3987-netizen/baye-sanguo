/** Read-only mobile portrait presentation for current native city/report owners. */
(function (global) {
    'use strict';
    var SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
    var NativePromise = (async function () { return null; })().constructor;
    var FENCE = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdMapInputSeq', 'g_hdMapPick', 'g_hdMapCity',
        'g_hdBattlePick', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex',
        'g_hdMarchPhase', 'g_hdMarchSession', 'g_hdMarchInputSeq', 'g_hdReportActive', 'g_hdReportSeq',
        'g_hdReportInputSeq', 'g_hdReportKind', 'g_hdReportPerson', 'g_hdQtyActive', 'g_hdQtySession',
        'g_hdQtyInputSeq', 'g_hdQtyValue', 'g_hdQtyMin', 'g_hdQtyMax', 'g_hdQtyReady', 'g_hdHelpActive', 'g_hdHelpSeq', 'g_hdHelpInputSeq'];
    var BLOCKERS = ['g_hdFightActive', 'g_hdRecordActive', 'g_hdMovieActive', 'g_hdSpeActive', 'g_hdSkillActive',
        'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdMiniMapActive', 'g_hdViewActive',
        'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];
    function uint(value, max) {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= 0 && value <= max;
    }
    function createController(environment) {
        var mounted = false, busy = false, timer = null, focused = true, pageActive = true;
        var manifestApi = null, manifestStatus = 'unrequested', manifestEpoch = 0, manifestEntries = Object.create(null);
        var requestSeq = 0, current = null, phase = 'idle', sourceMode = 'none', sourceUrl = '', reason = 'not-initialized';
        var fallback = null, oldSlot = null, image = null, lastError = '';
        function documentNow() { return environment.document; }
        function node(id) { var d = documentNow(); return d && d.getElementById ? d.getElementById(id) : null; }
        function host() { return environment.BayeHdMobileCity; }
        function available() {
            var d = documentNow(), body = d && d.body;
            if (!mounted || !pageActive || !focused || !d || d.hidden || !body || !body.classList ||
                !body.classList.contains('hd-mobile-page') || body.getAttribute('data-hd-portrait-manual') !== '1') { return false; }
            return typeof environment.matchMedia === 'function'
                ? environment.matchMedia('(orientation: landscape)').matches === true
                : Number(environment.innerWidth) > Number(environment.innerHeight);
        }
        function identity() {
            var api = environment.BayeHdLibIdentity;
            if (!api || typeof api.read !== 'function' || typeof api.isCurrent !== 'function') { return null; }
            var value = api.read();
            return value && value.status === 'ready' && value.sha256 === SHA && value.byteLength === 207195 &&
                uint(value.generation, 0xffffffff) && value.generation > 0 && api.isCurrent(value) === true ? value : null;
        }
        function nativePerson(kind, ticket, data, count) {
            var native = ticket.native, raw = native && native.raw, metadata = ticket.ticket;
            if (!raw || !FENCE.concat(BLOCKERS).every(function (field) {
                return uint(raw[field], 0xffffffff) && raw[field] === data[field];
            }) || raw.g_hdEngineReady !== 1 || raw.g_hdDetailGeneration < 1 || raw.g_hdMapInputSeq < 1 ||
                !BLOCKERS.every(function (field) { return raw[field] === 0; }) || raw.g_hdQtyActive !== 0 ||
                raw.g_hdHelpActive !== 0 || raw.g_hdBattlePick !== 0 || !uint(raw.g_hdMapCity, 38) || raw.g_hdMapCity < 1) { return null; }
            if (kind === 'city') {
                var menu = native.menu;
                var cityIndex = raw.g_hdMarchPhase > 0 && raw.g_hdMarchSession > 0 ? data.g_hdMarchOrigin : raw.g_hdMapCity - 1;
                if (!uint(cityIndex, 37) || metadata.ownerType !== 'city' || metadata.cityIndex !== cityIndex ||
                    !menu || metadata.menuContext !== menu.context || metadata.menuKind !== menu.kind ||
                    metadata.menuSeq !== menu.seq || metadata.detailGeneration !== menu.detailGeneration ||
                    metadata.session !== raw.g_hdMarchSession || metadata.inputSeq !== raw.g_hdMarchInputSeq ||
                    raw.g_hdReportActive !== 0 || menu.active !== 1 || menu.context !== 1 || menu.kind !== 3 ||
                    menu.idsValid !== true || !uint(menu.count, 2000) || menu.count < 1 || !uint(menu.index, menu.count - 1) ||
                    !uint(menu.seq, 65535) || menu.seq < 1 || !uint(menu.generation, 0xffffffff) || menu.generation < 1 ||
                    menu.generation !== menu.detailGeneration || menu.detailGeneration !== raw.g_hdDetailGeneration ||
                    menu.active !== raw.g_hdMenuActive || menu.context !== raw.g_hdMenuContext || menu.kind !== raw.g_hdMenuKind ||
                    menu.seq !== raw.g_hdMenuSeq || menu.count !== raw.g_hdMenuCount || menu.index !== raw.g_hdMenuIndex ||
                    !Array.isArray(menu.ids) || menu.ids.length !== menu.count || !Array.isArray(menu.names) || menu.names.length !== menu.count ||
                    !menu.ids.every(function (id) { return uint(id, count - 1); }) ||
                    !menu.names.every(function (name) { return typeof name === 'string' && name.trim().length > 0; })) { return null; }
                return {personId: menu.ids[menu.index], nativeName: menu.names[menu.index].trim(),
                    stamp: JSON.stringify([menu.active, menu.context, menu.kind, menu.seq, menu.generation,
                        menu.detailGeneration, menu.count, menu.index, menu.ids, menu.names,
                        metadata.key, metadata.libraryGeneration, metadata.ownerType, cityIndex, metadata.session, metadata.inputSeq])};
            }
            // Native report tickets publish only key, generation and owner type.
            // Report seq/input/person/text are independently bound below, not invented metadata fields.
            var report = native.report;
            if (metadata.ownerType !== 'report' || !report || report.active !== 1 || report.kind !== 2 || !uint(report.person, count - 1) ||
                !uint(report.seq, 0xffffffff) || report.seq < 1 || !uint(report.inputSeq, 0xffffffff) || report.inputSeq < 1 ||
                typeof report.text !== 'string' || !report.text.trim() || raw.g_hdReportActive !== 1 ||
                report.seq !== raw.g_hdReportSeq || report.inputSeq !== raw.g_hdReportInputSeq ||
                report.kind !== raw.g_hdReportKind || report.person !== raw.g_hdReportPerson) { return null; }
            return {personId: report.person, nativeName: '', stamp: JSON.stringify([report.active, report.kind,
                report.person, report.seq, report.inputSeq, report.text, metadata.key, metadata.libraryGeneration, metadata.ownerType])};
        }
        function readOne() {
            try {
                if (!available()) { return null; }
                var before = identity(), baye = environment.baye, hd = baye && baye.hd, h = host(), city = environment.BayeHdCityMenu;
                var mode = city && typeof city.getMode === 'function' ? city.getMode() : null;
                if ((mode !== 'auto' && mode !== 'hd') || !before || !hd || typeof hd.ready !== 'function' || hd.ready() !== true || !baye.data ||
                    !h || typeof h.readInputTicket !== 'function' || typeof baye.getPersonCount !== 'function') { return null; }
                var data = baye.data, period = data.g_PIdx;
                if (!uint(period, 4) || period < 1) { return null; }
                var ticket = h.readInputTicket('dialog'), kind = 'dialog';
                if (!ticket) { ticket = h.readInputTicket('city'); kind = 'city'; }
                if (!ticket || ticket.kind !== kind || ticket.data !== data || typeof ticket.key !== 'string' || !ticket.key ||
                    !ticket.ticket || ticket.ticket.libraryGeneration !== before.generation ||
                    ticket.ticket.ownerType !== (kind === 'city' ? 'city' : 'report') ||
                    typeof ticket.ticket.key !== 'string' || !ticket.ticket.key) { return null; }
                var count = baye.getPersonCount();
                if (!uint(count, 65534) || count < 1) { return null; }
                var person = nativePerson(kind, ticket, data, count), after = identity();
                if (!person || !available() || baye.data !== data || hd.ready() !== true || data.g_PIdx !== period ||
                    !after || before.generation !== after.generation || !environment.BayeHdLibIdentity.isCurrent(before) ||
                    city !== environment.BayeHdCityMenu || city.getMode() !== mode) { return null; }
                return {kind: kind, data: data, key: ticket.key, period: period, personId: person.personId,
                    nativeName: person.nativeName, count: count, generation: before.generation,
                    stamp: person.stamp, identity: before, mode: mode};
            } catch (e) { return null; }
        }
        function same(a, b) {
            return !!a && !!b && a.data === b.data && a.kind === b.kind && a.key === b.key && a.period === b.period &&
                a.personId === b.personId && a.count === b.count && a.generation === b.generation && a.stamp === b.stamp && a.mode === b.mode;
        }
        function view() {
            var before = readOne();
            if (!before) { return null; }
            try {
                var baye = environment.baye;
                if (!baye || typeof baye.getPersonName !== 'function') { return null; }
                var name = baye.getPersonName(before.personId), after = readOne();
                if (typeof name !== 'string' || !name.trim() || !same(before, after) ||
                    before.kind === 'city' && name.trim() !== before.nativeName) { return null; }
                after.name = name.trim();
                return after;
            } catch (e) { return null; }
        }
        function sameView(a, b) { return same(a, b) && a.name === b.name; }
        function still(viewBefore) { var latest = view(); return sameView(viewBefore, latest) ? latest : null; }
        function hideImage() {
            var figure = node('hd-mobile-portrait'), img = node('hd-mobile-portrait-img'), cap = node('hd-mobile-portrait-cap');
            if (oldSlot) { oldSlot.hidden = true; oldSlot = null; }
            if (figure) { figure.hidden = true; figure.setAttribute('data-hd-portrait', 'off'); }
            if (img) { img.onload = null; img.onerror = null; img.removeAttribute('src'); img.alt = ''; }
            if (cap) { cap.textContent = ''; }
            image = null;
        }
        function clearOwnFallback() {
            var old = fallback; fallback = null;
            if (old) {
                try { var h = host(); if (h && typeof h.clearLcdFallback === 'function') { h.clearLcdFallback(old.handle); } }
                catch (e) { lastError = 'fallback-clear-failed'; }
            }
        }
        function retire(why) {
            requestSeq += 1; clearOwnFallback(); hideImage(); current = null;
            phase = 'idle'; sourceMode = 'none'; sourceUrl = ''; reason = why || 'owner-unavailable';
        }
        function snapshot() {
            return Object.freeze({initialized: mounted, available: available(), context: current ? current.kind : null,
                personId: current ? current.personId : null, period: current ? current.period : null,
                libraryGeneration: current ? current.generation : null, ownerKey: current ? current.key : '',
                sourceMode: sourceMode, sourceUrl: sourceUrl, visible: phase === 'painted',
                pending: phase === 'source-pending' || phase === 'image-pending' || phase === 'slot-pending' || manifestStatus === 'loading',
                manifestStatus: manifestStatus, fallbackActive: !!fallback, reason: reason,
                requestSeq: requestSeq, error: lastError});
        }
        function fallbackOwner(v) { return {kind: v.kind, data: v.data, key: v.key, period: v.period, personId: v.personId}; }
        function useLcd(v, why) {
            var latest = still(v);
            if (!latest || !sameView(current, latest)) { retire('owner-changed'); return; }
            hideImage(); sourceMode = 'lcd'; sourceUrl = ''; phase = 'lcd'; reason = why;
            if (fallback && sameView(fallback.view, latest)) { return; }
            clearOwnFallback();
            try {
                var h = host(), handle = h && typeof h.requestLcdFallback === 'function'
                    ? h.requestLcdFallback(fallbackOwner(latest), why) : null;
                if (!handle) { reason = 'lcd-fallback-unavailable'; return; }
                if (!still(latest)) {
                    if (typeof h.clearLcdFallback === 'function') { h.clearLcdFallback(handle); }
                    retire('owner-changed'); return;
                }
                fallback = {handle: handle, view: latest};
            } catch (e) { reason = 'lcd-fallback-unavailable'; lastError = 'fallback-request-failed'; }
        }
        function slotFor(v) {
            if (v.kind === 'dialog') { return node('hd-dialog-portrait'); }
            var pane = node('hd-city-menu-person-details');
            return pane && !pane.hidden ? node('hd-city-menu-person-portrait') : null;
        }
        function validSourceUrl(url) {
            if (typeof url !== 'string' || url.indexOf('assets/hd-portraits/') !== 0) { return false; }
            try {
                var decoded = decodeURIComponent(url);
                return decoded.indexOf('assets/hd-portraits/') === 0 && /\.png$/.test(decoded) &&
                    !/[\\:?#]/.test(decoded) && decoded.split('/').every(function (part) { return part && part !== '.' && part !== '..'; });
            } catch (e) { return false; }
        }
        function validSource(src, v) {
            if (!src || (src.mode !== 'hd' && src.mode !== 'ref') || !validSourceUrl(src.url) || !src.entry ||
                src.entry.period !== v.period || src.entry.personId !== v.personId || src.preview === true) { return false; }
            var known = manifestEntries[v.period + ':' + v.personId];
            if (src.mode === 'hd') { return !!known && src.url === 'assets/hd-portraits/' + known.hd; }
            return typeof src.entry.ref === 'string' && src.entry.ref.indexOf('refs/') === 0 &&
                src.url === 'assets/hd-portraits/' + src.entry.ref && (!known || known.ref === src.entry.ref);
        }
        function referenceSource(src, v) {
            var known = manifestEntries[v.period + ':' + v.personId];
            if (src.mode !== 'hd' || !known || !src.entry || known.ref !== src.entry.ref ||
                typeof known.ref !== 'string' || known.ref.indexOf('refs/') !== 0) { return null; }
            var ref = {mode: 'ref', url: 'assets/hd-portraits/' + known.ref, entry: known, preview: false};
            return validSource(ref, v) ? ref : null;
        }
        function currentImageSource(img, url) {
            if (img.getAttribute('src') !== url) { return false; }
            if (typeof img.currentSrc !== 'string' || !img.currentSrc) { return true; }
            try {
                var Url = environment.URL, base = documentNow().baseURI;
                return typeof Url === 'function' && img.currentSrc === new Url(url, base).href && img.currentSrc === img.src;
            } catch (e) { return false; }
        }
        function loadImage(v, src, seq) {
            var latest = still(v), figure = node('hd-mobile-portrait'), img = node('hd-mobile-portrait-img');
            if (seq !== requestSeq || !latest || !sameView(current, latest)) { return; }
            if (!figure || !img || !node('hd-mobile-portrait-cap')) { useLcd(latest, 'portrait-dom-unavailable'); return; }
            hideImage(); phase = 'image-pending'; reason = 'image-pending'; image = {seq: seq, url: src.url};
            function active() { return seq === requestSeq && image && image.seq === seq && image.url === src.url && still(v); }
            function failed(why) {
                var now = active();
                if (!now || !sameView(current, now)) { return; }
                var ref = referenceSource(src, now);
                if (ref) { sourceMode = 'ref'; sourceUrl = ref.url; loadImage(now, ref, seq); }
                else { useLcd(now, why); }
            }
            img.onload = function () {
                var now = active();
                if (!now || !sameView(current, now)) { return; }
                if (!currentImageSource(img, src.url) || !uint(img.naturalWidth, 0xffffffff) || img.naturalWidth < 1 ||
                    !uint(img.naturalHeight, 0xffffffff) || img.naturalHeight < 1) { failed('portrait-image-invalid'); return; }
                var slot = slotFor(now), cap = node('hd-mobile-portrait-cap');
                if (!slot || !cap) { hideImage(); phase = 'slot-pending'; reason = 'slot-pending'; return; }
                // Moving a figure is presentation only; no native owner or preference is retired.
                if (figure.parentNode !== slot) { slot.appendChild(figure); }
                if (!still(now)) { retire('owner-changed'); return; }
                clearOwnFallback();
                if (!still(now) || seq !== requestSeq) { retire('owner-changed'); return; }
                oldSlot = slot; slot.hidden = false; figure.hidden = false;
                figure.setAttribute('data-hd-portrait', src.mode); figure.setAttribute('data-context', now.kind);
                figure.setAttribute('data-person-id', String(now.personId)); figure.setAttribute('data-period', String(now.period));
                img.alt = now.name; cap.textContent = now.name;
                phase = 'painted'; reason = ''; sourceMode = src.mode; sourceUrl = src.url;
            };
            img.onerror = function () { failed('portrait-image-error'); };
            img.src = src.url;
        }
        function requestSource(v) {
            var seq = ++requestSeq, api = environment.BayeHdPortraits;
            phase = 'source-pending'; sourceMode = 'none'; sourceUrl = ''; reason = 'source-pending';
            var pending;
            try { pending = api.chooseSource(v.personId, v.period); }
            catch (e) { useLcd(v, 'portrait-source-error'); return; }
            NativePromise.resolve(pending).then(function (src) {
                if (seq !== requestSeq) { return; }
                var latest = still(v);
                if (!latest || !sameView(current, latest)) { retire('owner-changed'); return; }
                if (src && src.mode === 'lcd') { useLcd(latest, 'portrait-sources-missing'); return; }
                if (!validSource(src, latest)) { useLcd(latest, 'portrait-source-invalid'); return; }
                sourceMode = src.mode; sourceUrl = src.url; loadImage(latest, src, seq);
            }, function () { if (seq === requestSeq) { useLcd(v, 'portrait-source-error'); } });
        }
        function ensureManifest() {
            var api = environment.BayeHdPortraits;
            if (!api || typeof api.loadManifest !== 'function' || typeof api.chooseSource !== 'function') { return; }
            if (manifestApi === api && manifestStatus !== 'unrequested') { return; }
            if (manifestApi && manifestApi !== api) { retire('source-api-changed'); }
            manifestApi = api; manifestEntries = Object.create(null); manifestStatus = 'loading'; var epoch = ++manifestEpoch, pending;
            try { pending = api.loadManifest(); }
            catch (e) { manifestStatus = 'error'; return; }
            NativePromise.resolve(pending).then(function (manifest) {
                if (epoch !== manifestEpoch || api !== environment.BayeHdPortraits) { return; }
                manifestStatus = manifest && manifest.libSha256 === SHA && Array.isArray(manifest.entries) ? 'ready' : 'unsupported';
                if (manifestStatus === 'ready') {
                    manifest.entries.forEach(function (entry) {
                        if (entry && entry.missing !== true && uint(entry.period, 4) && entry.period > 0 && uint(entry.personId, 65533)) {
                            manifestEntries[entry.period + ':' + entry.personId] = entry;
                        }
                    });
                }
                refresh();
            }, function () { if (epoch === manifestEpoch) { manifestStatus = 'error'; refresh(); } });
        }
        function refresh() {
            if (busy) { return snapshot(); }
            busy = true;
            try {
                if (!mounted) { return snapshot(); }
                ensureManifest(); var next = view();
                if (!next) { retire(!available() ? 'page-boundary' : 'owner-unavailable'); return snapshot(); }
                if (!sameView(current, next)) {
                    retire('owner-changed'); current = next;
                }
                if (manifestStatus === 'unrequested' || manifestStatus === 'loading') {
                    phase = 'source-pending'; reason = 'manifest-pending'; return snapshot();
                }
                if (manifestStatus !== 'ready') { useLcd(next, 'portrait-manifest-unavailable'); return snapshot(); }
                if (phase === 'lcd') { if (!fallback) { useLcd(next, reason || 'portrait-sources-missing'); } return snapshot(); }
                if (phase === 'source-pending' && reason !== 'manifest-pending' || phase === 'image-pending' || phase === 'painted') { return snapshot(); }
                if (!slotFor(next)) { phase = 'slot-pending'; reason = 'slot-pending'; return snapshot(); }
                requestSource(next); return snapshot();
            } catch (e) { lastError = 'portrait-read-failed'; retire('read-failed'); return snapshot(); }
            finally { busy = false; }
        }
        function stopTimer() { if (timer !== null) { environment.clearInterval(timer); timer = null; } }
        function startTimer() { if (available() && timer === null) { timer = environment.setInterval(refresh, 80); } }
        function boundary(why) { stopTimer(); retire(why); if (available()) { refresh(); startTimer(); } }
        function init() {
            if (mounted) { return refresh(); }
            mounted = true; var d = documentNow();
            if (d && d.addEventListener) {
                d.addEventListener('visibilitychange', function () { boundary('visibility'); });
                d.addEventListener('click', function (event) {
                    var target = event && event.target;
                    if (target && target.id === 'hd-mobile-menu-mode') { NativePromise.resolve().then(function () { boundary('mode-change'); }); }
                });
            }
            if (environment.addEventListener) {
                environment.addEventListener('resize', function () { boundary('resize'); });
                environment.addEventListener('orientationchange', function () { boundary('orientation'); });
                environment.addEventListener('blur', function () { focused = false; boundary('blur'); });
                environment.addEventListener('focus', function () { focused = true; boundary('focus'); });
                environment.addEventListener('pagehide', function () { pageActive = false; boundary('pagehide'); });
                environment.addEventListener('pageshow', function () { pageActive = true; boundary('pageshow'); });
            }
            var identityApi = environment.BayeHdLibIdentity;
            if (identityApi && typeof identityApi.subscribe === 'function') { identityApi.subscribe(function () { boundary('library-change'); }); }
            ensureManifest(); refresh(); startTimer(); return snapshot();
        }
        return {init: init, refresh: refresh, debugSnapshot: snapshot};
    }
    var controller = createController(global);
    global.BayeHdMobilePortraits = {createController: createController, init: controller.init,
        refresh: controller.refresh, debugSnapshot: controller.debugSnapshot};
})(window);
