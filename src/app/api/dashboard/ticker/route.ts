import { NextResponse } from 'next/server'
import { getTicker } from '@/lib/engines/dashboard-aggregator'
import { appConfig } from '@/config/app.config'

export async function GET() {
  try {
    const events = await getTicker(appConfig.dashboard.tickerLimit)
    return NextResponse.json({
      success: true,
      events: events.map((e) => ({ ...e, timestamp: e.timestamp.toISOString() })),
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
