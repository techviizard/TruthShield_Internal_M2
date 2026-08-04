# Tab: Text Analysis

**File:** `src/components/tabs/text-analysis-tab.tsx` · **Data:** store `analyzeText` → `POST /api/analyze/text` · **Status:** ✅

## What it is
Paste text → get a misinformation/propaganda assessment: trust score, risk level, flags, detected claims, sentiment, propaganda indicators, recommendations.

## How it's built
Thin form component. Reads/writes `textInput`, `selectedLanguage` in the store; calls `analyzeText()`; renders `textResult` (`TextAnalysisResult`). Loading via `isAnalyzing`.

## How it works (logic)
1. User enters text; `analyzeText()` POSTs to `/api/analyze/text`.
2. The route calls `structuredLLMAnalysis()` (AI provider, JSON-forced) with a misinformation-analysis system prompt, persists an `AnalysisReport`, returns the typed result.
3. The tab renders the trust gauge, flag list, claims, sentiment, recommendations.

## Future scope & enterprise enhancements
- Show **explainability** (highlight the spans that triggered each flag).
- Multi-language prompt tuning (Indic languages) + per-language model selection.
- Batch/paste-URL ingestion; store history per user.
- Confidence calibration + human-review queue for borderline scores.
