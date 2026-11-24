# Codex 交接简报 — DSH Steward

> 给接手推进的 Codex。先读本文件，再读各文档；不要重复已完成的验证。

## 0. 一句话

**DSH Steward（管家）**：一个基于 DeepSeek Harness 的个人电脑管家，目标是部署到一台**常开 Windows 轻薄本**做 24/7 Hub：DSH Web + 周报（B 站发现→筛选→内容速览）+ 控制面（job/预算/审批/账本）+ 远程（PC-手机 / PC-PC）。

工作区：`C:\Users\10840\Documents\OpenLab\projects\dsh-orb-2`

## 1. 先读这些文件（按顺序）

1. `AGENTS.md`（规则，尤其是原则 11–13）
2. `KNOWLEDGE.md`、`knowledge/current-state.md`
3. `PROJECT.md`（项目名与边界）
4. `docs/engineering-plan.md`（R0–R6）
5. `docs/deployment.md`（目标机部署检查单）
6. `reports/2026-11-13-dsh-deep-research.md`（DSH 能力调研）
7. `notes/2026-11-16.md`（最近一轮工作）

## 2. 关键事实（已验证，不要重做）

| 项 | 事实 |
|---|---|
| DSH 运行时 | 源码 `upstream/deepseek-harness-orb`，**0.1.7-rc.1**，commit `51f09764d7ff99947be08ebbb2ca2388faab3df4`。npm 包不含 Computer Use，必须用源码 |
| Computer Use | Web 端到端已验证：模型调原生工具打开记事本→输入→保存→读回→哈希。**偏差：`open_app` 对 Notepad 失败，用 Win+R 代替** |
| 启动脚本 | `butler/desktop/start-dsh-computer-use.ps1`（回环 3107，带 computer-use patch；支持 `STEWARD_HOME`、`DEEPSEEK_API_KEY`） |
| 看门狗 | `butler/desktop/start-steward-hub.ps1 -GatewayPort 8080`：监督 DSH 3107 和网关 8080，退出自动重启 |
| 控制面 | `butler/control-plane/`：node:sqlite；jobs/runs/events/ledger/approvals/sessions；`npm test` 5 项通过 |
| B 站简报 | `butler/jobs/bili-brief/`：搜索+UP+筛选去重→`reports/bili/*-brief.md`；无登录（SPI 生成 buvid3/buvid4） |
| B 站内容 | `content_pass.py` + `transcribe.py`：yt-dlp 音频→faster-whisper（**ctranslate2==4.5.0**，4.9 会崩）→DSH headless 摘要；已完整处理 `BV1owWM6jE1t`（15:18） |
| 周报 | `butler/jobs/weekly/run.mjs`：复用/生成简报→`reports/weekly/<ISO周>.md`；计划任务未注册 |
| 远程网关 | `butler/remote/gateway.mjs`：8 位配对码 + HMAC cookie + HTTP/WS 反代到 127.0.0.1:3107；**Origin 重写为目标源**；token 自动从日志读取注入；`--lan` 绑 0.0.0.0 |
| 凭据 | 目标机用 `DEEPSEEK_API_KEY` 环境变量；开发机可回退 OpenLab `auth.json`（不要外发） |
| Python | 3.10；faster-whisper、ctranslate2==4.5.0、yt-dlp、imageio-ffmpeg |

## 3. 当前进度表

| 任务 | 状态 |
|---|---|
| R0–R4（调研/控制面/简报/Computer Use） | ✅ 完成并验证 |
| R5 周报 digest | ✅ 第一版完成；计划任务未注册 |
| A 远程网关（PC-手机 / PC-PC） | ✅ **刚完成端到端验证**（见下） |
| B 周报全链路试跑（新一周：发现→筛选→内容 Top1→周报） | ⬜ 待做 |
| C 部署目标笔记本（依赖、手动启动、Tailscale、锁屏 Computer Use 实测） | ⬜ 待做 |
| D 收尾（备份/回滚/本地 commit 检查点） | ⬜ 待做 |

## 4. 刚完成的验证（2026-11-17 会话）

远程网关已通过 Edge CDP 端到端验证：
- 打开 `http://<网关>:8080/m` → 输入 8 位配对码 → 302 带 token → DSH 303 清掉 token → SPA 正常加载（“Default workspace / 标准模式 / 输入框 / DeepSeek-V41-Flash”）。
- 修复过程中发现的三个问题（都已修）：配对码过期边界、token 客户端重定向导致循环、**DSH /api 与 WS 因 Origin 被拒 403**（网关把 Origin 重写为 `http://127.0.0.1:3107` 后，/api 全 200、`/api/remote.mux` WS 握手 101 且帧正常流动）。
- iPhone/另一台 PC：同一 Wi-Fi 打开网关日志里的 `http://<局域网IP>:8080/m`。当前本机网关运行在 0.0.0.0:8080，由 hub 看门狗监督。

## 5. 硬规则（违反会破坏宿主 App）

1. **永不杀进程**：不用 `taskkill` / `Stop-Process` / `taskkill /T /F`。必须停某个进程时先问用户，并校验 PID+进程名+命令行后再操作。
2. **名字三分**：OpenLab=宿主 App，Steward=项目/产品，evolve-agent=智能体。不混用、不按名字匹配或杀进程。
3. **服务只经脚本或计划任务启动**，不在临时 shell 里起常驻服务（会被工具超时回收）。

## 6. 交给你的下一步

1. **B 周报全链路试跑**：用 `butler/jobs/weekly/run.mjs`（不带 `--brief`）跑一次真实链路：新一周 B 站发现→筛选去重→内容 Top1（ASR+摘要，缓存命中则跳过）→生成周报。检查端到端输出与成本。
2. **C 部署目标机**：按 `docs/deployment.md` 检查单在目标笔记本执行；重点待验证：Tailscale Serve 是否需要给 DSH 加 `--trusted-host`；锁屏/注销时 Computer Use 是否还能用。
3. **D 收尾**：`git status` 检查未跟踪文件，把 butler/ docs/ reports/ 等有意义的改动做本地 commit 检查点（工作区已有 commit `9fbf1d6`，后续改动未提交）。
4. 已知坑（不要重复踩）：`open_app` Notepad 失败；B 站部分视频 yt-dlp 下载挂起/失败（有重试与错误记录）；faster-whisper 必须 ctranslate2==4.5.0；ASR 只对 Top1–2、单条 5 分钟；DSH 0.1.7 拒绝 0.0.0.0 绑定。
