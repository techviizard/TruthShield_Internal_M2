# Tab: Reverse Search

**File:** `src/components/tabs/reverse-search-tab.tsx` · **Data:** `POST /api/analyze/reverse-image` · **Status:** ✅

## What it is
Reverse-image lookup: find where an image originated / where else it appears.

## How it's built
Image upload → `/api/analyze/reverse-image`. Renders candidate matches/origins.

## How it works (logic)
1. Upload posts to `/api/analyze/reverse-image`.
2. The route uses image search (and can combine with **pHash** near-duplicate lookup over `PerceptualHash`).
3. The tab lists sources/first-seen candidates.

## Note
The route has a pre-existing type issue (`string | null` arg) — see [known issues](../04-operations/03-known-issues.md).

## Future scope & enterprise enhancements
- Integrate a dedicated reverse-image provider + internal pHash index for known media.
- Timeline of appearances (earliest source) for provenance.
- Cross-link into Network Analysis.
