/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TruthShield by CyArt - SINGLE CENTRALIZED CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the ONE place where every application setting lives:
 *   • third-party API credentials (search providers)
 *   • AI service API keys + model selection
 *   • demo account credentials used for testing / seeding
 *   • environment-specific settings (URLs, database, logging)
 *   • operational parameters (upload limits, page sizes, refresh intervals)
 *   • feature flags
 *
 * Everything is read from environment variables with sane defaults, so a
 * deployment is fully configured by `.env.local` alone - no code changes.
 * Nothing outside this file should read `process.env` (except `NODE_ENV`
 * guards inside framework glue).
 *
 * ── Two exports ──
 *   `appConfig` - full config, SERVER ONLY (contains secrets).
 *   `publicConfig` - secret-free subset, safe to import in client components.
 *
 * See `.env.example` for the documented variable list.
 */

// ── env helpers ──────────────────────────────────────────────────────────────

const env = (key: string, fallback = ''): string => {
  const v = process.env[key]
  return v === undefined || v === '' ? fallback : v
}

const envInt = (key: string, fallback: number): number => {
  const n = Number(process.env[key])
  return Number.isFinite(n) ? n : fallback
}

const envFloat = (key: string, fallback: number): number => {
  const n = Number(process.env[key])
  return Number.isFinite(n) ? n : fallback
}

const envBool = (key: string, fallback: boolean): boolean => {
  const v = process.env[key]
  if (v === undefined || v === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
}

// ── AI provider presets ──────────────────────────────────────────────────────

export type ProviderKind = 'openai' | 'anthropic'

export interface ProviderPreset {
  kind: ProviderKind
  /** OpenAI-compatible endpoint (unused for the native Anthropic SDK). */
  baseUrl?: string
  defaultModel: string
  defaultVisionModel: string
  /** Local providers accept any key; the SDKs still require a non-empty string. */
  apiKeyOptional?: boolean
}

/**
 * Named provider presets. `AI_PROVIDER` selects one; every field can be
 * overridden via `AI_BASE_URL` / `AI_MODEL` / `AI_VISION_MODEL`.
 * `custom` requires `AI_BASE_URL`.
 */
export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: {
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    defaultVisionModel: 'gpt-4o-mini',
  },
  anthropic: {
    kind: 'anthropic',
    defaultModel: 'claude-sonnet-4-5',
    defaultVisionModel: 'claude-sonnet-4-5',
  },
  kimi: {
    // Moonshot / Kimi - OpenAI-compatible
    kind: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    defaultVisionModel: 'moonshot-v1-8k-vision-preview',
  },
  qwen: {
    // Alibaba DashScope OpenAI-compatible endpoint
    kind: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    defaultVisionModel: 'qwen-vl-plus',
  },
  ollama: {
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    defaultVisionModel: 'llava',
    apiKeyOptional: true,
  },
  lmstudio: {
    kind: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    defaultVisionModel: 'local-model',
    apiKeyOptional: true,
  },
  custom: {
    // Any OpenAI-compatible server; AI_BASE_URL required.
    kind: 'openai',
    defaultModel: 'local-model',
    defaultVisionModel: 'local-model',
    apiKeyOptional: true,
  },
}

// ── resolved config shape ────────────────────────────────────────────────────

export interface AppConfig {
  app: {
    name: string
    shortName: string
    version: string
    description: string
    defaultLanguage: string
    supportedLanguages: string[]
  }
  env: {
    nodeEnv: string
    isProduction: boolean
    isDevelopment: boolean
    /** Absolute base URL of this deployment (used for absolute links/exports). */
    appUrl: string
    port: number
    logLevel: 'debug' | 'info' | 'warn' | 'error'
  }
  database: {
    url: string
    /** Log every Prisma query (noisy - dev only by default). */
    logQueries: boolean
  }
  ai: {
    provider: string
    kind: ProviderKind
    apiKey: string
    baseUrl?: string
    model: string
    visionModel: string
    temperature: number
    maxTokens: number
    visionEnabled: boolean
    requestTimeoutMs: number
    /** false when no usable key is configured - callers degrade gracefully. */
    configured: boolean
  }
  search: {
    provider: 'none' | 'tavily' | 'brave' | string
    apiKey: string
    maxResults: number
    enabled: boolean
  }
  demo: {
    /** Demo/testing account - seeded by `npm run db:seed`. */
    enabled: boolean
    email: string
    password: string
    name: string
    role: string
    /** Also seed sample analyses/alerts/investigations for a populated demo. */
    seedSampleData: boolean
    sampleReportCount: number
  }
  features: {
    visionAnalysis: boolean
    webSearch: boolean
    communityReports: boolean
    watchlistScanning: boolean
    auditLog: boolean
    workflowAutomation: boolean
  }
  limits: {
    maxImageUploadMB: number
    maxVideoUploadMB: number
    maxAudioUploadMB: number
    maxTextChars: number
    historyPageSize: number
    alertsPageSize: number
    investigationsPageSize: number
    auditLogPageSize: number
    liveFeedLimit: number
    networkGraphNodeLimit: number
  }
  dashboard: {
    /** Client poll interval for dashboard widgets (ms). 0 disables polling. */
    refreshIntervalMs: number
    liveFeedIntervalMs: number
    tickerLimit: number
    recentActivityLimit: number
    topThreatsLimit: number
    sparklineDays: number
    trendDays: number
    defaultThreatRange: '24h' | '7d' | '30d'
  }
  analysis: {
    /** Clustering similarity threshold + minimum cluster size (campaigns). */
    campaignSimilarity: number
    campaignMinClusterSize: number
    campaignLookbackDays: number
    /** Trust score below which a report counts as a threat. */
    threatTrustThreshold: number
  }
}

// ── resolution ───────────────────────────────────────────────────────────────

function resolveAI(): AppConfig['ai'] {
  const provider = env('AI_PROVIDER', 'openai').toLowerCase()
  const preset = PROVIDER_PRESETS[provider]
  if (!preset) {
    throw new Error(
      `Unknown AI_PROVIDER "${provider}". Valid: ${Object.keys(PROVIDER_PRESETS).join(', ')}`,
    )
  }

  const baseUrl = env('AI_BASE_URL') || preset.baseUrl
  if (provider === 'custom' && !baseUrl) {
    throw new Error('AI_PROVIDER=custom requires AI_BASE_URL')
  }

  const rawKey = env('AI_API_KEY')
  const apiKey = rawKey || (preset.apiKeyOptional ? 'not-needed' : '')

  return {
    provider,
    kind: preset.kind,
    apiKey,
    baseUrl,
    model: env('AI_MODEL', preset.defaultModel),
    visionModel: env('AI_VISION_MODEL', preset.defaultVisionModel),
    temperature: envFloat('AI_TEMPERATURE', 0.2),
    maxTokens: envInt('AI_MAX_TOKENS', 2048),
    visionEnabled: envBool('AI_VISION_ENABLED', true),
    requestTimeoutMs: envInt('AI_TIMEOUT_MS', 120_000),
    configured: apiKey !== '',
  }
}

function resolveSearch(): AppConfig['search'] {
  const provider = env('SEARCH_PROVIDER', 'none').toLowerCase()
  const apiKey = env('SEARCH_API_KEY')
  return {
    provider,
    apiKey,
    maxResults: envInt('SEARCH_MAX_RESULTS', 10),
    enabled: provider !== 'none' && provider !== '' && apiKey !== '',
  }
}

function buildConfig(): AppConfig {
  const nodeEnv = env('NODE_ENV', 'development')
  const isProduction = nodeEnv === 'production'
  const ai = resolveAI()
  const search = resolveSearch()

  return {
    app: {
      name: env('APP_NAME', 'TruthShield'),
      shortName: 'TruthShield',
      version: env('APP_VERSION', '3.3.0'),
      description:
        'TruthShield by CyArt - AI-Powered Digital Media Verification Platform: detect deepfakes, combat misinformation, verify facts in real-time',
      defaultLanguage: env('APP_DEFAULT_LANGUAGE', 'en'),
      supportedLanguages: env('APP_SUPPORTED_LANGUAGES', 'en,hi,ta,te,bn,mr,gu,kn,ml,pa')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
    env: {
      nodeEnv,
      isProduction,
      isDevelopment: !isProduction,
      appUrl: env('APP_URL', `http://localhost:${envInt('PORT', 3000)}`),
      port: envInt('PORT', 3000),
      logLevel: env('LOG_LEVEL', isProduction ? 'warn' : 'info') as AppConfig['env']['logLevel'],
    },
    database: {
      url: env('DATABASE_URL', 'file:./db/custom.db'),
      logQueries: envBool('DATABASE_LOG_QUERIES', false),
    },
    ai,
    search,
    demo: {
      enabled: envBool('DEMO_MODE', !isProduction),
      email: env('DEMO_USER_EMAIL', 'analyst@truthshield.local'),
      password: env('DEMO_USER_PASSWORD', 'TruthShield#Demo2025'),
      name: env('DEMO_USER_NAME', 'Demo Analyst'),
      role: env('DEMO_USER_ROLE', 'analyst'),
      seedSampleData: envBool('DEMO_SEED_SAMPLE_DATA', true),
      sampleReportCount: envInt('DEMO_SAMPLE_REPORT_COUNT', 60),
    },
    features: {
      visionAnalysis: ai.visionEnabled && ai.configured,
      webSearch: search.enabled,
      communityReports: envBool('FEATURE_COMMUNITY_REPORTS', true),
      watchlistScanning: envBool('FEATURE_WATCHLIST_SCANNING', true),
      auditLog: envBool('FEATURE_AUDIT_LOG', true),
      workflowAutomation: envBool('FEATURE_WORKFLOW_AUTOMATION', true),
    },
    limits: {
      maxImageUploadMB: envInt('MAX_IMAGE_UPLOAD_MB', 20),
      maxVideoUploadMB: envInt('MAX_VIDEO_UPLOAD_MB', 100),
      maxAudioUploadMB: envInt('MAX_AUDIO_UPLOAD_MB', 50),
      maxTextChars: envInt('MAX_TEXT_CHARS', 50_000),
      historyPageSize: envInt('HISTORY_PAGE_SIZE', 10),
      alertsPageSize: envInt('ALERTS_PAGE_SIZE', 20),
      investigationsPageSize: envInt('INVESTIGATIONS_PAGE_SIZE', 20),
      auditLogPageSize: envInt('AUDIT_LOG_PAGE_SIZE', 50),
      liveFeedLimit: envInt('LIVE_FEED_LIMIT', 20),
      networkGraphNodeLimit: envInt('NETWORK_GRAPH_NODE_LIMIT', 200),
    },
    dashboard: {
      refreshIntervalMs: envInt('DASHBOARD_REFRESH_MS', 60_000),
      liveFeedIntervalMs: envInt('LIVE_FEED_REFRESH_MS', 15_000),
      tickerLimit: envInt('DASHBOARD_TICKER_LIMIT', 8),
      recentActivityLimit: envInt('DASHBOARD_ACTIVITY_LIMIT', 10),
      topThreatsLimit: envInt('DASHBOARD_TOP_THREATS_LIMIT', 5),
      sparklineDays: envInt('DASHBOARD_SPARKLINE_DAYS', 7),
      trendDays: envInt('DASHBOARD_TREND_DAYS', 7),
      defaultThreatRange: env('DASHBOARD_THREAT_RANGE', '30d') as '24h' | '7d' | '30d',
    },
    analysis: {
      campaignSimilarity: envFloat('CAMPAIGN_SIMILARITY', 0.32),
      campaignMinClusterSize: envInt('CAMPAIGN_MIN_CLUSTER_SIZE', 3),
      campaignLookbackDays: envInt('CAMPAIGN_LOOKBACK_DAYS', 30),
      threatTrustThreshold: envInt('THREAT_TRUST_THRESHOLD', 50),
    },
  }
}

let cached: AppConfig | null = null

/** Full configuration (server-side; contains secrets). */
export function getConfig(): AppConfig {
  if (!cached) cached = buildConfig()
  return cached
}

/** Clear the memo - used by tests after mutating env. */
export function resetConfig(): void {
  cached = null
}

/** Convenience singleton. Server-only: never import into client components. */
export const appConfig: AppConfig = getConfig()

// ── public (secret-free) subset ──────────────────────────────────────────────

export interface PublicConfig {
  app: AppConfig['app']
  features: AppConfig['features']
  limits: AppConfig['limits']
  dashboard: AppConfig['dashboard']
  ai: { provider: string; model: string; visionModel: string; visionEnabled: boolean; configured: boolean }
  search: { provider: string; enabled: boolean }
  demo: { enabled: boolean; email: string; name: string; role: string }
  env: { nodeEnv: string; appUrl: string }
}

/** Build the secret-free view of the configuration (safe for the browser). */
export function getPublicConfig(cfg: AppConfig = getConfig()): PublicConfig {
  return {
    app: cfg.app,
    features: cfg.features,
    limits: cfg.limits,
    dashboard: cfg.dashboard,
    ai: {
      provider: cfg.ai.provider,
      model: cfg.ai.model,
      visionModel: cfg.ai.visionModel,
      visionEnabled: cfg.ai.visionEnabled,
      configured: cfg.ai.configured,
    },
    search: { provider: cfg.search.provider, enabled: cfg.search.enabled },
    demo: {
      enabled: cfg.demo.enabled,
      email: cfg.demo.email,
      name: cfg.demo.name,
      role: cfg.demo.role,
    },
    env: { nodeEnv: cfg.env.nodeEnv, appUrl: cfg.env.appUrl },
  }
}

/**
 * Client-safe defaults. On the server this is the real resolved config; in the
 * browser bundle only these literal defaults exist (no secrets), and live
 * values are fetched from `/api/config`.
 */
export const publicConfig: PublicConfig = getPublicConfig()
