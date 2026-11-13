// Pure WOOD missing-art configuration and supplied-evidence gate. No HTTP,
// browser, gameplay, input, file mutation or actual acceptance is performed.
import assert from 'node:assert/strict';
import {verifyWoodCaptures} from './hd-wood-runtime-oracle.mjs';

export const V40_WOOD_MISSING_PATH='assets/hd-spe/wood-37/picture-0.png';
const LIB_SHA='3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e',copy=structuredClone,eq=(a,b,m)=>assert.deepEqual(a,b,m);
const flags=()=>({sourceOnly:true,actual404Observed:false,actualFallbackAccepted:false,actualCastAccepted:false,actualClassicAccepted:false,hdAccepted:false,globalHdComplete:false});
function json(v,seen=new Set()){
 if(v===null||['string','boolean'].includes(typeof v))return;if(typeof v==='number'){assert.ok(Number.isFinite(v));return;}assert.ok(v&&typeof v==='object'&&!seen.has(v));eq(Object.getPrototypeOf(v),Array.isArray(v)?Array.prototype:Object.prototype);seen.add(v);
 for(const k of Reflect.ownKeys(v)){if(Array.isArray(v)&&k==='length')continue;assert.equal(typeof k,'string');const d=Object.getOwnPropertyDescriptor(v,k);assert.ok(Object.hasOwn(d,'value')&&d.enumerable,'Only measured plain JSON data');json(d.value,seen);}if(Array.isArray(v))eq(Object.keys(v).length,v.length,'Dense JSON array');seen.delete(v);
}
function requiredOptions({mode,missingAssets,allowLcd,expectClassic,classic}={}){eq([mode,missingAssets,allowLcd,expectClassic,classic],['hd',true,true,false,false],'Exact WOOD missing-picture HD/LCD configuration; classic is a separate case');}
function picture(p,index,{unused=false}={}){
 assert.ok(p);eq([p.picIndex,p.logicalWidth,p.logicalHeight,p.nativeWidth,p.nativeHeight,p.mask],[index,index?66:64,64,index?66:64,64,0],'Original opaque WOOD picture identity');
 if(unused)eq([p.src,p.width,p.height],[null,null,null],'Skill7 unused wide slot never causes a request');else{eq(p.src,index?'assets/hd-spe/wood-37/picture-1.png':V40_WOOD_MISSING_PATH,'Exact frozen source path, no host/query/encoding aliases');assert.ok(Number.isInteger(p.width)&&p.width>=p.nativeWidth&&Number.isInteger(p.height)&&p.height>=p.nativeHeight,'Measured current source image dimensions');}
}
export function createV40WoodMissingPictureConfig(options={}){
 requiredOptions(options);const m=options.manifest;json(m);eq([m.schemaVersion,m.libSha256,m.axScale],[1,LIB_SHA,1]);assert.ok(Array.isArray(m.entries));const all=m.entries.filter(e=>e.speId===37);eq(all.length,2,'Exactly the two current WOOD37 family entries');
 const families=[6,7].map(skillId=>{const matches=all.filter(e=>e.skillId===skillId);eq(matches.length,1,'No missing or ambiguous WOOD family');const e=matches[0];for(const k of['background','compositionVersion','composition'])assert.ok(!Object.hasOwn(e,k),'WOOD has no background/composition resource contract');eq([e.speId,e.resourceIndex,e.kind,e.startFrm,e.endFrm,e.count,e.picmax,e.resourceFingerprint,e.resourceLength,e.opaqueCoverageVersion,e.skillResultVersion],[37,0,2,0,skillId===6?7:0,8,2,'fnv1a32:d38c3c8b:1148',1148,1,1]);
  eq(e.units,Array.from({length:8},(_,frame)=>({frame,x:0,y:0,picIndex:frame%2})),'Complete original WOOD37 unit-to-picture mapping');eq(e.pictures.length,2);picture(e.pictures[0],0);picture(e.pictures[1],1,{unused:skillId===7});eq(e.skillNumber,{id:15,resourceIndex:0,pictureIndex:0,nativeWidth:12,nativeHeight:16,count:10,mask:0,x:0,y:0,resourceLength:327,resourceFingerprint:'fnv1a32:b37d7407:327'},'Native NUM15 stays available and is never the missing route');
  return{skillId,speId:37,kind:2,startFrame:0,endFrame:e.endFrm,requiredNativeCopies:skillId===6?8:1,sharedPicture:copy(e.pictures[0])};
 });eq(families[0].sharedPicture,families[1].sharedPicture,'Both WOOD families use the same exact picture0 descriptor');
 return{configurationQualified:true,mode:'hd',missingAssets:true,classic:false,allowLcd:true,expectClassic:false,missingPaths:[V40_WOOD_MISSING_PATH],missingUrls:['/'+V40_WOOD_MISSING_PATH],families,oracleOptions:{allowLcd:true,expectClassic:false},sourceBytesMustRemainFrozen:true,unrelatedAssetsMayNot404:true,...flags()};
}
function requests(report,config){
 assert.ok(Array.isArray(report.requests),'Actual frozen-server request records required');const bad=report.requests.filter(r=>r.status!==200);assert.ok(bad.length>0,'The exact shared picture0 must really have a retained expected404 receipt');for(const r of bad){eq([r.status,r.expected,r.url,r.source],[404,true,config.missingUrls[0],config.missingPaths[0]],'Only exact expected WOOD picture0 may fail; no unrelated asset or BACKPIC substitute');}assert.ok(!report.requests.some(r=>r.status===200&&(r.source===config.missingPaths[0]||r.url===config.missingUrls[0])),'The missing route cannot also be successfully served');return{expected404Count:bad.length,missingUrls:[...config.missingUrls],unrelatedFailures:0};
}
function oracleBoundary(oracle){
 eq([oracle?.ok,oracle?.accepted,oracle?.fallbackAccepted,oracle?.hdAccepted,oracle?.classicNegativeAccepted,oracle?.keyCountDuringSelectedMovieOrResult],[true,true,true,false,false,0],'Maintained WOOD oracle must accept both pure LCD families without classic mode or HD replacement');eq(oracle.families.map(f=>f.skillId),[6,7]);
 for(const f of oracle.families){eq([f.completeCopies.skillId,f.completeCopies.distinctCopies,f.hdReadbacks],[f.skillId,f.skillId===6?8:1,0]);assert.ok(f.movieReadbacks>0&&f.postReadbacks>0&&f.labels>0&&f.numbers>0&&f.holds>0,'Every family needs its own movie, GBK/NUM and completed HOLD');eq(f.observedWidths,f.skillId===6?[64,66]:[64]);}
 assert.ok(Array.isArray(oracle.verified)&&oracle.verified.length>0);for(const v of oracle.verified)eq(v.source,'lcd','Every selected movie/NUM/HOLD readback is full LCD fallback');return{bothFamiliesQualified:true,zeroHdReadbacks:true,copyCounts:[8,1],retirementValidatedByMaintainedOracle:true};
}
function selectedFailureOwners(report,oracle){
 const captures=report.woodCaptures||report.skillCaptures;assert.ok(Array.isArray(captures));const identity=c=>{const post=c.spe?.active!==1,s=post?c.result:c.spe,d=s?.display,current=post?s?.scene:s;return{at:c.at,skillId:s?.skillId,generation:s?.generation,eventId:post?d?.eventId:s?.eventId,session:post?s?.session:null,phase:post?s?.phase:'movie',commitSeq:d?.commitSeq,currentCommitSeq:current?.commitSeq};};
 for(const v of oracle.verified){const wanted=Object.fromEntries(['at','skillId','generation','eventId','session','phase','commitSeq','currentCommitSeq'].map(k=>[k,v[k]])),matches=captures.filter(c=>{try{eq(identity(c),wanted);return true;}catch{return false;}});assert.ok(matches.length,'Every verified readback rebinds its real full current movie/NUM/HOLD identity');for(const c of matches)eq([c.mode,c.ui?.source,c.ui?.fallbackReason],['hd','lcd','asset-load-failed'],'Selected fallback belongs to HD mode and a real completed asset failure, never loading/classic/another reason');}
 return{selectedFailureOwnerReadbacks:oracle.verified.length,onlySelectedCapturesChecked:true};
}
export function verifyV40WoodMissingEvidence(options={}){
 const config=createV40WoodMissingPictureConfig(options),{report,library,font,assets,artifactDir}=options;assert.ok(report&&typeof report==='object');const a=assets instanceof Map?assets.get('assets/hd-spe/manifest.json'):assets?.['assets/hd-spe/manifest.json'],bytes=a?.data||a;assert.ok(Buffer.isBuffer(bytes),'Exact frozen manifest bytes passed to the maintained oracle');eq(JSON.parse(bytes.toString('utf8')),options.manifest,'Configuration and pixel oracle consume the same complete frozen manifest');
 const http=requests(report,config),oracle=verifyWoodCaptures(report,{library,font,assets,artifactDir,allowLcd:true,expectClassic:false}),boundary=oracleBoundary(oracle),selectedOwners=selectedFailureOwners(report,oracle);
 return{evidenceContractSatisfied:true,config,http,boundary,selectedOwners,oracle,...flags()};
}
