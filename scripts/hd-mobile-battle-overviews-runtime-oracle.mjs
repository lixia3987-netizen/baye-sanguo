// Pure validation of measured original battle HELP/VIEW publications; never dispatches input.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const mobileBattleOverviewContract=Object.freeze({
  originalLib:{bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'},
  helpKinds:[1,2],viewInitialForce:1,keys:{up:34,down:35,left:36,right:37,back:40},
  scope:'Original measured mobile HELP and VIEW only; no battle effect, real-device, whole-ABI or full-HD acceptance'
});
const int=(v,lo,hi,label)=>{assert.ok(Number.isInteger(v)&&v>=lo&&v<=hi,label);return v;};
const next=v=>(v+1)>>>0||1;
const text=(v,label)=>assert.ok(typeof v==='string'&&v.length>0,label);
function source(bytes){assert.ok(ArrayBuffer.isView(bytes)&&bytes.BYTES_PER_ELEMENT===1);assert.equal(bytes.byteLength,207195);assert.equal(createHash('sha256').update(bytes).digest('hex'),mobileBattleOverviewContract.originalLib.sha256);}
// IFACE_STRID1, RCHEAD14/RIDX8; indices are the original data/pstring.h enum.
export function originalBattleOverviewLabels(bytes){source(bytes);const b=Buffer.from(bytes),base=b.readUInt32LE(0),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8),end=base+b.readUInt32LE(base);
  assert.equal(b.readUInt16LE(base+4),1);assert.equal(b.readUInt16LE(base+12),0);
  const item=i=>{int(i,1,count,'original string index');const row=base+14+(i-1)*8,off=fixed?base+14+(i-1)*fixed:base+b.readUInt32LE(row),len=fixed||b.readUInt32LE(row+4);
    assert.ok(off>=base+14&&off+len<=end&&end<=b.length);const p=b.subarray(off,off+len),z=p.indexOf(0);return p.subarray(0,z<0?p.length:z);};
  const decode=p=>new TextDecoder('gbk').decode(p),arms=item(12);return {title:decode(item(49)),positions:decode(item(54)),army:decode(item(50)),food:decode(item(52)),unknown:decode(item(53)),
    arms:Array.from({length:6},(_,i)=>decode(arms.subarray(i*4,i*4+4))),states:Array.from({length:8},(_,i)=>decode(item(28+i))),terrain:Array.from({length:8},(_,i)=>decode(item(14+i)))};}
function common(s,kind,libBytes){
  source(libBytes);assert.ok(s&&s.fight&&s.units&&s.genArray);assert.equal(s.genArray.length,20);assert.equal(s.units.length,20);
  assert.equal(s.fight.active,1);assert.equal(s.fight.over,0);assert.equal(s.fight.inputKind,kind);
  int(s.fight.inputSeq,1,0xffffffff,'current input sequence');int(s.detailGeneration,1,0xffffffff,'detail generation');
  for(let i=0;i<20;i++){
    int(s.genArray[i],0,200,'original person token');const u=s.units[i];assert.equal(u.slot,i);
    for(const k of ['x','y','move','active','state'])int(u[k],0,255,'JLPOS '+k);
    for(const k of ['hp','mp'])int(u[k],0,65535,'JLPOS '+k);
    if(s.genArray[i]){assert.equal(u.personIndex,s.genArray[i]-1);text(u.name,'native person name');assert.ok(u.person);}
  }
}
function publication(p,s){assert.equal(p.protocolVersion,1);assert.equal(p.active,1);assert.equal(p.complete,1);
  assert.equal(p.generation,s.detailGeneration);assert.equal(p.detailGeneration,s.detailGeneration);
  assert.equal(p.inputSeq,s.fight.inputSeq);int(p.seq,1,0xffffffff,'publication sequence');}
export function terrainFromNativeTile(tile){int(tile,0,255,'native terrain tile');if(tile>15)return tile===41?6:7;if(tile>5)return 2;if(tile>4)return 3;if(tile>3)return 4;if(tile>2)return 5;if(tile>1)return 0;if(tile>0)return 1;return 255;}

export function verifyMobileBattleHelp({sample,libBytes}){
  const s=sample;common(s,9,libBytes);const h=s.help;publication(h,s);assert.ok(h.kind===1||h.kind===2);
  assert.equal(h.x,s.fight.focusX);assert.equal(h.y,s.fight.focusY);text(h.text,'actual native help text');
  assert.ok(h.x<s.fight.mapW&&h.y<s.fight.mapH);
  const occupied=s.units.find(u=>s.genArray[u.slot]&&u.state!==8&&u.x===h.x&&u.y===h.y);
  if(h.kind===1){assert.ok(occupied,'HELP focus names a live occupied native slot');assert.equal(h.slot,occupied.slot);assert.equal(h.person,occupied.personIndex);
    assert.equal(h.name,occupied.name);const labels=originalBattleOverviewLabels(libBytes);assert.equal(h.arm,labels.arms[occupied.armType]);assert.equal(h.state,labels.states[occupied.state]);
    const p=occupied.person;assert.deepEqual(h.fields,[p.Level,p.Force,p.IQ,p.Experience,occupied.hp,occupied.mp,s.attack.at,s.attack.df,p.Arms,occupied.armType]);
    assert.equal(h.levelMax,Number(p.Level>=s.maxLevel));
  }else{assert.equal(occupied,undefined);assert.equal(h.slot,255);assert.equal(h.person,65535);
    assert.equal(s.map.length,s.fight.mapW*s.fight.mapH);assert.equal(h.terrain,terrainFromNativeTile(s.map[h.y*s.fight.mapW+h.x]));int(h.terrain,0,7,'real terrain');assert.equal(h.text,originalBattleOverviewLabels(libBytes).terrain[h.terrain]);}
  return {accepted:true,kind:h.kind,person:h.person,slot:h.slot,x:h.x,y:h.y,terrain:h.terrain,seq:h.seq,inputSeq:h.inputSeq,fields:h.fields,
    derivedAttackDefense:'Bound to actually measured g_GenAtt[0], not an independent combat-formula claim'};
}

export function verifyMobileBattleView({sample,libBytes}){
  const s=sample;common(s,10,libBytes);const v=s.view;publication(v,s);assert.equal(v.custom,0);int(v.force,0,1,'side');
  assert.equal(v.width,s.fight.mapW);assert.equal(v.height,s.fight.mapH);assert.equal(v.days,s.fight.bout);assert.equal(v.playerMode,s.mode);
  int(v.pageSize,1,10,'actual page size');int(v.pageStart,0,9,'page start');
  const base=v.force*10;let count=0;while(count<10&&s.genArray[base+count])count++;
  assert.equal(v.totalCount,count);assert.ok(v.pageStart<=count);assert.equal(v.rowCount,Math.min(v.pageSize,count-v.pageStart));assert.equal(v.rows.length,v.rowCount);
  v.rows.forEach((r,i)=>{const slot=base+v.pageStart+i,u=s.units[slot];assert.equal(r.slot,slot);assert.equal(r.personIndex,u.personIndex);assert.equal(r.name,u.name);assert.equal(r.arms,u.person.Arms);text(r.text,'native roster text');});
  const labels=originalBattleOverviewLabels(libBytes),first=s.units[base];assert.ok(s.genArray[base]);assert.equal(v.leaderPerson,first.person.Belong-1);assert.equal(v.factionText,(s.leaderNames[v.force]+labels.army).trimEnd());
  const known=Number(v.force===0||s.enemyKnownFood!==0);assert.equal(v.foodKnown,known);assert.equal(v.food,v.force?s.enemyKnownFood:s.playerFood);
  assert.equal(v.foodText,(labels.food+(known?v.food:labels.unknown)).trimEnd());assert.equal(v.title,labels.title.trimEnd());assert.equal(v.positionsText,labels.positions.trimEnd());
  for(const k of ['title','daysText','positionsText'])text(v[k],'native '+k);
  const points=s.units.filter(u=>u.state!==8).map(u=>({slot:u.slot,personIndex:s.genArray[u.slot]?u.personIndex:65535,x:u.x,y:u.y,state:u.state}));
  assert.deepEqual(v.points,points,'full native point list, separate from current roster and dead rows');
  for(const p of points){assert.ok(p.personIndex<200,'empty live point is not an original person');assert.ok(p.x<v.width&&p.y<v.height,'point inside actual map');}
  return {accepted:true,force:v.force,pageStart:v.pageStart,pageSize:v.pageSize,totalCount:count,rowCount:v.rowCount,points:points.length,foodKnown:known,food:v.food,seq:v.seq,inputSeq:v.inputSeq};
}

export function verifyMobileBattleViewTransition({before,after,key}){
  assert.ok([34,35,36,37].includes(key));const b=before.view,a=after.view;assert.equal(a.generation,b.generation);
  assert.equal(a.seq,next(b.seq));assert.equal(a.inputSeq,next(b.inputSeq));assert.equal(after.fight.inputSeq,a.inputSeq);
  let force=b.force,start=b.pageStart;if(key===36||key===37){force=1-force;start=0;}
  else if(key===34){if(start>0)start-=b.pageSize;}
  else if(b.totalCount>=b.pageSize&&start<b.totalCount-b.pageSize)start+=b.pageSize;
  assert.equal(a.force,force);assert.equal(a.pageStart,start);return {accepted:true,key,from:{force:b.force,pageStart:b.pageStart},to:{force,start},boundaryNoop:force===b.force&&start===b.pageStart};
}

export function verifyMobileBattleOverviewWorld({before,after}){
  assert.deepEqual(after.world,before.world,'all recorded strategic world fields unchanged');assert.deepEqual(after.units,before.units,'all 20 battle slots unchanged');
  assert.deepEqual(after.genArray,before.genArray);for(const k of ['playerFood','enemyKnownFood','mode','map','maxLevel'])assert.deepEqual(after[k],before[k]);
  assert.equal(after.touches,before.touches,'zero native LCD touches');assert.equal(after.pcBattle,before.pcBattle,'independent PC preference');
  return {accepted:true,measuredWorldOnly:true};
}
