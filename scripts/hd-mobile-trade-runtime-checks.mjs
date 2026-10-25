// Actual original transactions. Read native state; drive only trusted visible touch controls.
import assert from 'node:assert/strict';
import {calculateMobileTradeLimit,verifyMobileTrade,verifyMobileTradeCancellation} from './hd-mobile-trade-runtime-oracle.mjs';
import {checkMobileQuantityPresentation} from './hd-mobile-quantity-runtime-checks.mjs';

const next=n=>(n+1)>>>0||1,following=n=>next(next(n));
const selectedCodes=(index,current)=>[...Array(Math.abs(index-current)).fill(index>current?35:34),39];

export async function runMobileTradeChecks(ctx){
  const {report,evaluate,until,checkpoint,ready,root,submenu,selectPerson,back,controlPoint,touchButton,
    tap,touches,readKeys,worldSame,testCity,mark,libBytes,label}=ctx;
  const entry={label,cityIndex:testCity.index,checks:[],operations:[],cancellations:[],summaries:[],accepted:false};
  report.tradeChecks.push(entry);entry.baseline=await mark();
  const residents=w=>{const c=w.cities[testCity.index];return w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons).filter(id=>w.people[id].Belong===c.Belong);};
  const visible=async selectors=>{
    const found=await evaluate(`(() => {for(const s of ${JSON.stringify(selectors)}){const n=document.querySelector(s);if(!n||n.disabled)continue;let shown=true;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const c=getComputedStyle(p);if(p.hidden||c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0)shown=false;}const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(shown&&r.width>0&&r.height>0&&(hit===n||n.contains(hit)))return s;}return null;})()`);
    assert.ok(found,'Current unobstructed trade control '+selectors.join(', '));return found;
  };
  const person=async(seq)=>{
    await until('fresh complete original trade PERSON',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),o=s.deepMenuOwner;
      return m.active===1&&m.context===1&&m.kind===3&&m.seq===${seq}&&m.index===0&&m.idsValid&&m.ids.length===m.count&&
        s.open&&s.cityIndex===${testCity.index}&&s.layer==='deep'&&s.deepLabel==='交易'&&!s.sending&&!s.queueLen&&o&&o.seq===m.seq&&o.detailGeneration===m.detailGeneration&&
        s.deepItems.length===m.count&&m.ids.every((id,i)=>s.deepItems.find(v=>v.i===i)?.pind===id);})()`);
    const after=await ready();assert.deepEqual(after.state.menu.ids,residents(after.world));return after;
  };
  const currentMap=async(before,{committed=false,actor=null,orderIndex=null}={})=>{
    await until('trade command finished actual current map',`(() => {const m=baye.hd.menuItems(),q=baye.hd.qty(),r=baye.hd.report(),s=BayeHdCityMenu.debugSnapshot(),h=BayeHdMobile.refresh(),a=BayeHdMobileMap.refresh(),p=BayeHdOverworld.debugSnapshot();
      if(m.active||q.active||r.active||m.context||m.kind||s.open||s.sending||s.queueLen||Number(baye.data.g_hdMapPick)!==1||Number(baye.data.g_hdMapCity)!==${testCity.index+1}||!h.visible||!a.active||!p.presentationReady||p.mode!=='hd-map')return false;
      ${committed?`const c=baye.data.g_Cities[${testCity.index}],o=baye.data.g_OrderQueue[${orderIndex}],ids=Array.from(baye.data.g_PersonsQueue).slice(Number(c.PersonQueue),Number(c.PersonQueue)+Number(c.Persons));if(ids.includes(${actor})||Number(o.OrderId)!==11||Number(o.Person)!==${actor}||Number(o.City)!==${testCity.index}||Number(o.TimeCount)!==0)return false;`:''}
      return true;})()`);
    const after=await ready();assert.equal(after.state.menu.seq,committed?before.state.menu.seq:next(before.state.menu.seq));
    assert.equal(after.state.march.mapInputSeq,next(before.state.march.mapInputSeq));
    const c=after.world.cities[testCity.index];assert.equal(after.state.hud.money,String(c.Money));assert.equal(after.state.hud.food,String(c.Food));assert.equal(after.state.hud.arms,String(c.MothballArms));
    for(const[k,v]of Object.entries(after.state.expected))assert.equal(after.state.hud[k],v);return after;
  };
  const exactSelection=async(before,index,why)=>{const keys=await readKeys(before.state.keyCount);assert.deepEqual(keys.map(k=>k.code),selectedCodes(index,before.state.menu.index),why);return keys;};
  const summary=async(side,sample)=>{
    const t=await evaluate('BayeHdCityMenu.getTradePresentation()'),c=sample.world.cities[testCity.index],q=sample.state.qty;
    assert.ok(t&&t.stage==='quantity');assert.equal(t.direction,side);assert.equal(t.cityIndex,testCity.index);assert.equal(t.cityName,testCity.name);
    assert.equal(t.money,c.Money);assert.equal(t.food,c.Food);assert.equal(t.unitPrice,side==='buy'?5:2);
    assert.equal(t.session,q.session);assert.equal(t.inputSeq,q.inputSeq);assert.equal(t.value,q.value);assert.equal(t.min,q.min);assert.equal(t.max,q.max);
    assert.equal(t.personName,await evaluate(`baye.getPersonName(${t.personId})`));
    const display=await evaluate(`(() => {const n=document.getElementById('hd-dialog-body');return {purpose:n.getAttribute('data-hd-quantity-purpose'),text:n.textContent,title:document.getElementById('hd-dialog-title').textContent};})()`);
    assert.equal(display.purpose,'trade');assert.equal(display.title,side==='buy'?'买入粮草':'卖出粮草');
    for(const text of [t.cityName+' · '+t.personName,`城内钱 ${c.Money} · 粮 ${c.Food} · 每粮 ${t.unitPrice} 钱`,`当前 ${q.value}（${q.min}–${q.max}）。`])assert.ok(display.text.includes(text),'Current original trade summary '+text);
    entry.summaries.push({side,presentation:t,display,geometry:await checkMobileQuantityPresentation(evaluate,label+' '+side)});return t;
  };
  const type=async(actor)=>{
    const chosen=await selectPerson(actor,'交易');
    await until('dedicated original buy/sell type owner',`(() => {const m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot();return m.active===1&&m.context===1&&m.kind===5&&m.seq===${following(chosen.before.state.menu.seq)}&&m.count===2&&m.names.length===2&&s.open&&!s.sending&&!s.queueLen&&BayeHdCityMenu.getTradePresentation()?.stage==='exchange';})()`);
    const after=await ready();worldSame(chosen.before,after,'Choose trade actor');assert.equal(after.state.menu.index,0);
    entry.checks.push({kind:'actor-to-type',actor,chosen,after,keys:await exactSelection(chosen.before,chosen.index,'Exact actual trade actor selection')});return after;
  };
  const noInput=async(selector,why)=>{
    const before=await ready(),point=await controlPoint(selector);await touches('touchStart',[point]);await touches('touchCancel');
    const after=await ready();worldSame(before,after,why);assert.deepEqual(after.native,before.native);const keys=await readKeys(before.state.keyCount);assert.deepEqual(keys,[]);
    entry.checks.push({kind:'touch-cancel',why,selector,point,before,after,keys});
  };
  const quantity=async(side)=>{
    const before=await ready(),index=side==='buy'?0:1;
    // These are the dedicated trade type controls, never PERSON/GOODS rows.
    const selector=`#hd-city-menu-deep [data-hd-deep="${index}"][data-hd-menu-kind="5"]`;await touchButton(selector);
    await until('genuine '+side+' quantity with native ACK',`(() => {const q=baye.hd.qty(),s=BayeHdCityMenu.debugSnapshot(),t=BayeHdCityMenu.getTradePresentation();return q.active===1&&q.protocol&&q.ready===1&&q.session>0&&BayeHdCityMenu.isQtyLive()&&!s.sending&&!s.queueLen&&t&&t.stage==='quantity'&&t.direction===${JSON.stringify(side)};})()`);
    const after=await ready();worldSame(before,after,'Choose '+side+' type');assert.equal(after.state.menu.seq,next(before.state.menu.seq));
    assert.equal(after.state.menu.active,0);const t=await evaluate('BayeHdCityMenu.getTradePresentation()');
    const limit=calculateMobileTradeLimit({world:after.world,cityIndex:testCity.index,personId:t.personId,side,libBytes});
    const q=after.state.qty;assert.equal(q.min,limit.minimum);assert.equal(q.max,limit.maximum);assert.equal(q.value,limit.initialValue);assert.equal(q.step,1);
    await summary(side,after);
    const keys=await exactSelection(before,index,'Exact actual '+side+' type selection');
    entry.checks.push({kind:'type-to-quantity',side,before,after,keys,presentation:t,limit});return {opened:after,actor:t.personId,limit};
  };
  const cancelType=async()=>{
    const before=await ready();await back('cancel actual buy/sell type');const after=await person(following(before.state.menu.seq));
    const keys=await readKeys(before.state.keyCount);assert.deepEqual(keys.map(k=>k.code),[40]);
    entry.cancellations.push({kind:'type',before,after,keys,oracle:verifyMobileTradeCancellation({before:before.world,after:after.world,libBytes})});return after;
  };
  const cancelQty=async(side)=>{
    const before=await ready(),q=before.state.qty;await back('cancel actual '+side+' quantity');const after=await person(next(before.state.menu.seq)),keys=await readKeys(before.state.keyCount);
    assert.deepEqual(keys.map(k=>k.code),[40]);assert.equal(after.state.qty.session,q.session);assert.equal(after.state.qty.inputSeq,next(q.inputSeq));assert.equal(after.state.qty.lastKey,40);assert.equal(after.state.qty.active,0);assert.equal(after.state.qty.ready,0);
    entry.cancellations.push({kind:'quantity',side,before,after,keys,oracle:verifyMobileTradeCancellation({before:before.world,after:after.world,libBytes})});return after;
  };
  const edit=async(selector,key,value)=>{
    const before=await ready(),q=before.state.qty;await touchButton(selector);
    await until('exact trade quantity ACK '+key,`(() => {const q=baye.hd.qty();return q.active===1&&q.ready===1&&q.session===${q.session}&&q.inputSeq===${next(q.inputSeq)}&&q.lastKey===${key}&&q.value===${value};})()`);
    const after=await ready(),keys=await readKeys(before.state.keyCount);assert.deepEqual(keys.map(k=>k.code),[key]);worldSame(before,after,'Uncommitted quantity edit');
    assert.equal(after.state.qty.min,q.min);assert.equal(after.state.qty.max,q.max);assert.equal(after.state.qty.step,1);entry.checks.push({kind:'quantity-edit',selector,key,value,before,after,keys});return after;
  };
  const commit=async(side,actor)=>{
    const opened=await quantity(side);assert.equal(opened.actor,actor);
    await noInput(await visible(['#hd-dialog [data-hd-dlg-ok]','#hd-city-menu [data-hd-qty-ok]']),'Trade quantity cancelled press');
    await edit(await visible(['#hd-dialog [data-hd-qty-bound]','#hd-city-menu [data-hd-qty-bound]']),38,1);
    const adjusted=await edit(await visible(['#hd-dialog [data-hd-qty="1"]','#hd-city-menu [data-hd-qty="1"]']),34,2);
    await summary(side,adjusted);await checkpoint(label+'-'+side+'-quantity');
    const before=await ready(),q=before.state.qty,selector=await visible(['#hd-dialog [data-hd-dlg-ok]','#hd-city-menu [data-hd-qty-ok]']),point=await controlPoint(selector);assert.equal(q.value,2);assert.equal(q.session,adjusted.state.qty.session);await tap(point);
    const after=await currentMap(before,{committed:true,actor,orderIndex:opened.limit.orderIndex}),keys=await readKeys(before.state.keyCount);
    assert.deepEqual(keys.map(k=>k.code),[39]);assert.equal(after.state.touchCount,before.state.touchCount);assert.equal(after.state.qty.session,q.session);assert.equal(after.state.qty.inputSeq,next(q.inputSeq));assert.equal(after.state.qty.lastKey,39);assert.equal(after.state.qty.ready,0);
    const oracle=verifyMobileTrade({before:before.world,after:after.world,cityIndex:testCity.index,personId:actor,side,quantity:q.value,libBytes});
    entry.operations.push({side,actor,opened,before,after,selector,point,keys,oracle});await checkpoint(label+'-'+side+'-map');return after;
  };
  const open=async()=>{await root(0,'内政');const picker=await submenu('交易');assert.equal(picker.state.menu.index,0);return picker;};
  const actor=w=>residents(w).find(id=>id!==w.king&&w.people[id].Thew>=12);
  let picker=await open(),buyer=picker.state.menu.ids.slice(1).find(id=>id!==picker.world.king&&picker.world.people[id].Thew>=12);assert.ok(Number.isInteger(buyer));assert.ok(picker.state.menu.ids.indexOf(buyer)>0,'Use a nonzero actual PERSON row so cancellation index reset is observable');
  await type(buyer);await noInput('#hd-city-menu-deep [data-hd-deep="0"][data-hd-menu-kind="5"]','Trade type cancelled press');await checkpoint(label+'-type');await cancelType();
  await type(buyer);await quantity('buy');await cancelQty('buy');await type(buyer);await commit('buy',buyer);
  picker=await open();const seller=actor(picker.world);assert.ok(Number.isInteger(seller)&&seller!==buyer,'Successful buyer left current resident list');
  await type(seller);await quantity('sell');await cancelQty('sell');await type(seller);await commit('sell',seller);
  picker=await open();const before=await ready();await back('leave trade PERSON');const returned=await currentMap(before);worldSame(before,returned,'Leave final trade PERSON');
  entry.cancellations.push({kind:'person',before,after:returned,keys:await readKeys(before.state.keyCount)});
  entry.returned=returned;assert.equal(entry.operations.length,2);entry.accepted=true;return entry;
}
