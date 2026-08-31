'use client'

import { motion } from 'framer-motion'
import {
  Repeat2, ExternalLink, Scale, ThumbsUp, ThumbsDown, Minus, HelpCircle,
  Layers, TrendingUp, TrendingDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface KnownHoaxMatchView {
  id: string
  title: string
  narrative: string
  category: string
  verdict: string
  similarity: number
  matchType: 'text' | 'image'
  debunkUrl: string | null
  debunkSource: string | null
  hitCount: number
}

/**
 * Recurring-hoax registry hits.
 * Shown above model output because "we have seen this exact narrative before"
 * is stronger and cheaper evidence than a fresh model opinion.
 */
export function KnownHoaxMatches({ matches }: { matches: KnownHoaxMatchView[] }) {
  if (!matches?.length) return null

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Repeat2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h4 className="text-sm font-semibold">Matches a recurring hoax narrative</h4>
          <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-400">
            {matches.length} match{matches.length > 1 ? 'es' : ''}
          </Badge>
        </div>
        {matches.map((m) => (
          <div key={m.id} className="rounded-lg border bg-background/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{m.title}</span>
              <Badge variant="outline" className="text-[10px] uppercase">{m.category}</Badge>
              <Badge variant="outline" className="text-[10px] uppercase">{m.verdict}</Badge>
              <span className="ml-auto text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {m.similarity}% similar
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{m.narrative}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span>Matched {m.hitCount.toLocaleString()} time(s) on this deployment</span>
              <span>· {m.matchType === 'image' ? 'perceptual-hash match' : 'semantic text match'}</span>
              {m.debunkUrl && (
                <a
                  href={m.debunkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Published debunk <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground">
          Similarity is measured against the registry&rsquo;s canonical phrasing (TF-IDF cosine blended
          with character trigrams, so translations and re-wordings still match). A match identifies the
          narrative, not the sender.
        </p>
      </CardContent>
    </Card>
  )
}

export interface SignalView {
  id: string
  label: string
  weight: number
  matches: string[]
  contribution: number
}

/**
 * Signal-level attribution for a score.
 * Answers "why this number" with the exact phrases that moved it, rather than
 * leaving the verdict as an unexplained figure.
 */
export function ScoreContribution({
  signals,
  script,
  explanation,
}: {
  signals: SignalView[]
  script?: string
  explanation?: string
}) {
  if (!signals?.length) return null
  const max = Math.max(...signals.map((s) => Math.abs(s.contribution)), 1)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Why this score</h4>
          {script && (
            <Badge variant="outline" className="text-[10px] uppercase">script: {script}</Badge>
          )}
        </div>

        <div className="space-y-2">
          {signals.map((s, i) => {
            const positive = s.contribution >= 0
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    {positive
                      ? <TrendingUp className="h-3 w-3 text-red-500" />
                      : <TrendingDown className="h-3 w-3 text-emerald-500" />}
                    {s.label}
                  </span>
                  <span className={`tabular-nums font-semibold ${positive ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {positive ? '+' : ''}{s.contribution}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.abs(s.contribution) / max) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04 }}
                    className={`h-full ${positive ? 'bg-red-500/70' : 'bg-emerald-500/70'}`}
                  />
                </div>
                {s.matches.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.matches.slice(0, 3).map((m) => (
                      <code key={m} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{m}</code>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {explanation && <p className="text-[11px] text-muted-foreground">{explanation}</p>}
        <p className="text-[10px] text-muted-foreground">
          Points come from a fixed, inspectable weight table, squashed so several weak signals cannot
          reach certainty. This detects manipulation <em>patterns</em>; it does not verify the claim.
        </p>
      </CardContent>
    </Card>
  )
}

export interface DetectorBreakdownView {
  model: { trustScore: number; label: string } | null
  heuristic: { trustScore: number; riskLevel: string; script: string; explanation: string; signals: SignalView[] }
  agreement: 'agree' | 'partial' | 'conflict' | 'model_unavailable'
  scoreGap: number | null
}

const AGREEMENT_COPY: Record<DetectorBreakdownView['agreement'], { label: string; tone: string; note: string }> = {
  agree: {
    label: 'Detectors agree',
    tone: 'text-emerald-600 dark:text-emerald-400',
    note: 'The language model and the in-house pattern detector reached a similar score independently.',
  },
  partial: {
    label: 'Partial agreement',
    tone: 'text-amber-600 dark:text-amber-400',
    note: 'The two detectors differ moderately. Read the signal list before acting on the score.',
  },
  conflict: {
    label: 'Detectors disagree',
    tone: 'text-red-600 dark:text-red-400',
    note: 'The detectors reached opposing conclusions. This item needs a human decision, not an automated one.',
  },
  model_unavailable: {
    label: 'Pattern detector only',
    tone: 'text-muted-foreground',
    note: 'The language model was unreachable, so this verdict rests entirely on lexical patterns. No claim-level reasoning was performed.',
  },
}

/**
 * Two-detector comparison. Surfacing disagreement is the point: an item both
 * detectors flag is a different kind of evidence from one only a model flagged.
 */
export function DetectorAgreement({ breakdown }: { breakdown: DetectorBreakdownView }) {
  const copy = AGREEMENT_COPY[breakdown.agreement]
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Detector agreement</h4>
          <span className={`ml-auto text-xs font-medium ${copy.tone}`}>{copy.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Language model</div>
            <div className="text-xl font-semibold tabular-nums">
              {breakdown.model ? breakdown.model.trustScore : ' - '}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {breakdown.model?.label ?? 'unavailable'}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pattern detector</div>
            <div className="text-xl font-semibold tabular-nums">{breakdown.heuristic.trustScore}</div>
            <div className="text-[10px] text-muted-foreground">in-house · lexical-heuristics-v1</div>
          </div>
        </div>

        {breakdown.scoreGap !== null && (
          <div className="text-xs text-muted-foreground">
            Trust-score gap: <span className="font-semibold tabular-nums text-foreground">{breakdown.scoreGap}</span> points
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{copy.note}</p>
      </CardContent>
    </Card>
  )
}

export interface StanceRollupView {
  support: number
  refute: number
  neutral: number
  unrelated: number
  net: number
  verdictHint: 'likely_false' | 'likely_true' | 'disputed' | 'unverified'
}

const HINT_COPY: Record<StanceRollupView['verdictHint'], { label: string; tone: string }> = {
  likely_false: { label: 'Evidence leans against the claim', tone: 'text-red-600 dark:text-red-400' },
  likely_true: { label: 'Evidence leans toward the claim', tone: 'text-emerald-600 dark:text-emerald-400' },
  disputed: { label: 'Sources disagree', tone: 'text-amber-600 dark:text-amber-400' },
  unverified: { label: 'No source takes a clear position', tone: 'text-muted-foreground' },
}

/** Aggregate stance across retrieved evidence, computed in-house. */
export function StanceSummary({ rollup }: { rollup?: StanceRollupView }) {
  if (!rollup) return null
  const decisive = rollup.support + rollup.refute
  const hint = HINT_COPY[rollup.verdictHint]
  const pos = ((rollup.net + 1) / 2) * 100

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Stance across sources</h4>
          <span className={`ml-auto text-xs font-medium ${hint.tone}`}>{hint.label}</span>
        </div>

        <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500/60 via-muted to-emerald-500/60">
          <motion.div
            initial={{ left: '50%' }}
            animate={{ left: `${pos}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow"
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>refuted</span><span>supported</span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { icon: ThumbsUp, label: 'Support', value: rollup.support },
            { icon: ThumbsDown, label: 'Refute', value: rollup.refute },
            { icon: Minus, label: 'Neutral', value: rollup.neutral },
            { icon: HelpCircle, label: 'Unrelated', value: rollup.unrelated },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-muted/30 p-2">
              <s.icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-sm font-semibold tabular-nums">{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {decisive === 0 && (
          <p className="text-[10px] text-muted-foreground">
            No retrieved source used confirming or refuting language, so the verdict rests on the
            model&rsquo;s reasoning rather than on stance evidence.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
