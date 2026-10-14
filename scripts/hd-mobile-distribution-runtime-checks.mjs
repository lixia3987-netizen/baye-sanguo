// Real original CITY distribution, using only current visible trusted HD controls.
import assert from 'node:assert/strict';
import {calculateMobileDistributionLimit,verifyMobileDistribution} from './hd-mobile-distribution-runtime-oracle.mjs';
import {checkMobileQuantityPresentation} from './hd-mobile-quantity-runtime-checks.mjs';

const VK={UP:0x22,DOWN:0x23,HELP:0x26,ENTER:0x27};
const nextSeq=n=>n===0xffffffff?1:n+1;

export async function runMobileDistributionChecks(ctx){
  const {report,evaluate,until,checkpoint,ready,root,submenu,selectPerson,back,mapReturn,visibleSelector,
    controlPoint,tap,touchButton,readKeys,navigation,worldSame,testCity,mark,originalLibBytes,label}=ctx;
  await root(2,'军备');const first=await submenu('分配');
  const actor=[...first.state.menu.ids].reverse().find(id=>first.world.people[id].Arms>0&&
    calculateMobileDistributionLimit({world:first.world,cityIndex:testCity.index,personId:id,libBytes:originalLibBytes}).maximum-1>first.world.people[id].Arms);
  assert.ok(Number.isInteger(actor)&&first.world.people[actor].Arms>0,'Distribute to an actual still-resident armed general, not a recruiter already on duty');
  const entry={label,cityIndex:testCity.index,personId:actor,personName:await evaluate(`baye.getPersonName(${actor})`),viewport:first.state.viewport,first,operations:[],accepted:false};
  report.distributions.push(entry);
  const currentPicker=async(oldSeq)=>{
    await until('current complete distribution person owner',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner;
      return m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.ids.includes(${actor})&&${oldSeq==null?'true':`m.seq!==${oldSeq}`}&&
        s.open&&s.cityIndex===${testCity.index}&&s.layer==='deep'&&s.deepLabel==='分配'&&!s.sending&&!s.queueLen&&o&&
        o.seq===m.seq&&o.context===m.context&&o.kind===m.kind&&o.detailGeneration===m.detailGeneration&&
        s.deepItems.length===m.ids.length&&m.ids.every((id,i)=>s.deepItems.find(v=>v.i===i)?.pind===id);})()`);
    const value=await ready(),c=value.world.cities[testCity.index];
    const ids=value.world.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>value.world.people[id].Belong===c.Belong);
    assert.deepEqual(value.state.menu.ids,ids,'The continuing distribution picker preserves all resident IDs in native order');
    return value;
  };
  const summary=async suffix=>{
    const current=await checkMobileQuantityPresentation(evaluate,label+' '+suffix);
    const semantics=await until('authenticated distribution quantity description',`(() => {
      const p=BayeHdCityMenu.getQuantityPresentation&&BayeHdCityMenu.getQuantityPresentation();
      const d=document.getElementById('hd-dialog-body'),c=document.querySelector('.hd-city-menu-qty-summary');
      const shown=n=>n&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&getComputedStyle(n).visibility!=='hidden';
      const text=[d,c].filter(shown).map(n=>n.textContent).join(' ');
      return p&&text.includes('目标总兵力')&&text.includes('预备兵')&&{presentation:p,text,
        title:document.getElementById('hd-dialog-title')?.textContent,purpose:d?.getAttribute('data-hd-quantity-purpose')};})()`,5_000);
    const measured=await mark(),p=semantics.presentation,q=measured.state.qty;
    assert.equal(p.kind,'distribution');assert.equal(p.cityIndex,testCity.index);assert.equal(p.personId,actor);
    assert.equal(p.personName,entry.personName);assert.equal(p.existingArms,measured.world.people[actor].Arms);
    assert.equal(p.reserveArms,measured.world.cities[testCity.index].MothballArms);
    assert.equal(p.libraryGeneration,measured.state.identity.generation);
    for(const field of ['session','inputSeq','value','min','max'])assert.equal(p[field],q[field],'Description binds the current native quantity '+field);
    assert.deepEqual(q,current.qty,'Summary and description refer to the same actual native ACK');
    assert.ok(semantics.text.includes(entry.personName)&&semantics.text.includes('现有兵力 '+p.existingArms)&&
      semantics.text.includes('城内预备兵 '+p.reserveArms)&&semantics.text.includes('目标总兵力 '+q.value),
      'Visible original distribution description contains the exact current actor, old troops, reserve and target total');
    if(current.selector==='#hd-dialog-body'){assert.equal(semantics.title,'分配兵力');assert.equal(semantics.purpose,'distribution');}
    const evidence={...current,semantics,measured};report.quantityPresentation.push(evidence);return evidence;
  };
  const open=async(kind)=>{
    const picker=await currentPicker(),selected=await selectPerson(actor,'分配');
    const quantity=await until('genuine distribution quantity ready',`(() => {const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot();return q.active===1&&q.protocol&&q.ready===1&&q.session>0&&q.max>0&&BayeHdCityMenu.isQtyLive()&&!s.sending&&!s.queueLen&&q;})()`);
    const opened=await ready(),limit=calculateMobileDistributionLimit({world:picker.world,cityIndex:testCity.index,personId:actor,libBytes:originalLibBytes});
    navigation(await readKeys(selected.before.state.keyCount),'Actual distribution actor selection');
    worldSame(picker,opened,'Opening the original distribution quantity');
    assert.equal(quantity.min,0);assert.equal(quantity.max,limit.maximum);assert.equal(quantity.value,limit.initialValue);assert.equal(quantity.step,1);
    const op={kind,picker,opened,limit,quantity,steps:[],summaries:[await summary(kind+' opened')]};entry.operations.push(op);
    return op;
  };
  const revealControl=async(selectors)=>{
    for(let attempt=0;attempt<8;attempt++){
      const info=await until('current quantity control mounted',`(() => {
        for(const selector of ${JSON.stringify(selectors)}){const n=document.querySelector(selector);if(!n)continue;
          let visible=true;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)visible=false;}
          if(!visible)continue;const list=n.closest('#hd-dialog-qty,.hd-city-menu-qty-controls');if(!list)continue;
          const r=list.getBoundingClientRect(),b=n.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,hit=document.elementFromPoint(x,y);
          return {selector,ready:!n.disabled&&b.top>=r.top&&b.bottom<=r.bottom&&(hit===n||n.contains(hit)),
            target:{top:b.top,bottom:b.bottom},clip:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},scrollTop:list.scrollTop,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight};}
        return null;})()`,3_000);
      if(info.ready)return visibleSelector(selectors);
      assert.ok(info.scrollHeight>info.clientHeight+2,'Hidden quantity control has genuine overflow');
      assert.ok(info.target.bottom>info.clip.bottom||info.target.top<info.clip.top,'Do not scroll around an unrelated obstruction');
      const before=await ready(),r=info.clip,down=info.target.bottom>r.bottom,x=r.right-12,y=r.top+(r.bottom-r.top)*(down?.75:.25),end=r.top+(r.bottom-r.top)*(down?.25:.75);
      const owned=await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(info.selector)}),list=n.closest('#hd-dialog-qty,.hd-city-menu-qty-controls'),hit=document.elementFromPoint(${x},${y});return hit===list||list.contains(hit);})()`);
      assert.equal(owned,true,'Trusted quantity pan starts inside its actual controls');
      await ctx.touches('touchStart',[{x,y}]);for(let i=1;i<=6;i++)await ctx.touches('touchMove',[{x,y:y+(end-y)*i/6}]);await ctx.touches('touchEnd');
      const after=await ready();worldSame(before,after,'Revealing the current quantity control');
      assert.equal(after.state.keyCount,before.state.keyCount);assert.equal(after.state.touchCount,before.state.touchCount);
      assert.deepEqual(after.native,before.native,'Quantity controls scroll without changing the native owner');
      const scrollTop=await evaluate(`document.querySelector(${JSON.stringify(info.selector)}).closest('#hd-dialog-qty,.hd-city-menu-qty-controls').scrollTop`);
      assert.notEqual(scrollTop,info.scrollTop,'Trusted pan really moves the quantity control scroller');
      entry.controlScrollChecks??=[];entry.controlScrollChecks.push({info,before,after,scrollTop,summary:await summary('after control pan')});
    }
    throw Error('Current quantity control did not become visible within eight trusted pans');
  };
  const edit=async(op,{bound=false,delta=null}={})=>{
    const before=await ready(),q=before.state.qty;
    const selector=await revealControl(bound?['#hd-dialog [data-hd-qty-bound]','#hd-city-menu [data-hd-qty-bound]']:
      [`#hd-dialog [data-hd-qty="${delta}"]`,`#hd-city-menu [data-hd-qty="${delta}"]`]);
    const expectedKey=bound?VK.HELP:delta>0?VK.UP:VK.DOWN;
    const expectedValue=bound?q.value===q.max?q.min:q.max:q.value+delta;
    const text=await evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
    if(bound)assert.equal(text.trim(),q.value===q.max?'最小':'最大','Current bounds button names the native next value');
    await touchButton(selector);
    const receipt=await until('current distribution quantity edit ACK',`(() => {const q=baye.hd.qty();return q.active===1&&q.ready===1&&q.session===${q.session}&&q.inputSeq!==${q.inputSeq}&&q;})()`);
    const after=await ready(),keys=await readKeys(before.state.keyCount);
    assert.deepEqual(keys.map(v=>v.code),[expectedKey],'Exactly one native key per current visible quantity touch');
    assert.equal(receipt.inputSeq,nextSeq(q.inputSeq));assert.equal(receipt.lastKey,expectedKey);assert.equal(receipt.value,expectedValue);
    for(const field of ['min','max','cursor','step'])assert.equal(receipt[field],q[field],'This bound/unit edit preserves native '+field);
    assert.deepEqual(after.state.qty,receipt,'Recorded edit sample is still the same native ACK');
    assert.equal(after.state.touchCount,before.state.touchCount,'No original LCD touch leakage');
    worldSame(before,after,'Editing target troop total');
    op.steps.push({selector,text,before,after,keys,receipt});op.summaries.push(await summary(op.kind+' edited'));
    return after;
  };
  const commit=async(op)=>{
    const before=await ready(),q=before.state.qty,selector=await visibleSelector(['#hd-dialog [data-hd-dlg-ok]','#hd-city-menu [data-hd-qty-ok]']);
    assert.equal(q.active,1);assert.equal(q.ready,1);assert.equal(q.session,op.quantity.session);
    worldSame(op.picker,before,'All selection and edits before troop allocation confirmation');
    op.summaries.push(await summary(op.kind+' before confirmation'));await checkpoint(label+'-'+op.kind+'-quantity');
    const point=await controlPoint(selector);await tap(point);
    const after=await currentPicker(op.picker.state.menu.seq),keys=await readKeys(before.state.keyCount);
    assert.deepEqual(keys.map(v=>v.code),[VK.ENTER],'One current native distribution confirmation');
    assert.equal(after.state.qty.active,0);assert.equal(after.state.qty.ready,0);assert.equal(after.state.qty.session,q.session);
    assert.equal(after.state.qty.lastKey,VK.ENTER);assert.equal(after.state.qty.inputSeq,nextSeq(q.inputSeq));
    assert.equal(after.state.touchCount,before.state.touchCount);
    assert.deepEqual(after.state.menu.ids,op.picker.state.menu.ids,'Distribution does not remove the selected general');
    op.confirmation={selector,point,before,after,keys};op.quantityConfirmed=q.value;
    op.verdict=verifyMobileDistribution({before:before.world,after:after.world,cityIndex:testCity.index,personId:actor,quantity:q.value,libBytes:originalLibBytes});
    assert.equal(await evaluate('BayeHdCityMenu.getQuantityPresentation()'),null,'Retired quantity cannot retain the actor description');
    await checkpoint(label+'-'+op.kind+'-committed');return after;
  };
  const cancelled=await open('cancel');await edit(cancelled,{delta:-1});
  const returned=await back(label+' distribution quantity cancellation');const pickerAfterCancel=await currentPicker(cancelled.picker.state.menu.seq);
  worldSame(cancelled.picker,pickerAfterCancel,'Cancelled troop distribution');
  assert.equal(returned.state.qty.lastKey,0x28);cancelled.cancelled={returned,picker:pickerAfterCancel};
  assert.equal(await evaluate('BayeHdCityMenu.getQuantityPresentation()'),null);await checkpoint(label+'-cancelled-persons');
  const increase=await open('increase');assert.ok(increase.quantity.max-1>increase.picker.world.people[actor].Arms,'Natural reserve supports an actual troop increase');
  await edit(increase,{delta:-1});const increased=await commit(increase);
  const reduction=await open('reduce-to-one');await edit(reduction,{bound:true});await edit(reduction,{delta:1});
  assert.ok(increased.world.people[actor].Arms>1);const reduced=await commit(reduction);assert.equal(reduced.world.people[actor].Arms,1);
  const zero=await open('return-to-zero');await edit(zero,{bound:true});const cleared=await commit(zero);
  assert.equal(cleared.world.people[actor].Arms,0,'Confirming original zero returns all troops to the reserve');
  const expected=structuredClone(first.world);expected.people[actor].Arms=0;
  expected.cities[testCity.index].MothballArms=(first.world.cities[testCity.index].MothballArms+first.world.people[actor].Arms)&65535;
  assert.deepEqual(cleared.world,expected,'Whole allocation cycle returns exactly all of the selected original troops and preserves the rest of the measured world');
  await back(label+' continuing distribution picker exit');await mapReturn(label+' distribution return');
  entry.returned=await mark();assert.deepEqual(entry.returned.world,cleared.world,'Returning to the map preserves committed distribution');
  assert.equal(entry.returned.state.hud.visible,true);
  for(const [key,value]of Object.entries(entry.returned.state.expected))assert.equal(entry.returned.state.hud[key],value,'Returned HUD matches actual '+key);
  entry.accepted=true;await checkpoint(label+'-map');
}
