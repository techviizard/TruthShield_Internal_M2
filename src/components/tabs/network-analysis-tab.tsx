'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Network, Shield, AlertTriangle, Activity, Layers, RefreshCw,
  FileText, Image as ImageIcon, Video, Search, Music, Share2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Network / Provenance analysis - renders the real relationship graph returned
 * by `/api/network-graph`: analysis reports linked by shared fact-check source
 * domains or by membership of the same investigation. Node risk, type and label
 * all come from the database.
 */

interface GraphNode {
  id: string
  label: string
  type: string
  riskLevel: string | null
}

interface GraphEdge {
  source: string
  target: string
  type: 'shared_source' | 'same_investigation'
  weight: number
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  text_fake_news: { label: 'Text', icon: FileText, color: '#e4e4e7' },
  image_forensics: { label: 'Image', icon: ImageIcon, color: '#06b6d4' },
  video_deepfake: { label: 'Video', icon: Video, color: '#f97316' },
  fact_check: { label: 'Fact check', icon: Search, color: '#eab308' },
  audio_deepfake: { label: 'Audio', icon: Music, color: '#a78bfa' },
}

const RISK_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

function metaFor(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Activity, color: '#a1a1aa' }
}

export function NetworkAnalysisTab() {
  const [nodes, setNodes] = useState<GraphNode[] | null>(null)
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const j = await fetch('/api/network-graph').then((r) => r.json())
      if (j?.success) {
        setNodes(j.nodes as GraphNode[])
        setEdges(j.edges as GraphEdge[])
      } else {
        setNodes([])
      }
    } catch {
      setNodes([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Degree per node - only connected nodes are worth drawing.
  const degree = useMemo(() => {
    const d = new Map<string, number>()
    for (const e of edges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1)
      d.set(e.target, (d.get(e.target) ?? 0) + 1)
    }
    return d
  }, [edges])

  const connected = useMemo(
    () =>
      (nodes ?? [])
        .filter((n) => (degree.get(n.id) ?? 0) > 0)
        .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
        .slice(0, 24),
    [nodes, degree],
  )

  // Circular layout over the connected subgraph.
  const layout = useMemo(() => {
    const cx = 320
    const cy = 240
    const r = 180
    const pos = new Map<string, { x: number; y: number }>()
    connected.forEach((n, i) => {
      const angle = (i / Math.max(1, connected.length)) * Math.PI * 2 - Math.PI / 2
      pos.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    })
    return pos
  }, [connected])

  const visibleEdges = edges.filter((e) => layout.has(e.source) && layout.has(e.target))
  const selectedNode = (nodes ?? []).find((n) => n.id === selected) ?? null
  const selectedEdges = visibleEdges.filter((e) => e.source === selected || e.target === selected)

  if (nodes === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border rounded-xl">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10">
                <Network className="h-6 w-6 text-cyan-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Network &amp; Provenance</h2>
                <p className="text-sm text-muted-foreground">
                  {nodes.length} analyses · {edges.length} links (shared sources or shared investigation)
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Rebuild graph
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {connected.length === 0 ? (
        <Card className="border rounded-xl">
          <CardContent className="py-16 text-center">
            <Share2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium">No connections found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Links appear when two analyses cite the same fact-check source domain, or belong to the same
              investigation. Run fact checks or attach analyses to an investigation to build the graph.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Graph */}
          <Card className="border rounded-xl lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4 text-zinc-500" />
                Relationship graph
              </CardTitle>
              <CardDescription>
                Showing the {connected.length} most-connected analyses · {visibleEdges.length} edges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <svg viewBox="0 0 640 480" className="w-full h-[420px]">
                {visibleEdges.map((e, i) => {
                  const a = layout.get(e.source)!
                  const b = layout.get(e.target)!
                  const active = selected === e.source || selected === e.target
                  return (
                    <line
                      key={`${e.source}-${e.target}-${i}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={e.type === 'same_investigation' ? '#06b6d4' : '#a1a1aa'}
                      strokeWidth={active ? 2 : 1}
                      strokeOpacity={active ? 0.9 : 0.35}
                    />
                  )
                })}
                {connected.map((n) => {
                  const p = layout.get(n.id)!
                  const color = RISK_COLOR[n.riskLevel ?? 'low'] ?? '#a1a1aa'
                  const isSel = selected === n.id
                  return (
                    <g key={n.id} onClick={() => setSelected(n.id)} className="cursor-pointer">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isSel ? 14 : 9 + Math.min(6, (degree.get(n.id) ?? 0))}
                        fill={color}
                        fillOpacity={isSel ? 0.95 : 0.7}
                        stroke={isSel ? '#fff' : 'none'}
                        strokeWidth={isSel ? 2 : 0}
                      />
                      <title>{`${n.label} · ${metaFor(n.type).label} · ${n.riskLevel ?? 'unrated'}`}</title>
                    </g>
                  )
                })}
              </svg>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0.5 bg-cyan-500" /> same investigation
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0.5 bg-zinc-400" /> shared source domain
                </span>
                {Object.entries(RISK_COLOR).map(([risk, c]) => (
                  <span key={risk} className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    {risk}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Node inspector */}
          <div className="space-y-4">
            <Card className="border rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-zinc-500" />
                  Node detail
                </CardTitle>
                <CardDescription>
                  {selectedNode ? 'Selected analysis' : 'Click a node in the graph'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedNode ? (
                  <>
                    <div>
                      <p className="text-sm font-medium truncate">{selectedNode.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {selectedNode.id.slice(-12).toUpperCase()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{metaFor(selectedNode.type).label}</Badge>
                      <Badge
                        variant="outline"
                        style={{
                          color: RISK_COLOR[selectedNode.riskLevel ?? 'low'],
                          borderColor: `${RISK_COLOR[selectedNode.riskLevel ?? 'low']}55`,
                        }}
                      >
                        {selectedNode.riskLevel ?? 'unrated'}
                      </Badge>
                      <Badge variant="outline">{degree.get(selectedNode.id) ?? 0} links</Badge>
                    </div>
                    <ScrollArea className="h-[180px]">
                      <div className="space-y-1.5 pr-2">
                        {selectedEdges.map((e, i) => {
                          const otherId = e.source === selectedNode.id ? e.target : e.source
                          const other = (nodes ?? []).find((n) => n.id === otherId)
                          return (
                            <button
                              key={`${otherId}-${i}`}
                              onClick={() => setSelected(otherId)}
                              className="w-full text-left p-2 rounded-lg bg-muted/30 hover:bg-muted/50"
                            >
                              <p className="text-xs truncate">{other?.label ?? otherId.slice(-8)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {e.type === 'same_investigation' ? 'same investigation' : 'shared source domain'}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No node selected.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  Graph composition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.entries(
                  (nodes ?? []).reduce<Record<string, number>>((acc, n) => {
                    acc[n.type] = (acc[n.type] ?? 0) + 1
                    return acc
                  }, {}),
                ).map(([type, count]) => {
                  const meta = metaFor(type)
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <meta.icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                        {meta.label}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Card className="border rounded-xl bg-muted/20">
        <CardContent className="p-4 text-xs text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Edges are structural (shared citation domain or shared investigation) - they show related material,
            not proven common authorship. Graph size is capped by <code>NETWORK_GRAPH_NODE_LIMIT</code> in the
            central configuration.
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
