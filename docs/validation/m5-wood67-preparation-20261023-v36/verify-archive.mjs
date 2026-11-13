import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import{createHash}from'node:crypto';
import{gunzipSync}from'node:zlib';
import{fileURLToPath}from'node:url';
const base=path.dirname(fileURLToPath(import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const index=JSON.parse(fs.readFileSync(path.join(base,'runtime-index.json')));
export function readArchivedOriginal(originalPath){
 const r=index.records.find(x=>x.original.path===originalPath);assert.ok(r,'Explicit allowlisted original: '+originalPath);
 const absolute=path.resolve(base,r.archive.path);assert.ok(absolute.startsWith(base+path.sep));const z=fs.readFileSync(absolute);
 assert.equal(z.length,r.archive.bytes);assert.equal(hash(z),r.archive.sha256);const b=gunzipSync(z);assert.equal(b.length,r.original.bytes);assert.equal(hash(b),r.original.sha256);return b;
}
function pinned(p){const r=index.records.find(r=>r.original.bytes===p.bytes&&r.original.sha256===p.sha256);assert.ok(r,'Exact current/historical source pin '+p.path);return readArchivedOriginal(r.original.path);}
function migration(name){
 const m=JSON.parse(readArchivedOriginal(name));for(const p of m.pins){let s=pinned(p.candidate).toString();
  for(const a of p.adaptations){
   if(a.from){assert.equal(s.split(a.from).length-1,a.count);s=s.replaceAll(a.from,a.to);}
   else if(a.formatOnly){assert.ok(s.endsWith('\n\n'));assert.equal(p.formal.path,'scripts/test-hd-impact-v36-wood-march.mjs');assert.deepEqual(Buffer.from(s),pinned(p.priorFormalBeforeEofFix));s=s.slice(0,-2)+'\r\n';}
   else{assert.ok(a.testRunner);s="import test from 'node:test';\n"+s;const old="const tests=[];function test(name,work){work();tests.push(name);console.log('PASS',name);}",last="console.log(JSON.stringify({accepted:true,controlledTests:tests.length,actualGameExecuted:false,actualMarchAccepted:false,actualCastAccepted:false,hdAccepted:false}));";assert.ok(s.includes(old)&&s.includes(last));s=s.replace(old,'').replace(last,'');}
  }
  assert.deepEqual(Buffer.from(s),pinned(p.formal));
 }
 return m.pins.length;
}
export function verifyArchive(){
 for(const r of index.records)readArchivedOriginal(r.original.path);
 const receipt=JSON.parse(readArchivedOriginal('docs/validation/m5-wood67-preparation-20261023-v36/receipt.json'));
 const currentMigration=migration('build/v36-formal-migration-v2.json'),historicalMigration=migration('build/v36-formal-migration-v1.json');
 const log=readArchivedOriginal('build/hd-full-suite-20261023-v36b.log').toString();
 for(const[k,n]of Object.entries({tests:6931,pass:6931,fail:0,cancelled:0,skipped:0,todo:0}))assert.match(log,new RegExp('ℹ '+k+' '+n+'(?:\\r?\\n|$)'));
 assert.equal(receipt.fullRegression.terminal.sessionId,90741);assert.equal(receipt.fullRegression.terminal.chunkId,'0a7579');assert.equal(receipt.fullRegression.durationMs,199227.8585);
 assert.equal(receipt.counts.differentNew,136);assert.equal(receipt.scope.actualCastAccepted,false);assert.equal(receipt.scope.hdAccepted,false);
 const allow=JSON.parse(fs.readFileSync(path.join(base,'allowlist.json')));assert.deepEqual(index.records.map(r=>r.original.path),allow.archivedOriginalPaths);
 return{accepted:true,records:index.records.length,uniqueObjects:new Set(index.records.map(r=>r.archive.path)).size,currentMigration,historicalMigration,newDifferentCases:136,fullPass:6931,gameStarted:false,actualCastAccepted:false,hdAccepted:false,portableClosedArchive:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyArchive()));
