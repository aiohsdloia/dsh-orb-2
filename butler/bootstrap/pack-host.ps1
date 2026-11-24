[CmdletBinding()]
param(
    [string]$Out = 'steward-runtime.zip',
    [switch]$IncludeBiliModels = $true
)

$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$outPath = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $root $Out }

$items = @(
    @{ Path = 'butler/data/dsh-0.2.2-rc.4/node_modules'; InZip = 'runtime/dsh-0.2.2-rc.4/node_modules' },
    @{ Path = 'butler/vendor/snowluma'; InZip = 'runtime/snowluma' },
    @{ Path = 'butler/vendor/dsh-onebot-qq'; InZip = 'runtime/dsh-onebot-qq' }
)
if ($IncludeBiliModels) {
    $items += @{ Path = 'butler/data/bili/models'; InZip = 'runtime/bili-models' }
}

Write-Host 'Packing:'
$total = 0
foreach ($it in $items) {
    $abs = Join-Path $root $it.Path
    if (-not (Test-Path -LiteralPath $abs)) { throw "missing $abs" }
    $size = (Get-ChildItem $abs -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    $total += $size
    Write-Host ("  {0,8:N0} MB  {1}" -f ($size / 1MB), $it.Path)
}
Write-Host ("  {0,8:N0} MB  total" -f ($total / 1MB))

$stage = Join-Path $env:TEMP 'steward-runtime-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($it in $items) {
    $dst = Join-Path $stage $it.InZip
    New-Item -ItemType Directory -Path (Split-Path $dst) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $it.Path) -Destination $dst -Recurse -Force
}
Set-Content -LiteralPath (Join-Path $stage 'runtime-version.json') -Value (@{
    packedAt = (Get-Date).ToString('s')
    dsh = '0.2.2-rc.4'
    snowluma = '2.4.2'
} | ConvertTo-Json) -Encoding UTF8

if (Test-Path $outPath) { Remove-Item $outPath -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $outPath -CompressionLevel Optimal
Write-Host "written: $outPath"
$zi = Get-Item $outPath
Write-Host ("zip size: {0:N0} MB" -f ($zi.Length / 1MB))
Remove-Item $stage -Recurse -Force
