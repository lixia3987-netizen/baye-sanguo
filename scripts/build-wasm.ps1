param(
    [switch]$StageOnly,
    [string]$SdkRoot = $env:BAYE_EMSDK_ROOT,
    [string]$CMakePath,
    [string]$NinjaPath,
    [int]$Jobs = [Environment]::ProcessorCount
)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBuild = Join-Path $taskRoot 'build/wasm'
if (-not $SdkRoot) { $SdkRoot = Join-Path $taskRoot 'build/toolchain/emsdk' }
$SdkRoot = (Resolve-Path -LiteralPath $SdkRoot).Path
$taskPython = (Get-Command python -ErrorAction Stop).Source
$taskEmcc = Join-Path $SdkRoot 'upstream/emscripten/emcc.py'
$taskEmcmake = Join-Path $SdkRoot 'upstream/emscripten/emcmake.py'
if (-not $CMakePath) {
    $CMakePath = Join-Path $taskRoot 'build/toolchain/python/cmake/data/bin/cmake.exe'
    if (-not (Test-Path -LiteralPath $CMakePath)) { $CMakePath = (Get-Command cmake -ErrorAction Stop).Source }
}
if (-not $NinjaPath) {
    $NinjaPath = Join-Path $taskRoot 'build/toolchain/python/bin/ninja.exe'
    if (-not (Test-Path -LiteralPath $NinjaPath)) { $NinjaPath = (Get-Command ninja -ErrorAction Stop).Source }
}

function Invoke-TaskTool {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Build tool failed with exit code $LASTEXITCODE" }
}

$taskVersionOutput = & $taskPython $taskEmcc --version
if ($LASTEXITCODE -ne 0 -or ($taskVersionOutput -join ' ') -notmatch '\b3\.1\.51\b') {
    throw 'Expected the activated Emscripten 3.1.51 SDK. See docs/wasm-build.md.'
}
if (-not $env:SOURCE_DATE_EPOCH) {
    $env:SOURCE_DATE_EPOCH = (& git -C $taskRoot log -1 --format=%ct).Trim()
}
$taskVersionHeader = Join-Path $taskRoot 'vendor/iBaye/src/baye/version.h'
if (Test-Path -LiteralPath $taskVersionHeader) { Remove-Item -LiteralPath $taskVersionHeader }
New-Item -ItemType Directory -Force -Path $taskBuild | Out-Null
Invoke-TaskTool $taskPython @($taskEmcmake, $CMakePath, '-S', (Join-Path $taskRoot 'vendor/iBaye'), '-B', $taskBuild,
    '-G', 'Ninja', "-DCMAKE_MAKE_PROGRAM=$NinjaPath", "-DPython3_EXECUTABLE=$taskPython")
Invoke-TaskTool $CMakePath @('--build', $taskBuild, '--parallel', [string]$Jobs)

$taskSourceList = Join-Path $taskBuild 'engine-source-files'
$taskTrackedFiles = @(& git -C $taskRoot ls-files vendor/iBaye)
if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate engine sources.' }
[IO.File]::WriteAllBytes($taskSourceList, [Text.Encoding]::UTF8.GetBytes(($taskTrackedFiles -join [char]0) + [char]0))
$taskRevision = (& git -C $taskRoot rev-parse HEAD).Trim()
$taskModified = (& git -C $taskRoot diff --name-only HEAD -- vendor/iBaye) -join "`n"
$taskCMakeVersion = (& $CMakePath --version)[0]
$taskOutput = Join-Path $taskBuild 'src'
Invoke-TaskTool 'node' @((Join-Path $PSScriptRoot 'write-wasm-manifest.mjs'), $taskOutput, '3.1.51',
    $taskSourceList, $taskRevision, $taskCMakeVersion, $taskModified)
if ($StageOnly) {
    Write-Output "Validated staged artifacts: $taskOutput"
    return
}
foreach ($taskArtifact in @('baye.js', 'baye.wasm', 'baye.wasm.map', 'baye.build.json')) {
    Copy-Item -LiteralPath (Join-Path $taskOutput $taskArtifact) -Destination (Join-Path $taskRoot "js/$taskArtifact")
}
Write-Output 'Installed validated JS, WASM, source map and build manifest.'
