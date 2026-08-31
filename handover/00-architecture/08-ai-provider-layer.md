# AI Provider Layer (provider-agnostic)

**Location:** `src/lib/ai/` · **Public import:** `@/lib/ai`

TruthShield is **not tied to any AI vendor**. It previously used a proprietary SDK (ZAI); that dependency is gone. The app now talks to a small provider-agnostic layer, and you switch providers **with environment variables only - no code changes.**

## Supported providers

| `AI_PROVIDER` | Adapter | Notes |
|---------------|---------|-------|
| `openai` | openai-compatible | OpenAI API |
| `anthropic` | anthropic | Claude (Messages API) |
| `kimi` | openai-compatible | Moonshot/Kimi endpoint |
| `qwen` | openai-compatible | Alibaba DashScope (OpenAI-compatible) |
| `ollama` | openai-compatible | **Local** - `http://localhost:11434/v1` |
| `lmstudio` | openai-compatible | **Local** - `http://localhost:1234/v1` |
| `custom` | openai-compatible | Any OpenAI-compatible server (`AI_BASE_URL` required) |

Anything speaking the OpenAI Chat Completions protocol works out of the box (Groq, Together, OpenRouter, vLLM, Azure, …) via `custom` + `AI_BASE_URL`.

## Files

```
src/lib/ai/
  config.ts                 env → resolved config + provider presets (endpoints, default models)
  types.ts                  LLMProvider interface + ChatMessage/ContentPart (the contract)
  json.ts                   robust JSON extraction + data-URL parsing
  search.ts                 pluggable web search (tavily/brave/none)
  providers/
    openai-compatible.ts    adapter using the `openai` SDK (base URL configurable)
    anthropic.ts            adapter using `@anthropic-ai/sdk`
  index.ts                  facade: getProvider() + helpers the app imports
```

## The contract (`types.ts`)

Everything depends only on this interface, never on an SDK:

```ts
interface LLMProvider {
  name: string
  supportsVision: boolean
  chat(messages: ChatMessage[], opts?): Promise<string>
}
```

`ChatMessage.content` is either a string or `ContentPart[]` (text + image parts). Each adapter translates that into its own wire format (OpenAI `image_url` blocks vs. Anthropic `image` source blocks; Anthropic also lifts `system` messages to the top-level field).

## Public helpers (`index.ts`) - unchanged names

The rest of the app imports these exactly as before, so routes barely changed:

| Helper | Purpose |
|--------|---------|
| `structuredLLMAnalysis(system, user)` | chat that must return JSON → parsed object |
| `vlmImageAnalysis(imageUrl, prompt)` | vision analysis → parsed JSON (throws if model isn't vision-capable) |
| `vlmVideoAnalysis(videoUrl, prompt)` | best-effort via the vision path (see caveat) |
| `chatCompletion(messages)` | raw chat → text (assistant tab) |
| `webSearchFactCheck(claim, n)` | fact-check search via the configured search provider |
| `webSearch(query, n)` | generic web search (returns `[]` if disabled) |
| `getDomainCredibility(url)` | domain reputation (config-driven) |
| `getModelLabel()` | `"provider:model"` stored on `AnalysisReport.aiModel` |
| `bufferToDataUrl(buf, mime)` | file → data URL |

## Config resolution (`config.ts`)

`getAIConfig()` reads env once (memoized), picks a preset by `AI_PROVIDER`, and applies overrides (`AI_BASE_URL`, `AI_MODEL`, `AI_VISION_MODEL`, `AI_TEMPERATURE`, `AI_MAX_TOKENS`, `AI_VISION_ENABLED`). It throws clear errors for a missing key or unknown provider. Full variable list: [`.env.example`](../../.env.example).

## Capability caveats (important)

Two features were provider-specific in the old SDK and are handled explicitly now:

1. **Web search** - not part of any LLM chat API. It's a **separate optional provider** (`SEARCH_PROVIDER`=`tavily`/`brave`/`none`). If unset, `webSearch` returns `[]` and fact-check degrades gracefully (model reasoning only, no live sources).
2. **Video** - no mainstream provider accepts raw video. `vlmVideoAnalysis` routes through the vision path (thumbnail/frame) as a best effort. **True per-frame video analysis needs server-side frame extraction (ffmpeg)** - see [enterprise roadmap](../04-operations/04-enterprise-roadmap.md).

## Adding a new provider

- **OpenAI-compatible:** just add a preset in `config.ts` (base URL + default models). No new code.
- **Different protocol:** implement `LLMProvider` in `providers/`, and select it in `getProvider()` by a new `ProviderKind`.

## Future scope & enterprise enhancements

- Streaming responses (`chat` returns a full string today).
- Per-request provider/model routing (cost/latency tiers, fallbacks on error).
- Retries + circuit breaker + timeouts around provider calls.
- Token/cost accounting per request → feeds Model Metrics.
- Tool-use/function-calling abstraction so the assistant can call engines (agentic).
- Move provider config to an admin UI / secrets manager instead of process env.
