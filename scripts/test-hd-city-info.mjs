#!/usr/bin/env node
// Controller contract with the actual read-only bridge and bounded native byte
// publications. This does not run a browser, native game or a saved campaign.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/hd-city-info.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../js/bridge.js', import.meta.url), 'utf8');
const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';

function fixture() {
    const elements = new Map(), windowEvents = new Map(), documentEvents = new Map();
    const keys = [], writes = [], calls = [], cancels = [];
    const hooks = {read:null, ready:null, current:null, cityInfo:null, render:null};
    let mode = 'hd', mapMode = 'hd-map', ready = true, reads = 0;
    function listen(store,name,fn) { const list = store.get(name) || []; list.push(fn); store.set(name,list); }
    function element(id = '', tagName = 'DIV') {
        const attrs = new Map(), classes = new Set();
        const value = {id, tagName, parentElement:null, children:[], hidden:false, disabled:false,
            isConnected:true, isContentEditable:false, scrollTop:0,
            rect:{left:10,top:20,width:80,height:44},
            setAttribute(name,value) { attrs.set(name,String(value)); hooks.render?.(id,name); },
            getAttribute:name=>attrs.has(name)?attrs.get(name):null, hasAttribute:name=>attrs.has(name),
            appendChild(child) { child.parentElement=this; this.children.push(child); },
            contains(child) { for(let n=child;n;n=n.parentElement)if(n===this)return true; return false; },
            getBoundingClientRect() { return {...this.rect}; },
            querySelectorAll(selector) {
                const all=[];function walk(node){for(const child of node.children){if(selector==='[data-hd-city-info-key]'&&child.hasAttribute('data-hd-city-info-key'))all.push(child);walk(child);}}walk(this);return all;
            },
            classList:{toggle(name,on){on?classes.add(name):classes.delete(name);},contains:name=>classes.has(name)}};
        let text='';
        Object.defineProperty(value,'textContent',{get:()=>text+value.children.map(child=>child.textContent).join(''),
            set(next){text=String(next);for(const child of value.children)child.parentElement=null;value.children=[];}});
        return value;
    }
    const ids = ['hd-city-info','hd-city-info-title','hd-city-info-page','hd-city-info-rows',
        'hd-city-info-prev','hd-city-info-next','hd-city-info-confirm','hd-city-info-return','hd-city-info-classic'];
    for(const id of ids)elements.set(id,element(id,/(prev|next|confirm|return|classic)$/.test(id)?'BUTTON':'DIV'));
    const root=elements.get('hd-city-info');for(const item of elements.values())if(item!==root)root.appendChild(item);
    for(const [id,key] of [['prev',34],['next',35],['confirm',39],['return',40]])elements.get('hd-city-info-'+id).setAttribute('data-hd-city-info-key',key);
    const body=element('body');body.appendChild(root);
    const document={body,hidden:false,activeElement:body,getElementById:id=>elements.get(id)||null,
        createElement:tag=>element('',tag.toUpperCase()),addEventListener(name,fn){listen(documentEvents,name,fn);}};
    const raw={g_hdDetailGeneration:7,g_hdEngineReady:1,g_engineConfig:{citiesCount:38}};
    const identity={status:'ready',sha256:SHA,byteLength:207195,generation:3};
    const context=vm.createContext({document,TextDecoder,TextEncoder,Number,JSON,console:{log(){},warn(){}},
        Module:{HEAPU8:new Uint8Array(8192)},alert(){},lcdBlur(){},
        dynLib:'0'.repeat(414390),addEventListener(name,fn){listen(windowEvents,name,fn);},
        setInterval(){return 1;},clearInterval(){},
        BayeHdLibIdentity:{read(){reads++;hooks.read?.(reads);return identity;},
            isCurrent(value){hooks.current?.();return value===identity;}},
        BayeHdCityMenu:{getMode:()=>mode,retireInteraction:reason=>cancels.push(['menu',reason])},
        BayeHdOverworld:{getMode:()=>mapMode,cancelInteraction:reason=>cancels.push(['map',reason])},
        BayeHdMobileCity:{retireInteraction:reason=>cancels.push(['mobile',reason])}});
    context.window=context;
    for(const name of new Set(bridge.match(/\b_baye\w+/g)))context[name]=()=>0;
    context._bayeHdReady=()=>ready?1:0;
    context._bayeGetCityCount=()=>{calls.push('getCityCount');throw Error('extra city getter');};
    vm.runInContext(bridge,context);context.baye_bridge_init();
    const cache=new WeakMap();
    function readonly(value,path='') {
        if(!value||typeof value!=='object')return value;
        if(cache.has(value))return cache.get(value);
        const wrapped=new Proxy(value,{get(object,key){
            if(key==='g_Cities'||key==='g_hdMapCity'){calls.push(key);throw Error('uncaptured native city');}
            return readonly(object[key],path+'.'+String(key));
        },set(object,key){writes.push(path+'.'+String(key));throw Error('native write');}});
        cache.set(value,wrapped);return wrapped;
    }
    context.baye.data=readonly(raw);context.baye.ensureData=()=>context.baye.data;
    context.baye.hooks={};context.baye.sendKey=key=>keys.push(key);
    for(const name of ['getCityName','getPersonName','callHook'])context.baye[name]=()=>{calls.push(name);throw Error('extra getter or hook');};
    const actual=context.baye.hd.cityInfo,actualReady=context.baye.hd.ready;
    context.baye.hd.cityInfo=function(){const value=actual.call(this);hooks.cityInfo?.();return value;};
    context.baye.hd.ready=function(){const value=actualReady.call(this);hooks.ready?.();return value;};
    function publish({start=0,size=5,ack=false,newSession=false}={}) {
        const seq=(raw.g_hdCityInfoSeq||0)+1,session=(raw.g_hdCityInfoSession||1)+(newSession?1:0);
        const input=(raw.g_hdCityInfoInputSeq||1)+(ack?1:0);
        Object.assign(raw,{g_hdCityInfoProtocolVersion:1,g_hdCityInfoActive:1,g_hdCityInfoComplete:1,
            g_hdCityInfoCustom:0,g_hdCityInfoWait:1,g_hdCityInfoSeq:seq,g_hdCityInfoSession:session,
            g_hdCityInfoGeneration:7,g_hdCityInfoInputSeq:input,g_hdCityInfoCity:0,
            g_hdCityInfoPropertyCount:11,g_hdCityInfoPageStart:start,g_hdCityInfoPageSize:size,
            g_hdCityInfoRowCount:Math.min(size,11-start),g_hdCityInfoTitleGbk:new Uint8Array(64),
            g_hdCityInfoRowIndices:new Uint8Array(32),g_hdCityInfoRowText:new Uint8Array(32*128)});
        raw.g_hdCityInfoTitleGbk.set([0xcf,0xe5,0xd1,0xf4]);
        for(let i=0;i<raw.g_hdCityInfoRowCount;i++){
            raw.g_hdCityInfoRowIndices[i]=start+i;
            raw.g_hdCityInfoRowText.set(i===0?[0xd6,0xd0,0xce,0xc4]:new TextEncoder().encode(i===1?'first\nsecond  ':i===2?'':'value '+(start+i)),i*128);
        }
    }
    publish();vm.runInContext(source,context);
    const controller=context.BayeHdCityInfo.createController({window:context,document});controller.start();
    function event(target=body,values={}) {return {target,isTrusted:true,isPrimary:true,button:0,pointerId:1,
        clientX:30,clientY:35,repeat:false,preventDefault(){this.defaultPrevented=true;},
        stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;},...values};}
    function notify(store,name,values={}) {for(const fn of store.get(name)||[])fn(values);}
    function key(name,target=body,values={}) {const e=event(target,{key:name,...values});controller.keyboard(e);return e;}
    function down(target=elements.get('hd-city-info-next'),values={}){const e=event(target,values);controller.pointerDown(e);return e;}
    function up(target=elements.get('hd-city-info-next'),values={}){const e=event(target,values);controller.pointerUp(e);return e;}
    function untouched(){assert.deepEqual(writes,[]);assert.deepEqual(calls,[]);}
    return {controller,context,document,raw,identity,elements,root,body,hooks,keys,cancels,event,key,down,up,publish,untouched,
        mode:value=>{mode=value;},mapMode:value=>{mapMode=value;},ready:value=>{ready=value;},element,
        boundary:name=>notify(windowEvents,name),nativeEvent:()=>notify(windowEvents,'baye-hd-city-info'),
        hidden:value=>{document.hidden=value;notify(documentEvents,'visibilitychange');},
        pointerCancel:()=>notify(documentEvents,'pointercancel'),click:target=>notify(documentEvents,'click',event(target))};
}

test('real bridge DTO and GBK slots render native city zero, complete rows, blank values and multiline text without native calls',()=>{
    const h=fixture();assert.ok(h.controller.read());assert.equal(h.root.hidden,false);
    assert.equal(h.elements.get('hd-city-info-title').textContent,'襄阳');
    assert.equal(h.elements.get('hd-city-info-rows').children.length,5);
    assert.equal(h.elements.get('hd-city-info-rows').children[0].textContent,'中文');
    assert.equal(h.elements.get('hd-city-info-rows').children[1].textContent,'first\nsecond  ');
    assert.equal(h.elements.get('hd-city-info-rows').children[2].textContent,'');
    assert.equal(h.elements.get('hd-city-info-prev').disabled,true);
    assert.deepEqual(h.keys,[]);h.untouched();
});

test('paging sends once per native input ACK and page publication alone cannot authorize a repeat',()=>{
    const h=fixture();assert.equal(h.controller.send(35),true);assert.equal(h.controller.send(35),false);
    h.controller.retire();h.controller.poll();assert.equal(h.controller.send(35),false);
    h.publish({start:5});h.nativeEvent();assert.equal(h.controller.send(35),false);
    h.raw.g_hdCityInfoInputSeq++;h.nativeEvent();assert.equal(h.controller.send(35),true);
    h.publish({start:10,ack:true});h.nativeEvent();assert.equal(h.controller.send(35),false);
    assert.equal(h.elements.get('hd-city-info-next').disabled,true);
    assert.equal(h.controller.send(34),true);assert.deepEqual(h.keys,[35,35,34]);h.untouched();
});

test('native return and confirm retain distinct keys, close once and never retry a failed delivery',()=>{
    for(const [name,key] of [['Enter',39],['Escape',40]]){
        const h=fixture();const e=h.key(name);assert.equal(e.defaultPrevented,true);
        assert.deepEqual(h.keys,[key]);h.raw.g_hdCityInfoInputSeq++;h.nativeEvent();h.key(name);
        assert.deepEqual(h.keys,[key]);h.raw.g_hdCityInfoActive=0;h.nativeEvent();h.publish({newSession:true});h.nativeEvent();
        h.key(name);assert.deepEqual(h.keys,[key,key]);h.untouched();
    }
    const failed=fixture();failed.context.baye.sendKey=key=>{failed.keys.push(key);throw Error('delivery failed');};
    assert.equal(failed.controller.send(35),false);failed.controller.retire();failed.controller.poll();
    assert.equal(failed.controller.send(35),false);assert.deepEqual(failed.keys,[35]);failed.untouched();
});

test('focused buttons keep their own Enter or Space action, disabled arrows stay inert and editable or untrusted input stays native',()=>{
    for(const name of ['Enter',' ']){
        const h=fixture(),next=h.elements.get('hd-city-info-next');h.document.activeElement=next;
        const e=h.key(name,next);assert.equal(e.defaultPrevented,true);assert.deepEqual(h.keys,[35]);h.untouched();
        const classic=fixture(),button=classic.elements.get('hd-city-info-classic');classic.document.activeElement=button;
        classic.key(name,button);assert.equal(classic.root.hidden,true);assert.deepEqual(classic.keys,[]);classic.untouched();
        const disabled=fixture();disabled.key(name,disabled.elements.get('hd-city-info-prev'));assert.deepEqual(disabled.keys,[]);
    }
    for(const values of [{isTrusted:false},{repeat:true},{isComposing:true},{defaultPrevented:true}]){
        const h=fixture();h.key('Enter',h.body,values);assert.deepEqual(h.keys,[]);h.untouched();
    }
    const h=fixture(),input=h.element('editable','INPUT');h.body.appendChild(input);
    assert.equal(h.key('Enter',input).defaultPrevented,undefined);assert.deepEqual(h.keys,[]);h.untouched();
});

test('press geometry, pointer identity, mode, source changes and lifecycle boundaries retire a stale press',()=>{
    for(const change of [h=>{h.elements.get('hd-city-info-next').rect.left++;},h=>h.boundary('blur'),
        h=>h.boundary('pagehide'),h=>h.boundary('resize'),h=>h.boundary('orientationchange'),
        h=>h.hidden(true),h=>h.pointerCancel(),h=>h.mode('classic'),h=>{h.raw.g_hdDetailGeneration++;},
        h=>{h.raw.g_hdCityInfoSeq++;},h=>{h.identity.generation++;},h=>h.controller.retire()]){
        const h=fixture();h.down();change(h);h.up();assert.deepEqual(h.keys,[],String(change));h.untouched();
    }
    for(const values of [{pointerId:2},{clientX:45},{isTrusted:false}]){
        const h=fixture();h.down();h.up(undefined,values);assert.deepEqual(h.keys,[]);h.untouched();
    }
    const h=fixture();h.down();h.up();assert.deepEqual(h.keys,[35]);h.click(h.elements.get('hd-city-info-next'));
    assert.deepEqual(h.keys,[35]);h.untouched();
});

test('unsupported LIB, native generation, count, custom pages and damaged captures preserve LCD and never send',()=>{
    for(const change of [h=>{h.identity.sha256='unknown';},h=>{h.identity.byteLength++;},h=>{h.identity.generation=0;},
        h=>{h.identity.status='pending';},h=>{h.context.dynLib='0';},h=>h.ready(false),h=>{h.raw.g_hdEngineReady=0;},
        h=>{h.raw.g_hdDetailGeneration++;},h=>{h.raw.g_hdCityInfoCustom=1;},h=>{h.raw.g_hdCityInfoComplete=0;},
        h=>{h.raw.g_hdCityInfoPropertyCount=12;},h=>{h.raw.g_hdCityInfoWait=0;},h=>{h.raw.g_hdCityInfoTitleGbk.fill(0);},
        h=>{h.raw.g_hdCityInfoRowIndices[1]=3;},h=>{h.raw.g_hdCityInfoRowText.fill(65,0,128);},
        h=>{h.raw.g_engineConfig.citiesCount=0;},h=>{h.raw.g_hdCityInfoProtocolVersion=2;}]){
        const h=fixture();change(h);h.controller.poll();assert.equal(h.root.hidden,true,String(change));
        assert.equal(h.controller.send(35),false);assert.deepEqual(h.keys,[]);h.untouched();
    }
});

test('a newly installed city hook invalidates the previously standard publication before an input is sent',()=>{
    for(const name of ['willShowCityInfo','getCityPropertyDisplay']){
        const h=fixture();h.context.baye.hooks[name]=()=>-1;h.controller.poll();
        assert.equal(h.root.hidden,true,name);assert.equal(h.controller.send(35),false);assert.deepEqual(h.keys,[]);h.untouched();
    }
});

test('callbacks changing captured bytes, native ownership, mode or library state cannot authorize a stale controller read',()=>{
    for(const change of [h=>{h.raw.g_hdCityInfoRowText[0]=0x41;},h=>{h.raw.g_hdCityInfoSeq++;},
        h=>{h.raw.g_hdCityInfoInputSeq++;},h=>{h.raw.g_hdDetailGeneration++;},h=>{h.context.dynLib='1'.repeat(414390);},
        h=>h.mode('classic')]){
        const h=fixture();let count=0;h.hooks.read=()=>{if(++count===2)change(h);};
        assert.equal(h.controller.read(),null,String(change));assert.deepEqual(h.keys,[]);h.untouched();
    }
    const ready=fixture();ready.hooks.ready=()=>ready.mode('classic');assert.equal(ready.controller.read(),null);ready.untouched();
});

test('a late render mutation before dispatch cannot send a key to the replaced native owner',()=>{
    const h=fixture();let changed=false;
    h.hooks.render=(id,name)=>{if(id==='hd-city-info'&&name==='aria-hidden'&&!changed){changed=true;h.raw.g_hdDetailGeneration++;}};
    assert.equal(h.controller.send(35),false);assert.equal(changed,true);assert.deepEqual(h.keys,[]);h.untouched();
});

test('foreign and detached buttons cannot acquire the city-detail pointer owner',()=>{
    for(const detached of [false,true]){
        const h=fixture(),button=h.element('foreign','BUTTON');button.setAttribute('data-hd-city-info-key',35);
        if(!detached)h.body.appendChild(button);else button.isConnected=false;
        h.down(button);h.up(button);assert.deepEqual(h.keys,[]);h.untouched();
    }
});
