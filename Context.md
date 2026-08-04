# TruthShield - Complete Project Context & Architecture Reference

> **Version**: v3.3.0 | **Phase**: 21 | **Last Updated**: 2025-05-20
> This document contains EVERY insight, strategy, logic, and architectural decision in the TruthShield platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [File Structure & Architecture](#3-file-structure--architecture)
4. [Navigation System - 30 Tabs](#4-navigation-system--30-tabs)
5. [State Management - Zustand Store](#5-state-management--zustand-store)
6. [AI Integration Layer](#6-ai-integration-layer)
7. [Backend API Routes - Complete Logic](#7-backend-api-routes--complete-logic)
8. [Database Schema - Prisma/SQLite](#8-database-schema--prismasqlite)
9. [Tab Components - Detailed Breakdown](#9-tab-components--detailed-breakdown)
10. [Shared Components](#10-shared-components)
11. [Page Layout - Shell Architecture](#11-page-layout--shell-architecture)
12. [CSS Animation System](#12-css-animation-system)
13. [Design System & Color Strategy](#13-design-system--color-strategy)
14. [Error Handling & Graceful Degradation](#14-error-handling--graceful-degradation)
15. [India-Focused Strategy](#15-india-focused-strategy)
16. [Security Patterns](#16-security-patterns)
17. [Performance Patterns](#17-performance-patterns)
18. [Infrastructure & Deployment](#18-infrastructure--deployment)
19. [Cross-Cutting Patterns & Conventions](#19-cross-cutting-patterns--conventions)
20. [Known Issues & Risks](#20-known-issues--risks)

---

## 1. Project Overview

**TruthShield** is a comprehensive AI-powered Digital Media Verification & Deepfake Detection Platform. It provides 30 navigation tabs covering analysis, tools, management, and system features. The platform integrates with `z-ai-web-dev-sdk` for LLM (text generation), VLM (vision-language model), and Web Search capabilities.

**Core Value Proposition**: Verify any digital media - text, image, video, audio - for misinformation, deepfakes, manipulation, and propaganda, with a focus on the Indian media ecosystem.

**Version History**:
- v2.5.0 - Phase 10 (14 tabs)
- v2.7.0 - Phase 14 (enhanced dashboard)
- v3.3.0 - Phase 21 (30 tabs, full feature set)

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js 16 (App Router) | 16.1.1 | Full-stack React framework |
| Language | TypeScript | 5.x | Type safety throughout |
| Styling | Tailwind CSS 4 | 4.x | Utility-first CSS |
| UI Library | shadcn/ui (New York style) | - | Radix-based components |
| State | Zustand | ^5.0.6 | Client-side global store |
| Database | Prisma ORM + SQLite | ^6.11.1 | Data persistence |
| AI SDK | z-ai-web-dev-sdk | ^0.0.18 | LLM, VLM, Web Search |
| Animations | Framer Motion | ^11.x | Page transitions, micro-interactions |
| Charts | Recharts | ^2.15.4 | Data visualization |
| Icons | Lucide React | - | Consistent icon system |
| Toast | Sonner | - | Notification toasts |
| Auth | NextAuth.js v4 | ^4.24.11 | Available (not yet active) |
| i18n | next-intl | ^4.3.4 | Available (not yet active) |
| Markdown | react-markdown | - | Chat tab rendering |
| Archive | archiver | ^8.0.0 | Project ZIP download |
| Runtime | Bun | - | Package manager & dev server |

**Key Config** (`next.config.ts`):
- `output: "standalone"` - self-contained production build
- `typescript.ignoreBuildErrors: true` - skips TS checking during build
- `reactStrictMode: false` - disabled for performance

---

## 3. File Structure & Architecture

```
/home/z/my-project/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main SPA - 600 lines, shell layout
│   │   ├── layout.tsx                  # Root layout with ThemeProvider
│   │   ├── globals.css                 # 1200+ lines, 40+ animations
│   │   └── api/
│   │       ├── analyze/
│   │       │   ├── text/route.ts       # LLM text analysis
│   │       │   ├── image/route.ts      # VLM image forensics
│   │       │   ├── video/route.ts      # VLM video deepfake
│   │       │   └── reverse-image/route.ts  # 3-step reverse search
│   │       ├── factcheck/route.ts      # Web search + LLM verification
│   │       ├── chat/route.ts           # AI chat assistant
│   │       ├── export/route.ts         # JSON/PDF report export
│   │       ├── analysis/history/route.ts   # Paginated history
│   │       ├── dashboard/stats/route.ts    # Dashboard aggregation
│   │       ├── alerts/route.ts         # Alert CRUD
│   │       ├── investigations/route.ts     # Investigation list/create
│   │       ├── investigations/[id]/route.ts # Single investigation
│   │       ├── download/project/route.ts   # ZIP project download
│   │       └── route.ts                # Health check
│   ├── components/
│   │   ├── tabs/                       # 29 tab components (see §9)
│   │   ├── trust-score-gauge.tsx       # SVG animated gauge
│   │   ├── threat-intel-map.tsx        # India SVG threat map
│   │   ├── export-button.tsx           # Export dropdown (JSON/PDF)
│   │   ├── batch-analysis.tsx          # Multi-file batch upload
│   │   ├── notification-center.tsx     # Bell icon popover
│   │   ├── keyboard-shortcuts.tsx      # Shortcuts dialog
│   │   └── ui/                         # 50+ shadcn/ui components
│   └── lib/
│       ├── ai.ts                       # AI SDK singleton + helpers
│       ├── store.ts                    # Zustand global store
│       ├── db.ts                       # Prisma singleton
│       └── utils.ts                    # cn() class merger
├── prisma/
│   └── schema.prisma                   # 9 models
├── public/
│   ├── logo.svg
│   └── truthshield-hero.png
├── db/custom.db                        # SQLite database file
├── Caddyfile                           # Reverse proxy (port 81 → 3000)
├── worklog.md                          # Development handover document
└── Context.md                          # This file
```

**Architecture Pattern**: Single-Page Application (SPA) with sidebar navigation. All 30 tabs are client components rendered inside a single `page.tsx` shell. No routing - tab switching is pure state change via Zustand.

---

## 4. Navigation System - 30 Tabs

Tabs are organized into **5 sections** in the sidebar:

### Section: Overview (3 tabs)
| TabId | Label | Icon | Component |
|---|---|---|---|
| `dashboard` | Dashboard | LayoutDashboard | DashboardTab |
| `dataVisualization` | Data Visualization | BarChart3 | DataVisualizationTab |
| `liveThreatFeed` | Live Threat Feed | Radio | LiveThreatFeedTab |

### Section: Analysis (9 tabs)
| TabId | Label | Icon | Component |
|---|---|---|---|
| `text` | Text Analysis | FileText | TextAnalysisTab |
| `image` | Image Forensics | ImageIcon | ImageForensicsTab |
| `video` | Video Analysis | Video | VideoAnalysisTab |
| `factcheck` | Fact Check | Search | FactCheckTab |
| `batch` | Batch Analysis | Layers | BatchAnalysis |
| `comparison` | Media Compare | GitCompare | MediaComparisonTab |
| `networkAnalysis` | Network Analysis | Network | NetworkAnalysisTab |
| `campaignDetection` | Campaign Detection | Radar | CampaignDetectionTab |
| `ocrScanner` | OCR Scanner | ScanText | OcrScannerTab |
| `audioDeepfake` | Audio Deepfake | Mic | AudioDeepfakeTab |

### Section: Tools (6 tabs)
| TabId | Label | Icon | Component |
|---|---|---|---|
| `history` | History | Clock | HistoryTab |
| `reverseSearch` | Reverse Search | Search | ReverseSearchTab |
| `chat` | AI Assistant | MessageSquare | ChatTab |
| `browserExtension` | Browser Extension | Puzzle | BrowserExtensionTab |
| `apiDocs` | API Docs | BookOpen | ApiDocsTab |
| `educationResources` | Learn & Resources | GraduationCap | EducationResourcesTab |
| `reportGenerator` | Report Generator | FileText | ReportGeneratorTab |

### Section: Manage (6 tabs)
| TabId | Label | Icon | Component |
|---|---|---|---|
| `investigations` | Investigations | Briefcase | InvestigationsTab |
| `alerts` | Alerts | Bell | AlertsTab |
| `watchlist` | Watchlist | Eye | WatchlistTab |
| `community` | Community | Users | CrowdsourceTab |
| `sourceCredibility` | Source Credibility | ShieldCheck | SourceCredibilityTab |
| `workflowAutomation` | Workflows | Workflow | WorkflowAutomationTab |

### Section: System (4 tabs)
| TabId | Label | Icon | Component |
|---|---|---|---|
| `modelMetrics` | Model Metrics | BarChart3 | ModelMetricsTab |
| `systemHealth` | System Health | Server | SystemHealthTab |
| `auditLog` | Audit Log | ClipboardList | AuditLogTab |
| `settings` | Settings | Settings | SettingsTab |

**Navigation Logic**:
- `navItems` array defines order, section, icon, and TabId
- `SidebarNav` component groups by `section` using `reduce()`
- Active tab gets: `bg-emerald-500/15`, `text-emerald-600`, `sidebar-item-active` CSS class (left emerald bar)
- Alerts tab shows red badge with unread count
- Active tab shows `ChevronRight` indicator

---

## 5. State Management - Zustand Store

**File**: `src/lib/store.ts`

### Type System

```typescript
type TabId = 'dashboard' | 'text' | 'image' | 'video' | 'factcheck' |
  'investigations' | 'alerts' | 'watchlist' | 'community' | 'settings' |
  'history' | 'reverseSearch' | 'chat' | 'batch' | 'auditLog' |
  'comparison' | 'browserExtension' | 'modelMetrics' | 'apiDocs' |
  'networkAnalysis' | 'campaignDetection' | 'ocrScanner' | 'audioDeepfake' |
  'sourceCredibility' | 'liveThreatFeed' | 'educationResources' |
  'workflowAutomation' | 'systemHealth' | 'dataVisualization' | 'reportGenerator'

type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
type Verdict = 'true' | 'false' | 'misleading' | 'unverified'
type InvestigationStatus = 'open' | 'in_progress' | 'closed' | 'archived'
type InvestigationPriority = 'critical' | 'high' | 'medium' | 'low'
type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type AlertType = 'deepfake' | 'fake_news' | 'manipulation' | 'trend' | 'system'
type WatchlistItemType = 'keyword' | 'url' | 'hashtag' | 'account'
type CommunityReportStatus = 'pending' | 'verified' | 'disputed'
type TrustBadge = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
```

### Key Interfaces

| Interface | Purpose | Key Fields |
|---|---|---|
| `TextAnalysisResult` | Text analysis output | trustScore, riskLevel, flags[], sentiment, propagandaIndicators[], detectedClaims[] |
| `ImageAnalysisResult` | Image forensics output | trustScore, aiGeneratedLikelihood, manipulationIndicators[], metadataAnalysis[], forensicFindings[] |
| `VideoAnalysisResult` | Video deepfake output | deepfakeProbability, frameAnalysis, faceAnalysis, temporalConsistency, audioVisualSync |
| `FactCheckResult` | Fact check output | verdict, confidence, matchingFactChecks[], evidenceSummary, sourceCredibility[] |
| `DashboardStats` | Dashboard metrics | totalAnalyses, trendData[], riskDistribution[], recentActivity[], topThreats[] |
| `Investigation` | Case data | id, title, status, priority, tags[], assignedAnalyst |
| `Alert` | Notification | id, title, message, severity, type, timestamp, read, source |
| `ChatMessage` | Chat history | role, content, timestamp |
| `CommunityReport` | Crowdsource item | submitterTrustScore, agreeVotes, disagreeVotes, consensusScore, status |

### Mock Data Strategy

All mock data is pre-populated in the store so the UI always renders:

- `mockDashboardStats`: 12 months of trend data, 4 risk levels, 8 recent activities, 5 top threats, 10 trust score ranges
- `mockInvestigations`: 6 cases (INV-001 through INV-006) with Indian analyst names
- `mockAlerts`: 7 alerts covering all severity/type combinations
- `mockWatchlistItems`: 10 items in Hindi, English, Telugu, Tamil
- `mockCommunityReports`: 8 reports with voting data, Indian context

### Key Actions & Their Transform Logic

**`analyzeText()`**:
1. POST `/api/analyze/text` with `{ text, language }`
2. API returns `{ success, reportId, analysis: {...}, processingTime }`
3. Transform: Extract `flags[]` → map to `{ type, description, icon }` using `iconMap`
4. Extract `sentiment` from `details.sentiment` → `{ label, score }`
5. Extract `detectedClaims[]` from `details.claimsExtracted`
6. Extract `propagandaIndicators[]` from `details.propagandaTechniques` or `details.misinformationIndicators`
7. Clamp `confidence` to 0-100 (if ≤1, multiply by 100)
8. On failure: set hardcoded fallback data so UI never shows empty state

**`analyzeImage(file)`**:
1. POST `/api/analyze/image` with FormData
2. Transform flags → `manipulationIndicators[]` with random confidence offset (±10%)
3. Build `metadataAnalysis[]` from `details.metadataAnalysis.anomalies` and `editingSoftware`
4. `aiGeneratedLikelihood` = `details.aiGenerationProbability` or `100 - trustScore`
5. On failure: hardcoded 4 manipulation indicators, 5 metadata fields

**`analyzeVideo(file)`**:
1. POST `/api/analyze/video` with FormData
2. `deepfakeProbability` from `details.deepfakeProbability` or `100 - trustScore`
3. `frameAnalysis` = fixed 300 frames, flaggedFrames = `deepfakeProbability × 3`
4. `faceAnalysis` from `details.faceAnalysis` or defaults
5. `audioVisualSync` from `details.audioVisualSync.lipSyncScore / 100`
6. On failure: hardcoded 78% deepfake, 450 frames, 67 flagged

**`verifyFact(claim)`**:
1. POST `/api/factcheck` with `{ claim }`
2. Sources: Extract hostname from URL via `new URL(url).hostname.replace(/^www\./, '')`
3. Fallback source name: "External Source"
4. `sourceCredibility` = top 5 sources with rating derived from confidence
5. On failure: hardcoded fallback

**`voteOnReport(id, vote)`** - Community Voting Algorithm:
1. Increment agree or disagree count
2. `consensus = (agree / total) × 100`
3. Auto-transition status:
   - `consensus ≥ 85%` AND `total ≥ 10` → `verified`
   - `consensus ≤ 40%` AND `total ≥ 10` → `disputed`
   - Otherwise → `pending`

---

## 6. AI Integration Layer

**File**: `src/lib/ai.ts`

### Singleton Pattern
```typescript
let zaiInstance: ZAI | null = null
export async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) zaiInstance = await ZAI.create()
  return zaiInstance
}
```

### `structuredLLMAnalysis(system, user)` - Core LLM Call
- Sends to LLM with system + user prompts
- **JSON Parsing Strategy** (3-tier fallback):
  1. Direct `JSON.parse(response)`
  2. Extract from markdown code blocks: `` ```json ... ``` ``
  3. Regex match `{...}` (first JSON object)
  - If all fail, throws error
- Returns parsed object with `trustScore`, `riskLevel`, `flags`, `explanation`, `confidence`, `recommendations`

### `vlmImageAnalysis(url, prompt)` - Vision-Language Model
- Sends `image_url` content type with image data URL
- Returns same structured format as LLM
- Used for: image forensics, video frame analysis (base64), reverse search step 1

### `vlmVideoAnalysis(url, prompt)` - Video VLM
- Sends `video_url` content type with video URL
- Only works with URL (not base64)
- Used for: video analysis when URL provided (not file upload)

### `webSearchFactCheck(claim, numResults)` - Multi-Query Web Search
- **Strategy**: Runs 2 parallel queries:
  1. `"{claim} site:pib.gov.in OR site:altnews.in OR site:boomlive.in OR site:factly.in OR site:snopes.com"`
  2. `"{claim} fact check verify"`
- Merges results from both queries (handles `results` or `data` array fields)
- Each query wrapped in try-catch (failure in one doesn't block other)
- Returns `{ query, results: [...] }`

### `bufferToDataUrl(buffer, mimeType)` - Base64 Conversion
- Converts Node.js Buffer to `data:{mimeType};base64,{base64}` string
- Used for VLM image analysis of uploaded files

---

## 7. Backend API Routes - Complete Logic

### 7.1 `/api/analyze/text` - POST

**Validation**: `text` required, ≤50,000 chars; optional `language`

**System Prompt Strategy**: Detailed instructions covering misinformation indicators (clickbait, emotional language, unsubstantiated claims, propaganda, conspiracy theories, misleading statistics, false equivalence, cherry-picking, appeal to fear, ad hominem, straw man, fake expert, toxic language), sentiment analysis, claims extraction, and propaganda technique identification.

**Processing**:
1. Validate input
2. Call `structuredLLMAnalysis()` with detailed system prompt
3. Sanitize: clamp trustScore 0-100, validate riskLevel enum, default missing fields
4. Create `MediaUpload` record (fileType='text', status='completed')
5. Create `AnalysisReport` (analysisType='text_fake_news', aiModel='z-ai-llm')
6. Return `{ success, reportId, analysis, processingTime }`

**Error Handling**: Outer try-catch logs error, attempts to create failed `AnalysisReport`, returns 500

### 7.2 `/api/analyze/image` - POST

**Validation**: `image` FormData field required; allowed MIME: jpeg/png/webp/gif/bmp/tiff; max 20MB

**Processing**:
1. Save file to `/tmp/{uuid}.{ext}`
2. Read file → convert to base64 data URL
3. Call `vlmImageAnalysis()` with forensic system prompt
4. System prompt covers: AI generation detection, manipulation detection, metadata analysis, face region analysis
5. Create DB records
6. **Cleanup**: `finally { unlink(tempFile) }` - ignores cleanup errors

### 7.3 `/api/analyze/video` - POST

**Dual Input Support**:
- `multipart/form-data` with `video` file → save to `/tmp`, convert to base64, use `vlmImageAnalysis()` (as image_url)
- JSON with `url` field → use `vlmVideoAnalysis()` (as video_url)

**Key Design Decision**: Uploaded videos are sent as base64 image data to VLM (effectively frame extraction), while URLs use the dedicated `video_url` content type.

**Validation**: Allowed MIME: mp4/avi/mov/quicktime/x-msvideo/webm/x-matroska; max 100MB

### 7.4 `/api/analyze/reverse-image` - POST

**3-Step Pipeline** (with independent error handling per step):

1. **Step 1 - VLM Description**: Describe the image (visual features, manipulation indicators, aiGeneratedLikelihood). If fails, proceed with empty description.
2. **Step 2 - Web Search**: Search using image description + "source OR origin OR original". If fails, proceed with empty results.
3. **Step 3 - LLM Context Analysis**: Analyze search results for context, manipulation likelihood, authenticity score, similar images. If fails, limited context.

**DB Records**: Created in own try-catch (non-blocking on failure)

### 7.5 `/api/factcheck` - POST

**Validation**: `claim` required, ≤10,000 chars

**Processing**:
1. `webSearchFactCheck()` for existing fact-checks
2. Construct prompt with search context
3. `structuredLLMAnalysis()`
4. **Verdict → TrustScore Mapping**: true→90, partially_true→60, misleading→30, false→10, unverified→50
5. **Source Detection** - `determineSource(url)`:
   - Maps URLs to: pib, altnews, boomlive, factly, snopes, google_fact_check, reuters, apnews, bbc, fullfact
   - Unknown URLs → 'other'
6. Create `FactCheckMatch` records per source

### 7.6 `/api/chat` - POST

**System Prompt**: TruthShield AI Assistant persona - expert in deepfake detection, fact-checking, image forensics, propaganda recognition.

**Conversation Management**: Accepts `history[]`; keeps last 20 messages for context window

### 7.7 `/api/export` - GET & POST

**GET**: Fetches report by `reportId` from DB → returns as JSON or formatted text

**POST**: Accepts `{ reportData, format, filename }` → generates download

**Text Report Format**: `generateTextReport()` - Unicode box-drawing characters for decorative headers, recursive `formatReportData()` for nested data

**CORS**: All responses include `Access-Control-Allow-Origin: *`; OPTIONS handler returns 204

### 7.8 `/api/analysis/history` - GET

**Query Params**: type, riskLevel, search (searches explanation, fileName, analysisType), page, limit (default 10), sortBy, sortOrder

**Pattern**: Dynamic Prisma `where` clause with OR search; `Promise.all` for count + data

**Response**: `{ items, total, page, limit, totalPages }`

### 7.9 `/api/dashboard/stats` - GET

**8 Parallel Aggregations** via `Promise.all`:
1. Total analyses
2. Fake news detected
3. Deepfakes detected
4. Images analyzed
5. Fact checks run
6. Active alerts
7. Open investigations
8. Recent reports

**Additional Computations**: Average trust score, 7-day trend data, risk level distribution, analysis type distribution

**Materialized View**: Updates/creates `DashboardStats` record with computed values

### 7.10 `/api/alerts` - GET, POST, PATCH

- **GET**: List with type/severity/isRead filters, paginated, includes unreadCount
- **POST**: Create with type validation (threat/verification_complete/system/escalation), severity (info/warning/error/critical); creates `AuditLog`
- **PATCH**: Mark read by alertIds[] or markAllRead

### 7.11 `/api/investigations` - GET, POST

- **GET**: List with status/priority/search filters, includes related analyses
- **POST**: Create with title validation, creates `AuditLog`

### 7.12 `/api/investigations/[id]` - GET, PATCH, DELETE

- **GET**: Single investigation with full analyses including mediaUpload + factChecks
- **PATCH**: Update fields, creates `AuditLog` with changed fields list
- **DELETE**: Soft-unlink (sets investigationId:null on related AnalysisReports), then delete; creates `AuditLog`
- Uses Next.js 16 `params: Promise<{ id: string }>` pattern (awaited)

### 7.13 `/api/download/project` - GET

**Purpose**: Generate ZIP of entire project source code

**Included**: src/, prisma/, public/, db/ + config files + worklog.md + README.md

**Excluded**: node_modules, .next, .git, download/, agent-ctx/, mini-services/, examples/, .env*, custom.db

**Implementation**: `archiver` ZipArchive with zlib level 9; streams to buffer; filename `TruthShield-v3.3.0-{timestamp}.zip`

---

## 8. Database Schema - Prisma/SQLite

**Provider**: SQLite (`DATABASE_URL` env var)

### Models

| Model | Key Fields | Relations |
|---|---|---|
| **User** | id(cuid), email(unique), name?, role(default "analyst"), avatar? | - |
| **MediaUpload** | id, userId?, fileName, fileType, mimeType, fileSize, storagePath?, thumbnailPath?, metadata?(Json), status | → analyses: AnalysisReport[] |
| **AnalysisReport** | id, mediaUploadId, analysisType, status, results?(Json), trustScore?(0-100), riskLevel?, aiModel?, processingTime?(ms), explanation?, confidence?(0-1), flags?(Json), recommendations?(Json) | → mediaUpload, factChecks[], investigation? |
| **FactCheckMatch** | id, analysisReportId, source, claim?, verdict?, confidence?, url?, snippet?, publishedDate? | → analysisReport |
| **Investigation** | id, title, description?, status, priority, tags?(Json), assignedTo? | → analyses: AnalysisReport[] |
| **Alert** | id, type, severity, title, message, source?, isRead, actionUrl? | - |
| **AuditLog** | id, userId?, action, resource, details?(Json), ipAddress? | - |
| **WatchlistItem** | id, keyword, type, language, isActive, hitCount, lastHitAt? | - |
| **DashboardStats** | id, totalAnalyses, fakeNewsDetected, deepfakesDetected, imagesAnalyzed, factChecksRun, activeAlerts, openInvestigations, avgTrustScore | - |

**Cascade Deletes**: MediaUpload→AnalysisReport, AnalysisReport→FactCheckMatch

**DB Singleton Pattern** (`src/lib/db.ts`):
```typescript
const globalForDb = globalThis as { prisma?: PrismaClient }
export const db = globalForDb.prisma ?? new PrismaClient({ log: ['query'] })
if (process.env.NODE_ENV !== 'production') globalForDb.prisma = db
```

---

## 9. Tab Components - Detailed Breakdown

### 9.1 Dashboard Tab (`dashboard-tab.tsx` - 697 lines)

**Store Hooks**: `useAppStore()` - dashboardStats, setActiveTab
**Charts**: AreaChart (trends), PieChart (risk distribution), BarChart (multilingual, horizontal)

**UI Sections**:
1. **Hero Section** - Shield icon with glow, gradient text, version badge, HeroParticles (20 floating dots with Framer Motion)
2. **Stat Cards** - 6 cards with sparkline charts (custom SVG polyline from normalized data)
3. **Charts Row** - Area chart (7-day trends) + Pie chart (risk distribution)
4. **Model Performance** - 4 circular gauges (Detection Accuracy 94.7%, False Positive 3.2%, Processing Speed 1.2s, Model Confidence 91.3%)
5. **Platform Health + Quick Actions** - API/Model/Queue/Uptime status, 5 action buttons
6. **Second Row** - Multilingual horizontal bar chart + Detection Timeline (vertical timeline with connecting line) + Recent Activity + Top Threats
7. **Live Activity Ticker** - Marquee animation with LIVE indicator
8. **Threat Intel Map** - Interactive SVG India map

**Custom Components**:
- `Sparkline` - SVG polyline from 7-point trend data
- `CircularGauge` - SVG circle with strokeDasharray animation
- `HeroParticles` - 20 floating dots with random positions

**Color Logic**: riskBadgeClass maps critical→red, high→orange, medium→yellow, low→green

### 9.2 Text Analysis Tab (`text-analysis-tab.tsx` - 348 lines)

**Store Hooks**: `useAppStore()` - textInput, selectedLanguage, textLoading, textResult, analyzeText, resetTextResult
**Components**: TrustScoreGauge, ExportButton
**Languages**: 10 Indian languages (English, Hindi, Gujarati, Tamil, Bengali, Marathi, Telugu, Punjabi, Urdu, Malayalam, Kannada)

**UI Flow**: Text input → Language selector → Analyze button → Results display
**Results Display**: Trust Score Gauge + Risk badge + Flags list (with icon mapping) + Explanation + Recommendations + Sentiment bar + Detected Claims + Propaganda Indicators

**Flag Icon Mapping**:
```
clickbait→AlertTriangle, emotional_language→Heart, unsubstantiated_claims→Link,
propaganda→Brain, conspiracy_theory→AlertTriangle, misleading_statistics→Eye,
false_equivalence→Brain, cherry_picking→Eye, appeal_to_fear→Heart,
ad_hominem→AlertTriangle, straw_man→Brain, fake_expert→Shield,
toxic_language→AlertTriangle, factual_error→AlertTriangle, emotional_manipulation→Heart
```

### 9.3 Image Forensics Tab (`image-forensics-tab.tsx` - 468 lines)

**Store Hooks**: `useAppStore()` - imageLoading, imageResult, analyzeImage, resetImageResult
**Components**: TrustScoreGauge, ExportButton, Tooltip

**UI Flow**: Upload zone (animated dashed border) → Analysis progress → Results
**Results**: Trust Score + AI Generated Likelihood bar + Manipulation Indicators (confidence bars) + Metadata Analysis (status badges) + Forensic Findings + Recommendations

**Scan Line Animation**: CSS `animate-scan-line` overlay during analysis
**ELA Visualization**: Mock error level analysis with colored regions

### 9.4 Video Analysis Tab (`video-analysis-tab.tsx` - 388 lines)

**Store Hooks**: `useAppStore()` - videoLoading, videoResult, analyzeVideo, resetVideoResult
**Components**: ExportButton, custom `ProgressRing` (SVG circle with stroke-dasharray)

**UI Flow**: Upload or URL input → Analysis → Results
**Results**: Deepfake Probability bar + Frame Analysis stats + Face Analysis + Temporal Consistency ring + Audio-Visual Sync ring

**ProgressRing Component**: SVG circle with `circumference = 2πr`, `strokeDashoffset = circumference × (1 - value/100)`

### 9.5 Fact Check Tab (`fact-check-tab.tsx` - 253 lines)

**Store Hooks**: `useAppStore()` - factCheckLoading, factCheckResult, verifyFact, resetFactCheckResult
**Components**: ExportButton

**Verdict Config**: true→CheckCircle(green), false→XCircle(red), misleading→AlertCircle(amber), unverified→HelpCircle(gray), partially_true→AlertCircle(blue)

**Languages**: Same 10+1 Indian languages as text analysis

### 9.6 History Tab (`history-tab.tsx` - 378 lines)

**Store Hooks**: `useAppStore()` - analysisHistory, fetchAnalysisHistory
**Features**: Search, filter (type/risk), sort, pagination, CSV export, expandable rows

**Type Icons**: text→FileText, image→ImageIcon, video→Video, fact_check→CheckCircle, image_reverse_search→Search

**CSV Export**: Converts analysis history to CSV string → blob download

### 9.7 Reverse Search Tab (`reverse-search-tab.tsx` - 530 lines)

**State**: `useState` for analysisStep (idle/uploading/describing/searching/analyzing/complete/error)
**API**: POST `/api/analyze/reverse-image` with FormData or URL

**Step Labels**: idle→"Ready", uploading→"Uploading...", describing→"Describing image...", searching→"Searching web...", analyzing→"Analyzing results...", complete→"Complete", error→"Failed"

**Results**: Original description + Web matches (with similarity scores) + Context analysis + Authenticity score

### 9.8 Chat Tab (`chat-tab.tsx` - 230 lines)

**Store Hooks**: `useAppStore()` - chatMessages, chatLoading, sendChatMessage, clearChatHistory
**Rendering**: `ReactMarkdown` for assistant messages
**Quick Prompts**: 6 pre-built questions about deepfakes, fact-checking, image forensics, etc.

**Auto-scroll**: `useRef` + `scrollIntoView()` on new messages
**Typing Indicator**: 3 bouncing dots with staggered animation

### 9.9 Investigations Tab (`investigations-tab.tsx` - 673 lines)

**Store Hooks**: `useAppStore()` - investigations, setActiveTab
**Features**: List view + Detail panel with risk gauge, evidence, timeline, action buttons

**Risk Assessment Gauge**: Horizontal gradient bar with animated spring marker
- Priority scores: critical=90, high=70, medium=40, low=15

**Evidence Data**: 16 evidence items across 6 investigations (hardcoded mock)
**Timeline Events**: 26 events with 6 color-coded types (created/analysis/evidence/update/escalation/closed)
**Action Buttons**: Add Evidence, Escalate, Close Investigation (with toast notifications)

### 9.10 Alerts Tab (`alerts-tab.tsx` - 238 lines)

**Store Hooks**: `useAppStore()` - alerts, markAlertRead

**Severity Config**: critical→red(Bell), high→orange(AlertTriangle), medium→yellow(Clock), low→green(Eye), info→blue(Settings)
**Type Icons**: deepfake→Video, fake_news→FileText, manipulation→ImageIcon, trend→TrendingUp, system→Settings

**Features**: Filter by severity/type, review progress bar, severity summary cards, mark read

### 9.11 Watchlist Tab (`watchlist-tab.tsx` - 474 lines)

**Store Hooks**: `useAppStore()` - watchlistItems, addWatchlistItem, removeWatchlistItem, toggleWatchlistItem
**Chart**: BarChart showing hit counts by item

**Type Icons**: keyword→Search, url→Globe, hashtag→Hash, account→AtSign
**Languages**: hi→हिन्दी, en→English, te→తెలుగు, ta→தமிழ்

**Features**: Add new item dialog, toggle active/inactive, remove items, hit count tracking

### 9.12 Community Tab (`crowdsource-tab.tsx` - 861 lines)

**Store Hooks**: `useAppStore()` - communityReports, addCommunityReport, voteOnReport
**Features**: Submit report dialog, upvote/downvote, collapsible report details, trust badges, status transitions

**Badge Styles**: Bronze→🥉, Silver→🥈, Gold→🥇, Platinum→💎
**Community Stats**: Total Reports, Verified, Active Users, Consensus Rate

### 9.13 Settings Tab (`settings-tab.tsx` - 784 lines)

**Store Hooks**: `useAppStore()` - analysisSensitivity, notificationsEnabled

**7 Sections**:
1. Profile (avatar, name, email, role badge)
2. General (API key, model selection, sensitivity slider, language)
3. Data Management (storage usage bar, auto-delete, retention, export/clear)
4. Appearance & Theme (light/dark/system, accent color picker, font size, compact mode, animations toggle)
5. Security & Privacy (2FA, session timeout, audit retention, encryption status, delete account)
6. Integrations (Google Fact Check, PIB, AltNews, BoomLive - connected/available/offline)
7. Notifications (email, push, critical alerts, digest frequency)

### 9.14 Audit Log Tab (`audit-log-tab.tsx` - 787 lines)

**Mock Data**: `generateMockEntries()` - 24 entries with Indian analyst names (Arjun Patel, Priya Sharma, etc.)
**Features**: Timeline visualization, search/filter (action type, severity), expandable metadata, auto-refresh indicator (simulated every 15s)

**Summary Stats**: Total Events, Critical Events, Analyses Today, Active Users

### 9.15 Media Comparison Tab (`media-comparison-tab.tsx` - 1014 lines)

**State**: Two media panels (Media A/B), comparison mode, slider position, analysis result
**API**: POST `/api/analyze/image` for each panel
**Features**: Side-by-side upload, comparison slider (drag to compare), difference regions overlay, comparison result with similarity score

**Comparison Modes**: Side by Side, Overlay, Difference Map
**Difference Regions**: Detected areas with bounding boxes and severity ratings

### 9.16 Browser Extension Tab (`browser-extension-tab.tsx` - 582 lines)

**Mock Browsers**: Chrome, Firefox, Edge with install buttons
**Features**: Extension demo overlay, settings panel (sensitivity, auto-analyze, notifications, whitelist), permissions list, feature list

**Permissions**: Read browsing data, Access active tab, Send notifications, Store settings locally
**Features**: Real-time detection, Visual overlay, One-click analysis, Confidence indicators

### 9.17 Model Metrics Tab (`model-metrics-tab.tsx` - 957 lines)

**Custom Component**: `CircularGauge` - SVG circle with animated stroke-dasharray
**Features**: Model comparison (Text/Image/Video/Audio models), A/B test results, performance metrics, API usage tracking, version history

**Model Data**: Text Model v2.1, Image Model v3.0, Video Model v1.8, Audio Model v1.2
**A/B Test**: Variant A vs B with accuracy, precision, recall, F1 scores

### 9.18 API Docs Tab (`api-docs-tab.tsx` - 1020 lines)

**Features**: Interactive API documentation with code examples, copy button, endpoint list
**Endpoints Documented**: All 13 API routes with request/response examples
**Code Blocks**: Syntax-highlighted with copy-to-clipboard functionality

**Custom Components**: `CopyButton`, `CodeBlock` with language-specific styling

### 9.19 Network Analysis Tab (`network-analysis-tab.tsx` - 1012 lines)

**Features**: File upload for watermark/steganography detection, network graph visualization, provenance tracking, metadata extraction timeline

**SVG Network Graph**: Animated nodes and edges with `motion.g`, `motion.circle`, `motion.line`
**Watermark Detection**: Simulated visible/invisible watermark scanning

### 9.20 Campaign Detection Tab (`campaign-detection-tab.tsx` - 786 lines)

**Types**: CampaignSeverity (critical/high/medium/low), CampaignStatus (Active/Monitoring/Contained)
**Features**: Campaign list with severity indicators, pattern detection visualization, timeline of coordinated activities, influence network graph

**Mock Campaigns**: "Operation Election Shield", "Health Misinfo Wave", etc.

### 9.21 OCR Scanner Tab (`ocr-scanner-tab.tsx` - 1116 lines)

**Features**: Upload image for text extraction, language selection (auto/Hindi/Tamil/Bengali/English), extraction results with confidence scores, extracted text display with line-by-line breakdown

**Languages**: auto→Auto-detect, hi→Hindi, ta→Tamil, bn→Bengali, en→English
**Table Display**: Character position, confidence score, language detection per line

### 9.22 Audio Deepfake Tab (`audio-deepfake-tab.tsx` - 1111 lines)

**Interfaces**: DetectedSpeaker, EmotionScore, DeepfakeIndicator, ArtifactItem, AudioHistoryEntry
**Features**: Audio upload/playback, waveform visualization (SVG), speaker detection, emotion analysis, deepfake indicators, spectral analysis

**Waveform**: SVG path with animated bars using `motion.line`
**Emotion Scores**: Happy, Sad, Angry, Fearful, Neutral, Surprised, Disgusted

### 9.23 Source Credibility Tab (`source-credibility-tab.tsx` - 1108 lines)

**Types**: SourceType (News/Social/Blog/Government/Fact-check), FactualRating, BiasPosition (Left→Right), FactCheckStatus, RedFlagSeverity
**Features**: Source search, credibility analysis, bias meter, factual rating, red flags, comparison view

**Mock Sources**: NDTV, Times of India, Aaj Tak, The Hindu, India Today, Dainik Jagran, etc.
**Bias Meter**: Visual horizontal scale from Left to Right

### 9.24 Live Threat Feed Tab (`live-threat-feed-tab.tsx` - 1035 lines)

**Types**: ThreatType (Deepfake/Misinformation/Manipulation/Phishing), ThreatSeverity, Platform (WhatsApp/Twitter/Facebook/Instagram/Telegram)
**Features**: Real-time threat stream (simulated), auto-scroll, pause/resume, alert rules, filtering by type/severity/platform

**Simulated Feed**: New threats appear every few seconds with mock data
**Alert Rules**: User-configurable rules for automatic notifications

### 9.25 Education Resources Tab (`education-resources-tab.tsx` - 989 lines)

**Interfaces**: Course, Tutorial, ReferenceCard, QuizQuestion
**Features**: Course catalog, tutorial library, reference cards, interactive quiz, progress tracking

**Quiz**: Multiple choice questions about deepfake detection, media literacy
**Courses**: "Understanding Deepfakes", "Fact-Checking Essentials", etc.

### 9.26 Report Generator Tab (`report-generator-tab.tsx` - 799 lines)

**Interfaces**: ReportSection, ReportTemplate, RecentReport
**Features**: Report title/author/date configuration, section management (drag to reorder, toggle visibility), template selection, preview, export

**Templates**: Full Verification, Quick Check, Investigation Report, Statistical Summary
**Sections**: Executive Summary, Methodology, Findings, Risk Assessment, Recommendations, Appendix

### 9.27 System Health Tab (`system-health-tab.tsx` - 801 lines)

**Custom Component**: `CircularGauge` (same as model metrics)
**Features**: CPU/Memory/Disk/Network gauges, service status list, deployment history, alert configuration

**Mock Services**: API Gateway, AI Model Server, Database, Cache, Queue, CDN
**Deployment History**: Version tracking with rollback capability

### 9.28 Data Visualization Tab (`data-visualization-tab.tsx` - 792 lines)

**Charts**: AreaChart (threat trends), PieChart (distribution), BarChart (by category), RadarChart (multi-dimensional)
**Time Ranges**: 7d, 30d, 90d, 1y with different data per range

**Export**: Download chart as PNG via canvas conversion

### 9.29 Workflow Automation Tab (`workflow-automation-tab.tsx` - 988 lines)

**Types**: WorkflowStatus (active/inactive), ExecutionStatus (success/failed/running), StepType (trigger/analyze/verify/notify/export), TriggerType, ScheduleFrequency
**Features**: Pipeline builder with drag-and-drop steps, execution history, workflow templates, scheduling

**Pipeline Steps**: Visual flow diagram with SVG connections using `motion.g/line/circle`
**Templates**: "Full Media Verification", "Quick Fact Check", "Batch Analysis Pipeline"

---

## 10. Shared Components

### TrustScoreGauge (`trust-score-gauge.tsx`)

**Props**: `score`, `size` (180), `label`, `showValue`
**Animation**: 1500ms ease-out count-up using `requestAnimationFrame`
**SVG Structure**: Background circle + progress arc + 24 tick marks + center text
**Color Logic**: ≥75→green, ≥50→yellow, ≥25→orange, <25→red
**Critical Pulse**: Score ≤25 gets animated pulsing ring
**Glow**: SVG `drop-shadow` filter varies by severity

### ThreatIntelMap (`threat-intel-map.tsx`)

**14 Indian Cities**: Delhi, Mumbai, Chennai, Kolkata, Bangalore, Hyderabad, Jaipur, Lucknow, Patna, Ahmedabad, Kochi, Chandigarh, Bhopal, Guwassati
**SVG Map**: Hand-crafted India outline + dashed state boundaries + water body labels
**Time Ranges**: 24h (×0.25), 7d (×0.6), 30d (×1.0) multipliers
**PulsingHotspot**: Animated circles with severity-dependent speed
**Right Panel**: Summary stats, severity legend, top 5 cities, hovered city detail card

### ExportButton (`export-button.tsx`)

**Props**: `data`, `filename`, `variant`, `size`
**Flow**: POST `/api/export` → receive blob → create `<a>` element → download → revoke URL

### BatchAnalysis (`batch-analysis.tsx`)

**Constraints**: Max 10 files; images ≤20MB; videos ≤100MB; duplicate detection by name+size
**Processing**: Sequential via `analyzeAll()` with per-file progress
**Abort**: `abortRef` flag for cancellation
**Summary**: Average trust score, risk distribution bars

### NotificationCenter (`notification-center.tsx`)

**Features**: Max 8 recent alerts, mark all read, click to mark individual read, "View All" → alerts tab
**Formatting**: `formatRelativeTime()` handles pre-formatted strings and ISO dates

### KeyboardShortcuts (`keyboard-shortcuts.tsx`)

**3 Sections**: Navigation (1-9,0 + letter keys), Actions (?/N/E/Cmd+K), View (Cmd+D/F/Esc)
**Search**: Filters shortcuts by description, key combo, or context
**Platform Detection**: Shows ⌘ on Mac, Ctrl on other platforms

---

## 11. Page Layout - Shell Architecture

**File**: `src/app/page.tsx`

### Layout Structure
```
<div className="min-h-screen flex flex-col bg-background">
  <GlobalSearch />          // Dialog overlay
  <KeyboardShortcuts />     // Dialog overlay
  <header>                  // Sticky top, z-50, header-glass
    <MobileMenu />          // Sheet (lg:hidden)
    <Brand />               // Shield icon + gradient text
    <CurrentTabLabel />     // Hidden on mobile
    <SearchTrigger />       // Cmd+K hint, hidden md:flex
    <ShortcutsHint />       // ? hint, hidden md:flex
    <SystemStatus />        // Online indicator + version, hidden lg:flex
    <NotificationCenter />  // Bell popover
    <ThemeToggle />         // Dark/light switch
    <UserAvatar />          // DS initials
  </header>
  <div className="flex flex-1">
    <DesktopSidebar />      // w-60, hidden lg:flex
    <main>                  // flex-1, mesh-gradient-bg animate-aurora
      <ScrollArea>          // h-[calc(100vh-3.5rem-3rem)]
        <AnimatePresence>   // Tab transition (fade + slide)
          {renderTab()}
        </AnimatePresence>
      </ScrollArea>
    </main>
  </div>
  <footer>                  // h-12, footer-premium
    <VersionInfo />
    <Stats />               // analyses count, threats detected
    <SystemActiveIndicator />
    <DownloadButton />      // Project download
    <Copyright />
  </footer>
</div>
```

### Key Measurements
- Header: `h-14`
- Sidebar: `w-60` (desktop), `w-72` (mobile Sheet)
- Main content: `h-[calc(100vh-3.5rem-3rem)]`
- Footer: `h-12`
- Tab transition: `duration: 0.2`, `y: 10 → 0`

### GlobalSearch Component
- Opens on Cmd+K / Ctrl+K
- Searches `searchItems` array by label + keywords
- Enter selects first result
- ESC key hint shown in search bar

### SidebarNav Component
- Groups `navItems` by `section` using `reduce()`
- Active tab: emerald background, left bar indicator, ChevronRight
- Alerts badge: red with unread count
- `btn-press` CSS class for press animation

### ProjectDownloadButton Component
- Fetches `/api/download/project` → blob → temporary `<a>` element download
- Extracts filename from `Content-Disposition` header
- Loading state: Loader2 spinner + "Packing..."
- Success/error toast via sonner
- Archive icon with bounce animation on hover

---

## 12. CSS Animation System

**File**: `src/app/globals.css` - 1200+ lines

### 40+ Custom Animations

| Animation Name | Purpose | Duration | CSS Class |
|---|---|---|---|
| `pulse-dot` | Status indicators | 2s | `.animate-pulse-dot` |
| `border-rotate` | Animated dashed border | 12s | `.animate-border-dash` |
| `scan-line` | Scanning overlay | 2s | `.animate-scan-line` |
| `shake` | Critical alerts | 0.6s | `.animate-shake` |
| `glow-pulse` | Critical glow effect | 2s | `.animate-glow-pulse` |
| `progress-ring-fill` | Gauge fill animation | 1.5s | `.animate-progress-ring` |
| `marquee` | Live ticker scroll | 30s | `.animate-marquee` |
| `fade-in-up` | Element entry | 0.4s | `.animate-fade-in-up` |
| `shimmer` | Skeleton loading | 2s | `.animate-shimmer` |
| `float` | Icon floating | 3s | `.animate-float` |
| `count-up` | Number transitions | 0.6s | `.animate-count-up` |
| `ripple` | Button press effect | 0.6s | `.animate-ripple` |
| `slide-in-left/right` | Directional entry | 0.3s | `.animate-slide-in-*` |
| `scale-up` | Scale entrance | 0.3s | `.animate-scale-up` |
| `hero-particle` | Dashboard particles | 4s | `.animate-hero-particle` |
| `orbit` | Model performance | 8s | `.animate-orbit` |
| `blink-cursor` | Chat typing | 1s | `.animate-blink-cursor` |
| `breathe-glow` | Active states | 3s | `.animate-breathe-glow` |
| `spin-slow` | Loading spinners | 3s | `.animate-spin-slow` |
| `gradient-shift` | Background shifts | 8s | `.animate-gradient-shift` |
| `bounce-subtle` | Badge animations | 2s | `.animate-bounce-subtle` |
| `pulse-ring` | Expanding ring | 1.5s | `.animate-pulse-ring` |
| `slide-down` | Reveal from top | 0.3s | `.animate-slide-down` |
| `morph` | Background blob shape | 8s | `.animate-morph` |
| `neon-flicker` | Critical alert neon | 2s | `.animate-neon-flicker` |
| `aurora` | Hero shimmer | 15s | `.animate-aurora` |
| `text-gradient-flow` | Gradient text | 6s | `.text-gradient-animated` |
| `shimmer-border` | Border shimmer | 1.5s | `.shimmer-border-hover:hover::before` |
| `badge-shimmer` | Premium badges | 3s | `.badge-premium` |
| `data-stream` | Live feed items | - | - |
| `waveform-bar` | Audio waveforms | 1.5s | `.animate-waveform-bar` |
| `live-pulse` | Live indicators | 2s | `.animate-live-pulse` |
| `typing-dot` | Chat typing dots | 1.4s | `.animate-typing-dot` |
| `blur-reveal` | Smooth appear | 0.6s | `.animate-blur-reveal` |
| `particle-drift` | Background particles | 8s | `.animate-particle-drift` |
| `text-reveal` | Text from blur | 0.8s | `.animate-text-reveal` |
| `image-reveal` | Clip-path reveal | 0.6s | `.animate-image-reveal` |
| `pipeline-flow` | Workflow connections | 2s | `.animate-pipeline-flow` |
| `metric-highlight` | Value highlight | 1s | `.animate-metric-highlight` |
| `scroll-indicator` | Scroll hints | 2s | `.animate-scroll-indicator` |

### Utility Classes

| Class | Purpose |
|---|---|
| `.glass` | Glassmorphism effect (blur + transparent bg) |
| `.glass-premium` | Enhanced glass with inset highlight |
| `.gradient-border` | Animated gradient border via mask-composite |
| `.card-elevation-1/2` | Multi-layer box shadows |
| `.sidebar-item-active` | Left emerald bar indicator |
| `.sidebar-active-indicator` | Same, alternate approach |
| `.btn-press` | Scale(0.97) on :active |
| `.hover-lift` | translateY(-2px) on hover |
| `.hover-glow` | Emerald glow on hover |
| `.stat-card-glow` | Radial gradient glow on hover |
| `.mesh-gradient-bg` | 3-point radial gradient background |
| `.header-glass` | Sticky header with blur + saturation |
| `.footer-premium` | Gradient footer background |
| `.brand-glow` | Text-shadow glow |
| `.pill-badge` | Gradient pill with border |
| `.gradient-text-shift` | Animated gradient text |
| `.card-gradient-top` | 2px gradient border at top |
| `.card-depth` | Multi-layer shadow depth |
| `.noise-texture` | SVG noise overlay |
| `.dot-pattern` | Radial-gradient dot matrix |
| `.skeleton-wave` | Loading shimmer wave |
| `.table-row-interactive` | Hover highlight for rows |
| `.tooltip-premium` | Glass tooltip with blur |

### Stagger Animation Helper
```css
.stagger-children > * { animation: fade-in-up 0.4s ease-out forwards; }
.stagger-children > *:nth-child(1) { animation-delay: 0s; }
.stagger-children > *:nth-child(2) { animation-delay: 0.05s; }
/* ... up to 10 children */
```

---

## 13. Design System & Color Strategy

### Primary Color: Emerald/Teal
- Active tab: `bg-emerald-500/15`, `text-emerald-600` / `dark:text-emerald-400`
- Sidebar active bar: `bg-emerald-500` gradient
- Buttons: `bg-emerald-500/10` with `border-emerald-500/20`
- System status: Emerald ping animation
- Version badge: `pill-badge` with emerald gradient

### Risk Level Colors
| Level | Background | Text | Dot |
|---|---|---|---|
| Critical | red-500/10 | red-600 | bg-red-500 |
| High | orange-500/10 | orange-600 | bg-orange-500 |
| Medium | yellow-500/10 | yellow-600 | bg-yellow-500 |
| Low | emerald-500/10 | emerald-600 | bg-emerald-500 |
| Info | blue-500/10 | blue-600 | bg-blue-500 |

### Verdict Colors
| Verdict | Icon | Color |
|---|---|---|
| true | CheckCircle | green |
| false | XCircle | red |
| misleading | AlertCircle | amber |
| unverified | HelpCircle | gray |
| partially_true | AlertCircle | blue |

### Trust Score Gauge Colors
| Range | Color |
|---|---|
| ≥75 | green (#22c55e) |
| ≥50 | yellow (#eab308) |
| ≥25 | orange (#f97316) |
| <25 | red (#ef4444) |

### Dark Mode Strategy
- Uses `next-themes` with `class` strategy
- All colors defined via CSS custom properties (oklch color space)
- `.dark` class toggles all `--color-*` variables
- Glassmorphism adapts: light→60% white, dark→60% black
- Shadows adapt: light→low opacity, dark→high opacity

### Typography
- Font: Geist Sans (via `--font-geist-sans`)
- Mono: Geist Mono (via `--font-geist-mono`)
- Headers: `font-bold` with `gradient-text-shift` animation
- Body: `text-sm` base size

---

## 14. Error Handling & Graceful Degradation

### Store-Level Fallbacks
Every store action has hardcoded fallback data:
- `analyzeText()` → fallback trustScore:28, riskLevel:'high', 4 flags
- `analyzeImage()` → fallback trustScore:35, aiGeneratedLikelihood:72, 4 manipulation indicators
- `analyzeVideo()` → fallback deepfakeProbability:78, 450 frames
- `verifyFact()` → fallback verdict:'unverified', confidence:50

### API-Level Error Handling
- All routes have outer try-catch
- Text analysis: attempts to create failed `AnalysisReport` on error
- Image/video: `finally { unlink(tempFile) }` always cleans up
- Reverse image search: each pipeline step has independent try-catch
- Export: JSON/text format fallback
- Download: 500 with error message

### UI-Level Error Handling
- Toast notifications via `sonner` for all user-facing errors
- Loading states: `Skeleton` components during data fetch
- Empty states: Meaningful messages when no data available
- API unavailable: Fallback mock data renders immediately

---

## 15. India-Focused Strategy

### Fact-Check Sources
- **PIB** (Press Information Bureau): pib.gov.in
- **AltNews**: altnews.in
- **BoomLive**: boomlive.in
- **Factly**: factly.in
- **Snopes**: snopes.com (international)
- **Google Fact Check Tools**: google.com

### Indian Language Support
10+1 languages supported:
- English (en), Hindi (hi), Gujarati (gu), Tamil (ta), Bengali (bn)
- Marathi (mr), Telugu (te), Punjabi (pa), Urdu (ur), Malayalam (ml), Kannada (kn)

### Watchlist Keywords
- Hindi: `चुनाव फर्जी`, `झूटी खबर`
- Telugu: `#నకిలీవార్తలు`
- Tamil: `போலி செய்தி`
- English: `fake news India`, `deepfake Modi`, `#ElectionFraud2024`

### Threat Intelligence
- 14 Indian cities on threat map
- Indian analyst names in audit log
- Indian media sources in credibility tab
- Indian political/election context in campaigns

---

## 16. Security Patterns

### API Validation
- Text: max 50,000 chars
- Fact check: max 10,000 chars
- Image: max 20MB, MIME type validation
- Video: max 100MB, MIME type validation
- Chat: max 5,000 chars per message

### Data Protection
- `.env` files excluded from project download
- Database file excluded from download
- No authentication on download endpoint (open)
- `agent-ctx/` and `download/` directories excluded from ZIP

### Audit Trail
- Investigation mutations → AuditLog entries
- Alert creation → AuditLog entries
- Investigation update → AuditLog with changed fields list

### Temp File Management
- Uploaded files saved to `/tmp/{uuid}.{ext}`
- Always cleaned in `finally` blocks
- Cleanup errors silently ignored

---

## 17. Performance Patterns

### Database
- Prisma singleton via `globalThis` to prevent hot-reload connection leaks
- `Promise.all` for parallel queries (dashboard stats, history count+data)
- Materialized view pattern for `DashboardStats`

### Frontend
- Zustand for client state (no unnecessary re-renders)
- `useCallback` for event handlers in threat map
- `AnimatePresence` with `mode="wait"` for tab transitions
- `ScrollArea` component for virtual scrolling
- `useMemo` for computed values (investigations)

### Caching
- No Redis/caching middleware
- In-memory Zustand store for client state
- Database queries are real-time (no server cache)

---

## 18. Infrastructure & Deployment

### Caddy Reverse Proxy (`Caddyfile`)
- Listens on port `:81`
- Default: proxy to `localhost:3000` (Next.js)
- Query param `XTransformPort=*` → proxy to `localhost:{port}`
- Forwards headers: Host, X-Forwarded-For, X-Forwarded-Proto, X-Real-IP

### Build Configuration
- `output: "standalone"` - self-contained production build
- `bun run dev` - development server on port 3000
- `bun run build` - production build with `cp -r` for static files
- `bun run start` - production standalone server

### Development Scripts
- `bun run dev` - `next dev --port 3000 2>&1 | tee dev.log`
- `bun run lint` - ESLint check
- `bun run db:push` - Push Prisma schema to SQLite
- `bun run db:generate` - Generate Prisma client
- `bun run db:reset` - Reset database

---

## 19. Cross-Cutting Patterns & Conventions

### Code Conventions
- `'use client'` on all tab components
- TypeScript throughout with strict typing
- ES6+ import/export syntax
- shadcn/ui components preferred over custom implementations
- Prisma schema: primitive types only (no lists - use Json for arrays)
- Database file in `/db` directory
- API routes use `NextRequest` / `NextResponse`

### Component Patterns
- All tab components exported as named exports: `export function XTab()`
- Store access: `const { field, action } = useAppStore()`
- Toast pattern: `toast.success('msg', { description: '...' })`
- Card pattern: `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>...</CardContent></Card>`
- Motion pattern: `<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>`

### API Route Patterns
- All routes export `async function GET/POST/PATCH/DELETE(request: NextRequest)`
- Validation → Processing → DB → Response
- Processing time measured with `Date.now() - startTime`
- DB records: `MediaUpload` + `AnalysisReport` for every analysis

### Responsive Design
- Mobile: `<lg` shows Sheet sidebar, hidden desktop sidebar
- Desktop: `lg:` shows permanent sidebar
- Search: `md:flex` for search bar
- Stats: `sm:inline` for footer stats
- Grid: responsive breakpoints `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

### Keyboard Shortcuts
- `Cmd+K` / `Ctrl+K` → Global search
- `?` → Keyboard shortcuts dialog
- Number keys → Tab navigation (via KeyboardShortcuts component)

---

## 20. Known Issues & Risks

1. **Fact Check Source Credibility** - All sources show similar credibility ratings derived from overall confidence. Needs per-source credibility data.
2. **Sentiment Score** - Neutral sentiment shows as "0%" which could be confusing. Consider bipolar scale.
3. **Chart Labels on Mobile** - Recharts auto-layout truncates labels at small widths.
4. **Deepfake Detection Accuracy** - VLM-based detection is experimental. Not guaranteed reliable under compression or adversarial conditions.
5. **API Rate Limits** - z-ai-web-dev-sdk may have rate limits for heavy usage.
6. **Large Video Files** - Video upload limited to 100MB. Large videos may timeout during VLM analysis.
7. **Marquee Animation** - Uses CSS only, items don't loop seamlessly (starts over).
8. **No Authentication** - Download endpoint and all API routes are unauthenticated.
9. **Mock Data Dependency** - Many tabs use hardcoded mock data rather than real API calls.
10. **Bundle Size** - 30 tab components all loaded in single page (no lazy loading).
11. **archiver v8** - Uses named exports (`ZipArchive`), not default export. Must use `import { ZipArchive } from 'archiver'`.
12. **Next.js 16 Params** - Route params are `Promise<>` type, must be `await`ed.

---

*End of Context.md - Every insight, strategy, and logic documented.*
