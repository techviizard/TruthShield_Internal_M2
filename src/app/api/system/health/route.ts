import { NextResponse } from 'next/server'
import { getSystemHealth } from '@/lib/engines/system-metrics'

export async function GET() {
  try {
    const data = await getSystemHealth()
    return NextResponse.json({ success: true, ...data })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
