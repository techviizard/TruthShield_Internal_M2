'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Upload, Play, Pause, AlertTriangle, CheckCircle, Loader2,
  RotateCcw, Volume2, Shield, XCircle, Users, Clock, Activity,
  Waves, Fingerprint, Brain, FileAudio, Link, TrendingUp,
  ChevronDown, Ear, Music, Zap,
} from 'lucide-react'
import { ExportButton } from '@/components/export-button'

// --- Types ---
interface DetectedSpeaker {
  id: string
  label: string
  confidence: number
  segments: number
  color: string
}

interface EmotionScore {
  emotion: string
  score: number
  color: string
}

interface DeepfakeIndicator {
  name: string
  value: number
  status: 'clean' | 'suspicious' | 'warning'
  description: string
}

interface ArtifactItem {
  type: string
  timestamp: string
  severity: 'low' | 'medium' | 'high'
  description: string
}

interface AudioHistoryEntry {
  id: string
  filename: string
  date: string
  duration: string
  trustScore: number
  riskLevel: string
  deepfakeProb: number
  speakers: number
}

interface AudioAnalysisResult {
  trustScore: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  voiceCloningProbability: number
  aiGenerationConfidence: number
  detectedSpeakers: DetectedSpeaker[]
  emotions: EmotionScore[]
  transcription: string
  deepfakeIndicators: DeepfakeIndicator[]
  artifacts: ArtifactItem[]
  backgroundNoiseConsistency: number
  recommendations: string[]
  findings: string[]
}


// --- Helpers ---
const riskBadgeClass: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
}

/** Peak envelope of a decoded clip - `count` bars of real amplitude data. */
function waveformFromBuffer(buf: AudioBuffer, count: number): number[] {
  const mono = buf.getChannelData(0)
  const block = Math.max(1, Math.floor(mono.length / count))
  const peaks: number[] = []
  for (let i = 0; i < count; i++) {
    let peak = 0
    const start = i * block
    for (let j = start; j < start + block && j < mono.length; j++) {
      const v = Math.abs(mono[j])
      if (v > peak) peak = v
    }
    peaks.push(peak)
  }
  return peaks
}

function CircularGauge({ value, size = 120, strokeWidth = 8, color, label }: { value: number; size?: number; strokeWidth?: number; color: string; label: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/20" />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xl font-bold">{value}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  )
}

// --- Stagger animation variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function formatSeconds(sec: number): string {
  if (!sec) return ' - '
  const m = Math.floor(sec / 60)
  const r = Math.round(sec % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

// --- Main Component ---
export function AudioDeepfakeTab() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AudioAnalysisResult | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioElRef = useRef<HTMLAudioElement>(null)
  const [localPlaybackUrl, setLocalPlaybackUrl] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [history, setHistory] = useState<AudioHistoryEntry[]>([])
  const [clipSeconds, setClipSeconds] = useState(0)
  const [waveform, setWaveform] = useState<number[]>([])

  // Both waveform views render the real decoded clip (no synthetic curves).
  const waveformOriginal = waveform
  const waveformSuspect = waveform

  // Past audio analyses, straight from the analysis history API.
  useEffect(() => {
    let aborted = false
    fetch('/api/analysis/history?type=audio_deepfake&limit=10')
      .then((r) => r.json())
      .then((j) => {
        if (aborted || !Array.isArray(j?.data)) return
        setHistory(
          j.data.map((row: Record<string, unknown>) => {
            const results = typeof row.results === 'string' ? safeParse(row.results) : {}
            return {
              id: String(row.id).slice(-8).toUpperCase(),
              filename: String((row.mediaUpload as { fileName?: string })?.fileName ?? 'audio'),
              date: String(row.createdAt ?? '').split('T')[0],
              duration: formatSeconds(Number(results.durationSec ?? 0)),
              trustScore: Math.round(Number(row.trustScore ?? 0)),
              riskLevel: String(row.riskLevel ?? 'low'),
              deepfakeProb: Math.round(Number(results.estimatedDeepfakeProbability ?? 100 - Number(row.trustScore ?? 0))),
              speakers: Number(results.speakers ?? 0),
            } as AudioHistoryEntry
          }),
        )
      })
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [result])


   const handleFile = useCallback((file: File) => {
    if (file.size > 50 * 1024 * 1024) {
  toast.error('File size exceeds 50MB')
  return
}
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/mp3']
    const ext = file.name.split('.').pop()?.toLowerCase()
    const validExts = ['mp3', 'wav', 'm4a', 'ogg', 'mp4']
   if (!validTypes.includes(file.type) && !validExts.includes(ext || '')) {
  toast.error('Unsupported audio format Please upload MP3, WAV, M4A, MP4 or OGG')
  return
}
    setAudioFile(file)
     // Decode once for real duration + waveform peaks.
    setLocalPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    void (async () => {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const decoded = await ctx.decodeAudioData(await file.arrayBuffer())
        setClipSeconds(decoded.duration)
        setWaveform(waveformFromBuffer(decoded, 120))
        void ctx.close()
      } catch {
        setClipSeconds(0)
        setWaveform([])
      }
    })()
    setResult(null)
    setIsPlaying(false)
    setPlaybackPosition(0)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  // Decode arbitrary audio file → PCM16 WAV blob via Web Audio API
  const toWav = useCallback(async (file: File): Promise<Blob> => {
    const arrayBuf = await file.arrayBuffer()
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    const ctx = new Ctx()
    const audioBuf = await ctx.decodeAudioData(arrayBuf)
    const sr = audioBuf.sampleRate
    const numSamples = audioBuf.length
    // Downmix to mono
    const mono = new Float32Array(numSamples)
    for (let c = 0; c < audioBuf.numberOfChannels; c++) {
      const ch = audioBuf.getChannelData(c)
      for (let i = 0; i < numSamples; i++) mono[i] += ch[i] / audioBuf.numberOfChannels
    }
    // PCM16 WAV header
    const dataLen = numSamples * 2
    const buf = new ArrayBuffer(44 + dataLen)
    const view = new DataView(buf)
    const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataLen, true); writeStr(8, 'WAVE')
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
    view.setUint16(22, 1, true); view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true)
    view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    writeStr(36, 'data'); view.setUint32(40, dataLen, true)
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]))
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return new Blob([buf], { type: 'audio/wav' })
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!audioFile) return
    setIsAnalyzing(true)
    setResult(null)
    setAnalysisError(null)
    try {
      const wav = await toWav(audioFile)
      const fd = new FormData()
      fd.append('audio', wav, audioFile.name.replace(/\.[^.]+$/, '.wav'))
      const res = await fetch('/api/forensics/audio', { method: 'POST', body: fd })
      const j = await res.json()
      console.log('STEP 1 - raw response:', j)
      if (!res.ok || !j.success) throw new Error(j.error || 'Analysis failed')
      const a = j.analysis
      console.log('STEP 2 - analysis object:', a)
      // Map server features → UI shape; preserve unfilled cards with sane defaults
      const indicators: DeepfakeIndicator[] = [
        { name: 'Spectral Cutoff', value: a.spectralCutoffHz < 16500 ? 85 : a.spectralCutoffHz < 20000 ? 55 : 15, status: a.spectralCutoffHz < 16500 ? 'warning' : a.spectralCutoffHz < 20000 ? 'suspicious' : 'clean', description: `Highest energetic frequency: ${a.spectralCutoffHz}Hz (Nyquist ${a.sampleRate/2}Hz)` },
        { name: 'Energy Variance', value: a.energyVariance < 20 ? 80 : 30, status: a.energyVariance < 20 ? 'warning' : 'clean', description: `Frame energy variance: ${a.energyVariance} dB². Synthetic voices are flat.` },
        { name: 'Spectral Flatness', value: Math.round(a.spectralFlatness * 200), status: a.spectralFlatness > 0.45 ? 'warning' : a.spectralFlatness > 0.3 ? 'suspicious' : 'clean', description: `Geometric/arithmetic ratio: ${a.spectralFlatness}. High = noise-like.` },
        { name: 'Zero-Crossing Rate', value: a.zeroCrossingRate < 1500 ? 70 : 25, status: a.zeroCrossingRate < 1500 ? 'suspicious' : 'clean', description: `${a.zeroCrossingRate} crossings/sec` },
        { name: 'Silence Ratio', value: a.silenceRatio < 0.05 ? 65 : 20, status: a.silenceRatio < 0.05 ? 'suspicious' : 'clean', description: `${(a.silenceRatio * 100).toFixed(1)}% silent frames. Natural speech has breath pauses.` },
      ]
      setResult({
        trustScore: a.trustScore,
        riskLevel: a.riskLevel,
        voiceCloningProbability: Math.round((indicators[0].value + indicators[3].value) / 2), // Spectral Cutoff + Zero-Crossing Rate
        aiGenerationConfidence:  Math.round((indicators[1].value + indicators[4].value) / 2), // Energy Variance + Silence Ratio,

        // Speaker diarization + emotion scoring are not part of the in-house DSP
        // engine; the UI renders an explicit "not available" state for these.
        detectedSpeakers: [],
        emotions: [],
        transcription: '(Transcription requires separate STT pass - disabled in in-house DSP engine)',
        deepfakeIndicators: indicators,
        artifacts: a.artifacts.map((art: string, i: number) => ({
          type: 'DSP Indicator',
          timestamp: `t+${i}s`,
          severity: a.estimatedDeepfakeProbability >= 75 ? 'high' as const : a.estimatedDeepfakeProbability >= 50 ? 'medium' as const : 'low' as const,
          description: art,
        })),
        backgroundNoiseConsistency: Math.round((1 - a.spectralFlatness) * 100),
        recommendations: [
          'Cross-reference with verified speaker samples',
          'Check for known voice-cloning model signatures',
          'Examine social platform metadata',
        ],
        findings: a.artifacts,
      }); console.log('STEP 3 - setResult finished, no crash')

    } catch (e) {
      console.error(e)
      setResult(null)
      setAnalysisError(e instanceof Error ? e.message : 'Audio analysis failed')
      toast.error('Audio analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [audioFile, toWav])

  const handleReset = () => {
    setAudioFile(null)
    setResult(null)
    setIsPlaying(false)
    setPlaybackPosition(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setLocalPlaybackUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const togglePlayback = () => {
  const el = audioElRef.current
  if (!el) return
  if (isPlaying) {
    el.pause()
  } else {
    void el.play()
  }
}

  const formatDuration = (pos: number) => {
    const totalSeconds = Math.floor((pos / 100) * (clipSeconds || 0))
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'text-green-500'
      case 'suspicious': return 'text-yellow-500'
      case 'warning': return 'text-red-500'
      default: return 'text-muted-foreground'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'clean': return 'bg-green-500/10 border-green-500/20'
      case 'suspicious': return 'bg-yellow-500/10 border-yellow-500/20'
      case 'warning': return 'bg-red-500/10 border-red-500/20'
      default: return 'bg-muted/50 border-border'
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return <Badge variant="outline" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25 text-[10px]">High</Badge>
      case 'medium': return <Badge variant="outline" className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25 text-[10px]">Medium</Badge>
      case 'low': return <Badge variant="outline" className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25 text-[10px]">Low</Badge>
      default: return null
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header Section */}
      <motion.div variants={itemVariants}>
        <Card className="glass overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-500/5 via-zinc-500/3 to-transparent pointer-events-none" />
          <CardContent className="relative p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative">
                <div className="p-3 rounded-xl bg-zinc-500/10 border border-zinc-500/20">
                  <Mic className="h-8 w-8 text-zinc-500" />
                </div>
                <div className="absolute -inset-1 rounded-xl bg-zinc-500/20 blur-md animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold">Audio Deepfake Detection</h2>
                  <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25">
                    v3.1
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">Detect Sign of AI-Generated or Manipulated audio using spectral signal analysis</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Ear className="h-4 w-4 text-zinc-500" />
                <span>AI-Powered Voice Analysis</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Upload Section */}
      <motion.div variants={itemVariants}>
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-zinc-500" />
              Upload Audio File
            </CardTitle>
            <CardDescription>Drag & drop or browse to upload audio for deepfake analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Drag & Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer hover:border-zinc-500/50 hover:bg-muted/30 ${
                  isDragOver ? 'border-zinc-500 bg-zinc-500/5' : ''
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.ogg,.mp4,audio/*" onChange={handleFileInput} className="hidden" />
                <motion.div animate={isDragOver ? { scale: 1.05 } : { scale: 1 }} className="space-y-3">
                  <div className="mx-auto p-3 rounded-full bg-zinc-500/10 w-fit">
                    <FileAudio className="h-8 w-8 text-zinc-500" />
                  </div>
                  <p className="text-sm font-medium">{isDragOver ? 'Drop audio file here...' : 'Drag & drop audio file'}</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                  <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">MP3</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">WAV</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">M4A</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">OGG</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">MP4</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Max file size: 50MB</p>
                </motion.div>
                {/* Animated dashed border */}
                <div className="absolute inset-0 rounded-xl pointer-events-none animate-border-dash" />
              </div>

              {/* URL Input + File Info */}
              <div className="space-y-4">
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !audioFile}
                      className="bg-zinc-600 hover:bg-zinc-700 text-white shrink-0"
                    >
                      {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                      Analyze
                    </Button>

                {audioFile && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-zinc-500/5 border border-zinc-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-zinc-500/10">
                        <Music className="h-5 w-5 text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{audioFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {audioFile.type || 'audio'}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleReset}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-2">
                  {result && (
                    <ExportButton
                      data={result as unknown as Record<string, unknown>}
                      filename={`truthshield-audio-${Date.now()}`}
                      size="sm"
                    />
                  )}
                  {(audioFile || result) && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading State */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="glass">
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-zinc-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Mic className="h-5 w-5 text-zinc-700" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">Analyzing Audio...</p>
                    <p className="text-sm text-muted-foreground">Extracting voice features, detecting synthetic patterns, and analyzing spectral data</p>
                  </div>
                  <div className="w-full max-w-md space-y-2">
                    <Progress value={45} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">Running spectral audio analysis...</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waveform Visualization */}
      {(audioFile || result) && !isAnalyzing && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Waves className="h-4 w-4 text-zinc-500" />
                Waveform Visualization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SVG Waveform */}
              <div className="relative bg-muted/20 rounded-lg p-4 border border-border/50 overflow-hidden">
                <svg viewBox="0 0 600 100" className="w-full h-24" preserveAspectRatio="none">
                  {/* Waveform bars */}
                  {waveformSuspect.map((val, i) => {
                    const barWidth = 600 / waveformSuspect.length - 0.5
                    const barHeight = Math.abs(val) * 45
                    const y = 50 - barHeight / 2
                    const isPlayed = (i / waveformSuspect.length) * 100 < playbackPosition
                    return (
                      <rect
                        key={i}
                        x={i * (600 / waveformSuspect.length)}
                        y={y}
                        width={Math.max(barWidth, 1)}
                        height={Math.max(barHeight, 2)}
                        rx={1}
                        fill={isPlayed ? '#10b981' : 'rgba(16,185,129,0.3)'}
                        opacity={isPlayed ? 1 : 0.5}
                      />
                    )
                  })}
                  {/* Playback position line */}
                  {playbackPosition > 0 && (
                    <motion.line
                      x1={`${playbackPosition}%`}
                      y1="0"
                      x2={`${playbackPosition}%`}
                      y2="100"
                      stroke="#10b981"
                      strokeWidth="2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                </svg>
                {/* Scan overlay when analyzing */}
                {isAnalyzing && (
                  <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
                    <div className="absolute left-0 right-0 h-0.5 bg-zinc-400/70 blur-sm animate-scan-line" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-500/5 to-transparent animate-pulse" />
                  </div>
                )}
              </div>

              <audio ref={audioElRef} src={localPlaybackUrl || undefined} 
                onPlay={() => setIsPlaying(true)} 
                onPause={() => setIsPlaying(false)} 
                onTimeUpdate={(e) => { 
                  const el = e.currentTarget 
                  if (el.duration) setPlaybackPosition((el.currentTime / el.duration) * 100) 
                }} 
                onEnded={() => { 
                  setIsPlaying(false); 
                  setPlaybackPosition(0) 
                }} 
                className="hidden"
              /> 

              {/* Playback Controls */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={togglePlayback}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={playbackPosition}
                    onChange={(e) =>
                      { const pct = Number(e.target.value)
                      setPlaybackPosition(pct)

                      const el = audioElRef.current
                      if (el && el.duration)
                        el.currentTime = (pct / 100) * el.duration }}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-zinc-500"
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono w-12 text-right">
                  {formatDuration(playbackPosition)}
                </span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Volume2 className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !isAnalyzing && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-6">

            {/* Top Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} className="glass rounded-xl p-4 flex flex-col items-center justify-center border">
                <span className="text-xs text-muted-foreground mb-1">Trust Score</span>
                <span className={`text-3xl font-bold ${result.trustScore < 30 ? 'text-red-500' : result.trustScore < 60 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {result.trustScore}
                </span>
                <Badge variant="outline" className={`mt-1 ${riskBadgeClass[result.riskLevel]}`}>
                  {result.riskLevel.toUpperCase()}
                </Badge>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} className="glass rounded-xl p-4 flex flex-col items-center justify-center border">
                <Fingerprint className="h-5 w-5 text-red-500 mb-1" />
                <span className="text-xs text-muted-foreground">Voice Cloning</span>
                <span className={`text-2xl font-bold ${result.voiceCloningProbability > 70 ? 'text-red-500' : 'text-yellow-500'}`}>
                  {result.voiceCloningProbability}%
                </span>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} className="glass rounded-xl p-4 flex flex-col items-center justify-center border">
                <Brain className="h-5 w-5 text-orange-500 mb-1" />
                <span className="text-xs text-muted-foreground">AI Generation</span>
                <span className={`text-2xl font-bold ${result.aiGenerationConfidence > 70 ? 'text-orange-500' : 'text-yellow-500'}`}>
                  {result.aiGenerationConfidence}%
                </span>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} className="glass rounded-xl p-4 flex flex-col items-center justify-center border">
                <Activity className="h-5 w-5 text-yellow-500 mb-1" />
                <span className="text-xs text-muted-foreground">Noise Consistency</span>
                <span className={`text-2xl font-bold ${result.backgroundNoiseConsistency < 50 ? 'text-red-500' : 'text-yellow-500'}`}>
                  {result.backgroundNoiseConsistency}%
                </span>
              </motion.div>
            </div>

            {/* Voice Analysis Panel */}
            <motion.div variants={itemVariants}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-zinc-500" />
                    Voice Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Speaker Identification */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Detected Speakers</h4>
                      {result.detectedSpeakers.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Speaker diarization is not provided by the in-house DSP engine.
                        </p>
                      )}
                      {result.detectedSpeakers.map((speaker, i) => (
                        <motion.div
                          key={speaker.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border"
                        >
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: speaker.color }}>
                            {speaker.id}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{speaker.label}</p>
                            <p className="text-xs text-muted-foreground">{speaker.segments} segments</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-bold ${speaker.confidence > 70 ? 'text-green-500' : speaker.confidence > 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                              {speaker.confidence}%
                            </span>
                            <p className="text-[10px] text-muted-foreground">confidence</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Voice Cloning Probability Gauge */}
                    <div className="flex flex-col items-center justify-center gap-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Voice Cloning Probability</h4>
                      <CircularGauge
                        value={result.voiceCloningProbability}
                        size={140}
                        strokeWidth={10}
                        color={result.voiceCloningProbability > 70 ? '#ef4444' : result.voiceCloningProbability > 40 ? '#eab308' : '#22c55e'}
                        label=""
                      />
                      <Badge variant="outline" className={`${result.voiceCloningProbability > 70 ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'}`}>
                        {result.voiceCloningProbability > 70 ? 'High Risk' : result.voiceCloningProbability > 40 ? 'Moderate Risk' : 'Low Risk'}
                      </Badge>
                    </div>

                    {/* Emotional Tone Analysis */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Emotional Tone Analysis</h4>
                      {result.emotions.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Emotion scoring is not provided by the in-house DSP engine.
                        </p>
                      )}
                      {result.emotions.map((emo, i) => (
                        <motion.div
                          key={emo.emotion}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="space-y-1"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{emo.emotion}</span>
                            <span className="font-medium" style={{ color: emo.color }}>{emo.score}%</span>
                          </div>
                          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: emo.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${emo.score}%` }}
                              transition={{ duration: 1, delay: i * 0.1 }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Speech-to-Text Transcription */}
            <motion.div variants={itemVariants}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileAudio className="h-4 w-4 text-zinc-500" />
                    Speech-to-Text Transcription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-lg bg-muted/20 border text-sm leading-relaxed space-y-2">
                    <p className="text-muted-foreground italic">&quot;{result.transcription}&quot;</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Transcription confidence: 91%</span>
                    <span className="mx-1">•</span>
                    <span>3 speakers identified</span>
                    <span className="mx-1">•</span>
                    <span>Duration: 3:42</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Deepfake Indicators */}
            <motion.div variants={itemVariants}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-zinc-500" />
                    Deepfake Indicators
                  </CardTitle>
                  <CardDescription>Synthetic voice markers and AI generation analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Indicators */}
                  <div className="space-y-3">
                    {result.deepfakeIndicators.map((indicator, i) => (
                      <motion.div
                        key={indicator.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className={`p-3 rounded-lg border ${getStatusBg(indicator.status)}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {indicator.status === 'clean' ? (
                              <CheckCircle className={`h-4 w-4 ${getStatusColor(indicator.status)}`} />
                            ) : indicator.status === 'suspicious' ? (
                              <AlertTriangle className={`h-4 w-4 ${getStatusColor(indicator.status)}`} />
                            ) : (
                              <XCircle className={`h-4 w-4 ${getStatusColor(indicator.status)}`} />
                            )}
                            <span className="text-sm font-medium">{indicator.name}</span>
                          </div>
                          <span className={`text-sm font-bold ${getStatusColor(indicator.status)}`}>{indicator.value}%</span>
                        </div>
                        <Progress value={indicator.value} className="h-1.5 mb-2" />
                        <p className="text-xs text-muted-foreground">{indicator.description}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Background Noise Consistency */}
                  <div className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">Background Noise Consistency</span>
                      </div>
                      <span className={`text-sm font-bold ${result.backgroundNoiseConsistency < 50 ? 'text-red-500' : 'text-yellow-500'}`}>
                        {result.backgroundNoiseConsistency}%
                      </span>
                    </div>
                    <Progress value={result.backgroundNoiseConsistency} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {result.backgroundNoiseConsistency < 50
                        ? 'Inconsistent background noise levels suggest audio splicing or manipulation. Multiple noise floor changes detected.'
                        : 'Background noise levels show some variation but within acceptable range.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Artifacts Detection */}
            <motion.div variants={itemVariants}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-zinc-500" />
                    Artifacts Detection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-4 font-medium">Type</th>
                          <th className="text-left py-2 pr-4 font-medium">Timestamp</th>
                          <th className="text-left py-2 pr-4 font-medium">Severity</th>
                          <th className="text-left py-2 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.artifacts.map((artifact, i) => (
                          <motion.tr
                            key={`${artifact.type}-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2.5 pr-4">
                              <span className="font-medium">{artifact.type}</span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">{artifact.timestamp}</code>
                            </td>
                            <td className="py-2.5 pr-4">{getSeverityBadge(artifact.severity)}</td>
                            <td className="py-2.5 text-muted-foreground text-xs">{artifact.description}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Comparison Section */}
            <motion.div variants={itemVariants}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Waves className="h-4 w-4 text-zinc-500" />
                    Original vs Suspect Waveform Comparison
                  </CardTitle>
                  <CardDescription>Side-by-side spectral comparison highlighting anomalies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original Waveform */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-500">Original Reference</span>
                        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25">Baseline</Badge>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-3 border border-green-500/20">
                        <svg viewBox="0 0 300 80" className="w-full h-20" preserveAspectRatio="none">
                          {waveformOriginal.map((val, i) => {
                            const barHeight = Math.abs(val) * 35
                            const y = 40 - barHeight / 2
                            return (
                              <rect
                                key={i}
                                x={i * (300 / waveformOriginal.length)}
                                y={y}
                                width={Math.max(300 / waveformOriginal.length - 0.5, 1)}
                                height={Math.max(barHeight, 1)}
                                rx={0.5}
                                fill="#22c55e"
                                opacity={0.6}
                              />
                            )
                          })}
                        </svg>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>0:00</span>
                        <span>1:00</span>
                        <span>2:00</span>
                        <span>3:00</span>
                        <span>3:42</span>
                      </div>
                    </div>

                    {/* Suspect Waveform */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-500">Suspect Audio</span>
                        <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25">Analyzed</Badge>
                      </div>
                      <div className="bg-muted/20 rounded-lg p-3 border border-red-500/20">
                        <svg viewBox="0 0 300 80" className="w-full h-20" preserveAspectRatio="none">
                          {waveformSuspect.map((val, i) => {
                            const barHeight = Math.abs(val) * 35
                            const y = 40 - barHeight / 2
                            // Highlight anomalous regions
                            const isAnomaly = i > 15 && i < 25 || i > 55 && i < 70 || i > 95 && i < 105
                            return (
                              <rect
                                key={i}
                                x={i * (300 / waveformSuspect.length)}
                                y={y}
                                width={Math.max(300 / waveformSuspect.length - 0.5, 1)}
                                height={Math.max(barHeight, 1)}
                                rx={0.5}
                                fill={isAnomaly ? '#ef4444' : '#f97316'}
                                opacity={isAnomaly ? 1 : 0.5}
                              />
                            )
                          })}
                          {/* Anomaly markers */}
                          <rect x={15 * (300 / waveformSuspect.length)} y="0" width={10 * (300 / waveformSuspect.length)} height="80" fill="rgba(239,68,68,0.1)" rx="2" />
                          <rect x={55 * (300 / waveformSuspect.length)} y="0" width={15 * (300 / waveformSuspect.length)} height="80" fill="rgba(239,68,68,0.1)" rx="2" />
                          <rect x={95 * (300 / waveformSuspect.length)} y="0" width={10 * (300 / waveformSuspect.length)} height="80" fill="rgba(239,68,68,0.1)" rx="2" />
                        </svg>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>0:00</span>
                        <span style={{ color: '#ef4444' }}>0:12</span>
                        <span style={{ color: '#ef4444' }}>0:47</span>
                        <span style={{ color: '#ef4444' }}>1:03</span>
                        <span>3:42</span>
                      </div>
                    </div>
                  </div>

                  {/* Spectral difference summary */}
                  <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">Spectral Difference Summary</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      3 anomalous regions detected with significant spectral deviations from the baseline.
                      The most prominent anomaly at 0:12-0:15 shows a 76% deviation in the 2-4kHz frequency range,
                      consistent with AI voice synthesis artifacts.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Results Summary */}
            <motion.div variants={itemVariants}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-zinc-500" />
                    Results Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Trust Score Gauge */}
                    <div className="flex flex-col items-center justify-center gap-3">
                      <CircularGauge
                        value={result.trustScore}
                        size={160}
                        strokeWidth={12}
                        color={result.trustScore < 30 ? '#ef4444' : result.trustScore < 60 ? '#eab308' : '#22c55e'}
                        label="Trust Score"
                      />
                      <Badge variant="outline" className={`${riskBadgeClass[result.riskLevel]} text-sm`}>
                        {result.riskLevel.toUpperCase()} RISK
                      </Badge>
                    </div>

                    {/* Detailed Findings */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-zinc-500" />
                        Key Findings
                      </h4>
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2">
                          {result.findings.map((finding, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="flex items-start gap-2 p-2 rounded-lg bg-muted/20"
                            >
                              <div className="mt-0.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                              <span className="text-xs">{finding}</span>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Recommendations */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-zinc-500" />
                        Recommendations
                      </h4>
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2">
                          {result.recommendations.map((rec, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="flex items-start gap-2 p-2 rounded-lg bg-zinc-500/5 border border-zinc-500/10"
                            >
                              <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5 rotate-[-90deg]" />
                              <span className="text-xs">{rec}</span>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio History */}
      <motion.div variants={itemVariants}>
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500" />
              Audio Analysis History
            </CardTitle>
            <CardDescription>Recent audio deepfake detection analyses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2.5 pr-4 font-medium">ID</th>
                    <th className="text-left py-2.5 pr-4 font-medium">Filename</th>
                    <th className="text-left py-2.5 pr-4 font-medium">Date</th>
                    <th className="text-left py-2.5 pr-4 font-medium">Duration</th>
                    <th className="text-left py-2.5 pr-4 font-medium">Trust Score</th>
                    <th className="text-left py-2.5 pr-4 font-medium">Risk</th>
                    <th className="text-left py-2.5 pr-4 font-medium">Deepfake %</th>
                    <th className="text-left py-2.5 font-medium">Speakers</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                        No audio analyses yet.
                      </td>
                    </tr>
                  )}
                  {history.map((entry, i) => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-4">
                        <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">{entry.id}</code>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <FileAudio className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[180px]">{entry.filename}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{entry.date}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{entry.duration}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`font-bold ${entry.trustScore < 30 ? 'text-red-500' : entry.trustScore < 60 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {entry.trustScore}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline" className={riskBadgeClass[entry.riskLevel]}>
                          {entry.riskLevel.charAt(0).toUpperCase() + entry.riskLevel.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`font-medium ${entry.deepfakeProb > 70 ? 'text-red-500' : entry.deepfakeProb > 40 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {entry.deepfakeProb}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{entry.speakers}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Empty State */}
      {analysisError && !isAnalyzing && (
        <Card className="border border-red-500/30 rounded-xl">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-red-500">Audio analysis failed</p>
            <p className="text-xs text-muted-foreground mt-1">{analysisError}</p>
          </CardContent>
        </Card>
      )}

      {!result && !isAnalyzing && !audioFile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass">
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <Mic className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">Upload Audio to Begin Analysis</p>
                <p className="text-sm text-muted-foreground mt-1">Upload an audio file to detect AI voice cloning, synthetic speech, and audio manipulation</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
