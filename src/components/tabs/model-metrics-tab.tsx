'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, Activity, Cpu, Database, CheckCircle2, AlertCircle,
  Timer, Target, Gauge, FileText, Image as ImageIcon, Music,
  MonitorSpeaker, Search, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { EvalPanel } from '@/components/eval-panel'

/**
 * Model Metrics — every number on this tab is computed from rows in the
 * database (AnalysisReport) plus the live provider configuration. Metrics that
 * require labelled ground truth (ROC, confusion matrix) are intentionally not
 * shown: the platform has no verified label set to compute them from.
 */

// ─── Animation Helpers ─────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

interface Variant {
  type: string
  totalRuns: number
  avgProcessingMs: number
  avgConfidence: number
  highRiskRate: number
  trustScoreP50: number
}

interface ModelPerf {
  detectionAccuracy: number
  falsePositiveRate: number
  avgProcessingMs: number
  avgConfidence: number
  totalSamples: number
}

interface AppConfigView {
  app: { name: string; version: string }
  ai: { provider: string; model: string; visionModel: string; visionEnabled: boolean; configured: boolean }
  search: { provider: string; enabled: boolean }
}

interface Sparklines {
  totalAnalyses: number[]
  avgTrustScore: number[]
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  text_fake_news: { label: 'Text / Fake news', icon: FileText, color: '#e4e4e7' },
  image_forensics: { label: 'Image forensics', icon: ImageIcon, color: '#06b6d4' },
  video_deepfake: { label: 'Video deepfake', icon: MonitorSpeaker, color: '#f97316' },
  fact_check: { label: 'Fact check', icon: Search, color: '#eab308' },
  audio_deepfake: { label: 'Audio deepfake', icon: Music, color: '#a78bfa' },
}

function metaFor(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Activity, color: '#a1a1aa' }
}

export function ModelMetricsTab() {
  const [variants, setVariants] = useState<Variant[] | null>(null)
  const [perf, setPerf] = useState<ModelPerf | null>(null)
  const [config, setConfig] = useState<AppConfigView | null>(null)
  const [sparks, setSparks] = useState<Sparklines | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [mm, mp, cf, sp] = await Promise.all([
      fetch('/api/model-metrics').then((r) => r.json()).catch(() => null),
      fetch('/api/dashboard/model-perf').then((r) => r.json()).catch(() => null),
      fetch('/api/config').then((r) => r.json()).catch(() => null),
      fetch('/api/dashboard/sparklines').then((r) => r.json()).catch(() => null),
    ])
    if (mm?.success) setVariants(mm.variants ?? [])
    if (mp?.success) setPerf(mp as ModelPerf)
    if (cf?.success) setConfig(cf.config as AppConfigView)
    if (sp?.success) setSparks(sp.sparklines as Sparklines)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !variants) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  const totalRuns = (variants ?? []).reduce((sum, v) => sum + v.totalRuns, 0)
  const trendData = (sparks?.totalAnalyses ?? []).map((count, i) => ({
    day: `D-${(sparks!.totalAnalyses.length - 1 - i) || 0}`,
    analyses: count,
    trust: sparks?.avgTrustScore?.[i] ?? 0,
  }))

  const overviewCards = [
    {
      label: 'Active model',
      value: config?.ai.model ?? '—',
      sub: config ? `${config.ai.provider}${config.ai.configured ? '' : ' (no API key)'}` : '',
      icon: Cpu,
    },
    {
      label: 'Analyses scored',
      value: perf ? perf.totalSamples.toLocaleString() : String(totalRuns),
      sub: 'completed reports in database',
      icon: Database,
    },
    {
      label: 'Mean confidence',
      value: perf ? `${perf.avgConfidence}%` : '—',
      sub: 'model self-reported confidence',
      icon: Gauge,
    },
    {
      label: 'Mean latency',
      value: perf ? `${(perf.avgProcessingMs / 1000).toFixed(2)}s` : '—',
      sub: 'end-to-end analysis time',
      icon: Timer,
    },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* ── Overview ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-zinc-500" />
          <h2 className="text-lg font-semibold">Model Overview</h2>
          {config && (
            <Badge variant="outline" className="ml-2 border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
              {config.ai.provider} · {config.ai.model}
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewCards.map((c) => (
            <Card key={c.label} className="glass border-zinc-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                  <c.icon className="h-4 w-4 text-zinc-500" />
                </div>
                <p className="text-xl font-bold truncate" title={String(c.value)}>{c.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1 truncate">{c.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* ── Measured quality against labeled data ────────────────── */}
      <motion.div variants={itemVariants}>
        <EvalPanel />
      </motion.div>

      {/* ── Aggregate quality signals ────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-zinc-500" />
              Detection signals
            </CardTitle>
            <CardDescription>
              Operational rates over {perf?.totalSamples ?? 0} stored analyses. These are workload
              statistics, not accuracy — accuracy is measured against labeled data in the panel above.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Flag rate (high/critical)</span>
                <span className="font-semibold">{perf?.detectionAccuracy ?? 0}%</span>
              </div>
              <Progress value={perf?.detectionAccuracy ?? 0} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Closed-without-escalation</span>
                <span className="font-semibold">{perf?.falsePositiveRate ?? 0}%</span>
              </div>
              <Progress value={perf?.falsePositiveRate ?? 0} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Mean confidence</span>
                <span className="font-semibold">{perf?.avgConfidence ?? 0}%</span>
              </div>
              <Progress value={perf?.avgConfidence ?? 0} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Per-analysis-type breakdown ──────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-zinc-500" />
              Performance by analysis type
            </CardTitle>
            <CardDescription>Real per-type aggregates over stored analyses</CardDescription>
          </CardHeader>
          <CardContent>
            {(variants ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No analyses recorded yet — run an analysis (or seed the database) to populate these metrics.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Analysis type</th>
                      <th className="py-2 pr-4 font-medium">Runs</th>
                      <th className="py-2 pr-4 font-medium">Avg latency</th>
                      <th className="py-2 pr-4 font-medium">Avg confidence</th>
                      <th className="py-2 pr-4 font-medium">High-risk rate</th>
                      <th className="py-2 pr-4 font-medium">Median trust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(variants ?? []).map((v) => {
                      const meta = metaFor(v.type)
                      return (
                        <tr key={v.type} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2.5 pr-4">
                            <span className="flex items-center gap-2">
                              <meta.icon className="h-4 w-4" style={{ color: meta.color }} />
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{v.totalRuns.toLocaleString()}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{(v.avgProcessingMs / 1000).toFixed(2)}s</td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{Math.round(v.avgConfidence * 100)}%</td>
                          <td className="py-2.5 pr-4">
                            <Badge
                              variant="outline"
                              className={
                                v.highRiskRate >= 50
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
                                  : v.highRiskRate >= 25
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                    : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25'
                              }
                            >
                              {v.highRiskRate}%
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs">{v.trustScoreP50}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Charts ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="border rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latency by analysis type</CardTitle>
              <CardDescription>Mean end-to-end processing time (seconds)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={(variants ?? []).map((v) => ({
                    type: metaFor(v.type).label,
                    seconds: Math.round((v.avgProcessingMs / 1000) * 100) / 100,
                    color: metaFor(v.type).color,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="seconds" radius={[4, 4, 0, 0]}>
                    {(variants ?? []).map((v) => (
                      <Cell key={v.type} fill={metaFor(v.type).color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Volume &amp; mean trust (last 7 days)</CardTitle>
              <CardDescription>Daily analyses and average trust score</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="analyses" stroke="#06b6d4" strokeWidth={2} name="Analyses" dot={false} />
                  <Line type="monotone" dataKey="trust" stroke="#eab308" strokeWidth={2} name="Avg trust" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Provider status ──────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-zinc-500" />
              Configured inference stack
            </CardTitle>
            <CardDescription>Read live from the central configuration</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="font-medium">{config?.ai.provider ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Text model</p>
              <p className="font-medium truncate">{config?.ai.model ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vision model</p>
              <p className="font-medium truncate">
                {config?.ai.visionEnabled ? config?.ai.visionModel ?? '—' : 'disabled'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Web search</p>
              <p className="font-medium flex items-center gap-1.5">
                {config?.search.enabled ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    {config.search.provider}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    disabled
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
