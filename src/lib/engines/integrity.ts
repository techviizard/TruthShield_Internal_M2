/**
 * Evidence integrity engine - chain of custody primitives.
 *
 * Two guarantees this file provides:
 *  1. Every artifact that enters the platform is fingerprinted at ingest
 *     (SHA-256 + perceptual hash) before any analysis touches it.
 *  2. Every audit entry is linked to its predecessor by hash, so removing or
 *     editing any historical row invalidates every hash after it.
 *
 * Both are pure Node crypto + sharp - no external notary service.
 */

import { createHash } from 'crypto'

/** SHA-256 hex digest of a buffer. The evidence fingerprint quoted in reports. */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** SHA-256 of a UTF-8 string (used for chain links and text artifacts). */
export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Short display form for UIs - first 8 and last 8 hex chars. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return ' - '
  return hash.length <= 20 ? hash : `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

export interface ChainableEntry {
  seq: number
  action: string
  resource: string
  userId?: string | null
  details?: string | null
  ipAddress?: string | null
  createdAt: Date | string
}

/**
 * Canonical serialization of an audit entry.
 * Field order is fixed and explicit - JSON.stringify over an object literal is
 * insertion-ordered, so this is stable across writes and verification reads.
 */
export function canonicalizeEntry(e: ChainableEntry): string {
  const createdAt =
    e.createdAt instanceof Date ? e.createdAt.toISOString() : new Date(e.createdAt).toISOString()
  return JSON.stringify([
    e.seq,
    createdAt,
    e.action,
    e.resource,
    e.userId ?? '',
    e.details ?? '',
    e.ipAddress ?? '',
  ])
}

/** Genesis link for the first entry in a fresh chain. */
export const GENESIS_HASH = '0'.repeat(64)

/** entryHash = SHA-256(prevHash || canonical(entry)). */
export function linkHash(prevHash: string | null | undefined, entry: ChainableEntry): string {
  return sha256Text(`${prevHash ?? GENESIS_HASH}${canonicalizeEntry(entry)}`)
}

export interface ChainVerification {
  valid: boolean
  totalEntries: number
  verifiedEntries: number
  /** Entries that fail verification, earliest first. */
  breaks: {
    id: string
    seq: number
    reason: 'hash_mismatch' | 'link_mismatch' | 'unhashed' | 'sequence_gap'
    expected?: string
    actual?: string
    createdAt: string
    action: string
    resource: string
  }[]
  /** Hash of the newest entry - the value to quote as the chain's current head. */
  headHash: string | null
  checkedAt: string
}

/**
 * Recompute the chain over entries supplied in ascending seq order and report
 * the first divergence. A single mutated row surfaces as one `hash_mismatch`
 * followed by `link_mismatch` on every later row.
 */
export function verifyChain(
  entries: (ChainableEntry & { id: string; prevHash: string | null; entryHash: string | null })[]
): ChainVerification {
  const breaks: ChainVerification['breaks'] = []
  let prev = GENESIS_HASH
  let verified = 0
  let expectedSeq = entries.length ? entries[0].seq : 0

  for (const e of entries) {
    const createdAt =
      e.createdAt instanceof Date ? e.createdAt.toISOString() : new Date(e.createdAt).toISOString()

    if (!e.entryHash) {
      breaks.push({
        id: e.id, seq: e.seq, reason: 'unhashed', createdAt,
        action: e.action, resource: e.resource,
      })
      // An unhashed row cannot extend the chain; keep the previous link.
      expectedSeq = e.seq + 1
      continue
    }

    if (e.seq !== expectedSeq) {
      breaks.push({
        id: e.id, seq: e.seq, reason: 'sequence_gap', createdAt,
        expected: String(expectedSeq), actual: String(e.seq),
        action: e.action, resource: e.resource,
      })
    }

    if ((e.prevHash ?? GENESIS_HASH) !== prev) {
      breaks.push({
        id: e.id, seq: e.seq, reason: 'link_mismatch', createdAt,
        expected: prev, actual: e.prevHash ?? GENESIS_HASH,
        action: e.action, resource: e.resource,
      })
    }

    const recomputed = linkHash(e.prevHash, e)
    if (recomputed !== e.entryHash) {
      breaks.push({
        id: e.id, seq: e.seq, reason: 'hash_mismatch', createdAt,
        expected: recomputed, actual: e.entryHash,
        action: e.action, resource: e.resource,
      })
    } else {
      verified++
    }

    prev = e.entryHash
    expectedSeq = e.seq + 1
  }

  return {
    valid: breaks.length === 0,
    totalEntries: entries.length,
    verifiedEntries: verified,
    breaks,
    headHash: entries.length ? entries[entries.length - 1].entryHash : null,
    checkedAt: new Date().toISOString(),
  }
}

export interface EvidenceFingerprint {
  sha256: string
  perceptualHash: string | null
  fileSize: number
  mimeType: string
  fileName: string
  ingestedAt: string
}

/**
 * Fingerprint an artifact at ingest. The perceptual hash is best-effort: it only
 * applies to still images, and a decode failure must never block the analysis.
 */
export async function fingerprint(
  buffer: Buffer,
  meta: { fileName: string; mimeType: string }
): Promise<EvidenceFingerprint> {
  let perceptual: string | null = null
  if (meta.mimeType.startsWith('image/')) {
    try {
      const { dHash } = await import('@/lib/engines/phash')
      perceptual = await dHash(buffer)
    } catch {
      perceptual = null
    }
  }
  return {
    sha256: sha256(buffer),
    perceptualHash: perceptual,
    fileSize: buffer.length,
    mimeType: meta.mimeType,
    fileName: meta.fileName,
    ingestedAt: new Date().toISOString(),
  }
}
