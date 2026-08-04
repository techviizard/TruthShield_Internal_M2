# TruthShield - Engineering Handover

> **Audience:** Incoming engineers taking over TruthShield for further development.
> **Goal of this folder:** explain *how every component is built*, *the logic behind how it works*, and *what to build next* (future scope + enterprise-grade enhancements) - one document per component.

TruthShield is an **information-integrity / deepfake-detection console**: a single-page Next.js app with ~28 feature tabs, backed by ~36 API routes, 14 analysis engines, and a 19-model Prisma/SQLite database. The AI layer is provider-agnostic (OpenAI / Anthropic / Kimi / Qwen / local).

---

## How to read this folder

Start here, then go top-to-bottom. Each numbered area builds on the one before it.

| # | Folder | What it covers |
|---|--------|----------------|
| 00 | [`00-architecture/`](00-architecture/) | The big picture: stack, data model, app shell, design system, state, build/deploy. **Read this first.** |
| 01 | [`01-engines/`](01-engines/) | The analysis engines (`src/lib/engines/*`) - the real algorithms. This is where the "logic" lives. |
| 02 | [`02-api/`](02-api/) | The API routes (`src/app/api/*`) - how the frontend talks to the engines and DB. |
| 03 | [`03-tabs/`](03-tabs/) | The 28 feature tabs (`src/components/tabs/*`) - one doc each. |
| 04 | [`04-operations/`](04-operations/) | Cross-cutting: hardcoded-data audit, testing, security, enterprise roadmap. |
| 05 | [`05-scope-of-work/`](05-scope-of-work/README.md) | **What is left to build.** Problem-statement traceability, the gated-scope register, the sequenced backlog, and the claim-vs-implementation list. **CONFIDENTIAL** - NDA personnel only. |

## Document template

Every component doc follows the same four-section shape so they're predictable:

1. **What it is** - one-paragraph purpose + where it lives.
2. **How it's built** - structure, key dependencies, data in/out.
3. **How it works (logic)** - the actual algorithm / control flow, step by step.
4. **Future scope & enterprise enhancements** - what a production/enterprise version needs.

## Onboarding in 30 minutes

1. Read [`00-architecture/01-system-overview.md`](00-architecture/01-system-overview.md).
2. Skim [`00-architecture/03-data-model.md`](00-architecture/03-data-model.md) with `prisma/schema.prisma` open.
3. Run the app: [`00-architecture/07-build-run-deploy.md`](00-architecture/07-build-run-deploy.md).
4. Pick one feature you'll touch and read its tab doc + the engine/API it calls.

## Status legend

The canonical legend now lives in [`05-scope-of-work/README.md`](05-scope-of-work/README.md). It has
eight states, because the three below cannot express the distinction that matters most here: work
that is *missing* versus work that was *deliberately not built* for policy or regulatory reasons.

Older component docs still use the original three states. Migrate them on contact, not in bulk.

- ✅ **Real** - backed by a working engine/DB, production-ready logic.
- 🟡 **Partial** - real logic with gaps (e.g. seeded fallback, needs an API).
- 🔴 **Demo** - currently placeholder/needs a backing service before production.

A live index of component status is in [`04-operations/01-hardcoded-data-audit.md`](04-operations/01-hardcoded-data-audit.md).
What remains to be built is in [`05-scope-of-work/`](05-scope-of-work/README.md).
