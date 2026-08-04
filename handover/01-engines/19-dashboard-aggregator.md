# Engine: Dashboard Aggregator

**File:** `src/lib/engines/dashboard-aggregator.ts` · **Deps:** `db`, `region-extractor` · **Status:** ✅ Real

## What it is
Computes all dashboard/data-viz metrics directly from DB tables. No caching table - everything is derived at query time (fine at current scale). Backs `/api/dashboard/*`.

## How it's built
Exported async functions, each returns a typed slice: `getThreatRegionStats`, `getModelPerformance`, `getSparklines`, `getTicker`, `getLanguageDistribution`. All read `AnalysisReport` / `Alert` / `MediaUpload` via Prisma.

## How it works (logic)
- **Threat region stats:** group analyses by extracted region (via `region-extractor`), bucket by severity → map hotspots.
- **Model performance:** aggregate `confidence`/`processingTime`/`trustScore` across reports.
- **Sparklines:** time-bucketed counts for the mini trend charts.
- **Ticker / language distribution:** recent events + language breakdown for the live strip.

Each function is independent, so the dashboard fetches them in parallel.

## Future scope & enterprise enhancements
- **This is where "remove hardcoded dashboard data" lands.** The main `/api/dashboard/stats` route returns a shape that doesn't match the UI's `DashboardStats` type; align them here and drop `mockDashboardStats` (see `04-operations/01-hardcoded-data-audit.md`).
- Add a **rollup/materialized-stats table** refreshed on a schedule once the DB grows (per-request aggregation won't scale).
- Add caching (Redis) + time-range params.
- Add DB indexes on `AnalysisReport(createdAt, analysisType, riskLevel)`.
