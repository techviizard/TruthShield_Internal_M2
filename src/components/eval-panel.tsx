'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Target, FlaskConical, AlertTriangle, RefreshCw, Info, SlidersHorizontal, Loader2,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'

interface Metrics {
  threshold: number
  total: number
  tp: number; fp: number; tn: number; fn: number
  accuracy: number; precision: number; recall: number; specificity: number
  f1: number; falsePositiveRate: number; falseNegativeRate: number; mcc: number
}
interface SliceMetrics extends Metrics { slice: string }
interface CurvePoint { threshold: number; fpr: number; tpr: number; precision: number; recall: number }
interface CalibrationBin { bucket: string; meanScore: number; observedRate: number; count: number }

interface Summary {
  threshold: number
  headline: Metrics
  rocAuc: number
  ece: number
  curve: CurvePoint[]
  calibration: CalibrationBin[]
  byLanguage: SliceMetrics[]
  byModality: SliceMetrics[]
  bestF1: Metrics
  lowFprOperatingPoint: Metrics
}

interface RunMeta {
  id: string
  datasetName: string
  datasetHash: string
  modality: string
  provider: string
  model: string
  storedThreshold: number
  sampleCount: number
  errorCount: number
  durationMs: number
  createdAt: string
}

interface SampleRow {
  id: string
  sampleId: string
  label: number
  score: number
  language: string
  latencyMs: number
  error: string | null
  excerpt: string | null
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

function MetricTile({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'neutral'
}) {
  const color = tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'bad'
      ? 'text-red-600 dark:text-red-400'
      : ''
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

/** 2×2 confusion matrix — the plainest statement of what the detector got wrong. */
function ConfusionMatrix({ m }: { m: Metrics }) {
  const cells = [
    { label: 'True positive', sub: 'flagged, was fake', value: m.tp, tone: 'bg-emerald-500/10 border-emerald-500/25' },
    { label: 'False negative', sub: 'missed a fake', value: m.fn, tone: 'bg-red-500/10 border-red-500/25' },
    { label: 'False positive', sub: 'flagged genuine content', value: m.fp, tone: 'bg-red-500/10 border-red-500/25' },
    { label: 'True negative', sub: 'passed, was genuine', value: m.tn, tone: 'bg-emerald-500/10 border-emerald-500/25' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((c) => (
        <div key={c.label} className={`rounded-lg border p-3 ${c.tone}`}>
          <div className="text-2xl font-bold tabular-nums">{c.value}</div>
          <div className="text-xs font-medium">{c.label}</div>
          <div className="text-[10px] text-muted-foreground">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * Detection-quality panel backed by the evaluation harness.
 * The threshold slider re-summarises the *stored* per-sample scores server-side,
 * so an analyst can see the precision/recall trade-off without re-running the model.
 */
export function EvalPanel() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [run, setRun] = useState<RunMeta | null>(null)
  const [runs, setRuns] = useState<RunMeta[]>([])
  const [samples, setSamples] = useState<SampleRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(50)
  const [loading, setLoading] = useState(true)
  const [tuning, setTuning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { runId?: string; threshold?: number; initial?: boolean }) => {
    const isTune = opts?.threshold !== undefined
    // The component mounts in the loading state, so the effect's first call sets
    // nothing before its first await.
    if (!opts?.initial) {
      if (isTune) setTuning(true)
      else setLoading(true)
      setError(null)
    }
    try {
      const qs = new URLSearchParams()
      if (opts?.runId) qs.set('runId', opts.runId)
      if (opts?.threshold !== undefined) qs.set('threshold', String(opts.threshold))
      const j = await fetch(`/api/eval?${qs}`).then((r) => r.json())
      if (!j?.success) throw new Error(j?.error ?? 'Failed to load evaluation')
      setRuns(j.runs ?? [])
      if (!j.run) {
        setMessage(j.message ?? 'No evaluation run recorded yet.')
        setSummary(null)
        setRun(null)
        return
      }
      setMessage(null)
      setRun(j.run)
      setSummary(j.summary)
      setSamples(j.samples ?? [])
      if (!isTune) setThreshold(j.summary.threshold)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load evaluation')
    } finally {
      setLoading(false)
      setTuning(false)
    }
  }, [])

  // `load({ initial: true })` sets no state before its first await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load({ initial: true }) }, [load])

  const rocData = useMemo(
    () => summary?.curve.map((p) => ({ fpr: +(p.fpr * 100).toFixed(1), tpr: +(p.tpr * 100).toFixed(1) })) ?? [],
    [summary]
  )
  const calData = useMemo(
    () => summary?.calibration
      .filter((b) => b.count > 0)
      .map((b) => ({ bucket: b.bucket, predicted: +b.meanScore.toFixed(1), observed: +(b.observedRate * 100).toFixed(1), count: b.count })) ?? [],
    [summary]
  )
  const mistakes = useMemo(() => {
    if (!summary) return []
    return samples
      .filter((s) => !s.error)
      .filter((s) => (s.score >= threshold ? s.label === 0 : s.label === 1))
      .sort((a, b) => Math.abs(b.score - threshold) - Math.abs(a.score - threshold))
      .slice(0, 8)
  }, [samples, threshold, summary])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Detection Quality</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="p-5 text-sm text-amber-600 dark:text-amber-400">{error}</CardContent>
      </Card>
    )
  }

  if (!summary || !run) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Detection Quality
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Precision, recall and ROC need labeled data. Run the harness against a labeled corpus
            and this panel fills in from the stored per-sample scores:
          </p>
          <pre className="rounded-lg bg-muted p-3 text-xs">npm run eval -- --detector heuristic</pre>
          <p className="text-xs">
            Corpus format and provenance notes are in <code>eval/README.md</code>.
          </p>
        </CardContent>
      </Card>
    )
  }

  const m = summary.headline

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-emerald-500" />
                Detection Quality
                <Badge variant="outline" className="text-[10px]">measured</Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {run.sampleCount} labeled samples · {run.provider}:{run.model} ·{' '}
                {new Date(run.createdAt).toLocaleString()}
              </CardDescription>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {run.datasetName} · sha256 {run.datasetHash.slice(0, 12)}…
              </p>
            </div>
            <div className="flex items-center gap-2">
              {runs.length > 1 && (
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={run.id}
                  onChange={(e) => load({ runId: e.target.value })}
                >
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.createdAt).toLocaleString()} · {r.model}
                    </option>
                  ))}
                </select>
              )}
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => load()}>
                <RefreshCw className="h-3 w-3" /> Reload
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <MetricTile label="Accuracy" value={pct(m.accuracy)} />
            <MetricTile label="Precision" value={pct(m.precision)} />
            <MetricTile label="Recall" value={pct(m.recall)} />
            <MetricTile label="F1" value={pct(m.f1)} />
            <MetricTile label="False positive" value={pct(m.falsePositiveRate)} tone={m.falsePositiveRate <= 0.05 ? 'good' : 'bad'} hint="genuine flagged" />
            <MetricTile label="False negative" value={pct(m.falseNegativeRate)} tone={m.falseNegativeRate <= 0.2 ? 'good' : 'bad'} hint="fakes missed" />
            <MetricTile label="ROC-AUC" value={summary.rocAuc.toFixed(3)} hint={`MCC ${m.mcc.toFixed(2)}`} />
          </div>

          {/* Operating-point tuner */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                Decision threshold
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{threshold}</span>
                {tuning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="h-7 text-[11px]"
                  onClick={() => { setThreshold(summary.bestF1.threshold); load({ runId: run.id, threshold: summary.bestF1.threshold }) }}
                >
                  Best F1 ({summary.bestF1.threshold})
                </Button>
                <Button
                  variant="outline" size="sm" className="h-7 text-[11px]"
                  onClick={() => { setThreshold(summary.lowFprOperatingPoint.threshold); load({ runId: run.id, threshold: summary.lowFprOperatingPoint.threshold }) }}
                >
                  FPR ≤ 5% ({summary.lowFprOperatingPoint.threshold})
                </Button>
              </div>
            </div>
            <Slider
              value={[threshold]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setThreshold(v[0])}
              onValueCommit={(v) => load({ runId: run.id, threshold: v[0] })}
            />
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Re-scored from stored per-sample predictions — no model calls. Raising the threshold
              cuts false positives and misses more fakes; the right point is a policy choice, not a
              technical one.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Confusion matrix @ {threshold}</p>
              <ConfusionMatrix m={m} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                ROC curve · AUC {summary.rocAuc.toFixed(3)}
              </p>
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rocData} margin={{ top: 5, right: 10, bottom: 5, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="fpr" type="number" domain={[0, 100]} tick={{ fontSize: 10 }} label={{ value: 'FPR %', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                    <YAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(v: number, n: string) => [`${v}%`, n === 'tpr' ? 'True positive rate' : n]}
                    />
                    <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground/40" />
                    <Line type="monotone" dataKey="tpr" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Calibration · expected error {pct(summary.ece)}
              </p>
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={calData} margin={{ top: 5, right: 10, bottom: 5, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="predicted" type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground/40" />
                    <Line type="monotone" dataKey="observed" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="observed % fake" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Points on the diagonal mean the score can be read as a probability.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Per language @ {threshold}</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Lang</th>
                      <th className="px-2 py-1.5 text-right font-medium">n</th>
                      <th className="px-2 py-1.5 text-right font-medium">Recall</th>
                      <th className="px-2 py-1.5 text-right font-medium">FPR</th>
                      <th className="px-2 py-1.5 text-right font-medium">F1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byLanguage.map((s) => (
                      <tr key={s.slice} className="border-t">
                        <td className="px-2 py-1.5 font-medium uppercase">{s.slice}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{s.total}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{pct(s.recall)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{pct(s.falsePositiveRate)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{pct(s.f1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {mistakes.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Errors at this threshold — review these before quoting the numbers
              </p>
              <div className="space-y-1.5">
                {mistakes.map((s) => {
                  const isFp = s.label === 0
                  return (
                    <div key={s.id} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2 text-xs">
                      <Badge variant="outline" className={isFp ? 'border-red-500/30 text-red-600 dark:text-red-400' : 'border-amber-500/30 text-amber-600 dark:text-amber-400'}>
                        {isFp ? 'FP' : 'FN'}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{s.sampleId}</span>
                      <span className="tabular-nums text-[10px] text-muted-foreground">score {Math.round(s.score)}</span>
                      <span className="min-w-0 flex-1 truncate">{s.excerpt}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {run.errorCount > 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              {run.errorCount} sample(s) failed to score in this run and are excluded from every metric above.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
