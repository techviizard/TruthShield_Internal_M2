/**
 * Provider-agnostic AI facade.
 *
 * The whole app imports from `@/lib/ai`. Swapping providers is purely a matter
 * of environment variables (see `src/lib/ai/config.ts` + `.env.example`) - no
 * application code changes. Supported: OpenAI, Anthropic, Kimi, Qwen, and any
 * OpenAI-compatible / locally-hosted model (Ollama, LM Studio, vLLM).
 */
import { getAIConfig } from './config'
import type { ChatMessage, LLMProvider } from './types'
import { OpenAICompatibleProvider } from './providers/openai-compatible'
import { AnthropicProvider } from './providers/anthropic'
import { extractJson } from './json'
import { webSearch, type SearchResult } from './search'
import {
  DOMAIN_CREDIBILITY,
  DEFAULT_DOMAIN_CREDIBILITY,
  type DomainCredibility,
} from '@/config/source-domains'

// ── Result types (unchanged public shape) ─────────────────────────────
export interface AnalysisResult {
  trustScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  flags: string[]
  explanation: string
  confidence: number
  recommendations: string[]
  details?: Record<string, unknown>
}

export interface FactCheckSource {
  name: string
  url: string
  snippet: string
  stance?: 'supports' | 'refutes' | 'mixed' | 'unrelated'
  credibility?: number
  type?: string
  /** Stance computed in-house from the snippet - independent of the model's read. */
  localStance?: {
    stance: 'support' | 'refute' | 'neutral' | 'unrelated'
    confidence: number
    relatedness: number
    cues: string[]
    rationale: string
  }
  /** 0..100 semantic similarity between the claim and this snippet. */
  similarity?: number
}

export interface KnownHoaxMatch {
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
}

export interface FactCheckResult {
  verdict: 'true' | 'false' | 'misleading' | 'unverified' | 'partially_true'
  confidence: number
  sources: FactCheckSource[]
  explanation: string
  reasoning?: string
  claimAnalysis?: {
    claimType?: string
    verifiability?: string
    logicalFallacies?: string[]
    keyEntities?: string[]
  }
  /** Aggregated in-house stance across the evidence set. */
  stanceRollup?: {
    support: number
    refute: number
    neutral: number
    unrelated: number
    net: number
    verdictHint: 'likely_false' | 'likely_true' | 'disputed' | 'unverified'
  }
  /** Recurring hoax narratives this claim matches. */
  knownHoaxMatches?: KnownHoaxMatch[]
  /** True when the verdict came from in-house engines because the model was unreachable. */
  degraded?: boolean
}

// ── Provider singleton ────────────────────────────────────────────────
let provider: LLMProvider | null = null

export function getProvider(): LLMProvider {
  if (provider) return provider
  const cfg = getAIConfig()
  provider = cfg.kind === 'anthropic' ? new AnthropicProvider() : new OpenAICompatibleProvider()
  return provider
}

/** Reset the memoized provider (tests / after env change). */
export function resetProvider(): void {
  provider = null
}

// ── Core helpers (same names the app already imports) ─────────────────

/** Raw chat completion → plain text. Used by the assistant/chat route. */
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  return getProvider().chat(messages)
}

/** LLM analysis that must return JSON. Parses the model output robustly. */
export async function structuredLLMAnalysis(
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const content = await getProvider().chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])
  return extractJson(content)
}

/** Vision analysis of an image (data URL or https URL) that must return JSON. */
export async function vlmImageAnalysis(
  imageUrl: string,
  prompt: string,
): Promise<Record<string, unknown>> {
  const cfg = getAIConfig()
  const p = getProvider()
  if (!p.supportsVision) {
    throw new Error(
      `The configured model (${cfg.provider}/${cfg.visionModel}) is not vision-capable. ` +
        `Set AI_VISION_MODEL to a vision model, or AI_VISION_ENABLED=false to disable image analysis.`,
    )
  }
  const content = await p.chat(
    [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image', url: imageUrl }] }],
    { model: cfg.visionModel },
  )
  return extractJson(content)
}

/**
 * "Video" analysis. Generic providers don't accept video; this is a best-effort
 * pass through the vision path (a thumbnail/frame). True per-frame video analysis
 * needs server-side frame extraction (ffmpeg) - see the enterprise roadmap.
 */
export async function vlmVideoAnalysis(
  videoUrl: string,
  prompt: string,
): Promise<Record<string, unknown>> {
  return vlmImageAnalysis(videoUrl, prompt)
}

// ── Source credibility + web search ───────────────────────────────────
export function getDomainCredibility(url: string): DomainCredibility {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    for (const [domain, info] of Object.entries(DOMAIN_CREDIBILITY)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) return info
    }
  } catch {
    // fall through
  }
  return DEFAULT_DOMAIN_CREDIBILITY
}

export { webSearch, isSearchEnabled } from './search'
export type { SearchResult } from './search'
export type { ChatMessage, ContentPart, ChatRole } from './types'

const SEARCH_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'that', 'this', 'these', 'those', 'it', 'its', 'of', 'in', 'on', 'at',
  'to', 'for', 'from', 'by', 'with', 'about', 'as', 'and', 'or', 'but',
  'has', 'have', 'had', 'will', 'would', 'can', 'could', 'should', 'do',
  'does', 'did', 'not', 'no', 'so', 'if', 'then', 'than', 'there', 'their',
])

/** Reduce a long claim to salient keywords (exact-quoting long claims kills recall). */
function buildSearchPhrase(claim: string): string {
  const normalized = claim.replace(/["']/g, '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= 80) return `"${normalized}"`
  const keywords = normalized.split(' ').filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w.toLowerCase()))
  return keywords.slice(0, 12).join(' ')
}

/**
 * Web-search fact-check helper. Uses the configured search provider (Tavily/Brave).
 * Returns [] when search is disabled - fact-check then relies on model reasoning
 * alone. Results are deduped and ranked by domain credibility.
 */
export async function webSearchFactCheck(
  claim: string,
  numResults = 10,
): Promise<Array<{ title?: string; url?: string; snippet?: string }>> {
  const phrase = buildSearchPhrase(claim)
  const queries = [
    `${phrase} fact check site:pib.gov.in OR site:altnews.in OR site:boomlive.in OR site:factly.in OR site:snopes.com OR site:politifact.com OR site:factcheck.org`,
    `${phrase} fact check debunked OR verified OR misleading`,
  ]

  const settled = await Promise.allSettled(queries.map((q) => webSearch(q, numResults)))
  const all: SearchResult[] = []
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') all.push(...outcome.value)
  }

  const seen = new Set<string>()
  const deduped = all.filter((r) => {
    const key = (r.url || r.title || '').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped.sort(
    (a, b) => getDomainCredibility(b.url || '').rating - getDomainCredibility(a.url || '').rating,
  )
}

/** Convert a file buffer to a base64 data URL. */
export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

/**
 * A stable label for the currently-configured model, stored on `AnalysisReport.aiModel`
 * so records reflect which provider/model actually produced them.
 */
export function getModelLabel(): string {
  const cfg = getAIConfig()
  return `${cfg.provider}:${cfg.model}`
}

/**
 * Model label that never throws. Callers that record what produced a result
 * still need a label when the provider is unconfigured and the result came from
 * an in-house fallback detector.
 */
export function getModelLabelSafe(fallback = 'unconfigured'): string {
  try {
    return getModelLabel()
  } catch {
    return fallback
  }
}
