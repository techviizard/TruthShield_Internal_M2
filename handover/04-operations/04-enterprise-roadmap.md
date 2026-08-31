# Enterprise-Grade Roadmap

TruthShield today is a capable **single-operator reference app**. To become an enterprise platform, work these themes. Each individual component doc has its own "Future scope" - this is the cross-cutting plan and suggested order.

> **Scope of work.** This roadmap describes the *enterprise* trajectory. What is required to satisfy
> the original problem statement, what was deliberately not built and why, and a costed sequence are
> tracked separately in [`05-scope-of-work/`](../05-scope-of-work/README.md). Read that first: some
> items a reader would expect here (face tracking, platform scraping, automated takedown, identity
> attribution) are absent by design and are recorded in
> [02-constrained-and-deferred.md](../05-scope-of-work/02-constrained-and-deferred.md) rather than
> scheduled here.

## Phase 1 - Correctness & foundation (do first)
- Fix pre-existing TypeScript errors and flip `ignoreBuildErrors: false` ([known issues](03-known-issues.md)).
- Complete the [hardcoded-data removal](01-hardcoded-data-audit.md); add a `prisma/seed.ts` so "demo mode" = seeded DB, not inline mocks.
- Add the first tests (engines + one API) and a CI gate ([testing](02-testing-strategy.md)).

## Phase 2 - Multi-tenancy & data
- Migrate SQLite → **Postgres**; convert JSON-string columns to real `Json`/arrays, string-enums to Prisma enums, add indexes and **migrations**.
- Add `userId`/`orgId` FKs + **row-level tenancy**; object storage (S3/GCS) for media with signed URLs.
- Move domain lists to TanStack Query (server-authoritative); partialize the Zustand `persist` to UI-only.

## Phase 3 - AuthN/Z & security
- SSO/OIDC, RBAC on nav + routes, secrets manager, input validation, rate limits, SSRF/CSP hardening ([security](05-security.md)).
- Tamper-evident audit; per-tenant data retention + delete.

## Phase 4 - Scale & reliability
- **Job queue/workers** for analyze/report/scan (retries, concurrency, scheduling) instead of client/inline execution.
- Caching (Redis) + materialized dashboard rollups.
- Real-time transport (WebSocket/SSE) for alerts/live-feed.
- Containerize (standalone output), healthchecks, autoscaling; observability (metrics/logs/traces, Sentry).

## Phase 5 - Detection quality
- Replace heuristics with trained models behind the existing engine signatures: image manipulation (CNN/PRNU/C2PA), video (frame CNN + rPPG/lip-sync), audio (RawNet2/AASIST), text (multilingual embeddings + stance).
- An **eval harness** with labeled ground truth (precision/recall/ROC) + model registry, A/B, and drift detection ([model-metrics](../03-tabs/model-metrics.md)).
- Cross-lingual (Indic) coverage across OCR, fact-check, clustering.

## Phase 6 - Platform & UX
- Finish the HeroUI primitive-adapter migration; delete unused Radix deps; add light theme + visual regression.
- Promote heavy tabs to real routes + lazy-load (deep-linking, smaller bundles) ([app-shell](../00-architecture/04-app-shell-and-routing.md)).
- Ship the browser extension + public API (OpenAPI, keys, webhooks).

## North-star architecture
Multi-tenant, queue-backed detection platform: Postgres + object storage, model-serving behind stable engine interfaces, real-time ops, full auth/audit/observability, and an eval-driven model lifecycle - with the current clean **UI → API → engine** separation preserved throughout.
