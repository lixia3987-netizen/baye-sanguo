// Controlled native ABI/public-getter VM fixtures; no native C or browser execution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {fixture as abiFixture,aidRawScenarios,readAidPublic} from './hd-aid-native-test-fixture.mjs';
const source=readFileSync(new URL('../js/hd-spe.js',import.meta.url),'utf8');
const battleSource=readFileSync(new URL('../js/hd-mobile-battle.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8'));
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const SHA=createHash('sha256').update(lib).digest('hex');
assert.equal(SHA,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
assert.equal(lib.length,207195);
const rawCases=aidRawScenarios();
function fixture(which='aid17-first0',options={}) {
 let raw=structuredClone(options.rawGlobals||rawCases.find(x=>x.name===which).rawGlobals),published=readAidPublic(raw),data,available=true,mode='hd',hidden=false,ready=true,report=0,ownerKey='current-movie';
 let identity={status:'ready',sha256:SHA,byteLength:lib.length,generation:7,reason:'ready'},ticketHook=null;
 const keys=[],writes=[],preferences=[],images=[],draws=[],presentations=[],nodes=new Map(),polls=new Map(),listeners=new Map();let timerId=0;
 const readonly=o=>new Proxy(o,{set(){writes.push('write');throw Error('native write');}});data=readonly(raw);
 const context2d=new Proxy({}, {get(o,k){if(k in o)return o[k];return (...args)=>draws.push({operation:k,args});},set(o,k,v){o[k]=v;return true;}});
 function node(id){const classes=new Set(),attrs={},handlers={};const n={id,width:640,height:384,hidden:false,style:{},
  classList:{toggle(k,v){v?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)},setAttribute(k,v){attrs[k]=v;},getAttribute:k=>attrs[k],
  addEventListener(k,f){(handlers[k]||=[]).push(f);},getContext:()=>context2d,handlers};nodes.set(id,n);return n;}
 for(const id of ['hd-spe','hd-spe-canvas','hd-spe-title','hd-spe-skip','hd-spe-return','lcd','html'])node(id);
 const document={body:{classList:{contains:name=>name==='hd-mobile-page'}},get hidden(){return hidden;},documentElement:nodes.get('html'),getElementById:id=>nodes.get(id),createElement:()=>node('scratch-'+nodes.size),
  addEventListener(k,f){(listeners.get(k)||listeners.set(k,[]).get(k)).push(f);}};
 class Image{set src(url){this.url=url;images.push(this);}}
 const identityApi={read:()=>identity,isCurrent:i=>i.status==='ready'&&i.generation===identity.generation&&i.sha256===identity.sha256&&i.byteLength===identity.byteLength,
  subscribe:f=>{(listeners.get('identity')||listeners.set('identity',[]).get('identity')).push(f);if(options.initialIdentityCallback)f();return()=>{};}};
 const c=vm.createContext({console,document,Image,baye:{get data(){return data;},hd:{ready:()=>ready,spe:()=>published.publicSpe,attack:()=>published.publicAttack||null,
  skillResult:()=>published.publicSkillResult,resultOwner:()=>published.publicResultOwner,maker:()=>null,fight:()=>({active:1}),report:()=>({active:report})}},
  BayeHdLibIdentity:identityApi,localStorage:{getItem(k){preferences.push(k);throw Error('mobile must not read PC preference');},setItem(k){preferences.push(k);throw Error('preference write');}},
  sendKey:k=>keys.push(k),setInterval:f=>{polls.set(++timerId,f);return timerId;},clearInterval:id=>polls.delete(id),setTimeout(){throw Error('unexpected playback timer');},clearTimeout(){}});
 c.window=c;vm.runInContext(source,c,{filename:'js/hd-spe.js'});const api=c.BayeHdSpe;
 const host={isAvailable:()=>available,readTicket(){if(ticketHook)ticketHook();return{data,key:ownerKey,libraryGeneration:identity.generation,presentation:'lcd',kind:0,seq:3,actor:0};},
  getMode:()=>mode,onPresentation:p=>presentations.push(p)};
 if(options.configure!==false)api.applyMobilePage(host);api.setManifest({...manifest,entries:options.entries===undefined?manifest.entries.filter(e=>options.effect?e[options.effect+'Version']===1:e.speId===41):options.entries});
 function resolve(failed=false){for(const image of images){if(image.done)continue;image.done=true;const pic=manifest.entries.flatMap(e=>[...e.pictures,e.background].filter(Boolean)).find(p=>p.src===image.url);assert.ok(pic);image.naturalWidth=pic.width;image.naturalHeight=pic.height;((typeof failed==='function'?failed(image):failed)?image.onerror:image.onload)();}}
 return {api,c,nodes,keys,writes,preferences,images,draws,presentations,polls,listeners,
  flush(){api.onLcdFlush({fixture:'current native LCD'},640,384);},resolve,
  snapshot:()=>api.debugSnapshot(),
  setMode(v,notify=true){mode=v;if(notify)api.blit();},setAvailable(v){available=v;api.retireInteraction('lifecycle');api.blit();},
  setHidden(v){hidden=v;api.retireInteraction('visibility');api.blit();},
  setReport(v){report=v;api.onEngineSpe();},setReady(v){ready=v;api.blit();},
  setIdentity(change){identity={...identity,...change};for(const fn of listeners.get('identity')||[])fn();},
  rebind(){raw=structuredClone(raw);data=readonly(raw);api.blit();},
   changeRaw(change){change(raw);published=readAidPublic(raw);api.blit();},
  retireNative(){published={...published,publicSpe:{...published.publicSpe,active:0},publicSkillResult:{active:false},publicResultOwner:{active:false}};api.blit();},
  setKind(k){published.publicSpe={...published.publicSpe,kind:k};api.blit();},
  torn(){let i=0;ticketHook=()=>{ownerKey='owner-'+(++i);};api.blit();},
  noInput(){assert.deepEqual(keys,[]);assert.deepEqual(writes,[]);assert.deepEqual(preferences,[]);}
 };
}
function hdFixture(name){const h=fixture(name);h.flush();h.resolve();assert.equal(h.api.getLcdPresentation(),'hd');return h;}
// Controlled ABI inputs use real ROM identities; these are not C or browser captures.
function opaqueSkillFixture(effect,{hold=false,current=0,display=current,mutateRaw=null}={}) {
 const {resourceId,skillId,width,length,fingerprint}=effect;
 const f=abiFixture();if(hold)f.hold();else f.movie(6,current,display);
 const offset=lib.readUInt32LE((resourceId-1)*4),payload=lib.subarray(offset+14,offset+14+lib.readUInt32LE(offset+8));
 let hash=2166136261;for(const byte of payload)hash=Math.imul(hash^byte,16777619)>>>0;
 assert.equal(payload.length,length);assert.equal(hash,fingerprint);
 Object.assign(f.raw,{g_hdSpeId:resourceId,g_hdSpeSkillId:skillId,g_hdSpeEndFrm:7,g_hdSpeResourceFingerprint:hash,g_hdSpeResourceLength:payload.length});
 for(const p of ['g_hdSpe','g_hdSpeDisplay'])Object.assign(f.raw,{[p+'SceneMode']:2,[p+'SceneWidth']:width});
 if(hold){Object.assign(f.raw,{g_hdSkillResultId:resourceId,g_hdSkillResultSkillId:skillId,g_hdSkillResultResourceFingerprint:hash,g_hdSkillResultResourceLength:payload.length});
  for(const p of ['g_hdSkillResult','g_hdSkillResultDisplay'])Object.assign(f.raw,{[p+'SceneMode']:2,[p+'SceneWidth']:width});}
 if(mutateRaw)mutateRaw(f.raw);
 f.untouched();return fixture(undefined,{effect:effect.name,rawGlobals:structuredClone(f.raw)});
}
const opaqueSkills=[{name:'fire',label:'FIRE5',resourceId:35,skillId:5,width:65,length:1212,fingerprint:0x0bf53f74,path:'fire-35'},
 {name:'water',label:'WATER12',resourceId:36,skillId:12,width:64,length:1084,fingerprint:0x6d62e7a8,path:'water-36'},
 {name:'stone',label:'STONE23',resourceId:42,skillId:23,width:64,length:1084,fingerprint:0x0e6f8d97,path:'stone-42',stateOnly:true},
 {name:'fire',label:'FIRE11',resourceId:35,skillId:11,width:65,length:1212,fingerprint:0x0bf53f74,path:'fire-35',movieOnly:true},
 {name:'fire',label:'FIRE18',resourceId:35,skillId:18,width:65,length:1212,fingerprint:0x0bf53f74,path:'fire-35'},
 {name:'water',label:'WATER19',resourceId:36,skillId:19,width:64,length:1084,fingerprint:0x6d62e7a8,path:'water-36'}];
function modeButtonFixture(effect) {
 const listeners={},nodes=new Map(),calls=[],raw={},positions=Array.from({length:20},()=>({x:0,y:0,move:0,active:0,state:8,hp:0,mp:0}));let mode='hd',top=null;
 const fields={active:'g_hdFightActive',over:'g_hdFightOver',wait:'g_hdFightWait',phase:'g_hdFightPhase',aimType:'g_hdFightAimType',inputKind:'g_hdFightInputKind',inputSeq:'g_hdFightInputSeq',actorIndex:'g_hdFightActor',skip:'g_hdFightSkip',mapW:'g_MapWid',mapH:'g_MapHgt',bout:'g_FgtBoutCnt',boutMax:'g_FgtBoutMax',focusX:'g_FoucsX',focusY:'g_FoucsY'};
 Object.values(fields).forEach(name=>raw[name]=0);Object.assign(raw,{g_hdFightActive:1,g_hdFightInputSeq:7,g_MapWid:20,g_MapHgt:20,g_FgtBoutMax:20,g_hdEngineReady:1,g_hdDetailGeneration:1,g_PIdx:3,g_hdMenuActive:0,g_hdMenuContext:0,g_hdMenuKind:0,g_hdMenuSeq:1,g_hdMenuCount:0,g_hdMenuIndex:0,g_hdSkillActive:0,g_FgtParam:{CityIndex:32,GenArray:Array(20).fill(0)},g_GenPos:positions});
 for(const name of ['Report','Help','View','MiniMap','Movie','Spe','Attack','SkillResult','Maker','Record','Qty'])raw['g_hd'+name+'Active']=0;raw.g_hdSpeActive=1;raw.g_hdMovieActive=1;raw.g_hdResultOwnerKind=2;raw.g_hdResultOwnerValid=1;
 const data=new Proxy(raw,{set(){throw Error('native write');}}),identity={status:'ready',sha256:SHA,byteLength:207195,generation:7};
 function node(id,tag='DIV',parent=null){const attrs={},n={id,nodeType:1,tagName:tag,parentElement:parent,hidden:false,disabled:false,isConnected:true,style:{},querySelector(){return null;},setAttribute(k,v){attrs[k]=v;},getAttribute:k=>attrs[k]??null,contains(other){for(let p=other;p;p=p.parentElement)if(p===n)return true;return false;},getBoundingClientRect:()=>({left:10,top:10,width:80,height:44})};nodes.set(id,n);return n;}
 const body=node('body'),root=node('hd-battle','DIV',body),header=node('hd-mobile-battle-toggle','BUTTON',body),footer=node('hd-mobile-battle-mode','BUTTON',root);body.classList={contains:name=>name==='hd-mobile-page'};
 const document={body,hidden:false,getElementById:id=>nodes.get(id),addEventListener(k,f){(listeners[k]||=[]).push(f);},elementFromPoint:()=>top};
 const shared={getMode:()=>mode,setMode(value){calls.push('setMode:'+value);mode=value;effect.setMode(value,false);},applyMobilePage(){},retireInteraction:reason=>calls.push('battleRetire:'+reason),getLcdPresentation:()=> 'passthrough'};
 const env={document,innerWidth:844,innerHeight:390,addEventListener(){},setInterval(){return 1;},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),BayeHdBattle:shared,BayeHdLibIdentity:{read:()=>identity,isCurrent:i=>i===identity,subscribe(){}},baye:{data,hd:{ready:()=>true,fight:()=>Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,raw[v]]).concat([['cityIndex',32]])),menuItems:()=>({active:0})}},BayeHdSpe:{applyMobilePage(options){this.options=options;},retireInteraction(reason){calls.push('speRetire:'+reason);effect.api.retireInteraction(reason);}}};
 const context=vm.createContext({window:env});vm.runInContext(battleSource,context);env.BayeHdMobileBattle.init();assert.equal(env.BayeHdMobileBattle.readNativeTicket().presentation,'lcd');
 function fire(type,target,extra={}){top=target;const event={target,pointerId:1,isPrimary:true,isTrusted:true,button:0,clientX:30,clientY:30,preventDefault(){},stopImmediatePropagation(){},...extra};for(const fn of listeners[type]||[])fn(event);}
 return {calls,header,footer,raw,fire,click(target){fire('pointerdown',target);fire('pointerup',target);},get mode(){return mode;}};
}
// Army-skill fixtures below publish controlled ABI values from real ROM timer
// records. They exercise the actual bridge and mobile presenter, not game outcomes.
const armySkillCases=[{skillId:1,speId:19,start:11,end:21},{skillId:2,speId:19,start:11,end:21},
 {skillId:3,speId:19,start:11,end:21},{skillId:4,speId:19,start:11,end:21},
 {skillId:8,speId:20,start:10,end:20},{skillId:9,speId:21,start:9,end:17},{skillId:10,speId:21,start:9,end:17}];
const oldKind3Sha='13481c3a80cc4b77810db4f05332ccc7d3651bc1f2ee1fac34e568e550436047';
function armyResource(id,index=0){
 const at=lib.readUInt32LE((id-1)*4),count=lib.readUInt16LE(at+6),fixed=lib.readUInt32LE(at+8),length=lib.readUInt32LE(at);
 assert.ok(index>=0&&index<count);const offset=fixed?14+index*fixed:count===1?14:lib.readUInt32LE(at+14+index*8),bytes=fixed||(count===1?length-14:lib.readUInt32LE(at+18+index*8));return lib.subarray(at+offset,at+offset+bytes);
}
function armyFnv(bytes){let h=2166136261;for(const byte of bytes)h=Math.imul(h^byte,16777619)>>>0;return h;}
function armyBits(frames){const a=Array(32).fill(0);for(const frame of frames)a[frame>>3]|=1<<(frame&7);return a;}
function armyMovie(which){
 const bytes=armyResource(which.speId),units=Array.from({length:bytes[2]},(_,frame)=>{const at=6+frame*5;return{frame,x:bytes[at],y:bytes[at+1],cdelay:bytes[at+2],ndelay:bytes[at+3],picIndex:bytes[at+4]};}),pictures=[];
 let at=6+units.length*5;for(let picIndex=0;picIndex<bytes[3];picIndex++){const width=bytes.readUInt16LE(at),height=bytes.readUInt16LE(at+2),count=bytes.readUInt16LE(at+4),mask=bytes[at+6];pictures.push({picIndex,width,height,count,mask});at+=7+Math.ceil(width/8)*height*(mask+1);}
 assert.equal(at,bytes.length);return{bytes,units,pictures,count:units.length,picmax:bytes[3],fingerprint:armyFnv(bytes)};
}
function armyTimerRecords(which,movie=armyMovie(which)){
 const units=movie.units.slice(which.start,which.end+1),copy=units.map(u=>u.cdelay),next=units.map(u=>u.ndelay),records=[],erased=new Set();let frontier=0,lastPainted=0,clear=true,show=true;
 for(let tick=0;tick<100000;tick++){
  for(let i=0;i<=frontier;i++){if(copy[i]===1){erased.add(which.start+i);clear=true;}if(copy[i])copy[i]--;}
  if(clear||show){records.push({frame:which.start+frontier,commitSeq:records.length+1,visible:Array.from({length:frontier+1},(_,i)=>which.start+i).filter(f=>copy[f-which.start]>0),clears:[...erased].sort((a,b)=>a-b)});clear=show=false;lastPainted=frontier;}
  if(next[frontier])next[frontier]--;while(next[frontier]<=1&&frontier+which.start<which.end){frontier++;show=true;}
  if(frontier+which.start>=which.end&&copy.every(v=>v<=1)){assert.ok(lastPainted<=frontier);return records;}
 }
 throw Error('Real army movie timer bound');
}
function armyEntry(which){
 const entries=manifest.entries.filter(e=>e.armySkillVersion===1&&e.skillId===which.skillId);assert.equal(entries.length,1,'Exactly one actually published army entry for skill'+which.skillId);return entries[0];
}
function armySkillFixture(which,{phase='movie',commit=0,display=commit,mutateRaw=null,entries}={}){
 const movie=armyMovie(which),records=armyTimerRecords(which,movie),current=records[commit],shown=records[display];assert.ok(current&&shown&&display<=commit);
 const f=abiFixture();f.hold();const raw=f.raw,background=armyResource(16);
 function scene(prefix,r){Object.assign(raw,{[prefix+'SceneMode']:1,[prefix+'SceneX']:15,[prefix+'SceneY']:16,[prefix+'SceneWidth']:130,[prefix+'SceneHeight']:64,[prefix+'VisibleFrames']:armyBits(r.visible),[prefix+'ClearFrames']:armyBits(r.clears)});}
 function backdrop(prefix){f.picture(prefix,16,background);raw[prefix+'OriginX']=15;raw[prefix+'OriginY']=16;}
 Object.assign(raw,{g_hdSpeActive:phase==='movie'?1:0,g_hdSpeId:which.speId,g_hdSpeKind:2,g_hdSpeCount:movie.count,g_hdSpePicmax:movie.picmax,g_hdSpeStartFrm:which.start,g_hdSpeEndFrm:which.end,g_hdSpeOriginX:15,g_hdSpeOriginY:16,
  g_hdSpeSkillId:which.skillId,g_hdSpeResourceLength:movie.bytes.length,g_hdSpeResourceFingerprint:movie.fingerprint,g_hdSpeCommitSeq:current.commitSeq,g_hdSpeFrameIndex:current.frame,
  g_hdSpeDisplayCommitSeq:shown.commitSeq,g_hdSpeDisplayFrameIndex:shown.frame,g_hdSpeCompositionValid:1,g_hdSpeDisplayCompositionValid:1,
  g_hdSkillResultSkillId:which.skillId,g_hdSkillResultId:which.speId,g_hdSkillResultResourceLength:movie.bytes.length,g_hdSkillResultResourceFingerprint:movie.fingerprint,
  g_hdSkillResultCount:movie.count,g_hdSkillResultPicmax:movie.picmax,g_hdSkillResultStartFrm:which.start,g_hdSkillResultEndFrm:which.end,g_hdSkillResultOriginX:15,g_hdSkillResultOriginY:16,
  g_hdSkillResultPhase:phase==='movie'?1:phase==='numbers'?2:3,g_hdSkillResultValue:phase==='movie'?0:240,
  g_hdSkillResultCommitSeq:current.commitSeq,g_hdSkillResultFrameIndex:current.frame,g_hdSkillResultDisplayCommitSeq:shown.commitSeq,g_hdSkillResultDisplayFrameIndex:shown.frame});
 scene('g_hdSpe',current);scene('g_hdSpeDisplay',shown);scene('g_hdSkillResult',current);scene('g_hdSkillResultDisplay',shown);
 for(const prefix of ['g_hdSpeBg','g_hdSpeDisplayBg','g_hdSkillResultBg','g_hdSkillResultDisplayBg'])backdrop(prefix);
 if(phase==='movie'){for(const prefix of ['g_hdSkillResult','g_hdSkillResultDisplay'])Object.assign(raw,{[prefix+'LabelValid']:0,[prefix+'LabelLength']:0,[prefix+'DigitCount']:0});}
 if(phase==='numbers'){for(const prefix of ['g_hdSkillResult','g_hdSkillResultDisplay']){raw[prefix+'DigitDrawCount'][2]=3;raw[prefix+'DigitY'][2]=54;}}
 if(mutateRaw)mutateRaw(raw);f.untouched();const h=fixture(undefined,{effect:'armySkill',rawGlobals:structuredClone(raw),entries});return{h,movie,records,current,shown,entry:()=>armyEntry(which)};
}
function assertArmyPaint(f,phase){
 const {h,shown}=f,e=f.entry(),s=h.snapshot();assert.equal(h.api.getLcdPresentation(),'hd');assert.equal(s.source,'hd-assets');assert.equal(s.mobileHost,true);
 assert.deepEqual(JSON.parse(JSON.stringify(s.sourceRect)),{x:0,y:0,width:160,height:96});assert.deepEqual([s.hdRegion.x,s.hdRegion.y,s.hdRegion.width,s.hdRegion.height],[15,16,130,64]);assert.equal(160*96-130*64,7040);assert.equal(s.outsideSource,'lcd');assert.equal(s.skipVisible,false);
 assert.deepEqual(Array.from(s.displayedFrames),shown.visible);const expected=[{src:e.background.src,rect:[15*s.scale,16*s.scale,130*s.scale,64*s.scale]},...shown.visible.map(frame=>{const u=f.movie.units[frame],p=e.pictures.find(p=>p.picIndex===u.picIndex);assert.ok(p?.src);return{src:p.src,rect:[(15+u.x)*s.scale,(16+u.y)*s.scale,p.logicalWidth*s.scale,p.logicalHeight*s.scale]};})];
 const images=h.draws.filter(d=>d.operation==='drawImage'&&d.args[0]?.url),last=images.slice(-expected.length);assert.equal(last.length,expected.length);assert.deepEqual(last.map(d=>({src:d.args[0].url,rect:d.args.slice(1)})),expected,'Actual native display bitmap determines background and transparent foreground draw order');
 for(const d of h.draws.filter(d=>d.operation==='fillRect')){const [x,y,w,z]=d.args;assert.ok(x>=15*s.scale&&y>=16*s.scale&&x+w<=145*s.scale&&y+z<=80*s.scale,'No invented fill on the7040 outside LCD pixels');}
 assert.ok(h.draws.some(d=>d.operation==='drawImage'&&!d.args[0]?.url&&d.args.slice(-4).every(Number.isFinite)),'Full flushed native framebuffer is retained');
 if(phase==='numbers'||phase==='hold'){assert.equal(s.presentation,'skill-postlude');assert.equal(s.skillResult.resultKind,1);assert.equal(s.skillResult.value,240);const text=h.draws.filter(d=>d.operation==='fillText').map(d=>d.args[0]);assert.ok(text.includes('兵力减少'));for(const digit of ['2','4','0'])assert.ok(text.includes(digit));}
 h.noInput();
}

function runArmyMobileSpeChecks(register){
 register('mobile army skills use seven separate actual-ROM entries without changing old kind3 entries',()=>{
  assert.equal(manifest.entries.filter(e=>e.armySkillVersion===1).length,7);assert.equal(manifest.entries.filter(e=>e.kind===3).length,37);assert.equal(createHash('sha256').update(JSON.stringify(manifest.entries.filter(e=>e.kind===3))).digest('hex'),oldKind3Sha);
  for(const which of armySkillCases){const e=armyEntry(which),m=armyMovie(which),b=armyResource(16);assert.deepEqual([e.kind,e.speId,e.resourceIndex,e.startFrm,e.endFrm,e.compositionVersion,e.opaqueCoverageVersion,e.skillResultVersion],[2,which.speId,0,which.start,which.end,1,1,1]);assert.equal(e.units.length,m.count);assert.equal(e.count,m.count);assert.equal(e.picmax,m.picmax);assert.equal(e.resourceLength,m.bytes.length);assert.equal(e.resourceFingerprint,'fnv1a32:'+m.fingerprint.toString(16).padStart(8,'0')+':'+m.bytes.length);
   assert.deepEqual([e.background.id,e.background.resourceIndex,e.background.nativeWidth,e.background.nativeHeight,e.background.mask,e.background.x,e.background.y,e.background.resourceLength],[16,0,130,64,0,15,16,b.length]);assert.equal(e.background.resourceFingerprint,'fnv1a32:'+armyFnv(b).toString(16).padStart(8,'0')+':'+b.length);assert.equal(e.skillNumber.id,15);
   for(let frame=which.start;frame<=which.end;frame++){const u=m.units[frame];assert.deepEqual({frame:e.units[frame].frame,x:e.units[frame].x,y:e.units[frame].y,picIndex:e.units[frame].picIndex},u&&{frame:u.frame,x:u.x,y:u.y,picIndex:u.picIndex});const p=e.pictures.find(p=>p.picIndex===u.picIndex),r=m.pictures[u.picIndex];assert.ok(p?.src);assert.deepEqual([p.nativeWidth,p.nativeHeight,p.mask],[r.width,r.height,r.mask]);}
  }
 });
 for(const which of armySkillCases){const title='mobile army skill'+which.skillId+' SPE'+which.speId;
  for(const phase of ['first movie','overlap movie','final movie','numbers','hold'])register(title+' '+phase+' preserves full LCD and certified background/foreground',()=>{
   const records=armyTimerRecords(which),index=phase==='first movie'?0:phase==='overlap movie'?records.findIndex(r=>r.visible.length>1):records.length-1;assert.ok(index>=0);const p=phase==='numbers'||phase==='hold'?phase:'movie',f=armySkillFixture(which,{phase:p,commit:index});f.h.flush();f.h.resolve();assertArmyPaint(f,p);
  });
  register(title+' real display lag cannot paint a later copied frame',()=>{const records=armyTimerRecords(which),f=armySkillFixture(which,{commit:Math.min(3,records.length-1),display:0});f.h.flush();f.h.resolve();assertArmyPaint(f,'movie');assert.equal(f.shown.frame,which.start);});
  register(title+' wrong caller, unknown context, crop or background stays full physical LCD',()=>{
   for(const mutateRaw of [r=>r.g_hdSpeSkillId=5,r=>r.g_hdSpeContextKnown=0,r=>r.g_hdSpeActorIndex=20,r=>r.g_hdSpeBgWidth=129,r=>r.g_hdSpeDisplayBgOriginX=16,r=>r.g_hdSpeSceneWidth=64,r=>r.g_hdSpeEndFrm=which.end+1]){const f=armySkillFixture(which,{mutateRaw});f.h.flush();f.h.resolve();assert.notEqual(f.h.api.getLcdPresentation(),'hd');assert.equal(f.h.api.isOpen(),false);f.h.noInput();}
  });
  register(title+' mismatched result session and late completion cannot revive a retired hold',()=>{const records=armyTimerRecords(which),f=armySkillFixture(which,{phase:'hold',commit:records.length-1});f.h.flush();f.h.changeRaw(r=>r.g_hdSkillResultDisplaySession++);f.h.resolve();assert.notEqual(f.h.api.getLcdPresentation(),'hd');assert.equal(f.h.api.isOpen(),false);f.h.noInput();});
  register(title+' coherent new result session requires its own current LCD flush',()=>{const records=armyTimerRecords(which),f=armySkillFixture(which,{phase:'hold',commit:records.length-1});f.h.flush();f.h.resolve();f.h.changeRaw(r=>{r.g_hdSkillResultSession++;r.g_hdSkillResultDisplaySession++;r.g_hdResultOwnerSession++;});assert.equal(f.h.api.isOpen(),false);f.h.flush();f.h.resolve();assertArmyPaint(f,'hold');});
  register(title+' opaque data rebinding cannot reuse the old native framebuffer',()=>{const f=armySkillFixture(which);f.h.flush();f.h.resolve();f.h.rebind();assert.equal(f.h.api.isOpen(),false);f.h.flush();assertArmyPaint(f,'movie');});
  register(title+' missing transparent art or opaque background does not cover physical LCD',()=>{for(const part of ['background','foreground']){const f=armySkillFixture(which),e=f.entry();f.h.flush();f.h.resolve(image=>part==='background'?image.url===e.background.src:image.url!==e.background.src);assert.equal(f.h.api.getLcdPresentation(),'lcd');assert.equal(f.h.api.isOpen(),false);assert.equal(f.h.api.skip(),false);f.h.noInput();}});
  register(title+' classic mode restores LCD and needs a fresh flush before HD returns',()=>{const f=armySkillFixture(which);f.h.flush();f.h.resolve();f.h.setMode('classic');assert.equal(f.h.api.getLcdPresentation(),'off');assert.equal(f.h.api.isOpen(),false);f.h.setMode('hd');assert.equal(f.h.api.isOpen(),false);f.h.flush();assertArmyPaint(f,'movie');});
  register(title+' native report or retirement rejects delayed image completion with zero keys',()=>{for(const why of ['report','retire']){const f=armySkillFixture(which);f.h.flush();why==='report'?f.h.setReport(1):f.h.retireNative();f.h.resolve();assert.equal(f.h.api.isOpen(),false);assert.equal(f.h.api.getLcdPresentation(),'off');f.h.noInput();}});
  register(title+' pending or unknown LIB never authorizes a copied composition',()=>{for(const change of [{status:'pending'},{sha256:'0'.repeat(64)},{byteLength:207196}]){const f=armySkillFixture(which);f.h.flush();f.h.resolve();f.h.setIdentity(change);assert.equal(f.h.api.getLcdPresentation(),'off');assert.equal(f.h.api.isOpen(),false);f.h.noInput();}});
  register(title+' decoding without a native flush is not HD acceptance',()=>{const f=armySkillFixture(which);f.h.resolve();assert.equal(f.h.api.isOpen(),false);f.h.flush();assertArmyPaint(f,'movie');});
 }
}

export function runMobileSpeChecks(register=test){
 register('mobile public AID movie uses the current native commit with an LCD-only battle base ticket',()=>{const h=hdFixture();assert.equal(h.snapshot().source,'hd-assets');assert.equal(h.snapshot().mobileHost,true);assert.equal(h.api.isOpen(),true);assert.equal(h.api.isHandling(),true);h.noInput();});
 register('mobile asset loading keeps the physical LCD touchable and does not open a copied-LCD overlay',()=>{const h=fixture();h.flush();assert.equal(h.api.getLcdPresentation(),'lcd');assert.equal(h.api.isOpen(),false);assert.equal(h.nodes.get('hd-spe').style.pointerEvents,'none');assert.equal(h.api.isHandling(),false);h.noInput();});
 register('mobile image 404 keeps LCD fallback and all game inputs unchanged',()=>{const h=fixture();h.flush();h.resolve(true);assert.equal(h.api.getLcdPresentation(),'lcd');assert.equal(h.snapshot().fallbackReason,'asset-load-failed');assert.equal(h.api.isOpen(),false);h.noInput();});
 register('mobile decoded assets cannot display before a real current LCD flush',()=>{const h=fixture();h.resolve();assert.equal(h.api.getLcdPresentation(),'lcd');assert.equal(h.api.isOpen(),false);h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register('mobile AID ARMS_GAIN zero hold remains a real current numeric owner',()=>{const h=hdFixture('aid17-zero-hold');assert.equal(h.snapshot().mobilePresentation,'hd');assert.equal(h.snapshot().skillResult.value,0);assert.equal(h.snapshot().spe.active,0);h.noInput();});
 register('mobile displayed-frame lag consumes the actual public display ticket',()=>{const h=hdFixture('aid17-current3-display0');assert.deepEqual(Array.from(h.snapshot().displayedFrames),[0]);h.noInput();});
 for(const [name,change] of [['wrong SHA',{sha256:'0'.repeat(64)}],['wrong LIB length',{byteLength:207196}],['pending identity',{status:'pending'}]])register('mobile rejects '+name,()=>{const h=hdFixture();h.setIdentity(change);assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);h.noInput();});
 register('mobile library generation replacement needs a new actual flush',()=>{const h=hdFixture();h.setIdentity({generation:8});assert.equal(h.api.isOpen(),false);assert.equal(h.api.getLcdPresentation(),'lcd');h.flush();h.resolve();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register('mobile same-primitive data rebinding retires old framebuffer until new flush',()=>{const h=hdFixture();h.rebind();assert.equal(h.api.isOpen(),false);assert.equal(h.api.getLcdPresentation(),'lcd');h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register('mobile torn host owner is never a presentation authority',()=>{const h=hdFixture();h.torn();assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);h.noInput();});
 for(const name of ['hidden','portrait or blur/pagehide'])register('mobile '+name+' immediately retires the picture without sending keys',()=>{const h=hdFixture();name==='hidden'?h.setHidden(true):h.setAvailable(false);assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);h.noInput();});
 register('mobile lifecycle restore does not reuse an old picture',()=>{const h=hdFixture();h.setAvailable(false);h.setAvailable(true);assert.equal(h.api.isOpen(),false);h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register('mobile classic mode uses only the independent host preference',()=>{const h=hdFixture();h.setMode('classic');assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);assert.equal(h.api.useClassic(),false);h.noInput();});
 register('mobile native report retires SPE and does not consume its first key',()=>{const h=hdFixture();h.setReport(1);assert.equal(h.api.isOpen(),false);assert.equal(h.api.getLcdPresentation(),'off');assert.equal((h.listeners.get('keydown')||[]).length,0);h.noInput();});
 register('mobile native retirement prevents late asset completion from reviving its movie',()=>{const h=fixture();h.flush();h.retireNative();h.resolve();assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);h.noInput();});
 register('mobile ordinary attack and map status without certified assets fall back to physical LCD',()=>{for(const kind of [3,4]){const h=fixture();h.setKind(kind);h.flush();h.resolve();assert.equal(h.api.getLcdPresentation(),'lcd');assert.equal(h.api.isOpen(),false);h.noInput();}});
 register('mobile opening and Maker never inherit PC preferences or skip/return controls',()=>{const h=fixture();h.setKind(1);assert.equal(h.api.isOpen(),false);assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.skip(),false);assert.equal(h.api.returnToTitle('anything'),false);assert.equal((h.nodes.get('hd-spe').handlers.click||[]).length,0);h.noInput();});
 register('mobile prepareStart continues exactly once without native pre-main reads or timers',()=>{const h=fixture();let count=0;h.c.baye.hd.ready=()=>{throw Error('native before main');};h.api.prepareStart(result=>{count++;assert.equal(result.reason,'mobile-battle-only');});assert.equal(count,1);h.noInput();});
 register('mobile start is idempotent and never binds PC input listeners',()=>{const h=fixture();h.api.start();h.api.start();assert.equal(h.polls.size,1);assert.equal((h.listeners.get('keydown')||[]).length,0);assert.deepEqual(Object.keys(h.nodes.get('hd-spe').handlers),[]);h.noInput();});
 register('mobile host lifecycle dispatch retires SPE and resolves auto only from the mobile map',()=>{const config=[],events={},docEvents={};let retired=0,mode='auto',mapMode='classic';const d={body:{classList:{contains:()=>true},setAttribute(){}},hidden:false,getElementById:()=>null,addEventListener(k,f){(docEvents[k]||=[]).push(f);}};
  const env={document:d,innerWidth:844,innerHeight:390,addEventListener(k,f){(events[k]||=[]).push(f);},setInterval(){return 1;},BayeHdOverworld:{getMode:()=>mapMode},BayeHdBattle:{getMode:()=>mode,applyMobilePage(){},retireInteraction(){}},BayeHdSpe:{applyMobilePage:x=>config.push(x),retireInteraction:()=>retired++}};
  const c=vm.createContext({window:env});vm.runInContext(battleSource,c);env.BayeHdMobileBattle.init();assert.equal(config.length,1);assert.equal(config[0].getMode(),'classic');assert.equal(config[0].isAvailable(),true);mapMode='hd-map';assert.equal(config[0].getMode(),'hd');mode='classic';assert.equal(config[0].getMode(),'classic');mode='hd';assert.equal(config[0].getMode(),'hd');
  assert.ok(battleSource.includes("'g_hdMovieActive','g_hdSpeActive','g_hdAttackActive','g_hdSkillResultActive'"));assert.equal(retired,0);for(const event of ['resize','orientationchange','blur','pagehide']){for(const fn of events[event]||[])fn();}d.hidden=true;for(const fn of docEvents.visibilitychange||[])fn();assert.equal(retired,5);assert.equal(config[0].isAvailable(),false);});
 register('mobile page before host configuration never reads PC preferences or binds PC keys',()=>{const h=fixture(undefined,{configure:false,initialIdentityCallback:true});h.api.start();h.flush();h.resolve();assert.equal(h.api.isOpen(),false);assert.equal(h.api.skip(),false);assert.equal(h.api.returnToTitle(),false);assert.equal(h.api.useClassic(),false);let count=0;h.c.baye.hd.ready=()=>{throw Error('pre-main native');};h.api.prepareStart(result=>{count++;assert.equal(result.reason,'mobile-battle-only');});assert.equal(count,1);assert.equal((h.listeners.get('keydown')||[]).length,0);h.noInput();});
 register('mobile unparsed auto cannot authorize an HD movie and classic restore needs a new native flush',()=>{const h=hdFixture();h.setMode('auto');assert.equal(h.api.isOpen(),false);assert.equal(h.api.getLcdPresentation(),'off');h.setMode('hd');assert.equal(h.api.isOpen(),false);h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register('mobile HTML and CSS use an independent stage overlay and true LCD touch fallback',()=>{const html=readFileSync(new URL('../m.html',import.meta.url),'utf8'),css=readFileSync(new URL('../css/hd-mobile.css',import.meta.url),'utf8');assert.ok(!html.includes('css/hd-spe.css'));assert.ok(html.indexOf('id="hd-spe"')>html.indexOf('id="hd-mobile-stage"'));assert.ok(html.indexOf('js/hd-spe.js')<html.indexOf('js/hd-mobile-battle.js'));assert.ok(css.includes('[data-hd-mobile-spe="lcd"] #lcd'));assert.ok(css.includes('pointer-events: auto !important;'));assert.ok(css.includes('@media (orientation: portrait)'));});
 register('trusted mobile header and footer mode UP synchronously retire the current SPE before changing mode',()=>{for(const name of ['header','footer']){const h=hdFixture(),host=modeButtonFixture(h);host.click(host[name]);assert.equal(host.mode,'classic');assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);assert.ok(host.calls.indexOf('speRetire:mode')<host.calls.indexOf('setMode:classic'));host.click(host.header);assert.equal(host.mode,'hd');assert.equal(h.api.getLcdPresentation(),'off');h.api.blit();h.resolve();assert.equal(h.api.isOpen(),false);h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();}});
 register('cancelled, multiple-pointer, untrusted or changed-owner mobile mode gestures cannot switch or retire SPE',()=>{for(const why of ['cancel','multiple','untrusted','owner']){const h=hdFixture(),host=modeButtonFixture(h);host.fire('pointerdown',host.header,{isTrusted:why!=='untrusted'});if(why==='cancel')host.fire('pointercancel',host.header);if(why==='multiple')host.fire('pointerdown',host.header,{pointerId:2,isPrimary:false});if(why==='owner')host.raw.g_hdFightInputSeq++;host.fire('pointerup',host.header);assert.equal(host.mode,'hd');assert.ok(!host.calls.includes('speRetire:mode'));assert.equal(h.api.isOpen(),true);h.noInput();}});

 for(const effect of opaqueSkills){const make=settings=>opaqueSkillFixture(effect,settings),label='mobile '+effect.label;
 for(const [name,settings]of [['first movie',{}],['display lag',{current:3,display:0}],['final movie',{current:7}],...(effect.stateOnly||effect.movieOnly)?[]:[['numeric hold',{hold:true}]]])register(label+' '+name+' retains a full LCD base and the actual '+effect.width+'x64 copied window',()=>{
  const h=make(settings);h.flush();h.resolve();const s=h.snapshot();
  assert.equal(s.source,'hd-assets');assert.equal(h.api.getLcdPresentation(),'hd');
  assert.deepEqual(JSON.parse(JSON.stringify(s.sourceRect)),{x:0,y:0,width:160,height:96});
  assert.deepEqual([s.hdRegion.x,s.hdRegion.y,s.hdRegion.width,s.hdRegion.height],[48,16,effect.width,64]);
  assert.equal(s.outsideSource,'lcd');assert.equal(s.skipVisible,false);
  const images=h.draws.filter(d=>d.operation==='drawImage'&&d.args[0]?.url?.includes('/'+effect.path+'/'));
  assert.ok(images.length);assert.deepEqual(images.at(-1).args.slice(1),[48*s.scale,16*s.scale,effect.width*s.scale,64*s.scale]);
  if(!settings.hold)assert.equal(h.draws.filter(d=>d.operation==='fillRect').length,0,'No invented dark surround in movie');h.noInput();
 });
 register(label+' decode alone cannot authorize its old framebuffer',()=>{const h=make();h.resolve();assert.equal(h.api.getLcdPresentation(),'lcd');assert.equal(h.api.isOpen(),false);h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register(label+' missing art keeps the physical LCD and never sends a skip',()=>{const h=make();h.flush();h.resolve(true);assert.equal(h.api.getLcdPresentation(),'lcd');assert.equal(h.api.isOpen(),false);assert.equal(h.api.skip(),false);h.noInput();});
 register(label+' same-value data replacement requires a fresh actual flush',()=>{const h=make();h.flush();h.resolve();h.rebind();assert.equal(h.api.isOpen(),false);assert.equal(h.api.getLcdPresentation(),'lcd');h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register(label+' classic mode retires the HD window and needs a new flush on return',()=>{const h=make({hold:!(effect.stateOnly||effect.movieOnly)});h.flush();h.resolve();h.setMode('classic');assert.equal(h.api.isOpen(),false);h.setMode('hd');assert.equal(h.api.isOpen(),false);h.flush();assert.equal(h.api.getLcdPresentation(),'hd');h.noInput();});
 register(label+' report or native retirement prevents late art revival',()=>{for(const why of ['report','retire']){const h=make();h.flush();if(why==='report')h.setReport(1);else h.retireNative();h.resolve();assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);h.noInput();}});
 register(label+' unknown LIB never becomes a presentation authority',()=>{const h=make();h.flush();h.resolve();h.setIdentity({sha256:'0'.repeat(64)});assert.equal(h.api.getLcdPresentation(),'off');assert.equal(h.api.isOpen(),false);h.noInput();});
 }

 for(const effect of opaqueSkills.filter(e=>[11,18,19].includes(e.skillId))){
  register('mobile '+effect.label+' rejects unknown or cross-family native context without a cropped fallback',()=>{
   for(const mutation of [r=>r.g_hdSpeContextKnown=0,r=>r.g_hdSpeSkillId=effect.resourceId===35?19:18,r=>r.g_hdSpeActorIndex=20]){
    const h=opaqueSkillFixture(effect,{mutateRaw:mutation});h.flush();h.resolve();
    assert.notEqual(h.api.getLcdPresentation(),'hd');assert.equal(h.api.isOpen(),false);h.noInput();
   }
  });
 }
 for(const phase of ['numbers','hold'])register('mobile FIRE11 pre-movie provisions-loss '+phase+' stays physicalLCD',()=>{
  const effect=opaqueSkills.find(e=>e.skillId===11);
  const h=opaqueSkillFixture(effect,{hold:true,mutateRaw(r){r.g_hdSkillResultResultKind=3;r.g_hdSkillResultId=0;r.g_hdSkillResultPhase=phase==='numbers'?2:3;}});
  h.flush();h.resolve();assert.notEqual(h.api.getLcdPresentation(),'hd');assert.equal(h.api.isOpen(),false);h.noInput();
 });

 runArmyMobileSpeChecks(register);
}
runMobileSpeChecks();
