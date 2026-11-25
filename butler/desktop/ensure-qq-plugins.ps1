$ErrorActionPreference = 'Continue'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$srcDir = Join-Path $root 'butler\qq-plugins'
$vendorPlugins = Join-Path $root 'butler\vendor\dsh-onebot-qq\plugins'

if (-not (Test-Path -LiteralPath $srcDir)) { Write-Host '[qq-plugins] no butler/qq-plugins, skip'; exit 0 }

foreach ($dir in (Get-ChildItem $srcDir -Directory)) {
    $link = Join-Path $vendorPlugins $dir.Name
    if (Test-Path -LiteralPath $link) {
        $item = Get-Item -LiteralPath $link -Force
        if ($item.LinkType -eq 'Junction' -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            Write-Host "[qq-plugins] junction ok: $($dir.Name)"
        } else {
            Write-Host "[qq-plugins] conflict (real dir, leave as-is): $($dir.Name)"
        }
    } else {
        New-Item -ItemType Junction -Path $link -Target $dir.FullName | Out-Null
        Write-Host "[qq-plugins] linked: $($dir.Name)"
    }
}
