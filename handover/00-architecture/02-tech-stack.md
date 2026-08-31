# Tech Stack

| Concern | Choice | Version | Notes |
|---------|--------|---------|-------|
| Framework | Next.js (App Router) | 16.x | Turbopack dev; `output: "standalone"` build |
| Runtime | React | 19.x | Server + client components |
| Language | TypeScript | 5.x | `strict: true`; **build ignores type errors** (see below) |
| Styling | Tailwind CSS | v4 | CSS-first `@theme`, no `tailwind.config` colors |
| UI kit | HeroUI | v3 (3.2.2) | react-aria-components + tailwind-variants |
| Legacy UI | shadcn/ui (Radix) | - | `src/components/ui/*`, being migrated to HeroUI |
| State | Zustand | 5.x | `src/lib/store.ts`, `persist` to localStorage |
| Data fetching | TanStack Query + `fetch` | 5.x | Query is available; most tabs use plain `fetch` |
| ORM / DB | Prisma + SQLite | 6.x | `prisma/schema.prisma`, file DB in `db/` |
| AI | provider-agnostic layer | - | `src/lib/ai/*` over `openai` + `@anthropic-ai/sdk`; OpenAI/Anthropic/Kimi/Qwen/local. See [08-ai-provider-layer](08-ai-provider-layer.md) |
| Image processing | sharp | - | ELA, pHash, noise, OCR pre-processing |
| Charts | Recharts | - | dashboards / data-viz |
| Maps | Leaflet | - | threat-intel map |
| Animation | Framer Motion | 12.x | tab transitions (see caveat in app-shell doc) |
| Package manager | **npm** | - | migrated off Bun; `package-lock.json` committed |

## Important build setting

`next.config.ts` sets:

```ts
typescript: { ignoreBuildErrors: true }
reactStrictMode: false
```

**Consequence:** `next build` succeeds even with TypeScript errors. There are pre-existing type errors in a few files (see [`04-operations/03-known-issues.md`](../04-operations/03-known-issues.md)). Run `npx tsc --noEmit` separately to see them. **Enterprise hardening step #1 is to fix those and flip `ignoreBuildErrors` to `false`** so CI catches regressions.

## Environment / secrets

- All configuration is via environment variables - see [`.env.example`](../../.env.example).
- `.env` / `.env.local` → `DATABASE_URL`, `AI_PROVIDER`, `AI_API_KEY`, optional `AI_BASE_URL`/`AI_MODEL`, `SEARCH_PROVIDER`/`SEARCH_API_KEY`.
- **Secrets are gitignored** (`.env*`, plus the obsolete `.z-ai-config`); only `.env.example` is committed. Inject real values via the platform's secret manager in production.

## Why these choices (for context)

- **SQLite** keeps the demo zero-infra. Swap the Prisma datasource to Postgres for multi-user (see [`03-data-model.md`](03-data-model.md)).
- **Provider-agnostic AI** (`src/lib/ai/*`) lets you switch between OpenAI, Anthropic, Kimi, Qwen, or local models via env only - see [`08-ai-provider-layer.md`](08-ai-provider-layer.md).
- **HeroUI v3** was chosen for the revamp because it is Tailwind-v4/React-19 native. Migration state in [`05-design-system-heroui.md`](05-design-system-heroui.md).
