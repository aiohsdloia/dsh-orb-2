[CmdletBinding()]
param(
    [int]$Port = 3107,
    [int]$GatewayPort = 0,
    [int]$SnowLumaPort = 5099,
    [string]$PublicUrl = '',
    [string[]]$TrustedHost = @(),
    [int]$RestartDelaySec = 10,
    [string]$WeeklyTime = '20:00',
    [switch]$Weekly
)

$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
$dshRunner = Join-Path $PSScriptRoot 'start-dsh-0.2.ps1'
$snowLumaRunner = Join-Path $root 'butler/adapters/start-snowluma.ps1'
$weeklyRunner = Join-Path $root 'butler/jobs/weekly/run-weekly.ps1'
$gateway = Join-Path $root 'butler/remote/gateway.mjs'
$logDir = Join-Path $root 'butler/data/logs'
$weeklyState = Join-Path $root 'butler/data/weekly/last-run.txt'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Test-Port([int]$p) {
    try { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

function Start-Hidden([string]$file, [string[]]$argsList, [string]$prefix) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $out = Join-Path $logDir "$prefix-$stamp.out.log"
    $err = Join-Path $logDir "$prefix-$stamp.err.log"
    $proc = Start-Process -FilePath $file -ArgumentList $argsList -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
    Write-Host "[hub] starting $prefix ($($proc.Id)), logs: $out"
    return $proc
}

$dsProc = $null
$gwProc = $null
$slProc = $null
Write-Host "[hub] watchdog started; root=$root port=$Port gatewayPort=$GatewayPort snowlumaPort=$SnowLumaPort weekly=$Weekly"

if (Test-Path -LiteralPath (Join-Path $root 'butler/desktop/sync-skills.ps1')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'butler/desktop/sync-skills.ps1') 2>&1 | ForEach-Object { Write-Host "[hub][skills] $_" }
}
if (Test-Path -LiteralPath (Join-Path $root 'butler/desktop/ensure-qq-plugins.ps1')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'butler/desktop/ensure-qq-plugins.ps1') 2>&1 | ForEach-Object { Write-Host "[hub][qq-plugins] $_" }
}

while ($true) {
    if ($dsProc -and $dsProc.HasExited) {
        Write-Host "[hub] DSH Web exited code $($dsProc.ExitCode)"
        $dsProc = $null
        Start-Sleep -Seconds $RestartDelaySec
    }

    if (-not $dsProc -and -not (Test-Port $Port)) {
        $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $dshRunner, '-Port', "$Port")
        if ($PublicUrl) { $args += @('-PublicUrl', $PublicUrl) }
        foreach ($th in $TrustedHost) { $args += @('-TrustedHost', $th) }
        $dsProc = Start-Hidden 'powershell.exe' $args 'dsh-web'
    }

    if ($GatewayPort -gt 0 -and -not (Test-Port $GatewayPort)) {
        $gwProc = Start-Hidden 'node.exe' @($gateway, '--port', "$GatewayPort", '--lan') 'gateway'
    }

    if ($SnowLumaPort -gt 0 -and -not (Test-Port $SnowLumaPort)) {
        $slProc = Start-Hidden 'powershell.exe' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $snowLumaRunner) 'snowluma'
    }

    if ($Weekly -and (Get-Date).DayOfWeek -eq 'Sunday' -and (Get-Date).ToString('HH:mm') -ge $WeeklyTime) {
        $week = Get-Date -Format 'yyyy-Www'
        $last = if (Test-Path -LiteralPath $weeklyState) { (Get-Content -LiteralPath $weeklyState -Raw).Trim() } else { '' }
        if ($last -ne $week) {
            Write-Host "[hub] weekly trigger ($week)"
            Set-Content -LiteralPath $weeklyState -Value $week -NoNewline -Encoding ASCII
            Write-Host "[hub] git sync before weekly"
            $env:HTTPS_PROXY = 'http://127.0.0.1:7890'
            $openlab = 'C:\Users\10840\Documents\OpenLab\sessions\2026-09-08-1614'
            if (Test-Path -LiteralPath (Join-Path $openlab '.git')) { & git -C $openlab pull --ff-only 2>&1 | Out-Null }
            if (Test-Path -LiteralPath (Join-Path $root '.git')) { & git -C $root pull --ff-only 2>&1 | Out-Null }
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'butler/desktop/sync-skills.ps1') 2>&1 | Out-Null
            Start-Hidden 'powershell.exe' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $weeklyRunner) 'weekly'
        }
    }

    Start-Sleep -Seconds 10
}
