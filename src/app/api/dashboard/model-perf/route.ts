import { NextResponse } from 'next/server'
import { getModelPerformance } from '@/lib/engines/dashboard-aggregator'

export async function GET() {
  try {
    const data = await getModelPerformance()
    return NextResponse.json({ success: true, ...data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
