// Real-browser checks only. The caller owns original boot, source freeze, CDP and cleanup.
// Context: report/evaluate/until/delay/checkpoint/ready/controlPoint/tap/touches/
// readKeys/worldSame/mapReadySource/metrics/headerGeometry/mark. No native writes.
import assert from 'node:assert/strict';

const SHA = '3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e';
const browser = fn => '(' + fn.toString() + ')()';

function overviewProbe() {
  const d = baye.data, ui = BayeHdMiniMap.debugSnapshot(), native = baye.hd.miniMap();
  const rect = n => { if (!n) return null; const r = n.getBoundingClientRect();
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
  const shown = n => { if (!n) return false; for (let p=n;p&&p.nodeType===1;p=p.parentElement) {
    const s=getComputedStyle(p); if(p.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;
  } const r=rect(n); return r.width>0&&r.height>0; };
  const visible = n => {
    if(!shown(n))return false;
    const r=rect(n),clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
    for(let p=n.parentElement;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p),a=rect(p);
      if(['auto','scroll','hidden','clip'].includes(s.overflowX)){clip.left=Math.max(clip.left,a.left+p.clientLeft);clip.right=Math.min(clip.right,a.left+p.clientLeft+p.clientWidth);}
      if(['auto','scroll','hidden','clip'].includes(s.overflowY)){clip.top=Math.max(clip.top,a.top+p.clientTop);clip.bottom=Math.min(clip.bottom,a.top+p.clientTop+p.clientHeight);}}
    if(r.left<clip.left-.5||r.right>clip.right+.5||r.top<clip.top-.5||r.bottom>clip.bottom+.5)return false;
    const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return top===n||!!top&&n.contains(top);
  };
  const list=document.getElementById('hd-mini-map-cities'),canvas=document.getElementById('hd-mini-map-canvas');
  const rows=list?[...list.querySelectorAll('[data-hd-mini-city]')].map(n=>{
    const name=n.querySelector('span:not(.hd-mini-map-dot)'),label=n.querySelector('small');
    return {index:Number(n.getAttribute('data-hd-mini-city')),name:name&&name.textContent,label:label&&label.textContent,
      rect:rect(n),nameVisible:visible(name),labelVisible:visible(label)};
  }):[];
  return {native,ui,viewport:[innerWidth,innerHeight],cursor:{x:Number(d.g_CityPos.setx),y:Number(d.g_CityPos.sety),viewX:Number(d.g_CityPos.x),viewY:Number(d.g_CityPos.y)},
    mapCity:Number(d.g_hdMapCity),mapPick:Number(d.g_hdMapPick),mapInputSeq:Number(d.g_hdMapInputSeq),
    rootShown:shown(document.getElementById('hd-mini-map')),titleVisible:visible(document.getElementById('hd-mini-map-title')),
    summaryVisible:visible(document.getElementById('hd-mini-map-summary')),canvas:{shown:shown(canvas),visible:visible(canvas),rect:rect(canvas),width:canvas&&canvas.width,height:canvas&&canvas.height},
    list:list&&{rect:rect(list),clientHeight:list.clientHeight,scrollHeight:list.scrollHeight,scrollTop:list.scrollTop},rows,
    adapter:window.BayeHdMobileMiniMap&&BayeHdMobileMiniMap.snapshot(),
    hud:window.BayeHdMobile&&BayeHdMobile.snapshot()};
}

function actualCitiesProbe() {
  const d=baye.data,id=BayeHdLibIdentity.read(),all=BayeHdOverworld.getCities(),king=Number(d.g_PlayerKing);
  if(!Array.isArray(all)||all.length!==38)throw Error('Current original map does not publish 38 cities');
  const cities=Array.from({length:38},(_,index)=>({index,name:baye.getCityName(index),belong:Number(d.g_Cities[index].Belong),
    engineX:Number(d.g_CityPositions[index].x),engineY:Number(d.g_CityPositions[index].y)}));
  return {identity:{status:id.status,sha256:id.sha256,byteLength:id.byteLength,generation:id.generation,current:BayeHdLibIdentity.isCurrent(id)},king,cities,
    mapCities:all.map(c=>({index:c.index,name:c.name,belong:c.belong,kind:c.kind,engineX:c.engX,engineY:c.engY,source:c.source}))};
}

function canvasProbe() {
  const c=document.getElementById('hd-mini-map-canvas');
  if(!c||!c.width||!c.height)return {width:0,height:0,differentPixels:0};
  const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let differentPixels=0,opaquePixels=0;
  for(let i=0;i<a.length;i+=4){if(a[i]!==a[0]||a[i+1]!==a[1]||a[i+2]!==a[2]||a[i+3]!==a[3])differentPixels++;if(a[i+3])opaquePixels++;}
  return {width:c.width,height:c.height,differentPixels,opaquePixels};
}

function listPanProbe() {
  const n=document.getElementById('hd-mini-map-cities');if(!n)return null;
  const r=n.getBoundingClientRect(),clip={left:Math.max(0,r.left+n.clientLeft),right:Math.min(innerWidth,r.left+n.clientLeft+n.clientWidth),
    top:Math.max(0,r.top+n.clientTop),bottom:Math.min(innerHeight,r.top+n.clientTop+n.clientHeight)};
  for(let p=n.parentElement;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p),a=p.getBoundingClientRect();
    if(p.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return null;
    if(['auto','scroll','hidden','clip'].includes(s.overflowX)){clip.left=Math.max(clip.left,a.left+p.clientLeft);clip.right=Math.min(clip.right,a.left+p.clientLeft+p.clientWidth);}
    if(['auto','scroll','hidden','clip'].includes(s.overflowY)){clip.top=Math.max(clip.top,a.top+p.clientTop);clip.bottom=Math.min(clip.bottom,a.top+p.clientTop+p.clientHeight);}}
  const x=(clip.left+clip.right)/2,height=clip.bottom-clip.top,from={x,y:clip.bottom-14},to={x,y:clip.top+14};
  const top=document.elementFromPoint(from.x,from.y);
  return {clip,height,from,to,hit:top===n||!!top&&n.contains(top),scrollTop:n.scrollTop,scrollHeight:n.scrollHeight,clientHeight:n.clientHeight};
}

export async function runMobileMinimapChecks(context) {
  const {report,evaluate,until,delay,checkpoint,ready,controlPoint,tap,touches,readKeys,worldSame,mapReadySource,metrics,headerGeometry,mark}=context;
  for(const name of ['evaluate','until','delay','checkpoint','ready','controlPoint','tap','touches','readKeys','worldSame','metrics','headerGeometry','mark'])assert.equal(typeof context[name],'function','Missing minimap context '+name);
  assert.equal(typeof mapReadySource,'string');
  const viewport=await evaluate('[innerWidth,innerHeight]');
  assert.ok(viewport[0]===844&&viewport[1]===390||viewport[0]===667&&viewport[1]===375,'Dedicated original mobile landscape case');
  const label='minimap-'+viewport.join('x');
  const entry={label,viewport,rounds:[],negativeChecks:[],scrollChecks:[],accepted:false,fullHdAccepted:false,realDeviceAccepted:false,
    scope:'Current original 38-city SEARCH overview: trusted open/return, native city names/allegiance, actual drawing/visibility and readonly touch scrolling; no city-entry or month advancement'};
  report.minimapChecks??=[];report.minimapChecks.push(entry);
  const codes=async before=>(await readKeys(before.state.keyCount)).map(k=>typeof k==='number'?k:k.code);
  const sample=async()=>({...await mark(),overview:await evaluate(browser(overviewProbe))});
  const unchanged=(before,after,why)=>{
    worldSame(before,after,why);assert.deepEqual(after.overview.native,before.overview.native,why+' exact native overview');
    assert.deepEqual(after.native,before.native,why+' native owner/cursor');assert.deepEqual(after.overview.cursor,before.overview.cursor,why+' all native map cursor fields');
    assert.equal(after.state.keyCount,before.state.keyCount,why+' zero keys');assert.equal(after.state.touchCount,before.state.touchCount,why+' zero native LCD touches');
  };
  const point=async selector=>{const p=await controlPoint(selector);assert.ok(p.width>=43.5&&p.height>=43.5,'Minimap control >=44 CSS pixels '+selector);
    assert.ok(p.x>=0&&p.x<viewport[0]&&p.y>=0&&p.y<viewport[1],'Current control is inside landscape viewport');return p;};
  const expectedKind=(belong,king)=>belong===0?'empty':belong===king+1?'owned':'neutral';
  const expectedLabel=kind=>kind==='owned'?'我方':kind==='empty'?'空城':'他方';
  const checkRows=(capture,facts)=>{
    assert.equal(capture.rows.length,38);assert.equal(capture.ui.cities.length,38);
    assert.deepEqual(capture.rows.map(c=>c.index),Array.from({length:38},(_,i)=>i),'All actual DOM city indexes in original order');
    assert.deepEqual(capture.ui.cities.map(c=>c.index),Array.from({length:38},(_,i)=>i));
    for(const actual of facts.cities){const row=capture.rows[actual.index],ui=capture.ui.cities[actual.index],kind=expectedKind(actual.belong,facts.king);
      assert.equal(row.name,actual.name);assert.equal(row.label,expectedLabel(kind));assert.equal(ui.name,actual.name);assert.equal(ui.belong,actual.belong);assert.equal(ui.kind,kind);
      assert.equal(ui.engineX,actual.engineX);assert.equal(ui.engineY,actual.engineY);}
  };
  const opened=async()=>{await until('current complete mobile native SEARCH overview',
    '(() => {const n=baye.hd.miniMap(),s=BayeHdMiniMap.debugSnapshot();return n.active===1&&n.complete===1&&s.open&&s.complete&&!s.committed&&s.cities.length===38;})()');
    const s=await sample(),n=s.overview.native;
    assert.equal(n.protocolVersion,1);assert.equal(n.custom,0);assert.equal(n.defaultDraw,1);assert.equal(n.resourceId,75);assert.equal(n.imageIndex,0);
    assert.equal(n.width,84);assert.equal(n.height,64);assert.equal(n.mask,0);assert.equal(n.generation,n.detailGeneration);
    assert.ok(Number.isInteger(n.seq)&&n.seq>0&&Number.isInteger(n.mapInputSeq)&&n.mapInputSeq>0);assert.equal(n.mapInputSeq,s.overview.mapInputSeq);
    assert.equal(n.cursorX,s.overview.cursor.x);assert.equal(n.cursorY,s.overview.cursor.y);assert.equal(n.city1,s.overview.mapCity);
    assert.equal(s.overview.rootShown,true);assert.equal(s.overview.titleVisible,true);assert.equal(s.overview.summaryVisible,true);
    assert.equal(s.overview.canvas.visible,true);assert.equal(s.overview.ui.showLcd,false);
    if(s.overview.adapter)assert.equal(s.overview.adapter.active,true);
    await point('#hd-mini-map-return');return s;
  };
  await until('ordinary current MAP before SEARCH overview',mapReadySource);await headerGeometry(viewport);
  const facts=await evaluate(browser(actualCitiesProbe));assert.equal(facts.identity.status,'ready');assert.equal(facts.identity.current,true);
  assert.equal(facts.identity.sha256,SHA);assert.equal(facts.identity.byteLength,207195);assert.ok(facts.identity.generation>0);assert.equal(facts.cities.length,38);
  for(const actual of facts.cities){const map=facts.mapCities.find(c=>c.index===actual.index);assert.ok(map);assert.equal(map.name,actual.name);assert.equal(map.belong,actual.belong);assert.equal(map.kind,expectedKind(actual.belong,facts.king));
    assert.equal(map.source,'engine');assert.equal(map.engineX,actual.engineX);assert.equal(map.engineY,actual.engineY);}
  entry.originalCities=facts;
  for(let round=0;round<2;round++){
    await until('ordinary MAP before genuine overview open '+round,mapReadySource);
    assert.equal(await evaluate('baye.hd.miniMap().active'),0,'No residual native overview before open');
    const before=await mark(),openPoint=await point('#hd-mobile-map-overview');await tap(openPoint);
    const start=await opened();assert.deepEqual(await codes(before),[51],'One genuine SEARCH opens current MAP overview');
    worldSame(before,start,'Opening readonly SEARCH');assert.deepEqual(start.native.cursor,before.native.cursor,'SEARCH does not move native cursor');
    assert.equal(start.state.touchCount,before.state.touchCount,'Opening overview uses no native LCD touch');
    if(round)assert.notEqual(start.overview.native.seq,entry.rounds[0].opened.overview.native.seq,'Reopening gets a fresh native sequence');
    checkRows(start.overview,facts);const bitmap=await evaluate(browser(canvasProbe));
    assert.ok(bitmap.width>0&&bitmap.height>0&&bitmap.differentPixels>1000&&bitmap.opaquePixels>1000,'Actual minimap canvas is drawn beyond a flat fill');
    const seen=new Set(),scrolls=[];let current=start;
    for(let pass=0;pass<48;pass++){
      checkRows(current.overview,facts);for(const row of current.overview.rows)if(row.nameVisible&&row.labelVisible)seen.add(row.index);
      if(seen.size===38)break;
      const gesture=await evaluate(browser(listPanProbe));assert.ok(gesture&&gesture.hit&&gesture.height>=50,'Real list viewport supports trusted pan');
      assert.ok(gesture.scrollHeight>gesture.clientHeight,'Unseen city rows have genuine scroll overflow');
      const old=current;await touches('touchStart',[gesture.from],0);await touches('touchMove',[{x:gesture.from.x,y:(gesture.from.y+gesture.to.y)/2}],35);
      await touches('touchMove',[gesture.to],35);await touches('touchEnd');await delay(150);current=await sample();
      const evidence={round,pass,before:old,after:current,gesture};entry.scrollChecks.push(evidence);scrolls.push(evidence);
      unchanged(old,current,'Trusted readonly city-list pan');assert.ok(current.overview.list.scrollTop>old.overview.list.scrollTop,'Trusted pan advances actual list scroll');
    }
    assert.equal(seen.size,38,'Every original city name and allegiance was visible and hit-tested after genuine touch pans');
    assert.ok(current.overview.rows[37].nameVisible&&current.overview.rows[37].labelVisible,'Last actual city row is visible');
    await checkpoint(label+'-round-'+(round+1)+'-38-cities');
    if(round===0){
      for(const type of ['touchcancel','multitouch','held-rotation']){
        const old=await sample(),p=await point('#hd-mini-map-return');
        if(type==='touchcancel'){await touches('touchStart',[p]);await touches('touchCancel');}
        else if(type==='multitouch'){await touches('touchStart',[{...p,id:1},{x:p.x+8,y:p.y,id:2}]);await touches('touchEnd');}
        else {await touches('touchStart',[p]);await metrics(viewport[1],viewport[0]);
          assert.equal(await evaluate('innerWidth<innerHeight'),true,'Held pointer crosses a real portrait boundary');
          await metrics(...viewport);await until('overview restored after portrait boundary','BayeHdMiniMap.debugSnapshot().open&&BayeHdMiniMap.debugSnapshot().complete');await touches('touchEnd');}
        await delay(150);const after=await sample();unchanged(old,after,'Retired '+type+' return gesture');
        assert.equal(after.overview.ui.open,true,'Cancelled return cannot dismiss current native overlay');entry.negativeChecks.push({type,before:old,after,point:p});
      }
    }
    const closing=await sample(),returnPoint=await point('#hd-mini-map-return');await tap(returnPoint);
    await until('single EXIT retires native overview and restores ordinary MAP',
      'baye.hd.miniMap().active===0&&!BayeHdMiniMap.debugSnapshot().open');await until('HD MAP/HUD restored after SEARCH',mapReadySource);
    const returned=await sample();assert.deepEqual(await codes(closing),[40],'One trusted current-return EXIT only');worldSame(before,returned,'SEARCH return');
    assert.deepEqual(returned.native.cursor,before.native.cursor);assert.deepEqual(returned.overview.cursor,start.overview.cursor);
    assert.equal(returned.state.touchCount,before.state.touchCount);assert.equal(returned.state.hud.visible,true);
    assert.ok(returned.state.expected);for(const [k,v] of Object.entries(returned.state.expected))assert.equal(returned.state.hud[k],v,'Returned HUD equals current native '+k);
    entry.rounds.push({round:round+1,before,opened:start,openPoint,bitmap,visibleCities:[...seen].sort((a,b)=>a-b),scrolls,closing,returnPoint,returned,keys:[51,40]});
    await checkpoint(label+'-round-'+(round+1)+'-returned-map');
  }
  assert.equal(entry.rounds.length,2);assert.equal(entry.negativeChecks.length,3);entry.accepted=true;
  return entry;
}
