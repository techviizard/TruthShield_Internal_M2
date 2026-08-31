'use client'

import { useState, useMemo, useEffect} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, GripVertical, Eye, EyeOff, Download, ChevronRight,
  LayoutTemplate, Settings2, Monitor, Clock, CheckCircle2,
  FileJson, FileDown, Code, Shield, BarChart3, AlertTriangle,
  Brain, Lightbulb, Paperclip, Plus, Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

// --- Types ---
interface ReportSection {
  id: string
  name: string
  description: string
  icon: React.ElementType
  enabled: boolean
  color: string
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: React.ElementType
  sections: string[]
  color: string
}

interface RecentReport {
  id: string
  title: string
  date: string
  type: string
  pages: number
  status: 'Generated' | 'Draft'
  format: string
}

// --- Default Sections ---
function getDefaultSections(): ReportSection[] {
  return [
    {
      id: 'executiveSummary',
      name: 'Executive Summary',
      description: 'High-level overview of findings and key metrics',
      icon: FileText,
      enabled: true,
      color: 'zinc',
    },
    {
      id: 'trustScoreOverview',
      name: 'Trust Score Overview',
      description: 'Trust score breakdown and trend analysis',
      icon: Shield,
      enabled: true,
      color: 'teal',
    },
    {
      id: 'detailedFindings',
      name: 'Detailed Findings',
      description: 'In-depth analysis results and flag details',
      icon: Search,
      enabled: true,
      color: 'cyan',
    },
    {
      id: 'mediaAnalysisResults',
      name: 'Media Analysis Results',
      description: 'Image, video, and audio forensics results',
      icon: BarChart3,
      enabled: true,
      color: 'blue',
    },
    {
      id: 'factCheckSummary',
      name: 'Fact Check Summary',
      description: 'Fact-check verification results and source ratings',
      icon: Brain,
      enabled: false,
      color: 'amber',
    },
    {
      id: 'threatIntelligence',
      name: 'Threat Intelligence',
      description: 'Threat landscape, indicators, and risk map data',
      icon: AlertTriangle,
      enabled: false,
      color: 'red',
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      description: 'Actionable steps and remediation guidance',
      icon: Lightbulb,
      enabled: true,
      color: 'yellow',
    },
    {
      id: 'appendix',
      name: 'Appendix',
      description: 'Raw data, methodology notes, and references',
      icon: Paperclip,
      enabled: false,
      color: 'slate',
    },
  ]
}

// --- Templates ---
const templates: ReportTemplate[] = [
  {
    id: 'fullVerification',
    name: 'Full Verification Report',
    description: 'Comprehensive analysis with all sections, detailed findings, and full evidence trail',
    icon: Shield,
    sections: ['executiveSummary', 'trustScoreOverview', 'detailedFindings', 'mediaAnalysisResults', 'factCheckSummary', 'threatIntelligence', 'recommendations', 'appendix'],
    color: 'zinc',
  },
  {
    id: 'quickSummary',
    name: 'Quick Summary',
    description: 'Brief overview with key metrics and top-level findings for rapid review',
    icon: FileText,
    sections: ['executiveSummary', 'trustScoreOverview', 'recommendations'],
    color: 'teal',
  },
  {
    id: 'investigationBrief',
    name: 'Investigation Brief',
    description: 'Focused report for active investigations with threat intel and evidence links',
    icon: Search,
    sections: ['executiveSummary', 'detailedFindings', 'threatIntelligence', 'recommendations'],
    color: 'amber',
  },
  {
    id: 'mediaForensics',
    name: 'Media Forensics Report',
    description: 'Specialized deep-dive into media analysis, forensics, and manipulation detection',
    icon: BarChart3,
    sections: ['executiveSummary', 'mediaAnalysisResults', 'detailedFindings', 'appendix'],
    color: 'cyan',
  },
]


// --- Helpers ---
function getSectionColorClasses(color: string) {
  const map: Record<string, { icon: string; bg: string; border: string; dot: string }> = {
    zinc: { icon: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', dot: 'bg-zinc-500' },
    teal: { icon: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', dot: 'bg-zinc-500' },
    cyan: { icon: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', dot: 'bg-cyan-500' },
    blue: { icon: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
    amber: { icon: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
    red: { icon: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
    yellow: { icon: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: 'bg-yellow-500' },
    slate: { icon: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', dot: 'bg-slate-500' },
  }
  return map[color] || map.zinc
}

function getTemplateColorClasses(color: string) {
  const map: Record<string, { gradient: string; border: string; icon: string; badge: string }> = {
    zinc: { gradient: 'from-zinc-500/10 to-zinc-500/5', border: 'border-zinc-500/30', icon: 'text-zinc-500', badge: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400' },
    teal: { gradient: 'from-zinc-500/10 to-cyan-500/5', border: 'border-zinc-500/30', icon: 'text-zinc-500', badge: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400' },
    amber: { gradient: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-500/30', icon: 'text-amber-500', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    cyan: { gradient: 'from-cyan-500/10 to-blue-500/5', border: 'border-cyan-500/30', icon: 'text-cyan-500', badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
  }
  return map[color] || map.zinc
}

// --- Stagger Animation Config ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// --- Component ---
export function ReportGeneratorTab() {
  const [sections, setSections] = useState<ReportSection[]>(getDefaultSections())
  const [recentReports, setRecentReports] = useState<RecentReport[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [reportTitle, setReportTitle] = useState('TruthShield Verification Report')
  const [authorName, setAuthorName] = useState('')
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0],
  )
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [classification, setClassification] = useState('Internal')
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeRawData, setIncludeRawData] = useState(false)
  const [includeRecommendations, setIncludeRecommendations] = useState(true)
  const [coverPage, setCoverPage] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  // "Recent reports" are the real report_exported entries in the audit log.
  useEffect(() => {
    let aborted = false
    Promise.all([
      fetch('/api/audit/logs?action=report_exported&limit=10').then((r) => r.json()).catch(() => null),
      fetch('/api/config').then((r) => r.json()).catch(() => null),
    ]).then(([logs, cfg]) => {
      if (aborted) return
      if (cfg?.success && cfg.config?.demo?.name) setAuthorName(cfg.config.demo.name)
      if (!Array.isArray(logs?.items)) return
      setRecentReports(
        logs.items.map((row: Record<string, unknown>) => {
          let details: Record<string, unknown> = {}
          try {
            details = typeof row.details === 'string' ? JSON.parse(row.details) : {}
          } catch {
            details = {}
          }
          return {
            id: String(row.id).slice(-8).toUpperCase(),
            title: String(details.summary ?? 'Generated report'),
            date: String(row.createdAt ?? '').split('T')[0],
            type: `${details.count ?? 0} analyses`,
            pages: Number(details.count ?? 0),
            status: 'Generated' as const,
            format: String(details.format ?? 'html').toUpperCase(),
          }
        }),
      )
    })
    return () => {
      aborted = true
    }
  }, [])

  const enabledCount = sections.filter((s) => s.enabled).length
  const estimatedPages = useMemo(() => {
    const basePages = coverPage ? 2 : 1
    const sectionPages = sections.filter((s) => s.enabled).reduce((acc, s) => {
      const pageMap: Record<string, number> = {
        executiveSummary: 2,
        trustScoreOverview: 3,
        detailedFindings: 6,
        mediaAnalysisResults: 5,
        factCheckSummary: 3,
        threatIntelligence: 4,
        recommendations: 2,
        appendix: 4,
      }
      return acc + (pageMap[s.id] || 2)
    }, 0)
    const chartPages = includeCharts ? 2 : 0
    const rawDataPages = includeRawData ? 3 : 0
    return basePages + sectionPages + chartPages + rawDataPages
  }, [sections, includeCharts, includeRawData, coverPage])

  const fileSizeEstimates = useMemo(() => ({
    PDF: `${(estimatedPages * 0.15).toFixed(1)} MB`,
    DOCX: `${(estimatedPages * 0.08).toFixed(1)} MB`,
    HTML: `${(estimatedPages * 0.04).toFixed(1)} MB`,
    JSON: `${(estimatedPages * 0.12).toFixed(1)} MB`,
  }), [estimatedPages])

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    setSelectedTemplate(templateId)
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        enabled: template.sections.includes(s.id),
      }))
    )
    toast.success(`Applied "${template.name}" template`)
  }

  const handleGenerate = (format: string) => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      toast.success(`Report generated as ${format} - ${estimatedPages} pages`)
    }, 2000)
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="relative">
                <FileText className="h-7 w-7 text-zinc-500" />
                <div className="absolute -inset-1.5 rounded-full bg-zinc-500/20 blur-md" />
              </div>
              Report Generator
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 ml-10">
              Build custom verification reports with drag-and-drop sections
            </p>
          </div>
          <div className="flex items-center gap-2 ml-10 sm:ml-0">
            <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20">
              {enabledCount}/{sections.length} Sections
            </Badge>
            <Badge variant="outline" className="bg-muted/50">
              ~{estimatedPages} pages
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* Report Template Selector */}
      <motion.div variants={itemVariants}>
        <Card className="glass border">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <LayoutTemplate className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-semibold">Report Templates</h3>
              <span className="text-xs text-muted-foreground ml-auto">Select a pre-built template or customize your own</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {templates.map((template) => {
                const colors = getTemplateColorClasses(template.color)
                const isSelected = selectedTemplate === template.id
                const sectionCount = template.sections.length
                return (
                  <motion.button
                    key={template.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => applyTemplate(template.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `${colors.border} bg-gradient-to-br ${colors.gradient} shadow-sm`
                        : 'border-border/50 hover:border-zinc-500/30 bg-muted/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`p-2 rounded-lg ${colors.badge}`}>
                        <template.icon className="h-4 w-4" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>
                    <p className="text-sm font-semibold mb-1">{template.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">{template.description}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors.badge}`}>
                      {sectionCount} sections
                    </Badge>
                  </motion.button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid: Builder + Config + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Builder Canvas (2 cols) */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="glass border h-full">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <GripVertical className="h-4 w-4 text-zinc-500" />
                <h3 className="text-sm font-semibold">Report Builder Canvas</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  Toggle sections on/off to customize your report
                </span>
              </div>
              <ScrollArea className="max-h-[520px]">
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {sections.map((section, index) => {
                      const colors = getSectionColorClasses(section.color)
                      const Icon = section.icon
                      return (
                        <motion.div
                          key={section.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            section.enabled
                              ? `${colors.border} bg-gradient-to-r from-background to-${section.color}-500/[0.03]`
                              : 'border-border/30 bg-muted/20 opacity-60'
                          }`}
                        >
                          {/* Drag handle */}
                          <div className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                            <GripVertical className="h-4 w-4" />
                          </div>

                          {/* Section icon */}
                          <div className={`p-2 rounded-lg ${colors.bg}`}>
                            <Icon className={`h-4 w-4 ${colors.icon}`} />
                          </div>

                          {/* Section info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{section.name}</p>
                              {section.enabled && (
                                <div className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                          </div>

                          {/* Preview indicator */}
                          <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${
                            section.enabled
                              ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
                              : 'bg-muted/50 text-muted-foreground'
                          }`}>
                            {section.enabled ? (
                              <>
                                <Eye className="h-3 w-3" />
                                Visible
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3" />
                                Hidden
                              </>
                            )}
                          </div>

                          {/* Toggle switch */}
                          <Switch
                            checked={section.enabled}
                            onCheckedChange={() => toggleSection(section.id)}
                            aria-label={`Toggle ${section.name}`}
                          />
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column: Config + Preview */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Report Configuration Panel */}
          <Card className="glass border">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="h-4 w-4 text-zinc-500" />
                <h3 className="text-sm font-semibold">Configuration</h3>
              </div>
              <div className="space-y-4">
                {/* Report title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Report Title</label>
                  <Input
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="h-9 text-sm"
                    placeholder="Enter report title..."
                  />
                </div>

                {/* Author name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Author</label>
                  <Input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="h-9 text-sm"
                    placeholder="Author name..."
                  />
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">From</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">To</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Classification */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Classification Level</label>
                  <Select value={classification} onValueChange={setClassification}>
                    <SelectTrigger className="h-9 text-sm">
                      <Shield className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Public">Public</SelectItem>
                      <SelectItem value="Internal">Internal</SelectItem>
                      <SelectItem value="Confidential">Confidential</SelectItem>
                      <SelectItem value="Restricted">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Toggle options */}
                <div className="space-y-3">
                  {[
                    { label: 'Include charts', checked: includeCharts, onChange: setIncludeCharts, icon: BarChart3 },
                    { label: 'Include raw data', checked: includeRawData, onChange: setIncludeRawData, icon: Code },
                    { label: 'Include recommendations', checked: includeRecommendations, onChange: setIncludeRecommendations, icon: Lightbulb },
                    { label: 'Cover page', checked: coverPage, onChange: setCoverPage, icon: FileText },
                  ].map((opt) => (
                    <div key={opt.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </div>
                      <Switch
                        checked={opt.checked}
                        onCheckedChange={opt.onChange}
                        aria-label={opt.label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Preview Panel */}
          <Card className="glass border">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="h-4 w-4 text-zinc-500" />
                <h3 className="text-sm font-semibold">Live Preview</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20">
                  ~{estimatedPages} pages
                </Badge>
              </div>
              {/* Miniaturized report preview */}
              <div className="bg-muted/30 rounded-lg border border-border/50 p-3 space-y-2">
                {/* Cover page preview */}
                {coverPage && (
                  <div className="bg-background rounded-md border border-border/30 p-3 text-center">
                    <div className="h-2 w-12 bg-zinc-500/30 rounded mx-auto mb-1.5" />
                    <div className="h-1.5 w-20 bg-muted-foreground/20 rounded mx-auto mb-1" />
                    <div className="h-1 w-14 bg-muted-foreground/10 rounded mx-auto mb-2" />
                    <div className="text-[8px] text-muted-foreground/50 font-mono">{reportTitle}</div>
                    <div className="text-[7px] text-muted-foreground/30 mt-0.5">{authorName} · {classification}</div>
                  </div>
                )}
                {/* Section thumbnails */}
                {sections.filter((s) => s.enabled).map((section) => {
                  const colors = getSectionColorClasses(section.color)
                  return (
                    <div
                      key={section.id}
                      className="bg-background rounded-md border border-border/30 p-2 flex items-center gap-2"
                    >
                      <div className={`h-5 w-5 rounded ${colors.bg} flex items-center justify-center shrink-0`}>
                        <section.icon className={`h-2.5 w-2.5 ${colors.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="h-1 w-14 bg-muted-foreground/15 rounded" />
                        <div className="h-0.5 w-10 bg-muted-foreground/8 rounded mt-1" />
                      </div>
                      <div className={`h-1 w-1 rounded-full ${colors.dot}`} />
                    </div>
                  )
                })}
                {sections.filter((s) => s.enabled).length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground/50">
                    No sections enabled
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Export Options */}
      <motion.div variants={itemVariants}>
        <Card className="glass border">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Download className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-semibold">Export Report</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                Choose your preferred format
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { format: 'PDF', icon: FileDown, desc: 'Print-ready document', ext: '.pdf' },
                { format: 'DOCX', icon: FileText, desc: 'Editable Word document', ext: '.docx' },
                { format: 'HTML', icon: Code, desc: 'Web-ready report', ext: '.html' },
                { format: 'JSON', icon: FileJson, desc: 'Structured data export', ext: '.json' },
              ].map((exp) => (
                <motion.button
                  key={exp.format}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={isGenerating || enabledCount === 0}
                  onClick={() => handleGenerate(exp.format)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-zinc-500/10 hover:border-zinc-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="p-2.5 rounded-lg bg-zinc-500/10 group-hover:bg-zinc-500/20 transition-colors">
                    <exp.icon className="h-5 w-5 text-zinc-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">{exp.format}</p>
                    <p className="text-[10px] text-muted-foreground">{exp.desc}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{fileSizeEstimates[exp.format as keyof typeof fileSizeEstimates]} · {exp.ext}</p>
                  </div>
                  {isGenerating ? (
                    <div className="h-4 w-4 border-2 border-zinc-500/30 border-t-zinc-500 rounded-full animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-zinc-500 transition-colors" />
                  )}
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Reports Table */}
      <motion.div variants={itemVariants}>
        <Card className="glass border">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-zinc-500" />
              <h3 className="text-sm font-semibold">Recent Reports</h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto bg-muted/50">
                {recentReports.length} reports
              </Badge>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">Title</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground">Pages</th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((report) => (
                    <tr key={report.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[280px]">{report.title}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{report.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{report.date}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                          {report.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center text-xs">{report.pages}</td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            report.status === 'Generated'
                              ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {report.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => toast.success(`Downloading ${report.title}...`)}
                        >
                          <Download className="h-3 w-3" />
                          {report.format}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-3">
              {recentReports.map((report) => (
                <div key={report.id} className="p-3 rounded-lg border border-border/30 bg-muted/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{report.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{report.id}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 shrink-0 ${
                        report.status === 'Generated'
                          ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {report.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {report.date}
                    </span>
                    <span>{report.pages} pages</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                      {report.type}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6 text-[10px] gap-0.5"
                      onClick={() => toast.success(`Downloading ${report.title}...`)}
                    >
                      <Download className="h-3 w-3" />
                      {report.format}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
              <span className="text-xs text-muted-foreground/60">
                Showing {recentReports.length} most recent reports
              </span>
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-zinc-600 dark:text-zinc-400">
                View All Reports
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Create New Report floating action */}
      <motion.div
        variants={itemVariants}
        className="flex justify-center"
      >
        <Button
          size="lg"
          className="bg-zinc-600 hover:bg-zinc-700 text-white gap-2 shadow-lg shadow-zinc-500/20"
          disabled={isGenerating || enabledCount === 0}
          onClick={() => handleGenerate('PDF')}
        >
          {isGenerating ? (
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isGenerating ? 'Generating Report...' : 'Generate Report'}
        </Button>
      </motion.div>
    </motion.div>
  )
}
