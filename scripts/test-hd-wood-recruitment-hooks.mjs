import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {RECRUITMENT_HOOK_NAMES, RECRUITMENT_CITY_MAKE_SOURCE, RECRUITMENT_CALL_HOOK_SOURCE,
    recruitmentHooksObserverSource, verifyRecruitmentHookFence, verifyRecruitmentHookFenceStable} from './hd-wood-recruitment-hooks.mjs';

function fixture({absentCity = false, crlf = false} = {}) {
    const ctx = vm.createContext({});
    vm.runInContext('window=globalThis; calls=0; onHook=()=>{calls++}; orig={apply(){calls++;return -1}}; console={warn(){calls++}}; baye={hooks:{},data:{sentinel:[17,23]},keys:[]}', ctx);
    ctx.baye.callHook = vm.runInContext('(' + (crlf ? RECRUITMENT_CALL_HOOK_SOURCE.replaceAll('\n','\r\n') : RECRUITMENT_CALL_HOOK_SOURCE) + ')', ctx);
    if (!absentCity) ctx.baye.hooks.cityMakeCommand = vm.runInContext('(' + RECRUITMENT_CITY_MAKE_SOURCE + ')', ctx);
    vm.runInContext(recruitmentHooksObserverSource, ctx);
    const read = () => ({recruitmentHookFence: structuredClone(ctx.__woodRecruitmentReadHookFence()),
        v32HookFence: {readOnly:true,hooks:['willAddOrder','getMaxArms'].map(name=>({name,present:typeof ctx.baye.hooks[name]!=='undefined',type:typeof ctx.baye.hooks[name]}))}});
    return {ctx,read};
}
const row = (m, name) => m.recruitmentHookFence.hooks.find(h=>h.name===name);
test('recruitment hooks match the current stock product source, without calling it',()=>{
    const text=fs.readFileSync(new URL('../js/hd-overworld.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
    assert.ok(text.includes('baye.hooks[name] = '+RECRUITMENT_CITY_MAKE_SOURCE+';'));
    assert.ok(text.includes('baye.callHook = '+RECRUITMENT_CALL_HOOK_SOURCE+';'));
    const {ctx,read}=fixture(),before=structuredClone({data:ctx.baye.data,keys:ctx.baye.keys}),m=read();
    assert.equal(verifyRecruitmentHookFence({meta:m}).stockCityHookPresent,true);
    assert.equal(ctx.calls,0);assert.deepEqual(structuredClone({data:ctx.baye.data,keys:ctx.baye.keys}),before);
    assert.deepEqual(m.recruitmentHookFence.hooks.map(h=>h.name),RECRUITMENT_HOOK_NAMES);
});
test('recruitment hook getter also records an absent city hook honestly',()=>{
    const {read}=fixture({absentCity:true});assert.equal(verifyRecruitmentHookFence({meta:read()}).stockCityHookPresent,false);
});
test('stock wrapper permits exact CRLF source while retaining its original source bytes',()=>{
    const {read}=fixture({crlf:true}),m=read();assert.ok(m.recruitmentHookFence.callHook.functionSource.includes('\r\n'));
    assert.equal(verifyRecruitmentHookFence({meta:m}).hookFenceMatches,true);
});
test('stable source snapshots retain function references and all unknown diagnostics',()=>{
    const {read}=fixture(),a=read(),b=read();a.recruitmentHookFence.diagnostic={values:[3,5]};b.recruitmentHookFence.diagnostic={values:[3,5]};
    assert.equal(verifyRecruitmentHookFenceStable({beforeMeta:a,afterMeta:b}).hookFenceStable,true);
});
test('editing a returned hook view cannot change actual product hooks or later views',()=>{
    const {ctx,read}=fixture(),fn=ctx.baye.hooks.cityMakeCommand,a=read();a.recruitmentHookFence.hooks[0].functionSource='edited';
    const b=read();assert.equal(ctx.baye.hooks.cityMakeCommand,fn);assert.equal(row(b,'cityMakeCommand').functionSource,RECRUITMENT_CITY_MAKE_SOURCE);assert.equal(ctx.calls,0);
});
test('hook observer refuses reinstallation instead of resetting its reference namespace',()=>{
    const {ctx}=fixture();assert.throws(()=>vm.runInContext(recruitmentHooksObserverSource,ctx),/already installed/);
});
const mutations=[
 ['missing current view',m=>delete m.recruitmentHookFence],
 ['non-readonly view',m=>m.recruitmentHookFence.readOnly=false],
 ['wrong reference namespace',m=>m.recruitmentHookFence.referenceNamespace='different'],
 ['duplicate row',m=>m.recruitmentHookFence.hooks[1]={...m.recruitmentHookFence.hooks[0]}],
 ['extra hook row',m=>m.recruitmentHookFence.hooks.push({name:'unknown'})],
 ['city hook with another body',m=>row(m,'cityMakeCommand').functionSource='function () { return 0; }'],
 ['city hook with side effects',m=>row(m,'cityMakeCommand').functionSource='function () { nativeWrite(); return -1; }'],
 ['city hook wrong type',m=>row(m,'cityMakeCommand').type='object'],
 ['city hook zero reference',m=>row(m,'cityMakeCommand').functionRef=0],
 ['city hook nonintegral reference',m=>row(m,'cityMakeCommand').functionRef=1.5],
 ['city hook aliases wrapper reference',m=>row(m,'cityMakeCommand').functionRef=m.recruitmentHookFence.callHook.functionRef],
 ['absent hook with a retained function',m=>{row(m,'cityMakeCommand').present=false;row(m,'cityMakeCommand').type='undefined';}],
 ['wrapper wrong type',m=>m.recruitmentHookFence.callHook.type='undefined'],
 ['wrapper different code',m=>m.recruitmentHookFence.callHook.functionSource+=' '],
 ['wrapper native-code substitute',m=>m.recruitmentHookFence.callHook.functionSource='function () { [native code] }'],
 ['wrapper zero reference',m=>m.recruitmentHookFence.callHook.functionRef=0],
 ['wrapper unsafe reference',m=>m.recruitmentHookFence.callHook.functionRef=Number.MAX_SAFE_INTEGER+1],
 ['getMaxArms takeover',m=>Object.assign(row(m,'getMaxArms'),{present:true,type:'function',functionRef:3,functionSource:'function(){return 65535;}'})],
 ['willAddOrder takeover',m=>Object.assign(row(m,'willAddOrder'),{present:true,type:'function',functionRef:3,functionSource:'function(){return 0;}'})],
 ['missing absent-hook null source',m=>delete row(m,'getMaxArms').functionSource],
 ['absent hook has a function reference',m=>row(m,'willAddOrder').functionRef=3],
 ['legacy hook view missing',m=>delete m.v32HookFence],
 ['legacy hook view not readonly',m=>m.v32HookFence.readOnly=false],
 ['legacy hook view duplicate identity',m=>m.v32HookFence.hooks.push({...m.v32HookFence.hooks[0]})],
 ['legacy hook view disagrees with actual presence',m=>m.v32HookFence.hooks[0].present=true],
 ['legacy hook view disagrees with actual type',m=>m.v32HookFence.hooks[1].type='function']
];
for(const [name,mutate]of mutations)test('recruitment hook fence rejects '+name,()=>{
    const {read}=fixture(),meta=read();mutate(meta);assert.throws(()=>verifyRecruitmentHookFence({meta}));
});
test('getter exposes an unknown native city hook; it never calls or disguises it',()=>{
    const {ctx,read}=fixture();ctx.baye.hooks.cityMakeCommand=vm.runInContext('(function(){calls++;return 0;})',ctx);
    const meta=read();assert.equal(ctx.calls,0);assert.throws(()=>verifyRecruitmentHookFence({meta}));
});
test('an unknown function cannot spoof the stock source through its own toString',()=>{
    const {ctx,read}=fixture();const bad=vm.runInContext('(function(){calls++;return 0;})',ctx);bad.toString=()=>RECRUITMENT_CITY_MAKE_SOURCE;ctx.baye.hooks.cityMakeCommand=bad;
    assert.throws(()=>verifyRecruitmentHookFence({meta:read()}));assert.equal(ctx.calls,0);
});
for(const name of ['cityMakeCommand','callHook'])test('stable view rejects replacing '+name+' with an identical-source function',()=>{
    const {ctx,read}=fixture(),a=read();if(name==='cityMakeCommand')ctx.baye.hooks.cityMakeCommand=vm.runInContext('('+RECRUITMENT_CITY_MAKE_SOURCE+')',ctx);
    else ctx.baye.callHook=vm.runInContext('('+RECRUITMENT_CALL_HOOK_SOURCE+')',ctx);
    const b=read();verifyRecruitmentHookFence({meta:b});assert.throws(()=>verifyRecruitmentHookFenceStable({beforeMeta:a,afterMeta:b}));
});
test('stable view rejects rewriting even an unknown nested diagnostic',()=>{
    const {read}=fixture(),a=read(),b=read();a.recruitmentHookFence.extra={values:[2,3]};b.recruitmentHookFence.extra={values:[2,4]};assert.throws(()=>verifyRecruitmentHookFenceStable({beforeMeta:a,afterMeta:b}));
});
test('a passed hook view grants no public input, paid cost, native return or HD credit',()=>{
    const {read}=fixture(),r=verifyRecruitmentHookFence({meta:read()});assert.equal(r.sourceOnly,true);
    for(const k of ['publicInputAccepted','actualCostAccepted','actualRecruitmentAccepted','actualNativeReturnAccepted','actualCastAccepted','actualClassicAccepted','hdAccepted','globalHdComplete'])assert.equal(r[k],false,k);
});
