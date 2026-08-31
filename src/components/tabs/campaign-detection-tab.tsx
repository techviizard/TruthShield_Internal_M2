'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Radar, AlertTriangle, Clock, FileText, Activity, Target,
  Globe, BarChart3, Layers, RefreshCw, Timer,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

/**
 * Campaign Detection - coordinated-narrative clusters produced by the TF-IDF
 * clustering engine over stored text/fact-check analyses (`/api/campaigns`).
 * Cluster labels, member counts, severity, timing and region spread are all
 * computed from the database; nothing here is pre-authored.
 */

type Severity = 'critical' | 'high' | 'medium' | 'low'

interface ClusterMember {
  id: string
  similarity: number
}

interface ApiCluster {
  id: number
  centroidTerms: string[]
  members: ClusterMember[]
  memberCount: number
  severity: Severity
  firstSeen: string
  lastSeen: string
  regionDistribution: Record<string, number>
}

const severityStyles: Record<Severity, { badge: string; color: string }> = {
  critical: { badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25', color: '#ef4444' },
  high: { badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25', color: '#f97316' },
  medium: { badge: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25', color: '#eab308' },
  low: { badge: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25', color: '#22c55e' },
}

function labelFor(cluster: ApiCluster): string {
  const terms = cluster.centroidTerms.slice(0, 4).filter(Boolean)
  return terms.length > 0 ? terms.join(' · ') : `Cluster #${cluster.id + 1}`
}

function hoursBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600_000)
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} d ago`
}

export function CampaignDetectionTab() {
  const [clusters, setClusters] = useState<ApiCluster[] | null>(null)
  const [totalAnalyzed, setTotalAnalyzed] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const j = await fetch('/api/campaigns').then((r) => r.json())
      if (j?.success) {
        const list = (j.clusters ?? []) as ApiCluster[]
        setClusters(list)
        setTotalAnalyzed(j.totalAnalyzed ?? 0)
        setSelectedId((prev) => (prev !== null ? prev : list[0]?.id ?? null))
      } else {
        setClusters([])
      }
    } catch {
      setClusters([])
    }
  }, [])

 useEffect(() => {
  const loadCampaigns = async () => {
    await load()
  }

  void loadCampaigns()
}, [load])

  const selected = (clusters ?? []).find((c) => c.id === selectedId) ?? (clusters ?? [])[0] ?? null

  const flaggedContent = (clusters ?? []).reduce((sum, c) => sum + c.memberCount, 0)
  const regionsCovered = new Set(
    (clusters ?? []).flatMap((c) => Object.keys(c.regionDistribution ?? {})),
  ).size
  const meanSpanHours =
    (clusters ?? []).length > 0
      ? (clusters ?? []).reduce((sum, c) => sum + hoursBetween(c.firstSeen, c.lastSeen), 0) /
        (clusters ?? []).length
      : 0

  const metricsCards = [
    { label: 'Detected campaigns', value: String((clusters ?? []).length), icon: Radar, sub: `from ${totalAnalyzed} analyses`, color: 'text-red-500' },
    { label: 'Clustered content', value: String(flaggedContent), icon: FileText, sub: 'analyses inside a cluster', color: 'text-orange-500' },
    { label: 'Regions involved', value: String(regionsCovered), icon: Globe, sub: 'distinct regions detected', color: 'text-purple-500' },
    { label: 'Mean campaign span', value: meanSpanHours >= 1 ? `${meanSpanHours.toFixed(1)} hrs` : ' - ', icon: Timer, sub: 'first to last sighting', color: 'text-zinc-500' },
  ]

  if (clusters === null) {
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden bg-gradient-to-br from-zinc-500/10 via-zinc-500/5 to-transparent border-zinc-500/20">
          <CardContent className="relative p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-500/10">
                <Radar className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Campaign Detection</h2>
                <p className="text-sm text-muted-foreground">
                  TF-IDF clustering over the last 30 days of text and fact-check analyses
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Re-run clustering
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsCards.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                </div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{m.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {clusters.length === 0 ? (
        <Card className="border rounded-xl">
          <CardContent className="py-16 text-center">
            <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium">No campaigns detected yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Clustering needs several similar analyses inside the lookback window
              {totalAnalyzed > 0 ? ` - ${totalAnalyzed} analysed so far, none similar enough to group.` : '. Run some text or fact-check analyses first.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cluster list */}
          <Card className="border rounded-xl lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-zinc-500" />
                Detected campaigns
              </CardTitle>
              <CardDescription>{clusters.length} narrative clusters</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[420px]">
                <div className="space-y-2 px-2">
                  {clusters.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selected?.id === c.id ? 'bg-muted/60 border-zinc-500/40' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">{labelFor(c)}</p>
                        <Badge variant="outline" className={`shrink-0 text-[10px] ${severityStyles[c.severity].badge}`}>
                          {c.severity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {c.memberCount} items · last seen {relativeTime(c.lastSeen)}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Selected cluster detail */}
          <div className="lg:col-span-2 space-y-4">
            {selected && (
              <>
                <Card className="border rounded-xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4 text-zinc-500" />
                          {labelFor(selected)}
                        </CardTitle>
                        <CardDescription>
                          First seen {relativeTime(selected.firstSeen)} · active over{' '}
                          {hoursBetween(selected.firstSeen, selected.lastSeen).toFixed(1)} hrs
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={severityStyles[selected.severity].badge}>
                        {selected.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {selected.centroidTerms.slice(0, 12).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Cluster cohesion - mean similarity of members to the cluster seed
                      </p>
                      <Progress
                        value={
                          selected.members.reduce((s, m) => s + m.similarity, 0) /
                          Math.max(1, selected.members.length)
                        }
                        className="h-2"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold">{selected.memberCount}</p>
                        <p className="text-[10px] text-muted-foreground">analyses</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold">{Object.keys(selected.regionDistribution ?? {}).length}</p>
                        <p className="text-[10px] text-muted-foreground">regions</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold">{relativeTime(selected.lastSeen)}</p>
                        <p className="text-[10px] text-muted-foreground">last activity</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-zinc-500" />
                      Regional spread
                    </CardTitle>
                    <CardDescription>Where the clustered content was detected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(selected.regionDistribution ?? {}).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No region could be inferred for this cluster.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={Object.entries(selected.regionDistribution).map(([region, count]) => ({ region, count }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="region" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px' }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {Object.keys(selected.regionDistribution).map((r) => (
                              <Cell key={r} fill={severityStyles[selected.severity].color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="border rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-zinc-500" />
                      Cluster members
                    </CardTitle>
                    <CardDescription>Analysis reports grouped into this campaign</CardDescription>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[220px]">
                      <div className="space-y-1.5 px-2">
                        {selected.members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                            <span className="font-mono text-xs truncate">{m.id.slice(-10).toUpperCase()}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {m.similarity.toFixed(0)}% similar
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* Methodology note */}
      <Card className="border rounded-xl bg-muted/20">
        <CardContent className="p-4 text-xs text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Clusters are unlabelled statistical groupings of similar analysis text - they indicate repeated
            narratives, not proven coordination. Similarity threshold and minimum cluster size are set in the
            central configuration (<code>CAMPAIGN_SIMILARITY</code>, <code>CAMPAIGN_MIN_CLUSTER_SIZE</code>).
            <Clock className="inline h-3 w-3 ml-1" /> Lookback window: <code>CAMPAIGN_LOOKBACK_DAYS</code>.
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
