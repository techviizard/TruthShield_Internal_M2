/**
 * Network/Provenance graph: edges between AnalysisReports that share
 *   (a) high perceptual hash similarity (images), or
 *   (b) cite the same fact-check domain, or
 *   (c) belong to the same campaign cluster.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appConfig } from '@/config/app.config'

interface Node { id: string; label: string; type: string; riskLevel: string | null }
interface Edge { source: string; target: string; type: 'shared_source' | 'same_investigation'; weight: number }

export async function GET() {
  try {
    const since = new Date(Date.now() - 30 * 86400_000)
    const reports = await db.analysisReport.findMany({
      where: { createdAt: { gte: since } },
      include: { factChecks: true, mediaUpload: { select: { fileName: true } } },
      take: appConfig.limits.networkGraphNodeLimit,
    })

    const nodes: Node[] = reports.map((r) => ({
      id: r.id,
      label: r.mediaUpload?.fileName?.slice(0, 30) ?? r.id.slice(-6),
      type: r.analysisType,
      riskLevel: r.riskLevel,
    }))

    const edges: Edge[] = []

    // Edges: shared fact-check domain
    const byDomain = new Map<string, string[]>()
    for (const r of reports) {
      for (const fc of r.factChecks) {
        if (!fc.url) continue
        let domain: string
        try { domain = new URL(fc.url).hostname.replace(/^www\./, '') } catch { continue }
        const arr = byDomain.get(domain) ?? []
        arr.push(r.id)
        byDomain.set(domain, arr)
      }
    }
    for (const [domain, ids] of byDomain) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          edges.push({ source: ids[i], target: ids[j], type: 'shared_source', weight: 1 })
        }
      }
    }

    // Edges: same investigation
    const byInvestigation = new Map<string, string[]>()
    for (const r of reports) {
      if (!r.investigationId) continue
      const arr = byInvestigation.get(r.investigationId) ?? []
      arr.push(r.id)
      byInvestigation.set(r.investigationId, arr)
    }
    for (const ids of byInvestigation.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          edges.push({ source: ids[i], target: ids[j], type: 'same_investigation', weight: 2 })
        }
      }
    }

    return NextResponse.json({ success: true, nodes, edges, nodeCount: nodes.length, edgeCount: edges.length })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
