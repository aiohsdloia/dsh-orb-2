import { fetcherMain, rankByKeywords } from './common.mjs'

function fetchPubmed(section) {
  const term = section.query || '""'
  const esearch = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&reldate=${section.days}&datetype=pdat&retmax=60&sort=pub_date&retmode=json`
  return fetch(esearch)
    .then((r) => {
      if (!r.ok) throw new Error(`pubmed esearch HTTP ${r.status}`)
      return r.json()
    })
    .then((j) => {
      const ids = j?.esearchresult?.idlist || []
      if (!ids.length) return []
      const esummary = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
      return fetch(esummary).then((r2) => {
        if (!r2.ok) throw new Error(`pubmed esummary HTTP ${r2.status}`)
        return r2.json()
      })
    })
    .then((j) => {
      const results = j?.result || {}
      const items = []
      for (const key of Object.keys(results)) {
        if (key === 'uids') continue
        const a = results[key]
        if (!a?.title) continue
        items.push({
          title: a.title,
          journal: a.fulljournalname || '',
          date: a.pubdate || '',
          authors: (a.authors || []).map((x) => x.name).slice(0, 5),
          url: `https://pubmed.ncbi.nlm.nih.gov/${key}/`,
        })
      }
      return rankByKeywords(items, section.keywords || [], (i) => `${i.title} ${i.journal}`, section.max)
    })
}

fetcherMain('pubmed', fetchPubmed)
