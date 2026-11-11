// Exact legacy input boundaries in controlled VM fixtures. No C, browser, game or held session.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const files = Object.fromEntries(['city-menu','overworld','dialog'].map(name =>
    [name, readFileSync(new URL('../js/hd-' + name + '.js', import.meta.url), 'utf8')]));
function between(source, name, next) {
    const start = source.indexOf('    function ' + name + '(');
    const end = source.indexOf('    function ' + next + '(', start);
    assert.ok(start >= 0 && end > start, name + ' boundary exists');
    return source.slice(start, end);
}
function fixture(kind) {
    const keys = [], touches = [], data = {}, state = {open:false,deepKind:''};
    const env = {state, document:{hidden:false}, VK:{UP:0x22,DOWN:0x23,LEFT:0x24,RIGHT:0x25,ENTER:0x27,EXIT:0x28,HELP:0x29},
        mobileHost:null,surrenderFlow:null,mobileDiplomacy:null,mobileEquipmentFlow:null,mobileTrade:null,distributionFlow:null,
        baye:{data}, console:{log(){},warn(){}},sendKey(code){keys.push(code);},
        fightIsActive:()=>false,holdEnterForFood:()=>false,holdExit:()=>false,
        mapInputAuthorized:()=>true,fightLive:()=>false,cancelAlign(){},cityMenuHoldExit:()=>false,
        cityMenuHoldMenu:()=>false,cityMenuMarching:()=>false,battleMakePending:()=>false,
        yieldToMobileMarch:()=>false,fightActive:()=>false,
        _bayeSendTouchEvent(type,x,y){touches.push([type,x,y]);}};
    env.window=env;env.global=env;
    const source=files[kind];
    const helper=between(source,'cityInfoOwns',kind==='city-menu'?'mobileInteger':kind==='overworld'?'identityApi':'readNumber');
    const send=between(source,'engineSendKey',kind==='city-menu'?'enqueueKeys':kind==='overworld'?'sendTouch':'readMarchReport');
    vm.createContext(env);vm.runInContext(helper + send,env);
    return {env,data,keys,touches,send:env.engineSendKey};
}

for (const kind of ['city-menu','overworld','dialog']) {
    test(kind + ' keeps missing old ABI and explicit inactive city-info input behavior',()=>{
        const f=fixture(kind);
        assert.equal(f.send(f.env.VK.DOWN),true);assert.equal(f.send(f.env.VK.ENTER),true);
        f.data.g_hdCityInfoActive=0;assert.equal(f.send(f.env.VK.ENTER),true);
        assert.deepEqual(f.keys,[f.env.VK.DOWN,f.env.VK.ENTER,f.env.VK.ENTER]);
    });
    test(kind + ' refuses pending arrow/confirmation while city-info or malformed owner is defined',()=>{
        const f=fixture(kind), pending=[()=>f.send(f.env.VK.DOWN),()=>f.send(f.env.VK.ENTER)];
        for (const active of [1,2,255,null,'0',NaN,{},false]) {
            f.data.g_hdCityInfoActive=active;
            for (const work of pending) { assert.equal(work(),false); }
        }
        assert.deepEqual(f.keys,[]);
    });
}
test('CITY last current-owner callback cannot turn a pending key into city-info input',()=>{
    const f=fixture('city-menu');
    for (const code of [f.env.VK.DOWN,f.env.VK.ENTER]) {
        delete f.data.g_hdCityInfoActive;
        assert.equal(f.send(code,'pending',()=>{f.data.g_hdCityInfoActive=1;return true;}),false);
    }
    assert.deepEqual(f.keys,[]);
});
test('MAP last fight observation cannot turn a pending arrow/confirmation into city-info input',()=>{
    const f=fixture('overworld');
    f.env.fightLive=()=>{f.data.g_hdCityInfoActive=1;return false;};
    for (const code of [f.env.VK.DOWN,f.env.VK.ENTER]) {
        delete f.data.g_hdCityInfoActive;assert.equal(f.send(code),false);
    }
    assert.deepEqual(f.keys,[]);
});
test('dialog last fight observation seals the actual key against city-info ownership',()=>{
    const f=fixture('dialog');
    f.env.fightActive=()=>{f.data.g_hdCityInfoActive=1;return false;};
    assert.equal(f.send(f.env.VK.ENTER),false);assert.deepEqual(f.keys,[]);
});
test('MAP pick source and touch-up refuse city-info that opens in an engine callback',()=>{
    const f=fixture('overworld'), source=files.overworld;
    vm.runInContext(between(source,'readMapPick','readMapCity')+between(source,'sendTouch','validCityIndex'),f.env);
    f.env.baye.hd={march(){f.data.g_hdCityInfoActive=1;return {pick:1};}};
    assert.equal(f.env.readMapPick(),0);
    delete f.data.g_hdCityInfoActive;
    f.env._bayeSendTouchEvent=(type,x,y)=>{f.touches.push([type,x,y]);f.data.g_hdCityInfoActive=1;};
    assert.equal(f.env.sendTouch(4,5),false);assert.deepEqual(f.touches,[[1,4,5]]);
});
