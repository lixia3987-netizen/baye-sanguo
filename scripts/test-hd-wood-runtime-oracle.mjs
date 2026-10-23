/** Root-operated offline checks only. Synthetic ticket fixtures are not player evidence. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { woodObserverSource, woodNativeTimeline, woodAttemptFacts, validateWoodCaptureBinding,
    verifyWoodCopyCompleteness, verifyWoodVisibleHd, verifyWoodPhysicalLcd } from './hd-wood-runtime-oracle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = fs.readFileSync(path.join(root, 'libs/dat-mod.lib'));
const clone = v => structuredClone(v);
function pass(name, fn) { test(name, fn); }
function reject(name, fn) { test(name, () => assert.throws(fn)); }
function rawItem(lib, id) {
    const address = lib.readUInt32LE((id - 1) * 4), size = lib.readUInt32LE(address);
    assert.equal(lib.readUInt16LE(address + 4), id); assert.equal(lib.readUInt16LE(address + 6), 1);
    return lib.subarray(address + 14, address + size);
}
const timelines = new Map([6, 7].map(s => [s, woodNativeTimeline(library, s)]));
pass('Original standard LIB identity', () => assert.equal(crypto.createHash('sha256').update(library).digest('hex'), '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'));
pass('Serialized read-only observer compiles offline', () => new vm.Script(woodObserverSource, { filename: 'r34-wood-observer-injection.js' }));
pass('Actual WOOD37 independent timer: eight versus one copies, first64 then66', () => {
    assert.deepEqual(timelines.get(6).map(t => [t.frame, t.width]), [[0,64],[1,66],[2,66],[3,66],[4,66],[5,66],[6,66],[7,66]]);
    assert.deepEqual(timelines.get(7).map(t => [t.frame, t.width]), [[0,64]]);
    const payload = rawItem(library,37);
    assert.deepEqual(Array.from({length:8},(_,i)=>Array.from(payload.subarray(6+5*i,11+5*i))), Array.from({length:8},(_,i)=>[0,0,20,20,i%2]));
});
pass('All actual ROM bitplane pixels, visible slots and cumulative clear footprints replay independently', () => {
    const payload = rawItem(library, 37), pictures = []; let offset = 46;
    for (let i=0;i<2;i++) {
        const width=payload.readUInt16LE(offset), height=payload.readUInt16LE(offset+2), row=Math.ceil(width/8);
        assert.deepEqual([width,height,payload.readUInt16LE(offset+4),payload[offset+6]], [i?66:64,64,1,0]);
        pictures.push({width,height,row,data:payload.subarray(offset+7,offset+7+row*height)}); offset+=7+row*height;
    }
    assert.equal(offset,payload.length);
    for (const timeline of timelines.values()) {
        const pixels=Buffer.alloc(160*96); let clears=0;
        for (const t of timeline) {
            const currentClears=t.clears[0], added=currentClears&~clears; clears=currentClears;
            for(let i=0;i<8;i++)if(added&(1<<i))for(let y=16;y<80;y++)pixels.fill(0,y*160+48,y*160+48+pictures[i%2].width);
            for(let i=0;i<8;i++)if(t.visible[0]&(1<<i)){
                const p=pictures[i%2];for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)pixels[(y+16)*160+x+48]=(p.data[y*p.row+(x>>3)]&(128>>(x&7)))?255:0;
            }
            assert.deepEqual(t.pixels,pixels);
        }
    }
});

function fixture(skill=6) {
    const generation=19,eventId=23,actor={i:0,id:189,x:8,y:7},target={i:10,id:46,x:9,y:8};
    const actorUnit={...actor,personIndex:188,state:0,hp:100,mp:100,move:5,arms:1500,active:0};
    const targetUnit={...target,personIndex:45,state:0,hp:100,mp:70,move:4,arms:1200,active:0};
    const attempt={succeeded:true,skill:{id:skill},actor,target,proof:{generation,casterId:189,targetId:46,x:9,y:8,casterMp:100},movieEvents:[eventId],
        before:{generation,units:[actorUnit,targetUnit]},after:{generation,units:[{...actorUnit,mp:100-(skill===6?20:25)},{...targetUnit,arms:1100}]}};
    const captures=timelines.get(skill).map((t,n)=>{
        const scene={generation,eventId,commitSeq:n+1,frameIndex:t.frame,frameValid:true,visibleFrames:Array.from(t.visible),composition:{width:t.width,clearFrames:Array.from(t.clears)}};
        const units=Array.from({length:20},(_,i)=>({i,id:0}));units[0]={...actorUnit,mp:attempt.after.units[0].mp};units[10]=clone(targetUnit);
        const c={stage:'lcd-flush',rawSource:'lcd-callback-image-data',at:n+0.5,spe:{active:1,generation,eventId,skillId:skill,actorIndex:0,targetIndex:10,display:scene},
            result:{active:true,protocolVersion:1,custom:false,phase:'movie',generation,session:4,skillId:skill,actorIndex:0,targetIndex:10,resultKind:1,value:0,scene:{frameValid:false}},
            top:{active:true,valid:true,kind:2,generation,session:4},fight:{active:1,over:0},units,nativeRgba:'actual-fixture-'+n};
        bind(c);return c;
    });
    return {attempt,captures,skill};
}
function bind(c){for(const k of ['before','after','callbackBefore','callbackAfter'])c[k]=clone({spe:c.spe,result:c.result,top:c.top,fight:c.fight,units:c.units});return c;}
const good=fixture();
pass('Bound real-shaped transient movie owner is allowed before numeric scene readiness',()=>validateWoodCaptureBinding(good.captures[0],good.attempt,6));
pass('All8 actual rolling-wood copies required and accepted',()=>assert.equal(verifyWoodCopyCompleteness(good.captures,good.attempt,6,timelines.get(6)).distinctCopies,8));
pass('Fallingstone selected interval requires only its one true64 copy',()=>{const f=fixture(7);assert.equal(verifyWoodCopyCompleteness(f.captures,f.attempt,7,timelines.get(7)).distinctCopies,1);});
for(const [name,indices]of [['missing first copy',[1,2,3,4,5,6,7]],['missing middle copy',[0,1,2,4,5,6,7]],['final copy alone',[7]],['duplicate final cannot substitute for missing',[7,7,7,7,7,7,7,7]]])reject(name,()=>verifyWoodCopyCompleteness(indices.map(i=>good.captures[i]),good.attempt,6,timelines.get(6)));
reject('Unknown copied commit',()=>{const f=fixture();f.captures[7].spe.display.commitSeq=9;bind(f.captures[7]);verifyWoodCopyCompleteness(f.captures,f.attempt,6,timelines.get(6));});
reject('Movie generation cannot borrow another attempt',()=>{const f=fixture();f.captures[0].spe.generation++;bind(f.captures[0]);validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
for (const skill of [6, 7]) {
    for (const [name, change] of [
        ['proof-only generation', a => a.proof.generation += 1000],
        ['before-only generation', a => a.before.generation += 1000],
        ['after-only generation', a => a.after.generation += 1000],
        ['missing before generation', a => delete a.before.generation],
        ['missing after generation', a => delete a.after.generation],
    ]) reject('WOOD' + skill + ' rejects ' + name, () => {
        const f = fixture(skill); change(f.attempt);
        validateWoodCaptureBinding(f.captures[0], f.attempt, skill);
    });
}
reject('Metadata cannot detach from callback snapshot',()=>{const f=fixture();f.captures[0].callbackAfter.spe.eventId++;validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('Missing callback snapshot',()=>{const f=fixture();delete f.captures[0].callbackBefore;validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('Actual units cannot detach from snapshot roster',()=>{const f=fixture();f.captures[0].before.units[10].arms--;validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('Movie must already observe paid native MP',()=>{const f=fixture();f.captures[0].units[0].mp=100;bind(f.captures[0]);validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('Movie cannot claim target damage before NUM stage',()=>{const f=fixture();f.captures[0].units[10].arms=1100;bind(f.captures[0]);validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('WOOD cannot borrow the state-only no-SKILL-owner convention',()=>{const f=fixture();f.captures[0].result.active=false;bind(f.captures[0]);validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('ARMS_GAIN is not WOOD ARMS_LOSS',()=>{const f=fixture();f.captures[0].result.resultKind=2;bind(f.captures[0]);validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('No synthetic movement-state1 rule',()=>{const f=fixture();f.attempt.after.units[1].move=1;woodAttemptFacts(f.attempt,6);});
pass('Postlude source-shaped nested event, actual damage and completed target loss',()=>{const f=fixture(),c=clone(f.captures.at(-1));c.spe.active=0;c.result.phase='hold';c.result.sourceValid=true;c.result.value=100;c.result.scene={generation:19,session:4,eventId:23};c.units[10].arms=1100;bind(c);validateWoodCaptureBinding(c,f.attempt,6);});
reject('Postlude incorrect applied damage',()=>{const f=fixture(),c=clone(f.captures.at(-1));c.spe.active=0;c.result.phase='numbers';c.result.sourceValid=true;c.result.value=99;c.result.scene={generation:19,session:4,eventId:23};c.units[10].arms=1100;bind(c);validateWoodCaptureBinding(c,f.attempt,6);});

function visible(){return{hidden:false,dom:{x:0,y:0,width:160,height:96,viewport:{width:160,height:96},visible:true,inViewport:true,stackOwned:true,
    chain:[{id:'hd-spe-canvas',display:'block',visibility:'visible',opacity:'1'},{id:'hd-spe',display:'block',visibility:'visible',opacity:'1'}],
    points:[[80,48],[40,33],[120,62]].map(([x,y])=>({x,y,stackOwned:true,canvasOrStageAtFront:true,top:{id:'hd-spe-canvas'}}))}};}
pass('Actual three-point full ancestor visibility accepted',()=>verifyWoodVisibleHd(visible()));
reject('Transparent ancestor is not visible HD',()=>{const c=visible();c.dom.chain[1].opacity='0';verifyWoodVisibleHd(c);});
reject('Obscured peripheral point cannot borrow center visibility',()=>{const c=visible();c.dom.points[2].canvasOrStageAtFront=false;verifyWoodVisibleHd(c);});
const native=Buffer.alloc(160*96*4);for(let i=0;i<native.length;i+=4){native[i]=(i/4)%251;native[i+1]=31;native[i+2]=95;native[i+3]=255;}
const physical={width:320,height:192,rgba:Buffer.alloc(320*192*4)};
for(let y=0;y<192;y++)for(let x=0;x<320;x++)native.copy(physical.rgba,(y*320+x)*4,(Math.floor(y/2)*160+Math.floor(x/2))*4,(Math.floor(y/2)*160+Math.floor(x/2))*4+4);
pass('Full missing-asset LCD canvas is checked at every physical pixel',()=>assert.equal(verifyWoodPhysicalLcd(physical,native,2).full,320*192));
reject('A non-center fallback pixel mismatch cannot pass logical sampling',()=>{const p=clone(physical);p.rgba[0]^=1;verifyWoodPhysicalLcd(p,native,2);});
pass('First64 window checks four external strips including unknown extra2 columns',()=>{const n=verifyWoodPhysicalLcd(physical,native,2,{x:48,y:16,width:64,height:64});assert.ok(n.top&&n.bottom&&n.left&&n.right);});
reject('First64 cannot authorize its futurewide right2 columns',()=>{const p=clone(physical);p.rgba[((16*2)*320+(112*2))*4]^=1;verifyWoodPhysicalLcd(p,native,2,{x:48,y:16,width:64,height:64});});
pass('Certified66 excludes only its own actual expanded window',()=>{const p=clone(physical);p.rgba[((16*2)*320+(112*2))*4]^=1;verifyWoodPhysicalLcd(p,native,2,{x:48,y:16,width:66,height:64});});
for(const [name,x,y]of [['top',80,15],['bottom',80,80],['left',47,40],['right',114,40]])reject('Physical '+name+' LCD boundary mismatch',()=>{const p=clone(physical);p.rgba[((y*2)*320+x*2)*4]^=1;verifyWoodPhysicalLcd(p,native,2,{x:48,y:16,width:66,height:64});});

pass('True final Arms0 retreat is allowed with nonzero HP after native FgtChkAtkEnd',()=>{const f=fixture();f.attempt.after.units[1].arms=0;f.attempt.after.units[1].state=8;assert.equal(woodAttemptFacts(f.attempt,6).damage,1200);validateWoodCaptureBinding(f.captures[0],f.attempt,6);});
reject('State8 without native zero Arms OR zero HP is rejected',()=>{const f=fixture();f.attempt.after.units[1].state=8;woodAttemptFacts(f.attempt,6);});
reject('Final lethal retreat does not allow premature movie Arms0/state8',()=>{const f=fixture();f.attempt.after.units[1].arms=0;f.attempt.after.units[1].state=8;f.captures[0].units[10].arms=0;f.captures[0].units[10].state=8;bind(f.captures[0]);validateWoodCaptureBinding(f.captures[0],f.attempt,6);});

pass('Actual CSS pointer-events none permits the canvas owning stage hit',()=>{const c=visible();c.dom.points.forEach(p=>{p.top={id:'',className:'hd-spe-stage'};});verifyWoodVisibleHd(c);});
reject('Another child overlay in the same root is not the owning canvas/stage',()=>{const c=visible();c.dom.points[1].top={id:'hd-spe-skip',className:'button'};c.dom.points[1].canvasOrStageAtFront=false;verifyWoodVisibleHd(c);});


// Same-call readonly key tickets. Controlled VM calls never send a real game input.
import {v13AssertCityEntry} from './hd-impact-city-entry.mjs';
const woodKeyCopy=structuredClone,woodKeyPlain=v=>JSON.parse(JSON.stringify(v));
const woodKeyLegacyFields=['code','at','phase','generation','eventId','kind','speId','speActive','resultActive','resultSession','resultPhase','resultSpeId'];
const woodKeyAddedFields=['inputKind','actorIndex','focusX','focusY','fight','report'];
function woodKeyHarness(source=woodObserverSource,{owner='city',report,ready=true,originalMutation=false}={}){
 const fight=owner==='battle'?{active:1,over:0,wait:1,inputKind:5,actorIndex:0,focusX:29,focusY:27,inputSeq:81,futureFight:{retain:['native',7]}}:{active:0,inputKind:0,actorIndex:255,focusX:0,focusY:0,futureFight:{retain:['native',7]}};
 const state={fight,report:report??{active:0,seq:12,inputSeq:17,kind:1,person:65535,text:'旧报告',unknownReport:{retain:[4,5]}},spe:{active:0,generation:3,eventId:0,kind:0,id:0},result:{active:false,session:0,phase:null,speId:0},top:{active:false},world:{people:[{id:131,thew:100}],queue:[131,65,65],unknownWorld:{keep:true}}};
 let clock=100,reads=0;const calls=[],timing=[],original=function(...args){timing.push({keysAtOriginal:woodKeyPlain(ctx.__woodEngineKeys),fight:woodKeyCopy(state.fight),report:woodKeyCopy(state.report)});calls.push({thisValue:this,args});if(originalMutation){state.fight.inputKind=9;state.report.unknownReport={changedByOriginal:true};}return 'original-result';};
 class Canvas{}for(const name of ['clearRect','drawImage','fillRect','fillText','rect','clip'])Canvas.prototype[name]=function(){};
 const ctx=vm.createContext({CanvasRenderingContext2D:Canvas,performance:{now:()=>clock++},structuredClone,console:{log(){},warn(){}},
  baye:{getPersonCount:()=>200,data:{g_FgtParam:{GenArray:Array(20).fill(0)}},hd:{ready:()=>ready,spe:()=>state.spe,skillResult:()=>state.result,resultOwner:()=>state.top,fight:()=>state.fight,report:()=>{reads++;return state.report;}}},sendKey:original});
 ctx.window=ctx;new vm.Script(source,{filename:'wood37-controlled-observer.js'}).runInContext(ctx);
 assert.equal(calls.length,0,'Observer injection sends no native key');
 ctx.BayeHdSpe={onEngineSpe(){return 'engine-hook-result';},onLcdFlush(){return 'lcd-hook-result';},debugSnapshot(){return{open:false};}};
 ctx.__spePhase='battle';assert.equal(calls.length,0,'Observer registration sends no native key');
 return{ctx,state,calls,timing,keys:()=>woodKeyPlain(ctx.__woodEngineKeys),reportReads:()=>reads,send:(...args)=>ctx.sendKey(...args)};
}
function woodKeyCityFixture(){
 const source=fs.readFileSync('scripts/test-hd-impact-city-entry.mjs','utf8'),start=source.indexOf('const rom='),end=source.indexOf('\nconst run=',start);assert.ok(start>0&&end>start);
 const ctx=vm.createContext({structuredClone});new vm.Script(source.slice(start,end)+'\n;globalThis.result=fixture();',{filename:'formal-v13-controlled-ABI-fixture.js'}).runInContext(ctx);
 return woodKeyPlain(ctx.result);
}
function woodKeySendCityFixture(source){const f=woodKeyCityFixture(),h=woodKeyHarness(source,{report:woodKeyCopy(f.before.state.snapshot.report)});Object.assign(h.state.fight,woodKeyCopy(f.before.state.snapshot.fight));delete h.state.fight.futureFight;Object.assign(h.state.spe,woodKeyCopy(f.before.state.snapshot.spe));Object.assign(h.state.result,woodKeyCopy(f.before.state.snapshot.result));h.send(35);h.send(39);return{f,h,keys:h.keys()};}

test('[key-ticket] same city sendKey logs current fight/report with all old fields and invokes original exactly once',()=>{
 const h=woodKeyHarness(),before=woodKeyCopy(h.state);assert.equal(h.send(35),'original-result');assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].args,[35]);assert.equal(h.reportReads(),1);
 const k=h.keys()[0];for(const f of [...woodKeyLegacyFields,...woodKeyAddedFields])assert.ok(Object.hasOwn(k,f),f);assert.deepEqual([k.inputKind,k.actorIndex,k.focusX,k.focusY],[0,255,0,0]);assert.deepEqual(k.fight,before.fight);assert.deepEqual(k.report,before.report);assert.deepEqual(h.state,before);assert.equal(h.timing[0].keysAtOriginal.length,1);
});
test('[key-ticket] same battle sendKey records genuine current native owner rather than city defaults',()=>{const h=woodKeyHarness(undefined,{owner:'battle'}),before=woodKeyCopy(h.state);h.send(39);const k=h.keys()[0];assert.deepEqual([k.inputKind,k.actorIndex,k.focusX,k.focusY],[5,0,29,27]);assert.deepEqual(k.fight,before.fight);assert.deepEqual(k.report,before.report);assert.equal(h.calls.length,1);assert.deepEqual(h.state,before);});
test('[key-ticket] legacy field values retain the fixed original pre-key fixture values',()=>{const h=woodKeyHarness();h.send(35);assert.deepEqual(Object.fromEntries(woodKeyLegacyFields.map(k=>[k,h.keys()[0][k]])),{code:35,at:100,phase:'battle',generation:3,eventId:0,kind:0,speId:0,speActive:0,resultActive:false,resultSession:0,resultPhase:null,resultSpeId:0});});

test('[key-ticket] pre-key fight/report tickets precede real original-call mutation and never rewrite afterward',()=>{const h=woodKeyHarness(undefined,{originalMutation:true}),before=woodKeyCopy(h.state);h.send(39);assert.deepEqual(h.keys()[0].fight,before.fight);assert.deepEqual(h.keys()[0].report,before.report);assert.deepEqual(h.timing[0].fight,before.fight);assert.deepEqual(h.timing[0].report,before.report);assert.equal(h.state.fight.inputKind,9);assert.deepEqual(h.state.report.unknownReport,{changedByOriginal:true});assert.equal(h.calls.length,1);});
test('[key-ticket] later world/fight/report changes cannot alias already-recorded nested unknown fields',()=>{const h=woodKeyHarness();h.send(35);const old=h.keys();h.state.fight.futureFight.retain.push('later');h.state.report.unknownReport.retain[0]++;h.state.world.queue.push(99);assert.deepEqual(h.keys(),old);});
test('[key-ticket] original receiver and all arguments/return value are preserved by single sendKey wrapper',()=>{const h=woodKeyHarness(),receiver={sentinel:7};assert.equal(h.ctx.sendKey.call(receiver,35,'opaque'),'original-result');assert.equal(h.calls.length,1);assert.equal(h.calls[0].thisValue,receiver);assert.deepEqual(h.calls[0].args,[35,'opaque']);});
test('[key-ticket] injection and setter never deliver premature input or manufacture previous key rows',()=>{const h=woodKeyHarness();assert.deepEqual(h.calls,[]);assert.deepEqual(h.keys(),[]);h.send(35);h.send(39);assert.deepEqual(h.keys().map(k=>k.code),[35,39]);assert.equal(h.calls.length,2);});
test('[key-ticket] formal lifecycle snapshot keeps original owner metadata with report restricted to key rows',()=>{const h=woodKeyHarness(),before=woodKeyCopy(h.state);h.ctx.BayeHdSpe.onEngineSpe();const s=woodKeyPlain(h.ctx.__woodSamples[0]);for(const k of['spe','result','top','fight'])assert.deepEqual(s[k],before[k]);assert.equal(Object.hasOwn(s,'report'),false);assert.deepEqual(h.keys(),[]);assert.equal(h.reportReads(),0);});

test('[key-ticket] engine-not-ready keys retain formal null ownership and do not fabricate native report',()=>{const h=woodKeyHarness(undefined,{ready:false});h.send(39);const k=h.keys()[0];assert.equal(k.generation,null);assert.equal(k.inputKind,null);assert.equal(k.report,null);assert.equal(h.reportReads(),0);assert.equal(h.calls.length,1);});
test('[key-ticket] failure to read a real report blocks delivery instead of recording a synthetic report',()=>{const h=woodKeyHarness();h.ctx.baye.hd.report=()=>{throw Error('unavailable report');};assert.throws(()=>h.send(39),/unavailable report/);assert.equal(h.calls.length,0);assert.deepEqual(h.keys(),[]);});
test('[key-ticket] source-derived original v13 city-entry ABI accepts freshly generated V37 sendKey rows',()=>{
 const {f,h,keys}=woodKeySendCityFixture(woodObserverSource),before=woodKeyCopy({before:f.before,after:f.after,native:f.native});assert.deepEqual(keys.map(k=>k.code),[35,39]);assert.equal(h.calls.length,2);
 const r=v13AssertCityEntry(f.before,f.after,f.pos,keys,f.native);assert.equal(r.accepted,true);assert.deepEqual({before:f.before,after:f.after,native:f.native},before);
});
test('[key-ticket] original city-entry ABI rejects controlled fresh key rows with missing owner fields',()=>{const {f,keys}=woodKeySendCityFixture(woodObserverSource);for(const row of keys)for(const key of woodKeyAddedFields)delete row[key];assert.throws(()=>v13AssertCityEntry(f.before,f.after,f.pos,keys,f.native),/No battle input owner/);});

test('[key-ticket] source-derived city-entry ABI rejects controlled generation/fight/report metadata pollution',()=>{
 for(const mutate of[k=>k.generation++,k=>k.inputKind++,k=>k.actorIndex=0,k=>k.focusX++,k=>k.focusY++,k=>k.report.inputSeq++]){const {f,keys}=woodKeySendCityFixture(woodObserverSource);mutate(keys[0]);assert.throws(()=>v13AssertCityEntry(f.before,f.after,f.pos,keys,f.native));}
});
test('[key-ticket] whole unknown report fields are preserved and checked by original city-entry ABI',()=>{const {f,keys}=woodKeySendCityFixture(woodObserverSource);for(const t of[f.before,f.after])t.state.snapshot.report.unknownReport={keep:[1,2]};const h=woodKeyHarness(undefined,{report:woodKeyCopy(f.before.state.snapshot.report)});Object.assign(h.state.fight,f.before.state.snapshot.fight);delete h.state.fight.futureFight;h.send(35);h.send(39);assert.equal(v13AssertCityEntry(f.before,f.after,f.pos,h.keys(),f.native).accepted,true);const bad=h.keys();bad[1].report.unknownReport.keep.pop();assert.throws(()=>v13AssertCityEntry(f.before,f.after,f.pos,bad,f.native),/No report owner/);});

// Invoke the actual private draw checker and artwork-selection statement without
// exporting new product APIs. These are ROM-derived controlled draw logs, not
// evidence of a real cast. The complete runtime PNG oracle is separately audited.
const woodDrawOracleText=fs.readFileSync(new URL('./hd-wood-runtime-oracle.mjs',import.meta.url),'utf8');
const woodDrawBitsLine=woodDrawOracleText.split(/\r?\n/).find(l=>l.startsWith('const bits ='));
const woodDrawStart=woodDrawOracleText.indexOf('function verifyDraws('),woodDrawEnd=woodDrawOracleText.indexOf('\n/** Pure independent',woodDrawStart);
assert.ok(woodDrawBitsLine&&woodDrawStart>0&&woodDrawEnd>woodDrawStart);
const woodDrawFunctionText=woodDrawOracleText.slice(woodDrawStart,woodDrawEnd);
const woodDrawFunctions=source=>Function('assert','W','H',woodDrawBitsLine+'\n'+source+'\nreturn {bits,verifyDraws};')(assert,160,96);
const woodDrawVerifier=woodDrawFunctions(woodDrawFunctionText);
const woodDrawManifest=JSON.parse(fs.readFileSync(path.join(root,'assets/hd-spe/manifest.json')));
function woodDrawFixture(skill=6,commit=0,{post=false}={}){
    const expected=typeof commit==='object'?commit:timelines.get(skill)[commit],entry=woodDrawManifest.entries.find(e=>e.speId===37&&e.resourceIndex===0&&e.kind===2&&e.skillId===skill&&e.startFrm===0&&e.endFrm===(skill===6?7:0));
    assert.ok(expected&&entry);const scale=3,drawLog=[],push=(type,args,extra={})=>drawLog.push({type,args,...extra});
    const frames=bytes=>Array.from({length:256},(_,i)=>i).filter(i=>bytes[i>>3]&(1<<(i&7)));
    push('clearRect',[0,0,160*scale,96*scale]);push('rect',[48*scale,16*scale,expected.width*scale,64*scale]);push('clearRect',[48*scale,16*scale,expected.width*scale,64*scale]);
    for(const frame of frames(expected.clears))push('clearRect',[48*scale,16*scale,(frame%2?66:64)*scale,64*scale]);
    const rom=rawItem(library,37);for(const frame of frames(expected.visible)){const picture=entry.pictures[rom[10+5*frame]];push('drawImage',[48*scale,16*scale,picture.logicalWidth*scale,64*scale],{src:picture.src,naturalWidth:picture.width,naturalHeight:picture.height});}
    const label=post?{bytes:Buffer.from('b1f8c1a6bcf5c9d9','hex')}:null,result={display:{label:{text:'兵力减少'},digits:post?[1,2,3].map((digit,i)=>({digit,x:55+6*i,firstY:56,y:49,drawCount:8})):[]}};
    if(post){const box=[55*scale,18*scale,label.bytes.length*6*scale,12*scale];push('rect',box);push('fillRect',box);push('fillText',box.slice(0,3),{text:result.display.label.text});
        for(const digit of result.display.digits)for(let draw=0;draw<digit.drawCount;draw++){const b=[digit.x*scale,(digit.firstY-draw)*scale,12*scale,16*scale];push('rect',b);push('fillRect',b);push('fillText',[b[0],b[1],6*scale],{text:String(digit.digit),font:'bold '+16*scale+'px Georgia, serif'});}}
    return{capture:{ui:{scale},drawLog,result},expected,entry,label,post};
}
const woodDrawCheck=f=>woodDrawVerifier.verifyDraws(f.capture,f.expected,f.entry,f.label,f.post);
test('[HD draws] every ROM timeline carries complete internal Buffer bitsets',()=>{for(const list of timelines.values())for(const t of list)for(const key of['clears','visible']){assert.equal(Buffer.isBuffer(t[key]),true);assert.equal(t[key].length,32);assert.ok(Array.from(t[key]).every(n=>Number.isInteger(n)&&n>=0&&n<=255));assert.doesNotThrow(()=>woodDrawVerifier.bits(Array.from(t[key])));}});
for(const skill of[6,7])for(const [index,t] of timelines.get(skill).entries())test('[HD draws] WOOD'+skill+' complete native commit'+(index+1)+' frame'+t.frame+' width'+t.width+' enters the actual clear/art/clip checker',()=>{const f=woodDrawFixture(skill,t),before=JSON.stringify(f);assert.equal(f.expected,t);woodDrawCheck(f);assert.equal(JSON.stringify(f),before);});
for(const skill of[6,7])test('[HD draws] WOOD'+skill+' complete label/NUM/eight-step HOLD footprint passes',()=>{const f=woodDrawFixture(skill,skill===6?7:0,{post:true});woodDrawCheck(f);assert.equal(f.capture.result.display.digits.length,3);});
for(const[name,change]of[
    ['missing cumulative native clear',f=>f.capture.drawLog.splice(f.capture.drawLog.findIndex(o=>o.type==='clearRect'&&o.args[2]===64*3&&o.args[0]===48*3),1)],
    ['future or wider clip',f=>f.capture.drawLog.find(o=>o.type==='rect').args[2]++],
    ['extra unrelated artwork',f=>f.capture.drawLog.push({type:'drawImage',args:[0,0,3,3],src:'unowned.png'})],
    ['incorrect asset natural size',f=>f.capture.drawLog.find(o=>o.type==='drawImage'&&o.src).naturalWidth++],
    ['incorrect NUM font',f=>f.capture.drawLog.find(o=>o.type==='fillText'&&o.font).font='16px sans-serif'],
])test('[HD draws] rejects '+name,()=>{const f=woodDrawFixture(6,7,{post:true});change(f);assert.throws(()=>woodDrawCheck(f));});
const woodArtworkStatement=woodDrawOracleText.split(/\r?\n/).find(l=>l.includes('const live = bits('));assert.ok(woodArtworkStatement);
const woodArtworkSource=Function('assert','expected','art','m',woodDrawBitsLine+'\n'+woodArtworkStatement+'\nreturn source;');
for(const skill of[6,7])test('[HD draws] WOOD'+skill+' internal Buffer reaches the actual artwork-sampling selection statement',()=>{const rom=rawItem(library,37),m={units:Array.from({length:8},(_,i)=>({picIndex:rom[10+5*i]}))},art=[{id:'first64'},{id:'wide66'}];for(const t of timelines.get(skill))assert.equal(woodArtworkSource(assert,t,art,m),art[rom[10+5*t.frame]]);});
test('[HD draws] unconverted internal Buffer reproduces the original strict checker rejection',()=>{const old=woodDrawFunctionText.replaceAll('bits(Array.from(expected.clears))','bits(expected.clears)').replaceAll('bits(Array.from(expected.visible))','bits(expected.visible)'),f=woodDrawFixture();assert.throws(()=>woodDrawFunctions(old).verifyDraws(f.capture,f.expected,f.entry,f.label,f.post),/Complete byte bitset/);});
for(const value of[Buffer.alloc(32),new Uint8Array(32)])test('[HD draws] external '+value.constructor.name+' is still rejected by the unchanged strict byte-array contract',()=>assert.throws(()=>woodDrawVerifier.bits(value),/Complete byte bitset/));
test('[HD draws] internal truncated timeline still fails after the explicit conversion',()=>{const f=woodDrawFixture();f.expected={...f.expected,clears:Buffer.alloc(31)};assert.throws(()=>woodDrawCheck(f),/Complete byte bitset/);});
