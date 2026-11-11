import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeV45Archive,V45_BOUNDS,decodeV45Png} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
import {B,D,PREFIX,MODULES,SOURCES,BOUNDS,EPOCH,FIXED,eq,sha,json,pin,pin3,check,readFile,uniquePins,publicModule,portable,requireBinding,packetPlan,restore} from './m5-person-roles-20261026-v71-v71-common-v1.mjs';

const KINDS=['listName','heading','ownership','priorOwnership','nativeOwnership'];
const EXECUTED=[['executed-tool.mjs','scripts/test-hd-person-identity-runtime.mjs'],
 ['executed-checks.mjs','scripts/hd-person-identity-runtime-checks.mjs'],
 ['executed-rom.mjs','scripts/hd-person-identity-rom.mjs'],
 ['executed-roles-helper.mjs','scripts/hd-person-roles-runtime-checks.mjs'],
 ['executed-city-menu.js','js/hd-city-menu.js'],
 ['executed-preview-helper.mjs','scripts/hd-mobile-preview-runtime-checks.mjs'],
 ['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],
 ['executed-json.mjs','scripts/hd-runtime-json.mjs']];
const next=n=>(n+1)>>>0||1,following=n=>next(next(n));

// Independent original-ROM decoding. No archived runtime/oracle is imported or evaluated.
function originalRom(bytes) {
 eq(bytes.length,207195);eq(sha(bytes),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
 const decoder=new TextDecoder('gbk',{fatal:true});
 function item(id,i) {
  const base=bytes.readUInt32LE((id-1)*4),length=bytes.readUInt32LE(base),count=bytes.readUInt16LE(base+6),fixed=bytes.readUInt32LE(base+8);
  assert.ok(base>0&&base+length<=bytes.length&&i>=0&&i<count);eq(bytes.readUInt16LE(base+4),id);eq(bytes[base+12],0);
  const offset=fixed?14+i*fixed:count===1?14:bytes.readUInt32LE(base+14+i*8),n=fixed||(count===1?length-14:bytes.readUInt32LE(base+18+i*8));
  assert.ok(offset>=14&&offset+n<=length);return bytes.subarray(base+offset,base+offset+n);
 }
 const text=(id,i)=>{const b=item(id,i),z=b.indexOf(0);return decoder.decode(z<0?b:b.subarray(0,z));};
 const tables=[62,70,71,72].map(id=>Array.from({length:200},(_,i)=>text(id,i))),names=tables[3];
 eq(Math.max(...tables.flat().map(n=>Array.from(n).length)),4,'Complete four-period original maximum name');
 const pd=item(61,3),cd=item(57,3),qd=item(65,3);eq(pd.length,3800);eq(cd.length,1408);eq(qd.length%2,0);
 const people=Array.from({length:200},(_,i)=>({Belong:pd.readUInt16LE(i*19+2)}));
 const cities=Array.from({length:38},(_,i)=>({Belong:cd.readUInt16LE(i*37+1),PersonQueue:cd.readUInt16LE(i*37+29),Persons:cd.readUInt16LE(i*37+31)}));
 const queue=Array.from({length:qd.length/2},(_,i)=>qd.readUInt16LE(i*2));
 eq(text(58,4),'晋阳');eq(cities[4].Belong,1);eq([names[0],names[3],names[139],names[143]],['曹丕','孟获','朵思大王','祝融夫人']);
 eq([people[139].Belong,people[143].Belong],[4,4]);
 return {names,people,cities,queue,title:text(64,23),labels:{king:text(64,47),free:text(64,46),captive:text(64,48)},
  costs(money16){const money=item(2,10),thew=item(2,9);eq(money16,0,'Actual original config uses U8 money');return {money:money[16],thew:thew[16]};}};
}
function lists(world) {
 const c=world.cities[4],actors=world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>world.people[id].Belong===c.Belong),targets=[];
 for(const city of world.cities)if(city.Belong&&city.Belong!==world.king+1)for(const id of world.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons))if(world.people[id].Belong===city.Belong&&id+1!==city.Belong)targets.push(id);
 eq(new Set(actors).size,actors.length);eq(new Set(targets).size,targets.length);return {actors,targets};
}
const contains=(a,b)=>b.left>=a.left-1&&b.top>=a.top-1&&b.right<=a.right+1&&b.bottom<=a.bottom+1;
const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
function geometry(g,text,viewport,label) {
 assert.ok(g?.shown&&g.lines.length>0,label+' is displayed');eq(g.text,text);eq(g.rangeText,text);
 const screen={left:0,top:0,right:viewport.width,bottom:viewport.height},clip={...screen};
 for(const a of g.ancestors){if(/^(auto|scroll|hidden|clip)$/.test(a.overflowX)){clip.left=Math.max(clip.left,a.clip.left);clip.right=Math.min(clip.right,a.clip.right);}if(/^(auto|scroll|hidden|clip)$/.test(a.overflowY)){clip.top=Math.max(clip.top,a.clip.top);clip.bottom=Math.min(clip.bottom,a.clip.bottom);}}
 eq(g.clip,clip,'Independently derived recorded ancestor clip');
 for(const box of [g.bounds,...g.lines]){assert.ok(['left','top','right','bottom','width','height'].every(k=>Number.isFinite(box[k]))&&box.width>0&&box.height>0);assert.ok(contains(screen,box)&&contains(clip,box),label+' is inside every clip');}
 for(const line of g.lines)assert.ok(contains(g.bounds,line));eq(g.lineHits.length,g.lines.length);assert.ok(g.lineHits.every(v=>v===true));
 assert.ok(g.clientWidth>0&&g.clientHeight>0&&g.scrollWidth<=g.clientWidth+1&&g.scrollHeight<=g.clientHeight+1);assert.notEqual(g.style.textOverflow,'ellipsis');assert.ok(['none','0',''].includes(g.style.lineClamp));
}
function sameMeasured(after,before,label) {
 eq(after.world,before.world,label+' all measured world');eq(after.native,before.native,label+' all sampled native');
 eq(after.state.keyCount,before.state.keyCount,label+' zero keys');eq(after.state.touchCount,before.state.touchCount,label+' zero LCD touches');
}
function identityChecks(r,rom,expectedLists) {
 const f=r.foreignInspection,targets=[f.actor,139,143];eq(f.people.map(p=>p.personId),targets);let count=0;
 for(let i=0;i<targets.length;i++) {
  const visit=f.people[i],id=targets[i],e=visit.identity,before=e.before,name=rom.names[id],belong=i===0?1:4,ownerId=belong-1,lord=id===ownerId,
   nativeValue=lord?rom.labels.king:rom.names[ownerId],hudValue=lord?'君主 · '+rom.names[ownerId]:rom.names[ownerId],nativeList=i===0?expectedLists.actors:expectedLists.targets;
  eq([visit.role,visit.phase],i===0?['actor',1]:['foreign-target',2]);eq(visit.accepted,true);eq(visit.name,name);eq(e.personId,id);eq(e.accepted,true);eq(e.keys,[]);
  if(i>0)eq(Array.from(name).length,4);eq(before.world,r.initialWorld);eq([before.world.people[id].Belong,before.world.people[id].OldBelong],[belong,0]);
  eq(visit.selection.before.world,r.initialWorld);eq(visit.selection.after.world,r.initialWorld);const from=visit.selection.before.state.menu.index,to=visit.selection.after.state.menu.index;
  eq(visit.selection.after.state.menu.ids[to],id);eq(visit.selection.keys,Array(Math.abs(to-from)).fill(to>from?35:34),'Focus arrows only');
  const menu=before.state.menu,p=before.native.person,ui=before.state.cityUi,owner=ui.deepMenuOwner;
  eq(menu.ids,nativeList);eq(menu.names,nativeList.map(i=>rom.names[i]));eq(menu.idsValid,true);eq([menu.active,menu.context,menu.kind],[1,1,3]);eq(menu.ids[menu.index],id);eq(before.native.menu,menu);
  eq([before.native.march.phase,before.native.march.pick,before.native.march.battlePick,before.native.report.active,before.native.qty.active],[0,0,0,0,0]);
  eq([p.protocolVersion,p.active,p.custom,p.context,p.kind,p.person,p.index],[1,1,0,1,3,id,menu.index]);eq([p.generation,p.detailGeneration,p.menuSeq],[menu.detailGeneration,menu.detailGeneration,menu.seq]);
  eq([p.pageIndex,p.pageStart,p.pageComplete,p.propertyCount],[0,0,1,13]);eq(p.name,name);
  eq(e.expected,{personId:id,period:4,name,belong,oldBelong:0,ownership:{kind:lord?'lord':'owned',value:belong,personIndex:ownerId,name:rom.names[ownerId],label:hudValue},priorOwnership:'未记录（0）',nativeOwnership:nativeValue,nativeTitle:rom.title});
  eq(ui.personDetail.ownership,e.expected.ownership);eq(ui.personDetail.corePresentation,'default');eq(ui.personProperties.name,name);eq(ui.personProperties.pageComplete,true);eq(ui.personProperties.custom,false);
  const prop=p.properties[0];eq([prop.index,prop.title,prop.value,prop.captured,prop.titleCaptured,prop.valueCaptured],[0,rom.title,nativeValue,true,true,true]);eq([prop.titlePaintSeq,prop.valuePaintSeq],[p.paintSeq,p.paintSeq]);
  eq(e.menuName.fullName,name);eq(e.menuName.packedName,menu.packedNames[menu.index]);eq(e.menuName.itemLen,menu.itemLen);eq(e.menuName.packedDiffersFromFullName,e.menuName.packedName!==name);
  eq(e.observations.map(o=>o.kind),KINDS);
  for(const o of e.observations) {
   eq(o.reveal.visible,true);eq(o.afterReveal.keys,[]);eq(o.afterScreenshot.keys,[]);sameMeasured(o.afterReveal.sample,before,'Reveal');sameMeasured(o.screenshot.sample,before,'Screenshot');sameMeasured(o.afterScreenshot.sample,before,'After screenshot');
   const d=o.dom;eq(d.before,d.after);eq(d.before.menu,menu);eq(d.before.properties,p);eq(d.before.owner,owner);eq(d.before.detail,ui.personDetail);eq(d.before.uiProperties,ui.personProperties);
   eq([d.before.hidden,d.before.open,d.before.showHd,d.before.layer],[false,true,true,'deep']);assert.ok(!d.before.sending&&!d.before.queueLen&&!d.before.personPagePending);eq(d.corePresentation,'default');
   if(o.kind==='listName'||o.kind==='heading') {
    geometry(d.value,name,r.viewport,o.kind);
    if(o.kind==='listName'){eq(d.tag,'BUTTON');eq(d.list.directText,[name]);eq([d.list.childNodeCount,d.list.elementChildren],[1,0]);eq([d.list.index,d.list.personId,d.list.name],[String(menu.index),String(id),name]);eq([d.list.owner,d.list.context,d.list.kind,d.list.seq],[owner.key,'1','3',String(menu.seq)]);}else{eq(d.tag,'H2');eq(d.id,'hd-city-menu-person-name');}
   } else {
    const title=o.kind==='nativeOwnership'?rom.title:o.kind==='priorOwnership'?'原归属':'归属',value=o.kind==='nativeOwnership'?nativeValue:o.kind==='priorOwnership'?'未记录（0）':hudValue;
    geometry(d.label,title,r.viewport,o.kind+' label');geometry(d.value,value,r.viewport,o.kind+' value');assert.ok(!overlaps(d.label.bounds,d.value.bounds));for(const a of d.label.lines)for(const b of d.value.lines)assert.ok(!overlaps(a,b));
    if(o.kind==='nativeOwnership')eq([d.field,d.current,Number(d.titlePaintSeq),Number(d.valuePaintSeq),Number(d.propertiesPaintSeq)],['0','1',p.paintSeq,p.paintSeq,p.paintSeq]);else eq(d.groupTitle,'身份与经历');
   }
   for(const adjacent of d.neighbors)if(adjacent.width>0&&adjacent.height>0)assert.ok(!overlaps(d.row.bounds,adjacent));eq(o.screenshot,r.phases.find(p=>p.file===o.screenshot.file));count++;
  }
  sameMeasured(e.after,before,'Complete identity inspection');
 }
 return count;
}
function roleChecks(r,rom) {
 const f=r.foreignInspection,w=r.initialWorld;eq([w.period,w.king,w.cities[4].Belong],[4,0,1]);eq(w.config,{citiesCount:38,enable16bitConsumeMoney:0,fixAlienateComsumeThew:0});
 eq([w.people.length,w.cities.length,w.queue.length,w.goodsQueue.length,w.fighters.length,w.fighterIndex.length,w.orders.length,w.tools.length],[200,38,2000,2000,600,30,200,33]);
 eq(w.people.map(p=>p.Belong),rom.people.map(p=>p.Belong));for(let i=0;i<38;i++)for(const k of ['Belong','PersonQueue','Persons'])eq(w.cities[i][k],rom.cities[i][k]);
 eq(w.queue.slice(0,rom.queue.length),rom.queue);eq(f.origin,4);eq(f.command,16);eq(f.accepted,true);eq(f.nativeBusinessCommits,0);eq(f.baseline.world,w);
 const expectedLists=lists(w),costs=rom.costs(w.config.enable16bitConsumeMoney);eq(costs,{money:50,thew:20});eq(f.costs,costs);eq(f.expectedLists,expectedLists);eq(f.actor,expectedLists.actors.find(id=>w.people[id].Thew>=20));assert.ok(w.cities[4].Money>=50);
 assert.ok(f.pickers.length>0);for(const q of f.pickers) {
  const s=q.sample,d=s.native.diplomacy,m=s.state.menu,p=q.presentation,ids=q.phase===1?expectedLists.actors:expectedLists.targets;eq(s.world,w);assert.ok(p);eq([d.protocolVersion,d.active,d.command,d.phase,d.origin],[1,1,16,q.phase,4]);assert.ok(d.session>0&&d.inputSeq>0&&d.generation>0);
  eq([m.active,m.context,m.kind,m.idsValid],[1,1,3,true]);eq(m.ids,ids);eq(m.names,ids.map(id=>rom.names[id]));eq([p.command,p.origin,p.phase,p.role,p.menuSeq,p.index],[16,4,q.phase,q.phase===1?'actor':'target',m.seq,m.index]);eq(p.ids,m.ids);
  for(const key of ['session','inputSeq','generation','actor','target','commitSeq','commitResult'])eq(p[key],d[key]);eq(d.generation,m.detailGeneration);eq([d.target,d.commitResult],[65535,0]);eq([p.moneyCost,p.thewCost,p.thewPayer],[50,20,'actor']);
  eq([s.state.cityUi.layer,s.state.cityUi.deepKind,s.state.cityUi.deepLabel],['deep','person-diplomacy','招揽']);eq(q.role.role,q.phase===1?'actor':'target');assert.ok(q.role.text.includes(q.phase===1?'己方':'敌方'));
 }
 eq(f.confirmations.length,1);const a=f.confirmations[0],ad=a.before.native.diplomacy,td=a.after.native.diplomacy;eq(a.keys,[39]);eq(a.before.world,w);eq(a.after.world,w);eq([ad.phase,td.phase,td.actor,td.target],[1,2,f.actor,65535]);eq([td.session,td.generation,td.commitSeq],[ad.session,ad.generation,ad.commitSeq]);assert.notEqual(td.inputSeq,ad.inputSeq);eq(a.after.state.menu.seq,following(a.before.state.menu.seq));
 eq(f.cancellations.map(c=>c.kind),['target-to-actor','actor-to-map']);for(const c of f.cancellations){eq(c.keys,[40]);eq(c.before.world,w);eq(c.after.world,w);}
 const b=f.cancellations[0],bd=b.before.native.diplomacy,ba=b.after.native.diplomacy;eq([bd.phase,ba.phase,ba.actor],[2,1,65535]);eq([ba.session,ba.generation],[bd.session,bd.generation]);eq(b.after.state.menu.seq,following(b.before.state.menu.seq));eq(b.after.state.menu.index,0);
 const last=f.cancellations[1],ld=last.after.native.diplomacy;eq([ld.active,ld.phase,ld.command,ld.origin,ld.commitResult],[0,5,16,4,0]);eq([ld.session,ld.generation,ld.commitSeq],[last.before.native.diplomacy.session,ad.generation,ad.commitSeq]);eq(last.after.native.menu.seq,next(last.before.native.menu.seq));eq(last.after.native.march.mapInputSeq,next(last.before.native.march.mapInputSeq));
 eq([last.after.native.menu.active,last.after.native.march.pick,last.after.native.march.mapCity,last.after.native.qty.active,last.after.native.report.active,last.after.state.cityUi.open],[0,1,5,0,0,false]);eq(f.returned,last.after);eq(r.final,last.after);eq(r.final.world,w);
 const keys=r.nativeKeys.slice(f.pickers[0].sample.state.keyCount);assert.ok(keys.every(k=>[34,35,39,40].includes(k)));eq(keys.filter(k=>k===39),[39],'One actual actor confirmation and no target confirmation');eq(keys.filter(k=>k===40),[40,40]);eq(r.nativeTouches,[]);
 eq(r.summary,{people:3,actorVisits:1,foreignVisits:2,maximumNameCodePoints:4,identityTargetObservations:15,actorConfirmations:1,targetConfirmations:0,cancelKeys:[40,40],identityInspectionKeys:0,nativeTouches:0,worldUnchanged:true,returnedToActualMap:true});
 return identityChecks(r,rom,expectedLists);
}
function navigationChecks(r) {
 const ids=[r.foreignInspection.actor,139,143];eq(r.mapNavigation.accepted,true);eq(r.mapNavigation.nativeInputsDuringPan,0);eq(r.mapNavigation.cityIndex,4);eq(r.cityPoint,r.mapNavigation.final);eq([r.cityPoint.index,r.cityPoint.name,r.cityPoint.hit],[4,'晋阳',true]);
 assert.ok(r.cityPoint.x>=24&&r.cityPoint.x<=r.viewport.width-24&&r.cityPoint.y>=64&&r.cityPoint.y<=r.viewport.height-48);
 for(const p of r.mapNavigation.attempts){eq(p.keys,[]);sameMeasured(p.after,p.before,'Map drag');eq(p.after.world,r.initialWorld);eq(p.mapAfter.pan.on,false);const a=p.mapBefore.camera,z=p.mapAfter.camera;assert.ok(Math.abs(a.x-z.x)>.01||Math.abs(a.y-z.y)>.01);assert.ok(z.x>=z.minX-.01&&z.x<=z.maxX+.01&&z.y>=z.minY-.01&&z.y<=z.maxY+.01);}
 if(!r.mobile)return;const previews=r.mobileNavigation.checks.filter(p=>p.kind==='preview');eq(previews.length,3);
 for(let i=0;i<previews.length;i++){const p=previews[i],m=p.before.state.menu;eq(p.menuKind,3);eq(p.personOrTool,ids[i]);eq(p.after.state.menu.ids[p.after.state.menu.index],ids[i]);eq(p.after.state.menu.seq,m.seq);eq(p.after.state.menu.ids,m.ids);eq(p.after.state.menu.names,m.names);const delta=p.index-m.index;eq(p.keys.map(k=>k.code),Array(Math.abs(delta)).fill(delta>0?35:34));eq(p.before.world,r.initialWorld);eq(p.after.world,r.initialWorld);eq(p.after.state.touchCount,p.before.state.touchCount);eq(p.geometry.visible,true);assert.ok(p.geometry.rect.width>=43.5&&p.geometry.rect.height>=43.5);}
 for(const s of r.mobileNavigation.scrollChecks){eq(s.keys,[]);sameMeasured(s.after,s.before,'Mobile detail scroll');eq(s.after.world,r.initialWorld);assert.notEqual(s.scrollTop,s.geometry.scroller.scrollTop);}
 for(const s of r.listPreviewPans||[]){assert.ok(ids.includes(s.personId));eq(s.plan.pane,'hd-city-menu-deep');eq(s.keys,[]);sameMeasured(s.after,s.before,'List gutter pan');eq(s.after.world,r.initialWorld);assert.ok(s.plan.band[1]-s.plan.band[0]>=52);eq(s.plan.points.length,7);for(const p of s.plan.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=s.plan.clip.left&&p.x<=s.plan.clip.right&&p.y>=s.plan.clip.top&&p.y<=s.plan.clip.bottom);for(const box of s.plan.interactiveRects)assert.ok(p.x<box.left-2||p.x>box.right+2||p.y<box.top-2||p.y>box.bottom+2);}assert.ok(s.plan.down?s.scrollTop>s.plan.scrollTop:s.scrollTop<s.plan.scrollTop);}
}
function checkTerminal(c,J,r) {
 const t=c.fixed.tool,a=J(t.initial),z=J(t.terminal);eq(a.chunk_id,t.initialChunk);eq(z.chunk_id,t.terminalChunk);eq(z.exit_code,c.fixed.accepted?0:1);assert.ok(!('session_id' in z));
 if(t.sessionId===null){eq(t.initial,t.terminal);assert.ok(!('session_id' in a));}else{eq(a.session_id,t.sessionId);assert.ok(!('exit_code' in a));}
 const matches=[...z.output.matchAll(/Finished (\{[^\r\n]*\})/g)];eq(matches.length,1);const last=JSON.parse(matches[0][1]);eq([last.ok,last.hdAccepted,last.identityAccepted,last.checkpoints,last.sources],[r.ok,r.hdAccepted,r.identityAccepted,r.phases.length,FIXED.runtimeInventoryCount]);
}
function cleanupCase(c,r) {
 const a=r.cleanup,own=a.recordedOwned,identity=p=>({ProcessId:p.ProcessId,ParentProcessId:p.ParentProcessId,CreationDate:p.CreationDate,ExecutablePath:p.ExecutablePath});
 eq(a.rootPid,r.isolation.chromePid);eq(a.profile.replaceAll('\\','/').toLowerCase(),r.isolation.profile.replaceAll('\\','/').toLowerCase(),'Owned helper canonical Windows profile identity');eq(a.directoriesDeleted,false);eq(a.treeExited,true);eq(a.errors,[]);eq(a.recheck.refused,[]);eq(a.exitVerification.treeExited,true);
 for(const key of ['survivingRecorded','rootDescendants','profileMatches'])eq(a.exitVerification[key],[]);
 const root=own.find(p=>p.ProcessId===a.rootPid);assert.ok(root);eq(root.CreationDate,r.rootBirth);eq(identity(root),r.isolation.rootIdentity);eq(root.depth,0);
 assert.ok(a.profile.replaceAll('\\','/').endsWith('/'+c.fixed.directory+'private-browser-profile'),'Case-private profile provenance');assert.ok(root.CommandLine.includes('--user-data-dir='+r.isolation.profile));
 for(const p of own){assert.ok(Number.isInteger(p.ProcessId)&&p.ProcessId>0&&![80444,90604].includes(p.ProcessId),'Only new task-owned Chrome identities');assert.ok(Date.parse(p.CreationDate)>=Date.parse(r.startedAt));assert.ok(typeof p.CommandLine==='string'&&typeof p.ExecutablePath==='string');if(p!==root){const parent=own.find(q=>q.ProcessId===p.ParentProcessId);assert.ok(parent&&p.depth===parent.depth+1,'Recorded owned descendant lineage');assert.ok(Date.parse(p.CreationDate)>=Date.parse(parent.CreationDate));}}
 for(const target of a.recheck.targets){const p=own.find(p=>p.ProcessId===target.ProcessId);assert.ok(p,'Each stop target was independently recorded as owned');eq(target,identity(p),'Same PID parent birth and executable before cleanup');}
 for(const event of a.stopEvents){assert.ok(a.recheck.targets.some(p=>p.ProcessId===event.ProcessId),'No stop outside the exact owned recheck set');if(event.CreationDate)eq(event.CreationDate,a.recheck.targets.find(p=>p.ProcessId===event.ProcessId).CreationDate);}
}
function testedMetadataPin() {return {...FIXED.metadataTransition.before,path:'.gitattributes'};}
function isTestedMetadataAlias(p) {const before=testedMetadataPin();return p.name==='.gitattributes'&&p.source==='.gitattributes'&&p.bytes===before.bytes&&p.sha256===before.sha256;}
function commonCase(c,J,logical,epoch,rom) {
 const f=c.fixed,r=J(f.result),sv=J(c.files.find(p=>p.path.endsWith('/source-verification.json')));eq(r.scenario,'original-p4-foreign-person-identity');eq(r.foreignOnly,true);eq(r.preflightOnly,false);eq(r.layout,f.layout);
 eq([r.ok,r.accepted,r.identityAccepted,r.hdAccepted],Array(4).fill(f.accepted));eq([r.phases.length,r.foreignInspection?.people.length||0,r.exceptions.length,r.dialogs.length,r.requests.filter(p=>p.status>=400&&!p.expected).length],[f.phaseCount,f.partialIdentityCount,f.exceptionCount,f.dialogCount,f.unexpectedRequestCount]);
 eq(sv,r.sourceVerification);eq([sv.ok,sv.count],[true,FIXED.runtimeInventoryCount]);eq(sv.added,[]);eq(sv.drift,[]);eq(sv.sources.length,FIXED.runtimeInventoryCount);eq(new Set(sv.sources.map(p=>p.name)).size,FIXED.runtimeInventoryCount);
 for(const p of sv.sources){eq(r.sources[p.name],{source:p.source,bytes:p.bytes,sha256:p.sha256});eq(p.actualSha256,p.sha256);eq(p.match,true);}eq(Object.keys(r.sources).length,FIXED.runtimeInventoryCount);
 const absent=epoch.sources.filter(p=>!Object.hasOwn(r.sources,p.path)).map(p=>p.path),intersection=epoch.sources.filter(p=>Object.hasOwn(r.sources,p.path));eq(absent,FIXED.inventoryCritical.notInRuntimePaths);eq(absent.length,FIXED.inventoryCritical.notInRuntimeCount);eq(intersection.length,FIXED.inventoryCritical.runtimeIntersectionCount);
 const aliases=intersection.filter(p=>{const m=r.sources[p.path];return m.source!==p.path||m.bytes!==p.bytes||m.sha256!==p.sha256;}).map(p=>({name:p.path,...r.sources[p.path]}));eq(aliases,f.sourceAliases,'Every original runtime/current source difference is explicit');
 if(f.credited)eq(aliases,[{name:'.gitattributes',source:'.gitattributes',bytes:testedMetadataPin().bytes,sha256:testedMetadataPin().sha256}],'Only the documented post-run Git metadata append differs; every executable and test byte remains exact');
 if(f.kind==='product-before'){eq(r.sourceVariant,{servedAs:'js/hd-city-menu.js',source:FIXED.baselineProduct.source.path,bytes:FIXED.baselineProduct.source.bytes,sha256:FIXED.baselineProduct.source.sha256});eq(r.sources['js/hd-city-menu.js'],{source:FIXED.baselineProduct.source.path,bytes:FIXED.baselineProduct.source.bytes,sha256:FIXED.baselineProduct.source.sha256});}
 for(const [file,source] of EXECUTED){const m=r.sources[source];assert.ok(m);check({path:f.directory+file,bytes:m.bytes,sha256:m.sha256},logical.get(f.directory+file));}eq(r.tool,r.sources['scripts/test-hd-person-identity-runtime.mjs']);
 eq(r.nativeSourceCheck.count,128);eq(r.nativeSourceCheck.aggregate,epoch.nativeAggregate);eq(r.nativeSourceCheck.manifest,epoch.nativeAggregate);eq(r.engineManifest.engineSourceSha256,epoch.nativeAggregate);
 eq(J(c.files.find(p=>p.path.endsWith('/browser-console.json'))),{console:r.console,log:r.log,exceptions:r.exceptions,dialogs:r.dialogs});
 cleanupCase(c,r);
 eq([r.isolation.cleaned,r.isolation.chromeExited,r.isolation.httpClosed,r.isolation.serverClosed],[true,true,true,true]);eq(r.isolation.user8080Touched,false);eq(r.serverClosed,true);eq(r.directoriesDeleted,false);eq(r.profileRetained,true);checkTerminal(c,J,r);
 eq(typeof f.failureImage,'boolean','Exact observed presence or absence of an original failure PNG');if(f.accepted)eq(f.failureImage,false);const pngs=r.phases.map(p=>({path:f.directory+p.file,bytes:p.bytes,sha256:p.sha256}));if(f.failureImage)pngs.push(c.files.find(p=>p.path===f.directory+'failure-identity.png'));eq(c.files.filter(p=>p.path.endsWith('.png')),uniquePins(pngs));for(const p of pngs)decodeV45Png(check(p,logical.get(p.path)));
 eq(c.files.map(p=>p.path),['source-verification.json','browser-console.json','owned-process-samples.jsonl',...EXECUTED.map(p=>p[0]),...r.phases.map(p=>p.file),...(f.failureImage?['failure-identity.png']:[])].map(n=>f.directory+n).sort());
 if(f.accepted){eq(r.exceptions,[]);eq(r.dialogs,[]);eq(r.requests.filter(p=>p.status>=400&&!p.expected),[]);eq(r.nativeNames,rom.names);eq(r.rom.names200,rom.names);eq(r.rom.nativeLabels,rom.labels);eq(r.rom.allPeriodMaxNameCodePoints,4);eq(r.rom.period,4);eq(r.rom.periodMaxNameCodePoints,4);eq(r.setup,{lordId:0,lordName:'曹丕',cityIndex:4,cityName:'晋阳'});eq(r.selectedLord.id,0);eq(r.selectedLord.name,'曹丕');
  eq(r.actualLibReads.map(p=>p.stage),['startup','after-foreign-ownership']);for(const s of r.actualLibReads){eq(s.first,s.last);eq(s.first.before,s.first.after);for(const k of ['a','b'])eq(s.first[k],{status:'ready',generation:s.first.a.generation,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',byteLength:207195,reason:''});}
  eq(roleChecks(r,rom),15);navigationChecks(r);
 }else{eq(r.error,f.error,'Exact original failed report remains false');if(f.kind==='product-before'){eq(r.foreignInspection.confirmations,[]);eq(r.foreignInspection.people,[]);eq(r.foreignInspection.pickers.length,1);eq(r.foreignInspection.pickers[0].presentation,null);eq(r.failureState.world,r.initialWorld);}}
 return {id:c.id,layout:r.layout,accepted:f.accepted,credited:f.credited,phases:r.phases.length,identities:f.credited?3:0,targetChecks:f.credited?15:0,frozenInventorySources:FIXED.runtimeInventoryCount,currentCriticalIntersection:intersection.length,currentCriticalNotInFrozenInventory:absent,currentCriticalLiteralMatches:intersection.length-aliases.length,documentedDeliveryMetadataAliases:aliases.filter(isTestedMetadataAlias).length,retainedPriorSourceAliases:aliases.filter(p=>!isTestedMetadataAlias(p)).length,retainedPartialIdentities:f.accepted?0:(r.foreignInspection?.people||[]).filter(p=>p.identity?.accepted===true).length,trustedMapPans:r.mapNavigation?.attempts.length||0,trustedListGutterPans:r.listPreviewPans?.length||0,ownedCleanupTargets:r.cleanup.recheck.targets.length,originalExitCode:f.accepted?0:1};
}
function tapStats(bytes) {const text=bytes.toString('utf8'),out={};for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const m=[...text.matchAll(new RegExp('^# '+k+' ([0-9.]+)\\s*$','gm'))];eq(m.length,1,'One complete TAP '+k);out[k]=Number(m[0][1]);}return out;}
function metadataChecks(J,logical,epoch) {
 const t=FIXED.metadataTransition;assert.ok(t,'The single post-run Git metadata transition is mandatory');eq(t.priorEpoch,{path:B+'source-epoch-v1.json',bytes:30090,sha256:'525e9c81a5611edc72bb3add6c29f3653120482a5ee2701bab9130e7915ab955'});
 const prior=J(t.priorEpoch),before=check(t.before,logical.get(t.before.path)),after=check(t.after,logical.get(t.after.path));eq(t.after.path,'.gitattributes');assert.ok(t.before.path.startsWith(B+'before/'));
 eq(t.appendedText,'/scripts/test-hd-city-mobile-host.mjs -text whitespace=cr-at-eol\n','One exact byte-preservation rule only');eq(after,Buffer.concat([before,Buffer.from(t.appendedText)]),'Whole attrs changes only by the one literal append');eq(testedMetadataPin(),prior.sources.find(p=>p.path==='.gitattributes'));eq(t.after,epoch.sources.find(p=>p.path==='.gitattributes'));
 const sources=prior.sources.map(p=>p.path==='.gitattributes'?t.after:p);eq(epoch,{...prior,sources,deliveryMetadataTransition:t.receipt},'Final epoch differs only by Git metadata and its explicit transition binding');
 const m=J(t.receipt);eq(m.schemaVersion,1);eq(m.accepted,true);eq(m.priorEpoch,t.priorEpoch);eq(m.before,t.before);eq(m.after,t.after);eq(m.appendedText,t.appendedText);eq(m.noExecutableSourceChanges,true);eq(m.noTestCaseChanges,true);eq(m.changedSelectedSources,['.gitattributes']);eq(m.fullSourcesAfter,t.fullSourcesAfter);eq(m.fullDefaultCompletedBeforeTransition,true);eq(m.fullDefault,FIXED.fullDefault.result);eq(m.runtimeCases,FIXED.cases.filter(c=>c.credited).map(c=>c.result));
 const test=logical.get('scripts/test-hd-city-mobile-host.mjs'),rawGit=createHash('sha1').update(Buffer.from('blob '+test.length+'\0')).update(test).digest('hex');eq(m.afterHashes,{raw:rawGit,filtered:rawGit});eq(m.beforeHashes.raw,rawGit);assert.match(m.beforeHashes.filtered,/^[0-9a-f]{40}$/);assert.notEqual(m.beforeHashes.filtered,rawGit,'Original text normalization differed from the tested raw CRLF bytes');
 const full=J(FIXED.fullDefault.result),tested=J(full.before),delivered=J(t.fullSourcesAfter);eq(delivered,tested.map(p=>p.path==='.gitattributes'?t.after:p),'All full-suite selected source pins preserved except the one literal metadata append');eq(delivered.length,1649);assert.ok(Date.parse(m.transitionedAt)>=Date.parse(full.finished));for(const c of FIXED.cases.filter(c=>c.credited))assert.ok(Date.parse(m.transitionedAt)>=Date.parse(J(c.result).finishedAt),'All credited browsers closed before metadata append');
 const raw=J(t.tool);eq([raw.chunk_id,raw.exit_code],[t.toolChunk,0]);assert.ok(!('session_id' in raw));
 return {path:'.gitattributes',appendedRule:t.appendedText.trimEnd(),selectedFullSources:1649,changedSelectedSources:['.gitattributes'],executableAndTestBytesUnchanged:true,fullSuiteRerunAfterMetadataAppend:false};
}
function testsChecks(J,logical,epoch) {
 const f=FIXED.fullDefault,r=J(f.result),stats=tapStats(check(r.stdout,logical.get(r.stdout.path)));eq(r.accepted,true);eq([r.processExitCode,r.signal],[0,null]);eq(r.registeredFiles,150);eq([r.tests,r.pass,r.expectedTests],[f.expectedTests,f.expectedTests,f.expectedTests]);for(const k of ['fail','cancelled','skipped','todo'])eq(r[k],0);for(const [k,v] of Object.entries(stats))eq(r[k],v);
 eq(r.selectedSourceBytesStable,true);eq(r.drift,[]);eq(r.newDistinctDefaultTests,f.newDistinctTests);eq(f.expectedTests,7913+f.newDistinctTests);eq(epoch.newDistinctDefaultTests,f.newDistinctTests);
 eq(r.parentV69SavedDefaultTests,7913);eq([r.parentHostModuleTests,r.currentHostModuleTests],[486,504]);eq(r.currentHostModuleTests-r.parentHostModuleTests,f.newDistinctTests);eq([r.newBrowserRuns,r.newNativeGameInputs,r.hdAccepted,r.globalHdComplete],[0,0,false,false]);assert.match(r.compilerVersion,/clang version 18\./);
 check(r.stderr,logical.get(r.stderr.path));const selected=J(r.before);eq(selected.length,r.selectedSources);eq(new Set(selected.map(p=>p.path)).size,selected.length);for(const p of epoch.sources){const s=selected.find(q=>q.path===p.path),expected=p.path==='.gitattributes'?testedMetadataPin():p;eq(s,expected,'Full test selected source equals current critical or exact documented metadata predecessor '+p.path);}
 const initial=J(f.tool.initial),terminal=J(f.tool.terminal);eq(initial.chunk_id,f.tool.initialChunk);eq([terminal.chunk_id,terminal.exit_code],[f.tool.terminalChunk,0]);assert.ok(!('session_id' in terminal));if(f.tool.sessionId===null){eq(f.tool.initial,f.tool.terminal);assert.ok(!('session_id' in initial));}else{eq(initial.session_id,f.tool.sessionId);assert.ok(!('exit_code' in initial));}const starts=[...initial.output.matchAll(/\{"event":"START"[^\r\n]*\}/g)];eq(starts.length,1);const start=JSON.parse(starts[0][0]);eq([start.registeredFiles,start.expectedTests,start.selectedSources],[150,f.expectedTests,r.selectedSources]);const closed=[...terminal.output.matchAll(/\{"event":"CLOSED"[^\r\n]*\}/g)];eq(closed.length,1);const t=JSON.parse(closed[0][0]);eq([t.accepted,t.processExitCode,t.tests,t.pass],[true,0,f.expectedTests,f.expectedTests]);
 const controls=[];for(const c of FIXED.unitControls){const u=J(c.result),s=tapStats(check(u.stdout,logical.get(u.stdout.path)));check(u.stderr,logical.get(u.stderr.path));eq(u.accepted,true);eq([u.tests,u.pass,u.fail],[c.tests,c.pass,c.fail]);eq(u.processExitCode,c.fail?1:0);eq(u.signal,null);eq(u.sourceStable,true);eq(u.drift,[]);eq([u.realGameplayRuns,u.globalHdComplete],[0,false]);for(const [k,v] of Object.entries(s))eq(u[k],v);for(const k of ['cancelled','skipped','todo'])eq(u[k],0);for(const p of J(u.before)){const current=epoch.sources.find(q=>q.path===p.path);assert.ok(current,'Each final unit selected source is a current critical source');eq(p,current);}const raw=J(c.tool);eq([raw.chunk_id,raw.exit_code],[c.toolChunk,0]);assert.ok(!('session_id' in raw));if(c.baselineProduct){eq(u.baselineProduct,c.baselineProduct);check(c.baselineProduct,logical.get(c.baselineProduct.path));}else eq(u.baselineProduct,null);controls.push({kind:u.kind,tests:u.tests,pass:u.pass,fail:u.fail,underlyingProcessExitCode:u.processExitCode,wrapperExitCode:raw.exit_code});}
 return {fullDefault:{tests:f.expectedTests,registeredFiles:150,newDistinctTests:f.newDistinctTests,currentFullRerun:true},controlledDiplomacy:controls};
}
export function verifyLogical(logical,b,readCurrent) {
 assert.ok(FIXED&&EPOCH,'Final concrete frozen pins are mandatory');const J=p=>json(check(p,logical.get(p.path))),epoch=J(EPOCH);eq(epoch.sources.length,FIXED.inventoryCritical.currentCount);eq(epoch.productSourceChanged,true);eq(epoch.engineRebuilt,false);eq(epoch.parentCommit,'8fd95a7b2f7232280a94ca1e897d18227e5c5334');
 eq(epoch.nativeSourceFiles,128);eq(epoch.nativeAggregate,'617c3aea391fa57bec1576e70cb6b4b1ed76f747c948015069a71f71b168ffb0');eq([epoch.defaultRegisteredFiles,epoch.currentFullDefaultRerun,epoch.savedParentV69DefaultTests],[150,true,7913]);eq(epoch.oldWorldRecovery,{userDecision:'保留旧战局，暂不重开；继续其他 HD 开发',retained:true,restartAuthorized:false,closeAuthorized:false,oldHeldInputs:0});
 for(const p of epoch.sources){check(p,logical.get(p.path));check(p,readCurrent(p.path,BOUNDS.maxFileBytes));}const native=epoch.sources.filter(p=>p.path.startsWith('vendor/iBaye/')&&p.path!=='vendor/iBaye/src/baye/version.h');eq(native.length,128);const aggregate=[];for(const p of native.sort((a,b)=>a.path<b.path?-1:1))aggregate.push(Buffer.from(p.path+'\0'),logical.get(p.path));eq(sha(Buffer.concat(aggregate)),epoch.nativeAggregate);
 const parent=J(epoch.parentBaseline);eq(parent.prefix,'docs/validation/m5-person-identity-20261026-v70');eq(parent.facts.identities,20);eq(parent.facts.targetChecks,100);eq(parent.facts.savedParentDefault.tests,7913);const parentPins=new Map(parent.packets.flatMap(p=>p.files).map(p=>[p.path,p]));const baseline=FIXED.baselineProduct;eq(baseline.parentCommit,epoch.parentCommit);eq([baseline.source.bytes,baseline.source.sha256],[parentPins.get('js/hd-city-menu.js').bytes,parentPins.get('js/hd-city-menu.js').sha256]);check(baseline.source,logical.get(baseline.source.path));eq(J(baseline.descriptor),{...baseline.source,commit:epoch.parentCommit,servedAs:'js/hd-city-menu.js'});
 eq(epoch.before.map(p=>p.source.path),epoch.changedPriorSources);eq(epoch.newMaintainedRuntimeFiles,1);const beforeMap=new Map();for(const row of epoch.before){check(row.saved,logical.get(row.saved.path));eq([row.saved.bytes,row.saved.sha256],[row.source.bytes,row.source.sha256]);if(parentPins.has(row.source.path))eq(row.source,parentPins.get(row.source.path));beforeMap.set(row.source.path,row.source);}
 const changed=[],added=[];for(const p of epoch.sources){const prior=beforeMap.get(p.path)||parentPins.get(p.path);if(!prior)added.push(p.path);else if(prior.bytes!==p.bytes||prior.sha256!==p.sha256)changed.push(p.path);}eq(changed,epoch.changedPriorSources,'Every changed current critical source against the explicit parent vector');eq(added,['scripts/hd-person-roles-runtime-checks.mjs'],'One new maintained role runtime helper');
 const freeze=J(b.freeze);eq(freeze.files.map(p=>p.path),SOURCES.map(n=>D+n));for(const p of freeze.files)check(p,logical.get(p.path));const peer=J(b.support.find(p=>p.path===D+'source-static-peer-v1.json'));eq(peer.verdict,'GO');eq(peer.freeze,b.freeze);eq(peer.files,freeze.files);eq(b.modules,freeze.files.filter(p=>MODULES.includes(path.basename(p.path))));eq(b.files,uniquePins([...epoch.sources,...b.support,...freeze.files,...b.cases.flatMap(c=>[...c.files,c.manifest,...c.chunks])]));
 const deliveryMetadataOnlyTransition=metadataChecks(J,logical,epoch),rom=originalRom(logical.get('libs/dat-mod.lib')),cases=b.cases.map(c=>commonCase(c,J,logical,epoch,rom));eq(cases.filter(c=>c.credited).map(c=>c.layout).sort(),['mobile667','mobile844','pc1080','pc720']);assert.ok(cases.filter(c=>c.credited).every(c=>c.accepted));const tests=testsChecks(J,logical,epoch);
 return {accepted:true,layouts:4,identities:12,targetChecks:60,maximumOriginalNameCodePoints:4,currentCriticalSources:epoch.sources.length,nativeSources:128,nativeAggregate:epoch.nativeAggregate,cases,wholeReports:cases.length,failedOriginalRuns:cases.filter(c=>!c.accepted).length,frozenInventoryIsNotAllServedOrExecuted:true,...tests,deliveryMetadataOnlyTransition,originalProductSourceChanged:true,engineRebuilt:false,foreignRoleRuntimeAccepted:true,targetConfirmationOrDispatchAccepted:false,oldWorldRetained:true,oldWorldInputs:0,oldWorldRestartAuthorized:false,captiveFreeRuntimeAccepted:false,all13NativePropertiesAccepted:false,realDeviceAccepted:false,stablePerformanceAccepted:false,globalHdComplete:false};
}
export function verify(root=process.cwd(),options={}) {
 assert.ok(FIXED&&EPOCH,'Final concrete frozen pins are mandatory');eq(V45_BOUNDS,BOUNDS);const readPublic=options.readPublic||((p,max)=>readFile(root,p,max)),readCurrent=options.readCurrent||((p,max)=>readFile(root,p,max)),C=json(readPublic(PREFIX+'.json',8*1024*1024));eq(C.schemaVersion,1);eq(C.prefix,PREFIX);eq(C.binding.path,D+'root-bindings-reviewed-v1.json');check(FIXED.codec,readCurrent(FIXED.codec.path,BOUNDS.maxFileBytes));
 const physical=new Map();let blobs=0;for(const p of C.packets){const index=json(check(p.index,readPublic(p.index.path,BOUNDS.maxFileBytes)));eq(index.files.map(p=>pin3(p)),p.files);const decoded=decodeV45Archive({index,readPart:(p,max)=>readPublic(p,max)});blobs+=decoded.physicalBlobs;for(const [name,bytes] of decoded.files){assert.ok(!physical.has(name));physical.set(name,bytes);}}
 const b=json(check(C.binding,physical.get(C.binding.path)));requireBinding(b);eq(C.packets.map(p=>({id:p.id,files:p.files})),packetPlan(b,C.binding));const logical=restore(physical,b);for(const p of b.files)check(p,physical.get(p.path));const fallbacks=[];for(const [p,bytes] of logical)if(p.startsWith(B)){if(fs.existsSync(path.join(root,p)))eq(readFile(root,p,Math.max(1,bytes.length)),bytes,'Present local original exact '+p);else fallbacks.push(p);}
 eq(C.modules.map(p=>p.path),MODULES.map(publicModule));for(let i=0;i<MODULES.length;i++)eq(check(C.modules[i],readPublic(C.modules[i].path,BOUNDS.maxFileBytes)),portable(check(b.modules[i],logical.get(b.modules[i].path))));eq(C.images.map(p=>p.path),b.images.map(p=>p.publicPath));for(const image of b.images)eq(check(C.images.find(p=>p.path===image.publicPath),readPublic(image.publicPath,BOUNDS.maxFileBytes)),check(image.source,logical.get(image.source.path)));
 const facts=verifyLogical(logical,b,readCurrent);eq(C.facts,facts);eq(C.markdown.path,PREFIX+'.md');eq(check(C.markdown,readPublic(C.markdown.path,BOUNDS.maxFileBytes)),Buffer.from(FIXED.markdown));return {accepted:true,facts,archive:{packets:C.packets.length,logicalFiles:logical.size,physicalPaths:physical.size,physicalBlobs:blobs},allOriginalWholeBytesVerified:true,localEvidenceFallbacks:fallbacks.sort(),archivedCodeExecuted:false,newBrowserRuns:0,newTests:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verify()));
