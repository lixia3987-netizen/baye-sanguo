import assert from 'node:assert/strict';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';

// Real original title/system/record selectors. This driver only touches rendered
// controls; its public intro ACK is separate from HD input acceptance.
export async function runMobileSystemChecks(ctx) {
  const {report,evaluate,until,delay,checkpoint,metrics,touches,tap,buttonPoint,mark,worldSource,readSource,mapReadySource,assertHd,cdp}=ctx;
  const size=[report.systemWidth,report.systemWidth===667?375:390],VK={ENTER:39,EXIT:40,UP:34,DOWN:35};
  const item=i=>`#hd-system-ui [data-hd-sys="${i}"]`,back='#hd-system-ui [data-hd-sys-back]';
  const sampleSource=`(() => {const b=${readSource};return {...b,system:window.BayeHdSystemUi&&BayeHdSystemUi.debugSnapshot(),
    systemHost:window.BayeHdMobileSystem&&BayeHdMobileSystem.snapshot(),record:baye.hd.record(),kings:baye.hd.kings(),
    slots:BayeSaveStorage.slots(),systemPrefs:Object.fromEntries(['baye/systemUiMode','baye/overworldMode','baye/cityMenuMode','baye/mobileSystemUiMode'].map(k=>[k,localStorage.getItem(k)])),
    systemRect:(()=>{const r=document.getElementById('hd-system-ui').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()};})()`;
  const sample=()=>evaluate(sampleSource),keys=start=>evaluate(`__mobileMapKeys.slice(${start})`);
  const snapshot=async()=>({state:await sample(),world:await evaluate(`baye.getPersonCount()===200?${worldSource}:null`)});
  report.systemChecks=[];report.systemScrollChecks=[];report.systemPageInputs=[];
  await evaluate(`(() => {window.__mobileSystemDiagnostics=[];const s=BayeHdSystemUi,retire=s.retireInteraction;
    const state=()=>{const t=BayeHdMobileSystem.readInputTicket(),n=document.getElementById('hd-mobile-system-mode'),r=n.getBoundingClientRect();
      return {at:performance.now(),mode:s.getMode(),key:t&&t.key,rect:[r.left,r.top,r.width,r.height],hidden:document.hidden};};
    s.retireInteraction=function(reason,options){__mobileSystemDiagnostics.push({type:'retire',reason,...state()});return retire.apply(this,arguments);};
    for(const type of ['pointerdown','pointerup','click','scroll'])document.addEventListener(type,e=>{
      if(type==='scroll'||e.target.id==='hd-mobile-system-mode'||e.target.id==='hd-mobile-system-open')
        __mobileSystemDiagnostics.push({type,target:e.target.id||e.target.tagName,trusted:e.isTrusted,...state()});},true);
  })()`);
  const prefs=await evaluate(`Object.fromEntries(['baye/systemUiMode','baye/overworldMode','baye/cityMenuMode'].map(k=>[k,localStorage.getItem(k)]))`);
  const prefsSame=s=>{for(const [k,v]of Object.entries(prefs))assert.equal(s.systemPrefs[k],v,'Independent mobile system preference: '+k);};
  const capture=async label=>{const s=await snapshot();prefsSame(s.state);await checkpoint('system-'+size[0]+'-'+label);report.systemChecks.push({label,...s});return s;};
  const nativeOwner=s=>({menu:s.menu,record:s.record,qty:s.qty,report:s.report,march:s.march});
  const noInput=async(before,label)=>{await delay(180);const after=await snapshot();assert.deepEqual(after.world,before.world,label+' preserves recorded world');
    assert.deepEqual(nativeOwner(after.state),nativeOwner(before.state),label+' preserves native owner');assert.deepEqual(await keys(before.state.keyCount),[]);
    assert.equal(after.state.touchCount,before.state.touchCount);prefsSame(after.state);report.systemChecks.push({label,before,after,keys:[]});return after;};
  const ready=async screen=>until('current mobile HD system '+screen,`(() => {const s=${sampleSource};return s.systemHost&&s.systemHost.active&&s.system.open&&s.system.showHd&&!s.system.pending&&s.system.screen===${JSON.stringify(screen)}&&s.system.input&&s;})()`);
  const point=async(selector,allowDisabled=false,listId='hd-system-ui-list')=>{
    for(let step=0;step<12;step++){
      const g=await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)}),l=document.getElementById(${JSON.stringify(listId)});if(!n||!l)return null;
        const r=n.getBoundingClientRect(),p=l.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        const inside=!l.contains(n)||(r.top>=p.top-.5&&r.bottom<=p.bottom+.5&&r.left>=p.left-.5&&r.right<=p.right+.5);
        return {disabled:n.disabled,shown:n.getClientRects().length>0&&getComputedStyle(n).visibility==='visible',hit:t===n||n.contains(t),inside,
          target:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,x:r.left+r.width/2,y:r.top+r.height/2},
          clip:{left:p.left,right:p.right,top:p.top,bottom:p.bottom},scrollTop:l.scrollTop,scrollHeight:l.scrollHeight,clientHeight:l.clientHeight};})()`);
      if(g?.shown&&g.inside&&g.hit&&(allowDisabled||!g.disabled)){assert.ok(g.target.width>=43.5&&g.target.height>=43.5,'44px system control '+selector);return g.target;}
      if(!g?.shown){await delay(120);continue;}
      assert.ok(g.scrollHeight>g.clientHeight+2&&!g.inside,'Only genuine system-list overflow is panned '+selector+' '+JSON.stringify(g));
      const before=await snapshot(),r=g.clip,down=g.target.bottom>r.bottom,x=r.right-10,y=r.top+(r.bottom-r.top)*(down?.78:.22),end=r.top+(r.bottom-r.top)*(down?.22:.78);
      await touches('touchStart',[{x,y}]);for(let i=1;i<=6;i++)await touches('touchMove',[{x,y:y+(end-y)*i/6}]);await touches('touchEnd');
      const after=await noInput(before,'current list pan '+selector),scrollTop=await evaluate('document.getElementById('+JSON.stringify(listId)+').scrollTop');
      assert.notEqual(scrollTop,g.scrollTop,'Trusted pan actually moves list');report.systemScrollChecks.push({selector,beforeScrollTop:g.scrollTop,afterScrollTop:scrollTop,state:after.state});
    }
    throw Error('Current system control did not become visible '+selector);
  };
  const touch=async selector=>tap(await point(selector));
  const selectionKeys=(owner,target)=>{assert.ok(owner&&Number.isInteger(owner.index)&&target>=0&&target<owner.count);return [...Array(Math.abs(target-owner.index)).fill(target<owner.index?VK.UP:VK.DOWN),VK.ENTER];};
  const action=async(selector,screen,label,{exit=false}={})=>{const before=await snapshot();await touch(selector);await ready(screen);const after=await snapshot(),sent=await keys(before.state.keyCount),codes=sent.map(k=>k.code);
    if(exit)assert.deepEqual(codes,[VK.EXIT],label+' exactly one EXIT');else{const target=Number(/data-hd-sys="(\d+)"/.exec(selector)?.[1]);assert.deepEqual(codes,selectionKeys(before.state.system.input,target),label+' exact native focus keys and one ENTER');}
    assert.equal(after.state.touchCount,before.state.touchCount);prefsSame(after.state);report.systemChecks.push({label,before,after,keys:sent});return after;};
  const pair=()=>evaluate(`(() => {const paths=['baye//data//sango0.sav','baye//data//sango1.sav'],a=BayeSaveStorage.readFile(paths[0]),b=BayeSaveStorage.readFile(paths[1]);
    return {sav0:a,sav1:b,valid:BayeSaveStorage.validatePair(a,b),slot:BayeSaveStorage.inspectSlot(0),journal:localStorage.getItem('baye/save-transaction/0'),
      metadata:paths.map(p=>Object.fromEntries(['.lib','.name','.lib-id'].map(k=>[k,BayeSaveStorage.readMetadata(p+k)])))};})()`);
  await ready('title');await capture('01-title');
  // Retire held presses without dispatching stale confirmation.
  let before=await snapshot(),p=await point(item(0));await touches('touchStart',[p]);await touches('touchCancel');await noInput(before,'title touchcancel');
  before=await snapshot();p=await point(item(0));const mp=await buttonPoint('#hd-mobile-system-mode');await touches('touchStart',[{...p,id:1}]);await touches('touchStart',[{...p,id:1},{...mp,id:2}]);await touches('touchEnd');await noInput(before,'title second finger');
  before=await snapshot();await evaluate(`document.querySelector(${JSON.stringify(item(0))}).click()`);await noInput(before,'untrusted title click');
  before=await snapshot();p=await point(item(0));await touches('touchStart',[p]);await metrics(375,667);await touches('touchEnd');
  await until('portrait system LCD',`(() => {const s=${sampleSource};return s.lcd.shown&&s.lcd.hit&&!s.systemHost.active&&document.querySelector('#hd-system-ui').getAttribute('aria-hidden')==='true';})()`);
  await noInput(before,'portrait retires held title');await capture('02-portrait');await metrics(...size);await ready('title');await noInput(before,'landscape system restoration');
  before=await snapshot();p=await point(item(0));await touches('touchStart',[p]);const other=await cdp.send('Target.createTarget',{url:'about:blank'});
  try{await cdp.send('Target.activateTarget',{targetId:other.targetId});await until('real hidden system','document.hidden&&document.visibilityState==="hidden"',10000);await noInput(before,'hidden retires held title');}
  finally{await cdp.send('Target.closeTarget',{targetId:other.targetId});await cdp.send('Page.bringToFront');}
  await until('visible system','!document.hidden');await touches('touchEnd');await ready('title');await noInput(before,'hidden held release');
  before=await snapshot();await tap(await buttonPoint('#hd-mobile-system-mode'));await until('classic system preference',`BayeHdMobileSystem.snapshot().mode==='classic'`);await noInput(before,'independent classic system switch');
  await tap(await buttonPoint('#hd-mobile-system-mode'));await ready('title');await noInput(before,'independent HD system restore');
  await action(item(1),'saveload','empty load open');assert.equal((await sample()).record.mode,2);assert.equal((await sample()).record.count,4);
  before=await snapshot();await tap(await point(item(0),true));await noInput(before,'empty save cannot load');await capture('03-empty-load');await action(back,'title','load cancel',{exit:true});
  await action(item(0),'period','new game open');await action(back,'title','period cancel',{exit:true});await action(item(0),'period','new game reopen');await action(item(0),'king','original period 1');
  let kings=await sample();assert.equal(kings.kings.count,kings.system.kings.length);const kingIndex=kings.kings.kings.findIndex(k=>k.id===0);assert.ok(kingIndex>=0,'Actual original Dong Zhuo selector');
  await capture('04-rulers');before=await snapshot();await touch(item(kingIndex));await until('new original map',mapReadySource);assertHd(await evaluate(readSource));
  const initial=await snapshot();assert.equal(initial.world.king,0);assert.equal(initial.world.period,1);report.systemNewGame={before,after:initial,keys:await keys(before.state.keyCount)};await capture('05-new-map');
  assert.deepEqual(report.systemNewGame.keys.map(k=>k.code),selectionKeys(before.state.system.input,kingIndex),'New-game ruler exact focus and confirmation keys');
  const openSystem=async label=>{const b=await snapshot();await tap(await buttonPoint('#hd-mobile-system-open'));await ready('insystem');const a=await snapshot(),ks=await keys(b.state.keyCount);assert.deepEqual(ks.map(k=>k.code),[VK.EXIT]);assert.deepEqual(a.world,b.world);report.systemChecks.push({label,before:b,after:a,keys:ks});};
  const returnMap=async label=>{const b=await snapshot();await touch(back);await until('map '+label,mapReadySource);const a=await snapshot();assert.deepEqual(await keys(b.state.keyCount).then(v=>v.map(k=>k.code)),[VK.EXIT]);assert.deepEqual(a.world,b.world);assertHd(a.state);report.systemChecks.push({label,before:b,after:a});};
  await openSystem('open system from map');await returnMap('cancel system');await openSystem('reopen system');await action(item(1),'saveload','save open');assert.equal((await sample()).record.count,3);assert.equal((await sample()).record.mode,1);await returnMap('cancel save');
  assert.equal((await pair()).slot.status,'empty');await openSystem('system for saving');await action(item(1),'saveload','save reopen');await capture('06-save-slots');
  const beforeSave=await snapshot();await touch(item(0));await until('successful actual save returned to map',mapReadySource);const saved=await snapshot(),raw=await pair();
  assert.equal(raw.valid,true);assert.equal(raw.slot.canLoad,true);assert.deepEqual(saved.world,beforeSave.world);assert.deepEqual(await keys(beforeSave.state.keyCount).then(v=>v.map(k=>k.code)),[VK.ENTER]);
  assert.equal(raw.journal,null);assert.deepEqual(raw.metadata[0],raw.metadata[1]);assert.equal(raw.metadata[0]['.lib'],'libs/dat-mod.lib');
  assert.equal(raw.metadata[0]['.lib-id'],'v1:414390:1d36da77:1e9c0477');assert.ok(raw.metadata[0]['.name']);
  assert.equal(saved.state.record.active,0);assert.equal(saved.state.record.seq,beforeSave.state.record.seq===0xffffffff?1:beforeSave.state.record.seq+1);
  report.systemSave={before:beforeSave,after:saved,pair:raw,oracle:verifyOriginalSavePair({...raw,world:saved.world})};await capture('07-saved-map');
  // Make a real, bounded original world change so restoration proves a load.
  const cityIndex=15;assert.equal(saved.world.cities[cityIndex].Belong,saved.world.king+1);
  await evaluate('BayeHdOverworld.centerOnCity('+cityIndex+')');await until('map after readonly centering',mapReadySource);
  p=await evaluate(`(() => {const p=BayeHdOverworld.cityScreenPos(${cityIndex});return {x:p.clientX,y:p.clientY};})()`);await tap(p);
  const cityReady=kind=>`(() => {const n=baye.hd.menuItems(),u=BayeHdCityMenu.debugSnapshot();return n.active===1&&n.context===1&&n.kind===${kind}&&u.open&&!u.sending&&!u.queueLen&&n;})()`;
  await until('real city root',cityReady(1));await tap(await buttonPoint('#hd-city-menu [data-hd-root="0"]'));const sub=await until('real internal submenu',cityReady(2));
  const treatIndex=sub.names.indexOf('宴请');assert.ok(treatIndex>=0);await tap(await point('#hd-city-menu [data-hd-sub="'+treatIndex+'"]',false,'hd-city-menu-sublist'));const people=await until('real Treat person picker',cityReady(3));
  const actor=people.ids.find(id=>id!==saved.world.king&&saved.world.people[id].Belong===saved.world.king+1);assert.ok(Number.isInteger(actor));const row=people.ids.indexOf(actor);
  await tap(await buttonPoint('#hd-city-menu [data-hd-deep="'+row+'"][data-hd-deep-pind="'+actor+'"]'));
  const rep=await until('real Treat report','baye.hd.report().active===1&&baye.hd.report().kind===2&&baye.hd.report()');
  await until('mobile report shown','BayeHdDialog.debugSnapshot().open&&BayeHdDialog.debugSnapshot().kind==="report"');const during=await snapshot();
  const expectedDuring=structuredClone(saved.world);expectedDuring.cities[cityIndex].Money-=100;expectedDuring.people[actor].Thew=Math.min(100,expectedDuring.people[actor].Thew+50);assert.deepEqual(during.world,expectedDuring);
  const ackBefore=await snapshot();await tap(await buttonPoint('#hd-dialog [data-hd-dlg-ok]'));await until('Treat report retired','baye.hd.report().active===0');
  assert.deepEqual(await keys(ackBefore.state.keyCount).then(v=>v.map(k=>k.code)),[VK.ENTER]);
  for(let n=0;n<5&&!(await evaluate(mapReadySource));n++){await delay(200);if(await evaluate(mapReadySource))break;await tap(await buttonPoint('#hd-city-menu [data-hd-menu-back]'));}
  await until('map after Treat',mapReadySource);const changed=await snapshot(),expected=structuredClone(expectedDuring);expected.people[actor].Devotion=Math.min(100,expected.people[actor].Devotion+1);assert.deepEqual(changed.world,expected);assert.notDeepEqual(changed.world,saved.world);
  assert.deepEqual(await pair(),raw,'Actual world change does not rewrite saved files');report.systemMutation={cityIndex,actor,report:rep,during,after:changed};await capture('08-changed-world');
  await openSystem('system for end game');await action(item(2),'insystem-confirm','end game confirmation');await capture('09-end-confirm');await action(back,'insystem','end game cancel',{exit:true});await action(item(2),'insystem-confirm','end game confirmation reopen');await action(item(0),'title','confirm end game');
  report.systemPageInputs.push(await evaluate('({page:1,keys:__mobileMapKeys,touches:__mobileMapNativeTouches,events:__mobileMapEvents})'));
  report.systemInputDiagnostics=await evaluate('__mobileSystemDiagnostics');
  await cdp.send('Page.reload',{ignoreCache:true});await until('original engine after real reload','window.baye&&baye.hd&&baye.hd.ready()',60000);
  await evaluate(`(() => {window.__mobileMapKeys=[];window.__mobileMapNativeTouches=[];window.__mobileMapEvents=[];const k=window.sendKey,t=window._bayeSendTouchEvent;
    window.sendKey=function(code){__mobileMapKeys.push({code,page:2,at:performance.now()});return k.apply(this,arguments);};
    window._bayeSendTouchEvent=function observed(){__mobileMapNativeTouches.push({args:Array.from(arguments),page:2,at:performance.now()});const r=t.apply(this,arguments);window._bayeSendTouchEvent=observed;return r;};})()`);
  for(let n=0;n<60;n++){if(await evaluate('baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1'))break;
    if(await evaluate('baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)')){report.inputs.push({type:'public intro ACK after reload',code:VK.ENTER});await evaluate('sendKey(39)');await delay(160);}else await delay(150);}
  await ready('title');await capture('10-reloaded-title');assert.deepEqual(await pair(),raw,'Raw original save pair survives actual page reload');
  await action(item(1),'saveload','load saved game');const loadState=await sample();assert.equal(loadState.record.mode,2);assert.equal(loadState.slots[0].canLoad,true);await capture('11-load-slots');
  const beforeLoad=await snapshot();await touch(item(0));await until('loaded original map',mapReadySource);const loaded=await snapshot();assert.deepEqual(loaded.world,saved.world,'Real refreshed load restores all recorded world fields');assertHd(loaded.state);
  assert.deepEqual(await keys(beforeLoad.state.keyCount).then(v=>v.map(k=>k.code)),[VK.ENTER]);assert.deepEqual(await pair(),raw,'Load never rewrites saved pair');
  // GamRecordMan ends the selector; successful world_commit invalidates it again.
  const nextSeq=seq=>seq===0xffffffff?1:seq+1;
  assert.equal(loaded.state.record.active,0);assert.equal(loaded.state.record.seq,nextSeq(nextSeq(beforeLoad.state.record.seq)));
  report.systemLoad={before:beforeLoad,after:loaded,oracle:verifyOriginalSavePair({...raw,world:loaded.world})};await capture('12-loaded-map');
  report.acceptedScope=['Original mobile HD native title/period/ruler/system/end confirmation and local record selectors at '+size.join('x'),
    'Native save to public slot, actual Treat mutation, normal end, real page reload and load restore of explicitly recorded world fields',
    'Original 0x95 two-file decode against saved and restored persistent fields; no RNG continuity or unused resident-queue-tail claim',
    'Trusted 44px controls, actual scroll, cancelled/hidden/rotated/multifinger/untrusted actions, PC preference isolation; no real device/cloud/full-HD acceptance'];
}
