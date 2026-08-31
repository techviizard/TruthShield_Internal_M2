# Tab: Community (Crowdsource)

**File:** `src/components/tabs/crowdsource-tab.tsx` · **Data:** store community actions → `/api/community` (+ `/vote`) · **Status:** ✅

## What it is
Crowdsourced verification: users submit reports and vote agree/disagree; a weighted consensus emerges.

## How it's built
Store `addCommunityReport()` / `voteOnReport(id, vote)` against `/api/community` + `/api/community/vote`. Votes are scored by the **sybil-trust** engine. `CommunityReport`/`CommunityVote` models.

## How it works (logic)
1. Submit a report; others vote agree/disagree.
2. `/api/community/vote` runs `computeConsensus` (trust-weighted, anti-sybil) → consensus %.
3. Voter trust updates as outcomes are confirmed.

## Future scope & enterprise enhancements
- Verified identity / proof-of-personhood; rate limits; collusion-ring detection.
- Reputation persistence + decay; reviewer tiers.
- Feed high-consensus reports into Alerts/Investigations.

## Scope of work

Tracked centrally in [`05-scope-of-work/`](../05-scope-of-work/README.md).

| Item | Status | Note |
|---|---|---|
| Crowd-sourced flagging + weighted consensus | ✅ Implemented | `sybil-trust.ts`, anti-gaming built in |
| Behaviour-based coordination scoring | ✅ Implemented | Coordination signals between accounts, usable as investigative leads |