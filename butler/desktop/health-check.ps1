[CmdletBinding()]
param(
    [int]$Port = 3107,
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
$logDir = Join-Path $root 'butler/data/logs'
$dshHome = Join-Path $root 'butler/data/dsh-0.1.7-rc.1/home'

$listening = $false
try {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Out-Null
    $listening = $true
} catch {}

$dshProcesses = @(Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*dsh*--profile web*' } |
    Select-Object ProcessId, CommandLine)

$drive = [System.IO.Path]::GetPathRoot($root).TrimEnd('\').TrimEnd(':')
$freeGB = $null
try {
    $freeGB = [math]::Round((Get-PSDrive -Name $drive).Free / 1GB, 1)
} catch {}

$result = [ordered]@{
    time = (Get-Date).ToString('o')
    root = $root
    port = $Port
    listening = $listening
    dshProcesses = $dshProcesses
    dshHome = $dshHome
    dshHomeExists = (Test-Path -LiteralPath $dshHome)
    freeGB = $freeGB
    logDir = $logDir
}
$result | ConvertTo-Json -Depth 4

if (-not $listening -and $Restart) {
    $runner = Join-Path $PSScriptRoot 'start-steward-hub.ps1'
    Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner, '-Port', "$Port") -WindowStyle Hidden
    Write-Host '[health] started hub watchdog'
}
