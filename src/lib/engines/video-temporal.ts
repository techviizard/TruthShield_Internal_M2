/**
 * Frame-level video forensics.
 *
 * The problem statement asks for temporal and spatial artifact analysis rather
 * than a single opinion about a clip. Frames are sampled in the browser (no
 * ffmpeg dependency on the server) and analysed here one by one, then compared
 * across time — because the signature of a face-swap is not any single bad
 * frame, it is inconsistency *between* frames that a real camera would not
 * produce.
 *
 * What this measures:
 *   spatial  — per-frame ELA region clustering, noise inconsistency, synthesis grid
 *   temporal — frame-to-frame perceptual distance, and the variance of each
 *              spatial signal across the clip
 *
 * What it does not do: identity matching, landmark tracking or lip-sync scoring.
 * Those need a face model; the UI says so rather than implying otherwise.
 */

import sharp from 'sharp'
import { elaRegions, noiseInconsistency, spectralArtifacts } from '@/lib/engines/image-forensics'
import { dHash, hammingDistance } from '@/lib/engines/phash'

export interface FrameInput {
  /** Seconds into the clip. */
  timestamp: number
  buffer: Buffer
}

export interface FrameScore {
  index: number
  timestamp: number
  /** 0..100 spatial manipulation evidence for this frame alone. */
  score: number
  elaRegions: number
  noiseInconsistency: number
  ganArtifactScore: number
  /** Perceptual distance from the previous frame, 0..64. Null for the first. */
  distanceFromPrev: number | null
  /** True where the distance indicates a genuine cut rather than motion. */
  sceneChange: boolean
  flagged: boolean
  hash: string
}

export interface TemporalVerdict {
  frameCount: number
  durationCovered: number
  frames: FrameScore[]
  flaggedFrames: number[]
  sceneChanges: number[]
  /** Mean of the per-frame spatial scores. */
  meanScore: number
  /** Spread of the per-frame scores — high spread means the clip is not uniform. */
  scoreVariance: number
  /** 0..100. Higher = frames behave consistently, as a single capture should. */
  temporalConsistency: number
  /** 0..100 overall, combining the spatial mean with temporal inconsistency. */
  manipulationScore: number
  signals: { id: string; label: string; contribution: number; detail: string }[]
  explanation: string
}

/** A cut produces a large perceptual jump; ordinary motion does not. */
const SCENE_CHANGE_DISTANCE = 22
const FRAME_FLAG_SCORE = 45

async function scoreFrame(buffer: Buffer): Promise<{
  score: number; elaRegions: number; noiseInconsistency: number; ganArtifactScore: number
}> {
  const [regions, noise, spectral] = await Promise.all([
    elaRegions(buffer, 12),
    noiseInconsistency(buffer),
    spectralArtifacts(buffer),
  ])

  const strongRegions = regions.regions.filter((r) => r.intensity >= 30).length
  const elaPoints = strongRegions >= 2 ? Math.min(34, 8 + strongRegions * 3) : 0
  const noisePoints = noise.inconsistencyScore >= 45 ? Math.min(24, Math.round(noise.inconsistencyScore * 0.26)) : 0
  const ganPoints = Math.round(spectral.ganArtifactScore * 0.2)

  return {
    score: Math.min(100, elaPoints + noisePoints + ganPoints),
    elaRegions: strongRegions,
    noiseInconsistency: noise.inconsistencyScore,
    ganArtifactScore: spectral.ganArtifactScore,
  }
}

export async function analyzeFrames(frames: FrameInput[]): Promise<TemporalVerdict> {
  if (!frames.length) {
    throw new Error('No frames supplied')
  }

  const ordered = [...frames].sort((a, b) => a.timestamp - b.timestamp)
  const scored: FrameScore[] = []
  let prevHash: string | null = null

  for (const [index, frame] of ordered.entries()) {
    // Normalise size so per-frame statistics are comparable across the clip and
    // so a high-resolution clip does not cost proportionally more to analyse.
    const normalised = await sharp(frame.buffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer()

    const [spatial, hash] = await Promise.all([scoreFrame(normalised), dHash(normalised)])
    const distance = prevHash ? hammingDistance(prevHash, hash) : null

    scored.push({
      index,
      timestamp: Math.round(frame.timestamp * 100) / 100,
      score: spatial.score,
      elaRegions: spatial.elaRegions,
      noiseInconsistency: spatial.noiseInconsistency,
      ganArtifactScore: spatial.ganArtifactScore,
      distanceFromPrev: distance,
      sceneChange: distance !== null && distance >= SCENE_CHANGE_DISTANCE,
      flagged: spatial.score >= FRAME_FLAG_SCORE,
      hash,
    })
    prevHash = hash
  }

  const scores = scored.map((f) => f.score)
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((a, s) => a + (s - meanScore) ** 2, 0) / scores.length
  const sd = Math.sqrt(variance)

  // Noise level should be near-constant within one capture; drift across frames
  // is what re-rendered or composited regions produce.
  const noiseValues = scored.map((f) => f.noiseInconsistency)
  const noiseMean = noiseValues.reduce((a, b) => a + b, 0) / noiseValues.length
  const noiseSd = Math.sqrt(
    noiseValues.reduce((a, v) => a + (v - noiseMean) ** 2, 0) / noiseValues.length
  )

  // Judge continuity only across frames that are not cuts — a cut is expected to
  // look different and must not be counted as manipulation evidence.
  const continuous = scored.filter((f) => f.distanceFromPrev !== null && !f.sceneChange)
  const meanDistance = continuous.length
    ? continuous.reduce((a, f) => a + (f.distanceFromPrev ?? 0), 0) / continuous.length
    : 0
  const temporalConsistency = Math.max(0, Math.min(100, Math.round(100 - meanDistance * 4 - sd)))

  const signals: TemporalVerdict['signals'] = []
  const flagged = scored.filter((f) => f.flagged)

  if (flagged.length) {
    signals.push({
      id: 'flagged_frames',
      label: 'Frames with spatial manipulation evidence',
      contribution: Math.min(38, 10 + flagged.length * 5),
      detail: `${flagged.length} of ${scored.length} sampled frames scored at or above ${FRAME_FLAG_SCORE}/100 on error-level, noise and frequency checks.`,
    })
  }

  if (sd >= 18) {
    signals.push({
      id: 'score_instability',
      label: 'Forensic scores swing across the clip',
      contribution: Math.min(24, Math.round(sd * 0.8)),
      detail: `Per-frame scores vary by ±${Math.round(sd)} points. A single unedited capture normally scores consistently.`,
    })
  }

  if (noiseSd >= 15) {
    signals.push({
      id: 'noise_drift',
      label: 'Sensor-noise character changes over time',
      contribution: Math.min(22, Math.round(noiseSd * 0.7)),
      detail: `Noise inconsistency drifts by ±${Math.round(noiseSd)} across frames, which one sensor recording continuously does not do.`,
    })
  }

  if (temporalConsistency < 55 && continuous.length >= 2) {
    signals.push({
      id: 'temporal_discontinuity',
      label: 'Frame-to-frame discontinuity',
      contribution: Math.min(20, Math.round((55 - temporalConsistency) * 0.5)),
      detail: `Consecutive non-cut frames differ more than smooth motion explains (continuity ${temporalConsistency}/100).`,
    })
  }

  const manipulationScore = Math.max(
    0,
    Math.min(100, Math.round(meanScore * 0.5 + signals.reduce((a, s) => a + s.contribution, 0) * 0.6))
  )

  const explanation = signals.length
    ? `${scored.length} frames sampled. ${signals.map((s) => s.label.toLowerCase()).join('; ')}.`
    : `${scored.length} frames sampled. Error levels, sensor noise and frequency residuals stay consistent across the clip, and no frame showed localised manipulation evidence.`

  return {
    frameCount: scored.length,
    durationCovered: Math.round((ordered[ordered.length - 1].timestamp - ordered[0].timestamp) * 100) / 100,
    frames: scored,
    flaggedFrames: flagged.map((f) => f.index),
    sceneChanges: scored.filter((f) => f.sceneChange).map((f) => f.index),
    meanScore: Math.round(meanScore * 10) / 10,
    scoreVariance: Math.round(variance * 10) / 10,
    temporalConsistency,
    manipulationScore,
    signals: signals.sort((a, b) => b.contribution - a.contribution),
    explanation,
  }
}
