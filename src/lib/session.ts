import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'truthshield_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 8 // hard cap: 8 hours
const MAX_ACTIVE_SESSIONS = 20

export type SessionPayload = { sid: string; sub: string; role: 'admin'; iat: number; exp: number }
type SessionRecord = { sub: string; exp: number }

/**
 * Server-side session registry.
 *
 * A signed cookie alone can never be "logged out" - whoever holds a copy stays
 * signed in until it expires. So a token is only valid while its session id is
 * in this registry:
 *   - logout deletes the entry  -> the token (and any copy of it) is dead at once
 *   - server stop / restart     -> the registry lives in process memory, so it is
 *                                  empty on the next start and every old cookie
 *                                  is rejected (everyone must sign in again)
 *
 * It sits on globalThis so the proxy, the API routes and hot-reload all share
 * one registry inside the same server process.
 */
const g = globalThis as typeof globalThis & { __truthshieldSessions?: Map<string, SessionRecord> }
const activeSessions: Map<string, SessionRecord> = (g.__truthshieldSessions ??= new Map())

function secret(): string {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be configured with at least 32 characters')
  return value
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

/** Same attributes for set and clear, otherwise the browser may keep the cookie. */
export function sessionCookieOptions(maxAge: number) {
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production'
  return { httpOnly: true, secure, sameSite: 'strict' as const, path: '/', maxAge }
}

function parseToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    const [encoded, signature] = parts
    const expected = Buffer.from(sign(encoded))
    const actual = Buffer.from(signature)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.sid !== 'string' || typeof payload.sub !== 'string' || payload.role !== 'admin' || !Number.isInteger(payload.exp)) return null
    return payload
  } catch {
    return null // includes "AUTH_SECRET missing": fail closed
  }
}

function purge(now: number) {
  for (const [sid, record] of activeSessions) if (record.exp <= now) activeSessions.delete(sid)
  while (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
    const oldest = activeSessions.keys().next().value
    if (oldest === undefined) break
    activeSessions.delete(oldest)
  }
}

export function createSessionToken(email: string): string {
  const now = Math.floor(Date.now() / 1000)
  purge(now)
  const sid = randomBytes(24).toString('base64url')
  const exp = now + SESSION_TTL_SECONDS
  activeSessions.set(sid, { sub: email, exp })
  const payload: SessionPayload = { sid, sub: email, role: 'admin', iat: now, exp }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

/** Valid only if the signature is good, it has not expired AND the server still knows the session. */
export function verifySessionToken(token: string): SessionPayload | null {
  const payload = parseToken(token)
  if (!payload) return null
  const now = Math.floor(Date.now() / 1000)
  const record = activeSessions.get(payload.sid)
  if (!record || record.sub !== payload.sub || record.exp <= now || payload.exp <= now) {
    activeSessions.delete(payload.sid)
    return null
  }
  return payload
}

export function revokeSessionToken(token: string): void {
  const payload = parseToken(token)
  if (payload) activeSessions.delete(payload.sid)
}

export function revokeAllSessions(): void {
  activeSessions.clear()
}
