/**
 * Fuses the in-house image forensics signals into one score with attribution.
 *
 * Every signal contributes a visible number of points from a fixed weight table,
 * so the final score can be read backwards: "35/100 because ELA localised two
 * spliced regions and the metadata names Photoshop". The language model, when
 * available, is treated as one more opinion layered on top - not as the source
 * of truth that the other signals decorate.
 */

import {
  errorLevelAnalysis, noiseInconsistency, edgeDensity, elaRegions, spectralArtifacts,
  type ElaRegion,
} from '@/lib/engines/image-forensics'
import { readProvenance, type ProvenanceResult } from '@/lib/engines/provenance'

export interface ForensicSignal {
  id: string
  label: string
  /** Points added to the manipulation score (0..100 scale). */
  contribution: number
  detail: string
}

export interface ImageForensicVerdict {
  /** 0..100, higher = more evidence of manipulation or synthesis. */
  manipulationScore: number
  trustScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  signals: ForensicSignal[]
  elaOverlay: string
  elaRegions: ElaRegion[]
  ela: { meanDelta: number; maxDelta: number; suspectArea: number }
  noise: { globalStd: number; tileStdMean: number; tileStdVariance: number; inconsistencyScore: number }
  edges: { edgePct: number; aiSuspicion: number }
  spectral: { ganArtifactScore: number; peakRatio: number; dominantPeriod: number | null; explanation: string }
  provenance: ProvenanceResult
  explanation: string
}

/**
 * Run every in-house pass. Needs no network and no API key, so this is what the
 * offline mode and the degraded path both serve.
 */
export async function analyzeImageForensics(buffer: Buffer): Promise<ImageForensicVerdict> {
  const [ela, regions, noise, edges, spectral, provenance] = await Promise.all([
    errorLevelAnalysis(buffer),
    elaRegions(buffer),
    noiseInconsistency(buffer),
    edgeDensity(buffer),
    spectralArtifacts(buffer),
    readProvenance(buffer),
  ])

  const signals: ForensicSignal[] = []

  // Localised ELA clusters are the strongest single splicing indicator.
  const strongRegions = regions.regions.filter((r) => r.intensity >= 30)
  if (strongRegions.length >= 2) {
    // A lone outlier tile is noise; a cluster is a region. Scale with cluster
    // size but cap it, since ELA localises *where* to look rather than proving
    // manipulation on its own.
    signals.push({
      id: 'ela_regions',
      label: 'Localised recompression anomalies',
      contribution: Math.min(38, 10 + strongRegions.length * 3),
      detail: `${strongRegions.length} adjacent tile(s) deviate sharply from this image's own error-level baseline (${regions.baseline}) - the signature of content pasted in from a differently-compressed source.`,
    })
  }

  if (noise.inconsistencyScore >= 45) {
    signals.push({
      id: 'noise_inconsistency',
      label: 'Inconsistent sensor noise',
      contribution: Math.min(26, Math.round(noise.inconsistencyScore * 0.28)),
      detail: `Per-tile noise varies far more than a single sensor produces (score ${noise.inconsistencyScore}/100).`,
    })
  }

  if (spectral.ganArtifactScore > 0) {
    signals.push({
      id: 'spectral_grid',
      label: 'Synthesis grid in frequency residual',
      // Deliberately capped: without harmonic confirmation this signal cannot
      // separate a synthesis grid from ordinary periodic texture.
      contribution: Math.round(spectral.ganArtifactScore * 0.22),
      detail: spectral.explanation,
    })
  }

  if (edges.aiSuspicion > 0) {
    signals.push({
      id: 'edge_density',
      label: 'Unusually smooth fine detail',
      contribution: Math.round(edges.aiSuspicion * 0.16),
      detail: `Fine-edge density is ${edges.edgePct}% - below the range typical of camera captures, a pattern common in generated imagery.`,
    })
  }

  if (provenance.generatorHints.length) {
    signals.push({
      id: 'generator_metadata',
      label: 'Metadata declares a generative tool',
      contribution: 40,
      detail: provenance.generatorHints.join(', '),
    })
  } else if (provenance.editingSoftware) {
    signals.push({
      id: 'editor_metadata',
      label: 'Metadata names editing software',
      contribution: 16,
      detail: `${provenance.editingSoftware} wrote to this file.`,
    })
  }

  if (!provenance.hasExif) {
    signals.push({
      id: 'stripped_metadata',
      label: 'Metadata stripped',
      contribution: 8,
      detail: 'No EXIF survives. Normal for content re-shared through social platforms, so weighted lightly.',
    })
  }

  if (provenance.c2paPresent) {
    signals.push({
      id: 'c2pa_manifest',
      label: 'Content Credentials manifest present',
      contribution: -10,
      detail: 'The file carries a C2PA manifest. Signature validation is not performed in this build, so this is a partial credit only.',
    })
  }

  const raw = signals.reduce((sum, s) => sum + s.contribution, 0)
  const manipulationScore = Math.max(0, Math.min(100, raw))
  const riskLevel: ImageForensicVerdict['riskLevel'] =
    manipulationScore >= 70 ? 'critical'
      : manipulationScore >= 45 ? 'high'
        : manipulationScore >= 22 ? 'medium'
          : 'low'

  const positives = signals.filter((s) => s.contribution > 0)
  const explanation = positives.length
    ? `${positives.length} forensic signal(s) fired: ${positives.map((s) => s.label.toLowerCase()).join('; ')}.`
    : 'No in-house forensic signal fired. Error levels, sensor noise, edge statistics and the frequency residual are all within ordinary camera ranges.'

  return {
    manipulationScore,
    trustScore: 100 - manipulationScore,
    riskLevel,
    signals: signals.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    elaOverlay: ela.base64Overlay,
    elaRegions: regions.regions,
    ela: {
      meanDelta: Math.round(ela.meanDelta * 100) / 100,
      maxDelta: ela.maxDelta,
      suspectArea: Math.round(ela.suspectArea * 1000) / 10,
    },
    noise,
    edges,
    spectral,
    provenance,
    explanation,
  }
}
