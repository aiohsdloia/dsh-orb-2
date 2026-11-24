[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Text,
    [string]$File,
    [string]$TargetQq = '1084088867',
    [string]$OnebotHttp = 'http://127.0.0.1:3000',
    [string]$TokenFile = 'C:\Users\10840\Documents\OpenLab\projects\dsh-orb-2\butler\data\dsh-0.2.2-rc.4\home\dsh-onebot-qq\config.json'
)

$ErrorActionPreference = 'Stop'
$token = $null
if (Test-Path -LiteralPath $TokenFile) {
    try {
        $raw = [System.IO.File]::ReadAllText($TokenFile, [System.Text.Encoding]::UTF8)
        $token = ($raw | ConvertFrom-Json).onebot.httpToken
    } catch {}
}
if (-not $token) { throw "cannot read onebot httpToken from $TokenFile" }

$headers = @{ 'Content-Type' = 'application/json'; 'Authorization' = "Bearer $token" }

if ($File) {
    $name = Split-Path -Leaf $File
    $up = Invoke-RestMethod -Uri "$OnebotHttp/upload_private_file" -Method Post -Headers $headers -Body (@{ user_id = [long]$TargetQq; file = $File; name = $name } | ConvertTo-Json -Depth 4)
    $fileId = $up.data.file
    $msg = @{ type = 'file'; data = @{ file = $fileId; name = $name } }
} else {
    $msg = @{ type = 'text'; data = @{ text = $Text } }
}

Invoke-RestMethod -Uri "$OnebotHttp/send_private_msg" -Method Post -Headers $headers -Body (@{ user_id = [long]$TargetQq; message = @($msg) } | ConvertTo-Json -Depth 6) | Out-Null
Write-Host "notified"
