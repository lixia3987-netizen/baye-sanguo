// Actual scenario only. The maintained runner owns all OS/browser resources.
import assert from 'node:assert/strict';
import {verifyMobileSuccessorChoice,verifyMobileSuccessorReport,verifyMobileSuccessorSettlement,
  verifyMobileSuccessorBattleContext,verifyMobileSuccessorReturn} from './hd-mobile-successor-runtime-oracle.mjs';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';

export const campaignNativeSource=`(() => {const d=baye.data,p=d.g_FgtParam;return {
  menu:baye.hd.menuItems(),report:baye.hd.report(),fight:baye.hd.fight(),record:baye.hd.record(),
  battle:{mode:Number(p.Mode),over:Number(d.g_FgtOver),cityIndex:Number(p.CityIndex),playerFood:Number(p.MProvender),enemyFood:Number(p.EProvender),genArray:Array.from(p.GenArray,Number),positions:Array.from({length:20},(_,i)=>Object.fromEntries(['x','y','hp','mp','move','active','state'].map(k=>[k,Number(d.g_GenPos[i][k])])) )},
  detailGeneration:Number(d.g_hdDetailGeneration),march:baye.hd.march(),keys:__mobileMapKeys.length,touches:__mobileMapNativeTouches.length,
  dialog:BayeHdDialog.debugSnapshot(),mobileCity:BayeHdMobileCity.snapshot(),system:BayeHdSystemUi.debugSnapshot(),systemHost:BayeHdMobileSystem.snapshot()};})()`;

export const campaignSystemOpenDiagnosticSource=`(() => {const b=document.getElementById('hd-mobile-system-open'),r=b&&b.getBoundingClientRect(),s=b&&getComputedStyle(b),hit=r&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),d=baye.data;
  const fields=['g_hdEngineReady','g_hdDetailGeneration','g_hdSpeGeneration','g_hdMenuActive','g_hdMenuContext','g_hdMenuKind','g_hdMenuSeq','g_hdMenuCount','g_hdMenuIndex','g_hdRecordActive','g_hdRecordMode','g_hdRecordIndex','g_hdRecordCount','g_hdRecordSeq','g_hdMapPick','g_hdBattlePick','g_hdMapCity','g_hdMapInputSeq','g_hdMarchPhase','g_hdReportActive','g_hdQtyActive','g_hdHelpActive','g_hdFightActive','g_hdMovieActive','g_hdSpeActive','g_hdSkillActive','g_hdAttackActive','g_hdSkillResultActive','g_hdMakerActive','g_hdViewActive','g_hdMiniMapActive','g_hdGoodsActive','g_hdPersonPropertiesActive','g_hdResultOwnerKind','g_hdResultOwnerValid'];
  return {observationsOnly:true,at:performance.now(),visibility:document.visibilityState,focused:document.hasFocus(),raw:Object.fromEntries(fields.map(k=>[k,Number(d[k])])),
    systemHost:window.BayeHdMobileSystem&&BayeHdMobileSystem.debugSnapshot(),systemUi:window.BayeHdSystemUi&&BayeHdSystemUi.debugSnapshot(),
    openButton:b?{hidden:b.hidden,disabled:b.disabled,display:s.display,visibility:s.visibility,rect:{left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom},hit:hit===b||b.contains(hit),hitTarget:hit&&(hit.id||hit.tagName)}:null,
    keyCount:__mobileMapKeys.length,touchCount:__mobileMapNativeTouches.length,eventCount:__mobileMapEvents.length,events:__mobileMapEvents.slice(-20)};})()`;

export function campaignPreloadSampleSource(readSource) {
  return `(() => {const data=baye.data,identity=()=>BayeHdLibIdentity.read(),valid=i=>i&&i.status==='ready'&&i.sha256==='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'&&i.byteLength===207195&&Number.isInteger(i.generation)&&i.generation>0;
    const before={...identity()};if(!valid(before)||!baye.hd.ready())throw Error('Preload sample requires current original identity');
    const take=()=>{const n=${campaignNativeSource},m=n.menu,r=n.record,o=n.system.input;let scope;
      if(m.active===1&&m.context===4&&m.kind===1&&r.active===0&&n.system.screen==='title'&&o&&o.type==='menu'&&o.context===4&&o.kind===1&&o.seq===m.seq&&o.index===m.index&&o.count===m.count)scope='unloaded-title';
      else if(r.active===1&&r.mode===2&&r.count===4&&Number.isInteger(r.index)&&r.index>=0&&r.index<4&&m.active===0&&n.system.screen==='saveload'&&o&&o.type==='record'&&o.mode===2&&o.seq===r.seq&&o.index===r.index&&o.count===4)scope='unloaded-load-selector';
      else throw Error('Preload sample requires actual TITLE or LOAD selector');
      if(!Number.isInteger(n.detailGeneration)||n.detailGeneration<=0||!Number.isInteger(o.seq)||o.seq<=0||!Number.isInteger(o.count)||o.count<=0||!Number.isInteger(o.index)||o.index<0||o.index>=o.count||n.fight.active!==0||n.report.active!==0||n.march.pick!==0||n.march.battlePick!==0||Number(data.g_hdMapPick)!==0||Number(data.g_hdBattlePick)!==0||n.systemHost.active!==true||n.system.open!==true||n.system.showHd!==true||n.system.pending||!n.system.input)throw Error('Preload sample has competing or incomplete owner');
      return {native:n,scope,key:JSON.stringify({menu:m,record:r,report:n.report,fight:n.fight,march:n.march,detailGeneration:n.detailGeneration})};};
    const a=take(),state=${readSource},b=take(),after=identity();
    if(data!==baye.data||!baye.hd.ready()||!valid(after)||before.generation!==after.generation||!valid(state.identity)||state.identity.generation!==after.generation||a.scope!==b.scope||a.key!==b.key)throw Error('Preload sample owner changed');
    return {state,native:b.native,sampleScope:b.scope,worldSampled:false};})()`;
}

export function campaignObserverSource(worldSource) {
  return `(() => {
    const store=window.__mobileCampaign={reports:[],commits:[],keys:[],overflow:false};
    const sample=()=>({world:${worldSource},native:${campaignNativeSource},at:performance.now()});
    const observe=()=>{try {const n=baye.hd.report();if(n.active===1&&!store.reports.some(x=>x.native.report.seq===n.seq&&x.native.report.inputSeq===n.inputSeq)){
      if(store.reports.length>=100){store.overflow=true;}else store.reports.push(sample());}}catch(e){store.error=String(e);}};
    window.addEventListener('baye-hd-successor-committed',event=>{try{
      if(store.commits.length>=200){store.overflow=true;return;}
      const d=event.detail||{},receipt={generation:d.generation,oldKing:d.oldKing,newKing:d.newKing,playerKing:d.playerKing};
      store.commits.push({receipt,...sample()});
    }catch(e){store.error=String(e);}});
    const send=window.sendKey;window.sendKey=function(code){
      const m=baye.hd.menuItems();if(m.active===1&&m.context===5&&m.kind===1){
        if(store.keys.length>=100){store.overflow=true;}else store.keys.push({code,...sample()});}
      return send.apply(this,arguments);
    };
    for(const [object,name]of [[window.BayeHdDialog,'onEngineReport'],[window.BayeHdSpe,'onLcdFlush']]){
      if(!object||typeof object[name]!=='function')throw Error('Actual report callback unavailable: '+name);
      const original=object[name];object[name]=function(){try{return original.apply(this,arguments);}finally{observe();}};
    }
    return true;
  })()`;
}

export const campaignGeometrySource=selector=>`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const r=n.getBoundingClientRect();let left=0,top=0,right=innerWidth,bottom=innerHeight,shown=r.width>0&&r.height>0,scroller=null,scrollNode=null;const sticky=[];
    for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p),a=p.getBoundingClientRect();if(p.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)shown=false;
      if(p!==n&&p!==document.body&&p!==document.documentElement){if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,a.left);right=Math.min(right,a.right);}if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,a.top);bottom=Math.min(bottom,a.bottom);}}
      if(!scroller&&/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+1){scrollNode=p;scroller={id:p.id,className:p.className,top:a.top,bottom:a.bottom,left:a.left,right:a.right,scrollTop:p.scrollTop,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight};}}
    if(scrollNode)for(const q of scrollNode.querySelectorAll('*')){if(q===n||q.contains(n)||n.contains(q))continue;const s=getComputedStyle(q),a=q.getBoundingClientRect();
      if(s.position!=='sticky'||q.hidden||s.display==='none'||s.visibility==='hidden'||a.width<=0||a.height<=0||a.right<=r.left||a.left>=r.right||a.bottom<=scroller.top||a.top>=scroller.bottom)continue;
      if(s.bottom==='0px'){bottom=Math.min(bottom,a.top);sticky.push({edge:'bottom',top:a.top,bottom:a.bottom});}else if(s.top==='0px'){top=Math.max(top,a.bottom);sticky.push({edge:'top',top:a.top,bottom:a.bottom});}}
    const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {selector:${JSON.stringify(selector)},shown,visible:shown&&r.left>=left-.5&&r.right<=right+.5&&r.top>=top-.5&&r.bottom<=bottom+.5,
      hit:!!hit&&(hit===n||n.contains(hit)),x,y,width:r.width,height:r.height,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},clip:{left,top,right,bottom},scroller,sticky,disabled:!!n.disabled,target:hit&&(hit.id||hit.tagName)};})()`;

export async function runMobileCampaignChecks(c) {
  const {report,evaluate,until,delay,checkpoint,metrics,touches,tap,buttonPoint,button,cityPoint,
    readSource,worldSource,mapReadySource,readKeys,sendCdp,native,capture,ready,menu}=c;
  const size=[report.campaignWidth,report.campaignWidth===667?375:390],K={UP:34,DOWN:35,ENTER:39,EXIT:40};
  const sampleSource=`({state:${readSource},world:${worldSource},native:${campaignNativeSource}})`;
  const sample=()=>evaluate(sampleSource),preloadSample=()=>evaluate(campaignPreloadSampleSource(readSource)),codes=async offset=>(await readKeys(offset)).map(k=>k.code);
  report.campaignAccepted=false;report.successionOutcomeAccepted=false;report.campaignChecks=[];
  report.campaignCurrentPage=1;report.campaignPageInputs=[];report.campaignPageObservations=[];report.campaignScope={realDeviceAccepted:false,fullHdAccepted:false,randomMonthAccepted:false,rngContinuityAccepted:false};
  const checkpointSample=async label=>{const s=await sample();report.campaignChecks.push({label,page:report.campaignCurrentPage,...s});await checkpoint('campaign-'+size[0]+'-'+label);return s;};
  const unchanged=async(before,label)=>{await delay(160);const after=await sample();assert.deepEqual(after.world,before.world,label+' world');
    assert.deepEqual(after.native.menu,before.native.menu,label+' current menu');assert.deepEqual(after.native.report,before.native.report,label+' current report');
    assert.deepEqual(await codes(before.state.keyCount),[],label+' zero native keys');assert.equal(after.state.touchCount,before.state.touchCount,label+' zero LCD touches');return after;};
  const unchangedPreload=async(before,label)=>{await delay(160);const after=await preloadSample();
    assert.deepEqual(after.native.menu,before.native.menu,label+' current unloaded menu');assert.deepEqual(after.native.record,before.native.record,label+' current unloaded record');assert.deepEqual(after.native.report,before.native.report,label+' current report');
    assert.deepEqual(await codes(before.state.keyCount),[],label+' zero native keys');assert.equal(after.state.touchCount,before.state.touchCount,label+' zero LCD touches');return after;};
  // Every dispatched action uses an actual visible 44px DOM control and CDP touch.
  report.campaignScrolls=[];report.campaignCandidateGeometry=[];report.campaignNegatives=[];
  const point=async(selector,{preload=false}={})=>{
    let g;for(let attempt=0;attempt<16;attempt++){
      g=await evaluate(campaignGeometrySource(selector));
      if(g?.shown&&g.visible&&!g.disabled&&g.hit){assert.ok(g.width>=43.5&&g.height>=43.5,'44px current campaign control '+selector);return g;}
      if(!g?.shown){await delay(100);continue;}
      assert.ok(g.scroller,'Current campaign control has a genuine nearest scrolling ancestor: '+JSON.stringify(g));assert.equal(g.disabled,false);
      assert.ok(g.width<=g.clip.right-g.clip.left+1&&g.height<=g.clip.bottom-g.clip.top+1,'Control fits actual stage/ancestor/viewport intersection');
      if(g.visible&&!g.hit)throw Error('Current campaign control is covered at its actual visible center: '+JSON.stringify(g));
      const down=g.rect.bottom>g.clip.bottom+.5,deficit=down?g.rect.bottom-g.clip.bottom:g.clip.top-g.rect.top,available=g.clip.bottom-g.clip.top-32;
      assert.ok(deficit>0&&available>=16,'Measured clipped edge determines a finite real touch pan');
      const before=await (preload?preloadSample():sample()),amount=Math.min(Math.max(16,deficit+12),available),x=g.clip.right-12,y=down?g.clip.bottom-16:g.clip.top+16,delta=(down?-1:1)*amount;
      await touches('touchStart',[{x,y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x,y:y+delta*j/6}]);await touches('touchEnd');
      const after=await (preload?unchangedPreload(before,'Campaign unloaded list pan'):unchanged(before,'Campaign readonly list pan'));report.campaignScrolls.push({selector,before:g,pan:{x,y,delta},after:await evaluate(campaignGeometrySource(selector)),...(preload?{worldSampled:false,nativeBefore:before.native,nativeAfter:after.native}:{worldBefore:before.world,worldAfter:after.world})});
    }throw Error('Campaign control never became fully visible '+selector+': '+JSON.stringify(g));
  };
  const press=async(selector,options)=>tap(await point(selector,typeof options==='object'?options:{}));
  const exactSelection=(owner,target)=>[...Array(Math.abs(target-owner.index)).fill(target<owner.index?K.UP:K.DOWN),K.ENTER];
  const pcPreferencesSource="Object.fromEntries(['baye/overworldMode','baye/cityMenuMode','baye/battleMode','baye/systemUiMode'].map(k=>[k,localStorage.getItem(k)]))";
  report.campaignPcPreferencesBefore=await evaluate(pcPreferencesSource);
  await metrics(...size);await ready(1,'Current native battle PICK for succession scenario');
  await evaluate(campaignObserverSource(worldSource));
  report.campaignRetreat={before:await sample()};
  await button('[data-hd-battle-sys]');await ready(6,'Genuine retreat SYSTEM');await menu(1,'Request genuine retreat');await ready(7,'Genuine retreat confirmation');await menu(0,'Confirm actual retreat');
  let picker;
  for(let n=0;n<1800;n++){
    const s=await sample();
    if(s.native.menu.active===1&&s.native.menu.context===5&&s.native.menu.kind===1){picker=s;break;}
    if(!s.native.fight.active&&!s.native.report.active&&await evaluate(mapReadySource)){
      report.campaignNotCovered={code:'candidate-not-triggered',accepted:false,reason:'The genuine random retreat did not produce a surviving player succession picker',terminal:s};
      throw Error(report.campaignNotCovered.reason);
    }
    if(n===1799)throw Error('Natural retreat settlement never reached successor or current MAP');await delay(50);
  }
  assert.equal(picker.native.report.active,0);assert.ok(picker.native.menu.idsValid&&picker.native.menu.ids.length>1,'Actual non-first successor exists');
  const names=await evaluate('baye.hd.menuItems().ids.map(id=>baye.getPersonName(id))');
  const initialChoice=verifyMobileSuccessorChoice({world:picker.world,menu:picker.native.menu,names});
  const battleVerdict=verifyMobileSuccessorBattleContext({world:picker.world,battle:picker.native.battle,orderIndex:report.battleMarchVerdict.orderIndex});
  report.campaignPicker={before:picker,initialChoice,battleVerdict};
  if(!await evaluate("BayeHdCityMenu.getMode()!=='classic'")){
    const before=await sample();await button('#hd-mobile-menu-mode');await until('Independent mobile HD campaign preference',"BayeHdCityMenu.getMode()!=='classic'");await unchanged(before,'Campaign presentation switch');
  }
  await until('Current mobile successor HD shell',`(() => {const d=BayeHdDialog.debugSnapshot(),t=BayeHdDialog.getInputTicket(),m=baye.hd.menuItems();return d.open&&d.kind==='successor'&&d.showLcd===false&&BayeHdMobileCity.snapshot().dialogVisible&&t&&t.ownerType==='successor'&&m.context===5&&m.kind===1&&m.idsValid;})()`);
  const pickerReady=()=>until('Current authenticated HD successor after lifecycle boundary',"(() => {const m=baye.hd.menuItems(),t=BayeHdDialog.getInputTicket();return m.active===1&&m.context===5&&m.kind===1&&m.idsValid&&BayeHdMobileCity.snapshot().dialogVisible&&t&&t.ownerType==='successor';})()");
  for(const [index,id]of initialChoice.candidateIds.entries()){
    const selector='#hd-dialog [data-hd-successor-index="'+index+'"]',before=await sample(),geometry=await point(selector);
    const actual=await evaluate(`Number(document.querySelector(${JSON.stringify(selector)}).getAttribute('data-hd-campaign-person'))`);assert.equal(actual,id,'Every visible candidate carries the authenticated actual zero-based ID');
    await unchanged(before,'Every successor candidate reveal is readonly');report.campaignCandidateGeometry.push({index,id,geometry});
  }
  const heldSelector='#hd-dialog [data-hd-successor-index="1"]';
  for(const type of ['touchcancel','bare-click','two-pointers','held-portrait','held-hidden','held-classic']){
    const p=await point(heldSelector),before=await sample();let boundary=null;
    if(type==='touchcancel'){await touches('touchStart',[{x:p.x,y:p.y}]);await touches('touchCancel');}
    else if(type==='bare-click')await evaluate(`document.querySelector(${JSON.stringify(heldSelector)}).click()`);
    else if(type==='two-pointers'){const q=await buttonPoint('#hd-mobile-menu-mode');await touches('touchStart',[{x:p.x,y:p.y,id:1}]);await touches('touchStart',[{x:p.x,y:p.y,id:1},{x:q.x,y:q.y,id:2}]);await touches('touchEnd');}
    else if(type==='held-portrait'){await touches('touchStart',[{x:p.x,y:p.y}]);await metrics(375,667);await until('Portrait successor uses native LCD passthrough',"!BayeHdMobileCity.snapshot().dialogVisible");await metrics(...size);await pickerReady();await touches('touchEnd');}
    else if(type==='held-hidden'){
      await touches('touchStart',[{x:p.x,y:p.y}]);const other=await sendCdp('Target.createTarget',{url:'about:blank'});
      try{await sendCdp('Target.activateTarget',{targetId:other.targetId});await until('Genuinely hidden successor page',"document.hidden&&document.visibilityState==='hidden'",10000);boundary=await evaluate('({hidden:document.hidden,visibility:document.visibilityState})');await unchanged(before,'Hidden held successor before restoration');}
      finally{await sendCdp('Target.closeTarget',{targetId:other.targetId});await sendCdp('Page.bringToFront');}
      await until('Successor document visible again',"!document.hidden&&document.visibilityState==='visible'");await pickerReady();await touches('touchEnd');
    }else{
      await touches('touchStart',[{x:p.x,y:p.y}]);await evaluate("BayeHdCityMenu.setMode('classic')");await until('Public presentation-only classic boundary',"BayeHdCityMenu.getMode()==='classic'&&!BayeHdMobileCity.snapshot().dialogVisible");
      await evaluate("BayeHdCityMenu.setMode('hd')");await pickerReady();await touches('touchEnd');boundary={source:'Public presentation-only setMode API while held; no native world write'};
    }
    const after=await unchanged(before,'Retired successor '+type);report.campaignNegatives.push({type,before,after,boundary,keys:[],nativeTouches:[]});
  }
  const modeBefore=await sample();await button('#hd-mobile-menu-mode');await until('Trusted successor mode switches to classic',"BayeHdCityMenu.getMode()==='classic'&&!BayeHdMobileCity.snapshot().dialogVisible");await button('#hd-mobile-menu-mode');await pickerReady();const modeAfter=await unchanged(modeBefore,'Trusted classic-HD successor roundtrip');report.campaignModeRoundtrip={before:modeBefore,after:modeAfter,source:'Two trusted current header DOWN/UP/clicks'};
  const beforeChoice=await sample();assert.deepEqual(beforeChoice.world,picker.world);assert.deepEqual(beforeChoice.native.menu,picker.native.menu);
  assert.equal(beforeChoice.native.menu.index,0,'Original untouched successor picker starts on row zero');
  const chosenIndex=1,chosenId=initialChoice.candidateIds[chosenIndex],selector='#hd-dialog [data-hd-successor-index="'+chosenIndex+'"]';
  const eventsStart=beforeChoice.state.eventCount;await press(selector);
  await until('Actual selected new king report or synchronous completion',`Number(baye.data.g_PlayerKing)===${chosenId}&&(__mobileCampaign.reports.some(s=>s.world.king===${chosenId})||__mobileCampaign.commits.length)`);
  const sent=await readKeys(beforeChoice.state.keyCount);assert.deepEqual(sent.map(k=>k.code),exactSelection(beforeChoice.native.menu,chosenIndex),'Non-first HD successor uses exact arrows and one Enter');
  assert.equal((await sample()).state.touchCount,beforeChoice.state.touchCount,'HD successor sends no native LCD touch');
  const trusted=await evaluate(`__mobileMapEvents.slice(${eventsStart})`);assert.ok(trusted.some(e=>e.trusted===true&&e.type==='pointerdown'),'Actual trusted HD successor DOWN observed');
  await until('Synchronous original successor commit observed',`__mobileCampaign.commits.some(s=>s.receipt.generation===${picker.native.detailGeneration}&&s.receipt.oldKing===${picker.world.king}&&s.receipt.newKing===${chosenId}&&s.receipt.playerKing===${chosenId})`,30000);
  const observations=await evaluate('__mobileCampaign');assert.equal(observations.overflow,false);assert.equal(observations.error,undefined);report.campaignObservationsAtPlayerCommit=observations;
  const playerCommits=observations.commits.filter(s=>s.receipt.generation===picker.native.detailGeneration&&s.receipt.oldKing===picker.world.king&&s.receipt.newKing===chosenId&&s.receipt.playerKing===chosenId);
  assert.equal(playerCommits.length,1,'One generation/oldKing/newKing/playerKing-bound actual player succession completion');
  const confirmations=observations.keys.filter(s=>s.code===K.ENTER);assert.equal(confirmations.length,1,'One observed current successor confirmation');
  const confirmation=confirmations[0];assert.deepEqual(confirmation.world,picker.world,'No world change before actual successor ENTER');
  const choice=verifyMobileSuccessorChoice({world:picker.world,menu:confirmation.native.menu,names});
  assert.equal(choice.chosenIndex,chosenIndex);assert.equal(choice.chosenId,chosenId);
  const during=observations.reports.find(s=>s.world.king===chosenId&&s.native.report.active===1&&s.native.report.text.startsWith(names[chosenIndex]));
  assert.ok(during,'Actual NewKingNote report-active world was captured synchronously');
  const committed=playerCommits[0];
  const reportVerdict=verifyMobileSuccessorReport({before:picker.world,during:during.world,choice,report:during.native.report});
  const settlementVerdict=verifyMobileSuccessorSettlement({before:picker.world,after:committed.world,choice,receipt:committed.receipt});
  assert.equal(committed.native.report.active,0);assert.equal(committed.native.menu.active,0,'Old successor picker retired before completion');
  assert.deepEqual(committed.native.battle,picker.native.battle,'Battle winner, tokens and grain are unchanged by KingOverDeal');
  report.campaignSuccession={choice,before:picker,during,committed,otherCommitReceipts:observations.commits.filter(s=>s!==committed).map(s=>s.receipt),reportVerdict,settlementVerdict,keys:sent,trustedEvents:trusted};
  // Reports here retire by their actual native timer. No blind continuation key.
  await until('Actual successor settlement returns to current strategy MAP',mapReadySource,120000);
  const returned=await checkpointSample('01-inherited-map');
  assert.equal(returned.native.fight.active,0);assert.equal(returned.native.report.active,0);assert.equal(returned.native.battle.over,2);
  report.campaignReturn={after:returned,verdict:verifyMobileSuccessorReturn({committed:committed.world,returned:returned.world,choice,orderIndex:battleVerdict.orderIndex,armySlot:battleVerdict.armySlot})};
  const city=await evaluate(`BayeHdOverworld.getCities().filter(c=>c.kind==='owned').map(c=>({index:c.index,name:c.name,kind:c.kind,belong:c.belong}))[0]`);
  assert.ok(city&&returned.world.cities[city.index].Belong===chosenId+1,'New king has a real currently owned city');
  await tap(await cityPoint(city));await until('Inherited native CITY root',`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===1&&baye.data.g_hdMapCity===${city.index+1};})()`);
  if(!await evaluate('BayeHdCityMenu.debugSnapshot().showHd'))await button('#hd-mobile-menu-mode');
  await until('Inherited current HD CITY shell',`BayeHdMobileCity.isActive()&&BayeHdCityMenu.debugSnapshot().cityIndex===${city.index}`);
  const cityBefore=await sample();await button('#hd-city-menu [data-hd-root="3"]');await until('Inherited city readonly status',"BayeHdCityMenu.debugSnapshot().layer==='status'");
  await checkpointSample('02-inherited-city-status');await button('#hd-city-menu [data-hd-menu-back]');await until('Inherited CITY root restored',"BayeHdCityMenu.debugSnapshot().layer==='root'");
  const cityAfter=await sample();assert.deepEqual(cityAfter.world,returned.world);assert.deepEqual(await codes(cityBefore.state.keyCount),[],'Readonly inherited CITY operation and local return send zero keys');
  const exitStart=cityAfter.state.keyCount;await button('#hd-city-menu [data-hd-menu-back]');await until('Inherited CITY single EXIT returns MAP',mapReadySource);
  assert.deepEqual(await codes(exitStart),[K.EXIT]);assert.deepEqual((await sample()).world,returned.world);await checkpointSample('03-post-inheritance-operation-map');
  await saveReloadLoad({sample,point,press,checkpointSample,codes,choice,returned});
  const page2Observer=await evaluate('window.__mobileCampaign||null');if(page2Observer)report.campaignPageObservations.push({page:2,observer:page2Observer});
  report.campaignPageInputs.push(await evaluate('({page:2,keys:__mobileMapKeys,touches:__mobileMapNativeTouches,events:__mobileMapEvents})'));
  report.nativeKeys=report.campaignPageInputs.flatMap(p=>p.keys);report.nativeTouches=report.campaignPageInputs.flatMap(p=>p.touches);report.trustedEvents=report.campaignPageInputs.flatMap(p=>p.events);
  assert.equal(report.nativeTouches.length,0,'Entire measured mobile campaign uses no native LCD touch');assert.equal(report.exceptions.length,0);
  report.campaignPcPreferencesAfter=await evaluate(pcPreferencesSource);assert.deepEqual(report.campaignPcPreferencesAfter,report.campaignPcPreferencesBefore,'Mobile campaign preserves all four independent PC preferences');
  assert.equal(report.campaignNegatives.length,6);report.campaignNegativeAccepted=true;
  report.successionOutcomeAccepted=true;report.campaignAccepted=true;report.accepted=true;report.ok=true;
  report.acceptedScope=['Actual original player king capture and authenticated direct successor IDs independently checked against the native resident queues',
    'Trusted HD non-first successor, report-active and synchronous committed complete recorded worlds, current inherited CITY operation and one native return',
    'Original native save pair, genuine post-save Treat mutation, normal end/reload/load and exact recorded terminal world restoration'];
  report.pendingScope=['Random month outcome prediction and RNG continuity','Other periods/capture branches and defender campaigns','Android/iOS devices, full visual frames and complete HD'];

  async function saveReloadLoad({sample,point,press,checkpointSample,codes,choice,returned}) {
    const item=i=>'#hd-system-ui [data-hd-sys="'+i+'"]',back='#hd-system-ui [data-hd-sys-back]';
    const systemReady=screen=>until('Actual HD system '+screen,`(() => {const s=BayeHdSystemUi.debugSnapshot(),h=BayeHdMobileSystem.snapshot();return h.active&&s.open&&s.showHd&&!s.pending&&s.screen===${JSON.stringify(screen)}&&s.input;})()`);
    const pair=()=>evaluate(`(() => {const paths=['baye//data//sango0.sav','baye//data//sango1.sav'],sav0=BayeSaveStorage.readFile(paths[0]),sav1=BayeSaveStorage.readFile(paths[1]);return {sav0,sav1,
      valid:BayeSaveStorage.validatePair(sav0,sav1),slot:BayeSaveStorage.inspectSlot(0),journal:localStorage.getItem('baye/save-transaction/0'),metadata:paths.map(p=>Object.fromEntries(['.lib','.name','.lib-id'].map(k=>[k,BayeSaveStorage.readMetadata(p+k)])))};})()`);
    const systemAction=async(selector,screen,{exit=false,preload=false}={})=>{const read=preload?preloadSample:sample,before=await read();await press(selector,{preload});await systemReady(screen);const after=await read();
      if(!preload)assert.deepEqual(after.world,before.world,'System navigation preserves inherited world');const index=Number(/data-hd-sys="(\d+)"/.exec(selector)?.[1]);
      assert.deepEqual(await codes(before.state.keyCount),exit?[K.EXIT]:exactSelection(before.native.system.input,index));return after;};
    const openSystem=async()=>{
      // Opt-in primitive diagnostics do not retry or authorize the real click.
      await evaluate('window.BAYE_HD_MOBILE_SYSTEM_DIAGNOSTICS=true');
      const attempt={ordinal:(report.campaignSystemOpenAttempts||[]).length+1,before:await evaluate(campaignSystemOpenDiagnosticSource)};
      (report.campaignSystemOpenAttempts??=[]).push(attempt);const before=await sample();
      try{await button('#hd-mobile-system-open');attempt.afterTrustedTap=await evaluate(campaignSystemOpenDiagnosticSource);await systemReady('insystem');const after=await sample();
        assert.deepEqual(after.world,before.world);assert.deepEqual(await codes(before.state.keyCount),[K.EXIT]);attempt.ready=await evaluate(campaignSystemOpenDiagnosticSource);}
      catch(error){attempt.error=error.message;try{attempt.failure=await evaluate(campaignSystemOpenDiagnosticSource);}catch(diagnosticError){attempt.diagnosticError=diagnosticError.message;}throw error;}
    };
    await openSystem();await systemAction(item(1),'saveload');const beforeSave=await sample();assert.equal(beforeSave.native.record.mode,1);assert.equal(beforeSave.native.record.count,3);
    await press(item(0),'#hd-system-ui-list');await until('Save of inherited world returns MAP',mapReadySource);const saved=await sample(),raw=await pair();
    assert.deepEqual(saved.world,returned.world);assert.deepEqual(await codes(beforeSave.state.keyCount),exactSelection(beforeSave.native.system.input,0));
    assert.equal(saved.native.record.active,0);assert.equal(saved.native.record.seq,beforeSave.native.record.seq===0xffffffff?1:beforeSave.native.record.seq+1,'Native SAVE selector retires once');
    assert.equal(raw.valid,true);assert.equal(raw.slot.canLoad,true);assert.equal(raw.journal,null);assert.deepEqual(raw.metadata[0],raw.metadata[1]);
    assert.equal(raw.metadata[0]['.lib'],'libs/dat-mod.lib');assert.equal(raw.metadata[0]['.lib-id'],'v1:414390:1d36da77:1e9c0477');
    report.campaignSave={before:beforeSave,after:saved,pair:raw,oracle:verifyOriginalSavePair({...raw,world:saved.world})};await checkpointSample('04-saved-inherited-map');
    // A real current resident Treat proves loading, rather than merely re-reading.
    const viable=await evaluate('BayeHdOverworld.getCities().filter(c=>c.kind==="owned").map(c=>({index:c.index,name:c.name,kind:c.kind,belong:c.belong}))');
    const city=viable.find(c=>{const p=saved.world.cities[c.index];return p.Money>=100&&saved.world.queue.slice(p.PersonQueue,p.PersonQueue+p.Persons).some(id=>id!==choice.chosenId&&saved.world.people[id].Belong===choice.chosenId+1&&saved.world.people[id].Devotion<100);});
    assert.ok(city,'Actual inherited faction has a nonking resident and genuine Treat budget');
    await tap(await cityPoint(city));await until('Post-save inherited CITY root',`baye.hd.menuItems().active===1&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1&&baye.data.g_hdMapCity===${city.index+1}`);
    if(!await evaluate('BayeHdCityMenu.debugSnapshot().showHd'))await button('#hd-mobile-menu-mode');
    await button('#hd-city-menu [data-hd-root="0"]');await until('Original internal submenu',"baye.hd.menuItems().active===1&&baye.hd.menuItems().kind===2&&baye.hd.menuItems().names.includes('宴请')");
    const sub=await evaluate('baye.hd.menuItems()'),at=sub.names.indexOf('宴请');await press('#hd-city-menu [data-hd-sub="'+at+'"]','#hd-city-menu-sublist');
    await until('Actual inherited Treat PERSON',"baye.hd.menuItems().active===1&&baye.hd.menuItems().kind===3&&baye.hd.menuItems().idsValid");
    const persons=await evaluate('baye.hd.menuItems()'),actor=persons.ids.find(id=>id!==choice.chosenId&&saved.world.people[id].Belong===choice.chosenId+1&&saved.world.people[id].Devotion<100);
    assert.ok(Number.isInteger(actor));await press('#hd-city-menu [data-hd-deep="'+persons.ids.indexOf(actor)+'"][data-hd-deep-pind="'+actor+'"]','#hd-city-menu-deep');
    await until('Genuine inherited Treat report',`baye.hd.report().active===1&&baye.hd.report().kind===2&&baye.hd.report().person===${actor}`);
    const during=await sample(),expected=structuredClone(saved.world);expected.cities[city.index].Money-=100;expected.people[actor].Thew=Math.min(100,expected.people[actor].Thew+50);assert.deepEqual(during.world,expected);
    // This original report is permitted to retire naturally; no blind ACK.
    await until('Actual Treat report naturally retired','baye.hd.report().active===0',30000);
    for(let i=0;i<5&&!await evaluate(mapReadySource);i++){const m=await evaluate('baye.hd.menuItems()');assert.equal(m.active,1);assert.equal(m.context,1);await button('#hd-city-menu [data-hd-menu-back]');await delay(120);}
    await until('Post-save mutation MAP',mapReadySource);const changed=await sample();expected.people[actor].Devotion=Math.min(100,expected.people[actor].Devotion+1);assert.deepEqual(changed.world,expected);assert.notDeepEqual(changed.world,saved.world);assert.deepEqual(await pair(),raw);
    report.campaignMutation={city,actor,during,after:changed};await checkpointSample('05-genuine-mutated-map');
    await openSystem();await systemAction(item(2),'insystem-confirm');await systemAction(item(0),'title');
    report.campaignPageInputs.push(await evaluate('({page:1,keys:__mobileMapKeys,touches:__mobileMapNativeTouches,events:__mobileMapEvents})'));
    const page1Observer=await evaluate('window.__mobileCampaign||null');report.campaignPageObservations.push({page:1,observer:page1Observer});report.campaignObservations=page1Observer;
    report.campaignCurrentPage=2;await sendCdp('Page.reload',{ignoreCache:true});await until('Reloaded original engine ready','window.baye&&baye.hd&&baye.hd.ready()',60000);
    await evaluate(`(() => {window.__mobileMapKeys=[];window.__mobileMapNativeTouches=[];window.__mobileMapEvents=[];const k=window.sendKey,t=window._bayeSendTouchEvent;
      window.sendKey=function(code){__mobileMapKeys.push({code,page:2,at:performance.now()});return k.apply(this,arguments);};
      window._bayeSendTouchEvent=function observed(){__mobileMapNativeTouches.push({args:Array.from(arguments),page:2,at:performance.now()});const r=t.apply(this,arguments);window._bayeSendTouchEvent=observed;return r;};})()`);
    for(let i=0;i<60;i++){if(await evaluate('baye.hd.menuItems().active===1&&baye.hd.menuItems().context===4&&baye.hd.menuItems().kind===1'))break;
      if(await evaluate('baye.hd.movie().active||(baye.hd.spe().active&&baye.hd.spe().kind===1)')){await c.key(K.ENTER,'Public original intro ACK after campaign reload');}else await delay(150);}
    await systemReady('title');assert.deepEqual(await pair(),raw);const title=await preloadSample();report.campaignChecks.push({label:'06-reloaded-title',page:report.campaignCurrentPage,...title});await checkpoint('campaign-'+size[0]+'-06-reloaded-title');
    await systemAction(item(1),'saveload',{preload:true});const beforeLoad=await preloadSample();assert.equal(beforeLoad.native.record.mode,2);assert.equal(beforeLoad.native.record.count,4);
    await press(item(0),{preload:true});await until('Real refreshed inherited world LOAD',mapReadySource);const loaded=await sample();
    assert.deepEqual(await codes(beforeLoad.state.keyCount),exactSelection(beforeLoad.native.system.input,0));assert.deepEqual(loaded.world,saved.world,'Complete recorded inherited world restored by actual native LOAD');assert.deepEqual(await pair(),raw);
    const next=n=>n===0xffffffff?1:n+1;assert.equal(loaded.native.record.active,0);assert.equal(loaded.native.record.seq,next(next(beforeLoad.native.record.seq)));
    for(const [field,value]of Object.entries(loaded.state.expected))assert.equal(loaded.state.hud[field],value,'Loaded HUD '+field);
    report.campaignLoad={before:beforeLoad,after:loaded,oracle:verifyOriginalSavePair({...raw,world:loaded.world})};await checkpointSample('07-restored-inherited-map');
  }
}
