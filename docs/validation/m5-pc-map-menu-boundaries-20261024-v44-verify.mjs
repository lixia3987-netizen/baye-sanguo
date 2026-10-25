/** V44 read-only bounded archive reader. Matching execution checkout required.
 * No process/browser/native input/cleanup operations. The raw review body below
 * is mechanically adapted from SHA3cbbd7aa...: archive-bound reads, no writes.
 */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {gunzipSync,inflateSync} from 'node:zlib';import {fileURLToPath,pathToFileURL} from 'node:url';
const P='docs/validation/m5-pc-map-menu-boundaries-20261024-v44',B='build/impact-skill-20261014/',D=B+'viewport-october-geometry-v1/';
const sha=b=>createHash('sha256').update(b).digest('hex'),MAX_PART=8*1024*1024,MAX_TOTAL=64*1024*1024;
const ARCHIVED_IGNORED_TOOLS=new Set(['run-october-geometry-v3.mjs','october-public-load-geometry-v3.mjs','maker-held-browser-boundary-v2.mjs','run-maker-boundary-v2.mjs','run-full-v1.mjs'].map(n=>B+'viewport-baseline-20261024-source-v1/'+n));
export function bindV44SourceBytes(p,expected,{archived,current}){
 assert.ok(expected&&expected.path===p);assert.ok(ARCHIVED_IGNORED_TOOLS.has(p),'Only five declared ignored tools may use archive binding');
 assert.ok(Buffer.isBuffer(archived),'Exact original-path tool bytes must be archived');assert.equal(archived.length,expected.bytes);assert.equal(sha(archived),expected.sha256);
 if(current!==null){assert.ok(Buffer.isBuffer(current));assert.ok(current.equals(archived),'Present tool source must match archive and execution pin');}
 return {bytes:archived,archivedFallback:current===null};
}
export function assertV44BlobBudget({physicalCount,decodedBytes,rawBytes,gzipBytes}){
 assert.ok(Number.isInteger(physicalCount)&&physicalCount>=0&&physicalCount<256,'Physical blob count bound before inflate');
 assert.ok(Number.isInteger(rawBytes)&&rawBytes>=0&&rawBytes<=32*1024*1024);
 assert.ok(Number.isInteger(decodedBytes)&&decodedBytes>=0&&decodedBytes+rawBytes<=64*1024*1024,'Total raw bound before inflate');
 assert.ok(Number.isInteger(gzipBytes)&&gzipBytes>0&&gzipBytes<=MAX_PART);return decodedBytes+rawBytes;
}
function relative(p){assert.equal(typeof p,'string');assert.ok(p&&!path.isAbsolute(p)&&!p.includes('\\')&&!p.split('/').some(s=>s==='..'||s===''));return p;}
function local(root,p){relative(p);const file=path.resolve(root,p);assert.ok(file.startsWith(path.resolve(root)+path.sep));return file;}
function bounded(root,p,max){const file=local(root,p),n=fs.statSync(file).size;assert.ok(n>=0&&n<=max);const b=fs.readFileSync(file);assert.equal(b.length,n);return b;}
const ref=(p,b)=>({path:p,bytes:b.length,sha256:sha(b)});
export function decodeV44Archive(root,index){
 assert.equal(index.schemaVersion,1);assert.equal(index.encoding,'independent-gzip-base64-blobs');assert.ok(index.parts.length>0&&index.parts.length<=32);
 const blobs=new Map(),files=new Map();let total=0,decodedBytes=0;
 for(const part of index.parts){const b=bounded(root,part.path,MAX_PART);total+=b.length;assert.ok(total<=MAX_TOTAL);assert.deepEqual(ref(part.path,b),{path:part.path,bytes:part.bytes,sha256:part.sha256});
  const p=JSON.parse(b);assert.equal(p.schemaVersion,1);assert.equal(p.encoding,index.encoding);assert.equal(p.blobs.length,part.blobs);
  for(const q of p.blobs){assert.match(q.sha256,/^[0-9a-f]{64}$/);assert.ok(!blobs.has(q.sha256),'Duplicate physical blob key');assert.equal(q.encoding,'gzip-base64');
   decodedBytes=assertV44BlobBudget({physicalCount:blobs.size,decodedBytes,rawBytes:q.rawBytes,gzipBytes:q.gzipBytes});
   assert.equal(typeof q.base64,'string');assert.equal(q.base64.length,4*Math.ceil(q.gzipBytes/3));
   const zipped=Buffer.from(q.base64,'base64');assert.equal(zipped.toString('base64'),q.base64,'Canonical base64 roundtrip');assert.equal(zipped.length,q.gzipBytes);assert.equal(sha(zipped),q.gzipSha256);
   const raw=gunzipSync(zipped,{maxOutputLength:Math.max(1,q.rawBytes)});assert.equal(raw.length,q.rawBytes);assert.equal(sha(raw),q.sha256);blobs.set(q.sha256,raw);
  }
 }
 const referenced=new Set();assert.ok(index.files.length>0&&index.files.length<=256);
 for(const f of index.files){relative(f.path);assert.ok(!files.has(f.path),'Duplicate logical path');assert.equal(f.blob,f.sha256);const raw=blobs.get(f.blob);assert.ok(raw,'Unresolved physical blob');assert.equal(raw.length,f.bytes);assert.equal(sha(raw),f.sha256);assert.ok(Array.isArray(f.roles)&&f.roles.length>0);files.set(f.path,raw);referenced.add(f.blob);}
 assert.equal(blobs.size,index.uniqueBlobs);assert.equal(files.size,index.logicalFiles);assert.deepEqual([...referenced].sort(),[...blobs.keys()].sort(),'Orphan physical blobs forbidden');
 assert.equal(total,index.serializedPartBytes);return{files,physicalBlobs:blobs.size,partBytes:total};
}
export async function verifyV44Evidence({root,index,files}){
 const S=JSON.parse(files.get(D+'source-before.json')),sourcePins=new Map(S.sources.map(p=>[p.path,p])),sourcePaths=new Set(sourcePins.keys()),
  testedPins=new Map(JSON.parse(files.get(B+'viewport-spe-return-root-full-v1.json')).sources.map(p=>[p.path,p])),fallbacks=new Set();
 const readLogical=p=>{relative(p);if(ARCHIVED_IGNORED_TOOLS.has(p)){const current=fs.existsSync(local(root,p))?bounded(root,p,64*1024*1024):null,
   proof=bindV44SourceBytes(p,sourcePins.get(p)||testedPins.get(p),{archived:files.get(p),current});if(proof.archivedFallback)fallbacks.add(p);return proof.bytes;}
  if(sourcePaths.has(p)||testedPins.has(p))return bounded(root,p,64*1024*1024);const b=files.get(p);assert.ok(b,'Unarchived non-checkout evidence '+p);return b;};
 for(const name of ['scripts/hd-mobile-system-runtime-oracle.mjs','scripts/hd-runtime-owned-chrome.mjs']){const p=S.sources.find(p=>p.path===name),b=bounded(root,name,1024*1024);assert.ok(p);assert.deepEqual(ref(name,b),p);}
 const {verifyOriginalSavePair}=await import(pathToFileURL(local(root,'scripts/hd-mobile-system-runtime-oracle.mjs'))),{buildOwnership}=await import(pathToFileURL(local(root,'scripts/hd-runtime-owned-chrome.mjs')));
 const actualPaths=index.files.filter(f=>f.roles.includes('actual-flat-file')).map(f=>f.path).sort();
 assert.equal(actualPaths.length,51);assert.equal(actualPaths.reduce((n,p)=>n+files.get(p).length,0),27143004);
 const evidence=(()=>{

// Closed evidence only; no scenario/bootstrap imports, OS calls, browser or input.
const B='build/impact-skill-20261014/',N=B+'viewport-baseline-20261024-source-v1/',D=B+'viewport-october-geometry-v1/',O=B+'october-geometry-closed-independent-v1/';
const read=p=>readLogical(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const pin=(p,b=read(p))=>({path:p,bytes:b.length,sha256:sha(b)});
const files=actualPaths.map(p=>pin(p));
assert.equal(files.length,51);
const R=json(D+'result.json'),Q=R.observation,E=json(D+'geometry-observer.json'),K=json(D+'native-inputs.json');
const S=json(D+'source-before.json'),T=json(D+'source-after.json'),H=json(D+'served-source-before.json'),J=json(D+'served-source-after.json');
assert.equal(R.ok,true);assert.equal(R.acceptedForObservationClosure,true);assert.equal(R.metricsAndBackingContractSatisfied,true);assert.equal(R.realVisibilityContractSatisfied,true);
assert.equal(S.sourceCount,1118);assert.equal(S.sources.length,1118);assert.equal(new Set(S.sources.map(p=>p.path)).size,1118);
assert.equal(T.count,1118);assert.equal(T.accepted,true);assert.deepEqual(T.drift,[]);assert.equal(T.sources.length,1118);
const sourceMap=new Map(S.sources.map(p=>[p.path,p]));
for(const [i,p]of S.sources.entries()){
  assert.deepEqual(pin(p.path),p,'Current source equals closed execution source: '+p.path);
  assert.deepEqual(T.sources[i],{...p,actualBytes:p.bytes,actualSha256:p.sha256,match:true});
}
assert.equal(H.count,72);assert.equal(H.sources.length,72);assert.equal(J.count,72);assert.equal(J.sources.length,72);
for(const [i,p]of H.sources.entries()){assert.deepEqual(sourceMap.get(p.path),p);assert.deepEqual(J.sources[i],T.sources.find(q=>q.path===p.path));}
for(const q of R.requests){assert.equal(q.status,200);assert.deepEqual({path:q.path,bytes:q.bytes,sha256:q.sha256},sourceMap.get(q.path));assert.ok(H.sources.some(p=>p.path===q.path));}
assert.equal(new Set(R.requests.map(r=>r.path)).size,72);assert.equal(R.sourceInventoryCount,1118);assert.deepEqual(R.sourceVerification,{count:1118,servedCount:72,allStartupPinsMatch:true,drift:[]});
const copyPairs=[['executed-tool.mjs',N+'run-october-geometry-v3.mjs'],['executed-scenario.mjs',N+'october-public-load-geometry-v3.mjs'],['executed-campaign-reader.mjs',N+'maker-held-browser-boundary-v2.mjs'],['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],['executed-packed-oracle.mjs','scripts/hd-mobile-system-runtime-oracle.mjs'],['executed-hd-spe.js','js/hd-spe.js'],['executed-overworld.js','js/hd-overworld.js'],['executed-system-ui.js','js/hd-system-ui.js'],['executed-save-storage.js','js/save-storage.js'],['executed-bridge.js','js/bridge.js'],['executed-engine-manifest.json','js/baye.build.json'],['executed-pc.html','pc.html']];
const copies=copyPairs.map(([name,p])=>{const copy=pin(D+name),original=sourceMap.get(p);assert.ok(original);assert.deepEqual([copy.bytes,copy.sha256],[original.bytes,original.sha256]);return{original,copy};});
assert.equal(copies[0].copy.bytes,26726);assert.ok(copies[0].copy.sha256.startsWith('18f71c2b'));
assert.equal(copies[1].copy.sha256,'3000bb15a070330f8f7a98f4686564d736be886102c3a1b5741aea0ab6e99b00');
const manifest=json(D+'executed-engine-manifest.json');assert.equal(R.compiledArtifactsMatched,true);assert.equal(R.nativeSourceAggregate,manifest.engineSourceSha256);
for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const p=sourceMap.get('js/'+name);assert.deepEqual([p.bytes,p.sha256],[manifest.artifacts[name].bytes,manifest.artifacts[name].sha256]);}

const inputBase='docs/validation/m5-wood67-classic-20261024-v42';
const inputNames=['input-canonical.json','input-latest-world.json','input-sango0.sav','input-sango1.sav'];
const inputs=['.json','-latest-world.json','-sango0.sav','-sango1.sav'].map((suffix,i)=>{const expected=sourceMap.get(inputBase+suffix),copy=pin(D+inputNames[i]);assert.deepEqual([copy.bytes,copy.sha256],[expected.bytes,expected.sha256]);assert.deepEqual(R.inputPins[i],expected);return{original:expected,copy};});
assert.deepEqual(Q.inputPins,R.inputPins);assert.equal(json(D+'input-canonical.json').latest.authoritativeMainInput,true);
const reference=json(D+'input-latest-world.json'),pair={sav0:read(D+'input-sango0.sav').toString('hex'),sav1:read(D+'input-sango1.sav').toString('hex')};
assert.equal(verifyOriginalSavePair({...pair,world:reference}).savedMeasuredFieldsAccepted,true);
const pairPins=Object.fromEntries(['sav0','sav1'].map((n,i)=>[n,{bytes:inputs[i+2].copy.bytes,sha256:inputs[i+2].copy.sha256}]));
assert.deepEqual([reference.year,reference.month,reference.people[131].Arms,reference.people[131].Experience,reference.cities[20].Food,reference.cities[20].Money],[239,10,2242,16,1,886]);
const baseline=json(D+'october-loaded-map-baseline.json');assert.deepEqual(baseline.world.people,reference.people);assert.deepEqual(baseline.world.cities,reference.cities);
assert.equal(verifyOriginalSavePair({...pair,world:baseline.world}).savedMeasuredFieldsAccepted,true);
assert.deepEqual(K.map(k=>k.code),[39,35,39,39,40,35,34,40]);
assert.deepEqual(E.keys.map(k=>k.code),[35,39,39,40,35,34,40]);assert.deepEqual(Q.menuKeys,[40,35,34,40]);assert.deepEqual(Q.publicLoad.nativeKeyCodes,[35,39,39]);
assert.equal(Q.publicLoad.realNativeTitleAndRecordInputs,true);assert.equal(Q.publicStorage.inputPairExact,true);assert.equal(Q.publicStorage.journalAbsent,true);
assert.equal(Q.publicLoad.savedSeedAppliedOrRngContinuousAccepted,false);
assert.equal(K.length,8);assert.equal(E.keys.length,7);
for(const [i,k]of E.keys.entries()){assert.equal(k.before.keyCount,i);assert.equal(k.after.keyCount,i+1);assert.ok(k.dispatchAt<=k.returnAt);assert.equal(K[i+1].code,k.code);assert.ok(K[i+1].dispatchAt>=k.dispatchAt&&K[i+1].returnAt<=k.returnAt);}
const title=E.keys[1].before;assert.deepEqual([title.menu.active,title.menu.context,title.menu.kind,title.menu.count,title.menu.index],[1,4,1,4,1]);assert.equal(title.system.pending,false);
const load=E.keys[2].before;assert.deepEqual([load.record.active,load.record.mode,load.record.count,load.record.index],[1,2,4,0]);
assert.deepEqual([load.system.open,load.system.showHd,load.system.screen,load.system.pending,load.system.idleIndex],[true,true,'saveload',false,0]);
assert.deepEqual(load.system.input,{type:'record',seq:load.record.seq,index:0,count:4,mode:2,screen:'saveload'});
const keyups=E.events.filter(e=>e.type==='keyup');assert.deepEqual(keyups.map(e=>e.key),['ArrowDown','Enter','Enter','Escape','ArrowDown','ArrowUp','Escape']);
for(const [i,e]of keyups.entries()){assert.equal(e.trusted,true);assert.equal(e.state.keyCount,i+1);assert.ok(e.state.at>E.keys[i].dispatchAt);}
assert.ok(E.keys.slice(3).every(k=>k.code!==39),'No END/MAKE/SAVE-confirm Enter after LOAD');

const descriptors=s=>{for(const d of Object.values(s.descriptors)){assert.equal(d.own,false);assert.ok(d.getter.includes('[native code]'));assert.equal(d.setter,null);}};
const native=s=>Object.fromEntries(['menu','record','qty','march','report','fight','spe','maker'].map(k=>[k,s[k]]));
const geometry=[],worlds=[];
const checkWorld=(label,s)=>{assert.ok(!Object.hasOwn(s,'seed'));assert.deepEqual(s.world,baseline.world,'Complete post-LOAD world: '+label);assert.deepEqual(s.pairPins,pairPins);assert.equal(s.seedFingerprint,baseline.seedFingerprint);assert.equal(s.journal,null);descriptors(s.state);assert.equal(verifyOriginalSavePair({...pair,world:s.world}).savedMeasuredFieldsAccepted,true);worlds.push({label,worldSha256:sha(Buffer.from(JSON.stringify(s.world))),seedFingerprint:s.seedFingerprint,pairPins:s.pairPins,keyCount:s.state.keyCount});};
assert.equal(Q.geometry.length,8);assert.equal(Q.stages.length,3);
for(const g of Q.geometry){
  const label=g.owner+'-'+g.spec.label,s=json(D+label+'.json');checkWorld(label,s);assert.deepEqual(s.state,g.after);
  assert.deepEqual(native(g.before),native(g.after));assert.equal(g.before.keyCount,g.after.keyCount);assert.equal(g.nativeKeys,0);
  const keyCount=g.owner==='map'?3:4;assert.equal(g.before.keyCount,keyCount);
  assert.deepEqual([g.after.viewport.width,g.after.viewport.height,g.after.viewport.dpr],[g.spec.width,g.spec.height,g.spec.deviceScaleFactor]);
  assert.equal(g.mapBackingAccepted,g.owner==='map');assert.equal(g.mapBackingDiagnosticOnly,g.owner!=='map');
  const canvas=g.after.surfaces.find(s=>s.id==='hd-overworld-canvas');
  if(g.owner==='map'){assert.deepEqual([canvas.width,canvas.height],[1920*g.spec.deviceScaleFactor,1080*g.spec.deviceScaleFactor]);assert.equal(g.after.march.pick,1);assert.equal(g.after.menu.active,0);}
  else{assert.deepEqual([g.after.menu.active,g.after.menu.context,g.after.menu.kind,g.after.menu.count,g.after.menu.index],[1,2,1,3,0]);assert.equal(g.after.system.pending,false);}
  geometry.push({owner:g.owner,label:g.spec.label,viewport:g.after.viewport,backing:{width:canvas.width,height:canvas.height},backingAccepted:g.owner==='map',backgroundBackingDiagnosticOnly:g.owner!=='map',png:g.png,nativeKeys:0});
}
for(const stage of Q.stages){const s=json(D+stage.label+'.json');checkWorld(stage.label,s);assert.deepEqual(s.state,stage.state);assert.equal(s.seedFingerprint,stage.seedFingerprint);assert.equal(s.state.keyCount,stage.keyCount);}
assert.equal(worlds.length,11);
const final=json(D+'final-unchanged-map.json');assert.deepEqual(final.world,baseline.world);assert.deepEqual(final.pair,pair);assert.equal(final.seedFingerprint,baseline.seedFingerprint);assert.equal(final.journal,null);assert.ok(!Object.hasOwn(final,'seed'));
assert.equal(final.state.keyCount,7);assert.deepEqual([final.state.viewport.width,final.state.viewport.height,final.state.viewport.dpr],[1920,1080,1]);
assert.deepEqual([final.state.surfaces.find(s=>s.id==='hd-overworld-canvas').width,final.state.surfaces.find(s=>s.id==='hd-overworld-canvas').height],[1920,1080]);
const v=Q.visibility;assert.equal(v.attempted,true);assert.equal(v.realHiddenObserved,true);assert.equal(v.realVisibleObserved,true);assert.equal(v.contractSatisfied,true);
const changes=v.events.filter(e=>e.type==='visibilitychange');assert.equal(changes.length,2);
assert.deepEqual(changes.map(e=>[e.trusted,e.state.hidden,e.state.visibilityState,e.state.keyCount]),[[true,true,'hidden',7],[true,false,'visible',7]]);
assert.ok(changes[0].state.at<changes[1].state.at);for(const e of changes){descriptors(e.state);assert.deepEqual(native(e.state),native(final.state));}
assert.ok(v.hiddenState.hidden);assert.ok(!Object.hasOwn(v.hiddenState,'world'));
const hiddenMs=changes[1].state.at-changes[0].state.at;assert.ok(hiddenMs>0&&hiddenMs<1000);
assert.deepEqual(E.events.slice(-v.events.length),v.events);

const union=json(D+'owned-union.json'),cleanup=json(D+'cleanup.json');assert.deepEqual(R.cleanup,cleanup);
const rebuilt=buildOwnership(union.owned,union);assert.equal(rebuilt.rootVerified,true);assert.deepEqual(rebuilt.owned,union.owned);assert.deepEqual(cleanup.recordedOwned,union.owned);
const owned=union.owned,proofs=R.cdpOwnershipProofs;assert.equal(proofs.length,4);
assert.deepEqual(proofs.map(p=>p.stage),['before-json-list','before-websocket-connect','after-websocket-before-any-rpc','before-browser-close-rpc']);
for(const p of proofs){assert.equal(p.ownedListenerAccepted,true);assert.equal(p.port,R.isolation.cdpPort);assert.equal(p.rootPid,R.isolation.rootPid);assert.notEqual(p.port,8080);assert.ok(p.listeners.length>0);
  for(const row of p.listeners){assert.ok(['127.0.0.1','::1'].includes(row.LocalAddress));assert.equal(row.LocalPort,p.port);assert.ok(owned.some(q=>q.ProcessId===row.ProcessId&&q.CreationDate===row.CreationDate&&q.ExecutablePath===row.ExecutablePath));}}
assert.deepEqual(proofs.map(p=>p.webSocketUrlAccepted),[false,true,true,false]);assert.deepEqual(proofs[1].listeners,proofs[2].listeners);
assert.equal(cleanup.treeExited,true);assert.equal(cleanup.directoriesDeleted,false);assert.deepEqual(cleanup.errors,[]);assert.deepEqual(cleanup.recheck.targets,[]);assert.deepEqual(cleanup.recheck.refused,[]);assert.equal(cleanup.recheck.absent.length,owned.length);
assert.deepEqual(cleanup.exitVerification,{treeExited:true,survivingRecorded:[],rootDescendants:[],profileMatches:[]});
assert.deepEqual(R.user8080After,json(D+'user8080-before.json'));assert.equal(R.user8080Unchanged,true);assert.deepEqual(R.privateListeners,[]);assert.equal(R.profilePreserved,true);
const samples=read(D+'owned-process-samples.jsonl').toString().trim().split(/\r?\n/).map(JSON.parse);
for(const s of samples){assert.equal(s.rootVerified,true);assert.equal(s.rootPid,R.isolation.rootPid);for(const p of s.owned)assert.ok(owned.some(q=>q.ProcessId===p.ProcessId&&q.CreationDate===p.CreationDate&&q.ExecutablePath===p.ExecutablePath&&q.CommandLine===p.CommandLine));}

function decodePng(p){
  const b=read(p);assert.deepEqual(b.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  const crc=bytes=>{let v=0xffffffff;for(const x of bytes){v^=x;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return(v^0xffffffff)>>>0;};
  let at=8,w,h,ended=false;const chunks=[];
  while(at<b.length){const n=b.readUInt32BE(at),kind=b.toString('ascii',at+4,at+8);assert.ok(at+12+n<=b.length);assert.equal(crc(b.subarray(at+4,at+8+n)),b.readUInt32BE(at+8+n));const data=b.subarray(at+8,at+8+n);
    if(kind==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);assert.ok(w>0&&h>0&&w<=8192&&h<=8192&&w*h*3<=64*1024*1024,'Bounded RGB decode');assert.equal(data[8],8);assert.equal(data[9],2);assert.deepEqual([...data.subarray(10)],[0,0,0]);}else if(kind==='IDAT')chunks.push(data);else if(kind==='IEND'){assert.equal(n,0);ended=true;at+=12;break;}at+=12+n;}
  assert.ok(ended);assert.equal(at,b.length);const stride=w*3,data=inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*h}),rgb=Buffer.alloc(stride*h);assert.equal(data.length,(stride+1)*h);
  const paeth=(a,b,c)=>{const p=a+b-c,A=Math.abs(p-a),B=Math.abs(p-b),C=Math.abs(p-c);return A<=B&&A<=C?a:B<=C?b:c;};
  for(let y=0;y<h;y++){const f=data[y*(stride+1)];assert.ok(f<=4);for(let x=0;x<stride;x++){const a=x>=3?rgb[y*stride+x-3]:0,t=y?rgb[(y-1)*stride+x]:0,c=x>=3&&y?rgb[(y-1)*stride+x-3]:0;rgb[y*stride+x]=(data[y*(stride+1)+x+1]+(f===0?0:f===1?a:f===2?t:f===3?Math.floor((a+t)/2):paeth(a,t,c)))&255;}}
  return{...pin(p,b),width:w,height:h,color:'RGB8',crcDeflateFiltersAccepted:true,decodedRgbSha256:sha(rgb)};
}
const pngs=files.filter(f=>f.path.endsWith('.png')).map(f=>decodePng(f.path));assert.equal(pngs.length,11);
for(const g of Q.geometry){const p=pngs.find(p=>p.path===D+g.owner+'-'+g.spec.label+'.png');assert.ok(p);assert.deepEqual([p.bytes,p.sha256,p.width,p.height],[g.png.bytes,g.png.sha256,g.spec.width*g.spec.deviceScaleFactor,g.spec.height*g.spec.deviceScaleFactor]);}
for(const g of Q.stages){const p=pngs.find(p=>p.path===D+g.label+'.png');assert.deepEqual([p.bytes,p.sha256,p.width,p.height],[g.png.bytes,g.png.sha256,g.png.width,g.png.height]);}
for(const p of ['actualAccepted','hdAccepted','activeWoodAidAccepted','performanceBaselineAccepted','cssVisualLayoutAccepted','globalHdComplete']){assert.equal(R[p],false);assert.equal(Q[p],false);}
for(const p of ['newEnd','newBuy','newBattle','newNativeSave'])assert.equal(R[p],0);assert.equal(R.uniqueMainUpdated,false);
assert.deepEqual(R.exceptions,[]);assert.deepEqual(R.dialogs,[]);
const executedTool=read(D+'executed-tool.mjs').toString(),executedScenario=read(D+'executed-scenario.mjs').toString();
assert.ok(executedTool.includes("before-json-list")&&executedTool.includes("after-websocket-before-any-rpc"));
assert.ok(executedScenario.includes("throw Error('Actual native RNG state changed; seed values withheld')"));
assert.ok(!/Object\.defineProperty\(document/.test(executedScenario+executedTool));
for(const p of S.sources)assert.deepEqual(pin(p.path),p,'Source unchanged during independent review');
for(const p of files)assert.deepEqual(pin(p.path),p,'Closed original evidence unchanged during independent review');

const receipt={schemaVersion:1,accepted:true,scope:'Independent closed October public LOAD plus ordinary MAP/FunctionMenu viewport/DPR and single short real visibility observation; no new campaign action',
  terminal:{session:69382,initialChunk:'0eefc6',finalChunk:'4929e7',exitCode:0,provenance:'Root supplied genuine closed tool metadata'},
  originalControllerFlags:{ok:R.ok,acceptedForObservationClosure:R.acceptedForObservationClosure,actualAccepted:R.actualAccepted,hdAccepted:R.hdAccepted,metricsAndBackingContractSatisfied:R.metricsAndBackingContractSatisfied,realVisibilityContractSatisfied:R.realVisibilityContractSatisfied,cssVisualLayoutAccepted:R.cssVisualLayoutAccepted,activeWoodAidAccepted:R.activeWoodAidAccepted,performanceBaselineAccepted:R.performanceBaselineAccepted,globalHdComplete:R.globalHdComplete},
  sources:{sourceBefore:pin(D+'source-before.json'),sourceAfter:pin(D+'source-after.json'),currentSourceCount:1118,allCurrentAndBeforeAfterExact:true,sourceVectorSha256:sha(Buffer.from(JSON.stringify(S.sources))),actuallyServedCount:72,actualHttpRequests:R.requests.length,servedBefore:pin(D+'served-source-before.json'),servedAfter:pin(D+'served-source-after.json'),copies,executedBootstrapVersion:3,priorBootstrap2ReviewIsNotExecutedSourceProof:true,compiledArtifactsMatchManifest:true,independentCurrentNativeCRecompile:false},
  inputs,publicLoad:{trustedPublicKeys:[35,39,39],titleAndRecordPublicAckAccepted:true,recordMode:2,recordCount:4,slot:0,all200PeopleFieldsAnd38CityFieldsEqualInput:true,wholePersistedPackedFieldsVerified:true,unsavedQueueTailsAndConfigProtectedAgainstActualPostLoadBaseline:true,savedSeedApplicationAccepted:false},
  keys:{bootstrapOpeningKeys:[39],probeKeys:E.keys.map(k=>k.code),probeKeyCount:7,allNativeKeys:K.map(k=>k.code),allNativeKeyCount:8,postLoadMenuKeys:[40,35,34,40],postLoadMenuKeyCount:4,geometryNativeKeys:0,visibilityNativeKeys:0,noEndMakeSaveConfirmAfterLoad:true,trustedKeyups:7},
  snapshots:{persistedCompleteWorlds:11,worlds,extraFinalProtectedCopy:pin(D+'final-unchanged-map.json'),allCompleteWorldsEqual:true,allPublicPairPinsEqual:true,extraFinalPairOriginalBytesEqual:true,allObservedSeedFingerprintsEqual:true,seedValuesWrittenByAuditor:false},
  geometry,ordinaryPngs:pngs,
  visibility:{nativePrototypeGetterDescriptors:true,trustedHiddenEvents:1,trustedVisibleEvents:1,hiddenAt:changes[0].state.at,visibleAt:changes[1].state.at,observedDurationMs:hiddenMs,keyCount:7,nativeOwnersStable:true,rawHiddenStateHasFullWorld:false,independentHiddenFullWorldProof:false,executionTimeHiddenFullWorldSeedPairAssertionsPassed:true,longBackgroundOrThrottlingRecoveryAccepted:false},
  cleanup:{ownedRecorded:owned.length,ownedSamples:samples.length,ownedCdpProofStages:proofs.map(p=>p.stage),allFourOwnedEndpointProofsAccepted:true,allRecordedAbsent:true,privateListeners:0,user8080Unchanged:true,profilePreserved:true,cleanup:pin(D+'cleanup.json'),ownedUnion:pin(D+'owned-union.json')},
  campaignCurrent:{date:[239,10],caster131Arms:2242,caster131Experience:16,city20Food:1,city20Money:886,nextStrictFood:267,nextFoodGap:266,noNextEndAuthorization:true,mainInputChanged:false},
  limits:{DPR:'CDP simulated only',headless:true,disableGpu:true,cssVisualLayoutAccepted:false,ordinaryScreenshotsOnly:true,nativeMoviePixelAccepted:false,activeWoodAidAccepted:false,fullResizeMatrixAccepted:false,physicalDprOrRealDeviceAccepted:false,performanceAccepted:false,globalHdComplete:false,newBrowserOrGameRunFromAuditor:false,originalRawModified:false,oldArchiveTraversed:false,privateProfileArchived:false},
  immediateFiles:files,namedRawBytes:files.reduce((n,p)=>n+p.bytes,0),tool:pin(B+'october-geometry-closed-independent-review-v1.mjs')};
return receipt;

 })();
 const continuity=JSON.parse(files.get(B+'october-v44-regression-source-continuity-v1.json')),
  full=JSON.parse(files.get(B+'viewport-spe-return-root-full-v1.json')),
  before=JSON.parse(files.get(B+'viewport-spe-return-root-full-v1-before.json'));
 assert.equal(continuity.accepted,true);assert.equal(continuity.savedRegressionOnly,true);assert.equal(continuity.newFullRun,false);
 assert.equal(full.accepted,true);assert.equal(full.tests,7701);assert.equal(full.pass,7701);assert.equal(full.registeredFiles,141);assert.equal(full.sourceBytesStable,true);assert.deepEqual(full.sources,before.sources);assert.equal(full.sources.length,206);
 for(const p of full.sources.filter(p=>p.path!=='.gitattributes'))assert.deepEqual(ref(p.path,readLogical(p.path)),p);
 assert.equal(full.sources.filter(p=>p.path!=='.gitattributes').length,205);
 const attrs=bounded(root,'.gitattributes',1024*1024),added=Buffer.from(continuity.addedRulesOnly);
 assert.equal(attrs.length,continuity.after.bytes);assert.equal(sha(attrs),continuity.after.sha256);assert.ok(attrs.subarray(attrs.length-added.length).equals(added));
 const old=attrs.subarray(0,attrs.length-added.length);assert.equal(old.length,continuity.before.bytes);assert.equal(sha(old),continuity.before.sha256);
 const executionFallbacks=[...fallbacks].filter(p=>sourcePaths.has(p));
 evidence.sources.currentSourceCount=1118-executionFallbacks.length;evidence.sources.allCurrentAndBeforeAfterExact=executionFallbacks.length===0;
 evidence.sources.allExecutionPinsBound=true;evidence.sources.readerArchivedIgnoredToolFallbacks=executionFallbacks;
 return {accepted:true,evidence,archivedIgnoredToolFallbacks:[...fallbacks].sort(),committedExecutionSourcesMatched:1115,
  regression:{savedTests:7701,newFullRun:false,unchangedTestedSources:205,attrsExactAppendVerified:true},
  boundary:{matchingGitCheckoutRequired:true,exactArchivedFiveIgnoredToolsAllowed:true,portableClosedSourceArchive:false,hiddenFullWorldRawProof:false,cssVisualLayoutAccepted:false,activeWoodAidAccepted:false,performanceBaselineAccepted:false,globalHdComplete:false}};
}
export function verifyV44SavedRegressionBytes({savedRegression,files,fullGzip}){
 for(const [field,p] of [['receipt',B+'viewport-spe-return-root-full-v1.json'],['before',B+'viewport-spe-return-root-full-v1-before.json'],['metadataContinuity',B+'october-v44-regression-source-continuity-v1.json']]){
  const bytes=files.get(p);assert.ok(Buffer.isBuffer(bytes),'Exact saved regression support required');assert.deepEqual(ref(p,bytes),savedRegression[field]);
 }
 const full=JSON.parse(files.get(savedRegression.receipt.path));assert.equal(savedRegression.tests,7701);assert.equal(savedRegression.registeredFiles,141);assert.equal(savedRegression.newDefaultCases,0);assert.equal(savedRegression.newFullRun,false);
 assert.ok(Buffer.isBuffer(fullGzip));assert.deepEqual(ref(savedRegression.publishedV43FullGzip.path,fullGzip),savedRegression.publishedV43FullGzip);
 assert.ok(Number.isInteger(full.stdout.bytes)&&full.stdout.bytes>0&&full.stdout.bytes<=8*1024*1024,'Saved stdout bounded before inflate');
 const stdout=gunzipSync(fullGzip,{maxOutputLength:full.stdout.bytes});assert.deepEqual(ref(full.stdout.path,stdout),full.stdout);
 for(const [name,value] of Object.entries({tests:7701,pass:7701,fail:0,cancelled:0,skipped:0,todo:0})){
  assert.equal(full[name],value);const matches=[...stdout.toString('utf8').matchAll(new RegExp('^ℹ '+name+' (\\d+)\\r?$','gm'))];assert.equal(matches.length,1,'Unique original saved summary');assert.equal(Number(matches[0][1]),value);
 }
 return {savedTests:7701,savedPass:7701,savedStdoutBytes:stdout.length,savedStdoutSha256:sha(stdout),newFullRun:false};
}
export async function verifyV44Publication(root){
 const c=JSON.parse(bounded(root,P+'.json',1024*1024)),ib=bounded(root,P+'-archive.json',1024*1024);assert.deepEqual(ref(P+'-archive.json',ib),c.archive);
 const self=bounded(root,P+'-verify.mjs',1024*1024);assert.deepEqual(ref(P+'-verify.mjs',self),c.reader);
 const index=JSON.parse(ib),decoded=decodeV44Archive(root,index),proof=await verifyV44Evidence({root,index,files:decoded.files});
 assert.equal(c.acceptedForPublicationClosure,true);assert.equal(c.counts.actualFlatFiles,51);assert.equal(c.counts.ordinaryPngs,11);assert.equal(c.counts.executionSources,1118);assert.equal(c.counts.servedSources,72);
 assert.equal(c.scope.metricsAndBackingContractSatisfied,true);assert.equal(c.scope.oneShortRealHiddenVisiblePairObserved,true);assert.equal(c.scope.cssVisualLayoutAccepted,false);assert.equal(c.scope.activeWoodAidAccepted,false);assert.equal(c.scope.performanceAccepted,false);assert.equal(c.scope.globalHdComplete,false);assert.equal(c.scope.independentHiddenFullWorldProof,false);
 const fullGz=bounded(root,c.savedRegression.publishedV43FullGzip.path,1024*1024);verifyV44SavedRegressionBytes({savedRegression:c.savedRegression,files:decoded.files,fullGzip:fullGz});
 return {accepted:true,archiveParts:index.parts.length,physicalBlobs:decoded.physicalBlobs,logicalFiles:index.files.length,allOriginalBytesVerified:true,
  ordinaryPngsDecoded:proof.evidence.ordinaryPngs.length,pngColor:'RGB8',checkpointWorlds:11,extraFinalWorldCopy:true,executionSourcesBound:1118,committedExecutionSourcesMatched:1115,servedMatched:72,archivedIgnoredToolFallbacks:proof.archivedIgnoredToolFallbacks,
  geometryProbeKeys:7,allBootNativeKeys:8,hiddenMs:proof.evidence.visibility.observedDurationMs,hiddenFullWorldRawProof:false,
  savedRegressionTests:7701,newFullRun:false,matchingGitCheckoutRequired:true,exactFiveIgnoredToolsArchived:true,portableClosedSourceArchive:false,cssVisualLayoutAccepted:false,activeWoodAidAccepted:false,performanceBaselineAccepted:false,globalHdComplete:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verifyV44Publication(path.resolve(process.argv[2]||process.cwd())).then(p=>console.log(JSON.stringify(p))).catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
}
