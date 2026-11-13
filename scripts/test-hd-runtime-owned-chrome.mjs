// Pure recorded-process fixtures only. Never call the OS snapshot/cleanup entry points here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWindowsCommandLine, buildOwnership, selectCleanupTargets, assessExit,
  snapshotOwnedChrome, snapshot, cleanupOwnedChrome,
} from './hd-runtime-owned-chrome.mjs';

const profile = String.raw`F:\project\baye-sanguo\build\owned case\private-browser-profile`;
const exe = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const birth = second => `2026-10-11T00:00:${String(second).padStart(2, '0')}.0000000Z`;
const row = (ProcessId, ParentProcessId, second, extra = {}) => ({
  ProcessId, ParentProcessId, CreationDate: birth(second), ExecutablePath: exe,
  CommandLine: `"${exe}" --type=renderer`, ...extra,
});
const root = (extra = {}) => row(100, 1, 1, {CommandLine: `"${exe}" --user-data-dir="${profile}"`, ...extra});
const child = (extra = {}) => row(101, 100, 2, extra);
const grandchild = (extra = {}) => row(102, 101, 3, extra);
const build = processes => buildOwnership(processes, {rootPid: 100, profile, sampledAt: 'fixture'});
const ids = records => records.map(p => p.ProcessId);

test('OS entry points remain explicit exports; pure import is sufficient for fixture tests', () => {
  assert.equal(snapshot, snapshotOwnedChrome);
  assert.equal(typeof snapshotOwnedChrome, 'function');
  assert.equal(typeof cleanupOwnedChrome, 'function');
});

test('Windows quoting parses spaces, split profile option and escaped quotes', () => {
  assert.deepEqual(parseWindowsCommandLine(`"${exe}" --user-data-dir "${profile}"`),
    [exe, '--user-data-dir', profile]);
  assert.deepEqual(parseWindowsCommandLine(String.raw`chrome.exe "a\"b" "c\\"`),
    ['chrome.exe', 'a"b', 'c\\']);
  assert.deepEqual(parseWindowsCommandLine('chrome.exe "unclosed'), []);
  assert.deepEqual(parseWindowsCommandLine('chrome.exe\0--user-data-dir=x'), []);
});

test('exact profile permits Windows case/slash normalization, not prefix or unrelated option', () => {
  const normalized = root({CommandLine: `"${exe}" --user-data-dir="${profile.toUpperCase().replaceAll('\\', '/')}"`});
  assert.equal(build([normalized]).rootVerified, true);
  for (const CommandLine of [
    `"${exe}" --user-data-dir="${profile}-other"`,
    `"${exe}" --note="${profile}"`,
    `"${exe}" --user-data-dir="${profile}" --user-data-dir="${profile}"`,
  ]) assert.equal(build([root({CommandLine})]).rootVerified, false);
});

test('root requires live recorded birth, browser executable and exact profile together', () => {
  for (const processes of [[], [root({CreationDate: null})], [root({ExecutablePath: String.raw`C:\other.exe`})],
    [root({CommandLine: null})], [root({ExecutablePath: null})]]) {
    const s = build(processes);
    assert.equal(s.rootVerified, false);
    assert.deepEqual(s.owned, []);
  }
});

test('invalid root/profile and duplicate or malformed process identities fail closed', () => {
  for (const rootPid of [0, -1, 1.5, 0x100000000]) {
    assert.throws(() => buildOwnership([], {rootPid, profile}), /positive root PID/);
  }
  for (const bad of ['relative/profile', 'C:\\', '\\\\server\\share\\', 'C:\\bad\0profile']) {
    assert.throws(() => buildOwnership([], {rootPid: 100, profile: bad}), TypeError);
  }
  assert.throws(() => build([root(), root()]), /duplicate/);
  assert.throws(() => build([root({CreationDate: '2026-10-11'})]), /identity/);
  assert.throws(() => build([root({CommandLine: 123})]), /CommandLine/);
});

test('descendant fixed point handles reversed census order and retains each birth/depth', () => {
  const s = build([grandchild(), child(), root()]);
  assert.equal(s.rootVerified, true);
  assert.deepEqual(ids(s.owned), [100, 101, 102]);
  assert.deepEqual(s.owned.map(p => p.depth), [0, 1, 2]);
  assert.equal(s.owned[2].CreationDate, birth(3));
});

test('older process and descendants with a different explicit profile are never owned', () => {
  const wrong = child({CommandLine: `"${exe}" --user-data-dir="${profile}-other"`});
  const s = build([root(), wrong, grandchild(), row(103, 100, 0)]);
  assert.deepEqual(ids(s.owned), [100]);
  assert.deepEqual(ids(s.excluded), [101]);
});

test('missing executable/command line does not authorize a child; disconnected profile match is not owned', () => {
  const detached = row(200, 999, 2, {CommandLine: root().CommandLine});
  const s = build([root(), child({ExecutablePath: null}), grandchild(), detached]);
  assert.deepEqual(ids(s.owned), [100]);
  assert.deepEqual(ids(s.profileMatches), [100, 200]);
  assert.equal(assessExit(s, [detached]).treeExited, false);
  assert.deepEqual(selectCleanupTargets(s, [detached]).targets, []);
});

test('cleanup pure recheck selects recorded unchanged identities, root before descendants', () => {
  const s = build([grandchild(), child(), root()]), before = structuredClone(s);
  const selected = selectCleanupTargets(s, [grandchild(), root(), child()]);
  assert.deepEqual(ids(selected.targets), [100, 101, 102]);
  assert.deepEqual(selected.refused, []);
  assert.deepEqual(s, before);
});

test('PID reuse or changed executable/command line is refused rather than stopped', () => {
  const s = build([root(), child()]);
  for (const changed of [child({CreationDate: birth(9)}), child({ExecutablePath: String.raw`C:\other.exe`}),
    child({CommandLine: 'changed'})]) {
    const selected = selectCleanupTargets(s, [root(), changed]);
    assert.deepEqual(ids(selected.targets), [100]);
    assert.equal(selected.refused[0].recorded.ProcessId, 101);
  }
});

test('reparented recorded child without exact profile is refused; root exact-profile identity remains valid', () => {
  const s = build([root(), child()]);
  const selected = selectCleanupTargets(s, [root({ParentProcessId: 9}), child({ParentProcessId: 9})]);
  assert.deepEqual(ids(selected.targets), [100]);
  assert.equal(selected.refused[0].recorded.ProcessId, 101);
});

test('recorded orphan remains a rechecked target, and parent exit alone cannot prove cleanup', () => {
  const s = build([root(), child()]);
  assert.deepEqual(ids(selectCleanupTargets(s, [child()]).targets), [101]);
  const exit = assessExit(s, [child()]);
  assert.equal(exit.treeExited, false);
  assert.deepEqual(ids(exit.survivingRecorded), [101]);
  assert.equal(assessExit(s, []).treeExited, true);
});

test('later unknown descendants block exit but are never added to cleanup targets', () => {
  const s = build([root(), child()]), late = grandchild();
  assert.deepEqual(ids(selectCleanupTargets(s, [root(), child(), late]).targets), [100, 101]);
  const orphanExit = assessExit(s, [late]);
  assert.equal(orphanExit.treeExited, false);
  assert.deepEqual(ids(orphanExit.rootDescendants), [102]);
  assert.deepEqual(selectCleanupTargets(s, [late]).targets, []);
});

test('reused root PID and its later children do not become historical browser ownership', () => {
  const s = build([root()]);
  const reused = root({CreationDate: birth(10), CommandLine: `"${exe}" --user-data-dir="${profile}-other"`});
  const later = row(300, 100, 11);
  assert.deepEqual(selectCleanupTargets(s, [reused, later]).targets, []);
  assert.equal(assessExit(s, [reused, later]).treeExited, true);
});

test('an exact-profile newcomer blocks exit without becoming an additional stop target', () => {
  const s = build([root()]), newcomer = row(300, 1, 10, {CommandLine: root().CommandLine});
  assert.deepEqual(selectCleanupTargets(s, [newcomer]).targets, []);
  const exit = assessExit(s, [newcomer]);
  assert.equal(exit.treeExited, false);
  assert.deepEqual(ids(exit.profileMatches), [300]);
});

test('tampered or unverified ownership snapshots cannot authorize any cleanup calculation', () => {
  const s = build([root(), child()]), tampered = structuredClone(s);
  tampered.owned.push({...row(999, 1, 3), depth: 1});
  assert.throws(() => selectCleanupTargets(tampered, []), /recorded owned identities changed/);
  assert.throws(() => assessExit(tampered, []), /recorded owned identities changed/);
  assert.throws(() => selectCleanupTargets(build([]), []), /unverified/);
});
