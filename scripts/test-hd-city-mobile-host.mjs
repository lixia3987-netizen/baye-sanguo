import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Controlled public bridge fixtures. No native C, browser, or OS execution.
const source = fs.readFileSync(new URL('../js/hd-city-menu.js', import.meta.url), 'utf8');
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const originalLib = fs.readFileSync(new URL('../libs/dat-mod.lib', import.meta.url));
const fields = ['g_hdEngineReady','g_hdMapPick','g_hdMapCity','g_hdMapInputSeq','g_hdBattlePick',
    'g_hdMenuActive','g_hdMenuContext','g_hdMenuKind','g_hdMenuSeq','g_hdMenuCount','g_hdMenuIndex',
    'g_hdDetailGeneration','g_hdQtyActive','g_hdQtySession','g_hdQtyInputSeq','g_hdQtyLastKey',
    'g_hdQtyCursor','g_hdQtyStep','g_hdQtyReady','g_hdQtyMin','g_hdQtyMax','g_hdQtyValue',
    'g_hdMarchPhase','g_hdMarchSession','g_hdMarchInputSeq','g_hdMarchOrigin','g_hdMarchSelected','g_hdMarchSeq',
    'g_hdMarchOk','g_hdMarchCity','g_hdMarchObj','g_hdReportActive','g_hdReportSeq',
    'g_hdReportInputSeq','g_hdReportKind','g_hdReportPerson','g_hdHelpActive','g_hdHelpInputSeq','g_hdFightActive','g_hdRecordActive',
    'g_hdMovieActive','g_hdSpeActive','g_hdSkillActive','g_hdAttackActive','g_hdSkillResultActive',
    'g_hdMakerActive','g_hdViewActive','g_hdMiniMapActive','g_hdGoodsActive','g_hdPersonPropertiesActive',
    'g_hdResultOwnerKind','g_hdResultOwnerValid'];
function fixture({storageThrows = false, marchState = false} = {}) {
    const raw = Object.fromEntries(fields.map(key => [key, 0]));
    Object.assign(raw, {g_hdEngineReady:1,g_hdMapCity:1,g_hdMapInputSeq:4,g_hdMenuActive:1,
        g_hdMenuContext:1,g_hdMenuKind:1,g_hdMenuSeq:3,g_hdMenuCount:4,g_hdDetailGeneration:2});
    raw.g_Cities = [{Persons:0,PersonQueue:0,Belong:1,State:0}];
    const events = {}, docEvents = {}, keys = [], writes = [], timers = [], storageWrites = [];
    const stored = new Map([['baye/cityMenuMode','classic'],['baye/overworldMode','classic']]);
    let identity = {status:'ready',generation:1,sha256:SHA,byteLength:207195}, available = true, menuHook = null,
        marchHook = null, reportHook = null, linksHook = null, afterKey = null, clock = 0, timerId = 0;
    const scheduled = new Map();
    const names = ['内政','外交','军备','状况'];
    const node = {setAttribute(){},classList:{toggle(){}}};
    const document = {hidden:false,documentElement:node,body:node,getElementById(){return null;},
        querySelector(){return null;},querySelectorAll(){return [];},addEventListener(type, fn){(docEvents[type] ||= []).push(fn);}};
    const env = {document,innerWidth:844,innerHeight:390,dynLib:originalLib.toString('hex'),console:{log(){},warn(){}},
        Date:marchState?class extends Date {static now(){return clock;}}:Date,JSON,Object,Array,
        setInterval(fn){timers.push(fn);return timers.length;},clearInterval(){},
        setTimeout(fn,delay=0){const id=++timerId;if(marchState)scheduled.set(id,{fn,at:clock+delay});return id;},
        clearTimeout(id){scheduled.delete(id);},
        addEventListener(type, fn){(events[type] ||= []).push(fn);},sendKey(key){keys.push(key);if(afterKey)afterKey(key);},
        localStorage:{getItem(key){if(storageThrows)throw Error('denied');return stored.get(key) ?? null;},
            setItem(key,value){if(storageThrows)throw Error('denied');stored.set(key,value);storageWrites.push([key,value]);}},
        BayeHdLibIdentity:{read(){return identity;},isCurrent(value){return value === identity;},subscribe(fn){env.identityChanged=fn;return ()=>{};}},
        BayeHdOverworld:{getMode(){return 'hd-map';}},
        baye:{data:null,ensureData(){return env.baye.data;},getCityName(index){return '城' + index;},
            hd:{ready(){return true;},menuItems(){
                const value={active:raw.g_hdMenuActive,context:raw.g_hdMenuContext,kind:raw.g_hdMenuKind,
                    seq:raw.g_hdMenuSeq,count:raw.g_hdMenuCount,index:raw.g_hdMenuIndex,
                    detailGeneration:raw.g_hdDetailGeneration,generation:raw.g_hdDetailGeneration,
                    names:names.slice(),ids:raw.g_hdMenuKind>=3?names.map((_,i)=>i):[],idsValid:true};
                if(menuHook)menuHook(value);return value;
            },march(){const value={pick:raw.g_hdMapPick,battlePick:raw.g_hdBattlePick,mapCity:raw.g_hdMapCity,
                mapInputSeq:raw.g_hdMapInputSeq,phase:raw.g_hdMarchPhase,session:raw.g_hdMarchSession,
                inputSeq:raw.g_hdMarchInputSeq,origin:raw.g_hdMarchOrigin,selected:raw.g_hdMarchSelected,seq:raw.g_hdMarchSeq,
                ok:raw.g_hdMarchOk,city:raw.g_hdMarchCity,obj:raw.g_hdMarchObj};if(marchHook)marchHook(value);return value;},
            qty(){return {protocol:true,active:raw.g_hdQtyActive,session:raw.g_hdQtySession,
                inputSeq:raw.g_hdQtyInputSeq,lastKey:raw.g_hdQtyLastKey,cursor:raw.g_hdQtyCursor,
                step:raw.g_hdQtyStep,ready:raw.g_hdQtyReady,min:raw.g_hdQtyMin,max:raw.g_hdQtyMax,value:raw.g_hdQtyValue};},
            fight(){return {active:raw.g_hdFightActive};},help(){return {active:raw.g_hdHelpActive};},
            report(){const value={active:raw.g_hdReportActive,seq:raw.g_hdReportSeq,inputSeq:raw.g_hdReportInputSeq,
                kind:raw.g_hdReportKind,person:raw.g_hdReportPerson,text:'当前原生出征报告'};
                if(reportHook)reportHook(value);return value;},
            cityLinks(origin){const address=originalLib.readUInt32LE(58*4),mask=Array.from(originalLib.subarray(address+14+origin*16,address+22+origin*16));
                const actual=mask.map(id=>id===255||id>38?0:id);if(marchState)raw.g_hdCityLinks=actual;
                const value=actual.filter(Boolean).map(id=>({id,index:id-1,name:'城'+(id-1)}));
                if(linksHook)linksHook(value);return value;}}}};
    env.baye.data = new Proxy(raw,{set(target,key,value){writes.push(key);throw Error('native write ' + key);}});
    env.window = env;
    const code=marchState?source.replace(/\}\)\(window\);\s*$/,`
        global.__marchTest={state:state,sync:syncMarchPhase,send:engineSendKey,cancelQty:cancelQty,
            cancelPersons:cancelUnselectedMarch,fill:fillDeepList,render:render,other:otherCities,
            select:selectLiveMenu,preview:typeof previewDeep==='function'?previewDeep:null,
            previewContext:typeof mobilePreviewContext==='function'?mobilePreviewContext:null,bind:bindUi,
             back:back,backOwner:cityBackPressOwner,
             chooseSub:chooseSub,equipmentFlow(){return typeof mobileEquipmentFlow==='undefined'?null:mobileEquipmentFlow;},
             personKind:typeof personDeepKind==='function'?personDeepKind:null,usesGoods:usesGoodsMenu,
             pageTool:pageTool,setToolContext(value){liveToolContext=function(){return value;};renderToolDetails=function(){};},
            resetDetailScroll:typeof resetMobileDetailScroll==='function'?resetMobileDetailScroll:null,
            isolatePreview(){renderPersonDetails=function(){};renderToolDetails=function(){};}};
        render=function(){};applyDocAttr=function(){};scheduleMarchWatch=function(){};
    })(window);`):source;
    vm.runInNewContext(code, env, {filename:'js/hd-city-menu.js'});
    const api = env.BayeHdCityMenu;
    function configure(){api.configureMobileHost({isAvailable:()=>available});}
    return {env,api,raw,names,keys,writes,timers,stored,storageWrites,configure,
        setAvailable(value){available=value;},setIdentity(value){identity=value;},identity(){return identity;},
        internals:env.__marchTest,setAfterKey(value){afterKey=value;},setMarchHook(value){marchHook=value;},
        setReportHook(value){reportHook=value;},setLinksHook(value){linksHook=value;},
        tick(ms=10000){const end=clock+ms;let steps=0;while(scheduled.size){const [id,t]=[...scheduled].sort((a,b)=>a[1].at-b[1].at)[0];
            if(t.at>end)break;assert.ok(++steps<2000,'bounded native acknowledgement wait');scheduled.delete(id);clock=t.at;t.fn();}clock=end;},
        setMenuHook(value){menuHook=value;},emit(type){for(const fn of (events[type]||[]))fn({type});},
        emitDocument(type){for(const fn of (docEvents[type]||[]))fn({type});}};
}

test('mobile CITY ticket binds full native publication, data reference and identity',()=>{
    const f=fixture();f.configure();const ticket=f.api.getInputTicket();
    assert.equal(ticket.ownerType,'city');assert.equal(ticket.cityIndex,0);
    assert.equal(ticket.data,f.env.baye.data);assert.ok(Object.isFrozen(ticket));
    assert.equal(Object.keys(ticket).includes('data'),false);
    assert.ok(ticket.key.includes('内政'));assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
});
test('PC mode is unchanged until explicit mobile configuration',()=>{
    const f=fixture();assert.equal(f.api.getMode(),'classic');assert.equal(f.api.shouldShowHd(),false);
    assert.equal(f.api.getInputTicket(),null);f.configure();assert.equal(f.api.getMode(),'auto');
    f.api.setMode('hd');assert.equal(f.stored.get('baye/mobileCityMenuMode'),'hd');
    assert.equal(f.stored.get('baye/cityMenuMode'),'classic');assert.equal(f.stored.get('baye/overworldMode'),'classic');
});
test('blocked storage retains independent mobile mode in memory',()=>{
    const f=fixture({storageThrows:true});f.configure();f.api.setMode('classic');assert.equal(f.api.getMode(),'classic');
    f.api.setMode('hd');assert.equal(f.api.getMode(),'hd');assert.equal(f.keys.length,0);
});
test('start is idempotent',()=>{
    const f=fixture();f.configure();f.api.start();f.api.start();assert.equal(f.timers.length,1);
});
for(const kind of ['hidden','portrait','host-unavailable','wrong-library','pending-library','stale-identity','not-ready','missing-protocol']){
    test('mobile base rejects ' + kind,()=>{
        const f=fixture();f.configure();
        if(kind==='hidden')f.env.document.hidden=true;
        if(kind==='portrait')f.env.innerWidth=390;
        if(kind==='host-unavailable')f.setAvailable(false);
        if(kind==='wrong-library')f.setIdentity({...f.identity(),sha256:'0'.repeat(64)});
        if(kind==='pending-library')f.setIdentity({...f.identity(),status:'pending'});
        if(kind==='stale-identity')f.env.BayeHdLibIdentity.isCurrent=()=>false;
        if(kind==='not-ready')f.env.baye.hd.ready=()=>false;
        if(kind==='missing-protocol')delete f.raw.g_hdQtySession;
        assert.equal(f.api.shouldShowHd(),false);assert.equal(f.api.getInputTicket(),null);
        f.api.close();assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    });
}
for(const field of ['g_hdReportActive','g_hdHelpActive','g_hdFightActive','g_hdMovieActive','g_hdSpeActive',
    'g_hdRecordActive','g_hdSkillActive','g_hdAttackActive','g_hdSkillResultActive','g_hdResultOwnerKind']){
    test('CITY ticket rejects competing owner ' + field,()=>{
        const f=fixture();f.configure();f.raw[field]=1;
        assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.open({cityIndex:0}),false);
        assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    });
}
test('person and tool detail publication may coexist with complete actual picker',()=>{
    for(const kind of [3,4]){const f=fixture();f.configure();f.raw.g_hdMenuKind=kind;
        f.raw.g_hdPersonPropertiesActive=kind===3?1:0;f.raw.g_hdGoodsActive=kind===4?1:0;
        assert.equal(f.api.getInputTicket().menuKind,kind);assert.equal(f.keys.length,0);}
});
test('picker requires complete actual IDs, names and count',()=>{
    const f=fixture();f.configure();f.raw.g_hdMenuKind=3;
    f.setMenuHook(value=>{value.idsValid=false;});assert.equal(f.api.getInputTicket(),null);
    f.setMenuHook(value=>{value.names.pop();});assert.equal(f.api.getInputTicket(),null);
    f.setMenuHook(value=>{value.ids.pop();});assert.equal(f.api.getInputTicket(),null);
});
test('ticket changes for selected index or complete ID/name membership',()=>{
    const f=fixture();f.configure();const before=f.api.getInputTicket().key;
    f.raw.g_hdMenuIndex=1;assert.notEqual(f.api.getInputTicket().key,before);
    f.raw.g_hdMenuKind=3;const person=f.api.getInputTicket().key;
    f.setMenuHook(value=>{value.ids[0]=45;});assert.notEqual(f.api.getInputTicket().key,person);
});
test('torn menu getter and data-object rebind reject ticket',()=>{
    const f=fixture();f.configure();f.setMenuHook(()=>{f.raw.g_hdMenuSeq+=1;});
    assert.equal(f.api.getInputTicket(),null);
    f.setMenuHook(()=>{f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});});
    assert.equal(f.api.getInputTicket(),null);
});
test('quantity ticket requires actual protocol, ready, bounds and no competing menu',()=>{
    const f=fixture();f.configure();Object.assign(f.raw,{g_hdMenuActive:0,g_hdQtyActive:1,g_hdQtySession:7,
        g_hdQtyReady:1,g_hdQtyMax:640,g_hdQtyValue:0});
    assert.equal(f.api.getInputTicket().ownerType,'qty');
    f.raw.g_hdQtyValue=641;assert.equal(f.api.getInputTicket(),null);
    f.raw.g_hdQtyValue=0;f.raw.g_hdQtyReady=0;assert.equal(f.api.getInputTicket(),null);
});
test('retirement and lifecycle boundaries emit zero keys and no native writes',()=>{
    const f=fixture();f.configure();f.api.retireInteraction('pointercancel');
    for(const type of ['resize','orientationchange','blur','pagehide'])f.emit(type);
    f.env.document.hidden=true;f.emitDocument('visibilitychange');
    assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    f.env.document.hidden=false;assert.ok(f.api.getInputTicket());
});
test('mobile legacy compatibility helpers cannot write map fields',()=>{
    const f=fixture();f.configure();f.raw.g_hdMapPick=1;
    for(const name of ['forceClearMapPick','clearStaleMapPick','clearBattleMakeLeftoverPick','bindOpenedMapCity']){
        assert.equal(f.api[name](0,'test'),false);
    }
    assert.equal(f.api.landOwnedCity('test'),false);assert.equal(f.writes.length,0);assert.equal(f.keys.length,0);
});
test('classic preference leaves native LCD in control without closing through a key',()=>{
    const f=fixture();f.configure();f.api.setMode('classic');
    assert.equal(f.api.shouldShowHd(),false);assert.equal(f.api.getLcdPresentation(),'passthrough');
    assert.equal(f.api.isActive(),false);assert.equal(f.keys.length,0);
});

// Exercise the actual attr-only poll publication path, without constructing a
// fake person list or assuming render() is called again after publication.
test('mobile attr refresh restores the root after native picker publication becomes complete',()=>{
    const begin=source.indexOf('    function applyDocAttr() {');
    const end=source.indexOf('    function occupyDrainPending()',begin);
    assert.ok(begin>=0 && end>begin);
    const classes=new Set(), attrs={};let complete=false;
    const root={setAttribute(key,value){attrs[key]=value;},classList:{toggle(key,on){if(on)classes.add(key);else classes.delete(key);}}};
    const docNode={setAttribute(){},classList:{toggle(){}}};
    const context={mobileHost:{},state:{open:true,layer:'deep',deepKind:'person',deepStep:0,
        deepItems:[{name:'实际武将'}],marchReady:false,handoff:false},
        document:{documentElement:docNode,body:docNode,querySelector(){return null;}},
        el(id){return id==='hd-city-menu'?root:null;},shouldShowHd(){return true;},
        mobileShellReady(){return complete;},cityLcdPresentation(){return complete?'off':'passthrough';},
        getMenuMode(){return 'hd';},usesMapCursor(){return false;},holdExit(){return false;},
        freshMarchOk(){return false;},displayWizardStep(){return 'none';},showingQty(){return false;},mapPickActive(){return false;}};
    vm.runInNewContext(source.slice(begin,end),context);
    context.applyDocAttr();assert.equal(classes.has('is-open'),false);assert.equal(attrs['aria-hidden'],'true');
    complete=true;context.applyDocAttr();
    assert.equal(classes.has('is-open'),true);assert.equal(classes.has('is-sub'),true);assert.equal(attrs['aria-hidden'],'false');
    complete=false;context.applyDocAttr();
    assert.equal(classes.has('is-open'),false);assert.equal(classes.has('is-sub'),false);assert.equal(attrs['aria-hidden'],'true');
});

test('mobile poll restores the complete deep layer after delayed picker publication',()=>{
    const renderBegin=source.indexOf('    function render() {');
    const renderEnd=source.indexOf('    function bindOpenedCity(',renderBegin);
    const pollPrefix='        startTimer = setInterval(';
    const pollBegin=source.indexOf(pollPrefix,source.indexOf('    function start() {'));
    const pollEnd=source.indexOf('        }, 280);',pollBegin);
    assert.ok(renderBegin>=0 && renderEnd>renderBegin && pollBegin>=0 && pollEnd>pollBegin);
    const nodes={};
    for(const id of ['hd-city-menu','hd-city-menu-title','hd-city-menu-sub','hd-city-menu-root',
        'hd-city-menu-sublist','hd-city-menu-status','hd-city-menu-deep','hd-city-menu-probe']){
        const classes=new Set();nodes[id]={hidden:true,classes,textContent:'',attrs:{},
            setAttribute(key,value){this.attrs[key]=value;},classList:{toggle(key,on){if(on)classes.add(key);else classes.delete(key);}}};
    }
    let complete=true, deepRefreshes=0;
    const state={open:true,layer:'sub',subKind:'junbei',cityIndex:0,cityName:'真实城',
        deepKind:'person-qty',deepLabel:'征兵',deepStep:0,deepItems:[],wizardStep:'none',
        marchReady:false,showLcd:false,idleIndex:0,idleKeys:[],probedCityKeys:[],lastHook:'onMenuIdle',
        qtyCommitQueued:false,activeQueueReason:'',queue:[]};
    const noOp=()=>{};
    const context={state,mobileHost:{},mobileLibraryGeneration:1,ROOTS:[{id:'junbei',name:'军备'}],SUBS:{junbei:['侦察','征兵','分配','掠夺']},
        el(id){return nodes[id]||null;},setText(node,text){if(node)node.textContent=text;},
        shouldShowHd(){return true;},mobileShellReady(){return complete;},
        mobileBase(){return {identity:{generation:1}};},renderStickyBannerSlot:noOp,
        applyDocAttr:noOp,retirePersonDetails:noOp,retireToolDetails:noOp,
        cityName(){return '真实城';},showingQty(){return false;},freshMarchOk(){return false;},
        usesMapCursor(){return false;},usesGoodsMenu(){return false;},
        fillDeepList(){deepRefreshes+=1;},preferEngineNames(items){return items;},
        fillSubList:noOp,applyHighlight:noOp,syncToolbar:noOp,syncMode:noOp,
        fightIsActive(){return false;},leftoverMarchAfterFight(){return false;},sweepStickyMarch:noOp,
        hdReady(){return false;},sendKey(){throw Error('unexpected input');}};
    context.global=context;
    vm.runInNewContext(source.slice(renderBegin,renderEnd),context);
    const pollExpression=source.slice(pollBegin+pollPrefix.length,pollEnd)+'}';
    vm.runInNewContext('poll = '+pollExpression,context);
    context.render();assert.equal(nodes['hd-city-menu-sublist'].hidden,false);assert.equal(nodes['hd-city-menu-deep'].hidden,true);
    state.layer='deep';complete=false;context.poll();
    assert.equal(nodes['hd-city-menu'].classes.has('is-open'),false);assert.equal(deepRefreshes,0);
    complete=true;context.poll();
    assert.equal(nodes['hd-city-menu'].classes.has('is-open'),true);
    assert.equal(nodes['hd-city-menu-sublist'].hidden,true);assert.equal(nodes['hd-city-menu-root'].hidden,true);
    assert.equal(nodes['hd-city-menu-status'].hidden,true);assert.equal(nodes['hd-city-menu-deep'].hidden,false);
    assert.equal(deepRefreshes,1);
});

function classicPersonFixture() {
    const f=fixture();f.configure();
    f.raw.g_hdMenuKind=3;f.raw.g_hdMenuSeq=13;f.raw.g_hdMenuIndex=2;
    f.names.splice(0,f.names.length,'曹操','曹昂','曹仁','夏侯惇');
    f.api.setMode('classic');
    // The mobile host retires every old gesture/queue before a mode action.
    f.api.retireInteraction('mobile-mode-action');
    return f;
}
test('mobile classic to HD rebuilds the current complete native person picker without a retained pane',()=>{
    const f=classicPersonFixture(), before=JSON.stringify(f.raw);
    assert.equal(f.api.debugSnapshot().open,false);
    assert.equal(f.api.getInputTicket(),null);
    f.api.setMode('hd');
    const snapshot=f.api.debugSnapshot(), ticket=f.api.getInputTicket();
    assert.equal(snapshot.open,true);assert.equal(snapshot.layer,'deep');assert.equal(snapshot.deepKind,'person');
    assert.equal(snapshot.deepLabel,'人物');assert.equal(snapshot.subKind,'');assert.equal(snapshot.idleIndex,2);
    assert.equal(snapshot.deepMenuOwner.seq,13);assert.equal(snapshot.deepMenuOwner.kind,3);
    assert.deepEqual(Array.from(snapshot.deepItems,item=>[item.i,item.name,item.pind]),
        [[0,'曹操',0],[1,'曹昂',1],[2,'曹仁',2],[3,'夏侯惇',3]]);
    assert.equal(ticket.data,f.env.baye.data);assert.equal(ticket.menuSeq,13);
    assert.equal(JSON.stringify(f.raw),before);assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
});
test('mobile resume uses the current city, index and full IDs rather than pre-classic state',()=>{
    const f=classicPersonFixture();
    f.raw.g_hdMapCity=2;f.raw.g_Cities.push({Persons:0,PersonQueue:0,Belong:1,State:0});
    f.raw.g_hdMenuIndex=1;f.raw.g_hdMenuSeq=14;
    f.names.splice(0,f.names.length,'张辽','李典','乐进','荀彧');
    f.setMenuHook(value=>{value.ids=[19,20,21,22];});
    f.api.setMode('hd');
    const snapshot=f.api.debugSnapshot();assert.equal(snapshot.open,true);assert.equal(snapshot.cityIndex,1);
    assert.equal(snapshot.idleIndex,1);assert.equal(snapshot.deepItems[1].pind,20);
    assert.equal(snapshot.deepItems[1].name,'李典');assert.equal(f.api.getInputTicket().menuSeq,14);
    assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
});
test('mobile classic to auto resumes only through the current HD map preference',()=>{
    const f=classicPersonFixture();f.api.setMode('auto');assert.equal(f.api.debugSnapshot().open,true);
    const g=classicPersonFixture();g.env.BayeHdOverworld.getMode=()=> 'classic';g.api.setMode('auto');
    assert.equal(g.api.debugSnapshot().open,false);assert.equal(g.api.getInputTicket(),null);
    assert.equal(f.keys.length+g.keys.length,0);
});
for(const invalid of ['ids','names','count','index','generation','seq','context','tool','report','march','map-input']){
    test('mobile mode rebuild rejects incomplete or foreign publication: '+invalid,()=>{
        const f=classicPersonFixture();
        if(invalid==='ids')f.setMenuHook(value=>{value.idsValid=false;});
        if(invalid==='names')f.setMenuHook(value=>{value.names[1]='';});
        if(invalid==='count')f.raw.g_hdMenuCount=5;
        if(invalid==='index')f.raw.g_hdMenuIndex=4;
        if(invalid==='generation')f.setMenuHook(value=>{value.generation=value.detailGeneration+1;});
        if(invalid==='seq')f.raw.g_hdMenuSeq=0;
        if(invalid==='context')f.raw.g_hdMenuContext=5;
        if(invalid==='tool')f.raw.g_hdMenuKind=4;
        if(invalid==='report')f.raw.g_hdReportActive=1;
        if(invalid==='march')f.raw.g_hdMarchPhase=1;
        if(invalid==='map-input')f.raw.g_hdMapInputSeq=0;
        f.api.setMode('hd');assert.equal(f.api.debugSnapshot().open,false);
        assert.equal(f.api.getLcdPresentation(),'passthrough');assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    });
}
test('mobile mode rebuild rejects torn native publication and data rebinding',()=>{
    for(const rebind of [false,true]){
        const f=classicPersonFixture();
        f.setMenuHook(()=>{
            if(rebind)f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
            else f.raw.g_hdMenuSeq+=1;
        });
        f.api.setMode('hd');assert.equal(f.api.debugSnapshot().open,false);
        assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    }
});
for(const mutation of ['seq','name','id','index']){
    test('mobile mode rebuild fences changed '+mutation+' after constructing the local pane',()=>{
        const f=classicPersonFixture();let reading=false, changed=false;
        f.setMenuHook(value=>{
            if(changed && mutation==='id')value.ids[2]=42;
            if(reading || changed)return;
            reading=true;const open=f.api.debugSnapshot().open;reading=false;
            if(open){
                changed=true;
                if(mutation==='seq')f.raw.g_hdMenuSeq+=1;
                if(mutation==='name')f.names[2]='当前新武将';
                if(mutation==='id')value.ids[2]=42;
                if(mutation==='index')f.raw.g_hdMenuIndex=1;
            }
        });
        f.api.setMode('hd');
        assert.equal(changed,true);assert.equal(f.api.debugSnapshot().open,false);
        assert.equal(f.api.getLcdPresentation(),'passthrough');assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    });
}
test('mobile mode rebuild remains unavailable while hidden or portrait',()=>{
    for(const hidden of [false,true]){
        const f=classicPersonFixture();
        if(hidden)f.env.document.hidden=true;else f.env.innerWidth=390;
        f.api.setMode('hd');assert.equal(f.api.debugSnapshot().open,false);assert.equal(f.api.getInputTicket(),null);
        assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    }
});
test('PC mode switch does not reconstruct an unretained native person picker',()=>{
    const f=fixture();f.raw.g_hdMenuKind=3;f.api.setMode('hd');
    assert.equal(f.api.debugSnapshot().mobileHost,false);assert.equal(f.api.debugSnapshot().open,false);
    assert.equal(f.api.getInputTicket(),null);assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
});

test('owner-preserving retirement recomputes the person owner for the new queue epoch',()=>{
    const f=classicPersonFixture();f.api.setMode('hd');
    const before=f.api.debugSnapshot(), ticket=f.api.getInputTicket();
    const native=JSON.stringify(f.raw), preferences=Array.from(f.stored);
    assert.equal(f.api.retireInputPreservingOwner('portrait-missing'),true);
    const after=f.api.debugSnapshot(), fresh=f.api.getInputTicket();
    assert.notEqual(after.deepMenuOwner.key,before.deepMenuOwner.key);
    assert.equal(after.deepMenuOwner.seq,before.deepMenuOwner.seq);
    for(const key of ['open','layer','cityIndex','subKind','deepKind','deepStep','deepLabel']){
        assert.equal(after[key],before[key],key);
    }
    assert.equal(fresh.key,ticket.key);assert.equal(fresh.data,ticket.data);
    assert.equal(JSON.stringify(f.raw),native);assert.deepEqual(Array.from(f.stored),preferences);
    assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
});
for(const mutation of ['sequence','data']){
    test('owner-preserving retirement rejects changed '+mutation+' after retirement',()=>{
        const f=classicPersonFixture();f.api.setMode('hd');let reading=false,changed=false;
        f.setMenuHook(()=>{
            if(reading||changed)return;
            reading=true;const pane=f.api.debugSnapshot();reading=false;
            if(pane.open&&!pane.deepMenuOwner){
                changed=true;
                if(mutation==='sequence')f.raw.g_hdMenuSeq+=1;
                else f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
            }
        });
        assert.equal(f.api.retireInputPreservingOwner('portrait-missing'),false);
        const after=f.api.debugSnapshot();assert.equal(changed,true);
        assert.equal(after.open,true);assert.equal(after.layer,'deep');assert.equal(after.deepMenuOwner,null);
        assert.ok(['on','passthrough'].includes(f.api.getLcdPresentation()));
        assert.equal(f.keys.length,0);assert.equal(f.writes.length,0);
    });
}
test('owner-preserving retirement does not authorize a foreign march or PC pane',()=>{
    const f=classicPersonFixture();f.api.setMode('hd');f.raw.g_hdMarchPhase=1;
    assert.equal(f.api.retireInputPreservingOwner('boundary'),false);
    assert.equal(f.api.debugSnapshot().deepMenuOwner,null);assert.equal(f.api.debugSnapshot().open,true);
    const pc=fixture();assert.equal(pc.api.retireInputPreservingOwner('boundary'),false);
    assert.equal(f.keys.length+pc.keys.length,0);assert.equal(f.writes.length+pc.writes.length,0);
});
for(const pending of ['queue','sending','nativeMenuRequest','deepSelectionPending','closingSub']){
    test('owner preservation cannot reauthorize in-flight '+pending,()=>{
        const begin=source.indexOf('    function retireInputPreservingOwner(reason) {');
        const end=source.indexOf('\n    function ',begin+20);
        assert.ok(begin>=0&&end>begin);
        let retired=0,reads=0;
        const state={open:true,layer:'deep',cityIndex:0,subKind:'junbei',deepKind:'person',
            deepStep:0,deepLabel:'当前命令',queue:[],sending:false,nativeMenuRequest:null,
            deepSelectionPending:null,closingSub:false,deepMenuOwner:{key:'old'}};
        state[pending]=pending==='queue'?[39]:true;
        const context={state,mobileHost:{},JSON,usesGoodsMenu(){return false;},
            mobilePersonModeReading(){reads+=1;throw Error('in-flight owner must not be read for recovery');},
            retireInteraction(){retired+=1;state.queue=[];state.sending=false;state.deepMenuOwner=null;}};
        const personKind=source.match(/function personDeepKind\(kind\) \{[^\n]+\}/);
        if(personKind)vm.runInNewContext(personKind[0],context);
        vm.runInNewContext(source.slice(begin,end),context);
        assert.equal(context.retireInputPreservingOwner('boundary'),false);
        assert.equal(retired,1);assert.equal(reads,0);assert.equal(state.deepMenuOwner,null);
        assert.equal(state.open,true);assert.equal(state.deepLabel,'当前命令');
    });
}


function departedCurrentCityFixture(kind=1) {
    const f=fixture();
    Object.assign(f.raw,{g_hdMapCity:2,g_hdMenuKind:kind,g_hdMarchPhase:7,g_hdMarchSession:1,g_hdMarchInputSeq:16});
    f.raw.g_Cities.push({Persons:0,PersonQueue:0,Belong:1,State:0}); f.configure(); return f;
}
test('retained DEPARTED CITY uses current mapCity, never the old march origin',()=>{
    for(const kind of [1,2,3,4]){
        const f=departedCurrentCityFixture(kind), before=JSON.stringify(f.raw), ticket=f.api.getInputTicket();
        assert.equal(ticket.ownerType,'city');assert.equal(ticket.cityIndex,1);assert.equal(ticket.menuKind,kind);
        assert.equal(ticket.session,1);assert.equal(ticket.inputSeq,16);assert.equal(ticket.data,f.env.baye.data);
        assert.equal(JSON.stringify(f.raw),before);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('retained DEPARTED permits only a current bounded ready quantity owner',()=>{
    const f=departedCurrentCityFixture();
    Object.assign(f.raw,{g_hdMenuActive:0,g_hdQtyActive:1,g_hdQtySession:7,g_hdQtyInputSeq:2,
        g_hdQtyReady:1,g_hdQtyMax:640,g_hdQtyValue:0});
    const before=JSON.stringify(f.raw), ticket=f.api.getInputTicket();
    assert.equal(ticket.ownerType,'qty');assert.equal(ticket.cityIndex,1);assert.equal(ticket.session,7);
    assert.equal(ticket.inputSeq,2);assert.equal(JSON.stringify(f.raw),before);assert.deepEqual(f.keys,[]);
    for(const [key,value] of [['g_hdMapPick',1],['g_hdBattlePick',1],['g_hdMenuActive',1],
        ['g_hdQtyReady',0],['g_hdQtyValue',641],['g_hdQtySession',0]]){
        const old=f.raw[key];f.raw[key]=value;assert.equal(f.api.getInputTicket(),null,key);f.raw[key]=old;
    }
});
test('DEPARTED alone never authorizes a CITY, strategy menu, foreign owner or missing current city',()=>{
    for(const change of [{g_hdMapPick:1},{g_hdMenuActive:0},{g_hdMenuContext:2},{g_hdMenuContext:3},
        {g_hdMapCity:0},{g_hdReportActive:1},{g_hdHelpActive:1},{g_hdFightActive:1},
        {g_hdSpeActive:1},{g_hdAttackActive:1},{g_hdSkillResultActive:1},{g_hdResultOwnerValid:1}]){
        const f=departedCurrentCityFixture();Object.assign(f.raw,change);
        assert.equal(f.api.getInputTicket(),null);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
    for(const phase of [8,255,7.5,'7',undefined,NaN]){
        const f=departedCurrentCityFixture();f.raw.g_hdMarchPhase=phase;assert.equal(f.api.getInputTicket(),null);
    }
});
test('terminal CITY double reads reject phase, session, input sequence and current-city changes',()=>{
    for(const field of ['g_hdMarchPhase','g_hdMarchSession','g_hdMarchInputSeq','g_hdMapCity']){
        const f=departedCurrentCityFixture();f.setMenuHook(()=>{f.raw[field]=field==='g_hdMarchPhase'?0:f.raw[field]+1;});
        assert.equal(f.api.getInputTicket(),null);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('DEPARTED person mode resumes the full current picker at another city with zero keys',()=>{
    const f=classicPersonFixture();
    Object.assign(f.raw,{g_hdMapCity:2,g_hdMarchPhase:7,g_hdMarchSession:1,g_hdMarchInputSeq:16});
    f.raw.g_Cities.push({Persons:0,PersonQueue:0,Belong:1,State:0});const before=JSON.stringify(f.raw);
    f.api.setMode('hd');const snapshot=f.api.debugSnapshot(), ticket=f.api.getInputTicket();
    assert.equal(snapshot.open,true);assert.equal(snapshot.cityIndex,1);assert.equal(snapshot.deepMenuOwner.seq,13);
    assert.equal(snapshot.deepItems.length,4);assert.equal(ticket.cityIndex,1);assert.equal(ticket.menuKind,3);
    assert.equal(f.api.retireInputPreservingOwner('portrait-fallback'),true);
    assert.equal(JSON.stringify(f.raw),before);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('terminal person restoration rejects a phase or session handoff during publication',()=>{
    for(const field of ['g_hdMarchPhase','g_hdMarchSession','g_hdMarchInputSeq']){
        const f=classicPersonFixture();Object.assign(f.raw,{g_hdMarchPhase:7,g_hdMarchSession:1,g_hdMarchInputSeq:16});
        f.setMenuHook(()=>{f.raw[field]=field==='g_hdMarchPhase'?(f.raw[field]===7?0:7):f.raw[field]+1;});
        f.api.setMode('hd');assert.equal(f.api.debugSnapshot().open,false);assert.equal(f.api.getInputTicket(),null);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
function isolatedCityFunction(name,context) {
    const begin=source.indexOf('    function '+name+'('),end=source.indexOf('\n    function ',begin+20);
    assert.ok(begin>=0&&end>begin);vm.runInNewContext(source.slice(begin,end),context);return context[name];
}
test('terminal strategy handoff keeps its real origin while ordinary CITY uses current map city',()=>{
    const raw={g_hdHelpActive:0,g_hdReportActive:0},menu={active:0,context:0,kind:0,seq:9,detailGeneration:2};
    const march={phase:7,session:1,origin:0,mapCity:2,pick:1,battlePick:0,mapInputSeq:4,inputSeq:16};
    const context={MARCH:{IDLE:0,PERSONS:1,FOOD:2,TARGET_TIP:3,TARGET_PICK:4,REJECT:5,ARMOUT:6,DEPARTED:7},
        state:{cityIndex:0},mobileMenuComplete(){return true;},freshMarchOk(){return true;},mobileBoundMarch(){return true;}};
    const read=isolatedCityFunction('mobileTicketFrom',context), value={raw,menu,march,qty:{active:0},data:{},libraryGeneration:1};
    const handoff=read(value,'strategy-end');assert.equal(handoff.ownerType,'strategy');assert.equal(handoff.cityIndex,0);
    assert.equal(read(value),null);march.phase=8;assert.equal(read(value,'strategy-end'),null);
});
test('original active PERSONS and FOOD still bind their real march origin',()=>{
    const f=fixture();f.configure();
    Object.assign(f.raw,{g_hdMapCity:2,g_hdMarchSession:1,g_hdMarchInputSeq:8,g_hdMarchPhase:1,g_hdMenuKind:3});
    assert.equal(f.api.getInputTicket().cityIndex,0);assert.equal(f.api.getInputTicket().ownerType,'city');
    Object.assign(f.raw,{g_hdMarchPhase:2,g_hdMenuActive:0,g_hdQtyActive:1,g_hdQtySession:7,
        g_hdQtyReady:1,g_hdQtyMin:1,g_hdQtyMax:640,g_hdQtyValue:50});
    assert.equal(f.api.getInputTicket().cityIndex,0);assert.equal(f.api.getInputTicket().ownerType,'qty');
    for(const phase of [3,4,5,6]){f.raw.g_hdMarchPhase=phase;assert.equal(f.api.getInputTicket(),null);}
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('retired MAP owner accepts terminal phase only without owners and fences phase/session across callbacks',()=>{
    const data={g_hdDetailGeneration:2,g_hdMapInputSeq:4,g_hdMenuSeq:12,g_hdMapCity:0,g_hdMapPick:1,
        g_hdBattlePick:0,g_hdMarchPhase:7,g_hdMarchSession:1,g_hdMarchInputSeq:16,g_hdMenuActive:0,
        g_hdQtyActive:0,g_hdReportActive:0,g_hdHelpActive:0,g_hdFightActive:0,g_asyncActionID:0};
    const native={data};
    const context={window:{baye:native},baye:native,global:{},state:{queue:[],sending:false,handoff:false,confirmingTarget:false,nativeMenuRequest:null},
        MARCH:{IDLE:0,DEPARTED:7},detailNumber(n,max){return typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=max?n:null;}};
    const read=isolatedCityFunction('retiredCityMapOwner',context);assert.equal(read(),true);
    for(const phase of [1,2,3,4,5,6,8,undefined]){data.g_hdMarchPhase=phase;assert.equal(read(),false);}data.g_hdMarchPhase=7;
    for(const field of ['g_hdBattlePick','g_hdMenuActive','g_hdQtyActive','g_hdReportActive','g_hdHelpActive','g_hdFightActive','g_asyncActionID']){
        data[field]=1;assert.equal(read(),false,field);data[field]=0;
    }
    for(const field of ['g_hdMarchPhase','g_hdMarchSession','g_hdMarchInputSeq']){
        const old=data[field];context.global.BayeHdDialog={isOpen(){data[field]=field==='g_hdMarchPhase'?0:old+1;return false;}};
        assert.equal(read(),false,field);data[field]=old;
    }
});


test('classic to HD or auto restores the actual terminal CITY root at the current map city with zero input',()=>{
    for(const phase of [0,7])for(const mode of ['hd','auto']){
        const f=fixture();f.configure();f.api.setMode('classic');
        Object.assign(f.raw,{g_hdMarchPhase:phase,g_hdMarchSession:1,g_hdMarchInputSeq:16,g_hdMapCity:2});
        const before=JSON.stringify(f.raw);assert.equal(f.api.debugSnapshot().open,false);
        f.api.setMode(mode);const s=f.api.debugSnapshot();
        assert.equal(s.open,true);assert.equal(s.layer,'root');assert.equal(s.cityIndex,1);assert.equal(s.cityName,'城1');
        assert.equal(s.deepKind,'');assert.equal(f.api.getInputTicket().cityIndex,1);
        assert.equal(f.stored.get('baye/cityMenuMode'),'classic');assert.equal(f.stored.get('baye/overworldMode'),'classic');
        assert.equal(JSON.stringify(f.raw),before);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('classic mode recovery never opens a terminal CITY from missing, foreign or active owner evidence',()=>{
    for(const problem of ['menu-inactive','foreign-context','submenu','report','help','qty','map','battle','unknown-phase','missing-map-city']){
        const f=fixture();f.configure();f.api.setMode('classic');
        Object.assign(f.raw,{g_hdMarchPhase:7,g_hdMarchSession:1,g_hdMarchInputSeq:16,g_hdMapCity:2});
        if(problem==='menu-inactive')f.raw.g_hdMenuActive=0;
        if(problem==='foreign-context')f.raw.g_hdMenuContext=2;
        if(problem==='submenu')f.raw.g_hdMenuKind=2;
        if(problem==='report')f.raw.g_hdReportActive=1;
        if(problem==='help')f.raw.g_hdHelpActive=1;
        if(problem==='qty'){f.raw.g_hdQtyActive=1;f.env.bayeQtyNativeClosed=()=>false;}
        if(problem==='map')f.raw.g_hdMapPick=1;
        if(problem==='battle')f.raw.g_hdBattlePick=1;
        if(problem==='unknown-phase')f.raw.g_hdMarchPhase=8;
        if(problem==='missing-map-city')f.raw.g_hdMapCity=0;
        f.api.setMode('hd');assert.equal(f.api.debugSnapshot().open,false,problem);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('mode recovery fences current native CITY phase, session, sequence and data identity across reads',()=>{
    for(const field of ['g_hdMarchPhase','g_hdMarchSession','g_hdMarchInputSeq','g_hdMenuSeq','g_hdMapCity','data']){
        const f=fixture();f.configure();f.api.setMode('classic');
        Object.assign(f.raw,{g_hdMarchPhase:7,g_hdMarchSession:1,g_hdMarchInputSeq:16,g_hdMapCity:2});
        f.setMenuHook(()=>{
            if(field==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
            else if(field==='g_hdMarchPhase')f.raw[field]=f.raw[field]===7?0:7;
            else f.raw[field]+=1;
        });
        f.api.setMode('hd');assert.equal(f.api.debugSnapshot().open,false,field);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('bound terminal march does not resurrect an old wizard but active and genuine submitted handoffs remain',()=>{
    for(const phase of [0,1,2,3,4,5,6,7,8])for(const submitted of [false,true]){
        const state={modeSignature:'classic:hd',open:false,cityIndex:-1,personModeResume:null};
        const noop=()=>{},context={state,mobileHost:null,MARCH:{IDLE:0,PERSONS:1,FOOD:2,TARGET_TIP:3,TARGET_PICK:4,REJECT:5,ARMOUT:6,DEPARTED:7},
            getMenuMode(){return 'hd';},overworldIsHd(){return true;},shouldShowHd(){return true;},
            invalidateMarchWork:noop,invalidateQtyWork:noop,applyDocAttr:noop,render:noop,
            mobileCityRootModeReading(){return null;},currentMarch(){return {phase,origin:0,selected:8};},
            freshMarchOk(){return submitted;}};
        isolatedCityFunction('syncMode',context)();
        const shouldResume=phase>=1&&phase<=6||phase===7&&submitted;
        assert.equal(state.open,shouldResume,'phase '+phase+' submitted '+submitted);
        if(shouldResume){assert.equal(state.deepKind,'person-city');assert.equal(state.cityIndex,0);}
    }
});
test('current terminal CITY recovery takes precedence over a bound old march origin',()=>{
    const owner={cityIndex:1},state={modeSignature:'classic:hd',open:false,cityIndex:-1,personModeResume:null},noop=()=>{};
    let oldMarchReads=0;
    const context={state,MARCH:{IDLE:0,PERSONS:1,FOOD:2,ARMOUT:6,DEPARTED:7},
        getMenuMode(){return 'hd';},overworldIsHd(){return true;},shouldShowHd(){return true;},
        invalidateMarchWork:noop,invalidateQtyWork:noop,applyDocAttr:noop,render:noop,
        mobileCityRootModeReading(){return owner;},openMenu(meta){assert.equal(meta.cityIndex,1);state.open=true;state.layer='root';state.cityIndex=1;return true;},
        mobileCityRootModeMatches(value){return value===owner;},retireMobileCityRootMode(){throw Error('unexpected retirement');},
        currentMarch(){oldMarchReads++;return {phase:7,origin:0,selected:8};},freshMarchOk(){return true;}};
    assert.equal(isolatedCityFunction('syncMode',context)(),owner);assert.equal(oldMarchReads,0);
    assert.equal(state.open,true);assert.equal(state.layer,'root');assert.equal(state.cityIndex,1);
});

test('late city-name callbacks cannot leave a mode-restored root bound to an obsolete owner',()=>{
    for(const field of ['g_hdMenuSeq','g_hdMarchInputSeq','data']){
        const f=fixture();f.configure();f.api.setMode('classic');
        Object.assign(f.raw,{g_hdMarchPhase:7,g_hdMarchSession:1,g_hdMarchInputSeq:16,g_hdMapCity:2});
        let changed=false;
        f.env.baye.getCityName=index=>{
            if(!changed){changed=true;if(field==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});else f.raw[field]++;}
            return '城'+index;
        };
        f.api.setMode('hd');assert.equal(changed,true);assert.equal(f.api.debugSnapshot().open,false,field);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('terminal submitted mobile handoff requires the same actual strategy owner, never a torn CITY or competitor',()=>{
    for(const problem of ['valid','not-fresh','CITY','qty','missing','wrong-session','wrong-origin']){
        const state={modeSignature:'classic:hd',open:false,cityIndex:-1,personModeResume:null},noop=()=>{};
        const strategy={ownerType:'strategy',session:1,cityIndex:0};
        const context={state,mobileHost:{},MARCH:{IDLE:0,PERSONS:1,FOOD:2,ARMOUT:6,DEPARTED:7},
            getMenuMode(){return 'hd';},overworldIsHd(){return true;},shouldShowHd(){return true;},
            invalidateMarchWork:noop,invalidateQtyWork:noop,applyDocAttr:noop,render:noop,
            mobileCityRootModeReading(){return null;},currentMarch(){return {phase:7,origin:0,session:1,selected:8};},
            freshMarchOk(){return problem!=='not-fresh';},mobileInputTicket(reason){
                assert.equal(reason,'strategy-end');
                if(problem==='missing')return null;
                return {...strategy,ownerType:problem==='CITY'?'city':problem==='qty'?'qty':'strategy',
                    session:problem==='wrong-session'?2:1,cityIndex:problem==='wrong-origin'?1:0};
            }};
        isolatedCityFunction('syncMode',context)();assert.equal(state.open,problem==='valid',problem);
    }
});

function mobileMarchFixture(phase=4,{mobile=true}={}) {
    const f=fixture({marchState:true});if(mobile)f.configure();
    f.env.bayeQtyNativeClosed=()=>false;
    Object.assign(f.raw,{g_PlayerKing:5,g_hdMapCity:9,g_hdMarchPhase:phase,g_hdMarchSession:12,g_hdMarchInputSeq:80,
        g_hdMarchOrigin:8,g_hdMarchSelected:2,g_hdMarchSeq:10,g_hdMarchCity:8,g_hdMarchObj:9,
        g_hdMenuKind:3,g_hdMenuActive:phase===1?1:0,g_hdMapPick:phase===4||phase===7?1:0,
        g_hdBattlePick:phase===4||phase===5||phase===6?1:0,g_hdMarchOk:phase===7?1:0,
        g_hdReportActive:[3,5,6].includes(phase)?1:0,g_hdReportSeq:20,g_hdReportInputSeq:33,
        g_hdReportKind:phase===5||phase===6?1:2,g_hdReportPerson:phase===5||phase===6?65535:5,
        g_hdQtyActive:phase===2?1:0,g_hdQtySession:7,g_hdQtyInputSeq:2,
        g_hdQtyReady:1,g_hdQtyMin:1,g_hdQtyMax:640,g_hdQtyValue:50});
    f.raw.g_Cities=Array.from({length:38},()=>({Belong:2,Persons:0,PersonQueue:0,State:0}));
    f.raw.g_Cities[8].Belong=6;f.raw.g_hdCityLinks=Array(8).fill(0);
    f.raw.g_CityPos={setx:2,sety:2};
    f.env.BayeHdOverworld.getCities=()=>[{index:8,engX:2,engY:2},{index:9,engX:4,engY:3}];
    f.env.baye.hdCityLimit=()=>38;
    f.state=f.internals.state;
    Object.assign(f.state,{open:true,layer:'deep',subKind:'junbei',cityIndex:8,deepKind:'person-city',deepLabel:'出征',
        battleMake:phase!==7,marchOriginIndex:8,marchSession:12,marchBaselineSeq:9,acceptMarchOk:phase===7,
        marchSubmittedTarget:phase===7?9:null,marchReady:phase===7,wizardStep:'map-pick',pickedPersons:2,
        personExitSent:phase!==1,foodConfirmedThisMarch:phase>=3});
    return f;
}

// Controlled DOM nodes exercise the actual fillDeepList/syncMarchPhase bodies.
// Replacing innerHTML disconnects old buttons just as it does in a browser.
function marchDom(f, {rooted=false}={}) {
    function node(tagName) {
        const attrs={}, listeners={}, value={tagName:tagName.toUpperCase(),children:[],parentElement:null,parentNode:null,
            isConnected:false,hidden:false,textContent:'',className:'',scrollTop:0,
            setAttribute(name,item){attrs[name]=String(item);},getAttribute(name){return name in attrs?attrs[name]:null;},
            addEventListener(type,fn){(listeners[type]||=[]).push(fn);},
            emit(type,event){for(const fn of listeners[type]||[])fn(event);},
            contains(child){while(child){if(child===this)return true;child=child.parentNode;}return false;},
            appendChild(child){child.parentElement=child.parentNode=this;this.children.push(child);connect(child,this.isConnected);return child;}};
        value.classList={contains(name){return value.className.split(/\s+/).includes(name);},
            toggle(name,on){const names=new Set(value.className.split(/\s+/).filter(Boolean));
                if(on)names.add(name);else names.delete(name);value.className=[...names].join(' ');}};
        Object.defineProperty(value,'innerHTML',{set(html){
            for(const child of this.children)connect(child,false);
            this.children=[];this.textContent='';const stack=[this];
            for(const token of String(html).match(/<[^>]+>|[^<]+/g)||[]){
                if(/^<\//.test(token)){if(stack.length>1)stack.pop();continue;}
                const tag=/^<([\w-]+)\b([^>]*)>/.exec(token);
                if(!tag){stack.at(-1).textContent+=token;continue;}
                const child=node(tag[1]);
                for(const attr of tag[2].matchAll(/(data-hd-[\w-]+|class|id)(?:="([^"]*)")?/g)){
                    child.setAttribute(attr[1],attr[2]||'');if(attr[1]==='class')child.className=attr[2]||'';
                }
                child.disabled=/\bdisabled\b/.test(tag[2]);stack.at(-1).appendChild(child);
                if(!['br','img','input'].includes(tag[1]))stack.push(child);
            }
        }});
        return value;
    }
    function connect(value,on){value.isConnected=on;for(const child of value.children)connect(child,on);}
    const root=node('section'),list=node('div');if(rooted)root.appendChild(list);connect(rooted?root:list,true);
    function byId(id,value=list){
        if(value.getAttribute('id')===id)return value;
        for(const child of value.children){const found=byId(id,child);if(found)return found;}
        return null;
    }
    f.env.document.getElementById=id=>id==='hd-city-menu'&&rooted?root:id==='hd-city-menu-deep'?list:byId(id);
    f.env.document.createElement=node;
    function find(attribute,value=list){
        if(value.getAttribute(attribute)!==null)return value;
        for(const child of value.children){const found=find(attribute,child);if(found)return found;}
        return null;
    }
    function poll(){f.internals.sync();f.internals.fill();}
    return {root,list,find,poll,byId};
}
function advanceToTarget(f) {
    Object.assign(f.raw,{g_hdMarchPhase:4,g_hdReportActive:0,g_hdMapPick:1,g_hdBattlePick:1});
    f.raw.g_hdMarchInputSeq++;
}
test('the current mobile target owner retires only its previous target-tip card without input',()=>{
    const f=mobileMarchFixture(3),dom=marchDom(f);dom.poll();
    const oldHint=dom.find('data-hd-march-hint'),oldDismiss=dom.find('data-hd-dismiss-march');
    const oldTicket=f.api.getInputTicket();assert.ok(oldHint&&oldDismiss);
    advanceToTarget(f);assert.ok(f.api.getMarchTargetTicket());
    const before=JSON.stringify(f.raw);dom.poll();
    assert.equal(f.state.marchHint,'');assert.equal(dom.find('data-hd-march-hint'),null);
    assert.equal(oldHint.isConnected,false);assert.equal(oldDismiss.isConnected,false);
    const cancel=dom.find('data-hd-march-cancel'),confirm=dom.find('data-hd-confirm-march');
    assert.ok(cancel&&confirm);assert.equal(confirm.disabled,true);
    for(let i=0;i<5;i++){dom.poll();assert.equal(dom.find('data-hd-march-cancel'),cancel);assert.equal(dom.find('data-hd-confirm-march'),confirm);}
    assert.equal(f.api.cancelMarch(oldTicket),false);assert.equal(JSON.stringify(f.raw),before);
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
for(const change of ['selection','invalid-target','rejected-target']){
    test('target-tip retirement preserves the current '+change+' message',()=>{
        const f=mobileMarchFixture(3),dom=marchDom(f);dom.poll();advanceToTarget(f);
        if(change==='selection')assert.equal(f.api.selectMarchTarget(9).selected,9);
        if(change==='invalid-target')assert.equal(f.api.selectMarchTarget(8).skipped,'invalid-target');
        if(change==='rejected-target'){
            Object.assign(f.raw,{g_hdMarchPhase:5,g_hdReportActive:1,g_hdReportKind:1,g_hdReportPerson:65535});
            f.setReportHook(r=>{r.text='当前目标不可到达';});f.env.baye.hd.reportText=()=> '当前目标不可到达';
            dom.poll();advanceToTarget(f);
        }
        const hint=f.state.marchHint,pending=f.state.pendingTarget;assert.ok(hint);
        dom.poll();const card=dom.find('data-hd-march-hint');assert.ok(card);
        for(let i=0;i<5;i++){dom.poll();assert.equal(f.state.marchHint,hint);assert.equal(f.state.pendingTarget,pending);assert.equal(dom.find('data-hd-march-hint'),card);}
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
}
for(const change of ['data','library','session','unverified-target']){
    test('target-tip cleanup rejects a different or unverified '+change+' owner',()=>{
        const f=mobileMarchFixture(3),dom=marchDom(f);dom.poll();const hint=f.state.marchHint;
        advanceToTarget(f);
        if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
        if(change==='library')f.setIdentity({...f.identity(),generation:2});
        if(change==='session'){f.raw.g_hdMarchSession++;f.state.marchSession++;}
        if(change==='unverified-target')f.setLinksHook(v=>{v.length=0;f.raw.g_hdCityLinks.fill(0);});
        dom.poll();assert.equal(f.state.marchHint,hint);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
}
test('PC target-tip behavior remains unchanged after its native phase4 transition',()=>{
    const f=mobileMarchFixture(3,{mobile:false});f.internals.sync();const hint=f.state.marchHint;
    assert.ok(hint);advanceToTarget(f);f.internals.sync();assert.equal(f.state.marchHint,hint);
    assert.equal(f.state.mobileTargetTipHint,null);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('same native phase4 polls preserve the actual cancel and confirm DOM button identities',()=>{
    const f=mobileMarchFixture();f.api.selectMarchTarget(9,f.api.getMarchTargetTicket());
    const dom=marchDom(f);dom.poll();
    const cancel=dom.find('data-hd-march-cancel'),confirm=dom.find('data-hd-confirm-march');
    const ticket=f.api.getMarchTargetTicket();
    assert.ok(cancel&&confirm);assert.equal(confirm.disabled,false);
    for(let i=0;i<5;i++){
        dom.poll();assert.equal(dom.find('data-hd-march-cancel'),cancel);
        assert.equal(dom.find('data-hd-confirm-march'),confirm);
        assert.equal(cancel.isConnected,true);assert.equal(confirm.isConnected,true);
        assert.equal(f.api.getMarchTargetTicket().key,ticket.key);
    }
    assert.equal(f.state.pendingTarget,9);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    assert.equal(f.api.cancelMarch(ticket),true);assert.deepEqual(f.keys,[40]);
});
test('a real target selection or native phase/input handoff replaces old march controls',()=>{
    for(const change of ['target','input','phase']){
        const f=mobileMarchFixture(),dom=marchDom(f);dom.poll();
        const cancel=dom.find('data-hd-march-cancel'),confirm=dom.find('data-hd-confirm-march');
        const ticket=f.api.getMarchTargetTicket();assert.ok(cancel&&confirm);
        if(change==='target')f.api.selectMarchTarget(9,ticket);
        if(change==='input')f.raw.g_hdMarchInputSeq++;
        if(change==='phase')Object.assign(f.raw,{g_hdMarchPhase:6,g_hdMapPick:0,g_hdReportActive:1,
            g_hdReportKind:1,g_hdReportPerson:65535});
        dom.poll();assert.equal(cancel.isConnected,false,change);assert.equal(confirm.isConnected,false,change);
        if(change==='target')assert.equal(dom.find('data-hd-confirm-march').disabled,false);
        else assert.equal(f.api.cancelMarch(ticket),false,change);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('mobile full march publishes only its current per-phase native owner without keys',()=>{
    const expected={1:'city',2:'qty',3:'march-report',4:'march-target',5:'march-report',6:'march-report',7:'strategy'};
    for(const phase of [1,2,3,4,5,6,7]){
        const f=mobileMarchFixture(phase), ticket=f.api.getInputTicket();
        assert.ok(ticket,'phase '+phase);assert.equal(ticket.ownerType,expected[phase]);
        assert.equal(ticket.cityIndex,8);assert.equal(ticket.phase,phase);
        assert.equal(f.api.getMarchPresentation().phase,phase);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('only a fully bound FOOD2 or march-report owner may displace the generic mobile dialog',()=>{
    for(const phase of [1,2,3,4,5,6,7]){
        const f=mobileMarchFixture(phase), ticket=f.api.getMarchDialogTicket();
        assert.equal(!!ticket,[2,3,5,6].includes(phase),'phase '+phase);
        if(ticket){assert.equal(ticket.key,f.api.getInputTicket().key);assert.equal(ticket.data,f.env.baye.data);}
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
    for(const problem of ['unbound','hidden','classic','library','qty-ready','report-kind']){
        const f=mobileMarchFixture(problem==='report-kind'?6:2);
        if(problem==='unbound')f.state.marchSession++;
        if(problem==='hidden')f.env.document.hidden=true;
        if(problem==='classic')f.api.setMode('classic');
        if(problem==='library')f.setIdentity({...f.identity(),sha256:'0'.repeat(64)});
        if(problem==='qty-ready')f.raw.g_hdQtyReady=0;
        if(problem==='report-kind')f.raw.g_hdReportKind=2;
        assert.equal(f.api.getMarchDialogTicket(),null,problem);assert.deepEqual(f.keys,[]);
    }
});
for(const phase of [2,3,5,6]){
    test('real CITY and dialog modules give bound native phase'+phase+' exactly one HD shell',()=>{
        const f=mobileMarchFixture(phase);
        f.env.bayeQtyNativeClosed=()=>false;
        f.env.baye.hd.reportText=()=>f.env.baye.hd.report().text;
        vm.runInNewContext(fs.readFileSync(new URL('../js/hd-dialog.js',import.meta.url),'utf8'),f.env,{filename:'js/hd-dialog.js'});
        const dialog=f.env.BayeHdDialog;
        dialog.configureMobileHost({isAvailable:()=>true});
        if(phase===2)assert.equal(dialog.openQty({min:1,max:640,init:50}),false);
        else dialog.onEngineReport();
        dialog.poll();
        assert.equal(dialog.openHelp(),false);assert.equal(dialog.openSearch(),false);
        assert.ok(f.api.getMarchDialogTicket());assert.equal(dialog.isOpen(),false);
        assert.equal(dialog.getInputTicket(),null);assert.equal(dialog.isActive(),false);
        assert.equal(dialog.getLcdPresentation(),'passthrough');assert.equal(f.api.getLcdPresentation(),'off');
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
}
test('mobile target ticket authenticates real original CITY_LINKR row, current ownership and full data owner',()=>{
    const f=mobileMarchFixture(), ticket=f.api.getMarchTargetTicket();
    const address=originalLib.readUInt32LE(58*4), row=Array.from(originalLib.subarray(address+14+8*16,address+22+8*16));
    assert.ok(row.includes(10),'actual 天水 CITY_LINKR contains 河内 token10');
    assert.equal(ticket.data,f.env.baye.data);assert.equal(Object.keys(ticket).includes('data'),false);
    assert.equal(ticket.origin,8);assert.equal(ticket.selected,2);assert.ok(ticket.targets.includes(9));
    assert.ok(Object.isFrozen(ticket));assert.ok(Object.isFrozen(ticket.targets));
    assert.deepEqual(JSON.parse(JSON.stringify(f.internals.other(8))).map(c=>c.cityIndex),Array.from(ticket.targets));
    assert.equal(f.api.selectMarchTarget(9,ticket).selected,9);assert.deepEqual(f.keys,[]);
});
for(const problem of ['empty','wrong-origin','missing-raw','public-mismatch','raw-mismatch','same-owned','wrong-source',
    'missing-lib','foreign-lib-header','torn-route','torn-owner','data-rebind','zero-session','unbound-session','unknown-phase']){
    test('march targets never use an empty, stale or unverified route fallback: '+problem,()=>{
        const f=mobileMarchFixture();
        if(problem==='empty')f.setLinksHook(v=>{v.length=0;f.raw.g_hdCityLinks.fill(0);});
        if(problem==='wrong-origin')f.setLinksHook(v=>{const a=originalLib.readUInt32LE(58*4);f.raw.g_hdCityLinks=Array.from(originalLib.subarray(a+14,a+22));});
        if(problem==='missing-raw')f.setLinksHook(()=>{delete f.raw.g_hdCityLinks;});
        if(problem==='public-mismatch')f.setLinksHook(v=>{v[0].index=37;});
        if(problem==='raw-mismatch')f.setLinksHook(()=>{f.raw.g_hdCityLinks[0]^=1;});
        if(problem==='same-owned')f.raw.g_Cities[9].Belong=6;
        if(problem==='wrong-source')f.raw.g_Cities[8].Belong=2;
        if(problem==='missing-lib')delete f.env.dynLib;
        if(problem==='foreign-lib-header'){const bytes=Buffer.from(originalLib);bytes[bytes.readUInt32LE(58*4)+4]=58;f.env.dynLib=bytes.toString('hex');}
        if(problem==='torn-route')f.setLinksHook(()=>{f.raw.g_hdMarchInputSeq++;});
        if(problem==='torn-owner')f.setLinksHook(()=>{f.raw.g_Cities[9].Belong=f.raw.g_Cities[9].Belong===6?2:6;});
        if(problem==='data-rebind')f.setLinksHook(()=>{f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});});
        if(problem==='zero-session')f.raw.g_hdMarchSession=0;
        if(problem==='unbound-session')f.raw.g_hdMarchSession=13;
        if(problem==='unknown-phase')f.raw.g_hdMarchPhase=8;
        const ticket=f.api.getMarchTargetTicket();
        if(problem==='same-owned'){assert.ok(ticket);assert.equal(ticket.targets.includes(9),false);}
        else assert.equal(ticket,null);
        assert.ok(f.api.selectMarchTarget(9).skipped);assert.ok(f.api.confirmMarchTarget(9).skipped);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
}
test('target selection fences name-getter reentry and stale DOWN ticket before retaining a choice',()=>{
    for(const problem of ['name','sequence','identity']){
        const f=mobileMarchFixture(), ticket=f.api.getMarchTargetTicket();
        if(problem==='name')f.env.baye.getCityName=()=>{f.raw.g_hdMarchInputSeq++;return '河内';};
        if(problem==='sequence')f.raw.g_hdMarchInputSeq++;
        if(problem==='identity')f.setIdentity({...f.identity(),generation:2});
        assert.ok(f.api.selectMarchTarget(9,ticket).skipped);assert.equal(f.state.pendingTarget,null);assert.deepEqual(f.keys,[]);
    }
});
test('mobile target confirmation waits each real cursor ACK then emits exactly one ENTER on the exact city',()=>{
    const f=mobileMarchFixture();f.api.selectMarchTarget(9,f.api.getMarchTargetTicket());
    f.setAfterKey(key=>{const p=f.raw.g_CityPos;if(key===34)p.sety--;if(key===35)p.sety++;if(key===36)p.setx--;if(key===37)p.setx++;
        f.raw.g_hdMapCity=p.setx===4&&p.sety===3?10:0;});
    f.api.confirmMarchTarget(9,f.api.getMarchTargetTicket());f.tick();
    assert.deepEqual(f.keys,[35,37,37,39]);f.api.confirmMarchTarget(9);f.tick();
    assert.deepEqual(f.keys,[35,37,37,39]);assert.deepEqual(f.writes,[]);
});
for(const problem of ['no-ack','phase','map-sequence','session','membership','hidden','rebind']){
    test('mobile target walking never sends a confirm through lost ownership: '+problem,()=>{
        const f=mobileMarchFixture();f.api.selectMarchTarget(9);let sent=0;
        f.setAfterKey(()=>{if(++sent!==1)return;if(problem==='phase')f.raw.g_hdMarchPhase=5;
            if(problem==='map-sequence')f.raw.g_hdMapInputSeq++;
            if(problem==='session')f.raw.g_hdMarchSession++;
            if(problem==='membership')f.raw.g_Cities[9].Belong=6;
            if(problem==='hidden')f.env.document.hidden=true;
            if(problem==='rebind')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});});
        f.api.confirmMarchTarget(9);f.tick();assert.deepEqual(f.keys,[35]);assert.equal(f.keys.includes(39),false);
    });
}
test('phase4 cancellation uses one current native EXIT and never confirms a target',()=>{
    const f=mobileMarchFixture(), ticket=f.api.getMarchTargetTicket();
    assert.equal(f.api.cancelMarch(ticket),true);assert.equal(f.api.cancelMarch(ticket),false);
    f.api.retireInteraction('blur');assert.equal(f.api.cancelMarch(ticket),false);f.tick();assert.deepEqual(f.keys,[40]);
});
for(const phase of [3,5,6]){
    test('native phase'+phase+' report has one ACK per live report/march input and survives zero-key retirement',()=>{
        const f=mobileMarchFixture(phase);assert.equal(f.api.getLcdPresentation(),'off');
        assert.equal(f.api.continueMarch({session:12,inputSeq:80}),true);assert.equal(f.api.continueMarch(),false);
        f.api.retireInteraction('orientationchange');assert.equal(f.api.continueMarch(),false);
        assert.equal(f.api.getInputTicket().ownerType,'march-report');
        f.raw.g_hdMarchInputSeq++;f.raw.g_hdReportInputSeq++;assert.equal(f.api.continueMarch(),true);
        assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
    });
}
for(const invalid of ['kind','seq','text','phase','menu','qty','help','unbound','getter-race']){
    test('mobile march report refuses a foreign or partial acknowledgement: '+invalid,()=>{
        const f=mobileMarchFixture(3);
        if(invalid==='kind')f.raw.g_hdReportKind=1;
        if(invalid==='seq')f.raw.g_hdReportSeq=0;
        if(invalid==='text')f.setReportHook(r=>{r.text='';});
        if(invalid==='phase')f.raw.g_hdMarchPhase=1;
        if(invalid==='menu')f.raw.g_hdMenuActive=1;
        if(invalid==='qty')f.raw.g_hdQtyActive=1;
        if(invalid==='help')f.raw.g_hdHelpActive=1;
        if(invalid==='unbound')f.raw.g_hdMarchSession=13;
        if(invalid==='getter-race')f.setReportHook(()=>{f.raw.g_hdReportInputSeq++;});
        assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.continueMarch(),false);assert.deepEqual(f.keys,[]);
    });
}
test('march report kinds and person tokens follow the real per-phase C report owner',()=>{
    for(const phase of [3,5,6]){
        for(const invalid of ['wrong-kind','wrong-person','no-selected']){
            const f=mobileMarchFixture(phase);
            if(invalid==='wrong-kind')f.raw.g_hdReportKind=phase===3?1:2;
            if(invalid==='wrong-person')f.raw.g_hdReportPerson=phase===3?65535:5;
            if(invalid==='no-selected')f.raw.g_hdMarchSelected=0;
            const allowed=phase===5&&invalid==='no-selected';
            assert.equal(!!f.api.getInputTicket(),allowed,phase+':'+invalid);
            assert.equal(f.api.continueMarch(),allowed,phase+':'+invalid);
            assert.deepEqual(f.keys,allowed?[39]:[]);assert.deepEqual(f.writes,[]);
        }
    }
});
test('only this newly submitted matching native order exposes strategy end, including after a boundary',()=>{
    const f=mobileMarchFixture(7);assert.equal(f.api.getInputTicket().ownerType,'strategy');
    f.api.retireInteraction('blur');assert.equal(f.api.getInputTicket().ownerType,'strategy');
    for(const [field,value] of [['g_hdMarchOk',0],['g_hdMarchObj',10],['g_hdMarchCity',7],['g_hdMarchSeq',9],['g_hdMarchSession',13]]){
        const old=f.raw[field];f.raw[field]=value;assert.equal(f.api.getInputTicket(),null,field);f.raw[field]=old;
    }
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('strategy handoff consumes real CITY→MAP→function-menu publications once',()=>{
    const f=mobileMarchFixture(7);f.raw.g_hdMapPick=0;f.raw.g_hdMenuActive=1;f.raw.g_hdMenuKind=1;
    f.setAfterKey(key=>{if(key===40&&f.raw.g_hdMenuActive){f.raw.g_hdMenuActive=0;f.raw.g_hdMapPick=1;f.raw.g_hdMapInputSeq++;}
        else if(key===40){f.raw.g_hdMapPick=0;f.raw.g_hdMenuActive=1;f.raw.g_hdMenuContext=2;f.raw.g_hdMenuKind=1;
            f.names.splice(0,f.names.length,'策略结束','存储进度','结束游戏');f.raw.g_hdMenuCount=3;f.raw.g_hdMenuSeq++;}
        else if(key===39){f.raw.g_hdMarchOk=0;}});
    f.api.goStrategyEnd();f.tick();assert.deepEqual(f.keys,[40,40,39]);assert.equal(f.api.getInputTicket(),null);
});
test('mobile quantities and unselected-person cancellation are explicit native owners, never a generic EXIT',()=>{
    const f=mobileMarchFixture(1);f.state.pickedPersons=0;f.raw.g_hdMarchSelected=0;
    assert.equal(f.internals.cancelPersons(),true);assert.deepEqual(f.keys,[40]);
    const selected=mobileMarchFixture(1);assert.equal(selected.internals.cancelPersons(),false);assert.deepEqual(selected.keys,[]);
    const quantity=mobileMarchFixture(2);quantity.env.bayeQtyCloseInput=()=>{};quantity.env.bayeQtyNativeClosed=()=>false;
    quantity.internals.cancelQty();assert.deepEqual(quantity.keys,[40]);assert.deepEqual(quantity.writes,[]);
    assert.ok(source.includes('data-hd-qty-cancel'));assert.ok(source.includes('data-hd-march-person-cancel'));
});

function descendantClass(root,name){
    if(root.classList.contains(name))return root;
    for(const child of root.children){const found=descendantClass(child,name);if(found)return found;}
    return null;
}
for(const [width,height] of [[667,375],[844,390]]){
    test('mobile FOOD keeps the native quantity summary outside its button scroller at '+width,()=>{
        const f=mobileMarchFixture(2);f.env.innerWidth=width;f.env.innerHeight=height;
        const dom=marchDom(f);dom.list.scrollTop=120;const before=JSON.stringify(f.raw);dom.poll();
        const summary=descendantClass(dom.list,'hd-city-menu-qty-summary');
        const controls=descendantClass(dom.list,'hd-city-menu-qty-controls');
        assert.ok(dom.list.classList.contains('has-mobile-qty'));
        assert.ok(summary&&controls);assert.equal(summary.parentElement,controls.parentElement);
        assert.equal(summary.parentElement.children[0],summary);
        assert.equal(dom.byId('hd-city-qty-val').parentElement,summary);
        assert.equal(dom.byId('hd-city-qty-val').textContent,'50');
        assert.equal(dom.list.scrollTop,0);assert.equal(descendantClass(dom.list,'hd-city-menu-wizard'),null);
        assert.equal(controls.children.length,17);assert.ok(dom.find('data-hd-qty-ok'));assert.ok(dom.find('data-hd-qty-cancel'));
        controls.scrollTop=70;dom.poll();assert.equal(controls.scrollTop,70);
        assert.equal(JSON.stringify(f.raw),before);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
}
test('native quantity updates retain mobile button nodes and scroll without retaining an input ticket',()=>{
    const f=mobileMarchFixture(2),dom=marchDom(f);dom.poll();
    const controls=descendantClass(dom.list,'hd-city-menu-qty-controls'),cancel=dom.find('data-hd-qty-cancel');
    controls.scrollTop=73;const ticket=f.api.getInputTicket();
    for(const value of [51,60,640,1]){
        f.raw.g_hdQtyValue=value;f.raw.g_hdQtyInputSeq++;
        dom.poll();assert.equal(descendantClass(dom.list,'hd-city-menu-qty-controls'),controls);
        assert.equal(dom.find('data-hd-qty-cancel'),cancel);assert.equal(cancel.isConnected,true);
        assert.equal(controls.scrollTop,73);assert.equal(String(dom.byId('hd-city-qty-val').textContent),String(value));
        assert.notEqual(f.api.getInputTicket().key,ticket.key);
    }
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
for(const change of ['session','bounds','ack-failure']){
    test('mobile quantity rebuilds controls for a real '+change+' boundary',()=>{
        const f=mobileMarchFixture(2),dom=marchDom(f);dom.poll();
        const controls=descendantClass(dom.list,'hd-city-menu-qty-controls');controls.scrollTop=73;
        if(change==='session')f.raw.g_hdQtySession++;
        if(change==='bounds')f.raw.g_hdQtyMax=100;
        if(change==='ack-failure')f.state.qtyAckFailed=true;
        dom.poll();const fresh=descendantClass(dom.list,'hd-city-menu-qty-controls');
        assert.notEqual(fresh,controls);assert.equal(controls.isConnected,false);assert.equal(fresh.scrollTop,0);
        assert.ok(dom.byId('hd-city-qty-val'));assert.ok(dom.find('data-hd-qty-cancel'));
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
}
test('leaving FOOD removes the mobile quantity layout and disconnects its old controls',()=>{
    const f=mobileMarchFixture(2),dom=marchDom(f);dom.poll();const cancel=dom.find('data-hd-qty-cancel');
    Object.assign(f.raw,{g_hdQtyActive:0,g_hdMarchPhase:3,g_hdReportActive:1,g_hdReportKind:2,g_hdReportPerson:5});
    f.raw.g_hdMarchInputSeq++;dom.poll();
    assert.equal(dom.list.classList.contains('has-mobile-qty'),false);assert.equal(dom.byId('hd-city-qty-val'),null);
    assert.equal(cancel.isConnected,false);assert.ok(dom.find('data-hd-march-continue'));
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('mobile fixed summary preserves zero and full U16 native quantities',()=>{
    const f=mobileMarchFixture(2),dom=marchDom(f);
    f.state.battleMake=false;f.state.wizardStep='none';f.raw.g_hdQtyMin=0;f.raw.g_hdQtyMax=65535;
    for(const value of [0,65535]){f.raw.g_hdQtyValue=value;dom.poll();assert.equal(String(dom.byId('hd-city-qty-val').textContent),String(value));}
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('PC quantity rendering retains its wizard, outer scroll and value-change behavior',()=>{
    const f=mobileMarchFixture(2,{mobile:false}),dom=marchDom(f);dom.list.scrollTop=120;dom.poll();
    const controls=descendantClass(dom.list,'hd-city-menu-qty-controls');
    assert.equal(dom.list.classList.contains('has-mobile-qty'),false);assert.equal(dom.list.scrollTop,120);
    assert.ok(descendantClass(dom.list,'hd-city-menu-wizard'));assert.equal(dom.find('data-hd-qty-cancel'),null);
    f.raw.g_hdQtyValue=51;dom.poll();assert.notEqual(descendantClass(dom.list,'hd-city-menu-qty-controls'),controls);
    assert.equal(dom.byId('hd-city-qty-val').textContent,'51');assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('fixed-summary layout is mobile-scoped with a real button scroller and 44px controls',()=>{
    const css=fs.readFileSync(new URL('../css/hd-mobile.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
    const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const layout=rules.filter(([_,selectors])=>selectors.includes('has-mobile-qty'));
    assert.equal(layout.length,4);
    for(const [_,selectors] of layout)for(const selector of selectors.split(','))assert.ok(selector.trim().startsWith('.hd-mobile-page '));
    const summary=layout.find(([_,selectors])=>selectors.includes(' p'))[2];assert.match(summary,/flex:\s*0 0 auto/);
    const scroll=layout.find(([_,selectors])=>selectors.includes('.hd-city-menu-qty-controls'))[2];
    assert.match(scroll,/overflow:\s*auto/);assert.match(scroll,/min-height:\s*0/);assert.match(scroll,/minmax\(44px, auto\)/);
    const buttons=rules.find(([_,selectors])=>selectors.includes('.hd-city-menu-qty button'))[2];
    assert.match(buttons,/min-height:\s*44px/);assert.match(buttons,/min-width:\s*44px/);
});

function distributionFixture({command='分配',personId=0,capacity=2000,deferQuantity=false}={}) {
    const f=fixture({marchState:true});f.configure();f.state=f.internals.state;
    f.raw.g_PlayerKing=0;
    f.raw.g_Cities=Array.from({length:38},()=>({Belong:1,MothballArms:1958,Persons:2,PersonQueue:0}));
    f.raw.g_Persons=Array.from({length:capacity},()=>({Belong:1,Arms:100}));
    Object.assign(f.raw,{g_hdMenuKind:2,g_hdMenuSeq:11,g_hdMenuCount:5,g_hdMenuIndex:2,g_hdQtySession:20});
    f.names.splice(0,f.names.length,'侦察','征兵',command,'掠夺','出征');
    Object.assign(f.state,{open:true,layer:'deep',subKind:'junbei',cityIndex:0,deepKind:'person',deepLabel:command});
    const menuRead=f.env.baye.hd.menuItems;
    f.env.baye.hd.menuItems=()=>{const m=menuRead();if(m.kind===3)m.ids=[personId,19];return m;};
    let selectedSeq=0;
    f.publishQuantity=()=>{
        Object.assign(f.raw,{g_hdMenuActive:0,g_hdMenuKind:0,g_hdMenuContext:0,g_hdMenuSeq:selectedSeq+1,
            g_hdMenuCount:0,g_hdMenuIndex:0,g_hdQtyActive:1,g_hdQtyReady:1,g_hdQtySession:f.raw.g_hdQtySession+1,
            g_hdQtyMin:0,g_hdQtyMax:1800,g_hdQtyValue:1800,g_hdQtyInputSeq:0,g_hdQtyStep:1,g_hdQtyLastKey:65535});
        f.names.splice(0);
    };
    f.setAfterKey(key=>{
        if(key===39&&f.raw.g_hdMenuKind===2){
            Object.assign(f.raw,{g_hdMenuKind:3,g_hdMenuSeq:13,g_hdMenuCount:2,g_hdMenuIndex:0});
            f.names.splice(0,f.names.length,'董卓','李儒');
        }else if(key===39&&f.raw.g_hdMenuKind===3){
            selectedSeq=f.raw.g_hdMenuSeq;
            if(!deferQuantity)f.publishQuantity();
        }else if(key===40&&f.raw.g_hdQtyActive){
            Object.assign(f.raw,{g_hdMenuActive:1,g_hdMenuKind:3,g_hdMenuContext:1,g_hdMenuSeq:f.raw.g_hdMenuSeq+1,
                g_hdMenuCount:2,g_hdMenuIndex:0,g_hdQtyActive:0,g_hdQtyReady:0});
            f.names.splice(0,f.names.length,'董卓','李儒');
        }
    });
    f.env.bayeQtyNativeClosed=()=>false;f.env.bayeQtyCloseInput=()=>{};
    f.chooseCommand=()=>f.internals.select(2,true,'',f.env.baye.hd.menuItems());
    f.choosePerson=()=>f.internals.select(0,true,'',f.env.baye.hd.menuItems());
    f.enter=()=>{assert.equal(f.chooseCommand(),true);assert.equal(f.choosePerson(),true);};
    return f;
}

test('distribution description follows actual original command/person Enters into one new quantity session',()=>{
    const f=distributionFixture();assert.equal(f.api.getQuantityPresentation(),null);f.enter();
    const p=f.api.getQuantityPresentation();assert.ok(p);assert.ok(Object.isFrozen(p));
    assert.equal(p.kind,'distribution');assert.equal(p.personId,0);assert.equal(p.personName,'董卓');
    assert.equal(p.existingArms,100);assert.equal(p.reserveArms,1958);assert.equal(p.cityIndex,0);
    assert.equal(p.session,21);assert.equal(p.value,1800);assert.equal(p.max,1800);
    assert.equal(p.data,f.env.baye.data);assert.equal(Object.keys(p).includes('data'),false);
    assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
});
test('a retained distribution label cannot label recruitment or an unobserved person selection',()=>{
    const f=distributionFixture({command:'征兵'});f.state.deepLabel='分配';f.enter();
    assert.equal(f.api.getQuantityPresentation(),null);
    const orphan=distributionFixture();orphan.chooseCommand();orphan.raw.g_hdMenuSeq++;
    orphan.choosePerson();assert.equal(orphan.api.getQuantityPresentation(),null);
});
for(const change of ['session','menu-seq','detail-generation','city','actor-arms','reserve','belong','data','library','hidden','classic','report','ready-race']){
    test('distribution context retires on stale or incompatible source: '+change,()=>{
        const f=distributionFixture();f.enter();assert.ok(f.api.getQuantityPresentation());
        if(change==='session')f.raw.g_hdQtySession++;
        if(change==='menu-seq')f.raw.g_hdMenuSeq++;
        if(change==='detail-generation')f.raw.g_hdDetailGeneration++;
        if(change==='city')f.raw.g_hdMapCity=2;
        if(change==='actor-arms')f.raw.g_Persons[0].Arms++;
        if(change==='reserve')f.raw.g_Cities[0].MothballArms++;
        if(change==='belong')f.raw.g_Persons[0].Belong=2;
        if(change==='data')f.env.baye.data={...f.raw};
        if(change==='library')f.setIdentity({...f.identity(),generation:2});
        if(change==='hidden')f.env.document.hidden=true;
        if(change==='classic')f.api.setMode('classic');
        if(change==='report')f.raw.g_hdReportActive=1;
        if(change==='ready-race')f.setMenuHook(()=>{f.raw.g_hdQtyInputSeq++;});
        assert.equal(f.api.getQuantityPresentation(),null);assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
    });
}
test('native quantity ACK values including zero and U16 bounds retain the same selected actor',()=>{
    const f=distributionFixture();f.raw.g_Persons[0].Arms=65535;f.raw.g_Cities[0].MothballArms=0;f.enter();
    f.raw.g_hdQtyMax=65535;
    for(const value of [65535,0,100]){f.raw.g_hdQtyValue=value;f.raw.g_hdQtyInputSeq++;
        const p=f.api.getQuantityPresentation();assert.equal(p.value,value);assert.equal(p.existingArms,65535);assert.equal(p.reserveArms,0);}
    assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
});
test('a busy quantity cannot publish context but resumes only the same native session after its ACK',()=>{
    const f=distributionFixture();f.enter();f.raw.g_hdQtyReady=0;
    assert.equal(f.api.getQuantityPresentation(),null);f.raw.g_hdQtyReady=1;f.raw.g_hdQtyInputSeq++;
    assert.ok(f.api.getQuantityPresentation());assert.deepEqual(f.keys,[39,39]);
});
for(const stage of ['same-picker','menu-ended']){
    test('distribution context waits without a timer for its Enter to publish quantity: '+stage,()=>{
        const f=distributionFixture({deferQuantity:true});f.enter();
        if(stage==='menu-ended'){
            Object.assign(f.raw,{g_hdMenuActive:0,g_hdMenuKind:0,g_hdMenuContext:0,g_hdMenuSeq:14,g_hdMenuCount:0,g_hdMenuIndex:0});
            f.names.splice(0);
        }
        assert.equal(f.api.getQuantityPresentation(),null);
        f.publishQuantity();assert.equal(f.api.getQuantityPresentation().personId,0);
        assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
    });
}
test('a different publication during the pending Enter cannot regain distribution context',()=>{
    const f=distributionFixture({deferQuantity:true});f.enter();f.raw.g_hdMenuIndex=1;
    assert.equal(f.api.getQuantityPresentation(),null);f.publishQuantity();
    assert.equal(f.api.getQuantityPresentation(),null);assert.deepEqual(f.keys,[39,39]);
});
test('quantity cancellation returns to a fresh native picker; only its next selection gets new context',()=>{
    const f=distributionFixture();f.enter();f.internals.cancelQty();assert.equal(f.api.getQuantityPresentation(),null);
    assert.equal(f.choosePerson(),true);const p=f.api.getQuantityPresentation();assert.ok(p);assert.equal(p.session,22);
    assert.deepEqual(f.keys,[39,39,40,39]);assert.deepEqual(f.writes,[]);
});
test('classic and PC presentation never acquire a retained mobile distribution description',()=>{
    const f=distributionFixture();f.enter();f.api.setMode('classic');assert.equal(f.api.getQuantityPresentation(),null);
    const pc=fixture({marchState:true});Object.assign(pc.internals.state,{deepLabel:'分配',deepKind:'person',layer:'deep',open:true});
    assert.equal(pc.api.getQuantityPresentation(),null);assert.deepEqual(pc.keys,[]);
});
test('native bound button follows ACK values without replacing mobile controls or scroll',()=>{
    const f=mobileMarchFixture(2),dom=marchDom(f);dom.poll();const button=dom.find('data-hd-qty-bound');
    assert.equal(button.textContent,'最大');assert.equal(button.getAttribute('data-hd-qty-session'),'7');
    const controls=descendantClass(dom.list,'hd-city-menu-qty-controls');controls.scrollTop=73;
    f.raw.g_hdQtyValue=f.raw.g_hdQtyMax;dom.poll();assert.equal(button.textContent,'最小');assert.equal(controls.scrollTop,73);
    f.raw.g_hdQtyReady=0;dom.poll();assert.equal(button.disabled,true);
    assert.equal(dom.find('data-hd-qty-bound'),button);assert.deepEqual(f.keys,[]);
});
test('bound toggle sends the existing native HELP protocol once and waits for ACK',()=>{
    const f=distributionFixture();f.enter();
    const lcd=fs.readFileSync(new URL('../js/lcd.js',import.meta.url),'utf8');
    const begin=lcd.indexOf('function bayeQtyAckState('),end=lcd.indexOf('function bayeQtyKeyboardCode(');
    vm.runInNewContext(lcd.slice(begin,end),f.env);
    f.setAfterKey(key=>{assert.equal(key,38);f.raw.g_hdQtyValue=f.raw.g_hdQtyValue===f.raw.g_hdQtyMax?0:f.raw.g_hdQtyMax;
        f.raw.g_hdQtyInputSeq++;f.raw.g_hdQtyLastKey=key;});
    assert.equal(f.api.toggleQtyBound(21),true);assert.equal(f.raw.g_hdQtyValue,0);
    assert.equal(f.api.toggleQtyBound(21),true);assert.equal(f.raw.g_hdQtyValue,1800);
    assert.deepEqual(f.keys,[39,39,38,38]);assert.deepEqual(f.writes,[]);
});
for(const change of ['stale-session','busy','pending','closed','equal-bounds','classic','hidden','owner']){
    test('bound toggle refuses an unavailable or stale quantity without input: '+change,()=>{
        const f=distributionFixture();f.enter();
        if(change==='stale-session')f.raw.g_hdQtySession++;
        if(change==='busy')f.raw.g_hdQtyReady=0;
        if(change==='pending')f.state.queue.push({code:38,reason:'qty-key'});
        if(change==='closed')f.env.bayeQtyNativeClosed=()=>true;
        if(change==='equal-bounds')f.raw.g_hdQtyMin=f.raw.g_hdQtyMax;
        if(change==='classic')f.api.setMode('classic');
        if(change==='hidden')f.env.document.hidden=true;
        if(change==='owner')f.raw.g_hdMenuActive=1;
        assert.equal(f.api.toggleQtyBound(21),false);assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
    });
}

function distributionDialog(f) {
    const dom=marchDom(f), nodes={};
    for(const id of ['hd-dialog','hd-dialog-title','hd-dialog-body','hd-dialog-caption','hd-dialog-range',
        'hd-dialog-qty','hd-dialog-qty-digits','hd-dialog-probe','hd-dialog-bound']){
        nodes[id]=f.env.document.createElement('div');nodes[id].style={};}
    const listeners={};nodes['hd-dialog'].addEventListener=(type,fn)=>(listeners[type]||=[]).push(fn);
    nodes['hd-dialog-bound'].setAttribute('data-hd-qty-bound','');
    nodes['hd-dialog-qty'].querySelector=selector=>selector==='[data-hd-qty-bound]'?nodes['hd-dialog-bound']:null;
    nodes['hd-dialog-bound'].parentNode=nodes['hd-dialog'];
    const get=f.env.document.getElementById;
    f.env.document.getElementById=id=>nodes[id]||get(id);
    f.env.document.querySelector=selector=>selector==='[data-hd-qty-bound]'?nodes['hd-dialog-bound']:null;
    Object.assign(f.raw,{g_hdSpeGeneration:1,g_hdHelpSeq:0});
    const code=fs.readFileSync(new URL('../js/hd-dialog.js',import.meta.url),'utf8')
        .replace(/\}\)\(window\);\s*$/, 'global.__distributionDialogState=state;\n})(window);');
    vm.runInNewContext(code,f.env);
    const api=f.env.BayeHdDialog;api.configureMobileHost({isAvailable:()=>true});api.start();
    const paint=()=>api.openQty({min:f.raw.g_hdQtyMin,max:f.raw.g_hdQtyMax,init:f.raw.g_hdQtyValue,showLcd:false});
    return {api,nodes,paint,state:f.env.__distributionDialogState,
        click(target=nodes['hd-dialog-bound']){for(const fn of listeners.click||[])fn({target,preventDefault(){}});}};
}
test('real public distribution context paints the actor, reserve, final total and native bound in generic dialog',()=>{
    const f=distributionFixture();f.enter();const h=distributionDialog(f);h.paint();
    const body=h.nodes['hd-dialog-body'];assert.equal(h.nodes['hd-dialog-title'].textContent,'分配兵力');
    assert.match(body.textContent,/董卓 · 现有兵力 100 · 城内预备兵 1958/);
    assert.match(body.textContent,/目标总兵力 1800（0–1800）/);assert.match(body.textContent,/调低会退回城内预备兵/);
    assert.equal(body.getAttribute('data-hd-quantity-purpose'),'distribution');
    assert.equal(h.nodes['hd-dialog-bound'].textContent,'最小');assert.equal(h.nodes['hd-dialog-bound'].hidden,false);
    assert.equal(h.nodes['hd-dialog'].classList.contains('has-mobile-quantity'),true);
    f.raw.g_hdQtyValue=0;f.raw.g_hdQtyInputSeq++;h.paint();assert.match(body.textContent,/目标总兵力 0/);
    assert.equal(h.nodes['hd-dialog-bound'].textContent,'最大');
    f.raw.g_hdQtySession++;h.paint();assert.equal(h.nodes['hd-dialog-title'].textContent,'数量');
    assert.equal(body.getAttribute('data-hd-quantity-purpose'),'');assert.doesNotMatch(body.textContent,/董卓|目标总兵力|预备兵/);
    assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
});
test('the actual generic-dialog bound button sends one HELP, updates from ACK and refuses a stale session',()=>{
    const f=distributionFixture();f.enter();const h=distributionDialog(f),lcd=fs.readFileSync(new URL('../js/lcd.js',import.meta.url),'utf8');
    vm.runInNewContext(lcd.slice(lcd.indexOf('function bayeQtyAckState('),lcd.indexOf('function bayeQtyKeyboardCode(')),f.env);
    h.paint();f.setAfterKey(key=>{assert.equal(key,38);f.raw.g_hdQtyValue=0;f.raw.g_hdQtyInputSeq++;f.raw.g_hdQtyLastKey=key;});
    h.click();assert.deepEqual(f.keys,[39,39,38]);h.paint();assert.equal(h.nodes['hd-dialog-bound'].textContent,'最大');
    f.raw.g_hdQtySession++;h.click();assert.deepEqual(f.keys,[39,39,38]);assert.deepEqual(f.writes,[]);
});
for(const field of ['qtyQueue','qtySending','qtyCommitPending','qtyInputClosed','qtyAckFailed']){
    test('generic-dialog bound refuses its own pending work: '+field,()=>{
        const f=distributionFixture();f.enter();const h=distributionDialog(f);h.paint();
        h.state[field]=field==='qtyQueue'?[{delta:-1}]:true;
        let toggles=0;f.api.toggleQtyBound=()=>{toggles++;return true;};
        h.click();assert.equal(toggles,0);assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
    });
}
test('generic-dialog delta and bound share CITY ACK queue; bound cannot overtake the delta',()=>{
    const f=distributionFixture();f.enter();const h=distributionDialog(f);h.paint();
    const lcd=fs.readFileSync(new URL('../js/lcd.js',import.meta.url),'utf8');
    Object.assign(f.env,{VK_UP:34,VK_DOWN:35,VK_LEFT:36,VK_RIGHT:37});f.raw.g_hdQtyCursor=3;
    vm.runInNewContext(lcd.slice(lcd.indexOf('function bayeQtyStepKeys('),lcd.indexOf('function bayeQtyKeyboardCode(')),f.env);
    const delta=f.env.document.createElement('button');delta.setAttribute('data-hd-qty','-1');delta.parentNode=h.nodes['hd-dialog'];
    f.setAfterKey(key=>{
        if(key===35){f.raw.g_hdQtyValue--;f.raw.g_hdQtyReady=0;}
        else if(key===38){f.raw.g_hdQtyValue=f.raw.g_hdQtyMax;f.raw.g_hdQtyInputSeq++;f.raw.g_hdQtyLastKey=key;}
        else assert.fail('unexpected quantity key '+key);
    });
    h.click(delta);assert.deepEqual(f.keys,[39,39,35]);
    f.raw.g_hdQtyReady=1;h.click();assert.deepEqual(f.keys,[39,39,35]);
    f.raw.g_hdQtyInputSeq++;f.raw.g_hdQtyLastKey=35;f.tick(100);
    h.click();assert.deepEqual(f.keys,[39,39,35,38]);assert.deepEqual(f.writes,[]);
});
test('generic-dialog bound rendering never modifies the separate CITY button',()=>{
    const f=distributionFixture();f.enter();const h=distributionDialog(f);
    const cityBound=f.env.document.createElement('button');cityBound.textContent='CITY';
    f.env.document.querySelector=selector=>selector==='[data-hd-qty-bound]'?cityBound:null;h.paint();
    assert.equal(cityBound.textContent,'CITY');assert.equal(cityBound.getAttribute('data-hd-qty-session'),null);
    assert.equal(h.nodes['hd-dialog-bound'].textContent,'最小');
});
test('mobile quantity summary stays fixed while its independent touch-sized button area can scroll',()=>{
    const css=fs.readFileSync(new URL('../css/hd-mobile.css',import.meta.url),'utf8');
    assert.match(css,/\.hd-mobile-page #hd-dialog\.has-mobile-quantity \.hd-mobile-report-content \{ flex: 0 0 auto;/);
    assert.match(css,/\.hd-mobile-page #hd-dialog\.has-mobile-quantity #hd-dialog-qty \{[^}]*flex: 1 1 0;[^}]*min-height: 44px;[^}]*overflow: auto;/);
    const mobile=fs.readFileSync(new URL('../m.html',import.meta.url),'utf8');assert.match(mobile,/data-hd-qty-bound hidden/);
    assert.doesNotMatch(fs.readFileSync(new URL('../pc.html',import.meta.url),'utf8'),/data-hd-qty-bound/);
});
function previewFixture(kind=3,{mobile=true,phase=0}={}) {
    const f=fixture({marchState:true});if(mobile)f.configure();else f.stored.set('baye/cityMenuMode','hd');
    Object.assign(f.raw,{g_hdMenuKind:kind,g_hdMenuCount:3,g_hdMenuIndex:0,g_hdMarchPhase:phase});
    f.names.splice(0,f.names.length,...(kind===3?['董卓','李儒','吕布']:['方天画戟','赤兔','七星刀']));
    const ids=kind===3?[0,19,20]:[0,22,1];
    f.setMenuHook(menu=>{menu.ids=ids.slice();});
    f.state=f.internals.state;
    Object.assign(f.state,{open:true,layer:'deep',cityIndex:0,subKind:'neizheng',deepKind:kind===3?'person-goods':'goods',
        deepStep:0,deepLabel:'没收',battleMake:false,wizardStep:'none'});
    // Isolate focus routing from already covered statistics/property renderers.
    f.internals.isolatePreview();
    const dom=marchDom(f,{rooted:true});f.internals.fill();f.internals.bind();
    function all(attr,value=dom.list,out=[]){if(value.getAttribute(attr)!==null)out.push(value);
        for(const child of value.children)all(attr,child,out);return out;}
    function event(target,extra={}){return {target,detail:1,isPrimary:true,button:0,pointerId:7,
        preventDefault(){},stopPropagation(){},...extra};}
    function down(index,extra={}){const button=all('data-hd-deep-preview')[index];dom.root.emit('pointerdown',event(button,extra));return button;}
    function click(button){dom.root.emit('click',event(button));}
    function press(index){const button=down(index);click(button);return button;}
    f.setAfterKey(key=>{if(key===0x23)f.raw.g_hdMenuIndex++;else if(key===0x22)f.raw.g_hdMenuIndex--;});
    return Object.assign(f,{dom,ids,all,event,down,click,press});
}

function goodsReturnFixture({mobile=true,phase=0,personSeq=3}={}) {
    const f=previewFixture(3,{mobile,phase});
    const persons={names:f.names.slice(),ids:f.ids.slice()};
    function publish(kind,seq,index=0) {
        const values=kind===3?persons:kind===4?{names:['方天画戟','赤兔'],ids:[0,22]}:{names:[],ids:[]};
        f.names.splice(0,f.names.length,...values.names);f.ids.splice(0,f.ids.length,...values.ids);
        Object.assign(f.raw,{g_hdMenuActive:kind?1:0,g_hdMenuContext:kind?1:0,g_hdMenuKind:kind,
            g_hdMenuSeq:seq,g_hdMenuCount:values.names.length,g_hdMenuIndex:index});
    }
    const next=seq=>seq===0xffffffff?1:seq+1,goodsSeq=next(next(personSeq)),returnSeq=next(next(goodsSeq));
    f.raw.g_hdMenuSeq=personSeq;f.raw.g_hdMenuIndex=2;f.internals.fill();
    f.setAfterKey(key=>{if(key===0x27){publish(0,next(personSeq));f.env.setTimeout(()=>publish(4,goodsSeq),60);}});
    const main=f.all('data-hd-deep')[2];f.dom.root.emit('pointerdown',f.event(main));f.click(main);
    assert.deepEqual(f.keys,[0x27]);f.tick(80);f.internals.fill();
    assert.equal(f.state.deepStep,1);assert.equal(f.raw.g_hdMenuKind,4);
    const goodsButtons=f.all('data-hd-deep-preview').slice();
    let returnAction=()=>publish(3,returnSeq,2), exits=0;
    f.setAfterKey(key=>{if(key===0x28){exits++;publish(0,next(goodsSeq));f.env.setTimeout(()=>returnAction(),60);}});
    return Object.assign(f,{publish,persons,goodsButtons,back(){f.internals.back(f.internals.backOwner());},
        setReturn(fn){returnAction=fn;},exits(){return exits;}});
}

test('mobile GOODS cancel waits the fresh native PERSON publication then restores the same command',()=>{
    const f=goodsReturnFixture();f.back();assert.deepEqual(f.keys,[0x27,0x28]);
    assert.equal(f.state.layer,'deep');assert.equal(f.state.deepStep,1);assert.ok(f.state.goodsBackPending);
    f.tick(40);assert.equal(f.raw.g_hdMenuActive,0);assert.equal(f.state.deepStep,1);
    f.tick(40);f.internals.fill();
    assert.equal(f.state.layer,'deep');assert.equal(f.state.deepKind,'person-goods');assert.equal(f.state.deepStep,0);
    assert.equal(f.state.deepLabel,'没收');assert.equal(f.state.idleIndex,2);
    assert.equal(f.state.deepMenuOwner.kind,3);assert.equal(f.state.deepMenuOwner.seq,7);
    assert.deepEqual(Array.from(f.state.deepItems,person=>person.pind),[0,19,20]);
    assert.equal(f.state.goodsBackPending,null);assert.deepEqual(f.keys,[0x27,0x28]);assert.deepEqual(f.writes,[]);
});
for(const personSeq of [0xfffffffc,0xfffffffd]){
    test('mobile GOODS return follows native U32 nonzero menu sequence across wrap: '+personSeq,()=>{
        const f=goodsReturnFixture({personSeq});f.back();f.tick(80);
        assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.seq,personSeq===0xfffffffc?1:2);
        assert.deepEqual(f.keys,[0x27,0x28]);assert.deepEqual(f.writes,[]);
    });
}
test('mobile GOODS return waits complete U16 PERSON identities after native begin publication',()=>{
    const f=goodsReturnFixture();f.setReturn(()=>{
        f.publish(3,7,2);f.setMenuHook(menu=>{menu.ids=[];menu.idsValid=false;});
        f.env.setTimeout(()=>f.setMenuHook(menu=>{menu.ids=f.ids.slice();}),100);
    });
    f.back();f.tick(80);assert.equal(f.state.deepStep,1);assert.ok(f.state.goodsBackPending);
    f.tick(100);assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.seq,7);
    assert.deepEqual(f.keys,[0x27,0x28]);
});
test('mobile GOODS cancel is single EXIT while waiting and its old goods buttons cannot send',()=>{
    const f=goodsReturnFixture();f.back();f.back();
    const old=f.goodsButtons[1];f.dom.root.emit('pointerdown',f.event(old));f.click(old);f.tick(80);
    f.dom.root.emit('pointerdown',f.event(old));f.click(old);
    assert.deepEqual(f.keys,[0x27,0x28]);assert.equal(f.exits(),1);assert.deepEqual(f.writes,[]);
});
test('mobile GOODS pending EXIT blocks current preview, confirmation and property paging before native consumes it',()=>{
    const f=goodsReturnFixture();f.setAfterKey(()=>{});f.back();
    assert.ok(f.state.goodsBackPending);assert.equal(f.raw.g_hdMenuKind,4);
    f.press(1);
    const main=f.all('data-hd-deep')[0];f.dom.root.emit('pointerdown',f.event(main));f.click(main);
    f.internals.setToolContext({pageOwnerKey:'current-goods-page',snapshotKey:'current-goods-fields',
        pageStart:0,pageEnd:1,propertyCount:5});
    assert.equal(f.internals.pageTool('next','current-goods-page'),false);
    assert.equal(f.state.nativeMenuRequest,null);assert.equal(f.state.toolPagePending,null);
    assert.deepEqual(f.keys,[0x27,0x28]);f.api.retireInteraction('cancel-wait');
    assert.equal(f.state.goodsBackPending,null);assert.deepEqual(f.writes,[]);
});
test('mobile returned PERSON Back keeps the original parent layer and sends only another EXIT',()=>{
    const f=goodsReturnFixture();f.back();f.tick(80);f.internals.fill();
    f.setAfterKey(()=>{});f.back();f.tick(100);
    assert.equal(f.state.layer,'sub');assert.equal(f.state.deepKind,'');
    assert.deepEqual(f.keys,[0x27,0x28,0x28]);assert.deepEqual(f.writes,[]);
});
test('mobile GOODS return source survives harmless gesture retirement before the actual cancel',()=>{
    const f=goodsReturnFixture();f.api.retireInteraction('scroll');f.internals.fill();f.back();f.tick(80);
    assert.equal(f.state.layer,'deep');assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.kind,3);
    assert.deepEqual(f.keys,[0x27,0x28]);
});
test('mobile GOODS return also supports retained terminal March phase7 without authorizing an active march',()=>{
    const f=goodsReturnFixture({phase:7});f.back();f.tick(80);
    assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.seq,7);assert.deepEqual(f.keys,[0x27,0x28]);
});
for(const change of ['seq','ids','names','actor-index','actor-id','invalid-ids','generation','library','data','city',
    'report','help','qty','fight','march','hidden','classic','retire','timeout']){
    test('mobile GOODS cancel refuses an unrelated or retired PERSON publication: '+change,()=>{
        const f=goodsReturnFixture();
        f.setReturn(()=>{
            f.publish(3,7,2);
            if(change==='seq')f.raw.g_hdMenuSeq=9;
            if(change==='ids')f.ids[0]=1;
            if(change==='names')f.names[0]='其他人物';
            if(change==='actor-index')f.raw.g_hdMenuIndex=1;
            if(change==='actor-id')f.ids[2]=21;
            if(change==='invalid-ids')f.setMenuHook(menu=>{menu.ids=f.ids.slice();menu.idsValid=false;});
            if(change==='generation')f.raw.g_hdDetailGeneration++;
            if(change==='library')f.setIdentity({...f.identity(),generation:2});
            if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
            if(change==='city')f.raw.g_hdMapCity=2;
            if(change==='report')f.raw.g_hdReportActive=1;
            if(change==='help')f.raw.g_hdHelpActive=1;
            if(change==='qty')f.raw.g_hdQtyActive=1;
            if(change==='fight')f.raw.g_hdFightActive=1;
            if(change==='march')f.raw.g_hdMarchPhase=1;
            if(change==='hidden')f.env.document.hidden=true;
            if(change==='classic')f.api.setMode('classic');
            if(change==='retire')f.api.retireInteraction('return-retired');
        });
        if(change==='timeout')f.setReturn(()=>f.publish(0,6));
        f.back();f.tick(5200);
        assert.notEqual(f.state.deepStep,0);assert.equal(f.state.goodsBackPending,null);
        assert.ok(!f.state.deepMenuOwner || f.state.deepMenuOwner.kind!==3);
        assert.deepEqual(f.keys,[0x27,0x28]);assert.deepEqual(f.writes,[]);
    });
}
test('PC GOODS cancellation retains the existing parent navigation behavior',()=>{
    const f=goodsReturnFixture({mobile:false});f.back();f.tick(80);
    assert.equal(f.state.layer,'sub');assert.equal(f.state.deepKind,'');assert.deepEqual(f.keys,[0x27,0x28]);
});

for(const kind of [3,4]){
    test('mobile 查看 '+kind+' renders exact native identity and keeps the original confirmation button',()=>{
        const f=previewFixture(kind),buttons=f.all('data-hd-deep-preview'),main=f.all('data-hd-deep');
        assert.equal(buttons.length,3);assert.equal(main.length,3);
        for(let i=0;i<3;i++){assert.equal(buttons[i].textContent,'查看');assert.equal(buttons[i].disabled,undefined);
            assert.equal(buttons[i].getAttribute('aria-label'),'查看 · '+f.names[i]);
            assert.equal(buttons[i].getAttribute(kind===3?'data-hd-deep-pind':'data-hd-deep-tool'),String(f.ids[i]));
            assert.equal(main[i].textContent,f.names[i]);}
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
    test('mobile 查看 '+kind+' waits actual native arrow ACK and never sends Enter or predicts selection',()=>{
        const f=previewFixture(kind);f.setAfterKey(()=>{});f.press(2);
        assert.deepEqual(f.keys,[0x23]);assert.equal(f.raw.g_hdMenuIndex,0);assert.equal(f.state.idleIndex,0);
        f.tick(200);assert.deepEqual(f.keys,[0x23]);
        f.raw.g_hdMenuIndex=1;f.tick(40);assert.deepEqual(f.keys,[0x23,0x23]);assert.equal(f.raw.g_hdMenuIndex,1);
        f.raw.g_hdMenuIndex=2;f.tick(40);assert.equal(f.state.nativeMenuRequest,null);
        assert.equal(f.state.idleIndex,0);f.internals.fill();assert.equal(f.state.idleIndex,2);
        f.press(0);assert.deepEqual(f.keys,[0x23,0x23,0x22]);assert.deepEqual(f.writes,[]);
    });
    test('mobile 查看 '+kind+' current item is enabled and emits zero keys',()=>{
        const f=previewFixture(kind);f.press(0);assert.equal(f.state.nativeMenuRequest,null);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
    test('mobile 查看 '+kind+' preserves row nodes across current-owner polls and index ACK',()=>{
        const f=previewFixture(kind),button=f.down(1),main=f.all('data-hd-deep')[1];
        for(let i=0;i<4;i++)f.internals.fill();assert.equal(f.all('data-hd-deep-preview')[1],button);
        f.click(button);f.tick(40);f.internals.fill();assert.equal(f.all('data-hd-deep-preview')[1],button);
        assert.equal(f.all('data-hd-deep')[1],main);assert.deepEqual(f.keys,[0x23]);
    });
}

function equipmentFixture(command='largess',{empty=false,phase=0}={}) {
    const f=previewFixture(3,{phase}),subNames=['开垦','招商','搜寻','治理','出巡','招降','处斩','流放','赏赐','没收','交易','宴请','输送','移动'];
    f.raw.g_asyncActionID=0;
    f.env.bayeQtyNativeClosed=()=>f.raw.g_hdQtyActive===0;
    const people={names:['董卓','李儒','吕布'],ids:[0,19,20]},inventory={names:['七星刀'],ids:[1]};
    function publish(kind,seq,index=0,list=null){
        const values=list||(kind===2?{names:subNames,ids:[]}:kind===3?people:kind===4?inventory:{names:[],ids:[]});
        f.names.splice(0,f.names.length,...values.names);f.ids.splice(0,f.ids.length,...values.ids);
        Object.assign(f.raw,{g_hdMenuActive:kind?1:0,g_hdMenuContext:kind?1:0,g_hdMenuKind:kind,
            g_hdMenuSeq:seq,g_hdMenuCount:values.names.length,g_hdMenuIndex:index});
    }
    let reportSeq=0;
    function report(kind,person,text){Object.assign(f.raw,{g_hdReportActive:1,g_hdReportKind:kind,
        g_hdReportPerson:person,g_hdReportSeq:++reportSeq,g_hdReportInputSeq:reportSeq});
        f.setReportHook(value=>{value.text=text;});}
    function endReport(){f.raw.g_hdReportActive=0;}
    function map(seq){publish(0,seq);Object.assign(f.raw,{g_hdMapPick:1,g_hdBattlePick:0,
        g_hdMapInputSeq:f.raw.g_hdMapInputSeq===0xffffffff?1:f.raw.g_hdMapInputSeq+1,
        g_hdGoodsActive:0,g_hdPersonPropertiesActive:0});}
    publish(2,10,command==='largess'?8:9);
    Object.assign(f.state,{layer:'sub',deepKind:'',deepStep:0,subKind:'neizheng',deepLabel:''});
    f.setAfterKey(key=>{if(key===39){publish(0,11);f.env.setTimeout(()=>{
        if(empty)report(1,65535,'城中无道具');else publish(command==='largess'?4:3,12);
    },60);}});
    f.internals.chooseSub(command==='largess'?8:9);f.tick(80);f.internals.fill();
    function main(index){const button=f.all('data-hd-deep')[index];assert.ok(button,'current native item exists');
        f.dom.root.emit('pointerdown',f.event(button));f.click(button);}
    return Object.assign(f,{publish,map,people,inventory,report,endReport,main,
        back(){f.internals.back(f.internals.backOwner());}});
}

test('mobile equipment empty initial inventory report retires to actual MAP with no extra EXIT',()=>{
    const f=equipmentFixture('largess',{empty:true});assert.equal(f.state.deepKind,'goods-person');
    assert.ok(f.internals.equipmentFlow());assert.equal(f.api.getInputTicket(),null);
    f.tick(12000);assert.ok(f.internals.equipmentFlow());assert.deepEqual(f.keys,[39]);
    f.endReport();f.map(11);f.tick(40);
    assert.equal(f.state.open,false);assert.equal(f.state.layer,'root');assert.equal(f.state.deepKind,'');
    assert.equal(f.internals.equipmentFlow(),null);assert.deepEqual(f.keys,[39]);assert.deepEqual(f.writes,[]);
});
test('mobile equipment reward GOODS Enter observes fresh PERSON and enables native person detail/preview routing',()=>{
    const f=equipmentFixture();assert.equal(f.state.deepKind,'goods-person');assert.equal(f.state.deepStep,0);
    f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>f.publish(3,14),60);}});
    f.main(0);assert.equal(f.state.deepStep,0);f.tick(80);f.internals.fill();
    assert.equal(f.state.deepStep,1);assert.equal(f.state.deepMenuOwner.kind,3);assert.equal(f.state.deepMenuOwner.seq,14);
    assert.equal(f.internals.personKind(f.state.deepKind),true);assert.equal(f.internals.usesGoods(f.state.deepKind,1),false);
    assert.deepEqual(Array.from(f.state.deepItems,p=>p.pind),[0,19,20]);
    f.setAfterKey(key=>{if(key===35)f.raw.g_hdMenuIndex++;});f.press(1);f.tick(40);
    assert.deepEqual(f.keys,[39,39,35]);assert.equal(f.raw.g_hdMenuIndex,1);assert.deepEqual(f.writes,[]);
});
test('mobile equipment pending Enter rejects preview, another main choice, back and property input until actual publication',()=>{
    const f=equipmentFixture(),preview=f.all('data-hd-deep-preview')[0];
    f.setAfterKey(()=>{});f.main(0);assert.ok(f.internals.equipmentFlow());
    f.dom.root.emit('pointerdown',f.event(preview));f.click(preview);f.main(0);f.back();
    f.internals.setToolContext({pageOwnerKey:'current-tool',snapshotKey:'current-snapshot',
        pageStart:0,pageEnd:1,propertyCount:5});
    assert.equal(f.internals.pageTool('next','current-tool'),false);
    assert.equal(f.internals.send(35,'equipment-pending'),false);f.tick(80);
    assert.deepEqual(f.keys,[39,39]);assert.ok(f.internals.equipmentFlow());assert.deepEqual(f.writes,[]);
});
test('mobile equipment waits for complete fresh PERSON publication without treating its old names as current',()=>{
    const f=equipmentFixture();let complete=false;
    f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>{
        f.publish(3,14);f.setMenuHook(menu=>{menu.ids=complete?f.ids.slice():[];menu.idsValid=complete;});
    },60);}});
    f.main(0);f.tick(80);assert.equal(f.state.deepStep,0);assert.ok(f.internals.equipmentFlow());
    assert.equal(f.api.getInputTicket(),null);assert.deepEqual(f.keys,[39,39]);
    complete=true;f.tick(40);f.internals.fill();assert.equal(f.state.deepStep,1);
    assert.equal(f.state.deepMenuOwner.seq,14);assert.deepEqual(f.keys,[39,39]);
});
for(const seq of [0xfffffffe,0xffffffff])test('mobile equipment Enter follows nonzero U32 sequence across wrap: '+seq,()=>{
    const f=equipmentFixture(),next=value=>value===0xffffffff?1:value+1;
    f.publish(4,seq);f.internals.fill();f.setAfterKey(key=>{if(key===39){
        f.publish(0,next(seq));f.env.setTimeout(()=>f.publish(3,next(next(seq))),60);}});
    f.main(0);f.tick(80);f.internals.fill();assert.equal(f.state.deepStep,1);
    assert.equal(f.state.deepMenuOwner.seq,next(next(seq)));assert.deepEqual(f.keys,[39,39]);
});
test('mobile equipment reward PERSON cancel restores fresh inventory then final GOODS EXIT retires to actual MAP',()=>{
    const f=equipmentFixture();f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>f.publish(3,14),60);}});
    f.main(0);f.tick(80);f.internals.fill();
    f.setAfterKey(key=>{if(key===40){f.publish(0,15);f.env.setTimeout(()=>f.publish(4,16),60);}});
    f.back();f.tick(80);f.internals.fill();assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.kind,4);
    f.setAfterKey(key=>{if(key===40){f.publish(0,17);f.env.setTimeout(()=>f.map(17),60);}});
    f.back();f.tick(80);assert.equal(f.state.open,false);assert.equal(f.state.layer,'root');
    assert.equal(f.state.deepMenuOwner,null);assert.deepEqual(f.keys,[39,39,40,40]);
});
test('mobile equipment FULLGOODS report returns fresh PERSON index0 and keeps the selected tool for another actor',()=>{
    const f=equipmentFixture();f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>f.publish(3,14),60);}});
    f.main(0);f.tick(80);f.internals.fill();f.raw.g_hdMenuIndex=2;f.internals.fill();
    f.setAfterKey(key=>{if(key===39){f.publish(0,15);f.env.setTimeout(()=>f.report(1,65535,'道具已满'),60);}});
    f.main(2);f.tick(80);assert.ok(f.internals.equipmentFlow());assert.equal(f.api.getInputTicket(),null);
    f.endReport();f.publish(3,16,0);f.tick(40);f.internals.fill();
    assert.equal(f.state.deepStep,1);assert.equal(f.state.idleIndex,0);assert.equal(f.state.deepMenuOwner.seq,16);
    f.setAfterKey(key=>{if(key===40){f.publish(0,17);f.env.setTimeout(()=>f.publish(4,18),60);}});
    f.back();f.tick(80);assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.kind,4);
    assert.deepEqual(f.keys,[39,39,39,40]);assert.deepEqual(f.writes,[]);
});
test('mobile equipment successful reward accepts changed native inventory after its actual person report',()=>{
    const f=equipmentFixture();f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>f.publish(3,14),60);}});
    f.main(0);f.tick(80);f.internals.fill();f.raw.g_hdMenuIndex=1;f.internals.fill();
    f.setAfterKey(key=>{if(key===39){f.publish(0,15);f.env.setTimeout(()=>f.report(2,19,'谢主公赏赐'),60);}});
    f.main(1);f.tick(80);assert.ok(f.internals.equipmentFlow());
    f.endReport();f.publish(4,16,0,{names:['赤兔'],ids:[22]});f.tick(40);f.internals.fill();
    assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.kind,4);
    assert.deepEqual(Array.from(f.state.deepItems,p=>p.toolIndex),[22]);assert.deepEqual(f.keys,[39,39,39]);
});
test('mobile equipment successful last reward permits person report then empty-inventory MSGBOX then actual MAP',()=>{
    const f=equipmentFixture();f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>f.publish(3,14),60);}});
    f.main(0);f.tick(80);f.internals.fill();f.raw.g_hdMenuIndex=1;f.internals.fill();
    f.setAfterKey(key=>{if(key===39){f.publish(0,15);f.env.setTimeout(()=>f.report(2,19,'谢主公赏赐'),60);}});
    f.main(1);f.tick(80);f.tick(6000);assert.ok(f.internals.equipmentFlow());
    f.endReport();f.report(1,65535,'城中无道具');f.tick(6000);assert.ok(f.internals.equipmentFlow());
    f.endReport();f.map(15);f.tick(40);
    assert.equal(f.state.open,false);assert.equal(f.state.layer,'root');assert.equal(f.state.deepKind,'');
    assert.deepEqual(f.keys,[39,39,39]);
});
for(const phase of [0,7])test('mobile equipment final confiscate PERSON EXIT retires actual MAP phase '+phase+' with one EXIT',()=>{
    const f=equipmentFixture('confiscate',{phase});f.setAfterKey(key=>{if(key===40){
        f.publish(0,13);f.env.setTimeout(()=>f.map(13),60);}});
    f.back();f.tick(80);f.internals.fill();assert.equal(f.state.open,false);assert.equal(f.state.layer,'root');
    assert.equal(f.state.deepKind,'');assert.equal(f.state.deepMenuOwner,null);
    assert.deepEqual(f.keys,[39,40]);assert.deepEqual(f.writes,[]);
});
test('mobile equipment genuine MAP still retires after host clears its report-wait work',()=>{
    const f=equipmentFixture('largess',{empty:true});f.api.retireInteraction('owner-change');
    assert.equal(f.internals.equipmentFlow(),null);f.endReport();f.map(11);f.internals.fill();
    assert.equal(f.state.open,false);assert.equal(f.state.deepMenuOwner,null);assert.deepEqual(f.keys,[39]);
});
for(const change of ['map-pick','battle-pick','phase','map-seq','menu-seq','menu-context','menu-kind',
    'data','library','generation','city','report','help','qty','fight','goods','person','async']){
    test('mobile equipment MAP retirement refuses stale or competing '+change,()=>{
        const f=equipmentFixture('largess',{empty:true});f.endReport();f.map(11);
        if(change==='map-pick')f.raw.g_hdMapPick=0;
        if(change==='battle-pick')f.raw.g_hdBattlePick=1;
        if(change==='phase')f.raw.g_hdMarchPhase=4;
        if(change==='map-seq')f.raw.g_hdMapInputSeq++;
        if(change==='menu-seq')f.raw.g_hdMenuSeq++;
        if(change==='menu-context')f.raw.g_hdMenuContext=1;
        if(change==='menu-kind')f.raw.g_hdMenuKind=4;
        if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
        if(change==='library')f.setIdentity({...f.identity(),generation:2});
        if(change==='generation')f.raw.g_hdDetailGeneration++;
        if(change==='city')f.raw.g_hdMapCity=2;
        if(change==='report')f.report(1,65535,'仍在报告');
        if(change==='help')f.raw.g_hdHelpActive=1;
        if(change==='qty')f.raw.g_hdQtyActive=1;
        if(change==='fight')f.raw.g_hdFightActive=1;
        if(change==='goods')f.raw.g_hdGoodsActive=1;
        if(change==='person')f.raw.g_hdPersonPropertiesActive=1;
        if(change==='async')f.raw.g_asyncActionID=1;
        f.internals.fill();assert.equal(f.state.open,true);assert.deepEqual(f.keys,[39]);assert.deepEqual(f.writes,[]);
    });
}
for(const king of [true,false])test('mobile equipment confiscate commit returns same PERSON after '+(king?'king without report':'actual actor report'),()=>{
    const f=equipmentFixture('confiscate');f.raw.g_hdMenuIndex=king?0:2;f.internals.fill();
    f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>f.publish(4,14,0,{names:['七星刀'],ids:[1]}),60);}});
    f.main(king?0:2);f.tick(80);f.internals.fill();assert.equal(f.state.deepStep,1);
    f.setAfterKey(key=>{if(key===39){f.publish(0,15);f.env.setTimeout(()=>{
        if(king)f.publish(3,16,0);else f.report(2,20,'请主公三思');},60);}});
    f.main(0);f.tick(80);
    if(!king){assert.ok(f.internals.equipmentFlow());f.endReport();f.publish(3,16,2);f.tick(40);}
    f.internals.fill();assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.kind,3);
    assert.equal(f.state.idleIndex,king?0:2);assert.deepEqual(f.keys,[39,39,39]);assert.deepEqual(f.writes,[]);
});
for(const change of ['index','ids','names','seq','generation'])test('mobile equipment confiscate commit refuses an unrelated return PERSON: '+change,()=>{
    const f=equipmentFixture('confiscate');f.raw.g_hdMenuIndex=2;f.internals.fill();
    f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>f.publish(4,14),60);}});
    f.main(2);f.tick(80);f.internals.fill();
    f.setAfterKey(key=>{if(key===39){f.publish(0,15);f.env.setTimeout(()=>{
        f.publish(3,16,2);
        if(change==='index')f.raw.g_hdMenuIndex=0;
        if(change==='ids')f.ids[2]=21;
        if(change==='names')f.names[2]='另一个人物';
        if(change==='seq')f.raw.g_hdMenuSeq=18;
        if(change==='generation')f.raw.g_hdDetailGeneration++;
    },60);}});
    f.main(0);f.tick(80);assert.equal(f.internals.equipmentFlow(),null);
    assert.equal(f.state.deepStep,1);assert.deepEqual(f.keys,[39,39,39]);assert.deepEqual(f.writes,[]);
});
test('mobile equipment changes do not replace the PC reward goods route',()=>{
    const f=previewFixture(4,{mobile:false});
    Object.assign(f.state,{layer:'sub',deepKind:'',deepStep:0,subKind:'neizheng',deepLabel:''});
    const names=['开垦','招商','搜寻','治理','出巡','招降','处斩','流放','赏赐','没收','交易','宴请','输送','移动'];
    f.names.splice(0,f.names.length,...names);Object.assign(f.raw,{g_hdMenuKind:2,g_hdMenuCount:names.length,g_hdMenuIndex:8});
    f.internals.chooseSub(8);assert.equal(f.state.deepKind,'goods');assert.equal(f.internals.equipmentFlow(),null);
    assert.deepEqual(f.keys,[39]);assert.deepEqual(f.writes,[]);
});
for(const change of ['seq','ids-incomplete','data','library','generation','city','report-person','report-kind','help','qty','fight','hidden','classic','retire']){
    test('mobile equipment reward handoff rejects stale or competing '+change,()=>{
        const f=equipmentFixture();f.setAfterKey(key=>{if(key===39){f.publish(0,13);f.env.setTimeout(()=>{
            f.publish(3,14);
            if(change==='seq')f.raw.g_hdMenuSeq=16;
            if(change==='ids-incomplete')f.setMenuHook(menu=>{menu.ids=f.ids.slice();menu.idsValid=false;});
            if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
            if(change==='library')f.setIdentity({...f.identity(),generation:2});
            if(change==='generation')f.raw.g_hdDetailGeneration++;
            if(change==='city')f.raw.g_hdMapCity=2;
            if(change==='report-person'){f.publish(0,13);f.report(2,20,'无关人物报告');}
            if(change==='report-kind'){f.publish(0,13);f.report(3,65535,'未知报告');}
            if(change==='help')f.raw.g_hdHelpActive=1;
            if(change==='qty')f.raw.g_hdQtyActive=1;
            if(change==='fight')f.raw.g_hdFightActive=1;
            if(change==='hidden')f.env.document.hidden=true;
            if(change==='classic')f.api.setMode('classic');
            if(change==='retire')f.api.retireInteraction('equipment-retire');
        },60);}});
        f.main(0);f.tick(5200);assert.equal(f.internals.equipmentFlow(),null);
        assert.notEqual(f.state.deepStep,1);assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
    });
}
for(const change of ['cancel','retire','hidden','portrait','classic','unavailable','library','data','seq','index','target-id','target-name',
    'generation','report','help','qty','fight','old-dom','queue','page-pending','native-request','wrong-button','nonprimary']){
    test('mobile 查看 refuses a stale or competing press: '+change,()=>{
        const f=previewFixture(),button=f.down(2);
        if(change==='cancel')f.dom.root.emit('pointercancel',f.event(button));
        if(change==='retire')f.api.retireInteraction('preview-test');
        if(change==='hidden')f.env.document.hidden=true;
        if(change==='portrait')f.env.innerWidth=390;
        if(change==='classic')f.api.setMode('classic');
        if(change==='unavailable')f.setAvailable(false);
        if(change==='library')f.setIdentity({...f.identity(),generation:2});
        if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
        if(change==='seq')f.raw.g_hdMenuSeq++;
        if(change==='index')f.raw.g_hdMenuIndex=1;
        if(change==='target-id')f.ids[2]=21;
        if(change==='target-name')f.names[2]='另一人物';
        if(change==='generation')f.raw.g_hdDetailGeneration++;
        if(change==='report')f.raw.g_hdReportActive=1;
        if(change==='help')f.raw.g_hdHelpActive=1;
        if(change==='qty')f.raw.g_hdQtyActive=1;
        if(change==='fight')f.raw.g_hdFightActive=1;
        if(change==='old-dom'){f.state.deepSig='';f.internals.fill();}
        if(change==='queue')f.state.queue.push({code:40});
        if(change==='page-pending')f.state.personPagePending={};
        if(change==='native-request')f.state.nativeMenuRequest={key:'busy'};
        if(change==='wrong-button')f.click(f.all('data-hd-deep-preview')[1]);
        else if(change==='nonprimary'){f.down(2,{isPrimary:false});f.click(button);}
        else f.click(button);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    });
}
for(const change of ['retire','data','library','seq','target-id','report','hidden','classic','queue']){
    test('mobile 查看 stops in-flight focus arrows after '+change,()=>{
        const f=previewFixture();f.press(2);assert.deepEqual(f.keys,[0x23]);
        if(change==='retire')f.api.retireInteraction('mid-arrow');
        if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
        if(change==='library')f.setIdentity({...f.identity(),generation:2});
        if(change==='seq')f.raw.g_hdMenuSeq++;
        if(change==='target-id')f.ids[2]=21;
        if(change==='report')f.raw.g_hdReportActive=1;
        if(change==='hidden')f.env.document.hidden=true;
        if(change==='classic')f.api.setMode('classic');
        if(change==='queue')f.state.queue.push({code:40});
        f.tick(10000);assert.deepEqual(f.keys,[0x23]);assert.equal(f.state.nativeMenuRequest,null);assert.deepEqual(f.writes,[]);
    });
}
test('mobile 查看 rejects a click without a current press and never takes over a PC or MARCH list',()=>{
    const f=previewFixture();f.click(f.all('data-hd-deep-preview')[1]);assert.deepEqual(f.keys,[]);
    const pc=previewFixture(3,{mobile:false});assert.equal(pc.all('data-hd-deep-preview').length,0);
    const march=mobileMarchFixture(1),dom=marchDom(march);dom.poll();assert.equal(dom.find('data-hd-deep-preview'),null);
    f.state.deepKind='person-city';f.click(f.down(1));assert.deepEqual(f.keys,[]);
});
test('mobile 查看 leaves the actual main button Enter semantics unchanged',()=>{
    for(const kind of [3,4]){
        const f=previewFixture(kind),button=f.all('data-hd-deep')[0];
        f.dom.root.emit('pointerdown',f.event(button));f.dom.root.emit('click',f.event(button));
        assert.deepEqual(f.keys,[0x27]);assert.deepEqual(f.writes,[]);
    }
});
test('mobile 查看 times out without repeating a direction or sending Enter when native focus never acknowledges',()=>{
    const f=previewFixture();f.setAfterKey(()=>{});f.press(2);f.tick(10000);
    assert.deepEqual(f.keys,[0x23]);assert.equal(f.state.nativeMenuRequest,null);assert.deepEqual(f.writes,[]);
});
test('mobile 查看 accepts an ordinary current CITY at terminal phase7 without taking the old MARCH owner',()=>{
    const f=previewFixture(3,{phase:7});f.press(1);f.tick(40);
    assert.deepEqual(f.keys,[0x23]);assert.equal(f.raw.g_hdMenuIndex,1);assert.equal(f.state.nativeMenuRequest,null);
    assert.deepEqual(f.writes,[]);
});
for(const kind of [3,4]){
    test('mobile 查看 '+kind+' binds full U16 IDs without truncation and rejects incomplete identity',()=>{
        const f=previewFixture(kind);f.ids[2]=512;f.state.deepSig='';f.internals.fill();const b=f.down(2);
        assert.equal(b.getAttribute(kind===3?'data-hd-deep-pind':'data-hd-deep-tool'),'512');
        f.ids[2]=0;f.click(b);assert.deepEqual(f.keys,[]);
        for(const invalid of ['missing','length','reserved']){
            f.setMenuHook(m=>{m.ids=f.ids.slice();if(invalid==='missing')m.idsValid=false;
                if(invalid==='length')m.ids.pop();if(invalid==='reserved')m.ids[2]=65535;});
            f.click(f.down(1));assert.deepEqual(f.keys,[]);
        }
    });
}
test('mobile detail scroll retires only for an actual owner or native identity change, not same-owner polls or pages',()=>{
    const f=previewFixture(),pane={scrollTop:120};
    f.internals.resetDetailScroll(pane,'owner',3,0);assert.equal(pane.scrollTop,0);
    pane.scrollTop=120;for(let i=0;i<5;i++)f.internals.resetDetailScroll(pane,'owner',3,0);
    assert.equal(pane.scrollTop,120);f.internals.resetDetailScroll(pane,'owner',3,19);assert.equal(pane.scrollTop,0);
    pane.scrollTop=120;f.internals.resetDetailScroll(pane,'owner2',3,19);assert.equal(pane.scrollTop,0);
    pane.scrollTop=120;f.internals.resetDetailScroll(pane,'owner2',4,19);assert.equal(pane.scrollTop,0);
    pane.scrollTop=120;f.setIdentity({...f.identity(),generation:2});f.internals.resetDetailScroll(pane,'owner2',4,19);
    assert.equal(pane.scrollTop,0);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
