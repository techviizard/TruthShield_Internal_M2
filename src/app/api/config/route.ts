/**
 * GET /api/config — the secret-free view of the central configuration.
 *
 * Client components read runtime settings (feature flags, limits, refresh
 * intervals, provider/model in use, demo account info) from here instead of
 * hardcoding them. Secrets (API keys, DB URL, demo password) are never included.
 */

import { NextResponse } from 'next/server'
import { getPublicConfig } from '@/config/app.config'

export async function GET() {
  return NextResponse.json({ success: true, config: getPublicConfig() })
}

export const dynamic = 'force-dynamic'
