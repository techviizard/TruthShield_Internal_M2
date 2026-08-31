# Testing Strategy

**Current state: there are no automated tests.** This is the single biggest risk for handover. Below is a pragmatic order to add them.

## 1. Unit-test the engines first (highest ROI)

`src/lib/engines/*` are pure functions with clear inputs/outputs - ideal for unit tests. Start with the deterministic ones:

- `tfidf` - tokenization, TF-IDF weights, cosine sim (known vectors).
- `phash` - dHash stability (same image → same hash; tiny edit → small Hamming distance) using fixtures.
- `clustering` - synthetic docs that must/mustn't cluster.
- `sybil-trust` - consensus math with crafted vote sets (incl. sybil attempts).
- `region-extractor`, `source-credibility` (with a seeded test DB).

Suggested tooling: **Vitest** (fast, TS-native). Put image/audio fixtures under `src/lib/engines/__fixtures__/`.

## 2. API route tests

Spin up a test SQLite DB (or Prisma test schema), hit each route with valid/invalid payloads, assert shape + DB side-effects. **Mock the AI provider layer** (`src/lib/ai`) so tests are deterministic and free.

## 3. Component/UI tests

- React Testing Library for tab logic (form → action → render states, incl. **empty/error states** - especially important as mock fallbacks are removed).
- Contract tests: the API response shape must match the store's TypeScript types (the dashboard shape-mismatch bug would have been caught here).

## 4. E2E + visual

- **Playwright** for critical flows (analyze text/image, fact-check, create investigation).
- Visual regression keyed on the **design-token contract** (light/dark) - see design-system doc.

## 5. CI gate

Add a CI pipeline that runs `tsc --noEmit`, `eslint`, and the test suites; **flip `next.config.ts` `ignoreBuildErrors` to `false`** so type regressions fail the build. Add coverage thresholds once the engine suite exists.

## Quick wins checklist

- [ ] Add Vitest + one engine test (phash) to establish the pattern.
- [ ] Mock the AI provider; test `/api/analyze/text` happy + error path.
- [ ] Fix the pre-existing type errors ([known issues](03-known-issues.md)) and turn on the type-check gate.
