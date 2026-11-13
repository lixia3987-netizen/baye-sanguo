/** Read-only source-evidence verifier. Original CLOSED byte pins and complete
 * literal tool terminals are immutable. No candidate/helper/test module runs. */
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {isDeepStrictEqual} from 'node:util';
import {decodeV45Archive,v45Pin,V45_BOUNDS} from './m5-quantity-ack-refresh-20261024-v45-verify.mjs';
export const V66_BUILD='build/impact-skill-20261014/',V66_TOOLS=V66_BUILD+'v66-source-publication/',V66_PREFIX='docs/validation/m5-city4-close-diagnostics-20261026-v66';
export const V66_READER=V66_TOOLS+'v66-close-diagnostics-reader-v2.mjs',V66_PUBLISHER=V66_TOOLS+'publish-v66-close-diagnostics-v2.mjs',V66_BINDINGS=V66_BUILD+'v66-close-diagnostics-bindings-v1.json',V66_PEER=V66_BUILD+'v66-source-publication-static-peer-v1.json';
export const V66_LOCKS={
  "schemaVersion": 1,
  "draftOnly": false,
  "parentCommit": "3f803e39cc6155cbf18aaf5554b71cc43af7c4b1",
  "epoch": {
    "path": "build/impact-skill-20261014/v66-pre-integration-source-epoch-v1/source-epoch-v1.json",
    "bytes": 2664,
    "sha256": "a83363c87a2e6164ad9118e4842027f20c5b5ab9b1b4dc13b65e54338f522a36"
  },
  "epochTerminal": {
    "closed": true,
    "terminalChunk": "4d963b",
    "exitCode": 0
  },
  "old": [
    {
      "source": "scripts/hd-wood-city4-hd-action.mjs",
      "path": "build/impact-skill-20261014/v66-pre-integration-source-epoch-v1/hd-wood-city4-hd-action.mjs",
      "bytes": 56045,
      "sha256": "c9ec6de5f4a59d2674c592d9e8bfdaaab8d79f5ba470e73c4bd42a0a30e01ac8"
    },
    {
      "source": ".gitattributes",
      "path": "build/impact-skill-20261014/v66-pre-integration-source-epoch-v1/gitattributes",
      "bytes": 39323,
      "sha256": "e98af0333917bc4545ec8d3074dfbed3229143cf1ccedce7daca53a4dd78a69d"
    }
  ],
  "unchanged": [
    {
      "path": "scripts/hd-wood-city4-observer-transition.mjs",
      "bytes": 44730,
      "sha256": "0cf464ba123981dc69f91a53a2e85340d51973a24d0576d209f7a499ca248940"
    },
    {
      "path": "scripts/hd-wood-city4-first-own.mjs",
      "bytes": 15711,
      "sha256": "aee024367957496800db099fbdc3b6bce55e5e3b5d09550be709c63e4783e624"
    },
    {
      "path": "scripts/test-hd-wood-city4-hd-action.mjs",
      "bytes": 2284,
      "sha256": "2261a0904b61a9905e2d028c7191a81180ae5304468b733babe80ef8edf32f8b"
    },
    {
      "path": "package.json",
      "bytes": 21183,
      "sha256": "809fd447dd1177d6af707c189c4a0408011c1bfe5a78816012a21a09bc7a140d"
    }
  ],
  "attributeSuffix": "\n/scripts/hd-wood-city4-battle-close.mjs text eol=lf\n/docs/validation/m5-city4-held-round-20261026-v65*.json -text whitespace=cr-at-eol\n/docs/validation/m5-city4-held-round-20261026-v65*.mjs -text whitespace=cr-at-eol\n/docs/validation/m5-city4-held-round-20261026-v65*.md -text whitespace=cr-at-eol\n/docs/validation/m5-city4-held-round-20261026-v65*.gz -text\n/docs/validation/m5-city4-held-round-20261026-v65*.sav -text\n/docs/validation/m5-city4-held-round-20261026-v65*.png -text\n/docs/validation/m5-city4-close-diagnostics-20261026-v66*.json -text whitespace=cr-at-eol\n/docs/validation/m5-city4-close-diagnostics-20261026-v66*.mjs -text whitespace=cr-at-eol\n/docs/validation/m5-city4-close-diagnostics-20261026-v66*.md -text whitespace=cr-at-eol\n/docs/validation/m5-city4-close-diagnostics-20261026-v66*.gz -text\n/docs/validation/m5-city4-close-diagnostics-20261026-v66*.sav -text\n/docs/validation/m5-city4-close-diagnostics-20261026-v66*.png -text\n",
  "formalFinal": [
    {
      "path": "scripts/hd-wood-city4-hd-action.mjs",
      "bytes": 57177,
      "sha256": "c678877d9382ddd3a3c5ec43b37b23a463e34553779d80b8fab50b4f6be22264"
    },
    {
      "path": "scripts/hd-wood-city4-battle-close.mjs",
      "bytes": 41069,
      "sha256": "4809003bf5f7cd00cd652b31b0be7e69c18069d73094735595d3e3f3dda6f77d"
    },
    {
      "path": ".gitattributes",
      "bytes": 40274,
      "sha256": "1d93ac0f77f69c1de1ddd3253236bf6ceb50965af78235bd9571d153671665ca"
    }
  ],
  "actionManifest": {
    "path": "build/impact-skill-20261014/city4-formal-runtime-preparation-v4/source-replacement-manifest-v1.json",
    "bytes": 8608,
    "sha256": "26a6194a408ff7557b74185162562880d016aa8f383cf5cd4b7c2b74d471a316"
  },
  "closeManifest": {
    "path": "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/source-replacement-manifest-v1.json",
    "bytes": 3710,
    "sha256": "30b5f3b9239e40bc12f9d27a4c149255d1e03f4652d64cc7efc70631e7773101"
  },
  "eligibility": {
    "path": "build/impact-skill-20261014/v65-eligibility-controls-v1.json",
    "bytes": 130899,
    "sha256": "7199ad089ef8b760ec75997b3c7299bc5f73d7a381d333a946c60b6ba38d9f41"
  },
  "eligibilityTerminal": {
    "closed": true,
    "sessionId": 52232,
    "initialChunk": "4c052c",
    "terminalChunk": "0ff610",
    "exitCode": 0
  },
  "parentBaseline": {
    "canonical": {
      "path": "docs/validation/m5-city4-strong-flow-20261026-v64.json",
      "bytes": 292328,
      "sha256": "22dd0801c89a6398f67b646ef1caf67955a69fb363878a563a4584a2d4146186"
    },
    "kind": "saved-parent-record-only",
    "savedDefaultTests": 7905,
    "savedRegisteredFiles": 149,
    "newCodeFullRun": false,
    "newCodeFullAccepted": false,
    "rawParentFullFourArchived": false,
    "parentPublishedArchiveRepacked": false
  },
  "mainPins": [
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57.json",
      "bytes": 379062,
      "sha256": "70949f4f2edb9b4564e37b151add6e551d7cb3f010d6a8ccb70a387847c59f1a"
    },
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57-latest-world.json",
      "bytes": 148004,
      "sha256": "58f8ac8d6366c09023a834995bde26bd0973e32a1b12292d463f1644b983c1f6"
    },
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57-sango0.sav",
      "bytes": 8221,
      "sha256": "122a72b600bbee49d734f0420731b7be7895af0eaf222741f6daee6eaae09d2b"
    },
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57-sango1.sav",
      "bytes": 4840,
      "sha256": "f3b6f39a2433f88abaef52e921c65e7d607d6752620762927f2b542f74f27353"
    },
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57-archive-index.json",
      "bytes": 151295,
      "sha256": "6f072b12b1e4ac75c8b818497536e3bffd69f23cb6e7cf4bc9371aab500c857a"
    },
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57-archive-part001.json",
      "bytes": 8142224,
      "sha256": "8357cab4cb1ee68aa3d8c06f8df3b4ed6811ded199e49185324e53593eafe94b"
    },
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57-archive-part002.json",
      "bytes": 8377587,
      "sha256": "d348517c680ec688f5f1cbe5d5507087b21fdfc0bb6a17064cdf2ec25e61efb8"
    },
    {
      "path": "docs/validation/m5-wood-city4-recovery-20261024-v57-archive-part003.json",
      "bytes": 2359629,
      "sha256": "5ef83127046a14c813b301096bc354a83835cf94e9db0908192f077da612448b"
    },
    {
      "path": "libs/dat-mod.lib",
      "bytes": 207195,
      "sha256": "3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e"
    }
  ],
  "codec": {
    "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
    "bytes": 32262,
    "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
  },
  "fixedMaterial": [
    {
      "path": "build/impact-skill-20261014/city4-formal-runtime-preparation-v4/source-replacement-manifest-v1.json",
      "bytes": 8608,
      "sha256": "26a6194a408ff7557b74185162562880d016aa8f383cf5cd4b7c2b74d471a316"
    },
    {
      "path": "build/impact-skill-20261014/city4-formal-runtime-preparation-v4/source-inverse-v1.json",
      "bytes": 1449,
      "sha256": "0d72536842f12e5690658859c0b23fbd5d38ce238588f49fcb2e9033a9fb61e9"
    },
    {
      "path": "build/impact-skill-20261014/city4-formal-runtime-preparation-v4/source-preparation-v1.json",
      "bytes": 3904,
      "sha256": "e2cd07a036ce119d19fad74c8c704fcecbf8ab48687add0fd40975f8d8739633"
    },
    {
      "path": "build/impact-skill-20261014/city4-hd-wood-action-candidate-v7/mechanical-single-hunk-inverse-v1.json",
      "bytes": 2816,
      "sha256": "c7e2155d164988e607fb3948399ffea31f482632082c93565ceee8d4737be5da"
    },
    {
      "path": "build/impact-skill-20261014/v65-action7-source-review-v1.json",
      "bytes": 1705,
      "sha256": "51fcb348d73bf462f507b4ca98cb0c9c1ede788efda36d821484dc1e234e0e71"
    },
    {
      "path": "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/source-replacement-manifest-v1.json",
      "bytes": 3710,
      "sha256": "30b5f3b9239e40bc12f9d27a4c149255d1e03f4652d64cc7efc70631e7773101"
    },
    {
      "path": "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/source-inverse-v1.json",
      "bytes": 1940,
      "sha256": "c6bb194d14f7c307738ec1b0b0b45134210619ee31f933c231a84342c3f766f7"
    },
    {
      "path": "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/source-preparation-v1.json",
      "bytes": 4002,
      "sha256": "0f8e6bde2e03f1337d00cc725d4dc3c99093cb33d59e8d9091189fdf9c326e12"
    },
    {
      "path": "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/test-formal-city4-battle-close-data-v1.mjs",
      "bytes": 2675,
      "sha256": "9ac2241a0a295b669642c4fa33b177576fb9bdb03eb2219fc68ad6dcdee5c528"
    },
    {
      "path": "build/impact-skill-20261014/city4-end-battle-close-candidate-v6/mechanical-close6-inverse-v2.json",
      "bytes": 17636,
      "sha256": "f2965bd515db46936be449835d984a78d5eb8bc50b0092bad04cebb8d2223e89"
    },
    {
      "path": "build/impact-skill-20261014/city4-end-battle-close-candidate-v6/source-preparation-v2.json",
      "bytes": 7509,
      "sha256": "f3d1f74ca07f366273b4b1b97731a009ef90ca7876a3d676e11f031d6516309b"
    },
    {
      "path": "build/impact-skill-20261014/v65-close6-source-review-v2.json",
      "bytes": 3296,
      "sha256": "6093349c9b51163262dfd3f1960ffe00654bfcfcfa8b6a19210c72cff8f71e31"
    },
    {
      "path": "build/impact-skill-20261014/v65-close5-actual-failure-analysis-v1.json",
      "bytes": 27411,
      "sha256": "f75911dd742fe18e08b5283581cfe099f5461fd868d35928ebd4a8a2fb828446"
    },
    {
      "path": "build/impact-skill-20261014/v65-close5-actual-failure-analysis-v1.md",
      "bytes": 2833,
      "sha256": "78467f8e45a90c7ca4d06a8ab9aaa255b254df78046bbd6cd119a1e7487b74ff"
    },
    {
      "path": "build/impact-skill-20261014/v65-close5-system-contract-crosscheck-v1.json",
      "bytes": 10421,
      "sha256": "c36c4a9df244266c09ed020d2458601ac228cc5bc1f828b213e7ae0e82caea82"
    },
    {
      "path": "build/impact-skill-20261014/run-v65-eligibility-controls-v1.mjs",
      "bytes": 3352,
      "sha256": "bd52a6581df48ade9938344d99b6ac33cffcf8e20e92b6dfb703e0ecbd11f872"
    },
    {
      "path": "build/impact-skill-20261014/run-v65-close6-controls-v1.mjs",
      "bytes": 3890,
      "sha256": "7aaa2821f3597f4a3b71ea8fefdaf7ae66982c13a32b924ab031630c6b7a2d51"
    },
    {
      "path": "build/impact-skill-20261014/snapshot-v66-source-epoch-v1.mjs",
      "bytes": 2505,
      "sha256": "ec841a5c412a226c49eeacb48a110f10064df1a45b3b67c280736a4e9524bd42"
    },
    {
      "path": "build/impact-skill-20261014/v66-formal-runtime-preparation-v1/source-replacement-manifest-v1.json",
      "bytes": 5461,
      "sha256": "ab66d89e440f92655eb84bd1f2990291d2790ed6054ab1bd6d0d7533da3f843c"
    },
    {
      "path": "build/impact-skill-20261014/integrate-v66-runtime-v1.mjs",
      "bytes": 4668,
      "sha256": "5915078ae684ded9b51a1b84c7adcde4ae051ff2d3311a31cca63a01249ef600"
    },
    {
      "path": "build/impact-skill-20261014/run-v66-formal-runtime-checks-v1.mjs",
      "bytes": 3623,
      "sha256": "0cdcf065565fa6dff27381bf9ac56fc0f41ccd1ef85d2ddd8db6dfadc935dafb"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/city4-normal-round-host-v4.mjs",
      "bytes": 17193,
      "sha256": "b21c6e24555f16c356c2554badf564e891d34366d8d937b1f01d52978bcb721d"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/fixed-node-dependencies-v4.json",
      "bytes": 9356,
      "sha256": "c616dfa8dcac69825461c21c4e20bacfc3eb0f8b5feb0b138f02ce1857a0d065"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/city4-normal-round-cli-v4.mjs",
      "bytes": 7653,
      "sha256": "f8f0d9b3f80e7061d385bf0c732614bd00a6b5e89732bf538c8ff2a952302ba9"
    },
    {
      "path": "build/impact-skill-20261014/v66-normal-host4-static-peer-v1.json",
      "bytes": 33191,
      "sha256": "976668534499c5392f76198d7cf16aefc67f3a2054afb43533880e44ad0afd41"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/mechanical-host3-inverse-v1.json",
      "bytes": 3373,
      "sha256": "206575744ba4fdb0c08b0acb31ad4015c88a3183f8f47eaf600c97050cf54967"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/mechanical-manifest3-inverse-v1.json",
      "bytes": 2637,
      "sha256": "779a63042279e8cb155f32a56cc3dc587c08f3477f9a18c0071797f1f0070e1f"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/mechanical-cli3-inverse-v1.json",
      "bytes": 2868,
      "sha256": "50ae177b6391b2762e8c2a802d4250bf0a7abd04a9d9da582a00425c6da22889"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/source-preparation-v1.json",
      "bytes": 3783,
      "sha256": "0cdce00d9d56fa53c3f964fdeff798854b5929e7e65547620ac8d33ff671787f"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/source-preparation-v1.json",
      "bytes": 2772,
      "sha256": "3d1bb0b80cbdc2a68c1ee0d8d8f890930b56b4c544612550a6569f2ee0f3affb"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/fixed-module-closure-source-proof-v1.json",
      "bytes": 18032,
      "sha256": "e85d173b65bcccd4cc91665ce568039d50649941c04d7c0eeeb379da303d7f72"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v3/city4-normal-round-host-v3.mjs",
      "bytes": 17193,
      "sha256": "5528d39df7fdedfd2ed8bac0cacfcde6f9b224d99c78280ea508c8741a6b930f"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v3/fixed-node-dependencies-v3.json",
      "bytes": 9356,
      "sha256": "332562c0aee349d99fdf65225ec70142db62cbcf61dc3df69c03c9883bac8751"
    },
    {
      "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v3/city4-normal-round-cli-v3.mjs",
      "bytes": 7653,
      "sha256": "f30264e33697bf842aa43cb4b799db902913c1eee975dac3ca370b27b896ac04"
    },
    {
      "path": "build/impact-skill-20261014/v66-source-publication/v66-close-diagnostics-reader-draft-v1.mjs",
      "bytes": 31391,
      "sha256": "904e5acea9b22eabf398b6912de82ea488b0e1ebdb01b456188c1cb75bc92b3c"
    },
    {
      "path": "build/impact-skill-20261014/v66-source-publication/publish-v66-close-diagnostics-draft-v1.mjs",
      "bytes": 9604,
      "sha256": "f90f1e6a67009b780f498be72820ba9f18db50a87e471e260e971013ae215825"
    },
    {
      "path": "build/impact-skill-20261014/v66-source-publication/source-draft-v1.json",
      "bytes": 10495,
      "sha256": "9e26a5bc7e2641aef12effe5c6628b6b9e24e6b937f81d2d89d156203178cb77"
    }
  ],
  "requiredSupport": [
    "build/impact-skill-20261014/city4-formal-runtime-preparation-v4/source-replacement-manifest-v1.json",
    "build/impact-skill-20261014/city4-formal-runtime-preparation-v4/source-inverse-v1.json",
    "build/impact-skill-20261014/city4-formal-runtime-preparation-v4/source-preparation-v1.json",
    "build/impact-skill-20261014/city4-hd-wood-action-candidate-v7/mechanical-single-hunk-inverse-v1.json",
    "build/impact-skill-20261014/v65-action7-source-review-v1.json",
    "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/source-replacement-manifest-v1.json",
    "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/source-inverse-v1.json",
    "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/source-preparation-v1.json",
    "build/impact-skill-20261014/city4-formal-battle-close-preparation-v1/test-formal-city4-battle-close-data-v1.mjs",
    "build/impact-skill-20261014/city4-end-battle-close-candidate-v6/mechanical-close6-inverse-v2.json",
    "build/impact-skill-20261014/city4-end-battle-close-candidate-v6/source-preparation-v2.json",
    "build/impact-skill-20261014/v65-close6-source-review-v2.json",
    "build/impact-skill-20261014/v65-close5-actual-failure-analysis-v1.json",
    "build/impact-skill-20261014/v65-close5-actual-failure-analysis-v1.md",
    "build/impact-skill-20261014/v65-close5-system-contract-crosscheck-v1.json",
    "build/impact-skill-20261014/run-v65-eligibility-controls-v1.mjs",
    "build/impact-skill-20261014/run-v65-close6-controls-v1.mjs",
    "build/impact-skill-20261014/snapshot-v66-source-epoch-v1.mjs",
    "build/impact-skill-20261014/v66-source-publication-static-peer-v1.json",
    "build/impact-skill-20261014/integrate-v66-runtime-v1.mjs",
    "build/impact-skill-20261014/run-v66-formal-runtime-checks-v1.mjs",
    "build/impact-skill-20261014/v66-formal-runtime-preparation-v1/source-replacement-manifest-v1.json",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/city4-normal-round-host-v4.mjs",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/fixed-node-dependencies-v4.json",
    "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/city4-normal-round-cli-v4.mjs",
    "build/impact-skill-20261014/v66-normal-host4-static-peer-v1.json",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/mechanical-host3-inverse-v1.json",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/mechanical-manifest3-inverse-v1.json",
    "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/mechanical-cli3-inverse-v1.json",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/source-preparation-v1.json",
    "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/source-preparation-v1.json",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/fixed-module-closure-source-proof-v1.json",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v3/city4-normal-round-host-v3.mjs",
    "build/impact-skill-20261014/city4-normal-round-host-candidate-v3/fixed-node-dependencies-v3.json",
    "build/impact-skill-20261014/city4-normal-round-cli-candidate-v3/city4-normal-round-cli-v3.mjs",
    "build/impact-skill-20261014/v66-source-publication/v66-close-diagnostics-reader-draft-v1.mjs",
    "build/impact-skill-20261014/v66-source-publication/publish-v66-close-diagnostics-draft-v1.mjs",
    "build/impact-skill-20261014/v66-source-publication/source-draft-v1.json",
    "build/impact-skill-20261014/v66-source-publication/source-preparation-v2.json",
    "build/impact-skill-20261014/v66-source-publication/source-final-inverse-v2.json",
    "build/impact-skill-20261014/v66-source-publication/finalize-v66-publication-sources-v2.cjs"
  ],
  "actualRoot": "build/impact-skill-20261014/city4-owned-normal-round-20261026-v3/",
  "actualSystemTicket": {
    "path": "build/impact-skill-20261014/city4-owned-normal-round-20261026-v3/host-evidence/battle-close-ticket-c35d6b8e2bdb62d539e17675e01d42c2c5849acb7e55a883ead57c23682d1dd2.json",
    "bytes": 91634,
    "sha256": "c35d6b8e2bdb62d539e17675e01d42c2c5849acb7e55a883ead57c23682d1dd2"
  },
  "copiedSystemTicket": {
    "path": "build/impact-skill-20261014/city4-end-battle-close-controls-candidate-v6/fixtures/actual-system-ticket-v1.json",
    "bytes": 91634,
    "sha256": "c35d6b8e2bdb62d539e17675e01d42c2c5849acb7e55a883ead57c23682d1dd2"
  },
  "forbiddenParentRaw": [
    "build/impact-skill-20261014/v63-read-flow-full-v1.json",
    "build/impact-skill-20261014/v63-read-flow-full-v1.stdout.tap",
    "build/impact-skill-20261014/v63-read-flow-full-v1.stderr.log",
    "build/impact-skill-20261014/v63-read-flow-full-v1-before.json"
  ],
  "combinedManifest": {
    "path": "build/impact-skill-20261014/v66-formal-runtime-preparation-v1/source-replacement-manifest-v1.json",
    "bytes": 5461,
    "sha256": "ab66d89e440f92655eb84bd1f2990291d2790ed6054ab1bd6d0d7533da3f843c"
  },
  "futureComposition": {
    "host": {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/city4-normal-round-host-v4.mjs",
      "bytes": 17193,
      "sha256": "b21c6e24555f16c356c2554badf564e891d34366d8d937b1f01d52978bcb721d"
    },
    "manifest": {
      "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/fixed-node-dependencies-v4.json",
      "bytes": 9356,
      "sha256": "c616dfa8dcac69825461c21c4e20bacfc3eb0f8b5feb0b138f02ce1857a0d065"
    },
    "cli": {
      "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/city4-normal-round-cli-v4.mjs",
      "bytes": 7653,
      "sha256": "f8f0d9b3f80e7061d385bf0c732614bd00a6b5e89732bf538c8ff2a952302ba9"
    },
    "peer": {
      "path": "build/impact-skill-20261014/v66-normal-host4-static-peer-v1.json",
      "bytes": 33191,
      "sha256": "976668534499c5392f76198d7cf16aefc67f3a2054afb43533880e44ad0afd41"
    },
    "inverses": [
      {
        "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/mechanical-host3-inverse-v1.json",
        "bytes": 3373,
        "sha256": "206575744ba4fdb0c08b0acb31ad4015c88a3183f8f47eaf600c97050cf54967"
      },
      {
        "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/mechanical-manifest3-inverse-v1.json",
        "bytes": 2637,
        "sha256": "779a63042279e8cb155f32a56cc3dc587c08f3477f9a18c0071797f1f0070e1f"
      },
      {
        "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/mechanical-cli3-inverse-v1.json",
        "bytes": 2868,
        "sha256": "50ae177b6391b2762e8c2a802d4250bf0a7abd04a9d9da582a00425c6da22889"
      }
    ],
    "preparations": [
      {
        "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/source-preparation-v1.json",
        "bytes": 3783,
        "sha256": "0cdce00d9d56fa53c3f964fdeff798854b5929e7e65547620ac8d33ff671787f"
      },
      {
        "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v4/source-preparation-v1.json",
        "bytes": 2772,
        "sha256": "3d1bb0b80cbdc2a68c1ee0d8d8f890930b56b4c544612550a6569f2ee0f3affb"
      },
      {
        "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v4/fixed-module-closure-source-proof-v1.json",
        "bytes": 18032,
        "sha256": "e85d173b65bcccd4cc91665ce568039d50649941c04d7c0eeeb379da303d7f72"
      }
    ],
    "oldSources": [
      {
        "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v3/city4-normal-round-host-v3.mjs",
        "bytes": 17193,
        "sha256": "5528d39df7fdedfd2ed8bac0cacfcde6f9b224d99c78280ea508c8741a6b930f"
      },
      {
        "path": "build/impact-skill-20261014/city4-normal-round-host-candidate-v3/fixed-node-dependencies-v3.json",
        "bytes": 9356,
        "sha256": "332562c0aee349d99fdf65225ec70142db62cbcf61dc3df69c03c9883bac8751"
      },
      {
        "path": "build/impact-skill-20261014/city4-normal-round-cli-candidate-v3/city4-normal-round-cli-v3.mjs",
        "bytes": 7653,
        "sha256": "f30264e33697bf842aa43cb4b799db902913c1eee975dac3ca370b27b896ac04"
      }
    ],
    "closure": [
      {
        "path": "build/impact-skill-20261014/city4-end-battle-close-candidate-v2/city4-end-battle-close-v2.mjs",
        "bytes": 31824,
        "sha256": "cb6dfc3ae12a29d7ffd3d6c62ac818ffa6c556b0065b8c0c21e94fac31c542d6"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-battle-close-candidate-v6/city4-end-battle-close-v6.mjs",
        "bytes": 41229,
        "sha256": "adfac529de1eccb394349c86cc0591999c65e27798feecfb8ba4d49ff5089284"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-first-own-collector-candidate-v5/city4-end-first-own-collector-v5.mjs",
        "bytes": 15855,
        "sha256": "d48453422cffc793ece63a42bab23ebe16e42309bd1e058ce8936670b1ede2fb"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-native-adapter-candidate-v1/city4-end-artifacts-v1.mjs",
        "bytes": 2658,
        "sha256": "d448d9cec872a87f062cdd69233a076146392c6f867543f9af70ef9cf3f2996e"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-native-adapter-candidate-v1/city4-ticket-view-v1.mjs",
        "bytes": 7701,
        "sha256": "26af6024990e607cb88193acfc0d437eb5d736348a700e46c1da9a23f222f781"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-native-adapter-candidate-v1/city4-ui-predicates-v1.mjs",
        "bytes": 13694,
        "sha256": "42071ad8bd0c81b2c4e7a5713873a862ab3d0422668377593c2439f29f31b294"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-observer-transition-candidate-v5/city4-end-observer-transition-v5.mjs",
        "bytes": 44820,
        "sha256": "e3d342b76e1cf02a93205c5c59484d18e1a90c22562409fd8051993c9a1f5d9f"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-terminal-release-candidate-v5/city4-end-terminal-release-v5.mjs",
        "bytes": 28723,
        "sha256": "460d0577b9d23174bca4ba3d2310b9d6b2c3893cc82b6a7303d7ff4f2873076b"
      },
      {
        "path": "build/impact-skill-20261014/city4-end-terminal-save-candidate-v3/city4-end-terminal-save-v3.mjs",
        "bytes": 25545,
        "sha256": "300b5878555726ef8e835fef4f512dc7edbaa49ccc95d778142ad801fc34d974"
      },
      {
        "path": "build/impact-skill-20261014/city4-hd-wood-action-candidate-v7/city4-hd-wood-action-v7.mjs",
        "bytes": 57363,
        "sha256": "3ac1daca793a9e6542862b74d0e802fdeef0a3f9b50fab58051f9803ffb7ab7c"
      },
      {
        "path": "build/impact-skill-20261014/city4-owned-transport-candidate-v4/city4-natural-descendant-exit-v1.mjs",
        "bytes": 6400,
        "sha256": "e0652fbba4cf976ff745e39f883977ebf3d3b0231ee6eb950c83b68dfb190afe"
      },
      {
        "path": "build/impact-skill-20261014/city4-owned-transport-candidate-v4/city4-original-title-contract-v1.mjs",
        "bytes": 12688,
        "sha256": "037736f4836887f7d75bd7b6416b0fe64a3b3be8d5a3ed057a23eaf4b1a83848"
      },
      {
        "path": "build/impact-skill-20261014/city4-owned-transport-candidate-v7/city4-owned-transport-v7.mjs",
        "bytes": 44581,
        "sha256": "8a507d922492bbaf24647ecd6d0d60f448ab15f3b02c4c3d268e46b4588cb9fa"
      },
      {
        "path": "build/impact-skill-20261014/city4-plunder-report-candidate-v1/original-plunder-report-v1.mjs",
        "bytes": 3593,
        "sha256": "91e1161b1a227e8cb6f92ad79f5baedc48798a6ccfc692d77f2a06fd84fc01fb"
      },
      {
        "path": "build/impact-skill-20261014/city4-plunder-save-candidate-v1/hd-wood-city4-continuation-v1.mjs",
        "bytes": 53404,
        "sha256": "ed0ee27ec77f2ce655b7748d563d83674b80f3f10a2ee0f47005ca348e2a3581"
      },
      {
        "path": "build/impact-skill-20261014/hd-wood-v39-ticket-observer-v1.mjs",
        "bytes": 1833,
        "sha256": "64e0cd4dab788920d164012714457badd487ecf7123aff653e13ab45f592085d"
      },
      {
        "path": "build/impact-skill-20261014/hd-wood-v40-ticket-observer-v1.mjs",
        "bytes": 893,
        "sha256": "ce169b4fcde3770c1bda14e31ad34bee9cd707f85bc72b8036e5aa9ee38be71e"
      },
      {
        "path": "docs/validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs",
        "bytes": 32262,
        "sha256": "c22ce639e99bd9da91977ebcb5a982ec7b2df20480c947290d73cc70457b37ca"
      },
      {
        "path": "scripts/hd-impact-move-path.mjs",
        "bytes": 5572,
        "sha256": "bc593fb1286538d4bef314326a742f131090481d821233b34ce063e082def4cd"
      },
      {
        "path": "scripts/hd-impact-plunder-runtime-oracle.mjs",
        "bytes": 10718,
        "sha256": "2b21c4194435f5f602a102f976a27d47d2cfa5639cce16269d6a91675fe9a998"
      },
      {
        "path": "scripts/hd-impact-v26-raw-buy11-oracle.mjs",
        "bytes": 14276,
        "sha256": "56e290989b261944b3822b56921d88c8051654d6beb0edade163a9ad8541db9f"
      },
      {
        "path": "scripts/hd-impact-v31-acquisition-policy.mjs",
        "bytes": 21161,
        "sha256": "f6555d6e00cdf26a1040749936f9c07e5560873d9b72d657952aae21f60b4d7c"
      },
      {
        "path": "scripts/hd-impact-v32-conditional-plunder-prefix.mjs",
        "bytes": 26243,
        "sha256": "790c3b5dd1d24e984dd9bf6c0ccef2f6a4e22141cc4171fdf2da04c2c0d28013"
      },
      {
        "path": "scripts/hd-impact-v36-wood-route.mjs",
        "bytes": 16732,
        "sha256": "b17fc01755860be7280247edb67b0501754537d8b1eb6e2e66c0f6d3095caf46"
      },
      {
        "path": "scripts/hd-mobile-system-runtime-oracle.mjs",
        "bytes": 10021,
        "sha256": "d79dfa24d2ecc2fe7ffc879c90f6d868a310df2bb95ed6eafa75dd1c6c69f5fe"
      },
      {
        "path": "scripts/hd-runtime-owned-chrome.mjs",
        "bytes": 13354,
        "sha256": "1accd3307d480da768ab2985a613f4fadaec9ee3a5e9f8cdcaff4e7abe3550d0"
      },
      {
        "path": "scripts/hd-wood-city4-anchor-artifacts.mjs",
        "bytes": 2658,
        "sha256": "d448d9cec872a87f062cdd69233a076146392c6f867543f9af70ef9cf3f2996e"
      },
      {
        "path": "scripts/hd-wood-city4-anchor-input-contract.mjs",
        "bytes": 7764,
        "sha256": "549be3f5ee0a210d7625cd55aa95f6fc6a5854279f59c888b1bd871b954b1314"
      },
      {
        "path": "scripts/hd-wood-city4-anchor-ledger.mjs",
        "bytes": 1269,
        "sha256": "6f73b59a0a302a9d8f5b25cedb6f20f957c1154b402158d13c1f40a46a8c4118"
      },
      {
        "path": "scripts/hd-wood-city4-anchor-runtime.mjs",
        "bytes": 25281,
        "sha256": "5a7859a5f8ff1dd46fb69f78f82de0ff7c8efee1919eef6f51918d7ca9834112"
      },
      {
        "path": "scripts/hd-wood-city4-continuation.mjs",
        "bytes": 53236,
        "sha256": "e6b35c14b74149f3b5f07fc6442000abf6696e909c8db5432508ba81e962a7ab"
      },
      {
        "path": "scripts/hd-wood-city4-end-input.mjs",
        "bytes": 23243,
        "sha256": "cff968c20236b5eed24a3d611d377341d305e013cba5288380b6ed4fc5e3d53e"
      },
      {
        "path": "scripts/hd-wood-city4-live-retention.mjs",
        "bytes": 16383,
        "sha256": "0309b2dbcaca49b0b29f223cfd0b239e07aaea4f5d11b3076fb8c6c93418efb2"
      },
      {
        "path": "scripts/hd-wood-city4-origin-anchor.mjs",
        "bytes": 20343,
        "sha256": "e35a42a4c4634cc371dd8cf2be4aba86d23d1be0cfada112d929c172afab0b80"
      },
      {
        "path": "scripts/hd-wood-city4-plunder-report.mjs",
        "bytes": 3593,
        "sha256": "91e1161b1a227e8cb6f92ad79f5baedc48798a6ccfc692d77f2a06fd84fc01fb"
      },
      {
        "path": "scripts/hd-wood-city4-preparation.mjs",
        "bytes": 14136,
        "sha256": "2142399ba7f6b80b230199b5596eed5557276d2f2677a845755960ef97efd933"
      },
      {
        "path": "scripts/hd-wood-city4-snapshot-observer.mjs",
        "bytes": 1827,
        "sha256": "cb8dae92a4a2e853426eb57694df1b28a75e42ac23771c72662cf10e27b3db08"
      },
      {
        "path": "scripts/hd-wood-city4-ticket-observer.mjs",
        "bytes": 882,
        "sha256": "7ad3e0b841ef4770dc302750f1bcf2b6a669496be4bb09fe753d750eb0e08683"
      },
      {
        "path": "scripts/hd-wood-city4-ticket-view.mjs",
        "bytes": 7704,
        "sha256": "c5590438fe45261112882bfde6d6215abfbd8fd1a7cdd9a2f2d7642c24369085"
      },
      {
        "path": "scripts/hd-wood-city4-ui-predicates.mjs",
        "bytes": 13694,
        "sha256": "42071ad8bd0c81b2c4e7a5713873a862ab3d0422668377593c2439f29f31b294"
      },
      {
        "path": "scripts/hd-wood-evidence-contract.mjs",
        "bytes": 10750,
        "sha256": "d364e8725ae93b0bb5f341116c10916333b982f84c814781707c87ede50b1ad4"
      },
      {
        "path": "scripts/hd-wood-native-action.mjs",
        "bytes": 12494,
        "sha256": "681064d68f35be8f01937168593c44a696b6df0ceeafd033b6c7b094ba3841a5"
      },
      {
        "path": "scripts/hd-wood-native-route.mjs",
        "bytes": 6273,
        "sha256": "e6f899062e58ec289380a6608b477e8e9341cf344bc01b93c0c77162a6933329"
      },
      {
        "path": "scripts/hd-wood-original-continuation.mjs",
        "bytes": 19876,
        "sha256": "8c0764ca38b2c3530a72abbc66cb21b5d9f407e36314d5fe95d9f295b33b2c91"
      },
      {
        "path": "scripts/hd-wood-recruitment-hooks.mjs",
        "bytes": 5591,
        "sha256": "8a663db5c1f775fe5cede82163d4ac79861f6fb2b099634aad718f67f3f4c2fc"
      },
      {
        "path": "scripts/hd-wood-recruitment-preparation.mjs",
        "bytes": 30306,
        "sha256": "8fd0e641949d4c1ebef99507695fe0b4249aeaae6526a49972b05d658277b183"
      },
      {
        "path": "scripts/hd-wood-runtime-oracle.mjs",
        "bytes": 49408,
        "sha256": "f29c4ba0306d94ac62094f2ae7fe928c15e33988afa42f558b3baa2821882e3e"
      },
      {
        "path": "scripts/hd-wood-supplied-continuation.mjs",
        "bytes": 26600,
        "sha256": "2f566cc472aadbac18f15e2d7b294143f552a3da74685daa2ef188060bfbca2f"
      }
    ]
  }
};
export const V66_PENDING_PINS=Object.freeze({"close":{"path":"build/impact-skill-20261014/v65-close6-controls-v1.json","bytes":131532,"sha256":"a2dc6098831005761aabca4392050299e48174a2f323bb62de0b6892c008cd8a"},"integration":{"path":"build/impact-skill-20261014/v66-runtime-source-integration-v1.json","bytes":7908,"sha256":"8e5bee16171b8ea0d454d01f3281bf5523552e58f8ec50774713f8ca8b5ccef5"},"formal":{"path":"build/impact-skill-20261014/v66-formal-runtime-checks-v1.json","bytes":130826,"sha256":"3753f54425b2192ab01de7258e92cfb6e212ef99287d811b159999bbe0104366"}});
export const V66_PENDING_TERMINALS=Object.freeze({"close":{"closed":true,"sessionId":77995,"initialChunk":"b6c769","terminalChunk":"a2c4a4","exitCode":0},"integration":{"closed":true,"terminalChunk":"3a8f32","exitCode":0},"formal":{"closed":true,"terminalChunk":"db0781","exitCode":0}});
export const V66_LANES=Object.freeze({eligibility:{tests:2,epoch:'old-controls'},close:{tests:21,epoch:'old-controls'},formal:{tests:4,epoch:'final-formal'}});
export const V66_EXPECTED_PATHS=Object.freeze({close:V66_BUILD+'v65-close6-controls-v1.json',integration:V66_BUILD+'v66-runtime-source-integration-v1.json',formal:V66_BUILD+'v66-formal-runtime-checks-v1.json'});
const eq=(a,b,m='Exact V66 supplied source evidence')=>assert.ok(isDeepStrictEqual(a,b),m),json=b=>JSON.parse(b.toString('utf8'));
export function v66Relative(p){assert.equal(typeof p,'string');assert.ok(p&&!path.isAbsolute(p)&&!p.includes('\\')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'));return p;}
export function v66Pin3(p){assert.ok(p&&typeof p==='object');v66Relative(p.path);assert.ok(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&p.bytes<=V45_BOUNDS.maxFileBytes);assert.match(p.sha256,/^[0-9a-f]{64}$/);return{path:p.path,bytes:p.bytes,sha256:p.sha256};}
export function v66Check(p,b){assert.ok(Buffer.isBuffer(b),'Complete exact bytes: '+p.path);eq(v45Pin(p.path,b),v66Pin3(p));return b;}
export function v66Vector(rows){assert.ok(Array.isArray(rows)&&rows.length<=4096);const seen=new Set();return rows.map(p=>{const q=v66Pin3(p);assert.ok(!seen.has(q.path));seen.add(q.path);return q;});}
export function v66Terminal(t,exitCode=0){assert.ok(t&&typeof t==='object');eq(t.closed,true);eq(t.exitCode,exitCode);assert.match(t.terminalChunk,/^[0-9a-f]{6}$/);if(Object.hasOwn(t,'sessionId')){assert.ok(Number.isSafeInteger(t.sessionId)&&t.sessionId>0);assert.match(t.initialChunk,/^[0-9a-f]{6}$/);}return t;}
export function requireV66FinalInputs(){for(const name of ['close','integration','formal']){assert.notEqual(V66_PENDING_PINS[name],null,'Original CLOSED '+name+' receipt full pin required');v66Pin3(V66_PENDING_PINS[name]);eq(V66_PENDING_PINS[name].path,V66_EXPECTED_PATHS[name]);assert.notEqual(V66_PENDING_TERMINALS[name],null,'Complete original '+name+' tool terminal required');v66Terminal(V66_PENDING_TERMINALS[name]);}}
export function v66Scope(){return{futureCompositionSourceOnly:true,futureNotExecuted:true,actualRunAccepted:false,privateCapsNotAdopted:true,sourceOnly:true,actualGameInputs:0,newWorlds:0,newPublicLoads:0,newPublicSaves:0,newEnd:0,newMarches:0,cleanupAuthorized:false,actualBattleAccepted:false,actualCastAccepted:false,actualIncomeAccepted:false,actualTerminalSaveAccepted:false,actualSessionClosed:false,weatherValueInOldActualKnown:false,publishedNewMainInput:false,retainedMain:'P57',hdAccepted:false,globalHdComplete:false,newCodeFullRun:false,addedDefaultTests:0,defaultRegisteredFiles:149};}
export function v66SafeArchivePath(p){v66Relative(p);assert.ok(!V66_LOCKS.forbiddenParentRaw.includes(p),'Saved V63 full four raw files are not repackaged');if(p.startsWith(V66_LOCKS.actualRoot))eq(p,V66_LOCKS.actualSystemTicket.path,'Only the exact old actual C35d data ticket is selected');assert.ok(!/\/(?:private-browser-profile|frozen-public|frozen-native-source|frozen-node|host-frozen-node)\//.test(p));return p;}
export function readV66Bounded(root,p,max=V45_BOUNDS.maxFileBytes){v66Relative(p);assert.ok(Number.isSafeInteger(max)&&max>0&&max<=V45_BOUNDS.maxFileBytes);const base=fs.realpathSync.native(root);let file=base;const parts=p.split('/');for(let i=0;i<parts.length;i++){file=path.join(file,parts[i]);const s=fs.lstatSync(file);assert.ok(!s.isSymbolicLink());assert.ok(i===parts.length-1?s.isFile():s.isDirectory());}assert.ok(fs.realpathSync.native(file).startsWith(base+path.sep));const a=fs.lstatSync(file,{bigint:true});assert.ok(a.size>=0n&&a.size<=BigInt(max));const b=fs.readFileSync(file),z=fs.lstatSync(file,{bigint:true});eq([z.dev,z.ino,z.birthtimeNs,z.size,z.mtimeNs],[a.dev,a.ino,a.birthtimeNs,a.size,a.mtimeNs]);eq(BigInt(b.length),a.size);return b;}
const time=x=>{assert.equal(typeof x,'string');const v=Date.parse(x);assert.ok(Number.isFinite(v));return v;};
function rawSummary(b){const text=b.toString('utf8'),stats={};for(const k of ['tests','pass','fail','cancelled','skipped','todo','duration_ms']){const hits=[...text.matchAll(new RegExp('^# '+k+' ([0-9.]+)\\r?$','gm'))];eq(hits.length,1,'Exactly one complete original raw TAP terminal '+k);stats[k]=Number(hits[0][1]);assert.ok(Number.isFinite(stats[k]));}return stats;}
export function v66BoundLanes(b){eq(Object.keys(b.fresh).sort(),['close','eligibility','formal']);return b.fresh;}
export function v66CurrentVector(receipts,extra,epoch){const byPath=new Map(),put=p=>{p=v66Pin3(p);const old=byPath.get(p.path);if(old)eq(old,p,'All other selected overlapping sources retain exact current bytes');else byPath.set(p.path,p);};for(const[name,r]of Object.entries(receipts))for(const p of v66Vector(r.sources)){const old=epoch.sources.find(q=>q.source===p.path);if(name!=='formal'&&old){eq(p,{path:old.source,bytes:old.bytes,sha256:old.sha256});put(old);}else put(p);}for(const p of extra)put(p);return[...byPath.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
export function v66NormalizedMappings(action,close){eq(action.sourceFiles.length,1);const a=action.sourceFiles[0];return[{source:v66Pin3(a.source),prepared:{...v66Pin3(a.prepared),intendedTrackedPath:a.prepared.intendedTrackedPath},replacements:a.replacements.map(r=>({from:r.from,to:r.to,count:r.count}))},{source:v66Pin3(close.source),prepared:{...v66Pin3(close.prepared),intendedTrackedPath:close.target},replacements:close.mappings.map(r=>({from:"'"+r.from+"'",to:"'"+r.to+"'",count:r.occurrences}))}];}
export function v66PortableReaderBytes(b){let t=b.toString('utf8');const from="'../../../docs/"+'validation/m5-quantity-ack-refresh-20261024-v45-verify.mjs\'',to="'./m5-quantity-"+'ack-refresh-20261024-v45-verify.mjs\'';eq(t.split(from).length-1,1);const out=t.replace(from,to);eq(out.replace(to,from),t,'Whole original reader except sole codec import');return Buffer.from(out);}
/** Complete source/receipt qualification. It never executes any archived file. */
export function verifyV66SourceEvidence({files,canonical:C,readCurrent}){
 requireV66FinalInputs();const get=p=>v66Check(p,files.get(p.path)),J=p=>json(get(p)),T=p=>get(p).toString('utf8');
 eq(C.schemaVersion,1);eq(C.kind,'city4-close-diagnostics-source-only');eq(C.prefix,V66_PREFIX);eq(C.scope,v66Scope());eq(C.parentCommit,V66_LOCKS.parentCommit);eq(C.parentBaseline,V66_LOCKS.parentBaseline);eq(C.externalInputPins,V66_LOCKS.mainPins);eq(C.formalSources,V66_LOCKS.formalFinal);eq(C.unchanged,V66_LOCKS.unchanged);eq(C.epoch,V66_LOCKS.epoch);eq(C.codec,V66_LOCKS.codec);eq(C.integration,V66_PENDING_PINS.integration);eq(C.integrationTerminal,V66_PENDING_TERMINALS.integration);eq(C.epochTerminal,V66_LOCKS.epochTerminal);
 eq(v66Vector(C.archivePins),[...files].map(([p,b])=>v45Pin(p,b)).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0));assert.ok(files.size>0&&files.size<=V45_BOUNDS.maxFiles);for(const p of C.archivePins){v66SafeArchivePath(p.path);get(p);}
 for(const p of [...V66_LOCKS.mainPins,V66_LOCKS.parentBaseline.canonical,V66_LOCKS.codec]){assert.ok(!files.has(p.path),'Prior public proof and codec remain external exact');v66Check(p,readCurrent(p.path,Math.max(1,p.bytes)));}
 const parent=json(readCurrent(V66_LOCKS.parentBaseline.canonical.path,V66_LOCKS.parentBaseline.canonical.bytes));eq(parent.prefix,'docs/validation/m5-city4-strong-flow-20261026-v64');eq(parent.observations.tests.parentBaseline.tests,7905);eq(parent.observations.tests.parentBaseline.registeredFiles,149);eq(parent.observations.tests.parentBaseline.savedParentBaseline,true);eq(parent.observations.tests.parentBaseline.newCodeFullRun,false);
 const b=J(C.bindings);eq(C.bindings.path,V66_BINDINGS);eq(b.schemaVersion,1);eq(b.draftOnly,false);eq(b.sourceOnly,true);eq(b.kind,C.kind);eq(b.prefix,C.prefix);eq(b.parentCommit,C.parentCommit);eq(b.scope,C.scope);eq(b.epoch,C.epoch);eq(b.epochTerminal,C.epochTerminal);eq(b.integration,C.integration);eq(b.integrationTerminal,C.integrationTerminal);eq(b.fresh,C.fresh);eq(b.formalFinal,C.formalSources);eq(b.unchanged,C.unchanged);eq(b.parentBaseline,C.parentBaseline);eq(b.readerSource,C.supportPins.find(p=>p.path===V66_READER));eq(b.publisherSource,C.supportPins.find(p=>p.path===V66_PUBLISHER));
 const E=J(C.epoch),I=J(C.integration);eq(E.schemaVersion,1);eq(E.sourceOnly,true);eq(E.parentCommit,V66_LOCKS.parentCommit);eq(E.sources,V66_LOCKS.old);eq(E.newPathsAbsent,['scripts/hd-wood-city4-battle-close.mjs']);eq(E.unchanged,V66_LOCKS.unchanged);eq(E.attributeSuffix,V66_LOCKS.attributeSuffix);eq([E.defaultRegisteredFiles,E.addedDefaultTests,E.newGameInputs],[149,0,0]);for(const p of E.sources)get(p);
 const formal=new Map(v66Vector(C.formalSources).map(p=>[p.path,p]));eq(get(formal.get('.gitattributes')),Buffer.concat([get(E.sources.find(p=>p.source==='.gitattributes')),Buffer.from(E.attributeSuffix)]),'Only the exact E thirteen attributes lines');for(const p of V66_LOCKS.unchanged)get(p);
 const action=J(V66_LOCKS.actionManifest),close=J(V66_LOCKS.closeManifest),combined=J(V66_LOCKS.combinedManifest),mappings=combined.sourceFiles;eq(combined.schemaVersion,1);eq(combined.sourceOnly,true);eq(combined.priorManifests,[V66_LOCKS.actionManifest,V66_LOCKS.closeManifest]);eq(combined.unchanged,V66_LOCKS.unchanged);eq([combined.importReplacementRules,combined.literalImportOccurrences],[13,13]);eq(combined.wholeImportOnlyInverse,true);eq(mappings.map(f=>({source:v66Pin3(f.source),prepared:{...v66Pin3(f.prepared),intendedTrackedPath:f.prepared.intendedTrackedPath},replacements:f.replacements.map(r=>({from:r.from,to:r.to,count:r.count}))})),v66NormalizedMappings(action,close),'Complete combined metadata retained; original two-manifest projection identical');let rules=0,literals=0;for(const f of mappings){let old=T(f.prepared);for(const r of [...f.replacements].reverse()){eq(old.split(r.to).length-1,r.count);old=old.split(r.to).join(r.from);rules++;literals+=r.count;}eq(Buffer.from(old),get(f.source),'Whole original candidate inverse');const target=formal.get(f.prepared.intendedTrackedPath);assert.ok(target);eq(get(target),get(f.prepared),'Current formal bytes equal prepared import-only bytes');}eq([rules,literals],[13,13]);
 eq(I.schemaVersion,1);eq(I.sourceOnly,true);eq(I.accepted,true);eq(I.epoch,C.epoch);eq(I.before,E.sources.map(p=>({path:p.source,bytes:p.bytes,sha256:p.sha256})));eq(I.newPathsAbsent,E.newPathsAbsent);eq(I.after,C.formalSources);eq(I.unchanged,E.unchanged);eq(I.mappings,mappings);eq([I.registeredFiles,I.addedDefaultTests,I.importReplacementRules,I.literalImportOccurrences],[149,0,13,13]);eq(I.allPrerequisitesClosedBeforeIntegration,true);eq(I.wholeImportOnlyInverse,true);for(const p of v66Vector(I.sources))get(p);const start=time(I.startedAt),end=time(I.finishedAt);assert.ok(end>=start);
 const pkg=J(V66_LOCKS.unchanged.find(p=>p.path==='package.json')),registered=pkg.scripts.test.split(/\s+/).filter(p=>p.startsWith('scripts/'));eq([registered.length,new Set(registered).size],[149,149]);assert.ok(!registered.includes('scripts/test-hd-wood-city4-battle-close-data.mjs'));
 const lanes=v66BoundLanes(C),receipts={},controls={};for(const[name,spec]of Object.entries(V66_LANES)){
  const lane=lanes[name],fixed=name==='eligibility'?V66_LOCKS.eligibility:V66_PENDING_PINS[name],terminal=name==='eligibility'?V66_LOCKS.eligibilityTerminal:V66_PENDING_TERMINALS[name];eq(lane.receipt,fixed);eq(lane.terminal,terminal);eq(lane.epoch,spec.epoch);eq(lane.expectedTests,spec.tests);v66Terminal(terminal);const r=receipts[name]=J(lane.receipt);eq(r.schemaVersion,1);eq(r.sourceOnly,true);eq(r.sourceBytesStable,true);eq(r.processExitCode,terminal.exitCode);const stats=rawSummary(get(r.stdout)),stderr=get(r.stderr);for(const[k,v]of Object.entries(stats))eq(r[k],v);eq(J(r.before).sources,r.sources,'Complete original before/after vector');eq(r.expectedTests,spec.tests);eq(r.signal,null);eq(r.error,null);if(name==='formal'){eq([r.registeredFiles,r.registeredSyntaxCases,r.unregisteredFormalDataCases],[149,3,1]);}if(name==='close'){eq(r.controlledFixtureForks,true);eq(r.storedActualDataOnly,true);}const green=r.processExitCode===0&&stats.tests===spec.tests&&stats.pass===spec.tests&&['fail','cancelled','skipped','todo'].every(k=>stats[k]===0)&&stderr.length===0;eq(r.accepted,green);eq(green,true,'Every fresh independent lane must really be green');
  const rows=v66Vector(r.sources);for(const old of E.sources)eq(rows.find(p=>p.path===old.source),name==='formal'?formal.get(old.source):{path:old.source,bytes:old.bytes,sha256:old.sha256});for(const p of E.unchanged)eq(rows.find(q=>q.path===p.path),p);if(name==='formal'){eq(rows.find(p=>p.path==='scripts/hd-wood-city4-battle-close.mjs'),formal.get('scripts/hd-wood-city4-battle-close.mjs'));assert.ok(time(r.startedAt)>=end);}else{assert.ok(!rows.some(p=>p.path==='scripts/hd-wood-city4-battle-close.mjs'),'New formal Close absent in original control vector');assert.ok(time(r.finishedAt)<=start);}assert.ok(time(r.finishedAt)>=time(r.startedAt));
  for(const k of ['defaultTestsAdded','newBrowserRuns','newPublicLoads','newPublicSaves','newEnd','newNativeInputs','newRealNativeInputs','newMarches'])if(Object.hasOwn(r,k))eq(r[k],0);for(const k of ['hdAccepted','globalHdComplete','cleanupAuthorized','actualCOrRngSuccessProven','pixelOracleAccepted'])if(Object.hasOwn(r,k))eq(r[k],false);controls[name]={...stats,expectedTests:spec.tests,rawAccepted:true,sourceBytesStable:true,sourceEpoch:spec.epoch,countedInDefault:false,featureOrActualHdAccepted:false};
 }
 eq(Object.keys(I.prerequisites).sort(),['close','eligibility']);for(const name of ['eligibility','close'])eq(I.prerequisites[name],{receipt:lanes[name].receipt,accepted:true,processExitCode:0,terminal:lanes[name].terminal});for(const k of ['newBrowserRuns','newNativeInputs','newPublicLoads','newPublicSaves','newEnd','newMarches'])eq(I[k],0);for(const k of ['publishedNewMainInput','hdAccepted','globalHdComplete'])eq(I[k],false);if(Object.hasOwn(I,'cleanupAuthorized'))eq(I.cleanupAuthorized,false);eq(I.originalLive48Unchanged,true);
 assert.ok(Array.isArray(b.supportPins)&&b.supportPins.length<=128);eq(new Set(b.supportPins.map(p=>p.path)).size,b.supportPins.length);for(const p of b.supportPins)assert.ok(p.path.startsWith(V66_BUILD)&&![V66_READER,V66_PUBLISHER,V66_BINDINGS].includes(p.path));eq(C.supportPins.map(p=>p.path).sort(),[...b.supportPins.map(p=>p.path),V66_READER,V66_PUBLISHER,V66_BINDINGS].sort());for(const p of C.supportPins)get(p);for(const p of V66_LOCKS.requiredSupport)assert.ok(C.supportPins.some(q=>q.path===p));for(const p of V66_LOCKS.fixedMaterial)get(p);
 const peer=J(C.supportPins.find(p=>p.path===V66_PEER));eq(peer.schemaVersion,1);eq(peer.accepted,true);eq(peer.sourceOnly,true);eq(peer.readerSource,b.readerSource);eq(peer.publisherSource,b.publisherSource);
 const future=V66_LOCKS.futureComposition,fp=J(future.peer);eq(fp.schemaVersion,1);eq(fp.accepted,true);eq(fp.sourceOnly,true);eq(fp.host,future.host);eq(fp.manifest,future.manifest);eq(fp.cli,future.cli);eq(fp.scope.noActualRun,true);eq(fp.scope.newRunAuthorized,false);eq(fp.scope.oldNodeAdoptionAuthorized,false);eq(fp.scope.originalLiveSourcesChanged,false);
 const fm=J(future.manifest);eq(v66Vector(fm.sources),future.closure);eq(fm.sources.length,48);for(const p of [future.host,future.manifest,future.cli,...future.preparations,...future.oldSources])get(p);for(const p of future.inverses){const record=J(p);eq(record.schemaVersion,1);eq(record.sourceOnly,true);let original=T(record.candidate);for(const r of [...record.changes].reverse()){eq(original.split(r.replacement).length-1,r.occurrences);original=original.split(r.replacement).join(r.old);}eq(Buffer.from(original),get(record.before),'Whole future Host/manifest/CLI inverse, not execution credit');}
 const current=v66CurrentVector(receipts,[...C.archivePins,...v66Vector(I.sources),...C.formalSources,...E.unchanged,...future.closure],E);eq(C.currentSources,current);const literal=current.filter(p=>p.path.startsWith(V66_BUILD)).map(p=>p.path).sort();eq(C.literalExactIgnored,literal);const missing=[];for(const p of current){const bytes=readCurrent(p.path,Math.max(1,p.bytes));if(bytes===null){assert.ok(literal.includes(p.path),'Missing tracked source is refused');get(p);missing.push(p.path);}else v66Check(p,bytes);if(literal.includes(p.path))get(p);}
 for(const p of [V66_LOCKS.actualSystemTicket,V66_LOCKS.copiedSystemTicket]){eq(current.find(q=>q.path===p.path),p);get(p);}eq(get(V66_LOCKS.actualSystemTicket),get(V66_LOCKS.copiedSystemTicket),'Both selected original actual/fixture names retain exact C35d bytes');
 const facts={...v66Scope(),sourceChange:{formalModules:2,newFormalLibraries:1,importReplacementRules:13,literalImportOccurrences:13,wholeImportOnlyInverse:true,stageCollectorPackageAndOriginalSyntaxTestUnchanged:true,attributesExactThirteenLines:true,controlsOnlyOldAliases:E.sources.map(p=>p.source)},tests:{fresh:controls,freshIndependentChecks:27,addedDefaultTests:0,registeredDefaultFiles:149,defaultTestCommandUnchanged:true,parentBaseline:V66_LOCKS.parentBaseline,candidateAndFormalNotAddedToDefault:true},futureComposition:{host:future.host,manifest:future.manifest,cli:future.cli,sourcePeer:future.peer,dependencies:48,hostInclusiveClosure:49,futureNotExecuted:true,actualRunAccepted:false,privateCapsNotAdopted:true,originalSpentNodeAdoptionProvided:false,newDefaultTests:0,newGameInputs:0},coverage:'Action7 diagnostic failure data and C6 native menu owner contracts under fixed synthetic genuine-brand controls; formal three parse-only expressions and one stored-data classifier. No actual later input, weather oracle, skill movie, battle result, terminal SAVE, cleanup or new-code full run.',sources:{current:current.length,literalB:literal.length},oldActualCaseRepacked:false,onlyExactOldActualSystemTicketArchivedAsData:true,parentFullRawFourRepacked:false,parentPublicArchiveRepacked:false};return{facts,diagnostics:{missingExactIgnoredSources:missing.length}};
}
export function verifyV66Publication(root,{readCurrent,readPublic}={}){requireV66FinalInputs();readCurrent??=((p,max)=>{try{return readV66Bounded(root,p,max);}catch(e){if(e.code==='ENOENT')return null;throw e;}});readPublic??=((p,max)=>readV66Bounded(root,p,max));const C=json(readPublic(V66_PREFIX+'.json',2*1024*1024));eq(C.reader.path,V66_PREFIX+'-verify.mjs');const reader=v66Check(C.reader,readPublic(C.reader.path,1024*1024));eq(C.markdown.path,V66_PREFIX+'.md');v66Check(C.markdown,readPublic(C.markdown.path,1024*1024));eq(C.archive.path,V66_PREFIX+'-archive-index.json');const index=json(v66Check(C.archive,readPublic(C.archive.path,2*1024*1024)));eq(index.parts.map(p=>p.path),index.parts.map((p,i)=>V66_PREFIX+'-archive-part'+String(i+1).padStart(3,'0')+'.json'));const decoded=decodeV45Archive({index,readPart:(p,max)=>readPublic(p,max)}),source=C.supportPins.find(p=>p.path===V66_READER);eq(reader,v66PortableReaderBytes(v66Check(source,decoded.files.get(V66_READER))));const result=verifyV66SourceEvidence({files:decoded.files,canonical:C,readCurrent});eq(C.observations,result.facts);return{accepted:true,facts:result.facts,archive:{logicalFiles:decoded.files.size,parts:index.parts.length},diagnostics:result.diagnostics};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){requireV66FinalInputs();eq(process.argv.slice(2),['--verify']);console.log(JSON.stringify(verifyV66Publication(process.cwd())));}
