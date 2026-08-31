# Engine: Sybil Trust (community consensus)

**File:** `src/lib/engines/sybil-trust.ts` · **Deps:** none · **Status:** ✅ Real

## What it is
Anti-gaming math for crowdsourced verification votes. Replaces a naive "count the votes" tally that was trivially sybil-able. Backs `/api/community/vote`.

## How it's built
`computeConsensus(votes)` → `ConsensusResult` (weighted agree %, confidence). `updateVoterTrust()` adjusts a voter's historical accuracy; `trustBadge()` maps a score to a label. Votes carry a hashed `voterFingerprint` (IP+UA), the vote, and the voter's trust score.

## How it works (logic)
1. **Weight votes by voter trust** (0–100 historical accuracy) - a proven voter counts more than a fresh/anonymous one.
2. **Outlier/sybil detection:** clusters of identical fingerprints or coordinated bursts are down-weighted.
3. **Weighted consensus %:** agree-weight ÷ total-weight, not raw headcount.
4. **Voter trust update:** after ground truth is known, voters who matched the outcome gain trust; others lose it (a reputation feedback loop).

## Future scope & enterprise enhancements
- Persist per-voter trust to a `Voter`/`UserPreferences`-style table (currently passed in).
- Stronger identity: verified accounts, proof-of-personhood, rate limits.
- Bayesian/Beta-reputation model with decay instead of linear trust updates.
- Detect **collusion rings** via the voter co-occurrence graph.
