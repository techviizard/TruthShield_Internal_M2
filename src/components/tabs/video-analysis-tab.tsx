'use client'

import { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { useAppStore, type RiskLevel } from '@/lib/store'
import { VideoFrameAnalysis } from '@/components/video-frame-analysis'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video, Upload, Play, AlertTriangle, CheckCircle, Loader2,
  RotateCcw, Scan, Users, Clock, Volume2, Shield, XCircle,
} from 'lucide-react'
import { ExportButton } from '@/components/export-button'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const VALID_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/avi']
const VALID_VIDEO_EXTS = ['mp4', 'mov', 'avi']

const riskBadgeClass: Record<RiskLevel, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
}

function ProgressRing({ value, size = 80, strokeWidth = 6, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-sm font-bold">{Math.round(value)}%</span>
    </div>
  )
}

export function VideoAnalysisTab() {
  const { videoLoading, videoResult, analyzeVideo, resetVideoResult } = useAppStore()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!VALID_VIDEO_TYPES.includes(file.type) && !VALID_VIDEO_EXTS.includes(ext || '')) {
    toast.error(`"${file.name}" is not a supported video format. Please use MP4, AVI, MOV.`)
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`"${file.name}" exceeds the 100MB limit for videos.`)
    return
  }
  const url = URL.createObjectURL(file)
  setPreviewUrl(url)
  setVideoFile(file)
}, [analyzeVideo])

const handleAnalyzeClick = () => { if (videoFile) analyzeVideo(videoFile) }

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleReset = () => {
    resetVideoResult()
    setPreviewUrl(null)
    setVideoUrl('')
    setVideoFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Frame-level pipeline - runs without a model, so it works offline too */}
      <VideoFrameAnalysis />

      {/* Upload Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-zinc-500" />
              Video Analysis
            </CardTitle>
            <CardDescription>Upload a video to detect deepfakes, face manipulation, and temporal inconsistencies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-gap-4">
              {/* File Upload */}
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer hover:border-zinc-500/50 hover:bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-matroska,video/x-msvideo"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Upload Video File</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, AVI, MOV (max 100MB)</p>
              </div>

            </div>

            {previewUrl && (
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {previewUrl.startsWith('blob:') && (
                  <div className="relative w-full sm:w-80">
                    <video
                      src={previewUrl}
                      controls
                      className="w-full h-48 rounded-lg border bg-black"
                    />
                    {/* Animated scanning overlay */}
                    {videoLoading && (
                      <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
                        <div className="absolute left-0 right-0 h-0.5 bg-zinc-400/70 blur-sm animate-scan-line" />
                        <div className="absolute left-0 right-0 h-px bg-zinc-300/50 animate-scan-line" style={{ animationDelay: '0.7s' }} />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-500/5 to-transparent animate-pulse" />
                      </div>
                    )}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear & Upload New
                </Button>
                <Button
                  size="sm"
                  onClick={handleAnalyzeClick}
                  disabled={videoLoading || !videoFile}
                  className="bg-zinc-600 hover:bg-zinc-700 text-white"
                >
                  {videoLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Analyze
                    </>
                  )}
                </Button>
                {videoResult && (
                  <ExportButton
                    data={videoResult as unknown as Record<string, unknown>}
                    filename={`truthshield-video-${Date.now()}`}
                    size="sm"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading State */}
      {videoLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-zinc-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Video className="h-5 w-5 text-zinc-700" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Analyzing Video...</p>
                  <p className="text-sm text-muted-foreground">Extracting frames, analyzing faces, and checking temporal consistency</p>
                </div>
                <div className="w-full max-w-md space-y-2">
                  <Progress value={35} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">Processing frame analysis...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {videoResult && !videoLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Top Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Deepfake Probability */}
              <Card className="flex flex-col items-center justify-center p-6">
                <span className="text-sm text-muted-foreground mb-2">Deepfake Probability</span>
                <motion.span
                  className={`text-4xl font-bold ${videoResult.deepfakeProbability > 70 ? 'text-red-500' : videoResult.deepfakeProbability > 40 ? 'text-yellow-500' : 'text-green-500'}`}
                  initial={{ color: '#888' }}
                  animate={{ color: videoResult.deepfakeProbability > 70 ? '#ef4444' : videoResult.deepfakeProbability > 40 ? '#eab308' : '#22c55e' }}
                  transition={{ duration: 1 }}
                >
                  {videoResult.deepfakeProbability}%
                </motion.span>
                <Badge variant="outline" className={`mt-2 ${riskBadgeClass[videoResult.riskAssessment]}`}>
                  {videoResult.riskAssessment.toUpperCase()}
                </Badge>
              </Card>

              {/* Temporal Consistency - Progress Ring */}
              <Card className="flex flex-col items-center justify-center p-6">
                <Clock className="h-5 w-5 text-blue-500 mb-2" />
                <span className="text-sm text-muted-foreground mb-1">Temporal Consistency</span>
                <ProgressRing
                  value={videoResult.temporalConsistency * 100}
                  size={80}
                  color={videoResult.temporalConsistency < 0.7 ? '#ef4444' : '#3b82f6'}
                />
              </Card>

              {/* Audio Authenticity - Progress Ring, backed by real audio DSP */}
              <Card className="flex flex-col items-center justify-center p-6">
                <Volume2 className="h-5 w-5 text-purple-500 mb-2" />
                <span className="text-sm text-muted-foreground mb-1">Audio Authenticity</span>
                <ProgressRing
                  value={videoResult.audioVisualSync * 100}
                  size={80}
                  color={videoResult.audioVisualSync < 0.75 ? '#f97316' : '#a855f7'}
                />
                <p className="text-[10px] text-muted-foreground/70 italic mt-1 text-center">
                  {videoResult.audioAnalysis?.available ? 'From real audio signal analysis' : 'No audio track detected'}
                </p>
              </Card>

              {/* Frame Analysis */}
              <Card className="flex flex-col items-center justify-center p-6">
                <Scan className="h-6 w-6 text-zinc-500 mb-2" />
                <span className="text-sm text-muted-foreground mb-1">Frame Analysis</span>
                <span className="text-xl font-bold">{videoResult.frameAnalysis.flaggedFrames}/{videoResult.frameAnalysis.totalFrames}</span>
                <span className="text-xs text-muted-foreground">flagged frames</span>
              </Card>
            </div>

            {/* Detailed Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Frame Analysis Detail */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scan className="h-4 w-4 text-zinc-500" />
                    Frame Analysis Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Total Frames Analyzed</span>
                      <span className="font-medium">{videoResult.frameAnalysis.totalFrames}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Flagged Frames</span>
                      <span className="font-medium text-red-500">{videoResult.frameAnalysis.flaggedFrames}</span>
                    </div>
                    <Progress value={(videoResult.frameAnalysis.flaggedFrames / videoResult.frameAnalysis.totalFrames) * 100} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Consistency Score</span>
                      <span className="font-medium">{(videoResult.frameAnalysis.consistency * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={videoResult.frameAnalysis.consistency * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Face Analysis */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    Face Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Faces Detected</span>
                    <span className="font-medium">{videoResult.faceAnalysis.facesDetected}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Detection Confidence</span>
                    <span className="font-medium">{(videoResult.faceAnalysis.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">AI's visual impression from sampled frames</span>
                    <div className="mt-2 space-y-2">
                      {videoResult.faceAnalysis.anomalies.map((anomaly, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20"
                        >
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="text-sm">{anomaly}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg gradient-border">
                    <span className="text-xs text-muted-foreground">Deepfake</span>
                    <p className={`text-lg font-bold mt-1 ${videoResult.deepfakeProbability > 70 ? 'text-red-500' : 'text-yellow-500'}`}>
                      {videoResult.deepfakeProbability > 70 ? 'Likely' : 'Possible'}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-lg gradient-border">
                    <span className="text-xs text-muted-foreground">Temporal</span>
                    <p className={`text-lg font-bold mt-1 ${videoResult.temporalConsistency < 0.7 ? 'text-red-500' : 'text-green-500'}`}>
                      {videoResult.temporalConsistency < 0.7 ? 'Inconsistent' : 'Consistent'}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-lg gradient-border">
                    <span className="text-xs text-muted-foreground">Audio</span>
                    <p className={`text-lg font-bold mt-1 ${videoResult.audioVisualSync < 0.75 ? 'text-orange-500' : 'text-green-500'}`}>
                      {videoResult.audioAnalysis?.available ? (videoResult.audioVisualSync < 0.75 ? 'Suspicious' : 'Clean') : 'N/A'}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-lg gradient-border">
                    <span className="text-xs text-muted-foreground">Overall</span>
                    <Badge variant="outline" className={`mt-1 ${riskBadgeClass[videoResult.riskAssessment]}`}>
                      {videoResult.riskAssessment.toUpperCase()} RISK
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!videoResult && !videoLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <Video className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">Upload a Video to Begin</p>
                <p className="text-sm text-muted-foreground mt-1">Upload a video file to detect deepfakes, face manipulation, and temporal inconsistencies</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
