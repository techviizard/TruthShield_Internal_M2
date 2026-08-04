/**
 * Anthropic (Claude) provider adapter.
 *
 * Anthropic's Messages API differs from OpenAI's: the system prompt is a
 * top-level field (not a message), and images are base64/URL "source" blocks.
 * This adapter translates the app's provider-agnostic `ChatMessage[]`.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ChatOptions, ContentPart, LLMProvider } from '../types'
import { getAIConfig, type ResolvedAIConfig } from '../config'
import { parseDataUrl } from '../json'

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'image'; source: { type: 'url'; url: string } }

function toAnthropicBlocks(content: string | ContentPart[]): AnthropicBlock[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return content.map((p): AnthropicBlock => {
    if (p.type === 'text') return { type: 'text', text: p.text }
    const { mediaType, base64 } = parseDataUrl(p.url)
    if (base64) {
      return { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 } }
    }
    return { type: 'image', source: { type: 'url', url: p.url } }
  })
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic'
  readonly supportsVision: boolean
  private client: Anthropic
  private cfg: ResolvedAIConfig

  constructor() {
    this.cfg = getAIConfig()
    this.client = new Anthropic({
      apiKey: this.cfg.apiKey,
      ...(this.cfg.baseUrl ? { baseURL: this.cfg.baseUrl } : {}),
    })
    this.supportsVision = this.cfg.visionEnabled
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string> {
    // Extract system messages into the top-level `system` field.
    const systemText = messages
      .filter((m) => m.role === 'system')
      .map((m) => (typeof m.content === 'string' ? m.content : m.content.map((c) => ('text' in c ? c.text : '')).join('\n')))
      .join('\n\n')

    const convo = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: toAnthropicBlocks(m.content),
      }))

    const res = await this.client.messages.create({
      model: opts?.model || this.cfg.model,
      max_tokens: opts?.maxTokens ?? this.cfg.maxTokens,
      temperature: opts?.temperature ?? this.cfg.temperature,
      ...(systemText ? { system: systemText } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: convo as any,
    })

    const block = res.content.find((b) => b.type === 'text')
    const text = block && 'text' in block ? block.text : ''
    if (!text) throw new Error('No response from anthropic')
    return text
  }
}
