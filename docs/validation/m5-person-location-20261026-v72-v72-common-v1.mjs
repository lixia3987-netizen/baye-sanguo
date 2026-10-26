import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const B='build/person-location-20261026-v72/';
export const D=B+'evidence-source-v1/';
export const PREFIX='docs/validation/m5-person-location-20261026-v72';
export const MODULES=['v72-common-v1.mjs','v72-reader-v1.mjs'];
export const SOURCES=[...MODULES,'prepare-v1.mjs','publish-v1.mjs','README.md'];
export const BOUNDS=Object.freeze({maxPartBytes:8388608,maxSerializedBytes:67108864,maxNamedRawBytes:134217728,maxUniqueRawBytes:100663296,maxFileBytes:33554432,maxFiles:512,maxBlobs:512,maxParts:32});
// Actual final closed runtime/full/tool pins; ready for independent SOURCE review.
export const EPOCH={"path":"build/person-location-20261026-v72/source-epoch-v1.json","bytes":31459,"sha256":"5e2b0e7f58b389ce04d0844603942b3238bf268afd768d63241f21b3cbed58fb"};
export const FIXED={
  "codec": {
    "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
    "bytes": 32262,
    "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
  },
  "cases": [
    {
      "id": "pc720BeforeV1",
      "kind": "product-before",
      "directory": "build/person-location-20261026-v72/pc720-before-v1/",
      "layout": "pc720",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-location-20261026-v72/pc720-before-v1/result.json",
        "bytes": 11940061,
        "sha256": "b4426a073a8f6e4904952de215e5b67ccfe2d92cef2205f6bfb0cde2d5f6ad0b"
      },
      "phaseCount": 6,
      "partialIdentityCount": 1,
      "partialLocationCount": 0,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": true,
      "sourceAliases": [
        {
          "name": "js/hd-city-menu.js",
          "source": "build/person-location-20261026-v72/before/js/hd-city-menu.js",
          "bytes": 448176,
          "sha256": "cfcd4f89e14987db475bb6950d24bce7425d36999eb6d5576842790909068399"
        }
      ],
      "tool": {
        "initial": {
          "path": "build/person-location-20261026-v72/raw-pc720-before-initial-v1.json",
          "bytes": 504,
          "sha256": "e81dbba868b9e26b196ab27d5fdd9e42346e7c4fd203dc118a54533ad36eb3ac"
        },
        "terminal": {
          "path": "build/person-location-20261026-v72/raw-pc720-before-terminal-v1.json",
          "bytes": 1565,
          "sha256": "5c846373897d24912493e6d17f98bb89baf842644d896d4fe09b74c7a9fa996c"
        },
        "initialChunk": "55aa6f",
        "terminalChunk": "8ce0c2",
        "sessionId": 35414
      },
      "error": "AssertionError [ERR_ASSERTION]: The HD PERSON detail includes its original city location\n    at location (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-location-runtime-checks.mjs:22:110)\n    at checkIdentity (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-location-runtime-checks.mjs:30:3)\n    at async inspect (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:43:3)\n    at async runForeignPersonRoles (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:45:159)\n    at async runPersonLocationRoles (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-location-runtime-checks.mjs:37:3)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:212:18)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:240:907)"
    },
    {
      "id": "pc720AcceptedV1",
      "kind": "accepted-runtime",
      "directory": "build/person-location-20261026-v72/pc720-after-v1/",
      "layout": "pc720",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-location-20261026-v72/pc720-after-v1/result.json",
        "bytes": 54991646,
        "sha256": "657174c5cb19311ac520046c16b638124331df286169f64730d7b690dfef2a38"
      },
      "phaseCount": 25,
      "partialIdentityCount": 3,
      "partialLocationCount": 3,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": false,
      "sourceAliases": [],
      "tool": {
        "initial": {
          "path": "build/person-location-20261026-v72/raw-pc720-after-initial-v1.json",
          "bytes": 503,
          "sha256": "782a3c40a1101f3d6ba408a3f825ed8ddc45803f228b773e526f1a6f25137f65"
        },
        "terminal": {
          "path": "build/person-location-20261026-v72/raw-pc720-after-terminal-v1.json",
          "bytes": 422,
          "sha256": "c02998fc604c0d44f368c41f6308fecaea4792497c09fb026bcceaff7f0654c5"
        },
        "initialChunk": "cb4b98",
        "terminalChunk": "d854ed",
        "sessionId": 78362
      }
    },
    {
      "id": "pc1080AcceptedV1",
      "kind": "accepted-runtime",
      "directory": "build/person-location-20261026-v72/pc1080-after-v1/",
      "layout": "pc1080",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-location-20261026-v72/pc1080-after-v1/result.json",
        "bytes": 55006170,
        "sha256": "d14e8ecd29275f1e1b059d1df123a48b2d7cc7768482de99f86b9f2de0aeaa50"
      },
      "phaseCount": 25,
      "partialIdentityCount": 3,
      "partialLocationCount": 3,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": false,
      "sourceAliases": [],
      "tool": {
        "initial": {
          "path": "build/person-location-20261026-v72/raw-pc1080-after-initial-v1.json",
          "bytes": 504,
          "sha256": "eb8847791b34c73f1e475cf659b1d193d088b3f8c31bd20aae168ae659db0876"
        },
        "terminal": {
          "path": "build/person-location-20261026-v72/raw-pc1080-after-terminal-v1.json",
          "bytes": 424,
          "sha256": "7b82bb18b4bc4a08695d101c8f1bdeedb3bfeb73234133ff9c742e83c1c12a80"
        },
        "initialChunk": "49a54d",
        "terminalChunk": "8c4c01",
        "sessionId": 69640
      }
    },
    {
      "id": "mobile844AcceptedV1",
      "kind": "accepted-runtime",
      "directory": "build/person-location-20261026-v72/mobile844-after-v1/",
      "layout": "mobile844",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-location-20261026-v72/mobile844-after-v1/result.json",
        "bytes": 123297450,
        "sha256": "f770ef87a1cc797104e945fdf029267d06968516f1311e3c4ccf5c2101032876"
      },
      "phaseCount": 39,
      "partialIdentityCount": 3,
      "partialLocationCount": 3,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": false,
      "sourceAliases": [],
      "tool": {
        "initial": {
          "path": "build/person-location-20261026-v72/raw-mobile844-after-initial-v1.json",
          "bytes": 506,
          "sha256": "4c9949936b474033c36be306d7b4e5c9fe9e15e15ce5c28dee1e5e1a2415dbe9"
        },
        "terminal": {
          "path": "build/person-location-20261026-v72/raw-mobile844-after-terminal-v1.json",
          "bytes": 427,
          "sha256": "3c1ff3568f74516ce0e2f9a6d5bd9d3b0ee09dafd4987b92fd0f0d224f632cfe"
        },
        "initialChunk": "da088c",
        "terminalChunk": "153443",
        "sessionId": 9215
      }
    },
    {
      "id": "mobile667AcceptedV1",
      "kind": "accepted-runtime",
      "directory": "build/person-location-20261026-v72/mobile667-after-v1/",
      "layout": "mobile667",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-location-20261026-v72/mobile667-after-v1/result.json",
        "bytes": 149590080,
        "sha256": "f1c25704fbf45fece3e5b2546224aba15d1ab311b54321e1ff02e10ddb91daa2"
      },
      "phaseCount": 52,
      "partialIdentityCount": 3,
      "partialLocationCount": 3,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": false,
      "sourceAliases": [],
      "tool": {
        "initial": {
          "path": "build/person-location-20261026-v72/raw-mobile667-after-initial-v1.json",
          "bytes": 507,
          "sha256": "17773eb4187505c6ba98ae9eb84e3398b78c7213ef17fbc6ea9df11279512d42"
        },
        "terminal": {
          "path": "build/person-location-20261026-v72/raw-mobile667-after-terminal-v1.json",
          "bytes": 426,
          "sha256": "1c5b29198cadb0decfa7ddca15c41a82bcd0518874b0c081d41899463ea22ecd"
        },
        "initialChunk": "3daef1",
        "terminalChunk": "f7c342",
        "sessionId": 96632
      }
    }
  ],
  "support": [
    {
      "path": "build/person-location-20261026-v72/agent-hud-location-probe-v1.json",
      "bytes": 1334,
      "sha256": "0322964b4c2dbba34168f298b511663b7ce32a583a12384b0930798ca760b1fd"
    },
    {
      "path": "build/person-location-20261026-v72/agent-hud-location-probe-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-location-20261026-v72/agent-hud-location-probe-v1.stdout.tap",
      "bytes": 3350,
      "sha256": "6825d56bd7e9462ad9bf7c062ef05d016a7d8d3c180921fe4b4a3472164c9cb7"
    },
    {
      "path": "build/person-location-20261026-v72/baseline-city-menu-v1.json",
      "bytes": 268,
      "sha256": "f8667ee8c9be5f6dc3ca7e972daecd798d7adf6f513fe763269b55e2d2f3c484"
    },
    {
      "path": "build/person-location-20261026-v72/before/hd-city-menu-location-no-reentry-native-capacity.js",
      "bytes": 454668,
      "sha256": "ec7ee907339870c8d5618efcd77205d001512f5bfe2ec4e24bb3c2b4d5e3a571"
    },
    {
      "path": "build/person-location-20261026-v72/before/hd-city-menu-location-stage1.js",
      "bytes": 454666,
      "sha256": "62256b555cee17b1648e3e9a60802a03740da0eb035a350c8b2bfdcdd9caa639"
    },
    {
      "path": "build/person-location-20261026-v72/before/hd-city-menu-location-stage2.js",
      "bytes": 455218,
      "sha256": "2ad926814b4260ae1539bdf75dba9bbbc3e05a7a9328857e83ef0904a915304d"
    },
    {
      "path": "build/person-location-20261026-v72/before/js/hd-city-menu.js",
      "bytes": 448176,
      "sha256": "cfcd4f89e14987db475bb6950d24bce7425d36999eb6d5576842790909068399"
    },
    {
      "path": "build/person-location-20261026-v72/before/scripts/hd-person-identity-runtime-checks.mjs",
      "bytes": 22262,
      "sha256": "3ac8a287d09eb90a7e10af66b1e923513944de076a6bf393b03c28ab91a17e60"
    },
    {
      "path": "build/person-location-20261026-v72/before/scripts/hd-person-roles-runtime-checks.mjs",
      "bytes": 12826,
      "sha256": "9a6cfc4015641e6ac2a6ed3b5745109c945b560903eff380a7f377a3eee5d401"
    },
    {
      "path": "build/person-location-20261026-v72/before/scripts/test-hd-city-hud.mjs",
      "bytes": 134812,
      "sha256": "8acfbf697fd5271b6c7c18cd38e039c02b16e97b809b3bacb2c68be00c740efe"
    },
    {
      "path": "build/person-location-20261026-v72/before/scripts/test-hd-person-identity-runtime.mjs",
      "bytes": 49999,
      "sha256": "41f8b3ded45af0f503855b947c7cf27cc88fc7f7cd8ec79135f6a0283b840b7d"
    },
    {
      "path": "build/person-location-20261026-v72/check-preserved-state-v1.mjs",
      "bytes": 2485,
      "sha256": "40d88abeee35516a5a668788352e386fe3393701bedfef00d480cd9823c3dc94"
    },
    {
      "path": "build/person-location-20261026-v72/extend-location-runner-v1.mjs",
      "bytes": 3137,
      "sha256": "3e60e92bb1eb5b05c127679d942abd21544e627478fa34e7aa54ed859210070f"
    },
    {
      "path": "build/person-location-20261026-v72/extend-shared-runtime-v1.mjs",
      "bytes": 1804,
      "sha256": "73834eebfcfce01037ea88e06d5eb025773fb913249f25996e63143d87e2adce"
    },
    {
      "path": "build/person-location-20261026-v72/freeze-current-epoch-v1.mjs",
      "bytes": 3268,
      "sha256": "7b0fe5e5770f6acda128a5e40e119cc1c8dc856adb3aff55413fb2eb30298c0e"
    },
    {
      "path": "build/person-location-20261026-v72/freeze-current-epoch-v2.mjs",
      "bytes": 3461,
      "sha256": "a7d296b7dbbd622ee3631dd2395c308f5d3c942baae1e60a9410fdb95749dddd"
    },
    {
      "path": "build/person-location-20261026-v72/full-default-v1.before.json",
      "bytes": 278960,
      "sha256": "140ef538fb2c8ca41134a90fa234afaf6fa27891749cbabf4f2488f83cc88345"
    },
    {
      "path": "build/person-location-20261026-v72/full-default-v1.json",
      "bytes": 1843,
      "sha256": "ae0164af029063c272cb00494383375970bb2cccdd418ca677c2a715a299d23e"
    },
    {
      "path": "build/person-location-20261026-v72/full-default-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-location-20261026-v72/full-default-v1.stdout.tap",
      "bytes": 1633008,
      "sha256": "5b6193c52e59407998886abb1353c3a6cae1b93461ebc7083bb6b8e6843aa3e6"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-abi-negative-v1.before.json",
      "bytes": 981,
      "sha256": "c3cddcb3b1ce7d809b21248ecd632e6101005a296cabc4bfe6a01965c467e968"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-abi-negative-v1.json",
      "bytes": 1256,
      "sha256": "21b303144b22fc976e2cc5148404c5dcd55548c60ffb25924915e0a6d237617d"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-abi-negative-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-abi-negative-v1.stdout.tap",
      "bytes": 61643,
      "sha256": "f5317b2b552b9614df514e85464e3b3413bc2f6ddacbcef0631b440a2a2ebedc"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-current-v1.before.json",
      "bytes": 981,
      "sha256": "c3cddcb3b1ce7d809b21248ecd632e6101005a296cabc4bfe6a01965c467e968"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-current-v1.json",
      "bytes": 1044,
      "sha256": "bc9a72ceb3ab5f5eeaa4187f80efa8fc11aa88f32a2ca73f0f73997860404319"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-current-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-current-v1.stdout.tap",
      "bytes": 49849,
      "sha256": "2ac6fa3a0886d2aed8f19f84b9e38d12cf4e83425db197f837a03748a9bb48b1"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-no-reentry-negative-v1.before.json",
      "bytes": 981,
      "sha256": "c3cddcb3b1ce7d809b21248ecd632e6101005a296cabc4bfe6a01965c467e968"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-no-reentry-negative-v1.json",
      "bytes": 1304,
      "sha256": "920f2663ca428c8339c2efd7c1e102e9fb1c103bfee94419472154f1aba140f0"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-no-reentry-negative-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-no-reentry-negative-v1.stdout.tap",
      "bytes": 51435,
      "sha256": "b08bcfd772613b6d664d72d27f515fb5818ca92be5fae71dcb829887cc05db4e"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-parent-negative-v1.before.json",
      "bytes": 981,
      "sha256": "c3cddcb3b1ce7d809b21248ecd632e6101005a296cabc4bfe6a01965c467e968"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-parent-negative-v1.json",
      "bytes": 1256,
      "sha256": "62172864d8f513d833c7e1d3adb2bd6edbc8d300359047f56f5c83d81a322666"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-parent-negative-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-location-20261026-v72/hud-location-parent-negative-v1.stdout.tap",
      "bytes": 61649,
      "sha256": "b0d87cb7d62151641c7549339fa3c40184737b62ed3b2ca5b0a1c01fb3fe9897"
    },
    {
      "path": "build/person-location-20261026-v72/location-runner-extension-v1.json",
      "bytes": 3092,
      "sha256": "fae62ae4dfdb4f0190c0e330d82cffcbf9df5eeaddfd826b9c991377b2f0e95d"
    },
    {
      "path": "build/person-location-20261026-v72/make-epoch-freezer-v2.mjs",
      "bytes": 953,
      "sha256": "9dff1804e555f9e93d92891be5d789f27b390ae2c9bf6ac4e65924831feed3fd"
    },
    {
      "path": "build/person-location-20261026-v72/make-location-controls-v1.mjs",
      "bytes": 1218,
      "sha256": "448967c8077934bd01389691242fe56f65debe1a8728314d7d21ff9e08f24bbb"
    },
    {
      "path": "build/person-location-20261026-v72/no-reentry-control-source-v1.json",
      "bytes": 902,
      "sha256": "c14a424491000d8f69d238af8541a3273f2ba7a6844b64e923a7c274a7c7c843"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources-v1.json",
      "bytes": 1162,
      "sha256": "886bfc9dac7f13a06a1c0819137dbf23c0dd1959d3eb449c14534a0824f09527"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/.gitattributes",
      "bytes": 42931,
      "sha256": "f987d684910589d30516d8b7f908414c96bb23642477751e2563120b53e2b5c9"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/js/hd-city-menu.js",
      "bytes": 448176,
      "sha256": "cfcd4f89e14987db475bb6950d24bce7425d36999eb6d5576842790909068399"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/m.html",
      "bytes": 18480,
      "sha256": "c6091467e7b92aeba9b07636836b4d526aa6fcd32193324c80bdda8a364249f9"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/package.json",
      "bytes": 21476,
      "sha256": "37d5d464028fdcdffc753d9eeace27f2e2ef5ff6c120866bce1241a84957f720"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/pc.html",
      "bytes": 28681,
      "sha256": "3f1b98d58396f42b832888a0dfcf7d8fd62ae3b076ffda5cbb8567f452c686d7"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/scripts/hd-person-identity-runtime-checks.mjs",
      "bytes": 22262,
      "sha256": "3ac8a287d09eb90a7e10af66b1e923513944de076a6bf393b03c28ab91a17e60"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/scripts/hd-person-roles-runtime-checks.mjs",
      "bytes": 12826,
      "sha256": "9a6cfc4015641e6ac2a6ed3b5745109c945b560903eff380a7f377a3eee5d401"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/scripts/test-hd-city-hud.mjs",
      "bytes": 134812,
      "sha256": "8acfbf697fd5271b6c7c18cd38e039c02b16e97b809b3bacb2c68be00c740efe"
    },
    {
      "path": "build/person-location-20261026-v72/parent-sources/scripts/test-hd-person-identity-runtime.mjs",
      "bytes": 49999,
      "sha256": "41f8b3ded45af0f503855b947c7cf27cc88fc7f7cd8ec79135f6a0283b840b7d"
    },
    {
      "path": "build/person-location-20261026-v72/preserved-state-before-v1.json",
      "bytes": 616,
      "sha256": "c81acc6bb6aaed2fd8714f643213759092e3e47f4b6ba0739128e6fc0dc4d3e0"
    },
    {
      "path": "build/person-location-20261026-v72/raw-full-default-initial-v1.json",
      "bytes": 346,
      "sha256": "3c18c9e54bd8336ff3a8393ede67e6133f3c23c690a94ed42c1cb8eb030e07ab"
    },
    {
      "path": "build/person-location-20261026-v72/raw-full-default-terminal-v1.json",
      "bytes": 407,
      "sha256": "ca8442c7b792d73ea15a2ce54a00ea791a1708e88ba5032bcb4cd43a9b68b516"
    },
    {
      "path": "build/person-location-20261026-v72/raw-hud-abi-negative-terminal-v1.json",
      "bytes": 1303,
      "sha256": "5f56963413f867a75b933db60689f5360b762ca282f943986052d9e23782a270"
    },
    {
      "path": "build/person-location-20261026-v72/raw-hud-current-terminal-v1.json",
      "bytes": 1093,
      "sha256": "59b96eb3b97eae1a9e4fb0299b5fde8790f594596a252b8d8b96d5c8006076f9"
    },
    {
      "path": "build/person-location-20261026-v72/raw-hud-no-reentry-negative-terminal-v1.json",
      "bytes": 1342,
      "sha256": "f57f8a159caa9c749861e087b91a2a735487be3dd761f43d5bb49b3225bde4da"
    },
    {
      "path": "build/person-location-20261026-v72/raw-hud-parent-negative-terminal-v1.json",
      "bytes": 1303,
      "sha256": "aeb591eee8235752bc7ad9486cb6fb7fceff1f0c2011cd2dbef4fdaa6512aab0"
    },
    {
      "path": "build/person-location-20261026-v72/raw-mobile667-after-initial-v1.json",
      "bytes": 507,
      "sha256": "17773eb4187505c6ba98ae9eb84e3398b78c7213ef17fbc6ea9df11279512d42"
    },
    {
      "path": "build/person-location-20261026-v72/raw-mobile667-after-terminal-v1.json",
      "bytes": 426,
      "sha256": "1c5b29198cadb0decfa7ddca15c41a82bcd0518874b0c081d41899463ea22ecd"
    },
    {
      "path": "build/person-location-20261026-v72/raw-mobile844-after-initial-v1.json",
      "bytes": 506,
      "sha256": "4c9949936b474033c36be306d7b4e5c9fe9e15e15ce5c28dee1e5e1a2415dbe9"
    },
    {
      "path": "build/person-location-20261026-v72/raw-mobile844-after-terminal-v1.json",
      "bytes": 427,
      "sha256": "3c1ff3568f74516ce0e2f9a6d5bd9d3b0ee09dafd4987b92fd0f0d224f632cfe"
    },
    {
      "path": "build/person-location-20261026-v72/raw-pc1080-after-initial-v1.json",
      "bytes": 504,
      "sha256": "eb8847791b34c73f1e475cf659b1d193d088b3f8c31bd20aae168ae659db0876"
    },
    {
      "path": "build/person-location-20261026-v72/raw-pc1080-after-terminal-v1.json",
      "bytes": 424,
      "sha256": "7b82bb18b4bc4a08695d101c8f1bdeedb3bfeb73234133ff9c742e83c1c12a80"
    },
    {
      "path": "build/person-location-20261026-v72/raw-pc720-after-initial-v1.json",
      "bytes": 503,
      "sha256": "782a3c40a1101f3d6ba408a3f825ed8ddc45803f228b773e526f1a6f25137f65"
    },
    {
      "path": "build/person-location-20261026-v72/raw-pc720-after-terminal-v1.json",
      "bytes": 422,
      "sha256": "c02998fc604c0d44f368c41f6308fecaea4792497c09fb026bcceaff7f0654c5"
    },
    {
      "path": "build/person-location-20261026-v72/raw-pc720-before-initial-v1.json",
      "bytes": 504,
      "sha256": "e81dbba868b9e26b196ab27d5fdd9e42346e7c4fd203dc118a54533ad36eb3ac"
    },
    {
      "path": "build/person-location-20261026-v72/raw-pc720-before-terminal-v1.json",
      "bytes": 1565,
      "sha256": "5c846373897d24912493e6d17f98bb89baf842644d896d4fe09b74c7a9fa996c"
    },
    {
      "path": "build/person-location-20261026-v72/raw-preserved-state-terminal-v1.json",
      "bytes": 658,
      "sha256": "33fe0868c47b78c010f24d2f44cdd183d4149657def7ea4f32a011e055c922a3"
    },
    {
      "path": "build/person-location-20261026-v72/raw-source-epoch-initial-v1.json",
      "bytes": 1096,
      "sha256": "b6770320127ba586fdc6a4a38a62e17e945d09e4b2402ea17994da0f5a69c532"
    },
    {
      "path": "build/person-location-20261026-v72/raw-source-epoch-terminal-v2.json",
      "bytes": 788,
      "sha256": "41063606196e8eba8a661b4c10392eaaf8595eb9bcab2e3a2724a8970b6c60a1"
    },
    {
      "path": "build/person-location-20261026-v72/run-full-default-v1.mjs",
      "bytes": 4137,
      "sha256": "52f3c7256587e245d076061c834d5a52b1039aaa329e4a10f82664b4c763924d"
    },
    {
      "path": "build/person-location-20261026-v72/run-location-targets-v1.mjs",
      "bytes": 2614,
      "sha256": "76153ecef46330d46a3fd2d18f63501a4aa4cd9b3fb2b0505cae18727967b0cb"
    },
    {
      "path": "build/person-location-20261026-v72/save-parent-v1.mjs",
      "bytes": 1339,
      "sha256": "a7adfd39684e5541a19744df6e9f99fed5526fff19258941d6d9a0db43759dae"
    },
    {
      "path": "build/person-location-20261026-v72/shared-runtime-extension-v1.json",
      "bytes": 1845,
      "sha256": "b0304ae1157a3c675b511da1801b1b92ca725232402a96097a190e773963a663"
    },
    {
      "path": "build/person-location-20261026-v72/source-epoch-v1.json",
      "bytes": 31459,
      "sha256": "5e2b0e7f58b389ce04d0844603942b3238bf268afd768d63241f21b3cbed58fb"
    },
    {
      "path": "docs/validation/m5-person-roles-20261026-v71.json",
      "bytes": 130027,
      "sha256": "b3e9df5a5c3f5d837497240cf99a0e840b1b360bd838549b915aadddfe10867a"
    }
  ],
  "runtimeInventoryCount": 1227,
  "inventoryCritical": {
    "currentCount": 159,
    "runtimeIntersectionCount": 147,
    "notInRuntimeCount": 12,
    "notInRuntimePaths": [
      "designer.html",
      "hd-portrait-dump.html",
      "m-ges.html",
      "m-ktouch.html",
      "m-old.html",
      "scripts/hd-city-resource-runtime-checks.mjs",
      "scripts/hd-person-equipment-runtime-checks.mjs",
      "scripts/test-hd-city-hud.mjs",
      "scripts/test-hd-city-mobile-host.mjs",
      "scripts/test-hd-mobile-city-runtime.mjs",
      "scripts/test-hd-native-sem.mjs",
      "scripts/test-hd-person-equipment-runtime.mjs"
    ]
  },
  "baselineProduct": {
    "source": {
      "path": "build/person-location-20261026-v72/before/js/hd-city-menu.js",
      "bytes": 448176,
      "sha256": "cfcd4f89e14987db475bb6950d24bce7425d36999eb6d5576842790909068399"
    },
    "descriptor": {
      "path": "build/person-location-20261026-v72/baseline-city-menu-v1.json",
      "bytes": 268,
      "sha256": "f8667ee8c9be5f6dc3ca7e972daecd798d7adf6f513fe763269b55e2d2f3c484"
    },
    "parentCommit": "73d7cfa2ba3021b644c8455878419ecf334fc4d6"
  },
  "fullDefault": {
    "result": {
      "path": "build/person-location-20261026-v72/full-default-v1.json",
      "bytes": 1843,
      "sha256": "ae0164af029063c272cb00494383375970bb2cccdd418ca677c2a715a299d23e"
    },
    "tool": {
      "initial": {
        "path": "build/person-location-20261026-v72/raw-full-default-initial-v1.json",
        "bytes": 346,
        "sha256": "3c18c9e54bd8336ff3a8393ede67e6133f3c23c690a94ed42c1cb8eb030e07ab"
      },
      "terminal": {
        "path": "build/person-location-20261026-v72/raw-full-default-terminal-v1.json",
        "bytes": 407,
        "sha256": "ca8442c7b792d73ea15a2ce54a00ea791a1708e88ba5032bcb4cd43a9b68b516"
      },
      "initialChunk": "501ca9",
      "terminalChunk": "c42a31",
      "sessionId": 17254
    },
    "expectedTests": 7943,
    "newDistinctTests": 12
  },
  "unitControls": [
    {
      "result": {
        "path": "build/person-location-20261026-v72/hud-location-current-v1.json",
        "bytes": 1044,
        "sha256": "bc9a72ceb3ab5f5eeaa4187f80efa8fc11aa88f32a2ca73f0f73997860404319"
      },
      "tool": {
        "path": "build/person-location-20261026-v72/raw-hud-current-terminal-v1.json",
        "bytes": 1093,
        "sha256": "59b96eb3b97eae1a9e4fb0299b5fde8790f594596a252b8d8b96d5c8006076f9"
      },
      "toolChunk": "e21c2f",
      "tests": 202,
      "pass": 202,
      "fail": 0,
      "baselineProduct": null
    },
    {
      "result": {
        "path": "build/person-location-20261026-v72/hud-location-parent-negative-v1.json",
        "bytes": 1256,
        "sha256": "62172864d8f513d833c7e1d3adb2bd6edbc8d300359047f56f5c83d81a322666"
      },
      "tool": {
        "path": "build/person-location-20261026-v72/raw-hud-parent-negative-terminal-v1.json",
        "bytes": 1303,
        "sha256": "aeb591eee8235752bc7ad9486cb6fb7fceff1f0c2011cd2dbef4fdaa6512aab0"
      },
      "toolChunk": "20aa57",
      "tests": 202,
      "pass": 190,
      "fail": 12,
      "baselineProduct": {
        "path": "build/person-location-20261026-v72/before/js/hd-city-menu.js",
        "bytes": 448176,
        "sha256": "cfcd4f89e14987db475bb6950d24bce7425d36999eb6d5576842790909068399"
      }
    },
    {
      "result": {
        "path": "build/person-location-20261026-v72/hud-location-no-reentry-negative-v1.json",
        "bytes": 1304,
        "sha256": "920f2663ca428c8339c2efd7c1e102e9fb1c103bfee94419472154f1aba140f0"
      },
      "tool": {
        "path": "build/person-location-20261026-v72/raw-hud-no-reentry-negative-terminal-v1.json",
        "bytes": 1342,
        "sha256": "f57f8a159caa9c749861e087b91a2a735487be3dd761f43d5bb49b3225bde4da"
      },
      "toolChunk": "2f62b0",
      "tests": 202,
      "pass": 201,
      "fail": 1,
      "baselineProduct": {
        "path": "build/person-location-20261026-v72/before/hd-city-menu-location-no-reentry-native-capacity.js",
        "bytes": 454668,
        "sha256": "ec7ee907339870c8d5618efcd77205d001512f5bfe2ec4e24bb3c2b4d5e3a571"
      }
    },
    {
      "result": {
        "path": "build/person-location-20261026-v72/hud-location-abi-negative-v1.json",
        "bytes": 1256,
        "sha256": "21b303144b22fc976e2cc5148404c5dcd55548c60ffb25924915e0a6d237617d"
      },
      "tool": {
        "path": "build/person-location-20261026-v72/raw-hud-abi-negative-terminal-v1.json",
        "bytes": 1303,
        "sha256": "5f56963413f867a75b933db60689f5360b762ca282f943986052d9e23782a270"
      },
      "toolChunk": "c371a1",
      "tests": 202,
      "pass": 190,
      "fail": 12,
      "baselineProduct": {
        "path": "build/person-location-20261026-v72/before/hd-city-menu-location-stage2.js",
        "bytes": 455218,
        "sha256": "2ad926814b4260ae1539bdf75dba9bbbc3e05a7a9328857e83ef0904a915304d"
      }
    }
  ],
  "noReentryVariant": {
    "receipt": {
      "path": "build/person-location-20261026-v72/no-reentry-control-source-v1.json",
      "bytes": 902,
      "sha256": "c14a424491000d8f69d238af8541a3273f2ba7a6844b64e923a7c274a7c7c843"
    },
    "before": {
      "path": "build/person-location-20261026-v72/before/hd-city-menu-location-stage1.js",
      "bytes": 454666,
      "sha256": "62256b555cee17b1648e3e9a60802a03740da0eb035a350c8b2bfdcdd9caa639"
    },
    "after": {
      "path": "build/person-location-20261026-v72/before/hd-city-menu-location-no-reentry-native-capacity.js",
      "bytes": 454668,
      "sha256": "ec7ee907339870c8d5618efcd77205d001512f5bfe2ec4e24bb3c2b4d5e3a571"
    }
  },
  "sharedRuntimeRepair": {
    "path": "build/person-location-20261026-v72/shared-runtime-extension-v1.json",
    "bytes": 1845,
    "sha256": "b0304ae1157a3c675b511da1801b1b92ca725232402a96097a190e773963a663"
  },
  "markdown": "# 原版人物所在城市与原生属性1验证\n\n本批在原版当前 PERSON 详情的“身份与经历”增加只读“所在城市”。来源严格采用 C GetPersonCity 的城0..37、各城完整队列顺序及首次匹配，不用菜单起始城或人物归属猜位置；重复记录保留首城／首偏移。逻辑人物200与原生物理人物绑定2000分别验证，城市绑定38、队列2000；未知库、自定义属性、无匹配255、损坏范围、来源漂移及 getter 重入都不显示该行。未新增原生导出、属性hook重放、原生输入或world写入；原15项诊断字段与自定义原生语义保持。\n\n四个任务专属真实原版P4曹丕／晋阳新局，PC1080／PC720／模拟844／模拟667均检查崔琰29在晋阳4，以及朵思大王139、祝融夫人143在云南30。位置同时与原ROM队列、当前完整城池队列的首次匹配及实际翻到的原生属性1逐项一致。原生标题完整保留空格“ 所在城市 ”。共12人次位置／24个HD与native目标，另有12人次既有身份／60个姓名归属目标；这些是浏览器观察，不是84项单元测试，也不是全部13属性验收。每人实际37前翻／36返回，四场合计24个属性分页键；每场仅一次执行者39，敌方目标确认0，再40／40按原生回执回MAP，无派发或月结。\n\n每个位置目标保留完整文本、Range、祖先裁切、命中、标签值不重叠、当前ID／来源／代次和原始PNG。读取、截图及真实滚动零额外原生键／LCD触摸；分页除person属性画面外所有已采native字段保持，日期、config、200逻辑人物、38城池、队列、订单等全部已测world保持。模拟844／667各11／24次真实名单滚动；四场阶段25／25／39／52全部保存，自有Chrome树均退出。Chrome手机尺寸模拟不授真机或稳定性能信用。\n\n旧73d7cfa产品的真实PC720新局在6阶段完成崔琰的既有身份观察，却没有HD位置行，原exit1、全部5个全局false、失败图及已接受的身份子记录均保留；不改成整场成功。修复后四布局均在同一冻结产品／运行器源码闭合，无事后attrs例外。完整5份报告使用原32MiB byte ranges，先重核整件长度／SHA，再解析；未知字段不投影、不丢弃。全部阶段图、9种执行副本、console、来源与owned-process原记录和CLI初始／终态均收录；归档代码是数据，验证器不执行它。\n\nHUD受控模块202／202通过，其中12项新增。旧父产品190通过／12预期失败；隔离的无重入保护变体仅修正两个物理容量字面量，201通过／1预期失败；保留错误物理容量的旧候选190通过／12预期失败。底层负控exit1与确认负控有效的外层exit0分别保留。完整默认实际7943／7943、150模块、Clang18通过，fail／cancel／skip／todo均0，1650项选定来源运行前后稳定。202是全量子集，先前单独12项探针不重复加总。\n\n当前159关键源码全部原字节核对，128份native整件aggregate仍为617c3aea391fa57bec1576e70cb6b4b1ed76f747c948015069a71f71b168ffb0，WASM未重建，原构建sourceRevision／modified标记保留。每场1227项冻结清单中147项与当前关键清单精确相交，12项差集逐项列明；冻结不表示每项都实际HTTP请求或执行。所有成功轮147项均等于最终当前原字节。V45八项限额不变，缺少本地build可由归档精确重构；本地原件存在但不一致则拒收。\n\n![PC1080](m5-person-location-20261026-v72-pc1080.png)\n\n![PC720](m5-person-location-20261026-v72-pc720.png)\n\n![模拟844](m5-person-location-20261026-v72-mobile844.png)\n\n![模拟667](m5-person-location-20261026-v72-mobile667.png)\n\n用户已明确保留旧战局、暂不重开并继续其他HD；本批没有旧战局LOAD／SAVE／END、输入、关闭或清理。俘虏／在野实际访问、目标确认／派发／月结、其他期实玩、任意Mod、全部13属性、完整ABI／SAVE／RNG、真机、稳定性能及整体HD仍未验收。\n"
};
export const eq = (a,b,message) => assert.ok(isDeepStrictEqual(a,b), message || 'Exact evidence equality');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = bytes => JSON.parse(bytes.toString('utf8'));
export const pin = (p,bytes) => ({path:relative(p), bytes:bytes.length, sha256:sha(bytes)});
export function relative(p) {
  assert.equal(typeof p,'string','Relative path is text');
  assert.ok(p && !path.isAbsolute(p) && !p.includes('\\') && p.split('/').every(x=>x&&x!=='.'&&x!=='..'), 'Safe relative path '+p);
  return p;
}
export function pin3(p,max=BOUNDS.maxFileBytes) {
  assert.ok(p && typeof p==='object','Pin object required');relative(p.path);
  assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&p.bytes<=max,'Bounded pin '+p.path);
  assert.match(p.sha256,/^[0-9a-f]{64}$/,'SHA256 '+p.path);
  return {path:p.path,bytes:p.bytes,sha256:p.sha256};
}
export function check(p,bytes) {
  assert.ok(Buffer.isBuffer(bytes),'Original Buffer '+p.path);
  eq(pin(p.path,bytes),pin3(p,32*BOUNDS.maxFileBytes),'Complete raw bytes '+p.path);return bytes;
}
export function readFile(root,p,max=BOUNDS.maxFileBytes) {
  relative(p);assert.ok(max>0&&max<=32*BOUNDS.maxFileBytes,'Explicit read bound');
  const base=fs.realpathSync.native(root);let file=base;const parts=p.split('/');
  for(let i=0;i<parts.length;i++) {
    file=path.join(file,parts[i]);const s=fs.lstatSync(file);
    assert.ok(!s.isSymbolicLink()&&(i===parts.length-1?s.isFile():s.isDirectory()),'Regular non-symlink '+p);
  }
  assert.ok(fs.realpathSync.native(file).startsWith(base+path.sep),'Path remains within root');
  const before=fs.lstatSync(file,{bigint:true});assert.ok(before.size<=BigInt(max),'Read size '+p);
  const bytes=fs.readFileSync(file),after=fs.lstatSync(file,{bigint:true});
  eq([after.dev,after.ino,after.size,after.mtimeNs,after.ctimeNs],
    [before.dev,before.ino,before.size,before.mtimeNs,before.ctimeNs],'Stable raw file '+p);
  return bytes;
}
export function uniquePins(rows) {
  const out=new Map();for(const p of rows){pin3(p,32*BOUNDS.maxFileBytes);
    if(out.has(p.path))eq(out.get(p.path),p,'One pin per original path '+p.path);else out.set(p.path,p);}
  return [...out.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export const publicModule = name => name==='v72-reader-v1.mjs'?PREFIX+'-verify.mjs':PREFIX+'-'+name;
export function portable(bytes) {
  return Buffer.from(bytes.toString('utf8').split('\n').map(line=>{
    if(!line.startsWith('import '))return line;
    for(const name of MODULES)for(const q of ["'",'"'])
      line=line.replaceAll(q+'./'+name+q,q+'./'+path.basename(publicModule(name))+q);
    return line.replaceAll("'../../../docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs'",
      "'./m5-quantity-ack-refresh-20261024-v45-verify.mjs'");
  }).join('\n'));
}
export function requireBinding(b,reviewed=true) {
  assert.ok(FIXED,'All actual closed cases must be pinned before SOURCE freeze');
  eq(b.schemaVersion,1,'Binding schema');eq(b.prefix,PREFIX,'Publication prefix');
  eq(b.reviewed,reviewed,'Root review state');eq(b.epoch,EPOCH,'Frozen current epoch');
  eq(b.cases.map(c=>c.id),FIXED.cases.map(c=>c.id),'All fixed original cases');
  for(let i=0;i<b.cases.length;i++) {
    const c=b.cases[i],f=FIXED.cases[i];eq(c.fixed,f,'Exact closed result and tool pins '+c.id);
    eq(c.manifest.path,D+c.id+'-chunks/manifest.json','Fixed whole manifest path');pin3(c.manifest);
    assert.ok(c.files.length>0,'Explicit original files '+c.id);c.files.forEach(p=>pin3(p));
  }
  eq(b.modules.map(p=>p.path),MODULES.map(n=>D+n),'Current reviewed reader modules');
  b.modules.forEach(p=>pin3(p));pin3(b.freeze);eq(b.freeze.path,D+'source-freeze-v1.json');
  eq(b.support.filter(p=>!p.path.startsWith(D)),FIXED.support,'Exact fixed support originals');
  b.support.forEach(p=>pin3(p));b.files.forEach(p=>pin3(p));
  eq(b.images.map(p=>p.id),['pc1080','pc720','mobile844','mobile667'],'Four representative layouts');
}
export function packetPlan(b,bindingPin) {
  const chunks=b.cases.flatMap(c=>c.chunks),chunkPaths=new Set(chunks.map(p=>p.path));
  const ordinary=uniquePins([...b.files,bindingPin]).filter(p=>!chunkPaths.has(p.path));
  const groups=new Map();for(const p of ordinary){const k=p.bytes+':'+p.sha256;
    if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  const packets=[];let files=[],named=0,unique=0;
  const flush=()=>{if(files.length)packets.push({id:'data-'+String(packets.length+1).padStart(3,'0'),files:uniquePins(files)});files=[];named=0;unique=0;};
  for(const group of groups.values()) {
    const size=group[0].bytes,total=group.reduce((n,p)=>n+p.bytes,0);
    assert.ok(size<=24*1024*1024&&total<=96*1024*1024&&group.length<=450,'Single alias-group budget');
    if(files.length&&(unique+size>24*1024*1024||named+total>96*1024*1024||files.length+group.length>450))flush();
    files.push(...group);named+=total;unique+=size;
  }
  flush();for(const c of b.cases)for(let i=0;i<c.chunks.length;i++)
    packets.push({id:c.id+'-raw-'+String(i+1).padStart(3,'0'),files:[c.chunks[i]]});
  return packets;
}
export function restore(physical,b) {
  const logical=new Map(physical);
  for(const c of b.cases) {
    const m=json(check(c.manifest,physical.get(c.manifest.path)));
    eq(m.schemaVersion,1,'Whole manifest schema');eq(m.encoding,'raw-byte-ranges','Uncompressed whole chunks');
    eq(m.original,c.fixed.result,'Original whole pin');eq(m.maxChunkBytes,BOUNDS.maxFileBytes,'Original 32MiB bound');
    eq(m.chunks.map(x=>pin3(x)),c.chunks,'Exact ordered chunk pins');
    const parts=[];let at=0;
    for(let i=0;i<m.chunks.length;i++) {
      const q=m.chunks[i];eq(q.index,i,'Chunk order');eq(q.offset,at,'Contiguous raw ranges');
      assert.ok(q.bytes>0&&q.bytes<=BOUNDS.maxFileBytes,'Nonempty raw chunk');
      if(i<m.chunks.length-1)eq(q.bytes,BOUNDS.maxFileBytes,'Full original range before last chunk');
      parts.push(check(q,physical.get(q.path)));at+=q.bytes;
    }
    eq(at,c.fixed.result.bytes,'Whole length');
    // Whole SHA is established before JSON parsing anywhere in the reader.
    logical.set(c.fixed.result.path,check(c.fixed.result,Buffer.concat(parts)));
  }
  return logical;
}
