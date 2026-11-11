import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const B='build/captive-person-20261026-v73/';
export const D=B+'evidence-source-v2/';
export const PREFIX='docs/validation/m5-captive-person-20261026-v73';
export const MODULES=['v73-common-v1.mjs','v73-reader-v1.mjs'];
export const SOURCES=[...MODULES,'prepare-v1.mjs','publish-v1.mjs','README.md'];
export const BOUNDS=Object.freeze({maxPartBytes:8388608,maxSerializedBytes:67108864,maxNamedRawBytes:134217728,maxUniqueRawBytes:100663296,maxFileBytes:33554432,maxFiles:512,maxBlobs:512,maxParts:32});
// Final actual closed runtime, historical failures, source epoch and default suite pins.
export const EPOCH={"path":"build/captive-person-20261026-v73/source-epoch-v2.json","bytes":36362,"sha256":"68620737409722c247bdcd295734de8dd85e7279c4127e5ba13b772b8456ce0b"};
export const FIXED={
  "cases": [
    {
      "id": "preflightBeforeV1",
      "kind": "preflight",
      "directory": "build/captive-person-20261026-v73/preflight-before-v1/",
      "preflightOnly": true,
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/captive-person-20261026-v73/preflight-before-v1/result.json",
        "bytes": 791941,
        "sha256": "39cb8dd91a3e476760a67f4da11e2f7e5cc3a4be361f21ec2050208936e6c349"
      },
      "sourceCount": 1225,
      "phaseCount": 0,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": false,
      "sourceAliases": [
        {
          "name": ".gitattributes",
          "source": ".gitattributes",
          "bytes": 43293,
          "sha256": "b22563777c8781b9257023af546fd2ed6a198cd17f417ce65385a9ae81d411fe"
        },
        {
          "name": "js/hd-city-menu.js",
          "source": "js/hd-city-menu.js",
          "bytes": 455220,
          "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
        },
        {
          "name": "m.html",
          "source": "m.html",
          "bytes": 18477,
          "sha256": "ac4964d732dd889a4d3dffeb5d9586e42923b6cbc566f85f5021a42b31556b82"
        },
        {
          "name": "package.json",
          "source": "package.json",
          "bytes": 21582,
          "sha256": "997f8df0878ae04f04d5d51b076295f31da1a81fb1b28eb4f67beebc1cf5cc74"
        },
        {
          "name": "pc.html",
          "source": "pc.html",
          "bytes": 28678,
          "sha256": "034cc852530a7d6647acc5ee1f4a662e27ec9bd725c7f3b64808f5a7df9ff0e8"
        },
        {
          "name": "scripts/hd-captive-person-runtime-checks.mjs",
          "source": "scripts/hd-captive-person-runtime-checks.mjs",
          "bytes": 15587,
          "sha256": "7276889ed71aee1b0e8ec10966363fb97f931769269c1a3bc515979821625a89"
        },
        {
          "name": "scripts/hd-person-identity-runtime-checks.mjs",
          "source": "scripts/hd-person-identity-runtime-checks.mjs",
          "bytes": 22276,
          "sha256": "e9f302c5e497c76ca521fb195b93c4e44ad8af79b0d4f972102ac78b8d3d50d6"
        },
        {
          "name": "scripts/test-hd-campaign-runtime.mjs",
          "source": "scripts/test-hd-campaign-runtime.mjs",
          "bytes": 129188,
          "sha256": "5c17efa589470f49572225e9caec14debfa3d86329f08480a407573e8eb31957"
        }
      ],
      "outcome": {
        "ok": true,
        "accepted": false,
        "hdAccepted": false,
        "captiveAccepted": false,
        "personCaptivesAccepted": false
      },
      "error": null,
      "exitCode": 0,
      "tool": {
        "initial": {
          "path": "build/captive-person-20261026-v73/raw-preflight-before-v1.json",
          "bytes": 503,
          "sha256": "86854a6a090eae7cdb9a264eadf6a8662de288f42f592229b030fb5e4c909f94"
        },
        "terminal": {
          "path": "build/captive-person-20261026-v73/raw-preflight-before-v1.json",
          "bytes": 503,
          "sha256": "86854a6a090eae7cdb9a264eadf6a8662de288f42f592229b030fb5e4c909f94"
        },
        "initialChunk": "3b4c8c",
        "terminalChunk": "3b4c8c",
        "sessionId": null
      },
      "runtimeLibHexRetained": false,
      "actualLibReadStages": []
    },
    {
      "id": "pc1080BeforeV1",
      "kind": "preparation-failure",
      "directory": "build/captive-person-20261026-v73/pc1080-before-v1/",
      "preflightOnly": false,
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/captive-person-20261026-v73/pc1080-before-v1/result.json",
        "bytes": 6889683,
        "sha256": "ae1bd3ca23e649464be40470a51d8d39e95b1e79fd3edf4178541ef5afa8df32"
      },
      "sourceCount": 1225,
      "phaseCount": 22,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": true,
      "sourceAliases": [
        {
          "name": ".gitattributes",
          "source": ".gitattributes",
          "bytes": 43293,
          "sha256": "b22563777c8781b9257023af546fd2ed6a198cd17f417ce65385a9ae81d411fe"
        },
        {
          "name": "js/hd-city-menu.js",
          "source": "js/hd-city-menu.js",
          "bytes": 455220,
          "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
        },
        {
          "name": "m.html",
          "source": "m.html",
          "bytes": 18477,
          "sha256": "ac4964d732dd889a4d3dffeb5d9586e42923b6cbc566f85f5021a42b31556b82"
        },
        {
          "name": "package.json",
          "source": "package.json",
          "bytes": 21582,
          "sha256": "997f8df0878ae04f04d5d51b076295f31da1a81fb1b28eb4f67beebc1cf5cc74"
        },
        {
          "name": "pc.html",
          "source": "pc.html",
          "bytes": 28678,
          "sha256": "034cc852530a7d6647acc5ee1f4a662e27ec9bd725c7f3b64808f5a7df9ff0e8"
        },
        {
          "name": "scripts/hd-captive-person-runtime-checks.mjs",
          "source": "scripts/hd-captive-person-runtime-checks.mjs",
          "bytes": 15587,
          "sha256": "7276889ed71aee1b0e8ec10966363fb97f931769269c1a3bc515979821625a89"
        },
        {
          "name": "scripts/hd-person-identity-runtime-checks.mjs",
          "source": "scripts/hd-person-identity-runtime-checks.mjs",
          "bytes": 22276,
          "sha256": "e9f302c5e497c76ca521fb195b93c4e44ad8af79b0d4f972102ac78b8d3d50d6"
        },
        {
          "name": "scripts/test-hd-campaign-runtime.mjs",
          "source": "scripts/test-hd-campaign-runtime.mjs",
          "bytes": 129188,
          "sha256": "5c17efa589470f49572225e9caec14debfa3d86329f08480a407573e8eb31957"
        }
      ],
      "outcome": {
        "ok": false,
        "accepted": false,
        "hdAccepted": false,
        "captiveAccepted": false,
        "personCaptivesAccepted": false
      },
      "error": "Error: Timed out waiting for native function menu army-fixture-end-month\n    at waitFor (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:183:11)\n    at async openFunctionMenu (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:1380:5)\n    at async prepareArmy (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:606:5)\n    at async campaignSmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:689:39)\n    at async smoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:463:5)\n    at async mainCaptives (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:1525:65)",
      "exitCode": 1,
      "tool": {
        "initial": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-before-initial-v1.json",
          "bytes": 796,
          "sha256": "89ddac4856c6cc3d4a1407345c30690912fa47cdd818b5e9d8751d1e27f612c4"
        },
        "terminal": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-before-terminal-v1.json",
          "bytes": 1730,
          "sha256": "99ea5284ffb2676b50d426045b46a53f745343268b709206da406657acd62b66"
        },
        "initialChunk": "d68b2b",
        "terminalChunk": "e860b3",
        "sessionId": 21014
      },
      "runtimeLibHexRetained": false,
      "actualLibReadStages": [
        "startup"
      ]
    },
    {
      "id": "pc1080BeforeV2",
      "kind": "capture-helper-failure",
      "directory": "build/captive-person-20261026-v73/pc1080-before-v2/",
      "preflightOnly": false,
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/captive-person-20261026-v73/pc1080-before-v2/result.json",
        "bytes": 16706467,
        "sha256": "8e70a7d6dcec47e8802236563b3d3c4c9fccc9c15c51030a975db411a5018a70"
      },
      "sourceCount": 1225,
      "phaseCount": 77,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": true,
      "sourceAliases": [
        {
          "name": ".gitattributes",
          "source": ".gitattributes",
          "bytes": 43293,
          "sha256": "b22563777c8781b9257023af546fd2ed6a198cd17f417ce65385a9ae81d411fe"
        },
        {
          "name": "js/hd-city-menu.js",
          "source": "js/hd-city-menu.js",
          "bytes": 455220,
          "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
        },
        {
          "name": "m.html",
          "source": "m.html",
          "bytes": 18477,
          "sha256": "ac4964d732dd889a4d3dffeb5d9586e42923b6cbc566f85f5021a42b31556b82"
        },
        {
          "name": "package.json",
          "source": "package.json",
          "bytes": 21582,
          "sha256": "997f8df0878ae04f04d5d51b076295f31da1a81fb1b28eb4f67beebc1cf5cc74"
        },
        {
          "name": "pc.html",
          "source": "pc.html",
          "bytes": 28678,
          "sha256": "034cc852530a7d6647acc5ee1f4a662e27ec9bd725c7f3b64808f5a7df9ff0e8"
        },
        {
          "name": "scripts/hd-captive-person-runtime-checks.mjs",
          "source": "scripts/hd-captive-person-runtime-checks.mjs",
          "bytes": 15587,
          "sha256": "7276889ed71aee1b0e8ec10966363fb97f931769269c1a3bc515979821625a89"
        },
        {
          "name": "scripts/hd-person-identity-runtime-checks.mjs",
          "source": "scripts/hd-person-identity-runtime-checks.mjs",
          "bytes": 22276,
          "sha256": "e9f302c5e497c76ca521fb195b93c4e44ad8af79b0d4f972102ac78b8d3d50d6"
        },
        {
          "name": "scripts/test-hd-campaign-runtime.mjs",
          "source": "scripts/test-hd-campaign-runtime.mjs",
          "bytes": 132444,
          "sha256": "d78be95dc920ef9fe7a2d2107981598b6bd27547d8a5df245b2e8bbf414898b3"
        }
      ],
      "outcome": {
        "ok": false,
        "accepted": false,
        "hdAccepted": false,
        "captiveAccepted": false,
        "personCaptivesAccepted": false
      },
      "error": "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n+ actual - expected\n\n+ {\n+   name: '许昌',\n+   to: {\n+     x: 8,\n+     y: 3\n+   }\n+ }\n- true\n\n    at runCaptiveInspection (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-captive-person-runtime-checks.mjs:104:176)\n    at async inspectActualCaptives (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:782:5)\n    at async campaignSmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:748:29)\n    at async smoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:463:5)\n    at async mainCaptives (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:1555:65)",
      "exitCode": 1,
      "tool": {
        "initial": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-before-initial-v2.json",
          "bytes": 794,
          "sha256": "b0e71c2681cc82beb64bb7840ee7a8a451d9cd429750bcb5313bda62bc3c054d"
        },
        "terminal": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-before-terminal-v2.json",
          "bytes": 1638,
          "sha256": "d517cb197786ddded567455aa27adf0807131470527d94ffb73f743c0dac3727"
        },
        "initialChunk": "1464a3",
        "terminalChunk": "8a0067",
        "sessionId": 70081
      },
      "captiveIds": [
        8,
        76,
        77,
        75
      ],
      "runtimeLibHexRetained": false,
      "actualLibReadStages": [
        "startup",
        "settled-before-captive-inspection"
      ]
    },
    {
      "id": "failedAfterV1",
      "kind": "product-after-failure",
      "directory": "build/captive-person-20261026-v73/pc1080-after-v1/",
      "preflightOnly": false,
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/captive-person-20261026-v73/pc1080-after-v1/result.json",
        "bytes": 17849957,
        "sha256": "7a5ea9469bd961ab3418c97b20bfd154ec46904f2a68322fb3c26088e4142243"
      },
      "sourceCount": 1225,
      "phaseCount": 83,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": true,
      "sourceAliases": [
        {
          "name": "js/hd-city-menu.js",
          "source": "js/hd-city-menu.js",
          "bytes": 473955,
          "sha256": "7e7a56754439a417a72881cce98a0c8c341b247fc50a935b703956251c45fe16"
        },
        {
          "name": "scripts/hd-captive-person-runtime-checks.mjs",
          "source": "scripts/hd-captive-person-runtime-checks.mjs",
          "bytes": 16036,
          "sha256": "bed52f5464a3c300f2841ce6c27295b2816a827daf2ad0be2b78951ba40f2121"
        },
        {
          "name": "scripts/hd-person-identity-runtime-checks.mjs",
          "source": "scripts/hd-person-identity-runtime-checks.mjs",
          "bytes": 22276,
          "sha256": "e9f302c5e497c76ca521fb195b93c4e44ad8af79b0d4f972102ac78b8d3d50d6"
        },
        {
          "name": "scripts/test-hd-campaign-runtime.mjs",
          "source": "scripts/test-hd-campaign-runtime.mjs",
          "bytes": 132579,
          "sha256": "513b138bc04105afd9463df4d8a83e6ca39e701f395e3aa63192936ffab0941c"
        }
      ],
      "outcome": {
        "ok": false,
        "accepted": false,
        "identityAccepted": false,
        "hdAccepted": false,
        "captiveAccepted": false,
        "personCaptivesAccepted": false
      },
      "error": "Error: Timed out waiting for actual SURRENDER captive PERSON\n    at waitFor (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:183:11)\n    at async runCaptiveInspection (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-captive-person-runtime-checks.mjs:112:20)\n    at async inspectActualCaptives (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:783:5)\n    at async campaignSmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:749:29)\n    at async smoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:464:5)\n    at async mainCaptives (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-campaign-runtime.mjs:1556:65)",
      "exitCode": 1,
      "tool": {
        "initial": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-after-initial-v1.json",
          "bytes": 718,
          "sha256": "1c4cb35565b9f7d1e54167b89fb17065d7d3f55dea35cad160e63c969dfa92cb"
        },
        "terminal": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-after-terminal-v1.json",
          "bytes": 1332,
          "sha256": "9fa7ad8529e28c94a36427a0599fe43a55487fcf85db38dc5c575c5568e37153"
        },
        "initialChunk": "dacf72",
        "terminalChunk": "c713b8",
        "sessionId": 49320
      },
      "captiveIds": [
        77,
        75,
        76,
        8
      ],
      "runtimeLibHexRetained": false,
      "actualLibReadStages": [
        "startup",
        "settled-before-captive-inspection"
      ]
    },
    {
      "id": "pc1080AcceptedV2",
      "kind": "accepted-runtime",
      "directory": "build/captive-person-20261026-v73/pc1080-after-v2/",
      "preflightOnly": false,
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/captive-person-20261026-v73/pc1080-after-v2/result.json",
        "bytes": 87681565,
        "sha256": "806c840e49e6fbb8b0680f194185678a0ba647dc6a10ddc9eb723dc776c6760d"
      },
      "sourceCount": 1225,
      "phaseCount": 120,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "failureImage": false,
      "sourceAliases": [],
      "outcome": {
        "ok": true,
        "accepted": true,
        "identityAccepted": true,
        "hdAccepted": true,
        "captiveAccepted": true,
        "personCaptivesAccepted": true
      },
      "error": null,
      "exitCode": 0,
      "tool": {
        "initial": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-after-initial-v2.json",
          "bytes": 717,
          "sha256": "f0c7e15200a500495aa5c59b23436a75da0509817509297089c6939e02dae064"
        },
        "terminal": {
          "path": "build/captive-person-20261026-v73/raw-pc1080-after-terminal-v2.json",
          "bytes": 396,
          "sha256": "2453e3c0167881e0270fa45cf3f56dd8a304d6c460f7c1f844da10230a18f95a"
        },
        "initialChunk": "9adeb4",
        "terminalChunk": "277ed1",
        "sessionId": 1306
      },
      "runtimeLibHexRetained": true,
      "actualLibReadStages": [
        "startup",
        "settled-before-captive-inspection",
        "after-captive-inspection"
      ],
      "captiveIds": [
        77,
        76,
        75,
        8
      ],
      "representativePhases": [
        {
          "id": "pc1080-target",
          "label": "captive-location-8-hdLocation"
        },
        {
          "id": "pc1080-actor",
          "label": "captive-identity-person-19-heading"
        }
      ]
    }
  ],
  "inventoryCritical": {
    "currentCount": 161,
    "runtimeIntersectionCount": 145,
    "runtimeIntersectionPaths": [
      ".gitattributes",
      "css/hd-city-menu.css",
      "js/baye.build.json",
      "js/baye.js",
      "js/baye.wasm",
      "js/baye.wasm.map",
      "js/hd-city-menu.js",
      "libs/dat-mod.lib",
      "m.html",
      "package.json",
      "pc.html",
      "scripts/hd-captive-person-runtime-checks.mjs",
      "scripts/hd-person-identity-rom.mjs",
      "scripts/hd-person-identity-runtime-checks.mjs",
      "scripts/hd-runtime-json.mjs",
      "scripts/hd-runtime-owned-chrome.mjs",
      "scripts/test-hd-campaign-runtime.mjs",
      "vendor/iBaye/.gitignore",
      "vendor/iBaye/.gitmodules",
      "vendor/iBaye/ATTRIBUTION.md",
      "vendor/iBaye/CMakeLists.txt",
      "vendor/iBaye/LICENSE",
      "vendor/iBaye/README.md",
      "vendor/iBaye/UPSTREAM_COMMIT",
      "vendor/iBaye/js/.gitignore",
      "vendor/iBaye/js/config.sh",
      "vendor/iBaye/js/whitelist.json",
      "vendor/iBaye/src/CMakeLists.txt",
      "vendor/iBaye/src/FgtCount.c",
      "vendor/iBaye/src/FgtPkAi.c",
      "vendor/iBaye/src/Fight.c",
      "vendor/iBaye/src/FightSub.c",
      "vendor/iBaye/src/Gamhzk.bin",
      "vendor/iBaye/src/PublicFun.c",
      "vendor/iBaye/src/Size.c",
      "vendor/iBaye/src/baye/attribute.h",
      "vendor/iBaye/src/baye/bind-objects.h",
      "vendor/iBaye/src/baye/comm.h",
      "vendor/iBaye/src/baye/compa.h",
      "vendor/iBaye/src/baye/consdef.h",
      "vendor/iBaye/src/baye/data-bind.h",
      "vendor/iBaye/src/baye/datman.h",
      "vendor/iBaye/src/baye/enghead.h",
      "vendor/iBaye/src/baye/errcode.h",
      "vendor/iBaye/src/baye/extern.h",
      "vendor/iBaye/src/baye/fight.h",
      "vendor/iBaye/src/baye/fsys.h",
      "vendor/iBaye/src/baye/fundec.h",
      "vendor/iBaye/src/baye/fundef.h",
      "vendor/iBaye/src/baye/graph.h",
      "vendor/iBaye/src/baye/itoa.h",
      "vendor/iBaye/src/baye/order.h",
      "vendor/iBaye/src/baye/paccount.h",
      "vendor/iBaye/src/baye/resource.h",
      "vendor/iBaye/src/baye/sconst.h",
      "vendor/iBaye/src/baye/script.h",
      "vendor/iBaye/src/baye/sharefun.h",
      "vendor/iBaye/src/baye/sources.h",
      "vendor/iBaye/src/baye/stdsys.h",
      "vendor/iBaye/src/bind-objects.c",
      "vendor/iBaye/src/citycmd.c",
      "vendor/iBaye/src/citycmdb.c",
      "vendor/iBaye/src/citycmdc.c",
      "vendor/iBaye/src/citycmdd.c",
      "vendor/iBaye/src/citycmde.c",
      "vendor/iBaye/src/cityedit.c",
      "vendor/iBaye/src/comIn.c",
      "vendor/iBaye/src/comOut.c",
      "vendor/iBaye/src/config.c",
      "vendor/iBaye/src/convert_to_c.py",
      "vendor/iBaye/src/dat.lib.orig",
      "vendor/iBaye/src/data-bind.c",
      "vendor/iBaye/src/data/pconst.h",
      "vendor/iBaye/src/data/pstring.h",
      "vendor/iBaye/src/datman.c",
      "vendor/iBaye/src/debug.c",
      "vendor/iBaye/src/font.bin",
      "vendor/iBaye/src/fsys.c",
      "vendor/iBaye/src/gamEng.c",
      "vendor/iBaye/src/genver.py",
      "vendor/iBaye/src/hd-bridge.c",
      "vendor/iBaye/src/hd-bridge.h",
      "vendor/iBaye/src/inc/ADDR.H",
      "vendor/iBaye/src/inc/DictAfx.h",
      "vendor/iBaye/src/inc/DictHelp.h",
      "vendor/iBaye/src/inc/GuiEdit.h",
      "vendor/iBaye/src/inc/MEM.H",
      "vendor/iBaye/src/inc/STDLIB.H",
      "vendor/iBaye/src/inc/SysResv.h",
      "vendor/iBaye/src/inc/dictsys.h",
      "vendor/iBaye/src/inc/filetype.h",
      "vendor/iBaye/src/inc/flash.h",
      "vendor/iBaye/src/inc/fsys.h",
      "vendor/iBaye/src/inc/keytable.h",
      "vendor/iBaye/src/inc/shell.h",
      "vendor/iBaye/src/infdeal.c",
      "vendor/iBaye/src/itoa.c",
      "vendor/iBaye/src/main.c",
      "vendor/iBaye/src/miniz.c",
      "vendor/iBaye/src/miniz.h",
      "vendor/iBaye/src/paccount.c",
      "vendor/iBaye/src/pconst.c",
      "vendor/iBaye/src/picture.asm",
      "vendor/iBaye/src/platform/common/bios.c",
      "vendor/iBaye/src/platform/common/gui.c",
      "vendor/iBaye/src/platform/common/sem.h",
      "vendor/iBaye/src/platform/common/sys.c",
      "vendor/iBaye/src/platform/common/timer.h",
      "vendor/iBaye/src/platform/ios/dummy-script.c",
      "vendor/iBaye/src/platform/ios/fsys.c",
      "vendor/iBaye/src/platform/ios/sem.m",
      "vendor/iBaye/src/platform/ios/sys-ios.c",
      "vendor/iBaye/src/platform/ios/timer.m",
      "vendor/iBaye/src/platform/js/dat.lib.c",
      "vendor/iBaye/src/platform/js/exportjs.c",
      "vendor/iBaye/src/platform/js/font.bin.c",
      "vendor/iBaye/src/platform/js/font24.1.bin.c",
      "vendor/iBaye/src/platform/js/font24.2.bin.c",
      "vendor/iBaye/src/platform/js/font24.3.bin.c",
      "vendor/iBaye/src/platform/js/font24.4.bin.c",
      "vendor/iBaye/src/platform/js/font24_ascii.1.c",
      "vendor/iBaye/src/platform/js/font24_ascii.2.c",
      "vendor/iBaye/src/platform/js/fsys.c",
      "vendor/iBaye/src/platform/js/main.c",
      "vendor/iBaye/src/platform/js/script.c",
      "vendor/iBaye/src/platform/js/sem.c",
      "vendor/iBaye/src/platform/js/sys-js.c",
      "vendor/iBaye/src/platform/js/timer.c",
      "vendor/iBaye/src/platform/win/fsys.c",
      "vendor/iBaye/src/platform/win/game.c",
      "vendor/iBaye/src/platform/win/script.c",
      "vendor/iBaye/src/platform/win/sem.c",
      "vendor/iBaye/src/platform/win/sys.c",
      "vendor/iBaye/src/platform/win/timer.c",
      "vendor/iBaye/src/platform/win/window.c",
      "vendor/iBaye/src/pstring.c",
      "vendor/iBaye/src/res-msgpack.c",
      "vendor/iBaye/src/res-msgpack.h",
      "vendor/iBaye/src/showface.c",
      "vendor/iBaye/src/strcnt.c",
      "vendor/iBaye/src/tactic.c",
      "vendor/iBaye/src/touch.c",
      "vendor/iBaye/src/touch.h",
      "vendor/iBaye/src/varma.c",
      "vendor/iBaye/src/version.c"
    ],
    "notInRuntimeCount": 16,
    "notInRuntimePaths": [
      "designer.html",
      "hd-portrait-dump.html",
      "m-ges.html",
      "m-ktouch.html",
      "m-old.html",
      "scripts/hd-city-resource-runtime-checks.mjs",
      "scripts/hd-mobile-preview-runtime-checks.mjs",
      "scripts/hd-person-equipment-runtime-checks.mjs",
      "scripts/hd-person-location-runtime-checks.mjs",
      "scripts/hd-person-roles-runtime-checks.mjs",
      "scripts/test-hd-city-hud.mjs",
      "scripts/test-hd-city-mobile-host.mjs",
      "scripts/test-hd-mobile-city-runtime.mjs",
      "scripts/test-hd-native-sem.mjs",
      "scripts/test-hd-person-equipment-runtime.mjs",
      "scripts/test-hd-person-identity-runtime.mjs"
    ]
  },
  "parentFullSources": {
    "path": "build/person-location-20261026-v72/full-default-v1.before.json",
    "bytes": 278960,
    "sha256": "140ef538fb2c8ca41134a90fa234afaf6fa27891749cbabf4f2488f83cc88345"
  },
  "parentCampaignSource": {
    "path": "build/captive-person-20261026-v73/parent-campaign-source-v1.json",
    "bytes": 923,
    "sha256": "26f662dbdb3820591d0f95c998bcfd858ddda22d1ad51b05c8dfbe34d0614e6b"
  },
  "parentCommit": "ce3c26d8a32785f671506802dc8dda90a8e817b1",
  "preservedState": {
    "path": "build/captive-person-20261026-v73/preserved-state-after-v1.json",
    "bytes": 681,
    "sha256": "8e72c27c3e625c6dda8702d7a48918e742a3d7135771c19b75414e7fdee155ca"
  },
  "unitControls": [
    {
      "kind": "current",
      "result": {
        "path": "build/captive-person-20261026-v73/hud-surrender-current-v2.json",
        "bytes": 1954,
        "sha256": "d3d3d03dc38692a0338e659936c80375744d0a515ef74520ce44b57cee568602"
      },
      "tests": 216,
      "pass": 216,
      "fail": 0,
      "sourceVariant": null,
      "tool": {
        "path": "build/captive-person-20261026-v73/raw-hud-current-terminal-v2.json",
        "bytes": 399,
        "sha256": "900007f0dafacdebeb5250f58b3d0aaff2eea28f000e92c21ead99069983ca37"
      },
      "toolChunk": "f97f04"
    },
    {
      "kind": "parent-negative",
      "result": {
        "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v2.json",
        "bytes": 2359,
        "sha256": "1ffbd2fc8caffd981c313ac9082b746a353dc3bcfc3e13e973fd33328ca5438e"
      },
      "tests": 216,
      "pass": 203,
      "fail": 13,
      "sourceVariant": {
        "path": "build/captive-person-20261026-v73/parent-city-menu-v72.js",
        "bytes": 455220,
        "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
      },
      "tool": {
        "path": "build/captive-person-20261026-v73/raw-hud-parent-negative-terminal-v2.json",
        "bytes": 418,
        "sha256": "c72c8020806d09ed7e035e56fb566f7c51dd37ad2d26eaa1768c97c06b1925f8"
      },
      "toolChunk": "56edc5"
    },
    {
      "kind": "candidate-negative",
      "result": {
        "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v2.json",
        "bytes": 2374,
        "sha256": "4962e69ec068db7ff1e3ae2c7abdf8898f5e81a599e500d622c8d8a484e664bb"
      },
      "tests": 216,
      "pass": 215,
      "fail": 1,
      "sourceVariant": {
        "path": "build/captive-person-20261026-v73/surrender-candidate-v6.js",
        "bytes": 473955,
        "sha256": "7e7a56754439a417a72881cce98a0c8c341b247fc50a935b703956251c45fe16"
      },
      "tool": {
        "path": "build/captive-person-20261026-v73/raw-hud-candidate-negative-terminal-v2.json",
        "bytes": 423,
        "sha256": "80d76d094ee8e9daa673e4c19e95f50b6fc3223e1cc3011360ad2220bc6d7f4b"
      },
      "toolChunk": "1359f6"
    }
  ],
  "productInstall": {
    "path": "build/captive-person-20261026-v73/product-install-v2.json",
    "bytes": 4248,
    "sha256": "daae00e43c1f93ba903c9879941fd20e8cac0338fd10db537f2906fe9b52d8cc"
  },
  "productInstallPrior": {
    "path": "build/captive-person-20261026-v73/product-install-v1.json",
    "bytes": 719,
    "sha256": "a94d02fb1414b343272d62eea7264f37c9f2c0143d10d6a03b471ed7b1776ddb"
  },
  "defaultRegisteredFiles": 150,
  "currentHudTests": 216,
  "fullSelectedSources": 1651,
  "priorSourceEpoch": {
    "path": "build/captive-person-20261026-v73/source-epoch-v1.json",
    "bytes": 34506,
    "sha256": "8f0370bb8e742fb8d200e5f71a46735caac9ff5a538dcf9e99bcaeded3a969c8"
  },
  "productInstallHistory": [
    {
      "path": "build/captive-person-20261026-v73/product-install-v1.json",
      "bytes": 719,
      "sha256": "a94d02fb1414b343272d62eea7264f37c9f2c0143d10d6a03b471ed7b1776ddb"
    },
    {
      "path": "build/captive-person-20261026-v73/product-install-v2.json",
      "bytes": 4248,
      "sha256": "daae00e43c1f93ba903c9879941fd20e8cac0338fd10db537f2906fe9b52d8cc"
    }
  ],
  "installationStages": 5,
  "historicalFullDefaults": [
    {
      "result": {
        "path": "build/captive-person-20261026-v73/full-default-v1.json",
        "bytes": 1848,
        "sha256": "4c056174a8ad45f5021c371c5aaa993e733b3970f71d7e844cd7bca3bbbec72f"
      },
      "sourceEpoch": {
        "path": "build/captive-person-20261026-v73/source-epoch-v1.json",
        "bytes": 34506,
        "sha256": "8f0370bb8e742fb8d200e5f71a46735caac9ff5a538dcf9e99bcaeded3a969c8"
      },
      "accepted": false,
      "tests": 7956,
      "pass": 7955,
      "fail": 1,
      "failureNumber": 792,
      "failureName": "mobile poll restores the complete deep layer after delayed picker publication",
      "failureMessage": "surrenderUiCall is not defined",
      "tool": {
        "initial": {
          "path": "build/captive-person-20261026-v73/raw-full-default-initial-v1.json",
          "bytes": 346,
          "sha256": "6d11ef68462a5a55abba16a94829943b837be9f10cd019af47193d10f903e130"
        },
        "terminal": {
          "path": "build/captive-person-20261026-v73/raw-full-default-terminal-v1.json",
          "bytes": 408,
          "sha256": "9221d717d7256d9be89f84c1fb7e1367e83e98b5711357efdae45d200a3b942c"
        },
        "initialChunk": "83aa8f",
        "terminalChunk": "968c09",
        "sessionId": 67906
      }
    }
  ],
  "finalSourceInstall": {
    "path": "build/captive-person-20261026-v73/final-source-install-v2.json",
    "bytes": 9485,
    "sha256": "e210515d912dc807e2def8e6c4cfef56db8a1268ac7fda140c40fc3b08fa659b"
  },
  "sharedIdentityAdaptation": {
    "path": "build/captive-person-20261026-v73/identity-checks-phase-mechanical-v1.json",
    "bytes": 2038,
    "sha256": "f1433548cc8f32132c3ba35d2d5630ac70ee5adc7e02331bb9f1baad1bf778d8"
  },
  "delayedPollPreparation": {
    "path": "build/captive-person-20261026-v73/surrender-v7-preparation-v1.json",
    "bytes": 5072,
    "sha256": "82f8e10e06282a75d05afab17b6f745229e8fc4557311b55e88cf64c9b46f7a8"
  },
  "finalSourceInstallTools": {
    "failed": {
      "pin": {
        "path": "build/captive-person-20261026-v73/raw-final-source-install-v2.json",
        "bytes": 1030,
        "sha256": "02a4db1f0b9440b1265220b7c32e5a645af68ad068f935287651d1f8a347bace"
      },
      "chunk": "65d3e1",
      "exitCode": 1
    },
    "corrected": {
      "pin": {
        "path": "build/captive-person-20261026-v73/raw-final-source-install-v2-corrected.json",
        "bytes": 783,
        "sha256": "4a46341b43697bac6785ea9379ade303861b292af70fba3df5e9321f15648934"
      },
      "chunk": "ea7a6a",
      "exitCode": 0
    }
  },
  "failedFinalInstaller": {
    "path": "build/captive-person-20261026-v73/install-final-sources-v2-first-failure.mjs",
    "bytes": 6500,
    "sha256": "450440b7b6e02d516031cc06f650fa7985f2d4523f689d1b35d4ffd21ceedfb1"
  },
  "correctedFinalInstaller": {
    "path": "build/captive-person-20261026-v73/install-final-sources-v2.mjs",
    "bytes": 6566,
    "sha256": "c4369c58f3f2f4852d80d9acc7a7d38197fa98b001a8b08ab963e5e461c72eeb"
  },
  "historicalUnitControls": [
    {
      "kind": "current",
      "result": {
        "path": "build/captive-person-20261026-v73/hud-surrender-current-v1.json",
        "bytes": 1956,
        "sha256": "9e94ee20265361aaba60feb4ab2000d1c1792bd799ae83a7fbb7e3b7e762dba9"
      },
      "tests": 215,
      "pass": 215,
      "fail": 0,
      "sourceVariant": null,
      "tool": {
        "path": "build/captive-person-20261026-v73/raw-hud-current-terminal-v1.json",
        "bytes": 410,
        "sha256": "3a386cd537a5d2224f0ba4cfddcd84b66c3516a7226f5223a09ad96fa722cc88"
      },
      "toolChunk": "a4bf0e"
    },
    {
      "kind": "parent-negative",
      "result": {
        "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v1.json",
        "bytes": 2359,
        "sha256": "5b0b7febb35565996a1b809fb4162e0ae1f3a7ec3f52bb7f611f73fc3af97dce"
      },
      "tests": 215,
      "pass": 203,
      "fail": 12,
      "sourceVariant": {
        "path": "build/captive-person-20261026-v73/parent-city-menu-v72.js",
        "bytes": 455220,
        "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
      },
      "tool": {
        "path": "build/captive-person-20261026-v73/raw-hud-parent-negative-terminal-v1.json",
        "bytes": 418,
        "sha256": "1e44cc9bd54c8338a7124692e2cf679dbcbda830d4b81cc6eba63914aa174858"
      },
      "toolChunk": "2cf5a0"
    },
    {
      "kind": "candidate-negative",
      "result": {
        "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v1.json",
        "bytes": 2374,
        "sha256": "877996d4ed56918dbdb0d48ed5f13dddf6de74169395e4a2bebd509207623c4e"
      },
      "tests": 215,
      "pass": 211,
      "fail": 4,
      "sourceVariant": {
        "path": "build/captive-person-20261026-v73/surrender-candidate-v1.js",
        "bytes": 470431,
        "sha256": "d5056469404b40e5e40462619a5dd4ec9ff8a8fef555d2b8ef06660ea7d4f86c"
      },
      "tool": {
        "path": "build/captive-person-20261026-v73/raw-hud-candidate-negative-terminal-v1.json",
        "bytes": 423,
        "sha256": "0aec02a155bd940d07bbfd9fb3457e009b50d0075f1e97169b1174cc9545aa02"
      },
      "toolChunk": "cda329"
    }
  ],
  "mobileHostRegression": {
    "result": {
      "path": "build/captive-person-20261026-v73/mobile-host-final-v2.json",
      "bytes": 2459,
      "sha256": "623eb49579317953712bb25895378bfe2434fcdca7a623f7ac6e34955f56c4d2"
    },
    "tool": {
      "path": "build/captive-person-20261026-v73/raw-mobile-host-final-terminal-v2.json",
      "bytes": 354,
      "sha256": "4359740086b264f9769e18c3cec03af7faf8862804e76fcc209da347c2df92b2"
    },
    "toolChunk": "e85848",
    "runner": {
      "path": "build/captive-person-20261026-v73/run-mobile-host-final-v2.mjs",
      "bytes": 2535,
      "sha256": "6157e1bea9f6ab1f564e02365b7149ef776de973c55b3d9423d2bb2363790d98"
    }
  },
  "summary": {
    "captives": 4,
    "identityVisits": 5,
    "identityObservations": 25,
    "locationObservations": 8
  },
  "mobileRendererFixtureIntegration": {
    "path": "build/captive-person-20261026-v73/unit-fixture-v7-integration-v1.json",
    "bytes": 6130,
    "sha256": "bfd3f67ce3fd09a9dab5a1866a01f38c698901a74c3b46d4dcc52ae03e348139"
  },
  "mobileRendererFixtureQuotingRepair": {
    "path": "build/captive-person-20261026-v73/unit-fixture-v7-quoting-repair-v2.json",
    "bytes": 932,
    "sha256": "64ec4de6486832b7480773f1401fb200f8a85eea81badc8b565ad7e883641643"
  },
  "acceptedDataPeer": {
    "receipt": {
      "path": "build/captive-person-20261026-v73/accepted-after-data-peer-v2.json",
      "bytes": 58934,
      "sha256": "2279bad53e692c5d86eafdd08b1e088f50dcd6bc9502387ba46db1fb3686cc97"
    },
    "source": {
      "path": "build/captive-person-20261026-v73/audit-accepted-after-v2.py",
      "bytes": 25006,
      "sha256": "284bd9b6daffcbd811a042de8fb9c5d33d9adc7db042d40b799dc8295a7bc29d"
    },
    "rawToolFileRetained": false,
    "reportedToolChunk": "3b32f1",
    "reportedExitCode": 0,
    "pngChildInlineToolChunk": "5b1863",
    "pngChildIndependentSourceFileRetained": false
  },
  "fullDefault": {
    "result": {
      "path": "build/captive-person-20261026-v73/full-default-v2.json",
      "bytes": 1847,
      "sha256": "d0896999d0d7026e83a04211d498d5d10e341bbc0dc1fe04cbfb87f4fa613e9d"
    },
    "expectedTests": 7957,
    "newDistinctTests": 14,
    "runner": {
      "path": "build/captive-person-20261026-v73/run-full-default-v2.mjs",
      "bytes": 4229,
      "sha256": "1b02ec7717e5bdce42d2bd829d79470a39f85a8e9860313932f65b933575a0bf"
    },
    "tool": {
      "initial": {
        "path": "build/captive-person-20261026-v73/raw-full-default-initial-v2.json",
        "bytes": 346,
        "sha256": "7be711cf84ff2c68151569ff5b15fc8600eb79a4acbf60d53d92690958e44260"
      },
      "terminal": {
        "path": "build/captive-person-20261026-v73/raw-full-default-terminal-v2.json",
        "bytes": 407,
        "sha256": "ccd7a4de6ebf900be07f3c93ddf1727621121b5b1b2f38ac003534de81b007df"
      },
      "initialChunk": "0b44fc",
      "terminalChunk": "7fca8e",
      "sessionId": 93726
    }
  },
  "codec": {
    "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
    "bytes": 32262,
    "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
  },
  "markdownSource": {
    "path": "build/captive-person-20261026-v73/final-markdown-v1.md",
    "bytes": 5972,
    "sha256": "38f65466f0d75d9578e2044191ef8a1b981f7d05893bc6596ed21af795c90994"
  },
  "markdown": "# 原版招降双人物阶段与真实俘虏验证（V73）\n\n2026-10-26，本批修复招降的俘虏目标／己方招降将领两个 PERSON 阶段，以及取消和异步名单回执。当前只接受原版 P1 董卓、PC1920×1080 的下述实际范围，整体 HD 继续 partial。\n\n公开只读复核：\n\n    node docs/validation/m5-captive-person-20261026-v73-verify.mjs\n\n用户“保留旧战局，暂不重开；继续其他 HD 开发”的决定保持。旧 held 战局没有输入、重载、关闭或控制接口接入；下述均为独立新局，不串接为同一历史世界或 RNG 连续性。\n\n## 产品变化\n\n原版招降先调用俘虏 PERSON，再调用己方将领 PERSON；取消将领选择会重新打开俘虏名单。HD 现分别显示“招降 · 选择俘虏”和“招降 · 选择招降将领”，等待真实新菜单后再采用下一阶段；取消目标后须见到新的原生 MAP 回执才退壳。PC 定时观察会同步晚到的 PERSON，保留手机原有定时刷新。\n\n私有流程只能从完整当前内政子菜单的招降项进入。原 LIB、当前 data／config／城市／完整名册、人物 ID／姓名、来源函数和原生菜单代次共同绑定；名单按 C 的队列顺序区分俘虏和己方，保留合法重复记录。稳定阶段拒绝整段名册变化，重入使当前读取失效。ENTER／EXIT 在导出前预约，未知结果不能通过关闭或经典／HD 往返重发；真实新菜单或限定的新 MAP 回执才释放。没有增加公开移动输入能力，也没有据此授予实际招降订单或费用成功信用。\n\n## 实际新局\n\nP1 董卓在洛阳15正常征兵七次，每次720兵／72钱，合计5040预备兵／504钱；一次正常 END 归队后，吕布20、张辽22、李儒19分别按原生上限分配1730、1850、1560兵。一次真实15→16出征，再执行一次 END，自然完成9回合战斗并占领许昌16，日期190-1→190-2→190-3。全部原生准备、派军、结算及实际伤亡保留。\n\n实际获得袁遗77、乔瑁76、刘繇75、刘岱8四名俘虏，均在已采许昌队列，Belong=65535／OldBelong=9／Arms=0。原始开局完整已采200人物没有俘虏。四人各检查完整姓名、HD归属、原归属和原生属性0，以及 HD所在城市／实际翻页的原生属性1；己方招降者李儒19另做完整身份检查。合计5人次／25个身份观察、4人次／8个位置观察。这些是浏览器目标，不是33项新增单元测试。\n\n每名俘虏实际37→36翻页并返回第一页，共8个原生分页键。独立原ROM提供姓名、城市名和原生标题；位置由捕获后的当前完整队列首次匹配，不能用ROM初始驻城代替。位置均为许昌16。每次观察及真实wheel保留全部已采native／world、零新增原生键／LCD触摸；分页只允许person页变化，其余已采native保持。真实战后遗留的出征完成阶段7原样验证，没有归零或改写采样。\n\n随后唯一目标39进入己方名单，唯一将领40返回新的俘虏名单，再唯一目标40返回MAP。没有确认招降将领，招降订单0，整个检查期间已采世界保持。完整报告120阶段、冻结1225来源，任务自有Chrome全部退出，profile保留，私有HTTP关闭。\n\n![俘虏刘岱的当前所在城市](./m5-captive-person-20261026-v73-pc1080-target.png)\n\n![招降将领李儒的身份](./m5-captive-person-20261026-v73-pc1080-actor.png)\n\n## 回归与保留失败\n\n当前 HUD216／216、手机菜单模块504／504均通过，二者都是完整默认150文件7957／7957的专项子集，不重复加总。默认净新增14项；实际Clang18，1651份所选来源整场稳定，失败／取消／跳过／todo全0。原产品负控203通过／13失败，缺PC定时同步的V6负控215通过／1失败，均保留真实child exit1。\n\n| 独立记录 | 原始结果与边界 |\n| --- | --- |\n| preflight-before-v1 | 仅来源预检，0浏览器／0游戏；accepted=false |\n| pc1080-before-v1 | 七次征兵已付款，尚未END；退休HD壳消费了唯一Escape，验证器等待系统菜单失败；22阶段／false |\n| pc1080-before-v2 | 真实两次END、胜利和四名捕获；helper误把公开进城接口的坐标对象当作true，人物检查前失败；77阶段／false |\n| pc1080-after-v1 | V6真实进入原生俘虏名单，但PC异步发布后未刷新HD，界面等待超时；83阶段／false |\n| pc1080-after-v2 | 本批120阶段实际通过；四俘虏、身份／位置和双人物取消链只在此授予接受 |\n| full-default-v1 | 7955／7956，唯一旧mobile隔离fixture缺少新render依赖而失败；1651来源仍零漂移，不改成成功 |\n\n旧fixture现组合真实render facade、私有guard／render body及sync函数的无流早返路径，原行为断言保持，函数定位guard随组合范围增强；源文件原CRLF合同保留。V1至V6候选、readonly重入／最后actor／经典取消／真实poll-only负控、各原失败、机械字节变换与源准备错误均保留。完整原始JSON和PNG按原字节归档，不裁剪或重序列化后冒充原件；只读验证器不执行归档runtime或oracle。\n\n## 来源与范围\n\n当前161关键源、9件父源变化及1件新增helper明确区分；本场runtime与关键源交145／差16，差集只核当前字节，不宣称在本轮执行。原生128份仍聚合617c3aea…，没有改C或重建WASM；既有引擎manifest的旧版本与modified=true保持。逻辑人物200与底层人物2000／名册2000／38城分开。最终实际LIB完整HEX双读保留，可独立重算207195字节／3bd20146…；早期失败报告只保留原身份元数据，其缺失HEX不补造。\n\n本批没有实际招降提交／成功、在野人物报告、其它时期、PC720或手机俘虏新局、全部13属性、任意Mod、真机或稳定性能接受。WOOD／AID同会话闭环、完整ABI／packed SAVE／历史RNG、云服务和整体HD继续partial。\n",
  "support": [
    {
      "path": "build/captive-person-20261026-v73/accepted-after-data-peer-v2.json",
      "bytes": 58934,
      "sha256": "2279bad53e692c5d86eafdd08b1e088f50dcd6bc9502387ba46db1fb3686cc97"
    },
    {
      "path": "build/captive-person-20261026-v73/after-v1-interval-data-analysis-v1.json",
      "bytes": 5986,
      "sha256": "362f1eb486203a620da31bbebf50721a4b065f5bf3c3726a583b7674e06e9bf8"
    },
    {
      "path": "build/captive-person-20261026-v73/audit-accepted-after-v2.py",
      "bytes": 25006,
      "sha256": "284bd9b6daffcbd811a042de8fb9c5d33d9adc7db042d40b799dc8295a7bc29d"
    },
    {
      "path": "build/captive-person-20261026-v73/before-final-source-fix/js/hd-city-menu.js",
      "bytes": 473955,
      "sha256": "7e7a56754439a417a72881cce98a0c8c341b247fc50a935b703956251c45fe16"
    },
    {
      "path": "build/captive-person-20261026-v73/before-final-source-fix/scripts/hd-captive-person-runtime-checks.mjs",
      "bytes": 16036,
      "sha256": "bed52f5464a3c300f2841ce6c27295b2816a827daf2ad0be2b78951ba40f2121"
    },
    {
      "path": "build/captive-person-20261026-v73/before-final-source-fix/scripts/hd-person-identity-runtime-checks.mjs",
      "bytes": 22276,
      "sha256": "e9f302c5e497c76ca521fb195b93c4e44ad8af79b0d4f972102ac78b8d3d50d6"
    },
    {
      "path": "build/captive-person-20261026-v73/before-final-source-fix/scripts/test-hd-campaign-runtime.mjs",
      "bytes": 132579,
      "sha256": "513b138bc04105afd9463df4d8a83e6ca39e701f395e3aa63192936ffab0941c"
    },
    {
      "path": "build/captive-person-20261026-v73/build-source-epoch-v1.mjs",
      "bytes": 8695,
      "sha256": "c03447dc9f25d3b2a988c3181ccc4ce1fe43a36e63f96eacf53a677ed9fa95dc"
    },
    {
      "path": "build/captive-person-20261026-v73/build-source-epoch-v2.mjs",
      "bytes": 8784,
      "sha256": "5a432c99a8e20881be4a2ef66a2bc4feebe2a75f5c745835daccbe3d94db3b88"
    },
    {
      "path": "build/captive-person-20261026-v73/build-surrender-candidate-v1.mjs",
      "bytes": 4753,
      "sha256": "606ea314d331c11d27e4d99821b77eb65241cc7af49077ed1ed916019932c1a8"
    },
    {
      "path": "build/captive-person-20261026-v73/build-surrender-candidate-v2.mjs",
      "bytes": 7918,
      "sha256": "b088651610a7c56ed0fc090d88bb19de605827b5fe5ea6b47de735196e251ed4"
    },
    {
      "path": "build/captive-person-20261026-v73/build-surrender-candidate-v3.mjs",
      "bytes": 2951,
      "sha256": "21a562558a741a2e8ef1ca70a5d4950cb8fa4f9216bc2e5f0dc4332bf4131668"
    },
    {
      "path": "build/captive-person-20261026-v73/build-surrender-candidate-v4.mjs",
      "bytes": 2145,
      "sha256": "6a26dbaa3bd9eddd4d8ad1d43cee8b0adc7b86169e2668da430a3e7dab376744"
    },
    {
      "path": "build/captive-person-20261026-v73/build-surrender-candidate-v5.mjs",
      "bytes": 2268,
      "sha256": "991de664a476aeae0d5b82bf945fc7b819367ee59c246c53155609a744afec47"
    },
    {
      "path": "build/captive-person-20261026-v73/build-surrender-candidate-v6.mjs",
      "bytes": 2345,
      "sha256": "ecd2d7123f0e4653e1f897b914af373e1a9277b9f7888f4afb2f927a57b7fd34"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v1-negative-units-v1/before.json",
      "bytes": 1258,
      "sha256": "330daa3aba0a2ede44a4ea8a96ceb6c489cbeb14dd8ac4a7277da5a5e77a7746"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v1-negative-units-v1/receipt.json",
      "bytes": 3951,
      "sha256": "ebfc13621b13d2c3ba7f9d8b44f872d26e1220c021875111f03fb45109d7849d"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v1-negative-units-v1/stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v1-negative-units-v1/stdout.log",
      "bytes": 12580,
      "sha256": "10819a27a58c98d4028d1ab4b4354dcc460ed014fa591a0674ba38da0cabcabb"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-all-units-v1/before.json",
      "bytes": 1258,
      "sha256": "76e306454e61ad7277595bafb3fcbdc384ac8be01be62a8d383f1b93365b2879"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-all-units-v1/receipt.json",
      "bytes": 3933,
      "sha256": "f61e9f6ad46f0a74224cbec4c5658b0477e648345012d29d28320344e76485c1"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-all-units-v1/stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-all-units-v1/stdout.log",
      "bytes": 53413,
      "sha256": "e18233bd84ae83bf63e2286fbd02682017c237c56e102f898d3873b207b0ba6b"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-negative-units-v1/before.json",
      "bytes": 1258,
      "sha256": "b4a977dde3b99e09c3612c39e6215e1637c60bdd537f67d8ed409353af4d9b7b"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-negative-units-v1/receipt.json",
      "bytes": 3950,
      "sha256": "91751c4e559e45cc5714994ebd808d4ee91e6ae4a55011bd523d753cd2f77891"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-negative-units-v1/stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v4-negative-units-v1/stdout.log",
      "bytes": 7309,
      "sha256": "78eab4aab4dacc52fee22a9f8be378ba2c327f55acaa8993efdcf5a0b8238a62"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-all-units-v1/before.json",
      "bytes": 1258,
      "sha256": "bd8751d5fbf32b1c8e5a7ae32df6421266e1767779052f32e49dc22b82958371"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-all-units-v1/receipt.json",
      "bytes": 3933,
      "sha256": "aae00a96161866c1f6a2500380c147d085020dfb8e80f2429fe400989672aec7"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-all-units-v1/stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-all-units-v1/stdout.log",
      "bytes": 53412,
      "sha256": "478efb37fb538270431f5f05727064dabc131c07b251382e52f04217964d2ada"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-poll-negative-units-v1/before.json",
      "bytes": 1452,
      "sha256": "4de82764962382aa2d119f931470f8b9ccadebd4c216c0f92d82a328af698293"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-poll-negative-units-v1/receipt.json",
      "bytes": 4456,
      "sha256": "b5537c01f140bd94ff6745ae3df7864dab23a1675b6e5ef5be2c385b3ceec31a"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-poll-negative-units-v1/stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v6-poll-negative-units-v1/stdout.log",
      "bytes": 1338,
      "sha256": "0c3f0c1952307861bddfb71bffacec72d3ab4e0bb95a45d93ecb85070da21f3d"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v7-all-units-v1/before.json",
      "bytes": 1452,
      "sha256": "fcfd753026f41d9038e2c7ac60686ed46ff0a67f1bd7f067975edb7f9fc5803e"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v7-all-units-v1/receipt.json",
      "bytes": 4422,
      "sha256": "18322a4e3d2fd585b263ae0dd6e1f7198b8a1f8e1497ba6e5a233f7c449e67b5"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v7-all-units-v1/stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/candidate-v7-all-units-v1/stdout.log",
      "bytes": 53697,
      "sha256": "4f9653372432f2bbb99700684160bd3f64b9f38152558a2d2c8f9d7abca4999e"
    },
    {
      "path": "build/captive-person-20261026-v73/check-preserved-state-v1.mjs",
      "bytes": 2298,
      "sha256": "776bc60a978fd1ce0dc9d79e84bb56e7ab5f38a2f5af370b15220cc036c657da"
    },
    {
      "path": "build/captive-person-20261026-v73/closed-before-data-peer-v1.json",
      "bytes": 19362,
      "sha256": "de2e0662e90324ffd39da469713ab096b6598f25188cf66bcd66a71681bf6342"
    },
    {
      "path": "build/captive-person-20261026-v73/diagnose-after-v1.mjs",
      "bytes": 787,
      "sha256": "9bdfde037a6926911dc1f4e9dd8edea8fc25d4a43dc95ca3487777b05a1c17b8"
    },
    {
      "path": "build/captive-person-20261026-v73/documentation-v1.json",
      "bytes": 1417,
      "sha256": "7a50b8894f2fdb96e00297956f197ef4d650fe69cf597da1d75b6be356e167fe"
    },
    {
      "path": "build/captive-person-20261026-v73/evidence-source-v1/README.md",
      "bytes": 6988,
      "sha256": "fd4cf31dfd849ff6ffb1d48c5caafe94f63e0166af4347fa3c1b394b4b066657"
    },
    {
      "path": "build/captive-person-20261026-v73/evidence-source-v1/prepare-v1.mjs",
      "bytes": 6283,
      "sha256": "4a99e4efd57d023337cd0d633e549dec89c65709826ab6a0354f4cbd215d7657"
    },
    {
      "path": "build/captive-person-20261026-v73/evidence-source-v1/publish-v1.mjs",
      "bytes": 4488,
      "sha256": "0768256afa6e7a77e67ba1203d63b22d9d27f7b5dabff4f4a284ed633173d584"
    },
    {
      "path": "build/captive-person-20261026-v73/evidence-source-v1/source-freeze-v1.json",
      "bytes": 1239,
      "sha256": "7636fee5e120bac6bfa8c4ff7304b771343d4b4f24f9caf63b464f4cdf678478"
    },
    {
      "path": "build/captive-person-20261026-v73/evidence-source-v1/source-static-peer-v1.json",
      "bytes": 4474,
      "sha256": "1d2fe52f62c7bd2ba5290200839238adf681e13a0e140896cd39dcf95b6eedf5"
    },
    {
      "path": "build/captive-person-20261026-v73/evidence-source-v1/v73-common-v1.mjs",
      "bytes": 92809,
      "sha256": "4346fe9f60ef14252b6c5332f7bf97eb01934a9c129e981b16cd27b229548959"
    },
    {
      "path": "build/captive-person-20261026-v73/evidence-source-v1/v73-reader-v1.mjs",
      "bytes": 62870,
      "sha256": "3e9defecbc7db9531c4a547532d7dd6b07e658104f8fa8be2a37549393ceb03d"
    },
    {
      "path": "build/captive-person-20261026-v73/final-markdown-v1.md",
      "bytes": 5972,
      "sha256": "38f65466f0d75d9578e2044191ef8a1b981f7d05893bc6596ed21af795c90994"
    },
    {
      "path": "build/captive-person-20261026-v73/final-source-install-v2.json",
      "bytes": 9485,
      "sha256": "e210515d912dc807e2def8e6c4cfef56db8a1268ac7fda140c40fc3b08fa659b"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v1.before.json",
      "bytes": 279130,
      "sha256": "ffc1674637f5b6a893e530037b06d0f3444297dca103bb043d019e550a002179"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v1.json",
      "bytes": 1848,
      "sha256": "4c056174a8ad45f5021c371c5aaa993e733b3970f71d7e844cd7bca3bbbec72f"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v1.stdout.tap",
      "bytes": 1637657,
      "sha256": "2628284799f234f979e2e56601b2790e0eecd90b1aafe99cf1adcf05e230a98e"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v2.before.json",
      "bytes": 279130,
      "sha256": "0199b8d23ac56ddce6e4cb8e9e2aed60be63da07ae3d434c4a375922c860f4e3"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v2.json",
      "bytes": 1847,
      "sha256": "d0896999d0d7026e83a04211d498d5d10e341bbc0dc1fe04cbfb87f4fa613e9d"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v2.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/full-default-v2.stdout.tap",
      "bytes": 1636978,
      "sha256": "38b5f7733f215570346d0e05785a3dd75f07dd4a485e6ac456a320211ecb79e5"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-parent-202-tests-v1.mjs",
      "bytes": 152509,
      "sha256": "e1e722dd9418aa6009ad7eb499f92801013cafd3d6eff58480265c8434f67bdd"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v1.before.json",
      "bytes": 937,
      "sha256": "7441de468df75f8947a334e9f7e77c21347569f152d1d4f4684b26f67ffad7f3"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v1.json",
      "bytes": 2374,
      "sha256": "877996d4ed56918dbdb0d48ed5f13dddf6de74169395e4a2bebd509207623c4e"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v1.stdout.tap",
      "bytes": 64034,
      "sha256": "c9ecf7b1aceb44337c16d34beff81fd4e29d19e7d553c19f6b36375136bfdba1"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v2.before.json",
      "bytes": 937,
      "sha256": "8fe546c3e7cf4cd134a82cc8e6f412fe0952b836c660bf289721e2fa2f8efd5f"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v2.json",
      "bytes": 2374,
      "sha256": "4962e69ec068db7ff1e3ae2c7abdf8898f5e81a599e500d622c8d8a484e664bb"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v2.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-candidate-negative-v2.stdout.tap",
      "bytes": 54665,
      "sha256": "106ea65061ee08b725372c57d7273783f7abab25c563cd6e21811e942d9ad876"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v1.before.json",
      "bytes": 751,
      "sha256": "d6dab7abf8377c0f74e48a2d58800258bd40c7fe8c5cf780fa3fd908b47d4e85"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v1.json",
      "bytes": 1956,
      "sha256": "9e94ee20265361aaba60feb4ab2000d1c1792bd799ae83a7fbb7e3b7e762dba9"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v1.stdout.tap",
      "bytes": 53426,
      "sha256": "a7c6a092f4cb706c6ecefe749cba4f72bfa2d1d967015b0940318c6a6e56cafe"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v2.before.json",
      "bytes": 751,
      "sha256": "29e1438956a9d1bef6a634e1eb454dd8d79eafaaee53867909349eafefbb1479"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v2.json",
      "bytes": 1954,
      "sha256": "d3d3d03dc38692a0338e659936c80375744d0a515ef74520ce44b57cee568602"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v2.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-current-v2.stdout.tap",
      "bytes": 53705,
      "sha256": "0b815f846b3a304c0d0bfaf58dd550d7a7d488131412a0e2fcab2468c33f910d"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v1.before.json",
      "bytes": 935,
      "sha256": "e9245689e451779c7205aa30535f9a6bedcea0d14022b2d97c7909db4b43186f"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v1.json",
      "bytes": 2359,
      "sha256": "5b0b7febb35565996a1b809fb4162e0ae1f3a7ec3f52bb7f611f73fc3af97dce"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v1.stdout.tap",
      "bytes": 66476,
      "sha256": "952dc0a373bee38d877b7d2e7ffb7b3f68cd13813178beb25eba9124ecb5824d"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v2.before.json",
      "bytes": 935,
      "sha256": "c5a83141ab5cbaa4942af9fbf3cad44a0014529c218ad47bc7779bf28f68e2e0"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v2.json",
      "bytes": 2359,
      "sha256": "1ffbd2fc8caffd981c313ac9082b746a353dc3bcfc3e13e973fd33328ca5438e"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v2.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/hud-surrender-parent-negative-v2.stdout.tap",
      "bytes": 67698,
      "sha256": "e8916672abff99e5891787c353c9ca82a75b2c7c2edebe26f50b48e9e0d2a39c"
    },
    {
      "path": "build/captive-person-20261026-v73/identity-checks-phase-before-v1.mjs",
      "bytes": 22276,
      "sha256": "e9f302c5e497c76ca521fb195b93c4e44ad8af79b0d4f972102ac78b8d3d50d6"
    },
    {
      "path": "build/captive-person-20261026-v73/identity-checks-phase-candidate-v1.mjs",
      "bytes": 22506,
      "sha256": "6caf7bbab9657b3a1de2141b881b724e789f080c246b7226459694a9c6638361"
    },
    {
      "path": "build/captive-person-20261026-v73/identity-checks-phase-mechanical-v1.json",
      "bytes": 2038,
      "sha256": "f1433548cc8f32132c3ba35d2d5630ac70ee5adc7e02331bb9f1baad1bf778d8"
    },
    {
      "path": "build/captive-person-20261026-v73/inspect-closed-cases-v1.mjs",
      "bytes": 1432,
      "sha256": "01ea0b8c79d90aa18f24bcb259ac56bada5f29299a779022544fda14f27978d4"
    },
    {
      "path": "build/captive-person-20261026-v73/install-final-sources-v2-first-failure.mjs",
      "bytes": 6500,
      "sha256": "450440b7b6e02d516031cc06f650fa7985f2d4523f689d1b35d4ffd21ceedfb1"
    },
    {
      "path": "build/captive-person-20261026-v73/install-final-sources-v2.mjs",
      "bytes": 6566,
      "sha256": "c4369c58f3f2f4852d80d9acc7a7d38197fa98b001a8b08ab963e5e461c72eeb"
    },
    {
      "path": "build/captive-person-20261026-v73/install-surrender-v4-v1.mjs",
      "bytes": 1572,
      "sha256": "ad8f97fdd9c69a32eb17c4c7e09cdb6d6efd80e0bd8f1f21e4a986b1ad3e43ad"
    },
    {
      "path": "build/captive-person-20261026-v73/install-surrender-v6-v1.mjs",
      "bytes": 2707,
      "sha256": "82887e075ec979ab2db101c289f39be0736de5c7141058774e9a114c857a8444"
    },
    {
      "path": "build/captive-person-20261026-v73/integrate-surrender-test-v7-v1.mjs",
      "bytes": 4840,
      "sha256": "206925f3e2cddfcc059aabe71eb8b251dbb399fd72592832497ff719fb9dcb29"
    },
    {
      "path": "build/captive-person-20261026-v73/mobile-host-final-v2.before.json",
      "bytes": 1285,
      "sha256": "c0f8ba2ecf5947d63bf24e698ba3f9e137c6b7d399c5d70b2bccfcff0a09ba55"
    },
    {
      "path": "build/captive-person-20261026-v73/mobile-host-final-v2.json",
      "bytes": 2459,
      "sha256": "623eb49579317953712bb25895378bfe2434fcdca7a623f7ac6e34955f56c4d2"
    },
    {
      "path": "build/captive-person-20261026-v73/mobile-host-final-v2.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/captive-person-20261026-v73/mobile-host-final-v2.stdout.tap",
      "bytes": 108442,
      "sha256": "994ce245555bd0b509ad5f2bedf8e7a6373a00add653b29a80075cf90724e18a"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-campaign-runtime-v72.mjs",
      "bytes": 104470,
      "sha256": "a2d15a3b3291ea770ce7c99ea842f751d5061a8dc5e86b67e88ab42aa89bee8e"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-campaign-source-v1.json",
      "bytes": 923,
      "sha256": "26f662dbdb3820591d0f95c998bcfd858ddda22d1ad51b05c8dfbe34d0614e6b"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-city-menu-v72.js",
      "bytes": 455220,
      "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/.gitattributes",
      "bytes": 43293,
      "sha256": "b22563777c8781b9257023af546fd2ed6a198cd17f417ce65385a9ae81d411fe"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/js/hd-city-menu.js",
      "bytes": 455220,
      "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/m.html",
      "bytes": 18477,
      "sha256": "ac4964d732dd889a4d3dffeb5d9586e42923b6cbc566f85f5021a42b31556b82"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/package.json",
      "bytes": 21582,
      "sha256": "997f8df0878ae04f04d5d51b076295f31da1a81fb1b28eb4f67beebc1cf5cc74"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/pc.html",
      "bytes": 28678,
      "sha256": "034cc852530a7d6647acc5ee1f4a662e27ec9bd725c7f3b64808f5a7df9ff0e8"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/scripts/hd-person-identity-runtime-checks.mjs",
      "bytes": 22276,
      "sha256": "e9f302c5e497c76ca521fb195b93c4e44ad8af79b0d4f972102ac78b8d3d50d6"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/scripts/test-hd-campaign-runtime.mjs",
      "bytes": 104470,
      "sha256": "a2d15a3b3291ea770ce7c99ea842f751d5061a8dc5e86b67e88ab42aa89bee8e"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/scripts/test-hd-city-hud.mjs",
      "bytes": 152509,
      "sha256": "e1e722dd9418aa6009ad7eb499f92801013cafd3d6eff58480265c8434f67bdd"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources-v2/scripts/test-hd-city-mobile-host.mjs",
      "bytes": 194102,
      "sha256": "60ee1b3a5322b13a2d8ca8543bd2986f28ebdea2477f0617bd7923ef9fc6a224"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources/.gitattributes",
      "bytes": 43293,
      "sha256": "b22563777c8781b9257023af546fd2ed6a198cd17f417ce65385a9ae81d411fe"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources/js/hd-city-menu.js",
      "bytes": 455220,
      "sha256": "24e6b0d1c976abaad6c2a7f67f66ea733424ee8e80cc22d200de2d1ebdc9d5a2"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources/m.html",
      "bytes": 18477,
      "sha256": "ac4964d732dd889a4d3dffeb5d9586e42923b6cbc566f85f5021a42b31556b82"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources/package.json",
      "bytes": 21582,
      "sha256": "997f8df0878ae04f04d5d51b076295f31da1a81fb1b28eb4f67beebc1cf5cc74"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources/pc.html",
      "bytes": 28678,
      "sha256": "034cc852530a7d6647acc5ee1f4a662e27ec9bd725c7f3b64808f5a7df9ff0e8"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources/scripts/test-hd-campaign-runtime.mjs",
      "bytes": 104470,
      "sha256": "a2d15a3b3291ea770ce7c99ea842f751d5061a8dc5e86b67e88ab42aa89bee8e"
    },
    {
      "path": "build/captive-person-20261026-v73/parent-sources/scripts/test-hd-city-hud.mjs",
      "bytes": 152509,
      "sha256": "e1e722dd9418aa6009ad7eb499f92801013cafd3d6eff58480265c8434f67bdd"
    },
    {
      "path": "build/captive-person-20261026-v73/prepare-final-check-runners-v2.mjs",
      "bytes": 846,
      "sha256": "3683a24424df6507a041b7a1812d85f7c658a232d816bb931e66e593e2ed8db2"
    },
    {
      "path": "build/captive-person-20261026-v73/prepare-surrender-controlled-source-v1.mjs",
      "bytes": 3845,
      "sha256": "ee68eea4795d76c1f03b467607f5157b4035ff43574fd36087bdc5aace1048ec"
    },
    {
      "path": "build/captive-person-20261026-v73/prepare-surrender-v7-v1.mjs",
      "bytes": 5592,
      "sha256": "b1a2dcf7bf2bfbe8cce9e73abd48d596e0d2bd130f705529cd30c7f05e27ce3b"
    },
    {
      "path": "build/captive-person-20261026-v73/preserved-state-after-v1.json",
      "bytes": 681,
      "sha256": "8e72c27c3e625c6dda8702d7a48918e742a3d7135771c19b75414e7fdee155ca"
    },
    {
      "path": "build/captive-person-20261026-v73/preserved-state-before-v1.json",
      "bytes": 681,
      "sha256": "1c37e2598d8402194818274c4ea2a7e3e93512059ba00a2253711b4c1fdc1132"
    },
    {
      "path": "build/captive-person-20261026-v73/product-install-v1.json",
      "bytes": 719,
      "sha256": "a94d02fb1414b343272d62eea7264f37c9f2c0143d10d6a03b471ed7b1776ddb"
    },
    {
      "path": "build/captive-person-20261026-v73/product-install-v2.json",
      "bytes": 4248,
      "sha256": "daae00e43c1f93ba903c9879941fd20e8cac0338fd10db537f2906fe9b52d8cc"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-closed-cases-inspection-v1.json",
      "bytes": 2992,
      "sha256": "60f8c4d28558d029ca8810bf57536573b5c8fb3d8e40d08b45a102fde1bfd8a9"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-documentation-terminal-v1.json",
      "bytes": 617,
      "sha256": "d69cbf6b09f2e2a676627e11e0a2ba8979c5b0b012dde14376bd7f52be299a13"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-final-cases-inspection-v2.json",
      "bytes": 4722,
      "sha256": "396b69b54f6ac99e2728993d328b87f00784c6c19f9600c6d20462b301ea3ab0"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-final-source-install-v2-corrected.json",
      "bytes": 783,
      "sha256": "4a46341b43697bac6785ea9379ade303861b292af70fba3df5e9321f15648934"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-final-source-install-v2.json",
      "bytes": 1030,
      "sha256": "02a4db1f0b9440b1265220b7c32e5a645af68ad068f935287651d1f8a347bace"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-initial-v1.json",
      "bytes": 346,
      "sha256": "6d11ef68462a5a55abba16a94829943b837be9f10cd019af47193d10f903e130"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-initial-v2.json",
      "bytes": 346,
      "sha256": "7be711cf84ff2c68151569ff5b15fc8600eb79a4acbf60d53d92690958e44260"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-progress-1-v1.json",
      "bytes": 129,
      "sha256": "65cab6df71b5886918511a7015cb5219337fa1a4928657f5a28cb69480b8695d"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-progress-1-v2.json",
      "bytes": 129,
      "sha256": "54337037b49af5d34d8ee71d60528ec4a5159b2f5ccfec9124726455265f153b"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-progress-2-v1.json",
      "bytes": 129,
      "sha256": "edcd017f1fa854b2f8076d8ab74a80c42b5984d3fc4ac249e838dacf5b786e5d"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-progress-3-v1.json",
      "bytes": 129,
      "sha256": "dd5305e9ba26f4c936dc6dd1d042c02624ab914521205feb5aadfa04a91b630c"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-progress-4-v1.json",
      "bytes": 128,
      "sha256": "0660e4288a6bef83e7d006cb89c4a42ae3293f1caf9ddacc7ed4d0a481156528"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-progress-5-v1.json",
      "bytes": 129,
      "sha256": "8c8005631702dc585bc668d973c58c20025e67e07563f4774d9bfe8a80087ed1"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-progress-6-v1.json",
      "bytes": 129,
      "sha256": "991cdce57c040ee55f7f59ec67b2a45d9586f6b5b3188bf0b8341b2f7297f5d2"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-terminal-v1.json",
      "bytes": 408,
      "sha256": "9221d717d7256d9be89f84c1fb7e1367e83e98b5711357efdae45d200a3b942c"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-full-default-terminal-v2.json",
      "bytes": 407,
      "sha256": "ccd7a4de6ebf900be07f3c93ddf1727621121b5b1b2f38ac003534de81b007df"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-hud-candidate-negative-terminal-v1.json",
      "bytes": 423,
      "sha256": "0aec02a155bd940d07bbfd9fb3457e009b50d0075f1e97169b1174cc9545aa02"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-hud-candidate-negative-terminal-v2.json",
      "bytes": 423,
      "sha256": "80d76d094ee8e9daa673e4c19e95f50b6fc3223e1cc3011360ad2220bc6d7f4b"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-hud-current-terminal-v1.json",
      "bytes": 410,
      "sha256": "3a386cd537a5d2224f0ba4cfddcd84b66c3516a7226f5223a09ad96fa722cc88"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-hud-current-terminal-v2.json",
      "bytes": 399,
      "sha256": "900007f0dafacdebeb5250f58b3d0aaff2eea28f000e92c21ead99069983ca37"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-hud-parent-negative-terminal-v1.json",
      "bytes": 418,
      "sha256": "1e44cc9bd54c8338a7124692e2cf679dbcbda830d4b81cc6eba63914aa174858"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-hud-parent-negative-terminal-v2.json",
      "bytes": 418,
      "sha256": "c72c8020806d09ed7e035e56fb566f7c51dd37ad2d26eaa1768c97c06b1925f8"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-mobile-host-final-terminal-v2.json",
      "bytes": 354,
      "sha256": "4359740086b264f9769e18c3cec03af7faf8862804e76fcc209da347c2df92b2"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-parent-campaign-source-v1.json",
      "bytes": 995,
      "sha256": "2cd94bfbe37fad96db25e987fea0b9c6b92bca44746a7b4747489895c345d139"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-after-initial-v1.json",
      "bytes": 718,
      "sha256": "1c4cb35565b9f7d1e54167b89fb17065d7d3f55dea35cad160e63c969dfa92cb"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-after-initial-v2.json",
      "bytes": 717,
      "sha256": "f0c7e15200a500495aa5c59b23436a75da0509817509297089c6939e02dae064"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-after-progress-1-v1.json",
      "bytes": 2167,
      "sha256": "6a4de6df0771428c02ee6bba5a97ff9a645eb36831ae3f86b6d583bdb1ad2db8"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-after-progress-1-v2.json",
      "bytes": 1710,
      "sha256": "39767d8e0154c0cedb91f11f79c2c6fecd5b742c806527e2669f353069327362"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-after-progress-2-v2.json",
      "bytes": 579,
      "sha256": "f1870910f8b96ef204407bf58132af872daeec09350f47c794252603439f9ae0"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-after-terminal-v1.json",
      "bytes": 1332,
      "sha256": "9fa7ad8529e28c94a36427a0599fe43a55487fcf85db38dc5c575c5568e37153"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-after-terminal-v2.json",
      "bytes": 396,
      "sha256": "2453e3c0167881e0270fa45cf3f56dd8a304d6c460f7c1f844da10230a18f95a"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-before-initial-v1.json",
      "bytes": 796,
      "sha256": "89ddac4856c6cc3d4a1407345c30690912fa47cdd818b5e9d8751d1e27f612c4"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-before-initial-v2.json",
      "bytes": 794,
      "sha256": "b0e71c2681cc82beb64bb7840ee7a8a451d9cd429750bcb5313bda62bc3c054d"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-before-progress-v2-1.json",
      "bytes": 1412,
      "sha256": "286a1a5d9a5f6512f1be0926000779a4f379443c9204cd6914584d1bd80f05b8"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-before-progress-v2-2.json",
      "bytes": 355,
      "sha256": "20e35353db9309c30c964ceb48895dceb4bebdd0cc14c06844ecd50580cd54ea"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-before-terminal-v1.json",
      "bytes": 1730,
      "sha256": "99ea5284ffb2676b50d426045b46a53f745343268b709206da406657acd62b66"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-pc1080-before-terminal-v2.json",
      "bytes": 1638,
      "sha256": "d517cb197786ddded567455aa27adf0807131470527d94ffb73f743c0dac3727"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-preflight-before-v1.json",
      "bytes": 503,
      "sha256": "86854a6a090eae7cdb9a264eadf6a8662de288f42f592229b030fb5e4c909f94"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-preserved-state-after-terminal-v1.json",
      "bytes": 345,
      "sha256": "0a46dfede9327324a0888eae9fa45ff6034a302afe49a65230b4ffd8117313e7"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-preserved-state-before-v1.json",
      "bytes": 346,
      "sha256": "e3d4f4eea238685bb4ee563a777fae0b863344eb451b7373dbe2af69f9f06d1d"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-product-install-v1.json",
      "bytes": 794,
      "sha256": "dc73093b848918320e45a7af0430a62980639fa7c1856d10f13e0557de21f7cc"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-product-install-v2.json",
      "bytes": 333,
      "sha256": "3d02b82d97bedf2edff5886f1237aa88b911448f27cea91dc70cfd09aa522db7"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-source-epoch-terminal-v1.json",
      "bytes": 816,
      "sha256": "cd59fb214b7bebb0b68e097502766c235360c6650b06a3ec19ea7f1e17f5eb8b"
    },
    {
      "path": "build/captive-person-20261026-v73/raw-source-epoch-terminal-v2.json",
      "bytes": 916,
      "sha256": "b798f97a60be2a2c7b3bb5fcf9eae89373b3d25e2e7baf0847d24950cc6d1d10"
    },
    {
      "path": "build/captive-person-20261026-v73/repair-mobile-renderer-fixture-v2.mjs",
      "bytes": 1462,
      "sha256": "59a2e6d25140e933128fd277a9537fc3ddbbf93f12e8f8117e572a4f04ce9292"
    },
    {
      "path": "build/captive-person-20261026-v73/run-full-default-v1.mjs",
      "bytes": 4088,
      "sha256": "d48323e34c8cb0aab74f4798fbb4b01946a02d7fd09be84be74cef120641bbf3"
    },
    {
      "path": "build/captive-person-20261026-v73/run-full-default-v2.mjs",
      "bytes": 4229,
      "sha256": "1b02ec7717e5bdce42d2bd829d79470a39f85a8e9860313932f65b933575a0bf"
    },
    {
      "path": "build/captive-person-20261026-v73/run-hud-control-v1.mjs",
      "bytes": 2899,
      "sha256": "203b4405170aeecf89aeb11025304a4ee2542f77e45b155d7cd44f9900512cbe"
    },
    {
      "path": "build/captive-person-20261026-v73/run-hud-control-v2.mjs",
      "bytes": 2899,
      "sha256": "f9b6cb24347dde437ec92adf91fab8a23ee90a6b50ff805239890999b306ec30"
    },
    {
      "path": "build/captive-person-20261026-v73/run-mobile-host-final-v2.mjs",
      "bytes": 2535,
      "sha256": "6157e1bea9f6ab1f564e02365b7149ef776de973c55b3d9423d2bb2363790d98"
    },
    {
      "path": "build/captive-person-20261026-v73/run-publication-step-v1.mjs",
      "bytes": 1409,
      "sha256": "48ff0841a55ed1b55b12cd5a386d5cc8332932d78b02bc3e01474dc467e5f2bf"
    },
    {
      "path": "build/captive-person-20261026-v73/run-surrender-hud-unit-v1.mjs",
      "bytes": 3388,
      "sha256": "dde00c8ab94694fbd9bbf8aa2d26082203d33b67473ca13e9c8e49b1b93fab7e"
    },
    {
      "path": "build/captive-person-20261026-v73/run-surrender-hud-unit-v2.mjs",
      "bytes": 3388,
      "sha256": "828c81a9f021fbd662ba727156f2af83e069487e3df8d9b3b0b9710f63cfbf73"
    },
    {
      "path": "build/captive-person-20261026-v73/run-surrender-hud-unit-v3.mjs",
      "bytes": 3423,
      "sha256": "04b3f2066a73aa93dc988b5abafd23db4a48021bf1e32444e705036a09f94f0d"
    },
    {
      "path": "build/captive-person-20261026-v73/save-parent-runner-v1.mjs",
      "bytes": 1522,
      "sha256": "b5bf4ee807aa1cf32f45b51ebcf3abc29bebd16173a7cccc7cc42f0eadb5b765"
    },
    {
      "path": "build/captive-person-20261026-v73/source-epoch-v1.json",
      "bytes": 34506,
      "sha256": "8f0370bb8e742fb8d200e5f71a46735caac9ff5a538dcf9e99bcaeded3a969c8"
    },
    {
      "path": "build/captive-person-20261026-v73/source-epoch-v2.json",
      "bytes": 36362,
      "sha256": "68620737409722c247bdcd295734de8dd85e7279c4127e5ba13b772b8456ce0b"
    },
    {
      "path": "build/captive-person-20261026-v73/source-preliminary-peer-v1.json",
      "bytes": 5643,
      "sha256": "d7b7a089e4e6547ded74f1fe9e0c6352725cb1d2348acfaf8650f980ec65a4a8"
    },
    {
      "path": "build/captive-person-20261026-v73/stage-delivery-v1.mjs",
      "bytes": 3567,
      "sha256": "ac16049663737f88c1c90462c78e493cd2699069193ff24f6205d4fb9ed3f8ad"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v1.js",
      "bytes": 470431,
      "sha256": "d5056469404b40e5e40462619a5dd4ec9ff8a8fef555d2b8ef06660ea7d4f86c"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v2-mechanical.json",
      "bytes": 8031,
      "sha256": "a2f1335343c216139e7deee1e977810a3a787446b1da43800fbbf7434d39f79d"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v2.js",
      "bytes": 472412,
      "sha256": "32c68658d9f899dd987060a53c07fa81e65060bb9e4e2a0e8e4fa085bcd0b8f4"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v3-mechanical.json",
      "bytes": 3158,
      "sha256": "984701bfd2619754edf70c8945c047340df22bebfd13d7e565a84c9a0045e421"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v3.js",
      "bytes": 473498,
      "sha256": "8add541725822085ca6a9c1ce3b6279ffe2cd98c2b9fed033282ef16a369334d"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v4-mechanical.json",
      "bytes": 17110,
      "sha256": "d362a3c5749cbefdc1a29a8f952219dba448917bbe1d78091a017e7c07fb31b4"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v4.js",
      "bytes": 473607,
      "sha256": "c7784af9bcafa08c9e2c22a35e90da336b0d2660034a8a6c772ad831432e93b2"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v5-mechanical.json",
      "bytes": 1738,
      "sha256": "b9f2b55edd0f5bfebde3103eb366f84ed78cfc46383a4ccd444e0684654a97fb"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v5.js",
      "bytes": 473906,
      "sha256": "2aab4ec1178a05dc23811ff08f1836a7151f90eeac4790a0c273b202b5e61507"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v6-mechanical.json",
      "bytes": 1973,
      "sha256": "48011b950ef02a89026f9db08facc72d94234da447f5d706f017cd44c378e254"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v6.js",
      "bytes": 473955,
      "sha256": "7e7a56754439a417a72881cce98a0c8c341b247fc50a935b703956251c45fe16"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-candidate-v7.js",
      "bytes": 474100,
      "sha256": "8c98904e34836758876bad5dc37b58492e78004b073c4ce8b965eb6c455df84b"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-controlled-source-preparation-v1.json",
      "bytes": 3858,
      "sha256": "a293f116a94ec5bbb67c0c652294be3bee6a947c070cfc45e1dd09ae19fc9201"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-flow-v1.inc",
      "bytes": 12942,
      "sha256": "57ac0f40242ffaee938cf3537739ea46e429a26544f6303277fdc8b4a6250c70"
    },
    {
      "path": "build/captive-person-20261026-v73/surrender-v7-preparation-v1.json",
      "bytes": 5072,
      "sha256": "82f8e10e06282a75d05afab17b6f745229e8fc4557311b55e88cf64c9b46f7a8"
    },
    {
      "path": "build/captive-person-20261026-v73/test-hd-city-hud-surrender-v7.mjs",
      "bytes": 183601,
      "sha256": "abbd9f0f0344341d571272a32d603438a3535a87d9a8ba929e0bc4681c62d149"
    },
    {
      "path": "build/captive-person-20261026-v73/unit-fixture-v7-before/test-hd-city-hud.mjs",
      "bytes": 180974,
      "sha256": "d1575efb747ec6cabc67945c91f513cba8b12289c195660b7b1fcb7c29962599"
    },
    {
      "path": "build/captive-person-20261026-v73/unit-fixture-v7-before/test-hd-city-mobile-host-invalid-v1.mjs",
      "bytes": 195248,
      "sha256": "8ced4d2a42995a058d520b97c303d8e70bdcc49b659ca5a9250e8e20421a338e"
    },
    {
      "path": "build/captive-person-20261026-v73/unit-fixture-v7-before/test-hd-city-mobile-host.mjs",
      "bytes": 194102,
      "sha256": "60ee1b3a5322b13a2d8ca8543bd2986f28ebdea2477f0617bd7923ef9fc6a224"
    },
    {
      "path": "build/captive-person-20261026-v73/unit-fixture-v7-integration-v1.json",
      "bytes": 6130,
      "sha256": "bfd3f67ce3fd09a9dab5a1866a01f38c698901a74c3b46d4dcc52ae03e348139"
    },
    {
      "path": "build/captive-person-20261026-v73/unit-fixture-v7-quoting-repair-v2.json",
      "bytes": 932,
      "sha256": "64ec4de6486832b7480773f1401fb200f8a85eea81badc8b565ad7e883641643"
    },
    {
      "path": "build/captive-person-20261026-v73/unit-fixture-v7-target-v1.json",
      "bytes": 2465,
      "sha256": "d4c902807154feafb4fc645f4d5075643eac44af6786d375fbcadd22f56c3b4e"
    },
    {
      "path": "build/captive-person-20261026-v73/verify-git-delivery-v1.mjs",
      "bytes": 4443,
      "sha256": "a4d85d4a6645a01a70a1b149300e3db45217abc5558f2a2f8b38fe752fae7ecc"
    },
    {
      "path": "build/captive-person-20261026-v73/verify-portable-controls-v1.mjs",
      "bytes": 4382,
      "sha256": "55b689427caf35008d52359d19123de63a88ac4fc9bc522bb9a9442f9e2e91c6"
    },
    {
      "path": "build/captive-person-20261026-v73/write-final-docs-v1.mjs",
      "bytes": 11569,
      "sha256": "71a598091ffe2e434c4b8053c970f9a5b9b3cb7cd3b0756d0065edcef5a3f405"
    },
    {
      "path": "build/person-location-20261026-v72/full-default-v1.before.json",
      "bytes": 278960,
      "sha256": "140ef538fb2c8ca41134a90fa234afaf6fa27891749cbabf4f2488f83cc88345"
    },
    {
      "path": "build/person-location-20261026-v72/source-epoch-v1.json",
      "bytes": 31459,
      "sha256": "5e2b0e7f58b389ce04d0844603942b3238bf268afd768d63241f21b3cbed58fb"
    },
    {
      "path": "css/hd-mobile.css",
      "bytes": 32211,
      "sha256": "e8677806b2efea7d1f8037d61960adc5543e185f08fda0af7e5884616d202b5b"
    },
    {
      "path": "docs/hd-development-plan.md",
      "bytes": 239327,
      "sha256": "804ec1f34047eda7a285a233f4e981be66e06fdd3b167e4b8b4429027164b46a"
    },
    {
      "path": "docs/hd-remaining-work.md",
      "bytes": 270354,
      "sha256": "e1d5c7dde5599d64d7c3350f82040fd0e160b4929418b0124ee07f7256ff1055"
    },
    {
      "path": "docs/validation/m5-person-location-20261026-v72.json",
      "bytes": 121282,
      "sha256": "36e81b97fb1f78068664e8079426c21d8b97f692bad3ce9b844492bcdf79a9c3"
    },
    {
      "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
      "bytes": 32262,
      "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
    },
    {
      "path": "js/hd-dialog.js",
      "bytes": 136991,
      "sha256": "1d96216d2bf71ee31e4c992c7b99995cc33e47587193fc4a7d883c3e820934b7"
    },
    {
      "path": "js/hd-mobile-city.js",
      "bytes": 35411,
      "sha256": "71d6997840e7c1f5b2b6f09753db868b1acd8c082763c7d32d5c1ecb229cfeb0"
    },
    {
      "path": "js/lcd.js",
      "bytes": 36222,
      "sha256": "0807bbc85b084e6dc5eb739b64e9e1885526797eca7357b69ba8d70802bdb3e8"
    }
  ]
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
export const publicModule = name => name==='v73-reader-v1.mjs'?PREFIX+'-verify.mjs':PREFIX+'-'+name;
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
  eq(b.images.map(p=>p.id),['pc1080-target','pc1080-actor'],'Two original representative views from one actually accepted PC layout');
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
