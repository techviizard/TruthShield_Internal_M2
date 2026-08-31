/**
 * AI configuration accessor.
 *
 * All values now come from the single central config (`src/config/app.config.ts`).
 * This module stays as the AI layer's stable interface: `getAIConfig()` returns
 * the resolved provider settings and validates that a key is present.
 *
 * Switch providers WITHOUT touching application code: set `AI_PROVIDER` and the
 * matching key/model in `.env.local` (see `.env.example`).
 */

import {
  getConfig,
  resetConfig,
  PROVIDER_PRESETS,
  type ProviderKind,
  type ProviderPreset,
} from '@/config/app.config'

export type { ProviderKind, ProviderPreset }
export { PROVIDER_PRESETS }

export interface ResolvedAIConfig {
  provider: string
  kind: ProviderKind
  apiKey: string
  baseUrl?: string
  model: string
  visionModel: string
  temperature: number
  maxTokens: number
  /** true when a vision-capable model is configured. */
  visionEnabled: boolean
  requestTimeoutMs: number
}

export function getAIConfig(): ResolvedAIConfig {
  const { ai } = getConfig()
  if (!ai.configured) {
    throw new Error(
      `AI_API_KEY is required for provider "${ai.provider}". Set it in .env.local (see .env.example).`,
    )
  }
  return {
    provider: ai.provider,
    kind: ai.kind,
    apiKey: ai.apiKey,
    baseUrl: ai.baseUrl,
    model: ai.model,
    visionModel: ai.visionModel,
    temperature: ai.temperature,
    maxTokens: ai.maxTokens,
    visionEnabled: ai.visionEnabled,
    requestTimeoutMs: ai.requestTimeoutMs,
  }
}

/** True when an AI key is configured - lets callers degrade instead of throwing. */
export function isAIConfigured(): boolean {
  return getConfig().ai.configured
}

/** Test helper - clear the memoized config (e.g. after changing env in tests). */
export function resetAIConfig(): void {
  resetConfig()
}
