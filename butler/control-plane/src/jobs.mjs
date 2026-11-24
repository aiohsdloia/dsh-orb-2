import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()

function parseJson(value, fallback) {
  if (value == null) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

function rowToJob(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    spec: parseJson(row.spec_json, {}),
    budget: parseJson(row.budget_json, {}),
    checkpoint: row.checkpoint,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createJob(db, { id, type = 'generic', spec = {}, budget = {}, idempotencyKey } = {}) {
  const jobId = id ?? randomUUID()
  const ts = now()
  const budgetJson = JSON.stringify({
    tokens: budget.tokens ?? null,
    moneyCny: budget.moneyCny ?? null,
    videoMinutes: budget.videoMinutes ?? null,
    wallClockMin: budget.wallClockMin ?? null,
  })
  try {
    db.prepare(
      `INSERT INTO jobs (id, type, status, idempotency_key, spec_json, budget_json, created_at, updated_at)
       VALUES (?, ?, 'queued', ?, ?, ?, ?, ?)`
    ).run(jobId, type, idempotencyKey ?? null, JSON.stringify(spec), budgetJson, ts, ts)
  } catch (error) {
    if (idempotencyKey && String(error.message).includes('UNIQUE')) {
      return getJobByIdempotencyKey(db, idempotencyKey)
    }
    throw error
  }
  return getJob(db, jobId)
}

export function getJob(db, id) {
  return rowToJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id))
}

export function getJobByIdempotencyKey(db, key) {
  return rowToJob(db.prepare('SELECT * FROM jobs WHERE idempotency_key = ?').get(key))
}

export function listJobs(db, { status, limit = 50 } = {}) {
  const rows = status
    ? db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit)
    : db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit)
  return rows.map(rowToJob)
}

export function claimJob(db, id) {
  const result = db.prepare(
    `UPDATE jobs SET status = 'running', updated_at = ?
     WHERE id = ? AND status IN ('queued', 'failed', 'running', 'waiting_approval')`
  ).run(now(), id)
  return result.changes === 1 ? getJob(db, id) : null
}

export function setStatus(db, id, status, { error = null } = {}) {
  db.prepare('UPDATE jobs SET status = ?, last_error = ?, updated_at = ? WHERE id = ?')
    .run(status, error, now(), id)
  return getJob(db, id)
}

export function setCheckpoint(db, id, checkpoint) {
  db.prepare('UPDATE jobs SET checkpoint = ?, updated_at = ? WHERE id = ?')
    .run(checkpoint, now(), id)
}

export function startRun(db, jobId) {
  const result = db.prepare(
    `INSERT INTO runs (job_id, status, started_at) VALUES (?, 'running', ?)`
  ).run(jobId, now())
  return Number(result.lastInsertRowid)
}

export function finishRun(db, runId, status, error = null) {
  db.prepare('UPDATE runs SET status = ?, finished_at = ?, error = ? WHERE id = ?')
    .run(status, now(), error, runId)
}

export function recordEvent(db, jobId, runId, type, message = null) {
  db.prepare(
    'INSERT INTO events (job_id, run_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(jobId, runId ?? null, type, message, now())
}

export function listEvents(db, jobId, limit = 200) {
  return db.prepare('SELECT * FROM events WHERE job_id = ? ORDER BY id ASC LIMIT ?').all(jobId, limit)
}

export function recordSpend(db, jobId, runId, kind, amount, unit, meta = null) {
  db.prepare(
    `INSERT INTO ledger (job_id, run_id, kind, amount, unit, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(jobId, runId ?? null, kind, Number(amount), unit, meta ? JSON.stringify(meta) : null, now())
}

export function listLedger(db, jobId = null, limit = 500) {
  return jobId
    ? db.prepare('SELECT * FROM ledger WHERE job_id = ? ORDER BY id ASC LIMIT ?').all(jobId, limit)
    : db.prepare('SELECT * FROM ledger ORDER BY id DESC LIMIT ?').all(limit)
}

const KIND_TO_BUDGET = {
  tokens: 'tokens',
  money_cny: 'moneyCny',
  video_minutes: 'videoMinutes',
  wall_clock_min: 'wallClockMin',
}

export function budgetUsed(db, jobId) {
  const rows = db.prepare(
    'SELECT kind, SUM(amount) AS total FROM ledger WHERE job_id = ? GROUP BY kind'
  ).all(jobId)
  const used = { tokens: 0, moneyCny: 0, videoMinutes: 0, wallClockMin: 0 }
  for (const row of rows) {
    const key = KIND_TO_BUDGET[row.kind]
    if (key) used[key] = Number(row.total ?? 0)
  }
  return used
}

export function budgetExceeded(db, job) {
  const used = budgetUsed(db, job.id)
  const budget = job.budget ?? {}
  for (const [key, limit] of Object.entries(budget)) {
    if (limit == null) continue
    if ((used[key] ?? 0) > Number(limit)) {
      return { key, limit: Number(limit), used: used[key] }
    }
  }
  return null
}

export function requestApproval(db, jobId, stage, meta = null) {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO approvals (id, job_id, stage, status, requested_at, meta_json)
     VALUES (?, ?, ?, 'pending', ?, ?)`
  ).run(id, jobId, stage, now(), meta ? JSON.stringify(meta) : null)
  return getApproval(db, id)
}

export function getApproval(db, id) {
  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id)
  return row ? { ...row, meta: parseJson(row.meta_json, null) } : null
}

export function findApproved(db, jobId, stage) {
  return db.prepare(
    `SELECT * FROM approvals WHERE job_id = ? AND stage = ? AND status = 'approved'
     ORDER BY decided_at DESC LIMIT 1`
  ).get(jobId, stage)
}

export function findPendingApproval(db, jobId, stage = null) {
  return stage
    ? db.prepare(
      `SELECT * FROM approvals WHERE job_id = ? AND stage = ? AND status = 'pending'
       ORDER BY requested_at DESC LIMIT 1`
    ).get(jobId, stage)
    : db.prepare(
      `SELECT * FROM approvals WHERE job_id = ? AND status = 'pending'
       ORDER BY requested_at DESC LIMIT 1`
    ).get(jobId)
}

export function decideApproval(db, id, status, decidedBy = 'user') {
  if (!['approved', 'denied'].includes(status)) {
    throw new Error(`invalid approval status: ${status}`)
  }
  db.prepare(
    'UPDATE approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?'
  ).run(status, now(), decidedBy, id)
  return getApproval(db, id)
}

export function getSession(db, chatId) {
  const row = db.prepare('SELECT * FROM sessions WHERE chat_id = ?').get(chatId)
  return row ?? null
}

export function setSession(db, chatId, sessionId) {
  db.prepare(
    `INSERT INTO sessions (chat_id, session_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at`
  ).run(chatId, sessionId, now())
  return getSession(db, chatId)
}

export function listSessions(db, limit = 100) {
  return db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?').all(limit)
}

export function isBiliSeen(db, bvid) {
  return Boolean(db.prepare('SELECT 1 FROM bili_seen WHERE bvid = ?').get(bvid))
}

export function markBiliSeen(db, { bvid, title = null, up = null }) {
  db.prepare(
    'INSERT INTO bili_seen (bvid, title, up, first_seen) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(bvid) DO NOTHING'
  ).run(bvid, title, up, now())
}

export function listBiliSeen(db, limit = 200) {
  return db.prepare('SELECT * FROM bili_seen ORDER BY first_seen DESC LIMIT ?').all(limit)
}

export function clearBiliSeen(db) {
  db.prepare('DELETE FROM bili_seen').run()
}
