// Genuine UI scenario; the shared runner owns private HTTP/Chrome lifecycle.
import assert from 'node:assert/strict';
import {verifyMobileMarchSelection,verifyMobileMarchCancellation,verifyMobileHdMarch} from './hd-mobile-march-runtime-oracle.mjs';
import {checkMobileQuantityPresentation} from './hd-mobile-quantity-runtime-checks.mjs';

export async function runMobileMarchChecks(c) {
  const {report,evaluate,until,delay,checkpoint,metrics,touches,tap,buttonPoint,button,mark,
    presentationUnchanged,cityPoint,worldSource,readSource,mapReadySource,sendCdp,originalLibBytes,assertLcd}=c;
  const origin=8,target=9,width=report.marchWidth,height=width===667?375:390;
  const city=report.initialAllCities.find(v=>v.index===origin),destination=report.initialAllCities.find(v=>v.index===target);
  assert.ok(city&&city.name==='天水'&&city.kind==='owned');assert.ok(destination&&destination.kind!=='owned');
  report.marchChecks=[];report.marchActions=[];report.marchCancellations=[];report.marchNegativeChecks=[];report.marchControlProbes=[];report.quantityPresentation=[];report.quantityScrollChecks=[];
  report.marchScenario={origin,target,viewport:[width,height],input:'Trusted emulated touch on current HD controls only; public keys are confined to fresh-game startup'};
  await evaluate(`(() => {window.__mobileMarchKeyTrace=[];const previous=window.sendKey;
    window.sendKey=function(code){const d=baye.data;__mobileMarchKeyTrace.push({keyIndex:__mobileMapKeys.length,code,at:performance.now(),
      march:baye.hd.march(),menu:baye.hd.menuItems(),cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)}});return previous.apply(this,arguments);};})()`);
  const idle=`(() => {const s=BayeHdCityMenu.debugSnapshot();return !s.sending&&!s.queueLen&&!s.rootMenuPending&&!s.walkBusy&&!s.confirmingTarget;})()`;
  const phaseSource=p=>`(() => {const m=baye.hd.march(),s=BayeHdCityMenu.debugSnapshot();return m.phase===${p}&&m.origin===${origin}&&m.session>0&&s.open&&s.showHd&&BayeHdMobileCity.isActive()&&${idle};})()`;
  const phase=async p=>{await until('Current HD march phase '+p,phaseSource(p));return mark();};
  const pointTarget=async p=>evaluate(`(() => {const n=document.elementFromPoint(${p.x},${p.y});return n&&(n.id||n.tagName);})()`);
  const keysBetween=(a,b)=>evaluate(`__mobileMapKeys.slice(${a.state.keyCount},${b.state.keyCount}).map(x=>x.code)`);
  const noInput=async(before,label)=>{const after=await presentationUnchanged(before,label);
    report.marchNegativeChecks.push({label,before:before.state,after:after.state,zeroInput:true});return after;};
  // Scroll only through genuine touch; never change scrollTop or manufacture a click.
  const reveal=async(selector,retiredSource)=>{
    const publication=await until('Current march control is mounted in its visible owner '+selector,`(() => {
      if(${retiredSource||'false'})return {retired:true};
      const n=document.querySelector(${JSON.stringify(selector)});if(!n)return false;
      for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;}
      const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&{mounted:true};})()`,3_000);
    if(publication.retired)return false;
    for(let attempt=0;attempt<14;attempt++){
      if(retiredSource&&await evaluate(retiredSource))return false;
      const p=await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;
        let visible=true;for(let q=n;q&&q.nodeType===1;q=q.parentElement){const s=getComputedStyle(q);if(q.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)visible=false;}
        const r=n.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);
        const stage=document.getElementById('hd-mobile-stage').getBoundingClientRect(),clip={left:Math.max(stage.left,0),right:Math.min(stage.right,innerWidth),top:Math.max(stage.top,0),bottom:Math.min(stage.bottom,innerHeight)};
        for(let q=n.parentElement;q;q=q.parentElement){const s=getComputedStyle(q),a=q.getBoundingClientRect();
          if(['hidden','clip','auto','scroll'].includes(s.overflowX)){clip.left=Math.max(clip.left,a.left);clip.right=Math.min(clip.right,a.right);}
          if(['hidden','clip','auto','scroll'].includes(s.overflowY)){clip.top=Math.max(clip.top,a.top);clip.bottom=Math.min(clip.bottom,a.bottom);}}
        const geometry={left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
        if(visible&&r.width>=44&&r.height>=44&&r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5&&(t===n||n.contains(t)))return {visible:true,geometry,clip,hit:t&&(t.id||t.tagName)};
        let q=n.parentElement;while(q&&!(q.scrollHeight>q.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(q).overflowY)))q=q.parentElement;
        if(!visible||!q)return {visible:false,unscrollable:true,geometry,clip,hit:t&&(t.id||t.tagName)};const a=q.getBoundingClientRect();
        return {visible:false,geometry,top:r.top,bottom:r.bottom,clip:{left:Math.max(a.left,stage.left,0),right:Math.min(a.right,stage.right,innerWidth),top:Math.max(a.top,stage.top,0),bottom:Math.min(a.bottom,stage.bottom,innerHeight)}};})()`);
      report.marchControlProbes.push({selector,attempt,probe:p});
      if(retiredSource&&await evaluate(retiredSource))return false;
      assert.ok(p,'Current control exists '+selector);if(p.visible)return true;
      assert.ok(!p.unscrollable,'Current control can be revealed '+selector);const r=p.clip;
      assert.ok(r.right-r.left>=44&&r.bottom-r.top>=44,'Current scroll pane has a touch row');
      const down=p.bottom>r.bottom,x=r.right-12,y=r.top+(r.bottom-r.top)*(down?.8:.2),end=(r.bottom-r.top)*.55*(down?-1:1),before=await mark();
      await touches('touchStart',[{x,y}]);for(let j=1;j<=5;j++)await touches('touchMove',[{x,y:y+end*j/5}]);await touches('touchEnd');
      await noInput(before,'Scroll current march control '+selector);await delay(120);
    }
    throw Error('Control remained outside its current scroll pane '+selector);
  };
  const action=async(kind,selector,expect,{sameWorld=false,personId,group,holdMs=0}={})=>{
    await reveal(selector);const p=await buttonPoint(selector);assert.ok(p.width>=44&&p.height>=44,'At least 44px HD touch control '+selector);
    const before=await mark(),actualTarget=await pointTarget(p),item={kind,selector,target:actualTarget,point:p,source:'Trusted CDP DOWN/UP',before:before.state,worldBefore:before.world,personId};
    if(before.state.march.phase===2)report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,kind+' current visible summary'));
    console.log('ACTION',kind,'phase',before.state.march.phase);
    report.marchActions.push(item);item.holdMs=holdMs;
    if(holdMs){await touches('touchStart',[p]);await delay(holdMs);await touches('touchEnd');await delay(150);}else await tap(p);
    if(expect)await until('Touch '+kind+' retires into its genuine owner',expect);
    await until('HD march input queue retired after '+kind,idle);const after=await mark();
    item.after=after.state;item.worldAfter=after.world;item.keys=await keysBetween(before,after);item.completed=true;
    console.log('DONE',kind,'phase',after.state.march.phase,'keys',item.keys.join(','));
    assert.equal(after.state.touchCount,before.state.touchCount,'HD control does not pass raw LCD touch '+kind);
    if(sameWorld)assert.deepEqual(after.world,before.world,'Presentation/selection stage preserves measured world '+kind);
    if(group)group.push(item);return {before,after,item};
  };
  const record=async(stage,trace)=>{const frame=await mark();trace.push({stage,state:frame.state,world:frame.world});return frame;};
  const currentTargetPresentation=async()=>{
    const current=await until('Target picker retires the previous report presentation',`(() => {
      const m=baye.hd.march(),s=BayeHdCityMenu.debugSnapshot(),root=document.getElementById('hd-city-menu');
      if(m.phase!==4||s.wizardStep!=='map-pick'||!BayeHdMobileMap.refresh().active||
        root.querySelector('[data-hd-march-hint]')||root.querySelector('[data-hd-march-continue]'))return false;
      return {march:m,wizardStep:s.wizardStep,hint:s.marchHint||s.hint||'',reportContinue:false,priorReportHint:false};})()`);
    report.marchChecks.push({kind:'current-target-presentation',...current});
  };
  const scrollQuantity=async label=>{
    report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,label+' before scroll'));
    const probe=()=>evaluate(`(() => {const n=document.querySelector('#hd-city-menu-deep.has-mobile-qty .hd-city-menu-qty-controls');if(!n)return null;
      const r=n.getBoundingClientRect();return {scrollTop:n.scrollTop,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight,overflow:getComputedStyle(n).overflowY,
        geometry:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};})()`);
    const initial=await probe();assert.ok(initial,'Current mobile quantity has a dedicated controls pane');
    if(initial.scrollHeight<=initial.clientHeight+2){report.quantityScrollChecks.push({label,needed:false,initial});return;}
    assert.ok(['auto','scroll'].includes(initial.overflow),'Quantity controls expose real scrolling');
    await evaluate(`window.__quantityScrollNodes=[...document.querySelectorAll('#hd-city-menu-deep .hd-city-menu-qty-controls button')]`);
    for(const direction of ['down','up']){
      const geometry=await probe(),r=geometry.geometry,before=await mark(),down=direction==='down';
      assert.ok(r.height>=44&&r.width>=44,'Quantity scroll pane can receive an actual gesture');
      const x=r.right-5,y=r.top+r.height*(down?.8:.2),end=r.top+r.height*(down?.2:.8);
      await touches('touchStart',[{x,y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x,y:y+(end-y)*j/6}]);await touches('touchEnd');
      await noInput(before,label+' controls '+direction+' pan');
      const after=await probe(),nodesPreserved=await evaluate(`(() => {const current=[...document.querySelectorAll('#hd-city-menu-deep .hd-city-menu-qty-controls button')];return current.length===__quantityScrollNodes.length&&current.every((n,i)=>n===__quantityScrollNodes[i]);})()`);
      assert.ok(down?after.scrollTop>geometry.scrollTop:after.scrollTop<geometry.scrollTop,'Trusted gesture really scrolls quantity controls '+direction);
      assert.equal(nodesPreserved,true,'Native quantity poll preserves current button DOM and scrolling');
      const summary=await checkMobileQuantityPresentation(evaluate,label+' after '+direction+' scroll');report.quantityPresentation.push(summary);
      report.quantityScrollChecks.push({label,direction,before:geometry,after,nodesPreserved,summary});
    }
    await checkpoint('march-food-scroll-'+width);
  };
  const continueReport=async(run,from,to,kind)=>{
    const retired=phaseSource(to),selector='#hd-city-menu [data-hd-march-continue]';
    if(await evaluate(retired)||!await reveal(selector,retired)){
      report.marchChecks.push({kind,from,to,naturalRetirement:true,native:await evaluate(readSource)});return;
    }
    const before=await mark();
    if(before.state.march.phase===to){report.marchChecks.push({kind,from,to,naturalRetirement:true,native:before.state});return;}
    assert.equal(before.state.march.phase,from);assert.equal(before.state.report.active,1);
    let p;
    try{p=await buttonPoint(selector);}catch(error){if(await evaluate(retired)){report.marchChecks.push({kind,from,to,naturalRetirement:true,native:await evaluate(readSource)});return;}throw error;}
    const item={kind,selector,target:await pointTarget(p),point:p,source:'Trusted CDP DOWN/UP',before:before.state,worldBefore:before.world};
    report.marchActions.push(item);await tap(p);await until('Current report retires before further input',retired);const after=await mark();
    item.after=after.state;item.worldAfter=after.world;item.keys=await keysBetween(before,after);item.completed=true;
    assert.equal(after.state.touchCount,before.state.touchCount);
    if(from===3)assert.deepEqual(after.world,before.world,'Target report retirement preserves selected world');
    if(item.keys.length){assert.deepEqual(item.keys,[39],'Current report accepts at most one deliberate Enter');run.trustedActions.push(item);}
    else{item.naturalRetirement=true;report.marchChecks.push({kind,from,to,naturalRetirement:true,before:before.state,after:after.state});}
  };
  await metrics(width,height);await until('HD map for new march case',mapReadySource);
  await tap(await cityPoint(city));await until('Actual owned CITY root before march',`baye.hd.menuItems().active===1&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1&&BayeHdMobileCity.isActive()`);
  await checkpoint('march-city-'+width);

  const start=async label=>{
    if(await evaluate('baye.hd.march().phase===0&&baye.hd.march().pick===1&&baye.hd.menuItems().active===0')){
      await until('Native cancellation returns to the current HD map',mapReadySource);
      await tap(await cityPoint(city));
    }
    await until('CITY owner before '+label,`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&[1,2].includes(m.kind)&&${idle};})()`);
    const rootMenu=await evaluate('baye.hd.menuItems()');
    if(rootMenu.kind===1){assert.equal(rootMenu.names[2],'军备');const r=await action('open-military','#hd-city-menu [data-hd-root="2"]',`baye.hd.menuItems().active===1&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===2`,{sameWorld:true});
      assert.equal(r.item.keys.filter(k=>k===39).length,1);}
    const menu=await evaluate('baye.hd.menuItems()'),index=menu.names.indexOf('出征');assert.ok(index>=0,'Real military march row');
    await action('open-march',`#hd-city-menu [data-hd-sub="${index}"]`,phaseSource(1),{sameWorld:true});
    const first=await phase(1);assert.equal(first.state.march.selected,0);assert.equal(first.state.lcd.shown,false);
    const run={label,before:first.world,initial:first.state,selectedPersonIds:[],selections:[],trustedActions:[],phaseTrace:[]};
    await record('persons',run.phaseTrace);return run;
  };
  const select=async(run,count)=>{
    for(let n=0;n<count;n++){
      const before=await phase(1),m=before.state.menu;assert.ok(m.active===1&&m.kind===3&&m.idsValid&&m.ids.length);
      const id=m.ids[0],oldSelected=before.state.march.selected;
      const r=await action('select-person',`#hd-city-menu [data-hd-deep="0"][data-hd-deep-pind="${id}"]`,
        `baye.hd.march().selected===${oldSelected+1}&&baye.hd.menuItems().seq!==${m.seq}`,{personId:id,group:run.trustedActions});
      const verdict=verifyMobileMarchSelection({before:r.before.world,after:r.after.world,origin,personId:id,selectedPersonIdsBefore:run.selectedPersonIds});
      run.selectedPersonIds.push(id);run.selections.push({personId:id,before:r.before.world,after:r.after.world,verdict});
      assert.equal(r.item.keys.filter(k=>k===39).length,1,'Exactly one explicit person confirmation');
      if(r.after.state.march.phase===1)await record('persons',run.phaseTrace);
    }
    await action('finish-persons','#hd-city-menu [data-hd-finish-persons]',phaseSource(2),{sameWorld:true,group:run.trustedActions});
    const food=await phase(2);assert.ok(food.state.qty.active===1&&food.state.qty.protocol&&food.state.qty.ready===1);
    assert.equal(food.state.qty.max,run.before.cities[origin].Food);assert.deepEqual(food.world,run.selections.at(-1).after);
    report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,run.label+' food opened'));
    return food;
  };
  const cancel=async(run,stage,selector)=>{
    const r=await action('cancel-'+stage,selector,`baye.hd.march().phase===0&&baye.hd.qty().active===0&&baye.hd.march().pick===1&&baye.hd.menuItems().active===0&&BayeHdMobileMap.refresh().active`,{holdMs:650});
    assert.deepEqual(r.item.keys,[40],'One explicit native cancel '+stage);
    const verdict=verifyMobileMarchCancellation({before:run.before,after:r.after.world,origin,selectedPersonIds:run.selectedPersonIds,cancelStage:stage});
    report.marchCancellations.push({stage,...run,after:r.after.world,afterState:r.after.state,verdict});await checkpoint('march-cancel-'+stage+'-'+width);
  };
  // Two actual rollback paths, including native AddPerson queue ordering.
  const cancelledFood=await start('food cancellation');await select(cancelledFood,2);
  await cancel(cancelledFood,'food','#hd-city-menu [data-hd-qty-cancel]');
  const cancelledTarget=await start('target cancellation');await select(cancelledTarget,2);
  await action('food-confirm','#hd-city-menu [data-hd-qty-ok]',phaseSource(3),{sameWorld:true,group:cancelledTarget.trustedActions});
  await continueReport(cancelledTarget,3,4,'continue-target');
  await until('Current target HD map',`BayeHdMobileMap.refresh().active&&BayeHdMobileMap.snapshot().ownerType==='march-target'`);
  await currentTargetPresentation();
  const mapPoint=async index=>{
    const before=await mark();assert.notEqual(await evaluate('BayeHdOverworld.centerOnCity('+index+')'),false);
    await until('Current target map after presentation centering',`BayeHdMobileMap.refresh().active&&BayeHdMobileMap.snapshot().ownerType==='march-target'`);
    const layout=await until('Target drawing and touch surface use the same dimensions',`(() => {const c=document.getElementById('hd-overworld-canvas'),r=c.getBoundingClientRect(),s=document.getElementById('hd-mobile-stage').getBoundingClientRect(),p=document.getElementById('hd-city-menu').getBoundingClientRect(),d=BayeHdOverworld.debugSnapshot().design,scale=Math.min(devicePixelRatio||1,2);
      return r.width>0&&r.height>0&&Math.abs(d[0]-r.width)<=1&&Math.abs(d[1]-r.height)<=1&&c.width===Math.round(d[0]*scale)&&c.height===Math.round(d[1]*scale)&&r.right<=p.left+1&&r.left>=s.left-1&&r.top>=s.top-1&&r.bottom<=s.bottom+1?{canvas:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,backing:[c.width,c.height]},design:d,panel:{left:p.left,width:p.width}}:null;})()`);
    report.marchChecks.push({kind:'target-canvas-geometry',index,layout});
    await noInput(before,'Center target map without native movement');
    const p=await evaluate(`(() => {const p=BayeHdOverworld.cityScreenPos(${index}),n=document.getElementById('hd-overworld-canvas');
      return p&&{...p,hit:document.elementFromPoint(p.clientX,p.clientY)===n};})()`);
    assert.ok(p&&p.hit,'Current target is physically visible on target canvas');return {x:p.clientX,y:p.clientY};
  };
  const choose=async(run)=>{
    // Reveal confirmation before selecting so a scroll never supplies a confirmation.
    await reveal('#hd-city-menu [data-hd-confirm-march]');
    const p=await mapPoint(target),before=await mark(),item={kind:'target-select',target:'hd-overworld-canvas',selector:'#hd-overworld-canvas',point:p,
      source:'Trusted CDP map DOWN/UP',before:before.state,worldBefore:before.world};
    report.marchActions.push(item);await tap(p);await until('Touch only selects current legal target',`BayeHdCityMenu.debugSnapshot().pendingTarget===${target}&&baye.hd.march().phase===4`);
    const after=await mark();item.after=after.state;item.worldAfter=after.world;item.keys=await keysBetween(before,after);item.completed=true;
    assert.deepEqual(item.keys,[]);assert.equal(after.state.touchCount,before.state.touchCount);assert.deepEqual(after.native,before.native);assert.deepEqual(after.world,before.world);
    run.trustedActions.push(item);return after;
  };
  await choose(cancelledTarget);await cancel(cancelledTarget,'target','#hd-city-menu [data-hd-march-cancel]');

  const run=await start('HD dispatch');report.marchDispatch=run;await select(run,2);
  await scrollQuantity('dispatch '+width);
  const q0=await evaluate('baye.hd.qty()');assert.ok(q0.value>1);
  const adjusted=await action('food-adjust','#hd-city-menu [data-hd-qty="-1"]',`baye.hd.qty().value===${q0.value-1}&&baye.hd.qty().ready===1`,{sameWorld:true,group:run.trustedActions});
  assert.ok(adjusted.item.keys.length>0&&adjusted.item.keys.every(k=>[34,35,36,37].includes(k)),'Native acknowledged quantity adjustment arrows only');
  report.quantityPresentation.push(await checkMobileQuantityPresentation(evaluate,'dispatch '+width+' after native quantity ACK'));
  run.qty=await evaluate('baye.hd.qty()');await record('food',run.phaseTrace);await checkpoint('march-food-'+width);
  await action('food-confirm','#hd-city-menu [data-hd-qty-ok]',phaseSource(3),{sameWorld:true,group:run.trustedActions});
  await record('target-tip',run.phaseTrace);await checkpoint('march-target-tip-'+width);
  await continueReport(run,3,4,'continue-target');
  await until('Target picker owns the HD map',`BayeHdMobileMap.refresh().active&&BayeHdMobileMap.snapshot().ownerType==='march-target'`);
  await currentTargetPresentation();
  await record('target',run.phaseTrace);await checkpoint('march-target-'+width);
  // Current origin and nonadjacent cities cannot issue any native input.
  const targetTicket=await evaluate('BayeHdCityMenu.getMarchTargetTicket()&&({targets:BayeHdCityMenu.getMarchTargetTicket().targets})');
  assert.ok(targetTicket&&Array.isArray(targetTicket.targets)&&targetTicket.targets.length);
  const indexes=targetTicket.targets.map(v=>typeof v==='number'?v:v.index);
  assert.ok(indexes.includes(target));
  for(const index of [origin,report.initialAllCities.find(v=>v.index!==origin&&!indexes.includes(v.index)).index]){
    const p=await mapPoint(index),before=await mark();await tap(p);await noInput(before,'Invalid march city '+index+' does not move or dispatch');
  }
  await choose(run);
  // A held confirmation never survives cancellation, multitouch, rotation or actual tab hiding.
  for(const kind of ['cancel','multi','rotate','hidden']){
    await choose(run);await reveal('#hd-city-menu [data-hd-confirm-march]');const p=await buttonPoint('#hd-city-menu [data-hd-confirm-march]'),before=await mark();
    await touches('touchStart',[p]);
    if(kind==='cancel')await touches('touchCancel');
    if(kind==='multi'){await touches('touchStart',[{...p,id:1},{x:25,y:20,id:2}]);await touches('touchEnd');}
    if(kind==='rotate'){await metrics(height,width);await metrics(width,height);await touches('touchEnd');}
    if(kind==='hidden'){
      const other=await sendCdp('Target.createTarget',{url:'about:blank'});
      try{await sendCdp('Target.activateTarget',{targetId:other.targetId});await until('Real march tab becomes hidden','document.hidden&&document.visibilityState==="hidden"',10000);}
      finally{await sendCdp('Target.closeTarget',{targetId:other.targetId});await sendCdp('Page.bringToFront');}
      await until('March tab visible again','!document.hidden&&document.visibilityState==="visible"');await touches('touchEnd');
    }
    await until('Current target owner resumes after '+kind,phaseSource(4));await noInput(before,'Held confirmation '+kind+' retires');
  }
  const beforeMode=await mark();await button('#hd-mobile-menu-mode');await until('Classic march is physical LCD',`BayeHdCityMenu.getMode()==='classic'&&!BayeHdMobileCity.isActive()`);
  await noInput(beforeMode,'Classic march presentation switch');assertLcd(await checkpoint('march-classic-target-'+width));
  await button('#hd-mobile-menu-mode');await phase(4);await noInput(beforeMode,'Current HD march presentation restores');
  await choose(run);await record('target-selected',run.phaseTrace);await checkpoint('march-target-selected-'+width);
  const submitted=await action('target-confirm','#hd-city-menu [data-hd-confirm-march]',phaseSource(6),{sameWorld:true,group:run.trustedActions,holdMs:650});
  const route=await evaluate(`__mobileMarchKeyTrace.filter(x=>x.keyIndex>=${submitted.before.state.keyCount}&&x.keyIndex<${submitted.after.state.keyCount})`);
  assert.equal(route.length,submitted.item.keys.length);assert.ok(route.length>0);assert.equal(route.at(-1).code,39);
  for(let n=0;n<route.length;n++){
    const r=route[n];assert.equal(r.march.phase,4);assert.equal(r.march.origin,origin);assert.equal(r.march.session,submitted.before.state.march.session);
    assert.equal(r.march.mapInputSeq,submitted.before.state.march.mapInputSeq,'The native map input session stays current throughout target navigation');
    if(n){const p=route[n-1],dx=p.code===37?1:p.code===36?-1:0,dy=p.code===35?1:p.code===34?-1:0;
      assert.equal(r.cursor.x,p.cursor.x+dx);assert.equal(r.cursor.y,p.cursor.y+dy);
    }
  }
  assert.equal(route.at(-1).cursor.x,destination.engX);assert.equal(route.at(-1).cursor.y,destination.engY);run.route=route;
  assert.equal(submitted.after.state.march.phase,6,'Actual live armout sample precedes natural retirement');
  run.phaseTrace.push({stage:'armout',state:submitted.after.state,world:submitted.after.world});await checkpoint('march-armout-'+width);
  await continueReport(run,6,7,'armout-ack');
  await phase(7);await record('departed',run.phaseTrace);run.after=await evaluate(worldSource);
  assert.equal(run.phaseTrace.at(-1).state.report.active,0,'Consumed departure report is inactive at the new order');
  report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  report.marchKeyTrace=await evaluate('__mobileMarchKeyTrace');
  run.verdict=verifyMobileHdMarch({before:run.before,after:run.after,qty:run.qty,libBytes:originalLibBytes,selectedPersonIds:run.selectedPersonIds,
    selections:run.selections,phaseTrace:run.phaseTrace,trustedActions:run.trustedActions,
    nativeKeys:report.nativeKeys,nativeTouches:report.nativeTouches,trustedEvents:report.trustedEvents});
  await checkpoint('march-departed-'+width);
  const strategy=await action('strategy-end','#hd-city-menu [data-hd-strategy-end]',`baye.hd.fight().active===1&&baye.hd.fight().inputKind===1&&BayeHdMobileBattle.refresh().presentation==='hd'`);
  assert.equal(strategy.item.keys.filter(k=>k===39).length,1,'One deliberate strategy-end Enter');
  assert.ok(strategy.item.keys.every(k=>[34,35,36,37,39,40].includes(k)),'Only actual owner navigation during strategy handoff');
  assert.equal(await evaluate('BayeHdCityMenu.debugSnapshot().open'),false,'Consumed march shell retired at actual battle');
  const battle=await checkpoint('march-genuine-battle-'+width);assert.equal(battle.fight.active,1);assert.equal(battle.fight.inputKind,1);
  assert.equal(battle.mobileBattle.presentation,'hd');assert.equal(battle.cityLayer.shown,false);
  report.marchStrategyHandoff={keys:strategy.item.keys,battle: battle.fight,hdBattle:true};
  report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  report.marchAccepted=true;report.ok=true;report.accepted=true;
  report.acceptedScope=['Original P1 Ma Teng HD march 8→9 at '+width+'×'+height+' via trusted controls',
    'Two exact native cancellation paths; selected queue, grain, money and orders',
    'Current target selection without native movement, explicit acknowledged confirmation and genuine strategy handoff'];
  report.pendingScope=['Other origins/periods, native rejection/report families and full queue cases','Android/iOS real devices, performance and whole mobile HD'];
}
