// Scenario only: process/server ownership is handled by the safe mobile runtime runner.
import assert from 'node:assert/strict';
import {verifyMobileBattleMarch,verifyMobileBattleRest} from './hd-mobile-battle-runtime-oracle.mjs';

export const battleObservation = `(() => {const d=baye.data,f=baye.hd.fight(),units=[];
  for(let i=0;i<20;i++){const id=Number(d.g_FgtParam.GenArray[i]);if(id>0&&id<65534){const p=d.g_GenPos[i];
    units.push({i,id,name:baye.getPersonName(id-1),side:i<10?'player':'enemy',x:Number(p.x),y:Number(p.y),
      hp:Number(p.hp),mp:Number(p.mp),move:Number(p.move),active:Number(p.active),state:Number(p.state),arms:Number(d.g_Persons[id-1].Arms)});}}
  const plain=n=>{if(!n)return null;const r=n.getBoundingClientRect(),s=getComputedStyle(n),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,shown:!n.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0,hit:top===n||n.contains(top)};};
  return {fight:f,units,food:{player:Number(d.g_FgtParam.MProvender),enemy:Number(d.g_FgtParam.EProvender)},weather:Number(d.g_FgtWeather),
    menu:baye.hd.menuItems(),help:baye.hd.help(),view:baye.hd.view(),report:baye.hd.report(),
    ui:BayeHdBattle.debugSnapshot(),mobile:BayeHdMobileBattle.debugSnapshot(),ticket:(()=>{const t=BayeHdMobileBattle.readNativeTicket();return t?{key:t.key,presentation:t.presentation,kind:t.kind,seq:t.seq,actor:t.actor}:null;})(),
    canvas:plain(document.getElementById('hd-mobile-battle-canvas')),lcd:plain(document.getElementById('lcd')),
    nativeOver:Number(d.g_FgtOver),settings:{movie:Number(d.g_LookMovie),speed:Number(d.g_MoveSpeed),enemy:Number(d.g_LookEnemy)},
    keys:__mobileMapKeys.length,touches:__mobileMapNativeTouches.length,pcBattle:localStorage.getItem('baye/battleMode')};})()`;

export async function runMobileBattleChecks(c) {
  const {report,evaluate,until,delay,checkpoint,key,metrics,touches,tap,buttonPoint,button,cityPoint,worldSource,mapReadySource,sendCdp,originalLibBytes}=c;
  const K={UP:34,DOWN:35,LEFT:36,RIGHT:37,ENTER:39,EXIT:40,HELP:38,SEARCH:51};
  report.battleChecks=[];report.battleActions=[];report.battleBootstrap={type:'Fresh P1 马腾, real LCD public keys for march; not HD march acceptance'};
  const native=()=>evaluate(battleObservation);
  const physicalKey=async(key,code)=>{report.inputs.push({type:'trusted CDP physical key',key,code});
    await sendCdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key.length===1?'Key'+key.toUpperCase():key,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code});
    await sendCdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key.length===1?'Key'+key.toUpperCase():key,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code});await delay(160);};
  const lcdCenter=async()=>{const s=await native();assert.equal(s.mobile.presentation,'lcd');assert.equal(s.lcd.hit,true);
    return {x:s.lcd.left+s.lcd.width/2,y:s.lcd.top+s.lcd.height/2};};
  const capture=async label=>{const n=await native();report.battleChecks.push({label,state:n});await checkpoint(label);return n;};
  const ready=async(kind,label)=>{await until(label,`(() => {const f=baye.hd.fight(),s=BayeHdBattle.debugSnapshot(),h=BayeHdMobileBattle.refresh();return f.active===1&&!f.over&&f.inputKind===${kind}&&!s.transaction&&h.presentation==='hd'&&BayeHdBattle.getInputTicket()&&true;})()`,45000);return native();};
  const unchanged=async(before,label)=>{await delay(200);const n=await native();
    assert.deepEqual(n.fight,before.fight,label+' native input/focus unchanged');assert.deepEqual(n.units,before.units,label+' all battle units unchanged');
    assert.deepEqual(n.food,before.food,label+' grain unchanged');assert.deepEqual(n.menu,before.menu,label+' native menu unchanged');
    assert.equal(n.keys,before.keys,label+' zero keys');assert.equal(n.touches,before.touches,label+' zero LCD touches');assert.equal(n.pcBattle,before.pcBattle,label+' preserves PC preference');
    report.battleChecks.push({label,zeroInput:true,state:n});return n;};
  const publicMenu=async(index,label)=>{const m=await evaluate('baye.hd.menuItems()');assert.equal(m.active,1,label+' live menu');assert.ok(index>=0&&index<m.count);
    for(let i=m.index;i<index;i++){await key(K.DOWN,label+' next native row');await until('native row ACK',`baye.hd.menuItems().index===${i+1}`);}
    for(let i=m.index;i>index;i--){await key(K.UP,label+' previous native row');await until('native row ACK',`baye.hd.menuItems().index===${i-1}`);}
    await key(K.ENTER,label+' explicit native confirm');};
  // City entry remains a trusted HD touch; the incomplete march wizard uses the actual LCD.
  const city=report.initialAllCities.find(v=>v.index===8);assert.ok(city&&city.kind==='owned'&&city.name==='天水');
  await tap(await cityPoint(city));await until('actual owned city root','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===1&&baye.hd.menuItems().kind===1');
  await button('#hd-mobile-menu-mode');await until('real classic city LCD',`document.body.getAttribute('data-hd-mobile-lcd')==='passthrough'||document.body.getAttribute('data-hd-mobile-lcd')==='on'`);
  await publicMenu(2,'军备');await until('actual military list','baye.hd.menuItems().active===1&&baye.hd.menuItems().names.includes("出征")');
  await publicMenu(await evaluate('baye.hd.menuItems().names.indexOf("出征")'),'出征');
  await until('real original march persons','baye.hd.march().phase===1&&baye.hd.march().origin===8');
  report.battleBootstrap.before=await evaluate(worldSource);
  report.battleBootstrap.selectedPersonIds=[];
  for(let i=0;i<8;i++){const m=await evaluate('baye.hd.march()');if(m.phase!==1)break;
    const people=await evaluate('baye.hd.menuItems()');assert.ok(people.active===1&&people.kind===3&&people.idsValid&&people.ids.length>0,'Actual march person owner');
    report.battleBootstrap.selectedPersonIds.push(people.ids[0]);
    const selected=m.selected;await publicMenu(0,'Select genuine resident');await until('actual selected count','baye.hd.march().selected>'+selected+'||baye.hd.march().phase!==1');}
  if(await evaluate('baye.hd.march().phase===1'))await key(K.EXIT,'Finish real selected army');
  await until('real GetFood','baye.hd.march().phase===2&&baye.hd.qty().active===1');
  report.battleBootstrap.food=await evaluate('baye.hd.qty()');
  // Original GetFood starts with the current maximum; assert rather than alter native data.
  assert.ok(report.battleBootstrap.food.value>=100,'The genuine selected grain supports multiple battle turns');
  assert.equal(report.battleBootstrap.food.max,report.battleBootstrap.before.cities[8].Food,'GetFood maximum is actual original city grain');
  assert.equal(report.battleBootstrap.food.value,report.battleBootstrap.food.max,'Original native initial GetFood value');
  await key(K.ENTER,'Confirm real GetFood');await until('native target instruction','baye.hd.march().phase===3');
  await key(K.ENTER,'Acknowledge original target instruction');await until('native destination picker','baye.hd.march().phase===4&&baye.hd.march().battlePick===1');
  const target=report.initialAllCities.find(v=>v.index===9);assert.ok(target&&target.kind!=='owned');
  report.battleBootstrap.target=target;
  for(let i=0;i<100;i++){const p=await evaluate('({x:Number(baye.data.g_CityPos.setx),y:Number(baye.data.g_CityPos.sety)})');
    if(p.x===target.engX&&p.y===target.engY)break;const axis=p.x!==target.engX?'x':'y',n=p[axis],dest=axis==='x'?target.engX:target.engY;
    await key(axis==='x'?(n<dest?K.RIGHT:K.LEFT):(n<dest?K.DOWN:K.UP),'Move actual original destination cursor');
    await until('native destination cursor ACK',`Number(baye.data.g_CityPos.set${axis})!==${n}`);}
  const selectedCity=await evaluate('Number(baye.data.g_hdMapCity)-1');assert.equal(selectedCity,9,'Actual city under original cursor');
  await key(K.ENTER,'Confirm original enemy destination');await until('real departure report','baye.hd.march().phase===6');
  await key(K.ENTER,'Acknowledge genuine departure report');await until('actual march order','baye.hd.march().phase===7&&baye.hd.march().ok===1');
  report.battleBootstrap.after=await evaluate(worldSource);
  report.battleMarchVerdict=verifyMobileBattleMarch({before:report.battleBootstrap.before,after:report.battleBootstrap.after,
    qty:report.battleBootstrap.food,libBytes:originalLibBytes,selectedPersonIds:report.battleBootstrap.selectedPersonIds});
  for(let i=0;i<5;i++){const m=await evaluate('baye.hd.menuItems()');if(m.active===1&&m.context===2)break;
    await key(K.EXIT,'Return through genuine strategy menu');await delay(250);}
  await until('real strategy function menu','baye.hd.menuItems().active===1&&baye.hd.menuItems().context===2');
  assert.equal(await evaluate('baye.hd.menuItems().names[0]'),'策略结束');await publicMenu(0,'End one strategy phase');
  await ready(1,'actual first mobile battle PICK');const initial=await capture('battle-01-fresh-pick-844');
  assert.equal(initial.mobile.presentation,'hd');assert.equal(initial.canvas.hit,true);assert.ok(initial.mobile.camera.cell>=44);
  assert.ok(initial.units.some(u=>u.side==='player')&&initial.units.some(u=>u.side==='enemy'));
  await unchanged(initial,'Idle actual mobile battle');
  const beforeView=await native();await physicalKey('s',83);
  await until('actual VIEW LCD owner',"baye.hd.fight().inputKind===10&&baye.hd.view().active===1&&BayeHdMobileBattle.refresh().presentation==='lcd'");
  const view=await capture('battle-view-native-LCD');assert.equal(view.keys,beforeView.keys+1);assert.equal((await evaluate('__mobileMapKeys.at(-1)')).code,K.SEARCH);
  await tap(await lcdCenter());await ready(1,'VIEW exits by actual LCD tap');const afterView=await native();
  assert.deepEqual(afterView.units,beforeView.units);assert.deepEqual(afterView.food,beforeView.food);assert.equal(afterView.keys,view.keys);
  report.battleView={before:beforeView,visible:view,after:afterView,exit:'trusted native LCD center DOWN/UP'};
  // Measured touch geometry, no assumed PC 1920x1080 layout.
  const tilePoint=async(x,y)=>{for(let i=0;i<12;i++){const s=await native(),v=s.mobile.camera;assert.ok(v&&v.cell>=44);
      if(x>=v.x&&x<v.x+v.cols&&y>=v.y&&y<v.y+v.rows){const p={x:v.left+(x-v.x+.5)*v.cell,y:v.top+(y-v.y+.5)*v.cell};
        assert.equal(await evaluate(`document.elementFromPoint(${p.x},${p.y})===document.getElementById('hd-mobile-battle-canvas')`),true);return p;}
      const r=s.canvas,px=r.left+r.width*.5,py=r.top+r.height*.5,dx=x<v.x?120:x>=v.x+v.cols?-120:0,dy=y<v.y?90:y>=v.y+v.rows?-90:0;
      const before=await native();await touches('touchStart',[{x:px,y:py}]);for(let j=1;j<=5;j++)await touches('touchMove',[{x:px+dx*j/5,y:py+dy*j/5}]);await touches('touchEnd');await unchanged(before,'Pan to native tile');}
    throw Error('Native tile never becomes visible through genuine camera pans');};
  const tileTap=async(x,y,label)=>{const before=await native(),p=await tilePoint(x,y);await tap(p);report.battleActions.push({label,type:'trusted tile touch',x,y,before:before.fight,after:(await native()).fight});};
  const menu=async(index,label)=>{let probe;for(let i=0;i<10;i++){probe=await evaluate(`(() => {const n=document.querySelector('#hd-battle-menu [data-hd-battle-menu="${index}"]'),l=document.getElementById('hd-battle-menu-list');if(!n||!l)return null;
      const r=n.getBoundingClientRect(),a=l.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {visible:!n.disabled&&r.top>=a.top&&r.bottom<=a.bottom&&(top===n||n.contains(top)),width:r.width,height:r.height,targetTop:r.top,list:{left:a.left,top:a.top,width:a.width,height:a.height},scrollTop:l.scrollTop};})()`);
      assert.ok(probe,'Current native menu button exists');if(probe.visible)break;assert.ok(probe.list.height>=44,'Menu has a full touch row');
      const before=await native(),r=probe.list,down=probe.targetTop>=r.top,x=r.left+r.width-12,y=r.top+r.height*(down?.8:.2),end=r.height*.6*(down?-1:1);
      await touches('touchStart',[{x,y}]);for(let j=1;j<=5;j++)await touches('touchMove',[{x,y:y+end*j/5}]);await touches('touchEnd');await unchanged(before,'Scroll current native battle menu');}
    assert.ok(probe.visible&&probe.height>=44&&probe.width>=44,'Current battle menu is visible and at least 44px');
    const before=await native();await button(`#hd-battle-menu [data-hd-battle-menu="${index}"]`);report.battleActions.push({label,type:'trusted native-menu touch',index,names:before.menu.names,before:before.fight,after:(await native()).fight});};
  for(const size of [[844,390],[667,375]]){await metrics(...size);await ready(1,'battle after viewport change');const before=await native();
    assert.ok(before.mobile.camera.cell>=44);await button('#hd-mobile-battle-mode');await until('actual classic battle',"BayeHdMobileBattle.refresh().presentation==='lcd'");
    const classic=await unchanged(before,'Classic battle presentation');assert.equal(classic.lcd.hit,true);await checkpoint('battle-classic-'+size[0]);
    await button('#hd-mobile-battle-toggle');await ready(1,'battle HD restored');await unchanged(before,'HD battle presentation restored');
    await capture('battle-HD-'+size[0]);}
  const beforeHidden=await native(),held=await buttonPoint('[data-hd-battle-sys]');await touches('touchStart',[{x:held.x,y:held.y}]);
  const other=await sendCdp('Target.createTarget',{url:'about:blank'});
  try{await sendCdp('Target.activateTarget',{targetId:other.targetId});await until('real game tab hidden','document.hidden&&document.visibilityState==="hidden"',10000);
    report.battleVisibility={hidden:await evaluate('({hidden:document.hidden,visibility:document.visibilityState})')};await unchanged(beforeHidden,'Hidden actual battle retires held system');}
  finally{await sendCdp('Target.closeTarget',{targetId:other.targetId});await sendCdp('Page.bringToFront');}
  await until('game actually visible again','!document.hidden&&document.visibilityState==="visible"');await touches('touchEnd');await ready(1,'visible fresh battle');
  report.battleVisibility.restored=await evaluate('({hidden:document.hidden,visibility:document.visibilityState})');await unchanged(beforeHidden,'Releasing hidden retired system sends no key');
  const own=initial.units.find(u=>u.side==='player'&&u.active===0&&u.state===0);assert.ok(own);
  // Current MOVE cancellation is a real native path, not a renderer-only reset.
  await tileTap(own.x,own.y,'Select actual player');await ready(2,'native MOVE');await capture('battle-02-move-mask');
  await button('[data-hd-battle-cancel]');await ready(1,'MOVE canceled');assert.deepEqual((await native()).units,initial.units);
  // Three genuine negative gestures while the native player wait remains idle.
  for(const kind of ['cancel','multi','rotate']){const before=await native(),p=await buttonPoint('[data-hd-battle-sys]');
    await touches('touchStart',[{x:p.x,y:p.y}]);
    if(kind==='cancel')await touches('touchCancel');
    if(kind==='multi'){await touches('touchStart',[{x:p.x,y:p.y,id:1},{x:30,y:20,id:2}]);await touches('touchEnd');}
    if(kind==='rotate'){await metrics(375,667);await metrics(667,375);await touches('touchEnd');}
    await ready(1,'after retired '+kind);await unchanged(before,'Held system '+kind+' retires');}
  await tileTap(own.x,own.y,'Select same player again');await ready(2,'MOVE again');
  const move=await evaluate(`(() => {const d=baye.data,f=baye.hd.fight(),out=[];for(let y=0;y<f.mapH;y++)for(let x=0;x<f.mapW;x++){
    const px=(x-Number(d.g_PathSX)+Number(d.g_PUseSX))&255,py=(y-Number(d.g_PathSY)+Number(d.g_PUseSY))&255;
    if(px<15&&py<15&&Number(d.g_FightPath[py*15+px])<=128)out.push({x,y});}return out;})()`);
  const enemies=initial.units.filter(u=>u.side==='enemy'&&u.state!==8),distance=p=>Math.min(...enemies.map(u=>Math.abs(u.x-p.x)+Math.abs(u.y-p.y)));
  const destination=move.filter(p=>(p.x!==own.x||p.y!==own.y)&&!initial.units.some(u=>u.i!==own.i&&u.state!==8&&u.x===p.x&&u.y===p.y)).sort((a,b)=>distance(a)-distance(b))[0];
  assert.ok(destination,'Actual native legal unoccupied move tile');await tileTap(destination.x,destination.y,'Move to current native allowed tile');await ready(3,'real ACTION after MOVE');
  const moved=await capture('battle-03-real-action');assert.equal(moved.units.find(u=>u.i===own.i).x,destination.x);assert.equal(moved.units.find(u=>u.i===own.i).y,destination.y);
  await button('[data-hd-battle-cancel]');await ready(1,'ACTION rollback');assert.deepEqual((await native()).units,initial.units);
  await tileTap(own.x,own.y,'Select player for native rest');await ready(2,'rest MOVE');await tileTap(own.x,own.y,'Stay actual own tile');await ready(3,'real rest ACTION');
  report.realActionNames=(await native()).menu.names;await menu(1,'Open real skill list');await ready(4,'native SKILL menu');await capture('battle-04-native-skills');
  await button('[data-hd-battle-cancel]');await ready(3,'return from native SKILL');
  const beforeHelp=await native();await menu(2,'Open actual native general HELP');
  await until('actual HELP LCD owner',"baye.hd.fight().inputKind===9&&baye.hd.help().active===1&&BayeHdMobileBattle.refresh().presentation==='lcd'");
  const help=await capture('battle-help-native-LCD'),center=await lcdCenter();
  await touches('touchStart',[center]);await ready(3,'HELP retires on actual LCD DOWN');const downHelp=await native();await touches('touchEnd');
  await ready(3,'HELP release keeps fresh ACTION');const afterHelp=await native();
  assert.deepEqual(afterHelp.units,beforeHelp.units);assert.deepEqual(afterHelp.food,beforeHelp.food);assert.equal(afterHelp.keys,help.keys);
  report.battleHelp={before:beforeHelp,visible:help,downRetired:downHelp,after:afterHelp,exit:'GamDelay(0,2) retires on DOWN; remaining UP ignored by fresh ACTION'};
  report.battleRest={before:await native(),world:await evaluate(worldSource),actorIndex:own.i};
  await menu(3,'Rest selected general');await ready(1,'single general rested');
  const rested=await capture('battle-05-rested-single');assert.equal(rested.units.find(u=>u.i===own.i).active,1);
  report.battleRest.after=rested;report.battleRest.worldAfter=await evaluate(worldSource);
  report.battleRestVerdict=verifyMobileBattleRest(report.battleRest);
  for(const u of initial.units.filter(u=>u.side==='player'&&u.i!==own.i))assert.equal(rested.units.find(v=>v.i===u.i).active,u.active);
  assert.equal(rested.fight.bout,initial.fight.bout,'A rest does not end whole player turn');
  await button('[data-hd-battle-sys]');await ready(6,'real SYSTEM');await capture('battle-06-native-system');
  const system=(await native()).menu.names;assert.equal(system.length,5);report.realSystemNames=system;
  await menu(1,'Request real retreat confirmation');await ready(7,'native RETREAT');await capture('battle-07-retreat-confirm');
  await button('[data-hd-battle-cancel]');await ready(6,'retreat canceled');assert.equal((await native()).nativeOver,0);
  const beforeSettings=await native();
  for(const i of [2,3,4]){await menu(i,'Open actual setting '+i);await ready(8,'native SETTINGS');await button('[data-hd-battle-cancel]');await ready(6,'setting canceled');
    const canceled=await native();assert.deepEqual(canceled.settings,beforeSettings.settings);assert.equal(canceled.nativeOver,0);assert.deepEqual(canceled.units,beforeSettings.units);assert.deepEqual(canceled.food,beforeSettings.food);}
  const beforeEnd=await native();await menu(0,'Explicit single army end');
  await until('actual AI then next player bout',`(() => {const f=baye.hd.fight();return f.active===1&&!f.over&&f.inputKind===1&&f.bout===${beforeEnd.fight.bout+1}&&BayeHdMobileBattle.refresh().presentation==='hd';})()`,60000);
  const afterEnd=await capture('battle-08-natural-AI-next-player');await unchanged(afterEnd,'New player wait never ends army automatically');
  assert.equal(afterEnd.fight.bout,beforeEnd.fight.bout+1);report.battleTurn={before:beforeEnd,after:afterEnd};
  report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.ok(report.trustedEvents.some(e=>e.trusted&&e.type==='pointerdown'&&e.target==='hd-mobile-battle-canvas'));
  assert.equal(report.exceptions.length,0);report.battleAccepted=true;report.ok=true;report.accepted=true;
  report.acceptedScope=['Fresh original P1 马腾 actual public march into enemy 河内; march remains LCD and not HD accepted',
    'Trusted battle touch at 844x390 and 667x375; current native MOVE, rollback, SKILL list/cancel and single general rest',
    'Native SYSTEM/RETREAT cancellation and SETTINGS open/cancel, one explicit army end then native AI control flow and exactly one next bout; no AI damage claim',
    'HELP/VIEW display and retire through actual native LCD touch; genuine physical SEARCH routes once',
    'Classic and HD restoration zero keys, native masks and >=44px geometry, touchcancel/multiple pointers/held rotation and actual hidden-tab retirement'];
  report.pendingScope=['Normal attack damage and skill MP/effect','Report/animation LCD interaction and setting changes','Battle completion and strategy return','Android/iOS actual devices and performance','Full mobile HD/march acceptance'];
}
