# Engine: Audit Logger

**File:** `src/lib/engines/audit-logger.ts` · **Deps:** `db`, `NextRequest` · **Status:** ✅ Real

## What it is
Thin helper to write `AuditLog` rows from any API route, so the Audit Log tab shows real events (not mock). Backs the audit trail.

## How it's built
`recordAudit(entry)` inserts an `AuditLog` row; `clientIp(req)` extracts the caller IP; `listAudit()` reads rows for the tab. `AuditAction` is a typed union (`analysis_completed`, `alert_triggered`, `investigation_created`, …).

## How it works (logic)
1. A route calls `recordAudit({ action, resource, details, req })` after a meaningful operation.
2. The helper resolves the client IP (`clientIp`) and serializes `details` to JSON.
3. Inserts an `AuditLog` row (`action`, `resource`, `details`, `ipAddress`, `createdAt`).
4. `listAudit()` powers the Audit Log tab.

## Future scope & enterprise enhancements
- **Call it everywhere:** many routes don't record audit events yet — that's why the tab still falls back to mock. Wire `recordAudit` into every mutating route (see audit doc).
- Make audit writes **tamper-evident** (hash chaining / append-only store) for compliance.
- Add actor identity once auth exists (`userId`), plus before/after diffs for changes.
- Ship to a SIEM; add retention + export.
