/**
 * Central registry of source-domain reputation data.
 *
 * These are editorial/reputation constants (not runtime data). They used to be
 * inlined in `src/lib/ai.ts` and `src/lib/engines/source-credibility.ts`.
 * Centralised here so they can be reviewed, versioned, and — for an enterprise
 * deployment — moved to the database (`SourceCredibilityScore`) or an admin-editable
 * config without touching engine code.
 *
 * Enterprise TODO: load these from `SourceCredibilityScore` / a config service at
 * startup and treat this file as the seed/default only.
 */

export interface DomainCredibility {
  rating: number // 0-100 editorial reputation
  type: string
}

/** Editorial reputation by domain. Used to rate/rank sources shown in the UI. */
export const DOMAIN_CREDIBILITY: Record<string, DomainCredibility> = {
  'pib.gov.in': { rating: 90, type: 'Government' },
  'altnews.in': { rating: 88, type: 'Regional' },
  'boomlive.in': { rating: 87, type: 'Regional' },
  'factly.in': { rating: 86, type: 'Regional' },
  'snopes.com': { rating: 95, type: 'International' },
  'politifact.com': { rating: 93, type: 'International' },
  'factcheck.org': { rating: 96, type: 'International' },
  'fullfact.org': { rating: 94, type: 'International' },
  'reuters.com': { rating: 92, type: 'News Agency' },
  'apnews.com': { rating: 92, type: 'News Agency' },
  'bbc.com': { rating: 90, type: 'News' },
  'afp.com': { rating: 91, type: 'News Agency' },
  'thequint.com': { rating: 80, type: 'Regional' },
  'vishvasnews.com': { rating: 82, type: 'Regional' },
  'newschecker.in': { rating: 81, type: 'Regional' },
}

/** Default reputation for unknown domains. */
export const DEFAULT_DOMAIN_CREDIBILITY: DomainCredibility = { rating: 50, type: 'Web' }

/** Domains treated as dedicated fact-checkers by the source-credibility engine. */
export const FACT_CHECKER_DOMAINS = new Set<string>([
  'pib.gov.in',
  'altnews.in',
  'boomlive.in',
  'factly.in',
  'snopes.com',
  'politifact.com',
  'factcheck.org',
  'reuters.com/fact-check',
  'apnews.com/hub/ap-fact-check',
])
