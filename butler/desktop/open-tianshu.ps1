$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$log = Get-ChildItem (Join-Path $root 'butler\data\logs\dsh-0.2\boot-*.out.log') -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $log) { throw '找不到 DSH 启动日志；天枢还没启动（先跑 start-hub.cmd）' }
$line = Get-Content $log.FullName -Tail 5 | Where-Object { $_ -match 'http://127\.0\.0\.1:\d+/\?token=' } | Select-Object -Last 1
if (-not $line) { throw '日志里没有 token URL' }
$url = ($line -split '\s+')[-1]
Start-Process 'msedge.exe' -ArgumentList @("--app=$url", '--new-window')
Write-Host "opened: $url"
