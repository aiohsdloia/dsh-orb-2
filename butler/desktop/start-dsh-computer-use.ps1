[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 3107
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$source = Join-Path $root 'upstream/deepseek-harness-orb'
$version = '0.1.7-rc.1'
$revision = '51f09764d7ff99947be08ebbb2ca2388faab3df4'

$head = & git -C $source rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -cne $revision) {
    throw "Expected DSH $version source at commit $revision."
}

$cli = Join-Path $source 'apps/cli/src/bin.ts'
$tsx = Join-Path $source 'node_modules/tsx/dist/esm/index.mjs'
$webIndex = Join-Path $source 'apps/web/dist/index.html'
$patch = Join-Path $source 'packages/experimental/tool-computer-use/cordis.patch.yml'
if (-not (Test-Path -LiteralPath $tsx)) {
    throw 'Run pnpm install --frozen-lockfile in the pinned DSH checkout.'
}
if (-not (Test-Path -LiteralPath $webIndex)) {
    throw 'Run pnpm build:web in the pinned DSH checkout.'
}

$data = Join-Path $root "butler/data/dsh-$version"
$workspace = Join-Path $data 'workspace'
New-Item -ItemType Directory -Path $workspace -Force | Out-Null

$authPath = Join-Path $env:APPDATA 'com.sculab.openlab/runtime/xdg-data/opencode/auth.json'
$key = (Get-Content -LiteralPath $authPath -Raw | ConvertFrom-Json).deepseek.key
if ([string]::IsNullOrWhiteSpace($key)) {
    throw 'OpenLab DeepSeek credential is unavailable.'
}

$previousKey = $env:DEEPSEEK_API_KEY
$previousHome = $env:DSH_HOME
$previousTelemetry = $env:DSH_TELEMETRY_DISABLED
$previousTsConfig = $env:TSX_TSCONFIG_PATH
Push-Location -LiteralPath $workspace
try {
    $env:DEEPSEEK_API_KEY = $key
    $env:DSH_HOME = Join-Path $data 'home'
    $env:DSH_TELEMETRY_DISABLED = '1'
    $env:TSX_TSCONFIG_PATH = Join-Path $source 'tsconfig.json'
    & node --import ([uri]$tsx).AbsoluteUri $cli --profile web --patch $patch --host 127.0.0.1 --port $Port --no-open
    if ($LASTEXITCODE -ne 0) {
        throw "DSH Web exited with code $LASTEXITCODE."
    }
} finally {
    $env:DEEPSEEK_API_KEY = $previousKey
    $env:DSH_HOME = $previousHome
    $env:DSH_TELEMETRY_DISABLED = $previousTelemetry
    $env:TSX_TSCONFIG_PATH = $previousTsConfig
    Pop-Location
}
