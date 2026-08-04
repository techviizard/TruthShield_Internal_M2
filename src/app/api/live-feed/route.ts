/**
 * Live Threat Feed source - real recent threats from DB.
 * Returns AnalysisReports + Alerts merged & sorted with platform/region/severity inferred.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractRegion, fallbackRegion } from '@/lib/engines/region-extractor'
import { appConfig } from '@/config/app.config'

type ThreatType = 'Deepfake' | 'Misinformation' | 'Manipulation' | 'Phishing'
type Severity = 'critical' | 'high' | 'medium' | 'low'
type Platform = 'WhatsApp' | 'Twitter/X' | 'Facebook' | 'Instagram' | 'Telegram'

const PLATFORMS: Platform[] = ['WhatsApp', 'Twitter/X', 'Facebook', 'Instagram', 'Telegram']

function inferType(analysisType: string, flags: string | null): ThreatType {
  if (analysisType === 'video_deepfake') return 'Deepfake'
  if (analysisType === 'image_forensics') {
    if (flags && /ai_generated|synthetic|deepfake/i.test(flags)) return 'Deepfake'
    return 'Manipulation'
  }
  if (analysisType === 'text_fake_news') {
    if (flags && /phishing|scam/i.test(flags)) return 'Phishing'
    return 'Misinformation'
  }
  return 'Misinformation'
}

function inferPlatform(seed: string, metaPlatform?: string): Platform {
  if (metaPlatform && PLATFORMS.includes(metaPlatform as Platform)) return metaPlatform as Platform
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return PLATFORMS[Math.abs(h) % PLATFORMS.length]
}

function relTime(d: Date): string {
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(
      req.nextUrl.searchParams.get('limit') ?? String(appConfig.limits.liveFeedLimit),
      10,
    )
    const reports = await db.analysisReport.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: { riskLevel: { in: ['medium', 'high', 'critical'] } },
      select: {
        id: true,
        analysisType: true,
        riskLevel: true,
        confidence: true,
        explanation: true,
        flags: true,
        createdAt: true,
        mediaUpload: { select: { fileName: true, metadata: true } },
      },
    })

    const threats = reports.map((r) => {
      let meta: { region?: string; platform?: string } = {}
      try {
        meta = r.mediaUpload?.metadata ? JSON.parse(r.mediaUpload.metadata) : {}
      } catch {}
      const region =
        extractRegion(meta.region, r.explanation, r.mediaUpload?.fileName) ?? fallbackRegion(r.id)
      const severity = (r.riskLevel as Severity) ?? 'medium'
      const type = inferType(r.analysisType, r.flags)
      const platform = inferPlatform(r.id, meta.platform)
      const confidence = Math.round(((r.confidence ?? 0.7) <= 1 ? (r.confidence ?? 0.7) * 100 : r.confidence ?? 70))
      const title = (r.explanation ?? `${type} flagged on ${platform}`).split(/[.\n]/)[0].slice(0, 120)
      return {
        id: r.id,
        type,
        severity,
        title,
        description: r.explanation ?? `${type} detected. Region: ${region}. Platform: ${platform}.`,
        platform,
        region,
        confidence,
        timestamp: relTime(r.createdAt),
        createdAt: r.createdAt.toISOString(),
        sourceUrl: `/api/analysis/${r.id}`,
      }
    })

    return NextResponse.json({ success: true, threats })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
