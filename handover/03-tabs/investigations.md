# Tab: Investigations

**File:** `src/components/tabs/investigations-tab.tsx` · **Data:** store `fetchInvestigations`/`createInvestigation` → `/api/investigations` · **Status:** ✅

## What it is
Case management: group related analyses into investigations with status, priority, tags, and assignee.

## How it's built
Store actions `fetchInvestigations()` and `createInvestigation(data)` hit `/api/investigations` (+ `/api/investigations/[id]`). Renders the `Investigation` list + detail.

## How it works (logic)
1. Load investigations from the API (Prisma `Investigation` with related `AnalysisReport`s).
2. Create/edit cases; attach analyses; filter by status/priority.

## Future scope & enterprise enhancements
- Assignment + notifications; collaboration (comments, activity feed via AuditLog).
- Link from any analysis/campaign into a case in one click.
- Case export → Report Generator; SLA/priority workflows.
