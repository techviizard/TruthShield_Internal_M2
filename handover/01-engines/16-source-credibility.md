# Engine: Source Credibility

**File:** `src/lib/engines/source-credibility.ts` · **Deps:** `db`, `@/config/source-domains` · **Status:** ✅ Real

## What it is
Derives a per-domain credibility profile from the app's own data instead of hardcoded outlet ratings. Backs `/api/source-credibility`.

## How it's built
Aggregates over `FactCheckMatch.url` hostnames and the `AnalysisReport` explanations that cite them. Returns `SourceScore` (`domain`, `totalCitations`, `factualRating`, `biasScore`, `recencyDays`, `type`). The known fact-checker domain list now lives in `src/config/source-domains.ts` (`FACT_CHECKER_DOMAINS`).

## How it works (logic)
1. Extract hostnames from all `FactCheckMatch.url` values (strip `www.`).
2. **factualRating (0–100):** average `trustScore` of analyses citing that domain.
3. **biasScore (−50..+50):** lexical sentiment skew of citing analyses (proxy for lean).
4. **recencyDays:** days since the domain was last cited.
5. **type:** `fact-checker` (in `FACT_CHECKER_DOMAINS`), `mainstream`, or `unknown`.

Key property: the score is **earned from observed behaviour**, so it improves as the DB grows - no editorial hardcoding.

## Future scope & enterprise enhancements
- Persist scores to `SourceCredibilityScore` and recompute on a schedule (currently derived per request).
- Replace lexical bias with a **calibrated stance/bias model**.
- Blend in external signals (domain age, HTTPS, MBFC-style datasets) as optional inputs.
- Admin UI to review/override scores (with audit trail).
