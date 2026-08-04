> **CONFIDENTIAL - NOT FOR EXTERNAL DISTRIBUTION**
> Restricted to personnel under NDA with the deploying authority and CyArt.
> Do not quote, export or paste into external tools, tickets or vendor correspondence.

# Gated Scope

Capabilities named or implied by the problem statement that are **not in this build**. Each needs
something from outside the engineering team before work starts: an instrument, an accreditation, or
a licence.

TruthShield is a non-commercial system deployed by an Indian government authority. That widens what
is available: several items below are open to a state instrumentality or to a non-commercial
institution and would be closed to a commercial vendor. Where that applies it is noted.

## The table

| ID | Capability | What opens it | Owner | Days after |
|---|---|---|---|---|
| C1 | Face tracking, landmark consistency, voiceprint, rPPG | Notification under DPDP s.17(2)(a), or an existing statutory mandate covering biometric processing. Named accountable officer | Authority | 13 |
| C2 | Automated ingest from WhatsApp, X, Meta, YouTube | Lawful request through the designated authority, or an official API grant | Authority | 5 per platform + 3 pipeline |
| C3 | Takedown and blocking directions | IT Act s.69A designation, named authorised officer | Authority | 6 |
| C4 | Attribution of an account to a person | Subscriber data obtained by the investigating agency under legal process | Agency | 3 |
| C5 | Labelled ground-truth corpora | Research use agreements. **Non-commercial government institution qualifies** | CyArt | 5 (acquisition) |
| C6 | Pretrained detection models | Research licences. **Non-commercial deployment qualifies for most** | CyArt | 4 |
| C7 | PIB, AltNews, Boom structured feeds | Google Fact Check Tools API key. PIB is an internal request | CyArt | 2 |
| C8 | Court-admissible evidence export | Section 65B certificate template, named signatory, published error rate | Legal | 3 |

**Start C5, C6, C7 now.** All three are open to this deployment and none needs the authority's
mandate. C7 is two days and moves five problem-statement rows at once.

**C1 to C4 are not sprint items.** Raise them with the authority. The estimate applies after the
instrument exists, not before.

---

## Notes per item

Only what is not obvious from the table.

**C1 - biometrics.** In the build today: `video-temporal.ts` measures the image, not the person. Per-frame
ELA region clustering, noise inconsistency, synthesis grid detection, frame-to-frame perceptual
distance. A face swap shows up as inconsistency between frames without identifying whose face it is.
The engine header and the Video Analysis tab both state this, so no user is misled.

One requirement carries into the code when this opens: **purpose limitation, enforced in code -
detection only, never open-set face search.** That is the control that keeps a deepfake detector
from becoming a face-search index, and it has to be built deliberately. Biometric operations write
to the existing audit chain (`integrity.ts`).

Blocks backlog 5.1 and 5.2 (lip-sync, which needs the mouth region). See
[04-claim-vs-implementation.md](04-claim-vs-implementation.md) item 1.

**C2 - platform ingest.** In the build today: the MV3 extension (`extension/`) analyses what the operator
is already viewing, plus manual paste and upload. The lawful-request route is both faster and
evidentially stronger here than research accreditation, because collection method is the first thing
challenged when the evidence is used. WhatsApp has no collection API at all; content arrives through
the operator or through request to the intermediary under the IT Rules.

**C3 - takedown.** In the build today the platform ends at evidence: scored, explained, exportable, with
SHA-256 and perceptual-hash fingerprints taken at ingest and a hash-linked audit log. Community
reports feed an internal consensus score via `sybil-trust.ts` and do not leave the deployment. The
s.69A process requires per-direction authorisation by the designated officer, so the workflow is an
approval queue, not a bulk submitter.

**C4 - attribution.** In the build today `sybil-trust.ts` scores behaviour: voting patterns, account age,
agreement with later-confirmed verdicts, coordination between accounts. It reports that a set of
accounts behaves as a coordinated bloc. `clustering.ts` groups content into campaigns. Both are
usable as investigative leads. Identity comes from the intermediary under legal process; the join to
existing clusters is three days of work once the data arrives.

**C5 - corpora.** FaceForensics++, DFDC, Celeb-DF, WildDeepfake, ASVspoof for audio. Each needs a signed
research use agreement, which a non-commercial government institution obtains as a matter of course.
The eval harness (`eval-metrics.ts`, `POST /api/eval`, `npm run eval`) is already corpus-agnostic and
consumes labelled `(label, score)` pairs from any source, so this is acquisition, not engineering.

If Indian-language or Indian-face coverage is later needed beyond what the public sets provide, use
commissioned collection with consent from paid participants. A commissioned corpus can be cited in
court; a synthetic one cannot, which matters for C8.

**C6 - pretrained models.** Non-commercial status changes this materially:

| Model | Status for this deployment |
|---|---|
| MesoNet | Research weights, non-commercial. **Available.** Confirm scope with the authors |
| FaceForensics++ baselines | Research use agreement per institution. **Available** |
| Hugging Face checkpoints incl. CC-BY-NC | **Most are available.** Still review per checkpoint, licences are often unstated |
| Deepware Scanner | Paid API regardless of commercial status. Procurement decision |

Routes depend only on the exported function signature, so a model drops in behind
`video-temporal.ts` without touching a route or a component. The in-house engines
(`image-forensics.ts`, `video-temporal.ts`, `audio-dsp.ts`, `image-verdict.ts`) stay as the offline
and explainable path.

**C7 - fact-checker feeds.** Google Fact Check Tools API is free and indexes PIB Fact Check, AltNews,
Boom, Factly, Vishvas News and Newschecker via ClaimReview markup, returning structured verdicts.
Two days including caching and the verdict UI. Pursue a direct PIB feed in parallel: PIB Fact Check
is a unit of the same government, so this is an internal request and likely the highest-quality
source available to this deployment. Do not scrape AltNews or Boom; it breaks on redesign and
produces retrieval that will not hold up in an evidence pack.

**C8 - admissibility.** Forensic primitives are complete: SHA-256 and perceptual-hash fingerprinting at
ingest, hash-linked audit log where altering any row invalidates every subsequent hash, timestamped
records, exportable reports with the full signal breakdown. What is missing is the certificate: a
named signatory in the authority, a template reviewed by counsel, and retention aligned to the
relevant CrPC timelines.

**A published error rate is part of this gate.** A detector with no measured false-positive rate is
hard to sustain under cross-examination, which makes backlog item 2.6 a dependency of C8 rather than
a separate improvement.

---

## Handling

This document and the rest of `05-scope-of-work/` are confidential. The NDA governs disclosure: it
determines who may read this, not which instruments a capability needs. C1 to C4 still require the
authority's paperwork whoever is holding the document.
