import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeV45Archive,V45_BOUNDS,decodeV45Png} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
import {B,D,PREFIX,MODULES,SOURCES,BOUNDS,EPOCH,FIXED,eq,sha,json,pin,pin3,check,readFile,uniquePins,publicModule,portable,requireBinding,packetPlan,restore} from './m5-person-identity-20261026-v70-v70-common-v1.mjs';

const TARGETS=[3,139,140,143,144],KINDS=['listName','heading','ownership','priorOwnership','nativeOwnership'];
const EXECUTED=[['executed-tool.mjs','scripts/test-hd-person-identity-runtime.mjs'],
  ['executed-checks.mjs','scripts/hd-person-identity-runtime-checks.mjs'],
  ['executed-rom.mjs','scripts/hd-person-identity-rom.mjs'],
  ['executed-preview-helper.mjs','scripts/hd-mobile-preview-runtime-checks.mjs'],
  ['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],
  ['executed-json.mjs','scripts/hd-runtime-json.mjs']];

// Independently read the exact original resource directory and sequential C records.
// Archived runtime/oracle sources are always bytes, never imported or evaluated.
function originalRom(bytes) {
  eq(bytes.length,207195,'Original ROM size');eq(sha(bytes),'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e','Original ROM SHA');
  const decode=new TextDecoder('gbk',{fatal:true});
  function item(id,i) {
    const base=bytes.readUInt32LE((id-1)*4),length=bytes.readUInt32LE(base),count=bytes.readUInt16LE(base+6),fixed=bytes.readUInt32LE(base+8);
    assert.ok(base>0&&base+length<=bytes.length&&i>=0&&i<count,'ROM resource bounds '+id+'/'+i);
    eq(bytes.readUInt16LE(base+4),id,'ROM resource ID');eq(bytes[base+12],0,'Unencrypted original resource');
    const offset=fixed?14+i*fixed:count===1?14:bytes.readUInt32LE(base+14+i*8);
    const n=fixed|| (count===1?length-14:bytes.readUInt32LE(base+18+i*8));
    assert.ok(offset>=14&&offset+n<=length,'ROM item extent');return bytes.subarray(base+offset,base+offset+n);
  }
  function text(id,i){const b=item(id,i),z=b.indexOf(0);return decode.decode(z<0?b:b.subarray(0,z));}
  const tables=[62,70,71,72].map(id=>Array.from({length:200},(_,i)=>text(id,i))),names=tables[3];
  eq(Math.max(...tables.flat().map(n=>Array.from(n).length)),4,'Whole original library maximum name');
  const pd=item(61,3),cd=item(57,3),qd=item(65,3);eq(pd.length,3800);eq(cd.length,1408);eq(qd.length%2,0);
  const people=Array.from({length:200},(_,i)=>({Belong:pd.readUInt16LE(i*19+2)}));
  const city={Belong:cd.readUInt16LE(30*37+1),PersonQueue:cd.readUInt16LE(30*37+29),Persons:cd.readUInt16LE(30*37+31)};
  const queue=Array.from({length:qd.length/2},(_,i)=>qd.readUInt16LE(i*2));
  const roster=queue.slice(city.PersonQueue,city.PersonQueue+city.Persons),allied=roster.filter(i=>people[i].Belong===city.Belong);
  eq(text(58,30),'云南');eq(city,{Belong:4,PersonQueue:132,Persons:11});
  eq(allied,[3,139,140,141,142,143,144,145,146,147]);
  eq([3,...allied.filter(i=>i!==3&&Array.from(names[i]).length===4)],TARGETS);
  return {names,people,city,queue,roster,allied,title:text(64,23),labels:{king:text(64,47),free:text(64,46),captive:text(64,48)}};
}
const contains=(a,b)=>b.left>=a.left-1&&b.top>=a.top-1&&b.right<=a.right+1&&b.bottom<=a.bottom+1;
const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
function geometry(g,text,viewport,label) {
  assert.ok(g?.shown&&g.lines.length>0,label+' shown with actual Range rectangles');eq(g.text,text,label+' complete text');eq(g.rangeText,text,label+' complete Range text');
  const screen={left:0,top:0,right:viewport.width,bottom:viewport.height};
  const clip={...screen};for(const ancestor of g.ancestors) {
    if(/^(auto|scroll|hidden|clip)$/.test(ancestor.overflowX)){clip.left=Math.max(clip.left,ancestor.clip.left);clip.right=Math.min(clip.right,ancestor.clip.right);}
    if(/^(auto|scroll|hidden|clip)$/.test(ancestor.overflowY)){clip.top=Math.max(clip.top,ancestor.clip.top);clip.bottom=Math.min(clip.bottom,ancestor.clip.bottom);}
  }
  eq(g.clip,clip,label+' independently derived recorded ancestor clip');
  for(const r of [g.bounds,...g.lines]) {
    assert.ok(['left','top','right','bottom','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0,label+' finite positive geometry');
    assert.ok(contains(screen,r)&&contains(g.clip,r),label+' inside screen and all ancestor clips');
  }
  for(const line of g.lines)assert.ok(contains(g.bounds,line),label+' Range within its own box');
  assert.ok(g.lineHits.length===g.lines.length&&g.lineHits.every(v=>v===true),label+' actual text-line hit tests');
  assert.ok(g.clientWidth>0&&g.clientHeight>0&&g.scrollWidth<=g.clientWidth+1&&g.scrollHeight<=g.clientHeight+1,label+' no text overflow');
  assert.notEqual(g.style.textOverflow,'ellipsis',label+' no ellipsis');assert.ok(['none','0',''].includes(g.style.lineClamp),label+' no line clamp');
}
function sameMeasured(sample,before,label) {
  eq(sample.world,before.world,label+' complete measured world');eq(sample.native,before.native,label+' complete sampled native state');
  eq(sample.state.keyCount,before.state.keyCount,label+' zero native keys');eq(sample.state.touchCount,before.state.touchCount,label+' zero LCD touches');
}
function verifyIdentities(r,rom) {
  eq(r.targets,TARGETS,'Five real targets');eq(r.people.map(p=>p.personId),TARGETS,'Real person order');
  let targetChecks=0;
  for(const person of r.people) {
    const id=person.personId,name=rom.names[id],e=person.identity,before=e.before;
    eq(name,person.name,'Full independent ROM name');eq(person.nameCodePoints,Array.from(name).length);
    eq(e.accepted,true,'Identity child acceptance');eq(e.personId,id);eq(e.keys,[]);
    eq(before.world,r.initialWorld,'Read-only identity world');eq(before.world.people[id].Belong,4);eq(before.world.people[id].OldBelong,0);
    eq(person.selection.before.world,r.initialWorld);eq(person.selection.after.world,r.initialWorld);
    const from=person.selection.before.state.menu.index,to=person.selection.after.state.menu.index;
    eq(person.selection.after.state.menu.ids[to],id,'Actual independently selected focus');
    eq(person.selection.physicalKeys,Array(Math.abs(to-from)).fill(to>from?35:34),'Only necessary actual native focus arrows');
    eq(before.state.menu.ids,rom.allied,'Actual native person roster');eq(before.state.menu.names,rom.allied.map(i=>rom.names[i]));
    const menu=before.state.menu,p=before.native.person,ui=before.state.cityUi,owner=ui.deepMenuOwner;
    eq(menu.ids[menu.index],id);eq(menu.names[menu.index],name);eq(menu.idsValid,true);eq([menu.active,menu.context,menu.kind],[1,1,3]);
    eq(before.native.menu,menu);eq([before.native.march.phase,before.native.march.pick,before.native.march.battlePick],[0,0,0]);
    eq([before.native.report.active,before.native.qty.active],[0,0]);
    eq([p.protocolVersion,p.active,p.custom,p.context,p.kind,p.person,p.index],[1,1,0,1,3,id,menu.index]);
    eq([p.generation,p.detailGeneration,p.menuSeq],[menu.detailGeneration,menu.detailGeneration,menu.seq]);
    eq([p.pageIndex,p.pageStart,p.pageComplete,p.propertyCount],[0,0,1,13]);eq(p.name,name);
    const nativeValue=id===3?rom.labels.king:rom.names[3],hudValue=id===3?'君主 · '+rom.names[3]:rom.names[3];
    eq(e.expected,{personId:id,period:4,name,belong:4,oldBelong:0,
      ownership:{kind:id===3?'lord':'owned',value:4,personIndex:3,name:rom.names[3],label:hudValue},
      priorOwnership:'未记录（0）',nativeOwnership:nativeValue,nativeTitle:rom.title},'Independent current/native ownership');
    eq(ui.personDetail.ownership,e.expected.ownership);eq(ui.personDetail.corePresentation,'default');
    eq(ui.personProperties.name,name);eq(ui.personProperties.pageComplete,true);eq(ui.personProperties.custom,false);
    const prop=p.properties[0];eq([prop.index,prop.title,prop.value,prop.captured,prop.titleCaptured,prop.valueCaptured],[0,rom.title,nativeValue,true,true,true]);
    eq([prop.titlePaintSeq,prop.valuePaintSeq],[p.paintSeq,p.paintSeq]);
    eq(e.menuName.fullName,name);eq(e.menuName.packedName,menu.packedNames[menu.index]);eq(e.menuName.itemLen,menu.itemLen);
    eq(e.menuName.packedDiffersFromFullName,e.menuName.packedName!==name,'Retain packed half-character loss as original evidence');
    eq(e.observations.map(o=>o.kind),KINDS,'Five actual visible targets');
    for(const o of e.observations) {
      eq(o.reveal.visible,true,'Genuine target reveal');eq(o.afterReveal.keys,[]);eq(o.afterScreenshot.keys,[]);
      sameMeasured(o.afterReveal.sample,before,'Reveal');sameMeasured(o.screenshot.sample,before,'Screenshot');sameMeasured(o.afterScreenshot.sample,before,'After screenshot');
      const dom=o.dom;eq(dom.before,dom.after,'One stable DOM owner and paint');eq(dom.before.menu,menu);eq(dom.before.properties,p);
      eq(dom.before.owner,owner);eq(dom.before.detail,ui.personDetail);eq(dom.before.uiProperties,ui.personProperties);
      eq([dom.before.hidden,dom.before.open,dom.before.showHd,dom.before.layer],[false,true,true,'deep']);
      assert.ok(!dom.before.sending&&!dom.before.queueLen&&!dom.before.personPagePending,'No pending native dispatch');
      eq(dom.corePresentation,'default');
      if(o.kind==='listName'||o.kind==='heading') {
        geometry(dom.value,name,r.viewport,o.kind);
        if(o.kind==='listName') {
          eq(dom.tag,'BUTTON');eq(dom.list.directText,[name]);eq([dom.list.childNodeCount,dom.list.elementChildren],[1,0]);
          eq([dom.list.index,dom.list.personId,dom.list.name],[String(menu.index),String(id),name]);
          eq([dom.list.owner,dom.list.context,dom.list.kind,dom.list.seq],[owner.key,'1','3',String(menu.seq)]);
        } else {eq(dom.tag,'H2');eq(dom.id,'hd-city-menu-person-name');}
      } else {
        const title=o.kind==='nativeOwnership'?rom.title:o.kind==='priorOwnership'?'原归属':'归属';
        const value=o.kind==='nativeOwnership'?nativeValue:o.kind==='priorOwnership'?'未记录（0）':hudValue;
        geometry(dom.label,title,r.viewport,o.kind+' label');geometry(dom.value,value,r.viewport,o.kind+' value');
        assert.ok(!overlaps(dom.label.bounds,dom.value.bounds),'Labels and values do not overlap');
        for(const a of dom.label.lines)for(const b of dom.value.lines)assert.ok(!overlaps(a,b),'No text-line overlap');
        if(o.kind==='nativeOwnership')eq([dom.field,dom.current,Number(dom.titlePaintSeq),Number(dom.valuePaintSeq),Number(dom.propertiesPaintSeq)],['0','1',p.paintSeq,p.paintSeq,p.paintSeq]);
        else eq(dom.groupTitle,'身份与经历');
      }
      for(const adjacent of dom.neighbors)if(adjacent.width>0&&adjacent.height>0)assert.ok(!overlaps(dom.row.bounds,adjacent),'No adjacent heading/row overlap');
      const phase=r.phases.find(p=>p.file===o.screenshot.file);eq(o.screenshot,phase,'Original full phase screenshot and sample');targetChecks++;
    }
    sameMeasured(e.after,before,'Completed identity');
  }
  return targetChecks;
}
function checkTerminal(c,J,r) {
  const t=c.fixed.tool,initial=J(t.initial),terminal=J(t.terminal);
  eq(initial.chunk_id,t.initialChunk,'Actual initial tool chunk '+c.id);eq(terminal.chunk_id,t.terminalChunk,'Actual closed tool chunk '+c.id);
  eq(terminal.exit_code,c.fixed.accepted?0:1,'Original terminal exit '+c.id);assert.ok(!('session_id' in terminal),'Terminal has no live session');
  if(t.sessionId===null) {eq(t.initial,t.terminal,'Immediate closed original tool');assert.ok(!('session_id' in initial));}
  else {eq(initial.session_id,t.sessionId,'Actual running session');assert.ok(!('exit_code' in initial));}
  const summaries=[...terminal.output.matchAll(/Finished (\{[^\r\n]*\})/g)];eq(summaries.length,1,'One original Finished terminal summary');
  const last=JSON.parse(summaries[0][1]);eq([last.ok,last.hdAccepted,last.identityAccepted,last.checkpoints,last.sources],
    [r.ok,r.hdAccepted,r.identityAccepted,r.phases.length,1225],'Raw CLI terminal agrees with whole report');
}
function commonCase(c,J,logical,epoch,rom) {
  const r=J(c.fixed.result),sv=J(c.files.find(p=>p.path.endsWith('/source-verification.json')));
  eq(r.scenario,'original-p4-person-identity');eq(r.preflightOnly,false);eq(r.layout,c.fixed.layout);
  eq([r.ok,r.accepted,r.identityAccepted,r.hdAccepted],Array(4).fill(c.fixed.accepted),'Original complete run outcome');
  eq([r.phases.length,r.people?.length||0,r.exceptions.length,r.dialogs.length,
    r.requests.filter(p=>p.status>=400&&!p.expected).length],
    [c.fixed.phaseCount,c.fixed.partialIdentityCount,c.fixed.exceptionCount,c.fixed.dialogCount,c.fixed.unexpectedRequestCount],
    'Exact original success/failure observation counts '+c.id);
  eq(sv,r.sourceVerification,'Whole separate source verification');eq([sv.ok,sv.count],[true,1225]);eq(sv.added,[]);eq(sv.drift,[]);
  eq(sv.sources.length,1225);eq(new Set(sv.sources.map(p=>p.name)).size,1225);
  for(const p of sv.sources) {
    eq(r.sources[p.name],{source:p.source,bytes:p.bytes,sha256:p.sha256},'Startup source vector '+p.name);
    eq(p.actualSha256,p.sha256,'Source final SHA '+p.name);eq(p.match,true,'Source final match '+p.name);
  }
  eq(Object.keys(r.sources).length,1225);
  const absent=epoch.sources.filter(p=>!Object.hasOwn(r.sources,p.path)).map(p=>p.path);
  const intersection=epoch.sources.filter(p=>Object.hasOwn(r.sources,p.path));
  eq(absent,FIXED.inventoryCritical.notInRuntimePaths,'Exact current-critical paths outside this runtime frozen inventory');
  eq(absent.length,FIXED.inventoryCritical.notInRuntimeCount,'Exact non-inventory critical count');
  eq(intersection.length,FIXED.inventoryCritical.runtimeIntersectionCount,'Exact runtime/current critical intersection');
  for(const p of intersection) {
    const observed=r.sources[p.path];
    const expected=p.path==='scripts/test-hd-person-identity-runtime.mjs'?c.fixed.runner:p;
    eq({path:p.path,bytes:observed.bytes,sha256:observed.sha256},expected,'Exact current/old runner source alias '+c.id+' '+p.path);
  }
  for(const [file,source] of EXECUTED) {
    const m=r.sources[source];assert.ok(m,'Executed tool/helper must belong to its own runtime frozen inventory '+source);
    const bytes=logical.get(c.fixed.directory+file);check({path:c.fixed.directory+file,bytes:m.bytes,sha256:m.sha256},bytes);
  }
  eq(r.tool,r.sources['scripts/test-hd-person-identity-runtime.mjs'],'Actual runner source metadata');
  eq(r.nativeSourceCheck.count,128);eq(r.nativeSourceCheck.aggregate,epoch.nativeAggregate);eq(r.nativeSourceCheck.manifest,epoch.nativeAggregate);
  eq(r.engineManifest.engineSourceSha256,epoch.nativeAggregate);
  if(c.fixed.accepted){eq(r.exceptions,[]);eq(r.dialogs,[]);eq(r.requests.filter(p=>p.status>=400&&!p.expected),[]);}
  eq(J(c.files.find(p=>p.path.endsWith('/browser-console.json'))),{console:r.console,log:r.log,exceptions:r.exceptions,dialogs:r.dialogs},'Original complete browser console');
  eq(r.cleanup.treeExited,true,'Owned tree exit');eq(r.cleanup.errors,[]);eq(r.cleanup.exitVerification.treeExited,true);
  for(const key of ['survivingRecorded','rootDescendants','profileMatches'])eq(r.cleanup.exitVerification[key],[],'No owned survivors '+key);
  eq(r.cleanup.recheck.targets,[]);eq(r.cleanup.recheck.refused,[]);
  eq([r.isolation.cleaned,r.isolation.chromeExited,r.isolation.httpClosed,r.isolation.serverClosed],[true,true,true,true]);
  eq(r.isolation.user8080Touched,false);eq(r.serverClosed,true);eq(r.directoriesDeleted,false);eq(r.profileRetained,true);
  checkTerminal(c,J,r);
  const expectedPngs=r.phases.map(p=>({path:c.fixed.directory+p.file,bytes:p.bytes,sha256:p.sha256}));
  if(!c.fixed.accepted)expectedPngs.push(c.files.find(p=>p.path===c.fixed.directory+'failure-identity.png'));
  eq(c.files.filter(p=>p.path.endsWith('.png')),uniquePins(expectedPngs),'Every original phase/failure PNG');
  const expectedNames=['source-verification.json','browser-console.json','owned-process-samples.jsonl',...EXECUTED.map(p=>p[0]),
    ...r.phases.map(p=>p.file),...(!c.fixed.accepted?['failure-identity.png']:[])].map(n=>c.fixed.directory+n).sort();
  eq(c.files.map(p=>p.path),expectedNames,'Complete explicit original run file set');
  for(const p of expectedPngs)decodeV45Png(check(p,logical.get(p.path)));
  if(c.fixed.accepted) {
    eq(r.nativeNames,rom.names,'Actual 200 native full names independently match original ROM');
    eq(r.rom.names200,rom.names);eq(r.rom.nativeLabels,rom.labels);eq(r.rom.allPeriodMaxNameCodePoints,4);
    eq(r.rom.period,4);eq(r.rom.periodMaxNameCodePoints,4);
    eq(r.actualLibReads.map(p=>p.stage),['startup','after-identity'],'Actual original library reads bracket identity run');
    for(const read of r.actualLibReads) {
      eq(read.first,read.last,'Two stable actual library read samples');eq(read.first.before,read.first.after,'No native SPE mutation within LIB read');
      for(const name of ['a','b'])eq(read.first[name],{status:'ready',generation:read.first.a.generation,
        sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',byteLength:207195,reason:''},'Actual exact original library identity');
    }
    eq([r.initialWorld.period,r.initialWorld.king],[4,3]);eq(r.selectedLord.id,3);eq(r.selectedLord.name,rom.names[3]);
    eq(r.roster.cityIndex,30);eq(r.roster.queue,rom.roster);eq(r.roster.allied,rom.allied);
    for(const k of ['Belong','PersonQueue','Persons'])eq(r.roster.city[k],rom.city[k]);
    eq(r.initialWorld.people.map(p=>p.Belong),rom.people.map(p=>p.Belong));
    const checks=verifyIdentities(r,rom);eq(checks,25);
    if(r.mobile) {
      const previews=r.mobileNavigation.checks.filter(p=>p.kind==='preview');eq(previews.length,5,'Five actual touch previews');
      for(let i=0;i<previews.length;i++) {
        const p=previews[i],menu=p.before.state.menu;eq(p.menuKind,3);eq(p.personOrTool,TARGETS[i]);
        eq(p.after.state.menu.ids[p.after.state.menu.index],TARGETS[i]);eq(p.after.state.menu.seq,menu.seq);
        eq(p.after.state.menu.ids,menu.ids);eq(p.after.state.menu.names,menu.names);
        const delta=p.index-menu.index;eq(p.keys.map(k=>k.code),Array(Math.abs(delta)).fill(delta>0?35:34),'Touch preview sends only exact focus arrows');
        eq(p.before.world,r.initialWorld);eq(p.after.world,r.initialWorld);eq(p.after.state.touchCount,p.before.state.touchCount);
        eq(p.geometry.visible,true);assert.ok(p.geometry.rect.width>=43.5&&p.geometry.rect.height>=43.5,'Actual touch preview >=44px');
      }
      for(const s of r.mobileNavigation.scrollChecks) {
        eq(s.keys,[]);eq(s.after.native,s.before.native);eq(s.before.world,r.initialWorld);eq(s.after.world,r.initialWorld);
        eq(s.after.state.keyCount,s.before.state.keyCount);eq(s.after.state.touchCount,s.before.state.touchCount);
        assert.notEqual(s.scrollTop,s.geometry.scroller.scrollTop,'Actual trusted content scroll');
      }
      for(const s of r.listPreviewPans||[]) {
        assert.ok(TARGETS.includes(s.personId),'Pan reveals an actual identity target');eq(s.plan.pane,'hd-city-menu-deep');
        eq(s.keys,[]);eq(s.before.world,r.initialWorld);eq(s.after.world,r.initialWorld);eq(s.after.native,s.before.native);
        eq(s.after.state.keyCount,s.before.state.keyCount);eq(s.after.state.touchCount,s.before.state.touchCount);
        assert.ok(s.plan.band[1]-s.plan.band[0]>=52,'Actual noninteractive list band >=52px');eq(s.plan.points.length,7);
        for(const point of s.plan.points) {
          assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y),'Actual finite trusted touch coordinate');
          assert.ok(point.x>=s.plan.clip.left&&point.x<=s.plan.clip.right&&point.y>=s.plan.clip.top&&point.y<=s.plan.clip.bottom,'Trusted list pan stays in real clip');
          for(const rect of s.plan.interactiveRects)assert.ok(point.x<rect.left-2||point.x>rect.right+2||point.y<rect.top-2||point.y>rect.bottom+2,'Touch circle avoids all interactive boxes');
        }
        assert.ok(s.plan.down?s.scrollTop>s.plan.scrollTop:s.scrollTop<s.plan.scrollTop,'Actual list scroll moves in intended direction');
      }
    }
    eq(r.nativeTouches,[]);eq(r.mapNavigation.accepted,true);eq(r.mapNavigation.nativeInputsDuringPan,0);
    eq(r.mapNavigation.cityIndex,30);eq(r.cityPoint,r.mapNavigation.final);eq([r.cityPoint.index,r.cityPoint.name,r.cityPoint.hit],[30,'云南',true]);
    assert.ok(r.cityPoint.x>=24&&r.cityPoint.x<=r.viewport.width-24&&r.cityPoint.y>=64&&r.cityPoint.y<=r.viewport.height-48,'Actual city tap is safely visible');
    for(const pan of r.mapNavigation.attempts) {
      eq(pan.keys,[]);eq(pan.after.world,pan.before.world);eq(pan.after.native,pan.before.native);
      eq(pan.after.state.keyCount,pan.before.state.keyCount);eq(pan.after.state.touchCount,pan.before.state.touchCount);
      eq(pan.mapAfter.pan.on,false);const a=pan.mapBefore.camera,z=pan.mapAfter.camera;
      assert.ok(Math.abs(a.x-z.x)>.01||Math.abs(a.y-z.y)>.01,'Trusted pan actually changes camera');
      assert.ok(z.x>=z.minX-.01&&z.x<=z.maxX+.01&&z.y>=z.minY-.01&&z.y<=z.maxY+.01,'Actual camera remains bounded');
    }
    eq(r.returnChecks.length,1);const ret=r.returnChecks[0];eq(ret.layer,'map');eq(ret.keys,[40]);
    eq(ret.before.world,r.initialWorld);eq(ret.after.world,r.initialWorld);eq(r.final.world,r.initialWorld);
    eq([ret.after.native.menu.active,ret.after.native.march.pick,ret.after.native.march.phase,ret.after.native.qty.active,ret.after.native.report.active],[0,1,0,0,0]);
    eq(ret.after.state.cityUi.open,false);eq(r.final.state.cityUi.open,false);
    eq(r.summary,{people:5,rulers:1,maximumLengthAlliedNames:4,maximumNameCodePoints:4,identityInspectionKeys:0,nativeTouches:0,worldUnchanged:true,returnedToActualMap:true});
  } else if(c.fixed.failureStage==='map-point') {
    eq(r.phases,[]);assert.ok(!r.people,'First failure reached no identity target');eq(r.inputs.length,10);
    assert.ok(r.inputs.every(i=>i.type==='public-title-key'),'Only ten title/new-game boot keys');
  } else if(c.fixed.failureStage==='return-contract') {
    eq(r.people.length,5);eq(r.people.map(p=>p.identity.accepted),Array(5).fill(true),'Retained partial child observations');
    assert.ok(!r.final,'Old failed return has no completed final');assert.match(r.error,/Actual displayed DOM #hd-city-menu \[data-hd-menu-back\]/);
  } else {
    assert.ok(['mobile-entry','mobile-controls-ready','mobile-pan-band','mobile-identity-reveal'].includes(c.fixed.failureStage),'Explicit original mobile failure stage');
    eq(r.error,c.fixed.error,'Exact retained mobile failure message');
  }
  return {id:c.id,layout:r.layout,accepted:c.fixed.accepted,credited:c.fixed.credited,phases:r.phases.length,
    identities:c.fixed.credited?5:0,targetChecks:c.fixed.credited?25:0,
    frozenInventorySources:1225,currentCriticalIntersection:intersection.length,currentCriticalNotInFrozenInventory:absent,
    retainedPartialIdentities:c.fixed.accepted?0:(r.people||[]).filter(p=>p.identity?.accepted===true).length,
    trustedMapPans:r.mapNavigation?.attempts.length||0,trustedListGutterPans:r.listPreviewPans?.length||0,
    originalExitCode:c.fixed.accepted?0:1};
}
export function verifyLogical(logical,b,readCurrent) {
  const J=p=>json(check(p,logical.get(p.path))),epoch=J(EPOCH);
  eq(epoch.sources.length,156);eq(epoch.productSourceChanged,false);eq(epoch.engineRebuilt,false);
  eq(FIXED.inventoryCritical.currentCount,156);eq(FIXED.inventoryCritical.runtimeIntersectionCount,145);eq(FIXED.inventoryCritical.notInRuntimeCount,11);
  eq(epoch.nativeSourceFiles,128);eq(epoch.nativeAggregate,'617c3aea391fa57bec1576e70cb6b4b1ed76f747c948015069a71f71b168ffb0');
  eq([epoch.defaultRegisteredFiles,epoch.newDistinctDefaultTests,epoch.currentFullDefaultRerun,epoch.savedParentV69DefaultTests],[150,0,false,7913]);
  eq(epoch.oldWorldRecovery,{userDecision:'保留旧战局，暂不重开；继续其他 HD 开发',retained:true,restartAuthorized:false,closeAuthorized:false,oldHeldInputs:0});
  for(const p of epoch.sources) {check(p,logical.get(p.path));check(p,readCurrent(p.path,BOUNDS.maxFileBytes));}
  const native=epoch.sources.filter(p=>p.path.startsWith('vendor/iBaye/')&&p.path!=='vendor/iBaye/src/baye/version.h');eq(native.length,128);
  const aggregate=[];for(const p of native.sort((a,b)=>a.path<b.path?-1:1))aggregate.push(Buffer.from(p.path+'\0'),logical.get(p.path));
  eq(sha(Buffer.concat(aggregate)),epoch.nativeAggregate,'All 128 current native original bytes');
  const parent=J(epoch.parentBaseline);eq(parent.facts.fullDefault.tests,7913,'Saved parent default total only');
  eq(parent.facts.fullDefault.registeredFiles,150);
  const parentPins=new Map(parent.packets.flatMap(p=>p.files).map(p=>[p.path,p]));
  const changed=epoch.sources.filter(p=>parentPins.has(p.path)&&parentPins.get(p.path).sha256!==p.sha256).map(p=>p.path);
  eq(changed,['.gitattributes','package.json'],'Original product JS/C/engine unchanged against saved parent leaf pins');
  eq(epoch.sources.filter(p=>!parentPins.has(p.path)).map(p=>p.path).sort(),
    ['scripts/hd-person-identity-rom.mjs','scripts/hd-person-identity-runtime-checks.mjs','scripts/test-hd-person-identity-runtime.mjs'].sort(),'Only three new maintenance sources');
  const freeze=J(b.freeze);eq(freeze.files.map(p=>p.path),SOURCES.map(n=>D+n),'Frozen preparation source set');
  for(const p of freeze.files)check(p,logical.get(p.path));
  const peer=J(b.support.find(p=>p.path===D+'source-static-peer-v1.json'));
  eq(peer.verdict,'GO');eq(peer.freeze,b.freeze,'Peer reviewed exact SOURCE freeze');eq(peer.files,freeze.files,'Peer current complete source vector');
  eq(b.modules,freeze.files.filter(p=>MODULES.includes(path.basename(p.path))),'Reviewed current verifier pins');
  eq(b.files,uniquePins([...epoch.sources,...b.support,...freeze.files,
    ...b.cases.flatMap(c=>[...c.files,c.manifest,...c.chunks])]),'Exact complete archived input set');
  const rom=originalRom(logical.get('libs/dat-mod.lib'));
  const cases=b.cases.map(c=>commonCase(c,J,logical,epoch,rom));
  eq(cases.filter(c=>c.credited).map(c=>c.layout).sort(),['mobile667','mobile844','pc1080','pc720'],'Four actually completed credited layouts');
  assert.ok(cases.filter(c=>c.credited).every(c=>c.accepted),'No failure receives product credit');
  const old=check(FIXED.oldHelper,logical.get(FIXED.oldHelper.path)),current=logical.get('scripts/hd-person-identity-runtime-checks.mjs');
  eq(old.length,21928,'Original unused preflight helper retained');assert.ok(!old.equals(current),'Corrected current helper retained separately');
  const preflight=J(FIXED.preflight.result);eq(preflight.preflightOnly,true);
  eq([preflight.ok,preflight.accepted,preflight.identityAccepted,preflight.hdAccepted],[true,false,false,false],'Nogame preflight is not actual acceptance');
  eq(preflight.phases,[]);eq(preflight.sourceVerification.count,1225);eq(preflight.sourceVerification.ok,true);
  eq(J(FIXED.preflight.tool).exit_code,0,'Original preflight tool closed');
  const prior=FIXED.priorPrepareFailure,refusal=J(prior.capture);
  eq([refusal.chunk_id,refusal.exit_code],['36b3b4',1],'Original D1 prepare refusal');assert.ok(!('session_id' in refusal));
  assert.ok(refusal.output.includes('Critical source in actual execution designer.html'),'Original inventory-shape refusal retained');
  eq(J(prior.freeze).files,prior.sources,'Full original D1 source vector preserved');
  for(const p of prior.sources)check(p,logical.get(p.path));eq(J(prior.peer).freeze,prior.freeze,'Original D1 static peer preserved');
  eq(prior.outputsCreated,false,'D1 refused before chunk/draft writes');
  for(const repair of FIXED.repairs) {
    const m=J(repair.receipt),before=check(repair.before,logical.get(repair.before.path)).toString('utf8'),after=check(repair.after,logical.get(repair.after.path)).toString('utf8');
    eq([m.before.bytes,m.before.sha256],[repair.before.bytes,repair.before.sha256],'Exact old source alias for mechanical receipt');
    eq([m.after.bytes,m.after.sha256],[repair.after.bytes,repair.after.sha256],'Exact new source alias for mechanical receipt');
    const hunks=m.hunk?[m.hunk]:m.hunks;assert.ok(Array.isArray(hunks)&&hunks.length>0,'Explicit exact controller hunks');
    let current=before;for(const h of hunks){eq(current.split(h.old).length-1,1,'One exact controller hunk '+repair.receipt.path);current=current.replace(h.old,h.replacement);}
    eq(current,after,'Whole controller mechanical transition '+repair.receipt.path);eq(m.productSourceChanged,false);
    if(repair.scope==='mobile-only') {
      assert.ok(['pcBranchUnchanged','pcGamePathUnchanged'].includes(repair.pcGuard),'Fixed actual PC guard field');
      eq(m[repair.pcGuard],true,'Passed PC branch unchanged by later mobile maintenance');
    }
    if('failedRunRecoloured' in m)eq(m.failedRunRecoloured,false);
    if('mobileFailedRunsRecoloured' in m)eq(m.mobileFailedRunsRecoloured,false);
  }
  return {accepted:true,layouts:4,identities:20,targetChecks:100,maximumOriginalNameCodePoints:4,currentCriticalSources:156,
    nativeSources:128,nativeAggregate:epoch.nativeAggregate,cases,wholeReports:cases.length,failedOriginalRuns:cases.filter(c=>!c.accepted).length,
    frozenInventoryIsNotAllServedOrExecuted:true,priorPrepareFailures:1,
    savedParentDefault:{tests:7913,registeredFiles:150,newDefaultTests:0,currentFullRerun:false},
    originalProductSourceChanged:false,oldWorldRetained:true,oldWorldInputs:0,oldWorldRestartAuthorized:false,
    captiveFreeEnemyRuntimeAccepted:false,all13NativePropertiesAccepted:false,realDeviceAccepted:false,stablePerformanceAccepted:false,globalHdComplete:false};
}
export function verify(root=process.cwd(),options={}) {
  eq(V45_BOUNDS,BOUNDS,'Original eight codec bounds');
  const readPublic=options.readPublic||((p,max)=>readFile(root,p,max)),readCurrent=options.readCurrent||((p,max)=>readFile(root,p,max));
  const C=json(readPublic(PREFIX+'.json',8*1024*1024));eq(C.schemaVersion,1);eq(C.prefix,PREFIX);
  eq(C.binding.path,D+'root-bindings-reviewed-v1.json','Exact reviewed root binding');
  check(FIXED.codec,readCurrent(FIXED.codec.path,BOUNDS.maxFileBytes));
  const physical=new Map();let blobs=0;
  for(const p of C.packets) {
    const index=json(check(p.index,readPublic(p.index.path,BOUNDS.maxFileBytes)));
    eq(index.files.map(p=>pin3(p)),p.files,'Complete packet originals');
    const decoded=decodeV45Archive({index,readPart:(p,max)=>readPublic(p,max)});blobs+=decoded.physicalBlobs;
    for(const [name,bytes] of decoded.files){assert.ok(!physical.has(name),'One physical logical path '+name);physical.set(name,bytes);}
  }
  const b=json(check(C.binding,physical.get(C.binding.path)));requireBinding(b);
  const planned=packetPlan(b,C.binding);eq(C.packets.map(p=>({id:p.id,files:p.files})),planned,'Exact derived packet/file order');
  const logical=restore(physical,b);
  for(const p of b.files)check(p,physical.get(p.path));
  const fallbacks=[];for(const [p,bytes] of logical)if(p.startsWith(B)) {
    if(fs.existsSync(path.join(root,p)))eq(readFile(root,p,Math.max(1,bytes.length)),bytes,'Present local original exact '+p);else fallbacks.push(p);
  }
  eq(C.modules.map(p=>p.path),MODULES.map(publicModule),'Public current verifier set');
  for(let i=0;i<MODULES.length;i++)eq(check(C.modules[i],readPublic(C.modules[i].path,BOUNDS.maxFileBytes)),
    portable(check(b.modules[i],logical.get(b.modules[i].path))),'Reviewed current verifier module bytes');
  eq(C.images.map(p=>p.path),b.images.map(p=>p.publicPath),'Exactly four original representative images');
  for(const image of b.images)eq(check(C.images.find(p=>p.path===image.publicPath),readPublic(image.publicPath,BOUNDS.maxFileBytes)),
    check(image.source,logical.get(image.source.path)),'Representative remains original phase PNG');
  const facts=verifyLogical(logical,b,readCurrent);eq(C.facts,facts,'Re-derived product facts');
  eq(C.markdown.path,PREFIX+'.md','Fixed explanatory text path');
  check(C.markdown,readPublic(C.markdown.path,BOUNDS.maxFileBytes));
  return {accepted:true,facts,archive:{packets:C.packets.length,logicalFiles:logical.size,physicalPaths:physical.size,physicalBlobs:blobs},
    allOriginalWholeBytesVerified:true,localEvidenceFallbacks:fallbacks.sort(),archivedCodeExecuted:false,newBrowserRuns:0,newTests:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verify()));
