# Tab: Network Analysis

**File:** `src/components/tabs/network-analysis-tab.tsx` · **Data:** `/api/network-graph` (exists, **not called**) · **Status:** 🔴

## What it is
Watermark/provenance and distribution-network visualization: how a piece of media/content spread, shared hashes, metadata tracing.

## How it's built
Currently renders from inline data; the real endpoint `/api/network-graph` (backed by pHash + TF-IDF/MinHash provenance) is **not wired** into the tab yet.

## How it works (logic - intended)
1. Fetch `/api/network-graph` for a subject (media id / claim).
2. The route builds nodes/edges from **pHash near-duplicates** and **text similarity** (shared origin) across `AnalysisReport`/`PerceptualHash`.
3. The tab renders the graph (spread, clusters, watermark/steganography flags).

## Hardcoded-data note (🔴)
Wire the tab to `/api/network-graph`; add an empty state; remove inline mock. See [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- Real graph store + layout (Neo4j / graph lib) for large networks.
- Steganography/watermark extraction (C2PA, invisible watermarks).
- Temporal spread animation; account/source attribution.
