[CmdletBinding()]
param(
    [string]$Time = '09:00',
    [ValidateSet('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')]
    [string]$Day = 'MON',
    [switch]$Register
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$runner = Join-Path $root 'butler/jobs/weekly/run-weekly.ps1'
$taskName = 'DSH Steward Weekly'
$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runner`""

$command = "schtasks /Create /TN `"$taskName`" /SC WEEKLY /D $Day /ST $Time /TR `"$action`" /F"
if (-not $Register) {
    Write-Host 'Dry run. Review the command, then re-run with -Register:'
    Write-Host $command
    return
}

Write-Host "Registering scheduled task: $taskName"
& schtasks /Create /TN $taskName /SC WEEKLY /D $Day /ST $Time /TR $action /F
if ($LASTEXITCODE -ne 0) { throw "schtasks failed with exit code $LASTEXITCODE" }
Write-Host "Registered. Test with: schtasks /Run /TN `"$taskName`""
