// Minimal Bilibili discovery client for the v1 brief.
// No login required: a generated buvid3/buvid4 cookie is enough for search + ranking.
// Followed-UP sync (space API) is intentionally not used in v1 because it
// requires a logged-in cookie and is flaky without one.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const BASE_HEADERS = {
  'User-Agent': UA,
  Referer: 'https://www.bilibili.com/',
  Origin: 'https://www.bilibili.com',
}

let cachedCookie = null
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJson(url, { cookie, retries = 3, timeoutMs = 15000 } = {}) {
  let lastError
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const headers = { ...BASE_HEADERS, ...(cookie ? { Cookie: cookie } : {}) }
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      if (json.code !== undefined && json.code !== 0) {
        throw new Error(`bilibili code ${json.code}: ${json.message ?? ''}`)
      }
      return json
    } catch (error) {
      lastError = error
      if (attempt < retries - 1) await sleep(800 * (attempt + 1))
    }
  }
  throw lastError
}

export async function getCookie() {
  if (cachedCookie) return cachedCookie
  const json = await fetchJson('https://api.bilibili.com/x/frontend/finger/spi')
  const b3 = json.data?.b_3
  const b4 = json.data?.b_4
  if (!b3) throw new Error('buvid3 unavailable')
  cachedCookie = `buvid3=${b3}` + (b4 ? `; buvid4=${b4}` : '')
  return cachedCookie
}

export async function searchVideos(keyword, { page = 1, limit = 20, cookie } = {}) {
  const ck = cookie ?? await getCookie()
  const query = new URLSearchParams({
    search_type: 'video',
    keyword,
    page: String(page),
  })
  const json = await fetchJson(
    `https://api.bilibili.com/x/web-interface/search/type?${query}`,
    { cookie: ck }
  )
  return (json.data?.result ?? []).slice(0, limit).map(normalizeSearch)
}

export async function ranking({ limit = 20 } = {}) {
  const ck = await getCookie()
  const json = await fetchJson(
    'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all',
    { cookie: ck }
  )
  return (json.data?.list ?? []).slice(0, limit).map(normalizeRanking)
}

function stripTags(value) {
  return String(value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function normalizePubdate(value) {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const ms = n > 1e12 ? n : n * 1000
  return new Date(ms).toISOString()
}

function parseDuration(value) {
  if (value == null) return null
  if (typeof value === 'number') return value
  const text = String(value).trim()
  if (/^\d+$/.test(text)) return Number(text)
  const parts = text.split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}

function normalizeSearch(item) {
  return {
    bvid: item.bvid,
    title: stripTags(item.title),
    up: item.author,
    mid: item.mid ?? null,
    pubdate: normalizePubdate(item.pubdate),
    duration: parseDuration(item.duration),
    url: `https://www.bilibili.com/video/${item.bvid}`,
    play: item.play ?? null,
    like: item.like ?? null,
    description: stripTags(item.description),
    source: 'search',
  }
}

function normalizeRanking(item) {
  return {
    bvid: item.bvid,
    title: stripTags(item.title),
    up: item.owner?.name ?? null,
    mid: item.owner?.mid ?? null,
    pubdate: normalizePubdate(item.pubdate),
    duration: parseDuration(item.duration),
    url: item.short_link_v2 || `https://www.bilibili.com/video/${item.bvid}`,
    play: item.stat?.view ?? null,
    like: item.stat?.like ?? null,
    description: stripTags(item.desc),
    source: 'ranking',
  }
}
