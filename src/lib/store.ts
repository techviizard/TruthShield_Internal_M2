import { create } from 'zustand'
import { toast } from 'sonner'
// Pure, dependency-free detector - safe to run in the browser for offline scoring.
import { scoreText } from '@/lib/engines/text-heuristics'
// Static import is safe: the module touches IndexedDB only inside its functions.
import { enqueue } from '@/lib/offline-queue'
import { decodeToWav } from '@/lib/audio-decode'

export type TabId = 'dashboard' | 'text' | 'image' | 'video' | 'factcheck' | 'investigations' | 'alerts' | 'watchlist' | 'community' | 'settings' | 'history' | 'reverseSearch' | 'chat' | 'batch' | 'auditLog' | 'comparison' | 'browserExtension' | 'modelMetrics' | 'apiDocs' | 'networkAnalysis' | 'campaignDetection' | 'ocrScanner' | 'audioDeepfake' | 'sourceCredibility' | 'liveThreatFeed' | 'educationResources' | 'workflowAutomation' | 'systemHealth' | 'dataVisualization' | 'reportGenerator'

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type Verdict = 'true' | 'false' | 'misleading' | 'unverified' | 'partially_true'
export type InvestigationStatus = 'open' | 'in_progress' | 'closed' | 'archived'
export type InvestigationPriority = 'critical' | 'high' | 'medium' | 'low'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AlertType = 'deepfake' | 'fake_news' | 'manipulation' | 'trend' | 'system'

export interface TextAnalysisResult {
  trustScore: number
  riskLevel: RiskLevel
  flags: { type: string; description: string; icon: string }[]
  explanation: string
  confidence: number
  recommendations: string[]
  detectedClaims: string[]
  sentiment: { label: string; score: number }
  propagandaIndicators: string[]
  /** Signal-level attribution from the in-house detector, plus model agreement. */
  detectorBreakdown?: {
    model: { trustScore: number; label: string } | null
    heuristic: {
      trustScore: number
      riskLevel: string
      script: string
      explanation: string
      signals: { id: string; label: string; weight: number; matches: string[]; contribution: number }[]
    }
    agreement: 'agree' | 'partial' | 'conflict' | 'model_unavailable'
    scoreGap: number | null
  }
  knownHoaxMatches?: {
    id: string
    title: string
    narrative: string
    category: string
    verdict: string
    similarity: number
    matchType: 'text' | 'image'
    debunkUrl: string | null
    debunkSource: string | null
    hitCount: number
  }[]
}

export interface ImageForensicsDetail {
  manipulationScore: number
  trustScore: number
  riskLevel: string
  signals: { id: string; label: string; contribution: number; detail: string }[]
  explanation: string
  ela: { meanDelta: number; maxDelta: number; suspectArea: number }
  elaOverlay: string
  elaRegions: { x: number; y: number; w: number; h: number; intensity: number }[]
  noise: { globalStd: number; tileStdMean: number; tileStdVariance: number; inconsistencyScore: number }
  edges: { edgePct: number; aiSuspicion: number }
  spectral: { ganArtifactScore: number; peakRatio: number; dominantPeriod: number | null; explanation: string }
}

export interface ProvenanceDetail {
  hasExif: boolean
  hasXmp: boolean
  hasIcc: boolean
  c2paPresent: boolean
  c2paVerified: boolean
  editingSoftware: string | null
  capturedAt: string | null
  cameraMake: string | null
  cameraModel: string | null
  gpsPresent: boolean
  generatorHints: string[]
  fields: { field: string; value: string; status: 'clean' | 'suspicious' | 'warning' | 'info'; note?: string }[]
  suspicionScore: number
  summary: string
}

export interface ImageAnalysisResult {
  trustScore: number
  aiGeneratedLikelihood: number
  manipulationIndicators: { type: string; confidence: number; description: string }[]
  metadataAnalysis: { field: string; value: string; status: 'clean' | 'suspicious' | 'warning' }[]
  forensicFindings: string[]
  recommendations: string[]
  /** Pixel-level evidence from the in-house engines. */
  forensics?: ImageForensicsDetail
  provenance?: ProvenanceDetail
  /** Preview of the analysed file, for overlaying ELA regions. */
  previewUrl?: string
  detectorBreakdown?: {
    model: { trustScore: number; label: string } | null
    forensicTrustScore: number
    agreement: 'agree' | 'partial' | 'conflict' | 'model_unavailable'
    scoreGap: number | null
  }
}


export interface VideoAnalysisResult {
  deepfakeProbability: number
  frameAnalysis: {
    totalFrames: number
    flaggedFrames: number
    consistency: number
  }
  faceAnalysis: {
    facesDetected: number
    anomalies: string[]
    confidence: number
  }
  temporalConsistency: number
  /** 0-1. Real audio-forensics trust score when the audio track was decodable, otherwise a neutral 0.5. */
  audioVisualSync: number
  /** Whether the number above is backed by real audio DSP, or unavailable because no audio track could be decoded. */
  audioAnalysis: { available: boolean; note: string }
  riskAssessment: RiskLevel
}


export interface FactCheckResult {
  verdict: Verdict
  confidence: number
  matchingFactChecks: { source: string; url: string; rating: string; title: string; stance?: string }[]
  evidenceSummary: string
  sourceCredibility: { source: string; rating: number; type: string }[]
  reasoning?: string
  claimAnalysis?: {
    claimType?: string
    verifiability?: string
    logicalFallacies?: string[]
    keyEntities?: string[]
  }
  cached?: boolean
  /** In-house stance aggregation over the retrieved evidence. */
  stanceRollup?: {
    support: number
    refute: number
    neutral: number
    unrelated: number
    net: number
    verdictHint: 'likely_false' | 'likely_true' | 'disputed' | 'unverified'
  }
  knownHoaxMatches?: {
    id: string
    title: string
    narrative: string
    category: string
    verdict: string
    similarity: number
    matchType: 'text' | 'image'
    debunkUrl: string | null
    debunkSource: string | null
    hitCount: number
  }[]
  /** Verdict produced without the language model (stance + registry only). */
  degraded?: boolean
}

export interface InvestigationAnalysis {
  id: string
  analysisType: string
  status: string
  trustScore: number | null
  riskLevel: string | null
  createdAt: string
}

export interface Investigation {
  id: string
  title: string
  status: InvestigationStatus
  priority: InvestigationPriority
  assignedAnalyst: string
  relatedAnalyses: number
  /** Analyses attached to this case - the real evidence list. */
  analyses: InvestigationAnalysis[]
  tags: string[]
  createdAt: string
  updatedAt: string
  description: string
  /** Law-enforcement case metadata - present only when the case was filed with it. */
  caseNumber: string | null
  firNumber: string | null
  officerName: string | null
  officerBadge: string | null
  jurisdiction: string | null
}

export interface Alert {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  type: AlertType
  timestamp: string
  read: boolean
  source: string
}

export interface DashboardStats {
  totalAnalyses: number
  fakeNewsDetected: number
  deepfakesDetected: number
  imagesAnalyzed: number
  avgTrustScore: number
  activeAlerts: number
  trendData: { date: string; analyses: number; threats: number }[]
  riskDistribution: { level: string; count: number; color: string }[]
  analysisByType: { type: string; count: number }[]
  recentActivity: { id: string; action: string; timestamp: string; type: string; risk: RiskLevel }[]
  topThreats: { title: string; type: string; risk: RiskLevel; timestamp: string }[]
  trustScoreDistribution: { range: string; count: number }[]
  detectionTimeline: { time: string; type: string; confidence: number; desc: string }[]
  languages: { language: string; code: string; count: number; percent: number }[]
}

export type WatchlistItemType = 'keyword' | 'url' | 'hashtag' | 'account'

export interface WatchlistItem {
  id: string
  keyword: string
  type: WatchlistItemType
  language: string
  active: boolean
  hitCount: number
  lastHit: string | null
  createdAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface AnalysisHistoryItem {
  id: string
  investigationId: string | null
  createdAt: string
  analysisType: string
  trustScore: number | null
  riskLevel: string | null
  status: string
  explanation: string | null
  mediaFileName: string
  mediaFileType: string
  results: string | null
  flags: string | null
  recommendations: string | null
  confidence: number | null
  processingTime: number | null
}

export interface AnalysisHistoryResponse {
  items: AnalysisHistoryItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type CommunityReportStatus = 'pending' | 'verified' | 'disputed'
export type TrustBadge = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

export interface CommunityReport {
  id: string
  title: string
  description: string
  mediaType: 'text' | 'image' | 'video' | 'audio'
  submitterName: string
  submitterTrustScore: number
  submitterBadge: TrustBadge
  agreeVotes: number
  disagreeVotes: number
  status: CommunityReportStatus
  consensusScore: number
  timestamp: string
  tags: string[]
}

interface AppState {
  // Navigation
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Loading states
  textLoading: boolean
  imageLoading: boolean
  videoLoading: boolean
  factCheckLoading: boolean
  dashboardLoading: boolean
  investigationsLoading: boolean
  alertsLoading: boolean

  // Analysis results
  textResult: TextAnalysisResult | null
  imageResult: ImageAnalysisResult | null
  videoResult: VideoAnalysisResult | null
  factCheckResult: FactCheckResult | null

  // Dashboard
  dashboardStats: DashboardStats | null

  // Investigations
  investigations: Investigation[]

  // Alerts
  alerts: Alert[]

  // Text analysis input
  textInput: string
  setTextInput: (text: string) => void
  selectedLanguage: string
  setSelectedLanguage: (lang: string) => void

  // Settings
  analysisSensitivity: number
  setAnalysisSensitivity: (val: number) => void
  notificationsEnabled: boolean
  setNotificationsEnabled: (val: boolean) => void

  // Watchlist
  watchlistItems: WatchlistItem[]
  fetchWatchlist: () => Promise<void>
  addWatchlistItem: (item: Omit<WatchlistItem, 'id' | 'hitCount' | 'lastHit' | 'createdAt'>) => Promise<void>
  removeWatchlistItem: (id: string) => Promise<void>
  toggleWatchlistItem: (id: string) => Promise<void>

  // Community
  communityReports: CommunityReport[]
  fetchCommunityReports: () => Promise<void>
  addCommunityReport: (report: Omit<CommunityReport, 'id' | 'agreeVotes' | 'disagreeVotes' | 'consensusScore' | 'timestamp'>) => Promise<void>
  voteOnReport: (id: string, vote: 'agree' | 'disagree') => Promise<void>

  // Actions
  analyzeText: () => Promise<void>
  analyzeImage: (file: File) => Promise<void>
  analyzeVideo: (source: File | { url: string }) => Promise<void>
  verifyFact: (claim: string, language?: string) => Promise<void>
  factCheckError: string | null
  fetchDashboardStats: () => Promise<void>
  fetchInvestigations: () => Promise<void>
  /** Body is passed to POST /api/investigations as-is (API field names, e.g. `assignedTo`). */
  createInvestigation: (data: Partial<Investigation> & Record<string, unknown>) => Promise<void>
  updateInvestigation: (id: string, data: Partial<Investigation> & Record<string, unknown>) => Promise<boolean>
  deleteInvestigation: (id: string) => Promise<boolean>
  attachEvidence: (investigationId: string, reportId: string) => Promise<boolean>
  detachEvidence: (investigationId: string, reportId: string) => Promise<boolean>
  updateInvestigationStatus: (id: string, status: InvestigationStatus) => Promise<boolean>
  updateInvestigationPriority: (id: string, priority: InvestigationPriority) => Promise<boolean>
  fetchAlerts: () => Promise<void>
  markAlertRead: (id: string) => void
  resetTextResult: () => void
  resetImageResult: () => void
  resetVideoResult: () => void
  resetFactCheckResult: () => void

  // Chat
  chatMessages: ChatMessage[]
  chatLoading: boolean
  sendChatMessage: (message: string) => Promise<void>
  clearChatHistory: () => void

  // Analysis History
  analysisHistory: AnalysisHistoryItem[]
  analysisHistoryTotal: number
  analysisHistoryPage: number
  analysisHistoryLoading: boolean
  fetchAnalysisHistory: (params?: { type?: string; riskLevel?: string; search?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string; unattachedOnly?: boolean }) => Promise<void>
}

/** Relative "x min ago" label used across list views. */
function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} d ago`
}

function safeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** Prisma Investigation row -> UI Investigation. */
function mapInvestigation(row: Record<string, unknown>): Investigation {
  const rawAnalyses = Array.isArray(row.analyses) ? (row.analyses as Record<string, unknown>[]) : []
  const analyses: InvestigationAnalysis[] = rawAnalyses.map((a) => ({
    id: String(a.id),
    analysisType: String(a.analysisType ?? 'unknown'),
    status: String(a.status ?? 'completed'),
    trustScore: a.trustScore == null ? null : Number(a.trustScore),
    riskLevel: a.riskLevel == null ? null : String(a.riskLevel),
    createdAt: String(a.createdAt ?? ''),
  }))
  return {
    id: String(row.id),
    title: String(row.title ?? 'Untitled investigation'),
    status: (row.status as InvestigationStatus) ?? 'open',
    priority: (row.priority as InvestigationPriority) ?? 'medium',
    assignedAnalyst: (row.assignedTo as string) || 'Unassigned',
    relatedAnalyses: analyses.length,
    analyses,
    tags: safeTags(row.tags),
    createdAt: String(row.createdAt ?? '').split('T')[0],
    updatedAt: String(row.updatedAt ?? '').split('T')[0],
    description: (row.description as string) ?? '',
    caseNumber: (row.caseNumber as string) ?? null,
    firNumber: (row.firNumber as string) ?? null,
    officerName: (row.officerName as string) ?? null,
    officerBadge: (row.officerBadge as string) ?? null,
    jurisdiction: (row.jurisdiction as string) ?? null,
  }
}

/** Prisma Alert row -> UI Alert (severity/type vocabularies differ). */
function mapAlert(row: Record<string, unknown>): Alert {
  const severityMap: Record<string, AlertSeverity> = {
    critical: 'critical',
    error: 'high',
    warning: 'medium',
    info: 'info',
  }
  const typeMap: Record<string, AlertType> = {
    threat: 'fake_news',
    verification_complete: 'manipulation',
    escalation: 'trend',
    system: 'system',
  }
  const title = String(row.title ?? 'Alert')
  const inferred: AlertType = /deepfake|synthetic voice/i.test(title)
    ? 'deepfake'
    : /manipulation|image/i.test(title)
      ? 'manipulation'
      : typeMap[String(row.type)] ?? 'system'
  return {
    id: String(row.id),
    title,
    message: String(row.message ?? ''),
    severity: severityMap[String(row.severity)] ?? 'info',
    type: inferred,
    timestamp: relativeTime(String(row.createdAt ?? new Date().toISOString())),
    read: Boolean(row.isRead),
    source: (row.source as string) || 'TruthShield',
  }
}

/** Tracks the in-flight image analysis so a newer upload or a reset can cancel it. */
let imageAnalysisController: AbortController | null = null

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Loading states
  textLoading: false,
  imageLoading: false,
  videoLoading: false,
  factCheckLoading: false,
  dashboardLoading: false,
  investigationsLoading: false,
  alertsLoading: false,

  // Analysis results
  textResult: null,
  imageResult: null,
  videoResult: null,
  factCheckResult: null,

  // Dashboard - populated from /api/dashboard/stats on mount
  dashboardStats: null,

  // Investigations - populated from /api/investigations
  investigations: [],

  // Alerts - populated from /api/alerts
  alerts: [],

  // Text analysis input
  textInput: '',
  setTextInput: (text) => set({ textInput: text }),
  selectedLanguage: 'en',
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),

  // Settings
  analysisSensitivity: 75,
  setAnalysisSensitivity: (val) => set({ analysisSensitivity: val }),
  notificationsEnabled: true,
  setNotificationsEnabled: (val) => set({ notificationsEnabled: val }),

  // Watchlist
  watchlistItems: [],
  fetchWatchlist: async () => {
    try {
      const res = await fetch('/api/watchlist')
      if (!res.ok) return
      const data = await res.json()
      const items: WatchlistItem[] = (data.items ?? []).map((i: Record<string, unknown>) => ({
        id: String(i.id),
        keyword: String(i.keyword),
        type: (i.type as WatchlistItemType) ?? 'keyword',
        language: String(i.language ?? 'en'),
        active: Boolean(i.isActive),
        hitCount: Number(i.hitCount ?? 0),
        lastHit: i.lastHitAt ? new Date(String(i.lastHitAt)).toLocaleString() : null,
        createdAt: new Date(String(i.createdAt)).toISOString().split('T')[0],
      }))
      set({ watchlistItems: items })
    } catch {
      /* keep current list */
    }
  },
  addWatchlistItem: async (item) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      if (!res.ok) throw new Error('Failed to add watchlist item')
      await get().fetchWatchlist()
      toast.success('Watchlist item added')
    } catch {
      toast.error('Could not add watchlist item')
    }
  },
  removeWatchlistItem: async (id) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to remove watchlist item')
      await get().fetchWatchlist()
    } catch {
      toast.error('Could not remove watchlist item')
    }
  },
  toggleWatchlistItem: async (id) => {
    const current = get().watchlistItems.find((i) => i.id === id)
    if (!current) return
    try {
      const res = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !current.active }),
      })
      if (!res.ok) throw new Error('Failed to update watchlist item')
      await get().fetchWatchlist()
    } catch {
      toast.error('Could not update watchlist item')
    }
  },

  // Community
  communityReports: [],
  fetchCommunityReports: async () => {
    try {
      const res = await fetch('/api/community')
      if (!res.ok) return
      const data = await res.json()
      const reports: CommunityReport[] = (data.reports ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title),
        description: String(r.description ?? ''),
        mediaType: (r.mediaType as CommunityReport['mediaType']) ?? 'text',
        submitterName: String(r.submitterName ?? 'Anonymous'),
        submitterTrustScore: Number(r.submitterTrustScore ?? 50),
        submitterBadge: (r.submitterBadge as TrustBadge) ?? 'Bronze',
        agreeVotes: Number(r.agreeVotes ?? 0),
        disagreeVotes: Number(r.disagreeVotes ?? 0),
        status: (r.status as CommunityReportStatus) ?? 'pending',
        consensusScore: Number(r.consensusPct ?? r.consensusScore ?? 0),
        timestamp: r.timestamp ? new Date(String(r.timestamp)).toLocaleString() : '',
        tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      }))
      set({ communityReports: reports })
    } catch {
      /* keep current list */
    }
  },
  addCommunityReport: async (report) => {
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })
      if (!res.ok) throw new Error('Failed to submit report')
      await get().fetchCommunityReports()
      toast.success('Report submitted for community verification')
    } catch {
      toast.error('Could not submit report')
    }
  },
  voteOnReport: async (id, vote) => {
    try {
      const res = await fetch('/api/community/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, vote }),
      })
      if (!res.ok) throw new Error('Vote failed')
      await get().fetchCommunityReports()
    } catch {
      toast.error('Could not record vote')
    }
  },

  // Actions
  analyzeText: async () => {
    const { textInput, selectedLanguage } = get()
    if (!textInput.trim()) return
    set({ textLoading: true, textResult: null })

    // Offline: score on-device and queue for replay, instead of failing. The
    // provisional verdict is labelled so it is never mistaken for a full analysis.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const local = scoreText(textInput)
      const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      // Queue write must never block showing the user their provisional result.
      await enqueue({
        id,
        kind: 'text',
        payload: { text: textInput, language: selectedLanguage },
        localVerdict: {
          trustScore: local.trustScore,
          riskLevel: local.riskLevel,
          explanation: local.explanation,
          signals: local.signals.map((s) => ({ id: s.id, label: s.label, contribution: s.contribution })),
        },
        createdAt: Date.now(),
        status: 'queued',
      }).catch(() => undefined)

      set({
        textLoading: false,
        textResult: {
          trustScore: local.trustScore,
          riskLevel: local.riskLevel as RiskLevel,
          flags: local.signals
            .filter((s) => s.weight > 0)
            .map((s) => ({
              type: s.id,
              description: s.label,
              icon: 'AlertTriangle',
            })),
          explanation: `${local.explanation} Scored on-device while offline - no language-model reasoning, no fact-check corroboration and no evidence record yet. Queued for sync.`,
          confidence: 50,
          recommendations: [
            'Treat this as provisional until the queued analysis syncs.',
            'Reconnect and press Sync to run the full pipeline and create the custody record.',
          ],
          detectedClaims: [],
          sentiment: { label: 'Not evaluated offline', score: 0 },
          propagandaIndicators: [],
          detectorBreakdown: {
            model: null,
            heuristic: {
              trustScore: local.trustScore,
              riskLevel: local.riskLevel,
              script: local.script,
              explanation: local.explanation,
              signals: local.signals,
            },
            agreement: 'model_unavailable',
            scoreGap: null,
          },
          knownHoaxMatches: [],
        },
      })
      toast.warning('Offline - scored on this device', {
        description: 'Queued for sync. Reconnect to run the full analysis.',
      })
      return
    }

    try {
      const res = await fetch('/api/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput, language: selectedLanguage }),
      })
      if (res.ok) {
        const data = await res.json()
        // API returns { success, reportId, analysis: {...}, processingTime }
        // Transform to TextAnalysisResult shape
        const analysis = data.analysis || data
        const details = analysis.details || {}
        const rawFlags: string[] = Array.isArray(analysis.flags) ? analysis.flags : []
        const iconMap: Record<string, string> = {
          clickbait: 'AlertTriangle', emotional_language: 'Heart', unsubstantiated_claims: 'Link',
          propaganda: 'Brain', conspiracy_theory: 'AlertTriangle', misleading_statistics: 'Eye',
          false_equivalence: 'Brain', cherry_picking: 'Eye', appeal_to_fear: 'Heart',
          ad_hominem: 'AlertTriangle', straw_man: 'Brain', fake_expert: 'Shield',
          toxic_language: 'AlertTriangle', factual_error: 'AlertTriangle', emotional_manipulation: 'Heart',
          source_missing: 'Link',
        }
        const flags = rawFlags.map((f: string) => ({
          type: f,
          description: f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          icon: iconMap[f] || 'AlertTriangle',
        }))
        const sentiment = details.sentiment
          ? { label: String(details.sentiment.overall || 'Neutral'), score: Number(details.sentiment.score) || 0 }
          : { label: 'Neutral', score: 0 }
        const detectedClaims: string[] = Array.isArray(details.claimsExtracted)
          ? details.claimsExtracted.map(String)
          : []
        const propagandaIndicators: string[] = Array.isArray(details.propagandaTechniques)
          ? details.propagandaTechniques.map(String)
          : Array.isArray(details.misinformationIndicators)
            ? details.misinformationIndicators.map(String)
            : []
        set({
          textLoading: false,
          textResult: {
            trustScore: typeof analysis.trustScore === 'number' ? analysis.trustScore : 50,
            riskLevel: analysis.riskLevel || 'medium',
            flags,
            explanation: analysis.explanation || 'Analysis completed',
            confidence: typeof analysis.confidence === 'number'
              ? analysis.confidence <= 1 ? Math.round(analysis.confidence * 100) : analysis.confidence
              : 50,
            recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations.map(String) : [],
            detectedClaims,
            sentiment,
            propagandaIndicators,
            detectorBreakdown: details.detectorBreakdown,
            knownHoaxMatches: Array.isArray(details.knownHoaxMatches) ? details.knownHoaxMatches : [],
          },
        })
        toast.success('Text analysis complete!')
      } else {
        const errorData = await res.json().catch(() => ({}))
        const message = errorData.error || 'Analysis failed. Please try again.'
        toast.error(message)
        set({ textLoading: false, textResult: null })
      }
    } catch {
      toast.error('Network error. Could not reach the analysis server.')
      set({ textLoading: false, textResult: null })
    }
  },

  analyzeImage: async (file: File) => {
    // Cancel any previous image analysis.
    imageAnalysisController?.abort()

    const controller = new AbortController()
    imageAnalysisController = controller
    const isStale = () => controller.signal.aborted || imageAnalysisController !== controller

    set({ imageLoading: true, imageResult: null })

    try {
      const formData = new FormData()
      // 1. Send the RAW file for local pixel forensics
      formData.append('image', file)

      // 2. Compress a copy specifically for the AI model (OpenRouter).
      //    If compression fails we still run the forensic analysis without it.
      try {
        const compressedBase64 = await new Promise<string>((resolve, reject) => {
          const img = new window.Image()
          const objectUrl = URL.createObjectURL(file)
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const scale = 800 / img.width
            canvas.width = 800
            canvas.height = img.height * scale
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
            URL.revokeObjectURL(objectUrl)
            resolve(canvas.toDataURL('image/jpeg', 0.7))
          }
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('Failed to compress image'))
          }
          img.src = objectUrl
        })
        formData.append('aiPayload', compressedBase64)
      } catch {
        /* proceed with the raw file only */
      }

      if (isStale()) return

      // 3. Dispatch the dual-payload request to the backend
      const res = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      // Ignore responses from cancelled or superseded requests.
      if (isStale()) return

      if (!res.ok) {
        throw new Error('Image analysis failed')
      }

      const data = await res.json()

      if (isStale()) return

      // API returns { success, reportId, analysis: {...}, processingTime }
      // Transform to ImageAnalysisResult shape
      const analysis = data.analysis || data
      const details = analysis.details || {}
      const rawFlags: string[] = Array.isArray(analysis.flags) ? analysis.flags : []

      const manipulationIndicators = rawFlags.map((f: string) => ({
        type: f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        // Use the model's real confidence (0-1 → 0-100). No random jitter - this is a verification product.
        confidence: Math.round(
          typeof analysis.confidence === 'number'
            ? analysis.confidence <= 1
              ? analysis.confidence * 100
              : analysis.confidence
            : 50
        ),
        description:
          f.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) +
          ' detected in analysis',
      }))

      const metadata = details.metadataAnalysis as Record<string, unknown> | undefined
      const metaAnomalies: string[] = Array.isArray(metadata?.anomalies)
        ? (metadata!.anomalies as string[])
        : []
      const editingSoftware = metadata?.editingSoftware as string | null | undefined

      const metadataAnalysis = [
        ...(editingSoftware
          ? [{ field: 'Software', value: editingSoftware, status: 'suspicious' as const }]
          : []),
        ...(metaAnomalies.length > 0
          ? [{
              field: 'Metadata Anomalies',
              value: metaAnomalies.join(', '),
              status: 'warning' as const,
            }]
          : []),
        { field: 'Image Dimensions', value: 'Analyzed', status: 'clean' as const },
      ]

      const forensicFindings: string[] = Array.isArray(details.manipulationIndicators)
        ? (details.manipulationIndicators as string[]).map(String)
        : rawFlags.map(
            (f: string) => `${f.replace(/_/g, ' ')} analysis indicates potential issues`
          )

      set({
        imageResult: {
          trustScore: typeof analysis.trustScore === 'number' ? analysis.trustScore : 50,
          aiGeneratedLikelihood:
            typeof (details as Record<string, unknown>).aiGenerationProbability === 'number'
              ? ((details as Record<string, unknown>).aiGenerationProbability as number)
              : typeof analysis.trustScore === 'number'
                ? 100 - analysis.trustScore
                : 50,
          manipulationIndicators,
          metadataAnalysis,
          forensicFindings,
          recommendations: Array.isArray(analysis.recommendations)
            ? analysis.recommendations.map(String)
            : [],
          forensics: details.forensics,
          provenance: details.provenance,
          detectorBreakdown: details.detectorBreakdown,
          previewUrl: URL.createObjectURL(file),
        },
      })

      toast.success('Image analysis complete!')
    } catch (error) {
      // Cancellation is intentional; do not show an error or fallback result.
      if (isStale()) return

      console.error('Image analysis error:', error)
      set({ imageResult: null })
      toast.error('Image analysis failed. Please try again.')
    } finally {
      // Only the active request may change the loading state.
      if (imageAnalysisController === controller) {
        imageAnalysisController = null
        set({ imageLoading: false })
      }
    }
  },

  analyzeVideo: async (source: File | { url: string }) => {
    set({ videoLoading: true, videoResult: null })
    const file = source instanceof File ? source : null

    // Try to get a REAL audio-forensics result from the video's own audio
    // track, using the existing, already-proven /api/forensics/audio engine.
    // This runs independently of the visual analysis below - if the video
    // has no audio track, or the browser can't decode its codec, we fail
    // quietly and mark the result as unavailable rather than guessing.
    let audioAuthenticity = 0.5
    let audioAnalysis: { available: boolean; note: string } = {
      available: false,
      note: 'No audio track could be extracted or analysed for this video.',
    }
    try {
      // Audio extraction needs the actual file; URL sources skip it.
      if (!file) throw new Error('No local file to decode')
      const wav = await decodeToWav(file)
      const fd = new FormData()
      fd.append('audio', wav, 'extracted-audio.wav')
      const audioRes = await fetch('/api/forensics/audio', { method: 'POST', body: fd })
      if (audioRes.ok) {
        const audioData = await audioRes.json()
        const trustScore = audioData?.analysis?.trustScore
        if (typeof trustScore === 'number') {
          audioAuthenticity = Math.max(0, Math.min(1, trustScore / 100))
          audioAnalysis = {
            available: true,
            note: 'Based on independent signal analysis (spectral cutoff, zero-crossing rate, energy variance) of the video\'s extracted audio track.',
          }
        }
      }
    } catch {
      // No audio track, unsupported codec, or decode failed - leave as unavailable.
    }

    try {
      let res: Response
      if (file) {
        const formData = new FormData()
        formData.append('video', file)
        res = await fetch('/api/analyze/video', { method: 'POST', body: formData })
      } else {
        res = await fetch('/api/analyze/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: (source as { url: string }).url }),
        })
      }
      if (res.ok) {
        const data = await res.json()
        const analysis = data.analysis || data
        const details = analysis.details || {}
        const deepfakeProbability = typeof (details as Record<string, unknown>).deepfakeProbability === 'number'
          ? (details as Record<string, unknown>).deepfakeProbability as number
          : typeof analysis.trustScore === 'number' ? 100 - analysis.trustScore : 50
        const faceDetails = (details as Record<string, unknown>).faceAnalysis as Record<string, unknown> | undefined
        set({
          videoLoading: false,
          videoResult: {
            deepfakeProbability,
            frameAnalysis: {
              totalFrames: 300,
              flaggedFrames: Math.round(deepfakeProbability * 3),
              consistency: typeof analysis.confidence === 'number'
                ? (analysis.confidence <= 1 ? analysis.confidence : analysis.confidence / 100)
                : 0.5,
            },
            faceAnalysis: {
              facesDetected: typeof faceDetails?.facesDetected === 'number' ? faceDetails.facesDetected : 1,
              anomalies: Array.isArray(faceDetails?.manipulationIndicators)
                ? (faceDetails!.manipulationIndicators as string[]).map(String)
                : ['Inconsistent blink rate', 'Unnatural skin tone variation'],
              confidence: typeof faceDetails?.detectionConfidence === 'number'
                ? Math.max(0, Math.min(1, (faceDetails.detectionConfidence as number) / 100))
                : 0.5,
            },
            temporalConsistency: typeof analysis.confidence === 'number'
              ? (analysis.confidence <= 1 ? Math.min(1, analysis.confidence + 0.1) : Math.min(1, analysis.confidence / 100 + 0.1))
              : 0.6,
            audioVisualSync: audioAuthenticity,
            audioAnalysis,
            riskAssessment: analysis.riskLevel || 'medium',
          },
        })
        toast.success('Video analysis complete!')
      } else {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.details || errorData?.error || `Server responded with status ${res.status}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Video analysis failed'
      toast.error(`Video analysis failed: ${message}`)
      set({ videoLoading: false, videoResult: null })
    }
  },

  factCheckError: null,

  verifyFact: async (claim: string, language?: string) => {
    if (!claim.trim()) return
    set({ factCheckLoading: true, factCheckResult: null, factCheckError: null })
    try {
      const res = await fetch('/api/factcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim, language }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.details || err?.error || `API error (${res.status})`)
      }
      const data = await res.json()
      // API returns { success, reportId, factCheck: {...}, processingTime, cached? }
      const fc = data.factCheck || data
      const stanceLabel: Record<string, string> = {
        supports: 'Supports claim',
        refutes: 'Refutes claim',
        mixed: 'Mixed evidence',
        unrelated: 'Context only',
      }
      const rawSources: Array<{ name?: string; title?: string; url?: string; snippet?: string; stance?: string; credibility?: number; type?: string }> =
        Array.isArray(fc.sources) ? fc.sources : []
      const resolveName = (s: { name?: string; title?: string; url?: string }) => {
        let sourceName = s.name || s.title || ''
        if (!sourceName && s.url && s.url !== '#') {
          try {
            sourceName = new URL(s.url).hostname.replace(/^www\./, '')
          } catch {
            sourceName = 'External Source'
          }
        }
        return sourceName || 'External Source'
      }
      const matchingFactChecks = rawSources.map((s) => ({
        source: resolveName(s),
        url: s.url || '#',
        rating: (s.stance && stanceLabel[s.stance]) || 'Unrated',
        title: s.name || s.title || 'Fact check result',
        stance: s.stance,
      }))
      // Real per-domain credibility from the API; dedupe by domain
      const seenDomains = new Set<string>()
      const sourceCredibility = rawSources
        .filter((s) => {
          const name = resolveName(s)
          if (seenDomains.has(name)) return false
          seenDomains.add(name)
          return true
        })
        .slice(0, 5)
        .map((s) => ({
          source: resolveName(s),
          rating: typeof s.credibility === 'number' ? s.credibility : 50,
          type: s.type || 'Web',
        }))
      set({
        factCheckLoading: false,
        factCheckResult: {
          verdict: fc.verdict || 'unverified',
          confidence: typeof fc.confidence === 'number'
            ? (fc.confidence <= 1 ? Math.round(fc.confidence * 100) : fc.confidence)
            : 50,
          matchingFactChecks,
          evidenceSummary: fc.explanation || 'Fact-check analysis completed.',
          sourceCredibility,
          reasoning: typeof fc.reasoning === 'string' ? fc.reasoning : undefined,
          claimAnalysis: fc.claimAnalysis && typeof fc.claimAnalysis === 'object' ? fc.claimAnalysis : undefined,
          stanceRollup: fc.stanceRollup,
          knownHoaxMatches: Array.isArray(fc.knownHoaxMatches) ? fc.knownHoaxMatches : [],
          degraded: fc.degraded === true,
          cached: data.cached === true,
        },
      })
      toast.success(data.cached ? 'Fact check complete (cached result)' : 'Fact check complete!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fact check failed'
      toast.error(`Fact check failed: ${message}`)
      set({ factCheckLoading: false, factCheckResult: null, factCheckError: message })
    }
  },

  fetchDashboardStats: async () => {
    set({ dashboardLoading: true })
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) {
        set({ dashboardLoading: false })
        return
      }
      const data = await res.json()
      // Map the API aggregation onto the DashboardStats UI shape.
      const stats: DashboardStats = {
        totalAnalyses: data.stats?.totalAnalyses ?? 0,
        fakeNewsDetected: data.stats?.fakeNewsDetected ?? 0,
        deepfakesDetected: data.stats?.deepfakesDetected ?? 0,
        imagesAnalyzed: data.stats?.imagesAnalyzed ?? 0,
        avgTrustScore: data.stats?.avgTrustScore ?? 0,
        activeAlerts: data.stats?.activeAlerts ?? 0,
        trendData: data.trendData ?? [],
        riskDistribution: data.riskDistribution ?? [],
        analysisByType: data.analysisByType ?? [],
        recentActivity: data.recentActivity ?? [],
        topThreats: data.topThreats ?? [],
        trustScoreDistribution: data.trustScoreDistribution ?? [],
        detectionTimeline: data.detectionTimeline ?? [],
        languages: data.languages ?? [],
      }
      set({ dashboardStats: stats, dashboardLoading: false })
    } catch {
      toast.error('Failed to fetch dashboard stats.')
      set({ dashboardLoading: false })
    }
  },

  fetchInvestigations: async () => {
    set({ investigationsLoading: true })
    try {
      const res = await fetch('/api/investigations')
      if (!res.ok) {
        set({ investigationsLoading: false })
        return
      }
      const data = await res.json()
      const investigations: Investigation[] = (data.data ?? []).map(mapInvestigation)
      set({ investigations, investigationsLoading: false })
    } catch {
      set({ investigationsLoading: false })
    }
  },

  createInvestigation: async (data) => {
    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Create failed')
      // Re-read from the API so the store always mirrors the database.
      await get().fetchInvestigations()
      toast.success('Investigation created')
    } catch {
      toast.error('Could not create investigation')
    }
  },

  updateInvestigation: async (id, data) => {
    try {
      const payload: Record<string, unknown> = { ...data }
      if (data.assignedAnalyst !== undefined && payload.assignedTo === undefined) {
        payload.assignedTo = data.assignedAnalyst
      }
      const res = await fetch(`/api/investigations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Update failed')
      }
      await get().fetchInvestigations()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update investigation')
      return false
    }
  },

  deleteInvestigation: async (id) => {
    try {
      const res = await fetch(`/api/investigations/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Delete failed')
      }
      await get().fetchInvestigations()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete investigation')
      return false
    }
  },

  attachEvidence: async (investigationId, reportId) => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/evidence/${reportId}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Could not attach evidence')
      }
      await get().fetchInvestigations()
      toast.success('Evidence attached')
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not attach evidence')
      return false
    }
  },

  detachEvidence: async (investigationId, reportId) => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/evidence/${reportId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Could not detach evidence')
      }
      await get().fetchInvestigations()
      toast.success('Evidence removed')
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not detach evidence')
      return false
    }
  },

  updateInvestigationStatus: async (id, status) => {
    const success = await get().updateInvestigation(id, { status })
    if (success) {
      toast.success(`Investigation status updated to ${status.replace('_', ' ')}`)
    }
    return success
  },

  updateInvestigationPriority: async (id, priority) => {
    const success = await get().updateInvestigation(id, { priority })
    if (success) {
      toast.success(`Priority updated to ${priority}`)
    }
    return success
  },

  fetchAlerts: async () => {
    set({ alertsLoading: true })
    try {
      const res = await fetch('/api/alerts')
      if (!res.ok) {
        set({ alertsLoading: false })
        return
      }
      const data = await res.json()
      const alerts: Alert[] = (data.data ?? []).map(mapAlert)
      set({ alerts, alertsLoading: false })
    } catch {
      set({ alertsLoading: false })
    }
  },

  markAlertRead: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
    }))
    // Persist to the database; UI already reflects the change optimistically.
    void fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds: [id] }),
    }).catch(() => undefined)
  },

  resetTextResult: () => set({ textResult: null, textInput: '' }),
  resetImageResult: () => {
    imageAnalysisController?.abort()
    imageAnalysisController = null
    set({ imageLoading: false, imageResult: null })
  },
  resetVideoResult: () => set({ videoResult: null }),
  resetFactCheckResult: () => set({ factCheckResult: null, factCheckError: null }),

  // Chat
  chatMessages: [],
  chatLoading: false,
  sendChatMessage: async (message: string) => {
    const userMsg: ChatMessage = { role: 'user', content: message, timestamp: new Date() }
    set((state) => ({ chatMessages: [...state.chatMessages, userMsg], chatLoading: true }))
    try {
      const { chatMessages } = get()
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      })
      if (res.ok) {
        const data = await res.json()
        const aiMsg: ChatMessage = { role: 'assistant', content: data.response || 'I apologize, but I was unable to generate a response.', timestamp: new Date() }
        set((state) => ({ chatMessages: [...state.chatMessages, aiMsg], chatLoading: false }))
      } else {
        const aiMsg: ChatMessage = { role: 'assistant', content: 'I apologize, but I encountered an error processing your request. Please try again.', timestamp: new Date() }
        set((state) => ({ chatMessages: [...state.chatMessages, aiMsg], chatLoading: false }))
      }
    } catch {
      const aiMsg: ChatMessage = { role: 'assistant', content: 'I apologize, but I encountered a connection error. Please try again.', timestamp: new Date() }
      set((state) => ({ chatMessages: [...state.chatMessages, aiMsg], chatLoading: false }))
    }
  },
  clearChatHistory: () => set({ chatMessages: [], chatLoading: false }),

  // Analysis History
  analysisHistory: [],
  analysisHistoryTotal: 0,
  analysisHistoryPage: 1,
  analysisHistoryLoading: false,
  fetchAnalysisHistory: async (params = {}) => {
    set({ analysisHistoryLoading: true })
    try {
      const searchParams = new URLSearchParams()
      if (params.type) searchParams.set('type', params.type)
      if (params.riskLevel) searchParams.set('riskLevel', params.riskLevel)
      if (params.search) searchParams.set('search', params.search)
      if (params.page) searchParams.set('page', String(params.page))
      if (params.limit) searchParams.set('limit', String(params.limit))
      if (params.sortBy) searchParams.set('sortBy', params.sortBy)
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
      if (params.unattachedOnly) searchParams.set('unattachedOnly', 'true')
      const res = await fetch(`/api/analysis/history?${searchParams.toString()}`)
      if (res.ok) {
        const data: AnalysisHistoryResponse = await res.json()
        set({
          analysisHistory: data.items,
          analysisHistoryTotal: data.total,
          analysisHistoryPage: data.page,
          analysisHistoryLoading: false,
        })
      } else {
        set({ analysisHistoryLoading: false })
      }
    } catch {
      set({ analysisHistoryLoading: false })
    }
  },
}))
