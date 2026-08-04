/**
 * GET /api/source-credibility[?domain=example.com]
 *
 * Real source credibility: computed from how each domain has been cited in
 * stored fact-check matches (`source-credibility` engine), merged with the
 * persisted `SourceCredibilityScore` rows and the editorial reference registry
 * in `src/config/source-domains.ts`. No fabricated ratings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { computeSourceCredibility, type SourceScore } from '@/lib/engines/source-credibility'
import { db } from '@/lib/db'
import {
  DOMAIN_CREDIBILITY,
  DEFAULT_DOMAIN_CREDIBILITY,
  FACT_CHECKER_DOMAINS,
} from '@/config/source-domains'

export interface EnrichedSource extends SourceScore {
  /** Editorial reference rating from the curated registry (null when unknown). */
  referenceRating: number | null
  referenceType: string
  /** Persisted score row, when the domain has one. */
  storedCitations: number | null
  isFactChecker: boolean
}

export async function GET(req: NextRequest) {
  try {
    const wanted = req.nextUrl.searchParams.get('domain')?.toLowerCase().replace(/^www\./, '')

    const [computed, stored] = await Promise.all([
      computeSourceCredibility(),
      db.sourceCredibilityScore.findMany(),
    ])

    const storedByDomain = new Map(stored.map((s) => [s.domain, s]))
    const byDomain = new Map<string, SourceScore>(computed.map((c) => [c.domain, c]))

    // Include persisted domains that have no citations in the current window.
    for (const s of stored) {
      if (!byDomain.has(s.domain)) {
        byDomain.set(s.domain, {
          domain: s.domain,
          totalCitations: s.totalCitations,
          factualRating: s.factualRating,
          biasScore: s.biasScore,
          recencyDays: Math.round((Date.now() - s.lastUpdated.getTime()) / 86_400_000),
          type: (s.type as SourceScore['type']) ?? 'unknown',
        })
      }
    }

    const enrich = (s: SourceScore): EnrichedSource => {
      const ref = DOMAIN_CREDIBILITY[s.domain]
      return {
        ...s,
        referenceRating: ref ? ref.rating : null,
        referenceType: ref ? ref.type : DEFAULT_DOMAIN_CREDIBILITY.type,
        storedCitations: storedByDomain.get(s.domain)?.totalCitations ?? null,
        isFactChecker: FACT_CHECKER_DOMAINS.has(s.domain),
      }
    }

    if (wanted) {
      const hit = byDomain.get(wanted)
      if (hit) {
        return NextResponse.json({ success: true, source: enrich(hit) })
      }
      const ref = DOMAIN_CREDIBILITY[wanted]
      if (!ref) {
        return NextResponse.json(
          {
            success: false,
            error: `No citations or reference entry for "${wanted}" — this domain has not appeared in any analysis yet.`,
          },
          { status: 404 },
        )
      }
      // Known registry domain that hasn't been cited yet — return the reference only.
      const refOnly: EnrichedSource = {
        domain: wanted,
        totalCitations: 0,
        factualRating: ref.rating,
        biasScore: 0,
        recencyDays: -1,
        type: FACT_CHECKER_DOMAINS.has(wanted) ? 'fact-checker' : 'mainstream',
        referenceRating: ref.rating,
        referenceType: ref.type,
        storedCitations: null,
        isFactChecker: FACT_CHECKER_DOMAINS.has(wanted),
      }
      return NextResponse.json({ success: true, source: refOnly })
    }

    const sources = Array.from(byDomain.values())
      .map(enrich)
      .sort((a, b) => b.totalCitations - a.totalCitations)

    return NextResponse.json({
      success: true,
      sources,
      registry: Object.entries(DOMAIN_CREDIBILITY).map(([domain, v]) => ({
        domain,
        rating: v.rating,
        type: v.type,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
