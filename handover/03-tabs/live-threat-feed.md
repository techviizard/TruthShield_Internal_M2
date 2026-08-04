# Tab: Live Threat Feed

**File:** `src/components/tabs/live-threat-feed-tab.tsx` · **Data:** `/api/live-feed` · **Status:** 🟡 (mock seed)

## What it is
A real-time stream of detected threats (deepfakes, misinformation, phishing, manipulation) with severity and source.

## How it's built
`useState(mockThreats)` seeds the feed (line ~550); overwritten on the first `/api/live-feed` response. Polls/streams updates into the list.

## How it works (logic)
1. State seeded with `mockThreats`, then replaced by `/api/live-feed` data.
2. New entries prepend to the feed; severity drives color (threat scale).

## Hardcoded-data note (🟡)
Init `useState<ThreatEntry[]>([])` and show a "connecting…/no activity" empty state until the first response; delete `mockThreats`. See [audit](../04-operations/01-hardcoded-data-audit.md).

## Future scope & enterprise enhancements
- Real push transport (WebSocket/SSE) instead of polling.
- Filters (severity/type/source), pause/resume, and click-through to the analysis.
- Backpressure/virtualization for high-volume feeds.
