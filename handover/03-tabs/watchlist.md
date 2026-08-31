# Tab: Watchlist

**File:** `src/components/tabs/watchlist-tab.tsx` · **Data:** store watchlist actions → `/api/watchlist` (+ `/scan`) · **Status:** ✅

## What it is
Monitor keywords/URLs/hashtags/accounts; track hit counts and last-hit time.

## How it's built
Store actions `addWatchlistItem`/`removeWatchlistItem`/`toggleWatchlistItem` against `/api/watchlist`; `/api/watchlist/scan` runs matching. `WatchlistItem`/`WatchlistHit` models.

## How it works (logic)
1. CRUD watchlist items (keyword/type/language/active).
2. A scan matches incoming content against active items, incrementing `hitCount` + writing `WatchlistHit`.

## Future scope & enterprise enhancements
- Scheduled/continuous scanning against live sources (social/news ingestion).
- Alert on hits (into the Alerts pipeline); per-item thresholds.
- Regex/semantic matching, not just substring; per-user/org lists.
