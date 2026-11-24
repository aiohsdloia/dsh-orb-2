import { fetcherMain, withinDays } from './common.mjs'

const ITEM = /<item(?:[ >][^>]*)?>([\s\S]*?)<\/item>/g
const TAG = (name) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')

function stripXml(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function fetchFeed(feed) {
  return fetch(feed.url, { headers: { 'User-Agent': 'steward-weekly/1.0' } })
    .then((r) => {
      if (!r.ok) throw new Error(`${feed.name} HTTP ${r.status}`)
      return r.text()
    })
    .then((xml) => {
      const items = []
      for (const m of xml.matchAll(ITEM)) {
        const block = m[1]
        items.push({
          feed: feed.name,
          title: stripXml((block.match(TAG('title')) || [])[1] || ''),
          url: ((block.match(TAG('link')) || [])[1] || '').trim(),
          date: ((block.match(TAG('pubDate')) || block.match(TAG('dc:date')) || [])[1] || '').replace(/\s+/g, ''),
          summary: stripXml((block.match(TAG('description')) || [])[1] || '').slice(0, 300),
        })
      }
      return items
    })
}

function fetchRss(section) {
  return Promise.allSettled(section.feeds.map(fetchFeed)).then((results) => {
    const items = []
    for (const r of results) {
      if (r.status === 'fulfilled') items.push(...r.value)
      else console.error(`[rss] feed failed: ${r.reason?.message}`)
    }
    const recent = items
      .filter((i) => i.title && i.url)
      .filter((i, idx, arr) => arr.findIndex((x) => x.url === i.url) === idx)
      .filter((i) => {
        if (!i.date) return true
        return withinDays(i.date, section.days)
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    return recent.slice(0, section.max)
  })
}

fetcherMain('rss', fetchRss)
