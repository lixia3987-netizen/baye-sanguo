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

function personPropertiesFixture({count=3,pageStart=0,pageEnd=2,custom=0}={}) {
    const h=fixture();h.menu(3,[699,600]);h.raw.g_hdMenuIndex=1;
    Object.assign(h.raw,{g_hdReportActive:0,g_hdHelpActive:0,g_hdQtyActive:0,
        g_hdPersonPropertiesProtocolVersion:1,g_hdPersonPropertiesActive:1,
        g_hdPersonPropertiesComplete:0,g_hdPersonPropertiesPageComplete:1,g_hdPersonPropertiesCustom:custom,
        g_hdPersonPropertiesGeneration:7,g_hdPersonPropertiesMenuSeq:12,g_hdPersonPropertiesPaintSeq:61,
        g_hdPersonPropertiesIndex:1,g_hdPersonPropertiesPerson:600,g_hdPersonPropertiesPropertyCount:count,
        g_hdPersonPropertiesPageIndex:0,g_hdPersonPropertiesPageStart:pageStart,g_hdPersonPropertiesPageEnd:pageEnd,
        g_hdPersonPropertiesNameGbk:new Uint8Array(32),
        g_hdPersonPropertiesPropertyTitles:new Uint8Array(256*128),
        g_hdPersonPropertiesPropertyValues:new Uint8Array(256*128),
        g_hdPersonPropertiesPropertyFlags:new Uint8Array(256),
        g_hdPersonPropertiesTitlePaintSeq:new Uint32Array(256),
        g_hdPersonPropertiesValuePaintSeq:new Uint32Array(256)});
    h.raw.g_hdPersonPropertiesNameGbk.set(new TextEncoder().encode('same native name'));
    h.property=(index,title,value,{flags=3,titleSeq=61,valueSeq=61}={})=>{
        const encode=v=>typeof v==='string'?new TextEncoder().encode(v):Uint8Array.from(v);
        for(const [name,text] of [['PropertyTitles',title],['PropertyValues',value]]) {
            const bytes=h.raw['g_hdPersonProperties'+name];bytes.fill(0,index*128,(index+1)*128);bytes.set(encode(text),index*128);
        }
        h.raw.g_hdPersonPropertiesPropertyFlags[index]=flags;
        h.raw.g_hdPersonPropertiesTitlePaintSeq[index]=flags&1?titleSeq:0;
        h.raw.g_hdPersonPropertiesValuePaintSeq[index]=flags&2?valueSeq:0;
    };
    h.property(0,[0xcc,0xe5,0xc1,0xa6],'65535');h.property(1,'actual custom value','0');
    h.read=()=>plain(h.baye.hd.personProperties());
    h.untouched=()=>{assert.deepEqual(h.calls,[]);assert.deepEqual(h.writes,[]);assert.deepEqual(h.keys,[]);};
    return h;
}
function neutralPersonProperties(value) {
    assert.equal(value.active,0);assert.equal(value.complete,0);assert.equal(value.pageComplete,0);
    assert.equal(value.index,null);assert.equal(value.person,null);assert.equal(value.name,'');assert.deepEqual(value.properties,[]);
}

test('person properties bind the actual high U16 selected ID and GBK page without replaying any getter',()=>{
    const h=personPropertiesFixture();h.baye.getPersonName=()=>{throw Error('name getter replay');};
    h.baye.hooks={getPersonPropertyTitle(){throw Error('title replay');},getPersonPropertyValue(){throw Error('value replay');}};
    const value=h.read();assert.equal(value.active,1);assert.equal(value.person,600);assert.equal(value.index,1);
    assert.equal(value.context,1);assert.equal(value.kind,3);assert.equal(value.generation,7);assert.equal(value.detailGeneration,7);
    assert.equal(value.menuSeq,12);assert.equal(value.paintSeq,61);assert.equal(value.name,'same native name');
    assert.equal(value.complete,0);assert.equal(value.pageComplete,1);assert.equal(value.propertyCount,3);
    assert.deepEqual(value.properties[0],{index:0,title:'体力',value:'65535',captured:true,
        titleCaptured:true,valueCaptured:true,titlePaintSeq:61,valuePaintSeq:61});
    assert.deepEqual(value.properties[2],{index:2,title:'',value:'',captured:false,
        titleCaptured:false,valueCaptured:false,titlePaintSeq:0,valuePaintSeq:0});h.untouched();
});

test('custom hooks may authoritatively draw empty and zero values, with current capture flags',()=>{
    const h=personPropertiesFixture({count:2,custom:1});h.raw.g_hdPersonPropertiesComplete=1;
    h.property(0,'empty','');h.property(1,'zero','0');const v=h.read();
    assert.equal(v.active,1);assert.equal(v.custom,1);assert.equal(v.complete,1);assert.equal(v.pageComplete,1);
    assert.equal(v.properties[0].value,'');assert.equal(v.properties[0].captured,true);assert.equal(v.properties[1].value,'0');h.untouched();
});

test('cumulative captures on older pages do not authorize a current native repaint',()=>{
    const h=personPropertiesFixture();h.property(2,'old observed property','prior value',{titleSeq:58,valueSeq:59});
    h.raw.g_hdPersonPropertiesComplete=1;h.raw.g_hdPersonPropertiesPageStart=2;h.raw.g_hdPersonPropertiesPageEnd=3;
    h.raw.g_hdPersonPropertiesPageIndex=1;h.raw.g_hdPersonPropertiesPageComplete=0;
    const v=h.read();assert.equal(v.active,1);assert.equal(v.complete,1);assert.equal(v.pageComplete,0);
    assert.equal(v.pageIndex,1);assert.equal(v.pageStart,2);assert.equal(v.pageEnd,3);
    assert.equal(v.properties[2].title,'old observed property');assert.equal(v.properties[2].value,'prior value');
    assert.equal(v.properties[2].titlePaintSeq,58);assert.equal(v.properties[2].valuePaintSeq,59);
    h.raw.g_hdPersonPropertiesPageComplete=1;neutralPersonProperties(h.read());h.untouched();
});

test('missing title and value halves remain explicitly unread, never filled from native person defaults',()=>{
    const h=personPropertiesFixture();h.raw.g_hdPersonPropertiesPageComplete=0;
    h.property(0,'title observed','unused cached text',{flags:1});h.property(1,'unused title','value observed',{flags:2});
    const v=h.read();assert.equal(v.active,1);assert.equal(v.complete,0);assert.equal(v.pageComplete,0);
    assert.deepEqual(v.properties.map(p=>[p.title,p.value,p.titleCaptured,p.valueCaptured]),
        [['title observed','',true,false],['','value observed',false,true],['','',false,false]]);h.untouched();
});

test('zero-column and offscreen native paints expose no complete HD page',()=>{
    const h=personPropertiesFixture({count:0,pageStart:0,pageEnd:0});h.raw.g_hdPersonPropertiesPageComplete=0;
    h.raw.g_hdPersonPropertiesNameGbk.fill(0);let v=h.read();assert.equal(v.active,1);assert.equal(v.propertyCount,0);
    assert.equal(v.complete,0);assert.equal(v.pageComplete,0);assert.equal(v.name,'');assert.deepEqual(v.properties,[]);
    h.raw.g_hdPersonPropertiesComplete=1;neutralPersonProperties(h.read());h.untouched();
});

test('actual maximum 255 properties and native page index 254 are retained without a guessed page size',()=>{
    const h=personPropertiesFixture({count:255,pageStart:254,pageEnd:255});
    h.property(254,'last actual column','last value');h.raw.g_hdPersonPropertiesPageIndex=254;
    const v=h.read();assert.equal(v.active,1);assert.equal(v.pageComplete,1);assert.equal(v.complete,0);
    assert.equal(v.properties.length,255);assert.equal(v.pageStart,254);assert.equal(v.pageEnd,255);assert.equal(v.pageIndex,254);
    assert.equal(v.properties[254].title,'last actual column');h.untouched();
});

test('every missing person contract or native owner field retires the entire observation',()=>{
    const template=personPropertiesFixture();const fields=Object.keys(template.raw).filter(k=>k.startsWith('g_hdPersonProperties')||
        ['g_hdDetailGeneration','g_hdMenuActive','g_hdMenuContext','g_hdMenuKind','g_hdMenuSeq','g_hdMenuCount',
            'g_hdMenuIndex','g_hdMenuIds','g_hdMenuIdsCount','g_hdMenuIdsKind','g_hdMenuIdsSeq','g_hdMenuIdsGeneration',
            'g_hdReportActive','g_hdHelpActive','g_hdQtyActive'].includes(k));
    for(const field of fields){const h=personPropertiesFixture();delete h.raw[field];neutralPersonProperties(h.read());h.untouched();}
});

test('malformed numeric metadata never coerces strings, booleans, fractions or unknown IDs',()=>{
    const cases=[['ProtocolVersion',2],['Active',2],['Complete','0'],['PageComplete',true],['Custom',null],
        ['Generation',0],['MenuSeq',0],['PaintSeq',0],['Index',0],['Person',699],['Person',786],['Person',65535],
        ['PropertyCount',256],['PropertyCount','3'],['PageIndex',255],['PageStart',3],['PageEnd',4],['PageEnd',null]];
    for(const [field,value] of cases){const h=personPropertiesFixture();h.raw['g_hdPersonProperties'+field]=value;neutralPersonProperties(h.read());h.untouched();}
    for(const count of [0,'786',true,NaN,2001]){const h=personPropertiesFixture();h.context._bayeGetPersonCount=()=>count;neutralPersonProperties(h.read());h.untouched();}
});

test('native menu kind, index, generation and every complete ID must belong to the same observed person page',()=>{
    for(const [field,value] of [['g_hdMenuActive',0],['g_hdMenuKind',4],['g_hdMenuIndex',0],['g_hdMenuSeq',13],
        ['g_hdMenuCount',3],['g_hdMenuIdsCount',1],['g_hdMenuIdsKind',4],['g_hdMenuIdsSeq',13],
        ['g_hdMenuIdsGeneration',8],['g_hdMenuIds',[699,601]],['g_hdMenuIds',[null,600]],
        ['g_hdMenuIds',[786,600]],['g_hdMenuIds',['699',600]],['g_hdMenuIds',[600]]]) {
        const h=personPropertiesFixture();h.raw[field]=value;neutralPersonProperties(h.read());h.untouched();
    }
});

test('real report, help and quantity overlays retire a pending person property presentation',()=>{
    for(const field of ['g_hdReportActive','g_hdHelpActive','g_hdQtyActive']) {
        const h=personPropertiesFixture();h.raw[field]=1;neutralPersonProperties(h.read());h.untouched();
    }
});

test('fixed native byte, flag and revision arrays reject truncation and whole decoded GBK strings',()=>{
    for(const field of ['NameGbk','PropertyTitles','PropertyValues','PropertyFlags','TitlePaintSeq','ValuePaintSeq']) {
        for(const mutation of [buffer=>buffer.slice(0,buffer.length-1),()=>'',()=>null]) {
            const h=personPropertiesFixture(),key='g_hdPersonProperties'+field;h.raw[key]=mutation(h.raw[key]);neutralPersonProperties(h.read());h.untouched();
        }
    }
});

test('native captured strings require NUL, valid GBK pairs and a nonempty title',()=>{
    const cases=[h=>h.raw.g_hdPersonPropertiesNameGbk.fill(65),
        h=>h.raw.g_hdPersonPropertiesPropertyTitles.fill(65,0,128),
        h=>h.raw.g_hdPersonPropertiesPropertyValues.fill(65,128,256),
        h=>h.property(0,[0x81],'value'),h=>h.property(0,[0x81,0x7f],'value'),
        h=>h.property(0,'title',[0xfe,0x30]),h=>h.property(0,'','empty title is not complete')];
    for(const mutate of cases){const h=personPropertiesFixture();mutate(h);neutralPersonProperties(h.read());h.untouched();}
});

test('capture flags and paint revisions cannot invent completed current or cumulative pages',()=>{
    const cases=[h=>h.raw.g_hdPersonPropertiesPropertyFlags[0]=4,
        h=>h.raw.g_hdPersonPropertiesTitlePaintSeq[0]=0,
        h=>h.raw.g_hdPersonPropertiesValuePaintSeq[2]=61,
        h=>h.raw.g_hdPersonPropertiesValuePaintSeq[0]=60,
        h=>h.raw.g_hdPersonPropertiesComplete=1];
    for(const mutate of cases){const h=personPropertiesFixture();mutate(h);neutralPersonProperties(h.read());h.untouched();}
});

test('reentrant GBK byte reads cannot combine owners, selected IDs or page tickets',()=>{
    for(const mutate of [h=>h.raw.g_hdDetailGeneration++,h=>h.raw.g_hdMenuSeq++,
        h=>h.raw.g_hdPersonPropertiesPaintSeq++,h=>h.raw.g_hdMenuIds[0]=601,
        h=>h.raw.g_hdMenuIndex=0,h=>h.raw.g_hdReportActive=1]) {
        const h=personPropertiesFixture(),bytes=Array.from(h.raw.g_hdPersonPropertiesPropertyValues);
        Object.defineProperty(bytes,128,{get(){mutate(h);return 48;}});h.raw.g_hdPersonPropertiesPropertyValues=bytes;
        neutralPersonProperties(h.read());h.untouched();
    }
});

test('the final owner fence catches a mutation during the second full buffer sampling pass',()=>{
    for(const field of ['g_hdDetailGeneration','g_hdPersonPropertiesPaintSeq']) {
        const h=personPropertiesFixture(),bytes=Array.from(h.raw.g_hdPersonPropertiesPropertyValues);let reads=0;
        Object.defineProperty(bytes,0,{get(){if(++reads===2)h.raw[field]++;return 54;}});
        h.raw.g_hdPersonPropertiesPropertyValues=bytes;neutralPersonProperties(h.read());assert.ok(reads>=2);h.untouched();
    }
});

test('second-pass full-ID and fixed-buffer changes cannot escape earlier identity or length checks',()=>{
    for(const mutation of [h=>h.raw.g_hdMenuIds[0]=698,h=>{h.raw.g_hdPersonPropertiesPropertyTitles.length=384;}]) {
        const h=personPropertiesFixture();h.raw.g_hdPersonPropertiesPropertyTitles=Array.from(h.raw.g_hdPersonPropertiesPropertyTitles);
        const bytes=Array.from(h.raw.g_hdPersonPropertiesPropertyValues);let reads=0;
        Object.defineProperty(bytes,0,{get(){if(++reads===2)mutation(h);return 54;}});
        h.raw.g_hdPersonPropertiesPropertyValues=bytes;neutralPersonProperties(h.read());assert.ok(reads>=2);h.untouched();
    }
});

test('byte holes and nonnumeric byte values cannot hide in an unread property slot',()=>{
    for(const mutate of [bytes=>{delete bytes[256];},bytes=>{bytes[256]='0';},bytes=>{bytes[256]=true;}]) {
        const h=personPropertiesFixture(),bytes=Array.from(h.raw.g_hdPersonPropertiesPropertyTitles);
        mutate(bytes);h.raw.g_hdPersonPropertiesPropertyTitles=bytes;neutralPersonProperties(h.read());h.untouched();
    }
});

test('a changed actual person resource count during sampling retires the complete page',()=>{
    const h=personPropertiesFixture();let reads=0;h.context._bayeGetPersonCount=()=>++reads===1?786:785;
    neutralPersonProperties(h.read());assert.equal(reads,2);h.untouched();
});

test('unavailable engine, throw during native reads and root data replacement all remain neutral',()=>{
    const h=personPropertiesFixture();h.context._bayeHdReady=()=>0;neutralPersonProperties(h.read());h.untouched();
    const throwing=personPropertiesFixture();Object.defineProperty(throwing.raw,'g_hdPersonPropertiesPropertyCount',{get(){throw Error('unavailable field');}});
    neutralPersonProperties(throwing.read());throwing.untouched();
    const replaced=personPropertiesFixture();replaced.baye.ensureData=()=>({...replaced.baye.data});neutralPersonProperties(replaced.read());replaced.untouched();
    const unavailable=personPropertiesFixture();unavailable.baye.ensureData=()=>{throw Error('data not bound');};neutralPersonProperties(unavailable.read());unavailable.untouched();
});

test('person page paint and owner counters preserve high unsigned bits through the actual WASM U32 binding',()=>{
    const h=personPropertiesFixture(),binary=Uint8Array.from([0,97,115,109,1,0,0,0,1,6,1,96,1,127,1,127,
        3,2,1,0,5,3,1,0,1,7,17,2,6,109,101,109,111,114,121,2,0,4,114,101,97,100,0,0,10,9,1,7,0,32,0,40,2,0,11]),
        native=new WebAssembly.Instance(new WebAssembly.Module(binary)).exports,mem=new DataView(native.memory.buffer),c=h.context;
    c.Module.HEAPU8=new Uint8Array(native.memory.buffer);c._ValueDef_get_type=()=>c.ValueTypeU32;
    c._baye_get_u32_value=native.read;c._baye_set_u32_value=()=>{throw Error('native U32 write');};
    mem.setUint32(128,0x80000000,true);const binding=c.baye_bridge_valuedef(1,128);
    assert.equal(native.read(128),-2147483648);assert.equal(binding.value,0x80000000);
    for(const field of ['g_hdDetailGeneration','g_hdMenuIdsGeneration','g_hdPersonPropertiesGeneration',
        'g_hdMenuSeq','g_hdMenuIdsSeq','g_hdPersonPropertiesMenuSeq','g_hdPersonPropertiesPaintSeq'])h.raw[field]=binding;
    h.raw.g_hdPersonPropertiesTitlePaintSeq=Array(256).fill(0);h.raw.g_hdPersonPropertiesValuePaintSeq=Array(256).fill(0);
    for(const i of [0,1]){h.raw.g_hdPersonPropertiesTitlePaintSeq[i]=binding;h.raw.g_hdPersonPropertiesValuePaintSeq[i]=binding;}
    const v=h.read();assert.equal(v.active,1);assert.equal(v.pageComplete,1);assert.equal(v.paintSeq,0x80000000);
    assert.equal(v.generation,0x80000000);assert.equal(v.properties[0].valuePaintSeq,0x80000000);h.untouched();
});
