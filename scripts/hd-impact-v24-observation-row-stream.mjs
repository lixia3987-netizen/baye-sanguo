// V24 evidence transport only. Import is I/O-free. Each row retains the frozen V23 budgets.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeV23JsonValue } from './hd-impact-v23-json-normalize.mjs';
import { encodeV23WorldDictionary, verifyV23WorldDictionary, hydrateV23WorldDictionary } from './hd-impact-v23-world-dictionary.mjs';
export const V24_ROW_STREAM_KIND='impact13-v24-observation-row-stream';
export const V24_ROW_MAX_BYTES=64*1024*1024;
const HASH=/^[a-f0-9]{64}$/, sha=b=>createHash('sha256').update(b).digest('hex');
const flags=()=>({actualCreditGranted:false,actualPreparationAccepted:false,actualCastAccepted:false,hdAccepted:false});
function check(c,m){if(!c)throw new TypeError('V24 observation stream: '+m);}
function exact(v,keys,name){check(v&&typeof v==='object'&&!Array.isArray(v),name+' object');check(JSON.stringify(Object.keys(v).sort())===JSON.stringify([...keys].sort()),name+' keys');}
function metadata(field,label,expectedCount,maxRowBytes){check(typeof field==='string'&&field.length>0&&field.length<=256,'field');check(typeof label==='string'&&label.length>0&&label.length<=256,'label');check(Number.isSafeInteger(expectedCount)&&expectedCount>=0&&expectedCount<=1000000,'expectedCount');check(Number.isSafeInteger(maxRowBytes)&&maxRowBytes>0&&maxRowBytes<=V24_ROW_MAX_BYTES,'maxRowBytes may only lower fixed cap');}
function chainRow(h,index,packet,line){h.update(String(index)+':'+packet.sourceBytes+':'+packet.sourceSha256+':'+sha(line)+'\n');}

// Expand the already-validated dictionary to hash sinks, never to one hydrated row/array string.
function nextLogical(state,packet,index){const next={hash:state.hash.copy(),bytes:state.bytes},rowHash=createHash('sha256');let rowBytes=0;const worlds=new Map(packet.worlds.map(e=>[e.id,JSON.stringify(e.world)]));
 const sink=s=>{const b=Buffer.from(s);next.hash.update(b);next.bytes+=b.length;rowHash.update(b);rowBytes+=b.length;};
 if(index){next.hash.update(',');next.bytes++;}
 function walk(v){if(v===null||typeof v!=='object'){sink(JSON.stringify(v));return;}if(Object.hasOwn(v,'$impact13V23World')){check(worlds.has(v.$impact13V23World),'logical world reference');sink(worlds.get(v.$impact13V23World));return;}const a=Array.isArray(v);sink(a?'[':'{');const keys=Object.keys(v);keys.forEach((k,i)=>{if(i)sink(',');if(!a)sink(JSON.stringify(k)+':');walk(v[k]);});sink(a?']':'}');}walk(packet.value);
 check(rowBytes===packet.sourceBytes&&rowHash.digest('hex')===packet.sourceSha256,'logical row digest mismatch');return next;}
function logicalPin(state,complete){const h=state.hash.copy();if(complete)h.update(']');return {container:'array',complete,bytes:state.bytes+(complete?1:0),sha256:h.digest('hex')};}

export function encodeV24ObservationRow(row,index,{maxRowBytes=V24_ROW_MAX_BYTES}={}){
 check(Number.isSafeInteger(index)&&index>=0,'row index');check(Number.isSafeInteger(maxRowBytes)&&maxRowBytes>0&&maxRowBytes<=V24_ROW_MAX_BYTES,'row byte cap');
 // Deliberately no caller-supplied normalize/codec budget: both frozen defaults apply independently per row.
 const normalized=normalizeV23JsonValue(row);check(normalized!==undefined,'top-level row is not JSON serializable');
 const packet=encodeV23WorldDictionary(normalized),envelope={type:'row',index,sourceBytes:packet.sourceBytes,sourceSha256:packet.sourceSha256,packet};
 const line=Buffer.from(JSON.stringify(envelope)+'\n');check(line.length<=maxRowBytes,'row byte limit');
 return {line,packet,sourceBytes:packet.sourceBytes,sourceSha256:packet.sourceSha256,...flags()};
}
export function writeV24ObservationRows({filePath,rows,field,label,expectedCount,maxRowBytes=V24_ROW_MAX_BYTES}){
 metadata(field,label,expectedCount,maxRowBytes);check(typeof filePath==='string'&&filePath.length>0,'filePath');
 check(rows&&typeof rows[Symbol.iterator]==='function','rows must be iterable');
 let fd=null,bytes=0,rowsWritten=0,stage='open',failure=null,closed=false,firstRowLogicalPin=null;let logical={hash:createHash('sha256').update('['),bytes:1};const fileHash=createHash('sha256'),rowHash=createHash('sha256');
 function write(b){check(b.length<=maxRowBytes,'line byte limit');let off=0;while(off<b.length){const n=fs.writeSync(fd,b,off,Math.min(1024*1024,b.length-off));check(Number.isSafeInteger(n)&&n>0,'write made no progress');fileHash.update(b.subarray(off,off+n));bytes+=n;off+=n;}}
 try{
  fd=fs.openSync(filePath,'wx');stage='header';write(Buffer.from(JSON.stringify({type:'header',schemaVersion:1,kind:V24_ROW_STREAM_KIND,field,label,expectedCount,maxRowBytes,normalizeMaxNodes:10000000,codecMaxNodes:10000000})+'\n'));
  stage='rows';for(const row of rows){check(rowsWritten<expectedCount,'more rows than declared');const encoded=encodeV24ObservationRow(row,rowsWritten,{maxRowBytes});const next=nextLogical(logical,encoded.packet,rowsWritten);write(encoded.line);chainRow(rowHash,rowsWritten,encoded.packet,encoded.line);logical=next;firstRowLogicalPin??={bytes:encoded.sourceBytes,sha256:encoded.sourceSha256};rowsWritten++;}
  check(rowsWritten===expectedCount,'fewer rows than declared');stage='footer';const rowChainSha256=rowHash.copy().digest('hex');
  write(Buffer.from(JSON.stringify({type:'end',complete:true,rowsWritten,expectedCount,rowChainSha256,logicalValue:logicalPin(logical,true)})+'\n'));stage='fsync';fs.fsyncSync(fd);stage='close';fs.closeSync(fd);fd=null;closed=true;
 }catch(e){failure={stage,rowIndex:rowsWritten,name:e?.name??'Error',message:String(e?.message??e)};}
 finally{if(fd!==null){try{fs.closeSync(fd);closed=true;}catch(e){failure??={stage:'close',rowIndex:rowsWritten,name:e?.name??'Error',message:String(e?.message??e)};}}}
 return {schemaVersion:1,kind:V24_ROW_STREAM_KIND,path:filePath,field,label,expectedCount,rowsWritten,count:rowsWritten,firstRowLogicalPin,logicalValue:logicalPin(logical,failure===null&&closed),complete:failure===null&&closed,bytes,sha256:fd===null&&stage==='open'?null:fileHash.digest('hex'),rowChainSha256:rowHash.digest('hex'),fileCreated:stage!=='open',closed,failure,completeLogicalValuesPreserved:failure===null&&closed,sourceArrayMayBeDeleted:failure===null&&closed,...flags()};
}
// onRow receives a provisional verified prefix; only the final accepted receipt establishes a complete file.
export async function verifyV24ObservationRows({filePath,expectedReceipt=null,onRow=null,maxRowBytes=V24_ROW_MAX_BYTES}){
 check(Number.isSafeInteger(maxRowBytes)&&maxRowBytes>0&&maxRowBytes<=V24_ROW_MAX_BYTES,'reader cap');check(onRow===null||typeof onRow==='function','onRow');
 let logical={hash:createHash('sha256').update('['),bytes:1};let firstRowLogicalPin=null;let bytes=0,rowsVerified=0,header=null,footer=null,pending=Buffer.alloc(0),failure=null,lineNumber=0;const fileHash=createHash('sha256'),rowHash=createHash('sha256');
 const fail=(e)=>{failure??={lineNumber,rowIndex:rowsVerified,name:e?.name??'Error',message:String(e?.message??e)};};
 async function line(b){lineNumber++;check(b.length+1<=maxRowBytes,'line byte limit');check(!footer,'data after complete footer');if(header)check(b.length+1<=header.maxRowBytes,'declared line byte limit');const v=JSON.parse(b.toString('utf8'));
  if(!header){exact(v,['type','schemaVersion','kind','field','label','expectedCount','maxRowBytes','normalizeMaxNodes','codecMaxNodes'],'header');check(v.type==='header'&&v.schemaVersion===1&&v.kind===V24_ROW_STREAM_KIND,'header schema');metadata(v.field,v.label,v.expectedCount,v.maxRowBytes);check(b.length+1<=v.maxRowBytes,'declared header byte limit');check(v.maxRowBytes<=maxRowBytes&&v.normalizeMaxNodes===10000000&&v.codecMaxNodes===10000000,'fixed budgets');header=v;return;}
  if(v.type==='end'){exact(v,['type','complete','rowsWritten','expectedCount','rowChainSha256','logicalValue'],'footer');check(v.complete===true&&v.rowsWritten===rowsVerified&&v.expectedCount===header.expectedCount&&rowsVerified===header.expectedCount,'footer count');check(HASH.test(v.rowChainSha256)&&v.rowChainSha256===rowHash.copy().digest('hex'),'footer chain');exact(v.logicalValue,['container','complete','bytes','sha256'],'footer logicalValue');check(JSON.stringify(v.logicalValue)===JSON.stringify(logicalPin(logical,true)),'footer logical digest');footer=v;return;}
  exact(v,['type','index','sourceBytes','sourceSha256','packet'],'row');check(v.type==='row'&&v.index===rowsVerified&&rowsVerified<header.expectedCount,'row order/count');check(v.sourceBytes===v.packet?.sourceBytes&&v.sourceSha256===v.packet?.sourceSha256,'row logical pin');
  verifyV23WorldDictionary(v.packet);const next=nextLogical(logical,v.packet,rowsVerified);chainRow(rowHash,rowsVerified,v.packet,Buffer.concat([b,Buffer.from('\n')]));
  if(onRow)await onRow({index:rowsVerified,packet:v.packet,sourceBytes:v.sourceBytes,sourceSha256:v.sourceSha256,hydrate:(options={})=>hydrateV23WorldDictionary(v.packet,options)});logical=next;firstRowLogicalPin??={bytes:v.sourceBytes,sha256:v.sourceSha256};rowsVerified++;
 }
 try{for await(const chunk of fs.createReadStream(filePath,{highWaterMark:64*1024})){bytes+=chunk.length;fileHash.update(chunk);if(failure)continue;let start=0;for(let i=0;i<chunk.length;i++)if(chunk[i]===10){const b=pending.length?Buffer.concat([pending,chunk.subarray(start,i)]):chunk.subarray(start,i);pending=Buffer.alloc(0);try{await line(b);}catch(e){fail(e);break;}start=i+1;}if(!failure){pending=Buffer.concat([pending,chunk.subarray(start)]);if(pending.length>=maxRowBytes)fail(new TypeError('V24 observation stream: line byte limit'));}}if(!failure){check(pending.length===0,'unterminated last line');check(header&&footer,'missing header or complete footer');}}
 catch(e){fail(e);}
 const sha256=fileHash.digest('hex'),rowChainSha256=rowHash.digest('hex'),logicalValue=logicalPin(logical,!!footer&&!failure);
 if(expectedReceipt&&!failure){try{check(expectedReceipt.complete===true&&expectedReceipt.completeLogicalValuesPreserved===true,'expected receipt is incomplete');for(const [k,v] of Object.entries({bytes,sha256,rowsWritten:rowsVerified,rowChainSha256,field:header?.field,label:header?.label,expectedCount:header?.expectedCount}))check(expectedReceipt[k]===v,'receipt '+k+' mismatch');check(JSON.stringify(expectedReceipt.logicalValue)===JSON.stringify(logicalValue),'receipt logicalValue mismatch');}catch(e){fail(e);}}
 return {schemaVersion:1,kind:V24_ROW_STREAM_KIND,path:filePath,accepted:failure===null,complete:failure===null,bytes,sha256,rowsVerified,count:rowsVerified,firstRowLogicalPin,logicalValue,rowChainSha256,header,footer,failure,wholeArrayMaterialized:false,completeLogicalValuesPreserved:failure===null,...flags()};
}

export async function readV24ObservationRow({filePath,index,receipt,maxHydratedBytes=16*1024*1024}){check(Number.isSafeInteger(index)&&index>=0,'selected index');check(receipt&&receipt.complete===true,'selected reader requires complete receipt');check(index<receipt.expectedCount,'selected index outside count');let selected=null;const verification=await verifyV24ObservationRows({filePath,expectedReceipt:receipt,onRow:r=>{if(r.index===index)selected={index,value:r.hydrate({maxHydratedBytes}),sourcePin:{bytes:r.sourceBytes,sha256:r.sourceSha256}};}});check(verification.accepted&&selected,'selected row file verification failed');return {accepted:true,...selected,streamVerification:verification,...flags()};}
