// Feishu -> DSH bridge, v1 (prototype).
//
// - Session continuity: maps chat_id -> dsh session id in the control-plane DB.
// - NDJSON events: parses `dsh headless --json`, forwards progress, records usage.
// - Mock mode: `node bridge-v1.mjs --mock "task"` without Feishu credentials.
// - Feishu mode: long connection, allowlist, start/final messages.
//
// This prototype does NOT implement approval cards yet. It runs with
// --approval-policy never and should only be used for read-only tasks.

import * as Lark from '@larksuiteoapi/node-sdk'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { openDb } from '../control-plane/src/db.mjs'
import * as jobs from '../control-plane/src/jobs.mjs'

const DSH_TIMEOUT_MS = Number(process.env.DSH_TIMEOUT_MS ?? 300000)
const DSH_TOKEN_BUDGET = Number(process.env.BUTLER_JOB_TOKEN_BUDGET ?? 200000)
const ALLOWED_OPEN_ID = process.env.FEISHU_ALLOWED_OPEN_ID ?? ''

function loadApiKey() {
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

function resolveDsh() {
  if (process.env.DSH_JS) return { command: process.execPath, args: [process.env.DSH_JS] }
  const globalRoot = process.env.DSH_GLOBAL_ROOT
    ?? join(process.env.APPDATA ?? '', 'npm', 'node_modules')
  const js = join(globalRoot, '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  return { command: process.execPath, args: [js] }
}

function runDsh({ text, sessionId, onEvent }) {
  loadApiKey()
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

async function runTask(db, { chatKey, text, idempotencyKey, onProgress }) {
  const job = jobs.createJob(db, {
    type: 'feishu-task',
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

async function mock(text, chatKey = 'mock-chat') {
  const db = openDb()
  const result = await runTask(db, {
    chatKey,
    text,
    onProgress: (event) => {
      if (event.type === 'status') process.stdout.write(`[status] ${event.phase}\n`)
      if (event.type === 'session') process.stdout.write(`[session] ${event.sessionId}\n`)
    },
  })
  process.stdout.write('\n--- final ---\n')
  process.stdout.write((result.reply ?? '(no text)') + '\n')
  process.stdout.write(`job=${result.job.id} status=${result.job.status} tokens=${result.usage?.totalTokens ?? 0}\n`)
}

async function feishu() {
  const appId = process.env.FEISHU_APP_ID
  const appSecret = process.env.FEISHU_APP_SECRET
  if (!appId || !appSecret) throw new Error('missing FEISHU_APP_ID / FEISHU_APP_SECRET')

  const db = openDb()
  const client = new Lark.Client({ appId, appSecret })
  const wsClient = new Lark.WSClient({ appId, appSecret, loggerLevel: Lark.LoggerLevel.info })
  const seen = new Set()

  async function sendText(chatId, text) {
    await client.im.v1.message.create({
      params: { receive_id_type: 'chat_id' },
      data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text }) },
    })
  }

  const dispatcher = new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      const message = data.message
      const chatId = message.chat_id
      const messageId = message.message_id
      const openId = data.sender?.sender_id?.open_id
      let text = ''
      try { text = JSON.parse(message.content ?? '{}').text ?? '' } catch {}

      if (ALLOWED_OPEN_ID && openId !== ALLOWED_OPEN_ID) {
        console.log(`[skip] sender=${openId}`)
        return
      }
      if (seen.has(messageId)) return
      seen.add(messageId)
      if (message.message_type !== 'text' || !text.trim()) {
        await sendText(chatId, '（目前只认文字消息）')
        return
      }

      await sendText(chatId, '收到，开始处理…')
      try {
        const result = await runTask(db, {
          chatKey: chatId,
          text,
          idempotencyKey: messageId,
          onProgress: () => {},
        })
        await sendText(chatId, result.reply || '(agent 没有输出)')
      } catch (error) {
        await sendText(chatId, `执行失败：${String(error.message).slice(0, 300)}`)
      }
    },
  })

  wsClient.start({ eventDispatcher: dispatcher })
  console.log('bridge-v1 up (Feishu long connection + dsh headless --json)')
}

const args = process.argv.slice(2)
const mockIndex = args.indexOf('--mock')
if (mockIndex >= 0) {
  const text = args[mockIndex + 1] ?? 'Reply with exactly PING and nothing else. Do not call tools.'
  mock(text).catch((error) => { console.error(error); process.exitCode = 1 })
} else {
  feishu().catch((error) => { console.error(error); process.exitCode = 1 })
}
