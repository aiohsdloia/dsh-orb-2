import { fetcherMain, rankByKeywords } from '../../weekly/fetch/common.mjs'

const days = 7

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000)
  return d.toISOString().slice(0, 10)
}

async function fetchJson(url, token) {
  const headers = { 'User-Agent': 'steward-skill-scout/1.0' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function searchOnce(q) {
  const api = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=15`
  const token = process.env.GITHUB_TOKEN
  const attempts = [() => fetchJson(api, token), () => fetchJson(`https://gh-proxy.com/${api}`, token)]
  let lastErr
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('search failed')
}

function fetchSkills(section) {
  const since = isoDaysAgo(days)
  const queries = [
    `skill agent created:>${since}`,
    `skills in:name created:>${since}`,
    `agent-skills created:>${since}`,
    `claude-skill created:>${since}`,
  ]
  return Promise.allSettled(queries.map(searchOnce)).then((results) => {
    const seen = new Set()
    const items = []
    for (const r of results) {
      if (r.status !== 'fulfilled') {
        console.error(`[skill-scout github] query failed: ${r.reason?.message}`)
        continue
      }
      for (const repo of r.value?.items || []) {
        if (seen.has(repo.full_name)) continue
        seen.add(repo.full_name)
        const text = `${repo.full_name} ${repo.description || ''}`
        const hasSkill = /skill/i.test(text)
        const hasAgentContext = /(agent|ai|claude|opencode|mcp|workflow|automation|prompt|llm)/i.test(text)
        if (!hasSkill || !hasAgentContext) continue
        items.push({
          name: repo.full_name,
          url: repo.html_url,
          description: (repo.description || '').slice(0, 240),
          stars: repo.stargazers_count,
          language: repo.language,
          updated: repo.updated_at?.slice(0, 10),
        })
      }
    }
    const scored = rankByKeywords(items, section.keywords || [], (i) => `${i.name} ${i.description}`, section.max)
    return scored.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
  })
}

fetcherMain('skills-github', fetchSkills)
