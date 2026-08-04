# Scope of Work

**Audience:** the team taking TruthShield from its current build to a deployable product.
**Purpose:** state plainly what is built, what is partly built, what is not built, and what was
deliberately *not* built because policy, regulation or licensing forbids it.

This folder is the single place where remaining work is tracked. Every component doc in
`01-engines/`, `02-api/` and `03-tabs/` carries a short "Scope of work" pointer back to here so the
detail lives in one file instead of drifting across sixty.

| Doc | What it covers |
|---|---|
| [01-prd-traceability.md](01-prd-traceability.md) | Every line of the problem statement mapped to code, with a status |
| [02-constrained-and-deferred.md](02-constrained-and-deferred.md) | Work deliberately not built: policy, regulatory and licensing gates |
| [03-delivery-backlog.md](03-delivery-backlog.md) | The remaining work, sequenced, with effort and dependencies |
| [04-claim-vs-implementation.md](04-claim-vs-implementation.md) | Places where a label, prompt or doc promises more than the code delivers |

## Status legend

This legend supersedes the three-state legend in the handover root README. Use it in every scope
table.

| Status | Meaning | What it implies for the reader |
|---|---|---|
| ✅ **Implemented** | Built, backed by a real engine or DB, behaves as documented | Nothing owed |
| 🟢 **Needs enhancement** | Built and honest, but deliberately shallow. A real engine exists and returns real numbers, yet a production deployment wants materially more depth | Works today, will not satisfy an accuracy benchmark |
| 🟡 **In Progress** | Partially built. Some paths real, some paths missing or stubbed | Do not treat as feature-complete |
| ⏳ **Planned** | Designed and specified here, no code yet | Ready to pick up |
| ❌ **Not Started** | Named in the problem statement, no design and no code | Needs design first |
| ⛔ **Constrained** | Technically feasible, deliberately not built. Blocked by platform policy, Indian law, or the ethics of the capability itself | Do not "just add it". Read [02](02-constrained-and-deferred.md) first |
| 🔒 **Gated** | Blocked on something outside engineering: a licence, a data-sharing agreement, a legal opinion, an official API key | Unblock commercially, then it is ordinary work |
| ⚠️ **Overclaimed** | The UI, prompt or doc asserts a capability the code does not actually implement | Fix the claim or build the capability. Highest priority: this is the only category that misleads a user |

### Why 🟢 and ⛔ exist

Two categories carry most of the honest signal in this project.

**🟢 Needs enhancement** marks the places where a feature was completed to a working standard, and
where a great deal more is possible, but where going deeper means crossing into capabilities this
build will not ship. Example: the video engine measures real spatial and temporal artifacts across
sampled frames, and stops short of face tracking, because face tracking means building biometric
identification of named individuals.

**⛔ Constrained** marks work that a naive reading of the problem statement would treat as missing.
It is not missing by oversight. Each entry in [02](02-constrained-and-deferred.md) records what was
asked, why it was not built, and what lawful alternative was built instead.

## The short version

Counting against the problem statement:

| Area | ✅ | 🟢 | 🟡 | ⏳ / ❌ | ⛔ / 🔒 |
|---|---|---|---|---|---|
| Fake news detection (text) | 4 | 2 | 2 | 1 | 2 |
| Deepfake video detection | 1 | 1 | 2 | 1 | 3 |
| Image manipulation detection | 4 | 2 | 1 | 0 | 1 |
| Additional requirements | 3 | 2 | 2 | 1 | 1 |
| Evaluation criteria | 1 | 1 | 3 | 0 | 0 |
| Bonus items | 3 | 1 | 2 | 0 | 2 |

Read that as: the platform covers the problem statement broadly, the text and image paths are the
strongest, video is the weakest, and every genuinely absent capability is either scheduled in
[03](03-delivery-backlog.md) or explained in [02](02-constrained-and-deferred.md).
