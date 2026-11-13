import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeV24ObservationRows,readV24ObservationRow } from './hd-impact-v24-observation-row-stream.mjs';
async function temp(fn){const d=await fsp.mkdtemp(path.join(os.tmpdir(),'impact13-v24-selected-'));try{return await fn(path.join(d,'rows.jsonl'));}finally{await fsp.rm(d,{recursive:true,force:true});}}
function write(filePath,rows){return writeV24ObservationRows({filePath,rows,field:'selected-integrity',label:'controlled',expectedCount:rows.length});}
async function mutate(filePath,index,fn){const lines=(await fsp.readFile(filePath,'utf8')).trimEnd().split('\n'),v=JSON.parse(lines[index]);fn(v);lines[index]=JSON.stringify(v);await fsp.writeFile(filePath,lines.join('\n')+'\n');}
test('a valid selected first row cannot escape later footer rejection',()=>temp(async p=>{const receipt=write(p,[{selected:'valid'},{other:'valid'}]);await mutate(p,3,v=>{v.rowChainSha256='0'.repeat(64);});await assert.rejects(readV24ObservationRow({filePath:p,index:0,receipt}),/selected row file verification failed/);}));
test('a valid selected first row cannot escape later row rejection',()=>temp(async p=>{const receipt=write(p,[{selected:'valid'},{other:'valid'}]);await mutate(p,2,v=>{v.packet.value.other='forged';});await assert.rejects(readV24ObservationRow({filePath:p,index:0,receipt}),/selected row file verification failed/);}));
test('a selected row cannot escape mismatched whole-file receipt hash',()=>temp(async p=>{const receipt=write(p,[{selected:'valid'}]);await assert.rejects(readV24ObservationRow({filePath:p,index:0,receipt:{...receipt,sha256:'0'.repeat(64)}}),/selected row file verification failed/);}));
test('a completed prefix is not returned using a partial receipt',()=>temp(async p=>{const receipt=write(p,[{selected:'valid'},{bad:1n}]);assert.equal(receipt.rowsWritten,1);assert.equal(receipt.complete,false);assert.equal(receipt.sourceArrayMayBeDeleted,false);await assert.rejects(readV24ObservationRow({filePath:p,index:0,receipt}),/requires complete receipt/);}));
