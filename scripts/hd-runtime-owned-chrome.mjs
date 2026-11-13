// Explicit Windows-only OS entry points; importing this module never samples or stops processes.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const FIELDS = ['ProcessId', 'ParentProcessId', 'CreationDate', 'ExecutablePath', 'CommandLine'];
const BIRTH = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/;
const pid = value => Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff;

// Windows command-line quoting, including escaped quotes and spaces in profile paths.
export function parseWindowsCommandLine(text) {
  if (typeof text !== 'string' || text.includes('\0')) return [];
  const args = [];
  let i = 0;
  while (i < text.length) {
    while (/[\t ]/.test(text[i] || '') && i < text.length) i++;
    if (i >= text.length) break;
    let value = '', quoted = false;
    while (i < text.length && (quoted || !/[\t ]/.test(text[i]))) {
      let slashes = 0;
      while (text[i] === '\\') { slashes++; i++; }
      if (text[i] === '"') {
        value += '\\'.repeat(Math.floor(slashes / 2));
        if (slashes % 2) { value += '"'; i++; }
        else if (quoted && text[i + 1] === '"') { value += '"'; i += 2; }
        else { quoted = !quoted; i++; }
      } else {
        value += '\\'.repeat(slashes);
        if (i < text.length && (quoted || !/[\t ]/.test(text[i]))) value += text[i++];
      }
    }
    if (quoted) return []; // Malformed command lines cannot establish ownership.
    args.push(value);
  }
  return args;
}

function normalizedProfile(profile) {
  if (typeof profile !== 'string' || !profile || profile.includes('\0') ||
      !(/^[a-z]:[\\/]/i.test(profile) || /^\\\\[^\\]+\\[^\\]+\\/.test(profile))) {
    throw new TypeError('An absolute, non-root Windows profile path is required');
  }
  const normalized = path.win32.normalize(profile).replace(/[\\/]+$/, '');
  if (normalized.toLowerCase() === path.win32.parse(normalized).root.replace(/[\\/]+$/, '').toLowerCase()) {
    throw new TypeError('A drive/share root is not a browser profile');
  }
  return normalized.toLowerCase();
}

function profileArgument(commandLine) {
  const args = parseWindowsCommandLine(commandLine), values = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--user-data-dir') values.push(args[++i] || '');
    else if (args[i].startsWith('--user-data-dir=')) values.push(args[i].slice(16));
  }
  if (values.length !== 1) return {present: values.length > 0, value: null};
  try { return {present: true, value: normalizedProfile(values[0])}; }
  catch { return {present: true, value: null}; }
}

function records(processes) {
  if (!Array.isArray(processes)) throw new TypeError('CIM process records must be an array');
  const seen = new Set();
  return processes.map(record => {
    if (!record || !Number.isSafeInteger(record.ProcessId) || record.ProcessId < 0 || record.ProcessId > 0xffffffff ||
        !Number.isSafeInteger(record.ParentProcessId) || record.ParentProcessId < 0 ||
        (record.CreationDate !== null && !BIRTH.test(record.CreationDate)) || seen.has(record.ProcessId)) {
      throw new TypeError('Malformed, duplicate or incomplete CIM process identity');
    }
    seen.add(record.ProcessId);
    for (const key of ['ExecutablePath', 'CommandLine']) {
      if (record[key] !== null && typeof record[key] !== 'string') throw new TypeError('Invalid CIM ' + key);
    }
    return Object.fromEntries(FIELDS.map(key => [key, record[key]]));
  });
}

const sameBirth = (a, b) => !!a && !!b && BIRTH.test(a.CreationDate) && a.ProcessId === b.ProcessId && a.CreationDate === b.CreationDate;
const executableKnown = p => typeof p.ExecutablePath === 'string' && !!p.ExecutablePath;
const exactProfile = (p, profile) => profileArgument(p.CommandLine).value === profile;

// Pure ownership calculation. A root PID alone is never sufficient authorization.
export function buildOwnership(processes, {rootPid, profile, sampledAt = null}) {
  if (!pid(rootPid)) throw new TypeError('A positive root PID is required');
  profile = normalizedProfile(profile);
  const all = records(processes), byId = new Map(all.map(p => [p.ProcessId, p]));
  const root = byId.get(rootPid), owned = [], excluded = [];
  const rootVerified = !!root && BIRTH.test(root.CreationDate) && executableKnown(root) &&
    /^(chrome|msedge|chromium)\.exe$/i.test(path.win32.basename(root.ExecutablePath)) && exactProfile(root, profile);
  if (rootVerified) {
    owned.push({...root, depth: 0});
    const included = new Map([[rootPid, owned[0]]]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of all) {
        if (included.has(p.ProcessId)) continue;
        const parent = included.get(p.ParentProcessId);
        if (!parent || !BIRTH.test(p.CreationDate) || p.CreationDate < parent.CreationDate) continue;
        const arg = profileArgument(p.CommandLine);
        if (!executableKnown(p) || !p.CommandLine || (arg.present && arg.value !== profile)) {
          if (!excluded.some(q => q.ProcessId === p.ProcessId)) excluded.push(p);
          continue;
        }
        const entry = {...p, depth: parent.depth + 1};
        included.set(p.ProcessId, entry); owned.push(entry); changed = true;
      }
    }
  }
  return {schemaVersion: 1, rootPid, profile, sampledAt, rootVerified,
    reason: rootVerified ? null : 'Root absent or exact browser/profile identity not verified',
    processes: all, owned, excluded, profileMatches: all.filter(p => exactProfile(p, profile))};
}

function validatedOwnership(original) {
  if (!original || original.schemaVersion !== 1) throw new TypeError('Expected an ownership snapshot');
  const rebuilt = buildOwnership(original.processes, original);
  if (!rebuilt.rootVerified || JSON.stringify(rebuilt.owned) !== JSON.stringify(original.owned)) {
    throw new TypeError('Ownership snapshot is unverified or its recorded owned identities changed');
  }
  return rebuilt;
}

// Pure recheck: only identities already recorded in the supplied snapshot can be stopped.
export function selectCleanupTargets(original, currentProcesses) {
  const basis = validatedOwnership(original), current = records(currentProcesses);
  const byId = new Map(current.map(p => [p.ProcessId, p])), targets = [], refused = [], absent = [];
  for (const old of basis.owned) {
    const now = byId.get(old.ProcessId);
    if (!now) { absent.push(old); continue; }
    const parentOrProfile = now.ParentProcessId === old.ParentProcessId || exactProfile(now, basis.profile);
    if (!sameBirth(old, now) || now.ExecutablePath !== old.ExecutablePath || now.CommandLine !== old.CommandLine || !parentOrProfile) {
      refused.push({recorded: old, current: now, reason: 'PID birth, executable, command line or parent/profile changed'});
      continue;
    }
    targets.push({...now, depth: old.depth});
  }
  targets.sort((a, b) => a.depth - b.depth || a.ProcessId - b.ProcessId); // Stop the spawning root first.
  return {targets, refused, absent};
}

// Pure exit proof, including unrecorded descendants; such processes are blockers, never new kill targets.
export function assessExit(original, currentProcesses) {
  const basis = validatedOwnership(original), current = records(currentProcesses);
  const byId = new Map(current.map(p => [p.ProcessId, p]));
  const anchors = new Map(basis.owned.map(p => [p.ProcessId, p]));
  const descendants = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of current) {
      if (descendants.has(p.ProcessId)) continue;
      const parent = descendants.get(p.ParentProcessId) || anchors.get(p.ParentProcessId);
      if (!parent || !BIRTH.test(p.CreationDate) || p.CreationDate < parent.CreationDate) continue;
      const liveParent = byId.get(parent.ProcessId);
      // A reused PID's newly born children do not belong to the historical browser.
      if (liveParent && !sameBirth(liveParent, parent) && p.CreationDate >= liveParent.CreationDate) continue;
      descendants.set(p.ProcessId, p); changed = true;
    }
  }
  const survivors = basis.owned.map(p => byId.get(p.ProcessId)).filter(p => p && sameBirth(p, anchors.get(p.ProcessId)));
  const profileMatches = current.filter(p => exactProfile(p, basis.profile));
  return {treeExited: survivors.length === 0 && descendants.size === 0 && profileMatches.length === 0,
    survivingRecorded: survivors, rootDescendants: [...descendants.values()], profileMatches};
}

const CIM_BODY = `
$rows = @(Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine -ErrorAction Stop | ForEach-Object {
  [ordered]@{ProcessId=[long]$_.ProcessId;ParentProcessId=[long]$_.ParentProcessId;
    CreationDate=$(if ($null -ne $_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ') } else { $null });
    ExecutablePath=$_.ExecutablePath;CommandLine=$_.CommandLine}
})
`;

async function powershell(script, input = '') {
  if (process.platform !== 'win32') throw new Error('Owned Chrome OS operations require Windows');
  const execution = execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from("$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);\n" + script, 'utf16le').toString('base64')],
  {windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8'});
  execution.child.stdin.on('error', () => {});
  execution.child.stdin.end(input, 'utf8');
  const result = await execution;
  if (result.stderr.trim()) throw new Error('PowerShell diagnostics: ' + result.stderr.trim());
  return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
}

async function readSample() {
  const sample = await powershell(CIM_BODY + "[ordered]@{sampledAt=[DateTime]::UtcNow.ToString('o');processes=@($rows)}|ConvertTo-Json -Depth 8 -Compress");
  sample.processes = records(sample.processes);
  return sample;
}

// Exactly one CIM query per explicit snapshot call. No reads occur merely by importing this module.
export async function snapshotOwnedChrome(rootPid, profile) {
  if (!pid(rootPid)) throw new TypeError('A positive root PID is required');
  normalizedProfile(profile);
  const sample = await readSample();
  return buildOwnership(sample.processes, {rootPid, profile, sampledAt: sample.sampledAt});
}
export const snapshot = snapshotOwnedChrome;

async function stopRecorded(targets) {
  return powershell(`
$targets = [Console]::In.ReadToEnd() | ConvertFrom-Json
${CIM_BODY}
$events = @()
foreach ($t in $targets) {
  $row = $rows | Where-Object { $_.ProcessId -eq $t.ProcessId } | Select-Object -First 1
  if (!$row) { $events += [ordered]@{ProcessId=$t.ProcessId;status='already-exited'}; continue }
  if ($row.CreationDate -cne $t.CreationDate -or $row.ParentProcessId -ne $t.ParentProcessId -or
      $row.ExecutablePath -cne $t.ExecutablePath -or $row.CommandLine -cne $t.CommandLine) {
    $events += [ordered]@{ProcessId=$t.ProcessId;status='refused-identity-change'}; continue
  }
  try {
    $p = Get-Process -Id $t.ProcessId -ErrorAction Stop
    $null = $p.Handle
    $start = $p.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')
    $birth = [DateTime]::Parse($t.CreationDate).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffffZ')
    if ($start -cne $birth) { throw 'Process handle birth does not match the recorded CIM identity' }
    Stop-Process -InputObject $p -Force -ErrorAction Stop
    $events += [ordered]@{ProcessId=$t.ProcessId;CreationDate=$row.CreationDate;handleStartTime=$start;status='stop-requested'}
  } catch { $events += [ordered]@{ProcessId=$t.ProcessId;status='stop-error';error=$_.Exception.Message} }
}
[ordered]@{sampledAt=[DateTime]::UtcNow.ToString('o');processes=@($rows);events=@($events)}|ConvertTo-Json -Depth 8 -Compress
`, JSON.stringify(targets));
}

// Never discovers additional kill targets and never deletes a profile/directory.
export async function cleanupOwnedChrome(ownershipSnapshot, {dryRun = false} = {}) {
  validatedOwnership(ownershipSnapshot);
  if (typeof dryRun !== 'boolean') throw new TypeError('dryRun must be a boolean');
  const proof = {schemaVersion: 1, diagnosticOnly: true, rootPid: ownershipSnapshot.rootPid,
    profile: ownershipSnapshot.profile, dryRun, directoriesDeleted: false, ownershipSnapshot,
    samples: [], stopEvents: [], treeExited: false, errors: []};
  try {
    const before = await readSample(); proof.samples.push({stage: 'before', ...before});
    proof.recheck = selectCleanupTargets(ownershipSnapshot, before.processes);
    if (!dryRun && proof.recheck.targets.length) {
      const stop = await stopRecorded(proof.recheck.targets);
      proof.samples.push({stage: 'stop-recheck', sampledAt: stop.sampledAt, processes: records(stop.processes)});
      proof.stopEvents = stop.events;
    }
    const after = await readSample(); proof.samples.push({stage: 'after', ...after});
    proof.exitVerification = assessExit(ownershipSnapshot, after.processes);
    proof.treeExited = proof.exitVerification.treeExited;
  } catch (error) { proof.errors.push(error.stack || String(error)); }
  return proof;
}
