# Tab: Alerts

**File:** `src/components/tabs/alerts-tab.tsx` · **Data:** store `fetchAlerts`/`markAlertRead` → `/api/alerts` · **Status:** ✅

## What it is
Notification center: threat/verification/system/escalation alerts with severity and read state. The header bell badge reflects unread count.

## How it's built
Store `alerts` list + `fetchAlerts()` / `markAlertRead(id)` against `/api/alerts` (`Alert` model).

## How it works (logic)
1. Load alerts; unread count drives the header badge (`unreadAlerts`).
2. Mark read; filter by severity/type.

## Future scope & enterprise enhancements
- Real-time delivery (WebSocket/SSE) + desktop/email/Slack routing.
- Alert rules engine (tie into Workflows) with thresholds + dedupe.
- Per-user preferences + snooze/escalation policies.
