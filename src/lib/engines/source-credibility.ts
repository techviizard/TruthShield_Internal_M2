/**
 * Derived source credibility scoring.
 * Aggregates over FactCheckMatch.url hostnames + AnalysisReport explanations.
 * Real metric - no hardcoded NDTV/TOI ratings.
 */

import { db } from '@/lib/db'
import { FACT_CHECKER_DOMAINS } from '@/config/source-domains'

export interface SourceScore {
  domain: string
  totalCitations: number
  factualRating: number        // 0..100 - avg trustScore of analyses citing this source
  biasScore: number            // -50..+50 - sentiment skew of citing analyses (negative = left-leaning lexical, positive = right)
  recencyDays: number          // days since last citation
  type: 'fact-checker' | 'mainstream' | 'unknown'
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Compute credibility scores for all observed domains.
 */
export async function computeSourceCredibility(): Promise<SourceScore[]> {
  const matches = await db.factCheckMatch.findMany({
    select: {
      url: true,
      verdict: true,
      confidence: true,
      matchedAt: true,
      analysisReport: { select: { trustScore: true, explanation: true } },
    },
  })

  const byDomain = new Map<string, {
    citations: number
    trustSum: number; trustN: number
    biasSum: number; biasN: number
    lastSeen: Date
  }>()

  for (const m of matches) {
    if (!m.url) continue
    const domain = extractDomain(m.url)
    if (!domain) continue
    const entry = byDomain.get(domain) ?? { citations: 0, trustSum: 0, trustN: 0, biasSum: 0, biasN: 0, lastSeen: new Date(0) }
    entry.citations++
    if (m.analysisReport?.trustScore != null) {
      entry.trustSum += m.analysisReport.trustScore
      entry.trustN++
    }
    // Lexical bias proxy - count loaded words in explanation
    if (m.analysisReport?.explanation) {
      const exp = m.analysisReport.explanation.toLowerCase()
      const leftMarkers = ['progressive', 'social justice', 'equality', 'climate crisis', 'minority rights'].filter((k) => exp.includes(k)).length
      const rightMarkers = ['traditional', 'sovereignty', 'illegal immigration', 'patriot', 'family values'].filter((k) => exp.includes(k)).length
      const bias = (rightMarkers - leftMarkers) * 10
      entry.biasSum += bias
      entry.biasN++
    }
    if (m.matchedAt > entry.lastSeen) entry.lastSeen = m.matchedAt
    byDomain.set(domain, entry)
  }

  const now = Date.now()
  const scores: SourceScore[] = []
  for (const [domain, e] of byDomain) {
    const factualRating = e.trustN > 0 ? Math.round(e.trustSum / e.trustN) : 50
    const biasScore = e.biasN > 0 ? Math.max(-50, Math.min(50, Math.round(e.biasSum / e.biasN))) : 0
    const recencyDays = Math.round((now - e.lastSeen.getTime()) / 86400_000)
    const type: SourceScore['type'] = FACT_CHECKER_DOMAINS.has(domain) ? 'fact-checker' : 'mainstream'
    scores.push({
      domain,
      totalCitations: e.citations,
      factualRating,
      biasScore,
      recencyDays,
      type,
    })
  }

  return scores.sort((a, b) => b.totalCitations - a.totalCitations)
}
