// Black-box mobile SEARCH host tests. MAP authorization uses the actual mobile map module.
// Native publications and shared overview presentation are controlled fixtures, not game execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const mapSource = readFileSync(new URL('../js/hd-mobile-map.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../js/hd-mobile-minimap.js', import.meta.url), 'utf8');
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const blockers = ['BattlePick','MenuActive','ReportActive','QtyActive','FightActive','HelpActive','RecordActive',
    'MovieActive','SpeActive','SkillActive','AttackActive','SkillResultActive','MakerActive','ViewActive',
    'GoodsActive','PersonPropertiesActive','ResultOwnerKind','ResultOwnerValid'];
function fixture() {
    const documentEvents = new Map(), windowEvents = new Map(), viewportEvents = new Map(), subscribers = [], timers = [];
    function listen(store, name, fn) { const list = store.get(name) || []; list.push(fn); store.set(name, list); }
    function element() {
        const events = new Map(), classes = new Set();
        return {events, disabled:false, hidden:false, isConnected:true, rect:{left:0,top:0,width:60,height:44},
            getBoundingClientRect(){return {...this.rect};},addEventListener(name, fn) { listen(events,name,fn); },
            contains(other) { return other === this; },
            classList:{contains:name=>classes.has(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);},add(name){classes.add(name);}},
            fire(name, values={}) { const event = {type:name, target:this, currentTarget:this, isTrusted:true,
                pointerId:1, isPrimary:true, button:0, clientX:30, clientY:20, repeat:false,
                preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};
                for(const fn of documentEvents.get(name)||[])fn(event);
                for(const fn of events.get(name)||[])fn(event); return event; }};
    }
    const button=element(), outside=element(), body=element();body.classList.add('hd-mobile-page');
    let top=button, currentButton=button, identity={status:'ready',sha256:SHA,byteLength:207195,generation:3}, ready=true, getterHook=null;
    const document={body,hidden:false,activeElement:button,getElementById:id=>id==='hd-mobile-map-overview'?currentButton:null,
        elementFromPoint:()=>top,addEventListener(name,fn){listen(documentEvents,name,fn);}};
    const data={g_hdEngineReady:1,g_hdMapPick:1,g_hdMapCity:17,g_hdMapInputSeq:8,g_hdDetailGeneration:4,
        g_hdSpeGeneration:4,g_hdMarchPhase:0,g_hdMarchSession:5,g_hdMarchInputSeq:11,
        g_hdMenuContext:1,g_hdMenuKind:1,g_hdMenuSeq:12,g_hdMenuCount:4,g_hdMenuIndex:0,
        g_hdReportSeq:3,g_hdReportInputSeq:6,g_hdQtySession:4,g_hdQtyInputSeq:2,
        g_hdFightInputSeq:20,g_hdHelpInputSeq:3,g_hdRecordSeq:2,g_hdMiniMapActive:0,
        g_hdTransferProtocolVersion:1,g_hdTransferActive:0,g_CityPos:{setx:40,sety:28}};
    for(const field of blockers)data['g_hd'+field]=0;
    const native={protocolVersion:1,active:1,complete:1,custom:0,defaultDraw:1,seq:9,generation:4,
        detailGeneration:4,mapInputSeq:8,resourceId:75,imageIndex:0,width:84,height:64,mask:0,
        cursorX:40,cursorY:28,viewX:3,viewY:5,viewWidth:10,viewHeight:7,city1:17};
    const sharedState={mode:'hd-map',presentationReady:true,phase:'map'};
    const miniState={open:false,complete:false,owner:'overview-current',showLcd:false};
    const counts={keys:[],poll:0,start:0,attach:0};
    const environment={document,innerWidth:844,innerHeight:390,
        BayeHdLibIdentity:{read:()=>identity,isCurrent:i=>i.status===identity.status&&i.generation===identity.generation&&
            i.sha256===identity.sha256&&i.byteLength===identity.byteLength,subscribe(fn){subscribers.push(fn);}},
        BayeHdOverworld:{getMode:()=>sharedState.mode,debugSnapshot:()=>({...sharedState})},
        BayeHdMiniMap:{attachMobileHost(host){counts.attach++;counts.host=host;},start(){counts.start++;},
            poll(){counts.poll++;},debugSnapshot:()=>({...miniState})},
        baye:{data,ensureData:()=>environment.baye.data,hd:{ready:()=>ready,miniMap(){
            const result={...native};if(getterHook)getterHook();return result;}}},
        sendKey(code){counts.keys.push(code);},setInterval(fn,ms){timers.push({fn,ms});return timers.length;},
        addEventListener(name,fn){listen(windowEvents,name,fn);},
        visualViewport:{addEventListener(name,fn){listen(viewportEvents,name,fn);}}};
    vm.runInNewContext(mapSource+'\n'+source,{window:environment});
    const controller=environment.BayeHdMobileMiniMap.createController(environment);
    function publish() {
        Object.assign(data,{g_hdMiniMapProtocolVersion:1,g_hdMiniMapActive:1,g_hdMiniMapComplete:1,
            g_hdMiniMapCustom:0,g_hdMiniMapDefaultDraw:1,g_hdMiniMapSeq:9,g_hdMiniMapGeneration:4,
            g_hdMiniMapInputSeq:8,g_hdMiniMapResourceId:75,g_hdMiniMapImageIndex:0,g_hdMiniMapWidth:84,
            g_hdMiniMapHeight:64,g_hdMiniMapMask:0,g_hdMiniMapCursorX:40,g_hdMiniMapCursorY:28,
            g_hdMiniMapViewX:3,g_hdMiniMapViewY:5,g_hdMiniMapViewWidth:10,g_hdMiniMapViewHeight:7,g_hdMiniMapCity1:17});
        miniState.open=true;miniState.complete=true;
    }
    function notify(store,name,event={}) { for(const fn of store.get(name)||[])fn(event); }
    return {controller,environment,document,button,outside,data,native,sharedState,miniState,counts,timers,publish,
        ready(value){ready=value;},identity(value){identity={...identity,...value};},
        getter(fn){getterHook=fn;},top(value){top=value;},
        boundary(name){notify(windowEvents,name);},viewportResize(){notify(viewportEvents,'resize');},
        scroll(){notify(documentEvents,'scroll');},replaceButton(){currentButton=outside;},
        hidden(value){document.hidden=value;notify(documentEvents,'visibilitychange');},
        identityEvent(){for(const fn of subscribers)fn(identity);},
        outsideDown(id=2){notify(documentEvents,'pointerdown',{pointerId:id,isPrimary:false,target:outside});},
        outsideUp(id=2){notify(documentEvents,'pointerup',{pointerId:id,isPrimary:false,target:outside});},
        tap(down={},up={}){button.fire('pointerdown',down);button.fire('pointerup',up);},
        key(key='Enter',down={},up={}){button.fire('keydown',{key,...down});button.fire('keyup',{key,...up});}};
}
function noSearch(f){assert.deepEqual(f.counts.keys,[]);}

test('init is idempotent; genuine MAP opens only with its exact opaque ticket and once while pending',()=>{
    const f=fixture(),before=JSON.stringify(f.data);f.controller.init();f.controller.init();
    assert.equal(f.counts.attach,1);assert.equal(f.counts.start,1);assert.equal(f.timers.length,1);
    assert.equal(f.controller.snapshot().openEnabled,true);
    const t=f.environment.BayeHdMobileMap.getInputTicket();assert.equal(t.data,f.data);assert.equal(Object.keys(t).includes('data'),false);
    assert.equal(f.controller.open(t),true);assert.deepEqual(f.counts.keys,[51]);
    assert.equal(f.controller.open(t),false);f.tap();f.key();assert.deepEqual(f.counts.keys,[51]);
    assert.equal(f.controller.snapshot().openEnabled,false);assert.equal(JSON.stringify(f.data),before);
});
test('entry refuses absent, forged, stale and rebound opaque MAP tickets',()=>{
    for(const change of ['absent','key','data','generation']){
        const f=fixture(),t=f.environment.BayeHdMobileMap.getInputTicket();
        let expected=t;
        if(change==='absent')expected=undefined;
        if(change==='key')expected={...t,data:f.data,key:'old'};
        if(change==='data')f.environment.baye.data={...f.data};
        if(change==='generation')f.identity({generation:4});
        assert.equal(f.controller.open(expected),false,change);noSearch(f);
    }
});
test('blank-ground MAP and retained departed phase7 remain genuine SEARCH entries',()=>{
    for(const value of [{g_hdMapCity:0},{g_hdMarchPhase:7}]){
        const f=fixture();Object.assign(f.data,value);f.controller.init();f.tap();assert.deepEqual(f.counts.keys,[51]);
    }
});
for(const field of blockers.concat(['MiniMapActive']))test('actual MobileMap rejects blocked entry '+field,()=>{
    const f=fixture();f.data['g_hd'+field]=1;f.controller.init();
    assert.equal(f.environment.BayeHdMobileMap.getInputTicket(),null);assert.equal(f.controller.snapshot().openEnabled,false);
    f.tap();f.key();noSearch(f);
});
test('entry requires current HD presentation, native readiness, original identity and inactive transfer',()=>{
    for(const change of ['not-ready','identity','generation','classic','phase','presentation','portrait','hidden','transfer']){
        const f=fixture();
        if(change==='not-ready')f.ready(false);if(change==='identity')f.identity({sha256:'f'.repeat(64)});
        if(change==='generation')f.identity({generation:0});if(change==='classic')f.sharedState.mode='classic';
        if(change==='phase')f.sharedState.phase='classic-menu';if(change==='presentation')f.sharedState.presentationReady=false;
        if(change==='portrait'){f.environment.innerWidth=390;f.environment.innerHeight=844;}
        if(change==='hidden')f.document.hidden=true;if(change==='transfer')f.data.g_hdTransferActive=1;
        f.controller.init();f.tap();assert.equal(f.controller.snapshot().openEnabled,false,change);noSearch(f);
    }
});
test('real MiniMap publication produces a frozen opaque receipt and cannot reopen or auto EXIT',()=>{
    const f=fixture();f.controller.init();f.tap();f.publish();
    const receipt=f.controller.readNative();assert.ok(receipt);assert.equal(receipt.data,f.data);
    assert.equal(Object.keys(receipt).includes('data'),false);assert.equal(Object.isFrozen(receipt),true);
    assert.equal(Object.isFrozen(receipt.native),true);assert.equal(receipt.native.width,84);assert.equal(receipt.native.height,64);
    const s=f.controller.refresh();assert.equal(s.active,true);assert.equal(s.openEnabled,false);assert.equal(s.owner,'overview-current');
    assert.equal(f.document.body.classList.contains('hd-mobile-minimap-on'),true);f.tap();f.key();assert.deepEqual(f.counts.keys,[51]);
});
test('stale shared overlay and explicit LCD presentation never authorize visible mobile HD',()=>{
    const f=fixture();f.miniState.open=true;f.miniState.complete=true;assert.equal(f.controller.refresh().active,false);
    f.publish();f.miniState.showLcd=true;assert.equal(f.controller.refresh().active,false);noSearch(f);
});
const miniRawFields=['ProtocolVersion','Active','Complete','Custom','DefaultDraw','Seq','Generation','InputSeq','ResourceId',
    'ImageIndex','Width','Height','Mask','CursorX','CursorY','ViewX','ViewY','ViewWidth','ViewHeight','City1'];
for(const field of miniRawFields)test('native overview refuses mismatched raw publication '+field,()=>{
    const f=fixture();f.publish();f.data['g_hdMiniMap'+field]++;assert.equal(f.controller.readNative(),null);noSearch(f);
});
test('complete raw/getter agreement still rejects unsupported native image, empty viewport and nonfinite values',()=>{
    const invalid=[['ProtocolVersion','protocolVersion',2],['Complete','complete',0],['Custom','custom',1],
        ['DefaultDraw','defaultDraw',0],['ResourceId','resourceId',76],['ImageIndex','imageIndex',1],['Width','width',85],
        ['Height','height',65],['Mask','mask',1],['ViewWidth','viewWidth',0],['ViewHeight','viewHeight',0],
        ['Seq','seq',0],['CursorX','cursorX',NaN],['City1','city1',39]];
    for(const [raw,pub,value] of invalid){const f=fixture();f.publish();f.data['g_hdMiniMap'+raw]=f.native[pub]=value;
        assert.equal(f.controller.readNative(),null,raw);noSearch(f);}
});
test('native receipt binds current cursor, city, detail generation and map input sequence',()=>{
    for(const change of ['cursor','city','generation','seq','spe']){
        const f=fixture();f.publish();if(change==='cursor')f.data.g_CityPos.setx++;
        if(change==='city')f.data.g_hdMapCity++;if(change==='generation')f.native.detailGeneration++;
        if(change==='seq')f.data.g_hdMapInputSeq++;if(change==='spe')f.data.g_hdSpeGeneration=0;
        assert.equal(f.controller.readNative(),null,change);noSearch(f);
    }
});
test('native double sampling rejects mutation during getter, data rebind and identity change',()=>{
    for(const change of ['raw','getter','data','identity']){
        const f=fixture();f.publish();let calls=0;
        f.getter(()=>{if(++calls!==1)return;if(change==='raw')f.data.g_hdMiniMapSeq++;
            if(change==='getter')f.native.seq++;if(change==='data')f.environment.baye.data={...f.data};
            if(change==='identity')f.identity({generation:4});});
        assert.equal(f.controller.readNative(),null,change);noSearch(f);
    }
});
test('missing raw fields or throwing public getter fail closed without sending keys',()=>{
    const f=fixture();f.publish();delete f.data.g_hdMiniMapViewX;assert.equal(f.controller.readNative(),null);
    const g=fixture();g.publish();g.getter(()=>{throw Error('unavailable');});assert.equal(g.controller.readNative(),null);
    noSearch(f);noSearch(g);
});
test('pending never retries on blocked owner; actual new MAP ticket permits a fresh user gesture',()=>{
    const f=fixture();f.controller.init();f.tap();f.data.g_hdReportActive=1;f.controller.refresh();f.tap();
    assert.deepEqual(f.counts.keys,[51]);f.data.g_hdReportActive=0;f.data.g_hdMapInputSeq++;f.controller.refresh();
    assert.equal(f.controller.snapshot().openEnabled,true);f.tap();assert.deepEqual(f.counts.keys,[51,51]);
});
test('bare click, synthetic input, nonprimary or right-button gestures cannot open SEARCH',()=>{
    for(const change of ['click','synthetic-down','synthetic-up','nonprimary-down','nonprimary-up','right']){
        const f=fixture();f.controller.init();if(change==='click')f.button.fire('click');
        else f.tap(change==='synthetic-down'?{isTrusted:false}:change==='nonprimary-down'?{isPrimary:false}:change==='right'?{button:2}:{},
            change==='synthetic-up'?{isTrusted:false}:change==='nonprimary-up'?{isPrimary:false}:{});noSearch(f);
    }
});
test('pointer gesture needs same pointer, current hit target and final movement within 8px',()=>{
    for(const change of ['id','hit','move','final-distance']){
        const f=fixture();f.controller.init();f.button.fire('pointerdown');
        if(change==='hit')f.top(f.outside);if(change==='move')f.button.fire('pointermove',{clientX:39});
        f.button.fire('pointerup',change==='id'?{pointerId:2}:change==='final-distance'?{clientX:39}:{});noSearch(f);
    }
    const f=fixture();f.controller.init();f.tap({}, {clientX:38});assert.deepEqual(f.counts.keys,[51]);
});
test('a second pointer outside the button retires an armed SEARCH gesture',()=>{
    const f=fixture();f.controller.init();f.button.fire('pointerdown');f.outsideDown();f.button.fire('pointerup');noSearch(f);
});
test('multiple pointers block rearming until all pointers lift; a new gesture then works',()=>{
    const f=fixture();f.controller.init();f.button.fire('pointerdown');f.outsideDown();f.button.fire('pointerup');
    f.tap();noSearch(f);f.outsideUp();f.tap();assert.deepEqual(f.counts.keys,[51]);
});
test('scroll, changed DOWN geometry, detached node and replacement node retire a gesture',()=>{
    for(const change of ['scroll','geometry','detached','replaced']){
        const f=fixture();f.controller.init();f.button.fire('pointerdown');
        if(change==='scroll')f.scroll();if(change==='geometry')f.button.rect.left++;
        if(change==='detached')f.button.isConnected=false;if(change==='replaced')f.replaceButton();
        f.button.fire('pointerup');noSearch(f);
    }
});
test('pointer cancel, lost capture and owner change retire a pressed button',()=>{
    for(const change of ['pointercancel','lostpointercapture','map-seq','data','library']){
        const f=fixture();f.controller.init();f.button.fire('pointerdown');
        if(change==='map-seq')f.data.g_hdMapInputSeq++;else if(change==='data')f.environment.baye.data={...f.data};
        else if(change==='library')f.identity({generation:4});else f.button.fire(change);
        f.button.fire('pointerup');noSearch(f);
    }
});
for(const boundary of ['resize','orientationchange','blur','pagehide','viewport','hidden','identity'])test('lifecycle '+boundary+' retires pointer and keyboard grants',()=>{
    for(const keyboard of [false,true]){
        const f=fixture();f.controller.init();f.button.fire(keyboard?'keydown':'pointerdown',keyboard?{key:'Enter'}:{});
        if(boundary==='viewport')f.viewportResize();else if(boundary==='hidden')f.hidden(true);
        else if(boundary==='identity')f.identityEvent();else f.boundary(boundary);
        f.button.fire(keyboard?'keyup':'pointerup',keyboard?{key:'Enter'}:{});noSearch(f);
    }
});
test('keyboard needs trusted nonrepeat DOWN/UP, matching key and retained button focus',()=>{
    for(const change of ['synthetic-down','synthetic-up','repeat','key','focus-down','focus-up','blur']){
        const f=fixture();f.controller.init();if(change==='focus-down')f.document.activeElement=f.outside;
        f.button.fire('keydown',{key:'Enter',isTrusted:change!=='synthetic-down',repeat:change==='repeat'});
        if(change==='focus-up')f.document.activeElement=f.outside;if(change==='blur')f.button.fire('blur');
        f.button.fire('keyup',{key:change==='key'?' ':'Enter',isTrusted:change!=='synthetic-up'});noSearch(f);
    }
    for(const key of ['Enter',' ']){const f=fixture();f.controller.init();f.key(key);assert.deepEqual(f.counts.keys,[51]);}
});
