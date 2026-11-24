[CmdletBinding()]
param(
    [int]$WebUIPort = 5099,
    [string]$WebUIHost = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
$runtime = Join-Path $root 'butler/vendor/snowluma'
$entry = Join-Path $runtime 'index.mjs'
$nodeExe = Join-Path $runtime 'node.exe'
foreach ($p in @($entry, $nodeExe)) { if (-not (Test-Path -LiteralPath $p)) { throw "missing $p" } }

$dataDir = Join-Path $root 'butler/data'
$logDir = Join-Path $dataDir 'logs/snowluma'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$pwFile = Join-Path $dataDir 'snowluma-webui-password.txt'
$pidFile = Join-Path $dataDir 'snowluma.pid'

function Test-Port([int]$p) {
    try { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

if (Test-Port $WebUIPort) {
    Write-Host "[snowluma] port $WebUIPort already listening; nothing to do"
    return
}

if (-not (Test-Path -LiteralPath $pwFile)) {
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $pw = [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'b').Replace('=', '')
    Set-Content -LiteralPath $pwFile -Value $pw -NoNewline -Encoding ASCII
}

$env:SNOWLUMA_WEBUI_HOST = $WebUIHost
$env:SNOWLUMA_WEBUI_PORT = "$WebUIPort"
$env:SNOWLUMA_WEBUI_BOOTSTRAP_PASSWORD = (Get-Content -LiteralPath $pwFile -Raw).Trim()
$env:SNOWLUMA_LOG_DIR = $logDir
$env:SNOWLUMA_LOG_PER_UIN = 'false'
$env:SNOWLUMA_UPDATE_CHECK = 'false'
$env:SNOWLUMA_HOOK_AUTOLOAD = 'true'

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $logDir "runtime-$stamp.out.log"
$err = Join-Path $logDir "runtime-$stamp.err.log"
Write-Host "[snowluma] starting (webui http://${WebUIHost}:$WebUIPort)"
$proc = Start-Process -FilePath $nodeExe -ArgumentList @($entry) -WorkingDirectory $runtime -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
Set-Content -LiteralPath $pidFile -Value $proc.Id -NoNewline -Encoding ASCII

$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
    if (Test-Port $WebUIPort) {
        Write-Host "[snowluma] up; pid=$($proc.Id)"
        Write-Host "[snowluma] webui password file: $pwFile"
        return
    }
    if ($proc.HasExited) { throw "snowluma exited code $($proc.ExitCode); see $err" }
    Start-Sleep -Milliseconds 700
}
throw "snowluma did not open $WebUIPort within 45s"
