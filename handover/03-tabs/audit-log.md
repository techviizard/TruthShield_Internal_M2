# Tab: Audit Log

**File:** `src/components/tabs/audit-log-tab.tsx` · **Data:** `/api/audit/logs` · **Status:** 🟡 (mock fallback)

## What it is
Activity timeline: who did what, when - analyses, alerts, investigations, config changes.

## How it's built
Fetches `/api/audit/logs` (`AuditLog` model). Falls back to `generateMockEntries()` (line ~39) when the DB is empty (line ~421).

## How it works (logic)
1. Load audit rows from `/api/audit/logs`.
2. Render a filterable timeline (action/resource/time/ip).

## Hardcoded-data note (🟡)
Remove the mock fallback → empty state. The real fix is upstream: call the **audit-logger** engine (`recordAudit`) from every mutating route so the log is actually populated. See [audit](../04-operations/01-hardcoded-data-audit.md) + audit-logger engine doc.

## Future scope & enterprise enhancements
- Tamper-evident (hash-chained/append-only) storage for compliance.
- Actor identity once auth exists; before/after diffs; SIEM export + retention.
