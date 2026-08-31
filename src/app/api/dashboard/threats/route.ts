import { NextRequest, NextResponse } from 'next/server'
import { getThreatRegionStats } from '@/lib/engines/dashboard-aggregator'
import { appConfig } from '@/config/app.config'

export async function GET(req: NextRequest) {
  try {
    const range = (req.nextUrl.searchParams.get('range') ?? appConfig.dashboard.defaultThreatRange) as '24h' | '7d' | '30d'
    const data = await getThreatRegionStats(range)
    return NextResponse.json({ success: true, range, regions: data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
