// Real shared selector + mobile host, with controlled native publication/ACKs.
// No browser, service, native engine or user storage is accessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sharedSource = readFileSync(new URL('../js/hd-system-ui.js', import.meta.url), 'utf8');
const hostSource = readFileSync(new URL('../js/hd-mobile-system.js', import.meta.url), 'utf8');
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const RAW = ['g_hdEngineReady', 'g_hdDetailGeneration', 'g_hdSpeGeneration', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind',
    'g_hdMenuSeq', 'g_hdMenuCount', 'g_hdMenuIndex', 'g_hdRecordActive', 'g_hdRecordMode', 'g_hdRecordIndex', 'g_hdRecordCount',
    'g_hdRecordSeq', 'g_hdMapPick', 'g_hdBattlePick', 'g_hdMapCity', 'g_hdMapInputSeq', 'g_hdMarchPhase',
    'g_hdReportActive', 'g_hdQtyActive', 'g_hdHelpActive', 'g_hdFightActive', 'g_hdMovieActive', 'g_hdSpeActive',
    'g_hdSkillActive', 'g_hdAttackActive', 'g_hdSkillResultActive', 'g_hdMakerActive', 'g_hdViewActive', 'g_hdMiniMapActive',
    'g_hdGoodsActive', 'g_hdPersonPropertiesActive', 'g_hdResultOwnerKind', 'g_hdResultOwnerValid'];

function fixture({screen = 'title', acknowledge = true, mount = true, storageThrows = false} = {}) {
    const listeners = new Map(), windowListeners = new Map(), timers = new Map(), intervals = new Map(), subscribers = [];
    const nodes = new Map(), keys = [], writes = [];
    let clock = 0, timerId = 0, topOverride = null, menuHook = null, inspectHook = null, currentIdentity;
    class Element {
        constructor(id = '', tag = 'div') {
            this.id = id; this.tagName = tag.toUpperCase(); this.nodeType = 1; this.children = []; this.attrs = {};
            this.hidden = this.disabled = false; this.isConnected = true; this.textContent = ''; this.className = '';
            this.rect = {left: 10, top: 70, width: 180, height: 44}; this.style = {display: 'block', visibility: 'visible', opacity: '1'};
            this.events = new Map(); this.scrollTop = 0;
            this.classList = {contains: name => this.className.split(/\s+/).includes(name),
                add: name => { if (!this.classList.contains(name)) this.className += ' ' + name; },
                toggle: (name, on) => { const yes = on ?? !this.classList.contains(name); this.className = this.className.split(/\s+/).filter(x => x && x !== name).join(' '); if (yes) this.classList.add(name); }};
            if (id) nodes.set(id, this);
        }
        setAttribute(name, value) { this.attrs[name] = String(value); }
        getAttribute(name) { return this.attrs[name] ?? null; }
        appendChild(child) { child.parentElement = child.parentNode = this; this.children.push(child); return child; }
        set innerHTML(value) { this.html = value; this.children.forEach(n => { n.isConnected = false; }); this.children = []; }
        get innerHTML() { return this.html || ''; }
        getBoundingClientRect() { return {...this.rect}; }
        contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; }
        querySelector(selector) { return this.children.find(n => selector.split('.').slice(1).every(c => n.classList.contains(c))) || null; }
        querySelectorAll() { return []; }
        addEventListener(name, fn) { const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list); }
        scrollIntoView() { throw Error('mobile polling must not scroll the list'); }
    }
    const html = new Element('html'), body = html.appendChild(new Element('body', 'body')); body.className = 'hd-mobile-page';
    const root = body.appendChild(new Element('hd-system-ui'));
    for (const id of ['hd-system-ui-title', 'hd-system-ui-sub', 'hd-system-ui-list', 'hd-system-ui-probe']) root.appendChild(new Element(id));
    const list = nodes.get('hd-system-ui-list'), back = root.appendChild(new Element('back', 'button')); back.setAttribute('data-hd-sys-back', ''); back.rect.top = 290;
    const mode = body.appendChild(new Element('hd-mobile-system-mode', 'button')), open = body.appendChild(new Element('hd-mobile-system-open', 'button'));
    mode.rect = {left: 600, top: 4, width: 90, height: 44}; open.rect = {left: 700, top: 4, width: 60, height: 44};
    const outside = body.appendChild(new Element('outside')); outside.rect = {left: 400, top: 300, width: 70, height: 44};
    const document = {body, documentElement: html, hidden: false, getElementById: id => nodes.get(id) || null,
        createElement: tag => new Element('', tag), addEventListener(name, fn) { const list = listeners.get(name) || []; list.push(fn); listeners.set(name, list); },
        elementFromPoint(x, y) { return topOverride || [mode, open, back, ...list.children].find(n => !n.hidden && x >= n.rect.left && x < n.rect.left + n.rect.width && y >= n.rect.top && y < n.rect.top + n.rect.height) || outside; }};
    const values = {'baye/systemUiMode': 'classic', 'baye/overworldMode': 'classic', 'baye/mobileOverworldMode': 'hd-map'};
    const storage = {getItem: key => { if (storageThrows) throw Error('blocked'); return values[key] ?? null; },
        setItem(key, value) { if (storageThrows) throw Error('blocked'); writes.push([key, value]); values[key] = value; }};
    let data = Object.fromEntries(RAW.map(name => [name, 0]));
    Object.assign(data, {g_hdEngineReady: 1, g_hdDetailGeneration: 7, g_hdSpeGeneration: 9, g_hdMenuSeq: 12, g_hdRecordSeq: 15,
        g_hdMapInputSeq: 8, g_hdMapCity: 16, g_PIdx: 1, g_PlayerKing: 0, g_Cities: [{Belong: 1}]});
    data.circular = data; data.toJSON = () => { throw Error('opaque data must not be serialized'); };
    const kings = [{id: 0, name: '董卓'}, {id: 5, name: '马腾'}], slots = Array.from({length: 4}, (_, slot) => ({slot, status: 'empty', canLoad: false}));
    let names = [], ready = true;
    currentIdentity = {status: 'ready', sha256: SHA, byteLength: 207195, generation: 2};
    function publish(which, seq = data.g_hdMenuSeq + 2) {
        Object.assign(data, {g_hdMenuActive: 0, g_hdRecordActive: 0, g_hdMapPick: 0, g_hdMenuIndex: 0, g_hdMenuSeq: seq}); names = [];
        if (which === 'map') data.g_hdMapPick = 1;
        else if (which === 'save' || which === 'load') Object.assign(data, {g_hdRecordActive: 1, g_hdRecordMode: which === 'save' ? 1 : 2,
            g_hdRecordCount: which === 'save' ? 3 : 4, g_hdRecordIndex: 0, g_hdRecordSeq: data.g_hdRecordSeq + 2});
        else {
            const table = {title: [4, 1, 4], period: [4, 2, 4], king: [4, 3, kings.length], insystem: [2, 1, 3], confirm: [2, 2, 1], city: [1, 1, 4]};
            const [context, kind, count] = table[which]; Object.assign(data, {g_hdMenuActive: 1, g_hdMenuContext: context, g_hdMenuKind: kind, g_hdMenuCount: count});
            names = which === 'king' ? kings.map(k => k.name) : which === 'insystem' ? ['策略结束', '存储进度', '结束游戏'] : which === 'confirm' ? ['确定退出'] : [];
        }
    }
    publish(screen);
    const env = {document, localStorage: storage, innerWidth: 844, innerHeight: 390, console: {log() {}, warn() {}},
        Date: class extends Date { static now() { return clock; } },
        setTimeout(fn, delay = 0) { const id = ++timerId; timers.set(id, {fn, at: clock + delay}); return id; }, clearTimeout: id => timers.delete(id),
        setInterval(fn) { const id = ++timerId; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
        addEventListener(name, fn) { const list = windowListeners.get(name) || []; list.push(fn); windowListeners.set(name, list); },
        getComputedStyle: node => node.style, matchMedia: () => ({matches: env.innerWidth > env.innerHeight}),
        mobileTouch: {cancel() {}}, BayeHdOverworld: {getMode: () => values['baye/mobileOverworldMode']},
        BayeHdLibIdentity: {read: () => currentIdentity, isCurrent: candidate => candidate === currentIdentity, subscribe: fn => subscribers.push(fn)},
        BayeSaveStorage: {slots: () => slots.map(s => ({...s})), inspectSlot(index) { inspectHook?.(); return {...slots[index]}; }},
        sendKey(code) { keys.push(code); if (acknowledge && (code === 34 || code === 35)) {
            const field = data.g_hdRecordActive ? 'g_hdRecordIndex' : 'g_hdMenuIndex', count = data.g_hdRecordActive ? data.g_hdRecordCount : data.g_hdMenuCount;
            data[field] = (data[field] + (code === 34 ? -1 : 1) + count) % count;
        } },
        baye: {get data() { return data; }, ensureData: () => data, hd: {ready: () => ready, fight: () => ({active: data.g_hdFightActive, over: 0}),
            maker: () => ({active: data.g_hdMakerActive}), march: () => ({pick: data.g_hdMapPick, battlePick: data.g_hdBattlePick, mapInputSeq: data.g_hdMapInputSeq}),
            menuItems() { menuHook?.(); return {active: data.g_hdMenuActive, context: data.g_hdMenuContext, kind: data.g_hdMenuKind, count: data.g_hdMenuCount,
                index: data.g_hdMenuIndex, seq: data.g_hdMenuSeq, detailGeneration: data.g_hdDetailGeneration, names: names.slice()}; },
            record: () => ({active: data.g_hdRecordActive, mode: data.g_hdRecordMode, index: data.g_hdRecordIndex, count: data.g_hdRecordCount, seq: data.g_hdRecordSeq}),
            kings: () => ({count: kings.length, index: data.g_hdMenuIndex, currentId: kings[data.g_hdMenuIndex]?.id, kings: kings.map(k => ({...k}))})}}};
    env.window = env; const context = vm.createContext(env);
    vm.runInContext(sharedSource, context); vm.runInContext(hostSource, context);
    const api = env.BayeHdMobileSystem, shared = env.BayeHdSystemUi;
    function layout() { list.children.forEach((button, i) => { button.rect = {left: 10 + (i % 2) * 200, top: 100 + Math.floor(i / 2) * 50, width: 180, height: 44}; }); }
    function refresh() { api.refresh(); layout(); }
    if (mount) { api.init(); layout(); }
    function fire(type, target = outside, extra = {}) {
        const r = target.rect, e = {type, target, isTrusted: true, pointerId: 1, isPrimary: true, button: 0, detail: 1,
            clientX: r.left + 5, clientY: r.top + 5, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra};
        for (const fn of listeners.get(type) || []) { fn(e); if (e.stopped) break; }
        if (!e.stopped) for (const fn of root.events.get(type) || []) fn(e);
        return e;
    }
    function click(target) { fire('pointerdown', target); fire('pointerup', target); return fire('click', target); }
    function tick(ms = 200) { const end = clock + ms; let count = 0; while (timers.size) {
        const [id, timer] = [...timers].sort((a,b) => a[1].at - b[1].at)[0]; if (timer.at > end) break;
        assert.ok(++count < 1000); timers.delete(id); clock = timer.at; timer.fn();
    } clock = end; refresh(); }
    return {env, api, shared, nodes, root, list, back, mode, open, outside, keys, writes, values, slots, kings, get data() { return data; },
        publish, refresh, click, fire, tick, timers, intervals,
        windowEvent(name) { (windowListeners.get(name) || []).forEach(fn => fn()); },
        identity(value) { currentIdentity = {...currentIdentity, ...value}; subscribers.forEach(fn => fn(currentIdentity)); },
        rebind() { data = {...data}; data.circular = data; }, setReady(value) { ready = value; },
        setMenuHook(fn) { menuHook = fn; }, setInspectHook(fn) { inspectHook = fn; }, setTop(value) { topOverride = value; },
        button: index => list.children.find(n => n.getAttribute('data-hd-sys') === String(index))};
}

test('mobile is fail-closed before host init and does not read/write the PC preference', () => {
    const h = fixture({mount: false}); assert.equal(h.shared.shouldShowHd(), false); assert.equal(h.shared.isOpen(), false);
    h.api.init(); assert.equal(h.api.snapshot().screen, 'title'); assert.equal(h.api.snapshot().active, true); assert.deepEqual(h.writes, []);
    assert.equal(h.values['baye/systemUiMode'], 'classic');
});
for (const [screen, count] of [['title',4],['period',4],['king',2],['insystem',3],['confirm',1],['save',3],['load',4]]) {
    test(`real ${screen} publication renders ${count} items without engine input`, () => {
        const h = fixture({screen}); assert.equal(h.list.children.length, count); assert.equal(h.api.snapshot().active, true); assert.deepEqual(h.keys, []);
        assert.equal(h.api.readInputTicket().data, h.data);
    });
}
test('title and period accept their native pictorial selector during icon movie', () => {
    for (const screen of ['title','period']) { const h = fixture({screen}); h.data.g_hdMovieActive = h.data.g_hdSpeActive = 1; h.refresh(); assert.equal(h.api.snapshot().active, true); }
});
test('trusted touch follows real Arrow ACK before one final Enter', () => {
    const h = fixture(); h.click(h.button(2)); h.tick(); assert.deepEqual(h.keys, [35,35,39]);
    h.click(h.button(2)); h.tick(); assert.deepEqual(h.keys, [35,35,39]);
});
test('native current item touch sends exactly Enter, not a guessed cursor reset', () => {
    const h = fixture({screen:'king'}); h.click(h.button(0)); assert.deepEqual(h.keys, [39]);
});
test('missing native ACK cannot produce Enter; retirement cancels later work', () => {
    const h = fixture({acknowledge:false}); h.click(h.button(3)); h.tick(1000); assert.deepEqual(h.keys,[35]);
    h.api.retireInteraction('test'); h.tick(10000); assert.deepEqual(h.keys,[35]);
});
test('bare/untrusted clicks and keyboard-generated clicks never authorize input', () => {
    const h = fixture(); h.fire('click', h.button(0)); h.fire('click', h.button(0), {isTrusted:false});
    h.fire('pointerdown', h.button(0), {isTrusted:false}); h.fire('pointerup',h.button(0)); h.fire('click',h.button(0));
    h.fire('keydown',h.button(0),{key:'Enter'}); h.fire('click',h.button(0),{detail:0}); assert.deepEqual(h.keys,[]);
});
for (const boundary of ['pointercancel','scroll','resize','orientationchange','blur','pagehide']) {
    test(`${boundary} retires DOWN and delayed native selection without keys`, () => {
        const h = fixture(); const button = h.button(1); h.fire('pointerdown',button);
        if (['pointercancel','scroll'].includes(boundary)) h.fire(boundary,button); else h.windowEvent(boundary);
        h.fire('pointerup',button); h.fire('click',button); h.tick(); assert.deepEqual(h.keys,[]);
    });
}
test('hidden/portrait immediately retire and restore only fresh current owner', () => {
    const h = fixture(), button = h.button(0); h.fire('pointerdown',button); h.env.document.hidden = true; h.fire('visibilitychange');
    assert.equal(h.api.snapshot().active,false); assert.equal(h.intervals.size,0);
    h.env.document.hidden = false; h.fire('visibilitychange'); h.fire('pointerup',button); h.fire('click',button); assert.deepEqual(h.keys,[]);
    h.env.innerWidth=390; h.env.innerHeight=844; h.windowEvent('orientationchange'); assert.equal(h.api.snapshot().active,false);
    h.env.innerWidth=844; h.env.innerHeight=390; h.windowEvent('orientationchange'); assert.equal(h.api.snapshot().active,true);
});
test('multiple pointers, dragged gesture, changed geometry and covered controls reject', () => {
    for (const cause of ['multi','drag','geometry','cover']) {
        const h=fixture(), b=h.button(0); h.fire('pointerdown',b);
        if(cause==='multi') h.fire('pointerdown',h.outside,{pointerId:2,isPrimary:false});
        if(cause==='drag') h.fire('pointermove',b,{clientY:b.rect.top+20});
        if(cause==='geometry') b.rect.left+=1;
        if(cause==='cover') h.setTop(h.outside);
        h.fire('pointerup',b); h.fire('click',b); assert.deepEqual(h.keys,[],cause);
    }
});
test('same native ticket preserves actual DOM nodes and scroll across polls', () => {
    const h=fixture({screen:'king'}), b=h.button(1); h.list.scrollTop=70;
    h.fire('pointerdown',b); for(let i=0;i<8;i++) h.refresh(); assert.equal(h.button(1),b); assert.equal(h.list.scrollTop,70);
    h.fire('pointerup',b); h.fire('click',b); h.tick(); assert.deepEqual(h.keys,[35,39]);
});
test('real list pan retires input but keeps same-owner shell, nodes and scroll', () => {
    const h=fixture({screen:'king'}), b=h.button(1); h.list.scrollTop=72;
    h.fire('pointerdown',b); h.fire('pointermove',b,{clientY:b.rect.top+25}); h.fire('scroll',h.list);
    assert.equal(h.shared.isOpen(),true); assert.equal(h.button(1),b); assert.equal(h.list.scrollTop,72);
    h.fire('pointerup',b); h.fire('click',b); assert.deepEqual(h.keys,[]);
});
test('stale rendered buttons cannot authorize a new seq before the next render', () => {
    const h=fixture(), b=h.button(0); h.data.g_hdMenuSeq+=2;
    h.click(b); assert.deepEqual(h.keys,[]);
    h.refresh(); const fresh=h.button(0); assert.notEqual(fresh,b); h.click(fresh); assert.deepEqual(h.keys,[39]);
});
test('render binding rejects old nodes after opaque same-values data replacement', () => {
    const h=fixture(), old=h.button(0); h.rebind(); h.click(old); assert.deepEqual(h.keys,[]);
    h.refresh(); h.click(h.button(0)); assert.deepEqual(h.keys,[39]);
});
test('full raw ticket changes rebind buttons despite unchanged menu seq/stable owner', () => {
    const h=fixture(), old=h.button(0), seq=h.data.g_hdMenuSeq; h.data.g_hdMovieActive=1; h.data.g_hdSpeActive=1;
    h.click(old); assert.deepEqual(h.keys,[]); h.refresh(); assert.equal(h.data.g_hdMenuSeq,seq);
    assert.notEqual(h.button(0),old); h.click(h.button(0)); assert.deepEqual(h.keys,[39]);
});
for(const field of ['g_hdMenuSeq','g_hdDetailGeneration','g_hdSpeGeneration','g_hdMenuCount','g_hdMenuIndex']) {
    test(`${field} change rejects old gesture and stale DOM`,()=>{
        const h=fixture(), b=h.button(0); h.fire('pointerdown',b); h.data[field]++;
        h.fire('pointerup',b); h.fire('click',b); assert.deepEqual(h.keys,[]);
    });
}
test('opaque data rebind with identical primitive fields rejects old input',()=>{
    const h=fixture(), b=h.button(0); h.fire('pointerdown',b); h.rebind(); h.fire('pointerup',b); h.fire('click',b); assert.deepEqual(h.keys,[]);
});
for(const [field,value] of [['status','pending'],['sha256','00'.repeat(32)],['byteLength',207194],['generation',0]]) {
    test(`uncertified identity ${field} refuses native display and input`,()=>{
        const h=fixture(); h.identity({[field]:value}); assert.equal(h.api.snapshot().active,false); assert.deepEqual(h.keys,[]);
    });
}
for(const field of ['g_hdFightActive','g_hdQtyActive','g_hdReportActive','g_hdHelpActive','g_hdMakerActive','g_hdSkillActive','g_hdAttackActive',
    'g_hdBattlePick','g_hdViewActive','g_hdMiniMapActive','g_hdGoodsActive','g_hdPersonPropertiesActive','g_hdSkillResultActive','g_hdResultOwnerValid']) {
    test(`competing ${field} retires the system shell`,()=>{
        const h=fixture(); h.data[field]=1; h.refresh(); assert.equal(h.api.snapshot().active,false); assert.deepEqual(h.keys,[]);
    });
}
test('wrong system count/context, half names and invalid king publication fall back',()=>{
    for(const fault of ['context','count','names','kingID','period']) {
        const h=fixture({screen:fault==='kingID'||fault==='period'?'king':'insystem'});
        if(fault==='context') h.data.g_hdMenuContext=1;
        if(fault==='count') h.data.g_hdMenuCount=2;
        if(fault==='names') h.setMenuHook(()=>{ h.data.g_hdMenuCount=4; });
        if(fault==='kingID') h.kings[1].id=65535;
        if(fault==='period') h.data.g_PIdx=0;
        h.refresh(); assert.equal(h.api.snapshot().active,false,fault);
    }
});
test('continuous torn native publication cannot render or input',()=>{
    const h=fixture(); h.setMenuHook(()=>h.data.g_hdMenuSeq++); h.refresh(); assert.equal(h.api.snapshot().active,false);
});
test('save slots are three; load slots four and empty/wrong-LIB/corrupt are disabled',()=>{
    const h=fixture({screen:'load'}); for(const status of ['empty','wrong-lib','incomplete','invalid']) {
        h.slots[0]={slot:0,status,canLoad:false}; h.refresh(); assert.equal(h.button(0).disabled,true); h.click(h.button(0));
    } assert.deepEqual(h.keys,[]);
});
test('load revalidates the actual slot immediately before final Enter',()=>{
    const h=fixture({screen:'load'}); h.slots[1]={slot:1,status:'valid',canLoad:true}; h.refresh(); h.click(h.button(1));
    h.slots[1].canLoad=false; h.tick(); assert.deepEqual(h.keys,[35]);
});
test('storage-triggered owner change refuses final Enter even at current index',()=>{
    const h=fixture({screen:'load'}); h.slots[0]={slot:0,status:'valid',canLoad:true}; h.refresh();
    let calls=0; h.setInspectHook(()=>{if(++calls===2) h.data.g_hdMenuActive=1;}); h.click(h.button(0)); assert.deepEqual(h.keys,[]);
});
test('mobile classic mode keeps real LCD touch surface and fresh HD reattachment',()=>{
    const h=fixture(); h.click(h.mode); assert.equal(h.api.snapshot().mode,'classic'); assert.equal(h.api.snapshot().active,false);
    assert.equal(h.env.document.body.getAttribute('data-hd-mobile-system'),'lcd'); assert.equal(h.values['baye/systemUiMode'],'classic');
    h.click(h.mode); assert.equal(h.api.snapshot().active,true); assert.deepEqual(h.keys,[]);
    assert.ok(h.writes.every(([key])=>key==='baye/mobileSystemUiMode'));
});
test('mobile mode remains usable when storage is blocked',()=>{
    const h=fixture({storageThrows:true}); h.click(h.mode); assert.equal(h.shared.getMode(),'classic'); h.click(h.mode); assert.equal(h.shared.getMode(),'hd');
});
test('MAP system entry is one real EXIT and no guessed root/record',()=>{
    const h=fixture({screen:'map'}); assert.equal(h.open.disabled,false); h.click(h.open); h.click(h.open); assert.deepEqual(h.keys,[40]);
    h.publish('insystem'); h.refresh(); assert.equal(h.api.snapshot().screen,'insystem');
});
test('MAP trusted DOWN survives actual timer polls before UP/click sends one EXIT',()=>{
    const h=fixture({screen:'map'}); h.fire('pointerdown',h.open);
    for(let i=0;i<5;i++) for(const callback of h.intervals.values()) callback();
    h.fire('pointerup',h.open); h.fire('click',h.open); assert.deepEqual(h.keys,[40]);
    for(const callback of h.intervals.values()) callback(); h.click(h.open); assert.deepEqual(h.keys,[40]);
});
for(const change of ['map-seq','map-city','data','native-menu','report']) {
    test(`MAP timer polling rejects armed system entry after ${change} changes`,()=>{
        const h=fixture({screen:'map'}); h.fire('pointerdown',h.open);
        if(change==='map-seq') h.data.g_hdMapInputSeq++;
        if(change==='map-city') h.data.g_hdMapCity++;
        if(change==='data') h.rebind();
        if(change==='native-menu') h.publish('insystem');
        if(change==='report') h.data.g_hdReportActive=1;
        for(const callback of h.intervals.values()) callback();
        h.fire('pointerup',h.open); h.fire('click',h.open); assert.deepEqual(h.keys,[]);
    });
}
test('terminal march7 allows only separately proven MAP; active/unknown phases refuse',()=>{
    for(const phase of [0,1,2,3,4,5,6,7,8]) {
        const h=fixture({screen:'map'}); h.data.g_hdMarchPhase=phase; h.refresh(); assert.equal(h.open.disabled,![0,7].includes(phase));
    }
});
test('real root→exit confirmation→root→record→MAP retires old controls once',()=>{
    const h=fixture({screen:'insystem'}); h.click(h.button(2)); h.tick(); assert.deepEqual(h.keys,[35,35,39]);
    h.publish('confirm'); h.refresh(); assert.equal(h.button(0).textContent,'确定退出'); h.click(h.back); h.click(h.back); assert.equal(h.keys.at(-1),40);
    const count=h.keys.length; h.publish('insystem'); h.refresh(); h.publish('save'); h.refresh(); const old=h.button(0); h.click(old); assert.equal(h.keys.at(-1),39);
    h.publish('map'); h.refresh(); h.fire('click',old); assert.equal(h.api.snapshot().active,false); assert.equal(h.keys.length,count+1);
});
test('init is idempotent, hidden pauses polling and pagehide has no input',()=>{
    const h=fixture(), n=h.intervals.size; h.api.init(); assert.equal(h.intervals.size,n);
    h.env.document.hidden=true; h.fire('visibilitychange'); assert.equal(h.intervals.size,0); assert.deepEqual(h.keys,[]);
});

