# Engine: OCR

**File:** `src/lib/engines/ocr.ts` · **Deps:** `sharp`, AI provider VLM (`vlmImageAnalysis`) · **Status:** ✅ Real

## What it is
Optical character recognition tuned for Indian scripts. `sharp` preprocess → VLM text extraction → script detection + confidence merge. Backs the OCR Scanner tab via `/api/forensics/ocr`.

## How it's built
`preprocessForOcr(buffer)` cleans the image; `runOcr()` sends it to the VLM and parses `OcrResult` (`text`, `language`, `confidence`, `blocks` with optional bounding boxes); `detectScripts()` identifies scripts present.

## How it works (logic)
1. **Preprocess (the real engineering):** deskew, binarize, denoise with `sharp` - this materially improves VLM accuracy on photographed/low-quality text.
2. **Extract:** call the configured VLM (via the AI provider layer) as a lightweight OCR model (avoids bundling tesseract/transformers.js).
3. **Script detection:** inspect Unicode ranges to tag Devanagari/Tamil/Bengali/Latin etc.
4. **Confidence merge:** combine VLM confidence with preprocessing/character signals into a 0–100 score.

Design note: using the VLM instead of a dedicated OCR lib trades some accuracy/latency for zero extra heavy deps.

## Future scope & enterprise enhancements
- Add **Tesseract / PaddleOCR** as a first pass; use the VLM only for hard cases (cost + latency).
- Return **word-level bounding boxes** consistently for redaction/highlighting.
- Language-model post-correction for OCR noise.
- Batch/queue large documents; current path is one image per call.
