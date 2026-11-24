import * as jobs from './jobs.mjs'

export class BudgetError extends Error {
  constructor(detail) {
    super(`BUDGET_EXCEEDED: ${detail.key} used ${detail.used} > limit ${detail.limit}`)
    this.name = 'BudgetError'
    this.detail = detail
  }
}

const handlers = new Map()

export function registerHandler(type, fn) {
  handlers.set(type, fn)
}

registerHandler('mock', async ({ db, job, runId, stage, jobs: j }) => {
  const spec = job.spec ?? {}
  if (spec.failAt === stage) throw new Error(`simulated failure at ${stage}`)
  const tokens = spec.tokensPerStage?.[stage] ?? 100
  j.recordSpend(db, job.id, runId, 'tokens', tokens, 'tokens', { stage })
  await new Promise((resolve) => setTimeout(resolve, 10))
})

export async function runJob(db, jobId, { handler } = {}) {
  let job = jobs.getJob(db, jobId)
  if (!job) throw new Error(`job not found: ${jobId}`)
  if (job.status === 'done') return { job }

  const claimed = jobs.claimJob(db, jobId)
  if (!claimed) return { job: jobs.getJob(db, jobId) }
  job = claimed

  const spec = job.spec ?? {}
  const stages = spec.stages ?? ['collect', 'process', 'publish']
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new Error('spec.stages must be a non-empty array')
  }

  const startIndex = job.checkpoint ? stages.indexOf(job.checkpoint) + 1 : 0
  const runId = jobs.startRun(db, jobId)
  jobs.recordEvent(db, jobId, runId, 'run.start', `stages=${stages.join(',')}`)

  try {
    for (let index = startIndex; index < stages.length; index += 1) {
      const stage = stages[index]

      const over = jobs.budgetExceeded(db, jobs.getJob(db, jobId))
      if (over) throw new BudgetError(over)

      if (spec.requireApprovalAt === stage) {
        const approved = jobs.findApproved(db, jobId, stage)
        if (!approved) {
          const approval = jobs.requestApproval(db, jobId, stage)
          jobs.setStatus(db, jobId, 'waiting_approval')
          jobs.finishRun(db, runId, 'waiting_approval')
          jobs.recordEvent(db, jobId, runId, 'approval.requested', stage)
          return { job: jobs.getJob(db, jobId), approval }
        }
      }

      jobs.recordEvent(db, jobId, runId, 'stage.start', stage)
      const fn = handler ?? handlers.get(job.type)
      if (!fn) throw new Error(`no handler for type: ${job.type}`)
      await fn({ db, job: jobs.getJob(db, jobId), runId, stage, jobs })

      jobs.setCheckpoint(db, jobId, stage)
      jobs.recordEvent(db, jobId, runId, 'stage.done', stage)

      const after = jobs.budgetExceeded(db, jobs.getJob(db, jobId))
      if (after) throw new BudgetError(after)
    }

    jobs.setStatus(db, jobId, 'done')
    jobs.finishRun(db, runId, 'done')
    jobs.recordEvent(db, jobId, runId, 'run.done')
    return { job: jobs.getJob(db, jobId) }
  } catch (error) {
    const status = 'failed'
    jobs.setStatus(db, jobId, status, { error: error.message })
    jobs.finishRun(db, runId, status, error.message)
    jobs.recordEvent(db, jobId, runId, 'run.failed', error.message)
    return { job: jobs.getJob(db, jobId), error: error.message }
  }
}
