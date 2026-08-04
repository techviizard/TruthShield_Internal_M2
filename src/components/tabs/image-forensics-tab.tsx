'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TrustScoreGauge } from '@/components/trust-score-gauge'
import { useAppConfig } from '@/hooks/use-app-config'
import { useAppStore, type RiskLevel } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Image as ImageIcon, Scan, AlertTriangle, CheckCircle,
  XCircle, FileSearch, Loader2, RotateCcw, Camera, MapPin,
  Monitor, Layers, Shield,
} from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import {
  ElaEvidence, SpectralEvidence, ProvenancePanel, ForensicContribution,
} from '@/components/forensic-panels'

const riskBadgeClass: Record<RiskLevel, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
}

export function ImageForensicsTab() {
  const { imageLoading, imageResult, analyzeImage, resetImageResult } = useAppStore()
  const cfg = useAppConfig()
  const maxImageMB = cfg?.limits.maxImageUploadMB ?? 20
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    analyzeImage(file)
  }, [analyzeImage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleReset = () => {
    resetImageResult()
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-zinc-500" />
              Image Forensics
            </CardTitle>
            <CardDescription>Upload an image to detect AI generation, manipulation, and forensic anomalies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`relative rounded-xl p-8 text-center transition-all cursor-pointer overflow-hidden ${
                isDragging
                  ? 'bg-zinc-500/5'
                  : 'hover:bg-muted/30'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
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
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drag & drop an image here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, WebP (max {maxImageMB}MB)</p>
            </div>

            {previewUrl && (
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="relative w-full sm:w-64 h-48 rounded-lg overflow-hidden border">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  {imageLoading && (
                    <>
                      {/* Scan-line overlay */}
                      <div className="absolute inset-0 bg-zinc-500/5">
                        <div className="absolute left-0 right-0 h-1 bg-zinc-400/60 blur-sm animate-scan-line" />
                        <div className="absolute left-0 right-0 h-0.5 bg-zinc-300/40 animate-scan-line" style={{ animationDelay: '0.5s' }} />
                      </div>
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {imageResult && (
                    <ExportButton
                      data={imageResult as unknown as Record<string, unknown>}
                      filename={`truthshield-image-${Date.now()}`}
                      size="sm"
                    />
                  )}
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear & Upload New
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading State */}
      {imageLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-zinc-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Scan className="h-5 w-5 text-zinc-700" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Analyzing Image...</p>
                  <p className="text-sm text-muted-foreground">Running ELA, noise analysis, and metadata extraction</p>
                </div>
                <div className="w-full max-w-md space-y-2">
                  <Progress value={62} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">Performing forensic analysis...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {imageResult && !imageLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Top Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Trust Score */}
              <Card className="flex flex-col items-center justify-center p-6">
                <TrustScoreGauge score={imageResult.trustScore} size={150} />
                <Badge variant="outline" className={`mt-3 ${imageResult.trustScore < 40 ? riskBadgeClass.high : imageResult.trustScore < 60 ? riskBadgeClass.medium : riskBadgeClass.low}`}>
                  Risk: {imageResult.trustScore < 40 ? 'High' : imageResult.trustScore < 60 ? 'Medium' : 'Low'}
                </Badge>
              </Card>

              {/* AI Generated Likelihood with Confidence Ring */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-500" />
                    AI-Generated Likelihood
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center relative">
                    {/* Confidence Ring */}
                    <div className="relative inline-flex items-center justify-center">
                      <svg width={100} height={100} className="-rotate-90">
                        <circle
                          cx={50}
                          cy={50}
                          r={42}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={6}
                          className="text-muted/30"
                        />
                        <motion.circle
                          cx={50}
                          cy={50}
                          r={42}
                          fill="none"
                          stroke={imageResult.aiGeneratedLikelihood > 60 ? '#ef4444' : imageResult.aiGeneratedLikelihood > 30 ? '#eab308' : '#22c55e'}
                          strokeWidth={6}
                          strokeLinecap="round"
                          strokeDasharray={42 * 2 * Math.PI}
                          initial={{ strokeDashoffset: 42 * 2 * Math.PI }}
                          animate={{ strokeDashoffset: 42 * 2 * Math.PI - (imageResult.aiGeneratedLikelihood / 100) * 42 * 2 * Math.PI }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                        />
                      </svg>
                      <span className={`absolute text-2xl font-bold ${imageResult.aiGeneratedLikelihood > 60 ? 'text-red-500' : imageResult.aiGeneratedLikelihood > 30 ? 'text-yellow-500' : 'text-green-500'}`}>
                        {imageResult.aiGeneratedLikelihood}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={imageResult.aiGeneratedLikelihood}
                    className="h-3"
                  />
                  <p className="text-xs text-muted-foreground">
                    {imageResult.aiGeneratedLikelihood > 60
                      ? 'High probability of AI generation detected'
                      : imageResult.aiGeneratedLikelihood > 30
                        ? 'Moderate AI generation indicators present'
                        : 'Low AI generation likelihood'}
                  </p>
                </CardContent>
              </Card>

              {/* Manipulation Indicators */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Manipulation Indicators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {imageResult.manipulationIndicators.map((ind, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <div className="flex justify-between text-sm mb-1">
                          <span>{ind.type}</span>
                          <span className={`font-medium ${ind.confidence > 70 ? 'text-red-500' : ind.confidence > 40 ? 'text-yellow-500' : 'text-green-500'}`}>
                            {ind.confidence}%
                          </span>
                        </div>
                        <Progress value={ind.confidence} className="h-1.5" />
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pixel-level evidence - measured in-house, independent of the model */}
            {imageResult.forensics && (
              <>
                <ElaEvidence forensics={imageResult.forensics} previewUrl={imageResult.previewUrl} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <ForensicContribution forensics={imageResult.forensics} />
                  <SpectralEvidence forensics={imageResult.forensics} />
                </div>
              </>
            )}
            {imageResult.provenance && <ProvenancePanel provenance={imageResult.provenance} />}

            {/* Metadata Analysis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-blue-500" />
                  Metadata Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {imageResult.metadataAnalysis.map((meta, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-2 p-3 rounded-lg border"
                    >
                      {meta.field === 'Software' ? <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground" /> :
                       meta.field === 'GPS Location' ? <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /> :
                       meta.field === 'Camera Model' ? <Camera className="h-4 w-4 mt-0.5 text-muted-foreground" /> :
                       <ImageIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{meta.field}</p>
                        <p className="text-sm truncate">{meta.value}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {meta.status === 'clean' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="relative flex h-4 w-4 cursor-help">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40" />
                                    <CheckCircle className="relative h-4 w-4 text-green-500" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p>Clean - No issues detected</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {meta.status === 'suspicious' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="relative flex h-4 w-4 cursor-help">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40" />
                                    <AlertTriangle className="relative h-4 w-4 text-red-500" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p>Suspicious - Requires attention</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {meta.status === 'warning' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="relative flex h-4 w-4 cursor-help">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-40" />
                                    <XCircle className="relative h-4 w-4 text-orange-500" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p>Warning - Potential issue</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <span className="text-[10px] text-muted-foreground capitalize">{meta.status}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* XAI Heatmap Visualization */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  XAI Heatmap Visualization
                </CardTitle>
                <CardDescription>Areas highlighted in red indicate regions with the highest manipulation probability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative w-full max-w-lg mx-auto">
                  {previewUrl && (
                    <div className="relative">
                      <img src={previewUrl} alt="Heatmap" className="w-full rounded-lg opacity-80" />
                      <div className="absolute inset-0 bg-gradient-to-tr from-red-500/30 via-transparent to-orange-500/25 rounded-lg mix-blend-multiply" />
                      {/* Pulsing heatmap regions */}
                      <motion.div
                        className="absolute top-4 right-4 w-16 h-16 rounded-full bg-red-500/40 blur-md"
                        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute bottom-8 left-8 w-12 h-12 rounded-full bg-orange-500/35 blur-md"
                        animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.15, 1] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                      />
                      <motion.div
                        className="absolute top-1/3 left-1/4 w-20 h-10 rounded-full bg-yellow-500/25 blur-lg"
                        animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-green-500/60" /> Low
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-yellow-500/60" /> Medium
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-orange-500/60" /> High
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-red-500/60" /> Critical
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Forensic Findings & Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Forensic Findings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {imageResult.forensicFindings.map((finding, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-2"
                      >
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{finding}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-zinc-500" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {imageResult.recommendations.map((rec, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-2"
                      >
                        <CheckCircle className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{rec}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!imageResult && !imageLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <ImageIcon className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">Upload an Image to Begin</p>
                <p className="text-sm text-muted-foreground mt-1">Drag and drop or click to upload an image for forensic analysis, AI-generation detection, and manipulation identification</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
