# Engine: Image Forensics

**File:** `src/lib/engines/image-forensics.ts` · **Deps:** `sharp` · **Status:** ✅ Real

## What it is
In-house image tamper-detection. Real Error-Level Analysis (ELA), noise-variance, edge-density and pixel-diff - no third-party forensic API. Called by `/api/analyze/image` and `/api/forensics/compare`.

## How it's built
Exports typed functions, each takes an image `Buffer` and returns a metrics object. Uses `sharp` for decode/resize/recompress/raw-pixel access. Outputs include base64 PNG heatmap overlays for the UI.

## How it works (logic)
- **ELA** (`errorLevelAnalysis`): re-encode the image as JPEG q90, subtract from the q100 baseline pixel-by-pixel. Spliced/edited regions recompress differently, so they show a **higher delta**. Returns `meanDelta`, `maxDelta`, `suspectArea` (fraction of pixels over a threshold), and a normalized heatmap overlay.
- **Noise variance:** manipulated regions often have inconsistent sensor noise; the engine measures local variance to flag mismatched areas.
- **Edge density / pixel diff:** structural signals used for comparison and manipulation hints.

## Future scope & enterprise enhancements
- Add **CNN-based manipulation detectors** (e.g. ManTraNet/FotoForensics-style) behind the same function signature.
- Extract **camera fingerprint (PRNU)** for provenance.
- Return **localized bounding boxes** of suspect regions, not just an area fraction.
- Precompute/cache heatmaps to object storage; they're expensive to regenerate.
