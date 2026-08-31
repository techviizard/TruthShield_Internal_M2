# TruthShield by CyArt

**Information-integrity & deepfake-detection console.** A Next.js app for analysts to detect deepfakes, analyze images/video/audio, fact-check claims, track disinformation campaigns, and manage investigations - backed by real analysis engines, a provider-agnostic AI layer, and a Prisma database.

> **New here?** Read the full engineering handover in [`handover/`](handover/README.md) - it documents every component, its logic, and its roadmap.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **HeroUI v3** UI
- **Prisma** ORM + **SQLite** (swappable to Postgres)
- **Provider-agnostic AI** - OpenAI, Anthropic, Kimi, Qwen, or any local/OpenAI-compatible model
- **npm** for package management

## Prerequisites

- **Node.js 20+** and **npm** (this project migrated off Bun - use npm).
- An API key for your chosen AI provider (or a local model via Ollama / LM Studio).

## Installation

```bash
# 1. Install dependencies (runs `prisma generate` automatically)
npm install

# 2. Configure environment
cp .env.example .env.local
#   → edit .env.local: set DATABASE_URL and your AI_PROVIDER + AI_API_KEY

# 3. Create the database schema and seed the demo account + demo corpus
npm run setup          # = prisma generate + db push + db seed
```

`npm run db:seed` alone re-seeds. It creates the demo analyst account from
`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` / `DEMO_USER_NAME` and (when
`DEMO_SEED_SAMPLE_DATA=true`) a realistic corpus of analyses, alerts, investigations,
watchlist items, community reports, workflow rules and audit entries, so every dashboard
widget renders real database rows.

## Configuration

**All application settings live in one file: [`src/config/app.config.ts`](src/config/app.config.ts).**
It resolves every setting from environment variables with sensible defaults and is the
only module that reads `process.env`. It covers:

- third-party API credentials (web-search providers)
- AI service credentials, provider presets and model selection
- demo/test account credentials (used by the seed script)
- environment-specific settings (app URL, port, database, log level)
- operational parameters (upload limits, page sizes, dashboard refresh/poll intervals, clustering thresholds)
- feature flags

Two exports: `appConfig` (full, server-only - contains secrets) and `publicConfig` /
`GET /api/config` (secret-free subset consumed by client components).

`GET /api` reports whether each integration is actually wired (database reachable, AI key present,
search enabled) - use it as a deployment smoke check.

Copy `.env.example` → `.env.local` and edit; no code changes are needed for any supported setup.
The essentials:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma DB connection (SQLite file by default) |
| `AI_PROVIDER` | `openai` \| `anthropic` \| `kimi` \| `qwen` \| `ollama` \| `lmstudio` \| `custom` |
| `AI_API_KEY` | Key for the selected provider (not needed for local models) |
| `AI_BASE_URL` | Optional endpoint override (required for `custom`) |
| `AI_MODEL` / `AI_VISION_MODEL` | Optional model overrides |
| `SEARCH_PROVIDER` / `SEARCH_API_KEY` | Optional web search (`tavily`/`brave`) for fact-check |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` / `DEMO_USER_NAME` | Demo/test account created by the seed script |
| `MAX_*_UPLOAD_MB`, `*_PAGE_SIZE`, `DASHBOARD_*` | Limits, page sizes and dashboard refresh behaviour |
| `FEATURE_*` | Feature flags (community reports, watchlist scanning, audit log, workflows) |

**Switching AI providers requires no code changes** - just change `.env.local`. See [handover/00-architecture/08-ai-provider-layer.md](handover/00-architecture/08-ai-provider-layer.md).

### Run fully local (no cloud key)

```env
AI_PROVIDER=ollama
AI_MODEL=llama3.1
AI_VISION_MODEL=llava
```
(Start Ollama with those models pulled; no `AI_API_KEY` needed.)

## Development workflow

```bash
npm run dev          # start dev server at http://localhost:3000
npm run lint         # eslint
npm run typecheck    # tsc --noEmit (see Known issues below)
```

Database helpers:

```bash
npm run db:push      # apply schema.prisma to the DB
npm run db:generate  # regenerate the Prisma client
npm run db:migrate   # create a migration (once on Postgres)
```

## Build & deployment

```bash
npm run build        # next build + postbuild (assembles .next/standalone)
npm start            # node .next/standalone/server.js  (production)
```

The app uses Next.js `output: "standalone"`. `npm run build` runs a cross-platform `postbuild` step ([scripts/postbuild.mjs](scripts/postbuild.mjs)) that copies static assets + `public/` into the standalone bundle. Deploy the `.next/standalone` folder (or containerize it) and provide the same environment variables. Detailed notes: [handover/00-architecture/07-build-run-deploy.md](handover/00-architecture/07-build-run-deploy.md).

## Project structure

```
src/
  app/            Next.js App Router - page.tsx (shell) + api/ route handlers
  components/     UI: tabs/ (28 feature tabs), ui/ (primitives)
  lib/
    ai/           provider-agnostic AI layer (config + adapters + helpers)
    engines/      analysis engines (forensics, OCR, TF-IDF, DSP, …)
    store.ts      Zustand global state
    db.ts         Prisma client
  config/         app.config.ts (single source of truth) + source-domains registry
prisma/           schema.prisma (19 models)
handover/         full engineering documentation (start here)
scripts/          build/ops scripts
```

## Known issues

The production build passes, but `next.config.ts` currently sets `typescript.ignoreBuildErrors: true`. A few pre-existing type errors remain - see [handover/04-operations/03-known-issues.md](handover/04-operations/03-known-issues.md). Fixing them and flipping that flag off is the recommended first hardening step.

## Documentation

- [`handover/`](handover/README.md) - architecture, per-component docs, engines, APIs, tabs, operations, and the enterprise roadmap.
- [`handover/04-operations/05-security.md`](handover/04-operations/05-security.md) - **read before deploying** (no auth yet, etc.).

## Contact

CyArt - [inquiry@cyart.io](mailto:inquiry@cyart.io)

## License

Proprietary © CyArt. Internal handover - add a license before external distribution.
# TruthShield_Internal_M2
