# Engine: Audio DSP (voice-deepfake features)

**File:** `src/lib/engines/audio-dsp.ts` · **Deps:** none (pure TS) · **Status:** ✅ Real

## What it is
Server-side digital-signal-processing to flag synthetic/cloned voices. No native audio libs. Feeds the Audio Deepfake tab via `/api/forensics/audio`.

## How it's built
Accepts decoded **PCM16 mono samples + sample rate**. Parses WAV headers itself (`parseWav`); for MP3/AAC the frontend decodes with Web Audio API and POSTs raw PCM. `fftMagnitude` computes spectra; `analyzeAudio` returns an `AudioFeatures` object.

## How it works (logic)
Four complementary heuristics (synthetic audio betrays itself differently than mic-captured):
- **Spectral cutoff:** many generators cap energy at 16/22 kHz; real mics reach ~44 kHz. A low cutoff is suspicious.
- **Zero-crossing rate (ZCR):** synthetic speech is unnaturally smooth → abnormal ZCR.
- **Spectral flatness:** high flatness ≈ white-noise-like → synthetic background/artifacts.
- **Energy variance:** synthetic voices have a flatter amplitude envelope than natural speech.

These combine into a deepfake likelihood score.

## Future scope & enterprise enhancements
- Replace heuristics with a **trained anti-spoofing model** (RawNet2 / AASIST) behind `analyzeAudio`.
- Add **MFCC + pitch-jitter/shimmer** features (classic vocoder tells).
- Move decoding server-side (ffmpeg) so the client doesn't need Web Audio.
- Stream/chunk long files; current design assumes the whole clip in memory.
