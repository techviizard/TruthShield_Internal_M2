/**
 * Semantic similarity + stance detection.
 *
 * The problem statement asks for "NLP techniques for stance detection and
 * semantic similarity". Both are implemented in-house so they work offline and
 * so every verdict can be traced to the tokens that produced it:
 *
 *  - similarity: TF-IDF cosine blended with character-trigram Jaccard. The
 *    trigram half is what makes this usable on Indic scripts, where word
 *    tokenisation is unreliable and paraphrases keep sub-word structure.
 *  - stance: cue-phrase classification (refute / support / neutral) weighted by
 *    how topically related the evidence is to the claim, so an unrelated snippet
 *    is reported as unrelated rather than as weak support.
 */

import { tokenize, termFrequency, cosineSim } from '@/lib/engines/tfidf'

/** Character trigrams - script-agnostic, survives inflection and transliteration drift. */
export function trigrams(text: string): Set<string> {
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const out = new Set<string>()
  for (let i = 0; i + 3 <= norm.length; i++) out.add(norm.slice(i, i + 3))
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

/** Cosine over raw term frequencies, normalised - no corpus IDF needed for a pair. */
function pairCosine(a: string, b: string): number {
  const ta = termFrequency(tokenize(a))
  const tb = termFrequency(tokenize(b))
  if (!ta.size || !tb.size) return 0
  return cosineSim(ta, tb)
}

export interface SimilarityBreakdown {
  /** 0..1 blended score. */
  score: number
  lexical: number   // TF-IDF cosine over word tokens
  character: number // trigram Jaccard
  sharedTerms: string[]
}

/**
 * Blend weighted toward trigrams (0.55) because the corpus is multilingual and
 * word-level tokenisation degrades on Indic scripts far more than trigrams do.
 */
export function semanticSimilarity(a: string, b: string): SimilarityBreakdown {
  const lexical = pairCosine(a, b)
  const character = jaccard(trigrams(a), trigrams(b))
  const ta = new Set(tokenize(a))
  const shared = [...new Set(tokenize(b))].filter((t) => ta.has(t)).slice(0, 8)
  return {
    score: Math.min(1, 0.45 * lexical + 0.55 * character),
    lexical,
    character,
    sharedTerms: shared,
  }
}

export type Stance = 'support' | 'refute' | 'neutral' | 'unrelated'

export interface StanceResult {
  stance: Stance
  /** 0..1 - how strongly the cues point at the reported stance. */
  confidence: number
  relatedness: number
  cues: string[]
  rationale: string
}

const REFUTE_CUES: RegExp[] = [
  /\b(?:false|fake|hoax|debunk(?:ed|s)?|misleading|baseless|fabricated|doctored|morphed|no truth|not true|untrue|rumou?r)\b/i,
  /\b(?:denied|denies|refutes?|rejects?|dismissed)\b/i,
  /\bfact[- ]check(?:ed)?\b.{0,30}\b(?:false|misleading)\b/i,
  /\bno such (?:scheme|order|notification|announcement)\b/i,
  /फर्जी|झूठ|अफवाह|गलत\s*दावा|खंडन|भ्रामक/,
  /ખોટું|અફવા|ભ્રામક|ખંડન/,
  /போலி|வதந்தி|தவறான/,
]

const SUPPORT_CUES: RegExp[] = [
  /\b(?:confirmed|confirms?|verified|corroborat(?:ed|es)|accurate|true|as reported|indeed)\b/i,
  /\bofficial(?:ly)? (?:announced|notified|confirmed)\b/i,
  /पुष्टि|सही\s*पाया|सत्यापित/,
  /પુષ્ટિ|સાચું\s*જણાયું/,
  /உறுதிப்படுத்த|சரியானது/,
]

/**
 * Classify how an evidence snippet stands toward a claim.
 *
 * Deliberately conservative: below a relatedness floor the snippet is 'unrelated'
 * rather than 'neutral', because "no stance" and "not about this claim" mean
 * different things to an analyst deciding whether to keep searching.
 */
export function detectStance(claim: string, evidence: string): StanceResult {
  const sim = semanticSimilarity(claim, evidence)
  const relatedness = sim.score

  const cues: string[] = []
  let refute = 0
  let support = 0
  for (const re of REFUTE_CUES) {
    const m = evidence.match(re)
    if (m?.[0]) { refute++; cues.push(m[0].trim().slice(0, 40)) }
  }
  for (const re of SUPPORT_CUES) {
    const m = evidence.match(re)
    if (m?.[0]) { support++; cues.push(m[0].trim().slice(0, 40)) }
  }

  if (relatedness < 0.08) {
    return {
      stance: 'unrelated',
      confidence: 1 - relatedness,
      relatedness,
      cues: [],
      rationale: 'Evidence shares little content with the claim; it does not address it either way.',
    }
  }

  if (refute === 0 && support === 0) {
    return {
      stance: 'neutral',
      confidence: 0.4,
      relatedness,
      cues: [],
      rationale: 'Evidence is on topic but carries no verdict language either way.',
    }
  }

  const stance: Stance = refute > support ? 'refute' : support > refute ? 'support' : 'neutral'
  const dominant = Math.max(refute, support)
  const total = refute + support
  // Confidence rises with cue agreement and with topical overlap.
  const confidence = Math.min(0.97, (dominant / total) * (0.55 + 0.45 * Math.min(1, relatedness * 3)))

  return {
    stance,
    confidence,
    relatedness,
    cues: [...new Set(cues)].slice(0, 5),
    rationale:
      stance === 'refute'
        ? `Evidence uses refutation language (${cues.slice(0, 2).join(', ')}) about a closely matching claim.`
        : stance === 'support'
          ? `Evidence uses confirmation language (${cues.slice(0, 2).join(', ')}) about a closely matching claim.`
          : 'Refuting and supporting cues are balanced; treat as inconclusive.',
  }
}

export interface StanceRollup {
  support: number
  refute: number
  neutral: number
  unrelated: number
  /** Net position across evidence, -1 (refuted) .. +1 (supported). */
  net: number
  verdictHint: 'likely_false' | 'likely_true' | 'disputed' | 'unverified'
}

/** Aggregate per-source stances into one position, weighted by confidence. */
export function rollupStances(results: StanceResult[]): StanceRollup {
  const counts = { support: 0, refute: 0, neutral: 0, unrelated: 0 }
  let weighted = 0
  let weight = 0
  for (const r of results) {
    counts[r.stance]++
    if (r.stance === 'support' || r.stance === 'refute') {
      weighted += (r.stance === 'support' ? 1 : -1) * r.confidence
      weight += r.confidence
    }
  }
  const net = weight === 0 ? 0 : weighted / weight
  const decisive = counts.support + counts.refute

  let verdictHint: StanceRollup['verdictHint'] = 'unverified'
  if (decisive === 0) verdictHint = 'unverified'
  else if (counts.support > 0 && counts.refute > 0 && Math.abs(net) < 0.34) verdictHint = 'disputed'
  else if (net <= -0.34) verdictHint = 'likely_false'
  else if (net >= 0.34) verdictHint = 'likely_true'

  return { ...counts, net, verdictHint }
}
