# Deployment-Gated and Licence-Gated Scope

Capabilities named or implied by the problem statement that are **not in this build**, and that will
not become buildable through engineering effort alone. Each needs an instrument, an accreditation or
a licence from outside the engineering team first.

TruthShield is built for deployment by an Indian government authority. That materially changes what
is available: several capabilities below are lawful for a state instrumentality acting under a
statutory mandate and are not lawful for a private operator. The gate is therefore **the deploying
authority's mandate and paperwork**, not an engineering decision, and this document exists so that
the incoming team can tell at a glance which items are theirs to schedule and which are procurement
or legal workstreams.

Two gate kinds appear here:

- ⛔ **Deployment-gated** - needs the deploying authority's mandate, a notified exemption, or a
  named accountable officer before the work starts. Effort estimates apply only after the gate opens.
  Do not schedule these into a sprint.
- 🔒 **Licence-gated** - needs a licence, a paid subscription, an API grant or a data-sharing
  agreement. Ordinary engineering on the far side.

Each entry records what was asked, what is in the build today, what instrument opens the gate, and
the engineering estimate once it does.

---

## ⛔ C1. Facial recognition, face tracking and biometric analysis

**Asked for:** "Face tracking and head movement analysis". By extension: identity persistence across
frames, facial landmark tracking, voiceprint matching, rPPG pulse extraction.

**In the build today.** `src/lib/engines/video-temporal.ts` measures the image, not the person:
per-frame ELA region clustering, noise inconsistency, synthesis grid detection, frame-to-frame
perceptual distance, and the variance of each spatial signal across the clip. A face swap is
detectable as inconsistency between frames without identifying whose face it is. The engine header
and the Video Analysis tab both state what is and is not measured, so no user is misled about the
current capability.

**What opens the gate.** Facial geometry, voiceprints and rPPG-derived pulse are biometric and
health data under the Digital Personal Data Protection Act 2023. A state instrumentality can process
them, and the exemption is not automatic. The deploying authority needs:

1. A notification under DPDP s.17(2)(a) covering this system, or processing conducted under an
   existing statutory mandate that already authorises biometric processing.
2. A named data-protection officer or equivalent accountable officer for the deployment.
3. Purpose limitation recorded and enforced in code: detection only, never open-set face search.
   This is the control that keeps a deepfake detector from becoming a face-search index, and it is
   the single most important requirement for the engineering team to implement correctly.
4. Retention limits on biometric templates, and biometric operations written to the existing audit
   chain (`integrity.ts` already provides the tamper-evident log this hooks into).

**Estimate once open:** 8 engineer-days for face tracking and landmark consistency, plus 5 for
lip-sync (see [04-claim-vs-implementation.md](04-claim-vs-implementation.md) item 1, which depends
on this gate). rPPG is a research effort, not an estimate.

**Related:** PRD 3.5, 3.6, 3.7, 3.8, 3.12, 4.10.

---

## ⛔ C2. Platform ingest from social media

**Asked for:** "Analyse news articles, social media posts", "real-time browser or social media
plugin".

**In the build today.**
- A Manifest V3 browser extension (`extension/`) that analyses content the operator is already
  viewing, on the operator's request, against their own TruthShield instance.
- Web search for fact-check retrieval through a configured provider's API.
- Manual paste and manual upload.

**What opens the gate.** Automated collection from WhatsApp, X, Meta platforms and YouTube outside
their official APIs breaches those platforms' terms, and the resulting evidence is weaker precisely
where it matters most: content obtained in breach of a platform's terms invites a challenge to its
admissibility, and the collection method itself becomes the subject of cross-examination. The route
that produces court-usable evidence is sanctioned access:

| Source | Instrument |
|---|---|
| Meta (Facebook, Instagram) | Meta Content Library research access, or a s.91 CrPC / IT Act s.69 request through the designated authority |
| X | X API enterprise tier, or the same lawful-request route |
| YouTube | YouTube Data API |
| WhatsApp | No collection API exists. Content arrives through the operator or through lawful request to the intermediary under the IT Rules |

For a government deployment the lawful-request route is generally faster than the research-access
route and produces stronger evidence. Both are procurement or legal workstreams.

**Estimate once open:** 5 engineer-days per platform connector, plus 3 for a common ingest pipeline.

**Related:** PRD 2.15, 7.2.

---

## ⛔ C3. Automated takedown and reporting to platforms

**Asked for:** implied by "Prevent the viral spread of fake news and deepfakes".

**In the build today.** The platform ends at evidence. It produces a scored, explained, exportable
report with a chain of custody: `integrity.ts` fingerprints every artifact at ingest with SHA-256
and a perceptual hash, and the audit log is hash-linked so altering any historical row invalidates
every hash after it. An analyst decides what to do with the report. Community reports feed an
internal consensus score via `sybil-trust.ts` and do not leave the deployment.

**What opens the gate.** A takedown or blocking direction is a legal act with a defined process. In
India that process runs through IT Act s.69A and the IT Rules 2021, executed by the designated
officer of the authorised agency, with the review committee and the intermediary's grievance
mechanism attached. Automating it requires:

1. The authority's designation under s.69A and a named authorised officer.
2. A one-direction-at-a-time workflow with that officer's approval recorded per action. Bulk
   automated submission is not a shortcut here: it removes the human authorisation the statute
   requires, and it is the difference between a lawful direction and an unreviewable action.
3. Full audit trail per direction, which the existing hash-linked audit log already supports.
4. The content owner's appeal path documented, because the Rules require it.

**Estimate once open:** 6 engineer-days for the workflow, approval queue and per-direction audit.

**Related:** PRD 7.7.

---

## ⛔ C4. Identity attribution

**Asked for:** implied by "coordinated misinformation campaigns" and "support law enforcement".

**In the build today.** `src/lib/engines/sybil-trust.ts` scores **behaviour**: voting patterns,
account age, agreement with later-confirmed verdicts, and coordination signals between accounts. It
reports that a set of accounts behaves as a coordinated bloc without asserting who operates them.
`clustering.ts` groups content into campaigns by textual similarity. Both produce actionable
intelligence with no personal identification, and both are usable as investigative leads.

**What opens the gate.** Attribution of an account to a person requires subscriber information the
platform does not hold and cannot infer reliably. It comes from the intermediary under IT Act s.91
CrPC process or the equivalent, executed by the investigating agency. That is by design the right
shape: the platform supplies the evidence and the behavioural analysis, the agency holds the legal
authority and obtains the identity through a process that produces admissible, challengeable
results.

Building inferred attribution instead would put an unverified accusation about a named person into
an evidence pack. That is a defect in the evidence, not a feature, and it is the first thing defence
counsel attacks.

**Estimate once open:** 3 engineer-days to ingest lawfully-obtained subscriber data and join it to
existing behavioural clusters. The join is trivial; the instrument is the work.

**Related:** PRD 2.14.

---

## ⛔ C5. Synthetic media generation for training corpora

**Asked for:** implied by the need for a labelled training corpus and by any accuracy claim.

**In the build today.** The evaluation harness (`eval-metrics.ts`, `POST /api/eval`, `npm run eval`)
is corpus-agnostic: it consumes labelled `(label, score)` pairs from any source. Corpora live in
`eval/`.

**What opens the gate.** Nothing needs to open. Established public research corpora are better
science than in-house synthesis, because a detector tuned against a generator you also built
measures how well it beats that generator and nothing else. Use FaceForensics++, DFDC, Celeb-DF,
WildDeepfake, and ASVspoof for audio. Each requires a signed research use agreement, which is the
🔒 gate in C6 and is straightforward for a government institution.

If an in-house corpus is later required for Indian-language or Indian-face coverage that the public
sets lack, the correct route is commissioned collection with consent from paid participants, not
generation. That produces a corpus that can be cited in court; a synthetic one cannot.

**Estimate:** corpus acquisition is a 5-day workstream (see backlog 2.6), not an engineering gate.

**Related:** PRD 6.3.

---

## 🔒 C6. Third-party pretrained detection models

**Asked for:** "Use pretrained deepfake detection models (e.g., MesoNet, Deepware)".

**In the build today.** In-house engines with published logic: `image-forensics.ts`,
`video-temporal.ts`, `audio-dsp.ts`, `image-verdict.ts`. Weaker than a trained CNN on benchmark
accuracy; fully explainable, licence-clean, offline-capable, and free to run. Routes depend only on
the exported function signature, so a model service can replace an engine's internals without
touching a route or a component.

**What opens the gate.**

| Model / service | Instrument needed |
|---|---|
| MesoNet | Research weights, non-commercial by default. Written permission from the authors, or reimplementation and training on licensed data |
| Deepware Scanner | Paid API subscription. Its terms restrict redistributing results inside another product, so the deployment contract needs to cover this |
| FaceForensics++ baselines | Research use agreement, signed per institution |
| Hugging Face deepfake checkpoints | Mixed and often unstated licences, several CC-BY-NC. Individual review per checkpoint |

For a government deployment the cleanest path is a procurement decision: a commercial detection
subscription behind the existing engine interface, or an in-house model trained on licensed data.

**Estimate once open:** 4 engineer-days to place a model service behind `video-temporal.ts`.

**Related:** PRD 3.9.

---

## 🔒 C7. Official fact-checker feeds (PIB, AltNews, Boom)

**Asked for:** "Cross-verify with trusted fact-checking databases (e.g., PIB, AltNews, Boom)".

**In the build today.** `webSearchFactCheck()` scopes queries to these domains and
`src/config/source-domains.ts` ranks them by editorial credibility, so their published fact-checks
do surface. Retrieval is unstructured and incomplete.

**What opens the gate.** None of the three publishes a public API.

1. **Google Fact Check Tools API.** Free, indexes PIB Fact Check, AltNews, Boom, Factly, Vishvas
   News and Newschecker via ClaimReview markup, returns structured verdicts with claim text and
   rating. **Recommended, and it needs only an API key.**
2. **Direct feed from PIB.** As a government deployment this is an internal request rather than an
   external one, and PIB Fact Check is a unit of the same government. Worth pursuing in parallel
   with option 1; it is likely the highest-quality source available to this deployment.
3. Scraping AltNews and Boom is not the route: it breaks on redesign, takes load from
   grant-funded organisations, and produces retrieval that cannot be relied on in an evidence pack.
   A data-sharing request to each is the durable version.

**Estimate:** 2 engineer-days for option 1, including caching and the structured-verdict UI. This
one task moves PRD 2.6, 2.7, 2.8, 2.9 and 7.3 at once and is the highest-value item in the backlog.

**Related:** PRD 2.6, 2.7, 2.8, 2.9, 7.3.

---

## 🔒 C8. Court-admissible evidence export

**Asked for:** "Support law enforcement and fact-checkers with scalable technology".

**In the build today.** The forensic primitives are complete: SHA-256 and perceptual-hash
fingerprinting of every artifact at ingest, a hash-linked audit log where altering any historical row
invalidates every subsequent hash, timestamped analysis records, and exportable reports carrying the
full signal breakdown.

**What opens the gate.** Electronic evidence is admitted under Section 65B of the Indian Evidence
Act, which requires a certificate signed by a person occupying a responsible position in relation to
the device. That needs:

1. A named signatory in the deploying authority and a documented signing process.
2. A certificate template reviewed by counsel, generated from the existing chain of custody.
3. A published detector error rate. A detector with no measured false-positive rate is difficult to
   sustain under cross-examination, which makes backlog item 2.6 (labelled corpus and published
   accuracy) a dependency of this gate rather than a separate nice-to-have.
4. Retention aligned to the relevant CrPC timelines.

**Estimate once open:** 3 engineer-days for the certificate generator against the existing chain of
custody.

**Related:** PRD 7.10, 6.2, 6.3.

---

## Summary

| ID | Item | Gate kind | Instrument that opens it | Estimate after |
|---|---|---|---|---|
| C1 | Face tracking, recognition, rPPG | ⛔ | DPDP s.17(2)(a) notification or statutory mandate, accountable officer, purpose limitation in code | 13 d |
| C2 | Platform ingest from social media | ⛔ | Official API grant, or lawful request through the designated authority | 5 d per platform |
| C3 | Automated takedown | ⛔ | s.69A designation, named authorised officer, per-direction approval workflow | 6 d |
| C4 | Identity attribution | ⛔ | Subscriber data obtained by the investigating agency under legal process | 3 d |
| C5 | Synthetic training corpora | ⛔ | Not required. Use public research corpora, or commissioned collection with consent | 5 d (acquisition) |
| C6 | MesoNet, Deepware and similar | 🔒 | Licence decision or paid subscription | 4 d |
| C7 | PIB, AltNews, Boom feeds | 🔒 | Google Fact Check Tools API key; PIB direct feed as an internal request | 2 d |
| C8 | Court-admissible export | 🔒 | Legal opinion, 65B certificate workflow, published accuracy figure | 3 d |

**How to use this table.** The 🔒 rows are procurement tasks with small engineering tails and should
be started now, C7 first. The ⛔ rows should not enter a sprint until the named instrument exists;
raise them with the deploying authority rather than the engineering lead. What is built in their
place is listed under each entry and is load-bearing in the current design, so removing an
alternative when its gate opens is a deliberate migration, not a cleanup.
