import { fetcherMain, withinDays, rankByKeywords } from './common.mjs'

const ATOM_ENTRY = /<entry>([\s\S]*?)<\/entry>/g
const TAG = (name) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')
const LINK_HREF = /<link[^>]+href="([^"]+)"/i
const AUTHOR_NAME = /<name>([\s\S]*?)<\/name>/g

function stripXml(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fetchArxiv(section) {
  const cats = section.categories.join(' OR ')
  const query = `cat:${cats}`
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=80`
  return fetch(url, { headers: { 'User-Agent': 'steward-weekly/1.0' } })
    .then((r) => {
      if (!r.ok) throw new Error(`arxiv HTTP ${r.status}`)
      return r.text()
    })
    .then((xml) => {
      const items = []
      for (const m of xml.matchAll(ATOM_ENTRY)) {
        const block = m[1]
        const id = (block.match(TAG('id')) || [])[1] || ''
        const title = stripXml((block.match(TAG('title')) || [])[1] || '')
        const summary = stripXml((block.match(TAG('summary')) || [])[1] || '')
        const published = (block.match(TAG('published')) || [])[1] || ''
        const link = (block.match(LINK_HREF) || [])[1] || id
        const authors = []
        for (const am of block.matchAll(AUTHOR_NAME)) authors.push(am[1].trim())
        if (!withinDays(published, section.days)) continue
        items.push({ title, authors: authors.slice(0, 5), published: published.slice(0, 10), summary: summary.slice(0, 400), url: link })
      }
      return rankByKeywords(items, section.keywords || [], (i) => `${i.title} ${i.summary}`, section.max)
    })
}

fetcherMain('arxiv', fetchArxiv)
