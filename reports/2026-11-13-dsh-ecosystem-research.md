# DeepSeek / DSH 生态调研

日期：2026-11-13
目标：为 dsh-orb-2 的「电脑管家 / 个人助手」做第二轮生态调研，允许扩展能力，重点参考社区已有的 DeepSeek / DSH 产品。

---

## 0.1 与当前项目（butler）对齐

来自 `knowledge/current-state.md`（2026-09-29）与 `butler/feishu-bridge/` 的现状：

- **目标**：基于 `upstream/deepseek-harness-orb`（dsh）做「电脑管家」。
- **三件事**：① 读微信置顶课程/研究群，抽取任务（读屏）；② 手机下指令，agent 自行完成；③ 按指令操作屏幕。
- **通道决策**：指令通道用**飞书自建应用（长连接）**；消息源仍在微信，靠 **Computer Use 读屏**。
- **已完成**：dsh 克隆与构建通过；验证 `ctx.webhookRuntime` + `dsh-host-webserver` 的 webhook→建会话原语；修复 image-tools 识图。
- **现有代码**：`butler/feishu-bridge/bridge-v0.mjs` —— 飞书 WS 长连接 → `dsh --profile headless "<text>"` → 回消息；**无会话连续性**；支持 `FEISHU_ALLOWED_OPEN_ID` 白名单。
- **待办**：飞书插件化（续会 / 抓最终回复 / 审批卡片）；验证 Computer Use 在 `dsh web` 下可用；微信置顶群读屏 spike。
- **阻塞**：等用户提供飞书 App ID/Secret。

本次调研对当前项目的直接影响：

1. **飞书桥不必长期自己维护**：`omdsh-dev/dsh-lark`（34★/1,124D，含审批/提问/计划审阅）或 `PlutoKeating/dsh-lark-bot`（21★/7,122D，流式卡片）比 v0 完整。若保留自研桥，至少借它的**会话映射 + 流式卡片 + 审批按钮**。
2. **微信读屏是最大技术风险**：微信 PC 端大量自绘控件，UIA 未必能拿到完整文本。应尽早 spike「UIA 导航 + 截图 + OCR/视觉桥」组合；视觉桥用 `modlens` 或 `dsh-vision-router`，控制用 `dsh-desktop-sidecar`/`dsh-desktop-uia`。
3. **周报/视频是同一控制面的扩展**：调度用 `titanwings/dsh-automation`/`Ceelog scheduled-tasks`；视频用 `dsh-vidlens`/`dsh-video-eyes`；不要另起一套。
4. **升级清单 P0 应补**：飞书/Lark 插件、视觉桥、桌面 UIA、权限规则、通知通道。
5. **下一步**：把 `bridge-v0` 升级为「续会 + 流式/审批 + 最终回复」，再做微信读屏 spike；周报排在其后。

---

## 0. 证据边界（先看这个）

| 证据 | 来源 | 可靠度 |
|---|---|---|
| DSH 本体定位、运行方式、许可 | `deepseek-ai/deepseek-harness` README | 高（官方） |
| 插件分类、描述、仓库地址 | `awesome-dsh-plugin` README（10,778 条条目） | 中高（社区自述） |
| 插件 star / 下载量 | 同仓库 `data/stars.json`（1,452 个仓库）、`data/downloads.json`（624 个），快照约 **2026-08-19** | 中（可能滞后，且大量插件无数据） |
| 插件能力扫描 | 同仓库 `data/capabilities.json`（3,821 个唯一插件） | 中 |
| 记忆系统参考 | OpenViking、Hindsight、CowAgent 的 README | 中高（项目自述） |
| 实际可用性 | **未安装、未运行、未审计源码** | — |

注意：
- 10,778 条条目包含跨分类重复；去重后 `capabilities.json` 是 3,821 个。
- **Umbrella 仓库的 star 数不代表 DSH 插件本身的采用度**。例如 OpenViking 29,567★ 是整个上下文数据库项目，Hindsight 20,218★ 是整个记忆系统，modlens 3,152★ 是整个视觉桥项目。
- 很多高质量插件 star/download 为 0，只是因为快照未覆盖，不代表不好。反之，star 高也不代表适合你。

---

## 1. 结论摘要

1. **DSH 生态已经“够用”**：调度、报告、视频、视觉桥、远程、渠道、记忆、桌面控制、安全审批、成本治理、升级回滚，每一层都有多个候选。
2. **最值得先拿的是“基础设施”而不是“功能”**：插件市场（`dsh-market`）、通知/IM（`dsh-notifier`/`dsh-im`）、远程（`ds-harness-remote`/`dsh-pocket`）、记忆（OpenViking/Hindsight/`dsh-memento`）、上下文与成本（`dsh-context`/`dsh-cost-meter`）。
3. **视频不要用“陪看”方案**：批量周报走 `dsh-video-eyes` / `dsh-vidlens` / `dsh-video-reader`；视觉桥用 `modlens` 或 `dsh-vision-router` 补 DeepSeek 文本模型的视觉短板。
4. **电脑操作要分层**：UI Automation 优先（`dsh-desktop-sidecar`/`dsh-desktop-uia`），截图+VLM 兜底，权限用 `dsh-permission-rules` + `dsh-auto-review` 收紧。
5. **“养鱼”只借机制**：生物钟、配额、退避、草稿审批、沉默衰减、账本——不要人格、日记、社交动作。

---

## 2. DSH 本体现状

- 官方：`deepseek-ai/deepseek-harness`，MIT，**developer preview**，明确会有 breaking changes。
- 架构：everything-is-a-plugin，基于 Cordis；Web UI 默认 `127.0.0.1:3080`。
- 运行：`npx @deepseek-ai/dsh web`；或仓库内 `pnpm dsh web`。
- 插件安装：`dsh plugin --profile web add <pkg>`（桌面版用 `--profile desktop`），装完需重启。
- 社区桌面端：`anywhere-labs/dsh-desktop`（Windows/macOS/Linux，固定上游版本）。
- 社区发行版：`hust-open-atom-club/oh-dsh`（TUI + desktop + Web 一体）。
- 多 harness 切换：`farion1231/cc-switch`（支持 DSH、Claude Code、Codex、OpenCode）。

**判断**：DSH 适合做“个人助手的运行时”，但不适合把核心控制面（调度、预算、审批、账本）完全托付给某个第三方插件。**控制面要自己拿一层薄的**。

---

## 3. 社区版图

### 3.1 规模

- 23 个分类，约 3,821 个唯一插件。
- 分类条目数（含重复）：Tools & Capabilities 1,478；UI Enhancements 2,150；Workflow & Automation 646；Development & Runtime 615；Usage & Billing 579；Models & Providers 548；Memory 465；Sessions & Messages 824；Skills 387；Notifications & Integrations 363；Just for Fun 357；Remote & Mobile 310；Security & Permissions 279；Browser & Web 219；Vision & Multimodal 197；Voice & Audio 142；Plugin Markets 140；WSL & Windows Interop 88。
- 这说明生态的重心是：**工具、UI、工作流、开发运行时**；记忆和远程也已经成规模。

### 3.2 三类产品

| 类型 | 代表 | 说明 |
|---|---|---|
| 运行时/发行版 | DSH、DSH Desktop、oh-dsh、cc-switch | 承载 agent 的壳 |
| 个人助手 harness | `zhayujie/CowAgent` | 独立于 DSH，但架构最接近你的目标：Channels → Agent Core → Models，三层记忆 + 知识 wiki + 自进化 + 多渠 道 |
| 插件生态 | 3,821 个插件 | 能力层，本文重点 |
| 陪伴/角色play | `dsh-bili-whale`、`dsh-douyin-agent`、Live2D 桌宠、NextTavern | 只借机制，不做拟人化 |

### 3.3 热度榜（仅供参考）

**按 star（含 umbrella 项目）**
`OpenViking` 29,567 → `Hindsight` 20,218 → `archify` 14,283 → `ouroboros` 5,565 → `mirage` 3,520 → `modlens` 3,152 → `DSH-better-sidebar` 2,216 → `dsh-TUI` 2,009 → `ds-harness-remote` 1,197 → `dsh-market` 1,100。

**按下载**
`dsh-market` 82,491 → `modlens` 63,829 → `DSH-better-sidebar` 39,717 → `dsh-vision-router` 21,679 → `dsh-vision-toolkit` 17,248 → `dsh-TUI` 16,959 → `dsh-agent-teams` 10,525 → `dsh-pocket` 10,411 → `upstream-radar` 9,808 → `hindsight` 9,558。

**读法**：下载榜前几名说明两件事——**装插件本身是刚需（market）**，**文本模型缺视觉是刚需（vision bridge）**。

---

## 4. 能力地图与候选（面向个人助手）

> 每个能力给 2–4 个候选；★/下载量来自上述快照，0 表示快照未覆盖。

### 4.1 控制面：调度、任务、编排

| 候选 | 证据 | 用途 | 备注 |
|---|---|---|---|
| `titanwings/dsh-automation` | 58★ | 定时在全新会话里跑编码任务，带可审计历史 | 最接近“定时唤醒 + 新会话” |
| `Ceelog/dsh-plugins#dsh-plugin-scheduled-tasks` | 7★/497D | 每项目定时 prompt，支持一次/间隔/cron + 时长 | 轻量 |
| `cloader/dsh-taskboard` | 6★/1,520D | 任务板，手动或 cron，新会话执行 | 有 UI |
| `shengsheng90/DSH-taskboard` | 40★ | SQLite 任务板，项目/任务/评论/关系/附件 | 偏项目管理 |
| `omdsh-dev/dsh_workflow` | 82★ | 可生成、可保存、可治理、可观察、可恢复的工作流层 | 重，但适合多步周报 |
| `NanmiCoder/dsh-agent-teams` | 573★/10,525D | 多智能体团队 | 研究/并行任务可选 |
| `Karbo123/DSH-EvoResearch` | 7★ | 长周期研究目标 + 证据链 + cron + 多专家 | 研究型周报可参考 |

**建议**：先 `titanwings/dsh-automation` 或 `Ceelog scheduled-tasks`；周报阶段多步流水线再考虑 `dsh_workflow`。

### 4.2 报告与账本

| 候选 | 证据 | 用途 |
|---|---|---|
| `SenmuuuuW/dsh-whale-report` | 22★ | 从会话日志生成日/周/月/年报告，含成本与 token 明细 |
| `ayf-master/dsh-worklog` | — | 会话日志 → Markdown 工作周报，按目录分组 |
| `5yeah/Aiscribe` | — | 读 16 个 AI 工具历史 + Windows 最近文件，生成日/周报（Windows x64） |
| `0x7A7A6572/dsh-forge-studio#plugin-daily-log` | — | Git commits + agent 会话 → 日报 |
| `Han-1413141/dsh-cost-meter` | 98★/919D | 每会话/每日成本、预算、余额 |
| `bowenliang123/dsh-context` | 416★/6,612D | 上下文仪表盘、`/context`、上下文浏览器 |

**建议**：报告生成用 `dsh-whale-report` 或 `dsh-worklog` 作为参考实现；自己做周报模板，不要把模板绑死在插件里。

### 4.3 视频理解

| 候选 | 证据 | 用途 | 注意 |
|---|---|---|---|
| `BW741/dsh-video-eyes` | — | ffmpeg 时间戳抽帧 + faster-whisper 本地转写 | 本地 ASR，隐私好 |
| `cctv2333/dsh-vidlens` | — | 元数据/章节优先、字幕优先、无字幕才本地 ASR | 最省成本 |
| `ck99998888/dsh-video-reader` | — | 元数据 + 抽帧 + 字幕 + 多语种转写 + 说话人分离 | 功能全 |
| `Destinhue/dsh-video-vision` | — | 把视频当原材料：outline、分段阅读 | 适合长视频 |
| `1368546410qq/dsh-video-skills` | — | 浏览/安装 373 个视频 skill | 可选 |

**建议**：`dsh-vidlens` 或 `dsh-video-eyes` 二选一；不要用 `dsh-see-now` 做批量周报（它是实时陪看）。

### 4.4 视觉桥（文本模型的“眼睛”）

| 候选 | 证据 | 用途 |
|---|---|---|
| `liustack/modlens` | 3,152★/63,829D | 图片 → 结构化 JSON 证据（OCR、布局、语义） |
| `ysr666/dsh-vision-router` | 775★/21,679D | 免费视觉链 + 像素工具（问答、定位、裁剪、像素 diff） |
| `Anionex/dsh-vision-toolkit` | 714★/17,248D | 多图问答、UI/调试分析 |
| `siegfly/dsh-deepseek-vision` | 6★/1,773D | 接可配置 VL 模型（Qwen-VL 等） |

**建议**：如果主模型不带视觉，**必装一个视觉桥**；周报里的幻灯片、截图、图表都靠它。

### 4.5 搜索与阅读

| 候选 | 证据 | 用途 |
|---|---|---|
| `liustack/modsearch` | 153★/8,781D | 搜索 + 抓取 + 引用，结构化 JSON |
| `taxueseek/argo` | 101★ | 120+ 引擎、多语路由、证据校验 |
| `DDDMUC/dsh-free-search` | 21★/2,141D | 7 引擎、免 key |
| `anweat/dsh-web-search-pro` | 27★/1,173D | 多引擎 + GitHub/Bilibili/YouTube/V2EX |
| `2672243194/dsh-read-url` | 11★ | 正文抽取、编码识别（GBK/GB2312） |
| `131CDA1/dsh-scrape-webpage` | 5★ | 标题/摘要/正文/大纲/链接 |
| `xiehuan123/dsh-deepread` | 20★/1,974D | 深读模式（速读/精读/知识图/费曼/全书） |

### 4.6 浏览器

| 候选 | 证据 | 用途 |
|---|---|---|
| `omdsh-dev/dsh-browser` | 302★ | Chrome 侧边栏扩展，直接操作浏览器，不依赖视觉 |
| `wqty123/dsh-browser` | 7★/2,626D | 共享真实浏览器，人可接管 |
| `anweat/dsh-browser` | 6★/2,430D | 自带 Playwright |
| `263311487-ux/dsh-verify` | 0★/2,088D | 独立浏览器验收测试（JSON in → Chromium 判定） |

**建议**：优先无障碍/DOM 操作，截图+VLM 只做兜底；需人工接管时用 `wqty123/dsh-browser`。

### 4.7 桌面控制

| 候选 | 证据 | 用途 |
|---|---|---|
| `111xjyuan/dsh-desktop-sidecar` | — | 21 工具：UIA 树 + 离线 OCR，按控件名点击，中文输入 |
| `1jiegejiayouxuewangan1/dsh-desktop-uia` | — | 9 个 UIA 工具 |
| `173787247/dsh-wsl-uia` + `dsh-wsl-wininput` | — | WSL 下调 Windows UIA / 输入 |
| `1997liuyh-boop/dsh-desktop-tools` | — | 截图、长截图、录屏、选择工具条 |
| `27painter/dsh-sw-cad` | — | AutoCAD/SolidWorks COM 自动化（示例：垂直应用） |
| `2026heshao/dsh-armory` | — | MCP / skill / expert 管理板，可接 Windows-MCP / agent-desktop |

**建议**：Windows 本机优先 UIA；跨平台或已有 MCP 生态用 `dsh-armory` 接 MCP。

### 4.8 记忆 / 上下文

| 候选 | 证据 | 定位 |
|---|---|---|
| `volcengine/OpenViking` | 29,567★（umbrella） | 上下文数据库：`viking://` 虚拟文件系统，L0/L1/L2 分层，知识/记忆/技能统一 |
| `vectorize-io/hindsight` | 20,218★/9,558D | 会学习的记忆：retain/recall/reflect，知识页、决策模型，LongMemEval SOTA |
| `omdsh-dev/dsh-mnemon` | 109★/6,799D | 跨 agent、本地优先持久记忆 |
| `tinqiao-oss/engramory` | 160★/946D | 纯 Markdown，一事一文件 |
| `PerryLink/dsh-memento` | 58★/910D | 有界、分层、审批门控、可审计的跨会话记忆 |
| `Aik358/dsh-auto-memory` | 16★/3,782D | 主动联想记忆，零提示召回 |
| `2132774831/dsh-memory-plugin` | — | 单 JSON、全本地、零网络 |

**建议**：先用轻量本地（`dsh-memento` / `engramory` / `dsh-auto-memory`）；需要知识库/长记忆再上 OpenViking 或 Hindsight（都要额外服务）。

### 4.9 远程 / 手机 / PC↔PC

| 候选 | 证据 | 用途 |
|---|---|---|
| `liguobao/ds-harness-remote` | 1,197★ | 多设备远程，端到端加密通道 |
| `shaobeichen/dsh-pocket` | 179★/10,411D | 扫码手机访问，LAN/cloudflared，实时同步 |
| `saya-ch/dsh-mobile` | 0★/5,301D | Android app 或手机浏览器，LAN/远程 |
| `Blank-not-black/dsh-Remote` | 10★/2,939D | 手机远程控制套件 |
| `JUANWANG-BUAA/dsh-full-remote` | 15★/1,986D | 远程 + 完整 server API |
| `abbaababa/dsh-mobile-access` | — | iPhone/iPad Safari，8 位配对、LAN、Tailscale Serve |
| `afeack/dsh-mobile-harness` | — | 扫码 + 4MB Android app |
| `534119219/chicheng-gate` | 3★ | LAN/远程 + frpc + 面板密码 + 移动 UI |
| `baixianger/dsh-weave` | 0★/905D | Iroh mesh，加密 peer 发现、远程会话投递 |
| `ahian-lee/dsh-ssh-workspace` | — | SSH workspace，发现主机、路由文件/搜索/Bash |
| `andyfan1094/dsh-winrm` | — | WinRM 管理 Windows 主机，PowerShell + SMB 传输 |
| `caoyiwei850/dsh-ssh-ops` | 4★/1,726D | SSH 运维终端 |
| `flymysql/dsh-remote` | 23★/1,687D | 多机远程 workspace |

**建议**：手机入口优先 IM bot/推送（更稳、更省事），需要完整 UI 再用 `dsh-pocket` 或 `ds-harness-remote`；PC↔PC 用 `dsh-ssh-workspace` / `dsh-winrm`，不要自建点对点状态同步。

### 4.10 渠道 / 通知 / 收件箱

| 候选 | 证据 | 用途 |
|---|---|---|
| `THEWOLFWALKER/dsh-notifier` | 43★/6,677D | 28 个出站渠道 + 6 个入站控制渠道，统一 `notify()` |
| `xmanrui/dsh-im` | 54★/2,903D | 9 个 IM（飞书/微信/钉钉/企微等），扫码或凭据接入 |
| `PlutoKeating/dsh-lark-bot` | 21★/7,122D | 飞书/Lark，扫码绑定、流式卡片 |
| `534119219/dsh-messaging` | 2★ | 27 个 IM 平台统一网关 |
| `534119219/chicheng-push` | 2★ | Server酱/Bark/企微/Telegram/Feishu/ntfy |
| `STARDUSTLC666/dsh-email` | 5★/1,975D | IMAP/SMTP 收发、搜索、附件、监听 |
| `2710586329/dsh-qq` | — | QQ（OneBot 11），私聊/群聊、语音转文字 |

**建议**：一个主渠道（Telegram/飞书/QQ）+ 一个推送兜底（ntfy/Bark）；不要同时上多个网关。

### 4.11 安全 / 审批 / 供应链

| 候选 | 证据 | 用途 |
|---|---|---|
| `PerryLink/dsh-permission-rules` | 11★/982D | 声明式 allow/deny/ask YAML 规则 |
| `PerryLink/dsh-auto-review` | 39★/909D | 第二模型自动复核审批请求 |
| `7starsseeker/dsh-jev-guard` | — | 预执行安全阀（静态规则 + 判定） |
| `truelove-dreamer/dsh-plugin-vetting` | 4★/2,354D | 插件静态扫描（外传/凭据/恶意模式） |
| `wulun811/dsh-plugin-vet` | 2★/1,506D | 插件信任流水线，静态扫描 + 运行时守护 |
| `MicroMilo/upstream-radar` | 5★/9,808D | 监控 DSH/插件发布，在一次性 runner 复测并发布结果 |
| `omdsh-dev/dsh-security-audit` | 12★ | 本地安全审计：配置、插件来源、会话、网络暴露 |
| `TecFancy/dsh-auth-gate` | 2★/2,642D | Web 登录门 + 限流 |
| `xbzbing/dsh-auth-gateway` | 4★ | 密码 + TOTP 双因子网关 |
| `0QwQ0/dsh-ui-auth` | — | PBKDF2 登录门，覆盖页面/API/插件/WebSocket |

**建议**：`dsh-permission-rules` + `dsh-auto-review` + `dsh-plugin-vetting` + `upstream-radar` 是“最小安全四件套”。

### 4.12 成本 / 上下文 / 运维

| 候选 | 证据 | 用途 |
|---|---|---|
| `Han-1413141/dsh-cost-meter` | 98★/919D | 每会话/每日成本、预算、余额 |
| `zh667/TokenLedger` | 103★/589D | 按 relay 归因 token |
| `zhu168/dsh-save-money` | 30★/420D | 高峰时段自动暂停/恢复任务 |
| `bowenliang123/dsh-context` | 416★/6,612D | 上下文仪表盘/浏览器 |
| `Airmetro/dsh-update-checker` | 8★/3,156D | DSH/插件版本检查（npm/GitHub 双源） |
| `lire1131/dsh-undo-savepoint` | 85★ | 配置变更快照、撤销/重做/回滚 |
| `Noob-stupid/dsh-plugin-gating-hub` | 54★ | 升级前会话格式契约预检、插件门控 |
| `xiajiajun516/dsh-config-manager` | 4★/4,395D | 一键备份/导出/导入/迁移整个 DSH 配置 |
| `sjh9714/dsh-win32` | 11★/5,967D | Windows 原生 DSH 诊断/修复 |
| `moonquake2004/dsh-doctor` | 1★/2,446D | 19 项离线诊断 |
| `omdsh-dev/dsh-plugin-check` | 24★ | 插件 manifest/补丁/构建检查 |
| `dsh-market/dsh-market` | 1,100★/82,491D | 应用内插件市场 |
| `awesome-dsh-plugin/dsh-find-plugin` | 58★/5,892D | 按关键词/分类找插件 |

### 4.13 研究 / 知识 / 文档

| 候选 | 证据 | 用途 |
|---|---|---|
| `omdsh-dev/dsh-deep-research` | 17★ | 自适应深度研究编排（官方 workflow 引擎） |
| `Karbo123/DSH-EvoResearch` | 7★ | 长周期研究 + 证据链 + cron |
| `biociao/dsh-science` | 19★/553D | 科研工作台，ReAct 研究循环、可溯源产物 |
| `Q00/ouroboros` | 5,565★ | 36 个访谈/种子/执行工具，经 MCP 接入 |
| `GanyuanRan/Aegis` | 1,062★ | 软件工程方法包：基线优先、系统调试等 |
| `2026heshao/dsh-obsidian-board` | — | Obsidian vault → RAG 聊天面板 |
| `zhaoolee/notes` | 147★/239D | 会话导出为笔记/PNG |
| `xmutfyh/dsh-plugin-writing-guard` | 12★/3,933D | 学术写作守卫（去防御性写作、保护证据） |

### 4.14 语音 / 多智能体（可选）

| 候选 | 证据 | 用途 |
|---|---|---|
| `1624318455/dsh-plugin-tts` | 7★ | Edge TTS / RVC 语音播报 |
| `Zhangbo-cn/dsh-voice-input-plugin` | 6★/274D | 输入框麦克风、实时转写 |
| `PandaPolo/dsh-voice-call` | 1★/262D | agent 主动呼叫（接听/拒接/稍后） |
| `MichengAI/dsh-agency-agents` | 2★/3,199D | 领域专家子 agent  roster |
| `toolclub/dsh-agent-team-gui` | 84★ | 多模型小队，按成员配模型与工具策略 |

---

## 5. 我建议扩展的能力（超出你原始清单）

1. **兴趣档案 + 来源注册表**：周报质量的上限由它决定；可编辑、可版本化、带权重。
2. **新颖性/去重**：跨周 embedding + URL/标题指纹，避免炒冷饭。
3. **任务收件箱**：手机文字/语音/链接 → 转录 → 排队 → 审批，而不是直接执行。
4. **Watchlist 监控**：不只周报，支持“每周/每天/事件触发”的轻量监控（arXiv、GitHub release、RSS、价格）。
5. **研究循环**：问题 → 一手来源 → 证据表 → 结论，复用 `dsh-deep-research` / `EvoResearch` 的思路。
6. **成本与上下文双预算**：token/金额/视频分钟 + 上下文占用；用 `dsh-context`/`dsh-cost-meter`。
7. **供应链安全**：插件安装前静态扫描 + 版本锁定 + 升级前快照 + 回滚。
8. **审批与审计**：draft-first、allow/deny 规则、第二模型复核、哈希链审计。
9. **会话卫生**：轮换、摘要交接、避免图片省略破坏前缀缓存。
10. **备份/迁移**：配置、记忆、周报一键导出。
11. **故障诊断**：Windows 原生问题用 `dsh-win32`/`dsh-doctor`。
12. **多设备身份**：配对、设备级 scope、短时 token。
13. **语音入口/播报**（可选）：手机语音留言 → 任务；周报语音摘要。
14. **个人知识库**（可选）：Obsidian/OpenViking/Hindsight，按需再上。
15. **弱网/离线**：长退避重试、本地缓存、离线模式。

---

## 6. 推荐参考架构

```
                    ┌──────────────────────────────┐
                    │ 控制面（自己拥有，薄层）      │
                    │ 调度 / 任务 / 预算 / 审批 / 账本│
                    └──────────────┬───────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
  能力面（DSH 插件/MCP）      记忆面（本地优先）          接入面（多端）
  视频 / 视觉 / 搜索          事实 / 偏好 / 事件          手机 / PC / PC↔PC
  浏览器 / 桌面 / 文件          L0/L1/L2 + 衰减             渠道 / 推送 / 配对
        │                          │                          │
        └──────────────────────────┴──────────────────────────┘
                                   │
                          运行账本 / 成本账本 / 审计
```

- **Hub**：一台常开机器，跑控制面、记忆、队列。
- **Worker**：其他 PC，跑桌面操作/GPU/重任务。
- **单点真相**：任务与记忆只在 Hub；Worker 不持有状态。
- **可替换**：模型、插件、渠道都可换；控制面不依赖某个“鱼”插件。

---

## 7. 分级升级清单

### P0：基础设施（先装，低风险）

| 插件 | 理由 |
|---|---|
| `dsh-market/dsh-market` | 应用内装插件/查兼容性，减少手工 |
| `THEWOLFWALKER/dsh-notifier` 或 `xmanrui/dsh-im` | 一个主渠道 + 推送，远程指挥的前提 |
| `liguobao/ds-harness-remote` 或 `shaobeichen/dsh-pocket` | 手机/多设备入口 |
| `PerryLink/dsh-permission-rules` | 声明式权限，先收紧再放权 |
| `PerryLink/dsh-auto-review` | 第二模型复核审批 |
| `truelove-dreamer/dsh-plugin-vetting` | 插件安装前扫描 |
| `MicroMilo/upstream-radar` | 跟踪上游/插件发布与回归 |
| `Airmetro/dsh-update-checker` + `lire1131/dsh-undo-savepoint` | 升级可控、可回滚 |
| `xiajiajun516/dsh-config-manager` | 配置备份/迁移 |
| `bowenliang123/dsh-context` + `Han-1413141/dsh-cost-meter` | 上下文与成本可见 |
| `PerryLink/dsh-memento` 或 `tinqiao-oss/engramory` | 轻量本地记忆 |
| `liustack/modlens` 或 `ysr666/dsh-vision-router` | 文本模型的视觉桥 |

### P1：周报主链路

| 插件 | 理由 |
|---|---|
| `titanwings/dsh-automation` 或 `Ceelog/...scheduled-tasks` | 定时、新会话、可审计 |
| `SenmuuuuW/dsh-whale-report` / `ayf-master/dsh-worklog` | 报告生成参考 |
| `cctv2333/dsh-vidlens` 或 `BW741/dsh-video-eyes` | 视频转写 + 抽帧 |
| `liustack/modsearch` 或 `taxueseek/argo` | 搜索 + 证据 |
| `2672243194/dsh-read-url` / `xiehuan123/dsh-deepread` | 正文抽取/深读 |

### P2：桌面与多机

| 插件 | 理由 |
|---|---|
| `111xjyuan/dsh-desktop-sidecar` 或 `1jiegejiayouxuewangan1/dsh-desktop-uia` | Windows UIA 操作 |
| `2026heshao/dsh-armory` + Windows-MCP / agent-desktop | MCP 生态接入 |
| `ahian-lee/dsh-ssh-workspace` / `andyfan1094/dsh-winrm` | PC↔PC 任务下发 |
| `shaobeichen/dsh-pocket` / `abbaababa/dsh-mobile-access` | 手机完整 UI（按平台） |

### P3：可选增强

`omdsh-dev/dsh-deep-research`、`Karbo123/DSH-EvoResearch`、`biociao/dsh-science`、`NanmiCoder/dsh-agent-teams`、`2026heshao/dsh-obsidian-board`、`STARDUSTLC666/dsh-email`、`1624318455/dsh-plugin-tts`、`Zhangbo-cn/dsh-voice-input-plugin`、`zhu168/dsh-save-money`。

### 明确不装

- 陪伴/宠物/角色play：`dsh-bili-whale`、`dsh-douyin-agent`、Live2D/桌宠、NextTavern；
- 视频/图片生成：hyperframes、tongflow、remotion、ai-video/image；
- 社交自动化：reddit、Bilibili/Douyin 自动评论/私信；
- 皮肤/主题/UI 花活；
- 云厂商/数据库绑定：Azure、Prisma、Supabase、Neon（除非项目确实用）；
- 任何要求 Cookie 登录、绕过风控的插件。

---

## 8. 风险与治理

1. **DSH developer preview**：锁版本；升级前快照；用 `dsh-plugin-gating-hub` 做契约预检。
2. **插件供应链**：3,821 个插件，质量参差；安装前读源码 + 静态扫描 + 锁版本；只给最小能力。
3. **远程暴露**：不要公网裸奔；用 Tailscale/Cloudflare Tunnel + 登录门 + 设备配对。
4. **桌面控制**：UIA 优先；截图/VLM 兜底；默认拒绝不可逆动作；保留人工接管。
5. **记忆隐私**：本地优先；云压缩/云记忆要明确出网点；敏感信息脱敏。
6. **成本**：周报预算硬上限；视频只处理 Top N；ASR 本地；triage 用便宜模型。
7. **平台合规**：不碰 Cookie 登录、自动评论、批量账号；视频转写注意版权与 ToS。
8. **数据可核验**：star/download 快照滞后；umbrella 项目 star 不代表插件采用度；本文所有“效果”均为项目自述。

---

## 9. 待验证项

- `dsh-automation` / `scheduled-tasks` 在 Windows 睡眠/重启后的补跑行为。
- `dsh-vidlens` / `video-eyes` 对 B 站/YouTube 字幕的覆盖率与 ASR 质量。
- `modlens` / `vision-router` 对中文截图、表格、代码的识别质量。
- `ds-harness-remote` / `dsh-pocket` 的端到端加密、NAT 穿透与移动端体验。
- `dsh-memento` 的审批门控与长期记忆衰减是否符合预期。
- `dsh-desktop-sidecar` 的中文输入、DPI、遮挡窗口表现。
- 各插件与当前 DSH 版本的兼容性（developer preview，变化快）。

---

## 10. 下一步

1. 按 `manifests/upgrade-manifest.md` 走 P0，逐项审批安装。
2. 用两周做“纯文本周报”试点，测成本、失败率、误报。
3. 再加视频链路（字幕优先 + 本地 ASR）。
4. 最后开桌面控制与 PC↔PC，先只跑一个安全任务。
