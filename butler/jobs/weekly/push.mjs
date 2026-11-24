#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, isoWeek } from './fetch/common.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')

function mdToPlain(text) {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s{0,6}#+\s*/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）')
        .replace(/^\s*[-*]\s+/, '· ')
        .replace(/^\s*>\s?/, ''),
    )
    .join('\n')
    .trim()
}

function chunkText(text, size) {
  const chunks = []
  let cur = ''
  for (const line of text.split('\n')) {
    if ((cur + line + '\n').length > size && cur) {
      chunks.push(cur.trimEnd())
      cur = ''
    }
    cur += line + '\n'
  }
  if (cur.trim()) chunks.push(cur.trimEnd())
  return chunks
}

async function pushText(base, token, target, plain) {
  const chunks = chunkText(plain, 2500)
  for (let i = 0; i < chunks.length; i++) {
    const r = await fetch(`${base}/send_private_msg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: target, message: [{ type: 'text', data: { text: chunks[i] } }] }),
    })
    if (!r.ok) throw new Error(`text chunk ${i + 1} HTTP ${r.status}`)
    if (i < chunks.length - 1) await new Promise((res) => setTimeout(res, 800))
  }
  return chunks.length
}

async function pushFile(base, token, target, reportPath) {
  const name = reportPath.split(/[\\/]/).pop()
  const up = await fetch(`${base}/upload_private_file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ user_id: target, file: reportPath, name }),
  })
  if (!up.ok) throw new Error(`upload_private_file HTTP ${up.status}`)
  const upBody = await up.json().catch(() => ({}))
  const fileId = upBody?.data?.file ?? upBody?.data?.file_id ?? upBody?.file
  if (!fileId) throw new Error(`upload response has no file id: ${JSON.stringify(upBody).slice(0, 200)}`)
  const send = await fetch(`${base}/send_private_msg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ user_id: target, message: [{ type: 'file', data: { file: fileId, name } }] }),
  })
  if (!send.ok) throw new Error(`send file message HTTP ${send.status}`)
  return 1
}

async function pushReport(reportPath, config) {
  const push = config.push || {}
  if (push.enabled === false) {
    console.log('[push] disabled, skip')
    return 0
  }
  const base = push.onebotHttp || 'http://127.0.0.1:3000'
  const target = Number(push.targetQq)
  if (!target) throw new Error('push.targetQq missing')
  if (!push.onebotToken) throw new Error('push.onebotToken missing')
  if (!existsSync(reportPath)) throw new Error(`report not found: ${reportPath}`)

  const mode = push.mode || 'file'
  console.log(`[push] ${reportPath} -> QQ ${target}, mode=${mode}`)

  if (mode !== 'text') {
    try {
      await pushFile(base, push.onebotToken, target, reportPath)
      console.log('[push] file sent')
      return 1
    } catch (err) {
      console.error(`[push] file mode failed (${err.message}), falling back to text`)
      if (mode === 'file') throw err
    }
  }

  const plain = mdToPlain(readFileSync(reportPath, 'utf8'))
  const n = await pushText(base, push.onebotToken, target, plain)
  console.log(`[push] done, ${n} text chunk(s)`)
  return n
}

const direct = process.argv[1] && process.argv[1].endsWith('push.mjs')
if (direct) {
  const config = loadConfig()
  const report = process.argv[2] ?? join(root, 'reports', 'weekly', `${isoWeek()}.md`)
  pushReport(report, config)
    .then((n) => console.log(`[push] done, ${n} chunk(s)`))
    .catch((err) => {
      console.error('[push] FAILED:', err.message)
      process.exitCode = 1
    })
}

export { pushReport }
