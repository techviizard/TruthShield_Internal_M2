# Tab: Fact Check

**File:** `src/components/tabs/fact-check-tab.tsx` · **Data:** store `verifyFact(claim, lang)` → `/api/factcheck` · **Status:** ✅

## What it is
Enter a claim → verdict (`true/false/misleading/unverified/partially_true`) with confidence, matching fact-checks, source credibility, evidence summary, and reasoning.

## How it's built
Form → `verifyFact()` → renders `factCheckResult` (`FactCheckResult`).

## How it works (logic)
1. `/api/factcheck` calls **`webSearchFactCheck()`** (`src/lib/ai.ts`): builds a keyword phrase from the claim (long claims are reduced to salient keywords for recall), runs parallel `web_search` queries scoped to known fact-checkers, dedupes by URL, and **ranks results by domain credibility** (`getDomainCredibility`, config-driven).
2. An LLM pass synthesizes a verdict + reasoning from the retrieved evidence.
3. Persists `AnalysisReport` + `FactCheckMatch` rows; the tab shows verdict, sources (with credibility), and evidence.

## Future scope & enterprise enhancements
- **Claim extraction/decomposition** (multi-claim inputs) + per-claim verdicts.
- Retrieval upgrades: dedicated fact-check APIs (Google Fact Check Tools, ClaimReview schema).
- Cache verdicts; show evidence provenance + freshness; multilingual claim handling.
