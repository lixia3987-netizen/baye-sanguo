/** R21 read-only browser observer and independent standard-LIB WOOD37 oracle.
 * This module neither starts a browser nor supplies game inputs or world data.
 * The driver must inject only this observer, retain raw evidence, and separately
 * prove genuine preparation, current player command/AIM and process cleanup.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

export const woodObserverSource = '(' + function () {
    const captures = [], samples = [], keys = [], errors = [];
    window.__woodCaptures = window.__skillCaptures = captures;
    window.__woodSamples = window.__speSamples = samples;
    window.__woodEngineKeys = window.__speEngineKeys = keys;
    window.__woodObserverErrors = window.__speObserverErrors = errors;
    window.__spePhase = 'opening';
    let api = null, keyInstalled = false, last = null, drawLog = [];
    const held = new Set(), wrappedApis = new WeakSet();
    const copy = v => JSON.parse(JSON.stringify(v));
    const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
    const snap = () => {
        try {
            if (!window.baye || !baye.hd || !baye.hd.ready()) return null;
            return copy({ spe: baye.hd.spe(), result: baye.hd.skillResult(), top: baye.hd.resultOwner(), fight: baye.hd.fight() });
        } catch (e) { errors.push('native snapshot: ' + String(e)); return null; }
    };
    for (const name of ['clearRect', 'drawImage', 'fillRect', 'fillText', 'rect', 'clip']) {
        const original = CanvasRenderingContext2D.prototype[name];
        CanvasRenderingContext2D.prototype[name] = function () {
            const result = original.apply(this, arguments);
            try {
                if (this.canvas && this.canvas.id === 'hd-spe-canvas') {
                    const args = Array.from(arguments);
                    if (name === 'clearRect' && args[0] === 0 && args[1] === 0 && args[2] === this.canvas.width && args[3] === this.canvas.height) drawLog = [];
                    const op = { type: name, args, fillStyle: this.fillStyle, font: this.font, globalAlpha: this.globalAlpha, composite: this.globalCompositeOperation };
                    if (name === 'drawImage') {
                        const source = args.shift(); op.src = source.src ? new URL(source.src, location.href).pathname.replace(/^\//, '') : null;
                        op.sourceKind = source.tagName || 'canvas'; op.sourceId = source.id || null;
                        op.naturalWidth = source.naturalWidth || source.width; op.naturalHeight = source.naturalHeight || source.height;
                    }
                    if (name === 'fillText') op.text = String(args.shift());
                    drawLog.push(op);
                }
            } catch (e) { errors.push('draw observer: ' + String(e)); }
            return result;
        };
    }
    function record(stage, img, width, height, callbackBefore, callbackAfter, rgbaBefore, rgbaAfter) {
        try {
            const s = snap(); if (!s) return;
            const spe = s.spe, result = s.result, ui = api && api.debugSnapshot(), now = performance.now();
            samples.push({ stage, at: now, phase: window.__spePhase, spe, result, top: s.top, fight: s.fight, ui });
            if (spe.active === 1 && spe.id === 37 && spe.kind === 2 && [6, 7].includes(spe.skillId)) last = { generation: spe.generation, eventId: spe.eventId, skillId: spe.skillId, actorIndex: spe.actorIndex, targetIndex: spe.targetIndex };
            const nativeOwner = result.active === true && result.speId === 37 && [6, 7].includes(result.skillId);
            const holdKey = result.generation + ':' + result.session;
            const readback = stage === 'lifecycle' && nativeOwner && result.phase === 'hold' && result.display.valid && !held.has(holdKey);
            if (readback) {
                const lcd = document.getElementById('lcd'); if (!lcd) throw Error('Native LCD missing at hold');
                img = lcd.getContext('2d').getImageData(0, 0, lcd.width, lcd.height); width = lcd.width; height = lcd.height; held.add(holdKey);
            }
            if ((stage === 'lcd-flush' || readback) && img && (nativeOwner || last)) {
                const before = snap(), d = baye.data, native = document.createElement('canvas'), hd = document.getElementById('hd-spe-canvas'), lcd = document.getElementById('lcd');
                native.width = width || img.width; native.height = height || img.height;
                const raw = new Uint8ClampedArray(img.data); native.getContext('2d').putImageData(new ImageData(raw, native.width, native.height), 0, 0);
                const paletteReadback = Array.from({ length: 256 }, (_, i) => Number(d.g_paintPalette[i]) >>> 0), inverse = new Map();
                paletteReadback.forEach((v, i) => { const k = String(v); inverse.set(k, inverse.has(k) ? -1 : i); });
                const nativeIndices = [], ambiguousPixelCount = { value: 0 };
                for (let i = 0; i < raw.length; i += 4) {
                    const color = (raw[i] | raw[i + 1] << 8 | raw[i + 2] << 16 | raw[i + 3] << 24) >>> 0;
                    const index = inverse.has(String(color)) ? inverse.get(String(color)) : -1;
                    nativeIndices.push(index); if (index < 0) ambiguousPixelCount.value++;
                }
                const rect = ui && ui.sourceRect; let hdLogicalRgba = null;
                if (hd && ui.open && rect && hd.width === rect.width * ui.scale && hd.height === rect.height * ui.scale) {
                    const pixels = hd.getContext('2d').getImageData(0, 0, hd.width, hd.height).data, logical = [];
                    for (let y = 0; y < rect.height; y++) for (let x = 0; x < rect.width; x++) {
                        const p = (Math.floor((y + .5) * ui.scale) * hd.width + Math.floor((x + .5) * ui.scale)) * 4;
                        for (let ch = 0; ch < 4; ch++) logical.push(pixels[p + ch]);
                    }
                    hdLogicalRgba = b64(logical);
                }
                const node = document.getElementById('hd-spe'), r = hd && hd.getBoundingClientRect(), style = hd && getComputedStyle(hd), rootStyle = node && getComputedStyle(node);
                const top = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                const dom = r && { x: r.x, y: r.y, width: r.width, height: r.height, visible: !!(r.width && r.height && style.visibility === 'visible' && style.display !== 'none' && rootStyle.visibility === 'visible' && rootStyle.display !== 'none'), inViewport: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, stackOwned: !!(top && node.contains(top)), cssBackground: style.backgroundColor, top: top && { id: top.id, className: top.className } };
                let lcdDom = null, nativeCanvasRgba = null, nativeCanvasUrl = null, nativeCanvasWidth = null, nativeCanvasHeight = null;
                if (lcd) {
                    const lr = lcd.getBoundingClientRect(), chain = []; let ancestor = lcd;
                    while (ancestor) { const cs = getComputedStyle(ancestor); chain.push({ id: ancestor.id, tag: ancestor.tagName, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, cssBackground: cs.backgroundColor }); ancestor = ancestor.parentElement; }
                    const points = [[.5, .5], [.25, .35], [.75, .65]].map(([px, py]) => { const x = lr.x + lr.width * px, y = lr.y + lr.height * py, front = document.elementFromPoint(x, y); return { x, y, top: front && { id: front.id, tag: front.tagName, className: front.className }, canvasAtFront: front === lcd }; });
                    lcdDom = { x: lr.x, y: lr.y, width: lr.width, height: lr.height, viewport: { width: innerWidth, height: innerHeight }, chain, points, visible: !!(lr.width && lr.height && chain.every(v => v.display !== 'none' && v.visibility !== 'hidden' && v.visibility !== 'collapse' && Number(v.opacity) > 0)), inViewport: lr.x >= 0 && lr.y >= 0 && lr.right <= innerWidth + .5 && lr.bottom <= innerHeight + .5 };
                    nativeCanvasWidth = lcd.width; nativeCanvasHeight = lcd.height;
                    nativeCanvasRgba = b64(lcd.getContext('2d').getImageData(0, 0, lcd.width, lcd.height).data); nativeCanvasUrl = lcd.toDataURL('image/png');
                }
                const count = baye.getPersonCount(), units = Array.from({ length: 20 }, (_, i) => {
                    const id = Number(d.g_FgtParam.GenArray[i]); if (!id) return { i, id: 0 };
                    if (id < 1 || id > count) throw Error('Actual battle ID outside native count');
                    const p = d.g_Persons[id - 1], pos = d.g_GenPos[i];
                    return { i, id, personIndex: id - 1, x: Number(pos.x), y: Number(pos.y), state: Number(pos.state), hp: Number(pos.hp), mp: Number(pos.mp), active: Number(pos.active), arms: Number(p.Arms), level: Number(p.Level), experience: Number(p.Experience), iq: Number(p.IQ), armType: baye.hd.personArmType(id - 1) };
                });
                const nativeUrl = native.toDataURL('image/png'), hdUrl = hd && ui.open ? hd.toDataURL('image/png') : null, after = snap();
                captures.push({ stage: readback ? 'held-lcd-readback' : 'lcd-flush', rawSource: readback ? 'canvas-readback-normalized' : 'lcd-callback-image-data', at: now, phase: window.__spePhase, callbackBefore, callbackAfter, callbackRgbaBefore: rgbaBefore, callbackRgbaAfter: rgbaAfter, before, after, spe, result, top: s.top, fight: s.fight, ui, dom, lcdDom, nativeCanvasRgba, nativeCanvasUrl, nativeCanvasWidth, nativeCanvasHeight, lastWood: last, units, hidden: document.hidden, mode: window.BayeHdBattle && BayeHdBattle.getMode(), drawing: { scale: Number(d.g_scale), flip: Number(d.g_FlipDrawing), paint: Number(d.g_paintColor), palette0: paletteReadback[0], palette255: paletteReadback[255] }, paletteReadback, nativeIndices, indexedSource: 'unique actual palette inverse of captured RGBA; -1 is ambiguous/unmapped, not a native surface read', ambiguousPixelCount: ambiguousPixelCount.value, nativeWidth: native.width, nativeHeight: native.height, nativeRgba: b64(raw), hdLogicalRgba, nativeUrl, hdUrl, drawLog: copy(drawLog) });
            }
            if (samples.length > 100000 || captures.length > 4000) throw Error('Bounded wood capture capacity exceeded');
        } catch (e) { errors.push('wood capture: ' + String(e)); }
    }
    Object.defineProperty(window, 'BayeHdSpe', { configurable: true, get() { return api; }, set(value) {
        api = value;
        if (!api || wrappedApis.has(api)) return;
        wrappedApis.add(api);
        for (const name of ['onEngineSpe', 'onLcdFlush']) {
            const original = api[name];
            api[name] = function () {
                const before = snap(), rgbaBefore = name === 'onLcdFlush' && arguments[0] ? b64(new Uint8ClampedArray(arguments[0].data)) : null;
                const result = original.apply(this, arguments);
                const after = snap(), rgbaAfter = name === 'onLcdFlush' && arguments[0] ? b64(new Uint8ClampedArray(arguments[0].data)) : null;
                record(name === 'onLcdFlush' ? 'lcd-flush' : 'lifecycle', name === 'onLcdFlush' ? arguments[0] : null, arguments[1], arguments[2], before, after, rgbaBefore, rgbaAfter);
                return result;
            };
        }
        if (!keyInstalled && typeof window.sendKey === 'function') {
            keyInstalled = true; const original = window.sendKey;
            window.sendKey = function (code) {
                const s = snap(); keys.push({ code, at: performance.now(), phase: window.__spePhase, generation: s && s.spe.generation, eventId: s && s.spe.eventId, kind: s && s.spe.kind, speId: s && s.spe.id, speActive: s && s.spe.active, resultActive: s && s.result.active, resultSession: s && s.result.session, resultPhase: s && s.result.phase, resultSpeId: s && s.result.speId });
                return original.apply(this, arguments);
            };
        }
    } });
}.toString() + ')();';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const W = 160, H = 96, SIZE = W * H * 4;
const bits = b => { assert.ok(Array.isArray(b) && b.length === 32 && b.every(n => Number.isInteger(n) && n >= 0 && n <= 255), 'Complete byte bitset'); return Array.from({ length: 256 }, (_, i) => i).filter(i => b[i >> 3] & 1 << (i & 7)); };
const normalized = b => { const out = Buffer.from(b); for (let i = 0; i < out.length; i += 4) if (out[i + 3] === 0) out.fill(0, i, i + 4); return out; };
function item(lib, id, index = 0) {
    assert.ok(Buffer.isBuffer(lib) && lib.length > id * 4); const a = lib.readUInt32LE((id - 1) * 4);
    assert.ok(a > 0 && a + 14 <= lib.length); const length = lib.readUInt32LE(a), count = lib.readUInt16LE(a + 6), fixed = lib.readUInt32LE(a + 8);
    assert.equal(lib.readUInt16LE(a + 4), id); assert.equal(lib[a + 12], 0); assert.ok(index >= 0 && index < count && a + length <= lib.length);
    const offset = fixed ? 14 + index * fixed : count === 1 ? 14 : lib.readUInt32LE(a + 14 + index * 8);
    const size = fixed || (count === 1 ? length - 14 : lib.readUInt32LE(a + 18 + index * 8));
    assert.ok(offset >= 14 && size > 0 && offset + size <= length); return lib.subarray(a + offset, a + offset + size);
}
function fnv(b) { let h = 2166136261; for (const n of b) h = Math.imul(h ^ n, 16777619) >>> 0; return 'fnv1a32:' + h.toString(16).padStart(8, '0') + ':' + b.length; }
function picture(b, offset = 0, all = false) {
    assert.ok(offset + 7 <= b.length); const width = b.readUInt16LE(offset), height = b.readUInt16LE(offset + 2), count = b.readUInt16LE(offset + 4), mask = b[offset + 6], rowBytes = Math.ceil(width / 8), planeBytes = rowBytes * height;
    assert.ok(width && height && count && mask <= 1); const length = 7 + planeBytes * (mask + 1) * (all ? count : 1); assert.ok(offset + length <= b.length);
    return { width, height, count, mask, rowBytes, planeBytes, length, data: b.subarray(offset + 7, offset + length) };
}
function movie(lib) {
    const payload = item(lib, 37), count = payload[2], picmax = payload[3];
    assert.deepEqual([count, picmax, payload[4], payload[5], payload.length, fnv(payload)], [8, 2, 0, 7, 1148, 'fnv1a32:d38c3c8b:1148']);
    const units = Array.from({ length: count }, (_, i) => { const o = 6 + i * 5; return { x: payload[o], y: payload[o + 1], cdelay: payload[o + 2], ndelay: payload[o + 3], picIndex: payload[o + 4] }; });
    assert.deepEqual(units, Array.from({ length: 8 }, (_, i) => ({ x: 0, y: 0, cdelay: 20, ndelay: 20, picIndex: i % 2 })));
    let offset = 46; const pictures = Array.from({ length: 2 }, () => { const p = picture(payload, offset); offset += p.length; return p; });
    assert.equal(offset, payload.length); assert.deepEqual(pictures.map(p => [p.width, p.height, p.count, p.mask]), [[64, 64, 1, 0], [66, 64, 1, 0]]);
    return { units, pictures, fingerprint: fnv(payload), length: payload.length };
}
function paint(out, p, x, y, slot = 0) {
    const data = p.data.subarray(slot * p.planeBytes * (p.mask + 1));
    for (let row = 0; row < p.height; row++) for (let col = 0; col < p.width; col++) {
        const dx = x + col, dy = y + row; assert.ok(dx >= 0 && dx < W && dy >= 0 && dy < H);
        const o = row * p.rowBytes + (col >> 3), bit = 128 >> (col & 7), at = dy * W + dx;
        out[at] = p.mask ? (data[o] & bit ? out[at] : 0) | (data[p.planeBytes + o] & bit ? 255 : 0) : data[o] & bit ? 255 : 0;
    }
}
function counter(m, end) {
    const pixels = Buffer.alloc(W * H), spec = m.units.slice(0, end + 1).map(u => u.cdelay), next = m.units.slice(0, end + 1).map(u => u.ndelay), clears = Buffer.alloc(32), records = [];
    let introduced = 0, previous = 0, cls = true, show = true, width = 0;
    for (let loop = 0; loop < 100000; loop++) {
        for (let i = 0; i <= introduced; i++) {
            if (spec[i] === 1) { const p = m.pictures[m.units[i].picIndex]; for (let y = 16; y < 80; y++) pixels.fill(0, y * W + 48, y * W + 48 + p.width); width = Math.max(width, p.width); clears[i >> 3] |= 1 << (i & 7); cls = true; }
            if (spec[i]) spec[i] = spec[i] - 1 & 255;
        }
        const draw = i => { const p = m.pictures[m.units[i].picIndex]; paint(pixels, p, 48, 16); width = Math.max(width, p.width); };
        if (cls) for (let i = 0; i <= previous; i++) if (spec[i]) draw(i);
        if (show) { for (let i = previous + 1; i <= introduced; i++) if (spec[i]) draw(i); previous = introduced; }
        if (cls || show) { const visible = Buffer.alloc(32); for (let i = 0; i <= introduced; i++) if (spec[i]) visible[i >> 3] |= 1 << (i & 7); records.push({ frame: introduced, visible, clears: Buffer.from(clears), pixels: Buffer.from(pixels), width }); cls = show = false; }
        if (next[introduced]) next[introduced]--; while (next[introduced] <= 1 && introduced < end) { introduced++; show = true; }
        if (introduced === end && spec.slice(0, introduced + 1).every(n => n <= 1)) return records;
    }
    throw Error('Independent native timer bound exceeded');
}
function crc32(b) { let crc = 0xffffffff; for (const n of b) { crc ^= n; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function png(b) {
    assert.deepEqual(b.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); let at = 8, width, height, channels; const chunks = [];
    while (at < b.length) { const n = b.readUInt32BE(at), type = b.toString('ascii', at + 4, at + 8); assert.ok(at + 12 + n <= b.length); const data = b.subarray(at + 8, at + 8 + n); assert.equal(crc32(b.subarray(at + 4, at + 8 + n)), b.readUInt32BE(at + 8 + n), 'Original PNG CRC');
        if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); assert.deepEqual([data[8], data[10], data[11], data[12]], [8, 0, 0, 0]); assert.ok([2, 6].includes(data[9])); channels = data[9] === 6 ? 4 : 3; }
        if (type === 'IDAT') chunks.push(data); at += n + 12; if (type === 'IEND') break;
    }
    assert.equal(at, b.length); assert.ok(width && height && channels); const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels; assert.equal(raw.length, (stride + 1) * height); const decoded = Buffer.alloc(stride * height);
    const paeth = (a, b, c) => { const p = a + b - c, aa = Math.abs(p - a), bb = Math.abs(p - b), cc = Math.abs(p - c); return aa <= bb && aa <= cc ? a : bb <= cc ? b : c; };
    for (let y = 0; y < height; y++) { const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4); for (let x = 0; x < stride; x++) { const left = x >= channels ? decoded[y * stride + x - channels] : 0, up = y ? decoded[(y - 1) * stride + x] : 0, ul = y && x >= channels ? decoded[(y - 1) * stride + x - channels] : 0; decoded[y * stride + x] = raw[y * (stride + 1) + x + 1] + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, ul) : 0) & 255; } }
    const rgba = Buffer.alloc(width * height * 4); for (let i = 0; i < width * height; i++) { rgba[i * 4] = decoded[i * channels]; rgba[i * 4 + 1] = decoded[i * channels + 1]; rgba[i * 4 + 2] = decoded[i * channels + 2]; rgba[i * 4 + 3] = channels === 4 ? decoded[i * channels + 3] : 255; }
    return { width, height, rgba };
}
function imageBytes(c, type, artifactDir) {
    assert.ok(['native', 'hd', 'lcd'].includes(type));
    const url = c[type === 'native' ? 'nativeUrl' : type === 'lcd' ? 'nativeCanvasUrl' : 'hdUrl'], record = c[type === 'native' ? 'nativeFile' : type === 'lcd' ? 'lcdFile' : 'hdFile']; let bytes;
    if (url) { assert.ok(url.startsWith('data:image/png;base64,')); bytes = Buffer.from(url.split(',')[1], 'base64'); }
    else { assert.ok(record && artifactDir, 'Raw PNG or retained file and artifactDir required'); const f = path.resolve(artifactDir, record.file); assert.ok(f.startsWith(path.resolve(artifactDir) + path.sep)); bytes = fs.readFileSync(f); }
    if (record) { assert.equal(bytes.length, record.bytes); assert.equal(sha(bytes), record.sha256); } return bytes;
}
function asset(assets, name) { const a = assets instanceof Map ? assets.get(name) : assets && assets[name]; assert.ok(a && Buffer.isBuffer(a.data || a), 'Frozen asset bytes: ' + name); return a.data || a; }
function nativeLabel(lib, assets, kind) {
    const text = asset(assets, 'vendor/iBaye/src/data/pstring.h').toString('utf8').replace(/\/\*[\s\S]*?\*\//g, ''), body = text.match(/enum\s*\{([\s\S]*?)\}/)[1], names = new Map(); let index = 0;
    for (const s of body.split(',')) { const m = /\b(\w+)\s*(?:=\s*(\d+))?/.exec(s); if (m) { index = m[2] ? Number(m[2]) : index + 1; names.set(m[1], index); } }
    const name = kind === 1 ? 'dFgtArmsH' : 'dFgtArmsA', payload = item(lib, 1, names.get(name) - 1), zero = payload.indexOf(0), bytes = payload.subarray(0, zero < 0 ? payload.length : zero);
    assert.ok(bytes.length && bytes.length < 25); return { name, bytes };
}
function fontPaint(out, bytes, x, y, font) {
    for (let i = 0; i < bytes.length;) { const first = bytes[i++], ascii = first < 128, code = ascii ? first : first << 8 | bytes[i++], index = ascii ? 94 * (0xa4 - 0xa1) + code - 0x21 : 94 * ((code >> 8) - 0xa1) + (code & 255) - 0xa1, offset = index * 18, width = ascii ? 6 : 12; assert.ok(offset >= 0 && offset + 18 <= font.length); for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < width; xx++) { const bit = yy * 12 + xx; out[(y + yy) * W + x + xx] = font[offset + (bit >> 3)] & 128 >> (bit & 7) ? 255 : 0; } x += width; }
}
function verifyClassicCapture(c, raw, artifactDir) {
    assert.equal(c.mode, 'classic'); assert.equal(c.hidden, false); assert.equal(c.ui.open, false); assert.equal(c.ui.source, 'lcd'); assert.equal(c.ui.skipVisible, false); assert.equal(c.ui.hdRegion, null);
    assert.equal(c.hdLogicalRgba, null); assert.ok(!c.hdUrl && !c.hdFile, 'Classic evidence cannot substitute an old HD canvas');
    const d = c.lcdDom; assert.ok(d && d.visible === true && d.inViewport === true, 'Actual classic LCD is visible and inside viewport');
    assert.ok(Array.isArray(d.chain) && d.chain.length && d.chain[0].id === 'lcd' && d.chain.every(v => v.display !== 'none' && v.visibility !== 'hidden' && v.visibility !== 'collapse' && Number(v.opacity) > 0));
    assert.ok([d.x, d.y, d.width, d.height, d.viewport?.width, d.viewport?.height].every(Number.isFinite));
    assert.ok(d.x >= 0 && d.y >= 0 && d.width > 0 && d.height > 0 && d.x + d.width <= d.viewport.width + .5 && d.y + d.height <= d.viewport.height + .5);
    assert.ok(Array.isArray(d.points) && d.points.length === 3 && d.points.every(p => p.canvasAtFront === true && p.top && p.top.id === 'lcd' && p.x >= d.x && p.x <= d.x + d.width && p.y >= d.y && p.y <= d.y + d.height), 'Three actual classic LCD points are in front of overlays');
    assert.deepEqual([c.nativeCanvasWidth, c.nativeCanvasHeight], [W, H]);
    const actual = Buffer.from(c.nativeCanvasRgba, 'base64'); assert.equal(actual.length, SIZE); assert.deepEqual(actual, normalized(raw), 'Visible LCD canvas is exactly actual callback RGBA after native Canvas transparent-RGB normalization');
    const image = png(imageBytes(c, 'lcd', artifactDir)); assert.deepEqual([image.width, image.height], [W, H]); assert.deepEqual(image.rgba, actual, 'Original visible LCD PNG is the actual LCD readback, not an offscreen callback copy');
    assert.ok(Array.isArray(c.drawLog) && !c.drawLog.some(op => op.type === 'fillRect' || op.type === 'fillText' || op.type === 'drawImage' && op.src), 'Classic does not paint replacement artwork or typography');
}

/** Throws on missing/invalid evidence. Returns proof; never mutates report/world.
 * Required report: woodAttempts, woodCaptures (or skillCaptures), engineInputs,
 * observerErrors, woodRetired. assets maps frozen repository paths to Buffer or
 * {data:Buffer,metadata}; font is the original decoded native font.bin.c bytes.
 */
export function verifyWoodCaptures(report, { library, font, assets, artifactDir, allowLcd = false, expectClassic = false } = {}) {
    assert.ok(!expectClassic || allowLcd === true, 'Classic is an explicit negative presentation, never strict HD acceptance');
    assert.ok(Buffer.isBuffer(library), 'Original library bytes required');
    assert.equal(sha(library), '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    assert.ok(Buffer.isBuffer(font)); assert.equal(font.length, 163840); assert.equal(sha(font), '31197c48c77e82bc244b17f44e405a3a055df8162af06fadd7271cc1990cc6b8');
    const manifest = JSON.parse(asset(assets, 'assets/hd-spe/manifest.json').toString('utf8')), m = movie(library), numberBytes = item(library, 15), num = picture(numberBytes, 0, true), captures = report.woodCaptures || report.skillCaptures;
    assert.equal(manifest.libSha256, sha(library)); assert.deepEqual([num.width, num.height, num.count, num.mask, numberBytes.length, fnv(numberBytes)], [12, 16, 10, 0, 327, 'fnv1a32:b37d7407:327']);
    assert.ok(Array.isArray(captures) && captures.length); assert.deepEqual(report.observerErrors, []); assert.ok(Array.isArray(report.engineInputs));
    const attempts = [6, 7].map(skill => { const a = report.woodAttempts && report.woodAttempts.find(a => a.succeeded === true && (a.skillId || a.skill?.id || a.skill) === skill); assert.ok(a, 'Actual successful player skill' + skill + ' attempt required'); assert.ok(a.actor && a.target && a.before && a.after && a.confirmation && Array.isArray(a.movieEvents) && a.movieEvents.length, 'Real attempt owner/current AIM/player confirm evidence required'); return { skill, attempt: a }; });
    const events = new Map(), verified = [], families = [];
    for (const { skill, attempt } of attempts) {
        const end = skill === 6 ? 7 : 0, width = skill === 6 ? 66 : 64, actorIndex = attempt.actor.i, targetIndex = attempt.target.i;
        assert.ok(Number.isInteger(actorIndex) && actorIndex >= 0 && actorIndex < 10 && Number.isInteger(targetIndex) && targetIndex >= 10 && targetIndex < 20, 'Actual player caster and enemy target slots');
        const proof = attempt.proof; assert.ok(proof && proof.fight && attempt.confirmation.ok === true, 'Actual successful public player target request');
        assert.deepEqual([proof.fight.active, proof.fight.over, proof.fight.wait, proof.fight.inputKind, proof.fight.aimType, proof.fight.actorIndex], [1, 0, 1, 5, 1, actorIndex]);
        assert.deepEqual([attempt.confirmation.kind, attempt.confirmation.inputSeq], [5, proof.fight.inputSeq], 'Public player confirmation belongs to the actual fresh AIM owner');
        assert.deepEqual([proof.casterId, proof.targetId, proof.x, proof.y], [attempt.actor.id, attempt.target.id, attempt.target.x, attempt.target.y]);
        assert.ok(Number.isInteger(proof.size) && proof.size > 0 && proof.size <= 15 && Array.isArray(proof.values) && proof.values.length === proof.size ** 2 && proof.values.every(v => Number.isInteger(v) && v >= 0 && v <= 255));
        const ax = (proof.x - proof.originX) & 255, ay = (proof.y - proof.originY) & 255;
        assert.ok(ax < proof.size && ay < proof.size); assert.equal(proof.values[ay * proof.size + ax], 1, 'Selected actual target is in the complete current native AIM mask');
        assert.ok(Array.isArray(attempt.keys)); assert.equal(attempt.keys.filter(k => k.code === 39).length, 1, 'Exactly one actual native Enter confirms this player target');
        const entry = manifest.entries.find(e => e.speId === 37 && e.resourceIndex === 0 && e.kind === 2 && e.skillId === skill && e.startFrm === 0 && e.endFrm === end);
        assert.ok(entry && entry.opaqueCoverageVersion === 1 && entry.skillResultVersion === 1); assert.equal(entry.resourceFingerprint, m.fingerprint); assert.equal(entry.resourceLength, m.length);
        const art = entry.pictures.map((p, i) => { assert.deepEqual([p.nativeWidth, p.nativeHeight, p.logicalWidth, p.logicalHeight, p.mask], [i ? 66 : 64, 64, i ? 66 : 64, 64, 0]); if (skill === 7 && i === 1) { assert.equal(p.src, null); return null; } const bytes = asset(assets, p.src), image = png(bytes); assert.deepEqual([image.width, image.height], [p.width, p.height]); for (let k = 3; k < image.rgba.length; k += 4) assert.equal(image.rgba[k], 255, 'Opaque original art'); return { ...image, sha256: sha(bytes), src: p.src }; });
        let movieCount = 0, postCount = 0, labels = 0, numbers = 0, holds = 0, hd = 0, final = false; const widths = new Set();
        const selected = captures.filter(c => {
            const post = c.spe.active !== 1 && c.result.active === true, s = post ? c.result : c.spe, d = post ? s.display : c.spe.display;
            return (post ? s.speId === 37 && d.valid : c.spe.active === 1 && s.id === 37) && s.skillId === skill && s.actorIndex === actorIndex && s.targetIndex === targetIndex && d && d.frameValid && attempt.movieEvents.includes(post ? d.eventId : s.eventId);
        });
        assert.ok(selected.length, 'Actual owned movie/NUM captures for skill' + skill);
        for (const c of selected) {
            assert.deepEqual(c.before, c.after, 'Read-only evidence cannot change native owner'); assert.deepEqual(c.callbackBefore, c.callbackAfter, 'Production callback cannot change native owner');
            if (c.rawSource === 'lcd-callback-image-data') { assert.equal(c.callbackRgbaBefore, c.callbackRgbaAfter, 'Production cannot mutate native callback ImageData'); assert.equal(c.nativeRgba, c.callbackRgbaBefore); }
            assert.deepEqual([c.nativeWidth, c.nativeHeight], [W, H]); assert.deepEqual([c.drawing.scale, c.drawing.flip, c.drawing.paint, c.drawing.palette0, c.drawing.palette255], [1, 0, 255, 0x00ffffff, 0xff000000]);
            assert.ok(Array.isArray(c.paletteReadback) && c.paletteReadback.length === 256 && c.paletteReadback.every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff));
            const post = c.spe.active !== 1, s = post ? c.result : c.spe, d = s.display, current = post ? s.scene : s, geometry = d.composition, generation = s.generation, eventId = post ? d.eventId : s.eventId, key = generation + ':' + eventId;
            assert.deepEqual([post ? s.speId : s.id, s.resourceIndex, s.count, s.picmax, s.startFrm, s.endFrm, s.x, s.y], [37, 0, 8, 2, 0, end, 48, 16]);
            assert.equal(s.resourceFingerprint, m.fingerprint); assert.equal(s.resourceLength, m.length); assert.equal(s.skipEligible, false); assert.equal(d.eventId, current.eventId); assert.equal(d.generation, generation); assert.ok(d.commitSeq > 0 && d.commitSeq <= current.commitSeq);
            assert.ok(geometry && geometry.valid && geometry.protocolVersion === 1); assert.deepEqual([geometry.mode, geometry.x, geometry.y, geometry.height], [skill === 6 ? 3 : 2, 48, 16, 64]);
            const raw = Buffer.from(c.nativeRgba, 'base64'); assert.equal(raw.length, SIZE);
            assert.ok(Array.isArray(c.nativeIndices) && c.nativeIndices.length === W * H && typeof c.indexedSource === 'string' && c.indexedSource.includes('not a native surface read'));
            const inverse = new Map(); c.paletteReadback.forEach((value, index) => inverse.set(value, inverse.has(value) ? -1 : index)); let ambiguous = 0;
            for (let p = 0; p < W * H; p++) { const color = raw.readUInt32LE(p * 4), derived = inverse.has(color) ? inverse.get(color) : -1; assert.equal(c.nativeIndices[p], derived, 'Derived index diagnostic uses exact actual RGBA; aliases remain unresolved'); if (derived < 0) ambiguous++; }
            assert.equal(c.ambiguousPixelCount, ambiguous);
            if (!events.has(key)) events.set(key, { records: counter(m, end), outside: raw, palette: c.paletteReadback, widths: new Set(), skill, actorIndex, targetIndex, firstAt: c.at, lastAt: c.at });
            const state = events.get(key); assert.equal(state.skill, skill); assert.deepEqual(state.palette, c.paletteReadback, 'Palette stays actual and fixed for this controlled scene'); state.lastAt = c.at;
            const expected = state.records[d.commitSeq - 1], future = state.records[current.commitSeq - 1]; assert.ok(expected && future, 'Actual copied commits exist in independent timer');
            assert.equal(current.frameValid, true); assert.equal(d.frameValid, true);
            assert.equal(d.frameIndex, expected.frame); assert.deepEqual(Buffer.from(d.visibleFrames), expected.visible); assert.deepEqual(Buffer.from(geometry.clearFrames), expected.clears); assert.equal(geometry.width, expected.width);
            assert.equal(current.frameIndex, future.frame); assert.deepEqual(Buffer.from(current.visibleFrames), future.visible); assert.deepEqual(Buffer.from(current.composition.clearFrames), future.clears); assert.equal(current.composition.width, future.width); assert.ok(geometry.width <= current.composition.width);
            bits(d.visibleFrames); bits(geometry.clearFrames); widths.add(geometry.width); state.widths.add(geometry.width);
            const pixels = Buffer.from(expected.pixels); let label = null;
            if (post) {
                assert.equal(s.protocolVersion, 1); assert.equal(s.sourceValid, true); assert.equal(s.custom, false); assert.equal(s.returnEligible, false); assert.equal(d.valid, true); assert.equal(d.session, s.session); assert.equal(c.top.kind, 2); assert.equal(c.top.active, true); assert.equal(c.top.valid, true); assert.equal(c.top.session, s.session); assert.equal(c.top.generation, generation);
                assert.equal(d.frameIndex, end); assert.equal(geometry.width, width); assert.ok(bits(d.visibleFrames).includes(end)); assert.equal(c.ui.presentation, 'skill-postlude');
                if (d.label.claimed) { label = nativeLabel(library, assets, s.resultKind); assert.equal(d.label.valid, true); assert.equal(d.label.length, label.bytes.length); assert.deepEqual(Buffer.from(d.label.bytes).subarray(0, d.label.length), label.bytes); assert.equal(d.label.text, new TextDecoder('gbk', { fatal: true }).decode(label.bytes)); assert.deepEqual([d.label.x, d.label.y], [55, 18]); fontPaint(pixels, label.bytes, 55, 18, font); labels++; }
                else assert.equal(d.digits.length, 0);
                const decimal = String(s.value); assert.ok(Number.isInteger(s.value) && s.value > 0 && s.value <= 65535); assert.equal(s.number.resourceFingerprint, fnv(numberBytes)); assert.deepEqual([s.number.nativeWidth, s.number.nativeHeight, s.number.count, s.number.mask, s.number.resourceLength], [12, 16, 10, 0, 327]); assert.ok(d.digits.length <= decimal.length);
                d.digits.forEach((p, i) => { assert.equal(p.digit, Number(decimal[i])); assert.deepEqual([p.x, p.firstY, p.y], [55 + 6 * i, 56, 57 - p.drawCount]); assert.ok(p.drawCount >= 1 && p.drawCount <= 8); for (let draw = 0; draw < p.drawCount; draw++) paint(pixels, num, p.x, p.firstY - draw, p.digit); });
                if (d.digits.length) numbers++; if (s.phase === 'hold' && d.digits.length === decimal.length && d.digits.every(p => p.drawCount === 8)) holds++; postCount++;
            } else { assert.equal(s.protocolValid, true); assert.equal(s.contextKnown, true); assert.equal(s.keyflag, 0); movieCount++; if (d.frameIndex === end && bits(d.visibleFrames).includes(end)) final = true; }
            const full = Buffer.from(state.outside), isNormalized = c.rawSource === 'canvas-readback-normalized';
            for (let y = 16; y < 80; y++) for (let x = 48; x < 48 + expected.width; x++) full.writeUInt32LE(state.palette[pixels[y * W + x]], (y * W + x) * 4);
            assert.deepEqual(raw, isNormalized ? normalized(full) : full, 'All160x96 actual native pixels equal independent opaque timer/clear/font/NUM history and authentic outside');
            const nativePng = png(imageBytes(c, 'native', artifactDir)); assert.deepEqual([nativePng.width, nativePng.height], [W, H]); assert.deepEqual(normalized(nativePng.rgba), normalized(raw), 'Retained native PNG really represents original LCD callback/readback');
            if (expectClassic) {
                verifyClassicCapture(c, raw, artifactDir);
                verified.push({ at: c.at, skillId: skill, generation, eventId, session: post ? s.session : null, phase: post ? s.phase : 'movie', commitSeq: d.commitSeq, currentCommitSeq: current.commitSeq, displayLagsCurrent: d.commitSeq < current.commitSeq, frameIndex: d.frameIndex, width: geometry.width, currentWidth: current.composition.width, visible: bits(d.visibleFrames), clear: bits(geometry.clearFrames), source: 'classic-lcd', nativeRawSource: c.rawSource, nativeRgbaSha256: sha(raw), independentExpectedSha256: sha(isNormalized ? normalized(full) : full), nativeFile: c.nativeFile || null, lcdFile: c.lcdFile || null, hdFile: null });
                continue;
            }
            assert.ok(c.ui.open && c.dom && c.dom.visible && c.dom.inViewport && c.dom.stackOwned && !c.hidden); assert.deepEqual(c.ui.sourceRect, { x: 0, y: 0, width: W, height: H }); assert.equal(c.ui.skipVisible, false);
            const shown = Buffer.from(c.hdLogicalRgba, 'base64'); assert.equal(shown.length, SIZE); const hdPng = png(imageBytes(c, 'hd', artifactDir)), scale = c.ui.scale; assert.ok(Number.isInteger(scale) && scale >= 1); assert.deepEqual([hdPng.width, hdPng.height], [W * scale, H * scale]);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const offset = (y * W + x) * 4, hp = (Math.floor((y + .5) * scale) * hdPng.width + Math.floor((x + .5) * scale)) * 4; assert.deepEqual(shown.subarray(offset, offset + 4), hdPng.rgba.subarray(hp, hp + 4), 'Logical readback equals retained HD PNG original bytes'); }
            if (c.ui.source !== 'hd-assets') { assert.ok(allowLcd, 'Strict selected movie/NUM/hold requires actual HD'); assert.equal(c.ui.source, 'lcd'); assert.deepEqual(shown, normalized(raw)); }
            else {
                hd++; assert.equal(c.ui.outsideSource, 'lcd'); assert.deepEqual(c.ui.hdRegion, { x: 48, y: 16, width: expected.width, height: 64 });
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 48 || x >= 48 + expected.width || y < 16 || y >= 80) { const o = (y * W + x) * 4; assert.deepEqual(shown.subarray(o, o + 4), normalized(raw.subarray(o, o + 4)), 'Full external LCD including uninitialized right2 remains exact'); }
                const rawNormalized = normalized(raw);
                for (let py = 0; py < hdPng.height; py++) for (let px = 0; px < hdPng.width; px++) {
                    const x = Math.floor(px / scale), y = Math.floor(py / scale);
                    if (x >= 48 && x < 48 + expected.width && y >= 16 && y < 80) continue;
                    const actual = (py * hdPng.width + px) * 4, source = (y * W + x) * 4;
                    assert.deepEqual(hdPng.rgba.subarray(actual, actual + 4), rawNormalized.subarray(source, source + 4), 'Every physical pixel outside certified display coverage is the actual nearest-mapped LCD');
                }
                verifyDraws(c, expected, entry, label, post);
                // Check representative interior source pixels against the independently
                // decoded opaque original. Text/NUM footprints are excluded because
                // native text is intentionally replaced by HD typography.
                const live = bits(expected.visible), source = live.length ? art[m.units[live.at(-1)].picIndex] : null;
                let artSamples = 0;
                if (source) for (const [fx, fy] of [[.2, .25], [.5, .5], [.8, .75]]) {
                    const logicalWidth = source === art[1] ? 66 : 64, x = 48 + Math.floor(logicalWidth * fx), y = 16 + Math.floor(64 * fy);
                    if (post && (label && x >= 55 && x < 55 + label.bytes.length * 6 && y >= 18 && y < 30 || d.digits.some(p => x >= p.x && x < p.x + 12 && y >= p.firstY - p.drawCount + 1 && y < p.firstY + 16))) continue;
                    const dest = (Math.floor((y + .5) * scale) * hdPng.width + Math.floor((x + .5) * scale)) * 4, sx = ((x - 48 + .5) * source.width / logicalWidth) - .5, sy = ((y - 16 + .5) * source.height / 64) - .5;
                    // Browser smoothing is implementation-dependent. A decoded 4x4
                    // neighbourhood must bound each channel; no exact nearest-pixel
                    // assertion is invented for high-resolution downsampling.
                    for (let ch = 0; ch < 3; ch++) { const nearby = []; for (let yy = Math.floor(sy) - 1; yy <= Math.floor(sy) + 2; yy++) for (let xx = Math.floor(sx) - 1; xx <= Math.floor(sx) + 2; xx++) if (xx >= 0 && yy >= 0 && xx < source.width && yy < source.height) nearby.push(source.rgba[(yy * source.width + xx) * 4 + ch]); const n = hdPng.rgba[dest + ch]; assert.ok(n >= Math.min(...nearby) - 3 && n <= Math.max(...nearby) + 3, 'Actual opaque artwork readback falls within source neighbourhood'); }
                    assert.equal(hdPng.rgba[dest + 3], 255); artSamples++;
                }
                assert.ok(artSamples || !source, 'At least one independent actual asset readback sample');
            }
            verified.push({ at: c.at, skillId: skill, generation, eventId, session: post ? s.session : null, phase: post ? s.phase : 'movie', commitSeq: d.commitSeq, currentCommitSeq: current.commitSeq, displayLagsCurrent: d.commitSeq < current.commitSeq, frameIndex: d.frameIndex, width: geometry.width, currentWidth: current.composition.width, visible: bits(d.visibleFrames), clear: bits(geometry.clearFrames), source: c.ui.source, nativeRawSource: c.rawSource, nativeRgbaSha256: sha(raw), independentExpectedSha256: sha(isNormalized ? normalized(full) : full), nativeFile: c.nativeFile || null, hdFile: c.hdFile || null });
        }
        assert.ok(movieCount && postCount && labels && numbers && holds && final, 'Actual movie final, GBK label, NUM and completed native hold all required for each skill');
        if (skill === 6) assert.ok(widths.has(64) && widths.has(66), 'Actual display64 and display66 observations are required; no synthetic first64'); else assert.deepEqual([...widths], [64]);
        const first = attempt.before.units.find(u => u.i === actorIndex), after = attempt.after.units.find(u => u.i === actorIndex); assert.ok(first && after); assert.equal(after.mp, first.mp - (skill === 6 ? 20 : 25), 'Native successful player MP delta');
        const targetBefore = attempt.before.units.find(u => u.i === targetIndex), targetAfter = attempt.after.units.find(u => u.i === targetIndex); assert.ok(targetBefore && targetAfter); const numeric = selected.find(c => c.result.active && c.result.skillId === skill && c.result.value > 0); assert.ok(numeric); assert.equal(numeric.result.value, targetBefore.arms - targetAfter.arms, 'Displayed value matches actual applied arms loss; never supplied by that delta');
        families.push({ skillId: skill, movieReadbacks: movieCount, postReadbacks: postCount, labels, numbers, holds, hdReadbacks: hd, observedWidths: [...widths], actualLcdCallbacks: selected.filter(c => c.stage === 'lcd-flush').length });
    }
    const forbidden = report.engineInputs.filter(k => k.speId === 37 && k.speActive === 1 || k.resultSpeId === 37 && k.resultActive === true); assert.deepEqual(forbidden, [], 'No native key reaches WOOD37 movie/NUM/hold');
    const retired = report.woodRetired; assert.ok(retired && retired.spe && retired.result && retired.top && retired.ui, 'Actual post-action retirement snapshot required'); assert.equal(retired.spe.active, 0); assert.equal(retired.result.active, false); assert.equal(retired.top.active, false); assert.equal(retired.ui.open, false);
    const samples = report.speObservations || report.woodSamples, lastSelectedAt = Math.max(...verified.map(v => v.at));
    assert.ok(Array.isArray(samples) && samples.some(s => s.at > lastSelectedAt && s.spe && s.spe.active === 0 && s.result && s.result.active === false && s.top && s.top.active === false), 'Actual lifecycle after selected movie/result establishes retirement, not a synthetic final snapshot');
    return { ok: true, accepted: true, hdAccepted: !allowLcd && families.every(f => f.hdReadbacks === f.movieReadbacks + f.postReadbacks), classicNegativeAccepted: expectClassic, scope: 'Actual player skill6 WOOD37 0..7/64-to66 and skill7 WOOD37 0..0/64, full native LCD pixels, true saved-copy GBK/NUM/hold; explicit classic verifies only actual visible LCD with no HD replacement, otherwise HD geometry and outside LCD. Caller separately proves campaign preparation, source freeze, font loading and cleanup.', librarySha256: sha(library), fontSha256: sha(font), families, verified, eventCount: events.size, keyCountDuringSelectedMovieOrResult: forbidden.length, indexedBoundary: 'RGBA is actual native callback data; nativeIndices is palette inverse only and never asserted to be raw scr_buffer.' };
}
function verifyDraws(c, expected, entry, label, post) {
    const scale = c.ui.scale, actual = c.drawLog.filter(o => o.type === 'fillRect' || o.type === 'fillText' || o.type === 'drawImage' && o.src), regions = c.drawLog.filter(o => o.type === 'rect').map(o => o.args); let i = 0;
    const consume = (type, args, text, src) => { const o = actual[i++]; assert.equal(o && o.type, type); assert.deepEqual(o.args, args); if (text != null) assert.equal(o.text, text); if (src != null) assert.equal(o.src, src); return o; };
    const expectedRects = [[48 * scale, 16 * scale, expected.width * scale, 64 * scale]];
    const cleared = c.drawLog.filter(o => o.type === 'clearRect');
    assert.deepEqual(cleared.map(o => o.args), [[0, 0, W * scale, H * scale], [48 * scale, 16 * scale, expected.width * scale, 64 * scale], ...bits(expected.clears).map(f => [48 * scale, 16 * scale, (f % 2 ? 66 : 64) * scale, 64 * scale])], 'Actual initialized clip clear then original accumulated clear footprints');
    for (const frame of bits(expected.visible)) { const p = entry.pictures[frame % 2], o = consume('drawImage', [48 * scale, 16 * scale, p.logicalWidth * scale, 64 * scale], null, p.src); assert.deepEqual([o.naturalWidth, o.naturalHeight], [p.width, p.height]); }
    if (post) {
        if (label) { const box = [55 * scale, 18 * scale, label.bytes.length * 6 * scale, 12 * scale]; consume('fillRect', box); consume('fillText', box.slice(0, 3), c.result.display.label.text); expectedRects.push(box); }
        for (const p of c.result.display.digits) for (let draw = 0; draw < p.drawCount; draw++) { const box = [p.x * scale, (p.firstY - draw) * scale, 12 * scale, 16 * scale]; consume('fillRect', box); const o = consume('fillText', [box[0], box[1], 6 * scale], String(p.digit)); assert.equal(o.font, 'bold ' + 16 * scale + 'px Georgia, serif'); expectedRects.push(box); }
    }
    assert.equal(i, actual.length, 'No extra unobserved art/text draws'); assert.deepEqual(regions, expectedRects, 'Actual full scene/label/digit clipping');
}
