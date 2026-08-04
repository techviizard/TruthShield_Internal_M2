'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TrustScoreGauge } from '@/components/trust-score-gauge'
import { useAppStore, type RiskLevel } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, AlertTriangle, Brain, Heart, Link, Shield,
  CheckCircle, XCircle, MessageSquare, Loader2, RotateCcw,
  ThumbsDown, ThumbsUp, Zap, Eye, Languages,
} from 'lucide-react'
import { ExportButton } from '@/components/export-button'
import { KnownHoaxMatches, ScoreContribution, DetectorAgreement } from '@/components/evidence-panels'
import { detectScript } from '@/lib/engines/text-heuristics'

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

const riskBadgeClass: Record<RiskLevel, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25',
  low: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
}

const flagIcons: Record<string, React.ReactNode> = {
  AlertTriangle: <AlertTriangle className="h-4 w-4 text-red-500" />,
  Brain: <Brain className="h-4 w-4 text-purple-500" />,
  Heart: <Heart className="h-4 w-4 text-pink-500" />,
  Link: <Link className="h-4 w-4 text-blue-500" />,
  Shield: <Shield className="h-4 w-4 text-zinc-500" />,
  Eye: <Eye className="h-4 w-4 text-yellow-500" />,
}

/** Script → analysis language. Only scripts with a single dominant language map. */
const SCRIPT_TO_LANGUAGE: Record<string, string> = {
  devanagari: 'hi',
  gujarati: 'gu',
  tamil: 'ta',
  bengali: 'bn',
  telugu: 'te',
}

export function TextAnalysisTab() {
  const {
    textInput, setTextInput, selectedLanguage, setSelectedLanguage,
    textLoading, textResult, analyzeText, resetTextResult,
  } = useAppStore()
  const t = useTranslations('textAnalysis')
  const [autoDetected, setAutoDetected] = useState<{ script: string; language: string } | null>(null)

  /**
   * Detect the script as the analyst types and switch the analysis language to
   * match. Devanagari pasted while the selector says English would otherwise be
   * analysed under the wrong language prompt — the most likely way to get a bad
   * verdict on Indic content.
   *
   * Only fires while the selector is still on the default, so it never overrides
   * a language the analyst chose deliberately.
   */
  const handleInput = (value: string) => {
    setTextInput(value)
    if (value.trim().length < 12) {
      setAutoDetected(null)
      return
    }
    const script = detectScript(value)
    const mapped = SCRIPT_TO_LANGUAGE[script]
    if (mapped && selectedLanguage === 'en' && mapped !== selectedLanguage) {
      setSelectedLanguage(mapped)
      setAutoDetected({ script, language: mapped })
    } else if (!mapped || script === 'latin') {
      setAutoDetected(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-zinc-500" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste the text content you want to analyze for misinformation, propaganda, or fake news..."
              className="min-h-[180px] resize-y text-sm"
              value={textInput}
              onChange={(e) => handleInput(e.target.value)}
            />
            {autoDetected && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <Languages className="h-3.5 w-3.5" />
                {t('scriptDetected', {
                  script: autoDetected.script,
                  language: languages.find((l) => l.value === autoDetected.language)?.label ?? autoDetected.language,
                })}
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  onClick={analyzeText}
                  disabled={textLoading || !textInput.trim()}
                  className="bg-zinc-600 hover:bg-zinc-700 text-white"
                >
                  {textLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('analyzing')}
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      {t('analyze')}
                    </>
                  )}
                </Button>
                {textResult && (
                  <>
                    <ExportButton
                      data={textResult as unknown as Record<string, unknown>}
                      filename={`truthshield-text-${Date.now()}`}
                      size="sm"
                    />
                    <Button variant="outline" onClick={resetTextResult}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t('reset')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading State */}
      {textLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-zinc-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Search className="h-5 w-5 text-zinc-700" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Analyzing Content...</p>
                  <p className="text-sm text-muted-foreground">Running NLP models, checking facts, and detecting patterns</p>
                </div>
                <div className="w-full max-w-md space-y-2">
                  <Progress value={45} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">Processing linguistic features...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {textResult && !textLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Registry hit first — the cheapest and strongest piece of evidence */}
            <KnownHoaxMatches matches={textResult.knownHoaxMatches ?? []} />

            {/* Top Results Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Trust Score */}
              <Card className="flex flex-col items-center justify-center p-6">
                <TrustScoreGauge score={textResult.trustScore} size={160} />
                <Badge
                  variant="outline"
                  className={`mt-3 ${riskBadgeClass[textResult.riskLevel] || riskBadgeClass.medium} ${textResult.riskLevel === 'critical' ? 'animate-shake' : ''}`}
                >
                  Risk: {(textResult.riskLevel || 'medium').charAt(0).toUpperCase() + (textResult.riskLevel || 'medium').slice(1)}
                </Badge>
              </Card>

              {/* Confidence & Sentiment */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Confidence & Sentiment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Analysis Confidence</span>
                      <span className="font-medium">{textResult.confidence}%</span>
                    </div>
                    <Progress value={textResult.confidence} className="h-2" />
                  </div>
                  <Separator />
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Sentiment</span>
                      <Badge variant="outline" className="text-xs animate-pulse-dot">{textResult.sentiment.label}</Badge>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Sentiment Score</span>
                      <span className="font-medium">{(textResult.sentiment.score * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={textResult.sentiment.score * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Flags */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Flags Detected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {textResult.flags.map((flag, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.3 }}
                        className="flex items-start gap-2"
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{flagIcons[flag.icon] || <AlertTriangle className="h-4 w-4 text-red-500" />}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Flag type: {flag.type.replace(/_/g, ' ')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div>
                          <p className="text-sm font-medium">{flag.type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">{flag.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Explanation */}
            <Card className="bg-gradient-to-br from-muted/20 via-background to-muted/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-zinc-500" />
                  Detailed Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{textResult.explanation}</p>
              </CardContent>
            </Card>

            {/* Signal attribution + how the two detectors compare */}
            {textResult.detectorBreakdown && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ScoreContribution
                  signals={textResult.detectorBreakdown.heuristic.signals}
                  script={textResult.detectorBreakdown.heuristic.script}
                  explanation={textResult.detectorBreakdown.heuristic.explanation}
                />
                <DetectorAgreement breakdown={textResult.detectorBreakdown} />
              </div>
            )}

            {/* Claims & Propaganda */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Detected Claims
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {textResult.detectedClaims.map((claim, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{claim}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    Propaganda Indicators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {textResult.propagandaIndicators.map((indicator, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        <ThumbsDown className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{indicator}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-zinc-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {textResult.recommendations.map((rec, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-2"
                    >
                      <ThumbsUp className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
                      <p className="text-sm">{rec}</p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!textResult && !textLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-full bg-zinc-500/10">
                <Search className="h-10 w-10 text-zinc-500" />
              </div>
              <div>
                <p className="text-lg font-medium">Ready to Analyze</p>
                <p className="text-sm text-muted-foreground mt-1">Paste any text content above and click Analyze to detect misinformation, propaganda, and fake news</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
