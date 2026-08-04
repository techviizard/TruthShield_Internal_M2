# Tab: System Health

**File:** `src/components/tabs/system-health-tab.tsx` · **Data:** `/api/system/health` (+ others) · **Status:** 🟡 (synthetic series)

## What it is
Infrastructure/ops view: CPU, memory, uptime, service status, queue, and throughput charts.

## How it's built
Fetches `/api/system/health` (real, via the **system-metrics** engine). But the throughput time-series (lines ~236-238) is **synthetic** (`sin/cos + Math.random`).

## How it works (logic)
1. `/api/system/health` returns real CPU/mem/uptime + DB counts.
2. The tab renders gauges + status; the trend chart currently fabricates history.

## Hardcoded-data note (🟡)
Replace the synthetic series with real history: add a `SystemMetrics` time-series table sampled on an interval; render empty until data exists. See [audit](../04-operations/01-hardcoded-data-audit.md) + system-metrics engine doc.
Note: pre-existing type errors here (`.bg`/`.color`) — see [known issues](../04-operations/03-known-issues.md).

## Future scope & enterprise enhancements
- Prometheus/Grafana; per-dependency health (DB/AI provider/storage) with latency.
- Multi-instance aware (the in-process engine only sees one node).
- Alerting on thresholds → Alerts pipeline.
