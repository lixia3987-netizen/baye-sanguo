// Controlled fixture only. A hypothetical month/order result is not actual C execution.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCity4DispatchedInput} from '../hd-wood-city4-end-input.mjs';
import {V32_POLICY_OBSERVER_FUNCTION_SOURCE} from '../hd-impact-v32-conditional-plunder-prefix.mjs';

export const fixtureRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex'),next=n=>((n+1)>>>0)||1;
let historical,base;
export function originalLibrary(){return fs.readFileSync(path.join(fixtureRoot,'libs/dat-mod.lib'));}
function input(){return historical??=readCity4DispatchedInput(fixtureRoot);}
function writePacked(world,pos,pair){
 const a=Buffer.from(pair.sav0,'hex'),b=Buffer.from(pair.sav1,'hex');a[1]=world.period;a.writeUInt16LE(world.king,4);a.writeUInt16LE(world.year,6);a[9]=world.lookMovie;a[11]=world.month;
 for(const[k,i]of Object.entries({x:12,y:13,setx:14,sety:15}))a[i]=pos[k];
 const layout=s=>Object.fromEntries(s.split(' ').map(x=>{const[k,off,width]=x.split(':');return[k,[Number(off),Number(width)]];}));
 const P=layout('OldBelong:0:2 Belong:2:2 Level:4:1 Force:5:1 IQ:6:1 Devotion:7:1 Character:8:1 Experience:9:1 Thew:10:1 ArmsType:11:1 Arms:12:2 Tool1:14:2 Tool2:16:2 Age:18:1');
 const C=layout('State:0:1 Belong:1:2 SatrapId:3:2 FarmingLimit:5:2 Farming:7:2 CommerceLimit:9:2 Commerce:11:2 PeopleDevotion:13:1 AvoidCalamity:14:1 PopulationLimit:15:4 Population:19:4 Money:23:2 Food:25:2 MothballArms:27:2 PersonQueue:29:2 Persons:31:2 ToolQueue:33:2 Tools:35:2');
 const O=layout('OrderId:0:1 Person:1:2 City:3:1 Object:4:2 Arms:6:2 Food:8:2 Money:10:2 Consume:12:1 TimeCount:13:1');
 const rows=(buf,at,size,xs,fields)=>xs.forEach((x,i)=>{for(const[k,[off,width]]of Object.entries(fields))buf.writeUIntLE(x[k],at+i*size+off,width);});
 rows(a,16,19,world.people,P);world.queue.slice(0,200).forEach((n,i)=>a.writeUInt16LE(n,3816+i*2));world.goodsQueue.forEach((n,i)=>a.writeUInt16LE(n,4216+i*2));world.fighterIndex.forEach((n,i)=>b[i]=n);world.fighters.forEach((n,i)=>b[30+i]=n);rows(b,630,14,world.orders,O);rows(b,3430,37,world.cities,C);
 return{sav0:a.toString('hex'),sav1:b.toString('hex')};
}
function build(){
 const i=input(),observerExpected={functionSource:V32_POLICY_OBSERVER_FUNCTION_SOURCE},before=copy(i.publicSavePacket.publicSave.before),epochAnchor=copy(before);
 for(const t of[before,epochAnchor])t.meta.v32HookFence.observer={name:'willExecuteOrder',present:true,sameFunction:true,originalUndefined:true,functionSource:V32_POLICY_OBSERVER_FUNCTION_SOURCE};
 // Synthetic terminal precondition; no assertion that a real battle/month produced it.
 before.world.month=11;for(const order of before.world.orders)order.OrderId=255;before.state.keys+=100;
 const beforeChoice=copy(before),beforeRecord=copy(before),after=copy(before),generation=before.state.snapshot.spe.generation;
 beforeChoice.state.keys++;beforeChoice.state.overworld=before.meta.overworldMode==='classic'?'map':'other';beforeChoice.state.march.pick=0;
 beforeChoice.state.menu={...before.state.menu,active:1,context:2,kind:1,index:0,count:3,seq:next(before.state.menu.seq),generation,detailGeneration:generation,idsValid:false,ids:[],itemLen:8,names:['策略结束','存储进度','结束游戏'],packedNames:['策略结束','存储进度','结束游戏']};
 beforeRecord.state.keys+=3;beforeRecord.state.overworld=beforeChoice.state.overworld;beforeRecord.state.march.pick=0;beforeRecord.state.menu={...beforeChoice.state.menu,active:0,context:0,kind:0,index:1,seq:next(beforeChoice.state.menu.seq)};beforeRecord.state.record={...before.state.record,active:1,mode:1,index:0,count:3,seq:next(before.state.record.seq)};
 after.state.keys+=4;after.state.snapshot.report={...before.state.snapshot.report,text:'存储中...',seq:((before.state.snapshot.report.seq+1)&65535)||1,kind:1,person:65535,active:0};after.state.march.mapInputSeq=next(before.state.march.mapInputSeq);after.state.menu=copy(beforeRecord.state.menu);after.state.record={...beforeRecord.state.record,active:0,mode:0,count:0,seq:next(beforeRecord.state.record.seq)};
 const publicKeys=[40,35,39,39].map(code=>({code,generation,speActive:0,resultActive:false,fight:copy(before.state.snapshot.fight)})),publicPair=writePacked(after.world,after.meta.cityPos,i.pair),expectedSaveTag='wood67-131-v59-controlled-terminal';
 const files=[0,1].map(n=>{const bytes=Buffer.from(publicPair['sav'+n],'hex');return{path:'native-'+expectedSaveTag+'-sango'+n+'.sav',bytes};});
 const publicSave={tag:expectedSaveTag,slot:0,before,beforeChoice,beforeRecord,after,keys:[publicKeys[3]],system:copy(beforeChoice.state.menu),record:copy(beforeRecord.state.record),files:files.map(f=>({path:f.path,bytes:f.bytes.length,sha256:sha(f.bytes),lib:'libs/dat-mod.lib',identity:'v1:414390:1d36da77:1e9c0477'}))};
 return{publicSave,publicPair,publicKeys,world:copy(after.world),expectedSaveTag,libBytes:Buffer.from(i.libBytes),nativeBudget:copy(i.nativeBudget),observerExpected,epochAnchor,currentFirst:copy(after),currentSecond:copy(after),currentPair:copy(publicPair),files};
}
export function terminalFixture(){base??=build();return copy(base);}
export function minimalOwner(){return{world:{},meta:{},state:{overworld:'map',menu:{active:0},qty:{active:0},record:{active:0},march:{pick:1,battlePick:0},snapshot:{fight:{active:0,over:0,wait:0,inputKind:0},spe:{active:0},result:{active:false},top:{active:false},report:{active:0}}}};}
