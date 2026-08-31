/**
 * OpenAI-compatible provider adapter.
 *
 * Works with OpenAI, Kimi (Moonshot), Qwen (DashScope), and any local
 * OpenAI-compatible server (Ollama, LM Studio, vLLM) - the only difference is
 * the base URL + model, both from config/env.
 */
import OpenAI from 'openai'
import type { ChatMessage, ChatOptions, ContentPart, LLMProvider } from '../types'
import { getAIConfig, type ResolvedAIConfig } from '../config'

type OpenAIContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >

function toOpenAIContent(content: string | ContentPart[]): OpenAIContent {
  if (typeof content === 'string') return content
  return content.map((p) =>
    p.type === 'text'
      ? { type: 'text' as const, text: p.text }
      : { type: 'image_url' as const, image_url: { url: p.url } },
  )
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string
  readonly supportsVision: boolean
  private client: OpenAI
  private cfg: ResolvedAIConfig

  constructor() {
    this.cfg = getAIConfig()
    this.client = new OpenAI({ apiKey: this.cfg.apiKey, baseURL: this.cfg.baseUrl })
    this.name = this.cfg.provider
    this.supportsVision = this.cfg.visionEnabled
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: opts?.model || this.cfg.model,
      temperature: opts?.temperature ?? this.cfg.temperature,
      max_tokens: opts?.maxTokens ?? this.cfg.maxTokens,
      messages: messages.map((m) => ({
        role: m.role,
        content: toOpenAIContent(m.content),
      })) as any,
    })
    const content = res.choices[0]?.message?.content
    if (!content) throw new Error(`No response from ${this.name}`)
    return content
  }
}
