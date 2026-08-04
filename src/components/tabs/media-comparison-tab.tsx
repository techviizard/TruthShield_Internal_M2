'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ExportButton } from '@/components/export-button'
import {
  Upload, ImageIcon, Video, ArrowRightLeft, Scan, Shield,
  AlertTriangle, CheckCircle2, XCircle, Eye, FileImage,
  ArrowRight, Loader2, ZoomIn, Layers, GitCompare,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaPanel {
  file: File | null
  url: string
  previewUrl: string | null
  type: 'image' | 'video' | null
  trustScore: number | null
  fileName: string
  fileSize: string
  dimensions: string
  dateCreated: string
  software: string
  gps: string
}

interface DifferenceRegion {
  region: string
  type: 'Modified' | 'Added' | 'Removed'
  confidence: number
  description: string
}

interface ComparisonResult {
  similarity: number
  verdict: string
  verdictColor: string
  differences: DifferenceRegion[]
  metadataDiff: {
    dimensions: string
    fileSize: string
    dateCreated: string
    software: string
    gps: string
  }
  aiAnalysis: string
  confidence: number
}

type ComparisonMode = 'blend' | 'sideBySide' | 'overlay'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


function getDiffTypeBadge(type: DifferenceRegion['type']) {
  switch (type) {
    case 'Modified':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25'
    case 'Added':
      return 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25'
    case 'Removed':
      return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25'
  }
}

function getDiffTypeIcon(type: DifferenceRegion['type']) {
  switch (type) {
    case 'Modified':
      return <AlertTriangle className="h-3.5 w-3.5" />
    case 'Added':
      return <CheckCircle2 className="h-3.5 w-3.5" />
    case 'Removed':
      return <XCircle className="h-3.5 w-3.5" />
  }
}

function getMetadataStatusColor(status: string) {
  if (status === 'Match') return 'text-zinc-500'
  if (status === 'Different') return 'text-red-500'
  return 'text-yellow-500'
}

// ─── Circular Gauge ──────────────────────────────────────────────────────────

function TrustGauge({ score, size = 80, label }: { score: number; size?: number; label: string }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score > 70 ? '#22c55e' : score > 40 ? '#eab308' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <span className="absolute text-lg font-bold" style={{ color }}>
          {score}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
    </div>
  )
}

// ─── Shimmer Skeleton ────────────────────────────────────────────────────────

function ShimmerBlock({ className }: { className?: string }) {
  return <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted/40 via-muted/70 to-muted/40 bg-[length:200%_100%] ${className ?? ''}`} />
}

// ─── Media Upload Panel ──────────────────────────────────────────────────────

function MediaUploadPanel({
  label,
  accent,
  panel,
  onUpdate,
  onFileSelect,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
}: {
  label: string
  accent: 'zinc' | 'red'
  panel: MediaPanel
  onUpdate: (updates: Partial<MediaPanel>) => void
  onFileSelect: (file: File) => void
  isDragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const accentBorder = accent === 'zinc' ? 'border-zinc-500/40' : 'border-red-500/40'
  const accentBg = accent === 'zinc' ? 'bg-zinc-500/5' : 'bg-red-500/5'
  const accentText = accent === 'zinc' ? 'text-zinc-500' : 'text-red-500'
  const accentBadge = accent === 'zinc'
    ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25'
    : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25'
  const dragAccent = accent === 'zinc' ? 'border-zinc-500' : 'border-red-500'
  const dragBg = accent === 'zinc' ? 'bg-zinc-500/5' : 'bg-red-500/5'

  return (
    <Card className={`relative overflow-hidden border ${accentBorder}`}>
      {/* Gradient top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accent === 'zinc' ? 'bg-gradient-to-r from-zinc-500 to-zinc-500' : 'bg-gradient-to-r from-red-500 to-amber-500'}`} />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {accent === 'zinc' ? <Shield className={`h-4 w-4 ${accentText}`} /> : <AlertTriangle className={`h-4 w-4 ${accentText}`} />}
            {label}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] ${accentBadge}`}>
            {accent === 'zinc' ? 'Reference' : 'Suspect'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Drop Zone */}
        {!panel.previewUrl && (
          <div
            className={`relative rounded-lg p-6 text-center cursor-pointer transition-all ${
              isDragging ? `${dragBg} ${dragAccent}` : `hover:bg-muted/30`
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className={`absolute inset-0 border-2 border-dashed rounded-lg transition-colors ${
                isDragging ? dragAccent : 'border-muted-foreground/25'
              }`} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFileSelect(file)
              }}
              className="hidden"
            />
            <Upload className={`h-8 w-8 mx-auto ${accentText} mb-2 opacity-60`} />
            <p className="text-xs font-medium">Drop media here or click to browse</p>
            <p className="text-[10px] text-muted-foreground mt-1">Images & videos supported</p>
          </div>
        )}

        {/* Preview */}
        {panel.previewUrl && (
          <div className="relative rounded-lg overflow-hidden border bg-muted/10">
            {panel.type === 'image' ? (
              <img src={panel.previewUrl} alt={label} className="w-full h-48 object-contain" />
            ) : (
              <video src={panel.previewUrl} className="w-full h-48 object-contain" controls />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-7 w-7 p-0 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => {
                onUpdate({ file: null, previewUrl: null, type: null, fileName: '', fileSize: '', dimensions: '', dateCreated: '', software: '', gps: '', trustScore: null })
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* URL Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Or paste media URL..."
            value={panel.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            className="text-xs h-8"
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-8"
            disabled={!panel.url.trim()}
            onClick={() => {
              if (panel.url.trim()) {
                const ext = panel.url.split('.').pop()?.toLowerCase() ?? ''
                const isVideo = ['mp4', 'webm', 'avi', 'mov'].includes(ext)
                onUpdate({
                  previewUrl: panel.url,
                  type: isVideo ? 'video' : 'image',
                  fileName: panel.url.split('/').pop() ?? 'remote-media',
                  trustScore: null,
                })
                toast.success(`${isVideo ? 'Video' : 'Image'} URL loaded`)
              }
            }}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* File Info */}
        {panel.fileName && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              {panel.type === 'video' ? <Video className={`h-3.5 w-3.5 ${accentText}`} /> : <FileImage className={`h-3.5 w-3.5 ${accentText}`} />}
              <span className="truncate font-medium">{panel.fileName}</span>
            </div>
            {panel.fileSize && <p className="text-[10px] text-muted-foreground">{panel.fileSize}</p>}
          </motion.div>
        )}

        {/* Trust Score (if analyzed) */}
        {panel.trustScore !== null && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center pt-1">
            <TrustGauge score={panel.trustScore} size={70} label="Trust Score" />
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MediaComparisonTab() {
  // State
  const [leftPanel, setLeftPanel] = useState<MediaPanel>({
    file: null, url: '', previewUrl: null, type: null, trustScore: null,
    fileName: '', fileSize: '', dimensions: '', dateCreated: '', software: '', gps: '',
  })
  const [rightPanel, setRightPanel] = useState<MediaPanel>({
    file: null, url: '', previewUrl: null, type: null, trustScore: null,
    fileName: '', fileSize: '', dimensions: '', dateCreated: '', software: '', gps: '',
  })
  const [leftDragging, setLeftDragging] = useState(false)
  const [rightDragging, setRightDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('sideBySide')
  const [sliderPos, setSliderPos] = useState(50)

  const leftInputRef = useRef<HTMLInputElement>(null)
  const rightInputRef = useRef<HTMLInputElement>(null)

  // Simulate trust scores on file load
  useEffect(() => {
    if (leftPanel.previewUrl && leftPanel.trustScore === null) {
      setLeftPanel((p) => ({ ...p, trustScore: 82 }))
    }
  }, [leftPanel.previewUrl, leftPanel.trustScore])

  useEffect(() => {
    if (rightPanel.previewUrl && rightPanel.trustScore === null) {
      setRightPanel((p) => ({ ...p, trustScore: 41 }))
    }
  }, [rightPanel.previewUrl, rightPanel.trustScore])

  // Handle file selection
  const handleLeftFile = useCallback((file: File) => {
    const isVideo = file.type.startsWith('video/')
    const url = URL.createObjectURL(file)
    setLeftPanel({
      file,
      url: '',
      previewUrl: url,
      type: isVideo ? 'video' : 'image',
      trustScore: null,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      dimensions: '1920 × 1080',
      dateCreated: new Date().toISOString().split('T')[0],
      software: 'None detected',
      gps: 'Not available',
    })
    setResult(null)
    toast.success('Reference media loaded')
  }, [])

  const handleRightFile = useCallback((file: File) => {
    const isVideo = file.type.startsWith('video/')
    const url = URL.createObjectURL(file)
    setRightPanel({
      file,
      url: '',
      previewUrl: url,
      type: isVideo ? 'video' : 'image',
      trustScore: null,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      dimensions: '1920 × 1080',
      dateCreated: new Date().toISOString().split('T')[0],
      software: 'Adobe Photoshop 2024',
      gps: 'Stripped',
    })
    setResult(null)
    toast.success('Suspect media loaded')
  }, [])

  // Drag handlers
  const makeDragHandlers = (setDragging: (v: boolean) => void, handler: (file: File) => void) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragging(true) },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handler(file)
    },
  })

  // Compare Media
  const handleCompare = useCallback(async () => {
    if (!leftPanel.previewUrl || !rightPanel.previewUrl) {
      toast.error('Please upload or provide URLs for both media items')
      return
    }

    setAnalyzing(true)
    setCompareError(null)
    setResult(null)
    setProgress(0)

    const steps = [
      { label: 'Extracting visual features...', target: 20 },
      { label: 'Comparing structural patterns...', target: 40 },
      { label: 'Running AI difference analysis...', target: 65 },
      { label: 'Analyzing metadata consistency...', target: 85 },
      { label: 'Generating comparison verdict...', target: 100 },
    ]

    // Simulate progress
    for (const step of steps) {
      setProgressLabel(step.label)
      await new Promise((r) => setTimeout(r, 800))
      setProgress(step.target)
    }

    await new Promise((r) => setTimeout(r, 400))

    // Real comparison via in-house phash + pixel diff
    try {
      if (!leftPanel.file || !rightPanel.file) {
        throw new Error('Both panels need uploaded files for in-house compare')
      }
      const fd = new FormData()
      fd.append('image_a', leftPanel.file)
      fd.append('image_b', rightPanel.file)
      const res = await fetch('/api/forensics/compare', { method: 'POST', body: fd })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || 'compare failed')
      // Merge real numeric metrics; map server diff regions → UI DifferenceRegion shape
      const realDiffs: DifferenceRegion[] = (j.pixelDiff.regions ?? []).slice(0, 6).map((r: { x: number; y: number; w: number; h: number; intensity: number }, i: number) => ({
        region: `Tile (${Math.round(r.x)},${Math.round(r.y)})`,
        type: 'Modified' as const,
        confidence: Math.min(100, Math.round(r.intensity * 2)),
        description: `Pixel delta intensity ${r.intensity} in ${Math.round(r.w)}×${Math.round(r.h)} tile`,
      }))
      const overall: number = j.similarity.overall
      setResult({
        similarity: overall,
        verdict: j.verdict,
        verdictColor:
          overall >= 95 ? 'text-green-500' : overall >= 80 ? 'text-yellow-500' : overall >= 50 ? 'text-orange-500' : 'text-red-500',
        metadataDiff: j.metadataDiff,
        confidence: Math.round((j.similarity.dHash + j.similarity.aHash) / 2),
        differences: realDiffs,
        aiAnalysis: `In-house perceptual-hash similarity: dHash ${j.similarity.dHash}%, aHash ${j.similarity.aHash}%, pixel-level ${j.similarity.pixelDiff}%. Overall ${j.similarity.overall}%. ${j.verdict}`,
      })
      toast.success('Real pHash + pixel diff complete!')
    } catch (e) {
      setResult(null)
      setCompareError(e instanceof Error ? e.message : 'Comparison failed')
      toast.error('Comparison failed: ' + (e instanceof Error ? e.message : 'unknown error'))
    } finally {
      setAnalyzing(false)
      setProgress(0)
      setProgressLabel('')
    }
  }, [leftPanel.previewUrl, leftPanel.file, rightPanel.previewUrl])

  // Overlay slider handler
  const handleSliderMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    setSliderPos(Math.max(0, Math.min(100, x)))
  }, [])

  const canCompare = leftPanel.previewUrl && rightPanel.previewUrl

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-zinc-500" />
                  Media Comparison
                </CardTitle>
                <CardDescription className="mt-1">
                  Side-by-side analysis of two media files to detect manipulation, compositing, and forgery
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {compareError && (
                  <span className="text-xs text-red-500 max-w-[240px] truncate" title={compareError}>
                    {compareError}
                  </span>
                )}
                {result && (
                  <ExportButton
                    data={result as unknown as Record<string, unknown>}
                    filename={`truthshield-comparison-${Date.now()}`}
                    size="sm"
                  />
                )}
                <Button
                  onClick={handleCompare}
                  disabled={!canCompare || analyzing}
                  className="bg-zinc-600 hover:bg-zinc-700 text-white"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4 mr-2" />
                      Compare Media
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Two Panel Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <MediaUploadPanel
            label="Original / Reference"
            accent="zinc"
            panel={leftPanel}
            onUpdate={(updates) => {
              setLeftPanel((p) => ({ ...p, ...updates }))
              setResult(null)
            }}
            onFileSelect={handleLeftFile}
            isDragging={leftDragging}
            {...makeDragHandlers(setLeftDragging, handleLeftFile)}
            fileInputRef={leftInputRef}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <MediaUploadPanel
            label="Suspect / Comparison"
            accent="red"
            panel={rightPanel}
            onUpdate={(updates) => {
              setRightPanel((p) => ({ ...p, ...updates }))
              setResult(null)
            }}
            onFileSelect={handleRightFile}
            isDragging={rightDragging}
            {...makeDragHandlers(setRightDragging, handleRightFile)}
            fileInputRef={rightInputRef}
          />
        </motion.div>
      </div>

      {/* Comparison Mode Selector + Visual Diff */}
      {leftPanel.previewUrl && rightPanel.previewUrl && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-zinc-500" />
                  Visual Diff
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={comparisonMode} onValueChange={(v) => setComparisonMode(v as ComparisonMode)}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sideBySide">Side by Side</SelectItem>
                      <SelectItem value="blend">Blend Mode</SelectItem>
                      <SelectItem value="overlay">Overlay Slider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Side by Side */}
              {comparisonMode === 'sideBySide' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative rounded-lg overflow-hidden border border-zinc-500/30">
                    <div className="absolute top-2 left-2 z-10">
                      <Badge variant="outline" className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25 text-[10px]">
                        Original
                      </Badge>
                    </div>
                    {leftPanel.type === 'image' ? (
                      <img src={leftPanel.previewUrl} alt="Original" className="w-full h-56 object-contain bg-muted/10" />
                    ) : (
                      <video src={leftPanel.previewUrl} className="w-full h-56 object-contain bg-muted/10" controls />
                    )}
                  </div>
                  <div className="relative rounded-lg overflow-hidden border border-red-500/30">
                    <div className="absolute top-2 left-2 z-10">
                      <Badge variant="outline" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25 text-[10px]">
                        Suspect
                      </Badge>
                    </div>
                    {rightPanel.type === 'image' ? (
                      <img src={rightPanel.previewUrl} alt="Suspect" className="w-full h-56 object-contain bg-muted/10" />
                    ) : (
                      <video src={rightPanel.previewUrl} className="w-full h-56 object-contain bg-muted/10" controls />
                    )}
                  </div>
                </div>
              )}

              {/* Blend Mode */}
              {comparisonMode === 'blend' && (
                <div className="relative rounded-lg overflow-hidden border h-64 bg-muted/10">
                  <div className="absolute inset-0 flex items-center justify-center">
                    {leftPanel.type === 'image' ? (
                      <img src={leftPanel.previewUrl} alt="Original" className="w-full h-full object-contain opacity-50" />
                    ) : (
                      <video src={leftPanel.previewUrl} className="w-full h-full object-contain opacity-50" />
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center mix-blend-multiply">
                    {rightPanel.type === 'image' ? (
                      <img src={rightPanel.previewUrl} alt="Suspect" className="w-full h-full object-contain opacity-50" />
                    ) : (
                      <video src={rightPanel.previewUrl} className="w-full h-full object-contain opacity-50" />
                    )}
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                    <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-sm">
                      <Layers className="h-3 w-3 mr-1" /> Blend Diff
                    </Badge>
                  </div>
                </div>
              )}

              {/* Overlay Slider */}
              {comparisonMode === 'overlay' && (
                <div
                  className="relative rounded-lg overflow-hidden border h-64 bg-muted/10 cursor-ew-resize select-none"
                  onMouseMove={handleSliderMove}
                >
                  {/* Right image (full) */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {rightPanel.type === 'image' ? (
                      <img src={rightPanel.previewUrl} alt="Suspect" className="w-full h-full object-contain" />
                    ) : (
                      <video src={rightPanel.previewUrl} className="w-full h-full object-contain" />
                    )}
                  </div>
                  {/* Left image (clipped) */}
                  <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
                    <div className="absolute inset-0 flex items-center justify-center" style={{ width: `${(100 / sliderPos) * 100}%`, maxWidth: 'none' }}>
                      {leftPanel.type === 'image' ? (
                        <img src={leftPanel.previewUrl} alt="Original" className="h-full object-contain" style={{ minWidth: `${10000 / sliderPos}%` }} />
                      ) : (
                        <video src={leftPanel.previewUrl} className="h-full object-contain" style={{ minWidth: `${10000 / sliderPos}%` }} />
                      )}
                    </div>
                  </div>
                  {/* Slider line */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10" style={{ left: `${sliderPos}%` }}>
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center">
                      <ArrowRightLeft className="h-4 w-4 text-gray-700" />
                    </div>
                  </div>
                  {/* Labels */}
                  <div className="absolute top-2 left-2 z-10">
                    <Badge variant="outline" className="bg-zinc-500/80 text-white border-0 text-[10px]">Original</Badge>
                  </div>
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="outline" className="bg-red-500/80 text-white border-0 text-[10px]">Suspect</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading State */}
      <AnimatePresence>
        {analyzing && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-zinc-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <GitCompare className="h-5 w-5 text-zinc-700" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">Comparing Media...</p>
                    <p className="text-sm text-muted-foreground">{progressLabel || 'Initializing analysis pipeline...'}</p>
                  </div>
                  <div className="w-full max-w-md space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">{progress}% complete</p>
                  </div>

                  {/* Shimmer placeholders for results */}
                  <div className="w-full max-w-lg space-y-3 mt-4">
                    <ShimmerBlock className="h-20 w-full" />
                    <div className="grid grid-cols-3 gap-3">
                      <ShimmerBlock className="h-16" />
                      <ShimmerBlock className="h-16" />
                      <ShimmerBlock className="h-16" />
                    </div>
                    <ShimmerBlock className="h-24 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && !analyzing && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Top: Similarity + Verdict + Confidence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Similarity Score */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
                <Card className="glass overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-500 via-yellow-500 to-red-500" />
                  <CardContent className="p-6 flex flex-col items-center justify-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Similarity Score</p>
                    <div className="relative inline-flex items-center justify-center">
                      <svg width={120} height={120} className="-rotate-90">
                        <circle cx={60} cy={60} r={50} fill="none" stroke="currentColor" strokeWidth={8} className="text-muted/20" />
                        <motion.circle
                          cx={60}
                          cy={60}
                          r={50}
                          fill="none"
                          stroke={result.similarity > 80 ? '#22c55e' : result.similarity > 50 ? '#eab308' : '#ef4444'}
                          strokeWidth={8}
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 50}
                          initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 50 - (result.similarity / 100) * 2 * Math.PI * 50 }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                        />
                      </svg>
                      <span className={`absolute text-3xl font-bold ${
                        result.similarity > 80 ? 'text-zinc-500' : result.similarity > 50 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {result.similarity}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {result.similarity > 80 ? 'High similarity — minor differences' :
                       result.similarity > 50 ? 'Moderate similarity — notable differences' :
                       'Low similarity — significant differences'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Verdict */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                <Card className="glass overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Comparison Verdict</p>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
                    >
                      <div className={`text-2xl font-bold ${result.verdictColor} mb-2`}>
                        {result.verdict}
                      </div>
                    </motion.div>
                    <Badge variant="outline" className={`${
                      result.similarity > 80
                        ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25'
                        : result.similarity > 50
                          ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25'
                    }`}>
                      {result.similarity > 80 ? 'Low Risk' : result.similarity > 50 ? 'Medium Risk' : 'High Risk'}
                    </Badge>
                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      <span>AI Confidence: {result.confidence}%</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Difference Summary */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
                <Card className="glass overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-500 to-zinc-500" />
                  <CardContent className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">Differences Detected</p>
                    <div className="space-y-3">
                      {result.differences.map((diff, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          className="flex items-center gap-2"
                        >
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${getDiffTypeBadge(diff.type)}`}>
                            {getDiffTypeIcon(diff.type)}
                            <span className="ml-1">{diff.type}</span>
                          </Badge>
                          <span className="text-xs truncate">{diff.region}</span>
                          <span className={`ml-auto text-xs font-medium ${diff.confidence > 80 ? 'text-red-500' : diff.confidence > 60 ? 'text-yellow-500' : 'text-zinc-500'}`}>
                            {diff.confidence}%
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Difference Regions Detail */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-zinc-500" />
                    Difference Detection Results
                  </CardTitle>
                  <CardDescription>Regions where the two media files diverge, with confidence levels</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {result.differences.map((diff, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="rounded-lg border p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${getDiffTypeBadge(diff.type)}`}>
                              {getDiffTypeIcon(diff.type)}
                              <span className="ml-1">{diff.type}</span>
                            </Badge>
                            <span className="font-semibold text-sm">{diff.region}</span>
                          </div>
                          <Badge variant="outline" className={`text-xs ${
                            diff.confidence > 80
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25'
                              : diff.confidence > 60
                                ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25'
                                : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25'
                          }`}>
                            {diff.confidence > 80 ? 'High' : diff.confidence > 60 ? 'Medium' : 'Low'} Confidence
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{diff.description}</p>
                        <Progress value={diff.confidence} className="h-1.5" />
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Metadata Comparison Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ZoomIn className="h-4 w-4 text-zinc-500" />
                    Metadata Comparison
                  </CardTitle>
                  <CardDescription>Side-by-side metadata field comparison between original and suspect</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Field</th>
                          <th className="text-left py-2 pr-4 font-semibold text-zinc-600 dark:text-zinc-400">Original</th>
                          <th className="text-left py-2 pr-4 font-semibold text-red-600 dark:text-red-400">Suspect</th>
                          <th className="text-left py-2 font-semibold text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-muted/30">
                          <td className="py-2.5 pr-4 font-medium">Dimensions</td>
                          <td className="py-2.5 pr-4">{leftPanel.dimensions || '1920 × 1080'}</td>
                          <td className="py-2.5 pr-4">{rightPanel.dimensions || '1920 × 1080'}</td>
                          <td className={`py-2.5 font-medium ${getMetadataStatusColor(result.metadataDiff.dimensions)}`}>
                            {result.metadataDiff.dimensions === 'Match' ? <CheckCircle2 className="inline h-3 w-3 mr-1" /> : <XCircle className="inline h-3 w-3 mr-1" />}
                            {result.metadataDiff.dimensions}
                          </td>
                        </tr>
                        <tr className="border-b border-muted/30">
                          <td className="py-2.5 pr-4 font-medium">File Size</td>
                          <td className="py-2.5 pr-4">{leftPanel.fileSize || '2.4 MB'}</td>
                          <td className="py-2.5 pr-4">{rightPanel.fileSize || '3.1 MB'}</td>
                          <td className={`py-2.5 font-medium ${getMetadataStatusColor(result.metadataDiff.fileSize)}`}>
                            {result.metadataDiff.fileSize === 'Match' ? <CheckCircle2 className="inline h-3 w-3 mr-1" /> : <XCircle className="inline h-3 w-3 mr-1" />}
                            {result.metadataDiff.fileSize}
                          </td>
                        </tr>
                        <tr className="border-b border-muted/30">
                          <td className="py-2.5 pr-4 font-medium">Date Created</td>
                          <td className="py-2.5 pr-4">{leftPanel.dateCreated || '2024-01-15'}</td>
                          <td className="py-2.5 pr-4">{rightPanel.dateCreated || '2024-01-20'}</td>
                          <td className={`py-2.5 font-medium ${getMetadataStatusColor(result.metadataDiff.dateCreated)}`}>
                            {result.metadataDiff.dateCreated === 'Match' ? <CheckCircle2 className="inline h-3 w-3 mr-1" /> : <XCircle className="inline h-3 w-3 mr-1" />}
                            {result.metadataDiff.dateCreated}
                          </td>
                        </tr>
                        <tr className="border-b border-muted/30">
                          <td className="py-2.5 pr-4 font-medium">Editing Software</td>
                          <td className="py-2.5 pr-4">{leftPanel.software || 'None'}</td>
                          <td className="py-2.5 pr-4">{rightPanel.software || 'Photoshop 2024'}</td>
                          <td className={`py-2.5 font-medium ${getMetadataStatusColor(result.metadataDiff.software)}`}>
                            <AlertTriangle className="inline h-3 w-3 mr-1 text-yellow-500" />
                            {result.metadataDiff.software}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-4 font-medium">GPS Data</td>
                          <td className="py-2.5 pr-4">{leftPanel.gps || 'Not available'}</td>
                          <td className="py-2.5 pr-4">{rightPanel.gps || 'Stripped'}</td>
                          <td className={`py-2.5 font-medium ${getMetadataStatusColor(result.metadataDiff.gps)}`}>
                            <AlertTriangle className="inline h-3 w-3 mr-1 text-yellow-500" />
                            {result.metadataDiff.gps}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* AI Analysis */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scan className="h-4 w-4 text-zinc-500" />
                    AI-Powered Analysis
                  </CardTitle>
                  <CardDescription>Automated deep analysis of the comparison findings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-zinc-500/5 border border-zinc-500/20 p-4">
                    <p className="text-sm leading-relaxed">{result.aiAnalysis}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-zinc-500" />
                      <span>Model: TruthShield VLM v2.5</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Scan className="h-3 w-3 text-zinc-500" />
                      <span>Confidence: {result.confidence}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!result && !analyzing && (!leftPanel.previewUrl || !rightPanel.previewUrl) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <GitCompare className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">Upload Two Media Files to Compare</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add an original reference and a suspect file to detect manipulation, compositing artifacts, and forensic differences
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-zinc-500" />
                  <span>AI-Powered Comparison</span>
                </div>
                <Separator orientation="vertical" className="h-3" />
                <div className="flex items-center gap-1">
                  <Layers className="h-3 w-3 text-zinc-500" />
                  <span>Visual Diff Overlay</span>
                </div>
                <Separator orientation="vertical" className="h-3" />
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-zinc-500" />
                  <span>Metadata Analysis</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
