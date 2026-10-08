import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/hd-minimap.js', import.meta.url), 'utf8');
function fixture() {
    const listeners = {}, keys = [], draws = [], elements = new Map();
    function element(id = '') {
        const attrs = {}, classes = new Set(), handlers = {};
        const value = { id, hidden: false, disabled: false, textContent: '', style: {}, children: [], handlers,
            setAttribute(k,v) { attrs[k]=v; }, getAttribute(k) { return attrs[k]; },
            classList: { toggle(k,on) { on ? classes.add(k) : classes.delete(k); }, contains:k=>classes.has(k) },
            addEventListener(k,fn) { handlers[k]=fn; }, appendChild(child) { this.children.push(child); },
            contains: other=>other===value, closest:()=>value, getBoundingClientRect:()=>({width:480,height:500}),
            getContext:()=>({ setTransform(){}, fillRect(){}, drawImage(...v){draws.push(v);},
                beginPath(){},arc(){},fill(){},stroke(){} }) };
        return value;
    }
    for (const id of ['hd-mini-map','hd-mini-map-classic','hd-mini-map-return','hd-mini-map-canvas',
        'hd-mini-map-content','hd-mini-map-summary','hd-mini-map-cities','hd-mini-map-fallback']) elements.set(id,element(id));
    const native={protocolVersion:1,active:1,complete:1,custom:0,defaultDraw:1,seq:4,generation:7,
        detailGeneration:7,mapInputSeq:9,resourceId:75,imageIndex:0,width:84,height:64,mask:0,city1:1};
    const image={complete:true,naturalWidth:3840,naturalHeight:4000}, data={image,width:3840,height:4000,generation:2,
        libSha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',
        cities:Array.from({length:38},(_,i)=>({index:i,name:'city'+i,x:100+i*40,y:500+i*50,
            engineX:i%10,engineY:i%8,belong:1,kind:'owned',color:'#3d8bfd'}))};
    let mode='hd-map',hidden=false,reportActive=0,menuActive=0,qtyActive=0,assetsReady=true;
    const document={get hidden(){return hidden;},documentElement:element(),getElementById:id=>elements.get(id),
        createElement:()=>element(),addEventListener(k,fn){listeners['document:'+k]=fn;}};
    const context=vm.createContext({document,Number,JSON,console,
        baye:{hd:{ready:()=>true,miniMap:()=>native,march:()=>({pick:1,mapInputSeq:9}),report:()=>({active:reportActive}),
            menuItems:()=>({active:menuActive}),qty:()=>({active:qtyActive}),fight:()=>({active:0})}},
        BayeHdOverworld:{getMode:()=>mode,overviewData:()=>assetsReady?data:null},
        sendKey:code=>keys.push(code),bayeInputIgnored:e=>!!e.defaultPrevented,
        bayeConsumeKeyEvent:e=>{e.preventDefault();e.consumed=true;},
        addEventListener(k,fn){listeners[k]=fn;},setInterval:()=>1,devicePixelRatio:1});
    context.window=context;vm.runInContext(source,context);const api=context.BayeHdMiniMap;api.start();
    function key(code,repeat=false) {
        const event={keyCode:code,repeat,preventDefault(){this.defaultPrevented=true;}};
        listeners.keydown(event);return event;
    }
    return {api,native,data,keys,draws,elements,listeners,key,
        mode:v=>{mode=v;},hidden:v=>{hidden=v;},report:v=>{reportActive=v;},menu:v=>{menuActive=v;},qty:v=>{qtyActive=v;},assets:v=>{assetsReady=v;}};
}
test('native mini-map owner displays all authorized cities without sending game input',()=>{
    const h=fixture(),before=JSON.stringify(h.native);h.api.poll();
    assert.equal(h.api.debugSnapshot().complete,true);assert.equal(h.api.debugSnapshot().cities.length,38);
    assert.equal(h.elements.get('hd-mini-map').hidden,false);assert.equal(h.elements.get('hd-mini-map-return').disabled,false);
    assert.equal(h.api.debugSnapshot().showLcd,false);assert.ok(h.draws.length>0);
    assert.deepEqual(h.keys,[]);assert.equal(JSON.stringify(h.native),before);
});
test('one explicit key closes only its native overlay and repeats cannot become map movement',()=>{
    for (const [key,code] of [[37,0x24],[38,0x22],[39,0x25],[40,0x23],[13,0x27],[27,0x28],[72,0x26],[70,0x33],[53,0x45]]) {
        const h=fixture();assert.equal(h.key(key).consumed,true);assert.equal(h.key(key,true).consumed,true);
        h.api.returnKey(code,h.api.debugSnapshot().owner);assert.deepEqual(h.keys,[code]);
        h.native.active=0;h.api.poll();assert.equal(h.api.isOpen(),false);
    }
});
test('custom hooks, missing default image metadata and untrusted geography keep the real LCD',()=>{
    for(const mutate of [h=>h.native.custom=1,h=>h.native.complete=0,h=>h.native.width=85,
        h=>h.native.defaultDraw=0,h=>h.native.mask=1,h=>h.data.libSha256='unknown']) {
        const h=fixture();mutate(h);h.api.poll();const value=h.api.debugSnapshot();
        assert.equal(value.complete,false);assert.equal(value.showLcd,true);
        assert.deepEqual(h.keys,[]);assert.equal(h.elements.get('hd-mini-map-classic').disabled,true);
    }
});
test('classic comparison toggles no native key and a pressed old owner cannot close the new map',()=>{
    const h=fixture(),root=h.elements.get('hd-mini-map'),toggle=h.elements.get('hd-mini-map-classic'),back=h.elements.get('hd-mini-map-return');
    root.handlers.click({target:toggle});assert.equal(h.api.debugSnapshot().showLcd,true);assert.deepEqual(h.keys,[]);
    root.handlers.pointerdown({target:back});h.native.seq++;h.api.poll();root.handlers.click({target:back});
    assert.deepEqual(h.keys,[]);root.handlers.click({target:back});assert.deepEqual(h.keys,[0x28]);
});
test('mode, visibility, generation, map wait and higher native owners retire the overview',()=>{
    for(const mutate of [h=>h.mode('classic'),h=>h.hidden(true),h=>h.native.detailGeneration++,
        h=>h.native.mapInputSeq++,h=>h.report(1),h=>h.menu(1),h=>h.qty(1)]) {
        const h=fixture(),old=h.api.debugSnapshot().owner;mutate(h);h.api.poll();
        assert.equal(h.api.isOpen(),false);assert.equal(h.api.returnKey(0x28,old),false);assert.deepEqual(h.keys,[]);
    }
});
test('resize and classic toggle immediately revoke stale library art before the next poll',()=>{
    for (const trigger of ['resize','classic']) {
        const h=fixture(),root=h.elements.get('hd-mini-map');
        root.handlers.click({target:h.elements.get('hd-mini-map-classic')});
        assert.equal(h.api.debugSnapshot().showLcd,true);
        const images=h.draws.length;h.assets(false);
        if(trigger==='resize') h.listeners.resize();
        else root.handlers.click({target:h.elements.get('hd-mini-map-classic')});
        assert.equal(h.api.debugSnapshot().complete,false);assert.equal(h.api.debugSnapshot().showLcd,true);
        assert.equal(h.draws.length,images);assert.deepEqual(h.keys,[]);
    }
});

function assertRetiredPresentationPress(reason) {
    for (const id of ['hd-mini-map-return', 'hd-mini-map-classic']) {
        const h=fixture(),root=h.elements.get('hd-mini-map'),target=h.elements.get(id),
            back=h.elements.get('hd-mini-map-return'),before=h.api.debugSnapshot(),native=JSON.stringify(h.native);
        Object.freeze(h.native);
        root.handlers.pointerdown({target});
        if(reason==='hidden') {
            h.hidden(true);h.listeners['document:visibilitychange']();
        } else {
            h.mode('classic');h.api.poll();
        }
        assert.equal(h.api.isOpen(),false);
        if(reason==='hidden') {
            h.hidden(false);h.listeners['document:visibilitychange']();
        } else {
            h.mode('hd-map');h.api.poll();
        }
        const restored=h.api.debugSnapshot();
        assert.equal(restored.open,true);assert.equal(restored.owner,before.owner);
        assert.ok(restored.presentationEpoch>before.presentationEpoch);
        assert.equal(JSON.stringify(h.native),native,'UI retirement must leave the exact native wait and metadata unchanged');
        root.handlers.click({target});
        assert.deepEqual(h.keys,[],'the former physical press cannot dismiss the restored native overlay');
        assert.equal(h.api.debugSnapshot().showLcd,restored.showLcd,'an old classic press cannot change the restored presentation');
        root.handlers.pointerdown({target:back});root.handlers.click({target:back});
        root.handlers.click({target:back});h.key(27,true);
        assert.deepEqual(h.keys,[0x28],'a new explicit press sends exactly one native Exit');
        assert.equal(JSON.stringify(h.native),native);
    }
}
test('hidden then visible with the same native owner retires old Return and classic presses',()=>{
    assertRetiredPresentationPress('hidden');
});
test('classic then HD mode with the same native owner retires old Return and classic presses',()=>{
    assertRetiredPresentationPress('mode');
});
