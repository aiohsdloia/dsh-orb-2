[CmdletBinding()]
param(
    [int]$Port = 8080,
    [string]$Host = '127.0.0.1',
    [string]$Token = '',
    [switch]$Lan
)

$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path }
$gateway = Join-Path $root 'butler/remote/gateway.mjs'
if (-not (Test-Path -LiteralPath $gateway)) { throw "missing $gateway" }

$args = @($gateway, '--port', "$Port")
if ($Lan) { $args += '--lan' } else { $args += @('--host', $Host) }
if ($Token) { $args += @('--token', $Token) }
& node @args
