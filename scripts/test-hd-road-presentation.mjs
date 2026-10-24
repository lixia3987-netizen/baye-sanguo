import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Run the complete renderer with native ownership snapshots. Only the browser
// and engine boundaries are replaced; graph and drawing logic remain real.
const source = readFileSync(new URL('../js/hd-overworld.js', import.meta.url), 'utf8')
    .replace(/\}\)\(window\);\s*$/, `
        global.__presentation = { state, drawRoads, drawCities, draw, sampleCities, cacheDom };
    })(window);`);

const mapIdentity = Object.freeze({status:'ready',generation:1,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'});
function harness() {
    const sent = [], strokes = [], domWrites = [], nodes = new Map(), stack = [];
    let dash = [], path = [];
    const ctx = new Proxy({
        strokeStyle: '', lineWidth: 1,
        save() { stack.push({ dash: [...dash], style: this.strokeStyle, width: this.lineWidth }); },
        restore() {
            const saved = stack.pop(); dash = saved.dash;
            this.strokeStyle = saved.style; this.lineWidth = saved.width;
        },
        setLineDash(value) { dash = [...value]; },
        beginPath() { path = []; },
        moveTo(...args) { path.push(['moveTo', ...args]); },
        quadraticCurveTo(...args) { path.push(['curve', ...args]); },
        arc(...args) { path.push(['arc', ...args]); },
        stroke() { strokes.push({ style: this.strokeStyle, width: this.lineWidth, dash: [...dash], path: [...path] }); },
        measureText: text => ({ width: text.length * 20 }),
        createLinearGradient: () => ({ addColorStop() {} })
    }, { get(target, name) { return name in target ? target[name] : () => {}; } });
    for (const name of ['hud-left', 'hud-right', 'legend-owned', 'legend-neutral', 'legend-empty']) {
        const id = 'hd-overworld-' + name;
        const values = new Map();
        const node = { textContent: '', style: {
            setProperty(key, value) { values.set(key, value); domWrites.push([id, key, value]); },
            getPropertyValue: key => values.get(key)
        } };
        nodes.set(id, node);
    }
    nodes.set('hd-overworld-canvas', { width: 1920, height: 1080,
        getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }) });
    const data = { g_PlayerKing: 0, g_PIdx: 1,
        g_Cities: [{ Belong: 1 }, { Belong: 3 }, { Belong: 4 }, { Belong: 0 }],
        g_CityPositions: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 3 }] };
    const names=['洛阳','许昌','陈留','空城'];
    const geo = {libSha256:mapIdentity.sha256,cities:data.g_CityPositions.map((p,i)=>({i,name:names[i],engX:p.x,engY:p.y,hdX:100+i*140,hdY:120+i*110}))};
    const context = vm.createContext({
        BayeHdLibIdentity:{read:()=>mapIdentity,isCurrent:s=>s===mapIdentity,subscribe(){}},
        document: { hidden: false, documentElement: { setAttribute() {} }, getElementById: id => nodes.get(id) },
        localStorage: { getItem: () => 'hd-map' },
        console: { log() {}, warn() {} }, addEventListener() {},
        baye: { data, ensureData: () => data, hdCityLimit: () => data.g_Cities.length,
            getCityName: id => names[id],
            hd: { ready: () => true }, sendKey: key => sent.push(key) },
        sendKey: key => sent.push(key), devicePixelRatio: 1
    });
    context.window = context;
    vm.runInContext(source, context, { filename: 'js/hd-overworld.js' });
    const renderer = context.__presentation, state = renderer.state;
    renderer.cacheDom();
    Object.assign(state, {libraryIdentity:mapIdentity,assetsReady:true,layoutMatched:true,manifest:{libSha256:mapIdentity.sha256},geoMeta:geo,geoCities:geo.cities,mode: 'hd-map', phase: 'map', probed: true, selectedIndex: 0 });
    renderer.sampleCities();
    return { context, renderer, state, data, nodes, sent, strokes, domWrites, ctx,
        names, geo, getDash: () => [...dash], resetStrokes() { strokes.length = 0; } };
}

const edge = { a: 0, b: 1, ax: 100, ay: 100, bx: 220, by: 150, cx: 160, cy: 120, pass: false };

test('selection cannot turn geographic, tile or discovered connectors into march previews', () => {
    for (const source of ['lcc-neighbors', 'tile-neighbors', 'json', 'engine']) {
        const h = harness();
        const graph = { source, edges: [{ ...edge }], passes: 0 };
        const nativeEdges = h.state.engineTileEdges;
        const before = JSON.stringify(h.data);
        h.state.roads = graph;
        h.renderer.drawRoads(h.ctx);
        const focused = structuredClone(h.strokes);
        assert.ok(focused.length > 0);
        assert.ok(focused.every(stroke => stroke.dash.length > 0), source);
        assert.ok(focused.every(stroke => stroke.width <= 5), source);
        h.resetStrokes(); h.state.selectedIndex = 1;
        h.renderer.drawRoads(h.ctx);
        assert.deepEqual(h.strokes, focused, source);
        assert.deepEqual(h.getDash(), [], 'dash state must not leak into cities');
        assert.equal(h.state.roads, graph);
        assert.equal(h.state.engineTileEdges, nativeEdges);
        assert.equal(JSON.stringify(h.data), before);
        assert.deepEqual(h.sent, []);
    }
});

test('decorative neighbors do not change city feedback or hit anchors', () => {
    const h = harness();
    h.state.roads = { source: 'lcc-neighbors', edges: [edge], passes: 0 };
    const cities = JSON.stringify(h.state.cities);
    h.renderer.drawCities(h.ctx, 10000);
    const connected = structuredClone(h.strokes);
    h.resetStrokes(); h.state.roads = { source: 'none', edges: [], passes: 0 };
    h.renderer.drawCities(h.ctx, 10000);
    assert.deepEqual(h.strokes, connected);
    assert.equal(JSON.stringify(h.state.cities), cities);
    assert.deepEqual(h.sent, []);
});

test('legend counts and faction swatches follow native ownership without repeated writes', () => {
    const h = harness(); h.renderer.draw();
    const owned = h.nodes.get('hd-overworld-legend-owned');
    const neutral = h.nodes.get('hd-overworld-legend-neutral');
    const empty = h.nodes.get('hd-overworld-legend-empty');
    assert.equal(owned.textContent, '己方 1');
    assert.equal(neutral.textContent, '其他势力 2');
    assert.equal(empty.textContent, '无主城 1');
    for (const city of h.state.cities.filter(city => city.kind === 'neutral')) {
        assert.ok(neutral.style.getPropertyValue('--city-swatch').includes(city.color));
    }
    const writes = h.domWrites.length; h.renderer.draw();
    assert.equal(h.domWrites.length, writes);
    h.data.g_Cities[1].Belong = 1;
    h.renderer.sampleCities(); h.renderer.draw();
    assert.equal(owned.textContent, '己方 2');
    assert.equal(neutral.textContent, '其他势力 1');
    assert.ok(h.domWrites.length > writes);
    assert.deepEqual(h.sent, []);
});

test('hidden map redraws do not update the legend before returning to the current native state', () => {
    const h = harness(); h.renderer.draw();
    const owned = h.nodes.get('hd-overworld-legend-owned');
    const writes = h.domWrites.length;
    h.context.document.hidden = true; h.resetStrokes();
    h.data.g_Cities[1].Belong = 1;
    h.renderer.sampleCities();
    h.context.BayeHdOverworld.panBy(1, 1);
    assert.equal(owned.textContent, '己方 1');
    assert.equal(h.domWrites.length, writes);
    assert.equal(h.strokes.length, 0);
    h.context.document.hidden = false; h.renderer.draw();
    assert.equal(owned.textContent, '己方 2');
    assert.deepEqual(h.sent, []);
});

test('missing owners remain unknown while U16 owner 255 is an actual faction', () => {
    const h = harness();
    h.data.g_Cities.push({}, { Belong: null }, { Belong: 255 });
    for(let i=4;i<7;i++){h.names.push('测试城'+i);h.data.g_CityPositions.push({x:i+1,y:i+1});h.geo.cities.push({i,name:h.names[i],engX:i+1,engY:i+1,hdX:100+i*140,hdY:120+i*110});}
    h.renderer.sampleCities(); h.renderer.draw();
    assert.equal(h.nodes.get('hd-overworld-legend-empty').textContent, '无主城 1 · 归属未知 2');
    assert.equal(h.nodes.get('hd-overworld-legend-owned').textContent, '己方 1');
    assert.equal(h.nodes.get('hd-overworld-legend-neutral').textContent, '其他势力 3');
    assert.deepEqual(h.sent, []);
});
