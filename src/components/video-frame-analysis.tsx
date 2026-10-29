'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {Film, Loader2, Play, AlertTriangle, Scissors, Activity, Fingerprint, RotateCcw,} from 'lucide-react'
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

interface FrameScore {
  index: number
  timestamp: number
  score: number
  elaRegions: number
  noiseInconsistency: number
  ganArtifactScore: number
  distanceFromPrev: number | null
  sceneChange: boolean
  flagged: boolean
}

interface TemporalVerdict {
  frameCount: number
  durationCovered: number
  frames: FrameScore[]
  flaggedFrames: number[]
  sceneChanges: number[]
  meanScore: number
  temporalConsistency: number
  manipulationScore: number
  signals: { id: string; label: string; contribution: number; detail: string }[]
  explanation: string
}

const TARGET_FRAMES = 24
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const VALID_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/avi']
const VALID_VIDEO_EXTS = ['mp4', 'mov','avi']

/**
 * Frame-level video forensics.
 *
 * Sampling happens here, in the browser: the <video> element decodes the clip
 * and frames are pulled through a canvas. That keeps ffmpeg out of the server
 * deployment, avoids uploading the whole file, and works for any format the
 * browser can already play.
 */
export function VideoFrameAnalysis() {
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [stage, setStage] = useState<'idle' | 'sampling' | 'analyzing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [verdict, setVerdict] = useState<TemporalVerdict | null>(null)
  const [trustScore, setTrustScore] = useState<number | null>(null)
  const [evidenceHash, setEvidenceHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedFrame, setSelectedFrame] = useState<FrameScore | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  /** Seek to a timestamp and wait for the frame to actually be painted. */
  const seekTo = (video: HTMLVideoElement, time: number) =>
    new Promise<void>((resolve, reject) => {
      const onSeeked = () => { cleanup(); resolve() }
      const onError = () => { cleanup(); reject(new Error(`Could not seek to ${time.toFixed(2)}s`)) }
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
      }
      video.addEventListener('seeked', onSeeked)
      video.addEventListener('error', onError)
      video.currentTime = time
    })

  const run = useCallback(async () => {
    const video = videoRef.current
    if (!file || !video) return

    setStage('sampling')
    setProgress(0)
    setError(null)
    setVerdict(null)
    setSelectedFrame(null)

    try {
      if (!video.duration || Number.isNaN(video.duration)) {
        throw new Error('Video metadata has not loaded yet - wait a moment and try again.')
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is unavailable in this browser')

      // Cap the sampled resolution: the server normalises anyway, and a 4K clip
      // would otherwise produce a payload far larger than the analysis needs.
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight || 1))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)

      // Sample from just inside both ends, so a black lead-in or trailing frame
      // does not dominate the statistics.
      const start = Math.min(0.1, video.duration * 0.02)
      const end = Math.max(start, video.duration - 0.05)
      const step = (end - start) / Math.max(1, TARGET_FRAMES - 1)

      const form = new FormData()
      const timestamps: number[] = []

      for (let i = 0; i < TARGET_FRAMES; i++) {
        const t = Math.min(end, start + i * step)
        await seekTo(video, t)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.92)
        )
        if (!blob) throw new Error('Frame capture failed - the video may be protected by DRM.')
        form.append(`frame_${i}`, blob, `frame_${i}.jpg`)
        timestamps.push(Math.round(t * 100) / 100)
        setProgress(Math.round(((i + 1) / TARGET_FRAMES) * 100))
      }

      form.append('timestamps', JSON.stringify(timestamps))
      form.append('fileName', file.name)
      form.append('duration', String(video.duration))

      setStage('analyzing')
      const res = await fetch('/api/analyze/video-frames', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.details || json?.error || `Server returned ${res.status}`)

      setVerdict(json.analysis)
      setTrustScore(json.trustScore)
      setEvidenceHash(json.evidence?.sha256 ?? null)
      setStage('done')
      toast.success('Frame analysis complete', {
        description: `${json.analysis.frameCount} frames · ${json.analysis.flaggedFrames.length} flagged`,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Frame analysis failed'
      setError(message)
      setStage('error')
      toast.error('Frame analysis failed', { description: message })
    }
  }, [file])

  const handleReset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setFile(null)
    setVideoUrl(null)
    setStage('idle')
    setProgress(0)
    setVerdict(null)
    setTrustScore(null)
    setEvidenceHash(null)
    setError(null)
    setSelectedFrame(null)
  }, [videoUrl])

  const chartData = verdict?.frames.map((f) => ({
    t: f.timestamp,
    score: f.score,
    noise: f.noiseInconsistency,
    index: f.index,
  })) ?? []

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="h-4 w-4 text-muted-foreground" />
          Frame-level forensics
          <Badge variant="outline" className="text-[10px]">in-house · no model</Badge>
        </CardTitle>
        <CardDescription>
          Samples {TARGET_FRAMES} frames in your browser and runs error-level, sensor-noise and
          frequency checks on each, then compares them across time. Upload Video File in MP4, AVI, MOV (Max file size:100MB)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-matroska,video/x-msvideo"
            className="text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-xs"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              if (f) {
                const ext = f.name.split('.').pop()?.toLowerCase()
                if (!VALID_VIDEO_TYPES.includes(f.type) && !VALID_VIDEO_EXTS.includes(ext || '')) {
                  toast.error(`"${f.name}" is not a supported video format. Please use MP4, MOV, or AVI.`)
                  e.target.value = ''
                  return
                }
                if (f && f.size > MAX_FILE_SIZE) {
                  toast.error(`"${f.name}" exceeds the 100MB limit for video files.`)
                  e.target.value = '' // reset the input so the same oversized file can be re-selected later
                  return
                }
              }
              setFile(f)
              setVerdict(null)
              setStage('idle')
              if (videoUrl) URL.revokeObjectURL(videoUrl)
              setVideoUrl(f ? URL.createObjectURL(f) : null)
            }}
          />
          <Button
            size="sm"
            onClick={run}
            disabled={!file || stage === 'sampling' || stage === 'analyzing'}
            className="gap-1.5"
          >
            {stage === 'sampling' || stage === 'analyzing'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Play className="h-3.5 w-3.5" />}
            {stage === 'sampling' ? 'Sampling frames…' : stage === 'analyzing' ? 'Analysing…' : 'Analyse frames'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={(!file && !verdict) || stage === 'sampling' || stage === 'analyzing'}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>

        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            muted
            playsInline
            preload="auto"
            className="max-h-64 w-full rounded-lg border bg-black"
          />
        )}

        {stage === 'sampling' && (
          <div>
            <Progress value={progress} className="h-1.5" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Decoding frames locally - the clip itself is never uploaded.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {verdict && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Trust score', value: `${trustScore ?? ' - '}/100` },
                { label: 'Frames flagged', value: `${verdict.flaggedFrames.length}/${verdict.frameCount}` },
                { label: 'Temporal consistency', value: `${verdict.temporalConsistency}/100` },
                { label: 'Scene cuts', value: verdict.sceneChanges.length },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="text-lg font-semibold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                Per-frame manipulation evidence - click a point to jump to that moment
              </p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 12, bottom: 4, left: -20 }}
                    onClick={(e) => {
                      const idx = e?.activePayload?.[0]?.payload?.index
                      if (typeof idx !== 'number') return
                      const frame = verdict.frames[idx]
                      setSelectedFrame(frame)
                      if (videoRef.current) videoRef.current.currentTime = frame.timestamp
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} unit="s" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(v: number, n: string) => [v, n === 'score' ? 'frame score' : 'noise inconsistency']}
                      labelFormatter={(l) => `${l}s`}
                    />
                    <ReferenceLine y={45} stroke="#f97316" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="noise" stroke="#0ea5e9" strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
                    {verdict.sceneChanges.map((i) => (
                      <ReferenceDot
                        key={`cut-${i}`}
                        x={verdict.frames[i]?.timestamp}
                        y={verdict.frames[i]?.score ?? 0}
                        r={4}
                        fill="#a855f7"
                        stroke="none"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> frame score</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> noise inconsistency</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500" /> scene cut (expected difference, not evidence)</span>
              </div>
            </div>

            {/* Frame strip */}
            <div className="flex flex-wrap gap-1">
              {verdict.frames.map((f) => (
                <button
                  key={f.index}
                  type="button"
                  title={`${f.timestamp}s · score ${f.score}${f.sceneChange ? ' · scene cut' : ''}`}
                  onClick={() => {
                    setSelectedFrame(f)
                    if (videoRef.current) videoRef.current.currentTime = f.timestamp
                  }}
                  className={`h-7 flex-1 min-w-[14px] rounded-sm border transition-transform hover:scale-y-110 ${
                    f.flagged ? 'bg-red-500/70 border-red-500'
                      : f.sceneChange ? 'bg-purple-500/50 border-purple-500/60'
                        : 'bg-emerald-500/25 border-emerald-500/30'
                  } ${selectedFrame?.index === f.index ? 'ring-2 ring-foreground' : ''}`}
                />
              ))}
            </div>

            {selectedFrame && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">frame {selectedFrame.index}</Badge>
                  <span className="text-muted-foreground">at {selectedFrame.timestamp}s</span>
                  {selectedFrame.flagged && (
                    <Badge variant="outline" className="border-red-500/30 text-[10px] text-red-600 dark:text-red-400">
                      <AlertTriangle className="mr-1 h-3 w-3" /> flagged
                    </Badge>
                  )}
                  {selectedFrame.sceneChange && (
                    <Badge variant="outline" className="border-purple-500/30 text-[10px] text-purple-600 dark:text-purple-400">
                      <Scissors className="mr-1 h-3 w-3" /> scene cut
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Score', value: selectedFrame.score },
                    { label: 'ELA regions', value: selectedFrame.elaRegions },
                    { label: 'Noise', value: selectedFrame.noiseInconsistency },
                    { label: 'Synthesis grid', value: selectedFrame.ganArtifactScore },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] text-muted-foreground">{m.label}</div>
                      <div className="font-semibold tabular-nums">{m.value}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  The player above has jumped to this frame - compare it against its neighbours.
                </p>
              </div>
            )}

            {verdict.signals.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" /> Temporal signals
                </p>
                {verdict.signals.map((s) => (
                  <div key={s.id} className="rounded-lg border bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span>{s.label}</span>
                      <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">+{s.contribution}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{s.detail}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">{verdict.explanation}</p>

            {evidenceHash && (
              <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <Fingerprint className="h-3 w-3 text-emerald-500" />
                sha256 {evidenceHash.slice(0, 24)}… - covers the sampled frames, not the source container
              </p>
            )}

            <p className="text-[10px] text-muted-foreground">
              Identity matching, facial-landmark tracking and lip-sync scoring are not performed here;
              those need a face model. This measures spatial artifacts per frame and their consistency
              over time.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
