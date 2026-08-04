# Build, Run & Deploy

## Prerequisites

- **Node.js 20+** and **npm** (the project migrated off Bun).
- An AI provider configured via env (`AI_PROVIDER` + `AI_API_KEY`), or a local model (Ollama/LM Studio). See [08-ai-provider-layer](08-ai-provider-layer.md) and [`.env.example`](../../.env.example).
- `.env.local` with `DATABASE_URL` (SQLite path, e.g. `file:./db/custom.db`).

## First-time setup

```bash
npm install               # also runs `prisma generate` (postinstall)
cp .env.example .env.local
#   → edit .env.local (DATABASE_URL, AI_PROVIDER, AI_API_KEY)
npm run db:push           # create/sync the SQLite schema
```

## Run (development)

```bash
npm run dev               # next dev -p 3000 (Turbopack)
```

Open http://localhost:3000. Hot reload is on. AI-dependent tabs need a valid provider key (or a running local model); without it those routes error and the tab shows its error/empty state.

## Type-check & lint

```bash
npx tsc --noEmit          # type errors (build ignores these — run manually!)
npm run lint              # eslint
```

## Build (production)

```bash
npm run build             # next build + postbuild (assembles standalone, cross-platform)
npm start                 # node .next/standalone/server.js
```

`next.config.ts` uses `output: "standalone"`, so `.next/standalone/` is a self-contained server. The `postbuild` step ([scripts/postbuild.mjs](../../scripts/postbuild.mjs)) copies `.next/static` and `public/` into the bundle using Node's `fs.cp` — **cross-platform** (works on Windows/macOS/Linux, no Bun/Unix `cp`).

## Database commands

```bash
npm run db:push           # prisma db push
npm run db:generate       # prisma generate
npm run db:migrate        # prisma migrate dev (once on a migration-capable DB)
npm run db:reset          # prisma migrate reset (DROPS data)
```

## Reverse proxy

`Caddyfile` is present for fronting the app with Caddy (TLS/routing). Review before production use.

## Deploy notes / enterprise

- **Secrets:** inject `DATABASE_URL` and AI provider keys (`AI_API_KEY`) via the platform's secret manager; do **not** ship `.env`/`.env.local` with real values.
- **DB:** SQLite is single-file/single-writer — fine for demo, **not** for concurrent production. Move to Postgres (`03-data-model.md`).
- **Containerize:** the standalone output maps cleanly to a small Node image. Add a `Dockerfile` + healthcheck hitting `/api/system/health`.
- **CI gate:** flip `ignoreBuildErrors` to `false`, run `tsc` + `lint` + tests in CI (none exist yet — see `04-operations/02-testing-strategy.md`).
- **Observability:** add structured logging + error tracking (Sentry) around API routes and engine calls; the current DB client logs raw SQL (`log: ['query']`) — noisy for prod, turn down.
