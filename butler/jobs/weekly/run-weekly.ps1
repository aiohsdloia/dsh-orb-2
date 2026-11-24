$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
& node (Join-Path $root 'butler/jobs/weekly/run.mjs')
exit $LASTEXITCODE
