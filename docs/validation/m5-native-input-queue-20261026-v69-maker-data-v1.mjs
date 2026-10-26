/** Read-only MAKER data helper. No archived source, browser, VM or compiler executes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const MAKER_DIRECTORY='build/mobile-input-20261026-v69/maker-sem-timing-v1/';
export const MAKER_NAMES=Object.freeze(['full-natural-1080p','scroll-skip-natural-720p','full-hold-enter-720p']);
export const MAKER_PACKET_PLAN=Object.freeze({maxUniqueBytes:33554432,maxNamedBytes:100663296,maxFiles:450});
export const MAKER_TOP_PIN=Object.freeze({path:MAKER_DIRECTORY+'result.json',bytes:19460633,sha256:'2344390a54630c067b7ca0f8f3065b1ae5e2188669b76b9aecbcbdc797bed722'});
export const MAKER_OWNED_EXIT_PIN=Object.freeze({path:MAKER_DIRECTORY+'owned-exit-verification-v1.json',bytes:9580,sha256:'e4af6ab2636b2caf5452fce3d52095cbd40c441ebd43692f55a30003a99aa7ac'});
const B='build/mobile-input-20261026-v69/';
function equal(actual,expected,message){assert.ok(isDeepStrictEqual(actual,expected),message);}
function rawPin(path,bytes){assert.ok(Buffer.isBuffer(bytes),'MAKER original is a Buffer: '+path);return{path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
function pinShape(p){assert.ok(p&&typeof p==='object','MAKER pin object');assert.equal(typeof p.path,'string','MAKER pin path');assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&p.bytes<=33554432,'MAKER file fits original maxFileBytes: '+p.path);assert.match(p.sha256,/^[0-9a-f]{64}$/,'MAKER SHA256: '+p.path);return{path:p.path,bytes:p.bytes,sha256:p.sha256};}
function withinMaker(file,extension){assert.equal(typeof file,'string','MAKER original relative filename');assert.ok(file&&!file.includes('\\')&&!file.startsWith('/')&&file.split('/').every(s=>s&&s!=='.'&&s!=='..'),'MAKER relative filename stays inside case: '+file);if(extension)assert.ok(file.endsWith(extension),'MAKER expected extension: '+file);return MAKER_DIRECTORY+file;}
function distinctPins(pins,message){const result=[],seen=new Map();for(const p of pins){const pin=pinShape(p);if(seen.has(pin.path))equal(seen.get(pin.path),pin,message+' same path has exact bytes');else{seen.set(pin.path,pin);result.push(pin);}}return result;}
function actualPin(pinAt,path,declared){const p=pinShape(pinAt(path));assert.equal(p.path,path,'MAKER pin callback must keep path');if(declared)equal(p,{path,bytes:declared.bytes,sha256:declared.sha256},'MAKER declared raw bytes: '+path);return p;}

/** Preserve every explicit path; aliases sharing a blob are kept in the same packet. */
export function groupMakerImages(imagePins){
  const pins=distinctPins(imagePins,'MAKER image'),aliases=new Map();
  for(const p of pins){assert.ok(p.path.startsWith(MAKER_DIRECTORY)&&p.path.endsWith('.png'),'MAKER image path');const key=p.bytes+':'+p.sha256;if(!aliases.has(key))aliases.set(key,{bytes:p.bytes,sha256:p.sha256,pins:[]});aliases.get(key).pins.push(p);}
  const groups=[];let current=null;
  function fresh(){return{id:'maker-images-'+String(groups.length+1).padStart(3,'0'),files:[],namedBytes:0,uniqueBytes:0,uniqueBlobs:0};}
  function finish(){if(current?.files.length){groups.push(current);current=null;}}
  for(const alias of aliases.values()){
    const named=alias.bytes*alias.pins.length;
    assert.ok(alias.bytes<=MAKER_PACKET_PLAN.maxUniqueBytes&&named<=MAKER_PACKET_PLAN.maxNamedBytes&&alias.pins.length<=MAKER_PACKET_PLAN.maxFiles,'MAKER complete blob-alias group fits conservative original-bound plan');
    current??=fresh();
    if(current.uniqueBytes+alias.bytes>MAKER_PACKET_PLAN.maxUniqueBytes||current.namedBytes+named>MAKER_PACKET_PLAN.maxNamedBytes||current.files.length+alias.pins.length>MAKER_PACKET_PLAN.maxFiles){finish();current=fresh();}
    current.files.push(...alias.pins);current.namedBytes+=named;current.uniqueBytes+=alias.bytes;current.uniqueBlobs++;
  }
  finish();
  equal(groups.flatMap(g=>g.files).map(p=>p.path).sort(),pins.map(p=>p.path).sort(),'MAKER packet groups retain all original logical image paths exactly once');
  for(const g of groups)assert.ok(g.files.length<=450&&g.uniqueBytes<=33554432&&g.namedBytes<=100663296,'MAKER packet conservative budget: '+g.id);
  return groups;
}

/** Root fill/reader supplies already parsed complete original result and a raw pin callback. */
export function collectMakerPins(result,pinAt){
  assert.equal(typeof pinAt,'function','MAKER raw pin callback');assert.ok(result&&typeof result==='object','MAKER complete result object');
  equal(result.sessions?.map(s=>s.name),MAKER_NAMES,'MAKER exact three original sessions');
  assert.equal(result.phases?.length,15,'MAKER exact original phase count');
  const top=actualPin(pinAt,MAKER_TOP_PIN.path,MAKER_TOP_PIN);
  const ownedExit=actualPin(pinAt,MAKER_OWNED_EXIT_PIN.path,MAKER_OWNED_EXIT_PIN);
  const sourceVerification=actualPin(pinAt,MAKER_DIRECTORY+'source-verification.json');
  const runner=actualPin(pinAt,MAKER_DIRECTORY+'runner-source.mjs',result.runner);
  const rawInitial=actualPin(pinAt,B+'raw-maker-initial-tool-v1.json');
  const rawTerminal=actualPin(pinAt,B+'raw-maker-terminal-tool-v1.json');
  const nativeReferenceData=actualPin(pinAt,MAKER_DIRECTORY+'native-reference/resource.json');
  const sessionObservationPins=result.sessions.map(s=>actualPin(pinAt,withinMaker(s.name+'/observations.json','.json')));
  const phasePins=result.phases.map((phase,index)=>{
    assert.equal(typeof phase.screenshot,'string','MAKER phase screenshot is its actual string basename');
    assert.ok(!phase.screenshot.includes('/'),'MAKER phase screenshot is top-level basename');
    assert.ok(phase.screenshot.startsWith(String(index+1).padStart(2,'0')+'-'),'MAKER phase numbering remains original');
    return actualPin(pinAt,withinMaker(phase.screenshot,'.png'));
  });
  const nativeReferencePins=(result.nativeResource?.pictures||[]).map(p=>{
    assert.ok(p.file?.startsWith('native-reference/'),'MAKER original native reference path');
    // p.bytes is the original bitplane payload size, not its PNG file size.
    const pin=actualPin(pinAt,withinMaker(p.file,'.png'));assert.equal(pin.sha256,p.sha256,'MAKER native reference original PNG hash');return pin;
  });
  assert.equal(nativeReferencePins.length,1,'MAKER original resource has one complete native reference image');
  const capturePins=[];
  for(const s of result.sessions){
    assert.ok(Array.isArray(s.captures),'MAKER original captures array: '+s.name);
    for(const c of s.captures){
      equal(Object.keys(c.files||{}).sort(),['hd','native'],'MAKER complete capture retains both original PNGs');
      for(const key of ['native','hd']){const p=c.files[key];assert.ok(p.file?.startsWith(s.name+'/'),'MAKER capture remains in its explicit session');capturePins.push(actualPin(pinAt,withinMaker(p.file,'.png'),p));}
    }
  }
  assert.equal(capturePins.length,402,'MAKER exact complete capture PNG count');
  const imagePins=distinctPins([...phasePins,...nativeReferencePins,...capturePins],'MAKER original image');
  const dataPins=distinctPins([top,...sessionObservationPins,sourceVerification,runner,ownedExit,rawInitial,rawTerminal,nativeReferenceData],'MAKER complete original data');
  // Only this task-owned receipt is selected. Its raw global-CIM pin references
  // are data, not a graph to traverse or files to add to Git.
  assert.ok(!dataPins.some(p=>/owned-(?:before|cim-sample|after-terminal-cim)-/.test(p.path)),'MAKER never selects unrelated full-OS inventories');
  return{directory:MAKER_DIRECTORY,top,ownedExit,sourceVerification,runner,rawInitial,rawTerminal,nativeReferenceData,dataPins,imagePins,groups:groupMakerImages(imagePins),sessionObservationPins,phasePins,nativeReferencePins,capturePins};
}

function validateNoGlobalCimPayload(value){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const item of value)validateNoGlobalCimPayload(item);return;}
  for(const[key,item]of Object.entries(value)){
    assert.ok(!['processes','allProcesses','globalProcesses'].includes(key),'MAKER task-owned receipt must not contain unrelated global process arrays');
    validateNoGlobalCimPayload(item);
  }
}

/** All complete data bytes come from the decoded files map; no local OS snapshot is recaptured. */
export function verifyMaker(files,binding){
  assert.ok(files instanceof Map,'MAKER decoded complete files map');const m=binding.maker||binding;
  assert.equal(m.directory,MAKER_DIRECTORY,'MAKER fixed case directory');
  const read=p=>{const pin=pinShape(p),bytes=files.get(pin.path);equal(rawPin(pin.path,bytes),pin,'MAKER exact original file '+pin.path);return bytes;};
  const json=p=>JSON.parse(read(p).toString('utf8'));
  equal(m.top,MAKER_TOP_PIN,'MAKER fixed complete result pin');equal(m.ownedExit,MAKER_OWNED_EXIT_PIN,'MAKER fixed owned-exit pin');
  const r=json(m.top),inventory=collectMakerPins(r,path=>rawPin(path,files.get(path)));
  for(const key of ['top','ownedExit','sourceVerification','runner','rawInitial','rawTerminal','nativeReferenceData','dataPins','imagePins','groups','sessionObservationPins','phasePins','nativeReferencePins','capturePins'])equal(m[key],inventory[key],'MAKER exact original inventory '+key);
  assert.equal(r.ok,true,'MAKER original result ok');assert.equal(r.staged,false,'MAKER original installed engine run');assert.equal(r.allowLcd,true,'MAKER native-baseline mode');assert.equal(r.hdAccepted,false,'MAKER does not accept HD');
  assert.equal(r.sources?.['libs/dat-mod.lib']?.sha256,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e','MAKER original library identity');
  equal([r.nativeResource?.speId,r.nativeResource?.resourceIndex,r.nativeResource?.kind,r.nativeResource?.count,r.nativeResource?.picmax,r.nativeResource?.startFrm,r.nativeResource?.endFrm],[6,0,1,96,1,0,95],'MAKER saved original resource metadata');
  equal(r.exceptions,[],'MAKER no JS exceptions');equal(r.dialogs,[],'MAKER no dialogs');equal(r.serverErrors||[],[],'MAKER no local server errors');
  assert.equal(r.isolation?.cleaned,true,'MAKER original runner removed its own temporary profile');assert.equal(r.isolation?.user8080Touched,false,'MAKER original runner avoided user8080');
  const sv=json(m.sourceVerification);assert.equal(sv.ok,true,'MAKER original source verification');assert.equal(sv.count,1087,'MAKER actual final source count includes three dynamically served additions');assert.equal(sv.sources?.length,1087,'MAKER complete recorded source vector');assert.equal(sv.runnerMatch,true,'MAKER original runner byte identity');equal(sv.added,[],'MAKER no unaccounted production source additions');
  equal(r.sourceVerification,{ok:true,count:1087,runnerMatch:true,added:[],drift:[]},'MAKER original result source summary');
  for(const source of sv.sources){assert.equal(source.match,true,'MAKER recorded source remained stable: '+source.path);equal(r.sources?.[source.path],{source:source.source,bytes:source.bytes,sha256:source.sha256},'MAKER source record membership: '+source.path);}
  equal({bytes:m.runner.bytes,sha256:m.runner.sha256},r.runner,'MAKER original executed runner bytes');
  equal(json(m.nativeReferenceData),r.nativeResource,'MAKER complete native reference resource JSON');
  const expectedFrames=[96,9,96],expectedKinds=['full','scroll-skip','hold-key'],expectedKeys=[[35,35,39],[35,35,39,39],[35,35,39,39]],sessions=[];
  for(let i=0;i<r.sessions.length;i++){
    const session=r.sessions[i],summary=session.summary;
    equal(json(m.sessionObservationPins[i]),session,'MAKER complete independent observations equal embedded whole session: '+session.name);
    assert.equal(summary?.kind,expectedKinds[i],'MAKER exact scenario kind');equal([summary.width,summary.height],i===0?[1920,1080]:[1280,720],'MAKER original viewport');assert.equal(summary.hdAccepted,false,'MAKER scenario does not accept HD');
    const captures=session.captures.filter(c=>c.before.eventId===summary.owner.eventId&&c.before.frameValid),logical=[...new Set(captures.map(c=>c.before.frameIndex))],visible=[...new Set(captures.flatMap(c=>c.visible))];
    assert.equal(captures.length,expectedFrames[i],'MAKER measured display commits');assert.equal(logical.length,expectedFrames[i],'MAKER measured logical frame count');equal(logical,Array.from({length:expectedFrames[i]},(_,n)=>n),'MAKER actual ordered logical frames');equal(summary.logicalFrames,logical,'MAKER summary rederived logical frames');equal(summary.visibleFrames,visible,'MAKER summary rederived visible frames');assert.equal(summary.displayedCommits,captures.length,'MAKER summary rederived commit count');
    for(const c of captures)equal(c.before,c.after,'MAKER same native displayed stamp before/after read');
    const inputCodes=session.keys.map(k=>k.code);equal(inputCodes,expectedKeys[i],'MAKER actual bounded title/movie/hold keys');equal(summary.inputCodes,inputCodes,'MAKER input summary rederived');
    assert.ok(Number.isFinite(summary.endObservedAt)&&Number.isFinite(summary.titleReturnedAt),'MAKER measured hold timestamps');assert.equal(summary.holdObservedMs,summary.titleReturnedAt-summary.endObservedAt,'MAKER hold is the measured timestamp difference');assert.ok(summary.holdObservedMs>=0,'MAKER nonnegative observed hold');
    if(i<2)assert.ok(summary.holdObservedMs>=45000,'MAKER natural return has a broad post-hoc lower bound, not an exact native tick count');
    assert.equal(summary.ended?.reason,i===1?'key':'complete','MAKER original scroll-end reason');
    const owner=summary.returnedOwner;equal([owner.active,owner.context,owner.kind,owner.index],[1,4,1,0],'MAKER returned actual title owner');assert.ok(owner.seq>summary.titleOwner.seq,'MAKER returned owner is newer than original title');
    sessions.push({name:session.name,viewport:[summary.width,summary.height],frames:logical.length,keys:inputCodes.length,holdObservedMs:summary.holdObservedMs,naturalReturn:i<2,hdAccepted:false});
  }
  for(const p of m.imagePins){const bytes=read(p);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','MAKER original image PNG signature: '+p.path);}
  const rawInitial=json(m.rawInitial),rawTerminal=json(m.rawTerminal);assert.equal(rawInitial.chunk_id,'e1a76f','MAKER original initial tool chunk');assert.equal(rawInitial.session_id,2152,'MAKER original tool session');assert.equal(rawTerminal.chunk_id,'9a806c','MAKER original closing tool chunk');assert.equal(rawTerminal.exit_code,0,'MAKER original closing tool exit');assert.ok(!Object.hasOwn(rawTerminal,'session_id'),'MAKER tool truly closed');
  const exit=json(m.ownedExit);validateNoGlobalCimPayload(exit);assert.equal(exit.accepted,true,'MAKER independent task-owned exit receipt');equal(exit.terminal,{closed:true,sessionId:2152,initialChunk:'e1a76f',terminalChunk:'9a806c',exitCode:0},'MAKER owned receipt original terminal');equal(exit.result,m.top,'MAKER exit receipt result binding');equal(exit.rawTerminal,m.rawTerminal,'MAKER owned receipt raw terminal binding');assert.equal(exit.observedCohortCount,12,'MAKER independent task-owned cohort count');assert.equal(exit.recordedProcessIds?.length,12,'MAKER independent task-owned cohort identities');
  for(const key of ['allObservedPidsAbsent','controllerAbsent','originalOwnedTreeExited','noOriginalRootDescendants','noExactProfileProcesses','privatePortsNoListeners','user8080ListenersUnchanged','profileDeletedByOriginalRunner','monitorEndedNaturally'])assert.equal(exit.observation?.[key],true,'MAKER task-owned exit observation: '+key);
  equal(exit.observation.privatePorts,[12189,12188],'MAKER exact private ports');equal(exit.operations,{browserConnections:0,newNativeInputs:0,processStops:0,profileChanges:0,projectSourceChanges:0},'MAKER monitor only observed');
  return{accepted:true,scope:'Native MAKER title-only baseline plus task-owned OS exit proof',sessions,logicalCapturePngs:m.capturePins.length,phaseScreenshots:m.phasePins.length,nativeReferencePngs:m.nativeReferencePins.length,imagePacketGroups:m.groups.length,recordedSourceCount:1087,currentAll1087SourcesRechecked:false,ownedCohort:12,globalCimOriginalsArchived:false,globalCimOnlyLocalPins:true,exactTimer1CountingAccepted:false,allSpeAccepted:false,performanceAccepted:false,realDeviceAccepted:false,hdAccepted:false};
}
