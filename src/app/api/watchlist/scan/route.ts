/**
 * Scan recent analyses for watchlist keyword matches → write WatchlistHit rows.
 * Designed to be called on schedule or after analysis completion.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const items = await db.watchlistItem.findMany({ where: { isActive: true } })
    if (items.length === 0) return NextResponse.json({ success: true, hits: 0 })

    const since = new Date(Date.now() - 24 * 3600_000)
    const reports = await db.analysisReport.findMany({
      where: { createdAt: { gte: since }, explanation: { not: null } },
      select: { id: true, explanation: true, mediaUpload: { select: { fileName: true } } },
    })

    let totalHits = 0
    const itemHits: Record<string, number> = {}
    for (const item of items) {
      const needle = item.keyword.toLowerCase()
      for (const r of reports) {
        const hay = `${r.explanation ?? ''} ${r.mediaUpload?.fileName ?? ''}`.toLowerCase()
        if (hay.includes(needle)) {
          const existing = await db.watchlistHit.findFirst({
            where: { watchlistItemId: item.id, analysisReportId: r.id },
          })
          if (!existing) {
            await db.watchlistHit.create({
              data: {
                watchlistItemId: item.id,
                analysisReportId: r.id,
                matchedText: item.keyword,
                context: (r.explanation ?? '').slice(0, 200),
              },
            })
            totalHits++
            itemHits[item.id] = (itemHits[item.id] ?? 0) + 1
          }
        }
      }
    }
    for (const [id, count] of Object.entries(itemHits)) {
      await db.watchlistItem.update({
        where: { id },
        data: { hitCount: { increment: count }, lastHitAt: new Date() },
      })
    }
    return NextResponse.json({ success: true, hits: totalHits, perItem: itemHits })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
