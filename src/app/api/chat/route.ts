import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, type ChatMessage } from '@/lib/ai';

const SYSTEM_PROMPT = `You are TruthShield AI Assistant, an expert digital media verification specialist. You help users identify misinformation, detect deepfakes, verify facts, and analyze digital media for manipulation.

Your expertise includes:
- Deepfake detection in videos and images
- AI-generated content identification
- Fact-checking methodology and best practices
- Image forensics and manipulation detection techniques
- Propaganda and misinformation pattern recognition
- Source verification and credibility assessment
- Reverse image search guidance
- Understanding of metadata analysis
- Social media verification techniques

Guidelines:
- Be helpful, accurate, and thorough in your responses
- Provide actionable steps users can take to verify media
- Reference established fact-checking organizations and tools when relevant
- Explain technical concepts in accessible language
- When uncertain, acknowledge limitations and suggest further verification
- Use markdown formatting for better readability (headers, lists, bold, etc.)
- Stay focused on digital media verification topics
- If asked about non-verification topics, politely redirect to your area of expertise

You are part of the TruthShield platform, an AI-Powered Digital Media Verification Platform that helps combat misinformation and manipulated media.`;

/**
 * Append a message, merging it into the previous one if the role is the same.
 * Some models (e.g. Gemma/Mistral behind OpenRouter) reject consecutive
 * messages from the same role, so keep the conversation strictly alternating.
 */
function pushMerged(messages: ChatMessage[], role: 'user' | 'assistant', content: string) {
  const last = messages[messages.length - 1];
  if (last && last.role === role && typeof last.content === 'string') {
    last.content += '\n\n' + content;
  } else {
    messages.push({ role, content });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message exceeds maximum length of 5000 characters' },
        { status: 400 }
      );
    }

    // Build conversation messages
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add conversation history (last 20 messages for context)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role && msg.content && typeof msg.content === 'string') {
          const role = msg.role === 'assistant' ? 'assistant' : 'user';
          pushMerged(messages, role, msg.content);
        }
      }
    }

    // Add the current user message
    pushMerged(messages, 'user', message);

    // Free OpenRouter models are often rate-limited or briefly unavailable, and
    // the router may pick a different model on the next try - retry a couple of times.
    let responseContent = '';
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        responseContent = await chatCompletion(messages);
        if (responseContent) break;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    if (!responseContent && lastError) throw lastError;

    if (!responseContent) {
      return NextResponse.json(
        { error: 'No response generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: responseContent,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
