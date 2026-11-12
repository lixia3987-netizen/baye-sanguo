// Actual original-game scenario; the parent runner owns browser/server cleanup.
import assert from 'node:assert/strict';

// Let the original enemy gain experience through real attacks. Move only the
// ruler, using the current native MOVE mask and the normal touch controls.
async function moveRuler({native,ready,tileTap,menu,evaluate,until},observedUpgrade) {
  const before=await native(),ruler=before.units.find(u=>u.i===0);
  assert.equal(ruler?.id,6,'Ma Teng is the actual ruler of this army');
  if(ruler.state===8||ruler.active!==0||ruler.state===1||ruler.state===6)return null;
  await tileTap(ruler.x,ruler.y,'Select Ma Teng');
  const selected=await until('Ma Teng MOVE or ACTION',`(() => {const f=baye.hd.fight();
    return f.actorIndex===0&&[2,3].includes(f.inputKind)&&!BayeHdBattle.debugSnapshot().transaction&&f.inputKind;})()`);
  let destination={x:ruler.x,y:ruler.y},target=null;
  if(selected===2) {
    await ready(2,'Current mobile MOVE mask for Ma Teng');
    const plan=await evaluate(`(() => {const t=BayeHdMobileBattle.readNativeTicket();if(!t||t.kind!==2||t.actor!==0)return null;
      const {fight,mask,units}=t.native,actor=units[0];
      const enemies=units.filter(u=>u.i>=10&&u.id>0&&u.id<=200&&u.state!==8&&u.hp>0&&u.arms>0)
        .map(u=>({...u,experience:Number(baye.data.g_Persons[u.id-1].Experience)}));
      const allies=units.filter(u=>u.i>0&&u.i<10&&u.id>0&&u.id<=200);
      const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),chess=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
      const target=!${observedUpgrade}&&allies.length===5&&allies.every(u=>u.state===8)
        ?enemies.filter(u=>u.experience>=80).sort((a,b)=>b.experience-a.experience||distance(a,actor)-distance(b,actor)||a.i-b.i)[0]:null;
      if(!enemies.length)return null;
      const candidates=[];
      for(let y=0;y<fight.mapH;y++)for(let x=0;x<fight.mapW;x++) {
        const px=(x-mask.g_PathSX+mask.g_PUseSX)&255,py=(y-mask.g_PathSY+mask.g_PUseSY)&255;
        if(px>=15||py>=15||mask.values[py*15+px]>128||units.some(u=>u.i!==0&&u.id>0&&u.id<=200&&u.state!==8&&u.x===x&&u.y===y))continue;
        const p={x,y},remaining=x===actor.x&&y===actor.y?actor.move:mask.values[py*15+px];
        candidates.push({...p,remaining,first:target?chess(p,target):-Math.min(...enemies.map(u=>chess(p,u))),
          second:target?distance(p,target):-Math.min(...enemies.map(u=>distance(p,u)))});
      }
      candidates.sort((a,b)=>a.first-b.first||a.second-b.second||b.remaining-a.remaining||a.y-b.y||a.x-b.x);
      return {destination:candidates[0],target:target||null};})()`);
    assert.ok(plan?.destination,'The current original MOVE mask supplies an unoccupied tile');
    ({destination,target}=plan);
    await tileTap(destination.x,destination.y,'Move Ma Teng on the current original mask');
  }
  const action=await ready(3,'Actual mobile ACTION after moving Ma Teng');
  assert.equal(action.fight.actorIndex,0);
  const moved=action.units.find(u=>u.i===0);
  assert.deepEqual([moved.x,moved.y],[destination.x,destination.y]);
  assert.ok(action.menu.active&&action.menu.names[3],'The original ACTION menu includes the rest row');
  await menu(3,'Rest Ma Teng using the original action');
  const after=await ready(1,'Mobile PICK after Ma Teng rests');
  assert.equal(after.units.find(u=>u.i===0).active,1);
  assert.equal(after.fight.bout,before.fight.bout);
  assert.deepEqual(after.units.filter(u=>u.i!==0),before.units.filter(u=>u.i!==0));
  assert.equal(after.touches,before.touches);
  return {before:ruler,after:after.units.find(u=>u.i===0),destination,target,keys:after.keys-before.keys};
}

async function waitStatusTurn({report,evaluate,until,button,metrics,readKeys},bout,size) {
  const resizeReason=size[0]===667?2:1;
  const end=Date.now()+180000;
  const reports=[];
  while(Date.now()<end) {
    const next=await until('native report, status resize, or next player bout',`(() => {
      const r=baye.hd.report(),s=baye.hd.spe(),f=baye.hd.fight(),p=BayeHdSpe.debugSnapshot().projectedScene;
      if(!s.active&&r.active)return {report:r};
      if(!${!!report.battleSceneResize}&&s.active&&s.display?.statusEffect?.reason===${resizeReason}&&p?.phase===1&&
        p.commitSeq===s.display.commitSeq&&s.display.frameIndex<s.endFrm)return {resize:true};
      return !s.active&&!r.active&&(f.over||!f.active||f.inputKind===1&&f.bout===${bout+1})?{done:true}:null;
    })()`,Math.max(1,end-Date.now()));
    if(next.done)return reports;
    if(next.resize) {
      report.battleSceneResize={from:size,to:[size[0],size[1]-24]};
      await metrics(...report.battleSceneResize.to);
      continue;
    }
    const {seq,inputSeq}=next.report;
    await until('HD confirmation for the current native battle report',`(() => {const r=baye.hd.report(),m=BayeHdMobileBattle.refresh();
      return !baye.hd.spe().active&&r.active&&r.seq===${seq}&&r.inputSeq===${inputSeq}&&m.detailPresentation==='hd';})()`);
    const offset=await evaluate('__mobileMapKeys.length');
    await button('#hd-dialog [data-hd-dlg-ok]');
    await until('original report confirms once',`(() => {const r=baye.hd.report();return !r.active||r.seq!==${seq}||r.inputSeq!==${inputSeq};})()`);
    const keys=await readKeys(offset);
    assert.deepEqual(keys.map(k=>k.code),[39],'One explicit native confirmation for the current report');
    reports.push({native:next.report,keys});
  }
  throw Error('Original enemy turn did not return within the turn budget');
}

export async function runMobileBattleSceneChecks(c) {
  const {report,evaluate,until,delay,checkpoint,metrics,button,native,ready,menu}=c;
  const status=report.battleSceneStatus;
  report.battleSceneAccepted=false;
  report.battleSceneTurns=[];
  // Observe after production painting. This never changes native values,
  // timers, RNG, getter results, event handlers or presentation preferences.
  await evaluate(`(() => {
    const api=BayeHdSpe,original=api.onLcdFlush,retire=api.retireInteraction;
    const proof=window.__battleSceneProof={observations:[],errors:[],screens:[],resizes:[],overflow:false};
    const surface=(id)=>{const n=document.getElementById(id),r=n.getBoundingClientRect();return {
      visible:n.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&r.width>0&&r.height>0,
      inViewport:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};};
    const title=()=>({text:document.getElementById('hd-spe-title').textContent,...surface('hd-spe-title')});
    const readResize=()=>{const s=baye.hd.spe(),p=api.debugSnapshot();return {width:innerWidth,height:innerHeight,
      owner:[s.active,s.generation,s.eventId,s.display?.commitSeq,s.display?.frameIndex],scene:p.projectedScene,
      presentation:p.mobilePresentation,title:title(),canvas:surface('hd-spe-canvas'),lcd:surface('lcd'),
      input:!!BayeHdBattle.getInputTicket(),keys:__mobileMapKeys.length,touches:__mobileMapNativeTouches.length};};
    if(${status})api.retireInteraction=function(reason){
      let before=null;
      try{if(['resize','orientationchange','visual-viewport'].includes(reason))before=readResize();}
      catch(error){proof.errors.push(String(error));}
      try{return retire.apply(this,arguments);}
      finally{try{if(before?.presentation==='hd'&&before.scene?.phase===1&&before.owner[0]===1&&
          before.scene.generation===before.owner[1]&&before.scene.eventId===before.owner[2]&&before.scene.commitSeq===before.owner[3])
        proof.resizes.push({reason,before,after:readResize()});}
        catch(error){proof.errors.push(String(error));}}
    };
    api.onLcdFlush=function(){
      const cameraBefore=JSON.stringify(BayeHdMobileBattle.debugSnapshot().camera);
      try{return original.apply(this,arguments);}finally{try{(() => {
        const s=baye.hd.spe();if(s.active!==1||s.id!==27||s.kind!==4)return;
        const d=baye.data,ui=api.debugSnapshot(),store=__battleSceneProof;
        if(store.observations.length>=2000){store.overflow=true;return;}
        const canvas=document.getElementById('hd-spe-canvas'),r=canvas.getBoundingClientRect(),stage=document.getElementById('hd-mobile-stage').getBoundingClientRect();
        const down=document.createElement('canvas');down.width=160;down.height=96;
        down.getContext('2d').drawImage(canvas,0,0,160,96);
        const pixels=down.getContext('2d').getImageData(0,0,160,96).data,colors=new Set();
        for(let i=0;i<pixels.length;i+=4)colors.add([pixels[i],pixels[i+1],pixels[i+2],pixels[i+3]].join(','));
        const units=Array.from({length:20},(_,index)=>{const token=Number(d.g_FgtParam.GenArray[index]),p=d.g_GenPos[index];return {
          index,token,x:Number(p.x),y:Number(p.y),state:Number(p.state),hp:Number(p.hp),active:Number(p.active),
          ...(token>0&&token<=200?{arms:Number(d.g_Persons[token-1].Arms),name:baye.getPersonName(token-1),
            level:Number(d.g_Persons[token-1].Level),experience:Number(d.g_Persons[token-1].Experience)}:{})};});
        const identity=BayeHdLibIdentity.read();
        store.observations.push({spe:s,ui:{open:ui.open,source:ui.source,presentation:ui.presentation,flushKey:ui.flushKey,
          displayedFrames:ui.displayedFrames,outsideSource:ui.outsideSource,projectedScene:ui.projectedScene,
          projectionFallbackReason:ui.projectionFallbackReason,skipVisible:ui.skipVisible,canvasW:canvas.width,canvasH:canvas.height},
          fight:baye.hd.fight(),units,identity:{generation:identity.generation,sha256:identity.sha256,byteLength:identity.byteLength,status:identity.status},
          map:{width:Number(d.g_MapWid),height:Number(d.g_MapHgt),x:Number(d.g_MapSX),y:Number(d.g_MapSY),
            tiles:Array.from({length:Number(d.g_MapWid)*Number(d.g_MapHgt)},(_,i)=>Number(d.g_FightMapData[i]))},
          cameraBefore,cameraAfter:JSON.stringify(BayeHdMobileBattle.debugSnapshot().camera),
          colors:colors.size,title:title(),rect:{x:r.left,y:r.top,width:r.width,height:r.height,stageX:stage.left,stageY:stage.top,stageW:stage.width,stageH:stage.height},
          actionTicket:BayeHdBattle.getInputTicket()!==null,keys:__mobileMapKeys.length,touches:__mobileMapNativeTouches.length});
        const shotKey=window.innerWidth+':'+s.generation+':'+s.eventId;
        const family=ui.projectedScene?.family;
        if(family&&!store.screens.some(p=>p.key===shotKey)&&(store.screens.length<12||!store.screens.some(p=>p.family===family)))
          store.screens.push({key:shotKey,family,eventId:s.eventId,width:innerWidth,height:innerHeight,png:canvas.toDataURL('image/png')});
      })();}catch(e){__battleSceneProof.errors.push(String(e&&e.stack||e));}}
    };
    return true;
  })()`);
  const viewports=report.battleSceneWidth===667?[[667,375]]:[[844,390]];
  try {
  for(const size of viewports) {
    await metrics(...size);await ready(1,'Fresh player PICK before scene viewport');
    const start=await evaluate('__battleSceneProof.observations.length');
    let observedUpgrade=false;
    for(let turn=0;turn<(status?20:8);turn++) {
      const rulerMove=status?await moveRuler(c,observedUpgrade):null;
      const before=await native();
      await button('[data-hd-battle-sys]');await ready(6,'Current actual scene SYSTEM');
      const system=await native();assert.equal(system.keys,before.keys+1,'One explicit system input');
      await menu(0,'Explicit army end for natural AI scene');
      const acks=status?await waitStatusTurn(c,before.fight.bout,size):[];
      if(!status)await until('Natural AI returns to next native player bout',`(() => {const f=baye.hd.fight();return f.active===1&&!f.over&&f.inputKind===1&&f.bout===${before.fight.bout+1}&&BayeHdMobileBattle.refresh().presentation==='hd';})()`,60000);
      const after=await native();assert.equal(after.keys,system.keys+1+acks.length,'The end turn and explicit reports account for every key');
      assert.deepEqual(await evaluate('__battleSceneProof.errors'),[],'Read-only observer remained valid');
      assert.equal(after.touches,before.touches,'HD battle controls never forward LCD touch');
      report.battleSceneTurns.push({viewport:size,before:before.fight,after:after.fight,keys:after.keys-before.keys,touches:after.touches-before.touches,rulerMove,acks});
      const families=await evaluate(`__battleSceneProof.observations.slice(${start}).filter(o=>o.ui.projectedScene&&
        (!${status}||o.spe.display.frameIndex===o.spe.endFrm)).map(o=>o.ui.projectedScene.family)`);
      observedUpgrade=families.includes('upgrade');
      if(status)console.log('Actual mobile turn',turn+1,JSON.stringify({bout:after.fight.bout,families:[...new Set(families)],over:after.fight.over}));
      if(families.includes('ai-target')&&(!status||observedUpgrade&&families.includes('departure')))break;
      if(!after.fight.active||after.fight.over)break;
    }
    const observations=await evaluate(`__battleSceneProof.observations.slice(${start})`);
    assert.ok(observations.some(o=>o.ui.projectedScene?.family==='ai-target'),'At least one genuine AI scene at '+size[0]);
    if(status) {
      const before=await ready(1,'Original player PICK after the status reports');
      await button('[data-hd-battle-sys]');await ready(6,'The next original system menu can open after status playback');
      await button('[data-hd-battle-cancel]');const after=await ready(1,'Return from the actual system menu');
      assert.equal(after.fight.bout,before.fight.bout);assert.deepEqual(after.units,before.units);
      assert.deepEqual((await c.readKeys(before.keys)).map(k=>k.code),[40,40]);
      assert.equal(after.touches,before.touches);
    }
    await checkpoint('battle-scene-retired-'+size[0]);
    await delay(100);assert.equal(await evaluate('BayeHdSpe.isOpen()'),false,'Movie retires without retained overlay');
  }
  const proof=await evaluate('__battleSceneProof');
  assert.equal(proof.overflow,false);assert.deepEqual(proof.errors,[]);
  const projected=proof.observations.filter(o=>o.ui.projectedScene);
  assert.ok(projected.length);
  for(const o of projected) {
    const s=o.spe,p=o.ui.projectedScene,src=p.family==='ai-target'?s.display.aiTarget:s.display.statusEffect;
    assert.equal(o.ui.open,true);assert.equal(o.ui.source,'hd-assets');assert.equal(o.ui.outsideSource,'hd-battle-scene');
    assert.equal(o.ui.skipVisible,false);assert.equal(o.actionTicket,false,'Display-only movie cannot borrow action ticket');
    assert.equal(o.cameraAfter,o.cameraBefore,'Read-only scene leaves operative camera unchanged');
    assert.deepEqual(p.view,{x:src.mapSX,y:src.mapSY,cols:10,rows:6});
    assert.deepEqual([o.map.x,o.map.y,o.map.width,o.map.height],[src.mapSX,src.mapSY,src.mapWidth,src.mapHeight]);
    assert.equal(o.map.tiles.length,src.mapWidth*src.mapHeight);assert.ok(o.map.tiles.every(v=>v>0&&v<=255));
    const index=p.family==='ai-target'?src.targetIndex:src.subjectIndex,person=p.family==='ai-target'?src.targetPerson:src.subjectPerson;
    const u=o.units[index];assert.equal(u.token,person+1);assert.deepEqual(p.subject,{index,person,x:u.x,y:u.y});
    assert.deepEqual(p.region,{x:(u.x-src.mapSX)*o.ui.canvasW/10,y:(u.y-src.mapSY)*o.ui.canvasH/6,width:o.ui.canvasW/10,height:o.ui.canvasH/6});
    assert.deepEqual([p.generation,p.eventId,p.commitSeq],[s.generation,s.eventId,s.display.commitSeq]);
    assert.equal(o.ui.flushKey,s.generation+':'+s.eventId+':'+s.display.commitSeq);
    assert.deepEqual(p.frames,o.ui.displayedFrames);assert.equal(p.libraryGeneration,o.identity.generation);
    assert.equal(o.identity.sha256,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');assert.equal(o.identity.byteLength,207195);
    assert.ok(o.colors>8,'Actual HD readback contains independently observed colored terrain/unit artwork');
    const r=o.rect;assert.ok(r.width>0&&r.height>0&&r.x>=r.stageX-1&&r.y>=r.stageY-1&&r.x+r.width<=r.stageX+r.stageW+1&&r.y+r.height<=r.stageY+r.stageH+1,'Scene fits the actual stage');
    if(p.family!=='ai-target') {
      assert.deepEqual([u.state,u.hp,u.arms,u.level,u.experience],[src.afterState,src.afterHp,src.afterArms,src.afterLevel,src.afterExperience]);
      const label=p.family==='departure'?`${u.name}退场`:src.afterLevel>src.beforeLevel
        ?`${u.name}升级（${src.beforeLevel} → ${src.afterLevel} 级）`:`${u.name}（${src.afterLevel} 级）`;
      assert.equal(p.statusCaption,label);
      assert.deepEqual(o.title,{text:label,visible:true,inViewport:true});
    }
  }
  report.battleSceneProof=proof;
  if(status) {
    for(const family of ['upgrade','departure']) {
      const frames=projected.filter(o=>o.ui.projectedScene.family===family&&o.ui.projectedScene.phase===1);
      assert.ok(frames.length>=2&&frames.some(o=>o.spe.display.frameIndex===o.spe.endFrm),'Real combat must play the final '+family+' frame');
    }
    assert.ok(report.battleSceneResize&&proof.resizes.some(({after})=>after.width===report.battleSceneResize.to[0]&&
      after.height===report.battleSceneResize.to[1]),'The requested landscape size reached a currently painted status frame');
    for(const {before,after} of proof.resizes) {
      assert.deepEqual(after.owner,before.owner,'Resize occurs within the same original copied status frame');
      assert.deepEqual([after.keys,after.touches,after.input],[before.keys,before.touches,false]);
      assert.equal(after.presentation,'hd','Changing the landscape viewport keeps the current HD status frame');
      assert.deepEqual(after.scene,before.scene);
      assert.deepEqual(after.title,before.title);
      assert.deepEqual(after.canvas,{visible:true,inViewport:true});
      assert.equal(after.lcd.visible,false);
    }
  }
  report.battleSceneVerdict={accepted:true,projectedCommits:projected.length,events:[...new Set(projected.map(o=>o.spe.generation+':'+o.spe.eventId))],viewports,
    scope:status?'Original mobile AI target, combat upgrade and departure with current visible status captions, real report confirmations, colored HD canvas readback and landscape resize within one native copied frame.':'Actual original AI target scene identity, native viewport and unit projection, observed colored HD pixels, display-only ownership, camera unchanged and zero automatic inputs.'};
  report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.equal(report.exceptions.length,0);report.battleSceneAccepted=true;report.ok=true;report.accepted=true;
  report.acceptedScope=[report.battleSceneVerdict.scope];report.pendingScope=[...(status?[]:['Natural upgrade and departure']),
    'Exact HD asset pixel composition','Android/iOS real devices','Full HD completion'];
  } catch(error) {
    try { report.battleSceneProof=await evaluate('__battleSceneProof'); } catch { report.battleSceneProofUnavailable=true; }
    throw error;
  }
}
