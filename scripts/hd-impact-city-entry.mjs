import assert from 'node:assert/strict';

// Original GetCitySet / PlayerTactic / OrderMenu entry, not a generic selection.
// Public walkToCity uses alignAndEnter's Y-first native arrows then one 39.
// Caller must bind the complete ROM arrays to the verified current library,
// and compare fresh native geometry before/after the observed public walk.
// pos is the public cityScreenPos result, whose engX/Y bind to original ROM.
// This pure oracle authorizes no input and never writes native or UI objects.
export function v13AssertCityEntry(before,rootMenu,pos,walkKeys,native){
  assert.ok(before&&rootMenu&&pos&&native,'Complete city-entry observations required');
  const {geometry:g,map,positions,rootMenuBytes}=native,s=before.state,cityIndex=pos.index;
  assert.ok(Number.isInteger(cityIndex)&&cityIndex>=0&&cityIndex<38,'Original target city index');
  assert.equal(before.world.cities[cityIndex].Belong,before.world.king+1,'Only a currently owned target city enters the command root');
  assert.deepEqual([before.meta.overworldMode,before.meta.cityMode],['hd-map','classic']);
  assert.equal(before.meta.currentIdentity,true);assert.equal(before.meta.identity.status,'ready');
  for(const k of ['data','engine','hd'])assert.ok(Number.isSafeInteger(s.snapshot.references[k])&&s.snapshot.references[k]>0,'Current native reference '+k);
  assert.ok(Number.isSafeInteger(s.keys)&&s.keys>=0);assert.ok(Number.isInteger(s.menu.seq)&&s.menu.seq>=0&&s.menu.seq<=0xffffffff);
  assert.ok(Number.isInteger(s.march.mapInputSeq)&&s.march.mapInputSeq>0&&s.march.mapInputSeq<=0xffffffff);
  assert.deepEqual([s.march.pick,s.march.battlePick,s.menu.active,s.qty.active,s.record.active],[1,0,0,0,0]);
  assert.ok([0,7].includes(s.march.phase));assert.equal(s.overworld,'map');
  for(const name of ['fight','spe','result','report'])assert.ok(!s.snapshot[name].active,'No active '+name+' may authorize city entry');
  assert.deepEqual([g.mapWidth,g.mapHeight,g.screenWidth,g.screenHeight],[12,9,160,96]);
  assert.equal(map.length,108);assert.equal(positions.length,76);assert.equal(rootMenuBytes.length,16);
  for(const v of [...map,...positions,...rootMenuBytes])assert.ok(Number.isInteger(v)&&v>=0&&v<=255,'Complete original ROM byte arrays');
  for(const k of ['left','top','right','bottom'])assert.ok(Number.isInteger(g.cursorRange[k])&&g.cursorRange[k]>=0&&g.cursorRange[k]<=65535,'Native cursor range '+k);
  const target={x:positions[cityIndex*2],y:positions[cityIndex*2+1]};assert.deepEqual([pos.engX,pos.engY],[target.x,target.y],'Public target is bound to original city-position ROM');
  assert.ok(target.x<12&&target.y<9);assert.equal(map[target.y*12+target.x],cityIndex+1,'Original map cell binds target city');
  const p=structuredClone(before.meta.cityPos),viewWidth=Math.floor((g.screenWidth+1)/16)-2,viewHeight=Math.floor(g.screenHeight/16),codes=[],steps=[];
  for(const k of ['x','y','setx','sety'])assert.ok(Number.isInteger(p[k])&&p[k]>=0&&p[k]<=255,'Native cursor/viewport '+k);
  assert.ok(p.setx<12&&p.sety<9);assert.equal(s.march.mapCity,map[p.sety*12+p.setx],'Initial native mapCity is current cursor cell');
  while(p.setx!==target.x||p.sety!==target.y){
    assert.ok(codes.length<32,'Bounded source-derived native walk');
    const from=structuredClone(p);let code;
    if(p.sety!==target.y){code=p.sety>target.y?34:35;p.sety+=p.sety>target.y?-1:1;}
    else{code=p.setx>target.x?36:37;p.setx+=p.setx>target.x?-1:1;}
    assert.ok(p.setx>=0&&p.setx<12&&p.sety>=0&&p.sety<9&&p.setx>=g.cursorRange.left&&p.setx<=g.cursorRange.right&&p.sety>=g.cursorRange.top&&p.sety<=g.cursorRange.bottom,'Every native arrow remains within current map/cursor range');
    if(code===34&&p.sety<p.y)p.y=p.sety;
    if(code===36&&p.setx<p.x)p.x=p.setx;
    if(code===35&&p.sety>=p.y+viewHeight)p.y=p.sety-viewHeight+1;
    if(code===37&&p.setx>=p.x+viewWidth)p.x=p.setx-viewWidth+1;
    codes.push(code);steps.push({from,to:structuredClone(p),code,mapCity:map[p.sety*12+p.setx]});
  }
  codes.push(39);assert.ok(Array.isArray(walkKeys));assert.deepEqual(walkKeys.map(k=>k.code),codes,'Only exact C-derived public walk arrows followed by one native Enter');
  assert.equal(rootMenu.state.keys-before.state.keys,walkKeys.length,'Actual native key slice exactly spans MAP to root-menu observations');
  let lastAt=-Infinity;for(const k of walkKeys){
    assert.ok(typeof k.phase==='string'&&k.phase.length>0&&k.phase===walkKeys[0].phase,'Native instrumentation phase remains the same during city walk');
    assert.ok(Number.isFinite(k.at)&&k.at>=0&&k.at>=lastAt,'Native input record time is monotonic');lastAt=k.at;
    assert.deepEqual([k.generation,k.eventId,k.kind,k.speActive],[s.snapshot.spe.generation,s.snapshot.spe.eventId,s.snapshot.spe.kind,s.snapshot.spe.active],'Walk inputs retain original generation/effect identity');
    assert.deepEqual([k.resultActive,k.resultSession,k.resultPhase],[s.snapshot.result.active,s.snapshot.result.session,s.snapshot.result.phase],'No result owner or acknowledgement input during walk');
    assert.deepEqual([k.inputKind,k.actorIndex,k.focusX,k.focusY],[s.snapshot.fight.inputKind,s.snapshot.fight.actorIndex,s.snapshot.fight.focusX,s.snapshot.fight.focusY],'No battle input owner during city walk');
    assert.deepEqual(k.report,s.snapshot.report,'No report owner or report mutation is hidden by walk input records');
  }
  const decoder=new TextDecoder('gbk',{fatal:true}),names=Array.from({length:4},(_,i)=>decoder.decode(Uint8Array.from(rootMenuBytes.slice(i*4,i*4+4))));
  assert.deepEqual(names,['内政','外交','军备','状况'],'Original root-menu ROM names');
  const expected=structuredClone(before);expected.meta.cityPos=p;expected.state.keys+=codes.length;expected.state.overworld='classic-menu';
  expected.state.march.pick=0;expected.state.march.mapCity=cityIndex+1;
  const next=((s.menu.seq+1)>>>0)||1;Object.assign(expected.state.menu,{active:1,context:1,kind:1,seq:next,itemLen:4,count:4,index:0,names,packedNames:names.slice(),ids:[],idsValid:false});
  assert.deepEqual(rootMenu,expected,'City entry permits only C-derived cursor/viewport/keycount, MAP-to-root ownership and root menu; full world/meta/ref/seq/unknown fields remain exact');
  return {accepted:true,cityIndex,target,expectedPosition:p,expectedCodes:codes,steps,walkKeys:structuredClone(walkKeys),mapInputSeq:s.march.mapInputSeq,menuSeq:next,worldUnchanged:true,remainingMetaExact:true,scope:'Original MAP -> city ROOT only; no payment, other city command, month, battle or cast acceptance'};
}
