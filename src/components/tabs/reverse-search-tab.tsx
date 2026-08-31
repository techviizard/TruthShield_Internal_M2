'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Upload, Link, Eye, Globe, Shield, AlertTriangle,
  CheckCircle, Loader2, ImagePlus, ExternalLink, ArrowRight,
  Sparkles, Fingerprint,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppConfig } from '@/hooks/use-app-config'

interface ReverseSearchResult {
  imageDescription: string
  visualFeatures: string[]
  searchResults: Array<{ title?: string; url?: string; snippet?: string }>
  contextAnalysis: string
  manipulationLikelihood: number
  authenticityScore: number
  similarImages: Array<{ source: string; url: string; title: string; relevance: string }>
}

type AnalysisStep = 'idle' | 'uploading' | 'describing' | 'searching' | 'analyzing' | 'complete' | 'error'

const stepLabels: Record<AnalysisStep, string> = {
  idle: 'Ready',
  uploading: 'Uploading image...',
  describing: 'Analyzing image with VLM...',
  searching: 'Searching the web for similar images...',
  analyzing: 'Analyzing search results with AI...',
  complete: 'Analysis complete',
  error: 'Analysis failed',
}


export function ReverseSearchTab() {
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<AnalysisStep>('idle')
  const [result, setResult] = useState<ReverseSearchResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [processingTime, setProcessingTime] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cfg = useAppConfig()
  const maxImageMB = cfg?.limits.maxImageUploadMB ?? 20

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > maxImageMB * 1024 * 1024) {
      toast.error(`Image must be less than ${maxImageMB}MB`)
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setImageUrl('')
    setResult(null)
    setActiveStep('idle')
  }

  const handleUrlChange = (url: string) => {
    setImageUrl(url)
    if (url) {
      setImagePreview(url)
      setImageFile(null)
    } else {
      setImagePreview(null)
    }
    setResult(null)
    setActiveStep('idle')
  }

  const startAnalysis = async () => {
    if (!imageFile && !imageUrl.trim()) {
      toast.error('Please upload an image or provide an image URL')
      return
    }

    setResult(null)
    setSearchError(null)
    setActiveStep('uploading')

    try {
      // Step 1: Uploading
      await new Promise((r) => setTimeout(r, 500))
      setActiveStep('describing')

      let res: Response
      if (imageFile) {
        const formData = new FormData()
        formData.append('image', imageFile)
        res = await fetch('/api/analyze/reverse-image', {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch('/api/analyze/reverse-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: imageUrl }),
        })
      }

      if (res.ok) {
        const data = await res.json()
        setActiveStep('complete')
        setResult(data.results)
        setProcessingTime(data.processingTime || 0)
        toast.success('Reverse image search completed')
      } else {
        const err = await res.json().catch(() => ({}))
        setActiveStep('error')
        setResult(null)
        setSearchError(err.error || 'Reverse image search failed')
        toast.error('Reverse image search failed')
      }
    } catch (e) {
      setActiveStep('error')
      setResult(null)
      setSearchError(e instanceof Error ? e.message : 'Connection error')
      toast.error('Reverse image search failed')
    }
  }

  const resetSearch = () => {
    setImageUrl('')
    setImageFile(null)
    setImagePreview(null)
    setResult(null)
    setActiveStep('idle')
    setProcessingTime(0)
  }

  const progressValue = (() => {
    switch (activeStep) {
      case 'idle': return 0
      case 'uploading': return 15
      case 'describing': return 40
      case 'searching': return 65
      case 'analyzing': return 85
      case 'complete': return 100
      case 'error': return 0
      default: return 0
    }
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-zinc-500/5 hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-lg bg-zinc-500/10">
                <Search className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Reverse Image Search</h2>
                <p className="text-sm text-muted-foreground">
                  Upload an image to find its origin, detect manipulation, and verify authenticity
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1">
          <Card className="border rounded-xl hover:shadow-md transition-shadow h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload Image</CardTitle>
              <CardDescription>Provide an image to analyze</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Preview / Upload Area */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  imagePreview ? 'border-zinc-500/30 bg-zinc-500/5' : 'border-muted-foreground/25 hover:border-zinc-500/40 hover:bg-muted/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); resetSearch() }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="py-8">
                    <ImagePlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">Click to upload or drag & drop</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to {maxImageMB}MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or paste URL</span>
                </div>
              </div>

              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Button
                onClick={startAnalysis}
                disabled={activeStep === 'uploading' || activeStep === 'describing' || activeStep === 'searching' || activeStep === 'analyzing' || (!imageFile && !imageUrl.trim())}
                className="w-full gap-2 bg-zinc-600 hover:bg-zinc-700 text-white"
              >
                {activeStep !== 'idle' && activeStep !== 'complete' && activeStep !== 'error' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search Image
                  </>
                )}
              </Button>

              {activeStep !== 'idle' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stepLabels[activeStep]}</span>
                    <span className="text-muted-foreground">{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} className="h-1.5" />
                </div>
              )}

              {/* Step indicators */}
              {activeStep !== 'idle' && (
                <div className="space-y-2 pt-2">
                  {[
                    { step: 'describing', label: 'VLM Image Analysis', icon: Eye },
                    { step: 'searching', label: 'Web Search', icon: Globe },
                    { step: 'analyzing', label: 'AI Context Analysis', icon: Sparkles },
                  ].map(({ step, label, icon: StepIcon }) => {
                    const stepOrder = ['uploading', 'describing', 'searching', 'analyzing', 'complete']
                    const currentIdx = stepOrder.indexOf(activeStep)
                    const thisIdx = stepOrder.indexOf(step)
                    const isComplete = currentIdx > thisIdx || activeStep === 'complete'
                    const isCurrent = activeStep === step

                    return (
                      <div key={step} className={`flex items-center gap-2 text-xs ${isCurrent ? 'text-zinc-600 dark:text-zinc-400' : isComplete ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                        {isComplete ? <CheckCircle className="h-3.5 w-3.5" /> : isCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StepIcon className="h-3.5 w-3.5" />}
                        <span>{label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Panel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          {result ? (
            <ResultsDisplay result={result} processingTime={processingTime} />
          ) : searchError ? (
            <Card className="border rounded-xl border-red-500/30 h-full">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 rounded-full bg-red-500/10 mb-4">
                  <Search className="h-10 w-10 text-red-500" />
                </div>
                <h3 className="text-lg font-medium mb-2">Search failed</h3>
                <p className="text-sm text-muted-foreground max-w-md">{searchError}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Check the AI provider key and web-search settings in your configuration, then retry.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border rounded-xl hover:shadow-md transition-shadow h-full">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 rounded-full bg-muted/30 mb-4">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Ready to Search</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Upload an image or paste a URL to start the reverse image search. Our AI will describe the image, search the web for similar images, and analyze the results for authenticity.
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function ResultsDisplay({ result, processingTime }: { result: ReverseSearchResult; processingTime: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-zinc-500'
    if (score >= 40) return 'text-amber-500'
    return 'text-red-500'
  }

  const getManipulationColor = (score: number) => {
    if (score <= 30) return 'text-zinc-500'
    if (score <= 60) return 'text-amber-500'
    return 'text-red-500'
  }

  return (
    <div className="space-y-4">
      {/* Trust Score & Manipulation Assessment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border rounded-xl bg-gradient-to-br from-zinc-500/5 to-zinc-500/5 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium">Authenticity Score</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${getScoreColor(result.authenticityScore)}`}>
                  {result.authenticityScore}
                </span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
              <Progress value={result.authenticityScore} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {result.authenticityScore >= 70 ? 'Image appears authentic' :
                 result.authenticityScore >= 40 ? 'Image may have modifications' :
                 'Image likely manipulated or AI-generated'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Card className="border rounded-xl bg-gradient-to-br from-red-500/5 to-orange-500/5 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Fingerprint className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Manipulation Likelihood</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${getManipulationColor(result.manipulationLikelihood)}`}>
                  {result.manipulationLikelihood}%
                </span>
              </div>
              <Progress value={result.manipulationLikelihood} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {result.manipulationLikelihood <= 30 ? 'No significant manipulation detected' :
                 result.manipulationLikelihood <= 60 ? 'Some manipulation indicators present' :
                 'High likelihood of image manipulation'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Results Tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border rounded-xl hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <Tabs defaultValue="description">
              <TabsList className="w-full justify-start mb-4 bg-muted/30">
                <TabsTrigger value="description" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Image Description</span>
                  <span className="sm:hidden">Describe</span>
                </TabsTrigger>
                <TabsTrigger value="similar" className="gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Similar Images</span>
                  <span className="sm:hidden">Similar</span>
                </TabsTrigger>
                <TabsTrigger value="context" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Context Analysis</span>
                  <span className="sm:hidden">Context</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="description">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">AI-Generated Description</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.imageDescription}</p>
                  </div>
                  {result.visualFeatures.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Key Visual Features</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.visualFeatures.map((feature, i) => (
                          <Badge key={i} variant="outline" className="gap-1">
                            <Eye className="h-3 w-3 text-zinc-500" />
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {processingTime > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Analysis completed in {(processingTime / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="similar">
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {result.similarImages.map((img, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-500/10 shrink-0">
                          <Globe className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{img.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{img.source}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                              img.relevance === 'high' ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25' :
                              img.relevance === 'medium' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25' :
                              'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/25'
                            }`}>
                              {img.relevance}
                            </Badge>
                          </div>
                        </div>
                        {img.url && img.url !== '#' && (
                          <a href={img.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-zinc-500 transition-colors" />
                          </a>
                        )}
                      </div>
                    ))}
                    {result.searchResults.map((sr, i) => (
                      <div key={`sr-${i}`} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/10">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/30 shrink-0">
                          <Search className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sr.title || 'Search Result'}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sr.snippet || ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="context">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-zinc-500" />
                      Context Analysis
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.contextAnalysis}</p>
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Shield className={`h-5 w-5 ${getScoreColor(result.authenticityScore)}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">Trust Score</p>
                        <p className={`text-lg font-bold ${getScoreColor(result.authenticityScore)}`}>{result.authenticityScore}/100</p>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-5 w-5 ${getManipulationColor(result.manipulationLikelihood)}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">Manipulation Risk</p>
                        <p className={`text-lg font-bold ${getManipulationColor(result.manipulationLikelihood)}`}>{result.manipulationLikelihood}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
