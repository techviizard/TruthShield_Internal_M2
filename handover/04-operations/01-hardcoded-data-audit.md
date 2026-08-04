# Hardcoded-Data Audit & Removal Playbook

**Status: closed.** Every mock/demo dataset listed in earlier revisions of this document has been
removed. All tabs now read from the database or from a measuring engine, and render an explicit
empty state when there is nothing to show.

Two supporting changes made that possible:

1. **Central configuration** — `src/config/app.config.ts` is the single place any setting comes from
   (AI + search credentials, demo account, environment, limits, dashboard intervals, feature flags,
   clustering thresholds). Nothing else reads `process.env`. `GET /api/config` exposes the
   secret-free subset to client components; `GET /api` reports live integration status.
2. **Seed script** — `npm run db:seed` (`prisma/seed.ts`) creates the demo account from config plus a
   realistic corpus (analyses, alerts, investigations, watchlist, community reports, workflow rules,
   source scores, audit entries). "Demo mode" is now *seeded data in the database*, not inline arrays.

## What each surface reads now

| Surface | Source of truth |
|---|---|
| Dashboard stats, trends, risk mix, activity, top threats, trust histogram, detection timeline, languages | `GET /api/dashboard/stats` (all computed from `AnalysisReport`/`Alert`) |
| Dashboard sparklines / model perf / ticker | `/api/dashboard/sparklines`, `/model-perf`, `/ticker` |
| Dashboard platform health card | `/api/system/health` + `/api/config` |
| Investigations (incl. evidence + timeline) | `/api/investigations` — evidence is the case's linked analyses |
| Alerts, notification centre | `/api/alerts` (read state persisted via PATCH) |
| Watchlist | `/api/watchlist` (create/update/delete all persist) |
| Community + leaderboard + badges | `/api/community` (consensus via the sybil-trust engine) |
| Campaign detection | `/api/campaigns` (TF-IDF clustering, thresholds from config) |
| Network / provenance graph | `/api/network-graph` |
| Model metrics | `/api/model-metrics`, `/api/dashboard/model-perf`, `/api/config` |
| System health | `/api/system/health` + new `/api/system/latency` (real 24h latency + failed analyses) |
| Source credibility | `/api/source-credibility` (citations + curated registry, per-domain lookup) |
| Audio deepfake | `/api/forensics/audio`; waveform/duration decoded from the uploaded clip; history from `/api/analysis/history?type=audio_deepfake` |
| OCR scanner | `/api/forensics/ocr` (now persists an `ocr_scan` report); history from analysis history |
| Media comparison | `/api/forensics/compare` (pHash + pixel diff + real EXIF/metadata diff) |
| Reverse image search | `/api/analyze/reverse-image` (error state on failure — no sample results) |
| Live threat feed | `/api/live-feed` |
| Audit log | `/api/audit/logs` |
| Workflows + execution history | `/api/workflows` |
| Report generator "recent reports" | `report_exported` entries in the audit log |
| Data Visualization (key metrics, trends, risk mix, type mix, region heat-map, platform comparison) | `/api/datavis/trends` (extended) + `/api/dashboard/stats`, `/model-perf`, `/sparklines` |
| Settings (profile + integrations) | `/api/config` — provider/model/limits and key-present status; secrets never rendered |
| API Docs (base URL, version, auth status, curl examples) | `/api/config` (`APP_URL`, `APP_VERSION`) |
| Upload limits shown in Image Forensics / Reverse Search / Batch | `/api/config` limits via `useAppConfig()` |

## Deliberate omissions (no data exists to back them)

These were previously fabricated and are now **not shown** rather than invented:

- **ROC curve / confusion matrix / precision-recall** on Model Metrics — the platform has no
  labelled ground-truth set. The tab states this explicitly.
- **Model version history / training runs** — no model registry exists.
- **Speaker diarization and emotion scoring** on Audio Deepfake — the in-house DSP engine does not
  produce them; the panels say so.
- **Infrastructure inventory** (CDN, auth service, deployment history) on System Health — replaced by
  the integrations the app actually has.
- **Browser-extension store metrics** (install counts, star ratings, store links) — the extension is a
  concept; the tab now says so instead of quoting invented numbers.
- **API key issuance / bearer-token onboarding** in API Docs — this build is single-tenant with no auth
  layer; the quick start now documents `.env.local` configuration instead.

## Not "data" — intentionally static

- `education-resources-tab.tsx` learning content (curriculum copy).
- `browser-extension-tab.tsx` browser **mockup** (a UI illustration).
- `src/components/ui/sidebar.tsx` `Math.random()` skeleton shimmer width (cosmetic).
- `batch-analysis.tsx` `Math.random()` for a unique id.
- `src/config/source-domains.ts` editorial reference registry — a reviewed constant, surfaced in the
  UI as "editorial reference rating" alongside the observed, DB-derived rating.

## If you add a new surface

1. Add its setting(s) to `src/config/app.config.ts` (and `.env.example`), never `process.env` inline.
2. Read data from an API route backed by Prisma or an engine.
3. Render an empty state when there are no rows — never a placeholder dataset.
