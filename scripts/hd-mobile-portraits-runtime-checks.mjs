// Uses the city runtime's private server, owned Chrome and genuine new game.
// Importing this module is read-only and never launches a browser.
import assert from 'node:assert/strict';

export async function runMobilePortraitChecks(c) {
  const {report,evaluate,until,delay,checkpoint,key,metrics,touches,tap,buttonPoint,button,mark,presentationUnchanged,cityPoint,
    readSource,worldSource,mapReadySource,verifyMobileTreatWorld,sendCdp}=c;
  const city=report.initialAllCities.find(v=>v.index===15&&v.kind==='owned');
  assert.ok(city&&city.name==='洛阳','Genuine first-period Dong Zhuo Luoyang is required');
  const checks=report.portraitChecks=[];
  const portrait=`(() => {
    const n=document.getElementById('hd-mobile-portrait'),img=document.getElementById('hd-mobile-portrait-img');
    const shown=n=>{if(!n)return false;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}const r=n.getBoundingClientRect();return r.width>0&&r.height>0;};
    const r=img?.getBoundingClientRect(),f=n?.getBoundingClientRect();
    return {adapter:BayeHdMobilePortraits.debugSnapshot(),host:BayeHdMobileCity.refresh(),shown:shown(n),
      mode:n?.getAttribute('data-hd-portrait'),person:n?.getAttribute('data-person-id'),period:n?.getAttribute('data-period'),
      parent:n?.parentElement?.id,src:img?.getAttribute('src'),currentSrc:img?.currentSrc,naturalWidth:img?.naturalWidth,naturalHeight:img?.naturalHeight,
      caption:document.getElementById('hd-mobile-portrait-cap')?.textContent,
      imageRect:r&&{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
      figureRect:f&&{left:f.left,right:f.right,top:f.top,bottom:f.bottom,width:f.width,height:f.height}};
  })()`;
  const keysSince=n=>evaluate(`__mobileMapKeys.slice(${n})`);
  const unchanged=async(before,label)=>{const after=await presentationUnchanged(before,label);checks.push({label,zeroKeys:true,worldUnchanged:true});return after;};
  const control=async selector=>{const p=await buttonPoint(selector);assert.ok(p.width>=43.5&&p.height>=43.5,selector+' >=44px and unobstructed');return p;};
  const press=async selector=>tap(await control(selector));
  const idle=`(() => {const s=BayeHdCityMenu.debugSnapshot();return !s.sending&&!s.queueLen&&!s.rootMenuPending;})()`;
  const currentPerson=person=>`(() => {const m=baye.hd.menuItems(),t=BayeHdMobileCity.readInputTicket('city');return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids[m.index]===${person}&&!!t;})()`;
  const readyPortrait=async(person,mode,context='city',requireInView=true)=>until('actual '+context+' '+person+' '+mode+' decoded portrait',`(() => {
    const p=${portrait},t=BayeHdMobileCity.readInputTicket(${JSON.stringify(context)}),r=p.imageRect;
    const native=${context==='city'?`baye.hd.menuItems().idsValid&&baye.hd.menuItems().ids[baye.hd.menuItems().index]===${person}`:`baye.hd.report().active===1&&baye.hd.report().kind===2&&baye.hd.report().person===${person}`};
    const inside=!!r&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;
    const n=document.getElementById('hd-mobile-portrait-img'),slot=n?.closest('#hd-city-menu-person-portrait,#hd-dialog-portrait');
    const top=inside&&document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),unobstructed=!!top&&!!slot&&(top===slot||slot.contains(top));
    return p.shown&&p.mode===${JSON.stringify(mode)}&&p.person===${JSON.stringify(String(person))}&&p.period==='1'&&p.naturalWidth>0&&p.naturalHeight>0&&
      p.currentSrc===new URL(p.src,document.baseURI).href&&p.adapter.visible&&p.adapter.personId===${person}&&p.adapter.period===1&&p.adapter.context===${JSON.stringify(context)}&&
      p.adapter.sourceMode===${JSON.stringify(mode)}&&p.adapter.sourceUrl===p.src&&t&&t.key===p.adapter.ownerKey&&native&&
      ${context==='city'?'p.host.cityVisible':'p.host.dialogVisible'}&&${requireInView?'inside&&unobstructed':'true'}&&
      p.parent===${JSON.stringify(context==='city'?'hd-city-menu-person-portrait':'hd-dialog-portrait')}&&p;
  })()`);
  const record=async(label,p)=>{checks.push({label,portrait:p});await checkpoint(label);};
  const lcdReady=(person,context)=>`(() => {
    const p=${portrait},s=${readSource},t=BayeHdMobileCity.readInputTicket(${JSON.stringify(context)}),o=p.host.fallbackOwner;
    return !p.shown&&p.host.fallbackActive&&p.adapter.fallbackActive&&o&&o.kind===${JSON.stringify(context)}&&o.period===1&&o.personId===${person}&&
      p.adapter.context===${JSON.stringify(context)}&&p.adapter.period===1&&p.adapter.personId===${person}&&p.adapter.sourceMode==='lcd'&&t&&t.key===p.adapter.ownerKey&&
      ${context==='city'?`t.native.menu.idsValid&&t.native.menu.ids[t.native.menu.index]===${person}`:`t.native.report.active===1&&t.native.report.kind===2&&t.native.report.person===${person}`}&&
      s.lcd.shown&&s.lcd.hit&&!s.cityLayer.shown&&!s.dialogLayer.shown&&p;
  })()`;
  const picker=async()=>{
    await until('genuine map before Luoyang',mapReadySource);
    const point=await cityPoint(city),before=await mark();await tap(point,true);
    await until('Luoyang native city root',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===1&&s.cityIndex===15&&s.open&&!s.sending&&!s.queueLen;})()`);
    assert.deepEqual((await mark()).world,before.world,'Entering Luoyang does not alter world');
    await press('#hd-city-menu [data-hd-root="0"]');
    const menu=await until('Luoyang actual interior submenu',`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===2&&m;})()`);
    const index=menu.names.indexOf('宴请');assert.ok(index>=0,'Native banquet command exists');
    const selector=`#hd-city-menu [data-hd-sub="${index}"]`;
    // Pan only the native-owned submenu to expose the actual command.
    for(let i=0;i<8;i++){
      const geo=await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)}),list=document.getElementById('hd-city-menu-sublist');if(!n||!list)return null;const r=n.getBoundingClientRect(),s=list.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);return {visible:r.top>=s.top&&r.bottom<=s.bottom&&(t===n||n.contains(t)),x:s.right-12,y:s.top+s.height*.8,end:s.top+s.height*.2,scroll:list.scrollTop};})()`);
      assert.ok(geo);if(geo.visible)break;
      const start=await mark();await touches('touchStart',[{x:geo.x,y:geo.y}]);
      for(let j=1;j<=6;j++)await touches('touchMove',[{x:geo.x,y:geo.y+(geo.end-geo.y)*j/6}]);await touches('touchEnd');
      await unchanged(start,'submenu-pan-'+i);
    }
    await press(selector);
    const m=await until('real Luoyang person IDs and synchronized UI',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner;return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&s.layer==='deep'&&!s.sending&&!s.queueLen&&o&&o.seq===m.seq&&o.detailGeneration===m.detailGeneration&&s.deepItems.length===m.ids.length&&m.ids.every((id,i)=>s.deepItems.find(v=>v.i===i)?.pind===id)&&m;})()`);
    const world=await evaluate(worldSource),nativeCity=world.cities[15];
    const eligible=world.queue.slice(nativeCity.PersonQueue,nativeCity.PersonQueue+nativeCity.Persons).filter(id=>world.people[id].Belong===nativeCity.Belong);
    assert.deepEqual(m.ids,eligible,'Actual original Luoyang allied resident IDs in native queue order');
    for(const id of [0,19,20])assert.ok(m.ids.includes(id),'Actual portrait validation person is eligible '+id);
    assert.equal(m.ids[m.index],0);
    return mark();
  };
  const highlight=async person=>{
    const m=await evaluate('baye.hd.menuItems()'),target=m.ids.indexOf(person);assert.ok(target>=0);
    const before=await mark();
    for(let i=m.index;i<target;i++)await key(0x23,'Public native person highlight only');
    for(let i=m.index;i>target;i--)await key(0x22,'Public native person highlight only');
    await until('actual highlighted native person '+person,currentPerson(person));await until('city queue idle after public highlight',idle);
    assert.deepEqual((await mark()).world,before.world,'Native person highlighting is not command commitment');
    checks.push({label:'native-highlight-'+person,keys:await keysSince(before.state.keyCount),worldUnchanged:true});
  };
  const returnMap=async()=>{
    for(let i=0;i<4;i++){
      const m=await evaluate('baye.hd.menuItems()');if(!m.active)break;
      const before=await mark(),presentation=await evaluate(portrait);
      if(presentation.host.fallbackActive){
        assert.equal(report.portraitCase,'all-missing','Only the exact both-images-missing case returns through native LCD');
        assert.equal(m.context,1);assert.equal(m.kind,3);assert.equal(m.idsValid,true);
        const person=m.ids[m.index];assert.equal(person,20,'The retired real report returns to its actual Lu Bu picker');
        await until('current native LCD before original return',lcdReady(person,'city'));
        await key(0x28,'Public native return while authentic LCD owns presentation');
        checks.push({label:'native-LCD-return-'+person,keys:[{code:0x28}],worldUnchanged:true});
      }else await press('#hd-city-menu [data-hd-menu-back]');
      await until('old native menu returns',`baye.hd.menuItems().seq!==${m.seq}||!baye.hd.menuItems().active`);await delay(220);
      assert.deepEqual((await mark()).world,before.world);assert.deepEqual((await keysSince(before.state.keyCount)).map(v=>v.code),[0x28]);
    }
    await until('HD map restored',mapReadySource);assert.equal((await evaluate(portrait)).shown,false,'Portrait does not linger on map');
  };
  await until('mobile portrait adapter ready','window.BayeHdMobilePortraits&&typeof BayeHdMobilePortraits.refresh==="function"');
  let before=await picker();
  if(report.portraitCase==='all-missing'){
    const p=await until('both images missing exposes actual LCD',lcdReady(0,'city'));
    await unchanged(before,'both-missing-full-world-and-owner');await record('01-missing-real-LCD',p);
    assert.equal(await evaluate('document.getElementById("hd-mobile-exit").disabled'),true,'Map header cannot bypass native fallback owner');
    const held=await mark();await delay(500);await unchanged(held,'missing-latch-stays-stable');
    await highlight(19);const ref=await readyPortrait(19,'ref');assert.equal(ref.host.fallbackActive,false,'New actual person releases old LCD latch');await record('02-ref-after-missing-owner-change',ref);
  }else if(report.portraitCase==='delayed'){
    const deadline=Date.now()+5000;while(Date.now()<deadline&&!report.requests.some(r=>r.delayMs===5000))await delay(50);
    assert.ok(report.requests.some(r=>r.delayMs===5000),'Exact real Dong image request is actually held by private HTTP server');
    report.delayedRequestObserved=true;
    await highlight(19);const ref=await readyPortrait(19,'ref');await record('01-ref-before-old-HD-load',ref);
    const late=await mark();await delay(5500);await unchanged(late,'old-HD-completion-cannot-replace-current-person');
    const after=await evaluate(portrait);assert.equal(after.person,'19');assert.equal(after.mode,'ref');await record('02-ref-after-old-HD-load',after);
  }else{
    const mode=report.portraitCase==='hd-missing'?'ref':'hd';
    let p=await readyPortrait(0,mode);await unchanged(before,'current-native-zero-ID-portrait-load');await record('01-Dong-Zhuo-'+mode,p);
    if(mode==='ref')assert.ok(p.src.includes('refs/period-1/0-'),'Missing HD uses authentic original reference');
    await highlight(19);p=await readyPortrait(19,'ref');assert.ok(p.caption.includes('李儒'));await record('02-Li-Ru-authentic-ref',p);
    await highlight(0);await readyPortrait(0,mode);
    for(const [width,height]of [[844,390],[667,375]]){
      before=await mark();await metrics(width,height);p=await readyPortrait(0,mode,'city',false);await unchanged(before,width+'-portrait-layout');
      for(let reset=0;reset<4;reset++){
        const r=await evaluate(`(() => {const n=document.getElementById('hd-city-menu-person-details'),r=n.getBoundingClientRect();return {scroll:n.scrollTop,x:r.right-12,y:r.top+r.height*.2,end:r.top+r.height*.8};})()`);
        if(r.scroll<=1)break;
        const start=await mark();await touches('touchStart',[{x:r.x,y:r.y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x:r.x,y:r.y+(r.end-r.y)*j/6}]);await touches('touchEnd');await unchanged(start,width+'-restore-portrait-scroll-top-'+reset);
      }
      p=await readyPortrait(0,mode);
      const footer=await control('#hd-city-menu [data-hd-menu-back]');assert.ok(p.figureRect.bottom<footer.y-footer.height/2,'Person portrait stays above footer');
      assert.ok(p.figureRect.top>=110&&p.figureRect.bottom>p.figureRect.top,'Actual portrait occupies visible detail pane');
      await record('person-'+width+'x'+height,p);
      const scroll=await evaluate(`(() => {const n=document.getElementById('hd-city-menu-person-details'),r=n.getBoundingClientRect();return {scrollTop:n.scrollTop,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight,x:r.right-12,y:r.top+r.height*.8,end:r.top+r.height*.2};})()`);
      if(scroll.scrollHeight>scroll.clientHeight+2){const start=await mark();await touches('touchStart',[{x:scroll.x,y:scroll.y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x:scroll.x,y:scroll.y+(scroll.end-scroll.y)*j/6}]);await touches('touchEnd');await unchanged(start,width+'-portrait-details-scroll');assert.notEqual(await evaluate('document.getElementById("hd-city-menu-person-details").scrollTop'),scroll.scrollTop);}
    }
    before=await mark();const back=await control('#hd-city-menu [data-hd-menu-back]');await touches('touchStart',[back]);await metrics(375,667);await touches('touchEnd');
    await until('portrait orientation removes portrait and exposes LCD',`(() => {const p=${portrait},s=${readSource};return !p.shown&&s.lcd.shown&&s.lcd.hit&&!s.cityLayer.shown;})()`);await unchanged(before,'held-back-rotate-zero-key');await checkpoint('portrait-orientation-LCD');
    await metrics(844,390);await readyPortrait(0,mode,'city',false);await unchanged(before,'landscape-portrait-restores-current-owner');
    before=await mark();await press('#hd-mobile-menu-mode');await until('classic removes portrait',`BayeHdCityMenu.getMode()==='classic'&&(${portrait}).shown===false`);await unchanged(before,'classic-portrait-retirement');
    await press('#hd-mobile-menu-mode');await readyPortrait(0,mode,'city',false);await unchanged(before,'HD-portrait-current-owner-restoration');
    before=await mark();await touches('touchStart',[await control('#hd-city-menu [data-hd-menu-back]')]);
    const other=await sendCdp('Target.createTarget',{url:'about:blank'});
    try{
      await sendCdp('Target.activateTarget',{targetId:other.targetId});
      await until('real private-tab hidden portrait retirement',`document.visibilityState==='hidden'&&document.hidden&&(${portrait}).shown===false`,10000);
      await unchanged(before,'real-hidden-retires-held-portrait-owner');
      report.portraitVisibility={hidden:await evaluate('({hidden:document.hidden,visibility:document.visibilityState})')};
    }finally{await sendCdp('Target.closeTarget',{targetId:other.targetId});await sendCdp('Page.bringToFront');}
    await until('real game tab visible again','document.visibilityState==="visible"&&!document.hidden');
    await touches('touchEnd');await readyPortrait(0,mode,'city',false);await unchanged(before,'hidden-restoration-old-release-zero-key');
    report.portraitVisibility.restored=await evaluate('({hidden:document.hidden,visibility:document.visibilityState})');
  }
  await highlight(20);
  const reportMode=report.portraitCase==='all-missing'?'lcd':report.portraitCase==='hd-missing'?'ref':'hd';
  if(reportMode==='lcd')await until('Lu Bu person both missing LCD',lcdReady(20,'city'));
  else await readyPortrait(20,reportMode,'city',false);
  const banquetBefore=await mark(),menu=banquetBefore.state.menu,index=menu.ids.indexOf(20);
  if(reportMode==='lcd')await key(0x27,'Public native person confirmation while authentic LCD owns presentation');
  else await press(`#hd-city-menu [data-hd-deep="${index}"][data-hd-deep-pind="20"]`);
  const native=await until('genuine Lu Bu report','(() => {const r=baye.hd.report();return r.active===1&&r.kind===2&&r.person===20&&r.seq>0&&r.inputSeq>0&&r;})()');
  const p=reportMode==='lcd'?await until('both report images missing exposes actual LCD',lcdReady(20,'dialog')):await readyPortrait(20,reportMode,'dialog');
  const during=await mark();
  const delta=verifyMobileTreatWorld(banquetBefore.world,during.world,15,20,'report');
  if(reportMode==='lcd')await unchanged(during,'report-both-missing-stable-LCD');
  else{const ack=await control('#hd-dialog [data-hd-dlg-ok]');assert.ok(p.figureRect.bottom<ack.y-ack.height/2,'Report portrait stays above confirmation');assert.ok(p.caption.includes('吕布'),'Caption identifies actual native report person');}
  await record('03-real-Lu-Bu-'+reportMode+'-report',p);
  const count=during.state.keyCount;
  if(reportMode==='lcd')await key(0x27,'Public native report acknowledgement while authentic LCD owns presentation');
  else await press('#hd-dialog [data-hd-dlg-ok]');
  await until('real Lu Bu report retires','!baye.hd.report().active');await delay(200);
  const after=await mark();assert.deepEqual((await keysSince(count)).map(v=>v.code),[0x27],'One real report confirmation');
  const finalDelta=verifyMobileTreatWorld(banquetBefore.world,after.world,15,20,'retired');
  report.portraitTreat={actor:20,city:15,native,delta,finalDelta,keys:await keysSince(count)};
  await returnMap();await checkpoint('04-final-original-HD-map');
  assert.equal(report.exceptions.length,0,'No uncaught browser exceptions');
  assert.ok(report.requests.filter(r=>r.status!==200).every(r=>r.status===404&&r.injected==='exact original person portrait missing'),'Only deliberately missing exact portrait resources may fail');
  if(['hd-missing','all-missing'].includes(report.portraitCase)){
    const missing=['assets/hd-portraits/hd/hd_p1_0000_董卓.png','assets/hd-portraits/hd/hd_p1_0020_吕布.png'];
    if(report.portraitCase==='all-missing')missing.push('assets/hd-portraits/refs/period-1/0-董卓.png','assets/hd-portraits/refs/period-1/20-吕布.png');
    for(const target of missing)assert.ok(report.requests.some(r=>r.status===404&&r.injected&&decodeURIComponent(new URL(r.url,'http://private').pathname).slice(1)===target),'Exact expected portrait target really returned HTTP404: '+target);
    report.verifiedMissingTargets=missing;
  }
  report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  report.portraitInteractionAccepted=true;report.accepted=true;report.ok=true;
  report.acceptedScope=['Actual native Dong Zhuo zero-ID person portrait','Authentic Li Ru reference','Actual Lu Bu '+reportMode+' report and original two-stage Treat effect',report.portraitCase,'Owned private Chrome emulated mobile scope only'];
}
