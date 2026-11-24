# 启动提示词（复制到新对话）

你在 `C:\Users\10840\Documents\OpenLab\projects\dsh-orb-2` 工作。

先按顺序读这些文件，不要重复上一轮的泛泛调研：

1. `AGENTS.md`
2. `KNOWLEDGE.md`
3. `knowledge/current-state.md`
4. `docs/handoff-2026-11-13.md`
5. `docs/engineering-plan.md`
6. `reports/2026-11-13-dsh-deep-research.md`
7. `notes/2026-11-13.md`

## 项目是什么

一个基于 DSH（DeepSeek Harness）的个人电脑助手：

- 核心：DSH Web UI + control-plane + scheduler + memory。
- 能力：B 站视频理解、周报、受控桌面操作。
- QQ / 微信 / 飞书只是可选 `InputAdapter`，**不是核心依赖**；不要把它们做成主线。
- 主入口是 DSH Web UI；手机后续用 Tailscale/PWA。

## 已确认的事实

- 全局 `@deepseek-ai/dsh` 是 `0.2.2-rc.1`；`dsh headless --json` 和 `--session-id` 已验证。
- 源码 `upstream/deepseek-harness-orb` 是 `0.1.7-rc.1`，里面有 `packages/experimental/tool-computer-use`（13 个 GUI 工具 + Windows 后端）。
- npm 包**不含** Computer Use；已建 junction 指向源码包，patch 能被 `--dump-config` 组合，Web 能启动，但 preset 未在 UI 验证。
- 没有 Tailscale / cloudflared；只有 SSH。
- DSH 自带 SenseVoice ASR 包，但模型未下载；Python 没有 faster-whisper。
- B 站：yt-dlp 元数据可用；样例无字幕；cookie 提取在浏览器运行时失败；音频分段可能 `IncompleteRead`。
- `butler/control-plane/` 已有 SQLite 控制面，`npm test` 5 项通过。
- `butler/adapters/` 已有 `InputAdapter` + `LocalAdapter`。

## 现在只做一件事

先决定并执行其中一个，不要同时开工：

A. **锁 DSH `0.1.7-rc.1`**，验证原生 Computer Use：启动 Web（带 `tool-computer-use/cordis.patch.yml`），确认 `computer-use` preset 出现，完成一个安全 GUI 任务（打开记事本→输入→保存）。
B. **保持 `0.2.2-rc.1`**，跳过原生 Computer Use，先用现有 PowerShell/UIA 做只读或简单操作。

如果没收到明确选择，默认选 A，但先说明理由和回滚方式。

## 约束

- 优先使用现有工具；不新增 Feishu 依赖。
- 不打印/不落库 API key；key 从 OpenLab `auth.json` 运行时读取。
- 原始屏幕截图/OCR 只放 `butler/data/`（gitignored）；报告不写聊天内容。
- 未跑验证不得声称完成。
- 不提交 secrets；不在未验证前做自动点击/发送/删除。
- 先复述目标，给出 3 步计划，再开始。

## 更新（2026-11-15）

- R2 已验收：Web 对话选择 computer-use，模型完成打开记事本→输入→另存为→读回→哈希核对。
  - 证据：utler/data/cu-acceptance.txt，内容 DSH-CU-ACCEPT-2026-11-15，SHA-256 1BE738B29C15E6E8EFF6AC094CEA3EA417E3C3EA9AD69416B92B38660AB0FCDF。
  - 偏差：open_app 对 Notepad 各名称失败；用 Win+R → notepad 或 pwsh Start-Process。
- R3 需求修正：B 站第一版是「关注 UP + 兴趣搜索/发现 → 筛选去重 → 带来源简报」；**不要先做 ASR**。字幕/ASR 只用于筛选后的视频。
- 新对话默认先做 R3 第一版，不要重新做 R2 验收。
