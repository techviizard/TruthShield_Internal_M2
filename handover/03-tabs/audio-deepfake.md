# Tab: Audio Deepfake

**File:** `src/components/tabs/audio-deepfake-tab.tsx` · **Data:** `POST /api/forensics/audio` · **Status:** 🟡 (mock fallback)

## What it is
Detect synthetic/cloned voices: deepfake likelihood, detected speakers, emotion cues, spectral analysis, plus a history list.

## How it's built
Uploads/records audio; the frontend decodes to PCM (Web Audio API) and POSTs to `/api/forensics/audio` → the **audio-DSP engine**. `mockResult`/`mockHistory` (line ~75/126) are offline fallbacks; duration `// mock 3:42` at line ~360 is a constant.

## How it works (logic)
1. Decode audio → PCM16 mono; POST to `/api/forensics/audio`.
2. The DSP engine computes spectral-cutoff / ZCR / spectral-flatness / energy-variance features → deepfake likelihood.
3. The tab renders the verdict, speaker/emotion panels, and spectral view.

## Hardcoded-data note (🟡)
On API failure show an error state (not `setResult(mockResult)`); source history from a real endpoint; derive duration from the decoded audio. See [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- Trained anti-spoofing model (RawNet2/AASIST) behind the route; MFCC/jitter features.
- Server-side decoding (ffmpeg); streaming for long clips.
- Speaker diarization + voiceprint matching against a watchlist.
