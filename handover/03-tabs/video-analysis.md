# Tab: Video Analysis

**File:** `src/components/tabs/video-analysis-tab.tsx` · **Data:** store `analyzeVideo(file)` → `POST /api/analyze/video` · **Status:** ✅

## What it is
Upload a video → deepfake assessment: deepfake probability, frame analysis (flagged frames, consistency), face analysis (faces, anomalies), temporal consistency, audio-visual sync, overall risk.

## How it's built
File-upload form; calls `analyzeVideo(file)`; renders `videoResult` (`VideoAnalysisResult`).

## How it works (logic)
1. `/api/analyze/video` uses the **VLM** (`vlmVideoAnalysis`) with a deepfake-analysis prompt to reason over the video URL/frames.
2. Produces frame/temporal/AV-sync metrics + a risk level; persists an `AnalysisReport`.
3. The tab renders probability, per-signal breakdowns, and the risk verdict.

## Future scope & enterprise enhancements
- **Real frame extraction** (ffmpeg) + per-frame CNN deepfake scores instead of VLM-only reasoning.
- **Lip-sync / biological-signal** (rPPG) detectors for temporal artifacts.
- Long-video chunking + progress streaming; store keyframe pHashes for source tracing.

## Scope of work

Tracked centrally in [`05-scope-of-work/`](../05-scope-of-work/README.md).

| Item | Status | Note |
|---|---|---|
| Temporal + spatial artifact detection | ✅ Implemented | `video-temporal.ts`, real per-frame and cross-frame measurement |
| Frame extraction | 🟢 Needs enhancement | Browser canvas capture, 48-frame cap. Server-side ffmpeg with scene-change sampling is the upgrade |
| Audio-lip sync + blink scores | ⚠️ Overclaimed | Prompted from the VLM and rendered, but never measured. Fix before any demo: [04-claim-vs-implementation](../05-scope-of-work/04-claim-vs-implementation.md) |
| Audio track of a video routed to `audio-dsp.ts` | 🟡 In Progress | Engine exists, only wired to standalone audio uploads |
| Face tracking, head movement, rPPG | ⛔ Constrained | Biometric processing. Deliberately not built: [C1](../05-scope-of-work/02-constrained-and-deferred.md) |
| MesoNet / Deepware | 🔒 Gated | Licensing, not effort: [C6](../05-scope-of-work/02-constrained-and-deferred.md) |