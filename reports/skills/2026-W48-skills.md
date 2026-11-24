# 技能升级简报 2026-W48

> 生成时间：2026-11-24 10:02 UTC · 来源：GitHub 15 / B站 6

---
# 技能升级简报 2026-W48

> 生成时间：2026-11-24 10:05 UTC · 来源：GitHub 15 / B站 6

---

## 一、GitHub 新技能（精选 10 个，按实用价值排序）

> 排序口径：触发频率 × 落地成本 × 能否验证效果，star 只作参考。兼容性按仓库自述判断，未点名 OpenCode 的一律标“待确认”。

**1. imuratalpay/ui-diff（★134，TypeScript）** — [github.com/imuratalpay/ui-diff](https://github.com/imuratalpay/ui-diff)
- 用途：为 PR 中的 UI 改动生成前后截图、像素差异和一份 UX 小结，把“看起来没变”变成可核对的证据。
- 适合：前端开发、设计验收，以及想给 coding agent 加一道视觉回归关卡的人。
- OpenCode：待确认（描述只称 agent skill，未列宿主）。

**2. pritamux/gridlines（★232，JavaScript）** — [github.com/pritamux/gridlines](https://github.com/pritamux/gridlines)
- 用途：做一遍对齐巡检——在界面上拉参考线，找出所有偏离网格的元素并修复 padding。
- 适合：前端实现、设计还原度检查、UI 细节打磨。
- OpenCode：待确认（描述未列宿主）。

**3. AyushRajSinghParihar/weaponized-curiosity（★94，Python）** — [github.com/AyushRajSinghParihar/weaponized-curiosity](https://github.com/AyushRajSinghParihar/weaponized-curiosity)
- 用途：把研究与实验约束成“证据驱动 + 有界优化”，先定义可验证的问题再动手。
- 适合：研究、竞品与技术调研，以及任何容易跑偏的长任务。
- OpenCode：待确认（自称 portable skill，但未点名宿主）。

**4. BoneD-Q/contextbridge（★68，Python）** — [github.com/BoneD-Q/contextbridge](https://github.com/BoneD-Q/contextbridge)
- 用途：用结构化证据、不确定性记录和校验来做跨 agent 与跨会话的上下文交接，避免只丢一段聊天记录过去。
- 适合：多 agent 协作、长任务换会话、需要保留审计链的工程。
- OpenCode：待确认（只说 cross-agent，未点名具体宿主）。

**5. nestjs/agent-skills（★157，JavaScript）** — [github.com/nestjs/agent-skills](https://github.com/nestjs/agent-skills)
- 用途：NestJS 官方维护的框架技能包，让 agent 按 Nest 的模块、依赖注入和装饰器惯例写代码。
- 适合：写 Node 后端、维护 Nest 项目的人。
- OpenCode：待确认（未列宿主；且是合集仓，需按子目录取用）。

**6. uxpilot-ai/user-interview-skill（★119）** — [github.com/uxpilot-ai/user-interview-skill](https://github.com/uxpilot-ai/user-interview-skill)
- 用途：生成中立的 1:1 用户访谈提纲，避免把结论写进问题里。
- 适合：产品经理、用户研究、需求验证。
- OpenCode：待确认（仅列 Claude Code、Codex、Cursor）。

**7. alesha-pro/inference-optimization-playbook（★85，Python）** — [github.com/alesha-pro/inference-optimization-playbook](https://github.com/alesha-pro/inference-optimization-playbook)
- 用途：97 条在 4 块 RTX 3090 且专家放内存条件下实测过的 MoE 推理优化假设，附一个给 coding agent 的现成 skill。
- 适合：本地跑大 MoE、折腾消费级 GPU 推理的人。
- OpenCode：待确认（只说 ready skill for coding agents）。

**8. memoryoffish/film-director-skill-plugin（★124，Python）** — [github.com/memoryoffish/film-director-skill-plugin](https://github.com/memoryoffish/film-director-skill-plugin)
- 用途：把“剧本→剪辑点→Blender 代理→声音”串成一条由 agent 当导演的短片流水线。
- 适合：AI 短片、内容创作，以及愿意折腾 Blender 的人。
- OpenCode：待确认（只说 for coding agents，未点名宿主）。

**9. danielwh2/sprite-stacking（★719，HTML）** — [github.com/danielwh2/sprite-stacking](https://github.com/danielwh2/sprite-stacking)
- 用途：把四视图像素画转成可旋转的伪 3D 精灵。
- 适合：游戏开发、像素美术、做素材演示的内容创作者。
- OpenCode：✅ 兼容（描述明确列出 Claude Code、Codex、Cursor、OpenCode、Gemini CLI、Pi）。

**10. xikhar/papercraft（★530，JavaScript）** — [github.com/xikhar/papercraft](https://github.com/xikhar/papercraft)
- 用途：用“手作立体纸艺”风格生成游戏、交互场景、网页和动画。
- 适合：内容与视觉创作、活动页和 demo。
- OpenCode：待确认（未列宿主）。

> 说明：sprite-stacking 星最多却排在第 9，是因为它只在像素素材场景触发；star 高不等于对你有用。

## 二、B站 学习视频（挑 4 个）

- **[吴恩达保姆级 Claude Agent Skills 全套教程](https://www.bilibili.com/video/BV1z4yRzEE4V)**（UP：吴老师人工智能，201 播放）— 本周唯一成体系覆盖 MCP、子代理、自定义 Skill、Claude API&SDK 的课程，适合当主课从头跟一遍。
- **[到底什么是 Skill？它和模型、工具、智能体有什么区别？](https://www.bilibili.com/video/BV1DJsq6HEdr)**（UP：张卓仁，107 播放）— 先把概念边界厘清，能少走“把一段 prompt 当 skill”的弯路。
- **[OpenAI负责人亲自教你，让AI说人话](https://www.bilibili.com/video/BV1EQyGzwEUy)**（UP：轻独AI，2.3 万播放）— 讲输出表达：同样的内容怎么写才像人话，对写简报和周报的人比多装一个 skill 更直接。
- **[如何让 AI 真正提升你的工作效率——第一课](https://www.bilibili.com/video/BV1kByhzXEcs)**（UP：0x1d，1087 播放）— 从“堆工具”转向“改工作流”，适合作为把 skill 接进日常的落地框架。

## 三、安装建议

**结论：本周只装 1–2 个，别把 15 个全 clone。** 每个 skill 都会进模型的可用清单，装多了既占上下文，也增加误触发；先用顺一个，再扩。

### 值得装（按优先级）

1. **ui-diff** — 产出是截图 + 像素 diff + UX 小结，可验收；适合“改完 UI 必须自检”的闭环。前提是你的环境能跑通它的截图流程，装前先看 README 的依赖。
2. **weaponized-curiosity** — 纯流程约束，几乎零依赖；把“先找证据、再下结论”固化下来，适合周报、调研和调参。
3. **gridlines** — 和 ui-diff 配对：一个发现偏差，一个修 padding；只在前端项目里启用。
4. **sprite-stacking** — 15 个里唯一明确写支持 OpenCode 的，装法最确定；做像素或游戏素材时直接出可旋转精灵。
5. **contextbridge** — 值得拿一个长任务试：跨会话交接带证据和不确定性，比复制聊天记录可靠；但它有自己的目录规范，先小范围用。
6. **nestjs/agent-skills** — 只在 Nest 项目里装，按子目录取用，别整仓塞。

### 按需 / 暂缓

- **user-interview-skill** — 质量看着不错，但一年用不了几次；做访谈前临时 clone 即可。
- **film-director-skill-plugin** — 剧本、剪辑、Blender 代理、声音整条链路都重，依赖多；不是视频工作者先别碰。
- **papercraft** — 风格型技能，触发面窄；有活动页或视觉 demo 需求再装。
- **inference-optimization-playbook** — 硬件门槛是 4 块 3090 加专家放内存，多数人复现不了；当技术文档读比当 skill 装更有价值。
- **dev-skills** — 只服务 dev.to 写作，不发 dev.to 就没有触发场景。
- **bridge-anything** — “给没有 API 的软件搭桥”思路实用，但描述里的 REA 没展开、缺样例，等成熟。
- **ashhart/skills** — 只有“我精选的技能”一句话，看不到清单和质量证据，先翻目录再决定。
- **android2linux** — 本质是手机改造指南加脚本，不是通用 agent 技能；没有备用安卓机不用装。

### 不建议

- **google-ai-offer-subscription** — 要 root 安卓模拟器 + Play Billing 下单，账号风控和合规风险都不低，收益只是“隐藏优惠”，不值得放进常驻技能。

### 装法（OpenCode）

```bash
# 全局：所有项目可见（Windows 为 C:\Users\<你>\.config\opencode\skills）
git clone https://github.com/imuratalpay/ui-diff.git ~/.config/opencode/skills/ui-diff

# 项目级：只对当前仓库生效
git clone <repo-url> .opencode/skills/<skill-id>
```

- 以目录为准，不以仓库为准：`skills/<id>/SKILL.md` 才算一个技能；克隆完先确认 `SKILL.md` 在哪一层，没有就不是 OpenCode 能识别的格式。
- 合集仓不要整仓放进技能目录：目录一旦含 `SKILL.md`，OpenCode 就不会再继续向下查找；`nestjs/agent-skills`、`ashhart/skills` 这类要按子目录分别放，或在 `opencode.json` 的 `skills` 数组里指向本地路径。
- 低频技能可在 frontmatter 加 `metadata.opencode/autoinvoke: false`：仍可用 `@skill-id` 手动调用，但不进模型常驻清单。
- 装完在 opencode 里 `@skill-id` 试一次，确认能加载再留下；skill 附带的脚本等于给 agent 执行权限，clone 前先读 `SKILL.md` 和 `scripts/`。
- 升级用 `git -C <dir> pull`；要改就在 fork 或分支上改，别直接动上游文件。
