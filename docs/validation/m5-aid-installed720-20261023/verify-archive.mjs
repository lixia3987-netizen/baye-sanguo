// Read-only original-byte archive verification. No browser, native input or extraction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gunzipSync,brotliDecompressSync} from 'node:zlib';

const base=path.dirname(fileURLToPath(import.meta.url));
const index=JSON.parse(fs.readFileSync(path.join(base,'runtime-index.json')));
const appendFile=path.join(base,'root-revalidation-index-v2.json');
const append=fs.existsSync(appendFile)?JSON.parse(fs.readFileSync(appendFile)):null;
const records=[...index.files,...(append?.files||[])];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let solid=null;
function originalSolid(){
  if(solid)return solid;
  const packed=fs.readFileSync(path.join(base,index.solid.file));
  assert.equal(packed.length,index.solid.bytes);
  assert.equal(sha(packed),index.solid.sha256);
  solid=brotliDecompressSync(packed);
  assert.equal(solid.length,index.solid.originalBytes);
  assert.equal(sha(solid),index.solid.originalSha256);
  return solid;
}
export function readArchivedOriginal(original){
  const record=records.find(f=>f.original===original);
  assert.ok(record,'Indexed original: '+original);
  let bytes;
  if(record.encoding==='solid-brotli-original-png'){
    assert.equal(record.archive,index.solid.file);
    const all=originalSolid();
    assert.ok(Number.isSafeInteger(record.offset)&&record.offset>=0&&record.offset+record.bytes<=all.length);
    bytes=all.subarray(record.offset,record.offset+record.bytes);
  }else{
    const packed=fs.readFileSync(path.join(base,record.archive));
    assert.equal(packed.length,record.archiveBytes);
    assert.equal(sha(packed),record.archiveSha256);
    bytes=record.encoding==='gzip-original-bytes'?gunzipSync(packed):packed;
  }
  assert.equal(bytes.length,record.bytes,original+' bytes');
  assert.equal(sha(bytes),record.sha256,original+' SHA256');
  return bytes;
}
export function verifyArchive(){
  for(const f of records)readArchivedOriginal(f.original);
  if(append){
    for(const p of [append.parentIndexUnmodified,append.parentSummaryUnmodified]){
      const bytes=fs.readFileSync(path.join(base,p.path.endsWith('/runtime-index.json')?'runtime-index.json':'../m5-aid-installed720-20261023.json'));
      assert.equal(bytes.length,p.bytes);assert.equal(sha(bytes),p.sha256);
    }
  }
  const all=originalSolid();
  for(const p of index.solid.entries){
    const bytes=all.subarray(p.offset,p.offset+p.bytes);
    assert.equal(bytes.length,p.bytes);assert.equal(sha(bytes),p.sha256);
    assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  }
  for(const p of index.previews){
    const bytes=fs.readFileSync(path.join(base,p.archive));
    assert.equal(bytes.length,p.bytes);assert.equal(sha(bytes),p.sha256);
    assert.deepEqual(bytes,readArchivedOriginal(p.original));
  }
  return{ok:true,logicalFiles:index.files.length,appendLogicalFiles:append?.files.length||0,solidUniquePngs:index.solid.entries.length,
    originalHdPngBytes:index.solid.originalBytes,packedHdPngBytes:index.solid.bytes,
    allOriginalByteHashesVerified:true,selectedHdReadbacks:index.selectedHdReadbacks,
    supplementaryFullPageScreenshotsOmitted:index.omittedSupplementaryFullPagePng.length,
    browserStarted:false,nativeInputs:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyArchive()));
