# 天枢主机迁移完整教程（零基础版）

> 目标：把天枢装到另一台 Windows 电脑（"主机"），全程约 30-60 分钟。
> 你需要做的所有操作都在这里，按顺序执行即可。

---

## 0. 准备清单

| 项 | 说明 |
|---|---|
| 主机 | Windows 10 / 11 x64，最好常开、通电、不锁屏（Computer Use 需要） |
| 网络 | 能访问 GitHub 的代理/VPN（如 iKuuuVPN，先连上） |
| 账号 | GitHub 账号（浏览器登录状态）、QQ 小号（登在手机上备用扫码） |
| 两个 key | DeepSeek API key；ZCode 的 BigModel key（在你桌面那份 docx 里） |
| 磁盘 | C 盘空闲 ≥ 10 GB |

---

## 1. 安装 Node.js（约 3 分钟）

1. 打开浏览器，访问 **https://nodejs.org**
2. 首页正中有一个绿色大按钮，显示 **LTS** 版本号（如 `24.x.x LTS`）。点它旁边的「**Download Node.js (LTS)**」→ 会下载一个 `.msi` 安装包（约 30-50 MB）。
   - ⚠️ 要 LTS 版（长期支持版），不要 Current 版；版本号必须 ≥ 24.9
3. 双击下载的 `.msi`：
   - 「Welcome」→ Next
   - 勾选同意协议 → Next
   - 安装位置**保持默认** → Next
   - 「Custom Setup」页**什么都不用改**（默认已勾选 Add to PATH）→ Next
   - 如果弹出「是否安装额外工具」→ **取消勾选** → Next
   - Install → 等进度条走完 → Finish
4. **验证**：按 `Win` 键，输入 `powershell`，回车打开 PowerShell（蓝窗口），输入：
   ```powershell
   node -v
   ```
   显示 `v24.x.x` 即成功。若提示"不是内部或外部命令"：把 PowerShell 窗口**关掉重开**再试。

---

## 2. 安装 GitHub CLI（gh，约 2 分钟）

PowerShell 里执行：

```powershell
winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements
```

装完后**关掉 PowerShell 重开**，输入：

```powershell
gh --version
```

出现版本号即成功。

---

## 3. 登录 GitHub（一次，约 2 分钟）

PowerShell 执行：

```powershell
gh auth login
```

按提示依次选择：

1. `What account do you want to log into?` → 选 **GitHub.com**
2. `What is your preferred protocol for Git operations?` → 选 **HTTPS**
3. `Authenticate Git with your GitHub credentials?` → 选 **Yes**
4. `How would you like to authenticate GitHub CLI?` → 选 **Login with a web browser**
5. 屏幕会显示一个 **8 位一次性码**（形如 `XXXX-XXXX`）并问你是否按回车打开浏览器：
   - 按回车（会自动打开浏览器）
   - 若没自动打开：手动访问 **https://github.com/login/device**
6. 浏览器里：输入那个一次性码 → 点 **Authorize github** → 完成
7. 回到 PowerShell，若显示 `✓ Logged in as <你的用户名>` 即成功

验证：

```powershell
gh auth status
```

---

## 4. 拉取天枢代码（约 1 分钟）

```powershell
git clone https://github.com/aiohsdloia/dsh-orb-2.git C:\steward\dsh-orb-2
```

出现 `done.` 即成功。文件夹在 `C:\steward\dsh-orb-2`。

---

## 5. 下载运行时包（约 636 MB，视网速 2-20 分钟）

```powershell
gh release download v0.1.0 --dir C:\steward --repo aiohsdloia/dsh-orb-2
```

完成后 `C:\steward` 下应有 `steward-runtime.zip`。

> 备选：如果这条命令报网络错误，也可以直接用浏览器打开
> `https://github.com/aiohsdloia/dsh-orb-2/releases` 下载 `steward-runtime.zip`，放到 `C:\steward`。

---

## 6. 一键部署（约 5-10 分钟）

把下面命令里 `<...>` 换成你的真实值，整段粘贴执行：

```powershell
powershell -ExecutionPolicy Bypass -File C:\steward\dsh-orb-2\butler\bootstrap\setup-host.ps1 `
  -RuntimeZip "C:\steward\steward-runtime.zip" `
  -DeepseekKey "<DeepSeek API key>" `
  -ZcodeKey "<BigModel key>"
```

**key 从哪拿：**
- DeepSeek key：`platform.deepseek.com` → API keys 页签（sk- 开头）
- ZCode key：你桌面 `文件\新建 Microsoft Word 文档.docx` 里那一长串（`84fffc` 开头）

脚本会自动做：装 ChatGPT 桌面（winget）、解包运行时、把 ZCode key 写进配置（**跳过 ZCode 登录**）、把 DeepSeek key 写成环境变量、创建开机自启。

脚本最后会打印 `[ok]/[fail]` 清单和"需要你手动完成的"列表。

---

## 7. 手动补三件事（脚本提醒后做）

1. **QQ 登录小号**：打开电脑 QQ，登录你的**小号**并保持在线 → SnowLuma 会自动注入（可能需要重启一次电脑或运行 `start-hub.cmd`）
2. **ChatGPT 登录**：打开 ChatGPT 桌面 → 用你的账号 OAuth 登录
3. **ZCode**：如果第 6 步显示 ZCode 未安装 → 浏览器打开 `https://z.ai` 下载安装，装完**重跑第 6 步命令**（会跳过已完成的步骤）

---

## 8. 验收

```powershell
powershell -ExecutionPolicy Bypass -File C:\steward\dsh-orb-2\butler\desktop\health-check.ps1
```

再用**大号 QQ 给小号发「在吗」**：收到回复 = 迁移成功 🎉

日常启动：桌面/开始菜单的「Steward-Hub」快捷方式，或直接开机自动。

---

## 9. 常见问题

| 现象 | 处理 |
|---|---|
| `gh auth login` 打不开浏览器 | 手动开 `https://github.com/login/device` 输码 |
| `git clone` 超时 | 确认 VPN 已连；`git config --global http.proxy http://127.0.0.1:7890` 后再试 |
| setup 里 ChatGPT 装失败 | 手动从 Microsoft Store 装「ChatGPT」，重跑第 6 步 |
| QQ 机器人不回话 | 检查 SnowLuma 网页 `http://127.0.0.1:5099` 里是否显示小号在线；没有则重启 `C:\steward\dsh-orb-2\butler\desktop\start-hub.cmd` |
| 提示"Low integrity" | 运行 `icacls C:\steward /setintegritylevel medium /T /Q` 后重试 |
| 端口被占 | hub 会自动处理；若 3107 被占改 `start-hub.cmd` 里的端口 |

---

*更新方式：以后天枢有新版本，主机上执行 `git -C C:\steward\dsh-orb-2 pull` 即可（hub 每周日也会自动 pull）。*
