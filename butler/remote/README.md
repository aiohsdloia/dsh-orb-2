# Remote: PC ↔ iPhone / PC ↔ PC

DSH 0.1.7 只允许回环监听。`gateway.mjs` 是一个零依赖的配对网关：它把 iPhone / 另一台 PC 安全地接到 `127.0.0.1:3107` 的 DSH Web 上，HTTP 和 WebSocket 都转发。

## 1. 启动

```powershell
# 本机验证（只监听回环）
powershell -File butler\remote\start-gateway.ps1

# 家庭局域网（手机/另一台 PC 可访问）
powershell -File butler\remote\start-gateway.ps1 -Lan
```

参数：
- `-Port 8080`：网关端口（默认 8080）
- `-Token <dshtoken>`：DSH Web 的 token；不传则从 `butler/data/logs/dsh-web-*.out.log` 自动读取，读不到会显示“missing”
- `-Lan`：绑定 0.0.0.0 并打印局域网访问地址

## 2. iPhone 使用

1. iPhone 和电脑连同一个 Wi-Fi。
2. iPhone Safari 打开网关打印的 `http://<电脑局域网IP>:8080/m`。
3. **配对码只在电脑上**：电脑上运行 `powershell -File butler\remote\get-pairing-code.ps1`（或看 `butler/data/gateway-code.txt` / 网关日志），把 8 位数字输入手机。
4. 配对成功会拿到 30 天 cookie，自动进入 DSH Web；用 Safari“添加到主屏幕”就是全屏 App。

配对码 10 分钟自动轮换；过期请重新查码。

## 3. 另一台 PC 使用

同一局域网内，浏览器打开 `http://<Hub局域网IP>:8080/m`，同样配对后使用。两台 PC 都开 DSH 时，各自跑一个网关即可（互访）。

## 4. 安全

- 配对码 10 分钟有效；同一 IP 错 5 次锁定 1 分钟。
- Cookie 用本机随机密钥 HMAC 签名（`butler/data/gateway-secret`）。
- 网关把 Host 重写为回环，DSH 仍然只见 127.0.0.1。
- **只在信任的局域网用 `-Lan`**；不要把 8080 端口转发到公网。公网远程用 Tailscale（`tailscale serve` 或访问 `http://<tailscale-ip>:8080/m`）。
- DSH token 由网关注入，不会出现在手机地址栏。

## 5. 故障排查

- `token=missing`：先启动 DSH Web（`start-steward-hub.ps1`），等日志出现 token 行；或手动 `-Token`。
- 页面能开但 API 报 403：用 `start-dsh-computer-use.ps1 -TrustedHost <局域网IP>:8080` 启动 DSH，再试。
- 502：DSH Web 没在目标端口运行。
- 网页聊天不实时：WebSocket 转发失败，检查 DSH 日志和网关日志 `butler/data/logs/gateway-*.log`。

## 6. 与 24/7 Hub 集成

`start-steward-hub.ps1 -GatewayPort 8080` 会同时拉起 DSH 和网关看门狗。登录自启任务把该参数带上即可。
