$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$openLabExe = 'D:\Open_lab\Open Lab\ai4s-workbench.exe'
$openTianshu = Join-Path $PSScriptRoot 'open-tianshu.ps1'

function Test-Port([int]$p) {
    try { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = '天枢 · 统一入口'
$form.Size = New-Object System.Drawing.Size(420, 320)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 10)

$title = New-Object System.Windows.Forms.Label
$title.Text = '选择一个工作台'
$title.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 14, [System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(20, 20)
$title.AutoSize = $true
$form.Controls.Add($title)

$btnT = New-Object System.Windows.Forms.Button
$btnT.Text = '天枢（个人电脑管家）'
$btnT.Size = New-Object System.Drawing.Size(360, 52)
$btnT.Location = New-Object System.Drawing.Point(20, 70)
$btnT.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 11)
$btnT.Add_Click({
    Start-Process 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File', $openTianshu) -WindowStyle Hidden
})
$form.Controls.Add($btnT)

$btnO = New-Object System.Windows.Forms.Button
$btnO.Text = 'OpenLab（开发工作台）'
$btnO.Size = New-Object System.Drawing.Size(360, 52)
$btnO.Location = New-Object System.Drawing.Point(20, 140)
$btnO.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 11)
$btnO.Add_Click({
    if (Test-Path -LiteralPath $openLabExe) { Start-Process $openLabExe } else {
        [System.Windows.Forms.MessageBox]::Show("找不到 OpenLab：$openLabExe", '提示')
    }
})
$form.Controls.Add($btnO)

$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(20, 220)
$status.Size = New-Object System.Drawing.Size(380, 50)
$status.Text = '检测中…'
$form.Controls.Add($status)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({
    $ds = Test-Port 3107
    $ol = [bool](Get-Process ai4s-workbench -ErrorAction SilentlyContinue)
    $status.Text = "天枢：$(if($ds){'运行中 (3107)'}else{'未启动'})      OpenLab：$(if($ol){'运行中'}else{'未启动'})"
})
$timer.Start()

[System.Windows.Forms.Application]::Run($form)
