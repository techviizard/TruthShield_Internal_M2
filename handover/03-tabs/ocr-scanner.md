# Tab: OCR Scanner

**File:** `src/components/tabs/ocr-scanner-tab.tsx` · **Data:** `POST /api/forensics/ocr` · **Status:** ✅

## What it is
Extract text from images, tuned for Indian scripts (Hindi/Tamil/Bengali/…), with detected language and per-block results.

## How it's built
Image upload → `/api/forensics/ocr` → the **OCR engine** (`sharp` preprocess → VLM extraction → script detection). Renders extracted text, language, confidence, blocks.

## How it works (logic)
1. Upload posts to `/api/forensics/ocr`.
2. Engine deskews/binarizes/denoises the image (`sharp`), sends it to the VLM for extraction, detects scripts by Unicode range, merges a confidence score.
3. The tab shows the text, per-block boxes, and language tags.

## Future scope & enterprise enhancements
- Add Tesseract/PaddleOCR first-pass; VLM only for hard cases (cost/latency).
- Word-level bounding boxes + redaction; multi-page/document batching.
- Feed extracted text into text-analysis/fact-check automatically.
