> **CONFIDENTIAL - NOT FOR EXTERNAL DISTRIBUTION**
> Restricted to personnel under NDA with the deploying authority and CyArt.

# Delivery Backlog

The remaining work, sequenced. Every item traces to a row in
[01-prd-traceability.md](01-prd-traceability.md) or [04-claim-vs-implementation.md](04-claim-vs-implementation.md).

Effort is engineer-days for one engineer already familiar with the codebase.

---

## Phase 0. Truthfulness (do first, before any demo)

Nothing here adds a feature. All of it removes a false impression, and every item is cheap.

| # | Task | Effort | Traces to |
|---|---|---|---|
| 0.1 | Remove or relabel the unmeasured `lipSyncScore`, `blinkPattern` and `eyeMovementConsistency` fields in the video route and tab | 0.5 | [Claim 1](04-claim-vs-implementation.md) / PRD 3.7, 3.8 |
| 0.2 | Derive `supportedLanguages` from the locale files present in `messages/` so config and reality cannot diverge | 0.5 | [Claim 2](04-claim-vs-implementation.md) / PRD 5.7 |
| 0.3 | Add the 8 missing engines to the engines overview and write a doc for each | 1 | [Claim 3](04-claim-vs-implementation.md) |
| 0.4 | Mark URL-sourced analyses as having no chain of custody in generated reports | 0.5 | [Claim 5](04-claim-vs-implementation.md) |
| 0.5 | Fix the hardcoded `/tmp` path in the video route, use `os.tmpdir()` | 0.1 | PRD 8.6 |

**Phase total: 2.6 days.**

---

## Phase 1. Deployability (nothing ships without this)

| # | Task | Effort | Traces to |
|---|---|---|---|
| 1.1 | Authentication. `next-auth` is already a dependency and unused. Session, login page, protected routes | 3 | PRD 8.1 |
| 1.2 | Authorization. Enforce `User.role` (admin / analyst / viewer) at every route and gate nav items | 2 | PRD 8.1 |
| 1.3 | `zod` schema validation at every API route boundary | 2 | PRD 8.2 |
| 1.4 | Rate limiting and per-user quotas on the AI-calling routes | 1.5 | PRD 8.3 |
| 1.5 | SSRF guard: URL allowlist plus internal and metadata IP blocking on `reverse-image` and video-by-URL | 1 | PRD 8.4 |
| 1.6 | Security headers, CSP, CSRF on mutating routes | 1 | `04-operations/05-security.md` |
| 1.7 | Object storage for uploads (S3-compatible) with signed URLs | 2 | PRD 8.7 |
| 1.8 | Data retention policy and a deletion path, DPDP-aligned | 2 | PRD 8.8 |
| 1.9 | Unit tests for the engines. They are pure functions, so this is fast and high value | 4 | PRD 8.5 |

**Phase total: 18.5 days.**

---

## Phase 2. Close the named PRD gaps

Ordered by value per day.

| # | Task | Effort | Traces to |
|---|---|---|---|
| 2.1 | **Google Fact Check Tools API integration.** Structured verdicts from PIB, AltNews, Boom, Factly, Vishvas News behind the existing `webSearchFactCheck()` signature. Highest value item in the entire backlog | 2 | PRD 2.6-2.9, 7.3 / [C7](02-constrained-and-deferred.md#c7) |
| 2.2 | Route the audio track of an uploaded video through the existing `audio-dsp.ts` engine. The engine already exists and is only wired to standalone audio | 1.5 | PRD 3.10 |
| 2.3 | `messages/ta.json`. The detector already covers Tamil, only the UI is untranslated | 1 | PRD 5.6 |
| 2.4 | URL ingest for text analysis: readability extraction, canonical URL resolution | 2 | PRD 2.2 |
| 2.5 | Remaining locale files (te, bn, mr, kn, ml, pa), plus native-speaker review of the Hindi and Gujarati detector signals | 5 | PRD 5.4, 5.5, 5.7 |
| 2.6 | Labelled evaluation corpus per modality and language, run through the existing harness, publish the accuracy figures. Research use agreements are available to a non-commercial government institution | 5 | PRD 6.2, 6.3 / [C5](02-constrained-and-deferred.md#c5) |
| 2.7 | Server-side ffmpeg frame extraction with scene-change sampling, replacing the 48-frame browser cap | 3 | PRD 3.4, 3.11 |
| 2.8 | C2PA signature chain verification using the c2pa toolkit and trust anchors, upgrading "present, unverified" to actually verified | 3 | PRD 4.5 |
| 2.9 | Sentence-embedding similarity (multilingual E5 or IndicBERT) behind the existing `semanticSimilarity()` signature, keeping the lexical path as the offline fallback | 3 | PRD 2.12 |
| 2.10 | Dedicated reverse-image index (TinEye or Bing Visual Search) | 2 | PRD 4.9 |
| 2.11 | Media literacy progress tracking per user. Depends on 1.1 | 2 | PRD 5.9 |

**Phase total: 29.5 days.**

---

## Phase 3. Scale

| # | Task | Effort | Traces to |
|---|---|---|---|
| 3.1 | Postgres migration. One-line Prisma provider change plus a migration and a load test | 2 | PRD 6.6 |
| 3.2 | Job queue for video and batch analysis, with progress streaming | 4 | PRD 6.6, 3.11 |
| 3.3 | Horizontal scaling: stateless app nodes, shared cache, session store | 3 | PRD 6.6 |
| 3.4 | Load testing and a published throughput figure | 2 | PRD 6.5, 6.6 |
| 3.5 | Accessibility audit against WCAG 2.2 AA | 3 | PRD 6.7 |
| 3.6 | Browser extension store submission (Chrome Web Store, Firefox Add-ons) | 2 | PRD 7.1 |

**Phase total: 16 days.**

---

## Phase 4. Licence-gated work

Procurement tasks with small engineering tails. Start the paperwork now; the engineering estimate
applies once the licence or key is in hand. Tracked in
[02-constrained-and-deferred.md](02-constrained-and-deferred.md).

| # | Task | Instrument | Effort after |
|---|---|---|---|
| 4.1 | Pretrained deepfake model behind `video-temporal.ts` | Research licence. Non-commercial deployment qualifies for MesoNet and FaceForensics++ ([C6](02-constrained-and-deferred.md#c6)) | 4 |
| 4.2 | Section 65B certificate workflow for evidence export | Legal opinion + named signatory ([C8](02-constrained-and-deferred.md#c8)) | 3 |
| 4.3 | PIB direct feed | Internal request within government ([C7](02-constrained-and-deferred.md#c7)) | 2 |

Note that 4.2 depends on backlog item 2.6: a published detector error rate is part of what makes a
65B certificate defensible.

---

## Phase 5. Deployment-gated work

**Not for the sprint board.** Each needs the deploying authority's mandate or a named instrument
before work starts. Raise these with the authority, not the engineering lead. Estimates apply only
after the gate opens.

| # | Task | Instrument | Effort after |
|---|---|---|---|
| 5.1 | Face tracking and landmark consistency | DPDP s.17(2)(a) notification or statutory mandate, accountable officer, purpose limitation in code ([C1](02-constrained-and-deferred.md#c1)) | 8 |
| 5.2 | Lip-sync detection (SyncNet-style). Depends on 5.1 | Same as 5.1 ([C1](02-constrained-and-deferred.md#c1)) | 5 |
| 5.3 | Platform ingest connectors | Official API grant, or lawful request through the designated authority ([C2](02-constrained-and-deferred.md#c2)) | 5 per platform + 3 pipeline |
| 5.4 | Takedown direction workflow with per-direction approval | IT Act s.69A designation, named authorised officer ([C3](02-constrained-and-deferred.md#c3)) | 6 |
| 5.5 | Join lawfully-obtained subscriber data to behavioural clusters | Subscriber data obtained by the investigating agency under legal process ([C4](02-constrained-and-deferred.md#c4)) | 3 |

What is built in place of each of these is listed in
[02-constrained-and-deferred.md](02-constrained-and-deferred.md) and is load-bearing in the current
design. When a gate opens, treat the change as a deliberate migration rather than a cleanup.

---

## Totals

| Phase | Days | Blocking for |
|---|---|---|
| 0. Truthfulness | 2.6 | Any demo or evaluation |
| 1. Deployability | 18.5 | Any deployment with real users |
| 2. PRD gaps | 29.5 | Full problem-statement coverage |
| 3. Scale | 16 | Production load |
| **Schedulable sum** | **66.6** | |
| 4. Licence-gated | 9 | Applies once each licence or key lands |
| 5. Deployment-gated | 30+ | Applies once each instrument exists. Not schedulable |

Roughly three months for one engineer on the schedulable work, or about six focused weeks for two.
Phases 0 and 1 are non-negotiable and account for the first three weeks. Phases 4 and 5 are excluded
from the sum because their start dates are set outside the engineering team.
