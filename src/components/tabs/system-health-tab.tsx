'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Server, Cpu, HardDrive, Shield, Database,
  AlertTriangle, CheckCircle2, XCircle, Clock, Globe,
  RefreshCw, Search, MemoryStick,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

/**
 * System Health - every value here is measured: OS/process metrics from the
 * `system-metrics` engine, latency and failures from stored AnalysisReport
 * rows, and integration status from the central configuration. There is no
 * synthetic time series and no invented service inventory.
 */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

interface LiveHealth {
  cpu: { usagePct: number; cores: number; model: string; loadAvg: number[] }
  memory: { totalMB: number; freeMB: number; usedMB: number; usedPct: number; processRssMB: number; heapUsedMB: number }
  uptime: { systemSec: number; processSec: number }
  os: { platform: string; release: string; arch: string; hostname: string; nodeVersion: string }
  db: {
    totalReports: number
    totalUploads: number
    totalAlerts: number
    totalInvestigations: number
    lastReportAt: string | null
    queuedAnalyses: number
    failedAnalyses: number
  }
  net: { interfaces: { name: string; address: string; family: string }[] }
}

interface LatencyPayload {
  series: { hour: string; analyze: number; factcheck: number; other: number; count: number }[]
  failures: { id: string; endpoint: string; analysisType: string; description: string; createdAt: string }[]
}

interface HealthProbe {
  status: 'ok' | 'degraded'
  integrations: {
    database: { ok: boolean; reports?: number; error?: string }
    ai: { ok: boolean; provider: string; model: string; visionEnabled: boolean }
    search: { ok: boolean; provider: string }
  }
  app: { name: string; version: string; env: string }
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} d ago`
}

/* ── Circular gauge ── */
function CircularGauge({
  value, max = 100, size = 96, strokeWidth = 8, color = '#22c55e', label, unit, icon: Icon,
}: {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  label: string
  unit?: string
  icon?: React.ElementType
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - Math.min(1, value / max) * circumference
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && <Icon className="h-4 w-4 mb-0.5 text-muted-foreground" />}
          <span className="text-sm font-bold">
            {value}
            {unit}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">{label}</p>
    </div>
  )
}

export function SystemHealthTab() {
  const [live, setLive] = useState<LiveHealth | null>(null)
  const [latency, setLatency] = useState<LatencyPayload | null>(null)
  const [probe, setProbe] = useState<HealthProbe | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    const [h, l, p] = await Promise.all([
      fetch('/api/system/health').then((r) => r.json()).catch(() => null),
      fetch('/api/system/latency').then((r) => r.json()).catch(() => null),
      fetch('/api').then((r) => r.json()).catch(() => null),
    ])
    if (h?.success) setLive(h as LiveHealth)
    if (l?.success) setLatency(l as LatencyPayload)
    if (p?.success) setProbe(p as HealthProbe)
    setLastRefresh(new Date())
  }, [])

useEffect(() => {
  const initialLoad = setTimeout(() => {
    void load()
  }, 0)

  const t = setInterval(() => void load(), 15_000)

  return () => {
    clearTimeout(initialLoad)
    clearInterval(t)
  }
}, [load])

  if (!live) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  const services = [
    {
      name: 'HTTP API',
      icon: Globe,
      ok: probe?.status === 'ok' || probe?.status === 'degraded',
      detail: probe ? `${probe.app.name} ${probe.app.version} · ${probe.app.env}` : 'unknown',
    },
    {
      name: 'Database',
      icon: Database,
      ok: probe?.integrations.database.ok ?? false,
      detail: probe?.integrations.database.ok
        ? `${live.db.totalReports} reports · ${live.db.totalUploads} uploads`
        : probe?.integrations.database.error ?? 'unreachable',
    },
    {
      name: 'AI provider',
      icon: Cpu,
      ok: probe?.integrations.ai.ok ?? false,
      detail: probe ? `${probe.integrations.ai.provider} · ${probe.integrations.ai.model}` : 'not configured',
    },
    {
      name: 'Web search',
      icon: Search,
      ok: probe?.integrations.search.ok ?? false,
      detail: probe?.integrations.search.ok ? probe.integrations.search.provider : 'disabled',
    },
    {
      name: 'Analysis queue',
      icon: HardDrive,
      ok: live.db.queuedAnalyses < 25,
      detail: `${live.db.queuedAnalyses} queued · ${live.db.failedAnalyses} failed`,
    },
    {
      name: 'Vision analysis',
      icon: Shield,
      ok: probe?.integrations.ai.visionEnabled ?? false,
      detail: probe?.integrations.ai.visionEnabled ? 'enabled' : 'disabled in config',
    },
  ]

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-zinc-500" />
        <h2 className="text-lg font-semibold">System Health</h2>
        <Badge variant="outline" className="ml-1 text-[10px]">
          {live.os.platform} · {live.os.arch} · node {live.os.nodeVersion}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          Updated {lastRefresh.toLocaleTimeString()}
        </span>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </motion.div>

      {/* ── Resource gauges ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-zinc-500" />
              Host resources
            </CardTitle>
            <CardDescription>
              {live.cpu.cores} cores · {live.cpu.model} · load {live.cpu.loadAvg.join(' / ')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4">
            <CircularGauge
              value={live.cpu.usagePct}
              unit="%"
              label="CPU usage"
              icon={Cpu}
              color={live.cpu.usagePct > 85 ? '#ef4444' : live.cpu.usagePct > 60 ? '#eab308' : '#22c55e'}
            />
            <CircularGauge
              value={live.memory.usedPct}
              unit="%"
              label={`Memory (${Math.round(live.memory.usedMB / 1024)}/${Math.round(live.memory.totalMB / 1024)} GB)`}
              icon={MemoryStick}
              color={live.memory.usedPct > 85 ? '#ef4444' : live.memory.usedPct > 60 ? '#eab308' : '#22c55e'}
            />
            <CircularGauge
              value={live.memory.processRssMB}
              max={Math.max(live.memory.totalMB, 1)}
              unit="MB"
              label="Process RSS"
              icon={Activity}
              color="#06b6d4"
            />
            <div className="flex flex-col items-center justify-center gap-1">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-bold">{formatUptime(live.uptime.processSec)}</p>
              <p className="text-xs text-muted-foreground text-center">
                Process uptime
                <br />
                <span className="text-[10px]">host {formatUptime(live.uptime.systemSec)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Service / integration status ── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <Card key={svc.name} className="glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${svc.ok ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <svc.icon className={`h-4 w-4 ${svc.ok ? 'text-green-500' : 'text-red-500'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{svc.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[190px]" title={svc.detail}>
                        {svc.detail}
                      </p>
                    </div>
                  </div>
                  {svc.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* ── Latency ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Analysis latency (last 24h)</CardTitle>
            <CardDescription>Mean processing time per hour, measured from stored analyses</CardDescription>
          </CardHeader>
          <CardContent>
            {latency && latency.series.some((p) => p.count > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={latency.series}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={3} />
                  <YAxis tick={{ fontSize: 12 }} unit="ms" />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="analyze" name="Analyze" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="factcheck" name="Fact check" stroke="#eab308" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="other" name="Other" stroke="#a1a1aa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No analyses in the last 24 hours - latency chart will populate as work runs.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Failures ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Failed analyses
            </CardTitle>
            <CardDescription>Reports whose status is `failed` - the platform&apos;s real error log</CardDescription>
          </CardHeader>
          <CardContent>
            {latency && latency.failures.length > 0 ? (
              <div className="space-y-2">
                {latency.failures.map((f) => (
                  <div key={f.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30">
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                      {f.endpoint}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{f.description}</p>
                      <p className="text-[11px] text-muted-foreground">{relativeTime(f.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No failed analyses recorded.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Network interfaces ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Host details</CardTitle>
            <CardDescription>Reported by the running process</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Hostname</p>
              <p className="font-medium truncate">{live.os.hostname}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">OS release</p>
              <p className="font-medium truncate">{live.os.platform} {live.os.release}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last analysis</p>
              <p className="font-medium">{live.db.lastReportAt ? relativeTime(live.db.lastReportAt) : ' - '}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Network interfaces</p>
              <p className="font-medium truncate">
                {live.net.interfaces.length > 0
                  ? live.net.interfaces.map((i) => i.address).join(', ')
                  : 'none exposed'}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
