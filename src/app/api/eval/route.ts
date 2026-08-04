import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { summarize, type ScoredSample } from '@/lib/engines/eval-metrics'

/**
 * Detection-quality results from the evaluation harness (`npm run eval`).
 *
 * GET /api/eval                 → latest run, summarised at its stored threshold
 * GET /api/eval?runId=…         → a specific run
 * GET /api/eval?threshold=65    → latest run re-summarised at another threshold
 *
 * Per-sample scores are returned so the UI can re-tune the operating point
 * without calling the model again.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const runId = sp.get('runId')
    const thresholdParam = sp.get('threshold')

    const run = runId
      ? await db.evalRun.findUnique({ where: { id: runId }, include: { samples: true } })
      : await db.evalRun.findFirst({ orderBy: { createdAt: 'desc' }, include: { samples: true } })

    const runs = await db.evalRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, datasetName: true, datasetHash: true, modality: true, provider: true,
        model: true, threshold: true, sampleCount: true, errorCount: true,
        durationMs: true, createdAt: true,
      },
    })

    if (!run) {
      // No run yet is a legitimate state — say so instead of inventing metrics.
      return NextResponse.json({
        success: true,
        run: null,
        runs,
        message: 'No evaluation run recorded yet. Run `npm run eval` against a labeled corpus.',
      })
    }

    const usable = run.samples.filter((s) => !s.error)
    const threshold = thresholdParam ? Number(thresholdParam) : run.threshold
    const scored: ScoredSample[] = usable.map((s) => ({
      label: s.label === 1 ? 1 : 0,
      score: s.score,
      language: s.language,
      modality: s.modality,
    }))

    return NextResponse.json({
      success: true,
      runs,
      run: {
        id: run.id,
        datasetName: run.datasetName,
        datasetHash: run.datasetHash,
        modality: run.modality,
        provider: run.provider,
        model: run.model,
        storedThreshold: run.threshold,
        sampleCount: run.sampleCount,
        errorCount: run.errorCount,
        durationMs: run.durationMs,
        createdAt: run.createdAt,
      },
      summary: summarize(scored, threshold),
      samples: run.samples.map((s) => ({
        id: s.id,
        sampleId: s.sampleId,
        label: s.label,
        score: s.score,
        language: s.language,
        latencyMs: s.latencyMs,
        error: s.error,
        excerpt: s.excerpt,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed to load evaluation' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
