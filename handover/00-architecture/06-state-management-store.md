# State Management — the Zustand store

File: `src/lib/store.ts` (~1000 lines). Single global store created with `create()` and wrapped in `persist` (localStorage). Import with `import { useAppStore } from '@/lib/store'`.

## What lives in the store

| Group | Examples | Notes |
|-------|----------|-------|
| Navigation/UI | `activeTab`, `sidebarOpen` | drives the shell |
| Analysis inputs | `textInput`, `selectedLanguage`, `analysisSensitivity` | form state |
| Analysis results | `textResult`, `imageResult`, `videoResult`, `factCheckResult` | last run per type |
| Domain lists | `watchlistItems`, `communityReports`, `investigations`, `alerts` | client mirrors of DB data |
| Dashboard | `dashboardStats` | fetched via `fetchDashboardStats()` |
| Async actions | `analyzeText`, `analyzeImage`, `analyzeVideo`, `verifyFact`, `fetchDashboardStats`, `fetchInvestigations`, `createInvestigation`, `fetchAlerts`, `fetchAnalysisHistory`, `sendChatMessage` | each `fetch`es an API and `set()`s the result |

## Pattern

Async actions do the fetch **inside the store**, not the component:

```ts
analyzeText: async () => {
  set({ isAnalyzing: true })
  const res = await fetch('/api/analyze/text', { … })
  const data = await res.json()
  set({ textResult: transform(data), isAnalyzing: false })
}
```

Components call `useAppStore(s => s.analyzeText)()` and read the result reactively. This keeps API glue in one place.

## Types

Rich domain types are declared at the top of the file (`TextAnalysisResult`, `ImageAnalysisResult`, `VideoAnalysisResult`, `FactCheckResult`, `Investigation`, `Alert`, …) and the `AppState` interface (line ~161). These are the contract between API responses and the UI — update them together.

## ⚠️ Data-integrity issues to know (being fixed)

- **Confidence jitter (line ~629):** image-analysis mapping added `+ Math.random()*20 - 10` to a real confidence value — fabricated precision. **Removed** in the hardcoded-data pass; see [`04-operations/01-hardcoded-data-audit.md`](../04-operations/01-hardcoded-data-audit.md).
- **`dashboardStats` seeded with a mock object (line ~423):** initial value was `mockDashboardStats`. Moving to `null` + an empty/loading state so the UI never shows fabricated numbers before `fetchDashboardStats()` returns.

## `persist` caveat

The whole store persists to localStorage. That means stale results and lists survive reloads. For multi-user/enterprise:

- Partialize `persist` to **UI prefs only** (`activeTab`, theme, sensitivity), never analysis results or domain data.
- Move domain lists (investigations/alerts/watchlist) to **TanStack Query** (already a dependency) so they're server-authoritative, cached, and refetched — not hand-mirrored in Zustand.

## Future scope

- Split this 1000-line store into slices (`createSlice` pattern): ui-slice, analysis-slice, domain-slice.
- Replace hand-rolled `fetch` actions with TanStack Query mutations/queries for retries, caching, and optimistic updates.
- Add error state per action (currently mostly boolean `isAnalyzing`); surface API failures in the UI consistently.
