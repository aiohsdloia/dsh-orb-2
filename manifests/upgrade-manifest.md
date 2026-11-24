# 个人助手升级清单（Manifest）

日期：2026-11-13
状态：**proposed — 未安装任何一项**
原则：只装“基础设施 + 可验证能力”；不装拟人化/社交自动化；全部锁版本、可回滚。

---

## 0. 审批方式

- 每项状态：`proposed` → `approved` → `installed` → `verified` / `rolled_back`
- 默认 **P0 全批**、P1 分批、P2 按需、P3 观察。
- 安装前：读插件源码 / README，确认 npm 包名、权限（shell/network/credentials）、依赖。
- 安装后：跑 health check + 一个最小任务，记录到运行账本。
- 任一项失败：按“回滚”列恢复，不连续升级。

---

## 1. P0：基础设施

| ID | 插件 / 仓库 | 作用 | 权限面 | 版本策略 | 主要风险 | 安装方式 | 验证 | 回滚 |
|---|---|---|---|---|---|---|---|---|
| P0-01 | `dsh-market/dsh-market` | 应用内插件市场、兼容性/更新 | network, fs | 锁定当前 minor | 市场推荐不等于可信 | 按 README | 能搜索/查看已装插件 | 卸载插件 |
| P0-02 | `THEWOLFWALKER/dsh-notifier` | 28 出站 + 6 入站通知/控制 | network, credentials | 锁版本 | 渠道 token 泄露 | 按 README | 发一条测试通知 | 卸载 + 撤销 token |
| P0-03 | `xmanrui/dsh-im`（备选） | 9 个 IM 网关 | network, credentials | 锁版本 | 同上 | 按 README | 绑定一个 IM，收发一条 | 解绑 |
| P0-04 | `liguobao/ds-harness-remote` 或 `shaobeichen/dsh-pocket` | 手机/多设备入口 | network, fs | 锁版本 | 暴露面扩大 | 按 README | 手机扫码/配对成功 | 关闭隧道 + 卸载 |
| P0-05 | `PerryLink/dsh-permission-rules` | 声明式 allow/deny/ask | 配置 | 锁版本 | 规则写错会误拦 | 按 README | 危险命令被 ask/deny | 恢复默认规则 |
| P0-06 | `PerryLink/dsh-auto-review` | 第二模型复核审批 | network, llm | 锁版本 | 额外成本/误判 | 按 README | 构造一次审批，观察复核结论 | 关闭 auto-review |
| P0-07 | `truelove-dreamer/dsh-plugin-vetting` | 插件安装前静态扫描 | fs | 锁版本 | 扫描误报 | 按 README | 扫描一个已知插件 | 卸载 |
| P0-08 | `MicroMilo/upstream-radar` | 跟踪 DSH/插件发布与回归 | network | 锁版本 | 信息噪音 | 按 README | 看到一次发布报告 | 卸载 |
| P0-09 | `Airmetro/dsh-update-checker` | 版本检查（npm/GitHub） | network | 锁版本 | 误报新版本 | 按 README | 列出可更新项 | 卸载 |
| P0-10 | `lire1131/dsh-undo-savepoint` | 配置快照/撤销/回滚 | fs | 锁版本 | 快照占空间 | 按 README | 改配置后回滚成功 | 删除快照 |
| P0-11 | `xiajiajun516/dsh-config-manager` | 配置备份/导出/迁移 | fs | 锁版本 | 备份含密钥 | 按 README | 导出后恢复成功 | 用备份恢复 |
| P0-12 | `bowenliang123/dsh-context` | 上下文仪表盘/浏览器 | 只读 | 锁版本 | 无 | 按 README | 看到上下文占用 | 卸载 |
| P0-13 | `Han-1413141/dsh-cost-meter` | 成本/预算/余额 | 只读 | 锁版本 | 价格表滞后 | 按 README | 看到当日成本 | 卸载 |
| P0-14 | `PerryLink/dsh-memento` 或 `tinqiao-oss/engramory` | 轻量本地记忆 | fs | 锁版本 | 记忆污染/膨胀 | 按 README | 写入/召回一条事实 | 删除记忆库 |
| P0-15 | `liustack/modlens` 或 `ysr666/dsh-vision-router` | 文本模型视觉桥 | network, llm | 锁版本 | 图片出网 | 按 README | 识别一张截图/图表 | 卸载 |

> P0 先装 01/02/05/06/09/10/12/13/14/15；03/04/07/08/11 可按需。

---

## 2. P1：周报主链路

| ID | 插件 / 仓库 | 作用 | 权限面 | 主要风险 | 验证 | 回滚 |
|---|---|---|---|---|---|---|
| P1-01 | `titanwings/dsh-automation` 或 `Ceelog/dsh-plugins#dsh-plugin-scheduled-tasks` | 定时新会话执行 | shell, network | 睡眠/重启失约 | 设 2 分钟后触发，观察新会话与历史 | 删除任务 |
| P1-02 | `SenmuuuuW/dsh-whale-report` 或 `ayf-master/dsh-worklog` | 从会话日志生成报告 | fs | 报告口径不符 | 生成一份周报草稿 | 卸载 |
| P1-03 | `cctv2333/dsh-vidlens` 或 `BW741/dsh-video-eyes` | 字幕优先/本地 ASR + 抽帧 | fs, network, shell | ASR 质量、平台限制 | 处理一个 10 分钟视频，输出时间戳笔记 | 卸载 + 删除缓存 |
| P1-04 | `liustack/modsearch` 或 `taxueseek/argo` | 搜索 + 抓取 + 引用 | network | 结果质量/限流 | 搜一个主题，输出带引用结果 | 卸载 |
| P1-05 | `2672243194/dsh-read-url` 或 `131CDA1/dsh-scrape-webpage` | 正文抽取（含 GBK） | network | 反爬/编码 | 读一个中文页面 | 卸载 |

> 视频链路额外依赖：`ffmpeg`、`faster-whisper`（本地）。不经过模型厂商的 ASR 优先。

---

## 3. P2：桌面与多机

| ID | 插件 / 仓库 | 作用 | 权限面 | 主要风险 | 验证 | 回滚 |
|---|---|---|---|---|---|---|
| P2-01 | `111xjyuan/dsh-desktop-sidecar` 或 `1jiegejiayouxuewangan1/dsh-desktop-uia` | Windows UIA 控制 | shell, ui, fs | 误操作/权限过大 | 只读快照 + 点击一个记事本按钮 | 关闭插件 + 人工接管 |
| P2-02 | `2026heshao/dsh-armory` | MCP/skill 管理板 | network, fs | 接入不受信 MCP | 列出 MCP 工具 | 卸载 |
| P2-03 | Windows-MCP / agent-desktop（MCP） | 桌面/跨平台控制 | shell, ui | 高风险 | 只开 Snapshot/Click/Type | 断开 MCP |
| P2-04 | `ahian-lee/dsh-ssh-workspace` 或 `andyfan1094/dsh-winrm` | PC↔PC 任务下发 | network, shell | 凭据/横向移动 | 对一台测试机执行 `whoami` | 删除主机 |
| P2-05 | `shaobeichen/dsh-pocket` 或 `abbaababa/dsh-mobile-access` | 手机完整 UI | network | 暴露面 | 手机打开并完成一次只读查询 | 关闭 |

---

## 4. P3：可选增强（观察，不急于装）

| 插件 | 用途 | 触发条件 |
|---|---|---|
| `omdsh-dev/dsh-deep-research` | 深度研究编排 | 周报需要多步研究时 |
| `Karbo123/DSH-EvoResearch` | 长周期研究 + 证据链 | 需要持续跟踪一个课题 |
| `biociao/dsh-science` | 科研工作台 | 需要可溯源实验产物 |
| `NanmiCoder/dsh-agent-teams` | 多智能体团队 | 任务可并行拆分 |
| `2026heshao/dsh-obsidian-board` | Obsidian → RAG | 已有 Obsidian 知识库 |
| `STARDUSTLC666/dsh-email` | 邮件收发/监听 | 需要邮件入口 |
| `1624318455/dsh-plugin-tts` | 语音播报 | 需要开车/走动时听周报 |
| `Zhangbo-cn/dsh-voice-input-plugin` | 语音输入 | 手机语音布置任务 |
| `zhu168/dsh-save-money` | 高峰暂停 | 成本敏感 |
| `sjh9714/dsh-win32` / `moonquake2004/dsh-doctor` | Windows 诊断 | 出现启动/端口/会话问题 |

---

## 5. 明确不装（Denylist）

- 陪伴/宠物/角色play：`dsh-bili-whale`、`dsh-douyin-agent`、Live2D/桌宠、NextTavern、whale-musume；
- 视频/图片生成：hyperframes、tongflow、remotion、ai-video/image；
- 社交自动化：B 站/抖音/Reddit 自动评论、私信、@、批量账号；
- 皮肤/主题/状态栏花活；
- 云厂商/数据库绑定：Azure、Prisma、Supabase、Neon（除非项目实际使用）；
- 任何要求 Cookie 登录、绕过风控、批量操作的插件；
- 任何未读源码、无版本、无回滚方案的插件。

---

## 6. 安装前检查单

- [ ] 仓库地址、npm 包名、版本号确认
- [ ] 许可（MIT/Apache/AGPL/CC-NC）确认
- [ ] 权限面（shell/network/credentials/fs）确认
- [ ] 是否与已装插件功能重叠
- [ ] 是否有 health check / doctor
- [ ] 是否有回滚/卸载路径
- [ ] 是否会把敏感数据出网
- [ ] 是否绑定平台账号/ToS 风险

## 7. 安装后检查单

- [ ] DSH 重启后插件出现在列表
- [ ] 工具表可见预期工具
- [ ] 跑一个最小任务
- [ ] 记录成本与耗时到运行账本
- [ ] 更新本 manifest 状态
- [ ] 观察 24 小时错误日志
