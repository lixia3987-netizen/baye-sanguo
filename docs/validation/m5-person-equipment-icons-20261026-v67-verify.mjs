/** Read-only V67 data verifier. No archived source, project helper or browser runs. */
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {isDeepStrictEqual} from 'node:util';
import {decodeV45Archive,v45Pin,V45_BOUNDS} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
export const B='build/equipment-icons-20261026-v67/',D=B+'evidence-source-v1/',PREFIX='docs/validation/m5-person-equipment-icons-20261026-v67';
export const READER=D+'v67-equipment-reader-v6.mjs',PUBLISHER=D+'publish-v67-equipment-v6.mjs',BINDING=D+'root-bindings-v1.json';
export const LOCKS={
  "schemaVersion": 1,
  "productPins": [
    {
      "path": "js/hd-city-menu.js",
      "bytes": 433456,
      "sha256": "71792cdfd2d6689e0b32011df1b317e056f29408133329c834eb95fb4bea437f"
    },
    {
      "path": "css/hd-city-menu.css",
      "bytes": 15365,
      "sha256": "4ce218279c71adcc49fa35a1f8dfadb00b93fb2601371f67c2d487e80c2a9081"
    },
    {
      "path": "scripts/test-hd-city-hud.mjs",
      "bytes": 128839,
      "sha256": "c3988b69375c7ecbd5ffef637c76841e8fade19f19da06a700cda2d0e7209fb6"
    },
    {
      "path": "pc.html",
      "bytes": 28673,
      "sha256": "7324640cdf6661aca0a456a8700c5453b785891139432a0196f25bdb25c19754"
    },
    {
      "path": "m.html",
      "bytes": 18472,
      "sha256": "b06e5d9a7abb5b9501f9995ae790a2867f0c6a97461d628c5d4b628b2d5dc595"
    },
    {
      "path": "scripts/hd-person-equipment-runtime-checks.mjs",
      "bytes": 10661,
      "sha256": "6e27d7094185dd69dec1cb746a78b39b4596899ab6edd8d13e09680a5a4953fe"
    },
    {
      "path": "package.json",
      "bytes": 21183,
      "sha256": "809fd447dd1177d6af707c189c4a0408011c1bfe5a78816012a21a09bc7a140d"
    },
    {
      "path": ".gitattributes",
      "bytes": 40897,
      "sha256": "6b5bdd067485f902181259124ea1443bd93d403fc3c6a7da148f99f0b06cec21"
    }
  ],
  "criticalPins": [
    {
      "path": "js/hd-city-menu.js",
      "bytes": 433456,
      "sha256": "71792cdfd2d6689e0b32011df1b317e056f29408133329c834eb95fb4bea437f"
    },
    {
      "path": "css/hd-city-menu.css",
      "bytes": 15365,
      "sha256": "4ce218279c71adcc49fa35a1f8dfadb00b93fb2601371f67c2d487e80c2a9081"
    },
    {
      "path": "scripts/test-hd-city-hud.mjs",
      "bytes": 128839,
      "sha256": "c3988b69375c7ecbd5ffef637c76841e8fade19f19da06a700cda2d0e7209fb6"
    },
    {
      "path": "pc.html",
      "bytes": 28673,
      "sha256": "7324640cdf6661aca0a456a8700c5453b785891139432a0196f25bdb25c19754"
    },
    {
      "path": "m.html",
      "bytes": 18472,
      "sha256": "b06e5d9a7abb5b9501f9995ae790a2867f0c6a97461d628c5d4b628b2d5dc595"
    },
    {
      "path": "scripts/hd-person-equipment-runtime-checks.mjs",
      "bytes": 10661,
      "sha256": "6e27d7094185dd69dec1cb746a78b39b4596899ab6edd8d13e09680a5a4953fe"
    },
    {
      "path": "package.json",
      "bytes": 21183,
      "sha256": "809fd447dd1177d6af707c189c4a0408011c1bfe5a78816012a21a09bc7a140d"
    },
    {
      "path": ".gitattributes",
      "bytes": 40897,
      "sha256": "6b5bdd067485f902181259124ea1443bd93d403fc3c6a7da148f99f0b06cec21"
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
      "path": "scripts/test-hd-person-equipment-runtime.mjs",
      "bytes": 34588,
      "sha256": "cddf31b5f2d96155c4cc39e84554acc29f7b17a4fbf0603ff56d6020250fb371"
    },
    {
      "path": "scripts/test-hd-mobile-city-runtime.mjs",
      "bytes": 118104,
      "sha256": "21b33e49b5611baf29f0f4c0b2dd3b3da99472a90947f44f8b48df2c427b252b"
    },
    {
      "path": "scripts/hd-mobile-preview-runtime-checks.mjs",
      "bytes": 18631,
      "sha256": "91d996dad796f450c61d298e120fc93062ee4dbaf6e7283a5608d4ebc9abcd13"
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
  "library": {
    "path": "libs/dat-mod.lib",
    "bytes": 207195,
    "sha256": "3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e"
  },
  "records": [
    {
      "path": "build/equipment-icons-20261026-v67/source-integration-v4.json",
      "bytes": 3198,
      "sha256": "d094f58738bdb721b8fb5ba8330da3aa8cd6cf1edb8aca0dfcda8238ccf6d2cf"
    },
    {
      "path": "build/equipment-icons-20261026-v67/runtime-check-integration-v1.json",
      "bytes": 844,
      "sha256": "c9fc2169b745d84af7e239c6a0803ff371063dc04e5a3d8bb905530a23bcf6ad"
    },
    {
      "path": "build/equipment-icons-20261026-v67/checkout-normalization-v1.json",
      "bytes": 555,
      "sha256": "d6dc104635ad76a438fa6afa006bc66a1cbb495a74f3119b9d728bc4ac894ccc"
    },
    {
      "path": "build/equipment-icons-20261026-v67/checkout-test-normalization-v1.json",
      "bytes": 404,
      "sha256": "f9ce6101ac01b4378ce53eec2c1fd2f477b85f5c5ffb5ce45c5a688d93088f3c"
    },
    {
      "path": "build/equipment-icons-20261026-v67/native-checkout-normalization-v3.json",
      "bytes": 7616,
      "sha256": "a364930905bd52dec8ac576e27f3cf9615483b49673e1e334c0255dbbda59574"
    },
    {
      "path": "build/equipment-icons-20261026-v67/overworld-lf-repair-v1.json",
      "bytes": 2039,
      "sha256": "54e1672452db354ad34e4aa419e3fda2cb8b799318bcf306989bc3b056767f1c"
    },
    {
      "path": "build/equipment-icons-20261026-v67/lf-repair-target-v1.json",
      "bytes": 1215,
      "sha256": "adc6c3c30b9768a4adfb0380a5f1492d076567416ebbe875ed2d25a8c104e62a"
    }
  ],
  "history": [
    {
      "path": "build/equipment-icons-20261026-v67/integrated-hud-v1.stdout.tap",
      "bytes": 45518,
      "sha256": "3a55c267343030046632642cc86f6ed4b2d563db608e72189e11c17ecc36c8e7"
    },
    {
      "path": "build/equipment-icons-20261026-v67/integrated-hud-v2.stdout.tap",
      "bytes": 46051,
      "sha256": "e4438b3aeb00b401efe17c3146991a66e6373cda401b58c85fe2cf3cfa56a60d"
    },
    {
      "path": "build/equipment-icons-20261026-v67/preflight-v1/result.json",
      "bytes": 767132,
      "sha256": "5a7d50dd7793ef9874cccf3f6ad32effd7b002be7cb0273c0d290bc767d81ad3"
    },
    {
      "path": "build/equipment-icons-20261026-v67/preflight-v1/source-verification.json",
      "bytes": 434471,
      "sha256": "b1a594549406f5405a7fc12216108a77bcc7e3dbb33cacfdd2bf67c1331943ee"
    },
    {
      "path": "build/equipment-icons-20261026-v67/preflight-v1/browser-console.json",
      "bytes": 70,
      "sha256": "46568dae8c3ff6247fe1b949b4a578213e6a7e355676c582a97cf1417bf5341e"
    },
    {
      "path": "build/equipment-icons-20261026-v67/preflight-v2/result.json",
      "bytes": 789093,
      "sha256": "13a794a4b4f91c079af6fde97f5bbbaae3dffd0b0294f9848f5cb8ad377a481e"
    },
    {
      "path": "build/equipment-icons-20261026-v67/preflight-v2/source-verification.json",
      "bytes": 434470,
      "sha256": "f10a2339c03f8d56f1f770d85b335c3ff8cdfa4d3a52fb4590952d79a89621f8"
    },
    {
      "path": "build/equipment-icons-20261026-v67/preflight-v2/browser-console.json",
      "bytes": 70,
      "sha256": "46568dae8c3ff6247fe1b949b4a578213e6a7e355676c582a97cf1417bf5341e"
    },
    {
      "path": "build/equipment-icons-20261026-v67/checkout-css-crlf-before-v1.css",
      "bytes": 15484,
      "sha256": "e00f700c3450b1a52e9e7537c31f8bd1112d86fa151176d1aae768bab4a9a29c"
    },
    {
      "path": "build/equipment-icons-20261026-v67/checkout-test-crlf-before-v1.mjs",
      "bytes": 125631,
      "sha256": "580ae039556197203f2cf79c311c8201f6c66e3163c054fade427100ea7578a4"
    },
    {
      "path": "build/equipment-icons-20261026-v67/runtime-mechanical-source-inverse-v1.json",
      "bytes": 7858,
      "sha256": "46c87dbf0b972ffdb4459d5f4895dce2cdc9e52d76e98c453a309cefec600e4a"
    },
    {
      "path": "build/equipment-icons-20261026-v67/runtime-source-preparation-v1.json",
      "bytes": 2137,
      "sha256": "10386d61d92e67c264c6651ce096108f580b399da4f0cf4ae37d73d6c415b273"
    },
    {
      "path": "build/equipment-icons-20261026-v67/full-default-v1.json",
      "bytes": 1700,
      "sha256": "52f63d2a7a2e4d8d967be8f5c674ba83b8e1ca9aa50ae1cbcfcefe2af3a17e3f"
    },
    {
      "path": "build/equipment-icons-20261026-v67/full-default-v1.before.json",
      "bytes": 277108,
      "sha256": "0096c2584062b11dfaee9a4dd97088afbc3d58b923a0778944ca984c2b263a77"
    },
    {
      "path": "build/equipment-icons-20261026-v67/full-default-v1.stdout.tap",
      "bytes": 1625118,
      "sha256": "f08cfab38075314a28120518c21394d618e78960e68b894b20a71786980b1ccd"
    },
    {
      "path": "build/equipment-icons-20261026-v67/full-default-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/equipment-icons-20261026-v67/raw-full-v1-terminal-tool-v1.json",
      "bytes": 409,
      "sha256": "d192c42d44ee19650cd1ddf651f5a35a8ad64d51b67374ef18b20dc488792d94"
    },
    {
      "path": "build/equipment-icons-20261026-v67/lf-repair-before/gitattributes",
      "bytes": 40742,
      "sha256": "2cb1aa8df29e99cdbdddabd51140eff32fc6f6f124c697e13fb095a9d9f40177"
    },
    {
      "path": "build/equipment-icons-20261026-v67/lf-repair-before/js/hd-overworld-layers.js",
      "bytes": 5819,
      "sha256": "412dfac7163f9d97b2f0b216e029037da9d78efa6f5071c19a3c5a16c033dccb"
    },
    {
      "path": "build/equipment-icons-20261026-v67/lf-repair-before/scripts/test-hd-overworld-layers.mjs",
      "bytes": 11846,
      "sha256": "a73c05ec66e8fc1bf4d054e363313a9f1e0576c3be5a1ea9ea338e52d809d7a9"
    },
    {
      "path": "build/equipment-icons-20261026-v67/lf-repair-target-v1.stdout.tap",
      "bytes": 3585,
      "sha256": "8f401ef362ba0383c5794e86f73a01bcead7542ad6defe494ad974a2b51c2e24"
    },
    {
      "path": "build/equipment-icons-20261026-v67/lf-repair-target-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ],
  "codec": {
    "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
    "bytes": 32262,
    "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
  },
  "caseDirectories": {
    "pc1080": "build/equipment-icons-20261026-v67/pc1080-v1/",
    "pc720": "build/equipment-icons-20261026-v67/pc720-v1/",
    "mobile": "build/equipment-icons-20261026-v67/mobile-preview-v1/"
  },
  "mobileChunkManifest": {
    "path": "build/equipment-icons-20261026-v67/evidence-source-v1/mobile-chunks-v1/manifest.json",
    "bytes": 1919,
    "sha256": "7ac6efb70beef0eb4ee0ff2aa88f24d996c43a219e26fcef34ff565342ebfb41"
  },
  "fullV2Before": {
    "path": "build/equipment-icons-20261026-v67/full-default-v2.before.json",
    "bytes": 277108,
    "sha256": "d5234824621d3303e0b24a92acdb8eba542866a878a62b455f1f905e64c955a6"
  },
  "lfRepair": {
    "failedFull": {
      "path": "build/equipment-icons-20261026-v67/full-default-v1.json",
      "bytes": 1700,
      "sha256": "52f63d2a7a2e4d8d967be8f5c674ba83b8e1ca9aa50ae1cbcfcefe2af3a17e3f"
    },
    "terminalTool": {
      "path": "build/equipment-icons-20261026-v67/raw-full-v1-terminal-tool-v1.json",
      "bytes": 409,
      "sha256": "d192c42d44ee19650cd1ddf651f5a35a8ad64d51b67374ef18b20dc488792d94"
    },
    "terminal": {
      "closed": true,
      "sessionId": 42841,
      "initialChunk": "c0e290",
      "terminalChunk": "8631b9",
      "exitCode": 1
    },
    "target": {
      "path": "build/equipment-icons-20261026-v67/lf-repair-target-v1.json",
      "bytes": 1215,
      "sha256": "adc6c3c30b9768a4adfb0380a5f1492d076567416ebbe875ed2d25a8c104e62a"
    },
    "changes": [
      {
        "source": "js/hd-overworld-layers.js",
        "before": {
          "path": "build/equipment-icons-20261026-v67/lf-repair-before/js/hd-overworld-layers.js",
          "bytes": 5819,
          "sha256": "412dfac7163f9d97b2f0b216e029037da9d78efa6f5071c19a3c5a16c033dccb"
        },
        "after": {
          "path": "js/hd-overworld-layers.js",
          "bytes": 5717,
          "sha256": "c1146dd116191c4bc450c8e581b77d1239d036608ad56a664192d527dc6e773a"
        },
        "normalizedExactlyEqualsCommittedBlob": true
      },
      {
        "source": "scripts/test-hd-overworld-layers.mjs",
        "before": {
          "path": "build/equipment-icons-20261026-v67/lf-repair-before/scripts/test-hd-overworld-layers.mjs",
          "bytes": 11846,
          "sha256": "a73c05ec66e8fc1bf4d054e363313a9f1e0576c3be5a1ea9ea338e52d809d7a9"
        },
        "after": {
          "path": "scripts/test-hd-overworld-layers.mjs",
          "bytes": 11652,
          "sha256": "238a47836804d8a32b4c46ca315fc161e2cb0774448a4d3fa1db463cfbc06de7"
        },
        "normalizedExactlyEqualsCommittedBlob": true
      }
    ],
    "attributesBefore": {
      "path": "build/equipment-icons-20261026-v67/lf-repair-before/gitattributes",
      "bytes": 40742,
      "sha256": "2cb1aa8df29e99cdbdddabd51140eff32fc6f6f124c697e13fb095a9d9f40177"
    },
    "attributesAfter": {
      "path": ".gitattributes",
      "bytes": 40897,
      "sha256": "6b5bdd067485f902181259124ea1443bd93d403fc3c6a7da148f99f0b06cec21"
    },
    "attributeSuffix": "\n# Preserve the renderer LF contract on a fresh Windows checkout.\n/js/hd-overworld-layers.js text eol=lf\n/scripts/test-hd-overworld-layers.mjs text eol=lf\n",
    "targetSources": [
      {
        "path": "js/hd-overworld-layers.js",
        "bytes": 5717,
        "sha256": "c1146dd116191c4bc450c8e581b77d1239d036608ad56a664192d527dc6e773a"
      },
      {
        "path": "scripts/test-hd-overworld-layers.mjs",
        "bytes": 11652,
        "sha256": "238a47836804d8a32b4c46ca315fc161e2cb0774448a4d3fa1db463cfbc06de7"
      },
      {
        "path": ".gitattributes",
        "bytes": 40897,
        "sha256": "6b5bdd067485f902181259124ea1443bd93d403fc3c6a7da148f99f0b06cec21"
      }
    ]
  }
};
const eq=(a,b,m='Whole original V67 data')=>assert.ok(isDeepStrictEqual(a,b),m),json=b=>JSON.parse(b.toString('utf8')),FIELDS=['useFlag','attack','iq','move','arm','changeAttackRange'],LABELS=['用法','武力加成','智力加成','移动加成','兵种变化','攻击范围'];
export function pin3(p){assert.ok(p&&typeof p==='object');relative(p.path);if(p.path===MOBILE_WHOLE.path){eq(p,MOBILE_WHOLE,'Only the one measured whole mobile file is reassembled above codec maxFileBytes');return{...MOBILE_WHOLE};}assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&p.bytes<=V45_BOUNDS.maxFileBytes);assert.match(p.sha256,/^[0-9a-f]{64}$/);return{path:p.path,bytes:p.bytes,sha256:p.sha256};}
export function check(p,b){assert.ok(Buffer.isBuffer(b));eq(v45Pin(p.path,b),pin3(p),'Exact source bytes '+p.path);return b;}
function relative(p){assert.equal(typeof p,'string');assert.ok(p&&!path.isAbsolute(p)&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'));return p;}
export function safeRead(root,p,max=V45_BOUNDS.maxFileBytes){relative(p);assert.ok(Number.isSafeInteger(max)&&max>0&&max<=V45_BOUNDS.maxFileBytes);const base=fs.realpathSync.native(root);let q=base;const parts=p.split('/');for(let i=0;i<parts.length;i++){q=path.join(q,parts[i]);const s=fs.lstatSync(q);assert.ok(!s.isSymbolicLink());assert.ok(i===parts.length-1?s.isFile():s.isDirectory());}assert.ok(fs.realpathSync.native(q).startsWith(base+path.sep));const a=fs.lstatSync(q,{bigint:true});assert.ok(a.size<=BigInt(max));const b=fs.readFileSync(q),z=fs.lstatSync(q,{bigint:true});eq([z.dev,z.ino,z.size,z.mtimeNs],[a.dev,a.ino,a.size,a.mtimeNs]);eq(BigInt(b.length),a.size);return b;}
export function terminal(t){assert.ok(t);eq(t.closed,true);eq(t.exitCode,0);assert.match(t.terminalChunk,/^[0-9a-f]{6}$/);if(Object.hasOwn(t,'sessionId')){assert.ok(Number.isSafeInteger(t.sessionId)&&t.sessionId>0);assert.match(t.initialChunk,/^[0-9a-f]{6}$/);}return t;}
// Complete actual filename-to-source contracts. No optional execution copy.
function expectedExecuted(c){
 const pairs=c.id==='mobile'?[['executed-tool.mjs','scripts/test-hd-mobile-city-runtime.mjs'],['executed-equipment-helper.mjs','scripts/hd-person-equipment-runtime-checks.mjs'],['executed-preview-helper.mjs','scripts/hd-mobile-preview-runtime-checks.mjs']]:[['executed-tool.mjs','scripts/test-hd-person-equipment-runtime.mjs'],['executed-checks.mjs','scripts/hd-person-equipment-runtime-checks.mjs'],['executed-owned-chrome.mjs','scripts/hd-runtime-owned-chrome.mjs'],['executed-json.mjs','scripts/hd-runtime-json.mjs']];
 return pairs.map(([file,name])=>{const source=LOCKS.criticalPins.find(p=>p.path===name);assert.ok(source,'Exact existing critical executed source');return{file:{path:c.directory+file,bytes:source.bytes,sha256:source.sha256},source};});
}
export function requireBinding(b){eq(b.schemaVersion,1);eq(b.reviewed,true);eq(b.draftOnly,false);eq(b.prefix,PREFIX);eq(b.criticalPins,LOCKS.criticalPins);eq(b.records,LOCKS.records);eq(b.history,LOCKS.history);assert.ok(Array.isArray(b.supportPins)&&b.supportPins.length<=16);for(const p of b.supportPins)pin3(p);eq(Object.keys(b.terminals).sort(),['full','mobile','pc1080','pc720']);for(const t of Object.values(b.terminals))terminal(t);eq(b.terminals.pc1080,{closed:true,sessionId:60000,initialChunk:'98427a',terminalChunk:'a5a4cc',exitCode:0});eq(b.terminals.pc720,{closed:true,sessionId:68421,initialChunk:'b8b8e5',terminalChunk:'35cd9a',exitCode:0});eq(b.terminals.mobile,{closed:true,sessionId:33395,initialChunk:'af0ce9',terminalChunk:'73102d',exitCode:0});assert.ok(b.mobileChunks);pin3(b.mobileChunks.manifest);eq(b.mobileChunks.manifest,LOCKS.mobileChunkManifest);eq(b.terminals.full.sessionId,46256);eq(b.terminals.full.initialChunk,'dec894');eq(b.full.before,LOCKS.fullV2Before);for(const[k,suffix]of Object.entries({receipt:'.json',before:'.before.json',stdout:'.stdout.tap',stderr:'.stderr.log'}))eq(b.full[k].path,B+'full-default-v2'+suffix);for(const p of [b.terminalProof,b.full.receipt,b.full.before,b.full.stdout,b.full.stderr,b.readerSource,b.publisherSource,...b.records,...b.history])pin3(p);eq(b.readerSource.path,READER);eq(b.publisherSource.path,PUBLISHER);eq(b.cases.map(c=>c.id),['pc1080','pc720','mobile']);for(const c of b.cases){eq(c.directory,LOCKS.caseDirectories[c.id]);eq(c.result.path,c.directory+'result.json');eq(c.sourceVerification.path,c.directory+'source-verification.json');if(c.console)eq(c.console.path,c.directory+'browser-console.json');pin3(c.result);pin3(c.sourceVerification);assert.ok(Array.isArray(c.executed));eq(c.executed,expectedExecuted(c),'Complete original PC4/mobile3 executed copies, exact filename/source/bytes');for(const e of c.executed){pin3(e.file);pin3(e.source);}if(c.console)pin3(c.console);else eq(c.id,'mobile','Only mobile embeds console in result');assert.ok(Array.isArray(c.pngs)&&c.pngs.length);for(const p of c.pngs)pin3(p);}eq(b.images.map(x=>x.id),['pc1080','pc720','mobile844','mobile667']);for(const p of b.images){pin3(p.source);eq(p.publicPath,PREFIX+'-'+p.id+'.png');}}
export function selected(b,J){requireBinding(b);const rows=[...LOCKS.productPins,LOCKS.library,b.readerSource,b.publisherSource,...b.supportPins,b.terminalProof,b.mobileChunks.manifest,...b.records,...b.history,b.full.receipt,b.full.before,b.full.stdout,b.full.stderr];const I=J(b.records.find(p=>p.path===B+'source-integration-v4.json')),R=J(b.records.find(p=>p.path===B+'runtime-check-integration-v1.json')),N=J(b.records.find(p=>p.path===B+'native-checkout-normalization-v3.json'));rows.push(...I.production.map(p=>p.before),...I.pages.map(p=>p.before),R.canonicalBefore,R.checkoutBefore);for(const p of N.changed)rows.push({path:p.beforeAlias,bytes:p.checkoutBytes,sha256:p.checkoutSha256});for(const c of b.cases)rows.push(c.result,c.sourceVerification,...(c.console?[c.console]:[]),...c.executed.map(e=>e.file),...c.pngs);const proof=J(b.terminalProof);eq(proof.schemaVersion,1);eq(proof.terminals,b.terminals);assert.ok(Array.isArray(proof.rawProofPins)&&proof.rawProofPins.length>=4);rows.push(...proof.rawProofPins);const map=new Map();for(const p of rows){const q=pin3(p);assert.ok(LOCKS.productPins.some(v=>v.path===q.path)||q.path===LOCKS.library.path||q.path.startsWith(B));assert.ok(!q.path.split('/').some(x=>/^(?:private-browser-profile|profile|frozen-public|frozen-node)$/.test(x)));const old=map.get(q.path);if(old)eq(old,q);else map.set(q.path,q);}return[...map.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
function tap(b){const s=b.toString('utf8'),r={};for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const rows=[...s.matchAll(new RegExp('^# '+k+' ([0-9.]+)\\r?$','gm'))];eq(rows.length,1,'One final TAP '+k);r[k]=Number(rows[0][1]);}return r;}
function tools(lib){eq(lib.length,207195);const item=(resource,index)=>{const base=lib.readUInt32LE((resource-1)*4),end=base+lib.readUInt32LE(base),count=lib.readUInt16LE(base+6),fixed=lib.readUInt32LE(base+8);eq(lib.readUInt16LE(base+4),resource);assert.ok(index>=0&&index<count&&end<=lib.length);const row=base+14+index*8,off=fixed?base+14+index*fixed:count===1?base+14:base+lib.readUInt32LE(row),len=fixed||(count===1?end-base-14:lib.readUInt32LE(row+4));assert.ok(off>=base+14&&off+len<=end);return lib.subarray(off,off+len);};const table=item(66,0);eq(table.length,33*66);return Array.from({length:33},(_,i)=>{const n=item(73,i),zero=n.indexOf(0),p=i*66;return{name:new TextDecoder('gbk').decode(n.subarray(0,Math.min(zero<0?n.length:zero,31))),useFlag:table[p+1],attack:table[p+62],iq:table[p+63],move:table[p+64],arm:table[p+65],changeAttackRange:table[p+32]};});}
function values(t){return{useFlag:t.useFlag?'使用':'装备',attack:String(t.attack),iq:String(t.iq),move:String(t.move),arm:t.arm===0?'无':t.arm===1?'水军':t.arm===2?'玄兵':t.arm===3?'极兵':['骑兵','步兵','弓箭兵','水军','极兵','玄兵'][t.arm-4]||'原始码 '+t.arm,changeAttackRange:t.changeAttackRange?'改变（以战场为准）':'不改变'};}
function decoration(v,field,title,value){eq(v.field,field);eq(v.title,title);eq(v.value,value);eq(v.svgCount,1);eq(v.iconField,field);const b=v.bounds,inside=(o,i)=>i.left>=o.left-.5&&i.right<=o.right+.5&&i.top>=o.top-.5&&i.bottom<=o.bottom+.5;for(const name of ['row','label','value','icon','viewport']){const r=b[name];assert.ok(r&&['left','top','right','bottom','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0);}for(const name of ['label','value','icon']){assert.ok(inside(b.row,b[name]));assert.ok(inside(b.viewport,b[name]));}assert.ok(inside(b.label,b.icon));assert.ok(b.label.right<=b.value.left+.5);eq(v.iconStyle.pointerEvents,'none');const em=Number.parseFloat(v.iconStyle.fontSize),w=Number.parseFloat(v.iconStyle.width),h=Number.parseFloat(v.iconStyle.height);assert.ok([em,w,h].every(n=>Number.isFinite(n)&&n>0)&&Math.abs(w-em)<=.5&&Math.abs(h-em)<=.5);for(const n of ['label','value'])assert.ok(v.textWidths[n].scroll<=v.textWidths[n].client+.5);}
function cardProof(e,rom){eq(e.accepted,true);eq(e.keys,[]);eq(e.after.native,e.before.native);eq(e.after.world,e.before.world);eq(e.after.state.touchCount,e.before.state.touchCount);const m=e.before.state.menu,p=e.before.world.people[e.personId];eq([m.active,m.context,m.kind,m.idsValid,m.ids[m.index]],[1,1,3,true,e.personId]);const expected=[p.Tool1,p.Tool2].flatMap((id,slot)=>id?[{slot,toolIndex:id-1,tool:rom[id-1]}]:[]);assert.ok(expected.every(x=>x.tool));eq(e.expected,expected);eq(e.dom.hidden,false);eq(e.dom.cards.length,expected.length);eq(e.snapshot.equipment.length,expected.length);eq([e.snapshot.personIndex,e.snapshot.nativeIndex,e.snapshot.seq,e.snapshot.context,e.snapshot.kind,e.snapshot.ownerKey],[e.personId,m.index,m.seq,1,3,e.before.state.cityUi.deepMenuOwner.key]);for(let i=0;i<33;i++)for(const [raw,key]of Object.entries({useflag:'useFlag',at:'attack',iq:'iq',move:'move',arm:'arm',changeAttackRange:'changeAttackRange'}))eq(e.before.world.tools[i][raw],rom[i][key]);for(const [i,x]of expected.entries()){const c=e.dom.cards[i],s=e.snapshot.equipment[i],value=values(x.tool);eq([c.slot,c.toolIndex,s.slot,s.toolIndex,s.name,s.generation,s.source],[x.slot,x.toolIndex,x.slot,x.toolIndex,x.tool.name,m.detailGeneration,'standard-tool-details']);eq(s.properties,Object.fromEntries(FIELDS.map(k=>[k,x.tool[k]])));eq(c.rows.map(r=>r.field),FIELDS);for(let n=0;n<FIELDS.length;n++){const f=FIELDS[n],r=c.rows[n],sr=s.rows[n];eq([r.field,r.title,r.value],[f,LABELS[n],value[f]]);eq([sr.field,sr.label,sr.value],[f,LABELS[n],value[f]]);eq([r.svgCount,r.icons.length],[1,1]);const icon=r.icons[0];eq([icon.namespace,icon.field,icon.ariaHidden,icon.focusable],['http://www.w3.org/2000/svg',f,'true','false']);eq([icon.title,icon.titleCount,icon.ariaLabel,icon.ariaLabelledBy,icon.tabIndex,icon.labelledDescendants,icon.interactiveDescendants],[null,0,null,null,null,0,0]);const vs=e.visible.filter(v=>v.slot===x.slot&&v.toolIndex===x.toolIndex&&v.field===f);eq(vs.length,1);eq(vs[0].value,value[f]);eq(vs[0].geometry.visible,true);decoration(vs[0].decoration,f,LABELS[n],value[f]);}}eq(e.visible.length,expected.length*6);return{cards:expected.length,rows:e.visible.length};}
function sourceRows(r,c,sv){if(c.id==='mobile'){eq(sv.sourceFiles,r.sourceFiles);eq(sv.sourceDrift,[]);eq(r.sourceDrift,[]);return r.sourceFiles;}eq(sv,r.sourceVerification);eq(sv.ok,true);eq(sv.count,sv.sources.length);eq(sv.count,1219);eq(sv.added,[]);eq(sv.drift,[]);for(const p of sv.sources){eq(p.match,true);eq(p.actualSha256,p.sha256);}return Object.values(r.sources).map(p=>({path:p.source,bytes:p.bytes,sha256:p.sha256}));}
// Preserved failure and LF-only repair are data history, never an added current-source set.
function lfRepairProof(b,get,J,before){
 const find=name=>{const p=[...b.records,...b.history].find(p=>p.path===B+name);assert.ok(p);return p;},L=LOCKS.lfRepair,H=J(L.failedFull),oldBefore=J(H.before),s=tap(get(H.stdout));
 eq(H.schemaVersion,1);eq(H.accepted,false);eq(H.processExitCode,1);eq(H.signal,null);eq(H.registeredFiles,149);eq(H.selectedSources,1638);eq(H.selectedSourceBytesStable,true);eq(H.drift,[]);eq(oldBefore.length,1638);for(const[k,v]of Object.entries(s))eq(H[k],v);eq([s.tests,s.pass,s.fail,s.cancelled,s.skipped,s.todo],[7907,7906,1,0,0,0]);eq(get(H.stderr).length,0);eq([H.newDefaultTests,H.parentSavedDefaultTests],[2,7905]);
 const tool=J(L.terminalTool);eq(tool.chunk_id,L.terminal.terminalChunk);eq(tool.exit_code,L.terminal.exitCode);const closed=JSON.parse(tool.output.trim());eq(closed.event,'CLOSED');eq(closed.accepted,false);eq(closed.processExitCode,1);eq(closed.receipt,H.before.path.replace('.before.json','.json'));for(const[k,v]of Object.entries(s))eq(closed[k],v);eq(closed.selectedSources,1638);eq(closed.drift,0);
 const R=J(find('overworld-lf-repair-v1.json'));eq(R.schemaVersion,1);eq(R.accepted,true);eq(R.failedFull,L.failedFull);eq(R.failurePreserved,true);eq(R.changes,L.changes);eq(R.attributesBefore,L.attributesBefore);eq(R.attributesAfter,L.attributesAfter);eq([R.assertionsChanged,R.productionLogicChanged,R.newDefaultTests,R.oldWorktreeWrites],[0,0,0,0]);eq(R.defaultRegistrationChanged,false);eq(R.oldHeldTouched,false);
 eq(R.changes.map(c=>c.source),['js/hd-overworld-layers.js','scripts/test-hd-overworld-layers.mjs']);for(const c of R.changes){eq(c.normalizedExactlyEqualsCommittedBlob,true);eq(v45Pin(c.after.path,Buffer.from(get(c.before).toString('utf8').replace(/\r\n/g,'\n'))),c.after);eq(oldBefore.find(p=>p.path===c.source),{...c.before,path:c.source});eq(before.find(p=>p.path===c.source),c.after);}
 const a=get(R.attributesBefore),current=get(LOCKS.productPins.find(p=>p.path==='.gitattributes'));eq(current,Buffer.concat([a,Buffer.from(L.attributeSuffix)]));eq(oldBefore.find(p=>p.path==='.gitattributes'),{...R.attributesBefore,path:'.gitattributes'});eq(before.find(p=>p.path==='.gitattributes'),R.attributesAfter);
 eq(oldBefore.map(p=>p.path),before.map(p=>p.path));const changed=before.filter((p,i)=>!isDeepStrictEqual(p,oldBefore[i])).map(p=>p.path).sort();eq(changed,['.gitattributes','js/hd-overworld-layers.js','scripts/test-hd-overworld-layers.mjs']);
 const T=J(L.target),t=tap(get(T.stdout));eq(T.schemaVersion,1);eq(T.accepted,true);eq(T.processExitCode,0);eq(T.sourceBytesStable,true);eq(T.sources,L.targetSources);eq(T.sources,[...R.changes.map(c=>c.after),R.attributesAfter]);for(const[k,v]of Object.entries(t))eq(T[k],v);eq([t.tests,t.pass,t.fail,t.cancelled,t.skipped,t.todo],[16,16,0,0,0,0]);eq(get(T.stderr).length,0);eq([T.newDefaultTests,T.newBrowserRuns,T.newNativeGameInputs],[0,0,0]);eq(T.globalHdComplete,false);
}
export function verifyData(files,b,readCurrent){requireBinding(b);const get=p=>check(p,files.get(p.path)),J=p=>json(get(p));eq(json(files.get(BINDING)),b);const required=[...selected(b,J),v45Pin(BINDING,files.get(BINDING))].sort((a,z)=>a.path<z.path?-1:a.path>z.path?1:0);eq(required,[...files].map(([p,v])=>v45Pin(p,v)).sort((a,z)=>a.path<z.path?-1:a.path>z.path?1:0));for(const p of LOCKS.criticalPins)check(p,readCurrent(p.path,Math.max(1,p.bytes)));const buildPin=LOCKS.criticalPins.find(p=>p.path==='js/baye.build.json'),build=json(check(buildPin,readCurrent(buildPin.path,buildPin.bytes))),normal=J(b.records.find(p=>p.path===B+'native-checkout-normalization-v3.json'));eq(normal.accepted,true);eq(normal.engineRebuilt,false);eq(normal.engineArtifactsChanged,false);eq(normal.canonicalAggregate,build.engineSourceSha256);for(const name of ['baye.js','baye.wasm','baye.wasm.map']){const p=LOCKS.criticalPins.find(p=>p.path==='js/'+name);eq([p.bytes,p.sha256],[build.artifacts[name].bytes,build.artifacts[name].sha256]);}const pkg=J(LOCKS.productPins.find(p=>p.path==='package.json'));eq(pkg.scripts.test.split(/\s+/).filter(p=>p.startsWith('scripts/')).length,149);const rom=tools(get(LOCKS.library)),F=J(b.full.receipt),before=J(b.full.before);eq(F.schemaVersion,1);eq(F.accepted,true);eq(F.processExitCode,b.terminals.full.exitCode);eq(F.signal,null);eq(F.registeredFiles,149);eq(F.selectedSources,1638);eq(F.selectedSourceBytesStable,true);eq(F.drift,[]);eq(F.before,b.full.before);eq(F.stdout,b.full.stdout);eq(F.stderr,b.full.stderr);eq(before.length,1638);for(const p of LOCKS.criticalPins)eq(before.find(v=>v.path===p.path),p);const summary=tap(get(F.stdout));for(const[k,v]of Object.entries(summary))eq(F[k],v);eq([summary.tests,summary.pass,summary.fail,summary.cancelled,summary.skipped,summary.todo],[7907,7907,0,0,0,0]);eq(get(F.stderr).length,0);eq([F.newDefaultTests,F.parentSavedDefaultTests],[2,7905]);lfRepairProof(b,get,J,before);
 const I=J(b.records.find(p=>p.path===B+'source-integration-v4.json')),R=J(b.records.find(p=>p.path===B+'runtime-check-integration-v1.json'));eq(I.accepted,true);eq(I.oldHeldSourcesUnchanged,true);eq(I.oldWorktreeTrackedWrites,0);eq([I.netNewDefaultTests,I.defaultRegisteredFiles],[2,149]);for(const p of [...I.production,...I.pages]){eq(p.after,LOCKS.productPins.find(v=>v.path===p.path));get(p.before);}eq(R.accepted,true);eq(R.oldGuardsPreserved,true);eq(R.driverInterfaceChanged,false);eq(R.formal,LOCKS.productPins.find(p=>p.path===R.formal.path));get(R.canonicalBefore);get(R.checkoutBefore);
 const hud=tap(get(b.history.find(p=>p.path===B+'integrated-hud-v2.stdout.tap'))),oldHud=tap(get(b.history.find(p=>p.path===B+'integrated-hud-v1.stdout.tap')));eq([hud.tests,hud.pass,hud.fail,hud.cancelled,hud.skipped,hud.todo],[188,188,0,0,0,0]);eq([oldHud.tests,oldHud.pass],[186,186]);for(const folder of ['preflight-v1','preflight-v2']){const p=b.history.find(p=>p.path===B+folder+'/result.json');assert.ok(p);const old=J(p);eq(old.accepted,false);eq(old.ok,folder==='preflight-v2');eq(old.preflightOnly,true);eq(old.equipmentAccepted,false);eq(old.hdAccepted,false);eq(old.phases,[]);}
 const layouts=[];for(const c of b.cases){const r=J(c.result),sv=J(c.sourceVerification);eq(r.ok,true);eq(r.accepted,true);eq(r.cleanup.treeExited,true);eq(r.cleanup.errors,[]);eq(r.profileRetained,true);eq(r.serverClosed,true);eq(r.exceptions,[]);eq(r.nativeTouches,[]);const sources=sourceRows(r,c,sv);for(const name of ['js/hd-city-menu.js','css/hd-city-menu.css','scripts/hd-person-equipment-runtime-checks.mjs'])eq(pin3(sources.find(p=>p.path===name)),LOCKS.productPins.find(p=>p.path===name));for(const e of c.executed){eq(get(e.file),check(e.source,readCurrent(e.source.path,Math.max(1,e.source.bytes))),'Actual executed copy equals its explicit current small-set source');assert.ok(LOCKS.criticalPins.some(p=>isDeepStrictEqual(p,e.source)));}if(c.console){const console=J(c.console);eq(console.exceptions,[]);eq(console.dialogs,[]);eq(console.console,r.console);}
  const images=c.id==='mobile'?r.phases.flatMap(p=>[p.screenshot,p.actualCanvas].filter(Boolean)):r.phases.map(p=>({file:p.file,bytes:p.bytes,sha256:p.sha256}));eq(c.pngs,images.map(p=>({path:c.directory+p.file,bytes:p.bytes,sha256:p.sha256})));for(const p of c.pngs){const png=get(p);eq([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);}
  if(c.id==='mobile'){eq(r.previewOnly,true);eq(r.previewAccepted,true);eq(r.previewChecks.length,2);eq(r.treatments,[]);eq(r.recruitments,[]);eq(r.sourceDrift,[]);for(const [i,e]of r.previewChecks.entries()){eq(e.label,['preview-844x390','preview-667x375'][i]);eq(e.accepted,true);eq(e.returned.world,e.baseline.world);eq(e.equipmentCards.map(p=>p.personId).sort((a,z)=>a-z),[0,19,20]);for(const card of e.equipmentCards)for(const v of card.visible)eq([v.decoration.bounds.viewport.width,v.decoration.bounds.viewport.height],i?[667,375]:[844,390]);const totals=e.equipmentCards.map(p=>cardProof(p,rom));eq(totals.reduce((n,p)=>n+p.cards,0),3);eq(totals.reduce((n,p)=>n+p.rows,0),18);layouts.push({id:i?'mobile667':'mobile844',viewport:i?[667,375]:[844,390],people:3,cards:3,rows:18,emulated:true});}}
  else{eq(r.equipmentAccepted,true);eq(r.preflightOnly,false);eq(r.viewport,c.id==='pc1080'?{width:1920,height:1080}:{width:1280,height:720});eq(r.phases.length,6);eq(r.engineManifest,build);eq(r.nativeSourceCheck.aggregate,build.engineSourceSha256);eq(r.nativeSourceCheck.count,128);eq(r.final.world,r.initialWorld);eq(r.people.map(p=>p.personId),[20,0,19]);eq(r.isolation.cleaned,true);eq(r.isolation.chromeExited,true);eq(r.isolation.httpClosed,true);eq(r.isolation.user8080Touched,false);eq(r.dialogs,[]);for(const card of r.people.flatMap(e=>e.equipmentCards))for(const v of card.visible)eq([v.decoration.bounds.viewport.width,v.decoration.bounds.viewport.height],[r.viewport.width,r.viewport.height]);const totals=r.people.flatMap(e=>e.equipmentCards).map(e=>cardProof(e,rom));eq(totals.reduce((n,p)=>n+p.cards,0),3);eq(totals.reduce((n,p)=>n+p.rows,0),18);layouts.push({id:c.id,viewport:[r.viewport.width,r.viewport.height],people:3,cards:3,rows:18,emulated:false});}}
 for(const image of b.images){const c=b.cases.find(c=>c.id===(image.id.startsWith('mobile')?'mobile':image.id));assert.ok(c&&c.pngs.some(p=>isDeepStrictEqual(p,image.source)));if(image.id.startsWith('mobile')){assert.ok(path.posix.basename(image.source.path).startsWith(image.id==='mobile844'?'preview-844x390-':'preview-667x375-'));const r=J(c.result);assert.ok(r.phases.some(p=>p.screenshot&&isDeepStrictEqual(image.source,{path:c.directory+p.screenshot.file,bytes:p.screenshot.bytes,sha256:p.screenshot.sha256})),'Representative must show the real viewport screenshot, not background canvas alone');}}return{mobileResultStorage:{wholePin:MOBILE_WHOLE,rawChunks:5,wholeRawReassembledBeforeJson:true,unknownFieldsPreserved:true,physicalPackets:6,codecBoundsUnchanged:true},scope:'Four original-LIB equipment icon layouts only',layouts,fullDefault:{tests:7907,pass:7907,registeredFiles:149,selectedBeforeSources:1638,selectedSourceStableAsRecorded:true,currentCriticalFiles:LOCKS.criticalPins.length},hudSubset:{tests:188,pass:188,notAddedToFull:true},old186RetainedWithoutIconCredit:true,failedPreflights:1,passedPreflightOnly:1,preflightEquipmentCredit:false,failedFullV1:{tests:7907,pass:7906,fail:1,accepted:false,retained:true},lfOnlyRepair:{files:2,assertionsChanged:0,productionLogicChanged:0,targetTests:16,targetPass:16,addedToDefault:0,browserRerun:false},sourceIntegrationQualified:true,cardInspectionNativeKeys:0,cardInspectionLcdTouches:0,businessLoadSaveEndMarchOrIncomeOperations:0,mainP57InspectedOrChanged:false,oldHeldAdoptedOrTouched:false,completeAbiQualified:false,packedSaveQualified:false,rngContinuityQualified:false,realDeviceAccepted:false,cloudAccepted:false,fullHdAccepted:false,globalHdComplete:false};}
export function portableReader(b){const a="'../../../docs/"+'validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs\'',z="'./m5-quantity-"+'ack-refresh-20261024-v45-verify.mjs\'',s=b.toString('utf8');eq(s.split(a).length-1,1);return Buffer.from(s.replace(a,z));}
// The codec bounds apply unchanged to each physical packet. Only this single
// measured original file may be reassembled above maxFileBytes in memory.
export const MOBILE_WHOLE=Object.freeze({path:B+'mobile-preview-v1/result.json',bytes:142291141,sha256:'0a7a401e6a8b943a5cb80ca5603860c453009208732a91e8935c51024079fb05'});
export const CHUNKS=D+'mobile-chunks-v1/',PACKET_IDS=Object.freeze(['core','mobile-001','mobile-002','mobile-003','mobile-004','mobile-005']);
const CHUNK_SIZES=Object.freeze([33554432,33554432,33554432,33554432,8073413]);
const ORIGINAL_BOUNDS=Object.freeze({maxPartBytes:8388608,maxSerializedBytes:67108864,maxNamedRawBytes:134217728,maxUniqueRawBytes:100663296,maxFileBytes:33554432,maxFiles:512,maxBlobs:512,maxParts:32});
export function chunkManifest(m){eq(V45_BOUNDS,ORIGINAL_BOUNDS);eq(m.schemaVersion,1);eq(m.kind,'whole-original-mobile-raw-byte-chunks');eq(m.source,MOBILE_WHOLE);eq(m.chunkCount,5);eq(m.maximumChunkBytes,V45_BOUNDS.maxFileBytes);eq(m.chunks.length,5);let offset=0;for(let i=0;i<5;i++){const c=m.chunks[i];eq(c.ordinal,i);eq(c.offset,offset);eq(c.pin.path,CHUNKS+'chunk-'+String(i+1).padStart(3,'0')+'.raw');eq(c.pin.bytes,CHUNK_SIZES[i]);assert.ok(c.pin.bytes<=V45_BOUNDS.maxFileBytes);pin3(c.pin);offset+=c.pin.bytes;}eq(offset,MOBILE_WHOLE.bytes);eq(m.originalJsonParsed,false);eq(m.compressed,false);eq(m.sourceBytesChanged,false);return m;}
export function packetPins(b,J,bindingPin){requireBinding(b);const m=chunkManifest(J(b.mobileChunks.manifest)),logical=[...selected(b,J),pin3(bindingPin)].sort((a,z)=>a.path<z.path?-1:a.path>z.path?1:0),core=logical.filter(p=>p.path!==MOBILE_WHOLE.path);eq(logical.filter(p=>p.path===MOBILE_WHOLE.path),[MOBILE_WHOLE]);for(const p of core){assert.ok(p.bytes<=V45_BOUNDS.maxFileBytes);assert.ok(!p.path.startsWith(CHUNKS)||p.path===b.mobileChunks.manifest.path,'Raw chunks appear only in their exact independent packets');}return[{id:'core',files:core},...m.chunks.map((c,i)=>({id:PACKET_IDS[i+1],files:[pin3(c.pin)]}))];}
export function restoreMobile(core,chunkFiles,b){const get=p=>check(p,core.get(p.path)),m=chunkManifest(JSON.parse(get(b.mobileChunks.manifest).toString('utf8')));eq([...chunkFiles.keys()].sort(),m.chunks.map(c=>c.pin.path));const chunks=[];let offset=0;for(const c of m.chunks){eq(c.offset,offset);const bytes=check(c.pin,chunkFiles.get(c.pin.path));eq(bytes.length,CHUNK_SIZES[c.ordinal]);chunks.push(bytes);offset+=bytes.length;}eq(offset,MOBILE_WHOLE.bytes);assert.ok(!core.has(MOBILE_WHOLE.path));const raw=Buffer.concat(chunks,MOBILE_WHOLE.bytes);check(MOBILE_WHOLE,raw);const logical=new Map(core);logical.set(MOBILE_WHOLE.path,raw);return logical;}
export function verify(root,{readPublic,readCurrent}={}){readPublic??=((p,max)=>safeRead(root,p,max));readCurrent??=((p,max)=>safeRead(root,p,max));eq(V45_BOUNDS,ORIGINAL_BOUNDS);check(LOCKS.codec,readCurrent(LOCKS.codec.path,LOCKS.codec.bytes));const C=json(readPublic(PREFIX+'.json',2*1024*1024));eq(C.packets.map(p=>p.id),PACKET_IDS);eq(C.schemaVersion,1);eq(C.prefix,PREFIX);const core=new Map(),chunks=new Map();for(const p of C.packets){eq(p.index.path,PREFIX+'-'+p.id+'-archive-index.json');const index=json(check(p.index,readPublic(p.index.path,2*1024*1024)));eq(index.files.map(pin3),p.files);
 // Fixed packet-specific names; no cross-packet part adoption.
 eq(index.parts.map(x=>x.path),index.parts.map((x,i)=>PREFIX+'-'+p.id+'-archive-part'+String(i+1).padStart(3,'0')+'.json'));
 const decoded=decodeV45Archive({index,readPart:(q,max)=>readPublic(q,max)});for(const[name,bytes]of decoded.files){const map=p.id==='core'?core:chunks;assert.ok(!map.has(name));map.set(name,bytes);}}
 eq(C.binding.path,BINDING);const b=json(check(C.binding,core.get(BINDING)));requireBinding(b);const J=p=>json(check(p,core.get(p.path)));eq(C.packets.map(({id,files})=>({id,files})),packetPins(b,J,C.binding),'Complete core and every exact raw chunk packet');const logical=restoreMobile(core,chunks,b),original=check(b.readerSource,core.get(READER));eq(C.reader.path,PREFIX+'-verify.mjs');eq(check(C.reader,readPublic(C.reader.path,1024*1024)),portableReader(original));const facts=verifyData(logical,b,readCurrent);eq(C.facts,facts);for(const image of b.images){const p=C.images.find(p=>p.path===image.publicPath);assert.ok(p);eq(check(p,readPublic(p.path,V45_BOUNDS.maxFileBytes)),logical.get(image.source.path));}eq(C.markdown.path,PREFIX+'.md');check(C.markdown,readPublic(C.markdown.path,1024*1024));return{accepted:true,facts,archive:{logicalFiles:logical.size,physicalFiles:core.size+chunks.size,packets:6,wholeMobileBytes:MOBILE_WHOLE.bytes,wholeMobileChunks:5}};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){eq(process.argv.slice(2),['--verify']);console.log(JSON.stringify(verify(process.cwd())));}
