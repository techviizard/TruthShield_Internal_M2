'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  BarChart3, Download, Share2, TrendingUp, Activity,
  Shield, Clock, Zap, AlertTriangle, Eye, ArrowUpRight, ArrowDownRight,
  Camera, FileText, Video, Search, Map,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Date range types ───
type DateRange = '7d' | '30d' | '90d' | '1y'

// ─── Threat Trend Data ───





// ─── Geographic Heatmap Data (Indian States) ───
const stateHeatmapData = [
  { id: 'delhi', name: 'Delhi', x: 195, y: 115, path: 'M188,108 L205,105 L207,118 L192,122 Z' },
  { id: 'maharashtra', name: 'Maharashtra', x: 148, y: 280, path: 'M110,258 L190,252 L198,300 L165,315 L108,305 Z' },
  { id: 'karnataka', name: 'Karnataka', x: 170, y: 365, path: 'M135,335 L205,330 L210,385 L175,395 L130,380 Z' },
  { id: 'tamilnadu', name: 'Tamil Nadu', x: 200, y: 415, path: 'M180,395 L225,390 L230,440 L195,445 Z' },
  { id: 'kerala', name: 'Kerala', x: 160, y: 430, path: 'M145,395 L165,395 L172,455 L150,458 Z' },
  { id: 'gujarat', name: 'Gujarat', x: 100, y: 208, path: 'M62,178 L140,172 L145,228 L105,242 L58,225 Z' },
  { id: 'rajasthan', name: 'Rajasthan', x: 145, y: 142, path: 'M100,108 L195,100 L200,155 L148,168 L98,158 Z' },
  { id: 'up', name: 'Uttar Pradesh', x: 230, y: 145, path: 'M200,120 L275,115 L280,168 L235,178 L205,165 Z' },
  { id: 'bihar', name: 'Bihar', x: 278, y: 168, path: 'M258,152 L305,148 L310,190 L265,195 Z' },
  { id: 'wb', name: 'West Bengal', x: 310, y: 215, path: 'M295,190 L338,185 L342,240 L302,245 Z' },
  { id: 'mp', name: 'Madhya Pradesh', x: 185, y: 218, path: 'M145,195 L240,188 L245,248 L190,255 L145,238 Z' },
  { id: 'telangana', name: 'Telangana', x: 200, y: 315, path: 'M178,298 L230,292 L235,335 L185,340 Z' },
  { id: 'ap', name: 'Andhra Pradesh', x: 218, y: 368, path: 'M195,342 L248,335 L258,395 L215,400 Z' },
  { id: 'punjab', name: 'Punjab', x: 185, y: 82, path: 'M168,68 L205,62 L210,95 L178,100 Z' },
  { id: 'assam', name: 'Assam', x: 365, y: 148, path: 'M345,130 L398,125 L402,168 L352,175 Z' },
]

/** Canonical city (region-extractor) -> heat-map state id. */
const CITY_TO_STATE: Record<string, string> = {
  Delhi: 'delhi',
  Mumbai: 'maharashtra',
  Bangalore: 'karnataka',
  Chennai: 'tamilnadu',
  Kochi: 'kerala',
  Ahmedabad: 'gujarat',
  Jaipur: 'rajasthan',
  Lucknow: 'up',
  Patna: 'bihar',
  Kolkata: 'wb',
  Bhopal: 'mp',
  Hyderabad: 'telangana',
  Chandigarh: 'punjab',
  Guwahati: 'assam',
}

/** Map a real per-state count onto the 1..5 heat scale (0 = no data). */
function levelFromCount(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 0) return 1
  return Math.max(1, Math.min(5, Math.ceil((count / max) * 5)))
}

const TYPE_LABEL: Record<string, string> = {
  text_fake_news: 'Text Analysis',
  image_forensics: 'Image Forensics',
  video_deepfake: 'Video Analysis',
  fact_check: 'Fact Check',
  audio_deepfake: 'Audio Analysis',
}

const TYPE_COLOR: Record<string, string> = {
  text_fake_news: '#10b981',
  image_forensics: '#14b8a6',
  video_deepfake: '#06b6d4',
  fact_check: '#f59e0b',
  audio_deepfake: '#8b5cf6',
}

const threatLevelColors: Record<number, { fill: string; stroke: string; label: string }> = {
  0: { fill: 'rgba(113,113,122,0.12)', stroke: '#71717a', label: 'No data' },
  1: { fill: 'rgba(34,197,94,0.25)', stroke: '#22c55e', label: 'Low' },
  2: { fill: 'rgba(234,179,8,0.25)', stroke: '#eab308', label: 'Moderate' },
  3: { fill: 'rgba(249,115,22,0.25)', stroke: '#f97316', label: 'Medium' },
  4: { fill: 'rgba(239,68,68,0.30)', stroke: '#ef4444', label: 'High' },
  5: { fill: 'rgba(220,38,38,0.40)', stroke: '#dc2626', label: 'Critical' },
}

// ─── Sparkline Component ───
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

// ─── Custom Tooltip ───
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="glass border rounded-lg p-3 text-xs shadow-xl bg-background/90 backdrop-blur-sm">
      <p className="font-semibold mb-1.5 text-foreground">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export function DataVisualizationTab() {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const [liveTrends, setLiveTrends] = useState<Array<{ date: string; deepfake: number; misinformation: number; manipulation: number }> | null>(null)
  const [riskSeries, setRiskSeries] = useState<Array<{ date: string; critical: number; high: number; medium: number; low: number }>>([])
  const [typeMix, setTypeMix] = useState<Array<{ name: string; value: number; color: string }>>([])
  const [regionCounts, setRegionCounts] = useState<Record<string, number>>({})
  const [platformMetrics, setPlatformMetrics] = useState<
    Array<{ platform: string; volume: number; threatRate: number; severity: number; confidence: number; analyses: number }>
  >([])
  const [metrics, setMetrics] = useState<
    Array<{ label: string; value: string; up: boolean; icon: typeof Activity; sparkline: number[]; sparkColor: string; bgColor: string; textColor: string }>
  >([])

  // Every panel below is fed by these endpoints — no static series.
  useEffect(() => {
    let aborted = false
    fetch(`/api/datavis/trends?range=${dateRange}`)
      .then((r) => r.json())
      .then((j) => {
        if (aborted || !j?.success) return
        setLiveTrends(Array.isArray(j.trends) ? j.trends : null)
        setRiskSeries(Array.isArray(j.riskSeries) ? j.riskSeries : [])
        setRegionCounts(j.regions ?? {})
        setPlatformMetrics(Array.isArray(j.platformMetrics) ? j.platformMetrics : [])
        const total = (j.types ?? []).reduce((sum: number, t: { count: number }) => sum + t.count, 0) || 1
        setTypeMix(
          (j.types ?? []).map((t: { type: string; count: number }) => ({
            name: TYPE_LABEL[t.type] ?? t.type,
            value: Math.round((t.count / total) * 100),
            color: TYPE_COLOR[t.type] ?? '#a1a1aa',
          })),
        )
      })
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [dateRange])

  useEffect(() => {
    let aborted = false
    Promise.all([
      fetch('/api/dashboard/stats').then((r) => r.json()).catch(() => null),
      fetch('/api/dashboard/model-perf').then((r) => r.json()).catch(() => null),
      fetch('/api/dashboard/sparklines').then((r) => r.json()).catch(() => null),
    ]).then(([st, mp, sp]) => {
      if (aborted || !st?.success) return
      const sparks = sp?.sparklines ?? {}
      setMetrics([
        {
          label: 'Total Analyses',
          value: (st.stats?.totalAnalyses ?? 0).toLocaleString(),
          up: true,
          icon: Activity,
          sparkline: sparks.totalAnalyses ?? [],
          sparkColor: '#10b981',
          bgColor: 'bg-zinc-500/10',
          textColor: 'text-zinc-500',
        },
        {
          label: 'Avg Trust Score',
          value: String(st.stats?.avgTrustScore ?? 0),
          up: true,
          icon: Shield,
          sparkline: sparks.avgTrustScore ?? [],
          sparkColor: '#14b8a6',
          bgColor: 'bg-zinc-500/10',
          textColor: 'text-zinc-500',
        },
        {
          label: 'High-risk Rate',
          value: `${mp?.detectionAccuracy ?? 0}%`,
          up: true,
          icon: Eye,
          sparkline: sparks.fakeNewsDetected ?? [],
          sparkColor: '#06b6d4',
          bgColor: 'bg-cyan-500/10',
          textColor: 'text-cyan-500',
        },
        {
          label: 'Closed w/o Escalation',
          value: `${mp?.falsePositiveRate ?? 0}%`,
          up: false,
          icon: AlertTriangle,
          sparkline: [],
          sparkColor: '#f59e0b',
          bgColor: 'bg-amber-500/10',
          textColor: 'text-amber-500',
        },
        {
          label: 'Avg Processing',
          value: `${((mp?.avgProcessingMs ?? 0) / 1000).toFixed(2)}s`,
          up: false,
          icon: Clock,
          sparkline: [],
          sparkColor: '#8b5cf6',
          bgColor: 'bg-violet-500/10',
          textColor: 'text-violet-500',
        },
        {
          label: 'Active Alerts',
          value: String(st.stats?.activeAlerts ?? 0),
          up: true,
          icon: Zap,
          sparkline: sparks.activeAlerts ?? [],
          sparkColor: '#ef4444',
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-500',
        },
      ])
    })
    return () => {
      aborted = true
    }
  }, [])

  // Heat-map levels from real per-region counts.
  const stateLevels = (() => {
    const byState: Record<string, number> = {}
    for (const [city, count] of Object.entries(regionCounts)) {
      const id = CITY_TO_STATE[city]
      if (id) byState[id] = (byState[id] ?? 0) + count
    }
    const max = Math.max(0, ...Object.values(byState))
    const levels: Record<string, number> = {}
    for (const st of stateHeatmapData) levels[st.id] = levelFromCount(byState[st.id] ?? 0, max)
    return { levels, counts: byState }
  })()

  const currentTrendData = liveTrends ?? []

  // Real export: writes the data actually rendered on this tab to a JSON file.
  const handleExportData = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      range: dateRange,
      keyMetrics: metrics.map((m) => ({ label: m.label, value: m.value })),
      threatTrends: currentTrendData,
      riskSeries,
      analysisTypeMix: typeMix,
      regionCounts,
      platformMetrics,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `truthshield-datavis-${dateRange}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Dashboard data exported')
  }, [dateRange, metrics, currentTrendData, riskSeries, typeMix, regionCounts, platformMetrics])

  const handleShareLink = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Dashboard link copied to clipboard!')
    }
  }, [])

  const dateRangeButtons: { key: DateRange; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '1y', label: '1Y' },
  ]

  return (
    <div className="space-y-6" ref={dashboardRef}>
      {/* ───── Header Section ───── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass border rounded-xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="p-3 rounded-xl bg-zinc-500/10">
                    <BarChart3 className="h-8 w-8 text-zinc-500" />
                  </div>
                  <div className="absolute -inset-1 rounded-xl bg-zinc-500/20 blur-md" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Data Visualization Dashboard</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Interactive charts and analytics for threat intelligence</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Date Range Selector */}
                <div className="flex items-center bg-muted/30 rounded-lg border p-0.5">
                  {dateRangeButtons.map((btn) => (
                    <Button
                      key={btn.key}
                      variant={dateRange === btn.key ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-8 px-3 text-xs font-medium ${
                        dateRange === btn.key
                          ? 'bg-zinc-500 text-white hover:bg-zinc-600'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setDateRange(btn.key)}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
                {/* Export & Share */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleExportData}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleShareLink}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ───── Key Metrics Row ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="glass border rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${metric.bgColor}`}>
                      <metric.icon className={`h-5 w-5 ${metric.textColor}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="text-2xl font-bold">{metric.value}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-zinc-500">
                    {metric.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  </div>
                </div>
                {metric.sparkline.length > 1 && (
                  <div className="mt-2 flex justify-end">
                    <Sparkline data={metric.sparkline} color={metric.sparkColor} />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Gradient Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-500/30 to-transparent" />

      {/* ───── Threat Trend Chart + Analysis Type Breakdown ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Threat Trend Chart - Area Chart */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="glass border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-zinc-500" />
                    Threat Trend Analysis
                  </CardTitle>
                  <CardDescription>Threats over time by category</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {dateRange === '7d' ? 'Daily' : dateRange === '30d' ? 'Weekly' : dateRange === '90d' ? 'Monthly' : 'Quarterly'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={currentTrendData}>
                  <defs>
                    <linearGradient id="gradDeepfake" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMisinfo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradManip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="deepfake"
                    stroke="#ef4444"
                    fill="url(#gradDeepfake)"
                    strokeWidth={2}
                    name="Deepfake"
                    animationDuration={1200}
                  />
                  <Area
                    type="monotone"
                    dataKey="misinformation"
                    stroke="#f97316"
                    fill="url(#gradMisinfo)"
                    strokeWidth={2}
                    name="Misinformation"
                    animationDuration={1200}
                    animationBegin={200}
                  />
                  <Area
                    type="monotone"
                    dataKey="manipulation"
                    stroke="#eab308"
                    fill="url(#gradManip)"
                    strokeWidth={2}
                    name="Manipulation"
                    animationDuration={1200}
                    animationBegin={400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Analysis Type Breakdown - Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-zinc-500" />
                Analysis Type Breakdown
              </CardTitle>
              <CardDescription>Distribution of analysis types</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={typeMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    animationDuration={1000}
                  >
                    {typeMix.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Percentage labels */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {typeMix.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium ml-auto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ───── Risk Level Distribution + Geographic Heatmap ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Level Distribution - Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="glass border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Risk Level Distribution
              </CardTitle>
              <CardDescription>Risk breakdown by severity across the selected range</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={riskSeries}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="critical" fill="#ef4444" radius={[2, 2, 0, 0]} name="Critical" animationDuration={800} />
                  <Bar dataKey="high" fill="#f97316" radius={[2, 2, 0, 0]} name="High" animationDuration={800} animationBegin={100} />
                  <Bar dataKey="medium" fill="#eab308" radius={[2, 2, 0, 0]} name="Medium" animationDuration={800} animationBegin={200} />
                  <Bar dataKey="low" fill="#22c55e" radius={[2, 2, 0, 0]} name="Low" animationDuration={800} animationBegin={300} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Geographic Heatmap - SVG India Map */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Map className="h-4 w-4 text-zinc-500" />
                Geographic Threat Heatmap
              </CardTitle>
              <CardDescription>Threat density across Indian states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <svg viewBox="0 0 440 520" className="w-full h-auto" style={{ maxHeight: '320px' }}>
                  {/* India outline (accurate) */}
                  <path
                    d="M 175 32 C 172 36, 167 42, 163 48 L 156 52 L 150 44 L 142 46 L 138 54 L 146 62 L 150 68 L 154 62 L 162 58 L 167 60 L 169 68 L 174 72 L 181 68 L 188 66 L 192 58 L 195 50 L 200 42 L 209 38 L 218 40 L 227 48 L 235 55 L 244 60 L 255 62 L 262 58 L 269 52 L 274 44 L 279 42 L 288 46 L 296 52 L 302 62 L 306 72 L 312 80 L 324 88 L 332 92 L 340 98 L 348 106 C 350 110, 354 118, 358 124 L 364 128 L 370 132 L 367 138 L 358 142 L 350 138 L 340 140 L 332 138 L 320 142 L 314 152 L 318 160 L 324 166 L 332 172 L 340 178 L 348 188 C 350 196, 352 204, 348 210 L 340 214 L 332 218 L 322 230 L 314 238 L 308 248 L 305 258 L 298 266 L 290 272 C 282 280, 278 288, 276 296 L 272 308 L 268 318 L 262 326 L 255 334 L 248 344 L 242 354 L 235 362 L 230 370 L 225 378 L 218 386 L 212 398 L 209 408 L 205 418 L 202 426 L 197 434 L 192 442 L 188 452 L 185 462 L 181 472 L 178 480 L 174 488 L 172 498 L 174 508 L 179 516 L 185 520 L 192 518 L 197 512 L 200 504 L 204 498 L 207 506 L 209 514 L 210 520 L 207 528 C 204 534, 199 538, 193 542 L 185 544 L 178 540 L 170 534 L 165 526 L 160 518 L 156 508 L 149 500 L 144 492 L 138 486 L 133 476 L 130 466 L 125 456 L 121 446 L 118 436 L 114 426 C 110 418, 107 410, 103 402 L 100 394 L 95 386 L 88 380 L 80 374 C 75 368, 70 360, 66 352 L 64 342 L 66 332 C 70 324, 75 316, 78 308 L 84 298 L 86 288 L 84 278 C 80 268, 77 258, 75 248 L 72 238 L 70 228 L 68 218 C 68 208, 72 200, 75 192 L 80 184 L 86 176 C 91 168, 96 162, 102 158 L 108 154 L 115 148 C 122 142, 130 138, 136 134 L 144 128 L 148 120 C 152 112, 156 104, 160 96 L 163 86 L 167 76 C 169 68, 171 58, 173 48 L 175 32 Z"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted-foreground/30"
                    strokeWidth="1.5"
                    strokeDasharray="4,2"
                  />

                  {/* State regions */}
                  {stateHeatmapData.map((state) => {
                    const level = stateLevels.levels[state.id] ?? 0
                    const levelConfig = threatLevelColors[level]
                    return (
                      <g
                        key={state.id}
                        onMouseEnter={() => setHoveredState(state.id)}
                        onMouseLeave={() => setHoveredState(null)}
                        className="cursor-pointer"
                      >
                        <path
                          d={state.path}
                          fill={levelConfig.fill}
                          stroke={levelConfig.stroke}
                          strokeWidth={hoveredState === state.id ? 2 : 1}
                          className="transition-all duration-200"
                          style={{ opacity: hoveredState === state.id ? 1 : 0.7 }}
                        />
                        {/* State dot */}
                        <circle
                          cx={state.x}
                          cy={state.y}
                          r={hoveredState === state.id ? 5 : 3}
                          fill={levelConfig.stroke}
                          className="transition-all duration-200"
                        />
                        {hoveredState === state.id && (
                          <>
                            <circle
                              cx={state.x}
                              cy={state.y}
                              r={12}
                              fill="none"
                              stroke={levelConfig.stroke}
                              strokeWidth="1"
                              opacity={0.4}
                              className="animate-ping"
                            />
                            {/* Tooltip */}
                            <rect
                              x={state.x - 55}
                              y={state.y - 42}
                              width="110"
                              height="32"
                              rx="6"
                              fill="hsl(var(--card))"
                              stroke="hsl(var(--border))"
                              strokeWidth="1"
                            />
                            <text
                              x={state.x}
                              y={state.y - 26}
                              textAnchor="middle"
                              className="text-[9px] font-semibold fill-foreground"
                            >
                              {state.name}
                            </text>
                            <text
                              x={state.x}
                              y={state.y - 15}
                              textAnchor="middle"
                              className="text-[8px] fill-muted-foreground"
                            >
                              {levelConfig.label} Threat
                            </text>
                          </>
                        )}
                      </g>
                    )
                  })}

                  {/* Ocean labels */}
                  <text x="60" y="360" className="text-[9px] fill-muted-foreground/40 italic" transform="rotate(-15, 60, 360)">Arabian Sea</text>
                  <text x="360" y="380" className="text-[9px] fill-muted-foreground/40 italic" transform="rotate(15, 360, 380)">Bay of Bengal</text>
                  <text x="180" y="510" className="text-[9px] fill-muted-foreground/40 italic">Indian Ocean</text>
                </svg>

                {/* Legend */}
                <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                  {Object.entries(threatLevelColors).map(([level, config]) => (
                    <div key={level} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: config.stroke, opacity: 0.7 }} />
                      <span className="text-muted-foreground">{config.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ───── Platform Comparison - Radar Chart ───── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="glass border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-zinc-500" />
                  Platform Comparison
                </CardTitle>
                <CardDescription>Threat levels across social media platforms</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                {['WhatsApp', 'Twitter', 'Facebook', 'Instagram', 'Telegram'].map((p) => (
                  <div key={p} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-500" />
                    <span className="text-muted-foreground">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6 items-center">
              <div className="w-full lg:w-1/2">
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart data={platformMetrics}>
                    <PolarGrid className="opacity-30" />
                    <PolarAngleAxis
                      dataKey="platform"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 9 }}
                      className="text-muted-foreground"
                    />
                    <Radar
                      name="Threat rate %"
                      dataKey="threatRate"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Radar
                      name="Severity"
                      dataKey="severity"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Radar
                      name="Model confidence"
                      dataKey="confidence"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full lg:w-1/2 space-y-3">
                {platformMetrics.map((platform, pIdx) => (
                  <motion.div
                    key={platform.platform}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + pIdx * 0.08 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-500/10">
                      {platform.platform === 'WhatsApp' && <Camera className="h-4 w-4 text-zinc-500" />}
                      {platform.platform === 'Twitter/X' && <FileText className="h-4 w-4 text-blue-500" />}
                      {platform.platform === 'Facebook' && <Video className="h-4 w-4 text-indigo-500" />}
                      {platform.platform === 'Instagram' && <Camera className="h-4 w-4 text-pink-500" />}
                      {platform.platform === 'Telegram' && <Search className="h-4 w-4 text-sky-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{platform.platform}</span>
                        <span className="text-xs text-muted-foreground">{platform.analyses} analyses · {platform.threatRate}% high-risk</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(to right, #22c55e, #eab308, #ef4444)`,
                            width: `${platform.threatRate}%`,
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${platform.threatRate}%` }}
                          transition={{ duration: 1, delay: 0.6 + pIdx * 0.1 }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>Volume idx: {platform.volume}</span>
                        <span>Severity: {platform.severity}</span>
                        <span>Confidence: {platform.confidence}%</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ───── Export & Share Footer Card ───── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass border rounded-xl bg-gradient-to-r from-zinc-500/5 via-transparent to-zinc-500/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-500/10">
                  <Download className="h-4 w-4 text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Export & Share Dashboard</p>
                  <p className="text-xs text-muted-foreground">Download the rendered dataset as JSON, or copy a link to this dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs hover:bg-zinc-500/10 hover:border-zinc-500/30"
                  onClick={handleExportData}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download data (JSON)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs hover:bg-zinc-500/10 hover:border-zinc-500/30"
                  onClick={handleShareLink}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share Link
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
