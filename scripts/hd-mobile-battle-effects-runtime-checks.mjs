// Actual original-game scenario. The safe runner owns browser/server lifecycle.
import assert from 'node:assert/strict';
import {battleObservation} from './hd-mobile-battle-runtime-checks.mjs';
import {verifyMobileSpySkill} from './hd-mobile-battle-skill-oracle.mjs';
import {verifyMobileNonlethalAttack} from './hd-mobile-battle-attack-oracle.mjs';

export async function runMobileBattleEffectsChecks(c) {
  const {report,evaluate,until,delay,checkpoint,key,button,tap,cityPoint,metrics,readSource,worldSource,mapReadySource,originalLibBytes,effectManifest,controls}=c;
  const {native,capture,ready,tileTap,menu,physicalKey}=controls;
  report.effectsAccepted=false;
  report.effectChecks=[];
  report.effectsViewport=report.effectsCase==='hd-missing'?[667,375]:[844,390];
  await metrics(...report.effectsViewport);await ready(1,'Current player PICK after effect viewport');
  // Read-only observers run after the real display callback. No native state,
  // clocks, RNG, input handlers or game getter results are changed.
  await evaluate(`(() => {
    const api=window.BayeHdSpe;if(!api||typeof api.onLcdFlush!=='function')throw Error('Mobile native SPE consumer missing');
    window.__mobileBattleEffects={phase:'spy',trace:[],reports:[],reportKeys:[],overflow:false};
    const original=api.onLcdFlush;
    const box=n=>{if(!n)return null;const r=n.getBoundingClientRect();let shown=r.width>0&&r.height>0;
      for(let q=n;q&&q.nodeType===1;q=q.parentElement){const s=getComputedStyle(q);if(q.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)shown=false;}
      const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {left:r.left,top:r.top,width:r.width,height:r.height,shown,hit:shown&&(top===n||n.contains(top)),
        backingWidth:n.width,backingHeight:n.height,pointerEvents:getComputedStyle(n).pointerEvents};};
    api.onLcdFlush=function(){try{return original.apply(this,arguments);}finally{
      const store=window.__mobileBattleEffects,d=baye.data;
      if(d.g_hdSpeActive||d.g_hdAttackActive||d.g_hdSkillResultActive||d.g_hdReportActive||d.g_hdResultOwnerKind){
        if(store.trace.length>=5000){store.overflow=true;}else{
          const s=baye.hd.spe(),a=baye.hd.attack(),r=baye.hd.skillResult(),ui=api.debugSnapshot();
          store.trace.push({at:performance.now(),phase:store.phase,fight:baye.hd.fight(),report:baye.hd.report(),
            spe:{active:s.active,id:s.id,kind:s.kind,generation:s.generation,eventId:s.eventId,display:s.display&&{
              generation:s.display.generation,eventId:s.display.eventId,commitSeq:s.display.commitSeq,frameIndex:s.display.frameIndex,
              visibleFrames:s.display.visibleFrames,aiTarget:s.display.aiTarget,statusEffect:s.display.statusEffect}},
            attack:a,skillResult:r,resultOwner:baye.hd.resultOwner(),
            ui:{open:ui.open,source:ui.source,reason:ui.fallbackReason,presentation:ui.presentation,mobilePresentation:api.getLcdPresentation(),mobileHost:ui.mobileHost,
              displayedFrames:ui.displayedFrames,sourceRect:ui.sourceRect,canvasW:ui.canvasW,canvasH:ui.canvasH,scale:ui.scale,ownerToken:ui.ownerToken,
              event:ui.event,flushKey:ui.flushKey,hdRegion:ui.hdRegion,outsideSource:ui.outsideSource},
            layers:{lcd:box(document.getElementById('lcd')),spe:box(document.getElementById('hd-spe-canvas')),
              battle:box(document.getElementById('hd-battle')),stage:box(document.getElementById('hd-mobile-stage')),body:document.body.getAttribute('data-hd-mobile-battle'),
              effect:document.body.getAttribute('data-hd-mobile-spe')},
            units:Array.from({length:20},(_,i)=>{const id=Number(d.g_FgtParam.GenArray[i]),p=d.g_GenPos[i];return {
              i,id,x:Number(p.x),y:Number(p.y),hp:Number(p.hp),mp:Number(p.mp),active:Number(p.active),state:Number(p.state),
              arms:id>0&&id<=200?Number(d.g_Persons[id-1].Arms):null,
              exp:id>0&&id<=200?Number(d.g_Persons[id-1].Experience):null};}),keys:__mobileMapKeys.length,touches:__mobileMapNativeTouches.length});
        }
      }
      if(store.phase==='spy'&&d.g_hdReportActive===1){const report=baye.hd.report(),k=report.seq+':'+report.inputSeq;
        if(!store.reportKeys.includes(k)){store.reportKeys.push(k);store.reports.push({observation:${battleObservation},world:${worldSource}});}}
    }};
    return true;
  })()`);
  const spyActor=(await native()).units.find(u=>u.i===0&&u.side==='player'&&u.active===0&&u.state===0);
  assert.ok(spyActor&&spyActor.mp>=10,'Actual ready 马腾 can pay original 谍报 cost');
  await tileTap(spyActor.x,spyActor.y,'Select actual spy caster');await ready(2,'spy MOVE');
  await tileTap(spyActor.x,spyActor.y,'Keep spy caster on own legal tile');await ready(3,'spy ACTION');
  await menu(1,'Open actual caster skill list');await ready(4,'spy SKILL');
  let skillState=await native();const skillIndex=skillState.skills.ids.indexOf(30);
  assert.ok(skillIndex>=0&&skillState.skills.names[skillIndex]==='谍报','Current original native skill ID30');
  while(skillState.menu.index!==skillIndex){await physicalKey(skillState.menu.index<skillIndex?'ArrowDown':'ArrowUp',skillState.menu.index<skillIndex?40:38);skillState=await native();}
  report.spy={before:skillState,world:await evaluate(worldSource),actorIndex:spyActor.i,skillId:30};
  await menu(skillIndex,'Cast actual 谍报 once');
  await until('natural spy effect and fresh player wait',`(() => {const f=baye.hd.fight();return f.active===1&&!f.over&&f.inputKind===1&&
    f.bout===${skillState.fight.bout}&&!baye.hd.report().active&&BayeHdMobileBattle.refresh().presentation==='hd';})()`,45000);
  report.spy.after=await capture('battle-effects-spy-retired');report.spy.worldAfter=await evaluate(worldSource);
  report.spy.reportObservations=await evaluate('__mobileBattleEffects.reports');report.spy.libBytes=originalLibBytes;
  report.spyVerdict=verifyMobileSpySkill(report.spy);delete report.spy.libBytes;
  assert.equal(report.spy.after.keys,report.spy.before.keys+1,'Only explicit original skill confirm; no automatic report ACK');
  report.effectChecks.push({label:'Native spy exact effect',verdict:report.spyVerdict});

  // Close the real distance using only the currently published movement path.
  // Never manufacture a target or claim a diagonal cavalry attack is legal.
  await evaluate("__mobileBattleEffects.phase='approach'");
  let attacked=false;
  report.attackApproach=[];
  for(let boutAttempt=0;boutAttempt<4&&!attacked;boutAttempt++){
    let current=await ready(1,'player wait before approach');
    const liveEnemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);
    assert.ok(liveEnemies.length,'Actual living original enemies');
    const dist=u=>Math.min(...liveEnemies.map(e=>Math.abs(e.x-u.x)+Math.abs(e.y-u.y)));
    const candidates=current.units.filter(u=>u.side==='player'&&u.active===0&&u.state===0&&u.arms>0).sort((a,b)=>dist(a)-dist(b)).slice(0,3);
    for(const candidate of candidates){
      current=await ready(1,'PICK for current attacker');const actor=current.units.find(u=>u.i===candidate.i);
      if(!actor||actor.active!==0||actor.state!==0||actor.arms===0)continue;
      await tileTap(actor.x,actor.y,'Select closest actual attacker '+actor.name);await ready(2,'actual attacker MOVE');
      const path=await evaluate(`(() => {const d=baye.data,f=baye.hd.fight(),out=[];for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++){
        const px=(x-Number(d.g_PathSX)+Number(d.g_PUseSX))&255,py=(y-Number(d.g_PathSY)+Number(d.g_PUseSY))&255;
        if(px<15&&py<15&&Number(d.g_FightPath[py*15+px])<=128)out.push({x,y});}return out;})()`);
      const enemies=current.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);
      const distance=p=>Math.min(...enemies.map(e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)));
      const destination=path.filter(p=>!current.units.some(u=>u.i!==actor.i&&u.state!==8&&u.x===p.x&&u.y===p.y)).sort((a,b)=>distance(a)-distance(b))[0];
      assert.ok(destination,'Actual original legal movement destination');
      await tileTap(destination.x,destination.y,'Approach enemy on current native path');await ready(3,'ACTION after real approach');
      await menu(0,'Open genuine ordinary attack AIM');await ready(5,'ordinary AIM');
      const aim=await native();assert.equal(aim.fight.aimType,0);
      const range=await evaluate('Array.from(baye.data.g_FgtAtkRng,Number)');
      const size=range[0],targets=aim.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0&&u.x>=range[1]&&u.y>=range[2]&&
        u.x<range[1]+size&&u.y<range[2]+size&&range[3+(u.y-range[2])*size+u.x-range[1]]===1);
      report.attackApproach.push({bout:aim.fight.bout,actor,destination,range,targets});
      if(!targets.length){await button('[data-hd-battle-cancel]');await ready(3,'Cancel AIM with no legal enemy');
        await menu(3,'Keep actual legal approach with one native rest');await ready(1,'Rested approach returns PICK');continue;}
      const target=targets[0];report.attack={before:aim,world:await evaluate(worldSource),actorIndex:actor.i,targetIndex:target.i};
      await evaluate("__mobileBattleEffects.phase='player-attack'");
      await tileTap(target.x,target.y,'Attack actual enemy in published native range');
      let shot=false;
      for(let sample=0;sample<1500;sample++){
        const status=await native();
        if(!shot&&await evaluate(`baye.hd.attack().active===true&&${report.effectsCase==='hd-missing'?'BayeHdSpe.getLcdPresentation()==="lcd"':'BayeHdSpe.isOpen()'}`)){await checkpoint('battle-effects-player-attack-display');shot=true;}
        if(status.fight.inputKind===1&&status.fight.active===1&&!status.fight.over&&!status.report.active&&status.mobile.presentation==='hd')break;
        if(sample===1499)throw Error('Ordinary attack did not retire into actual player wait');await delay(30);
      }
      assert.ok(shot,'Actual current attack display captured before native retirement');
      report.attack.after=await capture('battle-effects-player-attack-retired');report.attack.worldAfter=await evaluate(worldSource);
      const allTrace=await evaluate('__mobileBattleEffects.trace'),traces=allTrace.filter(t=>t.phase==='player-attack'&&t.attack.active===true&&t.attack.actorIndex===actor.i&&t.attack.targetIndex===target.i);
      assert.ok(traces.length,'Actual native attack session observed during LCD display');
      const session=traces[0].attack.session,generation=traces[0].attack.generation,hurt=traces[0].attack.hurt;
      assert.ok(Number.isInteger(hurt)&&hurt>=0);
      assert.ok(traces.every(t=>t.attack.session===session&&t.attack.generation===generation&&t.attack.hurt===hurt),'One exact original attack session');
      const beforeTarget=aim.units.find(u=>u.i===target.i),afterTarget=report.attack.after.units.find(u=>u.i===target.i),afterActor=report.attack.after.units.find(u=>u.i===actor.i),beforeActor=aim.units.find(u=>u.i===actor.i);
      assert.equal(beforeTarget.arms-afterTarget.arms,hurt,'Actual target soldier loss equals native hurt');
      assert.equal(afterTarget.hp,beforeTarget.hp,'Ordinary original attack leaves HP unchanged');
      assert.equal(afterActor.hp,beforeActor.hp);assert.equal(afterActor.mp,beforeActor.mp);assert.equal(afterActor.arms,beforeActor.arms);assert.equal(afterActor.active,1);
      assert.equal(report.attack.after.fight.bout,aim.fight.bout,'No AI turn attributed to this player attack');
      assert.equal(report.attack.after.keys,aim.keys+Math.abs(aim.fight.focusX-target.x)+Math.abs(aim.fight.focusY-target.y)+1,'Only explicit cursor/confirm keys for attack');
      assert.equal(report.attack.after.touches,aim.touches,'HD target sends no raw LCD touch');
      const displayed=traces.filter(t=>t.ui.open&&t.ui.source==='hd-assets'&&t.layers.spe.shown);
      if(report.effectsCase==='hd-missing'){
        assert.equal(displayed.length,0,'Controlled missing HD assets never display an old HD picture');
        const lcdSamples=traces.filter(t=>t.ui.mobilePresentation==='lcd'&&t.layers.lcd.hit);
        assert.ok(lcdSamples.length,'Missing original attack assets expose the physical LCD');
        for(const t of lcdSamples){const l=t.layers.lcd,s=t.layers.stage;
          assert.equal(t.ui.open,false);assert.equal(t.layers.spe.shown,false);assert.equal(l.pointerEvents,'auto');
          assert.ok(l.left>=s.left-1&&l.top>=s.top-1&&l.left+l.width<=s.left+s.width+1&&l.top+l.height<=s.top+s.height+1,'Physical LCD remains inside mobile stage');
          assert.ok(Math.abs(l.width/l.height-l.backingWidth/l.backingHeight)<.003,'Physical LCD preserves its original aspect ratio');}
        const a=traces[0].attack,entry=effectManifest.entries.find(e=>e.kind===3&&e.speId===a.speId&&e.resourceIndex===a.resourceIndex&&e.startFrm===a.startFrm&&e.endFrm===a.endFrm&&e.resourceFingerprint===a.resourceFingerprint);
        assert.ok(entry,'Exact original attack manifest entry');
        const used=new Set(entry.units.filter(u=>u.frame>=entry.startFrm&&u.frame<=entry.endFrm).map(u=>u.picIndex));
        const paths=entry.pictures.filter(p=>used.has(p.picIndex)).map(p=>p.src);
        report.attack.missingAssetRequests=report.requests.filter(r=>r.status===404&&r.controlled&&paths.includes(decodeURIComponent(new URL(r.url,'http://private').pathname).replace(/^\/+/,'')));
        assert.ok(report.attack.missingAssetRequests.length,'Actual PNG request 404 belongs to this native attack segment');
      }else assert.ok(displayed.length,'Actual original ordinary attack shown with mobile HD assets');
      for(const t of displayed){assert.equal(t.layers.lcd.hit,false,'HD effect owns display');assert.ok(t.layers.spe.width>0&&t.layers.spe.height>0);
        assert.equal(t.ui.mobilePresentation,'hd');
        const numeric=t.attack.phase==='numbers'||t.attack.phase==='hold',owner=numeric?'attack:'+generation+':'+session:t.spe.generation+':'+t.spe.eventId;
        assert.equal(t.ui.event,owner,'HD picture belongs to the current native effect owner');
        const d=numeric?t.attack.display:t.spe.display;
        assert.equal(t.ui.flushKey,numeric?owner+':'+d.paintSeq+':'+d.commitSeq:d.generation+':'+d.eventId+':'+d.commitSeq,'HD pixels bind the actual displayed commit');}
      report.attack.verdict={...verifyMobileNonlethalAttack({...report.attack,traces}),hdDisplays:displayed.length,
        nativePhases:[...new Set(traces.map(t=>t.attack.phase))],hdPhases:[...new Set(displayed.map(t=>t.attack.phase))],fullFramesAccepted:false};
      report.effectChecks.push({label:'Actual native attack damage and '+(report.effectsCase==='hd-missing'?'physical LCD missing-asset fallback':'mobile HD display'),verdict:report.attack.verdict});attacked=true;break;
    }
    if(!attacked){current=await ready(1,'Explicit turn after actual approach');await button('[data-hd-battle-sys]');await ready(6,'Actual approach SYSTEM');
      await menu(0,'Explicit one army end to close actual distance');
      await until('next real player bout for attack',`(() => {const f=baye.hd.fight();return f.active===1&&!f.over&&f.inputKind===1&&f.bout===${current.fight.bout+1}&&BayeHdMobileBattle.refresh().presentation==='hd';})()`,60000);}
  }
  assert.ok(attacked,'Normal attack reached by actual current movement and enemy turns');

  await evaluate("__mobileBattleEffects.phase='retreat'");
  report.battleCompletion={before:await native(),world:await evaluate(worldSource),successorChoices:[]};
  await button('[data-hd-battle-sys]');await ready(6,'Actual completion SYSTEM');await menu(1,'Request genuine retreat');await ready(7,'Actual retreat confirmation');
  await menu(0,'Confirm actual whole army retreat');
  for(let n=0;n<1800;n++){
    const s=await native(),m=s.menu;
    if(m.active===1&&m.context===5&&m.kind===1){assert.ok(m.idsValid&&m.ids.length>0,'Actual original successor list');
      const before=await evaluate(worldSource);report.battleCompletion.successorChoices.push({menu:m,world:before,chosenId:m.ids[m.index]});
      await key(39,'Choose actual displayed native successor');await delay(200);}
    if(s.fight.active===0&&!s.report.active&&await evaluate(mapReadySource))break;
    if(n===1799)throw Error('Actual battle settlement did not return to strategy map');await delay(50);
  }
  report.battleCompletion.after=await capture('battle-effects-genuine-settlement-map');report.battleCompletion.worldAfter=await evaluate(worldSource);
  assert.equal(report.battleCompletion.after.fight.active,0);assert.equal(report.battleCompletion.after.report.active,0);
  assert.equal(report.battleCompletion.after.nativeOver,2,'Actual whole-army retreat resolves as original LOSE');
  assert.equal(report.battleCompletion.worldAfter.orders[report.battleMarchVerdict.orderIndex].OrderId,255,'The exact original march order slot retired');
  assert.equal(report.battleCompletion.worldAfter.fighterIndex[report.battleMarchVerdict.slot],0,'The original army allocation was released');
  assert.ok(!report.battleCompletion.worldAfter.orders.some(o=>o.OrderId===27&&o.City===8&&o.Object===9),'Original processed march order retired');
  assert.equal(await evaluate('BayeHdSpe.isOpen()'),false,'Retired battle effects do not cover strategy map');
  report.effectChecks.push({label:'Real retreat settlement and strategy return',verdict:{accepted:true,successorChoices:report.battleCompletion.successorChoices.length}});
  // A visible map is insufficient: use a current owned city and return through
  // the actual native CITY owner after settlement, preserving the whole world.
  const city=await evaluate('BayeHdOverworld.getCities().filter(c=>c.kind==="owned").map(c=>({index:c.index,name:c.name,kind:c.kind,belong:c.belong}))[0]');
  assert.ok(city,'A genuine currently owned city remains after retreat');
  report.postBattleMap={city,before:await evaluate(readSource),world:await evaluate(worldSource)};
  await tap(await cityPoint(city));
  await until('Post-battle genuine CITY root',`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===1&&BayeHdCityMenu.debugSnapshot().cityIndex===${city.index};})()`);
  if(!await evaluate('BayeHdCityMenu.debugSnapshot().showHd'))await button('#hd-mobile-menu-mode');
  await until('Post-battle mobile HD city shell','BayeHdMobileCity.isActive()&&BayeHdCityMenu.debugSnapshot().open&&BayeHdCityMenu.debugSnapshot().showHd');
  report.postBattleMap.cityState=await checkpoint('battle-effects-post-settlement-city');
  const statusKeys=await evaluate('__mobileMapKeys.length');
  await button('#hd-city-menu [data-hd-root="3"]');
  await until('Post-battle current city readonly status','BayeHdCityMenu.debugSnapshot().layer==="status"&&BayeHdCityMenu.debugSnapshot().cityDetails');
  report.postBattleMap.statusState=await checkpoint('battle-effects-post-settlement-city-status');
  await button('#hd-city-menu [data-hd-menu-back]');
  await until('Post-battle readonly status returns to the same CITY root','BayeHdCityMenu.debugSnapshot().layer==="root"&&baye.hd.menuItems().active===1&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1');
  assert.equal(await evaluate('__mobileMapKeys.length'),statusKeys,'Readonly status and local return send no native key');
  const returnKeys=await evaluate('__mobileMapKeys.length');
  await button('#hd-city-menu [data-hd-menu-back]');
  await until('Post-battle city return restores current mobile map',mapReadySource);
  report.postBattleMap.after=await checkpoint('battle-effects-post-settlement-map');
  report.postBattleMap.worldAfter=await evaluate(worldSource);
  assert.deepEqual(report.postBattleMap.worldAfter,report.postBattleMap.world,'Post-battle city navigation preserves the entire measured world');
  assert.deepEqual(await evaluate(`__mobileMapKeys.slice(${returnKeys}).map(k=>k.code)`),[40],'Exactly one native EXIT returns from current city');
  assert.equal(report.postBattleMap.after.touchCount,report.postBattleMap.before.touchCount,'Post-battle HD city navigation sends no LCD touch');
  assert.equal(report.postBattleMap.after.hud.visible,true);assert.equal(report.postBattleMap.after.adapter.active,true);
  for(const [field,value] of Object.entries(report.postBattleMap.after.expected))assert.equal(report.postBattleMap.after.hud[field],value,'Restored HUD equals current native '+field);
  report.effectChecks.push({label:'Post-battle trusted owned-city entry and single native return',verdict:{accepted:true,cityIndex:city.index}});
  report.effectTrace=await evaluate('__mobileBattleEffects.trace');assert.equal(await evaluate('__mobileBattleEffects.overflow'),false);
  report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.equal(report.exceptions.length,0);
  report.effectsAccepted=true;report.ok=true;report.accepted=true;
  report.acceptedScope.push('Actual original 谍报 MP and exact natural outcome; ordinary attack damage bound to native session with '+(report.effectsCase==='hd-missing'?'controlled missing-asset physical LCD fallback':'mobile HD assets')+'; real retreat settlement and strategy return');
  report.pendingScope=['Other mobile attack/skill families and remaining fallback matrices','Classic-mode effects and visibility transitions','Android/iOS actual devices and performance','Full mobile HD/march acceptance and four-period full campaigns'];
}
