[CmdletBinding()]
param(
    [string[]]$Only,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = if ($env:STEWARD_HOME) { (Resolve-Path $env:STEWARD_HOME).Path } else { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$manifestPath = Join-Path $root 'skills/manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$targetDir = Join-Path $env:APPDATA 'com.sculab.openlab\runtime\xdg-config\opencode\skills'
$cacheDir = Join-Path $root 'butler/data/skills-cache'
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null

$env:HOME = $env:USERPROFILE

$results = @()
foreach ($skill in $manifest.skills) {
    if ($Only -and $skill.name -notin $Only) { continue }
    $slug = ($skill.repo -replace 'https://github.com/', '' -replace '[\\/]', '__')
    $cache = Join-Path $cacheDir $slug
    try {
        if (Test-Path -LiteralPath (Join-Path $cache '.git')) {
            & { $ErrorActionPreference = 'Continue'; & git -C $cache fetch --depth 1 origin 2>&1 } | Out-Null
            & { $ErrorActionPreference = 'Continue'; & git -C $cache reset --hard origin/HEAD 2>&1 } | Out-Null
            $action = 'updated'
        } else {
            & { $ErrorActionPreference = 'Continue'; & git clone --depth 1 $skill.repo $cache 2>&1 } | Out-Null
            $action = 'cloned'
        }
        if (-not (Test-Path -LiteralPath (Join-Path $cache '.git'))) { throw "git failed ($action)" }

        $src = Join-Path $cache $skill.path
        if (-not (Test-Path -LiteralPath $src)) { throw "path not found in repo: $($skill.path)" }
        $dst = Join-Path $targetDir $skill.name
        if ($DryRun) {
            $results += "[dry] $($skill.name): $action ($($skill.repo) -> $($skill.path))"
            continue
        }
        if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }
        Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
        Get-ChildItem -LiteralPath $dst -Recurse -Filter 'SKILL.md' -ErrorAction SilentlyContinue | ForEach-Object {
            $content = Get-Content -LiteralPath $_.FullName -Raw
            $content = $content -replace '(?m)^disable-model-invocation:\s*.*\r?\n', ''
            Set-Content -LiteralPath $_.FullName -Value $content -NoNewline -Encoding UTF8
        }
        $results += "[ok] $($skill.name): $action"
    } catch {
        $results += "[fail] $($skill.name): $($_.Exception.Message)"
    }
}

$results += "manifest: $($manifest.skills.Count) skills, target: $targetDir"
$results
