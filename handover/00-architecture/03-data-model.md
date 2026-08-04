# Data Model

Source of truth: `prisma/schema.prisma` (19 models, SQLite). Access via the singleton in `src/lib/db.ts` (`import { db } from '@/lib/db'`).

> **SQLite caveat:** there are no native arrays/JSON columns. Lists (flags, tags, recommendations, EXIF) are stored as **JSON strings** and `JSON.parse`d in code. When you move to Postgres, convert these to `Json`/`String[]` columns.

## Core entities

```
MediaUpload 1──* AnalysisReport 1──* FactCheckMatch
                      *──1 Investigation
```

### `MediaUpload`
The uploaded artifact (image/video/audio/text). Fields: `fileName, fileType, mimeType, fileSize, storagePath, thumbnailPath, metadata(JSON), status`. **`storagePath` is currently local/absent — production needs object storage (S3/GCS).**

### `AnalysisReport`
The central record. One per analysis run. Fields: `analysisType` (`text_fake_news | image_forensics | video_deepfake | fact_check`), `status`, `results(JSON)`, `trustScore(0-100)`, `riskLevel`, `aiModel`, `processingTime(ms)`, `explanation`, `confidence(0-1)`, `flags(JSON)`, `recommendations(JSON)`. Almost every dashboard number aggregates this table.

### `FactCheckMatch`
Evidence rows attached to an analysis: `source, claim, verdict, confidence, url, snippet, publishedDate`. Also the raw material for source-credibility scoring.

### `Investigation`
Case file grouping analyses: `title, description, status, priority, tags(JSON), assignedTo`.

## Operations / monitoring

| Model | Purpose |
|-------|---------|
| `Alert` | Notifications: `type, severity, title, message, source, isRead, actionUrl` |
| `AuditLog` | Activity trail: `action, resource, details(JSON), ipAddress` |
| `WatchlistItem` | Monitored `keyword/url/hashtag/account` with `hitCount, lastHitAt` |
| `WatchlistHit` | Individual watchlist match events |
| `DashboardStats` | Cached/rolled-up dashboard figures |
| `SystemMetrics` (via engine) | See `system-metrics` engine; health data |

## Intelligence / community

| Model | Purpose |
|-------|---------|
| `PerceptualHash` | Stored pHashes for near-duplicate media lookup |
| `Campaign` + `CampaignMember` | Coordinated-inauthentic-behavior clusters |
| `CommunityReport` + `CommunityVote` | Crowdsourced verification + Sybil-weighted votes |
| `SourceCredibilityScore` | Derived per-domain credibility |
| `WorkflowRule` + `WorkflowExecution` | Automation rules and their run history |
| `UserPreferences` | Per-user settings |

## Conventions

- IDs: `cuid()`.
- Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt`.
- Enums are modeled as **strings with a comment**, not Prisma enums (SQLite). Validate in code; consider real enums on Postgres.

## Commands

```bash
npx prisma db push        # apply schema to the DB (no migration history)
npx prisma generate       # regenerate the client
npx prisma studio         # browse data
npx prisma migrate dev    # create a migration (preferred once on Postgres)
```

## Enterprise enhancements

- Move to **Postgres**; convert JSON-string columns to real `Json`/arrays and string-enums to Prisma `enum`.
- Add `userId` FKs everywhere and **row-level tenancy** for multi-org.
- Add indexes on `AnalysisReport(createdAt, analysisType, riskLevel)` — every dashboard query filters on these.
- Introduce **migrations** (currently `db push`, no history) and seed scripts.
- Object storage for `MediaUpload` binaries + signed URLs.
