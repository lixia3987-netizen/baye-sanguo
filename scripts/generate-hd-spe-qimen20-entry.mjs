// Derive the original state-only QIMEN20 entry; write a new build candidate only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
const seen=new Set();for(let i=0;i<args.length;i+=2){assert.ok(['--base','--spec','--output'].includes(args[i]));assert.ok(args[i+1]&&!args[i+1].startsWith('--'));assert.ok(!seen.has(args[i]),'Duplicate CLI flag');seen.add(args[i]);}
const arg=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
const read=p=>fs.readFileSync(path.resolve(root,p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=JSON.parse(read(arg('--base','assets/hd-spe/manifest.json'))),spec=JSON.parse(read(arg('--spec','scripts/specs/hd-spe-qimen20.json')));
const output=path.resolve(root,arg('--output','build/hd-spe-qimen20-manifest.json'));
assert.ok(output.startsWith(path.resolve(root,'build')+path.sep),'Build-only output');
const lib=read('libs/dat-mod.lib');assert.equal(sha(lib),spec.libSha256);assert.equal(base.libSha256,spec.libSha256);assert.equal(base.axScale,1);
assert.equal(spec.schemaVersion,1);assert.equal(spec.kind,'qimen20-spe-entry-source-spec');
assert.deepEqual([spec.speId,spec.resourceIndex,spec.kindId,spec.startFrm,spec.endFrm,spec.skillId,spec.qimenVersion,spec.opaqueCoverageVersion],[39,0,2,0,7,20,1,1]);
assert.equal(spec.pictureSources.length,2);assert.equal(spec.pictureSha256.length,2);
function item(id,index=0){const a=lib.readUInt32LE((id-1)*4),length=lib.readUInt32LE(a),count=lib.readUInt16LE(a+6),fixed=lib.readUInt32LE(a+8);assert.equal(lib.readUInt16LE(a+4),id);assert.ok(index<count);const o=fixed?14+fixed*index:count===1?14:lib.readUInt32LE(a+14+8*index),n=fixed||(count===1?length-14:lib.readUInt32LE(a+18+8*index));assert.ok(a+length<=lib.length&&o+n<=length);return lib.subarray(a+o,a+o+n);}
function fnv(b){let h=2166136261;for(const v of b)h=Math.imul(h^v,16777619)>>>0;return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+b.length;}
function crc(b){let h=0xffffffff;for(const v of b){h^=v;for(let i=0;i<8;i++)h=(h>>>1)^((h&1)?0xedb88320:0);}return(h^0xffffffff)>>>0;}
function image(p,i){assert.equal(p,'assets/hd-spe/qimen-39/picture-'+i+'.png');const b=read(p);assert.equal(sha(b),spec.pictureSha256[i]);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let dimensions=null,end=false;for(let a=8;a<b.length;){const n=b.readUInt32BE(a),e=a+12+n,t=b.toString('ascii',a+4,a+8);assert.ok(e<=b.length);assert.equal(crc(b.subarray(a+4,e-4)),b.readUInt32BE(e-4));if(t==='IHDR'){assert.equal(a,8);assert.equal(n,13);assert.equal(b[a+16],8);assert.equal(b[a+17],2,'Unmodified opaque RGB original');assert.deepEqual([...b.subarray(a+18,a+21)],[0,0,0]);dimensions=[b.readUInt32BE(a+8),b.readUInt32BE(a+12)];assert.deepEqual(dimensions,[1254,1254]);}assert.notEqual(t,'tRNS');if(t==='IEND'){assert.equal(n,0);assert.equal(e,b.length);end=true;}a=e;}assert.ok(end&&dimensions);return dimensions;}
// SKILLEF is packed aim/state/U16 power/U16 destroy/useMp, then weather,
// enemy-land, own-land and enemy-arms. No inferred result numbers are added.
const skill=item(10).subarray(19*34,20*34);assert.equal(skill.length,34);assert.deepEqual([...skill.subarray(0,7)],[1,4,0,0,0,0,20]);
assert.equal(skill.toString('hex'),spec.skillRecordHex,'Exact packed aim/state/power/destroy/MP/weather/eland/oland/earm record');
const skillName=item(11,19),nameEnd=skillName.indexOf(0);assert.equal(new TextDecoder('gbk',{fatal:true}).decode(skillName.subarray(0,nameEnd<0?skillName.length:nameEnd)), '奇门');
// Optional IFACE items22..26 are absent in the original LIB; use actual C defaults,
// never zero-filled override data. This is static provenance, not a cast observation.
const ifaceAddress=lib.readUInt32LE(4),ifaceCount=lib.readUInt16LE(ifaceAddress+6);assert.equal(ifaceCount,16);assert.equal(spec.nativeFallback.ifaceItemCount,ifaceCount);
const constants=read('vendor/iBaye/src/data/pconst.h').toString('utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const ids={};let next=0;for(const token of constants.match(/enum\s*\{([\s\S]*?)\}/)[1].split(',')){const m=token.trim().match(/^(\w+)(?:\s*=\s*(\d+))?$/);if(m){next=m[2]?Number(m[2]):next+1;ids[m[1]]=next;}}
const native=read('vendor/iBaye/src/FightSub.c').toString('utf8'),defs=read('vendor/iBaye/src/baye/consdef.h').toString('utf8');
assert.ok(/^\s*#define\s+FENG_SPE\s+39\b/m.test(defs));
for(const [name,index,token,value]of [['dJNSpeId',22,'FENG_SPE',39],['dJNSpeSFrm',23,'0',0],['dJNSpeEFrm',24,'7',7],['dJNSpeSX',25,'33',33],['dJNMode',26,'0',0]]){
 const match=native.match(new RegExp('static\\s+U8\\s+'+name+'\\[JN_MAX\\]\\s*=\\s*\\{([^}]+)\\}'));assert.ok(match);const tokens=match[1].split(',').map(v=>v.trim());assert.equal(tokens.length,29);assert.equal(tokens[19],token);assert.equal(ids['k'+name],index);assert.ok(index>ifaceCount);assert.deepEqual(spec.nativeFallback[name],{nativeItem:index,token,value});
 assert.ok(native.includes('ResItemGetN(IFACE_CONID, k'+name+', '+name+', sizeof('+name+'));'));
}

const b=item(39);assert.equal(b.length,spec.nativeLength);assert.equal(fnv(b),spec.nativeFingerprint);assert.deepEqual([...b.subarray(0,6)],[0,18,8,2,0,7]);
const units=Array.from({length:8},(_,frame)=>{const o=6+frame*5;assert.deepEqual([...b.subarray(o,o+5)],[0,0,25,25,frame%2]);return{frame,x:0,y:0,picIndex:frame%2};});
let at=46;const pictures=[];for(let i=0;i<2;i++){assert.deepEqual([b.readUInt16LE(at),b.readUInt16LE(at+2),b.readUInt16LE(at+4),b[at+6]],[64,64,1,0]);const[width,height]=image(spec.pictureSources[i],i);pictures.push({picIndex:i,src:spec.pictureSources[i],width,height,logicalWidth:64,logicalHeight:64,nativeWidth:64,nativeHeight:64,mask:0});at+=519;}assert.equal(at,b.length);
const entry={speId:39,resourceIndex:0,kind:2,startFrm:0,endFrm:7,count:8,picmax:2,resourceFingerprint:fnv(b),resourceLength:b.length,units,pictures,opaqueCoverageVersion:1,qimenVersion:1,skillId:20};
const index=spec.upgradeEntryIndex;assert.equal(index,42);assert.equal(base.entries.length,spec.entryCount);assert.equal(spec.entryCount,52);
assert.equal(base.entries.filter(e=>e.speId===39).length,3);assert.equal(base.entries.filter(e=>e.zhoufengVersion===1&&e.skillId===14).length,1);assert.equal(base.entries.filter(e=>e.dingshenVersion===1&&e.skillId===15).length,1);
const previous=base.entries[index];assert.equal(previous.speId,39);
if(previous.qimenVersion!=null)assert.deepEqual(previous,entry,'Refuse replacing a different QIMEN20 entry');
else assert.equal(sha(Buffer.from(JSON.stringify(previous))),spec.previousEntrySha256,'Exact legacy QIMEN entry');
const old=base.entries.filter((_,i)=>i!==index);assert.equal(old.length,spec.unrelatedEntryCount);assert.equal(old.length,51);assert.equal(sha(Buffer.from(JSON.stringify(old))),spec.unrelatedEntriesSha256,'Every other51 entry retains its original position');
const result={...base,entries:base.entries.map((v,i)=>i===index?entry:v)};assert.deepEqual(result.entries.filter((_,i)=>i!==index),old);
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');fs.writeFileSync(output,bytes,{flag:'wx'});
console.log(JSON.stringify({path:path.relative(root,output).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes),entryCount:result.entries.length,unrelatedEntryCount:old.length,unrelatedDeepEqual:true,nativeParsed:true,nativeStaticFallbackVerified:true,actualPngCrc:true,actualCastAccepted:false,hdAccepted:false,productionEdited:false}));
