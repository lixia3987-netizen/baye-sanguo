import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {verifyOriginalSavePair} from '../../scripts/hd-mobile-system-runtime-oracle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),P='docs/validation/m5-wood67-june-preparation-20261024-v38',sha=b=>createHash('sha256').update(b).digest('hex');
function read(p,max=2*1024*1024){assert.ok(typeof p==='string'&&!path.isAbsolute(p)&&!p.replaceAll('\\','/').split('/').includes('..'));const f=path.resolve(root,p);assert.ok(f.startsWith(root+path.sep));const b=fs.readFileSync(f);assert.ok(b.length<=max);return b;}
const check=p=>{const b=read(p.path);assert.deepEqual([b.length,sha(b)],[p.bytes,p.sha256],p.path);return b;};
const pub=JSON.parse(read(P+'.json')),archive=JSON.parse(check(pub.archive)),z=check(archive.rawBundle),decoded=gunzipSync(z,{maxOutputLength:2*1024*1024});assert.deepEqual([decoded.length,sha(decoded)],[archive.rawBundle.decodedBytes,archive.rawBundle.decodedSha256]);
const bundle=JSON.parse(decoded);assert.equal(bundle.encoding,'base64-logical-source-validation-files');assert.equal(bundle.entries.length,archive.files.length);const raw=new Map();
for(const e of bundle.entries){assert.ok(!raw.has(e.path));const p=archive.files.find(p=>p.path===e.path);assert.ok(p);const b=Buffer.from(e.base64,'base64');assert.deepEqual([b.length,sha(b)],[p.bytes,p.sha256]);raw.set(e.path,b);}
for(const p of pub.sourcePins)check(p);for(const p of pub.inputPins)check(p);
const world=JSON.parse(check(pub.inputPins[1]));assert.deepEqual([world.period,world.king,world.year,world.month],[4,0,239,6]);assert.equal(verifyOriginalSavePair({sav0:check(pub.inputPins[2]).toString('hex'),sav1:check(pub.inputPins[3]).toString('hex'),world}).ok,true);
const full=JSON.parse(raw.get(pub.fullRegression.receipt.path));assert.deepEqual(full.terminal,{sessionId:70472,chunkId:'384214',exitCode:0});assert.deepEqual([full.registeredFiles,full.tests,full.pass,full.fail,full.cancelled,full.skipped,full.todo],[131,7052,7052,0,0,0,0]);for(const p of full.sources)check(p);
const log=gunzipSync(check(archive.fullLog.publishedGzip),{maxOutputLength:2*1024*1024});assert.deepEqual([log.length,sha(log)],[full.log.bytes,full.log.sha256]);for(const[k,v]of Object.entries({tests:7052,pass:7052,fail:0,cancelled:0,skipped:0,todo:0}))assert.match(log.toString('utf8').slice(-1800),new RegExp('^(?:#|ℹ) '+k+' '+v+'\\r?$','m'));
const migration=JSON.parse(raw.get(pub.controlledValidation.migrationReceipt.path));for(const m of migration.mapping){const a=raw.get(m.candidate.path),b=check(m.formal);assert.deepEqual([a.length,sha(a)],[m.candidate.bytes,m.candidate.sha256]);const clean=s=>s.toString().split(/\r?\n/).filter(l=>!l.startsWith('import ')).join('\n');assert.equal(clean(a),clean(b));}
const review=JSON.parse(raw.get(pub.independentReview.receipt.path));assert.equal(review.accepted,true);for(const m of review.mappings){check(m.formal);assert.equal(m.nonImportBodyIdentical,true);assert.equal(m.allowedImportAdaptationsOnly,true);}
for(const key of['actualPreparationAccepted','actualCastAccepted','hdAccepted','hd720Accepted','globalHdComplete','rngContinuityAccepted'])assert.equal(pub.independentFlags[key],false,key);
assert.equal(pub.independentFlags.sourcePreparationAccepted,true);assert.equal(pub.controlledValidation.registeredNewCases,84);assert.equal(pub.boundaries.portableClosedArchive,false);assert.equal(pub.boundaries.newGameInputs,0);assert.equal(pub.boundaries.newBrowserRuns,0);
const pin=p=>{const b=read(p);return{path:p,bytes:b.length,sha256:sha(b)}};
const result={schemaVersion:1,accepted:true,sourceOnly:true,publication:pin(P+'.json'),archive:pin(P+'-archive.json'),reader:pin(P+'-reader.mjs'),rawLogicalFiles:raw.size,allArchivedRawBytesReadBack:true,currentFormalAndPackagePinsExact:true,fullOriginalLogInflatedAndShaMatched:true,originalJuneFourPiecePackedProofAccepted:true,buildFormalNonImportBodyEqual:true,registeredFiles:131,tests:7052,newRegisteredDifferentCases:84,actualPreparationAccepted:false,actualCastAccepted:false,hd720Accepted:false,newGameInputs:0,newBrowserRuns:0,portableClosedArchive:false};
const target=path.resolve(root,P+'-readback.json'),bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');if(fs.existsSync(target))assert.deepEqual(fs.readFileSync(target),bytes);else fs.writeFileSync(target,bytes,{flag:'wx'});console.log(JSON.stringify(result));
