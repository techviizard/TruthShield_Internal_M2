/**
 * Near-duplicate matching against the recurring-hoax registry.
 *
 * Viral misinformation rarely arrives as new text — it arrives as the same
 * narrative reworded, translated, or re-cropped. Matching against known
 * narratives catches that class in milliseconds, offline, before any model call.
 */

import { db } from '@/lib/db'
import { semanticSimilarity } from '@/lib/engines/semantic'
import { hammingDistance } from '@/lib/engines/phash'

export interface HoaxMatch {
  id: string
  title: string
  narrative: string
  language: string
  category: string
  verdict: string
  debunkUrl: string | null
  debunkSource: string | null
  /** 0..100 */
  similarity: number
  matchType: 'text' | 'image'
  sharedTerms: string[]
  hitCount: number
}

/** Text similarity at or above this is reported as a match worth showing. */
export const TEXT_MATCH_THRESHOLD = 0.34
/** dHash Hamming distance at or below this counts as the same image. */
export const IMAGE_MATCH_MAX_DISTANCE = 10

/**
 * Compare text against every active registry entry.
 * The registry is small (curated narratives, not a document corpus), so a linear
 * scan is correct here — no index to keep in sync, no approximate recall loss.
 */
export async function matchKnownHoaxes(text: string, limit = 3): Promise<HoaxMatch[]> {
  if (!text.trim()) return []
  const entries = await db.knownHoax.findMany({ where: { isActive: true } })

  const scored = entries
    .map((e) => {
      const sim = semanticSimilarity(text, e.narrative)
      return {
        id: e.id,
        title: e.title,
        narrative: e.narrative,
        language: e.language,
        category: e.category,
        verdict: e.verdict,
        debunkUrl: e.debunkUrl,
        debunkSource: e.debunkSource,
        similarity: Math.round(sim.score * 100),
        matchType: 'text' as const,
        sharedTerms: sim.sharedTerms,
        hitCount: e.hitCount,
        raw: sim.score,
      }
    })
    .filter((m) => m.raw >= TEXT_MATCH_THRESHOLD)
    .sort((a, b) => b.raw - a.raw)
    .slice(0, limit)

  return scored.map(({ raw: _raw, ...m }) => m)
}

/** Match an image's perceptual hash against hashes recorded for known hoaxes. */
export async function matchKnownHoaxImages(perceptualHash: string, limit = 3): Promise<HoaxMatch[]> {
  if (!perceptualHash) return []
  const entries = await db.knownHoax.findMany({
    where: { isActive: true, perceptualHash: { not: null } },
  })

  return entries
    .map((e) => ({ e, distance: hammingDistance(perceptualHash, e.perceptualHash!) }))
    .filter(({ distance }) => distance <= IMAGE_MATCH_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ e, distance }) => ({
      id: e.id,
      title: e.title,
      narrative: e.narrative,
      language: e.language,
      category: e.category,
      verdict: e.verdict,
      debunkUrl: e.debunkUrl,
      debunkSource: e.debunkSource,
      similarity: Math.round(((64 - distance) / 64) * 100),
      matchType: 'image' as const,
      sharedTerms: [],
      hitCount: e.hitCount,
    }))
}

/** Record that a registry entry was matched again — drives "seen N times" in the UI. */
export async function recordHoaxHit(id: string): Promise<void> {
  try {
    await db.knownHoax.update({
      where: { id },
      data: { hitCount: { increment: 1 }, lastSeen: new Date() },
    })
  } catch {
    // A missing or deactivated entry must not fail the analysis that found it.
  }
}
