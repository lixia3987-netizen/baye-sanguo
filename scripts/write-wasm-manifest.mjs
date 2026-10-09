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
    hdPersonPropertiesProtocol: {
        version: 1,
        publicApi: 'baye.hd.personProperties()',
        protocolField: 'g_hdPersonPropertiesProtocolVersion',
        owner: ['g_hdPersonPropertiesActive', 'g_hdPersonPropertiesGeneration', 'g_hdPersonPropertiesMenuSeq',
            'g_hdPersonPropertiesIndex', 'g_hdPersonPropertiesPerson'],
        menuOwner: ['g_hdDetailGeneration', 'g_hdMenuActive', 'g_hdMenuContext', 'g_hdMenuKind',
            'g_hdMenuSeq', 'g_hdMenuIndex', 'g_hdMenuIds', 'g_hdMenuIdsGeneration', 'g_hdMenuIdsSeq',
            'g_hdMenuIdsKind', 'g_hdMenuIdsCount'],
        identity: 'U16 zero-based person ID and selected row; full native IDs match before publication, never name matching',
        paint: ['g_hdPersonPropertiesPaintSeq', 'g_hdPersonPropertiesTitlePaintSeq', 'g_hdPersonPropertiesValuePaintSeq'],
        publication: 'temporary selected-row paint ticket; publish only after original set_menu and full menu_ids confirm owner and index',
        page: ['g_hdPersonPropertiesPropertyCount', 'g_hdPersonPropertiesPageIndex',
            'g_hdPersonPropertiesPageStart', 'g_hdPersonPropertiesPageEnd'],
        pageRange: 'actual native spc and exclusive end; propertyCount 0..255 and pageIndex 0..254, no inferred page size',
        completeness: {
            cumulative: 'g_hdPersonPropertiesComplete: every property has a captured title and value; prior paint revisions remain explicit',
            currentPage: 'g_hdPersonPropertiesPageComplete: nonempty selected name and all current-page title/value revisions match PaintSeq'
        },
        flags: { field: 'g_hdPersonPropertiesPropertyFlags', titleCaptured: 1, valueCaptured: 2 },
        text: {
            name: 'g_hdPersonPropertiesNameGbk', nameBytes: 32,
            titles: 'g_hdPersonPropertiesPropertyTitles', values: 'g_hdPersonPropertiesPropertyValues',
            slotBytes: 128, slots: 256,
            encoding: 'bounded NUL-terminated raw GBK final native strings; nonempty titles, empty values allowed'
        },
        custom: 'g_hdPersonPropertiesCustom: observed only in the existing title/value hook branches; no added hook/getter/draw calls',
        retirement: 'menu owner, selected row or full IDs change; report/help/qty takeover or native reset invalidates the paint ticket and captured source',
        input: 'read-only observer adds no keys or game writes; explicit player LEFT/RIGHT follows original native paging and boundary behavior'
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
        nestedOpaqueCoverage: {
            mode: 3,
            fields: ['g_hdSpeSceneMode', 'g_hdSpeSceneX', 'g_hdSpeSceneY', 'g_hdSpeSceneWidth', 'g_hdSpeSceneHeight'],
            displayedFields: ['g_hdSpeDisplaySceneMode', 'g_hdSpeDisplaySceneX', 'g_hdSpeDisplaySceneY', 'g_hdSpeDisplaySceneWidth', 'g_hdSpeDisplaySceneHeight'],
            establishment: 'same-origin, fully opaque selected rectangles form a containment chain; only actual supported writes and controlled copies establish their current and displayed coverage',
            retirement: 'uncontrolled drawing, unsupported paint, changed resources or nested owners permanently retire coverage; future dimensions cannot authorize an older displayed copy'
        },
        source: 'actual ordinary picture draw observed before its matching native attack child',
        background: 'g_hdSpeBg and g_hdSpeDisplayBg complete resource identity and signed origin',
        clears: ['g_hdSpeClearFrames', 'g_hdSpeDisplayClearFrames'],
        displayedCommit: 'actual SysCopyScreen composition snapshot published by timed_flush_lcd',
        retirement: 'uncontrolled virtual or LCD writes, nested events, unsupported drawing state, native reset'
    },
    hdAiTargetProtocol: {
        version: 2,
        publicApi: ['baye.hd.spe().aiTarget', 'baye.hd.spe().display.aiTarget'],
        protocolField: 'g_hdSpeAiProtocolVersion',
        scope: 'actual AI chosen command target; STACHG_SPE 27, resource index 0, kind 4, units 12..17, keyflag 0',
        command: ['CommandType', 'CommandParam', 'ActorIndex', 'TargetIndex', 'ActorPerson', 'TargetPerson'],
        identity: 'g_hdSpeAi and g_hdSpeDisplayAi carry actual zero-based U16 person IDs, unit positions and map viewport',
        region: 'actual before-draw 16x16 target cell within the baseline 160x96 scale-1 LCD; no guessed battle background',
        base: ['g_hdSpeAiBasePixels', 'g_hdSpeDisplayAiBasePixels'],
        baseFormat: '256 row-major original g_VisScr U8 pixel indices; captured once before the first clear or sprite draw',
        baseRgba: ['g_hdSpeAiBaseRgba', 'g_hdSpeDisplayAiBaseRgba'],
        baseRgbaFormat: '1024 original little-endian RGBA bytes from the actual native palette at the first pre-draw capture; repeated indices share identical RGBA and used palette indices must remain unchanged',
        palette: ['PaletteZero', 'PaletteInk'],
        clears: ['g_hdSpeAiClearFrames', 'g_hdSpeDisplayAiClearFrames'],
        displayedCommit: 'matching actual SysCopyScreen carries its fixed base and cumulative clear history; timed LCD flush publishes its own SPE event/commit/frame ticket',
        retirement: 'uncontrolled drawing, changed native actor/target/map, nested event, report/help/quantity, resize, unsupported drawing state or reset permanently invalidates the base',
        input: 'read-only observation adds no input, skip, return, attack or skill-result numeric owner; original unskippable keyflag-0 playback remains intact'
    },
    hdStatusEffectProtocol: {
        version: 1,
        publicApi: ['baye.hd.spe().statusEffect', 'baye.hd.spe().display.statusEffect'],
        protocolField: 'g_hdSpeStatusProtocolVersion',
        bindings: ['g_hdSpeStatusProtocolVersion', ...['g_hdSpeStatus', 'g_hdSpeDisplayStatus'].flatMap(prefix =>
            ['Valid', 'Reason', 'Phase', 'SubjectIndex', 'SubjectPerson', 'SubjectX', 'SubjectY',
                'BeforeLevel', 'AfterLevel', 'BeforeExperience', 'AfterExperience', 'BeforeState', 'AfterState',
                'BeforeHp', 'AfterHp', 'BeforeArms', 'AfterArms', 'LevelMax',
                'MapSX', 'MapSY', 'MapWidth', 'MapHeight', 'ScreenWidth', 'ScreenHeight',
                'RegionX', 'RegionY', 'RegionWidth', 'RegionHeight', 'PaletteZero', 'PaletteInk',
                'BasePixels', 'BaseRgba', 'ClearFrames'].map(field => prefix + field))],
        scope: 'actual FgtChkAtkEnd branch; STACHG_SPE 27, resource index 0, kind 4, upgrade units 0..5 or departure units 6..11, keyflag 0',
        reasons: { upgrade: 1, death: 2 },
        phases: { command: 1, initialize: 2 },
        identity: ['Reason', 'Phase', 'SubjectIndex', 'SubjectPerson', 'SubjectX', 'SubjectY'],
        mutation: ['BeforeLevel', 'AfterLevel', 'BeforeExperience', 'AfterExperience', 'BeforeState', 'AfterState',
            'BeforeHp', 'AfterHp', 'BeforeArms', 'AfterArms', 'LevelMax'],
        base: ['g_hdSpeStatusBasePixels', 'g_hdSpeDisplayStatusBasePixels'],
        baseFormat: '256 row-major original g_VisScr U8 pixel indices captured once before the first clear or sprite draw',
        baseRgba: ['g_hdSpeStatusBaseRgba', 'g_hdSpeDisplayStatusBaseRgba'],
        baseRgbaFormat: '1024 actual little-endian palette RGBA bytes; identical indices share identical colors and every used palette index remains unchanged',
        palette: ['PaletteZero', 'PaletteInk'],
        clears: ['g_hdSpeStatusClearFrames', 'g_hdSpeDisplayStatusClearFrames'],
        displayedCommit: 'actual SysCopyScreen carries fixed subject/base and cumulative clear history; timed LCD flush publishes its matching SPE event/commit/frame ticket',
        initialization: 'phase2 is certified only within the original FgtInit status-check scope, with inactive fight and no guessed command owner',
        retirement: 'uncontrolled drawing, changed subject/map/palette/resource, nested events, overlays, resize, native end or reset permanently invalidates the source',
        input: 'read-only observation adds no skip, return or numeric hold owner; death STATE_SW and zero-HP/zero-Arms upgrades are actual native branch outcomes'
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
    hdSkillResultProtocol: {
        version: 1,
        owner: ['g_hdSkillResultGeneration', 'g_hdSkillResultSession', 'g_hdSkillResultPhase'],
        nativeStack: ['g_hdResultOwnerKind', 'g_hdResultOwnerValid', 'g_hdResultOwnerGeneration', 'g_hdResultOwnerSession'],
        phases: { movie: 1, numbers: 2, hold: 3 },
        value: 'exact unchanged FgtAtvShowNum argument; per-target arms result or original pre-clamp provender amount',
        label: 'actual complete consumed GBK bytes and native coordinates; 64-byte source and separate displayed buffer',
        scene: 'owned BACKPIC, verified equal opaque rectangle, or actual-copy-established nested opaque coverage; no unknown full-arena background inferred',
        display: 'controlled actual movie, label and numeric writes snapshot published at timed LCD flush',
        input: 'no added skip or return; original movie, number and result waiting lifecycle',
        custom: 'presence captured in original showSkill and single willShowPKAnimation invocation',
        retirement: 'uncontrolled drawing, nested owner, malformed source, custom hook, reset; parent source never revived'
    },
    saveProtocol: { version: 0x95, legacyVersions: [0x90, 0x91, 0x92, 0x93, 0x94], filesPerSlot: 2, fightersBytes: 600, goodsQueueBytes: 4000 },
    artifacts
};
fs.writeFileSync(path.join(dir, 'baye.build.json'), JSON.stringify(manifest, null, 2) + '\n');
