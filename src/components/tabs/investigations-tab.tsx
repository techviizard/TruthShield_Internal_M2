'use client'

import { useState, useMemo, useEffect} from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type Investigation, type InvestigationStatus, type InvestigationPriority } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Briefcase, Plus, User, Calendar, Tag, FileText,
  ChevronRight, Clock, AlertTriangle, CheckCircle2, Archive, FolderOpen,
  Video, ImageIcon, Shield, TrendingUp, Activity, PlusCircle, AlertOctagon,
  XCircle, Eye, Search, Zap, Scale, BadgeCheck, MapPin,
  Pencil, Trash2,
} from 'lucide-react'

/**
 * Case record strip - FIR / case number / officer of record.
 * Rendered only when the case actually carries this metadata, so analyst-only
 * cases do not show a row of empty legal fields.
 */
function CaseRecord({ inv }: { inv: Investigation }) {
  const fields = [
    { label: 'Case no.', value: inv.caseNumber, icon: Briefcase },
    { label: 'FIR no.', value: inv.firNumber, icon: Scale },
    { label: 'Officer', value: inv.officerName, icon: BadgeCheck },
    { label: 'Badge', value: inv.officerBadge, icon: BadgeCheck },
    { label: 'Jurisdiction', value: inv.jurisdiction, icon: MapPin },
  ].filter((f) => f.value)

  if (!fields.length) return null

  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
        Case record
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center gap-2">
            <f.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{f.label}</p>
              <p className="truncate text-xs font-medium">{f.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const statusConfig: Record<InvestigationStatus, { color: string; icon: React.ReactNode; label: string }> = {
  open: { color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25', icon: <FolderOpen className="h-4 w-4" />, label: 'Open' },
  in_progress: { color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25', icon: <Clock className="h-4 w-4" />, label: 'In Progress' },
  closed: { color: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25', icon: <CheckCircle2 className="h-4 w-4" />, label: 'Closed' },
  archived: { color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/25', icon: <Archive className="h-4 w-4" />, label: 'Archived' },
}

const priorityConfig: Record<InvestigationPriority, { color: string; label: string; score: number }> = {
  critical: { color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25', label: 'Critical', score: 90 },
  high: { color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25', label: 'High', score: 70 },
  medium: { color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25', label: 'Medium', score: 40 },
  low: { color: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25', label: 'Low', score: 15 },
}

/** Evidence = the analyses attached to the case, straight from the database. */
interface EvidenceItem {
  reportId: string
  id: string
  type: string
  title: string
  trustScore: number
  date: string
}

const ANALYSIS_LABEL: Record<string, string> = {
  text_fake_news: 'Text analysis',
  image_forensics: 'Image forensics',
  video_deepfake: 'Video deepfake scan',
  fact_check: 'Fact check',
  audio_deepfake: 'Audio deepfake scan',
}

const ANALYSIS_MEDIA: Record<string, string> = {
  text_fake_news: 'text',
  image_forensics: 'image',
  video_deepfake: 'video',
  fact_check: 'document',
  audio_deepfake: 'audio',
}

function evidenceFor(inv: Investigation): EvidenceItem[] {
  return inv.analyses.map((a) => ({
    reportId: a.id,
    id: a.id.slice(-6).toUpperCase(),
    type: ANALYSIS_MEDIA[a.analysisType] ?? 'document',
    title: `${ANALYSIS_LABEL[a.analysisType] ?? a.analysisType} · ${a.riskLevel ?? 'unrated'} risk`,
    trustScore: Math.round(a.trustScore ?? 0),
    date: a.createdAt.split('T')[0],
  }))
}

interface TimelineItem {
  event: string
  timestamp: string
  type: 'created' | 'analysis' | 'evidence' | 'update' | 'escalation' | 'closed'
}

/** Timeline derived from the case's own timestamps and its linked analyses. */
function timelineFor(inv: Investigation): TimelineItem[] {
  const events: TimelineItem[] = inv.analyses.map((a) => ({
    event: `${ANALYSIS_LABEL[a.analysisType] ?? a.analysisType} linked (trust ${Math.round(a.trustScore ?? 0)})`,
    timestamp: a.createdAt,
    type: a.riskLevel === 'critical' ? 'escalation' : 'analysis',
  }))
  events.push({ event: 'Investigation created', timestamp: inv.createdAt, type: 'created' })
  if (inv.status === 'closed' || inv.status === 'archived') {
    events.push({ event: `Investigation ${inv.status}`, timestamp: inv.updatedAt, type: 'closed' })
  } else if (inv.updatedAt !== inv.createdAt) {
    events.push({ event: 'Case updated', timestamp: inv.updatedAt, type: 'update' })
  }
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

const timelineTypeConfig: Record<string, { color: string; dotClass: string; icon: React.ReactNode }> = {
  created: { color: 'text-zinc-600 dark:text-zinc-400', dotClass: 'bg-zinc-500', icon: <Plus className="h-3 w-3" /> },
  analysis: { color: 'text-blue-600 dark:text-blue-400', dotClass: 'bg-blue-500', icon: <Search className="h-3 w-3" /> },
  evidence: { color: 'text-amber-600 dark:text-amber-400', dotClass: 'bg-amber-500', icon: <Eye className="h-3 w-3" /> },
  update: { color: 'text-zinc-600 dark:text-zinc-400', dotClass: 'bg-zinc-500', icon: <TrendingUp className="h-3 w-3" /> },
  escalation: { color: 'text-red-600 dark:text-red-400', dotClass: 'bg-red-500', icon: <AlertOctagon className="h-3 w-3" /> },
  closed: { color: 'text-gray-600 dark:text-gray-400', dotClass: 'bg-gray-500', icon: <CheckCircle2 className="h-3 w-3" /> },
}

function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  return `${diffDays}d ago`
}

function getDaysActive(createdAt: string): number {
  const now = new Date()
  const created = new Date(createdAt)
  return Math.max(1, Math.floor((now.getTime() - created.getTime()) / 86400000))
}

function getTrustScoreColor(score: number): string {
  if (score < 30) return 'text-red-500'
  if (score <= 60) return 'text-yellow-500'
  return 'text-green-500'
}

function getTrustScoreBg(score: number): string {
  if (score < 30) return 'bg-red-500/10'
  if (score <= 60) return 'bg-yellow-500/10'
  return 'bg-green-500/10'
}

function EvidenceIcon({ type }: { type: string }) {
  switch (type) {
    case 'video': return <Video className="h-4 w-4 text-purple-500" />
    case 'image': return <ImageIcon className="h-4 w-4 text-blue-500" />
    case 'text': return <FileText className="h-4 w-4 text-amber-500" />
    default: return <FileText className="h-4 w-4 text-gray-500" />
  }
}

function RiskGauge({ priority }: { priority: InvestigationPriority }) {
  const score = priorityConfig[priority].score
  const markerPosition = score

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Risk Assessment</span>
        <Badge variant="outline" className={priorityConfig[priority].color}>
          {priorityConfig[priority].label} - {score}/100
        </Badge>
      </div>
      <div className="relative h-4 rounded-full overflow-hidden bg-muted">
        {/* Gradient bar */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)',
          }}
        />
        {/* Marker */}
        <motion.div
          className="absolute top-0 bottom-0 w-1.5 bg-white dark:bg-gray-900 shadow-lg rounded-full"
          style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }}
          initial={{ left: '0%' }}
          animate={{ left: `${markerPosition}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white dark:bg-gray-100 shadow-md border-2 border-gray-900 dark:border-gray-700" />
        </motion.div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
        <span>Critical</span>
      </div>
    </div>
  )
}

function QuickStats({ inv }: { inv: Investigation }) {
  const evidenceItems = evidenceFor(inv).length
  const daysActive = getDaysActive(inv.createdAt)

  const stats = [
    { label: 'Related Analyses', value: inv.relatedAnalyses, icon: <FileText className="h-4 w-4" />, color: 'text-blue-500' },
    { label: 'Evidence Items', value: evidenceItems, icon: <Shield className="h-4 w-4" />, color: 'text-amber-500' },
    { label: 'Days Active', value: daysActive, icon: <Clock className="h-4 w-4" />, color: 'text-zinc-500' },
    { label: 'Last Activity', value: getRelativeTime(inv.updatedAt), icon: <Activity className="h-4 w-4" />, color: 'text-zinc-500' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
        >
          <Card className="py-0">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-sm font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

function EvidenceSection({ inv, onDetach }: { inv: Investigation; onDetach: (reportId: string) => void }) {
  const evidence = evidenceFor(inv)

  if (evidence.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No evidence linked yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {evidence.map((item, idx) => (
        <motion.div
          key={item.reportId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08 }}
        >
          <Card
            className="cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-zinc-500/30 py-0"
            onClick={() => toast.info(`Opening evidence: ${item.title}`)}
          >
            <CardContent className="p-3 flex items-start gap-3">
              <div className={`p-2 rounded-lg ${getTrustScoreBg(item.trustScore)}`}>
                <EvidenceIcon type={item.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold ${getTrustScoreColor(item.trustScore)}`}>
                    Trust: {item.trustScore}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{item.date}</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {item.id}
              </Badge>
              <Button
                variant="outline"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  onDetach(item.reportId)
                }}
              >
                Remove
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

function EnhancedTimeline({ inv }: { inv: Investigation }) {
  const events = timelineFor(inv)

  if (events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No timeline events
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {events.map((item, idx) => {
        const config = timelineTypeConfig[item.type]
        const isLast = idx === events.length - 1

        return (
          <motion.div
            key={`${item.timestamp}-${idx}`}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.3 }}
            className="flex gap-3"
          >
            {/* Timeline line and dot */}
            <div className="flex flex-col items-center">
              <motion.div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${config.dotClass}/15 border-2 ${config.dotClass}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.08 + 0.1, type: 'spring', stiffness: 200 }}
              >
                {config.icon}
              </motion.div>
              {!isLast && (
                <div className="w-0.5 flex-1 min-h-[24px] bg-border" />
              )}
            </div>

            {/* Event content */}
            <div className={`pb-4 ${isLast ? '' : ''}`}>
              <p className={`text-sm font-medium ${config.color}`}>
                {item.event}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {item.timestamp}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {getRelativeTime(item.timestamp)}
                </Badge>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

export function InvestigationsTab() {
  const {
    investigations,
    fetchInvestigations,
    createInvestigation,
    updateInvestigation,
    deleteInvestigation,
    updateInvestigationStatus,
    updateInvestigationPriority,
    attachEvidence,
    detachEvidence,
    analysisHistory,
    analysisHistoryTotal,
    analysisHistoryPage,
    analysisHistoryLoading,
    fetchAnalysisHistory,
  } = useAppStore()

  useEffect(() => {
    void fetchInvestigations()
  }, [fetchInvestigations])
  const [selectedInv, setSelectedInv] = useState<Investigation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState('')
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    analyst: '',
    priority: 'medium' as InvestigationPriority,
    tags: '',
    caseNumber: '',
    firNumber: '',
    officerBadge: '',
    jurisdiction: '',
  })
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState<InvestigationPriority>('medium')
  const [newAnalyst, setNewAnalyst] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newCaseNumber, setNewCaseNumber] = useState('')
  const [newFirNumber, setNewFirNumber] = useState('')
  const [newOfficerBadge, setNewOfficerBadge] = useState('')
  const [newJurisdiction, setNewJurisdiction] = useState('')

  useEffect(() => {
    if (!selectedInv) return
    const refreshed = investigations.find((inv) => inv.id === selectedInv.id)
    if (refreshed) setSelectedInv(refreshed)
  }, [investigations, selectedInv?.id])

  const openEditDialog = () => {
    if (!selectedInv) return
    setEditForm({
      title: selectedInv.title,
      description: selectedInv.description,
      analyst: selectedInv.assignedAnalyst,
      priority: selectedInv.priority,
      tags: selectedInv.tags.join(', '),
      caseNumber: selectedInv.caseNumber ?? '',
      firNumber: selectedInv.firNumber ?? '',
      officerBadge: selectedInv.officerBadge ?? '',
      jurisdiction: selectedInv.jurisdiction ?? '',
    })
    setEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedInv || !editForm.title.trim()) return
    const changes = {
      title: editForm.title.trim(),
      description: editForm.description,
      assignedAnalyst: editForm.analyst.trim() || 'Unassigned',
      priority: editForm.priority,
      tags: editForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      caseNumber: editForm.caseNumber.trim() || null,
      firNumber: editForm.firNumber.trim() || null,
      officerBadge: editForm.officerBadge.trim() || null,
      jurisdiction: editForm.jurisdiction.trim() || null,
    }
    if (await updateInvestigation(selectedInv.id, changes)) {
      setSelectedInv((current) => current ? { ...current, ...changes } : current)
      setEditDialogOpen(false)
      toast.success('Investigation updated')
    }
  }

  const handleStatusChange = async (status: InvestigationStatus) => {
    if (!selectedInv) return
    if (await updateInvestigationStatus(selectedInv.id, status)) {
      setSelectedInv((current) => current ? { ...current, status } : current)
    }
  }

  const handlePriorityChange = async (priority: InvestigationPriority) => {
    if (!selectedInv) return
    if (await updateInvestigationPriority(selectedInv.id, priority)) {
      setSelectedInv((current) => current ? { ...current, priority } : current)
    }
  }

  const handleDelete = async () => {
    if (!selectedInv || !window.confirm(`Delete investigation "${selectedInv.title}"? This cannot be undone.`)) return
    if (await deleteInvestigation(selectedInv.id)) {
      setSelectedInv(null)
      toast.success('Investigation deleted')
    }
  }

  const loadEligibleReports = (page = 1) => {
    setSelectedReportId('')
    void fetchAnalysisHistory({
      page,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      unattachedOnly: true,
    })
  }

  const openEvidenceDialog = () => {
    setEvidenceDialogOpen(true);
    loadEligibleReports();
  }

  const handleAttachEvidence = async () => {
    if (!selectedInv || !selectedReportId) return
    if (await attachEvidence(selectedInv.id, selectedReportId)) {
      // Close dialog by resetting selectedReportId; Dialog will close via onOpenChange
      setSelectedReportId('')
    }
  }

  const handleDetachEvidence = async (reportId: string) => {
    if (!selectedInv) return
    await detachEvidence(selectedInv.id, reportId)
  }

  const handleCreate = () => {
    if (!newTitle.trim()) return
    createInvestigation({
      title: newTitle,
      description: newDescription,
      priority: newPriority,
      // The API column is `assignedTo`; it also doubles as the officer of record.
      assignedTo: newAnalyst || 'Unassigned',
      officerName: newAnalyst || null,
      officerBadge: newOfficerBadge || null,
      caseNumber: newCaseNumber || null,
      firNumber: newFirNumber || null,
      jurisdiction: newJurisdiction || null,
      tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setDialogOpen(false)
    setNewTitle('')
    setNewDescription('')
    setNewPriority('medium')
    setNewAnalyst('')
    setNewTags('')
    setNewCaseNumber('')
    setNewFirNumber('')
    setNewOfficerBadge('')
    setNewJurisdiction('')
  }

  const evidenceCount = useMemo(() => {
    if (!selectedInv) return 0
    return evidenceFor(selectedInv).length
  }, [selectedInv])

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-zinc-500" />
              Investigations
            </h2>
            <p className="text-sm text-muted-foreground">Manage and track investigation cases</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-zinc-600 hover:bg-zinc-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Investigation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Investigation</DialogTitle>
                <DialogDescription>Start a new investigation case</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Investigation title" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description" className="min-h-[80px]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <Select value={newPriority} onValueChange={(v) => setNewPriority(v as InvestigationPriority)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Analyst</label>
                    <Input value={newAnalyst} onChange={(e) => setNewAnalyst(e.target.value)} placeholder="Assigned to" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Tags (comma-separated)</label>
                  <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="e.g. deepfake, politics, media" />
                </div>

                {/* Case metadata - optional, but what makes an export citable in a case file */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Case record <span className="font-normal">(optional - appears on exported reports)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Case / DD number</label>
                      <Input value={newCaseNumber} onChange={(e) => setNewCaseNumber(e.target.value)} placeholder="DS/2026/0142" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">FIR number</label>
                      <Input value={newFirNumber} onChange={(e) => setNewFirNumber(e.target.value)} placeholder="0091/2026" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Officer badge</label>
                      <Input value={newOfficerBadge} onChange={(e) => setNewOfficerBadge(e.target.value)} placeholder="CCB-2214" />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Jurisdiction</label>
                      <Input value={newJurisdiction} onChange={(e) => setNewJurisdiction(e.target.value)} placeholder="Cyber Crime Branch" />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newTitle.trim()} className="bg-zinc-600 hover:bg-zinc-700 text-white">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Investigation List */}
        <div className="lg:col-span-2">
          <ScrollArea className="h-[700px]">
            <div className="space-y-3 pr-2">
              {investigations.map((inv, idx) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedInv?.id === inv.id ? 'ring-2 ring-zinc-500' : ''
                    }`}
                    onClick={() => setSelectedInv(inv)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{inv.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{inv.id}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                      </div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConfig[inv.status].color}`}>
                          {statusConfig[inv.status].label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityConfig[inv.priority].color}`}>
                          {inv.priority}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {inv.analyses.length} evidence
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Investigation Detail */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {selectedInv ? (
              <motion.div
                key={selectedInv.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <ScrollArea className="h-[700px]">
                  <div className="space-y-4 pr-2">
                    {/* Header Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{selectedInv.title}</CardTitle>
                            <CardDescription>{selectedInv.id}</CardDescription>
                          </div>
                          <Badge variant="outline" className={statusConfig[selectedInv.status].color}>
                            <span className="mr-1">{statusConfig[selectedInv.status].icon}</span>
                            {statusConfig[selectedInv.status].label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm">{selectedInv.description}</p>

                        <CaseRecord inv={selectedInv} />

                        <Separator />

                        {/* Risk Assessment Gauge */}
                        <RiskGauge priority={selectedInv.priority} />

                        <Separator />

                        {/* Quick Stats */}
                        <QuickStats inv={selectedInv} />

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Analyst</p>
                              <p className="text-sm font-medium">{selectedInv.assignedAnalyst}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Priority</p>
                              <Badge variant="outline" className={priorityConfig[selectedInv.priority].color}>
                                {priorityConfig[selectedInv.priority].label}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Created</p>
                              <p className="text-sm font-medium">{selectedInv.createdAt}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Updated</p>
                              <p className="text-sm font-medium">{selectedInv.updatedAt}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Tags</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedInv.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Evidence Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Shield className="h-4 w-4 text-amber-500" />
                            Evidence
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {evidenceCount} items
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <EvidenceSection inv={selectedInv} onDetach={(reportId) => void handleDetachEvidence(reportId)} />
                      </CardContent>
                    </Card>

                    {/* Timeline Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-zinc-500" />
                            Activity Timeline
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {timelineFor(selectedInv).length} events
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <EnhancedTimeline inv={selectedInv} />
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Status</label>
                            <Select
                              value={selectedInv.status}
                              onValueChange={(value) => void handleStatusChange(value as InvestigationStatus)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Priority</label>
                            <Select
                              value={selectedInv.priority}
                              onValueChange={(value) => void handlePriorityChange(value as InvestigationPriority)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button variant="outline" className="flex-1" onClick={openEditDialog}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Investigation
                          </Button>
                          <Button
                            className="bg-zinc-600 hover:bg-zinc-700 text-white flex-1"
                            onClick={openEvidenceDialog}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Evidence
                          </Button>
                          <Button
                            variant="outline"
                            className="border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 flex-1"
                            onClick={() => void handlePriorityChange('critical')}
                            disabled={selectedInv.priority === 'critical'}
                          >
                            <AlertOctagon className="h-4 w-4 mr-2" />
                            Escalate
                          </Button>
                          {selectedInv.status === 'closed' ? (
                            <Button variant="outline" className="flex-1" onClick={() => void handleStatusChange('in_progress')}>
                              <FolderOpen className="h-4 w-4 mr-2" />
                              Reopen Investigation
                            </Button>
                          ) : (
                            <Button variant="outline" className="flex-1" onClick={() => void handleStatusChange('closed')}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Close Investigation
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 flex-1"
                            onClick={() => void handleDelete()}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Investigation
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Dialog
                      open={evidenceDialogOpen}
                      onOpenChange={(open) => {
                        setEvidenceDialogOpen(open)
                        if (!open) setSelectedReportId('')
                      }}
                    >
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Add Evidence</DialogTitle>
                          <DialogDescription>Select an unattached analysis report to link to this investigation.</DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                          {analysisHistoryLoading ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Loading analysis reports...</p>
                          ) : analysisHistory.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">No unattached analysis reports found.</p>
                          ) : (
                            analysisHistory.map((report) => (
                              <label
                                key={report.id}
                                htmlFor={`evidence-report-${report.id}`}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"
                              >
                                <input
                                  id={`evidence-report-${report.id}`}
                                  type="radio"
                                  name="evidence-report"
                                  value={report.id}
                                  checked={selectedReportId === report.id}
                                  onChange={() => setSelectedReportId(report.id)}
                                  className="mt-1"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {ANALYSIS_LABEL[report.analysisType] ?? report.analysisType} · {report.mediaFileName}
                                  </span>
                                  <span className="mt-1 block text-xs text-muted-foreground">
                                    {report.riskLevel ?? 'unrated'} risk · Trust {Math.round(report.trustScore ?? 0)} · {report.createdAt.split('T')[0]}
                                  </span>
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                        {analysisHistoryTotal > 10 && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={analysisHistoryPage <= 1 || analysisHistoryLoading}
                              onClick={() => loadEligibleReports(analysisHistoryPage - 1)}
                            >
                              Previous
                            </Button>
                            <span>Page {analysisHistoryPage} of {Math.ceil(analysisHistoryTotal / 10)}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={analysisHistoryPage >= Math.ceil(analysisHistoryTotal / 10) || analysisHistoryLoading}
                              onClick={() => loadEligibleReports(analysisHistoryPage + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEvidenceDialogOpen(false)}>Cancel</Button>
                          <Button
                            onClick={() => void handleAttachEvidence()}
                            disabled={!selectedReportId || analysisHistoryLoading}
                            className="bg-zinc-600 hover:bg-zinc-700 text-white"
                          >
                            Attach Evidence
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Edit Investigation</DialogTitle>
                          <DialogDescription>Update the case details and assignment.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Title</label>
                            <Input
                              value={editForm.title}
                              onChange={(event) => setEditForm((form) => ({ ...form, title: event.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                              value={editForm.description}
                              onChange={(event) => setEditForm((form) => ({ ...form, description: event.target.value }))}
                              className="min-h-[80px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm font-medium">Analyst</label>
                              <Input
                                value={editForm.analyst}
                                onChange={(event) => setEditForm((form) => ({ ...form, analyst: event.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Priority</label>
                              <Select
                                value={editForm.priority}
                                onValueChange={(value) => setEditForm((form) => ({ ...form, priority: value as InvestigationPriority }))}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Tags (comma-separated)</label>
                            <Input
                              value={editForm.tags}
                              onChange={(event) => setEditForm((form) => ({ ...form, tags: event.target.value }))}
                            />
                          </div>
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground">Case record</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium">Case / DD number</label>
                                <Input
                                  value={editForm.caseNumber}
                                  onChange={(event) => setEditForm((form) => ({ ...form, caseNumber: event.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium">FIR number</label>
                                <Input
                                  value={editForm.firNumber}
                                  onChange={(event) => setEditForm((form) => ({ ...form, firNumber: event.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium">Officer badge</label>
                                <Input
                                  value={editForm.officerBadge}
                                  onChange={(event) => setEditForm((form) => ({ ...form, officerBadge: event.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium">Jurisdiction</label>
                                <Input
                                  value={editForm.jurisdiction}
                                  onChange={(event) => setEditForm((form) => ({ ...form, jurisdiction: event.target.value }))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                          <Button
                            onClick={() => void handleUpdate()}
                            disabled={!editForm.title.trim()}
                            className="bg-zinc-600 hover:bg-zinc-700 text-white"
                          >
                            Save Changes
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </ScrollArea>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card>
                  <CardContent className="p-12 flex flex-col items-center text-center gap-4">
                    <div className="p-4 rounded-full bg-zinc-500/10">
                      <Briefcase className="h-10 w-10 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Select an Investigation</p>
                      <p className="text-sm text-muted-foreground mt-1">Click on a case from the list to view details, evidence, and timeline</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
