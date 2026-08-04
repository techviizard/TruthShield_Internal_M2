# Tab: Data Visualization

**File:** `src/components/tabs/data-visualization-tab.tsx` · **Data:** `/api/datavis/trends` · **Status:** ✅

## What it is
Analytics deep-dive: threat trends over time, breakdowns by type/risk/geography, radar/pie/bar charts.

## How it's built
Fetches `/api/datavis/trends` (DB-derived) and renders with Recharts. Charts read the brand `--chart-1..5` tokens (orange/teal/amber/emerald/rose).

## How it works (logic)
1. Fetch trend data from `/api/datavis/trends`.
2. Aggregate/shape client-side for each chart.
3. Render responsive Recharts components.

## Future scope & enterprise enhancements
- Server-side aggregation with time-range + filter params (push work off the client).
- Export (CSV/PNG) + shareable views; saved filters.
- Real geographic heatmap (map tiles) instead of a projected scatter.
- Follow the `dataviz` skill's palette/accessibility guidance for new charts.
