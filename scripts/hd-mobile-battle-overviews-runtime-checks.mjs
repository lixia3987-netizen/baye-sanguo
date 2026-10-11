// Real browser scenario only. Safe server, owned Chrome tree and source freeze belong to the caller.
import assert from 'node:assert/strict';
import {verifyMobileBattleHelp,verifyMobileBattleView,verifyMobileBattleViewTransition,verifyMobileBattleOverviewWorld,terrainFromNativeTile} from './hd-mobile-battle-overviews-runtime-oracle.mjs';

export async function runMobileBattleOverviewChecks(c){
  const {report,evaluate,until,delay,checkpoint,tap,touches,metrics,worldSource,originalLibBytes,native,ready,tileTap}=c;
  assert.ok(worldSource&&originalLibBytes&&native&&ready&&tileTap,'real bootstrap and opaque native reader are supplied');
  const width=Number(report.battleOverviewsWidth);assert.ok(width===844||width===667);const height=width===844?390:375;
  report.battleOverviewChecks=[];report.battleOverviewActions=[];report.battleOverviewNegatives=[];report.battleOverviewScrolls=[];
  const codes=async start=>(await evaluate(`__mobileMapKeys.slice(${start})`)).map(v=>v.code);
  const observation=`(() => {const d=baye.data,f=baye.hd.fight(),units=[],genArray=[],take=(o,ks)=>Object.fromEntries(ks.map(k=>[k,Number(o[k])]));
    for(let slot=0;slot<20;slot++){const id=Number(d.g_FgtParam.GenArray[slot]),p=d.g_GenPos[slot];genArray.push(id);
      const u={slot,...take(p,['x','y','hp','mp','move','active','state'])};if(id){u.personIndex=id-1;u.name=baye.getPersonName(id-1);u.person=take(d.g_Persons[id-1],['Level','Force','IQ','Experience','Arms','Belong']);u.armType=Number(baye.getArmType(id-1));}units.push(u);}
    const leaderNames=[0,10].map(i=>genArray[i]?baye.getPersonName(Number(d.g_Persons[genArray[i]-1].Belong)-1):'');
    const h=baye.hd.help(),v=baye.hd.view(),ticket=BayeHdDialog.getBattleInputTicket&&BayeHdDialog.getBattleInputTicket();
    const fullFight=baye.hd.fight();if(baye.data!==d||JSON.stringify(fullFight)!==JSON.stringify(f))throw Error('Torn battle detail sample');
    return {fight:f,detailGeneration:Number(d.g_hdDetailGeneration),help:h,view:v,units,genArray,leaderNames,mode:Number(d.g_FgtParam.Mode),playerFood:Number(d.g_FgtParam.MProvender),
      enemyKnownFood:Number(d.g_EneTmpProv),secretEnemyFood:Number(d.g_FgtParam.EProvender),maxLevel:Number(d.g_engineConfig.maxLevel),
      attack:{at:Number(d.g_GenAtt[0].at),df:Number(d.g_GenAtt[0].df)},map:Array.from({length:f.mapW*f.mapH},(_,i)=>Number(d.g_FightMapData[i])),
      ticket:ticket?{key:ticket.key,libraryGeneration:ticket.libraryGeneration,ownerType:ticket.ownerType,kind:ticket.kind,seq:ticket.seq,detailSeq:ticket.detailSeq,generation:ticket.generation}:null,
      mobile:BayeHdMobileBattle.debugSnapshot(),dialog:BayeHdDialog.debugSnapshot(),keys:__mobileMapKeys.length,touches:__mobileMapNativeTouches.length,
      pcBattle:localStorage.getItem('baye/battleMode'),events:__mobileMapEvents.length};})()`;
  const sample=async()=>{const s=await evaluate(observation);s.world=await evaluate(worldSource);return s;};
  const same=(a,b,label)=>{const verdict=verifyMobileBattleOverviewWorld({before:a,after:b});assert.equal(b.secretEnemyFood,a.secretEnemyFood,label+' actual concealed supply unchanged');return verdict;};
  const ownerSame=(a,b)=>{assert.deepEqual(b.fight,a.fight);assert.deepEqual(b.help,a.help);assert.deepEqual(b.view,a.view);};
  const geometrySource=selector=>`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const r=n.getBoundingClientRect();let left=0,top=0,right=innerWidth,bottom=innerHeight,shown=r.width>0&&r.height>0,scroller=null,scrollNode=null;const ownedStickyClips=[];
    for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p),a=p.getBoundingClientRect();if(p.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)shown=false;
      if(p!==n&&p!==document.body&&p!==document.documentElement){if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,a.left);right=Math.min(right,a.right);}if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,a.top);bottom=Math.min(bottom,a.bottom);}}
      if(!scroller&&/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+1){scrollNode=p;scroller={id:p.id,top:a.top,bottom:a.bottom,left:a.left,right:a.right,height:a.height,width:a.width,scrollTop:p.scrollTop,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight};}}
    if(scrollNode)for(const q of scrollNode.querySelectorAll('.hd-situation-actions')){if(q===n||q.contains(n))continue;const s=getComputedStyle(q),a=q.getBoundingClientRect();
      if(s.position!=='sticky'||q.hidden||s.display==='none'||s.visibility==='hidden'||a.width<=0||a.height<=0||a.right<=r.left||a.left>=r.right||a.bottom<=scroller.top||a.top>=scroller.bottom)continue;
      if(s.bottom==='0px'){bottom=Math.min(bottom,a.top);ownedStickyClips.push({className:q.className,edge:'bottom',top:a.top,bottom:a.bottom,left:a.left,right:a.right});}
      else if(s.top==='0px'){top=Math.max(top,a.bottom);ownedStickyClips.push({className:q.className,edge:'top',top:a.top,bottom:a.bottom,left:a.left,right:a.right});}}
    const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {selector:${JSON.stringify(selector)},shown,visible:shown&&r.left>=left-1&&r.right<=right+1&&r.top>=top-1&&r.bottom<=bottom+1,
      hit:!!hit&&(hit===n||n.contains(hit)),x,y,width:r.width,height:r.height,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},clip:{left,top,right,bottom},scroller,ownedStickyClips,disabled:!!n.disabled,target:hit&&(hit.id||hit.tagName)};})()`;
  const reveal=async(selector,label,{control=false}={})=>{
    let last;for(let i=0;i<16;i++){last=await evaluate(geometrySource(selector));if(last?.visible&&last.hit&&!last.disabled){if(control)assert.ok(last.width>=44&&last.height>=44,label+' >=44px');return last;}
      if(!last?.shown||!last.scroller){await until(label+' rendered and shown',`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return false;const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&!n.hidden;})()`,3000);last=await evaluate(geometrySource(selector));}
      if(last?.visible&&last.hit&&!last.disabled){if(control)assert.ok(last.width>=44&&last.height>=44);return last;}
      assert.ok(last?.scroller,label+' has a real scroll pane: '+JSON.stringify(last));assert.ok(!last.disabled,label+' current control is enabled');
      assert.ok(last.width<=last.clip.right-last.clip.left+2&&last.height<=last.clip.bottom-last.clip.top+2,label+' fits the actual unobstructed pane: '+JSON.stringify(last));
      if(last.visible&&!last.hit)throw Error(label+' blocked at its actual visible center: '+JSON.stringify(last));
      const before=await sample(),r=last.scroller,pan=panForProbe(last),x=Math.min(r.right-12,innerRight(last)),y=pan.startY;
      const end=y+pan.deltaY;await touches('touchStart',[{x,y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x,y:y+(end-y)*j/6}]);await touches('touchEnd');
      const after=await sample();same(before,after,label+' read-only pan');ownerSame(before,after);assert.deepEqual(await codes(before.keys),[]);
      report.battleOverviewScrolls.push({label,before:last,pan,after:await evaluate(geometrySource(selector)),keys:[],worldBefore:before.world,worldAfter:after.world});
    }throw Error(label+' never fully visible/hit: '+JSON.stringify(last));
  };
  const panForProbe=p=>{const down=p.rect.bottom>p.clip.bottom+1,deficit=down?p.rect.bottom-p.clip.bottom:p.clip.top-p.rect.top;
    assert.ok(deficit>0,'a real clipped edge determines pan direction');const available=p.clip.bottom-p.clip.top-32;assert.ok(available>=16,'real pane supports a touch pan');
    // Distance follows the measured edge error. Twelve CSS pixels cover touch slop, rather than jumping between scroll limits.
    const amount=Math.min(Math.max(16,deficit+12),available),startY=down?p.clip.bottom-16:p.clip.top+16;return {startY,deltaY:(down?-1:1)*amount,deficit};};
  const innerRight=p=>p.clip.right-12;
  const touchControl=async(selector,label)=>{const p=await reveal(selector,label,{control:true});const before=await sample();await tap({x:p.x,y:p.y});return {label,selector,point:p,before};};
  const detailReady=async(kind,label)=>{await until(label,`(() => {const f=baye.hd.fight(),p=${kind===9?'baye.hd.help()':'baye.hd.view()'},h=BayeHdMobileBattle.refresh(),t=BayeHdDialog.getBattleInputTicket&&BayeHdDialog.getBattleInputTicket();return f.active===1&&f.inputKind===${kind}&&p.active===1&&p.complete===1&&t&&t.kind===${kind}&&t.seq===f.inputSeq&&h.detailPresentation==='hd';})()`,10000);return sample();};
  const record=async(label,s,verdict)=>{report.battleOverviewChecks.push({label,sample:s,verdict});await checkpoint(label);return s;};
  const assertDomHelp=async s=>{
    if(s.help.kind===1){assert.equal(await evaluate(`document.querySelector('#hd-dialog-body .hd-help-name')?.textContent`),s.help.name);
      assert.equal(await evaluate(`document.querySelector('#hd-dialog-body .hd-help-summary')?.textContent`),s.help.arm+' · '+s.help.state);
      const fields=await evaluate(`[...document.querySelectorAll('#hd-dialog-body .hd-help-field')].map(n=>({label:n.querySelector('dt')?.textContent,value:n.querySelector('dd')?.textContent}))`);
      assert.deepEqual(fields.map(x=>x.label),['等级','武力','智力','经验','生命','技能点','攻击','防御','兵力']);
      assert.deepEqual(fields.map(x=>x.value),s.help.fields.slice(0,9).map((n,i)=>i===0&&s.help.levelMax?'MX':String(n)));
      for(let i=0;i<9;i++)await reveal(`#hd-dialog-body .hd-help-field:nth-child(${i+1})`,'HELP actual field '+i);
      await reveal('#hd-dialog-body .hd-help-name','HELP actual name');
    }else{const body=await evaluate(`document.querySelector('#hd-dialog-body')?.textContent`);assert.ok(body.includes(s.help.text));await reveal('#hd-dialog-body','HELP real terrain text');}
    await reveal('#hd-dialog [data-hd-dlg-back]','HELP return',{control:true});
  };
  const assertDomView=async s=>{
    const d=await evaluate(`(() => {const b=document.getElementById('hd-dialog-body');return {faction:b.querySelector('.hd-situation-faction')?.textContent,food:b.querySelector('.hd-situation-food')?.textContent,known:b.querySelector('.hd-situation-food')?.getAttribute('data-hd-view-food-known'),
      rows:[...b.querySelectorAll('.hd-situation-row')].map(n=>({slot:Number(n.dataset.hdViewSlot),personIndex:Number(n.dataset.hdViewPerson),name:n.querySelector('.hd-situation-name')?.textContent,arms:n.querySelector('.hd-situation-arms')?.textContent,text:n.getAttribute('aria-label')})),
      points:[...b.querySelectorAll('.hd-situation-dot')].map(n=>({slot:Number(n.dataset.hdViewSlot),personIndex:Number(n.dataset.hdViewPerson),x:Number(n.dataset.hdViewX),y:Number(n.dataset.hdViewY),left:parseFloat(n.style.left),top:parseFloat(n.style.top),player:n.classList.contains('is-player'),page:n.classList.contains('is-page')}))};})()`);
    assert.equal(d.faction,s.view.factionText);assert.equal(d.food,s.view.foodText);assert.equal(Number(d.known),s.view.foodKnown);
    assert.deepEqual(d.rows,s.view.rows.map(r=>({...r,arms:'兵 '+r.arms})));assert.equal(d.points.length,s.view.points.length);
    d.points.forEach((p,i)=>{const n=s.view.points[i];for(const k of ['slot','personIndex','x','y'])assert.equal(p[k],n[k]);assert.ok(Math.abs(p.left-(n.x+.5)/s.view.width*100)<1e-8);assert.ok(Math.abs(p.top-(n.y+.5)/s.view.height*100)<1e-8);assert.equal(p.player,n.slot<10);assert.equal(p.page,s.view.rows.some(r=>r.slot===n.slot&&r.personIndex===n.personIndex));});
    for(let i=0;i<s.view.rows.length;i++)await reveal(`#hd-dialog-body .hd-situation-row:nth-child(${i+1})`,'VIEW actual roster row '+i);
    await reveal('#hd-dialog-body .hd-situation-map','VIEW actual dot map');
    for(const key of [34,35,36,37])await reveal(`#hd-dialog [data-hd-view-key="${key}"]`,'VIEW navigation '+key,{control:true});
    await reveal('#hd-dialog [data-hd-dlg-back]','VIEW return',{control:true});
    return d;
  };
  const finish=async(kind,returnKind,label)=>{const a=await touchControl('#hd-dialog [data-hd-dlg-back]',label);await ready(returnKind,label+' restored native caller');const after=await sample();
    assert.deepEqual(await codes(a.before.keys),[40],label+' exactly one EXIT');assert.equal((kind===9?after.help:after.view).active,0);same(a.before,after,label);report.battleOverviewActions.push({...a,after,keys:[40]});return after;};
  const open=async(kind,label)=>{const selector=kind===9?'[data-hd-battle-help]':'[data-hd-battle-view]',a=await touchControl(selector,label),returnKind=a.before.fight.inputKind;
    assert.ok([1,2,5].includes(returnKind),'original FgtGetMsg caller only');const after=await detailReady(kind,label+' actual HD publication');assert.deepEqual(await codes(a.before.keys),[kind===9?38:51]);same(a.before,after,label);
    report.battleOverviewActions.push({...a,after,keys:[kind===9?38:51]});return {after,returnKind};};
  const negative=async(kind,type)=>{const selector='#hd-dialog [data-hd-dlg-back]',p=await reveal(selector,type,{control:true}),before=await sample();
    if(type==='touchcancel'){await touches('touchStart',[{x:p.x,y:p.y}]);await touches('touchCancel');}
    else if(type==='two-pointers'){await touches('touchStart',[{x:p.x,y:p.y,id:1}]);await touches('touchStart',[{x:p.x,y:p.y,id:1},{x:12,y:12,id:2}]);await touches('touchEnd');}
    else{await touches('touchStart',[{x:p.x,y:p.y}]);await metrics(375,667);await until('portrait actual LCD detail passthrough',`BayeHdMobileBattle.refresh().detailPresentation!=='hd'`);await metrics(width,height);await detailReady(kind,'restored current detail after portrait');await touches('touchEnd');}
    const after=await detailReady(kind,type+' remains same original detail');same(before,after,type);ownerSame(before,after);assert.deepEqual(await codes(before.keys),[]);report.battleOverviewNegatives.push({type,kind,before,after,keys:[]});};
  const modeRoundtrip=async kind=>{const before=await sample(),a=await touchControl('#hd-mobile-battle-toggle','detail classic mode');await until('actual classic detail',`BayeHdMobileBattle.refresh().detailPresentation==='lcd'`);
    const lcd=await evaluate(geometrySource('#lcd'));assert.ok(lcd?.visible&&lcd.hit,'genuine physical LCD visible and hit-testable');
    const b=await touchControl('#hd-mobile-battle-toggle','detail restore HD');const after=await detailReady(kind,'same detail restored HD');same(before,after,'mode-only presentation');ownerSame(before,after);assert.deepEqual(await codes(before.keys),[]);
    report.battleOverviewNegatives.push({type:'classic-HD',kind,before,after,keys:[],controls:[a.point,b.point],lcd});};

  await ready(1,'fresh PICK for independent mobile details');const initial=await sample();assert.equal(initial.touches,0);report.battleOverviewInitial=initial;
  const players=initial.units.filter(u=>initial.genArray[u.slot]&&u.state!==8&&u.slot<10),enemies=initial.units.filter(u=>initial.genArray[u.slot]&&u.state!==8&&u.slot>=10);
  assert.ok(players.length&&enemies.length);const targets=[players[0],enemies[0]];
  for(let i=0;i<targets.length;i++){
    const u=targets[i];await tileTap(u.x,u.y,'Focus genuine HELP person '+u.personIndex);await until('native person focus',`(() => {const f=baye.hd.fight();return [1,2].includes(f.inputKind)&&f.focusX===${u.x}&&f.focusY===${u.y};})()`);
    const {after:s,returnKind}=await open(9,'overview-help-person-'+i);const verdict=verifyMobileBattleHelp({sample:s,libBytes:originalLibBytes});assert.equal(s.help.person,u.personIndex);await assertDomHelp(s);
    if(i===0){await negative(9,'touchcancel');await negative(9,'two-pointers');await negative(9,'held-portrait');await modeRoundtrip(9);}
    await record('overview-help-person-'+i,await sample(),verdict);await finish(9,returnKind,'HELP single return');
    if(returnKind===2){const a=await touchControl('[data-hd-battle-cancel]','Return actual MOVE to PICK');await ready(1,'actual MOVE cancellation');assert.deepEqual(await codes(a.before.keys),[40]);same(a.before,await sample(),'MOVE cancel no movement');}
  }
  const now=await sample(),empty=[];for(let y=0;y<now.fight.mapH;y++)for(let x=0;x<now.fight.mapW;x++)if(!now.units.some(u=>now.genArray[u.slot]&&u.state!==8&&u.x===x&&u.y===y)&&terrainFromNativeTile(now.map[y*now.fight.mapW+x])<8)empty.push({x,y});
  empty.sort((a,b)=>(Math.abs(a.x-now.fight.focusX)+Math.abs(a.y-now.fight.focusY))-(Math.abs(b.x-now.fight.focusX)+Math.abs(b.y-now.fight.focusY)));assert.ok(empty.length);const terrain=empty[0];
  await tileTap(terrain.x,terrain.y,'Focus real unoccupied terrain');await ready(1,'empty tile remains native PICK');assert.equal((await sample()).fight.focusX,terrain.x);assert.equal((await sample()).fight.focusY,terrain.y);
  const th=await open(9,'overview-help-terrain');assert.equal(th.after.help.kind,2);await assertDomHelp(th.after);await record('overview-help-terrain',await sample(),verifyMobileBattleHelp({sample:th.after,libBytes:originalLibBytes}));await finish(9,1,'Terrain HELP single return');
  let opened=await open(10,'overview-view-enemy'),current=opened.after;assert.equal(current.view.force,1);assert.equal(current.view.pageStart,0);assert.equal(current.view.foodKnown,0);assert.equal(current.view.food,0);assert.ok(current.secretEnemyFood>0,'hidden actual enemy supply is nonzero');
  const viewRecord=async label=>{const s=await sample(),verdict=verifyMobileBattleView({sample:s,libBytes:originalLibBytes});const dom=await assertDomView(s);await record(label,s,{...verdict,dom});return s;};
  current=await viewRecord('overview-view-enemy-first');await negative(10,'touchcancel');await negative(10,'two-pointers');await negative(10,'held-portrait');await modeRoundtrip(10);
  const step=async(key,label)=>{const a=await touchControl(`#hd-dialog [data-hd-view-key="${key}"]`,label),before=a.before;
    await until(label+' native single-key ACK',`(() => {const v=baye.hd.view();return v.active===1&&v.seq!==${before.view.seq}&&v.inputSeq!==${before.view.inputSeq};})()`);
    const after=await detailReady(10,label+' current HD page');assert.deepEqual(await codes(before.keys),[key]);const transition=verifyMobileBattleViewTransition({before,after,key});same(before,after,label);report.battleOverviewActions.push({...a,after,keys:[key],transition});current=await viewRecord(label);return transition;};
  await step(34,'overview-enemy-top-boundary');
  while(current.view.pageStart<current.view.totalCount-current.view.pageSize)await step(35,'overview-enemy-next-'+current.view.pageStart);
  await step(35,'overview-enemy-bottom-boundary');await step(36,'overview-player-first');assert.equal(current.view.force,0);
  await step(34,'overview-player-top-boundary');assert.ok(current.view.totalCount>current.view.pageSize,'actual eight-player squad spans native pages');
  while(current.view.pageStart<current.view.totalCount-current.view.pageSize)await step(35,'overview-player-next-'+current.view.pageStart);
  await step(35,'overview-player-bottom-boundary');while(current.view.pageStart>0)await step(34,'overview-player-previous-'+current.view.pageStart);
  await step(37,'overview-enemy-reset');assert.equal(current.view.force,1);assert.equal(current.view.pageStart,0);await finish(10,opened.returnKind,'VIEW single return');
  const final=await sample();same(initial,final,'complete HELP/VIEW measured world');assert.equal(final.fight.inputKind,1);assert.equal(final.touches,0);
  report.battleOverviewFinal=final;report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.ok(report.trustedEvents.some(e=>e.trusted&&e.type==='pointerdown'));assert.equal(report.exceptions.length,0);
  report.battleOverviewsAccepted=true;report.battleAccepted=true;report.accepted=true;report.ok=true;
  report.acceptedScope=['Original mobile landscape HELP: two measured native persons, nine displayed fields and ten-field publication, plus actual empty terrain',
    'VIEW: both native sides, all current pages and boundary ACKs, concealed enemy grain, full current native point list',
    'Trusted HD buttons, actual scroll gestures, >=44px controls, cancel/two-pointer/held portrait retirement and classic-HD restoration, zero native LCD touches',
    'All recorded strategic fields and all twenty battle slots unchanged; own source/cleanup evidence belongs to safe caller'];
  report.pendingScope=['Physical Android/iOS devices, performance, full native ABI and full HD','Battle outcomes, effects or month settlement','Other HELP/VIEW configurations, maps or campaigns'];
  return {initial,final};
}
