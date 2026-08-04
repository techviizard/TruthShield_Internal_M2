/**
 * TF-IDF + cosine similarity + MinHash signatures.
 * Used by Campaign Detection clustering and Network Analysis provenance.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them',
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'how', 'what', 'why', 'which',
  'in', 'on', 'at', 'to', 'from', 'with', 'by', 'for', 'of', 'as', 'about', 'into', 'through',
  'over', 'under', 'again', 'further', 'once', 'here', 'there', 'all', 'any', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  return tf
}

/**
 * Compute TF-IDF vectors for a corpus of documents.
 */
export function tfidfCorpus(docs: string[]): { vectors: Map<string, number>[]; vocab: string[] } {
  const tokenized = docs.map(tokenize)
  const tfs = tokenized.map(termFrequency)
  const docCount = docs.length
  const df = new Map<string, number>()
  for (const tf of tfs) {
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const vocab = Array.from(df.keys())
  const vectors = tfs.map((tf) => {
    const v = new Map<string, number>()
    for (const [term, count] of tf) {
      const idf = Math.log(docCount / (df.get(term) ?? 1))
      v.set(term, count * idf)
    }
    return v
  })
  return { vectors, vocab }
}

/**
 * Cosine similarity between two sparse TF-IDF vectors.
 */
export function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0
  for (const [t, w] of a) {
    na += w * w
    if (b.has(t)) dot += w * b.get(t)!
  }
  for (const w of b.values()) nb += w * w
  if (na === 0 || nb === 0) return 0
  return dot / Math.sqrt(na * nb)
}

/**
 * MinHash signature for fast near-duplicate detection.
 * 64 hash functions over a token set.
 */
export function minHashSignature(tokens: string[], k = 64): number[] {
  const sig = Array(k).fill(Number.MAX_SAFE_INTEGER)
  for (const t of tokens) {
    const base = hash32(t)
    for (let i = 0; i < k; i++) {
      const h = (base * 2654435761 + i * 0x9e3779b9) >>> 0
      if (h < sig[i]) sig[i] = h
    }
  }
  return sig
}

export function minHashSimilarity(a: number[], b: number[]): number {
  let same = 0
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++
  return same / a.length
}

function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
