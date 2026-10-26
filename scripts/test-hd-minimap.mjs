import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const source = fs.readFileSync(new URL('../js/hd-minimap.js', import.meta.url), 'utf8');
function fixture({ canvasRect } = {}) {
    const listeners = {}, keys = [], draws = [], markers = [], elements = new Map();
    let arc = null;
    const canvasContext = { globalAlpha: 1, setTransform(){}, fillRect(){},
        drawImage(...v){draws.push(v);}, beginPath(){},
        arc(...args){arc=args;}, fill(){},
        stroke(){markers.push({arc:[...arc],alpha:this.globalAlpha,fill:this.fillStyle,
            stroke:this.strokeStyle,lineWidth:this.lineWidth});} };
    function element(id = '', tagName = 'DIV') {
        const attrs = {}, classes = new Set(), handlers = {};
        const value = { id, tagName, hidden: false, disabled: false, style: {}, children: [], handlers,
            setAttribute(k,v) { attrs[k]=v; }, getAttribute(k) { return attrs[k]; },
            classList: { toggle(k,on) { on ? classes.add(k) : classes.delete(k); }, contains:k=>classes.has(k) },
            addEventListener(k,fn) { const previous=handlers[k];handlers[k]=previous?event=>{previous(event);fn(event);}:fn; },
            appendChild(child) { child.parentElement=this;this.children.push(child); },
            contains: other=>{for(let p=other;p;p=p.parentElement)if(p===value)return true;return false;},
            closest(selector){for(let p=value;p;p=p.parentElement)if(p.tagName.toLowerCase()===selector)return p;return null;},
            getBoundingClientRect:()=>({left:0,top:0,width:480,height:500}), getContext:()=>canvasContext };
        let text = '';
        Object.defineProperty(value,'textContent',{get(){return text+value.children.map(child=>child.textContent).join('');},
            set(next){text=String(next);for(const child of value.children)child.parentElement=null;value.children=[];}});
        return value;
    }
    for (const id of ['hd-mini-map','hd-mini-map-classic','hd-mini-map-return','hd-mini-map-canvas',
        'hd-mini-map-content','hd-mini-map-summary','hd-mini-map-cities','hd-mini-map-fallback','hd-mini-map-filters',
        'hd-mini-map-filter-all','hd-mini-map-filter-owned','hd-mini-map-filter-neutral','hd-mini-map-filter-empty']) {
        elements.set(id,element(id,/hd-mini-map-(?:filter-|classic$|return$)/.test(id)?'BUTTON':'DIV'));
    }
    const root=elements.get('hd-mini-map'),filters=elements.get('hd-mini-map-filters');
    for(const [id,value] of elements)if(value!==root) {
        (id.startsWith('hd-mini-map-filter-')?filters:root).appendChild(value);
    }
    if (canvasRect) elements.get('hd-mini-map-canvas').getBoundingClientRect=canvasRect;
    const native={protocolVersion:1,active:1,complete:1,custom:0,defaultDraw:1,seq:4,generation:7,
        detailGeneration:7,mapInputSeq:9,resourceId:75,imageIndex:0,width:84,height:64,mask:0,city1:1};
    const image={complete:true,naturalWidth:3840,naturalHeight:4000}, data={image,width:3840,height:4000,generation:2,
        libSha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',
        cities:Array.from({length:38},(_,i)=>({index:i,name:'city'+i,x:100+i*40,y:500+i*50,
            engineX:i%10,engineY:i%8,belong:1,kind:'owned',color:'#3d8bfd'}))};
    let mode='hd-map',hidden=false,reportActive=0,menuActive=0,qtyActive=0,assetsReady=true;
    const document={get hidden(){return hidden;},documentElement:element(),getElementById:id=>elements.get(id),
        createElement:tag=>element('',tag.toUpperCase()),addEventListener(k,fn){listeners['document:'+k]=fn;}};
    const context=vm.createContext({document,Number,JSON,console,
        baye:{hd:{ready:()=>true,miniMap:()=>native,march:()=>({pick:1,mapInputSeq:9}),report:()=>({active:reportActive}),
            menuItems:()=>({active:menuActive}),qty:()=>({active:qtyActive}),fight:()=>({active:0})}},
        BayeHdOverworld:{getMode:()=>mode,overviewData:()=>assetsReady?data:null},
        sendKey:code=>keys.push(code),bayeInputIgnored:e=>!!e.defaultPrevented,
        bayeConsumeKeyEvent:e=>{e.preventDefault();e.consumed=true;},
        addEventListener(k,fn){listeners[k]=fn;},setInterval:()=>1,devicePixelRatio:1});
    context.window=context;vm.runInContext(source,context);const api=context.BayeHdMiniMap;api.start();
    function key(code,repeat=false,options={}) {
        const event={keyCode:code,repeat,preventDefault(){this.defaultPrevented=true;},...options};
        listeners.keydown(event);return event;
    }
    function localClick(target) {
        const event={target,isTrusted:true,detail:1,preventDefault(){this.defaultPrevented=true;},
            stopPropagation(){this.stopped=true;}};
        for(let p=target;p&&!event.stopped;p=p.parentElement)p.handlers.click?.(event);
        return event;
    }
    return {api,native,data,keys,draws,markers,canvasContext,elements,listeners,key,localClick,context,
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

// The mobile host supplies an opaque current-world receipt; shared code still
// checks its actual mini-map mirror, library, blockers and both samples.
function mobileFixture(options) {
    const h=fixture(options),env=h.context,root=h.elements.get('hd-mini-map'),back=h.elements.get('hd-mini-map-return');
    const bytes=fs.readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
    const sha=createHash('sha256').update(bytes).digest('hex');
    assert.equal(bytes.length,207195);assert.equal(sha,h.data.libSha256);
    let identity={status:'ready',sha256:sha,byteLength:bytes.length,generation:3},available=true,receiptHook=null,top=back;
    const raw={g_hdEngineReady:1,g_hdDetailGeneration:7,g_hdMapPick:1,g_hdMapInputSeq:9,g_hdMarchPhase:0,
        g_hdTransferProtocolVersion:1,g_hdTransferActive:0};
    const blockers=['g_hdBattlePick','g_hdMenuActive','g_hdReportActive','g_hdQtyActive','g_hdFightActive',
        'g_hdHelpActive','g_hdRecordActive','g_hdMovieActive','g_hdSpeActive','g_hdSkillActive','g_hdAttackActive',
        'g_hdSkillResultActive','g_hdMakerActive','g_hdViewActive','g_hdGoodsActive','g_hdPersonPropertiesActive',
        'g_hdResultOwnerKind','g_hdResultOwnerValid'];
    blockers.forEach(field=>raw[field]=0);
    Object.assign(h.native,{cursorX:0,cursorY:0,viewX:0,viewY:0,viewWidth:10,viewHeight:8});
    function mirror() {for(const [field,value] of Object.entries(h.native))if(field!=='detailGeneration')
        raw['g_hdMiniMap'+(field==='mapInputSeq'?'InputSeq':field[0].toUpperCase()+field.slice(1))]=value;}
    mirror();raw.circular=raw;raw.toJSON=()=>{throw Error('opaque native data must never be serialized');};
    const writes=[];env.baye.data=new Proxy(raw,{set(){writes.push(true);throw Error('native write');}});
    env.BayeHdLibIdentity={read:()=>identity,isCurrent:value=>value===identity,subscribe(fn){env.identityChanged=fn;}};
    env.getComputedStyle=()=>({display:'block',visibility:'visible',opacity:'1'});
    env.document.elementFromPoint=()=>top;back.parentElement=root;
    const host={available:()=>available,readNative(){const receipt={native:{...h.native},data:env.baye.data,
        key:'raw-owner-'+h.native.seq,libraryGeneration:identity.generation};if(receiptHook)receiptHook(receipt);return receipt;}};
    h.api.attachMobileHost(host);
    function event(options={}) {return {target:back,isTrusted:true,isPrimary:true,button:0,pointerId:1,
        clientX:50,clientY:50,detail:1,preventDefault(){},stopPropagation(){},...options};}
    function fire(type,options={}) {const e=event(options);h.listeners['document:'+type]?.(e);
        if(type==='pointerdown'||type==='click')root.handlers[type]?.(e);return e;}
    return Object.assign(h,{raw,blockers,writes,host,mirror,event,fire,
        down(options){fire('pointerdown',options);},up(options){fire('pointerup',options);},click(options){fire('click',options);},
        tap(){fire('pointerdown');fire('pointerup');fire('click');},available(value){available=value;},
        identity(){return identity;},setIdentity(value){identity=value;},setReceiptHook(fn){receiptHook=fn;},setTop(value){top=value;}});
}
test('mobile original overview exposes 38 actual cities and a nonenumerable current-world input receipt',()=>{
    const h=mobileFixture(),ticket=h.api.getInputTicket(),before=JSON.stringify(h.native);
    assert.ok(ticket);assert.equal(ticket.data,h.context.baye.data);assert.equal(Object.keys(ticket).includes('data'),false);
    assert.equal(ticket.libraryGeneration,3);assert.equal(ticket.generation,7);assert.equal(ticket.seq,4);assert.equal(ticket.mapInputSeq,9);
    assert.equal(h.api.debugSnapshot().cities.length,38);assert.equal(h.elements.get('hd-mini-map').hidden,false);
    assert.equal(JSON.stringify(h.native),before);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});
test('mobile overview retries its first canvas paint when a zero-size layout becomes visible',()=>{
    let rect={left:0,top:0,width:0,height:0};
    const h=mobileFixture({canvasRect:()=>rect}),before=h.api.debugSnapshot(),native=JSON.stringify(h.native);
    assert.equal(before.complete,true);assert.equal(before.showLcd,false);assert.equal(h.draws.length,0);
    h.api.poll();assert.equal(h.draws.length,0,'a still-hidden canvas must not be painted');
    rect={left:0,top:0,width:480,height:280};h.api.poll();
    assert.equal(h.draws.length,1,'the same native owner must retry painting after layout is available');
    assert.equal(h.elements.get('hd-mini-map-canvas').width,480);
    assert.equal(h.elements.get('hd-mini-map-canvas').height,280);
    assert.equal(h.api.debugSnapshot().owner,before.owner);
    assert.equal(h.api.debugSnapshot().presentationEpoch,before.presentationEpoch);
    h.api.poll();assert.equal(h.draws.length,1,'an unchanged visible layout keeps the completed paint cached');
    assert.equal(JSON.stringify(h.native),native);assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});
test('mobile Return needs trusted DOWN, matching UP and one matching click, never an exported or repeated return',()=>{
    const h=mobileFixture();assert.equal(h.api.returnKey(40,h.api.debugSnapshot().owner),false);
    h.click();assert.deepEqual(h.keys,[]);h.down();assert.deepEqual(h.keys,[]);h.up();assert.deepEqual(h.keys,[]);
    h.click();h.click();h.tap();h.key(27,true);assert.deepEqual(h.keys,[40]);assert.equal(h.api.debugSnapshot().committed,true);
    h.native.active=0;h.mirror();h.api.poll();assert.equal(h.api.isOpen(),false);assert.deepEqual(h.writes,[]);
});
test('mobile touch Return keeps its completed UP grant through implicit capture release before click',()=>{
    const h=mobileFixture(),native=JSON.stringify(h.native);
    h.down();h.up();const epoch=h.api.debugSnapshot().presentationEpoch;
    h.fire('lostpointercapture');
    assert.equal(h.api.debugSnapshot().presentationEpoch,epoch,'normal implicit release must preserve the completed press');
    assert.deepEqual(h.keys,[]);h.click();h.click();h.tap();
    assert.deepEqual(h.keys,[40],'the completed physical gesture sends one Exit without repeat leakage');
    assert.equal(JSON.stringify(h.native),native);assert.deepEqual(h.writes,[]);
});
test('mobile touch Return rejects capture loss before UP and needs a new complete press',()=>{
    const h=mobileFixture(),native=JSON.stringify(h.native);
    h.down();const epoch=h.api.debugSnapshot().presentationEpoch;
    h.fire('lostpointercapture');
    assert.ok(h.api.debugSnapshot().presentationEpoch>epoch);assert.equal(h.api.debugSnapshot().retireReason,'lost-capture');
    h.up();h.click();assert.deepEqual(h.keys,[],'a cancelled unfinished press cannot create a grant on release');
    h.tap();assert.deepEqual(h.keys,[40]);assert.equal(JSON.stringify(h.native),native);assert.deepEqual(h.writes,[]);
});
for(const problem of ['untrusted-down','untrusted-up','untrusted-click','bare-click','no-up','wrong-pointer','secondary',
    'right-button','detail-zero','drag','geometry','occluded','old-node','scroll','pointercancel','multi']) {
    test('mobile overview rejects invalid physical Return gesture: '+problem,()=>{
        const h=mobileFixture(),back=h.elements.get('hd-mini-map-return');
        if(problem==='bare-click'){h.click();assert.deepEqual(h.keys,[]);return;}
        h.down(problem==='untrusted-down'?{isTrusted:false}:problem==='secondary'?{isPrimary:false}:problem==='right-button'?{button:2}:{});
        if(problem==='drag')h.fire('pointermove',{clientX:70});
        if(problem==='geometry')back.getBoundingClientRect=()=>({left:1,top:0,width:480,height:500});
        if(problem==='occluded')h.setTop({});
        if(problem==='scroll')h.listeners['document:scroll']();
        if(problem==='pointercancel')h.fire('pointercancel');
        if(problem==='multi')h.fire('pointerdown',{target:{},pointerId:2,isPrimary:false});
        if(problem==='old-node'){h.up();const replacement={...back};replacement.closest=()=>replacement;
            replacement.contains=other=>other===replacement;h.elements.set('hd-mini-map-return',replacement);
            h.setTop(replacement);h.click({target:replacement});}
        else {if(problem!=='no-up')h.up(problem==='untrusted-up'?{isTrusted:false}:problem==='wrong-pointer'?{pointerId:2}:{});
            h.click(problem==='untrusted-click'?{isTrusted:false}:problem==='detail-zero'?{detail:0}:{});}
        assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
    });
}
for(const field of ['g_hdEngineReady','g_hdDetailGeneration','g_hdMapPick','g_hdMapInputSeq','g_hdMarchPhase',
    'g_hdTransferProtocolVersion','g_hdTransferActive'])test('mobile overview rejects changed raw map boundary '+field,()=>{
    const h=mobileFixture();h.down();h.raw[field]=field==='g_hdMarchPhase'?6:h.raw[field]+1;h.up();h.click();
    assert.deepEqual(h.keys,[]);assert.equal(h.api.getInputTicket(),null);
});
for(const field of ['g_hdBattlePick','g_hdMenuActive','g_hdReportActive','g_hdQtyActive','g_hdFightActive',
    'g_hdHelpActive','g_hdRecordActive','g_hdMovieActive','g_hdSpeActive','g_hdSkillActive','g_hdAttackActive',
    'g_hdSkillResultActive','g_hdMakerActive','g_hdViewActive','g_hdGoodsActive','g_hdPersonPropertiesActive',
    'g_hdResultOwnerKind','g_hdResultOwnerValid'])test('mobile overview rejects competing owner '+field,()=>{
    const h=mobileFixture();h.down();h.raw[field]=1;h.up();h.click();assert.deepEqual(h.keys,[]);assert.equal(h.api.getInputTicket(),null);
});
for(const problem of ['unavailable','hidden','classic','data-rebind','library','identity-pending','generation','stale-identity',
    'torn-native','torn-key','torn-data','bad-protocol','bad-field','raw-mismatch'])test('mobile overview rejects receipt/identity drift '+problem,()=>{
    const h=mobileFixture();h.down();
    if(problem==='unavailable')h.available(false);if(problem==='hidden')h.hidden(true);if(problem==='classic')h.available(false);
    if(problem==='data-rebind')h.context.baye.data={...h.raw};
    if(problem==='library')h.setIdentity({...h.identity(),sha256:'f'.repeat(64)});
    if(problem==='identity-pending')h.setIdentity({...h.identity(),status:'pending'});
    if(problem==='generation')h.setIdentity({...h.identity(),generation:4});
    if(problem==='stale-identity')h.context.BayeHdLibIdentity.isCurrent=()=>false;
    if(problem==='torn-native')h.setReceiptHook(()=>{h.native.seq++;h.mirror();});
    if(problem==='torn-key'){let n=0;h.setReceiptHook(receipt=>receipt.key=String(n++));}
    if(problem==='torn-data')h.setReceiptHook(()=>{h.context.baye.data={...h.raw};});
    if(problem==='bad-protocol')h.setReceiptHook(receipt=>receipt.native.protocolVersion=2);
    if(problem==='bad-field')h.setReceiptHook(receipt=>receipt.native.width=NaN);
    if(problem==='raw-mismatch')h.raw.g_hdMiniMapCursorX++;
    h.up();h.click();assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});
for(const reason of ['resize','orientationchange','blur','pagehide','visibility','identity','retire'])test('mobile same native owner cannot reuse a Return press after '+reason,()=>{
    const h=mobileFixture();h.down();const before=h.api.getInputTicket();
    if(reason==='visibility'){h.hidden(true);h.listeners['document:visibilitychange']();h.hidden(false);h.listeners['document:visibilitychange']();}
    else if(reason==='identity'){h.context.identityChanged();h.api.poll();}
    else if(reason==='retire'){h.api.retireInteraction('test');h.api.poll();}
    else {h.listeners[reason]();if(reason==='blur')h.listeners.focus();else if(reason==='pagehide')h.listeners.pageshow();else h.api.poll();}
    assert.ok(h.api.getInputTicket());assert.notEqual(h.api.getInputTicket().epoch,before.epoch);
    h.up();h.click();assert.deepEqual(h.keys,[]);h.tap();assert.deepEqual(h.keys,[40]);assert.deepEqual(h.writes,[]);
});
test('mobile list scroll cancels only the input grant and preserves the current shell and list nodes',()=>{
    const h=mobileFixture(),list=h.elements.get('hd-mini-map-cities'),first=list.children.at(-38),epoch=h.api.debugSnapshot().presentationEpoch;
    list.scrollTop=140;h.down();h.listeners['document:scroll']();h.up();h.click();h.api.poll();
    assert.deepEqual(h.keys,[]);assert.equal(h.api.isOpen(),true);assert.equal(list.scrollTop,140);
    assert.equal(list.children.at(-38),first);assert.ok(h.api.debugSnapshot().presentationEpoch>epoch);
});
test('mobile overview preserves the current list scroll but resets a newly opened native sequence to the top',()=>{
    const h=mobileFixture(),list=h.elements.get('hd-mini-map-cities'),owner=h.api.debugSnapshot().owner;
    list.scrollTop=1066;h.api.poll();h.api.poll();
    assert.equal(list.scrollTop,1066,'ordinary polls must not take scrolling away from the player');
    assert.equal(h.api.debugSnapshot().owner,owner);
    h.native.active=0;h.mirror();h.api.poll();assert.equal(h.api.isOpen(),false);
    h.native.active=1;h.native.seq++;h.mirror();h.api.poll();
    assert.equal(h.api.isOpen(),true);assert.notEqual(h.api.debugSnapshot().owner,owner);
    assert.equal(list.scrollTop,0,'a new native overlay starts at the first city instead of the previous bottom');
    list.scrollTop=180;h.api.poll();assert.equal(list.scrollTop,180);
    assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});
for(const problem of ['geometry','assets','seq','opaque-data','scroll'])test('mobile click rechecks the granted geometry, owner and presentation after UP: '+problem,()=>{
    const h=mobileFixture();h.down();h.up();
    if(problem==='geometry')h.elements.get('hd-mini-map-return').getBoundingClientRect=()=>({left:1,top:0,width:480,height:500});
    if(problem==='assets')h.assets(false);
    if(problem==='seq'){h.native.seq++;h.mirror();}
    if(problem==='opaque-data')h.context.baye.data={...h.raw};
    if(problem==='scroll')h.listeners['document:scroll']();
    h.click();assert.deepEqual(h.keys,[]);assert.deepEqual(h.writes,[]);
});
for(const problem of ['assets','custom','incomplete','unknown-geography'])test('mobile unsupported overview uses physical LCD with zero shared input: '+problem,()=>{
    const h=mobileFixture();if(problem==='assets')h.assets(false);if(problem==='custom')h.native.custom=1;
    if(problem==='incomplete')h.native.complete=0;if(problem==='unknown-geography')h.data.libSha256='unknown';
    h.mirror();h.api.poll();assert.equal(h.api.debugSnapshot().complete,false);assert.equal(h.api.debugSnapshot().showLcd,true);
    assert.equal(h.elements.get('hd-mini-map').hidden,true);assert.equal(h.api.getInputTicket(),null);h.tap();assert.deepEqual(h.keys,[]);
    assert.equal(h.key(27).consumed,undefined,'physical LCD keeps its original keyboard handler');
});

function categorizedOverview(mobile) {
    const h=mobile?mobileFixture():fixture();
    h.data.cities.forEach((city,index)=>{
        city.kind=index<10?'owned':index<22?'neutral':index<30?'empty':'unknown';
        city.belong=index<10?1:index<22?2:index<30?0:null;
    });
    h.api.poll();
    h.filter=value=>h.localClick(h.elements.get('hd-mini-map-filter-'+value));
    h.cityIds=()=>h.elements.get('hd-mini-map-cities').children.map(row=>Number(row.getAttribute('data-hd-mini-city')));
    return h;
}

test('local overview categories filter authorized cities and counts on PC and mobile without native input',()=>{
    for(const mobile of [false,true]) {
        const h=categorizedOverview(mobile),native=JSON.stringify(h.native),cities=JSON.stringify(h.data.cities),
            owner=h.api.debugSnapshot().owner;
        const cases=[['all',Array.from({length:38},(_,i)=>i),'全部'],
            ['owned',Array.from({length:10},(_,i)=>i),'我方'],
            ['neutral',Array.from({length:12},(_,i)=>i+10),'他方'],
            ['empty',Array.from({length:8},(_,i)=>i+22),'空城']];
        for(const [kind,ids,label] of cases) {
            h.filter(kind);
            assert.deepEqual(h.cityIds(),ids);
            assert.equal(h.elements.get('hd-mini-map-summary').textContent,
                '匹配 '+ids.length+' / 38 座城池 · 当前位置：city0');
            assert.equal(h.elements.get('hd-mini-map-cities').getAttribute('aria-label'),label+'城池');
            for(const key of ['all','owned','neutral','empty'])assert.equal(
                h.elements.get('hd-mini-map-filter-'+key).getAttribute('aria-pressed'),String(key===kind));
            assert.equal(h.api.debugSnapshot().owner,owner);
            assert.equal(h.api.debugSnapshot().committed,false);
        }
        assert.equal(h.elements.get('hd-mini-map-filter-all').textContent,'全部（38）');
        assert.equal(h.elements.get('hd-mini-map-filter-neutral').textContent,'他方（12）');
        h.filter('all');assert.deepEqual(h.cityIds().slice(-8),[30,31,32,33,34,35,36,37]);
        assert.deepEqual(h.keys,[]);assert.equal(JSON.stringify(h.native),native);
        assert.equal(JSON.stringify(h.data.cities),cities);if(mobile)assert.deepEqual(h.writes,[]);
    }
});

test('local category emphasis preserves all map points and the real current-city marker',()=>{
    for(const mobile of [false,true]) {
        const h=categorizedOverview(mobile),native=JSON.stringify(h.native);
        h.filter('empty');
        const points=h.markers.slice(-38);
        assert.equal(points.length,38);
        for(let i=0;i<38;i++)assert.equal(points[i].alpha,i>=22&&i<30?1:0.2);
        assert.equal(points[0].arc[2],7);assert.equal(points[0].lineWidth,2.5);
        assert.equal(points[0].stroke,'#fff5ce');
        assert.ok(points.slice(1).every(point=>point.arc[2]===4&&point.lineWidth===1));
        assert.equal(h.canvasContext.globalAlpha,1);
        assert.equal(h.native.city1,1);assert.equal(h.api.debugSnapshot().native.city1,1);
        assert.match(h.elements.get('hd-mini-map-summary').textContent,/当前位置：city0$/);
        assert.ok(h.elements.get('hd-mini-map-cities').children.every(row=>row.tagName==='LI'&&!row.handlers.click));
        assert.deepEqual(h.keys,[]);assert.equal(JSON.stringify(h.native),native);
    }
});

test('changing a local category retires old Return presses and grants while preserving its one-shot commit',()=>{
    const pc=categorizedOverview(false),root=pc.elements.get('hd-mini-map'),back=pc.elements.get('hd-mini-map-return'),
        owner=pc.api.debugSnapshot().owner,native=JSON.stringify(pc.native);
    root.handlers.pointerdown({target:back});pc.filter('neutral');root.handlers.click({target:back});
    assert.deepEqual(pc.keys,[]);assert.equal(pc.api.debugSnapshot().owner,owner);
    root.handlers.pointerdown({target:back});root.handlers.click({target:back});
    assert.deepEqual(pc.keys,[40]);assert.equal(pc.api.debugSnapshot().committed,true);
    pc.filter('empty');assert.equal(pc.elements.get('hd-mini-map-filter-neutral').getAttribute('aria-pressed'),'true');
    root.handlers.click({target:back});assert.deepEqual(pc.keys,[40]);assert.equal(JSON.stringify(pc.native),native);
    for(const completedUp of [false,true]) {
        const h=categorizedOverview(true),before=JSON.stringify(h.native),owner=h.api.debugSnapshot().owner;
        h.down();if(completedUp)h.up();h.filter('neutral');if(!completedUp)h.up();h.click();
        assert.deepEqual(h.keys,[]);assert.equal(h.api.debugSnapshot().owner,owner);
        h.tap();assert.deepEqual(h.keys,[40]);assert.equal(h.api.debugSnapshot().committed,true);
        h.filter('empty');h.tap();assert.deepEqual(h.keys,[40]);
        assert.equal(h.elements.get('hd-mini-map-filter-neutral').getAttribute('aria-pressed'),'true');
        assert.equal(JSON.stringify(h.native),before);assert.deepEqual(h.writes,[]);
    }
});

test('local filters keep keyboard ownership, reset on a new overview and disable for unsupported data',()=>{
    for(const mobile of [false,true]) {
        const h=categorizedOverview(mobile),button=h.elements.get('hd-mini-map-filter-owned');
        for(const code of [9,13,32])assert.equal(h.key(code,false,{target:button}).consumed,undefined);
        for(const code of [27,37,38,39,40,53,70,72,83])assert.equal(h.key(code,false,{target:button}).consumed,true);
        assert.deepEqual(h.keys,[]);h.filter('owned');
        h.native.active=0;if(mobile)h.mirror();h.api.poll();assert.equal(h.api.isOpen(),false);
        h.native.active=1;h.native.seq++;if(mobile)h.mirror();h.api.poll();
        assert.deepEqual(h.cityIds(),Array.from({length:38},(_,i)=>i));
        assert.equal(h.elements.get('hd-mini-map-filter-all').getAttribute('aria-pressed'),'true');
        h.filter('owned');
        for(let i=0;i<10;i++){h.data.cities[i].kind='neutral';h.data.cities[i].belong=2;}
        h.api.poll();assert.deepEqual(h.cityIds(),[]);
        assert.equal(h.elements.get('hd-mini-map-cities').textContent,'暂无匹配城池');
        assert.match(h.elements.get('hd-mini-map-summary').textContent,/^匹配 0 \/ 38 座城池/);
        h.native.custom=1;if(mobile)h.mirror();h.api.poll();
        assert.equal(h.elements.get('hd-mini-map-filters').hidden,true);
        for(const key of ['all','owned','neutral','empty'])assert.equal(h.elements.get('hd-mini-map-filter-'+key).disabled,true);
        h.filter('neutral');assert.equal(h.api.debugSnapshot().complete,false);assert.deepEqual(h.keys,[]);
        h.native.custom=0;if(mobile)h.mirror();h.api.poll();
        assert.equal(h.elements.get('hd-mini-map-filters').hidden,false);
        assert.equal(h.elements.get('hd-mini-map-filter-all').getAttribute('aria-pressed'),'true');
        assert.deepEqual(h.cityIds(),Array.from({length:38},(_,i)=>i));if(mobile)assert.deepEqual(h.writes,[]);
    }
});
