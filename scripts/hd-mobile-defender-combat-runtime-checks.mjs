// Actual defensive play only; the caller owns the private browser and server.
import assert from 'node:assert/strict';
import {defenderNativeSource} from './hd-mobile-defender-runtime-checks.mjs';
import {battleObservation} from './hd-mobile-battle-runtime-checks.mjs';
import {verifyMobileDefenderSettlement} from './hd-mobile-defender-settlement-runtime-oracle.mjs';
import {campaignGeometrySource} from './hd-mobile-campaign-runtime-checks.mjs';
import {verifyMobileSuccessorChoice,verifyMobileSuccessorReport,verifyMobileSuccessorSettlement} from './hd-mobile-successor-runtime-oracle.mjs';

export function defenderCombatObserverSource(worldSource) {
  return `(() => {
    const store=window.__mobileDefenseCombat={outcomes:[],settlements:[],reports:[],successions:[],successorKeys:[],attacks:[],notes:[],overflow:false};
    const sample=()=>({world:${worldSource},native:${defenderNativeSource},battle:${battleObservation},at:performance.now()});
    const add=(name,value,limit=200)=>{if(store[name].length>=limit){store.overflow=true;return;}store[name].push(value);};
    const send=window.sendKey;window.sendKey=function(code){try{const m=baye.hd.menuItems();if(m.active===1&&m.context===5&&m.kind===1)add('successorKeys',{code,...sample()},100);}catch(e){store.error=String(e);}return send.apply(this,arguments);};
    const captureOutcome=()=>{try{const f=baye.hd.fight();if(!f.active&&f.over&&!store.outcomes.length)add('outcomes',sample(),4);}catch(e){store.error=String(e);}};
    const fight=BayeHdBattle.onEngineFight;BayeHdBattle.onEngineFight=function(){try{return fight.apply(this,arguments);}finally{captureOutcome();}};
    window.addEventListener('baye-hd-battle-settled',event=>{try{add('settlements',{receipt:{...event.detail},...sample()},200);}catch(e){store.error=String(e);}});
    window.addEventListener('baye-hd-successor-committed',event=>{try{add('successions',{receipt:{...event.detail},...sample()},20);}catch(e){store.error=String(e);}});
    const report=BayeHdDialog.onEngineReport;BayeHdDialog.onEngineReport=function(){try{return report.apply(this,arguments);}finally{try{
      const r=baye.hd.report();if(r.active&&!store.reports.some(s=>s.native.report.seq===r.seq&&s.native.report.inputSeq===r.inputSeq))add('reports',sample());
    }catch(e){store.error=String(e);}}};
    const spe=BayeHdSpe.onLcdFlush;BayeHdSpe.onLcdFlush=function(){try{return spe.apply(this,arguments);}finally{try{
      const a=baye.hd.attack();if(a.active&&!store.attacks.some(s=>s.attack.session===a.session&&s.attack.generation===a.generation))add('attacks',{attack:a,...sample()});
      const note=window.BayeHdBattleNote&&BayeHdBattleNote.debugSnapshot();
      if(note&&note.active&&!store.notes.some(s=>s.note.seq===note.seq))add('notes',{note,nativeNote:baye.hd.battleNote(),...sample()},100);
    }catch(e){store.error=String(e);}}};
    store.noteTimer=setInterval(()=>{try{const note=window.BayeHdBattleNote&&BayeHdBattleNote.debugSnapshot();
      if(note&&note.active&&!store.notes.some(s=>s.note.seq===note.seq))add('notes',{note,nativeNote:baye.hd.battleNote(),...sample()},20);
    }catch(e){store.error=String(e);}},16);return true;
  })()`;
}

export async function runMobileDefenderCombatChecks(c) {
  const {report,evaluate,until,delay,checkpoint,touches,tap,button,cityPoint,worldSource,mapReadySource,readKeys}=c;
  report.ok=false;report.accepted=false;report.defenderCombatAccepted=false;
  report.scope='Original mobile genuine incoming defense, trusted HD legal actions, natural battle result, synchronous native settlement and completed month return; no forced outcome/RNG or real-device/full-HD claim';
  report.defenderCombatActions=[];report.defenderCombatReports=[];
  report.defenderCombatSuccessorChoices=[];
  const sampleSource=`({world:${worldSource},native:${defenderNativeSource},battle:${battleObservation}})`;
  const sample=()=>evaluate(sampleSource),native=()=>evaluate(battleObservation);
  const capture=async label=>{const s=await sample();report.defenderChecks.push({label,...s});await checkpoint('defender-combat-'+report.defenderWidth+'-'+label);return s;};
  await evaluate(defenderCombatObserverSource(worldSource));
  report.defenderCombatInitial=await capture('01-first-pick');
  const sameWorld=async(before,label)=>{await delay(120);const after=await sample();assert.deepEqual(after.world,before.world,label+' complete recorded world');
    assert.deepEqual(after.native.battle,before.native.battle,label+' native units and grain');assert.deepEqual(after.native.fight,before.native.fight,label+' fight wait');
    assert.deepEqual(await readKeys(before.native.keys),[],label+' zero keys');assert.equal(after.native.touches,before.native.touches);return after;};
  const outcome=()=>evaluate('__mobileDefenseCombat.outcomes.length>0');
  const successor=async(before)=>{
    await until('Current authenticated HD post-defense successor',"(() => {const m=baye.hd.menuItems(),t=BayeHdDialog.getInputTicket();return m.active===1&&m.context===5&&m.kind===1&&m.idsValid&&t&&t.ownerType==='successor'&&BayeHdMobileCity.snapshot().dialogVisible;})()");
    const picker=await sample(),names=await evaluate('baye.hd.menuItems().ids.map(id=>baye.getPersonName(id))'),initial=verifyMobileSuccessorChoice({world:picker.world,menu:picker.native.menu,names});
    const index=initial.candidateIds.length>1?1:0,id=initial.candidateIds[index],selector='#hd-dialog [data-hd-successor-index="'+index+'"]';
    let geometry;for(let attempt=0;attempt<20;attempt++){
      geometry=await evaluate(campaignGeometrySource(selector));if(geometry?.shown&&geometry.visible&&!geometry.disabled&&geometry.hit)break;
      assert.ok(geometry?.shown&&!geometry.disabled&&geometry.scroller,'Current successor scrolling ancestor');
      const down=geometry.rect.bottom>geometry.clip.bottom+.5,deficit=down?geometry.rect.bottom-geometry.clip.bottom:geometry.clip.top-geometry.rect.top,available=geometry.clip.bottom-geometry.clip.top-32;
      assert.ok(deficit>0&&available>=16);const b=await sample(),amount=Math.min(Math.max(16,deficit+12),available),x=geometry.clip.right-12,y=down?geometry.clip.bottom-16:geometry.clip.top+16,delta=(down?-1:1)*amount;
      await touches('touchStart',[{x,y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x,y:y+delta*j/6}]);await touches('touchEnd');await sameWorld(b,'Post-defense successor pan');
    }
    assert.ok(geometry.hit&&geometry.visible&&geometry.width>=43.5&&geometry.height>=43.5);
    assert.equal(await evaluate(`Number(document.querySelector(${JSON.stringify(selector)}).getAttribute('data-hd-campaign-person'))`),id);
    const beforeChoice=await sample(),keyOffset=await evaluate('__mobileDefenseCombat.successorKeys.length');await tap(geometry);
    const sent=await readKeys(beforeChoice.native.keys),expected=[...Array(Math.abs(index-picker.native.menu.index)).fill(index<picker.native.menu.index?34:35),39];
    assert.deepEqual(sent.map(k=>k.code),expected,'Authenticated HD successor arrows and one confirm');
    await until('Actual post-defense successor committed',`__mobileDefenseCombat.successions.some(s=>s.receipt.generation===${picker.native.detailGeneration}&&s.receipt.oldKing===${picker.world.king}&&s.receipt.newKing===${id}&&s.receipt.playerKing===${id})`,30000);
    const observed=await evaluate('__mobileDefenseCombat'),confirmation=observed.successorKeys.slice(keyOffset).filter(s=>s.code===39);
    assert.equal(confirmation.length,1);assert.deepEqual(confirmation[0].world,picker.world);
    const choice=verifyMobileSuccessorChoice({world:picker.world,menu:confirmation[0].native.menu,names});assert.equal(choice.chosenId,id);assert.equal(choice.chosenIndex,index);
    const during=observed.reports.find(s=>s.world.king===id&&s.native.report.active===1&&s.native.report.text.startsWith(names[index]));
    const committed=observed.successions.find(s=>s.receipt.generation===picker.native.detailGeneration&&s.receipt.oldKing===picker.world.king&&s.receipt.newKing===id);
    assert.ok(during&&committed);const reportVerdict=verifyMobileSuccessorReport({before:picker.world,during:during.world,choice,report:during.native.report});
    const settlementVerdict=verifyMobileSuccessorSettlement({before:picker.world,after:committed.world,choice,receipt:committed.receipt});
    report.defenderCombatSuccessorChoices.push({picker,choice,geometry,keys:sent,during,committed,reportVerdict,settlementVerdict});
  };
  const ready=async(kind,label)=>{await until(label,`__mobileDefenseCombat.outcomes.length>0||(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot(),h=BayeHdMobileBattle.debugSnapshot();return f.active===1&&!f.over&&f.inputKind===${kind}&&!s.transaction&&h.presentation==='hd'&&BayeHdBattle.getInputTicket();})()`,60000);
    return await outcome()?null:native();};
  const tilePoint=async(x,y)=>{for(let attempt=0;attempt<20;attempt++){
    const s=await native(),v=s.mobile.camera;assert.ok(v&&v.cell>=44,'Actual mobile battle 44px cells');
    if(x>=v.x&&x<v.x+v.cols&&y>=v.y&&y<v.y+v.rows){const p={x:v.left+(x-v.x+.5)*v.cell,y:v.top+(y-v.y+.5)*v.cell};
      assert.equal(await evaluate(`document.elementFromPoint(${p.x},${p.y})===document.getElementById('hd-mobile-battle-canvas')`),true);return p;}
    const before=await sample(),r=s.canvas,px=r.left+r.width/2,py=r.top+r.height/2;
    const dx=x<v.x?120:x>=v.x+v.cols?-120:0,dy=y<v.y?90:y>=v.y+v.rows?-90:0;
    await touches('touchStart',[{x:px,y:py}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x:px+dx*j/6,y:py+dy*j/6}]);await touches('touchEnd');
    await sameWorld(before,'Actual readonly battle camera pan');
  }throw Error('Current battle tile could not be revealed');};
  const tile=async(x,y,label)=>{const before=await sample(),p=await tilePoint(x,y);await tap(p);
    const keys=await readKeys(before.native.keys),f=before.native.fight;
    assert.equal(keys.length,Math.abs(f.focusX-x)+Math.abs(f.focusY-y)+1,'Only current cursor path and one tile confirm');
    assert.equal(keys.at(-1).code,39);assert.ok(keys.slice(0,-1).every(k=>[34,35,36,37].includes(k.code)));
    report.defenderCombatActions.push({label,type:'trusted-current-tile',x,y,before,after:await sample(),keys});};
  const menu=async(index,label)=>{let geometry;for(let attempt=0;attempt<15;attempt++){
    geometry=await evaluate(`(() => {const n=document.querySelector('#hd-battle-menu [data-hd-battle-menu="${index}"]'),l=document.getElementById('hd-battle-menu-list');if(!n||!l)return null;
      const r=n.getBoundingClientRect(),a=l.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {visible:!n.disabled&&r.top>=a.top&&r.bottom<=a.bottom&&(h===n||n.contains(h)),width:r.width,height:r.height,targetTop:r.top,list:{left:a.left,top:a.top,width:a.width,height:a.height}};})()`);
    assert.ok(geometry,'Actual current native battle button');if(geometry.visible)break;
    const before=await sample(),r=geometry.list,down=geometry.targetTop>=r.top,x=r.left+r.width-12,y=r.top+r.height*(down?.8:.2),delta=r.height*.6*(down?-1:1);
    assert.ok(r.height>=44);await touches('touchStart',[{x,y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x,y:y+delta*j/6}]);await touches('touchEnd');await sameWorld(before,'Actual battle menu pan');
  }
    assert.ok(geometry.visible&&geometry.width>=44&&geometry.height>=44,'Unobstructed current 44px battle button');
    const before=await sample();assert.equal(before.native.menu.active,1);assert.ok(index<before.native.menu.count);
    await button('#hd-battle-menu [data-hd-battle-menu="'+index+'"]');
    const keys=await readKeys(before.native.keys),expected=[...Array(Math.abs(index-before.native.menu.index)).fill(index<before.native.menu.index?34:35),39];
    assert.deepEqual(keys.map(k=>k.code),expected,'Current battle menu arrows and one confirm');
    report.defenderCombatActions.push({label,type:'trusted-current-menu',index,geometry,before,keys,after:await sample()});
  };
  const max=report.defenderCombatInitial.battle.fight.boutMax;
  assert.ok(Number.isInteger(max)&&max>=1&&max<=100,'Bounded actual original battle day limit');
  for(let turn=0;turn<=max&&!await outcome();turn++){
    let pick=await ready(1,'Current actual defensive PICK');if(!pick)break;
    const bout=pick.fight.bout,candidates=pick.units.filter(u=>u.side==='player'&&u.active===0&&u.state===0&&u.arms>0);
    for(const candidate of candidates){
      pick=await ready(1,'Current defensive general');if(!pick)break;
      const actor=pick.units.find(u=>u.i===candidate.i);if(!actor||actor.active||actor.state||!actor.arms)continue;
      await tile(actor.x,actor.y,'Select actual defender '+actor.name);if(!await ready(2,'Current defensive MOVE'))break;
      const move=await native(),path=await evaluate(`(() => {const d=baye.data,f=baye.hd.fight(),out=[];for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++){
        const px=(x-Number(d.g_PathSX)+Number(d.g_PUseSX))&255,py=(y-Number(d.g_PathSY)+Number(d.g_PUseSY))&255;
        if(px<15&&py<15&&Number(d.g_FightPath[py*15+px])<=128)out.push({x,y});}return out;})()`);
      const enemies=move.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0);
      const distance=p=>Math.min(...enemies.map(e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y)));
      const destination=path.filter(p=>!move.units.some(u=>u.i!==actor.i&&u.state!==8&&u.x===p.x&&u.y===p.y)).sort((a,b)=>distance(a)-distance(b)||Math.abs(a.x-actor.x)+Math.abs(a.y-actor.y)-Math.abs(b.x-actor.x)-Math.abs(b.y-actor.y))[0];
      assert.ok(destination,'Actual native legal defense movement');await tile(destination.x,destination.y,'Move defender on actual published path');
      if(!await ready(3,'Current defensive ACTION'))break;
      await menu(0,'Open actual ordinary defense attack');if(!await ready(5,'Current defensive AIM'))break;
      const aim=await native(),range=await evaluate('Array.from(baye.data.g_FgtAtkRng,Number)'),size=range[0];
      const targets=aim.units.filter(u=>u.side==='enemy'&&u.state!==8&&u.arms>0&&u.x>=range[1]&&u.y>=range[2]&&u.x<range[1]+size&&u.y<range[2]+size&&range[3+(u.y-range[2])*size+u.x-range[1]]===1);
      if(targets.length){const target=targets.sort((a,b)=>a.arms-b.arms)[0];await tile(target.x,target.y,'Attack actual in-range enemy '+target.name);if(!await ready(1,'Actual defense attack retired'))break;}
      else{const before=await sample();await button('[data-hd-battle-cancel]');assert.deepEqual((await readKeys(before.native.keys)).map(k=>k.code),[40]);
        if(!await ready(3,'Cancel empty current defense aim'))break;await menu(3,'Rest actual defender after movement');if(!await ready(1,'Actual defensive rest retired'))break;}
    }
    if(await outcome())break;
    pick=await ready(1,'Current defensive turn end');if(!pick)break;
    await button('[data-hd-battle-sys]');if(!await ready(6,'Current defensive SYSTEM'))break;
    await menu(0,'End one genuine defensive army turn');
    await until('Next actual player bout or natural battle result',`__mobileDefenseCombat.outcomes.length>0||(() => {const f=baye.hd.fight();return f.active===1&&!f.over&&f.inputKind===1&&f.bout>${bout};})()`,90000);
    if(!await outcome())await capture('bout-'+(await native()).fight.bout+'-pick');
  }
  assert.equal(await outcome(),true,'Actual defense must reach its natural native battle result');
  await checkpoint('defender-combat-'+report.defenderWidth+'-02-native-outcome');
  const seen=new Set(),deadline=Date.now()+180000;let noteCaptured=false;
  while(Date.now()<deadline){
    const s=await sample(),n=s.native,m=n.menu,r=n.report,d=n.dialog;
    if(!noteCaptured&&await evaluate('window.BayeHdBattleNote&&BayeHdBattleNote.debugSnapshot().active')){
      const geometry=await evaluate(`(() => {const root=document.getElementById('hd-battle-note'),text=document.getElementById('hd-battle-note-text'),r=text.getBoundingClientRect(),style=getComputedStyle(text);let shown=true;
        for(let n=text;n;n=n.parentElement){const s=getComputedStyle(n);if(n.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)shown=false;}
        return {note:BayeHdBattleNote.debugSnapshot(),native:baye.hd.battleNote(),shown,text:text.textContent,fontSize:parseFloat(style.fontSize),
          rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},width:innerWidth,height:innerHeight,scrollWidth:text.scrollWidth,clientWidth:text.clientWidth,rootPointerEvents:getComputedStyle(root).pointerEvents};})()`);
      assert.ok(geometry.shown&&geometry.rect.width>0&&geometry.rect.height>0&&geometry.fontSize>=24);
      assert.ok(geometry.rect.left>=0&&geometry.rect.top>=0&&geometry.rect.right<=geometry.width&&geometry.rect.bottom<=geometry.height&&geometry.scrollWidth<=geometry.clientWidth);
      assert.equal(geometry.text,geometry.native.text);assert.equal(geometry.rootPointerEvents,'none');
      report.defenderCombatNoteGeometry={...geometry,nativeOwner:n.battle};
      await checkpoint('defender-combat-'+report.defenderWidth+'-native-result-note');noteCaptured=true;
    }
    if(m.active&&m.context===5){if(m.kind===1){await successor(s);continue;}throw Error('Further actual defensive battle requires separate verified handling');}
    const owner=d.reportOwner;
    if(r.active&&r.inputSeq>0&&d.open&&d.kind==='report'&&!d.pass&&owner&&owner.seq===r.seq&&owner.inputSeq===r.inputSeq){
      const token=r.seq+':'+r.inputSeq;if(!seen.has(token)){seen.add(token);await button('#hd-dialog [data-hd-dlg-ok]');
        const keys=await readKeys(n.keys);assert.deepEqual(keys.map(k=>k.code),[39],'One current post-battle report ACK');report.defenderCombatReports.push({before:s,keys});}
    }
    if(await evaluate(mapReadySource))break;
    if(Date.now()+100>=deadline)throw Error('Completed natural defensive month did not return to current MAP');await delay(100);
  }
  const final=await capture('03-completed-month-map');
  assert.equal(final.native.fight.active,0);assert.equal(final.native.report.active,0);
  const incoming=report.defenderPicker.verdict;
  report.defenderCombatObserver=await evaluate('clearInterval(__mobileDefenseCombat.noteTimer);__mobileDefenseCombat');
  const store=report.defenderCombatObserver;assert.equal(store.error,undefined);assert.equal(store.overflow,false);
  assert.equal(store.outcomes.length,1);
  const before=store.outcomes[0],settlements=store.settlements.filter(s=>s.receipt.generation===before.native.detailGeneration&&s.receipt.city===before.native.battle.cityIndex&&s.receipt.mode===0&&s.receipt.over===before.native.battle.over&&JSON.stringify(s.native.battle)===JSON.stringify(before.native.battle));
  assert.equal(settlements.length,1,'Exactly one matching real synchronous settlement receipt; retain unrelated NPC receipts');
  const after=settlements[0],receipt=after.receipt;
  const verdict=verifyMobileDefenderSettlement({before,after,receipt,events:{successions:store.successions,reports:store.reports}});
  const monthStart=report.defenderMonths.at(-1).before.world;
  assert.equal(after.world.year,monthStart.year,'Battle settlement precedes the original monthly date increment');
  assert.equal(after.world.month,monthStart.month);
  assert.equal(final.world.month,monthStart.month===12?1:monthStart.month+1,'Exactly the interrupted strategy month has now completed');
  assert.equal(final.world.year,monthStart.year+(monthStart.month===12?1:0));
  const orderIndex=verdict.orderIndex;assert.equal(orderIndex,report.defenderBattle.verdict.orderIndex,'Same original incoming defense order');
  assert.deepEqual(final.world.orders[orderIndex],{...after.world.orders[orderIndex],OrderId:255},'Exactly the incoming Order27 slot has retired');
  assert.equal(final.world.fighterIndex[verdict.armySlot],0,'Incoming army allocation remains released');
  assert.equal(await evaluate('BayeHdBattleNote.debugSnapshot().active'),false,'Native timed result note retired before map');
  assert.ok(noteCaptured&&store.notes.length>0,'Actual native victory/defeat note displayed in HD');
  assert.deepEqual(report.defenderCombatNoteGeometry.nativeOwner,before.native.battle,'The screenshot note belongs to this exact defensive result');
  for(const n of store.notes){assert.equal(n.note.presentation,'hd');assert.equal(n.note.seq,n.nativeNote.seq);assert.equal(n.note.text,n.nativeNote.text);assert.equal(n.note.outcome,n.nativeNote.outcome);}
  report.defenderCombatResult={before,after,receipt,incoming,final,verdict};
  const city=await evaluate('BayeHdOverworld.getCities().filter(c=>c.kind==="owned").map(c=>({index:c.index,name:c.name,kind:c.kind,belong:c.belong}))[0]');
  assert.ok(city,'A current owned city after genuine defensive settlement');const beforeBrowse=await sample();await tap(await cityPoint(city));
  await until('Genuine post-defense CITY root',`(() => {const m=baye.hd.menuItems();return m.active===1&&m.context===1&&m.kind===1&&Number(baye.data.g_hdMapCity)===${city.index+1}&&BayeHdCityMenu.debugSnapshot().showHd;})()`);
  await capture('04-post-defense-city');await button('#hd-city-menu [data-hd-root="3"]');
  await until('Post-defense actual city status','BayeHdCityMenu.debugSnapshot().layer==="status"&&BayeHdCityMenu.debugSnapshot().cityDetails');
  await capture('05-post-defense-status');const statusBack=await sample();await button('#hd-city-menu [data-hd-menu-back]');
  await until('Post-defense CITY root after status','BayeHdCityMenu.debugSnapshot().layer==="root"');assert.deepEqual(await readKeys(statusBack.native.keys),[],'Readonly status local return sends zero keys');
  const rootBack=await sample();await button('#hd-city-menu [data-hd-menu-back]');
  await until('Post-defense current HD MAP',mapReadySource);const afterBrowse=await capture('06-final-map');
  assert.deepEqual((await readKeys(rootBack.native.keys)).map(k=>k.code),[40],'One native CITY EXIT returns to current MAP');
  assert.deepEqual(afterBrowse.world,beforeBrowse.world,'Post-defense readonly city browsing preserves complete recorded world');
  report.defenderCombatBrowse={city,before:beforeBrowse,after:afterBrowse};
  report.nativeKeys=await readKeys();report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.equal(report.nativeTouches.length,0);assert.equal(report.exceptions.length,0);
  report.defenderCombatConsoleErrors=report.console.filter(e=>e.type==='error'&&(e.args||[]).some(a=>String(a.value||a.description||'').includes('window.onerror')));
  assert.deepEqual(report.defenderCombatConsoleErrors,[],'No handled window errors are hidden by the legacy game handler');
  report.pendingScope=['Other periods/cities and battle outcomes not observed in this batch; reuse of the incoming order slot during later monthly processing','Android/iOS devices, full visual frames, performance and complete HD'];
  report.acceptedScope.push('Genuine defensive legal HD movement/action and army turns to a natural battle result','Actual native timed result note rendered in HD and retired with native owner','Synchronous complete recorded defense settlement, exact incoming order retirement, completed monthly MAP and readonly city browsing');
  report.defenderCombatAccepted=true;report.ok=true;report.accepted=true;
}
