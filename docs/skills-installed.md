# Skills Installed（自我升级记录）

日期：2026-11-13
目标目录：`%APPDATA%\com.sculab.openlab\runtime\xdg-config\opencode\skills`
安装方式：手动抓取（`skills` CLI 的 git clone 被网络重置），再复制目录；已去掉上游的 `disable-model-invocation` 字段以兼容 opencode skill frontmatter。
生效条件：**重启 opencode / Open Lab**（skill 在启动时加载，不会热更新）。

## 已安装

| Skill | 来源 | 上游路径 | 用途 | 许可 |
|---|---|---|---|---|
| `grilling` | `mattpocock/skills` | `skills/productivity/grilling` | 对计划/设计做不留情面的追问，先暴露假设 | MIT |
| `grill-me` | `mattpocock/skills` | `skills/productivity/grill-me` | `grilling` 的触发别名 | MIT |
| `writing-plans` | `obra/superpowers` | `skills/writing-plans` | 多步任务先写计划，再动代码 | MIT |
| `verification-before-completion` | `obra/superpowers` | `skills/verification-before-completion` | 声称“完成”前必须跑验证并贴证据 | MIT |
| `systematic-debugging` | `obra/superpowers` | `skills/systematic-debugging` | 先找根因再修，禁止症状式修复 | MIT |
| `improve-codebase-architecture` | `mattpocock/skills` | `skills/engineering/improve-codebase-architecture` | 扫描代码库，找“深模块”改造机会，出 HTML 报告 | MIT |
| `codebase-design` | `mattpocock/skills` | `skills/engineering/codebase-design` | 深模块设计的共享词汇（module/interface/depth/seam/adapter） | MIT |
| `research` | `mattpocock/skills` | `skills/engineering/research` | 对一手来源做调研，落成带引用的 Markdown | MIT |
| `unslop` | `michaelshimeles/rstack` | `unslop` | 去掉 commit/PR/文档里的 AI 腔 | 未核实 |
| `web-design-guidelines` | `vercel-labs/agent-skills` | `skills/web-design-guidelines` | 按 Web Interface Guidelines 审 UI/可访问性 | 未核实 |

附带文件：
- `codebase-design/DEEPENING.md`
- `codebase-design/DESIGN-IT-TWICE.md`
- `improve-codebase-architecture/HTML-REPORT.md`

## 未安装

| Skill | 原因 |
|---|---|
| `to-spec` | 依赖 issue tracker 与 `ready-for-agent` 标签；当前仓库没有该前置 |
| `tdd` / `test-driven-development` | 与现有验证纪律重叠，等有测试框架时再装 |
| `claude-handoff` / `handoff` | 依赖后台 agent/issue tracker，OpenCode 的 task 工具可部分替代 |
| `requesting-code-review` | 现有 AGENTS 自审 + verification 已覆盖，暂缓 |

## 验证

- 目录存在且 `SKILL.md` frontmatter 的 `name` 与文件夹一致。
- 重启后用 `skill` 工具应能看到上述名字；若看不到，检查 opencode 的 skills 扫描路径。
- 来源均为 `main` 分支的 2026-11-13 快照；未记录 commit（jsDelivr 未返回 resolved hash）。

## 回滚

删除对应目录即可：

```powershell
$dst = "$env:APPDATA\com.sculab.openlab\runtime\xdg-config\opencode\skills"
Remove-Item -Recurse -Force "$dst\grilling", "$dst\grill-me", "$dst\writing-plans", "$dst\verification-before-completion", "$dst\systematic-debugging", "$dst\improve-codebase-architecture", "$dst\codebase-design", "$dst\research", "$dst\unslop", "$dst\web-design-guidelines"
```
