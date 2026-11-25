$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try { [System.Windows.Forms.Application]::EnableVisualStyles() } catch {}

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class DpiFix {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[DpiFix]::SetProcessDPIAware() | Out-Null

$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$assets = Join-Path $root 'butler\assets'
$openLabExe = 'D:\Open_lab\Open Lab\ai4s-workbench.exe'
$openTianshu = Join-Path $PSScriptRoot 'open-tianshu.ps1'

$ink = [System.Drawing.Color]::FromArgb(255, 29, 32, 30)
$paper = [System.Drawing.Color]::FromArgb(255, 247, 247, 244)
$grey = [System.Drawing.Color]::FromArgb(255, 92, 96, 93)
$line = [System.Drawing.Color]::FromArgb(255, 214, 214, 210)

function Load-Scaled([string]$file, [int]$size) {
    try {
        $bmp = [System.Drawing.Image]::FromFile($file)
        $out = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($out)
        $g.InterpolationMode = 'HighQualityBicubic'
        $g.DrawImage($bmp, 0, 0, $size, $size)
        $g.Dispose(); $bmp.Dispose()
        return $out
    } catch { return $null }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = '天枢'
$form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Font
$form.AutoScaleDimensions = New-Object System.Drawing.SizeF(96, 96)
$form.ClientSize = New-Object System.Drawing.Size(420, 320)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = $paper
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 9)
$form.KeyPreview = $true
$form.Add_KeyDown({ if ($_.KeyCode -eq 'Escape') { $form.Close() } })

try {
    $icoFile = Join-Path $assets 'tianshu.ico'
    if (Test-Path -LiteralPath $icoFile) { $form.Icon = New-Object System.Drawing.Icon($icoFile) }
} catch {}

# 页首：从 2x 设计稿裁剪顶部 236px 作为 118px 高的页首背景
try {
    $full = [System.Drawing.Image]::FromFile((Join-Path $assets 'tianshu-picker.png'))
    $crop = New-Object System.Drawing.Bitmap(840, 236)
    $g = [System.Drawing.Graphics]::FromImage($crop)
    $g.DrawImage($full, (New-Object System.Drawing.Rectangle(0, 0, 840, 236)), (New-Object System.Drawing.Rectangle(0, 0, 840, 236)), 'Pixel')
    $g.Dispose(); $full.Dispose()
    $header = New-Object System.Windows.Forms.PictureBox
    $header.Image = $crop
    $header.SizeMode = 'Zoom'
    $header.Size = New-Object System.Drawing.Size(420, 118)
    $header.Location = New-Object System.Drawing.Point(0, 0)
    $header.TabStop = $false
    $form.Controls.Add($header)
} catch { }

function New-Row([string]$title, [string]$sub, [bool]$dark, [System.Drawing.Image]$iconImg, [int]$y, [scriptblock]$action) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.FlatStyle = 'Flat'
    $btn.FlatAppearance.BorderSize = 0
    $btn.Size = New-Object System.Drawing.Size(380, 72)
    $btn.Location = New-Object System.Drawing.Point(20, $y)
    $btn.Text = "$title`n$sub"
    $btn.TextAlign = 'MiddleLeft'
    $btn.TextImageRelation = 'ImageBeforeText'
    $btn.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 10.5)
    $btn.Padding = New-Object System.Windows.Forms.Padding(14, 0, 0, 0)
    if ($iconImg) { $btn.Image = $iconImg; $btn.ImageAlign = 'MiddleLeft' }
    if ($dark) {
        $btn.BackColor = $ink
        $btn.ForeColor = [System.Drawing.Color]::White
        $btn.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::FromArgb(255, 44, 48, 44)
        $btn.FlatAppearance.MouseDownBackColor = [System.Drawing.Color]::Black
    } else {
        $btn.BackColor = [System.Drawing.Color]::White
        $btn.ForeColor = $ink
        $btn.FlatAppearance.BorderSize = 1
        $btn.FlatAppearance.BorderColor = $line
        $btn.FlatAppearance.MouseOverBackColor = [System.Drawing.Color]::FromArgb(255, 240, 240, 236)
        $btn.FlatAppearance.MouseDownBackColor = [System.Drawing.Color]::FromArgb(255, 232, 232, 228)
    }
    $btn.Add_Click({ & $action })
    return $btn
}

$imgT = Load-Scaled (Join-Path $assets 'tianshu.png') 44
$imgO = $null
try { $imgO = [System.Drawing.Icon]::ExtractAssociatedIcon($openLabExe).ToBitmap() } catch {}
if ($imgO) { $imgO = Load-Scaled $openLabExe 44 }

$btnT = New-Row '天枢' 'DSH 个人管家' $true $imgT 118 {
    Start-Process 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File', $openTianshu)
}
$btnO = New-Row 'OpenLab' '开发工作台' $false $imgO 200 {
    if (Test-Path -LiteralPath $openLabExe) { Start-Process $openLabExe } else {
        [System.Windows.Forms.MessageBox]::Show("找不到 OpenLab：$openLabExe", '提示')
    }
}
$btnT.TabIndex = 0
$btnO.TabIndex = 1
$form.Controls.Add($btnT)
$form.Controls.Add($btnO)

function New-Status([int]$x, [int]$y) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Location = New-Object System.Drawing.Point($x, $y)
    $lbl.Size = New-Object System.Drawing.Size(90, 72)
    $lbl.Text = '待检测'
    $lbl.TextAlign = 'MiddleCenter'
    $lbl.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 8.5)
    $lbl.BackColor = [System.Drawing.Color]::Transparent
    return $lbl
}
$stT = New-Status 310 118
$stO = New-Status 310 200
$stT.ForeColor = [System.Drawing.Color]::FromArgb(255, 200, 200, 200)
$stO.ForeColor = $grey
$form.Controls.Add($stT)
$form.Controls.Add($stO)

function Test-Port([int]$p) {
    try { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({
    $ds = Test-Port 3107
    $ol = [bool](Get-Process ai4s-workbench -ErrorAction SilentlyContinue)
    $stT.Text = if ($ds) { '运行中' } else { '未启动' }
    $stT.ForeColor = if ($ds) { [System.Drawing.Color]::FromArgb(255, 60, 120, 70) } else { $grey }
    $stO.Text = if ($ol) { '运行中' } else { '未启动' }
    $stO.ForeColor = if ($ol) { [System.Drawing.Color]::FromArgb(255, 60, 120, 70) } else { $grey }
})
$timer.Start()
$form.Add_FormClosed({ $timer.Stop() })

[System.Windows.Forms.Application]::Run($form)
