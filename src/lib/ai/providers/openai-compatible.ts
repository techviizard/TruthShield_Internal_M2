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
  try {
    // 1. Grab the OpenRouter URL from your .env file
    const baseUrl = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";
    const exactUrl = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

    // 2. Make a direct raw fetch request to OpenRouter
    const response = await fetch(exactUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000", 
        "X-Title": "TruthShield" 
      },
    body: JSON.stringify({
  model: opts?.model || process.env.AI_MODEL || "openrouter/free",
  messages: messages.map((message) => ({
    ...message,
    content: Array.isArray(message.content)
      ? message.content.map((part) =>
          part.type === 'image'
            ? {
                type: 'image_url',
                image_url: {
                  url: part.url,
                },
              }
            : part
        )
      : message.content,
  })),
  temperature: opts?.temperature ?? 0.2
})
    });

    // 3. Parse the response
    const rawText = await response.text();
    
    if (rawText.trim().startsWith("<")) {
      console.error("HTML ERROR RETURNED:", rawText);
      throw new Error("Received an HTML error page. Check your API key and URL.");
    }

    const res = JSON.parse(rawText);

    if (!res || !res.choices || res.choices.length === 0) {
      console.error("NO CHOICES. RAW JSON:", res);
      throw new Error(`No choices returned from OpenRouter`);
    }

    const content = res.choices[0]?.message?.content;
    if (!content) {
      throw new Error(`Empty response content from OpenRouter`);
    }

    return content;
  } catch (error: any) {
    console.error(`Error in OpenRouter chat provider:`, error?.message || error);
    throw error;
  }
}
}