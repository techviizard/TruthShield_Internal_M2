> **CONFIDENTIAL - NOT FOR EXTERNAL DISTRIBUTION**
> Restricted to personnel under NDA with the deploying authority and CyArt.

# Claim vs Implementation

⚠️ **Highest priority in this folder.** Everything else here is work that is missing. This file
lists places where the product *says* it does something it does not do. A gap is a roadmap item. A
false claim is a defect, because a user acts on it.

The project has a strong track record here: `04-operations/01-hardcoded-data-audit.md` records a
deliberate purge of fabricated data, and several tabs now state plainly that they cannot compute
something rather than inventing it. The items below are what survived that pass.

---

## 1. Video lip-sync and blink scores are model opinion, not measurement

**Where:** `src/app/api/analyze/video/route.ts`, `src/components/tabs/video-analysis-tab.tsx`

The system prompt asks the vision model to return `audioVisualSync.lipSyncScore`,
`faceAnalysis.blinkPattern` and `faceAnalysis.eyeMovementConsistency`. The tab renders these as
numeric and categorical results alongside signals that *are* measured by
`src/lib/engines/video-temporal.ts`.

No code computes them. A vision model shown sampled frames cannot measure lip-sync, because
lip-sync is a relationship between the audio track and the mouth region over time, and the audio
track is never sent to the model. The number is plausible-looking and unfounded.

`video-temporal.ts` is explicit in its own header that it does not do lip-sync scoring. The API
route contradicts the engine.

**Options, in order of preference:**
1. Remove these fields from the prompt and the UI. Cheapest, honest, ships today.
2. Label them in the UI as "model impression, not measured", visually separated from measured
   signals. Preserves the information without the false precision.
3. Build a real detector. A SyncNet-style audio-visual correspondence model is the standard
   approach, and it needs the mouth region, which needs face detection, which sits behind
   [C1](02-constrained-and-deferred.md#c1). Blink detection has the same dependency.

**Recommendation:** option 1 now, since it ships today and removes the false precision. Option 3
becomes backlog item 5.2 once C1 opens.

**Related:** PRD 3.7, 3.8.

---

## 2. `supportedLanguages` advertises ten languages, three exist

**Where:** `src/config/app.config.ts`, `messages/`

```
APP_SUPPORTED_LANGUAGES default: en,hi,ta,te,bn,mr,gu,kn,ml,pa
messages/ contains:        en.json, hi.json, gu.json
```

`publicConfig` exposes this list to the client and `GET /api/config` serves it. Anything that reads
it believes the app supports Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam and Punjabi.
Selecting one of the seven missing locales falls back to English.

The detector layer is a partial exception and deserves credit: `text-heuristics.ts` carries
Devanagari, Gujarati **and Tamil** surface forms for every signal, so Tamil *content analysis*
genuinely works. Only the interface is untranslated.

**Options:**
1. Trim the default to `en,hi,gu` and add each language back as its locale file lands. Honest today.
2. Ship `ta.json` first, since the detector already covers Tamil, making it `en,hi,gu,ta`.
3. Derive the list from the files present in `messages/` at build time so the two can never diverge
   again. This is the durable fix and it is roughly an hour of work.

**Recommendation:** option 3, with option 2 as the immediate content task.

**Related:** PRD 5.6, 5.7.

---

## 3. Handover docs undercount the engines

**Where:** `handover/01-engines/00-engines-overview.md`

The overview table lists 14 engines. `src/lib/engines/` contains 22. Eight have no entry and no doc:

| Engine | What it does | Why the omission matters |
|---|---|---|
| `semantic.ts` | Stance detection + semantic similarity | Directly satisfies PRD 2.10 and 2.11. Its absence makes the project look like it skipped a named requirement |
| `text-heuristics.ts` | Offline multilingual misinformation signal detector | Satisfies PRD 2.3 and underpins the entire offline path |
| `hoax-match.ts` | Near-duplicate matching against the recurring-hoax registry | Satisfies PRD 2.5 |
| `video-temporal.ts` | Frame-level spatial and temporal video forensics | Satisfies PRD 3.2 and 3.3, the only real video detection in the build |
| `image-verdict.ts` | Weighted signal fusion with per-signal attribution | Satisfies PRD 4.7, arguably the best code in the repo |
| `provenance.ts` | C2PA, XMP and EXIF provenance | Satisfies PRD 4.3 and 4.5 |
| `integrity.ts` | SHA-256 and pHash chain of custody, hash-linked audit | Underpins PRD 7.10 |
| `eval-metrics.ts` | Confusion matrix, precision, recall, F1, threshold sweeps | Satisfies PRD 6.1 |

This is an underclaim rather than an overclaim, and it is still a defect: a reviewer scoring the
project against the problem statement reads the handover, not the source tree, and would conclude
that stance detection, hoax matching and temporal video forensics were never built.

**Fix:** add the eight rows to the overview table and write a doc for each following the existing
four-section template. Estimated one day.

---

## 4. Root README status legend is superseded

**Where:** `handover/README.md`

The root README defines a three-state legend (Real, Partial, Demo). The per-component docs use it.
This folder defines an eight-state legend that separates work the team can schedule from work
waiting on an instrument, which is the distinction the project most needs to communicate.

**Fix:** point the root README at [README.md](README.md) as the canonical legend and migrate the
per-component status markers as each doc is touched. Do not do a mass rewrite; migrate on contact.

---

## 5. Video analysis by URL fingerprints nothing

**Where:** `src/app/api/analyze/video/route.ts`

When a video arrives as a URL rather than an upload, no bytes are hashed, so `sha256` is null on
both the `MediaUpload` row and the audit entry. The route handles this honestly (there is a comment
saying exactly that, and the audit entry records the null rather than a fake hash), so this is not a
false claim in the code.

It becomes one at the report layer: an exported report carries a chain-of-custody section that reads
as complete whether or not a fingerprint exists. A URL-sourced analysis has no evidentiary chain and
the report should say so prominently.

**Fix:** mark URL-sourced analyses as "no evidentiary chain of custody" in
`report-generator.ts` output and in the Investigations evidence view.

**Related:** PRD 7.10, [C8](02-constrained-and-deferred.md#c8).

---

## Summary

| # | Claim | Severity | Fix cost |
|---|---|---|---|
| 1 | Lip-sync and blink scores presented as measured | High | Hours (remove or relabel) |
| 2 | Ten languages advertised, three shipped | High | Hours (derive list from files) |
| 3 | Engine overview undercounts 22 engines as 14 | Medium | One day |
| 4 | Two competing status legends | Low | Migrate on contact |
| 5 | Chain of custody implied for URL-sourced video | Medium | Hours |

Items 1 and 2 should be fixed before any demo or evaluation. Both are hours of work, and both are
the kind of thing an evaluator finds.
