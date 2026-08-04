/**
 * Detection-quality metrics engine.
 *
 * Pure functions over (label, score) pairs — no I/O, no model calls — so the
 * same code computes metrics for a batch run, for a threshold the analyst drags
 * in the UI, and for any future modality.
 *
 * Convention: label 1 = the positive class (content that SHOULD be flagged),
 * score = the detector's 0..100 suspicion score for that sample. A sample is
 * predicted positive when score >= threshold.
 */

export interface ScoredSample {
  /** 1 = genuinely deceptive/manipulated, 0 = genuine. */
  label: 0 | 1
  /** Detector suspicion score, 0..100. */
  score: number
  language?: string
  modality?: string
}

export interface ConfusionMatrix {
  tp: number
  fp: number
  tn: number
  fn: number
}

export interface ClassificationMetrics extends ConfusionMatrix {
  threshold: number
  total: number
  accuracy: number
  precision: number
  recall: number          // = true positive rate = sensitivity
  specificity: number
  f1: number
  falsePositiveRate: number
  falseNegativeRate: number
  /** Matthews correlation coefficient — honest on imbalanced sets. */
  mcc: number
}

export function confusionAt(samples: ScoredSample[], threshold: number): ConfusionMatrix {
  let tp = 0, fp = 0, tn = 0, fn = 0
  for (const s of samples) {
    const predicted = s.score >= threshold
    if (s.label === 1) {
      if (predicted) tp++
      else fn++
    } else if (predicted) {
      fp++
    } else {
      tn++
    }
  }
  return { tp, fp, tn, fn }
}

const div = (n: number, d: number) => (d === 0 ? 0 : n / d)

export function metricsAt(samples: ScoredSample[], threshold: number): ClassificationMetrics {
  const { tp, fp, tn, fn } = confusionAt(samples, threshold)
  const total = tp + fp + tn + fn
  const precision = div(tp, tp + fp)
  const recall = div(tp, tp + fn)
  const specificity = div(tn, tn + fp)
  const mccDen = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
  return {
    threshold,
    total,
    tp, fp, tn, fn,
    accuracy: div(tp + tn, total),
    precision,
    recall,
    specificity,
    f1: div(2 * precision * recall, precision + recall),
    falsePositiveRate: div(fp, fp + tn),
    falseNegativeRate: div(fn, fn + tp),
    mcc: mccDen === 0 ? 0 : (tp * tn - fp * fn) / mccDen,
  }
}

export interface CurvePoint {
  threshold: number
  fpr: number
  tpr: number
  precision: number
  recall: number
}

/** ROC + PR curve over every threshold from 0 to 100 in `step` increments. */
export function curves(samples: ScoredSample[], step = 2): CurvePoint[] {
  const points: CurvePoint[] = []
  for (let t = 0; t <= 100 + step; t += step) {
    const m = metricsAt(samples, Math.min(t, 101))
    points.push({
      threshold: Math.min(t, 101),
      fpr: m.falsePositiveRate,
      tpr: m.recall,
      // Precision is undefined with no positive predictions; carry the previous
      // value so the PR curve does not drop to zero at the high-threshold end.
      precision: m.tp + m.fp === 0 ? (points[points.length - 1]?.precision ?? 1) : m.precision,
      recall: m.recall,
    })
  }
  return points
}

/**
 * AUC by the rank method (equivalent to the Mann-Whitney U statistic), which
 * handles ties correctly instead of approximating the ROC polygon.
 */
export function rocAuc(samples: ScoredSample[]): number {
  const pos = samples.filter((s) => s.label === 1)
  const neg = samples.filter((s) => s.label === 0)
  if (!pos.length || !neg.length) return 0

  const sorted = [...samples].sort((a, b) => a.score - b.score)
  const ranks = new Map<number, number>()
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1].score === sorted[i].score) j++
    const avgRank = (i + j) / 2 + 1 // 1-based, averaged across the tie group
    for (let k = i; k <= j; k++) ranks.set(k, avgRank)
    i = j + 1
  }
  let rankSumPos = 0
  sorted.forEach((s, idx) => { if (s.label === 1) rankSumPos += ranks.get(idx)! })
  return (rankSumPos - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length)
}

export interface CalibrationBin {
  bucket: string
  meanScore: number
  observedRate: number
  count: number
}

/**
 * Reliability curve: within each score band, how often was the sample actually
 * positive? A calibrated detector tracks the diagonal — a score of 80 should be
 * wrong about one time in five.
 */
export function calibration(samples: ScoredSample[], bins = 10): CalibrationBin[] {
  const width = 100 / bins
  const out: CalibrationBin[] = []
  for (let b = 0; b < bins; b++) {
    const lo = b * width
    const hi = lo + width
    const inBin = samples.filter((s) => s.score >= lo && (b === bins - 1 ? s.score <= hi : s.score < hi))
    out.push({
      bucket: `${Math.round(lo)}–${Math.round(hi)}`,
      meanScore: inBin.length ? inBin.reduce((a, s) => a + s.score, 0) / inBin.length : lo + width / 2,
      observedRate: inBin.length ? inBin.filter((s) => s.label === 1).length / inBin.length : 0,
      count: inBin.length,
    })
  }
  return out
}

/** Expected calibration error — the count-weighted gap from the diagonal. */
export function expectedCalibrationError(samples: ScoredSample[], bins = 10): number {
  const cal = calibration(samples, bins)
  const n = samples.length || 1
  return cal.reduce((acc, b) => acc + (b.count / n) * Math.abs(b.meanScore / 100 - b.observedRate), 0)
}

/** Threshold that maximises F1 — the operating point the tuner defaults to. */
export function bestF1Threshold(samples: ScoredSample[], step = 1): ClassificationMetrics {
  let best = metricsAt(samples, 50)
  for (let t = 0; t <= 100; t += step) {
    const m = metricsAt(samples, t)
    if (m.f1 > best.f1) best = m
  }
  return best
}

/**
 * Lowest threshold whose false-positive rate stays within `maxFpr`.
 * This is the operating point that matters for a police deployment: the cost of
 * wrongly flagging genuine content is not symmetric with missing a fake.
 */
export function thresholdForMaxFpr(samples: ScoredSample[], maxFpr: number, step = 1): ClassificationMetrics {
  let chosen = metricsAt(samples, 100)
  for (let t = 100; t >= 0; t -= step) {
    const m = metricsAt(samples, t)
    if (m.falsePositiveRate <= maxFpr) chosen = m
    else break
  }
  return chosen
}

export interface SliceMetrics extends ClassificationMetrics {
  slice: string
}

/** Per-language / per-modality breakdown at a fixed threshold. */
export function sliceBy(
  samples: ScoredSample[],
  key: 'language' | 'modality',
  threshold: number
): SliceMetrics[] {
  const groups = new Map<string, ScoredSample[]>()
  for (const s of samples) {
    const k = s[key] ?? 'unknown'
    const list = groups.get(k)
    if (list) list.push(s)
    else groups.set(k, [s])
  }
  return [...groups.entries()]
    .map(([slice, list]) => ({ slice, ...metricsAt(list, threshold) }))
    .sort((a, b) => b.total - a.total)
}

export interface EvalSummary {
  threshold: number
  headline: ClassificationMetrics
  rocAuc: number
  ece: number
  curve: CurvePoint[]
  calibration: CalibrationBin[]
  byLanguage: SliceMetrics[]
  byModality: SliceMetrics[]
  bestF1: ClassificationMetrics
  lowFprOperatingPoint: ClassificationMetrics
}

export function summarize(samples: ScoredSample[], threshold = 50): EvalSummary {
  return {
    threshold,
    headline: metricsAt(samples, threshold),
    rocAuc: rocAuc(samples),
    ece: expectedCalibrationError(samples),
    curve: curves(samples),
    calibration: calibration(samples),
    byLanguage: sliceBy(samples, 'language', threshold),
    byModality: sliceBy(samples, 'modality', threshold),
    bestF1: bestF1Threshold(samples),
    lowFprOperatingPoint: thresholdForMaxFpr(samples, 0.05),
  }
}
