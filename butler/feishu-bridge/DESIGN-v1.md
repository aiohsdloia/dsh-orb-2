# Feishu Bridge v1 设计

日期：2026-11-13
状态：草案（等 Feishu App ID/Secret 做真机验证）
现状：`bridge-v0.mjs` 已跑通「飞书 WS → `dsh --profile headless` → 回消息」，但**无会话连续性、无进度、无审批**。

---

## 1. 目标

1. 飞书私聊/群聊 → butler 任务 → 结果回传。
2. 同一会话连续多轮，保留上下文。
3. 长任务有进度反馈，不只是一次性等待。
4. 写操作/外部动作走审批卡片。
5. 所有运行进入 control-plane 账本（token、耗时、错误）。

## 2. 非目标

- 不在飞书里暴露原始 shell。
- 不做自动加好友/群发/营销。
- 不绕过飞书权限模型。

---

## 3. 组件

```
Feishu WS ──> Router ──> SessionStore ──> DSH Runner ──> NDJSON events
                  │                           │
                  ├──> Progress/Approval cards│
                  └──> Control-plane DB <─────┘
```

| 组件 | 职责 |
|---|---|
| Feishu adapter | WS 长连接、消息解析、卡片发送、open_id 白名单 |
| Router | 命令解析、任务创建、会话映射、幂等 |
| DSH Runner | spawn `dsh headless --json`，解析 NDJSON，超时/取消 |
| SessionStore | `sessions` 表：chat_id/thread → dsh sessionId |
| Approval | 审批请求 → 卡片 → 批准/拒绝 → 继续任务 |
| Ledger | token/耗时/错误写入 control-plane |

---

## 4. 消息协议

### 用户 → butler

| 输入 | 行为 |
|---|---|
| 普通文本 | 创建并运行一个任务 |
| `/run <task>` | 显式创建任务 |
| `/status [jobId]` | 查看状态/最近事件 |
| `/approve <jobId> [stage]` | 批准 |
| `/deny <jobId> [stage]` | 拒绝 |
| `/cancel <jobId>` | 取消 |
| `/new` | 清除当前会话映射，开新会话 |

### butler → 用户

1. **进度卡**：阶段、已用时、token、最近事件。
2. **审批卡**：动作、参数摘要、风险、允许/拒绝按钮。
3. **最终卡**：答案 + 来源（如有）+ 成本。

进度更新节流：同一 job 最多每 3–5 秒编辑一次卡片，避免飞书限流。

---

## 5. DSH 调用

已实测（`@deepseek-ai/dsh` 0.2.2-rc.1）：

```bash
dsh headless --json --approval-policy never "task"
```

stdout 是 NDJSON：

```json
{"type":"session","sessionId":"session-...","cwd":"..."}
{"type":"status","phase":"turn_start","turn":1}
{"type":"status","phase":"step_start","turn":1,"step":1}
{"type":"thinking","text":""}
{"type":"text","text":"PING"}
{"type":"status","phase":"step_end","turn":1,"step":1,"usage":{"inputTokens":431,"outputTokens":3,"cacheReadTokens":6528,"totalTokens":6962}}
{"type":"status","phase":"turn_end","turn":1,"reason":{"kind":"completed"}}
{"type":"final","sessionId":"session-...","reason":{"kind":"completed"},"text":"PING"}
```

续会：

```bash
dsh headless --json --session-id session-... "continue"
```

要点：
- `session` 事件里的 `sessionId` 存入 `sessions` 表。
- `status/step_end` 的 usage 写入 ledger（tokens）。
- `final.text` 作为最终回复；`reason` 非 `completed` 时标记失败。
- 超时/取消：kill 子进程，job 标记 `canceled`，记录部分事件。
- 审批：`--approval-policy ask` 的事件格式待用真实写操作验证；在验证前，读任务用 `never`，写任务先不开放。

---

## 6. 会话映射

`control-plane` 的 `sessions` 表：

| chat_id | session_id | updated_at |
|---|---|---|
| `oc_xxx` | `session-...` | ISO |

规则：
- 首次消息：不传 `--session-id`，从 `session` 事件取 id 并保存。
- 后续消息：传 `--session-id`；若 DSH 报 unknown id，则清空映射并开新会话。
- 群聊：`chat_id` + 可选 `thread_id` 作为 key，避免不同话题串线。

---

## 7. 审批

阶段一（现在）：
- 只读任务：`--approval-policy never`，不需要审批。
- 写任务：不开放；先在 CLI/控制面里审批。

阶段二（M6）：
- 写任务使用 `--approval-policy ask`，拦截审批事件。
- 飞书卡片：动作、参数、影响范围、允许/拒绝/稍后。
- 默认拒绝；超时 10 分钟自动拒绝。
- 批准后恢复同一 session/job。

> 待验证：`dsh headless --json` 在 `ask` 模式下是否输出可捕获的审批事件，还是阻塞在 stdin。若是后者，需要改用 DSH 的 web/API 通道或插件。

---

## 8. 安全

- `FEISHU_ALLOWED_OPEN_ID` 白名单（v0 已有）。
- 校验消息来源；不信任 `chat_id` 以外的字段。
- 不在日志/卡片中输出 API key、文件绝对路径、完整命令。
- 写操作必须审批；删除/支付/发送默认拒绝。
- 限流：每用户每分钟 N 条；长任务排队。
- 幂等：Feishu `message_id` 去重；job `idempotency_key`。

---

## 9. 失败处理

| 情况 | 行为 |
|---|---|
| DSH 无输出/超时 | 标记 failed，回传最后事件与错误摘要 |
| 未知 sessionId | 清映射，开新会话，提示“上下文已重置” |
| 飞书发送失败 | 重试 3 次；仍失败写日志，任务结果保留在 control-plane |
| 重复消息 | 忽略并回“已处理” |
| 审批超时 | 默认拒绝，任务暂停/失败 |

---

## 10. 验收

1. 手机发一句任务，收到进度 + 最终答案。
2. 同一 chat 连续 3 轮，上下文保持（session 复用）。
3. 断线重连后，不重复执行同一 message_id。
4. 任务 token/耗时进入 ledger。
5. 读任务不需要审批；写任务在 M6 前保持关闭。
6. 未授权 open_id 被拒绝并记录。

---

## 11. 迁移

- 保留 `bridge-v0.mjs` 作为最小回退。
- `bridge-v1.mjs` 增加 `--mock` 模式，无飞书凭据也能测 DSH 调用、会话映射与账本。
- 真机验证通过后再替换 v0。
