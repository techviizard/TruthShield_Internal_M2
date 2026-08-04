/**
 * Provider-agnostic AI types.
 *
 * The rest of the app depends ONLY on these types + the helpers in `./index.ts`,
 * never on a specific SDK. To add a provider, implement `LLMProvider`.
 */

export type ChatRole = 'system' | 'user' | 'assistant'

/** A single content part of a message. Text or an image (as a data URL or https URL). */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }

export interface ChatMessage {
  role: ChatRole
  content: string | ContentPart[]
}

export interface ChatOptions {
  /** Override the default model for this call (e.g. use the vision model). */
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMProvider {
  /** Human-readable provider id, e.g. "openai", "anthropic", "ollama". */
  readonly name: string
  /** Whether the configured model can accept images. */
  readonly supportsVision: boolean
  /**
   * Run a chat/completion and return the assistant's text content.
   * Implementations translate `ChatMessage[]` into their own wire format.
   */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>
}
