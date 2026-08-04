/**
 * Dashboard data aggregator.
 * Computes real metrics from AnalysisReport, Alert, MediaUpload tables.
 * All derived — no caching table needed at this scale.
 */

import { db } from '@/lib/db'
import { extractRegion, fallbackRegion, REGION_DICT, regionToPoint } from './region-extractor'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface ThreatRegionStats {
  city: string
  lat: number
  lng: number
  x: number
  y: number
  threats: number
  severity: Severity
  topThreat: string
  trend: string
}

export interface ModelPerf {
  detectionAccuracy: number      // % of reports with riskLevel != 'low'
  falsePositiveRate: number      // % of analyses overridden/disputed (closed investigations / total)
  avgProcessingMs: number        // mean processingTime
  avgConfidence: number          // mean confidence * 100
  totalSamples: number
}

export interface TickerEvent {
  text: string
  type: Severity | 'info'
  icon: string
  timestamp: Date
}

const RANGE_MS: Record<'24h' | '7d' | '30d', number> = {
  '24h': 24 * 3600_000,
  '7d': 7 * 86400_000,
  '30d': 30 * 86400_000,
}

const TOP_THREAT_BY_TYPE: Record<string, string> = {
  text_fake_news: 'Misinformation text',
  image_forensics: 'Manipulated images',
  video_deepfake: 'Deepfake videos',
  fact_check: 'Disputed claims',
}

function severityFromAvgTrust(avg: number): Severity {
  if (avg < 25) return 'critical'
  if (avg < 45) return 'high'
  if (avg < 65) return 'medium'
  return 'low'
}

/**
 * Real threat-map data per Indian city for the given time range.
 * Derives city from MediaUpload.metadata (JSON) + AnalysisReport.explanation text scan.
 * If no detectable region, uses deterministic hash fallback to avoid Delhi-only clumping.
 */
export async function getThreatRegionStats(range: '24h' | '7d' | '30d' = '30d'): Promise<ThreatRegionStats[]> {
  const since = new Date(Date.now() - RANGE_MS[range])
  const prevSince = new Date(Date.now() - 2 * RANGE_MS[range])

  const [current, previous] = await Promise.all([
    db.analysisReport.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        analysisType: true,
        trustScore: true,
        riskLevel: true,
        explanation: true,
        mediaUpload: { select: { fileName: true, metadata: true } },
      },
    }),
    db.analysisReport.findMany({
      where: { createdAt: { gte: prevSince, lt: since } },
      select: { id: true, mediaUpload: { select: { fileName: true, metadata: true } }, explanation: true },
    }),
  ])

  const bucket = new Map<string, { count: number; trustSum: number; types: Record<string, number> }>()
  const prevBucket = new Map<string, number>()

  for (const r of current) {
    const meta = parseMeta(r.mediaUpload?.metadata)
    const city =
      extractRegion(meta.region, r.explanation, r.mediaUpload?.fileName) ??
      fallbackRegion(r.id)
    const b = bucket.get(city) ?? { count: 0, trustSum: 0, types: {} }
    b.count += 1
    b.trustSum += r.trustScore ?? 50
    b.types[r.analysisType] = (b.types[r.analysisType] ?? 0) + 1
    bucket.set(city, b)
  }
  for (const r of previous) {
    const meta = parseMeta(r.mediaUpload?.metadata)
    const city =
      extractRegion(meta.region, r.explanation, r.mediaUpload?.fileName) ??
      fallbackRegion(r.id)
    prevBucket.set(city, (prevBucket.get(city) ?? 0) + 1)
  }

  return REGION_DICT.map((p) => {
    const b = bucket.get(p.city)
    const prev = prevBucket.get(p.city) ?? 0
    const count = b?.count ?? 0
    const avgTrust = b && b.count ? b.trustSum / b.count : 100
    const topType = b
      ? Object.entries(b.types).sort((a, c) => c[1] - a[1])[0]?.[0]
      : null
    const delta = prev === 0 ? (count > 0 ? 100 : 0) : ((count - prev) / prev) * 100
    return {
      city: p.city,
      lat: p.lat,
      lng: p.lng,
      x: p.x,
      y: p.y,
      threats: count,
      severity: severityFromAvgTrust(avgTrust),
      topThreat: topType ? TOP_THREAT_BY_TYPE[topType] ?? topType : 'No activity',
      trend: `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`,
    }
  })
}

function parseMeta(raw: string | null | undefined): { region?: string; platform?: string; language?: string } {
  if (!raw) return {}
  try {
    const o = JSON.parse(raw)
    return { region: o.region, platform: o.platform, language: o.language }
  } catch {
    return {}
  }
}

/**
 * Real model performance from AnalysisReport aggregates.
 * - detectionAccuracy: high+critical reports / total flagged
 * - falsePositiveRate: investigations closed without escalation / total reports w/ investigations
 * - avgProcessingMs: arithmetic mean
 * - avgConfidence: mean confidence
 */
export async function getModelPerformance(): Promise<ModelPerf> {
  const [total, flaggedHighCrit, totalWithInvestigation, closedInvestigation, agg] = await Promise.all([
    db.analysisReport.count(),
    db.analysisReport.count({ where: { riskLevel: { in: ['high', 'critical'] } } }),
    db.analysisReport.count({ where: { investigationId: { not: null } } }),
    db.analysisReport.count({
      where: {
        investigationId: { not: null },
        investigation: { status: 'closed' },
      },
    }),
    db.analysisReport.aggregate({
      _avg: { processingTime: true, confidence: true },
    }),
  ])

  const detectionAccuracy = total === 0 ? 0 : (flaggedHighCrit / total) * 100
  const falsePositiveRate =
    totalWithInvestigation === 0 ? 0 : (closedInvestigation / totalWithInvestigation) * 100
  const avgProcessingMs = agg._avg.processingTime ?? 0
  const avgConfidence = (agg._avg.confidence ?? 0) * 100

  return {
    detectionAccuracy: Math.round(detectionAccuracy * 10) / 10,
    falsePositiveRate: Math.round(falsePositiveRate * 10) / 10,
    avgProcessingMs: Math.round(avgProcessingMs),
    avgConfidence: Math.round(avgConfidence * 10) / 10,
    totalSamples: total,
  }
}

/**
 * Per-type sparkline series: counts per day for last 7 days.
 * Returns map of metric key → 7-int array.
 */
export async function getSparklines() {
  const dayMs = 86400_000
  // Calendar-day buckets (local midnight) so the current day is a full bucket
  // rather than a zero-width window at "now".
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => new Date(startOfToday.getTime() - (6 - i) * dayMs))

  const rows = await db.analysisReport.findMany({
    where: { createdAt: { gte: days[0] } },
    select: { createdAt: true, analysisType: true, riskLevel: true, trustScore: true },
  })

  const alerts = await db.alert.findMany({
    where: { createdAt: { gte: days[0] } },
    select: { createdAt: true, isRead: true },
  })

  const buckets = days.map(() => ({
    total: 0,
    fakeNews: 0,
    deepfakes: 0,
    images: 0,
    trustSum: 0,
    trustN: 0,
    alerts: 0,
  }))

  const dayIdx = (d: Date) => Math.min(6, Math.max(0, Math.floor((d.getTime() - days[0].getTime()) / dayMs)))


  for (const r of rows) {
    const i = dayIdx(r.createdAt)
    const b = buckets[i]
    b.total++
    if (r.analysisType === 'text_fake_news' && (r.riskLevel === 'high' || r.riskLevel === 'critical')) b.fakeNews++
    if (r.analysisType === 'video_deepfake' && (r.riskLevel === 'high' || r.riskLevel === 'critical')) b.deepfakes++
    if (r.analysisType === 'image_forensics') b.images++
    if (r.trustScore != null) {
      b.trustSum += r.trustScore
      b.trustN++
    }
  }
  for (const a of alerts) {
    const i = dayIdx(a.createdAt)
    if (!a.isRead) buckets[i].alerts++
  }

  return {
    totalAnalyses: buckets.map((b) => b.total),
    fakeNewsDetected: buckets.map((b) => b.fakeNews),
    deepfakesDetected: buckets.map((b) => b.deepfakes),
    imagesAnalyzed: buckets.map((b) => b.images),
    avgTrustScore: buckets.map((b) => (b.trustN ? Math.round(b.trustSum / b.trustN) : 0)),
    activeAlerts: buckets.map((b) => b.alerts),
  }
}

/**
 * Live ticker: most recent 8 events.
 * Mixes analyses + alerts ordered by recency.
 */
export async function getTicker(limit = 8): Promise<TickerEvent[]> {
  const [reports, alerts] = await Promise.all([
    db.analysisReport.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        analysisType: true,
        riskLevel: true,
        explanation: true,
        createdAt: true,
        mediaUpload: { select: { fileName: true, metadata: true } },
      },
    }),
    db.alert.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { title: true, severity: true, createdAt: true },
    }),
  ])

  const events: TickerEvent[] = []

  for (const r of reports) {
    const region = extractRegion(parseMeta(r.mediaUpload?.metadata).region, r.explanation, r.mediaUpload?.fileName)
    const sev = (r.riskLevel as Severity) ?? 'low'
    const typeLabel =
      r.analysisType === 'text_fake_news' ? 'Fake news flagged' :
      r.analysisType === 'image_forensics' ? 'Image manipulation found' :
      r.analysisType === 'video_deepfake' ? 'Deepfake video detected' :
      r.analysisType === 'fact_check' ? 'Fact check completed' :
      'Analysis completed'
    events.push({
      text: region ? `${typeLabel} — ${region} region` : typeLabel,
      type: sev,
      icon: sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🟡' : sev === 'low' ? '🟢' : '🔵',
      timestamp: r.createdAt,
    })
  }
  for (const a of alerts) {
    const sev = (
      a.severity === 'critical' ? 'critical' :
      a.severity === 'error' ? 'high' :
      a.severity === 'warning' ? 'medium' :
      'info'
    ) as Severity | 'info'
    events.push({
      text: a.title,
      type: sev,
      icon: sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🟡' : '🔵',
      timestamp: a.createdAt,
    })
  }

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

/**
 * Language breakdown for Multilingual Insights card.
 * Derives from MediaUpload.metadata.language; falls back to script detection on filename.
 */
export async function getLanguageDistribution() {
  const reports = await db.analysisReport.findMany({
    select: { mediaUpload: { select: { metadata: true, fileName: true } }, explanation: true },
  })

  const counts: Record<string, number> = {}
  for (const r of reports) {
    const m = parseMeta(r.mediaUpload?.metadata)
    let lang = m.language ?? detectScript(r.explanation ?? r.mediaUpload?.fileName ?? '')
    if (!lang) lang = 'en'
    counts[lang] = (counts[lang] ?? 0) + 1
  }
  const codeToLabel: Record<string, string> = {
    en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali',
    mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([code, count]) => ({
      language: codeToLabel[code] ?? code,
      code,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
}

function detectScript(s: string): string | null {
  if (/[ऀ-ॿ]/.test(s)) return 'hi'        // Devanagari (Hindi/Marathi)
  if (/[஀-௿]/.test(s)) return 'ta'        // Tamil
  if (/[ఀ-౿]/.test(s)) return 'te'        // Telugu
  if (/[ঀ-৿]/.test(s)) return 'bn'        // Bengali
  if (/[઀-૿]/.test(s)) return 'gu'        // Gujarati
  if (/[ಀ-೿]/.test(s)) return 'kn'        // Kannada
  if (/[ഀ-ൿ]/.test(s)) return 'ml'        // Malayalam
  if (/[਀-੿]/.test(s)) return 'pa'        // Gurmukhi
  return null
}

/**
 * Trust score histogram across all reports (10 buckets 0..100).
 */
export async function getTrustHistogram() {
  const reports = await db.analysisReport.findMany({
    where: { trustScore: { not: null } },
    select: { trustScore: true },
  })
  const buckets = Array.from({ length: 10 }, () => 0)
  for (const r of reports) {
    const v = r.trustScore ?? 0
    const idx = Math.min(9, Math.floor(v / 10))
    buckets[idx]++
  }
  return buckets.map((count, i) => ({
    range: `${i * 10 + (i === 0 ? 0 : 1)}-${(i + 1) * 10}`,
    count,
  }))
}
