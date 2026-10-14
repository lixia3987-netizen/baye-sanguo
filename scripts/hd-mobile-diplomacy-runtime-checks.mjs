// Actual diplomacy checks; the runner exclusively owns browser/server/profile lifecycle.
import assert from 'node:assert/strict';
import {getMobileDiplomacyCandidates,calculateMobileDiplomacyLimit,verifyMobileDiplomacy,verifyMobileDiplomacyCancellation} from './hd-mobile-diplomacy-runtime-oracle.mjs';
const next=n=>(n+1)>>>0||1,following=n=>next(next(n));
const selectedCodes=(index,current)=>[...Array(Math.abs(index-current)).fill(index>current?35:34),39];
const names={15:'离间',16:'招揽',17:'策反',19:'劝降'};
export async function runMobileDiplomacyChecks(c){
 const {report,evaluate,until,delay,checkpoint,ready,root,submenu,controlPoint,tap,touches,readKeys,worldSame,testCity,mark,libBytes,label,mapReadySource}=c;
 const origin=testCity.index,entry={label,cityIndex:origin,actions:[],cancellations:[],operations:[],scrollChecks:[],accepted:false,monthEffectsAccepted:false,fullHdAccepted:false};
 report.diplomacyChecks??=[];report.diplomacyChecks.push(entry);entry.baseline=await mark();
 assert.equal(report.actualKing.name,'董卓');assert.equal(origin,10);assert.equal(testCity.name,'长安');
 const initial=getMobileDiplomacyCandidates({world:entry.baseline.world,cityIndex:origin,command:16,libBytes});
 assert.ok(initial.actors.filter(id=>entry.baseline.world.people[id].Thew>=20).length>=4,'Four real resident actors; no recruitment/month/data edits');
 assert.ok(entry.baseline.world.cities[origin].Money>=200,'Actual money covers four50-cost dispatches');
 const keys=async before=>(await readKeys(before.state.keyCount)).map(row=>row.code);
 const protocol=(s,command,phase)=>{const d=s.state.diplomacy;assert.ok(d&&d.protocolVersion===1&&d.command===command&&d.phase===phase&&d.origin===origin&&d.session>0&&d.inputSeq>0&&d.generation>0);assert.equal(d.active,phase===5?0:1);return d;};
 const noLcd=(a,b)=>assert.equal(b.state.touchCount,a.state.touchCount,'HD diplomacy leaks no native LCD touches');
 const picker=async(command,phase,seq=null)=>{
  const expression='(() => {const d=baye.hd.diplomacy(),m=baye.hd.menuItems(),s=BayeHdCityMenu.debugSnapshot(),p=BayeHdCityMenu.getDiplomacyPresentation(),o=s.deepMenuOwner;return d&&d.protocolVersion===1&&d.active===1&&d.command==='+command+'&&d.phase==='+phase+'&&d.origin==='+origin+'&&d.session>0&&d.inputSeq>0&&d.generation>0&&m.active===1&&m.context===1&&m.kind===3&&m.idsValid&&m.count>0&&m.ids.length===m.count&&m.names.length===m.count&&s.open&&s.showHd&&s.cityIndex==='+origin+'&&s.layer==="deep"&&s.deepLabel==='+JSON.stringify(names[command])+'&&!s.sending&&!s.queueLen&&o&&o.seq===m.seq&&o.context===m.context&&o.kind===m.kind&&o.detailGeneration===m.detailGeneration&&s.deepCount===m.count&&s.deepItems.every((x,i)=>x.i===i&&x.pind===m.ids[i])&&(() => {const rows=[...document.querySelectorAll("#hd-city-menu [data-hd-deep][data-hd-deep-pind]")];return rows.length===m.count&&rows.every((n,i)=>Number(n.getAttribute("data-hd-deep"))===i&&Number(n.getAttribute("data-hd-deep-pind"))===m.ids[i]);})()&&p&&p.command===d.command&&p.phase===d.phase&&p.session===d.session&&p.inputSeq===d.inputSeq&&p.menuSeq===m.seq'+(seq===null?'':'&&m.seq==='+seq)+';})()';
  await until('complete current '+names[command]+' '+(phase===1?'actor':'target')+' PERSON',expression);
  const sample=await ready(),d=protocol(sample,command,phase),lists=getMobileDiplomacyCandidates({world:sample.world,cityIndex:origin,command,libBytes}),m=sample.state.menu;
  assert.deepEqual(m.ids,phase===1?lists.actors:lists.targets,'Exact native ordered list');
  assert.deepEqual(m.names,await evaluate('baye.hd.menuItems().ids.map(id=>baye.getPersonName(id))'),'Native names correspond to actual publishedIDs');
  const p=await evaluate('BayeHdCityMenu.getDiplomacyPresentation()');assert.equal(p.role,phase===1?'actor':'target');assert.deepEqual(p.ids,m.ids);
  for(const key of ['actor','target','generation','session','inputSeq','command','phase','origin','commitSeq','commitResult'])assert.equal(p[key],d[key]);
  assert.equal(p.moneyCost,50);assert.equal(p.thewCost,command===19?10:20);assert.equal(p.thewPayer,command===15&&sample.world.config.fixAlienateComsumeThew===0?'target':'actor');
  if(phase===1){assert.equal(d.actor,65535);assert.equal(d.target,65535);}else{assert.ok(lists.actors.includes(d.actor));assert.equal(d.target,65535);}
  const role=await evaluate('(() => {const n=document.querySelector("[data-hd-diplomacy-role]");return n&&{role:n.getAttribute("data-hd-diplomacy-role"),text:n.textContent};})()');assert.ok(role&&role.text.includes(phase===1?'己方':'敌方'),'Current actor/target role text');
  entry.actions.push({kind:'picker',command,phase,sample,presentation:p,role});return sample;
 };
 const reveal=async selector=>{
  const before=await ready();
  const probe='(() => {const n=document.querySelector('+JSON.stringify(selector)+');if(!n)return null;let shown=true;for(let a=n;a;a=a.parentElement){const v=getComputedStyle(a);if(a.hidden||v.display==="none"||v.visibility==="hidden"||Number(v.opacity)===0)shown=false;}const b=n.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,hit=document.elementFromPoint(x,y);let list=n.parentElement;while(list&&list.id!=="hd-city-menu"){const s=getComputedStyle(list);if(/auto|scroll/.test(s.overflowY)&&list.scrollHeight>list.clientHeight+2)break;list=list.parentElement;}if(!shown||b.width<=0||b.height<=0)return null;let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};for(let a=n.parentElement;a;a=a.parentElement){const v=getComputedStyle(a),r=a.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(v.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}if(/auto|scroll|hidden|clip/.test(v.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}}return {visible:b.left>=clip.left-.5&&b.right<=clip.right+.5&&b.top>=clip.top-.5&&b.bottom<=clip.bottom+.5&&(hit===n||n.contains(hit)),scrollable:!!list&&list.id!=="hd-city-menu",id:list?.id||null,scrollTop:list?.scrollTop,clip,target:{top:b.top,bottom:b.bottom}};})()';
  for(let step=0;step<=8;step++){
   const info=await until('diplomacy mounted control',probe,3_000);entry.scrollChecks.push({selector,step,phase:'probe',info});if(info.visible)return;
   assert.ok(step<8&&info.scrollable&&info.id,'Only bounded real list pans reveal actual controls');const r=info.clip;assert.ok(r.right-r.left>=44&&r.bottom-r.top>=44);assert.ok(info.target.bottom>r.bottom||info.target.top<r.top,'No pan around external obstruction');
   const down=info.target.bottom>r.bottom,x=r.right-12,y=r.top+(r.bottom-r.top)*(down?.75:.25),end=r.top+(r.bottom-r.top)*(down?.25:.75);
   assert.equal(await evaluate('(() => {const l=document.getElementById('+JSON.stringify(info.id)+'),n=document.elementFromPoint('+x+','+y+');return !!l&&!!n&&(n===l||l.contains(n));})()'),true);
   await touches('touchStart',[{x,y}]);for(let i=1;i<=6;i++)await touches('touchMove',[{x,y:y+(end-y)*i/6}]);await touches('touchEnd');await delay(150);
   const after=await ready(),scrollTop=await evaluate('document.getElementById('+JSON.stringify(info.id)+').scrollTop');assert.notEqual(scrollTop,info.scrollTop);assert.deepEqual(await keys(before),[]);assert.deepEqual(after.native,before.native);worldSame(before,after,'Diplomacy list scrolling');noLcd(before,after);entry.scrollChecks.push({selector,step,phase:'pan',before,after,scrollTop});
  }
 };
 const click=async selector=>{await reveal(selector);const point=await controlPoint(selector);await tap(point);return {selector,point};};
 const currentMap=async(before,command,{committed=false,actor=null,target=null}={})=>{
  const d=protocol(before,command,before.state.diplomacy.phase);
  await until('native diplomacy DONE and MAP after '+names[command],'(() => {const d=baye.hd.diplomacy(),m=baye.hd.menuItems(),q=baye.hd.qty(),r=baye.hd.report(),s=BayeHdCityMenu.debugSnapshot();return d&&d.active===0&&d.phase===5&&d.command==='+command+'&&d.session==='+d.session+'&&d.generation==='+d.generation+'&&!m.active&&!m.context&&!m.kind&&!q.active&&!r.active&&!s.open&&!s.sending&&!s.queueLen&&Number(baye.data.g_hdMapPick)===1&&Number(baye.data.g_hdMapCity)==='+(origin+1)+';})()');
  await until('current HD MAP HUD after diplomacy',mapReadySource);const after=await ready(),receipt=protocol(after,command,5);assert.equal(receipt.session,d.session);assert.equal(receipt.generation,d.generation);
  assert.equal(after.state.menu.seq,next(before.state.menu.seq));assert.equal(after.state.march.mapInputSeq,next(before.state.march.mapInputSeq));noLcd(before,after);
  if(committed){assert.equal(receipt.actor,actor);assert.equal(receipt.target,target);assert.equal(receipt.commitResult,1);assert.equal(receipt.commitSeq,next(d.commitSeq));}
  const city=after.world.cities[origin];for(const [field,value] of Object.entries({money:String(city.Money),food:String(city.Food),arms:String(city.MothballArms)}))assert.equal(after.state.hud[field],value);
  for(const [field,value] of Object.entries(after.state.expected))assert.equal(after.state.hud[field],value);return after;
 };
 const open=async command=>{await root(1,'外交');await submenu(names[command]);return picker(command,1);};
 const actorToTarget=async(command,actor)=>{
  const before=await picker(command,1),m=before.state.menu,index=m.ids.indexOf(actor);assert.ok(index>=0);const control=await click('#hd-city-menu [data-hd-deep="'+index+'"][data-hd-deep-pind="'+actor+'"]');
  const after=await picker(command,2,following(m.seq));assert.equal(after.state.diplomacy.actor,actor);assert.equal(after.state.diplomacy.session,before.state.diplomacy.session);assert.equal(after.state.diplomacy.generation,before.state.diplomacy.generation);assert.notEqual(after.state.diplomacy.inputSeq,before.state.diplomacy.inputSeq);
  assert.deepEqual(await keys(before),selectedCodes(index,m.index));worldSame(before,after,'Actor selection before costs');noLcd(before,after);entry.actions.push({kind:'actor-to-target',command,actor,before,after,keys:await keys(before),...control});return after;
 };
 const cancel=async(command,phase)=>{
  const before=await picker(command,phase),control=await click('#hd-city-menu [data-hd-menu-back]'),after=phase===1?await currentMap(before,command):await picker(command,1,following(before.state.menu.seq));
  assert.deepEqual(await keys(before),[40]);noLcd(before,after);const oracle=verifyMobileDiplomacyCancellation({before:before.world,after:after.world,libBytes});
  if(phase===2){assert.equal(after.state.diplomacy.session,before.state.diplomacy.session);assert.equal(after.state.menu.index,0);assert.notEqual(after.state.diplomacy.inputSeq,before.state.diplomacy.inputSeq);}
  entry.cancellations.push({kind:phase===1?'actor':'target',command,before,after,keys:[40],oracle,...control});return after;
 };
 const usedActors=[];
 for(const command of [15,16,17,19]){
  await open(command);await cancel(command,1);await checkpoint(label+'-'+command+'-actor-cancel-map');
  const start=await open(command),lists=getMobileDiplomacyCandidates({world:start.world,cityIndex:origin,command,libBytes});assert.ok(lists.targets.length,'Real eligible original enemy target');
  const actor=lists.actors.find(id=>!usedActors.includes(id)&&start.world.people[id].Thew>=(command===19?10:20));assert.ok(Number.isInteger(actor),'Fresh eligible resident actor');
  await actorToTarget(command,actor);await cancel(command,2);await checkpoint(label+'-'+command+'-target-cancel-actor');
  const before=await actorToTarget(command,actor),m=before.state.menu,target=m.ids[0],index=0,limit=calculateMobileDiplomacyLimit({world:before.world,cityIndex:origin,command,personId:actor,targetId:target,libBytes});assert.ok(limit.orderIndex>=0,'Real free order required for normal dispatch');
  const actorName=await evaluate('baye.getPersonName('+actor+')'),targetName=m.names[index];await checkpoint(label+'-'+command+'-target');
  const control=await click('#hd-city-menu [data-hd-deep="'+index+'"][data-hd-deep-pind="'+target+'"]'),after=await currentMap(before,command,{committed:true,actor,target}),actualKeys=await keys(before);
  assert.deepEqual(actualKeys,selectedCodes(index,m.index),'Exact target arrows and oneENTER, no invented report ACK');
  const oracle=verifyMobileDiplomacy({before:before.world,after:after.world,cityIndex:origin,command,personId:actor,targetId:target,outcome:'queued',libBytes});
  entry.operations.push({command,commandName:names[command],actor,actorName,target,targetName,before,after,limit,oracle,keys:actualKeys,...control});usedActors.push(actor);await checkpoint(label+'-'+command+'-dispatch-map');
 }
 assert.equal(entry.operations.length,4);assert.equal(entry.cancellations.length,8);assert.equal(new Set(usedActors).size,4);entry.returned=await ready();entry.accepted=true;return entry;
}
