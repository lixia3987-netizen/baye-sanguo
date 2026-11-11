import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {LOCKS} from './m5-native-input-queue-20261026-v69-v69-locks-v1.mjs';
export {LOCKS};
export const B='build/mobile-input-20261026-v69/',D=B+'evidence-source-v2/',PREFIX='docs/validation/m5-native-input-queue-20261026-v69';
export const BOUNDS=Object.freeze({maxPartBytes:8388608,maxSerializedBytes:67108864,maxNamedRawBytes:134217728,maxUniqueRawBytes:100663296,maxFileBytes:33554432,maxFiles:512,maxBlobs:512,maxParts:32});
export const MODULES=['v69-locks-v1.mjs','v69-core-v1.mjs','v69-views-v1.mjs','v69-facts-v1.mjs','maker-data-v1.mjs','v69-reader-v1.mjs'];
export const eq=(a,b,message='Exact evidence data')=>assert.ok(isDeepStrictEqual(a,b),message);
export const json=b=>JSON.parse(b.toString('utf8'));
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const pin=(p,b)=>({path:p,bytes:b.length,sha256:sha(b)});
export function relative(p){assert.equal(typeof p,'string');assert.ok(p&&!path.isAbsolute(p)&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'),'Safe relative evidence path '+p);return p;}
export function pin3(p,max=BOUNDS.maxFileBytes){assert.ok(p&&typeof p==='object','Pin object required');relative(p.path);assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&p.bytes<=max,'Bounded evidence pin '+p.path);assert.match(p.sha256,/^[0-9a-f]{64}$/,'Pin SHA '+p.path);return{path:p.path,bytes:p.bytes,sha256:p.sha256};}
export function check(p,b){assert.ok(Buffer.isBuffer(b),'Original bytes required '+p.path);eq(pin(p.path,b),pin3(p,32*BOUNDS.maxFileBytes),'Exact complete bytes '+p.path);return b;}
export function safeRead(root,p,max=BOUNDS.maxFileBytes){relative(p);assert.ok(max>0&&max<=BOUNDS.maxFileBytes,'Per-file bound unchanged');const base=fs.realpathSync.native(root);let q=base;const parts=p.split('/');for(let i=0;i<parts.length;i++){q=path.join(q,parts[i]);const s=fs.lstatSync(q);assert.ok(!s.isSymbolicLink(),'No symlink '+p);assert.ok(i===parts.length-1?s.isFile():s.isDirectory(),'Regular path '+p);}assert.ok(fs.realpathSync.native(q).startsWith(base+path.sep));const s=fs.lstatSync(q,{bigint:true});assert.ok(s.size<=BigInt(max),'Read bound '+p);const b=fs.readFileSync(q),z=fs.lstatSync(q,{bigint:true});eq([z.dev,z.ino,z.size,z.mtimeNs,z.ctimeNs],[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs],'Stable descriptor '+p);return b;}
export function uniquePins(rows){const m=new Map();for(const p of rows){pin3(p,32*BOUNDS.maxFileBytes);if(m.has(p.path))eq(m.get(p.path),p,'No conflicting same-path originals '+p.path);else m.set(p.path,p);}return [...m.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
export function tap(bytes){const out={};for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const m=[...bytes.toString('utf8').matchAll(new RegExp('^# '+k+' ([0-9.]+)\\r?$','gm'))];eq(m.length,1,'One terminal TAP footer '+k);out[k]=Number(m[0][1]);}return out;}
export function publicModule(name){return name==='v69-reader-v1.mjs'?PREFIX+'-verify.mjs':PREFIX+'-'+name;}
export function portable(bytes){
  const lines=bytes.toString('utf8').split('\n');
  return Buffer.from(lines.map(line=>{
    // Current verifier modules use single-line, unindented static imports.
    // Never rewrite our own function-body string literals or archived data.
    if(!line.startsWith('import '))return line;
    for(const name of MODULES)for(const q of ["'",'"'])
      line=line.replaceAll(q+'./'+name+q,q+'./'+path.basename(publicModule(name))+q);
    return line.replaceAll("'../../../docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs'","'./m5-quantity-ack-refresh-20261024-v45-verify.mjs'");
  }).join('\n'));
}
export function requireBinding(b){
  eq(b.schemaVersion,1,'Binding schema');eq(b.reviewed,true,'Root reviewed required');eq(b.draftOnly,false,'No pending draft publication');eq(b.prefix,PREFIX);eq(b.criticalPins,LOCKS.criticalPins,'Exact153 source vector');eq(b.fixedPins,LOCKS.fixedPins,'Exact fixed evidence');eq(b.parentBaseline,LOCKS.parentBaseline);
  eq(b.modules.map(p=>p.path),MODULES.map(n=>D+n),'Current reader module set');for(const p of b.modules)pin3(p);
  eq(b.cases.map(c=>c.id),['mobileBefore','mobileAfter','pc1080','pc720'],'Case order');for(const c of b.cases){eq(c.directory,LOCKS.caseDirectories[c.id]);eq(c.result,LOCKS.caseResults[c.id],'Fixed original case '+c.id);pin3(c.result,32*BOUNDS.maxFileBytes);pin3(c.sourceVerification);eq(c.sourceVerification.path,c.directory+'source-verification.json');assert.ok(c.pngs.length>0,'Actual case PNG list '+c.id);const mobile=c.id.startsWith('mobile'),pairs=mobile?[['executed-tool.mjs','scripts/test-hd-mobile-city-runtime.mjs'],['executed-equipment-helper.mjs','scripts/hd-person-equipment-runtime-checks.mjs'],['executed-preview-helper.mjs','scripts/hd-mobile-preview-runtime-checks.mjs'],['executed-resource-helper.mjs','scripts/hd-city-resource-runtime-checks.mjs']]:[['executed-tool.mjs','scripts/test-hd-person-equipment-runtime.mjs'],['executed-checks.mjs','scripts/hd-person-equipment-runtime-checks.mjs'],['executed-resource-helper.mjs','scripts/hd-city-resource-runtime-checks.mjs'],['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],['executed-json.mjs','scripts/hd-runtime-json.mjs']];eq(c.executed,pairs.map(([file,source])=>{const p=b.criticalPins.find(p=>p.path===source);assert.ok(p,'Execution source in153');return{file:{...p,path:c.directory+file},source:p};}),'Exact complete execution copies '+c.id);}
  for(const id of ['mobileBefore','mobileAfter'])eq(b.cases.find(c=>c.id===id).result,LOCKS.wholes[id],'Exact whole original '+id);
  eq(Object.keys(b.terminals).sort(),['full','maker','mobileAfter','mobileBefore','pc1080','pc720']);for(const[id,t]of Object.entries(b.terminals)){eq(t.closed,true,'Actual closed '+id);eq(t.exitCode,id==='mobileBefore'?1:0,'Original tool exit '+id);eq(t.sessionId,LOCKS.initials[id].sessionId);eq(t.initialChunk,LOCKS.initials[id].initialChunk);assert.match(t.terminalChunk,/^[0-9a-f]{6}$/);if(LOCKS.closedChunks[id])eq(t.terminalChunk,LOCKS.closedChunks[id]);}
  for(const id of ['mobileBefore','mobileAfter']){const c=b.cases.find(c=>c.id===id);eq(c.wholeChunks.input.path,D+id+'-input-v1.json');eq(c.wholeChunks.manifest.path,D+id+'-chunks-v1/manifest.json');}
  eq(b.maker.top.path,B+'maker-sem-timing-v1/result.json');eq(b.maker.top,LOCKS.makerTop);eq(b.maker.ownedExit,LOCKS.makerExit);eq(b.full.result.path,B+'full-default-v1.json');pin3(b.full.result);pin3(b.terminalProof);
  assert.ok(b.supportPins.length<=40,'Bounded root support sources');for(const p of b.supportPins){pin3(p);assert.ok(p.path.startsWith(D),'Evidence preparation source scope');}
  eq(b.images.map(x=>x.id),['pc1080','pc720','mobile844','mobile667']);for(const image of b.images){pin3(image.source);eq(image.publicPath,PREFIX+'-'+image.id+'.png');}
}
export function selectedData(b){return uniquePins([...b.criticalPins,...b.fixedPins,LOCKS.extraPortrait,...b.supportPins,...b.modules,b.terminalProof,...b.toolPins,...[b.full.result,b.full.before,b.full.stdout,b.full.stderr],...b.cases.flatMap(c=>[c.result,c.sourceVerification,...(c.console?[c.console]:[]),...c.executed.map(e=>e.file),...c.pngs,...(c.wholeChunks?[c.wholeChunks.input,c.wholeChunks.manifest]:[])]),...b.maker.dataPins,...b.maker.imagePins]);}
