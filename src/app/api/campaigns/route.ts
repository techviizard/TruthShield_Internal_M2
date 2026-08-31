/**
 * Campaign Detection: TF-IDF clustering over recent text/fact-check reports.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clusterDocuments } from '@/lib/engines/clustering'
import { extractRegion } from '@/lib/engines/region-extractor'
import { appConfig } from '@/config/app.config'

export async function GET() {
  try {
    const since = new Date(Date.now() - appConfig.analysis.campaignLookbackDays * 86400_000)
    const reports = await db.analysisReport.findMany({
      where: {
        createdAt: { gte: since },
        analysisType: { in: ['text_fake_news', 'fact_check'] },
        explanation: { not: null },
      },
      select: { id: true, explanation: true, createdAt: true, riskLevel: true, mediaUpload: { select: { fileName: true } } },
    })

    const docs = reports.map((r) => ({
      id: r.id,
      text: `${r.explanation ?? ''} ${r.mediaUpload?.fileName ?? ''}`,
      createdAt: r.createdAt,
    }))

    const clusters = clusterDocuments(
      docs,
      appConfig.analysis.campaignSimilarity,
      appConfig.analysis.campaignMinClusterSize,
    )

    // Augment with region distribution
    const enriched = clusters.map((c) => {
      const memberReports = c.members.map((m) => reports.find((r) => r.id === m.id)!).filter(Boolean)
      const regionCounts: Record<string, number> = {}
      for (const mr of memberReports) {
        const region = extractRegion(mr.explanation, mr.mediaUpload?.fileName) ?? 'Unknown'
        regionCounts[region] = (regionCounts[region] ?? 0) + 1
      }
      return {
        ...c,
        firstSeen: c.firstSeen.toISOString(),
        lastSeen: c.lastSeen.toISOString(),
        regionDistribution: regionCounts,
        memberCount: c.members.length,
      }
    })

    return NextResponse.json({ success: true, clusters: enriched, totalAnalyzed: docs.length })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
