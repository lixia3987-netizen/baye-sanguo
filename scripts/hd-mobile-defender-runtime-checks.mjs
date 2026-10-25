// Genuine original monthly defense only. Browser/process ownership belongs to the caller.
import assert from 'node:assert/strict';
import {campaignNativeSource,campaignGeometrySource} from './hd-mobile-campaign-runtime-checks.mjs';
import {verifyMobileDefenderPicker,verifyMobileDefenderSelection,verifyMobileDefenderBattle} from './hd-mobile-defender-runtime-oracle.mjs';

export const defenderNativeSource=`(() => {const n=${campaignNativeSource};return {...n,battle:{...n.battle,mainGenIndex:Number(baye.data.g_MainGenIdx)}};})()`;

export function defenderObserverSource(worldSource) {
  return `(() => {
    const store=window.__mobileDefender={keys:[],fights:[],reports:[],overflow:false};
    const sample=()=>({world:${worldSource},native:${defenderNativeSource},at:performance.now()});
    const add=(list,value,limit)=>{if(list.length>=limit){store.overflow=true;return;}list.push(value);};
    const send=window.sendKey;window.sendKey=function(code){try{const m=baye.hd.menuItems();
      if(m.active===1&&m.context===5&&m.kind===2)add(store.keys,{code,...sample()},100);
    }catch(e){store.error=String(e);}return send.apply(this,arguments);};
    const observeFight=()=>{try{
      const f=baye.hd.fight(),d=baye.data;if(f.active===1&&f.over===0&&f.inputKind===1&&Number(d.g_FgtParam.Mode)===0&&Number(d.g_MainGenIdx)===10&&
        !store.fights.some(s=>s.native.detailGeneration===Number(d.g_hdDetailGeneration)&&s.native.battle.cityIndex===Number(d.g_FgtParam.CityIndex)&&s.native.fight.inputSeq===f.inputSeq))add(store.fights,sample(),12);
    }catch(e){store.error=String(e);}};
    const fight=BayeHdBattle.onEngineFight;if(typeof fight!=='function')throw Error('Native fight callback unavailable');
    BayeHdBattle.onEngineFight=function(){try{return fight.apply(this,arguments);}finally{observeFight();}};
    // PICK is published independently of fight activation; read the actual wait
    // without injecting an ACK or claiming this poll is a synchronous C event.
    store.fightTimer=setInterval(observeFight,16);
    const report=BayeHdDialog.onEngineReport;if(typeof report!=='function')throw Error('Native report callback unavailable');
    BayeHdDialog.onEngineReport=function(){try{return report.apply(this,arguments);}finally{try{const r=baye.hd.report();
      if(r.active===1&&!store.reports.some(s=>s.seq===r.seq&&s.inputSeq===r.inputSeq))add(store.reports,{...r,at:performance.now()},200);
    }catch(e){store.error=String(e);}}};return true;
  })()`;
}

export async function runMobileDefenderChecks(c) {
  const {report,evaluate,until,delay,checkpoint,metrics,touches,tap,buttonPoint,button,readSource,worldSource,mapReadySource,readKeys,sendCdp}=c;
  const width=report.defenderWidth,size=[width,width===667?375:390],K={UP:34,DOWN:35,ENTER:39,EXIT:40};
  const preferences="Object.fromEntries(['baye/overworldMode','baye/cityMenuMode','baye/battleMode','baye/systemUiMode'].map(k=>[k,localStorage.getItem(k)]))";
  const sampleSource=`(() => {const data=baye.data,identity={...BayeHdLibIdentity.read()},before=${defenderNativeSource},world=${worldSource},state=${readSource},native=${defenderNativeSource},last=BayeHdLibIdentity.read();
    const key=n=>JSON.stringify({menu:n.menu,report:n.report,fight:n.fight,record:n.record,battle:n.battle,detailGeneration:n.detailGeneration,march:n.march,keys:n.keys,touches:n.touches});
    if(data!==baye.data||!baye.hd.ready()||identity.status!=='ready'||identity.sha256!=='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'||identity.byteLength!==207195||!Number.isInteger(identity.generation)||identity.generation<=0||JSON.stringify(identity)!==JSON.stringify(last)||key(before)!==key(native))throw Error('Original defender sample identity/owner changed');
    return {world,state,native};})()`;
  const sample=()=>evaluate(sampleSource),codes=async offset=>(await readKeys(offset)).map(k=>k.code);
  const capture=async label=>{const s=await sample();report.defenderChecks.push({label,...s});await checkpoint('defender-'+width+'-'+label);return s;};
  const readonly=async(before,label)=>{await delay(160);const after=await sample();
    assert.deepEqual(after.world,before.world,label+' complete recorded world');
    for(const field of ['menu','report','battle'])assert.deepEqual(after.native[field],before.native[field],label+' '+field);
    assert.deepEqual(await codes(before.native.keys),[],label+' zero native keys');assert.equal(after.native.touches,before.native.touches,label+' zero LCD touches');return after;};
  const point=async selector=>{let g;for(let attempt=0;attempt<20;attempt++){
    g=await evaluate(campaignGeometrySource(selector));
    if(g?.shown&&g.visible&&!g.disabled&&g.hit){assert.ok(g.width>=43.5&&g.height>=43.5,'Current 44px defender control');return g;}
    assert.ok(g?.shown&&!g.disabled&&g.scroller,'Current defender control has a real scrolling ancestor: '+JSON.stringify(g));
    if(g.visible&&!g.hit)throw Error('Current defender control covered: '+JSON.stringify(g));
    const down=g.rect.bottom>g.clip.bottom+.5,deficit=down?g.rect.bottom-g.clip.bottom:g.clip.top-g.rect.top,available=g.clip.bottom-g.clip.top-32;
    assert.ok(deficit>0&&available>=16,'Measured finite defender pan');
    const before=await sample(),amount=Math.min(Math.max(16,deficit+12),available),x=g.clip.right-12,y=down?g.clip.bottom-16:g.clip.top+16,delta=(down?-1:1)*amount;
    await touches('touchStart',[{x,y}]);for(let j=1;j<=6;j++)await touches('touchMove',[{x,y:y+delta*j/6}]);await touches('touchEnd');
    const after=await readonly(before,'Defender list pan');report.defenderScrolls.push({selector,geometry:g,pan:{x,y,delta},before,after});
  }throw Error('Defender control did not become visible: '+JSON.stringify(g));};
  const press=async selector=>tap(await point(selector));
  const readyPicker=()=>until('Current authenticated mobile defenders',"(() => {const m=baye.hd.menuItems(),t=BayeHdDialog.getInputTicket();return m.active===1&&m.context===5&&m.kind===2&&m.idsValid&&BayeHdMobileCity.snapshot().dialogVisible&&t&&t.ownerType==='defenders';})()");
  const names=()=>evaluate('baye.hd.menuItems().ids.map(id=>baye.getPersonName(id))');
  const selectionKeys=(owner,index)=>[...Array(Math.abs(index-owner.index)).fill(index<owner.index?K.UP:K.DOWN),K.ENTER];
  report.defenderChecks=[];report.defenderMonths=[];report.defenderScrolls=[];report.defenderCandidateGeometry=[];report.defenderNegatives=[];report.defenderSelections=[];
  report.defenderPcPreferencesBefore=await evaluate(preferences);
  await evaluate(defenderObserverSource(worldSource));
  const initial=await capture('01-new-map');assert.equal(initial.world.king,0,'Original P1 Dong Zhuo public new game');assert.equal(initial.world.period,1);

  // One public strategy end per actual MAP. No forced orders, RNG writes or blind report keys.
  let picker=null;
  for(let ordinal=1;ordinal<=6&&!picker;ordinal++){
    await until('Actual MAP before bounded strategy end',mapReadySource);const before=await sample(),entry={ordinal,before,reports:[]};report.defenderMonths.push(entry);
    await button('#hd-mobile-system-open');await until('Actual system FUNCTION owner',"(() => {const h=BayeHdMobileSystem.snapshot(),s=BayeHdSystemUi.debugSnapshot(),m=baye.hd.menuItems();return h.active&&s.open&&s.showHd&&!s.pending&&s.screen==='insystem'&&s.input&&m.active===1&&m.context===2&&m.kind===1&&m.names[0]==='策略结束';})()");
    const opened=await sample();assert.deepEqual(opened.world,before.world);assert.deepEqual(await codes(before.native.keys),[K.EXIT]);entry.opened=opened;
    const expected=selectionKeys(opened.native.system.input,0);await press('#hd-system-ui-list [data-hd-sys="0"]');
    await until('One acknowledged public strategy confirmation','__mobileMapKeys.length>='+String(opened.native.keys+expected.length));
    entry.keys=await readKeys(opened.native.keys);assert.deepEqual(entry.keys.map(k=>k.code),expected);
    const seen=new Set(),deadline=Date.now()+150_000;
    while(Date.now()<deadline){
      const n=await evaluate(defenderNativeSource);
      if(n.menu.active===1&&n.menu.context===5&&n.menu.kind===2){picker=await sample();entry.picker=picker;break;}
      if(n.fight.active===1)throw Error('Unexpected battle before actual defender selection');
      if(n.menu.active===1&&n.menu.context===5&&n.menu.kind===1)throw Error('Unexpected player succession during defender route; no blind replacement');
      const r=n.report,d=n.dialog,owner=d.reportOwner;
      if(r.active===1&&r.inputSeq>0&&d.open&&d.kind==='report'&&!d.pass&&owner&&owner.seq===r.seq&&owner.inputSeq===r.inputSeq){
        const token=r.seq+':'+r.inputSeq;if(!seen.has(token)){
          seen.add(token);const b=await sample();await button('#hd-dialog [data-hd-dlg-ok]');const sent=await readKeys(b.native.keys);
          assert.deepEqual(sent.map(k=>k.code),[K.ENTER],'One current real monthly report ACK');entry.reports.push({before:b,keys:sent});
        }
      }
      if(await evaluate(mapReadySource)){
        const after=await sample();if(after.world.year!==before.world.year||after.world.month!==before.world.month){entry.after=after;await capture('month-'+ordinal+'-map');break;}
      }
      await delay(160);
    }
    if(!picker&&!entry.after)throw Error('Bounded monthly processing did not reach actual MAP or defender owner');
  }
  if(!picker){report.defenderNotCovered={code:'natural-defender-not-triggered',accepted:false,months:report.defenderMonths.length,terminal:await sample()};
    throw Error('Six real public strategy ends did not produce an actual defender picker; not covered');}
  if(await evaluate("BayeHdCityMenu.getMode()==='classic'")){
    const before=await sample();await button('#hd-mobile-menu-mode');await readyPicker();await readonly(before,'Defender HD presentation switch');
  }
  await readyPicker();picker=await capture('02-native-picker');
  const verdict=verifyMobileDefenderPicker({world:picker.world,native:picker.native,names:await names()});report.defenderPicker={before:picker,verdict};
  const chosenIndex=picker.native.menu.ids.findIndex((id,index)=>index>0&&id!==picker.world.king&&picker.world.people[id].Arms>0);
  assert.ok(chosenIndex>0,'Actual current defender roster has a non-first armed nonking');
  for(const [index,id]of picker.native.menu.ids.entries()){
    const selector='#hd-dialog [data-hd-defender-index="'+index+'"]',before=await sample(),geometry=await point(selector);
    assert.equal(await evaluate(`Number(document.querySelector(${JSON.stringify(selector)}).getAttribute('data-hd-campaign-person'))`),id);
    await readonly(before,'Every defender reveal');report.defenderCandidateGeometry.push({index,id,geometry});
  }
  const held='#hd-dialog [data-hd-defender-index="'+chosenIndex+'"]';
  for(const type of ['touchcancel','bare-click','two-pointers','held-portrait','held-hidden','held-classic']){
    const p=await point(held),before=await sample();let boundary=null;
    if(type==='touchcancel'){await touches('touchStart',[{x:p.x,y:p.y}]);await touches('touchCancel');}
    else if(type==='bare-click')await evaluate(`document.querySelector(${JSON.stringify(held)}).click()`);
    else if(type==='two-pointers'){const q=await buttonPoint('#hd-mobile-menu-mode');await touches('touchStart',[{x:p.x,y:p.y,id:1}]);await touches('touchStart',[{x:p.x,y:p.y,id:1},{x:q.x,y:q.y,id:2}]);await touches('touchEnd');}
    else if(type==='held-portrait'){await touches('touchStart',[{x:p.x,y:p.y}]);await metrics(375,667);await until('Portrait retires HD defenders',"!BayeHdMobileCity.snapshot().dialogVisible");await metrics(...size);await readyPicker();await touches('touchEnd');}
    else if(type==='held-hidden'){
      await touches('touchStart',[{x:p.x,y:p.y}]);const other=await sendCdp('Target.createTarget',{url:'about:blank'});
      try{await sendCdp('Target.activateTarget',{targetId:other.targetId});await until('Actual hidden defender document',"document.hidden&&document.visibilityState==='hidden'",10000);boundary=await evaluate('({hidden:document.hidden,visibility:document.visibilityState})');await readonly(before,'Hidden defender before restoration');}
      finally{await sendCdp('Target.closeTarget',{targetId:other.targetId});await sendCdp('Page.bringToFront');}
      await until('Defender document visible',"!document.hidden&&document.visibilityState==='visible'");await readyPicker();await touches('touchEnd');
    }else{
      await touches('touchStart',[{x:p.x,y:p.y}]);await evaluate("BayeHdCityMenu.setMode('classic')");await until('Classic retires HD defenders',"!BayeHdMobileCity.snapshot().dialogVisible");
      await evaluate("BayeHdCityMenu.setMode('hd')");await readyPicker();await touches('touchEnd');boundary={source:'Public presentation-only setMode while held'};
    }
    const after=await readonly(before,'Retired defender '+type);report.defenderNegatives.push({type,before,after,boundary,keys:[],nativeTouches:[]});
  }
  const modeBefore=await sample();await button('#hd-mobile-menu-mode');await until('Trusted defender classic mode',"BayeHdCityMenu.getMode()==='classic'&&!BayeHdMobileCity.snapshot().dialogVisible");
  await button('#hd-mobile-menu-mode');await readyPicker();report.defenderModeRoundtrip={before:modeBefore,after:await readonly(modeBefore,'Trusted defender HD-classic roundtrip')};

  async function choose(index){
    const before=await sample(),id=before.native.menu.ids[index],selector='#hd-dialog [data-hd-defender-index="'+index+'"]';
    verifyMobileDefenderPicker({world:before.world,native:before.native,names:await names()});assert.notEqual(id,before.world.king);assert.ok(before.world.people[id].Arms>0);
    const offset=before.state.eventCount;await press(selector);
    await until('Actual defender append and fresh native roster',`(() => {const n=${defenderNativeSource};return n.menu.active===1&&n.menu.context===5&&n.menu.kind===2&&n.menu.seq!==${before.native.menu.seq}&&n.battle.genArray.includes(${id+1});})()`);
    await readyPicker();const after=await sample(),keys=await readKeys(before.native.keys);assert.deepEqual(keys.map(k=>k.code),selectionKeys(before.native.menu,index));
    const events=await evaluate('__mobileMapEvents.slice('+offset+')');assert.ok(events.some(e=>e.type==='pointerdown'&&e.trusted===true));
    report.defenderSelections.push({before,after,chosenIndex:index,chosenId:id,keys,events,verdict:verifyMobileDefenderSelection({before,after,chosenIndex:index})});
    return after;
  }
  let selected=await choose(chosenIndex);await capture('03-first-selected');
  // Exercise another append when at least one real candidate will remain for explicit finish.
  const nextIndex=selected.native.menu.ids.findIndex((id,index)=>index>0&&id!==selected.world.king&&selected.world.people[id].Arms>0);
  if(selected.native.menu.count>=2&&nextIndex>0){selected=await choose(nextIndex);await capture('04-second-selected');}
  assert.ok(selected.native.battle.genArray.slice(0,10).some(id=>id>0&&id<0xfffe));
  const beforeFinish=await sample();await press('#hd-dialog [data-hd-defenders-finish]');
  await until('Actual fresh mobile defensive PICK',"(() => {const f=baye.hd.fight();return f.active===1&&f.over===0&&f.inputKind===1&&Number(baye.data.g_FgtParam.Mode)===0&&Number(baye.data.g_MainGenIdx)===10&&BayeHdMobileBattle.debugSnapshot().active;})()",60000);
  const after=await capture('05-defensive-battle'),keys=await readKeys(beforeFinish.native.keys);assert.deepEqual(keys.map(k=>k.code),[K.EXIT],'One explicit current finish EXIT');
  await evaluate('clearInterval(__mobileDefender.fightTimer)');const observer=await evaluate('__mobileDefender');assert.equal(observer.overflow,false);assert.equal(observer.error,undefined);
  const initialBattle=observer.fights.find(s=>s.native.fight.active===1&&s.native.fight.inputKind===1&&s.native.battle.cityIndex===beforeFinish.native.battle.cityIndex);
  assert.ok(initialBattle,'First observed native defensive PICK, with no battle action injected');
  report.defenderBattle={before:beforeFinish,after,initial:initialBattle,keys,verdict:verifyMobileDefenderBattle({before:beforeFinish,after:initialBattle})};
  assert.deepEqual(after.native.battle.genArray,initialBattle.native.battle.genArray);
  assert.equal(after.native.dialog.open,false,'Old defender dialog is retired');assert.equal(after.native.dialog.defenseRequest,null);
  report.defenderObserver=observer;report.nativeKeys=await readKeys();report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.equal(report.nativeTouches.length,0);assert.equal(report.exceptions.length,0);assert.equal(report.defenderNegatives.length,6);
  report.defenderPcPreferencesAfter=await evaluate(preferences);assert.deepEqual(report.defenderPcPreferencesAfter,report.defenderPcPreferencesBefore);
  report.acceptedScope=['Actual original AI Order27 arrival after public monthly processing','Authenticated native defender IDs and trusted non-first armed nonking HD selection with exact resident/GenArray changes','One explicit finish EXIT and real initial defensive PICK/Mode0/mainGenIndex10; six zero-input lifecycle negatives'];
  report.pendingScope=['Defense victory/defeat and full post-battle settlement','Other periods, cities, random month prediction and RNG continuity','Android/iOS devices, full visual frames, performance and complete HD'];
  report.defenderAccepted=true;report.ok=true;report.accepted=true;
}
