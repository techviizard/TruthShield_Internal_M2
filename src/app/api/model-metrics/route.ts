/**
 * Real model metrics over the AnalysisReport table.
 * Compares analysisType variants (text vs image vs video vs fact_check) - actual A/B-ish data.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface Variant {
  type: string
  totalRuns: number
  avgProcessingMs: number
  avgConfidence: number
  highRiskRate: number
  trustScoreP50: number
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor((sorted.length - 1) * p)
  return sorted[idx]
}

export async function GET() {
  try {
    const types = ['text_fake_news', 'image_forensics', 'video_deepfake', 'fact_check', 'audio_deepfake']
    const variants: Variant[] = []
    for (const t of types) {
      const rows = await db.analysisReport.findMany({
        where: { analysisType: t },
        select: { trustScore: true, riskLevel: true, processingTime: true, confidence: true },
      })
      if (rows.length === 0) continue
      const procTimes = rows.map((r) => r.processingTime ?? 0)
      const conf = rows.map((r) => r.confidence ?? 0)
      const trust = rows.map((r) => r.trustScore ?? 0)
      const highRisk = rows.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical').length
      variants.push({
        type: t,
        totalRuns: rows.length,
        avgProcessingMs: Math.round(procTimes.reduce((a, b) => a + b, 0) / procTimes.length),
        avgConfidence: Math.round((conf.reduce((a, b) => a + b, 0) / conf.length) * 100) / 100,
        highRiskRate: Math.round((highRisk / rows.length) * 1000) / 10,
        trustScoreP50: Math.round(percentile(trust, 0.5)),
      })
    }
    return NextResponse.json({ success: true, variants })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
