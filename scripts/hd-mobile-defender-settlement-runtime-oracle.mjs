// Pure original FGT_DF settlement verification. No browser, input, native writes or RNG prediction.
import assert from 'node:assert/strict';

export const mobileDefenderSettlementContract=Object.freeze({
  mode:0,over:[1,2],people:200,cities:38,queue:2000,orders:200,fighterBytes:600,
  before:'Synchronous onEngineFight after active=0/over=1|2, before FightResultDeal',
  after:'Synchronous baye-hd-battle-settled after KingOverDeal and grain merge; Order27 is still live',
  randomBranches:'Observed captive or escape destination, independently constrained and reconstructed; RNG draw/continuity not verified',
  unsupported:['Actual loser death/equipment drop','King extinction without a successor','Post-settlement PolicyExec/month world'],
  sources:['vendor/iBaye/src/citycmdd.c:247-501,517-792,808-873','vendor/iBaye/src/cityedit.c:59-145','vendor/iBaye/src/Fight.c:79-119']
});
const PERSON=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const CITY=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce','PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms','PersonQueue','Persons','ToolQueue','Tools'];
const ORDER=['OrderId','Person','City','Object','Arms','Food','Money','Consume','TimeCount'];
const U16P=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
function uint(v,max,label){assert.ok(Number.isInteger(v)&&v>=0&&v<=max,label+' unsigned integer');return v;}
function array(a,n,max,label){assert.ok(Array.isArray(a)&&a.length===n,label+' complete length');for(const [i,v]of a.entries())uint(v,max,label+'['+i+']');}
function exact(a,b,label,path='$'){
  if(Object.is(a,b))return;
  assert.ok(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object',label+' differs at '+path);
  assert.equal(Array.isArray(a),Array.isArray(b),label+' type at '+path);
  const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();assert.deepEqual(ak,bk,label+' fields at '+path);
  for(const k of bk)exact(a[k],b[k],label,path+'.'+k);
}
function shape(w){
  assert.ok(w&&typeof w==='object','Full measured world');uint(w.king,199,'PlayerKing');uint(w.period,4,'Period');assert.ok(w.period>=1);uint(w.year,65535,'Year');uint(w.month,12,'Month');assert.ok(w.month>=1);
  assert.ok(Array.isArray(w.people)&&w.people.length===200,'All 200 people');for(const [i,p]of w.people.entries())for(const k of PERSON)uint(p?.[k],U16P.has(k)?65535:255,'Person '+i+' '+k);
  assert.ok(Array.isArray(w.cities)&&w.cities.length===38,'All 38 cities');array(w.queue,2000,65535,'Resident queue');const slots=new Set(),ids=new Set();
  for(const [i,c]of w.cities.entries()){
    for(const k of CITY)uint(c?.[k],['Population','PopulationLimit'].includes(k)?0xffffffff:65535,'City '+i+' '+k);
    uint(c.Belong,200,'City faction');assert.ok(c.PersonQueue+c.Persons<=200,'Active residents in first 200 slots');
    for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++){const p=uint(w.queue[j],199,'Resident PID');assert.ok(!slots.has(j),'Active city queue positions do not overlap');slots.add(j);ids.add(p);}
  }
  assert.ok(Array.isArray(w.orders)&&w.orders.length===200,'All 200 complete orders');for(const [i,o]of w.orders.entries())for(const k of ORDER)uint(o?.[k],['OrderId','City','Consume','TimeCount'].includes(k)?255:65535,'Order '+i+' '+k);
  array(w.fighters,600,255,'Fighter bytes');array(w.fighterIndex,30,255,'Fighter allocation');array(w.goodsQueue,2000,65535,'Goods queue');
  assert.ok(Array.isArray(w.tools)&&w.tools.length>0,'Full tools');for(const t of w.tools)for(const k of ['useflag','changeAttackRange','at','iq','move','arm'])uint(t?.[k],65535,'Tool '+k);
  assert.ok(w.config&&typeof w.config==='object','Sampled config');for(const k of ['fixOverFlow16','checkRedundantOnAddPerson','disableFightToDeath'])assert.ok([0,1].includes(w.config[k]),'Sampled config '+k);
}
function native(n){
  assert.ok(n&&n.fight&&n.battle&&n.menu&&n.report,'Full native boundary');uint(n.detailGeneration,0xffffffff,'Detail generation');assert.ok(n.detailGeneration>0);
  const b=n.battle;assert.equal(b.mode,0,'Defense only');assert.ok([1,2].includes(b.over),'Actual natural result');assert.equal(n.fight.active,0);assert.equal(n.fight.over,b.over);uint(b.cityIndex,37,'Battle city');
  uint(b.playerFood,65535,'Remaining player grain');uint(b.enemyFood,65535,'Remaining enemy grain');assert.equal(b.mainGenIndex,10);array(b.genArray,20,200,'Complete battle tokens');
  assert.ok(Array.isArray(b.positions)&&b.positions.length===20,'Complete positions');for(const p of b.positions)for(const k of ['x','y','hp','mp','move','active','state'])uint(p?.[k],['hp','mp'].includes(k)?65535:255,'Position '+k);
  assert.equal(new Set(b.genArray.filter(Boolean)).size,b.genArray.filter(Boolean).length,'No duplicate occupied token');assert.ok(b.genArray[0]>0&&b.genArray[10]>0,'Both armies have a commander token');
}
function residents(w,city){const c=w.cities[city];return w.queue.slice(c.PersonQueue,c.PersonQueue+c.Persons);}
function cityFor(w,id){const matches=[];for(let i=0;i<38;i++)if(residents(w,i).includes(id))matches.push(i);assert.ok(matches.length<=1,'Observed resident destination unique');return matches[0];}
function del(w,city,id){
  const c=w.cities[city],j=w.queue.indexOf(id,c.PersonQueue);if(j<0||j>=c.PersonQueue+c.Persons)return false;
  for(let i=j;i<199;i++)w.queue[i]=w.queue[i+1];c.Persons--;for(let i=city+1;i<38;i++)w.cities[i].PersonQueue--;return true;
}
function add(w,city,id){
  if(w.config.checkRedundantOnAddPerson)for(let i=0;i<38;i++)while(del(w,i,id)){}
  const c=w.cities[city];for(let i=199;i>c.PersonQueue;i--)w.queue[i]=w.queue[i-1];w.queue[c.PersonQueue]=id;c.Persons++;
  for(let i=city+1;i<38;i++)w.cities[i].PersonQueue++;
}
function incoming(w,b){
  const found=[];for(const [i,o]of w.orders.entries())if(o.OrderId===27&&o.Object===b.cityIndex&&Number.isInteger(o.Person)&&o.Person>=0&&o.Person<30){
    const t=Array.from({length:10},(_,j)=>w.fighters[o.Person*20+j*2]+256*w.fighters[o.Person*20+j*2+1]);
    if(t.every((v,j)=>v===b.genArray[j+10]))found.push({orderIndex:i,armySlot:o.Person});
  }
  assert.equal(found.length,1,'Unique current incoming Order27/target/full LE-U16 fighter match');assert.equal(w.fighterIndex[found[0].armySlot],0,'Incoming slot already released');return found[0];
}
function sameBattle(n,b,g){return n&&n.detailGeneration===g&&n.battle&&JSON.stringify(n.battle)===JSON.stringify(b);}
function candidates(w,king){const ids=[];for(let i=0;i<38;i++)if(w.cities[i].Belong===king+1)for(const id of residents(w,i))if(w.people[id].Belong===king+1)ids.push(id);return ids;}
function build(before,after,reference,successions,reports){
  const w=structuredClone(before.world),b=before.native.battle,city=b.cityIndex,win=b.over===1?b.genArray.slice(0,10):b.genArray.slice(10),lose=b.over===1?b.genArray.slice(10):b.genArray.slice(0,10),branches=[];let capturedKing=null;
  // Native returns every nonzero token, including a slot marked STATE_SW.
  for(const token of win)if(token)add(w,city,token-1);
  if(b.over===2){
    const c=w.cities[city],oldResidents=residents(w,city).filter(id=>w.people[id].Belong===c.Belong);
    c.Belong=w.people[b.genArray[10]-1].Belong;c.SatrapId=b.genArray[10];
    for(const id of oldResidents){const p=w.people[id];if(p.Belong===id+1){capturedKing=id;p.Belong=65535;}else p.Belong=0;p.Arms=0;}
  }
  for(const token of lose)if(token){
    const id=token-1,p=w.people[id],old=p.Belong,observed=reference.people[id];assert.ok(old>=1&&old<=200,'Loser has a real pre-settlement faction');
    if(observed.Belong===65535){
      const ownCities=w.cities.filter(c=>c.Belong===old);
      assert.ok(p.IQ<99||(!ownCities.length&&(w.config.disableFightToDeath===1||p.IQ>=1)),'A captive outcome must be possible under native rnd0..99/IQ/escape rules');
      if(old===token)capturedKing=id;p.OldBelong=old;p.Belong=65535;p.Arms=0;add(w,city,id);branches.push({personId:id,outcome:'captive',cityIndex:city});
    }else{
      const target=cityFor(reference,id);assert.ok(target!==undefined&&w.cities[target].Belong===old,'Observed escape must reach an actually retained old-faction city; death is unsupported');
      add(w,target,id);branches.push({personId:id,outcome:'escape',cityIndex:target});
    }
  }
  const c=w.cities[city];for(const k of ['Farming','Commerce','Money'])c[k]-=Math.floor(c[k]/20);c.PeopleDevotion-=Math.floor(c.PeopleDevotion/10);
  let succession=null;
  if(capturedKing!==null){
    const ids=candidates(w,capturedKing);assert.ok(ids.length>0,'King extinction without a successor is unsupported');
    const evs=successions.filter(e=>e.receipt.oldKing===capturedKing);assert.equal(evs.length,1,'One current matching native successor commitment required');const ev=evs[0],r=ev.receipt,newKing=uint(r.newKing,199,'New king');
    assert.ok(ids.includes(newKing),'New king is a genuine ordered GetKingPersons candidate');
    if(capturedKing===w.king)w.king=newKing;else{let highest=ids[0];for(const id of ids.slice(1))if(w.people[highest].IQ<w.people[id].IQ)highest=id;assert.equal(newKing,highest,'NPC selects first maximum-IQ candidate');}
    assert.equal(r.playerKing,w.king);assert.equal(r.generation,before.native.detailGeneration);
    assert.ok(reports.some(e=>{if(e.native?.report?.active!==1||e.native.report.kind!==1||!(e.native.report.seq>0&&e.native.report.inputSeq>0)||!sameBattle(e.native,b,before.native.detailGeneration))return false;try{exact(e.world,w,'NewKingNote report world');return true;}catch{return false;}}),'Exact current NewKingNote report-stage world required');
    w.people[newKing].Devotion=100;for(const cc of w.cities)if(cc.Belong===capturedKing+1)cc.Belong=newKing+1;for(const id of ids)w.people[id].Belong=newKing+1;
    exact(ev.world,w,'Exact synchronous successor-committed world');succession={oldKing:capturedKing,newKing,candidateIds:ids,playerChoice:capturedKing===before.world.king};
  }else assert.equal(successions.length,0,'No unrelated successor event in this settlement');
  c.Food=w.config.fixOverFlow16?Math.min(65535,b.playerFood+b.enemyFood):(b.playerFood+b.enemyFood)&65535;
  exact(after.world,w,'Complete defense settlement world');return {winnerIds:win.filter(Boolean).map(t=>t-1),loserBranches:branches,succession};
}
/** events: actual callback samples {successions:[{receipt,world,native}],reports:[{world,native}]}.
 * A successor needs both its NewKingNote and synchronous commitment worlds. The
 * caller authenticates sources/opaque data/current trusted keys separately. */
export function verifyMobileDefenderSettlement({before,after,receipt,events={}}={}){
  shape(before?.world);shape(after?.world);native(before?.native);native(after?.native);const b=before.native.battle,g=before.native.detailGeneration;
  assert.equal(before.world.cities[b.cityIndex].Belong,before.world.king+1,'Pre-result defense city belongs to player');
  assert.equal(before.native.report.active,0,'GamFight return has no active blocking report');assert.equal(after.native.report.active,0,'Settled receipt follows blocking reports');assert.equal(after.native.menu.active,0,'Settled receipt has no picker owner');
  for(const token of b.genArray.slice(0,10).filter(Boolean))assert.equal(before.world.people[token-1].Belong,before.world.king+1,'Actual player defenders');
  const enemyBelong=before.world.people[b.genArray[10]-1].Belong;assert.ok(enemyBelong>=1&&enemyBelong<=200&&enemyBelong!==before.world.king+1,'Opposing incoming commander');for(const token of b.genArray.slice(10).filter(Boolean))assert.equal(before.world.people[token-1].Belong,enemyBelong,'One actual enemy faction');
  exact(after.native.battle,b,'Settlement does not alter battle state');assert.equal(after.native.detailGeneration,g);
  assert.ok(receipt&&receipt.generation===g&&receipt.detailGeneration===g&&receipt.city===b.cityIndex&&receipt.mode===0&&receipt.over===b.over&&receipt.playerKing===after.world.king,'Exact synchronous battle-settled receipt');
  const order=incoming(before.world,b);const ss=events.successions||[],rs=events.reports||[];assert.ok(Array.isArray(ss)&&Array.isArray(rs),'Actual event arrays');
  const successions=ss.filter(e=>e?.receipt?.generation===g&&sameBattle(e.native,b,g));for(const e of successions)shape(e.world);assert.ok(successions.length<=1,'One KingOverDeal at most for this exact battle');
  const reports=rs.filter(e=>sameBattle(e?.native,b,g));for(const e of reports)shape(e.world);
  const refs=successions.length?reports.filter(e=>e.native.report?.active===1&&e.native.report.kind===1).map(e=>e.world):[after.world];assert.ok(refs.length>0,'Successor report trace required');
  const matches=[];let lastError;for(const ref of refs)try{matches.push(build(before,after,ref,successions,reports));}catch(e){lastError=e;}
  if(!matches.length)throw lastError||new Error('Unsupported defense settlement branch');
  const unique=new Map(matches.map(x=>[JSON.stringify(x),x]));assert.equal(unique.size,1,'Observed settlement branch must be unambiguous');const details=[...unique.values()][0];
  exact(after.world.orders,before.world.orders,'All orders still unchanged before PolicyExec DelOrder');exact(after.world.fighters,before.world.fighters,'Raw fighter slots retained');exact(after.world.fighterIndex,before.world.fighterIndex,'Allocation flags unchanged');
  return {accepted:true,stage:'synchronous-defense-settlement',cityIndex:b.cityIndex,over:b.over,...order,...details,food:{player:b.playerFood,enemy:b.enemyFood,merged:after.world.cities[b.cityIndex].Food},completeMeasuredWorldAccepted:true,
    randomOutcomeObserved:true,rngAccepted:false,trustedInputAccepted:false,terminalMapAccepted:false,orderRetirementAccepted:false,fullHdAccepted:false,
    limits:mobileDefenderSettlementContract.unsupported.slice()};
}
