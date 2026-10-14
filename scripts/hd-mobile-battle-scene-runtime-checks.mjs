// Actual original-game scenario; the parent runner owns browser/server cleanup.
import assert from 'node:assert/strict';

export async function runMobileBattleSceneChecks(c) {
  const {report,evaluate,until,delay,checkpoint,metrics,button,native,ready,menu}=c;
  report.battleSceneAccepted=false;
  report.battleSceneTurns=[];
  // Observe after production painting. This never changes native values,
  // timers, RNG, getter results, event handlers or presentation preferences.
  await evaluate(`(() => {
    const api=BayeHdSpe,original=api.onLcdFlush;
    window.__battleSceneProof={observations:[],errors:[],screens:[],overflow:false};
    api.onLcdFlush=function(){
      const cameraBefore=JSON.stringify(BayeHdMobileBattle.debugSnapshot().camera);
      try{return original.apply(this,arguments);}finally{try{(() => {
        const s=baye.hd.spe();if(s.active!==1||s.id!==27||s.kind!==4)return;
        const d=baye.data,ui=api.debugSnapshot(),store=__battleSceneProof,source=s.display&&(s.display.aiTarget||s.display.statusEffect);
        if(store.observations.length>=2000){store.overflow=true;return;}
        const canvas=document.getElementById('hd-spe-canvas'),r=canvas.getBoundingClientRect(),stage=document.getElementById('hd-mobile-stage').getBoundingClientRect();
        const down=document.createElement('canvas');down.width=160;down.height=96;
        down.getContext('2d').drawImage(canvas,0,0,160,96);
        const pixels=down.getContext('2d').getImageData(0,0,160,96).data,colors=new Set();
        for(let i=0;i<pixels.length;i+=4)colors.add([pixels[i],pixels[i+1],pixels[i+2],pixels[i+3]].join(','));
        const units=Array.from({length:20},(_,index)=>{const token=Number(d.g_FgtParam.GenArray[index]),p=d.g_GenPos[index];return {
          index,token,x:Number(p.x),y:Number(p.y),state:Number(p.state),hp:Number(p.hp),active:Number(p.active),
          arms:token>0&&token<=200?Number(d.g_Persons[token-1].Arms):null};});
        const identity=BayeHdLibIdentity.read();
        store.observations.push({spe:s,ui:{open:ui.open,source:ui.source,presentation:ui.presentation,flushKey:ui.flushKey,
          displayedFrames:ui.displayedFrames,outsideSource:ui.outsideSource,projectedScene:ui.projectedScene,
          projectionFallbackReason:ui.projectionFallbackReason,skipVisible:ui.skipVisible,canvasW:canvas.width,canvasH:canvas.height},
          fight:baye.hd.fight(),units,identity:{generation:identity.generation,sha256:identity.sha256,byteLength:identity.byteLength,status:identity.status},
          map:{width:Number(d.g_MapWid),height:Number(d.g_MapHgt),x:Number(d.g_MapSX),y:Number(d.g_MapSY),
            tiles:Array.from({length:Number(d.g_MapWid)*Number(d.g_MapHgt)},(_,i)=>Number(d.g_FightMapData[i]))},
          cameraBefore,cameraAfter:JSON.stringify(BayeHdMobileBattle.debugSnapshot().camera),
          colors:colors.size,rect:{x:r.left,y:r.top,width:r.width,height:r.height,stageX:stage.left,stageY:stage.top,stageW:stage.width,stageH:stage.height},
          actionTicket:BayeHdBattle.getInputTicket()!==null,keys:__mobileMapKeys.length,touches:__mobileMapNativeTouches.length});
        const shotKey=window.innerWidth+':'+s.generation+':'+s.eventId;
        if(ui.projectedScene&&!store.screens.some(p=>p.key===shotKey)&&store.screens.length<12)
          store.screens.push({key:shotKey,eventId:s.eventId,width:innerWidth,height:innerHeight,png:canvas.toDataURL('image/png')});
      })();}catch(e){__battleSceneProof.errors.push(String(e&&e.stack||e));}}
    };
    return true;
  })()`);
  const viewports=report.battleSceneWidth===667?[[667,375]]:[[844,390]];
  try {
  for(const size of viewports) {
    await metrics(...size);await ready(1,'Fresh player PICK before scene viewport');
    const start=await evaluate('__battleSceneProof.observations.length');
    for(let turn=0;turn<8;turn++) {
      const before=await native();
      await button('[data-hd-battle-sys]');await ready(6,'Current actual scene SYSTEM');
      const system=await native();assert.equal(system.keys,before.keys+1,'One explicit system input');
      await menu(0,'Explicit army end for natural AI scene');
      await until('Natural AI returns to next native player bout',`(() => {const f=baye.hd.fight();return f.active===1&&!f.over&&f.inputKind===1&&f.bout===${before.fight.bout+1}&&BayeHdMobileBattle.refresh().presentation==='hd';})()`,60000);
      const after=await native();assert.equal(after.keys,system.keys+1,'Scene sends zero automatic keys or report acknowledgements');
      assert.deepEqual(await evaluate('__battleSceneProof.errors'),[],'Read-only observer remained valid');
      assert.equal(after.touches,before.touches,'HD battle controls never forward LCD touch');
      report.battleSceneTurns.push({viewport:size,before:before.fight,after:after.fight,keys:after.keys-before.keys,touches:after.touches-before.touches});
      if(await evaluate(`__battleSceneProof.observations.slice(${start}).some(o=>o.ui.projectedScene&&o.ui.projectedScene.family==='ai-target')`))break;
    }
    const observations=await evaluate(`__battleSceneProof.observations.slice(${start})`);
    assert.ok(observations.some(o=>o.ui.projectedScene?.family==='ai-target'),'At least one genuine AI scene at '+size[0]);
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
  }
  report.battleSceneProof=proof;
  report.battleSceneVerdict={accepted:true,projectedCommits:projected.length,events:[...new Set(projected.map(o=>o.spe.generation+':'+o.spe.eventId))],viewports,
    scope:'Actual original AI target scene identity, native viewport and unit projection, observed colored HD pixels, display-only ownership, camera unchanged and zero automatic inputs. Exact PNG pixel composition and natural upgrade/departure are not claimed.'};
  report.nativeKeys=await evaluate('__mobileMapKeys');report.nativeTouches=await evaluate('__mobileMapNativeTouches');report.trustedEvents=await evaluate('__mobileMapEvents');
  assert.equal(report.exceptions.length,0);report.battleSceneAccepted=true;report.ok=true;report.accepted=true;
  report.acceptedScope=[report.battleSceneVerdict.scope];report.pendingScope=['Natural upgrade/departure scene pixels','Android/iOS real devices','Full HD completion'];
  } catch(error) {
    try { report.battleSceneProof=await evaluate('__battleSceneProof'); } catch { report.battleSceneProofUnavailable=true; }
    throw error;
  }
}
