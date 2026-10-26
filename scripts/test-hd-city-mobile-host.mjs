import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Controlled public bridge fixtures. No native C, browser, or OS execution.
const source = fs.readFileSync(new URL('../js/hd-city-menu.js', import.meta.url), 'utf8');
const tradeSource = process.env.BAYE_HD_TRADE_SOURCE ? fs.readFileSync(process.env.BAYE_HD_TRADE_SOURCE,'utf8') : source;
const diplomacySource = process.env.BAYE_HD_DIPLOMACY_SOURCE ? fs.readFileSync(process.env.BAYE_HD_DIPLOMACY_SOURCE,'utf8') : source;
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
function fixture({storageThrows = false, marchState = false, sourceText = source} = {}) {
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
    const code=marchState?sourceText.replace(/\}\)\(window\);\s*$/,`
        global.__marchTest={state:state,sync:syncMarchPhase,send:engineSendKey,cancelQty:cancelQty,
            cancelPersons:cancelUnselectedMarch,fill:fillDeepList,render:render,other:otherCities,
            syncTransfer:typeof syncMobileTransfer==='function'?syncMobileTransfer:null,
            syncDiplomacy:typeof syncMobileDiplomacy==='function'?syncMobileDiplomacy:null,
            continueTransfer:typeof continueTransfer==='function'?continueTransfer:null,chooseDeep:chooseDeep,
            select:selectLiveMenu,commitQty:commitQty,preview:typeof previewDeep==='function'?previewDeep:null,
            previewContext:typeof mobilePreviewContext==='function'?mobilePreviewContext:null,bind:bindUi,
             back:back,backOwner:cityBackPressOwner,
             chooseSub:chooseSub,equipmentFlow(){return typeof mobileEquipmentFlow==='undefined'?null:mobileEquipmentFlow;},
             personKind:typeof personDeepKind==='function'?personDeepKind:null,usesGoods:usesGoodsMenu,
             pageTool:pageTool,setToolContext(value){liveToolContext=function(){return value;};renderToolDetails=function(){};},
            resetDetailScroll:typeof resetMobileDetailScroll==='function'?resetMobileDetailScroll:null,
            isolatePreview(){renderPersonDetails=function(){};renderToolDetails=function(){};}};
        render=function(){};applyDocAttr=function(){};scheduleMarchWatch=function(){};
    })(window);`):sourceText;
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
        applyDocAttr:noOp,retirePersonDetails:noOp,retireToolDetails:noOp,syncMobileTrade:noOp,syncMobileTransfer:noOp,syncMobileDiplomacy:noOp,
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
    if(name==='syncMode'){context.syncMobileTrade=()=>false;context.mobileTrade=null;
        context.syncMobileDiplomacy=()=>false;context.mobileDiplomacy=null;
        context.syncMobileTransfer=()=>false;context.mobileTransfer=null;if(!('mobileHost' in context))context.mobileHost=null;}
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

// Native transfer protocol fixtures are independent of BattleMake/MARCH.
// The real standard CITY_LINKR bytes determine every selectable destination.
function transferFixture(command=13,phase=1,{sourceText=source}={}) {
    const f=fixture({marchState:true,sourceText});f.configure();f.state=f.internals.state;
    const names=['董卓','李儒','吕布'];let ids=[0,19,20],transferHook=null;
    Object.assign(f.raw,{g_PlayerKing:0,g_asyncActionID:0,g_hdHelpSeq:0,g_hdMarchPhase:7,
        g_hdTransferProtocolVersion:1,g_hdTransferActive:1,g_hdTransferCommand:command,g_hdTransferSession:17,
        g_hdTransferInputSeq:80,g_hdTransferPhase:phase,g_hdTransferOrigin:0,g_hdTransferTarget:255,
        g_hdTransferPerson:command===14&&[5,6].includes(phase)?65535:19,g_hdTransferFood:2,g_hdTransferMoney:2,g_hdTransferArms:2,
        g_hdTransferDistance:255,g_hdTransferCommitSeq:0,g_hdTransferCommitResult:0});
    f.raw.g_Cities=Array.from({length:38},()=>({Belong:1,State:0,Persons:3,PersonQueue:0,Food:100,Money:200,MothballArms:300}));
    f.raw.g_CityPos={setx:0,sety:0};f.env.baye.hdCityLimit=()=>38;
    f.env.BayeHdOverworld.getCities=()=>Array.from({length:38},(_,index)=>({index,engX:index%10,engY:Math.floor(index/10)}));
    f.env.baye.hd.transfer=()=>{const value={};for(const suffix of ['ProtocolVersion','Active','Command','Session','InputSeq','Phase','Origin','Target',
        'Person','Food','Money','Arms','Distance','CommitSeq','CommitResult'])value[suffix[0].toLowerCase()+suffix.slice(1)]=f.raw['g_hdTransfer'+suffix];
        if(transferHook)transferHook(value);return value;};
    f.setMenuHook(menu=>{menu.ids=ids.slice();menu.idsValid=menu.kind===3;});
    f.env.bayeQtyNativeClosed=()=>false;f.env.bayeQtyCloseInput=()=>{};
    function publish(nextPhase,{active=1}={}) {
        Object.assign(f.raw,{g_hdTransferPhase:nextPhase,g_hdTransferActive:active,
            g_hdMapPick:nextPhase===6||nextPhase===9?1:0,g_hdBattlePick:0,
            g_hdMenuActive:nextPhase===1?1:0,g_hdMenuContext:nextPhase===1?1:0,g_hdMenuKind:nextPhase===1?3:0,
            g_hdMenuCount:nextPhase===1?names.length:0,g_hdMenuIndex:0,g_hdQtyActive:nextPhase>=2&&nextPhase<=4?1:0,
            g_hdReportActive:[5,7,8].includes(nextPhase)?1:0,g_hdReportSeq:20,g_hdReportInputSeq:30,
            g_hdReportKind:nextPhase===7?1:2,g_hdReportPerson:nextPhase===7?65535:nextPhase===5&&command===14?0:f.raw.g_hdTransferPerson});
        f.names.splice(0,f.names.length,...(nextPhase===1?names:[]));
        if(nextPhase>=2&&nextPhase<=4)Object.assign(f.raw,{g_hdQtyReady:1,g_hdQtySession:f.raw.g_hdQtySession+1,
            g_hdQtyInputSeq:0,g_hdQtyLastKey:65535,g_hdQtyMin:0,g_hdQtyMax:{2:100,3:200,4:300}[nextPhase],
            g_hdQtyValue:{2:100,3:200,4:300}[nextPhase]});
    }
    function advance(nextPhase,options){f.raw.g_hdTransferInputSeq++;f.raw.g_hdMenuSeq++;publish(nextPhase,options);f.internals.syncTransfer();f.internals.fill();}
    publish(phase);f.internals.isolatePreview();const dom=marchDom(f,{rooted:true});f.internals.bind();
    assert.equal(f.internals.syncTransfer(),true);f.internals.fill();
    return Object.assign(f,{dom,publish,advance,setTransferHook(fn){transferHook=fn;},setIds(value){ids=value;}});
}
for(const command of [13,14])test('transfer original protocol adopts a real PERSON picker without a BattleMake owner: '+command,()=>{
    const f=transferFixture(command),t=f.api.getInputTicket();
    assert.equal(t.ownerType,'transfer-person');assert.equal(t.command,command);assert.equal(t.phase,1);
    assert.equal(f.state.deepKind,'person-transfer');assert.equal(f.state.deepLabel,command===13?'输送':'移动');
    assert.equal(t.data,f.env.baye.data);assert.equal(Object.keys(t).includes('data'),false);
    assert.equal(f.raw.g_hdMarchPhase,7);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
for(const phase of [2,3,4])test('transfer real CITY/mobile-host exclusively presents quantity phase '+phase,()=>{
    const f=transferFixture(13,phase),host=tradeMobileHost(f),t=f.api.getInputTicket();
    assert.equal(t.ownerType,'transfer-qty');assert.equal(f.api.getTransferDialogTicket().key,t.key);
    assert.equal(f.api.getLcdPresentation(),'off');assert.equal(host.refresh().cityVisible,true);
    assert.equal(host.readInputTicket('city').ticket.ownerType,'transfer-qty');
    assert.equal(f.dom.byId('hd-city-qty-val').textContent,String(f.raw.g_hdQtyValue));
    assert.equal(f.api.getTransferPresentation().title,{2:'输送粮草',3:'输送金钱',4:'输送后备兵'}[phase]);
    f.raw.g_hdQtyMax--;assert.equal(f.api.getInputTicket(),null);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
for(const command of [13,14])for(const phase of [5,7,8])test('transfer current native report and single acknowledgement: '+command+'/'+phase,()=>{
    const f=transferFixture(command,phase),host=tradeMobileHost(f);
    assert.equal(f.api.getInputTicket().ownerType,'transfer-report');assert.equal(host.refresh().cityVisible,true);
    assert.ok(f.dom.find('data-hd-transfer-continue'));assert.equal(f.internals.continueTransfer(),true);
    assert.equal(f.internals.continueTransfer(),false);assert.deepEqual(f.keys,[39]);assert.deepEqual(f.writes,[]);
});
test('transfer full-order MSGBOX during phase8 remains a real report, never a fabricated departure',()=>{
    const f=transferFixture(13,8);Object.assign(f.raw,{g_hdReportKind:1,g_hdReportPerson:65535});
    assert.equal(f.api.getInputTicket().ownerType,'transfer-report');assert.equal(f.api.getTransferPresentation().commitResult,0);
    f.raw.g_hdReportPerson=19;assert.equal(f.api.getInputTicket(),null);
});
test('a later full-order MSGBOX in the same departure phase has its own actual report receipt',()=>{
    const f=transferFixture(13,8);assert.equal(f.internals.continueTransfer(),true);
    Object.assign(f.raw,{g_hdReportKind:1,g_hdReportPerson:65535,
        g_hdReportSeq:f.raw.g_hdReportSeq+2,g_hdReportInputSeq:f.raw.g_hdReportInputSeq+2});
    assert.equal(f.internals.continueTransfer(),true);assert.equal(f.internals.continueTransfer(),false);
    assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
});
for(const phase of [2,3,4,5,7,8])test('real CITY and generic dialog yield to the same complete transfer owner at phase '+phase,()=>{
    const f=transferFixture(13,phase);f.env.baye.hd.reportText=()=>f.env.baye.hd.report().text;
    vm.runInNewContext(fs.readFileSync(new URL('../js/hd-dialog.js',import.meta.url),'utf8'),f.env,{filename:'js/hd-dialog.js'});
    const dialog=f.env.BayeHdDialog;dialog.configureMobileHost({isAvailable:()=>true});
    if(phase<=4)assert.equal(dialog.openQty({min:0,max:f.raw.g_hdQtyMax,init:f.raw.g_hdQtyValue}),false);
    else dialog.onEngineReport();
    dialog.poll();assert.ok(f.api.getTransferDialogTicket());assert.equal(dialog.isOpen(),false);
    assert.equal(dialog.getInputTicket(),null);assert.equal(dialog.isActive(),false);
    assert.equal(f.api.getLcdPresentation(),'off');assert.equal(tradeMobileHost(f).refresh().cityVisible,true);
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('MOVE selects only through real Arrow ACKs and resumes the fresh PERSON after departure',()=>{
    const f=transferFixture(14,1);f.setAfterKey(key=>{
        if(key===35)f.env.setTimeout(()=>{f.raw.g_hdMenuIndex++;},60);
        if(key===39)f.env.setTimeout(()=>{f.raw.g_hdTransferPerson=19;f.advance(8);},60);
    });
    f.internals.chooseDeep(1);assert.deepEqual(f.keys,[35]);f.tick(600);
    assert.deepEqual(f.keys,[35,39]);assert.equal(f.api.getInputTicket().ownerType,'transfer-report');
    f.setAfterKey(key=>{if(key===39)f.env.setTimeout(()=>{
        f.advance(1);f.setIds([0,20]);f.names.splice(0,f.names.length,'董卓','吕布');f.raw.g_hdMenuCount=2;
        f.internals.fill();},60);});
    assert.equal(f.internals.continueTransfer(),true);f.tick(200);
    assert.equal(f.api.getInputTicket().ownerType,'transfer-person');assert.deepEqual(Array.from(f.env.baye.hd.menuItems().ids),[0,20]);
    assert.deepEqual(f.keys,[35,39,39]);assert.deepEqual(f.writes,[]);
});
test('MOVE PERSON selection cannot continue after an Arrow ACK retires its current owner',()=>{
    const f=transferFixture(14,1);f.setAfterKey(key=>{if(key===35){f.raw.g_hdMenuIndex++;f.api.retireInteraction('blur');}});
    f.internals.chooseDeep(2);f.tick(1000);assert.deepEqual(f.keys,[35]);assert.deepEqual(f.writes,[]);
});
for(const command of [13,14])test('transfer target derives same-faction connected destinations and does not send a key on selection: '+command,()=>{
    const f=transferFixture(command,6),t=f.api.getTransferTargetTicket(),before=JSON.stringify(f.raw);
    assert.ok(t.targets.length>0);assert.ok(!t.targets.includes(0));
    const addr=originalLib.readUInt32LE(58*4),direct=Array.from(originalLib.subarray(addr+14,addr+22)).filter(id=>id>=1&&id<=38).map(id=>id-1);
    assert.ok(t.targets.some(id=>!direct.includes(id)),'connected paths include a nonadjacent friendly city');
    assert.equal(f.api.selectTransferTarget(t.targets[0],t),true);assert.equal(JSON.stringify(f.raw),before);
    assert.equal(f.api.getTransferPresentation().pendingTarget,t.targets[0]);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    f.internals.fill();const current=f.dom.find('data-hd-transfer-cancel');f.internals.fill();f.internals.fill();
    assert.equal(f.dom.find('data-hd-transfer-cancel'),current,'poll preserves same-owner buttons');
});
test('transfer target cannot select origin, enemy, isolated city, old data or old ticket',()=>{
    for(const kind of ['origin','enemy','isolated','data','seq','generation']){
        const f=transferFixture(13,6),old=f.api.getTransferTargetTicket(),index=old.targets[0];
        if(kind==='enemy')f.raw.g_Cities[index].Belong=2;
        if(kind==='isolated')for(let i=1;i<38;i++)f.raw.g_Cities[i].Belong=2;
        if(kind==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('write');}});
        if(kind==='seq')f.raw.g_hdTransferInputSeq++;
        if(kind==='generation')f.setIdentity({...f.identity(),generation:2});
        assert.equal(f.api.selectTransferTarget(kind==='origin'?0:index,old),false,kind);
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('transfer target final ENTER follows each actual cursor ACK and fires once',()=>{
    const f=transferFixture(13,6),ticket=f.api.getTransferTargetTicket(),index=ticket.targets[0],to={x:index%10,y:Math.floor(index/10)};
    f.setAfterKey(code=>{if(code===39)return;const pos=f.raw.g_CityPos;
        if(code===34)pos.sety--;if(code===35)pos.sety++;if(code===36)pos.setx--;if(code===37)pos.setx++;
        f.raw.g_hdMapCity=pos.setx===to.x&&pos.sety===to.y?index+1:0;});
    f.api.selectTransferTarget(index,ticket);assert.equal(f.api.confirmTransferTarget(index,ticket),true);f.tick(4000);
    assert.equal(f.keys.filter(key=>key===39).length,1);assert.equal(f.keys.at(-1),39);
    assert.equal(f.api.confirmTransferTarget(index),false);assert.deepEqual(f.writes,[]);
});
for(const change of ['hidden','classic','retire','data','inputSeq','targetBelong'])test('transfer cursor queue stops at an actual ACK boundary: '+change,()=>{
    const f=transferFixture(14,6),ticket=f.api.getTransferTargetTicket(),index=ticket.targets[0];
    f.setAfterKey(code=>{if(code===39)return;f.raw.g_CityPos.setx++;
        if(change==='hidden')f.env.document.hidden=true;
        if(change==='classic')f.api.setMode('classic');
        if(change==='retire')f.api.retireInteraction('pointercancel');
        if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
        if(change==='inputSeq')f.raw.g_hdTransferInputSeq++;
        if(change==='targetBelong')f.raw.g_Cities[index].Belong=2;});
    f.api.selectTransferTarget(index,ticket);f.api.confirmTransferTarget(index,ticket);f.tick(9000);
    assert.equal(f.keys.length,1);assert.ok(!f.keys.includes(39));assert.deepEqual(f.writes,[]);
});
for(const change of ['protocol','phase','command','rawMismatch','torn','menu','qty','report','battle','library'])test('transfer current owner rejects '+change,()=>{
    const f=transferFixture(13,6);
    if(change==='protocol')f.raw.g_hdTransferProtocolVersion=2;
    if(change==='phase')f.raw.g_hdTransferPhase=10;
    if(change==='command')f.raw.g_hdTransferCommand=27;
    if(change==='rawMismatch')f.setTransferHook(value=>value.origin=1);
    if(change==='torn')f.setTransferHook(()=>f.raw.g_hdTransferInputSeq++);
    if(change==='menu')f.raw.g_hdMenuActive=1;
    if(change==='qty')f.raw.g_hdQtyActive=1;
    if(change==='report')f.raw.g_hdReportActive=1;
    if(change==='battle')f.raw.g_hdBattlePick=1;
    if(change==='library')f.setIdentity({...f.identity(),sha256:'f'.repeat(64)});
    assert.equal(f.api.getTransferTargetTicket(),null);assert.equal(f.api.selectTransferTarget(1),false);
    assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('transfer cancellation keeps native rollback authoritative for all three quantities and target',()=>{
    const f=transferFixture(13,6);f.setAfterKey(key=>{if(key===40)f.env.setTimeout(()=>f.advance(f.raw.g_hdTransferPhase===6?4:f.raw.g_hdTransferPhase-1),60);});
    f.api.cancelTransfer();f.tick(80);assert.equal(f.api.getTransferPresentation().phase,4);
    f.api.cancelTransfer();f.tick(80);assert.equal(f.api.getTransferPresentation().phase,3);
    f.api.cancelTransfer();f.tick(80);assert.equal(f.api.getTransferPresentation().phase,2);
    f.api.cancelTransfer();f.tick(80);assert.equal(f.api.getTransferPresentation().phase,1);
    assert.deepEqual(f.keys,[40,40,40,40]);assert.deepEqual(f.writes,[]);
});
test('transfer DONE retires only after fresh MAP and generic overlay retirement without another key',()=>{
    const f=transferFixture(13,8);let open=true;f.env.BayeHdDialog={isOpen:()=>open};
    f.advance(9,{active:0});f.raw.g_hdMapInputSeq++;f.internals.syncTransfer();
    assert.equal(f.state.open,true);assert.equal(f.api.getInputTicket(),null);
    open=false;f.internals.syncTransfer();assert.equal(f.state.open,false);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
test('transfer mode and lifecycle restoration observes the fresh native phase without replaying delivered input',()=>{
    const f=transferFixture(14,8);assert.equal(f.internals.continueTransfer(),true);
    f.api.retireInteraction('blur');f.api.setMode('classic');assert.equal(f.api.getInputTicket(),null);
    f.api.setMode('hd');f.internals.syncTransfer();assert.equal(f.internals.continueTransfer(),false);
    f.advance(1);assert.equal(f.api.getInputTicket().ownerType,'transfer-person');assert.deepEqual(f.keys,[39]);assert.deepEqual(f.writes,[]);
});

// ExchangeMake's actual PERSON -> dedicated EXCHANGE -> GetFood lifecycle.
// Timer-controlled publications model C's gaps; every sent key uses real code.
function tradeFixture({phase=0,seq=10,sourceText=tradeSource}={}) {
    const f=fixture({marchState:true,sourceText});f.configure();f.state=f.internals.state;
    const people={names:['董卓','李儒','吕布'],ids:[0,19,20]}, subNames=
        ['开垦','招商','搜寻','治理','出巡','招降','处斩','流放','赏赐','没收','交易','宴请','输送','移动'];
    const next=n=>n===0xffffffff?1:n+1;
    let ids=[],deferred=null,actor=0,direction=0;
    Object.assign(f.raw,{g_asyncActionID:0,g_hdMarchPhase:phase,g_hdQtySession:3});
    Object.assign(f.raw.g_Cities[0],{Money:500,Food:80});
    f.env.bayeQtyNativeClosed=()=>false;f.env.bayeQtyCloseInput=()=>{};
    f.setMenuHook(menu=>{menu.ids=ids.slice();menu.idsValid=menu.kind===3||menu.kind===4;});
    function publish(kind,menuSeq,index=0,list=null){
        const items=list||(kind===2?{names:subNames,ids:[]}:kind===3?people:
            kind===5?{names:['买入','卖出'],ids:[]}:{names:[],ids:[]});
        f.names.splice(0,f.names.length,...items.names);ids=items.ids.slice();
        Object.assign(f.raw,{g_hdMenuActive:kind?1:0,g_hdMenuContext:kind?1:0,g_hdMenuKind:kind,
            g_hdMenuSeq:menuSeq,g_hdMenuCount:items.names.length,g_hdMenuIndex:index});
    }
    function later(fn){if(deferred)deferred(fn);else f.env.setTimeout(fn,60);}
    function map(menuSeq){publish(0,menuSeq);Object.assign(f.raw,{g_hdQtyActive:0,g_hdQtyReady:0,
        g_hdMapPick:1,g_hdMapInputSeq:next(f.raw.g_hdMapInputSeq),g_hdGoodsActive:0,g_hdPersonPropertiesActive:0});}
    function quantity(menuSeq){publish(0,menuSeq);const max=direction===0?Math.floor(f.raw.g_Cities[0].Money/5):f.raw.g_Cities[0].Food;
        Object.assign(f.raw,{g_hdQtyActive:1,g_hdQtyReady:1,g_hdQtySession:next(f.raw.g_hdQtySession),
            g_hdQtyInputSeq:0,g_hdQtyLastKey:65535,g_hdQtyStep:1,g_hdQtyMin:1,g_hdQtyMax:max,g_hdQtyValue:max});}
    function consume(key){
        const kind=f.raw.g_hdMenuKind,current=f.raw.g_hdMenuSeq;
        if(key===34||key===35){f.raw.g_hdMenuIndex+=key===34?-1:1;return;}
        if(key===39&&kind===2){publish(0,next(current));later(()=>publish(3,next(next(current))));}
        else if(key===39&&kind===3){actor=people.ids[f.raw.g_hdMenuIndex];publish(0,next(current));later(()=>publish(5,next(next(current))));}
        else if(key===39&&kind===5){direction=f.raw.g_hdMenuIndex;publish(0,next(current));later(()=>quantity(next(current)));}
        else if(key===40&&kind===5){publish(0,next(current));later(()=>publish(3,next(next(current))));}
        else if(key===40&&kind===3){publish(0,next(current));later(()=>map(next(current)));}
        else if((key===39||key===40)&&f.raw.g_hdQtyActive){f.raw.g_hdQtyActive=0;f.raw.g_hdQtyReady=0;
            later(()=>key===39?map(current):publish(3,next(current)));}
    }
    publish(2,seq,10);Object.assign(f.state,{open:true,layer:'sub',cityIndex:0,subKind:'neizheng',deepKind:'',
        deepStep:0,deepLabel:'',wizardStep:'none',battleMake:false});
    f.internals.isolatePreview();const dom=marchDom(f,{rooted:true});f.internals.bind();f.setAfterKey(consume);
    f.internals.chooseSub(10);f.tick(80);f.internals.fill();
    function all(attr,value=dom.list,out=[]){if(value.getAttribute(attr)!==null)out.push(value);for(const child of value.children)all(attr,child,out);return out;}
    function event(target){return {target,detail:1,isPrimary:true,button:0,pointerId:7,preventDefault(){},stopPropagation(){}};}
    function press(index){const b=all('data-hd-deep')[index];assert.ok(b,'published native choice');
        dom.root.emit('pointerdown',event(b));dom.root.emit('click',event(b));return b;}
    return Object.assign(f,{dom,people,publish,map,quantity,consume,all,event,press,next,
        actor(){return actor;},setDeferred(fn){deferred=fn;},back(){f.internals.back(f.internals.backOwner());},
        choosePerson(index=0){press(index);f.tick(200);f.internals.fill();},
        chooseType(index=0){press(index);f.tick(200);f.internals.fill();}});
}

function tradeMobileHost(f) {
    // Use the complete shared CITY and actual mobile host together. The
    // earlier trade fixture only observed the native/input receipt, which
    // cannot prove the host will reveal that receipt's presentation.
    f.raw.g_hdHelpSeq=0;
    vm.runInNewContext(fs.readFileSync(new URL('../js/hd-mobile-city.js',import.meta.url),'utf8'),
        f.env,{filename:'js/hd-mobile-city.js'});
    return f.env.BayeHdMobileCity.createController(f.env);
}

for(const phase of [0,7])test('trade real mobile host displays authenticated EXCHANGE without a PERSON property page: '+phase,()=>{
    const f=tradeFixture({phase});f.choosePerson(2);
    assert.equal(f.env.baye.hd.personProperties,undefined);
    const host=tradeMobileHost(f),before=JSON.stringify(f.raw),keys=f.keys.slice();
    assert.equal(f.api.getTradePresentation().stage,'exchange');
    assert.equal(f.api.getLcdPresentation(),'off');assert.equal(f.api.isActive(),true);
    const shown=host.refresh(),ticket=host.readInputTicket('city');
    assert.equal(shown.active,true);assert.equal(shown.cityVisible,true);
    assert.equal(shown.dialogVisible,false);assert.equal(shown.lcdPresentation,'off');
    assert.equal(ticket.ticket.ownerType,'city');assert.equal(ticket.ticket.menuKind,5);
    assert.equal(ticket.data,f.env.baye.data);assert.equal(ticket.native.menu.count,2);
    assert.deepEqual(Array.from(ticket.native.menu.names),['买入','卖出']);
    assert.equal(JSON.stringify(f.raw),before);assert.deepEqual(f.keys,keys);assert.deepEqual(f.writes,[]);
});
test('trade PERSON presentation still requires its actual native property page',()=>{
    const f=tradeFixture(),host=tradeMobileHost(f);
    assert.equal(f.api.getTradePresentation().stage,'person');
    assert.equal(f.api.getInputTicket().menuKind,3);assert.equal(f.api.getLcdPresentation(),'on');
    assert.equal(f.api.isActive(),false);assert.equal(host.refresh().cityVisible,false);
    assert.deepEqual(f.keys,[39]);assert.deepEqual(f.writes,[]);
});
for(const problem of ['no-lineage','wrong-kind','context0','count','empty-name','seq','data','generation','library','report','help','fight','torn'])
test('trade real mobile host cannot reveal a foreign or incomplete EXCHANGE: '+problem,()=>{
    const f=tradeFixture();f.choosePerson();const host=tradeMobileHost(f),keys=f.keys.slice();
    if(problem==='no-lineage')f.state.deepKind='person';
    if(problem==='wrong-kind')f.raw.g_hdMenuKind=4;
    if(problem==='context0')f.raw.g_hdMenuContext=0;
    if(problem==='count')f.raw.g_hdMenuCount=3;
    if(problem==='empty-name')f.names[0]='';
    if(problem==='seq')f.raw.g_hdMenuSeq++;
    if(problem==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
    if(problem==='generation')f.raw.g_hdDetailGeneration++;
    if(problem==='library')f.setIdentity({...f.identity(),sha256:'0'.repeat(64)});
    if(problem==='report')f.raw.g_hdReportActive=1;
    if(problem==='help')f.raw.g_hdHelpActive=1;
    if(problem==='fight')f.raw.g_hdFightActive=1;
    if(problem==='torn')f.setMenuHook(()=>{f.raw.g_hdMenuSeq++;});
    assert.equal(f.api.isActive(),false);assert.equal(host.refresh().cityVisible,false);
    assert.equal(host.readInputTicket('city'),null);
    assert.deepEqual(f.keys,keys);assert.deepEqual(f.writes,[]);
});

test('trade original PERSON Enter publishes only the dedicated actual EXCHANGE list',()=>{
    const f=tradeFixture();assert.equal(f.state.deepKind,'person-trade');assert.equal(f.state.deepStep,0);
    f.choosePerson(2);const p=f.api.getTradePresentation(),t=f.api.getInputTicket();
    assert.equal(p.stage,'exchange');assert.equal(p.personId,20);assert.equal(p.personName,'吕布');
    assert.equal(t.menuContext,1);assert.equal(t.menuKind,5);assert.equal(t.menuSeq,14);
    assert.deepEqual(f.all('data-hd-deep').map(n=>n.textContent),['买入','卖出']);
    assert.equal(f.all('data-hd-deep-preview').length,0);
    assert.equal(f.all('data-hd-deep').every(n=>n.getAttribute('data-hd-deep-pind')===null&&n.getAttribute('data-hd-deep-tool')===null),true);
    assert.deepEqual(f.keys,[39,35,35,39]);assert.deepEqual(f.writes,[]);
});
for(const phase of [0,7])for(const direction of [0,1])test('trade '+phase+'/'+direction+' binds one fresh native quantity, actor and current resources',()=>{
    const f=tradeFixture({phase});f.choosePerson(1);f.chooseType(direction);const p=f.api.getTradePresentation();
    assert.equal(p.stage,'quantity');assert.equal(p.direction,direction?'sell':'buy');assert.equal(p.personId,19);
    assert.equal(p.personName,'李儒');assert.equal(p.cityIndex,0);assert.equal(p.cityName,'城0');
    assert.equal(p.money,500);assert.equal(p.food,80);assert.equal(p.unitPrice,direction?2:5);
    assert.equal(p.session,4);assert.equal(p.inputSeq,0);assert.equal(p.min,1);assert.equal(p.max,direction?80:100);
    assert.equal(p.data,f.env.baye.data);assert.equal(Object.keys(p).includes('data'),false);assert.ok(Object.isFrozen(p));
    assert.deepEqual(f.writes,[]);
});
test('trade type cancellation sends one EXIT and waits fresh PERSON index0',()=>{
    const f=tradeFixture();f.choosePerson(2);const old=f.all('data-hd-deep')[1];f.back();f.back();
    assert.equal(f.api.getInputTicket(),null);assert.equal(f.state.deepStep,1);
    f.dom.root.emit('pointerdown',f.event(old));f.dom.root.emit('click',f.event(old));f.tick(80);f.internals.fill();
    assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.kind,3);assert.equal(f.state.deepMenuOwner.seq,16);
    assert.equal(f.raw.g_hdMenuIndex,0);assert.deepEqual(f.keys,[39,35,35,39,40]);assert.deepEqual(f.writes,[]);
});
for(const direction of [0,1])test('trade quantity cancellation returns PERSON while confirmation retires to actual MAP: '+direction,()=>{
    const f=tradeFixture();f.choosePerson();f.chooseType(direction);f.internals.cancelQty();f.tick(80);f.internals.fill();
    assert.equal(f.state.deepStep,0);assert.equal(f.state.deepMenuOwner.kind,3);assert.equal(f.raw.g_hdMenuIndex,0);
    assert.equal(f.api.getTradePresentation().personId,null);f.choosePerson();f.chooseType(direction);
    f.internals.commitQty(true);f.tick(400);assert.equal(f.raw.g_hdMapPick,1);assert.equal(f.state.open,false);
    assert.equal(f.api.getTradePresentation(),null);assert.equal(f.state.deepKind,'');assert.equal(f.raw.g_hdReportActive,0);
    assert.equal(f.keys.filter(k=>k===40).length,1);assert.deepEqual(f.writes,[]);
});
test('trade outer PERSON cancellation retires only on its exact native MAP successor without another EXIT',()=>{
    const f=tradeFixture();f.back();f.tick(80);assert.equal(f.state.open,false);
    assert.deepEqual(f.keys,[39,40]);assert.deepEqual(f.writes,[]);
});
for(const seq of [0xfffffffb,0xfffffffc,0xfffffffd,0xfffffffe,0xffffffff])test('trade menu continuation follows nonzero U32 wrap: '+seq,()=>{
    const f=tradeFixture({seq});f.choosePerson();f.back();f.tick(80);f.internals.fill();
    assert.equal(f.state.deepMenuOwner.seq,Array.from({length:6}).reduce(n=>f.next(n),seq));
    assert.equal(f.state.deepStep,0);assert.deepEqual(f.keys,[39,39,40]);
});
for(const problem of ['missing-lineage','wrong-kind','context0','count','empty-name','wrong-seq','data','generation','library','report','help','fight','torn'])
test('trade EXCHANGE refuses foreign/partial ownership: '+problem,()=>{
    const f=tradeFixture();f.choosePerson();const old=f.all('data-hd-deep')[0],n=f.keys.length;
    if(problem==='missing-lineage'){f.state.deepKind='person';}
    if(problem==='wrong-kind')f.raw.g_hdMenuKind=4;
    if(problem==='context0')f.raw.g_hdMenuContext=0;
    if(problem==='count')f.raw.g_hdMenuCount=3;
    if(problem==='empty-name')f.names[0]='';
    if(problem==='wrong-seq')f.raw.g_hdMenuSeq++;
    if(problem==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
    if(problem==='generation')f.raw.g_hdDetailGeneration++;
    if(problem==='library')f.setIdentity({...f.identity(),sha256:'0'.repeat(64)});
    if(problem==='report')f.raw.g_hdReportActive=1;
    if(problem==='help')f.raw.g_hdHelpActive=1;
    if(problem==='fight')f.raw.g_hdFightActive=1;
    if(problem==='torn')f.setMenuHook(()=>{f.raw.g_hdMenuSeq++;});
    assert.equal(f.api.getTradePresentation(),null,problem);
    f.dom.root.emit('pointerdown',f.event(old));f.dom.root.emit('click',f.event(old));f.tick(80);
    assert.equal(f.keys.length,n,problem);assert.deepEqual(f.writes,[]);
});
for(const problem of ['not-ready','same-session','min','max','wrong-seq','resources','name-reentry'])
test('trade quantity refuses stale session, bounds or torn resources: '+problem,()=>{
    const f=tradeFixture();f.choosePerson();
    if(problem==='same-session'){f.setDeferred(fn=>f.env.setTimeout(()=>{fn();f.raw.g_hdQtySession=3;},60));}
    f.chooseType();const n=f.keys.length;
    if(problem==='not-ready')f.raw.g_hdQtyReady=0;
    if(problem==='min')f.raw.g_hdQtyMin=0;
    if(problem==='max')f.raw.g_hdQtyMax--;
    if(problem==='wrong-seq')f.raw.g_hdMenuSeq++;
    if(problem==='resources')f.raw.g_Cities[0].Money=-1;
    if(problem==='name-reentry')f.env.baye.getCityName=()=>{f.raw.g_Cities[0].Money++;return '城0';};
    assert.equal(f.api.getTradePresentation(),null,problem);f.internals.commitQty(true);assert.equal(f.keys.length,n,problem);
    assert.deepEqual(f.writes,[]);
});
for(const boundary of ['blur','resize','orientationchange','pagehide','hidden','classic'])test('trade retires old controls on lifecycle/mode boundary: '+boundary,()=>{
    const f=tradeFixture();f.choosePerson();const old=f.all('data-hd-deep')[0],n=f.keys.length;
    f.dom.root.emit('pointerdown',f.event(old));
    if(boundary==='hidden'){f.env.document.hidden=true;f.emitDocument('visibilitychange');}
    else if(boundary==='classic')f.api.setMode('classic');else f.emit(boundary);
    f.dom.root.emit('click',f.event(old));f.tick(80);assert.equal(f.keys.length,n);assert.deepEqual(f.writes,[]);
});
test('trade native rejection report keeps only report input and resumes its complete fresh PERSON list',()=>{
    const f=tradeFixture();f.setDeferred(()=>{Object.assign(f.raw,{g_hdReportActive:1,g_hdReportKind:1,
        g_hdReportPerson:65535,g_hdReportSeq:1,g_hdReportInputSeq:1});});
    f.press(0);f.tick(8000);assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.getTradePresentation(),null);
    f.raw.g_hdReportActive=0;f.publish(3,14,0);f.tick(80);f.internals.fill();
    assert.equal(f.state.deepStep,0);assert.equal(f.api.getTradePresentation().stage,'person');
    assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
});
test('trade never authorizes an anonymous EXCHANGE or applies its new path to PC/Mod',()=>{
    for(const problem of ['no-command','PC','Mod']){
        const f=fixture({marchState:true});if(problem!=='PC')f.configure();else f.stored.set('baye/cityMenuMode','hd');
        if(problem==='Mod')f.setIdentity({...f.identity(),sha256:'0'.repeat(64)});
        Object.assign(f.raw,{g_hdMenuContext:1,g_hdMenuKind:5,g_hdMenuCount:2});f.names.splice(0,f.names.length,'买入','卖出');
        assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.getTradePresentation(),null);assert.deepEqual(f.keys,[]);
    }
});
for(const direction of [0,1])test('trade real CITY/dialog modules paint the actual quantity purpose and drop stale context: '+direction,()=>{
    const f=tradeFixture();f.choosePerson(2);f.chooseType(direction);const h=distributionDialog(f);h.paint();
    const body=h.nodes['hd-dialog-body'];assert.equal(h.nodes['hd-dialog-title'].textContent,direction?'卖出粮草':'买入粮草');
    assert.equal(body.getAttribute('data-hd-quantity-purpose'),'trade');
    assert.match(body.textContent,/城0 · 吕布/);assert.match(body.textContent,/城内钱 500 · 粮 80/);
    assert.ok(body.textContent.includes('每粮 '+(direction?2:5)+' 钱'));
    assert.ok(body.textContent.includes('当前 '+(direction?80:100)+'（1–'+(direction?80:100)+'）'));
    f.raw.g_hdQtySession++;h.paint();assert.equal(h.nodes['hd-dialog-title'].textContent,'数量');
    assert.equal(body.getAttribute('data-hd-quantity-purpose'),'');assert.doesNotMatch(body.textContent,/吕布|每粮|买入|卖出/);
    assert.deepEqual(f.writes,[]);
});
for(const stage of ['person','exchange','quantity'])test('trade mode boundary restores only the same current '+stage+' owner with a new gesture',()=>{
    const f=tradeFixture();if(stage!=='person')f.choosePerson();if(stage==='quantity')f.chooseType();
    const n=f.keys.length,p=f.api.getTradePresentation();assert.equal(p.stage,stage);
    f.api.setMode('classic');assert.equal(f.api.getTradePresentation(),null);assert.equal(f.api.getInputTicket(),null);
    f.api.setMode('hd');f.internals.fill();assert.equal(f.api.getTradePresentation().stage,stage);
    assert.equal(f.state.deepKind,'person-trade');assert.equal(f.state.open,true);assert.equal(f.keys.length,n);
    assert.deepEqual(f.writes,[]);
});
test('trade delayed kind5 publication cannot use old PERSON buttons or accept a half-published list',()=>{
    const f=tradeFixture(),old=f.all('data-hd-deep')[0];let release;
    f.setDeferred(fn=>{release=fn;});f.press(0);f.tick(80);assert.equal(f.api.getInputTicket(),null);
    f.dom.root.emit('pointerdown',f.event(old));f.dom.root.emit('click',f.event(old));f.back();
    assert.deepEqual(f.keys,[39,39]);release();f.names.pop();f.tick(80);assert.equal(f.api.getInputTicket(),null);
    f.names.push('卖出');f.tick(80);f.internals.fill();assert.equal(f.api.getTradePresentation().stage,'exchange');
    assert.deepEqual(f.keys,[39,39]);assert.deepEqual(f.writes,[]);
});
for(const change of ['seq','ids','data','generation'])test('trade cancelled selector never revives a foreign PERSON successor: '+change,()=>{
    const f=tradeFixture();f.choosePerson();let release;f.setDeferred(fn=>{release=fn;});f.back();
    release();if(change==='seq')f.raw.g_hdMenuSeq++;
    if(change==='ids')f.setMenuHook(menu=>{menu.ids=[0,20,19];});
    if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
    if(change==='generation')f.raw.g_hdDetailGeneration++;
    f.tick(80);f.internals.fill();assert.equal(f.api.getTradePresentation(),null);assert.equal(f.api.getInputTicket(),null);
    assert.deepEqual(f.keys,[39,39,40]);assert.deepEqual(f.writes,[]);
});
test('trade Arrow acknowledgement stops before the next key or ENTER when its owner retires',()=>{
    for(const change of ['hidden','retire','data','seq']){
        const f=tradeFixture();f.setAfterKey(key=>{if(key!==35)return;f.raw.g_hdMenuIndex++;
            if(change==='hidden')f.env.document.hidden=true;
            if(change==='retire')f.api.retireInteraction('pointercancel');
            if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
            if(change==='seq')f.raw.g_hdMenuSeq++;});
        f.press(2);f.tick(500);assert.deepEqual(f.keys,[39,35],change);assert.deepEqual(f.writes,[]);
    }
});

for(const direction of [0,1])test('trade real dialog confirmation waits for its shell after native MAP has already published: '+direction,()=>{
    const f=tradeFixture();f.choosePerson(2);f.chooseType(direction);
    const h=distributionDialog(f);h.paint();assert.equal(h.api.isOpen(),true);
    const lcd=fs.readFileSync(new URL('../js/lcd.js',import.meta.url),'utf8');
    vm.runInNewContext(lcd.slice(lcd.indexOf('function bayeQtyAckState('),lcd.indexOf('function bayeQtyKeyboardCode(')),f.env);
    const ok=f.env.document.createElement('button');ok.setAttribute('data-hd-dlg-ok','');ok.parentNode=h.nodes['hd-dialog'];
    const before=f.keys.slice();h.click(ok);f.tick(80);
    assert.equal(f.raw.g_hdMapPick,1);assert.equal(f.raw.g_hdQtyActive,0);
    assert.equal(h.api.isOpen(),true,'native MAP precedes the queued dialog retirement');
    assert.equal(f.state.open,true);assert.equal(f.api.getInputTicket(),null);
    assert.equal(f.api.getTradePresentation(),null);assert.deepEqual(f.keys,[...before,39]);
    f.tick(400);
    assert.equal(h.api.isOpen(),false);assert.equal(f.state.open,false);
    assert.equal(f.state.deepKind,'');assert.equal(f.api.getInputTicket(),null);
    assert.deepEqual(f.keys,[...before,39]);assert.deepEqual(f.writes,[]);
});
for(const change of ['map-seq','menu-seq','data','generation'])test('trade pending MAP cannot close CITY for a foreign successor after the dialog retires: '+change,()=>{
    const f=tradeFixture();f.choosePerson();f.chooseType();const h=distributionDialog(f);h.paint();
    const before=f.keys.slice();f.internals.commitQty(true);f.tick(60);
    assert.equal(f.raw.g_hdMapPick,1);assert.equal(h.api.isOpen(),true);
    if(change==='map-seq')f.raw.g_hdMapInputSeq++;
    if(change==='menu-seq')f.raw.g_hdMenuSeq++;
    if(change==='data')f.env.baye.data=new Proxy({...f.raw},{set(){throw Error('native write');}});
    if(change==='generation')f.raw.g_hdDetailGeneration++;
    f.tick(400);assert.equal(h.api.isOpen(),false);assert.equal(f.state.open,true);
    assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.getTradePresentation(),null);
    assert.deepEqual(f.keys,[...before,39]);assert.deepEqual(f.writes,[]);
});
test('trade MAP receipt keeps its original deadline while another overlay remains open',()=>{
    const f=tradeFixture();f.choosePerson();f.chooseType();const h=distributionDialog(f);h.paint();
    h.api.closeQty=()=>{};const before=f.keys.slice();f.internals.commitQty(true);f.tick(6000);
    assert.equal(f.raw.g_hdMapPick,1);assert.equal(h.api.isOpen(),true);
    assert.equal(f.state.open,true);assert.equal(f.api.getInputTicket(),null);
    h.api.close({silent:true});f.tick(400);assert.equal(f.state.open,true,'an expired receipt cannot retire a later owner');
    assert.equal(f.api.getTradePresentation(),null);assert.deepEqual(f.keys,[...before,39]);assert.deepEqual(f.writes,[]);
});

function diplomacyFixture(command=15,{phase=1,seq=10,mobile=true,pcHd=false}={}) {
    const f=fixture({marchState:true,sourceText:diplomacySource});if(mobile)f.configure();
    if(pcHd){assert.equal(mobile,false);f.stored.set('baye/cityMenuMode','hd');f.raw.g_PlayerKing=0;}
    f.state=f.internals.state;
    const actor={names:['董卓','李儒','吕布'],ids:[0,19,20]}, target={names:['敌方甲','敌方乙'],ids:[45,62]};
    if(pcHd){
        Object.assign(f.raw.g_Cities[0],{Money:500,Food:900,MothballArms:40,Persons:3,PersonQueue:0});
        f.raw.g_Persons=Array.from({length:200},(_,id)=>({Belong:actor.ids.includes(id)?1:target.ids.includes(id)?2:0,Thew:100,Arms:100,Tool1:0,Tool2:0}));
        f.raw.g_PersonsQueue=actor.ids.slice();f.raw.g_OrderQueue=[{OrderId:255,City:0,Person:0,Object:0,Money:0,Food:0,Arms:0}];
    }
    const suffixes=['ProtocolVersion','Active','Command','Phase','Session','InputSeq','Generation','Origin','Actor','Target','CommitSeq','CommitResult'];
    let ids=[],hook=null,deferred=null;
    Object.assign(f.raw,{g_asyncActionID:0,g_hdMapInputSeq:4,g_hdMenuSeq:seq,g_hdMarchPhase:7,g_hdSpeGeneration:2,g_hdHelpSeq:0,
        g_hdDiplomacyProtocolVersion:1,g_hdDiplomacyActive:1,g_hdDiplomacyCommand:command,g_hdDiplomacyPhase:phase,
        g_hdDiplomacySession:12,g_hdDiplomacyInputSeq:80,g_hdDiplomacyGeneration:2,g_hdDiplomacyOrigin:0,
        g_hdDiplomacyActor:phase===1?65535:19,g_hdDiplomacyTarget:phase===3?45:65535,
        g_hdDiplomacyCommitSeq:0,g_hdDiplomacyCommitResult:0,
        g_engineConfig:{enable16bitConsumeMoney:0,fixAlienateComsumeThew:0}});
    f.env.bayeQtyNativeClosed=()=>false;f.env.bayeQtyCloseInput=()=>{};
    f.env.baye.hd.diplomacy=()=>{const value={};for(const suffix of suffixes)
        value[suffix[0].toLowerCase()+suffix.slice(1)]=f.raw['g_hdDiplomacy'+suffix];if(hook)hook(value);return value;};
    f.setMenuHook(menu=>{menu.ids=ids.slice();menu.idsValid=menu.kind===3;});
    const next=n=>n===0xffffffff?1:n+1;
    function publish(stage,{menuSeq=f.raw.g_hdMenuSeq,index=0,complete=true,map=false}={}) {
        const items=stage===1?actor:stage===2?target:{names:[],ids:[]};
        f.names.splice(0,f.names.length,...items.names);ids=complete?items.ids.slice():[];
        Object.assign(f.raw,{g_hdDiplomacyPhase:stage,g_hdDiplomacyActive:stage===5?0:1,
            g_hdMenuActive:stage===1||stage===2?1:0,g_hdMenuContext:stage===1||stage===2?1:0,
            g_hdMenuKind:stage===1||stage===2?3:0,g_hdMenuSeq:menuSeq,g_hdMenuCount:items.names.length,g_hdMenuIndex:index,
            g_hdQtyActive:0,g_hdReportActive:stage===4?1:0,g_hdReportSeq:40,g_hdReportInputSeq:50,
            g_hdReportKind:stage===4?1:0,g_hdReportPerson:65535,g_hdMapPick:map?1:0});
        if(stage===1){f.raw.g_hdDiplomacyActor=65535;f.raw.g_hdDiplomacyTarget=65535;}
        if(map)f.raw.g_hdMapInputSeq=next(f.raw.g_hdMapInputSeq);
    }
    function advance(stage,options={}) {f.raw.g_hdDiplomacyInputSeq=next(f.raw.g_hdDiplomacyInputSeq);
        publish(stage,options);f.internals.syncDiplomacy();f.internals.fill();}
    function later(fn){if(deferred)deferred(fn);else f.env.setTimeout(fn,60);}
    function consume(key){
        if(key===34||key===35){later(()=>{f.raw.g_hdMenuIndex+=key===34?-1:1;});return;}
        const stage=f.raw.g_hdDiplomacyPhase,old=f.raw.g_hdMenuSeq,index=f.raw.g_hdMenuIndex;
        if(key!==39&&key!==40)return;
        Object.assign(f.raw,{g_hdMenuActive:0,g_hdMenuContext:0,g_hdMenuKind:0,g_hdMenuCount:0,g_hdMenuSeq:next(old)});
        f.names.splice(0);ids=[];
        if(stage===1&&key===39)later(()=>{f.raw.g_hdDiplomacyActor=actor.ids[index];advance(2,{menuSeq:next(next(old))});});
        else if(stage===2&&key===40)later(()=>advance(1,{menuSeq:next(next(old))}));
        else if(stage===2&&key===39)later(()=>{f.raw.g_hdDiplomacyTarget=target.ids[index];advance(3);
            f.raw.g_hdDiplomacyCommitSeq=next(f.raw.g_hdDiplomacyCommitSeq);f.raw.g_hdDiplomacyCommitResult=1;advance(5,{map:true});});
        else if(stage===1&&key===40)later(()=>advance(5,{map:true}));
    }
    publish(phase);Object.assign(f.state,{open:true,layer:'deep',cityIndex:0,subKind:'waijiao',deepKind:'person-diplomacy',
        deepLabel:'',deepStep:0,battleMake:false,wizardStep:'none'});
    f.internals.isolatePreview();const dom=marchDom(f,{rooted:true});f.internals.bind();f.setAfterKey(consume);
    assert.equal(typeof f.internals.syncDiplomacy,'function','current diplomacy observation integration');
    f.internals.syncDiplomacy();f.internals.fill();
    function all(attr,value=dom.list,out=[]){if(value.getAttribute(attr)!==null)out.push(value);for(const child of value.children)all(attr,child,out);return out;}
    function event(button){return {target:button,detail:1,isPrimary:true,button:0,pointerId:7,preventDefault(){},stopPropagation(){}};}
    function down(index){const button=all('data-hd-deep')[index];assert.ok(button,'complete current native PERSON button');
        dom.root.emit('pointerdown',event(button));return button;}
    function click(button){dom.root.emit('click',event(button));}
    function press(index){const button=all('data-hd-deep')[index];assert.ok(button,'complete current native PERSON button');
        const e=event(button);dom.root.emit('pointerdown',e);dom.root.emit('click',e);return button;}
    return Object.assign(f,{dom,actor,target,publish,advance,all,event,down,click,press,next,consume,
        setDiplomacyHook(fn){hook=fn;},setDeferred(fn){deferred=fn;},back(){f.internals.back(f.internals.backOwner());}});
}
for(const command of [15,16,17,19])test('diplomacy actor to target uses the actual two PERSON publications: '+command,()=>{
    const f=diplomacyFixture(command),ticket=f.api.getInputTicket(),p=f.api.getDiplomacyPresentation();
    assert.equal(ticket.ownerType,'city');assert.equal(ticket.diplomacyCommand,command);assert.equal(ticket.diplomacyPhase,1);
    assert.equal(ticket.data,f.env.baye.data);assert.equal(Object.keys(ticket).includes('data'),false);
    assert.equal(p.role,'actor');assert.deepEqual(Array.from(p.ids),f.actor.ids);assert.equal(p.moneyCost,50);
    assert.equal(p.thewCost,command===19?10:20);assert.equal(p.thewPayer,command===15?'target':'actor');
    const actorNode=f.all('data-hd-deep')[1];f.press(1);assert.deepEqual(f.keys,[35]);
    f.tick(200);const target=f.api.getDiplomacyPresentation();
    assert.deepEqual(f.keys,[35,39]);assert.equal(target.role,'target');assert.equal(target.actor,19);
    assert.deepEqual(Array.from(target.ids),f.target.ids);assert.equal(target.menuSeq,f.next(f.next(10)));
    assert.equal(f.dom.find('data-hd-diplomacy-role').getAttribute('data-hd-diplomacy-role'),'target');
    assert.equal(actorNode.isConnected,false);assert.equal(f.state.deepStep,1);assert.deepEqual(f.writes,[]);
});
for(const [command,index] of [[16,1],[17,2],[19,4]])test('diplomacy nonfirst SUB command waits for real Arrow ACK before Enter and fresh ACTOR: '+command,()=>{
    const f=diplomacyFixture();f.advance(5,{map:true});
    const seq=f.next(f.raw.g_hdMenuSeq),labels=['离间','招揽','策反','反间','劝降'];
    Object.assign(f.raw,{g_hdMapPick:0,g_hdMenuActive:1,g_hdMenuContext:1,g_hdMenuKind:2,
        g_hdMenuSeq:seq,g_hdMenuIndex:0,g_hdMenuCount:labels.length});
    f.names.splice(0,f.names.length,...labels);Object.assign(f.state,{open:true,layer:'sub',subKind:'waijiao',
        cityIndex:0,deepKind:'',deepLabel:'',deepStep:0});
    f.setAfterKey(key=>{
        if(key===35){f.env.setTimeout(()=>{f.raw.g_hdMenuIndex++;},60);return;}
        assert.equal(key,39);assert.equal(f.raw.g_hdMenuIndex,index,'Enter waits for actual selected SUB index');
        Object.assign(f.raw,{g_hdMenuActive:0,g_hdMenuContext:0,g_hdMenuKind:0,g_hdMenuCount:0,g_hdMenuSeq:f.next(seq)});
        f.names.splice(0);f.env.setTimeout(()=>{
            Object.assign(f.raw,{g_hdDiplomacySession:f.next(f.raw.g_hdDiplomacySession),g_hdDiplomacyCommand:command});
            f.advance(1,{menuSeq:f.next(f.next(seq))});
        },60);
    });
    f.internals.chooseSub(index);assert.deepEqual(f.keys,[35]);
    assert.notEqual(f.state.deepKind,'person-diplomacy','pending SUB is not an active diplomacy PERSON');
    assert.equal(f.api.getInputTicket().menuKind,2);f.tick(1000);
    assert.deepEqual(f.keys,[...Array(index).fill(35),39]);
    const p=f.api.getDiplomacyPresentation();assert.ok(p);assert.equal(p.command,command);assert.equal(p.role,'actor');
    assert.equal(p.index,0);assert.equal(f.state.deepKind,'person-diplomacy');assert.deepEqual(f.writes,[]);
});
for(const command of [15,16,17,19])test('diplomacy target cancellation waits for fresh ACTOR index0 with one Exit: '+command,()=>{
    const f=diplomacyFixture(command);f.press(2);f.tick(400);const old=f.api.getInputTicket(),keys=f.keys.slice();
    f.back();f.back();assert.equal(f.api.getInputTicket(),null);f.tick(200);
    const current=f.api.getDiplomacyPresentation();assert.equal(current.role,'actor');assert.equal(current.index,0);
    assert.equal(current.actor,65535);assert.equal(current.target,65535);assert.equal(current.session,old.session);
    assert.notEqual(current.inputSeq,old.inputSeq);assert.equal(current.menuSeq,f.next(f.next(old.menuSeq)));
    assert.deepEqual(Array.from(current.ids),f.actor.ids);assert.deepEqual(f.keys,[...keys,40]);assert.deepEqual(f.writes,[]);
});
for(const command of [15,16,17,19])test('diplomacy normal dispatch retires the old HD pane only on the real DONE and MAP: '+command,()=>{
    const f=diplomacyFixture(command);f.press(0);f.tick(200);f.press(1);f.tick(400);
    assert.deepEqual(f.keys,[39,35,39]);assert.equal(f.raw.g_hdDiplomacyCommitResult,1);
    assert.equal(f.raw.g_hdReportActive,0);assert.equal(f.raw.g_hdMapPick,1);assert.equal(f.state.open,false);
    assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.getDiplomacyPresentation(),null);assert.deepEqual(f.writes,[]);
});
test('diplomacy actor cancellation returns to native MAP without an invented SUB or extra key',()=>{
    const f=diplomacyFixture();f.back();f.back();f.tick(200);
    assert.deepEqual(f.keys,[40]);assert.equal(f.state.open,false);assert.equal(f.raw.g_hdMapPick,1);assert.deepEqual(f.writes,[]);
});
for(const problem of ['missing-protocol','protocol','command18','phase','actor','generation','raw-mismatch','torn','half-ids','half-names',
    'foreign-context','wrong-kind','menu-index','report','qty','help','battle','transfer','march','library','data'])test('diplomacy role authorization rejects '+problem,()=>{
    const f=diplomacyFixture(),old=f.all('data-hd-deep')[0];
    if(problem==='missing-protocol'){delete f.raw.g_hdDiplomacyProtocolVersion;delete f.env.baye.hd.diplomacy;}
    if(problem==='protocol')f.raw.g_hdDiplomacyProtocolVersion=2;if(problem==='command18')f.raw.g_hdDiplomacyCommand=18;
    if(problem==='phase')f.raw.g_hdDiplomacyPhase=6;if(problem==='actor')f.raw.g_hdDiplomacyActor=19;
    if(problem==='generation')f.raw.g_hdDiplomacyGeneration++;
    if(problem==='raw-mismatch')f.setDiplomacyHook(d=>{d.inputSeq++;});
    if(problem==='torn')f.setDiplomacyHook(()=>{f.raw.g_hdDiplomacyInputSeq++;});
    if(problem==='half-ids')f.setMenuHook(m=>{m.ids=[];m.idsValid=false;});
    if(problem==='half-names')f.setMenuHook(m=>{m.names.pop();});
    if(problem==='foreign-context')f.raw.g_hdMenuContext=2;if(problem==='wrong-kind')f.raw.g_hdMenuKind=4;
    if(problem==='menu-index')f.raw.g_hdMenuIndex=9;if(problem==='report')f.raw.g_hdReportActive=1;
    if(problem==='qty')f.raw.g_hdQtyActive=1;if(problem==='help')f.raw.g_hdHelpActive=1;
    if(problem==='battle')f.raw.g_hdBattlePick=1;if(problem==='transfer')Object.assign(f.raw,{g_hdTransferProtocolVersion:1,g_hdTransferActive:1});
    if(problem==='march')f.raw.g_hdMarchPhase=4;if(problem==='library')f.setIdentity({...f.identity(),sha256:'f'.repeat(64)});
    if(problem==='data')f.env.baye.data={...f.raw};
    assert.equal(f.api.getInputTicket(),null);const event={target:old,detail:1,preventDefault(){},stopPropagation(){}};
    f.dom.root.emit('click',event);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
});
for(const change of ['retire','hidden','classic','identity','inputSeq','data'])test('diplomacy Arrow queue stops after retirement at a real ACK boundary: '+change,()=>{
    const f=diplomacyFixture();f.setAfterKey(key=>{if(key!==35)return;
        f.env.setTimeout(()=>{f.raw.g_hdMenuIndex++;
            if(change==='retire')f.api.retireInteraction('pointercancel');if(change==='hidden')f.env.document.hidden=true;
            if(change==='classic')f.api.setMode('classic');if(change==='identity')f.setIdentity({...f.identity(),generation:2});
            if(change==='inputSeq')f.raw.g_hdDiplomacyInputSeq++;if(change==='data')f.env.baye.data={...f.raw};},60);});
    f.press(2);f.tick(600);assert.deepEqual(f.keys,[35]);assert.deepEqual(f.writes,[]);
});
test('diplomacy COMMIT and REJECT yield to the actual generic report without authorizing PERSON input',()=>{
    for(const phase of [3,4]){
        const f=diplomacyFixture(16,{phase});Object.assign(f.raw,{g_hdReportActive:1,g_hdReportKind:1,g_hdReportPerson:65535});
        f.env.baye.hd.reportText=()=>f.env.baye.hd.report().text;
        vm.runInNewContext(fs.readFileSync(new URL('../js/hd-dialog.js',import.meta.url),'utf8'),f.env);
        const dialog=f.env.BayeHdDialog;dialog.configureMobileHost({isAvailable:()=>true});dialog.onEngineReport();dialog.poll();
        assert.equal(f.api.getInputTicket(),null);assert.equal(dialog.isOpen(),true);assert.ok(dialog.getInputTicket());
        assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
    }
});
test('diplomacy DONE keeps its retirement receipt while a prior report overlay closes asynchronously',()=>{
    const f=diplomacyFixture();let open=true;f.env.BayeHdDialog={isOpen:()=>open};
    f.advance(5,{map:true});assert.equal(f.state.open,true);assert.equal(f.api.getInputTicket(),null);
    open=false;f.internals.syncDiplomacy();assert.equal(f.state.open,false);assert.deepEqual(f.keys,[]);
});
test('diplomacy same native role rebinds after classic and lifecycle retirement without replaying Enter',()=>{
    const f=diplomacyFixture(19);f.press(0);f.tick(200);const before=f.api.getDiplomacyPresentation(),keys=f.keys.slice();
    f.api.setMode('classic');assert.equal(f.api.getInputTicket(),null);f.api.retireInteraction('orientationchange');
    f.api.setMode('hd');f.internals.fill();const after=f.api.getDiplomacyPresentation();
    assert.equal(after.role,'target');assert.equal(after.session,before.session);assert.equal(after.inputSeq,before.inputSeq);
    assert.equal(f.api.getInputTicket().diplomacyPhase,2);assert.deepEqual(f.keys,keys);assert.deepEqual(f.writes,[]);
});
test('diplomacy delivered dispatch retires its receipt on the real MAP while the HD pane is already classic',()=>{
    const f=diplomacyFixture();f.press(0);f.tick(200);f.press(0);f.api.setMode('classic');
    assert.equal(f.state.open,false);f.tick(200);assert.equal(f.raw.g_hdDiplomacyPhase,5);
    assert.equal(f.raw.g_hdMapPick,1);assert.deepEqual(f.keys,[39,39]);
    f.api.setMode('hd');Object.assign(f.raw,{g_hdMapPick:0,g_hdMenuActive:1,g_hdMenuContext:1,g_hdMenuKind:1,
        g_hdMenuSeq:f.next(f.raw.g_hdMenuSeq),g_hdMenuCount:4,g_hdMenuIndex:0});
    f.names.splice(0,f.names.length,'内政','外交','军备','状况');
    Object.assign(f.state,{open:true,layer:'root',cityIndex:0,deepKind:''});
    assert.ok(f.api.getInputTicket());assert.equal(f.internals.send(35,'city-root'),true);
    assert.deepEqual(f.keys,[39,39,35]);assert.deepEqual(f.writes,[]);
});
// PC has its own verified read-only diplomacy observation; it never receives a mobile adapter ticket.
// These callbacks model native publications only. They do not execute C or prove its resource costs.
function pcDiplomacyFixture({fromSub=false}={}) {
    const f=diplomacyFixture(16,{mobile:false,pcHd:true});
    f.world=()=>JSON.parse(JSON.stringify({playerKing:f.raw.g_PlayerKing,cities:f.raw.g_Cities,people:f.raw.g_Persons,queue:f.raw.g_PersonsQueue,orders:f.raw.g_OrderQueue,config:f.raw.g_engineConfig}));
    f.initialWorld=f.world();
    if(!fromSub)return f;
    f.advance(5,{map:true});
    const seq=f.next(f.raw.g_hdMenuSeq),labels=['离间','招揽','策反','反间','劝降'];
    Object.assign(f.raw,{g_hdMapPick:0,g_hdMenuActive:1,g_hdMenuContext:1,g_hdMenuKind:2,
        g_hdMenuSeq:seq,g_hdMenuIndex:0,g_hdMenuCount:labels.length});
    f.names.splice(0,f.names.length,...labels);Object.assign(f.state,{open:true,layer:'sub',subKind:'waijiao',cityIndex:0,deepKind:'',deepLabel:'',deepStep:0});
    f.setAfterKey(key=>{
        if(key===35){f.env.setTimeout(()=>f.raw.g_hdMenuIndex++,60);return;}
        assert.equal(key,39);assert.equal(f.raw.g_hdMenuIndex,1,'CANVASS Enter waits for the real SUB Arrow ACK');
        Object.assign(f.raw,{g_hdMenuActive:0,g_hdMenuContext:0,g_hdMenuKind:0,g_hdMenuCount:0,g_hdMenuSeq:f.next(seq)});
        f.names.splice(0);f.env.setTimeout(()=>{
            Object.assign(f.raw,{g_hdDiplomacySession:f.next(f.raw.g_hdDiplomacySession),g_hdDiplomacyCommand:16});
            f.advance(1,{menuSeq:f.next(f.next(seq))});
        },60);
    });
    f.internals.chooseSub(1);assert.deepEqual(f.keys,[35]);
    f.tick(1000);f.setAfterKey(f.consume);assert.deepEqual(f.keys,[35,39]);
    return f;
}
function assertPcRole(f,role,ids) {
    assert.equal(f.api.debugSnapshot().mobileHost,false,'PC is never configured as a mobile host');
    assert.equal(f.api.getInputTicket(),null,'Public adapter ticket retains its mobile-only brand');
    const before=f.world(),p=f.api.getDiplomacyPresentation();assert.ok(p,'verified PC native diplomacy role');
    assert.equal(p.command,16);assert.equal(p.commandName,'招揽');assert.equal(p.role,role);
    assert.equal(p.moneyCost,50);assert.equal(p.thewCost,20);assert.equal(p.thewPayer,'actor');
    assert.deepEqual(Array.from(p.ids),ids);assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.ids));
    assert.equal(f.state.layer,'deep');assert.equal(f.state.deepKind,'person-diplomacy');assert.equal(f.state.deepLabel,'招揽');
    assert.equal(f.internals.personKind(f.state.deepKind),true,'PC diplomacy uses a native-ID person detail owner');
    assert.equal(f.state.deepMenuOwner.kind,3);assert.equal(f.state.deepMenuOwner.seq,p.menuSeq);
    assert.deepEqual(Array.from(f.state.deepItems,item=>item.pind),ids);
    assert.equal(f.dom.find('data-hd-diplomacy-role').getAttribute('data-hd-diplomacy-role'),role);
    assert.deepEqual(f.world(),before,'Role, costs, labels and detail-owner reads do not write game data');
    assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);return p;
}
test('PC CANVASS enters from real SUB and cancels TARGET to fresh ACTOR then MAP with two EXITs',()=>{
    const f=pcDiplomacyFixture({fromSub:true}),actor=assertPcRole(f,'actor',f.actor.ids),oldActor=f.all('data-hd-deep')[1];
    assert.equal(actor.index,0);f.press(1);f.tick(200);
    const target=assertPcRole(f,'target',f.target.ids);assert.equal(target.actor,19);
    assert.equal(oldActor.isConnected,false);assert.deepEqual(f.keys,[35,39,35,39]);
    const targetBack=f.internals.backOwner();f.back();f.back();assert.equal(f.state.layer,'deep','Cancel keeps its owner until the native ACK');
    f.tick(200);const returned=assertPcRole(f,'actor',f.actor.ids);
    assert.equal(returned.index,0);assert.equal(returned.actor,65535);assert.equal(returned.target,65535);
    assert.equal(returned.session,target.session);assert.notEqual(returned.inputSeq,target.inputSeq);assert.notEqual(returned.menuSeq,target.menuSeq);
    const keys=f.keys.slice();f.internals.back(targetBack);assert.deepEqual(f.keys,keys,'Old target Back cannot cancel the new actor');
    f.back();f.back();f.tick(200);assert.equal(f.state.open,false);assert.equal(f.raw.g_hdMapPick,1);
    assert.equal(f.raw.g_hdMenuActive,0);assert.equal(f.raw.g_hdDiplomacyPhase,5);
    assert.equal(f.api.getDiplomacyPresentation(),null);assert.equal(f.api.getInputTicket(),null);
    assert.deepEqual(f.keys,[35,39,35,39,40,40]);assert.equal(f.raw.g_hdDiplomacyCommitSeq,0);assert.equal(f.raw.g_hdDiplomacyCommitResult,0);
    assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
});
test('PC diplomacy delayed native ACK does not invent SUB, replay Enter or accept retired buttons',()=>{
    const f=pcDiplomacyFixture(),pending=[];f.setDeferred(fn=>pending.push(fn));
    const actorButton=f.press(0);assert.deepEqual(f.keys,[39]);assert.equal(pending.length,1);
    f.tick(40);assert.equal(f.state.layer,'deep');assert.equal(f.api.getDiplomacyPresentation(),null);
    f.dom.root.emit('pointerdown',f.event(actorButton));f.click(actorButton);f.back();assert.deepEqual(f.keys,[39]);
    pending.shift()();f.tick(120);assertPcRole(f,'target',f.target.ids);
    const oldTarget=f.all('data-hd-deep')[0],oldBack=f.internals.backOwner();f.back();f.back();
    assert.deepEqual(f.keys,[39,40]);assert.equal(pending.length,1);f.tick(120);
    assert.equal(f.state.open,true);assert.equal(f.state.layer,'deep','No synthetic submenu while TARGET cancellation is pending');
    assert.equal(f.state.deepKind,'person-diplomacy');assert.equal(f.api.getDiplomacyPresentation(),null);
    pending.shift()();f.tick(120);assertPcRole(f,'actor',f.actor.ids);
    assert.equal(oldTarget.isConnected,false);f.dom.root.emit('pointerdown',f.event(oldTarget));f.click(oldTarget);f.internals.back(oldBack);
    assert.deepEqual(f.keys,[39,40],'Retired target button and old Back owner emit no input');
    f.back();f.back();assert.deepEqual(f.keys,[39,40,40]);assert.equal(pending.length,1);
    f.tick(120);assert.equal(f.state.open,true,'Actor cancel also waits for native DONE/MAP');
    pending.shift()();f.tick(120);assert.equal(f.state.open,false);assert.equal(f.raw.g_hdMapPick,1);
    assert.equal(f.raw.g_hdDiplomacyCommitSeq,0);assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
});
test('PC diplomacy reservation survives unknown EXIT, silent close and role re-adoption',()=>{
    const f=pcDiplomacyFixture(),failure=new Error('unknown EXIT after native sender');let calls=0;
    assertPcRole(f,'actor',f.actor.ids);f.setAfterKey(key=>{assert.equal(key,40);calls++;throw failure;});
    assert.throws(()=>f.back(),error=>error===failure,'The exact sender exception object escapes unchanged');
    assert.deepEqual(f.keys,[40]);assert.equal(calls,1);
    f.api.close({silent:true});assert.equal(f.state.open,false,'Presentation can close while its input reservation remains');
    f.internals.syncDiplomacy();f.internals.fill();
    assert.doesNotThrow(()=>{f.back();f.back();},'Re-adopting the same native role cannot retry its unknown EXIT');
    assert.deepEqual(f.keys,[40]);assert.equal(calls,1);assert.equal(f.api.getInputTicket(),null);
    assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
});
test('PC diplomacy reservation survives a pending EXIT before native consumption',()=>{
    const f=pcDiplomacyFixture(),accepted=[];assertPcRole(f,'actor',f.actor.ids);
    // The export returns after accepting a key; C may not consume it or change its menu yet.
    f.setAfterKey(key=>{assert.equal(key,40);accepted.push(()=>f.consume(key));});
    f.back();assert.deepEqual(f.keys,[40]);assert.equal(f.raw.g_hdMenuActive,1);
    f.api.close({silent:true});assert.equal(f.state.open,false);
    f.internals.syncDiplomacy();f.internals.fill();f.back();f.back();f.tick(120);
    assert.deepEqual(f.keys,[40],'Successful export without native ACK remains consumed across close/sync');assert.equal(accepted.length,1);
    f.setAfterKey(f.consume);accepted.shift()();f.tick(200);
    assert.equal(f.raw.g_hdDiplomacyPhase,5);assert.equal(f.raw.g_hdMapPick,1);assert.equal(f.state.open,false);
    assert.deepEqual(f.keys,[40]);assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
});
test('PC diplomacy reservation survives unknown ENTER through classic and HD adoption',()=>{
    const f=pcDiplomacyFixture(),failure=new Error('unknown ENTER after native sender');let calls=0;
    assertPcRole(f,'actor',f.actor.ids);f.setAfterKey(key=>{assert.equal(key,39);calls++;throw failure;});
    assert.throws(()=>f.press(0),error=>error===failure,'Unknown ENTER retains the exact exception object');
    f.api.close({silent:true,force:true});assert.equal(f.state.open,false);
    f.api.setMode('classic');assert.equal(f.api.getDiplomacyPresentation(),null);
    f.api.setMode('hd');f.internals.syncDiplomacy();f.internals.fill();
    assert.doesNotThrow(()=>{f.internals.chooseDeep(0);f.back();},'A mode cycle cannot reuse an unacknowledged native role');
    assert.deepEqual(f.keys,[39]);assert.equal(calls,1);assert.equal(f.raw.g_hdDiplomacyCommitSeq,0);
    assert.equal(f.api.debugSnapshot().mobileHost,false);assert.equal(f.api.getInputTicket(),null);
    assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
});
test('PC diplomacy reservation releases only after a real TARGET then fresh ACTOR ACK',()=>{
    const f=pcDiplomacyFixture(),failure=new Error('ENTER may have reached C'),forwarded=[];
    const first=assertPcRole(f,'actor',f.actor.ids);
    f.setAfterKey(key=>{assert.equal(key,39);forwarded.push(()=>f.consume(key));throw failure;});
    assert.throws(()=>f.press(0),error=>error===failure);assert.deepEqual(f.keys,[39]);
    // A later actual publication may establish that this unknown export did reach C.
    f.setAfterKey(f.consume);forwarded.shift()();f.tick(200);
    const target=assertPcRole(f,'target',f.target.ids);assert.notEqual(target.inputSeq,first.inputSeq);
    f.back();f.back();f.tick(200);const actor=assertPcRole(f,'actor',f.actor.ids);
    assert.notEqual(actor.inputSeq,target.inputSeq);assert.notEqual(actor.menuSeq,first.menuSeq);assert.equal(actor.index,0);
    f.press(0);f.tick(200);const next=assertPcRole(f,'target',f.target.ids);assert.notEqual(next.inputSeq,target.inputSeq);
    assert.deepEqual(f.keys,[39,40,39],'Fresh native roles are usable; reservation is not a permanent busy latch');
    f.back();f.tick(200);f.back();f.tick(200);assert.equal(f.state.open,false);assert.equal(f.raw.g_hdMapPick,1);
    assert.deepEqual(f.keys,[39,40,39,40,40]);assert.equal(f.raw.g_hdDiplomacyCommitSeq,0);
    assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
});
for(const problem of ['identity','generation','session','inputSeq','data','menu-seq','menu-membership'])
    test('PC diplomacy paired press rejects owner drift before click: '+problem,()=>{
        const f=pcDiplomacyFixture(),button=f.down(0);
        if(problem==='identity')f.setIdentity({...f.identity(),generation:2});
        if(problem==='generation')f.raw.g_hdDetailGeneration++;
        if(problem==='session')f.raw.g_hdDiplomacySession++;
        if(problem==='inputSeq')f.raw.g_hdDiplomacyInputSeq++;
        if(problem==='data')f.env.baye.data={...f.raw};
        if(problem==='menu-seq')f.raw.g_hdMenuSeq++;
        if(problem==='menu-membership')f.setMenuHook(m=>{m.ids[0]=99;});
        f.click(button);f.tick(300);assert.deepEqual(f.keys,[],'Stale paired press cannot Enter');
        assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.debugSnapshot().mobileHost,false);
        assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
    });
for(const problem of ['identity','generation','session','inputSeq','data'])
    test('PC diplomacy Arrow queue refuses drift at the actual cursor ACK: '+problem,()=>{
        const f=pcDiplomacyFixture();f.setAfterKey(key=>{assert.equal(key,35);f.env.setTimeout(()=>{
            f.raw.g_hdMenuIndex++;
            if(problem==='identity')f.setIdentity({...f.identity(),generation:2});
            if(problem==='generation')f.raw.g_hdDetailGeneration++;
            if(problem==='session')f.raw.g_hdDiplomacySession++;
            if(problem==='inputSeq')f.raw.g_hdDiplomacyInputSeq++;
            if(problem==='data')f.env.baye.data={...f.raw};
        },60);});
        f.press(2);f.tick(600);assert.deepEqual(f.keys,[35],'No queued arrow or Enter after a different owner ACK');
        assert.equal(f.raw.g_hdDiplomacyCommitSeq,0);assert.deepEqual(f.world(),f.initialWorld);assert.deepEqual(f.writes,[]);
    });
test('PC diplomacy classic, unverified and nondiplomacy owners keep readonly presentation closed and mobile ticket null',()=>{
    for(const problem of ['classic','missing-identity','wrong-library','identity-not-current','missing-diplomacy','not-diplomacy','counter-spy']){
        const f=diplomacyFixture(problem==='counter-spy'?18:16,{mobile:false,pcHd:problem!=='classic'});
        if(problem==='missing-identity')delete f.env.BayeHdLibIdentity;
        if(problem==='wrong-library')f.setIdentity({...f.identity(),sha256:'f'.repeat(64)});
        if(problem==='identity-not-current')f.env.BayeHdLibIdentity.isCurrent=()=>false;
        if(problem==='missing-diplomacy')delete f.env.baye.hd.diplomacy;
        if(problem==='not-diplomacy')Object.assign(f.raw,{g_hdDiplomacyActive:0,g_hdDiplomacyPhase:0,g_hdDiplomacyCommand:0});
        assert.equal(f.api.getInputTicket(),null);assert.equal(f.api.getDiplomacyPresentation(),null,problem);
        assert.equal(f.api.debugSnapshot().mobileHost,false);assert.deepEqual(f.keys,[]);assert.deepEqual(f.writes,[]);
        if(problem==='classic')assert.equal(f.state.deepLabel,'');
    }
});
