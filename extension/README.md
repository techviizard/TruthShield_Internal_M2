# TruthShield browser extension (Manifest V3)

Verifies selected text, claims and images against a TruthShield console you control.

## Install (unpacked)

1. Download the packaged zip from the console (**Browser Extension** tab → *Download extension*),
   or zip this folder yourself.
2. Extract it.
3. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
4. Enable **Developer mode** → **Load unpacked** → select the extracted folder.
5. Open the extension's **Settings** and set the console URL (default `http://localhost:3000`).

Firefox needs a `browser_specific_settings` block and a different packaging step; this build targets
Chromium browsers.

## What it does

| Surface | Action |
|---|---|
| Right-click on selected text | Verify patterns, or fact-check the claim |
| Right-click on an image | Fetch it and run image forensics (ELA, noise, synthesis grid, provenance) |
| Toolbar popup | Paste or use the page selection, then analyse or fact-check |
| Options page | Set and test the console URL |

Results appear as an overlay rendered in a **shadow root**, so page CSS cannot restyle a verdict, and
all API values are inserted as text nodes rather than HTML.

## Architecture

- `background.js` - the only place that talks to the console. Owns context menus and all fetches.
- `content.js` - renders the overlay. Receives results by message; never calls the API itself.
- `popup.js` / `options.js` - UI, delegating network work to the service worker.

Keeping every request in the service worker means a page cannot influence where verification traffic
is sent, and the console URL exists in one place.

## Privacy

Whatever you verify is sent to the configured console and stored there as an analysis report with a
SHA-256 evidence hash and an audit-chain entry. Point it only at a console you own or are authorised
to use. The extension stores nothing beyond the console URL in `chrome.storage.sync`.
