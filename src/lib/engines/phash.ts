/**
 * Perceptual hash (dHash 64-bit) and Hamming distance.
 * Used by Media Compare similarity + Provenance graph.
 * Pure sharp (already in deps) - no external service.
 */

import sharp from 'sharp'

/**
 * 8x8 dHash. Resize to 9x8 grayscale, compare horizontal adjacent pixels.
 * Returns 64-bit hex string (16 chars).
 */
export async function dHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let bits = ''
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x]
      const right = data[y * 9 + x + 1]
      bits += left < right ? '1' : '0'
    }
  }
  // 64 bits -> 16 hex
  let hex = ''
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

/**
 * Average hash (aHash) - robust to color/brightness shifts.
 */
export async function aHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .grayscale()
    .resize(8, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const avg = data.reduce((s, v) => s + v, 0) / 64
  let bits = ''
  for (let i = 0; i < 64; i++) bits += data[i] > avg ? '1' : '0'
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

/**
 * Hamming distance between two equal-length hex hashes.
 * 0 = identical, 64 = total opposite.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64
  let d = 0
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    d += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1)
  }
  return d
}

/**
 * Similarity 0-100 derived from Hamming distance over 64 bits.
 */
export function similarityPct(a: string, b: string): number {
  return Math.round(((64 - hammingDistance(a, b)) / 64) * 100)
}
