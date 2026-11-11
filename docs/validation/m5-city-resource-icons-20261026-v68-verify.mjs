/** Read-only V68 data verification; only built-ins and maintained V45 codec execute. */
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {isDeepStrictEqual} from 'node:util';
import {decodeV45Archive,v45Pin,V45_BOUNDS} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
export const B='build/city-resources-20261026-v68/',D=B+'evidence-source-v4/',FAILED_INPUT=D+'failed-mobile-input-v1.json',FAILED_CHUNKS=D+'failed-mobile-chunks-v1/',PREFIX='docs/validation/m5-city-resource-icons-20261026-v68',READER=D+'v68-resource-reader-v4.mjs',PUBLISHER=D+'publish-v68-resources-v4.mjs',BINDING=D+'root-bindings-v4.json',INPUT=D+'mobile-input-v4.json',CHUNKS=D+'mobile-chunks-v4/';
export const LOCKS={
  "schemaVersion": 1,
  "criticalPins": [
    {
      "path": ".gitattributes",
      "bytes": 41444,
      "sha256": "fc474b0ebbf4bcf5f0c2f9cd2b0634ceb7a124ae1fca9f91d7567557d5ad6eca"
    },
    {
      "path": "js/hd-city-menu.js",
      "bytes": 436244,
      "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
    },
    {
      "path": "css/hd-city-menu.css",
      "bytes": 15502,
      "sha256": "90d8a85ce10e2f812997177301db78c5831a6695af67c3239e295787169db9b7"
    },
    {
      "path": "pc.html",
      "bytes": 28673,
      "sha256": "45295ba3abd35ada522cd134f61dbf934dcbd42aadf9fb59790f3078b1322947"
    },
    {
      "path": "m.html",
      "bytes": 18472,
      "sha256": "d742e381ab06f3ed67996fe8bd84a8d1e157e34cf5ba23d9b09c2e96cba47f4c"
    },
    {
      "path": "scripts/test-hd-city-hud.mjs",
      "bytes": 134812,
      "sha256": "8acfbf697fd5271b6c7c18cd38e039c02b16e97b809b3bacb2c68be00c740efe"
    },
    {
      "path": "scripts/hd-city-resource-runtime-checks.mjs",
      "bytes": 6880,
      "sha256": "f948623f072246368521707a7ec44ff18b4bff47a2c6b40551324cc1cfdbf41f"
    },
    {
      "path": "scripts/hd-person-equipment-runtime-checks.mjs",
      "bytes": 10661,
      "sha256": "6e27d7094185dd69dec1cb746a78b39b4596899ab6edd8d13e09680a5a4953fe"
    },
    {
      "path": "scripts/test-hd-person-equipment-runtime.mjs",
      "bytes": 35763,
      "sha256": "66f31182da329a0c7acc66e0dc4c8ac2be686bd559f3c759af2f4db2d6bda23a"
    },
    {
      "path": "scripts/test-hd-mobile-city-runtime.mjs",
      "bytes": 124752,
      "sha256": "203deab6b60c7823d714a6fca3ef1b3b577fe24fcac13daea628db463a7432b7"
    },
    {
      "path": "scripts/hd-mobile-preview-runtime-checks.mjs",
      "bytes": 19409,
      "sha256": "ee6074a49a9377f32502c6d5d31119f0dd65f4971b1f3d3103c4e5a736ce3d0e"
    },
    {
      "path": "package.json",
      "bytes": 21183,
      "sha256": "809fd447dd1177d6af707c189c4a0408011c1bfe5a78816012a21a09bc7a140d"
    },
    {
      "path": "libs/dat-mod.lib",
      "bytes": 207195,
      "sha256": "3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e"
    },
    {
      "path": "js/baye.js",
      "bytes": 193321,
      "sha256": "86baead056252a5f631445c8c18e6372abf56ac8d9d090c10f2b7f0c5f7caed2"
    },
    {
      "path": "js/baye.wasm",
      "bytes": 4561352,
      "sha256": "08d733567e29716cfc8249a9365aa2f923b6c064e407d3d655cedecb48456de5"
    },
    {
      "path": "js/baye.wasm.map",
      "bytes": 29983,
      "sha256": "ddc5651cee33ea5a550b6522a2321b48e1a3bab3a21bb290f54d07b1e8321646"
    },
    {
      "path": "js/baye.build.json",
      "bytes": 21284,
      "sha256": "aea1f7845131ecdcc7f6f19a767ddf4408fb2a3758b1a1de0aa8ab977b5e9233"
    },
    {
      "path": "scripts/hd-runtime-owned-chrome.mjs",
      "bytes": 13603,
      "sha256": "403aac41552628b1c4fbd940c0647b7f2f831d19e4fb125df5f50aa003e06761"
    },
    {
      "path": "scripts/hd-runtime-json.mjs",
      "bytes": 7266,
      "sha256": "3e16c26e9b963d597cfdef97b3859c01862788a77ca208d6c4579d516d1dfda5"
    }
  ],
  "records": [
    {
      "path": "build/city-resources-20261026-v68/source-integration-v1.json",
      "bytes": 2460,
      "sha256": "fd4fb4a1b2e2e3d8903b410440ce3b6ebac352ec44007c8a6837d13e8dde38bb"
    },
    {
      "path": "build/city-resources-20261026-v68/runtime-epoch-v1.json",
      "bytes": 3775,
      "sha256": "b62cd41524cd3fe4b38cc7d0d216ba038ebae2559001fc1505dee44a91e1b1c2"
    },
    {
      "path": "build/city-resources-20261026-v68/hud-controls-v1.json",
      "bytes": 2928,
      "sha256": "388666a063aff097b40c04c19781f60033cd687619267348eae653ab62cc4c37"
    },
    {
      "path": "build/city-resources-20261026-v68/targeted-city-icons-v1.json",
      "bytes": 1121,
      "sha256": "091e9a26ce40ed58d9f08963f935744ae93192ae40a256663700e1e757d353d9"
    },
    {
      "path": "build/city-resources-20261026-v68/targeted-city-icons-v2.json",
      "bytes": 2594,
      "sha256": "51bd951a38e72c9fdff404b576999013a3917ca22343042af37a67ad05b3b8f7"
    }
  ],
  "history": [
    {
      "path": "build/city-resources-20261026-v68/integrate-source-v1.mjs",
      "bytes": 2649,
      "sha256": "f12d123127af9d3eee082f67bc28590cd18b859521bef80abf21a7f7a8c3d956"
    },
    {
      "path": "build/city-resources-20261026-v68/prepare-runtime-epoch-v1.mjs",
      "bytes": 1878,
      "sha256": "8cf4076b44d18210fa6f93f1c1cd618a54eef852b1b646c68e4c226d7d9a5da1"
    },
    {
      "path": "build/city-resources-20261026-v68/run-hud-controls-v1.mjs",
      "bytes": 1811,
      "sha256": "88e3931b2c62a20eaf53803e77af1c47aea5e03d55c07aed62b16313e80805e4"
    },
    {
      "path": "build/city-resources-20261026-v68/attributes-before-runtime-lf-v1",
      "bytes": 41274,
      "sha256": "e47c960724d2b7531a96fd1ddd81d081453f4bb1c32c468e8f11dd0b76652692"
    },
    {
      "path": "build/city-resources-20261026-v68/raw-publish-v3-terminal-tool-v1.json",
      "bytes": 1463,
      "sha256": "65926ca5ad665732ed39e62affb2283204c7306a7ba496c767cd117b4efd3492"
    },
    {
      "path": "build/city-resources-20261026-v68/evidence-source-v3/v68-resource-reader-v3.mjs",
      "bytes": 45500,
      "sha256": "f9f9158e450bc467212ac18aabaf25ff0c1c76d1b6fa3a4d5249b95cf5e44a6b"
    },
    {
      "path": "build/city-resources-20261026-v68/evidence-source-v3/publish-v68-resources-v3.mjs",
      "bytes": 7131,
      "sha256": "91b28ba5a262be4d91b17d7beb4e4be1596b7f221be18728a95afa0708204655"
    },
    {
      "path": "build/city-resources-20261026-v68/evidence-source-v3/root-bindings-v3.json",
      "bytes": 33004,
      "sha256": "12547c7bf852c93aaff4dca08f3b8e870fd16cf438f1126b2f955d9f3bbfed04"
    }
  ],
  "candidate": [
    {
      "path": "build/city-resource-icons-candidate-v1/source-preparation-v1.json",
      "bytes": 2629,
      "sha256": "f654d98fff65b63575e1c9e2d755ee5bafc7f42d5ff6247de0faf53f889c31b8"
    },
    {
      "path": "build/city-resource-icons-candidate-v1/mechanical-source-diff-v1.json",
      "bytes": 7007,
      "sha256": "e89e2cd53a5bc1f0ec43c95a66cf3b13578b9abd0f1efdb057adab96d2df28b6"
    },
    {
      "path": "build/city-resource-icons-candidate-v1/source-static-peer-v1.json",
      "bytes": 4522,
      "sha256": "ae837709438d918c5365e7bf2fc601b662ec3d58d89826dc6949db146144b7f4"
    },
    {
      "path": "build/city-resource-icons-candidate-v1/before/js/hd-city-menu.js",
      "bytes": 433456,
      "sha256": "71792cdfd2d6689e0b32011df1b317e056f29408133329c834eb95fb4bea437f"
    },
    {
      "path": "build/city-resource-icons-candidate-v1/before/css/hd-city-menu.css",
      "bytes": 15365,
      "sha256": "4ce218279c71adcc49fa35a1f8dfadb00b93fb2601371f67c2d487e80c2a9081"
    },
    {
      "path": "build/city-resource-icons-candidate-v1/sources/js/hd-city-menu.js",
      "bytes": 436244,
      "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
    },
    {
      "path": "build/city-resource-icons-candidate-v1/sources/css/hd-city-menu.css",
      "bytes": 15502,
      "sha256": "90d8a85ce10e2f812997177301db78c5831a6695af67c3239e295787169db9b7"
    }
  ],
  "parentBaseline": {
    "path": "docs/validation/m5-person-equipment-icons-20261026-v67.json",
    "bytes": 42229,
    "sha256": "ff5c96d0185d2a5cb2dec9392c8132d1ddcd5ea9f2581205648a30471133a2ec"
  },
  "codec": {
    "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
    "bytes": 32262,
    "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
  },
  "caseDirectories": {
    "pc1080": "build/city-resources-20261026-v68/pc1080-v1/",
    "pc720": "build/city-resources-20261026-v68/pc720-v1/",
    "mobile": "build/city-resources-20261026-v68/mobile-preview-v2/"
  },
  "oldCriticalPins": [
    {
      "path": ".gitattributes",
      "bytes": 41444,
      "sha256": "fc474b0ebbf4bcf5f0c2f9cd2b0634ceb7a124ae1fca9f91d7567557d5ad6eca"
    },
    {
      "path": "js/hd-city-menu.js",
      "bytes": 436244,
      "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
    },
    {
      "path": "css/hd-city-menu.css",
      "bytes": 15502,
      "sha256": "90d8a85ce10e2f812997177301db78c5831a6695af67c3239e295787169db9b7"
    },
    {
      "path": "pc.html",
      "bytes": 28673,
      "sha256": "45295ba3abd35ada522cd134f61dbf934dcbd42aadf9fb59790f3078b1322947"
    },
    {
      "path": "m.html",
      "bytes": 18472,
      "sha256": "d742e381ab06f3ed67996fe8bd84a8d1e157e34cf5ba23d9b09c2e96cba47f4c"
    },
    {
      "path": "scripts/test-hd-city-hud.mjs",
      "bytes": 134812,
      "sha256": "8acfbf697fd5271b6c7c18cd38e039c02b16e97b809b3bacb2c68be00c740efe"
    },
    {
      "path": "scripts/hd-city-resource-runtime-checks.mjs",
      "bytes": 6880,
      "sha256": "f948623f072246368521707a7ec44ff18b4bff47a2c6b40551324cc1cfdbf41f"
    },
    {
      "path": "scripts/hd-person-equipment-runtime-checks.mjs",
      "bytes": 10661,
      "sha256": "6e27d7094185dd69dec1cb746a78b39b4596899ab6edd8d13e09680a5a4953fe"
    },
    {
      "path": "scripts/test-hd-person-equipment-runtime.mjs",
      "bytes": 35763,
      "sha256": "66f31182da329a0c7acc66e0dc4c8ac2be686bd559f3c759af2f4db2d6bda23a"
    },
    {
      "path": "scripts/test-hd-mobile-city-runtime.mjs",
      "bytes": 117406,
      "sha256": "5d62f089f855d5d1cc6a55a7854c0131baf4a47956ae728aa8cd9ae652e79def"
    },
    {
      "path": "scripts/hd-mobile-preview-runtime-checks.mjs",
      "bytes": 19409,
      "sha256": "ee6074a49a9377f32502c6d5d31119f0dd65f4971b1f3d3103c4e5a736ce3d0e"
    },
    {
      "path": "package.json",
      "bytes": 21183,
      "sha256": "809fd447dd1177d6af707c189c4a0408011c1bfe5a78816012a21a09bc7a140d"
    },
    {
      "path": "libs/dat-mod.lib",
      "bytes": 207195,
      "sha256": "3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e"
    },
    {
      "path": "js/baye.js",
      "bytes": 193321,
      "sha256": "86baead056252a5f631445c8c18e6372abf56ac8d9d090c10f2b7f0c5f7caed2"
    },
    {
      "path": "js/baye.wasm",
      "bytes": 4561352,
      "sha256": "08d733567e29716cfc8249a9365aa2f923b6c064e407d3d655cedecb48456de5"
    },
    {
      "path": "js/baye.wasm.map",
      "bytes": 29983,
      "sha256": "ddc5651cee33ea5a550b6522a2321b48e1a3bab3a21bb290f54d07b1e8321646"
    },
    {
      "path": "js/baye.build.json",
      "bytes": 21284,
      "sha256": "aea1f7845131ecdcc7f6f19a767ddf4408fb2a3758b1a1de0aa8ab977b5e9233"
    },
    {
      "path": "scripts/hd-runtime-owned-chrome.mjs",
      "bytes": 13603,
      "sha256": "403aac41552628b1c4fbd940c0647b7f2f831d19e4fb125df5f50aa003e06761"
    },
    {
      "path": "scripts/hd-runtime-json.mjs",
      "bytes": 7266,
      "sha256": "3e16c26e9b963d597cfdef97b3859c01862788a77ca208d6c4579d516d1dfda5"
    }
  ],
  "currentEpoch": {
    "path": "build/city-resources-20261026-v68/runtime-epoch-v2.json",
    "bytes": 3528,
    "sha256": "dd90dccd522804e02a1810de0255a185cf2125825ba76eccf72951cfe75ffed3"
  },
  "currentHud": {
    "path": "build/city-resources-20261026-v68/hud-controls-v2.json",
    "bytes": 2927,
    "sha256": "4d7f412fecf7516df2b591144a7e14dd704395c4ba82bdcb2c1677bd96d25eb7"
  },
  "failedResult": {
    "path": "build/city-resources-20261026-v68/mobile-preview-v1/result.json",
    "bytes": 47031545,
    "sha256": "3fb1b57f6b93cdc6c4978473e7b528068631d4170bef5753bcb655036edc5279"
  },
  "failedDirectory": "build/city-resources-20261026-v68/mobile-preview-v1/",
  "currentMobileResult": {
    "path": "build/city-resources-20261026-v68/mobile-preview-v2/result.json",
    "bytes": 31205001,
    "sha256": "554d1c2809132f689afb9c28da807ccaa111d474007d320b263949c098e56de6"
  }
};
const eq=(a,b,message)=>assert.ok(isDeepStrictEqual(a,b),message),json=b=>JSON.parse(b.toString('utf8')),FIELDS=['useFlag','attack','iq','move','arm','changeAttackRange'],LABELS=['用法','武力加成','智力加成','移动加成','兵种变化','攻击范围'];
export const ORIGINAL_BOUNDS=Object.freeze({maxPartBytes:8388608,maxSerializedBytes:67108864,maxNamedRawBytes:134217728,maxUniqueRawBytes:100663296,maxFileBytes:33554432,maxFiles:512,maxBlobs:512,maxParts:32});
export function pin3(p){assert.ok(p&&typeof p==='object');relative(p.path);assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&p.bytes<=V45_BOUNDS.maxFileBytes);assert.match(p.sha256,/^[0-9a-f]{64}$/);return{path:p.path,bytes:p.bytes,sha256:p.sha256};}
export function check(p,bytes){assert.ok(Buffer.isBuffer(bytes));eq(v45Pin(p.path,bytes),pin3(p),'Exact data '+p.path);return bytes;}
function relative(p){assert.equal(typeof p,'string');assert.ok(p&&!path.isAbsolute(p)&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'));return p;}
export function safeRead(root,p,max=V45_BOUNDS.maxFileBytes){relative(p);assert.ok(Number.isSafeInteger(max)&&max>0&&max<=V45_BOUNDS.maxFileBytes);const base=fs.realpathSync.native(root);let q=base;const parts=p.split('/');for(let i=0;i<parts.length;i++){q=path.join(q,parts[i]);const s=fs.lstatSync(q);assert.ok(!s.isSymbolicLink());assert.ok(i===parts.length-1?s.isFile():s.isDirectory());}assert.ok(fs.realpathSync.native(q).startsWith(base+path.sep));const a=fs.lstatSync(q,{bigint:true});assert.ok(a.size<=BigInt(max));const b=fs.readFileSync(q),z=fs.lstatSync(q,{bigint:true});eq([z.dev,z.ino,z.size,z.mtimeNs],[a.dev,a.ino,a.size,a.mtimeNs]);eq(BigInt(b.length),a.size);return b;}
export function terminal(t,expectedExit=0){assert.ok(t);eq(t.closed,true);eq(t.exitCode,expectedExit);assert.match(t.terminalChunk,/^[0-9a-f]{6}$/);if(Object.hasOwn(t,'sessionId')){assert.ok(Number.isSafeInteger(t.sessionId)&&t.sessionId>0);assert.match(t.initialChunk,/^[0-9a-f]{6}$/);}return t;}

export function wholePin(b,id='mobile'){const p=id==='failed'?b.failedCase.result:b.cases.find(c=>c.id==='mobile').result;assert.ok(p);eq(p.path,id==='failed'?LOCKS.failedResult.path:B+'mobile-preview-v2/result.json');assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=32*V45_BOUNDS.maxFileBytes);assert.match(p.sha256,/^[0-9a-f]{64}$/);if(id==='failed')eq(p,LOCKS.failedResult);else eq(p,LOCKS.currentMobileResult);return{path:p.path,bytes:p.bytes,sha256:p.sha256};}
function logicalPin(b,p){for(const id of ['mobile','failed'])if(p.path===wholePin(b,id).path){eq(p,wholePin(b,id));return wholePin(b,id);}return pin3(p);}
function checkData(b,p,bytes){assert.ok(Buffer.isBuffer(bytes));eq(v45Pin(p.path,bytes),logicalPin(b,p),'Exact complete logical data '+p.path);return bytes;}
function expectedExecuted(c){const pairs=(c.id==='mobile'||c.id==='failed')?[['executed-tool.mjs','scripts/test-hd-mobile-city-runtime.mjs'],['executed-equipment-helper.mjs','scripts/hd-person-equipment-runtime-checks.mjs'],['executed-preview-helper.mjs','scripts/hd-mobile-preview-runtime-checks.mjs'],['executed-resource-helper.mjs','scripts/hd-city-resource-runtime-checks.mjs']]:[['executed-tool.mjs','scripts/test-hd-person-equipment-runtime.mjs'],['executed-checks.mjs','scripts/hd-person-equipment-runtime-checks.mjs'],['executed-resource-helper.mjs','scripts/hd-city-resource-runtime-checks.mjs'],['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],['executed-json.mjs','scripts/hd-runtime-json.mjs']];return pairs.map(([file,name])=>{const source=(c.id==='failed'?LOCKS.oldCriticalPins:LOCKS.criticalPins).find(p=>p.path===name);assert.ok(source);return{file:{path:c.directory+file,bytes:source.bytes,sha256:source.sha256},source};});}
export function requireBinding(b){eq(b.schemaVersion,1);eq(b.reviewed,true);eq(b.draftOnly,false);eq(b.prefix,PREFIX);eq(b.criticalPins,LOCKS.criticalPins);eq(b.records,LOCKS.records);eq(b.history,LOCKS.history);eq(b.currentEpoch,LOCKS.currentEpoch);eq(b.currentHud,LOCKS.currentHud);eq(b.parentBaseline,LOCKS.parentBaseline);assert.ok(Array.isArray(b.supportPins)&&b.supportPins.length<=24);for(const p of b.supportPins){pin3(p);assert.ok(p.path.startsWith(B));}eq(Object.keys(b.terminals).sort(),['hud','mobile','pc1080','pc720']);for(const[lane,t]of Object.entries(b.terminals))terminal(t,lane==='mobile'?1:0);eq(b.terminals.hud,{closed:true,terminalChunk:'81dfed',exitCode:0});eq(b.terminals.pc1080,{closed:true,sessionId:4027,initialChunk:'e7e116',terminalChunk:'431038',exitCode:0});eq(b.terminals.pc720,{closed:true,sessionId:15279,initialChunk:'2ab6fc',terminalChunk:'887a56',exitCode:0});eq(b.terminals.mobile,{closed:true,sessionId:68833,initialChunk:'6f0a13',terminalChunk:'a9ef7a',exitCode:1});pin3(b.terminalProof);pin3(b.readerSource);pin3(b.publisherSource);eq(b.readerSource.path,READER);eq(b.publisherSource.path,PUBLISHER);for(const[id,info]of [['mobile',b.mobileChunks],['failed',b.failedCase.wholeChunks]]){pin3(info.input);eq(info.input.path,id==='mobile'?INPUT:FAILED_INPUT);pin3(info.manifest);eq(info.manifest.path,(id==='mobile'?CHUNKS:FAILED_CHUNKS)+'manifest.json');}eq(b.cases.map(c=>c.id),['pc1080','pc720','mobile']);for(const c of b.cases){eq(c.directory,LOCKS.caseDirectories[c.id]);eq(c.result.path,c.directory+'result.json');logicalPin(b,c.result);pin3(c.sourceVerification);eq(c.sourceVerification.path,c.directory+'source-verification.json');if(c.console){pin3(c.console);eq(c.console.path,c.directory+'browser-console.json');}else eq(c.id,'mobile');eq(c.executed,expectedExecuted(c),'Complete strict PC5/mobile4 original executed copies');assert.ok(Array.isArray(c.pngs)&&c.pngs.length);for(const p of c.pngs){pin3(p);assert.ok(p.path.startsWith(c.directory)&&p.path.endsWith('.png'));}}const f=b.failedCase;eq(f.id,'failed');eq(f.directory,LOCKS.failedDirectory);eq(f.result,LOCKS.failedResult);eq(f.terminal,{closed:true,sessionId:85789,initialChunk:'ca000a',terminalChunk:'0d47ea',exitCode:1});eq(f.executed,expectedExecuted(f));pin3(f.sourceVerification);eq(f.sourceVerification.path,f.directory+'source-verification.json');pin3(f.terminalTool);eq(f.terminalTool.path,B+'raw-mobile-v1-terminal-tool-v1.json');assert.ok(Array.isArray(f.pngs)&&f.pngs.length>0);for(const p of f.pngs){pin3(p);assert.ok(p.path.startsWith(f.directory)&&p.path.endsWith('.png'));}wholePin(b);wholePin(b,'failed');eq(b.images.map(x=>x.id),['pc1080','pc720','mobile844v1','mobile844v2']);for(const p of b.images){pin3(p.source);eq(p.publicPath,PREFIX+'-'+p.id+'.png');}}
export function selected(b,J){requireBinding(b);const rows=[...LOCKS.criticalPins,...LOCKS.candidate,...b.records,...b.history,...b.supportPins,b.readerSource,b.publisherSource,b.terminalProof,b.mobileChunks.input,b.mobileChunks.manifest,b.currentEpoch,b.currentHud,b.failedCase.wholeChunks.input,b.failedCase.wholeChunks.manifest,b.failedCase.terminalTool],I=J(b.records[0]),E=J(b.records[1]),H=J(b.records[2]);const H2=J(b.currentHud);rows.push(H2.stdout,H2.stderr);rows.push(...I.files.flatMap(f=>[f.before,f.candidate]),...I.pages.map(f=>f.before),...E.changes.map(f=>f.before),H.stdout,H.stderr);for(const p of b.records.slice(3)){const T=J(p);rows.push(T.before,T.stdout,T.stderr);}for(const c of [...b.cases,b.failedCase])rows.push(c.result,c.sourceVerification,...(c.console?[c.console]:[]),...c.executed.map(e=>e.file),...c.pngs);const proof=J(b.terminalProof);eq(proof.schemaVersion,1);eq(proof.terminals,b.terminals);eq(Object.keys(proof.closedToolPins).sort(),Object.keys(b.terminals).sort());rows.push(...Object.values(proof.closedToolPins));assert.ok(Array.isArray(proof.rawProofPins));rows.push(...proof.rawProofPins);const map=new Map();for(const p of rows){const q=logicalPin(b,p);assert.ok(LOCKS.criticalPins.some(v=>v.path===q.path)||LOCKS.candidate.some(v=>v.path===q.path)||q.path.startsWith(B));assert.ok(!q.path.split('/').some(x=>/^(?:private-browser-profile|profile|frozen-public|frozen-node)$/.test(x)));if(map.has(q.path))eq(map.get(q.path),q);else map.set(q.path,q);}return[...map.values()].sort((a,z)=>a.path<z.path?-1:a.path>z.path?1:0);}
function tap(b){const s=b.toString('utf8'),r={};for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const rows=[...s.matchAll(new RegExp('^# '+k+' ([0-9.]+)\\r?$','gm'))];eq(rows.length,1,'One final TAP '+k);r[k]=Number(rows[0][1]);}return r;}
function tools(lib){eq(lib.length,207195);const item=(resource,index)=>{const base=lib.readUInt32LE((resource-1)*4),end=base+lib.readUInt32LE(base),count=lib.readUInt16LE(base+6),fixed=lib.readUInt32LE(base+8);eq(lib.readUInt16LE(base+4),resource);assert.ok(index>=0&&index<count&&end<=lib.length);const row=base+14+index*8,off=fixed?base+14+index*fixed:count===1?base+14:base+lib.readUInt32LE(row),len=fixed||(count===1?end-base-14:lib.readUInt32LE(row+4));assert.ok(off>=base+14&&off+len<=end);return lib.subarray(off,off+len);};const table=item(66,0);eq(table.length,33*66);return Array.from({length:33},(_,i)=>{const n=item(73,i),zero=n.indexOf(0),p=i*66;return{name:new TextDecoder('gbk').decode(n.subarray(0,Math.min(zero<0?n.length:zero,31))),useFlag:table[p+1],attack:table[p+62],iq:table[p+63],move:table[p+64],arm:table[p+65],changeAttackRange:table[p+32]};});}
function values(t){return{useFlag:t.useFlag?'使用':'装备',attack:String(t.attack),iq:String(t.iq),move:String(t.move),arm:t.arm===0?'无':t.arm===1?'水军':t.arm===2?'玄兵':t.arm===3?'极兵':['骑兵','步兵','弓箭兵','水军','极兵','玄兵'][t.arm-4]||'原始码 '+t.arm,changeAttackRange:t.changeAttackRange?'改变（以战场为准）':'不改变'};}
function decoration(v,field,title,value){eq(v.field,field);eq(v.title,title);eq(v.value,value);eq(v.svgCount,1);eq(v.iconField,field);const b=v.bounds,inside=(o,i)=>i.left>=o.left-.5&&i.right<=o.right+.5&&i.top>=o.top-.5&&i.bottom<=o.bottom+.5;for(const name of ['row','label','value','icon','viewport']){const r=b[name];assert.ok(r&&['left','top','right','bottom','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0);}for(const name of ['label','value','icon']){assert.ok(inside(b.row,b[name]));assert.ok(inside(b.viewport,b[name]));}assert.ok(inside(b.label,b.icon));assert.ok(b.label.right<=b.value.left+.5);eq(v.iconStyle.pointerEvents,'none');const em=Number.parseFloat(v.iconStyle.fontSize),w=Number.parseFloat(v.iconStyle.width),h=Number.parseFloat(v.iconStyle.height);assert.ok([em,w,h].every(n=>Number.isFinite(n)&&n>0)&&Math.abs(w-em)<=.5&&Math.abs(h-em)<=.5);for(const n of ['label','value'])assert.ok(v.textWidths[n].scroll<=v.textWidths[n].client+.5);}
function cardProof(e,rom){eq(e.accepted,true);eq(e.keys,[]);eq(e.after.native,e.before.native);eq(e.after.world,e.before.world);eq(e.after.state.touchCount,e.before.state.touchCount);const m=e.before.state.menu,p=e.before.world.people[e.personId];eq([m.active,m.context,m.kind,m.idsValid,m.ids[m.index]],[1,1,3,true,e.personId]);const expected=[p.Tool1,p.Tool2].flatMap((id,slot)=>id?[{slot,toolIndex:id-1,tool:rom[id-1]}]:[]);assert.ok(expected.every(x=>x.tool));eq(e.expected,expected);eq(e.dom.hidden,false);eq(e.dom.cards.length,expected.length);eq(e.snapshot.equipment.length,expected.length);eq([e.snapshot.personIndex,e.snapshot.nativeIndex,e.snapshot.seq,e.snapshot.context,e.snapshot.kind,e.snapshot.ownerKey],[e.personId,m.index,m.seq,1,3,e.before.state.cityUi.deepMenuOwner.key]);for(let i=0;i<33;i++)for(const [raw,key]of Object.entries({useflag:'useFlag',at:'attack',iq:'iq',move:'move',arm:'arm',changeAttackRange:'changeAttackRange'}))eq(e.before.world.tools[i][raw],rom[i][key]);for(const [i,x]of expected.entries()){const c=e.dom.cards[i],s=e.snapshot.equipment[i],value=values(x.tool);eq([c.slot,c.toolIndex,s.slot,s.toolIndex,s.name,s.generation,s.source],[x.slot,x.toolIndex,x.slot,x.toolIndex,x.tool.name,m.detailGeneration,'standard-tool-details']);eq(s.properties,Object.fromEntries(FIELDS.map(k=>[k,x.tool[k]])));eq(c.rows.map(r=>r.field),FIELDS);for(let n=0;n<FIELDS.length;n++){const f=FIELDS[n],r=c.rows[n],sr=s.rows[n];eq([r.field,r.title,r.value],[f,LABELS[n],value[f]]);eq([sr.field,sr.label,sr.value],[f,LABELS[n],value[f]]);eq([r.svgCount,r.icons.length],[1,1]);const icon=r.icons[0];eq([icon.namespace,icon.field,icon.ariaHidden,icon.focusable],['http://www.w3.org/2000/svg',f,'true','false']);eq([icon.title,icon.titleCount,icon.ariaLabel,icon.ariaLabelledBy,icon.tabIndex,icon.labelledDescendants,icon.interactiveDescendants],[null,0,null,null,null,0,0]);const vs=e.visible.filter(v=>v.slot===x.slot&&v.toolIndex===x.toolIndex&&v.field===f);eq(vs.length,1);eq(vs[0].value,value[f]);eq(vs[0].geometry.visible,true);decoration(vs[0].decoration,f,LABELS[n],value[f]);}}eq(e.visible.length,expected.length*6);return{cards:expected.length,rows:e.visible.length};}
function sourceRows(r,c,sv){if(c.id==='mobile'){eq(sv.sourceFiles,r.sourceFiles);eq(sv.sourceDrift,[]);eq(r.sourceDrift,[]);return r.sourceFiles;}eq(sv,r.sourceVerification);eq(sv.ok,true);eq(sv.count,sv.sources.length);eq(sv.count,1220);eq(sv.added,[]);eq(sv.drift,[]);for(const p of sv.sources){eq(p.match,true);eq(p.actualSha256,p.sha256);}return Object.values(r.sources).map(p=>({path:p.source,bytes:p.bytes,sha256:p.sha256}));}

function resources(e){eq(e.accepted,true);eq(e.keys,[]);eq(e.after.world,e.before.world);eq(e.after.native,e.before.native);eq(e.after.state.touchCount,e.before.state.touchCount);const fields=['Money','Food','MothballArms','Persons','Tools'],labels=['金钱','粮食','预备兵','城内人物','城内道具'],city=e.before.world.cities[e.cityIndex];assert.ok(city);const expected=fields.map((field,i)=>{assert.ok(Number.isInteger(city[field])&&city[field]>=0);return{field,title:labels[i],value:String(city[field])};});eq(e.expected,expected);eq(e.before.state.cityUi.layer,'status');eq(e.before.state.cityUi.cityIndex,e.cityIndex);eq([e.before.state.menu.active,e.before.state.menu.context,e.before.state.menu.kind],[1,1,1]);eq(e.snapshot.cityIndex,e.cityIndex);eq(e.snapshot.groups.find(g=>g.title==='资源与军备').rows,expected.map(e=>[e.title,e.value]));eq(e.dom.hidden,false);eq(e.dom.icons,5);eq(e.dom.rows.map(r=>r.field),fields);eq(e.visible.length,5);for(const[i,x]of expected.entries()){const r=e.dom.rows[i],v=e.visible[i];eq([r.field,r.title,r.value],[x.field,x.title,x.value]);eq(r.icons.length,1);const s=r.icons[0];eq([s.namespace,s.field,s.ariaHidden,s.focusable],['http://www.w3.org/2000/svg',x.field,'true','false']);eq([s.title,s.titleCount,s.ariaLabel,s.ariaLabelledBy,s.tabIndex,s.labelledDescendants,s.interactiveDescendants],[null,0,null,null,null,0,0]);eq([v.field,v.title,v.value],[x.field,x.title,x.value]);eq(v.geometry.visible,true);decoration(v.decoration,x.field,x.title,x.value);}return 5;}
function unchanged(a,z,keys){eq(keys,[]);eq(z.world,a.world);eq(z.native,a.native);eq(z.state.touchCount,a.state.touchCount);}
export function verifyData(files,b,readCurrent){requireBinding(b);const get=p=>checkData(b,p,files.get(p.path)),J=p=>json(get(p));eq(json(files.get(BINDING)),b);const want=[...selected(b,J),v45Pin(BINDING,files.get(BINDING))].sort((a,z)=>a.path<z.path?-1:a.path>z.path?1:0);eq(want,[...files].map(([p,v])=>v45Pin(p,v)).sort((a,z)=>a.path<z.path?-1:a.path>z.path?1:0));for(const p of LOCKS.criticalPins)check(p,readCurrent(p.path,Math.max(1,p.bytes)));const parent=json(check(LOCKS.parentBaseline,readCurrent(LOCKS.parentBaseline.path,LOCKS.parentBaseline.bytes)));eq([parent.facts.fullDefault.tests,parent.facts.fullDefault.pass,parent.facts.fullDefault.registeredFiles],[7907,7907,149]);const find=name=>{const p=[...b.records,...b.history,...LOCKS.candidate].find(p=>p.path===name);assert.ok(p);return p;},I=J(b.records[0]),E=J(b.records[1]),H=J(b.records[2]),T1=J(b.records[3]),T2=J(b.records[4]),hud=tap(get(H.stdout));eq(I.accepted,true);eq(I.nativeReadsChanged,false);eq(I.debugDtoShapeChanged,false);eq([I.oldWorktreeWrites,I.newGameInputs],[0,0]);for(const f of [...I.files,...I.pages])eq(f.after,LOCKS.criticalPins.find(p=>p.path===f.after.path));const inverse=J(find('build/city-resource-icons-candidate-v1/mechanical-source-diff-v1.json'));for(const f of inverse.files){let source=get(f.candidate).toString('utf8');for(const change of [...f.changes].reverse()){eq(source.split(change.replacement).length-1,change.occurrences);source=source.replaceAll(change.replacement,change.old);}eq(Buffer.from(source),get(f.preservedBefore));}eq(E.accepted,true);eq(E.sources,LOCKS.oldCriticalPins.slice(0,13));for(const f of E.changes){eq(f.lineEndingsOnly,true);eq(v45Pin(f.after.path,Buffer.from(get(f.before).toString('latin1').replaceAll('\r\n','\n'),'latin1')),f.after);}const attrBefore=get(find(B+'attributes-before-runtime-lf-v1')),attrs=get(LOCKS.criticalPins.find(p=>p.path==='.gitattributes')),suffix='\n'+E.changes.map(f=>'/'+f.after.path+' text eol=lf').join('\n')+'\n';eq(attrs,Buffer.concat([attrBefore,Buffer.from(suffix)]));eq(H.accepted,true);eq(H.processExitCode,0);eq(H.sourceBytesStable,true);eq(H.sources,E.sources);for(const[k,v]of Object.entries(hud))eq(H[k],v);eq([hud.tests,hud.pass,hud.fail,hud.cancelled,hud.skipped,hud.todo],[190,190,0,0,0,0]);eq(get(H.stderr).length,0);eq([H.newDefaultTests,H.registeredFiles,H.parentFullSavedTests],[2,149,7907]);eq(H.newCodeFullDefaultRun,false);
 const E2=J(b.currentEpoch),H2=J(b.currentHud),hud2=tap(get(H2.stdout));eq(E2.accepted,true);eq(E2.parentEpoch,b.records[1]);eq(E2.sources,LOCKS.criticalPins.slice(0,13));eq(E2.productionBytesUnchanged,true);eq(E2.changes.length,1);eq(E2.changes[0].after,LOCKS.criticalPins.find(p=>p.path==='scripts/test-hd-mobile-city-runtime.mjs'));const oldMain=LOCKS.oldCriticalPins.find(p=>p.path==='scripts/test-hd-mobile-city-runtime.mjs');eq(E2.changes[0].before,{...oldMain,path:LOCKS.failedDirectory+'executed-tool.mjs'});check(E2.changes[0].before,get(E2.changes[0].before));eq(E2.oldFailurePreserved,LOCKS.failedResult);eq(E2.oldFailureTerminal,b.failedCase.terminalTool);eq([E2.oldWorktreeWrites,E2.newGameInputs],[0,0]);for(let i=0;i<LOCKS.criticalPins.length;i++){eq(LOCKS.criticalPins[i].path,LOCKS.oldCriticalPins[i].path);if(LOCKS.criticalPins[i].path!=='scripts/test-hd-mobile-city-runtime.mjs')eq(LOCKS.criticalPins[i],LOCKS.oldCriticalPins[i]);}eq(H2.accepted,true);eq(H2.processExitCode,0);eq(H2.sourceBytesStable,true);eq(H2.sources,E2.sources);for(const[k,v]of Object.entries(hud2))eq(H2[k],v);eq([hud2.tests,hud2.pass,hud2.fail,hud2.cancelled,hud2.skipped,hud2.todo],[190,190,0,0,0,0]);eq(get(H2.stderr).length,0);eq([H2.newDefaultTests,H2.registeredFiles,H2.parentFullSavedTests],[2,149,7907]);eq(H2.newCodeFullDefaultRun,false);
 eq(T1.accepted,false);eq(T1.kind,'Targeted test recording failure retained');eq([T1.rawReportedTests,T1.rawReportedPass,T1.rawReportedFail,T1.nodeProcessExitCode,T1.recordingToolExitCode],[2,2,0,null,1]);eq(T1.productAssertionFailureObserved,false);eq(T2.accepted,true);eq(T2.controlledDomOnly,true);eq(T2.sourceBytesStable,true);eq(T2.processExitCode,0);eq(T2.priorRecorderFailure,b.records[3]);eq([T2.original188BodiesChanged,T2.newAppendedCases],[0,2]);const target=tap(get(T2.stdout));for(const[k,v]of Object.entries(target))eq(T2[k],v);eq([target.tests,target.pass,target.fail,target.cancelled,target.skipped,target.todo],[2,2,0,0,0,0]);eq(get(T2.stderr).length,0);const before2=J(T2.before);eq(before2.schemaVersion,1);eq(before2.sourceOnly,true);eq(before2.startedAt,T2.startedAt);eq(before2.sources,T2.sources);for(const p of T2.sources){if(p.path==='.gitattributes')eq([p.bytes,p.sha256],[attrBefore.length,v45Pin(p.path,attrBefore).sha256]);else eq(p,LOCKS.criticalPins.find(q=>q.path===p.path));}
 const proof=J(b.terminalProof);for(const[lane,p]of Object.entries(proof.closedToolPins)){const t=J(p);eq(t.chunk_id,b.terminals[lane].terminalChunk);eq(t.exit_code,b.terminals[lane].exitCode);assert.ok(!Object.hasOwn(t,'session_id'),'Raw tool has truly closed');}
 const build=J(LOCKS.criticalPins.find(p=>p.path==='js/baye.build.json'));for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const p=LOCKS.criticalPins.find(p=>p.path==='js/'+name);eq([p.bytes,p.sha256],[build.artifacts[name].bytes,build.artifacts[name].sha256]);}const rom=tools(get(LOCKS.criticalPins.find(p=>p.path==='libs/dat-mod.lib'))),layouts=[];for(const c of b.cases){const r=J(c.result),sv=J(c.sourceVerification);eq(r.ok,c.id!=='mobile');eq(r.accepted,c.id!=='mobile');eq(r.resourceIconsAccepted,c.id!=='mobile');eq(r.cleanup.treeExited,true);eq(r.cleanup.errors,[]);eq(r.profileRetained,true);eq(r.serverClosed,true);eq(r.exceptions,[]);eq(r.nativeTouches,[]);const sources=sourceRows(r,c,sv);if(c.id==='mobile')eq(sources.length,72);for(const p of (c.id==='mobile'?sources:sv.sources.map(p=>({path:p.source,bytes:p.bytes,sha256:p.sha256})))){const locked=LOCKS.criticalPins.find(q=>q.path===p.path);if(locked)eq(pin3(p),locked,'Recorded overlap remains exact '+p.path);}for(const name of ['js/hd-city-menu.js','css/hd-city-menu.css','scripts/hd-person-equipment-runtime-checks.mjs','scripts/hd-city-resource-runtime-checks.mjs'])eq(pin3(sources.find(p=>p.path===name)),LOCKS.criticalPins.find(p=>p.path===name));for(const e of c.executed){eq(get(e.file),get(e.source));assert.ok(sources.some(p=>isDeepStrictEqual(pin3(p),e.source)));}if(c.console){const console=J(c.console);eq(console.exceptions,[]);eq(console.dialogs,[]);eq(console.console,r.console);}const images=c.id==='mobile'?r.phases.flatMap(p=>[p.screenshot,p.actualCanvas].filter(Boolean)):r.phases.map(p=>({file:p.file,bytes:p.bytes,sha256:p.sha256}));eq(c.pngs,images.map(p=>({path:c.directory+p.file,bytes:p.bytes,sha256:p.sha256})));for(const p of c.pngs)eq([...get(p).subarray(0,8)],[137,80,78,71,13,10,26,10]);
 if(c.id==='mobile'){eq(c.result,LOCKS.currentMobileResult);eq(r.previewOnly,true);eq(r.previewAccepted,false);eq(r.previewChecks.length,1);eq(r.treatments,[]);eq(r.recruitments,[]);eq(r.sourceDrift,[]);assert.ok(r.error.includes('Timed out native explicit property page ACK'));const e=r.previewChecks[0];eq(e.label,'preview-844x390');eq(r.failureWorld,e.baseline.world);eq(resources(e.resourceIcons),5);eq(e.resourceStatusReturn.accepted,true);unchanged(e.resourceStatusReturn.before,e.resourceStatusReturn.after,e.resourceStatusReturn.keys);eq(e.resourceStatusReturn.after.state.cityUi.layer,'root');for(const v of e.resourceIcons.visible)eq([v.decoration.bounds.viewport.width,v.decoration.bounds.viewport.height],[844,390]);const diag=r.previewKeyDiagnostics;eq(diag.schemaVersion,1);eq(diag.scope,'preview-only readonly key dispatch diagnostics');eq(diag.exportInvocationIsNotNativeConsumptionAck,true);eq(diag.requestPrivateStateAvailable,false);eq(diag.publicKeyRecorderUnchanged,true);eq(diag.limits,{events:4096,calls:512,pollMs:100,windowMs:5000,pollsPerWindow:51});eq(diag.stopped,true);assert.ok(Array.isArray(diag.events)&&diag.events.length>0&&diag.events.length<=4096);eq([diag.observedCalls,diag.diagnosticErrors,diag.droppedEvents],[54,0,0]);const last=diag.events.at(-1);eq(last.kind,'observer-stop');eq([last.value.native.g_hdPersonPropertiesPaintSeq,last.value.native.g_hdPersonPropertiesPageIndex,last.value.native.g_hdPersonPropertiesPageStart,last.value.native.g_hdPersonPropertiesPageEnd],[40,4,10,12]);}
 else{eq(r.equipmentAccepted,true);eq(r.preflightOnly,false);eq(r.viewport,c.id==='pc1080'?{width:1920,height:1080}:{width:1280,height:720});eq(r.phases.length,8);eq(r.engineManifest,build);eq(r.nativeSourceCheck.aggregate,build.engineSourceSha256);eq(r.nativeSourceCheck.count,128);eq(r.final.world,r.initialWorld);eq(r.people.map(p=>p.personId),[20,0,19]);eq(r.isolation.cleaned,true);eq(r.isolation.chromeExited,true);eq(r.isolation.httpClosed,true);eq(r.isolation.user8080Touched,false);eq(r.dialogs,[]);eq(r.resourceStatus.accepted,true);eq(resources(r.resourceStatus.resourceIcons),5);unchanged(r.resourceStatus.rootBefore,r.resourceStatus.rootAfter,r.resourceStatus.keys);eq(r.resourceStatus.rootAfter.state.cityUi.layer,'root');eq(r.resourceStatus.rootAfter.state.cityUi.cityIndex,r.resourceStatus.resourceIcons.cityIndex);for(const v of [...r.resourceStatus.resourceIcons.visible,...r.people.flatMap(e=>e.equipmentCards).flatMap(p=>p.visible)])eq([v.decoration.bounds.viewport.width,v.decoration.bounds.viewport.height],[r.viewport.width,r.viewport.height]);const cards=r.people.flatMap(e=>e.equipmentCards).map(e=>cardProof(e,rom));eq(cards.reduce((n,p)=>n+p.cards,0),3);eq(cards.reduce((n,p)=>n+p.rows,0),18);layouts.push({id:c.id,viewport:[r.viewport.width,r.viewport.height],resourceRows:5,cards:3,equipmentRows:18,emulated:false});}}
 for(const image of b.images){const c=image.id==='mobile844v1'?b.failedCase:b.cases.find(c=>c.id===(image.id==='mobile844v2'?'mobile':image.id)),r=J(c.result),mobile=c.id==='mobile'||c.id==='failed';assert.ok(c.pngs.some(p=>isDeepStrictEqual(p,image.source)));const phase=r.phases.find(p=>image.source.path===c.directory+(mobile?p.screenshot?.file:p.file));assert.ok(phase);const label=mobile?phase.name:phase.label;if(mobile){assert.ok(label.startsWith('preview-844x390-')&&label.endsWith('-city-resource-Money'));eq(phase.state.cityUi.layer,'status');}else{eq(label,'city-resource-Money');eq(phase.sample.state.cityUi.layer,'status');}}
 const f=b.failedCase,fr=J(f.result),fsv=J(f.sourceVerification),ft=J(f.terminalTool);eq(ft.chunk_id,'0d47ea');eq(ft.exit_code,1);assert.ok(!Object.hasOwn(ft,'session_id'));eq(fr.ok,false);eq(fr.accepted,false);eq(fr.previewAccepted,false);eq(fr.resourceIconsAccepted,false);eq(fr.previewOnly,true);eq(fr.previewChecks.length,1);eq(fr.failureWorld,fr.previewChecks[0].baseline.world);eq(resources(fr.previewChecks[0].resourceIcons),5);eq(fr.treatments,[]);eq(fr.recruitments,[]);assert.ok(fr.error.includes('Timed out actual preview focus and current detail'));eq(fr.sourceFiles,fsv.sourceFiles);eq(fr.sourceFiles.length,72);eq(fr.sourceDrift,[]);eq(fsv.sourceDrift,[]);eq(fr.exceptions,[]);eq(fr.cleanup.treeExited,true);eq(fr.cleanup.errors,[]);eq(fr.serverClosed,true);eq(fr.profileRetained,true);for(const p of fr.sourceFiles){const locked=LOCKS.oldCriticalPins.find(q=>q.path===p.path);if(locked)eq(pin3(p),locked);}for(const e of f.executed){eq(v45Pin(e.source.path,get(e.file)),e.source);assert.ok(fr.sourceFiles.some(p=>isDeepStrictEqual(pin3(p),e.source)));}eq(f.pngs,fr.phases.flatMap(p=>[p.screenshot,p.actualCanvas].filter(Boolean)).map(p=>({path:f.directory+p.file,bytes:p.bytes,sha256:p.sha256})));for(const p of f.pngs)eq([...get(p).subarray(0,8)],[137,80,78,71,13,10,26,10]);
 return{scope:'Partial original CITY resource icons: two PC layouts accepted; two failed mobile844 runs retained',dataReproducible:true,pcAccepted:true,mobileAccepted:false,simulated667Executed:false,layouts,cityResourceRows:10,equipmentCards:6,equipmentRows:36,mobileResourceObservations:[{run:'mobile-v1',viewport:[844,390],resourceRows:5,resourceInspectionAccepted:true,wholeRunAccepted:false},{run:'mobile-v2',viewport:[844,390],resourceRows:5,resourceInspectionAccepted:true,wholeRunAccepted:false}],mobileResourceRowsNotAdditionalLayouts:true,hud:{tests:190,pass:190,newAppendedCases:2,notAddedToSavedBaseline:true},targetedSubset:{tests:2,pass:2,notAddedToHud:true,priorSpecRecordingFailureRetained:true,productAssertionFailureObserved:false},parentBaseline:{canonical:LOCKS.parentBaseline,tests:7907,registeredFiles:149,savedParentOnly:true,newCodeFullRun:false},currentCriticalFiles:19,sourceEpochs:{oldEpoch:b.records[1],currentEpoch:b.currentEpoch,onlyChangedSource:'scripts/test-hd-mobile-city-runtime.mjs',oldByteAlias:LOCKS.failedDirectory+'executed-tool.mjs',pcProductionUnchanged:true},failedMobile:{result:wholePin(b,'failed'),terminal:f.terminal,accepted:false,completeOriginalRetained:true,causeDiagnosed:false,notRewrittenByFreshRun:true,sourceCount:72},currentMobileFailure:{result:wholePin(b),terminal:b.terminals.mobile,accepted:false,completeOriginalRetained:true,error:'Timed out native explicit property page ACK',causeDiagnosed:false,observedCalls:54,diagnosticErrors:0,droppedEvents:0,exportInvocationIsNotNativeConsumptionAck:true},mobileStorage:{wholePin:wholePin(b),wholeRawReassembledBeforeJson:true,unknownFieldsPreserved:true,codecBoundsUnchanged:true},resourceAndCardInspectionNativeKeys:0,resourceAndCardInspectionLcdTouches:0,businessLoadSaveEndMarchIncomeOrBattleOperations:0,mainP57Touched:false,oldHeldTouched:false,completeAbiQualified:false,packedSaveQualified:false,rngContinuityQualified:false,realDeviceAccepted:false,cloudAccepted:false,fullHdAccepted:false,globalHdComplete:false};}
export function portableReader(bytes){const a="'../../../docs/"+'validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs\'',z="'./m5-quantity-"+'ack-refresh-20261024-v45-verify.mjs\'',s=bytes.toString('utf8');eq(s.split(a).length-1,1);return Buffer.from(s.replace(a,z));}
const packetId=(id,i)=>(id==='failed'?'failed-mobile-':'mobile-')+String(i+1).padStart(3,'0');
function chunkInfo(b,id){return id==='failed'?{info:b.failedCase.wholeChunks,terminal:b.failedCase.terminal,dir:FAILED_CHUNKS}:{info:b.mobileChunks,terminal:b.terminals.mobile,dir:CHUNKS};}
export function chunkManifest(m,b,input,id='mobile'){const{info,terminal:t,dir}=chunkInfo(b,id);eq(V45_BOUNDS,ORIGINAL_BOUNDS);eq(input.schemaVersion,1);eq(input.source,wholePin(b,id));eq(input.terminal,t);eq(m.schemaVersion,1);eq(m.kind,'whole-original-mobile-raw-byte-chunks');eq(m.source,wholePin(b,id));eq(m.input,info.input);eq(m.maximumChunkBytes,V45_BOUNDS.maxFileBytes);const count=Math.ceil(m.source.bytes/V45_BOUNDS.maxFileBytes);eq(m.chunkCount,count);eq(m.chunks.length,count);let offset=0;for(let i=0;i<count;i++){const c=m.chunks[i];eq(c.ordinal,i);eq(c.offset,offset);eq(c.pin.path,dir+'chunk-'+String(i+1).padStart(3,'0')+'.raw');eq(c.pin.bytes,Math.min(V45_BOUNDS.maxFileBytes,m.source.bytes-offset));pin3(c.pin);offset+=c.pin.bytes;}eq(offset,m.source.bytes);eq(m.originalJsonParsed,false);eq(m.compressed,false);eq(m.sourceBytesChanged,false);return m;}
export function packetPins(b,J,bindingPin){requireBinding(b);const groups=['mobile','failed'].map(id=>{const{info}=chunkInfo(b,id);return{id,m:chunkManifest(J(info.manifest),b,J(info.input),id)};}),wholes=['mobile','failed'].map(id=>wholePin(b,id)),logical=[...selected(b,J),pin3(bindingPin)].sort((a,z)=>a.path<z.path?-1:a.path>z.path?1:0),core=logical.filter(p=>!wholes.some(q=>p.path===q.path));for(const whole of wholes)eq(logical.filter(p=>p.path===whole.path),[whole]);for(const p of core){pin3(p);for(const id of ['mobile','failed']){const{dir,info}=chunkInfo(b,id);assert.ok(!p.path.startsWith(dir)||p.path===info.manifest.path);}}return[{id:'core',files:core},...groups.flatMap(({id,m})=>m.chunks.map((c,i)=>({id:packetId(id,i),files:[c.pin]})))];}
export function restoreMobile(core,chunks,b){const get=p=>check(p,core.get(p.path)),groups=['mobile','failed'].map(id=>{const{info}=chunkInfo(b,id);return{id,m:chunkManifest(json(get(info.manifest)),b,json(get(info.input)),id)};}),expected=groups.flatMap(g=>g.m.chunks.map(c=>c.pin.path));eq([...chunks.keys()].sort(),expected.sort());const logical=new Map(core);for(const{id,m}of groups){const whole=wholePin(b,id),parts=[];let offset=0;for(const c of m.chunks){eq(c.offset,offset);const bytes=check(c.pin,chunks.get(c.pin.path));parts.push(bytes);offset+=bytes.length;}eq(offset,whole.bytes);assert.ok(!core.has(whole.path));const raw=Buffer.concat(parts,whole.bytes);eq(v45Pin(whole.path,raw),whole);logical.set(whole.path,raw);}return logical;}
export function verify(root,{readPublic,readCurrent}={}){readPublic??=((p,max)=>safeRead(root,p,max));readCurrent??=((p,max)=>safeRead(root,p,max));eq(V45_BOUNDS,ORIGINAL_BOUNDS);check(LOCKS.codec,readCurrent(LOCKS.codec.path,LOCKS.codec.bytes));const C=json(readPublic(PREFIX+'.json',2*1024*1024));eq(C.schemaVersion,1);eq(C.prefix,PREFIX);assert.ok(C.packets.length>=4&&C.packets.length<=65);eq(C.packets[0].id,'core');assert.ok(C.packets.slice(1).every(p=>/^(?:mobile|failed-mobile)-[0-9]{3}$/.test(p.id)));const core=new Map(),chunks=new Map();for(const p of C.packets){eq(p.index.path,PREFIX+'-'+p.id+'-archive-index.json');const index=json(check(p.index,readPublic(p.index.path,2*1024*1024)));eq(index.files.map(pin3),p.files);eq(index.parts.map(x=>x.path),index.parts.map((x,i)=>PREFIX+'-'+p.id+'-archive-part'+String(i+1).padStart(3,'0')+'.json'));const decoded=decodeV45Archive({index,readPart:(q,max)=>readPublic(q,max)});for(const[name,bytes]of decoded.files){const target=p.id==='core'?core:chunks;assert.ok(!target.has(name));target.set(name,bytes);}}eq(C.binding.path,BINDING);const b=json(check(C.binding,core.get(BINDING)));requireBinding(b);const J=p=>json(check(p,core.get(p.path)));eq(C.packets.map(({id,files})=>({id,files})),packetPins(b,J,C.binding));const logical=restoreMobile(core,chunks,b),original=check(b.readerSource,core.get(READER));eq(C.reader.path,PREFIX+'-verify.mjs');eq(check(C.reader,readPublic(C.reader.path,1024*1024)),portableReader(original));const facts=verifyData(logical,b,readCurrent);eq(C.facts,facts);eq(C.images.map(p=>p.path),b.images.map(p=>p.publicPath));for(const image of b.images){const p=C.images.find(p=>p.path===image.publicPath);eq(check(p,readPublic(p.path,V45_BOUNDS.maxFileBytes)),logical.get(image.source.path));}eq(C.markdown.path,PREFIX+'.md');check(C.markdown,readPublic(C.markdown.path,1024*1024));return{accepted:true,facts,archive:{logicalFiles:logical.size,physicalFiles:core.size+chunks.size,packets:C.packets.length,wholeMobileBytes:wholePin(b).bytes,wholeMobileChunks:C.packets.filter(p=>/^mobile-/.test(p.id)).length,failedWholeMobileBytes:wholePin(b,'failed').bytes,failedWholeMobileChunks:C.packets.filter(p=>/^failed-mobile-/.test(p.id)).length}};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){eq(process.argv.slice(2),['--verify']);console.log(JSON.stringify(verify(process.cwd())));}
