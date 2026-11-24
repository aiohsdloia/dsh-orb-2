$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
$codeFile = Join-Path $root 'butler/data/gateway-code.txt'
if (Test-Path -LiteralPath $codeFile) {
    Write-Host '当前配对码：'
    Get-Content -LiteralPath $codeFile
} else {
    Write-Host '没有配对码文件。网关在运行吗？（butler\remote\start-gateway.ps1 或 start-steward-hub.ps1 -GatewayPort 8080）'
    exit 1
}
