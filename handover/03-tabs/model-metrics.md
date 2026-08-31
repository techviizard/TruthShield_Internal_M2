# Tab: Model Metrics

**File:** `src/components/tabs/model-metrics-tab.tsx` · **Data:** `/api/model-metrics` (exists, **not called**) · **Status:** 🔴

## What it is
AI model performance: accuracy, false-positive rate, latency, A/B comparisons, API usage.

## How it's built
Renders a mock data block (line ~130). The real endpoint `/api/model-metrics` is not wired.

## How it works (logic - intended)
1. Fetch `/api/model-metrics` (derive from `AnalysisReport.confidence/processingTime/aiModel` + outcomes).
2. Render accuracy/latency/usage charts.

## Hardcoded-data note (🔴)
Wire to `/api/model-metrics`; empty state until data. See [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- True eval harness with **labeled ground truth** (precision/recall/ROC), not just aggregate confidence.
- Model registry + A/B experiment tracking; drift detection.
- Cost/usage dashboards per model/provider.

## Scope of work

Tracked centrally in [`05-scope-of-work/`](../05-scope-of-work/README.md).

| Item | Status | Note |
|---|---|---|
| Metrics engine (confusion matrix, P/R/F1, threshold sweep) | ✅ Implemented | `eval-metrics.ts`, `POST /api/eval`, `npm run eval` |
| Honest empty state where no ground truth exists | ✅ Implemented | Preserve this. The tab states the limit rather than drawing a fake ROC curve |
| Labelled ground-truth corpus | 🔒 Licence-gated | Public corpora need signed research use agreements: [C5](../05-scope-of-work/02-constrained-and-deferred.md) |
| Published accuracy figures | 🟡 In Progress | Dependency of the 65B certificate work in [C8](../05-scope-of-work/02-constrained-and-deferred.md) |