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
            cancelPersons:cancelUnselectedMarch,fill:fillDeepList,render:render,other:otherCities};
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
function marchDom(f) {
    function node(tagName) {
        const attrs={}, value={tagName:tagName.toUpperCase(),children:[],parentElement:null,
            isConnected:false,hidden:false,textContent:'',className:'',
            classList:{toggle(){},contains(){return false;}},
            setAttribute(name,item){attrs[name]=String(item);},getAttribute(name){return name in attrs?attrs[name]:null;},
            appendChild(child){child.parentElement=this;this.children.push(child);connect(child,this.isConnected);return child;}};
        Object.defineProperty(value,'innerHTML',{set(html){
            for(const child of this.children)connect(child,false);
            this.children=[];
            for(const match of String(html).matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
                const button=node('button');button.textContent=match[2];
                for(const attr of match[1].matchAll(/(data-hd-[\w-]+)(?:="([^"]*)")?/g))button.setAttribute(attr[1],attr[2]||'');
                button.disabled=/\bdisabled\b/.test(match[1]);this.appendChild(button);
            }
        }});
        return value;
    }
    function connect(value,on){value.isConnected=on;for(const child of value.children)connect(child,on);}
    const list=node('div');connect(list,true);
    f.env.document.getElementById=id=>id==='hd-city-menu-deep'?list:null;
    f.env.document.createElement=node;
    function find(attribute,value=list){
        if(value.getAttribute(attribute)!==null)return value;
        for(const child of value.children){const found=find(attribute,child);if(found)return found;}
        return null;
    }
    function poll(){f.internals.sync();f.internals.fill();}
    return {list,find,poll};
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
