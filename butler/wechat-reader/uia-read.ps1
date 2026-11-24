# uia-read.ps1 — read-only UIA dump + window screenshot
#
# Safety: this script never clicks, types, sends, or modifies the target app.
# It only reads the UI Automation tree and captures the window pixels.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File uia-read.ps1 -ProcessName Weixin -OutDir .\data\weixin
#   powershell -ExecutionPolicy Bypass -File uia-read.ps1 -Title "Open Lab" -OutDir .\data\openlab -MaxDepth 8
#
# Outputs:
#   <OutDir>\uia.json      full control tree (local only; may contain private text)
#   <OutDir>\uia.txt       indented text tree
#   <OutDir>\window.png    PrintWindow capture (works when occluded; may be black for some apps)
#   <OutDir>\summary.txt   counts + window metadata

param(
  [string]$ProcessName = "",
  [string]$Title = "",
  [string]$OutDir = ".\data\uia-read",
  [int]$MaxDepth = 12,
  [int]$MaxNodes = 5000,
  [double]$SidebarRatio = 0.36,
  [switch]$Redact,
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Shot {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@

[void][Win32Shot]::SetProcessDPIAware()

function Find-TargetWindow {
  if ($ProcessName) {
    $proc = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } |
      Select-Object -First 1
    if ($proc) {
      try { return [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle) } catch {}
    }
  }
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $children = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  for ($i = 0; $i -lt $children.Count; $i++) {
    $e = $children.Item($i)
    $ok = $false
    if ($ProcessName) {
      $p = Get-Process -Id $e.Current.ProcessId -ErrorAction SilentlyContinue
      if ($p -and $p.ProcessName -eq $ProcessName) { $ok = $true }
    }
    if (-not $ok -and $Title) {
      if ($e.Current.Name -and $e.Current.Name.Contains($Title)) { $ok = $true }
    }
    if ($ok -and $e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window) { return $e }
  }
  return $null
}

function Redact-Name([string]$s) {
  if (-not $s) { return "" }
  if ($s.Length -le 24) { return $s }
  return $s.Substring(0, 12) + "…(" + $s.Length + ")"
}

function Walk($element, [int]$depth, [System.Collections.Generic.List[object]]$nodes, [System.Collections.Generic.List[string]]$lines) {
  if ($nodes.Count -ge $MaxNodes -or $depth -gt $MaxDepth) { return }
  $r = $element.Current.BoundingRectangle
  $rx = if ([double]::IsNaN($r.X) -or [double]::IsInfinity($r.X)) { 0 } else { [int][Math]::Round($r.X) }
  $ry = if ([double]::IsNaN($r.Y) -or [double]::IsInfinity($r.Y)) { 0 } else { [int][Math]::Round($r.Y) }
  $rw = if ([double]::IsNaN($r.Width) -or [double]::IsInfinity($r.Width)) { 0 } else { [int][Math]::Round($r.Width) }
  $rh = if ([double]::IsNaN($r.Height) -or [double]::IsInfinity($r.Height)) { 0 } else { [int][Math]::Round($r.Height) }
  $name = $element.Current.Name
  if ($Redact) { $name = Redact-Name $name }
  $node = [ordered]@{
    depth = $depth
    type = $element.Current.ControlType.ProgrammaticName
    name = $name
    automationId = $element.Current.AutomationId
    className = $element.Current.ClassName
    processId = $element.Current.ProcessId
    offscreen = $element.Current.IsOffscreen
    enabled = $element.Current.IsEnabled
    rect = @{ x = $rx; y = $ry; w = $rw; h = $rh }
  }
  $nodes.Add([pscustomobject]$node)
  $lines.Add(("  " * $depth) + "- " + $node.type + " [" + $node.className + "] " + $node.name)
  $child = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetFirstChild($element)
  while ($child -ne $null) {
    Walk $child ($depth + 1) $nodes $lines
    if ($nodes.Count -ge $MaxNodes) { break }
    $child = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetNextSibling($child)
  }
}

$target = Find-TargetWindow
if ($null -eq $target) {
  Write-Error "Target window not found. ProcessName='$ProcessName' Title='$Title'"
  exit 2
}

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$nodes = New-Object System.Collections.Generic.List[object]
$lines = New-Object System.Collections.Generic.List[string]
Walk $target 0 $nodes $lines

$meta = [ordered]@{
  capturedAt = (Get-Date).ToString("o")
  processId = $target.Current.ProcessId
  windowName = $target.Current.Name
  className = $target.Current.ClassName
  nodeCount = $nodes.Count
  maxDepth = $MaxDepth
  redacted = [bool]$Redact
}

[System.IO.File]::WriteAllText((Join-Path $OutDir "uia.json"), ($nodes | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $OutDir "uia.txt"), ($lines -join "`n"), (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $OutDir "summary.txt"), (($meta | ConvertTo-Json -Depth 3)), (New-Object System.Text.UTF8Encoding($false)))

# Screenshot: try PrintWindow first; fall back to CopyFromScreen (foreground) for Qt/MMUI apps.
$shotPath = Join-Path $OutDir "window.png"
$captureMode = "none"
try {
  $hwnd = [IntPtr]$target.Current.NativeWindowHandle
  if ($Foreground) {
    [void][Win32Shot]::ShowWindow($hwnd, 9)   # SW_RESTORE
    [void][Win32Shot]::SetForegroundWindow($hwnd)
    Start-Sleep -Milliseconds 600
  }
  $rect = New-Object Win32Shot+RECT
  [void][Win32Shot]::GetWindowRect($hwnd, [ref]$rect)
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  if ($w -gt 0 -and $h -gt 0) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    [void][Win32Shot]::PrintWindow($hwnd, $hdc, 2) # PW_RENDERFULLCONTENT
    $g.ReleaseHdc($hdc)
    $g.Dispose()
    $bmp.Save($shotPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    if ((Get-Item -LiteralPath $shotPath).Length -gt 1000) {
      $captureMode = "printwindow"
    } else {
      $bmp2 = New-Object System.Drawing.Bitmap $w, $h
      $g2 = [System.Drawing.Graphics]::FromImage($bmp2)
      $g2.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
      $g2.Dispose()
      $bmp2.Save($shotPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp2.Dispose()
      $captureMode = "copyfromscreen"
    }
  }
} catch {
  Add-Content -LiteralPath (Join-Path $OutDir "summary.txt") -Value ("screenshotError: " + $_.Exception.Message)
}
$meta.captureMode = $captureMode
$meta.screenshotBytes = if (Test-Path -LiteralPath $shotPath) { (Get-Item -LiteralPath $shotPath).Length } else { 0 }

# Region crops for OCR: left chat list / right message pane / bottom composer.
$crops = @()
$cropErrors = @()
if (Test-Path -LiteralPath $shotPath) {
  try {
    $shot = [System.Drawing.Image]::FromFile($shotPath)
    $sw = $shot.Width
    $sh = $shot.Height
    $lw = [int][Math]::Round($sw * $SidebarRatio)
    $specs = @(
      @{ name = 'left';     x = 0;  y = 0;                                    w = $lw;        h = $sh },
      @{ name = 'right';    x = $lw; y = 0;                                  w = ($sw - $lw); h = $sh },
      @{ name = 'composer'; x = 0;  y = [int][Math]::Round($sh * 0.85);      w = $sw;        h = [int][Math]::Round($sh * 0.15) }
    )
    foreach ($c in $specs) {
      $rect = [System.Drawing.Rectangle]::new([int]$c.x, [int]$c.y, [int]$c.w, [int]$c.h)
      $cropPath = Join-Path $OutDir ("crop-" + $c.name + ".png")
      $bmpCrop = $shot.Clone($rect, $shot.PixelFormat)
      $bmpCrop.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmpCrop.Dispose()
      $crops += [pscustomobject]@{ name = $c.name; path = $cropPath; width = $rect.Width; height = $rect.Height }
    }
    $shot.Dispose()
  } catch {
    $cropErrors += $_.Exception.Message
  }
}
$meta.crops = $crops
$meta.cropErrors = $cropErrors

[System.IO.File]::WriteAllText((Join-Path $OutDir "summary.txt"), (($meta | ConvertTo-Json -Depth 4)), (New-Object System.Text.UTF8Encoding($false)))

"captured pid=$($meta.processId) name=$($meta.windowName) nodes=$($nodes.Count) mode=$captureMode bytes=$($meta.screenshotBytes) out=$OutDir"
