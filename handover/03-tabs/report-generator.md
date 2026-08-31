# Tab: Report Generator

**File:** `src/components/tabs/report-generator-tab.tsx` · **Data:** `/api/reports/generate` · **Status:** ✅

## What it is
Build a verification report from selected analyses: choose reports, options (metadata, raw JSON), and export HTML (print-to-PDF) or JSON.

## How it's built
Selection UI → `/api/reports/generate` → the **report-generator** engine. Returns HTML or JSON for download/print.

## How it works (logic)
1. Pick `reportIds` + options; POST to `/api/reports/generate`.
2. The engine loads those `AnalysisReport` rows (+ `FactCheckMatch`) and renders HTML or JSON.
3. User prints the HTML to PDF or downloads JSON.

## Future scope & enterprise enhancements
- Server-side PDF (headless Chrome) + digital signatures / chain-of-custody.
- Branded templates, localization, scheduled/batch reports.
- Store artifacts in object storage with retention.
