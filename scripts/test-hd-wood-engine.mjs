#!/usr/bin/env node
// Actual CommonJN/PlcMovie, native font/NUM15 and LCD copy/flush acceptance.
// Reuse the existing compiled skill fixture boundaries; this is not a playable
// battle or an assertion of natural spell success/availability.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import vm from 'node:vm';
import test, { after } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharedFile = join(root, 'scripts/test-hd-skill-engine.mjs');
const sharedSource = readFileSync(sharedFile, 'utf8');
const run = promisify(execFile), sha = b => createHash('sha256').update(b).digest('hex');
const fixtures = new Map(), cleanups = [];

function loadFixture(skill) {
  if (fixtures.has(skill)) return fixtures.get(skill);
  let source = sharedSource.replace(/^import[^\n]*\n/gm, '').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(sharedFile).href));
  assert.ok(source.includes('writeFileSync(filename,source);'));
  source = source.replace('writeFileSync(filename,source);', 'source=customizeNative(source);writeFileSync(filename,source);');
  const context = {
    assert, execFile, createHash, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
    tmpdir, basename, dirname, join, resolve, fileURLToPath, promisify, Buffer, process, console,
    test() {}, after(fn) { cleanups.push(fn); },
    customizeNative(c) {
      const before = c;
      c = c.replace('SKILLEF*skl=FgtGetJNPtr(5);skl->aim=0;skl->state=0;',
        `SKILLEF*skl=FgtGetJNPtr(${skill});assert(skl->aim==0&&skl->state==0);`);
      c = c.replace('mode==22?1:5', `mode==22?1:${skill}`);
      c = c.replace('if(mode==14)dJNSpeId[4]=0;', `if(mode==14)dJNSpeId[${skill - 1}]=0;`);
      c = c.replace('static void copied(U8*screen){SysCopyScreen(screen);record(1);}',
        'static void copied(U8*screen){record(9);SysCopyScreen(screen);record(1);}');
      c = c.replace('hd_skill_resource_shape(&hdScope, srsptr);', 'hd_skill_resource_shape(&hdScope, srsptr);record(10);');
      const setup = '    BuiltAtkAttr(0,3);BuiltAtkAttr(1,10);SKILLEF*skl=';
      assert.ok(c.includes(setup));
      c = c.replace(setup, String.raw`
    if(mode==29||mode==30||mode==31){U32 at=GetResStartAddr(WOOD_SPE)+sizeof(RCHEAD);
      if(mode==29)g_CBnkPtr[at+565+2]=32;
      if(mode==30)g_CBnkPtr[at+6+5]=1;
      if(mode==31)g_CBnkPtr[at+6+2]=1;
    }
    BuiltAtkAttr(0,3);BuiltAtkAttr(1,10);SKILLEF*skl=`);
      const marker = '    if(isLcdDirty&&(!coalesce||messages%61==0))timed_flush_lcd();';
      assert.ok(c.includes(marker));
      c = c.replace(marker, String.raw`
    if(!changed&&mode==24&&g_hdSpeActive){changed=1;U32 at=GetResStartAddr(WOOD_SPE);g_CBnkPtr[at+sizeof(RCHEAD)+46+7]^=1;}
    if(!changed&&mode==25&&g_hdSpeActive){changed=1;baye_hd_spe_picture_drawn(hdSpeCurrent,0,48,16,65,64,0);}
    if(!changed&&mode==26&&g_hdSpeActive){changed=1;SysSelectScreen(g_VisScr);U8 p=128;GamPicShowV(1,1,1,1,&p,g_VisScr);}
    if(!changed&&mode==27&&g_hdSpeActive){changed=1;baye_hd_report_begin(BAYE_HD_REPORT_MSGBOX);record(6);baye_hd_report_end();}
    if(!changed&&mode==28&&g_hdSpeActive){changed=1;g_FlipDrawing=1;}
    if(changed==1&&mode==28){if(isLcdDirty)timed_flush_lcd();g_FlipDrawing=0;changed=2;}
    if(isLcdDirty&&(!coalesce||messages%61==0))timed_flush_lcd();`);
      assert.notEqual(c, before);
      return c;
    }
  };
  vm.createContext(context);
  vm.runInContext(source + '\n globalThis.woodFixture={skillFixture,runSkill,movieOracle,drawPacked,drawLabel,nativeLabel,resource,lib,font,decodeMovie};', context, { filename: sharedFile });
  fixtures.set(skill, context.woodFixture);
  return context.woodFixture;
}
after(() => { for (const cleanup of cleanups) cleanup(); assert.equal(readFileSync(sharedFile, 'utf8'), sharedSource, 'shared native fixture source stays unchanged during this acceptance'); });

function geometry(v, prefix = 'g_hdSpe') { return [v[prefix + 'SceneMode'], v[prefix + 'SceneX'], v[prefix + 'SceneY'], v[prefix + 'SceneWidth'], v[prefix + 'SceneHeight']]; }
function expectedWidth(frame, skill) { return skill === 7 || frame === 0 ? 64 : 66; }
function verifyCopies(rows, f, skill) {
  const end = skill === 6 ? 7 : 0, expected = f.movieOracle(37, 0, end, 48, 16), copies = rows.filter(r => r.kind === 1 && r.values.g_hdSpeId === 37);
  assert.equal(copies.length, end + 1); assert.equal(copies.length, expected.length);
  for (let i = 0; i < copies.length; i++) {
    const v = copies[i].values, e = expected[i], mode = skill === 6 ? 3 : 2;
    assert.equal(v.g_hdSpeSkillId, skill); assert.equal(v.g_hdSpeKind, 2); assert.equal(v.g_hdSpeFrameIndex, e.frame);
    assert.equal(v.g_hdSpeResourceFingerprint, 0xd38c3c8b); assert.equal(v.g_hdSpeResourceLength, 1148);
    assert.equal(v.g_hdSpeCommitSeq, i + 1); assert.equal(v.g_hdSpeCompositionValid, 1); assert.equal(v.g_hdSkillResultSourceValid, 1);
    assert.deepEqual(geometry(v), [mode, 48, 16, expectedWidth(e.frame, skill), 64]);
    assert.deepEqual(geometry(v, 'g_hdSkillResult'), [mode, 48, 16, expectedWidth(e.frame, skill), 64]);
    assert.equal(v.g_hdSkillResultCommitSeq, v.g_hdSpeCommitSeq);
    assert.equal(v.g_hdSkillResultFrameIndex, v.g_hdSpeFrameIndex);
    assert.deepEqual(Buffer.from(v.g_hdSpeVisibleFrames), e.visible); assert.deepEqual(Buffer.from(v.g_hdSpeClearFrames), e.cleared);
    assert.deepEqual(copies[i].pixels, e.pixels, 'every true copied160x96 pixel matches independent ROM/counter replay including the unknown initial columns');
    if (e.frame === 0) for (let y = 16; y < 80; y++) for (let x = 112; x < 114; x++) assert.equal(copies[i].pixels[y * 160 + x], 127, 'first64 picture does not initialize extra2 columns');
  }
  return { expected, copies };
}
function verifyResult(rows, f, skill, value = 123) {
  const expected = f.movieOracle(37, 0, skill === 6 ? 7 : 0, 48, 16), label = f.nativeLabel('dFgtArmsH'), number = f.resource(15), decimal = String(value);
  const shown = rows.filter(r => (r.kind === 2 || r.kind === 4) && r.values.g_hdSkillResultDisplayValid && r.values.g_hdSkillResultPhase >= 2);
  assert.ok(shown.length); let held = false;
  for (const row of shown) {
    const v = row.values, scene = expected[v.g_hdSkillResultDisplayCommitSeq - 1], pixels = Buffer.from(scene.pixels);
    assert.equal(v.g_hdSpeActive, 0); assert.equal(v.g_hdSkillResultActive, 1); assert.equal(v.g_hdSkillResultSourceValid, 1);
    assert.equal(v.g_hdSkillResultSkillId, skill); assert.equal(v.g_hdSkillResultValue, value);
    assert.deepEqual(geometry(v, 'g_hdSkillResultDisplay'), [skill === 6 ? 3 : 2, 48, 16, expectedWidth(scene.frame, skill), 64]);
    assert.deepEqual(Buffer.from(v.g_hdSkillResultDisplayVisibleFrames), scene.visible); assert.deepEqual(Buffer.from(v.g_hdSkillResultDisplayClearFrames), scene.cleared);
    if (v.g_hdSkillResultDisplayLabelValid) { assert.equal(v.g_hdSkillResultDisplayLabelLength, label.length); assert.deepEqual(Buffer.from(v.g_hdSkillResultDisplayLabelGbk).subarray(0, label.length), label); f.drawLabel(pixels, label); }
    else assert.equal(v.g_hdSkillResultDisplayDigitCount, 0);
    for (let i = 0; i < v.g_hdSkillResultDisplayDigitCount; i++) {
      const digit = Number(decimal[i]), poses = v.g_hdSkillResultDisplayDigitDrawCount[i];
      assert.equal(v.g_hdSkillResultDisplayDigitIndex[i], digit); assert.equal(v.g_hdSkillResultDisplayDigitX[i], 55 + 6 * i);
      assert.equal(v.g_hdSkillResultDisplayDigitFirstY[i], 56); assert.equal(v.g_hdSkillResultDisplayDigitY[i], 57 - poses); assert.ok(poses > 0 && poses <= 8);
      for (let p = 0; p < poses; p++) f.drawPacked(pixels, number, { width: 12, height: 16, mask: 0, offset: digit * 32 }, 55 + i * 6, 56 - p);
    }
    assert.deepEqual(row.pixels, pixels, 'real font and NUM15 historical writes plus full surrounding LCD remain byte exact');
    if (v.g_hdSkillResultPhase === 3 && v.g_hdSkillResultDisplayLabelValid && v.g_hdSkillResultDisplayDigitCount === decimal.length && Array.from(v.g_hdSkillResultDisplayDigitDrawCount).slice(0, decimal.length).every(n => n === 8)) held = true;
  }
  assert.ok(held, 'final actual native hold owns all label and numeric poses');
}

test('actual WOOD37 payload and two native ranges preserve real skill names, size mismatch and MP costs', () => {
  const f = loadFixture(6), a = f.decodeMovie(37);
  assert.equal(a.bytes.length, 1148); assert.deepEqual(Array.from(a.bytes.subarray(0, 6)), [0, 10, 8, 2, 0, 7]);
  assert.deepEqual(Array.from(a.pictures, p => [p.width, p.height, p.mask]), [[64, 64, 0], [66, 64, 0]]);
  assert.deepEqual(Array.from(a.units, u => [u.x, u.y, u.cdelay, u.ndelay, u.picIndex]), Array.from({ length: 8 }, (_, i) => [0, 0, 20, 20, i % 2]));
  assert.equal(new TextDecoder('gbk').decode(f.resource(11, 5)).replace(/\0.*$/, ''), '滚木');
  assert.equal(new TextDecoder('gbk').decode(f.resource(11, 6)).replace(/\0.*$/, ''), '落石');
  assert.equal(f.resource(10)[5 * 34 + 6], 20); assert.equal(f.resource(10)[6 * 34 + 6], 25);
});
test('actual rollingwood eight copies certify64 then66 without certifying the first unknown strip', async () => {
  const f = loadFixture(6), rows = await f.runSkill(); verifyCopies(rows, f, 6); verifyResult(rows, f, 6);
});
test('scene geometry cannot pair a future wide logical frame with the old saved64 copy or display', async () => {
  const f = loadFixture(6), rows = await f.runSkill(), before = rows.find(r => r.kind === 9 && r.values.g_hdSpeFrameIndex === 1);
  assert.ok(before); assert.deepEqual(geometry(before.values), [3, 48, 16, 66, 64]);
  assert.deepEqual(geometry(before.values, 'g_hdSkillResult'), [3, 48, 16, 64, 64]);
  assert.deepEqual(geometry(before.values, 'g_hdSpeDisplay'), [3, 48, 16, 64, 64]);
  assert.equal(before.values.g_hdSkillResultCommitSeq, 1); assert.equal(before.values.g_hdSpeCommitSeq, 2);
});
test('resource shape preparation does not publish geometry or certify unknown pixels before any native draw', async () => {
  const f = loadFixture(6), rows = await f.runSkill(), shape = rows.find(r => r.kind === 10);
  assert.ok(shape); assert.equal(shape.values.g_hdSkillResultSourceValid, 1);
  assert.equal(shape.values.g_hdSpeCompositionValid, 0); assert.equal(shape.values.g_hdSpeCommitSeq, 0);
  assert.deepEqual(geometry(shape.values), [0, 0, 0, 0, 0]); assert.deepEqual(geometry(shape.values, 'g_hdSkillResult'), [0, 0, 0, 0, 0]);
});
test('actual clears of66-wide pictures establish those columns before subsequent narrow pictures', async () => {
  const f = loadFixture(6), rows = await f.runSkill(); verifyCopies(rows, f, 6);
  for (const row of rows.filter(r => r.kind === 1 && [2, 4, 6].includes(r.values.g_hdSpeFrameIndex))) {
    assert.equal(row.values.g_hdSpeSceneWidth, 66);
    for (let y = 16; y < 80; y++) for (let x = 112; x < 114; x++) assert.equal(row.pixels[y * 160 + x], 0);
  }
});
test('actual coalesced rollingwood flushes retain copied versus displayed geometry and all numeric footprints', async () => {
  const f = loadFixture(6), rows = await f.runSkill(1); verifyCopies(rows, f, 6); verifyResult(rows, f, 6);
  assert.ok(rows.filter(r => r.kind === 2 && r.values.g_hdSpeActive).length < 8);
});
test('actual native rock0..0 remains one64 copy under unchanged opaque mode2', async () => {
  const f = loadFixture(7), rows = await f.runSkill(); verifyCopies(rows, f, 7); verifyResult(rows, f, 7);
});
for (const skill of [6, 7]) test(`actual skill${skill} zero damage does not create numeric or hold ownership`, async () => {
  const f = loadFixture(skill), rows = await f.runSkill(0, 0); verifyCopies(rows, f, skill);
  assert.ok(rows.every(r => r.values.g_hdSkillResultDigitCount === 0 && r.values.g_hdSkillResultPhase !== 3));
});
for (const [mode, title] of [[2, 'observed custom hook returning-1'], [3, 'observed custom hook handling movie'], [4, 'LookMovie0'], [12, 'original showSkill hook'], [14, 'actual no-movie table']]) test(`${title} cannot authorize nested opaque HD result`, async () => {
  const f = loadFixture(6), rows = await f.runSkill(mode);
  assert.ok(rows.some(r => r.kind === 4 && r.values.g_hdSkillResultPhase === 3));
  for (const row of rows) { assert.equal(row.values.g_hdSkillResultSourceValid, 0); assert.equal(row.values.g_hdSkillResultDisplayValid, 0); assert.equal(row.values.g_hdSpeSceneMode, 0); }
});
for (const [mode, title] of [[5, 'uncontrolled numeric LCD write'], [6, 'real observer reset midmovie'], [7, 'palette endpoint changes'], [8, 'number resource changes'], [9, 'nested unrelated MAIN'], [11, 'real report in numeric stage'], [13, 'actual truncated label'], [24, 'selected resource changes after firstcopy'], [25, 'observer draw outside controlled guard'], [26, 'uncontrolled virtual screen write'], [27, 'real report midmovie'], [28, 'flip restored after invalidation']]) test(`${title} permanently retires mode3 despite later wide draws`, async () => {
  const f = loadFixture(6), rows = await f.runSkill(mode);
  const retired = rows.findIndex(r => mode === 6 ? r.values.g_hdSpeGeneration > 1 : r.values.g_hdSkillResultActive && !r.values.g_hdSkillResultSourceValid);
  assert.ok(retired >= 0);
  for (const row of rows.slice(retired)) { assert.equal(row.values.g_hdSkillResultSourceValid, 0); assert.equal(row.values.g_hdSkillResultDisplayValid, 0); assert.equal(row.values.g_hdSpeCompositionValid, 0); }
});
test('actual Enter cannot skip rollingwood or its original number/hold delay', async () => {
  const f = loadFixture(6), rows = await f.runSkill(18); verifyCopies(rows, f, 6); verifyResult(rows, f, 6);
  assert.equal(rows.at(-1).values.g_hdSpeEndReason, 1); assert.equal(rows.at(-1).values.g_hdResultOwnerKind, 0);
});
for (const [mode, title] of [[29, 'opaque rectangles66x32 and64x64 are not nested'], [30, 'selected native unit origin differs']]) test(`${title} remains LCD instead of acquiring variable-width source`, async () => {
  const f = loadFixture(6), rows = await f.runSkill(mode); assert.ok(rows.filter(r => r.kind === 1).length === 8);
  assert.ok(rows.every(r => !r.values.g_hdSkillResultSourceValid && !r.values.g_hdSpeCompositionValid));
});
test('real initial clear before any opaque draw certifies only its64 rectangle and records that firstclear', async () => {
  const f = loadFixture(6), rows = await f.runSkill(31), first = rows.find(r => r.kind === 1);
  assert.ok(first); assert.deepEqual(geometry(first.values), [3, 48, 16, 64, 64]);
  assert.equal(first.values.g_hdSpeVisibleFrames[0], 0); assert.equal(first.values.g_hdSpeClearFrames[0], 1);
  for (let y = 16; y < 80; y++) for (let x = 48; x < 114; x++) assert.equal(first.pixels[y * 160 + x], x < 112 ? 0 : 127);
  assert.ok(rows.some(r => r.kind === 4 && r.values.g_hdSkillResultSourceValid && r.values.g_hdSkillResultSceneWidth === 66));
});
