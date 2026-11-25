# 天枢（Steward）项目交接说明 —— 给 GPT 的项目背景

## 项目是什么

**天枢**是一个"个人电脑管家"：基于 DeepSeek Harness（DSH）搭建的常驻智能体系统。名字取自北斗七星第一星（天枢 = 中枢、枢纽）。技术代号 Steward。

它住在用户电脑里，24/7 运行，具备这些能力：
- QQ 机器人（小号"蓝色大肥鱼"人设，实际是用户的顾问+秘书：随手问答、记笔记、排日程、到点提醒）
- 每周自动生成周报（arXiv/PubMed/期刊RSS/GitHub/B站 五源）并推送到用户 QQ
- 每周技能升级简报（新涌现的 AI skill 推荐）
- "主机指挥台"：作为中间人协调 ChatGPT（项目经理）与 ZCode/GLM（编码员）的项目协作
- Computer Use：直接操作桌面应用（已在真实项目中使用）

## 项目目录

- **主工作区**：`C:\Users\10840\Documents\OpenLab\projects\dsh-orb-2`
  - `butler/` 全部管家代码（脚本/任务/适配器）
  - `butler/desktop/` 桌面相关：`launcher.ps1`（统一入口小窗口）、`open-tianshu.ps1`（App 模式打开天枢网页）、`make-icon.ps1`（程序生成图标）
  - `butler/assets/` 视觉资产（图标初稿 `tianshu.png` / `tianshu.ico` 在这里）
  - `docs/` 设计文档（`pm-courier-design.md`、`pc-sync-design.md`、`weekly-report-design.md` 等）
  - `PROJECT.md` 项目说明；`knowledge/current-state.md` 当前状态
- 运行时数据：`butler/data/`（已 gitignore，不用看）

## 现在交给你的事：视觉/美术

用户希望给天枢一套视觉设计，当前已知的载体：
1. **桌面快捷方式图标**（`.ico`，需内嵌 256×256 PNG；Windows 快捷方式用它）
2. **统一入口小窗口**（`butler/desktop/launcher.ps1`，一个 420×320 的 Windows 小窗，两个按钮：天枢 / OpenLab，可配背景/配色）
3. 可能后续：QQ 机器人头像、周报封面等

**设计基调参考**：名字"天枢"= 北斗第一星。现有初稿是深蓝圆底 + 北斗七星连线（`butler/assets/tianshu.png`，可推翻重做）。风格建议：极简、有古典星象韵味、深色系。最终由用户拍板。

## 你的产出约定

- 设计稿文件放进 `C:\Users\10840\Documents\OpenLab\projects\dsh-orb-2\butler\assets\`（png/svg 均可）
- 每个方案附简短说明（写在 `butler/assets/README.md` 或直接回复里）
- 需要程序生成位图时，可用 `butler/desktop/make-icon.ps1` 的思路（System.Drawing 画图 + 转 ico），但**不要运行任何服务或脚本**、不要改动代码
- 产出后用户会把结果转交回来落地

## 禁止事项

- 不要启动/停止任何进程、服务（DSH、SnowLuma、hub 等都在运行中）
- 不要修改 `butler/` 下的代码与配置
- 不要动 `butler/data/` 运行时数据
