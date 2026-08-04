/**
 * GET /api/system/latency
 *
 * Real request-latency series for the System Health tab: mean processing time
 * per hour over the last 24 hours, split by analysis type, plus the failed
 * analyses that act as the platform's error log. All values come from stored
 * AnalysisReport rows — nothing synthetic.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BUCKETS = 24

export async function GET() {
  try {
    const since = new Date(Date.now() - BUCKETS * 3600_000)

    const rows = await db.analysisReport.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, analysisType: true, processingTime: true, status: true },
    })

    const series = Array.from({ length: BUCKETS }, (_, i) => {
      const slotStart = new Date(since.getTime() + i * 3600_000)
      return {
        hour: `${String(slotStart.getHours()).padStart(2, '0')}:00`,
        analyze: 0,
        factcheck: 0,
        other: 0,
        count: 0,
      }
    })

    const sums = series.map(() => ({ analyze: [0, 0], factcheck: [0, 0], other: [0, 0] }))

    for (const r of rows) {
      const idx = Math.min(
        BUCKETS - 1,
        Math.max(0, Math.floor((r.createdAt.getTime() - since.getTime()) / 3600_000)),
      )
      const key =
        r.analysisType === 'fact_check'
          ? 'factcheck'
          : r.analysisType === 'text_fake_news' || r.analysisType === 'image_forensics' || r.analysisType === 'video_deepfake'
            ? 'analyze'
            : 'other'
      sums[idx][key][0] += r.processingTime ?? 0
      sums[idx][key][1] += 1
      series[idx].count += 1
    }

    for (let i = 0; i < BUCKETS; i++) {
      for (const key of ['analyze', 'factcheck', 'other'] as const) {
        const [sum, n] = sums[i][key]
        series[i][key] = n ? Math.round(sum / n) : 0
      }
    }

    const failures = await db.analysisReport.findMany({
      where: { status: { in: ['failed', 'error'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        analysisType: true,
        explanation: true,
        createdAt: true,
        mediaUpload: { select: { fileName: true } },
      },
    })

    return NextResponse.json({
      success: true,
      series,
      failures: failures.map((f) => ({
        id: f.id,
        endpoint: `/api/analyze/${f.analysisType.split('_')[0]}`,
        analysisType: f.analysisType,
        description: f.explanation ?? `Analysis failed for ${f.mediaUpload?.fileName ?? 'unknown file'}`,
        createdAt: f.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic'
