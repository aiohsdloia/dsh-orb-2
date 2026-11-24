# Steward Hub 部署（24/7 Windows 轻薄本）

目标：把 Steward 部署到一台**常开、通电、不关机**的 Windows 轻薄本上，作为个人 Hub。
DSH 继续绑 `127.0.0.1`；远程通过 Tailscale/SSH 隧道，不直接暴露公网。

> 本文是目标机部署指南。当前开发机只做验证，不在本机注册任务或部署。

---

## 1. 目标机画像

| 项 | 假设 |
|---|---|
| 设备 | Lenovo 轻薄本，CPU-only，无独显 |
| 系统 | Windows 10/11（以 11 为主） |
| 电源 | 常插电，不关机，不合盖休眠 |
| 会话 | 保持登录且不锁屏（Computer Use 需要交互桌面） |
| 网络 | 家庭/办公常开网络；手机通过 Tailscale 访问 |
| 资源 | 内存 16GB 左右；磁盘至少留 10GB |

---

## 2. 前置依赖

| 组件 | 版本 / 说明 |
|---|---|
| Node.js | 24.x（`node -v`） |
| pnpm | 11.7.x（与 DSH 源码一致） |
| Git | 用于拉取固定 commit |
| Python | 3.10+（ASR） |
| faster-whisper | `pip install faster-whisper` |
| ctranslate2 | **必须锁 `4.5.0`**（4.9.0 在本机出现访问冲突） |
| yt-dlp | `pip install yt-dlp` |
| ffmpeg | 用 `imageio-ffmpeg` 自带二进制即可 |
| Tailscale | Windows 客户端 + iPhone App，同一 tailnet |
| DSH 源码 | `deepseek-harness-orb`，commit `51f09764d7ff99947be08ebbb2ca2388faab3df4`（0.1.7-rc.1） |

安装示例（PowerShell）：

```powershell
pnpm install --frozen-lockfile
pnpm run build
python -m pip install --no-cache-dir faster-whisper "ctranslate2==4.5.0" yt-dlp imageio-ffmpeg -i https://pypi.org/simple
```

---

## 3. 目录与配置

建议：

```
D:\Steward\                        # STEWARD_HOME（可自定义）
  upstream\deepseek-harness-orb\   # DSH 源码（固定 commit）
  butler\
    config\interests.json          # 个人兴趣/UP/阈值（不入库）
    data\                          # 运行时数据（gitignored）
      dsh-0.1.7-rc.1\home\         # 隔离的 DSH_HOME
      bili\                        # 音频、转写、内容缓存
      logs\                        # Hub/DSH 日志
  reports\                         # 周报与简报
```

环境变量：

```powershell
[Environment]::SetEnvironmentVariable('STEWARD_HOME', 'D:\Steward', 'User')
[Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY', '<your-key>', 'User')
```

- `STEWARD_HOME`：项目根目录；启动脚本优先使用它。
- `DEEPSEEK_API_KEY`：目标机不再依赖 OpenLab `auth.json`；启动脚本优先读环境变量。
- 可选：`BILI_COOKIE`（需要关注列表/更高清晰度时）。

---

## 4. 启动与常驻

### 手动验证

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Steward\butler\desktop\start-dsh-computer-use.ps1 -Port 3107
```

启动日志里会打印：

```
dsh web: http://127.0.0.1:3107/?token=...
```

这个 token URL 每次重启会变；从 `butler/data/logs/dsh-web-*.out.log` 取最新。

### 24/7 看门狗

`butler/desktop/start-steward-hub.ps1`：
- 检查 3107 是否已监听；已监听就等待，不重复启动。
- 未监听则启动 DSH Web，记录 stdout/stderr 到 `butler/data/logs/`。
- 进程退出后等 10 秒重启。

### 注册登录自启

先 dry-run 看命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Steward\butler\desktop\register-hub-task.ps1
```

确认后再注册：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Steward\butler\desktop\register-hub-task.ps1 -Register
```

任务为 `ONLOGON` + `/IT`：只在用户登录的交互会话里跑，Computer Use 才能工作。
如果 Windows 需要自动登录，使用 `netplwiz` 或 Autologon；这会把账号密码留在本机，需评估物理安全。

### 健康检查

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Steward\butler\desktop\health-check.ps1
```

输出端口、DSH 进程、DSH_HOME、磁盘剩余和日志目录。加 `-Restart` 会启动看门狗（不会杀进程）。

---

## 5. 电源与会话

必须做（管理员 PowerShell）：

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 30
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT
```

- 合盖动作设为“不操作”；否则合盖就睡。
- 保持登录、不锁屏；锁屏/注销可能让 Computer Use 的截图与输入失效（**需在目标机实测**）。
- 插电常开时开电池保养模式（Lenovo Vantage），减少电池长期满电损耗。
- Windows Update 设置活动时间；接受重启后由看门狗/计划任务补跑。

---

## 6. 远程访问（iPhone）

推荐 Tailscale，不暴露公网：

1. Windows 和 iPhone 安装 Tailscale，登录同一账号。
2. DSH 保持 `127.0.0.1:3107`。
3. 在 Windows 上：
   ```powershell
   tailscale serve --bg 3107
   tailscale serve status
   ```
4. iPhone 打开 `https://<机器名>.<tailnet>.ts.net/?token=<DSH token>`。

注意：
- Tailscale Serve 会改写 Host；如果 DSH `/api` 返回 400/403，需要在启动 DSH 时加 `--trusted-host <机器名>.<tailnet>.ts.net`，或改用 SSH 隧道。
- 不要用 `tailscale funnel` 暴露公网；DSH 能执行本机代码。
- 手机端只走 tailnet；Tailscale ACL 限制到自己的设备。
- 如果 Tailscale Serve 不通，退路是 SSH 隧道（PC↔PC），iPhone 不适合。

### QQ 远程介入（消息通道，跨网）

日常用 Tailscale 开完整界面；人在外面用 QQ 发任务/收汇报（不依赖局域网）：

1. 电脑装 **NapCat**（或 LLOneBot），用你的 QQ 号登录，开启 WebSocket 服务（默认 `ws://127.0.0.1:3001`）。
2. 设置环境变量：
   ```powershell
   [Environment]::SetEnvironmentVariable('QQ_WS_URL', 'ws://127.0.0.1:3001', 'User')
   [Environment]::SetEnvironmentVariable('QQ_ALLOWED_UIDS', '<你的QQ号>', 'User')
   ```
3. Hub 一并监督 QQ 适配器：
   ```powershell
   powershell -File D:\Steward\butler\desktop\start-steward-hub.ps1 -GatewayPort 8080 -StartQQ
   ```
4. 手机 QQ 私聊“自己”（或 NapCat 登录号）即可下任务、收结果；`butler/adapters/qq.mjs` 负责转发，白名单外一律忽略。
5. 风险：非官方协议，账号可能被风控；只私聊、低频使用。

官方 QQ 机器人（开放平台）也已实现（`QQ_MODE=official`），但回调要求公网 HTTPS，需要 Cloudflare Tunnel，暂不作为默认。

---

## 7. 定时任务

- 周报：`butler/jobs/weekly/run-weekly.ps1`；建议周一 09:00，夜间跑 ASR 更稳。
- 注册示例（先 dry-run）：
  ```powershell
  powershell -File D:\Steward\butler\jobs\weekly\register-task.ps1 -Day MON -Time 09:00
  ```
- 任务要允许“错过启动后尽快运行”；DSH 重启/Windows Update 后仍能补跑。
- 周报默认 `--content-top 1`；轻薄本不要一次跑多条视频的 ASR。

---

## 8. 资源与性能

- ASR 默认 `base`、`WHISPER_COMPUTE=float32`（或 int8 试跑），单条限 5 分钟。
- 每周只对 Top 1–2 条做内容速览；其余只保留元数据。
- 避免 ASR 与 Computer Use 同时跑；把周报放在夜间/空闲时段。
- 监控温度、磁盘、内存；轻薄本长时间满载会降频。
- 模型和 node_modules 约 2–3GB；至少留 10GB 空闲。

---

## 9. 安全

- DSH Web 只绑回环；不开放公网端口。
- Tailscale ACL 只允许自己的设备；不要共享 tailnet。
- DSH token URL 等同访问权限，不要发到聊天/截图。
- Windows 防火墙保持开启；只为 Tailscale 放行。
- 物理安全：常开+免登录的机器不要放在公共区域。
- 插件锁版本；升级前备份 profile 和 `butler/data`。
- 备份：`butler/config`、`butler/data`、`reports`、DSH profile；定期导出。

---

## 10. 回滚

```powershell
schtasks /Delete /TN "DSH Steward Hub" /F
schtasks /Delete /TN "DSH Steward Weekly" /F
```

- 删除计划任务不会删除数据。
- 恢复 DSH profile：`profiles/web.bak-<date>`。
- 需要停止当前 DSH Web 时，先确认 PID/命令行是 `node.exe` + `--profile web`，再用 `Stop-Process -Id`；不要用 `taskkill /T /F` 打整棵树。

---

## 11. 部署检查单

- [ ] Node 24 / pnpm 11.7 / Git
- [ ] DSH 源码固定 commit，`pnpm install` + `build`
- [ ] Python + faster-whisper + `ctranslate2==4.5.0` + yt-dlp + imageio-ffmpeg
- [ ] `STEWARD_HOME` / `DEEPSEEK_API_KEY` 已设置
- [ ] `interests.json` 已填 topics / ups / 阈值
- [ ] 手动启动 3107 成功，token URL 可取
- [ ] Hub 看门狗启动，退出能自动重启
- [ ] 登录自启任务已注册（ONLOGON + /IT）
- [ ] 电源：不睡眠/不合盖休眠；保持登录不锁屏
- [ ] Tailscale + iPhone 能打开 DSH Web
- [ ] 周报计划任务 dry-run 通过，再注册
- [ ] 备份 config/data/reports
- [ ] Computer Use 在目标机实测（打开记事本→输入→保存→读回）
