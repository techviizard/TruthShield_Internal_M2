# Tab: Source Credibility

**File:** `src/components/tabs/source-credibility-tab.tsx` · **Data:** `/api/source-credibility` (exists, **not called**) · **Status:** 🔴

## What it is
Analyze a news source/domain's reliability, bias, and fact-check track record.

## How it's built
Currently renders from `mockSourceAnalyses`, picking one **at random** on "analyze" (line ~461). The real endpoint `/api/source-credibility` (backed by the DB-derived **source-credibility** engine) is not wired.

## How it works (logic — intended)
1. User enters a domain; call `/api/source-credibility?domain=…`.
2. The engine derives `factualRating`/`biasScore`/`recencyDays`/`type` from `FactCheckMatch` + `AnalysisReport` history.
3. Render the real `SourceScore`.

## Hardcoded-data note (🔴)
Replace the random mock pick with the real API call; empty state for unknown domains. See [audit](../04-operations/01-hardcoded-data-audit.md).
Also has pre-existing type errors (`.text` property) — see [known issues](../04-operations/03-known-issues.md).

## Future scope & enterprise enhancements
- Calibrated bias/stance model; external datasets (MBFC, domain age).
- Persist scores (`SourceCredibilityScore`); admin override with audit.
