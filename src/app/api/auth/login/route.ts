import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import {
  createSessionToken, revokeSessionToken, sessionCookieOptions, SESSION_COOKIE, SESSION_TTL_SECONDS,
} from '@/lib/session'

const MAX_FAILURES = 8
const WINDOW_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function equalSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * x-forwarded-for can be forged by the client, so it is only used when you say a
 * trusted proxy (e.g. Caddy) sets it: TRUST_PROXY=true. Otherwise all attempts
 * share one bucket, which is safe (nobody can bypass it) if a little strict.
 */
function clientKey(request: NextRequest): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
  }
  return 'shared'
}

export async function POST(request: NextRequest) {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const secret = process.env.AUTH_SECRET
  if (!email || !password || !secret || secret.length < 32 || password.length < 16) {
    console.error('[auth] Not configured: set ADMIN_EMAIL, ADMIN_PASSWORD (16+ chars) and AUTH_SECRET (32+ chars). Run: npm run setup:auth')
    return NextResponse.json({ error: 'Sign-in is currently unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  const key = clientKey(request)
  const now = Date.now()
  const record = attempts.get(key)
  if (record && record.resetAt > now && record.count >= MAX_FAILURES) {
    return NextResponse.json({ error: 'Too many login attempts. Try again in 15 minutes.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > 4096) return NextResponse.json({ error: 'Login request is too large.' }, { status: 413 })
    const body = await request.json()
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.email.length > 254 || body.password.length > 256) {
      return NextResponse.json({ error: 'Invalid login request.' }, { status: 400 })
    }

    const normalisedEmail = email.trim().toLowerCase()
    const emailOk = equalSecret(body.email.trim().toLowerCase(), normalisedEmail)
    const passwordOk = equalSecret(body.password, password)
    if (!emailOk || !passwordOk) {
      const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + WINDOW_MS }
      current.count += 1
      attempts.set(key, current)
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    attempts.delete(key)
    const previous = request.cookies.get(SESSION_COOKIE)?.value
    if (previous) revokeSessionToken(previous) // never reuse an old session

    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE, createSessionToken(normalisedEmail), sessionCookieOptions(SESSION_TTL_SECONDS))
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch {
    return NextResponse.json({ error: 'Invalid login request.' }, { status: 400 })
  }
}
