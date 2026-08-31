/**
 * Robustly extract a JSON object from an LLM response.
 * Handles: raw JSON, ```json fenced blocks, or a bare {...} embedded in prose.
 * (Preserves the parsing behaviour the app relied on with the previous SDK.)
 */
export function extractJson(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content)
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced && fenced[1]) {
      return JSON.parse(fenced[1].trim())
    }
    const objectMatch = content.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      return JSON.parse(objectMatch[0])
    }
    throw new Error('Could not parse model response as JSON')
  }
}

/** Split a data URL ("data:image/png;base64,....") into media type + base64 payload. */
export function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) {
    // Not a data URL (e.g. a plain https URL) - caller must handle.
    return { mediaType: '', base64: '' }
  }
  return { mediaType: match[1], base64: match[2] }
}
