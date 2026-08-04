# Tab: AI Assistant (Chat)

**File:** `src/components/tabs/chat-tab.tsx` · **Data:** store `sendChatMessage` → `/api/chat` · **Status:** ✅

## What it is
Conversational assistant for analysts - ask questions, get help interpreting results.

## How it's built
Reads/writes chat history in the store; `sendChatMessage(msg)` posts to `/api/chat` (AI provider). `clearChatHistory()` resets.

## How it works (logic)
1. User message appended to history; `sendChatMessage` posts the conversation to `/api/chat`.
2. The route calls the configured AI provider (chat completion) and returns the reply.
3. Reply appended; UI re-renders.

## Future scope & enterprise enhancements
- **Tool/RAG grounding:** let the assistant call the analysis engines and cite DB results (agentic tool-use) rather than free-form chat.
- Streaming responses; per-conversation persistence.
- Guardrails + audit of assistant actions.
