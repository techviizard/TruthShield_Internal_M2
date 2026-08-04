/**
 * Evaluation harness runner.
 *
 *   npm run eval -- [--dataset path] [--threshold 50] [--limit N] [--base http://localhost:3000]
 *
 * Sends every labeled sample through the product's own analysis endpoint, stores
 * per-sample scores in the database, and prints the resulting metrics.
 * Requires the dev/prod server to be running — the harness deliberately exercises
 * the same HTTP path the UI uses rather than a private evaluation shortcut.
 */

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { getConfig } from '../src/config/app.config.ts'
import { summarize } from '../src/lib/engines/eval-metrics.ts'
import { scoreText } from '../src/lib/engines/text-heuristics.ts'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const cfg = getConfig()
const datasetPath = arg('dataset', 'eval/corpora/text-smoke.jsonl')
const threshold = Number(arg('threshold', '50'))
const limit = Number(arg('limit', '0'))
const base = arg('base', cfg.env.appUrl ?? 'http://localhost:3000').replace(/\/$/, '')
/** `llm` exercises the served endpoint; `heuristic` runs the in-house detector in-process. */
const detector = arg('detector', 'llm')

const db = new PrismaClient({ datasources: { db: { url: cfg.database.url } } })

function fmtPct(x) {
  return `${(x * 100).toFixed(1)}%`
}

async function main() {
  const raw = await readFile(datasetPath, 'utf8')
  const datasetHash = createHash('sha256').update(raw).digest('hex')
  let samples = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l))
  if (limit > 0) samples = samples.slice(0, limit)

  const positives = samples.filter((s) => s.label === 1).length
  console.log(`Dataset  ${datasetPath}`)
  console.log(`         ${samples.length} samples (${positives} positive / ${samples.length - positives} negative)`)
  console.log(`         sha256 ${datasetHash.slice(0, 16)}…`)
  if (detector === 'heuristic') {
    console.log('Detector in-house lexical heuristics (no network, no API key)\n')
  } else {
    console.log(`Endpoint ${base}/api/analyze/text`)
    console.log(`Model    ${cfg.ai.provider}:${cfg.ai.model}\n`)

    // Fail fast with a clear message rather than one error per sample.
    // /api reports "degraded" (503) when AI credentials are missing, which is
    // exactly the case where the LLM detector cannot produce scores.
    try {
      const ping = await fetch(`${base}/api`)
      const health = await ping.json().catch(() => null)
      if (health?.integrations?.ai?.ok === false) {
        console.error('AI provider is not configured, so the LLM detector cannot score anything.')
        console.error('Set the provider credentials in .env, or run:')
        console.error('  npm run eval -- --detector heuristic\n')
        process.exit(1)
      }
      if (!ping.ok && !health) throw new Error(`status ${ping.status}`)
    } catch (e) {
      console.error(`Cannot reach ${base} — start the server first (npm run dev), or pass --base.`)
      console.error(`  ${e instanceof Error ? e.message : e}`)
      process.exit(1)
    }
  }

  const started = Date.now()
  const scored = []
  let errors = 0

  for (const [i, s] of samples.entries()) {
    const t0 = Date.now()
    let score = null
    let error = null
    try {
      if (detector === 'heuristic') {
        score = scoreText(s.text).score
      } else {
        const res = await fetch(`${base}/api/analyze/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: s.text, language: s.language }),
        })
        const j = await res.json()
        if (!res.ok || typeof j?.analysis?.trustScore !== 'number') {
          throw new Error(j?.error ?? `status ${res.status}`)
        }
        // Product returns trust; the harness scores suspicion.
        score = 100 - j.analysis.trustScore
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      errors++
    }
    const latencyMs = Date.now() - t0
    scored.push({ ...s, score, error, latencyMs })

    const mark = error ? 'ERR' : String(Math.round(score)).padStart(3)
    process.stdout.write(
      `[${String(i + 1).padStart(3)}/${samples.length}] ${s.id.padEnd(12)} label=${s.label} score=${mark} ${latencyMs}ms\n`
    )
  }

  const durationMs = Date.now() - started
  const usable = scored.filter((s) => s.score !== null)
  if (!usable.length) {
    console.error('\nNo sample scored successfully — nothing to report.')
    process.exit(1)
  }

  const summary = summarize(
    usable.map((s) => ({ label: s.label, score: s.score, language: s.language, modality: 'text' })),
    threshold
  )

  const run = await db.evalRun.create({
    data: {
      datasetName: datasetPath,
      datasetHash,
      modality: 'text',
      provider: detector === 'heuristic' ? 'in-house' : cfg.ai.provider,
      model: detector === 'heuristic' ? 'lexical-heuristics-v1' : cfg.ai.model,
      threshold,
      sampleCount: usable.length,
      errorCount: errors,
      durationMs,
      metrics: JSON.stringify(summary),
      samples: {
        create: scored.map((s) => ({
          sampleId: s.id,
          label: s.label,
          score: s.score ?? 0,
          language: s.language ?? 'en',
          modality: 'text',
          latencyMs: s.latencyMs,
          error: s.error,
          excerpt: String(s.text).slice(0, 160),
        })),
      },
    },
  })

  const m = summary.headline
  console.log(`\n─── Results @ threshold ${threshold} ─────────────────────────`)
  console.log(`  Confusion    TP ${m.tp}  FP ${m.fp}  TN ${m.tn}  FN ${m.fn}`)
  console.log(`  Accuracy     ${fmtPct(m.accuracy)}`)
  console.log(`  Precision    ${fmtPct(m.precision)}`)
  console.log(`  Recall       ${fmtPct(m.recall)}`)
  console.log(`  F1           ${fmtPct(m.f1)}`)
  console.log(`  FPR / FNR    ${fmtPct(m.falsePositiveRate)} / ${fmtPct(m.falseNegativeRate)}`)
  console.log(`  MCC          ${m.mcc.toFixed(3)}`)
  console.log(`  ROC-AUC      ${summary.rocAuc.toFixed(3)}`)
  console.log(`  Calib. error ${fmtPct(summary.ece)}`)
  console.log(`  Best F1 at   threshold ${summary.bestF1.threshold} (F1 ${fmtPct(summary.bestF1.f1)})`)
  console.log(`  FPR ≤ 5% at  threshold ${summary.lowFprOperatingPoint.threshold} (recall ${fmtPct(summary.lowFprOperatingPoint.recall)})`)
  if (errors) console.log(`  Errors       ${errors} sample(s) failed and are excluded`)
  console.log('\n  Per language:')
  for (const s of summary.byLanguage) {
    console.log(`    ${s.slice.padEnd(4)} n=${String(s.total).padStart(3)}  F1 ${fmtPct(s.f1).padStart(6)}  FPR ${fmtPct(s.falsePositiveRate).padStart(6)}`)
  }
  console.log(`\n  Run saved: ${run.id} (${(durationMs / 1000).toFixed(1)}s)`)
  console.log('  View it in the Model Metrics tab → Evaluation.')

  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})
