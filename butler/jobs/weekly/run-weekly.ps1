$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
& node (Join-Path $root 'butler/jobs/weekly/run.mjs')
if ($LASTEXITCODE -ne 0) { Write-Warning "weekly failed with $LASTEXITCODE; still running skill-scout" }
& node (Join-Path $root 'butler/jobs/skill-scout/run.mjs')
exit $LASTEXITCODE
