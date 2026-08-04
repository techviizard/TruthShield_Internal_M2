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
| [02-constrained-and-deferred.md](02-constrained-and-deferred.md) | Work that needs an instrument, accreditation or licence before it can start |
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
| ⛔ **Deployment-gated** | Needs the deploying authority's mandate, a notified exemption or a named accountable officer before work starts | Not yours to schedule. Raise with the authority, see [02](02-constrained-and-deferred.md) |
| 🔒 **Licence-gated** | Needs a licence, subscription, API grant or data-sharing agreement | Procurement task with a small engineering tail. Start these now |
| ⚠️ **Overclaimed** | The UI, prompt or doc asserts a capability the code does not actually implement | Fix the claim or build the capability. Highest priority: this is the only category that misleads a user |

### Why 🟢 and ⛔ exist

Two categories carry most of the signal in this project.

**🟢 Needs enhancement** marks a feature completed to a working standard where a great deal more is
possible. It is honest about what it measures, and it will not satisfy an accuracy benchmark.
Example: the video engine measures real spatial and temporal artifacts across sampled frames and
stops short of face tracking, which sits behind a deployment gate.

**⛔ Deployment-gated** marks work that a quick reading of the problem statement would treat as
missing. It is not missing by oversight, and it is not an engineering estimate away. Each entry in
[02](02-constrained-and-deferred.md) records what was asked, what is in the build today, which
instrument opens the gate, and the effort once it does. Route these to the deploying authority, not
to the sprint board.

## The short version

Counting against the problem statement:

| Area | ✅ | 🟢 | 🟡 | ⏳ / ❌ | Gated |
|---|---|---|---|---|---|
| Fake news detection (text) | 4 | 2 | 2 | 1 | 2 |
| Deepfake video detection | 1 | 1 | 2 | 1 | 3 |
| Image manipulation detection | 4 | 2 | 1 | 0 | 1 |
| Additional requirements | 3 | 2 | 2 | 1 | 1 |
| Evaluation criteria | 1 | 1 | 3 | 0 | 0 |
| Bonus items | 3 | 1 | 2 | 0 | 2 |

Read that as: the platform covers the problem statement broadly, the text and image paths are the
strongest, video is the weakest, and every absent capability is either scheduled in
[03](03-delivery-backlog.md) or waiting on a named instrument in
[02](02-constrained-and-deferred.md).
