'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore, type RiskLevel, type TabId } from '@/lib/store'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Activity, AlertTriangle, Shield, Eye, TrendingUp, Bell,
  FileText, ImageIcon, Video, Search, ArrowUpRight, ArrowDownRight,
  Server, Cpu, Clock, Wifi, Upload, Zap, Globe, Languages,
  Target, Gauge, Timer, CheckCircle2, AlertCircle,
} from 'lucide-react'
import Image from 'next/image'
import { ThreatIntelMap } from '@/components/threat-intel-map'

const riskBadgeClass: Record<RiskLevel, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
}

const statCards = [
  { key: 'totalAnalyses', label: 'Total Analyses', icon: Activity, gradient: 'from-zinc-500/10 to-zinc-500/5', color: 'text-zinc-500', bg: 'bg-zinc-500/10', sparkColor: '#e4e4e7' },
  { key: 'fakeNewsDetected', label: 'Fake News Detected', icon: FileText, gradient: 'from-red-500/10 to-orange-500/5', color: 'text-red-500', bg: 'bg-red-500/10', sparkColor: '#ef4444' },
  { key: 'deepfakesDetected', label: 'Deepfakes Detected', icon: Video, gradient: 'from-orange-500/10 to-amber-500/5', color: 'text-orange-500', bg: 'bg-orange-500/10', sparkColor: '#f97316' },
  { key: 'imagesAnalyzed', label: 'Images Analyzed', icon: ImageIcon, gradient: 'from-zinc-500/10 to-cyan-500/5', color: 'text-zinc-500', bg: 'bg-zinc-500/10', sparkColor: '#a1a1aa' },
  { key: 'avgTrustScore', label: 'Avg Trust Score', icon: Shield, gradient: 'from-amber-500/10 to-yellow-500/5', color: 'text-amber-500', bg: 'bg-amber-500/10', sparkColor: '#f59e0b' },
  { key: 'activeAlerts', label: 'Active Alerts', icon: Bell, gradient: 'from-rose-500/10 to-pink-500/5', color: 'text-rose-500', bg: 'bg-rose-500/10', sparkColor: '#f43f5e' },
] as const

const detectionTypeConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  deepfake: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Deepfake' },
  fake_news: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Fake News' },
  manipulation: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Manipulation' },
  verified: { color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', label: 'Verified' },
}

/* ── Sparkline helper ── */
function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

/* ── Circular Progress Gauge ── */
function CircularGauge({ value, maxVal, color, size = 56 }: { value: number; maxVal: number; color: string; size?: number }) {
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (value / maxVal) * circumference
  const offset = circumference - progress

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  )
}

/* ── Hero floating particles ── */
const heroParticles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${((i * 37 + 13) % 100)}%`,
  top: `${((i * 53 + 7) % 100)}%`,
  size: 2 + (i % 5),
  delay: (i * 0.3) % 6,
  duration: 4 + (i % 7),
}))

function HeroParticles() {

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {heroParticles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-zinc-400/30"
          style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
          animate={{
            y: [0, -15, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

interface LiveSparks {
  totalAnalyses: number[]
  fakeNewsDetected: number[]
  deepfakesDetected: number[]
  imagesAnalyzed: number[]
  avgTrustScore: number[]
  activeAlerts: number[]
}
interface LiveLang { language: string; code: string; count: number; percent: number }
interface LiveModelPerf { detectionAccuracy: number; falsePositiveRate: number; avgProcessingMs: number; avgConfidence: number; totalSamples: number }
interface LiveTickerItem { text: string; type: string; icon: string; timestamp: string }

interface LiveHealth {
  cpu: { usagePct: number; cores: number }
  memory: { usedPct: number; processRssMB: number }
  uptime: { systemSec: number; processSec: number }
  db: { totalReports: number; queuedAnalyses: number; failedAnalyses: number; lastReportAt: string | null }
}
interface LiveAppConfig {
  app: { name: string; version: string }
  ai: { provider: string; model: string; configured: boolean }
  dashboard: { refreshIntervalMs: number }
}

/**
 * Trend over the sparkline window: the most recent half of the series compared
 * with the preceding half. Halves rather than single days so a partial current
 * day doesn't read as a -100% collapse.
 */
function seriesTrend(series: number[] | null): { label: string; up: boolean } | null {
  if (!series || series.length < 4) return null
  const half = Math.floor(series.length / 2)
  const prev = series.slice(0, half).reduce((a, b) => a + b, 0)
  const recent = series.slice(half).reduce((a, b) => a + b, 0)
  if (prev === 0 && recent === 0) return null
  const pct = prev === 0 ? 100 : ((recent - prev) / prev) * 100
  return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 }
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function DashboardTab() {
  const { dashboardStats, dashboardLoading, fetchDashboardStats, setActiveTab } = useAppStore()
  const [liveSparks, setLiveSparks] = useState<LiveSparks | null>(null)
  const [livePerf, setLivePerf] = useState<LiveModelPerf | null>(null)
  const [liveTicker, setLiveTicker] = useState<LiveTickerItem[] | null>(null)
  const [liveHealth, setLiveHealth] = useState<LiveHealth | null>(null)
  const [liveConfig, setLiveConfig] = useState<LiveAppConfig | null>(null)

  useEffect(() => {
    let aborted = false

    const load = () => {
      void fetchDashboardStats()
      Promise.all([
        fetch('/api/dashboard/sparklines').then((r) => r.json()).catch(() => null),
        fetch('/api/dashboard/model-perf').then((r) => r.json()).catch(() => null),
        fetch('/api/dashboard/ticker').then((r) => r.json()).catch(() => null),
        fetch('/api/system/health').then((r) => r.json()).catch(() => null),
        fetch('/api/config').then((r) => r.json()).catch(() => null),
      ]).then(([sp, mp, tk, hl, cf]) => {
        if (aborted) return
        if (sp?.success) setLiveSparks(sp.sparklines)
        if (mp?.success) setLivePerf(mp)
        if (tk?.success && Array.isArray(tk.events)) setLiveTicker(tk.events)
        if (hl?.success) setLiveHealth(hl as LiveHealth)
        if (cf?.success) setLiveConfig(cf.config as LiveAppConfig)
      })
    }

    load()

    // Poll interval comes from the central config (DASHBOARD_REFRESH_MS; 0 = off).
    let timer: ReturnType<typeof setInterval> | null = null
    fetch('/api/config')
      .then((r) => r.json())
      .then((cf) => {
        const ms = cf?.config?.dashboard?.refreshIntervalMs ?? 0
        if (!aborted && ms > 0) timer = setInterval(load, ms)
      })
      .catch(() => undefined)

    return () => {
      aborted = true
      if (timer) clearInterval(timer)
    }
  }, [fetchDashboardStats])

  if (dashboardLoading || !dashboardStats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  const s = dashboardStats

  // Sparklines are DB-derived; render nothing rather than a fabricated curve.
  const sparkFor = (key: keyof LiveSparks): number[] | null =>
    liveSparks && liveSparks[key]?.some((v) => v > 0) ? liveSparks[key] : null

  const effectivePerfData = livePerf
    ? [
        { label: 'Detection Accuracy', value: livePerf.detectionAccuracy, unit: '%', color: '#e4e4e7', bgColor: 'bg-zinc-500/10', textColor: 'text-zinc-500', icon: Target, trend: 'up' as const },
        { label: 'False Positive Rate', value: livePerf.falsePositiveRate, unit: '%', color: '#f59e0b', bgColor: 'bg-amber-500/10', textColor: 'text-amber-500', icon: AlertCircle, trend: 'down' as const },
        { label: 'Processing Speed', value: Math.round((livePerf.avgProcessingMs / 1000) * 100) / 100, unit: 's avg', color: '#a1a1aa', bgColor: 'bg-zinc-500/10', textColor: 'text-zinc-500', icon: Timer, trend: 'down' as const },
        { label: 'Model Confidence', value: livePerf.avgConfidence, unit: '%', color: '#06b6d4', bgColor: 'bg-cyan-500/10', textColor: 'text-cyan-500', icon: Gauge, trend: 'up' as const },
      ]
    : []

  const effectiveLanguages = s.languages ?? []
  const timeline = s.detectionTimeline ?? []

  return (
    <div className="space-y-6">
      {/* ───── Hero Banner ───── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-premium border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="relative h-40 sm:h-48 bg-gradient-to-r from-zinc-900/90 via-zinc-800/90 to-zinc-900/90 animate-aurora">
            <Image
              src="/truthshield-hero.png"
              alt="TruthShield - AI-Powered Digital Media Verification"
              fill
              className="object-cover opacity-25 mix-blend-luminosity grayscale"
              priority
            />
            {/* Floating particles */}
            <HeroParticles />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <Shield className="h-8 w-8 text-zinc-400" />
                  {/* Glow effect */}
                  <div className="absolute inset-0 h-8 w-8 rounded-full bg-zinc-400/30 blur-md animate-pulse" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">TruthShield</h1>
                <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30 text-[10px] px-1.5 py-0 ml-1">v{liveConfig?.app.version ?? ''}</Badge>
              </div>
              <p className="text-sm sm:text-base text-zinc-100/80 max-w-lg">
                AI-Powered Digital Media Verification Platform — Detect deepfakes, combat misinformation, verify facts in real-time
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ───── Stat Cards with Sparklines ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, idx) => {
          const val = s[card.key as keyof typeof s] as number
          const series = sparkFor(card.key as keyof LiveSparks)
          const trend = seriesTrend(series)
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className={`bg-gradient-to-br ${card.gradient} stat-card-glow border border-zinc-500/10 dark:border-zinc-500/5 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${card.bg}`}>
                        <card.icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-bold">{typeof val === 'number' ? val.toLocaleString() : val}</p>
                      </div>
                    </div>
                    {trend && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-zinc-500' : 'text-red-500'}`}>
                        {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {trend.label}
                      </div>
                    )}
                  </div>
                  {/* Sparkline — only rendered when the DB has a real series */}
                  {series && (
                    <div className="mt-2 flex justify-end">
                      <Sparkline data={series} color={card.sparkColor} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Gradient Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-500/30 to-transparent" />

      {/* ───── Live Activity Ticker ───── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="border rounded-xl bg-gradient-to-r from-zinc-500/5 via-transparent to-zinc-500/5 overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Live</span>
              </div>
              {/* min-w-0 keeps the nowrap marquee from widening the whole page */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex animate-marquee whitespace-nowrap gap-8">
                  {(liveTicker && liveTicker.length > 0 ? liveTicker : [
                    { text: 'Awaiting first analysis — start with Text or Image tab', type: 'info', icon: '🔵' },
                  ]).map((item, i) => (
                    <span key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{item.icon}</span>
                      {item.text}
                      <span className="text-muted-foreground/40">•</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ───── Platform Health & Quick Actions ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform Health */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-zinc-500" />
                Platform Health
              </CardTitle>
              <CardDescription>System status and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${liveHealth ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">API Status</p>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      {liveHealth ? 'Operational' : 'Checking…'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${liveConfig?.ai.configured ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">AI Model</p>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 truncate">
                      {liveConfig ? `${liveConfig.ai.provider} · ${liveConfig.ai.model}` : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Cpu className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Queue / CPU</p>
                    <p className="text-sm font-medium">
                      {liveHealth ? `${liveHealth.db.queuedAnalyses} queued · ${liveHealth.cpu.usagePct}%` : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Clock className="h-4 w-4 text-zinc-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Process Uptime</p>
                    <p className="text-sm font-medium">
                      {liveHealth ? formatUptime(liveHealth.uptime.processSec) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-zinc-500" />
                Quick Actions
              </CardTitle>
              <CardDescription>Jump to common analysis tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4 hover-lift hover:bg-zinc-500/10 hover:border-zinc-500/30 hover:text-zinc-600 transition-all"
                  onClick={() => setActiveTab('text')}
                >
                  <FileText className="h-6 w-6" />
                  <span className="text-xs font-medium">New Text Analysis</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4 hover-lift hover:bg-zinc-500/10 hover:border-zinc-500/30 hover:text-zinc-600 transition-all"
                  onClick={() => setActiveTab('image')}
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-xs font-medium">Upload Image</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4 hover-lift hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-600 transition-all"
                  onClick={() => setActiveTab('factcheck')}
                >
                  <Search className="h-6 w-6" />
                  <span className="text-xs font-medium">Verify Claim</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ───── Model Performance Card ───── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border rounded-xl card-gradient-top bg-gradient-to-br from-zinc-500/5 via-zinc-500/3 to-transparent hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-zinc-500" />
              Model Performance
            </CardTitle>
            <CardDescription>Measured over {livePerf?.totalSamples ?? 0} completed analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {effectivePerfData.map((metric, idx) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    <CircularGauge
                      value={metric.label === 'False Positive Rate' ? (100 - metric.value) : metric.label === 'Processing Speed' ? Math.max(0, 100 - (metric.value * 20)) : metric.value}
                      maxVal={100}
                      color={metric.color}
                      size={56}
                    />
                    <metric.icon className="absolute h-4 w-4" style={{ color: metric.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold">{metric.value}</span>
                      <span className="text-xs text-muted-foreground">{metric.unit}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {metric.trend === 'up' ? (
                        <ArrowUpRight className="h-3 w-3 text-zinc-500" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-zinc-500" />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {metric.trend === 'up' ? 'Improving' : 'Decreasing'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ───── Charts Row ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Area Chart - Trends */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Analysis Trends</CardTitle>
              <CardDescription>Daily analyses vs threats detected — last {s.trendData.length} days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={s.trendData}>
                  <defs>
                    <linearGradient id="colorAnalyses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e4e4e7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#e4e4e7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Area type="monotone" dataKey="analyses" stroke="#e4e4e7" fill="url(#colorAnalyses)" strokeWidth={2} name="Analyses" />
                  <Area type="monotone" dataKey="threats" stroke="#ef4444" fill="url(#colorThreats)" strokeWidth={2} name="Threats" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pie Chart - Risk Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card className="border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Risk Distribution</CardTitle>
              <CardDescription>Breakdown by risk level</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={s.riskDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="count" nameKey="level">
                    {s.riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ───── Threat Intelligence Map ───── */}
      <div className="shimmer-border-hover rounded-xl">
        <ThreatIntelMap />
      </div>

      {/* ───── Second Row (4 columns) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Bar Chart - Analysis by Type */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Analysis by Type</CardTitle>
              <CardDescription>Breakdown by content type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={s.analysisByType}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#e4e4e7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card className="border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest platform events</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[250px]">
                <div className="space-y-2 px-2">
                  {s.recentActivity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5">
                        {item.type === 'text' && <FileText className="h-4 w-4 text-zinc-500" />}
                        {item.type === 'image' && <ImageIcon className="h-4 w-4 text-zinc-500" />}
                        {item.type === 'video' && <Video className="h-4 w-4 text-orange-500" />}
                        {item.type === 'factcheck' && <Search className="h-4 w-4 text-amber-500" />}
                        {item.type === 'system' && <Activity className="h-4 w-4 text-rose-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.action}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskBadgeClass[item.risk]}`}>
                            {item.risk}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Detection Timeline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="border rounded-xl shimmer-border-hover hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-zinc-500" />
                Detection Timeline
              </CardTitle>
              <CardDescription>Recent detection events</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[250px]">
                <div className="relative px-2">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[22px] top-2 bottom-2 w-px bg-zinc-500/20" />
                  <div className="space-y-0">
                    {timeline.length === 0 && (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        No detections yet — run an analysis to populate this timeline.
                      </p>
                    )}
                    {timeline.map((event, idx) => {
                      const config = detectionTypeConfig[event.type] ?? detectionTypeConfig.fake_news
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + idx * 0.1 }}
                          className="relative flex items-start gap-3 py-2.5"
                        >
                          {/* Timeline dot */}
                          <div className={`relative z-10 mt-1 h-4 w-4 rounded-full border-2 ${config.border} ${config.bg} flex items-center justify-center shrink-0`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${config.bg.replace('/10', '/60')}`} />
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] text-muted-foreground font-mono">{event.time}</span>
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${config.color} ${config.border}`}>
                                {config.label}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted/30">
                                {event.confidence}%
                              </Badge>
                            </div>
                            <p className="text-xs text-foreground/80 truncate">{event.desc}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Threats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
          <Card className="border rounded-xl hover:shadow-lg transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 rounded-xl border-2 border-red-500/20 animate-pulse pointer-events-none" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Top Threats
              </CardTitle>
              <CardDescription>Most critical active threats</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[250px]">
                <div className="space-y-2 px-2">
                  {s.topThreats.map((threat, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                        threat.risk === 'critical' ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{threat.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskBadgeClass[threat.risk]}`}>
                            {threat.risk}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{threat.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ───── Multilingual Insights (Horizontal Bar Chart) ───── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-transparent hover:shadow-lg transition-all duration-300 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Languages className="h-4 w-4 text-zinc-500" />
              Multilingual Insights
            </CardTitle>
            <CardDescription>Content analyzed by language</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={effectiveLanguages} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="language" type="category" tick={{ fontSize: 12 }} width={70} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), 'Analyses']}
                  labelFormatter={(label: string) => label}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} minPointSize={20}>
                  {effectiveLanguages.map((entry, index) => {
                    const colors = ['#e4e4e7', '#a1a1aa', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#a78bfa']
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* ───── Trust Score Distribution ───── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
        <Card className="border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-500" />
              Trust Score Distribution
            </CardTitle>
            <CardDescription>Histogram of trust scores across all analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s.trustScoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {s.trustScoreDistribution.map((entry, index) => {
                    const mid = parseInt(entry.range.split('-')[0])
                    const color = mid >= 75 ? '#22c55e' : mid >= 50 ? '#eab308' : mid >= 25 ? '#f97316' : '#ef4444'
                    return <Cell key={`cell-${index}`} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
