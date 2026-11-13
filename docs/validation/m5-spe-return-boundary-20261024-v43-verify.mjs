// Read-only V43 publication: exact original bytes and saved browser facts only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,inflateSync} from 'node:zlib';
const P='docs/validation/m5-spe-return-boundary-20261024-v43',B='build/impact-skill-20261014/';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const pin=p=>{const b=read(p);return{path:p,bytes:b.length,sha256:sha(b)};},check=p=>assert.deepEqual(pin(p.path),{path:p.path,bytes:p.bytes,sha256:p.sha256});
function stats(s){s=s.replace(/\x1b\[[0-9;]*m/g,'');return Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(k=>{const a=[...s.matchAll(new RegExp('(?:^|\\n)(?:#|ℹ) '+k+' (\\d+)(?:\\r?\\n|$)','g'))];assert.equal(a.length,1,'Unique raw summary '+k);return[k,+a[0][1]];}));}
const counts=n=>({tests:n,pass:n,fail:0,cancelled:0,skipped:0,todo:0});
const C=json(P+'.json'),V=json(P+'-verification.json');
assert.equal(V.accepted,true);[V.canonical,V.markdown,V.reader,V.archive].forEach(check);assert.deepEqual(C.archive,V.archive);
const A=json(C.archive.path);assert.deepEqual(A.bounds,{maximumRecords:160,singleFileBytes:16*1048576,rawPayloadBytes:64*1048576,gzipBytes:8*1048576,fullLogBytes:8*1048576});
[A.rawBundle,A.fullLogGzip].forEach(check);assert.ok(A.rawBundle.bytes<=A.bounds.gzipBytes&&A.fullLogGzip.bytes<=A.bounds.gzipBytes);
const raw=gunzipSync(read(A.rawBundle.path),{maxOutputLength:A.bounds.rawPayloadBytes});assert.deepEqual([raw.length,sha(raw)],[A.rawPayload.bytes,A.rawPayload.sha256]);
const bundle=JSON.parse(raw),records=new Map();assert.equal(bundle.encoding,'exact-original-base64-records');assert.ok(bundle.files.length<=A.bounds.maximumRecords);
for(const f of bundle.files){assert.ok(typeof f.path==='string'&&!/^(?:\/|[a-z]:)/i.test(f.path)&&!f.path.split('/').includes('..')&&!records.has(f.path));assert.ok(Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=A.bounds.singleFileBytes);const b=Buffer.from(f.base64,'base64');assert.equal(b.toString('base64'),f.base64);assert.deepEqual([b.length,sha(b)],[f.bytes,f.sha256]);records.set(f.path,b);}
assert.equal(records.size,A.files.length);const named=new Set();for(const f of A.files){assert.ok(!named.has(f.path));named.add(f.path);assert.ok(records.has(f.path));assert.deepEqual([records.get(f.path).length,sha(records.get(f.path))],[f.bytes,f.sha256]);}
const archived=p=>{const b=records.get(typeof p==='string'?p:p.path);assert.ok(b,'Exact archived file '+(p.path||p));if(typeof p!=='string')assert.deepEqual([b.length,sha(b)],[p.bytes,p.sha256]);return b;};
const saved=p=>JSON.parse(archived(p));
const beforePath=B+'viewport-maker-before-resize-v2/',afterPath=B+'viewport-maker-after-resize-v1/';
const before=saved(beforePath+'result.json'),after=saved(afterPath+'result.json');
const lock=saved(B+'viewport-maker-before-resize-independent-v1/source-lock.json');
assert.equal(lock.sourceCount,81);assert.equal(lock.allCurrentBytesExactAtLock,true);assert.deepEqual(lock.sources,before.sources);archived(lock.result);
for(const c of lock.criticalCopies){const b=archived(c.copy);assert.deepEqual([b.length,sha(b)],[c.original.bytes,c.original.sha256]);}
const comparison=saved(C.independentComparison);assert.equal(comparison.accepted,true);assert.equal(comparison.sourceBoundary.sourceCount,81);assert.equal(comparison.sourceBoundary.sameAcrossRuns,79);
for(const c of comparison.sourceBoundary.criticalCopies){const b=archived(c.copy);assert.deepEqual([b.length,sha(b)],[c.original.bytes,c.original.sha256]);}
const oldSource=archived(beforePath+'executed-hd-spe.js'),newSource=archived(afterPath+'executed-hd-spe.js');
assert.equal(sha(oldSource),'87f75a370068751352dfec8ebbf47712c28a4bf2f1109d34cf12871250743c3f');
assert.deepEqual(newSource,archived('js/hd-spe.js'));check(C.changedSources.find(p=>p.path==='js/hd-spe.js'));
let start=0;while(start<oldSource.length&&oldSource[start]===newSource[start])start++;
let tail=0;while(tail<oldSource.length-start&&oldSource[oldSource.length-tail-1]===newSource[newSource.length-tail-1])tail++;
assert.equal(oldSource.length-start-tail,0);const added=newSource.subarray(start,newSource.length-tail).toString();assert.equal(Buffer.byteLength(added),652);
assert.match(added,/function cancelReturnPress\(\) \{ state\.pressed = null; \}/);assert.ok(!/state\.(epoch|returned|open)\s*=|sendKey|returnToTitle\(/.test(added));
const oldPc=archived(B+'viewport-maker-before-resize-independent-v1/pc.html').toString();
assert.equal(archived('pc.html').toString(),oldPc.replace('js/hd-spe.js?ver=20261014a','js/hd-spe.js?ver=20261024a'));
assert.deepEqual(archived(beforePath+'executed-tool.mjs'),archived(afterPath+'executed-tool.mjs'));assert.deepEqual(archived(beforePath+'executed-scenario.mjs'),archived(afterPath+'executed-scenario.mjs'));
for(const [r,dir] of [[before,beforePath],[after,afterPath]]){
  assert.equal(r.ok,true);assert.equal(r.boundary,'resize');assert.equal(r.sources.length,81);assert.equal(new Set(r.sources.map(p=>p.path)).size,81);
  for(const p of r.sources){let bytes;if(dir===beforePath&&p.path==='js/hd-spe.js')bytes=oldSource;else if(dir===beforePath&&p.path==='pc.html')bytes=Buffer.from(oldPc);else bytes=read(p.path);assert.deepEqual([bytes.length,sha(bytes)],[p.bytes,p.sha256],'Reconstruct exact served source '+p.path);}
  for(const [name,pattern] of [['executed-tool.mjs',/\/run-maker-boundary-v2\.mjs$/],['executed-scenario.mjs',/\/maker-held-browser-boundary-v2\.mjs$/],['executed-hd-spe.js',/^js\/hd-spe\.js$/]]){const p=r.sources.find(p=>pattern.test(p.path));assert.ok(p);const bytes=archived(dir+name);assert.deepEqual([bytes.length,sha(bytes)],[p.bytes,p.sha256],'Actual execution copy bound to served source vector');}
  for(const q of r.requests){assert.equal(q.status,200);assert.deepEqual({path:q.path,bytes:q.bytes,sha256:q.sha256},r.sources.find(p=>p.path===q.path));}
  assert.deepEqual(r.exceptions,[]);assert.equal(r.newEND,0);assert.equal(r.newBuy,0);assert.equal(r.newBattle,0);assert.equal(r.actualWoodAidLifecycleAccepted,false);assert.equal(r.globalHdComplete,false);
  const q=r.result,a=q.observation,e=saved(dir+'observer.json'),native=s=>Object.fromEntries(['maker','spe','menu','qty','record','report','fight'].map(k=>[k,s[k]]));
  assert.deepEqual(a.before.viewport,{width:1920,height:1080,dpr:1});assert.deepEqual(a.releaseState.viewport,{width:1280,height:720,dpr:1});
  for(const n of ['before','pressed','changed','releaseState']){assert.deepEqual(native(a[n]),native(a.before));assert.equal(a[n].ui.ownerToken,a.before.ui.ownerToken);assert.equal(a[n].keys,5);assert.equal(a[n].ownHidden,false);assert.equal(a[n].ownVisibilityState,false);assert.equal(a[n].hidden,false);}
  const down=a.events.find(x=>x.type==='pointerdown'),resize=a.events.find(x=>x.type==='resize'),up=a.events.find(x=>x.type==='pointerup'),click=a.events.find(x=>x.type==='click');
  for(const x of [down,resize,up,click]){assert.ok(x);assert.equal(x.trusted,true);assert.equal(x.state.keys,5);assert.deepEqual(native(x.state),native(a.before));}
  for(const x of [down,up,click]){assert.equal(x.target,'hd-spe-return');assert.equal(x.pointerId,1);assert.equal(x.button,0);}
  assert.ok(down.state.at<resize.state.at&&resize.state.at<up.state.at&&up.state.at<click.state.at);assert.equal(click.detail,1);
  assert.deepEqual(e.keys.map(k=>k.code),[39,35,35,39,39,39]);
  for(const [i,n] of q.navigationReceipts.entries()){for(const [s,index] of [[n.before,i],[n.after,i+1]]){assert.equal(s.menu.index,index);assert.equal(s.menu.context,4);assert.equal(s.menu.kind,1);assert.equal(s.system.pending,false);for(const k of ['seq','context','kind','count','index'])assert.equal(s.system.input[k],s.menu[k]);}assert.deepEqual(n.keys.map(k=>k.code),[35]);assert.deepEqual(n.keys,e.keys.slice(n.before.keys,n.after.keys));}
  const last=q.stages.find(x=>x.label==='title-after-maker').state;assert.equal(last.menu.active,1);assert.equal(last.menu.context,4);assert.equal(last.menu.kind,1);assert.equal(last.keys,6);assert.equal(last.maker.active,false);
  for(const s of q.stages)assert.deepEqual(saved(dir+s.label+'.json'),s.state);
  if(dir===beforePath){assert.deepEqual(a.keys.map(k=>k.code),[39]);assert.equal(a.after.menu.active,1);assert.ok(a.keys[0].dispatchAt>click.state.at);}
  else{assert.deepEqual(a.keys,[]);assert.deepEqual(native(a.after),native(a.before));assert.equal(a.after.keys,5);assert.equal(a.after.ui.ownerToken,a.before.ui.ownerToken);const fresh=e.events.filter(x=>x.state.at>a.after.at&&x.target==='hd-spe-return'&&['pointerdown','pointerup','click'].includes(x.type));assert.deepEqual(fresh.map(x=>x.type),['pointerdown','pointerup','click']);for(const x of fresh){assert.equal(x.trusted,true);assert.deepEqual(native(x.state),native(a.before));}assert.ok(e.keys[5].dispatchAt>fresh[2].state.at);}
  const c=saved(dir+'cleanup.json');assert.deepEqual(r.cleanup,c);assert.equal(c.treeExited,true);assert.deepEqual(c.errors,[]);assert.equal(c.ownershipSnapshot.owned.length,10);assert.equal(c.recheck.absent.length,10);assert.deepEqual(c.recheck.targets,[]);assert.deepEqual(c.recheck.refused,[]);assert.deepEqual(c.exitVerification,{treeExited:true,survivingRecorded:[],rootDescendants:[],profileMatches:[]});assert.deepEqual(r.privateListeners,[]);assert.deepEqual(r.user8080After,saved(dir+'user8080-before.json'));assert.equal(r.profilePreserved,true);
}
function png(p){
  const b=archived(p);assert.deepEqual(b.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  const crc=bytes=>{let v=0xffffffff;for(const x of bytes){v^=x;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return(v^0xffffffff)>>>0;};let at=8,w,h,ended=false;const parts=[];
  while(at<b.length){const n=b.readUInt32BE(at),type=b.toString('ascii',at+4,at+8);assert.ok(at+12+n<=b.length);assert.equal(crc(b.subarray(at+4,at+8+n)),b.readUInt32BE(at+8+n));const d=b.subarray(at+8,at+8+n);if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);assert.equal(d[8],8);assert.equal(d[9],2);assert.deepEqual([...d.subarray(10)],[0,0,0]);}else if(type==='IDAT')parts.push(d);else if(type==='IEND'){assert.equal(n,0);ended=true;at+=12;break;}at+=12+n;}
  assert.ok(ended);assert.equal(at,b.length);const stride=w*3,data=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*h});assert.equal(data.length,(stride+1)*h);const rgb=Buffer.alloc(stride*h),paeth=(a,b,c)=>{const p=a+b-c,A=Math.abs(p-a),B=Math.abs(p-b),C=Math.abs(p-c);return A<=B&&A<=C?a:B<=C?b:c;};
  for(let y=0;y<h;y++){const f=data[y*(stride+1)];assert.ok(f<=4);for(let x=0;x<stride;x++){const a=x>=3?rgb[y*stride+x-3]:0,t=y?rgb[(y-1)*stride+x]:0,c=x>=3&&y?rgb[(y-1)*stride+x-3]:0;rgb[y*stride+x]=(data[y*(stride+1)+x+1]+(f===0?0:f===1?a:f===2?t:f===3?Math.floor((a+t)/2):paeth(a,t,c)))&255;}}
  return{width:w,height:h,decodedRgbSha256:sha(rgb)};
}
let pngCount=0;for(const f of A.files.filter(f=>f.path.endsWith('.png'))){const p=png(f);pngCount++;const proof=[...(saved(B+'viewport-maker-before-resize-independent-v1/review.json').screenshots),...comparison.screenshots].find(x=>x.path===f.path);if(proof)assert.deepEqual(p,{width:proof.width,height:proof.height,decodedRgbSha256:proof.decodedRgbSha256});}
const first=saved(B+'viewport-maker-before-resize-v1/result.json');assert.equal(first.ok,false);assert.match(first.error,/Timed out: actual title index 2/);
const refusal=saved(B+'viewport-maker-before-after-independent-v1/first-source-order-refusal.json');assert.equal(refusal.accepted,false);assert.equal(refusal.terminal.exitCode,1);assert.equal(refusal.rawModified,false);archived(refusal.tool);
const probe=saved(B+'viewport-spe-return-boundary-source-probe-v1.json');assert.equal(probe.cases,6);assert.equal(probe.actualBrowserRun,false);
const target=saved(B+'viewport-spe-return-boundary-patch-v1/target-receipt.json');assert.equal(target.baseline.results.length,5);assert.ok(target.baseline.results.every(r=>r.pass===false));assert.ok(target.patched.results.every(r=>r.pass===true));assert.equal(target.default307TestsExecuted,0);
assert.deepEqual(stats(archived(B+'viewport-spe-return-boundary-patch-v1/formal-before.stdout.log').toString()),{tests:5,pass:0,fail:5,cancelled:0,skipped:0,todo:0});assert.deepEqual(stats(archived(B+'viewport-spe-return-boundary-patch-v1/formal-after.stdout.log').toString()),counts(5));
assert.deepEqual(archived('scripts/test-hd-spe.mjs'),archived(B+'viewport-spe-return-boundary-patch-v1/test-hd-spe.candidate.mjs'));
const full=saved(C.full.receipt),fullBefore=saved(C.full.before);assert.equal(full.accepted,true);assert.equal(full.processExitCode,0);assert.equal(full.sourceBytesStable,true);assert.equal(full.registeredFiles,141);assert.deepEqual([full.tests,full.pass,full.fail,full.cancelled,full.skipped,full.todo],[7701,7701,0,0,0,0]);assert.equal(full.previousTests,7696);assert.equal(full.differentNewCases,5);assert.equal(full.sources.length,206);assert.deepEqual(full.sources,fullBefore.sources);assert.deepEqual(full.sources,C.currentSourcePins);full.sources.forEach(check);
assert.deepEqual(full.currentInput,C.currentOctoberReference.files);assert.deepEqual(full.currentInput,fullBefore.currentInput);for(const p of full.currentInput){check(p);archived(p);}assert.equal(C.currentOctoberReference.newMainInputPublished,false);
assert.deepEqual(full.stdout,A.fullLog);const log=gunzipSync(read(A.fullLogGzip.path),{maxOutputLength:A.bounds.fullLogBytes});assert.deepEqual([log.length,sha(log)],[A.fullLog.bytes,A.fullLog.sha256]);assert.deepEqual(stats(log.toString()),counts(7701));archived(C.full.stderr);
assert.deepEqual(C.counts,{registeredFiles:141,previousPass:7696,fullPass:7701,differentNewRegisteredCases:5,sourceProbeCases:6,sourceProbeExtraRegisteredCases:0,patchProbeCases:5,patchProbeExtraRegisteredCases:0});
assert.equal(C.acceptance.actualMakerResizeBoundary,true);for(const k of ['activeWoodAid','activeMovieResize','fullResizeMatrix','dprChange','realDevice','performance','newSave','globalHdComplete'])assert.equal(C.acceptance[k],false);
assert.equal(A.matchingCheckoutRequired,true);assert.equal(A.oldLargeArchivesTraversed,false);assert.equal(A.privateProfilesArchived,false);
console.log(JSON.stringify({accepted:true,readOnly:true,records:records.size,ordinaryPngDecoded:pngCount,servedSourceVectors:[81,81],matchingCurrentSources:206,beforeStaleReleaseKeys:[39],afterStaleReleaseKeys:[],freshClickKeys:[39],registeredFiles:141,fullPass:7701,differentNewRegisteredCases:5,actualMakerResizeBoundary:true,activeWoodAidAccepted:false,fullResizeMatrixAccepted:false,globalHdComplete:false}));
