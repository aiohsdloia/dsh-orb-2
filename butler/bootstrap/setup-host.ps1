[CmdletBinding()]
param(
    [string]$RuntimeZip = '',
    [string]$StewardRoot = 'C:\steward',
    [string]$DeepseekKey = '',
    [string]$ZcodeKey = '',
    [switch]$SkipApps
)

$ErrorActionPreference = 'Continue'
$env:HOME = $env:USERPROFILE
$log = New-Object System.Collections.ArrayList

function Step([string]$name, [scriptblock]$fn) {
    try { & $fn; $log.Add("[ok] $name") | Out-Null }
    catch { $log.Add("[fail] $name: $($_.Exception.Message)") | Out-Null }
}

Write-Host "=== Steward 主机部署 $((Get-Date).ToString('s')) ==="

# 0. 前置：Node 24
Step 'Node 24 检查' {
    $v = (& node -v 2>$null)
    if (-not $v -or ([version]($v.TrimStart('v'))).Major -lt 24) {
        throw "需要 Node >= 24.9（当前 $v）。请从 https://nodejs.org 安装 LTS 后重跑。"
    }
}

# 1. 应用：ChatGPT 桌面（winget）
if (-not $SkipApps) {
    Step 'ChatGPT 桌面安装' {
        if (Get-AppxPackage -Name 'OpenAI.ChatGPT*' -ErrorAction SilentlyContinue) { return }
        & winget install --id OpenAI.ChatGPT --accept-source-agreements --accept-package-agreements --silent
        if ($LASTEXITCODE -ne 0) { throw 'winget 失败；请手动从 Microsoft Store 安装 ChatGPT/Codex 桌面版' }
    }
    Step 'ZCode 安装' {
        if (Test-Path "$env:LOCALAPPDATA\Programs\ZCode\ZCode.exe") { return }
        throw '未检测到 ZCode。请手动安装：打开 https://z.ai 下载 ZCode 桌面版（或从 U 盘拷贝安装包），装完重跑本脚本（ZCode 的 API key 登录会由本脚本自动完成）。'
    }
}

# 2. 管家代码
Step '管家仓库' {
    if (-not (Test-Path $StewardRoot)) { New-Item -ItemType Directory -Path $StewardRoot -Force | Out-Null }
    $repo = Join-Path $StewardRoot 'dsh-orb-2'
    if (Test-Path (Join-Path $repo '.git')) {
        & git -C $repo pull --ff-only 2>&1 | Out-Null
    } else {
        & git clone https://github.com/aiohsdloia/dsh-orb-2.git $repo 2>&1 | Out-Null
    }
    if (-not (Test-Path (Join-Path $repo 'AGENTS.md'))) { throw '管家仓库获取失败（网络或 gh 未登录？）' }
}

# 3. 运行时解包
if ($RuntimeZip -and (Test-Path $RuntimeZip)) {
    Step '运行时解包' {
        $dst = Join-Path $StewardRoot 'dsh-orb-2\butler\data'
        New-Item -ItemType Directory -Path $dst -Force | Out-Null
        Expand-Archive -LiteralPath $RuntimeZip -DestinationPath $dst -Force
        Move-Item (Join-Path $dst 'runtime\dsh-0.2.2-rc.4\node_modules') (Join-Path $dst 'dsh-0.2.2-rc.4\node_modules') -Force -ErrorAction SilentlyContinue
        Copy-Item (Join-Path $dst 'runtime\snowluma') (Join-Path $StewardRoot 'dsh-orb-2\butler\vendor\snowluma') -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item (Join-Path $dst 'runtime\dsh-onebot-qq') (Join-Path $StewardRoot 'dsh-orb-2\butler\vendor\dsh-onebot-qq') -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host '[warn] 未提供 RuntimeZip：DSH 依赖将跳过（可用 pack-host.ps1 打包后拷贝）'
}

# 4. 密钥
if ($DeepseekKey) {
    Step 'DeepSeek key 写入环境' {
        [Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY', $DeepseekKey, 'User')
    }
}
if ($ZcodeKey) {
    Step 'ZCode API key 自动登录' {
        $dir = "$env:USERPROFILE\.zcode\v2"
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $f = Join-Path $dir 'provider_config.json'
        $j = if (Test-Path $f) { Get-Content $f -Raw | ConvertFrom-Json } else {
            [PSCustomObject]@{ schemaVersion = 1; config = [PSCustomObject]@{ providerOrder = @(); providerConfigRules = [PSCustomObject]@{ providerRules = @() } } }
        }
        $rule = [PSCustomObject]@{
            providerId = 'bigmodel-api'; templateId = 'bigmodel-api'; providerName = 'BigModel Coding Plan'
            config = [PSCustomObject]@{
                group = 'standard-personal'
                access = [PSCustomObject]@{ type = 'zhipu-coding-plan-api-key'; apiKey = $ZcodeKey }
                personalModelIds = @(); modelOrder = @()
            }
        }
        $j.config.providerOrder = @('bigmodel-api') + ($j.config.providerOrder | Where-Object { $_ -ne 'bigmodel-api' })
        $j.config.providerConfigRules.providerRules = @($rule) + ($j.config.providerConfigRules.providerRules | Where-Object { $_.providerId -ne 'bigmodel-api' })
        [IO.File]::WriteAllText($f, ($j | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
    }
}

# 5. 自启
Step '开机自启快捷方式' {
    $startup = [Environment]::GetFolderPath('Startup')
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut((Join-Path $startup 'Steward-Hub.lnk'))
    $sc.TargetPath = Join-Path $StewardRoot 'dsh-orb-2\butler\desktop\start-hub.cmd'
    $sc.WorkingDirectory = Join-Path $StewardRoot 'dsh-orb-2\butler\desktop'
    $sc.WindowStyle = 7
    $sc.Save()
}

Write-Host "--- 结果 ---"
$log | ForEach-Object { Write-Host $_ }
Write-Host '--- 需要你手动完成的 ---'
Write-Host '1) QQ：登录小号（SnowLuma 会自动注入）'
Write-Host '2) ChatGPT：打开后 OAuth 登录你的账号'
Write-Host '3) gh：跑 `gh auth login`（或 `gh auth login --web`）并授权'
Write-Host '4) 全部完成后跑 health-check.ps1 验证'
