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
        before:{units:[actorUnit,targetUnit]},after:{units:[{...actorUnit,mp:100-(skill===6?20:25)},{...targetUnit,arms:1100}]}};
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
