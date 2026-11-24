#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { openDb } from './db.mjs'
import * as jobs from './jobs.mjs'
import { runJob } from './runner.mjs'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    type: { type: 'string', default: 'mock' },
    id: { type: 'string' },
    'idempotency-key': { type: 'string' },
    stages: { type: 'string', default: 'collect,process,publish' },
    'require-approval': { type: 'string' },
    'fail-at': { type: 'string' },
    'tokens-per-stage': { type: 'string' },
    'budget-tokens': { type: 'string' },
    'budget-money': { type: 'string' },
    'budget-video': { type: 'string' },
    'budget-wall': { type: 'string' },
    status: { type: 'string' },
    stage: { type: 'string' },
    by: { type: 'string', default: 'user' },
    limit: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
})

const db = openDb()

function out(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n')
}

function fail(message) {
  process.stderr.write(JSON.stringify({ ok: false, error: message }, null, 2) + '\n')
  process.exitCode = 1
}

function toNumber(value) {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function buildSpec() {
  const spec = {
    stages: String(values.stages).split(',').map((s) => s.trim()).filter(Boolean),
  }
  if (values['require-approval']) spec.requireApprovalAt = values['require-approval']
  if (values['fail-at']) spec.failAt = values['fail-at']
  if (values['tokens-per-stage']) {
    try { spec.tokensPerStage = JSON.parse(values['tokens-per-stage']) }
    catch { throw new Error('--tokens-per-stage must be JSON, e.g. {"collect":100}') }
  }
  return spec
}

function buildBudget() {
  return {
    tokens: toNumber(values['budget-tokens']),
    moneyCny: toNumber(values['budget-money']),
    videoMinutes: toNumber(values['budget-video']),
    wallClockMin: toNumber(values['budget-wall']),
  }
}

async function main() {
  const [command, action, id] = positionals

  if (command === 'init') {
    out({ ok: true, db: process.env.BUTLER_DB ?? 'default' })
    return
  }

  if (command === 'job') {
    if (action === 'create') {
      const job = jobs.createJob(db, {
        id: values.id,
        type: values.type,
        spec: buildSpec(),
        budget: buildBudget(),
        idempotencyKey: values['idempotency-key'],
      })
      out({ ok: true, job })
      return
    }
    if (action === 'list') {
      out({ ok: true, jobs: jobs.listJobs(db, { status: values.status, limit: toNumber(values.limit) ?? 50 }) })
      return
    }
    if (action === 'status') {
      if (!id) throw new Error('usage: job status <jobId>')
      const job = jobs.getJob(db, id)
      if (!job) throw new Error(`job not found: ${id}`)
      out({
        ok: true,
        job,
        budgetUsed: jobs.budgetUsed(db, id),
        events: jobs.listEvents(db, id),
        ledger: jobs.listLedger(db, id),
        approvals: db.prepare('SELECT * FROM approvals WHERE job_id = ? ORDER BY requested_at').all(id),
      })
      return
    }
    if (action === 'run') {
      if (!id) throw new Error('usage: job run <jobId>')
      const result = await runJob(db, id)
      out({ ok: !result.error, ...result })
      return
    }
    if (action === 'approve') {
      if (!id) throw new Error('usage: job approve <jobId> --stage <stage>')
      const pending = jobs.findPendingApproval(db, id, values.stage ?? null)
      if (!pending) throw new Error('no pending approval for this job/stage')
      const approval = jobs.decideApproval(db, pending.id, 'approved', values.by)
      out({ ok: true, approval })
      return
    }
    if (action === 'deny') {
      if (!id) throw new Error('usage: job deny <jobId> --stage <stage>')
      const pending = jobs.findPendingApproval(db, id, values.stage ?? null)
      if (!pending) throw new Error('no pending approval for this job/stage')
      const approval = jobs.decideApproval(db, pending.id, 'denied', values.by)
      out({ ok: true, approval })
      return
    }
    throw new Error(`unknown job action: ${action}`)
  }

  if (command === 'ledger') {
    out({ ok: true, ledger: jobs.listLedger(db, action ?? null) })
    return
  }

  if (command === 'events') {
    if (!action) throw new Error('usage: events <jobId>')
    out({ ok: true, events: jobs.listEvents(db, action) })
    return
  }

  if (command === 'sessions') {
    if (action) {
      out({ ok: true, session: jobs.getSession(db, action) })
    } else {
      out({ ok: true, sessions: jobs.listSessions(db) })
    }
    return
  }

  out({
    ok: true,
    usage: [
      'init',
      'job create --type mock --id <id> --stages a,b,c --budget-tokens 1000 [--require-approval c] [--fail-at b]',
      'job list [--status queued]',
      'job status <id>',
      'job run <id>',
      'job approve <id> --stage <stage> [--by user]',
      'job deny <id> --stage <stage>',
      'ledger [jobId]',
      'events <jobId>',
      'sessions [chatId]',
    ],
  })
}

main().catch((error) => fail(error.message))
