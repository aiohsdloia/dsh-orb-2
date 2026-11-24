import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { openDb } from '../src/db.mjs'
import * as jobs from '../src/jobs.mjs'
import { runJob } from '../src/runner.mjs'

const dbPath = fileURLToPath(new URL(`../data/test-${process.pid}.db`, import.meta.url))
const db = openDb(dbPath)

try {
  // 1. happy path
  jobs.createJob(db, {
    id: 'done-1',
    type: 'mock',
    spec: { stages: ['collect', 'process', 'publish'] },
    budget: { tokens: 1000 },
  })
  const done = await runJob(db, 'done-1')
  assert.equal(done.job.status, 'done')
  assert.equal(done.job.checkpoint, 'publish')
  assert.equal(jobs.budgetUsed(db, 'done-1').tokens, 300)
  assert.ok(jobs.listEvents(db, 'done-1').some((e) => e.type === 'run.done'))
  console.log('ok 1: happy path')

  // 2. idempotency
  jobs.createJob(db, { id: 'idem-1', idempotencyKey: 'same-key' })
  const again = jobs.createJob(db, { id: 'idem-2', idempotencyKey: 'same-key' })
  assert.equal(again.id, 'idem-1')
  console.log('ok 2: idempotency')

  // 3. budget hard stop
  jobs.createJob(db, {
    id: 'budget-1',
    type: 'mock',
    spec: { stages: ['collect'] },
    budget: { tokens: 0 },
  })
  const over = await runJob(db, 'budget-1')
  assert.equal(over.job.status, 'failed')
  assert.match(over.error, /BUDGET_EXCEEDED/)
  console.log('ok 3: budget hard stop')

  // 4. approval gate
  jobs.createJob(db, {
    id: 'approval-1',
    type: 'mock',
    spec: { stages: ['collect', 'process', 'publish'], requireApprovalAt: 'publish' },
    budget: { tokens: 1000 },
  })
  const waiting = await runJob(db, 'approval-1')
  assert.equal(waiting.job.status, 'waiting_approval')
  const pending = jobs.findPendingApproval(db, 'approval-1', 'publish')
  assert.ok(pending)
  jobs.decideApproval(db, pending.id, 'approved', 'test')
  const approved = await runJob(db, 'approval-1')
  assert.equal(approved.job.status, 'done')
  console.log('ok 4: approval gate')

  // 5. resume from checkpoint after failure
  jobs.createJob(db, {
    id: 'resume-1',
    type: 'mock',
    spec: { stages: ['collect', 'process', 'publish'], failAt: 'process' },
    budget: { tokens: 1000 },
  })
  const failed = await runJob(db, 'resume-1')
  assert.equal(failed.job.status, 'failed')
  assert.equal(failed.job.checkpoint, 'collect')
  db.prepare('UPDATE jobs SET spec_json = ? WHERE id = ?')
    .run(JSON.stringify({ stages: ['collect', 'process', 'publish'] }), 'resume-1')
  const resumed = await runJob(db, 'resume-1')
  assert.equal(resumed.job.status, 'done')
  assert.equal(resumed.job.checkpoint, 'publish')
  console.log('ok 5: resume from checkpoint')

  console.log('PASS control-plane smoke')
} finally {
  db.close()
  for (const suffix of ['', '-wal', '-shm']) {
    try { rmSync(dbPath + suffix) } catch {}
  }
}
