# Current State

- Goal: 基于 DSH 的个人「电脑管家」：Web UI 远程指挥、B 站视频/调研、周报、受控桌面操作。
- Stage: 调研已修正；核心控制面骨架完成；通道可插拔；未依赖飞书。
- Handoff: `docs/handoff-2026-11-13.md`；启动提示词：`docs/startup-prompt.md`。
- Primary surface: DSH Web UI；手机通过 Tailscale/PWA；CLI 本地。
- Optional adapters: QQ / 微信 / 飞书 / 邮件（先留接口，不投入）。

## R2：2026-11-15 本机验证

- 项目启动脚本：`butler/desktop/start-dsh-computer-use.ps1`。源码锁定为 0.1.7-rc.1，Web 监听本机回环地址。
- 已验证：Web 页面显示且可选 `computer-use`，同版本 Windows 原生后端能打开记事本、输入、另存为并读回核对。
- 待验证：从 Web 对话调度在线模型，端到端调用原生工具。复现方式和证据路径见 `notes/2026-11-15.md`。

## Key findings (2026-11-13)

- DSH 源码内置 `tool-computer-use`：13 个 GUI 工具 + Windows GDI/SendInput 后端 + `computer-use` preset。
  - npm 包**不包含**；需要源码 overlay 或 DSH Desktop。
- DSH Web：`--host/--port/--public-url/--tls-*`；**无内置鉴权**，远程必须 Tailscale/反代。
- DSH headless：`--json` NDJSON + `--session-id` 续会；已实测。
- B 站：yt-dlp 元数据可用；样例无字幕；`--cookies-from-browser` 在浏览器运行时失败；音频分段可能 `IncompleteRead`；ffmpeg 来自 `imageio-ffmpeg`。
- QQ/微信：QQ NT 窗口是 Electron；Weixin 4.x 是 Qt/MMUI，UIA 基本不可读；都只作为可选输入源。

## Done

- `reports/2026-11-13-dsh-deep-research.md`（修正版深度调研）
- `docs/personal-assistant-design.md`（核心 vs 适配器）
- `docs/engineering-plan.md`（R0–R6）
- `butler/control-plane/`：SQLite job/预算/审批/账本/session；`npm test` 5 项通过
- `butler/feishu-bridge/bridge-v1.mjs`：`--mock` + 续会验证（参考实现，非核心）
- `butler/wechat-reader/uia-read.ps1`：UIA + 截图 + 分区裁剪（参考工具）
- `butler/adapters/`：`InputAdapter` 接口 + `LocalAdapter`
- 10 个 skill 已装，重启后生效

## Next

1. R1：DSH Web + Tailscale/TLS/鉴权，手机可访问。
2. R2：验证 Web 对话中的在线模型能端到端调度 `computer-use`。
3. R3：B 站 30 秒音频 → faster-whisper → 时间戳文本；再扩到周报。
4. R5：周报 MVP（兴趣档案 + 来源 + 去重）。
5. 适配器按需。

## Blockers

- npm 包不含原生 Computer Use。本项目使用已完成冻结依赖安装的源码 checkout。
- B 站字幕需要 cookies；ASR 模型尚未安装。
- DSH Web 无内置鉴权；远程方案需先定（Tailscale/Cloudflare）。
