// Pure native-ABI/DOM fixtures. These tests never launch a browser or mutate a WASM world.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../js/hd-mobile-battle.js', import.meta.url), 'utf8');
const ORIGINAL_SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';

function fixture() {
    const listeners = new Map(), globalListeners = new Map(), timers = new Map(), nodes = new Map();
    const counts = {actions: [], retired: [], configured: [], keys: [], writes: [], serialized: 0, paints: [], modes: [], sharedReads: 0};
    const state = {ready: true, menuNames: [], menuHook: null, fightHook: null, readyHook: null,
        identityHook: null, skillsHook: null, skillsOverride: null, top: null, styleHook: null, mode: 'auto', showLcd: false, data: null};
    let identity = {status: 'ready', sha256: ORIGINAL_SHA, byteLength: 207195, generation: 3};
    const storage = new Map([['baye/battleMode', 'classic'], ['baye/overworldMode', 'classic']]);
    function on(map, name, fn, capture) {
        const items = map.get(name) || []; items.push({fn, capture: capture === true || !!capture?.capture}); map.set(name, items);
    }
    const ctx = new Proxy({measureText: text => ({width: String(text).length * 8}),
        createLinearGradient: () => ({addColorStop() {}})}, {get(target, key) {
        if (key in target) return target[key];
        return (...args) => counts.paints.push([key, ...args]);
    }});
    function element(id, tagName = 'DIV', parent = null, rect = null) {
        rect ??= parent?.rect || {left: 0, top: 0, width: 844, height: 390};
        const attrs = {}, classes = new Set(), eventListeners = new Map();
        const node = {id, tagName, nodeType: 1, parentElement: parent, parentNode: parent, children: [], attrs,
            hidden: false, disabled: false, isConnected: true, textContent: '', rect: {...rect},
            style: {display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto'},
            classList: {add(...names) { names.forEach(n => classes.add(n)); }, remove(...names) { names.forEach(n => classes.delete(n)); },
                contains: name => classes.has(name), toggle(name, value) { const next = value ?? !classes.has(name); if (next) classes.add(name); else classes.delete(name); return next; }},
            setAttribute(name, value) { attrs[name] = String(value); }, getAttribute(name) { return attrs[name] ?? null; },
            removeAttribute(name) { delete attrs[name]; }, hasAttribute(name) { return name in attrs; },
            getBoundingClientRect() { const r = this.rect; return {...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top}; },
            contains(other) { for (let p = other; p; p = p.parentElement) if (p === this) return true; return false; },
            appendChild(other) { if (other.parentElement) other.parentElement.removeChild(other); this.children.push(other); other.parentElement = other.parentNode = this; return other; },
            removeChild(other) { this.children = this.children.filter(n => n !== other); other.parentElement = other.parentNode = null; return other; },
            replaceChildren(...items) { this.children.forEach(n => { n.parentElement = n.parentNode = null; }); this.children = []; items.forEach(n => this.appendChild(n)); },
            addEventListener(name, fn, capture) { on(eventListeners, name, fn, capture); }, removeEventListener() {}, eventListeners,
            setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture() { return false; },
            focus() {}, getContext: () => ctx,
            matches(selector) { if (selector.startsWith('#')) return id === selector.slice(1); if (selector.startsWith('.')) return classes.has(selector.slice(1));
                const m = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector); return m ? nameMatches(m[1], m[2]) : tagName.toLowerCase() === selector.toLowerCase(); },
            closest(selector) { for (let n = this; n; n = n.parentElement) if (n.matches(selector)) return n; return null; },
            querySelectorAll(selector) { const found = []; const visit = n => n.children.forEach(c => { if (selector.split(',').some(s => c.matches(s.trim()))) found.push(c); visit(c); }); visit(this); return found; },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }};
        function nameMatches(name, value) { return name in attrs && (value === undefined || attrs[name] === value); }
        Object.defineProperty(node, 'innerHTML', {get() { return ''; }, set() { this.replaceChildren(); }});
        Object.defineProperty(node, 'firstChild', {get() { return this.children[0] || null; }});
        Object.defineProperty(node, 'clientWidth', {get() { return this.rect.width; }});
        Object.defineProperty(node, 'clientHeight', {get() { return this.rect.height; }});
        if (id) nodes.set(id, node); if (parent) parent.children.push(node); return node;
    }
    const html = element('html', 'HTML'), body = element('body', 'BODY', html);
    body.classList.add('hd-mobile-page');
    const root = element('hd-battle', 'DIV', body), layout = element('hd-mobile-battle-layout', 'DIV', root);
    const board = element('hd-mobile-battle-board', 'DIV', layout, {left: 0, top: 52, width: 640, height: 294});
    const canvas = element('hd-mobile-battle-canvas', 'CANVAS', board, board.rect);
    const side = element('hd-mobile-battle-side', 'DIV', layout, {left: 640, top: 52, width: 204, height: 294});
    element('hd-battle-hud', 'DIV', side); element('hd-mobile-battle-details', 'DIV', side);
    const tip = element('hd-battle-tip', 'DIV', side); tip.setAttribute('data-hd-battle-tip', '');
    element('hd-battle-result', 'DIV', side);
    const menu = element('hd-battle-menu', 'DIV', side), title = element('hd-battle-menu-title', 'DIV', menu);
    const list = element('hd-battle-menu-list', 'DIV', menu);
    const menuActions = element('menu-actions', 'DIV', menu); menuActions.classList.add('hd-battle-menu-actions');
    const menuExit = element('menu-exit', 'BUTTON', menuActions, {left: 660, top: 292, width: 160, height: 44});
    menuExit.setAttribute('data-hd-battle-menu-exit', '');
    const footer = element('battle-footer', 'DIV', root, {left: 0, top: 346, width: 844, height: 44});
    footer.classList.add('hd-battle-footer');
    const sys = element('system-button', 'BUTTON', footer, {left: 10, top: 346, width: 110, height: 44}); sys.setAttribute('data-hd-battle-sys', '');
    const cancel = element('cancel-button', 'BUTTON', footer, {left: 130, top: 346, width: 110, height: 44}); cancel.setAttribute('data-hd-battle-cancel', '');
    const mode = element('hd-mobile-battle-mode', 'BUTTON', footer, {left: 250, top: 346, width: 110, height: 44});
    const focus = element('hd-mobile-battle-focus', 'BUTTON', footer, {left: 370, top: 346, width: 110, height: 44});
    const outside = element('outside', 'DIV', body, {left: 0, top: 0, width: 844, height: 52});
    const headerMode = element('hd-mobile-battle-toggle', 'BUTTON', outside, {left: 650, top: 4, width: 180, height: 44});
    const lcd = element('lcd', 'CANVAS', body, {left: 0, top: 52, width: 640, height: 294});
    const raw = {};
    const zeroFields = ['g_hdMapPick','g_hdBattlePick','g_hdMenuActive','g_hdMenuContext','g_hdMenuKind','g_hdMenuCount','g_hdMenuIndex',
        'g_hdMarchPhase','g_hdReportActive','g_hdQtyActive','g_hdHelpActive','g_hdRecordActive','g_hdMovieActive','g_hdSpeActive',
        'g_hdSkillActive','g_hdAttackActive','g_hdSkillResultActive','g_hdMakerActive','g_hdMiniMapActive','g_hdViewActive',
        'g_hdResultOwnerKind','g_hdResultOwnerValid','g_hdGoodsActive','g_hdPersonPropertiesActive',
        'g_hdFightOver','g_hdFightSkip','g_hdFightPhase','g_hdFightAimType','g_hdFightActor','g_FoucsX','g_FoucsY'];
    for (const name of zeroFields) raw[name] = 0;
    Object.assign(raw, {g_hdEngineReady:1,g_hdDetailGeneration:7,g_hdSpeGeneration:4,g_hdMapInputSeq:9,g_hdMapCity:32,g_PIdx:3,
        g_hdMenuSeq:11,g_hdMarchSession:2,g_hdMarchInputSeq:3,g_hdReportSeq:5,g_hdReportInputSeq:6,g_hdQtySession:3,
        g_hdQtyInputSeq:4,g_hdHelpSeq:5,g_hdHelpInputSeq:6,g_hdFightActive:1,g_hdFightWait:1,g_hdFightInputKind:1,
        g_hdFightInputSeq:20,g_hdFightActor:255,g_hdFightAimType:255,g_MapWid:20,g_MapHgt:20,g_FgtBoutCnt:3,g_FgtBoutMax:20,g_FgtWeather:2,
        g_PathSX:0,g_PathSY:0,g_PUseSX:0,g_PUseSY:0,g_FoucsX:4,g_FoucsY:16,
        g_FgtParam:{CityIndex:32,GenArray:Array(20).fill(0),MProvender:1247,EProvender:5000},
        g_GenPos:Array.from({length:20},()=>({x:0,y:0,active:0,state:8,hp:0,mp:0,move:0})),
        g_Persons:Array.from({length:200},()=>({Arms:0,Level:1,Belong:0,IQ:50,Force:50})),
        g_FightPath:Array(225).fill(255),g_FgtAtkRng:Array(228).fill(0),g_hdSkillCount:0,g_hdSkillNameLen:0,
        g_hdSkillIds:Array(10).fill(0),g_hdSkillNameBytes:Array(80).fill(0)});
    raw.g_FgtParam.GenArray[0]=189; raw.g_FgtParam.GenArray[1]=145; raw.g_FgtParam.GenArray[10]=21;
    Object.assign(raw.g_GenPos[0],{x:4,y:16,state:0,hp:185,mp:146,move:4});
    Object.assign(raw.g_GenPos[1],{x:4,y:17,state:0,hp:81,mp:70,move:4});
    Object.assign(raw.g_GenPos[10],{x:15,y:16,state:0,hp:100,mp:80,move:4});
    Object.assign(raw.g_Persons[188],{Arms:100,Level:20,Belong:10,IQ:150});
    Object.assign(raw.g_Persons[144],{Arms:100,Level:5,Belong:10});
    Object.assign(raw.g_Persons[20],{Arms:1000,Level:5,Belong:1});
    Object.defineProperty(raw,'toJSON',{value(){counts.serialized++;throw Error('Opaque native data must not be serialized');}});
    const data = new Proxy(raw,{set(target,key,value){counts.writes.push(String(key));target[key]=value;return true;}});
    raw.circular=data; state.data=data;
    function fight() {
        if(state.fightHook)state.fightHook(); const d=state.data;
        return {active:d.g_hdFightActive,over:d.g_hdFightOver,wait:d.g_hdFightWait,phase:d.g_hdFightPhase,aimType:d.g_hdFightAimType,
            inputKind:d.g_hdFightInputKind,inputSeq:d.g_hdFightInputSeq,actorIndex:d.g_hdFightActor,skip:d.g_hdFightSkip,
            result:'',tip:'',cityIndex:d.g_FgtParam?.CityIndex,mapW:d.g_MapWid,mapH:d.g_MapHgt,bout:d.g_FgtBoutCnt,
            boutMax:d.g_FgtBoutMax,focusX:d.g_FoucsX,focusY:d.g_FoucsY};
    }
    function menuReading() {
        if(state.menuHook)state.menuHook();const d=state.data;
        return {active:d.g_hdMenuActive,context:d.g_hdMenuContext,kind:d.g_hdMenuKind,seq:d.g_hdMenuSeq,
            itemLen:8,count:d.g_hdMenuCount,index:d.g_hdMenuIndex,names:[...state.menuNames],packedNames:[...state.menuNames],
            ids:[],idsValid:false,generation:d.g_hdDetailGeneration,detailGeneration:d.g_hdDetailGeneration};
    }
    function visible(n) {for(let p=n;p;p=p.parentElement)if(p.hidden||p.style.display==='none'||p.style.visibility==='hidden'||p.style.opacity==='0')return false;return true;}
    const document = {body,documentElement:html,hidden:false,readyState:'complete',activeElement:body,
        getElementById:id=>nodes.get(id)||null,createElement:tag=>element('',tag.toUpperCase()),
        querySelectorAll:selector=>body.querySelectorAll(selector),querySelector:selector=>body.querySelector(selector),
        addEventListener(name,fn,capture){on(listeners,name,fn,capture);},removeEventListener(){},
        elementFromPoint(x,y){if(state.top)return state.top;for(const n of [...nodes.values()].reverse()){
            if(n===lcd||!visible(n)||n.style.pointerEvents==='none')continue;const r=n.rect;
            if(x>=r.left&&x<r.left+r.width&&y>=r.top&&y<r.top+r.height&&n!==root&&n!==layout&&n!==board&&n!==side&&n!==html&&n!==body)return n;
        }return body;}};
    const shared = {configureMobileHost(options){this.provider=options;counts.configured.push(options);},
        applyMobilePage(options){this.provider=options;counts.configured.push(options);},start(){},
        getMode:()=>state.mode,shouldShowHd:()=>state.mode!=='classic',isOpen:()=>true,
        setMode(value){counts.modes.push(value);state.mode=value;},syncMode(){},
        retireInteraction(reason){counts.retired.push(reason);},retireInputPreservingOwner(reason){counts.retired.push(reason);return true;},
        cancelInteraction(reason){counts.retired.push(reason);},
        clickTile(x,y){counts.actions.push(['tile',x,y]);return {ok:true};},pickMenu(index){counts.actions.push(['menu',index]);return {ok:true};},
        openSystemMenu(){counts.actions.push(['system']);return {ok:true};},cancel(){counts.actions.push(['cancel']);return {ok:true};},
        returnFromHelp(){counts.actions.push(['return-help']);return {ok:true};},viewKey(code){counts.actions.push(['view',code]);return {ok:true};},
        handleKey(event){counts.actions.push(['keyboard',event.key]);return true;},
        getInputTicket(){counts.sharedReads++;const native=host.readNativeTicket();
            if(!native||native.presentation!=='hd'||state.mode==='classic'||state.showLcd)return null;
            const t={key:native.key,stableKey:native.stableKey,libraryGeneration:native.libraryGeneration,
                kind:native.kind,seq:native.seq,actor:native.actor};
            Object.defineProperty(t,'data',{value:native.data,enumerable:false});return t;},
        getLcdPresentation(){return state.mode==='classic'||state.showLcd||!this.getInputTicket()?'passthrough':'off';}};
    const window = {document,innerWidth:844,innerHeight:390,devicePixelRatio:1,
        localStorage:{getItem:key=>storage.get(key)??null,setItem(key,value){storage.set(key,String(value));}},
        matchMedia:()=>({matches:window.innerWidth>window.innerHeight}),
        getComputedStyle(node){if(state.styleHook)state.styleHook(node);return node.style;},
        addEventListener(name,fn,capture){on(globalListeners,name,fn,capture);},removeEventListener(){},
        setInterval(fn,ms){const id=Symbol();timers.set(id,{fn,ms});return id;},clearInterval(id){timers.delete(id);},
        setTimeout(fn,ms){const id=Symbol();timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
        requestAnimationFrame(fn){const id=Symbol();timers.set(id,{fn,ms:16});return id;},cancelAnimationFrame(id){timers.delete(id);},
        BayeHdBattle:shared,BayeHdOverworld:{getMode:()=> 'hd-map'},
        BayeHdLibIdentity:{read(){if(state.identityHook)state.identityHook();return identity;},
            isCurrent:value=>value===identity||value?.status===identity.status&&value.sha256===identity.sha256&&value.generation===identity.generation,
            subscribe(){}},
        sendKey(code){counts.keys.push(code);},
        baye:{get data(){return state.data;},ensureData:()=>state.data,getPersonCount:()=>200,
            getPersonName:index=>index===188?'杨秋':index===144?'吴兰':index===20?'吕布':'人物'+index,
            getArmType:()=>1,hd:{ready(){if(state.readyHook)state.readyHook();return state.ready;},fight,menuItems:menuReading,
                skills(){if(state.skillsHook)state.skillsHook();const d=state.data;return state.skillsOverride||
                    {active:d.g_hdSkillActive,count:d.g_hdSkillCount,ids:d.g_hdSkillIds.slice(0,d.g_hdSkillCount),names:state.menuNames.slice()};},
                report:()=>({active:state.data.g_hdReportActive,seq:state.data.g_hdReportSeq,inputSeq:state.data.g_hdReportInputSeq,kind:2,person:188,text:'原生报告'})}}};
    vm.runInNewContext(source,{window,document,console,Date,Math,JSON,Object,Number,Array,Set,Map,isFinite,
        baye:window.baye,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout}, {filename:'js/hd-mobile-battle.js'});
    const host=window.BayeHdMobileBattle.createController(window);
    host.init();counts.writes.length=0;
    function fire(type,target=canvas,values={}){
        const r=target.rect,event={type,target,pointerId:1,pointerType:'touch',isPrimary:true,isTrusted:true,button:0,detail:1,
            clientX:r.left+r.width/2,clientY:r.top+r.height/2,prevented:false,stopped:false,
            preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;},...values};
        const invoke=(items,capture)=>{for(const item of items||[]){if(item.capture!==capture)continue;item.fn(event);if(event.stopped)break;}};
        invoke(listeners.get(type),true);const chain=[];for(let n=target;n;n=n.parentElement)chain.push(n);
        for(const n of chain.slice().reverse()){if(event.stopped)break;invoke(n.eventListeners.get(type),true);}
        for(const n of chain){if(event.stopped)break;invoke(n.eventListeners.get(type),false);}
        if(!event.stopped)invoke(listeners.get(type),false);return event;
    }
    function globalEvent(type){for(const {fn} of globalListeners.get(type)||[])fn({type});}
    function renderPayload(){const t=host.readNativeTicket();return {renderOwner:Object.fromEntries(
        ['key','stableKey','libraryGeneration','kind','seq','actor'].map(name=>[name,t[name]])),
        unitList:t.native.units.filter(u=>u.id>0&&u.id<65534).map(u=>({...u,
            side:u.i<10?'player':'enemy',name:window.baye.getPersonName(u.id-1),armType:1})),feedback:null};}
    function render(){shared.provider.render(renderPayload());return host.debugSnapshot();}
    function nativeMenu(kind=3,names=['攻击','计谋','休息']){raw.g_hdFightInputKind=kind;raw.g_hdFightActor=[2,3,4,5].includes(kind)?0:255;raw.g_hdFightWait=0;raw.g_hdMenuActive=1;raw.g_hdMenuContext=3;
        if(kind===4){raw.g_hdSkillActive=1;raw.g_hdSkillCount=names.length;raw.g_hdSkillNameLen=4;names.forEach((name,i)=>raw.g_hdSkillIds[i]=i+1);}
        raw.g_hdMenuKind=kind;raw.g_hdMenuCount=names.length;raw.g_hdMenuIndex=0;state.menuNames=[...names];render();host.refresh();}
    render();counts.paints.length=counts.retired.length=counts.writes.length=0;
    return {host,window,document,raw,data,state,identity:patch=>{identity={...identity,...patch};},counts,storage,nodes,timers,listeners,
        root,board,canvas,side,sys,cancel,mode,headerMode,focus,outside,lcd,list,title,menu,menuExit,shared,fire,globalEvent,nativeMenu,
        tap(target=canvas,values={}){fire('pointerdown',target,values);fire('pointerup',target,values);fire('click',target,values);},
        render,renderPayload,
        clean(){counts.actions.length=counts.keys.length=counts.retired.length=counts.writes.length=0;}};
}

function interactive(f) {
    const ticket=f.host.readNativeTicket();
    assert.ok(ticket,'A complete current original battle publishes a ticket');
    assert.equal(ticket.data,f.state.data,'Native data remains an opaque identity');
    assert.equal(ticket.presentation,'hd');
    return ticket;
}
function noAction(f) {
    assert.deepEqual(f.counts.actions,[]); assert.deepEqual(f.counts.keys,[]);
    assert.deepEqual(f.counts.writes,[]); assert.equal(f.counts.serialized,0);
}
function unavailable(f) {
    const ticket=f.host.readNativeTicket();
    assert.ok(!ticket||ticket.presentation==='lcd','Incomplete/foreign owner cannot publish an HD action ticket');
}

test('complete original battle publishes an opaque current ticket without storage or native input',()=>{
    const f=fixture(), before=[...f.storage]; const t=interactive(f);
    assert.equal(t.libraryGeneration,3);assert.equal(t.kind,1);assert.equal(t.seq,20);assert.equal(t.actor,255);
    assert.equal(typeof t.key,'string');assert.equal(typeof t.stableKey,'string');
    assert.deepEqual([...f.storage],before);noAction(f);
});
test('initialization is idempotent and configures the shared battle with pure providers',()=>{
    const f=fixture();f.host.init();f.host.init();
    assert.equal(f.counts.configured.length,1);
    for(const name of ['isAvailable','readTicket','render'])assert.equal(typeof f.shared.provider[name],'function');
    assert.ok(f.shared.provider.readTicket());noAction(f);
});
for(const patch of [{status:'pending'},{status:'error'},{sha256:'0'.repeat(64)},{byteLength:207194},{generation:0}]) {
    test('original identity fails closed: '+JSON.stringify(patch),()=>{const f=fixture();f.identity(patch);assert.equal(f.host.readNativeTicket(),null);noAction(f);});
}
test('engine ready false retires the publication',()=>{const f=fixture();f.state.ready=false;assert.equal(f.host.readNativeTicket(),null);noAction(f);});
test('foreign page cannot mount a mobile battle owner',()=>{const f=fixture();f.document.body.classList.remove('hd-mobile-page');unavailable(f);noAction(f);});
test('native data rebound during a public getter cannot combine two worlds',()=>{
    const f=fixture();let once=true;f.state.fightHook=()=>{if(once){once=false;f.state.data=Object.assign(Object.create(null),f.raw);}};
    unavailable(f);noAction(f);
});
test('identity generation changed by a native getter cannot authorize the previous owner',()=>{
    const f=fixture();let once=true;f.state.fightHook=()=>{if(once){once=false;f.identity({generation:4});}};unavailable(f);noAction(f);
});
test('opaque data is never serialized by ticket, refresh or diagnostics',()=>{
    const f=fixture();interactive(f);f.host.refresh();JSON.stringify(f.host.debugSnapshot());assert.equal(f.counts.serialized,0);noAction(f);
});
test('focus changes replace the exact key while preserving the gesture stable owner',()=>{
    const f=fixture(),before=interactive(f);f.raw.g_FoucsX=5;const after=interactive(f);
    assert.notEqual(after.key,before.key);assert.equal(after.stableKey,before.stableKey);noAction(f);
});
test('menu index changes preserve stable owner but actual names belong to that owner',()=>{
    const f=fixture();f.nativeMenu();const before=interactive(f);f.raw.g_hdMenuIndex=1;const index=interactive(f);
    assert.notEqual(index.key,before.key);assert.equal(index.stableKey,before.stableKey);
    f.state.menuNames[1]='新计谋';assert.notEqual(interactive(f).stableKey,index.stableKey);noAction(f);
});
test('native sequence, actor, unit publication and masks are part of the stable owner',()=>{
    const mutations=[f=>f.raw.g_hdFightInputSeq++,f=>f.raw.g_hdFightActor=1,
        f=>f.raw.g_GenPos[0].mp--,f=>f.raw.g_GenPos[10].state=1,
        f=>f.raw.g_FgtParam.GenArray[1]=146];
    for(const change of mutations){const f=fixture(),before=interactive(f);change(f);const after=f.host.readNativeTicket();
        assert.ok(!after||after.stableKey!==before.stableKey);noAction(f);}
});
for(const name of ['g_hdEngineReady','g_hdDetailGeneration','g_PIdx',
    'g_hdFightActive','g_hdFightOver','g_hdFightWait','g_hdFightPhase','g_hdFightAimType','g_hdFightInputKind',
    'g_hdFightInputSeq','g_hdFightActor','g_FoucsX','g_FoucsY','g_MapWid','g_MapHgt']) {
    test('missing native publication cannot become an HD ticket: '+name,()=>{const f=fixture();delete f.raw[name];unavailable(f);noAction(f);});
}
for(const name of ['g_hdReportActive','g_hdHelpActive','g_hdViewActive','g_hdMovieActive','g_hdSpeActive',
    'g_hdSkillActive','g_hdAttackActive','g_hdSkillResultActive','g_hdRecordActive','g_hdMakerActive','g_hdMiniMapActive','g_hdQtyActive']) {
    test('foreign native owner returns to the LCD without inventing an action: '+name,()=>{
        const f=fixture();f.raw[name]=1;unavailable(f);f.host.refresh();noAction(f);
    });
}
test('native BUSY is an LCD publication, not a synthetic clickable phase',()=>{
    const f=fixture();f.raw.g_hdFightInputKind=0;f.raw.g_hdFightWait=0;unavailable(f);f.host.refresh();noAction(f);
});
for(const change of [f=>f.raw.g_FgtParam.GenArray.pop(),f=>f.raw.g_GenPos.pop(),f=>f.raw.g_FgtParam.GenArray[0]=65536,
    f=>f.raw.g_GenPos[0].x=NaN,f=>f.raw.g_GenPos[0].state=undefined,
    f=>f.raw.g_FgtParam.GenArray[0]=201]) {
    test('incomplete, reused or invalid full roster cannot authorize a tile: '+change.toString(),()=>{const f=fixture();change(f);unavailable(f);noAction(f);});
}
test('incomplete action names/count/index cannot authorize a menu',()=>{
    for(const change of [f=>f.raw.g_hdMenuCount=4,f=>f.raw.g_hdMenuIndex=3,f=>f.state.menuNames[0]='',f=>f.raw.g_hdMenuContext=1]) {
        const f=fixture();f.nativeMenu();change(f);unavailable(f);noAction(f);
    }
});
test('menu read which changes the native owner is rejected before publication',()=>{
    const f=fixture();f.nativeMenu();let calls=0;f.state.menuHook=()=>{if(++calls===2)f.raw.g_hdFightInputSeq++;};unavailable(f);noAction(f);
});
test('portrait and hidden document retire HD ownership without any native input',()=>{
    for(const mutate of [f=>{f.window.innerWidth=390;f.window.innerHeight=844;},f=>{f.document.hidden=true;}]){
        const f=fixture();mutate(f);f.host.refresh();unavailable(f);noAction(f);
    }
});

test('provider publication never recursively calls the shared input-ticket getter',()=>{
    const f=fixture();const before=f.counts.sharedReads;
    for(let i=0;i<4;i++){f.host.readNativeTicket();f.shared.provider.readTicket();}
    assert.equal(f.counts.sharedReads,before);noAction(f);
});
test('known busy/report owners keep a current LCD ticket rather than an actionable synthetic menu',()=>{
    for(const change of [f=>{f.raw.g_hdFightInputKind=0;f.raw.g_hdFightWait=0;},f=>f.raw.g_hdReportActive=1]){
        const f=fixture();change(f);const t=f.host.readNativeTicket();
        assert.ok(t);assert.equal(t.data,f.data);assert.equal(t.presentation,'lcd');f.host.refresh();
        assert.equal(f.host.debugSnapshot().presentation,'lcd');noAction(f);
    }
});
test('MOVE owns all 225 path bytes and AIM owns its complete current native extent',()=>{
    const f=fixture();f.raw.g_hdFightActor=0;f.raw.g_hdFightInputKind=2;const before=interactive(f);f.raw.g_FightPath[224]=1;
    assert.notEqual(interactive(f).stableKey,before.stableKey);f.raw.g_FightPath.pop();unavailable(f);noAction(f);
    const g=fixture();g.raw.g_hdFightActor=0;g.raw.g_hdFightInputKind=5;g.raw.g_FgtAtkRng.splice(0,3,3,0,0);const aim=interactive(g);
    g.raw.g_FgtAtkRng[11]=1;assert.notEqual(interactive(g).stableKey,aim.stableKey);
    g.raw.g_FgtAtkRng.length=11;unavailable(g);noAction(g);
});
test('AIM cannot publish an oversized, fractional, zero or incomplete mask',()=>{
    for(const size of [0,16,1.5,undefined]){const f=fixture();f.raw.g_hdFightInputKind=5;f.raw.g_FgtAtkRng[0]=size;unavailable(f);noAction(f);}
});
test('renderer exposes cells of at least 44 CSS pixels in both supported landscape sizes',()=>{
    for(const [width,height,boardWidth,boardHeight] of [[844,390,640,294],[667,375,463,279]]){
        const f=fixture();f.window.innerWidth=width;f.window.innerHeight=height;
        f.board.rect=f.canvas.rect={left:0,top:52,width:boardWidth,height:boardHeight};
        const s=f.render();assert.ok(s.camera.cell>=44);assert.ok(s.camera.cols>0&&s.camera.rows>0);
        assert.ok(s.camera.cols*s.camera.cell<=boardWidth);assert.ok(s.camera.rows*s.camera.cell<=boardHeight);noAction(f);
    }
});
test('one trusted board DOWN-UP delivers only the native tile under that gesture',()=>{
    const f=fixture(),{camera:c}=f.render();
    const point={clientX:c.left+(4-c.x+.5)*c.cell,clientY:c.top+(16-c.y+.5)*c.cell};
    f.tap(f.canvas,point);assert.deepEqual(f.counts.actions,[['tile',4,16]]);
    assert.ok(f.counts.sharedReads>=3,'Gesture takes two independent DOWN reads and a fresh UP owner read');
    assert.deepEqual(f.counts.keys,[]);assert.deepEqual(f.counts.writes,[]);assert.equal(f.counts.serialized,0);
});
test('small pointer motion below the tap threshold still delivers a single tile',()=>{
    const f=fixture(),{camera:c}=f.render();const p={clientX:c.left+(4-c.x+.5)*c.cell,clientY:c.top+(16-c.y+.5)*c.cell};
    f.fire('pointerdown',f.canvas,p);f.fire('pointermove',f.canvas,{clientX:p.clientX+3,clientY:p.clientY+2});
    f.fire('pointerup',f.canvas,{clientX:p.clientX+3,clientY:p.clientY+2});f.fire('click',f.canvas,p);
    assert.deepEqual(f.counts.actions,[['tile',4,16]]);assert.deepEqual(f.counts.keys,[]);
});
test('dragging the board pans the camera and cannot issue a native tile or compatibility click',()=>{
    const f=fixture(),before=f.render().camera;
    f.fire('pointerdown',f.canvas,{clientX:500,clientY:200});f.fire('pointermove',f.canvas,{clientX:350,clientY:200});
    f.fire('pointerup',f.canvas,{clientX:350,clientY:200});f.fire('click',f.canvas,{clientX:350,clientY:200});
    const after=f.host.debugSnapshot().camera;assert.notEqual(after.x,before.x);assert.equal(after.y,before.y);noAction(f);
});
test('focus control restores a panned view without native keys or world writes',()=>{
    const f=fixture();f.render();f.fire('pointerdown',f.canvas,{clientX:500,clientY:200});
    f.fire('pointermove',f.canvas,{clientX:350,clientY:200});f.fire('pointerup',f.canvas,{clientX:350,clientY:200});
    const panned=f.host.debugSnapshot().camera.x;f.tap(f.focus);
    assert.notEqual(f.host.debugSnapshot().camera.x,panned);noAction(f);
});
test('a trusted system button tap dispatches once while every compatibility click is consumed',()=>{
    const f=fixture();f.tap(f.sys);f.fire('click',f.sys);f.fire('click',f.sys,{isTrusted:false,detail:0});
    assert.deepEqual(f.counts.actions,[['system']]);assert.deepEqual(f.counts.keys,[]);assert.equal(f.counts.serialized,0);
});
test('bare click or untrusted DOWN-UP cannot reach any shared action',()=>{
    const f=fixture();f.render();for(const target of [f.canvas,f.sys,f.cancel,f.mode]){
        assert.equal(f.fire('click',target,{isTrusted:false}).prevented,true);
        f.tap(target,{isTrusted:false});
    }noAction(f);
});
test('menu pointer chooses the current native index once and never infers an action by label',()=>{
    const f=fixture();f.nativeMenu(3,['攻击','计谋','休息']);
    const b=f.nodes.get('menu-exit');b.setAttribute('data-hd-battle-menu','2');b.removeAttribute('data-hd-battle-menu-exit');
    f.tap(b);assert.deepEqual(f.counts.actions,[['menu',2]]);assert.deepEqual(f.counts.keys,[]);
});
for(const [name,mutate] of [
    ['input sequence',f=>f.raw.g_hdFightInputSeq++],['actor',f=>f.raw.g_hdFightActor=1],
    ['focus',f=>f.raw.g_FoucsX=5],['unit MP',f=>f.raw.g_GenPos[0].mp--],
    ['roster order',f=>f.raw.g_FgtParam.GenArray.reverse()],['detail generation',f=>f.raw.g_hdDetailGeneration++],
    ['library generation',f=>f.identity({generation:4})],['data identity',f=>{f.state.data={...f.raw};}],
    ['report owner',f=>f.raw.g_hdReportActive=1],['result owner',f=>f.raw.g_hdResultOwnerValid=1]
]) {
    test('a held control cannot dispatch after '+name+' changes',()=>{
        const f=fixture();f.fire('pointerdown',f.sys);mutate(f);f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
    });
}
test('changing any native menu item retires a held menu control',()=>{
    const f=fixture();f.nativeMenu();f.fire('pointerdown',f.menuExit);f.state.menuNames[1]='换了实际菜单';
    f.fire('pointerup',f.menuExit);f.fire('click',f.menuExit);noAction(f);
});
test('second finger outside the battle blocks the original held operation until all fingers lift',()=>{
    const f=fixture();f.fire('pointerdown',f.sys);f.fire('pointerdown',f.outside,{pointerId:2,isPrimary:false});
    f.fire('pointerup',f.sys);f.fire('click',f.sys);f.fire('pointerup',f.outside,{pointerId:2,isPrimary:false});noAction(f);
    f.tap(f.sys);assert.deepEqual(f.counts.actions,[['system']]);
});
for(const type of ['pointercancel','lostpointercapture']) {
    test(type+' retires a held operation and its later compatibility click',()=>{
        const f=fixture();f.fire('pointerdown',f.sys);f.fire(type,f.sys);f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
    });
}
for(const type of ['resize','orientationchange','blur','pagehide']) {
    test(type+' cannot replay a held control after the boundary',()=>{
        const f=fixture();f.fire('pointerdown',f.sys);f.globalEvent(type);f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
    });
}
test('a hidden page retires held input and reopening requires a new trusted gesture',()=>{
    const f=fixture();f.fire('pointerdown',f.sys);f.document.hidden=true;f.fire('visibilitychange',f.canvas);
    f.document.hidden=false;f.fire('visibilitychange',f.canvas);f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
    f.render();f.host.refresh();
    f.tap(f.sys);assert.deepEqual(f.counts.actions,[['system']]);
});
test('pointer ID, primary status, right button or different release control cannot consume a tap',()=>{
    const variants=[f=>f.fire('pointerup',f.sys,{pointerId:2}),f=>f.fire('pointerup',f.sys,{isPrimary:false}),
        f=>f.fire('pointerup',f.cancel),f=>f.fire('pointerup',f.sys,{isTrusted:false})];
    for(const release of variants){const f=fixture();f.fire('pointerdown',f.sys);release(f);f.fire('click',f.sys);noAction(f);}
    const f=fixture();f.tap(f.sys,{button:2});noAction(f);
});
test('geometry displacement or an external occluder prevents a held control from dispatching',()=>{
    for(const mutate of [f=>f.sys.rect.left++,f=>f.state.top=f.outside,f=>f.root.style.opacity='0',f=>f.root.hidden=true]){
        const f=fixture();f.fire('pointerdown',f.sys);mutate(f);f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
    }
});
test('refresh while a foreign native report owns input retires a held HD gesture',()=>{
    const f=fixture();f.fire('pointerdown',f.sys);f.raw.g_hdReportActive=1;f.host.refresh();
    assert.equal(f.host.debugSnapshot().armed,false);assert.equal(f.host.debugSnapshot().presentation,'lcd');
    f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
});
test('native U16 HP and MP above 255 remain exact rather than being truncated or rejected',()=>{
    const f=fixture();f.raw.g_GenPos[0].hp=1024;f.raw.g_GenPos[0].mp=512;const t=interactive(f);
    assert.equal(t.native.units[0].hp,1024);assert.equal(t.native.units[0].mp,512);noAction(f);
});
test('native move is a U8 publication and movement changes retire a held control',()=>{
    const f=fixture(),before=interactive(f);f.raw.g_GenPos[0].move=3;
    assert.notEqual(interactive(f).stableKey,before.stableKey);
    f.fire('pointerdown',f.sys);f.raw.g_GenPos[0].move=2;f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
    f.raw.g_GenPos[0].move=256;unavailable(f);
});
test('shared showLcd explicitly wins over a ready HD native ticket and blocks stale gestures',()=>{
    const f=fixture();f.render();f.fire('pointerdown',f.sys);f.state.showLcd=true;f.host.refresh();
    assert.equal(f.host.debugSnapshot().presentation,'lcd');f.counts.paints.length=0;f.render();assert.deepEqual(f.counts.paints,[]);
    f.fire('pointerup',f.sys);f.fire('click',f.sys);noAction(f);
});
test('header mode control can restore a classic LCD battle without changing any native state',()=>{
    const f=fixture();f.state.mode='classic';f.host.refresh();assert.equal(f.host.debugSnapshot().presentation,'lcd');
    assert.equal(f.headerMode.hidden,false);f.tap(f.headerMode);
    assert.deepEqual(f.counts.modes,['hd']);assert.equal(f.host.debugSnapshot().presentation,'lcd');
    f.render();f.host.refresh();assert.equal(f.host.debugSnapshot().presentation,'hd');
    assert.equal(f.storage.get('baye/battleMode'),'classic');assert.equal(f.storage.get('baye/overworldMode'),'classic');noAction(f);
});
test('camera pan from an old opaque data world is not carried into a rebound native world',()=>{
    const f=fixture();f.render();f.fire('pointerdown',f.canvas,{clientX:500,clientY:200});
    f.fire('pointermove',f.canvas,{clientX:350,clientY:200});f.fire('pointerup',f.canvas,{clientX:350,clientY:200});
    const old=f.host.debugSnapshot().camera.x;assert.ok(old>0);
    f.state.data={...f.raw};f.host.refresh();f.render();assert.notEqual(f.host.debugSnapshot().camera.x,old);noAction(f);
});
test('PICK actor255 and dead empty slots on both sides remain a legitimate native board',()=>{
    const f=fixture();f.raw.g_GenPos[2].x=255;f.raw.g_GenPos[12].y=255;
    const t=interactive(f);assert.equal(t.actor,255);assert.equal(t.native.units.length,20);
    assert.equal(t.native.units[2].id,0);assert.equal(t.native.units[12].state,8);noAction(f);
});
test('actor255 is not a live actor for MOVE or ACTION even with a complete roster',()=>{
    for(const kind of [2,3,4,5]){const f=fixture();f.raw.g_hdFightInputKind=kind;
        if(kind===5)f.raw.g_FgtAtkRng.splice(0,3,3,0,0);unavailable(f);noAction(f);}
});
for(const field of ['key','stableKey','libraryGeneration','kind','seq','actor']){
    test('render payload cannot borrow a stale shared owner '+field,()=>{
        const f=fixture(),payload=f.renderPayload();payload.renderOwner[field]=typeof payload.renderOwner[field]==='number'?-1:'old';
        f.counts.paints.length=0;f.shared.provider.render(payload);f.host.refresh();
        assert.deepEqual(f.counts.paints,[]);assert.equal(f.host.debugSnapshot().presentation,'lcd');
        f.tap(f.sys);noAction(f);
    });
}
test('a render without any owner remains LCD and cannot reuse an earlier camera for input',()=>{
    const f=fixture(),payload=f.renderPayload();delete payload.renderOwner;f.counts.paints.length=0;
    f.shared.provider.render(payload);f.host.refresh();f.tap(f.canvas);f.tap(f.focus);
    assert.deepEqual(f.counts.paints,[]);assert.equal(f.host.debugSnapshot().presentation,'lcd');noAction(f);
});
test('focus ACK requires a new full-owner render before pan or focus reuse',()=>{
    const f=fixture(),payload=f.renderPayload();f.raw.g_FoucsX=5;f.counts.paints.length=0;
    f.shared.provider.render(payload);f.host.refresh();f.tap(f.focus);assert.deepEqual(f.counts.paints,[]);noAction(f);
    f.render();f.host.refresh();assert.equal(f.host.debugSnapshot().presentation,'hd');f.tap(f.sys);
    assert.deepEqual(f.counts.actions,[['system']]);
});
test('equal primitive render owner cannot borrow the previous opaque native data object',()=>{
    const f=fixture(),payload=f.renderPayload(),oldTicket=f.shared.getInputTicket();f.state.data={...f.raw};
    f.shared.getInputTicket=()=>oldTicket;f.counts.paints.length=0;f.shared.provider.render(payload);f.host.refresh();
    assert.deepEqual(f.counts.paints,[]);assert.equal(f.host.debugSnapshot().presentation,'lcd');noAction(f);
});
test('a previously rendered object stays bound to its old data even when both current tickets have equal keys',()=>{
    const f=fixture(),payload=f.renderPayload();f.shared.provider.render(payload);const oldKey=f.host.readNativeTicket().key;
    f.state.data={...f.raw};assert.equal(f.host.readNativeTicket().key,oldKey);
    assert.equal(f.shared.getInputTicket().data,f.state.data);f.counts.paints.length=0;
    f.shared.provider.render(payload);f.host.refresh();assert.deepEqual(f.counts.paints,[]);
    assert.equal(f.host.debugSnapshot().presentation,'lcd');f.tap(f.sys);noAction(f);
    f.render();f.host.refresh();assert.equal(f.host.debugSnapshot().presentation,'hd');
});
test('trusted recognized physical keys delegate once in HD and never use the direct engine sender',()=>{
    const f=fixture();const event=f.fire('keydown',f.document.body,{key:'ArrowRight',keyCode:39,repeat:false});
    assert.equal(event.prevented,true);assert.deepEqual(f.counts.actions,[['keyboard','ArrowRight']]);
    assert.deepEqual(f.counts.keys,[]);assert.deepEqual(f.counts.writes,[]);
});
test('untrusted and repeated HD keys are swallowed without delegating an action',()=>{
    for(const patch of [{isTrusted:false},{repeat:true}]){const f=fixture();
        const e=f.fire('keydown',f.document.body,{key:'Enter',keyCode:13,repeat:false,...patch});assert.equal(e.prevented,true);noAction(f);}
});
test('LCD, foreign native owner, unknown keys and composition preserve the real page keyboard path',()=>{
    for(const change of [f=>{f.state.mode='classic';f.host.refresh();},f=>{f.raw.g_hdReportActive=1;f.host.refresh();}]){
        const f=fixture();change(f);const e=f.fire('keydown',f.document.body,{key:'Enter',keyCode:13});assert.equal(e.prevented,false);noAction(f);}
    for(const patch of [{key:'Tab',keyCode:9},{key:'Enter',keyCode:13,isComposing:true}]){const f=fixture();
        const e=f.fire('keydown',f.document.body,patch);assert.equal(e.prevented,false);noAction(f);}
});
test('an owner change after HD paint blocks recognized keys until a fresh shared render',()=>{
    const f=fixture();f.raw.g_hdFightInputSeq++;const e=f.fire('keydown',f.document.body,{key:'Enter',keyCode:13});
    assert.equal(e.prevented,true);assert.equal(f.host.debugSnapshot().presentation,'lcd');noAction(f);
});
test('the real two-item SKILL publication owns its IDs and names and remains touch actionable',()=>{
    const f=fixture();f.nativeMenu(4,['谍报','践踏']);f.raw.g_hdSkillIds[1]=18;f.render();f.host.refresh();
    const t=interactive(f);assert.equal(t.kind,4);assert.equal(t.native.skillActive,1);
    assert.deepEqual(Array.from(t.native.skills.ids),[1,18]);assert.deepEqual(Array.from(t.native.skills.names),['谍报','践踏']);
    assert.equal(f.host.debugSnapshot().presentation,'hd');
    f.menuExit.setAttribute('data-hd-battle-menu','1');f.menuExit.removeAttribute('data-hd-battle-menu-exit');
    f.tap(f.menuExit);assert.deepEqual(f.counts.actions,[['menu',1]]);assert.deepEqual(f.counts.keys,[]);
    assert.deepEqual(f.counts.writes,[]);assert.equal(f.counts.serialized,0);
});
for(const [name,change] of [
    ['inactive',f=>f.raw.g_hdSkillActive=0],['invalid active',f=>f.raw.g_hdSkillActive=2],
    ['missing active',f=>delete f.raw.g_hdSkillActive],['zero count',f=>f.raw.g_hdSkillCount=0],
    ['count differs from menu',f=>f.raw.g_hdSkillCount=1],['native capacity exceeded',f=>f.raw.g_hdSkillCount=11],
    ['missing count',f=>delete f.raw.g_hdSkillCount],['wrong name stride',f=>f.raw.g_hdSkillNameLen=8],
    ['missing ID storage',f=>delete f.raw.g_hdSkillIds],['short ID storage',f=>f.raw.g_hdSkillIds.length=1],
    ['zero ID',f=>f.raw.g_hdSkillIds[1]=0],['sentinel ID',f=>f.raw.g_hdSkillIds[1]=65535],
    ['fractional ID',f=>f.raw.g_hdSkillIds[1]=1.5],['missing native name bytes',f=>delete f.raw.g_hdSkillNameBytes],
    ['short native name bytes',f=>f.raw.g_hdSkillNameBytes.length=15],
    ['public active differs',f=>f.state.skillsOverride={active:0,count:2,ids:[1,2],names:['谍报','践踏']}],
    ['public count differs',f=>f.state.skillsOverride={active:1,count:1,ids:[1,2],names:['谍报','践踏']}],
    ['public IDs differ',f=>f.state.skillsOverride={active:1,count:2,ids:[1,3],names:['谍报','践踏']}],
    ['public ID list short',f=>f.state.skillsOverride={active:1,count:2,ids:[1],names:['谍报','践踏']}],
    ['public names differ',f=>f.state.skillsOverride={active:1,count:2,ids:[1,2],names:['谍报','别的技能']}],
    ['public name empty',f=>f.state.skillsOverride={active:1,count:2,ids:[1,2],names:['谍报','']}],
    ['public name list short',f=>f.state.skillsOverride={active:1,count:2,ids:[1,2],names:['谍报']}]
]){
    test('SKILL publication rejects '+name,()=>{const f=fixture();f.nativeMenu(4,['谍报','践踏']);change(f);
        unavailable(f);f.host.refresh();f.tap(f.menuExit);noAction(f);});
}
test('SKILL-active cannot authorize any other native input kind',()=>{
    for(const kind of [0,1,2,3,5,6,7,8,9,10]){const f=fixture();f.raw.g_hdSkillActive=1;f.raw.g_hdFightInputKind=kind;
        unavailable(f);f.host.refresh();f.tap(f.sys);noAction(f);}
});
test('skill list identity and full name bytes retire a held control without changing the menu sequence',()=>{
    for(const mutate of [f=>f.raw.g_hdSkillIds[1]=3,f=>f.raw.g_hdSkillNameBytes[15]=1,
        f=>{f.state.menuNames[1]='新计谋';}]){
        const f=fixture();f.nativeMenu(4,['谍报','践踏']);const before=interactive(f);
        f.fire('pointerdown',f.menuExit);mutate(f);assert.notEqual(f.host.readNativeTicket()?.key,before.key);
        f.fire('pointerup',f.menuExit);f.fire('click',f.menuExit);noAction(f);
    }
});
test('a skills getter that replaces the owner cannot publish a mixed list',()=>{
    const f=fixture();f.nativeMenu(4,['谍报','践踏']);let once=true;
    f.state.skillsHook=()=>{if(once){once=false;f.raw.g_hdFightInputSeq++;}};unavailable(f);noAction(f);
});
test('a genuine skill-result animation still owns the LCD despite a valid SKILL list',()=>{
    const f=fixture();f.nativeMenu(4,['谍报','践踏']);f.raw.g_hdSkillResultActive=1;unavailable(f);
    f.host.refresh();assert.equal(f.host.debugSnapshot().presentation,'lcd');f.tap(f.menuExit);noAction(f);
});
test('the first physical Enter or Escape after native HELP/VIEW/report handoff reaches the LCD before the poll',()=>{
    for(const change of [f=>{f.raw.g_hdFightInputKind=9;f.raw.g_hdFightWait=0;},
        f=>{f.raw.g_hdFightInputKind=10;f.raw.g_hdFightWait=0;},f=>{f.raw.g_hdReportActive=1;}]){
        for(const [key,keyCode] of [['Enter',13],['Escape',27]]){
            const f=fixture();assert.equal(f.host.debugSnapshot().presentation,'hd');change(f);
            const event=f.fire('keydown',f.document.body,{key,keyCode});
            assert.equal(event.prevented,false);assert.equal(event.stopped,false);
            assert.equal(f.host.debugSnapshot().presentation,'lcd');noAction(f);
        }
    }
});
test('shared LCD or classic handoff also passes the first physical key without waiting for refresh',()=>{
    for(const change of [f=>f.state.showLcd=true,f=>f.state.mode='classic']){
        const f=fixture();assert.equal(f.host.debugSnapshot().presentation,'hd');change(f);
        const event=f.fire('keydown',f.document.body,{key:'Enter',keyCode:13});
        assert.equal(event.prevented,false);assert.equal(event.stopped,false);
        assert.equal(f.host.debugSnapshot().presentation,'lcd');noAction(f);
    }
});
