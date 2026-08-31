> **CONFIDENTIAL - NOT FOR EXTERNAL DISTRIBUTION**
> Restricted to personnel under NDA with the deploying authority and CyArt.

# PRD Traceability Matrix

Every requirement from the problem statement, mapped to the code that satisfies it and the work that
remains. Status legend: [README.md](README.md).

---

## 1. Develop an AI-based digital media verification tool (web or mobile)

| # | Requirement | Status | Where it lives | What remains |
|---|---|---|---|---|
| 1.1 | Web-based verification tool | ✅ | `src/app/page.tsx`, 30 tabs, 40+ API routes | Nothing |
| 1.2 | Mobile-based | 🟡 | Responsive layout + PWA manifest (`public/manifest.webmanifest`) + installable service worker | Installable PWA works. No native app, no app-store presence, no camera-capture-to-analyse flow |
| 1.3 | Single unified platform across formats | ✅ | Text, image, video, audio, OCR all land in one `AnalysisReport` model | Nothing |

---

## 2. Fake news detection (text-based)

> Analyse news articles, social media posts and headlines.

| # | Requirement | Status | Where it lives | What remains |
|---|---|---|---|---|
| 2.1 | Analyse articles, posts, headlines | ✅ | `POST /api/analyze/text`, `text-analysis-tab.tsx` | Nothing for pasted text |
| 2.2 | Ingest by URL rather than paste | ⏳ | Not built | Article extraction (readability parse), canonical URL resolution, paywall handling |
| 2.3 | Detect clickbait and manufactured urgency | ✅ | `src/lib/engines/text-heuristics.ts`, weighted signal table, offline, explainable per signal | Nothing |
| 2.4 | Detect misleading claims | 🟢 | LLM pass + `text-heuristics` signals + `semantic.ts` stance | Real and explainable. Wants a trained classifier fine-tuned on an Indian-language misinformation corpus to move past lexical cues |
| 2.5 | Detect known hoaxes | ✅ | `src/lib/engines/hoax-match.ts`, near-duplicate match against the recurring-hoax registry using semantic similarity + pHash | Registry is seeded and small. Growing it is content work, not engineering |
| 2.6 | Cross-verify with PIB Fact Check | 🔒 | `webSearchFactCheck()` scopes queries to fact-checker domains; `src/config/source-domains.ts` ranks PIB highest | No public API. As a government deployment, a direct PIB feed is an internal request. See [C7](02-constrained-and-deferred.md#c7) |
| 2.7 | Cross-verify with AltNews | 🔒 | Same path, domain-scoped search | No public API. A data-sharing request is the durable route; Google Fact Check Tools covers them today |
| 2.8 | Cross-verify with Boom | 🔒 | Same path, domain-scoped search | No public API. Boom publishes ClaimReview markup, so the Google Fact Check Tools route in 2.9 covers it |
| 2.9 | Structured fact-check retrieval (ClaimReview / Google Fact Check Tools API) | ⏳ | Not built | This is the single highest-value unblock for 2.6 to 2.8. Google Fact Check Tools API is free, indexes PIB, AltNews, Boom, Factly and Vishvas News, and returns structured verdicts. Estimated two days |
| 2.10 | NLP stance detection | ✅ | `src/lib/engines/semantic.ts`, cue-phrase classification weighted by topical relatedness, reports "unrelated" honestly | Nothing |
| 2.11 | NLP semantic similarity | ✅ | `semantic.ts`, TF-IDF cosine blended with character-trigram Jaccard so it survives Indic morphology and transliteration | Nothing |
| 2.12 | Semantic search over embeddings | 🟢 | Lexical + trigram similarity, no vector model | Works offline and needs no key, which is why it was chosen. A sentence-embedding model (multilingual E5 or IndicBERT) behind the same `semanticSimilarity()` signature would raise recall on paraphrase |
| 2.13 | Coordinated campaign detection | ✅ | `clustering.ts` DBSCAN-lite over TF-IDF cosine, `POST /api/campaigns` | Nothing |
| 2.14 | Author or account attribution | ⛔ | Not in this build | Attribution comes from subscriber data obtained under legal process by the investigating agency. See [C4](02-constrained-and-deferred.md#c4) |
| 2.15 | Automated ingest from WhatsApp, X, Facebook, Instagram | ⛔ | Not in this build | Needs an official API grant or a lawful request through the designated authority. See [C2](02-constrained-and-deferred.md#c2) |

---

## 3. Deepfake video detection

> Accept user-uploaded videos and perform face tracking, lip-sync detection, temporal and spatial
> artifact identification, using pretrained models.

| # | Requirement | Status | Where it lives | What remains |
|---|---|---|---|---|
| 3.1 | Accept user-uploaded video | ✅ | `POST /api/analyze/video`, size and MIME validated from central config | Nothing |
| 3.2 | Temporal artifact identification | ✅ | `src/lib/engines/video-temporal.ts`, frame-to-frame perceptual distance and cross-frame variance of every spatial signal | Nothing |
| 3.3 | Spatial artifact identification | ✅ | `video-temporal.ts` per-frame ELA region clustering, noise inconsistency, synthesis grid detection | Nothing |
| 3.4 | Frame extraction | 🟢 | Browser-side canvas capture, up to 48 frames, posted to `POST /api/analyze/video-frames` | Deliberate: keeps ffmpeg out of the deployment and does decoding on the operator machine. Server-side ffmpeg with scene-change sampling would give denser and more even coverage on long clips |
| 3.5 | Face tracking | ⛔ | Not in this build. `video-temporal.ts` documents the omission in its header | Biometric processing. Needs a DPDP s.17(2)(a) notification or statutory mandate plus purpose limitation in code. See [C1](02-constrained-and-deferred.md#c1) |
| 3.6 | Head movement analysis | ⛔ | Not in this build | Same gate as 3.5. Head pose estimation requires facial landmark tracking |
| 3.7 | Audio-lip sync detection | ⚠️ 🟡 | The VLM prompt in `src/app/api/analyze/video/route.ts` asks for `lipSyncScore` and the tab renders it. No engine computes it | **The number shown is a language model opinion, not a measurement.** Either label it as such in the UI or build a real SyncNet-style detector. See [04](04-claim-vs-implementation.md) |
| 3.8 | Blink irregularity detection | ⚠️ 🟡 | Same: prompted for, rendered, not measured | Same remedy as 3.7 |
| 3.9 | Pretrained deepfake models (MesoNet, Deepware) | 🔒 | Not integrated | MesoNet weights are research-licensed and non-commercial by default; Deepware is a paid API. A procurement decision, then 4 engineer-days. See [C6](02-constrained-and-deferred.md#c6) |
| 3.10 | Audio track deepfake analysis on video | 🟡 | `audio-dsp.ts` exists and runs on standalone audio uploads via `POST /api/forensics/audio` | Video uploads do not split the audio track and route it through the DSP engine. Wiring the two together is a small, high-value task |
| 3.11 | Long-video handling | ⏳ | 48-frame cap regardless of duration | Chunked processing, progress streaming, keyframe pHash storage for source tracing |
| 3.12 | Biological signal detection (rPPG) | ⛔ | Not in this build | rPPG extracts pulse from face video, which is health data under DPDP. Same gate as 3.5, and a research effort rather than an estimate. See [C1](02-constrained-and-deferred.md#c1) |

---

## 4. Image manipulation detection

| # | Requirement | Status | Where it lives | What remains |
|---|---|---|---|---|
| 4.1 | Accept user-uploaded images | ✅ | `POST /api/analyze/image` | Nothing |
| 4.2 | Error Level Analysis (ELA) | ✅ | `image-forensics.ts` `errorLevelAnalysis()` plus `elaRegions()` which localises spliced regions rather than returning one number | Nothing |
| 4.3 | Metadata inconsistency detection | ✅ | `src/lib/engines/provenance.ts`, EXIF and XMP read via sharp, reports absence as a signal | Nothing |
| 4.4 | Photoshop artifact detection | ✅ | `provenance.ts` reads editor software tags, `image-forensics.ts` noise and edge analysis | Nothing |
| 4.5 | C2PA Content Credentials | 🟢 | `provenance.ts` detects a C2PA manifest and reports "present, unverified" | Honest by design: it never claims verification it did not perform. Verifying the signature chain needs the c2pa toolkit plus trust anchors |
| 4.6 | GAN fingerprint detection | 🟢 | `image-forensics.ts` `spectralArtifacts()` detects periodic synthesis grid patterns in the frequency domain | This catches upsampling regularities common to GAN and diffusion output. A true model-attributing fingerprint (which generator produced this) needs a trained classifier and a labelled generator corpus |
| 4.7 | Explainable scoring | ✅ | `image-verdict.ts` fuses signals from a fixed weight table so a score reads backwards to the evidence that produced it | Nothing. This is the strongest piece of the codebase |
| 4.8 | Visual cues for flagged regions | ✅ | ELA region overlay in `image-forensics-tab.tsx` | Nothing |
| 4.9 | Reverse image search | 🟡 | `POST /api/analyze/reverse-image`, honest error state on failure | Depends on the configured search provider. No dedicated reverse-image index (TinEye, Bing Visual Search) is wired in |
| 4.10 | Face-based image identity matching | ⛔ | Not in this build | Same gate as 3.5. See [C1](02-constrained-and-deferred.md#c1) |

---

## 5. Additional requirements

| # | Requirement | Status | Where it lives | What remains |
|---|---|---|---|---|
| 5.1 | Trust score / authenticity rating | ✅ | `trustScore` 0-100 on every `AnalysisReport`, consistent across all five modalities | Nothing |
| 5.2 | Explanations for flagged content | ✅ | Per-signal attribution in `image-verdict.ts` and `text-heuristics.ts`, plus LLM narrative | Nothing |
| 5.3 | Visual cues | ✅ | ELA overlays, per-signal contribution bars, risk chips, frame timeline | Nothing |
| 5.4 | Hindi support | 🟢 | UI locale `messages/hi.json` + Devanagari surface forms in `text-heuristics.ts` and OCR script detection | UI is translated. Detector signal coverage in Hindi is narrower than English and needs a native-speaker review pass |
| 5.5 | Gujarati support | 🟢 | `messages/gu.json` + Gujarati surface forms in the detector | Same as 5.4 |
| 5.6 | Tamil support | 🟡 | Detector carries Tamil surface forms. **No `messages/ta.json`** | UI strings untranslated. `app.config.ts` advertises `ta` in `supportedLanguages` and the file does not exist |
| 5.7 | The other six advertised languages (te, bn, mr, kn, ml, pa) | ❌ | `app.config.ts` `supportedLanguages` lists ten languages. Three locale files exist | Either ship the translations or trim the advertised list. Currently the config overstates support. See [04](04-claim-vs-implementation.md) |
| 5.8 | Media literacy modules | ✅ | `education-resources-tab.tsx`, curriculum copy, deliberately static | Nothing. Content growth is editorial work |
| 5.9 | Awareness modules with progress tracking | ⏳ | Content renders, no per-user progress | Needs the auth layer first |

---

## 6. Evaluation criteria

| # | Criterion | Status | Where it lives | What remains |
|---|---|---|---|---|
| 6.1 | Accuracy measurement harness | ✅ | `src/lib/engines/eval-metrics.ts`, `POST /api/eval`, `npm run eval`, corpora in `eval/` | The harness is real and computes confusion matrix, precision, recall, F1 and threshold sweeps |
| 6.2 | Low false positive rate, evidenced | 🟡 | Harness exists, corpus is a smoke set | A published accuracy figure needs a labelled corpus of meaningful size per modality and language. This is the biggest credibility gap in the project |
| 6.3 | Ground-truth labelled dataset | 🔒 | Not present | Public corpora (FaceForensics++, DFDC, Celeb-DF, ASVspoof) each need a signed research use agreement, straightforward for a government institution. See [C5](02-constrained-and-deferred.md#c5) |
| 6.4 | Model metrics surfaced honestly | ✅ | Model Metrics tab states plainly that no labelled ground truth exists rather than drawing a fabricated ROC curve | Nothing. Preserve this behaviour |
| 6.5 | Speed | 🟢 | In-house engines run in milliseconds, LLM calls dominate latency, real 24h latency tracked at `GET /api/system/latency` | Measured and visible. No load testing has been done |
| 6.6 | Scalability | 🟡 | Single-node Next.js + SQLite | Postgres swap is a one-line Prisma change and is documented. Needs a job queue for video, object storage for uploads, and horizontal scaling before any real load |
| 6.7 | User interface and experience | ✅ | HeroUI v3, 30 tabs, keyboard shortcuts, command palette, dark mode, empty states everywhere | Nothing. No accessibility audit has been run |
| 6.8 | Regional adaptability | 🟢 | `region-extractor.ts` tags Indian cities and regions, threat map renders them | Heuristic gazetteer. A proper geocoding service would widen coverage |

---

## 7. Bonus items

| # | Item | Status | Where it lives | What remains |
|---|---|---|---|---|
| 7.1 | Browser plugin | 🟢 | Full MV3 extension in `extension/`, downloadable via `GET /api/download/extension` | Works when side-loaded. Not published to any store, which needs a developer account and store review |
| 7.2 | Social media plugin (in-feed) | ⛔ | Not in this build | Same gate as 2.15. See [C2](02-constrained-and-deferred.md#c2) |
| 7.3 | News verification API integration | 🔒 | Generic web search scoped to fact-checker domains | Same unblock as 2.9 |
| 7.4 | Media database integration | 🔒 | Not built | Needs commercial agreements (Reuters, AFP, PTI archives) |
| 7.5 | Crowd-sourced flagging | ✅ | `POST /api/community`, `sybil-trust.ts` weighted consensus with anti-gaming | Nothing |
| 7.6 | Reporting mechanism | ✅ | Community reports, investigations, `report-generator.ts` export to HTML and JSON | Nothing |
| 7.7 | Automated reporting to platforms | ⛔ | Not in this build | Needs an IT Act s.69A designation and a per-direction approval workflow. See [C3](02-constrained-and-deferred.md#c3) |
| 7.8 | Offline capability | ✅ | Service worker with network-first documents, IndexedDB analysis queue, and on-device detectors (`text-heuristics.ts`, `hoax-match.ts`) that need no API key | Nothing. The offline path genuinely produces verdicts, it does not just cache a shell |
| 7.9 | Dashboard for fact-checking teams | ✅ | Dashboard, Investigations, Campaign Detection, Live Threat Feed, Data Visualization | Nothing |
| 7.10 | Dashboard for law enforcement | 🟢 | Chain-of-custody fingerprinting at ingest (`integrity.ts`), hash-linked tamper-evident audit log, exportable reports | Forensic primitives are complete. Admissibility needs a Section 65B certificate workflow with a named signatory. See [C8](02-constrained-and-deferred.md#c8) |

---

## 8. Cross-cutting gaps not named in the problem statement

These are not PRD line items, and no deployment is possible without them.

| # | Item | Status | What remains |
|---|---|---|---|
| 8.1 | Authentication and authorization | ❌ | Every API route is public. `next-auth` is in `package.json` and unused. `User.role` exists in the schema and is never checked. This is the number one blocker |
| 8.2 | Input validation at route boundaries | 🟡 | Size and MIME checks on uploads. No schema validation. Add `zod` at every route |
| 8.3 | Rate limiting and quotas | ❌ | Nothing. AI routes are cost-exposed to anyone who can reach them |
| 8.4 | SSRF protection on URL inputs | ❌ | `reverse-image` and video-by-URL fetch arbitrary URLs. Needs an allowlist and internal-IP blocking |
| 8.5 | Unit tests | ❌ | Zero test files. The engines are pure functions and are the easiest thing in the repo to test |
| 8.6 | Windows temp path bug | 🟡 | `src/app/api/analyze/video/route.ts` hardcodes `/tmp`, which does not exist on Windows. Use `os.tmpdir()` |
| 8.7 | Object storage for uploads | ❌ | Files land on local disk or are discarded. Production needs S3-compatible storage with signed URLs |
| 8.8 | Data retention and deletion | ❌ | Analyses persist indefinitely. DPDP requires a retention policy and a deletion path |
