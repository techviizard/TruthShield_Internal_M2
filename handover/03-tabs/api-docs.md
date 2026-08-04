# Tab: API Docs

**File:** `src/components/tabs/api-docs-tab.tsx` · **Data:** `/api/api-docs` (introspection) · **Status:** ✅

## What it is
Live API reference + example requests for the analyze/factcheck/history endpoints and a sample webhook payload.

## How it's built
Uses the **api-introspect** engine (`/api/api-docs`) to list real routes, plus curated examples referencing `/api/analyze/*`, `/api/factcheck`, `/api/dashboard/stats`, `/api/webhooks/truthshield`.

## How it works (logic)
1. Fetch the route list from `/api/api-docs` (filesystem walk of `src/app/api`).
2. Render endpoints, methods, and example payloads.

## Future scope & enterprise enhancements
- Generate **OpenAPI/Swagger** from the routes (see api-introspect engine doc) and render with a spec viewer.
- API keys + auth docs; "try it" console; versioning.
- Verify introspection works under the `standalone` build (may need a generated manifest).
