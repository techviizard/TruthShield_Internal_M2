# Engine: Report Generator

**File:** `src/lib/engines/report-generator.ts` · **Deps:** `db` · **Status:** ✅ Real

## What it is
Generates verification reports without a heavy PDF library — emits standards-compliant **HTML** (browser Print-to-PDF) plus a structured **JSON** export. Backs `/api/reports/generate`.

## How it's built
`generateReport(options)` takes `reportIds`, a title, and flags (`includeMetadata`, `includeRawJson`, `format: 'html' | 'json'`). Pulls the referenced `AnalysisReport` rows and renders.

## How it works (logic)
1. Load the selected analyses (+ related `FactCheckMatch`) from the DB.
2. **HTML format:** render a print-optimized document (header, findings, evidence, metadata) with inline CSS → user prints to PDF.
3. **JSON format:** emit the structured data for programmatic use.
4. Flags toggle metadata and raw-JSON appendices.

Design choice: avoids `puppeteer`/`pdfkit` — zero heavy deps, works offline, and print-to-PDF is good enough for demo/most needs.

## Future scope & enterprise enhancements
- **Server-side PDF** (headless Chrome/Playwright) for automated, pixel-consistent exports + digital signatures.
- Templating (branding, letterhead, multiple report types) and localization.
- Scheduled/batch report jobs; store artifacts in object storage with retention.
- Tamper-evident hashing / chain-of-custody for legal use.
