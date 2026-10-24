// Pure dispatched-P57 input/admission candidate. No game, SAVE, END, RNG or native writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
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
function checked(p,b){assert.ok(Buffer.isBuffer(b)||b instanceof Uint8Array,'Explicit byte input: '+p.path);const x=Buffer.from(b);eq([x.length,sha(x)],[p.bytes,p.sha256],'Exact P57 bytes/SHA: '+p.path);return x;}
export function stripCity4EndRuntime(a,depth=0){assert.ok(a&&depth<=8,'Bounded complete historical ledger');const{libBytes,...b}=a;return{...b,...(b.resume?{resume:{...b.resume,history:stripCity4EndRuntime(b.resume.history,depth+1)}}:{})};}
export function withCity4EndRuntimeLibrary(a,libBytes,depth=0){assert.ok(a&&depth<=8,'Bounded complete historical ledger');return{...a,libBytes:Buffer.from(libBytes),...(a.resume?{resume:{...a.resume,history:withCity4EndRuntimeLibrary(a.resume.history,libBytes,depth+1)}}:{})};}
const neutralTag=t=>assert.ok(typeof t==='string'&&/^wood67-131-[a-z0-9-]+$/.test(t),'Explicit neutral SAVE tag');
export function collectCity4EndTags(history){
 const declared=new Set(),seen=new Set();
 function visit(a,depth){assert.ok(a&&typeof a==='object'&&depth<=8&&!seen.has(a),'Bounded acyclic complete history');seen.add(a);if(a.saveTags){for(const t of Object.values(a.saveTags)){neutralTag(t);declared.add(t);}}for(const s of[a.referenceSave,a.resume?.publicSave,...(a.repairs||[]).map(r=>r.publicSave),a.plunder?.publicSave,a.march?.publicSave])if(s){neutralTag(s.tag);declared.add(s.tag);}if(a.resume){neutralTag(a.resume.expectedSaveTag);declared.add(a.resume.expectedSaveTag);visit(a.resume.history,depth+1);}}
 visit(history,0);const proof=verifyCity4PreparationLedger(history);return{declared:[...declared].sort(),used:[...proof.usedSaveTags].sort()};
}
export function assertCity4EndSaveTags(tags,history){eq(Object.keys(tags).sort(),['failed','resume','settled']);const values=Object.values(tags);values.forEach(neutralTag);eq(new Set(values).size,3,'Distinct next-round SAVE roles');const all=collectCity4EndTags(history),blocked=new Set([...all.declared,...all.used]);for(const t of values)assert.ok(!blocked.has(t),'New END-round tag cannot reuse any recursively declared or used historical tag');return copy(tags);}
export function verifyCity4DispatchedHistory({publication,world,pair,historyLedger,finalOwner,publicSavePacket,libBytes}){
 checked(CITY4_END_LIBRARY_PIN,libBytes);eq(publication.prefix,P);eq(publication.run.terminal,{closed:true,sessionId:60763,initialChunk:'346c11',terminalChunk:'778a7d',exitCode:1});
 eq(publication.observations.originalFlags,{wrapperOk:false,scenarioOk:false,actualPreparationAccepted:false,actualMarchAccepted:false,acceptedForPreparationClosure:false});
 eq([publication.observations.wholeSavedMarchQualified,publication.observations.publishedNewMainInput,publication.observations.oldUnsavedWorldContinuityAccepted],[true,true,false]);
 const historyProof=verifyCity4PreparationLedger(historyLedger),marchProof=verifyCity4MarchDispatch(historyLedger);eq(historyProof.phase,'dispatched');eq(historyProof.completedSteps,2);eq(historyProof.mayRepeatCompletedAction,false);eq(marchProof.nextAction,{kind:'conditional-END-admission-only',ordinaryEndAccepted:false});
 eq(world,marchProof.lastWorld,'Entire current published world is the fully saved queued world');eq(world,finalOwner.ticket.world);eq(finalOwner.ticket,marchProof.lastTicket);eq(finalOwner.pair,marchProof.lastPublicPair);eq(pair,marchProof.lastPublicPair,'Preserve complete current pair and original hex letter case');
 eq(publicSavePacket,{publicSave:historyLedger.march.publicSave,publicPair:historyLedger.march.publicPair,publicKeys:historyLedger.march.publicKeys});eq(publication.main.lastSaveTag,historyLedger.march.publicSave.tag);eq(publication.main.world.source,CITY4_END_ARCHIVED_PINS.final);
 eq([world.year,world.month,world.cities[4].Food,world.cities[4].MothballArms,world.cities[20].Food,world.cities[20].Money,world.people[44].Thew],[239,10,6334,0,1,886,12]);eq(world.orders.flatMap((o,i)=>o.OrderId===255?[]:[i]),[0,170]);
 eq(verifyOriginalSavePair({...pair,world}).ok,true);return{historyProof,marchProof,...noCredit()};
}
export function readCity4DispatchedInput(root,{readFile}={}){
 const allowed=new Map([...OCTOBER_INPUT_PINS,...CITY4_HISTORY_INPUT_PINS,CITY4_END_LIBRARY_PIN].map(p=>[p.path,p]));
 const read=p=>{assert.ok(allowed.has(p),'Only nine named P57 public inputs and original LIB');return checked(allowed.get(p),readFile?readFile(p):v45ReadBounded(root,p,allowed.get(p).bytes));};
 const publication=JSON.parse(read(OCTOBER_INPUT_PINS[0].path)),world=JSON.parse(read(OCTOBER_INPUT_PINS[1].path)),savs=OCTOBER_INPUT_PINS.slice(2).map(p=>read(p.path)),index=JSON.parse(read(CITY4_HISTORY_INPUT_PINS[0].path));eq(publication.archive,CITY4_HISTORY_INPUT_PINS[0]);eq(index.parts.map(({path,bytes,sha256})=>({path,bytes,sha256})),CITY4_HISTORY_INPUT_PINS.slice(1));
 const archive=decodeV45Archive({index,readPart:read}).files,archived=p=>JSON.parse(checked(p,archive.get(p.path))),candidate=archived(CITY4_END_ARCHIVED_PINS.ledger),finalOwner=archived(CITY4_END_ARCHIVED_PINS.final),publicSavePacket=archived(CITY4_END_ARCHIVED_PINS.publicSave),libBytes=read(CITY4_END_LIBRARY_PIN.path);
 eq(candidate.assessed,false,'Historical controller assessment remains false');const historyLedger=withCity4EndRuntimeLibrary(candidate.ledger,libBytes),pair=copy(historyLedger.march.publicPair);
 for(let i=0;i<2;i++){eq(publication.main.pair[i].published,OCTOBER_INPUT_PINS[i+2]);assert.ok(savs[i].equals(Buffer.from(pair['sav'+i],'hex')),'Latest public SAV bytes exactly match actual ledger pair');const original=publication.main.pair[i].original;assert.ok(savs[i].equals(checked(original,archive.get(original.path))));}
 const proof=verifyCity4DispatchedHistory({publication,world,pair,historyLedger,finalOwner,publicSavePacket,libBytes});assertCity4EndSaveTags(CITY4_END_SAVE_TAGS,historyLedger);
 return{inputPins:OCTOBER_INPUT_PINS.map(p=>({...p})),historyInputPins:CITY4_HISTORY_INPUT_PINS.map(p=>({...p})),world,pair,historyLedger,historyProof:proof.historyProof,nativeBudget:copy(historyLedger.nativeBudget),libBytes,publication,finalOwner,publicSavePacket,expectedSaveTags:{...CITY4_END_SAVE_TAGS},...CITY4_END_SCOPE,...noCredit(),current:{date:[239,10],phase:'dispatched',city4Food:6334,city20Food:1,city20Money:886,residentGuardArms:600,reserveArms:0,activeOrders:[0,170],expectedNativeBattle:copy(proof.marchProof.expectedNativeBattle),nextAction:{kind:'conditional-END-admission-only',ordinaryEndAccepted:false}},historicalRawFlagsRewritten:false};
}
export const readLatestOctoberInput=readCity4DispatchedInput;
export function verifyCity4DispatchedResume({input,ledger,saveTags=CITY4_END_SAVE_TAGS}){
 eq(input.inputPins,OCTOBER_INPUT_PINS);eq(input.historyInputPins,CITY4_HISTORY_INPUT_PINS);assertCity4EndSaveTags(saveTags,input.historyLedger);const bound=verifyCity4DispatchedHistory(input),old=bound.historyProof;eq(old,input.historyProof,'Complete supplied historical proof is recomputed');eq(old.lastPublicPair,input.pair);
 for(const key of Object.keys(ledger))assert.ok(['libBytes','nativeBudget','referenceWorld','saveTags','resume','repairs'].includes(key),'No new action or unclassified field in END resume ledger');eq(ledger.repairs??[],[],'No new distribution');assert.ok(ledger.resume);eq(stripCity4EndRuntime(ledger.resume.history),stripCity4EndRuntime(input.historyLedger),'The whole dispatched history is preserved');eq(ledger.resume.inputPair,input.pair,'Only current P57 pair may LOAD');eq(ledger.resume.expectedSaveTag,saveTags.resume);eq(ledger.nativeBudget,input.nativeBudget);
 const resume=verifyCity4Resume(ledger),preparation=verifyCity4PreparationLedger(ledger),march=verifyCity4MarchDispatch(ledger);eq(preparation.phase,'dispatched');eq(preparation.lastWorld,input.world,'Fresh resume SAVE cannot replay or alter the queued world');eq(preparation.mayRepeatCompletedAction,false);eq(march.expectedOrders.map(x=>x.slot),[0,170]);
 return{accepted:true,resumeEpochEstablished:true,historicalReferencesComparedAcrossProcesses:resume.historicalReferencesComparedAcrossProcesses,historicalSeedCompared:false,currentEpochAnchor:copy(preparation.currentEpochAnchor),lastWorld:copy(preparation.lastWorld),lastPair:copy(preparation.lastPublicPair),preparationProof:preparation,expectedNativeBattle:copy(march.expectedNativeBattle),...CITY4_END_SCOPE,mayRepeatCompletedAction:false,...noCredit()};
}
export function verifyCity4EndAdmission({input,ledger,saveTags=CITY4_END_SAVE_TAGS,observerExpected,hookFence,endReady}){
 const resumed=verifyCity4DispatchedResume({input,ledger,saveTags}),proof=verifyCity4ConditionalEndAdmission({...ledger,observerExpected,hookFence,endReady});eq(proof.maximumNaturalMonths,1);eq(proof.forecastIsActualIncome,false);eq(proof.actualCurrentFoodSafe,false);eq(proof.nextNativeConfirm,39);
 return{accepted:true,conditionalEndAdmissionQualified:true,resumeEpochEstablished:resumed.resumeEpochEstablished,proof,sourceFoodGain:proof.sourceFoodGain,sourceMoneyGain:proof.sourceMoneyGain,nextNativeConfirm:39,mayRepeatCompletedAction:false,requiredAfterEnd:'Complete original slot0 return and immediate next active callback, real strict food and fresh battle owner before any later action',...CITY4_END_SCOPE,...noCredit()};
}
