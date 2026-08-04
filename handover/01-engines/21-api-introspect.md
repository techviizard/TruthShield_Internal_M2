# Engine: API Introspection

**File:** `src/lib/engines/api-introspect.ts` · **Deps:** Node `fs`/`path` · **Status:** ✅ Real

## What it is
Auto-documents the API by walking the `src/app/api` directory at runtime. Replaces hardcoded API-docs content in the API Docs tab. Backs `/api/api-docs`.

## How it's built
`listRoutes()` → `RouteInfo[]` (`path`, `methods`, `file`, optional `description`). Reads the filesystem, not a static list.

## How it works (logic)
1. Recursively walk `src/app/api` for `route.ts` files.
2. Convert each file path to its URL (`/api/...`), handling `[param]` segments.
3. Detect exported HTTP methods (`GET`/`POST`/`PATCH`/`DELETE`) by scanning the file.
4. Optionally pull a leading doc-comment as the description.

Result: the API Docs tab is always in sync with the real routes — add a route and it appears automatically.

## Future scope & enterprise enhancements
- Emit an **OpenAPI/Swagger** spec (parse zod schemas or JSDoc for request/response shapes).
- Include auth requirements + example payloads.
- Note: filesystem walking assumes the source layout is present at runtime — verify it works under the `standalone` build (may need to bundle a generated manifest instead).
