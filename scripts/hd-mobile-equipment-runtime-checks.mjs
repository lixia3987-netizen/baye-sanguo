// Original equipment transactions, driven only through visible trusted controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMobileDetailRuntimeDriver} from './hd-mobile-preview-runtime-checks.mjs';
import {verifyMobileConfiscation,verifyMobileReward} from './hd-mobile-equipment-runtime-oracle.mjs';

const next=n=>(n+1)>>>0||1,following=n=>next(next(n));
const messages={empty:'城中无道具',full:'该将道具已满'};

export async function runMobileEquipmentChecks(ctx){
  const {report,evaluate,until,delay,checkpoint,ready,root,submenu,revealSubmenu,back,mapReturn,
    controlPoint,touchButton,tap,readKeys,navigation,worldSame,testCity,mark,label}=ctx;
  const entry={label,cityIndex:testCity.index,checks:[],scrollChecks:[],operations:[],cancellations:[],reports:[],accepted:false};
  report.equipmentChecks.push(entry);entry.baseline=await mark();let expectedWorld=entry.baseline.world;
  const driver=await createMobileDetailRuntimeDriver({...ctx,checkWorld:s=>assert.deepEqual(s.world,expectedWorld,'Every uncommitted equipment action preserves the current complete recorded world')},entry);
  const {sample,reveal,preview,allPages,snap,attributes}=driver;
  const libBytes=fs.readFileSync(new URL('../libs/dat-mod.lib',import.meta.url));
  const inventory=world=>{const c=world.cities[testCity.index];return world.goodsQueue.slice(c.ToolQueue,c.ToolQueue+c.Tools).filter(v=>v&0x8000).map(v=>v&0x7fff);};
  const people=world=>{const c=world.cities[testCity.index];return world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>world.people[id].Belong===c.Belong);};
  const owned=async(kind,oldSeq,equippedPerson)=>{
    await until('complete current equipment HD owner kind '+kind,`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner;
      if(m.active!==1||m.context!==1||m.kind!==${kind}||m.seq!==${following(oldSeq)}||baye.hd.report().active||s.sending||s.queueLen||!s.open||s.cityIndex!==${testCity.index})return false;
      if(${kind}===2)return s.layer==='sub'&&s.subKind==='neizheng'&&!s.deepKind&&m.names.length===m.count;
      return s.layer==='deep'&&m.idsValid&&m.ids.length===m.count&&o&&o.seq===m.seq&&o.kind===m.kind&&o.context===1&&o.detailGeneration===m.detailGeneration&&
        s.deepItems.length===m.ids.length&&m.ids.every((id,i)=>{const row=s.deepItems.find(v=>v.i===i);return row&&row[${JSON.stringify(kind===3?'pind':'toolIndex')}]===id;});})()`);
    const reached=await ready();assert.equal(reached.state.menu.generation,reached.state.menu.detailGeneration);
    if(kind===3)assert.deepEqual(reached.state.menu.ids,people(reached.world));
    if(kind===4){
      const p=Number.isInteger(equippedPerson)?reached.world.people[equippedPerson]:null;
      assert.deepEqual(reached.state.menu.ids,p?[p.Tool1,p.Tool2].filter(Boolean).map(v=>v-1):inventory(reached.world),p?'Actual equipped tools in native slot order':'Actual discovered city inventory');
    }
    return reached;
  };
  const ownedMap=async before=>{
    await until('actual equipment command returns its current native map',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),r=baye.hd.report(),h=BayeHdMobile.refresh(),a=BayeHdMobileMap.refresh(),map=BayeHdOverworld.debugSnapshot();
      return m.active===0&&m.context===0&&m.kind===0&&m.seq===${next(before.state.menu.seq)}&&r.active===0&&
        Number(baye.data.g_hdMapPick)===1&&Number(baye.data.g_hdMapCity)===${testCity.index+1}&&Number(baye.data.g_hdMapInputSeq)===${next(before.state.march.mapInputSeq)}&&
        !s.open&&!s.sending&&!s.queueLen&&h.visible&&a.active&&map.presentationReady&&map.mode==='hd-map';})()`);
    return ready();
  };
  const select=async(kind,id,why)=>{
    const before=await sample(),m=before.state.menu,index=m.ids.indexOf(id);assert.ok(m.kind===kind&&m.idsValid&&index>=0,why+' is an actual current native item');
    const selector=`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-${kind===3?'pind':'tool'}="${id}"]`;
    const geometry=await reveal(selector);await touchButton(selector);return {why,kind,id,index,before,geometry,selector};
  };
  const selectedKeys=async(selection,end)=>{
    const all=await readKeys(selection.before.state.keyCount),keys=end==null?all:all.slice(0,end-selection.before.state.keyCount),distance=selection.index-selection.before.state.menu.index;
    assert.deepEqual(keys.map(k=>k.code),[...Array(Math.abs(distance)).fill(distance>0?0x23:0x22),0x27],selection.why+' exact selection directions and one Enter');
    selection.keys=keys;return keys;
  };
  const actualReport=async({kind,person,text,label:why})=>{
    const r=await until('actual equipment report '+why,`(() => {const r=baye.hd.report();return r.active===1&&r.kind===${kind}&&r.person===${person??65535}&&r.seq>0&&r.inputSeq>0&&r.text&&r;})()`,15_000);
    if(text)assert.equal(r.text,text);
    await until('visible mobile equipment report '+why,`(() => {const s=BayeHdDialog.debugSnapshot(),n=document.getElementById('hd-dialog');return s.open&&s.kind==='report'&&s.reportOwner&&s.reportOwner.seq===${r.seq}&&s.reportOwner.inputSeq===${r.inputSeq}&&s.body===${JSON.stringify(r.text)}&&n&&getComputedStyle(n).display!=='none';})()`);
    const during=await mark();assert.equal(during.state.report.seq,r.seq);assert.equal(during.state.report.inputSeq,r.inputSeq);assert.equal(during.state.report.active,1);
    const point=await controlPoint('#hd-dialog [data-hd-dlg-ok]');
    const fresh=await evaluate('baye.hd.report()');assert.ok(fresh.active===1&&fresh.seq===r.seq&&fresh.inputSeq===r.inputSeq&&fresh.kind===r.kind&&fresh.person===r.person,'Same actual report still owns confirmation');
    await tap(point);
    await until('current equipment report retires '+why,`(() => {const r=baye.hd.report();return r.active===0||r.inputSeq!==${r.inputSeq}||r.seq!==${r.seq};})()`,15_000);
    const after=await mark(),keys=await readKeys(during.state.keyCount);assert.deepEqual(keys.map(k=>k.code),[0x27],'Exactly one trusted ACK for '+why);
    assert.equal(after.state.touchCount,during.state.touchCount,'Report ACK does not leak LCD touch');
    const receipt={label:why,native:r,during,after,point,keys};entry.reports.push(receipt);return receipt;
  };
  const open=async(name,kind)=>{
    await root(0,'内政');
    if(name==='没收')return submenu(name);
    const before=await sample(),index=before.state.menu.names.indexOf(name);assert.ok(index>=0);const selector=`#hd-city-menu [data-hd-sub="${index}"]`;
    await revealSubmenu(selector,before);await touchButton(selector);
    if(kind===4){const after=await owned(4,before.state.menu.seq);worldSame(before,after,'Open actual reward inventory');navigation(await readKeys(before.state.keyCount),'赏赐 submenu');return after;}
    const msg=await actualReport({kind:1,text:messages.empty,label:'initial empty reward inventory'});assert.deepEqual(msg.during.world,expectedWorld);assert.deepEqual(msg.after.world,expectedWorld);
    const after=await ownedMap(before);navigation(await readKeys(before.state.keyCount).then(keys=>keys.slice(0,-1)),'Empty reward command before explicit report ACK');
    entry.emptyInventory={before,report:msg,after};return after;
  };
  const cancel=async(kind,why)=>{
    const before=await sample();await back(why);const after=kind===2?await ownedMap(before):await owned(kind,before.state.menu.seq);worldSame(before,after,why);
    entry.cancellations.push({label:why,before,after,keys:await readKeys(before.state.keyCount)});return after;
  };
  const finishMap=async why=>{await mapReturn(why);const reached=await sample();assert.equal(reached.state.hud.visible,true);
    for(const [k,v]of Object.entries(reached.state.expected))assert.equal(reached.state.hud[k],v);return reached;};
  const confiscate=async(personId,toolId,{cancelFirst=false}={})=>{
    const picker=await open('没收',3);let person=await select(3,personId,'Choose actual confiscation actor');
    // A nonempty first slot prevents the native picker from compacting equipment.
    assert.ok(person.before.world.people[personId].Tool1>0);await owned(4,person.before.state.menu.seq,personId);await selectedKeys(person);
    if(cancelFirst){await cancel(3,'cancel genuine equipped GOODS');person=await select(3,personId,'Reopen actual equipped goods');await owned(4,person.before.state.menu.seq,personId);await selectedKeys(person);}
    const goods=await sample(),p=goods.world.people[personId];assert.deepEqual(goods.state.menu.ids,[p.Tool1,p.Tool2].filter(Boolean).map(v=>v-1));
    const selection=await select(4,toolId,'Confirm actual confiscation');let pause;
    if(personId!==goods.world.king){pause=await actualReport({kind:2,person:personId,label:'confiscation person report'});assert.deepEqual(pause.during.world,selection.before.world,'Nonking confiscation business waits for its report');}
    const after=await owned(3,selection.before.state.menu.seq);
    await selectedKeys(selection,pause?.during.state.keyCount);
    const keys=await readKeys(selection.before.state.keyCount);assert.deepEqual(keys.map(k=>k.code).filter(k=>k===0x27),Array(personId===goods.world.king?1:2).fill(0x27));
    const operation={kind:'confiscate',personId,toolId,picker,selection,report:pause,after,keys};
    operation.oracle=verifyMobileConfiscation({before:selection.before.world,after:after.world,cityIndex:testCity.index,personId,toolId,libBytes,...(pause?{reportWorld:pause.during.world}:{})});
    expectedWorld=after.world;entry.operations.push(operation);await snap('confiscated-'+personId+'-'+toolId);await cancel(2,'leave fresh confiscation PERSON');await finishMap('confiscation returned map');
  };
  const rewardOpen=async toolId=>{
    const goods=await open('赏赐',4),index=goods.state.menu.ids.indexOf(toolId);assert.ok(index>=0);
    await preview(4,index);await allPages(4);const selection=await select(4,toolId,'Choose actual reward tool');
    const picker=await owned(3,selection.before.state.menu.seq);await selectedKeys(selection);worldSame(goods,picker,'Opening reward person picker');return {goods,selection,picker};
  };
  const reward=async(personId,toolId)=>{
    const opened=await rewardOpen(toolId),selection=await select(3,personId,'Confirm actual reward recipient');
    assert.ok(!selection.before.world.people[personId].Tool1||!selection.before.world.people[personId].Tool2);
    const pause=await actualReport({kind:2,person:personId,label:'reward person report'});
    await selectedKeys(selection,pause.during.state.keyCount);
    const operation={kind:'reward',personId,toolId,opened,selection,report:pause};
    // The original inventory is now empty: business has finished before this MSGBOX.
    const empty=await actualReport({kind:1,text:messages.empty,label:'empty inventory after actual reward'});
    const after=await ownedMap(selection.before);operation.empty=empty;operation.after=after;
    operation.oracle=verifyMobileReward({before:selection.before.world,after:after.world,cityIndex:testCity.index,personId,toolId,libBytes,reportWorld:pause.during.world});
    assert.deepEqual(empty.during.world,after.world);assert.deepEqual(empty.after.world,after.world);
    expectedWorld=after.world;entry.operations.push(operation);await snap('rewarded-'+personId+'-'+toolId);await finishMap('reward returned map');
  };
  const verifyPerson=async personId=>{
    await root(0,'内政');const picker=await submenu('搜寻');await preview(3,picker.state.menu.ids.indexOf(personId));await allPages(3);
    const details=(await attributes(3)).sample.attributes.person,p=expectedWorld.people[personId],rows=new Map(details.properties.map(v=>[v.title.replace(/\s/g,''),v.value]));
    for(const [title,key]of [['武力','Force'],['智力','IQ'],['忠诚','Devotion']])assert.equal(rows.get(title),String(p[key]),'Actual updated person property '+title);
    for(const [title,key]of [['道具一','Tool1'],['道具二','Tool2']]){const name=p[key]?await evaluate(`baye.getToolName(${p[key]-1})`):'';assert.equal(rows.get(title),name);}
    entry.checks.push({kind:'updated-person-equipment',personId,properties:details});await cancel(2,'leave updated actual person details');await finishMap('updated person returned map');
  };
  assert.deepEqual(inventory(expectedWorld),[],'Fresh original city begins with no discovered inventory');
  const ids=people(expectedWorld),king=expectedWorld.king,donor=ids.find(id=>id!==king&&expectedWorld.people[id].Tool1>0&&expectedWorld.people[id].Tool2>0),recipient=ids.find(id=>id!==king&&id!==donor&&!expectedWorld.people[id].Tool1&&!expectedWorld.people[id].Tool2);
  assert.ok(ids.includes(king)&&Number.isInteger(donor)&&Number.isInteger(recipient));const kingTool=expectedWorld.people[king].Tool1-1,donorTool=expectedWorld.people[donor].Tool1-1;
  entry.actors={king,donor,recipient,kingTool,donorTool};
  await open('赏赐',1);await finishMap('initial empty inventory returned map');
  await confiscate(king,kingTool);
  const opened=await rewardOpen(kingTool),attempt=await select(3,donor,'Attempt reward to actual full-equipped person');
  const full=await actualReport({kind:1,text:messages.full,label:'actual full-equipped rejection'});await selectedKeys(attempt,full.during.state.keyCount);
  assert.deepEqual(full.during.world,expectedWorld);assert.deepEqual(full.after.world,expectedWorld);const retry=await owned(3,attempt.before.state.menu.seq);assert.equal(retry.state.menu.index,0);
  const attemptKeys=await readKeys(attempt.before.state.keyCount),distance=attempt.index-attempt.before.state.menu.index;
  assert.deepEqual(attemptKeys.map(k=>k.code),[...Array(Math.abs(distance)).fill(distance>0?0x23:0x22),0x27,0x27]);
  entry.fullEquipment={opened,attempt,report:full,retry,keys:attemptKeys};await cancel(4,'cancel recipient after full-equipped rejection');await cancel(2,'cancel actual reward inventory');await finishMap('full rejection returned map');
  await reward(recipient,kingTool);await verifyPerson(recipient);
  await confiscate(donor,donorTool,{cancelFirst:true});await reward(donor,donorTool);await verifyPerson(donor);
  entry.returned=await finishMap('final equipment map');assert.deepEqual(entry.returned.world,expectedWorld);assert.equal(entry.operations.length,4);
  entry.accepted=true;await snap('map');return entry;
}
