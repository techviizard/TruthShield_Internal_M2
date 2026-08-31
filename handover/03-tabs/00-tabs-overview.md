# Tabs Overview

The 28 feature tabs live in `src/components/tabs/*`. Each is a **client component** rendered by `renderTab()` in `src/app/page.tsx`. They are presentation + local state; real work happens in APIs/engines/store.

## Three wiring patterns

| Pattern | How it gets data | Tabs |
|---------|------------------|------|
| **Store-driven** 🟡 | calls a Zustand action (`analyzeText`, `verifyFact`, `fetchAlerts`, …) that fetches an API | text, image, video, fact-check, alerts, watchlist, investigations, history, chat, crowdsource, settings, dashboard |
| **Direct-fetch** ✅ | its own `fetch('/api/…')` in a `useEffect`/handler | audio-deepfake, audit-log, data-visualization, live-threat-feed, media-comparison, ocr-scanner, reverse-search, system-health, api-docs |
| **Not wired** 🔴 | renders from inline mock; a real API exists but isn't called | campaign-detection, model-metrics, network-analysis, source-credibility, workflow-automation |

🔴 tabs are the priority for the [hardcoded-data removal](../04-operations/01-hardcoded-data-audit.md): wire them to their existing API + add empty states.

## Status table

| Tab | File | API / source | Status |
|-----|------|--------------|--------|
| Dashboard | `dashboard-tab.tsx` | `/api/dashboard/*` | 🟡 partial (stats via mock init - see audit) |
| Data Visualization | `data-visualization-tab.tsx` | `/api/datavis/trends` | ✅ |
| Live Threat Feed | `live-threat-feed-tab.tsx` | `/api/live-feed` | 🟡 seeds mock |
| Text Analysis | `text-analysis-tab.tsx` | store `analyzeText` → `/api/analyze/text` | ✅ |
| Image Forensics | `image-forensics-tab.tsx` | store `analyzeImage` → `/api/analyze/image` | ✅ |
| Video Analysis | `video-analysis-tab.tsx` | store `analyzeVideo` → `/api/analyze/video` | ✅ |
| Fact Check | `fact-check-tab.tsx` | store `verifyFact` → `/api/factcheck` | ✅ |
| Batch Analysis | `batch-analysis.tsx` | reuses analyze APIs | ✅ |
| Media Compare | `media-comparison-tab.tsx` | `/api/forensics/compare` | 🟡 mock fallback |
| Network Analysis | `network-analysis-tab.tsx` | `/api/network-graph` (not called) | 🔴 |
| Campaign Detection | `campaign-detection-tab.tsx` | `/api/campaigns` (not called) | 🔴 |
| OCR Scanner | `ocr-scanner-tab.tsx` | `/api/forensics/ocr` | ✅ |
| Audio Deepfake | `audio-deepfake-tab.tsx` | `/api/forensics/audio` | 🟡 mock fallback |
| History | `history-tab.tsx` | store `fetchAnalysisHistory` → `/api/analysis/history` | ✅ |
| Reverse Search | `reverse-search-tab.tsx` | `/api/analyze/reverse-image` | ✅ |
| AI Assistant | `chat-tab.tsx` | store `sendChatMessage` → `/api/chat` | ✅ |
| Browser Extension | `browser-extension-tab.tsx` | none (marketing/mockup) | ✅ static |
| API Docs | `api-docs-tab.tsx` | `/api/api-docs` (introspection) | ✅ |
| Learn & Resources | `education-resources-tab.tsx` | none (static content) | ✅ static |
| Report Generator | `report-generator-tab.tsx` | `/api/reports/generate` | ✅ |
| Investigations | `investigations-tab.tsx` | store `fetchInvestigations` → `/api/investigations` | ✅ |
| Alerts | `alerts-tab.tsx` | store `fetchAlerts` → `/api/alerts` | ✅ |
| Watchlist | `watchlist-tab.tsx` | store watchlist actions → `/api/watchlist` | ✅ |
| Community | `crowdsource-tab.tsx` | store community actions → `/api/community` | ✅ |
| Source Credibility | `source-credibility-tab.tsx` | `/api/source-credibility` (not called) | 🔴 mock random |
| Workflows | `workflow-automation-tab.tsx` | `/api/workflows` (not called) | 🔴 |
| Model Metrics | `model-metrics-tab.tsx` | `/api/model-metrics` (not called) | 🔴 |
| System Health | `system-health-tab.tsx` | `/api/system/health` | 🟡 synthetic series |
| Audit Log | `audit-log-tab.tsx` | `/api/audit/logs` | 🟡 mock fallback |
| Settings | `settings-tab.tsx` | store prefs | ✅ |

Individual tab docs follow the standard 4-section template. Where a tab is thin (form → store action → render), the doc points to the store action and API/engine that do the real work rather than repeating it.
