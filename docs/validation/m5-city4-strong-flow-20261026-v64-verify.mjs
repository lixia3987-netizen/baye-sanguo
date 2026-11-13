/** SOURCE ONLY. Read-only evidence; no candidate/helper/test import or run.
 * Actual root receipt pins and complete tool terminals are fixed below. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {isDeepStrictEqual} from 'node:util';
import {decodeV45Archive,v45ReadBounded,v45Pin,v45Relative,V45_BOUNDS} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
export const V64_BUILD='build/impact-skill-20261014/',V64_TOOLS=V64_BUILD+'v64-source-publication/',V64_PREFIX='docs/validation/m5-city4-strong-flow-20261026-v64';
export const V64_CODEC='docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs',V64_BINDINGS=V64_BUILD+'v64-strong-flow-publication-bindings-v1.json';
export const V64_READER=V64_TOOLS+'v64-strong-flow-reader-v2.mjs',V64_PUBLISHER=V64_TOOLS+'publish-v64-strong-flow-v2.mjs',V64_INTEGRATION=V64_BUILD+'v64-runtime-source-integration-v1.json',V64_EPOCH=V64_BUILD+'v64-pre-integration-source-epoch-v1/source-epoch-v1.json';
export const V64_PREP=V64_BUILD+'city4-formal-runtime-preparation-v3/',V64_PARENT_COMMIT='8399c30b411e3312da1b100387b930e7d5f647f8';
const P57='docs/validation/m5-wood-city4-recovery-20261024-v57',P63='docs/validation/m5-city4-readonly-flow-20261026-v63';
export const V64_MAIN_PINS=Object.freeze([
 {path:P57+'.json',bytes:379062,sha256:'70949f4f2edb9b4564e37b151add6e551d7cb3f010d6a8ccb70a387847c59f1a'},
 {path:P57+'-latest-world.json',bytes:148004,sha256:'58f8ac8d6366c09023a834995bde26bd0973e32a1b12292d463f1644b983c1f6'},
 {path:P57+'-sango0.sav',bytes:8221,sha256:'122a72b600bbee49d734f0420731b7be7895af0eaf222741f6daee6eaae09d2b'},
 {path:P57+'-sango1.sav',bytes:4840,sha256:'f3b6f39a2433f88abaef52e921c65e7d607d6752620762927f2b542f74f27353'},
 {path:P57+'-archive-index.json',bytes:151295,sha256:'6f072b12b1e4ac75c8b818497536e3bffd69f23cb6e7cf4bc9371aab500c857a'},
 {path:P57+'-archive-part001.json',bytes:8142224,sha256:'8357cab4cb1ee68aa3d8c06f8df3b4ed6811ded199e49185324e53593eafe94b'},
 {path:P57+'-archive-part002.json',bytes:8377587,sha256:'d348517c680ec688f5f1cbe5d5507087b21fdfc0bb6a17064cdf2ec25e61efb8'},
 {path:P57+'-archive-part003.json',bytes:2359629,sha256:'5ef83127046a14c813b301096bc354a83835cf94e9db0908192f077da612448b'},
 {path:'libs/dat-mod.lib',bytes:207195,sha256:'3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e'}
]);
export const V64_PARENT_PROOF=Object.freeze([
 {path:P63+'.json',bytes:289923,sha256:'ea12e0152baf6aa56e83fa292a11a9fee16bcbc39ce11194ec7562ef8467626f'},
 {path:P63+'-archive-index.json',bytes:170892,sha256:'68de98551ee001aba73e8f69a2e6f7bed315e2998697896389caa8e0d83953b7'},
 {path:P63+'-archive-part001.json',bytes:5082004,sha256:'b277298059e5231b3c5fafd4a35ee9f5b8e876edfb708244904f948fd4444ec6'},
 {path:P63+'-verify.mjs',bytes:20945,sha256:'6dfdf8771241ba197c82b4701572c934349cefcadfcb32d2e66c4aeb97963c4d'},
 {path:P63+'.md',bytes:957,sha256:'3b5a63c1406e549711b74e83848987e931e98d4cb24046d5950f381198bf3185'}
]);
export const V64_EXTERNAL_PINS=Object.freeze([...V64_MAIN_PINS,...V64_PARENT_PROOF]);
export const V64_FORMAL=Object.freeze([
 {path:'scripts/hd-wood-city4-observer-transition.mjs',bytes:44730,sha256:'0cf464ba123981dc69f91a53a2e85340d51973a24d0576d209f7a499ca248940'},
 {path:'scripts/hd-wood-city4-first-own.mjs',bytes:15711,sha256:'aee024367957496800db099fbdc3b6bce55e5e3b5d09550be709c63e4783e624'},
 {path:'scripts/hd-wood-city4-hd-action.mjs',bytes:56045,sha256:'c9ec6de5f4a59d2674c592d9e8bfdaaab8d79f5ba470e73c4bd42a0a30e01ac8'}
]);
export const V64_OLD=Object.freeze([
 {source:V64_FORMAL[0].path,path:V64_BUILD+'v64-pre-integration-source-epoch-v1/hd-wood-city4-observer-transition.mjs',bytes:35928,sha256:'53449bbe50eb2ccc6af075705cba1948b9cd66c6fe525e91a060cf29c9deaf2d'},
 {source:V64_FORMAL[1].path,path:V64_BUILD+'v64-pre-integration-source-epoch-v1/hd-wood-city4-first-own.mjs',bytes:13170,sha256:'5db79384b9e1e73257598df94a29997e0f99b8a3f07129264a911dde7e990fb7'},
 {source:V64_FORMAL[2].path,path:V64_BUILD+'v64-pre-integration-source-epoch-v1/hd-wood-city4-hd-action.mjs',bytes:56086,sha256:'4ea3eedb93041e33df33f35119d97ee7baa4b89c3e948c04234564e56d20d021'},
 {source:'.gitattributes',path:V64_BUILD+'v64-pre-integration-source-epoch-v1/gitattributes',bytes:38888,sha256:'13ef1e6ec22851d3be8a63f336942487584fa11f1823e0333b333a605e4fbb0f'}
]);
export const V64_PACKAGE=Object.freeze({path:'package.json',bytes:21183,sha256:'809fd447dd1177d6af707c189c4a0408011c1bfe5a78816012a21a09bc7a140d'});
export const V64_SYNTAX_TEST=Object.freeze({path:'scripts/test-hd-wood-city4-hd-action.mjs',bytes:2284,sha256:'2261a0904b61a9905e2d028c7191a81180ae5304468b733babe80ef8edf32f8b'});
export const V64_PREP_PINS=Object.freeze([
 {path:V64_PREP+'source-replacement-manifest-v1.json',bytes:6855,sha256:'afbf9cee349a0a047f158dd6f6c714833a6fc6a3581115a7c8c2aab960de53a7'},
 {path:V64_PREP+'source-inverse-v1.json',bytes:2046,sha256:'772fa4bc6dfdd124802e2878e15cf89bad55c1eabbbbfca76c74c67a6a80e126'},
 {path:V64_PREP+'source-preparation-v1.json',bytes:5168,sha256:'faec680aaeb583bde87abeafff7bde6a0e92a27d5391563d4506bf34edf78996'}
]);
// Previously pending slots now bind the original CLOSED root processes. Both
// complete byte pins and complete terminal objects are immutable literal data.
export const V64_FUTURE_PINS=Object.freeze({
 integration:Object.freeze({path:V64_INTEGRATION,bytes:10203,sha256:'2c52954afe9fd2e5bee4fce7bd20471c81a9a40f5323b1227c5a42d3a9309456'}),
 formalSyntax:Object.freeze({path:V64_BUILD+'v64-formal-expression-syntax-v1.json',bytes:129428,sha256:'086fa23b21fa24b1f83b5541a12a656eebda7a78882f49d2413e9a956d6cbdef'}),
 close:Object.freeze({path:V64_BUILD+'v64-close5-controls-v1.json',bytes:131359,sha256:'779b471f6a673748481c5752b8e5efe909cb326f24beb00644769be8ecfdf02a'})
});
export const V64_FROZEN_TERMINALS=Object.freeze({
 integration:Object.freeze({closed:true,terminalChunk:'8fa6be',exitCode:0}),
 formalSyntax:Object.freeze({closed:true,terminalChunk:'f7147a',exitCode:0}),
 close:Object.freeze({closed:true,sessionId:55551,initialChunk:'e6d1af',terminalChunk:'6b6d1a',exitCode:0})
});
export const V64_FIXED_RECEIPTS=Object.freeze({
 epoch:{path:V64_EPOCH,bytes:1559,sha256:'e8a3769a327dc944e60b73bad8f0eff0c9603e402ce082a26f10ed3ff2e136ee'},
 normal:{path:V64_BUILD+'v64-strong-normal-v1.json',bytes:130874,sha256:'708dc2b9e7ecea61234314bf78b4e6dae830940f8d21b0c3d2eb83a5c5f5ded2'},
 strong:{path:V64_BUILD+'v64-strong-strong-v1.json',bytes:130894,sha256:'f65c870e5e10a8ab9e4b830c09749fcb9cc4e146371348dcc4bb76b6e86ba174'},
 unsafeWitness:{path:V64_BUILD+'v64-old-strong4-unsafe-witness-v1.json',bytes:130174,sha256:'c2ad2dc7251e34972a7d92ef8b010f9abf30503cc2f3e9da1c13d5d7bf0373a0'},
 parentBaseline:{path:V64_BUILD+'v63-read-flow-full-v1.json',bytes:129441,sha256:'1744f496c1082a29bac258b64d2ceae52c7bbe6d96f4a121a66e982df059964a'}
});
export const V64_LANES=Object.freeze({formalSyntax:['v64-formal-expression-syntax-v1.json',3,'final'],normal:['v64-strong-normal-v1.json',1,'parent'],strong:['v64-strong-strong-v1.json',10,'parent'],close:['v64-close5-controls-v1.json',12,'parent'],unsafeWitness:['v64-old-strong4-unsafe-witness-v1.json',1,'parent'],parentBaseline:['v63-read-flow-full-v1.json',7905,'parent']});
export const V64_REQUIRED_SUPPORT=Object.freeze([
 ...V64_PREP_PINS.map(p=>p.path),V64_BUILD+'integrate-v64-runtime-v1.mjs',
 V64_BUILD+'city4-hd-wood-action-candidate-v6/source-inverse-v1.json',V64_BUILD+'v64-strong5-static-peer-v1.json',
 V64_BUILD+'city4-end-battle-close-candidate-v5/mechanical-close4-inverse-v1.json',V64_BUILD+'v64-close5-root-preparation-v1.json',
 V64_BUILD+'city4-end-battle-close-controls-candidate-v5/test-city4-p57-close-v5.mjs',V64_BUILD+'city4-end-battle-close-controls-candidate-v5/test-city4-p57-close-v5-hour-v1.mjs',
 V64_BUILD+'v64-release5-owned7-static-peer-v1.json',V64_BUILD+'v64-natural-host3-static-peer-v1.json',V64_BUILD+'v64-natural-settlement-composition-review-v1.md',
 V64_BUILD+'city4-end-battle-close-candidate-v5/city4-end-battle-close-v5.mjs',V64_BUILD+'city4-end-terminal-release-candidate-v5/city4-end-terminal-release-v5.mjs',
 V64_BUILD+'city4-owned-transport-candidate-v7/city4-owned-transport-v7.mjs',V64_BUILD+'city4-normal-round-host-candidate-v3/city4-normal-round-host-v3.mjs',
 V64_BUILD+'city4-normal-round-host-candidate-v3/fixed-node-dependencies-v3.json',V64_BUILD+'city4-normal-round-cli-candidate-v3/city4-normal-round-cli-v3.mjs',
 V64_BUILD+'city4-normal-round-cli-candidate-v2/city4-command-byte-protocol-v1.mjs',V64_BUILD+'v64-source-publication-static-peer-v1.json'
]);
export const V64_FUTURE_COMPOSITION=Object.freeze([
 {path:V64_BUILD+'city4-end-battle-close-candidate-v5/city4-end-battle-close-v5.mjs',bytes:40612,sha256:'e585675bea2fc0cb192594f529962a0bcf9c4d3f6f2abf556f2a888dcc04bf66'},
 {path:V64_BUILD+'city4-end-terminal-release-candidate-v5/city4-end-terminal-release-v5.mjs',bytes:28723,sha256:'460d0577b9d23174bca4ba3d2310b9d6b2c3893cc82b6a7303d7ff4f2873076b'},
 {path:V64_BUILD+'city4-owned-transport-candidate-v7/city4-owned-transport-v7.mjs',bytes:44581,sha256:'8a507d922492bbaf24647ecd6d0d60f448ab15f3b02c4c3d268e46b4588cb9fa'},
 {path:V64_BUILD+'city4-normal-round-host-candidate-v3/city4-normal-round-host-v3.mjs',bytes:17193,sha256:'5528d39df7fdedfd2ed8bac0cacfcde6f9b224d99c78280ea508c8741a6b930f'},
 {path:V64_BUILD+'city4-normal-round-host-candidate-v3/fixed-node-dependencies-v3.json',bytes:9356,sha256:'332562c0aee349d99fdf65225ec70142db62cbcf61dc3df69c03c9883bac8751'},
 {path:V64_BUILD+'city4-normal-round-cli-candidate-v3/city4-normal-round-cli-v3.mjs',bytes:7653,sha256:'f30264e33697bf842aa43cb4b799db902913c1eee975dac3ca370b27b896ac04'}
]);
export const V64_FIXED_SUPPORT=Object.freeze([
 {path:V64_BUILD+'city4-hd-wood-action-candidate-v6/source-inverse-v1.json',bytes:5969,sha256:'75fa229fcd07de45bec684f0355f5b0a393a7be8a9e795e72c33f11c19a87947'},
 {path:V64_BUILD+'v64-strong5-static-peer-v1.json',bytes:6562,sha256:'f539dd707cedbb446fdb6f53ecddd27e47ce3fc5ef4fccc3ba5aace9de846c68'},
 {path:V64_BUILD+'city4-end-battle-close-candidate-v5/mechanical-close4-inverse-v1.json',bytes:3800,sha256:'77040032ae42cb5034fc0b1c01dc7ab7b64d63392e029c77debcb3f0d5f5aa45'},
 {path:V64_BUILD+'v64-release5-owned7-static-peer-v1.json',bytes:6802,sha256:'1bc53ba43ee3ed5dd9e0f2cd6a7fd597fca88243792bb3abbe97fe94a91bc04e'},
 {path:V64_BUILD+'v64-natural-host3-static-peer-v1.json',bytes:21222,sha256:'d500991a0188d9930e4372cfb77f4ed437f5a67deeea8ba1b8913a56e4de2e52'}
]);
const eq=(a,b,m='Complete V64 evidence equality')=>assert.ok(isDeepStrictEqual(a,b),m),json=b=>JSON.parse(b.toString('utf8'));
export const v64Pin3=({path,bytes,sha256})=>({path,bytes,sha256});
export function v64Check(p,b){v45Relative(p.path);assert.ok(Buffer.isBuffer(b),'Whole named bytes: '+p.path);eq(v45Pin(p.path,b),v64Pin3(p),'Exact byte/SHA: '+p.path);return b;}
export function v64Vector(rows){assert.ok(Array.isArray(rows)&&rows.length>0&&rows.length<=4096);const seen=new Set();return rows.map(p=>{v45Relative(p.path);assert.ok(!seen.has(p.path));seen.add(p.path);assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&p.bytes<=V45_BOUNDS.maxFileBytes);assert.match(p.sha256,/^[0-9a-f]{64}$/);return v64Pin3(p);});}
export function v64SafeArchivePath(p){v45Relative(p);assert.ok(!V64_EXTERNAL_PINS.some(q=>q.path===p),'P57 nine and parent five proofs remain external');assert.ok(!p.split('/').some(s=>/profile/i.test(s))&&!/(?:^|\/)[^/]*-actual(?:-|\/)/.test(p)&&!/-archive-(?:index|part[0-9]+)\.json$/.test(p),'No old actual/profile/archive repack');return p;}
export function v64Terminal(t,exit){assert.ok(t&&typeof t==='object');eq(t.closed,true);eq(t.exitCode,exit);assert.match(t.terminalChunk,/^[0-9a-f]{6}$/);if(Object.hasOwn(t,'sessionId')){assert.ok(Number.isSafeInteger(t.sessionId)&&t.sessionId>0);assert.match(t.initialChunk,/^[0-9a-f]{6}$/);}else if(Object.hasOwn(t,'initialChunk'))assert.match(t.initialChunk,/^[0-9a-f]{6}$/);}
export function v64Scope(){return{sourceOnly:true,publishedNewMainInput:false,newBrowserRuns:0,newNativeInputs:0,newPublicLoads:0,newPublicSaves:0,newMarches:0,newEnd:0,actualIncomeObserved:false,actualPublicSaveAccepted:false,actualBattleAccepted:false,actualCastAccepted:false,cleanupAuthorized:false,sessionReleaseAllowed:false,maximumActualEnd:0,actualCliRun:false,completeCliRuntimeAccepted:false,hdAccepted:false,globalHdComplete:false};}
export function v64AttributesAppend(){return[['json','-text whitespace=cr-at-eol'],['mjs','-text whitespace=cr-at-eol'],['md','-text whitespace=cr-at-eol'],['gz','-text'],['sav','-text'],['png','-text']].map(([ext,flags])=>'\n/'+V64_PREFIX+'*.'+ext+' '+flags).join('')+'\n';}
export function v64BoundLanes(b){return{...b.fresh,unsafeWitness:b.unsafeWitness,parentBaseline:b.parentBaseline};}
export function v64CurrentVector(receipts,extra=[]){const rows=new Map();function add(p){const old=rows.get(p.path);if(old)eq(old,p,'Only the original four source paths have parent aliases: '+p.path);else rows.set(p.path,p);}for(const[name,r]of Object.entries(receipts))for(const p of v64Vector(r.sources)){if(name!=='formalSyntax'&&V64_OLD.some(o=>o.source===p.path))continue;add(p);}for(const p of extra)add(v64Pin3(p));return[...rows.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
function rawSummary(bytes){const s=bytes.toString('utf8').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''),out={};for(const k of['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const m=[...s.matchAll(new RegExp('^# '+k+' ([0-9.]+)\\r?$','gm'))];eq(m.length,1,'Exactly one complete raw TAP terminal: '+k);out[k]=Number(m[0][1]);assert.ok(Number.isFinite(out[k])&&out[k]>=0);if(k!=='duration_ms')assert.ok(Number.isSafeInteger(out[k]));}return out;}
function time(value,label){assert.ok(typeof value==='string'&&Number.isFinite(Date.parse(value)),label);return Date.parse(value);}
function expectedPin(name){const pin=V64_FIXED_RECEIPTS[name]??V64_FUTURE_PINS[name];assert.ok(pin,'Required frozen literal root pin: '+name);return pin;}
function readInertStatus(pin,get){if(pin===null)return{statusCaptureBound:false,completeCliRuntimeAccepted:false,actualRunAccepted:false};eq(pin.path,V64_BUILD+'v64-cli3-inert-status-tool-v1.json');const r=json(get(pin));eq(r.kind,'actual-fixed-cli-inert-STATUS-tool-capture');eq([r.sessionId,r.initialChunk,r.command,r.result.chunk_id,r.result.session_id],[91062,'6dafe3','STATUS','964ed9',91062]);for(const k of['newGameCommandSent','newBrowserRunRequested','newEndRequested'])eq(r[k],false);assert.ok(typeof r.result.output==='string'&&r.result.output.includes('"event":"STATUS"')&&r.result.output.includes('"runUsed":false')&&r.result.output.includes('"hasOwnedSession":false'));return{statusCaptureBound:true,sessionId:91062,initialChunk:'6dafe3',statusChunk:'964ed9',runUsed:false,hasOwnedSession:false,statusCaptureIsClosedTerminal:false,completeCliRuntimeAccepted:false,actualRunAccepted:false};}
export function verifyV64SourceEvidence({files,canonical:C,readCurrent}){
 const get=p=>v64Check(p,files.get(p.path)),J=p=>json(get(p)),T=p=>get(p).toString('utf8');
 eq(C.schemaVersion,1);eq(C.prefix,V64_PREFIX);eq(C.kind,'city4-strong-flow-source-only');eq(C.scope,v64Scope());eq(C.parentCommit,V64_PARENT_COMMIT);eq(C.externalInputPins,V64_MAIN_PINS.map(v64Pin3));eq(C.externalParentProofPins,V64_PARENT_PROOF.map(v64Pin3));eq(C.main,{kind:'retained-prior',prefix:P57,inputPins:V64_MAIN_PINS.map(v64Pin3)});
 eq(v64Vector(C.archivePins),[...files].map(([p,b])=>v45Pin(p,b)).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0));for(const p of C.archivePins){v64SafeArchivePath(p.path);get(p);}for(const p of V64_EXTERNAL_PINS)v64Check(p,readCurrent(p.path,Math.max(1,p.bytes)));
 const binding=J(C.bindings);eq(C.bindings.path,V64_BINDINGS);eq(binding.schemaVersion,1);eq(binding.kind,C.kind);eq(binding.draftOnly,false);eq(binding.sourceOnly,true);eq(binding.prefix,V64_PREFIX);eq(binding.parentCommit,V64_PARENT_COMMIT);eq(binding.fresh,C.fresh);eq(binding.unsafeWitness,C.unsafeWitness);eq(binding.parentBaseline,C.parentBaseline);eq(binding.inertCliStatus,C.inertCliStatus);eq(binding.scope,v64Scope());eq(binding.formalFinal,C.formalSources);eq(binding.unchanged,{package:V64_PACKAGE,portableTest:V64_SYNTAX_TEST});eq(binding.externalParentProofPins,C.externalParentProofPins);
 eq(binding.readerSource,C.supportPins.find(p=>p.path===V64_READER));eq(binding.publisherSource,C.supportPins.find(p=>p.path===V64_PUBLISHER));eq(binding.integration,C.integration);eq(binding.integrationTerminal,C.integrationTerminal);eq(binding.epoch,C.epoch);eq(binding.epochTerminal,C.epochTerminal);
 eq(C.epoch,expectedPin('epoch'));eq(C.integration,expectedPin('integration'));v64Terminal(C.epochTerminal,0);eq(C.epochTerminal,{closed:true,terminalChunk:'80f816',exitCode:0});v64Terminal(C.integrationTerminal,0);eq(C.integrationTerminal,V64_FROZEN_TERMINALS.integration,'Complete original integration tool terminal');
 const E=J(C.epoch),I=J(C.integration);eq(E.schemaVersion,1);eq(E.parentCommit,V64_PARENT_COMMIT);eq(E.sources,V64_OLD);eq(E.packageUnchanged,V64_PACKAGE);eq(E.defaultRegisteredFiles,149);eq(E.newInputs,0);for(const p of V64_OLD)get(p);
 const formal=new Map(v64Vector(C.formalSources).map(p=>[p.path,p]));eq([...formal.keys()],[...V64_FORMAL.map(p=>p.path),'.gitattributes']);for(const p of V64_FORMAL)eq(formal.get(p.path),p);get(V64_PACKAGE);get(V64_SYNTAX_TEST);eq(T(formal.get('.gitattributes')),T(V64_OLD[3])+v64AttributesAppend(),'Only append the six fixed V64 prefix patterns');
 const M=J(V64_PREP_PINS[0]);for(const p of V64_PREP_PINS){get(p);eq(binding.preparation[p===V64_PREP_PINS[0]?'manifest':p===V64_PREP_PINS[1]?'inverse':'record'],p);}eq(M.sourceFiles.length,3);let rules=0,occurrences=0;for(const f of M.sourceFiles){get(f.source);get(f.prepared);let reconstructed=T(f.prepared);for(const r of [...f.replacements].reverse()){eq(reconstructed.split(r.to).length-1,r.count,'Exact whole import inverse count');reconstructed=reconstructed.split(r.to).join(r.from);rules++;occurrences+=r.count;}eq(Buffer.from(reconstructed),get(f.source),'Whole candidate bytes recovered from prepared formal source');const target=formal.get(f.prepared.intendedTrackedPath);assert.ok(target);eq(get(target),get(f.prepared),'Prepared source equals current formal source');}eq([rules,occurrences],[16,18]);
 eq([M.portableTest.bytes,M.portableTest.sha256],[V64_SYNTAX_TEST.bytes,V64_SYNTAX_TEST.sha256]);for(const p of[M.portableTest.source,M.portableTest.prepared])eq(get({path:p,bytes:V64_SYNTAX_TEST.bytes,sha256:V64_SYNTAX_TEST.sha256}),get(V64_SYNTAX_TEST));
 eq(I.schemaVersion,1);eq(I.accepted,true);eq(I.sourceOnly,true);eq(I.epoch,C.epoch);eq(I.before,V64_OLD.map(p=>({path:p.source,bytes:p.bytes,sha256:p.sha256})));eq(I.after,C.formalSources);eq(I.unchangedPackage,V64_PACKAGE);eq(I.unchangedSyntaxTest,V64_SYNTAX_TEST);eq(I.mappings,M.sourceFiles);eq([I.registeredFiles,I.addedDefaultTests,I.importReplacementRules,I.literalImportOccurrences],[149,0,16,18]);eq(I.allPrerequisitesClosedBeforeIntegration,true);eq(I.wholeImportOnlyInverse,true);for(const p of v64Vector(I.sources))get(p);const integratedAt=time(I.startedAt,'Integration startedAt'),integratedEnd=time(I.finishedAt,'Integration finishedAt');assert.ok(integratedEnd>=integratedAt);
 const registered=json(get(V64_PACKAGE)).scripts.test.split(/\s+/).filter(p=>p.startsWith('scripts/'));eq([registered.length,new Set(registered).size],[149,149]);assert.ok(registered.includes(V64_SYNTAX_TEST.path));eq((T(V64_SYNTAX_TEST).match(/^test\(/gm)||[]).length,3);assert.ok(!T(V64_SYNTAX_TEST).includes('build/'));
 eq(Object.keys(C.fresh).sort(),['close','formalSyntax','normal','strong']);const lanes=v64BoundLanes(C);eq(Object.keys(lanes).sort(),Object.keys(V64_LANES).sort());const receipts={},controls={};
 for(const[name,[file,count,epoch]]of Object.entries(V64_LANES)){
  const bound=lanes[name];eq(bound.receipt.path,V64_BUILD+file);eq(bound.receipt,expectedPin(name));eq(bound.epoch,epoch);eq(bound.expectedTests,count);const r=receipts[name]=J(bound.receipt);eq(r.schemaVersion,1);eq(r.sourceOnly,true);eq(r.sourceBytesStable,true);eq(typeof r.accepted,'boolean');assert.ok(Number.isInteger(r.processExitCode));v64Terminal(bound.terminal,r.processExitCode);if(Object.hasOwn(V64_FROZEN_TERMINALS,name))eq(bound.terminal,V64_FROZEN_TERMINALS[name],'Complete original root test tool terminal');const begun=time(r.startedAt,'Raw startedAt'),finished=time(r.finishedAt,'Raw finishedAt');assert.ok(finished>=begun);const before=J(r.before);eq(before.sources,r.sources,'Whole original before/after vector');const rows=v64Vector(r.sources),summary=rawSummary(get(r.stdout)),stderr=get(r.stderr);for(const[k,v]of Object.entries(summary))eq(r[k],v,'Original raw TAP terminal: '+name+'/'+k);const green=r.processExitCode===0&&summary.tests===count&&summary.pass===count&&['fail','cancelled','skipped','todo'].every(k=>summary[k]===0)&&stderr.length===0;eq(r.accepted,green);eq(green,true,'All selected raw processes must satisfy their explicit lane contract');
  for(const old of V64_OLD)eq(rows.find(p=>p.path===old.source),epoch==='parent'?{path:old.source,bytes:old.bytes,sha256:old.sha256}:formal.get(old.source),'Exact four-source epoch for '+name);
  for(const p of[V64_PACKAGE,V64_SYNTAX_TEST])eq(rows.find(q=>q.path===p.path),p,'No package or syntax test epoch exception');
  for(const k of['defaultTestsAdded','newBrowserRuns','newPublicLoads','newPublicSaves','newEnd','newNativeInputs','newRealNativeInputs','newMarches'])if(Object.hasOwn(r,k))eq(r[k],0);for(const k of['hdAccepted','globalHdComplete','cleanupAuthorized','actualCOrRngSuccessProven','pixelOracleAccepted'])if(Object.hasOwn(r,k))eq(r[k],false);
  if(name==='formalSyntax')assert.ok(begun>=integratedEnd,'Formal target runs after final integration');if(['normal','strong','close'].includes(name))assert.ok(finished<=integratedAt,'Controls fully completed before selected source mutation');if(name==='parentBaseline'){eq(r.registeredFiles,149);for(const p of registered)assert.ok(rows.some(q=>q.path===p),'Original full selected every registered default file');}
  controls[name]={rawAccepted:r.accepted,expectedTests:count,processExitCode:r.processExitCode,...summary,sourceBytesStable:true,sourceEpoch:epoch,countedAsNewDefault:false,featureAccepted:name==='unsafeWitness'?false:name==='parentBaseline'?false:r.accepted};
 }
 eq(C.unsafeWitness.rawAccepted,true);eq(C.unsafeWitness.unsafeBehaviorObserved,true);eq(C.unsafeWitness.featureAccepted,false);eq(C.unsafeWitness.countedInDefault,false);eq(C.parentBaseline.savedParentBaseline,true);eq(C.parentBaseline.rawFourFilesArchived,true);eq(C.parentBaseline.newCodeFullRun,false);eq(C.parentBaseline.newCodeFullAccepted,false);eq(C.parentBaseline.registeredFiles,149);
 eq(lanes.normal.terminal,{closed:true,sessionId:19267,initialChunk:'f93ea1',terminalChunk:'75d2d2',exitCode:0});eq(lanes.strong.terminal,{closed:true,sessionId:44961,initialChunk:'140604',terminalChunk:'999235',exitCode:0});eq(lanes.unsafeWitness.terminal,{closed:true,sessionId:1388,initialChunk:'abd4d5',terminalChunk:'751dd9',exitCode:0});eq(lanes.parentBaseline.terminal,{closed:true,sessionId:99416,initialChunk:'4878ad',terminalChunk:'26e2b0',exitCode:0});eq([lanes.close.terminal.sessionId,lanes.close.terminal.initialChunk],[55551,'e6d1af']);
 eq(Object.keys(I.prerequisites).sort(),['close','normal','strong']);for(const name of['normal','strong','close'])eq(I.prerequisites[name],{receipt:lanes[name].receipt,accepted:true,processExitCode:0,terminal:lanes[name].terminal});for(const k of['newBrowserRuns','newNativeInputs','newPublicLoads','newPublicSaves','newEnd'])eq(I[k],0);for(const k of['publishedNewMainInput','hdAccepted','globalHdComplete'])eq(I[k],false);
 assert.ok(Array.isArray(binding.supportPins)&&binding.supportPins.length<=128);eq(new Set(binding.supportPins.map(p=>p.path)).size,binding.supportPins.length);for(const p of binding.supportPins)assert.ok(p.path.startsWith(V64_BUILD)&&![V64_READER,V64_PUBLISHER,V64_BINDINGS,C.inertCliStatus?.path].includes(p.path));eq(C.supportPins.map(p=>p.path).sort(),[...binding.supportPins.map(p=>p.path),V64_READER,V64_PUBLISHER,V64_BINDINGS,...(C.inertCliStatus?[C.inertCliStatus.path]:[])].sort());eq(new Set(C.supportPins.map(p=>p.path)).size,C.supportPins.length);for(const p of C.supportPins)get(p);for(const p of V64_REQUIRED_SUPPORT)assert.ok(C.supportPins.some(q=>q.path===p),'Required whole source/inverse/peer: '+p);for(const p of V64_FUTURE_COMPOSITION)get(p);
 for(const p of V64_FIXED_SUPPORT)get(p);const hostManifest=J(V64_FUTURE_COMPOSITION[4]);eq(hostManifest.schemaVersion,1);eq(v64Vector(hostManifest.sources).length,48);const cliStatus=readInertStatus(C.inertCliStatus,get);
 const extra=[...C.archivePins,...v64Vector(I.sources),...v64Vector(hostManifest.sources),...C.formalSources,V64_PACKAGE,V64_SYNTAX_TEST],current=v64CurrentVector(receipts,extra);eq(C.currentSources,current);const literal=current.filter(p=>p.path.startsWith(V64_BUILD)).map(p=>p.path).sort();eq(C.literalExactIgnored,literal);const missing=[];
 for(const p of current){const b=readCurrent(p.path,Math.max(1,p.bytes));if(b===null){assert.ok(literal.includes(p.path),'Missing tracked checkout source is refused even with an archive copy: '+p.path);get(p);missing.push(p.path);}else v64Check(p,b);if(literal.includes(p.path))get(p);}
 eq(C.codec.path,V64_CODEC);eq(C.codec,{path:V64_CODEC,bytes:32262,sha256:'c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca'});v64Check(C.codec,readCurrent(C.codec.path,Math.max(1,C.codec.bytes)));
 const facts={...v64Scope(),retainedCurrentMain:'P57 genuine saved dispatch; original nine remain external exact pins',sourceChange:{formalRuntimeFiles:3,formalPureTestFilesChanged:0,packageChanged:false,attributesSixPrefixPatternsOnly:true,wholeImportOnlyInverse:true,importReplacementRules:16,literalImportOccurrences:18,oldFullReadApiBodiesRetained:true,hdWireSealLimitsAndKeyUpRetained:true,sourceEpochs:2,parentEpochPaths:V64_OLD.map(p=>p.source)},tests:{fresh:{formalSyntax:controls.formalSyntax,normal:controls.normal,strong:controls.strong,close:controls.close},freshSelectedTests:26,addedDefaultTests:0,defaultRegisteredFiles:149,defaultTestCommandUnchanged:true,unsafeWitness:{...controls.unsafeWitness,unsafeBehaviorObserved:true,featureAccepted:false},parentBaseline:{...controls.parentBaseline,savedParentBaseline:true,tests:7905,pass:7905,registeredFiles:149,newCodeFullRun:false,newCodeFullAccepted:false},candidateAndFormalNotAddedTwice:true},futureComposition:{reviewedCompositionEntriesArchived:6,hostFixedDependencies:48,matchingTrackedCheckoutRequired:true,earlyNaturalCloseCoveredBySyntheticControls:true,completeHostRuntimeAccepted:false,completeCliRuntimeAccepted:false,actualRunAuthorized:false,naturalEndAfterOnlyWood6RemainsPartial:true,wood7MayNotBeInferred:true},inertCli:cliStatus,coverage:'Genuine private-brand fixed synthetic CDP normal/Strong/early-natural-close controls and parse-only formal expressions. The old Strong4 1/1 is a bad-behavior witness. V63 7905/149 is a saved parent full baseline; no full run on the new Strong code is claimed. No real END, income, movie oracle, terminal SAVE or owned release acceptance.',sources:{selected:current.length,literalExactIgnored:literal.length},oldActualFilesRepacked:0,parentArchivePartsRepacked:0};
 return{facts,diagnostics:{missingExactIgnoredSources:missing.length}};
}
export function verifyV64Publication(root,{readCurrent,readPublic}={}){
 readCurrent??=((p,max)=>{try{return v45ReadBounded(root,p,max);}catch(error){if(error.code==='ENOENT')return null;throw error;}});readPublic??=((p,max)=>v45ReadBounded(root,p,max));
 const C=json(readPublic(V64_PREFIX+'.json',2*1024*1024));eq(C.reader.path,V64_PREFIX+'-verify.mjs');const reader=v64Check(C.reader,readPublic(C.reader.path,1024*1024));eq(C.markdown.path,V64_PREFIX+'.md');v64Check(C.markdown,readPublic(C.markdown.path,1024*1024));eq(C.archive.path,V64_PREFIX+'-archive-index.json');const index=json(v64Check(C.archive,readPublic(C.archive.path,2*1024*1024))),decoded=decodeV45Archive({index,readPart:(p,max)=>readPublic(p,max)});
 const source=C.supportPins.find(p=>p.path===V64_READER);assert.ok(source);const original=v64Check(source,decoded.files.get(V64_READER)).toString('utf8'),from="'../../../docs/"+"validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs'",to="'./m5-quantity-ack-refresh-20261024-v45-verify.mjs'";eq(original.split(from).length,2);eq(reader,Buffer.from(original.replace(from,to)),'Whole public reader differs only in the fixed codec import');const result=verifyV64SourceEvidence({files:decoded.files,canonical:C,readCurrent});eq(C.observations,result.facts);return{accepted:true,facts:result.facts,archive:{logicalFiles:decoded.files.size,parts:index.parts.length},diagnostics:result.diagnostics};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){eq(process.argv.slice(2),['--verify']);console.log(JSON.stringify(verifyV64Publication(process.cwd())));}
