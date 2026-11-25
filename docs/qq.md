# QQ 机器人（养鱼插件 + SnowLuma）运维速查

## 架构

```
QQ 客户端（登录小号 <机器人小号QQ>）
  ↑ 注入
SnowLuma v2.4.2（127.0.0.1:5099 WebUI；OneBot WS 3001 / HTTP 3000，token 强制）
  ↑ OneBot v11
DSH 0.2.2 web profile 内养鱼插件 dsh-onebot-qq v0.1.2（12 子插件）
  ↓
DeepSeek API（DEEPSEEK_API_KEY）
```

主人（大号）发消息 → 小号收到 → SnowLuma 事件 → 插件 → DSH 会话 → 回复。

## 启动/重启

| 组件 | 脚本 | 端口 |
|---|---|---|
| DSH Web + 插件 | `butler\desktop\start-dsh-0.2.ps1` | 3107 |
| SnowLuma | `butler\adapters\start-snowluma.ps1` | 5099 / 3000 / 3001 |
| 全部（看门狗） | `butler\desktop\start-steward-hub.ps1 -GatewayPort 8080 -Weekly` | — |

看门狗已在 shell:startup（`Steward-Hub.lnk` → `start-hub.cmd`），开机自动拉起。

## 常见操作

- **换号/掉线**：QQ 客户端登录小号 → SnowLuma WebUI（`http://127.0.0.1:5099`，密码在 `butler\data\snowluma-webui-password.txt`）→「进程注入」页断开旧号、注入小号；重启后自动注入（HOOK_AUTOLOAD=true），但**只会注入当时在线的号**。
- **OneBot token**：SnowLuma `config\onebot_<UIN>.json`（每号一个；WS 与 HTTP 各一个 token）；插件配置 `%DSH_HOME%\dsh-onebot-qq\config.json` 的 `onebot.wsToken/httpToken` 要同步。
- **插件配置**：`butler\data\dsh-0.2.2-rc.4\home\dsh-onebot-qq\config.json`（adminQq/onebot/人设/插件开关；改后重启 DSH 生效）。
- **人设**：`...\dsh-onebot-qq\personas\`；换人设 `node bin\dsh-onebot-qq.mjs persona use <名字>`（插件源码目录 `butler\vendor\dsh-onebot-qq\`）。
- **斜杠命令**（主人私聊）：`/status` `/reset` `/history` `/help`。

## 排障

- 不回消息：`butler\data\logs\dsh-0.2\boot-*.err.log` 找 `[onebot-qq:onebot]`；SnowLuma 日志 `butler\data\logs\snowluma\`。
- 端口冲突：3000/3001 被占 = 两个 UIN 同时注入（WebUI 断开多余号）。
- 风控：新小号易被踢下线，WebUI 提示需扫码时重新登录 QQ 再注入。

## 风险提示

SnowLuma 是第三方注入，官方建议小号使用：只私聊、低频、别开大群。敏感内容别在 QQ 线上发。
