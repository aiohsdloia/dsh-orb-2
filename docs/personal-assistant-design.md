# 个人助手设计（DSH 版）

日期：2026-11-13
状态：草案（待确认 5 个选择）
配套：`reports/2026-11-13-dsh-ecosystem-research.md`、`manifests/upgrade-manifest.md`

---

## 1. 目标与非目标

**目标**
- 核心：可远程指挥的个人电脑助手；定时调研、看 B 站视频、产出周报；能操作屏幕。
- 多端：DSH Web UI（主）+ 手机 PWA/Tailscale + PC↔PC。
- 具备较强的电脑操作能力，能独立完成中等复杂度任务。
- 输入/输出通道可插拔；不绑定飞书、QQ 或微信。

**非目标**
- 不做拟人化陪伴、角色play、社交账号运营。
- 不做 24/7 无边界自主；不做平台风控对抗。
- 不与 OpenLab 共享数据、密钥、目录。

## 1.1 核心与适配器（2026-11-13 修正）

- **核心**：DSH runtime（Web/headless）+ control-plane + scheduler + memory + artifacts。
- **主入口**：DSH Web UI；手机通过 Tailscale/PWA；CLI 本地。
- **可选适配器**：QQ / 微信 / 飞书 / 邮件，统一 `InputAdapter`；先留接口，不投入实现。
- **飞书不是依赖；QQ/微信不是核心功能。**
- 现有 `butler/feishu-bridge` 仅作为适配器参考；`butler/wechat-reader` 仅作为桌面读屏工具。

下一步（修正顺序）：
1. DSH Web + 远程（Tailscale/TLS/鉴权）。
2. DSH 原生 Computer Use（源码 overlay 或 DSH Desktop）。
3. B 站视频链路（yt-dlp + ASR/字幕）。
4. 控制面接真实任务；周报 MVP。
5. 适配器按需接入。

---

## 2. 原则

1. **控制面自己拥有**：调度、预算、审批、账本不绑死在第三方插件。
2. **单点真相**：Hub 持有任务与记忆；Worker 不持有状态。
3. **预算化自治**：每次运行有 token/金额/时长/视频分钟上限。
4. **draft-first**：对外、不可逆动作先出草稿，经批准再执行。
5. **本地优先**：记忆、转写、索引尽量本地；云只做必要推理。
6. **可回滚**：插件锁版本、配置快照、升级前备份。
7. **可核验**：每条结论带来源与时间戳；运行有账本。
8. **不伪装人**：不追求“像人”，只追求“可靠”。

---

## 3. 架构

```
接入面   DSH Web UI（主） · 手机 PWA/Tailscale · CLI · 可选 InputAdapter（QQ/微信/飞书/邮件）
            │
控制面   调度器 · 任务队列 · 预算 · 审批 · 账本 · 状态机
            │
能力面   DSH 原生 Computer Use · B 站视频 · 视觉桥 · 搜索 · 浏览器 · 文件
            │
记忆面   兴趣档案 · 来源注册表 · 事实/事件 · 周报归档 · 去重索引
            │
运行账本 每次运行：做了什么/跳了什么/花了多少/错在哪
```

**Hub/Worker**
- Hub：常开机器，跑控制面 + 记忆 + 队列 + 渠道。
- Worker：按需加入，执行桌面操作、GPU、重任务。
- 通信：SSH/WinRM 或任务队列；不点对点同步状态。

---

## 4. Job 规格

```yaml
id: weekly-report-2026-W46
type: research_digest
trigger:
  cron: "0 9 * * 1"        # 周一 09:00
  window: "08:00-22:00"
  jitter: 15m
  catchup: true            # 开机补跑
inputs:
  sources: [interest-registry:v3]
  since: "7d"
budget:
  tokens: 300000
  money_cny: 3
  video_minutes: 90
  wall_clock_min: 45
idempotency_key: "weekly-report:2026-W46"
checkpoints: [collect, dedupe, transcribe, rank, synthesize, publish]
retry:
  backoff: exponential
  circuit_breaker: true
approval:
  draft_first: true
  require_for: [send_email, post, delete, purchase]
output:
  journal: runs/2026-W46.md
  digest: reports/weekly/2026-W46.md
  evidence: reports/weekly/2026-W46.sources.json
expiry: "2026-11-20T00:00:00+08:00"
```

---

## 5. 策略（Policies）

| 策略 | 内容 |
|---|---|
| 预算 | token、金额、视频分钟、墙钟；超限硬停并报告 |
| 限流 | 按来源/供应商；指数退避 + 熔断 |
| 能力 | allow/deny/ask 规则；默认拒绝不可逆动作 |
| 审批 | draft-first；手机可批/拒；超时默认拒绝 |
| 留存 | 原始素材 30 天、周报 1 年、账本 1 年；可配置 |
| 隐私 | 敏感字段脱敏；云出网点显式记录 |
| 会话 | 长任务轮换；摘要交接；避免图片省略破坏缓存 |

---

## 6. 记忆设计

- **兴趣档案**：主题、权重、排除项、语言、来源偏好。
- **来源注册表**：RSS/站点/频道/UP 主/仓库/arXiv 分类；可信度与更新频率。
- **三层**：L0 摘要（一句话）→ L1 概览（结构/要点）→ L2 原文（按需）。
- **衰减**：长期不用的来源/话题降权；被再次提起则恢复。
- **去重**：URL/标题指纹 + 跨周 embedding + 事件聚类。
- **归档**：周报、证据、运行日志分离存放。

> 参考：OpenViking 的 `viking://` L0/L1/L2；memory-system 的“被提起回退”；Hindsight 的 retain/recall/reflect。只借设计，不直接托管隐私数据。

---

## 7. 视频流水线（以 B 站为主）

**第一版（R3）先不做 ASR**：

```
关注 UP 主 + 按兴趣搜索/发现
  → 新视频候选
  → 元数据筛选（发布时间/时长/关键词/UP）
  → 去重（BVID/标题指纹/跨周）
  → 带来源的简报
```

- 账号：用户可用现有账号或新号；关注列表作为稳定来源。
- 巡查：定时检查关注 UP 的更新；同时按兴趣主动搜索/发现新来源。
- 深入处理：只对**筛选后的视频**做字幕/ASR/关键帧，不先全量转写。

深入处理流水线：

```
B 站 URL / 搜索 / 排行榜
  → yt-dlp 元数据（无需登录）
  → 有字幕：拉字幕（需要 cookies；浏览器运行时可能取不到）
  → 无字幕：下载音频（重试/分片）→ faster-whisper 或 DSH SenseVoice
  → 章节/关键帧（ffmpeg；imageio-ffmpeg 已可用）
  → 幻灯片/代码/演示画面 → 视觉模型
  → 带时间戳笔记 + 引用
  → 跨周去重 → 周报
```

实测结论：
- 样例公开视频 `BV1kZWX62ENY`：元数据可用，**无 subtitles / automatic_captions**。
- `--cookies-from-browser edge` 失败（浏览器占用 cookie DB）；需要关闭浏览器或独立 profile。
- 音频分段下载出现 `IncompleteRead`；必须重试、分片、降并发。
- ffmpeg 来自 `imageio-ffmpeg`，无需系统安装。

预算控制：每周只深读 Top N；长视频只取章节；ASR 本地；triage 用便宜模型。

---

## 8. 远程与多端

- **主入口**：DSH Web UI（`dsh web`）。
- **手机**：Tailscale 内网访问 `http://<tailscale-ip>:<port>`，浏览器/PWA；或 Cloudflare Tunnel + Access。
- **鉴权**：DSH 没有内置登录；必须用 Tailscale ACL、Cloudflare Access、反代 Basic Auth 或登录门插件。
- **TLS**：`--tls-cert/--tls-key`，或在反代终止。
- **PC↔PC**：SSH workspace / WinRM；任务下发，不共享状态。
- **可选**：QQ/微信/飞书/邮件适配器，按需接入，不进入核心。
- **禁止**：公网裸奔、弱口令、把 shell 直接暴露到互联网。

---

## 9. 电脑操作分级

| 级别 | 方式 | 适用 |
|---|---|---|
| T1 | CLI/API/脚本 | 最稳、最便宜，优先 |
| T2 | **DSH 原生 Computer Use**（13 个 GUI 工具，Windows GDI/SendInput） | 首选桌面操作；需要视觉模型 |
| T3 | UI Automation（UIA）/ MCP（Windows-MCP、agent-desktop） | DSH 原生不可用时的备选 |
| T4 | 截图 + OCR/VLM | 自绘界面兜底 |
| T5 | 人工接管 | 高风险/不可逆 |

硬规则：默认拒绝删除/支付/发送；每步有日志与截图证据；可全局急停。
注意：DSH 原生 Computer Use 未随 npm 包发布，需要源码 overlay 或 DSH Desktop；且它是 unsandboxed 的，安装即授权。

---

## 10. 观测与账本

- **运行账本**：job id、阶段、耗时、错误、跳过原因。
- **成本账本**：token、金额、视频分钟、按来源/任务归因。
- **周报自述**：扫了什么、看了什么、花了多少、失败几次、下周建议。
- **告警**：连续失败、预算超限、渠道断连、插件异常。

---

## 11. 阶段路线

| 阶段 | 内容 | 验收 |
|---|---|---|
| P0（第 1 周） | DSH + 登录门 + 远程 + 通知 + 记忆 + 视觉桥 | 手机能远程下只读任务 |
| P1（第 2–3 周） | 调度 + 纯文本周报 + 兴趣档案 + 去重 + 归档 | 连续两周自动产出周报 |
| P2（第 3–4 周） | 视频链路（字幕/ASR/抽帧）+ 引用 | 周报含 3 个视频的时间戳笔记 |
| P3（第 4–6 周） | 桌面 UIA + 审批 + 沙箱 | 完成一个安全的桌面任务 |
| P4（第 6–8 周） | PC↔PC + 任务收件箱 | 从手机下发任务到另一台 PC |
| P5 | 成本/上下文治理、自评估、升级清单 | 周报附带成本与升级建议 |

---

## 12. 待确认的 5 个选择（可用默认）

| # | 问题 | 默认假设 |
|---|---|---|
| 1 | 常开机器是 Windows 吗？会睡眠吗？ | Windows 11，可能睡眠；做开机补跑 |
| 2 | 视频来源？ | B 站 + YouTube 优先，抖音后置 |
| 3 | 手机系统？ | iOS + Android，优先 IM bot |
| 4 | 云 API vs 本地模型？ | 云推理 + 本地 ASR/索引 |
| 5 | DSH Desktop 还是 `npx dsh web`？ | DSH Desktop，锁版本 |

---

## 13. 与 OpenLab 的隔离

- 独立 DSH profile、独立数据目录、独立密钥。
- 不把个人记忆/周报写进 OpenLab 仓库。
- 不把 OpenLab 的研究数据默认注入个人助手。
