import { sinceDate } from '../../weekly/fetch/common.mjs'
import { searchVideos } from '../../bili-brief/bili.mjs'

const topics = ['AI skill', 'opencode 技能', 'claude skill', '智能体 技能 分享', 'AI 工作流 技巧']

async function fetchBiliSkills(section) {
  const seen = new Set()
  const items = []
  const cutoff = sinceDate(section.days ?? 7)
  for (const topic of topics) {
    let found = []
    try {
      found = await searchVideos(topic, { limit: 8 })
    } catch (err) {
      console.error(`[skill-scout bili] "${topic}" failed: ${err.message}`)
      continue
    }
    for (const v of found) {
      if (seen.has(v.bvid)) continue
      seen.add(v.bvid)
      if (v.pubdate && new Date(v.pubdate) < cutoff) continue
      items.push({ bvid: v.bvid, title: v.title, up: v.up, pubdate: v.pubdate, play: v.play ?? null, url: v.url })
    }
  }
  items.sort((a, b) => (b.play ?? 0) - (a.play ?? 0))
  return items.slice(0, section.max ?? 10)
}

const config = (await import('../../weekly/fetch/common.mjs')).loadConfig()
const section = config['skills-bili'] || config['skills'] || { enabled: true, days: 7, max: 10 }
if (section.enabled === false) {
  console.log('[skills-bili] disabled, skip')
} else {
  const { writeRaw, isoWeek } = await import('../../weekly/fetch/common.mjs')
  try {
    const items = await fetchBiliSkills(section)
    const p = writeRaw('skills-bili', items, isoWeek())
    console.log(`[skills-bili] ${items.length} items -> ${p}`)
    for (const it of items.slice(0, 5)) console.log(`  - ${it.title} | ${it.up}`)
  } catch (err) {
    console.error('[skills-bili] FAILED:', err.message)
    process.exitCode = 1
  }
}
