/**
 * DBSCAN-lite clustering over TF-IDF cosine similarity.
 * Drives Campaign Detection: groups highly-similar reports as coordinated activity.
 */

import { cosineSim, tfidfCorpus, tokenize } from './tfidf'

export interface ClusterMember {
  id: string
  similarity: number
}

export interface Cluster {
  id: number
  centroidTerms: string[]   // top terms for label
  members: ClusterMember[]
  severity: 'critical' | 'high' | 'medium' | 'low'
  firstSeen: Date
  lastSeen: Date
}

interface InputDoc {
  id: string
  text: string
  createdAt: Date
}

/**
 * DBSCAN with cosine similarity. eps = min cosine for neighbor, minPts = cluster threshold.
 */
export function clusterDocuments(docs: InputDoc[], eps = 0.35, minPts = 3): Cluster[] {
  if (docs.length === 0) return []
  const texts = docs.map((d) => d.text)
  const { vectors } = tfidfCorpus(texts)

  const visited = new Array(docs.length).fill(false)
  const clusterId = new Array(docs.length).fill(-1)
  let nextId = 0

  const neighbors = (i: number): number[] => {
    const out: number[] = []
    for (let j = 0; j < docs.length; j++) {
      if (j === i) continue
      if (cosineSim(vectors[i], vectors[j]) >= eps) out.push(j)
    }
    return out
  }

  for (let i = 0; i < docs.length; i++) {
    if (visited[i]) continue
    visited[i] = true
    const N = neighbors(i)
    if (N.length < minPts - 1) continue
    const cid = nextId++
    clusterId[i] = cid
    const queue = [...N]
    while (queue.length > 0) {
      const j = queue.shift()!
      if (!visited[j]) {
        visited[j] = true
        const Nj = neighbors(j)
        if (Nj.length >= minPts - 1) queue.push(...Nj)
      }
      if (clusterId[j] === -1) clusterId[j] = cid
    }
  }

  // Group + label
  const groups = new Map<number, number[]>()
  for (let i = 0; i < clusterId.length; i++) {
    if (clusterId[i] === -1) continue
    const arr = groups.get(clusterId[i]) ?? []
    arr.push(i)
    groups.set(clusterId[i], arr)
  }

  const clusters: Cluster[] = []
  for (const [cid, indexes] of groups) {
    const memberDocs = indexes.map((i) => docs[i])
    const allTokens = memberDocs.flatMap((d) => tokenize(d.text))
    const counts = new Map<string, number>()
    for (const t of allTokens) counts.set(t, (counts.get(t) ?? 0) + 1)
    const centroidTerms = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t)
    const dates = memberDocs.map((d) => d.createdAt.getTime())
    const size = indexes.length
    const severity: Cluster['severity'] =
      size >= 20 ? 'critical' : size >= 10 ? 'high' : size >= 5 ? 'medium' : 'low'

    // Compute member similarity to centroid (max vector)
    const centroidIdx = indexes[0]
    const members: ClusterMember[] = indexes.map((i) => ({
      id: docs[i].id,
      similarity: Math.round(cosineSim(vectors[centroidIdx], vectors[i]) * 100),
    }))

    clusters.push({
      id: cid,
      centroidTerms,
      members,
      severity,
      firstSeen: new Date(Math.min(...dates)),
      lastSeen: new Date(Math.max(...dates)),
    })
  }
  return clusters.sort((a, b) => b.members.length - a.members.length)
}
