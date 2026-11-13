import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const lib = readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
const standardHash = createHash('sha256').update(lib).digest('hex');
const identitySource = readFileSync(new URL('../js/hd-lib-identity.js', import.meta.url), 'utf8');
const worldSource = readFileSync(new URL('../js/hd-overworld.js', import.meta.url), 'utf8')
    .replace(/\}\)\(window\);\s*$/, 'global.__map = {state, sampleCities, draw, applyChrome};\n})(window);');
const asset = path => JSON.parse(readFileSync(new URL('../assets/hd-overworld/' + path, import.meta.url), 'utf8'));
const standardGeo = asset('china-lcc-cities.json');

function harness({ hex = lib.toString('hex'), crypto = webcrypto, hooks = {} } = {}) {
    const requests = [], images = [], keys = [], writes = [], paints = [], frames = new Map(), timers = new Map(), nodes = new Map();
    let nextId = 0, now = 10000;
    const listeners = new Map();
    class Clock extends Date { static now() { return now; } }
    const preferences = new Map([['baye/overworldMode', 'hd-map'], ['baye/libpath', 'libs/dat-mod.lib']]);
    function element(id) {
        const attrs = new Map(), classes = new Set(), handlers = new Map();
        const ctx = new Proxy({ measureText: text => ({width: String(text).length * 12}),
            createLinearGradient: () => ({addColorStop(){}}), getImageData: () => ({data:[0,0,0,0]}) }, {
            get(target, key) { return key in target ? target[key] : (...args) => paints.push({id,key,args}); }
        });
        const node = {id, width:1920,height:1080,style:{setProperty(){}},textContent:'',attrs,classes,handlers,
            classList:{toggle(name, on){on?classes.add(name):classes.delete(name);},add:name=>classes.add(name),remove:name=>classes.delete(name)},
            setAttribute:(key,value)=>attrs.set(key,String(value)),getAttribute:key=>attrs.get(key),
            addEventListener(type, callback){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(callback);},
            querySelectorAll:()=>[],getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1920,height:1080})};
        return node;
    }
    for(const id of ['hd-overworld','hd-overworld-canvas','hd-overworld-hud-left','hd-overworld-hud-right',
        'hd-overworld-legend-owned','hd-overworld-legend-neutral','hd-overworld-legend-empty'])nodes.set(id,element(id));
    const document = {hidden:false,body:element('body'),documentElement:element('html'),
        getElementById:id=>nodes.get(id)||null,createElement:()=>element('scratch'),
        addEventListener(name, handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);}};
    const names = standardGeo.cities.map(c=>c.name);
    const raw = {g_PlayerKing:0,g_PIdx:1,g_YearDate:190,g_MonthDate:1,
        g_Cities: names.map(()=>({Belong:1})),g_CityPositions:standardGeo.cities.map(c=>({x:c.engX,y:c.engY})),
        g_CityPos:new Proxy({setx:1,sety:0,x:0,y:0},{set(target,key,value){writes.push([key,value]);target[key]=value;return true;}})};
    const menu = {active:0,context:0,kind:0,seq:1}, march = {pick:1,battlePick:0,mapInputSeq:1,mapCity:1};
    const fight = {active:0,over:0}, report = {active:0};
    class XMLHttpRequest {
        open(method,url){this.url=url;} send(){requests.push(this);}
    }
    class Image {
        set src(value){this.url=value;images.push(this);}
    }
    const context = vm.createContext({document,console:{log(){},warn(){}},Image,XMLHttpRequest,crypto,Uint8Array,Date:Clock,
        Promise:class {constructor(){throw new Error('engine window.Promise is not a native promise');}},dynLib:hex,
        localStorage:{getItem:key=>preferences.get(key)||null,setItem:(key,value)=>preferences.set(key,String(value))},
        baye:{data:raw,ensureData:()=>raw,hdCityLimit:()=>raw.g_Cities.length,getCityName:i=>names[i],hooks,
            callHook(name, value){return this.hooks[name]?.(value);},
            hd:{ready:()=>true,menuItems:()=>menu,march:()=>march,fight:()=>fight,report:()=>report}},
        sendKey:key=>keys.push(key),addEventListener(){},devicePixelRatio:1,
        requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
        setTimeout:(fn,ms)=>{const id=++nextId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
    context.window=context;
    vm.runInContext(identitySource,context,{filename:'js/hd-lib-identity.js'});
    vm.runInContext(worldSource,context,{filename:'js/hd-overworld.js'});
    const api=context.BayeHdOverworld;api.start();
    function response(request,value){request.readyState=4;request.status=200;request.responseText=JSON.stringify(value);request.onreadystatechange();request.responded=true;}
    function complete({manifest=asset('manifest.json'),geo=asset('china-lcc-cities.json'),roads=asset('roads/adjacency.json')}={}) {
        const req=requests.find(r=>!r.responded&&r.url.split('?')[0].endsWith('manifest.json'));
        assert.ok(req,'a verified standard LIB requests the manifest');response(req,manifest);
        for(const request of requests.filter(r=>!r.responded))response(request,request.url.split('?')[0].endsWith('china-lcc-cities.json')?geo:
            request.url.split('?')[0].endsWith('roads/adjacency.json')?roads:asset('palette/factions.json'));
        for(const image of images.filter(i=>!i.resolved)){image.width=image.url.includes('base_plains')?3840:64;image.height=image.url.includes('base_plains')?4000:64;image.resolved=true;image.onload();}
    }
    return {api,context,document,raw,names,menu,march,fight,report,requests,images,keys,writes,paints,frames,timers,nodes,complete,response,
        state:context.__map.state,sample:()=>context.__map.sampleCities(),
        nativeHook(name){ // The real C call_hook_s enters JS only when this observer exists.
            return typeof context.baye.hooks[name]==='function' ? context.baye.callHook(name) : -1;
        },
        frame(milliseconds=200){const pending=[...frames.entries()];now+=milliseconds;
            for(const [id,callback]of pending)if(frames.delete(id))callback();},
        setHidden(hidden){document.hidden=hidden;for(const callback of listeners.get('visibilitychange')||[])callback();},
        click(type='click'){const e={clientX:960,clientY:540,pointerId:1,prevented:false,preventDefault(){this.prevented=true;}};
            for(const callback of nodes.get('hd-overworld-canvas').handlers.get(type)||[])callback(e);return e;},
        async ready(){
            const deadline=Date.now()+2000;
            while(context.BayeHdLibIdentity.read().status==='pending'){
                assert.ok(Date.now()<deadline,'The actual LIB digest must finish within the fixture deadline');
                await new Promise(resolve=>setTimeout(resolve,1));
            }
            return context.BayeHdLibIdentity.read();
        }};
}

async function loaded(options){const h=harness(options);assert.equal((await h.ready()).status,'ready');h.complete();assert.equal(h.api.debugSnapshot().presentationReady,true);return h;}

test('actual loaded standard bytes authorize only matching manifest and geo provenance, independently of the preferred path',async()=>{
    const h=harness();assert.equal(h.api.debugSnapshot().presentationReady,false);assert.equal(h.requests.length,0);
    assert.equal(h.context.BayeHdLibIdentity.read().status,'pending');
    const identity=await h.ready();assert.equal(identity.sha256,standardHash);assert.equal(identity.byteLength,lib.length);
    h.complete();assert.equal(h.api.debugSnapshot().presentationReady,true);assert.equal(h.api.getCities().length,38);
    assert.equal(h.api.getRoads().source,'lcc-neighbors');
    assert.ok(h.document.body.classes.has('baye-hd-overworld-map'));assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('a byte-modified LIB with a standard preferred path remains classic and never claims standard city positions',async()=>{
    const bytes=Buffer.from(lib);bytes[0]^=1;
    const h=harness({hex:bytes.toString('hex')});await h.ready();
    assert.notEqual(h.context.BayeHdLibIdentity.read().sha256,standardHash);
    assert.equal(h.api.debugSnapshot().presentationReady,false);assert.equal(h.api.debugSnapshot().presentationReason,'lib-not-supported');
    assert.equal(h.requests.length,0);assert.equal(h.api.getCities().length,0);
    assert.equal(h.document.body.classes.has('baye-hd-overworld-on'),false);assert.equal(h.nodes.get('hd-overworld').attrs.get('aria-hidden'),'true');
    assert.equal(h.click().prevented,false);h.api.walkToCity(0);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('pending, malformed, missing and unavailable digest identities preserve classic pointer and keyboard ownership',async()=>{
    for(const options of [{hex:null},{hex:'0xz1'},{crypto:null},{}]){
        const h=harness(options);assert.equal(h.api.debugSnapshot().presentationReady,false);
        assert.equal(h.click('pointerdown').prevented,false);assert.equal(h.click().prevented,false);
        assert.equal(h.document.body.classes.has('baye-hd-overworld-map'),false);assert.equal(h.frames.size,0);
        h.api.walkToCity(0);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
    }
});

test('manifest and geo hash mismatches cannot inherit standard map authorization',async()=>{
    for(const part of ['manifest','geo']){
        const h=harness();await h.ready();const value=asset(part==='manifest'?'manifest.json':'china-lcc-cities.json');value.libSha256='f'.repeat(64);
        h.complete({[part]:value});assert.equal(h.api.debugSnapshot().presentationReady,false);
        assert.equal(h.api.debugSnapshot().presentationReason,part+'-identity-mismatch');assert.equal(h.api.getCities().length,0);
        assert.equal(h.click().prevented,false);assert.deepEqual(h.keys,[]);
    }
});

test('city index, native name and native position must all agree; reorder and same-name wrong-index do not use OR matching',async()=>{
    for(const change of ['names','positions','geo-index','missing-position']){
        const h=harness();await h.ready();const geo=asset('china-lcc-cities.json');
        if(change==='names')[h.names[0],h.names[1]]=[h.names[1],h.names[0]];
        if(change==='positions')[h.raw.g_CityPositions[0],h.raw.g_CityPositions[1]]=[h.raw.g_CityPositions[1],h.raw.g_CityPositions[0]];
        if(change==='geo-index')[geo.cities[0].i,geo.cities[1].i]=[geo.cities[1].i,geo.cities[0].i];
        if(change==='missing-position')delete h.raw.g_CityPositions[0];
        h.complete({geo});assert.equal(h.api.debugSnapshot().presentationReady,false);assert.equal(h.api.debugSnapshot().presentationReason,'city-layout-mismatch');
        assert.equal(h.api.getRoads().edges.length,0);assert.equal(h.api.getCities().length,0);assert.equal(h.click().prevented,false);
    }
});

test('road provenance mismatch disables decorative connectors without disabling a correctly bound city map',async()=>{
    const h=harness();await h.ready();const roads=asset('roads/adjacency.json');roads.libSha256='f'.repeat(64);
    h.complete({roads});assert.equal(h.api.debugSnapshot().presentationReady,true);
    assert.equal(h.api.getRoads().source,'none');assert.equal(h.api.getRoads().edges.length,0);
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('an actual LIB replacement retires alignment, LCC caches, roads and late geo/image results',async()=>{
    const h=await loaded();h.api.walkToCity(8);const pending=[...h.timers.values()];assert.ok(pending.length);
    h.context.dynLib='01020304';h.context.BayeHdLibIdentity.read();
    assert.equal(h.state.assetsReady,false);assert.equal(h.state.geoMeta,null);assert.equal(h.state.manifest,null);assert.equal(h.frames.size,0);
    assert.equal(h.api.getRoads().edges.length,0);assert.equal(h.state.aligning,false);
    for(const callback of pending)callback();assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
    const slow=harness();await slow.ready();const request=slow.requests[0];slow.response(request,asset('manifest.json'));
    const lateGeo=slow.requests.find(r=>r.url.split('?')[0].endsWith('china-lcc-cities.json')),oldImages=[...slow.images];
    slow.context.dynLib='01020304';slow.context.BayeHdLibIdentity.read();slow.response(lateGeo,asset('china-lcc-cities.json'));
    for(const image of oldImages){image.width=3840;image.height=4000;image.onload();}
    assert.equal(slow.state.geoMeta,null);assert.equal(Object.keys(slow.state.images).length,0);assert.equal(slow.api.debugSnapshot().presentationReady,false);
});

test('late assets from a retired classic view cannot complete a later HD view of the same LIB',async()=>{
    const h=harness();await h.ready();const oldManifest=h.requests[0];h.response(oldManifest,asset('manifest.json'));
    const oldGeo=h.requests.find(r=>r.url.split('?')[0].endsWith('china-lcc-cities.json')),oldImages=[...h.images];
    h.api.setMode('classic');h.api.setMode('hd-map');const generation=h.state.assetGeneration;
    h.response(oldGeo,asset('china-lcc-cities.json'));for(const image of oldImages){image.width=3840;image.height=4000;image.onload();}
    assert.equal(h.state.assetGeneration,generation);assert.equal(h.state.geoMeta,null);assert.equal(h.state.assetsReady,false);
    h.complete();assert.equal(h.api.debugSnapshot().presentationReady,true);assert.deepEqual(h.keys,[]);
});

test('terrain-only hooks do not veto standard overworld identity or execute during passive rendering',async()=>{
    let calls=0;const h=await loaded({hooks:{drawMapUnit(){calls++;},getTerrainInfo(){calls++;},loadFightMap(){calls++;}}});
    assert.equal(h.api.debugSnapshot().presentationReady,true);assert.equal(calls,0);assert.deepEqual(h.keys,[]);
});

test('City U16 ownership preserves lord254 and higher IDs; zero alone is unowned and player index255 is valid',async()=>{
    const h=await loaded();h.raw.g_PlayerKing=254;h.raw.g_Cities[0].Belong=255;h.raw.g_Cities[1].Belong=600;h.raw.g_Cities[2].Belong=0;
    h.sample();const cities=h.api.getCities();assert.equal(cities[0].kind,'owned');assert.equal(cities[0].belong,255);
    assert.equal(cities[1].kind,'neutral');assert.equal(cities[2].kind,'empty');assert.equal(h.api.debugSnapshot().playerBelong,255);
    h.raw.g_PlayerKing=255;h.raw.g_Cities[0].Belong=256;h.sample();assert.equal(h.api.getCities()[0].kind,'owned');
    assert.equal(h.api.debugSnapshot().playerBelong,256);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('hot native city-layout changes retire map interaction before another input key or pointer gesture',async()=>{
    const h=await loaded();h.raw.g_CityPositions[8].x++;
    h.api.walkToCity(8);assert.equal(h.api.debugSnapshot().presentationReady,false);assert.equal(h.api.getRoads().edges.length,0);
    assert.equal(h.click().prevented,false);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('a native name getter that replaces actual LIB bytes cannot authorize input using the previous layout',async()=>{
    const h=await loaded();let reads=0;
    h.context.baye.getCityName=i=>{reads++;h.context.dynLib='01020304';return h.names[i];};
    h.api.walkToCity(8);
    assert.ok(reads>0,'the name getter changes LIB during the input authorization check');
    assert.equal(h.context.BayeHdLibIdentity.read().status,'pending');
    assert.equal(h.api.debugSnapshot().presentationReady,false);
    assert.equal(h.state.aligning,false);assert.equal(h.state.geoMeta,null);
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('native name reads that retire LIB identity during sampling cannot publish stale cities or dereference retired geo',async()=>{
    for(const notify of [false,true]) {
        const h=await loaded();let reads=0;h.paints.length=0;
        h.context.baye.getCityName=i=>{
            reads++;h.context.dynLib='01020304';
            if(notify)h.context.BayeHdLibIdentity.read();
            return h.names[i];
        };
        assert.doesNotThrow(()=>h.sample());
        assert.ok(reads>0);assert.equal(h.state.cities.length,0);assert.equal(h.state.geoCities,null);
        assert.equal(h.api.debugSnapshot().presentationReady,false);
        assert.doesNotThrow(()=>h.context.__map.draw());
        assert.deepEqual(h.paints,[]);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
    }
});

test('invalid city owners stay unknown without coercing U16 sentinels or malformed values into lords or unowned cities',async()=>{
    const h=await loaded();
    for(const value of [65535,0.5,NaN,Infinity,'',false,true,null,undefined,-1,'255']){
        h.raw.g_Cities[0].Belong=value;h.sample();const city=h.api.getCities()[0];
        assert.equal(city.kind,'unknown',String(value));assert.equal(city.belong,null);
        assert.equal(city.color,h.state.palette.empty||'#8a8f98');
    }
    h.raw.g_Cities[0].Belong=0;h.sample();assert.equal(h.api.getCities()[0].kind,'empty');
    h.raw.g_Cities[0].Belong=255;h.sample();assert.equal(h.api.getCities()[0].kind,'neutral');
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('standard map provenance records independently bind the actual repository LIB digest and keep roads decorative',()=>{
    for(const path of ['manifest.json','china-lcc-cities.json','roads/adjacency.json'])assert.equal(asset(path).libSha256,standardHash);
    const roads=asset('roads/adjacency.json');assert.equal(roads.useRuntimePositions,true);assert.equal(roads.edges.length,0);
});

test('preset HD assets that finish before world initialization wake on genuine new-game/load and map hooks',async()=>{
    for(const hook of ['didOpenNewGame','didLoadGame']){
        const h=harness();h.raw.g_CityPositions.forEach(pos=>{pos.x=0;pos.y=0;});
        h.march.pick=0;h.menu.active=1;h.menu.context=4;
        await h.ready();h.complete();
        assert.equal(h.state.assetsReady,true);assert.equal(h.state.layoutMatched,false);assert.equal(h.frames.size,0);
        h.raw.g_CityPositions=standardGeo.cities.map(c=>({x:c.engX,y:c.engY}));
        h.menu.active=0;h.menu.context=0;
        assert.equal(h.nativeHook(hook),-1);
        assert.equal(h.api.debugSnapshot().presentationReady,true);assert.equal(h.api.getCities().length,38);
        assert.equal(h.api.getPhase(),'other','a ready world is not the native map wait');
        assert.equal(h.api.debugSnapshot().hitsEnabled,false);assert.equal(h.frames.size,1);
        h.frame();assert.equal(h.api.getPhase(),'other');assert.equal(h.frames.size,1);
        h.march.pick=1;h.march.mapInputSeq++;
        assert.equal(typeof h.context.baye.hooks.didShowMainMap,'function','C must be able to enter the actual map observer');
        assert.equal(h.nativeHook('didShowMainMap'),-1);
        assert.equal(h.api.getPhase(),'map');assert.equal(h.api.debugSnapshot().hitsEnabled,true);assert.equal(h.frames.size,1);
        assert.ok(h.document.body.classes.has('baye-hd-overworld-map'));
        assert.equal(h.requests.filter(request=>request.url.includes('manifest.json')).length,1);
        assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
    }
});

test('new-game read-only sampling follows a later native pick without a toolbar click or another map event',async()=>{
    const h=harness();h.raw.g_CityPositions.forEach(pos=>{pos.x=0;pos.y=0;});h.march.pick=0;
    await h.ready();h.complete();
    h.raw.g_CityPositions=standardGeo.cities.map(c=>({x:c.engX,y:c.engY}));h.nativeHook('didOpenNewGame');
    assert.equal(h.api.getPhase(),'other');assert.equal(h.frames.size,1);
    h.march.pick=1;h.frame();
    assert.equal(h.api.getPhase(),'map');assert.equal(h.api.debugSnapshot().hitsEnabled,true);assert.equal(h.frames.size,1);
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('map observation preserves a Mod callback and infers report/menu/fight input instead of forcing map phase',async()=>{
    let calls=0;const observer=()=>{calls++;return 17;};const h=await loaded({hooks:{didShowMainMap:observer}});
    assert.equal(h.context.baye.hooks.didShowMainMap,observer);
    for(const owner of ['report','system-menu','city-menu','fight']){
        h.report.active=0;h.fight.active=0;h.menu.active=0;h.menu.context=0;
        if(owner==='report')h.report.active=1;
        if(owner==='system-menu'){h.menu.active=1;h.menu.context=4;}
        if(owner==='city-menu'){h.menu.active=1;h.menu.context=1;}
        if(owner==='fight')h.fight.active=1;
        assert.equal(h.nativeHook('didShowMainMap'),17);
        assert.equal(h.api.getPhase(),owner==='city-menu'?'classic-menu':'other',owner);
        assert.equal(h.api.debugSnapshot().hitsEnabled,false,owner);
    }
    assert.equal(calls,4);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});

test('new map hooks cannot wake pending/actual Mod libraries or paint and schedule while hidden',async()=>{
    for(const hex of [lib.toString('hex'),readFileSync(new URL('../libs/sc-mod.lib',import.meta.url)).toString('hex')]){
        const h=harness({hex});h.nativeHook('didOpenNewGame');h.nativeHook('didShowMainMap');
        assert.equal(h.context.BayeHdLibIdentity.read().status,'pending');assert.equal(h.frames.size,0);assert.equal(h.paints.length,0);
        await h.ready();
        if(hex===lib.toString('hex')){
            h.complete();h.setHidden(true);h.paints.length=0;
            h.nativeHook('didLoadGame');h.nativeHook('didShowMainMap');
            assert.equal(h.frames.size,0);assert.equal(h.paints.length,0);
            h.setHidden(false);assert.equal(h.frames.size,1);assert.equal(h.api.getPhase(),'map');
        }else{
            h.nativeHook('didOpenNewGame');h.nativeHook('didShowMainMap');
            assert.equal(h.requests.length,0);assert.equal(h.frames.size,0);assert.equal(h.paints.length,0);
            assert.equal(h.api.debugSnapshot().presentationReady,false);assert.equal(h.api.getCities().length,0);
            assert.equal(h.nodes.get('hd-overworld').attrs.get('aria-hidden'),'true');
        }
        assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
    }
});
