// Real bridge + shared dialog + mobile gesture host, with explicit native waits.
// No browser, game, stored campaign or native input is used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const mobile=readFileSync(new URL('../js/hd-mobile-battle.js',import.meta.url),'utf8');
const dialog=readFileSync(new URL('../js/hd-dialog.js',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
// Reuse the existing controlled DOM/gesture fixture, never the application code
// or tests from that module. Its boundaries are asserted before evaluation.
const helper=readFileSync(new URL('./test-hd-mobile-battle.mjs',import.meta.url),'utf8');
const begin=helper.indexOf('function fixture() {'),helperEnd=helper.indexOf('\nfunction interactive(',begin);
assert.ok(begin>=0&&helperEnd>begin);
function fixture({mobilePage=true}={}) {
    const f=vm.runInNewContext(helper.slice(begin,helperEnd)+'\nfixture();',{
        source:mobile,ORIGINAL_SHA:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',
        vm,console,Date,Math,JSON,Object,Number,Array,Set,Map,isFinite});
    const env=f.window;
    Object.assign(env,{TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},alert(){},lcdBlur(){},
        dynLib:'0'.repeat(414390),console:{log(){},warn(){},error(){}},
        bayeInputIgnored:e=>!!e.defaultPrevented||!!e.isComposing,
        bayeConsumeKeyEvent(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();},
        BayeHdCityMenu:{shouldShowHd:()=>true,getState:()=>({}),isOpen:()=>false},
        BayeHdOverworld:{getMode:()=> 'hd-map'}});
    for(const name of new Set(bridge.match(/\b_baye\w+/g)))env[name]=()=>0;
    env._bayeHdReady=()=>1;env._bayeGetPersonCount=()=>200;
    vm.createContext(env);env.window=env;
    vm.runInContext(bridge,env);env.baye_bridge_init();
    env.baye.ensureData=()=>f.state.data;
    env.baye.sendKey=code=>f.counts.keys.push(code);
    const root=f.element('hd-dialog','DIV',f.document.body,{left:0,top:52,width:844,height:294});
    for(const id of ['hd-dialog-title','hd-dialog-body','hd-dialog-caption','hd-dialog-range','hd-dialog-person-identity'])f.element(id,'DIV',root);
    const ok=f.element('graphic-message-ok','BUTTON',root,{left:10,top:290,width:180,height:44});ok.setAttribute('data-hd-dlg-ok','');
    const back=f.element('graphic-message-back','BUTTON',root,{left:210,top:290,width:180,height:44});back.setAttribute('data-hd-dlg-back','');
    vm.runInContext(dialog,env);
    const api=env.BayeHdDialog;
    if(mobilePage){api.configureMobileHost({isAvailable:f.shared.provider.isAvailable});api.attachMobileBattleHost({isAvailable:f.shared.provider.isAvailable,readTicket:f.host.readNativeTicket});}
    else api.start();
    Object.assign(f.raw,{g_asyncActionID:0,g_hdReportKind:1,g_hdReportPerson:65535,g_hdReportActive:0,g_hdReportGbk:'',
        g_hdFightInputKind:0,g_hdFightInputSeq:21,g_hdFightWait:0});
    function publish(text='杨秋获得经验！'){
        Object.assign(f.raw,{g_hdReportGbk:text,g_hdReportActive:1,g_hdReportSeq:f.raw.g_hdReportSeq+1,
            g_hdReportInputSeq:f.raw.g_hdReportInputSeq+1});api.onEngineReport();
        if(mobilePage)f.host.refresh();
    }
    function end(){f.raw.g_hdReportActive=0;f.raw.g_hdReportInputSeq++;api.poll();if(mobilePage)f.host.refresh();}
    f.clean();return {...f,api,env,root,ok,back,publish,end,
        text:()=>f.nodes.get('hd-dialog-body').textContent,ticket:()=>api.getBattleInputTicket(),
        untouched(){assert.deepEqual(Array.from(f.counts.writes),[]);assert.deepEqual(Array.from(f.counts.actions),[]);}};
}

test('actual kind-one report text is delivered synchronously on PC without a timer, key, name getter or fabricated result',()=>{
    const f=fixture({mobilePage:false});let names=0;f.env.baye.getPersonName=()=>{names++;throw Error('message has no speaker');};
    f.publish('计谋施展失败！');assert.equal(f.text(),'计谋施展失败！');assert.equal(f.api.debugSnapshot().open,true);
    assert.deepEqual(Array.from(f.counts.keys),[]);assert.equal(names,0);f.end();
    assert.equal(f.api.debugSnapshot().open,false);assert.deepEqual(Array.from(f.counts.keys),[]);f.untouched();
});

test('mobile report owns a separate HD surface in BUSY even without complete unit arrays',()=>{
    const f=fixture();f.raw.g_GenPos=null;f.raw.g_Persons=null;f.publish();
    assert.equal(f.host.readNativeTicket(),null);const t=f.ticket();assert.ok(t);assert.equal(t.kind,'report');
    assert.equal(t.ownerType,'battle-report');assert.equal(t.text,'杨秋获得经验！');assert.equal(t.data,f.state.data);
    assert.equal(f.api.getBattleLcdPresentation(),'off');assert.equal(f.host.debugSnapshot().detailPresentation,'hd');
    assert.equal(f.document.body.getAttribute('data-hd-mobile-battle-detail'),'hd');assert.equal(f.host.ownsDetailSurface(),true);
    assert.deepEqual(Array.from(f.counts.keys),[]);f.end();assert.equal(f.ticket(),null);
    assert.equal(f.host.debugSnapshot().detailPresentation,'off');assert.equal(f.api.isOpen(),false);f.untouched();
});

test('trusted mobile confirm and back preserve separate ENTER and EXIT, at most once for the current native owner',()=>{
    for(const [name,code]of [['ok',39],['back',40]]){
        const f=fixture();f.publish();f.tap(f[name]);f.tap(f[name]);assert.deepEqual(Array.from(f.counts.keys),[code]);
        f.globalEvent('blur');f.globalEvent('focus');f.tap(f[name]);assert.deepEqual(Array.from(f.counts.keys),[code]);
        f.publish();f.tap(f[name]);
        assert.deepEqual(Array.from(f.counts.keys),[code,code]);f.untouched();
    }
});

test('report input consumes only explicit Enter/Escape and never queues, repeats or leaks directional keys',()=>{
    const f=fixture();f.publish();const t=f.ticket();assert.equal(f.api.dispatchBattleDetail(35,t),false);
    f.fire('keydown',f.document.body,{key:'ArrowDown',keyCode:40});assert.deepEqual(Array.from(f.counts.keys),[]);
    f.fire('keydown',f.document.body,{key:'Enter',keyCode:13,repeat:true});assert.deepEqual(Array.from(f.counts.keys),[]);
    f.fire('keydown',f.document.body,{key:'Enter',keyCode:13});f.fire('keydown',f.document.body,{key:'Escape',keyCode:27});
    assert.deepEqual(Array.from(f.counts.keys),[39]);f.end();assert.equal(f.api.dispatchBattleDetail(39,t),false);f.untouched();
});

test('natural expiry, a new report, data replacement and geometry/lifecycle changes invalidate held presses',()=>{
    for(const change of [f=>f.end(),f=>f.publish('计谋施展失败！'),f=>{f.state.data={...f.raw};},
        f=>{f.ok.rect.left++;},f=>f.globalEvent('blur'),f=>f.globalEvent('resize'),f=>{f.document.hidden=true;}]){
        const f=fixture();f.publish();f.fire('pointerdown',f.ok);change(f);f.fire('pointerup',f.ok);f.fire('click',f.ok);
        assert.deepEqual(Array.from(f.counts.keys),[],String(change));f.untouched();
    }
});

test('strict native report/fight fields, mode, original identity and captured text are required for a report ticket',()=>{
    for(const change of [f=>{f.raw.g_hdReportInputSeq=0;},f=>{f.raw.g_hdReportSeq='1';},f=>{f.raw.g_hdReportKind=3;},
        f=>{f.raw.g_hdReportPerson=0;},f=>{f.raw.g_hdDetailGeneration=0;},f=>{f.raw.g_hdFightActive=0;},
        f=>{f.raw.g_hdFightOver=1;},f=>{f.raw.g_hdFightInputKind=11;},f=>{f.raw.g_hdFightInputSeq=0;},
        f=>{f.raw.g_hdCityInfoActive=1;},f=>{f.identity({status:'pending'});},f=>{f.identity({sha256:'0'.repeat(64)});},
        f=>{f.env.dynLib='';},f=>{f.state.mode='classic';},f=>{f.raw.g_hdReportGbk='changed native text';}]){
        const f=fixture();f.publish();const t=f.ticket();assert.ok(t);change(f);assert.equal(f.ticket(),null,String(change));
        assert.equal(f.api.dispatchBattleDetail(39,t),false);assert.deepEqual(Array.from(f.counts.keys),[]);f.untouched();
    }
});

test('late callbacks and reentrant ticket readers cannot authorize mixed publications or replay a spent report',()=>{
    for(const change of [f=>{f.raw.g_hdReportInputSeq++;},f=>{f.env.dynLib='f'.repeat(414390);},
        f=>{f.env.BayeHdLibIdentity={...f.env.BayeHdLibIdentity};},f=>{f.raw.g_hdFightInputSeq++;}]){
        const f=fixture();f.publish();const t=f.ticket();let once=false;
        f.state.identityHook=()=>{if(!once){once=true;change(f);}};
        assert.equal(f.api.dispatchBattleDetail(39,t),false);assert.deepEqual(Array.from(f.counts.keys),[]);f.untouched();
    }
    const f=fixture();f.publish();let inner='not called',once=false;
    f.state.identityHook=()=>{if(!once){once=true;inner=f.ticket();}};
    assert.equal(f.ticket(),null);assert.equal(inner,null);f.state.identityHook=null;
    const t=f.ticket();assert.ok(t);assert.equal(f.api.dispatchBattleDetail(39,t),true);
    f.api.retireInteraction();f.api.onEngineReport();assert.ok(f.ticket());
    assert.equal(f.api.dispatchBattleDetail(39,f.ticket()),false);assert.deepEqual(Array.from(f.counts.keys),[39]);f.untouched();
});

test('the last physical sender lookup cannot switch the native report after a valid ticket was read',()=>{
    for(const change of [f=>f.raw.g_hdReportInputSeq++,f=>{f.state.mode='classic';},f=>{f.env.innerWidth=300;}]){
        const f=fixture();f.publish();const t=f.ticket(),send=f.env.sendKey;let reads=0;
        Object.defineProperty(f.env,'sendKey',{configurable:true,get(){if(++reads===2)change(f);return send;}});
        assert.equal(f.api.dispatchBattleDetail(39,t),false,String(change));assert.equal(reads,2);
        assert.deepEqual(Array.from(f.counts.keys),[]);f.untouched();
    }
});

test('a final mode check that changes captured native bytes cannot bypass the physical raw seal',()=>{
    const f=fixture();f.publish();const t=f.ticket(),send=f.env.sendKey;let reads=0,armed=false;
    Object.defineProperty(f.env,'sendKey',{configurable:true,get(){if(++reads===2)armed=true;return send;}});
    f.shared.shouldShowHd=()=>{if(armed)f.raw.g_hdReportInputSeq++;return true;};
    // Authorize the same mode function first so the rejection depends on its
    // late change to the publication, rather than only on replacing the API.
    const latest=f.ticket();assert.ok(latest);assert.equal(f.api.dispatchBattleDetail(39,latest),false);
    assert.ok(armed);assert.deepEqual(Array.from(f.counts.keys),[]);f.untouched();
});
