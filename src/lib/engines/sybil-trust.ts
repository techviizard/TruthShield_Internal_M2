/**
 * Anti-sybil community trust math.
 * Existing community vote was trivially gameable. Adds vote weighting + outlier detection.
 */

export interface Vote {
  voterFingerprint: string    // hashed IP+UA combo
  vote: 'agree' | 'disagree'
  voterTrustScore: number     // 0..100, voter's historical accuracy
  createdAt: Date
}

export interface ConsensusResult {
  consensusPct: number       // 0..100 weighted agree percentage
  rawAgreePct: number        // unweighted, for comparison
  status: 'pending' | 'verified' | 'disputed'
  effectiveVoters: number    // post-sybil-filter count
  flaggedSybil: number       // votes excluded
  confidence: number         // 0..100 — how reliable is this consensus
}

const MIN_VOTES_FOR_STATUS = 10
const VERIFIED_THRESHOLD = 85
const DISPUTED_THRESHOLD = 40

/**
 * Trust-weighted consensus with sybil filtering.
 *
 * Strategy:
 *  1. Group votes by fingerprint — only most recent vote per fingerprint counts (no ballot stuffing).
 *  2. Weight each vote by voterTrustScore / 100. New voters (trustScore < 30) get 0.3 weight.
 *  3. Detect coordinated voting bursts (same fingerprint cluster within 1 minute = downweight).
 *  4. Consensus = sum(weighted agree) / sum(weighted total) * 100.
 *  5. Confidence considers effectiveVoters and weight distribution.
 */
export function computeConsensus(votes: Vote[]): ConsensusResult {
  // De-duplicate by fingerprint (keep latest)
  const byFp = new Map<string, Vote>()
  for (const v of votes) {
    const existing = byFp.get(v.voterFingerprint)
    if (!existing || v.createdAt > existing.createdAt) byFp.set(v.voterFingerprint, v)
  }
  const flaggedSybil = votes.length - byFp.size
  const unique = Array.from(byFp.values())

  // Burst detection: if > 5 votes within 60s share fingerprint prefix, downweight
  const burstFlags = new Set<string>()
  const sorted = [...unique].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  for (let i = 0; i < sorted.length; i++) {
    let window = 0
    for (let j = i; j < sorted.length; j++) {
      if (sorted[j].createdAt.getTime() - sorted[i].createdAt.getTime() > 60_000) break
      if (sorted[j].voterFingerprint.slice(0, 8) === sorted[i].voterFingerprint.slice(0, 8)) window++
    }
    if (window > 5) burstFlags.add(sorted[i].voterFingerprint)
  }

  let agreeW = 0, totalW = 0
  let rawAgree = 0
  for (const v of unique) {
    const base = v.voterTrustScore < 30 ? 0.3 : v.voterTrustScore / 100
    const w = burstFlags.has(v.voterFingerprint) ? base * 0.25 : base
    if (v.vote === 'agree') { agreeW += w; rawAgree++ }
    totalW += w
  }
  const consensusPct = totalW > 0 ? Math.round((agreeW / totalW) * 100) : 0
  const rawAgreePct = unique.length > 0 ? Math.round((rawAgree / unique.length) * 100) : 0

  // Status
  let status: ConsensusResult['status'] = 'pending'
  if (unique.length >= MIN_VOTES_FOR_STATUS) {
    if (consensusPct >= VERIFIED_THRESHOLD) status = 'verified'
    else if (consensusPct <= DISPUTED_THRESHOLD) status = 'disputed'
  }

  // Confidence: scales with voter count and weight variance
  const meanW = totalW / (unique.length || 1)
  const weightSpread = unique.length > 0
    ? 1 - Math.abs(consensusPct - 50) / 50  // closer to 50 = less confident
    : 0
  const sizeBoost = Math.min(1, unique.length / 30)
  const confidence = Math.round((1 - weightSpread) * 60 + sizeBoost * 40)

  return {
    consensusPct,
    rawAgreePct,
    status,
    effectiveVoters: unique.length,
    flaggedSybil,
    confidence,
  }
}

/**
 * Voter trust score update — Bayesian-ish.
 * After a community report resolves, voters who agreed with majority gain trust, others lose.
 */
export function updateVoterTrust(currentScore: number, votedWithMajority: boolean): number {
  const delta = votedWithMajority ? 2 : -3
  return Math.max(0, Math.min(100, currentScore + delta))
}

/**
 * Trust badge tier from score.
 */
export function trustBadge(score: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (score >= 90) return 'Platinum'
  if (score >= 75) return 'Gold'
  if (score >= 55) return 'Silver'
  return 'Bronze'
}
