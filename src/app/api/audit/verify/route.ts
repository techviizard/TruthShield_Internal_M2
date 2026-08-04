import { NextRequest, NextResponse } from 'next/server'
import { verifyAuditChain, auditChainHead, recordAudit, clientIp } from '@/lib/engines/audit-logger'

/**
 * Tamper-evidence check over the audit hash chain.
 * GET  — replay and report divergence (read-only).
 * POST — same check, and record the verification itself as a chain entry so the
 *        fact that an officer verified at time T is itself part of the record.
 */
export async function GET(req: NextRequest) {
  try {
    const limit = req.nextUrl.searchParams.get('limit')
    const result = await verifyAuditChain(limit ? parseInt(limit, 10) : undefined)
    const head = await auditChainHead()
    return NextResponse.json({ success: true, chain: result, head })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await verifyAuditChain()
    await recordAudit({
      action: 'chain_verified',
      resource: 'audit_chain',
      ipAddress: clientIp(req),
      details: {
        valid: result.valid,
        totalEntries: result.totalEntries,
        verifiedEntries: result.verifiedEntries,
        breaks: result.breaks.length,
      },
    })
    // Head is read after the write so the response quotes the new head hash.
    const head = await auditChainHead()
    return NextResponse.json({ success: true, chain: result, head })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
