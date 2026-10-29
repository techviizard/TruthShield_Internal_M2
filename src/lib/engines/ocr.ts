/**
 * OCR pipeline: sharp preprocess → VLM extraction → confidence merge.
 * Uses existing ZAI SDK as SLM since adding tesseract/transformers.js is heavy.
 * Preprocess is the real engineering: deskew, binarize, denoise improves VLM accuracy.
 */


import sharp from 'sharp'
import { createWorker } from 'tesseract.js'


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

 //pipe = pipe.grayscale()
//steps.push('grayscale')

//pipe = pipe.normalize()
//steps.push('contrast_normalize')

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

 const worker = await createWorker('eng+tel+hin', 1, {
  workerPath: `${process.cwd()}/node_modules/tesseract.js/src/worker-script/node/index.js`,
})
  try {
    const result = await worker.recognize(buffer)

    const text = result.data.text.trim()

    if (!text) {
      throw new Error('OCR extraction returned empty text.')
    }

    const scripts = detectScripts(text)

    let language = 'unknown'

    if (scripts.length === 1) {
      const scriptToLanguage: Record<string, string> = {
        te: 'te',
        ta: 'ta',
        hi: 'hi',
        kn: 'kn',
        ml: 'ml',
        bn: 'bn',
        gu: 'gu',
        pa: 'pa',
        ur: 'ur',
        en: 'en',
      }

      language = scriptToLanguage[scripts[0].code] ?? 'unknown'
    }

    const confidence = Math.max(
      0,
      Math.min(100, Math.round(result.data.confidence))
    )

    const blocks = text
      .split(/\n+/)
      .filter(Boolean)
      .map((t) => ({ text: t }))

    return {
      text,
      language,
      confidence,
      blocks,
      preprocessing: steps,
      detectedScripts: scripts,
    }
  } finally {
    await worker.terminate()
  }
}
