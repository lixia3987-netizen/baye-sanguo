/** Native displayed SPE commits select HD picture slots; the engine owns time. */
(function (global) {
    var W = 160, H = 96, state = { open: false, bound: false, poll: 0, event: '', epoch: 0, skipped: '', scratch: null, hasFlush: false,
        flushW: 0, flushH: 0, flushKey: '', renderKey: '', canvasW: 0, canvasH: 0, scale: 1, source: 'lcd', reason: '', frames: [],
        manifest: null, manifestGeneration: 0, manifestRequested: false, assets: null, cache: [], imageCache: {}, preparing: false, preparation: null,
        libGeneration: 0, libHash: null, libReason: 'lib-unavailable', returned: '', pressed: null,
        callbackFlushKey: '', aiBase: null, aiRegion: null, opaqueRegion: null };
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
        var s = baye.hd.spe() || {};
        // The map-cell observer belongs only to its real active SPE. No
        // unrelated Maker/attack/skill getter can supply a surviving owner.
        if (s.active && kind(s) === 4) return s;
        var m = typeof baye.hd.maker === 'function' ? baye.hd.maker() : null,
            a = typeof baye.hd.attack === 'function' ? baye.hd.attack() : null,
            result = typeof baye.hd.skillResult === 'function' ? baye.hd.skillResult() : null,
            top = typeof baye.hd.resultOwner === 'function' ? baye.hd.resultOwner() : null;
        if (!s.active && top && top.active && top.generation === s.generation &&
            (!top.valid || top.kind === 1 && !(a && a.active && a.generation === top.generation && a.session === top.session) ||
                top.kind === 2 && !(result && result.active && result.generation === top.generation && result.session === top.session))) {
            // A real parent can survive a nested observer's metadata. Keep its
            // real LCD wait visible; never restore the parent's retired HD.
            return { active: true, ownerType: 'result-lcd', resultOwner: top, nativeSpe: s,
                protocolVersion: 2, id: 0, kind: top.kind === 1 ? 3 : 2, generation: top.generation,
                eventId: 0, protocolValid: false, frameValid: false, keyflag: 0, skipEligible: false, display: null };
        }
        if (!s.active && result && result.protocolVersion === 1 && result.active &&
            (result.phase === 'numbers' || result.phase === 'hold') && integer(result.generation) &&
            result.generation === s.generation && integer(result.session) && result.session > 0 &&
            (!top || top.active && top.valid && top.kind === 2 && top.generation === result.generation && top.session === result.session)) {
            // CommonJN owns its surviving native label/number/wait. The
            // finished public SPE stays inactive, including the LCD fallback.
            return { active: true, ownerType: 'skill-postlude', skillResult: result, nativeSpe: s,
                protocolVersion: 2, id: result.speId, kind: 2, generation: result.generation,
                eventId: result.scene && result.scene.eventId, resourceIndex: result.resourceIndex,
                count: result.count, picmax: result.picmax, x: result.x, y: result.y, startFrm: result.startFrm, endFrm: result.endFrm,
                resourceLength: result.resourceLength, resourceFingerprint: result.resourceFingerprint,
                protocolValid: result.sourceValid === true && !result.custom, frameValid: result.sourceValid === true,
                keyflag: 0, skipEligible: false, display: result.display };
        }
        if (!s.active && a && a.protocolVersion === 1 && a.active && (a.phase === 'numbers' || a.phase === 'hold') &&
            integer(a.generation) && a.generation === s.generation && integer(a.session) && a.session > 0 &&
            (!top || top.active && top.valid && top.kind === 1 && top.generation === a.generation && top.session === a.session)) {
            // FgtAtkAction owns this native wait. Its finished child SPE is
            // never reactivated; direct LCD numeric flushes have their own stamp.
            return { active: true, ownerType: 'attack-postlude', attack: a, nativeSpe: s,
                protocolVersion: 2, id: a.speId, kind: 3, generation: a.generation,
                eventId: a.scene && a.scene.eventId, resourceIndex: a.resourceIndex,
                count: a.count, picmax: a.picmax, x: a.x, y: a.y, startFrm: a.startFrm, endFrm: a.endFrm,
                resourceLength: a.resourceLength, resourceFingerprint: a.resourceFingerprint,
                protocolValid: a.sourceValid === true && !a.custom, frameValid: a.sourceValid === true,
                keyflag: 0, skipEligible: false, display: a.display };
        }
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
    function postlude(s) { return s.ownerType === 'attack-postlude'; }
    function skillPostlude(s) { return s.ownerType === 'skill-postlude'; }
    function numericOwner(s) { return postlude(s) || skillPostlude(s); }
    function event(s) { return s.ownerType === 'result-lcd' ? 'result:' + s.resultOwner.kind + ':' + s.resultOwner.generation + ':' + s.resultOwner.session : skillPostlude(s) ? 'skill:' + s.skillResult.generation + ':' + s.skillResult.session : postlude(s) ? 'attack:' + s.attack.generation + ':' + s.attack.session : held(s) ? 'maker:' + s.maker.generation + ':' + s.maker.session + ':' + s.maker.inputSeq : s.protocolVersion === 2 ? s.generation + ':' + s.eventId : kind(s) + ':' + s.id; }
    function stamp(s) { var d = s.display; return numericOwner(s) ? event(s) + ':' + (d && d.paintSeq) + ':' + (d && d.commitSeq) : d ? d.generation + ':' + d.eventId + ':' + d.commitSeq : event(s); }
    function matches(s) { var d = s.display;
        if (numericOwner(s)) {
            var owner = skillPostlude(s) ? s.skillResult : s.attack;
            return !!(owner.sourceValid && d && d.valid && d.frameValid &&
                d.generation === owner.generation && d.session === owner.session && integer(d.paintSeq) && d.paintSeq >= 0);
        }
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
    function show(s) { var k = kind(s); return !!(s.active && (k === 1 || k === 2 || k === 3 || k === 4) && hd(k) && !document.hidden && !report() && (s.ownerType === 'result-lcd' || numericOwner(s) || held(s) || matches(s))); }
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
        state.callbackFlushKey = '';
        state.aiRegion = null;
        state.opaqueRegion = null;
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
        state.callbackFlushKey = img ? stamp(s) : '';
        var size = screen();
        state.geometry = size.width + ':' + size.height;
        return true;
    }
    function verifyLib() {
        var identity = global.BayeHdLibIdentity;
        var current;
        try { current = identity ? identity.read() :
            { status: 'unavailable', generation: 0, sha256: null, reason: 'lib-unavailable' }; }
        catch (error) { current = { status: 'error', generation: state.libReason === 'lib-read-failed' ? state.libGeneration : state.libGeneration + 1,
            sha256: null, reason: 'lib-read-failed' }; }
        var hash = current.status === 'ready' ? current.sha256 : null;
        if (state.libGeneration !== current.generation || state.libHash !== hash || state.libReason !== current.reason) {
            state.libGeneration = current.generation;
            state.libHash = hash;
            state.libReason = current.reason;
            state.assets = null;
            state.cache = [];
            state.imageCache = {};
        }
    }
    function setManifest(value) { state.manifestGeneration++; state.assets = null; state.cache = []; state.imageCache = {}; state.manifest = value && value.schemaVersion === 1 && /^[\da-f]{64}$/i.test(value.libSha256 || '') && Array.isArray(value.entries) ? value : null; sync(); }
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
    function qimenSkillContext(s) {
        if (skillPostlude(s)) return s.skillResult && s.skillResult.skillId;
        return s.contextKnown === true ? s.skillId : null;
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
        var qimenSkill = Number(s.id) === 39 ? qimenSkillContext(s) : null;
        for (var i = 0; i < m.entries.length; i++) {
            var e = m.entries[i];
            if (Number(s.id) === 39 && (qimenSkill === 14 ? !e || e.zhoufengVersion !== 1 || e.skillId !== 14 :
                qimenSkill === 15 ? !e || e.dingshenVersion !== 1 || e.skillId !== 15 :
                qimenSkill !== 20 || !e || e.zhoufengVersion != null || e.dingshenVersion != null || e.skillId === 14 || e.skillId === 15)) continue;
            if (e && e.speId === s.id && e.resourceIndex === s.resourceIndex && e.kind === s.kind && e.startFrm === s.startFrm && e.endFrm === s.endFrm &&
                e.count === s.count && e.picmax === s.picmax && e.resourceFingerprint === s.resourceFingerprint && e.resourceLength === s.resourceLength)
                return e;
        }
        return null;
    }
    function validPicture(pic) {
        var scale = state.manifest.axScale;
        return !!(pic && typeof pic.src === 'string' && /^assets\/hd-spe\/[\w./-]+\.(?:png|webp|svg)$/.test(pic.src) && pic.src.indexOf('..') === -1 &&
            integer(pic.width) && pic.width > 0 && integer(pic.height) && pic.height > 0 &&
            pic.logicalWidth > 0 && pic.logicalHeight > 0 && isFinite(pic.logicalWidth) && isFinite(pic.logicalHeight) &&
            pic.nativeWidth === pic.logicalWidth * scale && pic.nativeHeight === pic.logicalHeight * scale && (pic.mask === 0 || pic.mask === 1));
    }
    function valid(e) {
        if (!e || !Array.isArray(e.units) || e.units.length !== e.count || !Array.isArray(e.pictures) || e.pictures.length !== e.picmax || e.picmax < 1 || e.picmax > 255)
            return false;
        var seen = {}, scale = state.manifest.axScale, needed = rangePictures(e);
        if (!needed) return false;
        for (var p = 0; p < e.pictures.length; p++) {
            var pic = e.pictures[p];
            if (!pic || !integer(pic.picIndex) || pic.picIndex < 0 || pic.picIndex >= e.picmax || seen[pic.picIndex] ||
                !integer(pic.nativeWidth) || pic.nativeWidth <= 0 || !integer(pic.nativeHeight) || pic.nativeHeight <= 0 ||
                !(pic.logicalWidth > 0 && pic.logicalHeight > 0 && isFinite(pic.logicalWidth) && isFinite(pic.logicalHeight)) ||
                pic.nativeWidth !== pic.logicalWidth * scale || pic.nativeHeight !== pic.logicalHeight * scale || (pic.mask !== 0 && pic.mask !== 1) ||
                (needed[pic.picIndex] || pic.src != null ? !validPicture(pic) : e.compositionVersion !== 1 && e.aiTargetVersion !== 2 && e.statusVersion !== 1 && e.opaqueCoverageVersion !== 1 || pic.src !== null || pic.width !== null || pic.height !== null))
                return false;
            seen[pic.picIndex] = true;
        }
        for (var u = 0; u < e.units.length; u++) {
            var unit = e.units[u];
            if (!unit || unit.frame !== u || !integer(unit.x) || !integer(unit.y) || unit.x < 0 || unit.y < 0 || !integer(unit.picIndex) || !seen[unit.picIndex])
                return false;
        }
        if (e.compositionVersion != null) {
            if (e.compositionVersion !== 1 || !validPicture(e.background) || !validSource(e.background) || !validSource(e.number)) return false;
        }
        if (e.skillResultVersion != null && (e.skillResultVersion !== 1 || !validSource(e.skillNumber))) return false;
        if ((e.opaqueCoverageVersion != null || e.speId === 37 || e.speId === 40 || e.speId === 41 || e.aidVersion != null || e.liuyanVersion != null || e.zhoufengVersion != null || e.dingshenVersion != null) && !validOpaqueCoverageEntry(e)) return false;
        if (e.aiTargetVersion != null && !validAiEntry(e)) return false;
        if (e.statusVersion != null && !validStatusEntry(e)) return false;
        return true;
    }
    function rangePictures(e) {
        if (!integer(e.count) || e.count < 1 || e.count > 255 || !integer(e.startFrm) || !integer(e.endFrm) ||
            e.startFrm < 0 || e.endFrm < e.startFrm || e.endFrm >= e.count || !Array.isArray(e.units) || e.units.length !== e.count) return null;
        var needed = {};
        for (var i = 0; i < e.units.length; i++) {
            var unit = e.units[i];
            if (!unit || unit.frame !== i || !integer(unit.picIndex) || unit.picIndex < 0 || unit.picIndex >= e.picmax) return null;
            if (e.compositionVersion !== 1 && e.aiTargetVersion !== 2 && e.statusVersion !== 1 && e.opaqueCoverageVersion !== 1 || i >= e.startFrm && i <= e.endFrm) needed[unit.picIndex] = true;
        }
        return needed;
    }
    function validSource(p) {
        return !!(p && integer(p.id) && p.id > 0 && integer(p.resourceIndex) && p.resourceIndex >= 0 && integer(p.pictureIndex) && p.pictureIndex >= 0 &&
            integer(p.count) && p.count > p.pictureIndex && integer(p.nativeWidth) && p.nativeWidth > 0 && integer(p.nativeHeight) && p.nativeHeight > 0 &&
            integer(p.x) && integer(p.y) && (p.mask === 0 || p.mask === 1) && integer(p.resourceLength) && p.resourceLength > 0 &&
            /^fnv1a32:[\da-f]{8}:\d+$/.test(p.resourceFingerprint || ''));
    }
    function sharedImage(pic, consumer) {
        // Raw-identical native slots share one decoded bitmap across the six
        // defender ranges. The validated dimensions and LIB generation remain
        // part of its authority, rather than merely trusting a URL.
        var signature = JSON.stringify([pic.src, pic.width, pic.height, pic.nativeWidth, pic.nativeHeight, pic.logicalWidth, pic.logicalHeight, pic.mask]);
        var cached = state.imageCache[signature];
        if (cached) {
            if (cached.status === 'loading') cached.listeners.push(consumer); else consumer(cached);
            return;
        }
        var record = { status: 'loading', listeners: [consumer], manifestGeneration: state.manifestGeneration,
            libGeneration: state.libGeneration, libHash: state.libHash, image: null };
        state.imageCache[signature] = record;
        function finish(status) {
            verifyLib();
            if (state.imageCache[signature] !== record || record.manifestGeneration !== state.manifestGeneration ||
                record.libGeneration !== state.libGeneration || record.libHash !== state.libHash || record.status !== 'loading') return;
            record.status = status;
            var listeners = record.listeners.slice(); record.listeners.length = 0;
            listeners.forEach(function (callback) { callback(record); });
        }
        try {
            var image = new global.Image(); record.image = image;
            image.onload = function () { finish(image.naturalWidth === pic.width && image.naturalHeight === pic.height ? 'ready' : 'failed'); };
            image.onerror = function () { finish('failed'); };
            image.src = pic.src;
        } catch (error) { finish('failed'); }
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
        var needed = rangePictures(e);
        var pictures = e.pictures.filter(function (pic) { return needed[pic.picIndex]; }).map(function (pic) { return { key: pic.picIndex, picture: pic }; });
        if (e.background) pictures.push({ key: 'background', picture: e.background });
        var record = { entry: e, signature: signature, status: 'loading', images: {}, pending: pictures.length,
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
        pictures.forEach(function (slot) {
            sharedImage(slot.picture, function (image) {
                if (!current()) return;
                if (image.status === 'ready') { record.images[slot.key] = image.image; record.pending--; }
                else record.status = 'failed';
                if (!record.pending && record.status !== 'failed') record.status = 'ready';
                sync();
            });
        });
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
    function warmArena() {
        if (state.preparing || !state.manifest || state.libHash !== state.manifest.libSha256 || !hd(3)) return;
        try {
            if (!(global.baye && baye.hd && baye.hd.ready() && typeof baye.hd.fight === 'function' && baye.hd.fight().active)) return;
        } catch (error) { return; }
        var selected = state.assets;
        state.manifest.entries.forEach(function (entry) {
            if (entry && (entry.kind === 3 && entry.compositionVersion === 1 || entry.kind === 2 && (entry.skillResultVersion === 1 || entry.liuyanVersion === 1 || entry.zhoufengVersion === 1 || entry.dingshenVersion === 1) || entry.kind === 4 && (entry.aiTargetVersion === 2 || entry.statusVersion === 1)) && valid(entry)) load(entry);
        });
        state.assets = selected;
    }
    function sameSource(expected, observed) {
        return !!(validSource(expected) && observed && observed.valid === true &&
            ['id', 'resourceIndex', 'pictureIndex', 'nativeWidth', 'nativeHeight', 'count', 'mask', 'x', 'y', 'resourceLength', 'resourceFingerprint']
                .every(function (name) { return expected[name] === observed[name]; }));
    }
    function cleared(s) {
        var composition = s.display && s.display.composition;
        if (!composition || composition.protocolVersion !== 1 || composition.valid !== true) return null;
        var bits = composition.clearFrames, out = [];
        if (!Array.isArray(bits) || bits.length !== 32) return null;
        for (var b = 0; b < 32; b++) if (!integer(bits[b]) || bits[b] < 0 || bits[b] > 255) return null;
        for (var i = 0; i < 256; i++) if (bits[i >> 3] & (1 << (i & 7))) {
            if (i >= s.count || i < s.startFrm || i > s.endFrm) return null;
            out.push(i);
        }
        return out;
    }
    function numberPoses(s, entry) {
        if (!numericOwner(s)) return [];
        var owner = skillPostlude(s) ? s.skillResult : s.attack, number = skillPostlude(s) ? entry.skillNumber : entry.number;
        if (!Array.isArray(s.display.digits) || s.display.digits.length > 5 ||
            (s.display.digits.length || postlude(s)) && !sameSource(number, owner.number)) return null;
        var decimal = String(skillPostlude(s) ? owner.value : owner.hurt), poses = [], scale = state.manifest.axScale;
        for (var i = 0; i < s.display.digits.length; i++) {
            var digit = s.display.digits[i];
            if (!digit || !integer(digit.digit) || digit.digit !== decimal.charCodeAt(i) - 48 || !integer(digit.x) || !integer(digit.y) ||
                !integer(digit.firstY) || !integer(digit.drawCount) || digit.drawCount < 1 || digit.drawCount > Math.floor(number.nativeHeight / 2) ||
                digit.y !== digit.firstY - digit.drawCount + 1) return null;
            for (var j = 0; j < digit.drawCount; j++) poses.push({ digit: digit.digit, x: digit.x, y: digit.firstY - j,
                width: number.nativeWidth / scale, height: number.nativeHeight / scale });
        }
        return poses;
    }
    function validAidEntry(entry) {
        if (entry.aidVersion !== 1 || entry.opaqueCoverageVersion !== 1 || entry.skillResultVersion !== 1 ||
            entry.kind !== 2 || entry.speId !== 41 || entry.resourceIndex !== 0 || entry.count !== 8 || entry.picmax !== 2 ||
            entry.startFrm !== 0 || entry.endFrm !== 7 || entry.resourceLength !== 1084 ||
            entry.resourceFingerprint !== 'fnv1a32:1d4637e9:1084' || entry.skillId != null ||
            !Array.isArray(entry.skillIds) || entry.skillIds.length !== 2 || entry.skillIds[0] !== 17 || entry.skillIds[1] !== 29 ||
            entry.compositionVersion != null || entry.aiTargetVersion != null || entry.statusVersion != null ||
            entry.background != null || entry.number != null) return false;
        for (var p = 0; p < 2; p++) {
            var pic = entry.pictures.filter(function (v) { return v.picIndex === p; })[0];
            if (!validPicture(pic) || pic.mask !== 0 || pic.nativeWidth !== 64 || pic.nativeHeight !== 64 ||
                pic.logicalWidth !== 64 || pic.logicalHeight !== 64) return false;
        }
        var number = entry.skillNumber;
        return number && number.id === 15 && number.resourceIndex === 0 && number.pictureIndex === 0 &&
            number.nativeWidth === 12 && number.nativeHeight === 16 && number.count === 10 && number.mask === 0 &&
            number.x === 0 && number.y === 0 && number.resourceLength === 327 && number.resourceFingerprint === 'fnv1a32:b37d7407:327' &&
            entry.units.every(function (u, i) { return u.frame === i && u.x === 0 && u.y === 0 && u.picIndex === i % 2; });
    }
    function aidCoverage(s, entry, frames, clears) {
        var numeric = skillPostlude(s), skill = numeric ? s.skillResult : s, source = numeric ? skill.scene : s,
            c = s.display && s.display.composition, current = source && source.composition;
        if (!validAidEntry(entry) || !c || !current || c.protocolVersion !== 1 || current.protocolVersion !== 1 ||
            c.valid !== true || current.valid !== true || c.mode !== 2 || current.mode !== 2 ||
            [c, current].some(function (v) { return v.x !== 48 || v.y !== 16 || v.width !== 64 || v.height !== 64 || v.background && v.background.valid; }) ||
            s.x !== 48 || s.y !== 16 || s.keyflag !== 0 || s.skipEligible !== false ||
            entry.skillIds.indexOf(skill.skillId) < 0 || !integer(skill.actorIndex) || skill.actorIndex < 0 || skill.actorIndex >= 20 ||
            !integer(skill.targetIndex) || skill.targetIndex < 0 || skill.targetIndex >= 20 ||
            !numeric && s.contextKnown !== true || numeric && (skill.sourceValid !== true || skill.custom !== false ||
                skill.resultKind !== 2 || !integer(skill.value) || skill.value < 0 || skill.value > 65535) ||
            source.frameValid !== true || !integer(source.generation) || source.generation <= 0 ||
            !integer(source.eventId) || source.eventId <= 0 || !integer(source.commitSeq) || source.commitSeq <= 0 ||
            !integer(s.display.commitSeq) || s.display.commitSeq <= 0 || s.display.commitSeq > source.commitSeq ||
            source.eventId !== s.display.eventId || source.generation !== s.display.generation ||
            !integer(source.frameIndex) || source.frameIndex < 0 || source.frameIndex > 7 ||
            !integer(s.display.frameIndex) || s.display.frameIndex < 0 || s.display.frameIndex > source.frameIndex) return null;
        function pastOnly(bits, frontier) {
            if (!byteBits(bits)) return false;
            for (var f = 0; f < 256; f++) if (bits[f >> 3] & (1 << (f & 7))) if (f > frontier) return false;
            return true;
        }
        if (!pastOnly(s.display.visibleFrames, s.display.frameIndex) || !pastOnly(c.clearFrames, s.display.frameIndex) ||
            !pastOnly(source.visibleFrames, source.frameIndex) || !pastOnly(current.clearFrames, source.frameIndex) ||
            !s.display.visibleFrames.some(function (bit, i) { return bit || c.clearFrames[i]; }) ||
            !source.visibleFrames.some(function (bit, i) { return bit || current.clearFrames[i]; }) ||
            c.clearFrames.some(function (bit, i) { return (bit & ~current.clearFrames[i]) !== 0; }) ||
            s.display.commitSeq === source.commitSeq && (s.display.frameIndex !== source.frameIndex ||
                s.display.visibleFrames.some(function (bit, i) { return bit !== source.visibleFrames[i]; }) ||
                c.clearFrames.some(function (bit, i) { return bit !== current.clearFrames[i]; })) ||
            numeric && (source.frameIndex !== 7 || s.display.frameIndex !== 7 || frames.indexOf(7) < 0)) return null;
        return { x: 48, y: 16, width: 64, height: 64 };
    }
    function validLiuyanEntry(entry) {
        if (entry.liuyanVersion !== 1 || entry.opaqueCoverageVersion !== 1 || entry.skillId !== 16 ||
            entry.kind !== 2 || entry.speId !== 40 || entry.resourceIndex !== 0 || entry.count !== 8 || entry.picmax !== 2 ||
            entry.startFrm !== 0 || entry.endFrm !== 7 || entry.resourceLength !== 1084 ||
            entry.resourceFingerprint !== 'fnv1a32:bd0140e0:1084' || entry.skillIds != null || entry.aidVersion != null ||
            entry.skillResultVersion != null || entry.skillNumber != null || entry.compositionVersion != null ||
            entry.aiTargetVersion != null || entry.statusVersion != null || entry.background != null || entry.number != null) return false;
        for (var p = 0; p < 2; p++) {
            var pic = entry.pictures.filter(function (v) { return v.picIndex === p; })[0];
            if (!validPicture(pic) || pic.mask !== 0 || pic.nativeWidth !== 64 || pic.nativeHeight !== 64 ||
                pic.logicalWidth !== 64 || pic.logicalHeight !== 64) return false;
        }
        return entry.units.every(function (u, i) { return u.frame === i && u.x === 0 && u.y === 0 && u.picIndex === i % 2; });
    }
    function liuyanCoverage(s, entry, frames, clears) {
        var c = s.display && s.display.composition, current = s.composition;
        if (!validLiuyanEntry(entry) || numericOwner(s) || held(s) || s.ownerType === 'result-lcd' ||
            !c || !current || c.protocolVersion !== 1 || current.protocolVersion !== 1 ||
            c.valid !== true || current.valid !== true || c.mode !== 2 || current.mode !== 2 ||
            [c, current].some(function (v) { return v.x !== 48 || v.y !== 16 || v.width !== 64 || v.height !== 64 || v.background && v.background.valid; }) ||
            s.x !== 48 || s.y !== 16 || s.keyflag !== 0 || s.skipEligible !== false || s.contextKnown !== true || s.skillId !== 16 ||
            !integer(s.actorIndex) || s.actorIndex < 0 || s.actorIndex >= 20 ||
            !integer(s.targetIndex) || s.targetIndex < 0 || s.targetIndex >= 20 ||
            s.frameValid !== true || !integer(s.generation) || s.generation <= 0 || !integer(s.eventId) || s.eventId <= 0 ||
            !integer(s.commitSeq) || s.commitSeq <= 0 || !integer(s.display.commitSeq) || s.display.commitSeq <= 0 ||
            s.display.commitSeq > s.commitSeq || s.eventId !== s.display.eventId || s.generation !== s.display.generation ||
            !integer(s.frameIndex) || s.frameIndex < 0 || s.frameIndex > 7 ||
            !integer(s.display.frameIndex) || s.display.frameIndex < 0 || s.display.frameIndex > s.frameIndex) return null;
        function pastOnly(bits, frontier) {
            if (!byteBits(bits)) return false;
            for (var f = 0; f < 256; f++) if (bits[f >> 3] & (1 << (f & 7))) if (f > frontier) return false;
            return true;
        }
        if (!pastOnly(s.display.visibleFrames, s.display.frameIndex) || !pastOnly(c.clearFrames, s.display.frameIndex) ||
            !pastOnly(s.visibleFrames, s.frameIndex) || !pastOnly(current.clearFrames, s.frameIndex) ||
            !s.display.visibleFrames.some(function (bit, i) { return bit || c.clearFrames[i]; }) ||
            !s.visibleFrames.some(function (bit, i) { return bit || current.clearFrames[i]; }) ||
            c.clearFrames.some(function (bit, i) { return (bit & ~current.clearFrames[i]) !== 0; }) ||
            s.display.commitSeq === s.commitSeq && (s.display.frameIndex !== s.frameIndex ||
                s.display.visibleFrames.some(function (bit, i) { return bit !== s.visibleFrames[i]; }) ||
                c.clearFrames.some(function (bit, i) { return bit !== current.clearFrames[i]; }))) return null;
        return { x: 48, y: 16, width: 64, height: 64 };
    }
    function validZhoufengEntry(entry) {
        if (entry.zhoufengVersion !== 1 || entry.opaqueCoverageVersion !== 1 || entry.skillId !== 14 ||
            entry.kind !== 2 || entry.speId !== 39 || entry.resourceIndex !== 0 || entry.count !== 8 || entry.picmax !== 2 ||
            entry.startFrm !== 0 || entry.endFrm !== 7 || entry.resourceLength !== 1084 ||
            entry.resourceFingerprint !== 'fnv1a32:6b0ebc5a:1084' || entry.skillIds != null || entry.aidVersion != null || entry.liuyanVersion != null || entry.dingshenVersion != null ||
            entry.skillResultVersion != null || entry.skillNumber != null || entry.compositionVersion != null ||
            entry.aiTargetVersion != null || entry.statusVersion != null || entry.background != null || entry.number != null) return false;
        for (var p = 0; p < 2; p++) {
            var pic = entry.pictures.filter(function (v) { return v.picIndex === p; })[0];
            if (!validPicture(pic) || pic.mask !== 0 || pic.nativeWidth !== 64 || pic.nativeHeight !== 64 ||
                pic.logicalWidth !== 64 || pic.logicalHeight !== 64) return false;
        }
        return entry.units.every(function (u, i) { return u.frame === i && u.x === 0 && u.y === 0 && u.picIndex === i % 2; });
    }
    function zhoufengCoverage(s, entry, frames, clears) {
        var c = s.display && s.display.composition, current = s.composition;
        if (!validZhoufengEntry(entry) || numericOwner(s) || held(s) || s.ownerType === 'result-lcd' ||
            !c || !current || c.protocolVersion !== 1 || current.protocolVersion !== 1 ||
            c.valid !== true || current.valid !== true || c.mode !== 2 || current.mode !== 2 ||
            [c, current].some(function (v) { return v.x !== 48 || v.y !== 16 || v.width !== 64 || v.height !== 64 || v.background && v.background.valid; }) ||
            s.x !== 48 || s.y !== 16 || s.keyflag !== 0 || s.skipEligible !== false || s.contextKnown !== true || s.skillId !== 14 ||
            !integer(s.actorIndex) || s.actorIndex < 0 || s.actorIndex >= 20 ||
            !integer(s.targetIndex) || s.targetIndex < 0 || s.targetIndex >= 20 ||
            s.frameValid !== true || !integer(s.generation) || s.generation <= 0 || !integer(s.eventId) || s.eventId <= 0 ||
            !integer(s.commitSeq) || s.commitSeq <= 0 || !integer(s.display.commitSeq) || s.display.commitSeq <= 0 ||
            s.display.commitSeq > s.commitSeq || s.eventId !== s.display.eventId || s.generation !== s.display.generation ||
            !integer(s.frameIndex) || s.frameIndex < 0 || s.frameIndex > 7 ||
            !integer(s.display.frameIndex) || s.display.frameIndex < 0 || s.display.frameIndex > s.frameIndex) return null;
        function pastOnly(bits, frontier) {
            if (!byteBits(bits)) return false;
            for (var f = 0; f < 256; f++) if (bits[f >> 3] & (1 << (f & 7))) if (f > frontier) return false;
            return true;
        }
        if (!pastOnly(s.display.visibleFrames, s.display.frameIndex) || !pastOnly(c.clearFrames, s.display.frameIndex) ||
            !pastOnly(s.visibleFrames, s.frameIndex) || !pastOnly(current.clearFrames, s.frameIndex) ||
            !s.display.visibleFrames.some(function (bit, i) { return bit || c.clearFrames[i]; }) ||
            !s.visibleFrames.some(function (bit, i) { return bit || current.clearFrames[i]; }) ||
            c.clearFrames.some(function (bit, i) { return (bit & ~current.clearFrames[i]) !== 0; }) ||
            s.display.commitSeq === s.commitSeq && (s.display.frameIndex !== s.frameIndex ||
                s.display.visibleFrames.some(function (bit, i) { return bit !== s.visibleFrames[i]; }) ||
                c.clearFrames.some(function (bit, i) { return bit !== current.clearFrames[i]; }))) return null;
        return { x: 48, y: 16, width: 64, height: 64 };
    }
    function validDingshenEntry(entry) {
        if (entry.dingshenVersion !== 1 || entry.opaqueCoverageVersion !== 1 || entry.skillId !== 15 ||
            entry.kind !== 2 || entry.speId !== 39 || entry.resourceIndex !== 0 || entry.count !== 8 || entry.picmax !== 2 ||
            entry.startFrm !== 0 || entry.endFrm !== 7 || entry.resourceLength !== 1084 ||
            entry.resourceFingerprint !== 'fnv1a32:6b0ebc5a:1084' || entry.skillIds != null || entry.aidVersion != null || entry.liuyanVersion != null || entry.zhoufengVersion != null ||
            entry.skillResultVersion != null || entry.skillNumber != null || entry.compositionVersion != null ||
            entry.aiTargetVersion != null || entry.statusVersion != null || entry.background != null || entry.number != null) return false;
        for (var p = 0; p < 2; p++) {
            var pic = entry.pictures.filter(function (v) { return v.picIndex === p; })[0];
            if (!validPicture(pic) || pic.mask !== 0 || pic.nativeWidth !== 64 || pic.nativeHeight !== 64 ||
                pic.logicalWidth !== 64 || pic.logicalHeight !== 64) return false;
        }
        return entry.units.every(function (u, i) { return u.frame === i && u.x === 0 && u.y === 0 && u.picIndex === i % 2; });
    }
    function dingshenCoverage(s, entry, frames, clears) {
        var c = s.display && s.display.composition, current = s.composition;
        if (!validDingshenEntry(entry) || numericOwner(s) || held(s) || s.ownerType === 'result-lcd' ||
            !c || !current || c.protocolVersion !== 1 || current.protocolVersion !== 1 ||
            c.valid !== true || current.valid !== true || c.mode !== 2 || current.mode !== 2 ||
            [c, current].some(function (v) { return v.x !== 48 || v.y !== 16 || v.width !== 64 || v.height !== 64 || v.background && v.background.valid; }) ||
            s.x !== 48 || s.y !== 16 || s.keyflag !== 0 || s.skipEligible !== false || s.contextKnown !== true || s.skillId !== 15 ||
            !integer(s.actorIndex) || s.actorIndex < 0 || s.actorIndex >= 20 ||
            !integer(s.targetIndex) || s.targetIndex < 0 || s.targetIndex >= 20 ||
            s.frameValid !== true || !integer(s.generation) || s.generation <= 0 || !integer(s.eventId) || s.eventId <= 0 ||
            !integer(s.commitSeq) || s.commitSeq <= 0 || !integer(s.display.commitSeq) || s.display.commitSeq <= 0 ||
            s.display.commitSeq > s.commitSeq || s.eventId !== s.display.eventId || s.generation !== s.display.generation ||
            !integer(s.frameIndex) || s.frameIndex < 0 || s.frameIndex > 7 ||
            !integer(s.display.frameIndex) || s.display.frameIndex < 0 || s.display.frameIndex > s.frameIndex) return null;
        function pastOnly(bits, frontier) {
            if (!byteBits(bits)) return false;
            for (var f = 0; f < 256; f++) if (bits[f >> 3] & (1 << (f & 7))) if (f > frontier) return false;
            return true;
        }
        if (!pastOnly(s.display.visibleFrames, s.display.frameIndex) || !pastOnly(c.clearFrames, s.display.frameIndex) ||
            !pastOnly(s.visibleFrames, s.frameIndex) || !pastOnly(current.clearFrames, s.frameIndex) ||
            !s.display.visibleFrames.some(function (bit, i) { return bit || c.clearFrames[i]; }) ||
            !s.visibleFrames.some(function (bit, i) { return bit || current.clearFrames[i]; }) ||
            c.clearFrames.some(function (bit, i) { return (bit & ~current.clearFrames[i]) !== 0; }) ||
            s.display.commitSeq === s.commitSeq && (s.display.frameIndex !== s.frameIndex ||
                s.display.visibleFrames.some(function (bit, i) { return bit !== s.visibleFrames[i]; }) ||
                c.clearFrames.some(function (bit, i) { return bit !== current.clearFrames[i]; }))) return null;
        return { x: 48, y: 16, width: 64, height: 64 };
    }
    function validOpaqueCoverageEntry(entry) {
        if (entry.dingshenVersion != null) return validDingshenEntry(entry);
        if (entry.zhoufengVersion != null) return validZhoufengEntry(entry);
        if (entry.liuyanVersion != null || entry.speId === 40) return validLiuyanEntry(entry);
        if (entry.aidVersion != null || entry.speId === 41) return validAidEntry(entry);
        if (entry.opaqueCoverageVersion !== 1 || entry.skillResultVersion !== 1 || entry.kind !== 2 ||
            entry.speId !== 37 || entry.resourceIndex !== 0 || entry.count !== 8 || entry.picmax !== 2 ||
            entry.startFrm !== 0 || (entry.skillId === 6 ? entry.endFrm !== 7 : entry.skillId !== 7 || entry.endFrm !== 0) ||
            entry.resourceLength !== 1148 || entry.resourceFingerprint !== 'fnv1a32:d38c3c8b:1148' ||
            entry.compositionVersion != null || entry.aiTargetVersion != null || entry.statusVersion != null || entry.background != null || entry.number != null)
            return false;
        for (var p = 0; p < 2; p++) {
            var pic = entry.pictures.filter(function (v) { return v.picIndex === p; })[0];
            if (!(p === 1 && entry.skillId === 7 && pic.src === null && pic.width === null && pic.height === null || validPicture(pic)) || pic.mask !== 0 || pic.nativeWidth !== (p ? 66 : 64) || pic.nativeHeight !== 64 ||
                pic.logicalWidth !== pic.nativeWidth || pic.logicalHeight !== 64) return false;
        }
        var number = entry.skillNumber;
        return number && number.id === 15 && number.resourceIndex === 0 && number.pictureIndex === 0 &&
            number.nativeWidth === 12 && number.nativeHeight === 16 && number.count === 10 && number.mask === 0 &&
            number.x === 0 && number.y === 0 && number.resourceLength === 327 && number.resourceFingerprint === 'fnv1a32:b37d7407:327' &&
            entry.units.every(function (u, i) { return u.frame === i && u.x === 0 && u.y === 0 && u.picIndex === i % 2; });
    }
    function opaqueCoverage(s, entry, frames, clears) {
        if (entry.dingshenVersion != null) return dingshenCoverage(s, entry, frames, clears);
        if (entry.zhoufengVersion != null) return zhoufengCoverage(s, entry, frames, clears);
        if (entry.liuyanVersion != null || entry.speId === 40) return liuyanCoverage(s, entry, frames, clears);
        if (entry.aidVersion != null || entry.speId === 41) return aidCoverage(s, entry, frames, clears);
        var numeric = skillPostlude(s), c = s.display && s.display.composition, skill = numeric ? s.skillResult : s,
            source = numeric ? skill.scene : s, current = source && source.composition;
        if (!validOpaqueCoverageEntry(entry) || !c || c.protocolVersion !== 1 || c.valid !== true ||
            (entry.skillId === 6 ? c.mode !== 3 : c.mode !== 2 && c.mode !== 3) || c.x !== 48 || c.y !== 16 || c.height !== 64 ||
            s.x !== 48 || s.y !== 16 || s.keyflag !== 0 || s.skipEligible !== false || skill.skillId !== entry.skillId ||
            !integer(skill.actorIndex) || skill.actorIndex < 0 || skill.actorIndex >= 20 ||
            !integer(skill.targetIndex) || skill.targetIndex < 0 || skill.targetIndex >= 20 ||
            !numeric && s.contextKnown !== true || numeric && (skill.sourceValid !== true || skill.custom !== false) ||
            !integer(s.display.frameIndex) || s.display.frameIndex < entry.startFrm || s.display.frameIndex > entry.endFrm)
            return null;
        function widthFor(live, erased, frontier) {
            if (!byteBits(live) || !byteBits(erased) || !integer(frontier) || frontier < entry.startFrm || frontier > entry.endFrm) return 0;
            var width = 0;
            for (var f = 0; f < 256; f++) if ((live[f >> 3] | erased[f >> 3]) & (1 << (f & 7))) {
                if (f < entry.startFrm || f > frontier) return 0;
                width = Math.max(width, f % 2 ? 66 : 64);
            }
            return width;
        }
        var width = widthFor(s.display.visibleFrames, c.clearFrames, s.display.frameIndex),
            currentWidth = current && widthFor(source.visibleFrames, current.clearFrames, source.frameIndex);
        if (!width || c.width !== width || entry.skillId === 7 && width !== 64 ||
            !current || current.protocolVersion !== 1 || current.valid !== true || current.mode !== c.mode ||
            current.x !== c.x || current.y !== c.y || current.height !== c.height || current.width !== currentWidth || currentWidth < width ||
            source.frameValid !== true || !integer(source.generation) || source.generation <= 0 ||
            !integer(source.eventId) || source.eventId <= 0 || !integer(source.commitSeq) || source.commitSeq <= 0 ||
            !integer(s.display.commitSeq) || s.display.commitSeq <= 0 || s.display.commitSeq > source.commitSeq ||
            s.display.frameIndex > source.frameIndex || source.eventId !== s.display.eventId || source.generation !== s.display.generation ||
            c.clearFrames.some(function (bit, i) { return (bit & ~current.clearFrames[i]) !== 0; }) ||
            s.display.commitSeq === source.commitSeq && (s.display.frameIndex !== source.frameIndex || c.width !== current.width ||
                s.display.visibleFrames.some(function (bit, i) { return bit !== source.visibleFrames[i]; }) ||
                c.clearFrames.some(function (bit, i) { return bit !== current.clearFrames[i]; })) ||
            numeric && entry.skillId === 6 && (s.display.frameIndex !== 7 || width !== 66 || frames.indexOf(7) < 0)) return null;
        return { x: c.x, y: c.y, width: width, height: 64 };
    }
    function opaqueSignature(s) {
        try { return JSON.stringify(s); } catch (error) { return null; }
    }
    function paintOpaqueCoverage(ctx, s, entry, assets, frames, clears, region, label, poses, scale, sx, sy) {
        var signature = opaqueSignature(s), ticket = { epoch: state.epoch, manifest: state.manifestGeneration,
            generation: state.libGeneration, hash: state.libHash, assets: assets }, restored = false;
        function allowed() {
            verifyLib(); var fresh = info(), live = visible(fresh), erased = cleared(fresh);
            return signature && !document.hidden && hd(2) && !report() && show(fresh) && matches(fresh) &&
                opaqueSignature(fresh) === signature && state.epoch === ticket.epoch && state.manifestGeneration === ticket.manifest &&
                state.libGeneration === ticket.generation && state.libHash === ticket.hash && state.assets === ticket.assets &&
                state.flushKey === stamp(fresh) && assets.signature === JSON.stringify(entry) &&
                valid(entry) && live && erased && opaqueCoverage(fresh, entry, live, erased);
        }
        function restore() {
            if (restored) return; restored = true; ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, state.canvasW, state.canvasH);
            ctx.drawImage(state.scratch, 0, 0, state.flushW, state.flushH, 0, 0, state.canvasW, state.canvasH);
            state.reason = 'opaque-coverage-retired';
        }
        if (!allowed()) { state.reason = 'opaque-coverage-retired'; return; }
        ctx.save();
        try {
            ctx.beginPath(); ctx.rect((region.x - sx) * scale, (region.y - sy) * scale, region.width * scale, region.height * scale); ctx.clip();
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#171a16';
            // This prefix was actually overwritten by opaque draws/clears.
            // The first64 copy leaves the uninitialized right2 on the LCD.
            ctx.clearRect((region.x - sx) * scale, (region.y - sy) * scale, region.width * scale, region.height * scale);
            clears.forEach(function (frame) { var u = entry.units[frame], p = entry.pictures.filter(function (v) { return v.picIndex === u.picIndex; })[0];
                ctx.clearRect((s.x + u.x - sx) * scale, (s.y + u.y - sy) * scale, p.logicalWidth * scale, p.logicalHeight * scale); });
            ctx.imageSmoothingEnabled = true;
            frames.forEach(function (frame) { var u = entry.units[frame], p = entry.pictures.filter(function (v) { return v.picIndex === u.picIndex; })[0];
                ctx.drawImage(assets.images[u.picIndex], (s.x + u.x - sx) * scale, (s.y + u.y - sy) * scale, p.logicalWidth * scale, p.logicalHeight * scale); });
            if (label) {
                var lx = (label.x - sx) * scale, ly = (label.y - sy) * scale, lw = label.length * 6 * scale;
                ctx.fillRect(lx, ly, lw, 12 * scale); ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, lw, 12 * scale); ctx.clip();
                ctx.font = (12 * scale) + 'px BayeUI, "Microsoft YaHei", sans-serif'; ctx.textBaseline = 'top';
                ctx.fillStyle = '#eed8a2'; ctx.fillText(label.text, lx, ly, lw); ctx.restore();
            }
            poses.forEach(function (pose) { var x = (pose.x - sx) * scale, y = (pose.y - sy) * scale;
                ctx.fillStyle = '#171a16'; ctx.fillRect(x, y, pose.width * scale, pose.height * scale);
                ctx.save(); ctx.beginPath(); ctx.rect(x, y, pose.width * scale, pose.height * scale); ctx.clip();
                ctx.font = 'bold ' + (pose.height * scale) + 'px Georgia, serif'; ctx.textBaseline = 'top';
                ctx.fillStyle = '#eed8a2'; ctx.fillText(String(pose.digit), x, y, 6 * scale); ctx.restore(); });
        } catch (error) { ctx.restore(); restore(); return; }
        ctx.restore();
        if (!allowed()) { restore(); return; }
        state.source = 'hd-assets'; state.reason = ''; state.frames = frames; state.opaqueRegion = region;
    }
    function skillWindow(s, entry) {
        var c = s.display && s.display.composition;
        // An opaque, equal native rectangle establishes only this bounded
        // window. Outside pixels continue to come from the actual LCD flush.
        if (!skillPostlude(s) || entry.skillResultVersion !== 1 || !c || c.valid !== true || c.mode !== 2 ||
            !integer(c.x) || !integer(c.y) || !integer(c.width) || !integer(c.height) || c.x < 0 || c.y < 0 ||
            c.width <= 0 || c.height <= 0 || c.x + c.width > W || c.y + c.height > H) return null;
        for (var f = entry.startFrm; f <= entry.endFrm; f++) {
            var unit = entry.units[f], pic = entry.pictures.filter(function (p) { return p.picIndex === unit.picIndex; })[0];
            if (!pic || pic.mask !== 0 || s.x + unit.x !== c.x || s.y + unit.y !== c.y ||
                pic.logicalWidth !== c.width || pic.logicalHeight !== c.height) return null;
        }
        return { x: c.x, y: c.y, width: c.width, height: c.height };
    }
    function skillLabel(s, region) {
        var label = s.display && s.display.label;
        if (!label || !label.claimed) return null;
        if (!label.valid || typeof label.text !== 'string' || !label.text || !integer(label.x) || !integer(label.y) ||
            !integer(label.length) || label.length < 1 || label.length > 63 || label.x < region.x || label.y < region.y ||
            label.x + label.length * 6 > region.x + region.width || label.y + 12 > region.y + region.height) return false;
        return label;
    }
    function byteBits(bits) {
        return Array.isArray(bits) && bits.length === 32 && bits.every(function (v) { return integer(v) && v >= 0 && v <= 255; });
    }
    function validAiEntry(entry) {
        if (entry.aiTargetVersion !== 2 || entry.maskSemantics !== 'native-and-or-v1' || entry.kind !== 4 ||
            entry.speId !== 27 || entry.resourceIndex !== 0 || entry.startFrm !== 12 || entry.endFrm !== 17 ||
            entry.count !== 18 || entry.picmax !== 9 || entry.compositionVersion != null || entry.skillResultVersion != null ||
            entry.background != null || entry.number != null || entry.skillNumber != null) return false;
        for (var f = 12; f <= 17; f++) {
            var unit = entry.units[f], pic = entry.pictures.filter(function (p) { return p.picIndex === unit.picIndex; })[0];
            if (unit.x !== 0 || unit.y !== 0 || unit.picIndex !== (f % 2 ? 8 : 7) || !pic || pic.mask !== 1 ||
                pic.logicalWidth !== 16 || pic.logicalHeight !== 16 || !byteBits(pic.nativeWhitePixels)) return false;
        }
        return true;
    }
    function statusRange(s) {
        return s.id === 27 && s.kind === 4 && (s.startFrm === 0 && s.endFrm === 5 || s.startFrm === 6 && s.endFrm === 11);
    }
    function validStatusEntry(entry) {
        if (entry.statusVersion !== 1 || entry.maskSemantics !== 'native-and-or-v1' ||
            !statusRange({ id: entry.speId, kind: entry.kind, startFrm: entry.startFrm, endFrm: entry.endFrm }) ||
            entry.resourceIndex !== 0 || entry.count !== 18 || entry.picmax !== 9 ||
            entry.statusReason !== (entry.startFrm === 0 ? 1 : 2) || entry.aiTargetVersion != null ||
            entry.compositionVersion != null || entry.skillResultVersion != null || entry.background != null || entry.number != null || entry.skillNumber != null) return false;
        var slots = entry.startFrm === 0 ? [2, 3, 4, 1, 0, 1] : [2, 3, 4, 6, 5, 6];
        for (var i = 0; i < slots.length; i++) {
            var unit = entry.units[entry.startFrm + i], pic = entry.pictures.filter(function (p) { return p.picIndex === slots[i]; })[0];
            if (unit.x !== 0 || unit.y !== 0 || unit.picIndex !== slots[i] || !pic || pic.mask !== 1 ||
                pic.logicalWidth !== 16 || pic.logicalHeight !== 16 || !byteBits(pic.nativeWhitePixels)) return false;
        }
        return true;
    }
    function statusSignature(s) {
        try { return JSON.stringify([s.active, s.protocolVersion, s.generation, s.eventId, s.id, s.kind, s.resourceIndex,
            s.x, s.y, s.count, s.picmax, s.startFrm, s.endFrm, s.keyflag, s.skipEligible, s.protocolValid, s.frameValid,
            s.resourceLength, s.resourceFingerprint, s.statusEffect, s.display]); }
        catch (error) { return ''; }
    }
    function aiSignature(s) {
        try { return JSON.stringify([s.active, s.protocolVersion, s.generation, s.eventId, s.id, s.kind, s.resourceIndex,
            s.x, s.y, s.count, s.picmax, s.startFrm, s.endFrm, s.keyflag, s.skipEligible, s.protocolValid, s.frameValid,
            s.resourceLength, s.resourceFingerprint, s.aiTarget, s.display]); }
        catch (error) { return ''; }
    }
    function validAiBase(ai) {
        if (!Array.isArray(ai.basePixels) || ai.basePixels.length !== 256 ||
            !ai.basePixels.every(function (v) { return integer(v) && v >= 0 && v <= 255; }) ||
            !Array.isArray(ai.baseRgba) || ai.baseRgba.length !== 1024 ||
            !ai.baseRgba.every(function (v) { return integer(v) && v >= 0 && v <= 255; })) return false;
        var seen = {};
        for (var p = 0; p < 256; p++) {
            var index = ai.basePixels[p], at = p * 4, earlier = seen[index];
            for (var channel = 0; channel < 4; channel++) {
                var byte = ai.baseRgba[at + channel];
                if (earlier !== undefined && byte !== ai.baseRgba[earlier + channel]) return false;
                if (index === 0 || index === 255) {
                    var palette = index === 0 ? ai.paletteZero : ai.paletteInk;
                    if (byte !== (palette >>> (channel * 8) & 255)) return false;
                }
            }
            if (earlier === undefined) seen[index] = at;
        }
        return true;
    }
    function aiTarget(s, entry) {
        var current = s.aiTarget, displayed = s.display && s.display.aiTarget;
        if (!validAiEntry(entry) || s.id !== 27 || s.kind !== 4 || s.resourceIndex !== 0 || s.keyflag !== 0 || s.skipEligible !== false ||
            !current || !displayed || current.protocolVersion !== 2 || displayed.protocolVersion !== 2 ||
            current.valid !== true || displayed.valid !== true || !matches(s) || !byteBits(displayed.clearFrames) ||
            !byteBits(current.clearFrames) || !integer(s.frameIndex) || s.frameIndex < 12 || s.frameIndex > 17 ||
            !integer(s.display.frameIndex) || s.display.frameIndex < 12 || s.display.frameIndex > s.frameIndex ||
            !integer(s.commitSeq) || s.display.commitSeq > s.commitSeq || !validAiBase(displayed)) return null;
        var fields = ['commandType', 'commandParam', 'actorIndex', 'targetIndex', 'actorPerson', 'targetPerson',
            'actorX', 'actorY', 'targetX', 'targetY', 'mapSX', 'mapSY', 'mapWidth', 'mapHeight',
            'screenWidth', 'screenHeight', 'regionX', 'regionY', 'regionWidth', 'regionHeight', 'paletteZero', 'paletteInk'];
        if (!fields.every(function (name) { return integer(displayed[name]) && current[name] === displayed[name]; }) ||
            !Array.isArray(current.basePixels) || current.basePixels.length !== 256 ||
            !current.basePixels.every(function (v, i) { return v === displayed.basePixels[i]; }) ||
            !Array.isArray(current.baseRgba) || current.baseRgba.length !== 1024 ||
            !current.baseRgba.every(function (v, i) { return v === displayed.baseRgba[i]; }) ||
            !(displayed.commandType === 0 && displayed.commandParam === 0 || displayed.commandType === 1 && displayed.commandParam > 0 && displayed.commandParam <= 65535) ||
            displayed.actorIndex < 10 || displayed.actorIndex >= 20 || displayed.targetIndex < 0 || displayed.targetIndex >= 20 ||
            displayed.actorPerson < 0 || displayed.actorPerson >= 2000 || displayed.targetPerson < 0 || displayed.targetPerson >= 2000 ||
            displayed.mapWidth < 1 || displayed.mapWidth > 255 || displayed.mapHeight < 1 || displayed.mapHeight > 255 ||
            displayed.actorX < 0 || displayed.actorX >= displayed.mapWidth || displayed.actorY < 0 || displayed.actorY >= displayed.mapHeight ||
            displayed.targetX < 0 || displayed.targetX >= displayed.mapWidth || displayed.targetY < 0 || displayed.targetY >= displayed.mapHeight ||
            displayed.mapSX < 0 || displayed.mapSX >= displayed.mapWidth || displayed.mapSY < 0 || displayed.mapSY >= displayed.mapHeight ||
            displayed.screenWidth !== W || displayed.screenHeight !== H || displayed.regionWidth !== 16 || displayed.regionHeight !== 16 ||
            displayed.regionX !== s.x || displayed.regionY !== s.y || displayed.regionX < 0 || displayed.regionY < 0 ||
            displayed.regionX + 16 > W || displayed.regionY + 16 > H ||
            displayed.regionX !== (displayed.targetX - displayed.mapSX) * 16 || displayed.regionY !== (displayed.targetY - displayed.mapSY) * 16 ||
            displayed.paletteZero !== 0x00ffffff || displayed.paletteInk !== 0xff000000) return null;
        var clears = [];
        for (var i = 0; i < 256; i++) {
            var bit = 1 << (i & 7), currentSet = current.clearFrames[i >> 3] & bit, displayedSet = displayed.clearFrames[i >> 3] & bit;
            if (currentSet && (i < 12 || i > s.frameIndex) || displayedSet && (i < 12 || i > s.display.frameIndex || !currentSet)) return null;
            if (displayedSet) clears.push(i);
        }
        return { source: displayed, clears: clears, x: displayed.regionX, y: displayed.regionY, width: 16, height: 16 };
    }
    function statusEffect(s, entry) {
        var current = s.statusEffect, displayed = s.display && s.display.statusEffect;
        if (!validStatusEntry(entry) || !statusRange(s) || s.resourceIndex !== 0 || s.keyflag !== 0 || s.skipEligible !== false ||
            !current || !displayed || current.protocolVersion !== 1 || displayed.protocolVersion !== 1 ||
            current.valid !== true || displayed.valid !== true || !matches(s) || !byteBits(displayed.clearFrames) ||
            !byteBits(current.clearFrames) || !integer(s.frameIndex) || s.frameIndex < s.startFrm || s.frameIndex > s.endFrm ||
            !integer(s.display.frameIndex) || s.display.frameIndex < s.startFrm || s.display.frameIndex > s.frameIndex ||
            !integer(s.commitSeq) || s.display.commitSeq > s.commitSeq || !validAiBase(displayed)) return null;
        var fields = ['reason', 'phase', 'subjectIndex', 'subjectPerson', 'subjectX', 'subjectY',
            'beforeLevel', 'afterLevel', 'beforeExperience', 'afterExperience', 'beforeState', 'afterState',
            'beforeHp', 'afterHp', 'beforeArms', 'afterArms', 'levelMax', 'mapSX', 'mapSY', 'mapWidth', 'mapHeight',
            'screenWidth', 'screenHeight', 'regionX', 'regionY', 'regionWidth', 'regionHeight', 'paletteZero', 'paletteInk'];
        if (!fields.every(function (name) { return integer(displayed[name]) && current[name] === displayed[name]; }) ||
            !Array.isArray(current.basePixels) || current.basePixels.length !== 256 ||
            !current.basePixels.every(function (v, i) { return v === displayed.basePixels[i]; }) ||
            !Array.isArray(current.baseRgba) || current.baseRgba.length !== 1024 ||
            !current.baseRgba.every(function (v, i) { return v === displayed.baseRgba[i]; }) ||
            displayed.reason !== entry.statusReason || (displayed.phase !== 1 && displayed.phase !== 2) ||
            displayed.subjectIndex < 0 || displayed.subjectIndex >= 20 || displayed.subjectPerson < 0 || displayed.subjectPerson >= 2000 ||
            !['beforeLevel', 'afterLevel', 'beforeExperience', 'afterExperience', 'beforeState', 'afterState', 'levelMax'].every(function (name) { return displayed[name] >= 0 && displayed[name] <= 255; }) ||
            !['beforeHp', 'afterHp', 'beforeArms', 'afterArms'].every(function (name) { return displayed[name] >= 0 && displayed[name] <= 65535; }) ||
            displayed.beforeState >= 8 || displayed.beforeHp !== displayed.afterHp || displayed.beforeArms !== displayed.afterArms ||
            displayed.reason === 1 && (displayed.beforeExperience < 100 || displayed.afterExperience !== displayed.beforeExperience - 100 ||
                displayed.afterLevel !== Math.min((displayed.beforeLevel + 1) & 255, displayed.levelMax) || displayed.afterState !== displayed.beforeState) ||
            displayed.reason === 2 && (displayed.afterState !== 8 || displayed.afterHp !== 0 && displayed.afterArms !== 0 ||
                displayed.afterLevel !== displayed.beforeLevel || displayed.afterExperience !== displayed.beforeExperience) ||
            displayed.mapWidth < 1 || displayed.mapWidth > 255 || displayed.mapHeight < 1 || displayed.mapHeight > 255 ||
            displayed.subjectX < 0 || displayed.subjectX >= displayed.mapWidth || displayed.subjectY < 0 || displayed.subjectY >= displayed.mapHeight ||
            displayed.mapSX < 0 || displayed.mapSX >= displayed.mapWidth || displayed.mapSY < 0 || displayed.mapSY >= displayed.mapHeight ||
            displayed.screenWidth !== W || displayed.screenHeight !== H || displayed.regionWidth !== 16 || displayed.regionHeight !== 16 ||
            displayed.regionX !== s.x || displayed.regionY !== s.y || displayed.regionX < 0 || displayed.regionY < 0 ||
            displayed.regionX + 16 > W || displayed.regionY + 16 > H ||
            displayed.regionX !== (displayed.subjectX - displayed.mapSX) * 16 || displayed.regionY !== (displayed.subjectY - displayed.mapSY) * 16 ||
            displayed.paletteZero !== 0x00ffffff || displayed.paletteInk !== 0xff000000) return null;
        var clears = [];
        for (var i = 0; i < 256; i++) {
            var bit = 1 << (i & 7), currentSet = current.clearFrames[i >> 3] & bit, displayedSet = displayed.clearFrames[i >> 3] & bit;
            if (currentSet && (i < s.startFrm || i > s.frameIndex) || displayedSet && (i < s.startFrm || i > s.display.frameIndex || !currentSet)) return null;
            if (displayedSet) clears.push(i);
        }
        return { source: displayed, clears: clears, x: displayed.regionX, y: displayed.regionY, width: 16, height: 16 };
    }
    function paintAiTarget(ctx, s, entry, assets, frames, scale, ticket) {
        paintCertifiedCell(ctx, s, entry, assets, frames, scale, ticket, aiTarget, aiSignature, 'ai-target');
    }
    function paintStatusEffect(ctx, s, entry, assets, frames, scale, ticket) {
        paintCertifiedCell(ctx, s, entry, assets, frames, scale, ticket, statusEffect, statusSignature, 'status-effect');
    }
    function paintCertifiedCell(ctx, s, entry, assets, frames, scale, ticket, validate, signature, reason) {
        var region = validate(s, entry);
        if (!region || frames.some(function (frame) { return frame > s.display.frameIndex; }) ||
            state.callbackFlushKey !== stamp(s)) { state.reason = reason + '-not-matched'; return; }
        if (!state.aiBase) state.aiBase = document.createElement('canvas');
        state.aiBase.width = state.aiBase.height = 16;
        var baseCtx = state.aiBase.getContext('2d');
        if (!baseCtx || typeof global.ImageData !== 'function' || typeof global.Uint8ClampedArray !== 'function') {
            state.reason = reason + '-pixels-unavailable'; return;
        }
        // The actual palette can include terrain gray. Keep the authenticated
        // RGBA bytes; Canvas owns transparent RGB normalization on readback.
        var pixels = new global.Uint8ClampedArray(region.source.baseRgba);
        if (region.clears.length) for (var p = 0; p < 256; p++)
            for (var channel = 0; channel < 4; channel++)
                pixels[p * 4 + channel] = region.source.paletteZero >>> (channel * 8) & 255;
        baseCtx.putImageData(new global.ImageData(pixels, 16, 16), 0, 0);
        // Native snapshots and asset authorization can retire during a read.
        // The final observation must still own the actual captured LCD bytes.
        verifyLib();
        var allowed = !document.hidden && hd(4) && !report(), fresh = info();
        if (!allowed || !fresh.active || !matches(fresh) || signature(fresh) !== ticket.signature || state.epoch !== ticket.epoch ||
            state.manifestGeneration !== ticket.manifestGeneration || state.libGeneration !== ticket.libGeneration ||
            state.libHash !== ticket.libHash || state.assets !== assets || state.callbackFlushKey !== stamp(fresh) ||
            !validate(fresh, entry)) { state.reason = reason + '-retired'; return; }
        var x = region.x * scale, y = region.y * scale, width = 16 * scale;
        ctx.save();
        try {
            ctx.beginPath(); ctx.rect(x, y, width, width); ctx.clip();
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
            ctx.clearRect(x, y, width, width);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(state.aiBase, 0, 0, 16, 16, x, y, width, width);
            frames.forEach(function (frame) {
                var unit = entry.units[frame], pic = entry.pictures.filter(function (p) { return p.picIndex === unit.picIndex; })[0];
                // AND0/OR0 is an explicit native clear, not alpha transparency.
                for (var bit = 0; bit < 256; bit++) if (pic.nativeWhitePixels[bit >> 3] & (1 << (bit & 7)))
                    ctx.clearRect(x + bit % 16 * scale, y + Math.floor(bit / 16) * scale, scale, scale);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(assets.images[unit.picIndex], x, y, width, width);
            });
        } catch (error) {
            ctx.restore();
            ctx.clearRect(0, 0, state.canvasW, state.canvasH);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(state.scratch, 0, 0, state.flushW, state.flushH, 0, 0, state.canvasW, state.canvasH);
            state.reason = reason + '-draw-failed'; return;
        }
        ctx.restore();
        state.source = 'hd-assets'; state.reason = ''; state.frames = frames;
        state.aiRegion = { x: region.x, y: region.y, width: 16, height: 16 };
    }
    function renderKey(s) { var size = screen(), entry = match(s); return stamp(s) + ':' + state.epoch + ':' + state.manifestGeneration + ':' + state.libGeneration + ':' + state.libHash + ':' + (state.assets && state.assets.status) + ':' + size.width + ':' + size.height + ':' + size.axScale + ':' + s.protocolValid + ':' + s.frameValid + ':' + matches(s) + (kind(s) === 4 ? ':' + (statusRange(s) ? statusSignature(s) : aiSignature(s)) : entry && entry.opaqueCoverageVersion === 1 ? ':' + opaqueSignature(s) : ''); }
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
        var resultScene = skillPostlude(s) && s.display && s.display.composition;
        var resultArena = !skillPostlude(s) || s.skillResult.sourceValid === true && s.display.valid === true &&
            resultScene && resultScene.valid === true && resultScene.mode === 2 && resultScene.x >= 15 && resultScene.y >= 16 &&
            resultScene.x + resultScene.width <= 145 && resultScene.y + resultScene.height <= 80;
        var declared = match(s), opaqueEntry = declared && declared.opaqueCoverageVersion != null;
        if (baseline && k !== 1 && k !== 4 && s.ownerType !== 'result-lcd' && resultArena && !opaqueEntry && !(k === 2 && (Number(s.id) === 37 || Number(s.id) === 40 || Number(s.id) === 41 || Number(s.id) === 39 && qimenSkillContext(s) !== 20))) {
            // FGT_SPESX/Y center the native arena. An individual effect's
            // origin can be offset inside it and must not move the LCD crop.
            sx = (size.width - 130) / 2;
            sy = (size.height - 64) / 2;
            sw = 130;
            sh = 64;
        }
        // Map result numbers (LookMovie0/no movie) and overwritten parents
        // have no certified arena. Their actual target may be anywhere on LCD.
        state.sourceRect = { x: sx, y: sy, width: sw, height: sh };
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
        state.aiRegion = null;
        state.opaqueRegion = null;
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
        var clears = [], poses = [], region = null, label = null;
        if (entry.opaqueCoverageVersion != null) {
            clears = cleared(s); poses = numberPoses(s, entry); region = clears && opaqueCoverage(s, entry, frames, clears);
            label = skillPostlude(s) && region ? skillLabel(s, region) : null;
            if (!region || !clears || !poses || label === false || poses.length && !label ||
                poses.some(function (p) { return p.x < region.x || p.y < region.y || p.x + p.width > region.x + region.width || p.y + p.height > region.y + region.height; })) {
                state.reason = 'opaque-coverage-not-matched'; return;
            }
        } else if (skillPostlude(s)) {
            region = skillWindow(s, entry); clears = cleared(s); poses = numberPoses(s, entry);
            label = region && skillLabel(s, region);
            if (!region || !clears || !poses || label === false || poses.length && !label ||
                poses.some(function (p) { return p.x < region.x || p.y < region.y || p.x + p.width > region.x + region.width || p.y + p.height > region.y + region.height; })) {
                state.reason = 'skill-composition-not-matched'; return;
            }
        } else if (entry.compositionVersion === 1) {
            clears = cleared(s);
            poses = numberPoses(s, entry);
            if (!clears || !poses || !sameSource(entry.background, s.display.composition && s.display.composition.background)) {
                state.reason = 'composition-not-matched';
                return;
            }
        } else if (postlude(s)) { state.reason = 'composition-not-matched'; return; }
        var assets = load(entry);
        state.renderKey = renderKey(s);
        if (assets.status !== 'ready') {
            state.reason = assets.status === 'failed' ? 'asset-load-failed' : 'assets-loading';
            return;
        }
        if (k === 4) {
            var status = statusRange(s);
            (status ? paintStatusEffect : paintAiTarget)(ctx, s, entry, assets, frames, scale, { signature: status ? statusSignature(s) : aiSignature(s), epoch: state.epoch,
                manifestGeneration: state.manifestGeneration, libGeneration: state.libGeneration, libHash: state.libHash });
            return;
        }
        if (entry.opaqueCoverageVersion != null) {
            paintOpaqueCoverage(ctx, s, entry, assets, frames, clears, region, label, poses, scale, sx, sy); return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.fillStyle = '#171a16';
        if (!region) ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.beginPath();
        if (region) ctx.rect((region.x - sx) * scale, (region.y - sy) * scale, region.width * scale, region.height * scale);
        else ctx.rect(0, 0, w, h);
        ctx.clip();
        if (entry.compositionVersion === 1) {
            var background = entry.background;
            ctx.drawImage(assets.images.background, (background.x - sx) * scale, (background.y - sy) * scale,
                background.logicalWidth * scale, background.logicalHeight * scale);
        }
        clears.forEach(function (frame) {
            var unit = entry.units[frame], picture = entry.pictures.filter(function (p) { return p.picIndex === unit.picIndex; })[0];
            ctx.fillRect((s.x + unit.x - sx) * scale, (s.y + unit.y - sy) * scale, picture.logicalWidth * scale, picture.logicalHeight * scale);
        });
        for (var i = 0; i < frames.length; i++) {
            var unit = entry.units[frames[i]], picture = entry.pictures.filter(function (p) { return p.picIndex === unit.picIndex; })[0];
            ctx.drawImage(assets.images[unit.picIndex], (s.x + unit.x - sx) * scale, (s.y + unit.y - sy) * scale, picture.logicalWidth * scale, picture.logicalHeight * scale);
        }
        if (label) {
            var lx = (label.x - sx) * scale, ly = (label.y - sy) * scale, lw = label.length * 6 * scale;
            ctx.fillStyle = '#171a16'; ctx.fillRect(lx, ly, lw, 12 * scale);
            ctx.save(); ctx.beginPath(); ctx.rect(lx, ly, lw, 12 * scale); ctx.clip();
            ctx.font = (12 * scale) + 'px BayeUI, "Microsoft YaHei", sans-serif'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#eed8a2'; ctx.fillText(label.text, lx, ly, lw); ctx.restore();
        }
        // Replay only the real displayed contiguous numeric draws. An opaque
        // glyph clears its full native box; old bottom footprints survive an
        // upward pose. Fit HD text to the native six-pixel advance so the next
        // opaque box cannot erase the right half of a displayed numeral.
        poses.forEach(function (pose) {
            var x = (pose.x - sx) * scale, y = (pose.y - sy) * scale;
            ctx.fillStyle = '#171a16'; ctx.fillRect(x, y, pose.width * scale, pose.height * scale);
            ctx.save(); ctx.beginPath(); ctx.rect(x, y, pose.width * scale, pose.height * scale); ctx.clip();
            ctx.font = 'bold ' + (pose.height * scale) + 'px Georgia, serif'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#eed8a2'; ctx.fillText(String(pose.digit), x, y, 6 * scale);
            ctx.restore();
        });
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
        root.classList.toggle('is-status', shown && kind(s) === 4);
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
            title.textContent = kind(s) === 4 ? (statusRange(s) ? (s.startFrm === 0 ? '升级提示' : '战场退场提示') : 'AI目标提示') : Number(s.id) === 6 ? '制作群组' : kind(s) === 1 ? '开场动画' : (kind(s) === 2 ? '计谋动画' : '战斗动画');
        if (shown) {
            verifyLib();
            if (noPaint !== true)
                paint(s);
        }
        else { verifyLib(); warmArena(); }
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
                event: state.event, flushKey: state.flushKey, sourceRect: state.sourceRect || null, libSha256: state.libHash, preparing: state.preparing,
                preparation: state.preparation, cachedResources: state.cache.length, cachedImages: Object.keys(state.imageCache).length,
                ownerToken: event(s) + ':' + state.epoch,
                maker: s.maker, attack: s.attack, skillResult: s.skillResult, resultOwner: s.resultOwner,
                hdRegion: state.source === 'hd-assets' && state.opaqueRegion ? state.opaqueRegion : kind(s) === 4 && state.source === 'hd-assets' ? state.aiRegion : skillPostlude(s) && state.source === 'hd-assets' ? s.display.composition : null,
                outsideSource: state.opaqueRegion || skillPostlude(s) || kind(s) === 4 ? 'lcd' : null,
                aiTarget: kind(s) === 4 && s.display ? s.display.aiTarget : null,
                statusEffect: statusRange(s) && s.display ? s.display.statusEffect : null,
                presentation: kind(s) === 4 ? (statusRange(s) ? 'status-effect' : 'ai-target') : s.ownerType === 'result-lcd' ? 'result-lcd' : skillPostlude(s) ? 'skill-postlude' : postlude(s) ? 'attack-postlude' : held(s) ? 'maker-hold' : 'spe', spe: s.nativeSpe || s };
        } };
    if (global.BayeHdLibIdentity) {
        global.BayeHdLibIdentity.subscribe(function () { verifyLib(); sync(); });
    }
})(window);
