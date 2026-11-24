[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 3107,

    # A concrete local interface address. DSH rejects wildcard binds.
    [string]$HostAddress = '127.0.0.1',

    # Optional reverse-proxy support: advertise this URL and trust these authorities.
    [string]$PublicUrl = '',
    [string[]]$TrustedHost = @()
)

$ErrorActionPreference = 'Stop'
if ($HostAddress -ne '127.0.0.1') {
    throw 'DSH refuses wildcard binds (RCE exposure). Use the authenticated gateway on 8080 for remote access.'
}
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
$runtime = Join-Path $root 'butler/data/dsh-0.2.2-rc.4'
$version = '0.2.2-rc.4'

$cli = Join-Path $runtime 'node_modules/@deepseek-ai/dsh/lib/bin.js'
$installed = Join-Path $runtime 'node_modules/@deepseek-ai/dsh/package.json'
if (-not (Test-Path -LiteralPath $cli)) { throw "missing $cli (run: cd butler/data/dsh-0.2.2-rc.4; npm install)" }
$pkgVer = (Get-Content -LiteralPath $installed -Raw | ConvertFrom-Json).version
if ($pkgVer -ne $version) { throw "expected DSH $version, found $pkgVer" }

$data = Join-Path $root "butler/data/dsh-$version"
$workspace = Join-Path $data 'workspace'
$dshHome = Join-Path $data 'home'
New-Item -ItemType Directory -Path $workspace -Force | Out-Null
New-Item -ItemType Directory -Path $dshHome -Force | Out-Null

$authPath = Join-Path $env:APPDATA 'com.sculab.openlab/runtime/xdg-data/opencode/auth.json'
$key = $env:DEEPSEEK_API_KEY
if ([string]::IsNullOrWhiteSpace($key) -and (Test-Path -LiteralPath $authPath)) {
    $key = (Get-Content -LiteralPath $authPath -Raw | ConvertFrom-Json).deepseek.key
}
if ([string]::IsNullOrWhiteSpace($key)) {
    throw 'Set DEEPSEEK_API_KEY (or provide the OpenLab auth.json on a dev machine).'
}

$previousKey = $env:DEEPSEEK_API_KEY
$previousHome = $env:DSH_HOME
$previousTelemetry = $env:DSH_TELEMETRY_DISABLED
Push-Location -LiteralPath $workspace
try {
    $env:DEEPSEEK_API_KEY = $key
    $env:DSH_HOME = $dshHome
    $env:DSH_TELEMETRY_DISABLED = '1'
    $nodeArgs = @($cli, '--profile', 'web', '--host', $HostAddress, '--port', "$Port", '--no-open')
    if ($PublicUrl) { $nodeArgs += @('--public-url', $PublicUrl) }
    foreach ($th in $TrustedHost) { $nodeArgs += @('--trusted-host', $th) }
    & node @nodeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "DSH Web exited with code $LASTEXITCODE."
    }
} finally {
    $env:DEEPSEEK_API_KEY = $previousKey
    $env:DSH_HOME = $previousHome
    $env:DSH_TELEMETRY_DISABLED = $previousTelemetry
    Pop-Location
}
