# Known Issues

Snapshot at handover. The production build **passes** (`next build` green) because `next.config.ts` sets `ignoreBuildErrors: true` - but `npm run typecheck` (`tsc --noEmit`) reports the following **6** errors. Fix these, then flip that flag off.

## Pre-existing TypeScript errors (UI type gaps - not from the revamp/migration)

| File | Line | Error | Fix hint |
|------|------|-------|----------|
| `src/components/tabs/network-analysis-tab.tsx` | 96 | `"missing"` not assignable to `"clean" \| "warning" \| "danger"` | add `"missing"` to the union or map it |
| `src/components/tabs/source-credibility-tab.tsx` | 670, 1008, 1070 | `.text` missing on `{ color; bg; border }` | the status object has no `text` key - add it or use `color` |
| `src/components/tabs/system-health-tab.tsx` | 410, 411 | `.bg`/`.color` missing on status object | align the status-map type with usage |

> Fixed during handover: the `reverse-image` null-arg error (null-guard added) and the old `src/lib/ai.ts` ZAI-constructor error (that file was removed in the provider-agnostic migration).

## Behavioral / design notes

- **Framer Motion `mode="wait"`** can freeze tab content when the page isn't visible (rAF paused). See [app-shell doc](../00-architecture/04-app-shell-and-routing.md). Not a real-user bug; surprises automated tests.
- **`fetchDashboardStats` is never called** and `/api/dashboard/stats` shape ≠ UI `DashboardStats` type. See [hardcoded-data audit](01-hardcoded-data-audit.md).
- **No auth** on any route; **SQLite** single-writer; **localStorage** persists analysis results. See [enterprise roadmap](04-enterprise-roadmap.md).
- **Secrets** (`AI_API_KEY`, `DATABASE_URL`) live in `.env.local` (gitignored). The obsolete `.z-ai-config` is also gitignored. Inject real values via a secret manager in production.

## Hardcoded/mock data

Tracked separately and in detail in [`01-hardcoded-data-audit.md`](01-hardcoded-data-audit.md) with per-item removal steps.
