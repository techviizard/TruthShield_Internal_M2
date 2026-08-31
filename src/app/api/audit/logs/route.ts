import { NextRequest, NextResponse } from 'next/server'
import { listAudit, type AuditAction } from '@/lib/engines/audit-logger'
import { appConfig } from '@/config/app.config'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const cursor = sp.get('cursor') ?? undefined
    const limit = sp.get('limit')
      ? parseInt(sp.get('limit')!, 10)
      : appConfig.limits.auditLogPageSize
    const action = (sp.get('action') ?? undefined) as AuditAction | undefined
    const search = sp.get('search') ?? undefined
    const data = await listAudit({ cursor, limit, action, search })
    return NextResponse.json({ success: true, ...data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
