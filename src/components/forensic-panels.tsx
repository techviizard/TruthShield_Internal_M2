'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Layers, ScanSearch, Waves, BadgeCheck, ShieldQuestion, Eye, EyeOff,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ImageForensicsDetail, ProvenanceDetail } from '@/lib/store'

/**
 * ELA heatmap with the suspect regions drawn on the original.
 * Two views of the same evidence: the raw error-level image, and the boxes the
 * engine derived from it, so a reviewer can check the boxes against the picture
 * instead of trusting a number.
 */
export function ElaEvidence({
  forensics,
  previewUrl,
}: {
  forensics: ImageForensicsDetail
  previewUrl?: string
}) {
  const [showBoxes, setShowBoxes] = useState(true)
  const regions = forensics.elaRegions ?? []

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScanSearch className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Error Level Analysis</h4>
          <Badge variant="outline" className="text-[10px]">
            {regions.length} suspect region{regions.length === 1 ? '' : 's'}
          </Badge>
          <Button
            variant="outline" size="sm"
            className="ml-auto h-7 gap-1 text-[11px]"
            onClick={() => setShowBoxes((v) => !v)}
          >
            {showBoxes ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showBoxes ? 'Hide regions' : 'Show regions'}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border bg-muted/30">
            {previewUrl ? (
              <img src={previewUrl} alt="Submitted image" className="w-full object-contain" />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                Original preview unavailable
              </div>
            )}
            {showBoxes && regions.map((r, i) => (
              <motion.div
                key={`${r.x}-${r.y}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="absolute border-2 border-red-500/80"
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                title={`Error level ${r.intensity}% above baseline`}
              />
            ))}
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              Original {showBoxes && regions.length > 0 ? '· suspect regions' : ''}
            </span>
          </div>

          <div className="relative overflow-hidden rounded-lg border bg-black">
            <img src={forensics.elaOverlay} alt="Error level analysis heatmap" className="w-full object-contain" />
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              ELA heatmap (q90 recompression delta, ×6)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Mean delta', value: forensics.ela.meanDelta },
            { label: 'Max delta', value: forensics.ela.maxDelta },
            { label: 'Suspect area', value: `${forensics.ela.suspectArea}%` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-muted/30 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="text-sm font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Bright areas resave differently from the rest of the image. Uniformly bright edges are normal;
          an isolated patch that resaves differently from everything around it is what pasted content
          looks like. Regions are flagged where a tile deviates from this image&rsquo;s own median error
          level by more than 3× the median absolute deviation — in <em>either</em> direction, since a
          patch taken from a lower-quality source resaves more smoothly than its surroundings, not less.
        </p>
      </CardContent>
    </Card>
  )
}

/** Frequency-residual and noise statistics — the synthesis-fingerprint view. */
export function SpectralEvidence({ forensics }: { forensics: ImageForensicsDetail }) {
  const s = forensics.spectral
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Synthesis &amp; sensor signals</h4>
          <Badge
            variant="outline"
            className={`ml-auto text-[10px] ${s.ganArtifactScore >= 55 ? 'border-red-500/30 text-red-600 dark:text-red-400' : ''}`}
          >
            GAN grid {s.ganArtifactScore}/100
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Peak ratio', value: s.peakRatio, hint: 'residual autocorrelation' },
            { label: 'Period', value: s.dominantPeriod ? `${s.dominantPeriod}px` : 'none', hint: 'JPEG 8px excluded' },
            { label: 'Noise inconsistency', value: `${forensics.noise.inconsistencyScore}/100`, hint: 'per-tile variance' },
            { label: 'Edge density', value: `${forensics.edges.edgePct}%`, hint: 'fine detail present' },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border bg-muted/30 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
              <div className="text-sm font-semibold tabular-nums">{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.hint}</div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">{s.explanation}</p>
      </CardContent>
    </Card>
  )
}

const STATUS_TONE: Record<string, string> = {
  clean: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
  suspicious: 'border-red-500/30 text-red-600 dark:text-red-400',
  warning: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
  info: 'text-muted-foreground',
}

/** Content Credentials / EXIF provenance panel. */
export function ProvenancePanel({ provenance }: { provenance: ProvenanceDetail }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {provenance.c2paPresent
            ? <BadgeCheck className="h-4 w-4 text-sky-500" />
            : <ShieldQuestion className="h-4 w-4 text-muted-foreground" />}
          <h4 className="text-sm font-semibold">Content provenance</h4>
          {provenance.c2paPresent && (
            <Badge variant="outline" className="border-sky-500/30 text-[10px] text-sky-600 dark:text-sky-400">
              C2PA manifest · unverified
            </Badge>
          )}
          {provenance.generatorHints.length > 0 && (
            <Badge variant="outline" className="border-red-500/30 text-[10px] text-red-600 dark:text-red-400">
              generator declared
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{provenance.summary}</p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <tbody>
              {provenance.fields.map((f) => (
                <tr key={f.field} className="border-b last:border-0">
                  <td className="w-40 px-2 py-1.5 text-muted-foreground">{f.field}</td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{f.value}</span>
                    {f.note && <span className="ml-2 text-[10px] text-muted-foreground">{f.note}</span>}
                  </td>
                  <td className="w-20 px-2 py-1.5 text-right">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[f.status] ?? ''}`}>
                      {f.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {provenance.c2paPresent && (
          <p className="text-[10px] text-muted-foreground">
            A manifest being present is not the same as a manifest being valid. This build detects the
            manifest box but does not validate its signature chain, so the contents are treated as
            self-reported.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Weight-table attribution for the image score. */
export function ForensicContribution({ forensics }: { forensics: ImageForensicsDetail }) {
  const signals = forensics.signals ?? []
  if (!signals.length) {
    return (
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="h-4 w-4 text-muted-foreground" /> Why this score
          </span>
          {forensics.explanation}
        </CardContent>
      </Card>
    )
  }
  const max = Math.max(...signals.map((s) => Math.abs(s.contribution)), 1)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Why this score</h4>
          <Badge variant="outline" className="ml-auto text-[10px]">
            forensic score {forensics.manipulationScore}/100
          </Badge>
        </div>
        {signals.map((s, i) => {
          const positive = s.contribution >= 0
          return (
            <div key={s.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span>{s.label}</span>
                <span className={`tabular-nums font-semibold ${positive ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {positive ? '+' : ''}{s.contribution}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.abs(s.contribution) / max) * 100}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className={`h-full ${positive ? 'bg-red-500/70' : 'bg-emerald-500/70'}`}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{s.detail}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
