// Controlled native ABI/public-getter VM fixtures; no native C or browser execution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {aidRawScenarios,readAidPublic} from './hd-aid-native-test-fixture.mjs';
const source=readFileSync(new URL('../js/hd-spe.js',import.meta.url),'utf8');
const battleSource=readFileSync(new URL('../js/hd-mobile-battle.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../assets/hd-spe/manifest.json',import.meta.url),'utf8'));
const lib=readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
const SHA=createHash('sha256').update(lib).digest('hex');
assert.equal(SHA,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
assert.equal(lib.length,207195);
const rawCases=aidRawScenarios();
function fixture(which='aid17-first0',options={}) {
 let raw=structuredClone(rawCases.find(x=>x.name===which).rawGlobals),published=readAidPublic(raw),data,available=true,mode='hd',hidden=false,ready=true,report=0,ownerKey='current-movie';
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
 if(options.configure!==false)api.applyMobilePage(host);api.setManifest({...manifest,entries:manifest.entries.filter(e=>e.speId===41)});
 function resolve(failed=false){for(const image of images){if(image.done)continue;image.done=true;const pic=manifest.entries.flatMap(e=>e.pictures).find(p=>p.src===image.url);assert.ok(pic);image.naturalWidth=pic.width;image.naturalHeight=pic.height;(failed?image.onerror:image.onload)();}}
 return {api,c,nodes,keys,writes,preferences,images,draws,presentations,polls,listeners,
  flush(){api.onLcdFlush({fixture:'current native LCD'},640,384);},resolve,
  snapshot:()=>api.debugSnapshot(),
  setMode(v,notify=true){mode=v;if(notify)api.blit();},setAvailable(v){available=v;api.retireInteraction('lifecycle');api.blit();},
  setHidden(v){hidden=v;api.retireInteraction('visibility');api.blit();},
  setReport(v){report=v;api.onEngineSpe();},setReady(v){ready=v;api.blit();},
  setIdentity(change){identity={...identity,...change};for(const fn of listeners.get('identity')||[])fn();},
  rebind(){raw=structuredClone(raw);data=readonly(raw);api.blit();},
  retireNative(){published={...published,publicSpe:{...published.publicSpe,active:0},publicSkillResult:{active:false},publicResultOwner:{active:false}};api.blit();},
  setKind(k){published.publicSpe={...published.publicSpe,kind:k};api.blit();},
  torn(){let i=0;ticketHook=()=>{ownerKey='owner-'+(++i);};api.blit();},
  noInput(){assert.deepEqual(keys,[]);assert.deepEqual(writes,[]);assert.deepEqual(preferences,[]);}
 };
}
function hdFixture(name){const h=fixture(name);h.flush();h.resolve();assert.equal(h.api.getLcdPresentation(),'hd');return h;}
function modeButtonFixture(effect) {
 const listeners={},nodes=new Map(),calls=[],raw={},positions=Array.from({length:20},()=>({x:0,y:0,move:0,active:0,state:8,hp:0,mp:0}));let mode='hd',top=null;
 const fields={active:'g_hdFightActive',over:'g_hdFightOver',wait:'g_hdFightWait',phase:'g_hdFightPhase',aimType:'g_hdFightAimType',inputKind:'g_hdFightInputKind',inputSeq:'g_hdFightInputSeq',actorIndex:'g_hdFightActor',skip:'g_hdFightSkip',mapW:'g_MapWid',mapH:'g_MapHgt',bout:'g_FgtBoutCnt',boutMax:'g_FgtBoutMax',focusX:'g_FoucsX',focusY:'g_FoucsY'};
 Object.values(fields).forEach(name=>raw[name]=0);Object.assign(raw,{g_hdFightActive:1,g_hdFightInputSeq:7,g_MapWid:20,g_MapHgt:20,g_FgtBoutMax:20,g_hdEngineReady:1,g_hdDetailGeneration:1,g_PIdx:3,g_hdMenuActive:0,g_hdMenuContext:0,g_hdMenuKind:0,g_hdMenuSeq:1,g_hdMenuCount:0,g_hdMenuIndex:0,g_hdSkillActive:0,g_FgtParam:{CityIndex:32,GenArray:Array(20).fill(0)},g_GenPos:positions});
 for(const name of ['Report','Help','View','MiniMap','Movie','Spe','Attack','SkillResult','Maker','Record','Qty'])raw['g_hd'+name+'Active']=0;raw.g_hdSpeActive=1;raw.g_hdMovieActive=1;raw.g_hdResultOwnerKind=2;raw.g_hdResultOwnerValid=1;
 const data=new Proxy(raw,{set(){throw Error('native write');}}),identity={status:'ready',sha256:SHA,byteLength:207195,generation:7};
 function node(id,tag='DIV',parent=null){const attrs={},n={id,nodeType:1,tagName:tag,parentElement:parent,hidden:false,disabled:false,isConnected:true,style:{},setAttribute(k,v){attrs[k]=v;},getAttribute:k=>attrs[k]??null,contains(other){for(let p=other;p;p=p.parentElement)if(p===n)return true;return false;},getBoundingClientRect:()=>({left:10,top:10,width:80,height:44})};nodes.set(id,n);return n;}
 const body=node('body'),root=node('hd-battle','DIV',body),header=node('hd-mobile-battle-toggle','BUTTON',body),footer=node('hd-mobile-battle-mode','BUTTON',root);body.classList={contains:name=>name==='hd-mobile-page'};
 const document={body,hidden:false,getElementById:id=>nodes.get(id),addEventListener(k,f){(listeners[k]||=[]).push(f);},elementFromPoint:()=>top};
 const shared={getMode:()=>mode,setMode(value){calls.push('setMode:'+value);mode=value;effect.setMode(value,false);},applyMobilePage(){},retireInteraction:reason=>calls.push('battleRetire:'+reason),getLcdPresentation:()=> 'passthrough'};
 const env={document,innerWidth:844,innerHeight:390,addEventListener(){},setInterval(){return 1;},getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),BayeHdBattle:shared,BayeHdLibIdentity:{read:()=>identity,isCurrent:i=>i===identity,subscribe(){}},baye:{data,hd:{ready:()=>true,fight:()=>Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,raw[v]]).concat([['cityIndex',32]])),menuItems:()=>({active:0})}},BayeHdSpe:{applyMobilePage(options){this.options=options;},retireInteraction(reason){calls.push('speRetire:'+reason);effect.api.retireInteraction(reason);}}};
 const context=vm.createContext({window:env});vm.runInContext(battleSource,context);env.BayeHdMobileBattle.init();assert.equal(env.BayeHdMobileBattle.readNativeTicket().presentation,'lcd');
 function fire(type,target,extra={}){top=target;const event={target,pointerId:1,isPrimary:true,isTrusted:true,button:0,clientX:30,clientY:30,preventDefault(){},stopImmediatePropagation(){},...extra};for(const fn of listeners[type]||[])fn(event);}
 return {calls,header,footer,raw,fire,click(target){fire('pointerdown',target);fire('pointerup',target);},get mode(){return mode;}};
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

}
runMobileSpeChecks();
