import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Controlled public bridge fixtures. No native C, browser, or OS execution.
const source = fs.readFileSync(new URL('../js/hd-city-menu.js', import.meta.url), 'utf8');
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const fields = ['g_hdEngineReady','g_hdMapPick','g_hdMapCity','g_hdMapInputSeq','g_hdBattlePick',
    'g_hdMenuActive','g_hdMenuContext','g_hdMenuKind','g_hdMenuSeq','g_hdMenuCount','g_hdMenuIndex',
    'g_hdDetailGeneration','g_hdQtyActive','g_hdQtySession','g_hdQtyInputSeq','g_hdQtyLastKey',
    'g_hdQtyCursor','g_hdQtyStep','g_hdQtyReady','g_hdQtyMin','g_hdQtyMax','g_hdQtyValue',
    'g_hdMarchPhase','g_hdMarchSession','g_hdMarchInputSeq','g_hdReportActive','g_hdReportSeq',
    'g_hdReportInputSeq','g_hdHelpActive','g_hdHelpInputSeq','g_hdFightActive','g_hdRecordActive',
    'g_hdMovieActive','g_hdSpeActive','g_hdSkillActive','g_hdAttackActive','g_hdSkillResultActive',
    'g_hdMakerActive','g_hdViewActive','g_hdMiniMapActive','g_hdGoodsActive','g_hdPersonPropertiesActive',
    'g_hdResultOwnerKind','g_hdResultOwnerValid'];
function fixture({storageThrows = false} = {}) {
    const raw = Object.fromEntries(fields.map(key => [key, 0]));
    Object.assign(raw, {g_hdEngineReady:1,g_hdMapCity:1,g_hdMapInputSeq:4,g_hdMenuActive:1,
        g_hdMenuContext:1,g_hdMenuKind:1,g_hdMenuSeq:3,g_hdMenuCount:4,g_hdDetailGeneration:2});
    raw.g_Cities = [{Persons:0,PersonQueue:0,Belong:1,State:0}];
    const events = {}, docEvents = {}, keys = [], writes = [], timers = [], storageWrites = [];
    const stored = new Map([['baye/cityMenuMode','classic'],['baye/overworldMode','classic']]);
    let identity = {status:'ready',generation:1,sha256:SHA,byteLength:207195}, available = true, menuHook = null;
    const names = ['内政','外交','军备','状况'];
    const node = {setAttribute(){},classList:{toggle(){}}};
    const document = {hidden:false,documentElement:node,body:node,getElementById(){return null;},
        querySelector(){return null;},addEventListener(type, fn){(docEvents[type] ||= []).push(fn);}};
    const env = {document,innerWidth:844,innerHeight:390,console:{log(){},warn(){}},Date,JSON,Object,Array,
        setInterval(fn){timers.push(fn);return timers.length;},clearInterval(){},setTimeout(){return 1;},clearTimeout(){},
        addEventListener(type, fn){(events[type] ||= []).push(fn);},sendKey(key){keys.push(key);},
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
            },march(){return {pick:raw.g_hdMapPick,battlePick:raw.g_hdBattlePick,mapCity:raw.g_hdMapCity,
                mapInputSeq:raw.g_hdMapInputSeq,phase:raw.g_hdMarchPhase,session:raw.g_hdMarchSession,
                inputSeq:raw.g_hdMarchInputSeq,origin:0,selected:0,seq:0};},
            qty(){return {protocol:true,active:raw.g_hdQtyActive,session:raw.g_hdQtySession,
                inputSeq:raw.g_hdQtyInputSeq,lastKey:raw.g_hdQtyLastKey,cursor:raw.g_hdQtyCursor,
                step:raw.g_hdQtyStep,ready:raw.g_hdQtyReady,min:raw.g_hdQtyMin,max:raw.g_hdQtyMax,value:raw.g_hdQtyValue};},
            fight(){return {active:raw.g_hdFightActive};},help(){return {active:raw.g_hdHelpActive};},
            report(){return {active:raw.g_hdReportActive};}}}};
    env.baye.data = new Proxy(raw,{set(target,key,value){writes.push(key);throw Error('native write ' + key);}});
    env.window = env;
    vm.runInNewContext(source, env, {filename:'js/hd-city-menu.js'});
    const api = env.BayeHdCityMenu;
    function configure(){api.configureMobileHost({isAvailable:()=>available});}
    return {env,api,raw,names,keys,writes,timers,stored,storageWrites,configure,
        setAvailable(value){available=value;},setIdentity(value){identity=value;},identity(){return identity;},
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
