// Actual defensive play only; the caller owns the private browser and server.
import assert from 'node:assert/strict';
import {defenderNativeSource} from './hd-mobile-defender-runtime-checks.mjs';
import {battleObservation} from './hd-mobile-battle-runtime-checks.mjs';
import {battleHudObservation,battleResultNoteObservation,verifyBattleHud,verifyBattleResultNote} from './hd-battle-hud-runtime-checks.mjs';
import {verifyMobileDefenderSettlement,verifyMobileDefenderCampaignEnd} from './hd-mobile-defender-settlement-runtime-oracle.mjs';
import {campaignGeometrySource} from './hd-mobile-campaign-runtime-checks.mjs';
import {verifyMobileSuccessorChoice,verifyMobileSuccessorReport,verifyMobileSuccessorSettlement} from './hd-mobile-successor-runtime-oracle.mjs';

export function defenderCombatObserverSource(worldSource) {
  return `(() => {
    const store=window.__mobileDefenseCombat={outcomes:[],settlements:[],reports:[],successions:[],successorKeys:[],attacks:[],notes:[],watch:null,overflow:false};
    const sample=()=>({world:${worldSource},native:${defenderNativeSource},battle:${battleObservation},at:performance.now()});
    const add=(name,value,limit=200)=>{if(store[name].length>=limit){store.overflow=true;return;}store[name].push(value);};
    const send=window.sendKey;window.sendKey=function(code){try{const m=baye.hd.menuItems();if(m.active===1&&m.context===5&&m.kind===1)add('successorKeys',{code,...sample()},100);}catch(e){store.error=String(e);}return send.apply(this,arguments);};
    const captureOutcome=()=>{try{
      const f=baye.hd.fight(),d=baye.data,owner=store.watch;
      if(owner&&!f.active&&f.over&&d.g_FgtParam.Mode===0&&d.g_FgtParam.CityIndex===owner.city&&d.g_hdDetailGeneration===owner.generation){
        store.watch=null;
        add('outcomes',{ordinal:owner.ordinal,...sample()},30);
      }
    }catch(e){store.error=String(e);}};
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
  const {report,evaluate,until,delay,checkpoint,touches,tap,button,cityPoint,worldSource,mapReadySource,readKeys,continueDefense}=c;
  report.ok=false;report.accepted=false;report.defenderCombatAccepted=false;
  report.scope='Original incoming defenses within one strategy month, trusted HD actions, natural results and synchronous settlement';
  report.defenderCombatActions=[];report.defenderCombatReports=[];report.defenderCombatHud=[];
  report.defenderCombatSuccessorChoices=[];
  report.defenderCombatHandoffs=[];
  let ordinal=1,current={picker:report.defenderPicker,battle:report.defenderBattle};
  const sampleSource=`({world:${worldSource},native:${defenderNativeSource},battle:${battleObservation}})`;
  const sample=()=>evaluate(sampleSource),native=()=>evaluate(battleObservation);
  const recordHud=async(phase,options={})=>{
    const hud=await evaluate(battleHudObservation);
    report.defenderCombatHud.push({ordinal,phase,...hud});
    verifyBattleHud(hud,{mode:0,...options});
    if(options.visible!==false)assert.equal(hud.native.cityIndex,current.picker.verdict.cityIndex,'Same original city as the incoming order');
    return hud;
  };
  const phaseName=label=>'defender-combat-'+report.defenderWidth+'-'+(ordinal>1?'battle-'+ordinal+'-':'')+label;
  const capture=async label=>{const s=await sample();report.defenderChecks.push({ordinal,label,...s});await checkpoint(phaseName(label));return s;};
  await evaluate(defenderCombatObserverSource(worldSource));
  const sameWorld=async(before,label)=>{await delay(120);const after=await sample();assert.deepEqual(after.world,before.world,label+' complete recorded world');
    assert.deepEqual(after.native.battle,before.native.battle,label+' native units and grain');assert.deepEqual(after.native.fight,before.native.fight,label+' fight wait');
    assert.deepEqual(await readKeys(before.native.keys),[],label+' zero keys');assert.equal(after.native.touches,before.native.touches);return after;};
  const outcomeSource=()=> '__mobileDefenseCombat.outcomes.length>='+ordinal;
  const outcome=()=>evaluate(outcomeSource());
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
    report.defenderCombatSuccessorChoices.push({ordinal,picker,choice,geometry,keys:sent,during,committed,reportVerdict,settlementVerdict});
  };
  const ready=async(kind,label)=>{await until(label,`${outcomeSource()}||(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot(),h=BayeHdMobileBattle.debugSnapshot();return f.active===1&&!f.over&&f.inputKind===${kind}&&!s.transaction&&h.presentation==='hd'&&BayeHdBattle.getInputTicket();})()`,60000);
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
    report.defenderCombatActions.push({ordinal,label,type:'trusted-current-tile',x,y,before,after:await sample(),keys});};
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
    report.defenderCombatActions.push({ordinal,label,type:'trusted-current-menu',index,geometry,before,keys,after:await sample()});
  };
  async function playBattle(){
    const initial=current.battle.initial.native;
    await evaluate('__mobileDefenseCombat.watch='+JSON.stringify({ordinal,city:initial.battle.cityIndex,generation:initial.detailGeneration}));
    const first=await capture('01-first-pick');
    if(ordinal===1)report.defenderCombatInitial=first;
    assert.equal(first.native.fight.inputSeq,initial.fight.inputSeq);
    const max=first.battle.fight.boutMax;
    assert.ok(Number.isInteger(max)&&max>=1&&max<=100,'Bounded actual original battle day limit');
    for(let turn=0;turn<=max&&!await outcome();turn++){
      let pick=await ready(1,'Current actual defensive PICK');if(!pick)break;
      const bout=pick.fight.bout,candidates=pick.units.filter(u=>u.side==='player'&&u.active===0&&u.state===0&&u.arms>0);
      const hud=await recordHud('pick');assert.equal(hud.native.day,bout);
      if(turn===0)assert.equal(hud.native.food,initial.battle.playerFood,'Initial HUD grain matches the native defended city grain');
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
      if(turn===0)await recordHud('system',{settings:true,mobileFocus:true});
      await menu(0,'End one genuine defensive army turn');
      await until('Next actual player bout or natural battle result',`${outcomeSource()}||(() => {const f=baye.hd.fight();return f.active===1&&!f.over&&f.inputKind===1&&f.bout>${bout};})()`,90000);
      if(!await outcome())await capture('bout-'+(await native()).fight.bout+'-pick');
    }
    assert.equal(await outcome(),true,'Actual defense must reach its natural native battle result');
    await checkpoint(phaseName('02-native-outcome'));
    const before=await evaluate('__mobileDefenseCombat.outcomes['+(ordinal-1)+']');
    assert.equal(before.ordinal,ordinal);
    return before;
  }
  const seen=new Set(),monthStart=report.defenderMonths.at(-1).before.world;
  async function followResult(before){
    const expected=JSON.stringify(before.native.battle),over=before.native.battle.over;
    const deadline=Date.now()+180000;
    let geometry=null;
    while(Date.now()<deadline){
      const s=await sample(),n=s.native,m=n.menu,r=n.report,d=n.dialog;
      if(!geometry&&JSON.stringify(n.battle)===expected){
        const note=await evaluate(`(() => {
          const note=BayeHdBattleNote.debugSnapshot(),native=baye.hd.battleNote();
          if(!note.active||native.outcome!==${over})return null;
          const result=${battleResultNoteObservation};
          if(!result||result.note.seq!==note.seq)return null;
          const root=document.getElementById('hd-battle-note'),text=document.getElementById('hd-battle-note-text');
          const r=text.getBoundingClientRect(),style=getComputedStyle(text);let shown=true;
          for(let n=text;n;n=n.parentElement){
            const s=getComputedStyle(n);
            if(n.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)shown=false;
          }
          return {note,native,result,shown,text:text.textContent,fontSize:parseFloat(style.fontSize),
            rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
            width:innerWidth,height:innerHeight,scrollWidth:text.scrollWidth,clientWidth:text.clientWidth,
            rootPointerEvents:getComputedStyle(root).pointerEvents};
        })()`);
        if(note){
          verifyBattleResultNote(note.result,{outcome:over,kind:'defense',cityIndex:n.battle.cityIndex});
          assert.ok(note.shown&&note.rect.width>0&&note.rect.height>0&&note.fontSize>=24);
          assert.ok(note.rect.left>=0&&note.rect.top>=0&&note.rect.right<=note.width&&note.rect.bottom<=note.height&&note.scrollWidth<=note.clientWidth);
          assert.equal(note.text,note.native.text);assert.equal(note.rootPointerEvents,'none');
          geometry={...note,nativeOwner:n.battle};
          await checkpoint(phaseName('native-result-note'));
        }
      }
      if(m.active&&m.context===5&&m.kind===1){await successor(s);continue;}
      const owner=d.reportOwner;
      if(r.active&&r.inputSeq>0&&d.open&&d.kind==='report'&&!d.pass&&owner&&owner.seq===r.seq&&owner.inputSeq===r.inputSeq){
        const token=r.seq+':'+r.inputSeq;
        if(!seen.has(token)){
          seen.add(token);await button('#hd-dialog [data-hd-dlg-ok]');
          const keys=await readKeys(n.keys);
          assert.deepEqual(keys.map(k=>k.code),[39],'One current post-battle report ACK');
          report.defenderCombatReports.push({ordinal,before:s,keys});
        }
      }
      const nextPicker=m.active===1&&m.context===5&&m.kind===2;
      if(nextPicker||await evaluate(mapReadySource)){
        assert.ok(geometry,'Actual current battle result note displayed in HD');
        assert.equal(await evaluate('BayeHdBattleNote.debugSnapshot().active'),false,'Previous result note retired');
        return {geometry,nextPicker};
      }
      if(m.active===1&&m.context===4&&m.kind===1&&n.systemHost.active&&n.systemHost.owner?.seq===m.seq&&
        n.system.screen==='title'&&n.system.open&&n.system.showHd&&n.system.input?.seq===m.seq&&
        !n.system.pending&&!r.active&&r.text==='我军全军覆没'){
        assert.ok(geometry,'Actual final battle result note displayed in HD');
        const loss=await evaluate(`__mobileDefenseCombat.reports.find(s=>s.native.report.seq===${r.seq}&&
          s.native.report.text==='我军全军覆没')`);
        const title={menu:m,fight:n.fight,report:r,system:n.system,host:n.systemHost,
          note:await evaluate('BayeHdBattleNote.debugSnapshot()'),date:[s.world.year,s.world.month],king:s.world.king};
        const proof=verifyMobileDefenderCampaignEnd({loss,title,monthStart});
        await checkpoint(phaseName('03-campaign-loss-title'));
        return {geometry,nextPicker:false,campaignLoss:{loss,title,proof}};
      }
      await delay(100);
    }
    throw Error('Natural defense settlement did not reach the next picker, strategy map or original campaign ending');
  }

  const battles=[];
  let campaignLoss=null;
  for(;;){
    const before=await playBattle();
    const {geometry,nextPicker,campaignLoss:ending}=await followResult(before);
    battles.push({entry:current,before,geometry});
    if(!nextPicker){campaignLoss=ending||null;break;}

    await recordHud('next-defender-picker',{visible:false});
    const previous=current;
    ordinal++;
    assert.ok(ordinal<=30,'One strategy month has at most 30 native battle order slots');
    current=await continueDefense(ordinal);
    const old=previous.picker.verdict,live=current.picker.verdict;
    const world=current.picker.before.world;
    assert.equal(world.month,monthStart.month);
    assert.equal(world.year,monthStart.year);
    assert.ok(live.orderIndex>old.orderIndex,'PolicyExec reached a different later native order');
    assert.equal(world.orders[old.orderIndex].OrderId,255,'Previous order retired before the next defense');
    assert.equal(world.fighterIndex[old.armySlot],0,'Previous incoming allocation remains released');
    const previousKing=previous.picker.before.world.king;
    const succession=report.defenderCombatSuccessorChoices.find(s=>s.ordinal===ordinal-1);
    if(previousKing!==world.king){
      assert.equal(succession?.committed.receipt.newKing,world.king,'The new defense belongs to the committed successor');
    }
    report.defenderCombatHandoffs.push({
      from:{orderIndex:old.orderIndex,city:old.cityIndex,king:previousKing,attacker:previous.picker.attacker},
      to:{orderIndex:live.orderIndex,city:live.cityIndex,king:world.king,attacker:current.picker.attacker},
      successor:succession?.committed.receipt||null
    });
  }

  const final=campaignLoss?campaignLoss.loss:await capture('03-completed-month-map');
  assert.equal(final.native.fight.active,0);
  assert.equal(final.native.report.active,campaignLoss?1:0);
  await recordHud(campaignLoss?'campaign-loss-title':'completed-month-map',{visible:false});
  report.defenderCombatObserver=await evaluate('clearInterval(__mobileDefenseCombat.noteTimer);__mobileDefenseCombat');
  report.defenderObserver=await evaluate('clearInterval(__mobileDefender.fightTimer);__mobileDefender');
  const store=report.defenderCombatObserver;
  assert.equal(store.error,undefined);assert.equal(store.overflow,false);
  assert.equal(report.defenderObserver.error,undefined);assert.equal(report.defenderObserver.overflow,false);
  assert.equal(store.outcomes.length,battles.length);
  assert.equal(final.world.month,monthStart.month===12?1:monthStart.month+1,'Exactly the interrupted strategy month has now completed');
  assert.equal(final.world.year,monthStart.year+(monthStart.month===12?1:0));

  report.defenderCombatResults=battles.map(({entry,before,geometry})=>{
    const settlements=store.settlements.filter(s=>s.receipt.generation===before.native.detailGeneration&&
      s.receipt.city===before.native.battle.cityIndex&&s.receipt.mode===0&&s.receipt.over===before.native.battle.over&&
      JSON.stringify(s.native.battle)===JSON.stringify(before.native.battle));
    assert.equal(settlements.length,1,'Exactly one synchronous receipt for this defense');
    const after=settlements[0],receipt=after.receipt,incoming=entry.picker.verdict;
    const verdict=verifyMobileDefenderSettlement({before,after,receipt,events:{successions:store.successions,reports:store.reports}});
    assert.equal(after.world.year,monthStart.year);assert.equal(after.world.month,monthStart.month);
    const orderIndex=verdict.orderIndex;
    assert.equal(orderIndex,entry.battle.verdict.orderIndex,'Same original incoming defense order');
    assert.deepEqual(final.world.orders[orderIndex],{...after.world.orders[orderIndex],OrderId:255},'Exactly the incoming Order27 slot has retired');
    assert.equal(final.world.fighterIndex[verdict.armySlot],0,'Incoming army allocation remains released');
    const note=store.notes.find(n=>n.nativeNote.seq===geometry.native.seq&&n.nativeNote.generation===geometry.native.generation);
    assert.ok(note,'Observed timed note belongs to this result');
    assert.equal(note.note.presentation,'hd');assert.equal(note.note.seq,note.nativeNote.seq);
    assert.equal(note.note.text,note.nativeNote.text);assert.equal(note.note.outcome,before.native.battle.over);
    assert.deepEqual(geometry.nativeOwner,before.native.battle);
    return {before,after,receipt,incoming,verdict,geometry,entry};
  });
  report.defenderCombatResult={...report.defenderCombatResults[0],final};
  report.defenderCombatNoteGeometry=report.defenderCombatResults[0].geometry;
  report.defenderCombatTerminal=campaignLoss?{kind:'campaign-loss',...campaignLoss}:{kind:'map'};
  report.defenderChainAccepted=battles.length>1;
  if(report.defenderChain)assert.ok(report.defenderChainAccepted,'Two actual defensive battles must complete in one strategy month');
  if(!campaignLoss){
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
  }
  report.nativeKeys=await readKeys();report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.equal(report.nativeTouches.length,0);assert.equal(report.exceptions.length,0);
  report.defenderCombatConsoleErrors=report.console.filter(e=>e.type==='error'&&(e.args||[]).some(a=>String(a.value||a.description||'').includes('window.onerror')));
  assert.deepEqual(report.defenderCombatConsoleErrors,[],'No handled window errors are hidden by the legacy game handler');
  report.pendingScope=['Other periods/cities and battle outcomes not observed in this batch; reuse of the incoming order slot during later monthly processing','Android/iOS devices, full visual frames, performance and complete HD'];
  report.acceptedScope.push('Current original defense city, day, weather and player grain fit the HD battle HUD','Genuine defensive legal HD movement/action and army turns to a natural battle result','Actual native timed result note rendered in HD and retired with native owner','Synchronous complete recorded defense settlement, exact incoming order retirement and completed strategy month',
    campaignLoss?'Original campaign defeat report and authenticated return to title':'Completed monthly MAP and readonly city browsing');
  if(report.defenderChainAccepted)report.acceptedScope.push('Distinct original incoming orders and defender owners through repeated battles in the same strategy month');
  report.defenderCombatAccepted=true;report.ok=true;report.accepted=true;
}
