# Tab: Campaign Detection

**File:** `src/components/tabs/campaign-detection-tab.tsx` · **Data:** `/api/campaigns` (exists, **not called**) · **Status:** 🔴

## What it is
Dashboard for coordinated-inauthentic-behavior campaigns: tracked campaigns, detected patterns, timeline of events.

## How it's built
Renders entirely from `mockCampaigns`, `mockPatterns`, `mockTimelineEvents` (line ~53+). The real pipeline (`/api/campaigns` + `Campaign`/`CampaignMember` models + the **clustering engine**) is **not wired**.

## How it works (logic — intended)
1. Fetch `/api/campaigns`.
2. The route runs the **clustering engine** (DBSCAN-lite over TF-IDF cosine) over recent reports to group coordinated activity into `Campaign` rows.
3. The tab lists campaigns, their member patterns, and a timeline; selecting one shows detail.

## Hardcoded-data note (🔴 — highest priority)
This tab is fully mock. Wire to `/api/campaigns`, map to the `Campaign` shape, add an empty state ("No campaigns detected yet"), delete the three mock consts. Needs seeded/clustered data to be non-empty — see [audit](../04-operations/01-hardcoded-data-audit.md) + clustering engine doc.

## Future scope & enterprise enhancements
- Add temporal + account-graph coordination signals (text similarity alone false-positives).
- Analyst workflow: confirm/dismiss campaigns, merge, escalate to Investigations.
- Alerting when a new campaign crosses a size/velocity threshold.
