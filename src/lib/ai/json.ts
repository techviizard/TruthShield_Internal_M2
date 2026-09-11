/**
 * Robustly extract a JSON object from an LLM response.
 * Handles: raw JSON, ```json fenced blocks, or a bare {...} embedded in prose.
 * (Preserves the parsing behaviour the app relied on with the previous SDK.)
 */
export function extractJson(text: string): any {
  try {
    // 1. First, try to parse it as-is just in case it is already clean
    return JSON.parse(text);
  } catch (e) {
    // 2. If that fails, look for Markdown JSON blocks: ```json { ... } ```
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    
    if (markdownMatch && markdownMatch[1]) {
      try {
        return JSON.parse(markdownMatch[1].trim());
      } catch (err) {
        console.error("Failed to parse extracted markdown:", markdownMatch[1]);
      }
    }

    // 3. Fallback: Find the first { and the last } in the whole string
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const possibleJson = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(possibleJson);
      } catch (err) {
        // Fall through to the final error throw below
      }
    }

    throw new Error('Could not parse model response as JSON');
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