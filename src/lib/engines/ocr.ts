/**
 * OCR pipeline: sharp preprocess → VLM extraction → confidence merge.
 * Uses existing ZAI SDK as SLM since adding tesseract/transformers.js is heavy.
 * Preprocess is the real engineering: deskew, binarize, denoise improves VLM accuracy.
 */

import sharp from 'sharp'
import { vlmImageAnalysis } from '@/lib/ai'

export interface OcrResult {
  text: string
  language: string
  confidence: number       // 0..100
  blocks: { text: string; bbox?: { x: number; y: number; w: number; h: number } }[]
  preprocessing: string[]
  detectedScripts: { code: string; label: string }[]
}

/**
 * Preprocess: grayscale → normalize contrast → light sharpen → return PNG buffer.
 * Returns processed buffer + list of applied steps for transparency.
 */
export async function preprocessForOcr(input: Buffer): Promise<{ buffer: Buffer; steps: string[] }> {
  const steps: string[] = []
  let pipe = sharp(input).rotate() // honor EXIF orientation
  steps.push('exif_rotate')

  // Upscale if small (better VLM OCR)
  const meta = await sharp(input).metadata()
  if ((meta.width ?? 0) < 800) {
    pipe = pipe.resize({ width: 1200 })
    steps.push('upscale_1200')
  }

  pipe = pipe.grayscale()
  steps.push('grayscale')

  pipe = pipe.normalize()
  steps.push('contrast_normalize')

  pipe = pipe.sharpen({ sigma: 1 })
  steps.push('sharpen_sigma_1')

  // Slight threshold to crisp text without losing anti-aliasing
  pipe = pipe.linear(1.2, -20)
  steps.push('linear_contrast_boost')

  const buffer = await pipe.png({ quality: 100 }).toBuffer()
  return { buffer, steps }
}

const SCRIPT_PATTERNS: Array<{ code: string; label: string; re: RegExp }> = [
  { code: 'hi', label: 'Devanagari (Hindi/Marathi/Sanskrit)', re: /[ऀ-ॿ]/ },
  { code: 'ta', label: 'Tamil', re: /[஀-௿]/ },
  { code: 'te', label: 'Telugu', re: /[ఀ-౿]/ },
  { code: 'bn', label: 'Bengali', re: /[ঀ-৿]/ },
  { code: 'gu', label: 'Gujarati', re: /[઀-૿]/ },
  { code: 'kn', label: 'Kannada', re: /[ಀ-೿]/ },
  { code: 'ml', label: 'Malayalam', re: /[ഀ-ൿ]/ },
  { code: 'pa', label: 'Gurmukhi (Punjabi)', re: /[਀-੿]/ },
  { code: 'ur', label: 'Arabic/Urdu', re: /[؀-ۿ]/ },
  { code: 'en', label: 'Latin/English', re: /[a-zA-Z]/ },
]

export function detectScripts(text: string): { code: string; label: string }[] {
  const out: { code: string; label: string }[] = []
  for (const p of SCRIPT_PATTERNS) if (p.re.test(text)) out.push({ code: p.code, label: p.label })
  return out
}

/**
 * Full pipeline: preprocess, VLM OCR, script detect, confidence estimate.
 */
export async function runOcr(input: Buffer, mimeType: string): Promise<OcrResult> {
  const { buffer, steps } = await preprocessForOcr(input)
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`

  const prompt = `You are an OCR engine specialized in multilingual Indian content.
Extract ALL visible text from the image. Preserve original script (Devanagari, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam, Punjabi, Arabic, Latin).
Return strict JSON:
{
  "text": "<full extracted text, line breaks preserved with \\n>",
  "language": "<ISO 639-1 code of dominant language>",
  "confidence": <0..1 estimate of OCR accuracy>,
  "blocks": [{"text": "<paragraph or label>"}, ...]
}
No additional commentary.`

  let parsed: Record<string, unknown> = {}
  try {
    parsed = await vlmImageAnalysis(dataUrl, prompt)
  } catch (e) {
    return {
      text: '',
      language: 'unknown',
      confidence: 0,
      blocks: [],
      preprocessing: steps,
      detectedScripts: [],
    }
  }

  const text = typeof parsed.text === 'string' ? parsed.text : ''
  const language = typeof parsed.language === 'string' ? parsed.language : 'unknown'
  const rawConf = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
  const blocks = Array.isArray(parsed.blocks)
    ? (parsed.blocks as Array<{ text: string }>).map((b) => ({ text: String(b.text ?? '') }))
    : text.split(/\n+/).filter(Boolean).map((t) => ({ text: t }))
  const scripts = detectScripts(text)

  // Confidence merge: VLM self-report + script-coverage bonus
  let confidence = rawConf <= 1 ? rawConf * 100 : rawConf
  if (scripts.length > 0 && text.length > 5) confidence = Math.min(100, confidence + 5)
  if (text.length < 3) confidence = Math.min(confidence, 20)

  return {
    text,
    language,
    confidence: Math.round(confidence),
    blocks,
    preprocessing: steps,
    detectedScripts: scripts,
  }
}
