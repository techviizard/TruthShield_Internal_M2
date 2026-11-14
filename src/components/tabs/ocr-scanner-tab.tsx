'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanText, Upload, Loader2, CheckCircle, Circle, Copy,
  Languages, ArrowRightLeft, ShieldAlert, AlertTriangle,
  TrendingDown, Eye, Type, RotateCcw, Play, FileText,
  ChevronRight, Globe, BookOpen, MessageSquare, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OcrResult {
  extractedText: string
  detectedLanguage: string
  languageCode: string
  confidence: number
  scriptType: string
  scriptConfidence: number
  multipleScripts: { script: string; confidence: number }[]
  writingDirection: string
  translation: string
  translationConfidence: number
  threatAnalysis: {
    fakeNewsIndicators: string[]
    propagandaTechniques: string[]
    sentiment: string
    trustScore: number
    flaggedKeywords: string[]
  }
  characterCount: number
  wordCount: number
}

interface OcrHistoryItem {
  id: string
  date: string
  language: string
  textPreview: string
  trustScore: number
  status: 'completed' | 'processing' | 'failed'
}

type ProcessingStep = 'idle' | 'preprocessing' | 'scriptDetection' | 'textExtraction' | 'analysis' | 'complete'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect', script: 'Multiple' },
  { code: 'en', label: 'English', script: 'Latin' },
  { code: 'hi', label: 'Hindi (Devanagari)', script: 'Devanagari' },
  { code: 'te', label: 'Telugu', script: 'Telugu' },
]

const LANGUAGE_BADGES = [
  'English',
  'Hindi (Devanagari)',
  'Telugu',
]



// ─── Helper Components ──────────────────────────────────────────────────────

function ConfidenceGauge({ value, size = 80, color }: { value: number; size?: number; color?: string }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const strokeColor = color || (value > 70 ? '#10b981' : value > 40 ? '#eab308' : '#ef4444')

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (value / 100) * circumference }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color: strokeColor }}>
        {value}%
      </span>
    </div>
  )
}

function ProcessingStepIndicator({ step, currentStep }: { step: ProcessingStep; currentStep: ProcessingStep }) {
  const steps: { key: ProcessingStep; label: string }[] = [
    { key: 'preprocessing', label: 'Preprocessing' },
    { key: 'scriptDetection', label: 'Script Detection' },
    { key: 'textExtraction', label: 'Text Extraction' },
    { key: 'analysis', label: 'Analysis' },
  ]

  const stepOrder: ProcessingStep[] = ['idle', 'preprocessing', 'scriptDetection', 'textExtraction', 'analysis', 'complete']
  const stepIndex = stepOrder.indexOf(step)
  const currentIndex = stepOrder.indexOf(currentStep)
  const isComplete = stepIndex < currentIndex || currentStep === 'complete'
  const isActive = step === currentStep

  const stepData = steps.find(s => s.key === step)
  if (!stepData) return null

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: stepIndex * 0.1 }}
    >
      {isComplete ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <CheckCircle className="h-5 w-5 text-zinc-500" />
        </motion.div>
      ) : isActive ? (
        <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
      ) : (
        <Circle className="h-5 w-5 text-muted-foreground/40" />
      )}
      <span className={`text-sm ${isComplete ? 'text-zinc-600 dark:text-zinc-400 font-medium' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        {stepData.label}
      </span>
      {isActive && (
        <motion.div
          className="h-1 flex-1 max-w-[60px] bg-muted rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="h-full bg-zinc-500 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function OcrScannerTab() {
  // State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('auto')
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle')
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [history, setHistory] = useState<OcrHistoryItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // File handling
  const handleFile = useCallback((file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/tiff']
    if (!allowed.includes(file.type)) {
      toast.error('Unsupported file. Use PNG, JPG, JPEG, WebP or TIFF')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setUploadedFile(file)
    setOcrResult(null)
    setProcessingStep('idle')
  }, [])

  // Real OCR via /api/forensics/ocr
  // Past OCR scans come from the analysis history API.
  useEffect(() => {
    let aborted = false
    fetch('/api/analysis/history?type=ocr_scan&limit=10')
      .then((r) => r.json())
      .then((j) => {
       if (aborted || !Array.isArray(j?.items)) return
        setHistory(
          j.items.map((row: Record<string, unknown>) => {
            let parsed: Record<string, unknown> = {}
            try {
              parsed = typeof row.results === 'string' ? JSON.parse(row.results) : {}
            } catch {
              parsed = {}
            }
            return {
              id: String(row.id).slice(-8).toUpperCase(),
              date: String(row.createdAt ?? '').split('T')[0],
              language: String(parsed.language ?? 'auto'),
              textPreview: String(parsed.textPreview ?? '').slice(0, 80),
              trustScore: Math.round(Number(row.trustScore ?? 0)),
              status: (String(row.status ?? 'completed') === 'failed' ? 'failed' : 'completed') as OcrHistoryItem['status'],
            }
          }),
        )
      })
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [ocrResult])

  const handleTranslate = async () => {
  if (!ocrResult) return
  setShowTranslation(true)
  if (ocrResult.languageCode === 'en') {
    setOcrResult((prev) => (prev ? { ...prev, translation: prev.extractedText } : prev))
    return
  }
  setIsTranslating(true)
  try {
    const res = await fetch('/api/forensics/ocr/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: ocrResult.extractedText, language: ocrResult.languageCode }),
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || 'Translation failed')
    setOcrResult((prev) => (prev ? { ...prev, translation: j.translation } : prev))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Translation failed')
    setShowTranslation(false)
  } finally {
    setIsTranslating(false)
  }
} 

 const runRealOcr = useCallback(async () => {
  if (!uploadedFile) return

  setIsProcessing(true)
  setOcrResult(null)
  setShowTranslation(false)
  setProcessingStep('preprocessing')

  try {
    const fd = new FormData()
    fd.append('image', uploadedFile)

    setProcessingStep('textExtraction')

    const res = await fetch('/api/forensics/ocr', {
      method: 'POST',
      body: fd,
    })

    const j = await res.json()

    if (!res.ok || !j.success) {
      throw new Error(j.error || 'OCR failed')
    }

    setProcessingStep('analysis')

    const scripts = (j.detectedScripts ?? []) as {
      code: string
      label: string
    }[]

    const langLabel =
      scripts[0]?.label ?? j.language ?? 'Unknown'

    const extractedText = j.text || ''

    let threatAnalysis = {
      fakeNewsIndicators: [] as string[],
      propagandaTechniques: [] as string[],
      sentiment: 'Neutral',
      trustScore: 50,
      flaggedKeywords: [] as string[],
    }

    // Analyze the OCR text
    if (extractedText.trim()) {
      try {
        const analysisRes = await fetch('/api/analyze/text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: extractedText,
            language: j.language ?? 'auto',
          }),
        })

        const analysis = await analysisRes.json()
        console.log('OCR THREAT ANALYSIS RESPONSE:', analysis)
        const result = analysis.analysis
        console.log('OCR THREAT ANALYSIS RESULT:', result)
        if (analysisRes.ok) {
          const details =
  result.details &&
            typeof analysis.details === 'object'
              ? analysis.details
              : {}

          const sentimentDetails =
            details.sentiment &&
            typeof details.sentiment === 'object'
              ? details.sentiment
              : {}

          threatAnalysis = {
            fakeNewsIndicators:
              Array.isArray(details.misinformationIndicators)
                ? details.misinformationIndicators.map(String)
                : [],

            propagandaTechniques:
              Array.isArray(details.propagandaTechniques)
                ? details.propagandaTechniques.map(String)
                : [],

            sentiment:
  typeof sentimentDetails.overall === 'string'
    ? sentimentDetails.overall
    : 'Not available',
            trustScore:
  typeof result.trustScore === 'number'
    ? result.trustScore
    : 50,

            flaggedKeywords:
  Array.isArray(result.flags)
    ? result.flags.map(String)
    : [],
          }
        }
      } catch (analysisError) {
        console.warn(
          'Threat analysis failed:',
          analysisError
        )
      }
    }

    setOcrResult({
      extractedText,
      detectedLanguage: langLabel,
      languageCode: j.language ?? 'auto',
      confidence:
        typeof j.confidence === 'number'
          ? j.confidence
          : 0,
      scriptType:
        scripts[0]?.label ?? 'Mixed',
      scriptConfidence:
        typeof j.confidence === 'number'
          ? j.confidence
          : 0,
      multipleScripts: scripts.map((s) => ({
        script: s.label,
        confidence: 80,
      })),
      writingDirection:
        ['ur', 'ar'].includes(j.language)
          ? 'Right-to-Left'
          : 'Left-to-Right',
      translation: '',
      translationConfidence: 0,
      threatAnalysis,
      characterCount: extractedText.length,
      wordCount: extractedText
        ? extractedText.split(/\s+/).filter(Boolean).length
        : 0,
      processingTime: `${j.processingTime ?? 0}ms`,
      preprocessing: j.preprocessing,
    } as OcrResult)

    setProcessingStep('complete')

    toast.success(
      'OCR extraction and threat analysis complete!'
    )
  } catch (e) {
    toast.error(
      'OCR failed: ' +
        (e instanceof Error ? e.message : 'unknown')
    )
    setProcessingStep('idle')
  } finally {
    setIsProcessing(false)
  }
}, [uploadedFile])

  // OCR always runs through the real engine; a file is required.
  const runDemo = useCallback(() => {
    if (uploadedFile) {
      void runRealOcr()
      return
    }
    toast.error('Upload an image file to run OCR')
  }, [uploadedFile, runRealOcr])

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

  const handleUrlSubmit = useCallback(async () => {
  if (!imageUrl.trim()) {
    toast.error('Please enter an image URL')
    return
  }
  try {
    const res = await fetch('/api/forensics/ocr/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl.trim() }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Could not load this URL')
    }
    const blob = await res.blob()
    const name = imageUrl.split('?')[0].split('/').pop() || 'image-from-url'
    handleFile(new File([blob], name, { type: blob.type }))
    toast.success('Image loaded from URL')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not load this URL')
  }
}, [imageUrl, handleFile])

  const handleExtract = useCallback(() => {
    if (!previewUrl) {
      toast.error('Please upload an image first')
      return
    }
    runDemo()
  }, [previewUrl, runDemo])

  const handleReset = useCallback(() => {
    setPreviewUrl(null)
    setImageUrl('')
    setOcrResult(null)
    setProcessingStep('idle')
    setShowTranslation(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleCopy = useCallback(async () => {
    if (!ocrResult) return
    try {
      await navigator.clipboard.writeText(ocrResult.extractedText)
      setCopied(true)
      toast.success('Text copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy text')
    }
  }, [ocrResult])

  // Highlight flagged keywords in text
  const renderHighlightedText = useCallback((text: string, keywords: string[]) => {
    if (keywords.length === 0) return text

    const parts: React.ReactNode[] = []
    let remaining = text
    let keyIdx = 0

    while (remaining.length > 0) {
      let earliestIdx = remaining.length
      let earliestKeyword = ''

      for (const kw of keywords) {
        const idx = remaining.indexOf(kw)
        if (idx !== -1 && idx < earliestIdx) {
          earliestIdx = idx
          earliestKeyword = kw
        }
      }

      if (earliestKeyword === '') {
        parts.push(<span key={keyIdx++}>{remaining}</span>)
        break
      }

      if (earliestIdx > 0) {
        parts.push(<span key={keyIdx++}>{remaining.slice(0, earliestIdx)}</span>)
      }

      parts.push(
        <mark key={keyIdx++} className="bg-red-500/20 text-red-600 dark:text-red-400 px-0.5 rounded">
          {earliestKeyword}
        </mark>
      )
      remaining = remaining.slice(earliestIdx + earliestKeyword.length)
    }

    return parts
  }, [])

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const trustScoreColor = ocrResult
    ? ocrResult.threatAnalysis.trustScore > 60
      ? '#10b981'
      : ocrResult.threatAnalysis.trustScore > 30
        ? '#eab308'
        : '#ef4444'
    : '#ef4444'

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ScanText className="h-6 w-6 text-zinc-500" />
                  OCR Scanner
                </CardTitle>
                <CardDescription className="mt-1">
                  Extract and analyze text from images with English, Hindi and Telugu
                </CardDescription>
              </div>
              <Button
                onClick={runDemo}
                disabled={isProcessing}
                className="bg-zinc-600 hover:bg-zinc-700 text-white shrink-0"
              >
                <Play className="h-4 w-4 mr-2" />
                Run OCR
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {LANGUAGE_BADGES.map((lang, i) => (
                <motion.div
                  key={lang}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
                    {lang}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-zinc-500" />
              Upload Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`relative rounded-xl p-8 text-center transition-all cursor-pointer overflow-hidden ${
                isDragging ? 'bg-zinc-500/5' : 'hover:bg-muted/30'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute inset-0 border-2 border-dashed rounded-xl transition-colors duration-300 ${
                  isDragging ? 'border-zinc-500' : 'border-muted-foreground/25 hover:border-zinc-500/50'
                }`} />
                <div className="absolute bottom-0 left-0 right-0 h-0.5 animate-border-dash" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/tiff"
                onChange={handleFileInput}
                className="hidden"
              />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drag & drop an image here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supported: PNG, JPG, JPEG, WebP, TIFF
              </p>
            </div>

            {/* URL Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="Or paste image URL..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/40 focus:border-zinc-500"
                />
              </div>
              <Button variant="outline" onClick={handleUrlSubmit} size="sm">
                Load URL
              </Button>
            </div>

            {/* Language Selector + Extract Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-full">
                    <Languages className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleExtract}
                disabled={isProcessing || !previewUrl}
                className="bg-zinc-600 hover:bg-zinc-700 text-white min-w-[140px]"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ScanText className="h-4 w-4 mr-2" />
                )}
                Extract Text
              </Button>
            </div>

            {/* Preview with Scanning Effect */}
            <AnimatePresence>
              {previewUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col sm:flex-row items-start gap-4"
                >
                  <div className="relative w-full sm:w-72 h-48 rounded-lg overflow-hidden border">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    {/* Scanning overlay */}
                    {isProcessing && (
                      <>
                        <div className="absolute inset-0 bg-zinc-500/5">
                          <motion.div
                            className="absolute left-0 right-0 h-0.5 bg-zinc-400/80 blur-[1px]"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                          />
                          <motion.div
                            className="absolute left-0 right-0 h-1 bg-zinc-300/30 blur-sm"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 0.3 }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                            <span className="text-xs text-white/80 font-medium">Scanning...</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear & Upload New
                    </Button>
                    {!ocrResult && !isProcessing && previewUrl && (
                      <p className="text-xs text-muted-foreground">Image loaded. Click &quot;Extract Text&quot; to begin OCR.</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Processing Indicator */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-zinc-500 animate-pulse" />
                    <p className="text-lg font-medium">Processing OCR...</p>
                  </div>
                  <div className="w-full max-w-md space-y-3">
                    <ProcessingStepIndicator step="preprocessing" currentStep={processingStep} />
                    <ProcessingStepIndicator step="scriptDetection" currentStep={processingStep} />
                    <ProcessingStepIndicator step="textExtraction" currentStep={processingStep} />
                    <ProcessingStepIndicator step="analysis" currentStep={processingStep} />
                  </div>
                  <Progress
                    value={
                      processingStep === 'preprocessing' ? 15 :
                      processingStep === 'scriptDetection' ? 40 :
                      processingStep === 'textExtraction' ? 65 :
                      processingStep === 'analysis' ? 85 : 100
                    }
                    className="h-2 max-w-md"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Section */}
      <AnimatePresence>
        {ocrResult && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Extracted Text Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-zinc-500" />
                      Extracted Text
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
                        {ocrResult.detectedLanguage}
                      </Badge>
                      <ConfidenceGauge value={ocrResult.confidence} size={48} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <div className="border rounded-lg p-4 bg-muted/30 min-h-[80px]">
                      <p className="text-base leading-relaxed font-[system-ui]">
                        {renderHighlightedText(ocrResult.extractedText, ocrResult.threatAnalysis.flaggedKeywords)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="absolute top-2 right-2 h-8 w-8 p-0"
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4 text-zinc-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Type className="h-3 w-3" />
                      {ocrResult.characterCount} characters
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {ocrResult.wordCount} words
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {ocrResult.threatAnalysis.flaggedKeywords.length} flagged keywords
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Script Analysis + Translation Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Script Analysis Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Languages className="h-4 w-4 text-zinc-500" />
                      Script Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Script Type</span>
                        <Badge className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20">
                          {ocrResult.scriptType}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Script Confidence</span>
                        <span className="text-sm font-medium">{ocrResult.scriptConfidence}%</span>
                      </div>
                      <Progress value={ocrResult.scriptConfidence} className="h-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Writing Direction</span>
                        <span className="text-sm font-medium flex items-center gap-1">
                          <ArrowRightLeft className="h-3 w-3" />
                          {ocrResult.writingDirection}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Multiple Script Detection */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Detected Scripts</p>
                      <div className="space-y-2">
                        {ocrResult.multipleScripts.map((script, i) => (
                          <motion.div
                            key={script.script}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.1 }}
                            className="flex items-center gap-3"
                          >
                            <span className="text-sm flex-1">{script.script}</span>
                            <div className="w-24">
                              <Progress value={script.confidence} className="h-1.5" />
                            </div>
                            <span className={`text-xs font-medium w-10 text-right ${
                              script.confidence > 50 ? 'text-zinc-500' : 'text-muted-foreground'
                            }`}>
                              {script.confidence}%
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Translation Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-cyan-500" />
                        Translation
                      </CardTitle>
                      {!showTranslation && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTranslate}
                          disabled={isTranslating}
                          className="text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10"
                        >
                          <ArrowRightLeft className="h-3 w-3 mr-1.5" />
                          Translate to English
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Original Text */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        Original ({ocrResult.detectedLanguage})
                      </p>
                      <div className="border rounded-lg p-3 bg-muted/20 text-sm">
                        {ocrResult.extractedText}
                      </div>
                    </div>

                    {/* Translated Text */}
                    <AnimatePresence>
                      {showTranslation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="flex items-center justify-center py-1">
                            <ChevronRight className="h-4 w-4 text-cyan-500 rotate-90" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                              English Translation
                            </p>
                            <div className="border rounded-lg p-3 bg-cyan-500/5 border-cyan-500/20 text-sm">
                              {isTranslating ? 'Translating…' : ocrResult.translation}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!showTranslation && (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Click &quot;Translate to English&quot; to see the translation
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Threat Analysis Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="glass">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                      Threat Analysis
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Trust Score</span>
                      <ConfidenceGauge value={ocrResult.threatAnalysis.trustScore} size={56} color={trustScoreColor} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fake News Indicators */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        Fake News Indicators
                      </p>
                      <div className="space-y-2">
                        {ocrResult.threatAnalysis.fakeNewsIndicators.map((indicator, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            className="flex items-start gap-2 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/15"
                          >
                            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                            <span className="text-sm">{indicator}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Propaganda Techniques */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-red-500" />
                        Propaganda Techniques
                      </p>
                      <div className="space-y-2">
                        {ocrResult.threatAnalysis.propagandaTechniques.map((technique, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/15"
                          >
                            <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <span className="text-sm">{technique}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Sentiment + Trust Score Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <MessageSquare className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sentiment</p>
                        <p className="text-sm font-medium">{ocrResult.threatAnalysis.sentiment}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <ShieldAlert className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Trust Score</p>
                        <p className="text-sm font-medium">{ocrResult.threatAnalysis.trustScore}/100</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="p-2 rounded-lg bg-zinc-500/10">
                        <AlertTriangle className="h-5 w-5 text-zinc-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Propaganda Count</p>
                        <p className="text-sm font-medium">
                          {ocrResult.threatAnalysis.propagandaTechniques.length} indicators found
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Flagged Keywords */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Flagged Keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ocrResult.threatAnalysis.flaggedKeywords.map((keyword, i) => (
                        <motion.div
                          key={keyword}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.6 + i * 0.08 }}
                        >
                          <Badge
                            variant="outline"
                            className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25"
                          >
                            {keyword}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!ocrResult && !isProcessing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <ScanText className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">Upload an Image to Extract Text</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload an image containing English, Hindi or Telugu Text for OCR extraction, translation, and threat analysis.
                  Then click &quot;Run OCR&quot; to extract text with the in-house engine.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* OCR History Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-500" />
              OCR Scan History
            </CardTitle>
            <CardDescription>Recent OCR extractions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead className="hidden sm:table-cell">Text Preview</TableHead>
                    <TableHead className="text-center">Trust Score</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No OCR scans recorded yet.
                      </td>
                    </tr>
                  )}
                  {history.map((item, i) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.06 }}
                      className="border-b last:border-0"
                    >
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {item.date}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] border-zinc-500/30 text-zinc-600 dark:text-zinc-400">
                          {item.language}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs truncate max-w-[200px] block">{item.textPreview}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm font-medium ${
                          item.trustScore < 40 ? 'text-red-500' :
                          item.trustScore < 60 ? 'text-yellow-500' :
                          'text-zinc-500'
                        }`}>
                          {item.trustScore}/100
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            item.status === 'completed'
                              ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25'
                              : item.status === 'processing'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
                          }
                        >
                          {item.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {item.status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {item.status === 'failed' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {item.status}
                        </Badge>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
