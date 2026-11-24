# Current State

- Project: **DSH Steward（管家）** — 基于 DSH 0.2.2 的个人电脑管家。OpenLab 是宿主 App；Steward 是项目；evolve-agent 是智能体。
- 主通道：DSH Web（3107）+ QQ 机器人（养鱼插件 + SnowLuma）；远程走网关 8080（Tailscale/局域网）。
- 周报：五源主动订阅（arXiv/PubMed/RSS/GitHub/B站）→ DSH 合成 → 文件推送到 QQ。

## 核心栈（2026-11-18 升级）

- DSH **0.2.2-rc.4**（npm 安装）：`butler/data/dsh-0.2.2-rc.4/`，DSH_HOME=`.../home`，web profile。
- Computer Use：官方主线已内置（Cua Driver 原生 provider，win32 二进制随可选依赖）；profile patch 注册 `dsh-computer-use` + `dsh-experimental-computer-use-cua-driver-native`。0.2.2 下完整端到端**待实测**（0.1.7 曾验收通过）。
- QQ：**养鱼插件 dsh-onebot-qq v0.1.2**（link 装进 web profile，12 子插件）+ **SnowLuma v2.4.2**（唯一现存 release；注入 PC 版 QQ，OneBot WS 3001 / HTTP 3000，token 强制）。旧自研 qq.mjs 适配器已删除。
- QQ 身份：机器人=小号 3802375978（QQ 客户端登录小号，SnowLuma 注入）；主人=大号 1084088867。第三方注入有风控风险：只私聊、低频。
- 启动：`butler/desktop/start-dsh-0.2.ps1`（3107）、`butler/adapters/start-snowluma.ps1`（5099/3000/3001，HOOK_AUTOLOAD）、`start-steward-hub.ps1` 看门狗（DSH+网关+SnowLuma+周日周报），`start-hub.cmd` 快捷方式已放 shell:startup。
- 网关：`butler/remote/gateway.mjs` 0.0.0.0:8080 → 127.0.0.1:3107，配对码轮换（`butler/data/gateway-code.txt`）。

## 周报（2026-11-18 完成 M1-M3）

- `butler/jobs/weekly/`：`fetch/{arxiv,pubmed,rss,github}-fetch.mjs`（零 key，单跑验证 15/15/15/20 条）、`run.mjs`（五源聚合 → DSH headless 合成，~19k tokens/期）、`push.mjs`（OneBot HTTP 文件消息 → 大号 QQ，失败退回文本分段）。
- 配置：`butler/config/weekly.example.json`（实际 `weekly.json` 已 gitignore，含 SnowLuma HTTP token）。
- B站源：复用 `bili-brief` 的 `searchVideos/ranking`（interests.json topics，匿名，无 cookie）。
- 已产出 `reports/weekly/2026-W48.md` 并推送验收通过（用户偏好文件形式）。
- 定时：hub 看门狗周日 20:00 触发（状态 `butler/data/weekly/last-run.txt`）；`register-task.ps1` 保留为管理员权限备选。
- 已知：nature.com 在本网络被墙（RSS 自动跳过）；github trending 用搜索 API（新建仓库按 star）近似。

## B站简报（R3，沿用）

- `butler/jobs/bili-brief/`：搜索/排行榜 → 筛选去重 → 简报；`content_pass.py` 做 Top N ASR（faster-whisper base，ctranslate2 锁 4.5.0）。
- 配置 `butler/config/interests.json`（gitignored）。产出 `reports/bili/`。

## 部署目标（未变）

- 目标机：常开 Windows 轻薄本（CPU-only、保持登录不锁屏）；开发机当前已按部署形态运行（hub+网关+SnowLuma+周报）。
- 待验证：Tailscale 远程、锁屏时 Computer Use、目标机冷启动全链路。

## Next

1. 0.2.2 下 Computer Use 端到端实测（Web 会话调用 Cua Driver 工具）。
2. 周报运行一次全链路（周日 20:00 自动触发）观察拆条与失败降级。
3. Tailscale 装好后用 `http://<100.x>:8080/m` 验证远程。
4. 目标机部署演练 + 冷启动自启验证。
