# DSH 深度调研（修正版）

日期：2026-11-13
触发：用户指出“不必依赖飞书；QQ/微信不是核心功能；调研不够深入”。
本报告修正方向：**核心是助手本身，不是消息通道**；重新深挖 DSH 原生能力与 B 站视频链路。

---

## 0. 修正结论

1. **飞书不是依赖**。它只是一个可选适配器；核心控制面不应绑在飞书上。
2. **QQ/微信不是核心功能**。它们只是“输入来源”，先留 `InputAdapter` 接口，不投入实现。
3. **DSH 已经自带 Computer Use**：源码里有 `@deepseek-ai/dsh-experimental-tool-computer-use`，13 个 GUI 工具 + Windows 后端 + `computer-use` preset。之前完全漏掉了。
4. **主界面应该是 DSH Web UI**，手机通过 Tailscale/反代访问；不是 IM bot。
5. **B 站视频链路必须按“字幕优先、ASR 兜底”设计**；样例视频没有字幕，cookie 提取在浏览器运行时失败。

---

## 1. 证据与方法

- 读 DSH 源码：`upstream/deepseek-harness-orb`。
- 读全局 npm 包：`@deepseek-ai/dsh` 0.2.2-rc.1。
- 实测 `dsh headless --json`、`--session-id`。
- 实测 `dsh web --help`。
- 实测 yt-dlp 2026.10.21 + B 站公开视频元数据。
- 安装 `imageio-ffmpeg` 提供 ffmpeg。
- 未实测：DSH Computer Use 真机点击、B 站 ASR、cookie 字幕。

---

## 2. DSH 原生能力（关键发现）

### 2.1 Computer Use（源码内置，之前漏掉）

包：`packages/experimental/tool-computer-use`，私有、实验性、MIT。

- **13 个 GUI 工具**：`click`、`input_text`、`scroll`、`hotkey`、`wait`、`long_wait`、`screenshot`、`long_press`、`drag`、`open_in_browser`、`open_in_finder`、`list_apps`、`open_app`；另有 `code_agent` / `code_agent_status` / `code_agent_stop`。
- **Windows 后端是生产级**：GDI 捕获、`SendInput` 点击/滚动/热键/长按/拖拽、Ctrl+V 粘贴并恢复剪贴板。
- 每次动作后等待 600ms、重新截图；首轮附前台窗口截图。
- **需要视觉模型**；纯文本路由会拒绝 GUI 工具。
- 以 **agent preset** 形式挂载：`computer-use`，包含 Shell（Windows 用 `pwsh`）、web、GUI 工具、`ask_user_question`、compaction。
- 挂载方式（源码）：
  ```bash
  pnpm dsh web --patch packages/experimental/tool-computer-use/cordis.source.patch.yml
  ```
- **全局 npm 包不包含它**：搜索全局 `@deepseek-ai/dsh/lib` 无 `computer-use`。所以要用它，必须：
  A. 源码构建/运行（需要 `pnpm install` 完成）；
  B. 或使用 DSH Desktop（README 说 Desktop 把它作为签名 runtime extra 挂载）；
  C. 或退回 MCP（Windows-MCP / agent-desktop）。

### 2.2 Headless

- `dsh headless --json` 输出 NDJSON：`session / status / thinking / text / final`。
- `--session-id` 续会；`--approval-policy never|ask`；`--permission-mode`；`--add-dir`。
- 适合周报/批处理/后台任务；不适合持续 GUI 交互。

### 2.3 Web UI

`dsh web --help`：
- `--host` 只接受具体本地接口地址（拒绝 wildcard）。
- `--port`、`--public-url`、`--trusted-host`、`--tls-cert` / `--tls-key`。
- **没有内置登录/鉴权**。远程访问必须靠 Tailscale ACL、Cloudflare Access、反向代理或 DSH 插件补登录门。

### 2.4 其他可复用

- Profile/plugin 体系（`dsh plugin --profile web add`）。
- `--patch` overlay 可组合能力，不必 fork。
- Node 24 `node:sqlite` 可用于控制面。

---

## 3. 计算机使用方案对比

| 方案 | 优点 | 缺点 | 建议 |
|---|---|---|---|
| A. DSH 原生 Computer Use | 与 DSH 深度集成；preset；Windows 生产后端；动作后自动截图 | 私有/实验性；需要源码构建或 Desktop；需要视觉模型；无沙箱 | **首选** |
| B. Windows-MCP | 成熟；工具极全（PowerShell/Registry/FileSystem）；MCP 直连 | 独立进程；权限面大；需 MCP 配置 | 备选/补充 |
| C. agent-desktop | 跨平台；headless；CLI + ref | 需要自写循环；Windows 成熟度待实测 | 跨平台时再用 |

**修正前的方案（Windows-MCP 优先）是基于调研不足的判断；现在应优先 DSH 原生。**

---

## 4. B 站视频链路（实测）

工具：`yt-dlp 2026.10.21` + `imageio-ffmpeg`（ffmpeg 9.0.2）。

### 4.1 元数据

对公开视频 `BV1kZWX62ENY`：

- 成功拿到 title / uploader / duration / 15 个 format。
- **`subtitles` 与 `automatic_captions` 均为空**。
- 结论：不能假设 B 站视频有可拉取字幕。

### 4.2 Cookie 与字幕

- `--cookies-from-browser edge` 失败：`Could not copy Chrome cookie database`。
- 原因：浏览器正在运行，cookie DB 被锁。
- 影响：B 站 AI 字幕、会员清晰度、部分接口需要登录 cookie。
- 方案：
  - 关闭浏览器后重试；或
  - 用独立浏览器 profile / 手动导出 cookies；或
  - 不依赖字幕，直接 ASR。

### 4.3 音频下载

- `--download-sections "*0:00-0:30"` 实测失败：`IncompleteRead`。
- 属于 B 站/网络稳定性问题；需要重试、分片、降低并发。
- ffmpeg 已可用：`imageio_ffmpeg.get_ffmpeg_exe()`。

### 4.4 推荐流水线

```
B 站 URL / 搜索 / 排行榜
  → yt-dlp 元数据（无需登录）
  → 有字幕：拉字幕（需 cookies）
  → 无字幕：下载音频（重试/分片）→ faster-whisper 本地 ASR
  → 章节/关键帧（ffmpeg）
  → 幻灯片/代码/演示画面 → 视觉模型
  → 带时间戳笔记 + 引用
  → 跨周去重 → 周报
```

弹幕（可选）：`comment.bilibili.com/{cid}.xml` 或 API；需要 cid（yt-dlp 元数据未给，需 view API + cookies/UA）。

---

## 5. 远程与多端（不依赖飞书）

- **主入口**：DSH Web UI。
- **手机**：Tailscale 内网访问 `http://<tailscale-ip>:<port>`；或 Cloudflare Tunnel + Access。
- **TLS**：`--tls-cert/--tls-key`；或反代终止 TLS。
- **鉴权**：DSH 无内置登录 → 必须用 Tailscale ACL / Cloudflare Access / 反代 Basic Auth / DSH 登录门插件。
- **可选适配器**：QQ、微信、飞书、邮件——统一 `InputAdapter`，不进入核心。

---

## 6. 修正后的架构

```
核心（必须自己拥有）
  DSH runtime（Web UI / headless）
  control-plane（job / budget / approval / ledger / session）
  scheduler（Task Scheduler / cron）
  memory（兴趣档案 / 来源 / 去重）
  artifacts（周报 / 证据 / 日志）

能力
  DSH 原生 Computer Use（首选）
  B 站视频（yt-dlp + ASR + 关键帧）
  Web 搜索 / 抓取
  MCP 备选（Windows-MCP / agent-desktop）

入口（可插拔）
  Web UI（主）
  CLI（本地）
  手机浏览器 / PWA（Tailscale）
  InputAdapter：QQ / 微信 / 飞书 / 邮件（可选，先留接口）
```

---

## 7. 修正后的路线

| 阶段 | 内容 | 验收 |
|---|---|---|
| R0 | 修正调研/架构/接口 | 本文 + 设计/计划更新 |
| R1 | DSH Web + 远程（Tailscale/TLS/鉴权） | 手机能打开并下只读任务 |
| R2 | DSH 原生 Computer Use（源码或 Desktop） | 完成一个安全 GUI 任务（打开记事本+输入+保存） |
| R3 | B 站视频链路 | 1 个视频：元数据 + ASR/字幕 + 3 条时间戳笔记 |
| R4 | 控制面接入真实任务 | job/预算/审批/账本 |
| R5 | 周报 MVP | 连续 2 周，带来源与成本 |
| R6 | 可选适配器 | QQ/微信/飞书任一，按需 |

---

## 8. 风险与待验证

1. DSH 原生 Computer Use 在 npm 版不可用；源码构建尚未完成（`pnpm install` 部分失败）。
2. DSH Web 无内置鉴权；远程必须加 Tailscale/反代。
3. B 站字幕依赖 cookie；浏览器运行时无法复制 cookie DB；ASR 是主路径。
4. B 站音频下载有 `IncompleteRead`；需要重试/分片。
5. 视觉模型是否稳定可用（DeepSeek V4.1 Flash）需真机验证 GUI 任务。
6. 微信/QQ 只留接口，不投入；UIA 自绘不可读的结论保留。

---

## 9. 待做的最小验证

1. 完成 DSH 源码 `pnpm install`，跑 `pnpm dsh web --patch .../cordis.source.patch.yml`，确认 `computer-use` preset 出现。
2. 用一个 30 秒 B 站视频跑通：yt-dlp 音频 → faster-whisper → 时间戳文本。
3. 用 `dsh web --host <Tailscale-IP>` 从手机打开，确认鉴权边界。
