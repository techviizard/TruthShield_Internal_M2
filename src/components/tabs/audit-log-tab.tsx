'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Search, Filter, RefreshCw, ChevronDown, ChevronRight,
  Activity, AlertTriangle, Shield, Users, Clock, Globe, Monitor,
  CheckCircle2, AlertCircle, FileCheck, Eye, Brain, BarChart3,
  Radio, X, Fingerprint, ShieldCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ChainIntegrityPanel } from '@/components/chain-integrity-panel'

// --- Types ---
interface AuditLogEntry {
  id: string
  timestamp: string
  action: 'analysis_completed' | 'alert_triggered' | 'investigation_created' | 'user_login' | 'report_exported' | 'watchlist_hit' | 'system_update' | 'fact_check_completed' | 'evidence_ingested' | 'chain_verified'
  resource: string
  details: string
  severity: 'info' | 'warning' | 'critical'
  user: string
  ipAddress: string
  metadata: Record<string, string>
  /** Position in the tamper-evident chain, and this record's own hash. */
  seq: number | null
  entryHash: string | null
}


// --- Helpers ---
function getRelativeTime(isoTimestamp: string): string {
  const now = new Date()
  const then = new Date(isoTimestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`
  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
}

function getActionIcon(action: AuditLogEntry['action']) {
  switch (action) {
    case 'analysis_completed': return BarChart3
    case 'alert_triggered': return AlertTriangle
    case 'investigation_created': return Eye
    case 'user_login': return Users
    case 'report_exported': return FileCheck
    case 'watchlist_hit': return Radio
    case 'system_update': return Monitor
    case 'fact_check_completed': return Brain
    case 'evidence_ingested': return Fingerprint
    case 'chain_verified': return ShieldCheck
  }
}

function getActionLabel(action: AuditLogEntry['action']): string {
  switch (action) {
    case 'analysis_completed': return 'Analysis Completed'
    case 'alert_triggered': return 'Alert Triggered'
    case 'investigation_created': return 'Investigation Created'
    case 'user_login': return 'User Login'
    case 'report_exported': return 'Report Exported'
    case 'watchlist_hit': return 'Watchlist Hit'
    case 'system_update': return 'System Update'
    case 'fact_check_completed': return 'Fact Check Completed'
    case 'evidence_ingested': return 'Evidence Ingested'
    case 'chain_verified': return 'Chain Verified'
  }
}

function getSeverityColor(severity: AuditLogEntry['severity']) {
  switch (severity) {
    case 'critical': return { dot: 'bg-red-500', ring: 'ring-red-500/30', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
    case 'warning': return { dot: 'bg-amber-500', ring: 'ring-amber-500/30', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
    case 'info': return { dot: 'bg-zinc-500', ring: 'ring-zinc-500/30', text: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' }
  }
}

function getSeverityBadge(severity: AuditLogEntry['severity']) {
  switch (severity) {
    case 'critical': return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20'
    case 'warning': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'info': return 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
  }
}

// Map DB AuditLog row -> AuditLogEntry shape
function rowToEntry(row: {
  id: string; createdAt: string; action: string; resource: string;
  details: unknown; ipAddress: string | null; userId: string | null;
  seq?: number | null; entryHash?: string | null;
}): AuditLogEntry {
  const meta = (row.details && typeof row.details === 'object' ? row.details : {}) as Record<string, unknown>
  const allowedActions: AuditLogEntry['action'][] = [
    'analysis_completed', 'alert_triggered', 'investigation_created', 'user_login',
    'report_exported', 'watchlist_hit', 'system_update', 'fact_check_completed',
    'evidence_ingested', 'chain_verified',
  ]
  const action = (allowedActions as string[]).includes(row.action)
    ? (row.action as AuditLogEntry['action'])
    : 'system_update'
  const sev: AuditLogEntry['severity'] =
    action === 'alert_triggered' ? 'critical' :
    action === 'investigation_created' || action === 'analysis_completed' ? 'warning' :
    'info'
  const flatMeta: Record<string, string> = {}
  for (const [k, v] of Object.entries(meta)) flatMeta[k] = typeof v === 'string' ? v : JSON.stringify(v)
  return {
    id: row.id,
    timestamp: row.createdAt,
    action,
    resource: row.resource,
    details: typeof meta.summary === 'string' ? meta.summary : `${getActionLabel(action)} on ${row.resource}`,
    severity: sev,
    user: row.userId ?? 'System',
    ipAddress: row.ipAddress ?? ' - ',
    metadata: flatMeta,
    seq: typeof row.seq === 'number' ? row.seq : null,
    entryHash: row.entryHash ?? null,
  }
}

// --- Component ---
export function AuditLogTab() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchEntries = useCallback(async () => {
    try {
      const j = await fetch('/api/audit/logs?limit=100').then((r) => r.json())
      if (j?.success && Array.isArray(j.items)) {
        setEntries(j.items.map(rowToEntry))
        return
      }
    } catch {
      /* leave the current list in place on transport errors */
    }
    setEntries([])
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    if (!isAutoRefresh) return
    const interval = setInterval(() => {
      setLastRefresh(new Date())
      fetchEntries()
    }, 15000)
    return () => clearInterval(interval)
  }, [isAutoRefresh, fetchEntries])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch = searchQuery.trim() === '' ||
        entry.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesAction = filterAction === 'all' || entry.action === filterAction
      const matchesSeverity = filterSeverity === 'all' || entry.severity === filterSeverity

      return matchesSearch && matchesAction && matchesSeverity
    })
  }, [entries, searchQuery, filterAction, filterSeverity])

  // Summary stats
  const stats = useMemo(() => {
    const last24h = entries.filter((e) => {
      const diff = Date.now() - new Date(e.timestamp).getTime()
      return diff <= 24 * 60 * 60 * 1000
    })
    return {
      total: entries.length,
      critical: entries.filter((e) => e.severity === 'critical').length,
      analysesToday: last24h.filter((e) => e.action === 'analysis_completed').length,
      activeUsers: new Set(entries.filter((e) => e.user !== 'System' && e.user !== 'System Admin').map((e) => e.user)).size,
    }
  }, [entries])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const handleManualRefresh = useCallback(() => {
    setLastRefresh(new Date())
    fetchEntries()
  }, [fetchEntries])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-zinc-500" />
            Audit Log
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive activity timeline and audit trail for all platform operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-xs">
            <span className="relative flex h-2 w-2">
              {isAutoRefresh && (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500" />
                </>
              )}
              {!isAutoRefresh && <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />}
            </span>
            <span className="text-muted-foreground">
              {isAutoRefresh ? 'Live' : 'Paused'}
            </span>
            <span className="text-muted-foreground/60">
              &middot; {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoRefresh((prev) => !prev)}
            className="h-8 text-xs"
          >
            {isAutoRefresh ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            className="h-8 text-xs gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tamper-evidence for the trail below */}
      <ChainIntegrityPanel />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats.total, icon: Activity, color: 'zinc' },
          { label: 'Critical Events', value: stats.critical, icon: AlertTriangle, color: 'red' },
          { label: 'Analyses Today', value: stats.analysesToday, icon: Shield, color: 'amber' },
          { label: 'Active Users', value: stats.activeUsers, icon: Users, color: 'blue' },
        ].map((stat) => {
          const colorMap: Record<string, string> = {
            zinc: 'from-zinc-500/20 to-zinc-600/5 border-zinc-500/20',
            red: 'from-red-500/20 to-red-600/5 border-red-500/20',
            amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
            blue: 'from-sky-500/20 to-sky-600/5 border-sky-500/20',
          }
          const iconColorMap: Record<string, string> = {
            zinc: 'text-zinc-500',
            red: 'text-red-500',
            amber: 'text-amber-500',
            blue: 'text-sky-500',
          }
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className={`bg-gradient-to-br ${colorMap[stat.color]} border backdrop-blur-sm`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 rounded-lg bg-background/50 ${iconColorMap[stat.color]}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Filters */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events, users, resources..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Action Type Filter */}
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="analysis_completed">Analysis Completed</SelectItem>
                <SelectItem value="alert_triggered">Alert Triggered</SelectItem>
                <SelectItem value="investigation_created">Investigation Created</SelectItem>
                <SelectItem value="user_login">User Login</SelectItem>
                <SelectItem value="report_exported">Report Exported</SelectItem>
                <SelectItem value="watchlist_hit">Watchlist Hit</SelectItem>
                <SelectItem value="system_update">System Update</SelectItem>
                <SelectItem value="fact_check_completed">Fact Check Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-full sm:w-[150px] h-9">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear filters */}
            {(filterAction !== 'all' || filterSeverity !== 'all' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setFilterAction('all')
                  setFilterSeverity('all')
                  setSearchQuery('')
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Active filter count */}
          {(filterAction !== 'all' || filterSeverity !== 'all' || searchQuery) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Showing {filteredEntries.length} of {entries.length} events</span>
              {filterAction !== 'all' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{getActionLabel(filterAction as AuditLogEntry['action'])}</Badge>
              )}
              {filterSeverity !== 'all' && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getSeverityBadge(filterSeverity as AuditLogEntry['severity'])}`}>
                  {filterSeverity.charAt(0).toUpperCase() + filterSeverity.slice(1)}
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  &quot;{searchQuery}&quot;
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="relative">
        {filteredEntries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No audit log entries match your filters</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  setFilterAction('all')
                  setFilterSeverity('all')
                  setSearchQuery('')
                }}
              >
                Clear all filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-22rem)]">
            <div className="space-y-0">
              <AnimatePresence mode="popLayout">
                {filteredEntries.map((entry, index) => {
                  const Icon = getActionIcon(entry.action)
                  const severityColors = getSeverityColor(entry.severity)
                  const isExpanded = expandedId === entry.id

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.25, delay: index * 0.03 }}
                      className="relative flex gap-4"
                    >
                      {/* Timeline line and dot */}
                      <div className="flex flex-col items-center shrink-0 w-10">
                        <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${severityColors.bg} ring-4 ${severityColors.ring}`}>
                          <div className={`h-3 w-3 rounded-full ${severityColors.dot}`} />
                        </div>
                        {index < filteredEntries.length - 1 && (
                          <div className="w-px flex-1 bg-border min-h-[24px]" />
                        )}
                      </div>

                      {/* Entry Card */}
                      <div className={`flex-1 pb-4 ${index < filteredEntries.length - 1 ? '' : ''}`}>
                        <Card className={`border transition-colors hover:bg-muted/30 cursor-pointer ${severityColors.border}`}>
                          <CardContent className="p-4" onClick={() => toggleExpand(entry.id)}>
                            {/* Top row: timestamp + badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getRelativeTime(entry.timestamp)}
                              </span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getSeverityBadge(entry.severity)}`}>
                                {entry.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                                <Icon className="h-2.5 w-2.5 mr-1" />
                                {getActionLabel(entry.action)}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-mono ml-auto hidden sm:inline">
                                {entry.id}
                              </span>
                            </div>

                            {/* Resource */}
                            <p className="text-sm font-semibold mb-1">{entry.resource}</p>

                            {/* Details */}
                            <p className="text-sm text-muted-foreground leading-relaxed">{entry.details}</p>

                            {/* User + IP row */}
                            <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {entry.user}
                              </span>
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {entry.ipAddress}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground/50" />
                              ) : (
                                <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground/50" />
                              )}
                            </div>

                            {/* Expandable metadata */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <Separator className="my-3" />
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                      <Activity className="h-3 w-3" />
                                      Raw Metadata
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {Object.entries(entry.metadata).map(([key, value]) => (
                                        <div key={key} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2.5 py-1.5">
                                          <span className="text-muted-foreground font-mono">{key}:</span>
                                          <span className="font-medium truncate">{value}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-2 text-[10px] text-muted-foreground/60">
                                      Full timestamp: {new Date(entry.timestamp).toLocaleString()}
                                    </div>
                                    {entry.entryHash && (
                                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded border bg-muted/30 px-2.5 py-1.5 font-mono text-[10px]">
                                        <Fingerprint className="h-3 w-3 text-emerald-500" />
                                        <span className="text-muted-foreground">chain #{entry.seq}</span>
                                        <span className="truncate">{entry.entryHash}</span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer note */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 py-2">
        <CheckCircle2 className="h-3 w-3" />
        <span>
          Showing {filteredEntries.length} of {entries.length} audit events &middot;
          {isAutoRefresh ? ' Auto-refreshing every 15s' : ' Auto-refresh paused'}
        </span>
      </div>
    </div>
  )
}
