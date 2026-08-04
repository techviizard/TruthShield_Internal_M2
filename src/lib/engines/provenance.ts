/**
 * Content provenance: C2PA Content Credentials, XMP, and EXIF signals.
 *
 * The forensic question "was this edited" is much easier when the file says so.
 * Cameras, phones and editors leave traces; C2PA-signed assets carry an explicit
 * manifest. This reads what is present and — just as important — reports what is
 * *absent*, because a stripped file is itself a signal.
 *
 * Scope: presence, structure and self-reported claims. Verifying a C2PA
 * signature chain requires the c2pa toolkit and trust anchors; until that is
 * wired in, a detected manifest is reported as "present, unverified" and never
 * as "verified".
 */

import sharp from 'sharp'

export interface ProvenanceField {
  field: string
  value: string
  status: 'clean' | 'suspicious' | 'warning' | 'info'
  note?: string
}

export interface ProvenanceResult {
  hasExif: boolean
  hasXmp: boolean
  hasIcc: boolean
  /** A C2PA/JUMBF manifest box was found in the container. */
  c2paPresent: boolean
  c2paVerified: false
  editingSoftware: string | null
  capturedAt: string | null
  cameraMake: string | null
  cameraModel: string | null
  gpsPresent: boolean
  /** AI-generation markers that some generators write into metadata. */
  generatorHints: string[]
  fields: ProvenanceField[]
  /** 0..100 — how much the metadata *alone* argues the file was altered/synthesised. */
  suspicionScore: number
  summary: string
}

const EDITOR_PATTERN =
  /(Adobe Photoshop[^\0"]{0,20}|Adobe Lightroom[^\0"]{0,20}|GIMP[^\0"]{0,12}|Snapseed|Picsart|Canva|Figma|Affinity Photo|Paint\.NET|Pixelmator)/i

/** Markers written by common generators. Presence is a strong, explicit signal. */
const GENERATOR_PATTERN =
  /(Stable Diffusion|Midjourney|DALL[·．・.]?E|Firefly|Imagen|Flux\.1|NovelAI|Leonardo\.Ai|c2pa\.actions\.created|trainedAlgorithmicMedia|"generator"\s*:\s*"[^"]*(?:diffusion|gan|gpt)[^"]*")/i

/** JUMBF/C2PA box markers as they appear in JPEG/PNG containers. */
const C2PA_MARKERS = ['c2pa', 'jumb', 'urn:uuid:c2pa', 'c2pa.assertions']

export async function readProvenance(buffer: Buffer): Promise<ProvenanceResult> {
  const md = await sharp(buffer).metadata().catch(() => null)

  const exifRaw = md?.exif ? md.exif.toString('latin1') : ''
  const xmpRaw = md?.xmp ? md.xmp.toString('utf8') : ''
  // Scan a bounded head/tail window: metadata boxes live near the container
  // edges, and scanning a 40 MB buffer per upload is not worth the few extra hits.
  const head = buffer.subarray(0, Math.min(buffer.length, 512 * 1024)).toString('latin1').toLowerCase()
  const combined = `${exifRaw}\n${xmpRaw}`

  const c2paPresent = C2PA_MARKERS.some((m) => head.includes(m))
  const editorMatch = combined.match(EDITOR_PATTERN)
  const generatorHits = [...new Set(
    [combined, head].flatMap((s) => {
      const m = s.match(GENERATOR_PATTERN)
      return m ? [m[0].trim().slice(0, 60)] : []
    })
  )]

  const dateMatch = exifRaw.match(/(?:DateTimeOriginal|CreateDate)?\D{0,4}(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/)
  const makeMatch = exifRaw.match(/\b(Canon|NIKON|SONY|FUJIFILM|Apple|samsung|OnePlus|Xiaomi|realme|vivo|OPPO|Google|Motorola|Nothing)\b/i)
  const modelMatch = exifRaw.match(/\b(iPhone[\w\s]{0,10}|Pixel\s?\d[\w\s]{0,6}|SM-[A-Z0-9]+|EOS[\w\s]{0,10}|ILCE-\w+)\b/i)
  const gpsPresent = /GPS(?:Latitude|Longitude|Info)/i.test(exifRaw) || /exif:GPS/i.test(xmpRaw)

  const fields: ProvenanceField[] = []
  const push = (field: string, value: string, status: ProvenanceField['status'], note?: string) =>
    fields.push({ field, value, status, note })

  push('EXIF block', md?.exif ? 'Present' : 'Absent', md?.exif ? 'clean' : 'warning',
    md?.exif ? undefined : 'Social platforms strip EXIF on upload, so absence alone is not evidence of tampering.')
  push('XMP block', md?.xmp ? 'Present' : 'Absent', 'info')
  push('ICC profile', md?.icc ? 'Present' : 'Absent', 'info')
  push('Content Credentials (C2PA)', c2paPresent ? 'Manifest present (unverified)' : 'None',
    c2paPresent ? 'info' : 'warning',
    c2paPresent
      ? 'A manifest was found in the container. Signature-chain validation is not performed in this build, so treat the contents as self-reported.'
      : 'No provenance manifest to check against.')
  push('Editing software', editorMatch ? editorMatch[0] : 'Not declared',
    editorMatch ? 'suspicious' : 'clean',
    editorMatch ? 'Editor tag present — the file was opened in an editor, though that does not prove manipulation of content.' : undefined)
  push('Generator markers', generatorHits.length ? generatorHits.join(', ') : 'None',
    generatorHits.length ? 'suspicious' : 'clean',
    generatorHits.length ? 'Metadata explicitly names a generative tool.' : undefined)
  push('Capture timestamp', dateMatch ? dateMatch[1] : 'Absent', dateMatch ? 'clean' : 'info')
  push('Camera', [makeMatch?.[0], modelMatch?.[0]].filter(Boolean).join(' ') || 'Not declared',
    makeMatch ? 'clean' : 'info')
  push('GPS', gpsPresent ? 'Present' : 'Absent', 'info')
  if (md?.width && md?.height) {
    push('Dimensions', `${md.width} × ${md.height}`, 'info')
    // Exactly-square power-of-two output is characteristic of generator presets.
    const isPow2 = (n: number) => (n & (n - 1)) === 0
    if (md.width === md.height && isPow2(md.width) && md.width >= 256) {
      push('Aspect', `Square ${md.width}px (power of two)`, 'suspicious',
        'Common default output size for image generators; ordinary cameras rarely produce it.')
    }
  }

  let suspicion = 0
  if (generatorHits.length) suspicion += 55
  if (editorMatch) suspicion += 25
  if (!md?.exif) suspicion += 12
  if (c2paPresent && generatorHits.length) suspicion += 10
  suspicion = Math.min(100, suspicion)

  const summary = generatorHits.length
    ? 'Metadata names a generative tool — the file itself declares synthetic origin.'
    : editorMatch
      ? `Metadata names an editor (${editorMatch[0]}). The file passed through editing software.`
      : md?.exif
        ? 'Camera-style metadata is present with no editor or generator markers.'
        : 'No EXIF metadata survives in this file, so metadata cannot speak to its origin either way.'

  return {
    hasExif: Boolean(md?.exif),
    hasXmp: Boolean(md?.xmp),
    hasIcc: Boolean(md?.icc),
    c2paPresent,
    c2paVerified: false,
    editingSoftware: editorMatch ? editorMatch[0] : null,
    capturedAt: dateMatch ? dateMatch[1] : null,
    cameraMake: makeMatch ? makeMatch[0] : null,
    cameraModel: modelMatch ? modelMatch[0] : null,
    gpsPresent,
    generatorHints: generatorHits,
    fields,
    suspicionScore: suspicion,
    summary,
  }
}
