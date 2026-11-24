# 电脑管家（butler）工程规划

日期：2026-11-13
范围：DSH Web UI + 原生 Computer Use + B 站视频 + 周报；QQ/微信/飞书仅为可选适配器。
配套：`docs/personal-assistant-design.md`、`reports/2026-11-13-dsh-deep-research.md`、`manifests/upgrade-manifest.md`。

---

## 0. 修正（2026-11-13）

用户纠正后，优先级调整：

1. **不依赖飞书**；主入口是 DSH Web UI，手机通过 Tailscale/PWA。
2. **QQ/微信不是核心**；先留 `InputAdapter` 接口，不投入实现。
3. **优先 DSH 原生 Computer Use**（源码 overlay 或 DSH Desktop）；Windows-MCP/agent-desktop 作为备选。
4. **视频以 B 站为主**：yt-dlp 元数据 + 字幕/ASR + 关键帧。
5. 控制面（job/预算/审批/账本）继续保留，且与通道解耦。

## 1. 目标与边界

**本阶段目标**
1. 手机通过 Web/PWA 下指令 → PC 执行 → 结果回传。
2. 定时看 B 站/调研，产出周报。
3. 在受控前提下操作屏幕（DSH 原生 Computer Use）。
4. 通道可插拔；不绑定任何 IM。

**边界**
- 不做拟人化、社交账号运营、平台风控对抗。
- 不在未验证前自动发送/点击/删除。
- 不把个人数据写进 OpenLab 仓库。

---

## 2. 现状（已核实）

| 项 | 状态 |
|---|---|
| DSH runtime | 全局 `@deepseek-ai/dsh` 0.2.2-rc.1；`headless --json` + `--session-id` 通过 |
| Web UI | `dsh web --host/--port/--public-url/--tls-*`；**无内置鉴权** |
| Computer Use | 源码 0.1.7-rc.1；启动脚本 `butler/desktop/start-dsh-computer-use.ps1`；Web 端到端已验（`open_app` 对 Notepad 有偏差） |
| B 站 | 需求已修正：关注 UP + 搜索发现 → 筛选去重 → 带来源简报；字幕/ASR 后置；元数据通路已验证 |
| control-plane | jobs/runs/events/ledger/approvals/sessions；`npm test` 5 项通过 |
| 适配器 | `bridge-v1 --mock` + 续会通过；QQ/微信仅参考，不投入 |
| 自我升级 | 10 个 skill 已装，重启生效 |

### 进展（R 版本）

| 里程碑 | 状态 |
|---|---|
| R0 修正调研/架构 | 完成 |
| R1 Web/远程 | Web 本机可用；目标为 24/7 Windows 轻薄本 + Tailscale；部署文档/脚本已写，待目标机实施 |
| R2 DSH 原生 Computer Use | **完成（有 open_app 偏差）**：Web 对话端到端通过，证据见 `notes/2026-11-15.md` |
| R3 B 站简报 | **第一版完成**：搜索发现 → 筛选去重 → 带来源简报；关注同步与 ASR 待做 |
| R4 控制面 | 完成骨架 |
| R5 周报 | **第一版完成**：B 站简报 + 内容速览 → `reports/weekly/`；定时任务待注册 |
| R6 适配器 | 仅接口/参考实现 |

### R3 第一版（2026-11-15 完成）

- 代码：`butler/jobs/bili-brief/`（`bili.mjs` 发现、`run.mjs` 流水线、README）。
- 配置：`butler/config/interests.example.json`；实际 `interests.json` 已 gitignore。
- 发现：SPI 生成 `buvid3/buvid4` → 搜索；排行榜可选，默认关闭。
- 实测：4 主题 → discovered 26 / filtered 12 / selected 12 → `reports/bili/2026-11-15-brief.md`。
- 去重：`bili_seen`；同一主题再跑 selected=0。
- 限制：关注 UP 用「按名称搜索」近似；精确关注列表需登录 cookie；v1 无 ASR。
- 内容阶段：`--content-top N` / `--content-bvid`；`content_pass.py` 做音频→ASR→摘要并缓存；完整 p01（15:18）摘要已生成。
- 已知：部分 BVID 的 yt-dlp 下载会挂起/失败；ASR 需锁 `ctranslate2==4.5.0`；VAD 关闭。

> R2 偏差：`open_app` 对 Notepad 各名称失败；Notepad 用 `Win+R → notepad` 或 `pwsh Start-Process`，`open_app` 需在其它应用复测。

> 下文 M1–M7 为修正前版本，仅作历史参考；以 R0–R6 为准。

已确认的运行时：
- 全局安装 `@deepseek-ai/dsh` 0.2.2-rc.1；
- `dsh headless --json` 输出 NDJSON：`session` / `status` / `thinking` / `text` / `final`；
- `--session-id` 可续会；
- API key 可从 OpenLab `auth.json` 读取（不落库、不回显）。

已确认的关键风险：
- DSH Web 无内置鉴权；远程必须加 Tailscale/反代。
- DSH 原生 Computer Use 不在 npm 包；需要源码 overlay 或 Desktop。
- B 站字幕依赖 cookie；浏览器运行时取不到；ASR 是主路径。
- B 站音频下载可能 `IncompleteRead`；需要重试/分片。

---

## 3. 工作流（Workstreams）

| ID | 工作流 | 产出 | 依赖 |
|---|---|---|---|
| A | 飞书通道 | `bridge-v1`：续会、流式进度、审批、最终回复 | App ID/Secret |
| B | 微信读屏 | `wechat-reader`：UIA/OCR 只读适配器 + 置信度报告 | 无（可先做） |
| C | 控制面 | `control-plane`：Job 状态机、预算、审批、账本 | 无 |
| D | 周报 | `jobs/weekly-digest`：来源、去重、摘要、推送 | C |
| E | 视频 | `jobs/video-digest`：字幕/ASR/关键帧/时间戳 | C |
| F | 多机 | `worker`：SSH/WinRM 任务下发 | C、A |

---

## 4. 里程碑

### M0（已完成）调研与自我升级
- 交付：生态调研、设计草案、升级清单、10 个 skill、本计划。
- 验收：文件存在；skill 目录结构正确；重启后可见。

### M1（1–2 天）微信读屏只读 spike
**问题**：微信 PC 自绘控件多，UIA 是否能拿到置顶群文本？拿不到，OCR 的准确率/成本如何？

**任务**
1. 打开微信，定位主窗口与置顶群。
2. 用 UIA dump 控件树（`dsh-desktop-uia` 或 PowerShell UIA），记录可读文本节点。
3. 截图 + 视觉桥/OCR（`modlens` / `dsh-vision-router` / 本地 OCR）识别同一区域。
4. 对比：文本完整度、坐标、耗时、成本、误识别。
5. 写 `reports/2026-11-xx-wechat-read-spike.md`。

**验收**
- 从置顶群提取 **3 个群名 + 最近 5 条消息 + 时间**；
- 全程 **不点击、不发送、不修改**；
- 给出“UIA 可用 / 仅 OCR / 不可行”的结论与证据；
- 记录一次耗时与成本。

**风险**：窗口必须前台、分辨率/DPI、微信版本差异、滚动加载。

### M2（2–3 天）飞书桥 v1
**任务**
1. 选型：评估 `omdsh-dev/dsh-lark` 或 `PlutoKeating/dsh-lark-bot`；保留 `bridge-v0` 做对照。
2. 会话映射：`chat_id` / `thread` → dsh session；持久化到 SQLite。
3. 流式进度：工具调用/阶段更新发卡片；最终回复单独发。
4. 审批：把 dsh 的 approval 请求转成飞书卡片（允许/拒绝/稍后）。
5. 失败回退：超时、断连、重复消息去重。

**验收**
- 手机发“查一下今天的任务”，收到进度 + 最终答案；
- 同一会话连续 3 轮不丢上下文；
- 触发一次工具审批，手机上可批准/拒绝并继续；
- 断线重连后不重复执行。

### M3（3–4 天）控制面 v1
**任务**
1. `Job` schema（见设计文档）落 SQLite。
2. 状态机：queued → running → waiting_approval → done/failed；支持 checkpoint 恢复。
3. 预算：token/金额/视频分钟/墙钟；超限硬停。
4. 账本：每次运行的阶段、耗时、成本、错误、跳过原因。
5. 幂等：`idempotency_key` 去重。
6. CLI：`butler job run/list/status`。

**验收**
- 手动创建一个 job，跑完能在账本看到；
- 中途 kill 进程，重启后从 checkpoint 继续；
- 预算超限时停止并记录原因。

### M4（3–5 天）周报 MVP（纯文本）
**任务**
1. 兴趣档案 + 来源注册表（YAML/MD，可版本化）。
2. 采集：RSS/搜索/网页正文。
3. 去重：URL/标题指纹；跨周 embedding 可选。
4. 摘要：按主题聚类，带来源与时间。
5. 推送：飞书/通知；归档到 `reports/weekly/`。

**验收**
- 连续 2 周自动产出周报；
- 每条结论有来源链接；
- 成本低于预算；
- 无来源/低置信内容被标注。

### M5（3–5 天）视频链路
**任务**
1. 候选 → 元数据过滤 → 字幕优先。
2. 无字幕才本地 ASR（faster-whisper）。
3. 章节/关键帧；只对幻灯片/代码/演示画面调视觉桥。
4. 带时间戳笔记 + 引用。
5. 跨周去重。

**验收**
- 3 个视频（含 1 个无字幕）产出时间戳笔记；
- 引用可点回原视频时间；
- 成本/耗时在预算内。

### M6（4–6 天）受控桌面操作
**任务**
1. UIA 适配器（`dsh-desktop-uia` / `dsh-desktop-sidecar`）。
2. dry-run：只读快照 + 计划，不执行。
3. 审批：点击/输入/快捷键逐类授权。
4. 审计：每步截图 + 动作日志。
5. 沙箱/虚拟机用于高风险任务。

**验收**
- 完成一个安全任务（如“打开记事本，写入指定文本，另存为”）；
- 全程有日志与截图；
- 拒绝一次未授权动作。

### M7（3–5 天）多机与手机
**任务**
1. Hub/Worker：SSH/WinRM 任务下发。
2. 手机：IM 链路优先；需要完整 UI 再用 `dsh-pocket`/`ds-harness-remote`。
3. 设备配对/权限 scope。

**验收**
- 手机 → Hub → Worker 执行 `whoami` 并回传；
- Worker 不持有任务状态；
- 失败可重试/取消。

---

## 5. 建议仓库结构

```
butler/
  feishu-bridge/        # v0 → v1
  control-plane/        # jobs, budget, approval, ledger (Node/TS + SQLite)
  wechat-reader/        # UIA/OCR 只读适配器 + spike
  desktop/              # UIA / screenshot adapters
  config/               # interests.yaml, sources.yaml, policies.yaml
  data/                 # gitignored: db, artifacts, logs
docs/
reports/
manifests/
upstream/               # gitignored
```

---

## 6. 关键技术决策

1. **控制面独立**：不把调度/预算/审批绑在 DSH 插件上；插件可换，控制面不动。
2. **会话映射持久化**：SQLite 存 `chat_id/thread → session_id`，避免重启丢失。
3. **微信先只读**：UIA 优先，OCR 兜底；验证通过前不做任何写操作。
4. **桌面分级**：T1 CLI → T2 UIA → T3 截图/VLM → T4 人工接管。
5. **默认拒绝**：删除/支付/发送/权限变更必须审批；draft-first。
6. **本地优先**：ASR、索引、记忆本地；云只做必要推理。
7. **可回滚**：DSH 锁版本；配置快照；插件安装前扫描。

---

## 7. 测试与验证

- 每个里程碑必须有**可复现命令 + 期望输出**，并在 `notes/` 记录证据。
- 采用新装的 `verification-before-completion`：未跑验证不得声称完成。
- Bug 用 `systematic-debugging`：先复现/根因，再修复。
- 计划用 `writing-plans`；需求用 `grilling` 追问。
- 架构改动前用 `improve-codebase-architecture` + `codebase-design` 评估深模块。

---

## 8. 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| 微信 UIA 读不到文本 | M1 失败 | 截图 + OCR/视觉桥；限定区域；接受成本 |
| 飞书凭据延迟 | M2 阻塞 | 先做 M1/M3；v0 继续可用 |
| DSH breaking changes | 桥/插件失效 | 锁版本、快照、升级前测试 |
| Windows 睡眠/锁屏 | 任务失约 | 开机补跑、计划任务、保持会话 |
| 桌面误操作 | 数据/账号风险 | 只读先行、审批、dry-run、沙箱 |
| 隐私 | 微信内容出网 | 本地处理、脱敏、明确出网点 |
| 成本 | 视频/周报超支 | 预算硬上限、Top N、本地 ASR |
| 插件供应链 | 恶意代码 | 静态扫描、锁版本、最小权限 |

---

## 9. 最近三个任务（建议顺序）

1. **M1 微信读屏 spike**（不依赖飞书凭据）
   - 产出：UIA dump + 截图 + OCR 对比报告。
   - 验收：3 群 × 5 条消息，零点击。
2. **M3 控制面骨架**（与 M1 并行）
   - 产出：SQLite schema + job runner + 预算/账本 CLI。
   - 验收：手动 job 可运行、可恢复。
3. **M2 飞书 v1 设计**（等凭据）
   - 产出：会话映射、卡片、审批的接口草案；选型结论。
   - 验收：在 v0 上跑通一次续会（可用 mock）。

---

## 10. 开放问题

1. 常开 PC 是否保持解锁？锁屏会影响 UIA/截图。
2. 微信版本与窗口布局？是否多账号？
3. 飞书 App ID/Secret 何时可用？
4. 读屏失败时，是否接受云 VLM（图片出网）？
5. 周报的“相关”由兴趣档案决定，初始主题清单由谁给？
