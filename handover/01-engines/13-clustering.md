# Engine: Clustering (Campaign Detection)

**File:** `src/lib/engines/clustering.ts` · **Deps:** `tfidf` · **Status:** ✅ Real

## What it is
DBSCAN-lite clustering over TF-IDF cosine similarity. Groups highly-similar reports/messages as **coordinated inauthentic behavior** (campaigns). Backs `/api/campaigns`.

## How it's built
`clusterDocuments(docs, opts)` → array of `Cluster` objects (each with member ids + similarities). Reuses `tokenize`, `tfidfCorpus`, `cosineSim` from the TF-IDF engine.

## How it works (logic)
1. Vectorize all documents (TF-IDF).
2. For each doc, find neighbours whose cosine similarity ≥ `eps` (density threshold).
3. Grow clusters from core points that have ≥ `minPts` neighbours (DBSCAN's core idea); attach density-reachable points.
4. Points with no dense neighbourhood are **noise** (organic, not coordinated).

Output clusters = candidate campaigns; cluster size + tightness ≈ coordination strength.

## Future scope & enterprise enhancements
- Add **temporal + author-graph signals** (near-simultaneous posting, shared accounts) — text similarity alone yields false positives.
- Use embeddings instead of TF-IDF for cross-lingual campaigns.
- Incremental/streaming clustering so new items join clusters without a full recompute.
- Persist clusters to `Campaign`/`CampaignMember` with provenance + confidence.
