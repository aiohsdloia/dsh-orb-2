# 周报系统设计（期刊 + B站 + GitHub 主动订阅）

> 状态：待审。审完再实现。

## 一、调研结论（先回答"整合包有没有"）

| 候选 | 是否具备周报/订阅能力 | 结论 |
|---|---|---|
| 养鱼插件 dsh-onebot-qq（已在用） | ❌ 无。12 个子插件全是聊天功能；最接近的"消息监测"是群内关键词反应、"主动接话"是随机找你聊天，均不抓取外部数据源 | 不符合 |
| dafeiyu-config-pack（DSQQ 一键包的人格配置） | ❌ 无。内容为人设/表情包/语音/唱歌/签名 | 不符合 |
| DSQQ 一键包（AstrBot 体系） | ⚠️ AstrBot 有插件市场可装第三方定时推送/B站订阅插件，但那是 AstrBot 线（本项目没走），且第三方插件需另配 key、质量参差 | 不采用 |
| 夸克网盘"养鱼完整项目" | ❓ 两次尝试打不开页面，内容未知 | 待用户确认 |

**结论：现有生态没有现成周报能力，只能基于本项目已验证的管线扩展。**
可复用的家底（此前已跑通）：`butler/jobs/bili-brief`（B站关注 up 抓取+内容速览+转写）、`butler/jobs/weekly`（周报骨架）、`butler/core/dsh-runner.mjs`（DSH headless 执行器）、SnowLuma OneBot HTTP API（可向大号推消息）。

## 二、需求

每周定时自动生成一份个人周报，主动抓取三个数据源：**期刊（arXiv）**、**B站**、**GitHub**，推送到大号 QQ，同时落盘存档。

## 三、架构（数据流）

```
weekly.yaml（配置：源开关/关键词/token 预算/推送开关）
   │
   ├─ ① 三路 fetcher 并行（纯 Node，不耗 LLM）
   │     arxiv-fetch.mjs ── arXiv API（免费无 key）
   │     github-fetch.mjs ─ GitHub trending 抓取 + 可选 GITHUB_TOKEN（star 仓库 releases/事件）
   │     bili-fetch.mjs ── 复用 bili.mjs 管线（关注 up 主近 7 天投稿）
   │     产出：butler/data/weekly/YYYY-Www/raw/*.json（标题/链接/作者/日期/摘要）
   │
   ├─ ② 分源摘要 pass（DSH headless，逐项一行摘要，控制总量）
   │
   ├─ ③ 合成 pass（DSH headless，产出周报 Markdown，token 预算内）
   │     产出：reports/weekly/YYYY-Www.md
   │
   ├─ ④ 推送（SnowLuma OneBot HTTP → 小号 → 大号私聊；长文自动拆条）
   │
   └─ ⑤ 记账（control-plane ledger：token/耗时/成败）
```

定时：任务计划程序周日 20:00（沿用 register-task.ps1 模式；不可用时提供手动 `run-weekly.ps1 -Now`）。

## 四、各源细节

**1. arXiv（期刊）**
- 端点 `http://export.arxiv.org/api/query`，免费无 key、无需登录
- 配置：分类（cs.AI/cs.CL 等）+ 关键词 + 近 7 天窗口
- 排序：关键词命中（标题+摘要）粗排 → 取 Top 15 → LLM 每篇一句话点评
- 输出项：标题、作者、链接、日期、摘要首段

**2. GitHub**
- 主源：`https://github.com/trending` 抓取（按日聚合 7 天，语言可选，无 key）
- 辅源（可选）：star 仓库近 7 天 releases/提交（需要 GITHUB_TOKEN，无则跳过）
- 取 Top 20，每项一句话点评（说明是什么、为何值得关注）

**3. B站**
- 复用已跑通的 bili-brief 管线：关注 up 主近 7 天投稿 + 标题/简介
- 每视频一句话摘要（批量 LLM）；转写只做 Top 3（省时省钱）
- 取 Top 15

## 五、关键决策点（已确认 2026-11-18）

1. **期刊范围**：arXiv + PubMed + 期刊 RSS（Nature/Science 等，列表可配）✅ 全要
2. **GitHub 主源**：trending（weekly 窗口，一次请求覆盖 7 天）✅
3. **推送**：周报推到大号 QQ 私聊（小号账号发）✅
4. **频率**：只做周刊（周日 20:00）✅
5. **LLM 预算**：每期 ≤200k tokens，超出截断 ✅

## 六、实现里程碑

- M1：`arxiv-fetch.mjs` + `github-fetch.mjs` 两个 fetcher，单跑验证输出 JSON
- M2：重构 `weekly/run.mjs`：三源聚合 → 摘要 pass → 合成 pass（dsh-runner 切到新 DSH 0.2.2）
- M3：QQ 推送（OneBot HTTP）+ 定时任务注册
- M4：试跑一期（W48）→ 你验收 → 文档 + git 提交

## 七、风险与对策

| 风险 | 对策 |
|---|---|
| GitHub 无 token 限流 60/hr | fetcher 本地缓存 + 只抓必要端点 + 出错降级 |
| B站限流（HTTP 567） | 已有 Referer/重试机制，沿用 |
| 推送失败 | 不阻塞落盘，日志+账本记录，下期补推 |
| LLM 合成超预算 | 分源硬上限（15/20/15）+ token 预算熔断 |
