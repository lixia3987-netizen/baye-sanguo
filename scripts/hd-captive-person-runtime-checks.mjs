// Genuine original-game captives: observe PERSON data, then cancel SURRENDER before an actor is submitted.
import assert from 'node:assert/strict';
import {readOriginalPersonIdentityRom} from './hd-person-identity-rom.mjs';
import {checkPersonIdentity, identityDomSnapshot, assertGeometry} from './hd-person-identity-runtime-checks.mjs';

function locationTitle(lib) {
  const base = lib.readUInt32LE(63 * 4), end = base + lib.readUInt32LE(base), index = 24;
  assert.equal(lib.readUInt16LE(base + 4), 64);assert.ok(index < lib.readUInt16LE(base + 6) && end <= lib.length);
  const fixed = lib.readUInt32LE(base + 8), row = base + 14 + index * 8;
  const start = fixed ? base + 14 + index * fixed : base + lib.readUInt32LE(row), length = fixed || lib.readUInt32LE(row + 4);
  assert.ok(start >= base + 14 && length > 0 && start + length <= end);
  const raw = lib.subarray(start, start + length), zero = raw.indexOf(0);
  return new TextDecoder('gbk', {fatal: true}).decode(zero < 0 ? raw : raw.subarray(0, zero));
}

function firstCity(world, id) {
  assert.equal(world.cities.length, 38);assert.equal(world.queue.length, 2000);
  for (let cityIndex = 0; cityIndex < 38; cityIndex++) {
    const c = world.cities[cityIndex];
    assert.ok(Number.isInteger(c.PersonQueue) && Number.isInteger(c.Persons) && c.PersonQueue >= 0 && c.Persons >= 0 && c.PersonQueue + c.Persons <= 2000);
    for (let i = 0; i < c.Persons; i++) if (world.queue[c.PersonQueue + i] === id) return {cityIndex, queueStart: c.PersonQueue, queueCount: c.Persons, queueOffset: c.PersonQueue + i};
  }
  return {cityIndex: 255};
}

const pageReady = id => `(() => {const m=baye.hd.menuItems(),p=baye.hd.personProperties(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids[m.index]===${id}&&p.active===1&&p.person===${id}&&p.pageIndex===0&&p.pageComplete===1&&p.menuSeq===m.seq&&p.generation===m.detailGeneration&&s.open&&s.layer==='deep'&&!s.sending&&!s.queueLen&&!s.personPagePending&&s.personDetail?.personIndex===${id}&&s.personDetail.corePresentation==='default';})()`;
const menuReady = `(function(){const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids.length===m.count&&m.count>0&&s.open&&s.layer==='deep'&&!s.sending&&!s.queueLen&&!s.personPagePending&&s.deepMenuOwner?.seq===m.seq&&m;})()`;

// All scrolling is a trusted wheel on the actual clipping ancestor; no scrollTop writes.
function geometry(selector) {
  const n = document.querySelector(selector);if (!n) return null;
  const box = r => ({left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height});
  const r = n.getBoundingClientRect(), clip = {left:0, top:0, right:innerWidth, bottom:innerHeight};
  let shown = true, scroll = null;
  for (let p = n; p; p = p.parentElement) {
    const css = getComputedStyle(p);if (p.hidden || css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse' || Number(css.opacity) === 0) shown = false;
    if (p !== n && p !== document.body && p !== document.documentElement && /(auto|scroll|hidden|clip)/.test(css.overflowX + css.overflowY)) {
      const b = p.getBoundingClientRect();clip.left = Math.max(clip.left,b.left);clip.right = Math.min(clip.right,b.right);clip.top = Math.max(clip.top,b.top);clip.bottom = Math.min(clip.bottom,b.bottom);
      if (!scroll && /(auto|scroll)/.test(css.overflowY) && p.scrollHeight > p.clientHeight + 1) scroll = box(b);
    }
  }
  const visible = shown && r.width > 0 && r.height > 0 && r.left >= clip.left - .5 && r.right <= clip.right + .5 && r.top >= clip.top - .5 && r.bottom <= clip.bottom + .5;
  const x = Math.max(clip.left,Math.min(clip.right,r.left+r.width/2)), y = Math.max(clip.top,Math.min(clip.bottom,r.top+r.height/2)), h = document.elementFromPoint(x,y);
  return {shown,visible,hit:!!h&&(h===n||n.contains(h)),disabled:!!n.disabled,rect:box(r),clip,scroll,viewport:{width:innerWidth,height:innerHeight}};
}

export async function runCaptiveInspection(c) {
  const {report, evaluate, until, sample, click, key, checkpoint, readKeys, libBytes, cdp} = c;
  const lib = Buffer.from(libBytes), rawRom = readOriginalPersonIdentityRom(lib, 1), rom = {...rawRom,names:rawRom.names200};
  const proof = report.actualCaptives, baseline = await sample(), battle = report.battles?.at(-1);
  assert.ok(battle&&battle.expectedOutcome==='victory'&&battle.terminal.fight.over===1&&battle.plan.origin===15&&battle.plan.target===16,'A real completed native campaign precedes this inspection');
  assert.equal(report.battles.length,1);assert.equal(battle.terminal.fight.active,0);
  assert.equal(baseline.native.march.phase,7,'The real original completed march remains DEPARTED; never normalize the observed state');
  assert.equal(baseline.native.march.origin,15);assert.equal(baseline.native.march.obj,16);
  assert.equal(baseline.native.march.selected,battle.march.selected.length);assert.ok(baseline.native.march.session>0&&baseline.native.march.seq>0);
  assert.deepEqual(baseline.world,proof.sample.world);
  const identityContext={evaluate,until,readKeys,libBytes,expectedMarchPhase:7};
  assert.ok(proof && proof.cityIndex === 16 && proof.captives.length > 0);assert.equal(baseline.world.period,1);
  assert.equal(rom.names[baseline.world.king],'董卓');assert.equal(baseline.world.cities[16].Belong,baseline.world.king+1);
  const city = baseline.world.cities[16], queue = baseline.world.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons);
  const ids = queue.filter(id => baseline.world.people[id].Belong === 65535);
  assert.deepEqual(ids,proof.captives.map(p=>p.personId));assert.ok(ids.length > 0);
  const entry = report.captiveInspection = {accepted:false,rom,baseline,captiveIds:ids,people:[],transitions:[],roleObservations:[],noCommandSubmission:true};
  const observeWorld = (value,label) => assert.deepEqual(value.world,baseline.world,label+' preserves the complete measured captured world');
  const evGeometry = selector => evaluate('('+geometry.toString()+')('+JSON.stringify(selector)+')');
  async function reveal(selector,{control=false}={}) {
    for (let n=0;n<40;n++) {
      const g=await evGeometry(selector);assert.ok(g?.shown,'Displayed captive control '+selector);
      if(g.visible&&g.hit){if(control)assert.equal(g.disabled,false);return g;}
      assert.ok(g.scroll,'A real scroll container reveals '+selector);
      const s=g.scroll,x=(Math.max(s.left,g.clip.left)+Math.min(s.right,g.clip.right))/2,y=(Math.max(0,s.top)+Math.min(g.viewport.height,s.bottom))/2;
      const deltaY=g.rect.top<g.clip.top?-Math.min(260,g.clip.top-g.rect.top+40):Math.min(260,g.rect.bottom-g.clip.bottom+40);
      assert.ok(deltaY!==0);await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY});report.inputs.push({type:'captive-trusted-wheel',selector,x,y,deltaY});
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('Bounded captive wheel did not reveal '+selector);
  }
  const snap=label=>checkpoint('captive-'+label);
  const driver={sample,reveal,snap};
  async function focus(id) {
    const before=await sample(),m=before.state.menu,index=m.ids.indexOf(id);assert.ok(index>=0);
    await reveal('#hd-city-menu [data-hd-deep="'+m.index+'"]');let current=m.index;
    while(current!==index){const next=current+(current<index?1:-1);await key(next>current?'ArrowDown':'ArrowUp');await until('captive native focus '+next,`(()=>{const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===3&&m.seq===${m.seq}&&m.index===${next};})()`);current=next;}
    await until('complete captive first property',pageReady(id));const after=await sample(),keys=await readKeys(before.state.keyCount);
    assert.deepEqual(keys,Array(Math.abs(index-m.index)).fill(index>m.index?35:34));observeWorld(after,'PERSON focus');
    return {before,after,keys};
  }
  async function location(visit,id) {
    const before=await sample(),from=firstCity(before.world,id),title=locationTitle(lib),name=rom.cityNames38[from.cityIndex];
    assert.equal(title,' 所在城市 ');assert.ok(name);assert.equal(from.cityIndex,16,'A real captured person is first found in the occupied native city queue');
    const location=visit.location={accepted:false,before,expected:{...from,name,nativeTitle:title},observations:[],pages:[]};
    const verify=s=>{const m=s.state.menu;assert.deepEqual(s.state.cityUi.personDetail?.location,{personIndex:id,...from,name,source:'native-city-queue-first-match',libraryGeneration:s.identity.generation,detailGeneration:m.detailGeneration,menuSeq:m.seq,nativeIndex:m.index});};
    async function capture(kind,selector,label) {
      const a=await sample();verify(a);const observation={kind,selector,before:a};location.observations.push(observation);
      observation.reveal=await reveal(selector);observation.dom=await evaluate('('+identityDomSnapshot.toString()+')('+JSON.stringify(selector)+','+JSON.stringify(kind)+')');
      const dom=observation.dom;assert.ok(dom&&!dom.missing);assert.deepEqual(dom.before,dom.after);assert.deepEqual(dom.before.menu,a.state.menu);assert.deepEqual(dom.before.detail,a.state.cityUi.personDetail);
      assertGeometry(dom.label,label,kind+' title');assertGeometry(dom.value,name,kind+' city');
      assert.ok(Math.min(dom.label.bounds.right,dom.value.bounds.right)-Math.max(dom.label.bounds.left,dom.value.bounds.left)<=1||Math.min(dom.label.bounds.bottom,dom.value.bounds.bottom)-Math.max(dom.label.bounds.top,dom.value.bounds.top)<=1);
      if(kind==='nativeLocation'){const p=a.native.person,f=p.properties[1];assert.ok(f.captured&&f.titleCaptured&&f.valueCaptured);assert.equal(f.title,title);assert.equal(f.value,name);assert.equal(f.titlePaintSeq,p.paintSeq);assert.equal(f.valuePaintSeq,p.paintSeq);assert.equal(dom.current,'1');assert.equal(dom.field,'1');}
      observation.screenshot=await snap('location-'+id+'-'+kind);const b=observation.after=await sample();verify(b);assert.deepEqual(b.native,a.native);assert.deepEqual(b.world,a.world);assert.equal(b.state.touchCount,a.state.touchCount);assert.deepEqual(await readKeys(a.state.keyCount),[]);observeWorld(b,'Location observation');observation.accepted=true;
    }
    verify(before);await capture('hdLocation','#hd-city-menu-person-fields [data-hd-person-location="1"]','所在城市');
    for(const [direction,pageIndex,code]of[['next',1,37],['prev',0,36]]){
      const a=await sample();await click('#hd-city-menu-person-properties-controls [data-hd-person-page="'+direction+'"]');
      await until('actual captive native page '+pageIndex,`(()=>{const m=baye.hd.menuItems(),p=baye.hd.personProperties(),s=BayeHdCityMenu.debugSnapshot();return m.seq===${a.state.menu.seq}&&m.ids[m.index]===${id}&&p.person===${id}&&p.pageIndex===${pageIndex}&&p.pageComplete===1&&p.paintSeq!==${a.native.person.paintSeq}&&!s.sending&&!s.queueLen&&!s.personPagePending&&s.personProperties?.paintSeq===p.paintSeq;})()`);
      const b=await sample(),keys=await readKeys(a.state.keyCount);assert.deepEqual(keys,[code]);assert.deepEqual(b.world,a.world);assert.equal(b.state.touchCount,a.state.touchCount);assert.deepEqual(b.state.menu,a.state.menu);
      const {person:beforePerson,...beforeNative}=a.native,{person:afterPerson,...afterNative}=b.native;assert.ok(beforePerson&&afterPerson);assert.deepEqual(afterNative,beforeNative,'Only the native PERSON page may change during one location page key');
      verify(b);location.pages.push({direction,before:a,after:b,keys});
      if(pageIndex===1)await capture('nativeLocation','#hd-city-menu-person-properties-fields [data-hd-person-property="1"]',title);
    }
    location.after=await sample();observeWorld(location.after,'Location page round trip');location.accepted=true;
  }
  const mapBefore=await sample();const opened=await evaluate('BayeHdOverworld.walkToCity(16)');report.inputs.push({type:'public-city-walk',cityIndex:16,result:opened});assert.ok(opened&&typeof opened==='object'&&opened.name===rom.cityNames38[16]&&Number.isInteger(opened.to?.x)&&Number.isInteger(opened.to?.y),'The public city walk returns its actual name and native destination');
  await until('real occupied city root',`(()=>{const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===1&&s.open&&s.layer==='root'&&s.cityIndex===16&&!s.entryPending&&!s.sending&&!s.queueLen;})()`);
  observeWorld(await sample(),'Opening captured city');entry.mapBefore=mapBefore;await snap('city-root');
  const roots=await evaluate('baye.hd.menuItems()'),rootIndex=roots.names.indexOf('内政');assert.ok(rootIndex>=0);await click('#hd-city-menu [data-hd-root="'+rootIndex+'"]');
  await until('native internal affairs submenu','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2');
  const sub=await evaluate('baye.hd.menuItems()'),subIndex=sub.names.indexOf('招降');assert.ok(subIndex>=0);await click('#hd-city-menu [data-hd-sub="'+subIndex+'"]');
  const targetMenu=await until('actual SURRENDER captive PERSON',menuReady);assert.deepEqual(targetMenu.ids,ids);entry.targetMenu=targetMenu;await snap('target-before');
  async function roleObservation(role) {
    const value=await evaluate(`(()=>{const n=document.querySelector('#hd-city-menu [data-hd-surrender-role]');return{expectedRole:${JSON.stringify(role)},text:n?.textContent??null,role:n?.getAttribute('data-hd-surrender-role')??null,subtitle:document.getElementById('hd-city-menu-sub')?.textContent??null};})()`);entry.roleObservations.push(value);return value;
  }
  await roleObservation('target');
  for(const id of ids){const visit={personId:id,selection:await focus(id)};entry.people.push(visit);assert.equal((await sample()).world.people[id].Belong,65535);await checkPersonIdentity(identityContext,driver,visit,id,rom);await location(visit,id);}
  await focus(ids[0]);const targetBefore=await sample();await click('#hd-city-menu [data-hd-deep="'+targetBefore.state.menu.index+'"]');
  const actorMenu=await until('native SURRENDER allied actor PERSON',`(()=>{const m=${menuReady};return m&&m.seq!==${targetMenu.seq}&&m;})()`);
  const actorBefore=await sample(),allied=queue.filter(id=>baseline.world.people[id].Belong===city.Belong);assert.deepEqual(actorMenu.ids,allied);assert.deepEqual(await readKeys(targetBefore.state.keyCount),[39]);observeWorld(actorBefore,'Choosing captive target');entry.transitions.push({kind:'target-to-actor',before:targetBefore,after:actorBefore,keys:await readKeys(targetBefore.state.keyCount)});await roleObservation('actor');await snap('actor-before-cancel');
  const actorId=actorMenu.ids[actorMenu.index];await until('actual actor first page',pageReady(actorId));const actorVisit={personId:actorId,role:'actor'};entry.actor=actorVisit;await checkPersonIdentity(identityContext,driver,actorVisit,actorId,rom);
  const cancelBefore=await sample();await click('#hd-city-menu [data-hd-menu-back]');
  const returned=await until('actor EXIT returns to fresh captive PERSON with HD pane retained',`(()=>{const m=${menuReady};return m&&m.seq!==${actorMenu.seq}&&m;})()`);
  assert.deepEqual(returned.ids,ids);const cancelAfter=await sample(),cancelKeys=await readKeys(cancelBefore.state.keyCount);assert.deepEqual(cancelKeys,[40]);observeWorld(cancelAfter,'Actor cancellation');entry.transitions.push({kind:'actor-cancel-target',before:cancelBefore,after:cancelAfter,keys:cancelKeys});await roleObservation('target');await snap('target-after-actor-cancel');
  const exitBefore=await sample();await click('#hd-city-menu [data-hd-menu-back]');
  await until('captive EXIT returns to actual MAP','baye.hd.menuItems().active===0&&baye.hd.march().pick===1&&!baye.hd.march().battlePick&&!BayeHdCityMenu.debugSnapshot().open');
  const exitAfter=await sample(),exitKeys=await readKeys(exitBefore.state.keyCount);assert.deepEqual(exitKeys,[40]);observeWorld(exitAfter,'Target cancellation');entry.transitions.push({kind:'target-cancel-map',before:exitBefore,after:exitAfter,keys:exitKeys});await snap('returned-map');
  for(const r of entry.roleObservations){assert.equal(r.role,r.expectedRole,'SURRENDER distinctly labels the current native PERSON role');assert.ok(r.text.includes(r.expectedRole==='target'?'选择俘虏':'选择招降将领'));}
  entry.final=exitAfter;entry.accepted=true;report.personCaptivesAccepted=true;report.captiveAccepted=true;report.identityAccepted=true;report.accepted=true;report.hdAccepted=true;
  report.captiveSummary={captives:ids.length,identityVisits:ids.length+1,identityObservations:(ids.length+1)*5,locationObservations:ids.length*2,locationPageKeys:ids.flatMap(()=>[37,36]),targetConfirmations:1,actorConfirmations:0,actualSurrenderOrders:0,worldUnchangedDuringInspection:true,returnedToMap:true};
}
