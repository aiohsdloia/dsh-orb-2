#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDsh } from '../../core/dsh-runner.mjs'
import { isoWeek } from '../weekly/fetch/common.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const week = isoWeek()
const rawDir = join(root, 'butler', 'data', 'weekly', week, 'raw')

function runFetchers() {
  const jobs = [
    ['skills-github', join(here, 'fetch', 'github-skills.mjs')],
    ['skills-bili', join(here, 'fetch', 'bili-skills.mjs')],
  ]
  const status = {}
  for (const [name, file] of jobs) {
    const r = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 240000 })
    status[name] = r.status === 0 ? 'ok' : `fail(${r.status})`
    console.log(`[skill-scout ${name}] ${status[name]}`)
  }
  return status
}

function readRaw(name) {
  try {
    return JSON.parse(readFileSync(join(rawDir, `${name}.json`), 'utf8'))
  } catch {
    return []
  }
}

async function main() {
  console.log(`[skill-scout] ${week} start`)
  const status = runFetchers()
  const github = readRaw('skills-github')
  const bili = readRaw('skills-bili')

  const ghLines = github.map((r) => `- ${r.name} (★${r.stars ?? '?'}, ${r.language ?? '?'}) ${r.url} | ${(r.description || '').slice(0, 180)}`)
  const biLines = bili.map((v) => `- ${v.title} | UP:${v.up} | 播放:${v.play ?? '?'} | ${v.url}`)

  const prompt = [
    `你是我的自我升级顾问。本周（${week}）主动搜集到一批新涌现的 Agent Skill（GitHub ${github.length} 个仓库 + B站 ${bili.length} 个视频）。`,
    `请输出一份中文 Markdown 技能升级简报，不要开场白，结构如下：`,
    `# 技能升级简报 ${week}`,
    `## 一、GitHub 新技能（精选 8-10 个，按实用价值排序）`,
    `每个：名称+链接、一句话用途、对谁有用（写代码/研究/内容创作等）、是否兼容 opencode（描述没提的标"待确认"）`,
    `## 二、B站 学习视频（挑 3-4 个，一句话推荐理由）`,
    `## 三、安装建议（哪些值得装、装法提示：git clone 到 opencode skills 目录即可；不推荐的理由写出来）`,
    `素材：`,
    `【GitHub】`,
    ...ghLines,
    `【B站】`,
    ...biLines,
  ].join('\n')

  console.log(`[skill-scout] synthesis (${prompt.length} chars)...`)
  const result = await runDsh({ text: prompt })
  console.log(`[skill-scout] done, tokens=${result.usage?.totalTokens ?? '?'}`)

  const reportDir = join(root, 'reports', 'skills')
  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(reportDir, `${week}-skills.md`)
  const header = [
    `# 技能升级简报 ${week}`,
    ``,
    `> 生成时间：${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · 来源：GitHub ${github.length} / B站 ${bili.length}`,
    ``,
    `---`,
    ``,
  ].join('\n')
  const body = (result.text || '(empty response)').replace(/^#\s*技能升级简报\S*\s*\n/, '')
  writeFileSync(reportPath, header + body + '\n', 'utf8')
  console.log(`[skill-scout] report -> ${reportPath}`)

  const { pushReport, loadConfig } = await Promise.all([
    import('../weekly/push.mjs'),
    import('../weekly/fetch/common.mjs'),
  ]).then(([p, c]) => ({ pushReport: p.pushReport, loadConfig: c.loadConfig }))
  const config = loadConfig()
  if (config.push?.enabled !== false) {
    try {
      await pushReport(reportPath, config)
    } catch (err) {
      console.error(`[skill-scout] push failed (report kept): ${err.message}`)
    }
  }
}

main().catch((err) => {
  console.error('[skill-scout] FAILED:', err)
  process.exitCode = 1
})
