// Pure dispatched-P57 input/admission candidate. No game, SAVE, END, RNG or native writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual,types as utilTypes} from 'node:util';
import {decodeV45Archive,v45ReadBounded} from '../docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs';
import {verifyOriginalSavePair} from './hd-mobile-system-runtime-oracle.mjs';
import {verifyCity4PreparationLedger,verifyCity4MarchDispatch,verifyCity4Resume,verifyCity4ConditionalEndAdmission} from './hd-wood-city4-continuation.mjs';

const P='docs/validation/m5-wood-city4-recovery-20261024-v57',D='build/impact-skill-20261014/v57-recovery-city4-march-actual-v1/';
// Compare every typed field without constructing a diff of the full saved history.
const eq=(a,b,label='Complete typed value equality')=>assert.ok(isDeepStrictEqual(a,b),label),copy=structuredClone,sha=b=>createHash('sha256').update(b).digest('hex');
const pin=(path,bytes,sha256)=>Object.freeze({path,bytes,sha256}),pins=x=>Object.freeze(x);
export const OCTOBER_INPUT_PINS=pins([
 pin(P+'.json',379062,'70949f4f2edb9b4564e37b151add6e551d7cb3f010d6a8ccb70a387847c59f1a'),
 pin(P+'-latest-world.json',148004,'58f8ac8d6366c09023a834995bde26bd0973e32a1b12292d463f1644b983c1f6'),
 pin(P+'-sango0.sav',8221,'122a72b600bbee49d734f0420731b7be7895af0eaf222741f6daee6eaae09d2b'),
 pin(P+'-sango1.sav',4840,'f3b6f39a2433f88abaef52e921c65e7d607d6752620762927f2b542f74f27353')
]);
export const CITY4_HISTORY_INPUT_PINS=pins([
 pin(P+'-archive-index.json',151295,'6f072b12b1e4ac75c8b818497536e3bffd69f23cb6e7cf4bc9371aab500c857a'),
 pin(P+'-archive-part001.json',8142224,'8357cab4cb1ee68aa3d8c06f8df3b4ed6811ded199e49185324e53593eafe94b'),
 pin(P+'-archive-part002.json',8377587,'d348517c680ec688f5f1cbe5d5507087b21fdfc0bb6a17064cdf2ec25e61efb8'),
 pin(P+'-archive-part003.json',2359629,'5ef83127046a14c813b301096bc354a83835cf94e9db0908192f077da612448b')
]);
export const CITY4_END_ARCHIVED_PINS=Object.freeze({
 ledger:pin(D+'city4-march-ledger-candidate.json',16353699,'c235b9d99b6695afa280b2945d726406366239347c760cb3b3d2f635aae62020'),
 final:pin(D+'final-protected-owner.json',250327,'0b95fa40eab80202d13ec63325f5955b84725647ad234e20af8803e9ae87073b'),
 publicSave:pin(D+'wood67-131-v49-unused-dispatch-public-save.json',1197861,'dc95dd3f37f921792ac81bb7256219706c4a08a34f0c58a33628604ac6dd1435')
});
export const CITY4_END_LIBRARY_PIN=pin('libs/dat-mod.lib',207195,'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e');
export const CITY4_END_SAVE_TAGS=Object.freeze({resume:'wood67-131-v58-city4-end-resume',failed:'wood67-131-v58-city4-end-failed',settled:'wood67-131-v58-city4-end-settled'});
export const CITY4_END_SCOPE=Object.freeze({maximumNewDistributions:0,maximumNewPlunders:0,maximumNewMarches:0,maximumNewBattleOrders:0,maximumNewBuy:0,maximumNewEnd:1,maximumNewNaturalMonths:1,maximumNewPublicSaves:2,allowsAnyCombatInput:false});
const noCredit=()=>({sourceOnly:true,publicInputAccepted:false,actualPreparationAccepted:false,actualPublicSaveAccepted:false,actualMonthAccepted:false,actualSupplyIncomeAccepted:false,actualNativeReturnAccepted:false,actualBattleAccepted:false,actualCastAccepted:false,hdAccepted:false,globalHdComplete:false,rngContinuityAccepted:false,ordinaryEndAccepted:false});
// Intrinsic raw-view access never reads caller-defined .buffer/.offset/.length getters.
const taPrototype=Object.getPrototypeOf(Uint8Array.prototype),taGet=name=>Object.getOwnPropertyDescriptor(taPrototype,name).get;
const taBuffer=taGet('buffer'),taOffset=taGet('byteOffset'),taLength=taGet('length'),taByteLength=taGet('byteLength'),taBrand=Object.getOwnPropertyDescriptor(taPrototype,Symbol.toStringTag).get;
const arrayBufferLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const ORIGIN_ROLES=Object.freeze(['publication','world','sav0','sav1','ledger','final','publicSave','library']);
const ORIGIN_PINS=Object.freeze({publication:OCTOBER_INPUT_PINS[0],world:OCTOBER_INPUT_PINS[1],sav0:OCTOBER_INPUT_PINS[2],sav1:OCTOBER_INPUT_PINS[3],ledger:CITY4_END_ARCHIVED_PINS.ledger,final:CITY4_END_ARCHIVED_PINS.final,publicSave:CITY4_END_ARCHIVED_PINS.publicSave,library:CITY4_END_LIBRARY_PIN});
export const CITY4_END_ORIGIN_BOUNDS=Object.freeze({maximumJsonNodes:3000000,maximumJsonDepth:80,maximumHistoricalDepth:8});
function exactViewBytes(p,value){
 assert.ok(value&&typeof value==='object'&&!utilTypes.isProxy(value),'Original byte view required: '+p.path);
 let length,byteLength,offset,buffer,brand;try{length=taLength.call(value);byteLength=taByteLength.call(value);brand=taBrand.call(value);}catch{assert.fail('Original Uint8Array/Buffer required: '+p.path);}
 assert.ok(brand==='Uint8Array'&&length===p.bytes&&byteLength===p.bytes,'Exact P57 bytes/SHA length: '+p.path);
 try{buffer=taBuffer.call(value);offset=taOffset.call(value);const backingLength=arrayBufferLength.call(buffer);assert.ok(Number.isSafeInteger(offset)&&offset>=0&&offset+p.bytes<=backingLength);}catch{assert.fail('Unshared bounded original backing bytes required: '+p.path);}
 const bytes=Buffer.from(new Uint8Array(buffer,offset,p.bytes));assert.ok(bytes.length===p.bytes&&sha(bytes)===p.sha256,'Exact P57 bytes/SHA: '+p.path);return bytes;
}
// Only runtime LIB views reach later semantic Buffer.from; raw proof views use intrinsics only.
function runtimeLibrary(value){
 const bytes=exactViewBytes(CITY4_END_LIBRARY_PIN,value),prototype=Object.getPrototypeOf(value);
 assert.ok(prototype===Buffer.prototype||prototype===Uint8Array.prototype,'Runtime original LIB has only a standard byte-view prototype');
 const keys=Reflect.ownKeys(value);assert.equal(keys.length,CITY4_END_LIBRARY_PIN.bytes,'Runtime original LIB contains no named, symbol or hidden properties');
 for(let i=0;i<keys.length;i++)assert.ok(keys[i]===String(i),'Runtime original LIB contains only its native integer indices');return bytes;
}
function dataDescriptors(value,label,{array=false}={}){
 assert.ok(value&&typeof value==='object'&&!utilTypes.isProxy(value),label+': plain data object required');
 assert.ok(Object.getPrototypeOf(value)===(array?Array.prototype:Object.prototype),label+': custom prototype rejected');
 const keys=Reflect.ownKeys(value),descriptors=new Map();
 for(const key of keys){assert.equal(typeof key,'string',label+': symbol field rejected');const d=Object.getOwnPropertyDescriptor(value,key);assert.ok(d&&Object.hasOwn(d,'value'),label+': accessor rejected without invocation');assert.ok(d.enumerable===true||(array&&key==='length'),label+': hidden field rejected');descriptors.set(key,d);}
 return descriptors;
}
function ownData(value,key,label){const descriptors=dataDescriptors(value,label),d=descriptors.get(key);assert.ok(d,label+': missing own '+key);return d.value;}
function jsonData(value,label,budget){
 const active=new WeakSet(),stack=[{value,depth:0}];
 while(stack.length){const row=stack.pop(),v=row.value;if(row.exit){active.delete(v);continue;}assert.ok(++budget.nodes<=CITY4_END_ORIGIN_BOUNDS.maximumJsonNodes,label+': JSON node bound');assert.ok(row.depth<=CITY4_END_ORIGIN_BOUNDS.maximumJsonDepth,label+': JSON depth bound');
  if(v===null||typeof v==='string'||typeof v==='boolean')continue;if(typeof v==='number'){assert.ok(Number.isFinite(v),label+': finite number required');continue;}assert.ok(v&&typeof v==='object',label+': undefined/function/symbol/bigint rejected');assert.ok(!utilTypes.isProxy(v),label+': proxy rejected');
  const array=Array.isArray(v);if(array){const length=Object.getOwnPropertyDescriptor(v,'length');assert.ok(length&&Object.hasOwn(length,'value')&&Number.isInteger(length.value)&&length.value>=0&&length.value<=CITY4_END_ORIGIN_BOUNDS.maximumJsonNodes-budget.nodes,label+': bounded array length');}
  const descriptors=dataDescriptors(v,label,{array});assert.ok(!active.has(v),label+': cyclic JSON data rejected');active.add(v);stack.push({value:v,exit:true});
  if(array){const length=descriptors.get('length').value;assert.equal(descriptors.size,length+1,label+': array holes or extra fields rejected');for(let i=length-1;i>=0;i--){const d=descriptors.get(String(i));assert.ok(d,label+': array hole rejected');stack.push({value:d.value,depth:row.depth+1});}}
  else{assert.ok(descriptors.size<=CITY4_END_ORIGIN_BOUNDS.maximumJsonNodes-budget.nodes,label+': bounded object fields');for(const d of [...descriptors.values()].reverse())stack.push({value:d.value,depth:row.depth+1});}
 }
}
function stripOriginHistory(history,budget){
 const seen=new Set();let layers=0;
 function visit(a,depth){assert.ok(depth<=CITY4_END_ORIGIN_BOUNDS.maximumHistoricalDepth&&!seen.has(a),'Bounded acyclic original historical layers');seen.add(a);layers++;const descriptors=dataDescriptors(a,'Complete runtime historical layer'),lib=descriptors.get('libBytes');assert.ok(lib,'Every runtime historical layer has its own fixed original LIB');runtimeLibrary(lib.value);
  const entries=[];for(const [key,d]of descriptors){if(key==='libBytes')continue;let value=d.value;if(key==='resume'&&value!==null&&value!==undefined){const r=dataDescriptors(value,'Complete historical resume'),h=r.get('history');assert.ok(h,'Complete historical resume requires history');const fields=[];for(const [k,x]of r)fields.push([k,k==='history'?visit(h.value,depth+1):x.value]);value=Object.fromEntries(fields);}entries.push([key,value]);}return Object.fromEntries(entries);
 }
 const stripped=visit(history,0);jsonData(stripped,'Complete original historical JSON data',budget);return{stripped,layers};
}
/** Raw-origin authentication only. No decoder, file read, input, SAVE or actual credit. */
export function verifyCity4DispatchedOrigin(input){
 const origin=ownData(input,'originBytes','Dispatched input'),rawFields=dataDescriptors(origin,'originBytes');eq([...rawFields.keys()].sort(),[...ORIGIN_ROLES].sort(),'originBytes has exactly eight named original byte views');
 // Finish length/copy/hash of all eight originals before parsing or semantic comparisons.
 const raw=Object.fromEntries(ORIGIN_ROLES.map(role=>[role,exactViewBytes(ORIGIN_PINS[role],rawFields.get(role).value)]));
 const original={publication:JSON.parse(raw.publication),world:JSON.parse(raw.world),candidate:JSON.parse(raw.ledger),final:JSON.parse(raw.final),publicSave:JSON.parse(raw.publicSave)};eq(original.candidate.assessed,false,'Historical controller assessment remains false');
 const budget={nodes:0},history=ownData(input,'historyLedger','Dispatched input'),runtime=stripOriginHistory(history,budget);
 eq(runtime.stripped,original.candidate.ledger,'Entire historical ledger equals the original raw P57 candidate with only fixed runtime LIB removed');
 for(const [field,expected]of [['publication',original.publication],['world',original.world],['pair',original.candidate.ledger.march.publicPair],['finalOwner',original.final],['publicSavePacket',original.publicSave]]){const value=ownData(input,field,'Dispatched input');jsonData(value,'Complete original '+field,budget);eq(value,expected,'Complete '+field+' equals its original raw P57 source');}
 runtimeLibrary(ownData(input,'libBytes','Dispatched input'));
 const pair=original.candidate.ledger.march.publicPair;for(const [role,key]of [['sav0','sav0'],['sav1','sav1']]){assert.match(pair[key],/^(?:[0-9a-fA-F]{2})+$/);assert.ok(raw[role].equals(Buffer.from(pair[key],'hex')),'Raw published SAV bytes equal the exact original ledger pair');}
 eq(original.publicSave,{publicSave:original.candidate.ledger.march.publicSave,publicPair:pair,publicKeys:original.candidate.ledger.march.publicKeys},'Complete raw original public SAVE binds the raw candidate');eq(original.final.ticket.world,original.world,'Raw final whole world equals raw published current world');
 return{originAuthenticated:true,rawSourcePins:ORIGIN_ROLES.map(role=>({role,...ORIGIN_PINS[role]})),historicalLayers:runtime.layers,authenticatedNativeBudget:copy(original.candidate.ledger.nativeBudget),jsonNodesChecked:budget.nodes,...noCredit()};
}

function checked(p,b){return exactViewBytes(p,b);}
export function stripCity4EndRuntime(a,depth=0){assert.ok(a&&depth<=8,'Bounded complete historical ledger');const{libBytes,...b}=a;return{...b,...(b.resume?{resume:{...b.resume,history:stripCity4EndRuntime(b.resume.history,depth+1)}}:{})};}
export function withCity4EndRuntimeLibrary(a,libBytes,depth=0){assert.ok(a&&depth<=8,'Bounded complete historical ledger');return{...a,libBytes:Buffer.from(libBytes),...(a.resume?{resume:{...a.resume,history:withCity4EndRuntimeLibrary(a.resume.history,libBytes,depth+1)}}:{})};}
const neutralTag=t=>assert.ok(typeof t==='string'&&/^wood67-131-[a-z0-9-]+$/.test(t),'Explicit neutral SAVE tag');
export function collectCity4EndTags(history){
 const declared=new Set(),seen=new Set();
 function visit(a,depth){assert.ok(a&&typeof a==='object'&&depth<=8&&!seen.has(a),'Bounded acyclic complete history');seen.add(a);if(a.saveTags){for(const t of Object.values(a.saveTags)){neutralTag(t);declared.add(t);}}for(const s of[a.referenceSave,a.resume?.publicSave,...(a.repairs||[]).map(r=>r.publicSave),a.plunder?.publicSave,a.march?.publicSave])if(s){neutralTag(s.tag);declared.add(s.tag);}if(a.resume){neutralTag(a.resume.expectedSaveTag);declared.add(a.resume.expectedSaveTag);visit(a.resume.history,depth+1);}}
 visit(history,0);const proof=verifyCity4PreparationLedger(history);return{declared:[...declared].sort(),used:[...proof.usedSaveTags].sort()};
}
export function assertCity4EndSaveTags(tags,history){eq(Object.keys(tags).sort(),['failed','resume','settled']);const values=Object.values(tags);values.forEach(neutralTag);eq(new Set(values).size,3,'Distinct next-round SAVE roles');const all=collectCity4EndTags(history),blocked=new Set([...all.declared,...all.used]);for(const t of values)assert.ok(!blocked.has(t),'New END-round tag cannot reuse any recursively declared or used historical tag');return copy(tags);}
export function verifyCity4DispatchedHistory(input){
 const originProof=verifyCity4DispatchedOrigin(input);
 const {publication,world,pair,historyLedger,finalOwner,publicSavePacket,libBytes}=input;
 checked(CITY4_END_LIBRARY_PIN,libBytes);eq(publication.prefix,P);eq(publication.run.terminal,{closed:true,sessionId:60763,initialChunk:'346c11',terminalChunk:'778a7d',exitCode:1});
 eq(publication.observations.originalFlags,{wrapperOk:false,scenarioOk:false,actualPreparationAccepted:false,actualMarchAccepted:false,acceptedForPreparationClosure:false});
 eq([publication.observations.wholeSavedMarchQualified,publication.observations.publishedNewMainInput,publication.observations.oldUnsavedWorldContinuityAccepted],[true,true,false]);
 const historyProof=verifyCity4PreparationLedger(historyLedger),marchProof=verifyCity4MarchDispatch(historyLedger);eq(historyProof.phase,'dispatched');eq(historyProof.completedSteps,2);eq(historyProof.mayRepeatCompletedAction,false);eq(marchProof.nextAction,{kind:'conditional-END-admission-only',ordinaryEndAccepted:false});
 eq(world,marchProof.lastWorld,'Entire current published world is the fully saved queued world');eq(world,finalOwner.ticket.world);eq(finalOwner.ticket,marchProof.lastTicket);eq(finalOwner.pair,marchProof.lastPublicPair);eq(pair,marchProof.lastPublicPair,'Preserve complete current pair and original hex letter case');
 eq(publicSavePacket,{publicSave:historyLedger.march.publicSave,publicPair:historyLedger.march.publicPair,publicKeys:historyLedger.march.publicKeys});eq(publication.main.lastSaveTag,historyLedger.march.publicSave.tag);eq(publication.main.world.source,CITY4_END_ARCHIVED_PINS.final);
 eq([world.year,world.month,world.cities[4].Food,world.cities[4].MothballArms,world.cities[20].Food,world.cities[20].Money,world.people[44].Thew],[239,10,6334,0,1,886,12]);eq(world.orders.flatMap((o,i)=>o.OrderId===255?[]:[i]),[0,170]);
 eq(verifyOriginalSavePair({...pair,world}).ok,true);return{historyProof,marchProof,originProof,...noCredit()};
}
export function readCity4DispatchedInput(root,{readFile}={}){
 const allowed=new Map([...OCTOBER_INPUT_PINS,...CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN].map(p=>[p.path,p]));
 const read=p=>{assert.ok(allowed.has(p),'Only eight named P57 public files and original LIB');return checked(allowed.get(p),readFile?readFile(p):v45ReadBounded(root,p,allowed.get(p).bytes));};
 const publicationBytes=read(OCTOBER_INPUT_PINS[0].path),worldBytes=read(OCTOBER_INPUT_PINS[1].path),publication=JSON.parse(publicationBytes),world=JSON.parse(worldBytes),savs=OCTOBER_INPUT_PINS.slice(2).map(p=>read(p.path)),index=JSON.parse(read(CITY4_HISTORY_INPUT_PINS[0].path));eq(publication.archive,CITY4_HISTORY_INPUT_PINS[0]);eq(index.parts.map(({path,bytes,sha256})=>({path,bytes,sha256})),CITY4_HISTORY_INPUT_PINS.slice(1));
 const archive=decodeV45Archive({index,readPart:read}).files,ledgerBytes=checked(CITY4_END_ARCHIVED_PINS.ledger,archive.get(CITY4_END_ARCHIVED_PINS.ledger.path)),finalBytes=checked(CITY4_END_ARCHIVED_PINS.final,archive.get(CITY4_END_ARCHIVED_PINS.final.path)),saveBytes=checked(CITY4_END_ARCHIVED_PINS.publicSave,archive.get(CITY4_END_ARCHIVED_PINS.publicSave.path)),candidate=JSON.parse(ledgerBytes),finalOwner=JSON.parse(finalBytes),publicSavePacket=JSON.parse(saveBytes),libBytes=read(CITY4_END_LIBRARY_PIN.path);
 const originBytes={publication:publicationBytes,world:worldBytes,sav0:savs[0],sav1:savs[1],ledger:ledgerBytes,final:finalBytes,publicSave:saveBytes,library:libBytes};
 eq(candidate.assessed,false,'Historical controller assessment remains false');const historyLedger=withCity4EndRuntimeLibrary(candidate.ledger,libBytes),pair=copy(historyLedger.march.publicPair);
 for(let i=0;i<2;i++){eq(publication.main.pair[i].published,OCTOBER_INPUT_PINS[i+2]);assert.ok(savs[i].equals(Buffer.from(pair['sav'+i],'hex')),'Latest public SAV bytes exactly match actual ledger pair');const original=publication.main.pair[i].original;assert.ok(savs[i].equals(checked(original,archive.get(original.path))));}
 const proof=verifyCity4DispatchedHistory({originBytes,publication,world,pair,historyLedger,finalOwner,publicSavePacket,libBytes});assertCity4EndSaveTags(CITY4_END_SAVE_TAGS,historyLedger);
 return{originBytes,inputPins:OCTOBER_INPUT_PINS.map(p=>({...p})),historyInputPins:CITY4_HISTORY_INPUT_PINS.map(p=>({...p})),world,pair,historyLedger,historyProof:proof.historyProof,nativeBudget:copy(historyLedger.nativeBudget),libBytes,publication,finalOwner,publicSavePacket,expectedSaveTags:{...CITY4_END_SAVE_TAGS},...CITY4_END_SCOPE,...noCredit(),current:{date:[239,10],phase:'dispatched',city4Food:6334,city20Food:1,city20Money:886,residentGuardArms:600,reserveArms:0,activeOrders:[0,170],expectedNativeBattle:copy(proof.marchProof.expectedNativeBattle),nextAction:{kind:'conditional-END-admission-only',ordinaryEndAccepted:false}},historicalRawFlagsRewritten:false};
}
export const readLatestOctoberInput=readCity4DispatchedInput;
export function verifyCity4DispatchedResume(args){
 const fields=dataDescriptors(args,'END resume arguments'),input=ownData(args,'input','END resume arguments'),ledger=ownData(args,'ledger','END resume arguments'),saveTags=fields.has('saveTags')&&fields.get('saveTags').value!==undefined?fields.get('saveTags').value:CITY4_END_SAVE_TAGS;
 // All fresh data is inspected before raw-origin authentication can be followed by a caller getter.
 stripOriginHistory(ledger,{nodes:0});const metadataBudget={nodes:0};
 for(const key of ['inputPins','historyInputPins','nativeBudget','historyProof'])jsonData(ownData(input,key,'Dispatched input'),'Complete input metadata '+key,metadataBudget);
 jsonData(saveTags,'Complete next-round SAVE tags',metadataBudget);
 const bound=verifyCity4DispatchedHistory(input),old=bound.historyProof;dataDescriptors(ledger,'Fresh END resume ledger');dataDescriptors(ownData(ledger,'resume','Fresh END resume ledger'),'Fresh END resume');eq(input.inputPins,OCTOBER_INPUT_PINS);eq(input.historyInputPins,CITY4_HISTORY_INPUT_PINS);const inputBudget=ownData(input,'nativeBudget','Dispatched input');dataDescriptors(inputBudget,'Input native budget');eq(inputBudget,bound.originProof.authenticatedNativeBudget,'Input nativeBudget equals the raw-origin authenticated historical nativeBudget');assertCity4EndSaveTags(saveTags,input.historyLedger);eq(old,input.historyProof,'Complete supplied historical proof is recomputed');eq(old.lastPublicPair,input.pair);
 for(const key of Object.keys(ledger))assert.ok(['libBytes','nativeBudget','referenceWorld','saveTags','resume','repairs'].includes(key),'No new action or unclassified field in END resume ledger');eq(ledger.repairs??[],[],'No new distribution');assert.ok(ledger.resume);eq(stripCity4EndRuntime(ledger.resume.history),stripCity4EndRuntime(input.historyLedger),'The whole dispatched history is preserved');eq(ledger.resume.inputPair,input.pair,'Only current P57 pair may LOAD');eq(ledger.resume.expectedSaveTag,saveTags.resume);eq(ledger.nativeBudget,input.nativeBudget);
 const resume=verifyCity4Resume(ledger),preparation=verifyCity4PreparationLedger(ledger),march=verifyCity4MarchDispatch(ledger);eq(preparation.phase,'dispatched');eq(preparation.lastWorld,input.world,'Fresh resume SAVE cannot replay or alter the queued world');eq(preparation.mayRepeatCompletedAction,false);eq(march.expectedOrders.map(x=>x.slot),[0,170]);
 return{accepted:true,resumeEpochEstablished:true,historicalReferencesComparedAcrossProcesses:resume.historicalReferencesComparedAcrossProcesses,historicalSeedCompared:false,currentEpochAnchor:copy(preparation.currentEpochAnchor),lastWorld:copy(preparation.lastWorld),lastPair:copy(preparation.lastPublicPair),preparationProof:preparation,expectedNativeBattle:copy(march.expectedNativeBattle),...CITY4_END_SCOPE,mayRepeatCompletedAction:false,...noCredit()};
}
export function verifyCity4EndAdmission(args){
 const fields=dataDescriptors(args,'Conditional END arguments'),input=ownData(args,'input','Conditional END arguments'),ledger=ownData(args,'ledger','Conditional END arguments'),saveTags=fields.has('saveTags')&&fields.get('saveTags').value!==undefined?fields.get('saveTags').value:CITY4_END_SAVE_TAGS,observerExpected=ownData(args,'observerExpected','Conditional END arguments'),hookFence=ownData(args,'hookFence','Conditional END arguments'),endReady=ownData(args,'endReady','Conditional END arguments');
 const endBudget={nodes:0};for(const [label,value]of [['observerExpected',observerExpected],['hookFence',hookFence],['endReady',endReady]])jsonData(value,'Complete conditional END '+label,endBudget);
 const resumed=verifyCity4DispatchedResume({input,ledger,saveTags}),proof=verifyCity4ConditionalEndAdmission({...ledger,observerExpected,hookFence,endReady});eq(proof.maximumNaturalMonths,1);eq(proof.forecastIsActualIncome,false);eq(proof.actualCurrentFoodSafe,false);eq(proof.nextNativeConfirm,39);
 return{accepted:true,conditionalEndAdmissionQualified:true,resumeEpochEstablished:resumed.resumeEpochEstablished,proof,sourceFoodGain:proof.sourceFoodGain,sourceMoneyGain:proof.sourceMoneyGain,nextNativeConfirm:39,mayRepeatCompletedAction:false,requiredAfterEnd:'Complete original slot0 return and immediate next active callback, real strict food and fresh battle owner before any later action',...CITY4_END_SCOPE,...noCredit()};
}
