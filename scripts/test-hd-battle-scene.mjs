import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sceneSource=readFileSync(new URL('../js/hd-battle-scene.js',import.meta.url),'utf8');
const terrainSource=readFileSync(new URL('../js/hd-battle-terrain.js',import.meta.url),'utf8');
const identitySource=readFileSync(new URL('../js/hd-lib-identity.js',import.meta.url),'utf8');
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url)));
const nativeHeader=readFileSync(new URL('../vendor/iBaye/src/hd-bridge.h',import.meta.url),'utf8');
const nativeFight=readFileSync(new URL('../vendor/iBaye/src/Fight.c',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const bitset=frames=>{const out=Array(32).fill(0);for(const f of frames)out[f>>3]|=1<<(f&7);return out;};
const next=()=>new Promise(resolve=>setImmediate(resolve));

async function harness(family='ai',scale=4){
    const logs=[],writes=[],inputs=[],canvasList=[];let paintHook=null,nameHook=null;
    function drawing(label){
        const props={};return new Proxy(props,{get(target,k){
            if(k in target)return target[k];
            return (...args)=>{logs.push({label,op:k,args});if(paintHook)paintHook(label,k,args);};
        }});
    }
    const doc={hidden:false,createElement(tag){assert.equal(tag,'canvas');const label='offscreen-'+canvasList.length;
        const ctx=drawing(label),canvas={width:0,height:0,getContext:()=>ctx};canvasList.push(canvas);return canvas;}};
    const makePerson=()=>({OldBelong:1,Belong:1,Level:1,Force:60,IQ:60,Devotion:80,Character:0,Experience:0,Thew:100,
        ArmsType:1,Arms:100,Tool1:0,Tool2:0,Equip:[0,0],Age:30});
    const data={g_hdEngineReady:1,g_hdDetailGeneration:7,g_hdFightActive:1,g_hdFightOver:0,g_FgtOver:0,
        g_hdReportActive:0,g_hdMenuActive:0,g_hdHelpActive:0,g_hdViewActive:0,g_hdQtyActive:0,
        g_MapWid:24,g_MapHgt:24,g_MapSX:3,g_MapSY:4,g_PIdx:1,
        g_FightMapData:Array(65536).fill(1),g_FgtParam:{GenArray:Array(20).fill(0)},
        g_GenPos:Array.from({length:20},()=>({x:0,y:0,hp:0,mp:0,move:0,active:0,state:8})),
        g_Persons:Array.from({length:2000},makePerson)};
    data.g_FgtParam.GenArray[0]=1;data.g_FgtParam.GenArray[10]=2;
    data.g_GenPos[0]={x:5,y:6,hp:81,mp:40,move:4,active:0,state:0};
    data.g_GenPos[10]={x:8,y:7,hp:80,mp:30,move:4,active:1,state:0};
    const opaque=new Proxy(data,{set(target,k,v){writes.push([k,v]);throw Error('native write');}});
    const baye={data:opaque,hooks:{},hd:{ready:()=>true,personArmType:()=>1},getPersonCount:()=>200,
        getPersonName(index){if(nameHook)nameHook(index);return index===0?'高顺':'方悦';},
        sendKey(...args){inputs.push(args);throw Error('input forbidden');}};
    const context=vm.createContext({console,document:doc,baye,dynLib:lib.toString('hex'),
        crypto:{subtle:{digest:async(_algorithm,bytes)=>Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer}},
        setTimeout(){throw Error('scene cannot schedule timers');},setInterval(){throw Error('scene cannot schedule timers');},
        localStorage:{getItem(){throw Error('scene cannot read preferences');},setItem(){throw Error('scene cannot write preferences');}}});
    context.window=context;
    for(const [source,name] of [[identitySource,'identity'],[terrainSource,'terrain'],[sceneSource,'scene']])vm.runInContext(source,context,{filename:name});
    context.BayeHdLibIdentity.read();await next();await next();
    let start=family==='ai'?12:family==='upgrade'?0:6;
    const entry=structuredClone(manifest.entries.find(e=>e.speId===27 && e.startFrm===start));
    const frames=[start],source={protocolVersion:family==='ai'?2:1,valid:true,mapSX:3,mapSY:4,mapWidth:24,mapHeight:24,
        screenWidth:160,screenHeight:96,regionX:32,regionY:32,regionWidth:16,regionHeight:16,clearFrames:bitset([]),
        // Deliberately non-white LCD base: a scene must never use these pixels as its HD background.
        basePixels:Array(256).fill(17),baseRgba:Array.from({length:1024},(_,i)=>i%4===3?255:123)};
    if(family==='ai')Object.assign(source,{commandType:0,commandParam:0,actorIndex:10,targetIndex:0,actorPerson:1,targetPerson:0,actorX:8,actorY:7,targetX:5,targetY:6});
    else {
        Object.assign(source,{reason:family==='upgrade'?1:2,phase:1,subjectIndex:0,subjectPerson:0,subjectX:5,subjectY:6,
            beforeLevel:1,afterLevel:family==='upgrade'?2:1,beforeExperience:family==='upgrade'?108:8,afterExperience:8,
            beforeState:0,afterState:family==='upgrade'?0:8,beforeHp:81,afterHp:81,
            beforeArms:family==='upgrade'?100:0,afterArms:family==='upgrade'?100:0,levelMax:20});
        Object.assign(data.g_Persons[0],{Level:source.afterLevel,Experience:source.afterExperience,Arms:source.afterArms});
        data.g_GenPos[0].state=source.afterState;
    }
    const event={active:1,protocolVersion:2,id:27,kind:4,resourceIndex:0,protocolValid:true,frameValid:true,keyflag:0,skipEligible:false,
        generation:7,eventId:12,parentEventId:0,depth:1,contextKnown:true,actorIndex:family==='ai'?10:0,targetIndex:0,
        x:32,y:32,count:18,picmax:9,startFrm:start,endFrm:start+5,resourceLength:735,resourceFingerprint:'fnv1a32:ba494eea:735',
        commitSeq:2,frameIndex:start,display:{generation:7,eventId:12,commitSeq:2,frameIndex:start,frameValid:true,visibleFrames:bitset(frames)}};
    event[family==='ai'?'aiTarget':'statusEffect']=source;event.display[family==='ai'?'aiTarget':'statusEffect']=source;
    const images={};for(const p of entry.pictures)if(p.src)images[p.picIndex]={width:p.width,height:p.height,complete:true,tag:'asset-'+p.picIndex};
    const canvas={width:160*scale,height:96*scale},ctx=drawing('output');let current=true;
    const options={canvas,context:ctx,event,source,frames,clears:[],entry,assets:{status:'ready',images},data:opaque,validateCurrent:()=>current};
    const api=context.BayeHdBattleScene.createController(context);
    return {api,options,data,opaque,baye,context,doc,logs,writes,inputs,canvasList,
        retire(){current=false;},onPaint(fn){paintHook=fn;},onName(fn){nameHook=fn;},
        paint(){return api.paint(options);},reason(){return api.debugSnapshot().reason;}};
}
function reject(h,reason){assert.equal(h.paint(),null);assert.match(h.reason(),reason);assert.equal(h.inputs.length,0);assert.equal(h.writes.length,0);}

for(const family of ['ai','upgrade','departure'])test(family+' uses a verified HD viewport and exact original event cell',async()=>{
    const h=await harness(family),before=JSON.stringify(h.data),result=plain(h.paint());
    assert.ok(result,h.reason());assert.equal(result.source,'hd-battle-scene');
    assert.deepEqual(result.view,{x:3,y:4,cols:10,rows:6});assert.deepEqual(result.region,{x:128,y:128,width:64,height:64});
    assert.deepEqual(result.subject,{index:0,person:0,x:5,y:6});
    assert.deepEqual(result.renderedUnits,family==='departure'?[10]:[0,10]);
    assert.equal(JSON.stringify(h.data),before);assert.equal(h.inputs.length,0);assert.equal(h.writes.length,0);
    assert.ok(h.logs.some(v=>v.op==='fillText' && v.args[0]==='方悦'));
    assert.equal(h.logs.some(v=>v.op==='putImageData'),false,'no LCD base can be pasted into the HD scene');
});
test('initialization phase2 is explicitly inactive, matching production C order',async()=>{
    assert.match(nativeHeader,/#define\s+BAYE_HD_STATUS_EFFECT_COMMAND\s+1/);
    assert.match(nativeHeader,/#define\s+BAYE_HD_STATUS_EFFECT_INITIALIZE\s+2/);
    assert.ok(nativeFight.indexOf('FgtInit();')<nativeFight.indexOf('baye_hd_set_fight(1, 0);'));
    const h=await harness('upgrade');h.options.source.phase=2;h.data.g_hdFightActive=0;assert.ok(h.paint(),h.reason());
});
test('native gray LCD pixels are never background evidence; valid gray hills remain HD',async()=>{
    const h=await harness();h.data.g_FightMapData.fill(6,0,24*24);assert.ok(h.paint(),h.reason());
    assert.equal(h.logs.some(v=>v.op==='putImageData'),false);
});
test('logical edge tile9,5 projects inside the unchanged canvas',async()=>{
    const h=await harness('ai',10),s=h.options.source;s.targetX=12;s.targetY=9;s.regionX=144;s.regionY=80;
    h.data.g_GenPos[0].x=12;h.data.g_GenPos[0].y=9;h.options.event.x=144;h.options.event.y=80;
    const r=plain(h.paint());assert.ok(r,h.reason());assert.deepEqual(r.region,{x:1440,y:800,width:160,height:160});
});
test('native viewport, not action focus/camera, chooses the scene projection',async()=>{
    const h=await harness();h.data.g_FoucsX=23;h.data.g_FoucsY=23;const r=plain(h.paint());assert.ok(r,h.reason());assert.equal(r.region.x,128);
});
test('cleared earlier frame is not revived; only published visible frame is drawn',async()=>{
    const h=await harness(),o=h.options;o.frames=[13];o.clears=[12];o.event.frameIndex=13;o.event.display.frameIndex=13;
    o.event.display.visibleFrames=bitset([13]);o.source.clearFrames=bitset([12]);
    const r=plain(h.paint());assert.ok(r,h.reason());assert.deepEqual(r.frames,[13]);assert.deepEqual(r.clears,[12]);
    const sprites=h.logs.filter(v=>v.op==='drawImage' && v.args[0]?.tag).map(v=>v.args[0].tag);assert.deepEqual(sprites,['asset-8']);
});
test('all-clear display returns the HD scene without any resurrected image',async()=>{
    const h=await harness(),o=h.options;o.frames=[];o.clears=[12];o.event.display.visibleFrames=bitset([]);o.source.clearFrames=bitset([12]);
    assert.ok(h.paint(),h.reason());assert.equal(h.logs.some(v=>v.op==='drawImage' && v.args[0]?.tag),false);
});
const negatives=[
 ['unknown LIB',h=>{h.context.dynLib='00';},/unverified-original/],
 ['wrong declared LIB length',h=>{h.context.BayeHdLibIdentity={read:()=>({status:'ready',sha256:manifest.libSha256,byteLength:207194,generation:1}),isCurrent:()=>true};},/unverified-original/],
 ['hidden page',h=>{h.doc.hidden=true;},/hidden/],
 ['retired source closure',h=>h.retire(),/event-retired/],
 ['wrong data object',h=>{h.baye.data={...h.data};},/native-data/],
 ['wrong detail generation',h=>{h.data.g_hdDetailGeneration=8;},/wrong-native-owner/],
 ['active report',h=>{h.data.g_hdReportActive=1;},/wrong-native-owner/],
 ['active menu',h=>{h.data.g_hdMenuActive=1;},/wrong-native-owner/],
 ['battle ended',h=>{h.data.g_FgtOver=2;},/wrong-native-owner/],
 ['AI cannot use inactive fight',h=>{h.data.g_hdFightActive=0;},/wrong-native-owner/],
 ['custom person count',h=>{h.baye.getPersonCount=()=>201;},/person-count/],
 ['short full map',h=>{h.data.g_FightMapData.length=575;},/missing-full-map/],
 ['unknown map tile',h=>{h.data.g_FightMapData[0]=0;},/unknown-map/],
 ['NaN map tile',h=>{h.data.g_FightMapData[100]=NaN;},/unknown-map/],
 ['native map dimensions drift',h=>{h.data.g_MapWid=25;},/wrong-native-owner/],
 ['native map origin drift',h=>{h.data.g_MapSX=4;},/wrong-native-owner/],
 ['short GenArray',h=>{h.data.g_FgtParam.GenArray.length=19;},/array-length/],
 ['wrong subject identity',h=>{h.data.g_FgtParam.GenArray[0]=3;},/subject-mismatch/],
 ['duplicate participant',h=>{h.data.g_FgtParam.GenArray[1]=1;},/duplicate-person/],
 ['out of original token range',h=>{h.data.g_FgtParam.GenArray[1]=201;},/person-token/],
 ['missing position field',h=>{delete h.data.g_GenPos[19].move;},/invalid-native-move/],
 ['equipment alias mismatch',h=>{h.data.g_Persons[0].Tool1=2;},/equipment-alias/],
 ['invalid equipped arm type',h=>{h.baye.hd.personArmType=()=>255;},/native-unit-label/],
 ['empty native name',h=>{h.baye.getPersonName=()=>'';},/native-unit-label/],
 ['unavailable PNG',h=>{delete h.options.assets.images[7];},/effect-image/],
 ['not-yet-decoded PNG',h=>{h.options.assets.images[7].complete=false;},/effect-image/],
 ['broken decoded PNG dimensions',h=>{h.options.assets.images[7].naturalWidth=0;h.options.assets.images[7].naturalHeight=0;},/effect-image/],
 ['wrong physical PNG size',h=>{h.options.assets.images[7].width--;},/effect-image/],
 ['visible and cleared same frame',h=>{h.options.clears=[12];h.options.source.clearFrames=bitset([12]);},/frame-clear/],
 ['unpublished visible frame',h=>{h.options.frames=[13];},/frame-clear/],
 ['frame past displayed commit',h=>{h.options.event.display.visibleFrames=bitset([13]);h.options.frames=[13];},/frame-range/],
 ['invalid native white mask',h=>{h.options.entry.pictures[7].nativeWhitePixels[0]=NaN;},/array-byte/],
 ['unrelated SPE',h=>{h.options.event.id=39;},/27-event/],
 ['wrong effect entry family',h=>{h.options.entry.statusVersion=1;},/entry-family/],
 ['event actor mismatch',h=>{h.options.event.actorIndex=11;},/event-subject/],
 ['source not actual displayed ticket',h=>{h.options.event.display.aiTarget={...h.options.source,targetX:6};},/source-field/],
 ['outside viewport target',h=>{h.options.source.targetX=13;},/projection-outside/],
 ['custom terrain hook',h=>{h.baye.hooks.drawMapUnit=()=>{};},/unverified-full-terrain/],
 ['nonuniform canvas',h=>{h.options.canvas.height++;},/canvas-geometry/]
];
for(const [name,mutate,reason] of negatives)test('reject '+name,async()=>{const h=await harness();mutate(h);reject(h,reason);});
test('command status cannot borrow initialization inactive allowance',async()=>{const h=await harness('upgrade');h.data.g_hdFightActive=0;reject(h,/wrong-native-owner/);});
test('initialization status cannot claim an active command lifecycle',async()=>{const h=await harness('upgrade');h.options.source.phase=2;reject(h,/wrong-native-owner/);});
test('departed subject must retain the exact published after state/HP/arms',async()=>{const h=await harness('departure');h.data.g_GenPos[0].hp=0;reject(h,/status-world/);});
test('name getter cannot replace opaque native data',async()=>{const h=await harness();h.onName(()=>{h.baye.data={...h.data};});reject(h,/native-data|lib-or-data/);});
test('name getter cannot tear an earlier copied map byte',async()=>{const h=await harness();let once=false;h.onName(()=>{if(!once){once=true;h.data.g_FightMapData[0]=2;}});reject(h,/torn-native-scene/);});
test('offscreen drawing cannot retain a source after owner retirement',async()=>{const h=await harness();h.onPaint(label=>{if(label!=='output')h.retire();});reject(h,/event-retired/);assert.equal(h.logs.some(v=>v.label==='output' && v.op==='drawImage'),false);});
test('output drawing is checked again and a late owner change requests LCD fallback',async()=>{const h=await harness();h.onPaint((label,op)=>{if(label==='output' && op==='drawImage')h.retire();});reject(h,/event-retired/);});
test('participant outside effect cell still participates in whole-scene double read',async()=>{const h=await harness();h.onPaint((label,op)=>{if(label!=='output' && op==='drawImage')h.data.g_GenPos[10].mp++;});reject(h,/scene-changed/);});
test('draw errors fail closed without changing native state or authorizing keys',async()=>{const h=await harness();h.onPaint(()=>{throw Error('draw-fault');});reject(h,/draw-fault/);});
