/**
 * Community reports + sybil-resistant voting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeConsensus, type Vote } from '@/lib/engines/sybil-trust'
import { recordAudit, clientIp } from '@/lib/engines/audit-logger'
import crypto from 'node:crypto'

function fingerprint(req: NextRequest): string {
  const ip = clientIp(req) ?? 'anon'
  const ua = req.headers.get('user-agent') ?? ''
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 16)
}

export async function GET(req: NextRequest) {
  try {
    const reports = await db.communityReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { votes: true },
    })
    // Submitter reputation - derived from the consensus their past reports reached.
    const bySubmitter = new Map<string, { sum: number; n: number }>()
    for (const r of reports) {
      const b = bySubmitter.get(r.submitterName) ?? { sum: 0, n: 0 }
      b.sum += r.consensusScore
      b.n += 1
      bySubmitter.set(r.submitterName, b)
    }
    const trustFor = (name: string): number => {
      const b = bySubmitter.get(name)
      if (!b || b.n === 0) return 50
      return Math.round(b.sum / b.n)
    }
    const badgeFor = (trust: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' =>
      trust >= 90 ? 'Platinum' : trust >= 75 ? 'Gold' : trust >= 60 ? 'Silver' : 'Bronze'

    const enriched = reports.map((r) => {
      const votes: Vote[] = r.votes.map((v) => ({
        voterFingerprint: v.voterFingerprint,
        vote: v.vote as 'agree' | 'disagree',
        voterTrustScore: v.voterTrustScore,
        createdAt: v.createdAt,
      }))
      const c = computeConsensus(votes)
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        mediaType: r.mediaType,
        submitterName: r.submitterName,
        submitterTrustScore: trustFor(r.submitterName),
        submitterBadge: badgeFor(trustFor(r.submitterName)),
        tags: r.tags ? safeJson(r.tags, []) : [],
        agreeVotes: votes.filter((v) => v.vote === 'agree').length,
        disagreeVotes: votes.filter((v) => v.vote === 'disagree').length,
        ...c,
        timestamp: r.createdAt.toISOString(),
      }
    })
    // ── Community stats + leaderboard (all derived from stored reports) ──
    const allReports = await db.communityReport.findMany({
      select: { submitterName: true, status: true, consensusScore: true, createdAt: true },
    })

    const rangeParam = (req.nextUrl.searchParams.get('range') ?? 'all') as 'week' | 'month' | 'all'
    const rangeMs = rangeParam === 'week' ? 7 * 86_400_000 : rangeParam === 'month' ? 30 * 86_400_000 : Infinity
    const cutoff = rangeMs === Infinity ? new Date(0) : new Date(Date.now() - rangeMs)

    const inRange = allReports.filter((r) => r.createdAt >= cutoff)
    const perSubmitter = new Map<string, { contributions: number; trustSum: number }>()
    for (const r of inRange) {
      const cur = perSubmitter.get(r.submitterName) ?? { contributions: 0, trustSum: 0 }
      cur.contributions += 1
      cur.trustSum += r.consensusScore
      perSubmitter.set(r.submitterName, cur)
    }

    const leaderboard = Array.from(perSubmitter.entries())
      .map(([name, v]) => ({
        name,
        contributions: v.contributions,
        trustScore: Math.round(v.trustSum / Math.max(1, v.contributions)),
      }))
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 10)
      .map((row, i) => ({ ...row, rank: i + 1 }))

    const verified = allReports.filter((r) => r.status === 'verified').length
    const meanConsensus = allReports.length
      ? allReports.reduce((sum, r) => sum + r.consensusScore, 0) / allReports.length
      : 0

    return NextResponse.json({
      success: true,
      reports: enriched,
      range: rangeParam,
      stats: {
        totalContributors: new Set(allReports.map((r) => r.submitterName)).size,
        reportsFiled: allReports.length,
        verifiedClaims: verified,
        communityTrust: Math.round(meanConsensus * 10) / 10,
      },
      leaderboard,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const r = await db.communityReport.create({
      data: {
        title: body.title,
        description: body.description,
        mediaType: body.mediaType ?? 'text',
        submitterName: body.submitterName ?? 'Anonymous',
        tags: body.tags ? JSON.stringify(body.tags) : null,
      },
    })
    await recordAudit({
      action: 'investigation_created',
      resource: `Community Report #${r.id.slice(-6).toUpperCase()}`,
      ipAddress: clientIp(req),
      details: { reportId: r.id, summary: `Community report submitted: ${r.title}` },
    })
    return NextResponse.json({ success: true, report: r })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

function safeJson<T>(s: string, fb: T): T {
  try { return JSON.parse(s) as T } catch { return fb }
}
