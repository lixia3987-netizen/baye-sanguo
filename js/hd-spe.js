/** Native displayed SPE commits select HD picture slots; the engine owns time. */
(function (global) {
    var W = 160, H = 96, state = { open: false, bound: false, poll: 0, event: '', epoch: 0, skipped: '', scratch: null, hasFlush: false,
        flushW: 0, flushH: 0, flushKey: '', renderKey: '', canvasW: 0, canvasH: 0, scale: 1, source: 'lcd', reason: '', frames: [],
        manifest: null, manifestGeneration: 0, manifestRequested: false, assets: null, cache: [], preparing: false, preparation: null,
        libGeneration: 0, libHash: null, libReason: 'lib-unavailable', returned: '', pressed: null };
    function integer(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
    function el(id) { return document.getElementById(id); }
    function storage(key, fallback) { try {
        return global.localStorage.getItem(key) || fallback;
    }
    catch (e) {
        return fallback;
    } }
    function info() { if (state.preparing) return {}; try {
        if (!(global.baye && baye.hd && baye.hd.ready())) return {};
        var s = baye.hd.spe() || {}, m = typeof baye.hd.maker === 'function' ? baye.hd.maker() : null;
        if (m && m.protocolVersion === 1 && m.active && m.phase === 'hold' && m.returnEligible === true &&
            integer(m.generation) && m.generation === s.generation && integer(m.session) && m.session > 0 && integer(m.inputSeq) && m.inputSeq > 0) {
            // This is a presentation of GamMakerInf's native hold owner.
            // The public SPE remains inactive after its real child has ended.
            return { active: true, ownerType: 'maker-hold', maker: m, nativeSpe: s,
                protocolVersion: 2, id: m.speId, kind: 1, generation: m.generation,
                eventId: m.display && m.display.eventId, resourceIndex: m.resourceIndex,
                count: m.count, picmax: m.picmax, x: m.x, y: m.y, startFrm: m.startFrm, endFrm: m.endFrm,
                resourceLength: m.resourceLength, resourceFingerprint: m.resourceFingerprint,
                protocolValid: m.sourceValid === true && !m.custom, frameValid: m.sourceValid === true,
                keyflag: 1, skipEligible: false, display: s.display };
        }
        var presentation = {};
        for (var name in s) if (Object.prototype.hasOwnProperty.call(s, name)) presentation[name] = s[name];
        presentation.maker = m;
        if (Number(s.id) === 6 && m && m.active && m.custom) presentation.protocolValid = false;
        return presentation;
    }
    catch (e) {
        return {};
    } }
    function kind(s) { return Number(s.kind) || (Number(s.id) === 3 || Number(s.id) === 6 ? 1 : 0); }
    function hd(k) {
        var api = k === 1 ? global.BayeHdSystemUi : global.BayeHdBattle;
        if (api && typeof api.shouldShowHd === 'function')
            return api.shouldShowHd();
        var mode = storage(k === 1 ? 'baye/systemUiMode' : 'baye/battleMode', 'auto');
        return mode === 'hd' || (mode !== 'classic' && storage('baye/overworldMode', 'classic') === 'hd-map');
    }
    function report() { try {
        return !!(global.baye && baye.hd && baye.hd.report && Number(baye.hd.report().active) === 1);
    }
    catch (e) {
        return true;
    } }
    function held(s) { return s.ownerType === 'maker-hold'; }
    function event(s) { return held(s) ? 'maker:' + s.maker.generation + ':' + s.maker.session + ':' + s.maker.inputSeq : s.protocolVersion === 2 ? s.generation + ':' + s.eventId : kind(s) + ':' + s.id; }
    function stamp(s) { var d = s.display; return d ? d.generation + ':' + d.eventId + ':' + d.commitSeq : event(s); }
    function matches(s) { var d = s.display;
        if (held(s)) {
            var saved = s.maker.display;
            return !!(s.maker.sourceValid && d && saved && d.frameValid && saved.frameValid &&
                d.generation === saved.generation && d.eventId === saved.eventId && d.commitSeq === saved.commitSeq &&
                integer(d.commitSeq) && d.commitSeq > 0 && d.frameIndex === saved.frameIndex &&
                Array.isArray(d.visibleFrames) && Array.isArray(saved.visibleFrames) && d.visibleFrames.length === 32 &&
                saved.visibleFrames.length === 32 && d.visibleFrames.every(function (value, index) { return value === saved.visibleFrames[index]; }));
        }
        return s.protocolVersion !== 2 || !!(d && d.generation === s.generation && d.eventId === s.eventId && integer(d.commitSeq) && d.commitSeq > 0);
    }
    function show(s) { var k = kind(s); return !!(s.active && (k === 1 || k === 2 || k === 3) && hd(k) && !document.hidden && !report() && (held(s) || matches(s))); }
    function skippable(s) { return show(s) && kind(s) === 1 && (s.protocolVersion === 2 ? s.skipEligible === true && s.keyflag === 1 : (Number(s.id) === 3 || Number(s.id) === 6)); }
    function retire(key) {
        if (state.event !== (key || ''))
            state.skipped = '';
        state.event = key || '';
        state.epoch++;
        state.pressed = null;
        state.assets = null;
        state.hasFlush = false;
        state.flushKey = '';
        state.renderKey = '';
        state.frames = [];
        state.source = 'lcd';
        state.reason = 'waiting-display';
        var canvas = el('hd-spe-canvas');
        if (!document.hidden && canvas && canvas.getContext('2d'))
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
    function capture(img, w, h, s) {
        var lcd = el('lcd');
        if (!state.scratch)
            state.scratch = document.createElement('canvas');
        w = w || (lcd && lcd.width);
        h = h || (lcd && lcd.height);
        var ctx = state.scratch.getContext('2d');
        if (!ctx || !integer(w) || !integer(h) || w <= 0 || h <= 0)
            return false;
        if (state.scratch.width !== w || state.scratch.height !== h) {
            state.scratch.width = w;
            state.scratch.height = h;
        }
        if (img)
            ctx.putImageData(img, 0, 0);
        else if (lcd) {
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(lcd, 0, 0);
        }
        else
            return false;
        state.flushW = w;
        state.flushH = h;
        state.hasFlush = true;
        state.flushKey = stamp(s);
        var size = screen();
        state.geometry = size.width + ':' + size.height;
        return true;
    }
    function verifyLib() {
        var identity = global.BayeHdLibIdentity;
        var current = identity ? identity.read() :
            { status: 'unavailable', generation: 0, sha256: null, reason: 'lib-unavailable' };
        var hash = current.status === 'ready' ? current.sha256 : null;
        if (state.libGeneration !== current.generation || state.libHash !== hash || state.libReason !== current.reason) {
            state.libGeneration = current.generation;
            state.libHash = hash;
            state.libReason = current.reason;
            state.assets = null;
            state.cache = [];
        }
    }
    function setManifest(value) { state.manifestGeneration++; state.assets = null; state.cache = []; state.manifest = value && value.schemaVersion === 1 && /^[\da-f]{64}$/i.test(value.libSha256 || '') && Array.isArray(value.entries) ? value : null; sync(); }
    function requestManifest() {
        if (state.manifestRequested || typeof global.fetch !== 'function')
            return;
        state.manifestRequested = true;
        var ticket = state.manifestGeneration;
        try {
            global.fetch('assets/hd-spe/manifest.json', { cache: 'no-cache' }).then(function (response) { if (!response.ok)
                throw new Error('SPE manifest unavailable'); return response.json(); })
                .then(function (value) { if (ticket === state.manifestGeneration)
                setManifest(value); }, function () { });
        }
        catch (e) { }
    }
    function visible(s) {
        var bits = s.display && s.display.visibleFrames, out = [];
        if (!Array.isArray(bits) || bits.length !== 32 || !integer(s.count) || s.count < 1 || s.count > 255)
            return null;
        for (var b = 0; b < 32; b++)
            if (!integer(bits[b]) || bits[b] < 0 || bits[b] > 255)
                return null;
        for (var i = 0; i < 256; i++)
            if (bits[i >> 3] & (1 << (i & 7))) {
                if (i >= s.count || i < s.startFrm || i > s.endFrm)
                    return null;
                out.push(i);
            }
        return out;
    }
    function match(s) {
        var m = state.manifest, scale;
        try {
            scale = baye.data.g_scale;
        }
        catch (e) {
            return null;
        }
        if (!integer(s.x) || !integer(s.y) || !integer(s.startFrm) || !integer(s.endFrm) || s.startFrm < 0 || s.endFrm < s.startFrm || s.endFrm >= s.count ||
            typeof s.resourceFingerprint !== 'string' || !/^fnv1a32:[\da-f]{8}:\d+$/.test(s.resourceFingerprint) || !integer(s.resourceLength) || s.resourceLength <= 0)
            return null;
        if (!m || !state.libHash || state.libHash !== m.libSha256 || !integer(scale) || scale < 1 || m.axScale !== scale)
            return null;
        for (var i = 0; i < m.entries.length; i++) {
            var e = m.entries[i];
            if (e && e.speId === s.id && e.resourceIndex === s.resourceIndex && e.kind === s.kind && e.startFrm === s.startFrm && e.endFrm === s.endFrm &&
                e.count === s.count && e.picmax === s.picmax && e.resourceFingerprint === s.resourceFingerprint && e.resourceLength === s.resourceLength)
                return e;
        }
        return null;
    }
    function valid(e) {
        if (!e || !Array.isArray(e.units) || e.units.length !== e.count || !Array.isArray(e.pictures) || e.pictures.length !== e.picmax || e.picmax < 1 || e.picmax > 255)
            return false;
        var seen = {}, scale = state.manifest.axScale;
        for (var p = 0; p < e.pictures.length; p++) {
            var pic = e.pictures[p];
            if (!pic || !integer(pic.picIndex) || pic.picIndex < 0 || pic.picIndex >= e.picmax || seen[pic.picIndex] || typeof pic.src !== 'string' ||
                !/^assets\/hd-spe\/[\w./-]+\.(?:png|webp|svg)$/.test(pic.src) || pic.src.indexOf('..') !== -1 || !integer(pic.width) || pic.width <= 0 || !integer(pic.height) || pic.height <= 0 ||
                !(pic.logicalWidth > 0 && pic.logicalHeight > 0 && isFinite(pic.logicalWidth) && isFinite(pic.logicalHeight)) ||
                pic.nativeWidth !== pic.logicalWidth * scale || pic.nativeHeight !== pic.logicalHeight * scale || (pic.mask !== 0 && pic.mask !== 1))
                return false;
            seen[pic.picIndex] = true;
        }
        for (var u = 0; u < e.units.length; u++) {
            var unit = e.units[u];
            if (!unit || unit.frame !== u || !integer(unit.x) || !integer(unit.y) || unit.x < 0 || unit.y < 0 || !integer(unit.picIndex) || !seen[unit.picIndex])
                return false;
        }
        return true;
    }
    function load(e) {
        var signature;
        try { signature = JSON.stringify(e); } catch (error) { return { entry: e, status: 'failed', images: {} }; }
        for (var cached = 0; cached < state.cache.length; cached++) {
            var candidate = state.cache[cached];
            if (candidate.signature === signature && candidate.manifestGeneration === state.manifestGeneration &&
                candidate.libGeneration === state.libGeneration && candidate.libHash === state.libHash) {
                state.assets = candidate;
                return candidate;
            }
        }
        var record = { entry: e, signature: signature, status: 'loading', images: {}, pending: e.pictures.length,
            manifestGeneration: state.manifestGeneration, libGeneration: state.libGeneration, libHash: state.libHash };
        state.assets = record;
        state.cache.push(record);
        // Images belong to authenticated resource metadata, not a playback
        // event. Completion only repaints the current native display stamp.
        function current() {
            verifyLib();
            return state.cache.indexOf(record) !== -1 && record.manifestGeneration === state.manifestGeneration &&
                record.libGeneration === state.libGeneration && record.libHash === state.libHash;
        }
        for (var i = 0; i < e.pictures.length; i++)
            (function (pic) {
                try {
                    var image = new global.Image();
                    image.onload = function () {
                        if (!current())
                            return;
                        if (image.naturalWidth !== pic.width || image.naturalHeight !== pic.height) {
                            record.status = 'failed';
                            sync();
                            return;
                        }
                        record.images[pic.picIndex] = image;
                        record.pending--;
                        if (!record.pending && record.status !== 'failed')
                            record.status = 'ready';
                        sync();
                    };
                    image.onerror = function () { if (current()) {
                        record.status = 'failed';
                        sync();
                    } };
                    image.src = pic.src;
                }
                catch (error) {
                    record.status = 'failed';
                }
            })(e.pictures[i]);
        return record;
    }
    function prepareStart(callback, options) {
        if (typeof callback !== 'function') return;
        options = options || {};
        var timeout = integer(options.timeoutMs) && options.timeoutMs >= 0 && options.timeoutMs <= 10000 ? options.timeoutMs : 5000;
        var started = Date.now(), done = false, timer = 0, slots = 0;
        state.preparing = true;
        function finish(ready, reason) {
            if (done) return;
            done = true;
            if (timer) global.clearTimeout(timer);
            state.preparing = false;
            state.preparation = { ready: ready, reason: reason, elapsedMs: Date.now() - started, slots: slots,
                libSha256: state.libHash, libGeneration: state.libGeneration, manifestGeneration: state.manifestGeneration };
            // The caller enters _main here. Do not bind baye.data, probe native
            // getters, render, or send a key before that callback has run.
            callback(state.preparation);
        }
        function check() {
            if (done) return;
            if (!hd(1)) { finish(false, 'classic'); return; }
            var width = typeof global.lcdWidth === 'number' ? global.lcdWidth : W;
            var height = typeof global.lcdHeight === 'number' ? global.lcdHeight : H;
            if (width !== W || height !== H) { finish(false, 'screen-size-unsupported'); return; }
            verifyLib();
            var identity = global.BayeHdLibIdentity && global.BayeHdLibIdentity.read();
            if (!identity || identity.status === 'unavailable' || identity.status === 'invalid' || identity.status === 'error') {
                finish(false, identity && identity.reason || 'lib-unavailable'); return;
            }
            requestManifest();
            var m = state.manifest;
            if (identity.status === 'ready' && m) {
                if (state.libHash !== m.libSha256) { finish(false, 'unknown-lib'); return; }
                warmMaker();
                var entry = m.entries.filter(function (e) {
                    return e && e.speId === 3 && e.resourceIndex === 0 && e.kind === 1 && e.startFrm === 0 &&
                        integer(e.count) && e.count >= 1 && e.count <= 255 && e.endFrm === e.count - 1 &&
                        integer(e.resourceLength) && e.resourceLength > 0 && /^fnv1a32:[\da-f]{8}:\d+$/.test(e.resourceFingerprint || '') && valid(e);
                })[0];
                if (!entry) { finish(false, 'opening-not-matched'); return; }
                slots = entry.pictures.length;
                var assets = load(entry);
                if (assets.status === 'ready') { finish(true, 'assets-ready'); return; }
                if (assets.status === 'failed') { finish(false, 'asset-load-failed'); return; }
            }
            if (Date.now() - started >= timeout) { finish(false, m ? 'timeout' : 'manifest-unavailable'); return; }
            timer = global.setTimeout(guardedCheck, 20);
        }
        // Asset preparation has its own bounded wait. Native playback time
        // starts only after callback; failures preserve the original game.
        function guardedCheck() {
            try { check(); } catch (error) {
                if (done) throw error; // Preserve exceptions from the native start callback.
                finish(false, 'preparation-failed');
            }
        }
        guardedCheck();
    }
    function screen() {
        var data = global.baye && baye.data || {}, w = data.g_screenWidth, h = data.g_screenHeight;
        return { width: integer(w) && w > 0 ? w : W, height: integer(h) && h > 0 ? h : H, axScale: data.g_scale };
    }
    function warmMaker() {
        var m = state.manifest, selected = state.assets;
        if (!m || state.libHash !== m.libSha256 || !hd(1)) return;
        for (var i = 0; i < m.entries.length; i++) {
            var entry = m.entries[i];
            if (entry && entry.speId === 6 && entry.resourceIndex === 0 && entry.kind === 1 && valid(entry)) load(entry);
        }
        state.assets = selected;
    }
    function renderKey(s) { var size = screen(); return stamp(s) + ':' + state.epoch + ':' + state.manifestGeneration + ':' + state.libGeneration + ':' + state.libHash + ':' + (state.assets && state.assets.status) + ':' + size.width + ':' + size.height + ':' + size.axScale + ':' + s.protocolValid + ':' + s.frameValid + ':' + matches(s); }
    function paint(s) {
        var canvas = el('hd-spe-canvas');
        if (!canvas || !show(s) || state.renderKey === renderKey(s))
            return;
        var size = screen(), geometry = size.width + ':' + size.height;
        if (state.geometry !== geometry) {
            state.geometry = geometry;
            state.hasFlush = false;
        }
        if (!state.hasFlush || state.flushKey !== stamp(s))
            if (!capture(null, 0, 0, s))
                return;
        var baseline = size.width === W && size.height === H, k = kind(s), sx = 0, sy = 0, sw = size.width, sh = size.height;
        if (baseline && k !== 1) {
            // FGT_SPESX/Y center the native arena. An individual effect's
            // origin can be offset inside it and must not move the LCD crop.
            sx = (size.width - 130) / 2;
            sy = (size.height - 64) / 2;
            sw = 130;
            sh = 64;
        }
        var scale = Math.max(1, Math.min(Math.floor(1920 / sw), Math.floor(1080 / sh))), w = sw * scale, h = sh * scale;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        state.canvasW = w;
        state.canvasH = h;
        state.scale = scale;
        var ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(state.scratch, sx / size.width * state.flushW, sy / size.height * state.flushH, sw / size.width * state.flushW, sh / size.height * state.flushH, 0, 0, w, h);
        state.source = 'lcd';
        state.reason = s.protocolVersion !== 2 ? 'legacy-protocol' : 'assets-unavailable';
        state.frames = [];
        verifyLib();
        requestManifest();
        warmMaker();
        state.renderKey = renderKey(s);
        if (!baseline) {
            state.reason = 'screen-size-unsupported';
            return;
        }
        if (s.protocolVersion !== 2 || s.protocolValid !== true || s.frameValid !== true || !s.display || s.display.frameValid !== true || (s.keyflag & 2) || !matches(s))
            return;
        var frames = visible(s), entry = match(s);
        if (!frames || !valid(entry)) {
            state.reason = state.libReason || 'event-not-matched';
            return;
        }
        var assets = load(entry);
        state.renderKey = renderKey(s);
        if (assets.status !== 'ready') {
            state.reason = assets.status === 'failed' ? 'asset-load-failed' : 'assets-loading';
            return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.fillStyle = '#171a16';
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();
        for (var i = 0; i < frames.length; i++) {
            var unit = entry.units[frames[i]], picture = entry.pictures.filter(function (p) { return p.picIndex === unit.picIndex; })[0];
            ctx.drawImage(assets.images[unit.picIndex], (s.x + unit.x - sx) * scale, (s.y + unit.y - sy) * scale, picture.logicalWidth * scale, picture.logicalHeight * scale);
        }
        ctx.restore();
        state.source = 'hd-assets';
        state.reason = '';
        state.frames = frames;
    }
    function sync(noPaint) {
        var s = info(), key = s.active ? event(s) : '', shown = show(s);
        if (key !== state.event)
            retire(key);
        if (!shown && state.open)
            retire(key);
        state.open = shown;
        var root = el('hd-spe');
        if (!root)
            return;
        root.classList.toggle('is-open', shown);
        root.classList.toggle('is-opening', shown && skippable(s));
        root.setAttribute('aria-hidden', shown ? 'false' : 'true');
        root.style.pointerEvents = shown ? 'auto' : 'none';
        if (document.documentElement)
            document.documentElement.setAttribute('data-baye-spe', shown ? 'on' : 'off');
        var skip = el('hd-spe-skip'), eligible = shown && skippable(s) && state.skipped !== key;
        if (skip) {
            skip.hidden = !shown || !skippable(s);
            skip.disabled = !eligible;
            skip.style.visibility = skip.hidden ? 'hidden' : 'visible';
            skip.style.pointerEvents = eligible ? 'auto' : 'none';
            skip.setAttribute('aria-hidden', skip.hidden ? 'true' : 'false');
        }
        var back = el('hd-spe-return'), token = key + ':' + state.epoch;
        if (back) {
            back.hidden = !shown || !held(s);
            back.disabled = back.hidden || state.returned === key;
            back.style.visibility = back.hidden ? 'hidden' : 'visible';
            back.style.pointerEvents = back.disabled ? 'none' : 'auto';
            back.setAttribute('aria-hidden', back.hidden ? 'true' : 'false');
            back.setAttribute('data-hd-spe-owner', token);
        }
        var title = el('hd-spe-title');
        if (title)
            title.textContent = Number(s.id) === 6 ? '制作群组' : kind(s) === 1 ? '开场动画' : (kind(s) === 2 ? '计谋动画' : '战斗动画');
        if (shown) {
            verifyLib();
            if (noPaint !== true)
                paint(s);
        }
        root.setAttribute('data-source', state.source);
        var probe = el('hd-spe-probe');
        if (probe)
            probe.textContent = state.source === 'hd-assets' ? '高清素材 · 原生显示帧 ' + state.frames.join(',') : '原生 LCD 画面';
    }
    function skip() {
        var s = info(), key = event(s);
        if (!state.open || !skippable(s) || state.skipped === key)
            return false;
        state.skipped = key;
        try {
            if (typeof global.sendKey === 'function')
                global.sendKey(0x27);
            else {
                state.skipped = '';
                return false;
            }
        }
        catch (e) {
            return false;
        }
        sync();
        return true;
    }
    function returnToTitle(token) {
        var s = info(), key = event(s);
        if (!state.open || !show(s) || !held(s) || token !== key + ':' + state.epoch || state.returned === key ||
            typeof global.sendKey !== 'function') return false;
        state.returned = key;
        try { global.sendKey(0x27); } catch (e) { sync(); return false; }
        sync();
        return true;
    }
    function classic() {
        var s = info();
        if (!show(s))
            return false;
        var api = kind(s) === 1 ? global.BayeHdSystemUi : global.BayeHdBattle;
        if (api && typeof api.setMode === 'function')
            api.setMode('classic');
        else
            try {
                global.localStorage.setItem(kind(s) === 1 ? 'baye/systemUiMode' : 'baye/battleMode', 'classic');
            }
            catch (e) { }
        sync();
        return true;
    }
    function start() {
        var root = el('hd-spe');
        if (root && !state.bound) {
            state.bound = true;
            root.addEventListener('pointerdown', function (e) {
                var t = e.target && e.target.closest && e.target.closest('[data-hd-spe-return]');
                state.pressed = t ? { token: t.getAttribute('data-hd-spe-owner') } : null;
            });
            root.addEventListener('pointercancel', function () { state.pressed = null; });
            root.addEventListener('click', function (e) {
                var back = e.target && e.target.closest && e.target.closest('[data-hd-spe-return]');
                if (back) {
                    e.preventDefault(); e.stopPropagation();
                    var pressed = state.pressed; state.pressed = null;
                    // Pointer presses must survive neither retirement nor a
                    // mode/visibility change. Keyboard activation uses the
                    // current displayed native owner.
                    if (e.detail === 0 || pressed) returnToTitle(pressed ? pressed.token : back.getAttribute('data-hd-spe-owner'));
                    return;
                }
                var t = e.target, button = t && t.closest && t.closest('[data-hd-spe-lcd]');
                if (button) {
                    e.preventDefault();
                    e.stopPropagation();
                    classic();
                    return;
                }
                if (state.open && skippable(info())) {
                    e.preventDefault();
                    e.stopPropagation();
                    skip();
                }
            });
            document.addEventListener('keydown', function (e) {
                var s = info();
                if (!state.open || !(skippable(s) || held(s) && show(s)) || e.isComposing || e.defaultPrevented || (global.bayeInputIgnored && global.bayeInputIgnored(e)) ||
                    (e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') || e.target.isContentEditable)))
                    return;
                if (!(/^(Enter| |Escape)$/.test(e.key || '') || [13, 32, 27].indexOf(e.keyCode || e.which) !== -1))
                    return;
                e.preventDefault();
                e.stopPropagation();
                if (e.stopImmediatePropagation)
                    e.stopImmediatePropagation();
                if (!e.repeat)
                    if (held(s)) returnToTitle(event(s) + ':' + state.epoch); else skip();
            }, true);
            document.addEventListener('visibilitychange', sync);
        }
        requestManifest();
        sync();
        if (!state.poll)
            state.poll = global.setInterval(sync, 250);
    }
    global.BayeHdSpe = { start: start, applyPcPage: start, onEngineSpe: sync, onLcdFlush: function (img, w, h) { var s = info(); sync(true); if (!show(s))
            return; capture(img, w, h, s); state.renderKey = ''; paint(s); var root = el('hd-spe'); if (root)
            root.setAttribute('data-source', state.source); }, blit: sync,
        skip: skip, returnToTitle: returnToTitle, useClassic: classic, setManifest: setManifest, prepareStart: prepareStart, isHandling: function () { return show(info()); }, isOpen: function () { return state.open; }, shouldShowHd: function () { return hd(1) || hd(2); },
        debugSnapshot: function () {
            var s = info();
            return { open: state.open, opening: state.open && skippable(s), skipVisible: !!(el('hd-spe-skip') && !el('hd-spe-skip').hidden), skipped: state.skipped === event(s),
                source: state.source, fallbackReason: state.reason, displayedFrames: state.frames.slice(), scale: state.scale, canvasW: state.canvasW, canvasH: state.canvasH, flushW: state.flushW, flushH: state.flushH,
                event: state.event, flushKey: state.flushKey, libSha256: state.libHash, preparing: state.preparing,
                preparation: state.preparation, cachedResources: state.cache.length, ownerToken: event(s) + ':' + state.epoch,
                maker: s.maker, presentation: held(s) ? 'maker-hold' : 'spe', spe: s.nativeSpe || s };
        } };
    if (global.BayeHdLibIdentity) {
        global.BayeHdLibIdentity.subscribe(function () { verifyLib(); sync(); });
    }
})(window);
