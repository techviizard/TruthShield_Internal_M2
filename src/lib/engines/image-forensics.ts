/**
 * In-house image forensics engine using sharp.
 * Real ELA, noise variance, edge density, pixel diff.
 * No third-party forensic API.
 */

import sharp from 'sharp'

export interface ELAResult {
  meanDelta: number          // 0..255 mean absolute pixel delta after recompression
  maxDelta: number
  suspectArea: number        // 0..1 fraction of pixels with delta > threshold
  base64Overlay: string      // PNG data URL of normalized delta heatmap
}

/**
 * Error Level Analysis: re-save JPEG at quality 90, diff against original.
 * Spliced regions show higher delta than surrounding.
 */
export async function errorLevelAnalysis(input: Buffer): Promise<ELAResult> {
  const orig = await sharp(input).removeAlpha().toFormat('jpeg', { quality: 100 }).toBuffer()
  const recompressed = await sharp(orig).jpeg({ quality: 90 }).toBuffer()

  const { data: a, info } = await sharp(orig).raw().toBuffer({ resolveWithObject: true })
  const { data: b } = await sharp(recompressed).raw().toBuffer({ resolveWithObject: true })

  const len = Math.min(a.length, b.length)
  let sum = 0, max = 0, suspect = 0
  const SUSPECT_THRESHOLD = 20
  const delta = Buffer.alloc(len)
  for (let i = 0; i < len; i++) {
    const d = Math.abs(a[i] - b[i])
    delta[i] = Math.min(255, d * 6) // amplify for visibility
    sum += d
    if (d > max) max = d
    if (d > SUSPECT_THRESHOLD) suspect++
  }
  const pixels = len / info.channels
  const overlay = await sharp(delta, {
    raw: { width: info.width, height: info.height, channels: info.channels as 1 | 2 | 3 | 4 },
  }).png().toBuffer()

  return {
    meanDelta: sum / len,
    maxDelta: max,
    suspectArea: suspect / len,
    base64Overlay: `data:image/png;base64,${overlay.toString('base64')}`,
  }
}

export interface ElaRegion {
  x: number; y: number; w: number; h: number
  /** 0..100 how far above the image's own baseline this tile's error level sits. */
  intensity: number
}

/**
 * Localise ELA anomalies into bounding boxes.
 *
 * Splicing shows up as a *cluster* of tiles whose recompression error is far
 * above the rest of the image, so the threshold is derived from the image's own
 * tile distribution (mean + 2σ) rather than a fixed constant that would fire on
 * every noisy photo.
 */
export async function elaRegions(input: Buffer, grid = 16): Promise<{
  regions: ElaRegion[]
  width: number
  height: number
  baseline: number
}> {
  // Diff the file's own pixels against a single recompression. Re-encoding at
  // q100 first would add a generation of its own and wash out the quantisation
  // history that ELA reads.
  const { data: a, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true })
  const recompressed = await sharp(input).jpeg({ quality: 90 }).toBuffer()
  const { data: b } = await sharp(recompressed).greyscale().raw().toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const tileW = Math.max(1, Math.floor(width / grid))
  const tileH = Math.max(1, Math.floor(height / grid))

  const tiles: { x: number; y: number; mean: number }[] = []
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x0 = gx * tileW, y0 = gy * tileH
      let sum = 0, n = 0
      for (let y = y0; y < Math.min(y0 + tileH, height); y++) {
        for (let x = x0; x < Math.min(x0 + tileW, width); x++) {
          const i = y * width + x
          sum += Math.abs(a[i] - b[i])
          n++
        }
      }
      if (n) tiles.push({ x: x0, y: y0, mean: sum / n })
    }
  }

  // Robust statistics, not mean/σ: a large spliced patch drags the mean toward
  // itself and inflates σ, which hides the very region being looked for.
  // Median and MAD are unmoved by a minority of outlier tiles.
  const median = (xs: number[]) => {
    const s = [...xs].sort((p, q) => p - q)
    return s.length ? s[Math.floor(s.length / 2)] : 0
  }
  const med = median(tiles.map((t) => t.mean))
  const mad = median(tiles.map((t) => Math.abs(t.mean - med))) || 1e-4
  // Relative floor as well as the MAD test, so near-uniform images (where MAD
  // collapses to almost zero) do not flag every tile with trivial variation.
  const cutoff = Math.max(3 * mad, 0.25 * med)

  // Deviations in BOTH directions matter. A patch taken from a lower-quality
  // source and re-saved with the host image ends up *smoother* than its
  // surroundings, so an above-median-only test misses the classic splice.
  const regions = tiles
    .filter((t) => Math.abs(t.mean - med) > cutoff)
    .map((t) => ({
      x: Math.round((t.x / width) * 100),
      y: Math.round((t.y / height) * 100),
      w: Math.round((tileW / width) * 100),
      h: Math.round((tileH / height) * 100),
      intensity: Math.min(100, Math.round((Math.abs(t.mean - med) / (mad || 1)) * 8)),
    }))
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 24)

  return { regions, width, height, baseline: Math.round(med * 1000) / 1000 }
}

export interface SpectralResult {
  /** 0..100 — strength of periodic peaks typical of GAN/upsampling grids. */
  ganArtifactScore: number
  peakRatio: number
  dominantPeriod: number | null
  explanation: string
}

/**
 * Frequency-domain check for synthesis fingerprints.
 *
 * Generative upsampling (transposed convolution, nearest-neighbour + conv) leaves
 * a periodic checkerboard that appears as regularly spaced spikes in the spectrum
 * of the high-pass residual. Rather than a full 2-D FFT, this measures the
 * residual's row/column autocorrelation at small lags — the same periodicity,
 * far cheaper, and enough to separate "has a synthesis grid" from "does not".
 *
 * This is an indicator, not proof: heavy JPEG blocking also produces 8-pixel
 * periodicity, which is why period 8 is discounted below.
 */
export async function spectralArtifacts(input: Buffer): Promise<SpectralResult> {
  const SIZE = 256
  const { data } = await sharp(input)
    .greyscale()
    .resize(SIZE, SIZE, { fit: 'fill' })
    .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Mean-centre the residual so autocorrelation is not dominated by DC.
  let mean = 0
  for (let i = 0; i < data.length; i++) mean += data[i]
  mean /= data.length

  const maxLag = 24
  const corr: number[] = []
  for (let lag = 1; lag <= maxLag; lag++) {
    let acc = 0, n = 0
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x + lag < SIZE; x++) {
        acc += (data[y * SIZE + x] - mean) * (data[y * SIZE + x + lag] - mean)
        n++
      }
    }
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y + lag < SIZE; y++) {
        acc += (data[y * SIZE + x] - mean) * (data[(y + lag) * SIZE + x] - mean)
        n++
      }
    }
    corr.push(n ? acc / n : 0)
  }

  const absCorr = corr.map(Math.abs)
  // Exclusions that make the peak mean something:
  //  - lag 1 is ordinary local smoothness, present in every natural image;
  //  - lag 8 and multiples are JPEG's block grid, not synthesis.
  const candidates = absCorr
    .map((v, i) => ({ lag: i + 1, v }))
    .filter((c) => c.lag >= 2 && c.lag % 8 !== 0)
  const corrMean = candidates.reduce((a, c) => a + c.v, 0) / (candidates.length || 1)
  const peak = candidates.reduce((best, c) => (c.v > best.v ? c : best), { lag: 0, v: 0 })
  const peakRatio = corrMean > 0 ? peak.v / corrMean : 0

  // A single strong lag is not enough: ordinary periodic texture (fabric, tiles,
  // fencing, a gradient) also produces one. A synthesis grid repeats, so require
  // the harmonic at 2× the peak lag to be elevated too before scoring high.
  const harmonicLag = peak.lag * 2
  const harmonic = harmonicLag <= maxLag ? absCorr[harmonicLag - 1] : 0
  const harmonicRatio = corrMean > 0 ? harmonic / corrMean : 0
  const harmonicConfirmed = harmonicRatio >= 1.4

  const base = Math.max(0, Math.min(100, Math.round((peakRatio - 2.2) * 30)))
  // Without a harmonic this is indistinguishable from ordinary texture, so it is
  // held down to a token value rather than allowed to drive the verdict.
  const ganArtifactScore = harmonicConfirmed ? base : Math.min(15, base)

  return {
    ganArtifactScore,
    peakRatio: Math.round(peakRatio * 100) / 100,
    dominantPeriod: peakRatio > 2.2 ? peak.lag : null,
    explanation:
      ganArtifactScore >= 55
        ? `Repeating structure at ${peak.lag}px with a confirmed harmonic at ${harmonicLag}px — the pattern generative upsampling leaves behind.`
        : ganArtifactScore > 0
          ? `Periodic structure at ${peak.lag}px without harmonic confirmation. Regular texture (fabric, tiling, gradients) produces this too, so it is indicative at most.`
          : 'No periodic synthesis grid detected in the high-pass residual.',
  }
}

export interface NoiseStats {
  globalStd: number          // overall noise standard deviation
  tileStdMean: number        // mean of per-tile std
  tileStdVariance: number    // variance of tile std (high = inconsistent noise = splicing indicator)
  inconsistencyScore: number // 0..100
}

/**
 * Block-wise noise inconsistency analysis.
 * Real cameras leave consistent sensor noise. Splicing breaks it.
 */
export async function noiseInconsistency(input: Buffer, tileSize = 32): Promise<NoiseStats> {
  const { data, info } = await sharp(input).grayscale().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info

  // Global std
  let gMean = 0
  for (let i = 0; i < data.length; i++) gMean += data[i]
  gMean /= data.length
  let gVar = 0
  for (let i = 0; i < data.length; i++) gVar += (data[i] - gMean) ** 2
  const globalStd = Math.sqrt(gVar / data.length)

  // Tile std
  const tileStds: number[] = []
  for (let y = 0; y + tileSize <= height; y += tileSize) {
    for (let x = 0; x + tileSize <= width; x += tileSize) {
      let m = 0, n = 0
      for (let ty = 0; ty < tileSize; ty++) {
        for (let tx = 0; tx < tileSize; tx++) {
          m += data[(y + ty) * width + (x + tx)]
          n++
        }
      }
      m /= n
      let v = 0
      for (let ty = 0; ty < tileSize; ty++) {
        for (let tx = 0; tx < tileSize; tx++) {
          v += (data[(y + ty) * width + (x + tx)] - m) ** 2
        }
      }
      tileStds.push(Math.sqrt(v / n))
    }
  }
  const tileMean = tileStds.reduce((a, b) => a + b, 0) / (tileStds.length || 1)
  const tileVar = tileStds.reduce((a, b) => a + (b - tileMean) ** 2, 0) / (tileStds.length || 1)

  // Inconsistency score: high tile variance relative to mean = suspicious
  const ratio = tileMean > 0 ? Math.sqrt(tileVar) / tileMean : 0
  const inconsistencyScore = Math.min(100, Math.round(ratio * 200))

  return {
    globalStd: Math.round(globalStd * 10) / 10,
    tileStdMean: Math.round(tileMean * 10) / 10,
    tileStdVariance: Math.round(tileVar * 10) / 10,
    inconsistencyScore,
  }
}

/**
 * Edge density via Sobel-ish kernel — simple high-pass + count.
 * Useful for AI-generated detection (low fine-edge density).
 */
export async function edgeDensity(input: Buffer): Promise<{ edgePct: number; aiSuspicion: number }> {
  // sharp 'sharpen' is the closest built-in edge enhancer. Use convolve for Sobel.
  const { data, info } = await sharp(input)
    .grayscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
    })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let edgePixels = 0
  for (let i = 0; i < data.length; i++) if (data[i] > 64) edgePixels++
  const edgePct = (edgePixels / data.length) * 100

  // AI images often score lower edge density than natural images. Invert+normalize.
  // Heuristic: edges < 8% in normal photos = suspect.
  const aiSuspicion = edgePct < 8 ? Math.round((8 - edgePct) * 12.5) : 0

  return {
    edgePct: Math.round(edgePct * 10) / 10,
    aiSuspicion: Math.min(100, aiSuspicion),
  }
}

/**
 * Pixel-level diff between two images (for Media Compare).
 * Resizes both to common dimensions, computes per-pixel RGB delta.
 */
export async function pixelDiff(a: Buffer, b: Buffer): Promise<{
  meanDelta: number
  diffRegions: { x: number; y: number; w: number; h: number; intensity: number }[]
  diffOverlay: string  // PNG data URL
  similarityPct: number
}> {
  const W = 256, H = 256
  const [ra, rb] = await Promise.all([
    sharp(a).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer(),
    sharp(b).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer(),
  ])
  const diff = Buffer.alloc(W * H * 3)
  let total = 0
  for (let i = 0; i < ra.length; i++) {
    const d = Math.abs(ra[i] - rb[i])
    diff[i] = Math.min(255, d * 4)
    total += d
  }
  const meanDelta = total / ra.length

  // Region detection — bucket diff into 8x8 grid, flag tiles with mean > threshold
  const G = 8
  const tileW = W / G, tileH = H / G
  const regions: { x: number; y: number; w: number; h: number; intensity: number }[] = []
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      let tSum = 0, n = 0
      for (let y = gy * tileH; y < (gy + 1) * tileH; y++) {
        for (let x = gx * tileW; x < (gx + 1) * tileW; x++) {
          const idx = (y * W + x) * 3
          tSum += diff[idx] + diff[idx + 1] + diff[idx + 2]
          n += 3
        }
      }
      const m = tSum / n
      if (m > 24) {
        regions.push({
          x: gx * tileW,
          y: gy * tileH,
          w: tileW,
          h: tileH,
          intensity: Math.round(m),
        })
      }
    }
  }

  const overlay = await sharp(diff, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer()

  return {
    meanDelta: Math.round(meanDelta * 10) / 10,
    diffRegions: regions,
    diffOverlay: `data:image/png;base64,${overlay.toString('base64')}`,
    similarityPct: Math.max(0, Math.round((1 - meanDelta / 255) * 100)),
  }
}
