// Observe original-game captives and follow native surrender orders through settlement.
import assert from 'node:assert/strict';
import {readOriginalPersonIdentityRom} from './hd-person-identity-rom.mjs';
import {checkPersonIdentity, identityDomSnapshot, assertGeometry} from './hd-person-identity-runtime-checks.mjs';
import {createMobileDetailRuntimeDriver} from './hd-mobile-preview-runtime-checks.mjs';

function originalString(lib, id) {
  const base = lib.readUInt32LE(63 * 4), end = base + lib.readUInt32LE(base), index = id - 1;
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
const mapReady = 'baye.hd.menuItems().active===0&&baye.hd.march().pick===1&&!baye.hd.march().battlePick&&!BayeHdCityMenu.debugSnapshot().open';

function personReport(id, previousSeq) {
  return `(() => {
    const native=baye.hd.report(), dialog=BayeHdDialog.debugSnapshot();
    if(native.active!==1||native.kind!==2||native.person!==${id}||native.seq===${previousSeq}||
        !dialog.open||dialog.kind!=='report'||dialog.pass||dialog.reportOwner?.seq!==native.seq||
        dialog.reportOwner?.inputSeq!==native.inputSeq) return false;
    const line=document.getElementById('hd-dialog-person-identity');
    return {native, text:baye.hd.reportText(), title:document.getElementById('hd-dialog-title').textContent,
        body:document.getElementById('hd-dialog-body').textContent,
        identity:line&&!line.hidden&&{personId:Number(line.getAttribute('data-hd-report-person')),
            kind:line.getAttribute('data-hd-report-ownership'),text:line.textContent}};
  })()`;
}

function assertPersonReport(report, {personId, name, kind, owner, lines}) {
  const normalize = text => text.replace(/[\s|]/g, '');
  assert.equal(report.title, name);
  assert.ok(lines.some(line => normalize(line) === normalize(report.text)), 'The engine displays an original surrender line');
  assert.equal(normalize(report.body), normalize(report.text));
  assert.deepEqual(report.identity, {personId, kind, text:'当前归属 · ' + owner});
}

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
  const {report, evaluate, until, sample, key, checkpoint, readKeys, libBytes, cdp, loaded, mobile} = c;
  const lib = Buffer.from(libBytes), rawRom = readOriginalPersonIdentityRom(lib, 1), rom = {...rawRom,names:rawRom.names200};
  const proof = report.actualCaptives, baseline = await sample(), battle = report.battles?.at(-1);
  assert.ok(battle&&battle.expectedOutcome==='victory'&&battle.terminal.fight.over===1&&battle.plan.origin===15&&battle.plan.target===16,'A real completed native campaign precedes this inspection');
  assert.equal(report.battles.length,1);assert.equal(battle.terminal.fight.active,0);
  const expectedMarchPhase = loaded ? 0 : 7;
  assert.equal(baseline.native.march.phase,expectedMarchPhase);
  if (!loaded) {
    assert.equal(baseline.native.march.origin,15);assert.equal(baseline.native.march.obj,16);
    assert.equal(baseline.native.march.selected,battle.march.selected.length);assert.ok(baseline.native.march.session>0&&baseline.native.march.seq>0);
  }
  assert.deepEqual(baseline.world,loaded ? loaded.world : proof.sample.world);
  const identityContext={evaluate,until,readKeys,libBytes,expectedMarchPhase};
  assert.ok(proof && proof.cityIndex === 16 && proof.captives.length > 0);assert.equal(baseline.world.period,1);
  assert.equal(rom.names[baseline.world.king],'董卓');assert.equal(baseline.world.cities[16].Belong,baseline.world.king+1);
  const city = baseline.world.cities[16], queue = baseline.world.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons);
  const ids = queue.filter(id => baseline.world.people[id].Belong === 65535);
  assert.deepEqual(ids,proof.captives.map(p=>p.personId));assert.ok(ids.length > 0);
  function residents(world, belong) {
    const {PersonQueue, Persons, Belong} = world.cities[16];
    assert.equal(Belong, city.Belong, 'The captured city remains under the player');
    return world.queue.slice(PersonQueue, PersonQueue + Persons).filter(id => world.people[id].Belong === belong);
  }
  const entry = report.captiveInspection = {accepted:false,rom,baseline,captiveIds:ids,people:[],transitions:[],roleObservations:[],noCommandSubmission:!c.endMonth};
  const observeWorld = (value,label) => assert.deepEqual(value.world,baseline.world,label+' preserves the complete measured captured world');
  const evGeometry = selector => evaluate('('+geometry.toString()+')('+JSON.stringify(selector)+')');
  async function revealDesktop(selector,{control=false}={}) {
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
  let reveal = revealDesktop;
  if (mobile) {
    const scrollEntry = report.captiveMobileNavigation = {scrollChecks:[]};
    const mobileDriver = await createMobileDetailRuntimeDriver({report,evaluate,until,ready:sample,touches:mobile.touches,
      readKeys:async offset=>(await readKeys(offset)).map(code=>({code})),
      worldSame:(before,after,label)=>assert.deepEqual(after.world,before.world,label)},scrollEntry);
    reveal = async (selector,options={control:false}) => {
      scrollEntry.baseline = await sample();
      return mobileDriver.reveal(selector,options);
    };
  }
  async function click(selector) {
    if (mobile) await reveal(selector,{control:true});
    return c.click(selector);
  }
  const driver={sample,reveal,snap};
  async function focus(id) {
    const before=await sample(),m=before.state.menu,index=m.ids.indexOf(id);assert.ok(index>=0);
    if (mobile) {
      await click('#hd-city-menu [data-hd-deep-preview="'+index+'"]');
    } else {
      await reveal('#hd-city-menu [data-hd-deep="'+m.index+'"]');let current=m.index;
      while(current!==index){const next=current+(current<index?1:-1);await key(next>current?'ArrowDown':'ArrowUp');await until('captive native focus '+next,`(()=>{const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===3&&m.seq===${m.seq}&&m.index===${next};})()`);current=next;}
    }
    await until('complete captive first property',pageReady(id));const after=await sample(),keys=await readKeys(before.state.keyCount);
    assert.deepEqual(keys,Array(Math.abs(index-m.index)).fill(index>m.index?35:34));
    assert.deepEqual(after.world,before.world,'PERSON focus preserves the current world');
    return {before,after,keys};
  }
  async function location(visit,id) {
    const before=await sample(),from=firstCity(before.world,id),title=originalString(lib,25),name=rom.cityNames38[from.cityIndex];
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
  const cityRootReady = `(()=>{const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===1&&s.open&&s.layer==='root'&&s.cityIndex===16&&!s.entryPending&&!s.sending&&!s.queueLen;})()`;
  async function openCapturedCity() {
    if (mobile) {
      const before = await sample();
      assert.notEqual(await evaluate('BayeHdOverworld.centerOnCity(16)'),false);
      const point = await until('owned Xu Chang marker unobstructed on the mobile canvas',`(() => {
        const p=BayeHdOverworld.cityScreenPos(16),canvas=document.getElementById('hd-overworld-canvas');
        return p&&p.kind==='owned'&&document.elementFromPoint(p.clientX,p.clientY)===canvas&&{x:p.clientX,y:p.clientY};
      })()`);
      const centered = await sample();
      assert.deepEqual(centered.native,before.native);
      assert.deepEqual(centered.world,before.world);
      assert.deepEqual(await readKeys(before.state.keyCount),[]);
      await mobile.tap(point);
    } else {
      const opened = await evaluate('BayeHdOverworld.walkToCity(16)');
      report.inputs.push({type:'public-city-walk',cityIndex:16,result:opened});
      assert.ok(opened && opened.name === rom.cityNames38[16] && Number.isInteger(opened.to?.x) && Number.isInteger(opened.to?.y));
    }
    await until('real occupied city root', cityRootReady);
  }
  const mapBefore=await sample();await openCapturedCity();
  observeWorld(await sample(),'Opening captured city');entry.mapBefore=mapBefore;await snap('city-root');
  async function openDomestic() {
    const roots = await evaluate('baye.hd.menuItems()');
    const index = roots.names.indexOf('内政');
    assert.ok(index >= 0);
    await click('#hd-city-menu [data-hd-root="' + index + '"]');
    return until('native internal affairs submenu', `(() => {
      const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();
      return m.active===1&&m.context===1&&m.kind===2&&s.open&&s.layer==='sub'&&s.subKind==='neizheng'&&m;
    })()`);
  }
  async function chooseDomestic(sub, name) {
    const index = sub.names.indexOf(name);
    assert.ok(index >= 0);
    await click('#hd-city-menu [data-hd-sub="' + index + '"]');
    return until('native PERSON picker for ' + name, menuReady);
  }
  const sub = await openDomestic();
  const rule = c.endMonth && await evaluate('BayeHdCityRules.read(16,"neizheng")?.rows.find(row=>row.command===6)');
  if (c.endMonth) assert.ok(rule && Number.isInteger(rule.thew) && Number.isInteger(rule.money));
  const targetMenu = await chooseDomestic(sub, '招降');
  assert.deepEqual(targetMenu.ids,ids);entry.targetMenu=targetMenu;await snap('target-before');
  async function roleObservation(role, targetId = null) {
    const value = await evaluate(`(() => {
      const n=document.querySelector('#hd-city-menu [data-hd-surrender-role]');
      return {expectedRole:${JSON.stringify(role)}, text:n?.textContent, role:n?.getAttribute('data-hd-surrender-role'),
        subtitle:document.getElementById('hd-city-menu-sub')?.textContent,
        target:BayeHdCityMenu.debugSnapshot().surrenderPresentation?.target};
    })()`);
    assert.equal(value.role, role);
    assert.ok(value.text.includes(role === 'target' ? '选择俘虏' : '选择招降将领'));
    const target = targetId === null ? null : {personIndex:targetId,name:rom.names[targetId]};
    assert.deepEqual(value.target, target);
    if (target) {
      assert.ok(value.subtitle.includes('目标 ' + target.name));
      assert.equal((await evGeometry('#hd-city-menu-sub')).visible,true,'The target subtitle fits its visible panel');
    }
    else assert.ok(!value.subtitle.includes('目标 '));
    entry.roleObservations.push(value);
    return value;
  }
  await roleObservation('target');
  for(const id of ids){const visit={personId:id,selection:await focus(id)};entry.people.push(visit);assert.equal((await sample()).world.people[id].Belong,65535);await checkPersonIdentity(identityContext,driver,visit,id,rom);await location(visit,id);}
  const orderTarget = mobile || c.untilJoined ? ids.reduce((a,b)=>baseline.world.people[a].Devotion<=baseline.world.people[b].Devotion?a:b) : ids.at(-1);
  const inspectedTarget = mobile ? ids.find(id=>id!==orderTarget) ?? orderTarget : ids[0];
  await focus(inspectedTarget);const targetBefore=await sample();await click('#hd-city-menu [data-hd-deep="'+targetBefore.state.menu.index+'"]');
  const actorMenu=await until('native SURRENDER allied actor PERSON',`(()=>{const m=${menuReady};return m&&m.seq!==${targetMenu.seq}&&m;})()`);
  const actorBefore=await sample(),allied=queue.filter(id=>baseline.world.people[id].Belong===city.Belong);assert.deepEqual(actorMenu.ids,allied);assert.deepEqual(await readKeys(targetBefore.state.keyCount),[39]);observeWorld(actorBefore,'Choosing captive target');entry.transitions.push({kind:'target-to-actor',before:targetBefore,after:actorBefore,keys:await readKeys(targetBefore.state.keyCount)});await roleObservation('actor',inspectedTarget);await snap('actor-before-cancel');
  const actorId=actorMenu.ids[actorMenu.index];await until('actual actor first page',pageReady(actorId));const actorVisit={personId:actorId,role:'actor'};entry.actor=actorVisit;await checkPersonIdentity(identityContext,driver,actorVisit,actorId,rom);
  const cancelBefore=await sample();await click('#hd-city-menu [data-hd-menu-back]');
  const returned=await until('actor EXIT returns to fresh captive PERSON with HD pane retained',`(()=>{const m=${menuReady};return m&&m.seq!==${actorMenu.seq}&&m;})()`);
  assert.deepEqual(returned.ids,ids);const cancelAfter=await sample(),cancelKeys=await readKeys(cancelBefore.state.keyCount);assert.deepEqual(cancelKeys,[40]);observeWorld(cancelAfter,'Actor cancellation');entry.transitions.push({kind:'actor-cancel-target',before:cancelBefore,after:cancelAfter,keys:cancelKeys});await roleObservation('target');await snap('target-after-actor-cancel');
  async function leavePicker(expectedWorld, label) {
    const before = await sample();
    await click('#hd-city-menu [data-hd-menu-back]');
    await until(label + ' returns to the native map', mapReady);
    const after = await sample(), keys = await readKeys(before.state.keyCount);
    assert.deepEqual(keys, [40]);
    assert.deepEqual(after.world, expectedWorld, 'Leaving a picker preserves the current world');
    return {before, after, keys};
  }

  const lordName = rom.names[city.Belong - 1];
  async function queueSurrender(targetId, label) {
    const selection = await focus(targetId);
    const targetMenu = selection.after.state.menu;
    await click('#hd-city-menu [data-hd-deep="' + targetMenu.index + '"]');
    const actors = await until('fresh actors for the current captive', `(() => {const m=${menuReady};return m&&m.seq!==${targetMenu.seq}&&m;})()`);
    assert.deepEqual(actors.ids, residents(selection.after.world, city.Belong));
    assert.deepEqual(await readKeys(selection.after.state.keyCount), [39]);
    await roleObservation('actor', targetId);
    const people = selection.after.world.people;
    const actorId = actors.ids.filter(id => people[id].Thew >= rule.checkThew)
      .sort((a,b) => people[b].IQ - people[a].IQ)[0];
    assert.ok(Number.isInteger(actorId), 'An actual allied resident has the required stamina');
    const {after: before} = await focus(actorId);
    await snap(label + 'actor-confirm');
    const order = {targetId, actorId, rule, before};
    if (!c.untilJoined) report.captiveOrder = order;
    await click('#hd-city-menu [data-hd-deep="'+before.state.menu.index+'"]');
    order.submission = await until('native actor report for the queued surrender order', personReport(actorId, before.native.report.seq));
    const isLord = actorId === city.Belong - 1;
    assertPersonReport(order.submission, {personId:actorId, name:rom.names[actorId], kind:isLord ? 'lord' : 'owned',
      owner:isLord ? '君主 · ' + lordName : lordName, lines:[originalString(lib,162)]});
    const queued = order.queued = await sample();
    assert.deepEqual(await readKeys(before.state.keyCount), [39]);
    const slot = order.slot = before.world.orders.findIndex(item => item.OrderId === 255);
    assert.ok(slot >= 0);
    const {OrderId, City, Person, Object: target, TimeCount} = queued.world.orders[slot];
    assert.deepEqual({OrderId, City, Person, target, TimeCount}, {OrderId:6, City:16, Person:actorId, target:targetId, TimeCount:0});
    assert.deepEqual(queued.world.orders.filter((_,i) => i !== slot), before.world.orders.filter((_,i) => i !== slot));
    assert.equal(queued.world.cities[16].Money, before.world.cities[16].Money - rule.money);
    assert.deepEqual(queued.world.people[actorId], {...before.world.people[actorId], Thew:before.world.people[actorId].Thew - rule.thew});
    assert.deepEqual(queued.world.people[targetId], before.world.people[targetId]);
    assert.equal(firstCity(queued.world, actorId).cityIndex, 255);
    assert.equal(firstCity(queued.world, targetId).cityIndex, 16);
    await snap(label + 'queued-native-report');
    await click('#hd-dialog [data-hd-dlg-ok]');
    const nextTarget = await until('new captive list after the queued order report', `(() => {const m=${menuReady};return m&&m.seq!==${before.state.menu.seq}&&m;})()`);
    assert.deepEqual(nextTarget.ids, targetMenu.ids);
    assert.deepEqual(await readKeys(queued.state.keyCount), [39]);
    await roleObservation('target');
    return order;
  }

  async function checkOrderPlans(orders, label) {
    await openCapturedCity();
    await click('#hd-city-menu [data-hd-root="3"]');
    for (const order of orders) {
      const {actorId, targetId, slot} = order;
      const plan = '#hd-city-menu-status [data-hd-city-order="'+slot+'"][data-hd-city-order-id="6"]';
      order.plan = await until('HD city status displays the exact queued surrender order', `document.querySelector(${JSON.stringify(plan)})?.textContent`);
      for (const text of ['招降', rom.names[actorId], rom.names[targetId]]) assert.ok(order.plan.includes(text));
      await reveal(plan);
      await snap(label + 'queued-city-plan-' + slot);
    }
    const beforeBack = await sample();
    await click('#hd-city-menu [data-hd-menu-back]');
    await until('root after the local city status view', cityRootReady);
    await click('#hd-city-menu [data-hd-menu-back]');
    await until('map before resolving surrender order', mapReady);
    assert.deepEqual(await readKeys(beforeBack.state.keyCount), [40]);
  }

  async function settleSurrender(orders, label) {
    const beforeMonth = await sample();
    assert.deepEqual(beforeMonth.world, orders.at(-1).queued.world);
    const targetId = orders[0].targetId;
    let previousReport = beforeMonth.native.report.seq;
    let devotion = beforeMonth.world.people[targetId].Devotion;
    let joined = null;
    await c.endMonth('captive-' + label + 'order-end-month');
    for (const order of orders) {
      // The original executor visits order slots in order and returns later
      // recruiters silently if a preceding order already won the captive.
      if (joined) { order.outcome = 'already-joined'; continue; }
      order.result = await c.untilProgress('actual month-end report from the selected captive', personReport(targetId, previousReport));
      const result = order.reportWorld = await sample();
      assert.deepEqual(result.native.report, order.result.native);
      assert.equal(firstCity(result.world, order.actorId).cityIndex, 255);
      const {Belong, Devotion} = result.world.people[targetId];
      assert.ok(Belong === 65535 || Belong === city.Belong, 'The original engine decided the captive outcome');
      if (Belong === city.Belong) {
        assert.ok(devotion <= 60 && Devotion >= 40 && Devotion <= 79, 'Native successful surrender updates allegiance and devotion');
        joined = order;
      } else {
        assert.ok(Devotion === devotion || Devotion === devotion - Math.floor(devotion / 10));
      }
      order.devotion = {before:devotion, after:Devotion};
      order.outcome = joined ? 'joined' : 'refused';
      assertPersonReport(order.result, {personId:targetId, name:rom.names[targetId],
        kind:joined ? 'owned' : 'captive', owner:joined ? lordName : '俘虏',
        lines:(joined ? [95] : [122,123,124]).map(id => originalString(lib,id))});
      order.reportGeometry = await until('the current allegiance fully visible on the current report', `(() => {
        const r=baye.hd.report(), g=(${geometry.toString()})('#hd-dialog-person-identity');
        return r.active===1&&r.seq===${order.result.native.seq}&&r.inputSeq===${order.result.native.inputSeq}&&g?.visible&&g;
      })()`);
      await snap(label + 'month-result-' + order.outcome + '-' + order.slot);
      await click('#hd-dialog [data-hd-dlg-ok]');
      assert.deepEqual(await readKeys(result.state.keyCount), [39]);
      devotion = Devotion;
      previousReport = order.result.native.seq;
    }
    await c.settleToMap('captive-' + label + 'order-next-map');
    const settled = await sample();
    assert.equal(settled.world.year * 12 + settled.world.month, beforeMonth.world.year * 12 + beforeMonth.world.month + 1);
    for (const {actorId, slot} of orders) {
      assert.equal(settled.world.orders[slot].OrderId, 255);
      assert.equal(firstCity(settled.world, actorId).cityIndex, 16);
    }
    assert.equal(settled.world.people[targetId].Belong, joined ? city.Belong : 65535);
    assert.equal(firstCity(settled.world, targetId).cityIndex, 16);
    await snap(label + 'month-settled');
    return {beforeMonth, settled, joined};
  }

  async function verifyJoinedRoster(targetId, settled) {
    const remaining = residents(settled.world, 65535);
    if (remaining.length) {
      await openCapturedCity();
      const captives = await chooseDomestic(await openDomestic(), '招降');
      assert.deepEqual(captives.ids, remaining);
      assert.ok(!captives.ids.includes(targetId));
      await snap('captives-after-joining');
      await leavePicker(settled.world, 'Reopened captive list');
    }
    await openCapturedCity();
    const roster = await chooseDomestic(await openDomestic(), '搜寻');
    assert.deepEqual(roster.ids, residents(settled.world, city.Belong));
    const selection = await focus(targetId);
    const visit = {personId:targetId, selection};
    const identity = await checkPersonIdentity({...identityContext, expectedMarchPhase:selection.after.native.march.phase},driver,visit,targetId,rom);
    assert.ok(identity.observations.find(item => item.kind === 'listName').dom.list.summary,
      'The newly allied general also has the current stats summary in the ordinary list');
    await leavePicker(settled.world, 'Allied roster');
    return {remaining, roster, visit};
  }

  let orderCount = 0, finalMap;
  if (c.endMonth) {
    const maxMonths = c.untilJoined ? 8 : 1;
    const joinCheck = c.untilJoined && (report.captiveJoin = {targetId:orderTarget, maxMonths, rounds:[], accepted:false});
    for (let month = 1; month <= maxMonths; month++) {
      const label = joinCheck ? 'month-' + month + '-' : '';
      if (month > 1) {
        const current = await sample();
        await openCapturedCity();
        const captives = await chooseDomestic(await openDomestic(), '招降');
        assert.deepEqual(captives.ids, residents(current.world, 65535));
        await roleObservation('target');
      }
      const current = await sample();
      const allies = residents(current.world, city.Belong);
      const available = allies.filter(id => current.world.people[id].Thew >= rule.checkThew);
      const count = joinCheck && allies.length > 2 && available.length > 1 ? 2 : 1;
      const orders = [];
      const round = {orders};
      if (joinCheck) joinCheck.rounds.push(round);
      for (let i = 0; i < count; i++) {
        orders.push(await queueSurrender(orderTarget, joinCheck ? label + 'order-' + (i + 1) + '-' : ''));
        orderCount++;
      }
      const exit = await leavePicker(orders.at(-1).queued.world, 'Captive list');
      if (month === 1) entry.transitions.push({kind:'target-cancel-map',...exit});
      await snap(label + 'returned-map');
      await checkOrderPlans(orders, label);
      const {beforeMonth, settled, joined} = await settleSurrender(orders, label);
      finalMap = settled;
      if (!joinCheck) {
        orders[0].settled = settled;
      } else {
        round.date = [beforeMonth.world.year, beforeMonth.world.month];
        round.settled = settled;
        if (joined) {
          joinCheck.roster = await verifyJoinedRoster(orderTarget, settled);
          joinCheck.accepted = true;
          finalMap = await sample();
          break;
        }
      }
    }
    if (joinCheck) assert.ok(joinCheck.accepted, 'The original engine must produce a verified successful surrender within the bounded campaign');
    report.captiveOrderAccepted = true;
  } else {
    const exit = await leavePicker(baseline.world, 'Captive list');
    entry.transitions.push({kind:'target-cancel-map',...exit});
    finalMap = exit.after;
    await snap('returned-map');
  }
  entry.final=finalMap;entry.accepted=true;report.personCaptivesAccepted=true;report.captiveAccepted=true;report.identityAccepted=true;report.accepted=true;report.hdAccepted=true;
  report.captiveSummary={captives:ids.length,identityVisits:ids.length+1,identityObservations:(ids.length+1)*5,locationObservations:ids.length*2,locationPageKeys:ids.flatMap(()=>[37,36]),targetConfirmations:orderCount+1,actorConfirmations:orderCount,actualSurrenderOrders:orderCount,worldUnchangedDuringInspection:true,returnedToMap:true};
}
