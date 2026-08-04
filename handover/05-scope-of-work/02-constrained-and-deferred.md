# Constrained and Deferred Scope

Capabilities a reader of the problem statement would expect to find, which are **deliberately not
built**. Each entry records what was asked, why it was not built, what was built instead, and what
would have to change for it to become buildable.

Two different kinds of block appear here, and they should not be confused:

- ⛔ **Constrained** - the capability itself is the problem. Building it creates a tool that can be
  turned against the people it claims to protect. These do not become buildable because a manager
  approves them. They become buildable when a lawful basis, a consent mechanism and an oversight
  process exist around them.
- 🔒 **Gated** - the capability is fine. Something outside engineering blocks it: a licence, an API
  key, a data-sharing agreement, a legal opinion. These are commercial or legal tasks with a
  predictable engineering task on the far side.

---

## ⛔ C1. Facial recognition, face tracking and biometric analysis

**Asked for:** "Face tracking and head movement analysis" (problem statement, deepfake video
detection). By extension: identity matching across frames, facial landmark tracking, rPPG pulse
extraction.

**Not built.** `src/lib/engines/video-temporal.ts` says so in its own header rather than quietly
omitting it.

**Why.** Face tracking that persists an identity across frames is facial recognition. Once the
platform can say "this is the same face in frame 4 and frame 400", it is one small step from "this
is the same face as in the reference photo", and the platform becomes a biometric identification
system. Under the Digital Personal Data Protection Act 2023, facial geometry is personal data
requiring a lawful basis and specific consent from the data principal, who in a deepfake
investigation is usually the *victim* and is not present to consent. rPPG is worse: extracting a
pulse waveform from face video produces health data, the most tightly regulated category there is.

The uncomfortable detail is that this is precisely the capability that makes a deepfake detector
attractive to buyers who want a face-search tool, and the same code serves both purposes. Declining
to build it is the only reliable way to prevent the second use.

**Built instead.** Frame-level forensics that measure the *image*, not the *person*:
per-frame ELA region clustering, noise inconsistency, synthesis grid detection, frame-to-frame
perceptual distance, and the variance of each spatial signal across the clip. A face swap is
detectable as inconsistency between frames without ever identifying whose face it is. The Image
Forensics and Video Analysis tabs state what is and is not measured.

**What would unblock it.** A named deployment with: a documented lawful basis under DPDP, a consent
or legitimate-interest assessment reviewed by a DPO, retention limits on biometric templates,
purpose limitation enforced in code (detection only, never search), and an audit trail on every
biometric operation. That is a compliance programme, not a sprint.

**Related:** PRD 3.5, 3.6, 3.12, 4.10, 2.14.

---

## ⛔ C2. Platform scraping and automated social media ingest

**Asked for:** "Analyse news articles, social media posts", "real-time browser or social media
plugin" (bonus).

**Not built.** No scraper, no headless-browser harvester, no bot-detection bypass, no in-feed DOM
injection on third-party platforms.

**Why.** WhatsApp, X, Facebook, Instagram and YouTube all prohibit automated collection outside
their official APIs. Building a harvester means either violating those terms or defeating the
bot-detection that enforces them, and defeating bot detection is the same technique whether the
motive is research or abuse. A tool that ships with a working scraper ships with a working scraping
capability for whoever holds it next.

The in-feed plugin variant has the same problem in a different shape: injecting a verdict badge into
a live social feed requires DOM manipulation against a platform that forbids it, and it puts a
third-party judgement on someone else's content inside someone else's product.

**Built instead.**
- A Manifest V3 browser extension (`extension/`) that acts **on the user's own request**, on content
  the user is already looking at, and sends it to their own TruthShield instance. The user is the
  actor and the analysis is voluntary. That is a fundamentally different act from harvesting a feed.
- Web search for fact-check retrieval through a configured provider's API, which is the sanctioned
  route to the same information.
- Manual paste and manual upload as the primary ingest paths.

**What would unblock it.** Official API access with the platform's approval: X API enterprise tier,
Meta Content Library (which exists precisely for misinformation research and is granted to
accredited researchers), YouTube Data API. Each has an application process, and each grants a
narrower slice of data than a scraper would take, which is the point.

**Related:** PRD 2.15, 7.2.

---

## ⛔ C3. Automated takedown, mass reporting and enforcement actions

**Asked for:** implied by "Prevent the viral spread of fake news and deepfakes" and "crowd-sourced
flagging and reporting mechanisms" (bonus).

**Not built.** Nothing in the platform files a report with a third party, requests a takedown,
submits an abuse form, or acts on external content on the user's behalf.

**Why.** Automated mass reporting is indistinguishable from a brigading tool. The same endpoint that
submits a thousand well-founded reports submits a thousand malicious ones, and the receiving
platform cannot tell them apart. Coordinated reporting is itself a documented censorship technique
used against journalists and minority communities. A misinformation platform that ships mass
reporting has built the weapon it exists to defend against.

There is a second problem: a takedown request asserts a legal claim. An automated system that files
them at volume is making legal assertions no human reviewed.

**Built instead.** The platform ends at evidence. It produces a scored, explained, exportable report
with a chain of custody (`integrity.ts` fingerprints every artifact at ingest, and the audit log is
hash-linked so tampering is detectable). A human analyst decides what to do with it. Community
reports feed an internal consensus score via `sybil-trust.ts`; they do not leave the building.

**What would unblock it.** A supervised workflow: one report at a time, a named human accountable
for each submission, rate limits, a full audit trail, and a documented appeals path for the content
owner. The engineering is trivial. The governance is the work.

**Related:** PRD 7.7.

---

## ⛔ C4. Identity attribution and deanonymization

**Asked for:** implied by "coordinated misinformation campaigns" and "support law enforcement".

**Not built.** No linking of accounts to real people, no cross-platform identity graph, no
IP-to-person resolution, no attribution of a campaign to a named individual or organisation.

**Why.** Deanonymization tooling harms exactly the people who most need anonymity: journalists,
whistleblowers, dissidents, abuse survivors. Its accuracy is also far worse than its confident
output suggests, and a false attribution in a misinformation investigation is a serious harm to an
innocent person. The Sybil-resistance engine was written with this constraint explicitly in mind.

**Built instead.** `src/lib/engines/sybil-trust.ts` scores **behaviour**, not identity: voting
patterns, account age, agreement with later-confirmed verdicts, and coordination signals between
accounts. It can say "these twelve accounts behave as a coordinated bloc" without asserting who
operates them. `clustering.ts` groups *content* into campaigns by textual similarity. Both produce
actionable intelligence with no personal identification.

**What would unblock it.** Nothing at the product level. Attribution is lawful-authority work
conducted under legal process, by the agency holding that authority, using the platform's evidence
export as one input. The platform should remain a source of evidence, not a source of accusations.

**Related:** PRD 2.14.

---

## ⛔ C5. Synthetic media generation for training or red-teaming

**Asked for:** implied by the need for a labelled training corpus and by any serious accuracy claim.

**Not built.** The platform generates no deepfakes, face swaps, synthetic voices or AI-generated
articles, not even to test its own detectors.

**Why.** A detector project that builds a generator to train against has built a generator. It will
be better than most public tools, because it was tuned specifically to defeat detection. That
artifact does not stay in the lab.

**Built instead.** The evaluation harness (`eval-metrics.ts`, `POST /api/eval`, `npm run eval`) is
corpus-agnostic: it takes labelled `(label, score)` pairs from any source. Corpora belong in `eval/`
and are expected to come from established public research datasets, not from in-house synthesis.

**What would unblock it.** Nothing. Use the public corpora, which is both lawful and better science:
FaceForensics++, DFDC, Celeb-DF, WildDeepfake, ASVspoof for audio. See C6 for their access terms.

**Related:** PRD 6.3.

---

## 🔒 C6. Third-party pretrained detection models

**Asked for:** "Use pretrained deepfake detection models (e.g., MesoNet, Deepware)".

**Not integrated.**

**Why.** Licensing, not policy.

| Model / service | Blocker |
|---|---|
| MesoNet | Research weights, non-commercial by default. Needs the authors' written permission for commercial deployment |
| Deepware Scanner | Commercial API. Paid tier, and its ToS restricts redistributing results inside another product |
| FaceForensics++ baselines | Research use agreement, signed per institution, non-commercial |
| Most Hugging Face deepfake checkpoints | Mixed and often unstated licences. Several are CC-BY-NC. Each needs individual review |

**Built instead.** In-house engines with published logic (`image-forensics.ts`, `video-temporal.ts`,
`audio-dsp.ts`, `image-verdict.ts`). They are weaker than a trained CNN on benchmark accuracy, and
they are fully explainable, licence-clean, offline-capable and free to run. The architecture makes
the swap cheap: routes depend only on the exported function signature, so a model service can
replace an engine's internals without touching a route or a component.

**What would unblock it.** A licence decision per model. For a commercial deployment the realistic
path is a paid Deepware or Sensity subscription behind `video-temporal.ts`'s existing interface, or
training an in-house model on properly licensed data.

**Related:** PRD 3.9.

---

## 🔒 C7. Official fact-checker feeds (PIB, AltNews, Boom)

**Asked for:** "Cross-verify with trusted fact-checking databases (e.g., PIB, AltNews, Boom)".

**Partially built.** `webSearchFactCheck()` scopes queries to these domains and
`src/config/source-domains.ts` ranks them by editorial credibility, so their published fact-checks
do surface. What is missing is structured, reliable, complete retrieval.

**Why blocked.** None of the three publishes a public API. The options are:
1. A data-sharing agreement or MoU with each organisation. Clean, slow, and the right answer for PIB.
2. Scraping. Not done: it needs their written permission, it breaks whenever they redesign, and it
   takes load from organisations running on grant funding.
3. ClaimReview structured data, which Boom and most IFCN signatories publish, aggregated by the
   Google Fact Check Tools API. **This is the recommended route** and it is free.

**What to build.** Google Fact Check Tools API integration behind the existing
`webSearchFactCheck()` signature. It indexes PIB Fact Check, AltNews, Boom, Factly, Vishvas News,
Newschecker and others, returns structured verdicts with claim text and rating, and needs only an
API key. Estimated two days including caching and the UI surface for structured verdicts. This
single task moves PRD 2.6, 2.7, 2.8, 2.9 and 7.3 forward at once.

**Related:** PRD 2.6, 2.7, 2.8, 2.9, 7.3.

---

## 🔒 C8. Court-admissible evidence and law-enforcement export

**Asked for:** "Support law enforcement and fact-checkers with scalable technology".

**Forensic primitives built, legal wrapper not built.**

What exists: SHA-256 and perceptual-hash fingerprinting of every artifact at ingest
(`integrity.ts`), a hash-linked audit log where altering any historical row invalidates every hash
after it, timestamped analysis records, and exportable reports with the full signal breakdown.

What is missing is legal, not technical. In India, electronic evidence is admitted under Section 65B
of the Indian Evidence Act, which requires a certificate signed by a person occupying a responsible
position in relation to the device. That means a named signatory, a defined process, and a
certificate template reviewed by counsel. Adjacent open questions: retention aligned to the relevant
CrPC timelines, disclosure of the detector's error rate to the court (a detector with no published
false-positive rate is difficult to defend under cross-examination, which loops back to PRD 6.2),
and a documented handover procedure.

**What would unblock it.** A legal opinion, a 65B certificate workflow with a named signatory, and a
published accuracy figure from a real labelled corpus. The engineering that follows is small: a
certificate generator wired to the existing chain of custody.

**Related:** PRD 7.10, 6.2, 6.3.

---

## Summary

| ID | Item | Kind | Unblocked by |
|---|---|---|---|
| C1 | Face tracking, recognition, rPPG | ⛔ | DPDP lawful basis + DPO review + purpose limitation in code |
| C2 | Platform scraping, in-feed injection | ⛔ | Official API access (Meta Content Library, X API, YouTube Data API) |
| C3 | Automated takedown and mass reporting | ⛔ | Supervised one-at-a-time workflow with human accountability |
| C4 | Identity attribution, deanonymization | ⛔ | Nothing. Belongs with lawful authority, not with the product |
| C5 | Synthetic media generation | ⛔ | Nothing. Use public research corpora instead |
| C6 | MesoNet, Deepware and similar | 🔒 | A licence decision or a paid subscription |
| C7 | PIB, AltNews, Boom feeds | 🔒 | Google Fact Check Tools API key, two days of work |
| C8 | Court-admissible export | 🔒 | Legal opinion + 65B certificate workflow + published accuracy |

**Read this before adding anything from this list.** The ⛔ entries are not a backlog. They are
boundaries, and the alternatives built in their place are load-bearing parts of the design.
