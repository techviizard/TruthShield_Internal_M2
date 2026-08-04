'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Shield, AlertTriangle, Clock, Eye, Zap,
  TrendingUp, Radio, Pause, Play, RefreshCw, Search,
  AlertOctagon, Brain, MessageCircle, MapPin, ExternalLink,
  CheckCircle2, XCircle, Settings, ChevronDown, Filter,
  Globe, Smartphone, Share2, Link2, Flame, BarChart3,
  Map, Bell, ToggleLeft, ToggleRight, Pencil,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'

// ── Types ──────────────────────────────────────────────────────

type ThreatType = 'Deepfake' | 'Misinformation' | 'Manipulation' | 'Phishing'
type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low'
type Platform = 'WhatsApp' | 'Twitter/X' | 'Facebook' | 'Instagram' | 'Telegram'

interface ThreatEntry {
  id: string
  type: ThreatType
  severity: ThreatSeverity
  title: string
  description: string
  platform: Platform
  timestamp: string
  region: string
  confidence: number
  sourceUrl: string
  isNew?: boolean
}

interface AlertRule {
  id: string
  description: string
  enabled: boolean
  icon: React.ElementType
}

// ── Mock Data ──────────────────────────────────────────────────


// ── Config Maps ────────────────────────────────────────────────

const severityConfig: Record<ThreatSeverity, { bg: string; text: string; border: string; dot: string; icon: React.ElementType; color: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30', dot: 'bg-red-500', icon: AlertOctagon, color: '#ef4444' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500', icon: AlertTriangle, color: '#f97316' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-500', icon: Clock, color: '#eab308' },
  low: { bg: 'bg-zinc-500/10', text: 'text-zinc-600 dark:text-zinc-400', border: 'border-zinc-500/30', dot: 'bg-zinc-500', icon: Shield, color: '#10b981' },
}

const typeConfig: Record<ThreatType, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Deepfake: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', icon: Eye },
  Misinformation: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30', icon: MessageCircle },
  Manipulation: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', icon: Share2 },
  Phishing: { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30', icon: Link2 },
}

const platformConfig: Record<Platform, { icon: React.ElementType; color: string; bg: string }> = {
  'WhatsApp': { icon: Smartphone, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
  'Twitter/X': { icon: Globe, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
  'Facebook': { icon: Globe, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  'Instagram': { icon: Smartphone, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-500/10' },
  'Telegram': { icon: Smartphone, color: 'text-sky-500 dark:text-sky-300', bg: 'bg-sky-400/10' },
}

// ── Mini Sparkline Component ───────────────────────────────────

function MiniSparkline({ data, color = '#10b981', width = 80, height = 24 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Mini Donut Chart Component ─────────────────────────────────

function MiniDonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const cx = 50
  const cy = 50
  const r = 35
  const circumference = 2 * Math.PI * r

  const cumulativeValues = segments.reduce<number[]>((acc, seg, i) => {
    acc.push((acc[i - 1] ?? 0) + seg.value)
    return acc
  }, [])
  const arcs = segments.map((seg, i) => {
    const fraction = seg.value / total
    const dashLength = fraction * circumference
    const gapLength = circumference - dashLength
    const rotation = (((cumulativeValues[i] - seg.value)) / total) * 360 - 90
    return { ...seg, dashLength, gapLength, rotation, fraction }
  })

  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="8" opacity={0.08} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="8"
            strokeDasharray={`${arc.dashLength} ${arc.gapLength}`}
            transform={`rotate(${arc.rotation} ${cx} ${cy})`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground text-[11px] font-bold">47</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground text-[7px]">threats</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground whitespace-nowrap">{seg.label}</span>
            <span className="font-semibold text-foreground">{seg.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Threat Map Preview ─────────────────────────────────────────

function ThreatMapPreview() {
  const cities = [
    { name: 'Delhi', x: 222, y: 148, threats: 12, severity: 'critical' as const },
    { name: 'Mumbai', x: 160, y: 328, threats: 9, severity: 'high' as const },
    { name: 'Chennai', x: 238, y: 445, threats: 6, severity: 'high' as const },
    { name: 'Kolkata', x: 340, y: 270, threats: 5, severity: 'medium' as const },
    { name: 'Bangalore', x: 210, y: 445, threats: 7, severity: 'high' as const },
    { name: 'Hyderabad', x: 225, y: 370, threats: 4, severity: 'medium' as const },
    { name: 'Jaipur', x: 193, y: 175, threats: 3, severity: 'medium' as const },
    { name: 'Lucknow', x: 262, y: 178, threats: 5, severity: 'high' as const },
    { name: 'Patna', x: 305, y: 195, threats: 4, severity: 'medium' as const },
    { name: 'Guwahati', x: 395, y: 195, threats: 2, severity: 'low' as const },
  ]

  const sevColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#10b981',
  }

  return (
    <svg viewBox="0 0 500 600" className="w-full h-auto max-h-[200px]">
      {/* India outline (accurate) */}
      <path
        d={`M 200 42 C 196 46, 190 52, 186 58 L 178 62 L 172 54 L 162 56 L 158 64 L 166 72 L 172 78 L 176 72 L 184 68 L 190 70 L 192 78 L 198 82 L 206 78 L 214 76 L 218 68 L 222 60 L 228 52 L 238 48 L 248 50 L 258 58 L 268 65 L 278 70 L 290 72 L 298 68 L 306 62 L 312 54 L 318 52 L 328 56 L 338 62 L 345 72 L 350 82 L 356 90 L 370 98 L 380 102 L 388 108 L 396 116 C 398 120, 402 128, 406 134 L 414 138 L 422 142 L 418 148 L 408 152 L 398 148 L 388 150 L 378 148 L 365 152 L 358 162 L 362 170 L 370 176 L 378 182 L 388 188 L 395 198 C 398 206, 400 214, 396 220 L 388 224 L 378 228 L 368 240 L 358 248 L 352 258 L 348 268 L 340 276 L 332 282 C 322 290, 318 298, 316 306 L 312 318 L 306 328 L 298 336 L 290 344 L 282 354 L 276 364 L 268 372 L 262 380 L 256 388 L 248 396 L 242 408 L 238 418 L 234 428 L 230 436 L 224 444 L 218 452 L 214 462 L 210 472 L 206 482 L 202 490 L 198 498 L 196 508 L 198 518 L 204 526 L 210 530 L 218 528 L 224 522 L 228 514 L 232 508 L 236 516 L 238 524 L 240 530 L 236 538 C 232 544, 226 548, 220 552 L 210 554 L 202 550 L 194 544 L 188 536 L 182 528 L 178 518 L 170 510 L 164 502 L 158 496 L 152 486 L 148 476 L 142 466 L 138 456 L 134 446 L 130 436 C 126 428, 122 420, 118 412 L 114 404 L 108 396 L 100 390 L 92 384 C 86 378, 80 370, 76 362 L 74 352 L 76 342 C 80 334, 86 326, 90 318 L 96 308 L 98 298 L 96 288 C 92 278, 88 268, 86 258 L 82 248 L 80 238 L 78 228 C 78 218, 82 210, 86 202 L 92 194 L 98 186 C 104 178, 110 172, 116 168 L 124 164 L 132 158 C 140 152, 148 148, 156 144 L 164 138 L 170 130 C 174 122, 178 114, 182 106 L 186 96 L 190 86 C 192 78, 194 68, 196 58 L 200 42 Z`}
        fill="currentColor"
        opacity="0.05"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.15"
      />
      {/* Threat dots */}
      {cities.map((city) => (
        <g key={city.name}>
          <circle
            cx={city.x}
            cy={city.y}
            r={Math.max(4, Math.min(city.threats, 10))}
            fill={sevColors[city.severity]}
            opacity={0.3}
          />
          <circle
            cx={city.x}
            cy={city.y}
            r={3}
            fill={sevColors[city.severity]}
          />
          <text
            x={city.x}
            y={city.y - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="6"
          >
            {city.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Threat Feed Entry Component ────────────────────────────────

function ThreatFeedEntry({ threat, index }: { threat: ThreatEntry; index: number }) {
  const sev = severityConfig[threat.severity]
  const type = typeConfig[threat.type]
  const plat = platformConfig[threat.platform]
  const SevIcon = sev.icon
  const TypeIcon = type.icon
  const PlatIcon = plat.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3, delay: threat.isNew ? 0 : index * 0.03 }}
      layout
    >
      <div
        className={`relative rounded-lg border bg-background/50 p-3 md:p-4 hover:bg-background/80 transition-all hover:shadow-md group ${
          threat.severity === 'critical' ? `border-l-4 ${sev.border}` : `border-l-2 ${sev.border}`
        }`}
      >
        {/* Severity dot for critical */}
        {threat.severity === 'critical' && (
          <motion.div
            className="absolute top-2 right-2"
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          </motion.div>
        )}

        {/* New badge */}
        {threat.isNew && (
          <Badge className="absolute top-2 right-8 bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 text-[9px] border animate-pulse">
            NEW
          </Badge>
        )}

        <div className="flex flex-col gap-2">
          {/* Top row: type badge + platform + timestamp + region */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${type.bg} ${type.text} ${type.border} text-[10px] border flex items-center gap-1`}>
              <TypeIcon className="h-3 w-3" />
              {threat.type}
            </Badge>
            <Badge className={`${plat.bg} ${plat.color} text-[10px] border border-border/30 flex items-center gap-1`}>
              <PlatIcon className="h-3 w-3" />
              {threat.platform}
            </Badge>
            <Badge variant="outline" className="text-[10px] flex items-center gap-1">
              <MapPin className="h-3 w-3 text-zinc-500" />
              {threat.region}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {threat.timestamp}
            </span>
          </div>

          {/* Title and description */}
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <SevIcon className={`h-4 w-4 shrink-0 ${sev.text}`} />
              {threat.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{threat.description}</p>
          </div>

          {/* Confidence bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Confidence</span>
                <span className={`text-[10px] font-bold ${threat.confidence >= 80 ? 'text-red-500' : threat.confidence >= 60 ? 'text-amber-500' : 'text-zinc-500'}`}>
                  {threat.confidence}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: threat.confidence >= 80 ? '#ef4444' : threat.confidence >= 60 ? '#f97316' : '#10b981' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${threat.confidence}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
            </div>
          </div>

          {/* Action buttons + source */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 hover:bg-zinc-500/10 hover:text-zinc-600 hover:border-zinc-500/30"
                onClick={() => {}}
              >
                <Search className="h-3 w-3 mr-1" />
                Investigate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 hover:bg-sky-500/10 hover:text-sky-600 hover:border-sky-500/30"
                onClick={() => {}}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verify
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 hover:bg-muted"
                onClick={() => {}}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Dismiss
              </Button>
            </div>
            <a
              href={threat.sourceUrl}
              className="text-[10px] text-muted-foreground hover:text-zinc-500 flex items-center gap-1 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              <ExternalLink className="h-3 w-3" />
              Source
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export function LiveThreatFeedTab() {
  // Feed state — populated from /api/live-feed (DB-derived), empty until first response
  const [threats, setThreats] = useState<ThreatEntry[]>([])
  const [feedLoaded, setFeedLoaded] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState<30 | 60 | 300>(30)
  const lastSeenId = useRef<string | null>(null)

  const refetchLive = useCallback(async () => {
    try {
      const j = await fetch('/api/live-feed').then((r) => r.json())
      if (!j?.success || !Array.isArray(j.threats)) return
      if (j.threats.length === 0) {
        setThreats([])
        setFeedLoaded(true)
        return
      }
      const mapped: ThreatEntry[] = j.threats.map((t: {
        id: string; type: ThreatType; severity: ThreatSeverity; title: string; description: string;
        platform: Platform; timestamp: string; region: string; confidence: number; sourceUrl: string;
      }) => ({
        id: t.id, type: t.type, severity: t.severity, title: t.title, description: t.description,
        platform: t.platform, timestamp: t.timestamp, region: t.region, confidence: t.confidence,
        sourceUrl: t.sourceUrl,
        isNew: lastSeenId.current !== null && t.id !== lastSeenId.current,
      }))
      lastSeenId.current = mapped[0]?.id ?? lastSeenId.current
      setThreats(mapped)
      setFeedLoaded(true)
      setTimeout(() => {
        setThreats((prev) => prev.map((t) => ({ ...t, isNew: false })))
      }, 5000)
    } catch { /* keep current */ }
  }, [])

  useEffect(() => { refetchLive() }, [refetchLive])

  // Filter state
  const [typeFilter, setTypeFilter] = useState<'All' | ThreatType>('All')
  const [severityFilter, setSeverityFilter] = useState<'All' | ThreatSeverity>('All')
  const [platformFilter, setPlatformFilter] = useState<'All' | Platform>('All')

  // Alert rules state
  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    { id: 'ar1', description: 'Alert when deepfake confidence > 80%', enabled: true, icon: Eye },
    { id: 'ar2', description: 'Alert when misinformation goes viral (>10K shares)', enabled: true, icon: TrendingUp },
    { id: 'ar3', description: 'Alert when new campaign detected', enabled: false, icon: Radio },
  ])

  // New threat simulation
  const newThreatCounter = useRef(16)
  const feedRef = useRef<HTMLDivElement>(null)

  // Poll real DB for new threats
  const addNewThreat = useCallback(() => {
    if (isPaused) return
    refetchLive()
  }, [isPaused, refetchLive])

  useEffect(() => {
    if (!autoRefresh || isPaused) return
    const interval = setInterval(addNewThreat, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [autoRefresh, isPaused, refreshInterval, addNewThreat])

  // Filter threats
  const filteredThreats = threats.filter((t) => {
    if (typeFilter !== 'All' && t.type !== typeFilter) return false
    if (severityFilter !== 'All' && t.severity !== severityFilter) return false
    if (platformFilter !== 'All' && t.platform !== platformFilter) return false
    return true
  })

  // Stats
  const threatTrendData = [32, 38, 35, 42, 47, 44, 47]
  const trendingTypes = [
    { name: 'Deepfake', count: 18, color: '#a855f7' },
    { name: 'Misinformation', count: 15, color: '#ef4444' },
    { name: 'Phishing', count: 9, color: '#06b6d4' },
  ]
  const hotRegions = [
    { city: 'Delhi', threats: 12, trend: '+3' },
    { city: 'Mumbai', threats: 9, trend: '+2' },
    { city: 'Bangalore', threats: 7, trend: '+1' },
  ]
  const platformDistribution = [
    { label: 'WhatsApp', value: 35, color: '#22c55e' },
    { label: 'Twitter/X', value: 28, color: '#0ea5e9' },
    { label: 'Facebook', value: 22, color: '#3b82f6' },
    { label: 'Instagram', value: 10, color: '#ec4899' },
    { label: 'Telegram', value: 5, color: '#64748b' },
  ]

  const toggleAlertRule = (id: string) => {
    setAlertRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── 1. Header Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-zinc-500/10 via-zinc-500/5 to-transparent border-zinc-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-500/5 via-transparent to-transparent" />
          <CardContent className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="relative">
                <motion.div
                  className="p-3 rounded-xl bg-zinc-500/10 border border-zinc-500/20"
                  animate={{ boxShadow: ['0 0 0px rgba(16,185,129,0.2)', '0 0 20px rgba(16,185,129,0.3)', '0 0 0px rgba(16,185,129,0.2)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Activity className="h-8 w-8 text-zinc-500" />
                </motion.div>
                <motion.div
                  className="absolute -inset-2 rounded-xl bg-zinc-500/10 blur-xl -z-10"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {/* Red pulse accent */}
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-zinc-600 to-zinc-600 dark:from-zinc-400 dark:to-zinc-400 bg-clip-text text-transparent">
                    Live Threat Feed
                  </h2>
                  <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 text-[10px] flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                    LIVE
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground max-w-xl">
                  Real-time monitoring of digital threats across platforms
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Auto-refresh: {autoRefresh ? `${refreshInterval === 30 ? '30s' : refreshInterval === 60 ? '1m' : '5m'}` : 'Off'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 2. Feed Controls Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="glass">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col gap-3">
              {/* Row 1: Type filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground font-medium shrink-0">Type:</span>
                {(['All', 'Deepfake', 'Misinformation', 'Manipulation', 'Phishing'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={typeFilter === type ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 text-[10px] px-2.5 ${
                      typeFilter === type ? 'bg-gradient-to-r from-zinc-600 to-zinc-600 text-white border-0' : ''
                    }`}
                    onClick={() => setTypeFilter(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>

              {/* Row 2: Severity + Platform + Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Severity filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium shrink-0">Severity:</span>
                  {(['All', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                    <Button
                      key={sev}
                      variant={severityFilter === sev ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 text-[10px] px-2.5 capitalize ${
                        severityFilter === sev ? 'bg-gradient-to-r from-zinc-600 to-zinc-600 text-white border-0' : ''
                      }`}
                      onClick={() => setSeverityFilter(sev)}
                    >
                      {sev === 'All' ? 'All' : sev}
                    </Button>
                  ))}
                </div>

                {/* Platform filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium shrink-0">Platform:</span>
                  {(['All', 'WhatsApp', 'Twitter/X', 'Facebook', 'Instagram', 'Telegram'] as const).map((plat) => (
                    <Button
                      key={plat}
                      variant={platformFilter === plat ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 text-[10px] px-2.5 ${
                        platformFilter === plat ? 'bg-gradient-to-r from-zinc-600 to-zinc-600 text-white border-0' : ''
                      }`}
                      onClick={() => setPlatformFilter(plat)}
                    >
                      {plat}
                    </Button>
                  ))}
                </div>

                <div className="flex-1" />

                {/* Controls */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Auto-refresh toggle + interval */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Auto-refresh</span>
                    <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} className="scale-75" />
                    {autoRefresh && (
                      <div className="flex items-center gap-1">
                        {([30, 60, 300] as const).map((sec) => (
                          <Button
                            key={sec}
                            variant={refreshInterval === sec ? 'default' : 'outline'}
                            size="sm"
                            className={`h-6 text-[9px] px-1.5 ${
                              refreshInterval === sec ? 'bg-zinc-600 text-white' : ''
                            }`}
                            onClick={() => setRefreshInterval(sec)}
                          >
                            {sec === 30 ? '30s' : sec === 60 ? '1m' : '5m'}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pause/Play */}
                  <Button
                    variant={isPaused ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 text-[10px] px-3 ${
                      isPaused ? 'bg-zinc-600 text-white' : ''
                    }`}
                    onClick={() => setIsPaused(!isPaused)}
                  >
                    {isPaused ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 3. Main Content: Feed + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Feed Stream */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="glass">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Radio className="h-4 w-4 text-zinc-500" />
                    Live Threat Stream
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {filteredThreats.length} threats
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {!isPaused && (
                      <motion.div
                        className="flex items-center gap-1.5 text-[10px] text-zinc-500"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Streaming
                      </motion.div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={feedRef} className="max-h-[600px] overflow-y-auto custom-scrollbar space-y-3 pr-1">
                  <AnimatePresence mode="popLayout">
                    {filteredThreats.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">
                          {!feedLoaded
                            ? 'Connecting to live feed…'
                            : threats.length === 0
                              ? 'No threats detected yet — run an analysis to populate the feed'
                              : 'No threats match current filters'}
                        </p>
                      </motion.div>
                    ) : (
                      filteredThreats.map((threat, i) => (
                        <ThreatFeedEntry key={threat.id} threat={threat} index={i} />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Threat Statistics Sidebar */}
        <div className="space-y-4">
          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-zinc-500" />
                  Threat Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Threats last 24h */}
                <div className="p-3 rounded-lg border border-border/30 bg-background/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Threats last 24h</span>
                    <span className="text-xl font-bold">47</span>
                  </div>
                  <MiniSparkline data={threatTrendData} color="#10b981" />
                </div>

                {/* Critical alerts */}
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-muted-foreground">Critical Alerts</span>
                    <span className="ml-auto text-xl font-bold text-red-500">8</span>
                  </div>
                </div>

                {/* Trending threat types */}
                <div className="p-3 rounded-lg border border-border/30 bg-background/30">
                  <span className="text-xs text-muted-foreground block mb-2">Trending Threat Types</span>
                  <div className="space-y-2">
                    {trendingTypes.map((item) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium">{item.name}</span>
                          <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: item.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.count / 18) * 100}%` }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hot regions */}
                <div className="p-3 rounded-lg border border-border/30 bg-background/30">
                  <span className="text-xs text-muted-foreground block mb-2">Hot Regions</span>
                  <div className="space-y-2">
                    {hotRegions.map((region, i) => (
                      <div key={region.city} className="flex items-center gap-2">
                        <Flame className={`h-3.5 w-3.5 ${i === 0 ? 'text-red-500' : i === 1 ? 'text-orange-500' : 'text-amber-500'}`} />
                        <span className="text-xs font-medium flex-1">{region.city}</span>
                        <span className="text-xs text-muted-foreground">{region.threats} threats</span>
                        <Badge variant="outline" className="text-[9px] text-red-500 border-red-500/20 px-1 py-0">
                          {region.trend}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Platform distribution donut */}
                <div className="p-3 rounded-lg border border-border/30 bg-background/30">
                  <span className="text-xs text-muted-foreground block mb-3">Platform Distribution</span>
                  <MiniDonutChart segments={platformDistribution} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Threat Map Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Map className="h-4 w-4 text-zinc-500" />
                  Threat Map
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ThreatMapPreview />
              </CardContent>
            </Card>
          </motion.div>

          {/* Alert Rules Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-zinc-500" />
                  Alert Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {alertRules.map((rule) => {
                  const RuleIcon = rule.icon
                  return (
                    <div
                      key={rule.id}
                      className={`p-3 rounded-lg border transition-all ${
                        rule.enabled ? 'border-zinc-500/20 bg-zinc-500/5' : 'border-border/30 bg-background/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <RuleIcon className={`h-4 w-4 shrink-0 ${rule.enabled ? 'text-zinc-500' : 'text-muted-foreground'}`} />
                        <span className={`text-xs flex-1 ${rule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {rule.description}
                        </span>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => toggleAlertRule(rule.id)}
                          className="scale-75"
                        />
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
