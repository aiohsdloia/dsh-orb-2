# Butler Control Plane

Job state machine, budget, approvals, ledger, and Feishu↔DSH session mapping.
No external dependencies; uses Node 24's built-in `node:sqlite`.

## Run

```bash
cd butler/control-plane
node --no-warnings src/cli.mjs init
```

Data lives in `butler/control-plane/data/control.db` (gitignored). Override with `BUTLER_DB=/path/to.db`.

## Job model

| Field | Meaning |
|---|---|
| `id` | job id (or generated) |
| `type` | handler type (`mock` today) |
| `status` | `queued` → `running` → `waiting_approval` → `done` / `failed` |
| `idempotency_key` | unique; repeated create returns the existing job |
| `spec` | stages, approval stage, failure injection, per-stage tokens |
| `budget` | tokens / moneyCny / videoMinutes / wallClockMin |
| `checkpoint` | last completed stage; used for resume |

## CLI

```bash
# create a 4-stage job that needs approval before publish
node --no-warnings src/cli.mjs job create \
  --id weekly-demo --type mock \
  --stages collect,transcribe,rank,publish \
  --budget-tokens 1000 \
  --require-approval publish

# run until approval or completion
node --no-warnings src/cli.mjs job run weekly-demo

# approve the pending stage, then resume from checkpoint
node --no-warnings src/cli.mjs job approve weekly-demo --stage publish
node --no-warnings src/cli.mjs job run weekly-demo

# inspect
node --no-warnings src/cli.mjs job status weekly-demo
node --no-warnings src/cli.mjs ledger weekly-demo
node --no-warnings src/cli.mjs events weekly-demo
```

## Semantics

- **Budget hard stop**: checked before and after each stage; over-budget fails the job.
- **Approval gate**: `spec.requireApprovalAt` pauses at that stage; `job approve` records a decision; `job run` resumes.
- **Checkpoint resume**: after a failure, `job run` starts from the stage after `checkpoint`.
- **Idempotency**: `createJob` with the same key returns the original job.
- **Ledger**: every spend records `kind`, `amount`, `unit`, and metadata.
- **Sessions**: `chat_id → dsh session_id` mapping, used by `butler/feishu-bridge/bridge-v1.mjs`.

## Test

```bash
npm test
```

Covers happy path, idempotency, budget stop, approval gate, and checkpoint resume.

## Integration

`bridge-v1.mjs` imports `openDb`, `jobs`, and writes:

- one job per incoming message (`idempotency_key = Feishu message_id`);
- DSH `step_end` usage as `tokens` ledger entries;
- wall-clock minutes;
- session mapping for follow-up turns.

## Limits

- `node:sqlite` is experimental in Node 24; pin the Node version.
- One SQLite writer at a time; WAL is enabled, but heavy concurrency should move to Postgres.
- No retention/cleanup yet; add a `jobs prune` command before long-running use.
