#!/usr/bin/env node
// Bilibili brief v1: discover -> filter -> dedupe -> markdown brief.
// No transcripts/ASR in this version.

import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from '../../control-plane/src/db.mjs'
import * as jobs from '../../control-plane/src/jobs.mjs'
import { runJob } from '../../control-plane/src/runner.mjs'
import { ranking, searchVideos } from './bili.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../../..')

const { values } = parseArgs({
  options: {
    config: { type: 'string', default: join(projectRoot, 'butler/config/interests.json') },
    out: { type: 'string' },
    db: { type: 'string' },
    reset: { type: 'boolean', default: false },
    'no-ranking': { type: 'boolean', default: false },
    limit: { type: 'string' },
    cookie: { type: 'string' },
    'content-top': { type: 'string' },
    'content-bvid': { type: 'string' },
    'content-minutes': { type: 'string' },
    'asr-model': { type: 'string' },
  },
})

const cookie = values.cookie ?? process.env.BILI_COOKIE ?? null
const configPath = isAbsolute(values.config) ? values.config : resolve(process.cwd(), values.config)
let config
try {
  const raw = readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')
  config = JSON.parse(raw)
} catch (error) {
  console.error(`cannot read config ${configPath}: ${error.message}`)
  console.error(`copy butler/config/interests.example.json to ${configPath} and edit it`)
  process.exit(1)
}

const limits = {
  perTopic: 8,
  perUp: 8,
  ranking: 10,
  total: 25,
  minDurationSec: 0,
  maxDurationSec: 8 * 3600,
  sinceDays: 30,
  minPlay: 0,
  minLike: 0,
  ...(config.limits ?? {}),
}
if (values.limit) limits.total = Number(values.limit)
const rankingEnabled = !values['no-ranking'] && (config.ranking?.enabled ?? true)
const contentTop = Number(values['content-top'] ?? 0) || 0
const contentBvid = values['content-bvid'] ?? null
const contentDir = resolve(projectRoot, 'reports/bili/content')
const contentMinutes = Number(values['content-minutes'] ?? 5)
const asrModel = values['asr-model'] ?? 'base'

const date = new Date().toISOString().slice(0, 10)
const outPath = isAbsolute(values.out ?? '')
  ? values.out
  : resolve(projectRoot, values.out ?? `reports/bili/${date}-brief.md`)

const db = openDb(values.db)
if (values.reset) jobs.clearBiliSeen(db)

const job = jobs.createJob(db, {
  type: 'bili-brief',
  spec: {
    stages: ['discover', 'filter', 'dedupe', ...(contentTop > 0 || contentBvid ? ['content'] : []), 'brief'],
    configPath,
    outPath,
    sinceDays: limits.sinceDays,
  },
  budget: { tokens: 0 },
})

const state = {
  items: [],
  filtered: [],
  selected: [],
  errors: [],
  groups: new Map(),
  contentLinks: new Map(),
}

function isBlocked(item) {
  const text = `${item.title} ${item.description}`.toLowerCase()
  return (config.blacklist ?? []).some((word) => text.includes(String(word).toLowerCase()))
}

function withinSince(item) {
  if (!limits.sinceDays || !item.pubdate) return true
  const age = Date.now() - Date.parse(item.pubdate)
  return age <= limits.sinceDays * 86400_000
}

function withinDuration(item) {
  if (item.duration == null) return true
  return item.duration >= limits.minDurationSec && item.duration <= limits.maxDurationSec
}

function withinQuality(item) {
  if ((Number(item.play ?? 0)) < limits.minPlay) return false
  if ((Number(item.like ?? 0)) < limits.minLike) return false
  return true
}

function addGroup(name, item) {
  const list = state.groups.get(name) ?? []
  list.push(item)
  state.groups.set(name, list)
}

function formatDuration(seconds) {
  if (seconds == null) return '?'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function formatCount(value) {
  if (value == null) return '?'
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}

async function discover() {
  const seen = new Map()

  for (const topic of config.topics ?? []) {
    try {
      const results = await searchVideos(topic, { limit: limits.perTopic, cookie })
      for (const item of results) {
        if (!item?.bvid || seen.has(item.bvid)) continue
        item.reason = `topic:${topic}`
        seen.set(item.bvid, item)
        state.items.push(item)
        addGroup(`兴趣：${topic}`, item)
      }
    } catch (error) {
      state.errors.push(`topic ${topic}: ${error.message}`)
    }
  }

  for (const up of config.ups ?? []) {
    try {
      const results = await searchVideos(up.name, { limit: limits.perUp, cookie })
      const matched = results.filter((item) => {
        if (up.mid != null) return String(item.mid) === String(up.mid)
        return item.up && item.up.includes(up.name)
      })
      for (const item of matched) {
        if (!item?.bvid || seen.has(item.bvid)) continue
        item.reason = `up:${up.name}`
        seen.set(item.bvid, item)
        state.items.push(item)
        addGroup(`UP：${up.name}`, item)
      }
    } catch (error) {
      state.errors.push(`up ${up.name}: ${error.message}`)
    }
  }

  if (rankingEnabled) {
    try {
      const results = await ranking({ limit: limits.ranking })
      for (const item of results) {
        if (!item?.bvid || seen.has(item.bvid)) continue
        item.reason = 'ranking'
        seen.set(item.bvid, item)
        state.items.push(item)
        addGroup('排行榜发现', item)
      }
    } catch (error) {
      state.errors.push(`ranking: ${error.message}`)
    }
  }

  if (state.items.length === 0) {
    throw new Error(`no items discovered; errors: ${state.errors.join(' | ')}`)
  }
}

function filterItems() {
  state.filtered = state.items.filter((item) => {
    if (!withinSince(item)) return false
    if (!withinDuration(item)) return false
    if (!withinQuality(item)) return false
    if (isBlocked(item)) return false
    return true
  })
}

function dedupeItems() {
  state.selected = state.filtered.filter((item) => !jobs.isBiliSeen(db, item.bvid))
}

function groupName(item) {
  if (item.reason?.startsWith('topic:')) return `兴趣：${item.reason.slice('topic:'.length)}`
  if (item.reason?.startsWith('up:')) return `UP：${item.reason.slice('up:'.length)}`
  return '排行榜发现'
}

function writeBrief() {
  const selected = state.selected.slice(0, limits.total)
  const byGroup = new Map()
  for (const item of selected) {
    const key = groupName(item)
    const list = byGroup.get(key) ?? []
    list.push(item)
    byGroup.set(key, list)
  }

  const lines = []
  lines.push(`# B 站简报 ${date}`, '')
  lines.push(`生成时间：${new Date().toISOString()}`)
  lines.push(`来源：关注 UP ${config.ups?.length ?? 0} 个 · 兴趣主题 ${config.topics?.length ?? 0} 个 · 排行榜 ${rankingEnabled ? '开启' : '关闭'}`)
  lines.push(`筛选：最近 ${limits.sinceDays} 天 · ${limits.minDurationSec}–${limits.maxDurationSec} 秒 · 黑名单 ${config.blacklist?.length ?? 0} 项`)
  lines.push('说明：默认只做发现/筛选/去重；内容速览只对指定的 Top N 做 ASR + 摘要。', '')

  for (const [group, items] of byGroup) {
    lines.push(`## ${group}`, '')
    const sorted = items.sort((a, b) => (b.pubdate ?? '').localeCompare(a.pubdate ?? ''))
    for (const item of sorted) {
      const day = item.pubdate ? item.pubdate.slice(0, 10) : '?'
      lines.push(`- [${item.title}](${item.url}) — ${item.up ?? '?'} · ${day} · ${formatDuration(item.duration)} · 播放 ${formatCount(item.play)} · 点赞 ${formatCount(item.like)}`)
    }
    lines.push('')
  }

  if (state.contentLinks.size) {
    lines.push('## 内容速览（已看内容）', '')
    for (const [bvid, relPath] of state.contentLinks) {
      const item = state.selected.find((x) => x.bvid === bvid)
      const link = relative(dirname(outPath), resolve(projectRoot, relPath)).replace(/\\/g, '/')
      lines.push(`- [${item?.title ?? bvid}](${link}) — 已做 ASR + 摘要`)
    }
    lines.push('')
  }

  if (state.errors.length) {
    lines.push('## 抓取异常', '')
    for (const error of state.errors) lines.push(`- ${error}`)
    lines.push('')
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, lines.join('\n'), 'utf8')

  for (const item of selected) {
    jobs.markBiliSeen(db, { bvid: item.bvid, title: item.title, up: item.up })
  }

  return selected.length
}

async function handler(ctx) {
  const { stage, runId } = ctx
  if (stage === 'discover') {
    await discover()
    jobs.recordEvent(db, job.id, runId, 'discover', `items=${state.items.length} errors=${state.errors.length}`)
  } else if (stage === 'filter') {
    filterItems()
    jobs.recordEvent(db, job.id, runId, 'filter', `kept=${state.filtered.length}/${state.items.length}`)
  } else if (stage === 'dedupe') {
    dedupeItems()
    jobs.recordEvent(db, job.id, runId, 'dedupe', `new=${state.selected.length}/${state.filtered.length}`)
  } else if (stage === 'content') {
    let items = contentBvid
      ? state.selected.filter((item) => item.bvid === contentBvid)
      : state.selected.slice(0, contentTop)
    if (contentBvid && items.length === 0) {
      items = [{ bvid: contentBvid, title: contentBvid, url: `https://www.bilibili.com/video/${contentBvid}`, part: 1 }]
    }
    if (items.length === 0) {
      jobs.recordEvent(db, job.id, runId, 'content', 'no items')
    } else {
      const itemsPath = resolve(projectRoot, 'butler/data/bili', `content-items-${job.id}.json`)
      mkdirSync(dirname(itemsPath), { recursive: true })
      writeFileSync(itemsPath, JSON.stringify(items.map(({ bvid, title, url }) => ({ bvid, title, url, part: 1 })), null, 2), 'utf8')
      const py = join(here, 'content_pass.py')
      const result = spawnSync(process.env.PYTHON ?? 'python', [
        py,
        '--items', itemsPath,
        '--out-dir', contentDir,
        '--max-minutes', String(contentMinutes),
        '--model', asrModel,
      ], { encoding: 'utf8', timeout: 30 * 60 * 1000 })
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
      if (result.error) state.errors.push(`content: ${result.error.message}`)
      if (result.status !== 0) state.errors.push(`content: exit ${result.status}`)
      try {
        const manifest = JSON.parse(readFileSync(join(contentDir, 'manifest.json'), 'utf8'))
        for (const [bvid, path] of Object.entries(manifest.items ?? {})) {
          if (path) state.contentLinks.set(bvid, path)
        }
      } catch (error) {
        state.errors.push(`content manifest: ${error.message}`)
      }
      jobs.recordEvent(db, job.id, runId, 'content', `items=${items.length} linked=${state.contentLinks.size}`)
    }
  } else if (stage === 'brief') {
    const count = writeBrief()
    jobs.recordEvent(db, job.id, runId, 'brief', `out=${outPath} items=${count}`)
  }
}

const result = await runJob(db, job.id, { handler })
console.log(JSON.stringify({
  ok: result.job?.status === 'done',
  job: result.job?.status,
  out: outPath,
  discovered: state.items.length,
  filtered: state.filtered.length,
  selected: state.selected.length,
  errors: state.errors,
  error: result.error ?? null,
}, null, 2))
