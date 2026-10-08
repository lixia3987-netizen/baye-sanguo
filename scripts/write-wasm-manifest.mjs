import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
const sdkVersion = process.argv[3];
const sourceList = process.argv[4];
const revision = process.argv[5];
const cmakeVersion = process.argv[6];
const modified = process.argv[7];
if (!dir || !sdkVersion || !sourceList || !revision || !cmakeVersion) {
    throw new Error('Use scripts/build-wasm.sh or scripts/build-wasm.ps1 to supply artifact and source metadata');
}
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Emscripten on Windows also emits CRLF. Hash the LF bytes stored by Git.
// Emscripten emits trailing spaces on ASM_CONSTS rows. Normalize generated
// loader formatting before hashing/installing so repository whitespace checks
// do not fail whenever WASM addresses change.
const loaderPath = path.join(dir, 'baye.js');
const loader = fs.readFileSync(loaderPath, 'utf8');
fs.writeFileSync(loaderPath, loader.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, ''));
const wasm = fs.readFileSync(path.join(dir, 'baye.wasm'));
if (!WebAssembly.validate(wasm)) throw new Error('Generated baye.wasm is invalid');
const files = fs.readFileSync(sourceList, 'utf8').split('\0').filter(Boolean).sort();
const sourceHash = crypto.createHash('sha256');
for (const file of files) {
    sourceHash.update(file + '\0');
    sourceHash.update(fs.readFileSync(path.join(root, file)));
}
const artifacts = {};
for (const name of ['baye.js', 'baye.wasm', 'baye.wasm.map']) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) {
        const bytes = fs.readFileSync(file);
        artifacts[name] = { bytes: bytes.length, sha256: sha256(bytes) };
    }
}
const manifest = {
    schemaVersion: 1,
    sourceRevision: revision,
    engineSourceSha256: sourceHash.digest('hex'),
    engineSourceModified: Boolean(modified),
    emscriptenVersion: sdkVersion,
    cmakeVersion,
    sourceDateEpoch: Number(process.env.SOURCE_DATE_EPOCH),
    hdMenuProtocol: { nativeFallback: 254, controlField: 'g_hdFightMenuControl' },
    hdInputProtocol: {
        version: 3,
        fight: ['g_hdFightInputKind', 'g_hdFightInputSeq', 'g_hdFightActor'],
        menu: ['g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind', 'g_hdMenuSeq'],
        march: ['g_hdMarchPhase', 'g_hdMarchSession', 'g_hdMarchOrigin', 'g_hdMarchSelected', 'g_hdMarchInputSeq', 'g_hdMapInputSeq'],
        report: ['g_hdReportActive', 'g_hdReportInputSeq'],
        record: ['g_hdRecordActive', 'g_hdRecordMode', 'g_hdRecordIndex', 'g_hdRecordCount', 'g_hdRecordSeq'],
        qty: ['g_hdQtyActive', 'g_hdQtySession', 'g_hdQtyInputSeq', 'g_hdQtyLastKey', 'g_hdQtyCursor', 'g_hdQtyStep', 'g_hdQtyReady']
    },
    hdSpeProtocol: {
        version: 2,
        event: ['g_hdSpeGeneration', 'g_hdSpeEventId', 'g_hdSpeParentEventId', 'g_hdSpeDepth'],
        frames: ['g_hdSpeFrameIndex', 'g_hdSpeFrameValid', 'g_hdSpeCommitSeq', 'g_hdSpeVisibleFrames'],
        resourceFingerprint: 'fnv1a32:payload:resourceLength',
        displayedCommit: 'SysCopyScreen snapshot published by timed_flush_lcd before lcdFlushBuffer',
        skipEligible: 'keyflag === 1'
    },
    hdDetailProtocol: {
        version: 1,
        generation: 'g_hdDetailGeneration',
        menuIds: ['g_hdMenuIds', 'g_hdMenuIdsCount', 'g_hdMenuIdsKind', 'g_hdMenuIdsSeq', 'g_hdMenuIdsGeneration'],
        goods: ['g_hdGoodsGeneration', 'g_hdGoodsMenuSeq', 'g_hdGoodsIndex', 'g_hdGoodsTool',
            'g_hdGoodsPropertyCount', 'g_hdGoodsPropertyFlags', 'g_hdGoodsPageStart', 'g_hdGoodsPageEnd'],
        help: ['g_hdHelpProtocolVersion', 'g_hdHelpGeneration', 'g_hdHelpInputSeq',
            'g_hdHelpKind', 'g_hdHelpComplete', 'g_hdHelpPerson', 'g_hdHelpSlot', 'g_hdHelpFields'],
        toolAccess: ['bayeHdGetToolCount', 'bayeHdGetToolField', 'bayeHdGetArmType']
    },
    hdOverviewProtocol: {
        version: 1,
        view: ['g_hdViewSeq', 'g_hdViewGeneration', 'g_hdViewInputSeq', 'g_hdViewForce',
            'g_hdViewPageStart', 'g_hdViewPageSize', 'g_hdViewFoodKnown', 'g_hdViewRowPersons', 'g_hdViewPointPersons'],
        miniMap: ['g_hdMiniMapSeq', 'g_hdMiniMapGeneration', 'g_hdMiniMapInputSeq',
            'g_hdMiniMapDefaultDraw', 'g_hdMiniMapCustom', 'g_hdMiniMapResourceId']
    },
    hdMakerProtocol: {
        version: 1,
        owner: ['g_hdMakerGeneration', 'g_hdMakerSession', 'g_hdMakerInputSeq', 'g_hdMakerPhase'],
        phases: { scroll: 1, hold: 2 },
        input: 'original GamDelay(5000, 2), one function key or touch-up returns',
        holdSource: 'last actual SysCopyScreen snapshot of the matching MAKER child; public LCD display must match',
        retirement: 'GamMakerInf return, native reset, or held LCD dirty/copy interference',
        custom: 'same observed showAbout invocation; custom default branch retains LCD'
    },
    hdSpeCompositionProtocol: {
        version: 1,
        source: 'actual ordinary picture draw observed before its matching native attack child',
        background: 'g_hdSpeBg and g_hdSpeDisplayBg complete resource identity and signed origin',
        clears: ['g_hdSpeClearFrames', 'g_hdSpeDisplayClearFrames'],
        displayedCommit: 'actual SysCopyScreen composition snapshot published by timed_flush_lcd',
        retirement: 'uncontrolled virtual or LCD writes, nested events, unsupported drawing state, native reset'
    },
    hdAttackProtocol: {
        version: 1,
        owner: ['g_hdAttackGeneration', 'g_hdAttackSession', 'g_hdAttackPhase'],
        phases: { movie: 1, numbers: 2, hold: 3 },
        hurt: 'actual CountPlusSub result captured by the unchanged FgtAtkAction',
        display: 'g_hdAttackDisplay copied scene and cumulative actual digit poses, published only at timed LCD flush',
        digits: ['DigitIndex', 'DigitX', 'DigitY', 'DigitFirstY', 'DigitDrawCount'],
        input: 'no added skip or return; original numeric and final delays retain native input behavior',
        custom: 'same single observed willShowPKAnimation invocation; custom presence always retires HD source'
    },
    saveProtocol: { version: 0x95, legacyVersions: [0x90, 0x91, 0x92, 0x93, 0x94], filesPerSlot: 2, fightersBytes: 600, goodsQueueBytes: 4000 },
    artifacts
};
fs.writeFileSync(path.join(dir, 'baye.build.json'), JSON.stringify(manifest, null, 2) + '\n');
