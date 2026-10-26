import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export const B = 'build/person-identity-20261026-v70/';
export const D = B + 'evidence-source-v2/';
export const PREFIX = 'docs/validation/m5-person-identity-20261026-v70';
export const MODULES = ['v70-common-v1.mjs', 'v70-reader-v1.mjs'];
export const SOURCES = [...MODULES, 'prepare-v1.mjs', 'publish-v1.mjs', 'README.md'];
export const BOUNDS = Object.freeze({maxPartBytes:8388608, maxSerializedBytes:67108864,
  maxNamedRawBytes:134217728, maxUniqueRawBytes:100663296, maxFileBytes:33554432,
  maxFiles:512, maxBlobs:512, maxParts:32});
export const EPOCH = {path:B+'source-epoch-v7.json', bytes:28956,
  sha256:'f3d8f2942eacfeddec30f7c0192901c31df957524cd6ef8c2cf8d3cd7f0f7811'};
// Exact final actual closed-result/tool pins; failed records remain original data.
export const FIXED = {
  "codec": {
    "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
    "bytes": 32262,
    "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
  },
  "cases": [
    {
      "id": "pc720FailedV1",
      "directory": "build/person-identity-20261026-v70/pc720-v1/",
      "layout": "pc720",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-identity-20261026-v70/pc720-v1/result.json",
        "bytes": 1251025,
        "sha256": "3e1fdecb5b44d0b9bc676595a1626f1ff9bb0387ec624da4dcfdb4fcae8f5104"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 39185,
        "sha256": "bfabe2a23535bd9ceb2b2dfac1be307bd5f1a36ddedbcb2102ed5f64babbd28b"
      },
      "phaseCount": 0,
      "partialIdentityCount": 0,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-pc720-initial-tool-v1.json",
          "bytes": 1136,
          "sha256": "248e56516b23ae4267df74d4cfb9ff1ba2e791a7155c7cf908d9915d5791119b"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-pc720-initial-tool-v1.json",
          "bytes": 1136,
          "sha256": "248e56516b23ae4267df74d4cfb9ff1ba2e791a7155c7cf908d9915d5791119b"
        },
        "initialChunk": "2c0357",
        "terminalChunk": "2c0357",
        "sessionId": null
      },
      "failureStage": "map-point",
      "error": "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\nfalse !== true\n\n    at identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:174:546)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:207:878)"
    },
    {
      "id": "pc720FailedV2",
      "directory": "build/person-identity-20261026-v70/pc720-v2/",
      "layout": "pc720",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-identity-20261026-v70/pc720-v2/result.json",
        "bytes": 46530056,
        "sha256": "c3d53674ba3dbdf17cefd164edb94d1a9f0ead37f80ed684d9c7881551f95f27"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 43019,
        "sha256": "feadcde9f8017124eab531becd22b218731025cd296a255943aa901f2d9b6315"
      },
      "phaseCount": 28,
      "partialIdentityCount": 5,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-pc720-initial-tool-v2.json",
          "bytes": 499,
          "sha256": "41faeaad1a3d2f1c101c3669cdfeeeda1f2f5e568bd57fd0918dd50b31f61144"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-pc720-terminal-tool-v2.json",
          "bytes": 1059,
          "sha256": "65c1a5470b6606fc58de5a6a223ca949ea1eb6ac28e556560b34de5463518bb3"
        },
        "initialChunk": "248c11",
        "terminalChunk": "67a96b",
        "sessionId": 66522
      },
      "failureStage": "return-contract",
      "error": "AssertionError [ERR_ASSERTION]: Actual displayed DOM #hd-city-menu [data-hd-menu-back]\n    at revealPc (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:158:141)\n    at async click (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:160:41)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:213:75)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:227:878)"
    },
    {
      "id": "mobile667FailedV3",
      "directory": "build/person-identity-20261026-v70/mobile667-v3/",
      "layout": "mobile667",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-identity-20261026-v70/mobile667-v3/result.json",
        "bytes": 818103,
        "sha256": "9cb5723f2c525feb0b473f6865f39df760ae113b0c194beaec62c7dbab2574b4"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 43241,
        "sha256": "4836e07757f3bd86d762a4f18a12a5ee13a7802e6b7d40dfa4a2b2ac661aab2c"
      },
      "phaseCount": 0,
      "partialIdentityCount": 0,
      "exceptionCount": 1,
      "dialogCount": 0,
      "unexpectedRequestCount": 1,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v3.json",
          "bytes": 503,
          "sha256": "6598aad08c47702d7fdf30f2f4c2237dc03bcd66c4f742682caa2738b1a2b53b"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v3.json",
          "bytes": 886,
          "sha256": "03c3e3bd9e3eb34626c1d802e982a1da03689259885c456a00f07cda44ca7fa9"
        },
        "initialChunk": "16050b",
        "terminalChunk": "0bafb1",
        "sessionId": 69704
      },
      "failureStage": "mobile-entry",
      "error": "Error: Timed out waiting for actual original LIB identity\n    at waitFor (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:123:11)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:150:2)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:227:878)"
    },
    {
      "id": "mobile844FailedV3",
      "directory": "build/person-identity-20261026-v70/mobile844-v3/",
      "layout": "mobile844",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-identity-20261026-v70/mobile844-v3/result.json",
        "bytes": 818109,
        "sha256": "5df9983b093888f69023ad7ab68cece41d4e54ff8638145fdaec6b2bf27a329a"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 43241,
        "sha256": "4836e07757f3bd86d762a4f18a12a5ee13a7802e6b7d40dfa4a2b2ac661aab2c"
      },
      "phaseCount": 0,
      "partialIdentityCount": 0,
      "exceptionCount": 1,
      "dialogCount": 0,
      "unexpectedRequestCount": 1,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-mobile844-initial-tool-v3.json",
          "bytes": 500,
          "sha256": "9402b9c1c86600c0d12a8b1729d0847aee27896018bf3b26aa9d7ea73d6fd91a"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-mobile844-terminal-tool-v3.json",
          "bytes": 391,
          "sha256": "c1899c2144cad1952bdb76c559495dfdc807a56fe6f969b89a88874737bf0ee1"
        },
        "initialChunk": "f690b4",
        "terminalChunk": "410775",
        "sessionId": 3534
      },
      "failureStage": "mobile-entry",
      "error": "Error: Timed out waiting for actual original LIB identity\n    at waitFor (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:123:11)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:150:2)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:227:878)"
    },
    {
      "id": "mobile667FailedV4",
      "directory": "build/person-identity-20261026-v70/mobile667-v4/",
      "layout": "mobile667",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-identity-20261026-v70/mobile667-v4/result.json",
        "bytes": 1760576,
        "sha256": "8afffd79e2e79ab2ce547732c37e3227d83ab56b94482c1759a2e8446a4937ec"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 43270,
        "sha256": "31d31ccac4cc7f6c9396fecba468b58f6c9392950e86d8f50c8523fc5d1cdb36"
      },
      "phaseCount": 1,
      "partialIdentityCount": 0,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v4.json",
          "bytes": 1440,
          "sha256": "abca3a803c3237d851d11b3ea55c3b2f45fdc320eb247d18a9e91a3db329c175"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v4.json",
          "bytes": 1440,
          "sha256": "abca3a803c3237d851d11b3ea55c3b2f45fdc320eb247d18a9e91a3db329c175"
        },
        "initialChunk": "089ed3",
        "terminalChunk": "089ed3",
        "sessionId": null
      },
      "failureStage": "mobile-controls-ready",
      "error": "AssertionError [ERR_ASSERTION]: Current preview control is shown and enabled [data-hd-sub=\"2\"]\n    at reveal (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-mobile-preview-runtime-checks.mjs:41:14)\n    at async click (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:160:41)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:201:307)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:227:907)"
    },
    {
      "id": "mobile667FailedV5",
      "directory": "build/person-identity-20261026-v70/mobile667-v5/",
      "layout": "mobile667",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-identity-20261026-v70/mobile667-v5/result.json",
        "bytes": 67198706,
        "sha256": "f16c7fdddabdba2e4b11be043c1f70ca69cc35d67a0a9b70c1f145dafe2d4e74"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 44027,
        "sha256": "a9d89c2dd848116c5e87fbd280eefe20a9502f800410cf1151e0a23bac5379a2"
      },
      "phaseCount": 26,
      "partialIdentityCount": 4,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v5.json",
          "bytes": 501,
          "sha256": "07d5136c1a9bb2bbe3bea3596791b606f3c92769739ed7c6ace7f1aa305c87d0"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v5.json",
          "bytes": 1072,
          "sha256": "e711840a78893a90a24615ba7230f593abd8713f345722545d3c069a4bd3bc8e"
        },
        "initialChunk": "177400",
        "terminalChunk": "5e9b4c",
        "sessionId": 30802
      },
      "failureStage": "mobile-pan-band",
      "error": "AssertionError [ERR_ASSERTION]: Actual detail pane has a noninteractive trusted-pan band\n    at reveal (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-mobile-preview-runtime-checks.mjs:60:14)\n    at async Object.preview (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-mobile-preview-runtime-checks.mjs:102:15)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:207:14)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:227:907)"
    },
    {
      "id": "mobile667FailedV6",
      "directory": "build/person-identity-20261026-v70/mobile667-v6/",
      "layout": "mobile667",
      "accepted": false,
      "credited": false,
      "result": {
        "path": "build/person-identity-20261026-v70/mobile667-v6/result.json",
        "bytes": 68945955,
        "sha256": "a4d7a08648756d94dbfb593a355f96933fcfea5378806edbc328bd77ad455cb3"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 47384,
        "sha256": "d8ae2bc5433f6194481524d5d6c4d06388d788a43878e74a497b67a784f633a2"
      },
      "phaseCount": 28,
      "partialIdentityCount": 4,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v6.json",
          "bytes": 502,
          "sha256": "b58de585955737a3ad387cd7e4265b41062495de91f831f329fff02eb8f28318"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v6.json",
          "bytes": 1086,
          "sha256": "d4679f97c0c0573aec10cb2108dbe92b6f664903b1af31e96c9f53efd75cad83"
        },
        "initialChunk": "164c7b",
        "terminalChunk": "40afa4",
        "sessionId": 5876
      },
      "failureStage": "mobile-identity-reveal",
      "error": "AssertionError [ERR_ASSERTION]: Actual detail pane has a noninteractive trusted-pan band\n    at Object.reveal (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-mobile-preview-runtime-checks.mjs:60:14)\n    at async checkPersonIdentity (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/hd-person-identity-runtime-checks.mjs:198:26)\n    at async identitySmoke (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:218:156)\n    at async main (file:///C:/Users/75112/.codex/worktrees/hd-equipment-icons/baye-sanguo/scripts/test-hd-person-identity-runtime.mjs:235:907)"
    },
    {
      "id": "pc1080",
      "directory": "build/person-identity-20261026-v70/pc1080-v3/",
      "layout": "pc1080",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-identity-20261026-v70/pc1080-v3/result.json",
        "bytes": 46541133,
        "sha256": "99a85bce5a66951c11d5fae1ca501575de476a5c1fa276c50794c02e425d974e"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 43241,
        "sha256": "4836e07757f3bd86d762a4f18a12a5ee13a7802e6b7d40dfa4a2b2ac661aab2c"
      },
      "phaseCount": 28,
      "partialIdentityCount": 5,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-pc1080-initial-tool-v3.json",
          "bytes": 498,
          "sha256": "4534dc3c22bd384214264d6aa3a10b44c0f44d45501e8e7e89ae4db6600baa2c"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-pc1080-terminal-tool-v3.json",
          "bytes": 386,
          "sha256": "7fbbb86afad8c97e1a367f0e34b03183c7ce06d5244a4c054c891c6971c61767"
        },
        "initialChunk": "c61b12",
        "terminalChunk": "04fa5d",
        "sessionId": 81139
      }
    },
    {
      "id": "pc720",
      "directory": "build/person-identity-20261026-v70/pc720-v3/",
      "layout": "pc720",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-identity-20261026-v70/pc720-v3/result.json",
        "bytes": 46540388,
        "sha256": "6e84fc93644576328a1f27b79de3a1df6b16cda7a7f37b9b0ebe721b859aaf9d"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 43241,
        "sha256": "4836e07757f3bd86d762a4f18a12a5ee13a7802e6b7d40dfa4a2b2ac661aab2c"
      },
      "phaseCount": 28,
      "partialIdentityCount": 5,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-pc720-initial-tool-v3.json",
          "bytes": 496,
          "sha256": "f4e82db1485f5b93f23f94142643af48db3a72ba1d10dbe7e7de7e6bde480349"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-pc720-terminal-tool-v3.json",
          "bytes": 385,
          "sha256": "e730330bf96e270f62a7b05baecfa48a0ac4e03e8d4c63417d4e79e8d448c738"
        },
        "initialChunk": "7da956",
        "terminalChunk": "27e026",
        "sessionId": 86698
      }
    },
    {
      "id": "mobile844",
      "directory": "build/person-identity-20261026-v70/mobile844-v4/",
      "layout": "mobile844",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-identity-20261026-v70/mobile844-v4/result.json",
        "bytes": 81236945,
        "sha256": "19f5a04e91f1ea0eb980fda4ba3336cf1fc1d72fdb73f6afa905c53e998a6687"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 43270,
        "sha256": "31d31ccac4cc7f6c9396fecba468b58f6c9392950e86d8f50c8523fc5d1cdb36"
      },
      "phaseCount": 33,
      "partialIdentityCount": 5,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-mobile844-initial-tool-v4.json",
          "bytes": 503,
          "sha256": "885fb5eb91c64e8b940ece152d547888fda0b0225508696da65b43757f1c2d26"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-mobile844-terminal-tool-v4.json",
          "bytes": 389,
          "sha256": "070e9e98092b4fb153a30045ea14d30e08f7e4f72f956105d43324d34e703d11"
        },
        "initialChunk": "652d83",
        "terminalChunk": "7cdabf",
        "sessionId": 93993
      }
    },
    {
      "id": "mobile667",
      "directory": "build/person-identity-20261026-v70/mobile667-v7/",
      "layout": "mobile667",
      "accepted": true,
      "credited": true,
      "result": {
        "path": "build/person-identity-20261026-v70/mobile667-v7/result.json",
        "bytes": 86041611,
        "sha256": "722286786088fec03e1f289b67bcc7beeb1e98a276b6da614f096e920bfcf646"
      },
      "runner": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 48041,
        "sha256": "9748a6dbc4bf2719cde8f528f64e7f7d4bc3f08bfbba7553035eb13ebbf695c4"
      },
      "phaseCount": 35,
      "partialIdentityCount": 5,
      "exceptionCount": 0,
      "dialogCount": 0,
      "unexpectedRequestCount": 0,
      "tool": {
        "initial": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v7.json",
          "bytes": 501,
          "sha256": "72019a533b4d376451edbda5e4e131f1808fd7eb0151d4aaa6c963a41919e3ed"
        },
        "terminal": {
          "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v7.json",
          "bytes": 389,
          "sha256": "fd4d35822ccb22ab8d2ad76948c2f44e1f34ea4d79eda361e3c9b21baf44dd5d"
        },
        "initialChunk": "2bbb67",
        "terminalChunk": "2177f7",
        "sessionId": 43651
      }
    }
  ],
  "support": [
    {
      "path": "build/person-identity-20261026-v70/before/.gitattributes",
      "bytes": 42051,
      "sha256": "8b7701bf128c6adfaf21b45fcaf37c8b18475a1bdd60550be30b7d5a2ce69e5c"
    },
    {
      "path": "build/person-identity-20261026-v70/before/package.json",
      "bytes": 21283,
      "sha256": "8f807f1d9e284cfcb69e9f4de98806c37dee9da4945af95ec32ec245d928be92"
    },
    {
      "path": "build/person-identity-20261026-v70/cancel-return-mechanical-v3.json",
      "bytes": 2209,
      "sha256": "19f54e2aeae3f14ad1f686db45bad5ebc8675add5b367a552f63248308bd0ab2"
    },
    {
      "path": "build/person-identity-20261026-v70/create-identity-runner-v1.mjs",
      "bytes": 5244,
      "sha256": "d7c4defa21af5f7c2ee6ed6104d383a01d16866341f2fa6606486e5a9a7b1025"
    },
    {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/README.md",
      "bytes": 2580,
      "sha256": "5905a1ff584ada315dd2afb50957effcf895d3aa8ae96897c0fb612f0318a79b"
    },
    {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/prepare-v1.mjs",
      "bytes": 5760,
      "sha256": "9f286351d5dac5f3a5c15bbbed2d25bf989568258c48f5d2eee48e724feee8de"
    },
    {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/publish-v1.mjs",
      "bytes": 6747,
      "sha256": "9faddc8b9a1edf338542aaeb67c5aedfd0df33396511a9e65efff9c2a90567f9"
    },
    {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/source-freeze-v1.json",
      "bytes": 2327,
      "sha256": "368cf5943ac20257a7f9f0225e77479583bbc31849ffb7079fcd85269b4529f6"
    },
    {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/source-static-peer-v1.json",
      "bytes": 8052,
      "sha256": "e60bba1d61a400f7f021d01832902aabb009e6dc907f2bea8b716b45d32add8c"
    },
    {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/v70-common-v1.mjs",
      "bytes": 45081,
      "sha256": "67901fba13978efe4a00a10bb86e24eab13cbd2aae8234fe9a4634088685a11c"
    },
    {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/v70-reader-v1.mjs",
      "bytes": 30969,
      "sha256": "eba3b1535b332f5bb712a8dd49560fd9bfea0c642a6cb28653bd89af6d3e5b08"
    },
    {
      "path": "build/person-identity-20261026-v70/fix-cancel-return-v3.mjs",
      "bytes": 2020,
      "sha256": "4e6873cd12aaffaad7f337b3b92100273b4c06fa6c59cb71e8c5f5ba70b8b10d"
    },
    {
      "path": "build/person-identity-20261026-v70/fix-mobile-controls-v5.mjs",
      "bytes": 2398,
      "sha256": "4df5e7b5da9de18d93475e63919741c9f17bb47ccdc4acdf9aa7ca555263fc0d"
    },
    {
      "path": "build/person-identity-20261026-v70/fix-mobile-entry-v4.mjs",
      "bytes": 1721,
      "sha256": "5b7408d3b92e712ffa57e1db6ea0d8857a6b59be6eb1ff1a03efbed221bd86f8"
    },
    {
      "path": "build/person-identity-20261026-v70/freeze-source-epoch-v1.mjs",
      "bytes": 3410,
      "sha256": "198aa90f3d2ac0081f1d9e6930226af756ac245229f26aa37ad715a16534cd71"
    },
    {
      "path": "build/person-identity-20261026-v70/generalize-list-gutter-v7.mjs",
      "bytes": 3043,
      "sha256": "b3798bf970a09f298e682751c1919e5a899a553548ea08f90d5de6c5258b0737"
    },
    {
      "path": "build/person-identity-20261026-v70/generalize-list-gutter-v7b.mjs",
      "bytes": 3043,
      "sha256": "30451efe325cde582815c3592420938fff4139d915a8412f353b75fc725bf26a"
    },
    {
      "path": "build/person-identity-20261026-v70/identity-smoke-source-v1.txt",
      "bytes": 12673,
      "sha256": "4858b62c35d2563b9662d7fa26ce5972baa6026c8bd39ebc913fe36f4631c0fd"
    },
    {
      "path": "build/person-identity-20261026-v70/identity-source-static-peer-v1.json",
      "bytes": 1835,
      "sha256": "21e2781b6aba25c58c54df4cc41c654bf5da02a7a73b9f4f66ba70d227e6c038"
    },
    {
      "path": "build/person-identity-20261026-v70/install-list-preview-v6.mjs",
      "bytes": 1700,
      "sha256": "10d3ac5248c28288823242ba33b74028d9b48396d9535aecb3d1540bf86592f0"
    },
    {
      "path": "build/person-identity-20261026-v70/install-map-reveal-v2.mjs",
      "bytes": 1018,
      "sha256": "e3039d850f0bead567c6bfc0b6d28876788bd0ff543a0dc5f9c0516d89e5944b"
    },
    {
      "path": "build/person-identity-20261026-v70/list-gutter-generalization-v7.json",
      "bytes": 8761,
      "sha256": "e553b08c1da4ef0d231442fbe21d51f10762963385e249fb14ee95f27141253c"
    },
    {
      "path": "build/person-identity-20261026-v70/list-preview-mechanical-v6.json",
      "bytes": 4424,
      "sha256": "77e97cb9a08cf2d325c6c9207132617c58f402a27b42b50e9bf9523dd5685745"
    },
    {
      "path": "build/person-identity-20261026-v70/list-preview-source-v6.txt",
      "bytes": 3451,
      "sha256": "ab7e53bbb8f0969c85d37dc89d52de7af9417c18056b0775568c51991efe04f0"
    },
    {
      "path": "build/person-identity-20261026-v70/list-preview-static-peer-v6.json",
      "bytes": 1456,
      "sha256": "4376fd532cc42b323028a13a87fdb6d85649fd9eebb466432a4f5c0e3e812a35"
    },
    {
      "path": "build/person-identity-20261026-v70/map-reveal-mechanical-v2.json",
      "bytes": 5637,
      "sha256": "fa50d1646d9a7c39d7c16a8fdd09a20fd6aaf66e1c8e2fc705652c1d1ad054df"
    },
    {
      "path": "build/person-identity-20261026-v70/map-reveal-source-v2.txt",
      "bytes": 4458,
      "sha256": "1fd106698df45fedac4d5b8a4af640ffc4619fc279f92adab02c3cf5f5dd2f03"
    },
    {
      "path": "build/person-identity-20261026-v70/mobile-controls-mechanical-v5.json",
      "bytes": 1668,
      "sha256": "6399937d09a120d8a0ef1f329a755ee3608bbe388a4420a2f371dcfaaf79a8f0"
    },
    {
      "path": "build/person-identity-20261026-v70/mobile-delta-static-peer-v1.json",
      "bytes": 4596,
      "sha256": "d5289deeb95b8ec60b2ea462744155d323046eda858c31d6c3fbf0311cef219c"
    },
    {
      "path": "build/person-identity-20261026-v70/mobile-entry-mechanical-v4.json",
      "bytes": 906,
      "sha256": "afffcc8e7c45a96c5fe247be16a7bfc2c61d55ccbfcf400aaec6a44aab4d45e2"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/browser-console.json",
      "bytes": 70,
      "sha256": "46568dae8c3ff6247fe1b949b4a578213e6a7e355676c582a97cf1417bf5341e"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/executed-checks.mjs",
      "bytes": 21928,
      "sha256": "c3cc11bf055e232400e3cad44743c1905b45607b1ba3b395c14cc27919d9fd24"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/executed-json.mjs",
      "bytes": 7266,
      "sha256": "3e16c26e9b963d597cfdef97b3859c01862788a77ca208d6c4579d516d1dfda5"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/executed-owned-chrome.mjs",
      "bytes": 13603,
      "sha256": "403aac41552628b1c4fbd940c0647b7f2f831d19e4fb125df5f50aa003e06761"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/executed-preview-helper.mjs",
      "bytes": 19409,
      "sha256": "ee6074a49a9377f32502c6d5d31119f0dd65f4971b1f3d3103c4e5a736ce3d0e"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/executed-rom.mjs",
      "bytes": 6532,
      "sha256": "eba3a07408bb727cea02722b1e3375f145fcae61227f407b0ed9a3d9cdcc9f4a"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/executed-tool.mjs",
      "bytes": 39185,
      "sha256": "bfabe2a23535bd9ceb2b2dfac1be307bd5f1a36ddedbcb2102ed5f64babbd28b"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/result.json",
      "bytes": 792229,
      "sha256": "96374e054ef574ab4b5b5e7e4f2829b9ce05510fbf0699d0ea755087b6245719"
    },
    {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/source-verification.json",
      "bytes": 436347,
      "sha256": "4352d37435409b50290e6a65ffb236403b32c03c64f7d69e7bde1c5550345849"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v3.json",
      "bytes": 503,
      "sha256": "6598aad08c47702d7fdf30f2f4c2237dc03bcd66c4f742682caa2738b1a2b53b"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v4.json",
      "bytes": 1440,
      "sha256": "abca3a803c3237d851d11b3ea55c3b2f45fdc320eb247d18a9e91a3db329c175"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v5.json",
      "bytes": 501,
      "sha256": "07d5136c1a9bb2bbe3bea3596791b606f3c92769739ed7c6ace7f1aa305c87d0"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v6.json",
      "bytes": 502,
      "sha256": "b58de585955737a3ad387cd7e4265b41062495de91f831f329fff02eb8f28318"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-initial-tool-v7.json",
      "bytes": 501,
      "sha256": "72019a533b4d376451edbda5e4e131f1808fd7eb0151d4aaa6c963a41919e3ed"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v3.json",
      "bytes": 886,
      "sha256": "03c3e3bd9e3eb34626c1d802e982a1da03689259885c456a00f07cda44ca7fa9"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v5.json",
      "bytes": 1072,
      "sha256": "e711840a78893a90a24615ba7230f593abd8713f345722545d3c069a4bd3bc8e"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v6.json",
      "bytes": 1086,
      "sha256": "d4679f97c0c0573aec10cb2108dbe92b6f664903b1af31e96c9f53efd75cad83"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile667-terminal-tool-v7.json",
      "bytes": 389,
      "sha256": "fd4d35822ccb22ab8d2ad76948c2f44e1f34ea4d79eda361e3c9b21baf44dd5d"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile844-initial-tool-v3.json",
      "bytes": 500,
      "sha256": "9402b9c1c86600c0d12a8b1729d0847aee27896018bf3b26aa9d7ea73d6fd91a"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile844-initial-tool-v4.json",
      "bytes": 503,
      "sha256": "885fb5eb91c64e8b940ece152d547888fda0b0225508696da65b43757f1c2d26"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile844-intermediate-tool-v3.json",
      "bytes": 624,
      "sha256": "1499f487d9d94dae18305db275f8bd8946c09c38183d6fbb643d886730eb8c62"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile844-terminal-tool-v3.json",
      "bytes": 391,
      "sha256": "c1899c2144cad1952bdb76c559495dfdc807a56fe6f969b89a88874737bf0ee1"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-mobile844-terminal-tool-v4.json",
      "bytes": 389,
      "sha256": "070e9e98092b4fb153a30045ea14d30e08f7e4f72f956105d43324d34e703d11"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-pc1080-initial-tool-v3.json",
      "bytes": 498,
      "sha256": "4534dc3c22bd384214264d6aa3a10b44c0f44d45501e8e7e89ae4db6600baa2c"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-pc1080-terminal-tool-v3.json",
      "bytes": 386,
      "sha256": "7fbbb86afad8c97e1a367f0e34b03183c7ce06d5244a4c054c891c6971c61767"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-pc720-initial-tool-v1.json",
      "bytes": 1136,
      "sha256": "248e56516b23ae4267df74d4cfb9ff1ba2e791a7155c7cf908d9915d5791119b"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-pc720-initial-tool-v2.json",
      "bytes": 499,
      "sha256": "41faeaad1a3d2f1c101c3669cdfeeeda1f2f5e568bd57fd0918dd50b31f61144"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-pc720-initial-tool-v3.json",
      "bytes": 496,
      "sha256": "f4e82db1485f5b93f23f94142643af48db3a72ba1d10dbe7e7de7e6bde480349"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-pc720-terminal-tool-v2.json",
      "bytes": 1059,
      "sha256": "65c1a5470b6606fc58de5a6a223ca949ea1eb6ac28e556560b34de5463518bb3"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-pc720-terminal-tool-v3.json",
      "bytes": 385,
      "sha256": "e730330bf96e270f62a7b05baecfa48a0ac4e03e8d4c63417d4e79e8d448c738"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-preflight-terminal-tool-v1.json",
      "bytes": 490,
      "sha256": "eb45e4929cdbd154a92314a20f9f2e63a7d11bbaeb694890f69fc27ef4a4261f"
    },
    {
      "path": "build/person-identity-20261026-v70/raw-prepare-initial-tool-v1.json",
      "bytes": 1416,
      "sha256": "24d4bc8cdc3a0f6823b9a5c5996263be74382e0be06a17af27201205ec77029b"
    },
    {
      "path": "build/person-identity-20261026-v70/rom-audit-v1.json",
      "bytes": 4319,
      "sha256": "0fb8395a074d4c36f56bf986869ab60ba367c6c0d82a1bb5a406c064e6e9ad2f"
    },
    {
      "path": "build/person-identity-20261026-v70/runner-construction-v1.json",
      "bytes": 5422,
      "sha256": "2694b23579cd9a065a3f8ad30db7ad586cbc73e4b73ff89a24f044038a49b0e9"
    },
    {
      "path": "build/person-identity-20261026-v70/source-epoch-v1.json",
      "bytes": 27470,
      "sha256": "af86c627c66d230c982195ffca7f562c51cd9f9d8c1ee7a16c2a513e25f3f95e"
    },
    {
      "path": "build/person-identity-20261026-v70/source-epoch-v2.json",
      "bytes": 27876,
      "sha256": "5a012a63b53145a4ee2b26f763d76dc9a1a0be92970161e051842b3d7a74b9c1"
    },
    {
      "path": "build/person-identity-20261026-v70/source-epoch-v3.json",
      "bytes": 28090,
      "sha256": "99134f2d55521dd6ecfedf109c4e2d8a789944a67a9d2c539cf60aaca7f34a80"
    },
    {
      "path": "build/person-identity-20261026-v70/source-epoch-v4.json",
      "bytes": 28301,
      "sha256": "8d5f49b4e4318fb92d979a9dc89f167276218a417e08e9731f6543a28baff82f"
    },
    {
      "path": "build/person-identity-20261026-v70/source-epoch-v5.json",
      "bytes": 28522,
      "sha256": "c2558a72355ebd4c00e31d4755a414d51abafcaa591e684366d0c95a6f5d2f7a"
    },
    {
      "path": "build/person-identity-20261026-v70/source-epoch-v6.json",
      "bytes": 28734,
      "sha256": "82c4b84568ed6098b5b9a2812c3db1a78ce02bf27f7a5217d375d6b74bca420d"
    },
    {
      "path": "build/person-identity-20261026-v70/source-epoch-v7.json",
      "bytes": 28956,
      "sha256": "f3d8f2942eacfeddec30f7c0192901c31df957524cd6ef8c2cf8d3cd7f0f7811"
    },
    {
      "path": "build/person-identity-20261026-v70/stage-delivery-v1.mjs",
      "bytes": 2918,
      "sha256": "b54ed3913a9259b00864148f7bb8960732ffa14e71e58e22b23980b657fbebb8"
    },
    {
      "path": "build/person-identity-20261026-v70/verify-git-delivery-v1.mjs",
      "bytes": 4716,
      "sha256": "56c4445a63940deb5a251693c56a7e18572f9843b23c91d6c30cd848030e59af"
    },
    {
      "path": "docs/validation/m5-native-input-queue-20261026-v69.json",
      "bytes": 218414,
      "sha256": "65fc937fcd2e1ba5ace6f1f0daa644fc56eba8463caf2fb0cf94005dae18b971"
    },
    {
      "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
      "bytes": 32262,
      "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
    }
  ],
  "oldHelper": {
    "path": "build/person-identity-20261026-v70/preflight-pc720-v1/executed-checks.mjs",
    "bytes": 21928,
    "sha256": "c3cc11bf055e232400e3cad44743c1905b45607b1ba3b395c14cc27919d9fd24"
  },
  "preflight": {
    "result": {
      "path": "build/person-identity-20261026-v70/preflight-pc720-v1/result.json",
      "bytes": 792229,
      "sha256": "96374e054ef574ab4b5b5e7e4f2829b9ce05510fbf0699d0ea755087b6245719"
    },
    "tool": {
      "path": "build/person-identity-20261026-v70/raw-preflight-terminal-tool-v1.json",
      "bytes": 490,
      "sha256": "eb45e4929cdbd154a92314a20f9f2e63a7d11bbaeb694890f69fc27ef4a4261f"
    }
  },
  "repairs": [
    {
      "receipt": {
        "path": "build/person-identity-20261026-v70/map-reveal-mechanical-v2.json",
        "bytes": 5637,
        "sha256": "fa50d1646d9a7c39d7c16a8fdd09a20fd6aaf66e1c8e2fc705652c1d1ad054df"
      },
      "before": {
        "path": "build/person-identity-20261026-v70/pc720-v1/executed-tool.mjs",
        "bytes": 39185,
        "sha256": "bfabe2a23535bd9ceb2b2dfac1be307bd5f1a36ddedbcb2102ed5f64babbd28b"
      },
      "after": {
        "path": "build/person-identity-20261026-v70/pc720-v2/executed-tool.mjs",
        "bytes": 43019,
        "sha256": "feadcde9f8017124eab531becd22b218731025cd296a255943aa901f2d9b6315"
      },
      "scope": "controller-navigation"
    },
    {
      "receipt": {
        "path": "build/person-identity-20261026-v70/cancel-return-mechanical-v3.json",
        "bytes": 2209,
        "sha256": "19f54e2aeae3f14ad1f686db45bad5ebc8675add5b367a552f63248308bd0ab2"
      },
      "before": {
        "path": "build/person-identity-20261026-v70/pc720-v2/executed-tool.mjs",
        "bytes": 43019,
        "sha256": "feadcde9f8017124eab531becd22b218731025cd296a255943aa901f2d9b6315"
      },
      "after": {
        "path": "build/person-identity-20261026-v70/pc1080-v3/executed-tool.mjs",
        "bytes": 43241,
        "sha256": "4836e07757f3bd86d762a4f18a12a5ee13a7802e6b7d40dfa4a2b2ac661aab2c"
      },
      "scope": "controller-navigation"
    },
    {
      "receipt": {
        "path": "build/person-identity-20261026-v70/mobile-entry-mechanical-v4.json",
        "bytes": 906,
        "sha256": "afffcc8e7c45a96c5fe247be16a7bfc2c61d55ccbfcf400aaec6a44aab4d45e2"
      },
      "before": {
        "path": "build/person-identity-20261026-v70/pc1080-v3/executed-tool.mjs",
        "bytes": 43241,
        "sha256": "4836e07757f3bd86d762a4f18a12a5ee13a7802e6b7d40dfa4a2b2ac661aab2c"
      },
      "after": {
        "path": "build/person-identity-20261026-v70/mobile844-v4/executed-tool.mjs",
        "bytes": 43270,
        "sha256": "31d31ccac4cc7f6c9396fecba468b58f6c9392950e86d8f50c8523fc5d1cdb36"
      },
      "scope": "mobile-only",
      "pcGuard": "pcBranchUnchanged"
    },
    {
      "receipt": {
        "path": "build/person-identity-20261026-v70/mobile-controls-mechanical-v5.json",
        "bytes": 1668,
        "sha256": "6399937d09a120d8a0ef1f329a755ee3608bbe388a4420a2f371dcfaaf79a8f0"
      },
      "before": {
        "path": "build/person-identity-20261026-v70/mobile844-v4/executed-tool.mjs",
        "bytes": 43270,
        "sha256": "31d31ccac4cc7f6c9396fecba468b58f6c9392950e86d8f50c8523fc5d1cdb36"
      },
      "after": {
        "path": "build/person-identity-20261026-v70/mobile667-v5/executed-tool.mjs",
        "bytes": 44027,
        "sha256": "a9d89c2dd848116c5e87fbd280eefe20a9502f800410cf1151e0a23bac5379a2"
      },
      "scope": "mobile-only",
      "pcGuard": "pcBranchUnchanged"
    },
    {
      "receipt": {
        "path": "build/person-identity-20261026-v70/list-preview-mechanical-v6.json",
        "bytes": 4424,
        "sha256": "77e97cb9a08cf2d325c6c9207132617c58f402a27b42b50e9bf9523dd5685745"
      },
      "before": {
        "path": "build/person-identity-20261026-v70/mobile667-v5/executed-tool.mjs",
        "bytes": 44027,
        "sha256": "a9d89c2dd848116c5e87fbd280eefe20a9502f800410cf1151e0a23bac5379a2"
      },
      "after": {
        "path": "build/person-identity-20261026-v70/mobile667-v6/executed-tool.mjs",
        "bytes": 47384,
        "sha256": "d8ae2bc5433f6194481524d5d6c4d06388d788a43878e74a497b67a784f633a2"
      },
      "scope": "mobile-only",
      "pcGuard": "pcBranchUnchanged"
    },
    {
      "receipt": {
        "path": "build/person-identity-20261026-v70/list-gutter-generalization-v7.json",
        "bytes": 8761,
        "sha256": "e553b08c1da4ef0d231442fbe21d51f10762963385e249fb14ee95f27141253c"
      },
      "before": {
        "path": "build/person-identity-20261026-v70/mobile667-v6/executed-tool.mjs",
        "bytes": 47384,
        "sha256": "d8ae2bc5433f6194481524d5d6c4d06388d788a43878e74a497b67a784f633a2"
      },
      "after": {
        "path": "scripts/test-hd-person-identity-runtime.mjs",
        "bytes": 48041,
        "sha256": "9748a6dbc4bf2719cde8f528f64e7f7d4bc3f08bfbba7553035eb13ebbf695c4"
      },
      "scope": "mobile-only",
      "pcGuard": "pcGamePathUnchanged"
    }
  ],
  "inventoryCritical": {
    "currentCount": 156,
    "runtimeIntersectionCount": 145,
    "notInRuntimeCount": 11,
    "notInRuntimePaths": [
      "designer.html",
      "hd-portrait-dump.html",
      "m-ges.html",
      "m-ktouch.html",
      "m-old.html",
      "scripts/hd-city-resource-runtime-checks.mjs",
      "scripts/hd-person-equipment-runtime-checks.mjs",
      "scripts/test-hd-city-hud.mjs",
      "scripts/test-hd-mobile-city-runtime.mjs",
      "scripts/test-hd-native-sem.mjs",
      "scripts/test-hd-person-equipment-runtime.mjs"
    ]
  },
  "priorPrepareFailure": {
    "capture": {
      "path": "build/person-identity-20261026-v70/raw-prepare-initial-tool-v1.json",
      "bytes": 1416,
      "sha256": "24d4bc8cdc3a0f6823b9a5c5996263be74382e0be06a17af27201205ec77029b"
    },
    "chunk": "36b3b4",
    "exitCode": 1,
    "sources": [
      {
        "path": "build/person-identity-20261026-v70/evidence-source-v1/v70-common-v1.mjs",
        "bytes": 45081,
        "sha256": "67901fba13978efe4a00a10bb86e24eab13cbd2aae8234fe9a4634088685a11c"
      },
      {
        "path": "build/person-identity-20261026-v70/evidence-source-v1/v70-reader-v1.mjs",
        "bytes": 30969,
        "sha256": "eba3b1535b332f5bb712a8dd49560fd9bfea0c642a6cb28653bd89af6d3e5b08"
      },
      {
        "path": "build/person-identity-20261026-v70/evidence-source-v1/prepare-v1.mjs",
        "bytes": 5760,
        "sha256": "9f286351d5dac5f3a5c15bbbed2d25bf989568258c48f5d2eee48e724feee8de"
      },
      {
        "path": "build/person-identity-20261026-v70/evidence-source-v1/publish-v1.mjs",
        "bytes": 6747,
        "sha256": "9faddc8b9a1edf338542aaeb67c5aedfd0df33396511a9e65efff9c2a90567f9"
      },
      {
        "path": "build/person-identity-20261026-v70/evidence-source-v1/README.md",
        "bytes": 2580,
        "sha256": "5905a1ff584ada315dd2afb50957effcf895d3aa8ae96897c0fb612f0318a79b"
      }
    ],
    "freeze": {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/source-freeze-v1.json",
      "bytes": 2327,
      "sha256": "368cf5943ac20257a7f9f0225e77479583bbc31849ffb7079fcd85269b4529f6"
    },
    "peer": {
      "path": "build/person-identity-20261026-v70/evidence-source-v1/source-static-peer-v1.json",
      "bytes": 8052,
      "sha256": "e60bba1d61a400f7f021d01832902aabb009e6dc907f2bea8b716b45d32add8c"
    },
    "outputsCreated": false
  }
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
export const publicModule = name => name==='v70-reader-v1.mjs'?PREFIX+'-verify.mjs':PREFIX+'-'+name;
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
