'use client'

import { useState, useCallback, useEffect} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Workflow, Zap, Shield, Eye, Bell, Download, Play, Pause,
  Settings, Plus, ChevronRight, Clock, Activity, CheckCircle2,
  XCircle, Loader2, AlertTriangle, Search, FileText, BarChart3,
  Mail, Timer, ArrowRight, Edit, ToggleLeft, ToggleRight, Calendar,
  Filter, Sparkles, Layers, GitBranch,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Types ──────────────────────────────────────────────────────

type WorkflowStatus = 'active' | 'inactive'
type ExecutionStatus = 'success' | 'failed' | 'running'
type StepType = 'trigger' | 'analyze' | 'verify' | 'notify' | 'export'
type TriggerType = 'onUpload' | 'onAlert' | 'onSchedule' | 'onThreshold' | 'manual'
type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

interface PipelineStep {
  id: string
  type: StepType
  name: string
  config: string
  icon: React.ElementType
}

interface WorkflowItem {
  id: string
  name: string
  steps: PipelineStep[]
  status: WorkflowStatus
  runs: number
  lastRun: string
}

interface Execution {
  id: string
  workflowName: string
  trigger: string
  status: ExecutionStatus
  duration: string
  timestamp: string
}

// ── Config Maps ────────────────────────────────────────────────

const stepTypeConfig: Record<StepType, { color: string; bgColor: string; borderColor: string }> = {
  trigger: { color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  analyze: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  verify: { color: 'text-zinc-500', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30' },
  notify: { color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
  export: { color: 'text-zinc-500', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/30' },
}

const executionStatusConfig: Record<ExecutionStatus, { bg: string; text: string; icon: React.ElementType; color: string }> = {
  success: { bg: 'bg-zinc-500/10', text: 'text-zinc-600 dark:text-zinc-400', icon: CheckCircle2, color: '#10b981' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', icon: XCircle, color: '#ef4444' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', icon: Loader2, color: '#3b82f6' },
}

// ── Mock Data ──────────────────────────────────────────────────


const demoPipelineSteps: PipelineStep[] = [
  { id: 'dp1', type: 'trigger', name: 'Upload', config: 'New media upload', icon: Zap },
  { id: 'dp2', type: 'analyze', name: 'AI Analysis', config: 'Multi-model scan', icon: Eye },
  { id: 'dp3', type: 'verify', name: 'Threshold Check', config: 'Trust score < 30', icon: Shield },
  { id: 'dp4', type: 'notify', name: 'Alert if Critical', config: 'Immediate notification', icon: Bell },
  { id: 'dp5', type: 'export', name: 'Generate Report', config: 'Full analysis report', icon: FileText },
]

/** Prisma WorkflowRule row -> UI shapes. */
interface ApiRule {
  id: string
  name: string
  description: string | null
  triggerType: string
  conditions: string
  actions: string
  isActive: boolean
  createdAt: string
  executions: { id: string; status: string; durationMs: number | null; triggeredAt: string }[]
}

const ACTION_STEP: Record<string, { type: StepType; name: string; icon: React.ElementType }> = {
  create_investigation: { type: 'analyze', name: 'Create investigation', icon: Search },
  create_alert: { type: 'notify', name: 'Raise alert', icon: Bell },
  run_clustering: { type: 'analyze', name: 'Run clustering', icon: BarChart3 },
  export_report: { type: 'export', name: 'Export report', icon: FileText },
}

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} d ago`
}

function ruleToWorkflow(rule: ApiRule): WorkflowItem {
  let actions: string[] = []
  try {
    const parsed = JSON.parse(rule.actions)
    actions = Array.isArray(parsed) ? parsed : []
  } catch {
    actions = []
  }
  const steps: PipelineStep[] = [
    { id: `${rule.id}-trigger`, type: 'trigger', name: rule.triggerType.replace(/_/g, ' '), config: rule.conditions, icon: Zap },
    ...actions.map((a, i) => {
      const meta = ACTION_STEP[a] ?? { type: 'analyze' as StepType, name: a.replace(/_/g, ' '), icon: Activity }
      return { id: `${rule.id}-a${i}`, type: meta.type, name: meta.name, config: a, icon: meta.icon }
    }),
  ]
  const last = rule.executions[0]
  return {
    id: rule.id,
    name: rule.name,
    steps,
    status: rule.isActive ? 'active' : 'inactive',
    runs: rule.executions.length,
    lastRun: last ? relTime(last.triggeredAt) : 'never',
  }
}

function ruleToExecutions(rule: ApiRule): Execution[] {
  return rule.executions.map((e) => ({
    id: e.id,
    workflowName: rule.name,
    trigger: rule.triggerType.replace(/_/g, ' '),
    status: (e.status === 'success' ? 'success' : e.status === 'failed' ? 'failed' : 'running') as ExecutionStatus,
    duration: e.durationMs != null ? `${(e.durationMs / 1000).toFixed(2)}s` : '—',
    timestamp: relTime(e.triggeredAt),
  }))
}

const workflowTemplates = [
  {
    id: 'tpl1',
    name: 'Deepfake First Response',
    description: 'Automated first-response pipeline for deepfake detections with team notification and investigation creation.',
    stepCount: 4,
    estimatedTime: '~2 min per run',
    icon: Shield,
    color: 'from-red-500/20 to-orange-500/10',
    borderColor: 'border-red-500/20',
    steps: ['Deepfake Detection', 'Notify Team', 'Create Investigation', 'Assign Analyst'],
  },
  {
    id: 'tpl2',
    name: 'Misinformation Tracker',
    description: 'Track and verify viral misinformation across social media platforms with automated fact-checking.',
    stepCount: 5,
    estimatedTime: '~3 min per run',
    icon: Search,
    color: 'from-amber-500/20 to-yellow-500/10',
    borderColor: 'border-amber-500/20',
    steps: ['On Upload', 'AI Analysis', 'Fact Check', 'Risk Assessment', 'Alert if Critical'],
  },
  {
    id: 'tpl3',
    name: 'Comprehensive Analysis',
    description: 'Full-spectrum media verification pipeline combining image forensics, fact-checking, and source credibility.',
    stepCount: 6,
    estimatedTime: '~5 min per run',
    icon: Layers,
    color: 'from-zinc-500/20 to-zinc-500/10',
    borderColor: 'border-zinc-500/20',
    steps: ['Upload', 'Image Forensics', 'AI Analysis', 'Fact Check', 'Source Credibility', 'Full Report'],
  },
  {
    id: 'tpl4',
    name: 'Custom Workflow',
    description: 'Start from scratch and build your own automated verification pipeline with custom triggers and steps.',
    stepCount: 0,
    estimatedTime: 'Variable',
    icon: Plus,
    color: 'from-purple-500/20 to-indigo-500/10',
    borderColor: 'border-purple-500/20',
    steps: [],
  },
]

// ── Pipeline Visualization Component ───────────────────────────

function PipelineVisualization({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {steps.map((step, i) => {
        const config = stepTypeConfig[step.type]
        const IconComp = step.icon
        return (
          <div key={step.id} className="flex items-center shrink-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-lg border ${config.borderColor} ${config.bgColor} transition-all hover:scale-110`}>
                <IconComp className={`h-4 w-4 ${config.color}`} />
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-background border border-border flex items-center justify-center">
                  <span className="text-[7px] font-bold text-muted-foreground">{i + 1}</span>
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground font-medium max-w-[72px] text-center leading-tight truncate">
                {step.name}
              </span>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: i * 0.1 + 0.05, duration: 0.3 }}
                className="flex items-center mx-1.5"
              >
                <div className="h-px w-4 bg-gradient-to-r from-zinc-500/50 to-zinc-500/30" />
                <ChevronRight className="h-3 w-3 text-zinc-500/50 -ml-1" />
              </motion.div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Demo Pipeline Builder (SVG-based) ──────────────────────────

function PipelineBuilder() {
  const nodeWidth = 140
  const nodeHeight = 72
  const gapX = 80
  const svgWidth = demoPipelineSteps.length * (nodeWidth + gapX) + 80
  const svgHeight = 180
  const startX = 40

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full min-w-[600px] h-auto"
        style={{ minHeight: 160 }}
      >
        <defs>
          <filter id="pipelineGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="arrowHead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#10b981" opacity="0.6" />
          </marker>
          <linearGradient id="connGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Background grid */}
        <pattern id="wfGrid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.06" />
        </pattern>
        <rect width={svgWidth} height={svgHeight} fill="url(#wfGrid)" />

        {/* Connection lines with arrows */}
        {demoPipelineSteps.map((step, i) => {
          if (i === demoPipelineSteps.length - 1) return null
          const x1 = startX + i * (nodeWidth + gapX) + nodeWidth
          const x2 = startX + (i + 1) * (nodeWidth + gapX)
          const y = svgHeight / 2
          return (
            <g key={`conn-${step.id}`}>
              <motion.line
                x1={x1} y1={y} x2={x2} y2={y}
                stroke="url(#connGradient)"
                strokeWidth="2"
                markerEnd="url(#arrowHead)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.15 }}
              />
              <motion.circle
                cx={(x1 + x2) / 2}
                cy={y}
                r="3"
                fill="#10b981"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, delay: 1 + i * 0.3, repeat: Infinity }}
              />
            </g>
          )
        })}

        {/* Step nodes */}
        {demoPipelineSteps.map((step, i) => {
          const config = stepTypeConfig[step.type]
          const IconComp = step.icon
          const x = startX + i * (nodeWidth + gapX)
          const y = svgHeight / 2 - nodeHeight / 2
          const colors: Record<StepType, string> = {
            trigger: '#f59e0b',
            analyze: '#3b82f6',
            verify: '#10b981',
            notify: '#a855f7',
            export: '#14b8a6',
          }
          const stepColor = colors[step.type]
          return (
            <motion.g
              key={step.id}
              initial={{ opacity: 0, y: y + 20 }}
              animate={{ opacity: 1, y }}
              transition={{ duration: 0.4, delay: i * 0.12, type: 'spring', stiffness: 200 }}
            >
              {/* Node background */}
              <rect
                x={x} y={y}
                width={nodeWidth} height={nodeHeight}
                rx="12"
                fill={stepColor + '10'}
                stroke={stepColor}
                strokeWidth="1.5"
                filter="url(#pipelineGlow)"
              />
              {/* Type indicator dot */}
              <circle cx={x + 16} cy={y + 20} r="6" fill={stepColor + '25'} stroke={stepColor} strokeWidth="1" />
              {/* Step type label */}
              <text
                x={x + 28} y={y + 23}
                className="fill-muted-foreground text-[8px] font-semibold uppercase"
              >
                {step.type}
              </text>
              {/* Step name */}
              <text
                x={x + nodeWidth / 2} y={y + 45}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-bold"
              >
                {step.name}
              </text>
              {/* Config summary */}
              <text
                x={x + nodeWidth / 2} y={y + 60}
                textAnchor="middle"
                className="fill-muted-foreground text-[8px]"
              >
                {step.config}
              </text>
              {/* Step number */}
              <circle cx={x + nodeWidth - 12} cy={y + 12} r="8" fill={stepColor + '30'} />
              <text
                x={x + nodeWidth - 12} y={y + 15.5}
                textAnchor="middle"
                className="fill-foreground text-[9px] font-bold"
              >
                {i + 1}
              </text>
            </motion.g>
          )
        })}

        {/* Add Step button */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <rect
            x={startX + demoPipelineSteps.length * (nodeWidth + gapX) - gapX / 2}
            y={svgHeight / 2 - 16}
            width={36} height={32}
            rx="8"
            fill="#10b98110"
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text
            x={startX + demoPipelineSteps.length * (nodeWidth + gapX) - gapX / 2 + 18}
            y={svgHeight / 2 + 4}
            textAnchor="middle"
            className="fill-zinc-500 text-[16px] font-bold"
          >
            +
          </text>
        </motion.g>
      </svg>
    </div>
  )
}

// ── Workflow Card Component ────────────────────────────────────

function WorkflowCard({ workflow, index }: { workflow: WorkflowItem; index: number }) {
  const [isActive, setIsActive] = useState(workflow.status === 'active')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="glass overflow-hidden transition-all hover:shadow-lg border-border/50">
        <CardContent className="p-4 md:p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold">{workflow.name}</h3>
                <Badge className={`text-[10px] border ${isActive ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30' : 'bg-muted/50 text-muted-foreground border-border/50'}`}>
                  {isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {workflow.runs.toLocaleString()} runs
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {workflow.lastRun}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Edit workflow"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <button
                onClick={() => setIsActive(!isActive)}
                className="focus:outline-none"
                aria-label={isActive ? 'Deactivate workflow' : 'Activate workflow'}
              >
                {isActive ? (
                  <ToggleRight className="h-6 w-6 text-zinc-500" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Pipeline visualization */}
          <div className="p-3 rounded-lg bg-background/30 border border-border/20">
            <PipelineVisualization steps={workflow.steps} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Trigger Configuration Panel ────────────────────────────────

function TriggerConfigPanel() {
  const [triggerType, setTriggerType] = useState<TriggerType>('onUpload')
  const [condition, setCondition] = useState('trustScore')
  const [scheduleFreq, setScheduleFreq] = useState<ScheduleFrequency>('daily')
  const [scheduleTime, setScheduleTime] = useState('09:00')

  const triggerOptions: { value: TriggerType; label: string; icon: React.ElementType }[] = [
    { value: 'onUpload', label: 'On Upload', icon: Zap },
    { value: 'onAlert', label: 'On Alert', icon: Bell },
    { value: 'onSchedule', label: 'On Schedule', icon: Calendar },
    { value: 'onThreshold', label: 'On Threshold', icon: Activity },
    { value: 'manual', label: 'Manual', icon: Play },
  ]

  const conditionOptions = [
    { value: 'trustScore', label: 'When trust score < 30' },
    { value: 'riskCritical', label: 'When risk level = Critical' },
    { value: 'deepfakeDetected', label: 'When deepfake detected' },
    { value: 'viralContent', label: 'When content goes viral' },
    { value: 'newUpload', label: 'When new media uploaded' },
    { value: 'alertTriggered', label: 'When alert is triggered' },
  ]

  return (
    <div className="space-y-4">
      {/* Trigger Type Selector */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Trigger Type
        </label>
        <div className="grid grid-cols-5 gap-2">
          {triggerOptions.map((opt) => {
            const IconComp = opt.icon
            const isSelected = triggerType === opt.value
            return (
              <motion.button
                key={opt.value}
                onClick={() => setTriggerType(opt.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-[11px] font-medium transition-all ${
                  isSelected
                    ? 'border-zinc-500/50 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 shadow-sm'
                    : 'border-border/50 bg-background/30 text-muted-foreground hover:border-zinc-500/30 hover:bg-zinc-500/5'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <IconComp className={`h-4 w-4 ${isSelected ? 'text-zinc-500' : ''}`} />
                {opt.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Condition Builder */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Condition
        </label>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-full bg-background/50 border-border/50 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {conditionOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Schedule Config (only shown when trigger is onSchedule) */}
      {triggerType === 'onSchedule' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Schedule Configuration
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Frequency</label>
              <Select value={scheduleFreq} onValueChange={(v) => setScheduleFreq(v as ScheduleFrequency)}>
                <SelectTrigger className="w-full bg-background/50 border-border/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-border/50 bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
              />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-500/5 border border-zinc-500/20">
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Workflow will run <strong>{scheduleFreq}</strong> at <strong>{scheduleTime}</strong>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export function WorkflowAutomationTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [rules, setRules] = useState<ApiRule[]>([])

  // Workflow rules and their execution history live in the database.
  useEffect(() => {
    let aborted = false
    fetch('/api/workflows')
      .then((r) => r.json())
      .then((j) => {
        if (!aborted && j?.success) setRules(j.rules as ApiRule[])
      })
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [])

  const workflows = rules.map(ruleToWorkflow)
  const activeCount = rules.filter((r) => r.isActive).length
  const allExecutions = rules.flatMap((r) => r.executions)
  const successCount = allExecutions.filter((e) => e.status === 'success').length
  const successRate = allExecutions.length
    ? Math.round((successCount / allExecutions.length) * 1000) / 10
    : 0
  const avgDurationMs = allExecutions.length
    ? allExecutions.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / allExecutions.length
    : 0
  const executions = rules
    .flatMap(ruleToExecutions)
    .slice(0, 12)

  const handleUseTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId)
    setTimeout(() => setSelectedTemplate(null), 2000)
  }, [])

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
                  <Workflow className="h-8 w-8 text-zinc-500" />
                </motion.div>
                <motion.div
                  className="absolute -inset-2 rounded-xl bg-zinc-500/10 blur-xl -z-10"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-zinc-600 to-zinc-600 dark:from-zinc-400 dark:to-zinc-400 bg-clip-text text-transparent">
                    Workflow Automation
                  </h2>
                  <Badge className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 text-[10px] flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-500" />
                    </span>
                    {activeCount} Active Workflows
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground max-w-xl">
                  Build automated verification pipelines and triggers
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-zinc-600 to-zinc-600 text-white text-[11px] h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Workflow
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 2. Quick Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Workflows', value: String(activeCount), icon: GitBranch, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
          { label: 'Total Executions', value: allExecutions.length.toLocaleString(), icon: Play, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Success Rate', value: `${successRate}%`, icon: CheckCircle2, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
          { label: 'Avg Duration', value: avgDurationMs ? `${(avgDurationMs / 1000).toFixed(1)}s` : '—', icon: Timer, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
          >
            <Card className="glass hover:shadow-lg transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── 3. Active Workflows ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-zinc-500" />
                Active Workflows
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {workflows.length} workflows
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {workflows.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full py-6 text-center">
                  No workflow rules defined yet.
                </p>
              )}
              {workflows.map((workflow, i) => (
                <WorkflowCard key={workflow.id} workflow={workflow} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 4. Pipeline Builder ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-zinc-500" />
                Pipeline Builder
              </CardTitle>
              <div className="flex items-center gap-2">
                {(['trigger', 'analyze', 'verify', 'notify', 'export'] as StepType[]).map((type) => {
                  const config = stepTypeConfig[type]
                  return (
                    <div key={type} className="flex items-center gap-1 text-[10px]">
                      <div className={`w-2 h-2 rounded-full ${config.bgColor} border ${config.borderColor}`} />
                      <span className="text-muted-foreground capitalize hidden sm:inline">{type}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-xl bg-background/30 border border-border/20">
              <PipelineBuilder />
            </div>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <Button
                size="sm"
                className="bg-gradient-to-r from-zinc-600 to-zinc-600 text-white text-[11px] h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Step
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-8"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Test Pipeline
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-8"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Save Pipeline
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 5. Trigger Configuration ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-zinc-500" />
                Trigger Configuration
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7"
              >
                <Settings className="h-3 w-3 mr-1" />
                Advanced
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <TriggerConfigPanel />
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 6. Workflow Templates ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-500" />
                Workflow Templates
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                4 templates
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {workflowTemplates.map((template, i) => {
                const IconComp = template.icon
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    whileHover={{ scale: 1.02, borderColor: 'rgba(16,185,129,0.3)' }}
                    className={`p-4 rounded-xl border bg-gradient-to-br ${template.color} ${template.borderColor} transition-all cursor-pointer group`}
                    onClick={() => handleUseTemplate(template.id)}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-background/50">
                        <IconComp className="h-4 w-4 text-zinc-500" />
                      </div>
                      <h4 className="text-sm font-semibold group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                        {template.name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                    {template.stepCount > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {template.steps.map((step, si) => (
                          <div key={si} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <ArrowRight className="h-2.5 w-2.5 text-zinc-500/60" />
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {template.stepCount || '—'} steps
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {template.estimatedTime}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant={selectedTemplate === template.id ? 'default' : 'outline'}
                        className={`text-[10px] h-6 px-2 ${
                          selectedTemplate === template.id
                            ? 'bg-gradient-to-r from-zinc-600 to-zinc-600 text-white'
                            : 'hover:border-zinc-500/50 hover:text-zinc-600 dark:hover:text-zinc-400'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUseTemplate(template.id)
                        }}
                      >
                        {selectedTemplate === template.id ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Added
                          </>
                        ) : (
                          'Use Template'
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 7. Execution History ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="glass">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                Execution History
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-[10px] h-7">
                  <Filter className="h-3 w-3 mr-1" />
                  Filter
                </Button>
                <Badge variant="outline" className="text-[10px]">
                  {executions.length} recent
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Workflow</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Trigger</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Duration</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Timestamp</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((exec, i) => {
                      const statusConfig = executionStatusConfig[exec.status]
                      const StatusIcon = statusConfig.icon
                      return (
                        <motion.tr
                          key={exec.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.05 }}
                          className="border-b border-border/20 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-3.5 w-3.5 text-zinc-500/60 shrink-0 hidden sm:block" />
                              <span className="font-medium text-[12px] truncate max-w-[180px]">{exec.workflowName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[12px] text-muted-foreground hidden sm:table-cell">{exec.trigger}</td>
                          <td className="py-3 px-3">
                            <Badge className={`${statusConfig.bg} ${statusConfig.text} text-[10px] border border-transparent flex items-center gap-1 w-fit`}>
                              <StatusIcon className={`h-3 w-3 ${exec.status === 'running' ? 'animate-spin' : ''}`} />
                              {exec.status.charAt(0).toUpperCase() + exec.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-[12px] text-muted-foreground font-mono hidden md:table-cell">{exec.duration}</td>
                          <td className="py-3 px-3 text-[12px] text-muted-foreground hidden lg:table-cell">{exec.timestamp}</td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] h-6 px-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                            >
                              View
                              <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
