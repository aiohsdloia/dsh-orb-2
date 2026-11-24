# PC-PC 同步设计（GitHub 交接棒）

> 状态：待审。审完再实现。

## 一、结论

**用 GitHub 私有仓库做同步，正解。** 理由：
- GLM 本来就在向 git 提交（openlab 项目已 60+ 提交、本地 master 干净）
- git 天然是两机交接棒：一台 push、另一台 pull，冲突可查可解
- GitHub 私有仓库免费、可配 PAT、断网时 VPN 即可通（主机工作流本来第一步就是开 VPN）

## 二、同步内容清单

| 内容 | 方式 | 仓库 |
|---|---|---|
| openlab 项目代码+规划+验收日志 | git push/pull | `openlab` 私有仓库（新建） |
| 管家本体代码+脚本（butler/、docs/ 等） | git push/pull | `dsh-orb-2` 私有仓库（新建 remote） |
| 会话历史（GPT/ZCode 对话） | ❌ 不同步（应用内状态，属各机私有） | — |
| 密钥（DeepSeek key、BigModel key、QQ 配置、GitHub PAT） | ❌ 不入 git；主机部署时手工/脚本配置 | — |
| 运行数据（butler/data、SnowLuma 登录态） | ❌ 不入 git（已 gitignore） | — |

**原则：git 里只有代码与文档，秘密永远不进去。**

## 三、单写者工作流（核心约束）

同一时刻只有一台机的 GPT+GLM 在跑，git 是交接棒：

```
开工前：git pull（拿最新）+ git status 干净才开干
干活中：GLM/GPT 照常 commit（现有工作流不变）
收工后：git push（一次完整 push，不留半截状态）
换机时：先 pull 再开工
冲突：理论罕见（单写者）；真出现 → 两边都不动，人工裁决
```

- 每期工作包完成后，管家（指挥台）在监督循环里自动加一步：`git add -A && git commit && git push`（推送项目库）。
- 主机开工前，管家自动 `git pull` 并把「当前 HEAD 与工作包基线是否一致」写进汇报。

## 四、网络依赖

- 本机与主机都需要能连 github.com：本机走 VPN（7890，已验证通）；主机部署时同样先开 VPN。
- git 需要配置代理或直连：`git config --global http.proxy http://127.0.0.1:7890`（连 VPN 时）。若直连可用则不用配。

## 五、鉴权

- 需要你的 GitHub 账号创建两个**私有仓库**，并给一个 PAT（repo 权限）或安装 `gh` CLI 登录。
- PAT 存放：`butler/config/github.json`（gitignored），主机部署时单独配置，不入 git。

## 六、实现里程碑

- **P1 建仓**：GitHub 建 `openlab` + `dsh-orb-2` 两个私有仓库（需要你提供账号/授权或 PAT）
- **P2 首次同步**：本机两个仓库加 remote、push 全量；验证：clone 到临时目录能复现（等于主机视角演练）
- **P3 自动化**：指挥台预设加「收工 push / 开工 pull」两步；hub 可加每周 git 同步检查
- **P4 主机部署演练**：主机到位后按 docs/deployment.md + 本设计走一遍（克隆、密钥配置、pull、开跑）

## 七、待你确认

1. GitHub 账号名？有没有 `gh` CLI / 是否愿意提供一个 PAT（repo 权限）？
2. 仓库名：`openlab` 和 `dsh-orb-2` 可以吗（私有）？
3. dsh-orb-2 是否也推 GitHub？（AGENTS 默认不推远端，需要你明确同意才加 remote）
4. 单写者约束接受吗？（两台机同时跑同一项目会有冲突，设计上不允许）
