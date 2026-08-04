# Tab: Dashboard

**File:** `src/components/tabs/dashboard-tab.tsx` · **Data:** `/api/dashboard/*` + store `dashboardStats` · **Status:** 🟡

## What it is
The landing overview: headline stats (total analyses, threats, deepfakes, trust score, alerts), trend chart, risk distribution, model performance, live ticker, and the threat-intel map.

## How it's built
On mount, fetches `/api/dashboard/sparklines`, `/model-perf`, `/ticker` in parallel (real, DB-derived via the **dashboard-aggregator** engine). Headline `dashboardStats` comes from the store. Renders a skeleton while `!dashboardStats`.

## How it works (logic)
- Live tiles/charts read the three fetched endpoints (`sparklines`, `model-perf`, `ticker`).
- The map uses region-tagged analyses (`region-extractor`).
- Headline numbers read `dashboardStats` from the store.

## Hardcoded-data note (🟡)
`dashboardStats` is initialized to `mockDashboardStats` and `fetchDashboardStats()` is never called. Fix: transform `/api/dashboard/stats` → `DashboardStats`, call it on mount, init `null`. Shape mismatch documented in [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- Time-range filters; per-user/org scoping.
- Materialized rollups + caching (per-request aggregation won't scale).
- Configurable widgets; drill-down from any tile into filtered History.
