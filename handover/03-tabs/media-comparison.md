# Tab: Media Comparison

**File:** `src/components/tabs/media-comparison-tab.tsx` · **Data:** `POST /api/forensics/compare` · **Status:** 🟡 (mock fallback)

## What it is
Side-by-side comparison of two media files: similarity, aligned differences, and forensic diff overlay.

## How it's built
Two uploads → `/api/forensics/compare`. Real diffs come back from the **pHash + ELA + pixel-diff** engines. `mockComparisonResult` (line ~70) is used as a fallback for `differences` (line ~461) and on error (line ~466).

## How it works (logic)
1. Both files POST to `/api/forensics/compare`.
2. The route computes **pHash Hamming distance** (similarity) and **pixel/ELA diff** (localized changes).
3. Returns similarity + a `differences` list; the tab renders the comparison + overlay.

## Hardcoded-data note (🟡)
Remove `mockComparisonResult`: on API error show an error state; when there are no diffs show "No significant differences found." See [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- Region-aligned visual diff (registration/warp before diff) for shifted crops.
- Support video compare (keyframe pHash sequences).
- Provenance: link matches into the network/provenance graph.
