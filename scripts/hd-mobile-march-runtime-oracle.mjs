// Pure saved-evidence checks. No input, browser, native writes, process or filesystem access.
// Actual trusted-source provenance and visible-control geometry remain the caller's responsibility.
import assert from 'node:assert/strict';
import {mobileBattleOracleContract,verifyMobileBattleMarch} from './hd-mobile-battle-runtime-oracle.mjs';

export const mobileMarchRuntimeContract = Object.freeze({
  scope:'Original P1 Ma Teng source8 -> enemy9; ordered selection/cancellation and measured HD march trace',
  personIds:'zero-based; ordered at the actual native picker acknowledgement',
  phases:Object.freeze({persons:1,food:2,'target-tip':3,target:4,'target-selected':4,armout:6,departed:7}),
  worldCounts:mobileBattleOracleContract.worldCounts,
  cancellation:'Replay ordered DelPerson, then reverse-selection AddPerson; queue order need not equal its initial order',
  requiredConfig:Object.freeze(['enable16bitConsumeMoney','checkRedundantOnAddPerson']),
  traceRow:'{stage,state,world}; state has at/identity/march/menu/qty/report/cityUi and actual keyCount/touchCount/eventCount',
  trustedAction:'{kind,personId?,target,before,after}; before/after are actual state samples, counts index the original logs',
  trustedActionKinds:Object.freeze(['select-person','finish-persons','food-adjust','food-confirm','continue-target','target-select','target-confirm','armout-ack']),
  sourceLimits:Object.freeze(['Recorded worldSource fields only, not full native ABI',
    'A pure checker cannot establish that fixtures are actual browser observations',
    'Caller retains trusted CDP action, visible current selector/owner/geometry and source/cleanup evidence',
    'No strategy month, battle result, natural release, real device or whole HD acceptance']),
  nativeSources:Object.freeze(['vendor/iBaye/src/citycmdd.c:110-230,1079-1093,1133-1151',
    'vendor/iBaye/src/cityedit.c:59-145,506-536,696-711',
    'vendor/iBaye/src/hd-bridge.c:1462-1489,3488-3502',
    'vendor/iBaye/src/infdeal.c:567-572,644-697'])
});
const PERSON=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PU16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY=['Belong','SatrapId','State','AvoidCalamity','PeopleDevotion','Commerce','Money','Food','MothballArms','PersonQueue','Persons'];
const ORDER=['OrderId','City','Person','Object','TimeCount','Food'];
const int=(v,min,max,label)=>{assert.ok(Number.isInteger(v)&&v>=min&&v<=max,label+' integer '+min+'..'+max);return v;};
function exact(a,b,label,path='$'){
  if(Object.is(a,b))return;
  assert.ok(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object',label+' differs at '+path);
  assert.equal(Array.isArray(a),Array.isArray(b),label+' kind at '+path);
  const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();assert.deepEqual(ak,bk,label+' fields at '+path);
  for(const k of bk)exact(a[k],b[k],label,path+'.'+k);
}
function numbers(a,n,max,label){
  assert.ok(Array.isArray(a)&&a.length===n,label+' exact length '+n);
  a.forEach((v,i)=>int(v,0,max,label+'['+i+']'));
}
function world(w,label){
  assert.ok(w&&typeof w==='object',label+' measured world');
  int(w.period,1,4,label+'.period');int(w.king,0,199,label+'.king');
  int(w.year,0,65535,label+'.year');int(w.month,1,12,label+'.month');
  assert.ok(Array.isArray(w.people)&&w.people.length===200,label+' 200 people');
  w.people.forEach((p,i)=>PERSON.forEach(k=>int(p?.[k],0,PU16.has(k)?65535:255,label+'.people['+i+'].'+k)));
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,label+' 38 cities');
  w.cities.forEach((c,i)=>{
    CITY.forEach(k=>int(c?.[k],0,['State','AvoidCalamity','PeopleDevotion'].includes(k)?255:65535,label+'.cities['+i+'].'+k));
    assert.ok(c.PersonQueue+c.Persons<=200,label+' active city slice within first200');
    w.queue?.slice(c.PersonQueue,c.PersonQueue+c.Persons).forEach(pid=>int(pid,0,199,label+' resident PID'));
  });
  numbers(w.queue,2000,65535,label+'.queue');numbers(w.fighters,600,255,label+'.fighters');numbers(w.fighterIndex,30,1,label+'.fighterIndex');
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,label+' 200 orders');
  w.orders.forEach((o,i)=>ORDER.forEach(k=>int(o?.[k],0,['OrderId','City','TimeCount'].includes(k)?255:65535,label+'.orders['+i+'].'+k)));
  for(const k of mobileMarchRuntimeContract.requiredConfig)int(w.config?.[k],0,1,label+'.config.'+k);
}
function selection(ids,label='selectedPersonIds',allowEmpty=false){
  assert.ok(Array.isArray(ids)&&ids.length>=(allowEmpty?0:1)&&ids.length<=10,label+' ordered '+(allowEmpty?'0':'1')+'..10 IDs');
  ids.forEach(v=>int(v,0,199,label+' PID'));assert.equal(new Set(ids).size,ids.length,label+' unique IDs');return ids;
}
function currentResident(w,origin,pid){
  const c=w.cities[origin];return w.people[pid].Belong===c.Belong&&w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).includes(pid);
}
function source(w,origin){
  int(origin,0,37,'origin');assert.equal(w.cities[origin].Belong,w.king+1,'Current source owned by player');
}
function del(w,city,pid,required=true){
  const c=w.cities[city],end=c.PersonQueue+c.Persons;
  let i=c.PersonQueue;while(i<end&&w.queue[i]!==pid)i++;
  if(i===end){assert.ok(!required,'Selected PID is present in current source queue');return false;}
  // C DelPerson mutates only the first PERSON_COUNT=200 slots. Slot199 remains.
  for(;i<199;i++)w.queue[i]=w.queue[i+1];
  c.Persons--;for(let j=city+1;j<38;j++)w.cities[j].PersonQueue--;return true;
}
function add(w,city,pid){
  if(w.config.checkRedundantOnAddPerson){
    for(let i=0;i<38;i++){let attempts=0;while(del(w,i,pid,false))assert.ok(++attempts<=200,'Bound native duplicate removal');}
  }
  const c=w.cities[city];
  for(let i=199;i>c.PersonQueue;i--)w.queue[i]=w.queue[i-1];
  for(let j=city+1;j<38;j++)w.cities[j].PersonQueue++;
  w.queue[c.PersonQueue]=pid;c.Persons++;
}
function removedWorld(before,origin,ids){
  const e=structuredClone(before);
  for(const pid of ids){assert.ok(currentResident(e,origin,pid),'Selected current same-owner resident');del(e,origin,pid);}return e;
}
/** before is immediately before this one selection, not before all earlier choices. */
export function verifyMobileMarchSelection({before,after,origin,personId,selectedPersonIdsBefore=[]}={}){
  world(before,'selection.before');world(after,'selection.after');source(before,origin);
  selection(selectedPersonIdsBefore,'selectedPersonIdsBefore',true);int(personId,0,199,'Selected personId');
  assert.ok(selectedPersonIdsBefore.length<10&&!selectedPersonIdsBefore.includes(personId),'Fresh next selected ID');
  const expected=removedWorld(before,origin,[personId]);exact(after,expected,'Only one native DelPerson change');
  return {ok:true,selectionAccepted:true,measuredWorldAccepted:true,origin,personId,
    selectedPersonIds:[...selectedPersonIdsBefore,personId],checked:mobileMarchRuntimeContract.worldCounts,
    scope:'One measured native DelPerson; no independent trusted-input acceptance'};
}
/** before is before this attempt's first selection; after is after native cancellation. */
export function verifyMobileMarchCancellation({before,after,origin,selectedPersonIds,cancelStage}={}){
  world(before,'cancel.before');world(after,'cancel.after');source(before,origin);selection(selectedPersonIds);
  assert.ok(cancelStage==='food'||cancelStage==='target','Actual food or target cancellation stage');
  const expected=removedWorld(before,origin,selectedPersonIds);
  for(let i=selectedPersonIds.length-1;i>=0;i--)add(expected,origin,selectedPersonIds[i]);
  exact(after,expected,'Native reverse AddPerson cancellation, with no cost/order/fighter mutation');
  const c=after.cities[origin];
  return {ok:true,cancellationAccepted:true,measuredWorldAccepted:true,cancelStage,origin,
    selectedPersonIds:[...selectedPersonIds],checkRedundantOnAddPerson:before.config.checkRedundantOnAddPerson,
    restoredResidentQueue:after.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons),
    queueMayReorder:true,checked:mobileMarchRuntimeContract.worldCounts,
    scope:'Measured native cancellation; caller separately binds its actual EXIT touch and stage'};
}
function sample(s,label,gen){
  assert.ok(s&&typeof s==='object',label+' actual sample');
  assert.ok(Number.isFinite(s.at)&&s.at>=0,label+' actual monotonic time');
  const id=s.identity,ref=mobileBattleOracleContract.originalLib;
  assert.equal(id?.status,'ready',label+' ready original identity');assert.equal(id.byteLength,ref.bytes);assert.equal(id.sha256,ref.sha256);
  int(id.generation,1,0xffffffff,label+' generation');if(gen!==undefined)assert.equal(id.generation,gen,label+' same library generation');
  for(const k of ['keyCount','touchCount','eventCount'])int(s[k],0,Number.MAX_SAFE_INTEGER,label+'.'+k);
  const m=s.march;assert.ok(m&&typeof m==='object',label+' actual march publication');
  for(const k of ['pick','battlePick','ok'])int(m[k],0,1,label+'.march.'+k);
  for(const k of ['mapCity','city','obj','time','phase','origin','selected'])int(m[k],0,255,label+'.march.'+k);
  int(m.phase,0,7,label+' known phase');int(m.selected,0,10,label+' selected count');
  int(m.session,1,65535,label+' active positive march session');int(m.inputSeq,1,0xffffffff,label+' inputSeq');
  int(m.mapInputSeq,0,0xffffffff,label+' mapInputSeq');int(m.seq,0,0xffffffff,label+' march seq');return s;
}
function inputCodes(action,logs){
  const {before:b,after:a}=action;sample(b,'action.before');sample(a,'action.after',b.identity.generation);
  assert.ok(a.at>=b.at,'Action chronological samples');assert.equal(a.march.session,b.march.session,'One action cannot cross march sessions');
  for(const [k,log] of [['keyCount',logs.nativeKeys],['touchCount',logs.nativeTouches],['eventCount',logs.trustedEvents]]){
    assert.ok(Array.isArray(log),'Actual original '+k+' log');
    assert.ok(b[k]<=a[k]&&a[k]<=log.length,'Actual '+k+' log window');
  }
  assert.equal(a.touchCount,b.touchCount,'HD march control cannot leak native LCD touches');
  assert.ok(typeof action.target==='string'&&action.target.length>0,'Actual event target string');
  const events=logs.trustedEvents.slice(b.eventCount,a.eventCount);
  const pointer=events.filter(e=>/^pointer(down|up|cancel)$/.test(e.type));
  assert.equal(pointer.length,2,'One real pointer DOWN/UP, no cancel/multitouch');
  assert.equal(pointer[0].type,'pointerdown');assert.equal(pointer[1].type,'pointerup');
  int(pointer[0].pointerId,1,Number.MAX_SAFE_INTEGER,'Trusted pointer ID');
  assert.equal(pointer[1].pointerId,pointer[0].pointerId,'Same trusted pointer lifecycle');
  assert.ok(pointer[1].at>=pointer[0].at,'Trusted pointer UP follows DOWN');
  for(const e of pointer){assert.equal(e.trusted,true,'Actual trusted pointer');assert.equal(e.target,action.target,'Actual observed hit target');}
  for(const e of events)if(/^(pointer|touch|click)/.test(e.type)){
    assert.equal(e.trusted,true,'No untrusted event can supply action evidence');
    assert.ok(Number.isFinite(e.at)&&e.at>=b.at&&e.at<=a.at,'Input timestamp within actual action samples');
  }
  const codes=logs.nativeKeys.slice(b.keyCount,a.keyCount).map(e=>{
    assert.ok(Number.isFinite(e?.at)&&e.at>=b.at&&e.at<=a.at,'Native key timestamp within actual action samples');
    return int(e.code,0,65535,'Actual native key code');
  });
  return codes;
}
const arrow=code=>code>=34&&code<=37;
function exactlyConfirm(codes,label){
  assert.ok(codes.length>=1&&codes.at(-1)===39,label+' ends with Enter');
  assert.equal(codes.filter(c=>c===39).length,1,label+' exactly one Enter');
  assert.ok(codes.slice(0,-1).every(arrow),label+' only prior legal arrows');
}
function actionChecks(actions,logs,ids,gen,session){
  assert.ok(Array.isArray(actions),'Actual trusted action list');
  const counts=new Map(),chosen=[];let previous=null;
  for(const a of actions){
    assert.ok(mobileMarchRuntimeContract.trustedActionKinds.includes(a.kind),'Known HD march action');
    sample(a.before,'trusted before',gen);sample(a.after,'trusted after',gen);
    assert.equal(a.before.march.session,session);assert.equal(a.after.march.session,session);
    if(previous){assert.ok(a.before.at>=previous.at,'Actions occur in order');
      for(const k of ['keyCount','touchCount','eventCount'])assert.ok(a.before[k]>=previous[k],'Action evidence windows cannot be reused');}
    previous=a.after;counts.set(a.kind,(counts.get(a.kind)||0)+1);
    const codes=inputCodes(a,logs),bm=a.before.march,am=a.after.march;
    switch(a.kind){
      case 'select-person':{
        assert.equal(bm.phase,1);assert.ok(am.phase===1||am.phase===2,'Native persons continues or finishes');
        assert.equal(bm.selected,chosen.length);assert.equal(am.selected,chosen.length+1);
        assert.equal(a.personId,ids[chosen.length],'Actual chosen PID order');
        const menu=a.before.menu;
        assert.equal(menu?.active,1);assert.equal(menu.context,1);assert.equal(menu.kind,3);
        assert.equal(menu.idsValid,true,'Actual current native picker IDs');
        assert.ok(Array.isArray(menu.ids)&&menu.ids.length===menu.count&&menu.ids.includes(a.personId),'Chosen PID belongs to complete native picker');
        chosen.push(a.personId);exactlyConfirm(codes,'Person selection');break;
      }
      case 'finish-persons':assert.equal(bm.phase,1);assert.equal(am.phase,2);exact(codes,[40],'One native EXIT ends selection');break;
      case 'food-adjust':assert.equal(bm.phase,2);assert.equal(am.phase,2);assert.ok(codes.length>0&&codes.every(arrow),'Quantity adjusts only by arrows');break;
      case 'food-confirm':assert.equal(bm.phase,2);assert.ok(am.phase===3||am.phase===4,'Native food confirmation starts target stage');exact(codes,[39],'One native food Enter');break;
      case 'continue-target':assert.equal(bm.phase,3);assert.equal(am.phase,4);exact(codes,[39],'One actual target-tip Enter');break;
      case 'target-select':assert.equal(bm.phase,4);assert.equal(am.phase,4);exact(codes,[],'Selecting target is presentation only');break;
      case 'target-confirm':assert.equal(bm.phase,4);assert.ok(am.phase===6||am.phase===7,'Target confirmation reaches native armout/departed');exactlyConfirm(codes,'Target confirmation');break;
      case 'armout-ack':assert.equal(bm.phase,6);assert.equal(am.phase,7);exact(codes,[39],'One native armout Enter');break;
    }
  }
  exact(chosen,ids,'Every final selected PID has its own actual trusted action');
  for(const k of ['food-confirm','target-confirm'])assert.equal(counts.get(k),1,'Exactly one '+k);
  assert.ok((counts.get('target-select')||0)>=1,'At least one actual presentation-only target selection');
  for(const k of ['finish-persons','continue-target','armout-ack'])assert.ok((counts.get(k)||0)<=1,'At most one '+k);
  return {actionCount:actions.length,selectionActions:chosen.length,ackTargetTip:counts.get('continue-target')||0,
    ackArmout:counts.get('armout-ack')||0,nativeLcdTouches:0};
}
/**
 * phaseTrace rows and trustedActions must come from actual native samples and original
 * trusted-input log indexes. They are not generated or made trusted by this pure helper.
 * selections contains each immediate before/after world, in final selection order.
 * The final dispatch deliberately reuses the earlier, narrowly scoped measured-world oracle.
 */
export function verifyMobileHdMarch({before,after,qty,libBytes,selectedPersonIds,selections,phaseTrace,
  trustedActions,nativeKeys,nativeTouches,trustedEvents}={}){
  world(before,'march.before');world(after,'march.after');selection(selectedPersonIds);
  const origin=8,target=9,selectedWorld=removedWorld(before,origin,selectedPersonIds);
  assert.ok(Array.isArray(selections)&&selections.length===selectedPersonIds.length,'Every immediate DelPerson world pair');
  let current=before;
  for(let i=0;i<selections.length;i++){
    const p=selections[i];assert.equal(p.personId,selectedPersonIds[i]);exact(p.before,current,'Continuous selection worlds');
    verifyMobileMarchSelection({...p,origin,selectedPersonIdsBefore:selectedPersonIds.slice(0,i)});current=p.after;
  }
  exact(current,selectedWorld,'All immediate selections equal native queue result');
  assert.ok(Array.isArray(phaseTrace)&&phaseTrace.length>=7,'Complete actual native stage trace');
  const stages=Object.keys(mobileMarchRuntimeContract.phases),by=new Map();let rank=-1,last=null,gen,session;
  for(const row of phaseTrace){
    const r=stages.indexOf(row.stage);assert.ok(r>=0&&r>=rank,'Known ordered native phases');rank=r;
    assert.ok(!by.has(row.stage)||row.stage==='persons','Unique canonical stage except fresh persons');
    const s=sample(row.state,'stage '+row.stage,gen);if(gen===undefined){gen=s.identity.generation;session=s.march.session;}
    assert.equal(s.march.session,session,'Same fresh native march session');assert.equal(s.march.origin,origin);
    assert.equal(s.march.phase,mobileMarchRuntimeContract.phases[row.stage],'Actual native stage');
    if(last){assert.ok(s.at>=last.at,'Native trace time order');
      for(const k of ['keyCount','touchCount','eventCount'])assert.ok(s[k]>=last[k],'Monotonic original input log indexes');}
    last=s;world(row.world,'stage '+row.stage+' world');
    if(row.stage==='persons'){
      int(s.march.selected,0,selectedPersonIds.length,'Current selected prefix before explicit finish');
      exact(row.world,removedWorld(before,origin,selectedPersonIds.slice(0,s.march.selected)),'Person stage exact selected prefix');
    }else{
      assert.equal(s.march.selected,selectedPersonIds.length);
      exact(row.world,row.stage==='departed'?after:selectedWorld,'No premature debit/order or unrelated stage world change');
    }
    if(row.stage!=='departed')assert.equal(s.march.ok,0,'Fresh unsubmitted attempt cannot reuse old ok');
    by.set(row.stage,row);
  }
  for(const s of stages)assert.ok(by.has(s),'Required actual native '+s+' sample');
  const first=phaseTrace[0].state,food=by.get('food').state,tip=by.get('target-tip').state,
    targetState=by.get('target').state,selected=by.get('target-selected').state,
    armout=by.get('armout').state,departed=by.get('departed').state;
  assert.equal(first.march.selected,0,'First actual PERSONS sample precedes selections');
  assert.equal(food.qty?.active,1);assert.equal(food.qty.protocol,true);assert.equal(food.qty.ready,1);
  for(const k of ['min','max','value'])assert.equal(food.qty[k],qty[k],'Actual confirmed food sample.'+k);
  assert.equal(tip.report?.active,1);assert.equal(tip.report.kind,2,'Real target GREPORT');assert.equal(tip.report.person,selectedPersonIds[0]);
  assert.equal(armout.report?.active,1);assert.equal(armout.report.kind,1,'ARMOUT is real MSGBOX, not a person report');
  for(const s of [targetState,selected]){assert.equal(s.march.pick,1);assert.equal(s.march.battlePick,1);assert.ok(s.march.mapInputSeq>0);}
  exact(selected.march,targetState.march,'HD target selection leaves native cursor/owner untouched');
  assert.equal(selected.cityUi?.pendingTarget,target,'Actual shared selected target');
  assert.equal(selected.keyCount,targetState.keyCount);assert.equal(selected.touchCount,targetState.touchCount);
  assert.equal(departed.march.ok,1);assert.equal(departed.march.battlePick,0);
  assert.equal(departed.march.city,origin);assert.equal(departed.march.obj,target);
  assert.ok(departed.march.seq>0&&departed.march.seq!==first.march.seq,'New actual dispatch sequence');
  const measured=verifyMobileBattleMarch({before,after,qty,libBytes,selectedPersonIds});
  assert.equal(departed.march.time,measured.distance);
  const input=actionChecks(trustedActions,{nativeKeys,nativeTouches,trustedEvents},selectedPersonIds,gen,session);
  assert.equal(departed.touchCount,first.touchCount,'Whole HD march interval has zero native LCD touches');
  const covered=new Set();
  for(const action of trustedActions){
    assert.ok(action.before.keyCount>=first.keyCount&&action.after.keyCount<=departed.keyCount,'Actual action lies inside march key interval');
    for(let i=action.before.keyCount;i<action.after.keyCount;i++){assert.ok(!covered.has(i),'Native key cannot prove two actions');covered.add(i);}
  }
  for(let i=first.keyCount;i<departed.keyCount;i++)assert.ok(covered.has(i),'Every march native key belongs to a trusted action');
  return {...measured,hdMarchTraceAccepted:true,scope:mobileMarchRuntimeContract.scope,
    wholeHdAccepted:false,fullHdAccepted:false,fullNativeAbiAccepted:false,actualInputProvenance:'caller-retained-original-trusted-trace',
    libraryGeneration:gen,marchSession:session,phases:stages,input,
    limits:[...mobileMarchRuntimeContract.sourceLimits]};
}
