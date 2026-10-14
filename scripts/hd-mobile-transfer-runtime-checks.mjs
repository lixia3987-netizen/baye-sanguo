// Actual original native transfer waits; the shared runner owns private server/browser cleanup.
import assert from 'node:assert/strict';
import {calculateMobileTransferLimit,verifyMobileTransferReport,verifyMobileTransfer,verifyMobileTransferCancellation} from './hd-mobile-transfer-runtime-oracle.mjs';
import {checkMobileQuantityPresentation} from './hd-mobile-quantity-runtime-checks.mjs';

const next=n=>n===0xffffffff?1:n+1;
export async function runMobileTransferChecks(c) {
  const {report,evaluate,until,delay,checkpoint,ready,root,submenu,revealSubmenu,selectPerson,back,mapReturn,recruit,
    controlPoint,tap,touchButton,touches,readKeys,worldSame,testCity,mark,cityPoint,libBytes,label,mapReadySource}=c;
  const origin=testCity.index,target=15;
  assert.equal(origin,10);assert.equal(testCity.name,'长安');
  assert.equal(report.actualKing.name,'董卓');
  const destination=report.initialAllCities.find(x=>x.index===target);
  assert.ok(destination&&destination.name==='洛阳'&&destination.kind==='owned');
  const entry={label,origin,target,preparation:[],actions:[],cancellations:[],summaries:[],operations:[],accepted:false};report.transferChecks.push(entry);
  await evaluate(`(() => {window.__mobileTransferKeyTrace=[];const prior=window.sendKey;window.sendKey=function(code){const d=baye.data;__mobileTransferKeyTrace.push({keyIndex:__mobileMapKeys.length,code,transfer:baye.hd.transfer(),mapInputSeq:Number(d.g_hdMapInputSeq),cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety)}});return prior.apply(this,arguments);};})()`);
  const keys=async before=>(await readKeys(before.state.keyCount)).map(x=>x.code);
  const phaseSource=(phase,command)=>`(() => {const t=baye.hd.transfer(),s=BayeHdCityMenu.debugSnapshot();return t&&t.active===1&&t.command===${command}&&t.origin===${origin}&&t.phase===${phase}&&t.session>0&&t.inputSeq>0&&!s.sending&&!s.queueLen&&t;})()`;
  const phase=async(p,command=13)=>{await until('actual transfer phase '+p+' command '+command,phaseSource(p,command));return ready();};
  const revealTargetControl=async selector=>{
    const before=await ready();assert.equal(before.state.transfer.phase,6);
    const probe=`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;
      let list=n.parentElement;while(list&&list.id!=='hd-city-menu'){const c=getComputedStyle(list);if(/auto|scroll/.test(c.overflowY)&&list.scrollHeight>list.clientHeight+2)break;list=list.parentElement;}
      const b=n.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
      if(hit===n||n.contains(hit))return {visible:true};if(!list||list.id==='hd-city-menu')return {visible:false,scrollable:false};
      const r=list.getBoundingClientRect(),f=document.querySelector('#hd-city-menu .hd-city-menu-footer').getBoundingClientRect();
      return {visible:false,scrollable:true,id:list.id,scrollTop:list.scrollTop,target:{top:b.top,bottom:b.bottom},clip:{left:Math.max(0,r.left),right:Math.min(innerWidth,r.right),top:Math.max(0,r.top),bottom:Math.min(innerHeight,r.bottom,f.top)}};})()`;
    for(let step=0;step<=8;step++){
      const info=await until('current transfer target scroll control',probe,3_000);if(info.visible)return;
      assert.ok(info.scrollable&&info.id&&step<8,'Target control has bounded scroll access');
      const r=info.clip;assert.ok(r.right-r.left>=44&&r.bottom-r.top>=44);const down=info.target.bottom>r.bottom,x=r.right-12,y=r.top+(r.bottom-r.top)*(down?.75:.25),end=r.top+(r.bottom-r.top)*(down?.25:.75);
      assert.equal(await evaluate(`(() => {const l=document.getElementById(${JSON.stringify(info.id)}),n=document.elementFromPoint(${x},${y});return !!l&&!!n&&(l===n||l.contains(n));})()`),true);
      await touches('touchStart',[{x,y}]);for(let i=1;i<=6;i++)await touches('touchMove',[{x,y:y+(end-y)*i/6}]);await touches('touchEnd');await delay(150);
      const after=await ready();assert.deepEqual(await keys(before),[]);assert.deepEqual(after.native,before.native);worldSame(before,after,'Trusted target control reveal');
      const scrollTop=await evaluate(`document.getElementById(${JSON.stringify(info.id)}).scrollTop`);assert.notEqual(scrollTop,info.scrollTop);
      entry.actions.push({kind:'target-control-pan',selector,step,info,scrollTop});
    }
  };
  const visible=async selectors=>{
    const targetControl=selectors.find(s=>/data-hd-transfer-(cancel|confirm)/.test(s));if(targetControl)await revealTargetControl(targetControl);
    const selector=await until('current visible transfer control',`(() => {for(const s of ${JSON.stringify(selectors)}){const n=document.querySelector(s);if(!n||n.disabled)continue;let shown=true;for(let p=n;p;p=p.parentElement){const c=getComputedStyle(p);if(p.hidden||c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0)shown=false;}const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(shown&&r.width>0&&r.height>0&&(hit===n||n.contains(hit)))return s;}return null;})()`);
    return selector;
  };
  const click=async selectors=>{const selector=await visible(selectors),point=await controlPoint(selector);await tap(point);return {selector,point};};
  const noInput=async selectors=>{const before=await ready(),selector=await visible(selectors),point=await controlPoint(selector);await touches('touchStart',[point]);await touches('touchCancel');await delay(150);const after=await ready();assert.deepEqual(await keys(before),[]);assert.deepEqual(after.native,before.native);worldSame(before,after,'Cancelled transfer gesture');entry.actions.push({kind:'cancelled-gesture',before,after,selector,point});};
  const residentIds=w=>{const city=w.cities[origin];return w.queue.slice(city.PersonQueue,city.PersonQueue+city.Persons).filter(id=>w.people[id].Belong===city.Belong);};
  const currentPerson=async(command=13)=>{
    await phase(1,command);await until('complete current transfer PERSON presentation',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner;return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&s.open&&s.cityIndex===${origin}&&s.deepLabel===${JSON.stringify(command===13?'输送':'移动')}&&o&&o.seq===m.seq&&m.ids.every((id,i)=>s.deepItems.find(x=>x.i===i)?.pind===id);})()`);
    const sample=await ready();assert.deepEqual(sample.state.menu.ids,residentIds(sample.world));return sample;
  };
  const chooseActor=async(actor,command=13)=>{const before=await currentPerson(command),index=before.state.menu.ids.indexOf(actor);assert.ok(index>=0);await selectPerson(actor,command===13?'输送':'移动');
    const expected=[...Array(Math.abs(index-before.state.menu.index)).fill(index>before.state.menu.index?35:34),39];
    await phase(command===13?2:8,command);const after=await ready();assert.deepEqual(await keys(before),expected);assert.equal(after.state.transfer.person,actor);
    entry.actions.push({kind:'select-person',command,actor,before,after,keys:expected});return {before,after};};
  const quantity=async p=>{
    await phase(p);await until('current transfer quantity ACK and presentation',`(() => {const q=baye.hd.qty(),p=BayeHdCityMenu.getTransferPresentation();return q.active===1&&q.protocol&&q.ready===1&&BayeHdCityMenu.isQtyLive()&&p&&p.phase===${p};})()`);
    const sample=await ready(),q=sample.state.qty,city=sample.world.cities[origin],expectedMax=city[p===2?'Food':p===3?'Money':'MothballArms'];
    assert.equal(q.min,0);assert.equal(q.max,expectedMax);assert.equal(q.value,q.max);return sample;
  };
  const summary=async p=>{
    const s=await ready(),t=await evaluate('BayeHdCityMenu.getTransferPresentation()');assert.ok(t&&t.phase===p&&t.origin===origin&&t.person===s.state.transfer.person);
    const geometry=await checkMobileQuantityPresentation(evaluate,label+' phase '+p);entry.summaries.push({phase:p,presentation:t,geometry});return s;
  };
  const editTwo=async p=>{
    const initial=await quantity(p);assert.ok(initial.state.qty.max>=2);await summary(p);
    for(const [selectors,key,value] of [[['#hd-dialog [data-hd-qty-bound]','#hd-city-menu [data-hd-qty-bound]'],38,0],
      [['#hd-dialog [data-hd-qty="1"]','#hd-city-menu [data-hd-qty="1"]'],34,1],[['#hd-dialog [data-hd-qty="1"]','#hd-city-menu [data-hd-qty="1"]'],34,2]]) {
      const before=await ready(),q=before.state.qty,control=await click(selectors);
      await until('current transfer quantity exact native ACK',`(() => {const q=baye.hd.qty();return q.active===1&&q.ready===1&&q.session===${q.session}&&q.inputSeq===${next(q.inputSeq)}&&q.lastKey===${key}&&q.value===${value};})()`);
      const after=await ready();assert.deepEqual(await keys(before),[key]);worldSame(before,after,'Uncommitted transfer quantity edit');entry.actions.push({kind:'quantity-edit',phase:p,key,value,before,after,...control});
    }
    await summary(p);return ready();
  };
  const confirmQuantity=async(p,nextPhase)=>{
    const before=await ready();assert.equal(before.state.transfer.phase,p);assert.equal(before.state.qty.value,2);const control=await click(['#hd-dialog [data-hd-dlg-ok]','#hd-city-menu [data-hd-qty-ok]']);
    const after=await phase(nextPhase);assert.deepEqual(await keys(before),[39]);worldSame(before,after,'Confirmed cargo selection still uncommitted');
    assert.equal(after.state.transfer[p===2?'food':p===3?'money':'arms'],2);entry.actions.push({kind:'quantity-confirm',phase:p,before,after,...control});return after;
  };
  const cancelQuantity=async(p,nextPhase)=>{
    const before=await quantity(p);await click(['#hd-dialog [data-hd-dlg-back]','#hd-city-menu [data-hd-qty-cancel]','#hd-city-menu [data-hd-menu-back]']);const after=nextPhase===1?await currentPerson():await quantity(nextPhase);
    assert.deepEqual(await keys(before),[40]);verifyMobileTransferCancellation({before:before.world,after:after.world,libBytes});
    assert.equal(after.state.transfer.session,before.state.transfer.session);assert.notEqual(after.state.transfer.inputSeq,before.state.transfer.inputSeq);
    if(nextPhase===1)assert.equal(after.state.menu.index,0);entry.cancellations.push({kind:'quantity',phase:p,nextPhase,before,after,keys:[40]});return after;
  };
  const reportContinue=async(command,p,before=null)=>{
    await phase(p,command);await until('current native transfer report and HD continue',`(() => {const r=baye.hd.report();return r.active===1&&r.kind===2&&r.seq>0&&r.inputSeq>0;})()`);
    const during=await ready();assert.equal(during.state.transfer.phase,p);assert.equal(during.state.report.person,p===5&&command===14?during.world.king:during.state.transfer.person);
    if(before)entry.pendingReport={before,during,oracle:verifyMobileTransferReport({before:before.world,during:during.world,cityIndex:origin,targetCityIndex:target,personId:during.state.transfer.person,operation:command===13?'transport':'move',...(command===13?{cargo:{food:2,money:2,arms:2}}:{}),sourceCursor:command===13?before.state.cursor:entry.moveSourceCursor,targetCursor:during.state.cursor,libBytes})};
    const control=await click(['#hd-city-menu [data-hd-transfer-continue]','#hd-dialog [data-hd-dlg-ok]']);
    await until('matching report no longer active',`(() => {const r=baye.hd.report();return r.active!==1||r.seq!==${during.state.report.seq}||r.inputSeq!==${during.state.report.inputSeq};})()`);
    const after=await ready();assert.deepEqual(await keys(during),[39]);entry.actions.push({kind:'report-continue',command,phase:p,during,after,...control});return {during,after};
  };
  const targetReady=async(command=13)=>{
    await phase(6,command);await until('distinct active transfer target with shared map',`(() => {const t=BayeHdCityMenu.getTransferTargetTicket(),m=BayeHdMobileMap.refresh();return t&&m.active&&m.ownerType==='transfer-target'&&document.body.classList.contains('hd-mobile-transfer-target-on');})()`);
    const s=await ready();assert.equal(s.state.hud.visible,false);assert.equal(s.state.march.battlePick,0);return s;
  };
  const cancelTarget=async(command=13)=>{
    const before=await targetReady(command);const control=await click(['#hd-city-menu [data-hd-transfer-cancel]']);
    const after=command===13?await quantity(4):await currentMap();assert.deepEqual(await keys(before),[40]);verifyMobileTransferCancellation({before:before.world,after:after.world,libBytes});entry.cancellations.push({kind:'target',command,before,after,keys:[40],...control});return after;
  };
  const selectTarget=async(command=13)=>{
    const before=await targetReady(command),p=await cityPoint(destination,`(() => {const t=BayeHdCityMenu.getTransferTargetTicket(),m=BayeHdMobileMap.refresh();return !!t&&t.command===${command}&&t.phase===6&&m.active&&m.ownerType==='transfer-target'&&BayeHdOverworld.debugSnapshot().presentationReady;})()`);await tap(p,true);
    await until('touch selects target without sending native input',`(() => {const p=BayeHdCityMenu.getTransferPresentation();return p&&p.pendingTarget===${target};})()`);
    const after=await ready();assert.deepEqual(await keys(before),[]);worldSame(before,after,'Target preview');assert.deepEqual(after.native,before.native);entry.actions.push({kind:'target-preview',command,before,after,point:p});return after;
  };
  const currentMap=async()=>{
    await until('transfer ended into actual ordinary MAP',`(() => {const t=baye.hd.transfer(),s=BayeHdCityMenu.debugSnapshot(),m=baye.hd.menuItems();return t&&t.active===0&&t.phase===9&&!s.open&&!s.sending&&!s.queueLen&&!m.active&&!baye.hd.qty().active&&!baye.hd.report().active;})()`);
    await until('current HD MAP and HUD restored',mapReadySource);const sample=await ready();for(const [k,v] of Object.entries(sample.state.expected))assert.equal(sample.state.hud[k],v);return sample;
  };
  const openTransport=async()=>{await root(0,'内政');await submenu('输送');return currentPerson();};
  const openMove=async()=>{
    await root(0,'内政');const before=await ready(),index=before.state.menu.names.indexOf('移动');assert.equal(index,13);
    const selector=`#hd-city-menu [data-hd-sub="${index}"]`;await revealSubmenu(selector,before);await touchButton(selector);await phase(5,14);
    const after=await ready();worldSame(before,after,'Open actual move command');assert.deepEqual(await keys(before),[...Array(Math.abs(index-before.state.menu.index)).fill(index>before.state.menu.index?35:34),39]);return after;
  };
  const commitTarget=async(command,actor,before)=>{
    const sample=await targetReady(command),control=await click(['#hd-city-menu [data-hd-transfer-confirm]']);
    await phase(command===13?8:1,command);const after=await ready();const emitted=await keys(sample);assert.equal(emitted.filter(k=>k===39).length,1);assert.ok(emitted.every(k=>[34,35,36,37,39].includes(k)));
    if(command===14){entry.moveSourceCursor=sample.state.cursor;entry.moveTargetCursor=after.state.cursor;}
    const trace=await evaluate(`__mobileTransferKeyTrace.filter(x=>x.keyIndex>=${sample.state.keyCount}&&x.keyIndex<${after.state.keyCount})`);
    const cursor={...sample.state.cursor};assert.equal(trace.length,emitted.length);for(const row of trace){assert.deepEqual(row.cursor,cursor,'Prior target step is acknowledged before next input');assert.equal(row.transfer.session,sample.state.transfer.session);assert.equal(row.transfer.phase,6);assert.equal(row.mapInputSeq,sample.state.march.mapInputSeq);if(row.code===34)cursor.y--;else if(row.code===35)cursor.y++;else if(row.code===36)cursor.x--;else if(row.code===37)cursor.x++;}
    assert.deepEqual(after.state.cursor,cursor,'Target ENTER observes the fully acknowledged actual cursor');
    entry.actions.push({kind:'target-confirm',command,actor,before:sample,after,keys:emitted,trace,...control});if(command===14)worldSame(sample,after,'Move target selection');return after;
  };

  // Establish a real nonzero reserve using the existing exact native recruitment oracle.
  await recruit(label+'-reserve-preparation');await mapReturn('recruitment preparation');entry.preparation.push(report.recruitments.at(-1));
  let person=await openTransport();const transporter=person.state.menu.ids.slice(1).find(id=>id!==person.world.king&&person.world.people[id].Thew>=8);assert.ok(Number.isInteger(transporter));
  entry.transporter=transporter;entry.baseline=person;await chooseActor(transporter);await cancelQuantity(2,1);
  await chooseActor(transporter);await editTwo(2);await confirmQuantity(2,3);await cancelQuantity(3,2);
  await editTwo(2);await confirmQuantity(2,3);await editTwo(3);await confirmQuantity(3,4);await cancelQuantity(4,3);
  await editTwo(3);await confirmQuantity(3,4);await editTwo(4);await confirmQuantity(4,5);await reportContinue(13,5);await targetReady();await noInput(['#hd-city-menu [data-hd-transfer-cancel]']);await checkpoint(label+'-transport-target-cancel');await cancelTarget();
  await editTwo(4);await confirmQuantity(4,5);await reportContinue(13,5);await selectTarget();await checkpoint(label+'-transport-target');
  const beforeTransport=await ready();
  await commitTarget(13,transporter,beforeTransport);const transportReport=await reportContinue(13,8,beforeTransport);const transported=await currentMap();
  const transportLimit=calculateMobileTransferLimit({world:beforeTransport.world,cityIndex:origin,targetCityIndex:target,personId:transporter,operation:'transport',sourceCursor:beforeTransport.state.cursor,targetCursor:transportReport.during.state.cursor,libBytes});
  const transportOracle=verifyMobileTransfer({before:beforeTransport.world,during:transportReport.during.world,after:transported.world,cityIndex:origin,targetCityIndex:target,personId:transporter,operation:'transport',cargo:{food:2,money:2,arms:2},outcome:'queued',sourceCursor:beforeTransport.state.cursor,targetCursor:transportReport.during.state.cursor,libBytes});
  entry.operations.push({operation:'transport',actor:transporter,before:beforeTransport,during:transportReport.during,after:transported,limit:transportLimit,oracle:transportOracle});await checkpoint(label+'-transport-map');

  await openMove();await reportContinue(14,5);await targetReady(14);await checkpoint(label+'-move-target-cancel');await cancelTarget(14);
  await openMove();await reportContinue(14,5);await selectTarget(14);await checkpoint(label+'-move-target');await commitTarget(14,null,null);
  person=await currentPerson(14);const mover=person.state.menu.ids.find(id=>id!==person.world.king&&person.world.people[id].Thew>=8);assert.ok(Number.isInteger(mover)&&mover!==transporter);entry.mover=mover;
  const beforeMove=await ready(),moveLimit=calculateMobileTransferLimit({world:beforeMove.world,cityIndex:origin,targetCityIndex:target,personId:mover,operation:'move',sourceCursor:entry.moveSourceCursor,targetCursor:entry.moveTargetCursor,libBytes});await chooseActor(mover,14);
  const moveReport=await reportContinue(14,8,beforeMove),moved=await currentPerson(14);assert.ok(!moved.state.menu.ids.includes(mover));
  const moveOracle=verifyMobileTransfer({before:beforeMove.world,during:moveReport.during.world,after:moved.world,cityIndex:origin,targetCityIndex:target,personId:mover,operation:'move',outcome:'queued',sourceCursor:entry.moveSourceCursor,targetCursor:moveReport.during.state.cursor,libBytes});
  entry.operations.push({operation:'move',actor:mover,before:beforeMove,during:moveReport.during,after:moved,limit:moveLimit,oracle:moveOracle});await checkpoint(label+'-move-next-person');
  const beforeExit=await ready();await back('leave actual move PERSON');const returned=await currentMap();verifyMobileTransferCancellation({before:beforeExit.world,after:returned.world,libBytes});assert.deepEqual(await keys(beforeExit),[40]);entry.cancellations.push({kind:'move-person',before:beforeExit,after:returned,keys:[40]});
  entry.keyTrace=await evaluate('__mobileTransferKeyTrace');entry.returned=returned;entry.accepted=true;return entry;
}
