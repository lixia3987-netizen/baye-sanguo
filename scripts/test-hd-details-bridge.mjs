#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/bridge.js',import.meta.url),'utf8');
const hash='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture() {
    const calls=[],writes=[],keys=[],raw={g_PIdx:1,g_hdDetailGeneration:7},
        context=vm.createContext({TextDecoder,TextEncoder,Module:{HEAPU8:new Uint8Array(8192)},
            console:{log(){},warn(){}},addEventListener(){},alert(){},lcdBlur(){}});
    context.window=context;
    for(const name of new Set(source.match(/\b_baye\w+/g)))context[name]=()=>0;
    context._bayeHdReady=()=>1;context._bayeGetPersonCount=()=>786;
    context._bayeHdGetToolCount=()=>33;
    context._bayeHdGetArmType=id=>{calls.push(['arm',id]);return 5;};
    context._bayeGetArmType=()=>{throw Error('legacy U8 call');};
    context._bayeHdGetToolField=(id,field)=>{calls.push(['tool',id,field]);return [1,70,0,2,0,0][field]??65535;};
    context._bayeSendKey=key=>keys.push(key);
    vm.runInContext(source,context);context.baye_bridge_init();
    const baye=context.baye;
    function readonly(value,path='') {
        if(!value||typeof value!=='object')return value;
        return new Proxy(value,{get:(o,k)=>readonly(o[k],path+'.'+String(k)),set:(o,k)=>{writes.push(path+'.'+String(k));throw Error('native write');}});
    }
    baye.data=readonly(raw);baye.ensureData=()=>baye.data;baye.getToolName=id=>'tool-'+id;
    let identity={status:'ready',sha256:hash,generation:1};
    context.BayeHdLibIdentity={read:()=>identity,isCurrent:token=>token===identity};
    function menu(kind=4,ids=[31,9]) {
        Object.assign(raw,{g_hdMenuActive:1,g_hdMenuContext:1,g_hdMenuKind:kind,g_hdMenuSeq:12,
            g_hdMenuCount:ids.length,g_hdMenuItemLen:8,g_hdMenuIndex:0,
            g_hdMenuBytes:new TextEncoder().encode('same\0\0\0\0'.repeat(ids.length)),
            g_hdMenuIds:ids,g_hdMenuIdsCount:ids.length,g_hdMenuIdsKind:kind,
            g_hdMenuIdsSeq:12,g_hdMenuIdsGeneration:7});
    }
    return {context,baye,raw,calls,writes,keys,menu,setIdentity:value=>{identity=value;}};
}
test('native menu IDs preserve reordered goods and same-name full U16 people',()=>{
    const h=fixture();h.menu();let value=plain(h.baye.hd.menuItems());
    assert.equal(value.idsValid,true);assert.deepEqual(value.ids,[31,9]);assert.deepEqual(value.names,['tool-31','tool-9']);
    assert.deepEqual(value.packedNames,['same','same']);
    assert.equal(value.detailGeneration,7);h.menu(3,[699,600]);value=plain(h.baye.hd.menuItems());
    assert.deepEqual(value.ids,[699,600]);assert.equal(value.index,0);assert.deepEqual(h.writes,[]);assert.deepEqual(h.keys,[]);
});
test('proven IDs resolve full native names once per owner and retire a reentrant name read',()=>{
    const h=fixture();h.menu();const lookups=[];
    h.baye.getToolName=id=>{lookups.push(id);return id===31?'方天画戟':'赤兔';};
    let value=plain(h.baye.hd.menuItems());assert.deepEqual(value.names,['方天画戟','赤兔']);
    assert.deepEqual(value.packedNames,['same','same']);
    h.baye.hd.menuItems();h.raw.g_hdMenuIndex=1;h.baye.hd.menuItems();assert.deepEqual(lookups,[31,9]);
    h.raw.g_hdMenuSeq=13;h.raw.g_hdMenuIdsSeq=13;
    h.baye.hd.menuItems();assert.deepEqual(lookups,[31,9,31,9]);
    h.raw.g_hdMenuSeq=14;h.raw.g_hdMenuIdsSeq=14;
    h.baye.getToolName=id=>{h.raw.g_hdDetailGeneration++;return 'retired';};
    value=plain(h.baye.hd.menuItems());assert.equal(value.idsValid,false);assert.deepEqual(value.ids,[]);
    assert.deepEqual(value.names,value.packedNames);assert.deepEqual(h.writes,[]);assert.deepEqual(h.keys,[]);
});
test('menu ID metadata rejects stale owners, malformed IDs and resource bounds',()=>{
    for(const [key,value] of [['g_hdMenuIdsGeneration',6],['g_hdMenuIdsSeq',11],['g_hdMenuIdsKind',3],
        ['g_hdMenuIdsCount',1],['g_hdMenuActive',0],['g_hdMenuIds',[33,9]],['g_hdMenuIds',['31',9]],
        ['g_hdMenuIds',[null,9]],['g_hdMenuIds',[]],['g_hdDetailGeneration',null]]) {
        const h=fixture();h.menu();h.raw[key]=value;const result=plain(h.baye.hd.menuItems());
        assert.equal(result.idsValid,false,key);assert.deepEqual(result.ids,[],key);
    }
});
test('missing help fields stay unknown instead of naming person zero',()=>{
    const h=fixture();const help=plain(h.baye.hd.help());
    assert.equal(help.person,null);assert.equal(help.slot,null);assert.equal(help.protocolVersion,null);
    assert.deepEqual(help.fields,Array(10).fill(null));assert.equal(help.text,'');
    Object.assign(h.raw,{g_hdHelpActive:1,g_hdHelpSeq:3,g_hdHelpProtocolVersion:1,g_hdHelpGeneration:7,
        g_hdHelpInputSeq:90,g_hdHelpKind:1,g_hdHelpComplete:1,g_hdHelpPerson:600,g_hdHelpSlot:11,
        g_hdHelpX:9,g_hdHelpY:8,g_hdHelpTerrain:255,g_hdHelpLevelMax:0,
        g_hdHelpNameGbk:'actual person',g_hdHelpArmGbk:'arm',g_hdHelpStateGbk:'state',
        g_hdHelpFields:[7,91,88,99,401,52,803,901,65535,5],g_hdHelpGbk:'native help'});
    const actual=plain(h.baye.hd.help());assert.equal(actual.person,600);assert.equal(actual.inputSeq,90);
    assert.equal(actual.generation,actual.detailGeneration);assert.deepEqual(actual.fields,h.raw.g_hdHelpFields);
    assert.equal(actual.name,'actual person');assert.equal(actual.text,'native help');
    h.raw.g_hdHelpPerson=false;h.raw.g_hdHelpFields[4]='401';
    assert.equal(h.baye.hd.help().person,null);assert.equal(h.baye.hd.help().fields[4],null);
    assert.deepEqual(h.calls,[]);assert.deepEqual(h.writes,[]);assert.deepEqual(h.keys,[]);
});
test('goods exposes only actually captured title/value pairs, including native zero',()=>{
    const h=fixture();Object.assign(h.raw,{g_hdGoodsActive:1,g_hdGoodsComplete:0,g_hdGoodsCustom:1,
        g_hdGoodsGeneration:7,g_hdGoodsMenuSeq:12,g_hdGoodsIndex:0,g_hdGoodsTool:31,
        g_hdGoodsPropertyCount:3,g_hdGoodsPageStart:0,g_hdGoodsPageEnd:2,g_hdGoodsNameGbk:'native tool',
        g_hdGoodsPropertyTitles:new Uint8Array(384),g_hdGoodsPropertyValues:new Uint8Array(384),
        g_hdGoodsPropertyFlags:[3,1,0]});
    h.raw.g_hdGoodsPropertyTitles.set(new TextEncoder().encode('power'),0);
    h.raw.g_hdGoodsPropertyValues.set(new TextEncoder().encode('0'),0);
    h.raw.g_hdGoodsPropertyTitles.set(new TextEncoder().encode('custom'),128);
    const goods=plain(h.baye.hd.goods());assert.equal(goods.tool,31);assert.equal(goods.complete,0);
    assert.deepEqual(goods.properties,[{index:0,title:'power',value:'0',captured:true},
        {index:1,title:'custom',value:'',captured:false},{index:2,title:'',value:'',captured:false}]);
    delete h.raw.g_hdGoodsPropertyFlags;assert.equal(h.baye.hd.goods().properties[0].captured,false);
    assert.deepEqual(h.writes,[]);assert.deepEqual(h.keys,[]);
});
test('derived equipment arm reads full U16 identity and never falls through to U8',()=>{
    const h=fixture();assert.equal(h.baye.hd.personArmType(600),5);assert.deepEqual(h.calls,[['arm',600]]);
    for(const id of [-1,786,65535,0.5,'600',null])assert.equal(h.baye.hd.personArmType(id),null);
    h.context._bayeHdGetArmType=()=>65535;assert.equal(h.baye.hd.personArmType(600),null);
    delete h.context._bayeHdGetArmType;assert.equal(h.baye.hd.personArmType(600),null);
    assert.deepEqual(h.writes,[]);assert.deepEqual(h.keys,[]);
});
test('tool defaults require actual standard identity, native count and safe fresh fields',()=>{
    const h=fixture();const value=plain(h.baye.hd.toolDetails(31));
    assert.equal(value.attack,70);assert.equal(value.iq,0);assert.equal(value.index,31);assert.equal(value.generation,7);
    assert.equal(h.calls.length,6);assert.deepEqual(h.writes,[]);assert.deepEqual(h.keys,[]);
    for(const id of [-1,33,65535,0.5,'31',null])assert.equal(h.baye.hd.toolDetails(id),null);
    h.context._bayeHdGetToolField=()=>65535;assert.equal(h.baye.hd.toolDetails(31),null);
    h.context._bayeHdGetToolField=()=>1;h.baye.hooks={getToolPropertyValue(){}};
    assert.equal(h.baye.hd.toolDetails(31),null);h.baye.hooks={};
    h.setIdentity({status:'pending',sha256:null,generation:2});assert.equal(h.baye.hd.toolDetails(31),null);
    h.setIdentity({status:'ready',sha256:'unknown Mod',generation:3});assert.equal(h.baye.hd.toolDetails(31),null);
    h.setIdentity({status:'ready',sha256:hash,generation:4});
    h.context._bayeHdGetToolCount=()=>0;assert.equal(h.baye.hd.toolDetails(31),null);
    h.context._bayeHdGetToolCount=()=>33;delete h.context._bayeHdGetToolField;
    assert.equal(h.baye.hd.toolDetails(31),null);
});
test('getter reentrant world or LIB change retires already read tool fields',()=>{
    const h=fixture();h.context._bayeHdGetToolField=(id,field)=>{
        if(field===5)h.raw.g_hdDetailGeneration++;return 1;
    };assert.equal(h.baye.hd.toolDetails(31),null);
    h.context._bayeHdGetToolField=(id,field)=>{
        if(field===5)h.setIdentity({status:'ready',sha256:hash,generation:2});return 1;
    };assert.equal(h.baye.hd.toolDetails(31),null);
});
