# Tab: Model Metrics

**File:** `src/components/tabs/model-metrics-tab.tsx` · **Data:** `/api/model-metrics` (exists, **not called**) · **Status:** 🔴

## What it is
AI model performance: accuracy, false-positive rate, latency, A/B comparisons, API usage.

## How it's built
Renders a mock data block (line ~130). The real endpoint `/api/model-metrics` is not wired.

## How it works (logic — intended)
1. Fetch `/api/model-metrics` (derive from `AnalysisReport.confidence/processingTime/aiModel` + outcomes).
2. Render accuracy/latency/usage charts.

## Hardcoded-data note (🔴)
Wire to `/api/model-metrics`; empty state until data. See [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- True eval harness with **labeled ground truth** (precision/recall/ROC), not just aggregate confidence.
- Model registry + A/B experiment tracking; drift detection.
- Cost/usage dashboards per model/provider.
