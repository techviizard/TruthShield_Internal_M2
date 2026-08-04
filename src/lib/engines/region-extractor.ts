/**
 * Indian region/city extractor.
 * Heuristic dictionary scan over text fields (explanation, fileName, tags).
 * Used by dashboard threat-map aggregation.
 */

export interface RegionPoint {
  city: string
  lat: number
  lng: number
  x: number
  y: number
}

// 14 monitored cities with SVG (500x600 viewBox) coordinates — keep in sync with threat-intel-map.tsx
export const REGION_DICT: RegionPoint[] = [
  { city: 'Delhi', lat: 28.6, lng: 77.2, x: 222, y: 148 },
  { city: 'Mumbai', lat: 19.1, lng: 72.9, x: 160, y: 328 },
  { city: 'Chennai', lat: 13.1, lng: 80.3, x: 238, y: 445 },
  { city: 'Kolkata', lat: 22.6, lng: 88.4, x: 340, y: 270 },
  { city: 'Bangalore', lat: 13.0, lng: 77.6, x: 210, y: 445 },
  { city: 'Hyderabad', lat: 17.4, lng: 78.5, x: 225, y: 370 },
  { city: 'Jaipur', lat: 26.9, lng: 75.8, x: 193, y: 175 },
  { city: 'Lucknow', lat: 26.8, lng: 80.9, x: 262, y: 178 },
  { city: 'Patna', lat: 25.6, lng: 85.1, x: 305, y: 195 },
  { city: 'Ahmedabad', lat: 23.0, lng: 72.6, x: 152, y: 250 },
  { city: 'Kochi', lat: 10.0, lng: 76.3, x: 198, y: 500 },
  { city: 'Chandigarh', lat: 30.7, lng: 76.8, x: 215, y: 115 },
  { city: 'Bhopal', lat: 23.3, lng: 77.4, x: 220, y: 260 },
  { city: 'Guwahati', lat: 26.1, lng: 91.7, x: 395, y: 195 },
]

// Aliases (state names, regional spellings, devanagari hints) map to canonical city
const ALIAS_MAP: Record<string, string> = {
  'new delhi': 'Delhi', 'दिल्ली': 'Delhi', 'ncr': 'Delhi',
  'bombay': 'Mumbai', 'मुंबई': 'Mumbai', 'maharashtra': 'Mumbai',
  'madras': 'Chennai', 'tamil nadu': 'Chennai', 'चेन्नई': 'Chennai',
  'calcutta': 'Kolkata', 'west bengal': 'Kolkata',
  'bengaluru': 'Bangalore', 'karnataka': 'Bangalore',
  'telangana': 'Hyderabad', 'andhra': 'Hyderabad',
  'rajasthan': 'Jaipur',
  'uttar pradesh': 'Lucknow', 'up region': 'Lucknow',
  'bihar': 'Patna',
  'gujarat': 'Ahmedabad',
  'kerala': 'Kochi', 'cochin': 'Kochi',
  'punjab': 'Chandigarh', 'haryana': 'Chandigarh',
  'madhya pradesh': 'Bhopal', 'mp region': 'Bhopal',
  'assam': 'Guwahati', 'northeast': 'Guwahati',
}

/**
 * Scan free-form text for Indian city / state mentions.
 * Returns canonical city name or null.
 */
export function extractRegion(...sources: (string | null | undefined)[]): string | null {
  const haystack = sources.filter(Boolean).join(' ').toLowerCase()
  if (!haystack) return null

  // Exact city match first
  for (const r of REGION_DICT) {
    if (haystack.includes(r.city.toLowerCase())) return r.city
  }
  // Alias match
  for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
    if (haystack.includes(alias)) return canonical
  }
  return null
}

/**
 * Deterministic hash-based fallback assignment when no region detected.
 * Ensures geographic spread instead of clumping everything to Delhi.
 */
export function fallbackRegion(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const idx = Math.abs(h) % REGION_DICT.length
  return REGION_DICT[idx].city
}

export function regionToPoint(city: string): RegionPoint | undefined {
  return REGION_DICT.find((r) => r.city === city)
}
