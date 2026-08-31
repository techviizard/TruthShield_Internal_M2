import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeConsensus, type Vote } from '@/lib/engines/sybil-trust'
import crypto from 'node:crypto'

function fingerprint(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  const ip = xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip') ?? 'anon'
  const ua = req.headers.get('user-agent') ?? ''
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 16)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reportId, vote, voterTrustScore } = body
    if (!reportId || !['agree', 'disagree'].includes(vote)) {
      return NextResponse.json({ error: 'reportId + vote (agree|disagree) required' }, { status: 400 })
    }
    const fp = fingerprint(req)
    await db.communityVote.upsert({
      where: { reportId_voterFingerprint: { reportId, voterFingerprint: fp } },
      update: { vote, voterTrustScore: voterTrustScore ?? 50 },
      create: { reportId, voterFingerprint: fp, vote, voterTrustScore: voterTrustScore ?? 50 },
    })

    // Recompute consensus
    const votes = await db.communityVote.findMany({ where: { reportId } })
    const mapped: Vote[] = votes.map((v) => ({
      voterFingerprint: v.voterFingerprint,
      vote: v.vote as 'agree' | 'disagree',
      voterTrustScore: v.voterTrustScore,
      createdAt: v.createdAt,
    }))
    const c = computeConsensus(mapped)
    await db.communityReport.update({
      where: { id: reportId },
      data: {
        status: c.status,
        consensusScore: c.consensusPct,
        effectiveVoters: c.effectiveVoters,
        flaggedSybil: c.flaggedSybil,
        confidence: c.confidence,
      },
    })
    return NextResponse.json({ success: true, ...c })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
