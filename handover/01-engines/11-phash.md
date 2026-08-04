# Engine: Perceptual Hash (pHash)

**File:** `src/lib/engines/phash.ts` · **Deps:** `sharp` · **Status:** ✅ Real

## What it is
64-bit **dHash** perceptual hashing + Hamming distance. Detects near-duplicate/derivative images even after resize, recompress, or minor edits. Powers Media Compare similarity and the provenance graph; stored in the `PerceptualHash` model.

## How it's built
`dHash(buffer)` → 16-char hex string. A distance helper compares two hashes. Pure `sharp`, no external service.

## How it works (logic)
1. Resize the image to **9×8 grayscale** (`fit: fill`).
2. For each row, compare each pixel to its right neighbour → bit `1` if left < right, else `0`. That's 8×8 = **64 bits**.
3. Pack bits into a 16-char hex string.
4. **Hamming distance** (count of differing bits) between two hashes ≈ visual difference. Small distance (e.g. ≤10) = near-duplicate.

Why dHash: it's cheap, robust to scaling/compression, and gradient-based (captures structure, ignores absolute brightness).

## Future scope & enterprise enhancements
- Add **pHash (DCT-based)** and **wavelet hash** and combine for robustness to crops/rotation.
- Store hashes in a **vector/BK-tree index** for sub-linear nearest-neighbour lookup (current lookups are linear scans).
- Extend to **video** (per-keyframe hashing) for deepfake source tracing.
