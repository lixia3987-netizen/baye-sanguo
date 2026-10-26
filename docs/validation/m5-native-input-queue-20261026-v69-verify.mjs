import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeV45Archive,V45_BOUNDS} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
import {B,D,PREFIX,LOCKS,BOUNDS,MODULES,eq,json,pin,check,pin3,safeRead,uniquePins,publicModule,portable,requireBinding,selectedData} from './m5-native-input-queue-20261026-v69-v69-core-v1.mjs';
import {verifyFacts} from './m5-native-input-queue-20261026-v69-v69-facts-v1.mjs';
import {verifyMaker} from './m5-native-input-queue-20261026-v69-maker-data-v1.mjs';

/** Greedy, exact SHA-alias groups; conservative limits keep every codec bound unchanged. */
export function groupData(pins,prefix){
  const aliases=new Map();for(const p of uniquePins(pins)){pin3(p);const key=p.bytes+':'+p.sha256;if(!aliases.has(key))aliases.set(key,[]);aliases.get(key).push(p);}
  const out=[];let current=null;
  const flush=()=>{if(current?.files.length)out.push(current);current=null;};
  for(const rows of aliases.values()){const size=rows[0].bytes,named=size*rows.length;assert.ok(size<=33554432&&named<=100663296&&rows.length<=450,'Whole alias group fits conservative '+prefix);current??={id:prefix+'-'+String(out.length+1).padStart(3,'0'),files:[],uniqueBytes:0,namedBytes:0};if(current.uniqueBytes+size>33554432||current.namedBytes+named>100663296||current.files.length+rows.length>450){flush();current={id:prefix+'-'+String(out.length+1).padStart(3,'0'),files:[],uniqueBytes:0,namedBytes:0};}current.files.push(...rows);current.uniqueBytes+=size;current.namedBytes+=named;}
  flush();return out.map(({id,files})=>({id,files}));
}
export function wholeManifest(b,c,J){
  const input=J(c.wholeChunks.input),m=J(c.wholeChunks.manifest);eq(input.schemaVersion,1);eq(input.source,c.result);eq(input.terminal,b.terminals[c.id]);eq(m.schemaVersion,1);eq(m.kind,'whole-original-mobile-raw-byte-chunks');eq(m.source,c.result);eq(m.input,c.wholeChunks.input);eq(m.maximumChunkBytes,BOUNDS.maxFileBytes);eq([m.originalJsonParsed,m.compressed,m.sourceBytesChanged],[false,false,false]);const count=Math.ceil(c.result.bytes/BOUNDS.maxFileBytes);eq(m.chunkCount,count);eq(m.chunks.length,count);let offset=0;
  for(let i=0;i<count;i++){const row=m.chunks[i];eq(row.ordinal,i,'Chunk ordinal '+c.id);eq(row.offset,offset,'Contiguous chunk offset '+c.id);eq(row.pin.path,D+c.id+'-chunks-v1/chunk-'+String(i+1).padStart(3,'0')+'.raw');eq(row.pin.bytes,Math.min(BOUNDS.maxFileBytes,c.result.bytes-offset));pin3(row.pin);offset+=row.pin.bytes;}eq(offset,c.result.bytes);return m;
}
export function packetPlan(b,J,bindingPin){
  requireBinding(b);const wholes=b.cases.filter(c=>c.wholeChunks),excluded=new Set([...wholes.map(c=>c.result.path),...b.maker.dataPins.map(p=>p.path),...b.maker.imagePins.map(p=>p.path)]),logical=uniquePins([...selectedData(b),bindingPin]),ordinary=logical.filter(p=>!excluded.has(p.path));
  for(const p of ordinary)assert.ok(!/owned-(?:before|cim-sample|after-terminal-cim)-/.test(p.path),'No unrelated full OS inventories');
  return[...groupData(ordinary,'core'),...groupData(b.maker.dataPins,'maker-data'),...b.maker.groups.map(({id,files})=>({id,files})),...wholes.flatMap(c=>wholeManifest(b,c,J).chunks.map((row,i)=>({id:c.id+'-'+String(i+1).padStart(3,'0'),files:[row.pin]})))];
}
export function restore(physical,b){
  const J=p=>json(check(p,physical.get(p.path))),logical=new Map(physical);
  for(const c of b.cases.filter(c=>c.wholeChunks)){const m=wholeManifest(b,c,J),parts=m.chunks.map(row=>check(row.pin,physical.get(row.pin.path))),raw=Buffer.concat(parts,c.result.bytes);check(c.result,raw);for(const row of m.chunks)logical.delete(row.pin.path);assert.ok(!logical.has(c.result.path),'Whole was never codec input');logical.set(c.result.path,raw);}
  return logical;
}
export function verifyLogical(logical,b,readCurrent,bindingPin){
  requireBinding(b);eq(uniquePins([...selectedData(b),bindingPin]),uniquePins([...logical].map(([p,v])=>pin(p,v))),'Exact whole logical inventory');const facts=verifyFacts(logical,b,readCurrent),maker=verifyMaker(logical,b),aliases=new Map();let named=0;for(const p of b.maker.capturePins){named+=p.bytes;const key=p.bytes+':'+p.sha256;if(!aliases.has(key))aliases.set(key,{bytes:p.bytes,count:0});aliases.get(key).count++;}const captureBudget={files:b.maker.capturePins.length,namedBytes:named,uniqueBlobs:aliases.size,uniqueBytes:[...aliases.values()].reduce((n,p)=>n+p.bytes,0),maximumAliases:Math.max(...[...aliases.values()].map(p=>p.count))};eq(captureBudget,{files:402,namedBytes:431738831,uniqueBlobs:192,uniqueBytes:214607064,maximumAliases:3},'Actual fixed Maker capture budget');return{...facts,maker:{...maker,captureBudget},wholeOriginals:b.cases.filter(c=>c.wholeChunks).map(c=>({id:c.id,pin:c.result,wholeRawShaBeforeJson:true,unknownFieldsPreserved:true})),wholeOsCimArchived:false};
}
export function verify(root,{readPublic,readCurrent}={}){
  eq(V45_BOUNDS,BOUNDS,'All eight original codec limits unchanged');readPublic??=((p,max)=>safeRead(root,p,max));readCurrent??=((p,max)=>safeRead(root,p,max));check(LOCKS.codec,readCurrent(LOCKS.codec.path,LOCKS.codec.bytes));const C=json(readPublic(PREFIX+'.json',2*1024*1024));eq(C.schemaVersion,1);eq(C.prefix,PREFIX);assert.ok(C.packets.length>0&&C.packets.length<=128,'Bounded whole packet count');const physical=new Map();
  for(const packet of C.packets){eq(packet.index.path,PREFIX+'-'+packet.id+'-archive-index.json');const index=json(check(packet.index,readPublic(packet.index.path,2*1024*1024)));eq(index.files.map(p=>pin3(p)),packet.files,'Original packet file order '+packet.id);eq(index.bounds,BOUNDS);eq(index.parts.map(x=>x.path),index.parts.map((x,i)=>PREFIX+'-'+packet.id+'-archive-part'+String(i+1).padStart(3,'0')+'.json'),'Exact packet part paths');const decoded=decodeV45Archive({index,readPart:(p,max)=>readPublic(p,max)});for(const[p,v]of decoded.files){assert.ok(!physical.has(p),'No duplicated packet path '+p);physical.set(p,v);}}
  eq(C.binding.path,D+'root-bindings-v1.json');const b=json(check(C.binding,physical.get(C.binding.path)));requireBinding(b);const J=p=>json(check(p,physical.get(p.path)));eq(C.packets.map(({id,files})=>({id,files})),packetPlan(b,J,C.binding),'Exact manifest-derived packet order');
  const logical=restore(physical,b),facts=verifyLogical(logical,b,readCurrent,C.binding);eq(C.facts,facts,'Recomputed complete data facts');eq(C.modules.map(p=>p.path),MODULES.map(publicModule));for(let i=0;i<b.modules.length;i++){const source=check(b.modules[i],logical.get(b.modules[i].path));eq(check(C.modules[i],readPublic(C.modules[i].path,1024*1024)),portable(source),'Reviewed current verifier module bytes');}
  eq(C.images.map(p=>p.path),b.images.map(p=>p.publicPath));for(const image of b.images){const p=C.images.find(p=>p.path===image.publicPath);eq(check(p,readPublic(p.path,BOUNDS.maxFileBytes)),check(image.source,logical.get(image.source.path)),'Actual representative raw bytes');}check(C.markdown,readPublic(C.markdown.path,1024*1024));return{accepted:true,facts,archive:{logicalFiles:logical.size,physicalFiles:physical.size,packets:C.packets.length,codecBounds:BOUNDS}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){eq(process.argv.slice(2),['--verify']);console.log(JSON.stringify(verify(process.cwd())));}
