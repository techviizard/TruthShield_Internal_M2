'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileImage, Video, X, CheckCircle2, AlertTriangle, Loader2, Play, Trash2, Shield, BarChart3, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAppConfig } from '@/hooks/use-app-config'

type BatchFileStatus = 'pending' | 'analyzing' | 'complete' | 'failed'

interface BatchFile {
  id: string
  file: File
  name: string
  type: 'image' | 'video'
  size: number
  status: BatchFileStatus
  progress: number
  result?: { trustScore: number; riskLevel: string; flags: string[] }
  error?: string
}

interface BatchResultsSummary {
  totalProcessed: number
  averageTrustScore: number
  riskDistribution: { level: string; count: number; color: string }[]
}

const MAX_FILES = 10
const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

const statusConfig: Record<BatchFileStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500/15 border-yellow-500/25' },
  analyzing: { label: 'Analyzing', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/15 border-blue-500/25' },
  complete: { label: 'Complete', color: 'text-zinc-600 dark:text-zinc-400', bgColor: 'bg-zinc-500/15 border-zinc-500/25' },
  failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/15 border-red-500/25' },
}

const riskColorMap: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25',
  low: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BatchAnalysis() {
  const cfg = useAppConfig()
  const [files, setFiles] = useState<BatchFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [resultsSummary, setResultsSummary] = useState<BatchResultsSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  const completedCount = files.filter(f => f.status === 'complete' || f.status === 'failed').length
  const totalFiles = files.length
  const batchProgress = totalFiles > 0 ? Math.round((completedCount / totalFiles) * 100) : 0

  const validateAndAddFiles = useCallback((incomingFiles: FileList | File[]) => {
    const fileArray = Array.from(incomingFiles)

    // Check total count
    if (files.length + fileArray.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files per batch. You already have ${files.length} file(s).`)
      return
    }

    const newBatchFiles: BatchFile[] = []

    for (const file of fileArray) {
      // Validate MIME type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error(`"${file.name}" is not a supported file type. Only images and videos are accepted.`)
        continue
      }

      // Validate file size
      if (file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE) {
        toast.error(`"${file.name}" exceeds the 20MB limit for images.`)
        continue
      }
      if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) {
        toast.error(`"${file.name}" exceeds the 100MB limit for videos.`)
        continue
      }

      // Check for duplicates by name+size
      if (files.some(f => f.name === file.name && f.size === file.size)) {
        toast.error(`"${file.name}" is already in the queue.`)
        continue
      }

      newBatchFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size,
        status: 'pending',
        progress: 0,
      })
    }

    if (newBatchFiles.length > 0) {
      setFiles(prev => [...prev, ...newBatchFiles])
      toast.success(`${newBatchFiles.length} file(s) added to batch queue.`)
    }
  }, [files])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files)
    }
  }, [validateAndAddFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files)
      e.target.value = ''
    }
  }, [validateAndAddFiles])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    if (isProcessing) {
      abortRef.current = true
    }
    setFiles([])
    setShowSummary(false)
    setResultsSummary(null)
    setIsProcessing(false)
  }, [isProcessing])

  const updateFile = useCallback((id: string, updates: Partial<BatchFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  const analyzeAll = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'failed')
    if (pendingFiles.length === 0) {
      toast.info('No files to analyze. Add some files to the queue.')
      return
    }

    setIsProcessing(true)
    setShowSummary(false)
    setResultsSummary(null)
    abortRef.current = false

    // Process files sequentially
    for (const batchFile of pendingFiles) {
      if (abortRef.current) break

      updateFile(batchFile.id, { status: 'analyzing', progress: 10 })

      try {
        const formData = new FormData()
        const endpoint = batchFile.type === 'image' ? '/api/analyze/image' : '/api/analyze/video'
        const fieldName = batchFile.type === 'image' ? 'image' : 'video'
        formData.append(fieldName, batchFile.file)

        // Simulate progress updates
        updateFile(batchFile.id, { progress: 30 })

        const res = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        })

        updateFile(batchFile.id, { progress: 80 })

        if (res.ok) {
          const data = await res.json()
          const analysis = data.analysis || data

          updateFile(batchFile.id, {
            status: 'complete',
            progress: 100,
            result: {
              trustScore: typeof analysis.trustScore === 'number' ? analysis.trustScore : 50,
              riskLevel: analysis.riskLevel || 'medium',
              flags: Array.isArray(analysis.flags) ? analysis.flags : [],
            },
          })
          toast.success(`Analysis complete: ${batchFile.name}`)
        } else {
          const errorData = await res.json().catch(() => ({}))
          updateFile(batchFile.id, {
            status: 'failed',
            progress: 0,
            error: errorData.error || `Analysis failed (HTTP ${res.status})`,
          })
          toast.error(`Failed: ${batchFile.name}`)
        }
      } catch (err) {
        updateFile(batchFile.id, {
          status: 'failed',
          progress: 0,
          error: err instanceof Error ? err.message : 'Network error',
        })
        toast.error(`Error analyzing ${batchFile.name}`)
      }
    }

    setIsProcessing(false)

    // Compute summary
    setFiles(prev => {
      const completed = prev.filter(f => f.status === 'complete' && f.result)
      if (completed.length > 0) {
        const avgTrust = Math.round(
          completed.reduce((sum, f) => sum + (f.result?.trustScore ?? 0), 0) / completed.length
        )
        const distribution: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
        completed.forEach(f => {
          const level = f.result?.riskLevel || 'medium'
          if (distribution[level] !== undefined) distribution[level]++
        })
        setResultsSummary({
          totalProcessed: completed.length,
          averageTrustScore: avgTrust,
          riskDistribution: [
            { level: 'Critical', count: distribution.critical, color: '#ef4444' },
            { level: 'High', count: distribution.high, color: '#f97316' },
            { level: 'Medium', count: distribution.medium, color: '#eab308' },
            { level: 'Low', count: distribution.low, color: '#22c55e' },
          ],
        })
        setShowSummary(true)
      }
      return prev
    })
  }, [files, updateFile])

  return (
    <div className="space-y-6">
      {/* Main Card - Upload Zone & File Queue */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-zinc-500" />
              Batch Analysis
            </CardTitle>
            <CardDescription>
              Upload multiple images and videos for simultaneous AI-powered verification. Process up to {MAX_FILES} files per batch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag & Drop Zone */}
            <div
              className={`relative rounded-xl p-8 text-center transition-all cursor-pointer overflow-hidden ${
                isDragging
                  ? 'bg-zinc-500/10'
                  : 'hover:bg-muted/30'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
              {/* Animated dashed border */}
              <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute inset-0 border-2 border-dashed rounded-xl transition-colors duration-300 ${
                  isDragging ? 'border-zinc-500' : 'border-muted-foreground/25 hover:border-zinc-500/50'
                }`} />
                <div className="absolute bottom-0 left-0 right-0 h-0.5 animate-border-dash" />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileInput}
                className="hidden"
                disabled={isProcessing}
              />

              <motion.div
                animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  {isDragging ? 'Drop files here...' : 'Drag & drop files here, or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports images (JPG, PNG, WebP — max {cfg?.limits.maxImageUploadMB ?? 20}MB) and videos (MP4, AVI, MOV — max {cfg?.limits.maxVideoUploadMB ?? 100}MB)
                </p>
              </motion.div>
            </div>

            {/* Batch Progress */}
            {totalFiles > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {completedCount} of {totalFiles} files processed
                  </span>
                  <span className="font-medium text-zinc-600 dark:text-zinc-400">
                    {batchProgress}%
                  </span>
                </div>
                <Progress value={batchProgress} className="h-2" />
              </motion.div>
            )}

            {/* Batch Controls */}
            {totalFiles > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex flex-wrap items-center gap-3"
              >
                <Button
                  onClick={analyzeAll}
                  disabled={isProcessing || files.every(f => f.status === 'complete')}
                  className="bg-zinc-600 hover:bg-zinc-700 text-white gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Analyze All
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearAll}
                  disabled={isProcessing && files.length === 0}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </Button>
                <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1">
                    <FileImage className="h-3 w-3" />
                    {files.filter(f => f.type === 'image').length} images
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Video className="h-3 w-3" />
                    {files.filter(f => f.type === 'video').length} videos
                  </Badge>
                </div>
              </motion.div>
            )}

            {/* File Queue */}
            {totalFiles > 0 && (
              <ScrollArea className="max-h-96">
                <div className="space-y-2 pr-2">
                  <AnimatePresence mode="popLayout">
                    {files.map((batchFile) => (
                      <motion.div
                        key={batchFile.id}
                        layout
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-muted/20 transition-colors"
                      >
                        {/* File Type Icon */}
                        <div className={`shrink-0 p-2 rounded-lg ${
                          batchFile.type === 'image'
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {batchFile.type === 'image' ? (
                            <FileImage className="h-4 w-4" />
                          ) : (
                            <Video className="h-4 w-4" />
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{batchFile.name}</p>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] px-1.5 py-0 border ${statusConfig[batchFile.status].bgColor} ${statusConfig[batchFile.status].color}`}
                            >
                              {batchFile.status === 'analyzing' && (
                                <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />
                              )}
                              {statusConfig[batchFile.status].label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">{formatFileSize(batchFile.size)}</p>
                            {batchFile.status === 'analyzing' && (
                              <div className="flex-1 max-w-[120px]">
                                <Progress value={batchFile.progress} className="h-1" />
                              </div>
                            )}
                          </div>

                          {/* Result Preview */}
                          {batchFile.status === 'complete' && batchFile.result && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="flex items-center gap-2 mt-1.5"
                            >
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-zinc-500" />
                                <span className="text-xs font-medium">
                                  Trust: <span className={
                                    batchFile.result.trustScore < 40
                                      ? 'text-red-500'
                                      : batchFile.result.trustScore < 60
                                        ? 'text-yellow-500'
                                        : 'text-zinc-500'
                                  }>
                                    {batchFile.result.trustScore}
                                  </span>
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 border ${riskColorMap[batchFile.result.riskLevel] || riskColorMap.medium}`}
                              >
                                {batchFile.result.riskLevel.charAt(0).toUpperCase() + batchFile.result.riskLevel.slice(1)} Risk
                              </Badge>
                              {batchFile.result.flags.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {batchFile.result.flags.length} flag{batchFile.result.flags.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </motion.div>
                          )}

                          {/* Error Message */}
                          {batchFile.status === 'failed' && batchFile.error && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="flex items-center gap-1.5 mt-1.5"
                            >
                              <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                              <p className="text-xs text-red-500 truncate">{batchFile.error}</p>
                            </motion.div>
                          )}
                        </div>

                        {/* Remove Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500"
                          onClick={() => removeFile(batchFile.id)}
                          disabled={batchFile.status === 'analyzing'}
                          aria-label={`Remove ${batchFile.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Summary Card */}
      <AnimatePresence>
        {showSummary && resultsSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="glass overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-zinc-500" />
                  Batch Results Summary
                </CardTitle>
                <CardDescription>
                  Overview of all analyzed files in this batch
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Top Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Total Processed */}
                  <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card/50">
                    <div className="p-3 rounded-full bg-zinc-500/10 mb-2">
                      <CheckCircle2 className="h-6 w-6 text-zinc-500" />
                    </div>
                    <p className="text-2xl font-bold">{resultsSummary.totalProcessed}</p>
                    <p className="text-xs text-muted-foreground">Files Processed</p>
                  </div>

                  {/* Average Trust Score */}
                  <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card/50">
                    <div className="p-3 rounded-full bg-zinc-500/10 mb-2">
                      <Shield className="h-6 w-6 text-zinc-500" />
                    </div>
                    <p className={`text-2xl font-bold ${
                      resultsSummary.averageTrustScore < 40
                        ? 'text-red-500'
                        : resultsSummary.averageTrustScore < 60
                          ? 'text-yellow-500'
                          : 'text-zinc-500'
                    }`}>
                      {resultsSummary.averageTrustScore}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Trust Score</p>
                  </div>

                  {/* Risk Level */}
                  <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card/50">
                    <div className="p-3 rounded-full bg-zinc-500/10 mb-2">
                      <AlertTriangle className="h-6 w-6 text-zinc-500" />
                    </div>
                    <p className="text-2xl font-bold">
                      {resultsSummary.riskDistribution.find(r =>
                        r.count === Math.max(...resultsSummary.riskDistribution.map(d => d.count))
                      )?.level || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">Most Common Risk</p>
                  </div>
                </div>

                {/* Risk Distribution */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Risk Distribution</h4>
                  <div className="space-y-2">
                    {resultsSummary.riskDistribution.map((risk) => (
                      <div key={risk.level} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: risk.color }}
                        />
                        <span className="text-sm w-16 shrink-0">{risk.level}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: risk.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${resultsSummary.totalProcessed > 0 ? (risk.count / resultsSummary.totalProcessed) * 100 : 0}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{risk.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={clearAll}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Start New Batch
                  </Button>
                  <Button
                    className="bg-zinc-600 hover:bg-zinc-700 text-white gap-2"
                    onClick={() => {
                      // Reset failed files for retry
                      setFiles(prev => prev.map(f =>
                        f.status === 'failed' ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f
                      ))
                      setShowSummary(false)
                      setResultsSummary(null)
                    }}
                    disabled={files.filter(f => f.status === 'failed').length === 0}
                  >
                    <Play className="h-4 w-4" />
                    Retry Failed ({files.filter(f => f.status === 'failed').length})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {totalFiles === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <Upload className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">No Files in Queue</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop or click to add images and videos for batch analysis.
                  You can add up to {MAX_FILES} files at a time.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
