# Tab: Workflows (Automation)

**File:** `src/components/tabs/workflow-automation-tab.tsx` · **Data:** `/api/workflows` (exists, **not called**) · **Status:** 🔴

## What it is
No-code automation: build pipelines of triggers → actions (verify, notify, export, schedule).

## How it's built
Currently a builder UI over inline data; the real endpoint `/api/workflows` (+ `WorkflowRule`/`WorkflowExecution` models) is not wired.

## How it works (logic — intended)
1. Define a `WorkflowRule` (trigger + ordered actions).
2. `/api/workflows` persists rules; an executor runs them and records `WorkflowExecution` rows.
3. The tab lists rules + run history.

## Hardcoded-data note (🔴)
Wire CRUD to `/api/workflows`; render real `WorkflowRule`s + executions; empty state. See [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- A real execution engine (queue/worker) with retries, scheduling (cron), and idempotency.
- Rich trigger/action catalog (webhook, email, Slack, Investigations, export).
- Versioning + dry-run + audit of every execution.
