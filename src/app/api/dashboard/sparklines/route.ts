import { NextResponse } from 'next/server'
import { getSparklines, getLanguageDistribution, getTrustHistogram } from '@/lib/engines/dashboard-aggregator'

export async function GET() {
  try {
    const [sparks, languages, histogram] = await Promise.all([
      getSparklines(),
      getLanguageDistribution(),
      getTrustHistogram(),
    ])
    return NextResponse.json({ success: true, sparklines: sparks, languages, trustHistogram: histogram })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
