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

function Log-Ok([string]$m) { $log.Add("[ok] " + $m) | Out-Null }
function Log-Fail([string]$m, [string]$e) { $log.Add("[fail] " + $m + ": " + $e) | Out-Null }

Write-Host "=== Steward 主机部署 $((Get-Date).ToString('s')) ==="

# 0. Node 24
$v = (& node -v 2>$null)
if (-not $v -or ([version]($v.TrimStart('v'))).Major -lt 24) {
    Log-Fail 'Node 24 检查' "需要 Node >= 24.9（当前 $v），请先安装"
} else {
    Log-Ok "Node 24 检查 ($v)"
}

# 1. 应用
if (-not $SkipApps) {
    $appx = Get-AppxPackage -Name 'OpenAI.ChatGPT*' -ErrorAction SilentlyContinue
    if ($appx) { Log-Ok 'ChatGPT 桌面（已装）' } else {
        try {
            $p = Start-Process -FilePath 'winget' -ArgumentList @('install','--id','OpenAI.ChatGPT','--accept-source-agreements','--accept-package-agreements','--silent') -Wait -PassThru -WindowStyle Hidden
            if ($p.ExitCode -eq 0) { Log-Ok 'ChatGPT 桌面安装' } else { Log-Fail 'ChatGPT 桌面安装' "winget exit $($p.ExitCode)，请从 Microsoft Store 手动安装" }
        } catch { Log-Fail 'ChatGPT 桌面安装' $_.Exception.Message }
    }
    if (Test-Path "$env:LOCALAPPDATA\Programs\ZCode\ZCode.exe") { Log-Ok 'ZCode（已装）' } else {
        Log-Fail 'ZCode 安装' '未检测到 ZCode。请手动安装（z.ai 下载，或 U 盘拷贝），装完重跑本脚本'
    }
}

# 2. 管家仓库
try {
    if (-not (Test-Path $StewardRoot)) { New-Item -ItemType Directory -Path $StewardRoot -Force | Out-Null }
    $repo = Join-Path $StewardRoot 'dsh-orb-2'
    if (Test-Path (Join-Path $repo '.git')) {
        git -C $repo pull --ff-only 2>&1 | Out-Null
    } else {
        git clone https://github.com/aiohsdloia/dsh-orb-2.git $repo 2>&1 | Out-Null
    }
    if (Test-Path (Join-Path $repo 'AGENTS.md')) { Log-Ok '管家仓库' } else { Log-Fail '管家仓库' '获取失败（网络或 gh 未登录）' }
} catch { Log-Fail '管家仓库' $_.Exception.Message }

# 3. 运行时解包
if ($RuntimeZip -and (Test-Path $RuntimeZip)) {
    try {
        $dst = Join-Path $StewardRoot 'dsh-orb-2\butler\data'
        New-Item -ItemType Directory -Path $dst -Force | Out-Null
        Expand-Archive -LiteralPath $RuntimeZip -DestinationPath $dst -Force
        $nm = Join-Path $dst 'runtime\dsh-0.2.2-rc.4\node_modules'
        if (Test-Path $nm) { Move-Item $nm (Join-Path $dst 'dsh-0.2.2-rc.4\node_modules') -Force }
        $sl = Join-Path $dst 'runtime\snowluma'
        if (Test-Path $sl) { Copy-Item $sl (Join-Path $StewardRoot 'dsh-orb-2\butler\vendor\snowluma') -Recurse -Force }
        $qq = Join-Path $dst 'runtime\dsh-onebot-qq'
        if (Test-Path $qq) { Copy-Item $qq (Join-Path $StewardRoot 'dsh-orb-2\butler\vendor\dsh-onebot-qq') -Recurse -Force }
        Log-Ok '运行时解包'
    } catch { Log-Fail '运行时解包' $_.Exception.Message }
} else {
    $log.Add('[warn] 未提供 RuntimeZip：DSH 依赖跳过（用 pack-host.ps1 打包后拷贝）') | Out-Null
}

# 4. 密钥
if ($DeepseekKey) {
    try {
        [Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY', $DeepseekKey, 'User')
        Log-Ok 'DeepSeek key 写入用户环境变量'
    } catch { Log-Fail 'DeepSeek key' $_.Exception.Message }
}
if ($ZcodeKey) {
    try {
        $dir = "$env:USERPROFILE\.zcode\v2"
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $f = Join-Path $dir 'provider_config.json'
        $j = if (Test-Path $f) { Get-Content $f -Raw | ConvertFrom-Json } else { $null }
        if (-not $j) {
            $j = [PSCustomObject]@{ schemaVersion = 1; config = [PSCustomObject]@{ providerOrder = @(); providerConfigRules = [PSCustomObject]@{ providerRules = @() } } }
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
        Log-Ok 'ZCode API key 自动写入（跳过登录）'
    } catch { Log-Fail 'ZCode API key' $_.Exception.Message }
}

# 5. 自启
try {
    $startup = [Environment]::GetFolderPath('Startup')
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut((Join-Path $startup 'Steward-Hub.lnk'))
    $sc.TargetPath = Join-Path $StewardRoot 'dsh-orb-2\butler\desktop\start-hub.cmd'
    $sc.WorkingDirectory = Join-Path $StewardRoot 'dsh-orb-2\butler\desktop'
    $sc.WindowStyle = 7
    $sc.Save()
    Log-Ok '开机自启快捷方式'
} catch { Log-Fail '开机自启' $_.Exception.Message }

Write-Host '--- 结果 ---'
$log | ForEach-Object { Write-Host $_ }
Write-Host '--- 需要你手动完成的 ---'
Write-Host '1) QQ：登录小号（SnowLuma 会自动注入）'
Write-Host '2) ChatGPT：打开后 OAuth 登录你的账号'
Write-Host '3) gh auth login 并授权'
Write-Host '4) 完成后跑 health-check.ps1 验证'
