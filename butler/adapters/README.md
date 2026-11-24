# Input Adapters

The core assistant is channel-agnostic. QQ / WeChat / Feishu / email are optional
adapters, not dependencies.

## Contract

Every adapter implements `butler/adapters/types.mjs`:

```js
class InputAdapter {
  async start() {}
  async stop() {}
  async reply(message, text) {}
}
```

Incoming messages are normalized to:

```js
{
  id: "stable message id",
  channel: "qq" | "wechat" | "feishu" | "email" | "local",
  conversationId: "chat/thread key for session mapping",
  userId: "sender id",
  text: "plain text",
  raw: {}
}
```

## Implemented

| Adapter | Status | Notes |
|---|---|---|
| `local.mjs` | working | stdin/stdout; default for development |
| `qq.mjs` | working (mock verified) | OneBot 11 + 官方 QQ bot 两条路，见下 |
| `../feishu-bridge/bridge-v1.mjs` | reference only | proves DSH `--json` + `--session-id`; not a core dependency |
| `../wechat-reader/uia-read.ps1` | reference only | desktop screen/OCR tool; not a messaging adapter |

## QQ adapter

文件：`qq.mjs`、`start-qq.ps1`；共享执行器：`butler/core/dsh-runner.mjs`。

### 模式 A：OneBot 11（NapCat / LLOneBot）— 推荐，跨网可用

手机 QQ 发消息 → 腾讯服务器 → 电脑上的 NapCat（协议框架）→ 本地适配器 → DSH 执行 → 结果发回手机 QQ。**不依赖局域网，不需要公网**。

配置（环境变量）：
- `QQ_WS_URL`：NapCat 的 WebSocket 服务地址，默认 `ws://127.0.0.1:3001`
- `QQ_ALLOWED_UIDS`：只认这些 QQ 号（逗号分隔）；为空则拒绝一切

运行：`powershell -File butler\adapters\start-qq.ps1`

注意：非官方协议，QQ 账号有风控风险；只私聊自己、不要群发、不要高频。

### 模式 B：官方 QQ 机器人（开放平台）

- 环境变量：`QQ_MODE=official`、`QQ_APP_ID`、`QQ_APP_SECRET`、`QQ_PUBLIC_KEY`（Ed25519 公钥）、`QQ_PORT`（默认 8090）。
- 适配器起 HTTP webhook（`/qq`），校验 `X-Signature`（ed25519），回消息走 QQ API。
- **要求公网 HTTPS 回调地址**（需要 Cloudflare Tunnel 之类），本机无法直接收到官方回调；实现按官方文档，未真机验证。

### 自测

```bash
node qq.mjs --mock "Reply with exactly PING and nothing else. Do not call tools."
```

## Adding WeChat / Feishu / email

1. Create `wechat.mjs` / `feishu.mjs` / `email.mjs` extending `InputAdapter`.
2. Map native events to `IncomingMessage`; dedupe by native message id.
3. Use `conversationId` as the key for `control-plane` session mapping.
4. Send replies through the adapter; never import the SDK into the core.
5. Keep the adapter optional: if it fails, the Web UI/CLI must still work.

## Non-goals

- No auto-friend, group broadcast, or marketing.
- No platform risk-control bypass.
- No direct shell exposure in chat.
