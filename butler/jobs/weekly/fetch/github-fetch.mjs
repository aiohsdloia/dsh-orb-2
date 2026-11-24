import { fetcherMain } from './common.mjs'

const days = 7

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000)
  return d.toISOString().slice(0, 10)
}

async function fetchJson(url, token) {
  const headers = { 'User-Agent': 'steward-weekly/1.0' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function trySearch() {
  const q = `created:%3E${isoDaysAgo(days)}`
  const api = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=20`
  const token = process.env.GITHUB_TOKEN
  const attempts = [
    () => fetchJson(api, token),
    () => fetchJson(`https://gh-proxy.com/${api}`, token),
  ]
  let lastErr
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('github search failed')
}

function fetchGithub(section) {
  return trySearch().then((j) =>
    (j?.items || []).slice(0, section.max).map((r) => ({
      name: r.full_name,
      url: r.html_url,
      description: (r.description || '').slice(0, 200),
      stars: r.stargazers_count,
      language: r.language,
    })),
  )
}

fetcherMain('github', fetchGithub)
