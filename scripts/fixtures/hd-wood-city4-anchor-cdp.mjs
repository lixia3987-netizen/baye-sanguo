// Controlled transport model only. This file has no browser, socket, server or native engine.
// All trusted/pointer/SAVE fields below are fixture data, never actual gameplay evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {city4ObserverSource,city4TicketExpression,city4ProtectedReadExpression} from '../hd-wood-city4-ticket-view.mjs';

const copy=structuredClone,next=n=>((n+1)>>>0)||1;
const expectedCodes=Object.freeze([35,39,39,40,35,39,39]);
const keyCode=Object.freeze({ArrowUp:34,ArrowDown:35,Enter:39,Escape:40});
const sha=b=>createHash('sha256').update(b).digest('hex');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

function saveStages(input,loaded){
 const before=copy(loaded),beforeChoice=copy(before),cursor=copy(before),beforeRecord=copy(before),after=copy(before),generation=before.state.snapshot.spe.generation;
 beforeChoice.state.keys++;beforeChoice.state.overworld='other';beforeChoice.state.march.pick=0;
 beforeChoice.state.menu={...before.state.menu,active:1,context:2,kind:1,index:0,count:3,seq:next(before.state.menu.seq),generation,detailGeneration:generation,idsValid:false,ids:[],itemLen:8,names:['策略结束','存储进度','结束游戏'],packedNames:['策略结束','存储进度','结束游戏']};
 cursor.state.keys+=2;cursor.state.overworld='other';cursor.state.march.pick=0;cursor.state.menu={...copy(beforeChoice.state.menu),index:1};
 beforeRecord.state.keys+=3;beforeRecord.state.overworld='other';beforeRecord.state.march.pick=0;
 beforeRecord.state.menu={...beforeChoice.state.menu,active:0,context:0,kind:0,index:1,seq:next(beforeChoice.state.menu.seq)};
 beforeRecord.state.record={...before.state.record,active:1,mode:1,index:0,count:3,seq:next(before.state.record.seq)};
 after.state.keys+=4;after.state.menu=copy(beforeRecord.state.menu);after.state.record={...beforeRecord.state.record,active:0,mode:0,count:0,seq:next(beforeRecord.state.record.seq)};
 after.state.march.mapInputSeq=next(before.state.march.mapInputSeq);
 after.state.snapshot.report={...after.state.snapshot.report,text:'存储中...',seq:((before.state.snapshot.report.seq+1)&65535)||1,kind:1,person:65535,active:0};
 return{before,beforeChoice,cursor,beforeRecord,after,pair:copy(input.pair)};
}

/** A fixed seven-key public LOAD + anchor SAVE model. No evaluated expression is
 * executed: the allowlisted strings below are answered with complete fixture
 * values, while the production adapter/formal predicates perform their own work. */
export function createControlledAnchorCdp(input,{beforeDispatch=null,failDispatchIndex=null,dispatchError=null}={}){
 const loaded=copy(input.historyProof.lastTicket);loaded.state.keys=3;loaded.state.overworld='map';loaded.meta.overworldMode='hd-map';
 // Model a distinct fresh epoch. No claim of cross-process RNG/reference continuity.
 loaded.meta.identity.generation+=70;loaded.state.snapshot.library=copy(loaded.meta.identity);
 for(const key of Object.keys(loaded.state.snapshot.references))if(Number.isInteger(loaded.state.snapshot.references[key]))loaded.state.snapshot.references[key]+=12000;
 loaded.state.snapshot.spe.generation+=70;loaded.state.menu.generation=loaded.state.snapshot.spe.generation;loaded.state.menu.detailGeneration=loaded.state.snapshot.spe.generation;
 for(const h of loaded.meta.recruitmentHookFence.hooks)if(Number.isInteger(h.functionRef))h.functionRef+=1200;
 loaded.meta.recruitmentHookFence.callHook.functionRef+=1200;loaded.meta.controlledFreshAnchorFixture={sourceOnly:true,actualTransport:false};
 const stages=saveStages(input,loaded),keys=[],pointers=[],calls=[],dispatches=[];
 let phase=0,mode='hd-map',panelHidden=true,activeMouse=null,closeCalls=0;
 const points=new Map(),fixedPoint=(selector,x,y)=>{const p={x,y,rect:{x:x-50,y:y-25,width:100,height:50},tag:selector==='#baye-game-focus'?'SPAN':'BUTTON',hitTag:selector==='#baye-game-focus'?'SPAN':'BUTTON',selector};points.set(x+':'+y,selector);return p;};
 const focusPoint=fixedPoint('#baye-game-focus',60,60);
 const focusValue=()=>({accepted:true,selector:'#baye-game-focus',point:{x:60,y:60},checks:{controlledFixture:true},region:{tag:'SPAN',id:'baye-game-focus',parentId:'baye-hd-toolbar',role:'note',text:'键盘操作'},hit:{tag:'SPAN',id:'baye-game-focus'}});
 function ticket(){
  assert.ok(phase>=3,'The controlled transport has no full title-game ticket');
  const t=copy(phase===3?stages.before:phase===4?stages.beforeChoice:phase===5?stages.cursor:phase===6?stages.beforeRecord:stages.after);
  t.meta.overworldMode=mode;return t;
 }
 function owner(){
  if(phase>=3){const s=ticket().state;return{qty:s.qty,menu:s.menu,record:s.record,march:s.march,report:s.snapshot.report};}
  const s=copy(loaded.state);s.qty.active=0;s.record.active=phase===2?1:0;
  Object.assign(s.record,{mode:phase===2?2:0,index:0,count:phase===2?4:0});
  Object.assign(s.menu,{active:phase===2?0:1,context:phase===2?0:4,kind:phase===2?0:1,index:phase===1?1:0,count:4});
  return{qty:s.qty,menu:s.menu,record:s.record,march:s.march,report:s.snapshot.report};
 }
 function system(){
  const o=owner(),r=o.record,m=o.menu;
  if(r.active)return{open:true,showHd:true,screen:'saveload',pending:false,idleIndex:0,recordMode:r.mode,recordSeq:r.seq,input:{type:'record',screen:'saveload',seq:r.seq,index:0,mode:r.mode,count:r.count}};
  if(m.active)return{open:true,showHd:true,screen:phase<3?'title':'insystem',pending:false,idleIndex:m.index,input:{type:'menu',screen:phase<3?'title':'insystem',seq:m.seq,index:m.index,count:m.count,context:m.context,kind:m.kind}};
  return{open:false,showHd:true,screen:'none',pending:false,idleIndex:0,input:null};
 }
 function event(type,selector,p){const id=selector==='#baye-game-focus'?'baye-game-focus':'';return{at:pointers.length,type,trusted:true,x:p.x,y:p.y,tag:id?'SPAN':'BUTTON',id,overworld:selector.includes('data-hd-overworld')?(selector.includes('"classic"')?'classic':'hd-map'):null,settingsToggle:selector.includes('data-hd-settings-toggle'),keys:keys.length};}
 function pointerClick(selector){
  if(selector.includes('data-hd-settings-toggle'))panelHidden=false;
  else if(selector.includes('data-hd-overworld')){mode=selector.includes('"classic"')?'classic':'hd-map';panelHidden=true;}
 }
 function runtime(expression){
  if(expression===city4ObserverSource)return{installed:true,originalSource:'controlled-fixture-no-native-function'};
  if(expression===city4TicketExpression)return ticket();
  if(expression===city4ProtectedReadExpression)return{ticket:ticket(),seed:1234567890,pair:copy(input.pair),journal:null};
  if(expression==='__city4MarchProbe.keys.length')return keys.length;
  if(expression==='__city4MarchProbe.pointers.length')return pointers.length;
  let match=expression.match(/^__city4MarchProbe\.keys\.slice\((\d+)(?:,(\d+))?\)$/);if(match)return copy(keys.slice(Number(match[1]),match[2]===undefined?undefined:Number(match[2])));
  match=expression.match(/^__city4MarchProbe\.pointers\.slice\((\d+)\)$/);if(match)return copy(pointers.slice(Number(match[1])));
  if(expression.includes('BayeSaveStorage.importSlot(0'))return{ok:true,identity:'v1:414390:1d36da77:1e9c0477',before:keys.length,after:keys.length,slot:{canLoad:true},pair:copy(input.pair)};
  if(expression.includes('const p=["baye//data//sango0.sav"'))return{info:{canLoad:true},lastError:null,files:[0,1].map(i=>({hex:input.pair['sav'+i],lib:'libs/dat-mod.lib',identity:'v1:414390:1d36da77:1e9c0477'}))};
  if(expression==='({qty:baye.hd.qty(),menu:baye.hd.menuItems(),record:baye.hd.record(),march:baye.hd.march(),report:baye.hd.report()})')return owner();
  if(expression==='BayeHdSystemUi.debugSnapshot()')return system();
  if(expression==='({record:baye.hd.record(),system:BayeHdSystemUi.debugSnapshot()})')return{record:owner().record,system:system()};
  if(expression==='({hidden:document.getElementById("baye-hd-settings-panel").hidden})')return{hidden:panelHidden};
  if(expression.includes("const e=document.getElementById('baye-game-focus')")){points.set(focusPoint.x+':'+focusPoint.y,'#baye-game-focus');return focusValue();}
  if(expression.includes('document.activeElement'))return{tag:'BODY',editable:false};
  match=expression.match(/document\.querySelector\(("(?:[^"\\]|\\.)*")\)/);
  if(match){const selector=JSON.parse(match[1]);assert.ok(selector.startsWith('#baye-hd-toolbar '),'Fixed public presentation selector');const x=selector.includes('data-hd-settings-toggle')?180:selector.includes('"classic"')?300:420;return fixedPoint(selector,x,60);}
  if(expression.startsWith('BayeHdOverworld.getMode()===')){const modeMatch=expression.match(/===("[^"]+")/);return mode===JSON.parse(modeMatch[1])&&panelHidden;}
  if(expression.includes('const owner={qty:baye.hd.qty()')&&expression.includes('?{owner,system}:null')){assert.ok(phase===5||phase===6,'Only the fixed native SAVE owner can have a fixture ACK');return{owner:owner(),system:system()};}
  if(expression.includes('m.context===4')&&expression.includes('m.index===0'))return phase===0;
  if(expression.startsWith('baye.hd.menuItems().context===4'))return phase===1;
  if(expression.includes('r.mode===2')&&expression.includes('r.count===4'))return phase===2;
  if(expression.includes('m.context===2')&&expression.includes('m.index===0'))return phase===4;
  if(expression==='baye.hd.menuItems().context===2&&baye.hd.menuItems().index===1')return phase===5;
  if(expression.includes('r.mode===1')&&expression.includes('r.count===3'))return phase===6;
  if(expression.startsWith('!baye.hd.menuItems().active'))return phase===3||phase===7;
  if(expression.startsWith('!baye.hd.record().active'))return phase===7;
  throw Error('Unexpected controlled CDP expression: '+expression.slice(0,180));
 }
 const cdp={async send(method,params={}){
  calls.push({method,expression:method==='Runtime.evaluate'?params.expression:null});
  if(method==='Runtime.evaluate')return{result:{value:copy(runtime(params.expression))}};
  if(method==='Page.captureScreenshot')return{data:png};
  if(method==='Input.dispatchMouseEvent'){
   const selector=points.get(params.x+':'+params.y);assert.ok(selector,'Only a fixed measured fixture point');
   if(params.type==='mousePressed'){activeMouse={selector,params:copy(params)};pointers.push(event('mousedown',selector,params));}
   else{assert.equal(params.type,'mouseReleased');assert.equal(activeMouse?.selector,selector);pointers.push(event('mouseup',selector,params));pointers.push(event('click',selector,params));activeMouse=null;pointerClick(selector);}return{};
  }
  if(method==='Input.dispatchKeyEvent'){
   dispatches.push(copy(params));assert.ok(['keyDown','keyUp'].includes(params.type));
   if(params.type==='keyDown'){
    const index=keys.length,code=keyCode[params.key];assert.equal(code,expectedCodes[index],'Only the original seven controlled LOAD/SAVE keys');
    beforeDispatch?.({index,code,phase,params:copy(params)});
    if(index===failDispatchIndex)throw dispatchError;
    const z=phase>=3?ticket().state.snapshot:loaded.state.snapshot;
    keys.push({code,generation:z.spe.generation,speActive:0,resultActive:false,fight:copy(z.fight)});phase++;
   }return{};
  }
  throw Error('Unallowlisted controlled CDP method: '+method);
 },close(){closeCalls++;throw Error('No cleanup allowed in a controlled anchor transport');}};
 const session={identity:{kind:'controlled-origin-anchor-session'},cdp};
 return{cdp,session,calls,keys,pointers,dispatches,stages,stats:()=>({phase,keys:keys.length,dispatches:dispatches.length,runtimeReads:calls.filter(c=>c.method==='Runtime.evaluate').length,closeCalls,actualNativeInputs:0,actualBrowserRuns:0}),currentTicket:ticket,fixturePairPins:[0,1].map(i=>{const b=Buffer.from(input.pair['sav'+i],'hex');return{key:'sav'+i,bytes:b.length,sha256:sha(b)};})};
}
