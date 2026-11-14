import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai'
import { isAIConfigured } from '@/lib/ai/config'

const NAMES: Record<string, string> = { hi: 'Hindi', te: 'Telugu', en: 'English' }

export async function POST(request: NextRequest) {
  try {
    const { text, language } = await request.json()
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text is too long (max 5000 characters)' }, { status: 400 })
    }
    if (!isAIConfigured()) {
      return NextResponse.json(
        { error: 'No AI provider configured. Set AI_PROVIDER and AI_API_KEY in .env' },
        { status: 503 }
      )
    }
    const from = NAMES[language as string] ?? 'the original language'
    const translation = await chatCompletion([
      {
        role: 'system',
        content: `You are a translator. Translate the user's text from ${from} to English. The text came from OCR and may contain small recognition errors or stray characters, so translate the intended meaning and ignore noise. Reply with the English translation only, no notes.`,
      },
      { role: 'user', content: text },
    ])
    return NextResponse.json({ translation: translation.trim() })
  } catch (error) {
    console.error('OCR translate error:', error)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}