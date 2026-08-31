# Engines Overview

`src/lib/engines/*` - the domain logic. These are **pure(ish) functions**: given input, they compute a result. Most take a buffer/text/DB handle and return a typed object. API routes call them; they contain no HTTP concerns. This is the most valuable code in the repo and the easiest to unit-test.

| Engine | File | One-liner | Doc |
|--------|------|-----------|-----|
| Image forensics | `image-forensics.ts` | ELA, noise variance, edge density, pixel diff (sharp) | [10](10-image-forensics.md) |
| Perceptual hash | `phash.ts` | 64-bit dHash + Hamming distance for near-dup detection | [11](11-phash.md) |
| TF-IDF | `tfidf.ts` | Tokenize, TF-IDF vectors, cosine sim, MinHash | [12](12-tfidf.md) |
| Clustering | `clustering.ts` | DBSCAN-lite over cosine sim → campaign clusters | [13](13-clustering.md) |
| Audio DSP | `audio-dsp.ts` | Spectral/ZCR/flatness features for voice-deepfake | [14](14-audio-dsp.md) |
| OCR | `ocr.ts` | sharp preprocess → VLM extraction → script detect | [15](15-ocr.md) |
| Source credibility | `source-credibility.ts` | DB-derived per-domain credibility & bias | [16](16-source-credibility.md) |
| Sybil trust | `sybil-trust.ts` | Weighted consensus + anti-gaming for community votes | [17](17-sybil-trust.md) |
| Region extractor | `region-extractor.ts` | Heuristic Indian city/region tagging for the map | [18](18-region-extractor.md) |
| Dashboard aggregator | `dashboard-aggregator.ts` | Real dashboard metrics from DB tables | [19](19-dashboard-aggregator.md) |
| System metrics | `system-metrics.ts` | Real OS/process health via Node `os` | [20](20-system-metrics.md) |
| API introspect | `api-introspect.ts` | Walks `src/app/api` to auto-document routes | [21](21-api-introspect.md) |
| Report generator | `report-generator.ts` | HTML(→print-PDF) + JSON reports, no heavy deps | [22](22-report-generator.md) |
| Audit logger | `audit-logger.ts` | Writes `AuditLog` rows from any route | [23](23-audit-logger.md) |
| Semantic | `semantic.ts` | Stance detection + TF-IDF/trigram similarity, Indic-safe | doc pending |
| Text heuristics | `text-heuristics.ts` | Offline multilingual misinformation signal detector | doc pending |
| Hoax match | `hoax-match.ts` | Near-duplicate match against the recurring-hoax registry | doc pending |
| Video temporal | `video-temporal.ts` | Per-frame + cross-frame spatial/temporal video forensics | doc pending |
| Image verdict | `image-verdict.ts` | Weighted signal fusion with per-signal attribution | doc pending |
| Provenance | `provenance.ts` | C2PA, XMP and EXIF provenance, reports absence as signal | doc pending |
| Integrity | `integrity.ts` | SHA-256 + pHash chain of custody, hash-linked audit | doc pending |
| Eval metrics | `eval-metrics.ts` | Confusion matrix, precision, recall, F1, threshold sweep | doc pending |

## Shared design choices

- **No heavy third-party services.** Forensics uses `sharp`; DSP/TF-IDF/clustering are hand-written TS. This keeps the app self-contained and offline-capable, at the cost of accuracy vs. specialist models. The enterprise path (per engine) is usually "swap this heuristic for a trained model / dedicated service behind the same function signature."
- **The function signature is the contract.** Because routes only depend on the exported function, you can replace an engine's internals (e.g. TF-IDF cosine → embeddings) without touching routes or UI.
- **Testability.** None of these have unit tests yet. They are the first place to add them (see [`04-operations/02-testing-strategy.md`](../04-operations/02-testing-strategy.md)).

## Scope of work

Tracked centrally in [`05-scope-of-work/`](../05-scope-of-work/README.md).

| Item | Status | Note |
|---|---|---|
| 22 engines implemented | ✅ Implemented | Every one is real logic, no stubs |
| Docs for 8 of the 22 engines | 🟡 In Progress | The last 8 rows above have no doc. Until they do, the handover understates what was built: [04-claim-vs-implementation](../05-scope-of-work/04-claim-vs-implementation.md) |
| Unit tests | ❌ Not Started | Pure functions, the cheapest high-value tests in the repo |
| Trained models replacing heuristics | 🔒 Licence-gated | Signatures already allow the swap: [C6](../05-scope-of-work/02-constrained-and-deferred.md) |
