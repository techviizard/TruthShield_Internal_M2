'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Search, Globe, AlertTriangle, CheckCircle2, Clock,
  BadgeCheck, BarChart3, Activity, GitCompare, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { toast } from 'sonner'

/**
 * Source Credibility — every rating shown is derived from real data:
 *   • how often the domain has been cited by stored fact-check matches
 *   • the average trust score of the analyses citing it
 *   • lexical bias skew of those analyses
 *   • the curated editorial reference registry (src/config/source-domains.ts)
 * Domains never seen by the platform are reported as "no data", not guessed.
 */

interface Source {
  domain: string
  totalCitations: number
  factualRating: number
  biasScore: number
  recencyDays: number
  type: 'fact-checker' | 'mainstream' | 'unknown'
  referenceRating: number | null
  referenceType: string
  storedCitations: number | null
  isFactChecker: boolean
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function ratingColor(v: number): string {
  if (v >= 80) return '#22c55e'
  if (v >= 60) return '#eab308'
  if (v >= 40) return '#f97316'
  return '#ef4444'
}

function ratingLabel(v: number): string {
  if (v >= 80) return 'High'
  if (v >= 60) return 'Mostly factual'
  if (v >= 40) return 'Mixed'
  return 'Low'
}

function biasLabel(bias: number): string {
  if (bias <= -20) return 'Skews negative-lexicon'
  if (bias >= 20) return 'Skews positive-lexicon'
  return 'Balanced lexicon'
}

function SourceCard({ source }: { source: Source }) {
  return (
    <Card className="border rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 truncate">
              <Globe className="h-4 w-4 text-zinc-500 shrink-0" />
              {source.domain}
            </CardTitle>
            <CardDescription>
              {source.referenceType}
              {source.isFactChecker && ' · registered fact-checker'}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="shrink-0"
            style={{ color: ratingColor(source.factualRating), borderColor: `${ratingColor(source.factualRating)}55` }}
          >
            {Math.round(source.factualRating)} · {ratingLabel(source.factualRating)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Observed factual rating</span>
            <span className="font-medium">{Math.round(source.factualRating)}/100</span>
          </div>
          <Progress value={source.factualRating} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1">
            Mean trust score of the {source.totalCitations}{' '}
            {source.totalCitations === 1 ? 'analysis' : 'analyses'} citing this domain
          </p>
        </div>

        {source.referenceRating !== null && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Editorial reference rating</span>
              <span className="font-medium">{source.referenceRating}/100</span>
            </div>
            <Progress value={source.referenceRating} className="h-2" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted/30">
            <p className="text-sm font-bold">{source.totalCitations}</p>
            <p className="text-[10px] text-muted-foreground">citations</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <p className="text-sm font-bold">{source.biasScore > 0 ? `+${source.biasScore}` : source.biasScore}</p>
            <p className="text-[10px] text-muted-foreground">{biasLabel(source.biasScore)}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <p className="text-sm font-bold">
              {source.recencyDays < 0 ? '—' : source.recencyDays === 0 ? 'today' : `${source.recencyDays}d`}
            </p>
            <p className="text-[10px] text-muted-foreground">last cited</p>
          </div>
        </div>

        {source.totalCitations === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            No citations recorded yet — rating shown is the editorial reference only.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function SourceCredibilityTab() {
  const [sources, setSources] = useState<Source[] | null>(null)
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<Source | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const j = await fetch('/api/source-credibility').then((r) => r.json())
      if (j?.success) {
        setSources(j.sources as Source[])
        const list = j.sources as Source[]
        if (list.length > 0) {
          setCompareA((a) => a || list[0].domain)
          setCompareB((b) => b || (list[1]?.domain ?? list[0].domain))
        }
      } else {
        setSources([])
      }
    } catch {
      setSources([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runLookup = async () => {
    const domain = query.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    if (!domain) return
    setLookupError(null)
    setLookup(null)
    try {
      const res = await fetch(`/api/source-credibility?domain=${encodeURIComponent(domain)}`)
      const j = await res.json()
      if (res.ok && j.success) {
        setLookup(j.source as Source)
      } else {
        setLookupError(j.error ?? 'Lookup failed')
      }
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Lookup failed')
      toast.error('Source lookup failed')
    }
  }

  const sourceByDomain = (d: string) => (sources ?? []).find((s) => s.domain === d) ?? null
  const a = sourceByDomain(compareA)
  const b = sourceByDomain(compareB)

  const chartData = (sources ?? []).slice(0, 10).map((s) => ({
    domain: s.domain.length > 18 ? `${s.domain.slice(0, 16)}…` : s.domain,
    rating: Math.round(s.factualRating),
    citations: s.totalCitations,
  }))

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* ── Lookup ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-zinc-500" />
              Source Credibility
            </CardTitle>
            <CardDescription>
              Look up any domain — ratings are computed from citations recorded by this platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. altnews.in"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runLookup()
                }}
              />
              <Button onClick={() => void runLookup()}>
                <Search className="h-4 w-4 mr-1.5" />
                Check
              </Button>
              <Button variant="ghost" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {lookupError && (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {lookupError}
              </p>
            )}
            {lookup && <SourceCard source={lookup} />}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Ranked list ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              Most-cited sources
            </CardTitle>
            <CardDescription>Ranked by citation count in stored analyses</CardDescription>
          </CardHeader>
          <CardContent>
            {sources === null ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                No sources cited yet — run a fact check (or seed the database) to build the credibility index.
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="domain" type="category" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="rating" radius={[0, 6, 6, 0]}>
                      {chartData.map((d) => (
                        <Cell key={d.domain} fill={ratingColor(d.rating)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <ScrollArea className="h-[280px] mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 pr-4 font-medium">Domain</th>
                        <th className="py-2 pr-4 font-medium">Type</th>
                        <th className="py-2 pr-4 font-medium">Citations</th>
                        <th className="py-2 pr-4 font-medium">Rating</th>
                        <th className="py-2 pr-4 font-medium">Last cited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s) => (
                        <tr key={s.domain} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 pr-4 font-medium flex items-center gap-1.5">
                            {s.isFactChecker && <BadgeCheck className="h-3.5 w-3.5 text-green-500" />}
                            {s.domain}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{s.referenceType}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{s.totalCitations}</td>
                          <td className="py-2 pr-4">
                            <span style={{ color: ratingColor(s.factualRating) }} className="font-semibold">
                              {Math.round(s.factualRating)}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground text-xs">
                            {s.recencyDays < 0 ? '—' : s.recencyDays === 0 ? 'today' : `${s.recencyDays}d ago`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Compare ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-zinc-500" />
              Compare sources
            </CardTitle>
            <CardDescription>Side-by-side of two domains this platform has data for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(sources ?? []).length < 2 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                At least two cited sources are needed for a comparison.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={compareA}
                    onChange={(e) => setCompareA(e.target.value)}
                  >
                    {(sources ?? []).map((s) => (
                      <option key={s.domain} value={s.domain}>
                        {s.domain}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={compareB}
                    onChange={(e) => setCompareB(e.target.value)}
                  >
                    {(sources ?? []).map((s) => (
                      <option key={s.domain} value={s.domain}>
                        {s.domain}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {a && <SourceCard source={a} />}
                  {b && <SourceCard source={b} />}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Methodology ── */}
      <motion.div variants={itemVariants}>
        <Card className="border rounded-xl bg-muted/20">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Activity className="h-3.5 w-3.5" />
              How these numbers are produced
            </p>
            <p>
              <CheckCircle2 className="inline h-3 w-3 mr-1 text-green-500" />
              Factual rating = mean trust score of every analysis that cited the domain.
            </p>
            <p>
              <CheckCircle2 className="inline h-3 w-3 mr-1 text-green-500" />
              Bias score = lexical skew of those analyses (−50 … +50), not an editorial judgement.
            </p>
            <p>
              <Clock className="inline h-3 w-3 mr-1" />
              Recency = days since the domain was last cited.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
