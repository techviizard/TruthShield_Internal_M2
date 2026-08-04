# Tab: History

**File:** `src/components/tabs/history-tab.tsx` · **Data:** store `fetchAnalysisHistory` → `/api/analysis/history` · **Status:** ✅

## What it is
Searchable, filterable list of past analyses (type, risk, date), with sort + pagination.

## How it's built
Calls `fetchAnalysisHistory({ type, riskLevel, search, page, limit, sortBy, sortOrder })`; renders the returned `AnalysisReport` rows.

## How it works (logic)
1. Filters/sort/page params → store action → `/api/analysis/history` (Prisma query with `where`/`orderBy`/`skip`/`take`).
2. Renders rows with risk badges; drill into a report.

## Future scope & enterprise enhancements
- Add DB indexes on the filtered columns (`createdAt`, `analysisType`, `riskLevel`).
- Saved searches, bulk actions (add to investigation, export).
- Per-user/org scoping once auth exists.
