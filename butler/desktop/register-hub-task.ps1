[CmdletBinding()]
param(
    [string]$TaskName = 'DSH Steward Hub',
    [int]$Port = 3107,
    [switch]$Register
)

$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
$runner = Join-Path $root 'butler/desktop/start-steward-hub.ps1'
if (-not (Test-Path -LiteralPath $runner)) { throw "missing $runner" }

$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Port $Port -GatewayPort 8080 -Weekly"
$command = "schtasks /Create /TN `"$TaskName`" /SC ONLOGON /RL LIMITED /IT /TR `"$action`" /F"

if (-not $Register) {
    Write-Host 'Dry run. Review the command, then re-run with -Register:'
    Write-Host $command
    Write-Host 'Note: ONLOGON tasks may require an elevated PowerShell. Alternative without admin:'
    Write-Host "  copy butler/desktop/start-hub.cmd into shell:startup"
    return
}

Write-Host "Registering logon task: $TaskName"
& schtasks /Create /TN $TaskName /SC ONLOGON /RL LIMITED /IT /TR $action /F
if ($LASTEXITCODE -ne 0) { throw "schtasks failed with exit code $LASTEXITCODE" }
Write-Host "Registered. Start now with: schtasks /Run /TN `"$TaskName`""
