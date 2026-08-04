'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useAppStore, type Verdict } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, CheckCircle, XCircle, AlertCircle, HelpCircle, Loader2,
  ExternalLink, Shield, Star, Globe, RotateCcw, Brain, Tags, Zap,
} from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { KnownHoaxMatches, StanceSummary } from '@/components/evidence-panels'

const verdictConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  true: { icon: <CheckCircle className="h-8 w-8" />, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20', label: 'TRUE' },
  false: { icon: <XCircle className="h-8 w-8" />, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', label: 'FALSE' },
  misleading: { icon: <AlertCircle className="h-8 w-8" />, color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20', label: 'MISLEADING' },
  unverified: { icon: <HelpCircle className="h-8 w-8" />, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'UNVERIFIED' },
  partially_true: { icon: <AlertCircle className="h-8 w-8" />, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', label: 'PARTIALLY TRUE' },
}

const languages = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ta', label: 'Tamil' },
  { value: 'bn', label: 'Bengali' },
  { value: 'mr', label: 'Marathi' },
  { value: 'te', label: 'Telugu' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ur', label: 'Urdu' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'kn', label: 'Kannada' },
]

const loadingStages = [
  'Searching fact-check databases...',
  'Cross-referencing trusted sources...',
  'Analyzing claim with AI...',
  'Compiling verdict and evidence...',
]

const stanceBadgeClass: Record<string, string> = {
  supports: 'bg-green-500/10 text-green-600 border-green-500/30',
  refutes: 'bg-red-500/10 text-red-600 border-red-500/30',
  mixed: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  unrelated: 'bg-muted text-muted-foreground',
}

export function FactCheckTab() {
  const { factCheckLoading, factCheckResult, factCheckError, verifyFact, resetFactCheckResult } = useAppStore()
  const [claim, setClaim] = useState('')
  const [language, setLanguage] = useState('en')
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!factCheckLoading) {
      setStage(0)
      return
    }
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, loadingStages.length - 1))
    }, 4000)
    return () => clearInterval(timer)
  }, [factCheckLoading])

  const handleVerify = () => {
    if (!claim.trim()) return
    verifyFact(claim, language)
  }

  const handleReset = () => {
    resetFactCheckResult()
    setClaim('')
  }

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-zinc-500" />
              Fact Check
            </CardTitle>
            <CardDescription>Enter a claim to verify against trusted fact-checking sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Enter a claim to verify (e.g., '5G networks cause health problems')"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleVerify}
                disabled={factCheckLoading || !claim.trim()}
                className="bg-zinc-600 hover:bg-zinc-700 text-white"
              >
                {factCheckLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Verify Claim
                  </>
                )}
              </Button>
              {factCheckResult && (
                <>
                  <ExportButton
                    data={factCheckResult as unknown as Record<string, unknown>}
                    filename={`truthshield-factcheck-${Date.now()}`}
                    size="sm"
                  />
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading */}
      {factCheckLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-zinc-500" />
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Verifying Claim...</p>
                  <p className="text-sm text-muted-foreground">{loadingStages[stage]}</p>
                </div>
                <Progress value={((stage + 1) / (loadingStages.length + 1)) * 100} className="h-2 w-full max-w-md" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Error State */}
      {factCheckError && !factCheckLoading && !factCheckResult && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-2 border-red-500/20 bg-red-500/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-3">
              <XCircle className="h-10 w-10 text-red-500" />
              <div>
                <p className="text-lg font-medium">Fact Check Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{factCheckError}</p>
              </div>
              <Button variant="outline" onClick={handleVerify} disabled={!claim.trim()}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {factCheckResult && !factCheckLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Verdict */}
            <Card className={`border-2 ${(verdictConfig[factCheckResult.verdict] || verdictConfig.unverified).bg}`}>
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-4">
                  <div className={(verdictConfig[factCheckResult.verdict] || verdictConfig.unverified).color}>
                    {(verdictConfig[factCheckResult.verdict] || verdictConfig.unverified).icon}
                  </div>
                  <div className="text-center">
                    <Badge className={`text-lg px-4 py-1 ${(verdictConfig[factCheckResult.verdict] || verdictConfig.unverified).color} ${(verdictConfig[factCheckResult.verdict] || verdictConfig.unverified).bg} border-0`}>
                      {(verdictConfig[factCheckResult.verdict] || verdictConfig.unverified).label}
                    </Badge>
                    <div className="mt-3">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <p className="text-2xl font-bold">{factCheckResult.confidence}%</p>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {factCheckResult.cached && (
                        <Badge variant="outline" className="text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          Cached result
                        </Badge>
                      )}
                      {factCheckResult.degraded && (
                        <Badge variant="outline" className="border-amber-500/40 text-xs text-amber-600 dark:text-amber-400">
                          Offline verdict — stance + hoax registry only
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <KnownHoaxMatches matches={factCheckResult.knownHoaxMatches ?? []} />
            <StanceSummary rollup={factCheckResult.stanceRollup} />

            {/* Evidence Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-zinc-500" />
                  Evidence Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{factCheckResult.evidenceSummary}</p>
              </CardContent>
            </Card>

            {/* Claim Analysis */}
            {factCheckResult.claimAnalysis && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tags className="h-4 w-4 text-purple-500" />
                    Claim Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {factCheckResult.claimAnalysis.claimType && (
                      <Badge variant="secondary">Type: {factCheckResult.claimAnalysis.claimType.replace(/_/g, ' ')}</Badge>
                    )}
                    {factCheckResult.claimAnalysis.verifiability && (
                      <Badge variant="secondary">Verifiability: {factCheckResult.claimAnalysis.verifiability.replace(/_/g, ' ')}</Badge>
                    )}
                  </div>
                  {(factCheckResult.claimAnalysis.logicalFallacies?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Logical Fallacies Detected</p>
                      <div className="flex flex-wrap gap-1.5">
                        {factCheckResult.claimAnalysis.logicalFallacies!.map((f, i) => (
                          <Badge key={i} variant="outline" className="text-xs text-orange-600 border-orange-500/30">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(factCheckResult.claimAnalysis.keyEntities?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Key Entities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {factCheckResult.claimAnalysis.keyEntities!.map((e, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{e}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reasoning */}
            {factCheckResult.reasoning && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4 text-cyan-500" />
                    Step-by-Step Reasoning
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{factCheckResult.reasoning}</p>
                </CardContent>
              </Card>
            )}

            {/* Matching Fact Checks */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  Matching Fact Checks
                </CardTitle>
                <CardDescription>Results from trusted fact-checking organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {factCheckResult.matchingFactChecks.map((fc, i) => (
                    <div key={i} className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fc.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{fc.source}</Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${(fc.stance && stanceBadgeClass[fc.stance]) || 'bg-muted text-muted-foreground'}`}
                          >
                            {fc.rating}
                          </Badge>
                        </div>
                      </div>
                      <a href={fc.url} target="_blank" rel="noopener noreferrer" className="shrink-0 ml-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-zinc-500 transition-colors" />
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Source Credibility */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Source Credibility Ratings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {factCheckResult.sourceCredibility.map((src, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{src.source}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{src.type}</Badge>
                        </div>
                        <span className="font-medium">{src.rating}%</span>
                      </div>
                      <Progress value={src.rating} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!factCheckResult && !factCheckLoading && !factCheckError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <Search className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">Enter a Claim to Verify</p>
                <p className="text-sm text-muted-foreground mt-1">Type any claim above and we will verify it against multiple trusted fact-checking sources</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
