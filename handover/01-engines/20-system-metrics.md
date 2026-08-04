# Engine: System Metrics

**File:** `src/lib/engines/system-metrics.ts` · **Deps:** Node `os`/`process`, `db` · **Status:** ✅ Real

## What it is
Real OS/process health metrics for the System Health tab — CPU, memory, uptime, DB counts. No external monitoring agent. Backs `/api/system/health`.

## How it's built
`getSystemHealth()` → `SystemHealth`. `getCpuUsagePct()` samples CPU. Uses Node's `os` (load, memory, cpus) and `process` (uptime, memory usage) plus a few DB counts for app-level stats.

## How it works (logic)
- **CPU %:** takes two `os.cpus()` samples and diffs idle-vs-total time between them (stored in `prevCpuSample`) — the standard way to derive instantaneous CPU load in Node.
- **Memory:** `os.totalmem/freemem` + `process.memoryUsage()`.
- **Uptime / load:** `process.uptime()`, `os.loadavg()`.
- **App health:** live DB row counts (queue depth, recent activity).

## Future scope & enterprise enhancements
- **Time-series:** currently instantaneous. Add a `SystemMetrics` table sampled on an interval so the tab can show real history (this removes the synthetic sin/cos series in `system-health-tab.tsx` — see audit doc).
- Export **Prometheus** metrics + Grafana dashboards; this in-process engine only sees one instance.
- Per-dependency health checks (DB, AI provider, storage) with status + latency.
