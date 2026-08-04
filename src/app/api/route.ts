/**
 * GET /api — health + integration status.
 *
 * Reports whether each configured integration is actually wired: database
 * reachable, AI provider keyed, web search enabled. Useful as a deployment
 * smoke check ("is the config complete?").
 */

import { NextResponse } from 'next/server'
import { appConfig } from '@/config/app.config'
import { db } from '@/lib/db'

export async function GET() {
  let database: { ok: boolean; error?: string; reports?: number } = { ok: false }
  try {
    const reports = await db.analysisReport.count()
    database = { ok: true, reports }
  } catch (e) {
    database = { ok: false, error: e instanceof Error ? e.message : 'unreachable' }
  }

  const integrations = {
    database,
    ai: {
      ok: appConfig.ai.configured,
      provider: appConfig.ai.provider,
      model: appConfig.ai.model,
      visionModel: appConfig.ai.visionModel,
      visionEnabled: appConfig.features.visionAnalysis,
    },
    search: {
      ok: appConfig.search.enabled,
      provider: appConfig.search.provider,
    },
  }

  const healthy = database.ok && integrations.ai.ok

  return NextResponse.json(
    {
      success: true,
      status: healthy ? 'ok' : 'degraded',
      app: { name: appConfig.app.name, version: appConfig.app.version, env: appConfig.env.nodeEnv },
      integrations,
      features: appConfig.features,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  )
}

export const dynamic = 'force-dynamic'
