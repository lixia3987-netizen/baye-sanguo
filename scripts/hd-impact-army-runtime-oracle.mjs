// Pure original-LIB raw-world army oracle. No input, filesystem, native calls or state writes.
// Raw resident PIDs may legally repeat across distinct city queue ranges.
// Queue slots and the selected actor, rather than global PID uniqueness, own the operation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const impactArmyOracleContract=Object.freeze({
  originalLib:Object.freeze({bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}),
  counts:Object.freeze({people:200,cities:38,queue:2000,goodsQueue:2000,orders:200,fighters:600,fighterIndex:30}),
  orderId:24,
  initializedOrderFields:Object.freeze(['OrderId','Person','City','TimeCount']),
  opaqueOrderFields:Object.freeze(['Object','Arms','Food','Money','Consume']),
  queuePolicy:'Native city ranges occupy disjoint slots in first200. Cross-city raw duplicate PIDs are retained; the selected actor must occur exactly once in its selected city.',
  recruitmentScope:'One positive original ConscriptionMake delta before a later command or strategy month; current original-LIB costs, ADD16 and raw DelPerson, sampled world fields only',
  distributionScope:'One original DistributeMake target-total delta; exact U16 reserve assignment, sampled world fields only',
  nativeSources:Object.freeze([
    'vendor/iBaye/src/citycmdc.c:ConscriptionMake/DistributeMake',
    'vendor/iBaye/src/citycmde.c:IsMoney/IsManual/OrderConsumeThew',
    'vendor/iBaye/src/citycmdd.c:canAddOrder/AddOrderHead',
    'vendor/iBaye/src/cityedit.c:DelPerson/GetCityPersons/GetArmy',
    'vendor/iBaye/src/PublicFun.c:PlcArmsMax/PlcArmsMaxP',
    'vendor/iBaye/src/gamEng.c:add_16',
    'vendor/iBaye/src/baye/attribute.h:PersonType/CityType/ADD16',
    'vendor/iBaye/src/baye/order.h:CONSCRIPTION/OrderType'
  ])
});
const PERSON_FIELDS=['Belong','OldBelong','Level','Experience','IQ','Force','Age','Devotion','Character','Thew','Arms','ArmsType','Tool1','Tool2'];
const PERSON_U16=new Set(['Belong','OldBelong','Arms','Tool1','Tool2']);
const CITY_FIELDS=['State','Belong','SatrapId','FarmingLimit','Farming','CommerceLimit','Commerce','PeopleDevotion','AvoidCalamity','PopulationLimit','Population','Money','Food','MothballArms','PersonQueue','Persons','ToolQueue','Tools'];
const CITY_U8=new Set(['State','AvoidCalamity','PeopleDevotion']);
const CITY_U32=new Set(['PopulationLimit','Population']);
const ORDER_FIELDS=['OrderId','Person','City','Object','Arms','Food','Money','Consume','TimeCount'];
const ORDER_U8=new Set(['OrderId','City','Consume','TimeCount']);
function integer(value,min,max,label){assert.ok(Number.isInteger(value)&&value>=min&&value<=max,label+' must be an integer in '+min+'..'+max);return value;}
function object(value,label){assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' actual object');}
function numericArray(value,length,max,label){assert.ok(Array.isArray(value)&&value.length===length,label+' exact length '+length);for(let i=0;i<length;i++)integer(value[i],0,max,label+'['+i+']');}
// Keep failures bounded and preserve every sampled extra/unknown field.
function exact(actual,expected,label,at='$'){
 if(Object.is(actual,expected))return;
 assert.ok(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object',label+' differs at '+at);
 assert.equal(Array.isArray(actual),Array.isArray(expected),label+' kind differs at '+at);
 const a=Object.keys(actual).sort(),e=Object.keys(expected).sort();assert.deepEqual(a,e,label+' fields differ at '+at);
 for(const k of e)exact(actual[k],expected[k],label,at+'.'+k);
}
function shapeWorld(w,label){
 object(w,label);integer(w.period,1,4,label+'.period');integer(w.king,0,199,label+'.king');integer(w.year,0,65535,label+'.year');integer(w.month,1,12,label+'.month');
 assert.ok(Array.isArray(w.people)&&w.people.length===200,label+' all200 people');for(let i=0;i<200;i++){object(w.people[i],label+'.people['+i+']');for(const k of PERSON_FIELDS)integer(w.people[i][k],0,PERSON_U16.has(k)?65535:255,label+'.people['+i+'].'+k);}
 numericArray(w.queue,2000,65535,label+'.queue');numericArray(w.goodsQueue,2000,65535,label+'.goodsQueue');assert.ok(Array.isArray(w.cities)&&w.cities.length===38,label+' all38 cities');
 const slots=new Set(),occurrences=new Map();
 for(let i=0;i<38;i++){const c=w.cities[i];object(c,label+'.cities['+i+']');for(const k of CITY_FIELDS)integer(c[k],0,CITY_U8.has(k)?255:CITY_U32.has(k)?4294967295:65535,label+'.cities['+i+'].'+k);assert.ok(c.PersonQueue+c.Persons<=200,label+' city queue lies within native first200');
  for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++){assert.ok(!slots.has(j),label+' overlapping city queue slots');slots.add(j);const id=integer(w.queue[j],0,199,label+' current raw resident PID'),rows=occurrences.get(id)||[];rows.push({cityIndex:i,queueIndex:j});occurrences.set(id,rows);}
 }
 assert.ok(Array.isArray(w.orders)&&w.orders.length===200,label+' all200 orders');for(let i=0;i<200;i++){object(w.orders[i],label+'.orders['+i+']');for(const k of ORDER_FIELDS)integer(w.orders[i][k],0,ORDER_U8.has(k)?255:65535,label+'.orders['+i+'].'+k);}
 numericArray(w.fighters,600,255,label+'.fighters');numericArray(w.fighterIndex,30,1,label+'.fighterIndex');object(w.config,label+'.config');
 return{rawDuplicateResidents:[...occurrences].filter(([,rows])=>rows.length>1).map(([personId,rows])=>({personId,occurrences:rows}))};
}
function originalLibrary(input){
 assert.ok(Buffer.isBuffer(input)||(ArrayBuffer.isView(input)&&Object.prototype.toString.call(input)==='[object Uint8Array]'),'Actual original LIB bytes required');const b=Buffer.from(input.buffer,input.byteOffset,input.byteLength),ref=impactArmyOracleContract.originalLib;assert.equal(b.length,ref.bytes,'Original LIB byte length');assert.equal(createHash('sha256').update(b).digest('hex'),ref.sha256,'Original LIB SHA256');return b;
}
function item(b,id,index){
 const table=(id-1)*4;assert.ok(table>=0&&table+4<=b.length,'Resource table bounds');const base=b.readUInt32LE(table);assert.ok(base>0&&base+14<=b.length,'Resource header bounds');const length=b.readUInt32LE(base),count=b.readUInt16LE(base+6),fixed=b.readUInt32LE(base+8);assert.equal(b.readUInt16LE(base+4),id,'Exact resource ID');assert.ok(index>=0&&index<count&&base+length<=b.length,'Resource item bounds');assert.equal(b[base+12],0,'Uncompressed original payload');const offset=fixed?14+index*fixed:count===1?14:b.readUInt32LE(base+14+index*8),size=fixed||(count===1?length-14:b.readUInt32LE(base+18+index*8));assert.ok(offset>=14&&size>0&&offset+size<=length,'Resource payload bounds');return b.subarray(base+offset,base+offset+size);
}
function selectedResident(w,cityIndex,personId){
 integer(cityIndex,0,37,'cityIndex');integer(personId,0,199,'personId');const c=w.cities[cityIndex],p=w.people[personId];assert.equal(c.Belong,w.king+1,'Current actual player-owned city');assert.equal(p.Belong,c.Belong,'Current selected resident allied with city');const indices=[];for(let j=c.PersonQueue;j<c.PersonQueue+c.Persons;j++)if(w.queue[j]===personId)indices.push(j);assert.equal(indices.length,1,'Selected actor occurs exactly once in its current city raw queue');return{c,p,queueIndex:indices[0]};
}
function evidenceLimits(scope){return{scope,inputAccepted:false,actualInputAccepted:false,actualPreparationAccepted:false,actualCastAccepted:false,hdAccepted:false,wholeNativeAbiAccepted:false,strategyMonthAccepted:false,limits:['Only complete sampled raw world fields; no native-memory or RNG restoration claim','Trusted owner/quantity/public input, fresh publication and genuine SAVE are independent caller evidence','Cross-city duplicate raw PIDs remain exactly observed; no deduplication or world repair']};}
/** Pure forecast. No native input or actual recruitment acceptance. */
export function planRecruitment({world,libBytes,cityIndex,personId,quantity}={}){
 const raw=shapeWorld(world,'world'),lib=originalLibrary(libBytes),{c,p,queueIndex}=selectedResident(world,cityIndex,personId),config=world.config;integer(quantity,1,65534,'positive recruitment quantity');integer(config.armsPerMoney,1,255,'config.armsPerMoney');integer(config.armsPerDevotion,1,255,'config.armsPerDevotion');integer(config.fixOverFlow16,0,1,'config.fixOverFlow16');integer(config.enable16bitConsumeMoney,0,1,'config.enable16bitConsumeMoney');assert.equal(config.enable16bitConsumeMoney,0,'Original28-byte U8 money-cost mode');const thew=item(lib,2,9),money=item(lib,2,10);assert.equal(thew.length,28);assert.equal(money.length,28);const orderId=24,thewCost=thew[orderId],minimumMoney=money[orderId];assert.equal(thewCost,12,'Original ROM recruitment Thew');assert.equal(minimumMoney,1,'Original ROM IsMoney gate');assert.ok(p.Thew>=thewCost,'Native IsManual guard');assert.ok(c.Money>=minimumMoney,'Native IsMoney guard');
 const maximum=Math.min((c.PeopleDevotion*config.armsPerDevotion)&65535,Math.min(c.Money*config.armsPerMoney,65534));assert.ok(quantity<=maximum,'Actual original GetArmy devotion/money maximum');const orderIndex=world.orders.findIndex(o=>o.OrderId===255);assert.ok(orderIndex>=0,'Native AddOrderHead first free slot');const moneyCost=Math.floor(quantity/config.armsPerMoney),stockAfter=Math.min(c.MothballArms+quantity,65535);
 return{accepted:true,planningAccepted:true,sourceOnlyPlanning:true,cityIndex,personId,queueIndex,orderIndex,orderId,quantity,wanted:quantity,min:0,max:maximum,maximum,initialValue:maximum,minimumMoney,moneyCost,thewCost,moneyBefore:c.Money,moneyAfter:c.Money-moneyCost,thewBefore:p.Thew,thewAfter:p.Thew-thewCost,stockBefore:c.MothballArms,stockAfter,appliedRecruitment:stockAfter-c.MothballArms,stockSaturated:c.MothballArms+quantity>65535,initializedOrder:{OrderId:24,Person:personId,City:cityIndex,TimeCount:0},opaqueOrderFields:[...impactArmyOracleContract.opaqueOrderFields],...raw,...evidenceLimits(impactArmyOracleContract.recruitmentScope)};
}
/** Verify the delta only. The five new uninitialized stack fields are sampled U8/U16 values, not cargo. */
export function verifyRecruitment({before,after,libBytes,cityIndex,personId,quantity}={}){
 const plan=planRecruitment({world:before,libBytes,cityIndex,personId,quantity});shapeWorld(after,'after');const expected=structuredClone(before),newOrder=after.orders[plan.orderIndex];exact(Object.keys(newOrder).sort(),Object.keys(before.orders[plan.orderIndex]).sort(),'New order field set');Object.assign(expected.orders[plan.orderIndex],plan.initializedOrder);for(const k of impactArmyOracleContract.opaqueOrderFields)expected.orders[plan.orderIndex][k]=newOrder[k];expected.cities[cityIndex].Money=plan.moneyAfter;expected.cities[cityIndex].MothballArms=plan.stockAfter;expected.people[personId].Thew=plan.thewAfter;
 // DelPerson shifts only slots queueIndex..198 from the following raw slot.
 // Slot199 is unchanged; all1800 entries200..1999 and all other arrays remain exact.
 for(let j=plan.queueIndex;j<199;j++)expected.queue[j]=before.queue[j+1];expected.cities[cityIndex].Persons--;for(let i=cityIndex+1;i<38;i++)expected.cities[i].PersonQueue=(before.cities[i].PersonQueue-1)&65535;exact(after,expected,'Only original raw ConscriptionMake delta');
 return{ok:true,accepted:true,recruitmentAccepted:true,wholeMeasuredWorldExact:true,cityIndex,personId,quantity,maximum:plan.maximum,orderIndex:plan.orderIndex,queueIndex:plan.queueIndex,order:plan.initializedOrder,money:{before:plan.moneyBefore,after:plan.moneyAfter,cost:plan.moneyCost,minimum:plan.minimumMoney,armsPerMoney:before.config.armsPerMoney},thew:{before:plan.thewBefore,after:plan.thewAfter,cost:plan.thewCost},stock:{before:plan.stockBefore,after:plan.stockAfter,applied:plan.appliedRecruitment,saturated:plan.stockSaturated},rawDuplicateResidents:plan.rawDuplicateResidents,uninitializedOrderMask:{orderIndex:plan.orderIndex,fields:[...impactArmyOracleContract.opaqueOrderFields],actual:Object.fromEntries(impactArmyOracleContract.opaqueOrderFields.map(k=>[k,newOrder[k]])),semanticAcceptance:false},checked:{...impactArmyOracleContract.counts},...evidenceLimits(impactArmyOracleContract.recruitmentScope)};
}
function capacity(p,c){integer(c.enableCustomRatio,0,1,'config.enableCustomRatio');integer(c.ratioOfArmsToLevel,0,65535,'config.ratioOfArmsToLevel');for(const k of['ratioOfArmsToAge','ratioOfArmsToIQ','ratioOfArmsToForce'])integer(c[k],0,255,'config.'+k);if(c.enableCustomRatio){const sum=(p.Level*c.ratioOfArmsToLevel+p.Age*c.ratioOfArmsToAge+p.Force*c.ratioOfArmsToForce+p.IQ*c.ratioOfArmsToIQ)>>>0;return Math.min(sum,65534);}return(p.Level*100+p.Force*10+p.IQ*10)&65535;}
/** targetArms is the final total, never the increment. */
export function planDistribution({world,libBytes,cityIndex,personId,targetArms}={}){
 const raw=shapeWorld(world,'world');originalLibrary(libBytes);const {c,p,queueIndex}=selectedResident(world,cityIndex,personId);integer(targetArms,0,65534,'actual target total arms');const maxCapacity=capacity(p,world.config),available=c.MothballArms+p.Arms,maximum=Math.min(maxCapacity,available);assert.ok(maximum>0,'Native maximum0 shows a message instead of GetArmy');assert.ok(targetArms<=maximum,'Target total within original capacity and available troops');const uncastReserve=available-targetArms;
 return{accepted:true,planningAccepted:true,sourceOnlyPlanning:true,cityIndex,personId,queueIndex,targetArms,quantity:targetArms,wanted:targetArms,quantityMeaning:'target-total-arms',capacity:maxCapacity,available,maximum,max:maximum,min:0,initialValue:maximum,armsBefore:p.Arms,armsAfter:targetArms,delta:targetArms-p.Arms,reserveBefore:c.MothballArms,reserveAfter:uncastReserve&65535,uncastReserve,reserveWrapped:uncastReserve>65535,...raw,...evidenceLimits(impactArmyOracleContract.distributionScope)};
}
export function verifyDistribution({before,after,libBytes,cityIndex,personId,targetArms}={}){
 const plan=planDistribution({world:before,libBytes,cityIndex,personId,targetArms});shapeWorld(after,'after');const expected=structuredClone(before);expected.people[personId].Arms=targetArms;expected.cities[cityIndex].MothballArms=plan.reserveAfter;exact(after,expected,'Only original selected Arms and city MothballArms');return{ok:true,accepted:true,distributionAccepted:true,wholeMeasuredWorldExact:true,cityIndex,personId,targetArms,quantityMeaning:'target-total-arms',quantity:targetArms,capacity:plan.capacity,available:plan.available,maximum:plan.maximum,arms:{before:plan.armsBefore,after:targetArms,delta:plan.delta},reserve:{before:plan.reserveBefore,after:plan.reserveAfter,uncast:plan.uncastReserve,wrapped:plan.reserveWrapped},changed:plan.delta!==0,rawDuplicateResidents:plan.rawDuplicateResidents,checked:{...impactArmyOracleContract.counts},...evidenceLimits(impactArmyOracleContract.distributionScope)};
}
