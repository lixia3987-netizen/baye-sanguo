// Derive the original state-only ZHOUFENG entry; write a new build candidate only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){assert.ok(['--base','--spec','--output'].includes(args[i]));assert.ok(args[i+1]);}
const arg=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
const read=p=>fs.readFileSync(path.resolve(root,p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=JSON.parse(read(arg('--base','assets/hd-spe/manifest.json'))),spec=JSON.parse(read(arg('--spec','scripts/specs/hd-spe-zhoufeng.json')));
const output=path.resolve(root,arg('--output','build/hd-spe-zhoufeng-manifest.json'));
assert.ok(output.startsWith(path.resolve(root,'build')+path.sep),'Build-only output');
const lib=read('libs/dat-mod.lib');assert.equal(sha(lib),spec.libSha256);assert.equal(base.libSha256,spec.libSha256);assert.equal(base.axScale,1);
assert.equal(spec.schemaVersion,1);assert.equal(spec.kind,'zhoufeng-spe-entry-source-spec');
assert.deepEqual([spec.speId,spec.resourceIndex,spec.kindId,spec.startFrm,spec.endFrm,spec.skillId,spec.zhoufengVersion,spec.opaqueCoverageVersion],[39,0,2,0,7,14,1,1]);
assert.equal(spec.pictureSources.length,2);assert.equal(spec.pictureSha256.length,2);
function item(id,index=0){const a=lib.readUInt32LE((id-1)*4),length=lib.readUInt32LE(a),count=lib.readUInt16LE(a+6),fixed=lib.readUInt32LE(a+8);assert.equal(lib.readUInt16LE(a+4),id);assert.ok(index<count);const o=fixed?14+fixed*index:count===1?14:lib.readUInt32LE(a+14+8*index),n=fixed||(count===1?length-14:lib.readUInt32LE(a+18+8*index));assert.ok(a+length<=lib.length&&o+n<=length);return lib.subarray(a+o,a+o+n);}
function fnv(b){let h=2166136261;for(const v of b)h=Math.imul(h^v,16777619)>>>0;return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+b.length;}
function crc(b){let h=0xffffffff;for(const v of b){h^=v;for(let i=0;i<8;i++)h=(h>>>1)^((h&1)?0xedb88320:0);}return(h^0xffffffff)>>>0;}
function image(p,i){assert.equal(p,'assets/hd-spe/qimen-39/picture-'+i+'.png');const b=read(p);assert.equal(sha(b),spec.pictureSha256[i]);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let dimensions=null,end=false;for(let a=8;a<b.length;){const n=b.readUInt32BE(a),e=a+12+n,t=b.toString('ascii',a+4,a+8);assert.ok(e<=b.length);assert.equal(crc(b.subarray(a+4,e-4)),b.readUInt32BE(e-4));if(t==='IHDR'){assert.equal(a,8);assert.equal(n,13);assert.equal(b[a+16],8);assert.equal(b[a+17],2,'Unmodified opaque RGB original');assert.deepEqual([...b.subarray(a+18,a+21)],[0,0,0]);dimensions=[b.readUInt32BE(a+8),b.readUInt32BE(a+12)];assert.deepEqual(dimensions,[1254,1254]);}assert.notEqual(t,'tRNS');if(t==='IEND'){assert.equal(n,0);assert.equal(e,b.length);end=true;}a=e;}assert.ok(end&&dimensions);return dimensions;}
// SKILLEF is packed aim/state/U16 power/U16 destroy/useMp, then weather,
// enemy-land, own-land and enemy-arms. No inferred result numbers are added.
const skill=item(10).subarray(13*34,14*34);assert.equal(skill.length,34);assert.deepEqual([...skill.subarray(0,7)],[0,2,0,0,0,0,15]);
const b=item(39);assert.equal(b.length,spec.nativeLength);assert.equal(fnv(b),spec.nativeFingerprint);assert.deepEqual([...b.subarray(0,6)],[0,18,8,2,0,7]);
const units=Array.from({length:8},(_,frame)=>{const o=6+frame*5;assert.deepEqual([...b.subarray(o,o+5)],[0,0,25,25,frame%2]);return{frame,x:0,y:0,picIndex:frame%2};});
let at=46;const pictures=[];for(let i=0;i<2;i++){assert.deepEqual([b.readUInt16LE(at),b.readUInt16LE(at+2),b.readUInt16LE(at+4),b[at+6]],[64,64,1,0]);const[width,height]=image(spec.pictureSources[i],i);pictures.push({picIndex:i,src:spec.pictureSources[i],width,height,logicalWidth:64,logicalHeight:64,nativeWidth:64,nativeHeight:64,mask:0});at+=519;}assert.equal(at,b.length);
const entry={speId:39,resourceIndex:0,kind:2,startFrm:0,endFrm:7,count:8,picmax:2,resourceFingerprint:fnv(b),resourceLength:b.length,units,pictures,opaqueCoverageVersion:1,zhoufengVersion:1,skillId:14};
const old=base.entries.filter(e=>e.zhoufengVersion==null),existing=base.entries.filter(e=>e.zhoufengVersion!=null);assert.ok(existing.length<=1);if(existing.length)assert.deepEqual(existing[0],entry,'Refuse silently replacing a different curse14 entry');
assert.equal(old.filter(e=>e.speId===39).length,1,'Retain original QIMEN20 entry');
const result={...base,entries:[...old,entry]};assert.deepEqual(result.entries.filter(e=>e.zhoufengVersion==null),old);
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');fs.writeFileSync(output,bytes,{flag:'wx'});
console.log(JSON.stringify({path:path.relative(root,output).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes),entryCount:result.entries.length,unrelatedEntryCount:old.length,unrelatedDeepEqual:true,nativeParsed:true,actualPngCrc:true,productionEdited:false}));
