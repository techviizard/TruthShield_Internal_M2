# API Layer Overview

~36 route handlers under `src/app/api/*` (`route.ts` files). They are the orchestration layer: validate input → call engines / AI / DB → return JSON. No business logic should live in the UI; heavy logic lives in engines, not here - routes glue them together.

## Conventions

- **Handlers:** export `GET`/`POST`/`PATCH`/`DELETE`. Return `NextResponse.json(...)`.
- **DB:** `import { db } from '@/lib/db'` (Prisma singleton).
- **AI:** helpers in `src/lib/ai.ts` (`structuredLLMAnalysis`, `vlmImageAnalysis`, `vlmVideoAnalysis`, `webSearchFactCheck`).
- **Engines:** `import { … } from '@/lib/engines/*'`.
- **Shape:** most return `{ success, …data }`. **Not standardized** - a shared response envelope + error format is a recommended enhancement.

## Route families

| Family | Routes | Backed by |
|--------|--------|-----------|
| Analyze | `/api/analyze/{text,image,video,reverse-image}` | ai.ts (LLM/VLM) + image-forensics + persists `AnalysisReport` |
| Fact check | `/api/factcheck` | `webSearchFactCheck` + LLM + `FactCheckMatch` |
| Forensics | `/api/forensics/{compare,ocr,audio}` | phash/image-forensics, ocr, audio-dsp engines |
| Dashboard | `/api/dashboard/{stats,threats,model-perf,sparklines,ticker}` | dashboard-aggregator |
| Data viz | `/api/datavis/trends` | DB aggregation |
| Intelligence | `/api/{campaigns,network-graph,source-credibility,live-feed}` | clustering, tfidf/phash, source-credibility |
| Case/ops | `/api/{investigations,alerts,watchlist,community,workflows,audit/logs}` | respective models + engines |
| System | `/api/system/health`, `/api/model-metrics`, `/api/api-docs` | system-metrics, api-introspect |
| Export | `/api/export`, `/api/reports/generate` | report-generator |

## Per-route detail

The logic each route depends on is documented in the **engine** docs ([`01-engines/`](../01-engines/)) and the **tab** docs ([`03-tabs/`](../03-tabs/)) that call them. Rather than duplicate, trace: *tab → store action or fetch → route → engine doc*.

## Cross-cutting enhancements (enterprise)

- **Validation:** add `zod` schemas per route (input + output); reject bad payloads with 400.
- **Standard envelope:** `{ ok, data, error }` + consistent HTTP codes.
- **Auth/authorization:** every route is currently public. Add auth middleware + role checks (`User.role`).
- **Rate limiting + quotas**, especially on AI/analyze routes (cost control).
- **Audit:** call `recordAudit()` from every mutating route (see audit-logger engine).
- **Observability:** structured logs + error tracking; correlate by request id.
- **Idempotency** for analyze/report jobs; move long jobs to a queue.
