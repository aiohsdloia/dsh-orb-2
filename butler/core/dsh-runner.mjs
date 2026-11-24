// Shared DSH task runner for adapters (QQ / Feishu / local).
// Uses `dsh headless --json`, keeps session continuity in the control-plane DB,
// and records tokens / wall-clock into the ledger.

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import * as jobs from '../control-plane/src/jobs.mjs'

const DSH_TIMEOUT_MS = Number(process.env.DSH_TIMEOUT_MS ?? 600000)
const DSH_TOKEN_BUDGET = Number(process.env.BUTLER_JOB_TOKEN_BUDGET ?? 200000)
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const localRuntime = join(projectRoot, 'butler', 'data', 'dsh-0.2.2-rc.4')
const localDshHome = join(localRuntime, 'home')

export function loadApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return
  const authPath = process.env.OPENLAB_AUTH_JSON
    ?? join(process.env.APPDATA ?? '', 'com.sculab.openlab', 'runtime', 'xdg-data', 'opencode', 'auth.json')
  try {
    const data = JSON.parse(readFileSync(authPath, 'utf8'))
    const key = data?.deepseek?.key
    if (key) {
      process.env.DEEPSEEK_API_KEY = key
      return
    }
  } catch {}
  throw new Error('DEEPSEEK_API_KEY is missing; export it or set OPENLAB_AUTH_JSON')
}

export function resolveDsh() {
  if (process.env.DSH_JS) return { command: process.execPath, args: [process.env.DSH_JS] }
  const local = join(localRuntime, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (existsSync(local)) return { command: process.execPath, args: [local] }
  const globalRoot = process.env.DSH_GLOBAL_ROOT
    ?? join(process.env.APPDATA ?? '', 'npm', 'node_modules')
  const js = join(globalRoot, '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  return { command: process.execPath, args: [js] }
}

export function runDsh({ text, sessionId, onEvent }) {
  loadApiKey()
  if (!process.env.DSH_HOME && existsSync(localDshHome)) {
    process.env.DSH_HOME = localDshHome
  }
  const dsh = resolveDsh()
  const args = [
    ...dsh.args,
    'headless',
    '--json',
    '--approval-policy', 'never',
    ...(sessionId ? ['--session-id', sessionId] : []),
    text,
  ]

  return new Promise((resolve, reject) => {
    const child = spawn(dsh.command, args, { env: process.env, windowsHide: true })
    const events = []
    let final = null
    let resolvedSession = sessionId ?? null
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    let stderr = ''
    let textOut = ''
    let settled = false

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }

    const timer = setTimeout(() => {
      try { child.kill() } catch {}
      finish(reject, new Error(`dsh timeout after ${DSH_TIMEOUT_MS}ms`))
    }, DSH_TIMEOUT_MS)

    createInterface({ input: child.stdout }).on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let event
      try { event = JSON.parse(trimmed) } catch { return }
      events.push(event)
      if (event.type === 'session' && event.sessionId) resolvedSession = event.sessionId
      if (event.type === 'status' && event.phase === 'step_end' && event.usage) {
        usage.inputTokens += Number(event.usage.inputTokens ?? 0)
        usage.outputTokens += Number(event.usage.outputTokens ?? 0)
        usage.totalTokens += Number(event.usage.totalTokens ?? 0)
      }
      if (event.type === 'text' && event.text) textOut += event.text
      if (event.type === 'final') {
        final = event
        if (event.sessionId) resolvedSession = event.sessionId
      }
      if (onEvent) {
        try { onEvent(event) } catch {}
      }
    })

    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-4000)
    })

    child.on('error', (error) => finish(reject, error))
    child.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`dsh exited ${code}: ${stderr.slice(-600)}`))
        return
      }
      finish(resolve, {
        sessionId: resolvedSession,
        events,
        usage,
        text: final?.text ?? textOut,
        reason: final?.reason ?? null,
        stderr,
      })
    })
  })
}

export async function runTask(db, { chatKey, text, idempotencyKey, onProgress, type = 'channel-task' }) {
  const job = jobs.createJob(db, {
    type,
    spec: { text },
    budget: { tokens: DSH_TOKEN_BUDGET },
    idempotencyKey,
  })
  if (job.status === 'done') return { job, reply: '(already completed)' }

  const started = Date.now()
  jobs.setStatus(db, job.id, 'running')
  const runId = jobs.startRun(db, job.id)
  jobs.recordEvent(db, job.id, runId, 'task.received', text.slice(0, 200))

  const stored = jobs.getSession(db, chatKey)
  let sessionId = stored?.session_id ?? null

  const attempt = async (useSession) => runDsh({
    text,
    sessionId: useSession,
    onEvent: (event) => {
      if (event.type === 'session' && event.sessionId) {
        jobs.setSession(db, chatKey, event.sessionId)
      }
      if (onProgress) onProgress(event)
    },
  })

  try {
    let result
    try {
      result = await attempt(sessionId)
    } catch (error) {
      const unknownSession = sessionId && /unknown|not found|no such/i.test(String(error.message))
      if (!unknownSession) throw error
      jobs.recordEvent(db, job.id, runId, 'session.reset', sessionId)
      jobs.setSession(db, chatKey, '')
      sessionId = null
      result = await attempt(null)
    }

    if (result.sessionId) jobs.setSession(db, chatKey, result.sessionId)
    if (result.usage.totalTokens) {
      jobs.recordSpend(db, job.id, runId, 'tokens', result.usage.totalTokens, 'tokens', result.usage)
    }
    jobs.recordSpend(db, job.id, runId, 'wall_clock_min', (Date.now() - started) / 60000, 'minutes')

    const ok = result.reason?.kind === 'completed' || result.reason == null
    jobs.setStatus(db, job.id, ok ? 'done' : 'failed', { error: ok ? null : JSON.stringify(result.reason) })
    jobs.finishRun(db, runId, ok ? 'done' : 'failed', ok ? null : JSON.stringify(result.reason))
    jobs.recordEvent(db, job.id, runId, 'task.finished', `tokens=${result.usage.totalTokens}`)
    return { job: jobs.getJob(db, job.id), reply: result.text, sessionId: result.sessionId, usage: result.usage }
  } catch (error) {
    jobs.setStatus(db, job.id, 'failed', { error: String(error.message) })
    jobs.finishRun(db, runId, 'failed', String(error.message))
    jobs.recordEvent(db, job.id, runId, 'task.failed', String(error.message).slice(0, 500))
    throw error
  }
}
