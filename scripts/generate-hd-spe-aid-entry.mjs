// Generate the authenticated AID manifest entry from its persistent source spec.
// Outputs are restricted to build; no browser, server or engine writes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const args=process.argv.slice(2),allowed=new Set(['--base','--spec','--output']);
for(let i=0;i<args.length;i+=2){assert.ok(allowed.has(args[i]));assert.ok(args[i+1]);}
const arg=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1]};
const read=p=>fs.readFileSync(path.resolve(root,p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const basePath=arg('--base','assets/hd-spe/manifest.json'),specPath=arg('--spec','scripts/specs/hd-spe-aid.json'),output=arg('--output','build/hd-spe-aid-manifest.json');
const target=path.resolve(root,output);assert.ok(target.startsWith(path.resolve(root,'build')+path.sep),'Build-only generator never writes production');
const base=JSON.parse(read(basePath)),spec=JSON.parse(read(specPath)),lib=read('libs/dat-mod.lib');
assert.equal(spec.kind,'aid-spe-entry-source-spec');assert.equal(spec.schemaVersion,1);assert.equal(hash(lib),spec.libSha256);assert.equal(base.libSha256,spec.libSha256);assert.equal(base.axScale,1);
assert.deepEqual([spec.speId,spec.resourceIndex,spec.kindId,spec.startFrm,spec.endFrm,spec.aidVersion,spec.opaqueCoverageVersion,spec.skillResultVersion],[41,0,2,0,7,1,1,1]);assert.deepEqual(spec.skillIds,[17,29]);
function item(id,index=0){const a=lib.readUInt32LE((id-1)*4),length=lib.readUInt32LE(a),count=lib.readUInt16LE(a+6),fixed=lib.readUInt32LE(a+8);assert.equal(lib.readUInt16LE(a+4),id);assert.ok(index<count);const o=fixed?14+fixed*index:count===1?14:lib.readUInt32LE(a+14+8*index),n=fixed||(count===1?length-14:lib.readUInt32LE(a+18+8*index));assert.ok(a+length<=lib.length&&o+n<=length);return lib.subarray(a+o,a+o+n);}
function fnv(b){let h=2166136261;for(const v of b)h=Math.imul(h^v,16777619)>>>0;return 'fnv1a32:'+h.toString(16).padStart(8,'0')+':'+b.length;}
function pic(b,o=0){const width=b.readUInt16LE(o),height=b.readUInt16LE(o+2),count=b.readUInt16LE(o+4),mask=b[o+6],bytes=7+Math.ceil(width/8)*height*(mask+1);assert.ok(o+bytes<=b.length);return {width,height,count,mask,bytes};}
function crc(b){let h=0xffffffff;for(const v of b){h^=v;for(let i=0;i<8;i++)h=(h>>>1)^((h&1)?0xedb88320:0);}return(h^0xffffffff)>>>0;}
function image(p,i){const b=read(p);assert.equal(hash(b),spec.pictureSha256[i]);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let dimensions=null,end=false;for(let a=8;a<b.length;){const n=b.readUInt32BE(a),e=a+12+n,t=b.toString('ascii',a+4,a+8);assert.ok(e<=b.length);assert.equal(crc(b.subarray(a+4,e-4)),b.readUInt32BE(e-4));if(t==='IHDR'){assert.equal(n,13);assert.equal(b[a+16],8);assert.equal(b[a+17],2,'Selected original RGB is opaque');assert.deepEqual([...b.subarray(a+18,a+21)],[0,0,0]);dimensions=[b.readUInt32BE(a+8),b.readUInt32BE(a+12)];}assert.notEqual(t,'tRNS');if(t==='IEND'){assert.equal(n,0);assert.equal(e,b.length);end=true;}a=e;}assert.ok(end&&dimensions);return dimensions;}
const b=item(41),count=b[2],picmax=b[3];assert.equal(fnv(b),spec.nativeFingerprint);assert.equal(b.length,spec.nativeLength);assert.deepEqual([...b.subarray(0,6)],[0,16,8,2,0,7]);
const units=Array.from({length:count},(_,frame)=>{const o=6+frame*5;assert.deepEqual([...b.subarray(o,o+5)],[0,0,20,20,frame%2]);return {frame,x:b[o],y:b[o+1],picIndex:b[o+4]};});
let o=6+count*5;const pictures=[];for(let i=0;i<picmax;i++){const p=pic(b,o),[width,height]=image(spec.pictureSources[i],i);assert.deepEqual([p.width,p.height,p.count,p.mask],[64,64,1,0]);pictures.push({picIndex:i,src:spec.pictureSources[i],width,height,logicalWidth:p.width,logicalHeight:p.height,nativeWidth:p.width,nativeHeight:p.height,mask:p.mask});o+=p.bytes;}assert.equal(o,b.length);
const nb=item(spec.number.id,spec.number.index),np=pic(nb);assert.equal(fnv(nb),spec.number.fingerprint);assert.deepEqual([np.width,np.height,np.count,np.mask,nb.length],[12,16,10,0,327]);
const entry={speId:41,resourceIndex:0,kind:2,startFrm:0,endFrm:7,count,picmax,resourceFingerprint:fnv(b),resourceLength:b.length,units,pictures,skillResultVersion:1,skillNumber:{id:15,resourceIndex:0,pictureIndex:0,nativeWidth:np.width,nativeHeight:np.height,count:np.count,mask:np.mask,x:0,y:0,resourceLength:nb.length,resourceFingerprint:fnv(nb)},opaqueCoverageVersion:1,aidVersion:1,skillIds:[17,29]};
const old=base.entries.filter(e=>e.speId!==41),aid=base.entries.filter(e=>e.speId===41);assert.ok(aid.length<=1);if(aid.length)assert.deepEqual(aid[0],entry,'Never silently replace a different41 entry');
const result={...base,entries:[...old,entry]};assert.deepEqual(result.entries.filter(e=>e.speId!==41),old);
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');fs.writeFileSync(target,bytes,{flag:'wx'});
console.log(JSON.stringify({path:path.relative(root,target).replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes),entryCount:result.entries.length,unrelatedEntryCount:old.length,unrelatedDeepEqual:true,nativeParsed:true,actualPngCrc:true,productionEdited:false}));
