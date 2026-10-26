import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const B='build/person-roles-20261026-v71/';
export const D=B+'evidence-source-v1/';
export const PREFIX='docs/validation/m5-person-roles-20261026-v71';
export const MODULES=['v71-common-v1.mjs','v71-reader-v1.mjs'];
export const SOURCES=[...MODULES,'prepare-v1.mjs','publish-v1.mjs','README.md'];
export const BOUNDS=Object.freeze({maxPartBytes:8388608,maxSerializedBytes:67108864,
 maxNamedRawBytes:134217728,maxUniqueRawBytes:100663296,maxFileBytes:33554432,
 maxFiles:512,maxBlobs:512,maxParts:32});
// Actual closed runtime, full-suite and metadata-transition pins, ready for independent SOURCE review.
export const EPOCH={"path":"build/person-roles-20261026-v71/source-epoch-v2.json","bytes":30313,"sha256":"36ad6969dbf2e0dfa77b88dcebdd9a6eb95539fe892cbd584b2dcaf6a1607a80"};
// All eight actual closed runtime reports; only four accepted layouts receive identity credit.
export const CLOSED_CASES=[
  {
    "id": "pc720BeforeV1",
    "kind": "product-before",
    "directory": "build/person-roles-20261026-v71/pc720-before-v1/",
    "layout": "pc720",
    "accepted": false,
    "credited": false,
    "result": {
      "path": "build/person-roles-20261026-v71/pc720-before-v1/result.json",
      "bytes": 2053931,
      "sha256": "5a720d5570dcda3cf676ca510d28593b1226eddb963b5c66c444a78f1f0cbae2"
    },
    "phaseCount": 1,
    "partialIdentityCount": 0,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": true,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42519,
        "sha256": "6223a18a2885c97feee4e558adba99cab337c3d6690b46e89115465cf48af25a"
      },
      {
        "name": "js/hd-city-menu.js",
        "source": "build/person-roles-20261026-v71/before/hd-city-menu.js",
        "bytes": 436244,
        "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
      },
      {
        "name": "m.html",
        "source": "m.html",
        "bytes": 18478,
        "sha256": "e8b80108989eee1ed07083b2828caf2534c68d4cbeb105fe390b2b6be6c884b6"
      },
      {
        "name": "package.json",
        "source": "package.json",
        "bytes": 21371,
        "sha256": "1c35bd7aae8a3cbad01a470fefd1c040622e747373bee6036239af6408c9d4fc"
      },
      {
        "name": "pc.html",
        "source": "pc.html",
        "bytes": 28679,
        "sha256": "52067903716f3d7287f136052f622a09fa75e3d34f67212c4ab20e64d25b6c8d"
      },
      {
        "name": "scripts/hd-person-roles-runtime-checks.mjs",
        "source": "scripts/hd-person-roles-runtime-checks.mjs",
        "bytes": 12113,
        "sha256": "9929324c2f74d0bc0698e03ca25261daa21a73ffedaae3ef2e6d49c508358081"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-pc720-before-initial-tool-v1.json",
        "bytes": 1197,
        "sha256": "3e91b941fa381ba5c7f6f54de1e0646e5733b846e89799b256a8a517e7f5bd3c"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-pc720-before-terminal-tool-v1.json",
        "bytes": 391,
        "sha256": "b18494af8fefff70a3311bc24695b2b2a2eccfc4507ef0bcbded1a6c2999c678"
      },
      "initialChunk": "99887d",
      "terminalChunk": "440d15",
      "sessionId": 6943
    },
    "error": "AssertionError [ERR_ASSERTION]: Actual PC/mobile original diplomacy has an adopted HD role presentation\n    at picker (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:28:10)\n    at async runForeignPersonRoles (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:42:14)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:211:18)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:239:907)"
  },
  {
    "id": "pc720FailedV1",
    "kind": "controller-failure",
    "directory": "build/person-roles-20261026-v71/pc720-after-v1/",
    "layout": "pc720",
    "accepted": false,
    "credited": false,
    "result": {
      "path": "build/person-roles-20261026-v71/pc720-after-v1/result.json",
      "bytes": 2053461,
      "sha256": "1b66c7503fea5e122f3829655dd43fd5a7f22fb842af18fa305874bb757cc432"
    },
    "phaseCount": 1,
    "partialIdentityCount": 0,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": true,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42866,
        "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
      },
      {
        "name": "scripts/hd-person-roles-runtime-checks.mjs",
        "source": "scripts/hd-person-roles-runtime-checks.mjs",
        "bytes": 12113,
        "sha256": "9929324c2f74d0bc0698e03ca25261daa21a73ffedaae3ef2e6d49c508358081"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-pc720-after-initial-v1.json",
        "bytes": 1199,
        "sha256": "3234501ac6e34a52c4343194d1c859b44c021df41c8020afd4f182d7fbfc8f70"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-pc720-after-terminal-v1.json",
        "bytes": 390,
        "sha256": "cd315740f1b429d022d257a35621e73691462be5531f9fad5a8aa35470fcc805"
      },
      "initialChunk": "1479f2",
      "terminalChunk": "6fed60",
      "sessionId": 97818
    },
    "error": "AssertionError [ERR_ASSERTION]: Actual PC/mobile original diplomacy has an adopted HD role presentation\n    at picker (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:28:10)\n    at async runForeignPersonRoles (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:42:14)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:211:18)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:239:907)"
  },
  {
    "id": "pc720FailedV2",
    "kind": "controller-failure",
    "directory": "build/person-roles-20261026-v71/pc720-after-v2/",
    "layout": "pc720",
    "accepted": false,
    "credited": false,
    "result": {
      "path": "build/person-roles-20261026-v71/pc720-after-v2/result.json",
      "bytes": 12513530,
      "sha256": "ae86ba7813fc0fa06dc06f0550acc7c617ba1781eff69a48b08ce75b1febfc19"
    },
    "phaseCount": 7,
    "partialIdentityCount": 1,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": true,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42866,
        "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
      },
      {
        "name": "scripts/hd-person-roles-runtime-checks.mjs",
        "source": "scripts/hd-person-roles-runtime-checks.mjs",
        "bytes": 12683,
        "sha256": "4e1074b759feee5eda737aa0ac162fff863bc5e50724cab4fc0e7b80f98fa2c5"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-pc720-after-initial-v2.json",
        "bytes": 500,
        "sha256": "35d33decb0828e8b4d6b437e378f7c70a0870fe219e3e537bf6a525116187a1b"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-pc720-after-terminal-v2.json",
        "bytes": 1080,
        "sha256": "7c044811afe7cfbf1f234a14e4ee4e0c8936735dde4da86a588fc566802e9cc5"
      },
      "initialChunk": "97ee1b",
      "terminalChunk": "b5798c",
      "sessionId": 41253
    },
    "error": "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\n'actor' !== 'target'\n\n    at picker (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:33:202)\n    at async runForeignPersonRoles (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-roles-runtime-checks.mjs:46:15)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:211:18)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:239:907)"
  },
  {
    "id": "pc720AcceptedV3",
    "kind": "accepted-runtime",
    "directory": "build/person-roles-20261026-v71/pc720-after-v3/",
    "layout": "pc720",
    "accepted": true,
    "credited": true,
    "result": {
      "path": "build/person-roles-20261026-v71/pc720-after-v3/result.json",
      "bytes": 36411001,
      "sha256": "15d15fd1081fdf821ee33a64fa4f1dc2633cb78cf7c51070ca74f2d50f092f96"
    },
    "phaseCount": 19,
    "partialIdentityCount": 3,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": false,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42866,
        "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-pc720-after-initial-v3.json",
        "bytes": 502,
        "sha256": "92bba808c53613360f6a0598d884418b6d5dbf469ab6991f7645dce5c8a83b59"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-pc720-after-terminal-v3.json",
        "bytes": 388,
        "sha256": "b579061a8fe64188eab9e025f9b9a1d8b6cf7c3719599ff1afda70f6ecadcb7a"
      },
      "initialChunk": "8b573d",
      "terminalChunk": "7eb72c",
      "sessionId": 80326
    }
  },
  {
    "id": "pc1080AcceptedV3",
    "kind": "accepted-runtime",
    "directory": "build/person-roles-20261026-v71/pc1080-after-v3/",
    "layout": "pc1080",
    "accepted": true,
    "credited": true,
    "result": {
      "path": "build/person-roles-20261026-v71/pc1080-after-v3/result.json",
      "bytes": 36424726,
      "sha256": "43aa125fa2d1aaab783802b84717224a4ff4e02057f083c989905c5f5114e88e"
    },
    "phaseCount": 19,
    "partialIdentityCount": 3,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": false,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42866,
        "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-pc1080-after-initial-v3.json",
        "bytes": 501,
        "sha256": "3f2c9e662ec81bc941516fa1774c77b4c83dee6a3432d863a78b609046f2eb71"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-pc1080-after-terminal-v3.json",
        "bytes": 389,
        "sha256": "9018f1e6574bd5f37cb6094679f2259652506a0483d99ca6f868ead368c07d7b"
      },
      "initialChunk": "881d21",
      "terminalChunk": "2f904e",
      "sessionId": 59415
    }
  },
  {
    "id": "mobile844FailedV3",
    "kind": "controller-failure",
    "directory": "build/person-roles-20261026-v71/mobile844-after-v3/",
    "layout": "mobile844",
    "accepted": false,
    "credited": false,
    "result": {
      "path": "build/person-roles-20261026-v71/mobile844-after-v3/result.json",
      "bytes": 14990168,
      "sha256": "816627daa5c2a93978cfb2c2f44d8ddd48a08811519fea72009701638514a767"
    },
    "phaseCount": 6,
    "partialIdentityCount": 1,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": false,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42866,
        "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-mobile844-after-initial-v3.json",
        "bytes": 503,
        "sha256": "240b01439529a0dfad5bf8facd3fb457b80f861f5404adeb02e8d3e978dcf954"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-mobile844-after-terminal-v3.json",
        "bytes": 394,
        "sha256": "c550c8dbb0e7e4b4aa492c0059e38ee3000cb1b4c754231a64f2d17682fa63da"
      },
      "initialChunk": "7fe568",
      "terminalChunk": "42e786",
      "sessionId": 34580
    },
    "error": "Error: CDP timeout: Runtime.evaluate\n    at Timeout._onTimeout (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:102:77)\n    at listOnTimeout (node:internal/timers:605:17)\n    at process.processTimers (node:internal/timers:541:7)"
  },
  {
    "id": "mobile667AcceptedV3",
    "kind": "accepted-runtime",
    "directory": "build/person-roles-20261026-v71/mobile667-after-v3/",
    "layout": "mobile667",
    "accepted": true,
    "credited": true,
    "result": {
      "path": "build/person-roles-20261026-v71/mobile667-after-v3/result.json",
      "bytes": 69433865,
      "sha256": "2e0247df0fb208314c566279d64bd32d94333d564b6d1238d6c0cf26719f8c22"
    },
    "phaseCount": 35,
    "partialIdentityCount": 3,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": false,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42866,
        "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-mobile667-after-initial-v3.json",
        "bytes": 504,
        "sha256": "4530c11248ba96a55344c3a99949cc8c7077fc20200b77192d1e817cf539b773"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-mobile667-after-terminal-v3.json",
        "bytes": 392,
        "sha256": "cb87b1916ae78d5ad550fc0a8dcc4ed0519cca8f60687270d4f31fc8aabedcd5"
      },
      "initialChunk": "f329de",
      "terminalChunk": "bbe590",
      "sessionId": 36569
    }
  },
  {
    "id": "mobile844AcceptedV4",
    "kind": "accepted-runtime",
    "directory": "build/person-roles-20261026-v71/mobile844-after-v4/",
    "layout": "mobile844",
    "accepted": true,
    "credited": true,
    "result": {
      "path": "build/person-roles-20261026-v71/mobile844-after-v4/result.json",
      "bytes": 79266250,
      "sha256": "5861c34d73faf2cb6741dc411ff7da75861640bf4525710a81c7e78524aa325b"
    },
    "phaseCount": 42,
    "partialIdentityCount": 3,
    "exceptionCount": 0,
    "dialogCount": 0,
    "unexpectedRequestCount": 0,
    "failureImage": false,
    "sourceAliases": [
      {
        "name": ".gitattributes",
        "source": ".gitattributes",
        "bytes": 42866,
        "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
      }
    ],
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-mobile844-after-initial-v4.json",
        "bytes": 504,
        "sha256": "78d22e49a0a6ddecea6c12ebb15963e5c14a85315184509fdce527762bdd58ef"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-mobile844-after-terminal-v4.json",
        "bytes": 391,
        "sha256": "e31b0c9c9595e1e05be97b8b66aa0a1a9fb981811c7a5f0b9d7d3312b07542b9"
      },
      "initialChunk": "37e596",
      "terminalChunk": "6bf157",
      "sessionId": 42254
    }
  }
];
export const FINAL_UNIT_CONTROLS=[
  {
    "result": {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v3.json",
      "bytes": 961,
      "sha256": "67e8f1f9d911032343f55bf037b3f8344c851e114a29c6d03274b381d6324034"
    },
    "tool": {
      "path": "build/person-roles-20261026-v71/raw-target-current-terminal-v3.json",
      "bytes": 1016,
      "sha256": "5821c88e3eed39fd3d32b9bbb44e3f8da71b8d550111f95aa4315f873c171d5d"
    },
    "toolChunk": "96152e",
    "tests": 504,
    "pass": 504,
    "fail": 0,
    "baselineProduct": null
  },
  {
    "result": {
      "path": "build/person-roles-20261026-v71/diplomacy-target-stage1-negative-v3.json",
      "bytes": 1176,
      "sha256": "39a1e5db63e55c632293e08323b652d7bc6d099a50dc963dec515e7190ae6052"
    },
    "tool": {
      "path": "build/person-roles-20261026-v71/raw-target-stage1-negative-terminal-v3.json",
      "bytes": 1220,
      "sha256": "33fe2b477337263372f3a34ed385192a68e75a0bcc7d4e98c45341b1b36b48ac"
    },
    "toolChunk": "852d8e",
    "tests": 504,
    "pass": 501,
    "fail": 3,
    "baselineProduct": {
      "path": "build/person-roles-20261026-v71/before/hd-city-menu-pc-stage1.js",
      "bytes": 445567,
      "sha256": "8ed19eb2c3546000f6a1babd21182166754610d18e9e388a5dea97943266d500"
    }
  },
  {
    "result": {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v3.json",
      "bytes": 1167,
      "sha256": "63407e47a4d60daf8680a952aeb98c4dd8f9633f442bc5ea38fffee5868c6ccc"
    },
    "tool": {
      "path": "build/person-roles-20261026-v71/raw-target-parent-negative-terminal-v3.json",
      "bytes": 1210,
      "sha256": "d7cf7518a5b9b411aa0dcdd59f8bc80b782dada1d93f85f8f39ffdbc4d11ab4c"
    },
    "toolChunk": "be394e",
    "tests": 504,
    "pass": 486,
    "fail": 18,
    "baselineProduct": {
      "path": "build/person-roles-20261026-v71/before/hd-city-menu.js",
      "bytes": 436244,
      "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
    }
  }
];
export const BASELINE_PRODUCT={
  "source": {
    "path": "build/person-roles-20261026-v71/before/hd-city-menu.js",
    "bytes": 436244,
    "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
  },
  "descriptor": {
    "path": "build/person-roles-20261026-v71/baseline-city-menu-v1.json",
    "bytes": 262,
    "sha256": "d4ce03e50b6f16c91f2955887a2ebaf458b107fba5e2a5ac47f2c5ac07cd2622"
  },
  "parentCommit": "8fd95a7b2f7232280a94ca1e897d18227e5c5334"
};
export const INVENTORY_CRITICAL={
  "currentCount": 158,
  "runtimeIntersectionCount": 146,
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
};
export const FINAL_MARKDOWN=String.raw`# 原版 P4 外交人物角色与 PC 返回修复

本批为 PC 接上原生外交的执行者／目标阶段，显示完整人物详情与当前角色，并按原生确认结果返回上一阶段。ENTER／EXIT 的一次发送保留在独立的原生角色记录中；异常或尚未收到 ACK 时，关闭面板及切换经典／HD 都不会重新授予同一次输入。PC 不取得手机版的公开输入票据。手机原有输入流程保留，并同步复验。

实际验证新开任务专属 P4 曹丕／晋阳新局，进入招揽 CANVASS16，检查己方执行者崔琰29，以及敌方朵思大王139、祝融夫人143。两名敌方人物的实际 Belong=4／君主孟获3，与玩家曹丕0不同；四字姓名是原版四期完整 ROM 的实际最长长度。PC1080、PC720、模拟手机844、模拟手机667各检查三人，共12次身份检查、60个列表全名／详情姓名／归属／原归属／原生归属目标。每个目标保存完整文本、Range、命中、祖先裁切、相邻元素及原始截图；身份检查本身零原生按键、零 LCD 触摸，并核对全部已测 world/native 字段不变。原生归属仅验当前第一页第0属性，不授全部13列实际验收。

每局仅确认执行者一次39以进入敌方目标名单，不确认任何目标，不派发命令。一次40从目标返回新执行者名单，再一次40退出到实际 MAP；原生 session、inputSeq、menuSeq、角色和地图 ACK 逐项绑定。所有已测日期、资源、人物、队列和命令记录保持不变。模拟手机通过实际触摸预览及非交互区域滑动阅读；844使用20次名单滑动，667使用13次，均核对零额外选择／确认、零原生 LCD 触摸及 world/native 不变。这是 Chrome 尺寸模拟，不能代替真机或稳定性能验收。

原 PC 产品8fd95a7的实际新局记录在外交执行者阶段缺少 HD 角色详情，完整 false 报告与失败图原样保留。新产品的第一次运行遇到原生状态先于 HD 采用，第二次遇到目标状态先于角色 DOM 更新；运行器随后等待真实的采用及 DOM 角色 ACK，产品448176字节／cfcd4f89保持不变。手机版844首次发生 Runtime.evaluate 超时，原因未确认，失败报告仍为 false，原本缺少的失败截图和 failureState 保持缺少。最终同一产品和12826字节运行辅助器分别闭合四个布局；全部8份原报告、4次失败、全部阶段图、执行副本、源码清单、控制器修正记录及原 CLI 终态均收录，不改写失败结果。

最终受控外交模块504／504通过。相同新测试针对最初 PC 候选触发3个预期失败，针对旧父产品触发18个预期失败；底层退出1与外层确认负控有效的退出0分别保留。旧500项及中间504项运行仅作原始记录，不重复计入默认全量或实际浏览器验收。

默认全量已实际关闭并通过7931／7931，150个已注册模块，fail／cancel／skip／todo均为0，1649项选定源码在运行前后逐字节稳定。使用原记录 Clang18；默认测试较保存的7913父基线新增18项，受控模块504项是全量的子集，浏览器12次身份／60个目标不计作单位测试。

当前关键清单158项，原生128份源码 aggregate 617c3aea391fa57bec1576e70cb6b4b1ed76f747c948015069a71f71b168ffb0；WASM 未重建，原构建 sourceRevision／modified 标记保留。各轮运行器冻结1226项，与当前关键清单的精确交集146项、差集12项分别核对；冻结清单不表示每项均被实际 HTTP 请求或执行。全部浏览器及默认全量关闭后，实际仅向 attrs 追加一条 Git 字节保留规则，使提交中的 CRLF 测试源码保留实际执行过的194102字节。整件旧42866字节加固定65字节后缀等于新42931字节；1649项全量源码向量只有 attrs 变化，157项其余关键源码以及所有执行代码／测试字节均保持原样。四个成功运行的146项交集中，145项直接等于最终当前字节，唯一 attrs 项绑定精确的前一 metadata 字节；12项差集原样列明。全量是在追加规则前运行，本批未声称在新 attrs 上再跑全量。最终158项当前文件仍必须逐字节核对；其他成功源码差异均拒收。

![PC1080](m5-person-roles-20261026-v71-pc1080.png)

![PC720](m5-person-roles-20261026-v71-pc720.png)

![模拟844](m5-person-roles-20261026-v71-mobile844.png)

![模拟667](m5-person-roles-20261026-v71-mobile667.png)

所有完整报告均以不压缩的32MiB原始 byte ranges重构，先核整件长度／SHA，再解析 JSON。V45 codec 八项限额保持不变；归档的运行器和 oracle 均作为数据，验证器不执行它们。缺少本地 build 时从归档精确重构；本地原件若存在但不一致则拒收。

用户已明确保留旧战局、暂不重开并继续其他 HD；本轮没有旧战局输入或关闭。俘虏／在野实际角色、目标确认／派发／月结、任意 Mod、其他期实玩、完整 ABI／SAVE／RNG、全部13属性、真机、稳定性能及整体 HD 仍未验收。
`;
export const FIXED={...{
  "codec": {
    "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
    "bytes": 32262,
    "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
  },
  "support": [
    {
      "path": "build/person-roles-20261026-v71/baseline-city-menu-v1.json",
      "bytes": 262,
      "sha256": "d4ce03e50b6f16c91f2955887a2ebaf458b107fba5e2a5ac47f2c5ac07cd2622"
    },
    {
      "path": "build/person-roles-20261026-v71/before/executed-identity-runner-parent.mjs",
      "bytes": 48041,
      "sha256": "9748a6dbc4bf2719cde8f528f64e7f7d4bc3f08bfbba7553035eb13ebbf695c4"
    },
    {
      "path": "build/person-roles-20261026-v71/before/gitattributes-runtime-v1",
      "bytes": 42866,
      "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
    },
    {
      "path": "build/person-roles-20261026-v71/before/hd-city-menu-pc-stage1.js",
      "bytes": 445567,
      "sha256": "8ed19eb2c3546000f6a1babd21182166754610d18e9e388a5dea97943266d500"
    },
    {
      "path": "build/person-roles-20261026-v71/before/hd-city-menu.js",
      "bytes": 436244,
      "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
    },
    {
      "path": "build/person-roles-20261026-v71/before/identity-runner-extension-v1.mjs",
      "bytes": 49964,
      "sha256": "a7fd9253a1bf032f3616e09c50d925aaae5b5bd9d0094d36c4201e27fa4bf935"
    },
    {
      "path": "build/person-roles-20261026-v71/before/roles-helper-before-adoption-wait-v1.mjs",
      "bytes": 12113,
      "sha256": "9929324c2f74d0bc0698e03ca25261daa21a73ffedaae3ef2e6d49c508358081"
    },
    {
      "path": "build/person-roles-20261026-v71/before/roles-helper-before-banner-wait-v2.mjs",
      "bytes": 12683,
      "sha256": "4e1074b759feee5eda737aa0ac162fff863bc5e50724cab4fc0e7b80f98fa2c5"
    },
    {
      "path": "build/person-roles-20261026-v71/check-preserved-state-v2.mjs",
      "bytes": 2389,
      "sha256": "701d0d510a45a046fc8c058b35c73816f6fa89aca04536934d37c2fed83bebf6"
    },
    {
      "path": "build/person-roles-20261026-v71/clarify-runner-labels-v2.mjs",
      "bytes": 1381,
      "sha256": "883c85629ef551d8c50f81dcde4270b947cf17190ae201510a53550ac111faea"
    },
    {
      "path": "build/person-roles-20261026-v71/delivery-full-selected-after-v1.json",
      "bytes": 278790,
      "sha256": "80b1c64e613fb041566fcf99bb935c565c2213a702406db7cbb2e5dbcf65430e"
    },
    {
      "path": "build/person-roles-20261026-v71/delivery-metadata-transition-v1.json",
      "bytes": 2553,
      "sha256": "b76b6501546f29a80e4c01f2929259e19f13b1b618805d45083fceb8e1e1af0a"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v1.before.json",
      "bytes": 648,
      "sha256": "e91ef2e5daf0812530b64cd558dba3ae5cbcc2e5bb80086890f388441177b663"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v1.json",
      "bytes": 961,
      "sha256": "9ef1e2fa2a73d8ae919494abb39fd65da05fe3c89cc81a3a6c6d74601eeabffa"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v1.stdout.tap",
      "bytes": 107450,
      "sha256": "1eaaa40cc3468dd0506bf36fc09d71ed75cecb73c0e78e3693081f82c4b8f6a5"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v2.before.json",
      "bytes": 648,
      "sha256": "2d0a3745128483f5163e5c9f89f65c59698083dbf5f8f922eb434b46ef179af3"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v2.json",
      "bytes": 961,
      "sha256": "64b84644067586067547db5e843db04d9a6fcef93f6dc5cb024741984dcec51d"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v2.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v2.stdout.tap",
      "bytes": 108348,
      "sha256": "ccbbf16b9f7a3a15b1adeb9bef6a7807d27d1d39397e742b5a9376082f5a26cc"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v3.before.json",
      "bytes": 648,
      "sha256": "d5dba6b7df0dfad90484e9167a9e97d32412701488d4af94f3d944d26a013e6b"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v3.json",
      "bytes": 961,
      "sha256": "67e8f1f9d911032343f55bf037b3f8344c851e114a29c6d03274b381d6324034"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v3.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-current-v3.stdout.tap",
      "bytes": 108379,
      "sha256": "31244940484a6e669d40df6cd3f951b263a91032bafdc38bec11ed4cd2b1c4c4"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v1.before.json",
      "bytes": 648,
      "sha256": "e91ef2e5daf0812530b64cd558dba3ae5cbcc2e5bb80086890f388441177b663"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v1.json",
      "bytes": 1167,
      "sha256": "24e16f633c16e8ab92e90fe519ffcffa863b2dde7d3add8858aa55c7f30a2ce7"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v1.stdout.tap",
      "bytes": 120848,
      "sha256": "1f951422f802725dd6c528d5ac0e559e8f52ff89efdb72ae17090c7ccfdae5de"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v3.before.json",
      "bytes": 648,
      "sha256": "d5dba6b7df0dfad90484e9167a9e97d32412701488d4af94f3d944d26a013e6b"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v3.json",
      "bytes": 1167,
      "sha256": "63407e47a4d60daf8680a952aeb98c4dd8f9633f442bc5ea38fffee5868c6ccc"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v3.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-parent-negative-v3.stdout.tap",
      "bytes": 125630,
      "sha256": "02df00c6c91ebb8fcf8f3ecac85a4dc1dcd8901c3e41c446bd3ce57666cbbf5a"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-stage1-negative-v3.before.json",
      "bytes": 648,
      "sha256": "d5dba6b7df0dfad90484e9167a9e97d32412701488d4af94f3d944d26a013e6b"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-stage1-negative-v3.json",
      "bytes": 1176,
      "sha256": "39a1e5db63e55c632293e08323b652d7bc6d099a50dc963dec515e7190ae6052"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-stage1-negative-v3.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-roles-20261026-v71/diplomacy-target-stage1-negative-v3.stdout.tap",
      "bytes": 112683,
      "sha256": "920eccc785906447d3a2a181b307e2b518e6464887c6d36089203271e9ab4c6f"
    },
    {
      "path": "build/person-roles-20261026-v71/extend-identity-runner-v1.mjs",
      "bytes": 7150,
      "sha256": "a6aa971b8b183723fc718f4f61e2d2c22ced21d7a2b6ee7f0c4d1494ef54e0e8"
    },
    {
      "path": "build/person-roles-20261026-v71/freeze-current-epoch-v1.mjs",
      "bytes": 3153,
      "sha256": "ab95f1f4ba3b6dd9a478fc93c0c6ba8519daa7a24f68dbecfb1204c42536e9d6"
    },
    {
      "path": "build/person-roles-20261026-v71/full-default-v1.before.json",
      "bytes": 278790,
      "sha256": "e2d814556b5e123bb0bc94c57a4233e1caf450a1c0395c55e782eaf63c5ac097"
    },
    {
      "path": "build/person-roles-20261026-v71/full-default-v1.json",
      "bytes": 1847,
      "sha256": "a138e631ce02d67878f5553e4b7b6c6641319039c2b07aeac8c15ac9276e9f75"
    },
    {
      "path": "build/person-roles-20261026-v71/full-default-v1.stderr.log",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": "build/person-roles-20261026-v71/full-default-v1.stdout.tap",
      "bytes": 1629652,
      "sha256": "ae025f8b9866b3b469f0359fe970df67923b4a8906a71d6218b4133dc8277247"
    },
    {
      "path": "build/person-roles-20261026-v71/identity-runner-extension-v1.json",
      "bytes": 7598,
      "sha256": "8e0790cabc73641cd6b1175314809f521ae55a9d293b7273ccb9be37b700996d"
    },
    {
      "path": "build/person-roles-20261026-v71/parent-sources/.gitattributes",
      "bytes": 42519,
      "sha256": "6223a18a2885c97feee4e558adba99cab337c3d6690b46e89115465cf48af25a"
    },
    {
      "path": "build/person-roles-20261026-v71/parent-sources/js/hd-city-menu.js",
      "bytes": 436244,
      "sha256": "31ad8b8b99f091e65ec33fe00ce933fb0ec2b9ff6629d49a3a66fc8ecd83f34f"
    },
    {
      "path": "build/person-roles-20261026-v71/parent-sources/m.html",
      "bytes": 18478,
      "sha256": "e8b80108989eee1ed07083b2828caf2534c68d4cbeb105fe390b2b6be6c884b6"
    },
    {
      "path": "build/person-roles-20261026-v71/parent-sources/package.json",
      "bytes": 21371,
      "sha256": "1c35bd7aae8a3cbad01a470fefd1c040622e747373bee6036239af6408c9d4fc"
    },
    {
      "path": "build/person-roles-20261026-v71/parent-sources/pc.html",
      "bytes": 28679,
      "sha256": "52067903716f3d7287f136052f622a09fa75e3d34f67212c4ab20e64d25b6c8d"
    },
    {
      "path": "build/person-roles-20261026-v71/parent-sources/scripts/test-hd-city-mobile-host.mjs",
      "bytes": 177204,
      "sha256": "6d7f52c66bd3c229f271b81a257f8795400a434771caed9ba89eba1e868cc3d7"
    },
    {
      "path": "build/person-roles-20261026-v71/parent-sources/scripts/test-hd-person-identity-runtime.mjs",
      "bytes": 48041,
      "sha256": "9748a6dbc4bf2719cde8f528f64e7f7d4bc3f08bfbba7553035eb13ebbf695c4"
    },
    {
      "path": "build/person-roles-20261026-v71/preserve-tested-host-bytes-v1.mjs",
      "bytes": 3718,
      "sha256": "67906b04e83161b0d1fc66b8fbfa4d6d1306308ba5fdb794a7961eb974c6a28b"
    },
    {
      "path": "build/person-roles-20261026-v71/preserved-state-before-v2.json",
      "bytes": 614,
      "sha256": "4e25db5bfcd00c72424cc2c4530f59223848f4d187ff1c23dd2e5eb1b6a7d124"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-delivery-metadata-terminal-v1.json",
      "bytes": 909,
      "sha256": "eff0c92d32d724ea8a0a98600af4e88a64e08934885c6d04d4f371c1b0546225"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-epoch-freeze-terminal-v2.json",
      "bytes": 644,
      "sha256": "4eeb60b4cc89604321315254725506ad88190fe732fd2dfab47d7ed84f5bbe82"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-full-default-initial-v1.json",
      "bytes": 346,
      "sha256": "9c36160b336db92dfeffc07a684a1f46e340793022c3cc1adc7d7607d62d0c1c"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-full-default-terminal-v1.json",
      "bytes": 404,
      "sha256": "312d4272c94f8a5600ebffaf433eade9a010fd4dd2790919dd35a0f356a96a1f"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-mobile667-after-initial-v3.json",
      "bytes": 504,
      "sha256": "4530c11248ba96a55344c3a99949cc8c7077fc20200b77192d1e817cf539b773"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-mobile667-after-terminal-v3.json",
      "bytes": 392,
      "sha256": "cb87b1916ae78d5ad550fc0a8dcc4ed0519cca8f60687270d4f31fc8aabedcd5"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-mobile844-after-initial-v3.json",
      "bytes": 503,
      "sha256": "240b01439529a0dfad5bf8facd3fb457b80f861f5404adeb02e8d3e978dcf954"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-mobile844-after-initial-v4.json",
      "bytes": 504,
      "sha256": "78d22e49a0a6ddecea6c12ebb15963e5c14a85315184509fdce527762bdd58ef"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-mobile844-after-progress-v3.json",
      "bytes": 409,
      "sha256": "8b6b7bd90b14a9b63b48925cda402b5695c343bda9ee1b11c2594f498cf2c317"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-mobile844-after-terminal-v3.json",
      "bytes": 394,
      "sha256": "c550c8dbb0e7e4b4aa492c0059e38ee3000cb1b4c754231a64f2d17682fa63da"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-mobile844-after-terminal-v4.json",
      "bytes": 391,
      "sha256": "e31b0c9c9595e1e05be97b8b66aa0a1a9fb981811c7a5f0b9d7d3312b07542b9"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc1080-after-initial-v3.json",
      "bytes": 501,
      "sha256": "3f2c9e662ec81bc941516fa1774c77b4c83dee6a3432d863a78b609046f2eb71"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc1080-after-terminal-v3.json",
      "bytes": 389,
      "sha256": "9018f1e6574bd5f37cb6094679f2259652506a0483d99ca6f868ead368c07d7b"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-after-initial-v1.json",
      "bytes": 1199,
      "sha256": "3234501ac6e34a52c4343194d1c859b44c021df41c8020afd4f182d7fbfc8f70"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-after-initial-v2.json",
      "bytes": 500,
      "sha256": "35d33decb0828e8b4d6b437e378f7c70a0870fe219e3e537bf6a525116187a1b"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-after-initial-v3.json",
      "bytes": 502,
      "sha256": "92bba808c53613360f6a0598d884418b6d5dbf469ab6991f7645dce5c8a83b59"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-after-terminal-v1.json",
      "bytes": 390,
      "sha256": "cd315740f1b429d022d257a35621e73691462be5531f9fad5a8aa35470fcc805"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-after-terminal-v2.json",
      "bytes": 1080,
      "sha256": "7c044811afe7cfbf1f234a14e4ee4e0c8936735dde4da86a588fc566802e9cc5"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-after-terminal-v3.json",
      "bytes": 388,
      "sha256": "b579061a8fe64188eab9e025f9b9a1d8b6cf7c3719599ff1afda70f6ecadcb7a"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-before-initial-tool-v1.json",
      "bytes": 1197,
      "sha256": "3e91b941fa381ba5c7f6f54de1e0646e5733b846e89799b256a8a517e7f5bd3c"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-pc720-before-terminal-tool-v1.json",
      "bytes": 391,
      "sha256": "b18494af8fefff70a3311bc24695b2b2a2eccfc4507ef0bcbded1a6c2999c678"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-preserved-state-terminal-v2.json",
      "bytes": 656,
      "sha256": "70d84365b7b5e77776f38d874df1fdf6f067c331efc633b57c8b47e6fbe83f6c"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-target-current-terminal-tool-v1.json",
      "bytes": 1016,
      "sha256": "5ea547abee0bb37ce6e062a76929e77ea89f35da748afa3523828895cbe1c3bf"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-target-current-terminal-v2.json",
      "bytes": 1016,
      "sha256": "c51d35186a4397bcfb15cd465ea94d74c70237a394574f641db7da21e73212ed"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-target-current-terminal-v3.json",
      "bytes": 1016,
      "sha256": "5821c88e3eed39fd3d32b9bbb44e3f8da71b8d550111f95aa4315f873c171d5d"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-target-parent-negative-terminal-tool-v1.json",
      "bytes": 1211,
      "sha256": "bdd9fb230ed1f791a3608ab4c4898d91acc204f65db1b8ac7a1da7265ed2b823"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-target-parent-negative-terminal-v3.json",
      "bytes": 1210,
      "sha256": "d7cf7518a5b9b411aa0dcdd59f8bc80b782dada1d93f85f8f39ffdbc4d11ab4c"
    },
    {
      "path": "build/person-roles-20261026-v71/raw-target-stage1-negative-terminal-v3.json",
      "bytes": 1220,
      "sha256": "33fe2b477337263372f3a34ed385192a68e75a0bcc7d4e98c45341b1b36b48ac"
    },
    {
      "path": "build/person-roles-20261026-v71/repair-role-adoption-wait-v2.mjs",
      "bytes": 1771,
      "sha256": "ef3015f1d9fe04af41f8146df82ecb5a8390f2cae05b4db80ce554dd8f470d1d"
    },
    {
      "path": "build/person-roles-20261026-v71/repair-role-banner-wait-v3.mjs",
      "bytes": 1263,
      "sha256": "70a92d873119f10192704d3866955f134bbdccf18f339bb00bcc61516f321418"
    },
    {
      "path": "build/person-roles-20261026-v71/role-adoption-wait-v2.json",
      "bytes": 1605,
      "sha256": "a4299faf60c933fc242fa4eb5cdbf7a16d22a85d174b1a72019f2ac1a83c40ec"
    },
    {
      "path": "build/person-roles-20261026-v71/role-banner-wait-v3.json",
      "bytes": 908,
      "sha256": "18125dc45cdd709a3b5e8a8217f65a958b18ff74c761bef989e73777a88a915b"
    },
    {
      "path": "build/person-roles-20261026-v71/rom-role-matrix-v1.json",
      "bytes": 8950,
      "sha256": "fdac1882352fbd85840573d2583fd0691606d33a8a47ba3e7e80aa3b8d0606a7"
    },
    {
      "path": "build/person-roles-20261026-v71/run-diplomacy-targets-v1.mjs",
      "bytes": 2192,
      "sha256": "38fe56c8a0c96fa108b67612db0f7995d41d893e7b6405820027907b77435aac"
    },
    {
      "path": "build/person-roles-20261026-v71/run-diplomacy-targets-v2.mjs",
      "bytes": 2272,
      "sha256": "1822dc3106b1bbc03ebdf2b806c3e3cc961a50a0d015b0204c3c273fa890763f"
    },
    {
      "path": "build/person-roles-20261026-v71/run-diplomacy-targets-v3.mjs",
      "bytes": 2272,
      "sha256": "c4a590f57ea4b93259f9abdaf01310873062ce62bca2ff9ecba77c8898da48bc"
    },
    {
      "path": "build/person-roles-20261026-v71/run-full-default-v1.mjs",
      "bytes": 4066,
      "sha256": "51749d1487a5ec4b9373f3892fc0e0077eaa73ac572d6f1b3e61109b21b4b473"
    },
    {
      "path": "build/person-roles-20261026-v71/runner-labels-v2.json",
      "bytes": 968,
      "sha256": "34174c067a88b13676c248f50f8958d43c60826b2704be120cdf1936785a64a7"
    },
    {
      "path": "build/person-roles-20261026-v71/save-pc-stage1-product-v1.mjs",
      "bytes": 519,
      "sha256": "b629d3b0e4cf828f1c0c0787830e5f53e23ef424c0cec467d5dccf7f5210294d"
    },
    {
      "path": "build/person-roles-20261026-v71/source-epoch-v1.json",
      "bytes": 30090,
      "sha256": "525e9c81a5611edc72bb3add6c29f3653120482a5ee2701bab9130e7915ab955"
    },
    {
      "path": "build/person-roles-20261026-v71/source-epoch-v2.json",
      "bytes": 30313,
      "sha256": "36ad6969dbf2e0dfa77b88dcebdd9a6eb95539fe892cbd584b2dcaf6a1607a80"
    },
    {
      "path": "docs/validation/m5-person-identity-20261026-v70.json",
      "bytes": 154092,
      "sha256": "18756b43cbf4bcdb5a701ae8ad48abb0d1a1197df620c732492a269947730bbb"
    }
  ],
  "runtimeInventoryCount": 1226,
  "fullDefault": {
    "result": {
      "path": "build/person-roles-20261026-v71/full-default-v1.json",
      "bytes": 1847,
      "sha256": "a138e631ce02d67878f5553e4b7b6c6641319039c2b07aeac8c15ac9276e9f75"
    },
    "tool": {
      "initial": {
        "path": "build/person-roles-20261026-v71/raw-full-default-initial-v1.json",
        "bytes": 346,
        "sha256": "9c36160b336db92dfeffc07a684a1f46e340793022c3cc1adc7d7607d62d0c1c"
      },
      "terminal": {
        "path": "build/person-roles-20261026-v71/raw-full-default-terminal-v1.json",
        "bytes": 404,
        "sha256": "312d4272c94f8a5600ebffaf433eade9a010fd4dd2790919dd35a0f356a96a1f"
      },
      "initialChunk": "29307b",
      "terminalChunk": "95d26a",
      "sessionId": 30275
    },
    "expectedTests": 7931,
    "newDistinctTests": 18
  },
  "metadataTransition": {
    "priorEpoch": {
      "path": "build/person-roles-20261026-v71/source-epoch-v1.json",
      "bytes": 30090,
      "sha256": "525e9c81a5611edc72bb3add6c29f3653120482a5ee2701bab9130e7915ab955"
    },
    "receipt": {
      "path": "build/person-roles-20261026-v71/delivery-metadata-transition-v1.json",
      "bytes": 2553,
      "sha256": "b76b6501546f29a80e4c01f2929259e19f13b1b618805d45083fceb8e1e1af0a"
    },
    "before": {
      "path": "build/person-roles-20261026-v71/before/gitattributes-runtime-v1",
      "bytes": 42866,
      "sha256": "d4e37050dfc1686afaf02c2561eb2178116eaf7eed647bb9442b95819732d099"
    },
    "after": {
      "path": ".gitattributes",
      "bytes": 42931,
      "sha256": "f987d684910589d30516d8b7f908414c96bb23642477751e2563120b53e2b5c9"
    },
    "appendedText": "/scripts/test-hd-city-mobile-host.mjs -text whitespace=cr-at-eol\n",
    "fullSourcesAfter": {
      "path": "build/person-roles-20261026-v71/delivery-full-selected-after-v1.json",
      "bytes": 278790,
      "sha256": "80b1c64e613fb041566fcf99bb935c565c2213a702406db7cbb2e5dbcf65430e"
    },
    "tool": {
      "path": "build/person-roles-20261026-v71/raw-delivery-metadata-terminal-v1.json",
      "bytes": 909,
      "sha256": "eff0c92d32d724ea8a0a98600af4e88a64e08934885c6d04d4f371c1b0546225"
    },
    "toolChunk": "935d0c"
  }
},cases:CLOSED_CASES,unitControls:FINAL_UNIT_CONTROLS,baselineProduct:BASELINE_PRODUCT,inventoryCritical:INVENTORY_CRITICAL,markdown:FINAL_MARKDOWN};
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
export const publicModule = name => name==='v71-reader-v1.mjs'?PREFIX+'-verify.mjs':PREFIX+'-'+name;
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
