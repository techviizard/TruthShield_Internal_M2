/**
 * Server-side audio DSP for deepfake detection.
 * Pure TS implementation - no native libs.
 *
 * Strategies:
 *  - Spectral cutoff: synthetic generators often cap at 16/22kHz, real mics reach 44kHz.
 *  - Zero-crossing rate: detects unnatural smoothness.
 *  - Spectral flatness: high flatness = white-noise-like = synthetic background.
 *  - Energy variance: synthetic voices have flatter envelope.
 *
 * Accepts decoded PCM16 mono samples + sample rate. Caller is responsible for decoding
 * (WAV header parse handled here; for MP3/AAC, frontend uses Web Audio API and POSTs PCM).
 */

export interface AudioFeatures {
  sampleRate: number
  durationSec: number
  spectralCutoffHz: number       // estimated highest non-noise frequency
  zeroCrossingRate: number       // per second
  spectralFlatness: number       // 0..1, higher = more noise-like
  energyVariance: number         // dB^2
  silenceRatio: number           // fraction of frames with energy below threshold
  estimatedDeepfakeProbability: number  // 0..100
  artifacts: string[]
}

/**
 * Minimal WAV header parser. Returns Float32 mono samples and sample rate.
 * Supports PCM16 LE WAV - most common.
 */
export function parseWav(buf: Buffer): { samples: Float32Array; sampleRate: number } | null {
  if (buf.length < 44) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null
  if (buf.toString('ascii', 8, 12) !== 'WAVE') return null
  // Find 'fmt ' and 'data' chunks
  let offset = 12
  let sampleRate = 44100, channels = 1, bitsPerSample = 16
  let dataStart = -1, dataLen = 0
  while (offset < buf.length - 8) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10)
      sampleRate = buf.readUInt32LE(offset + 12)
      bitsPerSample = buf.readUInt16LE(offset + 22)
    } else if (id === 'data') {
      dataStart = offset + 8
      dataLen = size
      break
    }
    offset += 8 + size
  }
  if (dataStart < 0 || bitsPerSample !== 16) return null

  const sampleCount = dataLen / 2 / channels
  const samples = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    let acc = 0
    for (let c = 0; c < channels; c++) {
      acc += buf.readInt16LE(dataStart + (i * channels + c) * 2)
    }
    samples[i] = acc / channels / 32768
  }
  return { samples, sampleRate }
}

/**
 * Cooley-Tukey iterative radix-2 FFT (in-place). N must be power of 2.
 * Returns magnitude spectrum (length N/2).
 */
export function fftMagnitude(input: Float32Array): Float32Array {
  let n = 1
  while (n * 2 <= input.length) n *= 2
  const re = new Float32Array(n), im = new Float32Array(n)
  for (let i = 0; i < n; i++) re[i] = input[i]

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1
    const angle = -2 * Math.PI / len
    const wReBase = Math.cos(angle), wImBase = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0
      for (let k = 0; k < halfLen; k++) {
        const a = i + k, b = i + k + halfLen
        const tRe = wRe * re[b] - wIm * im[b]
        const tIm = wRe * im[b] + wIm * re[b]
        re[b] = re[a] - tRe; im[b] = im[a] - tIm
        re[a] = re[a] + tRe; im[a] = im[a] + tIm
        const nwRe = wRe * wReBase - wIm * wImBase
        wIm = wRe * wImBase + wIm * wReBase
        wRe = nwRe
      }
    }
  }
  const mag = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i])
  return mag
}

/**
 * Estimate spectral cutoff: highest frequency where energy > 1% of peak.
 */
function estimateCutoff(mag: Float32Array, sampleRate: number): number {
  const nyquist = sampleRate / 2
  const peak = Math.max(...mag)
  const threshold = peak * 0.01
  for (let i = mag.length - 1; i >= 0; i--) {
    if (mag[i] > threshold) {
      return Math.round((i / mag.length) * nyquist)
    }
  }
  return 0
}

/**
 * Spectral flatness = geometric_mean / arithmetic_mean. 1 = white noise.
 */
function spectralFlatness(mag: Float32Array): number {
  let logSum = 0, arithSum = 0, n = 0
  for (let i = 1; i < mag.length; i++) {  // skip DC
    if (mag[i] > 1e-10) {
      logSum += Math.log(mag[i])
      arithSum += mag[i]
      n++
    }
  }
  if (n === 0) return 0
  const geo = Math.exp(logSum / n)
  const arith = arithSum / n
  return arith > 0 ? geo / arith : 0
}

/**
 * Main analysis entry. Returns full feature set + deepfake probability.
 */
export function analyzeAudio(samples: Float32Array, sampleRate: number): AudioFeatures {
  const durationSec = samples.length / sampleRate

  // Zero-crossing rate
  let zcCount = 0
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0) !== (samples[i] >= 0)) zcCount++
  }
  const zcr = (zcCount / durationSec)

  // Frame energy variance + silence ratio
  const frameSize = Math.min(2048, samples.length)
  const energies: number[] = []
  let silent = 0
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    let e = 0
    for (let i = 0; i < frameSize; i++) e += samples[start + i] * samples[start + i]
    e = Math.sqrt(e / frameSize)
    const db = 20 * Math.log10(Math.max(1e-6, e))
    energies.push(db)
    if (db < -40) silent++
  }
  const eMean = energies.reduce((a, b) => a + b, 0) / (energies.length || 1)
  const eVar = energies.reduce((a, b) => a + (b - eMean) ** 2, 0) / (energies.length || 1)
  const silenceRatio = silent / (energies.length || 1)

  // Spectral analysis on a 16k window from middle of clip (or full if shorter)
  const N = 16384
  const mid = Math.max(0, Math.floor(samples.length / 2 - N / 2))
  const window = samples.slice(mid, Math.min(mid + N, samples.length))
  const mag = window.length >= 2 ? fftMagnitude(window) : new Float32Array(1)
  const cutoffHz = estimateCutoff(mag, sampleRate)
  const flatness = spectralFlatness(mag)

  // Deepfake probability heuristic
  const artifacts: string[] = []
  let score = 0
  if (cutoffHz > 0 && cutoffHz < sampleRate / 2 - 2000) {
    // Suspicious cutoff suggests resampled / synthesized audio
    if (cutoffHz < 16500) {
      score += 35
      artifacts.push(`Spectral cutoff at ${cutoffHz}Hz - below natural microphone range (typical 20kHz+)`)
    } else if (cutoffHz < 20000) {
      score += 15
      artifacts.push(`Spectral cutoff at ${cutoffHz}Hz - possible vocoder/codec artifact`)
    }
  }
  if (eVar < 20 && energies.length > 10) {
    score += 25
    artifacts.push(`Flat energy envelope (variance ${eVar.toFixed(1)} dB²) - synthetic voices lack natural dynamics`)
  }
  if (flatness > 0.45) {
    score += 15
    artifacts.push(`High spectral flatness (${flatness.toFixed(2)}) - noise-like background suggests synthesis`)
  }
  if (silenceRatio < 0.05) {
    score += 10
    artifacts.push(`Almost no silence (${(silenceRatio * 100).toFixed(1)}%) - natural speech has breath pauses`)
  }
  if (zcr < 1500 && durationSec > 1) {
    score += 10
    artifacts.push(`Low zero-crossing rate (${zcr.toFixed(0)}/s) - over-smoothed waveform`)
  }
  if (artifacts.length === 0) artifacts.push('No strong synthetic indicators detected')

  return {
    sampleRate,
    durationSec: Math.round(durationSec * 100) / 100,
    spectralCutoffHz: cutoffHz,
    zeroCrossingRate: Math.round(zcr),
    spectralFlatness: Math.round(flatness * 1000) / 1000,
    energyVariance: Math.round(eVar * 10) / 10,
    silenceRatio: Math.round(silenceRatio * 1000) / 1000,
    estimatedDeepfakeProbability: Math.min(100, score),
    artifacts,
  }
}
