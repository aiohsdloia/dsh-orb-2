$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$outPng = Join-Path $root 'butler\assets\tianshu.png'
$outIco = Join-Path $root 'butler\assets\tianshu.ico'
New-Item -ItemType Directory -Path (Split-Path $outPng) -Force | Out-Null

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'

$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, $size, $size)),
    [System.Drawing.Color]::FromArgb(255, 10, 14, 40),
    [System.Drawing.Color]::FromArgb(255, 24, 32, 72),
    45
)
$g.FillEllipse($bg, 4, 4, $size - 8, $size - 8)

$ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 160, 180, 255), 3)
$g.DrawEllipse($ringPen, 12, 12, $size - 24, $size - 24)

$stars = @(
    @(0.30, 0.30), @(0.52, 0.36), @(0.62, 0.56), @(0.40, 0.64),
    @(0.22, 0.74), @(0.26, 0.90), @(0.42, 0.94)
)
$pts = @()
foreach ($s in $stars) {
    $pts += New-Object System.Drawing.PointF([single]($s[0] * $size), [single]($s[1] * $size))
}
$linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 200, 210, 255), 2)
for ($i = 0; $i -lt $pts.Count - 1; $i++) { $g.DrawLine($linePen, $pts[$i], $pts[$i + 1]) }

for ($i = 0; $i -lt $pts.Count; $i++) {
    $glowR = if ($i -eq 0) { 14 } else { 10 }
    $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 210, 225, 255))
    $g.FillEllipse($glow, $pts[$i].X - $glowR * 2, $pts[$i].Y - $glowR * 2, $glowR * 4, $glowR * 4)
    $coreR = if ($i -eq 0) { 7 } else { 4.5 }
    $core = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 235, 245, 255))
    $g.FillEllipse($core, $pts[$i].X - $coreR, $pts[$i].Y - $coreR, $coreR * 2, $coreR * 2)
}

$g.Dispose()
$bmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$pngBytes = [System.IO.File]::ReadAllBytes($outPng)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([int16]0); $bw.Write([int16]1); $bw.Write([int16]1)
$bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([int16]0); $bw.Write([int16]32); $bw.Write([int32]$pngBytes.Length); $bw.Write([int32]22)
$bw.Write($pngBytes)
$bw.Flush()
[System.IO.File]::WriteAllBytes($outIco, $ms.ToArray())
$bw.Dispose(); $ms.Dispose()

Write-Host "png: $outPng"
Write-Host "ico: $outIco"
