import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {verifyHdBattleScene,verifyHdBattleScenePixels} from './hd-battle-scene-runtime-oracle.mjs';
const clone=v=>structuredClone(v),enc=b=>Buffer.from(b).toString('base64');
function fixture(){
 const source={valid:true,protocolVersion:2,commandType:0,commandParam:0,actorIndex:10,targetIndex:0,actorPerson:10,targetPerson:0,actorX:7,actorY:5,targetX:4,targetY:4,mapSX:2,mapSY:3,mapWidth:20,mapHeight:10,screenWidth:160,screenHeight:96,regionX:32,regionY:16,regionWidth:16,regionHeight:16,clearFrames:Array(32).fill(0)};
 const visible=Array(32).fill(0);visible[1]=16;const identity={status:'ready',sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',byteLength:207195,generation:3};
 const raw={g_hdEngineReady:1,g_hdDetailGeneration:7,g_hdFightActive:1,g_hdFightOver:0,g_FgtOver:0,g_hdReportActive:0,g_hdMenuActive:0,g_hdHelpActive:0,g_hdViewActive:0,g_hdQtyActive:0,g_MapWid:20,g_MapHgt:10,g_MapSX:2,g_MapSY:3,g_PIdx:1};
 const units=Array.from({length:20},(_,index)=>({index,token:0,pos:{x:0,y:0,hp:0,mp:0,move:0,active:0,state:0}}));
 for(const [index,token,x,y] of [[0,1,4,4],[10,11,7,5]]){const person={OldBelong:1,Belong:1,Level:1,Force:70,IQ:50,Devotion:80,Character:0,Experience:0,Thew:100,ArmsType:0,Arms:100,Tool1:0,Tool2:0,Age:20};Object.assign(units[index],{token,pos:{x,y,hp:500,mp:300,move:4,active:0,state:0},name:'将'+index,armType:0,arms:100,level:1,experience:0,person,equip:[0,0]});}
 const native={identity,raw,ids:units.map(u=>u.token),units,tiles:Array(200).fill(1),personCount:200,personCapacity:2000,mapCapacity:65536};
 const result={source:'hd-battle-scene',view:{x:2,y:3,cols:10,rows:6},region:{x:32,y:16,width:16,height:16},subject:{index:0,person:0,x:4,y:4},family:'ai-target',phase:null,generation:7,eventId:9,commitSeq:1,frames:[12],clears:[],renderedUnits:[0,10],libraryGeneration:3};
 const white=Array(32).fill(0);white[0]=1;const pic={picIndex:7,src:'assets/hd-spe/test.png',width:32,height:32,nativeWhitePixels:white},entry={speId:27,kind:4,count:18,picmax:9,startFrm:12,endFrm:17,aiTargetVersion:2,maskSemantics:'native-and-or-v1',resourceFingerprint:'fnv1a32:ba494eea:735',resourceLength:735,pictures:[pic],units:Array.from({length:18},(_,frame)=>({frame,x:0,y:0,picIndex:frame%2?8:7}))};
 const asset=Buffer.alloc(16*16*4);asset.set([200,40,70,255],(5*16+6)*4);const baseline=Buffer.alloc(160*96*4);for(let k=0;k<baseline.length;k+=4)baseline.set([8,16,24,255],k);const actual=Buffer.from(baseline);actual.set([200,40,70,255],((16+5)*160+32+6)*4);
 const paint={before:native,after:clone(native),width:160,height:96,result,output:enc(actual),overlay:{baseline:enc(baseline),effect:enc(asset),region:clone(result.region),operations:[{type:'clearRect',args:[0,0,16,16]},{type:'clearRect',args:[0,0,1,1]},{type:'drawImage',src:pic.src,args:[0,0,16,16],naturalWidth:32,naturalHeight:32,scaledRgba:enc(asset)}]}};
 const spe={active:1,id:27,kind:4,protocolValid:true,frameValid:true,generation:7,eventId:9,resourceFingerprint:entry.resourceFingerprint,resourceLength:735,keyflag:0,skipEligible:false,parentEventId:0,depth:1,contextKnown:true,startFrm:12,endFrm:17,frameIndex:12,commitSeq:1,aiTarget:clone(source),display:{generation:7,eventId:9,commitSeq:1,frameValid:true,frameIndex:12,visibleFrames:visible,aiTarget:source}};
 return {capture:{spe,ui:{source:'hd-assets',outsideSource:'hd-battle-scene',projectedScene:clone(result)},scenePaint:paint},entry,expectedFrames:[12],expectedClears:[]};
}
test('native 10x6 projection uses native map origin, all 20 slots and U16 hp/mp',()=>{const f=fixture();assert.equal(verifyHdBattleScene(f).accepted,true);assert.equal(verifyHdBattleScenePixels({paint:f.capture.scenePaint,entry:f.entry,frames:[12]}).outsidePixels,15104);});
test('transparent asset preserves observed scene baseline outside and within clear pixels',()=>{const f=fixture();const p=f.capture.scenePaint;assert.equal(verifyHdBattleScenePixels({paint:p,entry:f.entry,frames:[12]}).accepted,true);});
const rejects={
 'LCD background cannot claim HD scene':f=>f.capture.ui.outsideSource='lcd',
 'action camera origin cannot replace native origin':f=>f.capture.ui.projectedScene.view.x++,
 'wrong projected cell':f=>f.capture.ui.projectedScene.region.x++,
 'wrong subject person':f=>f.capture.ui.projectedScene.subject.person++,
 'wrong display event':f=>f.capture.ui.projectedScene.eventId++,
 'wrong display commit':f=>f.capture.ui.projectedScene.commitSeq++,
 'stale native origin':f=>f.capture.scenePaint.before.raw.g_MapSX++,
 'changed map tile during paint':f=>f.capture.scenePaint.after.tiles[0]++,
 'same labels cannot hide new library':f=>f.capture.scenePaint.after.identity.generation++,
 'Mod identity is rejected':f=>{f.capture.scenePaint.before.identity.sha256='0'.repeat(64);f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'missing map capacity is rejected':f=>{delete f.capture.scenePaint.before.mapCapacity;f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'truncated current map rejected':f=>{f.capture.scenePaint.before.tiles.pop();f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'zero unknown tile rejected':f=>{f.capture.scenePaint.before.tiles[0]=0;f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'duplicate occupied token rejected':f=>{const n=f.capture.scenePaint.before;n.units[10].token=n.ids[10]=1;f.capture.scenePaint.after=clone(n);},
 'missing empty slot rejected':f=>{f.capture.scenePaint.before.units.pop();f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'out of range native slot rejected':f=>{const n=f.capture.scenePaint.before;n.units[2].token=n.ids[2]=201;f.capture.scenePaint.after=clone(n);},
 'wrong participant name rejected':f=>{f.capture.scenePaint.before.units[0].name='';f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'equipment alias mismatch rejected':f=>{f.capture.scenePaint.before.units[0].equip[0]=1;f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'current report owner rejects old effect':f=>{f.capture.scenePaint.before.raw.g_hdReportActive=1;f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'current menu owner rejects old effect':f=>{f.capture.scenePaint.before.raw.g_hdMenuActive=1;f.capture.scenePaint.after=clone(f.capture.scenePaint.before);},
 'unpublished frame rejected':f=>f.capture.spe.display.visibleFrames[1]=32,
 'cleared visible frame rejected':f=>{f.expectedClears=[12];f.capture.spe.aiTarget.clearFrames[1]=16;f.capture.spe.display.aiTarget.clearFrames[1]=16;},
 'wrong target coordinates rejected':f=>f.capture.spe.display.aiTarget.targetX++,
 'custom resource rejected':f=>f.capture.spe.resourceFingerprint='custom',
 'unskippable input contract retained':f=>f.capture.spe.skipEligible=true,
 'zero generation rejected':f=>f.capture.spe.generation=0,
 'stale display source rejected':f=>f.capture.spe.aiTarget.commandParam=2,
 'wrong rendered native unit rejected':f=>f.capture.ui.projectedScene.renderedUnits=[0],
 'active fight required for AI':f=>{f.capture.scenePaint.before.raw.g_hdFightActive=0;f.capture.scenePaint.after=clone(f.capture.scenePaint.before);}
};
for(const [name,change] of Object.entries(rejects))test(name,()=>{const f=fixture();change(f);assert.throws(()=>verifyHdBattleScene(f));});
const pixelRejects={
 'corrupted outside output':p=>{const b=Buffer.from(p.output,'base64');b[0]++;p.output=enc(b);},
 'corrupted subject output':p=>{const b=Buffer.from(p.output,'base64');b[((16+5)*160+32+6)*4]+=10;p.output=enc(b);},
 'wrong asset source':p=>p.overlay.operations[2].src='assets/hd-spe/other.png',
 'wrong native-white clear location':p=>p.overlay.operations[1].args[0]++,
 'missing native-white clear':p=>p.overlay.operations.splice(1,1),
 'extra layer operation':p=>p.overlay.operations.push({type:'clearRect',args:[0,0,1,1]}),
 'wrong layer dimensions':p=>p.overlay.operations[2].args[2]=15,
 'wrong natural image dimensions':p=>p.overlay.operations[2].naturalWidth++,
 'wrong actual effect pixels':p=>{const b=Buffer.from(p.overlay.effect,'base64');b[(5*16+6)*4]+=10;p.overlay.effect=enc(b);},
 'missing observed baseline':p=>delete p.overlay.baseline,
 'wrong overlay location':p=>p.overlay.region.x++
};
for(const [name,change] of Object.entries(pixelRejects))test(name,()=>{const f=fixture();change(f.capture.scenePaint);assert.throws(()=>verifyHdBattleScenePixels({paint:f.capture.scenePaint,entry:f.entry,frames:[12]}));});

function statusFixture(reason,phase=1){const f=fixture(),c=f.capture,e=c.spe,s=e.display.aiTarget,p=c.scenePaint,begin=reason===1?0:6;Object.assign(s,{protocolVersion:1,reason,phase,subjectIndex:0,subjectPerson:0,subjectX:4,subjectY:4,beforeLevel:1,afterLevel:reason===1?2:1,beforeExperience:reason===1?100:0,afterExperience:0,beforeState:0,afterState:reason===1?0:8,beforeHp:reason===1?500:0,afterHp:reason===1?500:0,beforeArms:100,afterArms:100,levelMax:20});e.statusEffect=clone(s);e.display.statusEffect=s;delete e.aiTarget;delete e.display.aiTarget;e.startFrm=begin;e.endFrm=begin+5;e.frameIndex=e.display.frameIndex=begin;e.display.visibleFrames=Array(32).fill(0);e.display.visibleFrames[begin>>3]|=1<<(begin&7);f.expectedFrames=[begin];delete f.entry.aiTargetVersion;Object.assign(f.entry,{startFrm:begin,endFrm:begin+5,statusVersion:1,statusReason:reason});f.entry.units[begin]={frame:begin,x:0,y:0,picIndex:2};f.entry.pictures[0].picIndex=2;const native=p.before;native.raw.g_hdFightActive=phase===1?1:0;Object.assign(native.units[0],{level:s.afterLevel,experience:s.afterExperience});Object.assign(native.units[0].pos,{state:s.afterState,hp:s.afterHp});Object.assign(native.units[0].person,{Level:s.afterLevel,Experience:s.afterExperience});p.after=clone(native);Object.assign(p.result,{family:reason===1?'upgrade':'departure',phase,frames:[begin],renderedUnits:reason===1?[0,10]:[10]});c.ui.projectedScene=clone(p.result);return f;}
test('upgrade at real native initialize phase2 permits inactive fight but validates mutation',()=>{assert.equal(verifyHdBattleScene(statusFixture(1,2)).family,'upgrade');});
test('departure excludes state8 subject from troop cards but keeps its real effect projection',()=>{assert.deepEqual(verifyHdBattleScene(statusFixture(2)).renderedUnits,[10]);});
test('upgrade cannot claim experience was preserved',()=>{const f=statusFixture(1);f.capture.spe.display.statusEffect.afterExperience=100;f.capture.spe.statusEffect.afterExperience=100;assert.throws(()=>verifyHdBattleScene(f));});
test('departure requires actual zero hp or arms',()=>{const f=statusFixture(2);for(const s of [f.capture.spe.statusEffect,f.capture.spe.display.statusEffect])s.beforeHp=s.afterHp=500;assert.throws(()=>verifyHdBattleScene(f));});
test('status initialize cannot be reused as live AI ticket',()=>{const f=fixture();f.capture.scenePaint.before.raw.g_hdFightActive=0;f.capture.scenePaint.after=clone(f.capture.scenePaint.before);assert.throws(()=>verifyHdBattleScene(f));});

test('both generated browser observers compile before a browser is started',()=>{const source=fs.readFileSync(new URL('./test-hd-ai-target-runtime.mjs',import.meta.url),'utf8'),block=source.slice(source.indexOf('const sceneObserverSource='),source.indexOf('const frames=bits'));assert.ok(block.includes('sceneObserverSource')&&block.includes('observerSource'));const scope={};vm.runInNewContext(block+';globalThis.generated={sceneObserverSource,observerSource};',scope);for(const expression of Object.values(scope.generated))new vm.Script(expression);assert.equal(Object.keys(scope.generated).length,2);});

function measuredOverlap(){const f=fixture(),p=f.capture.scenePaint,position=(5*16+6)*4,first=Buffer.alloc(16*16*4),second=Buffer.alloc(first.length),effect=Buffer.alloc(first.length);first.set([181,163,109,250],position);second.set([51,51,36,35],position);effect.set([162,148,99,250],position);const background=Buffer.alloc(160*96*4);for(let k=0;k<background.length;k+=4)background.set([36,91,131,255],k);const output=Buffer.from(background);output.set([159,147,100,255],((16+5)*160+32+6)*4);p.overlay.baseline=enc(background);p.overlay.effect=enc(effect);p.output=enc(output);p.overlay.operations[2].scaledRgba=enc(first);const picture={...f.entry.pictures[0],picIndex:8,src:'assets/hd-spe/second.png',nativeWhitePixels:Array(32).fill(0)};f.entry.pictures.push(picture);p.overlay.operations.push({type:'drawImage',src:picture.src,args:[0,0,16,16],naturalWidth:32,naturalHeight:32,scaledRgba:enc(second)});return f;}
test('measured alpha250 + alpha35 overlap follows exact integer premultiplied Canvas result',()=>{const f=measuredOverlap();assert.equal(verifyHdBattleScenePixels({paint:f.capture.scenePaint,entry:f.entry,frames:[12,13]}).accepted,true);});
test('floating straight-alpha result alpha251 is rejected rather than widening tolerance',()=>{const f=measuredOverlap(),p=f.capture.scenePaint,b=Buffer.from(p.overlay.effect,'base64');b.set([163,147,99,251],(5*16+6)*4);p.overlay.effect=enc(b);assert.throws(()=>verifyHdBattleScenePixels({paint:p,entry:f.entry,frames:[12,13]}));});
test('measured final output rejects the old floating result [161,146,100]',()=>{const f=measuredOverlap(),p=f.capture.scenePaint,b=Buffer.from(p.output,'base64');b.set([161,146,100,255],((16+5)*160+32+6)*4);p.output=enc(b);assert.throws(()=>verifyHdBattleScenePixels({paint:p,entry:f.entry,frames:[12,13]}));});
test('one byte changed in opaque final output is rejected by the tighter exact gate',()=>{const f=measuredOverlap(),p=f.capture.scenePaint,b=Buffer.from(p.output,'base64');b[((16+5)*160+32+6)*4]++;p.output=enc(b);assert.throws(()=>verifyHdBattleScenePixels({paint:p,entry:f.entry,frames:[12,13]}));});
