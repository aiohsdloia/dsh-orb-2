# Desktop / Hub Scripts

| Script | Purpose |
|---|---|
| `start-dsh-0.2.ps1` | DSH 0.2.2-rc.4 Web on `127.0.0.1:3107`（npm 安装版，DSH_HOME=`butler/data/dsh-0.2.2-rc.4/home`） |
| `start-dsh-computer-use.ps1` | 旧 0.1.7 源码版（保留作回滚参考） |
| `start-steward-hub.ps1` | 24/7 看门狗：DSH + 网关 + SnowLuma 监督，周日 20:00 触发周报（`-GatewayPort 8080 -Weekly`） |
| `start-hub.cmd` | 自启 shim；快捷方式已放 shell:startup（`Steward-Hub.lnk`） |
| `register-hub-task.ps1` | 计划任务方案（需管理员；无管理员用上面 startup 快捷方式） |
| `health-check.ps1` | JSON 状态：端口、进程、DSH_HOME、磁盘、日志 |

## Notes

- DSH 只接受具体接口地址绑定（`--host`），拒绝通配；远程访问走网关 `butler/remote/gateway.mjs`（0.0.0.0:8080 + 配对码）。
- Computer Use 需要解锁的交互桌面；Hub 保持登录。
- 环境：`STEWARD_HOME`、`DEEPSEEK_API_KEY`（无 key 时回退 OpenLab auth.json）。
- 停进程纪律（原则 11）：先向用户确认，再核 PID/进程名/命令行，只停已核实目标，绝不用 `taskkill /T /F`。
- QQ 机器人运维见 `docs/qq.md`；部署清单 `docs/deployment.md`；周报设计 `docs/weekly-report-design.md`。
