import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..', '..')

export function loadConfig() {
  for (const name of ['weekly.json', 'weekly.example.json']) {
    const p = join(root, 'butler', 'config', name)
    try {
      return JSON.parse(readFileSync(p, 'utf8'))
    } catch {
      continue
    }
  }
  throw new Error('no weekly config found')
}

export function isoWeek() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const week = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function sinceDate(days) {
  const d = new Date(Date.now() - days * 86400000)
  return d
}

export function withinDays(dateStr, days) {
  const d = new Date(dateStr)
  return !Number.isNaN(d.getTime()) && d >= sinceDate(days)
}

export function rankByKeywords(items, keywords, getText, max) {
  if (!keywords.length) return items.slice(0, max)
  const scored = items.map((item) => {
    const text = (getText(item) || '').toLowerCase()
    const score = keywords.reduce((s, kw) => s + (text.includes(kw.toLowerCase()) ? 1 : 0), 0)
    return { item, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, max).map((s) => s.item)
}

export function writeRaw(source, data) {
  const dir = join(root, 'butler', 'data', 'weekly', isoWeek(), 'raw')
  mkdirSync(dir, { recursive: true })
  const p = join(dir, `${source}.json`)
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
  return p
}

export function fetcherMain(source, fn) {
  const config = loadConfig()
  const section = config[source]
  if (!section || section.enabled === false) {
    console.log(`[${source}] disabled, skip`)
    return
  }
  fn(section, config)
    .then((items) => {
      const p = writeRaw(source, items)
      console.log(`[${source}] ${items.length} items -> ${p}`)
      for (const it of items.slice(0, 5)) {
        console.log(`  - ${it.title || it.name || it.id}`)
      }
    })
    .catch((err) => {
      console.error(`[${source}] FAILED:`, err.message)
      process.exitCode = 1
    })
}
