#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDsh } from '../../core/dsh-runner.mjs'
import { loadConfig, isoWeek, sinceDate } from './fetch/common.mjs'
import { ranking, searchVideos } from '../bili-brief/bili.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const week = isoWeek()
const dataDir = join(root, 'butler', 'data', 'weekly', week)
const rawDir = join(dataDir, 'raw')
const reportDir = join(root, 'reports', 'weekly')
const config = loadConfig()

function runFetchers() {
  const fetchers = ['arxiv', 'pubmed', 'rss', 'github']
  const status = {}
  for (const name of fetchers) {
    if (process.env.SKIP_FETCH === '1' && existsSync(join(rawDir, `${name}.json`))) {
      status[name] = 'cached'
      console.log(`[fetcher ${name}] cached`)
      continue
    }
    const file = join(here, 'fetch', `${name}-fetch.mjs`)
    const r = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 180000 })
    status[name] = r.status === 0 ? 'ok' : `fail(${r.status})`
    console.log(`[fetcher ${name}] ${status[name]}`)
  }
  return status
}

async function fetchBili(section) {
  let interests = { topics: [], limits: {} }
  const interestsPath = join(root, 'butler', 'config', 'interests.json')
  if (existsSync(interestsPath)) {
    try {
      interests = JSON.parse(readFileSync(interestsPath, 'utf8').replace(/^\uFEFF/, ''))
    } catch {}
  }
  const topics = (interests.topics || []).slice(0, 4)
  const seen = new Set()
  const items = []
  const cutoff = sinceDate(section.days ?? 7)
  for (const topic of topics) {
    let found = []
    try {
      found = await searchVideos(topic, { limit: 12 })
    } catch (err) {
      console.error(`[bili] search "${topic}" failed: ${err.message}`)
      continue
    }
    for (const v of found) {
      if (seen.has(v.bvid)) continue
      if (v.pubdate && new Date(v.pubdate) < cutoff) continue
      seen.add(v.bvid)
      items.push(v)
    }
  }
  if (interests.ranking?.enabled) {
    try {
      for (const v of await ranking({ limit: 10 })) {
        if (!seen.has(v.bvid)) {
          seen.add(v.bvid)
          items.push(v)
        }
      }
    } catch (err) {
      console.error(`[bili] ranking failed: ${err.message}`)
    }
  }
  items.sort((a, b) => (b.play ?? 0) - (a.play ?? 0))
  const top = items.slice(0, section.max ?? 15)
  mkdirSync(rawDir, { recursive: true })
  writeFileSync(join(rawDir, 'bili.json'), JSON.stringify(top, null, 2), 'utf8')
  console.log(`[bili] ${top.length} items`)
  return top
}

function readRaw(name) {
  const p = join(rawDir, `${name}.json`)
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return []
  }
}

function compact(items, maxChars) {
  return items.slice(0, maxChars === undefined ? items.length : Math.min(items.length, 40))
}

function buildSourceBlock(name, items) {
  const lines = []
  if (name === 'arxiv' || name === 'pubmed') {
    for (const it of compact(items, 15)) {
      lines.push(`- ${it.title}${it.journal ? ` (${it.journal})` : ''} | ${it.date || it.published || ''} | ${(it.summary || '').slice(0, 140)} | ${it.url}`)
    }
  } else if (name === 'rss') {
    for (const it of compact(items, 15)) {
      lines.push(`- ${it.title} | ${it.feed} | ${it.date} | ${(it.summary || '').slice(0, 140)} | ${it.url}`)
    }
  } else if (name === 'github') {
    for (const it of compact(items, 20)) {
      lines.push(`- ${it.name} (★${it.stars ?? '?'}, ${it.language ?? '?'}) ${it.url} | ${(it.description || '').slice(0, 140)}`)
    }
  } else if (name === 'bili') {
    for (const it of compact(items, 15)) {
      lines.push(`- ${it.title} | UP:${it.up} | 播放:${it.play ?? '?'} | ${(it.description || '').slice(0, 120)} | ${it.url}`)
    }
  }
  return lines
}

async function main() {
  console.log(`[weekly] ${week} start`)
  const status = runFetchers()
  const bili = config.bili?.enabled === false ? [] : await fetchBili(config.bili || {})

  const arxiv = readRaw('arxiv')
  const pubmed = readRaw('pubmed')
  const rss = readRaw('rss')
  const github = readRaw('github')
  const counts = { arxiv: arxiv.length, pubmed: pubmed.length, rss: rss.length, github: github.length, bili: bili.length }

  const prompt = [
    `你是我的个人研究员。下面是本周（${week}）主动抓取的五类信息：arXiv 论文、PubMed 论文、期刊 RSS 新闻、GitHub 新热仓库、B站 视频。`,
    `请直接输出一份中文 Markdown 周报（不要任何开场白），结构如下：`,
    `# ${week} 周报`,
    `## 一、arXiv 论文精选（${arxiv.length} 篇，挑 5-8 篇最重要的，每篇：一句话贡献点评 + 链接）`,
    `## 二、PubMed 研究精选（${pubmed.length} 篇，挑 3-5 篇，一句话说明）`,
    `## 三、学术/科学新闻（RSS，挑 3-5 条，一句话点评）`,
    `## 四、GitHub 趋势（${github.length} 个，挑 8-10 个，说明是什么、为何值得关注）`,
    `## 五、B站 值得看（${bili.length} 个，挑 5-8 个，一句话推荐理由）`,
    `## 六、本周一句话总结`,
    ``,
    `素材：`,
    `【arXiv】`,
    ...buildSourceBlock('arxiv', arxiv),
    `【PubMed】`,
    ...buildSourceBlock('pubmed', pubmed),
    `【RSS】`,
    ...buildSourceBlock('rss', rss),
    `【GitHub】`,
    ...buildSourceBlock('github', github),
    `【B站】`,
    ...buildSourceBlock('bili', bili),
  ].join('\n')

  console.log(`[weekly] synthesis prompt ${prompt.length} chars, calling DSH headless ...`)
  const result = await runDsh({ text: prompt })
  console.log(`[weekly] synthesis done, tokens=${result.usage?.totalTokens ?? '?'}`)

  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(reportDir, `${week}.md`)  const header = [
    `# ${week} 周报`,
    ``,
    `> 生成时间：${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 数据源：arXiv ${counts.arxiv} / PubMed ${counts.pubmed} / RSS ${counts.rss} / GitHub ${counts.github} / B站 ${counts.bili}`,
    `> fetcher 状态：${Object.entries(status).map(([k, v]) => `${k}=${v}`).join(' ')}`,
    ``,
    `---`,
    ``,
  ].join('\n')
  const body = (result.text || '(empty response)').replace(/^#\s*\S+-W\d+\s*周报\s*\n/, '')
  const finalText = header + body + '\n'
  writeFileSync(reportPath, finalText, 'utf8')
  console.log(`[weekly] report -> ${reportPath}`)

  if (config.push?.enabled !== false) {
    try {
      const { pushReport } = await import('./push.mjs')
      await pushReport(reportPath, config)
    } catch (err) {
      console.error(`[weekly] push failed (report kept): ${err.message}`)
    }
  }
}

main().catch((err) => {
  console.error('[weekly] FAILED:', err)
  process.exitCode = 1
})
