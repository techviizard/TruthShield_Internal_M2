'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, Activity, Eye, Loader2, MapPin } from 'lucide-react'
import type { ThreatMapCity, ThreatSeverity } from '@/components/threat-map-leaflet'

// Leaflet touches `window` — must never render on the server
const ThreatMapLeaflet = dynamic(() => import('@/components/threat-map-leaflet'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20 rounded-lg">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

type TimeRange = '24h' | '7d' | '30d'

// Seed fallback — replaced at runtime by /api/dashboard/threats
const baseThreatData: ThreatMapCity[] = [
  { city: 'Delhi', lat: 28.6, lng: 77.2, threats: 342, severity: 'critical', topThreat: 'Election deepfakes', trend: '+15%' },
  { city: 'Mumbai', lat: 19.1, lng: 72.9, threats: 287, severity: 'high', topThreat: 'Financial scams', trend: '+8%' },
  { city: 'Chennai', lat: 13.1, lng: 80.3, threats: 198, severity: 'high', topThreat: 'Health misinformation', trend: '+12%' },
  { city: 'Kolkata', lat: 22.6, lng: 88.4, threats: 156, severity: 'medium', topThreat: 'Political propaganda', trend: '+5%' },
  { city: 'Bangalore', lat: 13.0, lng: 77.6, threats: 134, severity: 'medium', topThreat: 'AI-generated images', trend: '+22%' },
  { city: 'Hyderabad', lat: 17.4, lng: 78.5, threats: 123, severity: 'medium', topThreat: 'WhatsApp forwards', trend: '+3%' },
  { city: 'Jaipur', lat: 26.9, lng: 75.8, threats: 98, severity: 'low', topThreat: 'Misleading stats', trend: '-2%' },
  { city: 'Lucknow', lat: 26.8, lng: 80.9, threats: 167, severity: 'high', topThreat: 'Communal fake news', trend: '+18%' },
  { city: 'Patna', lat: 25.6, lng: 85.1, threats: 89, severity: 'low', topThreat: 'Old footage recycled', trend: '+1%' },
  { city: 'Ahmedabad', lat: 23.0, lng: 72.6, threats: 112, severity: 'medium', topThreat: 'Manipulated images', trend: '+7%' },
  { city: 'Kochi', lat: 10.0, lng: 76.3, threats: 67, severity: 'low', topThreat: 'Health misinformation', trend: '-5%' },
  { city: 'Chandigarh', lat: 30.7, lng: 76.8, threats: 78, severity: 'low', topThreat: 'Political memes', trend: '+4%' },
  { city: 'Bhopal', lat: 23.3, lng: 77.4, threats: 95, severity: 'medium', topThreat: 'Government impersonation', trend: '+9%' },
  { city: 'Guwahati', lat: 26.1, lng: 91.7, threats: 145, severity: 'high', topThreat: 'Ethnic tension content', trend: '+11%' },
]

const timeRangeMultipliers: Record<TimeRange, number> = { '24h': 0.25, '7d': 0.6, '30d': 1 }

const severityMeta: Record<ThreatSeverity, { label: string; badgeClass: string }> = {
  critical: { label: 'Critical', badgeClass: 'bg-red-500/10 text-red-500 border-red-500/30' },
  high: { label: 'High', badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/30' },
  medium: { label: 'Medium', badgeClass: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' },
  low: { label: 'Low', badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30' },
}

function SummaryStat({ icon: Icon, label, value, colorClass }: {
  icon: React.ElementType
  label: string
  value: number
  colorClass: string
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      <div className={`p-1.5 rounded-md ${colorClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-bold leading-tight">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}

export function ThreatIntelMap() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [liveData, setLiveData] = useState<ThreatMapCity[] | null>(null)

  useEffect(() => {
    let aborted = false
    fetch(`/api/dashboard/threats?range=${timeRange}`)
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return
        if (j?.success && Array.isArray(j.regions)) {
          const merged: ThreatMapCity[] = j.regions.map((reg: Partial<ThreatMapCity>) => {
            const seed = baseThreatData.find((b) => b.city === reg.city)
            return {
              city: reg.city ?? 'Unknown',
              lat: reg.lat ?? seed?.lat ?? 22.5,
              lng: reg.lng ?? seed?.lng ?? 80.5,
              threats: reg.threats ?? 0,
              severity: (reg.severity as ThreatSeverity) ?? 'low',
              topThreat: reg.topThreat ?? 'Unknown',
              trend: reg.trend ?? '0%',
            }
          })
          // Empty DB yields all-zero regions — keep seed demo data in that case
          if (merged.some((m) => m.threats > 0)) setLiveData(merged)
        }
      })
      .catch(() => { /* keep seed fallback */ })
    return () => { aborted = true }
  }, [timeRange])

  const multiplier = timeRangeMultipliers[timeRange]
  const threatData = liveData ?? baseThreatData.map((d) => ({
    ...d,
    threats: Math.round(d.threats * multiplier),
  }))

  const totalThreats = threatData.reduce((sum, d) => sum + d.threats, 0)
  const criticalCount = threatData.filter((d) => d.severity === 'critical').reduce((s, d) => s + d.threats, 0)
  const highCount = threatData.filter((d) => d.severity === 'high').reduce((s, d) => s + d.threats, 0)
  const topCities = [...threatData].sort((a, b) => b.threats - a.threats).slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="glass border rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-zinc-400" />
                Threat Intelligence Map
              </CardTitle>
              <CardDescription>Live threat hotspots across India &middot; OpenStreetMap</CardDescription>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
              {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'ghost'}
                  size="sm"
                  className={`h-7 px-3 text-xs font-medium transition-all ${
                    timeRange === range
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-sm'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Leaflet map */}
            <div className="flex-1 min-w-0">
              <div className="relative w-full h-[380px] lg:h-[440px] rounded-lg overflow-hidden border border-border/50">
                <ThreatMapLeaflet cities={threatData} />
              </div>
              {/* Severity legend */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {(Object.keys(severityMeta) as ThreatSeverity[]).map((sev) => (
                  <Badge key={sev} variant="outline" className={`text-[10px] ${severityMeta[sev].badgeClass}`}>
                    {severityMeta[sev].label}
                  </Badge>
                ))}
                <span className="text-[10px] text-muted-foreground ml-auto">Marker size = threat volume &middot; click for details</span>
              </div>
            </div>

            {/* Side stats */}
            <div className="lg:w-56 shrink-0 space-y-2">
              <SummaryStat icon={Activity} label="Total Threats" value={totalThreats} colorClass="bg-zinc-500/15 text-zinc-300" />
              <SummaryStat icon={AlertTriangle} label="Critical" value={criticalCount} colorClass="bg-red-500/15 text-red-500" />
              <SummaryStat icon={Eye} label="High Severity" value={highCount} colorClass="bg-orange-500/15 text-orange-500" />

              <div className="pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Top Hotspots</p>
                <div className="space-y-1.5">
                  {topCities.map((c, i) => (
                    <motion.div
                      key={c.city}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.07 }}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/40"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium truncate">{c.city}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold tabular-nums">{c.threats}</span>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${severityMeta[c.severity].badgeClass}`}>
                          {severityMeta[c.severity].label}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
