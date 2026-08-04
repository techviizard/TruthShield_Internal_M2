# System Overview

## What TruthShield is

A single-operator **information-integrity console**. An analyst uses it to:

- analyze **text** for misinformation/propaganda,
- run **image forensics** (ELA, noise, metadata) and **video deepfake** checks,
- **fact-check** claims against the live web,
- detect coordinated **campaigns**, monitor a **live threat feed**, manage **investigations/alerts/watchlists**,
- and view **dashboards / data-viz / model metrics / system health**.

It is a **demo/reference platform**, not yet a multi-tenant SaaS. One implicit user, no auth wall.

## Shape of the system

```
Browser (one SPA)
  └─ src/app/page.tsx  ← shell: sidebar + 28 tabs, tab state in Zustand
        │  each tab is a client component in src/components/tabs/*
        │  tabs call ↓ via fetch()
  API routes  src/app/api/*  (Next.js route handlers, ~36 endpoints)
        │  routes call ↓
   ┌────┴─────────────┬───────────────────────┐
 Engines            AI (provider-agnostic)   Database
 src/lib/engines/*  src/lib/ai/*         src/lib/db.ts → Prisma → SQLite
 (sharp, DSP,       LLM+VLM (+optional search) (prisma/schema.prisma, 19 models)
  TF-IDF, pHash…)
```

**Key idea:** the frontend holds almost no business logic. Tabs render and call APIs. APIs orchestrate engines + AI + DB. Engines are pure, testable functions. This separation is the main thing to preserve.

## Request lifecycle (example: text analysis)

1. `TextAnalysisTab` posts the text to `POST /api/analyze/text`.
2. The route calls `structuredLLMAnalysis()` in `src/lib/ai` (via the provider layer, JSON-forced).
3. It persists an `AnalysisReport` row via Prisma.
4. It returns a typed result; the tab renders trust score, flags, recommendations.
5. Dashboard aggregates (`/api/dashboard/*`) later read those rows back.

## The three layers you will touch most

| Layer | Files | Nature | Docs |
|-------|-------|--------|------|
| Presentation | `src/app/page.tsx`, `src/components/tabs/*`, `src/components/ui/*` | React client components, HeroUI v3 + Tailwind v4 tokens | [`04-app-shell`](04-app-shell-and-routing.md), [`05-design-system`](05-design-system-heroui.md), [`03-tabs/`](../03-tabs/) |
| Orchestration | `src/app/api/*` | Next route handlers | [`02-api/`](../02-api/) |
| Domain logic | `src/lib/engines/*`, `src/lib/ai.ts`, `src/lib/db.ts` | Pure functions + integrations | [`01-engines/`](../01-engines/) |

## What is real vs. demo

Most detection logic is **real** (engines run actual algorithms; AI calls a real model; dashboards aggregate real DB rows). A handful of tabs seed themselves with **mock arrays** as fallback when the DB is empty. Those are being removed — tracked in [`04-operations/01-hardcoded-data-audit.md`](../04-operations/01-hardcoded-data-audit.md).

## Next reads

- [`02-tech-stack.md`](02-tech-stack.md) — exact versions and why.
- [`03-data-model.md`](03-data-model.md) — the 19 Prisma models.
- [`06-state-management-store.md`](06-state-management-store.md) — the Zustand store.
