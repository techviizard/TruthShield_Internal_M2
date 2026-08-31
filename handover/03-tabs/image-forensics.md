# Tab: Image Forensics

**File:** `src/components/tabs/image-forensics-tab.tsx` · **Data:** store `analyzeImage(file)` → `POST /api/analyze/image` · **Status:** ✅

## What it is
Upload an image → forensic report: AI-generated likelihood, manipulation indicators, metadata (EXIF) analysis, ELA heatmap, forensic findings, recommendations.

## How it's built
File-upload form. Calls `analyzeImage(file)`; renders `imageResult` (`ImageAnalysisResult`). The store transforms the API response into the UI shape (this is where the old confidence-jitter bug was - now fixed).

## How it works (logic)
1. `/api/analyze/image` runs the **image-forensics engine** (real ELA/noise/edge via `sharp`) and a **VLM** pass (`vlmImageAnalysis`) for AI-generation likelihood + metadata reasoning.
2. Persists an `AnalysisReport`; returns flags, confidence, ELA overlay, metadata findings.
3. The tab shows the heatmap, indicator list, and a metadata table (Software/anomalies).

## Future scope & enterprise enhancements
- Localized **bounding boxes** for tampered regions (see image-forensics engine doc).
- PRNU camera-fingerprint provenance; C2PA/content-credentials verification.
- Model ensembling (dedicated AI-image detector) behind the same route.

## Scope of work

Tracked centrally in [`05-scope-of-work/`](../05-scope-of-work/README.md).

| Item | Status | Note |
|---|---|---|
| ELA, noise, edge, region localisation | ✅ Implemented | `image-forensics.ts` plus `elaRegions()` |
| Explainable signal fusion | ✅ Implemented | `image-verdict.ts`, fixed weight table, score reads backwards to evidence |
| Metadata / EXIF / XMP inconsistency | ✅ Implemented | `provenance.ts`, reports absence as a signal |
| C2PA Content Credentials | 🟢 Needs enhancement | Detected and reported as "present, unverified". Chain verification needs the c2pa toolkit |
| GAN fingerprinting | 🟢 Needs enhancement | `spectralArtifacts()` catches synthesis grid regularities. Generator attribution needs a trained classifier |