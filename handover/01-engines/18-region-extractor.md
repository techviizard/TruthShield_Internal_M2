# Engine: Region Extractor

**File:** `src/lib/engines/region-extractor.ts` · **Deps:** none · **Status:** ✅ Real (heuristic)

## What it is
Heuristic Indian city/region tagger. Scans text fields (explanation, fileName, tags) for known place names and maps them to map coordinates. Feeds the dashboard threat-intel map.

## How it's built
A dictionary (`REGION_DICT`) of cities → lat/lng. `extractRegion(text)` finds a match; `fallbackRegion()` supplies a default; `regionToPoint()` converts to a `RegionPoint` (lat/lng + projected x/y for the map).

## How it works (logic)
1. Lowercase-scan the text for any dictionary city/region name.
2. First/most-specific match wins → its coordinates.
3. No match → `fallbackRegion()` (a sensible default so the map isn't empty).
4. `regionToPoint()` projects geo coordinates to the map's pixel space.

Deliberately simple — it's a display aid, not a geocoder.

## Future scope & enterprise enhancements
- Replace the dictionary with a **proper NER + gazetteer** (spaCy/geonames) for coverage beyond the seed list.
- Support multilingual place names (Devanagari etc.).
- Confidence scoring + disambiguation (many cities share names).
- Cache extracted regions on `AnalysisReport` to avoid re-scanning on every dashboard load.
