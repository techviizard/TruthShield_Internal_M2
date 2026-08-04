# Tab: Browser Extension

**File:** `src/components/tabs/browser-extension-tab.tsx` · **Data:** none · **Status:** ✅ static

## What it is
Marketing/showcase page for a companion browser extension: install CTA + an animated browser **mockup** demonstrating in-page detection.

## How it's built
Pure presentation. The "browser mockup" and "webpage" blocks are intentional **UI illustrations** (not data) - leave them.

## How it works (logic)
Static layout + CSS/Framer animation. No API.

## Future scope & enterprise enhancements
- Ship the actual extension (MV3) that calls the analyze APIs on selected media/text.
- Real install links + version/telemetry once published.
- Deep-link from extension results back into the console.

## Scope of work

Tracked centrally in [`05-scope-of-work/`](../05-scope-of-work/README.md).

| Item | Status | Note |
|---|---|---|
| Manifest V3 extension, user-initiated analysis | 🟢 Needs enhancement | Works side-loaded. Acts only on content the user asks about, which is the design constraint, not a limitation |
| Store publication | ⏳ Planned | Needs a developer account and store review |
| In-feed verdict injection on social platforms | ⛔ Constrained | ToS violation and third-party DOM injection: [C2](../05-scope-of-work/02-constrained-and-deferred.md) |