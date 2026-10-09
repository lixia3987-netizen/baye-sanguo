// Offline consumer and controlled raw ABI -> public getter VM tests; no native C or browser execution.
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {aidRawScenarios,readAidPublic} from './hd-aid-native-test-fixture.mjs';
import { deflateSync, inflateSync } from 'node:zlib';

const source = readFileSync(new URL('../js/hd-spe.js', import.meta.url), 'utf8');
const identitySource = readFileSync(new URL('../js/hd-lib-identity.js', import.meta.url), 'utf8');
const bytes = Buffer.from('01020304', 'hex');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const settle = () => new Promise(resolve => setImmediate(resolve));

// Browser Image decodes pixels in production. This independent PNG reader lets
// the asset test check actual alpha after PNG filtering, rather than IHDR alone.
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function decodePng(png) {
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let header, ended = false;
    const chunks = [];
    for (let at = 8; at < png.length;) {
        assert.ok(at + 12 <= png.length, 'complete PNG chunk header');
        const length = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8), end = at + 12 + length;
        assert.ok(end <= png.length, 'complete PNG chunk payload');
        assert.equal(crc32(png.subarray(at + 4, end - 4)), png.readUInt32BE(end - 4), 'PNG chunk CRC: ' + type);
        const data = png.subarray(at + 8, end - 4);
        if (type === 'IHDR') {
            assert.equal(at, 8); assert.equal(length, 13); assert.equal(header, undefined);
            header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), colorType: data[9] };
            assert.equal(data[8], 8, '8-bit production art');
            assert.ok(header.colorType === 2 || header.colorType === 6, 'RGB or RGBA production art');
            assert.deepEqual([...data.subarray(10)], [0, 0, 0], 'standard compression/filter, noninterlaced art');
            assert.ok(header.width > 0 && header.height > 0 && header.width * header.height <= 32_000_000);
        } else if (type === 'IDAT') {
            assert.ok(header); chunks.push(data);
        } else if (type === 'IEND') {
            assert.equal(length, 0); assert.equal(end, png.length, 'no trailing or truncated PNG data'); ended = true;
        } else if (type === 'tRNS') {
            assert.fail('SPE transparency must be explicit RGBA pixels, not a color-key chunk');
        }
        at = end;
    }
    assert.ok(header && ended && chunks.length, 'complete PNG image');
    const channels = header.colorType === 6 ? 4 : 3, stride = header.width * channels;
    const filtered = inflateSync(Buffer.concat(chunks)), pixels = Buffer.alloc(stride * header.height);
    assert.equal(filtered.length, (stride + 1) * header.height, 'complete decompressed PNG rows');
    function paeth(a, b, c) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    for (let y = 0; y < header.height; y++) {
        const filter = filtered[y * (stride + 1)]; assert.ok(filter <= 4, 'legal PNG row filter');
        for (let x = 0; x < stride; x++) {
            const at = y * stride + x, left = x >= channels ? pixels[at - channels] : 0;
            const up = y ? pixels[at - stride] : 0, upperLeft = y && x >= channels ? pixels[at - stride - channels] : 0;
            const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)][filter];
            pixels[at] = (filtered[y * (stride + 1) + x + 1] + predictor) & 255;
        }
    }
    let transparent = 0, nonTransparent = 0, opaque = 0;
    for (let at = 0; at < pixels.length; at += channels) {
        const alpha = channels === 4 ? pixels[at + 3] : 255;
        if (alpha === 0) transparent++; else nonTransparent++;
        if (alpha === 255) opaque++;
    }
    return { ...header, pixels, channels, transparent, nonTransparent, opaque };
}
function checkPictureAlpha(decoded, mask) {
    assert.ok(mask === 0 || mask === 1, 'only native simple picture masks are supported');
    if (mask === 0) {
        assert.equal(decoded.opaque, decoded.width * decoded.height, 'mask0 art is completely opaque');
    } else {
        assert.equal(decoded.colorType, 6, 'mask1 art carries explicit alpha');
        assert.ok(decoded.transparent > 0, 'mask1 has actual transparent background pixels');
        assert.ok(decoded.nonTransparent > 0, 'mask1 has visible artwork rather than an empty image');
    }
}
function pngFixture(width, height, colorType, filtered) {
    function chunk(type, data) {
        const bytes = Buffer.concat([Buffer.from(type), data]), result = Buffer.alloc(data.length + 12);
        result.writeUInt32BE(data.length); bytes.copy(result, 4); result.writeUInt32BE(crc32(bytes), result.length - 4);
        return result;
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = colorType;
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(filtered)), chunk('IEND', Buffer.alloc(0))]);
}
function bitset(...frames) {
    const bits = Array(32).fill(0);
    for (const frame of frames) bits[frame >> 3] |= 1 << (frame & 7);
    return bits;
}
function nativeSpe(overrides = {}) {
    return { active: 1, protocolVersion: 2, generation: 1, eventId: 1, kind: 1, id: 3,
        x: 0, y: 0, resourceIndex: 0, count: 3, picmax: 2, startFrm: 0, endFrm: 2,
        frameIndex: 0, frameValid: true, commitSeq: 1, keyflag: 1, skipEligible: true,
        protocolValid: true, resourceFingerprint: 'fnv1a32:12345678:40', resourceLength: 40,
        display: { generation: 1, eventId: 1, commitSeq: 1, frameIndex: 0, frameValid: true, visibleFrames: bitset(0) }, ...overrides };
}
function manifest(overrides = {}) {
    return { schemaVersion: 1, libSha256: sha256, axScale: 2, entries: [{ speId: 3, resourceIndex: 0, kind: 1,
        startFrm: 0, endFrm: 2, count: 3, picmax: 2, resourceFingerprint: 'fnv1a32:12345678:40', resourceLength: 40,
        units: [{ frame: 0, x: 1, y: 2, picIndex: 0 }, { frame: 1, x: 3, y: 4, picIndex: 1 }, { frame: 2, x: 5, y: 6, picIndex: 0 }],
        pictures: [0, 1].map(picIndex => ({ picIndex, src: `assets/hd-spe/picture-${picIndex}.png`, width: 64, height: 64,
            nativeWidth: 8, nativeHeight: 8, logicalWidth: 4, logicalHeight: 4, mask: picIndex })) }], ...overrides };
}
function actualMainFixture(speId = 3) {
    const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
    const address = lib.readUInt32LE((speId - 1) * 4), length = lib.readUInt32LE(address + 8);
    const resource = lib.subarray(address + 14, address + 14 + length);
    let fnv = 2166136261;
    for (const byte of resource) fnv = Math.imul(fnv ^ byte, 16777619) >>> 0;
    const units = Array.from({ length: resource[2] }, (_, frame) => {
        const at = 6 + frame * 5;
        return { frame, x: resource[at], y: resource[at + 1], picIndex: resource[at + 4] };
    });
    let at = 6 + units.length * 5;
    const pictures = Array.from({ length: resource[3] }, (_, picIndex) => {
        const nativeWidth = resource.readUInt16LE(at), nativeHeight = resource.readUInt16LE(at + 2), mask = resource[at + 6];
        at += 7 + Math.ceil(nativeWidth / 8) * nativeHeight * (mask + 1);
        return { picIndex, src: `assets/hd-spe/main-fixture-picture-${picIndex}.png`, width: 64, height: 64,
            nativeWidth, nativeHeight, logicalWidth: nativeWidth, logicalHeight: nativeHeight, mask };
    });
    const entry = { speId, resourceIndex: 0, kind: 1, startFrm: resource[4], endFrm: resource[5], count: units.length, picmax: pictures.length,
        resourceLength: length, resourceFingerprint: `fnv1a32:${fnv.toString(16).padStart(8, '0')}:${length}`, units, pictures };
    const s = { id: speId, kind: 1, count: entry.count, picmax: entry.picmax, startFrm: entry.startFrm, endFrm: entry.endFrm,
        resourceLength: entry.resourceLength, resourceFingerprint: entry.resourceFingerprint };
    const m = { schemaVersion: 1, axScale: 1, libSha256: createHash('sha256').update(lib).digest('hex'), entries: [entry] };
    return { lib, entry, s, m, units, pictures };
}
function harness(options = {}) {
    let spe = nativeSpe(options.spe), maker = options.maker || null, attack = options.attack || null,
        skillResult = options.skillResult || null, resultOwner = options.resultOwner || null, hidden = false, report = { active: 0 };
    let openingHd = options.storage?.['baye/systemUiMode'] !== 'classic', battleHd = true;
    const events = [], images = [], keys = [], nativeWrites = [], listeners = new Map(), polls = [], nodes = new Map();
    const nativeReads = [], timers = new Map(), preferences = new Map(Object.entries(options.storage || {}));
    let nativeReadable = !options.preMain, timerId = 0, now = 1_000, nativeReadHook = null, drawHook = null;
    function readNative(name, value) { nativeReads.push(name); if (!nativeReadable) throw new Error('premature native access: ' + name); if (nativeReadHook) nativeReadHook(name); return value; }
    class Clock extends Date { static now() { return now; } }
    function advance(ms) {
        const end = now + ms; let count = 0;
        while (true) {
            const ready = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!ready) break;
            assert.ok(++count < 1_000, 'bounded callback timer work');
            timers.delete(ready[0]); now = ready[1].at; ready[1].fn();
        }
        now = end;
    }
    function node(id, canvas = false) {
        const attrs = {}, classes = new Set(), handlers = {};
        const ctx = new Proxy({}, { get(target, key) {
            if (key in target) return target[key];
            return (...args) => { events.push({ node: id, operation: key, args, smoothing: target.imageSmoothingEnabled,
                fillStyle: target.fillStyle }); if (drawHook) drawHook(id, key, args); };
        }, set(target, key, value) { target[key] = value; return true; } });
        const n = { id, width: canvas ? 640 : 0, height: canvas ? 384 : 0, style: {}, hidden: false, disabled: false,
            classList: { toggle(name, active) { active ? classes.add(name) : classes.delete(name); } },
            setAttribute(key, value) { attrs[key] = value; }, getAttribute: key => attrs[key],
            addEventListener(name, fn) { (handlers[name] ||= []).push(fn); }, handlers,
            getContext: () => ctx, getBoundingClientRect: () => ({ width: 128, height: 48 }) };
        nodes.set(id, n); return n;
    }
    ['hd-spe', 'hd-spe-skip', 'hd-spe-return', 'hd-spe-title', 'hd-spe-probe'].forEach(id => node(id));
    node('lcd', true); node('hd-spe-canvas', true);
    const document = { get hidden() { return hidden; }, documentElement: node('html'), getElementById: id => nodes.get(id),
        createElement: () => node('scratch-' + nodes.size, true),
        addEventListener(name, fn) { (listeners.get(name) || listeners.set(name, []).get(name)).push(fn); } };
    class Image {
        set src(value) { this.url = value; images.push(this); }
    }
    const nativeData = { g_scale: 2, g_screenWidth: 160, g_screenHeight: 96, ...options.data };
    const data = new Proxy(nativeData, { get(target, key) { return readNative('data.' + String(key), target[key]); },
        set(target, key, value) { nativeWrites.push([key, value]); return true; } });
    const baye = { get data() { return readNative('data', data); }, hd: {
        ready: () => readNative('hd.ready', true), spe: () => readNative('hd.spe', spe),
        maker: () => readNative('hd.maker', maker), attack: () => readNative('hd.attack', attack),
        skillResult: () => readNative('hd.skillResult', skillResult), resultOwner: () => readNative('hd.resultOwner', resultOwner),
        fight: () => readNative('hd.fight', { active: options.fightActive === true }), report: () => readNative('hd.report', report) } };
    class ImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } }
    const context = vm.createContext({ console, document, Image, ImageData, Uint8Array, Uint8ClampedArray,
        crypto: options.crypto === undefined ? webcrypto : options.crypto,
        Promise: class { constructor() { throw new Error('do not wrap native promises in legacy window.Promise'); } },
        dynLib: bytes.toString('hex'), baye, Date: Clock,
        localStorage: { getItem: key => preferences.get(key) ?? null, setItem() { throw new Error('mode API should own preference'); } },
        BayeHdSystemUi: { shouldShowHd: () => openingHd, setMode: mode => { openingHd = mode !== 'classic'; } },
        BayeHdBattle: { shouldShowHd: () => battleHd, setMode: mode => { battleHd = mode !== 'classic'; } },
        sendKey: key => keys.push(key), setInterval: fn => { polls.push(fn); return polls.length; },
        setTimeout: (fn, delay = 0) => { const id = ++timerId; timers.set(id, { fn, at: now + Math.max(0, delay) }); return id; },
        clearTimeout: id => timers.delete(id),
        ...(options.fetch ? { fetch: options.fetch } : {}) });
    context.window = context;
    vm.runInContext(identitySource, context, { filename: 'js/hd-lib-identity.js' });
    vm.runInContext(source, context, { filename: 'js/hd-spe.js' });
    const api = context.BayeHdSpe;
    function event(extra = {}) { return { key: 'Enter', keyCode: 13, target: {}, prevented: false,
        preventDefault() { this.prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...extra }; }
    return { api, context, events, images, keys, nativeWrites, nativeReads, listeners, polls, nodes, timers, advance,
        allowNative() { nativeReadable = true; },
        setNativeReadHook(value) { nativeReadHook = value; }, setDrawHook(value) { drawHook = value; },
        setStorage(key, value) { preferences.set(key, value); },
        spe: () => spe, setSpe: value => { spe = nativeSpe(value); },
        setMaker: value => { maker = value; },
        setAttack: value => { attack = value; },
        setSkillResult: value => { skillResult = value; },
        setResultOwner: value => { resultOwner = value; },
        setHidden(value) { hidden = value; for (const fn of listeners.get('visibilitychange') || []) fn(); },
        setReport(value) { report.active = value; api.onEngineSpe(); },
        setMode(value) { openingHd = battleHd = value; api.onEngineSpe(); },
        key(extra) { const e = event(extra); for (const fn of listeners.get('keydown') || []) fn(e); return e; },
        click(selector, detail = 0) { const e = event({ detail, target: { closest: value => value === selector ?
            selector === '[data-hd-spe-return]' ? nodes.get('hd-spe-return') : {} : null } });
            for (const fn of nodes.get('hd-spe').handlers.click || []) fn(e); return e; },
        pointerDownReturn() { const e = event({ target: { closest: value => value === '[data-hd-spe-return]' ? nodes.get('hd-spe-return') : null } });
            for (const fn of nodes.get('hd-spe').handlers.pointerdown || []) fn(e); },
        setScreen(width, height) { nativeData.g_screenWidth = width; nativeData.g_screenHeight = height;
            nodes.get('lcd').width = width * 4; nodes.get('lcd').height = height * 4; api.onEngineSpe(); },
        flush() { api.onLcdFlush({ fixture: 'native LCD' }, nodes.get('lcd').width, nodes.get('lcd').height); },
        resolveImage(index, valid = true) { const image = images[index]; image.naturalWidth = valid ? 64 : 63; image.naturalHeight = 64; image.onload(); },
        nativeSnapshot: () => JSON.stringify({ spe, scale: data.g_scale, report }),
        hdDraws: () => events.filter(e => e.node === 'hd-spe-canvas' && e.operation === 'drawImage' && e.args[0] instanceof Image) };
}
// Consumer-boundary tests deliberately supply malformed public shapes. The joint
// cases below separately feed unmodified results from the real public getter.
// Both are offline tests, not native execution or browser gameplay evidence.
function aidFixture(skillId=17,current=0,shown=current){
 const a=actualMainFixture(41),m=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8')),
 entry=m.entries.find(e=>e.speId===41);
 assert.deepEqual(entry.units,a.units);assert.equal(entry.resourceLength,1084);assert.equal(entry.resourceFingerprint,'fnv1a32:1d4637e9:1084');
 const comp=frame=>({protocolVersion:1,valid:true,mode:2,x:48,y:16,width:64,height:64,background:null,clearFrames:bitset(...Array.from({length:frame},(_,i)=>i))});
 const display={generation:9,eventId:5,commitSeq:shown+1,frameIndex:shown,frameValid:true,visibleFrames:bitset(shown),composition:comp(shown)};
 const s={...a.s,kind:2,generation:9,eventId:5,x:48,y:16,keyflag:0,skipEligible:false,contextKnown:true,skillId,actorIndex:2,targetIndex:3,
 frameIndex:current,frameValid:true,commitSeq:current+1,visibleFrames:bitset(current),composition:comp(current),display};
 return {...a,entry,m:{...m,entries:[entry]},s};
}
function aidNumeric(skillId=17,value=800){const f=aidFixture(skillId,7),label={claimed:true,valid:true,x:55,y:18,length:8,text:'兵力增加',bytes:[...Buffer.from('b1f8c1a6d4f6bcd3','hex'),...Array(56).fill(0)]},
 digits=[...String(value)].map((d,i)=>({digit:Number(d),x:55+i*6,y:49,firstY:56,drawCount:8})),
 scene={...structuredClone(f.s.display),session:2,paintSeq:10},result={protocolVersion:1,active:true,phase:'hold',custom:false,sourceValid:true,generation:9,session:2,
 skillId,resultKind:2,actorIndex:2,targetIndex:3,value,paintSeq:10,speId:41,resourceIndex:0,count:8,picmax:2,startFrm:0,endFrm:7,x:48,y:16,
 resourceLength:1084,resourceFingerprint:f.entry.resourceFingerprint,number:{...f.entry.skillNumber,valid:true},label,digits,scene,
 display:{...structuredClone(scene),valid:true,label,digits}};
 return {...f,result,top:{active:true,valid:true,kind:2,generation:9,session:2}};}
async function aidLoaded(o={}){const f=o.numeric?aidNumeric(o.skillId||17,o.value??800):aidFixture(o.skillId||17,o.current||0,o.shown??o.current??0),
 h=harness({data:{g_scale:1},spe:o.numeric?{active:0,generation:9}:f.s,...(o.numeric?{skillResult:f.result,resultOwner:f.top}:{}),...o.harness});
 h.context.dynLib=f.lib.toString('hex');h.api.setManifest(f.m);h.api.start();
 for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
 function resolve(i){const image=h.images[i],p=f.entry.pictures.find(p=>p.src===image.url);image.naturalWidth=p.width;image.naturalHeight=p.height;image.onload();}
 if(!o.pending)h.images.forEach((_,i)=>resolve(i));return {...h,fixture:f,resolve};}
function fullLcd(h){assert.deepEqual({...h.api.debugSnapshot().sourceRect},{x:0,y:0,width:160,height:96});}
test('AID41 two declared skills consume all actual alternating slots inside64 while preserving fullLCD outside',async()=>{
 for(const skillId of [17,29]){const h=await aidLoaded({skillId});for(let frame=0;frame<8;frame++){
 h.setSpe(aidFixture(skillId,frame).s);h.events.length=0;h.flush();const d=h.api.debugSnapshot();assert.equal(d.source,'hd-assets');fullLcd(h);
 assert.deepEqual({...d.hdRegion},{x:48,y:16,width:64,height:64});assert.deepEqual([...d.displayedFrames],[frame]);
 const image=h.hdDraws().at(-1);assert.equal(image.args[0].url,'assets/hd-spe/aid-41/picture-'+frame%2+'.png');assert.deepEqual(image.args.slice(1),[528,176,704,704]);
 assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='fillRect').length,0);}
 h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);}
});
test('AID41 displayed earlier commit uses only its own slot/clears, not futurecurrent',async()=>{
 const h=await aidLoaded({current:3,shown:0});assert.equal(h.api.debugSnapshot().source,'hd-assets');assert.deepEqual([...h.api.debugSnapshot().displayedFrames],[0]);
 assert.equal(h.hdDraws().at(-1).args[0].url,'assets/hd-spe/aid-41/picture-0.png');
 const bad=structuredClone(h.fixture.s);bad.display.composition.clearFrames=bitset(1);h.setSpe(bad);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);
});
test('AID41 rejects wrongcontext/skill/mode/geometry/futurebits/owner tickets and unsupported background',async()=>{
 const h=await aidLoaded(),original=h.fixture.s;for(const mutate of [s=>s.contextKnown=false,s=>s.skillId=6,s=>s.actorIndex=20,s=>s.targetIndex=20,
 s=>s.keyflag=1,s=>s.skipEligible=true,s=>s.composition.valid=false,s=>s.display.composition.valid=false,s=>s.display.composition.mode=3,
 s=>s.display.composition.width=66,s=>s.display.composition.x=49,s=>s.display.composition.background={valid:true},s=>s.display.commitSeq=2,
 s=>s.display.eventId=6,s=>s.display.generation=10,s=>s.display.visibleFrames=bitset(1),s=>s.composition.clearFrames=bitset(8)]){
 const s=structuredClone(original);mutate(s);h.setSpe(s);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);}
 assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});
test('AID41 marker missing/wrong and unknownLIB always keep fullactualLCD, never generic130arena',async()=>{
 const h=await aidLoaded();for(const mutate of [e=>delete e.aidVersion,e=>e.aidVersion=2,e=>delete e.opaqueCoverageVersion,e=>e.skillIds=[17],
 e=>e.skillIds=[29,17],e=>e.skillId=17,e=>e.pictures[1].mask=1,e=>e.units[3].x=1,e=>e.resourceFingerprint='fnv1a32:00000000:1084']){
 const m=structuredClone(h.fixture.m);mutate(m.entries[0]);h.api.setManifest(m);h.events.length=0;h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);assert.deepEqual(h.hdDraws(),[]);}
 h.context.dynLib='00';h.api.setManifest(h.fixture.m);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);assert.deepEqual(h.keys,[]);
});
test('AID41 actual gain800/1800/capped0 NUMhistory and hold use finalcopiedscene without extraEnter',async()=>{
 for(const [skillId,value]of[[17,800],[29,1800],[17,0]]){const h=await aidLoaded({numeric:true,skillId,value}),d=h.api.debugSnapshot();
 assert.equal(d.source,'hd-assets');assert.equal(d.presentation,'skill-postlude');fullLcd(h);assert.deepEqual([...d.displayedFrames],[7]);
 const text=h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='fillText');assert.equal(text.at(-1).args[0],String(value).at(-1));
 assert.ok(text.some(e=>e.args[0]==='兵力增加'));const last=text.slice(-String(value).length*8);
 assert.deepEqual(last.map(e=>e.args),[...String(value)].flatMap((digit,i)=>Array.from({length:8},(_,j)=>[digit,(55+i*6)*11,(56-j)*11,66])));
 assert.equal(h.nodes.get('hd-spe-skip').hidden,true);assert.equal(h.nodes.get('hd-spe-return').hidden,true);h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);}
});
test('AID41 postlude refuses losskind, forged zero/negative values, badNUM/label and nonfinalcopy',async()=>{
 const h=await aidLoaded({numeric:true}),original=h.fixture.result;for(const mutate of[r=>r.resultKind=1,r=>r.value=-1,r=>r.value=65536,
 r=>r.custom=true,r=>r.sourceValid=false,r=>r.skillId=6,r=>r.scene.frameIndex=6,r=>r.display.frameIndex=6,r=>r.display.visibleFrames=bitset(6),
 r=>r.number.resourceFingerprint='fnv1a32:00000000:327',r=>r.display.label.x=112,r=>r.display.digits[0].drawCount=9]){
 const r=structuredClone(original);mutate(r);h.setSkillResult(r);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);}
 h.setSkillResult(original);h.setResultOwner({...h.fixture.top,session:3});h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);assert.deepEqual(h.keys,[]);
});
test('AID41 missing/late/retired/classic/hidden/report never revivesHD or emitsinput',async()=>{
 for(const numeric of[false,true]){const h=await aidLoaded({pending:true,numeric});h.resolve(0);h.images[1].onerror();h.events.length=0;h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);}
 const retired=await aidLoaded({pending:true});retired.setSpe({active:0});retired.api.onEngineSpe();retired.events.length=0;retired.resolve(0);retired.resolve(1);assert.equal(retired.api.isOpen(),false);assert.deepEqual(retired.hdDraws(),[]);
 for(const retire of[h=>h.setMode(false),h=>h.setHidden(true),h=>h.setReport(1)]){const h=await aidLoaded();h.events.length=0;retire(h);h.flush();assert.equal(h.api.isOpen(),false);assert.deepEqual(h.hdDraws(),[]);assert.deepEqual(h.keys,[]);}
});
test('AID41 mid-draw owner/resource change restores fullrealLCD rather than partialHD',async()=>{
 const h=await aidLoaded();let changed=false;h.setDrawHook((node,op,args)=>{if(!changed&&node==='hd-spe-canvas'&&op==='drawImage'&&args[0]instanceof h.context.Image){changed=true;h.spe().display.composition.width=66;}});
 h.events.length=0;h.flush();h.setDrawHook(null);assert.equal(changed,true);assert.equal(h.api.debugSnapshot().source,'lcd');
 const last=h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='drawImage').at(-1);assert.equal(last.args[0]instanceof h.context.Image,false);assert.deepEqual(last.args.slice(1),[0,0,640,384,0,0,1760,1056]);assert.deepEqual(h.keys,[]);
});
test('AID manifest and original opaque art match actual native slots and unique PNG pixels',()=>{
 const f=aidFixture(),entries=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8')).entries;
 assert.equal(entries.filter(e=>e.speId===41).length,1);assert.deepEqual(f.entry.units,f.units);
 assert.deepEqual([f.entry.count,f.entry.picmax,f.entry.startFrm,f.entry.endFrm],[8,2,0,7]);
 const hashes=[];for(const p of f.entry.pictures){const b=readFileSync(new URL('../'+p.src,import.meta.url)),d=decodePng(b);checkPictureAlpha(d,0);
 assert.deepEqual([d.width,d.height],[p.width,p.height]);assert.deepEqual([p.nativeWidth,p.nativeHeight,p.logicalWidth,p.logicalHeight,p.mask],[64,64,64,64,0]);
 hashes.push(createHash('sha256').update(b).digest('hex'));}assert.equal(new Set(hashes).size,2);
});

test('AID41 mode2 geometry alone cannot establish an unwritten current or displayed window',async()=>{
 const h=await aidLoaded();for(const side of['current','display']){const s=structuredClone(h.fixture.s);
 if(side==='current'){s.visibleFrames=bitset();s.composition.clearFrames=bitset();}
 else{s.display.visibleFrames=bitset();s.display.composition.clearFrames=bitset();}
 h.setSpe(s);h.flush();assert.equal(h.api.debugSnapshot().source,'lcd');fullLcd(h);}
 assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
});

const jointSummary=[];
async function consume(actual){const m=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8')),
 entry=m.entries.find(e=>e.speId===41),lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url)),h=harness({data:{g_scale:1},spe:actual.publicSpe,
 skillResult:actual.publicSkillResult,resultOwner:actual.publicResultOwner});
 h.context.dynLib=lib.toString('hex');h.api.setManifest({...m,entries:[entry]});h.api.start();
 for(let i=0;i<60&&h.images.length<2;i++)await settle();assert.equal(h.images.length,2);
 for(const image of h.images){const p=entry.pictures.find(p=>p.src===image.url);image.naturalWidth=p.width;image.naturalHeight=p.height;image.onload();}
 h.flush();return h;}
for(const scenario of aidRawScenarios())test('production public getter -> renderer: '+scenario.name,async()=>{
 const actual=readAidPublic(scenario.rawGlobals);const fact=scenario.numeric?actual.publicSkillResult:actual.publicSpe;
 assert.equal(fact.skillId,scenario.skill);assert.equal(scenario.numeric?fact.scene.frameIndex:fact.frameIndex,scenario.current);assert.equal(fact.display.frameIndex,scenario.display);
 if(scenario.numeric){assert.equal(fact.value,scenario.value);assert.equal(fact.sourceValid,true);assert.equal(fact.display.valid,true);}else{assert.equal(fact.composition.valid,true);assert.equal(fact.display.composition.valid,true);}
 const numeric=actual.publicSkillResult.active&&actual.publicSkillResult.phase==='hold',display=numeric?actual.publicSkillResult.display:actual.publicSpe.display,
 h=await consume(actual),d=h.api.debugSnapshot();assert.equal(d.source,'hd-assets');assert.deepEqual({...d.sourceRect},{x:0,y:0,width:160,height:96});assert.deepEqual({...d.hdRegion},{x:48,y:16,width:64,height:64});
 assert.deepEqual([...d.displayedFrames],[display.frameIndex]);assert.equal(h.hdDraws().at(-1).args[0].url,'assets/hd-spe/aid-41/picture-'+display.frameIndex%2+'.png');
 if(numeric){assert.equal(d.presentation,'skill-postlude');assert.equal(actual.publicSkillResult.resultKind,2);assert.ok(h.events.some(e=>e.operation==='fillText'&&e.args[0]==='兵力增加'));
 const digitText=h.events.filter(e=>e.operation==='fillText').slice(-String(actual.publicSkillResult.value).length*8);
 assert.deepEqual(digitText.map(e=>e.args[0]),[...String(actual.publicSkillResult.value)].flatMap(d=>Array(8).fill(d)));}
 else assert.equal(h.events.filter(e=>e.node==='hd-spe-canvas'&&e.operation==='fillRect').length,0);
 h.key();h.api.skip();assert.deepEqual(h.keys,[]);assert.deepEqual(h.nativeWrites,[]);
 jointSummary.push({name:scenario.name,source:'production bridge getter invoked from raw ABI unit input, unmodified public results consumed',numeric,skillId:numeric?actual.publicSkillResult.skillId:actual.publicSpe.skillId,
 currentFrame:numeric?actual.publicSkillResult.scene.frameIndex:actual.publicSpe.frameIndex,displayFrame:display.frameIndex,value:numeric?actual.publicSkillResult.value:null,sourceRect:{...d.sourceRect},hdRegion:{...d.hdRegion},source:d.source,keys:0,nativeWrites:0});
});
test('all five joint scenarios consume unmodified getters without native input or writes',()=>{
 assert.equal(jointSummary.length,5);assert.equal(new Set(jointSummary.map(s=>s.name)).size,5);
 for(const s of jointSummary){assert.equal(s.source,'hd-assets');assert.equal(s.keys,0);assert.equal(s.nativeWrites,0);}
});
