#!/usr/bin/env node
/**
 * Real ordinary attack composition and numeric LCD acceptance.
 *   node scripts/test-hd-attack-runtime.mjs --staged --artifact-dir build/r09-attack-staged
 *   --range 21:9:17 accepts only this delivered interval; other ranges are untested.
 *   --allow-lcd verifies the rebuilt native observer without accepting HD art.
 *   --scenario 404|late|classic|hidden|resize runs one fresh legitimate game.
 *   --recruit uses actual enlist/distribute menus before marching; requires --range.
 *   --recruit-arms N requests min(N,actual native max) separately at both menus.
 * --staged serves build/wasm/src/baye.{js,wasm,wasm.map} without replacing js/.
 * Uses a temporary browser profile; it never edits portraits, saves or game assets.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staged = process.argv.includes('--staged');
const allowLcd = process.argv.includes('--allow-lcd');
const recruit = process.argv.includes('--recruit');
const recruitArmsFlag=process.argv.indexOf('--recruit-arms');
const recruitArmsText=recruitArmsFlag<0?'800':process.argv[recruitArmsFlag+1];
assert.ok(/^\d+$/.test(recruitArmsText||''),'--recruit-arms must be a positive native U16 quantity');
const recruitArms=Number(recruitArmsText);
assert.ok(Number.isInteger(recruitArms)&&recruitArms>0&&recruitArms<=65535&&(recruitArmsFlag<0||recruit),'Custom recruitment requires --recruit and valid U16 bounds');
const scenarioFlag=process.argv.indexOf('--scenario');
const scenario=scenarioFlag<0?'nominal':process.argv[scenarioFlag+1];
assert.ok(['nominal','404','late','classic','hidden','resize'].includes(scenario),'Known single acceptance scenario');
const failedImages=scenario==='404'||scenario==='late';
const rangeFlag = process.argv.indexOf('--range');
const rangeText = rangeFlag < 0 ? null : process.argv[rangeFlag + 1];
assert.ok(rangeText === null || /^(19|20|21|22|23|24|25):\d+:\d+$/.test(rangeText), '--range must be native SPE:start:end');
const acceptedRange = rangeText === null ? null : rangeText.split(':').map(Number);
assert.ok(!recruit || acceptedRange && [19,20].includes(acceptedRange[0]), '--recruit requires a real cavalry/infantry --range');
const acceptsRange = (a) => !acceptedRange || a.speId === acceptedRange[0] && a.startFrm === acceptedRange[1] && a.endFrm === acceptedRange[2];
const viewport = process.argv.includes('--720') ? {width:1280,height:720} : {width:1920,height:1080};
const artifactFlag = process.argv.indexOf('--artifact-dir');
const artifactDir = path.resolve(artifactFlag >= 0 ? process.argv[artifactFlag + 1] : path.join(root, 'build/r09-attack-runtime'));
const targetName=()=>path.relative(root,fileURLToPath(import.meta.url));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.lib': 'application/octet-stream' };
const report = { scope:'Actual standard P1 Ma Teng legitimate march and ordinary attack; strict native composition/damage display acceptance. Gameplay families are listed only when actually observed.', staged, allowLcd,recruit,recruitArms,scenario,acceptedRange,viewport,startedAt: new Date().toISOString(), phases: [], console: [], exceptions: [], dialogs: [], blocked: [], requests: [], inputs: [] };
const servedAssets = new Map();
let nativeLib;
let attackManifest;
const nativeMovies = new Map();
let controlledImage=null;
const pendingImages=[];
let imageReleased=false;
function releaseImages(){imageReleased=true;for(const finish of pendingImages.splice(0))finish();}
function fnv(bytes) { let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619)>>>0;return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+bytes.length; }
function nativeItem(id,index=0) {
    const b=nativeLib,a=b.readUInt32LE((id-1)*4);
    assert.ok(a>0&&a+14<=b.length,'real native resource header bounds');
    const length=b.readUInt32LE(a),count=b.readUInt16LE(a+6),fixed=b.readUInt32LE(a+8);
    assert.equal(b.readUInt16LE(a+4),id);assert.ok(index<count&&a+length<=b.length);assert.equal(b[a+12],0);
    const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(a+14+index*8);
    const size=fixed|| (count===1?length-14:b.readUInt32LE(a+18+index*8));
    assert.ok(offset>=14&&size>0&&offset+size<=length);
    return b.subarray(a+offset,a+offset+size);
}
function nativePicture(bytes,offset=0,multiple=false) {
    assert.ok(offset+7<=bytes.length);const width=bytes.readUInt16LE(offset),height=bytes.readUInt16LE(offset+2),count=bytes.readUInt16LE(offset+4),mask=bytes[offset+6],planeBytes=Math.ceil(width/8)*height;
    assert.ok(width&&height&&count&&mask<=1);
    const length=7+planeBytes*(mask+1)*(multiple?count:1);assert.ok(offset+length<=bytes.length);
    return {width,height,count,mask,planeBytes,rowBytes:Math.ceil(width/8),length,data:bytes.subarray(offset+7,offset+length)};
}
function nativeMovie(id,index=0) {
    const key=id+':'+index;if(nativeMovies.has(key))return nativeMovies.get(key);
    const bytes=nativeItem(id,index),count=bytes[2],picmax=bytes[3],units=[];assert.ok(count&&picmax);
    for(let i=0;i<count;i++){const o=6+i*5;assert.ok(o+5<=bytes.length);units.push({x:bytes[o],y:bytes[o+1],cdelay:bytes[o+2],ndelay:bytes[o+3],picIndex:bytes[o+4]});}
    let offset=6+count*5;const pictures=[];for(let i=0;i<picmax;i++){const picture=nativePicture(bytes,offset);pictures.push(picture);offset+=picture.length;}
    assert.ok(units.every(u=>u.picIndex<picmax));const movie={id,index,count,picmax,start:bytes[4],end:bytes[5],units,pictures,fingerprint:fnv(bytes),length:bytes.length};nativeMovies.set(key,movie);return movie;
}
function nativePaint(pixels,width,height,picture,x,y,slot=0) {
    const data=picture.data.subarray(slot*picture.planeBytes*(picture.mask+1));
    for(let row=0;row<picture.height;row++)for(let col=0;col<picture.width;col++) {
        const dx=x+col,dy=y+row;if(dx<0||dy<0||dx>=width||dy>=height)continue;
        const offset=row*picture.rowBytes+(col>>3),bit=128>>(col&7),first=!!(data[offset]&bit),ind=dy*width+dx;
        pixels[ind]=picture.mask?(first?pixels[ind]:0)|(data[picture.planeBytes+offset]&bit?255:0):(first?255:0);
    }
}
function oracleMovie(movie,start,end) {
    const width=130,height=64,pixels=Buffer.alloc(width*height),background=nativePicture(nativeItem(16),0,true);
    nativePaint(pixels,width,height,background,0,0);
    const spec=movie.units.slice(start,end+1).map(u=>u.cdelay),spem=movie.units.slice(start,end+1).map(u=>u.ndelay),clears=Buffer.alloc(32),records=[];
    let mcount=0,ymount=0,cls=true,show=true;
    for(let loop=0;loop<100000;loop++) {
        for(let i=0;i<=mcount;i++) {
            if(spec[i]===1) {const unit=movie.units[start+i],picture=movie.pictures[unit.picIndex];for(let row=unit.y;row<unit.y+picture.height;row++)for(let col=unit.x;col<unit.x+picture.width;col++)if(row>=0&&col>=0&&row<height&&col<width)pixels[row*width+col]=0;clears[(start+i)>>3]|=1<<((start+i)&7);cls=true;}
            if(spec[i]!==0)spec[i]=(spec[i]-1)&255;
        }
        const draw=i=>{const u=movie.units[start+i];nativePaint(pixels,width,height,movie.pictures[u.picIndex],u.x,u.y);};
        if(cls)for(let i=0;i<=ymount;i++)if(spec[i])draw(i);
        if(show){for(let i=ymount+1;i<=mcount;i++)if(spec[i])draw(i);ymount=mcount;}
        if(show||cls){const visible=Buffer.alloc(32);for(let i=0;i<=mcount;i++)if(spec[i])visible[(start+i)>>3]|=1<<((start+i)&7);records.push({frame:start+mcount,visible,clears:Buffer.from(clears),pixels:Buffer.from(pixels)});show=cls=false;}
        if(spem[mcount]>=1)spem[mcount]--;
        while(spem[mcount]<=1&&mcount+start<end){mcount++;show=true;}
        if(mcount+start>=end&&spec.slice(0,mcount+1).every(n=>n<=1))return records;
    }throw Error('native movie oracle exceeded original counter bound');
}
function assertNativePixels(capture,pixels,background,outsideReference) {
    const rgba=Buffer.from(capture.nativeRgba,'base64'),actual=Buffer.alloc(pixels.length*4),expected=Buffer.alloc(pixels.length*4);
    assert.equal(rgba.length,capture.nativeWidth*capture.nativeHeight*4);
    assert.equal(capture.drawing.flip,0);assert.equal(capture.drawing.paint,255);
    assert.equal(capture.drawing.palette0,0x00ffffff);assert.equal(capture.drawing.palette255,0xff000000);
    for(let i=0;i<pixels.length;i++){
        const x=background.x+i%130,y=background.y+Math.floor(i/130);assert.ok(x>=0&&y>=0&&x<capture.nativeWidth&&y<capture.nativeHeight);
        rgba.copy(actual,i*4,(y*capture.nativeWidth+x)*4,(y*capture.nativeWidth+x)*4+4);
        expected.writeUInt32LE(pixels[i]?capture.drawing.palette255:capture.rawSource==='canvas-readback-normalized'?0:capture.drawing.palette0,i*4);
    }
    assert.deepEqual(actual,expected,'Actual LCD RGBA matches independently decoded native background/clear/live/digit history');
    const full=Buffer.from(outsideReference);
    assert.equal(full.length,rgba.length);
    if(capture.rawSource==='canvas-readback-normalized')for(let i=0;i<full.length;i+=4)if(full[i+3]===0)full.fill(0,i,i+4);
    for(let row=0;row<64;row++)expected.copy(full,((background.y+row)*capture.nativeWidth+background.x)*4,row*130*4,(row+1)*130*4);
    assert.deepEqual(rgba,full,'Pixels outside the independently reconstructed arena remain equal to this event\'s first actual copied LCD');
    return {independentArenaPixels:pixels.length,unchangedOutsideArenaPixels:capture.nativeWidth*capture.nativeHeight-pixels.length,actualSha256:crypto.createHash('sha256').update(actual).digest('hex'),expectedSha256:crypto.createHash('sha256').update(expected).digest('hex'),fullLcdSha256:crypto.createHash('sha256').update(rgba).digest('hex')};
}
function verifyAttackCaptures(captures) {
    const owned=captures.filter(c=>c.attack&&c.attack.active&&c.attack.scene&&c.attack.scene.commitSeq>0);
    assert.ok(owned.length,'Real independent native attack owner has displayed scenes');
    const events=new Map(),verified=[];let digits=0,holds=0,hdCallbacks=0,lcdCallbacks=0,actualFlushes=0;
    for(const c of owned) {
        assert.deepEqual(c.after,c.before,'Native/HD capture uses the same real display stamp');
        if(c.callbackBefore)assert.deepEqual(c.callbackAfter,c.callbackBefore,'Actual renderer callback preserves native SPE/attack snapshots');
        const a=c.attack,d=a.display,movie=nativeMovie(a.speId,a.resourceIndex),key=a.generation+':'+a.session;
        assert.ok(c.top.active&&c.top.valid,'The actual ordinary result is the current native top owner');
        assert.equal(c.top.kind,1);assert.equal(c.top.generation,a.generation);assert.equal(c.top.session,a.session);
        assert.equal(a.sourceValid,true,'Supported default native attack source stays valid at every actual LCD callback');
        assert.equal(d.valid,true);assert.equal(d.frameValid,true);assert.equal(d.generation,a.generation);assert.equal(d.session,a.session);
        assert.equal(d.composition.protocolVersion,1);assert.equal(d.composition.valid,true);assert.equal(a.x,15);assert.equal(a.y,16);
        assert.equal(a.resourceFingerprint,movie.fingerprint);assert.equal(a.resourceLength,movie.length);assert.equal(a.custom,false);assert.equal(a.skipEligible,false);assert.equal(a.returnEligible,false);
        if(!events.has(key)){assert.equal(c.rawSource,'lcd-callback-image-data','Every event starts with a real copied display callback');events.set(key,{commits:oracleMovie(movie,a.startFrm,a.endFrm),outside:Buffer.from(c.nativeRgba,'base64')});}
        const expected=events.get(key).commits[d.commitSeq-1];assert.ok(expected);assert.equal(d.frameIndex,expected.frame);
        assert.deepEqual(Buffer.from(d.visibleFrames),expected.visible);assert.deepEqual(Buffer.from(d.composition.clearFrames),expected.clears);
        const bg=d.composition.background;assert.equal(bg.resourceFingerprint,fnv(nativeItem(16)));assert.equal(bg.id,16);assert.equal(bg.pictureIndex,0);assert.equal(bg.x,15);assert.equal(bg.y,16);
        const pixels=Buffer.from(expected.pixels),number=nativePicture(nativeItem(15),0,true),decimal=String(a.hurt);
        for(let slot=0;slot<d.digits.length;slot++){const p=d.digits[slot];assert.equal(p.digit,Number(decimal[slot]));assert.equal(p.y,p.firstY-p.drawCount+1);assert.ok(p.drawCount>0&&p.drawCount<=number.height/2);for(let draw=0;draw<p.drawCount;draw++)nativePaint(pixels,130,64,number,p.x-bg.x,p.firstY-draw-bg.y,p.digit);}
        const evidence=assertNativePixels(c,pixels,bg,events.get(key).outside);
        if(c.rawSource==='lcd-callback-image-data')actualFlushes++;
        if(d.digits.length){digits++;assert.equal(a.number.resourceFingerprint,fnv(nativeItem(15)));}
        if(a.phase==='hold'&&d.digits.length===decimal.length&&d.digits.every(p=>p.drawCount===8))holds++;
        if(c.hidden){assert.equal(c.ui.open,false,'Hidden native owner has no visible overlay');}
        else if(c.mode==='classic'){assert.equal(c.ui.open,false);assert.ok(c.dom.nativePresentation.visible&&c.dom.nativePresentation.inViewport&&c.dom.nativePresentation.stackOwned,'Actual classic LCD is visible above HD board');}
        else {assert.ok(c.ui.open,'Attack remains visible through the real number/hold owner');assert.ok(c.hdFile,'Actual presentation canvas PNG captured');assert.ok(c.dom.presentation.visible&&c.dom.presentation.inViewport&&c.dom.presentation.stackOwned,'Actual LCD/HD canvas is visible above the battle board');}
        if(d.digits.length){assert.equal(c.spe.active,0,'Number stage has an independent attack owner and inactive public SPE');if(!c.hidden&&c.mode!=='classic')assert.equal(c.ui.presentation,'attack-postlude');}
        if(c.hidden||c.mode==='classic'){}
        else if(!allowLcd&&!failedImages&&acceptsRange(a)){assert.equal(c.ui.source,'hd-assets','Every selected actual attack LCD callback has ready HD assets');verifyHdDraws(c,expected);hdCallbacks++;}
        else if(c.ui.source==='lcd'){assert.ok(c.lcdCanvasRgba,'Actual native LCD fallback canvas pixels were sampled');const shown=Buffer.from(c.lcdCanvasRgba,'base64'),normalized=Buffer.alloc(pixels.length*4);for(let i=0;i<pixels.length;i++)if(pixels[i])normalized.writeUInt32LE(0xff000000,i*4);assert.deepEqual(shown,normalized,'Displayed fallback canvas reproduces the actual native black/transparent-white LCD crop');lcdCallbacks++;}
        verified.push({stage:c.stage,rawSource:c.rawSource,generation:a.generation,session:a.session,speId:a.speId,start:a.startFrm,end:a.endFrm,phase:a.phase,paintSeq:d.paintSeq,commit:d.commitSeq,frame:d.frameIndex,visible:Array.from(expected.visible),cleared:Array.from(expected.clears),digits:d.digits,nativeFile:c.nativeFile,hdFile:c.hdFile,...evidence});
    }
    assert.ok(digits>0,'Actual numeric LCD callbacks were verified');assert.ok(holds>0,'Actual native final delay contains the completed number display');
    if(!allowLcd&&!failedImages)assert.ok(hdCallbacks>0,'The delivered interval really occurred and rendered HD in this game');
    if(failedImages){const selected=owned.filter(c=>acceptsRange(c.attack));assert.ok(selected.length);assert.ok(selected.every(c=>c.ui.source==='lcd'),'Real failed/late mandatory PNG retains LCD for the entire actual attack and independent number/hold owner');assert.ok(lcdCallbacks>0);}
    assert.ok(actualFlushes>0,'Native pixel acceptance includes real timer LCD callback ImageData');
    report.nativePixelOracle={actualLcdCallbacks:actualFlushes,pixelReadbacks:verified.length,events:events.size,numericReadbacks:digits,completedHoldReadbacks:holds,hdReadbacks:hdCallbacks,lcdReadbacks:lcdCallbacks,verified};
    report.gameplayFamilies=[...new Set(owned.map(c=>c.attack.speId))];report.hdAccepted=!allowLcd&&!failedImages;
    report.gameplayIntervals=[...new Set(owned.map(c=>[c.attack.speId,c.attack.startFrm,c.attack.endFrm].join(':')))];
    if(report.attackCost){const action=report.attackCost,seen=owned.find(c=>c.attack.actorIndex===action.actorIndex&&c.attack.targetIndex===action.targetIndex);assert.ok(seen,'Player-confirmed actual attacker/target match the independent native owner');const before=action.before.units.find(u=>u.i===action.targetIndex)?.arms,after=action.after.units.find(u=>u.i===action.targetIndex)?.arms||0;assert.equal(seen.attack.hurt,before-after,'Captured CountPlusSub damage agrees with actual native troop accounting');report.actualHurt={source:'native attack.hurt; troop delta is verification only',actor:seen.attack.actorIndex,target:seen.attack.targetIndex,hurt:seen.attack.hurt,session:seen.attack.session};}
    report.coverageLimits={materialStaticRanges:report.materialCoverage?.length||0,actualGameIntervals:report.gameplayIntervals,scenario,notRun:'Other families or target segments, equipment/search routes, unknown LIB or custom-hook game, and other optional scenarios. No claim of 37 real browser attacks.'};
}
function bitFrames(bytes){const result=[];for(let i=0;i<256;i++)if(bytes[i>>3]&(1<<(i&7)))result.push(i);return result;}
function freezeAsset(rel) {
    assert.equal(typeof rel,'string');assert.ok(!path.isAbsolute(rel) && !rel.split('/').includes('..'),'Frozen asset path stays in this repository');
    if(servedAssets.has(rel))return servedAssets.get(rel);
    const data=fs.readFileSync(path.join(root,rel)),metadata={source:rel,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
    report.sources[rel]=metadata;servedAssets.set(rel,{data,metadata});return servedAssets.get(rel);
}
function verifyManifestEntry(e) {
    const movie=nativeMovie(e.speId,e.resourceIndex);
    assert.equal(e.compositionVersion,1);assert.equal(e.resourceFingerprint,movie.fingerprint);assert.equal(e.resourceLength,movie.length);
    assert.equal(e.count,movie.count);assert.equal(e.picmax,movie.picmax);assert.equal(e.units.length,movie.count);assert.equal(e.pictures.length,movie.picmax);
    assert.ok(Number.isInteger(e.startFrm)&&Number.isInteger(e.endFrm)&&e.startFrm>=movie.start&&e.startFrm<=e.endFrm&&e.endFrm<=movie.end);
    e.units.forEach((u,i)=>{const raw=movie.units[i];assert.deepEqual({frame:u.frame,x:u.x,y:u.y,picIndex:u.picIndex},{frame:i,x:raw.x,y:raw.y,picIndex:raw.picIndex});});
    const needed=new Set(movie.units.slice(e.startFrm,e.endFrm+1).map(u=>u.picIndex));
    e.pictures.forEach((p,i)=>{const raw=movie.pictures[i];assert.equal(p.picIndex,i);assert.equal(p.nativeWidth,raw.width);assert.equal(p.nativeHeight,raw.height);assert.equal(p.mask,raw.mask);assert.equal(p.logicalWidth,raw.width);assert.equal(p.logicalHeight,raw.height);if(needed.has(i))assert.equal(typeof p.src,'string','Every used native slot has an actual HD PNG');});
    for(const [source,id]of [[e.background,16],[e.number,15]]){const bytes=nativeItem(id),pic=nativePicture(bytes,0,true);assert.equal(source.id,id);assert.equal(source.resourceIndex,0);assert.equal(source.pictureIndex,0);assert.equal(source.resourceFingerprint,fnv(bytes));assert.equal(source.resourceLength,bytes.length);assert.equal(source.nativeWidth,pic.width);assert.equal(source.nativeHeight,pic.height);assert.equal(source.count,pic.count);assert.equal(source.mask,pic.mask);}
    for(const p of [...e.pictures.filter(p=>needed.has(p.picIndex)),e.background]){const {data}=freezeAsset(p.src);assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(data.readUInt32BE(16),p.width);assert.equal(data.readUInt32BE(20),p.height);assert.ok(p.width>100&&p.height>100);}
    return {speId:e.speId,start:e.startFrm,end:e.endFrm,resourceFingerprint:e.resourceFingerprint,nativeCount:movie.count,nativePicmax:movie.picmax,requiredSlots:[...needed].sort((a,b)=>a-b)};
}
function nativeAttackIntervalLengths() {
    const source=servedAssets.get('vendor/iBaye/src/FightSub.c').data.toString('utf8');
    const match=source.match(/const\s+U8\s+FgtSpeFrm\[\]\s*=\s*\{([^}]+)\}/);assert.ok(match,'Native caller interval lengths remain directly available');
    const lengths=match[1].split(',').map(v=>Number(v.trim()));assert.equal(lengths.length,6);assert.ok(lengths.every(n=>Number.isInteger(n)&&n>0));
    return lengths;
}
function expectedNativeRanges() {
    const lengths=nativeAttackIntervalLengths();
    const keys=[];for(let type=0;type<lengths.length;type++)for(let target=0;target<6;target++)keys.push([19+type,lengths[type]*target,lengths[type]*(target+1)-1].join(':'));keys.push('25:0:4');return keys;
}
function requestedActor(unit) {
    return !acceptedRange || acceptedRange[0]===25 || unit.armType===acceptedRange[0]-19;
}
function requestedTarget(unit) {
    if(!acceptedRange)return true;
    if(acceptedRange[0]===25)return unit.terrain===7;
    const span=nativeAttackIntervalLengths()[acceptedRange[0]-19];
    return unit.terrain!==7 && Number.isInteger(unit.armType) && unit.armType>=0 && unit.armType<6 &&
        unit.armType*span===acceptedRange[1] && (unit.armType+1)*span-1===acceptedRange[2];
}
function verifyHdDraws(c,expected) {
    const a=c.attack,entry=attackManifest.entries.find(e=>e.speId===a.speId&&e.resourceIndex===a.resourceIndex&&e.startFrm===a.startFrm&&e.endFrm===a.endFrm&&e.resourceFingerprint===a.resourceFingerprint);
    assert.ok(entry,'Actual attack matches a complete authenticated manifest interval');assert.equal(entry.compositionVersion,1);
    const scale=c.ui.scale,near=(actual,wanted)=>{assert.ok(Number.isFinite(actual)&&Math.abs(actual-wanted)<0.001,'Actual draw geometry '+actual+' matches '+wanted);};
    const log=c.drawLog.filter(op=>['drawImage','fillRect','fillText'].includes(op.type));let i=0;
    assert.equal(log[i]?.type,'fillRect');i++;
    const image=(src,x,y,width,height)=>{const op=log[i++];assert.equal(op?.type,'drawImage');assert.equal(op.src,src);assert.ok(op.naturalWidth>100&&op.naturalHeight>100);[x,y,width,height].forEach((n,k)=>near(op.args[k],n*scale));};
    image(entry.background.src,0,0,130,64);
    for(const frame of bitFrames(expected.clears)){const u=entry.units[frame],p=entry.pictures.find(p=>p.picIndex===u.picIndex),op=log[i++];assert.equal(op?.type,'fillRect');[u.x,u.y,p.logicalWidth,p.logicalHeight].forEach((n,k)=>near(op.args[k],n*scale));}
    for(const frame of bitFrames(expected.visible)){const u=entry.units[frame],p=entry.pictures.find(p=>p.picIndex===u.picIndex);image(p.src,u.x,u.y,p.logicalWidth,p.logicalHeight);}
    for(const p of a.display.digits)for(let draw=0;draw<p.drawCount;draw++){
        const rect=log[i++],text=log[i++];assert.equal(rect?.type,'fillRect');assert.equal(text?.type,'fillText');assert.equal(text.text,String(p.digit));
        const values=[p.x-15,p.firstY-draw-16,12,16];values.forEach((n,k)=>near(rect.args[k],n*scale));[values[0],values[1],6].forEach((n,k)=>near(text.args[k],n*scale));
    }assert.equal(i,log.length,'Only authorized background/clear/live/actual numeric draw operations are present');
}

function prepareServedAssets() {
    report.sources = {};
    function freezeDirectory(dir) {
        for (const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
            const rel=dir+'/'+item.name;
            if(rel==='assets/hd-spe')continue;
            if(item.isDirectory())freezeDirectory(rel);
            else freezeAsset(rel);
        }
    }
    for(const dir of ['js','css','assets','vendor/iBaye/src'])freezeDirectory(dir);
    freezeAsset('scripts/write-wasm-manifest.mjs');
    for(const rel of ['libs/dat-mod.lib']){const data=fs.readFileSync(path.join(root,rel)),metadata={source:rel,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};report.sources[rel]=metadata;servedAssets.set(rel,{data,metadata});}
    nativeLib=servedAssets.get('libs/dat-mod.lib').data;
    assert.equal(report.sources['libs/dat-mod.lib'].sha256,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
    report.tool={source:targetName(),sha256:crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')};

    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map', 'baye.build.json',
        ...fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js')&&n!=='baye.js')]) {
        const base = staged && name.startsWith('baye.') ? path.join(root, 'build/wasm/src') : path.join(root, 'js');
        const filename = path.join(base, name), data = fs.readFileSync(filename);
        const metadata = { source: path.relative(root, filename), bytes: data.length,
            sha256: crypto.createHash('sha256').update(data).digest('hex') };
        report.sources[name] = metadata;
        servedAssets.set('js/' + name, { data, metadata });
    }
    const speManifest = JSON.parse(freezeAsset('assets/hd-spe/manifest.json').data.toString('utf8'));
    attackManifest=speManifest;
    assert.equal(speManifest.libSha256,report.sources['libs/dat-mod.lib'].sha256);assert.equal(speManifest.axScale,1);
    const entries=speManifest.entries.filter(e=>e.kind===3||e.kind==='attack').filter(acceptsRange);
    const expectedRanges=expectedNativeRanges();if(acceptedRange)assert.ok(expectedRanges.includes(acceptedRange.join(':')),'Selected range is an actual standard native attack caller interval');
    if(!allowLcd){assert.deepEqual(entries.map(e=>[e.speId,e.startFrm,e.endFrm].join(':')).sort(),(acceptedRange?[acceptedRange.join(':')]:expectedRanges).sort(),'Declared HD interval coverage is exact');report.materialCoverage=entries.map(verifyManifestEntry);}
    if(failedImages){const entry=entries.find(e=>e.speId===21&&e.startFrm===9&&e.endFrm===17)||entries[0];assert.ok(entry,'Controlled HTTP scenario needs a real declared interval');const slot=entry.units[entry.startFrm].picIndex;controlledImage=entry.pictures.find(p=>p.picIndex===slot)?.src;assert.ok(controlledImage&&servedAssets.has(controlledImage),'Controlled request is an existing frozen mandatory HD PNG');report.controlledImage={path:controlledImage,range:[entry.speId,entry.startFrm,entry.endFrm],scenario};}
    const included=speManifest.entries.filter(e=>![3,'attack'].includes(e.kind)||acceptsRange(e));
    const files=['pc.html','css/hd-spe.css','assets/hd-spe/manifest.json',...included.flatMap(e=>[...e.pictures.map(p=>p.src),e.background&&e.background.src]).filter(Boolean)];
    for(const name of new Set(files)) {
        if(allowLcd&&name.endsWith('.png')&&!fs.existsSync(path.join(root,name))){(report.unavailableDeclaredImages??=[]).push(name);continue;}
        freezeAsset(name);
    }
    report.freezeScope={production:'all js/css/pc/native source and non-SPE assets; loader quartet exact to build manifest, metadata writer and runtime bytes',spe:'manifest and actual image paths referenced by selected attack ranges plus existing opening/maker/skill entries',excluded:'Unreferenced attack artwork and generation documents; successful late local requests are frozen when served'};
    const manifest = JSON.parse(servedAssets.get('js/baye.build.json').data.toString('utf8'));
    assert.equal(manifest.hdSpeProtocol.version,2,'Build manifest declares actual SPE v2');
    assert.equal(manifest.hdSpeCompositionProtocol.version,1);assert.equal(manifest.hdAttackProtocol.version,1);
    for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
        assert.equal(report.sources[name].bytes, manifest.artifacts[name].bytes, 'Engine artifact bytes match manifest: ' + name);
        assert.equal(report.sources[name].sha256, manifest.artifacts[name].sha256, 'Engine artifact hash matches manifest: ' + name);
    }
}

async function startServer() {
    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost');
            const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'pc.html';
            const snapshot = servedAssets.get(rel);
            if (snapshot) {
                if(rel===controlledImage&&scenario==='404'){report.requests.push({url:url.pathname,status:404,controlled:true,scenario});res.writeHead(404,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end('controlled missing HD image');return;}
                if(rel===controlledImage&&scenario==='late'&&!imageReleased){report.requests.push({url:url.pathname,status:'held',controlled:true,scenario,...snapshot.metadata});pendingImages.push(()=>{if(res.destroyed)return;report.requests.push({url:url.pathname,status:200,controlled:true,released:true,...snapshot.metadata});res.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store'}).end(snapshot.data);});return;}
                report.requests.push({ url: url.pathname, status: 200, ...snapshot.metadata });
                res.writeHead(200, { 'Content-Type': mime[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(snapshot.data);
                return;
            }
            const base = staged && /^js\/baye\.(js|wasm|wasm\.map)$/.test(rel) ? path.join(root, 'build/wasm/src') : root;
            const filename = path.resolve(base, base === root ? rel : path.basename(rel));
            if (!filename.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
            fs.readFile(filename, (err, data) => {
                if (err) { report.requests.push({ url: url.pathname, status: 404 }); res.writeHead(404).end(); return; }
                const metadata={source:path.relative(root,filename),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
                report.sources[rel]=metadata;servedAssets.set(rel,{data,metadata});
                report.requests.push({url:url.pathname,status:200,...metadata});
                res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(data);
            });
        } catch { res.writeHead(400).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return server;
}

async function unusedPort() {
    const socket = net.createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    return port;
}

async function connectCdp(url) {
    const ws = new WebSocket(url);
    let sequence = 0;
    const pending = new Map();
    const listeners = new Map();
    const rejectAll = () => {
        for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('CDP connection closed')); }
        pending.clear();
    };
    ws.addEventListener('close', rejectAll);
    ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const task = pending.get(msg.id); pending.delete(msg.id); clearTimeout(task.timer);
            if (msg.error) task.reject(new Error(JSON.stringify(msg.error)));
            else task.resolve(msg.result);
        } else if (listeners.has(msg.method)) {
            listeners.get(msg.method)(msg.params);
        }
    });
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error('Cannot connect to Chrome DevTools')), { once: true });
    });
    return {
        on: (name, callback) => listeners.set(name, callback),
        send(method, params = {}) {
            if (ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP connection is closed'));
            const id = ++sequence;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
                pending.set(id, { resolve, reject, timer });
                ws.send(JSON.stringify({ id, method, params }));
            });
        },
        close() { rejectAll(); ws.close(); }
    };
}

async function evaluate(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
}

async function waitFor(cdp, description, expression, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const value = await evaluate(cdp, expression);
        if (value) return value;
        await delay(150);
    }
    throw new Error('Timed out waiting for ' + description);
}

const snapshotExpression = `(() => {
    const api = window.baye, d = api && api.data;
    const read = (key) => { try { return d && d[key]; } catch { return null; } };
    return {
        ready: !!(api && api.hd && api.hd.ready()), engineReady: read('g_hdEngineReady'),
        fightMenuControl: read('g_hdFightMenuControl'), period: read('g_PIdx'), playerKing: read('g_PlayerKing'),
        menu: api && api.hd && api.hd.menuItems(), qty: api && api.hd && api.hd.qty(),
        movie: api && api.hd && api.hd.movie(), spe: api && api.hd && api.hd.spe(),
        fight: api && api.hd && api.hd.fight(), march: api && api.hd && api.hd.march(),
        system: window.BayeHdSystemUi && BayeHdSystemUi.debugSnapshot(),
        city: window.BayeHdCityMenu && BayeHdCityMenu.debugSnapshot(),
        dialog: window.BayeHdDialog && BayeHdDialog.debugSnapshot(),
        overworld: window.BayeHdOverworld && BayeHdOverworld.debugSnapshot(),
        battle: window.BayeHdBattle && BayeHdBattle.debugSnapshot(),
        bodyClass: document.body.className, lastHdCall: window.__bayeLastHdCall
    };
})()`;

async function checkpoint(cdp, name) {
    const state = await evaluate(cdp, snapshotExpression);
    if (state.fight?.active) state.rawBattle = await evaluate(cdp, battleStateExpression);
    report.phases.push({ name, ...state });
    console.log('PASS', name);
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, name + '.png'), Buffer.from(image.data, 'base64'));
    return state;
}

async function key(cdp, name) {
    report.inputs.push({ type:"key", key:name, at:new Date().toISOString() });
    const codes = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, h: 72, f: 70, s: 83, ' ': 32 };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name] });
    await delay(180);
}

async function click(cdp, selector) {
    report.inputs.push({ type:"click", selector, at:new Date().toISOString() });
    const point = await evaluate(cdp, `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block: 'center' });
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return null;
        const x=rect.x+rect.width/2,y=rect.y+rect.height/2,top=document.elementFromPoint(x,y);
        return {x,y,unobstructed:!!(top&&(top===node||node.contains(top))),top:top&&top.id};
    })()`);
    assert.ok(point, 'Visible click target: ' + selector);
    assert.ok(point.unobstructed, 'Click target is not covered: '+selector+' (top='+point.top+')');
    const mousePoint={x:point.x,y:point.y};
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mousePoint, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mousePoint, button: 'left', clickCount: 1 });
    await delay(250);
}


// The observer wraps presentation callbacks, never an engine rule or input hook.
const speObserverSource = '(' + function () {
    window.__speSamples = [];
    window.__attackImages=[];
    window.__hdSpeDrawLog=[];
    window.__allAttackDraws=[];
    window.__attackUiPhase='normal';
    for(const name of ['drawImage','fillRect','fillText','rect','clip']){
        const original=CanvasRenderingContext2D.prototype[name];
        CanvasRenderingContext2D.prototype[name]=function(){
            const result=original.apply(this,arguments);
            if(this.canvas&&this.canvas.id==='hd-spe-canvas'){
                const args=Array.from(arguments);if(name==='fillRect'&&args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height)window.__hdSpeDrawLog=[];
                let op={type:name,args:args.slice(),fillStyle:this.fillStyle,font:this.font,hidden:document.hidden,at:performance.now()};
                if(name==='drawImage'){const source=args.shift();op={...op,args,src:source.src?new URL(source.src,location.href).pathname.replace(/^\//,'' ):null,naturalWidth:source.naturalWidth||source.width,naturalHeight:source.naturalHeight||source.height};}
                if(name==='fillText'){op.text=String(args.shift());op.args=args;}
                window.__hdSpeDrawLog.push(op);
                if(name==='drawImage')window.__allAttackDraws.push(op);
            }return result;
        };
    }
    let lastAttack=null;
    const heldReadbacks=new Set();
    window.__speEngineKeys = [];
    window.__speObserverErrors = [];
    window.__spePhase = 'opening';
    let currentApi = null, originalSendKey = null;
    const nativeSnapshot=()=>{try{return window.baye&&baye.hd&&baye.hd.ready()?JSON.parse(JSON.stringify({spe:baye.hd.spe(),attack:baye.hd.attack(),top:baye.hd.resultOwner(),skillResult:baye.hd.skillResult()})):null;}catch{return null;}};
    function record(stage,img,w,h,callbackBefore,callbackAfter) {
        try {
            if (!window.baye || !baye.hd || !baye.hd.ready()) return;
            const spe = baye.hd.spe(), ui = currentApi && currentApi.debugSnapshot();
            const fight=baye.hd.fight(),reportOwner=baye.hd.report(),attack=baye.hd.attack&&baye.hd.attack(),top=baye.hd.resultOwner();
            const isAttack=spe.active&&spe.kind===3&&spe.id>=19&&spe.id<=25;
            const attrs=()=>[0,1].map(i=>{const a=baye.data.g_GenAtt[i];return {generalIndex:Number(a.generalIndex),armType:Number(a.armsType),terrain:Number(a.ter),attack:Number(a.at),defence:Number(a.df)};});
            if(isAttack)lastAttack={eventId:spe.eventId,generation:spe.generation,id:spe.id,startFrm:spe.startFrm,endFrm:spe.endFrm,actorIndex:spe.actorIndex,targetIndex:spe.targetIndex,attributes:attrs()};
            const holdKey=attack&&attack.generation+':'+attack.session;
            const held=stage==='lifecycle'&&attack&&attack.active&&attack.phase==='hold'&&attack.display&&attack.display.valid&&!heldReadbacks.has(holdKey);
            const probe=stage==='presentation-readback';
            if(held||probe){const lcd=document.getElementById('lcd');if(lcd){img=lcd.getContext('2d').getImageData(0,0,lcd.width,lcd.height);w=lcd.width;h=lcd.height;if(held)heldReadbacks.add(holdKey);}}
            if((stage==='lcd-flush'||held||probe)&&(lastAttack||attack&&attack.active)&&img) {
                const before={spe:spe.display,attack:attack&&attack.display,top},native=document.createElement('canvas'),hd=document.getElementById('hd-spe-canvas');
                native.width=w||img.width;native.height=h||img.height;native.getContext('2d').putImageData(img,0,0);
                let bytes='';for(let i=0;i<img.data.length;i++)bytes+=String.fromCharCode(img.data[i]);
                const nativeRgba=btoa(bytes),nativeUrl=native.toDataURL('image/png'),hdUrl=hd&&hd.toDataURL('image/png'),after={spe:baye.hd.spe().display,attack:baye.hd.attack&&baye.hd.attack().display,top:baye.hd.resultOwner()};
                let lcdCanvasRgba=null;
                if(hd&&ui.source==='lcd'&&hd.width===130*ui.scale&&hd.height===64*ui.scale){const data=hd.getContext('2d').getImageData(0,0,hd.width,hd.height).data;let sample='';for(let row=0;row<64;row++)for(let col=0;col<130;col++){const off=(Math.floor((row+.5)*ui.scale)*hd.width+Math.floor((col+.5)*ui.scale))*4;for(let channel=0;channel<4;channel++)sample+=String.fromCharCode(data[off+channel]);}lcdCanvasRgba=btoa(sample);}
                const dom=()=>{const n=document.getElementById('lcd'),box=n&&n.getBoundingClientRect(),style=n&&getComputedStyle(n),container=n&&n.closest('.js-baye-pc-lcd'),cs=container&&getComputedStyle(container),root=document.getElementById('hd-spe'),r=hd&&hd.getBoundingClientRect(),s=hd&&getComputedStyle(hd),rs=root&&getComputedStyle(root),top=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),ntop=box&&document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return {nativePresentation:box&&{visible:!!(box.width&&box.height&&style.visibility==='visible'&&style.display!=='none'&&cs&&cs.visibility==='visible'&&cs.display!=='none'),inViewport:box.x>=0&&box.y>=0&&box.right<=innerWidth+.5&&box.bottom<=innerHeight+.5,stackOwned:!!(ntop&&container&&container.contains(ntop)),top:ntop&&{id:ntop.id,className:ntop.className}},lcd:box&&{x:box.x,y:box.y,width:box.width,height:box.height,visibility:style.visibility,display:style.display},container:cs&&{visibility:cs.visibility,display:cs.display,opacity:cs.opacity},presentation:r&&{x:r.x,y:r.y,width:r.width,height:r.height,visible:!!(r.width&&r.height&&s.visibility==='visible'&&s.display!=='none'&&rs.visibility==='visible'&&rs.display!=='none'),inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,stackOwned:!!(top&&root.contains(top)),top:top&&{id:top.id,className:top.className}},bodyClass:document.body.className,battleOpen:BayeHdBattle.isOpen(),speOpen:currentApi.isOpen()};};
                window.__attackImages.push({stage:probe?'presentation-readback':held?'held-lcd-readback':isAttack?'spe-frame':'after-spe',rawSource:held||probe?'canvas-readback-normalized':'lcd-callback-image-data',callbackBefore,callbackAfter,lastAttack:lastAttack&&{...lastAttack},before,after,spe,attack,top,fight,reportOwner,ui,hidden:document.hidden,mode:BayeHdBattle.getMode(),uiPhase:window.__attackUiPhase,dom:dom(),drawLog:window.__hdSpeDrawLog.slice(),drawing:{flip:Number(baye.data.g_FlipDrawing),paint:Number(baye.data.g_paintColor),palette0:Number(baye.data.g_paintPalette[0]),palette255:Number(baye.data.g_paintPalette[255])},at:performance.now(),nativeWidth:native.width,nativeHeight:native.height,nativeRgba,lcdCanvasRgba,nativeUrl,hdUrl});
                if(window.__attackImages.length>2000)throw Error('Attack callback limit');
            }
            if(!spe.active&&fight.inputKind===1)lastAttack=null;

            window.__speSamples.push({ stage, phase: window.__spePhase, at: performance.now(),
                spe, ui: ui && { open: ui.open, source: ui.source, fallbackReason: ui.fallbackReason,
                    displayedFrames: ui.displayedFrames, flushKey: ui.flushKey,skipVisible:ui.skipVisible,
                    scale:ui.scale,canvasW:ui.canvasW,canvasH:ui.canvasH },attack });
            if (window.__speSamples.length > 20000) throw new Error('SPE observation limit exceeded');
        } catch (error) { window.__speObserverErrors.push(String(error)); }
    }
    window.__r09CapturePresentation=()=>record('presentation-readback');
    Object.defineProperty(window, 'BayeHdSpe', {
        configurable: true, get() { return currentApi; },
        set(api) {
            currentApi = api;
            for (const name of ['onEngineSpe', 'onLcdFlush']) {
                const original = api[name];
                api[name] = function () {
                    const before=nativeSnapshot();
                    const result = original.apply(this, arguments);
                    const after=nativeSnapshot();
                    record(name === 'onLcdFlush' ? 'lcd-flush' : 'lifecycle',name === 'onLcdFlush'?arguments[0]:null,arguments[1],arguments[2],before,after);
                    return result;
                };
            }
            if (!originalSendKey && typeof window.sendKey === 'function') {
                originalSendKey = window.sendKey;
                window.sendKey = function (code) {
                    let spe = null, fight = null,attack=null;
                    try { if (baye.hd.ready()) { spe = baye.hd.spe(); fight = baye.hd.fight();attack=baye.hd.attack&&baye.hd.attack(); } } catch {}
                    window.__speEngineKeys.push({ code, at: performance.now(), phase: window.__spePhase,
                        generation: spe && spe.generation, eventId: spe && spe.eventId, kind: spe && spe.kind,
                        speActive:spe&&spe.active,
                        fightKind: fight && fight.inputKind, fightSeq: fight && fight.inputSeq,
                        attackActive:attack&&attack.active,attackSession:attack&&attack.session,attackPhase:attack&&attack.phase });
                    return originalSendKey.apply(this, arguments);
                };
            }
        }
    });
}.toString() + ')();';

function assertDisplayRecords(records) {
    assert.ok(Array.isArray(records), 'Real SPE observations were captured');
    const displayed = records.filter(r => r.stage === 'lcd-flush' && r.spe.active &&
        r.spe.protocolVersion === 2 && r.spe.display.frameValid);
    for (const record of displayed) {
        const s = record.spe, d = s.display;
        assert.equal(d.generation, s.generation, 'Flushed generation matches its live event');
        assert.equal(d.eventId, s.eventId, 'Flushed event matches its live scope');
        assert.ok(Number.isInteger(d.commitSeq) && d.commitSeq > 0 && d.commitSeq <= s.commitSeq,
            'Displayed commit is an actual copied native commit');
        assert.ok(d.frameIndex >= s.startFrm && d.frameIndex <= s.endFrm, 'Displayed logical frame is in the actual interval');
        assert.equal(d.visibleFrames.length, 32);
        assert.ok(d.visibleFrames.every(v=>Number.isInteger(v)&&v>=0&&v<=255),'Actual visible bitmap contains bytes');
        const frames = [];
        for (let i = 0; i < 256; i++) {
            if (d.visibleFrames[i >> 3] & (1 << (i & 7))) {
                assert.ok(i >= s.startFrm && i <= d.frameIndex && i <= s.endFrm && i < s.count,
                    'Only introduced in-range native picture units are visible');
                frames.push(i);
            }
        }
        if (record.ui.source === 'hd-assets') {
            assert.deepEqual(record.ui.displayedFrames, frames, 'HD slots exactly follow the flushed native bitmap');
        }
    }
    return displayed;
}

async function collectSpe(cdp) {
    const evidence = await evaluate(cdp, '({samples:window.__speSamples,keys:window.__speEngineKeys,errors:window.__speObserverErrors})');
    assert.deepEqual(evidence.errors, [], 'Read-only observer has no errors');
    assertDisplayRecords(evidence.samples);
    return evidence;
}

async function smoke(cdp) {
    await waitFor(cdp, 'SPE v2 ready', 'window.baye && baye.hd && baye.hd.ready() && baye.hd.spe().protocolVersion === 2', 60000);
    await waitFor(cdp, 'at least three actual opening display commits', "(() => { const s=baye.hd.spe(),r=window.__speSamples.filter(r=>r.stage==='lcd-flush'&&r.spe.generation===s.generation&&r.spe.eventId===s.eventId&&r.spe.display.frameValid); return s.active&&s.id===3&&s.kind===1&&new Set(r.map(r=>r.spe.display.commitSeq)).size>=3&&new Set(r.map(r=>r.spe.display.frameIndex)).size>=2; })()", 20000);
    const opening = await evaluate(cdp, 'baye.hd.spe()');
    const evidence = await collectSpe(cdp);
    const frames = evidence.samples.filter(r => r.stage === 'lcd-flush' && r.spe.eventId === opening.eventId && r.spe.display.frameValid);
    assert.ok(new Set(frames.map(r => r.spe.display.commitSeq)).size >= 3, 'Opening has multiple actual displayed commits');
    assert.ok(new Set(frames.map(r => r.spe.display.frameIndex)).size >= 2, 'Opening shows multiple native logical frames');
    assert.equal(opening.skipEligible, true, 'Native opening really accepts a player skip');
    assert.ok(frames.every(r=>r.ui.open&&r.ui.skipVisible),'Actual displayed opening exposes the HD player skip');
    report.opening = { eventId: opening.eventId, generation: opening.generation, displayedCommits: frames.length };
    await checkpoint(cdp, '01-native-opening-frames');
    await click(cdp, '#hd-spe-skip');
    await waitFor(cdp, 'native opening key termination', 'window.__speSamples.some(r=>r.spe.lastEnd.eventId===' + opening.eventId + "&&r.spe.lastEnd.reason==='key'&&r.spe.lastEnd.key===39)");
    const skipped = await collectSpe(cdp);
    const keys = skipped.keys.filter(k => k.generation === opening.generation && k.eventId === opening.eventId);
    assert.deepEqual(keys.map(k => k.code), [0x27], 'One player skip delivers exactly one native Enter');
    await waitFor(cdp, 'opening overlay retired', 'baye.hd.spe().eventId!==' + opening.eventId + ' && !BayeHdSpe.isOpen()');
    report.opening.skip = keys;
    await checkpoint(cdp, '02-opening-ended-cleanly');
    await evaluate(cdp, "BayeHdSystemUi.setMode('classic');window.__spePhase='menus';");
    await waitFor(cdp, 'actual title picture', 'window.__speSamples.some(r=>r.spe.id===100)', 20000);
    await key(cdp, 'Enter');
    await waitFor(cdp, 'actual period picture', 'window.__speSamples.some(r=>r.spe.id===104)');
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real period 1 lord selection', 'baye.data.g_PIdx===1 && baye.hd.kings().count>0');
    const lord = await evaluate(cdp, "(() => {const m=baye.hd.kings();return {target:m.kings.findIndex(k=>k.name==='马腾'),index:m.index,kings:m.kings};})()");
    assert.ok(lord.target >= 0, 'Real period 1 contains Ma Teng');
    for (let i = lord.index; i < lord.target; i++) await key(cdp, 'ArrowDown');
    for (let i = lord.index; i > lord.target; i--) await key(cdp, 'ArrowUp');
    await waitFor(cdp, 'native lord highlight', 'baye.hd.kings().index===' + lord.target);
    report.selectedLord = lord.kings[lord.target];
    await key(cdp, 'Enter');
    await waitFor(cdp, 'real strategy map', 'baye.hd.march().pick && baye.hd.realm().ownedCount>0');
    await checkpoint(cdp, '03-real-map');
    report.actualLib = await evaluate(cdp, '({preferred:localStorage.getItem("baye/libpath"),hex:window.dynLib})');
    report.actualLib.sha256 = crypto.createHash('sha256').update(Buffer.from(report.actualLib.hex, 'hex')).digest('hex');
    delete report.actualLib.hex;
    report.startingRealm=await evaluate(cdp, `(() => {
        const d=baye.data,count=baye.getPersonCount(),realm=baye.hd.realm(),toolCount=baye.getToolCount();
        const persons=Array.from({length:count},(_,id)=>{const p=d.g_Persons[id];return {id,name:baye.getPersonName(id),belong:Number(p.Belong),city:realm.cities.find(c=>{const q=d.g_Cities[c.i],start=Number(q.PersonQueue),n=Number(q.Persons);return Array.from({length:n},(_,i)=>Number(d.g_PersonsQueue[start+i])).includes(id);})?.i,arms:Number(p.Arms),armType:baye.hd.personArmType(id),baseArm:Number(p.ArmsType),equip:[Number(p.Equip[0]),Number(p.Equip[1])]};});
        const cities=realm.cities.map(c=>{const q=d.g_Cities[c.i],start=Number(q.ToolQueue),n=Number(q.Tools);return {...c,links:baye.hd.cityLinks(c.i),nativePersons:Number(q.Persons),tools:Array.from({length:n},(_,i)=>{const raw=Number(d.g_GoodsQueue[start+i]),id=raw&32767;return {raw,found:!!(raw&32768),id,name:id<toolCount?baye.getToolName(id):null,details:id<toolCount?baye.hd.toolDetails(id):null};})};});return {period:Number(d.g_PIdx),playerKing:Number(d.g_PlayerKing),personCount:count,toolCount,persons,cities};
    })()`);
    await evaluate(cdp, "window.__spePhase='battle';");
    await marchSmoke(cdp);
}
async function action(cdp, label, expression) {
    const before=await evaluate(cdp,'({fight:baye.hd.fight(),march:baye.hd.march(),menu:baye.hd.menuItems()})');
    const result=await evaluate(cdp, expression);
    report.inputs.push({type:'action', label, before, result, at:new Date().toISOString()});
    return result;
}

function recruitWorldExpression(cityIndex) {
    return `(() => {
        const d=baye.data,c=d.g_Cities[${cityIndex}],count=baye.getPersonCount();
        const ids=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i]));
        const persons=ids.map(id=>{if(!Number.isInteger(id)||id<0||id>=count)throw Error('Invalid native PersonQueue ID');const p=d.g_Persons[id];return {personIndex:id,nativeGenId:id+1,name:baye.getPersonName(id),belong:Number(p.Belong),arms:Number(p.Arms),thew:Number(p.Thew),armType:baye.hd.personArmType(id)};});
        const orders=Array.from({length:Number(d.g_OrderQueue.length)},(_,i)=>d.g_OrderQueue[i]).filter(o=>Number(o.OrderId)!==255).map(o=>({OrderId:Number(o.OrderId),City:Number(o.City),Person:Number(o.Person),TimeCount:Number(o.TimeCount)}));
        return {cityIndex:${cityIndex},belong:Number(c.Belong),playerKing:Number(d.g_PlayerKing),money:Number(c.Money),reserve:Number(c.MothballArms),armsPerMoney:Number(d.g_engineConfig.armsPerMoney),persons,orders,date:{year:Number(d.g_YearDate),month:Number(d.g_MonthDate)},menu:baye.hd.menuItems(),qty:baye.hd.qty()};
    })()`;
}

async function currentPersonPicker(cdp,label,cityIndex) {
    return waitFor(cdp,'actual '+label+' native IDs',`(() => {
        const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems(),d=baye.data,c=d.g_Cities[${cityIndex}];
        if(s.layer!=='deep'||s.deepLabel!==${JSON.stringify(label)}||!m.active||m.context!==1||m.kind!==3||!m.idsValid||!m.ids.length||s.sending||s.queueLen)return false;
        const actual=Array.from({length:Number(c.Persons)},(_,i)=>Number(d.g_PersonsQueue[Number(c.PersonQueue)+i])).filter(id=>Number(d.g_Persons[id].Belong)===Number(c.Belong));
        if(JSON.stringify(actual)!==JSON.stringify(m.ids))throw Error('Native picker IDs differ from actual allied PersonQueue');
        const owner=s.deepMenuOwner;
        if(!owner||owner.context!==m.context||owner.kind!==m.kind||owner.seq!==m.seq||owner.detailGeneration!==m.detailGeneration||
            !m.ids.every((id,index)=>s.deepItems.some(item=>item.i===index&&item.pind===id)))return false;
        return {menu:m,city:s,personIds:actual};
    })()`);
}

async function chooseNativePerson(cdp,label,cityIndex,personIndex) {
    const picker=await currentPersonPicker(cdp,label,cityIndex),index=picker.menu.ids.indexOf(personIndex);
    assert.ok(index>=0,'Requested person is in the actual native '+label+' picker');
    const item=picker.city.deepItems.find(item=>item.i===index);
    assert.equal(item?.pind,personIndex,'HD row belongs to the exact current native U16 person ID');
    await click(cdp,`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="${personIndex}"]`);
    const qty=await waitFor(cdp,label+' genuine quantity wait',`(() => {
        const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();
        if(s.qtyAckFailed)throw Error('Native quantity ACK failed: '+s.qtyAckError);
        return q.active&&q.protocol&&q.ready===1&&q.min===0&&q.max>0&&BayeHdCityMenu.isQtyLive()&&!s.sending&&!s.queueLen&&q;
    })()`);
    assert.ok(Number.isInteger(qty.session)&&qty.session>0);
    assert.ok(Number.isInteger(qty.step)&&qty.step>0);
    return {picker,index,personIndex,nativeGenId:personIndex+1,qty};
}

async function setRecruitQuantity(cdp,initial,description,requestedArms=recruitArms) {
    const wanted=Math.min(initial.max,requestedArms),steps=[];
    assert.ok(Number.isInteger(wanted)&&wanted>=initial.min&&wanted>0,'Requested amount is inside actual native bounds');
    let q=initial;
    const keyAck=async(name,expectedValue=null)=>{
        const before=q,code={h:0x26,ArrowLeft:0x24,ArrowRight:0x25,ArrowUp:0x22,ArrowDown:0x23}[name];
        await key(cdp,name);
        q=await waitFor(cdp,description+' '+name+' native ACK',`(() => {
            const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();
            if(s.qtyAckFailed)throw Error('Native quantity ACK failed: '+s.qtyAckError);
            return q.active&&q.protocol&&q.session===${initial.session}&&q.ready===1&&q.inputSeq!==${before.inputSeq}&&!s.sending&&!s.queueLen&&q;
        })()`);
        assert.equal(q.inputSeq,before.inputSeq===0xffffffff?1:before.inputSeq+1,'One player key has exactly one native quantity receipt');
        assert.equal(q.lastKey,code,'Receipt belongs to this exact physical quantity key');
        assert.equal(q.min,initial.min);assert.equal(q.max,initial.max);
        if(expectedValue!==null)assert.equal(q.value,expectedValue,'Native quantity changed by the observed arithmetic place');
        steps.push({physicalKey:name,nativeCode:code,before,after:q});
    };
    if(q.value!==wanted) {
        // H is the original NumOperate max/min toggle. Start from real min0;
        // physical arrows then use C's observed decimal step, never a setter.
        if(q.value!==q.max)await keyAck('h',q.max);
        await keyAck('h',q.min);
        for(let iterations=0;q.value!==wanted&&iterations<100;iterations++) {
            const remaining=wanted-q.value;
            assert.ok(remaining>0,'Quantity planner never exceeds its original requested amount');
            const place=10**Math.floor(Math.log10(remaining));
            if(q.step<place)await keyAck('ArrowLeft',q.value);
            else if(q.step>place)await keyAck('ArrowRight',q.value);
            else await keyAck('ArrowUp',q.value+q.step);
        }
    }
    assert.equal(q.value,wanted,'Player controls reached min(actual native max,requested amount)');
    return {initial,requested:requestedArms,wanted,steps,atConfirmation:q};
}

async function commitRecruitQuantity(cdp,description) {
    const q=await evaluate(cdp,'baye.hd.qty()');
    const keyStart=await evaluate(cdp,'window.__speEngineKeys.length');
    const selector=await evaluate(cdp,"BayeHdDialog.isQtyOpen()?'#hd-dialog [data-hd-dlg-ok]':'#hd-city-menu [data-hd-qty-ok]'");
    await click(cdp,selector);
    await waitFor(cdp,description+' consumed by original quantity input',`(() => {
        const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();
        if(s.qtyAckFailed)throw Error('Native quantity ACK failed: '+s.qtyAckError);
        return !q.active&&!s.sending&&!s.queueLen;
    })()`);
    const after=await evaluate(cdp,'baye.hd.qty()'),keys=await evaluate(cdp,`window.__speEngineKeys.slice(${keyStart})`);
    assert.deepEqual(keys.map(k=>k.code),[0x27],'One actual confirmation emits one native ENTER');
    assert.equal(after.session,q.session);assert.equal(after.lastKey,0x27);assert.equal(after.value,q.value);
    assert.equal(after.inputSeq,q.inputSeq===0xffffffff?1:q.inputSeq+1);
    return {before:q,after,nativeKeys:keys};
}

async function reopenMilitaryAfterPersonPicker(cdp,cityIndex,label) {
    const before=await evaluate(cdp,recruitWorldExpression(cityIndex)),inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    await click(cdp,'#hd-city-menu [data-hd-menu-back]');
    // The real command's person-picker EXIT unwinds all the way to PlayerTactic.
    // The HD shell can retain its local sub layer; require the native map owner,
    // then take the same actual city-entry path used at the beginning of march.
    await waitFor(cdp,`native map after stopping ${label}`,"!baye.hd.menuItems().active&&!baye.hd.qty().active&&baye.hd.march().pick===1&&baye.hd.march().phase===0&&BayeHdOverworld.debugSnapshot().phase==='map'&&!BayeHdCityMenu.debugSnapshot().sending&&BayeHdCityMenu.debugSnapshot().queueLen===0");
    const retired=await evaluate(cdp,recruitWorldExpression(cityIndex)),exitInputs=await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`);
    assert.deepEqual(exitInputs.map(k=>k.code),[0x28],`${label} picker cancellation emits one actual EXIT`);
    for(const field of ['money','reserve','persons','orders','date'])assert.deepEqual(retired[field],before[field],`${label} cancellation preserves ${field}`);
    assert.ok(await action(cdp,`reopen-owned-city-after-${label}`,`BayeHdOverworld.walkToCity(${cityIndex})`));
    await waitFor(cdp,`real city root after ${label}`,`(() => { const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(); return s.open&&s.layer==='root'&&s.cityIndex===${cityIndex}&&m.active&&m.context===1&&m.kind===1; })()`);
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp,`real military submenu after ${label}`,"(() => { const m=baye.hd.menuItems(); return BayeHdCityMenu.getLayer()==='sub'&&m.active&&m.context===1&&m.kind===2&&m.names[0]==='侦察'; })()");
    const reopened=await evaluate(cdp,recruitWorldExpression(cityIndex));
    for(const field of ['money','reserve','persons','orders','date'])assert.deepEqual(reopened[field],before[field],`${label} re-entry preserves ${field}`);
    return {label,before,retired,reopened,exitInputs,nativeInputs:await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`)};
}

async function recruitSmoke(cdp,cityIndex) {
    const inputStart=await evaluate(cdp,'window.__speEngineKeys.length');
    await click(cdp,'#hd-city-menu [data-hd-sub="1"]');
    const picker=await currentPersonPicker(cdp,'征兵',cityIndex),before=await evaluate(cdp,recruitWorldExpression(cityIndex));
    const allowed=before.persons.filter(p=>picker.menu.ids.includes(p.personIndex));
    const actor=allowed.find(p=>p.personIndex!==before.playerKing&&requestedActor(p));
    assert.ok(actor,'Actual city contains a non-lord attacker for the requested native interval');
    // Assign a different resident to the real conscription order. This person
    // leaves the resident queue until PolicyExec; it is never faked back in.
    const recruiter=allowed.slice().reverse().find(p=>p.personIndex!==actor.personIndex&&p.personIndex!==before.playerKing);
    assert.ok(recruiter,'A different current native resident can perform conscription');
    assert.ok(before.armsPerMoney>0&&Number.isInteger(before.armsPerMoney));
    const chosen=await chooseNativePerson(cdp,'征兵',cityIndex,recruiter.personIndex);
    const quantity=await setRecruitQuantity(cdp,chosen.qty,'征兵'),confirmation=await commitRecruitQuantity(cdp,'征兵');
    await currentPersonPicker(cdp,'征兵',cityIndex);
    let enlisted=await evaluate(cdp,recruitWorldExpression(cityIndex));
    assert.equal(enlisted.reserve,before.reserve+quantity.wanted,'Conscription adds the actual selected quantity to city reserves');
    assert.equal(enlisted.money,before.money-Math.floor(quantity.wanted/before.armsPerMoney),'Money follows the actual configured conscription cost');
    assert.equal(enlisted.persons.find(p=>p.personIndex===actor.personIndex)?.arms,actor.arms,'Conscription has not secretly equipped the attacker');
    assert.deepEqual(enlisted.persons.map(p=>p.personIndex).sort((a,b)=>a-b),before.persons.filter(p=>p.personIndex!==recruiter.personIndex).map(p=>p.personIndex).sort((a,b)=>a-b),'Native order removes only its actual recruiter from city residents');
    assert.equal(enlisted.orders.filter(o=>o.OrderId===24&&o.City===cityIndex&&o.Person===recruiter.personIndex).length,before.orders.filter(o=>o.OrderId===24&&o.City===cityIndex&&o.Person===recruiter.personIndex).length+1);
    assert.deepEqual(enlisted.date,before.date,'Enlistment has not advanced the campaign month');
    await checkpoint(cdp,'06a-real-enlisted-city-reserves');
    const enlistments=[{recruiter,before,chosen,quantity,confirmation,after:enlisted}];
    // A native order is capped independently by devotion and available money.
    // Larger requested preparation can require another real resident/order;
    // never manufacture reserves or advance time to restore the first person.
    for(let round=1;recruitArms>800&&enlisted.reserve-before.reserve<recruitArms&&round<10;round++){
        const previous=enlisted,picker=await currentPersonPicker(cdp,'征兵',cityIndex);
        const candidate=previous.persons.slice().reverse().find(p=>p.personIndex!==actor.personIndex&&p.personIndex!==before.playerKing&&picker.menu.ids.includes(p.personIndex));
        assert.ok(candidate,'Another actual remaining resident can issue the next bounded conscription order');
        const selected=await chooseNativePerson(cdp,'征兵',cityIndex,candidate.personIndex);
        const amount=await setRecruitQuantity(cdp,selected.qty,'征兵第'+(round+1)+'次',recruitArms-(previous.reserve-before.reserve)),receipt=await commitRecruitQuantity(cdp,'征兵第'+(round+1)+'次');
        await currentPersonPicker(cdp,'征兵',cityIndex);enlisted=await evaluate(cdp,recruitWorldExpression(cityIndex));
        assert.equal(enlisted.reserve,previous.reserve+amount.wanted);assert.equal(enlisted.money,previous.money-Math.floor(amount.wanted/before.armsPerMoney));
        assert.equal(enlisted.persons.find(p=>p.personIndex===actor.personIndex)?.arms,actor.arms);
        assert.deepEqual(enlisted.persons.map(p=>p.personIndex).sort((a,b)=>a-b),previous.persons.filter(p=>p.personIndex!==candidate.personIndex).map(p=>p.personIndex).sort((a,b)=>a-b));
        assert.equal(enlisted.orders.filter(o=>o.OrderId===24&&o.City===cityIndex&&o.Person===candidate.personIndex).length,previous.orders.filter(o=>o.OrderId===24&&o.City===cityIndex&&o.Person===candidate.personIndex).length+1);assert.deepEqual(enlisted.date,before.date);
        enlistments.push({recruiter:candidate,before:previous,chosen:selected,quantity:amount,confirmation:receipt,after:enlisted});
        await checkpoint(cdp,'06a-real-enlisted-additional-order-'+round);
    }
    const enlistRetirement=await reopenMilitaryAfterPersonPicker(cdp,cityIndex,'征兵');
    await click(cdp,'#hd-city-menu [data-hd-sub="2"]');
    const distribute=await chooseNativePerson(cdp,'分配',cityIndex,actor.personIndex);
    const distribution=await setRecruitQuantity(cdp,distribute.qty,'分配'),distributionConfirmation=await commitRecruitQuantity(cdp,'分配');
    await currentPersonPicker(cdp,'分配',cityIndex);
    const equipped=await evaluate(cdp,recruitWorldExpression(cityIndex));
    assert.equal(equipped.persons.find(p=>p.personIndex===actor.personIndex)?.arms,distribution.wanted,'Only real DistributeMake sets the attacker troop count');
    assert.equal(equipped.reserve,enlisted.reserve+actor.arms-distribution.wanted,'Distribution transfers the original reserve plus old personal troops');
    assert.equal(equipped.money,enlisted.money,'Native distribution charges no invented money');
    assert.deepEqual(equipped.persons.map(p=>p.personIndex),enlisted.persons.map(p=>p.personIndex));
    assert.deepEqual(equipped.orders,enlisted.orders);assert.deepEqual(equipped.date,before.date);
    report.recruitment={cityIndex,requested:acceptedRange,recruiter,actor,attackerNativeGenId:actor.nativeGenId,before,chosen,quantity,confirmation,enlistments,enlisted,enlistRetirement,distribute,distribution,distributionConfirmation,equipped,nativeInputs:await evaluate(cdp,`window.__speEngineKeys.slice(${inputStart})`),scope:'Actual bounded conscription orders into city reserve, then actual distribution to the selected current native person. No time advance or game setters.'};
    await checkpoint(cdp,'06b-real-distributed-attacker-troops');
    report.recruitment.distributionRetirement=await reopenMilitaryAfterPersonPicker(cdp,cityIndex,'分配');
}

async function marchSmoke(cdp) {
    await evaluate(cdp, `(() => { BayeHdOverworld.setMode('hd-map'); BayeHdCityMenu.setMode('hd'); BayeHdBattle.setMode('hd'); })()`);
    const owned = await waitFor(cdp, 'owned HD map 天水', `(() => { const m=BayeHdOverworld.debugSnapshot(); return m.phase==='map' && m.owned.find(c=>c.i===8 && c.name==='天水'); })()`);
    report.marchPlan = await evaluate(cdp, `(() => {
        const realm=baye.hd.realm();
        return realm.cities.filter(c=>c.owned).map(c=>({ ...c, links:baye.hd.cityLinks(c.i), persons:Number(baye.data.g_Cities[c.i].Persons), food:Number(baye.data.g_Cities[c.i].Food) }));
    })()`);
    assert.ok(await action(cdp,'open-owned-city', `BayeHdOverworld.walkToCity(${owned.i})`));
    await waitFor(cdp, 'real city root menu', `BayeHdCityMenu.isOpen() && BayeHdCityMenu.getLayer() === 'root' && baye.hd.menuItems().active`);
    await checkpoint(cdp,'06-hd-city');
    await click(cdp,'#hd-city-menu [data-hd-root="2"]');
    await waitFor(cdp, 'military submenu', `BayeHdCityMenu.getLayer() === 'sub' && baye.hd.menuItems().active && baye.hd.menuItems().names[0] === '侦察'`);
    if(recruit)await recruitSmoke(cdp,owned.i);
    await click(cdp,'#hd-city-menu [data-hd-sub="4"]');
    await waitFor(cdp, 'march person picker', `(() => { const s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.march(); return m.phase===1 && m.origin===8 && s.deepItems.length && baye.hd.menuItems().active; })()`);
    await checkpoint(cdp,'07-march-persons');
    // The engine can finish automatically after the final remaining general.
    // Observe selected ACK and live phase before choosing another person.
    for(let i=0;i<6;i++) {
        const before=await evaluate(cdp,'({march:baye.hd.march(),menu:baye.hd.menuItems(),city:BayeHdCityMenu.debugSnapshot()})');
        if(before.march.phase!==1 || !before.menu.active || !before.city.deepItems.length) break;
        if(recruit) {
            assert.equal(before.menu.idsValid,true,'March picker has authoritative native person IDs');
            report.marchPersonIds??=[];report.marchPersonIds.push(before.menu.ids[0]);
        }
        await click(cdp,'#hd-city-menu [data-hd-deep="0"]');
        await waitFor(cdp,'selected general acknowledged',`baye.hd.march().selected > ${before.march.selected} || baye.hd.march().phase !== 1`);
    }
    await checkpoint(cdp,'08-march-persons-picked');
    if(recruit)assert.ok(report.marchPersonIds.includes(report.recruitment.actor.personIndex),'The equipped actual person was selected for the native march');
    if(await evaluate(cdp,'baye.hd.march().phase === 1')) {
        await click(cdp,'#hd-city-menu [data-hd-finish-persons]');
    }
    await waitFor(cdp, 'march food quantity', `baye.hd.march().phase===2 && baye.hd.qty().active && baye.hd.qty().min === 1`);
    await checkpoint(cdp,'09-march-food');
    const foodSelector=await evaluate(cdp, `BayeHdDialog.isQtyOpen() ? '#hd-dialog [data-hd-dlg-ok]' : '#hd-city-menu [data-hd-qty-ok]'`);
    await click(cdp,foodSelector);
    await waitFor(cdp, 'explicit target instruction', `baye.hd.march().phase === 3`);
    await checkpoint(cdp,'10-march-target-instruction');
    await action(cdp,'continue-target-instruction','BayeHdCityMenu.continueMarch()');
    await waitFor(cdp, 'march target map', `baye.hd.march().phase === 4 && baye.hd.march().battlePick === 1`);
    await checkpoint(cdp,'11-march-target');
    const selected=await action(cdp,'select-target-only','BayeHdCityMenu.selectMarchTarget(9)');
    assert.equal(selected.selected,9);
    assert.equal(await evaluate(cdp,'baye.hd.march().phase'),4,'selecting alone must not send confirmation');
    await action(cdp,'confirm-target','BayeHdCityMenu.confirmMarchTarget(9)');
    await waitFor(cdp,'real departure report','baye.hd.march().phase===6',20000);
    await checkpoint(cdp,'12-march-departure-report');
    const departureMapSeq=await evaluate(cdp,'baye.hd.march().mapInputSeq');
    await action(cdp,'confirm-departure-report','BayeHdCityMenu.continueMarch()');
    await waitFor(cdp,'actual AddFightOrder ACK','baye.hd.march().phase===7 && baye.hd.march().ok===1');
    await waitFor(cdp,'actual strategy input after departure',`(() => {const m=baye.hd.march(),menu=baye.hd.menuItems();return (menu.active&&[1,2].includes(menu.context))||(!menu.active&&m.pick===1&&m.battlePick===0&&m.mapInputSeq>${departureMapSeq});})()`);
    await checkpoint(cdp,'13-march-order-ack');
    await action(cdp,'end-strategy-once','BayeHdCityMenu.goStrategyEnd()');
    await waitFor(cdp,'explicit strategy request accepted','BayeHdCityMenu.debugSnapshot().handoff || baye.hd.fight().active');
    await waitFor(cdp,'real battle player selection','baye.hd.fight().active && !baye.hd.fight().over && baye.hd.fight().inputKind===1',60000);
    await checkpoint(cdp,'14-battle-ready');
    await battleSmoke(cdp);
}

const battleStateExpression=`(() => {
    const d=baye.data, read=(o)=>Object.fromEntries((o._baye_properties||[]).map(k=>[k,o[k]]));
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);
        if(id>0 && id<0xfffe) units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',...read(d.g_GenPos[i]),arms:Number(d.g_Persons[id-1].Arms),armType:baye.hd.personArmType(id-1),terrain:baye.getTerrainByGeneralIndex(i)});
    }
    return {fight:baye.hd.fight(),units,weather:Number(d.g_FgtWeather),food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender),knownEnemy:Number(d.g_EneTmpProv)}};
})()`;

async function waitBattle(cdp,kind,label,timeout=20000) {
    return waitFor(cdp,label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return f.active&&!f.over&&f.inputKind===${kind}&&!s.transaction&&f;})()`,timeout);
}
const moveTilesExpression=`(() => {
    const d=baye.data,f=baye.hd.fight(),out=[];
    const sx=Number(d.g_PathSX),sy=Number(d.g_PathSY),ux=Number(d.g_PUseSX),uy=Number(d.g_PUseSY);
    for(let y=0;y<Number(d.g_MapHgt);y++)for(let x=0;x<Number(d.g_MapWid);x++) {
        const px=(x-sx+ux)&255,py=(y-sy+uy)&255;
        if(px<15&&py<15){const v=Number(d.g_FightPath[py*15+px]);if(Number.isInteger(v)&&v>=0&&v<=128)out.push({x,y});}
    }
    return out;
})()`;
async function chooseGeneral(cdp,unit) {
    const selected=await action(cdp,'select-'+unit.name,`BayeHdBattle.clickUnitByName(${JSON.stringify(unit.name)})`);
    assert.equal(selected.ok,true);
    return waitFor(cdp,'selected general movement or direct action',`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot();return !s.transaction&&(f.inputKind===2||f.inputKind===3)&&f.actorIndex===${unit.i}&&f;})()`);
}
async function menuChoice(cdp,name,kind) {
    const result=await action(cdp,'choose-'+name,`BayeHdBattle.pickMenuName(${JSON.stringify(name)})`);
    assert.equal(result.ok,true,'actual menu choice '+name);
    if(kind) await waitBattle(cdp,kind,'menu choice '+name);
}

const rangedUnitsExpression=`(() => {
    const d=baye.data,r=d.g_FgtAtkRng,size=Number(r[0]),sx=Number(r[1]),sy=Number(r[2]);
    const units=[];
    for(let i=0;i<20;i++) {
        const id=Number(d.g_FgtParam.GenArray[i]);if(!id||id>=0xfffe)continue;
        const p=d.g_GenPos[i],x=Number(p.x),y=Number(p.y),dx=(x-sx)&255,dy=(y-sy)&255;
        if(p.state===8||dx<0||dy<0||dx>=size||dy>=size||Number(r[3+dx+dy*size])!==1)continue;
        units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x,y,arms:Number(d.g_Persons[id-1].Arms),terrain:baye.getTerrainByGeneralIndex(i),armType:baye.hd.personArmType(id-1)});
    }
    return units;
})()`;
const numericOwnerExpression=`(() => {const a=baye.hd.attack(),s=baye.hd.spe();return a.active&&a.sourceValid&&a.display&&a.display.valid&&a.display.digits.length&&s.active===0&&(a.phase==='numbers'||a.phase==='hold')&&{attack:a,spe:s};})()`;
const presentationStateExpression=`(() => {const a=baye.hd.attack(),s=baye.hd.spe(),ui=BayeHdSpe.debugSnapshot(),keys=window.__speEngineKeys.length;return {at:performance.now(),attack:a,spe:s,ui,keys,mode:BayeHdBattle.getMode(),hidden:document.hidden,width:innerWidth,height:innerHeight,fight:baye.hd.fight()};})()`;
function sameAttackOwner(state,owner) {assert.equal(state.attack.active,true);assert.equal(state.attack.generation,owner.generation);assert.equal(state.attack.session,owner.session);assert.equal(state.attack.hurt,owner.hurt);assert.equal(state.spe.active,0);}
async function exercisePresentation(cdp) {
    const numeric=await waitFor(cdp,'real independent numeric owner for '+scenario,numericOwnerExpression,30000),owner=numeric.attack;
    const before=await evaluate(cdp,presentationStateExpression);sameAttackOwner(before,owner);
    if(scenario==='classic'){
        const controls=await evaluate(cdp,`(() => {const before=${presentationStateExpression},native=JSON.stringify({attack:baye.hd.attack(),spe:baye.hd.spe()});window.__attackUiPhase='classic';const accepted=BayeHdSpe.useClassic();window.__r09CapturePresentation();const classic=${presentationStateExpression};BayeHdBattle.setMode('hd');BayeHdSpe.blit();window.__attackUiPhase='restored';window.__r09CapturePresentation();const restored=${presentationStateExpression};window.__attackUiPhase='normal';return {accepted,before,classic,restored,nativeBefore:native,nativeAfter:JSON.stringify({attack:baye.hd.attack(),spe:baye.hd.spe()})};})()`);
        assert.equal(controls.accepted,true);sameAttackOwner(controls.classic,owner);sameAttackOwner(controls.restored,owner);assert.equal(controls.classic.ui.open,false);assert.equal(controls.restored.ui.open,true);assert.equal(controls.restored.ui.source,'hd-assets');assert.equal(controls.nativeBefore,controls.nativeAfter,'Synchronous public mode actions do not change native attack/SPE metadata');assert.equal(controls.restored.keys,controls.before.keys);
        report.presentationControls={scenario,owner,zeroNativeKeys:true,...controls};
    }else if(scenario==='resize'){
        const other=viewport.width===1920?{width:1280,height:720}:{width:1920,height:1080};
        await cdp.send('Emulation.setDeviceMetricsOverride',{...other,deviceScaleFactor:1,mobile:false});
        const changed=await evaluate(cdp,`window.__attackUiPhase='resized';BayeHdSpe.blit();window.__r09CapturePresentation();${presentationStateExpression}`);sameAttackOwner(changed,owner);assert.equal(changed.width,other.width);assert.equal(changed.height,other.height);assert.equal(changed.ui.open,true);assert.equal(changed.ui.source,'hd-assets');assert.equal(changed.keys,before.keys);
        await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});
        const restored=await evaluate(cdp,`window.__attackUiPhase='restored';BayeHdSpe.blit();window.__r09CapturePresentation();const result=${presentationStateExpression};window.__attackUiPhase='normal';result;`);sameAttackOwner(restored,owner);assert.equal(restored.keys,before.keys);assert.equal(restored.ui.open,true);assert.equal(restored.ui.source,'hd-assets');assert.equal(restored.width,viewport.width);assert.equal(restored.height,viewport.height);
        report.presentationControls={scenario,owner,before,changed,restored,zeroNativeKeys:true};
    }else if(scenario==='hidden'){
        const target=await cdp.send('Target.getTargetInfo'),other=await cdp.send('Target.createTarget',{url:'about:blank'});let method='actual-private-tab-activation';
        try{
            await cdp.send('Target.activateTarget',{targetId:other.targetId});
            if(!await evaluate(cdp,'document.hidden')){method='explicit-document-visibility-presentation-simulation';await evaluate(cdp,`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));`);}
            const hidden=await evaluate(cdp,`window.__attackUiPhase='hidden';BayeHdSpe.blit();window.__r09CapturePresentation();${presentationStateExpression}`);sameAttackOwner(hidden,owner);assert.equal(hidden.hidden,true);assert.equal(hidden.ui.open,false);assert.equal(hidden.keys,before.keys);
            await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await delay(80);await cdp.send('Page.setWebLifecycleState',{state:'active'});await cdp.send('Target.activateTarget',{targetId:target.targetInfo.targetId});
            if(method==='explicit-document-visibility-presentation-simulation')await evaluate(cdp,`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));`);
            const restored=await evaluate(cdp,`window.__attackUiPhase='restored';BayeHdSpe.blit();window.__r09CapturePresentation();const result=${presentationStateExpression};window.__attackUiPhase='normal';result;`);sameAttackOwner(restored,owner);assert.equal(restored.hidden,false);assert.equal(restored.ui.open,true);assert.equal(restored.ui.source,'hd-assets');assert.equal(restored.keys,before.keys);
            assert.deepEqual(await evaluate(cdp,'window.__allAttackDraws.filter(op=>op.hidden)'),[],'No HD canvas image draw occurs while document is hidden');
            report.presentationControls={scenario,method,realLifecycleFreeze:true,owner,before,hidden,restored,zeroNativeKeys:true};
        }finally{await cdp.send('Page.setWebLifecycleState',{state:'active'}).catch(()=>{});await evaluate(cdp,`if(Object.prototype.hasOwnProperty.call(document,'hidden')){delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}window.__attackUiPhase='normal';`).catch(()=>{});await cdp.send('Target.closeTarget',{targetId:other.targetId}).catch(()=>{});}
    }
}
async function endArmyTurn(cdp) {
    const before=await evaluate(cdp,battleStateExpression);
    await action(cdp,'explicit-end-turn-system','BayeHdBattle.openSystemMenu()');
    await waitBattle(cdp,6,'end-turn actual system menu');
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name);
    await waitActionResolved(cdp,'enemy turn followed by next player input',before.fight.bout);
    const after=await evaluate(cdp,battleStateExpression);
    if(after.fight.over) {
        report.turns??=[];report.turns.push({before,after,ended:true});
        await checkpoint(cdp,'28-real-battle-ended-'+report.turns.length);
        return;
    }
    assert.equal(after.fight.bout,before.fight.bout+1,'one end-turn advances exactly one engine bout');
    await delay(1200);
    const paused=await evaluate(cdp,battleStateExpression);
    assert.deepEqual(paused,after,'returning to player input does not trigger a second enemy turn');
    report.turns??=[];report.turns.push({before,after,paused});
    await checkpoint(cdp,'28-explicit-end-turn-'+report.turns.length);
}
async function attemptAttack(cdp,actor) {
    if(!requestedActor(actor))return false;
    const name=await evaluate(cdp,'baye.hd.menuItems().names[0]');
    await menuChoice(cdp,name,5);
    const inRange=await evaluate(cdp,rangedUnitsExpression);
    const targets=inRange.filter(u=>u.side==='enemy'&&u.arms>0&&requestedTarget(u));
    if(!targets.length) {await action(cdp,'cancel-attack-no-target','BayeHdBattle.cancel()');await waitBattle(cdp,3,'return from unavailable attack');return false;}
    const target=targets.sort((a,b)=>a.arms-b.arms)[0],before=await evaluate(cdp,battleStateExpression);
    const actualActor=before.units.find(u=>u.i===actor.i);
    assert.ok(actualActor&&requestedActor(actualActor),'Selected attacker still has the actual effective native arms for this interval');
    assert.ok(requestedTarget(target),'Target native terrain and effective arms map to the exact requested caller interval');
    report.attackPlanning??=[];report.attackPlanning.push({requested:acceptedRange,actor:actualActor,target,nativeInRange:inRange});
    const result=await action(cdp,'confirm-attack-'+target.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);assert.equal(result.ok,true);
    if(['classic','hidden','resize'].includes(scenario))await exercisePresentation(cdp);
    await waitActionResolved(cdp,'actual attack resolves');
    const after=await evaluate(cdp,battleStateExpression),enemy=after.units.find(u=>u.i===target.i);
    assert.ok(!enemy||enemy.arms<target.arms,'confirmed normal attack reduces actual enemy troops');
    report.attackCost={actor:actor.name,actorIndex:actor.i,target:target.name,targetIndex:target.i,before,after};
    await checkpoint(cdp,'29-attack-real-troop-cost');
    return true;
}

async function waitActionResolved(cdp,label,afterBout=null) {
    const deadline=Date.now()+60000,accepted=new Set();
    while(Date.now()<deadline) {
        const s=await evaluate(cdp,'({f:baye.hd.fight(),s:baye.hd.spe(),b:BayeHdBattle.debugSnapshot(),d:BayeHdDialog.debugSnapshot()})');
        if(s.f.over||(!s.b.transaction&&s.f.inputKind===1&&!s.s.active&&(afterBout==null||s.f.bout>afterBout)))return s.f;
        // Only an actual waiting report owner permits this explicit player ACK.
        if(s.d.open&&s.d.kind==='report'&&s.d.reportOwner) {
            const owner=JSON.stringify(s.d.reportOwner);
            if(!accepted.has(owner)) {accepted.add(owner);await click(cdp,'#hd-dialog [data-hd-dlg-ok]');}
        }
        await delay(150);
    }
    throw new Error('Timeout: '+label);
}

async function battleSmoke(cdp) {
    report.combatStart=await evaluate(cdp,battleStateExpression);
    if(recruit) {
        const actor=report.combatStart.units.find(u=>u.id===report.recruitment.attackerNativeGenId);
        assert.ok(actor&&actor.side==='player','Actual GenArray contains the equipped marcher using personIndex+1');
        assert.equal(actor.arms,report.recruitment.distribution.wanted,'Actual battle starts with the legitimately distributed troops');
        assert.ok(requestedActor(actor));report.recruitment.battleActor=actor;
    }
    // Keep the 100-troop lord at his actual starting tile. The existing battle
    // acceptance uses this same legal rest before approaching with other units.
    const lord=report.combatStart.units.find(u=>u.i===0);
    await chooseGeneral(cdp,lord);
    assert.equal((await action(cdp,'protect-lord-stay-native-tile',`BayeHdBattle.clickTile(${lord.x},${lord.y})`)).ok,true);
    await waitBattle(cdp,3,'lord stays at actual starting tile');
    await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
    // Read-only native masks choose legal targets; every command is a public UI
    // operation a player can issue. No engine fields or private movies are written.
    for(let step=0;step<36;step++) {
        const evidence=await collectSpe(cdp);
        if(report.attackCost)break;
        const current=await evaluate(cdp,battleStateExpression);
        if(recruit)assert.ok(current.units.some(u=>u.id===report.recruitment.attackerNativeGenId&&u.state!==8&&u.arms>0),'The equipped actual attacker survived; a death is not replaced or repaired');
        if(current.fight.over)break;
        const actor=current.units.filter(u=>u.side==='player'&&u.active===0&&![8,1,6].includes(u.state)&&u.arms>0)
            .sort((a,b)=>(recruit?Number(b.id===report.recruitment.attackerNativeGenId)-Number(a.id===report.recruitment.attackerNativeGenId):0)||Number(!requestedActor(a))-Number(!requestedActor(b))||Number(a.i===0)-Number(b.i===0)||a.i-b.i)[0];
        if(!actor) {
            if((report.turns?.length||0)>=4)break;
            await endArmyTurn(cdp);continue;
        }
        const selection=await chooseGeneral(cdp,actor);
        if(selection.inputKind===2) {
            if(actor.i===0||!requestedActor(actor)||recruit&&actor.id!==report.recruitment.attackerNativeGenId) {
                assert.equal((await action(cdp,actor.i===0?'keep-lord-protected':'keep-nonmatching-unit-at-native-tile',`BayeHdBattle.clickTile(${actor.x},${actor.y})`)).ok,true);
                await waitBattle(cdp,3,'lord action menu');
                await menuChoice(cdp,await evaluate(cdp,'baye.hd.menuItems().names[3]'),1);
                continue;
            }
            const candidates=await evaluate(cdp,moveTilesExpression),enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0&&requestedTarget(u));
            assert.ok(enemies.length,'An actual living enemy matches the requested native caller interval; no alternate range is substituted');
            const distance=p=>Math.min(...enemies.map(u=>Math.abs(p.x-u.x)+Math.abs(p.y-u.y)));
            const target=candidates.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.x===p.x&&u.y===p.y&&u.state!==8)).sort((a,b)=>distance(a)-distance(b))[0];
            assert.ok(target,'A genuinely legal unoccupied move tile exists');
            const moved=await action(cdp,'approach-native-path-'+actor.name,`BayeHdBattle.clickTile(${target.x},${target.y})`);
            assert.equal(moved.ok,true);await waitBattle(cdp,3,'native action menu after movement');
        }
        if(!report.attackCost&&await attemptAttack(cdp,actor))continue;
        // Baseline only executes ordinary attacks/rests; no skill action is substituted.
        const rest=await evaluate(cdp,'baye.hd.menuItems().names[3]');await menuChoice(cdp,rest,1);
    }
    const evidence=await collectSpe(cdp),displayed=assertDisplayRecords(evidence.samples);
    const actualAttacks=displayed.filter(r=>r.spe.kind===3&&r.spe.contextKnown&&Number.isInteger(r.spe.actorIndex)&&Number.isInteger(r.spe.targetIndex));
    const first=report.attackCost?actualAttacks.find(r=>r.spe.actorIndex===report.attackCost.actorIndex&&r.spe.targetIndex===report.attackCost.targetIndex):actualAttacks[0];
    assert.ok(first,'A real player or naturally acting enemy attack produced an authoritative SPE event');
    const attack=actualAttacks.filter(r=>r.spe.generation===first.spe.generation&&r.spe.eventId===first.spe.eventId);
    assert.ok(attack.length>=2,'The actual attack produced multiple displayed SPE frames');
    const attackEvent=attack[0].spe.eventId;
    assert.ok(new Set(attack.map(r=>r.spe.display.commitSeq)).size>=2,'Attack displayed distinct native commits');
    assert.ok(evidence.samples.some(r=>r.spe.lastEnd.eventId===attackEvent),'Actual attack event has an observed end');
    assert.ok(!await evaluate(cdp,'BayeHdSpe.isOpen()'),'Combat SPE overlay is retired after the actual event');
    assert.deepEqual(evidence.keys.filter(k=>k.speActive&&[2,3].includes(k.kind)),[],'Battle presentation delivers zero automatic or skip keys');
    assert.deepEqual(evidence.keys.filter(k=>k.attackActive),[],'Independent numeric/hold owner sends no extra or skip keys');
    assert.equal(await evaluate(cdp,'baye.hd.attack().active'),false,'Actual native attack wait has ended before returning to player selection');
    assert.ok(displayed.filter(r=>[2,3].includes(r.spe.kind)).every(r=>!r.spe.skipEligible&&!r.ui.skipVisible),'Unskippable combat events have no player skip control');
    report.attackSpe={eventId:attackEvent,actorIndex:first.spe.actorIndex,targetIndex:first.spe.targetIndex,
        actorSide:first.spe.actorIndex<10?'player':'enemy',playerTroopCostVerified:!!report.attackCost,
        displayedCommits:attack.length,source:[...new Set(attack.map(r=>r.ui.source))]};
    report.combatEnd=await evaluate(cdp,battleStateExpression);
    await checkpoint(cdp,'31-real-combat-spe-evidence');
}
async function saveRawEvidence(cdp) {
    const raw=await evaluate(cdp,'({captures:window.__attackImages||[],inputs:window.__speEngineKeys||[],samples:window.__speSamples||[],errors:window.__speObserverErrors||[],draws:window.__allAttackDraws||[]})');
    report.attackCanvasImages=[];
    for(let i=0;i<raw.captures.length;i++){
        const c=raw.captures[i],event=c.attack?.display?.eventId||c.lastAttack?.eventId||0;
        for(const key of ['native','hd']){const url=c[key+'Url'];if(!url)continue;const data=Buffer.from(url.split(',')[1],'base64'),name='attack-'+String(i).padStart(4,'0')+'-event'+event+'-'+c.stage+'-'+key+'.png';fs.writeFileSync(path.join(artifactDir,name),data);c[key+'File']={file:name,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};delete c[key+'Url'];}
        report.attackCanvasImages.push(c);
    }
    report.engineInputs=raw.inputs;report.speObservations=raw.samples;report.observerErrors=raw.errors;report.actualImageDraws=raw.draws;
    for(const [name,value]of [['native-display-captures',report.attackCanvasImages],['spe-observations',raw.samples],['engine-inputs',raw.inputs],['observer-errors',raw.errors],['actual-image-draws',raw.draws]])fs.writeFileSync(path.join(artifactDir,name+'.json'),JSON.stringify(value,null,2)+'\n');
    return report.attackCanvasImages;
}
async function finishScenario(cdp) {
    if(failedImages){assert.ok(report.requests.some(r=>r.url==='/'+controlledImage&&r.controlled&&(scenario==='404'?r.status===404:r.status==='held')),'Real controlled mandatory image request was exercised');}
    if(scenario==='late'){
        const before=await evaluate(cdp,presentationStateExpression);assert.equal(before.attack.active,false);assert.equal(before.spe.active,0);assert.equal(before.ui.open,false);
        releaseImages();
        await waitFor(cdp,'real late HTTP image response after the native owner ended',`performance.getEntriesByName(location.origin+'/'+${JSON.stringify(controlledImage)}).some(entry=>entry.responseEnd>0)`,20000);
        await delay(350);
        const after=await evaluate(cdp,presentationStateExpression);assert.equal(after.attack.active,false);assert.equal(after.spe.active,0);assert.equal(after.ui.open,false);assert.equal(after.keys,before.keys);assert.equal(after.fight.inputSeq,before.fight.inputSeq);assert.equal(after.fight.inputKind,before.fight.inputKind);
        assert.deepEqual(await evaluate(cdp,`window.__allAttackDraws.filter(op=>op.at>${before.at})`),[],'Late PNG cannot paint into a returned or newer native owner');
        report.lateImage={before,after,response:report.requests.filter(r=>r.url==='/'+controlledImage),zeroNativeKeys:true,oldOwnerNotRevived:true};
        await checkpoint(cdp,'32-late-http-image-owner-still-retired');
    }
    if(['classic','hidden','resize'].includes(scenario))assert.ok(report.presentationControls,'The requested UI scenario ran under the actual numeric owner');
}
async function main() {
    assert.ok(!fs.existsSync(path.join(artifactDir,'result.json')),'Preserve existing evidence: choose a new artifact directory');
    fs.mkdirSync(artifactDir, { recursive: true });
    let server, chrome, cdp, chromeError,profile;
    const interrupt = () => {
        report.interrupted = true;
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) chrome.kill('SIGTERM');
        if (server) server.closeAllConnections();
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
        prepareServedAssets();
        if (typeof WebSocket !== 'function') throw new Error('Node 22+ is required for built-in WebSocket');
        profile=fs.mkdtempSync(path.join(os.tmpdir(), 'baye-attack-runtime-'));
        server = await startServer();
        const origin = 'http://127.0.0.1:' + server.address().port;
        const debugPort = await unusedPort();
        assert.notEqual(server.address().port,8080);assert.notEqual(debugPort,8080);
        report.isolation={user8080Touched:false,profile,origin,debugPort};
        const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
        const binary = process.env.CHROME || candidates.find((filename) => fs.existsSync(filename));
        assert.ok(binary, 'Set CHROME to a Chromium/Chrome executable');
        chrome = spawn(binary, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
            '--disable-background-networking', '--window-size='+viewport.width+','+viewport.height, '--remote-debugging-port=' + debugPort,
            '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
        chrome.on('error', (error) => { chromeError = error; });
        let target;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (chromeError) throw chromeError;
            if (chrome.exitCode !== null) throw new Error('Chrome exited with ' + chrome.exitCode);
            try {
                const list = await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) }).then((res) => res.json());
                target = list.find((item) => item.type === 'page');
                if (target) break;
            } catch {}
            await delay(100);
        }
        assert.ok(target, 'Chrome DevTools started');
        report.browser=await fetch('http://127.0.0.1:'+debugPort+'/json/version').then(r=>r.json());
        cdp = await connectCdp(target.webSocketDebuggerUrl);
        cdp.on('Runtime.consoleAPICalled', (event) => {
            report.console.push({ type: event.type, text: event.args.map((arg) => arg.value ?? arg.description ?? '').join(' ') });
        });
        cdp.on('Runtime.exceptionThrown', (event) => report.exceptions.push(event.exceptionDetails));
        cdp.on('Page.javascriptDialogOpening', (event) => {
            report.dialogs.push(event.message);
            cdp.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
        });
        cdp.on('Fetch.requestPaused', (event) => {
            const local = new URL(event.request.url).origin === origin;
            if (!local) report.blocked.push(event.request.url);
            cdp.send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? { requestId: event.requestId } :
                { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
        });
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
            localStorage.clear();
            localStorage.setItem('baye/libpath', 'libs/dat-mod.lib');
            localStorage.setItem('baye/overworldMode', 'classic');
            localStorage.setItem('baye/systemUiMode', 'hd');
            localStorage.setItem('baye/cityMenuMode', 'classic');
        ` });
        await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: speObserverSource });
        await cdp.send('Page.navigate', { url: origin + '/pc.html' });
        await smoke(cdp);
        await finishScenario(cdp);
        const captures=await saveRawEvidence(cdp);
        verifyAttackCaptures(captures);
        assertDisplayRecords(report.speObservations);
        assert.deepEqual(report.observerErrors, [], 'Read-only observer has no errors');
        assert.deepEqual(report.exceptions, [], 'browser has no uncaught exceptions');
        assert.deepEqual(report.dialogs, [], 'game boot has no unexpected alert dialogs');
        report.scenarioAccepted=true;
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = error.stack || String(error);
        if (cdp) {
            try { report.failureState = await evaluate(cdp, snapshotExpression);report.engineInputs=await evaluate(cdp,'window.__speEngineKeys');report.speObservations=await evaluate(cdp,'window.__speSamples'); } catch {}
            try { await saveRawEvidence(cdp); } catch(e) { report.evidenceError=e.stack||String(e); }
            try {
                const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                fs.writeFileSync(path.join(artifactDir, 'failure.png'), Buffer.from(screenshot.data, 'base64'));
            } catch {}
        }
        console.error(report.error);
        process.exitCode = 1;
    } finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
        if (cdp) cdp.close();
        if (chrome && chrome.exitCode === null) {
            const stopped = new Promise((resolve) => chrome.once('exit', resolve));
            chrome.kill('SIGTERM');
            await Promise.race([stopped, delay(1500)]);
            if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([stopped, delay(1500)]); }
        }
        releaseImages();
        if (server) await new Promise((resolve) => server.close(resolve));
        if(profile){assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()), 'Temporary profile stays in the OS temp directory');assert.ok(path.basename(profile).startsWith('baye-attack-runtime-'), 'Cleanup targets only this task profile');try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch(e){report.ok=false;report.cleanupError=e.stack||String(e);process.exitCode=1;}}
        const drift=[];for(const [name,m]of Object.entries(report.sources||{})){const f=path.join(root,m.source);if(!fs.existsSync(f)){drift.push({name,missing:true});continue;}const hash=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');if(hash!==m.sha256)drift.push({name,before:m.sha256,after:hash});}
        report.sourceVerification={count:Object.keys(report.sources||{}).length,drift,runnerMatch:!!report.tool&&crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')===report.tool.sha256};
        if(drift.length||!report.sourceVerification.runnerMatch){report.ok=false;report.freezeFailure='Frozen source or runner changed during acceptance';process.exitCode=1;}
        report.isolation={...report.isolation,user8080Touched:false,profile:profile||null,cleaned:!profile||!fs.existsSync(profile)};
        report.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(artifactDir, 'source-verification.json'), JSON.stringify(report.sourceVerification,null,2)+'\n');
        fs.writeFileSync(path.join(artifactDir, 'browser-console.json'), JSON.stringify({console:report.console,exceptions:report.exceptions,dialogs:report.dialogs},null,2)+'\n');
        fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        console.log('Artifacts:', artifactDir);
        if (report.ok) console.log(allowLcd||failedImages?'Real native attack/LCD fallback acceptance passed; this scene does not accept HD art':'Real observed attack interval HD acceptance passed');
    }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
