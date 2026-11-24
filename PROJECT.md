# DSH Steward

**Steward**（中文：管家）是一个个性化的 DeepSeek Harness（DSH）改造项目：住在你电脑里的个人电脑管家。

它不是一个通用研究平台，也不是 OpenLab。OpenLab 只是开发它的宿主应用；Steward 是项目本身。

## 一句话

> 用 DSH 做底座，给自己造一个能定时巡查、看视频、出简报、远程接受任务并操作电脑的管家。

## 部署形态

目标是一台**常开、通电、不关机的 Windows 轻薄本**，作为 24/7 Steward Hub：

- DSH Web 绑回环，Tailscale/SSH 隧道远程访问；
- 登录自启 + 看门狗；保持登录且不锁屏，Computer Use 才能工作；
- 周报/ASR 放夜间，只处理 Top 1–2；
- 部署清单见 `docs/deployment.md`。

## 名字

- 英文：**Steward**
- 中文：**管家**
- 代码目录：`butler/`
- 运行时：DSH（当前锁定 0.1.7-rc.1，用于 Computer Use）

## 边界

- 不做拟人化陪伴、角色扮演、社交账号运营。
- 不绑定任何单一通道；QQ/微信/飞书只是可选适配器。
- 不把 OpenLab 的研究数据和个人助手数据混在一起。

## 文档

- `docs/engineering-plan.md`：R0–R6 路线
- `docs/personal-assistant-design.md`：架构与控制面
- `reports/2026-11-13-dsh-deep-research.md`：DSH 能力调研
- `knowledge/current-state.md`：当前状态
- `notes/`：每日工作日志
