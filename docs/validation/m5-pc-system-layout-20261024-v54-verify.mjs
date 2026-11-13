/** V54 read-only PC title/period/king archive verifier. No game or OS actions. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {decodeV45Archive,decodeV45Png,v45Pin,v45ReadBounded,v45Local,v45Sha} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';

export const V54_PREFIX='docs/validation/m5-pc-system-layout-20261024-v54';
export const V54_CODEC='docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs';
export const V54_ATTRIBUTES_APPEND='\n# Original PC system UI viewport layout and stable list scrolling.\n'+
 ['json','mjs','md','gz','sav','png'].map(ext=>'/'+V54_PREFIX+'*.'+ext+(ext==='json'||ext==='mjs'||ext==='md'?' -text whitespace=cr-at-eol':' -text')+'\n').join('');
const B='build/impact-skill-20261014/';
const sha=v45Sha;
// Exact original-library record definitions, independently parsed before any browser starts.
export const V54_MENU_SPE_RESOURCES=Object.freeze({
 100:Object.freeze({id:100,resourceIndex:0,startFrm:0,endFrm:0,count:1,picmax:1,resourceLength:189,resourceFingerprint:'fnv1a32:4b9c3808:189',resourceSha256:'0a3ab7b585ff3a879697bca4a35bb3ed0650ff1ac9e1ffbcfe0cba25349b7c0d',units:[[6,44,10,10,0]]}),
 104:Object.freeze({id:104,resourceIndex:0,startFrm:0,endFrm:1,count:2,picmax:1,resourceLength:353,resourceFingerprint:'fnv1a32:fdf8ffb5:353',resourceSha256:'548d779ba983c8182eea3c9df5726701278893c0f72033395ca2d7f3c87786ed',units:[[1,25,10,10,0],[0,24,10,10,0]]})
});
export function deriveV54MenuSpeResources(bytes){
 assert.ok(Buffer.isBuffer(bytes));assert.equal(bytes.length,207195);assert.equal(sha(bytes),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 const definitions={};for(const id of[100,104]){const a=bytes.readUInt32LE((id-1)*4);assert.ok(a>0&&a+14<=bytes.length);const length=bytes.readUInt32LE(a),items=bytes.readUInt16LE(a+6),fixed=bytes.readUInt32LE(a+8);assert.equal(bytes.readUInt16LE(a+4),id);assert.equal(bytes[a+12],0);assert.ok(items>0&&a+length<=bytes.length);const offset=fixed||items===1?14:bytes.readUInt32LE(a+14),size=fixed||(items===1?length-14:bytes.readUInt32LE(a+18));assert.ok(offset>=14&&size>=6&&offset+size<=length);const resource=bytes.subarray(a+offset,a+offset+size),count=resource[2],picmax=resource[3],startFrm=resource[4],endFrm=resource[5];assert.ok(count>0&&picmax>0&&startFrm<=endFrm&&endFrm<count&&6+count*5<=size);const units=Array.from({length:count},(_,i)=>Array.from(resource.subarray(6+i*5,11+i*5)));assert.ok(units.every(u=>u[4]<picmax));let h=2166136261;for(const value of resource)h=Math.imul(h^value,16777619)>>>0;definitions[id]={id,resourceIndex:0,startFrm,endFrm,count,picmax,resourceLength:size,resourceFingerprint:'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+size,resourceSha256:sha(resource),units};}
 assert.deepEqual(definitions,V54_MENU_SPE_RESOURCES,'Only these exact original title/period movie records authorize sampling retries');return definitions;
}

const SIZES=[[1920,1080],[1280,720],[1024,600],[844,390],[667,375]];
const SCREENS=['title','period','king'];
const SPE_NATIVE=['active','id','kind','seq','generation','eventId','parentEventId','depth','resourceIndex','count','startFrm','endFrm','keyflag','skipEligible','returnEligible'];
const plain=x=>JSON.parse(JSON.stringify(x));
const pin3=p=>({path:p.path,bytes:p.bytes,sha256:p.sha256});
const check=(p,b)=>{assert.ok(Buffer.isBuffer(b),'Required bytes: '+p.path);assert.deepEqual(v45Pin(p.path,b),pin3(p),'Exact original bytes: '+p.path);return b;};
const archived=(files,p)=>{assert.ok(files.has(p),'Required logical original: '+p);return files.get(p);};
const json=(files,p)=>JSON.parse(archived(files,p));
const pinnedJson=(files,p)=>JSON.parse(check(p,archived(files,p.path)));
const owner=n=>({...n,spe:Object.fromEntries(SPE_NATIVE.filter(k=>Object.hasOwn(n.spe,k)).map(k=>[k,n.spe[k]]))});
function sameNative(a,b){
 assert.deepEqual(owner(b.native),owner(a.native),'Complete native owner unchanged during zero-key presentation');
 assert.equal(b.keys,a.keys);assert.equal(b.seedFingerprint,a.seedFingerprint);
 assert.match(a.seedFingerprint,/^[0-9a-f]{64}$/);assert.deepEqual(a.saveKeys,[]);assert.deepEqual(b.saveKeys,[]);
}
function naturalMenuSpeBoundary(a,b,screen){
 const x=owner(a.native),y=owner(b.native),{spe:p,...left}=x,{spe:q,...right}=y;
 assert.deepEqual(right,left,'Non-SPE native owners must remain exactly unchanged during a rejected SPE trial');assert.equal(b.keys,a.keys,'No native input during rejected trial');assert.ok(b.seedFingerprint===a.seedFingerprint,'Native RNG unchanged during rejected trial');assert.deepEqual(a.saveKeys,[]);assert.deepEqual(b.saveKeys,[]);
 const id={title:100,period:104}[screen],spec=V54_MENU_SPE_RESOURCES[id];assert.ok(spec,'Only original title100/period104 animation lifecycle may be resampled');assert.equal(a.native.menu.index,0);assert.equal(b.native.menu.index,0);assert.equal(q.generation,p.generation,'No SPE generation reset');assert.ok(Number.isInteger(p.generation)&&p.generation>0&&p.generation<=0xffffffff);assert.ok(Number.isInteger(p.seq)&&p.seq>0&&Number.isInteger(q.seq)&&q.seq>0);
 const maxEvents=40,maxTicks=maxEvents*(1+2*spec.count),distance=(from,to,max,limit)=>{assert.ok(Number.isInteger(from)&&from>0&&from<=max&&Number.isInteger(to)&&to>0&&to<=max);let cursor=from;for(let n=1;n<=limit;n++){cursor=cursor===max?1:cursor+1;if(cursor===to)return n;}return null;};
 const shape=(projected,raw)=>{assert.ok(projected.active===0||projected.active===1);assert.equal(projected.kind,0);assert.equal(projected.parentEventId,0);assert.equal(projected.resourceIndex,0);assert.equal(projected.returnEligible??false,false);if(projected.active){assert.equal(projected.id,id);assert.equal(projected.depth,1);for(const k of['startFrm','endFrm','count'])assert.equal(projected[k],spec[k]);for(const k of['picmax','resourceLength','resourceFingerprint'])assert.equal(raw[k],spec[k],'Exact pinned LIB resource '+k);assert.equal(raw.protocolVersion,2);assert.equal(raw.protocolValid,true);assert.equal(projected.keyflag,1);assert.equal(projected.skipEligible,true);assert.ok(Number.isInteger(projected.eventId)&&projected.eventId>0);assert.ok(Number.isInteger(raw.commitSeq)&&raw.commitSeq>=0&&raw.commitSeq<=2*spec.count);if(raw.frameValid){assert.ok(Number.isInteger(raw.frameIndex)&&raw.frameIndex>=spec.startFrm&&raw.frameIndex<=spec.endFrm);assert.ok(raw.commitSeq>0);}else{assert.equal(raw.frameIndex,null);assert.equal(raw.commitSeq,0);}}else{for(const k of['id','depth','count','startFrm','endFrm','keyflag','eventId'])assert.equal(projected[k],0);assert.equal(projected.skipEligible,false);assert.equal(raw.protocolVersion,2);assert.equal(raw.protocolValid,false);assert.equal(raw.picmax,0);assert.equal(raw.resourceLength,0);assert.equal(raw.resourceFingerprint,null);assert.equal(raw.frameValid,false);assert.equal(raw.frameIndex,null);assert.equal(raw.commitSeq,0);}};
 shape(p,a.native.spe);shape(q,b.native.spe);const seqAdvance=p.seq===q.seq?0:distance(p.seq,q.seq,65535,maxTicks);assert.ok(seqAdvance!==null&&seqAdvance<=maxTicks,'Bounded forward native SPE sequence only');let kind,eventAdvance=0;
 if(p.active===1&&q.active===1&&p.eventId===q.eventId){const{seq:unusedP,...sameP}=p,{seq:unusedQ,...sameQ}=q;assert.deepEqual(sameQ,sameP,'Same movie owner during natural frame/tick progression');assert.deepEqual(b.native.spe.lastEnd,a.native.spe.lastEnd,'Same-event progression retains the previous movie end, including a previous key39');const commitAdvance=b.native.spe.commitSeq-a.native.spe.commitSeq;assert.ok(commitAdvance>0&&commitAdvance<=2*spec.count);assert.equal(seqAdvance,commitAdvance,'Each native redraw commit has exactly its source tick');if(a.native.spe.frameValid){assert.equal(b.native.spe.frameValid,true);assert.ok(b.native.spe.frameIndex>=a.native.spe.frameIndex,'No native frame rewind');}kind='original-menu-SPE-same-event-frame-or-redraw-tick';}
 else{const complete=raw=>{assert.equal(raw.lastEnd?.reason,'complete');assert.equal(raw.lastEnd?.key,255);assert.ok(Number.isInteger(raw.lastEnd?.eventId)&&raw.lastEnd.eventId>0);return raw.lastEnd.eventId;},next=n=>n===0xffffffff?1:n+1;
  if(p.active===1&&q.active===0){const end=complete(b.native.spe);eventAdvance=p.eventId===end?0:distance(p.eventId,end,0xffffffff,maxEvents);assert.ok(eventAdvance!==null);if(eventAdvance===0)assert.ok(seqAdvance<=2*spec.count-a.native.spe.commitSeq);else assert.ok(seqAdvance>0);kind='original-menu-SPE-natural-COMPLETE';}
  else if(p.active===1&&q.active===1){const end=complete(b.native.spe);eventAdvance=distance(p.eventId,q.eventId,0xffffffff,maxEvents);assert.ok(eventAdvance!==null&&seqAdvance>0);assert.equal(q.eventId,next(end),'New root event follows natural COMPLETE');kind='original-menu-SPE-COMPLETE-and-rebegin';}
  else if(p.active===0&&q.active===1){const prior=a.native.spe.lastEnd;assert.ok(prior&&Number.isInteger(prior.eventId)&&prior.eventId>0);eventAdvance=distance(prior.eventId,q.eventId,0xffffffff,maxEvents);assert.ok(eventAdvance!==null&&seqAdvance>0);if(isDeepStrictEqual(b.native.spe.lastEnd,prior)){assert.equal(q.eventId,next(prior.eventId));assert.ok(prior.reason==='complete'&&prior.key===255||prior.reason==='key'&&[39,40].includes(prior.key),'Source menu begin follows a genuine preceding menu key or COMPLETE');}else assert.equal(q.eventId,next(complete(b.native.spe)));kind='original-menu-SPE-root-begin';}
  else{const prior=a.native.spe.lastEnd;assert.ok(prior&&Number.isInteger(prior.eventId)&&prior.eventId>0);eventAdvance=distance(prior.eventId,complete(b.native.spe),0xffffffff,maxEvents);assert.ok(eventAdvance!==null&&seqAdvance>0);kind='original-menu-SPE-completed-native-cycles';}
 }
 return{kind,id,resource:{count:spec.count,picmax:spec.picmax,startFrm:spec.startFrm,endFrm:spec.endFrm,resourceLength:spec.resourceLength,resourceFingerprint:spec.resourceFingerprint},generation:p.generation,seqAdvance,eventAdvance,acceptedNativeEquality:false};
}
function trialRelation(a,b,screen){if(isDeepStrictEqual(owner(a.native),owner(b.native))){sameNative(a,b);return{equal:true,boundary:null};}return{equal:false,boundary:naturalMenuSpeBoundary(a,b,screen)};}
function screenTicket(q,screen){
 assert.deepEqual([q.native.menu.active,q.native.menu.context,q.native.menu.kind],[1,4,{title:1,period:2,king:3}[screen]]);
 assert.equal(q.native.record.active,0);assert.equal(q.native.fight.active,0);assert.equal(q.native.march.battlePick,0);
 assert.deepEqual(q.saveKeys,[]);assert.equal(q.native.library.status,'ready');
 assert.equal(q.native.library.sha256,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 assert.equal(q.system.open,true);assert.equal(q.system.showHd,true);assert.equal(q.system.screen,screen);assert.equal(q.system.pending,false);
}
function elementFacts(e,v){
 assert.ok(e&&e.rect&&e.clip&&e.style);const r=e.rect,c=e.clip;
 for(const k of ['left','top','right','bottom','width','height'])assert.ok(Number.isFinite(r[k]),'Finite actual rect');
 const shown=e.shown&&e.style.display!=='none'&&!['hidden','collapse'].includes(e.style.visibility);
 const inViewport=!!shown&&r.width>0&&r.height>0&&r.left>=-.5&&r.top>=-.5&&r.right<=v.width+.5&&r.bottom<=v.height+.5;
 const inClip=!!shown&&r.left>=c.left-.5&&r.top>=c.top-.5&&r.right<=c.right+.5&&r.bottom<=c.bottom+.5;
 assert.equal(e.inViewport,inViewport,'Recomputed viewport clipping');assert.equal(e.inClip,inClip,'Recomputed ancestor clipping');
 return{inViewport,inClip,fullyVisible:inViewport&&inClip&&e.centerHit===true&&!e.disabled};
}
function geometry(g){
 assert.ok(SIZES.some(([w,h])=>g.viewport.width===w&&g.viewport.height===h));assert.equal(g.viewport.dpr,1);
 const names=['root','stage','title','sub','list','footer','back'];const f=Object.fromEntries(names.map(k=>[k,elementFacts(g[k],g.viewport)]));
 for(const e of g.items)elementFacts(e,g.viewport);
 const checks={stageInViewport:f.stage.fullyVisible,titleInViewport:f.title.fullyVisible,footerInViewport:f.footer.fullyVisible,
  backInViewport:f.back.fullyVisible,listBounded:g.list.shown&&f.list.inViewport&&f.list.inClip&&g.list.clientHeight>0&&g.list.scrollHeight>=g.list.clientHeight,viewportKnown:true};
 return{checks,layoutSatisfied:Object.values(checks).every(x=>x===true)};
}
function stats(raw){const text=raw.toString('utf8').replace(/\u001b\[[0-9;]*m/g,''),s={};
 for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const rows=[...text.matchAll(new RegExp('^(?:#|ℹ) '+k+' ([0-9.]+)\\r?$','gm'))];assert.equal(rows.length,1,'One closed TAP summary '+k);s[k]=Number(rows[0][1]);}return s;
}
function sourceRows(rows){assert.ok(Array.isArray(rows)&&rows.length);const m=new Map();for(const p of rows){assert.ok(!m.has(p.path));assert.match(p.sha256,/^[0-9a-f]{64}$/);assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0);m.set(p.path,pin3(p));}return m;}
function vectorRun(files,run,menuSpeResources){
 const d=run.dir.replace(/\/$/,'')+'/';const r=pinnedJson(files,run.result),s=pinnedJson(files,run.scenario);
 assert.equal(run.result.path,d+'result.json');assert.equal(run.scenario.path,d+'scenario-result.json');assert.equal(r.artifact,d.slice(0,-1));
 assert.equal(run.terminal.closed,true);assert.equal(run.terminal.exitCode,r.ok?0:1);assert.deepEqual(r.observation,s);
 const before=json(files,d+'source-before.json'),after=json(files,d+'source-after.json');
 assert.equal(after.ok,true);assert.equal(after.sourceCount,before.sourceCount);assert.equal(after.sources.length,before.sources.length);
 for(let i=0;i<after.sources.length;i++){const actual=after.sources[i],expected=before.sources[i];assert.equal(actual.actualBytes,expected.bytes);assert.equal(actual.actualSha256,expected.sha256);assert.equal(actual.match,true);}
 assert.deepEqual(after.sources.map(pin3),before.sources.map(pin3),'Complete ordered source-vector pins unchanged');
 assert.deepEqual(r.sourceVerification,after);assert.equal(r.sourceCount,before.sourceCount);assert.equal(before.sources.length,before.sourceCount);
 const sources=sourceRows(before.sources),served=json(files,d+'served-after.json');sourceRows(served);
 for(const p of [...json(files,d+'served-before.json'),...served])assert.deepEqual(pin3(p),sources.get(p.path),'Actual HTTP source belongs to frozen vector');
 const copies=json(files,d+'executed-closure.json').copies;assert.ok(copies.length>0);
 for(const c of copies){assert.ok(!c.path.includes('/')&&!c.path.includes('\\'));check({path:d+c.path,bytes:c.bytes,sha256:c.sha256},archived(files,d+c.path));assert.deepEqual({path:c.source,bytes:c.bytes,sha256:c.sha256},sources.get(c.source),'Executed copy binds original source');}
 for(const p of ['pc.html','css/hd-system-ui.css','js/hd-system-ui.js']){assert.ok(served.some(x=>x.path===p),'Changed product was genuinely HTTP-served');assert.ok(copies.some(x=>x.source===p),'Changed product has an exact executed copy');}
 assert.equal(r.serverClosed,true);assert.deepEqual(r.privateListeners,[]);assert.equal(r.user8080Unchanged,true);assert.equal(r.profilePreserved,true);assert.equal(r.directoriesDeleted,false);
 if(Object.hasOwn(s,'menuSpeResources'))assert.deepEqual(s.menuSpeResources,menuSpeResources);
 assert.equal(s.observationCompleted,true);assert.equal(s.ok,true);assert.equal(s.stages.length,15);assert.equal(s.classicRoundTrips.length,15);assert.equal(s.scroll.length,5);assert.equal(s.navigation.length,25);
 for(const k of ['selectedKing','loadedSave','newCampaign','physicalPresentationModeClicks'])assert.equal(s[k],false);
 for(const k of ['newEnd','newBuy','newSave','newBattle'])assert.equal(s[k],0);
 const input=json(files,d+'native-and-trusted-inputs.json');assert.deepEqual(input.errors,[]);
 const expected=[39,...Array.from({length:5},()=>[39,40,39,39,40]).flat()];assert.deepEqual(input.keys.map(x=>x.code),expected);assert.equal(input.keys.length,26);
 for(const k of input.keys){assert.equal(k.argc,1);assert.ok(k.returnedAt>=k.at);}
 const events=t=>input.events.filter(e=>e.type===t);for(const t of ['pointerdown','pointerup','click']){assert.equal(events(t).length,25);assert.ok(events(t).every(e=>e.trusted));}
 assert.equal(events('keydown').length,1);assert.equal(events('keyup').length,1);assert.ok([...events('keydown'),...events('keyup')].every(e=>e.trusted&&e.key==='Enter'&&!e.repeat));
 assert.equal(events('wheel').length,5);assert.ok(events('wheel').every(e=>e.trusted&&e.deltaY>0));
 assert.deepEqual(s.opening,json(files,d+'opening.json'));assert.deepEqual(s.opening.keys,input.keys.slice(0,1));screenTicket(s.opening.after,'title');
 const sampling=s.samplingTrials||[],classicTrials=s.classicTrials||[];
 for(let i=0;i<sampling.length;i++){const row=sampling[i];assert.equal(row.ordinal,i+1);assert.equal(row.accepted,false);assert.equal(row.error,null);
  assert.deepEqual(row,json(files,d+'sampling-trial-'+String(i+1).padStart(3,'0')+'.json'));
  const relation=trialRelation(row.before,row.after,row.screen);assert.equal(relation.equal,false,'A rejected natural SPE boundary is never an accepted measurement');assert.deepEqual(row.relation,relation);
 }
 if(Object.hasOwn(s,'classicTrials')){const groups=new Map();let rejected=0;
  for(const row of classicTrials){const key=row.label+'-'+row.screen,group=groups.get(key)||{trials:0,accepted:false};assert.equal(group.accepted,false);assert.equal(row.trial,group.trials+1);assert.ok(row.trial<=3);assert.equal(row.error,null);
   assert.deepEqual(row,json(files,d+key+'-classic-trial-'+row.trial+'.json'));assert.equal(row.presentationApiOnly,true);assert.equal(row.physicalModeClick,false);assert.equal(row.nativeKeys,0);
   const relations=[trialRelation(row.before,row.classic,row.screen),trialRelation(row.classic,row.restored,row.screen),trialRelation(row.before,row.restored,row.screen)];
   assert.deepEqual(row.relations,relations);assert.equal(row.accepted,relations.every(x=>x.equal));
   group.trials++;group.accepted=row.accepted;groups.set(key,group);if(!row.accepted)rejected++;
  }
  assert.equal(groups.size,15);assert.ok([...groups.values()].every(x=>x.accepted));assert.equal(classicTrials.filter(x=>x.accepted).length,15);
  assert.equal(s.classicPresentationApiCalls,classicTrials.length*2);assert.equal(s.extraClassicPresentationApiCalls,rejected*2);assert.equal(s.classicPresentationApiCalls,30+s.extraClassicPresentationApiCalls);
 }
 const layouts=[],wheels=[],pngs=[];
 for(const [w,h]of SIZES)for(const screen of SCREENS){const label='viewport-'+w+'x'+h+'-'+screen,row=json(files,d+label+'.json');
  assert.deepEqual(row,s.stages.find(x=>x.label===label));assert.equal(row.screen,screen);screenTicket(row.before,screen);screenTicket(row.after,screen);sameNative(row.before,row.after);
  assert.deepEqual(row.geometry.viewport,{width:w,height:h,dpr:1});const derived=geometry(row.geometry);assert.deepEqual(derived.checks,row.checks);assert.equal(row.layoutSatisfied,derived.layoutSatisfied);
  const p={path:d+row.png.file,bytes:row.png.bytes,sha256:row.png.sha256};assert.equal(p.path,d+label+'.png');const decoded=decodeV45Png(check(p,archived(files,p.path)));assert.deepEqual([decoded.width,decoded.height],[w,h]);pngs.push({...p,...decoded});
  layouts.push({label,layoutSatisfied:derived.layoutSatisfied,stageRect:row.geometry.stage.rect});
  const trip=json(files,d+label+'-classic-roundtrip.json');assert.deepEqual(trip,s.classicRoundTrips.find(x=>x.label==='viewport-'+w+'x'+h&&x.screen===screen));
  if(Object.hasOwn(s,'classicTrials')){const accepted=s.classicTrials.filter(x=>x.label==='viewport-'+w+'x'+h&&x.screen===screen&&x.accepted);assert.equal(accepted.length,1);assert.deepEqual(trip,accepted[0],'Accepted trial is the exact published roundtrip object');}
  assert.deepEqual(trip.api,['BayeHdSystemUi.setMode(classic)','BayeHdSystemUi.setMode(hd)']);assert.equal(trip.presentationApiOnly,true);assert.equal(trip.physicalModeClick,false);assert.equal(trip.nativeKeys,0);
  screenTicket(trip.before,screen);screenTicket(trip.restored,screen);sameNative(trip.before,trip.classic);sameNative(trip.before,trip.restored);
  assert.equal(trip.classic.system.pref,'classic');assert.equal(trip.classic.system.showHd,false);assert.equal(trip.classic.system.open,false);
 }
 for(const [w,h]of SIZES){const label='viewport-'+w+'x'+h,row=json(files,d+label+'-king-scroll.json');assert.deepEqual(row,s.scroll.find(x=>x.label===label));
  screenTicket(row.before,'king');screenTicket(row.after,'king');sameNative(row.before,row.after);assert.equal(row.nativeKeys,0);geometry(row.initial);
  const overflow=row.initial.list.scrollHeight-row.initial.list.clientHeight>1;assert.equal(row.overflowRequired,overflow);assert.ok(overflow,'This recorded eighteen-ruler matrix has scrollable rows');
  assert.ok(row.wheel&&row.immediate&&row.settled);assert.equal(row.wheel.trustedInputType,'Input.dispatchMouseEvent(mouseWheel)');assert.ok(row.observationWallMs>=600);assert.deepEqual(row.settled,row.samples.at(-1));
  geometry(row.immediate);for(const sample of row.samples)geometry(sample);
  const last=row.settled.items.at(-1),lastVisible=elementFacts(last,row.settled.viewport).fullyVisible;
  const nodesStable=row.settled.items.length===row.initial.items.length&&row.settled.items.every((n,i)=>n.nodeId===row.immediate.items[i]?.nodeId);
  const accepted=row.immediate.list.scrollTop>row.initial.list.scrollTop+.5&&row.settled.list.scrollTop>.5&&lastVisible&&nodesStable;
  assert.equal(row.accepted,accepted);wheels.push({label,accepted,nodesStable,immediateScroll:row.immediate.list.scrollTop,settledScroll:row.settled.list.scrollTop,observedMs:row.observationWallMs});
 }
 for(let i=0;i<25;i++){const n=json(files,d+'navigation-'+String(i+1).padStart(2,'0')+'.json');assert.deepEqual(n,s.navigation[i]);screenTicket(n.before,n.from);screenTicket(n.after,n.to);
  const codes=[39,40,39,39,40],from=['title','period','title','period','king'],to=['period','title','period','king','title'];assert.equal(n.from,from[i%5]);assert.equal(n.to,to[i%5]);assert.equal(n.index,codes[i%5]===39?0:null);
  assert.equal(n.after.keys,n.before.keys+1);assert.deepEqual(n.nativeKeys,[input.keys[i+1]]);assert.equal(n.nativeKeys[0].code,codes[i%5]);assert.equal(n.target.centerHit,true);assert.equal(n.target.disabled,false);
 }
 screenTicket(s.final,'title');assert.equal(s.final.keys,26);assert.equal(s.layoutFactsSatisfied,layouts.every(x=>x.layoutSatisfied));
 assert.equal(s.scrollFactsSatisfied,wheels.filter(x=>/844x390|667x375/.test(x.label)).every(x=>x.accepted));
 return{result:r,scenario:s,sources,summary:{originalWrapperOk:r.ok,originalCleanupTreeExited:r.cleanup.treeExited,originalScenarioOk:s.ok,layoutAccepted:s.acceptedForLayout,
  sources:sources.size,served:served.length,executedCopies:copies.length,layouts:15,clippedStages:layouts.filter(x=>!x.layoutSatisfied).length,classicModeApiRoundTrips:15,
  wheelObservations:5,wheelRetentions:wheels.filter(x=>x.accepted).length,nativeKeys:26,pointerClicks:25,pngs:15,
  rejectedNaturalSpeSamplingTrials:sampling.length,classicTrials:classicTrials.length||15,acceptedClassicRoundTrips:15,
  classicPresentationApiCalls:s.classicPresentationApiCalls??30,extraClassicPresentationApiCalls:s.extraClassicPresentationApiCalls??0,
  layoutsDerived:layouts,wheelDerived:wheels},pngs};
}
export function v54CurrentVector(files,C){const m=new Map(),add=rows=>{for(const[p,q]of sourceRows(rows)){if(m.has(p))assert.deepEqual(m.get(p),q,'All current source overlaps exact');else m.set(p,q);}};
 const full=pinnedJson(files,C.full),target=pinnedJson(files,C.target),after=json(files,C.runs.after.dir.replace(/\/$/,'')+'/source-after.json');add(full.sources);add(target.after);add(after.sources);return[...m.values()].sort((a,b)=>a.path.localeCompare(b.path));
}
function originalRunPngs(files,dirs){const rows=[];for(const[p,b]of files)if(dirs.some(d=>p.startsWith(d.replace(/\/$/,'')+'/')&&!p.slice(d.replace(/\/$/,'').length+1).includes('/'))&&p.endsWith('.png'))rows.push({...v45Pin(p,b),...decodeV45Png(b)});return rows.sort((a,b)=>a.path.localeCompare(b.path));}
export function verifyV54Evidence({files,historyFiles,canonical:C,readCurrent}){
 assert.ok(files instanceof Map&&historyFiles instanceof Map,'Two explicit bounded archives; no merged fallback map');
 assert.equal(C.prefix,V54_PREFIX);assert.equal(C.main,null);assert.equal(C.publishedNewMainInput,false);assert.equal(C.historicalContractInputOnly,true);assert.equal(C.globalHdComplete,false);
 for(const p of C.supportPins)check(p,archived(files,p.path));for(const p of C.historySupportPins)check(p,archived(historyFiles,p.path));for(const p of C.planPins||[])check(p,archived(files,p.path));
 const menuSpeResources=deriveV54MenuSpeResources(readCurrent('libs/dat-mod.lib'));
 const before=vectorRun(historyFiles,C.runs.before,menuSpeResources),after=vectorRun(files,C.runs.after,menuSpeResources);
 assert.deepEqual(after.scenario.menuSpeResources,menuSpeResources);
 assert.equal(before.scenario.mode,'observe-before');assert.equal(before.result.ok,false);assert.equal(before.result.cleanup.treeExited,false);assert.equal(before.scenario.acceptedForLayout,false);
 assert.equal(before.summary.clippedStages,6);assert.equal(before.summary.wheelRetentions,0);
 assert.equal(after.scenario.mode,'verify-after');assert.equal(after.result.ok,true);assert.equal(after.result.cleanup.treeExited,true);assert.equal(after.scenario.acceptedForLayout,true);
 assert.equal(after.summary.clippedStages,0);assert.equal(after.summary.wheelRetentions,5);
 const incomplete=[];
 for(const run of C.historicalPartialRuns){assert.ok(run.dir.startsWith(B+'v54-system-layout-after-'));const r=pinnedJson(historyFiles,run.result),s=pinnedJson(historyFiles,run.scenario);
  assert.equal(run.result.path,run.dir+'/result.json');assert.equal(run.scenario.path,run.dir+'/scenario-result.json');assert.equal(r.ok,false);assert.equal(s.ok,false);assert.equal(s.observationCompleted,false);assert.ok(s.stages.length<15);
  incomplete.push({dir:run.dir,originalWrapperOk:false,observationCompleted:false,completedStages:s.stages.length,acceptedClassicRoundTrips:s.classicRoundTrips.length,wheelObservations:s.scroll.length,acceptedAsFinalAfter:false});
 }
 const post=pinnedJson(historyFiles,C.beforePostExit);check(post.originalResult,archived(historyFiles,post.originalResult.path));assert.deepEqual(post.originalResult,C.runs.before.result);
 for(const k of ['accepted','allOriginalIdentitiesAbsent','rootDescendantsAbsent','profileMatchesAbsent','user8080Unchanged','profilePreserved','originalsStable'])assert.equal(post[k],true);
 assert.equal(post.originalFlagsRewritten,false);assert.equal(post.originalCleanupTreeExited,false);assert.equal(post.newProcessActions,0);assert.deepEqual(post.privateListeners,[]);assert.equal(post.originalTargets.length,11);
 assert.ok(post.originalTargets.every(x=>x.status==='absent'&&x.currentIdentity===null));assert.equal(post.remainingExactOrDescendants.treeExited,true);
 for(const k of ['survivingRecorded','rootDescendants','profileMatches'])assert.deepEqual(post.remainingExactOrDescendants[k],[]);
 assert.deepEqual(C.runs.before.terminal,{closed:true,sessionId:post.originalTerminal.sessionId,initialChunk:post.originalTerminal.initial,terminalChunk:post.originalTerminal.chunk,exitCode:post.originalTerminal.exit});
 assert.deepEqual(post.originalPinsBefore,post.originalPinsAfter);for(const p of post.originalPinsBefore)check(p,archived(historyFiles,p.path));
 const target=pinnedJson(files,C.target);assert.equal(target.accepted,true);assert.equal(target.sourceBytesStable,true);assert.deepEqual(target.before,target.after);
 assert.deepEqual([target.oldManualCasesRetained,target.currentSaveloadManualCases,target.newDistinctManualGroups],[49,55,6]);assert.equal(target.manualCasesAreOneNodeAggregate,true);
 for(const[which,expected]of[['negative',[1,0,1]],['positive',[227,227,0]]]){const r=target[which],s=stats(check(r.stdout,archived(files,r.stdout.path)));check(r.stderr,archived(files,r.stderr.path));assert.equal(r.stderr.bytes,0);
  assert.deepEqual([s.tests,s.pass,s.fail],expected);for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms'])assert.equal(s[k],r[k]);assert.equal(r.processExitCode,which==='negative'?1:0);
 }
 const negativeText=archived(files,target.negative.stdout.path).toString('utf8'),positiveText=archived(files,target.positive.stdout.path).toString('utf8');
 assert.match(negativeText,/ok 49 - system mode changes immediately retire the SPE pointer presentation without native input/);assert.match(negativeText,/stable rows are not recreated/);
 assert.match(positiveText,/55 HD save\/load UI regressions passed/);
 const full=pinnedJson(files,C.full),fullBefore=pinnedJson(files,full.before),tap=check(full.stdout,archived(files,full.stdout.path)),fullStats=stats(tap);check(full.stderr,archived(files,full.stderr.path));
 assert.equal(full.accepted,true);assert.equal(full.sourceBytesStable,true);assert.equal(full.processExitCode,0);assert.equal(full.command,'npm.cmd test');assert.equal(full.CC,'build/toolchain/emsdk/upstream/bin/clang.exe');
 assert.equal(C.fullTerminal.closed,true);assert.equal(C.fullTerminal.exitCode,0);
 assert.equal(full.registeredFiles,143);assert.equal(full.stderr.bytes,0);assert.deepEqual(fullBefore.sources,full.sources);assert.equal(fullBefore.expectedTests,7832);
 for(const k of ['tests','pass'])assert.equal(fullStats[k],7832);for(const k of ['fail','cancelled','skipped','todo'])assert.equal(fullStats[k],0);for(const k of Object.keys(fullStats))assert.equal(fullStats[k],full[k]);
 assert.ok(tap.includes(Buffer.from('55 HD save/load UI regressions passed')));assert.equal(full.manualCasesAreOneNodeAggregate,true);assert.equal(full.newDefaultAggregateTestCount,0);
 const vector=v54CurrentVector(files,C);assert.deepEqual(C.currentSources,vector);const fallback=[];
 const literal=vector.filter(p=>p.path.startsWith(B)).map(p=>p.path).sort();assert.deepEqual(C.literalExactIgnored,literal,'Only literal current B entries can fall back');
 const fix=pinnedJson(files,C.sourceFix);check(fix.beforeObservation,archived(historyFiles,fix.beforeObservation.path));const changes=new Map(fix.before.map((p,i)=>[p.path,{before:p,after:fix.after[i]}]));
 for(const[p,q]of before.sources){const now=after.sources.get(p);if(!now)continue;if(JSON.stringify(q)!==JSON.stringify(now)){const e=changes.get(p);assert.ok(e,'Only declared BEFORE product/source metadata evolution');assert.deepEqual(q,pin3(e.before));assert.deepEqual(now,pin3(e.after));}}
 for(const p of vector){let b=readCurrent(p.path);if(p.path==='.gitattributes'&&C.attributesEvolution){const e=C.attributesEvolution;assert.equal(e.appendedText,V54_ATTRIBUTES_APPEND);assert.deepEqual(p,pin3(e.before));check(e.after,b);assert.equal(b.length,e.before.bytes+Buffer.byteLength(e.appendedText));check(e.before,b.subarray(0,e.before.bytes));assert.ok(b.subarray(e.before.bytes).equals(Buffer.from(e.appendedText)));continue;}
  if(b==null){assert.ok(literal.includes(p.path),'Missing tracked source is never a fallback');b=archived(files,p.path);fallback.push(p.path);}check(p,b);
 }
 const pkg=JSON.parse(readCurrent('package.json')),registered=pkg.scripts.test.split(/\s+/).filter(p=>p.startsWith('scripts/'));assert.equal(registered.length,143);assert.equal(new Set(registered).size,143);assert.ok(registered.every(p=>vector.some(q=>q.path===p)));
 const pngs=[...originalRunPngs(historyFiles,[C.runs.before.dir,...C.historicalPartialRuns.map(x=>x.dir)]),...originalRunPngs(files,[C.runs.after.dir])].sort((a,b)=>a.path.localeCompare(b.path));
 const facts={before:before.summary,after:after.summary,historicalIncompleteObservations:incomplete,beforeOriginalWrapperFailurePreserved:true,beforeSupplementaryPostExitAccepted:true,
  target:{nodeTests:227,manualSaveloadCases:55,oldManualCases:49,newManualGroups:6,oldSourceContrastRejected:true},
  full:{tests:7832,registeredFiles:143,sources:full.sources.length,duration_ms:full.duration_ms,newDefaultAggregateTests:0,freshRunRecorded:true,rerunByReader:false},
  currentSourcePins:vector.length,acceptedMatrixPngsDecoded:30,ordinaryPngsDecoded:pngs.length,publicModeApiOnly:true,physicalModeClickAccepted:false,selectedKing:false,loadedSave:false,newCampaign:false,newMainInput:false,
  newBuy:0,newEnd:0,newSave:0,newBattle:0,previousUnsavedCampaignRestored:false,mobileLayoutAccepted:false,activeBattleLifecycleAccepted:false,globalHdComplete:false};
 assert.deepEqual(plain(facts),facts,'All computed facts JSON round-trip');return{facts,fallback,pngs};
}
export function verifyV54Publication(root=process.cwd(),options={}){
 const readPublic=options.readPublic||((p,max)=>v45ReadBounded(root,p,max));const readCurrent=options.readCurrent||(p=>fs.existsSync(v45Local(root,p))?v45ReadBounded(root,p):null);
 const C=JSON.parse(readPublic(V54_PREFIX+'.json',1024*1024));assert.equal(C.reader.path,V54_PREFIX+'-verify.mjs');check(C.reader,readPublic(C.reader.path,1024*1024));assert.equal(C.codec.path,V54_CODEC);check(C.codec,readPublic(C.codec.path,1024*1024));
 assert.equal(C.mainArchive.path,V54_PREFIX+'-archive-index.json');assert.equal(C.historyArchive.path,V54_PREFIX+'-history-archive-index.json');
 const mainIndex=JSON.parse(check(C.mainArchive,readPublic(C.mainArchive.path,1024*1024))),historyIndex=JSON.parse(check(C.historyArchive,readPublic(C.historyArchive.path,1024*1024)));
 assert.ok(mainIndex.rawNamedBytes+historyIndex.rawNamedBytes<=128*1024*1024,'Both fixed archives combined raw-byte bound');
 const main=decodeV45Archive({index:mainIndex,readPart:readPublic}),history=decodeV45Archive({index:historyIndex,readPart:readPublic});
 const r=verifyV54Evidence({files:main.files,historyFiles:history.files,canonical:C,readCurrent});assert.deepEqual(C.observations,r.facts);assert.deepEqual(C.pngs,r.pngs);
 const archiveStats=(index,decoded)=>({logicalFiles:decoded.logicalFiles,physicalBlobs:decoded.physicalBlobs,parts:index.parts.length,rawNamedBytes:index.rawNamedBytes,uniqueRawBytes:index.uniqueRawBytes});
 return{accepted:true,...r.facts,archives:{main:archiveStats(mainIndex,main),history:archiveStats(historyIndex,history)},exactIgnoredFallbacks:r.fallback};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyV54Publication(),null,2));
